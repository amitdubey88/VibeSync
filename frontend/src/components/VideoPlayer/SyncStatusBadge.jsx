import { CheckCircle2, Loader2, Zap } from 'lucide-react';

const SyncStatusBadge = ({ status }) => {
  if (!status) return null;

  const config = {
    synced: {
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
      text: 'Synced',
      bg: 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/10',
      border: 'border-emerald-500/30',
      textColor: 'text-emerald-400',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]'
    },
    'catching-up': {
      icon: <Zap className="w-3 h-3 text-amber-400 animate-pulse" />,
      text: 'Catching up...',
      bg: 'bg-gradient-to-r from-amber-500/15 to-amber-500/10',
      border: 'border-amber-500/30',
      textColor: 'text-amber-400',
      glow: 'shadow-[0_0_12px_rgba(251,146,60,0.25)]'
    },
    buffering: {
      icon: <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shadow-[0_0_10px_rgba(167,139,250,0.8)]" />,
      text: 'Buffering',
      bg: 'bg-gradient-to-r from-violet-500/15 to-violet-500/10',
      border: 'border-violet-500/30',
      textColor: 'text-violet-400',
      glow: 'shadow-[0_0_12px_rgba(167,139,250,0.25)]'
    }
  };

  const { icon, text, bg, border, textColor, glow } = config[status] || config.synced;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 ${bg} ${border} border rounded-full backdrop-blur-md transition-all duration-300 animate-slide-up ${glow}`}>
      {icon}
      <span className={`text-[10px] font-bold uppercase tracking-wider ${textColor}`}>
        {text}
      </span>
    </div>
  );
};

export default SyncStatusBadge;
