import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Settings, Moon, Sun, Check, Bell, User } from 'lucide-react';
import { StarryBackground } from './components/StarryBackground';
import { cn } from './lib/utils';

// Types
type AppState = {
  settings: {
    parent1_name: string;
    parent2_name: string;
    bedtime: string;
    current_turn_index: number;
  };
  logs: Array<{
    id: number;
    parent_name: string;
    action: string;
    timestamp: string;
  }>;
};

export default function App() {
  const [familyId, setFamilyId] = useState<string | null>(() => localStorage.getItem('starturn_family_id'));
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('starturn_current_user'));
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  // Form state
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [bedtime, setBedtime] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [loginStep, setLoginStep] = useState<'family' | 'user'>('family');

  useEffect(() => {
    if (familyId) {
      fetchState(familyId);
      // Poll for updates every 3 seconds to keep devices in sync
      const interval = setInterval(() => fetchState(familyId), 3000);
      return () => clearInterval(interval);
    }
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
    }
  }, [familyId]);

  const fetchState = async (fid: string) => {
    // Don't set loading on poll to avoid flickering
    try {
      const res = await fetch(`/api/state?familyId=${fid}`);
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      const data = await res.json();
      setState(data);
      // Only update form state if not editing in settings modal
      if (!showSettings) {
        setP1Name(data.settings.parent1_name);
        setP2Name(data.settings.parent2_name);
        setBedtime(data.settings.bedtime);
      }
    } catch (e) {
      console.error("Failed to fetch state:", e);
    }
  };

  const handleFamilySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim()) return;
    const id = loginInput.trim().toLowerCase().replace(/\s+/g, '-');
    // Don't save to local storage yet, wait for user selection
    fetchState(id).then(() => {
      setLoginStep('user');
    });
  };

  const handleUserSelect = (name: string) => {
    const id = loginInput.trim().toLowerCase().replace(/\s+/g, '-');
    localStorage.setItem('starturn_family_id', id);
    localStorage.setItem('starturn_current_user', name);
    setFamilyId(id);
    setCurrentUser(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('starturn_family_id');
    localStorage.removeItem('starturn_current_user');
    setFamilyId(null);
    setCurrentUser(null);
    setState(null);
    setLoginStep('family');
    setLoginInput('');
  };

  const handleCompleteTurn = async () => {
    if (!state || !familyId) return;
    
    const currentParent = state.settings.current_turn_index === 0 
      ? state.settings.parent1_name 
      : state.settings.parent2_name;

    // Confetti!
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FFFFFF']
    });

    await fetch('/api/complete-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId, parentName: currentParent })
    });

    fetchState(familyId);
  };

  const saveSettings = async () => {
    if (!familyId) return;

    // Wait for the settings to be saved to the server before proceeding
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyId,
        parent1: p1Name,
        parent2: p2Name,
        bedtime
      })
    });

    if (!response.ok) {
      console.error('Failed to save settings');
      return;
    }

    // Update current user if their name changed
    if (currentUser === state?.settings.parent1_name && p1Name !== currentUser) {
        setCurrentUser(p1Name);
        localStorage.setItem('starturn_current_user', p1Name);
    } else if (currentUser === state?.settings.parent2_name && p2Name !== currentUser) {
        setCurrentUser(p2Name);
        localStorage.setItem('starturn_current_user', p2Name);
    }

    // Fetch the updated state from the server before closing modal
    // to ensure the main state object has the latest values
    const stateRes = await fetch(`/api/state?familyId=${familyId}`);
    if (stateRes.ok) {
      const data = await stateRes.json();
      setState(data);
    }

    // Close the settings modal after everything is saved and synced
    setShowSettings(false);
  };

  const subscribeToPush = async () => {
    if (!pushSupported || !familyId) return;

    // Check current permission status
    if (Notification.permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings.');
      return;
    }

    try {
      // Request permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permission not granted for notifications.');
        return;
      }

      const register = await navigator.serviceWorker.register('/sw.js');
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      const keyRes = await fetch('/api/vapid-key');
      const { publicKey } = await keyRes.json();

      const subscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, subscription })
      });

      alert('Notifications enabled! You will be notified when a turn is completed.');
    } catch (e: any) {
      console.error('Push subscription error:', e);
      alert(`Failed to enable notifications: ${e.message || 'Unknown error'}`);
    }
  };

  if (!familyId || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 relative overflow-hidden">
        <StarryBackground />
        <div className="z-10 w-full max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
              <Moon className="w-10 h-10 text-yellow-200 fill-yellow-200" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2">StarTurn</h1>
          
          {loginStep === 'family' ? (
            <>
              <p className="text-indigo-200 mb-8">Enter your family name to sync your turns.</p>
              <form onSubmit={handleFamilySubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="e.g. The Smiths"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-center text-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-md transition-all"
                  autoFocus
                />
                <button 
                  type="submit"
                  className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-500/20"
                >
                  Next
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-indigo-200 mb-8">Who are you?</p>
              <div className="space-y-4">
                <button 
                  onClick={() => handleUserSelect(state?.settings.parent1_name || 'Parent 1')}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-center text-xl text-white hover:bg-white/20 transition-all"
                >
                  {state?.settings.parent1_name || 'Parent 1'}
                </button>
                <button 
                  onClick={() => handleUserSelect(state?.settings.parent2_name || 'Parent 2')}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-center text-xl text-white hover:bg-white/20 transition-all"
                >
                  {state?.settings.parent2_name || 'Parent 2'}
                </button>
                <button 
                  onClick={() => setLoginStep('family')}
                  className="text-sm text-indigo-300 hover:text-white mt-4"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <StarryBackground />
        <div className="animate-pulse">Loading StarTurn...</div>
      </div>
    );
  }

  const currentTurnParent = state.settings.current_turn_index === 0 
    ? state.settings.parent1_name 
    : state.settings.parent2_name;
    
  const isMyTurn = currentUser === currentTurnParent;

  return (
    <div className="min-h-screen text-white font-sans overflow-hidden relative selection:bg-indigo-500/30">
      <StarryBackground />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Moon className="w-6 h-6 text-yellow-200 fill-yellow-200" />
          <span className="font-bold text-xl tracking-tight hidden sm:inline">StarTurn</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-indigo-200 mr-2 hidden sm:block">
            Hi, {currentUser}
          </div>
          <button 
            onClick={handleLogout}
            className="text-xs font-medium text-indigo-300 hover:text-white px-3 py-2 rounded-full hover:bg-white/10 transition-colors"
          >
            Switch
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-0 min-h-screen flex flex-col items-center pt-24 pb-6 px-6">
        
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTurnParent}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-center flex flex-col items-center w-full max-w-md flex-grow-0"
          >
            <div className="mb-6 text-indigo-200 text-lg font-medium uppercase tracking-widest">
              Tonight's Guardian
            </div>
            
            <div className="relative mb-8">
              {/* No glow animation requested */}
              
              <div className="relative w-64 h-64 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl overflow-hidden">
                {isMyTurn ? (
                  <div className="text-center px-4 z-10">
                    <User className="w-16 h-16 mx-auto mb-4 text-indigo-300" />
                    <h1 className="text-3xl font-bold text-white mb-2 leading-tight">
                      {currentUser},<br/>it's your turn to rise
                    </h1>
                  </div>
                ) : (
                  <>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 w-full h-full"
                    >
                      <img 
                        src="https://picsum.photos/seed/dreamy/400/400?blur=1" 
                        alt="Resting" 
                        className="w-full h-full object-cover opacity-60"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                    <div className="relative z-10 text-center px-4">
                      <Moon className="w-12 h-12 mx-auto mb-3 text-indigo-200 drop-shadow-lg" />
                      <h1 className="text-2xl font-bold text-white mb-2 leading-tight drop-shadow-md">
                        Rest now, {currentUser}.<br/>It's {currentTurnParent}'s turn.
                      </h1>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="h-20 flex items-center justify-center w-full">
              {isMyTurn ? (
                <button
                  onClick={handleCompleteTurn}
                  className="group relative px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-lg shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-3"
                >
                  <Check className="w-5 h-5" />
                  <span>I'm Going In / Done</span>
                </button>
              ) : (
                <div className="text-indigo-300/50 text-sm italic">
                  Waiting for {currentTurnParent}...
                </div>
              )}
            </div>

          </motion.div>
        </AnimatePresence>

        {/* Recent Logs - Pushed to bottom, no scroll needed for main view usually */}
        <div className="mt-8 w-full max-w-md flex-grow">
          <h3 className="text-sm font-medium text-indigo-200/50 uppercase tracking-wider mb-4 text-center">Recent Activity</h3>
          <div className="space-y-3 opacity-70 hover:opacity-100 transition-opacity">
            {state.logs.slice(0, 3).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                    <Check className="w-3 h-3" />
                  </div>
                  <span className="font-medium text-indigo-100 text-sm">{log.parent_name}</span>
                </div>
                <span className="text-xs text-indigo-300/60">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {state.logs.length === 0 && (
              <div className="text-center text-indigo-300/40 italic text-sm">No activity recorded yet</div>
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-indigo-400" />
                Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Parent 1 Name</label>
                  <input
                    type="text"
                    value={p1Name}
                    onChange={(e) => setP1Name(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Parent 2 Name</label>
                  <input
                    type="text"
                    value={p2Name}
                    onChange={(e) => setP2Name(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Bedtime Reminder</label>
                  <input
                    type="time"
                    value={bedtime}
                    onChange={(e) => setBedtime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                </div>

                {pushSupported && (
                  <button
                    onClick={subscribeToPush}
                    className="w-full py-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <Bell className="w-4 h-4" />
                    Enable Notifications
                  </button>
                )}

                <button
                  onClick={saveSettings}
                  className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-indigo-50 transition-colors mt-4"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
