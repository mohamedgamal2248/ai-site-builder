import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };

/** Shared look for link-preview images (English text: the image renderer has no Arabic font). */
export function ogCard({ kicker, title, lines, cacheSeconds = 3600 }: { kicker: string; title: string; lines: string[]; cacheSeconds?: number }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "linear-gradient(135deg, #3d1f8f 0%, #6b3fd4 100%)", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#2a1566", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, color: "#f5b83d" }}>π</div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>Blockchain Pi</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 30, opacity: 0.8 }}>{kicker}</div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {lines.map((l) => (
            <div key={l} style={{ fontSize: 32, opacity: 0.9 }}>{l}</div>
          ))}
        </div>
        <div style={{ fontSize: 24, opacity: 0.7 }}>Pi Network blockchain explorer · independent, not affiliated with Pi Network</div>
      </div>
    ),
    {
      ...ogSize,
      // Rendering a preview costs ~1–2 s of CPU; let the CDN keep it.
      headers: { "Cache-Control": `public, max-age=${Math.min(cacheSeconds, 86400)}, s-maxage=${cacheSeconds}, stale-while-revalidate=86400` },
    },
  );
}
