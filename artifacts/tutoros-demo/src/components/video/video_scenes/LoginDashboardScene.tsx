import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PhoneMockup } from '../PhoneMockup';

export function LoginDashboardScene() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),   // type username
      setTimeout(() => setPhase(2), 1600),  // type pass
      setTimeout(() => setPhase(3), 2200),  // click login
      setTimeout(() => setPhase(4), 2800),  // dashboard transition
      setTimeout(() => setPhase(5), 4000),  // dashboard reveal content
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ x: '-100vw', opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-16">
        <div className="w-[400px]">
          <motion.h2 
            className="text-5xl font-display font-bold text-text-primary leading-tight mb-4"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Seamless Login &<br/>Dashboard
          </motion.h2>
          <motion.p 
            className="text-xl text-text-secondary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            Student ID integration makes tracking volunteer hours effortless.
          </motion.p>
        </div>

        <PhoneMockup>
          <AnimatePresence mode="popLayout">
            {phase < 4 ? (
              <motion.div 
                key="login"
                className="absolute inset-0 bg-white p-8 flex flex-col justify-center"
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
              >
                <div className="w-16 h-16 bg-primary rounded-2xl mb-8 flex items-center justify-center">
                  <span className="text-white text-2xl font-display font-bold">TOS</span>
                </div>
                <h3 className="text-2xl font-display font-bold mb-6">Sign In</h3>
                
                <div className="space-y-4">
                  <div className="h-12 border border-slate-200 rounded-xl px-4 flex items-center relative overflow-hidden">
                    <span className="text-text-muted text-sm absolute left-4 transition-all">Username</span>
                    <motion.div 
                      className="absolute inset-0 bg-white px-4 flex items-center"
                      initial={{ width: '100%' }}
                      animate={phase >= 1 ? { width: 0 } : { width: '100%' }}
                      transition={{ duration: 0 }}
                      style={{ transformOrigin: 'right' }}
                    />
                    <motion.span 
                      className="text-text-primary z-10"
                      initial={{ opacity: 0 }}
                      animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
                    >
                      Matthew-Lim
                    </motion.span>
                  </div>
                  
                  <div className="h-12 border border-slate-200 rounded-xl px-4 flex items-center relative overflow-hidden">
                    <span className="text-text-muted text-sm absolute left-4">Student ID</span>
                    <motion.span 
                      className="text-text-primary z-10 font-mono tracking-widest text-lg ml-2"
                      initial={{ opacity: 0 }}
                      animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                    >
                      ••••••••
                    </motion.span>
                  </div>
                </div>

                <motion.div 
                  className="mt-8 h-12 bg-primary text-white rounded-xl flex items-center justify-center font-semibold"
                  animate={phase >= 3 ? { scale: 0.95, backgroundColor: 'var(--color-primary-dark)' } : { scale: 1 }}
                  transition={{ duration: 0.1 }}
                >
                  Log In
                </motion.div>
              </motion.div>
            ) : (
              <motion.div 
                key="dashboard"
                className="absolute inset-0 bg-bg-light"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="bg-primary pt-12 pb-6 px-6 rounded-b-3xl">
                  <motion.div 
                    className="flex justify-between items-center mb-6"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                  >
                    <div>
                      <p className="text-white/70 text-sm">Welcome back,</p>
                      <h3 className="text-white text-xl font-bold">Matthew</h3>
                    </div>
                    <div className="w-10 h-10 bg-white/20 rounded-full"></div>
                  </motion.div>

                  <motion.div 
                    className="bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/20"
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                  >
                    <p className="text-white/80 text-sm mb-2">NHS Hours logged</p>
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-4xl font-display font-bold text-white">12.5</span>
                      <span className="text-white/70 mb-1">/ 20 hrs</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white rounded-full"
                        initial={{ width: 0 }}
                        animate={phase >= 5 ? { width: '62%' } : { width: 0 }}
                        transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </motion.div>
                </div>

                <div className="p-6">
                  <motion.h4 
                    className="font-bold text-text-primary mb-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                  >
                    Next Session
                  </motion.h4>
                  
                  <motion.div 
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100"
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h5 className="font-bold text-text-primary">Algebra II</h5>
                        <p className="text-sm text-text-secondary">with Sarah J.</p>
                      </div>
                      <span className="text-xs font-semibold bg-primary-light text-primary px-2 py-1 rounded-md">Today, 3:30 PM</span>
                    </div>
                    
                    <div className="h-10 bg-primary text-white rounded-xl flex items-center justify-center font-semibold text-sm w-full">
                      Start Prep Brief
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </PhoneMockup>
      </div>
    </motion.div>
  );
}