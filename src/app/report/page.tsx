import type { Metadata } from "next";
import { ReportView, shiftDay } from "./view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pi daily report" };

// The latest complete UTC day.
export default function Report() {
  return <ReportView day={shiftDay(new Date().toISOString().slice(0, 10), -1)} />;
}
