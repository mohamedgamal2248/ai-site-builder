/** Short, plain-language guides (Arabic and English). Each section is [heading, paragraphs[]]; links are site paths. */
export interface Guide {
  slug: string;
  icon: string;
  ar: { title: string; summary: string; sections: [string, string[]][]; links: [string, string][] };
  en: { title: string; summary: string; sections: [string, string[]][]; links: [string, string][] };
}

export const guides: Guide[] = [
  {
    slug: "blocks",
    icon: "🧱",
    ar: {
      title: "يعني إيه بلوك في شبكة Pi؟",
      summary: "البلوك (Ledger) صفحة في دفتر الحسابات العام، بتتقفل كل ~5 ثواني وفيها كل المعاملات اللي حصلت في الوقت ده.",
      sections: [
        ["الفكرة ببساطة", ["تخيّل دفتر حسابات ضخم مفتوح للكل. كل ~5 ثواني الشبكة بتقفل صفحة جديدة فيه، والصفحة دي اسمها بلوك أو Ledger، وليها رقم بيزيد بواحد كل مرة.", "أي تحويل أو قفل أو فتح حساب بيتسجل جوه بلوك، ومحدش يقدر يغيّره بعد ما البلوك يتقفل."]],
        ["إيه اللي جوه البلوك؟", ["رقم البلوك ووقت إغلاقه، وعدد المعاملات الناجحة والفاشلة، وعدد العمليات، وإجمالي الرسوم.", "المعاملة الواحدة ممكن يبقى فيها أكتر من عملية، زي تحويل وقفل في نفس الوقت."]],
        ["ليه في معاملات فاشلة كتير؟", ["جزء كبير من المعاملات الفاشلة على Pi بيتعمل أوتوماتيك من برامج بتجرب تسحب أرصدة أول ما تتفك. الفشل مش بيحرك أي فلوس، لكن صاحبه بيدفع الرسوم."]],
      ],
      links: [["/blocks", "آخر البلوكات"], ["/", "البث المباشر في الرئيسية"]],
    },
    en: {
      title: "What is a block on Pi Network?",
      summary: "A block (ledger) is one page of the public record. A new one closes about every 5 seconds with every transaction from that moment.",
      sections: [
        ["The idea", ["Picture a huge public ledger book. Every ~5 seconds the network closes a new page, called a block or ledger, numbered one higher than the last.", "Every payment, lockup or new account is written into a block, and nobody can change it after the block closes."]],
        ["What is inside a block?", ["Its number and close time, how many transactions succeeded and failed, how many operations it holds and the fees paid.", "One transaction can contain several operations, for example a payment and a lockup together."]],
        ["Why so many failed transactions?", ["Many failed transactions on Pi come from bots repeatedly trying to claim balances the moment they unlock. A failed transaction moves no Pi, but its sender still pays the fee."]],
      ],
      links: [["/blocks", "Latest blocks"], ["/", "Live feed on the home page"]],
    },
  },
  {
    slug: "read-a-transaction",
    icon: "🔎",
    ar: {
      title: "إزاي تقرا معاملة على Pi؟",
      summary: "كل معاملة ليها هاش (رقم مميز من 64 حرف). من صفحتها تعرف مين بعت، لمين، كام، إمتى، ونجحت ولا لأ.",
      sections: [
        ["الملخص في أول الصفحة", ["في أول صفحة المعاملة هتلاقي رسم بيوضح الفلوس رايحة منين لفين، وجملة بسيطة زي «فلان حوّل 100 Pi لـ OKX». لو الطرف محفظة معروفة (منصة أو الفاونديشن) هيظهر اسمها ولوجو."]],
        ["التفاصيل", ["الحالة: ناجحة ولا فاشلة. البلوك: رقم الصفحة اللي اتسجلت فيها. الرسوم: اللي اتدفع للشبكة. الملاحظة (Memo): نص اختياري، والمنصات بتستخدمه عشان تعرف الإيداع بتاع مين."]],
        ["إيداع منصة من غير Memo", ["لو بعت Pi لمنصة من غير الـ Memo اللي المنصة طلبته، الفلوس بتوصل لمحفظة المنصة بس محدش بيعرف ينسبها لحسابك بسهولة. دايماً انسخ العنوان والـ Memo من المنصة نفسها."]],
      ],
      links: [["/txs", "آخر المعاملات"], ["/wallets", "المحافظ المعروفة"]],
    },
    en: {
      title: "How to read a Pi transaction",
      summary: "Every transaction has a hash (a unique 64-character ID). Its page tells you who sent what to whom, when, and whether it succeeded.",
      sections: [
        ["The summary at the top", ["The top of the page draws where the Pi went and says it in one line, like “X sent 100 Pi to OKX”. Known wallets (exchanges, the Foundation) show their name and badge."]],
        ["The details", ["Status: successful or failed. Block: the ledger it was recorded in. Fee: what the network charged. Memo: optional text that exchanges use to know whose deposit it is."]],
        ["Exchange deposits without a memo", ["If you send Pi to an exchange without the memo it asked for, the Pi reaches the exchange wallet but cannot easily be matched to your account. Always copy the address and memo from the exchange itself."]],
      ],
      links: [["/txs", "Latest transactions"], ["/wallets", "Known wallets"]],
    },
  },
  {
    slug: "lockups",
    icon: "🔒",
    ar: {
      title: "قفل وفك قفل Pi",
      summary: "جزء كبير من Pi مقفول لمدد مختلفة (أسابيع لسنين). لما ميعاد القفل يخلص، صاحبه يقدر يستلمه ويتصرف فيه.",
      sections: [
        ["إزاي القفل بيشتغل؟", ["القفل على Pi عبارة عن «رصيد قابل للاستلام» (Claimable Balance) بشرط وقت: محدش يقدر يستلمه قبل تاريخ معين. ده اللي بيحصل مع Pi اللي بيتنقل للشبكة الرئيسية بقفل."]],
        ["ليه ده مهم للسعر؟", ["لما كمية كبيرة تتفك في يوم واحد، جزء منها ممكن يتباع، وده ممكن يزوّد ضغط البيع. عشان كده بنعرض جدول فك القفل لكل يوم وشهر، وبنحسبه بعدد أيام حجم التداول."]],
        ["أقرب فك قفل لحسابك", ["في صفحة أي حساب، لو عنده Pi مقفول هتلاقي عداد تنازلي لأقرب فك قفل والمبلغ."]],
      ],
      links: [["/unlocks", "جدول فك القفل"], ["/locked", "Pi المقفول"]],
    },
    en: {
      title: "Pi lockups and unlocks",
      summary: "A large share of Pi is locked for periods from weeks to years. When a lockup ends, its owner can claim and use it.",
      sections: [
        ["How a lockup works", ["A Pi lockup is a claimable balance with a time condition: nobody can claim it before a given date. This is how Pi migrated to mainnet with a lockup is held."]],
        ["Why it matters for price", ["When a lot unlocks on one day, some of it may be sold, adding selling pressure. That is why we show unlocks per day and month, and in days of trading volume."]],
        ["Your next unlock", ["On any account page with locked Pi you will find a live countdown to the next unlock and its amount."]],
      ],
      links: [["/unlocks", "Unlock schedule"], ["/locked", "Locked Pi"]],
    },
  },
  {
    slug: "pressure-index",
    icon: "🧭",
    ar: {
      title: "إزاي بيشتغل مؤشر ضغط Pi؟",
      summary: "رقم من 0 لـ 100 بيجمع 6 إشارات من البلوكتشين والسوق. 50 يعني يوم عادي، أقل يعني ضغط بيع، وأعلى يعني ضغط شراء.",
      sections: [
        ["الإشارات الست", ["صافي Pi الداخل للمنصات (لو كتير، ممكن ناس ناوية تبيع). خروج Pi من محافظ الفاونديشن. تغيّر رصيد أكبر 100 حامل. Pi اللي هيتفك في 7 أيام. عدد الإيداعات الكبيرة للمنصات. ودفاتر أوامر OKX وBitget."]],
        ["إزاي بنحسبه؟", ["كل إشارة بتتقارن بالمعتاد بتاعها في آخر 30 يوم، وبعدين بنجمعهم بأوزان ونحوّل النتيجة لرقم من 0 لـ 100."]],
        ["مش نصيحة استثمار", ["المؤشر بيوصف الضغط الظاهر دلوقتي، وما يقدرش يعرف المستقبل. صفحة «سجل الدقة» بتوضح توقعاته كانت صح قد إيه."]],
      ],
      links: [["/pressure", "مؤشر الضغط"], ["/pressure/accuracy", "سجل الدقة"], ["/flows", "تدفقات المنصات"]],
    },
    en: {
      title: "How the Pi Pressure Index works",
      summary: "A 0–100 number combining six on-chain and market signals. 50 is a normal day, lower means selling pressure, higher means buying pressure.",
      sections: [
        ["The six signals", ["Net Pi into exchanges (a lot can mean people preparing to sell). Pi leaving Foundation wallets. The change in the top 100 holders' balance. Pi unlocking in 7 days. Large exchange deposits. And the OKX and Bitget order books."]],
        ["How it is calculated", ["Each signal is compared with its own last 30 days, then they are weighted and combined into a 0–100 score."]],
        ["Not investment advice", ["The index describes pressure visible now; it cannot know the future. The track-record page shows how often its calls were right."]],
      ],
      links: [["/pressure", "Pressure index"], ["/pressure/accuracy", "Track record"], ["/flows", "Exchange flows"]],
    },
  },
  {
    slug: "exchange-flows",
    icon: "🔁",
    ar: {
      title: "يعني إيه تدفقات المنصات؟",
      summary: "Pi اللي بيدخل لمحافظ المنصات (OKX وBitget) غالباً جاهز للبيع، واللي بيخرج منها غالباً بيتسحب للحفظ.",
      sections: [
        ["الداخل والخارج", ["لما الناس تبعت Pi لمحفظة منصة، ده غالباً عشان يبيعوه. ولما يسحبوه من المنصة لمحافظهم، ده غالباً عشان يحتفظوا بيه. الفرق بين الاتنين اسمه «صافي التدفق»."]],
        ["عناوين الإيداع (muxed)", ["المنصات بتدّي كل مستخدم عنوان إيداع خاص بيبدأ بـ M، لكن كله بيوصل لنفس المحفظة الأساسية. إحنا بنفك العنوان ده ونوريك المحفظة الأساسية."]],
      ],
      links: [["/flows", "تدفقات المنصات"], ["/whales", "تنبيهات الحيتان"]],
    },
    en: {
      title: "What are exchange flows?",
      summary: "Pi moving into exchange wallets (OKX, Bitget) is often about to be sold; Pi moving out is usually withdrawn to hold.",
      sections: [
        ["In and out", ["When people send Pi to an exchange it is usually to sell; when they withdraw it to their own wallets it is usually to hold. The difference is the net flow."]],
        ["Deposit addresses (muxed)", ["Exchanges give each user a personal deposit address starting with M, but it all lands in the same base wallet. We decode it and show you that base wallet."]],
      ],
      links: [["/flows", "Exchange flows"], ["/whales", "Whale alerts"]],
    },
  },
];

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug);
