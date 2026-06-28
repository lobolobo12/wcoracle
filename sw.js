/* WCoracle service worker — offline cache for the app shell.
 * Bump CACHE when you change app files so clients pick up the new version.
 * Strategy: cache-first for the shell; network-first for results data. */
const CACHE = "wcoracle-v1";
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/data.js",
  "./js/engine.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Always try the network first for live results so the Oracle stays current.
  if (url.pathname.endsWith("data/results.json")) {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Cache-first for everything else (the app shell).
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
