import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Receipt,
  ShoppingBag,
  Package,
  Users,
  Truck,
  WalletCards,
  Coins,
  Settings as SettingsIcon,
  TrendingUp,
  MoreHorizontal,
  X,
  Plus,
  ArrowDownLeft,
  ArrowDownUp,
  Handshake,
} from 'lucide-react';
import { ActiveTab } from '../../types';

interface BottomNavigationProps {
  currentTab?: ActiveTab;
  activeTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onChangeTab?: (tab: ActiveTab) => void;
  onOpenNewInvoice?: () => void;
  onOpenSettings?: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  currentTab,
  activeTab: propActiveTab,
  onSelectTab,
  onChangeTab,
  onOpenNewInvoice,
  onOpenSettings,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const active = currentTab || propActiveTab || 'dashboard';
  const handleTabChange = onSelectTab || onChangeTab || (() => {});

  // Primary tabs matching the 4 corners around the center + FAB button
  const leftTabs = [
    { id: 'dashboard' as ActiveTab, label: 'الرئيسية', icon: LayoutGrid },
    { id: 'sales' as ActiveTab, label: 'المبيعات', icon: Receipt },
  ];

  const rightTabs = [
    { id: 'products' as ActiveTab, label: 'المخزون', icon: Package },
    { id: 'purchases' as ActiveTab, label: 'المشتريات', icon: ShoppingBag },
  ];

  // Secondary sections inside "More" modal sheet
  const secondaryTabs = [
    {
      id: 'profits' as ActiveTab,
      label: 'قسم الأرباح وتحليل المبيعات',
      subtitle: 'أرباح اليوم، الشهر، وتكلفة البضاعة',
      icon: TrendingUp,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'cashbox' as ActiveTab,
      label: 'الصندوق وحركات النقد',
      subtitle: 'الأرصدة، السحوبات، والإيداعات',
      icon: WalletCards,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'usd_exchange' as ActiveTab,
      label: 'شراء وتصريف الدولار',
      subtitle: 'تحويل ليرات لدولار بسعر الصرف',
      icon: ArrowDownUp,
      color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    },
    {
      id: 'partners' as ActiveTab,
      label: 'الشركاء ورأس المال',
      subtitle: 'رأس المال 5,000 $ والمسحوبات',
      icon: Handshake,
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'customers' as ActiveTab,
      label: 'العملاء وحساباتهم',
      subtitle: 'ديون العملاء وسندات القبض',
      icon: Users,
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      id: 'suppliers' as ActiveTab,
      label: 'الموردون والمطالبات',
      subtitle: 'مستحقات الموردين وفواتير الشراء',
      icon: Truck,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      id: 'expenses' as ActiveTab,
      label: 'المصاريف التشغيلية',
      subtitle: 'الوقود، الإيجار، وتكاليف المركز',
      icon: Coins,
      color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    },
  ];

  const isCurrentInSecondary = secondaryTabs.some((t) => t.id === active);

  return (
    <>
      {/* Floating Bottom Bar (Exact design from the reference image) */}
      <div className="fixed bottom-3 inset-x-3 z-40 max-w-sm sm:max-w-md mx-auto pointer-events-none" dir="rtl">
        <nav
          className="pointer-events-auto bg-white/95 dark:bg-[#153243]/95 backdrop-blur-md rounded-[32px] px-3 py-2 shadow-xl shadow-slate-900/10 dark:shadow-black/30 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between transition-all"
        >
          {/* Left Tabs */}
          <div className="flex items-center gap-1 flex-1 justify-around">
            {leftTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    setIsQuickActionsOpen(false);
                    handleTabChange(tab.id);
                  }}
                  className="flex flex-col items-center justify-center w-14 py-1 rounded-2xl relative transition active:scale-90 cursor-pointer"
                >
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive
                        ? 'text-slate-900 dark:text-white stroke-[2.5] scale-110'
                        : 'text-slate-400 dark:text-slate-500 stroke-[1.8] hover:text-slate-700'
                    }`}
                  />
                  {/* Subtle active dot underneath icon (as seen in screenshot) */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-200 ${
                      isActive
                        ? 'bg-[#FFAA47] opacity-100 scale-100'
                        : 'bg-transparent opacity-0 scale-0'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Centered Glowing Amber Floating FAB with + */}
          <div className="relative px-1 -my-4">
            <button
              type="button"
              onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
              className="w-13 h-13 rounded-full bg-linear-to-tr from-[#F29426] to-[#FFAA47] hover:from-[#e8881b] hover:to-[#ff9d2e] text-slate-950 flex items-center justify-center shadow-lg shadow-[#FFAA47]/40 border-[3.5px] border-[#F6F8FA] dark:border-[#0E1A22] transition-all duration-200 active:scale-90 hover:scale-105 cursor-pointer z-10"
              aria-label="إضافة عملية جديدة"
            >
              <Plus
                className={`w-6 h-6 text-white stroke-[3] transition-transform duration-300 ${
                  isQuickActionsOpen ? 'rotate-45' : 'rotate-0'
                }`}
              />
            </button>
          </div>

          {/* Right Tabs + More Button */}
          <div className="flex items-center gap-1 flex-1 justify-around">
            {rightTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = active === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    setIsQuickActionsOpen(false);
                    handleTabChange(tab.id);
                  }}
                  className="flex flex-col items-center justify-center w-14 py-1 rounded-2xl relative transition active:scale-90 cursor-pointer"
                >
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive
                        ? 'text-slate-900 dark:text-white stroke-[2.5] scale-110'
                        : 'text-slate-400 dark:text-slate-500 stroke-[1.8] hover:text-slate-700'
                    }`}
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-200 ${
                      isActive
                        ? 'bg-[#FFAA47] opacity-100 scale-100'
                        : 'bg-transparent opacity-0 scale-0'
                    }`}
                  />
                </button>
              );
            })}

            {/* More Menu */}
            <button
              type="button"
              onClick={() => {
                setIsQuickActionsOpen(false);
                setIsMoreOpen(!isMoreOpen);
              }}
              className="flex flex-col items-center justify-center w-14 py-1 rounded-2xl relative transition active:scale-90 cursor-pointer"
            >
              <MoreHorizontal
                className={`w-5 h-5 transition-transform duration-200 ${
                  isMoreOpen || isCurrentInSecondary
                    ? 'text-slate-900 dark:text-white stroke-[2.5] scale-110'
                    : 'text-slate-400 dark:text-slate-500 stroke-[1.8] hover:text-slate-700'
                }`}
              />
              <span
                className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all duration-200 ${
                  isMoreOpen || isCurrentInSecondary
                    ? 'bg-[#FFAA47] opacity-100 scale-100'
                    : 'bg-transparent opacity-0 scale-0'
                }`}
              />
            </button>
          </div>
        </nav>
      </div>

      {/* Quick Action Sheet triggered by the Center (+) FAB button */}
      <AnimatePresence>
        {isQuickActionsOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center transition-all p-3"
            onClick={() => setIsQuickActionsOpen(false)}
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-sm bg-white dark:bg-[#153243] rounded-[32px] p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 mb-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFAA47] animate-pulse" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    عملية سريعة جديدة
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickActionsOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Sale */}
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    handleTabChange('sales');
                    if (onOpenNewInvoice) onOpenNewInvoice();
                  }}
                  className="p-4 rounded-2xl bg-[#FFF4E8] dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 flex flex-col items-center text-center gap-2 transition active:scale-95 cursor-pointer hover:shadow-xs"
                >
                  <div className="w-10 h-10 rounded-full bg-[#FFAA47] text-slate-950 flex items-center justify-center shadow-xs">
                    <Receipt className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-display">
                    فاتورة بيع
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    تسجيل طلبية لمحل
                  </span>
                </button>

                {/* Purchase */}
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    handleTabChange('purchases');
                  }}
                  className="p-4 rounded-2xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/50 flex flex-col items-center text-center gap-2 transition active:scale-95 cursor-pointer hover:shadow-xs"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs">
                    <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-display">
                    فاتورة شراء
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    توريد من المطاحن
                  </span>
                </button>

                {/* Customer Payment */}
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    handleTabChange('customers');
                  }}
                  className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 flex flex-col items-center text-center gap-2 transition active:scale-95 cursor-pointer hover:shadow-xs"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-display">
                    سند قبض
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    تحصيل دفعة نقدية
                  </span>
                </button>

                {/* Expense */}
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    handleTabChange('expenses');
                  }}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col items-center text-center gap-2 transition active:scale-95 cursor-pointer hover:shadow-xs"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-xs">
                    <Coins className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-display">
                    مصروف تشغيلي
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    تسجيل نفقة أو وقود
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* "More" Sections Drawer Sheet */}
      <AnimatePresence>
        {isMoreOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center transition-all p-3"
            onClick={() => setIsMoreOpen(false)}
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-sm bg-white dark:bg-[#153243] rounded-[32px] p-5 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 mb-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FFAA47]" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    باقي الأقسام والإدارة
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {secondaryTabs.map((t) => {
                  const Icon = t.icon;
                  const isSelected = active === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        handleTabChange(t.id);
                      }}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition active:scale-98 cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFF4E8] dark:bg-amber-950/40 border-[#FFAA47] dark:border-[#FFAA47]/60 shadow-2xs'
                          : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#FFAA47] text-slate-950 font-bold'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-900 dark:text-white font-display">
                            {t.label}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {t.subtitle}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                          النشط
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition active:scale-95 cursor-pointer font-display"
                  >
                    <SettingsIcon className="w-4 h-4 text-[#FFAA47]" />
                    <span>إعدادات المركز وطابعة البلوتوث والنسخ الاحتياطي</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
