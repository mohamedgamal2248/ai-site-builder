import type { Dict } from "@/lib/i18n";

export function NotConfigured({ t }: { t: Dict }) {
  return (
    <section className="card">
      <p className="notice">{t.notConfigured}</p>
      <p className="muted">{t.notConfiguredHelp}</p>
    </section>
  );
}
