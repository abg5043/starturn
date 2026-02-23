import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Moon, X, ArrowRight, MoreHorizontal, Trash2, Pencil, Plus } from 'lucide-react';

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
  onClose: () => void;
  parent1Name: string;
  parent2Name: string;
}

function formatTripTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatNightDate(nightDate: string): string {
  // nightDate is YYYY-MM-DD (the date bedtime started)
  const date = new Date(nightDate + 'T12:00:00'); // noon to avoid timezone offset issues
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

// Produce the last 7 days as selectable date options for the "log a wakeup" form.
// Values are YYYY-MM-DD strings; labels are human-readable like "Yesterday (Fri, Jan 17)".
function generatePastDateOptions(): Array<{ value: string; label: string }> {
  const options = [];
  const today = new Date();
  for (let daysAgo = 0; daysAgo <= 6; daysAgo++) {
    const date = new Date(today);
    date.setDate(today.getDate() - daysAgo);
    const value = date.toISOString().slice(0, 10);
    const shortDate = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const label = daysAgo === 0 ? `Today (${shortDate})` : daysAgo === 1 ? `Yesterday (${shortDate})` : shortDate;
    options.push({ value, label });
  }
  return options;
}

interface TripRowProps {
  trip: Trip;
  isFirst: boolean;
  openMenuId: string | null;
  confirmingId: string | null;
  editingEntryId: number | null;
  parentNames: [string, string];
  onMenuOpen: (id: string) => void;
  onMenuClose: () => void;
  onSetConfirming: (id: string) => void;
  onDeleteEntry: (tripId: number, nightDate: string) => void;
  onEditOpen: (tripId: number) => void;
  onEditSave: (tripId: number, nightDate: string, newParentName: string) => void;
  onEditClose: () => void;
}

function TripRow({
  trip,
  isFirst,
  openMenuId,
  confirmingId,
  editingEntryId,
  parentNames,
  onMenuOpen,
  onMenuClose,
  onSetConfirming,
  onDeleteEntry,
  onEditOpen,
  onEditSave,
  onEditClose,
}: TripRowProps) {
  const isSkip = trip.action === 'skipped_turn';
  const isTakeover = trip.action === 'took_over';
  const isOverride = isSkip || isTakeover;

  const menuKey = `trip-${trip.id}`;
  const isMenuOpen = openMenuId === menuKey;
  const isConfirming = confirmingId === menuKey;
  // Track the selected parent name while editing this entry
  const isEditing = editingEntryId === trip.id;
  const [editParentName, setEditParentName] = useState(trip.parent_name);

  // Scroll this row into view when its edit form opens, so the expanded
  // inline form is never hidden behind the bottom of the scroll container.
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isEditing) {
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isEditing]);

  // Reset the edit dropdown to the current parent_name each time edit mode opens,
  // so a previously cancelled or saved edit doesn't leak its selection into the next edit.
  useEffect(() => {
    if (isEditing) setEditParentName(trip.parent_name);
  }, [isEditing, trip.parent_name]);

  const label = isSkip
    ? `${trip.parent_name} passed their turn`
    : isTakeover
    ? `${trip.parent_name} took over`
    : trip.parent_name;

  return (
    <motion.div
      ref={rowRef}
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.18 }}
      className={`group relative ${isOverride ? 'opacity-60' : ''}`}
    >
      {/* Inner wrapper clips row content during the height-collapse animation
          without clipping the absolutely-positioned popover menu. */}
      <div className="flex items-start gap-3 py-1.5 overflow-hidden">
        <div className="w-5 mt-0.5 flex-shrink-0 flex items-center justify-center">
          {isFirst && !isOverride ? (
            <Moon className="w-3.5 h-3.5 text-indigo-300" />
          ) : isOverride ? (
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400/60" />
          ) : (
            <span className="text-indigo-300/70 text-xs">·</span>
          )}
        </div>
        <span className="text-xs text-indigo-300/70 w-16 flex-shrink-0 mt-0.5">
          {formatTripTime(trip.timestamp)}
        </span>

        {/* Inline edit form — shown instead of label when editing */}
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <select
              aria-label="Parent for this entry"
              value={parentNames.includes(editParentName) ? editParentName : ''}
              onChange={e => setEditParentName(e.target.value)}
              className="flex-1 text-sm bg-slate-700 border border-white/10 rounded-lg px-2 py-1 text-indigo-100 focus:outline-none focus:border-indigo-400"
            >
              <option value="" disabled>Select a parent</option>
              {parentNames.map((name, index) => (
                <option key={index} value={name}>{name}</option>
              ))}
            </select>
            <button
              onClick={() => onEditSave(trip.id, trip.night_date, editParentName)}
              disabled={!parentNames.includes(editParentName)}
              className="text-xs text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/40 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              onClick={onEditClose}
              className="text-xs text-indigo-400/60 hover:text-indigo-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <span className={`text-sm ${isOverride ? 'text-indigo-200/50 italic' : 'text-indigo-100'}`}>
              {label}
            </span>

            {/* ··· button */}
            <button
              onClick={() => isMenuOpen ? onMenuClose() : onMenuOpen(menuKey)}
              className={`ml-auto p-1 rounded-md text-indigo-400/30 hover:text-indigo-300 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ${isMenuOpen ? 'opacity-60' : ''}`}
              aria-label="Entry options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Popover menu — lives outside the overflow-hidden inner wrapper so it
          is never clipped by the collapse animation. */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-6 z-20 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
          >
            {!isConfirming ? (
              <>
                {/* Edit parent name */}
                <button
                  onClick={() => { onMenuClose(); onEditOpen(trip.id); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-indigo-300 hover:bg-white/5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit entry
                </button>
                {/* Delete */}
                <button
                  onClick={() => onSetConfirming(menuKey)}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete entry
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-indigo-200/70 px-4 pt-3 pb-1">Delete this entry?</p>
                <div className="flex">
                  <button
                    onClick={onMenuClose}
                    className="flex-1 px-4 py-2.5 text-sm text-indigo-300 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onDeleteEntry(trip.id, trip.night_date)}
                    className="flex-1 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    Yes, delete
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function JournalModal({ onClose, parent1Name, parent2Name }: JournalModalProps) {
  const [nights, setNights] = useState<Night[]>([]);
  const [loading, setLoading] = useState(true);
  // Tracks which ··· menu is open: "trip-{id}" or "night-{nightDate}"
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // Tracks which item is in "Are you sure?" state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Tracks which trip entry is in inline edit mode
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  // The two parent names as a tuple for the edit dropdown
  const parentNames: [string, string] = [parent1Name, parent2Name];

  // State for the "log a wakeup" inline form
  const pastDateOptions = generatePastDateOptions();
  const [showAddForm, setShowAddForm] = useState(false);
  // Default to yesterday (index 1) — the most common "I forgot to log" scenario
  const [addNightDate, setAddNightDate] = useState(pastDateOptions[1]?.value ?? pastDateOptions[0].value);
  const [addParentName, setAddParentName] = useState('');
  // Default time to the current browser time as HH:mm
  const [addTime, setAddTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetch('/api/journal')
      .then(r => r.json())
      .then(data => {
        setNights(data.nights || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const closeMenu = () => {
    setOpenMenuId(null);
    setConfirmingId(null);
  };

  const openMenu = (id: string) => {
    setOpenMenuId(id);
    setConfirmingId(null);
  };

  const handleDeleteEntry = async (tripId: number, nightDate: string) => {
    try {
      const res = await fetch(`/api/journal/entry/${tripId}`, { method: 'DELETE' });
      if (!res.ok) return;
      // Remove entry from local state; remove the night entirely if no trips remain
      setNights(prev =>
        prev
          .map(night =>
            night.night_date === nightDate
              ? { ...night, trips: night.trips.filter(t => t.id !== tripId) }
              : night
          )
          .filter(night => night.trips.length > 0)
      );
    } finally {
      closeMenu();
    }
  };

  const handleEditSave = async (tripId: number, nightDate: string, newParentName: string) => {
    try {
      const res = await fetch(`/api/journal/entry/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_name: newParentName }),
      });
      if (!res.ok) {
        console.error(`Failed to update journal entry ${tripId}:`, res.status, res.statusText);
        return;
      }
      // Update the parent_name in local state
      setNights(prev =>
        prev.map(night =>
          night.night_date === nightDate
            ? {
                ...night,
                trips: night.trips.map(t =>
                  t.id === tripId ? { ...t, parent_name: newParentName } : t
                ),
              }
            : night
        )
      );
      // Exit edit mode only after a successful update
      setEditingEntryId(null);
    } catch (error) {
      console.error(`Error updating journal entry ${tripId}:`, error);
    }
  };

  const handleClearNight = async (nightDate: string) => {
    try {
      const res = await fetch(`/api/journal/night/${nightDate}`, { method: 'DELETE' });
      if (!res.ok) return;
      setNights(prev => prev.filter(night => night.night_date !== nightDate));
    } finally {
      closeMenu();
    }
  };

  const handleAddWakeup = async () => {
    if (!addParentName || !addNightDate || !addTime) return;

    // Build an ISO timestamp from the user's chosen date + local time.
    // new Date('YYYY-MM-DDTHH:mm:00') interprets the string as local time
    // and toISOString() converts it to UTC — matching how live entries are stored.
    const timestamp = new Date(`${addNightDate}T${addTime}:00`).toISOString();

    const res = await fetch('/api/journal/entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nightDate: addNightDate, parentName: addParentName, timestamp }),
    });
    if (!res.ok) return;

    const newTrip: Trip = await res.json();

    // Merge the new trip into local state.
    // If a card for this night already exists, insert the trip in timestamp order.
    // If not, create a new night card and sort it into the list by date descending.
    setNights(prev => {
      const existingNight = prev.find(n => n.night_date === addNightDate);
      if (existingNight) {
        // Insert the new trip in ascending timestamp order within the night
        const updatedTrips = [...existingNight.trips, newTrip].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        return prev.map(n =>
          n.night_date === addNightDate ? { ...n, trips: updatedTrips } : n
        );
      } else {
        // New night card — determine the first_parent from the new trip, then sort
        const newNight: Night = {
          night_date: addNightDate,
          first_parent: newTrip.parent_name,
          trips: [newTrip],
        };
        return [...prev, newNight].sort((a, b) => b.night_date.localeCompare(a.night_date));
      }
    });

    // Reset form to defaults for the next entry
    setAddParentName('');
    setShowAddForm(false);
  };

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
        style={{ maxHeight: '92vh' }}
      >
        {/* Gradient top bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-7 pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Night Journal
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAddForm(prev => !prev)}
              className={`p-2 rounded-full hover:bg-white/10 transition-colors ${showAddForm ? 'text-indigo-300 bg-white/10' : 'text-indigo-400/60'}`}
              aria-label="Log a wakeup"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-indigo-300"
              aria-label="Close journal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* "Log a wakeup" inline form — shown when the + button is tapped */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-4 flex flex-wrap gap-2 items-center border-b border-white/5">
                {/* Date selector */}
                <select
                  aria-label="Night date"
                  value={addNightDate}
                  onChange={e => setAddNightDate(e.target.value)}
                  className="text-sm bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-indigo-100 focus:outline-none focus:border-indigo-400 [color-scheme:dark]"
                >
                  {pastDateOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {/* Parent selector */}
                <select
                  aria-label="Parent for this wakeup"
                  value={addParentName}
                  onChange={e => setAddParentName(e.target.value)}
                  className="text-sm bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-indigo-100 focus:outline-none focus:border-indigo-400"
                >
                  <option value="" disabled>Who got up?</option>
                  {parentNames.map((name, index) => (
                    <option key={index} value={name}>{name}</option>
                  ))}
                </select>
                {/* Time picker */}
                <input
                  type="time"
                  aria-label="Time of wakeup"
                  value={addTime}
                  onChange={e => setAddTime(e.target.value)}
                  className="text-sm bg-slate-700 border border-white/10 rounded-lg px-2 py-1.5 text-indigo-100 focus:outline-none focus:border-indigo-400 [color-scheme:dark]"
                />
                {/* Submit */}
                <button
                  onClick={handleAddWakeup}
                  disabled={!addParentName}
                  className="text-sm font-medium text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/40 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Log wakeup
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-indigo-400/60 hover:text-indigo-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable list */}
        <div className="overflow-y-auto px-6 pb-32" style={{ maxHeight: 'calc(92vh - 80px)' }}>
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
                const nightMenuKey = `night-${night.night_date}`;
                const isNightMenuOpen = openMenuId === nightMenuKey;
                const isNightConfirming = confirmingId === nightMenuKey;
                const firstActualTrip = night.trips.find(
                  t => t.action === 'completed_turn' || t.action === 'took_over'
                );
                return (
                  <div
                    key={night.night_date}
                    className="bg-white/5 border border-white/5 rounded-2xl p-4"
                  >
                    {/* Night card header */}
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

                      {/* Trips count pill + ··· menu */}
                      <div className="flex items-center gap-1.5 relative">
                        <div className="text-xs text-indigo-400/40 bg-white/5 rounded-full px-2 py-1">
                          {night.trips.filter(t => t.action === 'completed_turn' || t.action === 'took_over').length} trips
                        </div>
                        <button
                          onClick={() => isNightMenuOpen ? closeMenu() : openMenu(nightMenuKey)}
                          className="p-1.5 rounded-lg text-indigo-400/40 hover:text-indigo-300 hover:bg-white/5 transition-colors"
                          aria-label="Night options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {/* Night card popover */}
                        <AnimatePresence>
                          {isNightMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.1 }}
                              className="absolute right-0 top-8 z-20 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                            >
                              {!isNightConfirming ? (
                                <button
                                  onClick={() => setConfirmingId(nightMenuKey)}
                                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Clear night
                                </button>
                              ) : (
                                <>
                                  <p className="text-xs text-indigo-200/70 px-4 pt-3 pb-1">
                                    Clear all entries for this night?
                                  </p>
                                  <div className="flex">
                                    <button
                                      onClick={closeMenu}
                                      className="flex-1 px-4 py-2.5 text-sm text-indigo-300 hover:bg-white/5 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleClearNight(night.night_date)}
                                      className="flex-1 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                                    >
                                      Yes, clear
                                    </button>
                                  </div>
                                </>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-2">
                      <AnimatePresence>
                        {night.trips.map((trip: Trip) => (
                          <TripRow
                            key={trip.id}
                            trip={trip}
                            isFirst={trip.id === firstActualTrip?.id}
                            openMenuId={openMenuId}
                            confirmingId={confirmingId}
                            editingEntryId={editingEntryId}
                            parentNames={parentNames}
                            onMenuOpen={openMenu}
                            onMenuClose={closeMenu}
                            onSetConfirming={setConfirmingId}
                            onDeleteEntry={handleDeleteEntry}
                            onEditOpen={setEditingEntryId}
                            onEditSave={handleEditSave}
                            onEditClose={() => setEditingEntryId(null)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transparent overlay to dismiss open menus on click-outside */}
        {openMenuId && (
          <div
            className="fixed inset-0 z-10"
            onClick={(e) => { e.stopPropagation(); closeMenu(); }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
