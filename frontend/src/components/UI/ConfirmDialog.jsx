import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * Reusable full-screen confirmation dialog portal.
 * Usage:
 *   <ConfirmDialog
 *     open={showConfirm}
 *     title="Remove user?"
 *     message="This will kick them from the room."
 *     confirmLabel="Remove"
 *     danger
 *     onConfirm={handleConfirm}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */
const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) => {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="glass rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
        <div className="flex items-start gap-4 mb-5">
          <div className={`p-2.5 rounded-xl shrink-0 ${danger ? 'bg-red-500/15' : 'bg-accent-yellow/15'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-accent-yellow'}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary mb-1">{title}</h3>
            <p className="text-sm text-text-muted">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 btn-ghost"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 font-semibold rounded-xl py-2.5 text-sm transition-all
              ${danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-accent-yellow hover:bg-accent-yellow/90 text-black'
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
