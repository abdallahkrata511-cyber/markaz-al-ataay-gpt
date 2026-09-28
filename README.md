# مركز العطايا لتوزيع المواد الغذائية (v3)

تطبيق محاسبة وتوزيع عربي RTL يعمل دون إنترنت (Offline-first) على أندرويد عبر Capacitor.

## التخزين
- على أندرويد: **SQLite** (`@capacitor-community/sqlite`) هو المصدر الأساسي. الجداول: products, customers, sales_invoices, sales_items, purchase_invoices, purchase_items, inventory_batches, customer_payments, suppliers, supplier_payments, expenses, cash_movements, usd_purchases, inventory_withdrawals (عبدالله/الشريك), partner_capital_transactions, exchange_rates (سجل أسعار الصرف التاريخي), app_kv, schema_migrations.
- عند أول تشغيل بعد التحديث تُرحَّل بيانات النسخة القديمة (localStorage) إلى SQLite مع تحقق من العدد، ولا تُحذف.
- في المتصفح (تطوير فقط) يُستخدم localStorage.

## أهم قواعد المحاسبة
- كل معاملة تحفظ المبلغ الأصلي + عملته + سعر الصرف وقتها ولا يُعاد حسابها بسعر اليوم.
- سعر اليوم يُستخدم فقط في "التقييم الحالي" (جرد العملاء، أثر الصرف، الصندوق).
- رصيد المورد الرئيسي بالدولار. فاتورة الشراء تقبل بنوداً بالدولار وأخرى بالليرة مع سعر صرف خاص بالفاتورة.
- رأس مال الشريك يبدأ من صفر ويتغير فقط بمعاملات إيداع/استرداد.
- سعر الصرف داخلي: يظهر داخل التطبيق ولا يُطبع على الإيصال ولا في PDF العميل.

## أوامر
```
npm install --legacy-peer-deps
npm run build
npm run test:accounting     # اختبارات المحاسبة
npx cap sync android
cd android && ./gradlew assembleDebug
```
GitHub Actions (`.github/workflows/build-apk.yml`) يبني الـAPK تلقائياً عند الدفع إلى main.

## تحسينات الجودة
- تحميل كسول (Lazy) للشاشات الثقيلة + `ErrorBoundary` يمنع انهيار التطبيق عند خطأ بشاشة واحدة.
- الكتابة إلى SQLite بالفروقات فقط (صفوف متغيّرة) داخل transaction واحدة، وقراءات متزامنة من كاش الذاكرة.
- CI: فحص الأنواع (`npm run lint`) + اختبارات المحاسبة قبل البناء.
- لا بيانات وهمية ولا رأس مال افتراضي؛ رصيد المورد مصدره واحد (كشف الحساب التاريخي).
