import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

// Constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;

// --- Tool Definitions ---
const tools: FunctionDeclaration[] = [
  {
    name: "addToCart",
    description: "Add a specific product to the shopping cart. Use this when the user wants to buy something.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        productName: {
          type: Type.STRING,
          description: "The name of the product to add (e.g., 'Cyber Sneakers', 'Holo Watch')."
        }
      },
      required: ["productName"]
    }
  },
  {
    name: "openCart",
    description: "Open or view the shopping cart sidebar.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "checkout",
    description: "Proceed to checkout and complete the purchase.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "changeBackgroundColor",
    description: "Change the background theme of the website.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        color: {
           type: Type.STRING,
           description: "The color theme (e.g., 'red', 'blue', 'green', 'purple')."
        }
      },
      required: ["color"]
    }
  }
];

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  
  // Analysers for visualization
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;

  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private session: any = null;
  
  // State
  public isMuted: boolean = false;
  
  public onStateChange: (state: ConnectionState) => void;
  public onError: (error: string) => void;
  public onToolCall: (name: string, args: any) => Promise<any>;

  constructor(
    onStateChange: (state: ConnectionState) => void, 
    onError: (error: string) => void,
    onToolCall: (name: string, args: any) => Promise<any>
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onToolCall = onToolCall;
  }

  toggleMute(mute: boolean) {
    this.isMuted = mute;
  }

  async connect() {
    try {
      this.onStateChange(ConnectionState.CONNECTING);

      // 1. Setup Audio Contexts
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: INPUT_SAMPLE_RATE
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: OUTPUT_SAMPLE_RATE
      });

      // 2. Setup Analysers for Visualization
      this.inputAnalyser = this.inputAudioContext.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.inputAnalyser.smoothingTimeConstant = 0.5;

      this.outputAnalyser = this.outputAudioContext.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.5;

      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioContext.destination);

      // 3. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 4. Establish Live API Connection
      const sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          // We add the tools here
          tools: [{ functionDeclarations: tools }],
          systemInstruction: `
            You are "Nova", an advanced AI assistant for the 'CyberStore' website. 
            You can control the website interface directly.
            Available products: 'Cyber Sneakers' ($150), 'Holo Watch' ($299), 'Neon Jacket' ($120).
            If the user asks to buy something, use the 'addToCart' tool immediately.
            If they want to pay, use 'checkout'.
            Keep responses short, cool, and professional. 
          `,
        },
        callbacks: {
          onopen: () => {
            this.onStateChange(ConnectionState.CONNECTED);
            this.setupAudioInput(stream, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            await this.handleServerMessage(message, sessionPromise);
          },
          onclose: () => {
            this.onStateChange(ConnectionState.DISCONNECTED);
          },
          onerror: (e) => {
            console.error('Gemini Live Error:', e);
            this.onError("Connection lost.");
            this.disconnect();
          }
        }
      });

      this.session = sessionPromise;

    } catch (error: any) {
      console.error("Connection failed", error);
      this.onError(error.message || "Failed to connect to Gemini");
      this.onStateChange(ConnectionState.ERROR);
      this.disconnect();
    }
  }

  private setupAudioInput(stream: MediaStream, sessionPromise: Promise<any>) {
    if (!this.inputAudioContext) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.inputSource.connect(this.inputAnalyser!); 

    this.processor = this.inputAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (this.isMuted) return; // Don't send data if muted

      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      sessionPromise.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      }).catch(err => console.error("Error sending input:", err));
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage, sessionPromise: Promise<any>) {
    // 1. Handle Audio
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    
    if (base64Audio && this.outputAudioContext && this.outputNode) {
      const audioBytes = base64ToUint8Array(base64Audio);
      const audioBuffer = await decodeAudioData(
        audioBytes, 
        this.outputAudioContext, 
        OUTPUT_SAMPLE_RATE, 
        1
      );

      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode);
      source.addEventListener('ended', () => {
        this.activeSources.delete(source);
      });

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeSources.add(source);
    }

    // 2. Handle Tool Calls (Function Calling)
    if (message.toolCall) {
        console.log("Tool call received:", message.toolCall);
        for (const fc of message.toolCall.functionCalls) {
            try {
                // Execute client-side function
                const result = await this.onToolCall(fc.name, fc.args);
                
                // Send response back to Gemini
                sessionPromise.then((session) => {
                    session.sendToolResponse({
                        functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: result }
                        }]
                    });
                });
            } catch (error) {
                console.error("Tool execution failed:", error);
            }
        }
    }

    // 3. Handle Interruption
    const interrupted = message.serverContent?.interrupted;
    if (interrupted) {
      this.stopAllAudio();
    }
  }

  private stopAllAudio() {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    this.activeSources.clear();
    this.nextStartTime = 0;
  }

  disconnect() {
    this.stopAllAudio();

    if (this.session) {
        this.session.then((s: any) => {
            if(s.close) s.close();
        }).catch(() => {});
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }

    this.onStateChange(ConnectionState.DISCONNECTED);
  }
}