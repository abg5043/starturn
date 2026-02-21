import React, { useState } from 'react';
import { Moon } from 'lucide-react';

interface SetupScreenProps {
  familyId: string;
  defaultParent1?: string;
  defaultParent2?: string;
  onComplete: () => void;
}

export function SetupScreen({ familyId, defaultParent1 = '', defaultParent2 = '', onComplete }: SetupScreenProps) {
  const [p1, setP1] = useState(defaultParent1);
  const [p1Email, setP1Email] = useState('');
  const [p2, setP2] = useState(defaultParent2);
  const [p2Email, setP2Email] = useState('');
  const [bedtime, setBedtime] = useState('22:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [firstTurn, setFirstTurn] = useState(0);
  const [actingParent, setActingParent] = useState(0); // which parent is setting up right now
  const [saving, setSaving] = useState(false);

  const canSubmit = p1.trim() && p2.trim() && p1Email.trim() && p2Email.trim() && bedtime && wakeTime;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);

    await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyId,
        parent1: p1.trim(),
        parent1Email: p1Email.trim(),
        parent2: p2.trim(),
        parent2Email: p2Email.trim(),
        bedtime,
        wakeTime,
        firstTurnIndex: firstTurn,
        actingParentIndex: actingParent
      })
    });

    setSaving(false);
    onComplete();
  };

  const firstName = p1.trim() || 'Parent 1';
  const secondName = p2.trim() || 'Parent 2';

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

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Parent 1 Name</label>
          <input
            type="text"
            placeholder="e.g. Alice"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Parent 1 Email</label>
          <input
            type="email"
            placeholder="alice@example.com"
            value={p1Email}
            onChange={(e) => setP1Email(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Parent 2 Name</label>
          <input
            type="text"
            placeholder="e.g. Ben"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-1">Parent 2 Email</label>
          <input
            type="email"
            placeholder="ben@example.com"
            value={p2Email}
            onChange={(e) => setP2Email(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
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
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-2">Who goes first tonight?</label>
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

        <div>
          <label className="block text-xs font-medium text-indigo-300 uppercase tracking-wider mb-2">Which parent are you?</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActingParent(0)}
              className={`py-3 rounded-xl border font-medium transition-all ${
                actingParent === 0
                  ? 'bg-indigo-500/30 border-indigo-400/40 text-white'
                  : 'bg-white/5 border-white/10 text-indigo-200 hover:bg-white/10'
              }`}
            >
              {firstName}
            </button>
            <button
              type="button"
              onClick={() => setActingParent(1)}
              className={`py-3 rounded-xl border font-medium transition-all ${
                actingParent === 1
                  ? 'bg-indigo-500/30 border-indigo-400/40 text-white'
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
