/* Runtime-caching service worker for offline use.
   App DATA lives in IndexedDB (not here), so it's always available offline. */
const CACHE = "farmer-onboarding-v2";

self.addEventListener("install", () => self.skipWaiting());

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
  if (new URL(req.url).origin !== location.origin) return;

  // Navigations: network-first. IMPORTANT: a service worker must NOT return a
  // *redirected* response to a navigation (browsers fail it with ERR_FAILED),
  // so rebuild a clean response when the fetch followed a redirect (e.g. the
  // trailingSlash 308 on /farmer -> /farmer/).
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.redirected) {
          const body = await res.blob();
          return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match("/")) || Response.error();
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
