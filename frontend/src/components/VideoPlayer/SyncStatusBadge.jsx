import { CheckCircle2, Loader2, Zap } from 'lucide-react';

const SyncStatusBadge = ({ status }) => {
  if (!status) return null;

  const config = {
    synced: {
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
      text: 'Synced',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      textColor: 'text-emerald-400'
    },
    'catching-up': {
      icon: <Zap className="w-3 h-3 text-amber-400 animate-pulse" />,
      text: 'Catching up...',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      textColor: 'text-amber-400'
    },
    buffering: {
      icon: <div className="w-2 h-2  bg-violet-400 animate-pulse shadow-[0_0_10px_rgba(167,139,250,0.8)]" />,
      text: 'Buffering',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      textColor: 'text-violet-400'
    }
  };

  const { icon, text, bg, border, textColor } = config[status] || config.synced;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1  ${bg} ${border} border backdrop-blur-md shadow-lg transition-all duration-300 animate-slide-up`}>
      {icon}
      <span className={`text-[10px] font-bold uppercase tracking-wider ${textColor}`}>
        {text}
      </span>
    </div>
  );
};

export default SyncStatusBadge;
