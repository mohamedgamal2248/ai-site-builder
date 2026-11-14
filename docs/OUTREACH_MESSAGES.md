# رسايل المنصات

انسخ الرسايل دي وابعتها من إيميلك. سبت الأماكن اللي محتاجة بياناتك بين أقواس مربعة [ ]. **وما تبعتش أي مفاتيح أو كلمات سر في الرسايل.**

---

## 1) Google Merchant Center: طلب حساب متعدد العملاء (MCA)

**فين تبعتها:** اعمل حساب Merchant Center جديد بإيميل جديد، وما تتحققش من ملكية أي موقع عليه. بعدها افتح Help ثم Contact us ثم "Request an advanced account setup"، أو استخدم فورم الدعم.

**الموضوع:** Request: Multi-Client Account for an e-commerce integration platform (Saudi Arabia, UAE, Egypt)

```
Hello Merchant Center team,

I'm building [Wasl], a platform that connects independent online stores (Salla, Zid and WooCommerce merchants) to Google and to AI shopping agents. Each merchant sells on their own website and domain, and customers always check out on the merchant's site.

Merchant Center ID: [your MC ID]
Website: [your site]

I'd like to request a conversion of this account to a Multi-Client Account (MCA) so that we can create one sub-account per merchant through the Merchant API, following the store-builder integration guide. Each sub-account would use the merchant's own website URL, and each merchant would verify and claim their own domain.

Questions:
1. Is the store-builder (platform) MCA available for merchants based in Saudi Arabia, the UAE and Egypt?
2. Our first cohort is about [20] merchants. What is the process to raise the 50 sub-account limit later?
3. For merchants who already have a Merchant Center account (for example through their Salla store settings), is linking their existing account to our MCA with Accounts.link the right approach?

Thank you,
[Your name]
[Company / contact email]
```

---

## 2) سلة: أسئلة لفريق الشركاء

**فين تبعتها:** partners@salla.sa، أو من الدعم جوه بوابة الشركاء.

**الموضوع:** استفسار تقني قبل نشر تطبيق "وصل" — روابط السلة والنسب والـ Feed

```
السلام عليكم فريق شركاء سلة،

أنا [اسمك]، بطوّر تطبيق اسمه "وصل" هيتنشر على متجر تطبيقات سلة. التطبيق بيعرض منتجات التاجر لوكلاء الذكاء الاصطناعي (زي ChatGPT وClaude وGemini)، والوكيل بيبعت العميل لمتجر التاجر عشان يدفع هناك. يعني الدفع دايماً بيتم في سلة ومش بنستلم أي مبالغ.

عندي كام سؤال قبل ما ننشر:

1. هل فيه طريقة موثقة (رابط URL أو API) نفتح بيها متجر التاجر والمنتج مضاف للسلة على طول، بمقاس وكمية محددين؟ لقيت salla.cart.createQuickOrder جوه الثيم، بس احنا محتاجين رابط نبعته للعميل.
2. لما العميل يدخل المتجر من رابط فيه معاملات utm_source وwasl_ref، هل المعاملات دي بتتسجل على الطلب وبتظهر في payload الـ webhook بتاع order.created؟ ولو لأ، هل ممكن نضيف رابط تتبع أو قيمة مخصصة على الطلب؟
3. ميزة Product Feed وربط Google Merchant Center عندكم: هل كل متجر بيربط حسابه بنفسه، ولا سلة بتستخدم حساب متعدد العملاء؟ وهل يتعارض ده لو تطبيقنا ربط حساب Merchant Center للتاجر؟
4. إيه نسبة سلة من اشتراكات التطبيقات المدفوعة، وإيه طريقة تحويل الأرباح للمطورين خارج السعودية؟
5. هل التسجيل في بوابة الشركاء والنشر في المتجر مجاني؟

شكراً لكم،
[اسمك]
[الإيميل / رقم التواصل]
```

---

## 3) زد: أسئلة لفريق الشركاء

**فين تبعتها:** من Partner Dashboard على partner.zid.sa (الدعم)، أو من صفحة تفاصيل الشراكة.

**الموضوع:** استفسار تقني — تطبيق "وصل" (روابط السلة، Webhooks، الاتفاقية)

```
السلام عليكم فريق شركاء زد،

بطوّر تطبيق "وصل" اللي بيوصّل منتجات التجار لوكلاء الذكاء الاصطناعي، والعميل بيكمل الدفع على متجر زد نفسه.

أسئلتنا:

1. هل فيه رابط أو API يفتح المتجر والمنتج مضاف للسلة على طول (منتج + خيار + كمية)؟
2. إيه اسم الحقل اللي فيه رابط صفحة المنتج للعميل في رد GET /v1/products؟
3. Webhooks: إزاي نتحقق إن الرسالة جاية من زد (توقيع، أو هيدر، أو IP)؟ وإيه الحقول المطلوبة بالظبط في POST /v1/managers/webhooks؟
4. هل معاملات utm أو wasl_ref اللي في الرابط بتتسجل على الطلب وتظهر في webhook الـ order.create؟
5. مكتوب في صفحة App Payouts إن "Partner rate" 20% للتطبيقات بالاشتراك. هل دي حصتنا احنا ولا حصة زد؟ وإيه طريقة تحويل الأرباح لشريك من مصر، مع ضريبة الاستقطاع 15%؟

شكراً لكم،
[اسمك]
[الإيميل]
```

---

## 4) OpenAI: برنامج تجار ChatGPT (كمنصة بتجمع تجار)

**فين تبعتها:** فورم chatgpt.com/merchants. انسخ الفقرة دي في خانة الوصف.

```
We are [Wasl], an integration platform for independent online stores in Saudi Arabia, the UAE and Egypt (Salla, Zid and WooCommerce merchants). We maintain clean product feeds for each merchant, including seller_name, availability and price, and customers check out on each merchant's own site.

We'd like to onboard as a platform partner that submits feeds on behalf of many merchants. Could you share:
1. Whether multi-merchant platforms can submit feeds today, and the requirements for that.
2. When ChatGPT shopping is planned to support shoppers and merchants outside the United States, especially in Saudi Arabia, the UAE and Egypt.
```

---

## 5) Perplexity: برنامج التجار

**فين تبعتها:** صفحة Perplexity Merchant Program، أو من فورم التواصل.

```
Hi Perplexity team, we run [Wasl], a feed platform for independent stores in Saudi Arabia, the UAE and Egypt (Salla, Zid and WooCommerce). Our feeds follow the Google product data spec, and checkout happens on each merchant's site.
1. Can a platform enroll many merchants under one integration?
2. Is the Merchant Program open to merchants and shoppers in Saudi Arabia, the UAE and Egypt?
Thanks!
```
