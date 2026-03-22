import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * ConfirmDialog — uses design-system shadow-modal token and
 * standardized btn-danger / btn-ghost for the action buttons.
 *
 * Props: open, title, message, confirmLabel, danger, onConfirm, onCancel
 */
const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-3xl animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      {/* Uses shadow-modal token defined in tailwind.config.js */}
      <div className="bg-[#0a0a0b]/95 backdrop-blur-3xl border border-white/5 p-6 w-full max-w-sm shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-slide-up">
        <div className="flex items-start gap-4 mb-5">
          <div className={`p-2.5  shrink-0 ${danger ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-amber-500'}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100 font-headline tracking-wide mb-1">{title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-headline">{message}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300  transition-colors font-headline tracking-wide">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 font-semibold  py-2.5 text-sm transition-all active:scale-[0.98]
              ${danger
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-glow-red/30'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] font-bold tracking-wide font-headline'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
