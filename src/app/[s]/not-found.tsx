import Link from "next/link";

/** Shown in both languages: a 404 has no page settings to read. */
export default function NotFound() {
  return (
    <div className="card error-box">
      <h1>الصفحة مش موجودة · Page not found</h1>
      <p>الرابط ده مش موجود أو اتشال. · This link does not exist or was removed.</p>
      <Link href="/" className="btn">الرئيسية · Home</Link>
    </div>
  );
}
