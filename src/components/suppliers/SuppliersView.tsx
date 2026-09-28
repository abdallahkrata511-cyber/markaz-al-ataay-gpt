import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Building2,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Edit2,
  History,
} from 'lucide-react';
import {
  Supplier,
  SupplierTransaction,
  PurchaseInvoice,
  AppSettings,
  Currency,
} from '../../types';
import { LocalDatabase } from '../../services/db';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { NumberInput } from '../common/NumberInput';
import { Modal } from '../common/Modal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ViewHeader } from '../common/ViewHeader';
import { SupplierStatementModal } from './SupplierStatementModal';

interface SuppliersViewProps {
  suppliers: Supplier[];
  transactions: SupplierTransaction[];
  purchaseInvoices?: PurchaseInvoice[];
  settings: AppSettings;
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (supplierId: string) => void;
  onAddTransaction: (tx: Omit<SupplierTransaction, 'id' | 'createdAt'>) => void;
  onDeleteTransaction: (txId: string) => void;
  getSupplierBalance: (supplierId: string) => number;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  transactions,
  purchaseInvoices = [],
  settings,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddTransaction,
  onDeleteTransaction,
  getSupplierBalance,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Transaction modal (Purchase or Payment)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txSupplierId, setTxSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [txType, setTxType] = useState<'purchase' | 'payment'>('payment');
  const [txAmount, setTxAmount] = useState<number>(100);
  const [txCurrency, setTxCurrency] = useState<Currency>(settings.baseCurrency);
  const [txNotes, setTxNotes] = useState<string>('');

  // Selected supplier statement modal
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<Supplier | null>(null);
  const [deleteTxTarget, setDeleteTxTarget] = useState<SupplierTransaction | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [initialDebt, setInitialDebt] = useState(0);
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency);

  const rate = settings.exchangeRate || 15000;

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setCompany('');
    setPhone('');
    setInitialDebt(0);
    setCurrency(settings.baseCurrency);
    setIsAddSupplierOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setName(s.name);
    setCompany(s.company || '');
    setPhone(s.phone || '');
    setInitialDebt(s.initialDebt || 0);
    setCurrency(s.currency || 'USD');
    setIsAddSupplierOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingSupplier) {
      onUpdateSupplier({
        ...editingSupplier,
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        initialDebt,
        currency,
      });
    } else {
      onAddSupplier({
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        initialDebt,
        currency,
      });
    }

    setIsAddSupplierOpen(false);
  };

  const handleOpenTx = (supplierId?: string, type: 'purchase' | 'payment' = 'payment') => {
    if (supplierId) setTxSupplierId(supplierId);
    setTxType(type);
    setTxAmount(0);
    setTxCurrency(settings.baseCurrency);
    setTxNotes('');
    setIsTxModalOpen(true);
  };

  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (txAmount <= 0) return;

    const supp = suppliers.find((s) => s.id === txSupplierId);
    if (!supp) return;

    onAddTransaction({
      supplierId: supp.id,
      supplierName: supp.name,
      type: txType,
      amount: txAmount,
      currency: txCurrency,
      date: new Date().toISOString(),
      notes: txNotes.trim(),
    });

    setIsTxModalOpen(false);
  };

  // Filter suppliers with Arabic normalization
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    const clean = searchQuery
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');

    return suppliers.filter((s) => {
      const sName = s.name
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
      const sComp = (s.company || '')
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
      return sName.includes(clean) || sComp.includes(clean);
    });
  }, [suppliers, searchQuery]);

  // إجمالي ذمم الموردين بالدولار (الرصيد الرئيسي دائماً بالدولار)
  const totalSupplierDebtUSD = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + getSupplierBalance(s.id), 0);
  }, [suppliers, getSupplierBalance]);
  const totalSupplierDebtSYP = totalSupplierDebtUSD * rate; // تقييم حالي فقط

  return (
    <div className="space-y-4 pb-20">
      {/* Top Banner & Header */}
      <ViewHeader
        title="الموردون والشركات الغذائية"
        subtitle="تسجيل مستحقات الموردين، سداد الدفعات، ومتابعة المدفوع والمتبقي مع التاريخ والوقت."
        icon={Truck}
        actionButton={{
          label: 'إضافة مورد',
          icon: Plus,
          onClick: handleOpenAdd,
        }}
        extraActions={
          <button
            type="button"
            onClick={() => handleOpenTx(undefined, 'payment')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer font-display"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>تسجيل دفعة لمورد</span>
          </button>
        }
      />

      {/* Total Debts Card */}
      <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl flex items-center justify-between shadow-xs">
        <div>
          <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block">إجمالي ديون الموردين (المستحقة علينا):</span>
          <div className="mt-1">
            <CurrencyBadge
              amount={totalSupplierDebtUSD}
              currency="USD"
              size="lg"
            />
          </div>
        </div>
        <div className="text-xs text-amber-800 dark:text-amber-400 font-bold bg-white/70 dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
          {suppliers.length} موردين مسجلين
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
          placeholder="البحث باسم المورد أو الشركة..."
          className="w-full h-12 pr-11 pl-4 rounded-2xl bg-white dark:bg-[#153243]/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFAA47] focus:border-[#FFAA47] shadow-xs font-display transition"
        />
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredSuppliers.map((supp) => {
          const usdBalance = getSupplierBalance(supp.id);
          const hasDebt = usdBalance > 0.004;

          return (
            <div
              key={supp.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white leading-snug">
                      {supp.name}
                    </h3>
                    {supp.company && (
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mt-0.5">
                        {supp.company}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(supp)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="تعديل"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteSupplierTarget(supp)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                      title="حذف المورد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  {supp.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span dir="ltr">{supp.phone}</span>
                    </div>
                  )}
                  {supp.notes && (
                    <p className="text-[11px] text-slate-400 italic">ملاحظة: {supp.notes}</p>
                  )}
                </div>
              </div>

              {/* Balance & Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-0.5">رصيد المورد بالدولار:</span>
                  <div className="space-y-0.5">
                    {usdBalance > 0.004 && (
                      <div className="text-sm font-black text-red-600 dark:text-red-400">
                        {usdBalance.toLocaleString('en-US')} $ <span className="text-[10px] font-bold">مستحق له</span>
                      </div>
                    )}
                    {usdBalance < -0.004 && (
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {Math.abs(usdBalance).toLocaleString('en-US')} $ <span className="text-[10px] font-bold">رصيد دائن لصالحنا</span>
                      </div>
                    )}
                    {Math.abs(usdBalance) <= 0.004 && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        حسابه خالص مسدد ✓
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenTx(supp.id, 'payment')}
                    className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    سداد دفعة
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementSupplier(supp)}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>كشف الحساب</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        title={editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
        subtitle="تسجيل اسم المورد، الشركة، ورصيد الدين الأولي"
      >
        <form onSubmit={handleSaveSupplier} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم المورد / المسؤول *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مؤسسة الفيحاء للتجارة، شركة الخير..."
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم الشركة أو المعمل
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="مثال: شركة الزيوت والسمون..."
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900"
            />
          </div>

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

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">
                المبلغ المستحق الأولي للمورد:
              </label>
              <div className="flex bg-slate-200 p-0.5 rounded text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2 py-0.5 rounded ${currency === 'USD' ? 'bg-emerald-600 text-white' : ''}`}
                >
                  $ دولار
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('SYP')}
                  className={`px-2 py-0.5 rounded ${currency === 'SYP' ? 'bg-blue-600 text-white' : ''}`}
                >
                  ل.س
                </button>
              </div>
            </div>

            <NumberInput
              value={initialDebt}
              onChange={(v) => setInitialDebt(Math.max(0, v))}
              min={0}
              step={currency === 'USD' ? 5 : 50000}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-md transition active:scale-95 text-base"
            >
              {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier Transaction Modal (Payment or Purchase) */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title="حركة حساب مورد"
        subtitle="تسجيل دفعة سداد أو فاتورة مشتريات من المورد"
      >
        <form onSubmit={handleSaveTx} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اختر المورد *
            </label>
            <select
              value={txSupplierId}
              onChange={(e) => setTxSupplierId(e.target.value)}
              required
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.company || 'بدون شركة'}) - الرصيد المتبقي:{' '}
                  {getSupplierBalance(s.id).toLocaleString('en-US')} USD
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نوع الحركة *
            </label>
            <div className="grid grid-cols-2 gap-2 h-11 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setTxType('payment')}
                className={`rounded-md text-xs font-bold transition flex items-center justify-center gap-1 ${
                  txType === 'payment'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>سداد دفعة (إنقاص دين)</span>
              </button>
              <button
                type="button"
                onClick={() => setTxType('purchase')}
                className={`rounded-md text-xs font-bold transition flex items-center justify-center gap-1 ${
                  txType === 'purchase'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>مشتريات بضاعة (زيادة دين)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المبلغ *
              </label>
              <NumberInput
                value={txAmount}
                onChange={(v) => setTxAmount(Math.max(0, v))}
                min={0}
                step={txCurrency === 'USD' ? 5 : 50000}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                العملة
              </label>
              <div className="flex h-11 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setTxCurrency('USD')}
                  className={`flex-1 rounded text-xs font-bold ${
                    txCurrency === 'USD' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                  }`}
                >
                  $ دولار
                </button>
                <button
                  type="button"
                  onClick={() => setTxCurrency('SYP')}
                  className={`flex-1 rounded text-xs font-bold ${
                    txCurrency === 'SYP' ? 'bg-blue-600 text-white' : 'text-slate-600'
                  }`}
                >
                  ل.س
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات أو رقم السند
            </label>
            <input
              type="text"
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
              placeholder="مثال: تسليم كاش للمندوب، حوالة صرافة..."
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={txAmount <= 0}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-md transition active:scale-95 text-base disabled:opacity-50"
            >
              تثبيت العملية
            </button>
          </div>
        </form>
      </Modal>

      {/* Supplier Statement (USD, historical rates, date range, PDF) */}
      {statementSupplier && (
        <SupplierStatementModal
          supplier={statementSupplier}
          settings={settings}
          onClose={() => setStatementSupplier(null)}
          onPay={() => {
            const id = statementSupplier.id;
            setStatementSupplier(null);
            handleOpenTx(id, 'payment');
          }}
        />
      )}

      {/* Confirm Delete Supplier Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteSupplierTarget}
        onClose={() => setDeleteSupplierTarget(null)}
        onConfirm={() => {
          if (deleteSupplierTarget) {
            onDeleteSupplier(deleteSupplierTarget.id);
            setDeleteSupplierTarget(null);
          }
        }}
        title="تأكيد حذف المورد"
        itemName={deleteSupplierTarget?.name}
        warningDetails="سيتم حذف هذا المورد وجميع الحركات المرتبطة به. لا يمكن التراجع عن هذه العملية."
        confirmButtonText="نعم، حذف المورد"
      />

      {/* Confirm Delete Supplier Transaction Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTxTarget}
        onClose={() => setDeleteTxTarget(null)}
        onConfirm={() => {
          if (deleteTxTarget) {
            onDeleteTransaction(deleteTxTarget.id);
            setDeleteTxTarget(null);
          }
        }}
        title="تأكيد حذف حركة المورد"
        itemName={
          deleteTxTarget
            ? `${deleteTxTarget.type === 'payment' ? 'سداد دفعة' : 'فاتورة'} بقيمة ${deleteTxTarget.amount.toLocaleString(
                'en-US'
              )} ${deleteTxTarget.currency}`
            : undefined
        }
        warningDetails="سيتم إلغاء هذه الحركة وتصحيح رصيد المورد والصندوق تلقائياً."
        confirmButtonText="نعم، حذف وتصحيح الحساب"
      />
    </div>
  );
};
