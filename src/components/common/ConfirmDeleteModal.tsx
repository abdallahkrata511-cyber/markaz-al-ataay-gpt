import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemName?: string;
  warningDetails?: string;
  description?: string;
  confirmButtonText?: string;
  confirmText?: string;
  cancelButtonText?: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'تأكيد الحذف',
  itemName,
  warningDetails,
  description,
  confirmButtonText,
  confirmText,
  cancelButtonText = 'إلغاء',
}) => {
  const displayDetails = warningDetails || description || 'لا يمكن التراجع عن هذه العملية بعد التأكيد.';
  const displayConfirmText = confirmButtonText || confirmText || 'نعم، حذف';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60">
          <div className="p-2 bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 rounded-lg shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-right">
            <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
              هل تريد حذف هذا العنصر؟
            </h4>
            {itemName && (
              <p className="text-xs font-bold text-red-700 dark:text-red-400">
                {itemName}
              </p>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {displayDetails}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm transition"
          >
            {cancelButtonText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>{displayConfirmText}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
