import React, { useState } from 'react';
import {
  Settings,
  Check,
  Store,
  LayoutDashboard,
  TrendingUp,
  Package,
  ShoppingBag,
  Receipt,
  Users,
  Truck,
  WalletCards,
  Coins,
  Sun,
  Moon,
  ArrowDownUp,
  Handshake,
} from 'lucide-react';
import { AppSettings, ActiveTab } from '../../types';

import { normalizeArabicDigits } from '../common/NumberInput';

interface NavbarProps {
  settings: AppSettings;
  currentTab?: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onUpdateSettings?: (newSettings: AppSettings) => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  currentTab = 'dashboard',
  onSelectTab,
  onUpdateSettings,
  onOpenSettings,
}) => {
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRate, setTempRate] = useState(settings.exchangeRate.toString());

  const handleSaveRate = () => {
    const clean = normalizeArabicDigits(tempRate.trim());
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0 && onUpdateSettings) {
      onUpdateSettings({ ...settings, exchangeRate: num });
    }
    setIsEditingRate(false);
  };

  const handleToggleBaseCurrency = () => {
    if (!onUpdateSettings) return;
    const newBase = settings.baseCurrency === 'SYP' ? 'USD' : 'SYP';
    onUpdateSettings({ ...settings, baseCurrency: newBase });
  };

  const isDarkMode = settings.themeMode === 'dark';

  const handleToggleDarkMode = () => {
    if (!onUpdateSettings) return;
    const nextMode = isDarkMode ? 'light' : 'dark';
    onUpdateSettings({ ...settings, themeMode: nextMode });
  };

  const navTabs = [
    { id: 'dashboard' as ActiveTab, label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'profits' as ActiveTab, label: 'الأرباح', icon: TrendingUp },
    { id: 'sales' as ActiveTab, label: 'المبيعات', icon: Receipt },
    { id: 'purchases' as ActiveTab, label: 'المشتريات', icon: ShoppingBag },
    { id: 'products' as ActiveTab, label: 'المخزون', icon: Package },
    { id: 'cashbox' as ActiveTab, label: 'الصندوق', icon: WalletCards },
    { id: 'usd_exchange' as ActiveTab, label: 'شراء دولار', icon: ArrowDownUp },
    { id: 'partners' as ActiveTab, label: 'الشركاء', icon: Handshake },
    { id: 'customers' as ActiveTab, label: 'العملاء', icon: Users },
    { id: 'suppliers' as ActiveTab, label: 'الموردون', icon: Truck },
    { id: 'expenses' as ActiveTab, label: 'المصاريف', icon: Coins },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#153243] text-white shadow-md border-b border-[#1b3f54] font-display">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Brand Logo & Name + Prominent Exchange Rate Box (Requirement 1) */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FFAA47] flex items-center justify-center text-slate-950 shadow-md shadow-[#FFAA47]/20 shrink-0">
              <Store className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight truncate font-display">
                {settings.centerName}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="flex items-center gap-1 text-emerald-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  قاعدة بيانات محلية Offline
                </span>
              </div>
            </div>

            {/* Prominent Exchange Rate Box beside Brand Name */}
            <div className="bg-[#0f2430]/90 border border-[#FFAA47]/40 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-xs shadow-inner">
              <span className="text-slate-300 text-[11px] font-medium hidden sm:inline">سعر الصرف:</span>
              <span className="text-[#FFAA47] font-bold">1 USD =</span>
              {isEditingRate ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRate()}
                    autoFocus
                    className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold bg-slate-900 text-white border border-[#FFAA47] rounded-lg text-center"
                  />
                  <button
                    onClick={handleSaveRate}
                    className="p-1 bg-[#FFAA47] hover:bg-[#ff9f2c] text-slate-950 font-bold rounded-lg cursor-pointer"
                    title="حفظ"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempRate(settings.exchangeRate.toString());
                    setIsEditingRate(true);
                  }}
                  className="font-bold text-white hover:text-[#FFAA47] transition flex items-center gap-1 font-display cursor-pointer"
                  title="انقر لتعديل سعر الصرف"
                >
                  <span className="font-mono text-sm">{settings.exchangeRate.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-300 font-medium">SYP</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          {onSelectTab && (
            <nav className="hidden xl:flex items-center gap-1 bg-[#0f2430]/70 p-1.5 rounded-2xl border border-white/10">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#FFAA47] text-slate-950 shadow-sm font-black'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Quick Actions & Rate Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Quick Exchange Rate badge */}
            <div className="bg-[#0f2430]/80 border border-white/10 rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-xs">
              <span className="text-slate-300 font-medium hidden sm:inline font-display">الصرف:</span>
              <span className="text-[#FFAA47] font-bold">$1 =</span>
              {isEditingRate ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRate()}
                    autoFocus
                    className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold bg-slate-900 text-white border border-[#FFAA47] rounded-lg text-center"
                  />
                  <button
                    onClick={handleSaveRate}
                    className="p-1 bg-[#FFAA47] hover:bg-[#ff9f2c] text-slate-950 font-bold rounded-lg"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempRate(settings.exchangeRate.toString());
                    setIsEditingRate(true);
                  }}
                  className="font-bold text-white hover:text-[#FFAA47] transition flex items-center gap-1 font-display"
                  title="تعديل سعر الصرف"
                >
                  <span>{settings.exchangeRate.toLocaleString('en-US')} ل.س</span>
                  <span className="text-[10px] text-slate-300">✎</span>
                </button>
              )}
            </div>

            {/* Base Currency toggle */}
            {onUpdateSettings && (
              <button
                type="button"
                onClick={handleToggleBaseCurrency}
                className="px-2 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1 bg-[#0f2430]/80 border-white/10 hover:bg-white/10 cursor-pointer"
                title="تغيير العملة الأساسية للحسابات"
              >
                <span className={settings.baseCurrency === 'USD' ? 'text-emerald-400' : 'text-[#FFAA47]'}>
                  {settings.baseCurrency === 'USD' ? '$' : 'ل.س'}
                </span>
              </button>
            )}

            {/* Dark / Light mode toggle */}
            {onUpdateSettings && (
              <button
                type="button"
                onClick={handleToggleDarkMode}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title={isDarkMode ? 'التحويل إلى الوضع الفاتح' : 'التحويل إلى الوضع الليلي'}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-[#FFAA47]" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-300" />
                )}
              </button>
            )}

            {/* Settings button */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="الإعدادات والنسخ الاحتياطي"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
