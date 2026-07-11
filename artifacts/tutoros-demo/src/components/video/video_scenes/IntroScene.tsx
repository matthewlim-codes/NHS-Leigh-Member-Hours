import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function IntroScene() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="w-32 h-32 bg-primary rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-primary/40"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
      >
        <span className="text-white text-5xl font-display font-bold">TOS</span>
      </motion.div>

      <div className="text-center overflow-hidden">
        <motion.h1 
          className="text-6xl font-display font-bold text-text-primary tracking-tight"
          initial={{ y: 100, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          TutorOS
        </motion.h1>
      </div>

      <div className="text-center overflow-hidden mt-4">
        <motion.h2
          className="text-2xl font-body text-text-secondary"
          initial={{ y: 50, opacity: 0 }}
          animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 50, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          NHS Leigh High School
        </motion.h2>
      </div>
    </motion.div>
  );
}