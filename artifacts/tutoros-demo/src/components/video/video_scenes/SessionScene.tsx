import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneMockup } from '../PhoneMockup';

const RUBRIC_ITEMS = [
  { label: 'Explained concept clearly', color: '#1865F2' },
  { label: 'Used examples', color: '#10B981' },
  { label: 'Student asked questions', color: '#F59E0B' },
];

export function SessionScene() {
  const [phase, setPhase] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [tapped, setTapped] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setTapped([0]), 3000),
      setTimeout(() => setTapped([0, 1]), 4200),
      setTimeout(() => setTapped([0, 1, 2]), 5500),
      setTimeout(() => setPhase(3), 5800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds(s => s + 1);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const displayTime = `${String(Math.floor(seconds / 120)).padStart(2, '0')}:${String(Math.floor((seconds * 0.5) % 60)).padStart(2, '0')}`;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-14">
        <div className="w-[380px]">
          <motion.div
            className="flex items-center gap-3 mb-5"
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-2 h-10 bg-accent rounded-full" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-0.5">Step 2</p>
              <h2 className="text-4xl font-display font-bold text-text-primary leading-tight">Live Session</h2>
            </div>
          </motion.div>

          <motion.p
            className="text-lg text-text-secondary mb-6 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            Timer tracks duration. 3-tap rubric captures quality. No audio, no transcripts — just focused tutoring.
          </motion.p>

          <motion.div
            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-xs text-text-muted font-semibold mb-2 uppercase tracking-wide">Rubric</p>
            {RUBRIC_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <div
                  className="w-3 h-3 rounded-full transition-all duration-300"
                  style={{ backgroundColor: tapped.includes(i) ? item.color : '#E2E8F0' }}
                />
                <span className="text-sm text-text-secondary">{item.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <PhoneMockup>
          <div className="absolute inset-0 bg-bg-light flex flex-col">
            <div className="bg-primary px-5 pt-10 pb-4 rounded-b-3xl">
              <p className="text-white/70 text-xs mb-1">Active Session</p>
              <h3 className="text-white font-bold text-base">Sarah J. — Algebra II</h3>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
              <motion.div
                className="relative flex items-center justify-center"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              >
                <svg width="140" height="140" className="absolute">
                  <circle cx="70" cy="70" r="60" fill="none" stroke="#E8F0FE" strokeWidth="10" />
                  <motion.circle
                    cx="70" cy="70" r="60"
                    fill="none" stroke="#1865F2" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 60 * 0.3 }}
                    animate={{ strokeDashoffset: 0 }}
                    style={{ transformOrigin: '70px 70px', rotate: '-90deg' }}
                    transition={{ duration: 6, ease: 'linear' }}
                  />
                </svg>
                <div className="text-center z-10">
                  <span className="text-3xl font-display font-bold text-text-primary font-mono">{displayTime}</span>
                  <p className="text-xs text-text-muted">elapsed</p>
                </div>
              </motion.div>

              <div className="w-full space-y-2">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide text-center mb-3">Session Rubric</p>
                {RUBRIC_ITEMS.map((item, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-slate-100"
                    initial={{ opacity: 0, x: -10 }}
                    animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                    transition={{ delay: 0.1 * i + 0.4, duration: 0.4 }}
                  >
                    <span className="text-xs text-text-secondary">{item.label}</span>
                    <motion.div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      animate={tapped.includes(i) ? {
                        backgroundColor: item.color,
                        borderColor: item.color,
                        scale: [1, 1.3, 1],
                      } : {
                        backgroundColor: 'transparent',
                        borderColor: '#CBD5E1',
                        scale: 1,
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      {tapped.includes(i) && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="px-4 pb-4">
              <div className="h-10 bg-primary text-white rounded-xl flex items-center justify-center font-semibold text-sm">
                End & Verify
              </div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </motion.div>
  );
}
