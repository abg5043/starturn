import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Settings, Moon, Check, Bell, Star, BookOpen, Mail, ArrowRightLeft, HelpCircle, Smartphone, CheckCircle, AlertTriangle, X, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { StarryBackground } from './components/StarryBackground';
import { SetupScreen } from './components/SetupScreen';
import { JournalModal } from './components/JournalModal';
import { HelpModal } from './components/HelpModal';

// ─── Rotation mode constants ───────────────────────────────────────────────
const ROTATION_ALTERNATE_NIGHTLY = 'alternate_nightly';
const ROTATION_CONTINUE_FROM_LAST = 'continue_from_last';

// Types
type AppState = {
  settings: {
    parent1_name: string;
    parent2_name: string;
    bedtime: string;
    wake_time: string;
    current_turn_index: number;
    rotation_mode: string;
    is_setup_complete: number;
    reminder_time: string | null;
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

type AuthStatus = 'loading' | 'unauthenticated' | 'check_email' | 'authenticated';
type LoginStep = 'email' | 'setup' | 'check_email';
type Toast = { message: string; type: 'success' | 'error' | 'info' } | null;

function formatCountdownParts(minutes: number): { time: string; label: string } {
  if (minutes <= 0) return { time: 'Now', label: 'Bedtime!' };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return { time: `${h}h ${m}m`, label: 'to bedtime' };
  if (h > 0) return { time: `${h}h`, label: 'to bedtime' };
  return { time: `${m}m`, label: 'to bedtime' };
}

function computeDaytimeProgress(now: Date, wakeTime: string, bedtime: string): { minutesToBedtime: number; progress: number } {
  const [wtH, wtM] = wakeTime.split(':').map(Number);
  const [btH, btM] = bedtime.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const wtMins = wtH * 60 + wtM;
  const btMins = btH * 60 + btM;

  const totalDay = btMins >= wtMins
    ? btMins - wtMins
    : (1440 - wtMins) + btMins;

  const elapsed = nowMins >= wtMins
    ? nowMins - wtMins
    : (1440 - wtMins) + nowMins;

  const minutesToBedtime = btMins >= nowMins
    ? btMins - nowMins
    : (1440 - nowMins) + btMins;

  const progress = totalDay > 0 ? Math.max(0, Math.min(1, elapsed / totalDay)) : 0;
  return { minutesToBedtime: Math.max(0, minutesToBedtime), progress };
}

function computeIsNight(now: Date, bedtime: string, wakeTime: string): boolean {
  const [btH, btM] = bedtime.split(':').map(Number);
  const [wtH, wtM] = wakeTime.split(':').map(Number);
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const btMins = btH * 60 + btM;
  const wtMins = wtH * 60 + wtM;
  return totalMins >= btMins || totalMins < wtMins;
}

export default function App() {
  // ─── Auth state ───────────────────────────────────────────────────────────
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [parentIndex, setParentIndex] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerHasJoined, setPartnerHasJoined] = useState(true);

  // ─── App state ────────────────────────────────────────────────────────────
  const [state, setState] = useState<AppState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const showSettingsRef = useRef(false);
  const [pushSupported, setPushSupported] = useState(false);

  // ─── UI state: toasts, prompts, two-tap button ─────────────────────────────
  const [toast, setToast] = useState<Toast>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [resendingInvite, setResendingInvite] = useState(false);
  // Shared loading guard for all night-mode action buttons (Done, Skip, Takeover).
  // A single flag prevents conflicting concurrent requests from any combination of taps.
  const [isActionLoading, setIsActionLoading] = useState(false);
  // Tracks an override action (skip/takeover) that has been tapped once and is
  // awaiting a second deliberate confirmation tap before firing the API call.
  const [pendingAction, setPendingAction] = useState<'skip' | 'takeover' | null>(null);
  // Email login flow: loading and inline error state
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // ─── Login flow state ─────────────────────────────────────────────────────
  const [loginInput, setLoginInput] = useState('');
  const [loginStep, setLoginStep] = useState<LoginStep>('email');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendingLink, setResendingLink] = useState(false);

  // Daytime countdown
  const [countdown, setCountdown] = useState<{ minutesToBedtime: number; progress: number } | null>(null);

  // Form state for settings modal
  const [p1Name, setP1Name] = useState('');
  const [p2Name, setP2Name] = useState('');
  const [bedtime, setBedtime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [rotationMode, setRotationMode] = useState(ROTATION_ALTERNATE_NIGHTLY);
  // Optional evening reminder time (HH:mm); empty string means "disabled".
  const [reminderTime, setReminderTime] = useState('');

  // Keep ref in sync
  useEffect(() => {
    showSettingsRef.current = showSettings;
  }, [showSettings]);

  // ─── Toast helper: auto-dismiss after 3 seconds ────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Check auth on load ───────────────────────────────────────────────────
  useEffect(() => {
    checkAuth();
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setFamilyId(data.familyId);
        setParentIndex(data.parentIndex);
        setCurrentUser(data.parentName);
        setPartnerName(data.partnerName);
        setPartnerHasJoined(data.partnerHasJoined ?? true);
        localStorage.setItem('starturn_parent_name', data.parentName);
        setAuthStatus('authenticated');

        // Show welcome card for invited partners on their first visit
        if (data.parentIndex === 1 && !localStorage.getItem('starturn_welcomed')) {
          setShowWelcome(true);
          localStorage.setItem('starturn_welcomed', '1');
          setTimeout(() => setShowWelcome(false), 5000);
        }

        // One-time notification prompt (after first login completes)
        if (!localStorage.getItem('starturn_notif_prompted')) {
          setTimeout(() => setShowNotifPrompt(true), 2000);
        }
      } else {
        setAuthStatus('unauthenticated');
      }
    } catch {
      setAuthStatus('unauthenticated');
    }
  };

  // ─── Poll state when authenticated ────────────────────────────────────────
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [authStatus]);

  // ─── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!state) {
      setCountdown(null);
      return;
    }
    const bt = state.settings.bedtime;
    const wt = state.settings.wake_time || '07:00';
    if (computeIsNight(new Date(), bt, wt)) {
      setCountdown(null);
      return;
    }
    const updateCountdown = () => {
      setCountdown(computeDaytimeProgress(new Date(), wt, bt));
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [state?.settings.bedtime, state?.settings.wake_time]);

  // ─── API helpers (no familyId in params — server derives from cookie) ─────

  const fetchState = async (): Promise<AppState | null> => {
    try {
      const res = await fetch('/api/state');
      if (res.status === 401) {
        // fetchState only runs while authenticated, so a 401 here means the
        // session expired mid-use — show a clear explanation rather than a
        // silent redirect to the login screen.
        showToast('Your session has expired — please sign in again.', 'info');
        setAuthStatus('unauthenticated');
        return null;
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: AppState = await res.json();
      setState(data);
      if (!showSettingsRef.current) {
        setP1Name(data.settings.parent1_name);
        setP2Name(data.settings.parent2_name);
        setBedtime(data.settings.bedtime);
        setWakeTime(data.settings.wake_time || '07:00');
        setRotationMode(data.settings.rotation_mode || ROTATION_ALTERNATE_NIGHTLY);
        setReminderTime(data.settings.reminder_time || '');
      }
      return data;
    } catch (e) {
      console.error("Failed to fetch state:", e);
      return null;
    }
  };

  const handleDone = async () => {
    // Guard against double-taps: if any night-mode action is already in-flight, bail out.
    if (isActionLoading) return;

    // We must confirm the API call succeeded before celebrating — a silent
    // failure here means the turn is never recorded and the schedule drifts.
    setIsActionLoading(true);
    try {
      const completeTurnResponse = await fetch('/api/complete-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!completeTurnResponse.ok) {
        throw new Error(`Server responded with ${completeTurnResponse.status}`);
      }

      // Only celebrate and refresh state after a confirmed successful save
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FFFFFF']
      });

      fetchState();
    } catch (err) {
      console.error('Failed to complete turn:', err);
      showToast('Something went wrong. Your turn may not have been saved — please try again.', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOverrideTurn = async (actionType: 'skip' | 'takeover') => {
    if (!state) return;
    // Guard against double-taps or conflicting actions while a request is in-flight
    if (isActionLoading) return;

    setIsActionLoading(true);
    try {
      const overrideResponse = await fetch('/api/override-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType })
      });

      if (!overrideResponse.ok) {
        throw new Error(`Server responded with ${overrideResponse.status}`);
      }

      fetchState();
    } catch (err) {
      console.error('Failed to override turn:', err);
      const actionLabel = actionType === 'skip' ? 'skip' : 'takeover';
      showToast(`Failed to ${actionLabel} — please try again.`, 'error');
    } finally {
      setIsActionLoading(false);
      // Always dismiss the confirmation UI whether the request succeeded or failed
      setPendingAction(null);
    }
  };

  // First tap on skip/takeover: stage the action for confirmation instead of firing immediately.
  const requestOverrideTurn = (actionType: 'skip' | 'takeover') => {
    if (isActionLoading) return;
    setPendingAction(actionType);
  };

  const saveSettings = async () => {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent1: p1Name, parent2: p2Name, bedtime, wakeTime, rotationMode, reminderTime, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    });

    if (!response.ok) {
      showToast('Failed to save settings', 'error');
      return;
    }

    // Re-check auth to get updated names
    await checkAuth();
    await fetchState();
    setShowSettings(false);
    showToast('Settings saved');
  };

  const subscribeToPush = async () => {
    if (!pushSupported) return;
    if (Notification.permission === 'denied') {
      showToast('Notifications are blocked in your browser settings', 'error');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Notification permission was not granted', 'info');
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
        body: JSON.stringify({ subscription })
      });
      showToast("Notifications enabled! You'll know when it's your turn.");
    } catch (e: any) {
      console.error('Push subscription error:', e);
      showToast('Could not enable notifications. Try again later.', 'error');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('starturn_parent_name');
    setFamilyId(null);
    setCurrentUser(null);
    setPartnerName(null);
    setParentIndex(null);
    setState(null);
    setAuthStatus('unauthenticated');
    setLoginStep('email');
    setLoginInput('');
  };

  // ─── Pre-fill login email from localStorage ─────────────────────────────
  // If the user has signed in before, their email is stored so the login
  // screen is pre-filled after a session expiry — they only need to tap Continue.
  useEffect(() => {
    const savedEmail = localStorage.getItem('starturn_last_email');
    if (savedEmail) setLoginInput(savedEmail);
  }, []);

  // ─── Login flow handlers ──────────────────────────────────────────────────

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = loginInput.trim().toLowerCase();
    if (!email) return;
    setPendingEmail(email);

    // Persist the email so the login screen can be pre-filled if the session
    // expires and the user is returned here later.
    localStorage.setItem('starturn_last_email', email);

    // Clear any previous error and lock the button for the duration of the request
    setEmailError(null);
    setIsEmailLoading(true);
    try {
      const res = await fetch('/api/auth/email-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();

      if (data.status === 'known') {
        setLoginStep('check_email');
        setAuthStatus('check_email');
      } else {
        setLoginStep('setup');
      }
    } catch (e) {
      console.error('Error looking up email:', e);
      setEmailError("Couldn't send the link. Check your connection and try again.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setLoginStep('check_email');
    setAuthStatus('check_email');
  };

  const handleResendLink = async () => {
    setResendingLink(true);
    try {
      await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail })
      });
    } catch (e) {
      console.error('Error resending link:', e);
    }
    setResendingLink(false);
  };

  const handleResendInvite = async () => {
    setResendingInvite(true);
    try {
      await fetch('/api/resend-invite', { method: 'POST' });
      showToast('Invite sent to ' + partnerName);
    } catch {
      showToast('Failed to resend invite', 'error');
    }
    setResendingInvite(false);
  };

  const handleNotifEnable = async () => {
    localStorage.setItem('starturn_notif_prompted', '1');
    setShowNotifPrompt(false);
    await subscribeToPush();
  };

  const handleNotifDismiss = () => {
    localStorage.setItem('starturn_notif_prompted', '1');
    setShowNotifPrompt(false);
  };

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <StarryBackground />
        <div className="animate-pulse">Loading StarTurn...</div>
      </div>
    );
  }

  // ─── Login / Setup screens ────────────────────────────────────────────────
  if (authStatus === 'unauthenticated' || authStatus === 'check_email') {
    const savedName = localStorage.getItem('starturn_parent_name');

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 relative overflow-hidden">
        <StarryBackground />
        <div className="z-10 w-full max-w-md text-center">

          {loginStep === 'check_email' ? (
            // ─── Check Email Screen ─────────────────────────────────────
            <>
              <div className="mb-8 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <Mail className="w-10 h-10 text-indigo-300" />
                </div>
              </div>
              <h1 className="text-3xl font-bold mb-2">Check Your Email</h1>
              <p className="text-indigo-200 mb-8">
                We sent a sign-in link to <strong>{pendingEmail}</strong>. Click the link in your email to continue.
              </p>
              <div className="space-y-4">
                <button
                  onClick={handleResendLink}
                  disabled={resendingLink}
                  className="w-full py-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors text-sm font-medium disabled:opacity-40"
                >
                  {resendingLink ? 'Sending...' : 'Resend Link'}
                </button>
                <button
                  onClick={() => { setLoginStep('email'); setAuthStatus('unauthenticated'); }}
                  className="text-sm text-indigo-300 hover:text-white mt-4"
                >
                  Back
                </button>
              </div>
            </>

          ) : loginStep === 'setup' ? (
            // ─── Setup Screen ───────────────────────────────────────────
            <SetupScreen
              email={pendingEmail}
              onComplete={handleSetupComplete}
            />

          ) : (
            // ─── Email Entry Screen ──────────────────────────────────────
            <>
              <div className="mb-8 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <Moon className="w-10 h-10 text-yellow-200 fill-yellow-200" />
                </div>
              </div>
              <h1 className="text-4xl font-bold mb-2">StarTurn</h1>

              {savedName ? (
                // Returning user — skip the explainer, they already know the app
                <p className="text-indigo-200 mb-8">Welcome back, {savedName}! Enter your email to sign in.</p>
              ) : (
                // First-time visitor — explain what this app is and why it exists
                <>
                  <p className="text-indigo-200 mb-6">
                    Take turns on night duty&mdash;<br />so both parents can rest.
                  </p>
                  <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-4 mb-8 text-left space-y-3">
                    <div className="flex items-center gap-3">
                      <Star className="w-4 h-4 text-yellow-200 fill-yellow-200 shrink-0" />
                      <span className="text-sm text-indigo-100">One parent is on duty</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
                      <span className="text-sm text-indigo-100">The other rests easy</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <ArrowRightLeft className="w-4 h-4 text-indigo-300 shrink-0" />
                      <span className="text-sm text-indigo-100">Swap with one tap</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-indigo-300 shrink-0" />
                      <span className="text-sm text-indigo-100">Syncs across both phones</span>
                    </div>
                  </div>
                </>
              )}

              {/* Sign-in divider (only shown for new visitors, keeps layout clean) */}
              {!savedName && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-indigo-300/60 uppercase tracking-wider">Sign in</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )}

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={loginInput}
                  onChange={(e) => { setLoginInput(e.target.value); setEmailError(null); }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-6 py-4 text-center text-xl text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-md transition-all"
                  autoFocus
                />
                {emailError && (
                  <p className="flex items-center gap-2 text-red-300 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {emailError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isEmailLoading || !loginInput.trim()}
                  className={`w-full bg-white text-slate-900 font-bold py-4 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 ${
                    isEmailLoading || !loginInput.trim() ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-50'
                  }`}
                >
                  {isEmailLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                  ) : 'Continue'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Loading state (authenticated but no data yet) ────────────────────────
  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <StarryBackground />
        <div className="animate-pulse">Loading StarTurn...</div>
      </div>
    );
  }

  // ─── Main Dashboard ───────────────────────────────────────────────────────

  const currentTurnParent = state.settings.current_turn_index === 0
    ? state.settings.parent1_name
    : state.settings.parent2_name;
  const isMyTurn = currentUser === currentTurnParent;
  const isNight = computeIsNight(new Date(), state.settings.bedtime, state.settings.wake_time || '07:00');

  // Countdown arc geometry
  const arcRadius = 136;
  const arcCX = 144;
  const arcCY = 144;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcProgress = countdown?.progress ?? 0;
  const arcDashoffset = arcCircumference * (1 - arcProgress);

  // Sparkle positions
  const sparkles = [
    { top: '8%', left: '25%', size: 4, delay: 0 },
    { top: '15%', left: '72%', size: 3, delay: 0.5 },
    { top: '45%', left: '5%', size: 3.5, delay: 1.0 },
    { top: '50%', left: '92%', size: 4, delay: 1.5 },
    { top: '80%', left: '18%', size: 3, delay: 0.8 },
  ];

  const countdownParts = countdown ? formatCountdownParts(countdown.minutesToBedtime) : null;
  const tonightParent = state.tonightFirstParent || state.settings.parent1_name;

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
          <div className="text-sm text-indigo-200 mr-2 truncate max-w-[140px]">
            {currentUser} & {partnerName}
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm"
            aria-label="Help"
          >
            <HelpCircle className="w-6 h-6 text-indigo-300" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors backdrop-blur-sm"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* "Partner hasn't joined yet" banner */}
      <AnimatePresence>
        {!partnerHasJoined && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 z-10 flex justify-center"
          >
            <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl px-5 py-3 backdrop-blur-sm flex items-center gap-3 max-w-md w-full">
              <Mail className="w-5 h-5 text-amber-300 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="text-amber-100">{partnerName} hasn't joined yet.</span>
              </div>
              <button
                onClick={handleResendInvite}
                disabled={resendingInvite}
                className="text-xs font-medium text-amber-200 hover:text-white px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {resendingInvite ? 'Sending...' : 'Resend Invite'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome card for invited partners */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={() => setShowWelcome(false)}
            className="fixed top-20 left-4 right-4 z-10 flex justify-center cursor-pointer"
          >
            <div className="bg-indigo-500/15 border border-indigo-400/20 rounded-xl px-5 py-4 backdrop-blur-sm max-w-md w-full text-center">
              <p className="text-sm text-indigo-100">
                Welcome, {currentUser}! {partnerName} set you up on StarTurn. You're all set to share night duty.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                {/* Sparkle dots around circle */}
                {sparkles.map((s, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full bg-yellow-200"
                    style={{
                      top: s.top,
                      left: s.left,
                      width: s.size,
                      height: s.size,
                    }}
                    animate={{
                      opacity: [0.2, 0.7, 0.2],
                      scale: [0.8, 1.3, 0.8],
                    }}
                    transition={{ duration: 2.5 + s.delay, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}

                {isMyTurn ? (
                  // ─── YOUR TURN: "Star Guardian" ─────────────────────────────
                  <>
                    <svg
                      width="288"
                      height="288"
                      className="absolute -top-4 -left-4"
                      style={{ pointerEvents: 'none' }}
                    >
                      <circle
                        cx={arcCX}
                        cy={arcCY}
                        r={arcRadius}
                        fill="none"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="4"
                      />
                    </svg>
                    <div
                      className="relative w-64 h-64 rounded-full border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl overflow-hidden"
                      style={{
                        background: 'radial-gradient(circle at 40% 40%, rgba(79,70,229,0.3), rgba(126,34,206,0.25))',
                      }}
                    >
                      <div className="text-center px-4 z-10">
                        <Star className="w-14 h-14 mx-auto mb-3 text-yellow-200 fill-yellow-200 drop-shadow-lg" />
                        <h1 className="text-2xl font-bold text-white leading-tight">
                          Time to shine,<br/>{currentUser}!
                        </h1>
                      </div>
                    </div>
                  </>
                ) : (
                  // ─── RESTING: "Cozy Rest" ───────────────────────────────────
                  <>
                    <svg
                      width="288"
                      height="288"
                      className="absolute -top-4 -left-4"
                      style={{ pointerEvents: 'none' }}
                    >
                      <circle
                        cx={arcCX}
                        cy={arcCY}
                        r={arcRadius}
                        fill="none"
                        stroke="rgba(99,102,241,0.08)"
                        strokeWidth="3"
                      />
                    </svg>
                    <div
                      className="relative w-64 h-64 rounded-full border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl overflow-hidden"
                      style={{
                        background: 'radial-gradient(circle at 50% 50%, rgba(30,41,59,0.6), rgba(49,46,129,0.4))',
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="absolute text-indigo-300/40 font-bold select-none"
                          style={{
                            left: `${55 + i * 7}%`,
                            top: `${32 - i * 8}%`,
                            fontSize: `${12 + i * 4}px`,
                          }}
                          animate={{ y: [0, -15], opacity: [0.5, 0] }}
                          transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
                        >
                          z
                        </motion.span>
                      ))}
                      <div className="relative z-10 text-center px-4">
                        <Moon className="w-12 h-12 mx-auto mb-3 text-yellow-200 fill-yellow-200 drop-shadow-lg" />
                        <h1 className="text-2xl font-bold text-white leading-tight">
                          Sweet dreams,<br/>{currentUser}
                        </h1>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Primary action + override */}
              <div className="flex flex-col items-center gap-4 w-full">
                {isMyTurn ? (
                  <>
                    <button
                        onClick={handleDone}
                        disabled={isActionLoading}
                        className={`group relative px-8 py-4 bg-indigo-500 text-white rounded-full font-bold text-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center gap-3 ${isActionLoading ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Check className="w-5 h-5" />
                        )}
                        <span>{isActionLoading ? 'Saving...' : 'Done \u2014 Going Back to Bed'}</span>
                      </button>
                    {pendingAction === 'skip' ? (
                      <div className="w-full rounded-xl bg-white/10 border border-white/10 p-4 text-center space-y-3">
                        <p className="text-sm text-indigo-100">
                          Pass this wakeup to {partnerName}?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOverrideTurn('skip')}
                            disabled={isActionLoading}
                            className={`flex-1 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold transition-colors ${isActionLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-400'}`}
                          >
                            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Yes, skip my turn'}
                          </button>
                          <button
                            onClick={() => setPendingAction(null)}
                            disabled={isActionLoading}
                            className="flex-1 py-2 rounded-lg bg-white/10 text-indigo-200 text-sm font-semibold hover:bg-white/20 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => requestOverrideTurn('skip')}
                        disabled={isActionLoading}
                        className={`text-sm text-indigo-300/60 underline underline-offset-2 transition-colors ${isActionLoading ? 'opacity-40 cursor-not-allowed' : 'hover:text-indigo-200'}`}
                      >
                        Skip my turn
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-indigo-200/60 text-sm font-medium">
                      {currentTurnParent} is on duty
                    </div>
                    {pendingAction === 'takeover' ? (
                      <div className="w-full rounded-xl bg-white/10 border border-white/10 p-4 text-center space-y-3">
                        <p className="text-sm text-indigo-100">
                          Take over from {currentTurnParent}?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOverrideTurn('takeover')}
                            disabled={isActionLoading}
                            className={`flex-1 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold transition-colors ${isActionLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-indigo-400'}`}
                          >
                            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Yes, I've got it"}
                          </button>
                          <button
                            onClick={() => setPendingAction(null)}
                            disabled={isActionLoading}
                            className="flex-1 py-2 rounded-lg bg-white/10 text-indigo-200 text-sm font-semibold hover:bg-white/20 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => requestOverrideTurn('takeover')}
                        disabled={isActionLoading}
                        className={`text-sm text-indigo-300/60 underline underline-offset-2 transition-colors ${isActionLoading ? 'opacity-40 cursor-not-allowed' : 'hover:text-indigo-200'}`}
                      >
                        Let me take over for {currentTurnParent}
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            // ─── DAYTIME MODE — "Sunset Dial" ──────────────────────────────
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
                {sparkles.map((s, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full bg-yellow-200"
                    style={{
                      top: s.top,
                      left: s.left,
                      width: s.size,
                      height: s.size,
                    }}
                    animate={{
                      opacity: [arcProgress * 0.2, arcProgress * 0.7, arcProgress * 0.2],
                      scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{ duration: 2.5 + s.delay, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}

                {/* Progress ring (SVG) */}
                <svg
                  width="288"
                  height="288"
                  className="absolute -top-4 -left-4 rotate-[-90deg]"
                  style={{ pointerEvents: 'none' }}
                >
                  <defs>
                    <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(129,140,248,0.7)" />
                      <stop offset="100%" stopColor="rgba(251,191,36,0.7)" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx={arcCX}
                    cy={arcCY}
                    r={arcRadius}
                    fill="none"
                    stroke="rgba(99,102,241,0.15)"
                    strokeWidth="5"
                  />
                  <circle
                    cx={arcCX}
                    cy={arcCY}
                    r={arcRadius}
                    fill="none"
                    stroke="url(#ring-grad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={arcCircumference}
                    strokeDashoffset={arcDashoffset}
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>

                <div
                  className="relative w-64 h-64 rounded-full border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl overflow-hidden"
                  style={{
                    background: arcProgress < 0.5
                      ? `radial-gradient(circle at 40% 40%, rgba(56,189,248,${0.15 + arcProgress * 0.1}), rgba(99,102,241,${0.2 + arcProgress * 0.1}))`
                      : `radial-gradient(circle at 40% 40%, rgba(251,191,36,${(arcProgress - 0.5) * 0.3}), rgba(234,88,12,${(arcProgress - 0.5) * 0.2}), rgba(99,102,241,0.2))`,
                  }}
                >
                  <div className="text-center px-4">
                    {countdownParts ? (
                      <>
                        <h1 className="text-6xl font-extrabold text-white leading-none mb-1 tracking-tight">
                          {countdownParts.time}
                        </h1>
                        <p className="text-lg text-indigo-200">{countdownParts.label}</p>
                      </>
                    ) : (
                      <>
                        <Moon className="w-12 h-12 mx-auto mb-3 text-indigo-300" />
                        <p className="text-lg text-indigo-200">Night starts at {state.settings.bedtime}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* "Who goes first" frosted pill */}
              <div className="mt-2 px-6 py-3 bg-white/10 border border-white/10 rounded-full backdrop-blur-sm flex items-center gap-2">
                <Moon className="w-4 h-4 text-yellow-200 fill-yellow-200" />
                <span className="text-indigo-100 font-medium">
                  {tonightParent === currentUser
                    ? "You're up first tonight"
                    : `${tonightParent} is up first tonight`
                  }
                </span>
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
              className="bg-slate-900 border border-white/10 rounded-3xl px-8 pt-8 w-full max-w-sm shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Settings className="w-6 h-6 text-indigo-400" />
                  Settings
                </h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-indigo-300"
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto overflow-x-hidden flex-1 pb-8">
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
                    className="w-full min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Wake Time</label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                </div>

                {/* ─── Evening Reminder ──────────────────────────────────────────────────
                    A push notification fires at this time to let both parents know who goes
                    first tonight — intended to be set earlier than bedtime (e.g. 8 PM) so
                    there's time to plan the night.
                    Leave blank to disable. ───────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">
                    Evening Reminder
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                  <p className="text-xs text-indigo-300/60 mt-1.5">
                    Sends a push reminder at this time letting both parents know whose turn
                    it is tonight. Leave blank to disable.
                  </p>
                </div>

                {/* ─── Night Rotation Mode ─────────────────────────────── */}
                <div>
                  <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    Night Rotation
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setRotationMode(ROTATION_ALTERNATE_NIGHTLY)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                        rotationMode === ROTATION_ALTERNATE_NIGHTLY
                          ? 'border-indigo-500 bg-indigo-500/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          rotationMode === ROTATION_ALTERNATE_NIGHTLY ? 'border-indigo-400' : 'border-white/30'
                        }`}>
                          {rotationMode === ROTATION_ALTERNATE_NIGHTLY && (
                            <div className="w-2 h-2 rounded-full bg-indigo-400" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-white">Alternate nightly</span>
                      </div>
                      <p className="text-xs text-indigo-300/70 mt-1 ml-6">
                        Swap who goes first each night, regardless of mid-night switches.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRotationMode(ROTATION_CONTINUE_FROM_LAST)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                        rotationMode === ROTATION_CONTINUE_FROM_LAST
                          ? 'border-indigo-500 bg-indigo-500/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          rotationMode === ROTATION_CONTINUE_FROM_LAST ? 'border-indigo-400' : 'border-white/30'
                        }`}>
                          {rotationMode === ROTATION_CONTINUE_FROM_LAST && (
                            <div className="w-2 h-2 rounded-full bg-indigo-400" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-white">Pick up where we left off</span>
                      </div>
                      <p className="text-xs text-indigo-300/70 mt-1 ml-6">
                        Whoever is next after the last trip stays next tomorrow.
                      </p>
                    </button>
                  </div>
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

                {/* ─── Sign Out ──────────────────────────────────────────────────────
                    Placed at the bottom of Settings so it's accessible but not
                    prominent. Closing the modal before logout prevents a frozen
                    overlay during the async logout fetch. ─────────────────────── */}
                <div className="pt-4 mt-2 border-t border-rose-500/20">
                  <p className="text-xs text-rose-300/60 mb-3">
                    You'll need your magic link email to sign back in.
                  </p>
                  <button
                    onClick={() => { setShowSettings(false); handleLogout(); }}
                    className="w-full py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Journal Modal */}
      <AnimatePresence>
        {showJournal && (
          <JournalModal
              onClose={() => setShowJournal(false)}
              parent1Name={state.settings.parent1_name}
              parent2Name={state.settings.parent2_name}
            />
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <HelpModal onClose={() => setShowHelp(false)} />
        )}
      </AnimatePresence>

      {/* Notification onboarding prompt — shown once after first login */}
      <AnimatePresence>
        {showNotifPrompt && pushSupported && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 right-6 left-6 z-50 flex justify-center"
          >
            <div className="bg-slate-800 border border-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm max-w-sm w-full shadow-2xl">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-indigo-100 mb-3">
                    Enable notifications so you know when your partner finishes their turn.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleNotifEnable}
                      className="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-400 transition-colors"
                    >
                      Enable
                    </button>
                    <button
                      onClick={handleNotifDismiss}
                      className="px-4 py-2 text-indigo-300 text-sm font-medium rounded-lg hover:bg-white/5 transition-colors"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <div className={`flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-sm border text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-400/20 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-red-500/15 border-red-400/20 text-red-200'
                : 'bg-indigo-500/15 border-indigo-400/20 text-indigo-200'
            }`}>
              {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
              {toast.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {toast.type === 'info' && <Bell className="w-4 h-4 shrink-0" />}
              {toast.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
