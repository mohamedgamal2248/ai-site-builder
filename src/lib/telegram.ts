/**
 * Optional Telegram channel posts: foundation moves, unusual exchange inflows and a daily
 * summary. Turned on by two Vercel environment variables:
 *   TELEGRAM_BOT_TOKEN  – from @BotFather
 *   TELEGRAM_CHAT_ID    – the channel, e.g. @blockchainpi (the bot must be an admin there)
 * Without them every function here is a no-op.
 */
import { knownWallet } from "@/data/wallets";
import type { Sql } from "./db";
import type { Network } from "./horizon";

const SITE = process.env.SITE_URL || "https://blockchainpi.vercel.app";

export const telegramConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;

async function send(text: string) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(n);
const who = (a: string | null) => (a ? esc(knownWallet(a)?.labelAr.split(" · ")[0] ?? `${a.slice(0, 5)}…${a.slice(-5)}`) : "—");
const DEST: Record<string, string> = { exchange: "لمنصة ⚠️", foundation: "داخلي", whale: "لحامل كبير", unknown: "لمحفظة تانية" };

/** Posts new alerts (at most 5 per run) and, once a day after 00:15 UTC, yesterday's summary. */
export async function telegramStep(sql: Sql, net: Network) {
  if (!telegramConfigured() || net !== "mainnet") return null;
  let posted = 0;
  const rows = await sql<{ id: string; kind: string; amount: string | null; from_acc: string | null; to_acc: string | null; tx_hash: string | null; meta: Record<string, unknown> }[]>`
    select id, kind, amount::text, from_acc, to_acc, tx_hash, meta from alerts
    where net = ${net} and not tg and at > now() - interval '6 hours' order by at limit 5`;
  for (const a of rows) {
    const amt = a.amount ? `${fmt(Number(a.amount))} Pi` : "";
    const text =
      a.kind === "foundation"
        ? `🏛 <b>محفظة فاونديشن حرّكت ${amt}</b>\n${who(a.from_acc)} ← ${who(a.to_acc)}\nالوجهة: ${DEST[String(a.meta?.dest ?? "unknown")] ?? DEST.unknown}\n${a.tx_hash ? `<a href="${SITE}/tx/${a.tx_hash}">تفاصيل المعاملة</a>` : ""}`
        : `📥 <b>دخول غير عادي للمنصات</b>\n${amt} في ساعة واحدة${a.meta?.z ? ` (${a.meta.z}σ فوق المعتاد)` : ""}\n<a href="${SITE}/flows">تدفقات المنصات</a>`;
    if (await send(text).catch(() => false)) {
      await sql`update alerts set tg = true where net = ${net} and id = ${a.id}`;
      posted++;
    }
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const [state] = await sql<{ cursor: string }[]>`select cursor from sync_state where net = ${net} and stream = 'tg_daily'`;
  if (now.getUTCHours() * 60 + now.getUTCMinutes() >= 15 && state?.cursor !== yesterday) {
    const { getReport } = await import("./insights");
    const r = await getReport(net, yesterday);
    const ch = r.close && r.prevClose ? ((r.close - r.prevClose) / r.prevClose) * 100 : null;
    const lines = [
      `📊 <b>تقرير Pi ليوم ${yesterday}</b>`,
      r.close ? `السعر: $${r.close.toFixed(4)}${ch !== null ? ` (${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%)` : ""}` : "",
      r.index !== null ? `مؤشر الضغط آخر اليوم: ${r.index.toFixed(0)}/100` : "",
      r.exchNet !== null ? `صافي الداخل للمنصات: ${r.exchNet > 0 ? "+" : ""}${fmt(r.exchNet)} Pi` : "",
      r.stats ? `معاملات ناجحة: ${fmt(r.stats.txs)} · حسابات جديدة: ${fmt(r.stats.new_accounts)}` : "",
      r.foundation.length ? `حركات الفاونديشن: ${r.foundation.length}` : "",
      `<a href="${SITE}/report/${yesterday}">التقرير الكامل</a> · مش نصيحة استثمار`,
    ].filter(Boolean);
    if (await send(lines.join("\n")).catch(() => false)) {
      await sql`insert into sync_state (net, stream, cursor) values (${net}, 'tg_daily', ${yesterday})
        on conflict (net, stream) do update set cursor = excluded.cursor, updated_at = now()`;
      posted++;
    }
  }
  return { posted };
}
