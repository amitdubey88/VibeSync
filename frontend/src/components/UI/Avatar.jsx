import { getInitials } from '../../utils/stringUtils';

/**
 * Avatar — reusable user avatar circle.
 *
 * Props:
 *  username  – string, used for initials + accessible alt
 *  avatarBg  – string (CSS color string or gradient)
 *  size      – 'xs' | 'sm' | 'md' | 'lg' | 'xl'  (default: 'md')
 *  online    – boolean  (show green/gray presence ring)
 *  status    – 'online' | 'buffering' | 'away' | 'offline' | undefined
 *  speaking  – boolean  (trigger pulse ring when speaking in voice)
 *  className – extra classes
 */

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
};

const STATUS_COLOR = {
  online:    'bg-emerald-500',
  buffering: 'bg-amber-500',
  away:      'bg-amber-500',
  offline:   'bg-zinc-500',
};


const Avatar = ({
  username = '?',
  avatarBg,
  size = 'md',
  status,
  speaking = false,
  className = '',
}) => {
  const showDot = !!status;
  const dotColor = STATUS_COLOR[status] || 'bg-zinc-500';

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`
          avatar font-bold text-white select-none
          ${SIZE_MAP[size] ?? SIZE_MAP.md}
          ${speaking
            ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] trigger-pulse-ring'
            : 'avatar-ring'}
        `}
        style={avatarBg ? { backgroundColor: avatarBg } : undefined}
        aria-label={username}
      >
        {getInitials(username)}
      </div>

      {showDot && (
        <span
          className={`status-dot absolute -bottom-0.5 -right-0.5 border-2 border-[#0a0a0b] ${dotColor}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default Avatar;
