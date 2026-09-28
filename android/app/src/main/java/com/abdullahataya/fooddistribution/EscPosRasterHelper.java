package com.abdullahataya.fooddistribution;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextDirectionHeuristics;
import android.text.TextPaint;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * EscPosRasterHelper:
 * Renders Arabic invoices & test receipts into crisp 80mm (576 dots) monochrome bitmaps,
 * and converts them into standard ESC/POS GS v 0 raster byte commands.
 * This completely prevents Arabic letter disjoining, inverted letters, and encoding bugs on
 * thermal printers like Xprinter XP-P801A.
 */
public class EscPosRasterHelper {

    public static final int PAPER_WIDTH_80MM_DOTS = 576; // Standard 80mm print head width
    public static final int BYTES_PER_ROW_80MM = PAPER_WIDTH_80MM_DOTS / 8; // 72 bytes

    /**
     * Converts an Android Bitmap into standard ESC/POS GS v 0 raster data.
     */
    public static byte[] bitmapToEscPosRaster(Bitmap bitmap) throws IOException {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();

        // Round width up to nearest multiple of 8
        int widthBytes = (width + 7) / 8;
        int alignedWidth = widthBytes * 8;

        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // Initialize printer: ESC @
        baos.write(new byte[]{0x1B, 0x40});
        // Center alignment: ESC a 1
        baos.write(new byte[]{0x1B, 0x61, 0x01});

        // Print in slices of at most 512 lines to prevent printer buffer overrun
        int maxSliceHeight = 512;
        for (int yStart = 0; yStart < height; yStart += maxSliceHeight) {
            int sliceHeight = Math.min(maxSliceHeight, height - yStart);

            // GS v 0 m xL xH yL yH
            byte xL = (byte) (widthBytes % 256);
            byte xH = (byte) (widthBytes / 256);
            byte yL = (byte) (sliceHeight % 256);
            byte yH = (byte) (sliceHeight / 256);

            baos.write(new byte[]{0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH});

            for (int y = yStart; y < yStart + sliceHeight; y++) {
                for (int byteIdx = 0; byteIdx < widthBytes; byteIdx++) {
                    byte currentByte = 0;
                    for (int bit = 0; bit < 8; bit++) {
                        int x = byteIdx * 8 + bit;
                        if (x < width) {
                            int pixel = bitmap.getPixel(x, y);
                            int r = (pixel >> 16) & 0xFF;
                            int g = (pixel >> 8) & 0xFF;
                            int b = pixel & 0xFF;
                            // Luminance thresholding (darker than ~180 is black/printed)
                            int luminance = (int) (0.299 * r + 0.587 * g + 0.114 * b);
                            if (luminance < 185) {
                                currentByte |= (byte) (1 << (7 - bit));
                            }
                        }
                    }
                    baos.write(currentByte);
                }
            }
        }

        // Feed 4 lines: ESC d 4
        baos.write(new byte[]{0x1B, 0x64, 0x04});
        // Cut paper (partial cut): GS V 1
        baos.write(new byte[]{0x1D, 0x56, 0x01});

        return baos.toByteArray();
    }

    /**
     * Builds the exact Test Receipt specified in requirements:
     * مركز العطايا
     * اختبار الطابعة
     * Xprinter XP-P801A
     * 123456789
     * ABC
     * العربية
     * سكر
     * زيت
     * شاي
     * المجموع
     * اختبار ناجح
     */
    public static Bitmap createTestReceiptBitmap() {
        int width = PAPER_WIDTH_80MM_DOTS;
        // Pre-calculate needed height
        int estimatedHeight = 650;
        Bitmap bitmap = Bitmap.createBitmap(width, estimatedHeight, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.WHITE);

        TextPaint titlePaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        titlePaint.setColor(Color.BLACK);
        titlePaint.setTextSize(34f);
        titlePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        TextPaint subtitlePaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        subtitlePaint.setColor(Color.BLACK);
        subtitlePaint.setTextSize(26f);
        subtitlePaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        TextPaint bodyPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        bodyPaint.setColor(Color.BLACK);
        bodyPaint.setTextSize(24f);
        bodyPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));

        TextPaint linePaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        linePaint.setColor(Color.BLACK);
        linePaint.setStrokeWidth(2f);

        int y = 30;

        // Header: مركز العطايا
        y = drawCenteredText(canvas, "مركز العطايا", titlePaint, width, y) + 10;
        // اختبار الطابعة
        y = drawCenteredText(canvas, "اختبار الطابعة", subtitlePaint, width, y) + 10;
        // Xprinter XP-P801A
        y = drawCenteredText(canvas, "Xprinter XP-P801A", subtitlePaint, width, y) + 15;

        // Divider
        canvas.drawLine(20, y, width - 20, y, linePaint);
        y += 20;

        // Required test elements
        String[] lines = new String[]{
                "الأرقام: 123456789",
                "الأحرف الإنجليزية: ABC",
                "اللغة العربية: العربية",
                "منتج 1: سكر",
                "منتج 2: زيت",
                "منتج 3: شاي",
                "المجموع: 100%",
                "الحالة: اختبار ناجح ✓"
        };

        for (String line : lines) {
            y = drawRtlText(canvas, line, bodyPaint, width - 40, 20, y) + 12;
        }

        // Divider
        y += 10;
        canvas.drawLine(20, y, width - 20, y, linePaint);
        y += 20;

        // Date and note
        y = drawCenteredText(canvas, "تم بنجاح اختبار الاتصال والخط العربي", bodyPaint, width, y) + 40;

        // Trim bitmap to actual content height
        return Bitmap.createBitmap(bitmap, 0, 0, width, Math.min(y, estimatedHeight));
    }

    /**
     * Builds the full Sales Invoice Receipt Bitmap (80mm / 576 dots) with Arabic RTL rendering.
     * Respects:
     * - Fixed USD: shows USD amounts without customer exchange rate.
     * - RTL table alignment with correct line wrapping.
     */
    public static Bitmap createInvoiceReceiptBitmap(JSONObject invoice, String centerName, String centerAddress, String centerPhone) {
        int width = PAPER_WIDTH_80MM_DOTS;

        // Temporary canvas to measure
        int initialHeight = 2200;
        Bitmap tempBitmap = Bitmap.createBitmap(width, initialHeight, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(tempBitmap);
        canvas.drawColor(Color.WHITE);

        TextPaint headerPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        headerPaint.setColor(Color.BLACK);
        headerPaint.setTextSize(32f);
        headerPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        TextPaint subHeaderPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        subHeaderPaint.setColor(Color.BLACK);
        subHeaderPaint.setTextSize(22f);
        subHeaderPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));

        TextPaint boldBodyPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        boldBodyPaint.setColor(Color.BLACK);
        boldBodyPaint.setTextSize(24f);
        boldBodyPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));

        TextPaint regularBodyPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        regularBodyPaint.setColor(Color.BLACK);
        regularBodyPaint.setTextSize(22f);
        regularBodyPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));

        Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        linePaint.setColor(Color.BLACK);
        linePaint.setStrokeWidth(2f);

        Paint dashedPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dashedPaint.setColor(Color.BLACK);
        dashedPaint.setStrokeWidth(1.5f);

        int y = 25;

        // 1. Center Name
        String nameStr = centerName != null && !centerName.isEmpty() ? centerName : "مركز العطايا لتوزيع المواد الغذائية";
        y = drawCenteredText(canvas, nameStr, headerPaint, width, y) + 8;

        if (centerAddress != null && !centerAddress.isEmpty()) {
            y = drawCenteredText(canvas, centerAddress, subHeaderPaint, width, y) + 6;
        }
        if (centerPhone != null && !centerPhone.isEmpty()) {
            y = drawCenteredText(canvas, "هاتف: " + centerPhone, subHeaderPaint, width, y) + 8;
        }

        // Header Divider
        y += 10;
        canvas.drawLine(15, y, width - 15, y, linePaint);
        y += 20;

        // 2. Invoice Details (Metadata)
        String invoiceNumber = invoice.optString("invoiceNumber", "-");
        String dateStr = invoice.optString("dateFormatted", invoice.optString("date", "-"));
        String customerName = invoice.optString("customerName", "-");
        String customerShop = invoice.optString("customerShop", "");
        String currency = invoice.optString("currency", "SYP");
        boolean isUSD = "USD".equalsIgnoreCase(currency);
        String currSymbol = isUSD ? "$" : "ل.س";

        y = drawKeyValueRow(canvas, "رقم الفاتورة:", invoiceNumber, boldBodyPaint, width, y) + 8;
        y = drawKeyValueRow(canvas, "التاريخ:", dateStr, regularBodyPaint, width, y) + 8;
        y = drawKeyValueRow(canvas, "اسم العميل:", customerName, boldBodyPaint, width, y) + 8;
        if (!customerShop.isEmpty()) {
            y = drawKeyValueRow(canvas, "المحل:", customerShop, regularBodyPaint, width, y) + 8;
        }

        // Table Divider
        y += 10;
        canvas.drawLine(15, y, width - 15, y, linePaint);
        y += 18;

        // 3. Table Header
        drawTableRow(canvas, "المنتج", "الكمية", "السعر", "الإجمالي", boldBodyPaint, width, y);
        y += 30;
        canvas.drawLine(15, y, width - 15, y, dashedPaint);
        y += 15;

        // 4. Products Table Items
        JSONArray items = invoice.optJSONArray("items");
        if (items != null) {
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;

                String prodName = item.optString("productName", "-");
                int cartons = item.optInt("cartons", 0);
                int pieces = item.optInt("pieces", 0);
                String unit = item.optString("unit", "طرد");
                double unitPrice = item.optDouble("unitPrice", 0.0);
                double itemTotal = item.optDouble("itemTotal", 0.0);

                String qtyStr;
                if (pieces > 0) {
                    qtyStr = cartons + " ك + " + pieces + " ق";
                } else {
                    qtyStr = cartons + " " + unit;
                }

                String priceStr = formatNumber(unitPrice);
                String totalStr = formatNumber(itemTotal);

                drawTableRow(canvas, prodName, qtyStr, priceStr, totalStr, regularBodyPaint, width, y);
                y += 32;
            }
        }

        // Totals Divider
        y += 10;
        canvas.drawLine(15, y, width - 15, y, linePaint);
        y += 20;

        // 5. Totals Block
        double subtotal = invoice.optDouble("subtotal", 0.0);
        double discount = invoice.optDouble("discount", 0.0);
        double finalTotal = invoice.optDouble("finalTotal", 0.0);
        double paidAmount = invoice.optDouble("paidAmount", 0.0);
        double remainingDebt = invoice.optDouble("remainingDebt", 0.0);
        double prevBalance = invoice.optDouble("previousCustomerBalance", 0.0);

        if (prevBalance > 0) {
            y = drawKeyValueRow(canvas, "رصيد سابق:", formatNumber(prevBalance) + " " + currSymbol, regularBodyPaint, width, y) + 8;
        }

        y = drawKeyValueRow(canvas, "المجموع:", formatNumber(finalTotal) + " " + currSymbol, boldBodyPaint, width, y) + 8;

        if (discount > 0) {
            y = drawKeyValueRow(canvas, "الخصم:", formatNumber(discount) + " " + currSymbol, regularBodyPaint, width, y) + 8;
        }

        y = drawKeyValueRow(canvas, "المدفوع:", formatNumber(paidAmount) + " " + currSymbol, boldBodyPaint, width, y) + 8;

        double totalRemaining = (prevBalance > 0) ? (prevBalance + finalTotal - paidAmount) : remainingDebt;
        y = drawKeyValueRow(canvas, "الباقي عليه:", formatNumber(totalRemaining) + " " + currSymbol, boldBodyPaint, width, y) + 15;

        // IMPORTANT (Prompt Rule #8): If fixed in USD, NEVER print the exchange rate!
        // We do NOT draw exchange rate here.

        // Footer Divider
        canvas.drawLine(15, y, width - 15, y, linePaint);
        y += 20;

        // 6. Notes & Footer
        String notes = invoice.optString("notes", "");
        if (!notes.isEmpty()) {
            y = drawRtlText(canvas, "ملاحظات: " + notes, subHeaderPaint, width - 40, 20, y) + 12;
        }

        y = drawCenteredText(canvas, "شكراً لتعاملكم معنا - مركز العطايا", subHeaderPaint, width, y) + 50;

        return Bitmap.createBitmap(tempBitmap, 0, 0, width, Math.min(y, initialHeight));
    }

    private static int drawCenteredText(Canvas canvas, String text, TextPaint paint, int width, int y) {
        StaticLayout layout = StaticLayout.Builder.obtain(text, 0, text.length(), paint, width - 40)
                .setAlignment(Layout.Alignment.ALIGN_CENTER)
                .setTextDirection(TextDirectionHeuristics.RTL)
                .build();
        canvas.save();
        canvas.translate(20, y);
        layout.draw(canvas);
        canvas.restore();
        return y + layout.getHeight();
    }

    private static int drawRtlText(Canvas canvas, String text, TextPaint paint, int width, int x, int y) {
        StaticLayout layout = StaticLayout.Builder.obtain(text, 0, text.length(), paint, width)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setTextDirection(TextDirectionHeuristics.RTL)
                .build();
        canvas.save();
        canvas.translate(x, y);
        layout.draw(canvas);
        canvas.restore();
        return y + layout.getHeight();
    }

    private static int drawKeyValueRow(Canvas canvas, String label, String value, TextPaint paint, int width, int y) {
        // Draw label on the right (RTL), value on the left
        canvas.drawText(label, width - 25 - paint.measureText(label), y + 20, paint);
        canvas.drawText(value, 25, y + 20, paint);
        return y + 24;
    }

    private static void drawTableRow(Canvas canvas, String colProd, String colQty, String colPrice, String colTotal, TextPaint paint, int width, int y) {
        // 80mm column distribution:
        // Right: Product name (width: ~220)
        // Mid-Right: Qty (width: ~110)
        // Mid-Left: Price (width: ~110)
        // Left: Total (width: ~110)
        float totalWidth = paint.measureText(colTotal);
        canvas.drawText(colTotal, 20, y + 18, paint);

        float priceWidth = paint.measureText(colPrice);
        canvas.drawText(colPrice, 150, y + 18, paint);

        float qtyWidth = paint.measureText(colQty);
        canvas.drawText(colQty, 270, y + 18, paint);

        // Product name on right (truncated if exceeds)
        String trimmedProd = colProd;
        if (trimmedProd.length() > 14) {
            trimmedProd = trimmedProd.substring(0, 13) + "…";
        }
        float prodWidth = paint.measureText(trimmedProd);
        canvas.drawText(trimmedProd, width - 20 - prodWidth, y + 18, paint);
    }

    private static String formatNumber(double num) {
        if (num == (long) num) {
            return String.format("%,d", (long) num);
        } else {
            return String.format("%,.2f", num);
        }
    }
}
