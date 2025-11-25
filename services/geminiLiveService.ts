import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

// Constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;

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
  private session: any = null; // Using any for the session object type from SDK
  
  public onStateChange: (state: ConnectionState) => void;
  public onError: (error: string) => void;

  constructor(
    onStateChange: (state: ConnectionState) => void, 
    onError: (error: string) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.onStateChange = onStateChange;
    this.onError = onError;
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
          systemInstruction: "You are a helpful, witty, and futuristic AI assistant residing in a digital sphere. Keep your responses concise and engaging.",
        },
        callbacks: {
          onopen: () => {
            this.onStateChange(ConnectionState.CONNECTED);
            this.setupAudioInput(stream, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            await this.handleServerMessage(message);
          },
          onclose: () => {
            this.onStateChange(ConnectionState.DISCONNECTED);
          },
          onerror: (e) => {
            console.error('Gemini Live Error:', e);
            this.onError("Connection error occurred.");
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
    this.inputSource.connect(this.inputAnalyser!); // Connect to visualiser

    this.processor = this.inputAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createPcmBlob(inputData);
      
      sessionPromise.then((session) => {
        session.sendRealtimeInput({ media: pcmBlob });
      }).catch(err => console.error("Error sending input:", err));
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage) {
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    
    if (base64Audio && this.outputAudioContext && this.outputNode) {
      // Decode audio
      const audioBytes = base64ToUint8Array(base64Audio);
      const audioBuffer = await decodeAudioData(
        audioBytes, 
        this.outputAudioContext, 
        OUTPUT_SAMPLE_RATE, 
        1
      );

      // Handle timing
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
        // There isn't a direct close on the promise wrapper, but normally we'd close the socket.
        // The SDK handles cleanup mostly on object disposal or we can trigger a close if exposed.
        // Assuming session.close() exists on the resolved session object if needed, 
        // but often disconnecting the input stream is enough to stop logic.
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