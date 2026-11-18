import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/ui";
import { guideBySlug, guides } from "@/data/guides";
import { parseSegment, getSettings } from "@/lib/settings";

export const revalidate = 86400;
export async function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

type Params = Promise<{ s: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { s, slug } = await params;
  const g = guideBySlug(slug);
  if (!g) return { title: "404" };
  const c = g[parseSegment(s).lang];
  return { title: c.title, description: c.summary, alternates: { canonical: `/learn/${slug}` }, openGraph: { title: c.title, description: c.summary, type: "article" } };
}

export default async function GuidePage({ params }: { params: Params }) {
  const { lang } = await getSettings(params);
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const c = g[lang];
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: c.title, description: c.summary, inLanguage: lang, author: { "@type": "Organization", name: "Blockchain Pi" } };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="report-nav"><Link href="/learn">{lang === "ar" ? "→ كل الشروحات" : "← All guides"}</Link><span /></nav>
      <PageTitle title={<>{g.icon} {c.title}</>} />
      <p className="guide-lead">{c.summary}</p>
      {c.sections.map(([h, ps]) => (
        <Card key={h} title={h}>
          {ps.map((p) => <p key={p.slice(0, 20)} className="guide-p">{p}</p>)}
        </Card>
      ))}
      <div className="guide-links">
        {c.links.map(([href, label]) => <Link key={href} href={href} className="btn ghost">{label}</Link>)}
      </div>
      <p className="muted" style={{ fontSize: 12.5 }}>{lang === "ar" ? "الشروحات للتوضيح بس، ومش نصيحة استثمار." : "Guides are for explanation only, not investment advice."}</p>
    </>
  );
}
