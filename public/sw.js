/* Runtime-caching service worker for offline use.
   App DATA lives in IndexedDB (not here), so it's always available offline. */
const CACHE = "farmer-onboarding-v44";
const TILE_CACHE = "map-tiles-v1";
const TILE_HOSTS = ["server.arcgisonline.com"];

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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Satellite map tiles are cross-origin. Cache-first keeps previously viewed
  // or pre-cached tiles available during slow/no-network farm boundary capture.
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const cached = await caches.match(req, { cacheName: TILE_CACHE });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          caches.open(TILE_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  if (url.origin !== location.origin) return;

  // Next static-export client navigations fetch route payloads like
  // /farmer/index.txt?id=...&_rsc=... before rendering the page. Those payloads
  // are route-level, not query-specific, so serve them cache-first by pathname.
  // This keeps farmer-card taps, back/home taps, and sign-in redirects working
  // when the network is offline, slow, or changing state mid-click.
  if (url.pathname.endsWith("/index.txt") || url.searchParams.has("_rsc")) {
    e.respondWith((async () => {
      const keys = [
        url.origin + url.pathname,
        url.pathname,
      ];
      let cached = null;
      for (const key of keys) {
        cached = await caches.match(key);
        if (cached) break;
      }

      const fromNetwork = fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            caches.open(CACHE).then((c) => {
              c.put(url.origin + url.pathname, res.clone()).catch(() => {});
              c.put(url.pathname, res.clone()).catch(() => {});
            }).catch(() => {});
          }
          return res;
        })
        .catch(() => null);

      return cached || (await fromNetwork) || Response.error();
    })());
    return;
  }

  // Navigations: CACHE-FIRST (stale-while-revalidate), cached per PATH (ignoring
  // ?query) so /farmer/?id=123 reuses the cached /farmer/ shell. Serving from
  // cache first means the app opens INSTANTLY regardless of network speed — a
  // slow/flaky connection can no longer hang the page load. We still fetch in
  // the background to refresh the cached shell for next time; the service-worker
  // version bump + auto-reload is what actually ships new app versions.
  if (req.mode === "navigate") {
    const pathNoSlash = url.pathname.replace(/\/$/, "") || "/";
    const pathWithSlash = pathNoSlash === "/" ? "/" : `${pathNoSlash}/`;
    const shellKeys = [
      url.origin + pathWithSlash,
      url.origin + pathNoSlash,
      pathWithSlash,
      pathNoSlash,
      "/home/",
      "/home",
      "/",
    ];
    e.respondWith((async () => {
      let cached = null;
      for (const key of shellKeys) {
        cached = await caches.match(key);
        if (cached) break;
      }

      // Background refresh (don't block the response on the network).
      const fromNetwork = fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            caches.open(CACHE).then((c) => {
              c.put(url.origin + pathWithSlash, res.clone()).catch(() => {});
              c.put(pathWithSlash, res.clone()).catch(() => {});
            }).catch(() => {});
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
