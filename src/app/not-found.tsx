import Link from "next/link";
import { getSettings } from "@/lib/settings";

export default async function NotFound() {
  const { t } = await getSettings();
  return (
    <div className="card error-box">
      <h1>{t.notFound}</h1>
      <p>{t.notFoundText}</p>
      <Link href="/" className="btn">{t.home}</Link>
    </div>
  );
}
