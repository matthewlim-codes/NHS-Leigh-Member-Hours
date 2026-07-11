import React from 'react';
import { motion } from 'framer-motion';

export function PhoneMockup({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <motion.div 
      className={`relative w-[320px] h-[650px] bg-white rounded-[40px] border-[8px] border-slate-800 shadow-2xl overflow-hidden flex flex-col ${className}`}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50"></div>
      <div className="flex-1 overflow-hidden relative bg-bg-light">
        {children}
      </div>
    </motion.div>
  );
}