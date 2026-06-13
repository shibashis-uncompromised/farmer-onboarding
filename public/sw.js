/* Runtime-caching service worker for offline use.
   App DATA lives in IndexedDB (not here), so it's always available offline. */
const CACHE = "farmer-onboarding-v8";

// Build-time list of all JS/CSS/font chunks (written by scripts/gen-sw-manifest.mjs).
try { importScripts("/sw-manifest.js"); } catch (e) {}
const CHUNKS = self.__PRECACHE_MANIFEST || [];

const SHELLS = [
  "/", "/home/", "/farmer/", "/login/",
  "/manifest.webmanifest",
  "/icons/logo.png", "/icons/icon-192.png", "/icons/icon-512.png",
  "/icons/apple-touch-icon.png", "/icons/maskable-512.png", "/icons/favicon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled([...SHELLS, ...CHUNKS].map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navigations: network-first, cached per PATH (ignoring ?query) so a route
  // like /farmer/?id=123 reuses the cached /farmer/ shell offline. Offline
  // falls back to that same-path shell — NOT to home — so opening a farmer
  // offline shows the farmer page, which reads ?id from the URL client-side.
  if (req.mode === "navigate") {
    const shellKey = url.origin + url.pathname;          // strip query
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const clean = res.redirected
          ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers })
          : res;
        if (res.ok) {
          const copy = clean.clone();
          caches.open(CACHE).then((c) => c.put(shellKey, copy)).catch(() => {});
        }
        return clean;
      } catch {
        return (
          (await caches.match(shellKey)) ||
          (await caches.match(url.pathname)) ||
          (await caches.match("/home/")) ||
          (await caches.match("/")) ||
          Response.error()
        );
      }
    })());
    return;
  }

  // Static assets: cache-first
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && !res.redirected) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});
