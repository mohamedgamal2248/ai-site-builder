import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blockchain Pi",
    short_name: "Blockchain Pi",
    description: "Pi Network blockchain explorer — مستكشف بلوكتشين شبكة Pi",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3fa",
    theme_color: "#6b3fd4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
