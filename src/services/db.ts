import {
  AppSettings,
  Currency,
  Product,
  Customer,
  Invoice,
  PurchaseInvoice,
  CustomerPayment,
  Supplier,
  SupplierTransaction,
  Expense,
  CashTransaction,
  UsdPurchase,
  GoodsWithdrawal,
  PartnerCapital,
  PartnerCapitalRepayment,
  PartnerCapitalTransaction,
  InventoryBatch,
  DailyInventoryAudit,
  InventoryItemBreakdown,
  ProjectReconciliation,
} from '../types';
import {
  computePurchaseSettlement,
  customerAuditRow,
  supplierAuditRow,
  supplierStatement,
  buildFxEffectReport,
  fifoFxBasis,
  valueSypPosition,
  rateAt,
  fnv1a,
  round2,
  type RateRecord,
  type PartyAuditRow,
  type FxEffectReport,
  type SupplierStatementRow,
} from './accounting';
import { storeGet, storeSet, flushStorage } from './sqliteStore';
import {
  initialSettings,
  initialProducts,
  initialCustomers,
  initialSuppliers,
  initialExpenses,
  initialInvoices,
  initialPurchaseInvoices,
  initialCustomerPayments,
  initialSupplierTransactions,
} from './seedData';

const STORAGE_KEYS = {
  SETTINGS: 'al_ataya_settings_v1',
  PRODUCTS: 'al_ataya_products_v1',
  CUSTOMERS: 'al_ataya_customers_v1',
  INVOICES: 'al_ataya_invoices_v1',
  PURCHASE_INVOICES: 'al_ataya_purchase_invoices_v1',
  INVENTORY_BATCHES: 'al_ataya_inventory_batches_v1',
  CUSTOMER_PAYMENTS: 'al_ataya_customer_payments_v1',
  SUPPLIERS: 'al_ataya_suppliers_v1',
  SUPPLIER_TXS: 'al_ataya_supplier_txs_v1',
  EXPENSES: 'al_ataya_expenses_v1',
  CASH_TRANSACTIONS: 'al_ataya_cash_txs_v1',
  USD_PURCHASES: 'al_ataya_usd_purchases_v1',
  GOODS_WITHDRAWALS: 'al_ataya_goods_withdrawals_v1',
  PARTNER_CAPITAL_TRANSACTIONS: 'al_ataya_partner_capital_txs_v2',
  EXCHANGE_RATES: 'al_ataya_exchange_rates_v1',
  PARTNER_CAPITAL: 'al_ataya_partner_capital_v1',
  PARTNER_CAPITAL_REPAYMENTS: 'al_ataya_partner_capital_repayments_v1',
  DAILY_AUDITS: 'al_ataya_daily_audits_v1',
  AUTO_BACKUP_LATEST: 'al_ataya_auto_backup_latest',
  AUTO_BACKUP_PREVIOUS: 'al_ataya_auto_backup_previous',
  AUTO_BACKUP_SAFETY: 'al_ataya_safety_pre_restore_backup',
};

// التخزين: SQLite على أندرويد (عبر sqliteStore) مع كاش متزامن؛ localStorage بديل للمتصفح فقط.
function loadItem<T>(key: string, fallback: T): T {
  const v = storeGet<T | undefined>(key, undefined);
  if (v !== undefined && v !== null) return v as T;
  // نسخة مستقلة من القيمة الافتراضية كي لا يُعدَّل الثابت المشترك بالخطأ
  return fallback !== null && typeof fallback === 'object' ? (JSON.parse(JSON.stringify(fallback)) as T) : fallback;
}

function saveItem<T>(key: string, data: T): void {
  storeSet<T>(key, data);
}

export class LocalDatabase {
  // Settings
  static getSettings(): AppSettings {
    return loadItem<AppSettings>(STORAGE_KEYS.SETTINGS, initialSettings);
  }

  static saveSettings(settings: AppSettings): void {
    const prev = loadItem<AppSettings | null>(STORAGE_KEYS.SETTINGS, null);
    saveItem(STORAGE_KEYS.SETTINGS, settings);
    // سجل تاريخي لأسعار الصرف: لا يُعدَّل أبداً، تُضاف صفوف جديدة فقط
    if (settings.exchangeRate && (!prev || prev.exchangeRate !== settings.exchangeRate)) {
      this.recordExchangeRate(settings.exchangeRate, prev ? 'settings_change' : 'initial');
    }
  }

  // ================= Exchange Rate History (immutable log) =================
  static getExchangeRateHistory(): RateRecord[] {
    return loadItem<RateRecord[]>(STORAGE_KEYS.EXCHANGE_RATES, []);
  }

  static recordExchangeRate(rate: number, source = 'manual'): void {
    const hist = this.getExchangeRateHistory();
    const last = [...hist].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt)).pop();
    if (last && last.exchangeRate === rate) return;
    const rec: RateRecord = {
      id: 'fx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      exchangeRate: rate,
      effectiveAt: new Date().toISOString(),
      source,
    };
    saveItem(STORAGE_KEYS.EXCHANGE_RATES, [...hist, rec]);
  }

  // Products
  static getProducts(): Product[] {
    return loadItem<Product[]>(STORAGE_KEYS.PRODUCTS, initialProducts);
  }

  static saveProducts(products: Product[]): void {
    saveItem(STORAGE_KEYS.PRODUCTS, products);
  }

  static addProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
    const products = this.getProducts();
    const newProduct: Product = {
      ...product,
      id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    products.unshift(newProduct);
    this.saveProducts(products);
    return newProduct;
  }

  static updateProduct(product: Product): void {
    const products = this.getProducts();
    const index = products.findIndex((p) => p.id === product.id);
    if (index !== -1) {
      products[index] = { ...product, updatedAt: new Date().toISOString() };
      this.saveProducts(products);
    }
  }

  static deleteProduct(productId: string): void {
    const products = this.getProducts().filter((p) => p.id !== productId);
    this.saveProducts(products);
  }

  // Adjust product stock directly (e.g. manual inventory correction or receiving shipment)
  static updateProductStock(productId: string, newTotalPieces: number): void {
    const products = this.getProducts();
    const product = products.find((p) => p.id === productId);
    if (product) {
      product.totalPiecesInStock = Math.max(0, newTotalPieces);
      product.updatedAt = new Date().toISOString();
      this.saveProducts(products);
    }
  }

  // Invoices
  static getInvoices(): Invoice[] {
    return loadItem<Invoice[]>(STORAGE_KEYS.INVOICES, initialInvoices);
  }

  static saveInvoices(invoices: Invoice[]): void {
    saveItem(STORAGE_KEYS.INVOICES, invoices);
  }

  // Create invoice and automatically deduct stock with batch costing
  static createInvoice(invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Invoice {
    const invoices = this.getInvoices();
    const products = this.getProducts();
    const settings = this.getSettings();
    const rate = invoiceData.fixedExchangeRate || invoiceData.exchangeRate || settings.exchangeRate || 15000;
    const batches = this.getInventoryBatches();

    // Deduct stock for each item in the invoice & allocate from inventory batches (FIFO)
    const enrichedItems = invoiceData.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        product.totalPiecesInStock = Math.max(0, product.totalPiecesInStock - item.totalPieces);
        product.updatedAt = new Date().toISOString();
      }

      // FIFO حقيقي: كل جزء يُسعَّر بتكلفة الدفعة التي خرج منها فعلاً (بعملتها الأصلية)
      let piecesToAllocate = item.totalPieces;
      const ppc = item.piecesPerCarton || 1;
      const costBreakdown: Array<{
        batchId: string;
        pieces: number;
        unitCost: number;
        currency: Currency;
        batchExchangeRate: number;
      }> = [];
      let costUSDPart = 0; // التكلفة الأصلية بالدولار
      let costSYPPart = 0; // التكلفة الأصلية بالليرة
      const sorted = batches
        .filter((b) => b.productId === item.productId && b.remainingPieces > 0)
        .sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
      for (const b of sorted) {
        if (piecesToAllocate <= 0) break;
        const used = Math.min(piecesToAllocate, b.remainingPieces);
        b.remainingPieces -= used;
        piecesToAllocate -= used;
        const partCost = (used / ppc) * b.unitCost;
        if (b.currency === 'USD') costUSDPart += partCost;
        else costSYPPart += partCost;
        costBreakdown.push({
          batchId: b.id,
          pieces: used,
          unitCost: b.unitCost,
          currency: b.currency,
          batchExchangeRate: b.exchangeRate,
        });
      }
      // ما لم تغطّه الدفعات (بيع بدون رصيد دفعات) يُسعَّر بآخر تكلفة معروفة للمنتج
      if (piecesToAllocate > 0 && product) {
        const partCost = (piecesToAllocate / ppc) * (product.purchaseCost || 0);
        if (product.costCurrency === 'USD') costUSDPart += partCost;
        else costSYPPart += partCost;
        costBreakdown.push({
          batchId: 'product_last_cost',
          pieces: piecesToAllocate,
          unitCost: product.purchaseCost || 0,
          currency: product.costCurrency || 'SYP',
          batchExchangeRate: rate,
        });
      }

      // التكلفة بعملة الفاتورة (سعر الصرف وقت البيع فقط لتحويل عملة التكلفة إلى عملة الفاتورة)
      const invCur: Currency = invoiceData.currency;
      const totalCostAtSale =
        invCur === 'USD' ? costUSDPart + costSYPPart / rate : costSYPPart + costUSDPart * rate;
      const matchedCost = item.totalPieces > 0 ? (totalCostAtSale / (item.totalPieces / ppc)) : 0;
      const matchedCurrency: Currency = invCur;
      const profitAtSale = item.itemTotal - totalCostAtSale;

      return {
        ...item,
        costPriceAtSale: item.costPriceAtSale || matchedCost,
        costCurrencyAtSale: item.costCurrencyAtSale || matchedCurrency,
        totalCostAtSale: item.totalCostAtSale !== undefined ? item.totalCostAtSale : totalCostAtSale,
        profitAtSale: item.profitAtSale !== undefined ? item.profitAtSale : profitAtSale,
        costUSDOriginal: round2(costUSDPart),
        costSYPOriginal: Math.round(costSYPPart),
        costBreakdown,
      };
    });

    this.saveProducts(products);
    this.saveInventoryBatches(batches);

    const newInvoice: Invoice = {
      ...invoiceData,
      id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      exchangeRate: rate,
      items: enrichedItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    invoices.unshift(newInvoice);
    this.saveInvoices(invoices);
    return newInvoice;
  }

  // Edit invoice: restore previous items stock, deduct new items stock, update invoice
  static updateInvoice(updatedInvoice: Invoice): void {
    const invoices = this.getInvoices();
    const existingIndex = invoices.findIndex((i) => i.id === updatedInvoice.id);
    if (existingIndex === -1) return;

    const oldInvoice = invoices[existingIndex];
    const products = this.getProducts();

    // 1. Revert previous stock deduction
    for (const oldItem of oldInvoice.items) {
      const product = products.find((p) => p.id === oldItem.productId);
      if (product) {
        product.totalPiecesInStock += oldItem.totalPieces;
      }
    }

    // 2. Apply new stock deduction
    for (const newItem of updatedInvoice.items) {
      const product = products.find((p) => p.id === newItem.productId);
      if (product) {
        product.totalPiecesInStock = Math.max(0, product.totalPiecesInStock - newItem.totalPieces);
        product.updatedAt = new Date().toISOString();
      }
    }
    this.saveProducts(products);

    invoices[existingIndex] = {
      ...updatedInvoice,
      // سعر الصرف وقت البيع ثابت للأبد: نحتفظ بالسعر الأصلي حتى عند التعديل
      exchangeRate: oldInvoice.exchangeRate || updatedInvoice.exchangeRate || this.getSettings().exchangeRate || 15000,
      updatedAt: new Date().toISOString(),
    };
    this.saveInvoices(invoices);
  }

  // Delete invoice: restore inventory back to stock and remove invoice
  static deleteInvoice(invoiceId: string): void {
    const invoices = this.getInvoices();
    const targetInvoice = invoices.find((i) => i.id === invoiceId);
    if (!targetInvoice) return;

    // Restore stock
    const products = this.getProducts();
    for (const item of targetInvoice.items) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        product.totalPiecesInStock += item.totalPieces;
        product.updatedAt = new Date().toISOString();
      }
    }
    this.saveProducts(products);

    const filtered = invoices.filter((i) => i.id !== invoiceId);
    this.saveInvoices(filtered);
  }

  // ================= Inventory Batches (FIFO / Batch Costing) =================
  static getInventoryBatches(): InventoryBatch[] {
    return loadItem<InventoryBatch[]>(STORAGE_KEYS.INVENTORY_BATCHES, []);
  }

  static saveInventoryBatches(batches: InventoryBatch[]): void {
    saveItem(STORAGE_KEYS.INVENTORY_BATCHES, batches);
  }

  // ================= Purchase Invoices (فواتير المشتريات) =================
  static getPurchaseInvoices(): PurchaseInvoice[] {
    return loadItem<PurchaseInvoice[]>(STORAGE_KEYS.PURCHASE_INVOICES, initialPurchaseInvoices);
  }

  static savePurchaseInvoices(invoices: PurchaseInvoice[]): void {
    saveItem(STORAGE_KEYS.PURCHASE_INVOICES, invoices);
  }

  static createPurchaseInvoice(
    invoiceData: Omit<PurchaseInvoice, 'id' | 'createdAt' | 'updatedAt'>
  ): PurchaseInvoice {
    const invoices = this.getPurchaseInvoices();
    const products = this.getProducts();

    const newInvoice: PurchaseInvoice = {
      ...invoiceData,
      id: 'pur_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Automatically increase inventory stock for each purchased item
    // 2. Update product purchaseCost and costCurrency based on this latest purchase
    const batches = this.getInventoryBatches();
    for (const item of newInvoice.items) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        product.totalPiecesInStock += item.totalPieces;
        // Update purchase cost according to this latest purchase
        if (item.costPerCarton > 0) {
          product.purchaseCost = item.costPerCarton;
          product.costCurrency = item.currency || (newInvoice.currency === 'MIXED' ? 'USD' : newInvoice.currency);
        }
        product.updatedAt = new Date().toISOString();
      }

      // Record batch for FIFO costing
      batches.push({
        id: 'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        productId: item.productId,
        productName: item.productName,
        supplierId: newInvoice.supplierId,
        supplierName: newInvoice.supplierName,
        purchaseInvoiceId: newInvoice.id,
        date: newInvoice.date,
        quantityTotalPieces: item.totalPieces,
        remainingPieces: item.totalPieces,
        unitCost: item.costPerCarton,
        currency: item.currency || (newInvoice.currency === 'MIXED' ? 'USD' : newInvoice.currency),
        exchangeRate: item.exchangeRate || newInvoice.invoiceExchangeRate || this.getSettings().exchangeRate || 15000,
        createdAt: new Date().toISOString(),
      });
    }
    this.saveInventoryBatches(batches);
    this.saveProducts(products);

    invoices.unshift(newInvoice);
    this.savePurchaseInvoices(invoices);
    return newInvoice;
  }

  static updatePurchaseInvoice(updatedInvoice: PurchaseInvoice): void {
    const invoices = this.getPurchaseInvoices();
    const oldIndex = invoices.findIndex((i) => i.id === updatedInvoice.id);
    if (oldIndex === -1) return;

    const oldInvoice = invoices[oldIndex];
    const products = this.getProducts();

    // 1. Revert previous stock quantities added by old invoice
    for (const oldItem of oldInvoice.items) {
      const product = products.find((p) => p.id === oldItem.productId);
      if (product) {
        product.totalPiecesInStock = Math.max(0, product.totalPiecesInStock - oldItem.totalPieces);
      }
    }

    // 2. Apply new stock quantities & update product cost to current values
    for (const newItem of updatedInvoice.items) {
      const product = products.find((p) => p.id === newItem.productId);
      if (product) {
        product.totalPiecesInStock += newItem.totalPieces;
        if (newItem.costPerCarton > 0) {
          product.purchaseCost = newItem.costPerCarton;
          product.costCurrency = newItem.currency || (updatedInvoice.currency === 'MIXED' ? 'USD' : updatedInvoice.currency);
        }
        product.updatedAt = new Date().toISOString();
      }
    }
    this.saveProducts(products);

    invoices[oldIndex] = {
      ...updatedInvoice,
      updatedAt: new Date().toISOString(),
    };
    this.savePurchaseInvoices(invoices);
  }

  static deletePurchaseInvoice(invoiceId: string): void {
    const invoices = this.getPurchaseInvoices();
    const target = invoices.find((i) => i.id === invoiceId);
    if (!target) return;

    const products = this.getProducts();

    // 1. Revert stock additions
    for (const item of target.items) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        product.totalPiecesInStock = Math.max(0, product.totalPiecesInStock - item.totalPieces);
        product.updatedAt = new Date().toISOString();
      }
    }

    // 2. Filter out invoice
    const remainingInvoices = invoices.filter((i) => i.id !== invoiceId);

    // 3. For any product affected, check if there is an earlier purchase invoice to restore its previous cost
    for (const item of target.items) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        // Find most recent purchase invoice for this product
        for (const pastInv of remainingInvoices) {
          const pastItem = pastInv.items.find((it) => it.productId === item.productId);
          if (pastItem && pastItem.costPerCarton > 0) {
            product.purchaseCost = pastItem.costPerCarton;
            product.costCurrency = pastItem.currency || (pastInv.currency === 'MIXED' ? 'USD' : pastInv.currency);
            break;
          }
        }
      }
    }

    this.saveProducts(products);
    this.savePurchaseInvoices(remainingInvoices);
  }

  // Customers
  static getCustomers(): Customer[] {
    return loadItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  }

  static saveCustomers(customers: Customer[]): void {
    saveItem(STORAGE_KEYS.CUSTOMERS, customers);
  }

  static addCustomer(customer: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const customers = this.getCustomers();
    const newCustomer: Customer = {
      ...customer,
      id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    customers.push(newCustomer);
    this.saveCustomers(customers);
    return newCustomer;
  }

  static updateCustomer(customer: Customer): void {
    const customers = this.getCustomers();
    const index = customers.findIndex((c) => c.id === customer.id);
    if (index !== -1) {
      customers[index] = customer;
      this.saveCustomers(customers);
    }
  }

  static deleteCustomer(customerId: string): void {
    const customers = this.getCustomers().filter((c) => c.id !== customerId);
    this.saveCustomers(customers);
  }

  // Customer balance calculation:
  // Dual-currency balance: returns { syp: number, usd: number }
  static getCustomerDualBalance(customerId: string): { syp: number; usd: number } {
    const customers = this.getCustomers();
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return { syp: 0, usd: 0 };

    let syp = customer.currency === 'USD' ? 0 : (customer.initialDebt || 0);
    let usd = customer.currency === 'USD' ? (customer.initialDebt || 0) : (customer.initialDebtUSD || 0);

    const invoices = this.getInvoices().filter((inv) => inv.customerId === customerId);
    const payments = this.getCustomerPayments().filter((p) => p.customerId === customerId);

    for (const inv of invoices) {
      if (inv.isFixedUSD && inv.fixedUSDAmount) {
        // If fixed in USD, the unpaid portion remains as USD debt
        const paidUSD = inv.paidAmount > 0 ? (inv.paidAmount / (inv.fixedExchangeRate || 1)) : 0;
        const remainingUSD = Math.max(0, inv.fixedUSDAmount - paidUSD);
        usd += remainingUSD;
      } else if (inv.currency === 'USD') {
        const remaining = Math.max(0, (inv.finalTotal || 0) - (inv.paidAmount || 0));
        usd += remaining;
      } else {
        const remaining = Math.max(0, (inv.finalTotal || 0) - (inv.paidAmount || 0));
        syp += remaining;
      }
    }

    for (const p of payments) {
      if (p.currency === 'USD') {
        usd -= (p.amount || 0);
      } else {
        syp -= (p.amount || 0);
      }
    }

    return { syp, usd };
  }

  // Legacy single customer balance for backward compatibility (in customer's primary currency or SYP)
  static getCustomerBalance(customerId: string): number {
    const dual = this.getCustomerDualBalance(customerId);
    const settings = this.getSettings();
    const rate = settings.exchangeRate || 15000;
    // Returns total value in SYP
    return dual.syp + (dual.usd * rate);
  }

  // Customer Payments
  static getCustomerPayments(): CustomerPayment[] {
    return loadItem<CustomerPayment[]>(STORAGE_KEYS.CUSTOMER_PAYMENTS, initialCustomerPayments);
  }

  static saveCustomerPayments(payments: CustomerPayment[]): void {
    saveItem(STORAGE_KEYS.CUSTOMER_PAYMENTS, payments);
  }

  static addCustomerPayment(payment: Omit<CustomerPayment, 'id' | 'createdAt'>): CustomerPayment {
    const payments = this.getCustomerPayments();
    const newPayment: CustomerPayment = {
      ...payment,
      exchangeRate: payment.exchangeRate || this.getSettings().exchangeRate || undefined,
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    payments.unshift(newPayment);
    this.saveCustomerPayments(payments);
    return newPayment;
  }

  static updateCustomerPayment(payment: CustomerPayment): void {
    const payments = this.getCustomerPayments();
    const index = payments.findIndex((p) => p.id === payment.id);
    if (index !== -1) {
      payments[index] = payment;
      this.saveCustomerPayments(payments);
    }
  }

  static deleteCustomerPayment(paymentId: string): void {
    const payments = this.getCustomerPayments().filter((p) => p.id !== paymentId);
    this.saveCustomerPayments(payments);
  }

  // Suppliers
  static getSuppliers(): Supplier[] {
    return loadItem<Supplier[]>(STORAGE_KEYS.SUPPLIERS, initialSuppliers);
  }

  static saveSuppliers(suppliers: Supplier[]): void {
    saveItem(STORAGE_KEYS.SUPPLIERS, suppliers);
  }

  static addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt'>): Supplier {
    const suppliers = this.getSuppliers();
    const newSupplier: Supplier = {
      ...supplier,
      id: 'supp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    suppliers.push(newSupplier);
    this.saveSuppliers(suppliers);
    return newSupplier;
  }

  static updateSupplier(supplier: Supplier): void {
    const suppliers = this.getSuppliers();
    const index = suppliers.findIndex((s) => s.id === supplier.id);
    if (index !== -1) {
      suppliers[index] = supplier;
      this.saveSuppliers(suppliers);
    }
  }

  static deleteSupplier(supplierId: string): void {
    const suppliers = this.getSuppliers().filter((s) => s.id !== supplierId);
    this.saveSuppliers(suppliers);
  }

  // Supplier balance: Initial Debt + Purchase Invoices Total - Purchase Invoices Cash Paid + Manual Purchases - Manual Payments
  /**
   * توافقية مع الشاشات القديمة: رصيد المورد الرئيسي دائماً بالدولار (مصدر واحد: كشف الحساب التاريخي).
   * الحركات الأصلية بالليرة/الدولار متوفرة عبر getSupplierStatement.
   */
  static getSupplierDualBalance(supplierId: string): { syp: number; usd: number } {
    return { syp: 0, usd: this.getSupplierBalanceUSD(supplierId) };
  }

  /** رصيد المورد الرئيسي بالدولار (موجب = نحن مدينون للمورد ، سالب = رصيد دائن لنا). */
  static getSupplierBalance(supplierId: string): number {
    return this.getSupplierBalanceUSD(supplierId);
  }

  static getSupplierBalanceUSD(supplierId: string): number {
    return this.getSupplierStatement(supplierId).balanceUSD;
  }

  /** كشف حساب المورد (بأسعار الصرف التاريخية) مع فلتر تاريخ اختياري للعرض. الرصيد بعد الحركة يُحسب دائماً من البداية. */
  static getSupplierStatement(supplierId: string, from?: string, to?: string): {
    rows: SupplierStatementRow[];
    balanceUSD: number;
    openingBalanceUSD: number;
  } {
    const supplier = this.getSuppliers().find((s) => s.id === supplierId);
    if (!supplier) return { rows: [], balanceUSD: 0, openingBalanceUSD: 0 };
    const st = supplierStatement(
      supplier,
      this.getPurchaseInvoices() as any,
      this.getSupplierTransactions() as any,
      this.getSettings().exchangeRate || 1,
      this.getExchangeRateHistory()
    );
    let rows = st.rows;
    let opening = 0;
    if (from) {
      const before = rows.filter((r) => r.date.slice(0, 10) < from);
      opening = before.length ? before[before.length - 1].balanceAfterUSD : 0;
      rows = rows.filter((r) => r.date.slice(0, 10) >= from);
    }
    if (to) rows = rows.filter((r) => r.date.slice(0, 10) <= to);
    return { rows, balanceUSD: st.balanceUSD, openingBalanceUSD: opening };
  }

  /** حساب تسوية الفاتورة (يستعمله نموذج الشراء والاختبارات). */
  static computePurchaseSettlement = computePurchaseSettlement;

  // Supplier Transactions
  static getSupplierTransactions(): SupplierTransaction[] {
    return loadItem<SupplierTransaction[]>(STORAGE_KEYS.SUPPLIER_TXS, initialSupplierTransactions);
  }

  static saveSupplierTransactions(txs: SupplierTransaction[]): void {
    saveItem(STORAGE_KEYS.SUPPLIER_TXS, txs);
  }

  static addSupplierTransaction(
    tx: Omit<SupplierTransaction, 'id' | 'createdAt'>
  ): SupplierTransaction {
    const txs = this.getSupplierTransactions();
    const stampRate = tx.exchangeRate || this.getSettings().exchangeRate || 1;
    const newTx: SupplierTransaction = {
      ...tx,
      exchangeRate: stampRate,
      amountUSD: tx.amountUSD !== undefined ? tx.amountUSD : tx.currency === 'USD' ? tx.amount : round2(tx.amount / stampRate),
      amountSYP: tx.amountSYP !== undefined ? tx.amountSYP : tx.currency === 'SYP' ? tx.amount : Math.round(tx.amount * stampRate),
      id: 'st_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    txs.unshift(newTx);
    this.saveSupplierTransactions(txs);
    return newTx;
  }

  static deleteSupplierTransaction(txId: string): void {
    const txs = this.getSupplierTransactions().filter((t) => t.id !== txId);
    this.saveSupplierTransactions(txs);
  }

  // Expenses
  static getExpenses(): Expense[] {
    const list = loadItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
    let changed = false;
    const sanitized = list.map((e) => {
      if (e.person === 'أحمد' || e.person === 'محمد' || e.person === 'احمد') {
        changed = true;
        return { ...e, person: 'عبدالله' };
      }
      return e;
    });
    if (changed) {
      this.saveExpenses(sanitized);
    }
    return sanitized;
  }

  static saveExpenses(expenses: Expense[]): void {
    saveItem(STORAGE_KEYS.EXPENSES, expenses);
  }

  static addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Expense {
    const expenses = this.getExpenses();
    const newExpense: Expense = {
      ...expense,
      exchangeRate: expense.exchangeRate || this.getSettings().exchangeRate || undefined,
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    expenses.unshift(newExpense);
    this.saveExpenses(expenses);
    return newExpense;
  }

  static deleteExpense(expenseId: string): void {
    const expenses = this.getExpenses().filter((e) => e.id !== expenseId);
    this.saveExpenses(expenses);
  }

  // Cash Transactions (Deposits, Abdallah/Partner Withdrawals, Special Expenses)
  static getCashTransactions(): CashTransaction[] {
    return loadItem<CashTransaction[]>(STORAGE_KEYS.CASH_TRANSACTIONS, []);
  }

  static saveCashTransactions(txs: CashTransaction[]): void {
    saveItem(STORAGE_KEYS.CASH_TRANSACTIONS, txs);
  }

  static addCashTransaction(
    tx: Omit<CashTransaction, 'id' | 'createdAt'>
  ): CashTransaction {
    const txs = this.getCashTransactions();
    const newTx: CashTransaction = {
      ...tx,
      id: 'cash_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    txs.unshift(newTx);
    this.saveCashTransactions(txs);
    return newTx;
  }

  static deleteCashTransaction(txId: string): void {
    const txs = this.getCashTransactions();
    const target = txs.find((t) => t.id === txId);
    if (target?.relatedEntityId && target.category === 'usd_purchase') {
      this.deleteUsdPurchase(target.relatedEntityId);
      return;
    }
    const filtered = txs.filter((t) => t.id !== txId);
    this.saveCashTransactions(filtered);
  }

  // USD Purchases (Buying USD with SYP from Cash Box)
  static getUsdPurchases(): UsdPurchase[] {
    return loadItem<UsdPurchase[]>(STORAGE_KEYS.USD_PURCHASES, []);
  }

  static saveUsdPurchases(purchases: UsdPurchase[]): void {
    saveItem(STORAGE_KEYS.USD_PURCHASES, purchases);
  }

  static addUsdPurchase(purchaseData: Omit<UsdPurchase, 'id' | 'createdAt'>): UsdPurchase {
    const purchases = this.getUsdPurchases();
    const newPurchase: UsdPurchase = {
      ...purchaseData,
      id: 'usdp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    purchases.unshift(newPurchase);
    this.saveUsdPurchases(purchases);

    // Also automatically create the two mirrored cash transactions:
    // 1. SYP out (deduct costSYP)
    this.addCashTransaction({
      type: 'out',
      category: 'usd_purchase',
      title: `شراء دولار (${newPurchase.amountUSD.toLocaleString()} $ بسعر ${newPurchase.exchangeRate.toLocaleString()} ل.س)`,
      amount: newPurchase.costSYP,
      currency: 'SYP',
      date: newPurchase.date,
      person: 'عبدالله',
      notes: newPurchase.notes,
      relatedEntityId: newPurchase.id,
      exchangeRate: newPurchase.exchangeRate,
    });

    // 2. USD in (add amountUSD)
    this.addCashTransaction({
      type: 'in',
      category: 'usd_purchase',
      title: `إيداع دولار مشترى (${newPurchase.amountUSD.toLocaleString()} $)`,
      amount: newPurchase.amountUSD,
      currency: 'USD',
      date: newPurchase.date,
      person: 'عبدالله',
      notes: newPurchase.notes,
      relatedEntityId: newPurchase.id,
      exchangeRate: newPurchase.exchangeRate,
    });

    return newPurchase;
  }

  static updateUsdPurchase(updatedPurchase: UsdPurchase): void {
    // Delete existing mirrored cash transactions
    const cashTxs = this.getCashTransactions().filter((ctx) => ctx.relatedEntityId !== updatedPurchase.id);
    this.saveCashTransactions(cashTxs);

    // Update the purchase in list
    const purchases = this.getUsdPurchases().map((p) => (p.id === updatedPurchase.id ? updatedPurchase : p));
    this.saveUsdPurchases(purchases);

    // Re-create the two mirrored cash transactions
    this.addCashTransaction({
      type: 'out',
      category: 'usd_purchase',
      title: `شراء دولار (${updatedPurchase.amountUSD.toLocaleString()} $ بسعر ${updatedPurchase.exchangeRate.toLocaleString()} ل.س)`,
      amount: updatedPurchase.costSYP,
      currency: 'SYP',
      date: updatedPurchase.date,
      person: 'عبدالله',
      notes: updatedPurchase.notes,
      relatedEntityId: updatedPurchase.id,
      exchangeRate: updatedPurchase.exchangeRate,
    });

    this.addCashTransaction({
      type: 'in',
      category: 'usd_purchase',
      title: `إيداع دولار مشترى (${updatedPurchase.amountUSD.toLocaleString()} $)`,
      amount: updatedPurchase.amountUSD,
      currency: 'USD',
      date: updatedPurchase.date,
      person: 'عبدالله',
      notes: updatedPurchase.notes,
      relatedEntityId: updatedPurchase.id,
      exchangeRate: updatedPurchase.exchangeRate,
    });
  }

  static deleteUsdPurchase(id: string): void {
    const purchases = this.getUsdPurchases().filter((p) => p.id !== id);
    this.saveUsdPurchases(purchases);

    // Clean up mirrored cash transactions (reverts SYP and deducts USD)
    const cashTxs = this.getCashTransactions().filter((ctx) => ctx.relatedEntityId !== id);
    this.saveCashTransactions(cashTxs);
  }

  // Goods Withdrawals (Abdallah & Partner withdrawing products at cost)
  static getGoodsWithdrawals(): GoodsWithdrawal[] {
    return loadItem<GoodsWithdrawal[]>(STORAGE_KEYS.GOODS_WITHDRAWALS, []);
  }

  static saveGoodsWithdrawals(withdrawals: GoodsWithdrawal[]): void {
    saveItem(STORAGE_KEYS.GOODS_WITHDRAWALS, withdrawals);
  }

  static addGoodsWithdrawal(data: Omit<GoodsWithdrawal, 'id' | 'createdAt'>): GoodsWithdrawal {
    const withdrawals = this.getGoodsWithdrawals();
    const newWithdrawal: GoodsWithdrawal = {
      ...data,
      exchangeRate: data.exchangeRate || this.getSettings().exchangeRate || undefined,
      id: 'gw_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };

    // Deduct stock from inventory
    const products = this.getProducts();
    const product = products.find((p) => p.id === data.productId);
    if (product) {
      product.totalPiecesInStock = Math.max(0, product.totalPiecesInStock - data.totalPieces);
      product.updatedAt = new Date().toISOString();
      this.saveProducts(products);
    }

    withdrawals.unshift(newWithdrawal);
    this.saveGoodsWithdrawals(withdrawals);
    return newWithdrawal;
  }

  static deleteGoodsWithdrawal(id: string): void {
    const withdrawals = this.getGoodsWithdrawals();
    const target = withdrawals.find((w) => w.id === id);
    if (target) {
      // Revert stock
      const products = this.getProducts();
      const product = products.find((p) => p.id === target.productId);
      if (product) {
        product.totalPiecesInStock += target.totalPieces;
        product.updatedAt = new Date().toISOString();
        this.saveProducts(products);
      }
    }
    this.saveGoodsWithdrawals(withdrawals.filter((w) => w.id !== id));
  }

  // ================= Partner Capital Transactions (حركات رأس مال الشريك) =================
  static getPartnerCapitalTransactions(): PartnerCapitalTransaction[] {
    const txs = loadItem<PartnerCapitalTransaction[]>(STORAGE_KEYS.PARTNER_CAPITAL_TRANSACTIONS, []);
    if (txs.length > 0) {
      return txs;
    }

    // Migration from v1 if exists (لا توجد أي قيمة افتراضية لرأس المال)
    const oldCapitals = loadItem<any[]>(STORAGE_KEYS.PARTNER_CAPITAL, []).filter(
      (c) => c && (c.amountUSD > 0 || c.amount > 0)
    );
    const oldRepayments = loadItem<any[]>(STORAGE_KEYS.PARTNER_CAPITAL_REPAYMENTS, []);

    if (oldCapitals.length > 0 || oldRepayments.length > 0) {
      const migrated: PartnerCapitalTransaction[] = [];

      for (const cap of oldCapitals) {
        const amt = cap.amountUSD || cap.amount || 0;
        migrated.push({
          id: cap.id || ('cap_mig_' + Math.random().toString(36).substring(2, 7)),
          type: 'deposit',
          partnerName: cap.partnerName || 'الشريك',
          amount: amt,
          currency: 'USD',
          equivalentUSD: amt,
          amountUSD: amt,
          date: cap.date || cap.createdAt || new Date().toISOString(),
          notes: cap.notes || 'رأس مال مضاف',
          createdAt: cap.createdAt || new Date().toISOString(),
        });
      }

      for (const rep of oldRepayments) {
        migrated.push({
          id: rep.id || ('cap_mig_rep_' + Math.random().toString(36).substring(2, 7)),
          type: 'refund',
          partnerName: rep.partnerName || 'الشريك',
          amount: rep.amount,
          currency: rep.currency || 'USD',
          exchangeRate: rep.exchangeRate,
          equivalentUSD: rep.equivalentUSD || rep.amount,
          amountUSD: rep.equivalentUSD || rep.amount,
          date: rep.date || rep.createdAt || new Date().toISOString(),
          notes: rep.notes || 'استرداد من رأس المال',
          createdAt: rep.createdAt || new Date().toISOString(),
        });
      }

      migrated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this.savePartnerCapitalTransactions(migrated);
      return migrated;
    }

    // New or clean install: starts strictly at 0 USD (لا توجد مبالغ افتراضية)
    return [];
  }

  static savePartnerCapitalTransactions(transactions: PartnerCapitalTransaction[]): void {
    saveItem(STORAGE_KEYS.PARTNER_CAPITAL_TRANSACTIONS, transactions);
    this.triggerAutoBackup();
  }

  static addPartnerCapitalTransaction(
    data: Omit<PartnerCapitalTransaction, 'id' | 'createdAt'>
  ): PartnerCapitalTransaction {
    const list = this.getPartnerCapitalTransactions();
    const settings = this.getSettings();
    const rate = settings.exchangeRate || 15000;

    const opRate = data.currency === 'SYP' ? (data.exchangeRate || rate) : 1;
    const equivalentUSD = data.currency === 'USD'
      ? data.amount
      : (opRate > 0 ? Number((data.amount / opRate).toFixed(2)) : 0);

    const newId = 'cap_tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newTx: PartnerCapitalTransaction = {
      ...data,
      id: newId,
      partnerName: data.partnerName || settings.partnerName || 'الشريك',
      amount: Number(data.amount) || 0,
      equivalentUSD,
      amountUSD: equivalentUSD,
      exchangeRate: data.currency === 'SYP' ? opRate : undefined,
      createdAt: new Date().toISOString(),
    };

    list.unshift(newTx);
    this.savePartnerCapitalTransactions(list);

    // Record cash deduction in CashBox if refund (استرداد رأس المال يخرج من الصندوق)
    if (newTx.type === 'refund') {
      this.addCashTransaction({
        type: 'out',
        category: 'partner_capital_repayment',
        title: `استرداد من رأس مال الشريك (${newTx.partnerName})`,
        amount: newTx.amount,
        currency: newTx.currency,
        date: newTx.date || new Date().toISOString(),
        person: newTx.partnerName,
        relatedEntityId: newId,
        exchangeRate: newTx.exchangeRate,
        notes: newTx.notes || 'استرداد رسمي من رأس مال الشريك',
      });
    }

    return newTx;
  }

  static updatePartnerCapitalTransaction(
    updatedTx: PartnerCapitalTransaction
  ): PartnerCapitalTransaction {
    const list = this.getPartnerCapitalTransactions();
    const settings = this.getSettings();
    const rate = settings.exchangeRate || 15000;

    const opRate = updatedTx.currency === 'SYP' ? (updatedTx.exchangeRate || rate) : 1;
    const equivalentUSD = updatedTx.currency === 'USD'
      ? updatedTx.amount
      : (opRate > 0 ? Number((updatedTx.amount / opRate).toFixed(2)) : 0);

    const fullTx: PartnerCapitalTransaction = {
      ...updatedTx,
      amount: Number(updatedTx.amount) || 0,
      equivalentUSD,
      amountUSD: equivalentUSD,
      exchangeRate: updatedTx.currency === 'SYP' ? opRate : undefined,
      updatedAt: new Date().toISOString(),
    };

    const index = list.findIndex((t) => t.id === updatedTx.id);
    if (index !== -1) {
      list[index] = fullTx;
      this.savePartnerCapitalTransactions(list);
    }

    // Synchronize linked cashbox transaction if exists
    const cashTxs = this.getCashTransactions();
    const cIndex = cashTxs.findIndex((c) => c.relatedEntityId === updatedTx.id);
    if (cIndex !== -1) {
      if (fullTx.type === 'refund') {
        cashTxs[cIndex] = {
          ...cashTxs[cIndex],
          amount: fullTx.amount,
          currency: fullTx.currency,
          exchangeRate: fullTx.exchangeRate,
          date: fullTx.date,
          notes: fullTx.notes || 'استرداد رسمي من رأس مال الشريك',
        };
      } else {
        // If changed to deposit, remove cash out
        cashTxs.splice(cIndex, 1);
      }
      this.saveCashTransactions(cashTxs);
    }

    return fullTx;
  }

  static deletePartnerCapitalTransaction(id: string): void {
    const list = this.getPartnerCapitalTransactions().filter((t) => t.id !== id);
    this.savePartnerCapitalTransactions(list);

    // Remove any corresponding cashbox transaction
    const cashTxs = this.getCashTransactions().filter((c) => c.relatedEntityId !== id);
    this.saveCashTransactions(cashTxs);
  }

  static getPartnerCapitalSummary() {
    const txs = this.getPartnerCapitalTransactions();
    const settings = this.getSettings();
    const rate = settings.exchangeRate || 15000;

    let totalDepositedUSD = 0;
    let totalRefundedUSD = 0;
    let totalDepositedSYP = 0;
    let totalRefundedSYP = 0;

    for (const t of txs) {
      const usdVal = t.equivalentUSD !== undefined
        ? t.equivalentUSD
        : (t.currency === 'USD' ? t.amount : (t.exchangeRate ? t.amount / t.exchangeRate : t.amount / rate));

      if (t.type === 'deposit') {
        totalDepositedUSD += usdVal;
        if (t.currency === 'SYP') totalDepositedSYP += t.amount;
        else totalDepositedSYP += t.amount * (t.exchangeRate || rate);
      } else {
        totalRefundedUSD += usdVal;
        if (t.currency === 'SYP') totalRefundedSYP += t.amount;
        else totalRefundedSYP += t.amount * (t.exchangeRate || rate);
      }
    }

    const remainingCapitalUSD = Math.max(0, Number((totalDepositedUSD - totalRefundedUSD).toFixed(2)));
    const remainingCapitalSYP = Math.round(remainingCapitalUSD * rate);

    return {
      totalDepositedUSD: Number(totalDepositedUSD.toFixed(2)),
      totalRefundedUSD: Number(totalRefundedUSD.toFixed(2)),
      remainingCapitalUSD,
      totalDepositedSYP,
      totalRefundedSYP,
      remainingCapitalSYP,
      transactionsCount: txs.length,
      transactions: txs,
    };
  }

  // Backward compatibility methods
  static getPartnerCapitals(): PartnerCapital[] {
    return this.getPartnerCapitalTransactions().filter((t) => t.type === 'deposit');
  }

  static savePartnerCapitals(capitals: PartnerCapital[]): void {
    const existing = this.getPartnerCapitalTransactions().filter((t) => t.type !== 'deposit');
    this.savePartnerCapitalTransactions([...capitals, ...existing]);
  }

  static addPartnerCapital(data: Omit<PartnerCapital, 'id' | 'createdAt'>): PartnerCapital {
    return this.addPartnerCapitalTransaction({
      ...data,
      type: 'deposit',
      amount: data.amount ?? data.amountUSD ?? 0,
      currency: data.currency || 'USD',
      equivalentUSD: data.equivalentUSD ?? data.amountUSD ?? data.amount ?? 0,
    });
  }

  static getPartnerCapitalRepayments(): PartnerCapitalRepayment[] {
    return this.getPartnerCapitalTransactions().filter((t) => t.type === 'refund');
  }

  static savePartnerCapitalRepayments(repayments: PartnerCapitalRepayment[]): void {
    const existing = this.getPartnerCapitalTransactions().filter((t) => t.type !== 'refund');
    this.savePartnerCapitalTransactions([...existing, ...repayments]);
  }

  static addPartnerCapitalRepayment(
    data: Omit<PartnerCapitalRepayment, 'id' | 'createdAt'>
  ): PartnerCapitalRepayment {
    return this.addPartnerCapitalTransaction({
      ...data,
      type: 'refund',
    });
  }

  static deletePartnerCapitalRepayment(id: string): void {
    this.deletePartnerCapitalTransaction(id);
  }

  // Partner & Abdallah Account Balances calculation
  static getPartnerAccountSummary() {
    const settings = this.getSettings();
    const rate = settings.exchangeRate || 15000;

    // Strict transaction-derived capital (starts at 0 USD)
    const capSummary = this.getPartnerCapitalSummary();
    const originalCapitalUSD = capSummary.totalDepositedUSD;
    const totalRepaidCapitalUSD = capSummary.totalRefundedUSD;
    const remainingCapitalUSD = capSummary.remainingCapitalUSD;

    const cashTxs = this.getCashTransactions();
    const goodsWithdrawals = this.getGoodsWithdrawals();

    // Partner Cash Withdrawals (excluding capital repayments)
    let partnerCashSYP = 0;
    let partnerCashUSD = 0;
    // Abdallah Cash Withdrawals
    let abdallahCashSYP = 0;
    let abdallahCashUSD = 0;

    for (const ctx of cashTxs) {
      if (ctx.type === 'out') {
        if (ctx.category === 'partner_withdrawal' || (ctx.person === (settings.partnerName || 'الشريك') && ctx.category !== 'partner_capital_repayment')) {
          if (ctx.currency === 'USD') partnerCashUSD += ctx.amount;
          else partnerCashSYP += ctx.amount;
        } else if (ctx.category === 'abdallah_withdrawal' || ctx.person === 'عبدالله') {
          if (ctx.currency === 'USD') abdallahCashUSD += ctx.amount;
          else abdallahCashSYP += ctx.amount;
        }
      }
    }

    // Goods Withdrawals
    let partnerGoodsSYP = 0;
    let partnerGoodsUSD = 0;
    let abdallahGoodsSYP = 0;
    let abdallahGoodsUSD = 0;

    for (const gw of goodsWithdrawals) {
      if (gw.person === 'partner') {
        if (gw.currency === 'USD') partnerGoodsUSD += gw.totalCost;
        else partnerGoodsSYP += gw.totalCost;
      } else {
        if (gw.currency === 'USD') abdallahGoodsUSD += gw.totalCost;
        else abdallahGoodsSYP += gw.totalCost;
      }
    }

    // Totals in USD equivalent
    const partnerTotalWithdrawnUSD = partnerCashUSD + (partnerCashSYP / rate) + partnerGoodsUSD + (partnerGoodsSYP / rate);
    const abdallahTotalWithdrawnUSD = abdallahCashUSD + (abdallahCashSYP / rate) + abdallahGoodsUSD + (abdallahGoodsSYP / rate);

    return {
      partnerName: settings.partnerName || 'الشريك',
      originalCapitalUSD,
      totalCapitalUSD: originalCapitalUSD,
      totalRepaidCapitalUSD,
      remainingCapitalUSD,
      repayments: capSummary.transactions.filter((t) => t.type === 'refund'),
      partnerCashSYP,
      partnerCashUSD,
      partnerGoodsSYP,
      partnerGoodsUSD,
      partnerTotalWithdrawnUSD,
      abdallahCashSYP,
      abdallahCashUSD,
      abdallahGoodsSYP,
      abdallahGoodsUSD,
      abdallahTotalWithdrawnUSD,
      capitalSummary: capSummary,
    };
  }

  // Unified Cash Box Ledger Items
  static getCashBoxUnifiedLedger(): Array<{
    id: string;
    source: 'sale' | 'customer_payment' | 'purchase' | 'supplier_payment' | 'expense' | 'cash_tx';
    type: 'in' | 'out';
    category: string;
    title: string;
    amount: number;
    currency: Currency;
    date: string;
    person?: string;
    notes?: string;
  }> {
    const list: Array<{
      id: string;
      source: 'sale' | 'customer_payment' | 'purchase' | 'supplier_payment' | 'expense' | 'cash_tx';
      type: 'in' | 'out';
      category: string;
      title: string;
      amount: number;
      currency: Currency;
      date: string;
      person?: string;
      notes?: string;
    }> = [];

    // 1. Sales Invoices Cash Paid
    const invoices = this.getInvoices();
    for (const inv of invoices) {
      if (inv.paidAmount > 0) {
        list.push({
          id: 'cash_inv_' + inv.id,
          source: 'sale',
          type: 'in',
          category: 'مبيعات نقدية',
          title: `مقبوضات فاتورة بيع ${inv.invoiceNumber} (${inv.customerName})`,
          amount: inv.paidAmount,
          currency: inv.currency,
          date: inv.date || inv.createdAt,
          person: inv.customerName,
          notes: inv.notes,
        });
      }
    }

    // 2. Customer Debt Payments
    const custPayments = this.getCustomerPayments();
    for (const cp of custPayments) {
      if (cp.amount > 0) {
        list.push({
          id: 'cash_cp_' + cp.id,
          source: 'customer_payment',
          type: 'in',
          category: 'دفعة عميل',
          title: `سداد دفعة حساب - العميل ${cp.customerName}`,
          amount: cp.amount,
          currency: cp.currency,
          date: cp.date || cp.createdAt,
          person: cp.customerName,
          notes: cp.notes,
        });
      }
    }

    // 3. Purchase Invoices Cash Paid
    const purchases = this.getPurchaseInvoices();
    for (const pur of purchases) {
      if (pur.paidUSD && pur.paidUSD > 0) {
        list.push({
          id: 'cash_pur_usd_' + pur.id,
          source: 'purchase',
          type: 'out',
          category: 'مشتريات نقدية بالدولار',
          title: `مدفوعات فاتورة شراء ${pur.invoiceNumber} (${pur.supplierName}) - دولار`,
          amount: pur.paidUSD,
          currency: 'USD',
          date: pur.date || pur.createdAt,
          person: pur.supplierName,
          notes: pur.notes,
        });
      }
      if (pur.paidSYP && pur.paidSYP > 0) {
        list.push({
          id: 'cash_pur_syp_' + pur.id,
          source: 'purchase',
          type: 'out',
          category: 'مشتريات نقدية بالليرة',
          title: `مدفوعات فاتورة شراء ${pur.invoiceNumber} (${pur.supplierName}) - ليرة`,
          amount: pur.paidSYP,
          currency: 'SYP',
          date: pur.date || pur.createdAt,
          person: pur.supplierName,
          notes: pur.notes,
        });
      } else if (!pur.paidUSD && !pur.paidSYP && pur.paidAmount > 0) {
        list.push({
          id: 'cash_pur_' + pur.id,
          source: 'purchase',
          type: 'out',
          category: 'مشتريات نقدية',
          title: `مدفوعات فاتورة شراء ${pur.invoiceNumber} (${pur.supplierName})`,
          amount: pur.paidAmount,
          currency: pur.currency === 'USD' ? 'USD' : 'SYP',
          date: pur.date || pur.createdAt,
          person: pur.supplierName,
          notes: pur.notes,
        });
      }
    }

    // 4. Supplier Debt Payments (from ledger)
    const suppTxs = this.getSupplierTransactions();
    for (const st of suppTxs) {
      if (st.type === 'payment' && st.amount > 0) {
        list.push({
          id: 'cash_st_' + st.id,
          source: 'supplier_payment',
          type: 'out',
          category: 'دفعة مورد',
          title: `سداد دفعة حساب - المورد ${st.supplierName}`,
          amount: st.amount,
          currency: st.currency,
          date: st.date || st.createdAt,
          person: st.supplierName,
          notes: st.notes,
        });
      }
    }

    // 5. Operating Expenses
    const expenses = this.getExpenses();
    for (const exp of expenses) {
      if (exp.amount > 0) {
        list.push({
          id: 'cash_exp_' + exp.id,
          source: 'expense',
          type: 'out',
          category: exp.category || 'مصاريف تشغيلية',
          title: `مصروف: ${exp.category}`,
          amount: exp.amount,
          currency: exp.currency,
          date: exp.date || exp.createdAt,
          person: exp.person,
          notes: exp.notes,
        });
      }
    }

    // 6. Manual Cash Transactions (Deposits, Abdallah/Partner Withdrawals, Special Expenses)
    const cashTxs = this.getCashTransactions();
    for (const ctx of cashTxs) {
      let catLabel = 'حركة نقدية';
      if (ctx.category === 'usd_purchase') catLabel = 'شراء دولار نقدي';
      else if (ctx.category === 'usd_sale') catLabel = 'بيع دولار نقدي';
      else if (ctx.category === 'abdallah_withdrawal') catLabel = 'سحب عبدالله';
      else if (ctx.category === 'partner_withdrawal') catLabel = 'سحب الشريك';
      else if (ctx.category === 'special_expense') catLabel = 'مصروف خاص';
      else if (ctx.category === 'partner_capital_repayment') catLabel = 'سداد رأس مال الشريك';
      else if (ctx.category === 'capital_deposit') catLabel = 'إيداع نقدي / رأس مال';
      else if (ctx.type === 'in') catLabel = 'إيداع بالصندوق';
      else catLabel = 'سحب نقدي';

      list.push({
        id: 'cash_ctx_' + ctx.id,
        source: 'cash_tx',
        type: ctx.type,
        category: catLabel,
        title: ctx.title,
        amount: ctx.amount,
        currency: ctx.currency,
        date: ctx.date || ctx.createdAt,
        person: ctx.person,
        notes: ctx.notes,
      });
    }

    // Sort newest date first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Cash Box Summary & Balances
  static getCashBoxSummary() {
    const settings = this.getSettings();
    const rate = settings.exchangeRate || 15000;
    const ledger = this.getCashBoxUnifiedLedger();

    const initialCashSYP = settings.initialCashSYP || 0;
    const initialCashUSD = settings.initialCashUSD || 0;

    let inSYP = 0;
    let inUSD = 0;
    let outSYP = 0;
    let outUSD = 0;

    let salesInSYP = 0;
    let salesInUSD = 0;
    let custPaymentsInSYP = 0;
    let custPaymentsInUSD = 0;

    let purchasesOutSYP = 0;
    let purchasesOutUSD = 0;
    let supplierPaymentsOutSYP = 0;
    let supplierPaymentsOutUSD = 0;
    let operatingExpensesOutSYP = 0;
    let operatingExpensesOutUSD = 0;

    let abdallahWithdrawalsSYP = 0;
    let abdallahWithdrawalsUSD = 0;
    let partnerWithdrawalsSYP = 0;
    let partnerWithdrawalsUSD = 0;
    let partnerCapitalRepaymentsSYP = 0;
    let partnerCapitalRepaymentsUSD = 0;
    let specialExpensesSYP = 0;
    let specialExpensesUSD = 0;

    for (const item of ledger) {
      if (item.type === 'in') {
        if (item.currency === 'USD') inUSD += item.amount;
        else inSYP += item.amount;

        if (item.source === 'sale') {
          if (item.currency === 'USD') salesInUSD += item.amount;
          else salesInSYP += item.amount;
        } else if (item.source === 'customer_payment') {
          if (item.currency === 'USD') custPaymentsInUSD += item.amount;
          else custPaymentsInSYP += item.amount;
        }
      } else {
        if (item.currency === 'USD') outUSD += item.amount;
        else outSYP += item.amount;

        if (item.source === 'purchase') {
          if (item.currency === 'USD') purchasesOutUSD += item.amount;
          else purchasesOutSYP += item.amount;
        } else if (item.source === 'supplier_payment') {
          if (item.currency === 'USD') supplierPaymentsOutUSD += item.amount;
          else supplierPaymentsOutSYP += item.amount;
        } else if (item.source === 'expense') {
          if (item.currency === 'USD') operatingExpensesOutUSD += item.amount;
          else operatingExpensesOutSYP += item.amount;
        } else if (item.source === 'cash_tx') {
          if (item.category === 'سحب عبدالله') {
            if (item.currency === 'USD') abdallahWithdrawalsUSD += item.amount;
            else abdallahWithdrawalsSYP += item.amount;
          } else if (item.category === 'سحب الشريك') {
            if (item.currency === 'USD') partnerWithdrawalsUSD += item.amount;
            else partnerWithdrawalsSYP += item.amount;
          } else if (item.category === 'سداد رأس مال الشريك') {
            if (item.currency === 'USD') partnerCapitalRepaymentsUSD += item.amount;
            else partnerCapitalRepaymentsSYP += item.amount;
          } else if (item.category === 'مصروف خاص') {
            if (item.currency === 'USD') specialExpensesUSD += item.amount;
            else specialExpensesSYP += item.amount;
          }
        }
      }
    }

    const expectedCashSYP = initialCashSYP + inSYP - outSYP;
    const expectedCashUSD = initialCashUSD + inUSD - outUSD;

    // Combined total in SYP
    const combinedTotalSYP = expectedCashSYP + expectedCashUSD * rate;

    return {
      initialCashSYP,
      initialCashUSD,
      inSYP,
      inUSD,
      outSYP,
      outUSD,
      expectedCashSYP,
      expectedCashUSD,
      combinedTotalSYP,
      salesInSYP,
      salesInUSD,
      custPaymentsInSYP,
      custPaymentsInUSD,
      purchasesOutSYP,
      purchasesOutUSD,
      supplierPaymentsOutSYP,
      supplierPaymentsOutUSD,
      operatingExpensesOutSYP,
      operatingExpensesOutUSD,
      abdallahWithdrawalsSYP,
      abdallahWithdrawalsUSD,
      partnerWithdrawalsSYP,
      partnerWithdrawalsUSD,
      partnerCapitalRepaymentsSYP,
      partnerCapitalRepaymentsUSD,
      specialExpensesSYP,
      specialExpensesUSD,
    };
  }

  // Overall Financial Summary
  static getFinancialSummary(): {
    totalSales: number;
    totalPurchases: number;
    totalCashReceived: number;
    totalCustomerDebt: number;
    totalSupplierDebt: number;
    totalExpenses: number;
    netCashBalance: number;
    totalInventoryValueSYP: number;
  } {
    const settings = this.getSettings();
    const rate = settings.exchangeRate || 15000;

    const invoices = this.getInvoices();
    const purchaseInvoices = this.getPurchaseInvoices();
    const customers = this.getCustomers();
    const suppliers = this.getSuppliers();
    const products = this.getProducts();
    const cashSummary = this.getCashBoxSummary();

    // Invoices sales total
    let totalSales = 0;
    for (const inv of invoices) {
      const multiplier = inv.currency === 'USD' ? rate : 1;
      totalSales += inv.finalTotal * multiplier;
    }

    // Purchase invoices total
    let totalPurchases = 0;
    for (const pur of purchaseInvoices) {
      const multiplier = pur.currency === 'USD' ? rate : 1;
      totalPurchases += pur.finalTotal * multiplier;
    }

    // Total Customer Debt (sum of each customer's balance)
    let totalCustomerDebt = 0;
    for (const cust of customers) {
      // getCustomerBalance يعيد القيمة بالليرة مسبقاً (SYP + USD × السعر الحالي)
      totalCustomerDebt += this.getCustomerBalance(cust.id);
    }

    // Total Supplier Debt
    let totalSupplierDebt = 0;
    for (const supp of suppliers) {
      // رصيد المورد بالدولار → تقييم حالي بالليرة
      totalSupplierDebt += this.getSupplierBalance(supp.id) * rate;
    }

    // Total inventory value
    let totalInventoryValueSYP = 0;
    for (const prod of products) {
      const cartonCostSYP = prod.costCurrency === 'USD' ? prod.purchaseCost * rate : prod.purchaseCost;
      const pieceCostSYP = cartonCostSYP / (prod.piecesPerCarton || 1);
      totalInventoryValueSYP += prod.totalPiecesInStock * pieceCostSYP;
    }

    const totalCashReceived = cashSummary.inSYP + cashSummary.inUSD * rate;
    const totalExpenses =
      cashSummary.operatingExpensesOutSYP +
      cashSummary.operatingExpensesOutUSD * rate +
      cashSummary.specialExpensesSYP +
      cashSummary.specialExpensesUSD * rate;

    const netCashBalance = cashSummary.combinedTotalSYP;

    return {
      totalSales,
      totalPurchases,
      totalCashReceived,
      totalCustomerDebt,
      totalSupplierDebt,
      totalExpenses,
      netCashBalance,
      totalInventoryValueSYP,
    };
  }

  // Comprehensive Daily Inventory (Jard) Calculation
  static getDailyInventoryAudit(customRate?: number, asOfDate?: string): DailyInventoryAudit {
    const settings = this.getSettings();
    const rate = customRate || settings.exchangeRate || 15000;
    const filterDate = asOfDate ? asOfDate + 'T23:59:59.999Z' : null;

    // Helper to check if record is on or before asOfDate
    const isBeforeDate = (dateStr?: string) => {
      if (!filterDate || !dateStr) return true;
      return new Date(dateStr).getTime() <= new Date(filterDate).getTime();
    };

    // 1. Cash Balances (Calculate from ledger transactions up to asOfDate)
    let cashSYP = settings.initialCashSYP || 0;
    let cashUSD = settings.initialCashUSD || 0;

    const fullLedger = this.getCashBoxUnifiedLedger();
    for (const item of fullLedger) {
      if (!isBeforeDate(item.date)) continue;
      if (item.type === 'in') {
        if (item.currency === 'USD') cashUSD += item.amount;
        else cashSYP += item.amount;
      } else {
        if (item.currency === 'USD') cashUSD -= item.amount;
        else cashSYP -= item.amount;
      }
    }

    // 2. Customers Debt Breakdown (Dual-Currency) up to asOfDate
    const customers = this.getCustomers();
    let customerDebtSYP = 0;
    let customerDebtUSD = 0;
    const customerDebtsList: Array<{
      id: string;
      name: string;
      shopName?: string;
      syp: number;
      usd: number;
      totalInUSD: number;
    }> = [];

    for (const cust of customers) {
      let syp = cust.currency === 'USD' ? 0 : (cust.initialDebt || 0);
      let usd = cust.currency === 'USD' ? (cust.initialDebt || 0) : (cust.initialDebtUSD || 0);

      // Invoices
      const custInvoices = this.getInvoices().filter((inv) => inv.customerId === cust.id && isBeforeDate(inv.date));
      for (const inv of custInvoices) {
        if (inv.isFixedUSD && inv.fixedUSDAmount) {
          const paidUSD = (inv.paidAmount || 0) / (inv.fixedExchangeRate || inv.exchangeRate || rate);
          usd += Math.max(0, inv.fixedUSDAmount - paidUSD);
        } else if (inv.currency === 'USD') {
          usd += Math.max(0, (inv.finalTotal || 0) - (inv.paidAmount || 0));
        } else {
          syp += Math.max(0, (inv.finalTotal || 0) - (inv.paidAmount || 0));
        }
      }

      // Payments
      const custPayments = this.getCustomerPayments().filter((p) => p.customerId === cust.id && isBeforeDate(p.date));
      for (const p of custPayments) {
        if (p.currency === 'USD') {
          usd -= p.amount;
        } else {
          syp -= p.amount;
        }
      }

      if (syp !== 0 || usd !== 0) {
        customerDebtSYP += syp;
        customerDebtUSD += usd;
        customerDebtsList.push({
          id: cust.id,
          name: cust.name,
          shopName: cust.shopName,
          syp,
          usd,
          totalInUSD: usd + (syp / rate),
        });
      }
    }

    // 3. Suppliers Debt Breakdown (Dual-Currency) up to asOfDate
    const suppliers = this.getSuppliers();
    let supplierDebtSYP = 0;
    let supplierDebtUSD = 0;
    const supplierDebtsList: Array<{
      id: string;
      name: string;
      company?: string;
      syp: number;
      usd: number;
      totalInUSD: number;
    }> = [];

    for (const supp of suppliers) {
      // رصيد المورد بالدولار من كشف الحساب (بأسعار الصرف التاريخية) حتى تاريخ الجرد
      const st = this.getSupplierStatement(supp.id, undefined, asOfDate);
      const usd = st.rows.length ? st.rows[st.rows.length - 1].balanceAfterUSD : 0;
      const syp = 0;

      if (usd !== 0) {
        supplierDebtSYP += syp;
        supplierDebtUSD += usd;
        supplierDebtsList.push({
          id: supp.id,
          name: supp.name,
          company: supp.company,
          syp,
          usd,
          totalInUSD: usd,
        });
      }
    }

    // 4. Warehouse Inventory Value at Cost (Classified by SYP & USD)
    const products = this.getProducts().filter((p) => !p.isArchived);
    let inventoryCostUSD = 0;
    let inventoryCostSYP = 0;
    let totalPiecesCount = 0;

    const inventorySYPItems: InventoryItemBreakdown[] = [];
    const inventoryUSDItems: InventoryItemBreakdown[] = [];

    for (const prod of products) {
      totalPiecesCount += prod.totalPiecesInStock;
      const ppc = prod.piecesPerCarton || 1;
      const cartons = Math.floor(prod.totalPiecesInStock / ppc);
      const loosePieces = prod.totalPiecesInStock % ppc;
      const cartonsEquivalent = prod.totalPiecesInStock / ppc;
      const pieceCost = prod.purchaseCost / ppc;
      const totalCostOriginal = cartonsEquivalent * prod.purchaseCost;

      if (prod.costCurrency === 'USD') {
        inventoryCostUSD += totalCostOriginal;
        inventoryUSDItems.push({
          id: prod.id,
          name: prod.name,
          unit: prod.unit || 'كرتونة',
          piecesPerCarton: ppc,
          totalPieces: prod.totalPiecesInStock,
          cartons,
          loosePieces,
          costCurrency: 'USD',
          unitCost: prod.purchaseCost,
          pieceCost,
          totalCostOriginal,
          equivalentUSD: totalCostOriginal,
          equivalentSYP: totalCostOriginal * rate,
        });
      } else {
        inventoryCostSYP += totalCostOriginal;
        inventorySYPItems.push({
          id: prod.id,
          name: prod.name,
          unit: prod.unit || 'كرتونة',
          piecesPerCarton: ppc,
          totalPieces: prod.totalPiecesInStock,
          cartons,
          loosePieces,
          costCurrency: 'SYP',
          unitCost: prod.purchaseCost,
          pieceCost,
          totalCostOriginal,
          equivalentUSD: totalCostOriginal / rate,
          equivalentSYP: totalCostOriginal,
        });
      }
    }

    // Total Inventory unified in USD & SYP
    const totalInventoryInUSD = inventoryCostUSD + (inventoryCostSYP / rate);
    const totalInventoryInSYP = (inventoryCostUSD * rate) + inventoryCostSYP;

    // 5. Partners & Capital (Up to asOfDate)
    const rawPartnerSummary = this.getPartnerAccountSummary();
    let partnerCashSYP = 0;
    let partnerCashUSD = 0;
    let abdallahCashSYP = 0;
    let abdallahCashUSD = 0;

    const cashTxs = this.getCashTransactions().filter((ctx) => isBeforeDate(ctx.date || ctx.createdAt));
    for (const ctx of cashTxs) {
      if (ctx.category === 'partner_withdrawal' || ctx.person === 'الشريك' || ctx.person === (settings.partnerName || 'الشريك')) {
        if (ctx.currency === 'USD') partnerCashUSD += ctx.amount;
        else partnerCashSYP += ctx.amount;
      } else if (ctx.category === 'abdallah_withdrawal' || ctx.person === 'عبدالله') {
        if (ctx.currency === 'USD') abdallahCashUSD += ctx.amount;
        else abdallahCashSYP += ctx.amount;
      }
    }

    let partnerGoodsSYP = 0;
    let partnerGoodsUSD = 0;
    let abdallahGoodsSYP = 0;
    let abdallahGoodsUSD = 0;

    const goodsW = this.getGoodsWithdrawals().filter((w) => isBeforeDate(w.date || w.createdAt));
    for (const w of goodsW) {
      if (w.person === 'partner') {
        if (w.currency === 'USD') partnerGoodsUSD += w.totalCost;
        else partnerGoodsSYP += w.totalCost;
      } else {
        if (w.currency === 'USD') abdallahGoodsUSD += w.totalCost;
        else abdallahGoodsSYP += w.totalCost;
      }
    }

    const partnerTotalWithdrawnUSD = partnerCashUSD + (partnerCashSYP / rate) + partnerGoodsUSD + (partnerGoodsSYP / rate);
    const abdallahTotalWithdrawnUSD = abdallahCashUSD + (abdallahCashSYP / rate) + abdallahGoodsUSD + (abdallahGoodsSYP / rate);
    const totalWithdrawalsUSD = partnerTotalWithdrawnUSD + abdallahTotalWithdrawnUSD;

    const partnerSummary = {
      partnerName: rawPartnerSummary.partnerName,
      totalCapitalUSD: rawPartnerSummary.totalCapitalUSD ?? 0,
      partnerCashSYP,
      partnerCashUSD,
      partnerGoodsSYP,
      partnerGoodsUSD,
      partnerTotalWithdrawnUSD,
      abdallahCashSYP,
      abdallahCashUSD,
      abdallahGoodsSYP,
      abdallahGoodsUSD,
      abdallahTotalWithdrawnUSD,
    };

    // 6. Cumulative Operating Profits (Sales profit - Operating Expenses) up to asOfDate
    let cumulativeSalesProfitUSD = 0;
    const filteredInvoices = this.getInvoices().filter((inv) => isBeforeDate(inv.date));
    for (const inv of filteredInvoices) {
      const invRate = inv.exchangeRate || rate;
      const saleTotalUSD = inv.currency === 'USD' ? inv.finalTotal : (inv.finalTotal / invRate);
      let invCostUSD = 0;
      for (const item of inv.items) {
        const prod = products.find((p) => p.id === item.productId);
        const ppc = prod?.piecesPerCarton || 1;
        const totalP = (item.cartons * ppc) + item.pieces;
        const itemUnitCost = prod?.purchaseCost || 0;
        const itemCostCurrency = prod?.costCurrency || 'SYP';
        const lineCostOriginal = (totalP / ppc) * itemUnitCost;
        const lineCostUSD = itemCostCurrency === 'USD' ? lineCostOriginal : (lineCostOriginal / invRate);
        invCostUSD += lineCostUSD;
      }
      cumulativeSalesProfitUSD += (saleTotalUSD - invCostUSD);
    }

    let operatingExpensesUSD = 0;
    const filteredExpenses = this.getExpenses().filter((exp) => isBeforeDate(exp.date));
    for (const exp of filteredExpenses) {
      if (exp.currency === 'USD') operatingExpensesUSD += exp.amount;
      else operatingExpensesUSD += (exp.amount / rate);
    }
    const operatingProfitUSD = cumulativeSalesProfitUSD - operatingExpensesUSD;

    // 7. Net Project Value / Equity
    // Total Assets = Cash (in USD) + Customer Debts (in USD) + Inventory Value (in USD)
    const cashTotalInUSD = cashUSD + (cashSYP / rate);
    const customerDebtsInUSD = customerDebtUSD + (customerDebtSYP / rate);
    const totalAssetsUSD = cashTotalInUSD + customerDebtsInUSD + totalInventoryInUSD;

    // Total Liabilities = Supplier Debts (in USD)
    const supplierDebtsInUSD = supplierDebtUSD + (supplierDebtSYP / rate);
    const totalLiabilitiesUSD = supplierDebtsInUSD;

    // Net Equity (الصافي الفعلي للمشروع)
    const netProjectWorthUSD = totalAssetsUSD - totalLiabilitiesUSD;
    const netProjectWorthSYP = netProjectWorthUSD * rate;

    // Capital & Profit Comparison
    const initialCapitalUSD = partnerSummary.totalCapitalUSD ?? 0;
    const netProjectPlusWithdrawalsUSD = netProjectWorthUSD + totalWithdrawalsUSD;
    const netProfitOrLossUSD = netProjectPlusWithdrawalsUSD - initialCapitalUSD;

    // 8. Strict Project Matching & Reconciliation (المطابقة المحاسبية)
    // Assets = Liabilities + Equity
    // Theoretical Equity = Initial Capital + Operating Profits - Total Withdrawals
    const expectedEquityUSD = initialCapitalUSD + operatingProfitUSD - totalWithdrawalsUSD;
    const rawDiff = netProjectWorthUSD - expectedEquityUSD;
    const unexplainedDifferenceUSD = Math.abs(rawDiff) < 0.05 ? 0 : Number(rawDiff.toFixed(2));
    const isBalanced = unexplainedDifferenceUSD === 0;

    const reconciliation: ProjectReconciliation = {
      totalAssetsUSD,
      totalLiabilitiesUSD,
      actualNetWorthUSD: netProjectWorthUSD,
      initialCapitalUSD,
      operatingProfitUSD,
      partnerTotalWithdrawnUSD,
      abdallahTotalWithdrawnUSD,
      totalWithdrawalsUSD,
      expectedEquityUSD,
      unexplainedDifferenceUSD,
      isBalanced,
    };

    return {
      timestamp: new Date().toISOString(),
      asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
      exchangeRate: rate,
      // Cash
      cashSYP,
      cashUSD,
      cashTotalInUSD,
      // Customers
      customerDebtSYP,
      customerDebtUSD,
      customerDebtsInUSD,
      customerDebtsList,
      // Suppliers
      supplierDebtSYP,
      supplierDebtUSD,
      supplierDebtsInUSD,
      supplierDebtsList,
      // Inventory
      inventoryCostUSD,
      inventoryCostSYP,
      totalInventoryInUSD,
      totalInventoryInSYP,
      totalProductsCount: products.length,
      totalPiecesCount,
      inventorySYPItems,
      inventoryUSDItems,
      // Partners
      partnerSummary,
      // Final Project Balance
      totalAssetsUSD,
      totalLiabilitiesUSD,
      netProjectWorthUSD,
      netProjectWorthSYP,
      initialCapitalUSD,
      totalWithdrawalsUSD,
      netProfitOrLossUSD,
      // Reconciliation
      reconciliation,
    };
  }

  // ================= Customer / Supplier Audits + FX Effect =================
  static getCustomerAudit(): { rows: PartyAuditRow[]; totalSypBalance: number; totalUsdBalance: number; totalHistoricalUSD: number; totalCurrentUSD: number; totalFxEffectUSD: number; rate: number } {
    const rate = this.getSettings().exchangeRate || 1;
    const hist = this.getExchangeRateHistory();
    const invoices = this.getInvoices();
    const payments = this.getCustomerPayments();
    const rows = this.getCustomers()
      .map((c) => customerAuditRow(c as any, invoices as any, payments as any, hist, rate))
      .sort((a, b) => b.currentUSD - a.currentUSD);
    const sum = (k: keyof PartyAuditRow) => round2(rows.reduce((t, r) => t + (r[k] as number), 0));
    return {
      rows,
      totalSypBalance: Math.round(rows.reduce((t, r) => t + r.sypBalance, 0)),
      totalUsdBalance: sum('usdBalance'),
      totalHistoricalUSD: sum('historicalUSD'),
      totalCurrentUSD: sum('currentUSD'),
      totalFxEffectUSD: sum('fxEffectUSD'),
      rate,
    };
  }

  static getSupplierAudit(): { rows: PartyAuditRow[]; totalPayablesUSD: number; totalSypBalance: number; totalUsdBalance: number; rate: number } {
    const rate = this.getSettings().exchangeRate || 1;
    const hist = this.getExchangeRateHistory();
    const purchases = this.getPurchaseInvoices();
    const txs = this.getSupplierTransactions();
    const rows = this.getSuppliers()
      .map((s) => supplierAuditRow(s as any, purchases as any, txs as any, rate, hist))
      .sort((a, b) => b.currentUSD - a.currentUSD);
    return {
      rows,
      totalPayablesUSD: round2(rows.reduce((t, r) => t + r.currentUSD, 0)),
      totalSypBalance: Math.round(rows.reduce((t, r) => t + r.sypBalance, 0)),
      totalUsdBalance: round2(rows.reduce((t, r) => t + r.usdBalance, 0)),
      rate,
    };
  }

  /** أثر سعر الصرف: نقد + عملاء + موردون + مخزون بالليرة. سعر اليوم للتقييم الحالي فقط. */
  static getExchangeRateEffectReport(): FxEffectReport {
    const settings = this.getSettings();
    const rate = settings.exchangeRate || 1;
    const hist = this.getExchangeRateHistory();
    const sorted = [...hist].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt));
    const previousRate = sorted.length >= 2 ? sorted[sorted.length - 2].exchangeRate : null;

    // النقد: أحداث الليرة من دفتر الصندوق بأسعارها التاريخية
    const events: Array<{ date: string; amount: number; rate: number }> = [];
    let cashUSD = settings.initialCashUSD || 0;
    const initSYP = settings.initialCashSYP || 0;
    if (initSYP) events.push({ date: '0000-01-01T00:00:00.000Z', amount: initSYP, rate: sorted.length ? sorted[0].exchangeRate : rate });
    const invoiceRateById = new Map(this.getInvoices().map((i) => [i.id, i.exchangeRate || i.fixedExchangeRate]));
    const purchaseRateById = new Map(this.getPurchaseInvoices().map((p) => [p.id, p.invoiceExchangeRate]));
    for (const item of this.getCashBoxUnifiedLedger()) {
      if (item.currency === 'USD') cashUSD += item.type === 'in' ? item.amount : -item.amount;
      else {
        const r = invoiceRateById.get(item.id) || purchaseRateById.get(item.id) || rateAt(hist, item.date, rate);
        events.push({ date: item.date, amount: item.type === 'in' ? item.amount : -item.amount, rate: r });
      }
    }
    const cash = valueSypPosition(fifoFxBasis(events), round2(cashUSD), rate);

    const custAudit = this.getCustomerAudit();
    const suppAudit = this.getSupplierAudit();

    // مخزون مسعّر بالليرة: تكلفة الدفعات المتبقية ÷ سعر صرف الدفعة
    let invSYP = 0;
    let invSYPHist = 0;
    for (const b of this.getInventoryBatches()) {
      if (b.currency !== 'SYP' || b.remainingPieces <= 0) continue;
      const prod = this.getProducts().find((p) => p.id === b.productId);
      const ppc = prod?.piecesPerCarton || 1;
      const value = (b.remainingPieces / ppc) * b.unitCost;
      invSYP += value;
      invSYPHist += value / (b.exchangeRate || rate);
    }

    return buildFxEffectReport({
      currentRate: rate,
      previousRate,
      cash,
      customerRows: custAudit.rows,
      supplierRows: suppAudit.rows,
      inventorySYPValue: Math.round(invSYP),
      inventorySYPHistoricalUSD: invSYPHist,
    });
  }

  // Automatic and Safety Backup System
  static triggerAutoBackup(): void {
    try {
      const currentBackup = this.exportBackup();
      const existingLatest = loadItem<string | null>(STORAGE_KEYS.AUTO_BACKUP_LATEST, null);
      if (existingLatest) {
        saveItem(STORAGE_KEYS.AUTO_BACKUP_PREVIOUS, existingLatest);
      }
      saveItem(STORAGE_KEYS.AUTO_BACKUP_LATEST, currentBackup);
    } catch (err) {
      console.warn('Auto backup skipped/failed:', err);
    }
  }

  static getSafetyBackup(): string | null {
    return loadItem<string | null>(STORAGE_KEYS.AUTO_BACKUP_SAFETY, null);
  }

  static getAutoBackup(type: 'latest' | 'previous'): string | null {
    return loadItem<string | null>(
      type === 'latest' ? STORAGE_KEYS.AUTO_BACKUP_LATEST : STORAGE_KEYS.AUTO_BACKUP_PREVIOUS,
      null
    );
  }

  // Backup and restore
  // ================= Backup / Restore (v3) =================
  /** مجموعات البيانات المالية المضمّنة في النسخة الاحتياطية (الاسم في الملف → دوال القراءة/الكتابة). */
  private static backupCollections(): Array<{ name: string; get: () => any[]; set: (v: any[]) => void }> {
    return [
      { name: 'products', get: () => this.getProducts(), set: (v) => this.saveProducts(v) },
      { name: 'customers', get: () => this.getCustomers(), set: (v) => this.saveCustomers(v) },
      { name: 'invoices', get: () => this.getInvoices(), set: (v) => this.saveInvoices(v) },
      { name: 'purchaseInvoices', get: () => this.getPurchaseInvoices(), set: (v) => this.savePurchaseInvoices(v) },
      { name: 'inventoryBatches', get: () => this.getInventoryBatches(), set: (v) => this.saveInventoryBatches(v) },
      { name: 'customerPayments', get: () => this.getCustomerPayments(), set: (v) => this.saveCustomerPayments(v) },
      { name: 'suppliers', get: () => this.getSuppliers(), set: (v) => this.saveSuppliers(v) },
      { name: 'supplierTransactions', get: () => this.getSupplierTransactions(), set: (v) => this.saveSupplierTransactions(v) },
      { name: 'expenses', get: () => this.getExpenses(), set: (v) => this.saveExpenses(v) },
      { name: 'cashTransactions', get: () => this.getCashTransactions(), set: (v) => this.saveCashTransactions(v) },
      { name: 'usdPurchases', get: () => this.getUsdPurchases(), set: (v) => this.saveUsdPurchases(v) },
      { name: 'goodsWithdrawals', get: () => this.getGoodsWithdrawals(), set: (v) => this.saveGoodsWithdrawals(v) },
      { name: 'partnerCapitalTransactions', get: () => this.getPartnerCapitalTransactions(), set: (v) => this.savePartnerCapitalTransactions(v) },
      { name: 'exchangeRates', get: () => this.getExchangeRateHistory(), set: (v) => saveItem(STORAGE_KEYS.EXCHANGE_RATES, v) },
      { name: 'dailyAudits', get: () => loadItem<any[]>(STORAGE_KEYS.DAILY_AUDITS, []), set: (v) => saveItem(STORAGE_KEYS.DAILY_AUDITS, v) },
    ];
  }

  private static collectBackupData(): Record<string, any> {
    const out: Record<string, any> = { settings: this.getSettings() };
    for (const c of this.backupCollections()) out[c.name] = c.get();
    return out;
  }

  static exportBackup(): string {
    const collections = this.collectBackupData();
    const counts: Record<string, number> = {};
    for (const c of this.backupCollections()) counts[c.name] = (collections[c.name] as any[]).length;

    // لقطة التدقيق المالي وقت النسخ (معلوماتية - لا تُستعاد لأنها تُحسب من السجلات)
    let auditSnapshot: any = null;
    try {
      auditSnapshot = {
        customerAudit: this.getCustomerAudit(),
        supplierAudit: this.getSupplierAudit(),
        exchangeRateEffect: this.getExchangeRateEffectReport(),
        partnerCapitalUSD: this.getPartnerCapitalSummary().remainingCapitalUSD,
      };
    } catch {
      auditSnapshot = null;
    }

    const now = new Date().toISOString();
    const data = {
      appName: 'مركز العطايا لتوزيع المواد الغذائية',
      backupVersion: '3.0.0',
      databaseVersion: 3,
      createdAt: now,
      timestamp: now,
      recordCounts: counts,
      checksum: fnv1a(JSON.stringify(collections)),
      ...collections,
      auditSnapshot,
    };
    return JSON.stringify(data, null, 2);
  }

  /** فحص بنية الملف دون تعديل أي بيانات. */
  static validateBackup(jsonString: string): { ok: boolean; message: string; data?: any } {
    if (!jsonString || typeof jsonString !== 'string') return { ok: false, message: 'ملف النسخة الاحتياطية فارغ أو غير صالح' };
    let data: any;
    try {
      data = JSON.parse(jsonString);
    } catch {
      return { ok: false, message: 'الملف تالف أو ليس بصيغة JSON صحيحة' };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, message: 'بنية النسخة الاحتياطية غير صحيحة' };
    const looksLikeApp =
      data.appName?.includes?.('مركز العطايا') ||
      data.settings?.centerName?.includes?.('مركز العطايا') ||
      (Array.isArray(data.products) && Array.isArray(data.invoices));
    if (!looksLikeApp) return { ok: false, message: 'الملف غير مطابق لتطبيق مركز العطايا لتوزيع المواد الغذائية' };

    for (const c of this.backupCollections()) {
      const v = data[c.name];
      if (v === undefined) continue;
      if (!Array.isArray(v)) return { ok: false, message: `الحقل ${c.name} يجب أن يكون قائمة` };
      if (v.some((r: any) => r === null || typeof r !== 'object')) return { ok: false, message: `الحقل ${c.name} يحتوي سجلات غير صالحة` };
    }
    for (const inv of data.invoices || []) {
      if (!Array.isArray(inv.items)) return { ok: false, message: 'توجد فاتورة مبيعات بدون بنود' };
    }
    for (const inv of data.purchaseInvoices || []) {
      if (!Array.isArray(inv.items)) return { ok: false, message: 'توجد فاتورة مشتريات بدون بنود' };
    }
    if (data.checksum) {
      const cols: Record<string, any> = { settings: data.settings };
      for (const c of this.backupCollections()) if (data[c.name] !== undefined) cols[c.name] = data[c.name];
      // الـchecksum محسوب على المجموعات كاملة؛ نتحقق فقط إن كانت كلها موجودة
      const allPresent = this.backupCollections().every((c) => data[c.name] !== undefined) && data.settings !== undefined;
      if (allPresent && fnv1a(JSON.stringify(cols)) !== data.checksum) {
        return { ok: false, message: 'بصمة الملف (checksum) لا تطابق المحتوى: الملف معدَّل أو تالف' };
      }
    }
    return { ok: true, message: 'الملف صالح', data };
  }

  private static applyBackupData(data: Record<string, any>): void {
    if (data.settings) {
      // لا نمسح سجل الأسعار: نحفظ الإعدادات مباشرة
      saveItem(STORAGE_KEYS.SETTINGS, data.settings);
    }
    for (const c of this.backupCollections()) {
      if (Array.isArray(data[c.name])) c.set(data[c.name]);
    }
    // نسخ قديمة (قبل v2.2) : ترحيل رأس المال دون أي قيمة افتراضية
    if (!Array.isArray(data.partnerCapitalTransactions)) {
      const oldCaps = Array.isArray(data.partnerCapitals)
        ? data.partnerCapitals.filter((c: any) => c && (c.amountUSD > 0 || c.amount > 0))
        : [];
      const oldReps = Array.isArray(data.partnerCapitalRepayments) ? data.partnerCapitalRepayments : [];
      const migrated: PartnerCapitalTransaction[] = [];
      for (const c of oldCaps) {
        const amt = c.amountUSD || c.amount || 0;
        migrated.push({
          id: c.id || 'cap_' + Math.random().toString(36).substring(2, 7),
          type: 'deposit',
          partnerName: c.partnerName || 'الشريك',
          amount: amt,
          currency: 'USD',
          equivalentUSD: amt,
          amountUSD: amt,
          date: c.date || c.createdAt || new Date().toISOString(),
          notes: c.notes || 'رأس مال مضاف',
          createdAt: c.createdAt || new Date().toISOString(),
        });
      }
      for (const r of oldReps) {
        migrated.push({
          id: r.id || 'rep_' + Math.random().toString(36).substring(2, 7),
          type: 'refund',
          partnerName: r.partnerName || 'الشريك',
          amount: r.amount,
          currency: r.currency || 'USD',
          exchangeRate: r.exchangeRate,
          equivalentUSD: r.equivalentUSD || r.amount,
          amountUSD: r.equivalentUSD || r.amount,
          date: r.date || r.createdAt || new Date().toISOString(),
          notes: r.notes || 'استرداد من رأس المال',
          createdAt: r.createdAt || new Date().toISOString(),
        });
      }
      this.savePartnerCapitalTransactions(migrated);
    }
  }

  private static verifyRestored(data: Record<string, any>): string | null {
    for (const c of this.backupCollections()) {
      if (!Array.isArray(data[c.name])) continue;
      const now = c.get();
      if (now.length !== data[c.name].length) return `عدد سجلات ${c.name} بعد الاستعادة (${now.length}) لا يطابق النسخة (${data[c.name].length})`;
      const idsNow = now.map((r: any) => r?.id).join('|');
      const idsBak = (data[c.name] as any[]).map((r: any) => r?.id).join('|');
      if (idsNow !== idsBak) return `معرّفات سجلات ${c.name} بعد الاستعادة لا تطابق النسخة`;
    }
    const expectedCap = data.auditSnapshot?.partnerCapitalUSD;
    if (typeof expectedCap === 'number') {
      const cap = this.getPartnerCapitalSummary().remainingCapitalUSD;
      if (Math.abs(cap - expectedCap) > 0.01) return `رأس مال الشريك بعد الاستعادة (${cap}) لا يطابق النسخة (${expectedCap})`;
    }
    return null;
  }

  static importBackup(jsonString: string): { success: boolean; message: string; safetyBackup?: string } {
    // 1) التحقق من الملف
    const v = this.validateBackup(jsonString);
    if (!v.ok || !v.data) return { success: false, message: v.message };
    const data = v.data;

    // 2) نسخة أمان من البيانات الحالية قبل أي تعديل - إن فشلت نتوقف ولا نستعيد
    let safety: string;
    try {
      safety = this.exportBackup();
      saveItem(STORAGE_KEYS.AUTO_BACKUP_SAFETY, safety);
    } catch (safetyErr) {
      console.error('Safety backup failed:', safetyErr);
      return { success: false, message: 'تعذر إنشاء نسخة أمان من البيانات الحالية، أُلغيت الاستعادة ولم يُحذف أي شيء' };
    }

    try {
      // 3) الاستعادة
      this.applyBackupData(data);
      // 4) التحقق من البيانات المستعادة
      const problem = this.verifyRestored(data);
      if (problem) {
        // تراجع تلقائي إلى نسخة الأمان
        this.applyBackupData(JSON.parse(safety));
        return { success: false, message: `فشل التحقق بعد الاستعادة وتم التراجع تلقائياً: ${problem}`, safetyBackup: safety };
      }
      this.triggerAutoBackup();
      void flushStorage();
      const counts = Object.entries(data.recordCounts || {})
        .map(([k, n]) => `${k}: ${n}`)
        .join(' | ');
      return {
        success: true,
        message: `تمت استعادة النسخة الاحتياطية والتحقق منها بنجاح.${counts ? ' (' + counts + ')' : ''}`,
        safetyBackup: safety,
      };
    } catch (err) {
      console.error('Failed to import backup:', err);
      try {
        this.applyBackupData(JSON.parse(safety));
      } catch {
        /* safety copy remains in storage */
      }
      return { success: false, message: 'حدث خطأ أثناء الاستعادة وتم التراجع إلى بياناتك السابقة', safetyBackup: safety };
    }
  }

  static resetToDefault(): void {
    this.saveSettings(initialSettings);
    this.saveProducts(initialProducts);
    this.saveCustomers(initialCustomers);
    this.saveInvoices(initialInvoices);
    this.savePurchaseInvoices(initialPurchaseInvoices);
    this.saveCustomerPayments(initialCustomerPayments);
    this.saveSuppliers(initialSuppliers);
    this.saveSupplierTransactions(initialSupplierTransactions);
    this.saveExpenses(initialExpenses);
    this.saveCashTransactions([]);
    this.saveUsdPurchases([]);
    this.saveGoodsWithdrawals([]);
    this.savePartnerCapitals([]);
    this.savePartnerCapitalRepayments([]);
    this.savePartnerCapitalTransactions([]);
  }
}
