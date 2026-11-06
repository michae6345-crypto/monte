// Monte's service worker: so /app opens with no signal (inside a store). The engine runs in the
// page, so a cached page plus its static files is the whole Pay screen. Never caches /api/*.
//   - /_next/static, card art, merchant logos, brand files: cache first (their URLs are hashed or fixed)
//   - /app itself: network first, the cached copy when offline
// Bump VERSION to drop old caches.

const VERSION = "monte-app-v1";
const STATIC = /^\/(_next\/static|cards|merchants|brand|fonts)\//;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(["/app"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (STATIC.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname === "/app") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("/app", copy));
          }
          return res;
        })
        .catch(() => caches.match("/app").then((hit) => hit || Response.error())),
    );
  }
});
