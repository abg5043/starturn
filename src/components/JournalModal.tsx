import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Moon, X, ArrowRight } from 'lucide-react';

interface Trip {
  id: number;
  parent_name: string;
  action: string;
  timestamp: string;
  night_date: string;
}

interface Night {
  night_date: string;
  first_parent: string | null;
  trips: Trip[];
}

interface JournalModalProps {
  familyId: string;
  onClose: () => void;
}

function formatTripTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatNightDate(nightDate: string): string {
  // nightDate is YYYY-MM-DD (the date bedtime started)
  const date = new Date(nightDate + 'T12:00:00'); // noon to avoid timezone offset issues
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function TripRow({ trip, isFirst }: { trip: Trip; isFirst: boolean }) {
  const isSkip = trip.action === 'skipped_turn';
  const isTakeover = trip.action === 'took_over';
  const isOverride = isSkip || isTakeover;

  const label = isSkip
    ? `${trip.parent_name} passed their turn`
    : isTakeover
    ? `${trip.parent_name} took over`
    : trip.parent_name;

  return (
    <div className={`flex items-start gap-3 py-1.5 ${isOverride ? 'opacity-60' : ''}`}>
      <div className="w-5 mt-0.5 flex-shrink-0 flex items-center justify-center">
        {isFirst && !isOverride ? (
          <Moon className="w-3.5 h-3.5 text-indigo-300" />
        ) : isOverride ? (
          <ArrowRight className="w-3.5 h-3.5 text-indigo-400/60" />
        ) : (
          <span className="text-indigo-400/40 text-xs">·</span>
        )}
      </div>
      <span className="text-xs text-indigo-300/70 w-16 flex-shrink-0 mt-0.5">
        {formatTripTime(trip.timestamp)}
      </span>
      <span className={`text-sm ${isOverride ? 'text-indigo-200/50 italic' : 'text-indigo-100'}`}>
        {label}
      </span>
    </div>
  );
}

export function JournalModal({ familyId, onClose }: JournalModalProps) {
  const [nights, setNights] = useState<Night[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/journal?familyId=${familyId}`)
      .then(r => r.json())
      .then(data => {
        setNights(data.nights || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [familyId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 rounded-t-3xl w-full max-w-lg shadow-2xl relative overflow-hidden"
        style={{ maxHeight: '85vh' }}
      >
        {/* Gradient top bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-7 pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Night Journal
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-indigo-300"
            aria-label="Close journal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto px-6 pb-8" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {loading ? (
            <div className="text-center text-indigo-300/50 py-12 text-sm animate-pulse">Loading...</div>
          ) : nights.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Moon className="w-10 h-10 text-indigo-400/30 mx-auto" />
              <p className="text-indigo-300/50 text-sm italic">No nights recorded yet.</p>
              <p className="text-indigo-300/30 text-xs">Your journey begins tonight.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {nights.map(night => {
                const firstActualTrip = night.trips.find(
                  t => t.action === 'completed_turn' || t.action === 'took_over'
                );
                return (
                  <div
                    key={night.night_date}
                    className="bg-white/5 border border-white/5 rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {formatNightDate(night.night_date)}
                        </div>
                        {night.first_parent && (
                          <div className="text-xs text-indigo-300/60 mt-0.5">
                            First up: {night.first_parent}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-indigo-400/40 bg-white/5 rounded-full px-2 py-1">
                        {night.trips.filter(t => t.action === 'completed_turn' || t.action === 'took_over').length} trips
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-2">
                      {night.trips.map((trip: Trip) => (
                        <React.Fragment key={trip.id}>
                          <TripRow
                            trip={trip}
                            isFirst={trip.id === firstActualTrip?.id}
                          />
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
