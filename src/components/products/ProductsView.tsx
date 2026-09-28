import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Boxes,
  DollarSign,
  Layers,
  ArrowUpDown,
  Check,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { Product, AppSettings, Currency } from '../../types';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { NumberInput } from '../common/NumberInput';
import { Modal } from '../common/Modal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ViewHeader } from '../common/ViewHeader';

interface ProductsViewProps {
  products: Product[];
  settings: AppSettings;
  onAddProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateStock: (productId: string, newTotalPieces: number) => void;
  isAddModalOpenInitially?: boolean;
  onCloseInitialModal?: () => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  settings,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateStock,
  isAddModalOpenInitially = false,
  onCloseInitialModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(isAddModalOpenInitially);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);

  // Quick Stock adjustment modal
  const [stockAdjustProduct, setStockAdjustProduct] = useState<Product | null>(null);
  const [stockCartons, setStockCartons] = useState(0);
  const [stockLoosePieces, setStockLoosePieces] = useState(0);

  // Form State
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('كرتونة');
  const [piecesPerCarton, setPiecesPerCarton] = useState(12);
  const [costCurrency, setCostCurrency] = useState<Currency>('USD');
  const [purchaseCost, setPurchaseCost] = useState(10);
  const [defaultSellingPrice, setDefaultSellingPrice] = useState<number>(0);
  const [defaultSellingPriceCurrency, setDefaultSellingPriceCurrency] = useState<Currency>('USD');
  const [initialStockCartons, setInitialStockCartons] = useState(10);
  const [initialStockLoose, setInitialStockLoose] = useState(0);

  const rate = settings.exchangeRate || 15000;

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setUnit('كرتونة');
    setPiecesPerCarton(12);
    setCostCurrency('USD');
    setPurchaseCost(15);
    setDefaultSellingPrice(18);
    setDefaultSellingPriceCurrency('USD');
    setInitialStockCartons(10);
    setInitialStockLoose(0);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setUnit(p.unit || 'كرتونة');
    setPiecesPerCarton(p.piecesPerCarton || 12);
    setCostCurrency(p.costCurrency || 'USD');
    setPurchaseCost(p.purchaseCost || 0);
    setDefaultSellingPrice(p.defaultSellingPrice || p.sellingPrice || 0);
    setDefaultSellingPriceCurrency(p.defaultSellingPriceCurrency || p.sellingPriceCurrency || p.costCurrency || 'USD');

    const ppc = p.piecesPerCarton || 1;
    setInitialStockCartons(Math.floor(p.totalPiecesInStock / ppc));
    setInitialStockLoose(p.totalPiecesInStock % ppc);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const ppc = Math.max(1, piecesPerCarton);
    const totalPieces = initialStockCartons * ppc + initialStockLoose;

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        name: name.trim(),
        unit: unit.trim(),
        piecesPerCarton: ppc,
        costCurrency,
        purchaseCost,
        defaultSellingPrice,
        defaultSellingPriceCurrency,
        sellingPrice: defaultSellingPrice,
        sellingPriceCurrency: defaultSellingPriceCurrency,
        totalPiecesInStock: totalPieces,
      });
    } else {
      onAddProduct({
        name: name.trim(),
        unit: unit.trim(),
        piecesPerCarton: ppc,
        costCurrency,
        purchaseCost,
        defaultSellingPrice,
        defaultSellingPriceCurrency,
        sellingPrice: defaultSellingPrice,
        sellingPriceCurrency: defaultSellingPriceCurrency,
        totalPiecesInStock: totalPieces,
      });
    }

    setIsModalOpen(false);
    if (onCloseInitialModal) onCloseInitialModal();
  };

  const handleOpenStockAdjust = (p: Product) => {
    setStockAdjustProduct(p);
    const ppc = p.piecesPerCarton || 1;
    setStockCartons(Math.floor(p.totalPiecesInStock / ppc));
    setStockLoosePieces(p.totalPiecesInStock % ppc);
  };

  const handleSaveStockAdjust = () => {
    if (!stockAdjustProduct) return;
    const ppc = stockAdjustProduct.piecesPerCarton || 1;
    const newTotal = stockCartons * ppc + stockLoosePieces;
    onUpdateStock(stockAdjustProduct.id, newTotal);
    setStockAdjustProduct(null);
  };

  // Cost breakdown helper
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Fast search with Arabic normalization
  const filteredProducts = useMemo(() => {
    const activeProducts = products.filter((p) => !p.isArchived);
    if (!searchQuery.trim()) return activeProducts;
    const clean = searchQuery
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');

    return activeProducts.filter((p) => {
      const pName = p.name
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
      return pName.includes(clean);
    });
  }, [products, searchQuery]);

  // Calculations for costs in form preview
  const calculatedCartonSYP =
    costCurrency === 'USD' ? purchaseCost * rate : purchaseCost;
  const calculatedCartonUSD =
    costCurrency === 'USD' ? purchaseCost : purchaseCost / rate;
  const calculatedPieceSYP =
    calculatedCartonSYP / Math.max(1, piecesPerCarton);
  const calculatedPieceUSD =
    calculatedCartonUSD / Math.max(1, piecesPerCarton);

  return (
    <div className="space-y-4 pb-20 font-display">
      {/* Header & Add Button */}
      <ViewHeader
        title="المنتجات والمخزون الغذائي"
        subtitle="إدارة أصناف المواد الغذائية، تكاليف الشراء بالدولار/الليرة، وجرد الكراتين والقطع."
        icon={Package}
        actionButton={{
          label: 'إضافة منتج جديد',
          icon: Plus,
          onClick: handleOpenAdd,
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
          placeholder="البحث السريع بالاسم أو الحروف الأولى (مثلاً: زيت، سكر، تونة)..."
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

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm text-slate-500">
          <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-bold text-sm">لا توجد منتجات مطابقة للبحث</p>
          <p className="text-xs text-slate-400 mt-1">تأكد من كتابة الاسم أو أضف صنفاً جديداً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredProducts.map((product) => {
            const ppc = product.piecesPerCarton || 1;
            const cartonsInStock = Math.floor(product.totalPiecesInStock / ppc);
            const loosePiecesInStock = product.totalPiecesInStock % ppc;
            const isLowStock = product.totalPiecesInStock < ppc * 2;

            // Auto calculations
            const cartonCostSYP =
              product.costCurrency === 'USD'
                ? product.purchaseCost * rate
                : product.purchaseCost;
            const pieceCostSYP = cartonCostSYP / ppc;
            const pieceCostUSD =
              (product.costCurrency === 'USD'
                ? product.purchaseCost
                : product.purchaseCost / rate) / ppc;

            return (
              <div
                key={product.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-4 flex flex-col justify-between transition hover:shadow-md ${
                  isLowStock
                    ? 'border-amber-300 dark:border-amber-700/60'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Product Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-slate-100 leading-snug">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-semibold">
                          {product.unit || 'كرتونة'}
                        </span>
                        <span>•</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {ppc} قطعة بالكرتونة
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewingProduct(product)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition"
                        title="تفاصيل التكلفة وسعر الصرف"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(product)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
                        title="تعديل"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteProductTarget(product)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                        title="حذف المنتج"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stock Display */}
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">المخزون الحالي:</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                          {cartonsInStock}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{product.unit}</span>
                        {loosePiecesInStock > 0 && (
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-400 mr-1.5">
                            و {loosePiecesInStock} قطعة
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono mr-1">
                          ({product.totalPiecesInStock} قطعة)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenStockAdjust(product)}
                      className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-300 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-lg transition shadow-xs"
                    >
                      تعديل الجرد
                    </button>
                  </div>

                  {/* Pricing Breakdown: Carton cost + Pieces per carton + Single piece cost + Currency + Exchange rate */}
                  <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                          تكلفة الكرتونة:
                        </span>
                        <div className="mt-0.5 flex items-baseline gap-1">
                          <CurrencyBadge
                            amount={product.purchaseCost}
                            currency={product.costCurrency}
                            size="sm"
                          />
                        </div>
                        {product.costCurrency === 'USD' ? (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono block mt-0.5">
                            ≈ {cartonCostSYP.toLocaleString('en-US')} ل.س
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                            ≈ ${(product.purchaseCost / rate).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                          تكلفة القطعة الواحدة:
                        </span>
                        <div className="mt-0.5 flex items-baseline gap-1">
                          <CurrencyBadge
                            amount={product.costCurrency === 'USD' ? pieceCostUSD : pieceCostSYP}
                            currency={product.costCurrency}
                            size="sm"
                          />
                        </div>
                        {product.costCurrency === 'USD' ? (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono block mt-0.5">
                            ≈ {Math.round(pieceCostSYP).toLocaleString('en-US')} ل.س
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                            ≈ ${(pieceCostUSD).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Default Selling Price Display (Requirement 4 & 5) */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex justify-between items-center text-xs">
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                        سعر البيع المسبق:
                      </span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {product.defaultSellingPrice && product.defaultSellingPrice > 0 ? (
                          `${product.defaultSellingPrice.toLocaleString('en-US')} ${product.defaultSellingPriceCurrency || product.costCurrency}`
                        ) : (
                          <span className="text-[10px] text-slate-400 font-normal">غير محدد</span>
                        )}
                      </span>
                    </div>

                    {/* Currency & Exchange Rate Bar */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">عملة التكلفة:</span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                          {product.costCurrency === 'USD' ? '$ دولار' : 'ل.س ليرة'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        <span>الصرف:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">$1 = {rate.toLocaleString('en-US')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {isLowStock && (
                  <div className="mt-2 text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>تنبيه: المخزون منخفض، يرجى طلب شحنة جديدة</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          if (onCloseInitialModal) onCloseInitialModal();
        }}
        title={editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج غذائي جديد'}
        subtitle="أدخل تفاصيل العبوة وتكلفة الشراء لحساب تكلفة القطعة تلقائياً"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم المنتج *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: زيت دوار الشمس 1 لتر، سكر أبيض، تونة 160غ..."
              className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الوحدة / العبوة
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="كرتونة، طرد، شوال، صندوق..."
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عدد القطع داخل العبوة *
              </label>
              <NumberInput
                value={piecesPerCarton}
                onChange={(val) => setPiecesPerCarton(Math.max(1, Math.round(val)))}
                min={1}
                step={1}
                showStepper
              />
            </div>
          </div>

          {/* Cost of Purchase & Currency */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                تكلفة شراء {unit || 'الكرتونة'}:
              </label>

              {/* Currency Toggle for Purchase Cost */}
              <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCostCurrency('USD')}
                  className={`px-3 py-1 rounded-md transition ${
                    costCurrency === 'USD'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  $ دولار
                </button>
                <button
                  type="button"
                  onClick={() => setCostCurrency('SYP')}
                  className={`px-3 py-1 rounded-md transition ${
                    costCurrency === 'SYP'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ل.س سوري
                </button>
              </div>
            </div>

            <NumberInput
              value={purchaseCost}
              onChange={(val) => setPurchaseCost(val)}
              min={0}
              step={costCurrency === 'USD' ? 0.5 : 1000}
              placeholder="أدخل تكلفة الشراء..."
            />

            {/* Live Auto Calculation Box */}
            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">تكلفة الكرتونة:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {costCurrency === 'USD'
                    ? `${purchaseCost} $ ≈ ${calculatedCartonSYP.toLocaleString('en-US')} ل.س`
                    : `${purchaseCost.toLocaleString('en-US')} ل.س`}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">تكلفة القطعة تلقائياً:</span>
                <span className="font-bold text-blue-700 font-mono">
                  {costCurrency === 'USD'
                    ? `${calculatedPieceUSD.toFixed(2)} $ ≈ ${Math.round(calculatedPieceSYP).toLocaleString('en-US')} ل.س`
                    : `${Math.round(calculatedPieceSYP).toLocaleString('en-US')} ل.س`}
                </span>
              </div>
            </div>
          </div>

          {/* Default Selling Price (Requirement 4 & 5) */}
          <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                سعر البيع المسبق (الافتراضي للفاتورة):
              </label>
              <div className="flex bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 p-0.5 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDefaultSellingPriceCurrency('USD')}
                  className={`px-3 py-1 rounded-md transition ${
                    defaultSellingPriceCurrency === 'USD'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
                >
                  $ دولار
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultSellingPriceCurrency('SYP')}
                  className={`px-3 py-1 rounded-md transition ${
                    defaultSellingPriceCurrency === 'SYP'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
                >
                  ل.س سوري
                </button>
              </div>
            </div>

            <NumberInput
              value={defaultSellingPrice}
              onChange={(val) => setDefaultSellingPrice(val)}
              min={0}
              step={defaultSellingPriceCurrency === 'USD' ? 0.5 : 1000}
              placeholder="حدد سعر البيع المسبق للكرتونة..."
            />
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
              * هذا السعر يتم تعبئته تلقائياً عند إضافة الصنف لفاتورة البيع، ويمكنك تعديله داخل الفاتورة بكل مرونة دون تغيير السعر المسبق للمنتج.
            </p>
          </div>

          {/* Initial Stock */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2">
            <span className="text-xs font-black text-blue-900 block">
              الكمية المتوفرة في المستودع حالياً:
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  عدد {unit || 'الكراتين'}
                </label>
                <NumberInput
                  value={initialStockCartons}
                  onChange={(val) => setInitialStockCartons(Math.max(0, Math.round(val)))}
                  min={0}
                  showStepper
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  قطع فردية إضافية
                </label>
                <NumberInput
                  value={initialStockLoose}
                  onChange={(val) => setInitialStockLoose(Math.max(0, Math.round(val)))}
                  min={0}
                  max={piecesPerCarton - 1}
                  showStepper
                />
              </div>
            </div>
            <p className="text-[11px] text-blue-800 font-mono text-center pt-1">
              الإجمالي: {initialStockCartons * piecesPerCarton + initialStockLoose} قطعة
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition active:scale-95 text-base"
            >
              {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج إلى المستودع'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Stock Adjustment Modal */}
      {stockAdjustProduct && (
        <Modal
          isOpen={!!stockAdjustProduct}
          onClose={() => setStockAdjustProduct(null)}
          title={`تعديل جرد: ${stockAdjustProduct.name}`}
          subtitle="تعديل الكمية الفعلية المتوفرة في المستودع"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">العبوة:</span>
                <span className="font-bold">{stockAdjustProduct.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">عدد القطع في العبوة:</span>
                <span className="font-bold">{stockAdjustProduct.piecesPerCarton} قطعة</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  عدد {stockAdjustProduct.unit}
                </label>
                <NumberInput
                  value={stockCartons}
                  onChange={(v) => setStockCartons(Math.max(0, Math.round(v)))}
                  min={0}
                  showStepper
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  قطع فردية إضافية
                </label>
                <NumberInput
                  value={stockLoosePieces}
                  onChange={(v) => setStockLoosePieces(Math.max(0, Math.round(v)))}
                  min={0}
                  showStepper
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 text-blue-900 rounded-xl text-center text-xs font-bold">
              إجمالي القطع بعد التعديل:{' '}
              <span className="font-mono text-base font-black text-blue-700">
                {stockCartons * (stockAdjustProduct.piecesPerCarton || 1) + stockLoosePieces}
              </span>{' '}
              قطعة
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleSaveStockAdjust}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95 text-sm"
              >
                تثبيت الجرد الجديد
              </button>
              <button
                type="button"
                onClick={() => setStockAdjustProduct(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Product Detailed Cost & Exchange Breakdown Modal */}
      {viewingProduct && (() => {
        const ppc = viewingProduct.piecesPerCarton || 1;
        const cartonCostSYP =
          viewingProduct.costCurrency === 'USD'
            ? viewingProduct.purchaseCost * rate
            : viewingProduct.purchaseCost;
        const cartonCostUSD =
          viewingProduct.costCurrency === 'USD'
            ? viewingProduct.purchaseCost
            : viewingProduct.purchaseCost / rate;
        const pieceCostSYP = cartonCostSYP / ppc;
        const pieceCostUSD = cartonCostUSD / ppc;
        const cartonsInStock = Math.floor(viewingProduct.totalPiecesInStock / ppc);
        const looseInStock = viewingProduct.totalPiecesInStock % ppc;

        return (
          <Modal
            isOpen={!!viewingProduct}
            onClose={() => setViewingProduct(null)}
            title={`تفاصيل المنتج والتكلفة: ${viewingProduct.name}`}
            subtitle="عرض شامل لحسابات التكلفة وسعر الصرف والمخزون الحالي"
            maxWidth="lg"
          >
            <div className="space-y-4">
              {/* Main Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">اسم الصنف</span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{viewingProduct.name}</h3>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-bold rounded-lg text-xs">
                    {viewingProduct.unit}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">المخزون المتوفر:</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {cartonsInStock} {viewingProduct.unit} {looseInStock > 0 ? `+ ${looseInStock} قطعة` : ''}
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      (إجمالي {viewingProduct.totalPiecesInStock} قطعة)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">سعر الصرف المعتمد:</span>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      $1 = {rate.toLocaleString('en-US')} ل.س
                    </span>
                  </div>
                </div>
              </div>

              {/* Requirement 2 Explicit Details Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 font-bold text-xs text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                  جدول تفاصيل التكلفة والقطع
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs bg-white dark:bg-slate-900">
                  <div className="flex justify-between items-center p-3">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">تكلفة الكرتونة:</span>
                    <div className="text-left font-mono">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 ml-2">
                        {viewingProduct.purchaseCost.toLocaleString('en-US')} {viewingProduct.costCurrency}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {viewingProduct.costCurrency === 'USD'
                          ? `(≈ ${cartonCostSYP.toLocaleString('en-US')} ل.س)`
                          : `(≈ $${cartonCostUSD.toFixed(2)})`}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">عدد القطع بالكرتونة:</span>
                    <span className="font-bold text-sm text-indigo-700 dark:text-indigo-400 font-mono">
                      {ppc} قطعة / كرتونة
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">تكلفة القطعة الواحدة:</span>
                    <div className="text-left font-mono">
                      <span className="font-bold text-sm text-blue-700 dark:text-blue-400 ml-2">
                        {viewingProduct.costCurrency === 'USD'
                          ? `$${pieceCostUSD.toFixed(3)}`
                          : `${Math.round(pieceCostSYP).toLocaleString('en-US')} ل.س`}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {viewingProduct.costCurrency === 'USD'
                          ? `(≈ ${Math.round(pieceCostSYP).toLocaleString('en-US')} ل.س)`
                          : `(≈ $${pieceCostUSD.toFixed(3)})`}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">عملة التكلفة:</span>
                    <span className="font-bold text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded font-mono">
                      {viewingProduct.costCurrency === 'USD' ? 'USD (دولار أمريكي)' : 'SYP (ليرة سورية)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">سعر الصرف المستخدم:</span>
                    <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400 font-mono">
                      1 دولار = {rate.toLocaleString('en-US')} ليرة سورية
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const p = viewingProduct;
                    setViewingProduct(null);
                    handleOpenEdit(p);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل المنتج أو التكلفة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingProduct(null)}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Confirm Product Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteProductTarget}
        onClose={() => setDeleteProductTarget(null)}
        onConfirm={() => {
          if (deleteProductTarget) {
            onDeleteProduct(deleteProductTarget.id);
            setDeleteProductTarget(null);
          }
        }}
        title="حذف المنتج من المستودع"
        description={`هل أنت متأكد من حذف الصنف (${deleteProductTarget?.name})؟ إذا كان الصنف مستخدماً في فواتير سابقة فسيتم أرشفته بأمان لضمان سلامة السجلات المالية التاريخية.`}
        confirmText="نعم، حذف المنتج"
      />
    </div>
  );
};
