import React, { useState, useEffect, useRef } from 'react';
import Scene from './components/Scene';
import { GeminiLiveService } from './services/geminiLiveService';
import { ConnectionState } from './types';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
  </svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);

const PhoneXMarkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m-10.5 6L3 18m0 0l2.25 2.25M3 18l2.25-2.25M3 18l-2.25 2.25m12.338-7.912c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143z" />
  </svg>
);

const App: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  
  // Service Ref to persist instance across renders
  const geminiServiceRef = useRef<GeminiLiveService | null>(null);

  // Initialize service on mount
  useEffect(() => {
    geminiServiceRef.current = new GeminiLiveService(
      (state) => setConnectionState(state),
      (err) => setError(err)
    );

    return () => {
      // Cleanup on unmount
      if (geminiServiceRef.current) {
        geminiServiceRef.current.disconnect();
      }
    };
  }, []);

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

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden font-sans text-white">
      {/* Three.js Background Layer */}
      <Scene 
        connectionState={connectionState}
        inputAnalyser={geminiServiceRef.current?.inputAnalyser || null}
        outputAnalyser={geminiServiceRef.current?.outputAnalyser || null}
      />

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-between p-8 pointer-events-none">
        
        {/* Header */}
        <div className="w-full flex justify-between items-center animate-fade-in-down pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              connectionState === ConnectionState.CONNECTED ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 
              connectionState === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium tracking-widest text-slate-300 uppercase">
              {connectionState}
            </span>
          </div>
          <div className="text-right">
             <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
               GEMINI LIVE
             </h1>
          </div>
        </div>

        {/* Center Messages / Errors */}
        <div className="flex-1 flex items-center justify-center">
            {error && (
               <div className="bg-red-500/20 backdrop-blur-md border border-red-500/50 p-4 rounded-lg text-red-100 max-w-md text-center pointer-events-auto">
                 <p>{error}</p>
                 <button 
                   onClick={() => setError(null)}
                   className="mt-2 text-xs uppercase tracking-wide hover:text-white"
                 >
                   Dismiss
                 </button>
               </div>
            )}
            
            {connectionState === ConnectionState.DISCONNECTED && !error && (
              <div className="text-center opacity-60">
                <p className="text-sm tracking-[0.2em] text-cyan-200/50">INITIALIZE CONNECTION</p>
              </div>
            )}
        </div>

        {/* Bottom Controls */}
        <div className="w-full flex justify-center pb-8 pointer-events-auto">
          <div className="flex items-center gap-6 bg-slate-900/40 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full shadow-2xl">
            
            {/* Status Indicator / Mic Icon */}
            <div className={`p-4 rounded-full transition-all duration-500 ${
              connectionState === ConnectionState.CONNECTED ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/50 text-slate-500'
            }`}>
              <MicIcon />
            </div>

            {/* Main Action Button */}
            {connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING ? (
              <button
                onClick={handleDisconnect}
                className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)]"
              >
                <PhoneXMarkIcon />
              </button>
            ) : (
              <button
                onClick={handleConnect}
                className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500 hover:bg-cyan-400 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
              >
                <div className="absolute inset-0 rounded-full border border-white/30 animate-ping opacity-20"></div>
                <PhoneIcon />
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default App;