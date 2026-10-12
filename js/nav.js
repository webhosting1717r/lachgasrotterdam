/* Directe navigatie: prefetch bij intentie (aanraken, hover, in beeld) en zachte paginawissel zonder volledige herlaad. */
(function () {
  "use strict";
  if (!window.fetch || !window.DOMParser || !window.history || !history.pushState || !document.body || !Element.prototype.closest) return;
  var cache = new Map(), MAX = 60, inflight = new Map();
  var conn = navigator.connection || {};
  var eager = !conn.saveData && !/2g/.test(conn.effectiveType || "");
  function isFile(path) { var seg = path.split("/").pop(); return seg.indexOf(".") >= 0 && !/\.html?$/.test(seg); }
  function linkFor(el) {
    var a = el && el.closest ? el.closest("a[href]") : null;
    if (!a) return null;
    if (a.target && a.target !== "_self") return null;
    if (a.hasAttribute("download") || a.hasAttribute("data-no-router") || /\bexternal\b/.test(a.rel || "")) return null;
    var u; try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (u.origin !== location.origin || !/^https?:$/.test(u.protocol)) return null;
    if (isFile(u.pathname)) return null;
    if (u.pathname === location.pathname && u.search === location.search && u.hash) return null;
    return u;
  }
  function key(u) { return u.pathname + u.search; }
  function remember(k, html) { if (cache.size >= MAX) cache.delete(cache.keys().next().value); cache.set(k, html); }
  function load(u) {
    var k = key(u);
    if (cache.has(k)) return Promise.resolve(cache.get(k));
    if (inflight.has(k)) return inflight.get(k);
    var p = fetch(u.href, { credentials: "same-origin", headers: { Accept: "text/html" } }).then(function (r) {
      var ct = r.headers.get("content-type") || "";
      if (!r.ok || ct.indexOf("text/html") < 0) throw new Error("bad response");
      return r.text();
    }).then(function (html) { remember(k, html); inflight.delete(k); return html; }, function (e) { inflight.delete(k); throw e; });
    inflight.set(k, p);
    return p;
  }
  function prefetch(u) { if (!u) return; var k = key(u); if (cache.has(k) || inflight.has(k) || k === key(location)) return; load(u).catch(function () {}); }
  var bar, barTimer;
  function showBar() {
    if (!bar) { bar = document.createElement("div"); bar.id = "nav-progress"; bar.setAttribute("aria-hidden", "true"); }
    bar.style.cssText = "position:fixed;top:0;left:0;height:3px;width:25%;background:#22c55e;z-index:9999;pointer-events:none;opacity:1;transition:width .5s ease,opacity .3s";
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.style.width = "75%"; });
  }
  function hideBar() { clearTimeout(barTimer); if (bar && bar.parentNode) { bar.style.width = "100%"; bar.style.opacity = "0"; setTimeout(function () { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); }, 350); } }
  function syncMeta(doc, sel, attr) { var o = document.querySelector(sel), n = doc.querySelector(sel); if (o && n) o.setAttribute(attr, n.getAttribute(attr)); }
  function render(html, u, push) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var nb = doc.body;
    if (!nb || !doc.querySelector("main")) throw new Error("no main");
    document.title = doc.title;
    syncMeta(doc, 'meta[name="description"]', "content");
    syncMeta(doc, 'meta[name="robots"]', "content");
    syncMeta(doc, 'link[rel="canonical"]', "href");
    syncMeta(doc, 'meta[property="og:url"]', "content");
    document.body.className = nb.className;
    var om = document.querySelector("main");
    if (om) om.replaceWith(doc.querySelector("main")); else document.body.innerHTML = nb.innerHTML;
    ["#site-nav", "#mobile-panel", "#mobile-overlay", "header", "footer"].forEach(function (sel) {
      var o = document.querySelector(sel), n = doc.querySelector(sel);
      if (o && n && o.outerHTML !== n.outerHTML) o.replaceWith(n);
    });
    if (push) history.pushState({ nav: true, scroll: 0 }, "", u.href);
    var target = u.hash ? document.getElementById(u.hash.slice(1)) : null;
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    var m = document.querySelector("main");
    if (m) { m.setAttribute("tabindex", "-1"); try { m.focus({ preventScroll: true }); } catch (e) {} }
    if (window.__site && window.__site.init) { try { window.__site.init(); } catch (e) {} }
    observe();
    try { document.dispatchEvent(new CustomEvent("nav:done", { detail: { url: u.href } })); } catch (e) {}
  }
  var current = 0;
  function go(u, push) {
    var id = ++current;
    history.replaceState({ nav: true, scroll: window.scrollY }, "", location.href);
    clearTimeout(barTimer); barTimer = setTimeout(showBar, 120);
    load(u).then(function (html) { if (id !== current) return; hideBar(); render(html, u, push); })
      .catch(function () { if (id !== current) return; location.href = u.href; });
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var u = linkFor(e.target); if (!u) return;
    e.preventDefault(); go(u, true);
  });
  window.addEventListener("popstate", function (e) {
    var u = new URL(location.href);
    var s = e.state && typeof e.state.scroll === "number" ? e.state.scroll : 0;
    current++;
    load(u).then(function (html) { render(html, u, false); window.scrollTo(0, s); }).catch(function () { location.reload(); });
  });
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  document.addEventListener("pointerdown", function (e) { prefetch(linkFor(e.target)); }, { passive: true });
  document.addEventListener("touchstart", function (e) { prefetch(linkFor(e.target)); }, { passive: true });
  var hoverTimer;
  document.addEventListener("mouseover", function (e) { var u = linkFor(e.target); if (!u) return; clearTimeout(hoverTimer); hoverTimer = setTimeout(function () { prefetch(u); }, 65); }, { passive: true });
  var io, seen = 0, LIMIT = 16;
  function observe() {
    if (!eager || !("IntersectionObserver" in window)) return;
    if (io) io.disconnect();
    seen = 0;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        if (seen++ >= LIMIT) return;
        var u = linkFor(en.target); if (!u) return;
        var run = function () { prefetch(u); };
        if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 400);
      });
    }, { rootMargin: "0px 0px 240px 0px" });
    var root = document.querySelector("main") || document.body;
    var links = root.querySelectorAll("a[href]"), done = {};
    for (var i = 0; i < links.length; i++) { var u = linkFor(links[i]); if (!u) continue; var k = key(u); if (done[k] || k === key(location)) continue; done[k] = 1; io.observe(links[i]); }
  }
  history.replaceState({ nav: true, scroll: window.scrollY }, "", location.href);
  observe();
})();
