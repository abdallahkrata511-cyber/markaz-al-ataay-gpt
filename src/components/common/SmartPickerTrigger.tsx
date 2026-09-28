import React from 'react';
import { Search, ChevronDown, X, CheckCircle2 } from 'lucide-react';

interface SmartPickerTriggerProps {
  label?: string;
  placeholder?: string;
  selectedTitle?: string;
  selectedSubtitle?: string;
  selectedBadge?: string;
  onClick: () => void;
  onClear?: () => void;
  disabled?: boolean;
  required?: boolean;
}

export const SmartPickerTrigger: React.FC<SmartPickerTriggerProps> = ({
  label,
  placeholder = 'اضغط للبحث والاختيار...',
  selectedTitle,
  selectedSubtitle,
  selectedBadge,
  onClick,
  onClear,
  disabled = false,
  required = false,
}) => {
  const isSelected = Boolean(selectedTitle);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {isSelected ? (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700 transition">
          <div
            onClick={disabled ? undefined : onClick}
            className={`flex-1 min-w-0 ${disabled ? '' : 'cursor-pointer'}`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                {selectedTitle}
              </span>
              {selectedBadge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                  {selectedBadge}
                </span>
              )}
            </div>
            {selectedSubtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate pr-6">
                {selectedSubtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                title="إلغاء التحديد"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClick}
              disabled={disabled}
              className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-slate-700 rounded-lg transition"
            >
              تغيير
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="w-full h-12 px-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 flex items-center justify-between gap-2 text-slate-400 dark:text-slate-500 text-sm font-semibold transition active:scale-[0.99] shadow-xs"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">{placeholder}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
      )}
    </div>
  );
};
