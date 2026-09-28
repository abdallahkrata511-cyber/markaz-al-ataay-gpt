import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet,
  Share2,
  Download,
  DollarSign,
  Coins,
  Store,
  Truck,
  Package,
  Users,
  CheckCircle2,
  RefreshCw,
  X,
  TrendingUp,
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import { AppSettings, DailyInventoryAudit } from '../../types';
import { LocalDatabase } from '../../services/db';
import { shareInventoryAuditPdf, saveInventoryAuditPdfLocally } from '../../services/pdfExport';

interface DailyInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsUpdate?: (newSettings: AppSettings) => void;
}

export const DailyInventoryModal: React.FC<DailyInventoryModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsUpdate,
}) => {
  const [exchangeRate, setExchangeRate] = useState<number>(settings.exchangeRate || 15000);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<
    'summary' | 'reconciliation' | 'inventory' | 'customers' | 'suppliers' | 'partners'
  >('summary');
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Compute live audit as of chosen date and rate
  const audit: DailyInventoryAudit = LocalDatabase.getDailyInventoryAudit(exchangeRate, asOfDate);
  const cashBoxSummary = LocalDatabase.getCashBoxSummary();

  const handleUpdateExchangeRate = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings = {
      ...settings,
      exchangeRate: exchangeRate,
    };
    LocalDatabase.saveSettings(updatedSettings);
    if (onSettingsUpdate) {
      onSettingsUpdate(updatedSettings);
    }
    setIsEditingRate(false);
  };

  const handleSharePdf = async () => {
    setIsSharingPdf(true);
    setShareSuccess(null);
    setActionError(null);
    try {
      const res = await shareInventoryAuditPdf(audit, settings, asOfDate);
      if (res.success) {
        setShareSuccess('تم إنشاء ومشاركة تقرير الجرد بنجاح ✓');
        setTimeout(() => setShareSuccess(null), 4000);
      } else {
        setActionError(res.error || 'حدث خطأ أثناء إنشاء PDF');
        setTimeout(() => setActionError(null), 5000);
      }
    } catch (err: any) {
      console.error(err);
      setActionError('تعذر إنشاء التقرير');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handleSavePdf = async () => {
    setIsSavingPdf(true);
    setShareSuccess(null);
    setActionError(null);
    try {
      const res = await saveInventoryAuditPdfLocally(audit, settings, asOfDate);
      if (res.success) {
        setShareSuccess('تم تحميل وحفظ تقرير الجرد بنجاح ✓');
        setTimeout(() => setShareSuccess(null), 4000);
      } else {
        setActionError(res.error || 'حدث خطأ أثناء حفظ PDF');
        setTimeout(() => setActionError(null), 5000);
      }
    } catch (err: any) {
      console.error(err);
      setActionError('تعذر حفظ التقرير');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setIsSavingPdf(false);
    }
  };

  const isToday = asOfDate === new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto font-display">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[94vh]"
      >
        {/* Modal Header */}
        <div className="bg-[#153243] text-white p-5 sm:p-6 shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-48 h-48 rounded-full bg-[#FFAA47]/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FFAA47] text-slate-950 flex items-center justify-center shadow-md">
                <FileSpreadsheet className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  الجرد اليومي والمركز المالي (Jard)
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  صورة شاملة للأصول، الصندوق، الديون، ومطابقة المشروع
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePdf}
                disabled={isSavingPdf || isSharingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer border border-white/10"
                title="تحميل التقرير كملف PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isSavingPdf ? 'جاري الحفظ...' : 'حفظ PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handleSharePdf}
                disabled={isSharingPdf || isSavingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFAA47] hover:bg-[#ff9f2c] text-slate-950 text-xs font-bold transition cursor-pointer shadow-sm"
                title="مشاركة التقرير عبر واتساب أو التطبيقات"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{isSharingPdf ? 'جاري التصدير...' : 'مشاركة PDF'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Controls Bar: Date Selector & Exchange Rate */}
          <div className="relative z-10 mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Date selector (Requirement 16) */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#FFAA47]" />
              <span className="text-slate-300">تاريخ الجرد:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="px-2.5 py-1 rounded-xl bg-slate-900/80 text-white text-xs border border-slate-700 focus:outline-none focus:border-[#FFAA47] font-mono"
              />
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setAsOfDate(new Date().toISOString().slice(0, 10))}
                  className="px-2 py-0.5 rounded-lg bg-emerald-900/50 text-emerald-300 text-[10px] font-bold border border-emerald-700/50 hover:bg-emerald-800 transition cursor-pointer"
                >
                  العودة لليوم
                </button>
              )}
            </div>

            {/* Rate adjuster */}
            <div className="flex items-center gap-2">
              <span className="text-slate-300">سعر الصرف للجرد:</span>
              {!isEditingRate ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#FFAA47] text-sm font-mono">
                    1$ = {exchangeRate.toLocaleString()} ل.س
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingRate(true)}
                    className="text-[11px] underline text-slate-300 hover:text-white cursor-pointer"
                  >
                    تعديل
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUpdateExchangeRate} className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value))}
                    className="w-24 px-2 py-0.5 rounded-lg bg-slate-800 text-white text-xs border border-slate-600 focus:outline-none focus:border-[#FFAA47]"
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 bg-[#FFAA47] text-slate-950 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    تطبيق
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Share Alert */}
        {shareSuccess && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 text-center text-xs text-emerald-700 dark:text-emerald-300 font-bold border-b border-emerald-200 dark:border-emerald-900 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{shareSuccess}</span>
          </div>
        )}

        {/* Error Alert */}
        {actionError && (
          <div className="bg-red-50 dark:bg-red-950/60 p-2.5 text-center text-xs text-red-700 dark:text-red-300 font-bold border-b border-red-200 dark:border-red-900 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`py-2 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            ملخص الجرد الكلي
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reconciliation')}
            className={`py-2 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'reconciliation'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-blue-600" />
            <span>مطابقة المشروع</span>
            {audit.reconciliation.unexplainedDifferenceUSD !== 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`py-2 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inventory'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-amber-600" />
            <span>المخزون والعملات ({audit.totalProductsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`py-2 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            ديون العملاء ({audit.customerDebtsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`py-2 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'suppliers'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            ديون الموردين ({audit.supplierDebtsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('partners')}
            className={`py-2 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'partners'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            الشريك وعبدالله
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <>
              {/* Primary 3 Cards: Cash SYP, Cash USD, Warehouse Products */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Cash SYP */}
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                  <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-1">
                    <span className="text-xs font-bold">رصيد الليرة السورية كاش</span>
                    <Coins className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-900 dark:text-emerald-100">
                    {audit.cashSYP.toLocaleString('en-US')}{' '}
                    <span className="text-xs font-normal text-emerald-700 dark:text-emerald-300">ل.س</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                    ~ ${(audit.cashSYP / exchangeRate).toFixed(1)} دولار (قيمة تحويلية)
                  </div>
                </div>

                {/* 2. Cash USD */}
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
                  <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 mb-1">
                    <span className="text-xs font-bold">رصيد الدولار كاش</span>
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-blue-900 dark:text-blue-100">
                    ${audit.cashUSD.toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
                    ~ {(audit.cashUSD * exchangeRate).toLocaleString('en-US')} ل.س
                  </div>
                </div>

                {/* 3. Warehouse Inventory at Cost */}
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                  <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 mb-1">
                    <span className="text-xs font-bold">بضاعة المستودع (بسعر التكلفة)</span>
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-amber-900 dark:text-amber-100">
                    ${Math.round(audit.totalInventoryInUSD).toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    {audit.totalProductsCount} أصناف ({audit.totalPiecesCount.toLocaleString()} قطعة)
                  </div>
                </div>
              </div>

              {/* Debts Summary Card: Customer Debts vs Supplier Debts */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  الذمم والديون المتبقية (ثنائي العملة)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customers (لنا) */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-700 dark:text-sky-400">
                        ديون العملاء الإجمالية (لنا)
                      </span>
                      <Store className="w-4 h-4 text-sky-600" />
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {audit.customerDebtSYP.toLocaleString('en-US')}{' '}
                        <span className="text-xs font-normal text-slate-500">ل.س</span>
                      </div>
                      <div className="text-sm font-bold text-sky-600 dark:text-sky-400">
                        + ${audit.customerDebtUSD.toLocaleString('en-US')} دولار
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white flex justify-between">
                      <span>الإجمالي مقوّماً بالدولار:</span>
                      <span className="font-mono">${Math.round(audit.customerDebtsInUSD).toLocaleString('en-US')}</span>
                    </div>
                  </div>

                  {/* Suppliers (علينا) */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">
                        ديون الموردين والمطالبات (علينا)
                      </span>
                      <Truck className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        {audit.supplierDebtSYP.toLocaleString('en-US')}{' '}
                        <span className="text-xs font-normal text-slate-500">ل.س</span>
                      </div>
                      <div className="text-sm font-bold text-red-600 dark:text-red-400">
                        + ${audit.supplierDebtUSD.toLocaleString('en-US')} دولار
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-red-600 dark:text-red-400 flex justify-between">
                      <span>الإجمالي مقوّماً بالدولار:</span>
                      <span className="font-mono">${Math.round(audit.supplierDebtsInUSD).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirement 14: Comprehensive 16-Point Financial Audit Card */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>تقرير التدقيق المالي والجرد الشامل (16 بنداً محاسبياً)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      يستخدم سعر الصرف الحالي للتقييم الحالي فقط • أسعار الحركات التاريخية محفوظة دائماً
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-bold">
                    1$ = {exchangeRate.toLocaleString('en-US')} ل.س
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* 1. SYP Cash */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">1. نقدية الليرة السورية (SYP cash):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{audit.cashSYP.toLocaleString('en-US')} ل.س</span>
                  </div>

                  {/* 2. USD Cash */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">2. نقدية الدولار (USD cash):</span>
                    <span className="font-mono font-bold text-blue-600">${audit.cashUSD.toLocaleString('en-US')}</span>
                  </div>

                  {/* 3. Current USD Value of Cash */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">3. القيمة الحالية للنقدية بالدولار:</span>
                    <span className="font-mono font-bold text-emerald-600">${(audit.cashUSD + (exchangeRate > 0 ? audit.cashSYP / exchangeRate : 0)).toFixed(2)}</span>
                  </div>

                  {/* 4. Inventory */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">4. كميات المخزون (Inventory):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{audit.totalProductsCount} أصناف ({audit.totalPiecesCount.toLocaleString('en-US')} قطعة)</span>
                  </div>

                  {/* 5. Inventory Value */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">5. قيمة المخزون (Inventory value):</span>
                    <span className="font-mono font-bold text-amber-600">${Math.round(audit.totalInventoryInUSD).toLocaleString('en-US')}</span>
                  </div>

                  {/* 6. Customer Receivables */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">6. ديون العملاء (Customer receivables):</span>
                    <span className="font-mono font-bold text-sky-600">${Math.round(audit.customerDebtsInUSD).toLocaleString('en-US')}</span>
                  </div>

                  {/* 7. Supplier Payables */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">7. ديون الموردين (Supplier payables):</span>
                    <span className="font-mono font-bold text-red-600">${Math.round(audit.supplierDebtsInUSD).toLocaleString('en-US')}</span>
                  </div>

                  {/* 8. Partner Capital */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">8. رأس مال الشريك (Partner capital):</span>
                    <span className="font-mono font-bold text-purple-600">${audit.partnerSummary.totalCapitalUSD.toLocaleString('en-US')}</span>
                  </div>

                  {/* 9. Abdullah Cash Withdrawals */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">9. مسحوبات عبدالله نقدية:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{audit.partnerSummary.abdallahCashSYP.toLocaleString('en-US')} ل.س {audit.partnerSummary.abdallahCashUSD > 0 ? `+ $${audit.partnerSummary.abdallahCashUSD}` : ''}</span>
                  </div>

                  {/* 10. Partner Cash Withdrawals */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">10. مسحوبات الشريك نقدية:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{audit.partnerSummary.partnerCashSYP.toLocaleString('en-US')} ل.س {audit.partnerSummary.partnerCashUSD > 0 ? `+ $${audit.partnerSummary.partnerCashUSD}` : ''}</span>
                  </div>

                  {/* 11. Abdullah Inventory Withdrawals */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">11. مسحوبات عبدالله بضاعة (بالتكلفة):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{audit.partnerSummary.abdallahGoodsSYP.toLocaleString('en-US')} ل.س {audit.partnerSummary.abdallahGoodsUSD > 0 ? `+ $${audit.partnerSummary.abdallahGoodsUSD}` : ''}</span>
                  </div>

                  {/* 12. Partner Inventory Withdrawals */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">12. مسحوبات الشريك بضاعة (بالتكلفة):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{audit.partnerSummary.partnerGoodsSYP.toLocaleString('en-US')} ل.س {audit.partnerSummary.partnerGoodsUSD > 0 ? `+ $${audit.partnerSummary.partnerGoodsUSD}` : ''}</span>
                  </div>

                  {/* 13. Expenses */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">13. المصاريف والنفقات (Expenses):</span>
                    <span className="font-mono font-bold text-orange-600">{(cashBoxSummary.operatingExpensesOutSYP + cashBoxSummary.specialExpensesSYP).toLocaleString('en-US')} ل.س {cashBoxSummary.operatingExpensesOutUSD + cashBoxSummary.specialExpensesUSD > 0 ? `+ $${cashBoxSummary.operatingExpensesOutUSD + cashBoxSummary.specialExpensesUSD}` : ''}</span>
                  </div>

                  {/* 14. Profit */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">14. الأرباح المحققة (Profit):</span>
                    <span className={`font-mono font-bold ${audit.reconciliation.operatingProfitUSD >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${Math.round(audit.reconciliation.operatingProfitUSD).toLocaleString('en-US')}</span>
                  </div>

                  {/* 15. Exchange-rate Effect */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">15. أثر تغير سعر الصرف:</span>
                    <span className="font-mono font-bold text-indigo-600">{audit.reconciliation.unexplainedDifferenceUSD !== 0 ? `فارق: ${audit.reconciliation.unexplainedDifferenceUSD > 0 ? '+' : ''}${audit.reconciliation.unexplainedDifferenceUSD} $` : 'متطابق محاسبياً'}</span>
                  </div>

                  {/* 16. Current Project Net Value in USD */}
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between font-black">
                    <span className="text-indigo-950 dark:text-indigo-200">16. صافي قيمة المشروع بالدولار (Net value):</span>
                    <span className="font-mono text-indigo-700 dark:text-indigo-300 text-sm">${Math.round(audit.netProjectWorthUSD).toLocaleString('en-US')}</span>
                  </div>
                </div>
              </div>

              {/* Equity & Net Project Worth (النتيجة المحاسبية الشاملة) */}
              <div className="p-6 rounded-3xl bg-[#153243] text-white space-y-4 shadow-xl border border-[#1e445b]">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white">
                      الصافي الفعلي للمشروع (Net Worth & Equity)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      (نقدية الصندوق + بضاعة المستودع + ديون العملاء) - ديون الموردين
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-[#FFAA47] text-slate-950 flex items-center justify-center font-bold">
                    <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-slate-400 block">إجمالي الموجودات (Assets)</span>
                    <span className="text-lg font-black text-emerald-400 font-mono mt-1 block">
                      ${Math.round(audit.totalAssetsUSD).toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-slate-400 block">إجمالي الالتزامات (Liabilities)</span>
                    <span className="text-lg font-black text-red-400 font-mono mt-1 block">
                      ${Math.round(audit.totalLiabilitiesUSD).toLocaleString('en-US')}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0f2430] border border-[#234d66] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-[#FFAA47] font-bold block">
                      صافي قيمة المشروع الحالية (قائم)
                    </span>
                    <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-0.5">
                      ${Math.round(audit.netProjectWorthUSD).toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-300 block">
                      المعادل بالليرة السورية
                    </span>
                    <span className="text-sm font-bold text-slate-200 font-mono">
                      {Math.round(audit.netProjectWorthSYP).toLocaleString('en-US')} ل.س
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: RECONCILIATION (مطابقة المشروع - Requirement 17) */}
          {activeTab === 'reconciliation' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Scale className="w-5 h-5 text-blue-600" />
                      <span>مطابقة المشروع المحاسبية الشاملة (Project Reconciliation)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      مقارنة صافي الأصول الفعلية مع (رأس المال + أرباح العمليات - المسحوبات)
                    </p>
                  </div>

                  {audit.reconciliation.isBalanced ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-xs flex items-center gap-1.5 border border-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>الحساب متطابق 100%</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-black text-xs flex items-center gap-1.5 border border-amber-300">
                      <AlertCircle className="w-4 h-4" />
                      <span>يوجد فرق غير مفسر</span>
                    </span>
                  )}
                </div>

                {/* Table of reconciliation elements */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold">
                    <span>1. إجمالي الأصول الفعلية (Assets):</span>
                    <span className="text-emerald-600 font-mono font-black">
                      ${Math.round(audit.reconciliation.totalAssetsUSD).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold">
                    <span>2. إجمالي الالتزامات والمطالبات (Liabilities):</span>
                    <span className="text-red-600 font-mono font-black">
                      -${Math.round(audit.reconciliation.totalLiabilitiesUSD).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 font-black text-blue-900 dark:text-blue-100">
                    <span>3. صافي الأصول الفعلي القائم (1 - 2):</span>
                    <span className="font-mono text-sm">
                      ${Math.round(audit.reconciliation.actualNetWorthUSD).toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-slate-400 block mb-1">
                      مصادر رأس المال والعمليات الدفترية:
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span>• رأس مال الشريك الأساسي:</span>
                    <span className="font-mono font-bold text-purple-600">
                      ${audit.reconciliation.initialCapitalUSD.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span>• أرباح العمليات التشغيلية التراكمية (المبيعات - التكاليف - المصاريف):</span>
                    <span className={`font-mono font-bold ${audit.reconciliation.operatingProfitUSD >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {audit.reconciliation.operatingProfitUSD >= 0 ? '+' : ''}${Math.round(audit.reconciliation.operatingProfitUSD).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span>• إجمالي مسحوبات الشركاء (نقد وبضاعة بالتكلفة):</span>
                    <span className="font-mono font-bold text-red-600">
                      -${Math.round(audit.reconciliation.totalWithdrawalsUSD).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 font-black text-purple-900 dark:text-purple-100">
                    <span>4. القيمة الدفترية المتوقعة لحقوق الملكية (رأس المال + الأرباح - المسحوبات):</span>
                    <span className="font-mono text-sm">
                      ${Math.round(audit.reconciliation.expectedEquityUSD).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* THE UNEXPLAINED DIFFERENCE CARD (Requirement 17) */}
                <div
                  className={`p-4 rounded-2xl border ${
                    audit.reconciliation.isBalanced
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block">
                        الفرق غير المفسر (Unexplained Difference):
                      </span>
                      <div className="text-xl sm:text-2xl font-black font-mono mt-0.5">
                        {audit.reconciliation.isBalanced ? (
                          '0.00 $ (الحساب متطابق تماماً)'
                        ) : (
                          `يوجد فرق غير مفسر: ${audit.reconciliation.unexplainedDifferenceUSD > 0 ? '+' : ''}${audit.reconciliation.unexplainedDifferenceUSD.toLocaleString()} $`
                        )}
                      </div>
                    </div>

                    {!audit.reconciliation.isBalanced && (
                      <div className="text-left font-mono text-xs font-bold">
                        ~ {(Math.round(audit.reconciliation.unexplainedDifferenceUSD * exchangeRate)).toLocaleString()} ل.س
                      </div>
                    )}
                  </div>

                  {!audit.reconciliation.isBalanced && (
                    <p className="text-[11px] text-red-700 dark:text-red-300 mt-2 pt-2 border-t border-red-200 dark:border-red-900/60">
                      ملاحظة محاسبية: لا يتم إخفاء أي فرق في مركز العطايا. الفرق ينتج عادةً عن أي مبيعات أو مشتريات نقدية خارج الفواتير، أو فروقات أسعار الصرف غير المسجلة.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY AND CURRENCIES (Requirement 13) */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    تفصيل بضاعة المستودع حسب عملة التكلفة
                  </h3>
                  <p className="text-xs text-slate-400">
                    تصنيف مستقل للبضاعة المسعرة بالليرة السورية والبضاعة المسعرة بالدولار
                  </p>
                </div>
                <span className="text-xs font-black font-mono text-amber-600">
                  إجمالي قيمة المخزون: ${Math.round(audit.totalInventoryInUSD).toLocaleString()}
                </span>
              </div>

              {/* Section 1: Items with Cost in USD */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      1. البضاعة ذات التكلفة بالدولار الأمريكي ($)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs text-blue-600">
                    الإجمالي: ${Math.round(audit.inventoryCostUSD).toLocaleString()}
                  </span>
                </div>

                {audit.inventoryUSDItems.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    لا توجد أصناف بتكلفة الدولار
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700/60 text-xs">
                    {audit.inventoryUSDItems.map((item) => (
                      <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="text-[11px] text-slate-500">
                            الكمية: {item.cartons} {item.unit} {item.loosePieces > 0 ? `+ ${item.loosePieces} قطعة` : ''} ({item.totalPieces} قطعة إجمالي)
                          </div>
                        </div>
                        <div className="text-left font-mono">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            ${item.totalCostOriginal.toFixed(1)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            (تكلفة {item.unit}: ${item.unitCost} | القطعة: ${item.pieceCost.toFixed(2)})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Items with Cost in SYP */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      2. البضاعة ذات التكلفة بالليرة السورية (ل.س)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs text-emerald-600">
                    الإجمالي: {Math.round(audit.inventoryCostSYP).toLocaleString()} ل.س (~ ${Math.round(audit.inventoryCostSYP / exchangeRate).toLocaleString()})
                  </span>
                </div>

                {audit.inventorySYPItems.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    لا توجد أصناف بتكلفة الليرة
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700/60 text-xs">
                    {audit.inventorySYPItems.map((item) => (
                      <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="text-[11px] text-slate-500">
                            الكمية: {item.cartons} {item.unit} {item.loosePieces > 0 ? `+ ${item.loosePieces} قطعة` : ''} ({item.totalPieces} قطعة إجمالي)
                          </div>
                        </div>
                        <div className="text-left font-mono">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {Math.round(item.totalCostOriginal).toLocaleString()} ل.س
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ~ ${item.equivalentUSD.toFixed(1)} دولار (قيمة تحويلية)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CUSTOMERS DEBTS */}
          {activeTab === 'customers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  قائمة العملاء الذين عليهم ديون
                </h3>
                <span className="text-xs font-bold text-sky-600">
                  الإجمالي: ${Math.round(audit.customerDebtsInUSD).toLocaleString('en-US')}
                </span>
              </div>

              {audit.customerDebtsList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  لا توجد أي ديون مسجلة على العملاء حالياً
                </div>
              ) : (
                <div className="space-y-2">
                  {audit.customerDebtsList.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {c.name}
                        </div>
                        {c.shopName && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {c.shopName}
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        {c.syp !== 0 && (
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {c.syp.toLocaleString()} ل.س
                          </div>
                        )}
                        {c.usd !== 0 && (
                          <div className="text-xs font-bold text-sky-600 dark:text-sky-400">
                            ${c.usd.toLocaleString()}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          ~ ${Math.round(c.totalInUSD).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SUPPLIERS DEBTS */}
          {activeTab === 'suppliers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  قائمة الموردين والمطالبات المتبقية
                </h3>
                <span className="text-xs font-bold text-red-600">
                  الإجمالي: ${Math.round(audit.supplierDebtsInUSD).toLocaleString('en-US')}
                </span>
              </div>

              {audit.supplierDebtsList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  لا توجد أي مطالبات أو ديون مستحقة للموردين حالياً
                </div>
              ) : (
                <div className="space-y-2">
                  {audit.supplierDebtsList.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {s.name}
                        </div>
                        {s.company && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {s.company}
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        {s.syp !== 0 && (
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {s.syp.toLocaleString()} ل.س
                          </div>
                        )}
                        {s.usd !== 0 && (
                          <div className="text-xs font-bold text-red-600 dark:text-red-400">
                            ${s.usd.toLocaleString()}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          ~ ${Math.round(s.totalInUSD).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PARTNERS */}
          {activeTab === 'partners' && (
            <div className="space-y-4">
              {/* Partner Card */}
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm text-purple-900 dark:text-purple-200">
                    حساب {audit.partnerSummary.partnerName || 'الشريك'} (رأس المال والمسحوبات)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-300 text-[10px] font-bold">
                    رأس مال: ${audit.partnerSummary.totalCapitalUSD.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                    <span className="text-slate-500 text-[11px] block">مسحوبات نقدية كاش:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {audit.partnerSummary.partnerCashSYP.toLocaleString()} ل.س
                    </span>
                    {audit.partnerSummary.partnerCashUSD > 0 && (
                      <span className="font-bold text-purple-600 block font-mono">
                        + ${audit.partnerSummary.partnerCashUSD.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                    <span className="text-slate-500 text-[11px] block">مسحوبات بضاعة بسعر التكلفة:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {audit.partnerSummary.partnerGoodsSYP.toLocaleString()} ل.س
                    </span>
                    {audit.partnerSummary.partnerGoodsUSD > 0 && (
                      <span className="font-bold text-purple-600 block font-mono">
                        + ${audit.partnerSummary.partnerGoodsUSD.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-xs font-bold text-purple-800 dark:text-purple-300 flex justify-between">
                  <span>إجمالي مسحوبات الشريك بالدولار:</span>
                  <span className="font-mono">${Math.round(audit.partnerSummary.partnerTotalWithdrawnUSD).toLocaleString()}</span>
                </div>
              </div>

              {/* Abdallah Card */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                    حساب عبدالله (المسحوبات الخاصة)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                    الإدارة والتشغيل
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                    <span className="text-slate-500 text-[11px] block">مسحوبات نقدية كاش:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {audit.partnerSummary.abdallahCashSYP.toLocaleString()} ل.س
                    </span>
                    {audit.partnerSummary.abdallahCashUSD > 0 && (
                      <span className="font-bold text-amber-600 block font-mono">
                        + ${audit.partnerSummary.abdallahCashUSD.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                    <span className="text-slate-500 text-[11px] block">مسحوبات بضاعة بسعر التكلفة:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {audit.partnerSummary.abdallahGoodsSYP.toLocaleString()} ل.س
                    </span>
                    {audit.partnerSummary.abdallahGoodsUSD > 0 && (
                      <span className="font-bold text-amber-600 block font-mono">
                        + ${audit.partnerSummary.abdallahGoodsUSD.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 text-xs font-bold text-amber-800 dark:text-amber-300 flex justify-between">
                  <span>إجمالي مسحوبات عبدالله بالدولار:</span>
                  <span className="font-mono">${Math.round(audit.partnerSummary.abdallahTotalWithdrawnUSD).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            تاريخ الانعكاس: {asOfDate} | الصرف: 1$ = {exchangeRate.toLocaleString()} ل.س
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSavePdf}
              disabled={isSavingPdf || isSharingPdf}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isSavingPdf ? 'جاري الحفظ...' : 'حفظ PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleSharePdf}
              disabled={isSharingPdf || isSavingPdf}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FFAA47] hover:bg-[#ff9f2c] text-slate-950 text-xs font-black transition cursor-pointer shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isSharingPdf ? 'جاري التصدير...' : 'مشاركة تقرير الجرد'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
