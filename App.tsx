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

const MicIcon = ({ muted }: { muted: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    {muted ? (
      <path d="M12.75 3.033a8.25 8.25 0 00-1.5 0v1.734c.489-.08 1-.122 1.5-.122 2.652 0 5.093 1.144 6.749 2.972l1.06-1.06A9.708 9.708 0 0012.75 3.033zM9.75 3.033a9.708 9.708 0 00-6.809 3.52l1.06 1.06A8.209 8.209 0 0110.75 4.767V3.033zM10.75 19.388V21.12a8.25 8.25 0 01-1.5 0v-1.734c-.489.08-1 .122-1.5.122-2.652 0-5.093-1.144-6.749-2.972l-1.06 1.06a9.708 9.708 0 006.809 3.52zM12.75 19.388v1.734a9.708 9.708 0 006.809-3.52l-1.06-1.06a8.209 8.209 0 01-6.749 2.972.75.75 0 01.75-.75h-.75zM3.75 12a8.25 8.25 0 011.603-4.94L3.89 5.597l10.613 10.613.91.91 1.061 1.06L5.353 2.872 3.89 4.335l14.773 14.774-1.463 1.463-14.773-14.773 1.463-1.463L16.22 17.68A8.232 8.232 0 013.75 12z" />
    ) : (
      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0v4.5a3.75 3.75 0 01-7.5 0v-4.5zM12 17.25a5.25 5.25 0 005.25-5.25v-.75a.75.75 0 00-1.5 0v.75a3.75 3.75 0 01-7.5 0v-.75a.75.75 0 00-1.5 0v.75A5.25 5.25 0 0012 17.25zM9 19.5h6a.75.75 0 000-1.5H9a.75.75 0 000 1.5z" clipRule="evenodd" />
    )}
  </svg>
);

const ShoppingBagIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
);

// --- Helpers ---
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- Mock Data ---
interface Product {
    id: number;
    name: string;
    price: number;
    image: string;
}

const PRODUCTS: Product[] = [
    { id: 1, name: "Cyber Sneakers", price: 150, image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?q=80&w=1000&auto=format&fit=crop" },
    { id: 2, name: "Holo Watch", price: 299, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop" },
    { id: 3, name: "Neon Jacket", price: 120, image: "https://images.unsplash.com/photo-1551488852-080175d50654?q=80&w=1000&auto=format&fit=crop" },
    { id: 4, name: "Neural Visor", price: 450, image: "https://images.unsplash.com/photo-1626244654922-26227b409740?q=80&w=1000&auto=format&fit=crop" },
];

const App: React.FC = () => {
  // App State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [themeColor, setThemeColor] = useState('#050510');

  // Shop State
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  // REFS: Use Refs to access latest state inside callbacks without triggering re-initialization
  const cartRef = useRef<Product[]>([]);
  const geminiServiceRef = useRef<GeminiLiveService | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync refs with state
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // --- Tool Handlers ---
  const handleToolCall = async (name: string, args: any) => {
      console.log(`Executing tool: ${name}`, args);
      
      switch(name) {
          case 'addToCart':
              const product = PRODUCTS.find(p => p.name.toLowerCase().includes(args.productName.toLowerCase()));
              if (product) {
                  setCart(prev => [...prev, product]);
                  setLastAction(`Added ${product.name} to cart`);
                  setIsCartOpen(true);
                  return "Added to cart successfully.";
              } else {
                  return "Product not found.";
              }
          
          case 'openCart':
              setIsCartOpen(true);
              return "Cart opened.";

          case 'checkout':
              // Access latest cart via ref to avoid closure issues
              if (cartRef.current.length === 0) return "Cart is empty.";
              setCheckoutStatus('processing');
              setIsCartOpen(true);
              setTimeout(() => {
                  setCheckoutStatus('success');
                  setCart([]);
              }, 2000); // Simulate processing
              return "Checkout process started.";

          case 'changeBackgroundColor':
              const map: Record<string, string> = {
                  'red': '#450a0a',
                  'blue': '#0c0a45',
                  'green': '#052e16',
                  'purple': '#3b0764'
              };
              if (map[args.color]) setThemeColor(map[args.color]);
              return `Background changed to ${args.color}`;
          
          default:
              return "Function not supported";
      }
  };

  // Initialize service
  useEffect(() => {
    geminiServiceRef.current = new GeminiLiveService(
      (state) => {
        setConnectionState(state);
        if (state === ConnectionState.DISCONNECTED) stopTimer();
        else if (state === ConnectionState.CONNECTED) startTimer();
      },
      (err) => setError(err),
      handleToolCall // This callback closes over the initial render scope, but uses Refs/State Setters which are stable.
    );

    return () => {
      stopTimer();
      if (geminiServiceRef.current) geminiServiceRef.current.disconnect();
    };
  }, []); // IMPORTANT: Empty dependency array ensures service is only created ONCE.

  const startTimer = () => {
    setCallDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
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
    if (geminiServiceRef.current) geminiServiceRef.current.disconnect();
  };

  const toggleMute = () => {
    if (geminiServiceRef.current) {
      const newState = !isMuted;
      setIsMuted(newState);
      geminiServiceRef.current.toggleMute(newState);
    }
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price, 0);

  // --- Render ---

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans text-white transition-colors duration-700" style={{ backgroundColor: themeColor }}>
      
      {/* BACKGROUND MOCK SHOP (The "Website") */}
      <div className="absolute inset-0 z-0 overflow-y-auto pb-32">
          {/* Header */}
          <header className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
              <h1 className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">CYBERSTORE</h1>
              <div className="flex items-center gap-6">
                  <span className="text-sm text-white/60 hover:text-white cursor-pointer">New Arrivals</span>
                  <span className="text-sm text-white/60 hover:text-white cursor-pointer">Collections</span>
                  <button 
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    className="relative p-2 rounded-full hover:bg-white/10 transition"
                  >
                      <ShoppingBagIcon />
                      {cart.length > 0 && (
                          <span className="absolute top-0 right-0 w-4 h-4 bg-purple-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                              {cart.length}
                          </span>
                      )}
                  </button>
              </div>
          </header>

          {/* Product Grid */}
          <main className="p-8 max-w-7xl mx-auto">
              <h2 className="text-xl font-light mb-8 text-white/80">Trending Now</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {PRODUCTS.map(product => (
                      <div key={product.id} className="group relative bg-white/5 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 border border-white/5 hover:border-cyan-500/50">
                          <div className="h-64 overflow-hidden">
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100" />
                          </div>
                          <div className="p-4">
                              <h3 className="text-lg font-medium">{product.name}</h3>
                              <p className="text-cyan-400 font-bold mt-1">${product.price}</p>
                              <button 
                                onClick={() => {
                                    setCart(prev => [...prev, product]);
                                    setLastAction(`Added ${product.name}`);
                                }}
                                className="mt-4 w-full py-2 bg-white/10 hover:bg-cyan-500 hover:text-black rounded-lg text-sm font-medium transition"
                              >
                                  Add to Cart
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </main>
      </div>

      {/* 3D SCENE OVERLAY (The "AI") */}
      {/* We make the scene container pointer-events-none so we can click the shop behind it, 
          unless we want to interact with the 3D object itself. */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-80 mix-blend-screen">
         <Scene 
            connectionState={connectionState}
            inputAnalyser={geminiServiceRef.current?.inputAnalyser || null}
            outputAnalyser={geminiServiceRef.current?.outputAnalyser || null}
         />
      </div>

      {/* UI OVERLAY (Controls & Feedback) */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">
        
        {/* Top Status */}
        <div className="pt-8 flex justify-center pointer-events-auto">
           {connectionState === ConnectionState.CONNECTED && (
               <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-full flex items-center gap-4 shadow-2xl">
                   <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                   <span className="font-mono text-sm">{formatTime(callDuration)}</span>
                   <div className="h-4 w-[1px] bg-white/20" />
                   <span className="text-xs text-cyan-400 uppercase tracking-widest">Voice Control Active</span>
               </div>
           )}
        </div>
        
        {/* Action Toast */}
        {lastAction && (
             <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-cyan-500/20 backdrop-blur-md border border-cyan-500/30 text-cyan-200 px-6 py-3 rounded-lg animate-fade-in-up">
                 {lastAction}
             </div>
        )}

        {/* Bottom Controls */}
        <div className="pb-12 flex justify-center pointer-events-auto">
            {connectionState === ConnectionState.DISCONNECTED ? (
                <button
                    onClick={handleConnect}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-full hover:scale-105 transition-transform shadow-[0_0_40px_rgba(6,182,212,0.4)]"
                >
                    <PhoneIcon />
                    <span className="font-bold tracking-wide">START AI ASSISTANT</span>
                </button>
            ) : (
                <div className="flex gap-4 p-2 bg-black/50 backdrop-blur-xl rounded-full border border-white/10">
                    <button onClick={toggleMute} className={`p-4 rounded-full transition ${isMuted ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}>
                        <MicIcon muted={isMuted} />
                    </button>
                    <button onClick={handleDisconnect} className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg">
                        <svg className="w-6 h-6 transform rotate-135" fill="currentColor" viewBox="0 0 24 24"><path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 4.5V4.5z" /></svg>
                    </button>
                </div>
            )}
        </div>

      </div>

      {/* SHOPPING CART SIDEBAR */}
      <div className={`absolute top-0 right-0 h-full w-96 bg-[#0a0a14] border-l border-white/10 z-30 transform transition-transform duration-300 ease-in-out ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold">Your Cart</h2>
                  <button onClick={() => setIsCartOpen(false)} className="text-white/50 hover:text-white">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                  {cart.length === 0 ? (
                      <p className="text-white/40 text-center mt-10">Cart is empty</p>
                  ) : (
                      cart.map((item, idx) => (
                          <div key={idx} className="flex gap-4 p-3 bg-white/5 rounded-lg">
                              <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
                              <div>
                                  <h4 className="font-medium">{item.name}</h4>
                                  <p className="text-cyan-400">${item.price}</p>
                              </div>
                          </div>
                      ))
                  )}
              </div>

              <div className="mt-8 border-t border-white/10 pt-6">
                  <div className="flex justify-between text-lg font-bold mb-6">
                      <span>Total</span>
                      <span>${cartTotal}</span>
                  </div>
                  
                  {checkoutStatus === 'success' ? (
                      <div className="bg-green-500/20 text-green-400 p-4 rounded-lg text-center border border-green-500/30">
                          Order Placed Successfully!
                      </div>
                  ) : checkoutStatus === 'processing' ? (
                      <button disabled className="w-full py-3 bg-cyan-600/50 rounded-lg animate-pulse">
                          Processing Payment...
                      </button>
                  ) : (
                      <button 
                        onClick={() => handleToolCall('checkout', {})}
                        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition"
                      >
                          CHECKOUT
                      </button>
                  )}
              </div>
          </div>
      </div>

    </div>
  );
};

export default App;