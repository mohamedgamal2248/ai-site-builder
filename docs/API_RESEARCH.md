# مراجعة APIs سلة وزد وWooCommerce

آخر تحديث: نوفمبر 2026. ✅ = مؤكد من التوثيق الرسمي، ⚠️ = غير مؤكد أو التوثيق متضارب، ويحتاج تجربة حقيقية.

## الخلاصة

| | سلة | زد | WooCommerce |
|---|---|---|---|
| تسجيل الدخول | OAuth 2.0، و**Easy Mode إجباري** للتطبيقات المنشورة ✅ | OAuth 2.0 (Authorization Code) ✅ | مسار `wc-auth` المدمج في WooCommerce بيصدر مفاتيح API ✅ |
| عمر التوكن | الوصول 14 يوم، والتجديد شهر وبيستخدم **مرة واحدة** ✅ | التوكنات الجديدة 3 سنين، والتجديد سنة ✅ | المفاتيح مالهاش انتهاء |
| قراءة المنتجات | `GET /products` ✅ | `GET /v1/products/` ✅ | `GET /wp-json/wc/v3/products` ✅ |
| رابط صفحة المنتج | حقل `url` ✅ | ⚠️ اسم الحقل مش واضح (`html_url`؟)، والكود بيرجع لـ `/products/{slug}` | حقل `permalink` ✅ |
| **رابط سلة جاهزة** | ❌ مفيش رابط موثّق. فيه بس أدوات JavaScript جوه الثيم (`salla.cart.createQuickOrder`) | ❌ ما لقيتش | ✅ `?add-to-cart=ID&quantity=N` |
| Webhooks | توقيع HMAC-SHA256 في `x-salla-signature` ✅ | بتتسجل لكل حدث من الـ API ⚠️ (طريقة التوقيع مش واضحة) | توقيع base64 HMAC-SHA256 في `X-WC-Webhook-Signature` ✅ |
| أحداث الطلبات | `order.created` وغيره ✅ | `order.create` و`order.status.update` ✅ | `order.created` ✅ |
| أحداث المنتجات | `product.created/deleted/price.updated/...` ✅ | `product.create/update/publish/delete` ✅ | `product.created/updated/deleted` ✅ |

**أهم استنتاج:** في سلة وزد، رابط الشراء بيودّي العميل لـ**صفحة المنتج**، والعميل بيضغط "أضف للسلة" بنفسه. في WooCommerce، المنتج **بيبقى في السلة جاهز**. ولو سلة أو زد ضافوا رابط سلة جاهزة بعدين، التعديل في دالة واحدة بس: `cartTarget`.

## سلة — التفاصيل

- **API:** `https://api.salla.dev/admin/v2`، وكل طلب بيتبعت بـ `Authorization: Bearer <token>`.
- **OAuth:** التفويض `https://accounts.salla.sa/oauth2/auth`، والتوكن والتجديد `https://accounts.salla.sa/oauth2/token`، وبيانات المستخدم `https://accounts.salla.sa/oauth2/user/info`.
- **Easy Mode:** سلة بتعمل تبادل الكود بنفسها، وبتبعت التوكنات في حدث `app.store.authorize` على رابط الـ webhook بتاعك. ده **الطريق الوحيد المسموح للتطبيقات المنشورة** في متجر تطبيقات سلة. الكود بيستقبل الحدث ده في `/api/webhooks/salla`.
- **التجديد:** توكن التجديد بيستخدم مرة واحدة، ولو اتستخدم مرتين ممكن يلغي التوكنات وتضطر التاجر يعيد التثبيت. سلة بتنصح بقفل (mutex) على عملية التجديد. الكود بيجدد قبل الانتهاء بـ 3 أيام، وجوه المزامنة اليومية بس.
- **الصلاحيات المطلوبة:** `products.read` (أو `read_write` لو هنحدّث الأوصاف بعدين)، و`orders.read`، و`webhooks.read_write`، و`offline_access` عشان توكن التجديد.
- **المنتجات:** `GET /products?page=&per_page=`، والحالة ممكن تكون `sale/out/hidden/deleted`. الحقول: `price{amount,currency}` و`sale_price` و`quantity` و`url` و`images[]` و`skus[]`.
- **التوقيع:** HMAC-SHA256 للـ body الخام بسر الـ webhook، بصيغة hex، في `x-salla-signature`. ⚠️ التوثيق متضارب في طريقة "Token". **اختار "Signature"** من بوابة الشركاء.
- ⚠️ **محتاج تجربة:**
  1. شكل payload لـ `order.created` بالظبط: هل `amounts.total` و`items[].product.id` صح؟
  2. مسار `/store/info` واسم حقل الدومين.
  3. هل الطلب بيحتفظ بمعاملات `utm_*` أو `wasl_ref`؟ لو أيوه، هنعرف ننسب الطلب بدقة بدل "محتمل".

المصادر: [OAuth](https://docs.salla.dev/doc-421118) · [Webhooks](https://docs.salla.dev/doc-421119) · [Products](https://docs.salla.dev/api-5394168) · [Quick Order (JS)](https://docs.salla.dev/apidoc/project-451700/422637m0)

## زد — التفاصيل

- **API:** `https://api.zid.sa/v1`، و**كل طلب** بيتبعت بهيدرين: `Authorization: Bearer <authorization>` و`X-Manager-Token: <access_token>`.
- **OAuth:** التفويض `https://oauth.zid.sa/oauth/authorize?client_id&redirect_uri&response_type=code&state` (من غير PKCE). التوكن `POST https://oauth.zid.sa/oauth/token` والبيانات في الـ body.
- **رد التوكن:** `authorization` بيروح في هيدر Authorization، و`access_token` بيروح في X-Manager-Token، ومعاهم `refresh_token` و`expires_in` بالثواني.
- **Webhooks:** `POST /v1/managers/webhooks` لكل حدث، ومحتاج صلاحية `third_webhook_read`. ⚠️ طريقة التحقق من الرسايل اللي بتوصل مش واضحة، **فالكود بيحط توكن HMAC بتاعنا جوه رابط الاستقبال نفسه** وبيتحقق منه.
- **الأحداث:** `product.create` و`product.update` و`product.publish` و`product.delete` و`order.create` و`order.status.update` و`order.payment_status.update`.
- **الأرباح:** النشر مجاني، والنسبة بتتحدد في اتفاقية. ولو مش مقيم في السعودية، فيه **ضريبة استقطاع 15%**.
- ⚠️ **محتاج تجربة:**
  1. أسماء حقول المنتج: الرابط والصور والعملة.
  2. شكل `/managers/account/profile` (لازم نعرف منه `user.store.id` و`url` و`title`).
  3. حقول إنشاء الـ webhook.
  4. شكل payload الطلب.

المصادر: [Authorization](https://docs.zid.sa/authorization) · [Webhooks](https://docs.zid.sa/webhooks) · [Create first app](https://docs.zid.sa/create-first-app) · [App payouts](https://help-partner.zid.sa/en/articles/11501759-app-payouts)

## WooCommerce — التفاصيل

- **الربط:** `{site}/wc-auth/v1/authorize?app_name&scope=read_write&user_id&return_url&callback_url`. التاجر بيوافق، وWooCommerce بيبعت المفاتيح (`consumer_key` و`consumer_secret`) لرابط الاستقبال بتاعنا.
- **سلة جاهزة:** `{site}/cart/?add-to-cart=ID&quantity=N` ✅
- **النسب الدقيق:** إضافة `plugins/wasl-woocommerce` بتحفظ `wasl_ref` في cookie، وبعدين تكتبه على الطلب في `_wasl_ref`.
- **ناقص:** المنتجات المتغيرة (variations) بتحتاج طلب لكل منتج على `/products/{id}/variations`، وده لسه ما اتعملش.

## إزاي بننسب الطلب لوصل

1. **دقيق (exact):** الطلب راجع ومعاه `wasl_ref` بيطابق رابط اتضغط عليه. ده شغال في WooCommerce مع الإضافة.
2. **محتمل (probable):** طلب فيه منتج حد ضغط على رابطه من نفس المتجر خلال 48 ساعة. ده الوضع الحالي في سلة وزد.
3. **غير منسوب (none).**
