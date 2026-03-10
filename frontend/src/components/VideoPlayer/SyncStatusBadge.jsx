import { CheckCircle2, Loader2, Zap } from 'lucide-react';

const SyncStatusBadge = ({ status }) => {
  if (!status) return null;

  const config = {
    synced: {
      icon: <CheckCircle2 className="w-3 h-3 text-accent-green" />,
      text: 'Synced',
      bg: 'bg-accent-green/10',
      border: 'border-accent-green/20',
      textColor: 'text-accent-green'
    },
    'catching-up': {
      icon: <Zap className="w-3 h-3 text-accent-yellow animate-pulse" />,
      text: 'Catching up...',
      bg: 'bg-accent-yellow/10',
      border: 'border-accent-yellow/20',
      textColor: 'text-accent-yellow'
    },
    buffering: {
      icon: <Loader2 className="w-3 h-3 text-accent-red animate-spin" />,
      text: 'Buffering',
      bg: 'bg-accent-red/10',
      border: 'border-accent-red/20',
      textColor: 'text-accent-red'
    }
  };

  const { icon, text, bg, border, textColor } = config[status] || config.synced;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${bg} ${border} border backdrop-blur-md shadow-lg transition-all duration-300 animate-slide-up`}>
      {icon}
      <span className={`text-[10px] font-bold uppercase tracking-wider ${textColor}`}>
        {text}
      </span>
    </div>
  );
};

export default SyncStatusBadge;
