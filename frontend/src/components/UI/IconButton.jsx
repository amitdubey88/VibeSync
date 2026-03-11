/**
 * IconButton — standardized icon-only button.
 *
 * Replaces the pattern: className="btn-icon text-white w-8 h-8 ..."
 * used inconsistently across VideoControls and VoiceControls.
 *
 * Props:
 *  icon      – React element (pass the lucide icon JSX)
 *  onClick   – handler
 *  title     – accessible label (required for a11y)
 *  variant   – 'default' | 'danger' | 'success' | 'primary' | 'ghost'
 *  size      – 'sm' | 'md' | 'lg'    (default: 'md')
 *  active    – boolean — applies active variant ring
 *  disabled  – boolean
 *  className – extra classes
 */

const SIZE_MAP = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
};

const ICON_SIZE = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const VARIANT_MAP = {
  default: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
  ghost:   'text-white/70 hover:text-white hover:bg-white/10',
  primary: 'text-accent-purple hover:bg-accent-purple/15',
  danger:  'text-red-400/80 hover:text-red-400 hover:bg-red-500/10',
  success: 'text-accent-green/80 hover:text-accent-green hover:bg-accent-green/10',
};

const IconButton = ({
  icon,
  onClick,
  title,
  variant = 'default',
  size = 'md',
  active = false,
  disabled = false,
  className = '',
  type = 'button',
}) => {
  const variantClass = VARIANT_MAP[variant] ?? VARIANT_MAP.default;
  const sizeClass = SIZE_MAP[size] ?? SIZE_MAP.md;
  const iconClass = ICON_SIZE[size] ?? ICON_SIZE.md;

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={title}
      className={`
        inline-flex items-center justify-center rounded-lg shrink-0
        transition-all duration-150
        hover:-translate-y-px active:scale-90
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0
        ${sizeClass}
        ${variantClass}
        ${active ? 'ring-2 ring-current ring-offset-1 ring-offset-bg-card' : ''}
        ${className}
      `}
    >
      {/* Clone icon with standardized size */}
      {icon && typeof icon === 'object'
        ? <span className={iconClass}>{icon}</span>
        : icon}
    </button>
  );
};

export default IconButton;
