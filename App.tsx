import React, { useState, useEffect, useRef } from 'react';
import Scene from './components/Scene';
import { GeminiLiveService } from './services/geminiLiveService';
import { ConnectionState } from './types';

// --- Icons ---
const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
    <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 4.5V4.5z" clipRule="evenodd" />
  </svg>
);

const PhoneXMarkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
    <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 01.968-.432l5.942 2.28a.75.75 0 01.431.97l-2.28 5.941a.75.75 0 11-1.4-.537l1.63-4.252-4.253 1.63a.75.75 0 01-.968-.432l-2.28-5.942a.75.75 0 01.432-.969zM4.5 9.75v-2.25a3 3 0 013-3h2.25a.75.75 0 010 1.5H7.5a1.5 1.5 0 00-1.5 1.5v2.25a.75.75 0 01-1.5 0zm0 4.5a.75.75 0 011.5 0v2.25a1.5 1.5 0 001.5 1.5h2.25a.75.75 0 010 1.5H7.5a3 3 0 01-3-3v-2.25zm13.5 0a.75.75 0 011.5 0v2.25a3 3 0 01-3 3h-2.25a.75.75 0 010-1.5h2.25a1.5 1.5 0 001.5-1.5v-2.25z" clipRule="evenodd" />
    <path d="M18.75 6.75l-4.5 4.5m4.5-4.5l-4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
  </svg>
);

const MicIcon = ({ muted }: { muted: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    {muted ? (
      <path d="M12.75 3.033a8.25 8.25 0 00-1.5 0v1.734c.489-.08 1-.122 1.5-.122 2.652 0 5.093 1.144 6.749 2.972l1.06-1.06A9.708 9.708 0 0012.75 3.033zM9.75 3.033a9.708 9.708 0 00-6.809 3.52l1.06 1.06A8.209 8.209 0 0110.75 4.767V3.033zM10.75 19.388V21.12a8.25 8.25 0 01-1.5 0v-1.734c-.489.08-1 .122-1.5.122-2.652 0-5.093-1.144-6.749-2.972l-1.06 1.06a9.708 9.708 0 006.809 3.52zM12.75 19.388v1.734a9.708 9.708 0 006.809-3.52l-1.06-1.06a8.209 8.209 0 01-6.749 2.972.75.75 0 01.75-.75h-.75zM3.75 12a8.25 8.25 0 011.603-4.94L3.89 5.597l10.613 10.613.91.91 1.061 1.06L5.353 2.872 3.89 4.335l14.773 14.774-1.463 1.463-14.773-14.773 1.463-1.463L16.22 17.68A8.232 8.232 0 013.75 12z" />
    ) : (
      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0v4.5a3.75 3.75 0 01-7.5 0v-4.5zM12 17.25a5.25 5.25 0 005.25-5.25v-.75a.75.75 0 00-1.5 0v.75a3.75 3.75 0 01-7.5 0v-.75a.75.75 0 00-1.5 0v.75A5.25 5.25 0 0012 17.25zM9 19.5h6a.75.75 0 000-1.5H9a.75.75 0 000 1.5z" clipRule="evenodd" />
    )}
  </svg>
);

// --- Helpers ---
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const geminiServiceRef = useRef<GeminiLiveService | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize service on mount
  useEffect(() => {
    geminiServiceRef.current = new GeminiLiveService(
      (state) => {
        setConnectionState(state);
        if (state === ConnectionState.DISCONNECTED) {
          stopTimer();
        } else if (state === ConnectionState.CONNECTED) {
          startTimer();
        }
      },
      (err) => setError(err)
    );

    return () => {
      stopTimer();
      if (geminiServiceRef.current) {
        geminiServiceRef.current.disconnect();
      }
    };
  }, []);

  const startTimer = () => {
    setCallDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const handleConnect = async () => {
    if (geminiServiceRef.current) {
      setError(null);
      await geminiServiceRef.current.connect();
    }
  };

  const handleDisconnect = () => {
    if (geminiServiceRef.current) {
      geminiServiceRef.current.disconnect();
    }
  };

  const toggleMute = () => {
    if (geminiServiceRef.current) {
      const newState = !isMuted;
      setIsMuted(newState);
      geminiServiceRef.current.toggleMute(newState);
    }
  };

  // --- Render ---

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white selection:bg-cyan-500/30">
      
      {/* 3D Background Layer */}
      <Scene 
        connectionState={connectionState}
        inputAnalyser={geminiServiceRef.current?.inputAnalyser || null}
        outputAnalyser={geminiServiceRef.current?.outputAnalyser || null}
      />

      {/* Main UI Overlay (Glassmorphism) */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-between py-12 px-6 pointer-events-none">
        
        {/* Top Section: Status & Timer */}
        <div className="flex flex-col items-center gap-2 animate-fade-in pointer-events-auto">
          {connectionState === ConnectionState.DISCONNECTED ? (
             <h1 className="text-3xl font-light tracking-tight text-white/80">Gemini Live</h1>
          ) : (
            <>
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${
                   connectionState === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                 }`} />
                 <span className="text-sm font-medium tracking-widest uppercase text-white/60">
                   {connectionState === ConnectionState.CONNECTING ? 'Dialing...' : 'Gemini AI'}
                 </span>
              </div>
              <div className="text-4xl font-light tracking-wider font-mono text-white">
                {connectionState === ConnectionState.CONNECTED ? formatTime(callDuration) : '00:00'}
              </div>
            </>
          )}
        </div>

        {/* Middle Section: Error Messages */}
        <div className="w-full flex justify-center pointer-events-auto">
          {error && (
            <div className="bg-red-500/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border border-red-400/30">
              <p className="text-sm font-medium">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="mt-2 text-xs opacity-80 hover:opacity-100 underline"
              >
                DISMISS
              </button>
            </div>
          )}
        </div>

        {/* Bottom Section: Controls */}
        <div className="w-full max-w-md pointer-events-auto">
          
          {connectionState === ConnectionState.DISCONNECTED ? (
             /* START CALL BUTTON */
             <div className="flex justify-center pb-8">
               <button
                 onClick={handleConnect}
                 className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-green-500 hover:bg-green-400 transition-all duration-300 shadow-[0_0_40px_rgba(34,197,94,0.3)] hover:shadow-[0_0_60px_rgba(34,197,94,0.5)] transform hover:scale-105"
               >
                 <div className="absolute inset-0 rounded-full border border-white/40 animate-ping opacity-30"></div>
                 <PhoneIcon />
               </button>
             </div>
          ) : (
            /* ACTIVE CALL CONTROLS */
            <div className="grid grid-cols-3 gap-6 items-center bg-slate-900/60 backdrop-blur-2xl border border-white/5 p-6 rounded-[3rem] shadow-2xl">
               
               {/* Mute Button */}
               <div className="flex justify-center">
                 <button 
                   onClick={toggleMute}
                   className={`flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-200 ${
                     isMuted ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'
                   }`}
                 >
                   <MicIcon muted={isMuted} />
                 </button>
               </div>

               {/* End Call Button */}
               <div className="flex justify-center">
                 <button 
                   onClick={handleDisconnect}
                   className="flex items-center justify-center w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all transform hover:scale-105"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                     <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 4.5V4.5z" clipRule="evenodd" transform="rotate(135 12 12)" />
                   </svg>
                 </button>
               </div>

               {/* Placeholder for future feature (e.g., Speaker or Camera) */}
               <div className="flex justify-center">
                 <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center opacity-40">
                   <span className="text-xs">More</span>
                 </div>
               </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default App;