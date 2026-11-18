/* Blockchain Pi service worker: offline shell, cached static assets, push notifications. */
const STATIC = "bp-static-v2";
const PAGES = "bp-pages-v3";
const FRESH_MS = 5 * 60_000; // serve a saved page instantly if it is younger than this
const MAX_PAGES = 40;
const OFFLINE = "/offline";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE, "/icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Build assets never change for a given URL: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg" || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  // Pages: a copy saved in the last few minutes opens instantly while a fresh one is fetched
  // in the background (live parts of the page update themselves). Older or missing copies wait
  // for the network; with no connection the saved copy, or the offline page, is shown.
  // Changing language or network: saved pages are in the old one, so drop them.
  if (req.mode === "navigate" && url.pathname === "/settings") {
    e.respondWith(caches.delete(PAGES).then(() => fetch(req)));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(PAGES).then(async (c) => {
        const hit = await c.match(req);
        const age = hit ? Date.now() - Number(hit.headers.get("x-sw-saved") || 0) : Infinity;
        // "no-cache" = always confirm with the server (the CDN answers quickly), so a page in the
        // old language or network can never come back from the browser's own cache.
        const network = fetch(req, { cache: "no-cache", referrer: req.referrer || "about:client" })
          .then(async (res) => {
            if (res.ok && res.type === "basic") {
              const body = await res.clone().blob();
              const headers = new Headers(res.headers);
              headers.set("x-sw-saved", String(Date.now()));
              await c.put(req, new Response(body, { status: res.status, statusText: res.statusText, headers }));
              trim(c);
            }
            return res;
          })
          .catch(() => hit || caches.match(OFFLINE));
        if (hit && age < FRESH_MS) {
          e.waitUntil(network);
          return hit;
        }
        return network;
      }),
    );
  }
});

async function trim(c) {
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) if (!keys[i].url.endsWith(OFFLINE)) await c.delete(keys[i]);
}

self.addEventListener("push", (e) => {
  let data = { title: "Blockchain Pi", body: "", url: "/" };
  try {
    data = { ...data, ...e.data.json() };
  } catch {}
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: data.url } }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});
