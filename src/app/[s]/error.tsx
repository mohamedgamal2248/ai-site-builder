"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { reportError } from "@/components/ErrorReporter";

const T = {
  ar: { title: "حصلت مشكلة", text: "Horizon API بتاع Pi بطيء أو مش متاح دلوقتي، أو حصل خطأ مؤقت. جرّب تاني بعد شوية.", retry: "حاول تاني", home: "الرئيسية" },
  en: { title: "Something went wrong", text: "Pi's Horizon API is slow or unavailable right now, or a temporary error happened. Try again in a moment.", retry: "Try again", home: "Home" },
};

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(`page: ${error.message}${error.digest ? ` (${error.digest})` : ""}`, error.stack), [error]);
  const params = useParams<{ s?: string }>();
  const t = T[String(params?.s ?? "").startsWith("en") ? "en" : "ar"];
  return (
    <section className="nf" role="alert">
      <div className="nf-art nf-err" aria-hidden="true">
        <span className="nf-pi">!</span>
      </div>
      <h1>{t.title}</h1>
      <p className="muted">{t.text}</p>
      <nav className="nf-links">
        <button type="button" className="btn" onClick={reset}>{t.retry}</button>
        <Link href="/" className="btn ghost">{t.home}</Link>
      </nav>
    </section>
  );
}
