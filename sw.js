// Offline: precache every app file (list + version in assets.js), serve cache-first.
importScripts("assets.js");
const CACHE = "cut-" + self.VERSION;
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(self.ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
