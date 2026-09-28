import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  Coins,
  History,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  ChevronLeft,
  FileSpreadsheet,
  Download,
  Printer,
  TrendingDown,
  TrendingUp,
  Share2,
  DollarSign,
  Scale,
} from 'lucide-react';
import {
  Customer,
  Invoice,
  CustomerPayment,
  AppSettings,
  Currency,
} from '../../types';
import { LocalDatabase } from '../../services/db';
import {
  exportCustomerAuditPdf,
  CustomerAuditItem,
  CustomerAuditTotals,
} from '../../services/pdfExport';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { NumberInput } from '../common/NumberInput';
import { Modal } from '../common/Modal';
import { SmartPickerModal } from '../common/SmartPickerModal';
import { SmartPickerTrigger } from '../common/SmartPickerTrigger';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ViewHeader } from '../common/ViewHeader';

interface CustomersViewProps {
  customers: Customer[];
  invoices: Invoice[];
  payments: CustomerPayment[];
  settings: AppSettings;
  onAddCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customerId: string) => void;
  onAddPayment: (payment: Omit<CustomerPayment, 'id' | 'createdAt'>) => void;
  onDeletePayment: (paymentId: string) => void;
  getCustomerBalance: (customerId: string) => number;
  isAddModalOpenInitially?: boolean;
  isPaymentModalOpenInitially?: boolean;
  onCloseInitialModal?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  invoices,
  payments,
  settings,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddPayment,
  onDeletePayment,
  getCustomerBalance,
  isAddModalOpenInitially = false,
  isPaymentModalOpenInitially = false,
  onCloseInitialModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(isAddModalOpenInitially);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Payment modal state
  const [isPaymentOpen, setIsPaymentOpen] = useState(isPaymentModalOpenInitially);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string>(
    customers[0]?.id || ''
  );
  const [isPaymentCustomerPickerOpen, setIsPaymentCustomerPickerOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(100000);
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>(settings.baseCurrency);
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Selected customer for full statement history view
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState<Customer | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<CustomerPayment | null>(null);

  // Form fields for customer
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialDebt, setInitialDebt] = useState(0);
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency);

  // Customer Audit modal state (Requirement 15)
  const [isCustomerAuditOpen, setIsCustomerAuditOpen] = useState(false);
  const [isExportingAuditPdf, setIsExportingAuditPdf] = useState(false);
  const [auditPdfMsg, setAuditPdfMsg] = useState<string | null>(null);

  const rate = settings.exchangeRate || 15000;

  // Open add customer
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setName('');
    setShopName('');
    setPhone('');
    setAddress('');
    setInitialDebt(0);
    setCurrency(settings.baseCurrency);
    setIsAddCustomerOpen(true);
  };

  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setShopName(c.shopName || '');
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setInitialDebt(c.initialDebt || 0);
    setCurrency(c.currency || 'SYP');
    setIsAddCustomerOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCustomer) {
      onUpdateCustomer({
        ...editingCustomer,
        name: name.trim(),
        shopName: shopName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        initialDebt,
        currency,
      });
    } else {
      onAddCustomer({
        name: name.trim(),
        shopName: shopName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        initialDebt,
        currency,
      });
    }

    setIsAddCustomerOpen(false);
    if (onCloseInitialModal) onCloseInitialModal();
  };

  // Open payment modal
  const handleOpenPayment = (customerId?: string) => {
    if (customerId) setPaymentCustomerId(customerId);
    setPaymentAmount(0);
    setPaymentCurrency(settings.baseCurrency);
    setPaymentNotes('');
    setIsPaymentOpen(true);
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) return;

    const cust = customers.find((c) => c.id === paymentCustomerId);
    if (!cust) return;

    onAddPayment({
      customerId: cust.id,
      customerName: cust.name,
      amount: paymentAmount,
      currency: paymentCurrency,
      date: new Date().toISOString(),
      paymentMethod: 'cash',
      notes: paymentNotes.trim(),
    });

    setIsPaymentOpen(false);
    if (onCloseInitialModal) onCloseInitialModal();
  };

  // Search filter with Arabic normalization
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const clean = searchQuery
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');

    return customers.filter((c) => {
      const cName = c.name
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
      const cShop = (c.shopName || '')
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
      const cPhone = c.phone || '';

      return cName.includes(clean) || cShop.includes(clean) || cPhone.includes(clean);
    });
  }, [customers, searchQuery]);

  // Total Customer Debt across all customers in dual currency and USD valuation
  const { totalCustSYP, totalCustUSD, totalCustValuationUSD } = useMemo(() => {
    let sypSum = 0;
    let usdSum = 0;
    for (const c of customers) {
      const dual = LocalDatabase.getCustomerDualBalance(c.id);
      sypSum += dual.syp;
      usdSum += dual.usd;
    }
    const valUSD = usdSum + (rate > 0 ? sypSum / rate : 0);
    return {
      totalCustSYP: sypSum,
      totalCustUSD: usdSum,
      totalCustValuationUSD: Number(valUSD.toFixed(2)),
    };
  }, [customers, rate]);

  // جرد العملاء بضغطة واحدة: يعتمد على محرك المحاسبة (FIFO بسعر صرف كل فاتورة/دفعة)،
  // وليس على سعر أول فاتورة. القيمة الحالية بسعر اليوم فقط.
  const { auditItems, auditTotals } = useMemo(() => {
    const audit = LocalDatabase.getCustomerAudit();
    const byId = new Map<string, Customer>(customers.map((c) => [c.id, c] as [string, Customer]));
    const items: CustomerAuditItem[] = audit.rows.map((r) => ({
      id: r.id,
      name: r.name,
      shopName: r.sub,
      phone: byId.get(r.id)?.phone,
      balanceSYP: r.sypBalance,
      balanceUSD: r.usdBalance,
      currentValuationUSD: r.currentUSD,
      historicalEquivalentUSD: r.historicalUSD,
      valuationEffectUSD: r.fxEffectUSD,
    }));
    const totals: CustomerAuditTotals = {
      totalSYP: audit.totalSypBalance,
      totalUSD: audit.totalUsdBalance,
      totalCurrentValuationUSD: audit.totalCurrentUSD,
      totalHistoricalUSD: audit.totalHistoricalUSD,
      totalValuationEffectUSD: audit.totalFxEffectUSD,
      customersWithDebtCount: audit.rows.filter((r) => r.sypBalance !== 0 || r.usdBalance !== 0).length,
    };
    return { auditItems: items, auditTotals: totals };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, invoices, payments, rate]);

  const handleExportCustomerAudit = async () => {
    setIsExportingAuditPdf(true);
    setAuditPdfMsg(null);
    try {
      const res = await exportCustomerAuditPdf(auditItems, auditTotals, settings, rate);
      if (res.success) {
        setAuditPdfMsg('تم تصدير تقرير جرد العملاء إلى PDF بنجاح ✓');
        setTimeout(() => setAuditPdfMsg(null), 4000);
      } else {
        setAuditPdfMsg(res.error || 'حدث خطأ أثناء التصدير');
        setTimeout(() => setAuditPdfMsg(null), 4000);
      }
    } catch (e: any) {
      console.error(e);
      setAuditPdfMsg('تعذر تصدير تقرير جرد العملاء');
      setTimeout(() => setAuditPdfMsg(null), 4000);
    } finally {
      setIsExportingAuditPdf(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 font-display">
      {/* Top Banner & Stats */}
      <ViewHeader
        title="العملاء وحسابات الديون"
        subtitle="متابعة حسابات المحلات، فواتير الآجل، وتسجيل المقبوضات مع التاريخ والوقت."
        icon={Users}
        actionButton={{
          label: 'إضافة عميل',
          icon: UserPlus,
          onClick: handleOpenAddCustomer,
        }}
        extraActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCustomerAuditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer font-display"
              title="جرد ديون العملاء بضغطة زر واحدة (Customer Audit)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">جرد ديون العملاء</span>
              <span className="sm:hidden">جرد العملاء</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenPayment()}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer font-display"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>تسجيل دفعة</span>
            </button>
          </div>
        }
      />

      {/* Total Debts Card - Multi-Currency & Real-Time Valuation (Requirements 3 & 15) */}
      <div className="bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs font-display">
        <div>
          <span className="text-xs font-bold text-red-800 dark:text-red-300 block">
            إجمالي ديون العملاء المستحقة (لصالح المركز بالليرة والدولار):
          </span>
          <div className="flex flex-wrap items-baseline gap-2 mt-1">
            <span className="text-2xl font-black font-mono text-red-600 dark:text-red-400">
              ${totalCustValuationUSD.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
            </span>
            <span className="text-xs text-slate-500 font-normal">
              (التقييم الحالي بسعر اليوم 1$ = {rate.toLocaleString('en-US')} ل.س)
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
            أصل الديون المسجلة: {totalCustSYP.toLocaleString('en-US')} ل.س {totalCustUSD > 0 ? `+ $${totalCustUSD.toLocaleString('en-US')} دولار` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsCustomerAuditOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition active:scale-95 cursor-pointer"
            title="فتح تقرير جرد ديون العملاء الشامل"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تقرير جرد العملاء (Audit PDF)</span>
          </button>
          <div className="text-xs text-red-700 dark:text-red-400 font-bold bg-white/80 dark:bg-slate-900/80 px-3 py-2 rounded-xl border border-red-200/50 dark:border-red-900/30">
            {customers.length} عميل
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-5 h-5 stroke-[2.2]" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="البحث باسم العميل، المحل، أو رقم الهاتف..."
          className="w-full h-12 pr-11 pl-4 rounded-2xl bg-white dark:bg-[#153243]/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFAA47] focus:border-[#FFAA47] shadow-xs font-display transition"
        />
      </div>

      {/* Customers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredCustomers.map((cust) => {
          const dualBalance = LocalDatabase.getCustomerDualBalance(cust.id);
          const hasDebt = dualBalance.syp > 0 || dualBalance.usd > 0;

          return (
            <div
              key={cust.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white leading-snug">
                      {cust.name}
                    </h3>
                    {cust.shopName && (
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-400 block mt-0.5">
                        {cust.shopName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomer(cust)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="تعديل العميل"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteCustomerTarget(cust)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="حذف العميل"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  {cust.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span dir="ltr">{cust.phone}</span>
                    </div>
                  )}
                  {cust.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{cust.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Debt & Action Footer with Previous Balance */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                    الرصيد القائم (ثنائي العملة):
                  </span>
                  <div className="space-y-0.5">
                    {dualBalance.syp !== 0 && (
                      <div className={`text-xs font-bold font-mono ${dualBalance.syp > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {dualBalance.syp.toLocaleString('en-US')} ل.س
                      </div>
                    )}
                    {dualBalance.usd !== 0 && (
                      <div className={`text-xs font-bold font-mono ${dualBalance.usd > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        ${dualBalance.usd.toLocaleString('en-US')} دولار
                      </div>
                    )}
                    {dualBalance.syp === 0 && dualBalance.usd === 0 && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        حسابه مسدد بالكامل ✓
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPayment(cust.id)}
                    className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    قبض دفعة
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementCustomer(cust)}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>كشف حساب</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isAddCustomerOpen}
        onClose={() => {
          setIsAddCustomerOpen(false);
          if (onCloseInitialModal) onCloseInitialModal();
        }}
        title={editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
        subtitle="تسجيل اسم المحل والبقالية ورقم الهاتف والدين المسبق"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم العميل *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أبو بشير، عمر القاسم..."
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم المحل / البقالية
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="مثال: سوبرماركت البركة، ميني ماركت النور..."
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09..."
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المنطقة / العنوان
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="شارع، حي، سوق..."
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">
                الدين السابق للعميل (إن وُجد):
              </label>
              <div className="flex bg-slate-200 p-0.5 rounded text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCurrency('SYP')}
                  className={`px-2 py-0.5 rounded ${currency === 'SYP' ? 'bg-blue-600 text-white' : ''}`}
                >
                  ل.س
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2 py-0.5 rounded ${currency === 'USD' ? 'bg-emerald-600 text-white' : ''}`}
                >
                  $
                </button>
              </div>
            </div>

            <NumberInput
              value={initialDebt}
              onChange={(v) => setInitialDebt(Math.max(0, v))}
              min={0}
              step={currency === 'USD' ? 5 : 10000}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-md transition active:scale-95 text-base"
            >
              {editingCustomer ? 'حفظ التعديلات' : 'إضافة العميل'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          if (onCloseInitialModal) onCloseInitialModal();
        }}
        title="تسجيل دفعة نقدية من عميل"
        subtitle="سداد دين مع تسجيل التاريخ والوقت وتحديث رصيد العميل فوراً"
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          <div>
            <SmartPickerTrigger
              label="اختر العميل"
              required
              placeholder="🔍 اضغط للبحث الفوري واختيار العميل..."
              selectedTitle={customers.find((c) => c.id === paymentCustomerId)?.name}
              selectedSubtitle={
                customers.find((c) => c.id === paymentCustomerId)?.shopName ||
                customers.find((c) => c.id === paymentCustomerId)?.phone ||
                undefined
              }
              selectedBadge={
                paymentCustomerId && getCustomerBalance(paymentCustomerId) > 0
                  ? `دين: ${getCustomerBalance(paymentCustomerId).toLocaleString('en-US')}`
                  : undefined
              }
              onClick={() => setIsPaymentCustomerPickerOpen(true)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                المبلغ المقبوض *
              </label>
              <NumberInput
                value={paymentAmount}
                onChange={(v) => setPaymentAmount(Math.max(0, v))}
                min={0}
                step={paymentCurrency === 'USD' ? 5 : 5000}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                عملة الدفعة
              </label>
              <div className="flex h-11 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPaymentCurrency('SYP')}
                  className={`flex-1 rounded-lg text-xs font-bold transition ${
                    paymentCurrency === 'SYP' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ل.س
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentCurrency('USD')}
                  className={`flex-1 rounded-lg text-xs font-bold transition ${
                    paymentCurrency === 'USD' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  $ دولار
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات أو اسم الشخص المستلم
            </label>
            <input
              type="text"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="مثال: دفعة نقدية مع السائق عبدالله..."
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl text-xs"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={paymentAmount <= 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md transition active:scale-95 text-base disabled:opacity-50"
            >
              تثبيت الدفعة وخصم الدين
            </button>
          </div>
        </form>
      </Modal>

      {/* Customer Statement History Modal */}
      {statementCustomer && (() => {
        const custInvoices = invoices.filter((i) => i.customerId === statementCustomer.id);
        const custPayments = payments.filter((p) => p.customerId === statementCustomer.id);
        const previousBalance = statementCustomer.initialDebt || 0;
        const totalInvoices = custInvoices.reduce((sum, inv) => sum + inv.finalTotal, 0);
        const totalCashFromInvoices = custInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
        const totalStandalonePayments = custPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalAllPayments = totalCashFromInvoices + totalStandalonePayments;
        const finalCalculatedBalance = previousBalance + totalInvoices - totalAllPayments;

        return (
          <Modal
            isOpen={!!statementCustomer}
            onClose={() => setStatementCustomer(null)}
            title={`كشف حساب العميل: ${statementCustomer.name}`}
            subtitle={`المحل: ${statementCustomer.shopName || 'بدون'} • الهاتف: ${statementCustomer.phone || 'بدون'}`}
            maxWidth="xl"
          >
            <div className="space-y-4">
              {/* Mandatory Requirement 3: Detailed Balance Formula Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <span>📊</span>
                    <span>معادلة احتساب رصيد العميل التراكمي:</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    العملة: {statementCustomer.currency || 'SYP'}
                  </span>
                </div>

                {/* Formula Breakdown Boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {/* Previous Balance */}
                  <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                      1. الرصيد السابق
                    </span>
                    <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-100 block">
                      {previousBalance.toLocaleString('en-US')}
                    </span>
                    <span className="text-[9px] text-slate-400">رصيد افتتاحي</span>
                  </div>

                  {/* New Invoices */}
                  <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block mb-0.5">
                      + 2. الفواتير الجديدة
                    </span>
                    <span className="text-sm font-black font-mono text-blue-800 dark:text-blue-200 block">
                      {totalInvoices.toLocaleString('en-US')}
                    </span>
                    <span className="text-[9px] text-blue-500">({custInvoices.length} فواتير)</span>
                  </div>

                  {/* Payments */}
                  <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block mb-0.5">
                      − 3. إجمالي الدفعات
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-800 dark:text-emerald-200 block">
                      {totalAllPayments.toLocaleString('en-US')}
                    </span>
                    <span className="text-[9px] text-emerald-600">مسددة نقدياً</span>
                  </div>

                  {/* Final Balance */}
                  <div className="p-2.5 bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl">
                    <span className="text-[10px] font-black text-red-700 dark:text-red-300 block mb-0.5">
                      = الرصيد النهائي
                    </span>
                    <span className="text-base font-black font-mono text-red-700 dark:text-red-300 block">
                      {finalCalculatedBalance.toLocaleString('en-US')}
                    </span>
                    <span className="text-[9px] font-bold text-red-600">
                      {finalCalculatedBalance > 0 ? 'مستحق بذمة العميل' : 'حساب خالص'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-center">
                  الرصيد النهائي ({finalCalculatedBalance.toLocaleString('en-US')}) = الرصيد السابق ({previousBalance.toLocaleString('en-US')}) + الفواتير ({totalInvoices.toLocaleString('en-US')}) − الدفعات ({totalAllPayments.toLocaleString('en-US')})
                </div>
              </div>

              {/* Requirement 11: Exchange Rate Effect on Customer Debt */}
              {(() => {
                const row = LocalDatabase.getCustomerAudit().rows.find((r) => r.id === statementCustomer.id);
                if (!row) return null;
                const sypDebt = row.sypBalance;
                const usdDebt = row.usdBalance;
                if (sypDebt <= 0 && usdDebt <= 0) return null;

                // سعر الصرف التاريخي الفعّال = القيمة بالليرة ÷ قيمتها التاريخية بالدولار
                const historicalUSD = row.historicalUSD;
                const currentUSD = row.currentUSD;
                const valuationEffect = row.fxEffectUSD;
                const historicalSypUSD = historicalUSD - usdDebt;
                const historicalRate = historicalSypUSD > 0 ? Math.round(sypDebt / historicalSypUSD) : rate;

                return (
                  <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-indigo-200/80 dark:border-indigo-900/80 pb-1.5">
                      <span className="font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 text-xs">
                        <Scale className="w-4 h-4 text-indigo-600" />
                        <span>أثر تغير سعر الصرف على دين العميل (Exchange-Rate Effect)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        الفاتورة الأصلية لا تتغير
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-[10px] text-slate-500 block">أصل الدين المسجل:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {sypDebt > 0 ? `${sypDebt.toLocaleString('en-US')} ل.س` : ''}
                          {sypDebt > 0 && usdDebt > 0 ? ' + ' : ''}
                          {usdDebt > 0 ? `$${usdDebt}` : ''}
                        </span>
                      </div>

                      <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-[10px] text-slate-500 block">سعر الصرف التاريخي:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          1$ = {historicalRate.toLocaleString('en-US')} ل.س
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          المعادل التاريخي: ${historicalUSD}
                        </span>
                      </div>

                      <div className="col-span-2 sm:col-span-1 p-2 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                        <span className="text-[10px] text-slate-500 block">التقييم الحالي بالدولار:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          ${currentUSD}
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          بسعر اليوم: {rate.toLocaleString('en-US')} ل.س
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-indigo-200 dark:border-indigo-800 text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        أثر تغير سعر الصرف على القيمة بالدولار:
                      </span>
                      <span className={`font-mono font-black ${valuationEffect < 0 ? 'text-red-600 dark:text-red-400' : valuationEffect > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600'}`}>
                        {valuationEffect > 0 ? '+' : ''}${valuationEffect} USD
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Invoices History */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                  <span>سجل الفواتير الصادرة للعميل</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    إجمالي: {custInvoices.length} فاتورة
                  </span>
                </h4>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {custInvoices.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
                      لا توجد فواتير صادرة بعد
                    </p>
                  ) : (
                    custInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {new Date(inv.date).toLocaleDateString('ar-SY')}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            {inv.items.length} أصناف • نقداً: {inv.paidAmount.toLocaleString('en-US')} {inv.currency}
                          </span>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-slate-900 dark:text-slate-100 font-bold block">
                            {inv.finalTotal.toLocaleString('en-US')} {inv.currency}
                          </span>
                          {inv.remainingDebt > 0 && (
                            <span className="text-[10px] text-red-600 dark:text-red-400 font-bold block">
                              باقي دين: {inv.remainingDebt.toLocaleString('en-US')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Payments History */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
                  <span>سجل الدفعات المستلمة</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    إجمالي: {custPayments.length} دفعة مباشرة
                  </span>
                </h4>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {custPayments.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
                      لا توجد دفعات مباشرة مسجلة بعد
                    </p>
                  ) : (
                    custPayments.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-900 dark:text-emerald-300 font-bold">دفعة نقدية</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {new Date(p.date).toLocaleString('ar-SY')}
                            </span>
                          </div>
                          {p.notes && (
                            <span className="text-[10px] text-slate-600 dark:text-slate-400 block mt-0.5">{p.notes}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                            +{p.amount.toLocaleString('en-US')} {p.currency}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDeletePaymentTarget(p)}
                            className="p-1 text-slate-400 hover:text-red-600 transition"
                            title="حذف الدفعة وإعادة حساب الرصيد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatementCustomer(null);
                    handleOpenPayment(statementCustomer.id);
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>تسجيل دفعة جديدة لهذا العميل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementCustomer(null)}
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Payment Customer Smart Picker Modal */}
      <SmartPickerModal<Customer>
        isOpen={isPaymentCustomerPickerOpen}
        onClose={() => setIsPaymentCustomerPickerOpen(false)}
        title="اختر العميل لتسجيل الدفعة"
        placeholder="🔍 ابحث باسم العميل أو المحل أو الهاتف..."
        items={customers}
        selectedId={paymentCustomerId}
        getItemId={(c) => c.id}
        getItemTitle={(c) => c.name}
        getItemSubtitle={(c) => {
          const parts = [];
          if (c.shopName) parts.push(`المحل: ${c.shopName}`);
          if (c.phone) parts.push(`هاتف: ${c.phone}`);
          return parts.join(' • ');
        }}
        getItemBadge={(c) => {
          const debt = getCustomerBalance(c.id);
          if (debt > 0) {
            return {
              text: `دين: ${debt.toLocaleString('en-US')} ${c.currency || 'ل.س'}`,
              color: 'amber',
            };
          }
          return { text: 'خالص', color: 'emerald' };
        }}
        getSearchTerms={(c) => [c.name, c.shopName || '', c.phone || '', c.address || '']}
        onSelect={(c) => {
          setPaymentCustomerId(c.id);
          setIsPaymentCustomerPickerOpen(false);
        }}
      />

      {/* Confirm Customer Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteCustomerTarget}
        onClose={() => setDeleteCustomerTarget(null)}
        onConfirm={() => {
          if (deleteCustomerTarget) {
            onDeleteCustomer(deleteCustomerTarget.id);
            setDeleteCustomerTarget(null);
          }
        }}
        title="حذف العميل"
        description={`هل أنت متأكد من حذف العميل (${deleteCustomerTarget?.name})؟`}
        confirmText="نعم، حذف العميل"
      />

      {/* Confirm Customer Payment Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletePaymentTarget}
        onClose={() => setDeletePaymentTarget(null)}
        onConfirm={() => {
          if (deletePaymentTarget) {
            onDeletePayment(deletePaymentTarget.id);
            setDeletePaymentTarget(null);
          }
        }}
        title="حذف الدفعة المستلمة"
        description={`هل أنت متأكد من حذف هذه الدفعة بقيمة (${deletePaymentTarget?.amount.toLocaleString('en-US')} ${deletePaymentTarget?.currency})؟ سيتم إعادة المبلغ تلقائياً إلى رصيد دين العميل وتصحيح رصيد الصندوق.`}
        confirmText="نعم، احذف الدفعة وأعد احتساب الدين"
      />

      {/* Requirement 15: One-Click Customer Audit Modal */}
      {isCustomerAuditOpen && (
        <Modal
          isOpen={isCustomerAuditOpen}
          onClose={() => setIsCustomerAuditOpen(false)}
          title="جرد وتدقيق ديون العملاء وأثر سعر الصرف (Customer Audit)"
          subtitle={`كشف فوري لجميع العملاء (${customers.length} عميل) • العملة الأصلية والتقييم وأثر تغير سعر الصرف`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            {/* Top Notification */}
            {auditPdfMsg && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{auditPdfMsg}</span>
              </div>
            )}

            {/* Action Bar & Rate Header */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 dark:text-slate-400">سعر الصرف المعتمد للجرد:</span>
                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  1$ = {rate.toLocaleString('en-US')} ل.س
                </span>
                <span className="text-[11px] text-slate-400">({auditTotals.customersWithDebtCount} عملاء بذمتهم أرصدة)</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCustomerAudit}
                  disabled={isExportingAuditPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingAuditPdf ? 'جاري إنشاء PDF...' : 'تصدير PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
                  title="طباعة تقرير جرد العملاء"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block mb-0.5 font-bold">إجمالي ديون الليرة (SYP):</span>
                <span className="text-sm font-black font-mono text-slate-900 dark:text-slate-100 block">
                  {auditTotals.totalSYP.toLocaleString('en-US')}
                </span>
                <span className="text-[9px] text-slate-400">ليرة سورية</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-blue-600 dark:text-blue-400 block mb-0.5 font-bold">إجمالي ديون الدولار (USD):</span>
                <span className="text-sm font-black font-mono text-blue-600 dark:text-blue-400 block">
                  ${auditTotals.totalUSD.toLocaleString('en-US')}
                </span>
                <span className="text-[9px] text-slate-400">دولار أمريكي</span>
              </div>

              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block mb-0.5 font-bold">التقييم الحالي بالدولار:</span>
                <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300 block">
                  ${auditTotals.totalCurrentValuationUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400">قيمة الديون الفعلية</span>
              </div>

              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/40">
                <span className="text-[10px] text-indigo-800 dark:text-indigo-300 block mb-0.5 font-bold">أثر تغير سعر الصرف:</span>
                <span className={`text-base font-black font-mono block ${auditTotals.totalValuationEffectUSD < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {auditTotals.totalValuationEffectUSD > 0 ? '+' : ''}${auditTotals.totalValuationEffectUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                </span>
                <span className="text-[9px] text-slate-400">فارق الصرف التراكمي</span>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-slate-900 text-white px-3 py-2 text-xs font-bold flex justify-between items-center">
                <span>جدول جرد ديون كافة العملاء ({auditItems.length})</span>
                <span className="text-[11px] text-slate-400">الأرصدة الأصلية والقيمة الحالية بالدولار</span>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2 text-center">#</th>
                      <th className="p-2">اسم العميل والمحل</th>
                      <th className="p-2 text-center">رصيد ل.س</th>
                      <th className="p-2 text-center">رصيد دولار</th>
                      <th className="p-2 text-center">المعادل التاريخي ($)</th>
                      <th className="p-2 text-center">التقييم الحالي ($)</th>
                      <th className="p-2 text-left">أثر الصرف ($)</th>
                      <th className="p-2 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {auditItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400">
                          لا يوجد عملاء مسجلين
                        </td>
                      </tr>
                    ) : (
                      auditItems.map((c, idx) => {
                        const hasDebt = c.balanceSYP !== 0 || c.balanceUSD !== 0;
                        const effectSign = c.valuationEffectUSD > 0 ? '+' : '';
                        const effectColor = c.valuationEffectUSD < 0 ? 'text-red-600 dark:text-red-400' : c.valuationEffectUSD > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400';

                        return (
                          <tr
                            key={c.id}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${hasDebt ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/30 text-slate-400'}`}
                          >
                            <td className="p-2 text-center text-slate-400">{idx + 1}</td>
                            <td className="p-2 font-bold font-sans text-slate-900 dark:text-slate-100">
                              <div>{c.name}</div>
                              {c.shopName && (
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  {c.shopName}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center text-slate-800 dark:text-slate-200">
                              {c.balanceSYP !== 0 ? `${c.balanceSYP.toLocaleString('en-US')} ل.س` : '-'}
                            </td>
                            <td className="p-2 text-center text-blue-600 dark:text-blue-400 font-bold">
                              {c.balanceUSD !== 0 ? `$${c.balanceUSD.toLocaleString('en-US')}` : '-'}
                            </td>
                            <td className="p-2 text-center text-slate-500">
                              ${c.historicalEquivalentUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </td>
                            <td className="p-2 text-center font-black text-slate-900 dark:text-slate-100">
                              ${c.currentValuationUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </td>
                            <td className={`p-2 text-left font-bold ${effectColor}`}>
                              {c.valuationEffectUSD !== 0 ? `${effectSign}$${c.valuationEffectUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : '$0.0'}
                            </td>
                            <td className="p-2 text-center font-sans">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsCustomerAuditOpen(false);
                                  const cust = customers.find((x) => x.id === c.id);
                                  if (cust) setStatementCustomer(cust);
                                }}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold"
                              >
                                كشف
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note & Close button */}
            <div className="pt-2 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">
                ملاحظة: الفواتير الأصلية لا تتغير قيمتها المحررة بها، وإنما يتغير التقييم الحالي بالدولار وفق سعر صرف اليوم.
              </span>
              <button
                type="button"
                onClick={() => setIsCustomerAuditOpen(false)}
                className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
