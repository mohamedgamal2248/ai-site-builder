import { NextResponse, type NextRequest } from "next/server";
import { horizon } from "@/lib/horizon";
import { lockOwner, unlockTime } from "@/lib/format";

const SITE = process.env.SITE_URL || "https://blockchainpi.vercel.app";

/** "2026-12-01T10:00:00Z" → "20261201T100000Z" (iCalendar UTC time). */
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/**
 * An account's future unlocks as a calendar file (.ics), one event per unlock date with a
 * reminder the day before. Opening it adds the dates to Google, Apple or Outlook calendars.
 */
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") ?? "").toUpperCase();
  const net = req.nextUrl.searchParams.get("net") === "testnet" ? "testnet" : "mainnet";
  const ar = req.nextUrl.searchParams.get("lang") === "ar";
  if (!/^G[A-Z2-7]{55}$/.test(id)) return NextResponse.json({ error: "bad account" }, { status: 400 });

  const page = await horizon.accountClaimable(net, id).catch(() => null);
  if (!page) return NextResponse.json({ error: "upstream" }, { status: 502 });

  // Sum lockups that open at the same moment.
  const byTime = new Map<string, number>();
  for (const c of page.records) {
    if (c.asset !== "native") continue;
    const owner = lockOwner(c.claimants.filter((x) => x.destination === id));
    const at = owner ? unlockTime(owner.predicate) : null;
    if (at && Date.parse(at) > Date.now()) byTime.set(at, (byTime.get(at) ?? 0) + Number(c.amount));
  }
  const unit = net === "testnet" ? "Test-Pi" : "Pi";
  const short = `${id.slice(0, 4)}…${id.slice(-4)}`;
  const now = icsTime(new Date().toISOString());
  const events = [...byTime.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([at, amount]) => {
    const amt = amount.toLocaleString("en", { maximumFractionDigits: 2 });
    const title = ar ? `فك قفل ${amt} ${unit} · ${short}` : `${amt} ${unit} unlocks · ${short}`;
    const desc = ar ? `الرصيد ده هيبقى متاح للاستلام في المحفظة ${id}.` : `This balance becomes claimable in wallet ${id}.`;
    return [
      "BEGIN:VEVENT",
      `UID:${id}-${icsTime(at)}@blockchainpi`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsTime(at)}`,
      `DTEND:${icsTime(new Date(Date.parse(at) + 30 * 60_000).toISOString())}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(desc)}`,
      `URL:${SITE}${ar ? "/ar" : ""}/account/${id}?tab=locks`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(title)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Blockchain Pi//Unlocks//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(ar ? `فك قفل ${short}` : `Unlocks ${short}`)}`, ...events, "END:VCALENDAR", ""].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="pi-unlocks-${id.slice(0, 6)}.ics"`,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
