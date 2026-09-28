export type Currency = 'SYP' | 'USD';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  exchangeRate: number; // 1 USD = X SYP (e.g. 15000)
  baseCurrency: Currency;
  centerName: string;
  centerPhone: string;
  centerAddress: string;
  receiptFooter: string;
  themeMode?: ThemeMode;
  initialCashSYP?: number; // رصيد الصندوق الافتتاحي بالليرة السورية
  initialCashUSD?: number; // رصيد الصندوق الافتتاحي بالدولار
  hasPartner?: boolean; // هل يوجد شريك في المشروع
  partnerName?: string; // اسم الشريك (مثل: أبو عمر)
}

export interface Product {
  id: string;
  name: string;
  unit: string; // e.g., 'كرتونة', 'طرد', 'شوال', 'صندوق'
  piecesPerCarton: number; // عدد القطع داخل الكرتونة (مثلاً 12)
  costCurrency: Currency; // USD or SYP
  purchaseCost: number; // تكلفة شراء الكرتونة بالعملة المحددة
  sellingPrice?: number; // سعر البيع المحدد مسبقاً
  sellingPriceCurrency?: Currency; // عملة سعر البيع المحدد
  defaultSellingPrice?: number; // سعر البيع المسبق الافتراضي
  defaultSellingPriceCurrency?: Currency; // عملة سعر البيع المسبق (SYP / USD)
  totalPiecesInStock: number; // إجمالي القطع المتوفرة في المستودع
  barcode?: string;
  notes?: string;
  isArchived?: boolean; // أرشفة المنتج للحفاظ على الفواتير القديمة
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  shopName: string; // اسم المحل / البقالية
  address: string;
  initialDebt: number; // بالعملة القديمة أو SYP
  initialDebtUSD?: number; // رصيد سابق بالدولار
  currency: Currency;
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  unit: string;
  piecesPerCarton: number;
  cartons: number; // عدد الكراتين
  pieces: number; // عدد القطع الإضافية
  totalPieces: number; // cartons * piecesPerCarton + pieces
  unitPrice: number; // سعر بيع الكرتونة المحدد يدوياً
  priceType: 'carton' | 'piece';
  itemTotal: number; // إجمالي البند
  // Historical cost at sale for exact profit calculations
  costPriceAtSale?: number; // تكلفة شراء الكرتونة وقت البيع
  costCurrencyAtSale?: Currency; // عملة التكلفة وقت البيع
  totalCostAtSale?: number; // إجمالي تكلفة البند بعملة الفاتورة
  profitAtSale?: number; // الربح الصافي للبند بعملة الفاتورة
  // تكلفة البند بعملاتها الأصلية وتفصيل الدفعات (FIFO) - تاريخية ولا تتغير
  costUSDOriginal?: number;
  costSYPOriginal?: number;
  costBreakdown?: Array<{
    batchId: string;
    pieces: number;
    unitCost: number;
    currency: Currency;
    batchExchangeRate: number;
  }>;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g., "INV-00101"
  customerId: string;
  customerName: string;
  customerShop?: string;
  date: string; // YYYY-MM-DDTHH:mm:ss
  currency: Currency;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  finalTotal: number;
  paidAmount: number; // المدفوع نقداً عند البيع
  remainingDebt: number; // المتبقي ديناً على العميل
  previousCustomerBalance?: number; // الرصيد السابق للعميل المسجل لحظة إنشاء الفاتورة
  // Historical expected profit calculations
  totalCost?: number; // إجمالي تكلفة البضاعة وقت البيع
  expectedProfit?: number; // إجمالي الربح المتوقع
  profitMarginPercent?: number; // نسبة الربح %
  isFixedUSD?: boolean; // تثبيت سعر الفاتورة بالدولار
  fixedExchangeRate?: number; // سعر التثبيت بالليرة لكل دولار (مثلاً 13,500)
  fixedUSDAmount?: number; // قيمة الفاتورة المحسوبة بالدولار ومثبتة
  fixedUSDCost?: number; // تكلفة البضاعة بالدولار عند التثبيت
  fixedUSDProfit?: number; // الربح المتوقع بالدولار عند التثبيت
  exchangeRate?: number; // سعر الصرف المعتمد للفاتورة
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInvoiceItem {
  productId: string;
  productName: string;
  unit: string;
  piecesPerCarton: number;
  cartons: number; // عدد الكراتين المشتراة
  pieces: number; // قطع إضافية مشتراة
  totalPieces: number; // cartons * piecesPerCarton + pieces
  costPerCarton: number; // تكلفة شراء الكرتونة بالعملة الأصلية للبند
  currency: Currency; // عملة البند المستقلة (USD أو SYP)
  itemTotal: number; // إجمالي تكلفة البند بالعملة الأصلية للبند
  exchangeRate?: number; // سعر الصرف وقت الشراء إذا كان بالليرة
  supplierId?: string;
  invoiceId?: string;
  date?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string; // e.g., "PUR-1001"
  supplierId: string;
  supplierName: string;
  supplierCompany?: string;
  date: string; // YYYY-MM-DDTHH:mm:ss
  currency: Currency | 'MIXED'; // 'USD' | 'SYP' | 'MIXED'
  invoiceExchangeRate: number; // سعر صرف هذه الفاتورة حصراً (e.g. 13,000 SYP/USD)
  items: PurchaseInvoiceItem[];
  subtotal: number;
  discount: number;
  discountUSD?: number; // خصم بالدولار (الفواتير متعددة العملات)
  discountSYP?: number; // خصم بالليرة
  finalTotal: number;
  // Multi-currency item totals (حفظ مبالغ العملتين بشكل مستقل تماماً):
  totalUSD: number; // إجمالي المنتجات المسعرة بالدولار (e.g. 1500 USD)
  totalSYP: number; // إجمالي المنتجات المسعرة بالليرة (e.g. 10,000,000 SYP)
  totalEquivalentUSD: number; // totalUSD + (totalSYP / invoiceExchangeRate)
  // Payments:
  paidAmount: number; // للتوافقية مع الواجهات القديمة
  paidSYP: number; // المدفوع نقداً بالليرة السورية
  paidUSD: number; // المدفوع نقداً بالدولار الأمريكي
  paidSYPConvertedToUSD: number; // paidSYP / invoiceExchangeRate
  totalPaidEquivalentUSD: number; // paidUSD + paidSYPConvertedToUSD
  remainingDebtUSD: number; // المتبقي ديناً للمورد بالدولار (إذا كان المدفوع أقل من الإجمالي)
  supplierCreditUSD: number; // رصيد دائن للمورد / دفعة مقدمة بالدولار (إذا كان المدفوع أكبر من الإجمالي)
  remainingDebt?: number; // للتوافقية
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// دفعة مخزون مستقلة لحساب التكلفة التاريخية الدقيقة (FIFO / Batch Costing)
export interface InventoryBatch {
  id: string;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  purchaseInvoiceId?: string;
  date: string;
  quantityTotalPieces: number;
  remainingPieces: number;
  unitCost: number; // تكلفة شراء الكرتونة بالعملة الأصلية
  currency: Currency; // USD أو SYP
  exchangeRate: number; // سعر الصرف وقت الشراء
  notes?: string;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: Currency;
  date: string;
  exchangeRate?: number; // سعر الصرف وقت الدفعة (تاريخي)
  paymentMethod: 'cash' | 'transfer';
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string; // الشركة أو المعمل
  phone: string;
  initialDebt: number; // بالليرة السورية
  initialDebtUSD?: number; // بالدولار
  currency: Currency;
  notes?: string;
  createdAt: string;
}

export interface SupplierTransaction {
  id: string;
  supplierId: string;
  supplierName: string;
  type: 'purchase' | 'payment'; // مشتريات (زيادة دين) أو دفعة (سداد)
  amount: number;
  currency: Currency;
  date: string;
  invoiceId?: string; // ربط مع فاتورة الشراء
  invoiceNumber?: string;
  amountUSD?: number; // القيمة المقابلة بالدولار
  amountSYP?: number; // القيمة بالليرة السورية
  exchangeRate?: number; // سعر الصرف المعتمد وقت المعاملة
  creditUSD?: number; // رصيد دائن ناتج عن دفعة زائدة
  balanceAfterUSD?: number; // الرصيد بعد الحركة بالدولار
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  amount: number;
  currency: Currency;
  person: string; // الشخص المسؤول عن الصرف (افتراضياً: عبدالله)
  category: string; // بنزين، صيانة، كهرباء، إيجار، عمال، أخرى
  exchangeRate?: number; // سعر الصرف وقت المصروف (تاريخي)
  date: string;
  notes?: string;
  createdAt: string;
}

// عملية شراء دولار من الليرة السورية
export interface UsdPurchase {
  id: string;
  amountUSD: number; // مثلاً 100 USD
  exchangeRate: number; // مثلاً 13500 SYP
  costSYP: number; // 1,350,000 SYP
  date: string;
  notes?: string;
  createdAt: string;
}

// عملية سحب بضاعة من المخزون لعبدالله أو الشريك (بسعر التكلفة)
export interface GoodsWithdrawal {
  id: string;
  person: 'abdallah' | 'partner';
  productId: string;
  productName: string;
  unit: string;
  cartons: number;
  pieces: number;
  totalPieces: number;
  unitCost: number; // تكلفة الكرتونة
  currency: Currency; // عملة التكلفة (USD أو SYP)
  totalCost: number; // القيمة الإجمالية المسجلة على الحساب الجاري
  exchangeRate?: number; // سعر الصرف وقت السحب (تاريخي)
  date: string;
  notes?: string;
  createdAt: string;
}

// حركات رأس مال الشريك (إضافة أو استرداد)
export type PartnerCapitalTransactionType = 'deposit' | 'refund';

export interface PartnerCapitalTransaction {
  id: string;
  type: PartnerCapitalTransactionType; // 'deposit': إضافة رأس مال | 'refund': استرداد رأس مال
  partnerName: string;
  amount: number; // المبلغ بالعملة المدخلة
  currency: Currency; // 'USD' | 'SYP'
  exchangeRate?: number; // سعر الصرف المعتمد وقت العملية إذا كان بالليرة السورية
  equivalentUSD: number; // القيمة التاريخية المقابلة بالدولار (لا تتغير بتغير سعر الصرف المستقبلي)
  amountUSD?: number; // للتوافقية
  date: string; // تاريخ ووقت العملية (ISO أو YYYY-MM-DDTHH:mm)
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// مساهمة رأس مال الشريك (متوافق مع حركات رأس المال)
export type PartnerCapital = PartnerCapitalTransaction;

// سجل سداد رأس مال الشريك (متوافق مع حركات رأس المال)
export type PartnerCapitalRepayment = PartnerCapitalTransaction;

export type CashTransactionCategory =
  | 'capital_deposit'            // إيداع نقدي / رأس مال / تمويل
  | 'partner_capital_repayment'  // سداد من رأس مال الشريك (يخرج من الصندوق ولا يعتبر مصروفاً)
  | 'sale_income'                // مقبوضات بيع نقدي
  | 'customer_payment'           // دفعة نقدية من عميل
  | 'supplier_payment'           // سداد دفعة لمورد
  | 'purchase_cash'              // مشتريات نقدية مدفوعة
  | 'operating_expense'          // مصروف تشغيلي (وقود، صيانة، إلخ)
  | 'usd_purchase'               // شراء دولار (تحويل عملة بين الأرصدة)
  | 'usd_sale'                   // بيع دولار (تحويل عملة)
  | 'abdallah_withdrawal'        // سحب نقدي - عبدالله
  | 'partner_withdrawal'         // سحب نقدي - الشريك
  | 'special_expense'            // مصروف خاص (غير تشغيلي)
  | 'other_withdrawal'           // سحب نقدي آخر
  | 'other_deposit';             // إيداع نقدي آخر

export interface CashTransaction {
  id: string;
  type: 'in' | 'out'; // داخل أم خارج من الصندوق
  category: CashTransactionCategory;
  title: string;
  amount: number;
  currency: Currency;
  date: string; // ISO string
  person?: string; // عبدالله، الشريك، السائق، إلخ
  notes?: string;
  relatedEntityId?: string; // ربط مع فاتورة بيع/شراء أو سند قبض/دفع أو عملية شراء دولار
  exchangeRate?: number; // سعر الصرف في حال كانت العملية تحويل عملة
  createdAt: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'profits'             // قسم مستقل خاص بالأرباح
  | 'inventory_audit'     // الجرد اليومي الشامل
  | 'audits'              // جرد العملاء والموردين وأثر سعر الصرف
  | 'usd_exchange'        // قسم شراء الدولار
  | 'partners'            // الشركاء ورأس المال والحسابات الجارية
  | 'cashbox'
  | 'sales'
  | 'purchases'
  | 'customers'
  | 'products'
  | 'suppliers'
  | 'expenses';

export interface InventoryItemBreakdown {
  id: string;
  name: string;
  unit: string;
  piecesPerCarton: number;
  totalPieces: number;
  cartons: number;
  loosePieces: number;
  costCurrency: Currency;
  unitCost: number; // cost per carton
  pieceCost: number; // cost per piece
  totalCostOriginal: number; // total in original currency
  equivalentUSD: number; // converted to USD at audit rate
  equivalentSYP: number; // converted to SYP at audit rate
}

export interface ProjectReconciliation {
  totalAssetsUSD: number;
  totalLiabilitiesUSD: number;
  actualNetWorthUSD: number; // الأصول - الالتزامات
  initialCapitalUSD: number; // رأس مال الشريك الفعلي المسجل (المضاف - المسترد)
  operatingProfitUSD: number; // أرباح المبيعات - المصاريف
  partnerTotalWithdrawnUSD: number;
  abdallahTotalWithdrawnUSD: number;
  totalWithdrawalsUSD: number; // مسحوبات الشركاء مجتمعة
  expectedEquityUSD: number; // رأس المال + الأرباح - المسحوبات
  unexplainedDifferenceUSD: number; // الفرق غير المفسر (إن وجد)
  isBalanced: boolean;
}

export interface DailyInventoryAudit {
  timestamp: string;
  asOfDate: string;
  exchangeRate: number;
  // Cash
  cashSYP: number;
  cashUSD: number;
  cashTotalInUSD: number;
  // Customers
  customerDebtSYP: number;
  customerDebtUSD: number;
  customerDebtsInUSD: number;
  customerDebtsList: Array<{
    id: string;
    name: string;
    shopName?: string;
    syp: number;
    usd: number;
    totalInUSD: number;
  }>;
  // Suppliers
  supplierDebtSYP: number;
  supplierDebtUSD: number;
  supplierDebtsInUSD: number;
  supplierDebtsList: Array<{
    id: string;
    name: string;
    company?: string;
    syp: number;
    usd: number;
    totalInUSD: number;
  }>;
  // Inventory (Independent SYP & USD classifications)
  inventoryCostUSD: number; // items costed in USD
  inventoryCostSYP: number; // items costed in SYP
  totalInventoryInUSD: number; // combined at audit exchange rate
  totalInventoryInSYP: number; // combined at audit exchange rate
  totalProductsCount: number;
  totalPiecesCount: number;
  inventorySYPItems: InventoryItemBreakdown[];
  inventoryUSDItems: InventoryItemBreakdown[];
  // Partners
  partnerSummary: {
    partnerName: string;
    totalCapitalUSD: number;
    originalCapitalUSD?: number;
    totalRepaidCapitalUSD?: number;
    remainingCapitalUSD?: number;
    partnerCashSYP: number;
    partnerCashUSD: number;
    partnerGoodsSYP: number;
    partnerGoodsUSD: number;
    partnerTotalWithdrawnUSD: number;
    abdallahCashSYP: number;
    abdallahCashUSD: number;
    abdallahGoodsSYP: number;
    abdallahGoodsUSD: number;
    abdallahTotalWithdrawnUSD: number;
  };
  // Final Project Balance & Matching
  totalAssetsUSD: number;
  totalLiabilitiesUSD: number;
  netProjectWorthUSD: number;
  netProjectWorthSYP: number;
  initialCapitalUSD: number;
  totalWithdrawalsUSD: number;
  netProfitOrLossUSD: number;
  // Strict Project Reconciliation
  reconciliation: ProjectReconciliation;
}


