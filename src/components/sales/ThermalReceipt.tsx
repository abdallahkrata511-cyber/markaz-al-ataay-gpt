import React, { useState } from 'react';
import {
  Share2,
  Download,
  Check,
  AlertCircle,
  Copy,
  Printer,
  Bluetooth,
  ExternalLink,
  Smartphone,
  X,
  Settings,
} from 'lucide-react';
import { Invoice, AppSettings } from '../../types';
import {
  saveInvoicePdfLocally,
  shareInvoicePdf,
  PdfPageSize,
} from '../../services/pdfExport';
import { BluetoothThermalPrinter } from '../../services/bluetoothPrinter';
import { BluetoothPrinterModal } from '../settings/BluetoothPrinterModal';

interface ThermalReceiptProps {
  invoice: Invoice;
  settings: AppSettings;
  onClose?: () => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ invoice, settings, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeSize, setActiveSize] = useState<PdfPageSize>('80mm');
  const [showBtOptionsModal, setShowBtOptionsModal] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const isNative = BluetoothThermalPrinter.isNativeAndroid();
  const isUSD = invoice.currency === 'USD';
  const currSymbol = isUSD ? '$' : 'ل.س';

  const formatAmount = (num: number) => {
    if (num === Math.round(num)) {
      return num.toLocaleString('en-US');
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSharePdf = async () => {
    setIsGeneratingPdf(true);
    setStatusMessage(null);
    try {
      const res = await shareInvoicePdf(invoice, settings, activeSize);
      if (res.success) {
        setStatusMessage({ text: 'تم فتح قائمة المشاركة بنجاح', type: 'success' });
      } else {
        setStatusMessage({ text: res.error || 'تعذر مشاركة الفاتورة', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'تعذر مشاركة الفاتورة', type: 'error' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSavePdf = async () => {
    setIsGeneratingPdf(true);
    setStatusMessage(null);
    try {
      const res = await saveInvoicePdfLocally(invoice, settings, activeSize);
      if (res.success) {
        setStatusMessage({ text: 'تم حفظ الفاتورة كملف PDF بنجاح', type: 'success' });
      } else {
        setStatusMessage({ text: res.error || 'تعذر إنشاء ملف PDF', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'تعذر إنشاء ملف PDF', type: 'error' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleBluetoothPrint = async () => {
    setIsPrintingBt(true);
    setStatusMessage(null);

    // If in Web browser iframe and not native android
    if (!isNative && BluetoothThermalPrinter.isWebBluetoothBlockedByPolicy()) {
      setIsPrintingBt(false);
      setShowBtOptionsModal(true);
      return;
    }

    try {
      const isConn = await BluetoothThermalPrinter.isConnected();
      if (!isConn) {
        const connectRes = await BluetoothThermalPrinter.connect();
        if (!connectRes.success) {
          if (connectRes.isPermissionsPolicyBlocked) {
            setIsPrintingBt(false);
            setShowBtOptionsModal(true);
            return;
          }
          setStatusMessage({
            text: connectRes.error || 'لم يتم الاتصال بالطابعة، يرجى اختيار الطابعة من الإعدادات',
            type: 'error',
          });
          setShowPrinterSettings(true);
          setIsPrintingBt(false);
          return;
        }
      }

      const printOk = await BluetoothThermalPrinter.printInvoice(invoice, settings, '80mm');
      if (printOk) {
        setStatusMessage({
          text: 'تم إرسال الفاتورة بنجاح إلى طابعة Xprinter الحرارية ✓',
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: 'تعذر إرسال أمر الطباعة إلى الطابعة',
          type: 'error',
        });
      }
    } catch (e: any) {
      if (!isNative) {
        setShowBtOptionsModal(true);
      } else {
        setStatusMessage({
          text: e?.message || 'حدث خطأ أثناء الاتصال بالطابعة الحرارية',
          type: 'error',
        });
      }
    } finally {
      setIsPrintingBt(false);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let msg = `*${settings.centerName}*\n`;
    msg += `فاتورة رقم: ${invoice.invoiceNumber}\n`;
    msg += `العميل: ${invoice.customerName}\n`;
    msg += `التاريخ: ${new Date(invoice.date).toLocaleDateString('ar-SY')}\n`;
    msg += `-------------------------\n`;
    invoice.items.forEach((item) => {
      const qtyStr =
        item.pieces > 0
          ? `${item.cartons} ك و ${item.pieces} ق`
          : `${item.cartons} ${item.unit}`;
      msg += `• ${item.productName}: ${qtyStr} × ${formatAmount(item.unitPrice)} = ${formatAmount(item.itemTotal)} ${currSymbol}\n`;
    });
    msg += `-------------------------\n`;
    msg += `*المجموع:* ${formatAmount(invoice.finalTotal)} ${currSymbol}\n`;
    if (invoice.discount > 0) {
      msg += `الخصم: ${formatAmount(invoice.discount)} ${currSymbol}\n`;
    }
    msg += `المدفوع: ${formatAmount(invoice.paidAmount)} ${currSymbol}\n`;
    msg += `الباقي عليه: ${formatAmount(invoice.remainingDebt)} ${currSymbol}\n`;
    if (
      invoice.previousCustomerBalance !== undefined &&
      invoice.previousCustomerBalance > 0
    ) {
      const finalCustomerBalance =
        invoice.previousCustomerBalance + invoice.finalTotal - invoice.paidAmount;
      msg += `رصيد سابق: ${formatAmount(invoice.previousCustomerBalance)} ${currSymbol}\n`;
      msg += `*المجموع الكلي المتبقي:* ${formatAmount(finalCustomerBalance)} ${currSymbol}\n`;
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const dateFormatted = new Date(invoice.date).toLocaleString('ar-SY', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const finalTotalAmount = invoice.finalTotal;
  const paidAmount = invoice.paidAmount;
  const prevBalanceAmount = invoice.previousCustomerBalance || 0;
  const remainingDue = prevBalanceAmount > 0
    ? prevBalanceAmount + finalTotalAmount - paidAmount
    : invoice.remainingDebt;

  return (
    <div className="flex flex-col items-center gap-4 font-display">
      {/* Action Buttons Bar */}
      <div className="w-full flex flex-col gap-2.5 p-3 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
        {/* Page Size Selector */}
        <div className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <span className="font-bold text-slate-700 dark:text-slate-300 px-2">مقاس الفاتورة:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveSize('80mm')}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${
                activeSize === '80mm'
                  ? 'bg-[#FFAA47] text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              طابعة حرارية (80mm)
            </button>
            <button
              type="button"
              onClick={() => setActiveSize('a4')}
              className={`px-3 py-1.5 rounded-lg font-bold transition text-xs cursor-pointer ${
                activeSize === 'a4'
                  ? 'bg-[#FFAA47] text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              صفحة قياسية (A4)
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* 1. Bluetooth Thermal Printing (ESC/POS Native) */}
          <button
            type="button"
            onClick={handleBluetoothPrint}
            disabled={isPrintingBt}
            className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-sm transition active:scale-95 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
          >
            <Bluetooth className="w-4 h-4 stroke-[2.5]" />
            <span>{isPrintingBt ? 'جاري الإرسال للطابعة...' : 'طباعة حرارية (Xprinter)'}</span>
          </button>

          {/* 2. Share PDF */}
          <button
            type="button"
            onClick={handleSharePdf}
            disabled={isGeneratingPdf}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 px-4 bg-[#FFAA47] hover:bg-[#ff9f2c] text-slate-950 font-black rounded-xl shadow-sm transition active:scale-95 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
          >
            <Share2 className="w-4 h-4 stroke-[2.5]" />
            <span>{isGeneratingPdf ? 'جاري التجهيز...' : 'مشاركة PDF'}</span>
          </button>

          {/* 3. Save PDF */}
          <button
            type="button"
            onClick={handleSavePdf}
            disabled={isGeneratingPdf}
            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 px-4 bg-[#153243] hover:bg-[#1a3d52] text-white font-bold rounded-xl shadow-sm transition active:scale-95 text-xs sm:text-sm cursor-pointer disabled:opacity-60"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>حفظ PDF</span>
          </button>

          {/* 4. Instant Thermal Printer (window.print) */}
          <button
            type="button"
            onClick={handleBrowserPrint}
            className="flex items-center justify-center gap-1.5 py-3 px-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl shadow-xs transition active:scale-95 text-xs cursor-pointer"
            title="طباعة عبر طابعة النظام"
          >
            <Printer className="w-4 h-4 text-blue-500" />
            <span className="hidden sm:inline">طباعة النظام</span>
          </button>

          {/* 5. Printer settings */}
          <button
            type="button"
            onClick={() => setShowPrinterSettings(true)}
            className="flex items-center justify-center gap-1.5 py-3 px-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-xl shadow-xs transition active:scale-95 text-xs cursor-pointer"
            title="إعدادات طابعة البلوتوث"
          >
            <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>

          {/* 6. Copy text helper */}
          <button
            type="button"
            onClick={handleCopyText}
            className="flex items-center justify-center gap-1.5 py-3 px-3 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-xs transition active:scale-95 text-xs cursor-pointer"
            title="نسخ نص الفاتورة"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/80'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* The Printable Thermal Receipt Paper (80mm standard width) */}
      <div
        id="thermal-receipt-print-area"
        className="w-full max-w-[340px] bg-white border border-slate-300 shadow-md p-5 rounded-sm text-slate-900 text-sm leading-relaxed"
        dir="rtl"
      >
        {/* Receipt Header */}
        <div className="text-center pb-3 border-b-2 border-dashed border-slate-400">
          <h2 className="text-lg font-black tracking-wide text-black">{settings.centerName}</h2>
          {settings.centerAddress && (
            <p className="text-xs text-slate-600 mt-1">{settings.centerAddress}</p>
          )}
          {settings.centerPhone && (
            <p className="text-xs text-slate-700 font-bold mt-0.5">هاتف: {settings.centerPhone}</p>
          )}
        </div>

        {/* Invoice Metadata */}
        <div className="py-2 text-xs border-b border-dashed border-slate-400 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">رقم الفاتورة:</span>
            <span className="font-bold">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">التاريخ:</span>
            <span>{dateFormatted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">اسم العميل:</span>
            <span className="font-bold">{invoice.customerName}</span>
          </div>
          {invoice.customerShop && (
            <div className="flex justify-between">
              <span className="text-slate-600">المحل:</span>
              <span>{invoice.customerShop}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="py-2.5">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-400 text-slate-700 pb-1 font-bold">
                <th className="pb-1">اسم المنتج</th>
                <th className="pb-1 text-center">الكمية</th>
                <th className="pb-1 text-center">السعر</th>
                <th className="pb-1 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoice.items.map((item, idx) => {
                const qtyText =
                  item.pieces > 0
                    ? `${item.cartons} ك + ${item.pieces} ق`
                    : `${item.cartons} ${item.unit}`;

                return (
                  <tr key={idx} className="py-1">
                    <td className="py-1.5 font-medium text-slate-900 max-w-[110px] break-words">
                      {item.productName}
                    </td>
                    <td className="py-1.5 text-center font-bold text-slate-800">{qtyText}</td>
                    <td className="py-1.5 text-center">{formatAmount(item.unitPrice)}</td>
                    <td className="py-1.5 text-left font-bold">{formatAmount(item.itemTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        {/* Strictly compliant with prompt rule #8: No exchange rate printed for fixed USD */}
        <div className="pt-2.5 border-t-2 border-dashed border-slate-400 space-y-1.5 text-xs">
          {prevBalanceAmount > 0 && (
            <div className="flex justify-between text-slate-800 font-semibold">
              <span>رصيد سابق:</span>
              <span className="font-bold">
                {formatAmount(prevBalanceAmount)} {currSymbol}
              </span>
            </div>
          )}

          <div className="flex justify-between font-bold text-slate-900">
            <span>المجموع:</span>
            <span>
              {formatAmount(finalTotalAmount)} {currSymbol}
            </span>
          </div>

          {invoice.discount > 0 && (
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>الخصم:</span>
              <span>
                {formatAmount(invoice.discount)} {currSymbol}
              </span>
            </div>
          )}

          <div className="flex justify-between text-slate-800 font-semibold">
            <span>المدفوع:</span>
            <span className="font-bold text-black">
              {formatAmount(paidAmount)} {currSymbol}
            </span>
          </div>

          <div className="pt-2 border-t-2 border-slate-900 flex justify-between text-sm font-black text-black">
            <span>الباقي عليه:</span>
            <span>
              {formatAmount(remainingDue)} {currSymbol}
            </span>
          </div>
        </div>

        {/* Receipt Footer */}
        <div className="mt-4 pt-3 border-t border-dashed border-slate-400 text-center text-[11px] text-slate-600">
          <p>{settings.receiptFooter || 'شكراً لتعاملكم معنا - مركز العطايا'}</p>
        </div>
      </div>

      {/* Printer Settings Modal */}
      {showPrinterSettings && (
        <BluetoothPrinterModal
          isOpen={showPrinterSettings}
          onClose={() => setShowPrinterSettings(false)}
          centerName={settings.centerName}
        />
      )}

      {/* Browser Fallback Options Modal */}
      {showBtOptionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs font-display" dir="rtl">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-right flex flex-col">
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Printer className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">خيارات الطباعة الحرارية</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">حلول الطباعة المتوافقة مع طابعة Xprinter</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBtOptionsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs overflow-y-auto max-h-[75vh]">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">تطبيق Android الأصلي (APK):</p>
                  <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                    في تطبيق الأندرويد، يتصل التطبيق مباشرة بطابعتك Xprinter XP-P801A عبر البلوتوث الكلاسيكي ويرسل الفاتورة كصورة نقطية فورية دون الحاجة لأي تطبيق خارجي.
                  </p>
                </div>
              </div>

              {/* Option 1: Direct System / Bluetooth Print */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    1. الطباعة عبر طابعة النظام
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    طباعة مباشرة عبر الطابعة المعرفة في نظام الجهاز بمقاس 80 ملم.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowBtOptionsModal(false);
                    handleBrowserPrint();
                  }}
                  className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة النظام</span>
                </button>
              </div>

              {/* Option 2: Share PDF */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    2. مشاركة الفاتورة كـ PDF
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    مشاركة ملف PDF الحراري مباشرة للعميل عبر واتساب أو حفظه.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowBtOptionsModal(false);
                    handleSharePdf();
                  }}
                  className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl bg-[#FFAA47] hover:bg-[#ff9f2c] text-slate-950 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة PDF</span>
                </button>
              </div>

              {/* Option 3: Full window */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    3. فتح التطبيق في نافذة مستقلة
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    فتح التطبيق في متصفح خارجي مستقل خارج نافذة العرض.
                  </p>
                </div>
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح بنافذة كاملة</span>
                </a>
              </div>
            </div>

            <div className="p-4 bg-slate-100 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowBtOptionsModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
