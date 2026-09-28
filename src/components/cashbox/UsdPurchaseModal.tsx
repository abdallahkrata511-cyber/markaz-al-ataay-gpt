import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  ArrowRightLeft,
  Coins,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { NumberInput } from '../common/NumberInput';
import { AppSettings } from '../../types';
import { LocalDatabase } from '../../services/db';

interface UsdPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSuccess: () => void;
}

export const UsdPurchaseModal: React.FC<UsdPurchaseModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSuccess,
}) => {
  const [amountUSD, setAmountUSD] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(settings.exchangeRate || 15000);
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  if (!isOpen) return null;

  const totalCostSYP = Math.round(amountUSD * exchangeRate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountUSD <= 0) {
      alert('يرجى تحديد كمية الدولار المشتراة (أكبر من 0)');
      return;
    }
    if (exchangeRate <= 0) {
      alert('يرجى تحديد سعر الصرف الفعلي للشراء');
      return;
    }

    LocalDatabase.addUsdPurchase({
      amountUSD,
      exchangeRate,
      costSYP: totalCostSYP,
      date: new Date(date).toISOString(),
      notes: notes.trim(),
    });

    onSuccess();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="شراء دولار نقدي (تبديل من ليرة سورية إلى دولار)"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-display">
        {/* Accounting explanation box */}
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
          <div className="flex items-start gap-2">
            <ArrowRightLeft className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>الأثر المحاسبي التلقائي:</strong>
              <div className="mt-0.5">
                سيتم <strong>خصم {totalCostSYP.toLocaleString()} ل.س</strong> من رصيد الصندوق بالليرة، و<strong>إيداع {amountUSD.toLocaleString()} $</strong> مباشرة في رصيد الصندوق بالدولار.
              </div>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              كمية الدولار المشتراة ($) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <NumberInput
                value={amountUSD}
                onChange={setAmountUSD}
                placeholder="0"
                min={0}
                className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-slate-100 pl-8"
              />
              <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">USD</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              سعر الصرف الفعلي (ل.س / $) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <NumberInput
                value={exchangeRate}
                onChange={setExchangeRate}
                placeholder="15000"
                min={1}
                className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-slate-100 pl-10"
              />
              <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">SYP</span>
            </div>
          </div>
        </div>

        {/* Total Cost Display */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
            إجمالي المبلغ المدفوع من صندوق الليرة:
          </span>
          <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
            {totalCostSYP.toLocaleString()} <span className="text-xs font-normal">ل.س</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              تاريخ العملية
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات أو اسم الصرّاف
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: صراف السوق، مكتب الأمانة..."
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
          >
            تأكيد شراء الدولار
          </button>
        </div>
      </form>
    </Modal>
  );
};
