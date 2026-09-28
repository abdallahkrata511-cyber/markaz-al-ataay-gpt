import React, { useState, useMemo } from 'react';
import {
  WalletCards,
  Plus,
  Calendar,
  User,
  Trash2,
  Tag,
  Filter,
} from 'lucide-react';
import { Expense, AppSettings, Currency } from '../../types';
import { CurrencyBadge } from '../common/CurrencyBadge';
import { NumberInput } from '../common/NumberInput';
import { Modal } from '../common/Modal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ViewHeader } from '../common/ViewHeader';

interface ExpensesViewProps {
  expenses: Expense[];
  settings: AppSettings;
  onAddExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  onDeleteExpense: (expenseId: string) => void;
  isAddModalOpenInitially?: boolean;
  onCloseInitialModal?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  settings,
  onAddExpense,
  onDeleteExpense,
  isAddModalOpenInitially = false,
  onCloseInitialModal,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(isAddModalOpenInitially);
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null);

  // Form State
  const [amount, setAmount] = useState<number>(50000);
  const [currency, setCurrency] = useState<Currency>(settings.baseCurrency);
  const [person, setPerson] = useState<string>('عبدالله');
  const [customPerson, setCustomPerson] = useState<string>('');
  const [isCustomPerson, setIsCustomPerson] = useState<boolean>(false);
  const [category, setCategory] = useState<string>('بنزين سيارة التوزيع');
  const [notes, setNotes] = useState<string>('');

  const quickPersons = ['عبدالله'];
  const commonCategories = [
    'بنزين سيارة التوزيع',
    'صيانة وتغيير زيت',
    'ضيافة ومصروف مستودع',
    'أجور عمال وعمل إضافي',
    'كهرباء وإنترنت ومحروقات',
    'أخرى',
  ];

  const rate = settings.exchangeRate || 15000;

  const handleOpenAdd = () => {
    setAmount(25000);
    setCurrency(settings.baseCurrency);
    setPerson('عبدالله');
    setIsCustomPerson(false);
    setCustomPerson('');
    setCategory('بنزين سيارة التوزيع');
    setNotes('');
    setIsAddOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    const finalPerson = isCustomPerson ? customPerson.trim() || 'آخر' : person;

    onAddExpense({
      amount,
      currency,
      person: finalPerson,
      category,
      date: new Date().toISOString(),
      notes: notes.trim(),
    });

    setIsAddOpen(false);
    if (onCloseInitialModal) onCloseInitialModal();
  };

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    if (selectedPersonFilter === 'all') return expenses;
    return expenses.filter((e) => e.person === selectedPersonFilter);
  }, [expenses, selectedPersonFilter]);

  // Total Expenses in base currency
  const totalExpensesSYP = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => {
      const mult = e.currency === 'USD' ? rate : 1;
      return sum + e.amount * mult;
    }, 0);
  }, [filteredExpenses, rate]);

  return (
    <div className="space-y-4 pb-20 font-display">
      {/* Top Banner */}
      <ViewHeader
        title="المصاريف والنثريات اليومية"
        subtitle="تسجيل مصاريف سيارة التوزيع، البنزين، والضيافة مع اسم الشخص المسؤول."
        icon={WalletCards}
        actionButton={{
          label: 'تسجيل مصروف جديد',
          icon: Plus,
          onClick: handleOpenAdd,
        }}
      />

      {/* Summary Header Card */}
      <div className="bg-white dark:bg-[#153243]/60 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-xs">
        <div>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">إجمالي المصاريف:</span>
          <div className="mt-1">
            <CurrencyBadge
              amount={settings.baseCurrency === 'USD' ? totalExpensesSYP / rate : totalExpensesSYP}
              currency={settings.baseCurrency}
              size="lg"
            />
          </div>
        </div>

        {/* Filter by Person tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold">
          <button
            type="button"
            onClick={() => setSelectedPersonFilter('all')}
            className={`px-2.5 py-1 rounded transition ${
              selectedPersonFilter === 'all'
                ? 'bg-slate-800 dark:bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            الكل
          </button>
          {quickPersons.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPersonFilter(p)}
              className={`px-2.5 py-1 rounded transition ${
                selectedPersonFilter === p
                  ? 'bg-slate-800 dark:bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      {filteredExpenses.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400">
          <WalletCards className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="font-bold text-sm">لا توجد مصاريف مسجلة</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredExpenses.map((exp) => (
            <div
              key={exp.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-sm flex items-center justify-between hover:shadow-md transition gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-xs rounded border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{exp.person}</span>
                  </span>
                  <h4 className="font-black text-sm text-slate-900 dark:text-slate-100 truncate">
                    {exp.category}
                  </h4>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(exp.date).toLocaleString('ar-SY')}</span>
                  </span>
                  {exp.notes && (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-[200px] text-slate-600 dark:text-slate-400">{exp.notes}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <CurrencyBadge amount={exp.amount} currency={exp.currency} size="md" />
                <button
                  type="button"
                  onClick={() => setDeleteExpenseTarget(exp)}
                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                  title="حذف المصروف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          if (onCloseInitialModal) onCloseInitialModal();
        }}
        title="تسجيل مصروف جديد"
        subtitle="تسجيل المبلغ، الشخص المسؤول، والتاريخ والوقت"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                المبلغ *
              </label>
              <NumberInput
                value={amount}
                onChange={(v) => setAmount(Math.max(0, v))}
                min={0}
                step={currency === 'USD' ? 1 : 5000}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                العملة
              </label>
              <div className="flex h-11 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCurrency('SYP')}
                  className={`flex-1 rounded text-xs font-bold transition ${
                    currency === 'SYP' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ل.س
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`flex-1 rounded text-xs font-bold transition ${
                    currency === 'USD' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  $ دولار
                </button>
              </div>
            </div>
          </div>

          {/* Person Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الشخص المسؤول عن الصرف *
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setPerson('عبدالله');
                  setIsCustomPerson(false);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition ${
                  !isCustomPerson && person === 'عبدالله'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
              >
                عبدالله
              </button>
              <button
                type="button"
                onClick={() => setIsCustomPerson(true)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition ${
                  isCustomPerson
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
              >
                شخص آخر
              </button>
            </div>

            {isCustomPerson && (
              <input
                type="text"
                value={customPerson}
                onChange={(e) => setCustomPerson(e.target.value)}
                placeholder="أدخل اسم الشخص المسؤول..."
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
              />
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              بند المصروف / التصنيف *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {commonCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات وتفاصيل
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: فاتورة بنزين أو تصليح دولاب..."
              className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={amount <= 0}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition active:scale-95 text-base disabled:opacity-50"
            >
              تسجيل المصروف في الصندوق
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Expense Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteExpenseTarget}
        onClose={() => setDeleteExpenseTarget(null)}
        onConfirm={() => {
          if (deleteExpenseTarget) {
            onDeleteExpense(deleteExpenseTarget.id);
            setDeleteExpenseTarget(null);
          }
        }}
        title="حذف المصروف"
        description={`هل أنت متأكد من حذف هذا المصروف (${deleteExpenseTarget?.category}) بقيمة (${deleteExpenseTarget?.amount.toLocaleString('en-US')} ${deleteExpenseTarget?.currency})؟ سيتم إعادة المبلغ إلى الصندوق تلقائياً.`}
        confirmText="نعم، حذف واسترجاع رصيد الصندوق"
      />
    </div>
  );
};
