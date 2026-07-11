import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneMockup } from '../PhoneMockup';

const VERIFY_QUESTION = 'Factor the expression: x² + 5x + 6';

export function VerifyScene() {
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState('');
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    const ANSWER = '(x + 2)(x + 3)';
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1100),
    ];

    ANSWER.split('').forEach((char, i) => {
      timers.push(
        setTimeout(() => setTyped(ANSWER.slice(0, i + 1)), 2000 + i * 80)
      );
    });

    timers.push(setTimeout(() => setScore(94), 4200));
    timers.push(setTimeout(() => setPhase(3), 4500));
    timers.push(setTimeout(() => setPhase(4), 5500));

    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ clipPath: 'circle(0% at 75% 50%)' }}
      animate={{ clipPath: 'circle(120% at 75% 50%)' }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex items-center gap-14">
        <div className="w-[380px]">
          <motion.div
            className="flex items-center gap-3 mb-5"
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-2 h-10 bg-success rounded-full" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-success mb-0.5">Step 3</p>
              <h2 className="text-4xl font-display font-bold text-text-primary leading-tight">Verify Check-in</h2>
            </div>
          </motion.div>

          <motion.p
            className="text-lg text-text-secondary mb-6 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            Student demonstrates understanding in ~30 seconds. No listening, no AI during tutoring — just a clean knowledge check.
          </motion.p>

          <motion.div
            className="overflow-hidden"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-text-primary">Learning score</p>
                <motion.div
                  className="text-2xl font-display font-bold"
                  style={{ color: '#10B981' }}
                  initial={{ scale: 0 }}
                  animate={score !== null ? { scale: 1 } : { scale: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  {score !== null ? `${score}%` : '—'}
                </motion.div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #1865F2, #10B981)' }}
                  initial={{ width: '0%' }}
                  animate={score !== null ? { width: `${score}%` } : { width: '0%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-text-muted mt-2">Stored in tutee memory for next session</p>
            </div>
          </motion.div>
        </div>

        <PhoneMockup>
          <div className="absolute inset-0 bg-bg-light flex flex-col">
            <div className="bg-bg-light px-5 pt-10 pb-3">
              <motion.div
                className="flex items-center gap-2 mb-1"
                initial={{ opacity: 0 }}
                animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
              >
                <div className="w-1.5 h-5 bg-success rounded-full" />
                <p className="text-sm font-bold text-text-primary">Verify Check-in</p>
              </motion.div>
              <p className="text-xs text-text-muted pl-3.5">Sarah J. — ~30 seconds</p>
            </div>

            <div className="flex-1 px-4 flex flex-col gap-4">
              <motion.div
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
                initial={{ opacity: 0, y: 12 }}
                animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <p className="text-xs text-text-muted mb-2 font-semibold uppercase tracking-wide">Quick question</p>
                <p className="text-sm font-semibold text-text-primary leading-snug">{VERIFY_QUESTION}</p>
              </motion.div>

              <motion.div
                className="bg-white rounded-2xl px-4 py-3 border-2 border-primary shadow-sm"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-xs text-text-muted mb-1">Student answer</p>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono text-text-primary">{typed}</span>
                  {typed.length > 0 && typed.length < 14 && (
                    <motion.div
                      className="w-0.5 h-4 bg-primary"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                </div>
              </motion.div>

              {score !== null && (
                <motion.div
                  className="bg-success/10 border border-success/30 rounded-2xl p-4"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="8" fill="#10B981" />
                      <path d="M4.5 8L7 10.5L11.5 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-sm font-bold text-success">Correct!</p>
                  </div>
                  <p className="text-xs text-text-secondary">Learning moment saved to memory</p>
                </motion.div>
              )}
            </div>

            <div className="px-4 pb-4">
              <motion.div
                className="h-10 bg-success text-white rounded-xl flex items-center justify-center font-semibold text-sm"
                animate={phase >= 4 ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                Log Hours
              </motion.div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </motion.div>
  );
}
