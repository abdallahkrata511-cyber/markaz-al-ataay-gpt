import React, { useState, useMemo } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  Users,
  Home,
  Fuel,
  CreditCard,
  Plus,
  Filter,
  Calendar,
  Search,
  DollarSign,
  Coins,
  Settings as SettingsIcon,
  Trash2,
  Info,
  Clock,
  FileSpreadsheet,
  ArrowRightLeft,
  Package,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AppSettings, CashTransaction, Currency, Product } from '../../types';
import { LocalDatabase } from '../../services/db';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { NumberInput } from '../common/NumberInput';
import { Modal } from '../common/Modal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { UsdPurchaseModal } from './UsdPurchaseModal';
import { GoodsWithdrawalModal } from './GoodsWithdrawalModal';

interface CashBoxViewProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onRefreshData: () => void;
}

type TimeFilter = 'all' | 'today' | 'week' | 'month';
type TypeFilter = 'all' | 'in' | 'out';

export const CashBoxView: React.FC<CashBoxViewProps> = ({
  settings,
  onUpdateSettings,
  onRefreshData,
}) => {
  // Filter state
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<
    'abdallah_withdrawal' | 'partner_withdrawal' | 'special_expense' | 'capital_deposit'
  >('abdallah_withdrawal');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txCurrency, setTxCurrency] = useState<Currency>(settings.baseCurrency);
  const [txTitle, setTxTitle] = useState<string>('');
  const [txPerson, setTxPerson] = useState<string>('عبدالله');
  const [txNotes, setTxNotes] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Settings initial cash modal
  const [isInitialCashModalOpen, setIsInitialCashModalOpen] = useState(false);
  const [initialSYP, setInitialSYP] = useState<number>(settings.initialCashSYP || 0);
  const [initialUSD, setInitialUSD] = useState<number>(settings.initialCashUSD || 0);

  // New Accounting Modals
  const [isUsdPurchaseModalOpen, setIsUsdPurchaseModalOpen] = useState(false);
  const [isGoodsWithdrawalModalOpen, setIsGoodsWithdrawalModalOpen] = useState(false);
  const products = useMemo(() => LocalDatabase.getProducts(), [onRefreshData]);

  // Compute Cash Box summary and unified ledger
  const summary = useMemo(() => {
    return LocalDatabase.getCashBoxSummary();
  }, [settings, onRefreshData]);

  const rawLedger = useMemo(() => {
    return LocalDatabase.getCashBoxUnifiedLedger();
  }, [settings, onRefreshData]);

  const rate = settings.exchangeRate || 15000;
  const [simulatedRate, setSimulatedRate] = useState<number>(settings.exchangeRate || 15000);

  // Requirements 12 & 13 calculations:
  // 12. Cash Box valuation and exchange rate effect
  const cashSYPCurrentValuationUSD = Number((rate > 0 ? summary.expectedCashSYP / rate : 0).toFixed(2));
  const cashSYPSimulatedValuationUSD = Number((simulatedRate > 0 ? summary.expectedCashSYP / simulatedRate : 0).toFixed(2));
  const cashValuationDifferenceUSD = Number((cashSYPSimulatedValuationUSD - cashSYPCurrentValuationUSD).toFixed(2));

  // 13. Supplier Debt and Net USD Position
  const suppliers = useMemo(() => LocalDatabase.getSuppliers(), [onRefreshData]);
  // ديون الموردين بالدولار من كشف الحساب التاريخي (ثابتة لا تتأثر بسعر الليرة)
  const totalSupplierDebtUSD = useMemo(
    () => Number(suppliers.reduce((sum, s) => sum + LocalDatabase.getSupplierBalanceUSD(s.id), 0).toFixed(2)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suppliers, onRefreshData]
  );

  const totalCashInUSDCurrent = Number((summary.expectedCashUSD + cashSYPCurrentValuationUSD).toFixed(2));
  const totalCashInUSDSimulated = Number((summary.expectedCashUSD + cashSYPSimulatedValuationUSD).toFixed(2));

  const netUSDPositionCurrent = Number((totalCashInUSDCurrent - totalSupplierDebtUSD).toFixed(2));
  const netUSDPositionSimulated = Number((totalCashInUSDSimulated - totalSupplierDebtUSD).toFixed(2));

  // Open add transaction modal with preset
  const handleOpenAddModal = (
    category: 'abdallah_withdrawal' | 'partner_withdrawal' | 'special_expense' | 'capital_deposit'
  ) => {
    setModalCategory(category);
    setTxAmount(0);
    setTxCurrency(settings.baseCurrency);
    setTxNotes('');
    setTxDate(new Date().toISOString().slice(0, 10));

    if (category === 'abdallah_withdrawal') {
      setTxTitle('سحب شخصي - عبدالله');
      setTxPerson('عبدالله');
    } else if (category === 'partner_withdrawal') {
      setTxTitle(`سحب شخصي - ${settings.partnerName || 'الشريك'}`);
      setTxPerson(settings.partnerName || 'الشريك');
    } else if (category === 'special_expense') {
      setTxTitle('مصروف خاص (غير تشغيلي)');
      setTxPerson('عبدالله');
    } else {
      setTxTitle('إيداع نقدي في الصندوق / رأس مال');
      setTxPerson('عبدالله');
    }

    setIsAddModalOpen(true);
  };

  // Submit manual cash transaction
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (txAmount <= 0) {
      alert('يرجى كتابة مبلغ أكبر من الصفر');
      return;
    }

    const isDeposit = modalCategory === 'capital_deposit';
    LocalDatabase.addCashTransaction({
      type: isDeposit ? 'in' : 'out',
      category: modalCategory,
      title: txTitle.trim() || (isDeposit ? 'إيداع نقدي' : 'سحب نقدي'),
      amount: txAmount,
      currency: txCurrency,
      date: new Date(txDate).toISOString(),
      person: txPerson.trim(),
      notes: txNotes.trim(),
    });

    setIsAddModalOpen(false);
    onRefreshData();
  };

  // Delete transaction target for ConfirmDeleteModal
  const [deleteTxTarget, setDeleteTxTarget] = useState<{
    id: string;
    source?: string;
    title: string;
    amount: number;
    currency: Currency;
  } | null>(null);

  const confirmDeleteTx = () => {
    if (deleteTxTarget) {
      const id = deleteTxTarget.id;
      if (deleteTxTarget.source === 'sale') {
        const realId = id.replace('cash_sale_', '');
        LocalDatabase.deleteInvoice(realId);
      } else if (deleteTxTarget.source === 'customer_payment') {
        const realId = id.replace('cash_cp_', '');
        LocalDatabase.deleteCustomerPayment(realId);
      } else if (deleteTxTarget.source === 'purchase') {
        const realId = id.replace('cash_pur_', '');
        LocalDatabase.deletePurchaseInvoice(realId);
      } else if (deleteTxTarget.source === 'supplier_payment') {
        const realId = id.replace('cash_st_', '');
        LocalDatabase.deleteSupplierTransaction(realId);
      } else if (deleteTxTarget.source === 'expense') {
        const realId = id.replace('cash_exp_', '');
        LocalDatabase.deleteExpense(realId);
      } else {
        const realId = id.replace('cash_ctx_', '');
        LocalDatabase.deleteCashTransaction(realId);
      }
      setDeleteTxTarget(null);
      onRefreshData();
    }
  };

  // Save initial cash settings
  const handleSaveInitialCash = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...settings,
      initialCashSYP: initialSYP,
      initialCashUSD: initialUSD,
    };
    onUpdateSettings(updated);
    setIsInitialCashModalOpen(false);
    onRefreshData();
  };

  // Filter ledger
  const filteredLedger = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(now.getDate() - 30);

    return rawLedger.filter((item) => {
      // Time filter
      if (timeFilter === 'today') {
        if (!item.date.startsWith(todayStr)) return false;
      } else if (timeFilter === 'week') {
        if (new Date(item.date) < oneWeekAgo) return false;
      } else if (timeFilter === 'month') {
        if (new Date(item.date) < oneMonthAgo) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;

      // Currency filter
      if (currencyFilter !== 'all' && item.currency !== currencyFilter) return false;

      // Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'sales' && item.source !== 'sale') return false;
        if (categoryFilter === 'customers' && item.source !== 'customer_payment') return false;
        if (categoryFilter === 'purchases' && item.source !== 'purchase') return false;
        if (categoryFilter === 'suppliers' && item.source !== 'supplier_payment') return false;
        if (categoryFilter === 'expenses' && item.source !== 'expense') return false;
        if (categoryFilter === 'withdrawals' && item.source !== 'cash_tx') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${item.title} ${item.category} ${item.person || ''} ${item.notes || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [rawLedger, timeFilter, typeFilter, currencyFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-4 pb-20 font-display">
      {/* Top Header & Overview */}
      <div className="bg-white dark:bg-[#153243]/60 p-4 sm:p-5 rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FFF4E8] dark:bg-[#153243] text-[#FFAA47] flex items-center justify-center border border-amber-200/40 dark:border-white/10 shadow-xs">
                <Wallet className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>الصندوق وحركات النقد (Cash Box)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
                  معرفة كم يجب أن يكون معك من المال فعلياً ومتابعة جميع المقبوضات والمدفوعات.
                </p>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInitialSYP(settings.initialCashSYP || 0);
                setInitialUSD(settings.initialCashUSD || 0);
                setIsInitialCashModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 cursor-pointer font-display"
              title="تعديل الرصيد الافتتاحي للصندوق"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-[#FFAA47]" />
              <span>الرصيد الافتتاحي</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddModal('capital_deposit')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer font-display"
            >
              <Plus className="w-4 h-4" />
              <span>إيداع نقدي</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddModal('abdallah_withdrawal')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer font-display"
            >
              <Plus className="w-4 h-4" />
              <span>سحب عبدالله</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddModal('partner_withdrawal')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer font-display"
            >
              <Plus className="w-4 h-4" />
              <span>سحب الشريك</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenAddModal('special_expense')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer font-display"
            >
              <Plus className="w-4 h-4" />
              <span>مصروف خاص</span>
            </button>

            {/* Accounting additions: USD Purchase & Goods Withdrawal */}
            <button
              type="button"
              onClick={() => setIsUsdPurchaseModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer font-display"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>شراء دولار نقدي</span>
            </button>

            <button
              type="button"
              onClick={() => setIsGoodsWithdrawalModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer font-display"
            >
              <Package className="w-4 h-4" />
              <span>سحب بضاعة بالتكلفة</span>
            </button>
          </div>
        </div>

        {/* The Math Formula Banner */}
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>معادلة الصندوق:</span>
            <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-300">
              الرصيد المتوقع = الرصيد الافتتاحي + الأموال الداخلة − الأموال الخارجة
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            سعر الصرف المعتمد: 1$ = {settings.exchangeRate?.toLocaleString('en-US')} ل.س
          </div>
        </div>
      </div>

      {/* Main Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Expected SYP Cash */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 shadow-xs">
          <div className="flex items-center justify-between text-blue-900 dark:text-blue-300">
            <span className="text-xs font-bold">💰 المتوقع بالليرة السورية</span>
            <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-950 dark:text-blue-100 font-mono mt-2">
            {summary.expectedCashSYP.toLocaleString('en-US')}
            <span className="text-xs font-bold mr-1 text-blue-700 dark:text-blue-300">ل.س</span>
          </div>
          <div className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-1 flex items-center justify-between border-t border-blue-200/60 dark:border-blue-800/40 pt-1.5 font-mono">
            <span>افتتاحي: {summary.initialCashSYP.toLocaleString('en-US')}</span>
            <span>صافي: {(summary.inSYP - summary.outSYP).toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Expected USD Cash */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-300">
            <span className="text-xs font-bold">💵 المتوقع بالدولار</span>
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 font-mono mt-2">
            {summary.expectedCashUSD.toLocaleString('en-US')}
            <span className="text-xs font-bold mr-1 text-emerald-700 dark:text-emerald-300">$</span>
          </div>
          <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-1 flex items-center justify-between border-t border-emerald-200/60 dark:border-emerald-800/40 pt-1.5 font-mono">
            <span>افتتاحي: {summary.initialCashUSD.toLocaleString('en-US')} $</span>
            <span>صافي: {(summary.inUSD - summary.outUSD).toLocaleString('en-US')} $</span>
          </div>
        </div>

        {/* Total Inflows */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
              📥 إجمالي الداخل للصندوق
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-2">
            {summary.inSYP.toLocaleString('en-US')}{' '}
            <span className="text-xs font-bold text-slate-500">ل.س</span>
          </div>
          {summary.inUSD > 0 && (
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              + {summary.inUSD.toLocaleString('en-US')} $
            </div>
          )}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1 flex justify-between">
            <span>مبيعات: {summary.salesInSYP.toLocaleString('en-US')}</span>
            <span>دفعات: {summary.custPaymentsInSYP.toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Total Outflows */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span className="text-xs font-bold flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <ArrowUpRight className="w-4 h-4" />
              📤 إجمالي الخارج من الصندوق
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono mt-2">
            {summary.outSYP.toLocaleString('en-US')}{' '}
            <span className="text-xs font-bold text-slate-500">ل.س</span>
          </div>
          {summary.outUSD > 0 && (
            <div className="text-xs font-bold text-red-600 dark:text-red-400 font-mono">
              + {summary.outUSD.toLocaleString('en-US')} $
            </div>
          )}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1 flex justify-between">
            <span>مشتريات: {summary.purchasesOutSYP.toLocaleString('en-US')}</span>
            <span>مصاريف: {summary.operatingExpensesOutSYP.toLocaleString('en-US')}</span>
          </div>
        </div>
      </div>

      {/* Secondary Outflows Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* Abdallah Withdrawals */}
        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40">
          <div className="flex items-center gap-1.5 text-blue-900 dark:text-blue-300 text-xs font-bold">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>سحوبات عبدالله</span>
          </div>
          <div className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 mt-1">
            {summary.abdallahWithdrawalsSYP.toLocaleString('en-US')}{' '}
            <span className="text-[10px] text-slate-500">ل.س</span>
          </div>
          {summary.abdallahWithdrawalsUSD > 0 && (
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              {summary.abdallahWithdrawalsUSD.toLocaleString('en-US')} $
            </div>
          )}
        </div>

        {/* Partner Withdrawals */}
        <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/40">
          <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-300 text-xs font-bold">
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span>سحب الشريك</span>
          </div>
          <div className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 mt-1">
            {summary.partnerWithdrawalsSYP.toLocaleString('en-US')}{' '}
            <span className="text-[10px] text-slate-500">ل.س</span>
          </div>
          {summary.partnerWithdrawalsUSD > 0 && (
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              {summary.partnerWithdrawalsUSD.toLocaleString('en-US')} $
            </div>
          )}
        </div>

        {/* Special Expenses */}
        <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 text-xs font-bold">
            <Home className="w-3.5 h-3.5 text-amber-600" />
            <span>المصروف الخاص</span>
          </div>
          <div className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 mt-1">
            {summary.specialExpensesSYP.toLocaleString('en-US')}{' '}
            <span className="text-[10px] text-slate-500">ل.س</span>
          </div>
          {summary.specialExpensesUSD > 0 && (
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              {summary.specialExpensesUSD.toLocaleString('en-US')} $
            </div>
          )}
        </div>

        {/* Operating Expenses */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 text-xs font-bold">
            <Fuel className="w-3.5 h-3.5 text-orange-500" />
            <span>مصاريف التشغيل</span>
          </div>
          <div className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 mt-1">
            {summary.operatingExpensesOutSYP.toLocaleString('en-US')}{' '}
            <span className="text-[10px] text-slate-500">ل.س</span>
          </div>
          {summary.operatingExpensesOutUSD > 0 && (
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              {summary.operatingExpensesOutUSD.toLocaleString('en-US')} $
            </div>
          )}
        </div>

        {/* Supplier Payments */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 text-xs font-bold">
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            <span>دفعات الموردين</span>
          </div>
          <div className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 mt-1">
            {summary.supplierPaymentsOutSYP.toLocaleString('en-US')}{' '}
            <span className="text-[10px] text-slate-500">ل.س</span>
          </div>
          {summary.supplierPaymentsOutUSD > 0 && (
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
              {summary.supplierPaymentsOutUSD.toLocaleString('en-US')} $
            </div>
          )}
        </div>
      </div>

      {/* Requirements 12 & 13: Cash Box Valuation & Supplier Debt Exchange Rate Effect */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-900/60 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>أثر تغير سعر الصرف على نقدية الصندوق والموقف المالي (Exchange-Rate Effect)</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              الأصل المحفوظ في الصندوق وديون الموردين تبقى ثابتة دائماً • التقييم بالدولار فقط هو الذي يتغير
            </p>
          </div>
          <div className="text-xs font-mono text-indigo-700 dark:text-indigo-300 font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-indigo-200 dark:border-indigo-800 shrink-0 self-start sm:self-auto">
            سعر الصرف المعتمد: 1$ = {rate.toLocaleString('en-US')} ل.س
          </div>
        </div>

        {/* 3 Overview Cards: Cash Preserved, Supplier Debt, Net Position */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Card 1: Cash box SYP & USD valuation */}
          <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
            <span className="text-[10px] text-slate-400 block mb-0.5 font-bold">
              1. نقدية الصندوق بالليرة (الأصل المحفوظ):
            </span>
            <div className="text-base font-black font-mono text-slate-900 dark:text-slate-100">
              {summary.expectedCashSYP.toLocaleString('en-US')} <span className="text-xs font-normal text-slate-400">ل.س</span>
            </div>
            <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold mt-1">
              التقييم الحالي: ${cashSYPCurrentValuationUSD.toLocaleString('en-US')} دولار
            </div>
            {summary.expectedCashUSD > 0 && (
              <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
                + ${summary.expectedCashUSD.toLocaleString('en-US')} دولار كاش (الإجمالي: ${totalCashInUSDCurrent})
              </div>
            )}
          </div>

          {/* Card 2: Supplier Debt */}
          <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
            <span className="text-[10px] text-slate-400 block mb-0.5 font-bold">
              2. ديون ومطالبات الموردين (المستحقة):
            </span>
            <div className="text-base font-black font-mono text-red-600 dark:text-red-400">
              ${totalSupplierDebtUSD.toLocaleString('en-US')} USD
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              دين ثابت بذمة المركز لا يتغير بتغير سعر الصرف
            </span>
          </div>

          {/* Card 3: Net USD Position */}
          <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
            <span className="text-[10px] text-slate-400 block mb-0.5 font-bold">
              3. صافي الموقف المالي للنقدية (1 - 2):
            </span>
            <div className={`text-base font-black font-mono ${netUSDPositionCurrent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {netUSDPositionCurrent >= 0 ? '+' : ''}${netUSDPositionCurrent.toLocaleString('en-US')} USD
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              (نقدية الصندوق بالدولار) − (ديون الموردين)
            </span>
          </div>
        </div>

        {/* Interactive Rate Sensitivity & What-If Simulation (Requirements 12 & 13) */}
        <div className="p-3.5 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>محاكاة أثر تغير سعر الصرف على التقييم المالي (What-If Analysis):</span>
            </span>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                سعر صرف تجريبي (SYP/USD):
              </label>
              <input
                type="number"
                value={simulatedRate}
                onChange={(e) => setSimulatedRate(Math.max(1, Number(e.target.value)))}
                className="w-24 h-8 px-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-slate-100 text-center"
              />
              {simulatedRate !== rate && (
                <button
                  type="button"
                  onClick={() => setSimulatedRate(rate)}
                  className="text-[10px] text-slate-400 hover:text-indigo-600 underline"
                >
                  استعادة
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-sans">نقدية الليرة بالصندوق:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {summary.expectedCashSYP.toLocaleString('en-US')} ل.س
              </span>
              <span className="text-[9px] text-emerald-600 block font-sans">ثابتة 100% لا تتغير</span>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-sans">التقييم بالسعر التجريبي:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                ${cashSYPSimulatedValuationUSD.toLocaleString('en-US')}
              </span>
              <span className="text-[9px] text-slate-400 block font-sans">
                {cashValuationDifferenceUSD !== 0 ? `فارق: ${cashValuationDifferenceUSD > 0 ? '+' : ''}${cashValuationDifferenceUSD} $` : 'مطابق لسعر اليوم'}
              </span>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-sans">دين الموردين بالدولار:</span>
              <span className="font-bold text-red-600 dark:text-red-400">
                ${totalSupplierDebtUSD.toLocaleString('en-US')}
              </span>
              <span className="text-[9px] text-emerald-600 block font-sans">ثابت 100% لا يتغير</span>
            </div>

            <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 block font-sans">الموقف المالي التجريبي:</span>
              <span className={`font-bold ${netUSDPositionSimulated >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {netUSDPositionSimulated >= 0 ? '+' : ''}${netUSDPositionSimulated.toLocaleString('en-US')}
              </span>
              <span className="text-[9px] text-slate-400 block font-sans">الصافي بالدولار</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Box Ledger & Filters Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>سجل حركات الصندوق المفصل</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              عرض تفصيلي لجميع المقبوضات والمدفوعات مرتبة زمنياً من الأحدث إلى الأقدم.
            </p>
          </div>

          {/* Time Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'today', label: 'اليوم' },
                { id: 'week', label: 'هذا الأسبوع' },
                { id: 'month', label: 'هذا الشهر' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  timeFilter === t.id
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          {/* Search box */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 ابحث في الوصف، الشخص، أو الملاحظة..."
              className="w-full h-10 pr-9 pl-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 outline-hidden"
            />
          </div>

          {/* Direction Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
            >
              <option value="all">جميع الحركات (داخل وخارج)</option>
              <option value="in">📥 الداخل فقط (مقبوضات)</option>
              <option value="out">📤 الخارج فقط (مدفوعات)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100"
            >
              <option value="all">جميع التصنيفات</option>
              <option value="sales">مبيعات نقدية</option>
              <option value="customers">دفعات عملاء</option>
              <option value="purchases">مشتريات نقدية</option>
              <option value="suppliers">دفعات موردين</option>
              <option value="expenses">مصاريف تشغيلية</option>
              <option value="withdrawals">سحوبات شخصية وإيداعات</option>
            </select>
          </div>
        </div>

        {/* Ledger List */}
        <div className="space-y-2 pt-2">
          {filteredLedger.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <FileSpreadsheet className="w-8 h-8 mx-auto opacity-30 mb-1" />
              <p className="text-sm font-bold">لا توجد حركات نقدية مطابقة للفلتر المحدد</p>
            </div>
          ) : (
            filteredLedger.map((item) => {
              const isIn = item.type === 'in';
              const isManual = item.source === 'cash_tx';
              const dateObj = new Date(item.date);
              const dateFormatted = dateObj.toLocaleDateString('ar-SY');
              const timeFormatted = dateObj.toLocaleTimeString('ar-SY', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  {/* Left: Direction + Details */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIn
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80'
                          : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/80'
                      }`}
                    >
                      {isIn ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {item.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isIn
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.category}
                        </span>
                        {item.person && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {item.person}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateFormatted}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{timeFormatted}</span>
                        </span>
                        {item.notes && (
                          <span className="text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            ملاحظة: {item.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Delete button */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-right">
                      <div
                        className={`text-base font-black font-mono ${
                          isIn
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isIn ? '+' : '-'}{item.amount.toLocaleString('en-US')}
                        <span className="text-xs font-bold mr-1">
                          {item.currency === 'USD' ? '$' : 'ل.س'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {isIn ? 'وارد نقدي' : 'صادر نقدي'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTxTarget({
                          id: item.id,
                          source: item.source,
                          title: item.title,
                          amount: item.amount,
                          currency: item.currency,
                        })
                      }
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                      title="حذف الحركة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={
          modalCategory === 'capital_deposit'
            ? 'إيداع نقدي جديد في الصندوق'
            : modalCategory === 'abdallah_withdrawal'
            ? 'تسجيل سحب شخصي - عبدالله'
            : modalCategory === 'partner_withdrawal'
            ? 'تسجيل سحب شخصي - الشريك'
            : 'تسجيل مصروف خاص (شخصي)'
        }
        maxWidth="md"
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-slate-800/80 rounded-xl border border-blue-200 dark:border-slate-700 text-xs text-blue-900 dark:text-blue-300">
            {modalCategory === 'capital_deposit' ? (
              <span>يدخل هذا المبلغ مباشرة إلى الصندوق ويزيد الرصيد المتوقع.</span>
            ) : (
              <span>
                هذا المبلغ يخرج من الصندوق ويخصم من الرصيد المتوقع، <strong>ولا يعتبر من المصاريف التشغيلية</strong> حتى لا تتشوه أرباح العمل.
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              عنوان الحركة / البيان
            </label>
            <input
              type="text"
              value={txTitle}
              onChange={(e) => setTxTitle(e.target.value)}
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                المبلغ <span className="text-red-500">*</span>
              </label>
              <NumberInput
                value={txAmount}
                onChange={setTxAmount}
                placeholder="0"
                min={0}
                className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                العملة
              </label>
              <div className="flex h-11 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setTxCurrency('SYP')}
                  className={`flex-1 rounded-lg text-xs font-bold transition ${
                    txCurrency === 'SYP'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ل.س
                </button>
                <button
                  type="button"
                  onClick={() => setTxCurrency('USD')}
                  className={`flex-1 rounded-lg text-xs font-bold transition ${
                    txCurrency === 'USD'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  دولار ($)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                الشخص المعني
              </label>
              <input
                type="text"
                value={txPerson}
                onChange={(e) => setTxPerson(e.target.value)}
                className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                التاريخ
              </label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات إضافية
            </label>
            <input
              type="text"
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
              placeholder="مثال: تسديد دفعة شخصية، مصروف عائلي، إلخ"
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              حفظ وتحديث الصندوق
            </button>
          </div>
        </form>
      </Modal>

      {/* Initial Cash Modal */}
      <Modal
        isOpen={isInitialCashModalOpen}
        onClose={() => setIsInitialCashModalOpen(false)}
        title="تحديد الرصيد الافتتاحي للصندوق"
        maxWidth="md"
      >
        <form onSubmit={handleSaveInitialCash} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            المبلغ الذي كان متوفراً معك في الصندوق لحظة بدء استخدام التطبيق أو بداية الجرد.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الرصيد الافتتاحي بالليرة السورية (SYP)
            </label>
            <NumberInput
              value={initialSYP}
              onChange={setInitialSYP}
              placeholder="0"
              min={0}
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الرصيد الافتتاحي بالدولار (USD)
            </label>
            <NumberInput
              value={initialUSD}
              onChange={setInitialUSD}
              placeholder="0"
              min={0}
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsInitialCashModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              حفظ الرصيد الافتتاحي
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Transaction Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTxTarget}
        onClose={() => setDeleteTxTarget(null)}
        onConfirm={confirmDeleteTx}
        title="تأكيد حذف حركة الصندوق"
        itemName={
          deleteTxTarget
            ? `${deleteTxTarget.title} بمبلغ ${deleteTxTarget.amount.toLocaleString('en-US')} ${
                deleteTxTarget.currency === 'USD' ? '$' : 'ل.س'
              }`
            : undefined
        }
        warningDetails="سيتم حذف هذه الحركة وإلغاء تأثيرها المالي على رصيد الصندوق المتوقع فوراً."
      />

      {/* USD Purchase Modal */}
      <UsdPurchaseModal
        isOpen={isUsdPurchaseModalOpen}
        onClose={() => setIsUsdPurchaseModalOpen(false)}
        settings={settings}
        onSuccess={() => onRefreshData()}
      />

      {/* Goods Withdrawal Modal */}
      <GoodsWithdrawalModal
        isOpen={isGoodsWithdrawalModalOpen}
        onClose={() => setIsGoodsWithdrawalModalOpen(false)}
        settings={settings}
        products={products}
        onSuccess={() => onRefreshData()}
      />
    </div>
  );
};
