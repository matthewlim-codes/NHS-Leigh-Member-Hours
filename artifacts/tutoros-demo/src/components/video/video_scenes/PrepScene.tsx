import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PhoneMockup } from '../PhoneMockup';

const PREP_LINES = [
  { delay: 200, text: 'Reviewing Sarah\'s history with quadratic functions...' },
  { delay: 1200, text: 'Identified weak area: factoring trinomials' },
  { delay: 2400, text: 'Recommended approach: visual area model first' },
  { delay: 3500, text: 'Key question to ask: "What two numbers multiply to c and add to b?"' },
  { delay: 4800, text: 'Estimated readiness: 65% — focus on conceptual before procedural' },
];

export function PrepScene() {
  const [phase, setPhase] = useState(0);
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
    ];

    PREP_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => setVisibleLines(prev => [...prev, i]), line.delay + 600)
      );
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      exit={{ clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex items-center gap-14">
        <div className="w-[380px]">
          <motion.div
            className="flex items-center gap-3 mb-5"
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-2 h-10 bg-primary rounded-full" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-0.5">Step 1</p>
              <h2 className="text-4xl font-display font-bold text-text-primary leading-tight">AI Prep Brief</h2>
            </div>
          </motion.div>

          <motion.p
            className="text-lg text-text-secondary mb-6 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            Grounded in tutee history. Generated fresh each session. Reads like coaching, not a template.
          </motion.p>

          <motion.div
            className="flex gap-2 flex-wrap"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {['Memory-grounded', 'Claude-class AI', 'Actionable'].map((tag) => (
              <span key={tag} className="text-xs font-semibold bg-primary-light text-primary px-3 py-1.5 rounded-full">
                {tag}
              </span>
            ))}
          </motion.div>
        </div>

        <PhoneMockup>
          <div className="absolute inset-0 bg-bg-light flex flex-col">
            <div className="bg-primary px-5 pt-10 pb-4 rounded-b-3xl">
              <p className="text-white/70 text-xs mb-1">Prep Brief</p>
              <h3 className="text-white font-bold text-base">Sarah J. — Algebra II</h3>
            </div>

            <div className="flex-1 overflow-hidden px-4 py-4 space-y-3">
              {PREP_LINES.map((line, i) => (
                <motion.div
                  key={i}
                  className="bg-white rounded-xl p-3 shadow-sm border border-slate-100"
                  initial={{ opacity: 0, y: 12 }}
                  animate={visibleLines.includes(i) ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <p className="text-xs text-text-primary leading-relaxed">{line.text}</p>
                  </div>
                </motion.div>
              ))}

              {visibleLines.length < PREP_LINES.length && (
                <motion.div
                  className="flex gap-1 pl-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary/40"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </motion.div>
              )}
            </div>

            <div className="px-4 pb-4">
              <div className="h-10 bg-primary text-white rounded-xl flex items-center justify-center font-semibold text-sm">
                Start Session
              </div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </motion.div>
  );
}
