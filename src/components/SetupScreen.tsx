import React, { useState } from 'react';
import { Moon } from 'lucide-react';

interface SetupScreenProps {
  email: string;
  onComplete: () => void;
}

// ─── Map server errors to user-friendly messages ─────────────────────────────

const friendlyErrorMessages: Record<string, string> = {
  'Email already registered': 'This email is already linked to a StarTurn family. Try signing in instead.',
  'Partner email already registered with another family': "Your partner's email is already linked to another family.",
  'Your email and your partner\'s email must be different': 'You and your partner need different email addresses.',
  'Please enter valid email addresses': 'One or both email addresses look invalid. Please double-check.',
  'Names cannot be empty': 'Both names are required.',
};

function toFriendlyError(serverError: string): string {
  return friendlyErrorMessages[serverError] || serverError;
}

export function SetupScreen({ email, onComplete }: SetupScreenProps) {
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [bedtime, setBedtime] = useState('22:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [firstTurn, setFirstTurn] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = myName.trim() && partnerName.trim() && partnerEmail.trim() && bedtime && wakeTime;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || saving) return;

    // Client-side validation before hitting the server
    if (myName.trim().length > 30 || partnerName.trim().length > 30) {
      setError('Names must be 30 characters or fewer.');
      return;
    }
    if (email.trim().toLowerCase() === partnerEmail.trim().toLowerCase()) {
      setError('You and your partner need different email addresses.');
      return;
    }

    setSaving(true);
    setError('');

    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: myName.trim(),
        partnerName: partnerName.trim(),
        partnerEmail: partnerEmail.trim(),
        bedtime,
        wakeTime,
        firstTurnIndex: firstTurn,
        // Capture the browser's IANA timezone (e.g. "America/Chicago") so the
        // server can fire scheduled notifications at the right local time.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });

    if (!res.ok) {
      const err = await res.json();
      setError(toFriendlyError(err.error || 'Setup failed. Please try again.'));
      setSaving(false);
      return;
    }

    setSaving(false);
    onComplete();
  };

  const firstName = myName.trim() || 'Me';
  const secondName = partnerName.trim() || 'Partner';

  return (
    <div className="z-10 w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <div className="w-20 h-20 rounded-full bg-indigo-500/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
          <Moon className="w-10 h-10 text-yellow-200 fill-yellow-200" />
        </div>
      </div>
      <h1 className="text-4xl font-bold mb-2 text-center">StarTurn</h1>
      <p className="text-indigo-200 mb-8 text-center">Let's get you set up.</p>

      <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-white/10 rounded-3xl p-8 backdrop-blur-md space-y-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Your Name</label>
          <input
            type="text"
            placeholder="e.g. Alice"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            maxLength={30}
            required
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Partner's Name</label>
          <input
            type="text"
            placeholder="e.g. Ben"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            maxLength={30}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Partner's Email</label>
          <input
            type="email"
            placeholder="ben@example.com"
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-indigo-300/50 mt-1">We'll send them an invite to join your StarTurn.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Bedtime</label>
          <input
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Wake Time</label>
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [color-scheme:dark]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Who goes first tonight?</label>
          <p className="text-xs text-indigo-300/50 mb-2">Pick who takes the first shift tonight. You'll alternate from here.</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFirstTurn(0)}
              className={`py-3 rounded-xl border font-medium transition-all ${
                firstTurn === 0
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-white/5 border-white/10 text-indigo-200 hover:bg-white/10'
              }`}
            >
              {firstName}
            </button>
            <button
              type="button"
              onClick={() => setFirstTurn(1)}
              className={`py-3 rounded-xl border font-medium transition-all ${
                firstTurn === 1
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-white/5 border-white/10 text-indigo-200 hover:bg-white/10'
              }`}
            >
              {secondName}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg disabled:opacity-40 disabled:cursor-not-allowed mt-2"
        >
          {saving ? 'Saving...' : 'Get Started'}
        </button>
      </form>
    </div>
  );
}
