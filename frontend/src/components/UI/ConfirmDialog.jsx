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
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-gradient-to-br from-black/90 to-obsidian-bg/80 backdrop-blur-3xl animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      {/* Premium glass panel modal */}
      <div className="glass-panel p-6 w-full max-w-sm shadow-[0_20px_60px_rgba(170,85,255,0.15)] animate-slide-up rounded-2xl border border-obsidian-primary/25">
        <div className="flex items-start gap-4 mb-5">
          <div className={`p-3 shrink-0 rounded-lg ${danger ? 'bg-gradient-to-br from-red-500/20 to-red-500/10' : 'bg-gradient-to-br from-amber-500/20 to-amber-500/10'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-obsidian-on-surface font-headline tracking-wide mb-1">{title}</h3>
            <p className="text-sm text-obsidian-on-surface-variant leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 text-sm">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 font-semibold py-2.5 text-sm transition-all active:scale-[0.98] rounded-xl
              ${danger
                ? 'btn-danger'
                : 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-[0_0_20px_rgba(251,146,60,0.3)] font-bold tracking-wide font-headline hover:-translate-y-1'
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
