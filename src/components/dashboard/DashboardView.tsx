import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt,
  ShoppingBag,
  ArrowDownLeft,
  WalletCards,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
  Truck,
  Package,
  Coins,
  Store,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  FileSpreadsheet,
  ArrowDownUp,
  Handshake,
  ChevronDown,
  ChevronUp,
  Scale,
} from 'lucide-react';
import {
  AppSettings,
  Product,
  Invoice,
  ActiveTab,
  Customer,
  Supplier,
  Expense,
} from '../../types';
import { LocalDatabase } from '../../services/db';
import { DailyInventoryModal } from './DailyInventoryModal';

export interface DashboardViewProps {
  settings: AppSettings;
  products: Product[];
  invoices?: Invoice[];
  recentInvoices?: Invoice[];
  customers?: Customer[];
  suppliers?: Supplier[];
  expenses?: Expense[];
  onNavigateTab?: (tab: ActiveTab) => void;
  onNavigate?: (tab: ActiveTab, action?: string) => void;
  onOpenNewSale?: () => void;
  onOpenNewProduct?: () => void;
  onOpenNewCustomer?: () => void;
  onOpenNewPayment?: () => void;
  onOpenNewExpense?: () => void;
  onViewInvoice?: (invoice: Invoice) => void;
  getCustomerBalance?: (customerId: string) => number;
  getSupplierBalance?: (supplierId: string) => number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  settings,
  products,
  invoices = [],
  expenses = [],
  customers = [],
  suppliers = [],
  onNavigateTab,
  onNavigate,
  onOpenNewSale,
  onOpenNewCustomer,
  onOpenNewPayment,
  onOpenNewExpense,
}) => {
  // Navigation helper
  const navigateTo = (tab: ActiveTab, action?: string) => {
    if (onNavigate) {
      onNavigate(tab, action);
    } else if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  // Quick Action Handlers
  const handleSale = onOpenNewSale || (() => navigateTo('sales', 'new-invoice'));
  const handlePurchase = () => navigateTo('purchases', 'new-purchase');
  const handlePayment = onOpenNewPayment || (() => navigateTo('customers', 'customer-payment'));
  const handleExpense = onOpenNewExpense || (() => navigateTo('expenses', 'add-expense'));

  const [isDailyInventoryOpen, setIsDailyInventoryOpen] = useState(false);
  const [showAll16Items, setShowAll16Items] = useState(false);

  // Compute CashBox Expected Balance
  const cashBoxSummary = useMemo(() => {
    return LocalDatabase.getCashBoxSummary();
  }, [settings]);

  // Comprehensive 16-Point Financial Audit Summary for Dashboard (Requirement 14)
  const auditData = useMemo(() => {
    return LocalDatabase.getDailyInventoryAudit(settings.exchangeRate || 15000);
  }, [settings.exchangeRate, invoices, products, customers, suppliers]);

  // Compute Customer Debts total (dual currency and USD valuation)
  const customerDebtsSummary = useMemo(() => {
    const custs = customers.length > 0 ? customers : LocalDatabase.getCustomers();
    let syp = 0;
    let usd = 0;
    for (const c of custs) {
      const dual = LocalDatabase.getCustomerDualBalance(c.id);
      syp += dual.syp;
      usd += dual.usd;
    }
    const r = settings.exchangeRate || 15000;
    const valuationUSD = usd + (r > 0 ? syp / r : 0);
    return { syp, usd, valuationUSD };
  }, [customers, settings.exchangeRate]);

  // Compute Supplier Debts total (dual currency and USD valuation - Requirement 2)
  const supplierDebtsSummary = useMemo(() => {
    const sups = suppliers.length > 0 ? suppliers : LocalDatabase.getSuppliers();
    let syp = 0;
    let usd = 0;
    for (const s of sups) {
      const dual = LocalDatabase.getSupplierDualBalance(s.id);
      syp += dual.syp;
      usd += dual.usd;
    }
    const r = settings.exchangeRate || 15000;
    const valuationUSD = usd + (r > 0 ? syp / r : 0);
    return { syp, usd, valuationUSD };
  }, [suppliers, settings.exchangeRate]);

  const totalCustomerDebt = customerDebtsSummary.syp + customerDebtsSummary.usd * (settings.exchangeRate || 15000);
  const totalSupplierDebt = supplierDebtsSummary.valuationUSD;

  // Active products count
  const activeProductsCount = useMemo(() => {
    return products.filter((p) => !p.isArchived).length;
  }, [products]);

  // Total sales volume
  const totalSalesAmount = useMemo(() => {
    return invoices.reduce((sum, inv) => {
      const isUSD = inv.currency === 'USD';
      const amount = isUSD ? inv.finalTotal * (settings.exchangeRate || 15000) : inv.finalTotal;
      return sum + amount;
    }, 0);
  }, [invoices, settings.exchangeRate]);

  // Today's date info for the calendar strip
  const today = new Date();
  const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const monthNames = [
    'كانون الثاني',
    'شباط',
    'آذار',
    'نيسان',
    'أيار',
    'حزيران',
    'تموز',
    'آب',
    'أيلول',
    'تشرين الأول',
    'تشرين الثاني',
    'كانون الأول',
  ];

  // Generate the 5-day strip centered on today
  const calendarDays = useMemo(() => {
    const list = [];
    for (let offset = -2; offset <= 2; offset++) {
      const d = new Date();
      d.setDate(today.getDate() + offset);
      list.push({
        date: d,
        dayNum: d.getDate(),
        dayName: daysOfWeek[d.getDay()],
        isToday: offset === 0,
      });
    }
    return list;
  }, []);

  // Calculate a representative efficiency percentage for the circular gauge (like the 80% in photo)
  const collectionPercentage = useMemo(() => {
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalBilled = invoices.reduce((sum, inv) => sum + (inv.finalTotal || 0), 0);
    if (totalBilled <= 0) return 85;
    const ratio = Math.round((totalPaid / totalBilled) * 100);
    return Math.min(Math.max(ratio, 35), 98);
  }, [invoices]);

  // Sort recent transactions for the timeline
  const recentActivities = useMemo(() => {
    return [...invoices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  }, [invoices]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 font-sans text-slate-900 dark:text-slate-100" dir="rtl">
      {/* 1. Top Header & Greeting (exact typography style from photo) */}
      <div className="flex items-center justify-between pt-1 px-1">
        <div>
          <div className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 font-display">
            أهلاً بك مجدداً يا عبدالله،
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-display tracking-tight text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
            <span>مركز</span>
            <span className="text-[#FFAA47]">العطايا لتوزيع المواد الغذائية</span>
          </h1>
        </div>

        {/* Minimalist Profile / Center Badge (like top right icon in photo) */}
        <div
          onClick={() => navigateTo('cashbox')}
          className="w-11 h-11 rounded-2xl bg-white dark:bg-[#153243] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-800 dark:text-white cursor-pointer active:scale-95 transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-[#FFF4E8] dark:bg-amber-950/40 text-[#FFAA47] flex items-center justify-center font-bold font-display text-sm">
            ع
          </div>
        </div>
      </div>

      {/* 2. Signature Hero Card: Deep Petrol Teal (#153243) with Circular Gauge & Amber Pill Button */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-[32px] bg-[#153243] text-white p-6 sm:p-7 shadow-xl shadow-[#153243]/20 border border-[#1b3f54]"
      >
        {/* Subtle decorative glow circles in background */}
        <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
        <div className="absolute right-0 top-0 w-36 h-36 rounded-full bg-[#FFAA47]/10 blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          {/* Left info */}
          <div className="space-y-3 flex-1">
            <div>
              <span className="text-xs text-slate-300 font-medium font-display block">
                الرصيد المتوقع في الصندوق
              </span>
              <div className="text-2xl sm:text-3xl font-black font-display tracking-tight mt-1 text-white">
                {cashBoxSummary.expectedCashSYP.toLocaleString('en-US')}{' '}
                <span className="text-xs sm:text-sm font-normal text-slate-300">ل.س</span>
              </div>
              {cashBoxSummary.expectedCashUSD !== 0 && (
                <div className="text-xs font-bold text-[#FFAA47] font-display mt-0.5">
                  + ${cashBoxSummary.expectedCashUSD.toLocaleString('en-US')} دولار
                </div>
              )}
            </div>

            {/* Amber Pill Button + Daily Inventory Button */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsDailyInventoryOpen(true)}
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-full bg-[#FFAA47] hover:bg-[#ff9f2c] active:scale-95 text-slate-950 font-bold text-xs font-display shadow-md shadow-[#FFAA47]/30 transition-all cursor-pointer"
                title="الجرد المالي الشامل بنقرة واحدة لجميع عناصر المشروع الـ 16"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>الجرد الشامل (Comprehensive Audit)</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('audits')}
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs font-display border border-white/20 transition-all cursor-pointer"
              >
                <span>الجرد والتقارير</span>
                <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              <button
                type="button"
                onClick={() => navigateTo('cashbox')}
                className="inline-flex items-center gap-1.5 py-2 px-4 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs font-display border border-white/20 transition-all cursor-pointer"
              >
                <span>الصندوق</span>
                <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Right: Iconic Circular Progress Gauge (like 80% in photo) */}
          <div className="relative flex flex-col items-center justify-center shrink-0">
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                {/* Background Track */}
                <path
                  className="text-[#1f4357]"
                  strokeWidth="3.6"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Progress Amber Stroke */}
                <path
                  className="text-[#FFAA47] transition-all duration-1000 ease-out"
                  strokeDasharray={`${collectionPercentage}, 100`}
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>

              {/* Inside Gauge Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm sm:text-base font-black font-display text-white">
                  {collectionPercentage}%
                </span>
                <span className="text-[8px] text-slate-300 font-display">تحصيل</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Exchange Rate Bar */}
        <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300 font-display">
          <span>سعر الصرف المعتمد:</span>
          <span className="font-bold text-[#FFAA47]">
            1$ = {settings.exchangeRate.toLocaleString('en-US')} ل.س
          </span>
        </div>
      </motion.div>

      {/* 2.5. Comprehensive 16-Point Financial Audit Card (Requirements 14, 15, 16) */}
      <div className="rounded-[28px] bg-white dark:bg-[#153243]/60 border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs space-y-4 font-display">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
              </div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                الجرد المالي والتدقيق الشامل (16 بنداً محاسبياً)
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              تدقيق فوري لصافي المركز المالي، النقدية، المخزون، ديون العملاء والموردين، وحسابات الشركاء.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsDailyInventoryOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>تقرير الجرد الشامل PDF</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo('customers')}
              className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800 transition active:scale-95 cursor-pointer"
            >
              <span>جرد ديون العملاء</span>
            </button>
          </div>
        </div>

        {/* 6 Key Pillars Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          {/* Pillar 1: Net Project Worth */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/50">
            <span className="text-[10px] text-indigo-900 dark:text-indigo-300 font-bold block">
              16. صافي قيمة المشروع بالدولار:
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-indigo-700 dark:text-indigo-300 mt-0.5">
              ${Math.round(auditData.netProjectWorthUSD).toLocaleString('en-US')} USD
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              يعادل: {Math.round(auditData.netProjectWorthUSD * (settings.exchangeRate || 15000)).toLocaleString('en-US')} ل.س
            </span>
          </div>

          {/* Pillar 2: Cash Box Total */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
              1-3. إجمالي النقدية بالصندوق:
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-slate-100 mt-0.5">
              ${(auditData.cashUSD + (settings.exchangeRate ? auditData.cashSYP / settings.exchangeRate : 0)).toFixed(0)} USD
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              {auditData.cashSYP.toLocaleString('en-US')} ل.س {auditData.cashUSD > 0 ? `+ $${auditData.cashUSD}` : ''}
            </span>
          </div>

          {/* Pillar 3: Inventory Value at Cost */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
              4-5. بضاعة المستودع (التكلفة):
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              ${Math.round(auditData.totalInventoryInUSD).toLocaleString('en-US')} USD
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              {auditData.totalProductsCount} أصناف ({auditData.totalPiecesCount} قطعة)
            </span>
          </div>

          {/* Pillar 4: Customer Debts (Dual-Currency) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
              6. ديون العملاء (لصالحنا):
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              ${Math.round(customerDebtsSummary.valuationUSD).toLocaleString('en-US')} USD
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              {customerDebtsSummary.syp.toLocaleString('en-US')} ل.س {customerDebtsSummary.usd > 0 ? `+ $${customerDebtsSummary.usd}` : ''}
            </span>
          </div>

          {/* Pillar 5: Supplier Debts in USD */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
              7. ديون الموردين (المستحقة):
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-red-600 dark:text-red-400 mt-0.5">
              ${Math.round(supplierDebtsSummary.valuationUSD).toLocaleString('en-US')} USD
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              {supplierDebtsSummary.usd > 0 ? `$${supplierDebtsSummary.usd} ` : ''}{supplierDebtsSummary.syp > 0 ? `+ ${supplierDebtsSummary.syp.toLocaleString('en-US')} ل.س` : ''}
            </span>
          </div>

          {/* Pillar 6: Partner Capital */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">
              8-12. رأس المال والمسحوبات:
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-purple-600 dark:text-purple-400 mt-0.5">
              ${auditData.partnerSummary.totalCapitalUSD.toLocaleString('en-US')} USD
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              يبدأ من 0 • مسحوبات بالتكلفة
            </span>
          </div>
        </div>

        {/* Expandable 16-point Breakdown Toggle */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAll16Items(!showAll16Items)}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-between transition cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{showAll16Items ? 'إخفاء جدول البنود الـ 16' : 'عرض جدول البنود الـ 16 كاملة (التدقيق المالي الشامل)'}</span>
            </span>
            {showAll16Items ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAll16Items && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">1. نقدية الليرة السورية:</span>
                <span className="font-bold text-slate-900 dark:text-white">{auditData.cashSYP.toLocaleString('en-US')} ل.س</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">2. نقدية الدولار:</span>
                <span className="font-bold text-blue-600">${auditData.cashUSD.toLocaleString('en-US')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">3. القيمة الحالية للنقدية بالدولار:</span>
                <span className="font-bold text-emerald-600">${(auditData.cashUSD + (settings.exchangeRate ? auditData.cashSYP / settings.exchangeRate : 0)).toFixed(2)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">4. كميات المخزون:</span>
                <span className="font-bold text-slate-900 dark:text-white">{auditData.totalProductsCount} أصناف ({auditData.totalPiecesCount} قطعة)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">5. قيمة المخزون بسعر التكلفة:</span>
                <span className="font-bold text-amber-600">${Math.round(auditData.totalInventoryInUSD).toLocaleString('en-US')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">6. ديون العملاء (Customer receivables):</span>
                <span className="font-bold text-blue-600">${Math.round(customerDebtsSummary.valuationUSD).toLocaleString('en-US')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">7. ديون الموردين (Supplier payables):</span>
                <span className="font-bold text-red-600">${Math.round(supplierDebtsSummary.valuationUSD).toLocaleString('en-US')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">8. رأس مال الشريك (يبدأ من 0):</span>
                <span className="font-bold text-purple-600">${auditData.partnerSummary.totalCapitalUSD.toLocaleString('en-US')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">9. مسحوبات عبدالله نقدية:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{auditData.partnerSummary.abdallahCashSYP.toLocaleString('en-US')} ل.س</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">10. مسحوبات الشريك نقدية:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{auditData.partnerSummary.partnerCashSYP.toLocaleString('en-US')} ل.س</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">11. مسحوبات عبدالله بضاعة (بالتكلفة):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{auditData.partnerSummary.abdallahGoodsSYP.toLocaleString('en-US')} ل.س</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">12. مسحوبات الشريك بضاعة (بالتكلفة):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{auditData.partnerSummary.partnerGoodsSYP.toLocaleString('en-US')} ل.س</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">13. المصاريف والنفقات:</span>
                <span className="font-bold text-orange-600">{(cashBoxSummary.operatingExpensesOutSYP + cashBoxSummary.specialExpensesSYP).toLocaleString('en-US')} ل.س</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">14. الأرباح المحققة:</span>
                <span className={`font-bold ${auditData.reconciliation.operatingProfitUSD >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${Math.round(auditData.reconciliation.operatingProfitUSD).toLocaleString('en-US')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500 font-sans">15. أثر تغير سعر الصرف:</span>
                <span className="font-bold text-indigo-600">{auditData.reconciliation.unexplainedDifferenceUSD !== 0 ? `فارق تقييم: ${auditData.reconciliation.unexplainedDifferenceUSD > 0 ? '+' : ''}${auditData.reconciliation.unexplainedDifferenceUSD} $` : 'متطابق ومحفوظ'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex justify-between font-black">
                <span className="text-indigo-950 dark:text-indigo-200 font-sans">16. صافي قيمة المشروع بالدولار:</span>
                <span className="text-indigo-700 dark:text-indigo-300">${Math.round(auditData.netProjectWorthUSD).toLocaleString('en-US')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Section: "العمليات والوصول السريع" (Styled like "Today's Scedule" in photo) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">
            العمليات والوصول السريع
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-display">
            مركز العطايا
          </span>
        </div>

        {/* Bento Grid layout with Peach Pastel, Cream, and Teal Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card 0: Profits & Sales Analysis (قسم الأرباح) */}
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => navigateTo('profits')}
            className="p-5 rounded-[28px] bg-[#ECFDF5] dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-800/50 flex flex-col justify-between h-38 cursor-pointer shadow-2xs hover:shadow-xs transition-all col-span-2 sm:col-span-1"
          >
            <div>
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-2xs">
                <TrendingUp className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                قسم الأرباح وتحليل المبيعات
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-display">
                أرباح اليوم، الشهر، وتكلفة البضاعة
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100/90 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full font-display">
                عرض الأرباح
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-display font-bold">
                صافي ومجمل
              </span>
            </div>
          </motion.div>

          {/* Card 1: Soft Peach Pastel (فاتورة بيع) */}
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={handleSale}
            className="p-5 rounded-[28px] bg-[#FFF4E8] dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/40 flex flex-col justify-between h-38 cursor-pointer shadow-2xs hover:shadow-xs transition-all"
          >
            <div>
              <div className="w-9 h-9 rounded-2xl bg-[#FFAA47] text-slate-950 flex items-center justify-center mb-2 shadow-2xs">
                <Receipt className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                فاتورة مبيعات
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-display">
                تسجيل طلبية لمحل أو عميل
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold bg-amber-100/90 dark:bg-amber-900/50 px-2 py-0.5 rounded-full font-display">
                إنشاء فاتورة
              </span>
              <span className="text-[10px] text-slate-400 font-display">
                {invoices.length} فواتير
              </span>
            </div>
          </motion.div>

          {/* Card 2: Soft Cream Pastel (فاتورة مشتريات) */}
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={handlePurchase}
            className="p-5 rounded-[28px] bg-[#FEF9F2] dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between h-38 cursor-pointer shadow-2xs hover:shadow-xs transition-all"
          >
            <div>
              <div className="w-9 h-9 rounded-2xl bg-teal-600 text-white flex items-center justify-center mb-2 shadow-2xs">
                <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                فاتورة مشتريات
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-display">
                توريد بضاعة من المطاحن
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-teal-800 dark:text-teal-300 font-bold bg-teal-100/90 dark:bg-teal-900/50 px-2 py-0.5 rounded-full font-display">
                تسجيل شراء
              </span>
              <span className="text-[10px] text-slate-400 font-display">الموردون</span>
            </div>
          </motion.div>

          {/* Card 3: Soft Peach Pastel (سند قبض دفعة) */}
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={handlePayment}
            className="p-5 rounded-[28px] bg-[#FFF5EB] dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex flex-col justify-between h-38 cursor-pointer shadow-2xs hover:shadow-xs transition-all"
          >
            <div>
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-2xs">
                <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                سند قبض دفعة
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-display">
                تحصيل نقدي من حساب عميل
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100/90 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full font-display">
                قبض دفعة
              </span>
              <span className="text-[10px] text-slate-400 font-display">الصندوق</span>
            </div>
          </motion.div>

          {/* Card 4: Deep Petrol Teal Card (Exact match to "Click to view more" in photo!) */}
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => navigateTo('cashbox')}
            className="p-5 rounded-[28px] bg-[#153243] text-white flex flex-col justify-between h-38 cursor-pointer shadow-md shadow-[#153243]/20 hover:bg-[#1b3f54] transition-all"
          >
            <div>
              <div className="w-9 h-9 rounded-2xl bg-white/15 text-[#FFAA47] flex items-center justify-center mb-2">
                <WalletCards className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white font-display">
                عرض المزيد
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5 font-display">
                الصندوق، المصاريف والديون
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-bold text-slate-950 bg-[#FFAA47] px-2.5 py-0.5 rounded-full font-display">
                فتح الصندوق
              </span>
              <span className="text-[10px] text-slate-300 font-display">+4 أقسام</span>
            </div>
          </motion.div>

          {/* Card 5: USD Exchange (شراء دولار) */}
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => navigateTo('usd_exchange')}
            className="p-5 rounded-[28px] bg-[#F0FDF4] dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-900/40 flex flex-col justify-between h-38 cursor-pointer shadow-2xs hover:shadow-xs transition-all"
          >
            <div>
              <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-2 shadow-2xs">
                <ArrowDownUp className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                شراء دولار (USD)
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-display">
                تحويل ليرة سورية إلى دولار
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold bg-emerald-100/90 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full font-display">
                تصريف وتحويل
              </span>
              <span className="text-[10px] text-slate-400 font-display">الصندوق</span>
            </div>
          </motion.div>

          {/* Card 6: Partners & Capital (الشركاء ورأس المال) */}
          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => navigateTo('partners')}
            className="p-5 rounded-[28px] bg-[#FAF5FF] dark:bg-purple-950/25 border border-purple-200/70 dark:border-purple-900/40 flex flex-col justify-between h-38 cursor-pointer shadow-2xs hover:shadow-xs transition-all"
          >
            <div>
              <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center mb-2 shadow-2xs">
                <Handshake className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                الشركاء ورأس المال
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-display">
                سجل رأس المال والمسحوبات
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-purple-800 dark:text-purple-300 font-bold bg-purple-100/90 dark:bg-purple-900/50 px-2 py-0.5 rounded-full font-display">
                حساب الشريك وعبدالله
              </span>
              <span className="text-[10px] text-slate-400 font-display">حساب جاري</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 4. Calendar Strip & Schedule / Timeline (From the second screen of the photo!) */}
      <div className="p-5 sm:p-6 rounded-[32px] bg-white dark:bg-[#153243]/50 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        {/* Calendar Header with Month */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#FFAA47]" />
            <span className="text-sm font-bold text-slate-900 dark:text-white font-display">
              {monthNames[today.getMonth()]} {today.getFullYear()}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-display">
            {daysOfWeek[today.getDay()]} {today.getDate()}
          </span>
        </div>

        {/* 5-Day Strip with Active Amber Circle */}
        <div className="flex items-center justify-between gap-1">
          {calendarDays.map((item, idx) => (
            <div
              key={idx}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all ${
                item.isToday
                  ? 'bg-transparent'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-[10px] font-display mb-1 text-slate-400">
                {item.dayName}
              </span>
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-display transition-transform ${
                  item.isToday
                    ? 'bg-[#FFAA47] text-slate-950 shadow-md shadow-[#FFAA47]/30 scale-105 font-black'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {item.dayNum}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Reminder / Expense Amber Pill Button */}
        <button
          type="button"
          onClick={handleExpense}
          className="w-full py-2.5 px-4 rounded-full bg-[#FFAA47] hover:bg-[#ff9f2c] active:scale-98 text-slate-950 font-bold text-xs font-display flex items-center justify-center gap-2 shadow-md shadow-[#FFAA47]/20 transition-all cursor-pointer"
        >
          <Coins className="w-4 h-4" />
          <span>تسجيل مصروف أو دفعة تشغيلية جديدة</span>
        </button>

        {/* Timeline / Recent Invoices (Similar to Friday 24th schedule list in photo) */}
        <div className="pt-2 space-y-2.5">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 font-display">
            آخر الفواتير والعمليات المسجلة
          </div>

          {recentActivities.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-400 font-display">
              لا توجد فواتير مسجلة اليوم بعد
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivities.map((inv) => {
                const timeStr = new Date(inv.date).toLocaleTimeString('ar-SY', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={inv.id}
                    onClick={() => navigateTo('sales')}
                    className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between cursor-pointer hover:border-amber-200 transition-all active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-bold text-slate-400 font-display w-12 text-center">
                        {timeStr}
                      </div>
                      <div className="w-2 h-2 rounded-full bg-[#FFAA47]" />
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white font-display">
                          {inv.customerName}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-display">
                          فاتورة رقم #{inv.invoiceNumber}
                        </div>
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="text-xs font-bold font-display text-slate-900 dark:text-white">
                        {inv.finalTotal.toLocaleString('en-US')} {inv.currency}
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-display">
                        مدفوع: {inv.paidAmount.toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Financial Overview Summary Cards (المبيعات، ديون العملاء، ديون الموردين، المخزون) */}
      <div className="space-y-2.5">
        <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 px-1 font-display">
          إحصائيات وحسابات المركز
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Sales */}
          <div
            onClick={() => navigateTo('sales')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#153243]/60 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-[#FFAA47] transition-all cursor-pointer"
          >
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-display block">
              المبيعات
            </span>
            <div className="text-base font-bold font-display text-slate-900 dark:text-white mt-1">
              {totalSalesAmount.toLocaleString('en-US')}{' '}
              <span className="text-[10px] font-normal text-slate-400">ل.س</span>
            </div>
          </div>

          {/* Customer Debt */}
          <div
            onClick={() => navigateTo('customers')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#153243]/60 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-blue-400 transition-all cursor-pointer"
          >
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-display block">
              ديون العملاء (لصالحنا)
            </span>
            <div className="text-base font-bold font-display text-blue-600 dark:text-blue-400 mt-1 font-mono">
              ${Math.round(customerDebtsSummary.valuationUSD).toLocaleString('en-US')}{' '}
              <span className="text-[10px] font-normal text-slate-400 font-sans">USD</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-display block truncate mt-0.5">
              {customerDebtsSummary.syp.toLocaleString('en-US')} ل.س
            </span>
          </div>

          {/* Supplier Debt */}
          <div
            onClick={() => navigateTo('suppliers')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#153243]/60 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-red-400 transition-all cursor-pointer"
          >
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-display block">
              ديون الموردين (علينا)
            </span>
            <div className="text-base font-bold font-display text-red-600 dark:text-red-400 mt-1 font-mono">
              ${Math.round(supplierDebtsSummary.valuationUSD).toLocaleString('en-US')}{' '}
              <span className="text-[10px] font-normal text-slate-400 font-sans">USD</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-display block truncate mt-0.5">
              {supplierDebtsSummary.usd > 0 ? `$${supplierDebtsSummary.usd} ` : ''}{supplierDebtsSummary.syp > 0 ? `+ ${supplierDebtsSummary.syp.toLocaleString('en-US')} ل.س` : ''}
            </span>
          </div>

          {/* Stock */}
          <div
            onClick={() => navigateTo('products')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#153243]/60 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-400 transition-all cursor-pointer"
          >
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-display block">
              المخزون
            </span>
            <div className="text-base font-bold font-display text-slate-900 dark:text-white mt-1">
              {activeProductsCount}{' '}
              <span className="text-[10px] font-normal text-slate-400">صنف غذائي</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Inventory Modal */}
      <DailyInventoryModal
        isOpen={isDailyInventoryOpen}
        onClose={() => setIsDailyInventoryOpen(false)}
        settings={settings}
      />
    </div>
  );
};
