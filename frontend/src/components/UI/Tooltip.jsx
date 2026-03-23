import { useState, useRef } from 'react';

/**
 * Lightweight Tooltip component.
 * Usage: <Tooltip text="Copy room code"><button>...</button></Tooltip>
 * 
 * Positioning: 'top' | 'bottom' | 'left' | 'right' (default: 'top')
 * Delay: ms before tooltip appears (default: 400)
 */
const Tooltip = ({ text, children, position = 'top', delay = 400, className = '' }) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  if (!text) return children;

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  const positionClasses = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top:    'top-full left-1/2 -translate-x-1/2 border-t-[#0a0a0b] border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#0a0a0b] border-x-transparent border-t-transparent',
    left:   'left-full top-1/2 -translate-y-1/2 border-l-[#0a0a0b] border-y-transparent border-r-transparent',
    right:  'right-full top-1/2 -translate-y-1/2 border-r-[#0a0a0b] border-y-transparent border-l-transparent',
  };

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {visible && (
        <div
          role="tooltip"
          className={`absolute z-[9999] pointer-events-none whitespace-nowrap
            px-3 py-2 text-[11px] font-semibold text-obsidian-on-surface
            bg-gradient-to-r from-obsidian-surface/95 to-obsidian-surface/90 backdrop-blur-xl border border-obsidian-primary/25 shadow-[0_8px_32px_rgba(170,85,255,0.2)] font-headline tracking-wide rounded-lg
            animate-fade-in
            ${positionClasses[position]}`}
        >
          {text}
          {/* Arrow */}
          <span
            className={`absolute border-4 ${arrowClasses[position]}`}
            style={{ borderTopColor: 'rgb(20 30 50 / 0.95)' }}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
