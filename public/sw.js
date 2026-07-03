/* Runtime-caching service worker for offline use.
   App DATA lives in IndexedDB (not here), so it's always available offline. */
const CACHE = "farmer-onboarding-v26";

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

  // Navigations: CACHE-FIRST (stale-while-revalidate), cached per PATH (ignoring
  // ?query) so /farmer/?id=123 reuses the cached /farmer/ shell. Serving from
  // cache first means the app opens INSTANTLY regardless of network speed — a
  // slow/flaky connection can no longer hang the page load. We still fetch in
  // the background to refresh the cached shell for next time; the service-worker
  // version bump + auto-reload is what actually ships new app versions.
  if (req.mode === "navigate") {
    const shellKey = url.origin + url.pathname;          // strip query
    e.respondWith((async () => {
      const cached =
        (await caches.match(shellKey)) ||
        (await caches.match(url.pathname)) ||
        (await caches.match("/home/")) ||
        (await caches.match("/"));

      // Background refresh (don't block the response on the network).
      const fromNetwork = fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(shellKey, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      // Serve cache immediately if we have it; otherwise wait for the network
      // (first-ever visit, nothing cached yet).
      return cached || (await fromNetwork) || Response.error();
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
