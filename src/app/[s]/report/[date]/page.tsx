import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView, validDay } from "../view";

// Rendered on first visit, then served from the CDN.
export async function generateStaticParams() {
  return [];
}
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ s: string; date: string }> }): Promise<Metadata> {
  const { date } = await params;
  return { title: `Pi daily report · ${date}` };
}

export default async function ReportDay({ params }: { params: Promise<{ s: string; date: string }> }) {
  const { date } = await params;
  if (!validDay(date)) notFound();
  return <ReportView day={date} params={params} />;
}
