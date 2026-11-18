import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { guides } from "@/data/guides";
import { pageMeta } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Guides", "/learn");
}

export default async function Learn({ params }: { params: Promise<{ s: string }> }) {
  const { lang } = await getSettings(params);
  return (
    <>
      <PageTitle title={lang === "ar" ? "تعلّم" : "Learn"} />
      <p className="muted">{lang === "ar" ? "شروحات قصيرة وبسيطة عشان تفهم اللي بتشوفه على بلوكتشين Pi." : "Short, plain guides to what you see on the Pi blockchain."}</p>
      <div className="guide-grid">
        {guides.map((g) => (
          <Link key={g.slug} href={`/learn/${g.slug}`} className="card guide-card">
            <span className="guide-icon" aria-hidden="true">{g.icon}</span>
            <strong>{g[lang].title}</strong>
            <span className="muted">{g[lang].summary}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
