/**
 * اختبارات المحاسبة متعددة العملات - تشغيل: npm run test:accounting
 * تعمل على LocalDatabase الفعلية (بديل localStorage في Node).
 */
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

import { LocalDatabase as DB } from '../src/services/db';
import { computePurchaseSettlement } from '../src/services/accounting';
import { initialSettings } from '../src/services/seedData';
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;
const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;
function check(name: string, cond: boolean, detail = '') {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
}

function setRate(rate: number, extra: Record<string, any> = {}) {
  DB.saveSettings({ ...DB.getSettings(), ...initialSettings, exchangeRate: rate, ...extra } as any);
}

// ---------- إعداد ----------
mem.clear();
setRate(13000);
const prod = DB.addProduct({
  name: 'منتج اختبار', unit: 'كرتونة', piecesPerCarton: 1, costCurrency: 'USD', purchaseCost: 0,
  totalPiecesInStock: 0,
} as any);
const supp = DB.addSupplier({ name: 'مورد 1', company: 'شركة', phone: '', initialDebt: 0, currency: 'USD' } as any);
const supp2 = DB.addSupplier({ name: 'مورد 2', company: '', phone: '', initialDebt: 0, currency: 'USD' } as any);

function makePurchase(supplierId: string, usdItems: number, sypItems: number, paidUSD: number, paidSYP: number, rate: number, no: string) {
  const items: any[] = [];
  if (usdItems) items.push({ productId: prod.id, productName: prod.name, unit: 'كرتونة', piecesPerCarton: 1, cartons: 1, pieces: 0, totalPieces: 1, costPerCarton: usdItems, currency: 'USD', itemTotal: usdItems, exchangeRate: rate });
  if (sypItems) items.push({ productId: prod.id, productName: prod.name, unit: 'كرتونة', piecesPerCarton: 1, cartons: 1, pieces: 0, totalPieces: 1, costPerCarton: sypItems, currency: 'SYP', itemTotal: sypItems, exchangeRate: rate });
  const st = computePurchaseSettlement({ totalUSD: usdItems, totalSYP: sypItems, paidUSD, paidSYP, rate });
  return DB.createPurchaseInvoice({
    invoiceNumber: no, supplierId, supplierName: 'x', date: new Date().toISOString(),
    currency: usdItems && sypItems ? 'MIXED' : usdItems ? 'USD' : 'SYP',
    invoiceExchangeRate: rate, items, subtotal: st.totalEquivalentUSD, discount: 0, finalTotal: st.totalEquivalentUSD,
    totalUSD: usdItems, totalSYP: sypItems, totalEquivalentUSD: st.totalEquivalentUSD,
    paidAmount: st.totalPaidEquivalentUSD, paidSYP, paidUSD,
    paidSYPConvertedToUSD: st.paidSYPConvertedToUSD, totalPaidEquivalentUSD: st.totalPaidEquivalentUSD,
    remainingDebtUSD: st.remainingDebtUSD, supplierCreditUSD: st.supplierCreditUSD, remainingDebt: st.remainingDebtUSD,
  } as any);
}

// ---------- TEST 1 ----------
const inv1 = makePurchase(supp.id, 1500, 10_000_000, 0, 0, 13000, 'PUR-T1');
const stored1 = DB.getPurchaseInvoices().find((i) => i.id === inv1.id)!;
check('T1 العملتان محفوظتان منفصلتين', stored1.totalUSD === 1500 && stored1.totalSYP === 10_000_000 && stored1.invoiceExchangeRate === 13000);
check('T1 بنود الفاتورة تحتفظ بعملتها الأصلية', stored1.items[0].currency === 'USD' && stored1.items[1].currency === 'SYP');
const batches = DB.getInventoryBatches().filter((b) => b.purchaseInvoiceId === inv1.id);
check('T1 دفعات المخزون بالعملة الأصلية وسعر الشراء', batches.length === 2 && batches[0].currency === 'USD' && batches[1].currency === 'SYP' && batches.every((b) => b.exchangeRate === 13000));
check('T1 الإجمالي المعادل 2269.23$', near(stored1.totalEquivalentUSD, 2269.23));

// ---------- TEST 2 ----------
const s2 = computePurchaseSettlement({ totalUSD: 1500, totalSYP: 10_000_000, paidUSD: 500, paidSYP: 30_000_000, rate: 13000 });
check('T2 دفعة الليرة 30م = 2307.69$ بلا ازدواج', near(s2.paidSYPConvertedToUSD, 2307.69));
check('T2 10م غطّت منتجات الليرة والباقي 20م = 1538.46$', s2.sypCoveringSYPItems === 10_000_000 && s2.sypLeftover === 20_000_000 && near(s2.sypLeftoverAsUSD, 1538.46));
check('T2 إجمالي المدفوع المعادل = 2807.69$', near(s2.totalPaidEquivalentUSD, 2807.69), String(s2.totalPaidEquivalentUSD));

// ---------- TEST 3 ----------
const suppB = DB.addSupplier({ name: 'مورد 3', company: '', phone: '', initialDebt: 0, currency: 'USD' } as any);
makePurchase(suppB.id, 1500, 10_000_000, 300, 10_000_000, 13000, 'PUR-T3');
const s3 = computePurchaseSettlement({ totalUSD: 1500, totalSYP: 10_000_000, paidUSD: 300, paidSYP: 10_000_000, rate: 13000 });
check('T3 المتبقي = 2269.23 - (300 + 769.23) = 1200$', near(s3.remainingDebtUSD, 1200), String(s3.remainingDebtUSD));
check('T3 رصيد المورد بالدولار = 1200', near(DB.getSupplierBalance(suppB.id), 1200), String(DB.getSupplierBalance(suppB.id)));

// ---------- TEST 4 ----------
const suppC = DB.addSupplier({ name: 'مورد 4', company: '', phone: '', initialDebt: 0, currency: 'USD' } as any);
makePurchase(suppC.id, 1500, 10_000_000, 500, 30_000_000, 13000, 'PUR-T4');
check('T4 الدفع الزائد = رصيد دائن 538.46$ (رصيد المورد -538.46)', near(DB.getSupplierBalance(suppC.id), -538.46), String(DB.getSupplierBalance(suppC.id)));
check('T4 supplierCreditUSD محفوظ بالفاتورة', near(DB.getPurchaseInvoices().find((i) => i.invoiceNumber === 'PUR-T4')!.supplierCreditUSD, 538.46));

// ---------- TEST 5 ----------
const suppD = DB.addSupplier({ name: 'مورد 5', company: '', phone: '', initialDebt: 0, currency: 'USD' } as any);
makePurchase(suppD.id, 2000, 0, 1200, 0, 13000, 'PUR-T5');
check('T5 الدفع الناقص يصبح دين 800$', near(DB.getSupplierBalance(suppD.id), 800));
// دفعة لاحقة بالليرة تُسجَّل بسعرها التاريخي
DB.addSupplierTransaction({ supplierId: suppD.id, supplierName: 'x', type: 'payment', amount: 6_500_000, currency: 'SYP', date: new Date().toISOString() } as any);
check('T5b دفعة 6.5م ل.س بسعر 13000 تخفض الدين 500$ → 300$', near(DB.getSupplierBalance(suppD.id), 300));

// ---------- TEST 9 (قبل تغيير السعر) ----------
const suppE = DB.addSupplier({ name: 'مورد 9', company: '', phone: '', initialDebt: 0, currency: 'USD' } as any);
makePurchase(suppE.id, 3000, 0, 0, 0, 13000, 'PUR-T9');

// ---------- TEST 7/8 إعداد: دين عميل + نقد ----------
const cust = DB.addCustomer({ name: 'عطايا', phone: '', shopName: '', address: '', initialDebt: 0, currency: 'SYP' } as any);
DB.createInvoice({
  invoiceNumber: 'INV-T7', customerId: cust.id, customerName: 'عطايا', date: new Date().toISOString(), currency: 'SYP',
  items: [{ productId: prod.id, productName: prod.name, unit: 'كرتونة', piecesPerCarton: 1, cartons: 1, pieces: 0, totalPieces: 1, unitPrice: 5_000_000, priceType: 'carton', itemTotal: 5_000_000 }],
  subtotal: 5_000_000, discount: 0, finalTotal: 5_000_000, paidAmount: 0, remainingDebt: 5_000_000,
} as any);
setRate(13000, { initialCashSYP: 20_000_000 }); // نقد افتتاحي 20م عند 13000 (لا يغير سجل الأسعار الحالي)
const before = DB.getCustomerAudit().rows.find((r) => r.id === cust.id)!;

// ---------- TEST 6 ----------
const histRateBefore = DB.getPurchaseInvoices().find((i) => i.id === inv1.id)!.invoiceExchangeRate;
setRate(14000, { initialCashSYP: 20_000_000 });
const histRateAfter = DB.getPurchaseInvoices().find((i) => i.id === inv1.id)!.invoiceExchangeRate;
check('T6 الفاتورة القديمة ما زالت 13000 بعد تغيير السعر إلى 14000', histRateBefore === 13000 && histRateAfter === 13000);
check('T6 دفعات المخزون ما زالت بسعر 13000', DB.getInventoryBatches().filter((b) => b.purchaseInvoiceId === inv1.id).every((b) => b.exchangeRate === 13000));
check('T6 سجل أسعار الصرف يحفظ 13000 ثم 14000', DB.getExchangeRateHistory().map((h) => h.exchangeRate).join(',') === '13000,14000', DB.getExchangeRateHistory().map((h) => h.exchangeRate).join(','));

// ---------- TEST 7 ----------
const after = DB.getCustomerAudit().rows.find((r) => r.id === cust.id)!;
check('T7 قبل التغيير: 384.62$', near(before.currentUSD, 384.62), String(before.currentUSD));
check('T7 الدين الأصلي ما زال 5,000,000 ل.س', after.sypBalance === 5_000_000);
check('T7 التقييم التاريخي 384.62$ والحالي 357.14$', near(after.historicalUSD, 384.62) && near(after.currentUSD, 357.14), `${after.historicalUSD} / ${after.currentUSD}`);
check('T7 أثر الصرف = -27.48$', near(after.fxEffectUSD, -27.48), String(after.fxEffectUSD));
const invAfter = DB.getInvoices().find((i) => i.invoiceNumber === 'INV-T7')!;
check('T7 فاتورة البيع لم تتغير', invAfter.finalTotal === 5_000_000 && invAfter.exchangeRate === 13000);

// ---------- TEST 9 ----------
check('T9 دين المورد يبقى 3000$ رغم تغيير سعر الليرة', near(DB.getSupplierBalance(suppE.id), 3000));

// ---------- TEST 10 / 11 ----------
const ca = DB.getCustomerAudit();
check('T10 جرد العملاء يعرض العميل والإجماليات', ca.rows.some((r) => r.id === cust.id) && near(ca.totalCurrentUSD, ca.rows.reduce((a, r) => a + r.currentUSD, 0)));
const sa = DB.getSupplierAudit();
check('T11 جرد الموردين يعرض كل الموردين', sa.rows.length >= 5);
const expectedTotal = [supp, suppB, suppC, suppD, suppE, supp2].reduce((a, s) => a + DB.getSupplierBalance(s.id), 0);
check('T11 إجمالي الذمم الدائنة = مجموع الأرصدة', near(sa.totalPayablesUSD, expectedTotal), `${sa.totalPayablesUSD} vs ${expectedTotal}`);

// ---------- TEST 12 / 13 ----------
check('T12 رأس المال يبدأ من صفر', DB.getPartnerCapitalSummary().remainingCapitalUSD === 0);
DB.addPartnerCapitalTransaction({ type: 'deposit', partnerName: 'ش', amount: 5000, currency: 'USD', equivalentUSD: 5000, date: new Date().toISOString() } as any);
DB.addPartnerCapitalTransaction({ type: 'refund', partnerName: 'ش', amount: 500, currency: 'USD', equivalentUSD: 500, date: new Date().toISOString() } as any);
check('T12 5000 - 500 = 4500', DB.getPartnerCapitalSummary().remainingCapitalUSD === 4500);

// ---------- TEST 14 (نسخة احتياطية) ----------
const backupStr = DB.exportBackup();
const snapshot = {
  purchases: JSON.stringify(DB.getPurchaseInvoices()),
  invoices: JSON.stringify(DB.getInvoices()),
  rates: JSON.stringify(DB.getExchangeRateHistory()),
  batches: JSON.stringify(DB.getInventoryBatches()),
  cap: DB.getPartnerCapitalSummary().remainingCapitalUSD,
  supplierBal: DB.getSupplierBalance(suppE.id),
};
// عطّل البيانات الحالية
DB.savePurchaseInvoices([]); DB.saveInvoices([]); DB.saveInventoryBatches([]); DB.savePartnerCapitalTransactions([]);
const res = DB.importBackup(backupStr);
check('T14 الاستعادة نجحت مع نسخة أمان', res.success && !!res.safetyBackup, res.message);
check('T14 الفواتير والأسعار التاريخية عادت كما هي', JSON.stringify(DB.getPurchaseInvoices()) === snapshot.purchases && JSON.stringify(DB.getInvoices()) === snapshot.invoices && JSON.stringify(DB.getExchangeRateHistory()) === snapshot.rates && JSON.stringify(DB.getInventoryBatches()) === snapshot.batches);
check('T14 رأس المال ورصيد المورد عادا', DB.getPartnerCapitalSummary().remainingCapitalUSD === snapshot.cap && near(DB.getSupplierBalance(suppE.id), snapshot.supplierBal));
const bad = JSON.parse(backupStr); bad.purchaseInvoices[0].totalUSD = 1;
check('T14 ملف معدَّل (checksum) يُرفض دون المساس بالبيانات', !DB.importBackup(JSON.stringify(bad)).success && DB.getPurchaseInvoices().length === JSON.parse(snapshot.purchases).length);
check('T14 ملف تالف يُرفض', !DB.importBackup('{not json').success);

// ---------- TEST 13 (حذف كل معاملات رأس المال) ----------
DB.getPartnerCapitalTransactions().slice().forEach((t) => DB.deletePartnerCapitalTransaction(t.id));
check('T13 حذف كل المعاملات → رأس المال 0', DB.getPartnerCapitalSummary().remainingCapitalUSD === 0 && DB.getPartnerCapitalTransactions().length === 0);

// ---------- TEST 15 ----------
const oldInv = DB.getInvoices().find((i) => i.invoiceNumber === 'INV-T7')!;
DB.updateInvoice({ ...oldInv, exchangeRate: 14000, notes: 'edit' } as any);
check('T15 سعر الصرف وقت البيع محفوظ (13000) حتى بعد التعديل', DB.getInvoices().find((i) => i.invoiceNumber === 'INV-T7')!.exchangeRate === 13000);

// ---------- TEST 16 ----------
const printFiles = ['src/components/sales/ThermalReceipt.tsx', 'src/services/bluetoothPrinter.ts'];
const printed = printFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
const pdfSrc = readFileSync('src/services/pdfExport.ts', 'utf8');
const invHtml = pdfSrc.slice(pdfSrc.indexOf('export const buildInvoiceHtml'), pdfSrc.indexOf('export const generateInvoicePdfDoc'));
const leak = /سعر الصرف|سعر التثبيت|exchangeRate\s*\}|\$\{[^}]*(exchangeRate|fixedExchangeRate)[^}]*\}|\$\{rate/;
check('T16 لا يُطبع سعر الصرف في الإيصال الحراري', !leak.test(printed.replace(/\/\/.*$/gm, '')));
check('T16 لا يظهر سعر الصرف في PDF فاتورة العميل', !leak.test(invHtml.replace(/\/\/.*$/gm, '')));

// ---------- إضافي: عدم وجود 5000 ثابتة ----------
const dbSrc = readFileSync('src/services/db.ts', 'utf8');
check('لا يوجد رأس مال افتراضي (cap_initial_5000) في الكود', !/cap_initial_5000/.test(dbSrc));
// تكلفة FIFO عبر دفعتين بعملتين
setRate(14000);
const p2 = DB.addProduct({ name: 'FIFO', unit: 'ك', piecesPerCarton: 1, costCurrency: 'USD', purchaseCost: 0, totalPiecesInStock: 0 } as any);
const mk = (cur: 'USD' | 'SYP', cost: number, rate: number) => DB.createPurchaseInvoice({ invoiceNumber: 'F' + cur, supplierId: supp.id, supplierName: 'x', date: new Date(Date.now() + (cur === 'USD' ? 0 : 1000)).toISOString(), currency: cur, invoiceExchangeRate: rate, items: [{ productId: p2.id, productName: 'FIFO', unit: 'ك', piecesPerCarton: 1, cartons: 1, pieces: 0, totalPieces: 1, costPerCarton: cost, currency: cur, itemTotal: cost, exchangeRate: rate }], subtotal: cost, discount: 0, finalTotal: cost, totalUSD: cur === 'USD' ? cost : 0, totalSYP: cur === 'SYP' ? cost : 0, totalEquivalentUSD: cur === 'USD' ? cost : cost / rate, paidAmount: 0, paidSYP: 0, paidUSD: 0, remainingDebtUSD: 0, supplierCreditUSD: 0 } as any);
mk('USD', 100, 13000); mk('SYP', 1_400_000, 14000);
const sale = DB.createInvoice({ invoiceNumber: 'INV-F', customerId: cust.id, customerName: 'x', date: new Date().toISOString(), currency: 'USD', items: [{ productId: p2.id, productName: 'FIFO', unit: 'ك', piecesPerCarton: 1, cartons: 2, pieces: 0, totalPieces: 2, unitPrice: 200, priceType: 'carton', itemTotal: 400 }], subtotal: 400, discount: 0, finalTotal: 400, paidAmount: 400, remainingDebt: 0 } as any);
const it = sale.items[0] as any;
check('FIFO: التكلفة الأصلية 100$ + 1,400,000 ل.س من الدفعتين', it.costUSDOriginal === 100 && it.costSYPOriginal === 1_400_000, JSON.stringify([it.costUSDOriginal, it.costSYPOriginal]));
check('FIFO: التكلفة بعملة الفاتورة = 100 + 1.4م/14000 = 200$', near(it.totalCostAtSale, 200));

// ---------- TEST 8 (بيئة معزولة: صندوق 20م ل.س فقط) ----------
mem.clear();
setRate(13000, { initialCashSYP: 20_000_000, initialCashUSD: 0 });
console.log('DBG', JSON.stringify(DB.getCashBoxUnifiedLedger()), [...mem.keys()].join(','));
const c13 = DB.getExchangeRateEffectReport().cash;
setRate(14000, { initialCashSYP: 20_000_000, initialCashUSD: 0 });
const c14 = DB.getExchangeRateEffectReport();
check('T8 رصيد الصندوق بالليرة لم يتغير (20م)', c13.sypBalance === 20_000_000 && c14.cash.sypBalance === 20_000_000);
check('T8 قيمة الصندوق: 1538.46$ ← 1428.57$', near(c13.currentUSD, 1538.46) && near(c14.cash.currentUSD, 1428.57), `${c13.currentUSD} → ${c14.cash.currentUSD}`);
check('T8 أثر الصرف على الصندوق -109.89$ (تاريخي 1538.46$)', near(c14.cash.fxEffectUSD, -109.89) && near(c14.cash.historicalUSD, 1538.46), String(c14.cash.fxEffectUSD));
// سيناريو البند 13: صندوق 20م + دين مورد 3000$
const sp = DB.addSupplier({ name: 's', company: '', phone: '', initialDebt: 3000, currency: 'USD' } as any);
const net14 = DB.getExchangeRateEffectReport().cash.currentUSD - DB.getSupplierBalance(sp.id);
setRate(13000, { initialCashSYP: 20_000_000, initialCashUSD: 0 });
const net13 = DB.getExchangeRateEffectReport().cash.currentUSD - DB.getSupplierBalance(sp.id);
check('T8b صافي المركز: 13000 → -1461.54$ ، 14000 → -1571.43$ والدين ثابت 3000$', near(net13, -1461.54) && near(net14, -1571.43), `${net13.toFixed(2)} / ${net14.toFixed(2)}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
