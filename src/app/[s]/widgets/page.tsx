import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { CopyButton } from "@/components/CopyButton";
import { Card, PageTitle } from "@/components/ui";
import { extraDicts } from "@/lib/i18n-extra";
import { getSettings } from "@/lib/settings";

export const revalidate = 86400;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Widget", "/widgets");
}

const BASE = process.env.SITE_URL || "https://ai-site-builder-peach.vercel.app";

export default async function Widgets({ params }: { params: Promise<{ s: string }> }) {
  const { lang } = await getSettings(params);
  const w = extraDicts[lang].widget;
  const code = `<iframe src="${BASE}/embed?lang=${lang}" width="100%" height="96" style="border:0;max-width:440px" loading="lazy" title="Pi price · Blockchain Pi"></iframe>`;
  return (
    <>
      <PageTitle title={w.title} />
      <p className="muted">{w.intro}</p>
      <Card title={w.preview}>
        <div className="widget-previews">
          <iframe src={`/embed?lang=${lang}`} title={w.preview} width="100%" height="96" style={{ border: 0, maxWidth: 440 }} loading="lazy" />
          <iframe src={`/embed?lang=${lang}&theme=dark`} title={`${w.preview} (dark)`} width="100%" height="96" style={{ border: 0, maxWidth: 440 }} loading="lazy" />
        </div>
      </Card>
      <Card title={w.code} action={<CopyButton value={code} label={w.copy} copied={w.copied} />}>
        <pre className="code-block" dir="ltr"><code>{code}</code></pre>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0 }}>{w.options}</p>
      </Card>
    </>
  );
}
