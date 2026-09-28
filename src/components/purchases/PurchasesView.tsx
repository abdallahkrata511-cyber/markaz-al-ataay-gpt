import React, { useState, useMemo } from 'react';
import { computePurchaseSettlement, sumPurchaseItemsByCurrency } from '../../services/accounting';
import {
  ShoppingBag,
  Plus,
  Search,
  Printer,
  Edit2,
  Trash2,
  Calendar,
  Package,
  X,
  Eye,
  CheckCircle2,
  Coins,
  Building2,
  AlertCircle,
  Truck,
} from 'lucide-react';
import {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  Product,
  Supplier,
  AppSettings,
  Currency,
} from '../../types';
import { LocalDatabase } from '../../services/db';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { NumberInput } from '../common/NumberInput';
import { Modal } from '../common/Modal';
import { SmartPickerModal } from '../common/SmartPickerModal';
import { SmartPickerTrigger } from '../common/SmartPickerTrigger';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ViewHeader } from '../common/ViewHeader';

interface PurchasesViewProps {
  purchaseInvoices: PurchaseInvoice[];
  products: Product[];
  suppliers: Supplier[];
  settings: AppSettings;
  onCreatePurchaseInvoice: (
    invoice: Omit<PurchaseInvoice, 'id' | 'createdAt' | 'updatedAt'>
  ) => PurchaseInvoice;
  onUpdatePurchaseInvoice: (invoice: PurchaseInvoice) => void;
  onDeletePurchaseInvoice: (invoiceId: string) => void;
  getSupplierBalance: (supplierId: string) => number;
  isCreateModalOpenInitially?: boolean;
  onCloseInitialModal?: () => void;
  initialSelectedSupplierId?: string;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchaseInvoices,
  products,
  suppliers,
  settings,
  onCreatePurchaseInvoice,
  onUpdatePurchaseInvoice,
  onDeletePurchaseInvoice,
  getSupplierBalance,
  isCreateModalOpenInitially = false,
  onCloseInitialModal,
  initialSelectedSupplierId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(isCreateModalOpenInitially);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseInvoice | null>(null);
  const [deletePurchaseTarget, setDeletePurchaseTarget] = useState<PurchaseInvoice | null>(null);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    initialSelectedSupplierId || suppliers[0]?.id || ''
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [invoiceCurrency, setInvoiceCurrency] = useState<Currency>('USD');
  const [items, setItems] = useState<PurchaseInvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0); // (قديم - غير مستخدم في الحساب الجديد)
  // === نموذج العملتين الجديد ===
  const [invoiceRate, setInvoiceRate] = useState<number>(settings.exchangeRate || 15000);
  const [discountUSD, setDiscountUSD] = useState<number>(0);
  const [discountSYP, setDiscountSYP] = useState<number>(0);
  const [paidUSD, setPaidUSD] = useState<number>(0);
  const [paidSYP, setPaidSYP] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Item selector state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemCartons, setItemCartons] = useState<number>(1);
  const [itemPieces, setItemPieces] = useState<number>(0);
  const [itemCostPerCarton, setItemCostPerCarton] = useState<number>(0);

  // Smart Picker modal states
  const [isSupplierPickerOpen, setIsSupplierPickerOpen] = useState<boolean>(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState<boolean>(false);

  const rate = settings.exchangeRate || 15000;

  const handleOpenCreate = () => {
    setEditingInvoice(null);
    setFormError(null);
    setSelectedSupplierId(initialSelectedSupplierId || suppliers[0]?.id || '');
    setInvoiceCurrency('USD');
    setItems([]);
    setDiscount(0);
    setPaidAmount(0);
    setInvoiceRate(settings.exchangeRate || 15000);
    setDiscountUSD(0);
    setDiscountSYP(0);
    setPaidUSD(0);
    setPaidSYP(0);
    setNotes('');
    setSelectedProductId('');
    setItemCartons(1);
    setItemPieces(0);
    setItemCostPerCarton(0);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (inv: PurchaseInvoice) => {
    setEditingInvoice(inv);
    setFormError(null);
    setSelectedSupplierId(inv.supplierId);
    const legacyCur: Currency = inv.currency === 'SYP' ? 'SYP' : 'USD';
    setInvoiceCurrency(legacyCur);
    setItems(inv.items.map((it) => ({ ...it, currency: it.currency || legacyCur })));
    setDiscount(inv.discount);
    setPaidAmount(inv.paidAmount);
    // فواتير قديمة بعملة واحدة تُقرأ كما هي دون فقدان
    setInvoiceRate(inv.invoiceExchangeRate || settings.exchangeRate || 15000);
    setDiscountUSD(inv.discountUSD ?? (legacyCur === 'USD' ? inv.discount : 0));
    setDiscountSYP(inv.discountSYP ?? (legacyCur === 'SYP' ? inv.discount : 0));
    setPaidUSD(inv.paidUSD ?? (legacyCur === 'USD' ? inv.paidAmount : 0));
    setPaidSYP(inv.paidSYP ?? (legacyCur === 'SYP' ? inv.paidAmount : 0));
    setNotes(inv.notes || '');
    setIsCreateModalOpen(true);
  };

  // Product selection changed
  const handleProductSelectChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      // Pre-fill with current purchase cost converted to selected currency if needed
      let cost = prod.purchaseCost;
      if (prod.costCurrency !== invoiceCurrency) {
        if (invoiceCurrency === 'USD' && prod.costCurrency === 'SYP') {
          cost = Number((prod.purchaseCost / invoiceRate).toFixed(2));
        } else if (invoiceCurrency === 'SYP' && prod.costCurrency === 'USD') {
          cost = Math.round(prod.purchaseCost * invoiceRate);
        }
      }
      setItemCostPerCarton(cost);
    }
  };

  // Add Item to purchase invoice
  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const ppc = prod.piecesPerCarton || 1;
    const totalPieces = itemCartons * ppc + itemPieces;
    if (totalPieces <= 0) return;

    // Line total: cartons * costPerCarton + (pieces * costPerCarton / ppc)
    const cartonCost = itemCartons * itemCostPerCarton;
    const pieceCost = (itemPieces * itemCostPerCarton) / ppc;
    const lineTotal =
      invoiceCurrency === 'USD'
        ? Number((cartonCost + pieceCost).toFixed(2))
        : Math.round(cartonCost + pieceCost);

    const newItem: PurchaseInvoiceItem = {
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit || 'كرتونة',
      piecesPerCarton: ppc,
      cartons: itemCartons,
      pieces: itemPieces,
      totalPieces,
      costPerCarton: itemCostPerCarton,
      itemTotal: lineTotal,
      currency: invoiceCurrency, // عملة تسعير هذا الصنف تبقى أصلية
      exchangeRate: invoiceRate, // سعر صرف هذه الفاتورة وقت الشراء
    };

    const newItems = [newItem, ...items];
    setItems(newItems);


    // Reset picker
    setSelectedProductId('');
    setItemCartons(1);
    setItemPieces(0);
    setItemCostPerCarton(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // === الحسابات: لا تحويل دائم للعملة، التسوية فقط بسعر صرف هذه الفاتورة ===
  const sums = useMemo(() => sumPurchaseItemsByCurrency(items, 'USD'), [items]);
  const settle = useMemo(
    () =>
      computePurchaseSettlement({
        totalUSD: sums.totalUSD,
        totalSYP: sums.totalSYP,
        discountUSD,
        discountSYP,
        paidUSD,
        paidSYP,
        rate: invoiceRate,
      }),
    [sums, discountUSD, discountSYP, paidUSD, paidSYP, invoiceRate]
  );
  const subtotal = Number((sums.totalUSD + sums.totalSYP / (invoiceRate || 1)).toFixed(2));
  const finalTotal = settle.totalEquivalentUSD;
  const remainingDebt = settle.remainingDebtUSD;

  // Selected supplier details
  const currentSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const currentSupplierDebt = useMemo(() => {
    return selectedSupplierId ? getSupplierBalance(selectedSupplierId) : 0;
  }, [selectedSupplierId, getSupplierBalance]);

  // Save Purchase Invoice
  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setFormError('يرجى إضافة صنف واحد على الأقل إلى فاتورة المشتريات');
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) {
      setFormError('يرجى اختيار المورد');
      return;
    }
    setFormError(null);

    if (!(invoiceRate > 0)) {
      setFormError('يرجى إدخال سعر صرف صحيح لهذه الفاتورة');
      return;
    }

    // المبالغ الأصلية بكل عملة + سعر الصرف الخاص بالفاتورة + نتيجة التسوية
    const multi = {
      currency: 'USD' as const, // finalTotal/paidAmount/remainingDebt بالدولار المعادل ؛ عملة كل بند محفوظة داخل البند
      invoiceExchangeRate: invoiceRate,
      items,
      subtotal,
      discount: discountUSD + discountSYP / invoiceRate,
      discountUSD,
      discountSYP,
      finalTotal: settle.totalEquivalentUSD,
      totalUSD: sums.totalUSD,
      totalSYP: sums.totalSYP,
      totalEquivalentUSD: settle.totalEquivalentUSD,
      paidUSD: settle.paidUSD,
      paidSYP: settle.paidSYP,
      paidSYPConvertedToUSD: settle.paidSYPConvertedToUSD,
      totalPaidEquivalentUSD: settle.totalPaidEquivalentUSD,
      paidAmount: settle.totalPaidEquivalentUSD,
      remainingDebt: settle.remainingDebtUSD,
      remainingDebtUSD: settle.remainingDebtUSD,
      supplierCreditUSD: settle.supplierCreditUSD,
      notes: notes.trim(),
    };

    if (editingInvoice) {
      const updated: PurchaseInvoice = {
        ...editingInvoice,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierCompany: supplier.company,
        ...multi,
        // تاريخ الفاتورة وسعر صرفها الأصلي لا يتغيران عند التعديل ما لم يعدّله المستخدم صراحة
        invoiceExchangeRate: invoiceRate,
        updatedAt: new Date().toISOString(),
      };
      onUpdatePurchaseInvoice(updated);
      setIsCreateModalOpen(false);
      setViewingInvoice(updated);
    } else {
      const invoiceNumber = `PUR-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = onCreatePurchaseInvoice({
        invoiceNumber,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierCompany: supplier.company,
        date: new Date().toISOString(),
        ...multi,
      });
      setIsCreateModalOpen(false);
      setViewingInvoice(created);
    }

    if (onCloseInitialModal) onCloseInitialModal();
  };

  // Filter purchase invoices
  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return purchaseInvoices;
    const clean = searchQuery.trim().toLowerCase();
    return purchaseInvoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(clean) ||
        inv.supplierName.toLowerCase().includes(clean) ||
        (inv.supplierCompany && inv.supplierCompany.toLowerCase().includes(clean)) ||
        inv.items.some((it) => it.productName.toLowerCase().includes(clean))
    );
  }, [purchaseInvoices, searchQuery]);

  // Totals overview
  const totalsOverview = useMemo(() => {
    let totalPurchasesUSD = 0;
    let totalPurchasesSYP = 0;
    let totalPaidUSD = 0;
    let totalPaidSYP = 0;
    let totalDebtUSD = 0;
    let totalDebtSYP = 0;

    for (const inv of purchaseInvoices) {
      if (inv.currency === 'USD') {
        totalPurchasesUSD += inv.finalTotal;
        totalPaidUSD += inv.paidAmount;
        totalDebtUSD += inv.remainingDebt;
      } else {
        totalPurchasesSYP += inv.finalTotal;
        totalPaidSYP += inv.paidAmount;
        totalDebtSYP += inv.remainingDebt;
      }
    }

    return {
      totalPurchasesUSD,
      totalPurchasesSYP,
      totalPaidUSD,
      totalPaidSYP,
      totalDebtUSD,
      totalDebtSYP,
    };
  }, [purchaseInvoices]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  return (
    <div className="space-y-4 pb-20 font-display">
      {/* Top Header Card */}
      <ViewHeader
        title="فواتير المشتريات وتوريد البضاعة"
        subtitle="إدخال بضائع من الموردين، زيادة المخزون تلقائياً، وتحديث تكاليف الشراء بالدولار والليرة."
        icon={ShoppingBag}
        actionButton={{
          label: 'إنشاء فاتورة مشتريات',
          icon: Plus,
          onClick: handleOpenCreate,
        }}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white dark:bg-[#153243]/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
            إجمالي المشتريات الواردة
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
              ${totalsOverview.totalPurchasesUSD.toLocaleString('en-US')}
            </span>
            {totalsOverview.totalPurchasesSYP > 0 && (
              <span className="text-xs font-bold text-slate-500 font-mono">
                + {totalsOverview.totalPurchasesSYP.toLocaleString('en-US')} ل.س
              </span>
            )}
          </div>
          <span className="text-[10px] text-[#FFAA47] font-medium block mt-0.5">
            {purchaseInvoices.length} فواتير توريد مسجلة
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-[#153243]/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
            المسدد نقداً للموردين
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
              ${totalsOverview.totalPaidUSD.toLocaleString('en-US')}
            </span>
            {totalsOverview.totalPaidSYP > 0 && (
              <span className="text-xs font-bold text-emerald-600 font-mono">
                + {totalsOverview.totalPaidSYP.toLocaleString('en-US')} ل.س
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">مدفوعات كاش مثبتة</span>
        </div>

        <div className="p-4 bg-white dark:bg-[#153243]/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">
            المتبقي ديون فواتير للموردين
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono">
              ${totalsOverview.totalDebtUSD.toLocaleString('en-US')}
            </span>
            {totalsOverview.totalDebtSYP > 0 && (
              <span className="text-xs font-bold text-amber-600 font-mono">
                + {totalsOverview.totalDebtSYP.toLocaleString('en-US')} ل.س
              </span>
            )}
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block mt-0.5">
            تضاف تلقائياً لحساب المورد
          </span>
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
          placeholder="البحث برقم فاتورة الشراء أو اسم المورد أو صنف البضاعة..."
          className="w-full h-12 pr-11 pl-4 rounded-2xl bg-white dark:bg-[#153243]/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFAA47] focus:border-[#FFAA47] shadow-xs font-display transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer font-display"
          >
            مسح
          </button>
        )}
      </div>

      {/* Purchase Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-500">
          <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
            لا توجد فواتير مشتريات مطابقة
          </p>
          <p className="text-xs text-slate-400 mt-1">
            اضغط على "إنشاء فاتورة مشتريات" لإدخال شحنة بضاعة وتحديث المخزون
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => (
            <div
              key={inv.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Invoice Main Info */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-black px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded">
                    {inv.invoiceNumber}
                  </span>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100 truncate">
                    {inv.supplierName}
                  </h3>
                  {inv.supplierCompany && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                      ({inv.supplierCompany})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(inv.date).toLocaleDateString('ar-SY')}</span>
                  </span>
                  <span>•</span>
                  <span>{inv.items.length} أصناف بضاعة</span>
                  {inv.notes && (
                    <>
                      <span>•</span>
                      <span className="text-slate-400 truncate max-w-[200px]">
                        ملاحظة: {inv.notes}
                      </span>
                    </>
                  )}
                </div>

                {/* Items summary */}
                <div className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 pt-1 font-sans">
                  {inv.items
                    .map(
                      (it) =>
                        `${it.productName} (${it.cartons} ك ${it.pieces > 0 ? `و ${it.pieces} ق` : ''})`
                    )
                    .join(' ، ')}
                </div>
              </div>

              {/* Financials & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                <div className="text-left font-mono">
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="text-xs text-slate-400">الإجمالي:</span>
                    <span className="text-base font-black text-slate-900 dark:text-slate-100">
                      {inv.finalTotal.toLocaleString('en-US')}
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {inv.currency}
                    </span>
                  </div>

                  {inv.remainingDebt > 0 ? (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block">
                      باقي دين: {inv.remainingDebt.toLocaleString('en-US')} {inv.currency}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>مسددة بالكامل</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewingInvoice(inv)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                    title="عرض وتفاصيل الفاتورة"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(inv)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
                    title="تعديل الفاتورة وتصحيح المخزون"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletePurchaseTarget(inv)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                    title="حذف الفاتورة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Purchase Invoice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          if (onCloseInitialModal) onCloseInitialModal();
        }}
        title={editingInvoice ? `تعديل فاتورة مشتريات: ${editingInvoice.invoiceNumber}` : 'فاتورة مشتريات وتوريد جديدة'}
        subtitle="اختيار المورد وإدخال كميات البضاعة وتكلفة الشراء لتحديث المخزون تلقائياً"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveInvoice} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{formError}</span>
            </div>
          )}
          {/* Supplier & Currency Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <SmartPickerTrigger
                label="المورد (المعمل أو الشركة)"
                required
                placeholder="🔍 اضغط للبحث الفوري واختيار المورد..."
                selectedTitle={suppliers.find((s) => s.id === selectedSupplierId)?.name}
                selectedSubtitle={
                  suppliers.find((s) => s.id === selectedSupplierId)?.company ||
                  suppliers.find((s) => s.id === selectedSupplierId)?.phone ||
                  undefined
                }
                selectedBadge={
                  currentSupplier && currentSupplierDebt > 0
                    ? `مستحق له: ${currentSupplierDebt.toLocaleString('en-US')}`
                    : undefined
                }
                onClick={() => setIsSupplierPickerOpen(true)}
              />

              {currentSupplier && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 px-1">
                  <span>الرصيد السابق للمورد:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {currentSupplierDebt.toLocaleString('en-US')} {currentSupplier.currency}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                عملة تسعير الصنف الذي ستضيفه (يمكن خلط الدولار والليرة في نفس الفاتورة)
              </label>
              <div className="flex h-11 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setInvoiceCurrency('USD')}
                  className={`flex-1 rounded-md text-xs font-bold transition ${
                    invoiceCurrency === 'USD'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  $ دولار (USD)
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceCurrency('SYP')}
                  className={`flex-1 rounded-md text-xs font-bold transition ${
                    invoiceCurrency === 'SYP'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  ليرة سورية (SYP)
                </button>
              </div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mt-2 mb-1">
                سعر الصرف لهذه الفاتورة (1$ = ؟ ل.س) *
              </label>
              <NumberInput value={invoiceRate} onChange={(v) => setInvoiceRate(Math.max(0, v))} min={0} step={100} />
              <span className="text-[10px] text-slate-400 block mt-1 px-1">
                يخص هذه الفاتورة فقط ويبقى ثابتاً فيها للأبد (سعر اليوم: {rate.toLocaleString('en-US')})
              </span>
            </div>
          </div>

          {/* Add Item Section */}
          <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-xl space-y-3">
            <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>إضافة منتج إلى فاتورة الشراء</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Product selector */}
              <div className="sm:col-span-2">
                <SmartPickerTrigger
                  label="اختر الصنف الغذائي"
                  placeholder="🔍 اضغط للبحث الفوري واختيار الصنف..."
                  selectedTitle={products.find((p) => p.id === selectedProductId)?.name}
                  selectedSubtitle={
                    selectedProductId && (() => {
                      const p = products.find((x) => x.id === selectedProductId);
                      if (!p) return undefined;
                      const ppc = p.piecesPerCarton || 1;
                      const cInStock = Math.floor(p.totalPiecesInStock / ppc);
                      const pInStock = p.totalPiecesInStock % ppc;
                      return `المتوفر حالياً: ${cInStock} ${p.unit || 'كرتونة'} ${pInStock > 0 ? `و ${pInStock} ق` : ''} • التكلفة المسجلة: ${p.purchaseCost} ${p.costCurrency}`;
                    })()
                  }
                  onClick={() => setIsProductPickerOpen(true)}
                  onClear={selectedProductId ? () => setSelectedProductId('') : undefined}
                />
              </div>

              {/* Cartons */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  عدد الكراتين / الطرود
                </label>
                <NumberInput
                  value={itemCartons}
                  onChange={(v) => setItemCartons(Math.max(0, Math.round(v)))}
                  min={0}
                  showStepper
                />
              </div>

              {/* Loose Pieces */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  قطع فردية إضافية
                </label>
                <NumberInput
                  value={itemPieces}
                  onChange={(v) => setItemPieces(Math.max(0, Math.round(v)))}
                  min={0}
                  showStepper
                />
              </div>

              {/* Purchase Cost Per Carton */}
              <div className="sm:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    تكلفة شراء الكرتونة الواحدة من المورد ({invoiceCurrency}) *
                  </label>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    سيتم اعتماد هذا السعر كتكلفة جديدة للمنتج
                  </span>
                </div>
                <NumberInput
                  value={itemCostPerCarton}
                  onChange={(v) => setItemCostPerCarton(Math.max(0, v))}
                  min={0}
                  step={invoiceCurrency === 'USD' ? 0.5 : 500}
                />
              </div>
            </div>

            {/* Selected product live stats preview */}
            {selectedProduct && itemCostPerCarton > 0 && (
              <div className="p-2.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px]">إجمالي الكمية المشتراة:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {itemCartons * (selectedProduct.piecesPerCarton || 1) + itemPieces} قطعة
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">تكلفة القطعة الواحدة:</span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-400 font-mono">
                    {invoiceCurrency === 'USD'
                      ? `$${(itemCostPerCarton / Math.max(1, selectedProduct.piecesPerCarton)).toFixed(2)}`
                      : `${Math.round(itemCostPerCarton / Math.max(1, selectedProduct.piecesPerCarton)).toLocaleString('en-US')} ل.س`}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block text-[10px]">إجمالي قيمة البند:</span>
                  <span className="font-black text-slate-900 dark:text-slate-100 font-mono">
                    {(
                      itemCartons * itemCostPerCarton +
                      (itemPieces * itemCostPerCarton) / (selectedProduct.piecesPerCarton || 1)
                    ).toLocaleString('en-US')}{' '}
                    {invoiceCurrency}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddItem}
              disabled={!selectedProductId || (itemCartons === 0 && itemPieces === 0) || itemCostPerCarton <= 0}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إدراج الصنف في فاتورة المشتريات</span>
            </button>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
              <span>أصناف الفاتورة ({items.length})</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">الأحدث يظهر في الأعلى</span>
            </div>

            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                لم يتم إضافة أصناف بعد
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {it.productName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {it.cartons > 0 && `${it.cartons} ${it.unit}`}
                        {it.cartons > 0 && it.pieces > 0 && ' و '}
                        {it.pieces > 0 && `${it.pieces} قطع`}
                        {' × '}
                        {it.costPerCarton.toLocaleString('en-US')} {it.currency || invoiceCurrency}
                        <span className="text-slate-400 mr-2">
                          (الإجمالي: {it.totalPieces} قطعة)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {it.itemTotal.toLocaleString('en-US')} {it.currency || invoiceCurrency}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-red-600 transition p-1"
                        title="حذف البند"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Totals & Payment (USD + SYP) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 text-xs text-slate-800 dark:text-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 block">إجمالي منتجات الدولار</span>
                <span className="text-base font-black">{sums.totalUSD.toLocaleString('en-US')} $</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 block">إجمالي منتجات الليرة</span>
                <span className="text-base font-black">{sums.totalSYP.toLocaleString('en-US')} ل.س</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1">خصم بالدولار</label>
                <NumberInput value={discountUSD} onChange={(v) => setDiscountUSD(Math.max(0, v))} min={0} step={1} />
              </div>
              <div>
                <label className="text-slate-500 dark:text-slate-400 block mb-1">خصم بالليرة</label>
                <NumberInput value={discountSYP} onChange={(v) => setDiscountSYP(Math.max(0, v))} min={0} step={1000} />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">المدفوع بالليرة (SYP Paid)</label>
                <NumberInput value={paidSYP} onChange={(v) => setPaidSYP(Math.max(0, v))} min={0} step={5000} />
              </div>
              <div>
                <label className="font-bold block mb-1">المدفوع بالدولار (USD Paid)</label>
                <NumberInput value={paidUSD} onChange={(v) => setPaidUSD(Math.max(0, v))} min={0} step={5} />
              </div>
            </div>

            {/* تفصيل التسوية بدون ازدواج */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ['إجمالي الفاتورة (دولار)', `${settle.netUSD.toLocaleString('en-US')} $`],
                ['إجمالي الفاتورة (ليرة)', `${settle.netSYP.toLocaleString('en-US')} ل.س`],
                ['المعادل الكلي بالدولار', `${settle.totalEquivalentUSD.toLocaleString('en-US')} $`],
                ['دفعة الليرة غطّت منتجات الليرة', `${settle.sypCoveringSYPItems.toLocaleString('en-US')} ل.س`],
                ['باقي دفعة الليرة (يعادل دولاراً)', `${settle.sypLeftover.toLocaleString('en-US')} ل.س ≈ ${settle.sypLeftoverAsUSD.toLocaleString('en-US')} $`],
                ['دفعة الليرة محوّلة للدولار', `${settle.paidSYPConvertedToUSD.toLocaleString('en-US')} $`],
                ['المدفوع بالدولار', `${settle.paidUSD.toLocaleString('en-US')} $`],
                ['إجمالي المدفوع بالدولار المعادل', `${settle.totalPaidEquivalentUSD.toLocaleString('en-US')} $`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between px-3 py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">{k}</span>
                  <span className="font-bold">{v}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-2 font-black text-sm">
                <span>المتبقي ديناً للمورد</span>
                <span className={settle.remainingDebtUSD > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                  {settle.remainingDebtUSD.toLocaleString('en-US')} $
                </span>
              </div>
              {settle.supplierCreditUSD > 0 && (
                <div className="flex justify-between px-3 py-2 font-black text-sm bg-emerald-50 dark:bg-emerald-950/40">
                  <span className="text-emerald-800 dark:text-emerald-300">رصيد دائن / دفعة مقدمة للمورد</span>
                  <span className="text-emerald-700 dark:text-emerald-300">{settle.supplierCreditUSD.toLocaleString('en-US')} $</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات أو رقم سند الشحن
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: واصلة مع سائق التوزيع، مستودع الفيحاء..."
              className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Automatic Inventory Notice */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>تحديث تلقائي:</strong> عند الضغط على حفظ، ستُضاف كميات الأصناف المشتراة فوراً إلى رصيد المخزون، وسيتم تحديث تكلفة الشراء للأصناف حسب هذه الفاتورة.
            </span>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={items.length === 0}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition active:scale-95 text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editingInvoice ? 'حفظ تعديلات فاتورة المشتريات وتصحيح المخزون' : 'تثبيت فاتورة المشتريات وإضافة البضاعة للمخزون'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Purchase Invoice Details Modal */}
      {viewingInvoice && (
        <Modal
          isOpen={!!viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          title={`تفاصيل فاتورة مشتريات: ${viewingInvoice.invoiceNumber}`}
          subtitle={`المورد: ${viewingInvoice.supplierName} • التاريخ: ${new Date(viewingInvoice.date).toLocaleDateString('ar-SY')}`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            {/* Header info card */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">اسم المورد:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {viewingInvoice.supplierName} {viewingInvoice.supplierCompany ? `(${viewingInvoice.supplierCompany})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">تاريخ الفاتورة:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date(viewingInvoice.date).toLocaleString('ar-SY')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">عملة الشراء:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {viewingInvoice.currency === 'USD' ? 'دولار أمريكي ($)' : 'ليرة سورية (SYP)'}
                </span>
              </div>
              {viewingInvoice.notes && (
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">ملاحظات:</span>
                  <span className="text-slate-700 dark:text-slate-300">{viewingInvoice.notes}</span>
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                <span>الصنف والكمية</span>
                <span>تكلفة الشراء والإجمالي</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {viewingInvoice.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{it.productName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {it.cartons > 0 && `${it.cartons} ${it.unit}`}
                        {it.cartons > 0 && it.pieces > 0 && ' و '}
                        {it.pieces > 0 && `${it.pieces} قطع`}
                        <span className="mr-2 text-slate-400">
                          (إجمالي {it.totalPieces} قطعة)
                        </span>
                      </div>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-slate-900 dark:text-slate-100 font-bold block">
                        {it.itemTotal.toLocaleString('en-US')} {it.currency || viewingInvoice.currency}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {it.costPerCarton.toLocaleString('en-US')} / {it.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Breakdown (historical, original currencies) */}
            {(() => {
              const v = viewingInvoice;
              const multi = v.remainingDebtUSD !== undefined;
              const r = v.invoiceExchangeRate;
              const usdTot = multi ? v.totalUSD || 0 : v.currency === 'USD' ? v.finalTotal : 0;
              const sypTot = multi ? v.totalSYP || 0 : v.currency === 'SYP' ? v.finalTotal : 0;
              const balAfter = LocalDatabase.getSupplierStatement(v.supplierId)
                .rows.find((x) => x.key === v.id)?.balanceAfterUSD;
              const rows: Array<[string, string]> = [
                ['تاريخ الفاتورة', new Date(v.date).toLocaleString('ar-SY')],
                ['سعر الصرف التاريخي للفاتورة', r ? `1$ = ${r.toLocaleString('en-US')} ل.س` : 'غير مسجل (فاتورة قديمة)'],
                ['إجمالي منتجات الدولار', `${usdTot.toLocaleString('en-US')} $`],
                ['إجمالي منتجات الليرة', `${sypTot.toLocaleString('en-US')} ل.س`],
                ['المدفوع بالليرة', `${(multi ? v.paidSYP || 0 : v.currency === 'SYP' ? v.paidAmount : 0).toLocaleString('en-US')} ل.س`],
                ['المدفوع بالدولار', `${(multi ? v.paidUSD || 0 : v.currency === 'USD' ? v.paidAmount : 0).toLocaleString('en-US')} $`],
                ['المتبقي (دين للمورد)', multi ? `${(v.remainingDebtUSD || 0).toLocaleString('en-US')} $` : `${v.remainingDebt.toLocaleString('en-US')} ${v.currency}`],
              ];
              if (multi && (v.supplierCreditUSD || 0) > 0) rows.push(['رصيد دائن ناتج عن هذه الفاتورة', `${(v.supplierCreditUSD || 0).toLocaleString('en-US')} $`]);
              if (balAfter !== undefined) rows.push(['رصيد المورد بعد هذه الفاتورة', `${balAfter.toLocaleString('en-US')} $`]);
              return (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  {rows.map(([k, val]) => (
                    <div key={k} className="flex justify-between text-slate-700 dark:text-slate-200">
                      <span className="text-slate-500 dark:text-slate-400">{k}</span>
                      <span className="font-bold">{val}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Action buttons */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة سند الشراء</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const inv = viewingInvoice;
                  setViewingInvoice(null);
                  handleOpenEdit(inv);
                }}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition text-xs flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Supplier Smart Picker Modal */}
      <SmartPickerModal<Supplier>
        isOpen={isSupplierPickerOpen}
        onClose={() => setIsSupplierPickerOpen(false)}
        title="اختر المورد أو المعمل الغذائي"
        placeholder="🔍 اكتب اسم المورد، الشركة، الهاتف، أو المدينة..."
        items={suppliers}
        selectedId={selectedSupplierId}
        getItemId={(s) => s.id}
        getItemTitle={(s) => s.name}
        getItemSubtitle={(s) => {
          const parts = [];
          if (s.company) parts.push(`الشركة: ${s.company}`);
          if (s.phone) parts.push(`هاتف: ${s.phone}`);
          if (s.notes) parts.push(s.notes);
          return parts.join(' • ');
        }}
        getItemBadge={(s) => {
          const debt = getSupplierBalance(s.id);
          if (debt > 0) {
            return {
              text: `مستحق له: ${debt.toLocaleString('en-US')} ${s.currency || 'USD'}`,
              color: 'amber',
            };
          }
          return { text: 'خالص', color: 'emerald' };
        }}
        getSearchTerms={(s) => [s.name, s.company || '', s.phone || '', s.notes || '']}
        onSelect={(s) => {
          setSelectedSupplierId(s.id);
          setIsSupplierPickerOpen(false);
        }}
      />

      {/* Product Smart Picker Modal */}
      <SmartPickerModal<Product>
        isOpen={isProductPickerOpen}
        onClose={() => setIsProductPickerOpen(false)}
        title="اختر الصنف الغذائي للتوريد والشراء"
        placeholder="🔍 اكتب اسم الصنف أو الوحدة للبحث الفوري..."
        items={products.filter((p) => !p.isArchived)}
        selectedId={selectedProductId}
        getItemId={(p) => p.id}
        getItemTitle={(p) => p.name}
        getItemSubtitle={(p) => {
          const ppc = p.piecesPerCarton || 1;
          const cInStock = Math.floor(p.totalPiecesInStock / ppc);
          const pInStock = p.totalPiecesInStock % ppc;
          return `المتوفر حالياً: ${cInStock} ${p.unit || 'كرتونة'} ${pInStock > 0 ? `و ${pInStock} ق` : ''} • التكلفة: ${p.purchaseCost} ${p.costCurrency}`;
        }}
        getItemBadge={(p) => {
          const ppc = p.piecesPerCarton || 1;
          const cInStock = Math.floor(p.totalPiecesInStock / ppc);
          return { text: `${cInStock} ${p.unit || 'كرتونة'}`, color: 'blue' };
        }}
        getSearchTerms={(p) => [p.name, p.unit || '', p.barcode || '']}
        onSelect={(p) => {
          handleProductSelectChange(p.id);
          setIsProductPickerOpen(false);
        }}
      />

      {/* Confirm Delete Purchase Invoice Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletePurchaseTarget}
        onClose={() => setDeletePurchaseTarget(null)}
        onConfirm={() => {
          if (deletePurchaseTarget) {
            onDeletePurchaseInvoice(deletePurchaseTarget.id);
            setDeletePurchaseTarget(null);
          }
        }}
        title="حذف فاتورة المشتريات"
        description={`هل أنت متأكد من حذف فاتورة المشتريات رقم (${deletePurchaseTarget?.invoiceNumber}) من المورد (${deletePurchaseTarget?.supplierName})؟ سيتم تلقائياً عكس الكميات من المخزون وتصحيح حساب المورد والصندوق.`}
        confirmText="نعم، احذف الفاتورة وعكس المخزون"
      />
    </div>
  );
};
