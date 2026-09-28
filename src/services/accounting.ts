/**
 * accounting.ts
 * ---------------------------------------------------------------
 * منطق محاسبي نقي (Pure functions) بدون أي اعتماد على التخزين.
 * كل الدوال تأخذ البيانات كمعاملات، لذلك يمكن اختبارها مباشرة،
 * وتستدعيها طبقة LocalDatabase بالبيانات المخزنة في SQLite.
 *
 * مبادئ:
 *  - المبلغ الأصلي + العملة + سعر الصرف التاريخي لا يتغيّرون أبداً.
 *  - سعر الصرف الحالي يُستخدم فقط في "التقييم الحالي".
 */

export type Cur = 'USD' | 'SYP';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export const roundSYP = (n: number): number => Math.round(n);

// ------------------------------------------------------------------
// 1) تسوية فاتورة الشراء (عملتان + سعر صرف الفاتورة)
// ------------------------------------------------------------------
export interface SettlementInput {
  totalUSD: number; // منتجات مسعّرة بالدولار
  totalSYP: number; // منتجات مسعّرة بالليرة
  discountUSD?: number;
  discountSYP?: number;
  paidUSD: number;
  paidSYP: number;
  rate: number; // سعر صرف هذه الفاتورة فقط (ل.س لكل 1$)
}

export interface SettlementResult {
  netUSD: number; // بعد الخصم - بالدولار الأصلي
  netSYP: number; // بعد الخصم - بالليرة الأصلية
  totalEquivalentUSD: number; // netUSD + netSYP / rate
  paidUSD: number;
  paidSYP: number;
  // كم من دفعة الليرة غطّت المنتجات المسعّرة بالليرة
  sypCoveringSYPItems: number;
  // ما تبقّى من دفعة الليرة (بعد تغطية منتجات الليرة) وقيمته بالدولار
  sypLeftover: number;
  sypLeftoverAsUSD: number;
  paidSYPConvertedToUSD: number; // كامل دفعة الليرة بالدولار (بدون ازدواج)
  totalPaidEquivalentUSD: number;
  remainingDebtUSD: number; // دين للمورد
  supplierCreditUSD: number; // رصيد دائن / دفعة مقدمة
  status: 'paid' | 'partial' | 'credit' | 'unpaid';
}

export function computePurchaseSettlement(i: SettlementInput): SettlementResult {
  const rate = i.rate > 0 ? i.rate : 1;
  const netUSD = round2(Math.max(0, (i.totalUSD || 0) - (i.discountUSD || 0)));
  const netSYP = roundSYP(Math.max(0, (i.totalSYP || 0) - (i.discountSYP || 0)));
  const paidUSD = round2(Math.max(0, i.paidUSD || 0));
  const paidSYP = roundSYP(Math.max(0, i.paidSYP || 0));

  const totalEquivalentUSD = round2(netUSD + netSYP / rate);

  const sypCoveringSYPItems = Math.min(paidSYP, netSYP);
  const sypLeftover = paidSYP - sypCoveringSYPItems;
  const sypLeftoverAsUSD = round2(sypLeftover / rate);

  // لا ازدواج: الدفعة الكلية = دولار + (ليرة / السعر). (تغطية منتجات الليرة + الباقي = كامل دفعة الليرة)
  const paidSYPConvertedToUSD = round2(paidSYP / rate);
  const totalPaidEquivalentUSD = round2(paidUSD + paidSYPConvertedToUSD);

  const diff = round2(totalPaidEquivalentUSD - totalEquivalentUSD);
  const remainingDebtUSD = diff < 0 ? round2(-diff) : 0;
  const supplierCreditUSD = diff > 0 ? diff : 0;

  let status: SettlementResult['status'] = 'paid';
  if (totalPaidEquivalentUSD === 0 && totalEquivalentUSD > 0) status = 'unpaid';
  else if (remainingDebtUSD > 0) status = 'partial';
  else if (supplierCreditUSD > 0) status = 'credit';

  return {
    netUSD,
    netSYP,
    totalEquivalentUSD,
    paidUSD,
    paidSYP,
    sypCoveringSYPItems,
    sypLeftover,
    sypLeftoverAsUSD,
    paidSYPConvertedToUSD,
    totalPaidEquivalentUSD,
    remainingDebtUSD,
    supplierCreditUSD,
    status,
  };
}

/** مجموع بنود فاتورة شراء حسب عملة كل بند (بدون تحويل). */
export function sumPurchaseItemsByCurrency(
  items: Array<{ itemTotal: number; currency?: Cur }>,
  fallbackCurrency: Cur = 'USD'
): { totalUSD: number; totalSYP: number } {
  let usd = 0;
  let syp = 0;
  for (const it of items) {
    const c = it.currency || fallbackCurrency;
    if (c === 'USD') usd += it.itemTotal || 0;
    else syp += it.itemTotal || 0;
  }
  return { totalUSD: round2(usd), totalSYP: roundSYP(syp) };
}

// ------------------------------------------------------------------
// 2) سجل أسعار الصرف التاريخي
// ------------------------------------------------------------------
export interface RateRecord {
  id: string;
  exchangeRate: number;
  effectiveAt: string; // ISO
  source?: string;
}

/** سعر الصرف الساري في تاريخ معيّن (آخر سعر مسجّل قبل التاريخ) وإلا أقدم سعر وإلا fallback. */
export function rateAt(history: RateRecord[], dateISO: string | undefined, fallback: number): number {
  if (!history || history.length === 0) return fallback;
  const sorted = [...history].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt));
  if (!dateISO) return sorted[sorted.length - 1].exchangeRate;
  const t = new Date(dateISO).getTime();
  let found: RateRecord | undefined;
  for (const r of sorted) {
    if (new Date(r.effectiveAt).getTime() <= t) found = r;
    else break;
  }
  return (found || sorted[0]).exchangeRate || fallback;
}

// ------------------------------------------------------------------
// 3) FIFO لأساس تقييم الليرة بالدولار التاريخي
// ------------------------------------------------------------------
export interface FxEvent {
  date: string;
  amount: number; // + دخول / - خروج (بالليرة)
  rate: number; // سعر الصرف التاريخي وقت الحدث
}

export interface FxBasis {
  balanceSYP: number; // الرصيد الفعلي (قد يكون سالباً)
  historicalUSD: number; // القيمة التاريخية بالدولار للجزء الموجب المتبقي
  lots: Array<{ remainingSYP: number; rate: number; date: string }>;
}

export function fifoFxBasis(events: FxEvent[]): FxBasis {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const lots: Array<{ remainingSYP: number; rate: number; date: string }> = [];
  let balance = 0;
  for (const e of sorted) {
    balance += e.amount;
    if (e.amount > 0) {
      lots.push({ remainingSYP: e.amount, rate: e.rate > 0 ? e.rate : 1, date: e.date });
    } else if (e.amount < 0) {
      let out = -e.amount;
      for (const lot of lots) {
        if (out <= 0) break;
        const used = Math.min(lot.remainingSYP, out);
        lot.remainingSYP -= used;
        out -= used;
      }
    }
  }
  const live = lots.filter((l) => l.remainingSYP > 0);
  const historicalUSD = live.reduce((s, l) => s + l.remainingSYP / l.rate, 0);
  return { balanceSYP: balance, historicalUSD: round2(historicalUSD), lots: live };
}

export interface FxValuation {
  sypBalance: number;
  usdBalance: number;
  historicalUSD: number; // بأسعار الصرف التاريخية
  currentUSD: number; // بسعر اليوم
  fxEffectUSD: number; // current - historical
}

export function valueSypPosition(
  basis: FxBasis,
  usdBalance: number,
  currentRate: number
): FxValuation {
  const syp = basis.balanceSYP;
  // الجزء السالب (إن وُجد) لا أساس تاريخي له → يُقيَّم بسعر اليوم (أثر صفر)
  const negativeSYP = syp < 0 ? syp : 0;
  const historicalUSD = round2(basis.historicalUSD + usdBalance + negativeSYP / currentRate);
  const currentUSD = round2(syp / currentRate + usdBalance);
  return {
    sypBalance: syp,
    usdBalance,
    historicalUSD,
    currentUSD,
    fxEffectUSD: round2(currentUSD - historicalUSD),
  };
}

// ------------------------------------------------------------------
// 4) أرصدة العملاء: ديون بالليرة (FIFO) + ديون بالدولار
// ------------------------------------------------------------------
export interface CustInvoiceLite {
  id: string;
  invoiceNumber: string;
  customerId: string;
  date: string;
  currency: Cur;
  finalTotal: number;
  paidAmount: number;
  isFixedUSD?: boolean;
  fixedUSDAmount?: number;
  fixedExchangeRate?: number;
  exchangeRate?: number;
}
export interface CustPaymentLite {
  id: string;
  customerId: string;
  amount: number;
  currency: Cur;
  date: string;
  exchangeRate?: number;
}
export interface CustomerLite {
  id: string;
  name: string;
  shopName?: string;
  initialDebt: number;
  initialDebtUSD?: number;
  currency: Cur;
  createdAt?: string;
}

export interface PartyAuditRow {
  id: string;
  name: string;
  sub?: string;
  sypBalance: number;
  usdBalance: number;
  historicalUSD: number;
  currentUSD: number;
  fxEffectUSD: number;
  lastInvoiceDate?: string;
  lastInvoiceNumber?: string;
  lastPaymentDate?: string;
  lastPaymentText?: string;
}

export function customerAuditRow(
  c: CustomerLite,
  invoices: CustInvoiceLite[],
  payments: CustPaymentLite[],
  history: RateRecord[],
  currentRate: number
): PartyAuditRow {
  const myInv = invoices.filter((i) => i.customerId === c.id);
  const myPay = payments.filter((p) => p.customerId === c.id);

  const events: FxEvent[] = [];
  let usd = c.currency === 'USD' ? c.initialDebt || 0 : c.initialDebtUSD || 0;
  const openingSYP = c.currency === 'USD' ? 0 : c.initialDebt || 0;
  const openingDate = c.createdAt || '0000-01-01T00:00:00.000Z';
  if (openingSYP !== 0) {
    events.push({ date: openingDate, amount: openingSYP, rate: rateAt(history, openingDate, currentRate) });
  }

  for (const inv of myInv) {
    if (inv.isFixedUSD && inv.fixedUSDAmount) {
      const r = inv.fixedExchangeRate || inv.exchangeRate || currentRate;
      const paidUSD = inv.paidAmount > 0 ? inv.paidAmount / (inv.currency === 'USD' ? 1 : r) : 0;
      usd += Math.max(0, inv.fixedUSDAmount - paidUSD);
    } else if (inv.currency === 'USD') {
      usd += Math.max(0, (inv.finalTotal || 0) - (inv.paidAmount || 0));
    } else {
      const rem = Math.max(0, (inv.finalTotal || 0) - (inv.paidAmount || 0));
      if (rem > 0) {
        events.push({
          date: inv.date,
          amount: rem,
          rate: inv.exchangeRate || inv.fixedExchangeRate || rateAt(history, inv.date, currentRate),
        });
      }
    }
  }
  for (const p of myPay) {
    if (p.currency === 'USD') usd -= p.amount || 0;
    else events.push({ date: p.date, amount: -(p.amount || 0), rate: p.exchangeRate || rateAt(history, p.date, currentRate) });
  }

  const basis = fifoFxBasis(events);
  const val = valueSypPosition(basis, round2(usd), currentRate);

  const lastInv = [...myInv].sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastPay = [...myPay].sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    id: c.id,
    name: c.name,
    sub: c.shopName,
    sypBalance: val.sypBalance,
    usdBalance: val.usdBalance,
    historicalUSD: val.historicalUSD,
    currentUSD: val.currentUSD,
    fxEffectUSD: val.fxEffectUSD,
    lastInvoiceDate: lastInv?.date,
    lastInvoiceNumber: lastInv?.invoiceNumber,
    lastPaymentDate: lastPay?.date,
    lastPaymentText: lastPay ? `${(lastPay.amount || 0).toLocaleString('en-US')} ${lastPay.currency}` : undefined,
  };
}

// ------------------------------------------------------------------
// 5) كشف حساب المورد بالدولار (رصيد بعد كل حركة)
// ------------------------------------------------------------------
export interface SupplierLite {
  id: string;
  name: string;
  company?: string;
  initialDebt: number;
  initialDebtUSD?: number;
  currency: Cur;
  createdAt?: string;
}

export interface PurchaseLite {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  date: string;
  currency: Cur | 'MIXED';
  finalTotal: number;
  paidAmount: number;
  remainingDebt?: number;
  invoiceExchangeRate?: number;
  totalUSD?: number;
  totalSYP?: number;
  totalEquivalentUSD?: number;
  paidUSD?: number;
  paidSYP?: number;
  remainingDebtUSD?: number;
  supplierCreditUSD?: number;
}

export interface SupplierTxLite {
  id: string;
  supplierId: string;
  type: 'purchase' | 'payment';
  amount: number;
  currency: Cur;
  date: string;
  invoiceId?: string;
  invoiceNumber?: string;
  exchangeRate?: number;
  amountUSD?: number;
}

export interface SupplierStatementRow {
  key: string;
  date: string;
  kind: 'opening' | 'invoice' | 'payment' | 'manual_purchase';
  ref: string;
  purchaseUSD: number; // قيمة المشتريات بالدولار المعادل (بسعر الفاتورة)
  purchaseOrigUSD: number;
  purchaseOrigSYP: number;
  paidOrigUSD: number;
  paidOrigSYP: number;
  creditUSD: number; // رصيد دائن ناتج
  debtUSD: number; // دين ناتج
  rate?: number;
  movementUSD: number; // + يزيد دين المورد ، - يخفضه
  balanceAfterUSD: number;
}

/** هل الفاتورة بالنموذج الجديد (عملتان)؟ */
export const isMultiCurrencyInvoice = (p: PurchaseLite) =>
  p.remainingDebtUSD !== undefined || p.supplierCreditUSD !== undefined;

export function supplierStatement(
  s: SupplierLite,
  purchases: PurchaseLite[],
  txs: SupplierTxLite[],
  currentRate: number,
  history: RateRecord[] = []
): { rows: SupplierStatementRow[]; balanceUSD: number; sypLegacyBalance: number } {
  const raw: Array<Omit<SupplierStatementRow, 'balanceAfterUSD'>> = [];

  const openUSD = s.currency === 'USD' ? s.initialDebt || 0 : s.initialDebtUSD || 0;
  const openSYP = s.currency === 'USD' ? 0 : s.initialDebt || 0;
  const openRate = rateAt(history, s.createdAt, currentRate);
  if (openUSD !== 0 || openSYP !== 0) {
    raw.push({
      key: 'opening',
      date: s.createdAt || '0000-01-01T00:00:00.000Z',
      kind: 'opening',
      ref: 'رصيد افتتاحي',
      purchaseUSD: 0,
      purchaseOrigUSD: openUSD,
      purchaseOrigSYP: openSYP,
      paidOrigUSD: 0,
      paidOrigSYP: 0,
      creditUSD: 0,
      debtUSD: 0,
      rate: openSYP ? openRate : undefined,
      movementUSD: round2(openUSD + openSYP / openRate),
    });
  }

  for (const p of purchases.filter((x) => x.supplierId === s.id)) {
    if (isMultiCurrencyInvoice(p)) {
      const r = p.invoiceExchangeRate || currentRate;
      const eq = p.totalEquivalentUSD ?? round2((p.totalUSD || 0) + (p.totalSYP || 0) / r);
      raw.push({
        key: p.id,
        date: p.date,
        kind: 'invoice',
        ref: p.invoiceNumber,
        purchaseUSD: eq,
        purchaseOrigUSD: p.totalUSD || 0,
        purchaseOrigSYP: p.totalSYP || 0,
        paidOrigUSD: p.paidUSD || 0,
        paidOrigSYP: p.paidSYP || 0,
        creditUSD: p.supplierCreditUSD || 0,
        debtUSD: p.remainingDebtUSD || 0,
        rate: r,
        movementUSD: round2((p.remainingDebtUSD || 0) - (p.supplierCreditUSD || 0)),
      });
    } else {
      // فاتورة قديمة بعملة واحدة
      const rem = p.remainingDebt !== undefined ? p.remainingDebt : Math.max(0, (p.finalTotal || 0) - (p.paidAmount || 0));
      const isUSD = p.currency === 'USD';
      const r = p.invoiceExchangeRate || rateAt(history, p.date, currentRate);
      raw.push({
        key: p.id,
        date: p.date,
        kind: 'invoice',
        ref: p.invoiceNumber,
        purchaseUSD: isUSD ? p.finalTotal : round2(p.finalTotal / r),
        purchaseOrigUSD: isUSD ? p.finalTotal : 0,
        purchaseOrigSYP: isUSD ? 0 : p.finalTotal,
        paidOrigUSD: isUSD ? p.paidAmount : 0,
        paidOrigSYP: isUSD ? 0 : p.paidAmount,
        creditUSD: 0,
        debtUSD: isUSD ? rem : round2(rem / r),
        rate: r,
        movementUSD: isUSD ? rem : round2(rem / r),
      });
    }
  }

  for (const t of txs.filter((x) => x.supplierId === s.id)) {
    const r = t.exchangeRate || rateAt(history, t.date, currentRate);
    const usdVal = t.amountUSD !== undefined ? t.amountUSD : t.currency === 'USD' ? t.amount : round2(t.amount / r);
    const isPay = t.type === 'payment';
    raw.push({
      key: t.id,
      date: t.date,
      kind: isPay ? 'payment' : 'manual_purchase',
      ref: t.invoiceNumber || (isPay ? 'دفعة' : 'قيد مشتريات'),
      purchaseUSD: isPay ? 0 : usdVal,
      purchaseOrigUSD: !isPay && t.currency === 'USD' ? t.amount : 0,
      purchaseOrigSYP: !isPay && t.currency === 'SYP' ? t.amount : 0,
      paidOrigUSD: isPay && t.currency === 'USD' ? t.amount : 0,
      paidOrigSYP: isPay && t.currency === 'SYP' ? t.amount : 0,
      creditUSD: 0,
      debtUSD: 0,
      rate: t.currency === 'SYP' ? r : undefined,
      movementUSD: isPay ? -Math.abs(usdVal) : Math.abs(usdVal),
    });
  }

  raw.sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  const rows: SupplierStatementRow[] = raw.map((r) => {
    bal = round2(bal + r.movementUSD);
    return { ...r, balanceAfterUSD: bal };
  });
  return { rows, balanceUSD: bal, sypLegacyBalance: 0 };
}

export function supplierAuditRow(
  s: SupplierLite,
  purchases: PurchaseLite[],
  txs: SupplierTxLite[],
  currentRate: number,
  history: RateRecord[]
): PartyAuditRow {
  const st = supplierStatement(s, purchases, txs, currentRate, history);
  // دين المورد مثبّت بالدولار بعد تسوية الفاتورة → لا يتأثر بسعر الليرة
  const last = (arr: SupplierStatementRow[]) => arr[arr.length - 1];
  const invs = st.rows.filter((r) => r.kind === 'invoice');
  const pays = st.rows.filter((r) => r.kind === 'payment' || r.paidOrigUSD > 0 || r.paidOrigSYP > 0);
  const lastInv = last(invs);
  const lastPay = last(pays);
  const sypBal = st.rows.reduce(
    (a, r) => a + (r.kind === 'opening' ? r.purchaseOrigSYP : 0),
    0
  );
  return {
    id: s.id,
    name: s.name,
    sub: s.company,
    sypBalance: sypBal,
    usdBalance: round2(st.balanceUSD - sypBal / (rateAt(history, s.createdAt, currentRate) || 1)),
    historicalUSD: st.balanceUSD,
    currentUSD: st.balanceUSD,
    fxEffectUSD: 0,
    lastInvoiceDate: lastInv?.date,
    lastInvoiceNumber: lastInv?.ref,
    lastPaymentDate: lastPay?.date,
    lastPaymentText: lastPay
      ? [
          lastPay.paidOrigUSD ? `${lastPay.paidOrigUSD.toLocaleString('en-US')} USD` : '',
          lastPay.paidOrigSYP ? `${lastPay.paidOrigSYP.toLocaleString('en-US')} SYP` : '',
        ]
          .filter(Boolean)
          .join(' + ')
      : undefined,
  };
}

// ------------------------------------------------------------------
// 6) تجميع تقرير أثر سعر الصرف
// ------------------------------------------------------------------
export interface FxEffectReport {
  currentRate: number;
  previousRate: number | null;
  cash: FxValuation;
  customers: { historicalUSD: number; currentUSD: number; fxEffectUSD: number };
  suppliers: { historicalUSD: number; currentUSD: number; fxEffectUSD: number };
  inventorySYP: { valueSYP: number; historicalUSD: number; currentUSD: number; fxEffectUSD: number };
  totalFxEffectUSD: number; // أثر صافي على قيمة المشروع
}

export function buildFxEffectReport(args: {
  currentRate: number;
  previousRate: number | null;
  cash: FxValuation;
  customerRows: PartyAuditRow[];
  supplierRows: PartyAuditRow[];
  inventorySYPValue: number;
  inventorySYPHistoricalUSD: number;
}): FxEffectReport {
  const sum = (rows: PartyAuditRow[], k: 'historicalUSD' | 'currentUSD' | 'fxEffectUSD') =>
    round2(rows.reduce((a, r) => a + r[k], 0));
  const invCur = round2(args.inventorySYPValue / args.currentRate);
  const inv = {
    valueSYP: args.inventorySYPValue,
    historicalUSD: round2(args.inventorySYPHistoricalUSD),
    currentUSD: invCur,
    fxEffectUSD: round2(invCur - args.inventorySYPHistoricalUSD),
  };
  const cust = {
    historicalUSD: sum(args.customerRows, 'historicalUSD'),
    currentUSD: sum(args.customerRows, 'currentUSD'),
    fxEffectUSD: sum(args.customerRows, 'fxEffectUSD'),
  };
  const supp = {
    historicalUSD: sum(args.supplierRows, 'historicalUSD'),
    currentUSD: sum(args.supplierRows, 'currentUSD'),
    fxEffectUSD: sum(args.supplierRows, 'fxEffectUSD'),
  };
  // الأصول (نقد + عملاء + مخزون ليرة) تنقص بارتفاع الدولار ؛ التزامات المورد بالدولار ثابتة
  const total = round2(args.cash.fxEffectUSD + cust.fxEffectUSD + inv.fxEffectUSD - supp.fxEffectUSD);
  return {
    currentRate: args.currentRate,
    previousRate: args.previousRate,
    cash: args.cash,
    customers: cust,
    suppliers: supp,
    inventorySYP: inv,
    totalFxEffectUSD: total,
  };
}

// ------------------------------------------------------------------
// 7) رأس مال الشريك
// ------------------------------------------------------------------
export function partnerCapitalBalanceUSD(
  txs: Array<{ type: 'deposit' | 'refund'; equivalentUSD?: number; amountUSD?: number; amount: number; currency: Cur }>
): number {
  let bal = 0;
  for (const t of txs) {
    const v = t.equivalentUSD ?? t.amountUSD ?? (t.currency === 'USD' ? t.amount : 0);
    bal += t.type === 'deposit' ? v : -v;
  }
  return round2(bal);
}

// ------------------------------------------------------------------
// 8) بصمة نسخة احتياطية (FNV-1a) للتحقق من سلامة الملف
// ------------------------------------------------------------------
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
