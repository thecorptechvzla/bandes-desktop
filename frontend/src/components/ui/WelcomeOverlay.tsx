'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface WelcomeOverlayProps {
  username: string;
  onDone: () => void;
}

const HOLD_MS = 2000;
const FADE_OUT_MS = 600;

export default function WelcomeOverlay({ username, onDone }: WelcomeOverlayProps) {
  const [phase, setPhase] = useState<'in' | 'out'>('in');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('out'), HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'in' ? 1 : 0 }}
      transition={{ duration: phase === 'in' ? 0.4 : FADE_OUT_MS / 1000, ease: 'easeInOut' }}
      onAnimationComplete={() => {
        if (phase === 'out') onDone();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#0B0F19]"
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--hud-border-glow)] bg-[var(--hud-bg-deepest)]/80 shadow-[0_0_32px_-8px_rgba(251,191,36,0.45)]"
          >
            <img src="/Bandes2.png" alt="Bandes" className="h-12 w-12 rounded-xl object-contain" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
            className="text-xl font-mono font-bold uppercase tracking-[0.28em] text-[var(--hud-text-primary)] sm:text-2xl"
          >
            Bienvenido, {username}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
            className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500"
          >
            Control Mining · Acceso Autorizado
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}
