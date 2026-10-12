/* Gedeeld sitegedrag (header, mobiel menu, lightbox, jaartal) met event-delegatie, zodat het ook na een zachte paginawissel werkt. */
(function () {
  "use strict";
  var S = window.__site = window.__site || {};
  function byId(id) { return document.getElementById(id); }
  function onScroll() {
    var nav = byId("site-nav"); if (!nav) return;
    var up = window.scrollY > 20;
    ["bg-white/95", "backdrop-blur-md", "shadow-sm", "border-b", "border-gray-100"].forEach(function (c) { nav.classList.toggle(c, up); });
    ["bg-white/80", "backdrop-blur-sm"].forEach(function (c) { nav.classList.toggle(c, !up); });
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  function setMenu(open) {
    var o = byId("mobile-overlay"), p = byId("mobile-panel"), b = byId("mobile-menu-btn");
    if (!o || !p) { document.body.classList.remove("no-scroll"); return; }
    o.classList.toggle("hidden", !open); p.classList.toggle("hidden", !open);
    document.body.classList.toggle("no-scroll", open);
    if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { var c = byId("mobile-menu-close"); if (c) c.focus(); }
  }
  function ensureLightbox() {
    var lb = byId("image-lightbox"); if (lb) return lb;
    lb = document.createElement("div");
    lb.id = "image-lightbox";
    lb.className = "hidden fixed inset-0 z-[90] items-center justify-center bg-gray-900/95 backdrop-blur-sm p-4 sm:p-8";
    lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Afbeelding vergroot");
    lb.innerHTML = '<button id="image-lightbox-close" type="button" class="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:top-6 sm:right-6" aria-label="Sluiten"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button><img id="image-lightbox-img" src="" alt="" width="1200" height="800" class="max-h-[92vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl" decoding="async"/>';
    document.body.appendChild(lb);
    return lb;
  }
  function openLightbox(src, alt) {
    var lb = ensureLightbox(), img = byId("image-lightbox-img");
    img.src = src; img.alt = alt || "";
    lb.classList.remove("hidden"); lb.classList.add("flex");
    document.body.classList.add("no-scroll");
  }
  function closeLightbox() {
    var lb = byId("image-lightbox"); if (!lb) return;
    lb.classList.add("hidden"); lb.classList.remove("flex");
    document.body.classList.remove("no-scroll");
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-lightbox-src],#mobile-menu-btn,#mobile-menu-close,#mobile-overlay,#image-lightbox-close,#image-lightbox") : null;
    if (!t) return;
    if (t.hasAttribute("data-lightbox-src")) { e.preventDefault(); openLightbox(t.getAttribute("data-lightbox-src"), t.getAttribute("data-lightbox-alt")); return; }
    if (t.id === "mobile-menu-btn") setMenu(true);
    else if (t.id === "mobile-menu-close" || t.id === "mobile-overlay") setMenu(false);
    else if (t.id === "image-lightbox-close" || (t.id === "image-lightbox" && e.target === t)) closeLightbox();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { setMenu(false); closeLightbox(); } });
  S.init = function () {
    var y = byId("year"); if (y) y.textContent = new Date().getFullYear();
    setMenu(false); closeLightbox(); onScroll();
  };
  S.init();
  if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
  }
})();
