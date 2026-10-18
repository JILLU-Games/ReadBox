const CACHE_NAME = "mailstack-public-static-v2";
const OFFLINE_PAGE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_PAGE)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("mailstack-public-static-") &&
                key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_PAGE)));
    return;
  }

  const publicStatic = url.pathname.startsWith("/_next/static/");
  if (!publicStatic || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      const type = response.headers.get("content-type") ?? "";
      const cacheControl =
        response.headers.get("cache-control")?.toLowerCase() ?? "";
      if (
        response.ok &&
        cacheControl.includes("immutable") &&
        !response.headers.has("set-cookie") &&
        /javascript|css|image|font/.test(type)
      ) {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});
