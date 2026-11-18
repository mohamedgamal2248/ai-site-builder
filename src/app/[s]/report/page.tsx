import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";
import { ReportView, shiftDay } from "./view";

export const revalidate = 600;
export async function generateMetadata({ params }: { params: Promise<{ s: string }> }): Promise<Metadata> {
  return pageMeta(params, "Pi daily report", "/report");
}

// The latest complete UTC day.
export default function Report({ params }: { params: Promise<{ s: string }> }) {
  return <ReportView day={shiftDay(new Date().toISOString().slice(0, 10), -1)} params={params} />;
}
