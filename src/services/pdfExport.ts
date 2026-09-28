import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Invoice, AppSettings } from '../types';

export type PdfPageSize = '80mm' | 'a4';

export interface InvoicePdfResult {
  success: boolean;
  filename: string;
  error?: string;
  uri?: string;
}

/**
 * Builds an isolated, perfectly formatted HTML string for the invoice.
 * Uses only standard hex/rgb colors (NO oklch) to avoid html2canvas parser errors.
 * Includes complete required details:
 * - مركز العطايا لتوزيع المواد الغذائية
 * - Invoice number, date and time
 * - Customer name, shop name
 * - Previous customer balance
 * - Products, quantity (cartons + pieces), unit price, line total
 * - Subtotal, discount, grand total, paid amount, remaining debt
 * - Syrian Pounds (SYP) currency display
 * - Arabic RTL layout
 */
export const buildInvoiceHtml = (
  invoice: Invoice,
  settings: AppSettings,
  pageSize: PdfPageSize = '80mm'
): string => {
  // الطباعة تستخدم سعر صرف الفاتورة التاريخي (داخلياً فقط) ولا تطبع السعر نفسه أبداً
  const rate = invoice.exchangeRate || invoice.fixedExchangeRate || settings.exchangeRate || 15000;
  const isUSD = invoice.currency === 'USD';
  const toSYP = (amt: number) => (isUSD ? Math.round(amt * rate) : amt);

  const finalTotalSYP = toSYP(invoice.finalTotal);
  const paidAmountSYP = toSYP(invoice.paidAmount);
  const previousBalanceSYP = toSYP(invoice.previousCustomerBalance || 0);
  const remainingCustomerSYP = previousBalanceSYP + finalTotalSYP - paidAmountSYP;

  const dateFormatted = new Date(invoice.date).toLocaleString('ar-SY', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const is80mm = pageSize === '80mm';
  const containerWidth = is80mm ? '360px' : '720px';
  const fontSize = is80mm ? '12px' : '14px';

  const rowsHtml = invoice.items
    .map((item, idx) => {
      const qtyText =
        item.pieces > 0
          ? `${item.cartons} ك + ${item.pieces} ق`
          : `${item.cartons} ${item.unit}`;
      const priceSYP = toSYP(item.unitPrice);
      const totalSYP = toSYP(item.itemTotal);

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 7px 4px; text-align: right; font-weight: 600; color: #0f172a;">
            ${idx + 1}. ${item.productName}
          </td>
          <td style="padding: 7px 4px; text-align: center; font-weight: 700; color: #1e293b;">
            ${qtyText}
          </td>
          <td style="padding: 7px 4px; text-align: center; color: #334155; font-family: 'Cairo', sans-serif;">
            ${priceSYP.toLocaleString('en-US')}
          </td>
          <td style="padding: 7px 4px; text-align: left; font-weight: 800; color: #0f172a; font-family: 'Cairo', sans-serif;">
            ${totalSYP.toLocaleString('en-US')} ل.س
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="
      width: ${containerWidth};
      background-color: #ffffff;
      color: #0f172a;
      direction: rtl;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: ${fontSize};
      line-height: 1.5;
      padding: ${is80mm ? '16px' : '32px'};
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      margin: 0 auto;
    ">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 12px; margin-bottom: 12px;">
        <h1 style="margin: 0 0 4px 0; font-size: ${is80mm ? '18px' : '22px'}; font-weight: 900; color: #153243;">
          ${settings.centerName || 'مركز العطايا لتوزيع المواد الغذائية'}
        </h1>
        ${settings.centerAddress ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${settings.centerAddress}</div>` : ''}
        ${settings.centerPhone ? `<div style="font-size: 11px; color: #334155; font-weight: 700; margin-top: 2px;">هاتف: ${settings.centerPhone}</div>` : ''}
      </div>

      <!-- Invoice Details Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: ${is80mm ? '11px' : '13px'};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #64748b;">رقم الفاتورة:</span>
          <span style="font-weight: 800; color: #0f172a; font-family: 'Cairo', sans-serif;">${invoice.invoiceNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #64748b;">التاريخ والوقت:</span>
          <span style="font-weight: 600; color: #334155;">${dateFormatted}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #64748b;">العميل / المحل:</span>
          <span style="font-weight: 800; color: #0f172a;">${invoice.customerName} ${invoice.customerShop ? `(${invoice.customerShop})` : ''}</span>
        </div>
        ${invoice.notes ? `
          <div style="display: flex; justify-content: space-between; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #cbd5e1;">
            <span style="color: #64748b;">ملاحظات:</span>
            <span style="color: #475569;">${invoice.notes}</span>
          </div>
        ` : ''}
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: ${is80mm ? '11px' : '13px'};">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 6px 4px; text-align: right; color: #334155; font-weight: 800;">المادة</th>
            <th style="padding: 6px 4px; text-align: center; color: #334155; font-weight: 800;">الكمية</th>
            <th style="padding: 6px 4px; text-align: center; color: #334155; font-weight: 800;">السعر</th>
            <th style="padding: 6px 4px; text-align: left; color: #334155; font-weight: 800;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Financial Totals -->
      <div style="border-top: 2px dashed #94a3b8; padding-top: 10px; font-size: ${is80mm ? '11px' : '13px'};">
        <div style="display: flex; justify-content: space-between; padding: 3px 0; color: #475569;">
          <span>الرصيد السابق بذمّة العميل:</span>
          <span style="font-weight: 700; font-family: 'Cairo', sans-serif; color: #0f172a;">
            ${previousBalanceSYP.toLocaleString('en-US')} ل.س
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; padding: 3px 0; color: #0f172a; font-weight: 800;">
          <span>قيمة الفاتورة الحالية:</span>
          <span style="font-family: 'Cairo', sans-serif;">
            ${finalTotalSYP.toLocaleString('en-US')} ل.س
          </span>
        </div>

        ${invoice.discount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 3px 0; color: #16a34a; font-weight: 700;">
            <span>الخصم الممنوح:</span>
            <span style="font-family: 'Cairo', sans-serif;">- ${toSYP(invoice.discount).toLocaleString('en-US')} ل.س</span>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; padding: 3px 0; color: #475569;">
          <span>المبلغ المدفوع نقداً:</span>
          <span style="font-weight: 700; font-family: 'Cairo', sans-serif; color: #15803d;">
            ${paidAmountSYP.toLocaleString('en-US')} ل.س
          </span>
        </div>

        <!-- Grand Remaining Balance -->
        <div style="
          margin-top: 8px;
          padding: 8px 10px;
          background-color: #153243;
          color: #ffffff;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 900;
          font-size: ${is80mm ? '13px' : '15px'};
        ">
          <span>صافي الحساب المتبقي:</span>
          <span style="font-family: 'Cairo', sans-serif; color: #ffaa47;">
            ${remainingCustomerSYP.toLocaleString('en-US')} ل.س
          </span>
        </div>
      </div>

      <!-- Footer Note -->
      <div style="text-align: center; color: #64748b; font-size: 10px; margin-top: 14px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
        ${settings.receiptFooter || 'شكراً لتعاملكم مع مركز العطايا - نتمنى لكم دوام التوفيق والبركة'}
      </div>
    </div>
  `;
};

/**
 * Creates a real jsPDF document instance from the rendered invoice HTML.
 * Renders into an off-screen container safely without oklch colors.
 */
export const generateInvoicePdfDoc = async (
  invoice: Invoice,
  settings: AppSettings,
  pageSize: PdfPageSize = '80mm'
): Promise<jsPDF> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.zIndex = '-9999';
  container.style.opacity = '1';
  container.innerHTML = buildInvoiceHtml(invoice, settings, pageSize);
  document.body.appendChild(container);

  try {
    const targetEl = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(targetEl || container, {
      scale: 2.2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgWidthPx = canvas.width;
    const imgHeightPx = canvas.height;

    if (pageSize === '80mm') {
      const pdfWidthMm = 80;
      const marginMm = 3;
      const printableWidthMm = pdfWidthMm - marginMm * 2;
      const pdfHeightMm = (imgHeightPx * printableWidthMm) / imgWidthPx + marginMm * 2;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidthMm, Math.max(pdfHeightMm, 100)],
      });

      pdf.addImage(
        imgData,
        'JPEG',
        marginMm,
        marginMm,
        printableWidthMm,
        (imgHeightPx * printableWidthMm) / imgWidthPx
      );
      return pdf;
    } else {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidthMm = 210;
      const marginMm = 15;
      const printableWidthMm = Math.min(150, pdfWidthMm - marginMm * 2);
      const renderHeightMm = (imgHeightPx * printableWidthMm) / imgWidthPx;
      const xOffset = (pdfWidthMm - printableWidthMm) / 2;

      pdf.addImage(imgData, 'JPEG', xOffset, marginMm, printableWidthMm, renderHeightMm);
      return pdf;
    }
  } finally {
    document.body.removeChild(container);
  }
};

/**
 * Builds the unique sanitized filename for the invoice.
 * Example: invoice-123-2026-09-21.pdf
 */
export const getInvoicePdfFileName = (invoice: Invoice): string => {
  const cleanNum = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  const dateStr = invoice.date ? invoice.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `invoice-${cleanNum || 'bill'}-${dateStr}.pdf`;
};

/**
 * Converts ArrayBuffer / binary to base64 string safely without browser stack overflow.
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

/**
 * Saves the invoice PDF file locally.
 * - On Native Android (Capacitor): writes real PDF binary to Cache/Documents directory
 * - On Web / Desktop Browser: downloads real .pdf file directly
 */
export const saveInvoicePdfLocally = async (
  invoice: Invoice,
  settings: AppSettings,
  pageSize: PdfPageSize = '80mm'
): Promise<InvoicePdfResult> => {
  const filename = getInvoicePdfFileName(invoice);

  try {
    const pdfDoc = await generateInvoicePdfDoc(invoice, settings, pageSize);

    if (Capacitor.isNativePlatform()) {
      const pdfArrayBuffer = pdfDoc.output('arraybuffer');
      const base64Data = arrayBufferToBase64(pdfArrayBuffer);

      // Write to Cache directory (temporary/cache location with unique filename)
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      return {
        success: true,
        filename,
        uri: writeResult.uri,
      };
    } else {
      // Standard browser download
      pdfDoc.save(filename);
      return {
        success: true,
        filename,
      };
    }
  } catch (error: any) {
    console.error('Error saving invoice PDF:', error);
    return {
      success: false,
      filename,
      error: error?.message || 'تعذر إنشاء ملف PDF',
    };
  }
};

/**
 * Shares the real PDF file using Android Native Sharesheet (ACTION_SEND with application/pdf & FileProvider)
 * Compatible with WhatsApp, Telegram, Gmail, Drive, Bluetooth, etc.
 * Falls back to Web Share API or download in browser.
 */
export const shareInvoicePdf = async (
  invoice: Invoice,
  settings: AppSettings,
  pageSize: PdfPageSize = '80mm'
): Promise<InvoicePdfResult> => {
  const filename = getInvoicePdfFileName(invoice);

  try {
    const pdfDoc = await generateInvoicePdfDoc(invoice, settings, pageSize);
    const pdfArrayBuffer = pdfDoc.output('arraybuffer');
    const base64Data = arrayBufferToBase64(pdfArrayBuffer);

    if (Capacitor.isNativePlatform()) {
      // 1. Write the real PDF to native Cache directory
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      // 2. Open Android Native Sharesheet with real file URI (content:// through FileProvider)
      await Share.share({
        title: `فاتورة - ${invoice.invoiceNumber}`,
        text: `فاتورة مبيعات رقم ${invoice.invoiceNumber} - ${settings.centerName}`,
        url: fileResult.uri,
        dialogTitle: 'مشاركة الفاتورة عبر',
      });

      return {
        success: true,
        filename,
        uri: fileResult.uri,
      };
    } else {
      // Desktop / Mobile Web fallback
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `فاتورة - ${invoice.invoiceNumber}`,
          text: `فاتورة مبيعات رقم ${invoice.invoiceNumber} - ${settings.centerName}`,
        });
        return { success: true, filename };
      } else {
        // Fallback to downloading real PDF
        pdfDoc.save(filename);
        return { success: true, filename };
      }
    }
  } catch (error: any) {
    // If user cancelled Android share dialog, it is not an error
    if (error?.message && error.message.toLowerCase().includes('canceled')) {
      return { success: true, filename };
    }
    console.error('Error sharing invoice PDF:', error);
    return {
      success: false,
      filename,
      error: error?.message || 'تعذر مشاركة الفاتورة',
    };
  }
};

/**
 * Builds clean HTML for the Daily Inventory Audit (Jard) Report for PDF export
 */
export const buildInventoryAuditHtml = (
  auditData: any,
  settings: AppSettings,
  auditDateStr?: string
): string => {
  const rate = auditData.exchangeRate || settings.exchangeRate || 15000;
  const dateStr = auditDateStr || new Date().toLocaleDateString('ar-SY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #1e293b; background: #ffffff; padding: 24px; max-width: 780px; margin: 0 auto; line-height: 1.5;">
      
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 22px; color: #0f766e; font-weight: bold;">
          ${settings.centerName || 'مركز العطايا لتوزيع المواد الغذائية'}
        </h1>
        <div style="font-size: 16px; font-weight: bold; color: #1e293b; margin-top: 6px;">
          تقرير الجرد والمركز المالي اليومي الشامل (Jard)
        </div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
          التاريخ: <strong>${dateStr}</strong> | سعر الصرف المعتمد: <strong>${rate.toLocaleString()} ل.س / $</strong>
        </div>
      </div>

      <!-- Quick KPI Badges -->
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px; text-align: center;">
          <div style="font-size: 12px; color: #166534; font-weight: bold;">الرصيد النقدي بالليرة</div>
          <div style="font-size: 18px; font-weight: bold; color: #14532d; margin-top: 4px;">
            ${auditData.cashSYP.toLocaleString()} <span style="font-size: 12px;">ل.س</span>
          </div>
        </div>
        <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px; text-align: center;">
          <div style="font-size: 12px; color: #1e40af; font-weight: bold;">الرصيد النقدي بالدولار</div>
          <div style="font-size: 18px; font-weight: bold; color: #1e3a8a; margin-top: 4px;">
            $ ${auditData.cashUSD.toLocaleString()}
          </div>
        </div>
        <div style="flex: 1; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px; text-align: center;">
          <div style="font-size: 12px; color: #92400e; font-weight: bold;">قيمة بضاعة المستودع</div>
          <div style="font-size: 18px; font-weight: bold; color: #78350f; margin-top: 4px;">
            $ ${Math.round(auditData.totalInventoryInUSD).toLocaleString()}
          </div>
        </div>
      </div>

      <!-- Section: Detailed Debts & Receivables -->
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: bold; background: #f1f5f9; padding: 8px 12px; border-radius: 8px; margin: 0 0 10px 0; color: #334155; border-right: 4px solid #0ea5e9;">
          1. أرصدة الديون والذمم (بالليرة والدولار)
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: right;">
              <th style="padding: 8px;">البيان</th>
              <th style="padding: 8px;">المبلغ بالليرة السورية</th>
              <th style="padding: 8px;">المبلغ بالدولار</th>
              <th style="padding: 8px;">الإجمالي بالدولار</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">ديون العملاء الإجمالية (لنا)</td>
              <td style="padding: 8px; color: #0284c7; font-weight: bold;">${auditData.customerDebtSYP.toLocaleString()} ل.س</td>
              <td style="padding: 8px; color: #0284c7; font-weight: bold;">$ ${auditData.customerDebtUSD.toLocaleString()}</td>
              <td style="padding: 8px; font-weight: bold;">$ ${Math.round(auditData.customerDebtsInUSD).toLocaleString()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">ديون الموردين والمطالبات (علينا)</td>
              <td style="padding: 8px; color: #dc2626; font-weight: bold;">${auditData.supplierDebtSYP.toLocaleString()} ل.س</td>
              <td style="padding: 8px; color: #dc2626; font-weight: bold;">$ ${auditData.supplierDebtUSD.toLocaleString()}</td>
              <td style="padding: 8px; color: #dc2626; font-weight: bold;">$ ${Math.round(auditData.supplierDebtsInUSD).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Section: Partners & Capital Accounts -->
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 14px; font-weight: bold; background: #f1f5f9; padding: 8px 12px; border-radius: 8px; margin: 0 0 10px 0; color: #334155; border-right: 4px solid #8b5cf6;">
          2. حسابات الشركاء والمسحوبات
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: right;">
              <th style="padding: 8px;">الشخص</th>
              <th style="padding: 8px;">رأس المال</th>
              <th style="padding: 8px;">مسحوبات نقدية</th>
              <th style="padding: 8px;">مسحوبات بضاعة</th>
              <th style="padding: 8px;">إجمالي المسحوبات بالدولار</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">${auditData.partnerSummary.partnerName || 'الشريك'}</td>
              <td style="padding: 8px; font-weight: bold; color: #7c3aed;">$ ${auditData.partnerSummary.totalCapitalUSD.toLocaleString()}</td>
              <td style="padding: 8px;">${auditData.partnerSummary.partnerCashSYP.toLocaleString()} ل.س + $${auditData.partnerSummary.partnerCashUSD}</td>
              <td style="padding: 8px;">${auditData.partnerSummary.partnerGoodsSYP.toLocaleString()} ل.س + $${auditData.partnerSummary.partnerGoodsUSD}</td>
              <td style="padding: 8px; font-weight: bold; color: #b91c1c;">$ ${Math.round(auditData.partnerSummary.partnerTotalWithdrawnUSD).toLocaleString()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">عبدالله (الإدارة)</td>
              <td style="padding: 8px; color: #64748b;">(مجهود وإدارة)</td>
              <td style="padding: 8px;">${auditData.partnerSummary.abdallahCashSYP.toLocaleString()} ل.س + $${auditData.partnerSummary.abdallahCashUSD}</td>
              <td style="padding: 8px;">${auditData.partnerSummary.abdallahGoodsSYP.toLocaleString()} ل.س + $${auditData.partnerSummary.abdallahGoodsUSD}</td>
              <td style="padding: 8px; font-weight: bold; color: #b91c1c;">$ ${Math.round(auditData.partnerSummary.abdallahTotalWithdrawnUSD).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Section: Final Project Position Summary (صافي المشروع) -->
      <div style="background: #0f172a; color: #ffffff; border-radius: 16px; padding: 20px; margin-top: 24px;">
        <div style="font-size: 15px; font-weight: bold; margin-bottom: 14px; text-align: center; color: #38bdf8;">
          النتيجة الختامية: صافي القيمة الفعلية للمشروع (Equity & Net Worth)
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 8px; font-size: 13px;">
          <span>إجمالي الموجودات (نقدية + بضاعة + ديون عملاء):</span>
          <span style="font-weight: bold; color: #4ade80;">$ ${Math.round(auditData.totalAssetsUSD).toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding: 8px 0; font-size: 13px;">
          <span>إجمالي الالتزامات (ديون موردين ومطالبات):</span>
          <span style="font-weight: bold; color: #f87171;">- $ ${Math.round(auditData.totalLiabilitiesUSD).toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 12px; font-size: 16px; font-weight: bold;">
          <span>الصافي الفعلي للمشروع الآن (قائم):</span>
          <span style="color: #fbbf24;">$ ${Math.round(auditData.netProjectWorthUSD).toLocaleString()} (~ ${(Math.round(auditData.netProjectWorthSYP)).toLocaleString()} ل.س)</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 8px; font-size: 12px; color: #94a3b8;">
          <span>صافي النمو والأرباح بعد احتساب مسحوبات الشركاء:</span>
          <span style="font-weight: bold; color: ${auditData.netProfitOrLossUSD >= 0 ? '#4ade80' : '#f87171'};">
            ${auditData.netProfitOrLossUSD >= 0 ? '+' : ''}$ ${Math.round(auditData.netProfitOrLossUSD).toLocaleString()}
          </span>
        </div>
      </div>

      <!-- Footer Note -->
      <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        تم استخراج هذا التقرير تلقائياً عبر نظام المحاسبة والجرد بمركز العطايا | جميع الأرقام مطابقة للحركات الفعلية
      </div>
    </div>
  `;
};

/**
 * Creates a jsPDF document for the Daily Inventory Audit (Jard) Report
 */
export const generateInventoryAuditPdfDoc = async (
  auditData: any,
  settings: AppSettings,
  auditDateStr?: string
): Promise<jsPDF> => {
  const htmlString = buildInventoryAuditHtml(auditData, settings, auditDateStr);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '780px';
  container.style.zIndex = '-9999';
  container.innerHTML = htmlString;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfDoc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdfDoc.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdfDoc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    return pdfDoc;
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
};

/**
 * Saves the Daily Inventory Audit PDF locally or downloads it.
 */
export const saveInventoryAuditPdfLocally = async (
  auditData: any,
  settings: AppSettings,
  auditDateStr?: string
): Promise<InvoicePdfResult> => {
  const dateFormatted = auditDateStr || new Date().toISOString().slice(0, 10);
  const filename = `jard-alataya-${dateFormatted}.pdf`;

  try {
    const pdfDoc = await generateInventoryAuditPdfDoc(auditData, settings, auditDateStr);
    const pdfArrayBuffer = pdfDoc.output('arraybuffer');
    const base64Data = arrayBufferToBase64(pdfArrayBuffer);

    if (Capacitor.isNativePlatform()) {
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      return { success: true, filename, uri: fileResult.uri };
    } else {
      pdfDoc.save(filename);
      return { success: true, filename };
    }
  } catch (error: any) {
    console.error('Error saving audit PDF:', error);
    return {
      success: false,
      filename,
      error: error?.message || 'تعذر حفظ تقرير الجرد',
    };
  }
};

/**
 * Generates and shares a Daily Inventory Audit PDF
 */
export const shareInventoryAuditPdf = async (
  auditData: any,
  settings: AppSettings,
  auditDateStr?: string
): Promise<InvoicePdfResult> => {
  const dateFormatted = auditDateStr || new Date().toISOString().slice(0, 10);
  const filename = `jard-alataya-${dateFormatted}.pdf`;

  try {
    const pdfDoc = await generateInventoryAuditPdfDoc(auditData, settings, auditDateStr);
    const pdfArrayBuffer = pdfDoc.output('arraybuffer');
    const base64Data = arrayBufferToBase64(pdfArrayBuffer);

    if (Capacitor.isNativePlatform()) {
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: `تقرير الجرد اليومي - مركز العطايا`,
        text: `تقرير الجرد والمركز المالي اليومي لمركز العطايا (${dateFormatted})`,
        url: fileResult.uri,
        dialogTitle: `مشاركة تقرير الجرد اليومي`,
      });

      return { success: true, filename, uri: fileResult.uri };
    } else {
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `تقرير الجرد اليومي`,
          text: `تقرير الجرد والمركز المالي اليومي لمركز العطايا`,
        });
        return { success: true, filename };
      } else {
        pdfDoc.save(filename);
        return { success: true, filename };
      }
    }
  } catch (error: any) {
    if (error?.message && error.message.toLowerCase().includes('canceled')) {
      return { success: true, filename };
    }
    console.error('Error sharing audit PDF:', error);
    return {
      success: false,
      filename,
      error: error?.message || 'تعذر مشاركة تقرير الجرد',
    };
  }
};

export interface CustomerAuditItem {
  id: string;
  name: string;
  shopName?: string;
  phone?: string;
  balanceSYP: number;
  balanceUSD: number;
  currentValuationUSD: number;
  historicalEquivalentUSD: number;
  valuationEffectUSD: number;
}

export interface CustomerAuditTotals {
  totalSYP: number;
  totalUSD: number;
  totalCurrentValuationUSD: number;
  totalHistoricalUSD: number;
  totalValuationEffectUSD: number;
  customersWithDebtCount: number;
}

export const buildCustomerAuditHtml = (
  items: CustomerAuditItem[],
  totals: CustomerAuditTotals,
  settings: AppSettings,
  currentRate: number
): string => {
  const dateStr = new Date().toLocaleDateString('ar-SY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows = items
    .map((c, idx) => {
      const effectSign = c.valuationEffectUSD > 0 ? '+' : '';
      const effectColor = c.valuationEffectUSD < 0 ? '#b91c1c' : c.valuationEffectUSD > 0 ? '#047857' : '#64748b';
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 6px 4px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 6px 4px; text-align: right; font-weight: 700; color: #0f172a;">
            ${c.name}
            ${c.shopName ? `<span style="font-size: 10px; color: #64748b; display: block;">${c.shopName}</span>` : ''}
          </td>
          <td style="padding: 6px 4px; text-align: center; font-family: 'Cairo', sans-serif; font-weight: 600; color: #1e293b;">
            ${c.balanceSYP !== 0 ? `${c.balanceSYP.toLocaleString('en-US')} ل.س` : '-'}
          </td>
          <td style="padding: 6px 4px; text-align: center; font-family: 'Cairo', sans-serif; font-weight: 600; color: #2563eb;">
            ${c.balanceUSD !== 0 ? `$${c.balanceUSD.toLocaleString('en-US')}` : '-'}
          </td>
          <td style="padding: 6px 4px; text-align: center; font-family: 'Cairo', sans-serif; color: #475569;">
            $${c.historicalEquivalentUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </td>
          <td style="padding: 6px 4px; text-align: center; font-family: 'Cairo', sans-serif; font-weight: 800; color: #0f172a;">
            $${c.currentValuationUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </td>
          <td style="padding: 6px 4px; text-align: left; font-family: 'Cairo', sans-serif; font-weight: 700; color: ${effectColor};">
            ${effectSign}$${c.valuationEffectUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="
      width: 780px;
      background-color: #ffffff;
      color: #0f172a;
      direction: rtl;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      padding: 28px;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      margin: 0 auto;
    ">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
        <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 900; color: #153243;">
          ${settings.centerName || 'مركز العطايا لتوزيع المواد الغذائية'}
        </h1>
        <div style="font-size: 14px; font-weight: 800; color: #2563eb;">
          تقرير جرد وتدقيق ديون العملاء وأثر تغير سعر الصرف (Customer Audit)
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
          تاريخ التقرير: ${dateStr} • سعر الصرف الحالي المعتمد: 1$ = ${currentRate.toLocaleString('en-US')} ل.س
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 10px; color: #64748b; display: block;">إجمالي ديون الليرة</span>
          <span style="font-size: 14px; font-weight: 800; font-family: 'Cairo', sans-serif; color: #0f172a;">
            ${totals.totalSYP.toLocaleString('en-US')} ل.س
          </span>
        </div>
        <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 10px; color: #1d4ed8; display: block;">إجمالي ديون الدولار</span>
          <span style="font-size: 14px; font-weight: 800; font-family: 'Cairo', sans-serif; color: #1d4ed8;">
            $${totals.totalUSD.toLocaleString('en-US')}
          </span>
        </div>
        <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 10px; color: #15803d; display: block;">التقييم الحالي بالدولار</span>
          <span style="font-size: 15px; font-weight: 900; font-family: 'Cairo', sans-serif; color: #15803d;">
            $${totals.totalCurrentValuationUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
        </div>
        <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; text-align: center;">
          <span style="font-size: 10px; color: #b91c1c; display: block;">أثر تغير سعر الصرف</span>
          <span style="font-size: 14px; font-weight: 800; font-family: 'Cairo', sans-serif; color: ${totals.totalValuationEffectUSD < 0 ? '#b91c1c' : '#15803d'};">
            ${totals.totalValuationEffectUSD > 0 ? '+' : ''}$${totals.totalValuationEffectUSD.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
        </div>
      </div>

      <!-- Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700;">
            <th style="padding: 7px 4px; text-align: center; width: 25px;">#</th>
            <th style="padding: 7px 4px; text-align: right;">اسم العميل / المحل</th>
            <th style="padding: 7px 4px; text-align: center;">رصيد الليرة (SYP)</th>
            <th style="padding: 7px 4px; text-align: center;">رصيد الدولار (USD)</th>
            <th style="padding: 7px 4px; text-align: center;">المعادل التاريخي ($)</th>
            <th style="padding: 7px 4px; text-align: center;">التقييم الحالي ($)</th>
            <th style="padding: 7px 4px; text-align: left;">أثر الصرف ($)</th>
          </tr>
        </thead>
        <tbody>
          ${rows.length > 0 ? rows : `<tr><td colspan="7" style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">لا توجد ديون مسجلة على العملاء</td></tr>`}
        </tbody>
      </table>

      <!-- Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b;">
        <span>تطبيق مركز العطايا لتوزيع المواد الغذائية • نظام محاسبي دقيق ثنائي العملة</span>
        <span>توقيع المحاسب / الإدارة: ..............................</span>
      </div>
    </div>
  `;
};

export const exportCustomerAuditPdf = async (
  items: CustomerAuditItem[],
  totals: CustomerAuditTotals,
  settings: AppSettings,
  currentRate: number
): Promise<InvoicePdfResult> => {
  const filename = `customer-audit-${new Date().toISOString().slice(0, 10)}.pdf`;
  const htmlString = buildCustomerAuditHtml(items, totals, settings, currentRate);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '780px';
  container.style.zIndex = '-9999';
  container.innerHTML = htmlString;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdfDoc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdfDoc.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdfDoc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    const pdfArrayBuffer = pdfDoc.output('arraybuffer');
    const base64Data = arrayBufferToBase64(pdfArrayBuffer);

    if (Capacitor.isNativePlatform()) {
      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: `تقرير جرد ديون العملاء`,
        text: `تقرير جرد ديون العملاء من مركز العطايا`,
        url: fileResult.uri,
        dialogTitle: `مشاركة تقرير جرد ديون العملاء`,
      });

      return { success: true, filename, uri: fileResult.uri };
    } else {
      pdfDoc.save(filename);
      return { success: true, filename };
    }
  } catch (error: any) {
    console.error('Error generating customer audit PDF:', error);
    return {
      success: false,
      filename,
      error: error?.message || 'تعذر إنشاء تقرير جرد العملاء',
    };
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
};

// =====================================================================
// تصدير تقارير مالية عامة (جرد العملاء/الموردين، كشف حساب...) إلى PDF متعدد الصفحات
// =====================================================================
export interface ReportColumn {
  header: string;
  align?: 'right' | 'left' | 'center';
}

const escHtml = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const buildReportHtml = (opts: {
  title: string;
  subtitle?: string;
  settings: AppSettings;
  columns: ReportColumn[];
  rows: Array<Array<string | number>>;
  totals?: Array<{ label: string; value: string }>;
  footerNote?: string;
}): string => {
  const th = opts.columns
    .map(
      (c) =>
        `<th style="padding:7px 5px;background:#0f2a3a;color:#ffffff;font-size:11px;text-align:${c.align || 'right'};border:1px solid #0f2a3a;">${escHtml(c.header)}</th>`
    )
    .join('');
  const body = opts.rows
    .map(
      (r, i) =>
        `<tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'};">` +
        r
          .map(
            (cell, ci) =>
              `<td style="padding:6px 5px;font-size:11px;color:#0f172a;border:1px solid #e2e8f0;text-align:${opts.columns[ci]?.align || 'right'};">${escHtml(cell)}</td>`
          )
          .join('') +
        '</tr>'
    )
    .join('');
  const totals = (opts.totals || [])
    .map(
      (t) =>
        `<div style="display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;"><span style="font-weight:700;color:#334155;">${escHtml(t.label)}</span><span style="font-weight:900;color:#0f172a;">${escHtml(t.value)}</span></div>`
    )
    .join('');
  return `
  <div dir="rtl" style="width:780px;background:#ffffff;color:#0f172a;font-family:'Cairo',sans-serif;padding:24px;box-sizing:border-box;">
    <div style="text-align:center;border-bottom:2px solid #FFAA47;padding-bottom:10px;margin-bottom:12px;">
      <div style="font-size:18px;font-weight:900;">${escHtml(opts.settings.centerName)}</div>
      <div style="font-size:15px;font-weight:800;margin-top:4px;">${escHtml(opts.title)}</div>
      ${opts.subtitle ? `<div style="font-size:11px;color:#475569;margin-top:3px;">${escHtml(opts.subtitle)}</div>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>
    ${totals ? `<div style="margin-top:12px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">${totals}</div>` : ''}
    ${opts.footerNote ? `<div style="margin-top:10px;font-size:10px;color:#64748b;">${escHtml(opts.footerNote)}</div>` : ''}
  </div>`;
};

export const exportReportPdf = async (
  html: string,
  filename: string,
  mode: 'save' | 'share' = 'share',
  shareTitle = 'تقرير مالي - مركز العطايا'
): Promise<InvoicePdfResult> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.zIndex = '-9999';
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
    const pdfDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdfDoc.internal.pageSize.getWidth();
    const pageH = pdfDoc.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    // تقسيم الصورة الطويلة إلى صفحات A4
    const pxPerPage = Math.floor((pageH * canvas.width) / pageW);
    let offset = 0;
    let first = true;
    while (offset < canvas.height) {
      const sliceH = Math.min(pxPerPage, canvas.height - offset);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (!first) pdfDoc.addPage();
      pdfDoc.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, (sliceH * pageW) / canvas.width);
      offset += sliceH;
      first = false;
    }
    void imgH;

    const buf = pdfDoc.output('arraybuffer');
    if (Capacitor.isNativePlatform()) {
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const fileResult = await Filesystem.writeFile({ path: filename, data: btoa(bin), directory: Directory.Cache });
      if (mode === 'share') {
        await Share.share({ title: shareTitle, url: fileResult.uri, dialogTitle: shareTitle });
      }
      return { success: true, filename, uri: fileResult.uri };
    }
    pdfDoc.save(filename);
    return { success: true, filename };
  } catch (error: any) {
    if (error?.message && String(error.message).toLowerCase().includes('cancel')) return { success: true, filename };
    console.error('Report PDF error:', error);
    return { success: false, filename, error: error?.message || 'تعذر إنشاء ملف PDF' };
  } finally {
    if (document.body.contains(container)) document.body.removeChild(container);
  }
};
