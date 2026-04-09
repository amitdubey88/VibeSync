'use client';

import { CheckCircle2, Loader2, Zap } from 'lucide-react';

const SyncStatusBadge = ({ status }) => {
  if (!status) return null;

  const config = {
    synced: {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      text: 'Synced',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      textColor: 'text-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]'
    },
    'catching-up': {
      icon: <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />,
      text: 'Catching up...',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      textColor: 'text-amber-400',
      glow: 'shadow-[0_0_15px_rgba(251,146,60,0.2)]'
    },
    buffering: {
      icon: <div className="w-2.5 h-2.5 rounded-full bg-obsidian-primary animate-pulse shadow-[0_0_10px_rgba(170,85,255,0.8)]" />,
      text: 'Buffering',
      bg: 'bg-obsidian-primary/10',
      border: 'border-obsidian-primary/20',
      textColor: 'text-obsidian-primary',
      glow: 'shadow-[0_0_15px_rgba(170,85,255,0.2)]'
    }
  };

  const { icon, text, bg, border, textColor, glow } = config[status] || config.synced;

  return (
    <div className={`flex items-center gap-2 px-3.5 py-1.5 ${bg} ${border} border rounded-full backdrop-blur-xl transition-all duration-300 animate-slide-up ${glow} border-white/5`}>
      {icon}
      <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${textColor}`}>
        {text}
      </span>
    </div>
  );
};

export default SyncStatusBadge;
