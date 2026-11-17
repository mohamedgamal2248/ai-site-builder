import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView, validDay } from "../view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  return { title: `Pi daily report · ${date}` };
}

export default async function ReportDay({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!validDay(date)) notFound();
  return <ReportView day={date} />;
}
