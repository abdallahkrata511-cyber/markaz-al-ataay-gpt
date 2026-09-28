import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';

export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString())
    .replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString())
    .replace(/٫|,/g, '.');
}

interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  showStepper?: boolean;
  disabled?: boolean;
  id?: string;
  autoFocus?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  className = '',
  showStepper = false,
  disabled = false,
  id,
  autoFocus = false,
}) => {
  // Use text state to allow seamless typing, backspacing, and digit replacement
  const [textValue, setTextValue] = useState<string>(
    value !== undefined && value !== null && !isNaN(value) ? value.toString() : ''
  );
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const justFocusedRef = useRef<boolean>(false);

  // Synchronize when value changes externally AND user is not actively typing/focused
  useEffect(() => {
    if (!isFocused) {
      const currentParsed = parseFloat(normalizeArabicDigits(textValue));
      if (isNaN(currentParsed) || currentParsed !== value) {
        setTextValue(
          value !== undefined && value !== null && !isNaN(value) ? value.toString() : ''
        );
      }
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    justFocusedRef.current = true;
    // Auto select the entire text on focus for immediate replacement
    e.currentTarget.select();
    setTimeout(() => {
      inputRef.current?.select();
    }, 30);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    if (justFocusedRef.current) {
      e.preventDefault();
      justFocusedRef.current = false;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = normalizeArabicDigits(raw);

    // Filter to allow only numbers, minus (if min < 0), and single decimal dot
    let filtered = '';
    let hasDot = false;
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch >= '0' && ch <= '9') {
        filtered += ch;
      } else if (ch === '.' && !hasDot) {
        filtered += '.';
        hasDot = true;
      } else if (ch === '-' && i === 0 && (min === undefined || min < 0)) {
        filtered += '-';
      }
    }

    setTextValue(filtered);

    if (filtered === '' || filtered === '-') {
      onChange(0);
      return;
    }

    const parsed = parseFloat(filtered);
    if (!isNaN(parsed)) {
      // NOTE: Do NOT clamp min/max during typing so user can type multi-digit numbers freely!
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const normalized = normalizeArabicDigits(textValue.trim());
    if (normalized === '' || normalized === '-') {
      const defaultVal = min !== undefined ? Math.max(min, 0) : 0;
      setTextValue(defaultVal.toString());
      onChange(defaultVal);
      return;
    }

    let parsed = parseFloat(normalized);
    if (isNaN(parsed)) {
      parsed = min !== undefined ? Math.max(min, 0) : 0;
    } else {
      // Enforce bounds on blur only
      if (min !== undefined && parsed < min) {
        parsed = min;
      }
      if (max !== undefined && parsed > max) {
        parsed = max;
      }
    }

    // Format clean representation (avoid trailing dots)
    setTextValue(parsed.toString());
    onChange(parsed);
  };

  const handleIncrement = () => {
    const current = parseFloat(normalizeArabicDigits(textValue)) || 0;
    let next = current + step;
    if (step < 1) {
      next = Number(next.toFixed(2));
    }
    if (max !== undefined && next > max) return;
    onChange(next);
    setTextValue(next.toString());
  };

  const handleDecrement = () => {
    const current = parseFloat(normalizeArabicDigits(textValue)) || 0;
    let next = current - step;
    if (step < 1) {
      next = Number(next.toFixed(2));
    }
    if (min !== undefined && next < min) return;
    onChange(next);
    setTextValue(next.toString());
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {showStepper && (
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || (min !== undefined && value <= min)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed select-none border border-slate-200 dark:border-slate-700 shadow-xs"
          title="إنقاص"
          aria-label="إنقاص"
        >
          <Minus className="w-4 h-4" />
        </button>
      )}

      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        value={textValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full h-11 px-3 text-center text-base sm:text-lg font-bold font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 focus:border-blue-600 transition shadow-2xs"
      />

      {showStepper && (
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || (max !== undefined && value >= max)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 active:scale-95 transition disabled:opacity-30 disabled:cursor-not-allowed select-none border border-blue-200 dark:border-blue-800/60 shadow-xs"
          title="زيادة"
          aria-label="زيادة"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
