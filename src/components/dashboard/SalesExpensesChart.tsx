import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
import { Invoice, Expense, AppSettings } from '../../types';
import { LocalDatabase } from '../../services/db';

interface SalesExpensesChartProps {
  settings: AppSettings;
  invoices?: Invoice[];
  expenses?: Expense[];
}

interface MonthData {
  monthKey: string;
  monthLabel: string;
  sales: number;
  expenses: number;
  net: number;
}

const ARABIC_MONTHS = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
];

export const SalesExpensesChart: React.FC<SalesExpensesChartProps> = ({
  settings,
  invoices = [],
  expenses = [],
}) => {
  const [currencyMode, setCurrencyMode] = useState<'SYP' | 'USD'>('SYP');
  const rate = settings.exchangeRate || 15000;

  // Generate 6 months data
  const chartData = useMemo(() => {
    const allInvoices = invoices.length > 0 ? invoices : LocalDatabase.getInvoices();
    const allExpenses = expenses.length > 0 ? expenses : LocalDatabase.getExpenses();
    const cashTxs = LocalDatabase.getCashTransactions();

    const now = new Date();
    const months: MonthData[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = `${ARABIC_MONTHS[m]} ${y !== now.getFullYear() ? y : ''}`.trim();

      // Total sales in this month
      let salesSYP = 0;
      for (const inv of allInvoices) {
        if (inv.date && inv.date.startsWith(key)) {
          const mult = inv.currency === 'USD' ? rate : 1;
          salesSYP += (inv.finalTotal || 0) * mult;
        }
      }

      // Total operating expenses in this month
      let expensesSYP = 0;
      for (const exp of allExpenses) {
        const expDate = exp.date || exp.createdAt;
        if (expDate && expDate.startsWith(key)) {
          const mult = exp.currency === 'USD' ? rate : 1;
          expensesSYP += (exp.amount || 0) * mult;
        }
      }

      // Add special expenses from cash transactions
      for (const ctx of cashTxs) {
        if (ctx.category === 'special_expense') {
          const ctxDate = ctx.date || ctx.createdAt;
          if (ctxDate && ctxDate.startsWith(key)) {
            const mult = ctx.currency === 'USD' ? rate : 1;
            expensesSYP += (ctx.amount || 0) * mult;
          }
        }
      }

      if (currencyMode === 'USD') {
        const salesUSD = rate > 0 ? salesSYP / rate : 0;
        const expensesUSD = rate > 0 ? expensesSYP / rate : 0;
        months.push({
          monthKey: key,
          monthLabel,
          sales: Math.round(salesUSD),
          expenses: Math.round(expensesUSD),
          net: Math.round(salesUSD - expensesUSD),
        });
      } else {
        months.push({
          monthKey: key,
          monthLabel,
          sales: Math.round(salesSYP),
          expenses: Math.round(expensesSYP),
          net: Math.round(salesSYP - expensesSYP),
        });
      }
    }

    return months;
  }, [invoices, expenses, rate, currencyMode]);

  // Totals for last 6 months
  const totals = useMemo(() => {
    let totSales = 0;
    let totExp = 0;
    for (const m of chartData) {
      totSales += m.sales;
      totExp += m.expenses;
    }
    return {
      sales: totSales,
      expenses: totExp,
      net: totSales - totExp,
    };
  }, [chartData]);

  const currencySymbol = currencyMode === 'USD' ? '$' : 'ل.س';

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as MonthData;
      return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-lg text-xs min-w-[170px] space-y-2">
          <div className="font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] text-slate-400 font-mono">{currencySymbol}</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                المبيعات:
              </span>
              <span className="font-mono font-bold">
                {data.sales.toLocaleString('en-US')} {currencySymbol}
              </span>
            </div>
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                المصاريف:
              </span>
              <span className="font-mono font-bold">
                {data.expenses.toLocaleString('en-US')} {currencySymbol}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold">
              <span>صافي الفارق:</span>
              <span
                className={`font-mono ${
                  data.net >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {data.net > 0 ? '+' : ''}
                {data.net.toLocaleString('en-US')} {currencySymbol}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>مقارنة المبيعات مقابل المصاريف</span>
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                (آخر 6 أشهر)
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              متابعة حركة نمو النشاط التجاري وتكاليف التشغيل
            </p>
          </div>
        </div>

        {/* Currency Switcher Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setCurrencyMode('SYP')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              currencyMode === 'SYP'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            ليرة سورية
          </button>
          <button
            type="button"
            onClick={() => setCurrencyMode('USD')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              currencyMode === 'USD'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            دولار ($)
          </button>
        </div>
      </div>

      {/* Mini Stat Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40">
          <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            إجمالي المبيعات
          </span>
          <div className="mt-1 font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm sm:text-base">
            {totals.sales.toLocaleString('en-US')} {currencySymbol}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40">
          <span className="text-[11px] text-rose-800 dark:text-rose-300 font-medium flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" />
            إجمالي المصاريف
          </span>
          <div className="mt-1 font-mono font-black text-rose-700 dark:text-rose-400 text-sm sm:text-base">
            {totals.expenses.toLocaleString('en-US')} {currencySymbol}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 col-span-2 sm:col-span-1">
          <span className="text-[11px] text-blue-800 dark:text-blue-300 font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            فائض المبيعات التشغيلي
          </span>
          <div className="mt-1 font-mono font-black text-blue-700 dark:text-blue-400 text-sm sm:text-base">
            {totals.net > 0 ? '+' : ''}
            {totals.net.toLocaleString('en-US')} {currencySymbol}
          </div>
        </div>
      </div>

      {/* Recharts Container */}
      <div className="h-64 sm:h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 11, fill: '#888888' }}
              axisLine={{ stroke: '#e2e8f0', opacity: 0.5 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#888888' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => {
                if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                return v;
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
              formatter={(value) => {
                if (value === 'sales') return 'المبيعات';
                if (value === 'expenses') return 'المصاريف';
                return value;
              }}
            />
            <Bar
              dataKey="sales"
              name="sales"
              fill="#10b981"
              radius={[6, 6, 0, 0]}
              maxBarSize={38}
            />
            <Bar
              dataKey="expenses"
              name="expenses"
              fill="#f43f5e"
              radius={[6, 6, 0, 0]}
              maxBarSize={38}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
