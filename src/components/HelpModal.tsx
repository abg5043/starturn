import { motion } from 'framer-motion';
import { HelpCircle, Star, Moon, Sun, ArrowRightLeft, BookOpen, Settings, Smartphone } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative overflow-hidden max-h-[80vh] overflow-y-auto"
      >
        {/* Gradient top bar — matches Settings modal */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-indigo-400" />
          How StarTurn Works
        </h2>

        <div className="space-y-5 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-yellow-200 fill-yellow-200 shrink-0" />
              <span className="font-semibold text-white">It&rsquo;s Your Turn</span>
            </div>
            <p className="text-indigo-200/80 ml-6">
              When the child wakes and it&rsquo;s your turn, handle the situation as normal.
              When you&rsquo;re back in bed, tap &ldquo;Done &mdash; Going Back to Bed&rdquo; to log the
              wakeup and pass the turn to your partner.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
              <span className="font-semibold text-white">Rest Mode</span>
            </div>
            <p className="text-indigo-200/80 ml-6">
              When it&rsquo;s your partner&rsquo;s turn, relax &mdash; the app shows who&rsquo;s on duty so
              you both always know.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <ArrowRightLeft className="w-4 h-4 text-indigo-300 shrink-0" />
              <span className="font-semibold text-white">Skip / Take Over</span>
            </div>
            <p className="text-indigo-200/80 ml-6">
              &ldquo;Skip my turn&rdquo; passes this wakeup to your partner.
              &ldquo;Let me take over&rdquo; claims the turn if your partner can&rsquo;t respond.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="font-semibold text-white">Daytime View</span>
            </div>
            <p className="text-indigo-200/80 ml-6">
              During the day you&rsquo;ll see a countdown to bedtime and who&rsquo;s
              &ldquo;first up&rdquo; &mdash; meaning who handles the first wakeup of the night,
              not who puts the child to bed.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-indigo-300 shrink-0" />
              <span className="font-semibold text-white">Night Journal</span>
            </div>
            <p className="text-indigo-200/80 ml-6">
              Tap the book icon to see a history of every wakeup &mdash; useful
              for spotting patterns over time.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4 h-4 text-indigo-300 shrink-0" />
              <span className="font-semibold text-white">Settings</span>
            </div>
            <p className="text-indigo-200/80 ml-6">
              Change names, bedtime, wake time, rotation mode, and enable push
              notifications from the gear icon.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="w-4 h-4 text-indigo-300 shrink-0" />
              <span className="font-semibold text-white">Install as App</span>
            </div>
            <p className="text-indigo-200/80 ml-6">
              iPhone: Share &rarr; Add to Home Screen<br />
              Android: Menu &rarr; Install App
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-indigo-50 transition-colors mt-6"
        >
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}
