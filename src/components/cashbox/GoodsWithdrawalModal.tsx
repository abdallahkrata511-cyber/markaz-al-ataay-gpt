import React, { useState } from 'react';
import {
  Package,
  User,
  Coins,
  DollarSign,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { NumberInput } from '../common/NumberInput';
import { AppSettings, Product } from '../../types';
import { LocalDatabase } from '../../services/db';

interface GoodsWithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  products: Product[];
  onSuccess: () => void;
}

export const GoodsWithdrawalModal: React.FC<GoodsWithdrawalModalProps> = ({
  isOpen,
  onClose,
  settings,
  products,
  onSuccess,
}) => {
  const [person, setPerson] = useState<'abdallah' | 'partner'>('partner');
  const [productId, setProductId] = useState<string>(products[0]?.id || '');
  const [cartons, setCartons] = useState<number>(1);
  const [pieces, setPieces] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === productId) || products[0];
  const ppc = selectedProduct?.piecesPerCarton || 1;
  const totalPiecesWithdrawn = cartons * ppc + pieces;

  // Cost calculation
  const costPerCarton = selectedProduct?.purchaseCost || 0;
  const costCurrency = selectedProduct?.costCurrency || 'USD';
  const totalCost = (totalPiecesWithdrawn / ppc) * costPerCarton;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert('يرجى اختيار مادة من المخزون');
      return;
    }
    if (totalPiecesWithdrawn <= 0) {
      alert('يرجى تحديد كمية أكبر من صفر');
      return;
    }
    if (totalPiecesWithdrawn > selectedProduct.totalPiecesInStock) {
      const confirmOver = window.confirm(
        `تنبيه: الكمية المطلوبة (${totalPiecesWithdrawn} قطعة) تفوق المتوفر في المستودع (${selectedProduct.totalPiecesInStock} قطعة). هل تريد المتابعة على أية حال؟`
      );
      if (!confirmOver) return;
    }

    LocalDatabase.addGoodsWithdrawal({
      person,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      unit: selectedProduct.unit || 'كرتونة',
      cartons,
      pieces,
      totalPieces: totalPiecesWithdrawn,
      unitCost: costPerCarton,
      totalCost,
      currency: costCurrency,
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
      title="تسجيل سحب بضاعة شخصي بسعر التكلفة"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-display">
        {/* Accounting explanation */}
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
          <strong>قاعدة محاسبة الشركاء:</strong> تخصم هذه البضاعة من المخزون <strong>بسعر التكلفة الصافي للمورد</strong> وتسجل ديناً في حساب المسحوبات الشخصية دون احتساب أي أرباح، مع الحفاظ على سلامة الصندوق.
        </div>

        {/* Who is withdrawing */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            صاحب المسحوب <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPerson('partner')}
              className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                person === 'partner'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{settings.partnerName || 'الشريك'} (رأس المال)</span>
            </button>

            <button
              type="button"
              onClick={() => setPerson('abdallah')}
              className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                person === 'abdallah'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
            >
              <User className="w-4 h-4" />
              <span>عبدالله (مسحوب شخصي)</span>
            </button>
          </div>
        </div>

        {/* Product Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            المادة المسحوبة من المخزون <span className="text-red-500">*</span>
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100"
            required
          >
            {products
              .filter((p) => !p.isArchived)
              .map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.name} (متوفر: {Math.floor(prod.totalPiecesInStock / (prod.piecesPerCarton || 1))} كرتونة و {prod.totalPiecesInStock % (prod.piecesPerCarton || 1)} قطعة)
                </option>
              ))}
          </select>
        </div>

        {/* Quantities: Cartons & Pieces */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              عدد الطرود / الكراتين
            </label>
            <NumberInput
              value={cartons}
              onChange={setCartons}
              placeholder="0"
              min={0}
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              قطع مفردة إضافية
            </label>
            <NumberInput
              value={pieces}
              onChange={setPieces}
              placeholder="0"
              min={0}
              className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base font-black font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Total Cost Display at Cost Price */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
              القيمة المسجلة بسعر التكلفة:
            </span>
            <span className="text-[11px] text-slate-500">
              سعر الكرتونة جملة: {costPerCarton.toLocaleString()} {costCurrency === 'USD' ? '$' : 'ل.س'}
            </span>
          </div>
          <span className="text-lg font-black text-purple-700 dark:text-purple-300 font-mono">
            {costCurrency === 'USD' ? '$' : ''}{totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })} {costCurrency === 'SYP' ? 'ل.س' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              تاريخ السحب
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
              ملاحظات
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: استهلاك منزلي، عينات..."
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
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
          >
            تأكيد سحب البضاعة
          </button>
        </div>
      </form>
    </Modal>
  );
};
