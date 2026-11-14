# وصل (Wasl)

منصة بتربط متاجر **سلة وزد وWooCommerce** بوكلاء الذكاء الاصطناعي. الوكيل بيدوّر على المنتجات، وبيجهّز للعميل **رابط شراء**، والعميل **بيدفع على موقع التاجر نفسه** بأي طريقة متاحة هناك، حتى الدفع عند الاستلام. وصل ما بيستلمش أي فلوس.

```
متجر سلة / زد / WooCommerce ──(API + Webhooks)──► وصل: كتالوج موحد
                                                    │
        ┌───────────────────────────────────────────┼──────────────────┐
        ▼                                           ▼                  ▼
  MCP server (/api/mcp)                     REST API (/api/v1)     llms.txt
        │
        ▼
  الوكيل يدي العميل رابط /c/{token} ──302──► صفحة المنتج أو السلة عند التاجر (+ wasl_ref)
                                                    │
                       webhook الطلب ◄──────────────┘  ← نسب الطلب: دقيق / محتمل
```

## الحالة الحالية

| الجزء | الحالة |
|---|---|
| MCP server: `search_products` و`get_product` و`create_checkout_link` | ✅ مُختبر، وكمان مع عميل MCP SDK الرسمي |
| REST API: البحث والمنتج ورابط الشراء | ✅ |
| روابط شراء موقّعة (HMAC) وتسجيل الضغطات وتحويل 302 | ✅ |
| بحث عربي/إنجليزي (توحيد الهمزات والتاء المربوطة وحذف "ال") + فلترة بالدولة والسعر | ✅ |
| موصل WooCommerce: الربط والمزامنة والسلة الجاهزة والـ Webhooks والنسب الدقيق (مع الإضافة) | ✅ في الكود، ⚠️ محتاج تجربة على متجر حقيقي |
| موصل سلة: Easy Mode والمزامنة والـ Webhooks وتجديد التوكن | ✅ في الكود، ⚠️ محتاج تطبيق في بوابة الشركاء ومتجر تجريبي |
| موصل زد: OAuth والمزامنة والـ Webhooks | ✅ في الكود، ⚠️ بعض أسماء الحقول غير مؤكدة (شوف `docs/API_RESEARCH.md`) |
| نسب الطلبات (دقيق / محتمل خلال 48 ساعة) | ✅ |
| قاعدة بيانات Supabase مع تشفير التوكنات (AES-256-GCM) | ✅ في الكود، ⚠️ ما اتجربتش على مشروع Supabase حقيقي |
| لوحة التاجر، وفيد Google Merchant، وUCP، والاشتراكات | ⏭ الخطوة الجاية |

## التشغيل محلياً

```bash
npm install
npm run dev        # http://localhost:3000 — من غير Supabase بيشتغل على بيانات تجريبية في الذاكرة
npm test           # 26 اختبار
npm run typecheck
```

جرّب الـ MCP:
```bash
curl -s localhost:3000/api/mcp -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"عطر عود","country":"SA"}}}'
```

## النشر على Vercel

1. **Supabase:** اعمل مشروع، وشغّل `supabase/migrations/0001_init.sql` في SQL Editor.
2. **Vercel:** اعمل مشروع جديد من الريبو، وضيف المتغيرات اللي في `.env.example`.
   - لازم تضيف: `APP_URL` و`LINK_SIGNING_SECRET` و`TOKEN_ENCRYPTION_KEY` و`SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` و`CRON_SECRET`.
   - المزامنة اليومية بتتعمل لوحدها عن طريق `vercel.json` (الساعة 3 الفجر UTC).
3. **سلة:** في بوابة الشركاء، اعمل تطبيق Easy Mode، وحط رابط الـ webhook `{APP_URL}/api/webhooks/salla`، واختار Signature، وضيف `SALLA_*`.
4. **زد:** في Partner Dashboard، حط callback `{APP_URL}/api/connect/zid/callback`، وضيف `ZID_*`.
5. **WooCommerce:** التاجر بيفتح الصفحة الرئيسية ويكتب رابط متجره، وبعدها يثبّت `plugins/wasl-woocommerce` عشان النسب الدقيق.

## إضافة وصل لعميل MCP

الرابط: `{APP_URL}/api/mcp` (Streamable HTTP). مثلاً في Claude: Settings ثم Connectors ثم Add custom connector.

## الملفات المهمة

- `src/lib/mcp.ts`: خادم MCP.
- `src/lib/services.ts`: البحث وروابط الشراء والمزامنة ونسب الطلبات.
- `src/lib/connectors/`: سلة وزد وWooCommerce.
- `src/lib/links.ts`: الروابط الموقّعة.
- `src/lib/db/`: الذاكرة وSupabase.
- `docs/API_RESEARCH.md`: نتايج مراجعة الـ APIs والحاجات اللي لسه محتاجة تأكيد.
- `docs/OUTREACH_MESSAGES.md`: الرسايل لجوجل وسلة وزد وOpenAI وPerplexity.
