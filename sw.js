/* Service worker: statische bestanden cache-first, pagina's stale-while-revalidate. Versie wisselt per build. */
var VERSION = "aeeb4f8463";
var STATIC = "static-" + VERSION, PAGES = "pages-" + VERSION;
var PRECACHE = ["/","/js/site.js","/js/nav.js","/fonts/inter.woff2","/fonts/plusjakartasans.woff2"];
var PAGE_LIMIT = 150;
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(STATIC).then(function (c) { return c.addAll(PRECACHE).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== STATIC && k !== PAGES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function trim(c) {
  return c.keys().then(function (keys) { if (keys.length <= PAGE_LIMIT) return; return Promise.all(keys.slice(0, keys.length - PAGE_LIMIT).map(function (k) { return c.delete(k); })); });
}
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u; try { u = new URL(r.url); } catch (err) { return; }
  if (u.origin !== location.origin) return;
  if (/\.(woff2|css|js|webp|png|jpe?g|svg|ico|avif|webmanifest)$/.test(u.pathname)) {
    e.respondWith(caches.open(STATIC).then(function (c) {
      return c.match(r).then(function (hit) {
        if (hit) return hit;
        return fetch(r).then(function (res) { if (res && res.ok) c.put(r, res.clone()); return res; });
      });
    }));
    return;
  }
  var accept = r.headers.get("accept") || "";
  var isPage = r.mode === "navigate" || accept.indexOf("text/html") >= 0 || /\/$|\.html$/.test(u.pathname);
  if (!isPage) return;
  var k = u.pathname + u.search;
  e.respondWith(caches.open(PAGES).then(function (c) {
    return c.match(k).then(function (hit) {
      var net = fetch(r).then(function (res) {
        if (res && res.ok && (res.headers.get("content-type") || "").indexOf("text/html") >= 0) { c.put(k, res.clone()); trim(c); }
        return res;
      }).catch(function () { return null; });
      if (hit) { e.waitUntil(net); return hit; }
      return net.then(function (res) { return res || c.match("/") || Response.error(); });
    });
  }));
});
