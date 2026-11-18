import { notFound } from "next/navigation";

// Unknown paths: a cached 404 (rendered once per path, then served by the CDN).
export async function generateStaticParams() {
  return [];
}
export const revalidate = 86400;

export default function CatchAll() {
  notFound();
}
