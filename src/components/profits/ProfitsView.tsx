import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Receipt,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  Layers,
  PieChart,
} from 'lucide-react';
import { Invoice, Expense, AppSettings, Currency } from '../../types';

interface ProfitsViewProps {
  invoices: Invoice[];
  expenses: Expense[];
  settings: AppSettings;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all' | 'custom';

export const ProfitsView: React.FC<ProfitsViewProps> = ({
  invoices,
  expenses,
  settings,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'SYP' | 'USD'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customStartDate, setCustomStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const rate = settings.exchangeRate || 15000;

  // Filter invoices and expenses by selected period
  const { filteredInvoices, filteredExpenses } = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === 'week') {
      const dayOfWeek = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (period === 'custom') {
      start = new Date(customStartDate + 'T00:00:00');
      end = new Date(customEndDate + 'T23:59:59');
    }

    const invs = invoices.filter((inv) => {
      const d = new Date(inv.date);
      return d >= start && d <= end;
    });

    // Exclude partner capital, withdrawals, usd purchases from operating expenses
    const exps = expenses.filter((exp) => {
      const d = new Date(exp.date);
      const inRange = d >= start && d <= end;
      if (!inRange) return false;

      const cat = (exp.category || '').toLowerCase();
      const person = (exp.person || '').toLowerCase();
      // Exclude personal drawings
      const isPersonalWithdrawal =
        cat.includes('سحب') ||
        cat.includes('شريك') ||
        cat.includes('رأس مال') ||
        person.includes('شريك') ||
        cat.includes('شراء دولار');

      return !isPersonalWithdrawal;
    });

    return { filteredInvoices: invs, filteredExpenses: exps };
  }, [invoices, expenses, period, customStartDate, customEndDate]);

  // Compute metrics per currency and total
  const metrics = useMemo(() => {
    let salesSYP = 0;
    let costSYP = 0;
    let salesUSD = 0;
    let costUSD = 0;

    filteredInvoices.forEach((inv) => {
      const isUSD = inv.currency === 'USD';

      // Invoice total sale
      const invTotal = inv.finalTotal;

      // Invoice cost of goods sold (COGS) at sale time
      let invCost = 0;
      if (inv.totalCost !== undefined && inv.totalCost > 0) {
        invCost = inv.totalCost;
      } else if (inv.items && inv.items.length > 0) {
        // Fallback sum of items totalCostAtSale
        invCost = inv.items.reduce((sum, item) => {
          if (item.totalCostAtSale !== undefined) {
            return sum + item.totalCostAtSale;
          }
          // Estimating cost if older invoice without totalCostAtSale
          const c = item.costPriceAtSale || 0;
          return sum + item.cartons * c + (item.pieces * c) / (item.piecesPerCarton || 1);
        }, 0);
      }

      if (isUSD) {
        salesUSD += invTotal;
        costUSD += invCost;
      } else {
        salesSYP += invTotal;
        costSYP += invCost;
      }
    });

    const grossProfitSYP = salesSYP - costSYP;
    const grossProfitUSD = salesUSD - costUSD;

    // Expenses
    const expensesSYP = filteredExpenses
      .filter((e) => e.currency === 'SYP')
      .reduce((sum, e) => sum + e.amount, 0);

    const expensesUSD = filteredExpenses
      .filter((e) => e.currency === 'USD')
      .reduce((sum, e) => sum + e.amount, 0);

    const netProfitSYP = grossProfitSYP - expensesSYP;
    const netProfitUSD = grossProfitUSD - expensesUSD;

    // Combined in USD
    const totalSalesInUSD = salesUSD + (rate > 0 ? salesSYP / rate : 0);
    const totalCostInUSD = costUSD + (rate > 0 ? costSYP / rate : 0);
    const totalGrossProfitInUSD = totalSalesInUSD - totalCostInUSD;
    const totalExpensesInUSD = expensesUSD + (rate > 0 ? expensesSYP / rate : 0);
    const totalNetProfitInUSD = totalGrossProfitInUSD - totalExpensesInUSD;

    const marginPercentSYP = costSYP > 0 ? (grossProfitSYP / costSYP) * 100 : 0;
    const marginPercentUSD = costUSD > 0 ? (grossProfitUSD / costUSD) * 100 : 0;
    const combinedMarginPercent = totalCostInUSD > 0 ? (totalGrossProfitInUSD / totalCostInUSD) * 100 : 0;

    return {
      salesSYP,
      costSYP,
      grossProfitSYP,
      expensesSYP,
      netProfitSYP,
      marginPercentSYP,

      salesUSD,
      costUSD,
      grossProfitUSD,
      expensesUSD,
      netProfitUSD,
      marginPercentUSD,

      totalSalesInUSD,
      totalCostInUSD,
      totalGrossProfitInUSD,
      totalExpensesInUSD,
      totalNetProfitInUSD,
      combinedMarginPercent,
    };
  }, [filteredInvoices, filteredExpenses, rate]);

  // Search filtered invoices
  const displayedInvoices = useMemo(() => {
    let list = filteredInvoices;
    if (currencyFilter !== 'all') {
      list = list.filter((i) => i.currency === currencyFilter);
    }
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter(
      (i) =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.customerName.toLowerCase().includes(q)
    );
  }, [filteredInvoices, currencyFilter, searchQuery]);

  return (
    <div className="space-y-5 pb-20 font-display text-right" dir="rtl">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#153243] to-[#1f4a63] text-white rounded-3xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFAA47] text-slate-950 flex items-center justify-center shadow-md shrink-0">
            <TrendingUp className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">قسم الأرباح وتحليل المبيعات</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              متابعة دقيقة لإجمالي المبيعات، تكلفة البضاعة وقت البيع، والمصاريف التشغيلية
            </p>
          </div>
        </div>

        {/* Period Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white/10 p-1.5 rounded-2xl backdrop-blur-xs text-xs font-bold w-full sm:w-auto justify-center sm:justify-start">
          <button
            type="button"
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              period === 'today' ? 'bg-[#FFAA47] text-slate-950 shadow-xs' : 'text-white hover:bg-white/10'
            }`}
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              period === 'week' ? 'bg-[#FFAA47] text-slate-950 shadow-xs' : 'text-white hover:bg-white/10'
            }`}
          >
            هذا الأسبوع
          </button>
          <button
            type="button"
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              period === 'month' ? 'bg-[#FFAA47] text-slate-950 shadow-xs' : 'text-white hover:bg-white/10'
            }`}
          >
            هذا الشهر
          </button>
          <button
            type="button"
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              period === 'all' ? 'bg-[#FFAA47] text-slate-950 shadow-xs' : 'text-white hover:bg-white/10'
            }`}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              period === 'custom' ? 'bg-[#FFAA47] text-slate-950 shadow-xs' : 'text-white hover:bg-white/10'
            }`}
          >
            مخصص
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 dark:text-slate-400">من تاريخ:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 dark:text-slate-400">إلى تاريخ:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold"
            />
          </div>
        </div>
      )}

      {/* Primary KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sales */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold">إجمالي المبيعات</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-black text-xl text-slate-900 dark:text-white font-mono">
            ${metrics.totalSalesInUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 flex justify-between">
            <span>SYP: {Math.round(metrics.salesSYP).toLocaleString('en-US')}</span>
            <span>USD: ${metrics.salesUSD.toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold">تكلفة البضاعة المباعة</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-black text-xl text-slate-900 dark:text-white font-mono">
            ${metrics.totalCostInUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 flex justify-between">
            <span>SYP: {Math.round(metrics.costSYP).toLocaleString('en-US')}</span>
            <span>USD: ${metrics.costUSD.toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Gross Expected Profit */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold">الربح المتوقع (التشغيلي)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-black text-xl text-emerald-600 dark:text-emerald-400 font-mono">
            ${metrics.totalGrossProfitInUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 pt-1 flex justify-between font-bold">
            <span>SYP: {Math.round(metrics.grossProfitSYP).toLocaleString('en-US')}</span>
            <span>USD: ${metrics.grossProfitUSD.toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Net Profit After Expenses */}
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <span className="font-black">صافي الربح بعد المصاريف</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-black text-2xl text-emerald-700 dark:text-emerald-300 font-mono">
            ${metrics.totalNetProfitInUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </div>
          <div className="text-[11px] text-emerald-800 dark:text-emerald-300 pt-1 flex justify-between font-bold">
            <span>صافي SYP: {Math.round(metrics.netProfitSYP).toLocaleString('en-US')}</span>
            <span>صافي USD: ${metrics.netProfitUSD.toLocaleString('en-US')}</span>
          </div>
        </div>
      </div>

      {/* Currency Breakdown Detail Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SYP Details */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="font-black text-sm text-slate-800 dark:text-slate-200">
              تفاصيل أرباح الليرة السورية (SYP):
            </span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
              هامش: {metrics.marginPercentSYP.toFixed(1)}%
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>إجمالي المبيعات بالليرة:</span>
              <span className="font-bold font-mono">{Math.round(metrics.salesSYP).toLocaleString('en-US')} ل.س</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>تكلفة البضاعة المباعة:</span>
              <span className="font-bold font-mono text-amber-700">{Math.round(metrics.costSYP).toLocaleString('en-US')} ل.س</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
              <span>مجمل الربح:</span>
              <span className="font-mono">+{Math.round(metrics.grossProfitSYP).toLocaleString('en-US')} ل.س</span>
            </div>
            <div className="flex justify-between text-red-600 dark:text-red-400">
              <span>المصاريف التشغيلية بالليرة:</span>
              <span className="font-mono">-{Math.round(metrics.expensesSYP).toLocaleString('en-US')} ل.س</span>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 flex justify-between font-black text-sm text-slate-900 dark:text-white">
              <span>صافي الربح بالليرة:</span>
              <span className="font-mono text-emerald-600">{Math.round(metrics.netProfitSYP).toLocaleString('en-US')} ل.س</span>
            </div>
          </div>
        </div>

        {/* USD Details */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <span className="font-black text-sm text-slate-800 dark:text-slate-200">
              تفاصيل أرباح الدولار (USD):
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
              هامش: {metrics.marginPercentUSD.toFixed(1)}%
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>إجمالي المبيعات بالدولار:</span>
              <span className="font-bold font-mono">${metrics.salesUSD.toLocaleString('en-US')}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>تكلفة البضاعة المباعة:</span>
              <span className="font-bold font-mono text-amber-700">${metrics.costUSD.toLocaleString('en-US')}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
              <span>مجمل الربح:</span>
              <span className="font-mono">+${metrics.grossProfitUSD.toLocaleString('en-US')}</span>
            </div>
            <div className="flex justify-between text-red-600 dark:text-red-400">
              <span>المصاريف التشغيلية بالدولار:</span>
              <span className="font-mono">-${metrics.expensesUSD.toLocaleString('en-US')}</span>
            </div>
            <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800 flex justify-between font-black text-sm text-slate-900 dark:text-white">
              <span>صافي الربح بالدولار:</span>
              <span className="font-mono text-emerald-600">${metrics.netProfitUSD.toLocaleString('en-US')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operations & Invoices List Section */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              الفواتير والعمليات التي ساهمت في الربح ({displayedInvoices.length})
            </h3>
            <p className="text-xs text-slate-400">
              تحليل تفصيلي لكل فاتورة وتكلفة أصنافها وقت البيع
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <input
                type="text"
                placeholder="بحث برقم الفاتورة أو العميل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 px-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-3 right-2.5" />
            </div>

            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value as any)}
              className="h-9 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
            >
              <option value="all">كل العملات</option>
              <option value="SYP">SYP</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {displayedInvoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            لا توجد فواتير مبيعات في الفترة المحددة
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 pb-2 font-bold">
                  <th className="pb-2">رقم الفاتورة</th>
                  <th className="pb-2">التاريخ</th>
                  <th className="pb-2">العميل</th>
                  <th className="pb-2 text-center">العملة</th>
                  <th className="pb-2 text-left">قيمة البيع</th>
                  <th className="pb-2 text-left">تكلفة البضاعة</th>
                  <th className="pb-2 text-left">الربح المتوقع</th>
                  <th className="pb-2 text-center">النسبة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedInvoices.map((inv) => {
                  const curr = inv.currency;
                  const saleAmt = inv.finalTotal;
                  let costAmt = inv.totalCost || 0;
                  if (costAmt === 0 && inv.items) {
                    costAmt = inv.items.reduce((s, it) => s + (it.totalCostAtSale || 0), 0);
                  }
                  const profitAmt = inv.expectedProfit !== undefined ? inv.expectedProfit : (saleAmt - costAmt);
                  const marginPct = costAmt > 0 ? (profitAmt / costAmt) * 100 : 0;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-bold font-mono text-blue-600">{inv.invoiceNumber}</td>
                      <td className="py-2.5 text-slate-500">{new Date(inv.date).toLocaleDateString('ar-SY')}</td>
                      <td className="py-2.5 font-bold">{inv.customerName}</td>
                      <td className="py-2.5 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                          curr === 'USD' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {curr}
                        </span>
                      </td>
                      <td className="py-2.5 text-left font-bold font-mono">
                        {saleAmt.toLocaleString('en-US')} {curr}
                      </td>
                      <td className="py-2.5 text-left font-mono text-slate-500">
                        {costAmt.toLocaleString('en-US')} {curr}
                      </td>
                      <td className={`py-2.5 text-left font-bold font-mono ${
                        profitAmt >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {profitAmt > 0 ? '+' : ''}{profitAmt.toLocaleString('en-US')} {curr}
                      </td>
                      <td className="py-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {marginPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
