import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function OutroScene() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1700),
      setTimeout(() => setPhase(4), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1a2744 50%, #0c1a40 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8 }}
    >
      {/* Animated grid lines for tech feel */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`h${i}`}
            className="absolute left-0 right-0 h-px bg-primary"
            style={{ top: `${(i + 1) * 12.5}%` }}
            initial={{ scaleX: 0, transformOrigin: 'left' }}
            animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`v${i}`}
            className="absolute top-0 bottom-0 w-px bg-primary"
            style={{ left: `${(i + 1) * 8.33}%` }}
            initial={{ scaleY: 0, transformOrigin: 'top' }}
            animate={phase >= 1 ? { scaleY: 1 } : { scaleY: 0 }}
            transition={{ duration: 0.8, delay: i * 0.04 + 0.1, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>

      {/* Hours logged celebration pulse */}
      <motion.div
        className="absolute w-[50vw] h-[50vw] rounded-full border border-primary/30"
        animate={{ scale: [1, 1.6, 2.2], opacity: [0.4, 0.15, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute w-[50vw] h-[50vw] rounded-full border border-primary/20"
        animate={{ scale: [1, 1.6, 2.2], opacity: [0.3, 0.1, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.4, ease: 'easeOut' }}
      />

      {/* Hours logged card */}
      <motion.div
        className="mb-10 relative"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      >
        <div
          className="rounded-3xl px-10 py-6 text-center shadow-2xl border border-white/10"
          style={{ background: 'rgba(24, 101, 242, 0.25)', backdropFilter: 'blur(20px)' }}
        >
          <motion.div
            className="text-7xl font-display font-bold text-white mb-1"
            initial={{ y: 20 }}
            animate={phase >= 2 ? { y: 0 } : { y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.1 }}
          >
            +1.0
          </motion.div>
          <motion.p
            className="text-primary-light text-base font-semibold"
            style={{ color: '#93B8FF' }}
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            NHS Hour Logged
          </motion.p>
        </div>

        {/* progress update */}
        <motion.div
          className="mt-4 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="flex-1">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-white/60">Annual Goal</span>
              <span className="text-xs text-white font-semibold">13.5 / 20 hrs</span>
            </div>
            <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #1865F2, #34D399)' }}
                initial={{ width: '62%' }}
                animate={phase >= 3 ? { width: '67.5%' } : { width: '62%' }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Logo & tagline */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: '#1865F2' }}
          >
            <span className="text-white text-base font-display font-bold">TOS</span>
          </div>
          <span className="text-2xl font-display font-bold text-white">TutorOS</span>
        </div>
        <motion.p
          className="text-base font-semibold tracking-wide"
          style={{ color: '#93B8FF' }}
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          Peer tutoring, elevated.
        </motion.p>
        <motion.p
          className="text-xs mt-2"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          NHS Leigh High School
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
