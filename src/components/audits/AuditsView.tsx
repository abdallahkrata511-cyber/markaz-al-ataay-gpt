import React, { useMemo, useState } from 'react';
import { FileDown, Share2, ClipboardList, Users, Truck, Scale, FileSpreadsheet } from 'lucide-react';
import { AppSettings } from '../../types';
import { LocalDatabase } from '../../services/db';
import { buildReportHtml, exportReportPdf } from '../../services/pdfExport';
import { DailyInventoryModal } from '../dashboard/DailyInventoryModal';

interface Props {
  settings: AppSettings;
  /** يتغير عند أي تحديث للبيانات لإعادة حساب التقارير (Memoization) */
  dataVersion: number;
}

type Tab = 'customers' | 'suppliers' | 'fx';

const f2 = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-US');
const f0 = (n: number) => Math.round(n).toLocaleString('en-US');
const d = (s?: string) => (s ? s.slice(0, 10) : '-');

export const AuditsView: React.FC<Props> = ({ settings, dataVersion }) => {
  const [tab, setTab] = useState<Tab>('customers');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [jardOpen, setJardOpen] = useState(false);

  // تقارير ثقيلة: تُحسب فقط عند تغيّر البيانات أو السعر
  const cust = useMemo(() => LocalDatabase.getCustomerAudit(), [dataVersion, settings.exchangeRate]);
  const supp = useMemo(() => LocalDatabase.getSupplierAudit(), [dataVersion, settings.exchangeRate]);
  const fx = useMemo(() => LocalDatabase.getExchangeRateEffectReport(), [dataVersion, settings.exchangeRate]);

  const run = async (html: string, name: string, mode: 'save' | 'share') => {
    setBusy(true);
    setMsg(null);
    const r = await exportReportPdf(html, `${name}-${new Date().toISOString().slice(0, 10)}.pdf`, mode);
    setMsg(r.success ? 'تم تجهيز ملف PDF' : r.error || 'فشل التصدير');
    setBusy(false);
  };

  const customerHtml = () =>
    buildReportHtml({
      title: 'جرد العملاء',
      subtitle: `التاريخ ${d(new Date().toISOString())} — التقييم الحالي بسعر ${f0(cust.rate)} ل.س/$`,
      settings,
      columns: [
        { header: 'العميل' },
        { header: 'رصيد ل.س', align: 'left' },
        { header: 'رصيد $', align: 'left' },
        { header: 'القيمة التاريخية $', align: 'left' },
        { header: 'التقييم الحالي $', align: 'left' },
        { header: 'أثر الصرف $', align: 'left' },
        { header: 'آخر فاتورة' },
        { header: 'آخر دفعة' },
      ],
      rows: cust.rows.map((r) => [
        r.name + (r.sub ? ` (${r.sub})` : ''),
        f0(r.sypBalance),
        f2(r.usdBalance),
        f2(r.historicalUSD),
        f2(r.currentUSD),
        f2(r.fxEffectUSD),
        `${r.lastInvoiceNumber || '-'} ${d(r.lastInvoiceDate)}`,
        r.lastPaymentDate ? `${r.lastPaymentText} ${d(r.lastPaymentDate)}` : '-',
      ]),
      totals: [
        { label: 'إجمالي ذمم العملاء بالليرة', value: `${f0(cust.totalSypBalance)} ل.س` },
        { label: 'إجمالي ذمم العملاء بالدولار', value: `${f2(cust.totalUsdBalance)} $` },
        { label: 'إجمالي القيمة التاريخية', value: `${f2(cust.totalHistoricalUSD)} $` },
        { label: 'إجمالي ذمم العملاء (تقييم حالي بالدولار)', value: `${f2(cust.totalCurrentUSD)} $` },
        { label: 'أثر تغير سعر الصرف', value: `${f2(cust.totalFxEffectUSD)} $` },
      ],
    });

  const supplierHtml = () =>
    buildReportHtml({
      title: 'جرد الموردين',
      subtitle: `التاريخ ${d(new Date().toISOString())} — الأرصدة مثبتة بالدولار (موجب = مستحق للمورد ، سالب = رصيد دائن لنا)`,
      settings,
      columns: [
        { header: 'المورد' },
        { header: 'الرصيد $', align: 'left' },
        { header: 'رصيد افتتاحي ل.س', align: 'left' },
        { header: 'آخر فاتورة' },
        { header: 'آخر دفعة' },
      ],
      rows: supp.rows.map((r) => [
        r.name + (r.sub ? ` (${r.sub})` : ''),
        f2(r.currentUSD),
        f0(r.sypBalance),
        `${r.lastInvoiceNumber || '-'} ${d(r.lastInvoiceDate)}`,
        r.lastPaymentDate ? `${r.lastPaymentText} ${d(r.lastPaymentDate)}` : '-',
      ]),
      totals: [{ label: 'إجمالي ذمم الموردين بالدولار', value: `${f2(supp.totalPayablesUSD)} $` }],
    });

  const fxHtml = () =>
    buildReportHtml({
      title: 'تقرير أثر سعر الصرف على قيمة المشروع بالدولار',
      subtitle: `السعر الحالي ${f0(fx.currentRate)}${fx.previousRate ? ` — السعر السابق ${f0(fx.previousRate)}` : ''} ل.س/$`,
      settings,
      columns: [{ header: 'البند' }, { header: 'القيمة التاريخية $', align: 'left' }, { header: 'التقييم الحالي $', align: 'left' }, { header: 'الأثر $', align: 'left' }],
      rows: [
        ['صندوق الليرة', f2(fx.cash.historicalUSD - fx.cash.usdBalance), f2(fx.cash.currentUSD - fx.cash.usdBalance), f2(fx.cash.fxEffectUSD)],
        ['ذمم العملاء', f2(fx.customers.historicalUSD), f2(fx.customers.currentUSD), f2(fx.customers.fxEffectUSD)],
        ['مخزون مسعّر بالليرة', f2(fx.inventorySYP.historicalUSD), f2(fx.inventorySYP.currentUSD), f2(fx.inventorySYP.fxEffectUSD)],
        ['ذمم الموردين (دولار ثابت)', f2(fx.suppliers.historicalUSD), f2(fx.suppliers.currentUSD), f2(fx.suppliers.fxEffectUSD)],
      ],
      totals: [{ label: 'الأثر الصافي على قيمة المشروع بالدولار', value: `${f2(fx.totalFxEffectUSD)} $` }],
    });

  const cur = tab === 'customers' ? { html: customerHtml, name: 'customer-audit' } : tab === 'suppliers' ? { html: supplierHtml, name: 'supplier-audit' } : { html: fxHtml, name: 'fx-effect-report' };

  const tabBtn = (id: Tab, label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition ${
        tab === id ? 'bg-[#FFAA47] text-slate-950' : 'text-slate-600 dark:text-slate-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  const th = 'p-2 text-right font-black whitespace-nowrap';
  const td = 'p-2 whitespace-nowrap';
  const card = 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm';

  return (
    <div className="space-y-4 pb-20">
      <div className={`${card} p-4 flex items-center justify-between gap-3`}>
        <div>
          <h2 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#FFAA47]" />
            <span>الجرد والتقارير المالية</span>
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            سعر اليوم ({f0(settings.exchangeRate)} ل.س/$) يُستخدم للتقييم الحالي فقط؛ الأسعار التاريخية محفوظة لكل عملية.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setJardOpen(true)}
          className="shrink-0 inline-flex items-center gap-1.5 py-2 px-3 rounded-full bg-[#FFAA47] text-slate-950 font-black text-xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>جرد شامل</span>
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        {tabBtn('customers', 'جرد العملاء', Users)}
        {tabBtn('suppliers', 'جرد الموردين', Truck)}
        {tabBtn('fx', 'أثر سعر الصرف', Scale)}
      </div>

      {tab === 'customers' && (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] min-w-[820px] text-slate-800 dark:text-slate-100">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  {['العميل', 'رصيد ل.س', 'رصيد $', 'القيمة التاريخية $', 'التقييم الحالي $', 'أثر الصرف $', 'آخر فاتورة', 'آخر دفعة'].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cust.rows.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-400">لا توجد بيانات عملاء</td></tr>
                )}
                {cust.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className={`${td} font-bold`}>{r.name}</td>
                    <td className={td}>{f0(r.sypBalance)}</td>
                    <td className={td}>{f2(r.usdBalance)}</td>
                    <td className={td}>{f2(r.historicalUSD)}</td>
                    <td className={`${td} font-black`}>{f2(r.currentUSD)}</td>
                    <td className={`${td} ${r.fxEffectUSD < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{f2(r.fxEffectUSD)}</td>
                    <td className={td}>{r.lastInvoiceNumber || '-'} {d(r.lastInvoiceDate)}</td>
                    <td className={td}>{r.lastPaymentDate ? `${r.lastPaymentText} ${d(r.lastPaymentDate)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 text-xs font-black text-slate-900 dark:text-white space-y-1">
            <div className="flex justify-between"><span>إجمالي ذمم العملاء (تقييم حالي بالدولار)</span><span>{f2(cust.totalCurrentUSD)} $</span></div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300 font-bold"><span>منها بالليرة: {f0(cust.totalSypBalance)} ل.س — بالدولار: {f2(cust.totalUsdBalance)} $</span><span>أثر الصرف {f2(cust.totalFxEffectUSD)} $</span></div>
          </div>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] min-w-[620px] text-slate-800 dark:text-slate-100">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  {['المورد', 'الرصيد $', 'آخر فاتورة', 'آخر دفعة'].map((h) => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supp.rows.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">لا توجد بيانات موردين</td></tr>
                )}
                {supp.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className={`${td} font-bold`}>{r.name}</td>
                    <td className={`${td} font-black ${r.currentUSD < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                      {f2(r.currentUSD)} {r.currentUSD < 0 ? '(رصيد دائن)' : ''}
                    </td>
                    <td className={td}>{r.lastInvoiceNumber || '-'} {d(r.lastInvoiceDate)}</td>
                    <td className={td}>{r.lastPaymentDate ? `${r.lastPaymentText} ${d(r.lastPaymentDate)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/70 text-xs font-black text-slate-900 dark:text-white flex justify-between">
            <span>إجمالي ذمم الموردين بالدولار</span>
            <span>{f2(supp.totalPayablesUSD)} $</span>
          </div>
        </div>
      )}

      {tab === 'fx' && (
        <div className={`${card} p-4 space-y-3 text-xs text-slate-800 dark:text-slate-100`}>
          {[
            ['صندوق الليرة', fx.cash.historicalUSD - fx.cash.usdBalance, fx.cash.currentUSD - fx.cash.usdBalance, fx.cash.fxEffectUSD],
            ['ذمم العملاء', fx.customers.historicalUSD, fx.customers.currentUSD, fx.customers.fxEffectUSD],
            ['مخزون مسعّر بالليرة', fx.inventorySYP.historicalUSD, fx.inventorySYP.currentUSD, fx.inventorySYP.fxEffectUSD],
            ['ذمم الموردين (بالدولار - ثابتة)', fx.suppliers.historicalUSD, fx.suppliers.currentUSD, fx.suppliers.fxEffectUSD],
          ].map(([label, h, c, e]) => (
            <div key={label as string} className="grid grid-cols-4 gap-2 items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold col-span-1">{label}</span>
              <span>{f2(h as number)} $<br /><small className="text-slate-400">تاريخي</small></span>
              <span>{f2(c as number)} $<br /><small className="text-slate-400">حالي</small></span>
              <span className={(e as number) < 0 ? 'text-red-600 dark:text-red-400 font-black' : 'text-emerald-600 dark:text-emerald-400 font-black'}>{f2(e as number)} $</span>
            </div>
          ))}
          <div className="flex justify-between font-black text-sm pt-1">
            <span>الأثر الصافي على قيمة المشروع بالدولار</span>
            <span className={fx.totalFxEffectUSD < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>{f2(fx.totalFxEffectUSD)} $</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            سالب = انخفضت قيمة الأصول بالليرة عند التقييم بسعر اليوم. لا يتغير أي مبلغ أصلي ولا أي سعر صرف تاريخي.
          </p>
        </div>
      )}

      {msg && <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{msg}</div>}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(cur.html(), cur.name, 'save')}
          className="py-3 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <FileDown className="w-4 h-4" />
          <span>تصدير PDF</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(cur.html(), cur.name, 'share')}
          className="py-3 rounded-xl bg-[#FFAA47] text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Share2 className="w-4 h-4" />
          <span>مشاركة PDF</span>
        </button>
      </div>

      <DailyInventoryModal isOpen={jardOpen} onClose={() => setJardOpen(false)} settings={settings} />
    </div>
  );
};
