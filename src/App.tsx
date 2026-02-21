import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Settings, Moon, Check, Bell, User, BookOpen } from 'lucide-react';
import { StarryBackground } from './components/StarryBackground';
import { SetupScreen } from './components/SetupScreen';
import { JournalModal } from './components/JournalModal';

// Types
type AppState = {
  settings: {
    parent1_name: string;
    parent2_name: string;
    bedtime: string;
    wake_time: string;
    current_turn_index: number;
    is_setup_complete: number;
  };
  logs: Array<{
    id: number;
    parent_name: string;
    action: string;
    timestamp: string;
  }>;
  nightMode: boolean;
  tonightFirstParent: string | null;
  currentNightDate: string;
};

function formatCountdown(minutes: number): string {
  if (minutes <= 0) return 'Bedtime soon!';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m to bedtime`;
  if (h > 0) return `${h}h to bedtime`;
  return `${m}m to bedtime`;
}

function computeDaytimeProgress(now: Date, wakeTime: string, bedtime: string): { minutesToBedtime: number; progress: number } {
  const [wtH, wtM] = wakeTime.split(':').map(Number);
  const [btH, btM] = bedtime.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const wtMins = wtH * 60 + wtM;
  const btMins = btH * 60 + btM;
  const totalDay = Math.max(1, btMins - wtMins);
  const elapsed = nowMins - wtMins;
  const minutesToBedtime = Math.max(0, btMins - nowMins);
  const progress = Math.max(0, Math.min(1, elapsed / totalDay));
  return { minutesToBedtime, progress };
}

export default function App() {
  const [familyId, setFamilyId] = useState<string | null>(() => localStorage.getItem('starturn_family_id'));
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('starturn_current_user'));
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const showSettingsRef = useRef(false);
  const [pushSupported, setPushSupported] = useState(false);

  // Daytime countdown state (updates every minute)
  const [countdown, setCountdown] = useState<{ minutesToBedtime: number; progress: number } | null>(null);

  // Keep ref in sync with state so polling always reads the latest value
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  // Form state
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [loginStep, setLoginStep] = useState<'family' | 'setup' | 'user'>('family');

  useEffect(() => {
    if (familyId) {
      fetchState(familyId);
      const interval = setInterval(() => fetchState(familyId), 3000);
      return () => clearInterval(interval);
    }
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
    }
  }, [familyId]);

  // Update countdown every minute during daytime
  useEffect(() => {
    if (!state || state.nightMode) {
      setCountdown(null);
      return;
    }
    const updateCountdown = () => {
      const wt = state.settings.wake_time || '07:00';
      const bt = state.settings.bedtime;
      setCountdown(computeDaytimeProgress(new Date(), wt, bt));
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [state?.nightMode, state?.settings.bedtime, state?.settings.wake_time]);

  const fetchState = async (fid: string): Promise<AppState | null> => {
    try {
      const res = await fetch(`/api/state?familyId=${fid}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: AppState = await res.json();
      setState(data);
      if (!showSettingsRef.current) {
        setP1Name(data.settings.parent1_name);
        setP2Name(data.settings.parent2_name);
        setBedtime(data.settings.bedtime);
        setWakeTime(data.settings.wake_time || '07:00');
      }
      return data;
    } catch (e) {
      console.error("Failed to fetch state:", e);
      return null;
    }
  };

  const handleFamilySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput.trim()) return;
    const id = loginInput.trim().toLowerCase().replace(/\s+/g, '-');
    fetchState(id).then((data) => {
      if (data && data.settings.is_setup_complete === 0) {
        setLoginStep('setup');
      } else {
        setLoginStep('user');
      }
    });
  };

  const handleSetupComplete = async () => {
    const id = loginInput.trim().toLowerCase().replace(/\s+/g, '-');
    await fetchState(id);
    setLoginStep('user');
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

  const handleOverrideTurn = async (actionType: 'skip' | 'takeover') => {
    if (!state || !familyId || !currentUser) return;
    await fetch('/api/override-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId, actingParent: currentUser, actionType })
    });
    fetchState(familyId);
  };

  const saveSettings = async () => {
    if (!familyId) return;
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId, parent1: p1Name, parent2: p2Name, bedtime, wakeTime })
    });

    if (!response.ok) {
      console.error('Failed to save settings');
      return;
    }

    if (currentUser === state?.settings.parent1_name && p1Name !== currentUser) {
      setCurrentUser(p1Name);
      localStorage.setItem('starturn_current_user', p1Name);
    } else if (currentUser === state?.settings.parent2_name && p2Name !== currentUser) {
      setCurrentUser(p2Name);
      localStorage.setItem('starturn_current_user', p2Name);
    }

    const stateRes = await fetch(`/api/state?familyId=${familyId}`);
    if (stateRes.ok) {
      const data = await stateRes.json();
      setState(data);
      setP1Name(data.settings.parent1_name);
      setP2Name(data.settings.parent2_name);
      setBedtime(data.settings.bedtime);
      setWakeTime(data.settings.wake_time || '07:00');
    }

    setShowSettings(false);
  };

  const subscribeToPush = async () => {
    if (!pushSupported || !familyId) return;
    if (Notification.permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permission not granted for notifications.');
        return;
      }
      const register = await navigator.serviceWorker.register('/sw.js');
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

  // ─── Login / Setup screens ───────────────────────────────────────────────
  if (!familyId || !currentUser) {
    const pendingFamilyId = loginInput.trim().toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 relative overflow-hidden">
        <StarryBackground />
        <div className="z-10 w-full max-w-md text-center">

          {loginStep === 'setup' ? (
            <SetupScreen
              familyId={pendingFamilyId}
              defaultParent1={state?.settings.parent1_name === 'Parent 1' ? '' : state?.settings.parent1_name}
              defaultParent2={state?.settings.parent2_name === 'Parent 2' ? '' : state?.settings.parent2_name}
              onComplete={handleSetupComplete}
            />
          ) : loginStep === 'family' ? (
            <>
              <div className="mb-8 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <Moon className="w-10 h-10 text-yellow-200 fill-yellow-200" />
                </div>
              </div>
              <h1 className="text-4xl font-bold mb-2">StarTurn</h1>
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
              <div className="mb-8 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <Moon className="w-10 h-10 text-yellow-200 fill-yellow-200" />
                </div>
              </div>
              <h1 className="text-4xl font-bold mb-2">StarTurn</h1>
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
  const isNight = state.nightMode;

  // Countdown arc geometry
  const arcRadius = 136;
  const arcCX = 144;
  const arcCY = 144;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcProgress = countdown?.progress ?? 0;
  const arcDashoffset = arcCircumference * (1 - arcProgress);

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
      <main className="relative z-0 min-h-screen flex flex-col items-center pt-24 pb-20 px-6">
        <AnimatePresence mode="wait">
          {isNight ? (
            // ─── NIGHT MODE ────────────────────────────────────────────────
            <motion.div
              key={`night-${currentTurnParent}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center flex flex-col items-center w-full max-w-md"
            >
              <div className="mb-6 text-indigo-200 text-lg font-medium uppercase tracking-widest">
                Tonight's Guardian
              </div>

              <div className="relative mb-8">
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

              {/* Primary action + override */}
              <div className="flex flex-col items-center gap-4 w-full">
                {isMyTurn ? (
                  <>
                    <button
                      onClick={handleCompleteTurn}
                      className="group relative px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-lg shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-3"
                    >
                      <Check className="w-5 h-5" />
                      <span>I'm Going In / Done</span>
                    </button>
                    <button
                      onClick={() => handleOverrideTurn('skip')}
                      className="text-sm text-indigo-300/60 hover:text-indigo-200 underline underline-offset-2 transition-colors"
                    >
                      Skip my turn
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-indigo-300/50 text-sm italic">
                      Waiting for {currentTurnParent}...
                    </div>
                    <button
                      onClick={() => handleOverrideTurn('takeover')}
                      className="text-sm text-indigo-300/60 hover:text-indigo-200 underline underline-offset-2 transition-colors"
                    >
                      Let me take over for {currentTurnParent}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            // ─── DAYTIME MODE ──────────────────────────────────────────────
            <motion.div
              key="daytime"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-center flex flex-col items-center w-full max-w-md"
            >
              <div className="mb-6 text-indigo-200 text-lg font-medium uppercase tracking-widest">
                Coming Up Tonight
              </div>

              <div className="relative mb-6">
                {/* Countdown arc (SVG ring around the circle) */}
                <svg
                  width="288"
                  height="288"
                  className="absolute -top-4 -left-4 rotate-[-90deg]"
                  style={{ pointerEvents: 'none' }}
                >
                  {/* Background ring */}
                  <circle
                    cx={arcCX}
                    cy={arcCY}
                    r={arcRadius}
                    fill="none"
                    stroke="rgba(99,102,241,0.12)"
                    strokeWidth="3"
                  />
                  {/* Progress arc */}
                  <circle
                    cx={arcCX}
                    cy={arcCY}
                    r={arcRadius}
                    fill="none"
                    stroke="rgba(165,180,252,0.55)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={arcCircumference}
                    strokeDashoffset={arcDashoffset}
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>

                <div className="relative w-64 h-64 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl">
                  <div className="text-center px-4">
                    <Moon className="w-14 h-14 mx-auto mb-4 text-indigo-300" />
                    <h1 className="text-2xl font-bold text-white leading-tight">
                      {state.tonightFirstParent === currentUser
                        ? <>You're up<br/>first tonight</>
                        : <>{state.tonightFirstParent || state.settings.parent1_name}<br/>goes first tonight</>
                      }
                    </h1>
                  </div>
                </div>
              </div>

              {/* Countdown text */}
              <div className="text-indigo-300/60 text-sm mt-1">
                {countdown ? formatCountdown(countdown.minutesToBedtime) : `Night starts at ${state.settings.bedtime}`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Journal button — bottom left */}
      <button
        onClick={() => setShowJournal(true)}
        className="fixed bottom-6 left-6 z-10 p-3 rounded-full bg-white/10 border border-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm"
        aria-label="Open Night Journal"
      >
        <BookOpen className="w-6 h-6 text-indigo-200" />
      </button>

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
                  <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Bedtime</label>
                  <input
                    type="time"
                    value={bedtime}
                    onChange={(e) => setBedtime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Wake Time</label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
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

      {/* Journal Modal */}
      <AnimatePresence>
        {showJournal && familyId && (
          <JournalModal familyId={familyId} onClose={() => setShowJournal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
