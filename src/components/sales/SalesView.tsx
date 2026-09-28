import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Printer,
  Edit2,
  Trash2,
  Share2,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Coins,
  Package,
  X,
  Eye,
  Info,
} from 'lucide-react';
import {
  Invoice,
  InvoiceItem,
  Product,
  Customer,
  AppSettings,
  Currency,
} from '../../types';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { NumberInput } from '../common/NumberInput';
import { Modal } from '../common/Modal';
import { SmartPickerModal } from '../common/SmartPickerModal';
import { SmartPickerTrigger } from '../common/SmartPickerTrigger';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ViewHeader } from '../common/ViewHeader';
import { ThermalReceipt } from './ThermalReceipt';
import { shareInvoicePdf } from '../../services/pdfExport';
import { LocalDatabase } from '../../services/db';

interface SalesViewProps {
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
  settings: AppSettings;
  onCreateInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Invoice;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  isCreateModalOpenInitially?: boolean;
  onCloseInitialModal?: () => void;
  initialSelectedInvoice?: Invoice | null;
}

export const SalesView: React.FC<SalesViewProps> = ({
  invoices,
  products,
  customers,
  settings,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  isCreateModalOpenInitially = false,
  onCloseInitialModal,
  initialSelectedInvoice = null,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(isCreateModalOpenInitially);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingReceiptInvoice, setViewingReceiptInvoice] = useState<Invoice | null>(
    initialSelectedInvoice
  );
  const [deleteInvoiceTarget, setDeleteInvoiceTarget] = useState<Invoice | null>(null);

  // Form State for creating/editing invoice
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id || ''
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [invoiceCurrency, setInvoiceCurrency] = useState<Currency>(settings.baseCurrency);
  const [isFixedUSD, setIsFixedUSD] = useState<boolean>(false);
  const [fixedExchangeRate, setFixedExchangeRate] = useState<number>(settings.exchangeRate || 15000);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Item selector state
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemCartons, setItemCartons] = useState<number>(1);
  const [itemPieces, setItemPieces] = useState<number>(0);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);

  // Smart picker modals state
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState<boolean>(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState<boolean>(false);
  const [showCostDetails, setShowCostDetails] = useState<boolean>(true);

  const rate = settings.exchangeRate || 15000;

  const handleOpenCreate = () => {
    setEditingInvoice(null);
    setFormError(null);
    setSelectedCustomerId(customers[0]?.id || '');
    setInvoiceCurrency(settings.baseCurrency);
    setIsFixedUSD(false);
    setFixedExchangeRate(settings.exchangeRate || 15000);
    setItems([]);
    setDiscount(0);
    setPaidAmount(0);
    setNotes('');
    setSelectedProductId('');
    setItemCartons(1);
    setItemPieces(0);
    setItemUnitPrice(0);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setFormError(null);
    setSelectedCustomerId(inv.customerId);
    setInvoiceCurrency(inv.currency);
    setIsFixedUSD(!!inv.isFixedUSD);
    setFixedExchangeRate(inv.fixedExchangeRate || settings.exchangeRate || 15000);
    setItems([...inv.items]);
    setDiscount(inv.discount);
    setPaidAmount(inv.paidAmount);
    setNotes(inv.notes || '');
    setIsCreateModalOpen(true);
  };

  // Product selection changed in item selector
  const handleProductSelectChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      // 1. Check if product has a preset default selling price (Requirement 4 & 5)
      const defaultPrice = prod.defaultSellingPrice || prod.sellingPrice;
      const defaultPriceCurr = prod.defaultSellingPriceCurrency || prod.sellingPriceCurrency || prod.costCurrency;

      if (defaultPrice && defaultPrice > 0) {
        if (defaultPriceCurr === invoiceCurrency) {
          setItemUnitPrice(defaultPrice);
        } else if (defaultPriceCurr === 'USD' && invoiceCurrency === 'SYP') {
          setItemUnitPrice(Math.round(defaultPrice * rate));
        } else if (defaultPriceCurr === 'SYP' && invoiceCurrency === 'USD') {
          setItemUnitPrice(Math.round((defaultPrice / (rate || 1)) * 100) / 100);
        } else {
          setItemUnitPrice(defaultPrice);
        }
      } else {
        // Fallback: cost in invoice currency
        const costSYP =
          prod.costCurrency === 'USD' ? prod.purchaseCost * rate : prod.purchaseCost;
        const price =
          invoiceCurrency === 'USD' ? prod.purchaseCost : costSYP;
        setItemUnitPrice(Math.round(price));
      }
    }
  };

  // Add item to invoice: "آخر المنتجات المضافة تظهر في الأعلى" (latest added at top)
  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const ppc = prod.piecesPerCarton || 1;
    const totalPieces = itemCartons * ppc + itemPieces;
    if (totalPieces <= 0) return;

    // Line total: cartons * price + (pieces * price / ppc)
    const cartonPartTotal = itemCartons * itemUnitPrice;
    const piecePartTotal = (itemPieces * itemUnitPrice) / ppc;
    const lineTotal = Math.round(cartonPartTotal + piecePartTotal);

    // Record historical purchase cost at time of sale (Requirement 3)
    const costPerCarton = prod.purchaseCost;
    const costCurrency = prod.costCurrency;
    let costPerCartonInInvoiceCurrency = costPerCarton;
    if (costCurrency !== invoiceCurrency) {
      if (invoiceCurrency === 'USD') {
        costPerCartonInInvoiceCurrency = costPerCarton / (rate || 1);
      } else {
        costPerCartonInInvoiceCurrency = costPerCarton * rate;
      }
    }
    const cartonCost = itemCartons * costPerCartonInInvoiceCurrency;
    const pieceCost = (itemPieces * costPerCartonInInvoiceCurrency) / ppc;
    const totalCostAtSale = Math.round((cartonCost + pieceCost) * 100) / 100;
    const profitAtSale = Math.round((lineTotal - totalCostAtSale) * 100) / 100;

    const newItem: InvoiceItem = {
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit || 'كرتونة',
      piecesPerCarton: ppc,
      cartons: itemCartons,
      pieces: itemPieces,
      totalPieces,
      unitPrice: itemUnitPrice,
      priceType: 'carton',
      itemTotal: lineTotal,
      costPriceAtSale: costPerCarton,
      costCurrencyAtSale: costCurrency,
      totalCostAtSale,
      profitAtSale,
    };

    // Unshift to put latest added at top!
    const newItems = [newItem, ...items];
    setItems(newItems);

    // Auto update paidAmount if previous was matching total
    const currentSubtotal = newItems.reduce((acc, curr) => acc + curr.itemTotal, 0);
    setPaidAmount(Math.max(0, currentSubtotal - discount));

    // Reset picker
    setSelectedProductId('');
    setItemCartons(1);
    setItemPieces(0);
    setItemUnitPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + curr.itemTotal, 0);
  }, [items]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  const remainingDebt = useMemo(() => {
    return Math.max(0, finalTotal - paidAmount);
  }, [finalTotal, paidAmount]);

  const fixedUSDAmount = useMemo(() => {
    if (invoiceCurrency === 'USD') return finalTotal;
    const currRate = fixedExchangeRate || rate || 15000;
    return currRate > 0 ? Number((finalTotal / currRate).toFixed(2)) : 0;
  }, [invoiceCurrency, finalTotal, fixedExchangeRate, rate]);

  // Submit invoice
  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setFormError('يرجى إضافة صنف واحد على الأقل إلى الفاتورة');
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) {
      setFormError('يرجى اختيار العميل');
      return;
    }
    setFormError(null);

    const customerCurrentDebt = LocalDatabase.getCustomerBalance(customer.id);
    const prevBalance = editingInvoice
      ? customerCurrentDebt - editingInvoice.remainingDebt
      : customerCurrentDebt;

    // Calculate invoice profit metrics
    const totalInvoiceCost = items.reduce((sum, it) => sum + (it.totalCostAtSale || 0), 0);
    const expectedProfit = finalTotal - totalInvoiceCost;
    const profitMarginPercent = totalInvoiceCost > 0 ? (expectedProfit / totalInvoiceCost) * 100 : 0;
    const fixedUSDCost = isFixedUSD ? (totalInvoiceCost / (fixedExchangeRate || rate)) : undefined;
    const fixedUSDProfit = isFixedUSD ? (expectedProfit / (fixedExchangeRate || rate)) : undefined;

    if (editingInvoice) {
      const updated: Invoice = {
        ...editingInvoice,
        customerId: customer.id,
        customerName: customer.name,
        customerShop: customer.shopName,
        currency: invoiceCurrency,
        items,
        subtotal,
        discount,
        finalTotal,
        paidAmount,
        remainingDebt,
        previousCustomerBalance: prevBalance,
        totalCost: totalInvoiceCost,
        expectedProfit,
        profitMarginPercent,
        isFixedUSD,
        fixedExchangeRate: isFixedUSD ? fixedExchangeRate : undefined,
        fixedUSDAmount: isFixedUSD ? fixedUSDAmount : undefined,
        fixedUSDCost,
        fixedUSDProfit,
        notes: notes.trim(),
        updatedAt: new Date().toISOString(),
      };
      onUpdateInvoice(updated);
      setIsCreateModalOpen(false);
      setViewingReceiptInvoice(updated);
    } else {
      const invoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const created = onCreateInvoice({
        invoiceNumber,
        customerId: customer.id,
        customerName: customer.name,
        customerShop: customer.shopName,
        date: new Date().toISOString(),
        currency: invoiceCurrency,
        items,
        subtotal,
        discount,
        finalTotal,
        paidAmount,
        remainingDebt,
        previousCustomerBalance: prevBalance,
        totalCost: totalInvoiceCost,
        expectedProfit,
        profitMarginPercent,
        isFixedUSD,
        fixedExchangeRate: isFixedUSD ? fixedExchangeRate : undefined,
        fixedUSDAmount: isFixedUSD ? fixedUSDAmount : undefined,
        fixedUSDCost,
        fixedUSDProfit,
        notes: notes.trim(),
      });
      setIsCreateModalOpen(false);
      setViewingReceiptInvoice(created);
    }

    if (onCloseInitialModal) onCloseInitialModal();
  };

  // Filter invoices by search
  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const clean = searchQuery.trim().toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(clean) ||
        inv.customerName.toLowerCase().includes(clean) ||
        (inv.customerShop && inv.customerShop.toLowerCase().includes(clean))
    );
  }, [invoices, searchQuery]);

  return (
    <div className="space-y-4 pb-20 font-display">
      {/* Top Action Bar */}
      <ViewHeader
        title="المبيعات وفواتير المحلات"
        subtitle="إنشاء فواتير بيع بالكرتونة والقطع، حساب الرصيد السابق والمتبقي، ودعم الطباعة الحرارية."
        icon={Receipt}
        actionButton={{
          label: 'إنشاء فاتورة بيع',
          icon: Plus,
          onClick: handleOpenCreate,
        }}
      />

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-5 h-5 stroke-[2.2]" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="البحث برقم الفاتورة أو اسم العميل / المحل..."
          className="w-full h-12 pr-11 pl-4 rounded-2xl bg-white dark:bg-[#153243]/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFAA47] focus:border-[#FFAA47] shadow-xs font-display transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer font-display"
          >
            مسح
          </button>
        )}
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm text-slate-500">
          <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-sm">لا توجد فواتير مسجلة</p>
          <p className="text-xs text-slate-400 mt-1">اضغط على "إنشاء فاتورة بيع" لبدء البيع</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => (
            <div
              key={inv.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Invoice Info */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-black px-2 py-0.5 bg-slate-100 rounded text-slate-800">
                    {inv.invoiceNumber}
                  </span>
                  <h3 className="font-black text-base text-slate-900 truncate">
                    {inv.customerName}
                  </h3>
                  {inv.customerShop && (
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      ({inv.customerShop})
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(inv.date).toLocaleDateString('ar-SY')}</span>
                  </span>
                  <span>•</span>
                  <span>{inv.items.length} أصناف</span>
                  {inv.notes && (
                    <>
                      <span>•</span>
                      <span className="text-slate-400 truncate max-w-[200px]">
                        ملاحظة: {inv.notes}
                      </span>
                    </>
                  )}
                </div>

                {/* Items preview */}
                <div className="text-[11px] text-slate-600 line-clamp-1 pt-1 font-sans">
                  {inv.items.map((it) => `${it.productName} (${it.cartons} ك)`).join(' ، ')}
                </div>
              </div>

              {/* Financials & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-bold">المجموع:</span>
                    <CurrencyBadge amount={inv.finalTotal} currency={inv.currency} size="sm" />
                  </div>
                  <div className="text-[11px] mt-0.5 space-x-2 space-x-reverse">
                    <span className="text-emerald-700 font-bold">
                      مدفوع: {inv.paidAmount.toLocaleString('en-US')}
                    </span>
                    {inv.remainingDebt > 0 && (
                      <span className="text-red-600 font-black">
                        • باقي: {inv.remainingDebt.toLocaleString('en-US')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      await shareInvoicePdf(inv, settings, '80mm');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#FFAA47]/15 hover:bg-[#FFAA47]/30 text-amber-900 dark:text-amber-300 font-bold text-xs rounded-lg transition"
                    title="مشاركة الفاتورة PDF عبر واتساب والتطبيقات"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">مشاركة PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingReceiptInvoice(inv)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="معاينة وطباعة الفاتورة"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(inv)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="تعديل الفاتورة والمخزون"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteInvoiceTarget(inv)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="حذف وإلغاء الفاتورة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Invoice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          if (onCloseInitialModal) onCloseInitialModal();
        }}
        title={editingInvoice ? `تعديل الفاتورة: ${editingInvoice.invoiceNumber}` : 'فاتورة بيع جديدة'}
        subtitle="اختيار العميل، إضافة المنتجات بالكرتونة والقطع، وتحديد سعر البيع"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveInvoice} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{formError}</span>
            </div>
          )}
          {/* Customer & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <SmartPickerTrigger
                label="العميل / المحل"
                required
                placeholder="🔍 اضغط للبحث الفوري واختيار العميل..."
                selectedTitle={
                  customers.find((c) => c.id === selectedCustomerId)?.name
                }
                selectedSubtitle={
                  customers.find((c) => c.id === selectedCustomerId)?.shopName ||
                  customers.find((c) => c.id === selectedCustomerId)?.phone ||
                  undefined
                }
                selectedBadge={
                  selectedCustomerId &&
                  LocalDatabase.getCustomerBalance(selectedCustomerId) > 0
                    ? `دين: ${LocalDatabase.getCustomerBalance(selectedCustomerId).toLocaleString('en-US')}`
                    : undefined
                }
                onClick={() => setIsCustomerPickerOpen(true)}
              />

              {/* Customer Previous Balance Display */}
              {selectedCustomerId && (() => {
                const cust = customers.find((c) => c.id === selectedCustomerId);
                if (!cust) return null;
                const curDebt = LocalDatabase.getCustomerBalance(cust.id);
                const prevDebt = editingInvoice ? curDebt - (editingInvoice.finalTotal - editingInvoice.paidAmount) : curDebt;
                return (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>الدين السابق للعميل:</span>
                    </div>
                    <div className="font-mono font-black text-amber-950 dark:text-amber-200">
                      {prevDebt.toLocaleString('en-US')} {cust.currency || 'SYP'}
                      {prevDebt > 0 && <span className="text-[10px] mr-1 text-red-600 dark:text-red-400 font-normal">(مطلوب منه)</span>}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                عملة الفاتورة
              </label>
              <div className="flex h-11 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setInvoiceCurrency('SYP')}
                  className={`flex-1 rounded-lg text-xs font-bold transition ${
                    invoiceCurrency === 'SYP'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  ليرة سورية (SYP)
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceCurrency('USD')}
                  className={`flex-1 rounded-lg text-xs font-bold transition ${
                    invoiceCurrency === 'USD'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  دولار ($)
                </button>
              </div>
            </div>

            {invoiceCurrency === 'SYP' && (
              <div className="sm:col-span-2 p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="fixUsdCheckbox"
                    checked={isFixedUSD}
                    onChange={(e) => setIsFixedUSD(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="fixUsdCheckbox" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    تثبيت قيمة الفاتورة بالدولار (USD)
                  </label>
                </div>
                {isFixedUSD && (
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="text-slate-500 text-[11px]">سعر التثبيت:</span>
                    <input
                      type="number"
                      value={fixedExchangeRate}
                      onChange={(e) => setFixedExchangeRate(Number(e.target.value) || rate)}
                      className="w-24 h-8 px-2 bg-white dark:bg-slate-800 border border-amber-300 rounded-lg text-center font-mono text-xs font-bold"
                    />
                    <span className="text-slate-500 text-[11px]">ل.س</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add Item Section */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>إضافة صنف إلى الفاتورة</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Product selector */}
              <div className="sm:col-span-2">
                <SmartPickerTrigger
                  label="اختر المنتج الغذائي"
                  placeholder="🔍 اضغط للبحث الفوري واختيار المنتج..."
                  selectedTitle={products.find((p) => p.id === selectedProductId)?.name}
                  selectedSubtitle={
                    selectedProductId && (() => {
                      const p = products.find((x) => x.id === selectedProductId);
                      if (!p) return undefined;
                      const ppc = p.piecesPerCarton || 1;
                      const cInStock = Math.floor(p.totalPiecesInStock / ppc);
                      const pInStock = p.totalPiecesInStock % ppc;
                      return `المتوفر بالمستودع: ${cInStock} ${p.unit || 'كرتونة'} ${pInStock > 0 ? `و ${pInStock} قطعة` : ''}`;
                    })()
                  }
                  selectedBadge={
                    selectedProductId && (() => {
                      const p = products.find((x) => x.id === selectedProductId);
                      if (!p) return undefined;
                      return p.totalPiecesInStock <= 0 ? 'نفد من المخزون' : undefined;
                    })()
                  }
                  onClick={() => setIsProductPickerOpen(true)}
                  onClear={selectedProductId ? () => setSelectedProductId('') : undefined}
                />
              </div>

              {/* Product Cost and Stock Info */}
              {selectedProductId && (() => {
                const prod = products.find((p) => p.id === selectedProductId);
                if (!prod) return null;
                const ppc = prod.piecesPerCarton || 1;
                const cartonsInStock = Math.floor(prod.totalPiecesInStock / ppc);
                const piecesInStock = prod.totalPiecesInStock % ppc;
                const cartonCost = prod.purchaseCost || 0;
                const isCostUSD = prod.costCurrency === 'USD';

                const cartonCostUSD = isCostUSD ? cartonCost : (rate > 0 ? cartonCost / rate : 0);
                const cartonCostSYP = isCostUSD ? cartonCost * rate : cartonCost;
                const pieceCostUSD = ppc > 0 ? cartonCostUSD / ppc : 0;
                const pieceCostSYP = ppc > 0 ? cartonCostSYP / ppc : 0;

                return (
                  <div className="sm:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowCostDetails(!showCostDetails)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/80 transition"
                      >
                        <Package className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{showCostDetails ? 'إخفاء تكلفة المنتج والمخزون ▴' : 'عرض تكلفة المنتج بالدولار والليرة ▾'}</span>
                      </button>

                      {/* Compact Stock Glance */}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        المتوفر في المستودع:{' '}
                        <strong className="text-slate-800 dark:text-slate-200 font-mono">
                          {cartonsInStock} {prod.unit || 'كرتونة'}{' '}
                          {piecesInStock > 0 ? `+ ${piecesInStock} ق` : ''}
                        </strong>
                      </span>
                    </div>

                    {showCostDetails && (
                      <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-2.5 text-xs">
                        <div className="flex items-center justify-between border-b border-amber-200/70 dark:border-amber-900/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="font-black text-slate-900 dark:text-white text-sm">
                              {prod.name}
                            </span>
                            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                              تكلفة الشراء الأصلية
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            سعر الصرف: 1$ = {rate.toLocaleString('en-US')} ل.س
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {/* Carton Cost USD & SYP */}
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-amber-200/80 dark:border-amber-900/50 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                              تكلفة الكرتونة الكاملة
                            </span>
                            <div className="space-y-0.5">
                              <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                ${cartonCostUSD.toFixed(2)}
                              </div>
                              <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                                {Math.round(cartonCostSYP).toLocaleString('en-US')} ل.س
                              </div>
                            </div>
                          </div>

                          {/* Piece Cost USD & SYP */}
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-amber-200/80 dark:border-amber-900/50 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                              تكلفة القطعة الواحدة
                            </span>
                            <div className="space-y-0.5">
                              <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                ${pieceCostUSD.toFixed(2)}
                              </div>
                              <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                                {Math.round(pieceCostSYP).toLocaleString('en-US')} ل.س
                              </div>
                            </div>
                          </div>

                          {/* Stock in Cartons & Total Pieces */}
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                              رصيد المستودع
                            </span>
                            <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                              {cartonsInStock} {prod.unit || 'كرتونة'}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              (إجمالي: {prod.totalPiecesInStock.toLocaleString('en-US')} ق)
                            </span>
                          </div>

                          {/* Pieces per Carton */}
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                              محتوى الكرتونة
                            </span>
                            <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                              {ppc} قطعة
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              في كل {prod.unit || 'كرتونة'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cartons */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  عدد الكراتين
                </label>
                <NumberInput
                  value={itemCartons}
                  onChange={(v) => setItemCartons(Math.max(0, Math.round(v)))}
                  min={0}
                  showStepper
                />
              </div>

              {/* Loose pieces */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  قطع فردية من الكرتونة
                </label>
                <NumberInput
                  value={itemPieces}
                  onChange={(v) => setItemPieces(Math.max(0, Math.round(v)))}
                  min={0}
                  showStepper
                />
              </div>

              {/* Selling Price (Manual - no auto margin enforced) */}
              <div className="sm:col-span-2">
                <div className="flex flex-wrap justify-between items-center mb-1 gap-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    سعر بيع الكرتونة يدويًا ({invoiceCurrency})
                  </label>
                  {selectedProductId && (() => {
                    const prod = products.find((p) => p.id === selectedProductId);
                    if (!prod) return null;
                    const isCostUSD = prod.costCurrency === 'USD';
                    const cCostUSD = isCostUSD ? prod.purchaseCost : (rate > 0 ? prod.purchaseCost / rate : 0);
                    const cCostSYP = isCostUSD ? prod.purchaseCost * rate : prod.purchaseCost;
                    return (
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                        التكلفة عليك: ${cCostUSD.toFixed(2)} ({Math.round(cCostSYP).toLocaleString('en-US')} ل.س)
                      </span>
                    );
                  })()}
                </div>
                <NumberInput
                  value={itemUnitPrice}
                  onChange={(v) => setItemUnitPrice(Math.max(0, v))}
                  min={0}
                  step={invoiceCurrency === 'USD' ? 0.5 : 500}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              disabled={!selectedProductId || (itemCartons === 0 && itemPieces === 0)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>إدراج الصنف في الفاتورة</span>
            </button>
          </div>

          {/* Items Table: "آخر المنتجات المضافة تظهر في الأعلى" */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 flex justify-between">
              <span>أصناف الفاتورة ({items.length})</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">الأحدث يظهر في الأعلى</span>
            </div>

            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900">
                لم يتم إضافة أصناف بعد
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto bg-white dark:bg-slate-900">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate">{it.productName}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span>
                          {it.cartons > 0 && `${it.cartons} ${it.unit}`}
                          {it.cartons > 0 && it.pieces > 0 && ' و '}
                          {it.pieces > 0 && `${it.pieces} قطع`}
                          {' × '}
                          {it.unitPrice.toLocaleString('en-US')} {invoiceCurrency}
                        </span>
                        {(() => {
                          const prod = products.find((p) => p.id === it.productId);
                          if (!prod) return null;
                          const isUSD = prod.costCurrency === 'USD';
                          const cCostUSD = isUSD ? prod.purchaseCost : (rate > 0 ? prod.purchaseCost / rate : 0);
                          const cCostSYP = isUSD ? prod.purchaseCost * rate : prod.purchaseCost;
                          return (
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                              تكلفة الكرتونة: ${cCostUSD.toFixed(2)} ({Math.round(cCostSYP).toLocaleString('en-US')} ل.س)
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {it.itemTotal.toLocaleString('en-US')} {invoiceCurrency}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition p-1"
                        title="إزالة الصنف"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoice Totals & Payments */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex justify-between items-center text-sm font-bold text-slate-700 dark:text-slate-300">
              <span>المجموع الفرعي:</span>
              <span className="font-mono text-slate-900 dark:text-slate-100">
                {subtotal.toLocaleString('en-US')} {invoiceCurrency}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  الخصم (إن وُجد)
                </label>
                <NumberInput
                  value={discount}
                  onChange={(v) => setDiscount(Math.max(0, v))}
                  min={0}
                  step={invoiceCurrency === 'USD' ? 1 : 1000}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  المبلغ المدفوع نقداً
                </label>
                <NumberInput
                  value={paidAmount}
                  onChange={(v) => setPaidAmount(Math.max(0, v))}
                  min={0}
                  step={invoiceCurrency === 'USD' ? 1 : 5000}
                />
              </div>
            </div>

            {/* Quick payment helper buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaidAmount(finalTotal)}
                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200 transition"
              >
                دفع كامل (خالص)
              </button>
              <button
                type="button"
                onClick={() => setPaidAmount(0)}
                className="px-2.5 py-1 text-[11px] font-bold bg-red-100 text-red-800 rounded hover:bg-red-200 transition"
              >
                دين كامل (0)
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">المجموع النهائي:</span>
                <span className="text-base font-black text-slate-900 dark:text-slate-100 font-mono">
                  {finalTotal.toLocaleString('en-US')} {invoiceCurrency}
                </span>
              </div>

              <div className="text-left">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">المتبقي ديناً من الفاتورة:</span>
                <span
                  className={`text-base font-black font-mono ${
                    remainingDebt > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {remainingDebt.toLocaleString('en-US')} {invoiceCurrency}
                </span>
              </div>
            </div>

            {/* Previous Customer Debt & Cumulative Account Statement (Strict Formula) */}
            {selectedCustomerId && (() => {
              const cust = customers.find((c) => c.id === selectedCustomerId);
              if (!cust) return null;
              const curDebt = LocalDatabase.getCustomerBalance(cust.id);
              const prev = editingInvoice
                ? curDebt - (editingInvoice.finalTotal - editingInvoice.paidAmount)
                : curDebt;
              const finalCustomerBalance = prev + finalTotal - paidAmount;

              return (
                <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 rounded-xl border space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      ملخص رصيد وحساب العميل ({cust.name}):
                    </span>
                    <span className="font-mono text-[11px]">
                      الرصيد السابق + الفاتورة − المدفوع = المتبقي
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs sm:text-sm">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>الرصيد السابق:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {prev.toLocaleString('en-US')} {cust.currency || invoiceCurrency}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>قيمة الفاتورة:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {finalTotal.toLocaleString('en-US')} {invoiceCurrency}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-semibold">
                      <span>المدفوع:</span>
                      <span className="font-mono font-black">
                        {paidAmount.toLocaleString('en-US')} {invoiceCurrency}
                      </span>
                    </div>

                    <div className="pt-2 border-t-2 border-dashed border-slate-300 dark:border-slate-700 flex justify-between items-center text-sm sm:text-base font-black">
                      <span className="text-slate-900 dark:text-white">المتبقي على العميل:</span>
                      <span
                        className={`font-mono text-base sm:text-lg ${
                          finalCustomerBalance > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {finalCustomerBalance.toLocaleString('en-US')} {cust.currency || invoiceCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Expected Profit Section (Requirement 1) */}
          {(() => {
            const liveTotalCost = items.reduce((sum, it) => {
              if (it.totalCostAtSale !== undefined) return sum + it.totalCostAtSale;
              const prod = products.find((p) => p.id === it.productId);
              if (!prod) return sum;
              const ppc = prod.piecesPerCarton || 1;
              const cCost = prod.costCurrency === invoiceCurrency
                ? prod.purchaseCost
                : (invoiceCurrency === 'USD' ? prod.purchaseCost / (rate || 1) : prod.purchaseCost * rate);
              return sum + it.cartons * cCost + (it.pieces * cCost) / ppc;
            }, 0);

            const liveProfit = finalTotal - liveTotalCost;
            const liveMarginPct = liveTotalCost > 0 ? (liveProfit / liveTotalCost) * 100 : 0;

            const liveTotalCostUSD = isFixedUSD
              ? (liveTotalCost / (fixedExchangeRate || rate))
              : (invoiceCurrency === 'USD' ? liveTotalCost : (rate > 0 ? liveTotalCost / rate : 0));
            const liveProfitUSD = isFixedUSD
              ? (liveProfit / (fixedExchangeRate || rate))
              : (invoiceCurrency === 'USD' ? liveProfit : (rate > 0 ? liveProfit / rate : 0));
            const liveSaleUSD = isFixedUSD
              ? (fixedUSDAmount || 0)
              : (invoiceCurrency === 'USD' ? finalTotal : (rate > 0 ? finalTotal / rate : 0));

            return (
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                      📈
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-emerald-950 dark:text-emerald-200">
                        الأرباح المتوقعة من هذه الفاتورة
                      </h4>
                      <p className="text-[10px] text-emerald-800 dark:text-emerald-400">
                        حساب الربحية مبني على تكلفة المنتجات وقت البيع
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-black bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-2.5 py-1 rounded-full font-mono">
                    هامش: {liveMarginPct.toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">إجمالي البيع:</span>
                    <span className="font-black font-mono text-slate-900 dark:text-white">
                      {Math.round(finalTotal).toLocaleString('en-US')} {invoiceCurrency}
                    </span>
                    {isFixedUSD && (
                      <span className="text-[10px] text-slate-400 font-mono block">(${liveSaleUSD.toFixed(1)})</span>
                    )}
                  </div>

                  <div className="p-2 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">تكلفة البضاعة:</span>
                    <span className="font-black font-mono text-amber-700 dark:text-amber-400">
                      {Math.round(liveTotalCost).toLocaleString('en-US')} {invoiceCurrency}
                    </span>
                    {isFixedUSD && (
                      <span className="text-[10px] text-slate-400 font-mono block">(${liveTotalCostUSD.toFixed(1)})</span>
                    )}
                  </div>

                  <div className="p-2 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">الربح المتوقع:</span>
                    <span className={`font-black font-mono text-sm ${liveProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                      {liveProfit > 0 ? '+' : ''}{Math.round(liveProfit).toLocaleString('en-US')} {invoiceCurrency}
                    </span>
                    {isFixedUSD && (
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono block font-bold">
                        (+${liveProfitUSD.toFixed(1)})
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-emerald-800 dark:text-emerald-400 text-center leading-relaxed font-semibold">
                  * هذا القسم للمستخدم والإدارة فقط، ولا يظهر للعميل في الإيصال الحراري أو ملف الـ PDF.
                </p>
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات الفاتورة (اختياري)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تسليم سيارة رقم 2، دفعة مع السائق..."
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-[#FFAA47] hover:bg-[#ff9f2c] text-slate-950 font-black rounded-2xl shadow-md transition active:scale-95 text-base font-display cursor-pointer"
            >
              {editingInvoice ? 'حفظ تعديلات الفاتورة والمخزون' : 'حفظ الفاتورة وعرض الإيصال / PDF'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View & Print Receipt Modal */}
      {viewingReceiptInvoice && (
        <Modal
          isOpen={!!viewingReceiptInvoice}
          onClose={() => setViewingReceiptInvoice(null)}
          title={`فاتورة: ${viewingReceiptInvoice.invoiceNumber}`}
          subtitle="حفظ الفاتورة كملف PDF على هاتفك ومشاركتها عبر واتساب"
          maxWidth="md"
        >
          {/* معلومة محاسبية داخلية فقط: لا تُطبع ولا تظهر في PDF العميل */}
          <div className="mb-3 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-300">سعر الصرف وقت البيع (داخلي)</span>
            <span className="font-black text-slate-900 dark:text-white">
              {(viewingReceiptInvoice.exchangeRate || viewingReceiptInvoice.fixedExchangeRate)
                ? `1$ = ${(viewingReceiptInvoice.exchangeRate || viewingReceiptInvoice.fixedExchangeRate || 0).toLocaleString('en-US')} ل.س`
                : 'غير مسجل (فاتورة قديمة)'}
            </span>
          </div>
          <ThermalReceipt
            invoice={viewingReceiptInvoice}
            settings={settings}
            onClose={() => setViewingReceiptInvoice(null)}
          />
        </Modal>
      )}

      {/* Customer Smart Picker Modal */}
      <SmartPickerModal<Customer>
        isOpen={isCustomerPickerOpen}
        onClose={() => setIsCustomerPickerOpen(false)}
        title="اختر العميل أو المحل التجاري"
        placeholder="🔍 اكتب اسم العميل، اسم المحل، الهاتف، أو العنوان..."
        items={customers}
        selectedId={selectedCustomerId}
        getItemId={(c) => c.id}
        getItemTitle={(c) => c.name}
        getItemSubtitle={(c) => {
          const parts = [];
          if (c.shopName) parts.push(`المحل: ${c.shopName}`);
          if (c.phone) parts.push(`هاتف: ${c.phone}`);
          if (c.address) parts.push(c.address);
          return parts.join(' • ');
        }}
        getItemBadge={(c) => {
          const debt = LocalDatabase.getCustomerBalance(c.id);
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
          setSelectedCustomerId(c.id);
          setIsCustomerPickerOpen(false);
        }}
      />

      {/* Product Smart Picker Modal */}
      <SmartPickerModal<Product>
        isOpen={isProductPickerOpen}
        onClose={() => setIsProductPickerOpen(false)}
        title="اختر المنتج الغذائي"
        placeholder="🔍 اكتب اسم المنتج الغذائي أو الوحدة للبحث الفوري..."
        items={products.filter((p) => !p.isArchived)}
        selectedId={selectedProductId}
        getItemId={(p) => p.id}
        getItemTitle={(p) => p.name}
        getItemSubtitle={(p) => {
          const ppc = p.piecesPerCarton || 1;
          const cInStock = Math.floor(p.totalPiecesInStock / ppc);
          const pInStock = p.totalPiecesInStock % ppc;
          const isUSD = p.costCurrency === 'USD';
          const cCostUSD = isUSD ? p.purchaseCost : (rate > 0 ? p.purchaseCost / rate : 0);
          const cCostSYP = isUSD ? p.purchaseCost * rate : p.purchaseCost;
          return `المتوفر: ${cInStock} ${p.unit || 'كرتونة'}${pInStock > 0 ? ` و ${pInStock} ق` : ''} • التكلفة عليك: $${cCostUSD.toFixed(2)} (${Math.round(cCostSYP).toLocaleString('en-US')} ل.س)`;
        }}
        getItemBadge={(p) => {
          if (p.totalPiecesInStock <= 0) {
            return { text: 'نفد من المخزون', color: 'slate' };
          }
          const ppc = p.piecesPerCarton || 1;
          const cInStock = Math.floor(p.totalPiecesInStock / ppc);
          if (cInStock < 5) {
            return { text: 'كمية منخفضة', color: 'amber' };
          }
          return { text: `${cInStock} ${p.unit || 'كرتونة'}`, color: 'blue' };
        }}
        getSearchTerms={(p) => [p.name, p.unit || '', p.barcode || '']}
        onSelect={(p) => {
          handleProductSelectChange(p.id);
          setIsProductPickerOpen(false);
        }}
      />

      {/* Confirm Delete Invoice Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteInvoiceTarget}
        onClose={() => setDeleteInvoiceTarget(null)}
        onConfirm={() => {
          if (deleteInvoiceTarget) {
            onDeleteInvoice(deleteInvoiceTarget.id);
            setDeleteInvoiceTarget(null);
          }
        }}
        title="حذف وإلغاء فاتورة البيع"
        description={`هل أنت متأكد من إلغاء وحذف الفاتورة رقم (${deleteInvoiceTarget?.invoiceNumber}) للعميل (${deleteInvoiceTarget?.customerName})؟ سيتم تلقائياً إرجاع جميع المواد المباعة إلى المخزون وتصحيح رصيد العميل والصندوق.`}
        confirmText="نعم، احذف الفاتورة واسترجع المخزون"
      />
    </div>
  );
};
