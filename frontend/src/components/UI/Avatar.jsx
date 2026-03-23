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
          avatar font-bold text-white select-none rounded-full transition-all duration-300
          ${SIZE_MAP[size] ?? SIZE_MAP.md}
          ${speaking
            ? 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)] trigger-pulse-ring'
            : 'avatar-ring shadow-[0_4px_12px_rgba(0,0,0,0.3)]'}
        `}
        style={avatarBg ? { backgroundColor: avatarBg } : undefined}
        aria-label={username}
      >
        {getInitials(username)}
      </div>

      {showDot && (
        <span
          className={`status-dot absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-obsidian-bg ${dotColor} shadow-[0_0_8px_currentColor]`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default Avatar;
