'use client';

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
  default: 'text-obsidian-on-surface-variant hover:text-obsidian-on-surface hover:bg-obsidian-primary/10 transition-all duration-200 shadow-sm hover:shadow-md',
  ghost:   'text-obsidian-on-surface-variant hover:text-obsidian-on-surface hover:bg-obsidian-primary/8 transition-all duration-200',
  primary: 'text-obsidian-primary hover:bg-obsidian-primary/15 hover:shadow-[0_0_15px_rgba(170,85,255,0.25)] transition-all duration-200',
  danger:  'text-red-500 hover:text-red-400 hover:bg-red-500/12 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] transition-all duration-200',
  success: 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/12 hover:shadow-[0_0_12px_rgba(16,185,129,0.2)] transition-all duration-200',
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
        inline-flex items-center justify-center shrink-0 rounded-lg
        transition-all duration-200 cubic-bezier(0.22, 1, 0.36, 1)
        hover:-translate-y-0.5 active:scale-95
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0
        ${sizeClass}
        ${variantClass}
        ${active ? 'ring-2 ring-obsidian-primary ring-offset-2 ring-offset-obsidian-bg shadow-[0_0_15px_rgba(170,85,255,0.4)]' : ''}
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
