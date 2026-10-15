import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  variant?: 'danger' | 'warning';
  confirmVariant?: 'danger' | 'warning' | string;
  zIndex?: string;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmText,
  variant,
  confirmVariant,
  zIndex = 'z-[2000]',
  isLoading = false,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = isLoading || internalLoading;
  const effectiveVariant = variant || (confirmVariant === 'warning' ? 'warning' : 'danger');
  const label = confirmText || confirmLabel || 'Confirm';
  const confirmColors = effectiveVariant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-amber-600 hover:bg-amber-700 text-white';

  const handleConfirm = async () => {
    setInternalLoading(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error(err);
    } finally {
      setInternalLoading(false);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="" size="sm" zIndex={zIndex}>
      <div className="text-center py-4">
        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${effectiveVariant === 'danger' ? 'bg-red-100' : 'bg-amber-100'}`}>
          <AlertTriangle size={24} className={effectiveVariant === 'danger' ? 'text-red-600' : 'text-amber-600'} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={loading} className={`px-4 py-2 rounded-md text-sm font-medium ${confirmColors} disabled:opacity-50`}>
            {loading ? 'Processing...' : label}
          </button>
        </div>
      </div>
    </Modal>
  );
}
