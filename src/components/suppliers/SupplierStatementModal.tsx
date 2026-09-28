import React, { useMemo, useState } from 'react';
import { FileDown, Share2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { LocalDatabase } from '../../services/db';
import { AppSettings, Supplier } from '../../types';
import { buildReportHtml, exportReportPdf } from '../../services/pdfExport';

interface Props {
  supplier: Supplier;
  settings: AppSettings;
  onClose: () => void;
  onPay: () => void;
}

const fmt = (n: number, d = 2) =>
  (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
const kindLabel: Record<string, string> = {
  opening: 'رصيد افتتاحي',
  invoice: 'فاتورة شراء',
  payment: 'دفعة سداد',
  manual_purchase: 'قيد مشتريات',
};

export const SupplierStatementModal: React.FC<Props> = ({ supplier, settings, onClose, onPay }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const st = useMemo(
    () => LocalDatabase.getSupplierStatement(supplier.id, from || undefined, to || undefined),
    [supplier.id, from, to]
  );

  const doExport = async (mode: 'save' | 'share') => {
    setBusy(true);
    setMsg(null);
    const html = buildReportHtml({
      title: `كشف حساب المورد: ${supplier.name}`,
      subtitle: `${from || 'البداية'} ← ${to || 'اليوم'}  |  الرصيد الحالي: ${fmt(st.balanceUSD)} $`,
      settings,
      columns: [
        { header: 'التاريخ' },
        { header: 'المستند' },
        { header: 'مشتريات $', align: 'left' },
        { header: 'مشتريات ل.س', align: 'left' },
        { header: 'دفع ل.س', align: 'left' },
        { header: 'دفع $', align: 'left' },
        { header: 'رصيد دائن $', align: 'left' },
        { header: 'دين $', align: 'left' },
        { header: 'سعر الصرف', align: 'left' },
        { header: 'الرصيد بعد $', align: 'left' },
      ],
      rows: st.rows.map((r) => [
        r.date.slice(0, 10),
        `${kindLabel[r.kind]} ${r.ref !== kindLabel[r.kind] ? r.ref : ''}`,
        fmt(r.purchaseOrigUSD),
        fmt(r.purchaseOrigSYP, 0),
        fmt(r.paidOrigSYP, 0),
        fmt(r.paidOrigUSD),
        fmt(r.creditUSD),
        fmt(r.debtUSD),
        r.rate ? fmt(r.rate, 0) : '-',
        fmt(r.balanceAfterUSD),
      ]),
      totals: [
        ...(from ? [{ label: 'رصيد أول المدة ($)', value: fmt(st.openingBalanceUSD) }] : []),
        { label: 'الرصيد النهائي بالدولار (موجب = مستحق للمورد)', value: `${fmt(st.balanceUSD)} $` },
      ],
      footerNote: 'المبالغ الأصلية وأسعار الصرف التاريخية محفوظة لكل حركة ولا تتغير بتغير سعر اليوم.',
    });
    const res = await exportReportPdf(html, `supplier-statement-${supplier.name}-${(to || new Date().toISOString().slice(0, 10))}.pdf`, mode);
    setMsg(res.success ? 'تم تجهيز ملف PDF' : res.error || 'فشل التصدير');
    setBusy(false);
  };

  const inputCls =
    'h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`كشف حساب المورد: ${supplier.name}`}
      subtitle={`الرصيد بالدولار: ${fmt(st.balanceUSD)} $ ${st.balanceUSD < 0 ? '(رصيد دائن لصالحنا)' : st.balanceUSD > 0 ? '(مستحق للمورد)' : ''}`}
      maxWidth="xl"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            من تاريخ
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full mt-1`} />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            إلى تاريخ
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} w-full mt-1`} />
          </label>
        </div>

        {from && (
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
            رصيد أول المدة: {fmt(st.openingBalanceUSD)} $
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-[11px] min-w-[760px]">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              <tr>
                {['التاريخ', 'المستند', 'مشتريات', 'دفع ل.س', 'دفع $', 'رصيد دائن', 'دين', 'سعر الصرف', 'الرصيد بعد $'].map((h) => (
                  <th key={h} className="p-2 text-right font-black">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-800 dark:text-slate-100">
              {st.rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-slate-400">
                    لا توجد حركات في الفترة المحددة
                  </td>
                </tr>
              )}
              {st.rows.map((r) => (
                <tr key={r.key} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2 whitespace-nowrap">{r.date.slice(0, 10)}</td>
                  <td className="p-2">
                    <div className="font-bold">{kindLabel[r.kind]}</div>
                    <div className="text-slate-500 dark:text-slate-400">{r.ref !== kindLabel[r.kind] ? r.ref : ''}</div>
                  </td>
                  <td className="p-2">
                    {r.purchaseOrigUSD ? <div>{fmt(r.purchaseOrigUSD)} $</div> : null}
                    {r.purchaseOrigSYP ? <div>{fmt(r.purchaseOrigSYP, 0)} ل.س</div> : null}
                  </td>
                  <td className="p-2">{r.paidOrigSYP ? fmt(r.paidOrigSYP, 0) : '-'}</td>
                  <td className="p-2">{r.paidOrigUSD ? fmt(r.paidOrigUSD) : '-'}</td>
                  <td className="p-2 text-emerald-700 dark:text-emerald-300">{r.creditUSD ? fmt(r.creditUSD) : '-'}</td>
                  <td className="p-2 text-amber-700 dark:text-amber-300">{r.debtUSD ? fmt(r.debtUSD) : '-'}</td>
                  <td className="p-2">{r.rate ? fmt(r.rate, 0) : '-'}</td>
                  <td className="p-2 font-black">{fmt(r.balanceAfterUSD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white flex justify-between">
          <span>الرصيد النهائي (USD)</span>
          <span>{fmt(st.balanceUSD)} $</span>
        </div>

        {msg && <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{msg}</div>}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => doExport('save')}
            className="py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            <span>تصدير PDF</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => doExport('share')}
            className="py-2.5 rounded-xl bg-[#FFAA47] text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            <span>مشاركة PDF</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onPay}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
        >
          تسجيل دفعة سداد لهذا المورد
        </button>
      </div>
    </Modal>
  );
};
