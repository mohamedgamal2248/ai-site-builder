"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const ar = typeof document !== "undefined" && document.documentElement.lang === "ar";
  return (
    <div className="card error-box">
      <h1>{ar ? "API شبكة Pi لم يرد" : "The Pi network API did not answer"}</h1>
      <p>{ar ? "Horizon API بتاع Pi بطيء أو مش متاح دلوقتي. جرّب تاني بعد شوية." : "Pi's Horizon API is slow or unavailable right now. Try again in a moment."}</p>
      <button className="btn" onClick={reset}>{ar ? "حاول مرة أخرى" : "Try again"}</button>
    </div>
  );
}
