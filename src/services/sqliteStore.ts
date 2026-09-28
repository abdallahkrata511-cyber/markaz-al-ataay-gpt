/**
 * sqliteStore.ts
 * ---------------------------------------------------------------
 * طبقة التخزين. على أندرويد (Capacitor) قاعدة SQLite هي المصدر الأساسي للحقيقة:
 *   - عند الإقلاع: تُنشأ الجداول (migrations آمنة) ثم تُحمّل كل السجلات إلى ذاكرة سريعة.
 *   - عند أي حفظ: يُحدَّث الكاش فوراً (واجهة LocalDatabase متزامنة) ثم يُكتب فرق
 *     التغييرات فقط إلى SQLite داخل transaction واحدة (INSERT/UPDATE/DELETE للصفوف المتغيرة).
 *   - عند أول تشغيل بعد الترقية: تُرحَّل بيانات localStorage القديمة إلى SQLite دون حذفها.
 * على المتصفح (تطوير فقط) يُستخدم localStorage كبديل.
 * إذا فشل فتح SQLite على الجهاز يتوقف الإقلاع الآمن بدلاً من خلط SQLite مع localStorage.
 */
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'alataya_accounting';
export const SCHEMA_VERSION = 3;

/** مفتاح التخزين → جدول SQLite. (المفاتيح غير المدرجة تذهب إلى app_kv) */
export const COLLECTION_TABLES: Record<string, { table: string; sort: 'asc' | 'desc' }> = {
  al_ataya_products_v1: { table: 'products', sort: 'desc' },
  al_ataya_customers_v1: { table: 'customers', sort: 'desc' },
  al_ataya_invoices_v1: { table: 'sales_invoices', sort: 'desc' },
  al_ataya_purchase_invoices_v1: { table: 'purchase_invoices', sort: 'desc' },
  al_ataya_inventory_batches_v1: { table: 'inventory_batches', sort: 'asc' },
  al_ataya_customer_payments_v1: { table: 'customer_payments', sort: 'desc' },
  al_ataya_suppliers_v1: { table: 'suppliers', sort: 'desc' },
  al_ataya_supplier_txs_v1: { table: 'supplier_payments', sort: 'desc' },
  al_ataya_expenses_v1: { table: 'expenses', sort: 'desc' },
  al_ataya_cash_txs_v1: { table: 'cash_movements', sort: 'desc' },
  al_ataya_usd_purchases_v1: { table: 'usd_purchases', sort: 'desc' },
  al_ataya_goods_withdrawals_v1: { table: 'inventory_withdrawals', sort: 'desc' },
  al_ataya_partner_capital_txs_v2: { table: 'partner_capital_transactions', sort: 'desc' },
  al_ataya_exchange_rates_v1: { table: 'exchange_rates', sort: 'asc' },
};

/** مفاتيح تُرحَّل من localStorage القديم (بما فيها غير المصفوفات). */
const LEGACY_KV_KEYS = [
  'al_ataya_settings_v1',
  'al_ataya_daily_audits_v1',
  'al_ataya_partner_capital_v1',
  'al_ataya_partner_capital_repayments_v1',
];

type Row = { id: string; json: string; sort_key: string; tx_date: string | null; currency: string | null; exchange_rate: number | null; ref_id: string | null; amount: number | null };

let mode: 'sqlite' | 'localStorage' = 'localStorage';
let initError: string | undefined;
let migratedFromLegacy = false;
let db: any = null;

// الكاش يخزّن نص JSON لكل مفتاح ⇒ كل قراءة تُرجع نسخة جديدة (نفس سلوك localStorage القديم، بلا مشاركة مراجع)
const cache = new Map<string, string>();
const written = new Map<string, Map<string, string>>(); // table -> id -> json
const pending = new Map<string, string | undefined>();
let flushTimer: any = null;
let flushChain: Promise<void> = Promise.resolve();
let lastWriteError: string | undefined;

// ---------------------------------------------------------------
// SQL schema
// ---------------------------------------------------------------
function genericTableSql(t: string): string {
  return `
CREATE TABLE IF NOT EXISTS ${t} (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  sort_key TEXT,
  tx_date TEXT,
  currency TEXT,
  exchange_rate REAL,
  ref_id TEXT,
  amount REAL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_${t}_date ON ${t}(tx_date);
CREATE INDEX IF NOT EXISTS idx_${t}_ref ON ${t}(ref_id);
CREATE INDEX IF NOT EXISTS idx_${t}_sort ON ${t}(sort_key);`;
}

const EXTRA_SQL = `
CREATE TABLE IF NOT EXISTS app_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT);
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY NOT NULL, invoice_id TEXT NOT NULL, product_id TEXT, supplier_id TEXT,
  total_pieces REAL, unit_cost REAL, currency TEXT, amount REAL, exchange_rate REAL, tx_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_inv ON purchase_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_prod ON purchase_items(product_id);
CREATE TABLE IF NOT EXISTS sales_items (
  id TEXT PRIMARY KEY NOT NULL, invoice_id TEXT NOT NULL, product_id TEXT, customer_id TEXT,
  total_pieces REAL, unit_price REAL, currency TEXT, amount REAL, exchange_rate REAL,
  cost_at_sale REAL, cost_currency TEXT, tx_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_sales_items_inv ON sales_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_items_prod ON sales_items(product_id);
`;

function fullSchemaSql(): string {
  return Object.values(COLLECTION_TABLES).map((c) => genericTableSql(c.table)).join('\n') + '\n' + EXTRA_SQL;
}

// ---------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------
function num(v: any): number | null {
  return typeof v === 'number' && isFinite(v) ? v : null;
}

function toRow(table: string, r: any, index: number, seen: Set<string>): Row {
  let id = typeof r?.id === 'string' && r.id ? r.id : `${table}_idx_${index}`;
  if (seen.has(id)) id = `${id}#${index}`;
  seen.add(id);
  const isBatch = table === 'inventory_batches';
  const sortKey = isBatch ? `${r?.date || ''}|${r?.createdAt || ''}` : `${r?.createdAt || r?.date || r?.effectiveAt || ''}`;
  return {
    id,
    json: JSON.stringify(r),
    sort_key: sortKey,
    tx_date: r?.date || r?.effectiveAt || null,
    currency: r?.currency || null,
    exchange_rate: num(r?.exchangeRate) ?? num(r?.invoiceExchangeRate) ?? num(r?.fixedExchangeRate),
    ref_id: r?.customerId || r?.supplierId || r?.productId || r?.partnerName || null,
    amount: num(r?.finalTotal) ?? num(r?.amount) ?? num(r?.totalCost) ?? num(r?.amountUSD),
  };
}

function itemStatements(table: string, inv: any): Array<{ statement: string; values: any[] }> {
  const out: Array<{ statement: string; values: any[] }> = [];
  if (table === 'purchase_invoices') {
    (inv.items || []).forEach((it: any, i: number) => {
      out.push({
        statement:
          'INSERT OR REPLACE INTO purchase_items (id,invoice_id,product_id,supplier_id,total_pieces,unit_cost,currency,amount,exchange_rate,tx_date) VALUES (?,?,?,?,?,?,?,?,?,?)',
        values: [
          `${inv.id}:${i}`,
          inv.id,
          it.productId ?? null,
          inv.supplierId ?? null,
          it.totalPieces ?? 0,
          it.costPerCarton ?? 0,
          it.currency || (inv.currency === 'MIXED' ? 'USD' : inv.currency) || null,
          it.itemTotal ?? 0,
          it.exchangeRate ?? inv.invoiceExchangeRate ?? null,
          inv.date ?? null,
        ],
      });
    });
  } else if (table === 'sales_invoices') {
    (inv.items || []).forEach((it: any, i: number) => {
      out.push({
        statement:
          'INSERT OR REPLACE INTO sales_items (id,invoice_id,product_id,customer_id,total_pieces,unit_price,currency,amount,exchange_rate,cost_at_sale,cost_currency,tx_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        values: [
          `${inv.id}:${i}`,
          inv.id,
          it.productId ?? null,
          inv.customerId ?? null,
          it.totalPieces ?? 0,
          it.unitPrice ?? 0,
          inv.currency ?? null,
          it.itemTotal ?? 0,
          inv.exchangeRate ?? inv.fixedExchangeRate ?? null,
          it.totalCostAtSale ?? null,
          it.costCurrencyAtSale ?? null,
          inv.date ?? null,
        ],
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------
export async function initStorage(): Promise<{ mode: string; migrated: boolean; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    mode = 'localStorage';
    return { mode, migrated: false };
  }
  try {
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const consistency = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    if (consistency.result && isConn) db = await sqlite.retrieveConnection(DB_NAME, false);
    else db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    await db.open();
    await db.execute(fullSchemaSql());

    const applied = await db.query('SELECT version FROM schema_migrations WHERE version = ?', [SCHEMA_VERSION]);
    const legacyDone = await db.query("SELECT value FROM app_kv WHERE key = 'legacy_imported'");

    if (!legacyDone.values || legacyDone.values.length === 0) {
      await migrateLegacyLocalStorage();
    }
    if (!applied.values || applied.values.length === 0) {
      await db.run('INSERT OR IGNORE INTO schema_migrations (version,name,applied_at) VALUES (?,?,?)', [
        SCHEMA_VERSION,
        'accounting_multicurrency_v3',
        new Date().toISOString(),
      ]);
    }

    await loadAllIntoCache();
    mode = 'sqlite';
    installLifecycleFlush();
    return { mode, migrated: migratedFromLegacy };
  } catch (e: any) {
    console.error('SQLite initialization failed on native Android:', e);
    initError = e?.message || String(e);
    mode = 'localStorage';
    db = null;
    throw new Error(`فشل تشغيل قاعدة البيانات المحلية SQLite: ${initError}`);
  }
}

async function migrateLegacyLocalStorage(): Promise<void> {
  const statements: Array<{ statement: string; values: any[] }> = [];
  const expected: Record<string, number> = {};

  for (const [key, meta] of Object.entries(COLLECTION_TABLES)) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let arr: any;
    try {
      arr = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    const seen = new Set<string>();
    expected[meta.table] = arr.length;
    arr.forEach((r, i) => {
      const row = toRow(meta.table, r, i, seen);
      statements.push({
        statement: `INSERT OR REPLACE INTO ${meta.table} (id,data,sort_key,tx_date,currency,exchange_rate,ref_id,amount,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        values: [row.id, row.json, row.sort_key, row.tx_date, row.currency, row.exchange_rate, row.ref_id, row.amount, new Date().toISOString()],
      });
      itemStatements(meta.table, r).forEach((s) => statements.push(s));
    });
  }
  for (const key of LEGACY_KV_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) {
      statements.push({
        statement: 'INSERT OR REPLACE INTO app_kv (key,value,updated_at) VALUES (?,?,?)',
        values: [key, raw, new Date().toISOString()],
      });
    }
  }

  if (statements.length > 0) {
    await db.executeSet(statements, true);
    // تحقق: عدد الصفوف المرحّلة = عدد السجلات الأصلية
    for (const [table, count] of Object.entries(expected)) {
      const r = await db.query(`SELECT COUNT(*) AS c FROM ${table}`);
      const c = r.values?.[0]?.c ?? 0;
      if (c < count) throw new Error(`فشل التحقق من ترحيل ${table}: ${c}/${count}`);
    }
    migratedFromLegacy = true;
  }
  await db.run('INSERT OR REPLACE INTO app_kv (key,value,updated_at) VALUES (?,?,?)', [
    'legacy_imported',
    JSON.stringify({ at: new Date().toISOString(), counts: expected }),
    new Date().toISOString(),
  ]);
}

async function loadAllIntoCache(): Promise<void> {
  for (const [key, meta] of Object.entries(COLLECTION_TABLES)) {
    const res = await db.query(`SELECT id,data FROM ${meta.table} ORDER BY sort_key ${meta.sort === 'asc' ? 'ASC' : 'DESC'}, rowid ${meta.sort === 'asc' ? 'ASC' : 'DESC'}`);
    const rows: any[] = res.values || [];
    const w = new Map<string, string>();
    rows.forEach((r) => w.set(r.id, r.data));
    written.set(meta.table, w);
    if (rows.length > 0) cache.set(key, '[' + rows.map((r) => r.data).join(',') + ']');
  }
  const kv = await db.query('SELECT key,value FROM app_kv');
  for (const r of kv.values || []) {
    if (r.key === 'legacy_imported') continue;
    if (typeof r.value === 'string') cache.set(r.key, r.value);
  }
}

// ---------------------------------------------------------------
// Public sync API used by LocalDatabase
// ---------------------------------------------------------------
export function storeGet<T>(key: string, fallback: T): T {
  if (mode === 'sqlite') {
    const raw = cache.get(key);
    if (raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error loading key ${key} from storage:`, err);
    return fallback;
  }
}

export function storeSet<T>(key: string, data: T): void {
  if (mode === 'sqlite') {
    const str = JSON.stringify(data);
    cache.set(key, str);
    pending.set(key, str);
    scheduleFlush();
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving key ${key} to storage:`, err);
  }
}

export function storeRemove(key: string): void {
  if (mode === 'sqlite') {
    cache.delete(key);
    pending.set(key, undefined);
    scheduleFlush();
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getStorageInfo() {
  return { mode, error: initError || lastWriteError, migratedFromLegacy, schemaVersion: SCHEMA_VERSION };
}

// ---------------------------------------------------------------
// Write-through (diff based, one transaction per flush)
// ---------------------------------------------------------------
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushStorage();
  }, 30);
}

export function flushStorage(): Promise<void> {
  if (mode !== 'sqlite') return Promise.resolve();
  flushChain = flushChain.then(doFlush).catch((e) => {
    lastWriteError = e?.message || String(e);
    console.error('SQLite flush failed:', e);
  });
  return flushChain;
}

async function doFlush(): Promise<void> {
  if (pending.size === 0 || !db) return;
  const batch = new Map(pending);
  pending.clear();
  const statements: Array<{ statement: string; values: any[] }> = [];
  const newWritten: Array<[string, Map<string, string>]> = [];
  const now = new Date().toISOString();

  for (const [key, str] of batch) {
    const meta = COLLECTION_TABLES[key];
    const data: any = str === undefined ? undefined : JSON.parse(str);
    if (meta && Array.isArray(data)) {
      const prev = written.get(meta.table) || new Map<string, string>();
      const next = new Map<string, string>();
      const seen = new Set<string>();
      data.forEach((r, i) => {
        const row = toRow(meta.table, r, i, seen);
        next.set(row.id, row.json);
        if (prev.get(row.id) !== row.json) {
          statements.push({
            statement: `INSERT OR REPLACE INTO ${meta.table} (id,data,sort_key,tx_date,currency,exchange_rate,ref_id,amount,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
            values: [row.id, row.json, row.sort_key, row.tx_date, row.currency, row.exchange_rate, row.ref_id, row.amount, now],
          });
          if (meta.table === 'purchase_invoices' || meta.table === 'sales_invoices') {
            const itemsTable = meta.table === 'purchase_invoices' ? 'purchase_items' : 'sales_items';
            statements.push({ statement: `DELETE FROM ${itemsTable} WHERE invoice_id = ?`, values: [row.id] });
            itemStatements(meta.table, r).forEach((s) => statements.push(s));
          }
        }
      });
      for (const id of prev.keys()) {
        if (!next.has(id)) {
          statements.push({ statement: `DELETE FROM ${meta.table} WHERE id = ?`, values: [id] });
          if (meta.table === 'purchase_invoices') statements.push({ statement: 'DELETE FROM purchase_items WHERE invoice_id = ?', values: [id] });
          if (meta.table === 'sales_invoices') statements.push({ statement: 'DELETE FROM sales_items WHERE invoice_id = ?', values: [id] });
        }
      }
      newWritten.push([meta.table, next]);
    } else if (data === undefined) {
      statements.push({ statement: 'DELETE FROM app_kv WHERE key = ?', values: [key] });
    } else {
      statements.push({
        statement: 'INSERT OR REPLACE INTO app_kv (key,value,updated_at) VALUES (?,?,?)',
        values: [key, str, now],
      });
    }
  }

  if (statements.length === 0) {
    newWritten.forEach(([t, m]) => written.set(t, m));
    return;
  }
  try {
    await db.executeSet(statements, true);
    newWritten.forEach(([t, m]) => written.set(t, m));
    lastWriteError = undefined;
  } catch (e) {
    // أعد التعليق ليُعاد المحاولة لاحقاً (الكاش ما زال يحمل الحقيقة)
    for (const [k, v] of batch) if (!pending.has(k)) pending.set(k, v);
    throw e;
  }
}

function installLifecycleFlush() {
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushStorage();
    });
    window.addEventListener('pagehide', () => void flushStorage());
  } catch {
    /* ignore */
  }
}

/** عدّ الصفوف الفعلية داخل SQLite (لتقرير سلامة البيانات). */
export async function sqliteRowCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (mode !== 'sqlite' || !db) return out;
  await flushStorage();
  for (const meta of Object.values(COLLECTION_TABLES)) {
    const r = await db.query(`SELECT COUNT(*) AS c FROM ${meta.table}`);
    out[meta.table] = r.values?.[0]?.c ?? 0;
  }
  for (const t of ['purchase_items', 'sales_items']) {
    const r = await db.query(`SELECT COUNT(*) AS c FROM ${t}`);
    out[t] = r.values?.[0]?.c ?? 0;
  }
  return out;
}
