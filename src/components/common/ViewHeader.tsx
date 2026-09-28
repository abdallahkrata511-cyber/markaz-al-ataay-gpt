import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ViewHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  actionButton?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    color?: string;
  };
  extraActions?: React.ReactNode;
}

export const ViewHeader: React.FC<ViewHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconColor = 'text-[#FFAA47]',
  iconBgColor = 'bg-[#FFF4E8] dark:bg-[#153243]',
  actionButton,
  extraActions,
}) => {
  return (
    <div className="bg-white dark:bg-[#153243]/60 p-4 sm:p-5 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-display">
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-2xl ${iconBgColor} ${iconColor} flex items-center justify-center shrink-0 border border-amber-200/40 dark:border-white/10 shadow-xs`}
        >
          <Icon className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {extraActions}

        {actionButton && (
          <button
            type="button"
            onClick={actionButton.onClick}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFAA47] hover:bg-[#ff9f2c] active:scale-95 text-slate-950 font-black rounded-2xl shadow-md shadow-[#FFAA47]/20 transition text-xs sm:text-sm cursor-pointer"
          >
            {actionButton.icon && (
              <actionButton.icon className="w-4 h-4 stroke-[2.5]" />
            )}
            <span>{actionButton.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};
