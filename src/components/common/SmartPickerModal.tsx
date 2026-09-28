import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Check, ArrowRight, Sparkles } from 'lucide-react';

/**
 * Normalizes Arabic text for flexible and tolerant search matching:
 * - Unifies alef forms: أ, إ, آ, ٱ -> ا
 * - Unifies teh marbuta: ة -> ه
 * - Unifies alif maqsura / yaa: ى, ي -> ي
 * - Unifies hamza: ئ, ؤ -> ء
 * - Removes Arabic diacritics (harakat / tashkeel)
 * - Converts Arabic-Indic digits (٠-٩) to standard (0-9)
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[\u064B-\u065F\u0670]/g, '') // Tashkeel
    .replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString())
    .replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString());
}

export interface SmartPickerItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'slate';
  extraInfo?: string;
  searchText?: string[];
}

interface SmartPickerModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  placeholder?: string;
  items: T[];
  selectedId?: string;
  getSearchTerms: (item: T) => string[];
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  getItemId: (item: T) => string;
  getItemTitle: (item: T) => string;
  getItemSubtitle?: (item: T) => string | undefined;
  getItemBadge?: (item: T) => { text: string; color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'slate' } | undefined;
  onSelect: (item: T) => void;
  emptyMessage?: string;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

export function SmartPickerModal<T>({
  isOpen,
  onClose,
  title,
  placeholder = '🔍 اكتب أول حرف أو اسم العنصر للبحث الفوري...',
  items,
  selectedId,
  getSearchTerms,
  renderItem,
  getItemId,
  getItemTitle,
  getItemSubtitle,
  getItemBadge,
  onSelect,
  emptyMessage = 'لا توجد نتائج مطابقة لبحثك',
  actionButton,
}: SmartPickerModalProps<T>) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Instant Arabic normalized matching
  const filteredItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // If list is small (< 15 items), show all. If large, show first 12 items
      return items.slice(0, 15);
    }

    const normQuery = normalizeArabic(trimmed);
    const queryTokens = normQuery.split(/\s+/).filter(Boolean);

    return items.filter((item) => {
      const terms = getSearchTerms(item).map(normalizeArabic).join(' ');
      // Check that every query word appears in the combined terms
      return queryTokens.every((token) => terms.includes(token));
    });
  }, [items, query, getSearchTerms]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition"
              title="إغلاق والعودة"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                {title}
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {items.length} عنصر متوفر • بحث ذكي فوري
              </span>
            </div>
          </div>

          {actionButton && (
            <button
              type="button"
              onClick={() => {
                onClose();
                actionButton.onClick();
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white active:scale-95 transition"
            >
              {actionButton.label}
            </button>
          )}
        </div>

        {/* Live Search Input Box */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 absolute right-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full h-12 pr-11 pl-10 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 rounded-2xl text-sm font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-hidden transition shadow-inner"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="w-8 h-8 flex items-center justify-center absolute left-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="مسح البحث"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick helper tag */}
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400 dark:text-slate-500">
            <span>
              {query.trim()
                ? `النتائج المطابقة: ${filteredItems.length}`
                : items.length > 15
                ? 'اكتب حرفاً أو كلمة للبحث الفوري'
                : `جميع العناصر (${items.length})`}
            </span>
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-3 h-3" />
              <span>بحث يدعم تطبيع الأحرف العربية</span>
            </span>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-transparent">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <Search className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
              <p className="text-sm font-bold">{emptyMessage}</p>
              <p className="text-xs text-slate-400">
                جرب البحث بجزء آخر من الاسم أو الرقم
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const id = getItemId(item);
              const isSelected = selectedId === id;

              if (renderItem) {
                return (
                  <div
                    key={id}
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className="cursor-pointer"
                  >
                    {renderItem(item, isSelected)}
                  </div>
                );
              }

              const titleText = getItemTitle(item);
              const subtitleText = getItemSubtitle ? getItemSubtitle(item) : undefined;
              const badge = getItemBadge ? getItemBadge(item) : undefined;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className={`w-full text-right p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {titleText}
                      </span>
                      {badge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            badge.color === 'emerald'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : badge.color === 'amber'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                              : badge.color === 'purple'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                          }`}
                        >
                          {badge.text}
                        </span>
                      )}
                    </div>
                    {subtitleText && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                        {subtitleText}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isSelected ? (
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer with close button */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            إلغاء والعودة
          </button>
        </div>
      </div>
    </div>
  );
}
