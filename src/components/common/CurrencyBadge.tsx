import React from 'react';
import { Currency } from '../../types';

interface CurrencyBadgeProps {
  amount: number;
  currency: Currency;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSymbol?: boolean;
}

export const CurrencyBadge: React.FC<CurrencyBadgeProps> = ({
  amount,
  currency,
  className = '',
  size = 'md',
  showSymbol = true,
}) => {
  const isUSD = currency === 'USD';

  // Strict visual requirement: USD green, SYP blue
  const colorStyles = isUSD
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : 'text-blue-700 bg-blue-50 border-blue-200';

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 rounded font-semibold',
    md: 'text-sm px-2.5 py-1 rounded-md font-bold',
    lg: 'text-base px-3 py-1.5 rounded-lg font-extrabold',
    xl: 'text-xl sm:text-2xl px-3.5 py-2 rounded-xl font-black',
  }[size];

  const formattedAmount = (amount || 0).toLocaleString('en-US', {
    maximumFractionDigits: isUSD ? 2 : 0,
    minimumFractionDigits: 0,
  });

  const currencyLabel = isUSD ? '$ (دولار)' : 'ل.س';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border ${colorStyles} ${sizeStyles} ${className} whitespace-nowrap`}
      dir="ltr"
    >
      <span className="font-mono tracking-tight">{formattedAmount}</span>
      {showSymbol && <span className="text-[0.85em] font-sans opacity-90">{currencyLabel}</span>}
    </span>
  );
};
