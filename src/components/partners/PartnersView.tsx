import React, { useState, useMemo } from 'react';
import {
  Users,
  DollarSign,
  Coins,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  Calendar,
  Clock,
  ShieldCheck,
  TrendingDown,
  FileSpreadsheet,
  AlertCircle,
  ShoppingBag,
  Edit3,
  PlusCircle,
  MinusCircle,
  Receipt,
  Wallet,
} from 'lucide-react';
import {
  AppSettings,
  Currency,
  Product,
  PartnerCapitalTransaction,
  PartnerCapitalTransactionType,
} from '../../types';
import { LocalDatabase } from '../../services/db';
import { GoodsWithdrawalModal } from '../cashbox/GoodsWithdrawalModal';
import { Modal } from '../common/Modal';
import { NumberInput } from '../common/NumberInput';

interface PartnersViewProps {
  settings: AppSettings;
  products: Product[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onRefreshData?: () => void;
}

export const PartnersView: React.FC<PartnersViewProps> = ({
  settings,
  products,
  onUpdateSettings,
  onRefreshData,
}) => {
  const [isGoodsModalOpen, setIsGoodsModalOpen] = useState(false);
  const [isCashWithdrawalOpen, setIsCashWithdrawalOpen] = useState(false);
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);

  // Capital Transaction Modal State (إيداع / استرداد)
  const [editingCapitalTx, setEditingCapitalTx] = useState<PartnerCapitalTransaction | null>(null);
  const [capitalTxType, setCapitalTxType] = useState<PartnerCapitalTransactionType>('deposit');
  const [capitalAmount, setCapitalAmount] = useState<number>(0);
  const [capitalCurrency, setCapitalCurrency] = useState<Currency>('USD');
  const [capitalExchangeRate, setCapitalExchangeRate] = useState<number>(settings.exchangeRate || 15000);
  const [capitalDate, setCapitalDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [capitalNotes, setCapitalNotes] = useState<string>('');

  // Cash withdrawal form state
  const [withdrawer, setWithdrawer] = useState<'abdallah' | 'partner'>('partner');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cashCurrency, setCashCurrency] = useState<Currency>('SYP');
  const [cashNotes, setCashNotes] = useState<string>('');
  const [cashDate, setCashDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Partner name state
  const [partnerName, setPartnerName] = useState<string>(settings.partnerName || 'الشريك');

  // Filter state for transactions
  const [personFilter, setPersonFilter] = useState<'all' | 'partner' | 'abdallah'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'cash' | 'goods' | 'capital'>('all');

  const rate = settings.exchangeRate || 15000;

  // Partner Capital Summary (starts strictly at 0 USD)
  const capitalSummary = useMemo(() => {
    return LocalDatabase.getPartnerCapitalSummary();
  }, [onRefreshData, isCapitalModalOpen]);

  // Partner summary
  const partnerSummary = useMemo(() => {
    return LocalDatabase.getPartnerAccountSummary();
  }, [settings, onRefreshData, capitalSummary]);

  // Goods withdrawals list
  const goodsWithdrawals = useMemo(() => {
    return LocalDatabase.getGoodsWithdrawals();
  }, [onRefreshData, isGoodsModalOpen]);

  // Cash withdrawals list from cashbox
  const cashTransactions = useMemo(() => {
    return LocalDatabase.getCashTransactions().filter((t) => {
      return (
        t.category === 'partner_withdrawal' ||
        t.category === 'abdallah_withdrawal' ||
        t.category === 'capital_deposit' ||
        t.category === 'partner_capital_repayment' ||
        t.person === 'الشريك' ||
        t.person === 'عبدالله' ||
        t.person === (settings.partnerName || 'الشريك')
      );
    });
  }, [onRefreshData, isCashWithdrawalOpen]);

  // Combined operations log
  const operationsLog = useMemo(() => {
    const list: Array<{
      id: string;
      source: 'goods' | 'cash' | 'capital';
      person: 'partner' | 'abdallah';
      personLabel: string;
      type: 'سحب بضاعة' | 'سحب نقدي' | 'رأس مال';
      title: string;
      amountOriginal: number;
      currency: Currency;
      amountUSD: number;
      date: string;
      notes?: string;
    }> = [];

    // Add goods withdrawals
    for (const g of goodsWithdrawals) {
      const isPartner = g.person === 'partner';
      const usdVal = g.currency === 'USD' ? g.totalCost : g.totalCost / rate;
      list.push({
        id: 'goods_' + g.id,
        source: 'goods',
        person: g.person,
        personLabel: isPartner ? (settings.partnerName || 'الشريك') : 'عبدالله',
        type: 'سحب بضاعة',
        title: `سحب بضاعة: ${g.productName} (${g.cartons > 0 ? g.cartons + ' كرتونة ' : ''}${g.pieces > 0 ? g.pieces + ' قطعة' : ''}) بسعر التكلفة`,
        amountOriginal: g.totalCost,
        currency: g.currency,
        amountUSD: usdVal,
        date: g.date || g.createdAt,
        notes: g.notes,
      });
    }

    // Add cash transactions (excluding capital repayments which are added from capitalSummary)
    for (const c of cashTransactions) {
      if (c.category === 'partner_capital_repayment') continue;
      const isPartner =
        c.category === 'partner_withdrawal' ||
        c.person === 'الشريك' ||
        c.person === (settings.partnerName || 'الشريك');
      const usdVal = c.currency === 'USD' ? c.amount : c.amount / rate;
      const opType = c.category === 'capital_deposit' ? 'رأس مال' : 'سحب نقدي';
      list.push({
        id: 'cash_' + c.id,
        source: 'cash',
        person: isPartner ? 'partner' : 'abdallah',
        personLabel: isPartner ? (settings.partnerName || 'الشريك') : 'عبدالله',
        type: opType,
        title: c.title || (c.category === 'capital_deposit' ? 'إيداع رأس مال' : 'سحب نقدي'),
        amountOriginal: c.amount,
        currency: c.currency,
        amountUSD: usdVal,
        date: c.date || c.createdAt,
        notes: c.notes,
      });
    }

    // Add partner capital transactions (حركات رأس المال الموثقة)
    for (const tx of capitalSummary.transactions) {
      const isDeposit = tx.type === 'deposit';
      list.push({
        id: 'cap_' + tx.id,
        source: 'capital',
        person: 'partner',
        personLabel: tx.partnerName || settings.partnerName || 'الشريك',
        type: 'رأس مال',
        title: isDeposit
          ? `إضافة رأس مال: ${tx.amount.toLocaleString()} ${tx.currency === 'USD' ? '$' : 'ل.س'}`
          : `استرداد من رأس المال: ${tx.amount.toLocaleString()} ${tx.currency === 'USD' ? '$' : 'ل.س'}`,
        amountOriginal: tx.amount,
        currency: tx.currency,
        amountUSD: tx.equivalentUSD,
        date: tx.date || tx.createdAt,
        notes: tx.notes,
      });
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [goodsWithdrawals, cashTransactions, capitalSummary.transactions, rate, settings.partnerName]);

  // Filtered log
  const filteredLog = useMemo(() => {
    return operationsLog.filter((item) => {
      if (personFilter !== 'all' && item.person !== personFilter) return false;
      if (typeFilter === 'cash' && item.type !== 'سحب نقدي') return false;
      if (typeFilter === 'goods' && item.type !== 'سحب بضاعة') return false;
      if (typeFilter === 'capital' && item.type !== 'رأس مال') return false;
      return true;
    });
  }, [operationsLog, personFilter, typeFilter]);

  // Handle Save Cash Withdrawal
  const handleSaveCashWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (cashAmount <= 0) return;

    const isPartner = withdrawer === 'partner';
    const personName = isPartner ? (settings.partnerName || 'الشريك') : 'عبدالله';

    LocalDatabase.addCashTransaction({
      type: 'out',
      category: isPartner ? 'partner_withdrawal' : 'abdallah_withdrawal',
      title: `سحب نقدي شخصي - ${personName}`,
      amount: cashAmount,
      currency: cashCurrency,
      date: cashDate ? new Date(cashDate).toISOString() : new Date().toISOString(),
      person: personName,
      notes: cashNotes.trim() || undefined,
    });

    setIsCashWithdrawalOpen(false);
    setCashAmount(0);
    setCashNotes('');
    if (onRefreshData) onRefreshData();
  };

  // Capital Transaction Handlers
  const handleOpenAddCapital = (type: PartnerCapitalTransactionType = 'deposit') => {
    setEditingCapitalTx(null);
    setCapitalTxType(type);
    setCapitalAmount(0);
    setCapitalCurrency('USD');
    setCapitalExchangeRate(settings.exchangeRate || 15000);
    setCapitalDate(new Date().toISOString().slice(0, 10));
    setCapitalNotes('');
    setIsCapitalModalOpen(true);
  };

  const handleOpenEditCapital = (tx: PartnerCapitalTransaction) => {
    setEditingCapitalTx(tx);
    setCapitalTxType(tx.type);
    setCapitalAmount(tx.amount);
    setCapitalCurrency(tx.currency);
    setCapitalExchangeRate(tx.exchangeRate || settings.exchangeRate || 15000);
    setCapitalDate(tx.date ? tx.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setCapitalNotes(tx.notes || '');
    setIsCapitalModalOpen(true);
  };

  const handleSaveCapitalTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (capitalAmount <= 0) return;

    const opRate = capitalCurrency === 'SYP' ? (capitalExchangeRate || settings.exchangeRate || 15000) : 1;
    const equivalentUSD = capitalCurrency === 'USD'
      ? capitalAmount
      : (opRate > 0 ? Number((capitalAmount / opRate).toFixed(2)) : 0);

    const txDate = capitalDate ? new Date(capitalDate).toISOString() : new Date().toISOString();

    if (editingCapitalTx) {
      LocalDatabase.updatePartnerCapitalTransaction({
        ...editingCapitalTx,
        type: capitalTxType,
        partnerName: partnerName.trim() || settings.partnerName || 'الشريك',
        amount: capitalAmount,
        currency: capitalCurrency,
        exchangeRate: capitalCurrency === 'SYP' ? opRate : undefined,
        equivalentUSD,
        date: txDate,
        notes: capitalNotes.trim() || undefined,
      });
    } else {
      LocalDatabase.addPartnerCapitalTransaction({
        type: capitalTxType,
        partnerName: partnerName.trim() || settings.partnerName || 'الشريك',
        amount: capitalAmount,
        currency: capitalCurrency,
        exchangeRate: capitalCurrency === 'SYP' ? opRate : undefined,
        equivalentUSD,
        date: txDate,
        notes: capitalNotes.trim() || undefined,
      });
    }

    setIsCapitalModalOpen(false);
    setEditingCapitalTx(null);
    setCapitalAmount(0);
    setCapitalNotes('');
    if (onRefreshData) onRefreshData();
  };

  const handleDeleteCapitalTx = (id: string) => {
    const isConfirm = window.confirm(
      'هل أنت متأكد من حذف حركة رأس المال هذه؟ سيتم إعادة احتساب الرصيد المتبقي وكافة التقارير تلقائياً.'
    );
    if (!isConfirm) return;

    LocalDatabase.deletePartnerCapitalTransaction(id);
    if (onRefreshData) onRefreshData();
  };

  // Handle Delete Operation
  const handleDeleteOperation = (item: (typeof operationsLog)[0]) => {
    const isConfirm = window.confirm(`هل أنت متأكد من حذف هذه الحركة: ${item.title}؟`);
    if (!isConfirm) return;

    if (item.source === 'goods') {
      const realId = item.id.replace('goods_', '');
      LocalDatabase.deleteGoodsWithdrawal(realId);
    } else if (item.source === 'capital' || item.id.startsWith('cap_')) {
      const realId = item.id.replace('cap_', '');
      LocalDatabase.deletePartnerCapitalTransaction(realId);
    } else {
      const realId = item.id.replace('cash_', '');
      LocalDatabase.deleteCashTransaction(realId);
    }
    if (onRefreshData) onRefreshData();
  };

  // Partner net current balance (Remaining Capital - Total Withdrawn)
  const partnerNetBalanceUSD = capitalSummary.remainingCapitalUSD - partnerSummary.partnerTotalWithdrawnUSD;

  return (
    <div className="space-y-6 pb-24 font-display">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-l from-[#153243] to-[#0f2430] p-6 rounded-3xl text-white shadow-xl border border-white/10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FFAA47] text-slate-950 flex items-center justify-center font-bold shadow-lg">
              <Users className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black">الشركاء ورأس المال والحسابات الجارية</h2>
              <p className="text-xs text-slate-300">
                إدارة دقيقة لحركات رأس مال الشريك (يبدأ من 0 $)، مسحوبات الشركاء بالتكلفة، وحساب عبدالله
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenAddCapital('deposit')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs transition cursor-pointer shadow-md active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة رأس مال</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddCapital('refund')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer shadow-md active:scale-95"
          >
            <MinusCircle className="w-4 h-4" />
            <span>استرداد رأس مال</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setWithdrawer('partner');
              setIsCashWithdrawalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition cursor-pointer shadow-md active:scale-95"
          >
            <Coins className="w-4 h-4" />
            <span>سحب نقدي (كاش)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGoodsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer border border-white/10"
          >
            <Package className="w-4 h-4 text-[#FFAA47]" />
            <span>سحب بضاعة</span>
          </button>
        </div>
      </div>

      {/* ================= SECTION: Partner Capital & Movements (رأس مال الشريك وحركاته) ================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/50 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 dark:border-emerald-950/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>رأس مال {settings.partnerName || 'الشريك'} وحركاته الموثقة</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold">
                  {capitalSummary.transactionsCount} حركة
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                يبدأ من 0 $ ويُحدد بدقة فقط بناءً على الحركات المسجلة (إيداع أو استرداد) بالسعر التاريخي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddCapital('deposit')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة رأس مال</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAddCapital('refund')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <MinusCircle className="w-4 h-4" />
              <span>استرداد رأس مال</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards for Partner Capital */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Deposited */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold">
              <span>إجمالي رأس المال المضاف:</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">
              ${capitalSummary.totalDepositedUSD.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              ~ {capitalSummary.totalDepositedSYP.toLocaleString()} ل.س
            </div>
          </div>

          {/* Card 2: Total Refunded */}
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold">
              <span>إجمالي رأس المال المسترد:</span>
              <ArrowDownLeft className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-black text-amber-700 dark:text-amber-400">
              ${capitalSummary.totalRefundedUSD.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              ~ {capitalSummary.totalRefundedSYP.toLocaleString()} ل.س
            </div>
          </div>

          {/* Card 3: Remaining Capital */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold">
              <span>رأس المال المتبقي للشريك:</span>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-black text-blue-700 dark:text-blue-400">
              ${capitalSummary.remainingCapitalUSD.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              ~ {capitalSummary.remainingCapitalSYP.toLocaleString()} ل.س
            </div>
          </div>
        </div>

        {/* Capital Transactions List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>قائمة حركات رأس المال (من الأحدث إلى الأقدم)</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              القيمة المحاسبية بالدولار ثابتة تاريخياً
            </span>
          </div>

          {capitalSummary.transactions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto text-slate-500">
                <DollarSign className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                رأس مال الشريك يبدأ من 0 USD (لا توجد مبالغ مفترضة)
              </p>
              <p className="text-[11px] text-slate-400">
                اضغط على زر <strong className="text-emerald-600">"إضافة رأس مال"</strong> لتسجيل رأس المال الأصلي أو أي مساهمة جديدة.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
              {capitalSummary.transactions.map((tx) => {
                const isDeposit = tx.type === 'deposit';
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                          isDeposit
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {isDeposit ? (
                          <PlusCircle className="w-5 h-5" />
                        ) : (
                          <MinusCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
                              isDeposit
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {isDeposit ? 'إضافة رأس مال' : 'استرداد رأس مال'}
                          </span>
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {tx.amount.toLocaleString()} {tx.currency === 'USD' ? '$ دولار' : 'ل.س'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(tx.date).toLocaleDateString('ar-SY')}
                          </span>
                          {tx.currency === 'SYP' && tx.exchangeRate && (
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              سعر الصرف: {tx.exchangeRate.toLocaleString()} ل.س
                            </span>
                          )}
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            القيمة المحاسبية: ${tx.equivalentUSD.toLocaleString()}
                          </span>
                        </div>
                        {tx.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                            {tx.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEditCapital(tx)}
                        className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                        title="تعديل الحركة"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCapitalTx(tx.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                        title="حذف الحركة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main 2 Cards: Partner Account vs Abdallah Account */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Partner Account Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-purple-200 dark:border-purple-900/50 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-900/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  حساب {settings.partnerName || 'الشريك'} (الممول والشريك)
                </h3>
                <span className="text-xs text-slate-400">رأس المال الاستثماري والمسحوبات التراكمية</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-black text-xs">
              رأس المال المتبقي: ${capitalSummary.remainingCapitalUSD.toLocaleString()}
            </span>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Cash Withdrawals */}
            <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
              <span className="text-slate-500 dark:text-slate-400 block font-medium mb-1">
                مسحوبات نقدية (كاش الصندوق):
              </span>
              <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                {partnerSummary.partnerCashSYP.toLocaleString()} <span className="text-[10px]">ل.س</span>
              </div>
              {partnerSummary.partnerCashUSD > 0 && (
                <div className="font-bold text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                  + ${partnerSummary.partnerCashUSD.toLocaleString()}
                </div>
              )}
            </div>

            {/* Goods Withdrawals */}
            <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
              <span className="text-slate-500 dark:text-slate-400 block font-medium mb-1">
                مسحوبات بضاعة (بسعر التكلفة):
              </span>
              <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                {partnerSummary.partnerGoodsSYP.toLocaleString()} <span className="text-[10px]">ل.س</span>
              </div>
              {partnerSummary.partnerGoodsUSD > 0 && (
                <div className="font-bold text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                  + ${partnerSummary.partnerGoodsUSD.toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Summary Totals */}
          <div className="p-4 rounded-2xl bg-purple-950/5 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>إجمالي مسحوبات الشريك المقومة بالدولار:</span>
              <span className="text-red-600 dark:text-red-400 font-black">
                ${Math.round(partnerSummary.partnerTotalWithdrawnUSD).toLocaleString()}
              </span>
            </div>

            <div className="pt-2 border-t border-purple-200/80 dark:border-purple-900/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-purple-900 dark:text-purple-200 block">
                  صافي الحساب الجاري للشريك (رأس المال - المسحوبات):
                </span>
                <span className="text-[10px] text-slate-400">
                  المتبقي من رأس المال لصالح الشريك قبل الأرباح
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                  ${Math.round(partnerNetBalanceUSD).toLocaleString()}
                </span>
                <div className="text-[10px] text-slate-400">
                  ~ {(Math.round(partnerNetBalanceUSD * rate)).toLocaleString()} ل.س
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Abdallah Account Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-200 dark:border-amber-900/50 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-amber-100 dark:border-amber-900/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  حساب عبدالله (الإدارة والتشغيل)
                </h3>
                <span className="text-xs text-slate-400">المسحوبات الشخصية النقدية وبضاعة المنزل</span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black text-xs">
              مسحوبات خاصة
            </span>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Cash Withdrawals */}
            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
              <span className="text-slate-500 dark:text-slate-400 block font-medium mb-1">
                مسحوبات نقدية (مصروف شخصي):
              </span>
              <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                {partnerSummary.abdallahCashSYP.toLocaleString()} <span className="text-[10px]">ل.س</span>
              </div>
              {partnerSummary.abdallahCashUSD > 0 && (
                <div className="font-bold text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  + ${partnerSummary.abdallahCashUSD.toLocaleString()}
                </div>
              )}
            </div>

            {/* Goods Withdrawals */}
            <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
              <span className="text-slate-500 dark:text-slate-400 block font-medium mb-1">
                مسحوبات بضاعة (بسعر التكلفة):
              </span>
              <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                {partnerSummary.abdallahGoodsSYP.toLocaleString()} <span className="text-[10px]">ل.س</span>
              </div>
              {partnerSummary.abdallahGoodsUSD > 0 && (
                <div className="font-bold text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  + ${partnerSummary.abdallahGoodsUSD.toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Summary Totals */}
          <div className="p-4 rounded-2xl bg-amber-950/5 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>إجمالي مسحوبات عبدالله المقومة بالدولار:</span>
              <span className="text-red-600 dark:text-red-400 font-black">
                ${Math.round(partnerSummary.abdallahTotalWithdrawnUSD).toLocaleString()}
              </span>
            </div>

            <div className="pt-2 border-t border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                  المعادل التقريبي بالليرة السورية:
                </span>
                <span className="text-[10px] text-slate-400">
                  تخصم من نصيب الأرباح عند توزيع الحسابات
                </span>
              </div>
              <span className="text-lg font-black text-amber-700 dark:text-amber-300">
                {(Math.round(partnerSummary.abdallahTotalWithdrawnUSD * rate)).toLocaleString()} ل.س
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Operations Ledger & History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-purple-600" />
              <span>سجل حركات الشركاء والمسحوبات</span>
            </h3>
            <p className="text-xs text-slate-500">
              جميع الحركات المسجلة على حساب الشريك أو عبدالله مرتبة زمنياً
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Person Filter */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPersonFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  personFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setPersonFilter('partner')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  personFilter === 'partner'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                {settings.partnerName || 'الشريك'}
              </button>
              <button
                type="button"
                onClick={() => setPersonFilter('abdallah')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  personFilter === 'abdallah'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                عبدالله
              </button>
            </div>

            {/* Type Filter */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                جميع الأنواع
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('cash')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  typeFilter === 'cash'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                نقد كاش
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('goods')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  typeFilter === 'goods'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                بضاعة بالتكلفة
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Items */}
        {filteredLog.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <FileSpreadsheet className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-bold">لا توجد حركات مسجلة للشركاء مطابقة للفلتر</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLog.map((item) => {
              const isPartner = item.person === 'partner';
              const dateObj = new Date(item.date);
              const dateFormatted = dateObj.toLocaleDateString('ar-SY');
              const timeFormatted = dateObj.toLocaleTimeString('ar-SY', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        item.source === 'goods'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                      }`}
                    >
                      {item.source === 'goods' ? (
                        <Package className="w-4 h-4" />
                      ) : (
                        <Coins className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isPartner
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {item.personLabel}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.type}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateFormatted}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{timeFormatted}</span>
                        </span>
                        {item.notes && (
                          <span className="text-slate-500 truncate max-w-xs">
                            ملاحظة: {item.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                    <div className="text-right">
                      <div className="text-base font-black font-mono text-red-600 dark:text-red-400">
                        -{item.amountOriginal.toLocaleString()}{' '}
                        <span className="text-xs font-bold">
                          {item.currency === 'USD' ? '$' : 'ل.س'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        ~ ${Math.round(item.amountUSD).toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteOperation(item)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition cursor-pointer"
                      title="حذف الحركة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal 1: Goods Withdrawal Modal */}
      <GoodsWithdrawalModal
        isOpen={isGoodsModalOpen}
        onClose={() => setIsGoodsModalOpen(false)}
        products={products}
        settings={settings}
        onSuccess={() => {
          setIsGoodsModalOpen(false);
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Modal 2: Cash Withdrawal Modal */}
      <Modal
        isOpen={isCashWithdrawalOpen}
        onClose={() => setIsCashWithdrawalOpen(false)}
        title="تسجيل سحب نقدي (كاش) للشريك أو عبدالله"
        subtitle="يخصم المبلغ فوراً من الصندوق ويسجل على الحساب الجاري للشخص"
      >
        <form onSubmit={handleSaveCashWithdrawal} className="space-y-4 font-display">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              صاحب السحب النقدي:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWithdrawer('partner')}
                className={`p-3 rounded-2xl border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                  withdrawer === 'partner'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{settings.partnerName || 'الشريك'}</span>
              </button>

              <button
                type="button"
                onClick={() => setWithdrawer('abdallah')}
                className={`p-3 rounded-2xl border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                  withdrawer === 'abdallah'
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>عبدالله</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                المبلغ المسحوب:
              </label>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCashCurrency('SYP')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    cashCurrency === 'SYP'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ل.س سوري
                </button>
                <button
                  type="button"
                  onClick={() => setCashCurrency('USD')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    cashCurrency === 'USD'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  $ دولار
                </button>
              </div>
            </div>
            <NumberInput
              value={cashAmount}
              onChange={(val) => setCashAmount(val)}
              min={0}
              step={cashCurrency === 'USD' ? 5 : 1000}
              placeholder="أدخل المبلغ المسحوب..."
              className="text-base font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              تاريخ السحب:
            </label>
            <input
              type="date"
              value={cashDate}
              onChange={(e) => setCashDate(e.target.value)}
              className="w-full h-11 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              البيان / سبب السحب (اختياري):
            </label>
            <input
              type="text"
              value={cashNotes}
              onChange={(e) => setCashNotes(e.target.value)}
              placeholder="مثال: سحب مصاريف شخصية، دفعة على الحساب..."
              className="w-full h-11 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={cashAmount <= 0}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-black rounded-2xl shadow-md transition cursor-pointer text-sm"
          >
            تأكيد تسجيل السحب النقدي
          </button>
        </form>
      </Modal>

      {/* Modal 3: Capital Transaction Modal (إضافة أو استرداد رأس مال) */}
      <Modal
        isOpen={isCapitalModalOpen}
        onClose={() => {
          setIsCapitalModalOpen(false);
          setEditingCapitalTx(null);
        }}
        title={
          editingCapitalTx
            ? 'تعديل حركة رأس المال'
            : capitalTxType === 'deposit'
            ? 'إضافة رأس مال للشريك'
            : 'استرداد من رأس مال الشريك'
        }
        subtitle="حركة محاسبية رسمية لتعديل التزام المشروع تجاه الشريك بالسعر التاريخي"
      >
        <form onSubmit={handleSaveCapitalTx} className="space-y-4 font-display">
          {/* Operation Type Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              نوع الحركة:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCapitalTxType('deposit')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  capitalTxType === 'deposit'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>إضافة رأس مال (مساهمة)</span>
              </button>

              <button
                type="button"
                onClick={() => setCapitalTxType('refund')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  capitalTxType === 'refund'
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MinusCircle className="w-4 h-4" />
                <span>استرداد رأس مال (سداد)</span>
              </button>
            </div>
            {capitalTxType === 'refund' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                * استرداد رأس المال يخصم من الصندوق ويخفض رأس مال الشريك المتبقي (ليس مصروفاً وليس سحباً شخصياً).
              </p>
            )}
          </div>

          {/* Amount & Currency */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                المبلغ {capitalTxType === 'deposit' ? 'المضاف' : 'المسترد'}:
              </label>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCapitalCurrency('USD')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    capitalCurrency === 'USD'
                      ? 'bg-blue-600 text-white shadow-xs font-black'
                      : 'text-slate-500'
                  }`}
                >
                  $ دولار
                </button>
                <button
                  type="button"
                  onClick={() => setCapitalCurrency('SYP')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    capitalCurrency === 'SYP'
                      ? 'bg-blue-600 text-white shadow-xs font-black'
                      : 'text-slate-500'
                  }`}
                >
                  ل.س سوري
                </button>
              </div>
            </div>
            <NumberInput
              value={capitalAmount}
              onChange={(val) => setCapitalAmount(val)}
              min={0}
              step={capitalCurrency === 'USD' ? 50 : 10000}
              placeholder="أدخل المبلغ..."
              className="text-base font-bold"
            />
          </div>

          {/* If SYP: Exchange rate and live USD calculation */}
          {capitalCurrency === 'SYP' && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  سعر الصرف وقت العملية (ل.س لكل 1 $):
                </label>
                <button
                  type="button"
                  onClick={() => setCapitalExchangeRate(settings.exchangeRate || 15000)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline"
                >
                  استخدام السعر الحالي ({settings.exchangeRate || 15000})
                </button>
              </div>
              <NumberInput
                value={capitalExchangeRate}
                onChange={(val) => setCapitalExchangeRate(val)}
                min={1}
                step={100}
                className="text-sm font-bold"
              />
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-xs font-black">
                <span className="text-slate-500 dark:text-slate-400">
                  القيمة المحاسبية بالدولار (ثابتة تاريخياً):
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  ${(capitalExchangeRate > 0 ? capitalAmount / capitalExchangeRate : 0).toFixed(2)} USD
                </span>
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              تاريخ ووقت الحركة:
            </label>
            <input
              type="date"
              value={capitalDate}
              onChange={(e) => setCapitalDate(e.target.value)}
              className="w-full h-11 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold"
            />
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              البيان / ملاحظة اختيارية:
            </label>
            <input
              type="text"
              value={capitalNotes}
              onChange={(e) => setCapitalNotes(e.target.value)}
              placeholder="مثال: دفعة رأس مال تأسيسية، سداد نقدي جزئي..."
              className="w-full h-11 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={capitalAmount <= 0}
            className={`w-full py-3.5 text-white font-black rounded-2xl shadow-md transition cursor-pointer text-sm disabled:opacity-50 active:scale-95 ${
              capitalTxType === 'deposit'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {editingCapitalTx
              ? 'حفظ تعديلات الحركة'
              : capitalTxType === 'deposit'
              ? 'تأكيد إضافة رأس المال'
              : 'تأكيد استرداد رأس المال'}
          </button>
        </form>
      </Modal>
    </div>
  );
};
