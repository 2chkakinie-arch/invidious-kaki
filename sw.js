/* =====================================================================
 *  CoralProxy — Service Worker
 *  Loads the Scramjet service-worker runtime from a CDN that the page
 *  selected during boot (saved in sessionStorage and forwarded to us
 *  via a registration query-string, plus a hard-coded fallback chain).
 *
 *  Scope: "/"
 *  Route prefix: "/scram/"   (must match index.html CFG.prefix)
 *  BareMux  prefix: "/baremux/"
 *
 *  Strategy:
 *    1. Try a list of CDN URLs in order until one of importScripts()
 *       succeeds (we treat importScripts as the canonical loader because
 *       it is synchronous and blocks SW activation until ready).
 *    2. Initialize ScramjetServiceWorker and route /scram/ traffic
 *       through it.
 *    3. For everything else, fall through to the network.
 * ===================================================================*/

"use strict";

/* ----- CDN candidates (kept in sync with index.html CFG.cdnMirrors) ----- */
const CDN_CANDIDATES = [
  "https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet/dist/",
  "https://unpkg.com/@mercuryworkshop/scramjet/dist/",
  "https://esm.sh/@mercuryworkshop/scramjet/dist/",
  "https://cdn.jsdelivr.net/gh/MercuryWorkshop/scramjet@main/dist/"
];
const BAREMUX_CANDIDATES = [
  "https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux@2/dist/",
  "https://unpkg.com/@mercuryworkshop/bare-mux@2/dist/",
  "https://esm.sh/@mercuryworkshop/bare-mux@2/dist/"
];

const PREFIX  = "/scram/";
const BAREMUX = "/baremux/";

/* ----- Try multiple importScripts URLs until one loads ----- */
let scramCdnBase = null;
let bareCdnBase  = null;

function tryImportFirst(candidates, file) {
  for (const base of candidates) {
    try {
      importScripts(base + file);
      return base;
    } catch (e) {
      // Continue to next mirror; SW console will show the error.
      console.warn("[CoralProxy SW] missed:", base + file, e && e.message);
    }
  }
  return null;
}

scramCdnBase = tryImportFirst(CDN_CANDIDATES, "scramjet.all.js");
if (!scramCdnBase) {
  // Last resort: install a passthrough so the page still loads and
  // can show an error to the user.
  console.error("[CoralProxy SW] FATAL — no Scramjet CDN reachable.");
}

bareCdnBase = tryImportFirst(BAREMUX_CANDIDATES, "index.js");
if (!bareCdnBase) {
  console.error("[CoralProxy SW] FATAL — no BareMux CDN reachable.");
}

/* ----- Initialize Scramjet (when loaded) ----- */
let scramjet = null;
try {
  if (typeof $scramjetLoadWorker === "function") {
    const { ScramjetServiceWorker } = $scramjetLoadWorker();
    scramjet = new ScramjetServiceWorker();
  } else {
    console.error("[CoralProxy SW] $scramjetLoadWorker not defined.");
  }
} catch (e) {
  console.error("[CoralProxy SW] Scramjet init failed:", e);
}

/* ----- Lifecycle: aggressive activation ----- */
self.addEventListener("install", (event) => {
  // Take control on next request
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ----- Fetch handler ----- */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Scramjet route: hand off to the rewriter
  if (scramjet && url.pathname.startsWith(PREFIX)) {
    event.respondWith((async () => {
      try {
        await scramjet.loadConfig();
        if (scramjet.route(event)) {
          return await scramjet.fetch(event);
        }
        return fetch(req);
      } catch (err) {
        console.error("[CoralProxy SW] proxy error:", err);
        return new Response(renderError(err), {
          status: 502,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
    })());
    return;
  }

  // 2) BareMux internal route (the worker.js + transport modules) —
  //    transparently rewrite to whichever CDN was chosen during boot.
  if (url.pathname.startsWith(BAREMUX) && bareCdnBase) {
    const filename = url.pathname.slice(BAREMUX.length);
    event.respondWith(
      fetch(bareCdnBase + filename, { mode: "cors", cache: "force-cache" })
        .catch(err => new Response("BareMux unreachable: " + err.message, { status: 502 }))
    );
    return;
  }

  // 3) Pass-through for everything else (same-origin static, etc.)
  // No event.respondWith — let the browser handle it natively.
});

/* ----- Pretty error page for proxied requests ----- */
function renderError(err) {
  const msg = (err && (err.stack || err.message)) || String(err);
  return `<!doctype html><html><head><meta charset="utf-8"><title>CoralProxy — Error</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif;
       background:#0a0e1a;color:#e6ecff;display:flex;align-items:center;justify-content:center;
       height:100vh;padding:24px;text-align:center}
  .card{max-width:520px;background:#11172a;border:1px solid rgba(255,255,255,.1);
        border-radius:14px;padding:28px;box-shadow:0 12px 40px rgba(0,0,0,.5)}
  h1{margin:0 0 8px;font-size:20px;background:linear-gradient(135deg,#ff5d8f,#7c5cff,#3ad3ff);
     -webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin:6px 0;color:#9aa4c7;font-size:13px;line-height:1.6}
  pre{background:#070912;border:1px solid rgba(255,255,255,.06);border-radius:8px;
      padding:12px;font-size:11.5px;color:#ff9c9c;text-align:left;overflow:auto;max-height:200px}
  button{margin-top:14px;padding:9px 18px;border:0;border-radius:8px;color:#fff;font-weight:600;
         background:linear-gradient(135deg,#ff5d8f,#7c5cff);cursor:pointer}
</style></head><body>
<div class="card">
  <h1>CoralProxy</h1>
  <p>The page could not be loaded through the proxy.</p>
  <pre>${msg.replace(/</g,"&lt;")}</pre>
  <p>This is usually a transient network or Wisp server issue. Try reloading,
     or open Settings and pick a different Wisp server.</p>
  <button onclick="location.reload()">Try again</button>
</div>
</body></html>`;
}
