import React, { useState, useMemo } from 'react';
import {
  ArrowDownUp,
  DollarSign,
  Coins,
  Plus,
  Trash2,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { AppSettings, UsdPurchase } from '../../types';
import { LocalDatabase } from '../../services/db';
import { UsdPurchaseModal } from './UsdPurchaseModal';

interface UsdExchangeViewProps {
  settings: AppSettings;
  onUpdateSettings?: (settings: AppSettings) => void;
  onRefreshData?: () => void;
}

export const UsdExchangeView: React.FC<UsdExchangeViewProps> = ({
  settings,
  onRefreshData,
}) => {
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const purchases = useMemo(() => {
    return LocalDatabase.getUsdPurchases();
  }, [onRefreshData, isPurchaseModalOpen]);

  const cashSummary = useMemo(() => {
    return LocalDatabase.getCashBoxSummary();
  }, [onRefreshData, isPurchaseModalOpen]);

  // Totals
  const totalUsdPurchased = useMemo(() => {
    return purchases.reduce((sum, p) => sum + p.amountUSD, 0);
  }, [purchases]);

  const totalSypSpent = useMemo(() => {
    return purchases.reduce((sum, p) => sum + p.costSYP, 0);
  }, [purchases]);

  const averageExchangeRate = useMemo(() => {
    if (totalUsdPurchased === 0) return 0;
    return Math.round(totalSypSpent / totalUsdPurchased);
  }, [totalUsdPurchased, totalSypSpent]);

  const handleDelete = (id: string) => {
    const isConfirm = window.confirm(
      'هل أنت متأكد من حذف عملية شراء الدولار هذه؟ سيتم استرجاع المبلغ بالليرة السورية وخصم الدولار من الصندوق.'
    );
    if (!isConfirm) return;
    LocalDatabase.deleteUsdPurchase(id);
    if (onRefreshData) onRefreshData();
  };

  return (
    <div className="space-y-6 pb-24 font-display">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-l from-[#153243] to-[#0f2430] p-6 rounded-3xl text-white shadow-xl border border-white/10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FFAA47] text-slate-950 flex items-center justify-center font-bold shadow-lg">
              <ArrowDownUp className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black">قسم شراء وتصريف الدولار (USD Exchange)</h2>
              <p className="text-xs text-slate-300">
                تسجيل شراء الدولار من كاش الصندوق (خروج ليرة سورية ودخول دولار) دون التأثير على الأرباح
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsPurchaseModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#FFAA47] hover:bg-[#ff9f2c] text-slate-950 font-black text-xs sm:text-sm transition cursor-pointer shadow-lg hover:shadow-xl"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>شراء دولار جديد</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total USD Purchased */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>إجمالي الدولار المشترى</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            ${totalUsdPurchased.toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-600 block">
            أودعت في رصيد دولار الصندوق
          </span>
        </div>

        {/* Total SYP Spent */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>إجمالي الليرات المدفوعة</span>
            <Coins className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {totalSypSpent.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400">ل.س</span>
          </div>
          <span className="text-[11px] text-blue-600 block">
            خصمت من رصيد ليرة الصندوق
          </span>
        </div>

        {/* Average Rate */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>متوسط سعر صرف الشراء</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {averageExchangeRate > 0 ? averageExchangeRate.toLocaleString() : '—'}{' '}
            <span className="text-xs font-normal text-slate-400">ل.س</span>
          </div>
          <span className="text-[11px] text-amber-600 block">
            السعر المرجح لجميع العمليات
          </span>
        </div>

        {/* Available Cash Box Balances */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span>رصيد الصندوق الحالي</span>
            <Wallet className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
            {cashSummary.expectedCashSYP.toLocaleString()} ل.س
          </div>
          <div className="text-sm font-black text-emerald-600 font-mono">
            ${cashSummary.expectedCashUSD.toLocaleString()} دولار
          </div>
        </div>
      </div>

      {/* Accounting Note Alert */}
      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200">
        <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-black block">قاعدة محاسبية في مركز العطايا:</span>
          <p className="text-slate-600 dark:text-slate-300">
            عملية شراء الدولار هي <strong>تحويل أصول نقدية بين رصيد الليرة ورصيد الدولار</strong> فقط، ولا تؤثر على الأرباح التشغيلية، ولا تعتبر مصاريف أو إيرادات. سعر الصرف المستخدم في كل عملية يثبت في سجله ولا يتغير بتغير سعر الصرف اليومي.
          </p>
        </div>
      </div>

      {/* Purchases Table / List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-500" />
              <span>سجل عمليات شراء الدولار</span>
            </h3>
            <p className="text-xs text-slate-400">
              جميع عمليات التحويل بين العملتين مسجلة بالتواريخ والأسعار
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {purchases.length} عملية
          </span>
        </div>

        {purchases.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ArrowDownUp className="w-12 h-12 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-bold">لم يتم تسجيل أي عملية شراء دولار حتى الآن</p>
            <p className="text-xs text-slate-500 mt-1">
              اضغط على "شراء دولار جديد" لتحويل ليرات من الصندوق إلى دولار
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) => {
              const dateObj = new Date(p.date);
              const dateFormatted = dateObj.toLocaleDateString('ar-SY');
              const timeFormatted = dateObj.toLocaleTimeString('ar-SY', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <DollarSign className="w-5 h-5 stroke-[2.5]" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          شراء ${p.amountUSD.toLocaleString()} دولار
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono">
                          بسعر {p.exchangeRate.toLocaleString()} ل.س
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateFormatted}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{timeFormatted}</span>
                        </span>
                        {p.notes && (
                          <span className="text-slate-500">
                            ملاحظة: {p.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-medium">المدفوع من الصندوق:</div>
                      <div className="text-sm font-black font-mono text-red-600 dark:text-red-400">
                        -{p.costSYP.toLocaleString()} ل.س
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition cursor-pointer"
                      title="حذف العملية واسترجاع الأموال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usd Purchase Modal */}
      <UsdPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        settings={settings}
        onSuccess={() => {
          setIsPurchaseModalOpen(false);
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
