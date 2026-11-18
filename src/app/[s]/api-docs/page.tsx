import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Card, PageTitle } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export const revalidate = 86400;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "API", "/api-docs");
}

const ENDPOINTS: [string, { en: string; ar: string }, string][] = [
  ["/api/v1/network", { en: "Latest ledger, supply, fees, price and market data", ar: "آخر بلوك، والمعروض، والرسوم، والسعر وبيانات السوق" }, "/api/v1/network"],
  ["/api/v1/ledgers?limit=20", { en: "Recent ledgers (up to 100)", ar: "أحدث البلوكات (لحد 100)" }, "/api/v1/ledgers?limit=5"],
  ["/api/v1/ledgers/{sequence}", { en: "One ledger with its transaction hashes", ar: "بلوك واحد وهاشات معاملاته" }, ""],
  ["/api/v1/transactions/{hash}", { en: "A transaction with simplified operations", ar: "معاملة وعملياتها بشكل مبسط" }, ""],
  ["/api/v1/accounts/{G…}", { en: "Balance, locked Pi and last activity of an account", ar: "رصيد الحساب وPi المقفول وآخر نشاط" }, ""],
  ["/api/v1/stats/daily?days=30", { en: "Daily activity (needs the statistics database)", ar: "النشاط اليومي (محتاج قاعدة بيانات الإحصائيات)" }, "/api/v1/stats/daily?days=7"],
  ["/api/v1/unlocks", { en: "Monthly unlock schedule and totals", ar: "جدول فك القفل الشهري والإجماليات" }, "/api/v1/unlocks"],
  ["/api/v1/largest?range=24h", { en: "Largest Pi transfers: 24h, 7d or 30d", ar: "أكبر تحويلات Pi: 24h أو 7d أو 30d" }, "/api/v1/largest?range=24h"],
];

export default async function ApiDocs({ params }: { params: Promise<{ s: string }> }) {
  const { t, lang } = await getSettings(params);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost"}`;
  return (
    <>
      <PageTitle title={t.apiTitle} />
      <p className="muted">{t.apiIntro}</p>
      <Card>
        <ul className="rows api-list">
          {ENDPOINTS.map(([path, desc, example]) => (
            <li key={path}>
              <div className="main-col">
                <code dir="ltr">GET {path}</code>
                <span className="meta">{desc[lang]}</span>
              </div>
              {example ? (
                <a className="btn ghost small" href={example} target="_blank" rel="noopener">{t.example}</a>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <p className="muted" style={{ marginTop: 0 }}>?net=testnet</p>
        <pre className="code" dir="ltr">{`curl ${origin}/api/v1/network\ncurl "${origin}/api/v1/ledgers?limit=5&net=testnet"`}</pre>
      </Card>
    </>
  );
}
