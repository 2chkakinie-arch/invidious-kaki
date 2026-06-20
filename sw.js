/* ============================================================
 *  CoralProxy — Service Worker
 *  Minimal entrypoint: hands every fetch off to Scramjet.
 *  The actual rewriting engine ($scramjetLoadWorker / ScramjetServiceWorker)
 *  is fetched from jsDelivr so this file stays tiny and easy to host.
 * ============================================================ */
"use strict";

// ---- Configuration (kept in sync with index.html) ----
const SCRAMJET_CDN_BASE = "https://cdn.jsdelivr.net/npm/@mercuryworkshop/scramjet@1.1.0/dist";

// Pull the full Scramjet bundle from CDN. importScripts works cross-origin
// inside a classic service worker, which is exactly what UV-static relied on.
importScripts(`${SCRAMJET_CDN_BASE}/scramjet.all.js`);

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Skip the "wait for refresh" dance — activate immediately so the
// very first navigation after registration is already proxied.
self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

async function handleRequest(event) {
    // loadConfig() pulls the latest user config (codecs, prefix, etc.) that
    // the page wrote into IndexedDB. Must be awaited on every request because
    // the user may change Wisp URL / transport at runtime.
    await scramjet.loadConfig();

    if (scramjet.route(event)) {
        return scramjet.fetch(event);
    }
    return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event));
});

// Allow the page to ping the worker (debug / health check)
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "ping") {
        event.source && event.source.postMessage({ type: "pong", ok: true });
    }
});
