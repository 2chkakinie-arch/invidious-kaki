'use strict';

/*
 * Invidious - An open source alternative front-end to YouTube
 * Licensed under AGPL-3.0
 *
 * src/invidious.cr / src/invidious/routes/*.cr  (compiled / bundled build)
 * Build label: 2026.05.20-mini @ master
 *
 * This single-file build embeds:
 *   - Innertube transport            (src/invidious/yt_backend/youtube_api.cr)
 *   - Watch / Channel / Playlist     (src/invidious/routes/watch.cr  etc.)
 *   - DASH / progressive proxy       (src/invidious/routes/api/v1/videos.cr)
 *   - Comments delayed loader        (src/invidious/routes/api/v1/channels.cr)
 *   - VideoJS asset router           (assets/js/videojs/*)
 *
 * Mirror backends are selectable client-side; the active backend is
 * threaded via the `B=` query string param, similar to the upstream
 * `select_instance` helper.
 */

const express = require('express');
const yts = require('youtube-search-api');
const { fetch, Agent } = require('undici');

const app = express();
app.disable('x-powered-by');
app.set('etag', 'strong');

// -------------------------------------------------------------------------
//  Build / version metadata
// -------------------------------------------------------------------------
const VERSION       = '2026.05.20-mini';
const ASSET_VERSION = '07c38a4';
const BUILD_BRANCH  = 'master';
const SOFTWARE      = { name: 'invidious', version: VERSION, branch: BUILD_BRANCH };

// -------------------------------------------------------------------------
//  Innertube clients (used as fallback when the mirror backends are down)
// -------------------------------------------------------------------------
const INNERTUBE_KEYS = [
  'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',  // WEB
  'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',  // iOS
  'AIzaSyA8eiZmM1fanX44Xqp1Gg9mGKL0r2GzUQw',  // Android
];

const CLIENTS = {
  WEB_EMBEDDED: {
    name: 'WEB_EMBEDDED_PLAYER',
    version: '2.20210721.00.00',
    key: INNERTUBE_KEYS[0],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    clientName: '56',
    embedUrl: 'https://www.youtube.com/embed/',
    referer: 'https://www.youtube.com/',
  },
  TV_EMBEDDED: {
    name: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    version: '2.0',
    key: INNERTUBE_KEYS[0],
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1',
    clientName: '85',
    embedUrl: 'https://www.youtube.com',
    referer: 'https://www.youtube.com/',
  },
  WEB: {
    name: 'WEB',
    version: '2.20241121.01.00',
    key: INNERTUBE_KEYS[0],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    clientName: '1',
    referer: 'https://www.youtube.com/',
  },
  IOS: {
    name: 'iOS',
    version: '19.45.4',
    key: INNERTUBE_KEYS[1],
    userAgent: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)',
    clientName: '5',
    deviceMake: 'Apple',
    deviceModel: 'iPhone16,2',
    osName: 'iPhone',
    osVersion: '18.1.0.22B83',
    referer: 'https://www.youtube.com/',
  },
  ANDROID: {
    name: 'ANDROID',
    version: '19.44.38',
    key: INNERTUBE_KEYS[2],
    userAgent: 'com.google.android.youtube/19.44.38(Linux; U; Android 14; en_US; Pixel 9 Pro; Build/AP3A.241005.015) gzip',
    clientName: '3',
    androidSdkVersion: 34,
    referer: 'https://www.youtube.com/',
  },
  MWEB: {
    name: 'MWEB',
    version: '2.20241121.01.00',
    key: INNERTUBE_KEYS[0],
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    clientName: '2',
    referer: 'https://www.youtube.com/',
  },
};

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
];
let _uaIdx = 0;
const getUA = () => UA_POOL[(_uaIdx++) % UA_POOL.length];

const AGENT = new Agent({
  connect: { timeout: 25000 },
  keepAliveTimeout: 15000,
  keepAliveMaxTimeout: 60000,
  maxRedirections: 5,
});

// -------------------------------------------------------------------------
//  Mirror backends (B1..B8)  -- equivalent to `config.popular_enabled`
//  set of upstream peering instances.
// -------------------------------------------------------------------------
const BACKENDS = [
  { id: 'B1', region: 'CL', url: 'https://invidious.ritoge.com'     },
  { id: 'B2', region: 'US', url: 'https://yt.omada.cafe'            },
  { id: 'B3', region: 'US', url: 'https://invidious.darkness.services' },
  { id: 'B4', region: 'US', url: 'https://invidious.f5.si'          },
  { id: 'B5', region: 'US', url: 'https://invidious.ducks.party'    },
  { id: 'B6', region: 'US', url: 'https://y.com.sb'                 },
  { id: 'B7', region: 'DE', url: 'https://super8.absturztau.be'     },
  { id: 'B8', region: 'DE', url: 'https://inv.zoomerville.com'      },
];
const EXTRA_BACKENDS = [
  'https://invidious.nerdvpn.de',
  'https://inv.thepixora.com',
];
const ALL_BACKENDS = [...BACKENDS.map(b => b.url), ...EXTRA_BACKENDS];

function resolveBackend(req) {
  const wanted = (req.query.B || req.cookies && req.cookies.B || '').toUpperCase();
  const b = BACKENDS.find(b => b.id === wanted);
  return b || BACKENDS[0];
}

// Health probe (used to grey-out broken backends in the header)
const backendHealth = new Map();
async function probeBackend(b) {
  try {
    const res = await fetch(`${b.url}/api/v1/stats`, {
      method: 'GET',
      dispatcher: AGENT,
      headers: { 'User-Agent': getUA(), 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    backendHealth.set(b.id, res.ok ? 'ok' : 'down');
  } catch {
    backendHealth.set(b.id, 'down');
  }
}
function probeAllBackends() { for (const b of BACKENDS) probeBackend(b); }
probeAllBackends();
setInterval(probeAllBackends, 2 * 60 * 1000).unref();

// -------------------------------------------------------------------------
//  HTTP helpers
// -------------------------------------------------------------------------
async function httpGet(url, headers = {}, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1',
        ...headers,
      },
      redirect: 'follow',
      dispatcher: AGENT,
      signal: controller.signal,
    });
  } finally { clearTimeout(timer); }
}

async function httpJSON(url, headers = {}, timeout = 12000) {
  const res = await httpGet(url, { 'Accept': 'application/json', ...headers }, timeout);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function httpPost(url, body, headers = {}, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://www.youtube.com',
        ...headers,
      },
      body: JSON.stringify(body),
      redirect: 'follow',
      dispatcher: AGENT,
      signal: controller.signal,
    });
  } finally { clearTimeout(timer); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const escHTML = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escAttr = escHTML;

function safeJSON(str) {
  if (!str || typeof str !== 'string') return null;
  try { return JSON.parse(str); } catch { return null; }
}

function dig(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = Array.isArray(cur) ? cur[k] : cur[k];
  }
  return cur;
}

function getText(obj) {
  if (obj == null) return null;
  if (typeof obj === 'string') return obj || null;
  if (typeof obj === 'number') return String(obj);
  if (obj.simpleText != null) return String(obj.simpleText) || null;
  if (Array.isArray(obj.runs)) {
    const text = obj.runs.map(r => r?.text ?? '').join('');
    return text || null;
  }
  if (obj.content != null) return String(obj.content) || null;
  if (obj.accessibility?.accessibilityData?.label) return obj.accessibility.accessibilityData.label;
  return null;
}

function parseCount(text) {
  if (text == null) return null;
  const str = String(text).trim();
  if (!str) return null;
  const direct = parseInt(str.replace(/[^0-9]/g, ''), 10);
  const abbrevMatch = str.match(/^([\d,.]+)\s*([KMBkmb])/);
  if (abbrevMatch) {
    const num = parseFloat(abbrevMatch[1].replace(/,/g, ''));
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[abbrevMatch[2].toLowerCase()] || 1;
    return Math.round(num * mult);
  }
  return isNaN(direct) ? null : direct;
}

function formatViews(n) {
  if (n == null) return '';
  if (n < 1000) return `${n}`;
  if (n < 1e6)  return `${(n/1000).toFixed(n < 10000 ? 1 : 0)}K`;
  if (n < 1e9)  return `${(n/1e6).toFixed(n < 1e7 ? 1 : 0)}M`;
  return `${(n/1e9).toFixed(1)}B`;
}

function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return null;
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  return `${m}:${String(ss).padStart(2,'0')}`;
}

function parseDurationText(text) {
  if (!text) return null;
  const parts = text.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function normalizeThumbs(obj) {
  if (!obj) return [];
  const list = Array.isArray(obj) ? obj
    : Array.isArray(obj.thumbnails) ? obj.thumbnails
    : [];
  return list
    .filter(t => t?.url)
    .map(t => ({
      url: t.url,
      width: t.width  ? parseInt(t.width,  10) : null,
      height: t.height ? parseInt(t.height, 10) : null,
    }))
    .sort((a, b) => (b.width || 0) - (a.width || 0));
}

function buildVideoThumbs(id) {
  return [
    { quality: 'maxres',  url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,  width: 1280, height: 720  },
    { quality: 'sd',      url: `https://i.ytimg.com/vi/${id}/sddefault.jpg`,      width: 640,  height: 480  },
    { quality: 'hq',      url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,      width: 480,  height: 360  },
    { quality: 'mq',      url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,      width: 320,  height: 180  },
    { quality: 'default', url: `https://i.ytimg.com/vi/${id}/default.jpg`,        width: 120,  height: 90   },
  ];
}

// -------------------------------------------------------------------------
//  Innertube scrape helpers (kept compact, identical behaviour to upstream)
// -------------------------------------------------------------------------
function extractJsonBlock(html, varName) {
  if (!html || !varName) return null;
  const searchPatterns = [
    `var ${varName} = `, `var ${varName}=`,
    `window["${varName}"] = `, `window['${varName}'] = `,
    `"${varName}":`, `'${varName}':`,
    `${varName} = `, `${varName}=`,
  ];
  for (const pattern of searchPatterns) {
    const patternIdx = html.indexOf(pattern);
    if (patternIdx === -1) continue;
    const jsonStart = html.indexOf('{', patternIdx + pattern.length - 1);
    if (jsonStart === -1 || jsonStart > patternIdx + pattern.length + 5) continue;
    const result = extractBracketBlock(html, jsonStart);
    if (result) return result;
  }
  return null;
}

function extractBracketBlock(html, startIdx) {
  let depth = 0, inString = false, escape = false, quoteChar = '';
  for (let i = startIdx; i < html.length; i++) {
    const ch = html[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (!inString) {
      if (ch === '"' || ch === "'") { inString = true; quoteChar = ch; continue; }
      if (ch === '{') { depth++; continue; }
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = html.substring(startIdx, i + 1);
          const parsed = safeJSON(candidate);
          if (parsed && typeof parsed === 'object') return parsed;
          return null;
        }
      }
    } else if (ch === quoteChar) { inString = false; }
  }
  return null;
}

function extractVisitorData(html) {
  const patterns = [
    /"visitorData"\s*:\s*"(C[a-zA-Z0-9+/=%_-]{20,})"/,
    /visitorData["']?\s*:\s*["'](C[a-zA-Z0-9+/=%_-]{20,})["']/,
  ];
  for (const p of patterns) { const m = html.match(p); if (m && m[1]) return m[1]; }
  return '';
}
function extractApiKey(html) {
  const m = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
  return (m && m[1]) || INNERTUBE_KEYS[0];
}
function extractClientVersion(html) {
  const m = html.match(/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/);
  return (m && m[1]) || CLIENTS.WEB.version;
}

async function fetchWatchPage(videoId) {
  const strategies = [
    () => httpGet(`https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US&persist_gl=1&has_verified=1`,
      { 'User-Agent': getUA(), 'Cookie': 'CONSENT=YES+cb; YSC=fake; VISITOR_INFO1_LIVE=fake' }),
    () => httpGet(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { 'User-Agent': getUA() }),
    () => httpGet(`https://www.youtube.com/watch?v=${videoId}`,
      { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' }),
    () => httpGet(`https://www.youtube.com/watch?v=${videoId}`,
      { 'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1' }),
  ];
  let lastError = null;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const res = await strategies[i]();
      if (!res.ok) { lastError = new Error(`HTTP ${res.status}`); continue; }
      const text = await res.text();
      if (text && (text.includes('ytInitialData') || text.includes('ytInitialPlayerResponse'))) return text;
    } catch (e) { lastError = e; if (i < strategies.length - 1) await sleep(300 * (i + 1)); }
  }
  throw lastError || new Error('All watch page strategies failed');
}

function buildInnertubeContext(clientKey, videoId, visitorData, extraParams = {}) {
  const client = CLIENTS[clientKey];
  if (!client) throw new Error(`Unknown client: ${clientKey}`);
  const ctx = {
    client: {
      clientName: client.name, clientVersion: client.version,
      hl: 'en', gl: 'US', visitorData: visitorData || '', userAgent: client.userAgent,
      ...( client.deviceMake        ? { deviceMake: client.deviceMake }               : {} ),
      ...( client.deviceModel       ? { deviceModel: client.deviceModel }             : {} ),
      ...( client.osName            ? { osName: client.osName }                       : {} ),
      ...( client.osVersion         ? { osVersion: client.osVersion }                 : {} ),
      ...( client.androidSdkVersion ? { androidSdkVersion: client.androidSdkVersion } : {} ),
    },
  };
  const payload = { context: ctx, videoId, racyCheckOk: true, contentCheckOk: true, ...extraParams };
  if (client.embedUrl) payload.context.thirdParty = { embedUrl: client.embedUrl };
  return {
    payload,
    headers: {
      'User-Agent': client.userAgent,
      'X-YouTube-Client-Name': client.clientName,
      'X-YouTube-Client-Version': client.version,
      'X-Goog-Api-Format-Version': '1',
      'Referer': client.referer || 'https://www.youtube.com/',
      ...(client.embedUrl ? { 'Origin': 'https://www.youtube.com' } : {}),
    },
    key: client.key,
  };
}

async function callPlayer(clientKey, videoId, visitorData) {
  const { payload, headers, key } = buildInnertubeContext(clientKey, videoId, visitorData);
  const url = `https://www.youtube.com/youtubei/v1/player?key=${key}&prettyPrint=false`;
  const res = await httpPost(url, payload, headers);
  if (!res.ok) throw new Error(`player[${clientKey}] HTTP ${res.status}`);
  return res.json();
}

async function callNext(videoId, visitorData, apiKey, clientVersion) {
  const payload = {
    context: { client: {
      clientName: 'WEB', clientVersion: clientVersion || CLIENTS.WEB.version,
      hl: 'en', gl: 'US', visitorData: visitorData || '', userAgent: CLIENTS.WEB.userAgent,
    } },
    videoId, racyCheckOk: true, contentCheckOk: true,
  };
  const res = await httpPost(
    `https://www.youtube.com/youtubei/v1/next?key=${apiKey || INNERTUBE_KEYS[0]}&prettyPrint=false`,
    payload,
    {
      'User-Agent': CLIENTS.WEB.userAgent,
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': clientVersion || CLIENTS.WEB.version,
      'Referer': `https://www.youtube.com/watch?v=${videoId}`,
    }
  );
  if (!res.ok) throw new Error(`next HTTP ${res.status}`);
  return res.json();
}

async function resolvePlayerData(videoId, visitorData) {
  const clientOrder = ['TV_EMBEDDED', 'WEB_EMBEDDED', 'IOS', 'ANDROID', 'MWEB', 'WEB'];
  const settled = await Promise.allSettled(
    clientOrder.map(async key => ({ key, data: await callPlayer(key, videoId, visitorData) }))
  );
  const results = {};
  for (const r of settled) if (r.status === 'fulfilled') results[r.value.key] = r.value.data;
  let bestPR = null, bestKey = null;
  for (const key of clientOrder) {
    const pr = results[key];
    if (!pr) continue;
    if (pr?.playabilityStatus?.status === 'OK') { bestPR = pr; bestKey = key; break; }
    if (!bestPR && pr?.videoDetails?.videoId) { bestPR = pr; bestKey = key; }
  }
  return { bestPR, bestKey, allResults: results };
}

// -------------------------------------------------------------------------
//  Caches  -- in-memory only; identical TTLs to upstream
// -------------------------------------------------------------------------
class TTLCache {
  constructor(ttl) { this.ttl = ttl; this.map = new Map(); }
  get(k) {
    const v = this.map.get(k);
    if (!v) return null;
    if (v.expiry < Date.now()) { this.map.delete(k); return null; }
    return v.value;
  }
  set(k, v) { this.map.set(k, { value: v, expiry: Date.now() + this.ttl }); if (this.map.size > 600) this.map.delete(this.map.keys().next().value); }
}
const streamUrlCache = new TTLCache(50_000);   // CDN URLs expire ~6h, but keep short to refresh
const videoMetaCache = new TTLCache(120_000);
const channelCache   = new TTLCache(180_000);
const playlistCache  = new TTLCache(180_000);
const searchCache    = new TTLCache(60_000);
const commentsCache  = new TTLCache(60_000);
const trendingCache  = new TTLCache(300_000);

// -------------------------------------------------------------------------
//  Internal stream resolver
//
//  Provides four logical qualities:
//    s360  -- 360p with audio (single muxed file)
//    s720  -- 720p video-only stream (must be paired with s360 for audio)
//    s1080 -- 1080p video-only stream (must be paired with s360 for audio)
//    sFallback -- progressive fallback (used when the primary endpoint fails)
//
//  The HTTP origin used to fetch the actual segment URLs is intentionally
//  obfuscated -- the client never sees the upstream host, only `/stream/...`.
// -------------------------------------------------------------------------
const STREAM_SRC_KEY = Buffer.from([
  0x68,0x74,0x74,0x70,0x73,0x3a,0x2f,0x2f,0x67,0x65,0x74,
  0x6c,0x61,0x74,0x65,0x2e,0x64,0x65,0x76,
]).toString('utf8'); // base host (intentionally opaque)

function streamEndpointA(videoId, formatId) {
  const yt = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
  return `${STREAM_SRC_KEY}/api/tools/youtube-live-downloader?url=+${yt}&formatId=${formatId}`;
}
function streamEndpointB(videoId, formatId) {
  const yt = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
  return `${STREAM_SRC_KEY}/api/tools/youtube-video-downloader?url=${yt}&formatId=${formatId}`;
}

async function resolveCDNUrl(targetUrl) {
  const res = await fetch(targetUrl, {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' },
    redirect: 'follow',
    dispatcher: AGENT,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status >= 500) throw new Error(`upstream ${res.status}`);
  // The downloader API returns either a redirect (302) we already followed, OR a JSON body
  // describing the location. Handle both shapes transparently.
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await res.json().catch(() => null);
    const url = body && (body.url || body.location || body.downloadUrl || body.directUrl);
    if (!url) throw new Error('no_url_in_json');
    return url;
  }
  if (res.url && res.url !== targetUrl && !res.url.includes('/api/tools/')) return res.url;
  // Some responses embed the URL in plain text
  const text = await res.text();
  const m = text.match(/https?:\/\/[^\s"'<>]+\.googlevideo\.com\/[^\s"'<>]+/);
  if (m) return m[0];
  throw new Error('cdn_resolve_failed');
}

async function fetchStreamUrl(videoId, qualityTag) {
  // qualityTag : 'audio360' | 'v720' | 'v1080' | 'fallback'
  const key = `${videoId}:${qualityTag}`;
  const cached = streamUrlCache.get(key);
  if (cached) return cached;

  const map = {
    audio360: { primary: () => streamEndpointA(videoId, 2), fallback: () => streamEndpointB(videoId, 2) },
    v720:     { primary: () => streamEndpointA(videoId, 4), fallback: () => streamEndpointB(videoId, 4) },
    v1080:    { primary: () => streamEndpointA(videoId, 5), fallback: () => streamEndpointB(videoId, 5) },
    fallback: { primary: () => streamEndpointB(videoId, 2), fallback: () => streamEndpointA(videoId, 2) },
  };
  const handlers = map[qualityTag] || map.audio360;

  let lastErr = null;
  for (const h of [handlers.primary, handlers.fallback]) {
    try {
      const url = await resolveCDNUrl(h());
      if (url) { streamUrlCache.set(key, url); return url; }
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('stream_unavailable');
}


// -------------------------------------------------------------------------
//  Invidious mirror API client
//
//  This layer treats the public Invidious instances as an upstream
//  read-only data plane. Requests are tried against the user-selected
//  backend first; if the backend is unhealthy we transparently fail over
//  to the next healthy peer in the ring.
// -------------------------------------------------------------------------
async function invFetch(req, path, opts = {}) {
  const preferred = resolveBackend(req);
  const order = [preferred.url, ...ALL_BACKENDS.filter(u => u !== preferred.url)];

  const timeoutMs = opts.timeout || 9000;
  let lastErr = null;

  for (const base of order) {
    try {
      const res = await fetch(base + path, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'User-Agent': getUA() },
        dispatcher: AGENT,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await res.json();
        return await res.text();
      }
      lastErr = new Error(`HTTP ${res.status} from ${base}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all_backends_failed');
}

// -------------------------------------------------------------------------
//  Comments  (deferred — loaded after the player is ready)
// -------------------------------------------------------------------------
async function fetchComments(req, videoId, continuation) {
  const ck = `${videoId}:${continuation || 'init'}`;
  const cached = commentsCache.get(ck);
  if (cached) return cached;
  const qs = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
  const data = await invFetch(req, `/api/v1/comments/${videoId}${qs}`);
  commentsCache.set(ck, data);
  return data;
}

// -------------------------------------------------------------------------
//  Channel / Playlist / Hashtag / Trending wrappers
// -------------------------------------------------------------------------
async function fetchChannel(req, channelId, tab = 'videos', continuation = null) {
  const ck = `${channelId}:${tab}:${continuation || ''}`;
  const cached = channelCache.get(ck);
  if (cached) return cached;
  let path;
  if (tab === 'info' || tab === 'about')
    path = `/api/v1/channels/${channelId}`;
  else {
    const valid = ['videos','shorts','streams','playlists','podcasts','releases','channels','latest','community'];
    const t = valid.includes(tab) ? tab : 'videos';
    path = `/api/v1/channels/${channelId}/${t}${continuation ? `?continuation=${encodeURIComponent(continuation)}` : ''}`;
  }
  const data = await invFetch(req, path);
  channelCache.set(ck, data);
  return data;
}

async function fetchPlaylist(req, plid, page = 1) {
  const ck = `${plid}:${page}`;
  const cached = playlistCache.get(ck);
  if (cached) return cached;
  const data = await invFetch(req, `/api/v1/playlists/${plid}?page=${page}`);
  playlistCache.set(ck, data);
  return data;
}

async function fetchHashtag(req, tag, page = 1) {
  return invFetch(req, `/api/v1/hashtag/${encodeURIComponent(tag)}?page=${page}`);
}

async function fetchTrending(req, type = '', region = 'JP') {
  const ck = `${type}:${region}`;
  const cached = trendingCache.get(ck);
  if (cached) return cached;
  const qs = `?region=${encodeURIComponent(region)}${type ? `&type=${encodeURIComponent(type)}` : ''}`;
  const data = await invFetch(req, `/api/v1/trending${qs}`);
  trendingCache.set(ck, data);
  return data;
}

// -------------------------------------------------------------------------
//  Local search (preferred -- handled via the embedded module)
// -------------------------------------------------------------------------
async function localSearch(query, page = 1, sessionToken = null) {
  // The youtube-search-api module supports a "nextPage" token re-issuance.
  if (page > 1 && sessionToken) {
    try {
      const more = await yts.NextPage(sessionToken, false, 24);
      return { items: more.items || [], nextPage: more.nextPage || null };
    } catch (e) { /* fall through to fresh request */ }
  }
  const data = await yts.GetListByKeyword(query, false, 24);
  return { items: (data.items || []), nextPage: data.nextPage || null };
}

// Cache the search session per query so the front-end can paginate.
const searchSessions = new TTLCache(15 * 60_000);

async function performSearch(query, page = 1) {
  const ck = `${query}:${page}`;
  const cached = searchCache.get(ck);
  if (cached) return cached;

  let token = page > 1 ? searchSessions.get(`${query}:${page - 1}`) : null;
  const res = await localSearch(query, page, token);
  if (res.nextPage) searchSessions.set(`${query}:${page}`, res.nextPage);
  searchCache.set(ck, res);
  return res;
}

// -------------------------------------------------------------------------
//  Master video-page resolver
// -------------------------------------------------------------------------
function parsePlayerResponseLite(pr) {
  if (!pr) return {};
  const vd = pr.videoDetails || {};
  const mf = pr.microformat?.playerMicroformatRenderer || {};
  const sd = pr.streamingData || {};
  let duration = parseInt(vd.lengthSeconds || mf.lengthSeconds || '0', 10) || null;
  if (!duration && sd.formats?.[0]?.approxDurationMs)
    duration = Math.round(parseInt(sd.formats[0].approxDurationMs, 10) / 1000);
  const captions = (pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || []).map(t => ({
    languageCode: t.languageCode || null,
    label: getText(t.name) || t.languageCode,
    url: t.baseUrl || null,
  }));
  return {
    title:       vd.title || getText(mf.title) || null,
    description: vd.shortDescription || getText(mf.description) || null,
    duration,
    viewCount:   parseInt(vd.viewCount || '0', 10) || null,
    author:      vd.author || null,
    channelId:   vd.channelId || mf.externalChannelId || null,
    isLive:      !!(vd.isLiveContent && vd.isLive),
    isLiveContent: !!vd.isLiveContent,
    keywords:    Array.isArray(vd.keywords) ? vd.keywords : [],
    publishDate: mf.publishDate || null,
    uploadDate:  mf.uploadDate  || null,
    category:    mf.category    || null,
    captions,
  };
}

async function getVideoMeta(req, videoId) {
  const cached = videoMetaCache.get(videoId);
  if (cached) return cached;

  // Try the local Innertube path first (fast, no network hop)
  let local = null;
  try {
    const html = await fetchWatchPage(videoId);
    const visitorData = extractVisitorData(html);
    const apiKey = extractApiKey(html);
    const ver = extractClientVersion(html);
    const initialData = extractJsonBlock(html, 'ytInitialData');
    const pr = extractJsonBlock(html, 'ytInitialPlayerResponse');
    const [pdata, nextData] = await Promise.allSettled([
      resolvePlayerData(videoId, visitorData),
      callNext(videoId, visitorData, apiKey, ver),
    ]);
    const bestPR = pdata.status === 'fulfilled' ? (pdata.value.bestPR || pr) : pr;
    local = {
      ...parsePlayerResponseLite(bestPR),
      initialData,
      nextData: nextData.status === 'fulfilled' ? nextData.value : null,
    };
  } catch (e) { /* ignore -- mirror will fill in */ }

  // Mirror-backed payload  (richer, includes recommended, comments-count, etc.)
  let mirror = null;
  try { mirror = await invFetch(req, `/api/v1/videos/${videoId}`, { timeout: 8000 }); }
  catch (e) { /* fine -- local data may suffice */ }

  const meta = {
    videoId,
    title:       local?.title       || mirror?.title       || videoId,
    description: local?.description || mirror?.description || '',
    descriptionHtml: mirror?.descriptionHtml || null,
    lengthSeconds: local?.duration  || mirror?.lengthSeconds || null,
    duration:    formatDuration(local?.duration || mirror?.lengthSeconds),
    viewCount:   local?.viewCount   || mirror?.viewCount   || null,
    likeCount:   mirror?.likeCount  || null,
    dislikeCount: mirror?.dislikeCount || null,
    publishDate: local?.publishDate || mirror?.publishedText || null,
    published:   mirror?.published || null,
    publishedText: mirror?.publishedText || null,
    author:      local?.author     || mirror?.author      || null,
    authorId:    local?.channelId  || mirror?.authorId    || null,
    authorUrl:   mirror?.authorUrl || (local?.channelId ? `/channel/${local.channelId}` : null),
    authorVerified: !!mirror?.authorVerified,
    authorThumbnails: mirror?.authorThumbnails || [],
    subCountText: mirror?.subCountText || null,
    keywords:    (local?.keywords?.length ? local.keywords : (mirror?.keywords || [])),
    category:    local?.category   || mirror?.genre       || null,
    isFamilyFriendly: mirror?.isFamilyFriendly,
    isListed:    mirror?.isListed,
    liveNow:     !!(local?.isLive || mirror?.liveNow),
    isUpcoming:  !!mirror?.isUpcoming,
    premiereTimestamp: mirror?.premiereTimestamp || null,
    captions:    (local?.captions?.length ? local.captions
                  : (mirror?.captions || []).map(c => ({ languageCode: c.languageCode || c.language_code, label: c.label, url: c.url }))),
    recommendedVideos: mirror?.recommendedVideos || [],
    videoThumbnails:   mirror?.videoThumbnails || buildVideoThumbs(videoId),
    hashtags:    mirror?.hashtags || [],
    storyboards: mirror?.storyboards || [],
    musicTracks: mirror?.musicTracks || [],
    chapters:    mirror?.chapters || [],
    rating:      mirror?.rating || null,
    allowedRegions: mirror?.allowedRegions || [],
  };

  videoMetaCache.set(videoId, meta);
  return meta;
}


// =========================================================================
//                          HTML / CSS  TEMPLATES
// =========================================================================

const SEARCH_ICON_SVG = `
<svg class="icon-search" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="11" cy="11" r="7"></circle>
  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>`;

const ICON_THEME = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
</svg>`;

const ICON_PREFS = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"></circle>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
</svg>`;

const ICON_CHEVRON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

const BASE_CSS = `
:root{
  --bg:#1a1a1a;
  --bg-alt:#202020;
  --bg-card:#262626;
  --text:#ececec;
  --text-muted:#9a9a9a;
  --text-faint:#6f6f6f;
  --border:#333333;
  --border-soft:#2b2b2b;
  --accent:#dadada;
  --link:#cfcfcf;
  --search-border:#7b7b7b;
  --hover:#2a2a2a;
  --pill:#2c2c2c;
  --pill-active:#3a3a3a;
  --backend-up:#3fbf6f;
  --backend-down:#8a3434;
}
[data-theme="light"]{
  --bg:#fafafa; --bg-alt:#ffffff; --bg-card:#ffffff;
  --text:#202020; --text-muted:#555; --text-faint:#888;
  --border:#dcdcdc; --border-soft:#ececec; --accent:#202020;
  --link:#1a1a1a; --search-border:#aaaaaa; --hover:#eaeaea;
  --pill:#eeeeee; --pill-active:#dcdcdc;
  --backend-up:#19a05a; --backend-down:#b94545;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{
  background:var(--bg); color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased; line-height:1.4;
  min-height:100vh; display:flex; flex-direction:column;
}
a{color:inherit;text-decoration:none}
a:hover{text-decoration:underline}
img{display:block;max-width:100%}
button{font-family:inherit}

/* ---------------- Header / Topbar ---------------- */
.topbar{
  display:flex; align-items:center; padding:14px 22px;
  border-bottom:1px solid var(--border); gap:22px;
  background:var(--bg);
}
.topbar .brand{font-weight:700; letter-spacing:1px; font-size:17px; color:var(--text)}
.topbar .nav-links{display:flex; gap:18px; font-size:14px; color:var(--text-muted)}
.topbar .nav-links a:hover{color:var(--text); text-decoration:none}
.topbar form.search-form{flex:1; max-width:560px; margin:0 auto; position:relative}
.topbar .right{display:flex; gap:14px; align-items:center; color:var(--text-muted)}
.topbar .right .icon-btn{
  background:none;border:none;color:var(--text-muted);
  cursor:pointer; padding:4px; display:inline-flex; align-items:center;
}
.topbar .right .icon-btn:hover{color:var(--text)}

/* ---------------- Backend switcher bar ---------------- */
.backend-bar{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  padding:8px 22px; font-size:13px;
  border-bottom:1px solid var(--border-soft); background:var(--bg-alt);
  color:var(--text-muted);
}
.backend-bar .label{font-weight:700; color:var(--text)}
.backend-bar a{
  color:var(--text-muted); position:relative; padding:2px 4px;
}
.backend-bar a.active{color:var(--text); text-decoration:underline; text-underline-offset:3px}
.backend-bar a:hover{color:var(--text)}
.backend-bar .dot{
  display:inline-block; width:3px; height:14px;
  background:var(--backend-up); vertical-align:middle; margin-left:2px;
  border-radius:1px;
}
.backend-bar .dot.down{background:var(--backend-down)}
.backend-bar .sep{color:var(--text-faint)}

/* ---------------- Search form ---------------- */
.search-form{display:flex; align-items:center; position:relative}
.search-input{
  width:100%;
  background:transparent; border:none; border-bottom:1px solid var(--search-border);
  color:var(--text); font-size:16px;
  padding:8px 36px 8px 8px; outline:none;
  transition:border-color .2s;
}
.search-input:focus{border-bottom-color:var(--text)}
.search-btn{
  position:absolute; right:6px; top:50%; transform:translateY(-50%);
  background:none; border:none; color:var(--text-muted);
  cursor:pointer; padding:4px; display:inline-flex;
}
.search-btn:hover{color:var(--text)}

/* ---------------- Generic page chrome ---------------- */
main.page{flex:1; width:100%; max-width:1400px; margin:0 auto; padding:18px 22px}
.page-title{font-size:20px; font-weight:600; margin-bottom:16px}
.section-title{font-size:14px; font-weight:700; margin:14px 0 10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px}

.footer{
  padding:34px 22px; border-top:1px solid var(--border-soft);
  display:grid; grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:32px; font-size:13px; color:var(--text-muted); line-height:1.9;
}
.footer a:hover{color:var(--text)}

/* ---------------- Cards / grid ---------------- */
.grid{
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));
  gap:20px;
}
.card{display:flex; flex-direction:column}
.card .thumb{
  position:relative; display:block; aspect-ratio:16/9;
  background:#000; overflow:hidden; border-radius:4px;
}
.card .thumb img{width:100%; height:100%; object-fit:cover; transition:transform .35s, opacity .25s}
.card .thumb:hover img{opacity:.92; transform:scale(1.015)}
.card .thumb .duration{
  position:absolute; bottom:6px; right:6px;
  background:rgba(0,0,0,.82); color:#fff; font-size:12px;
  padding:2px 6px; border-radius:3px; font-variant-numeric:tabular-nums;
}
.card .thumb .live-tag{
  position:absolute; top:6px; left:6px;
  background:#cc1f1f; color:#fff; font-size:11px; font-weight:700;
  padding:2px 6px; border-radius:3px; letter-spacing:.5px;
}
.card .info{padding-top:10px}
.card .title{font-size:14px; font-weight:500; line-height:1.4;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
  margin-bottom:6px;
}
.card .channel{font-size:13px; color:var(--text-muted)}
.card .channel .verified{font-size:11px; opacity:.85}
.card .meta{font-size:12px; color:var(--text-faint); margin-top:3px}

/* ---------------- Pagination ---------------- */
.pager{display:flex; justify-content:center; gap:14px; padding:32px 0}
.pager a, .pager span{
  border:1px solid var(--border); padding:6px 16px; color:var(--text-muted);
  border-radius:3px; font-size:13px;
}
.pager a:hover{color:var(--text); border-color:var(--accent); text-decoration:none}
.pager .disabled{opacity:.4; pointer-events:none}

/* ---------------- Filter bar ---------------- */
.filter-bar{
  display:flex; gap:10px; padding:14px 0; flex-wrap:wrap;
  border-bottom:1px solid var(--border-soft); margin-bottom:16px;
}
.pill{
  padding:5px 12px; border-radius:20px; background:var(--pill); font-size:13px;
  color:var(--text-muted); cursor:pointer; border:none;
}
.pill.active{background:var(--pill-active); color:var(--text)}
.pill:hover{color:var(--text)}

/* ---------------- Notice / Error pages ---------------- */
.notice{
  max-width:680px; margin:80px auto; text-align:center;
  background:var(--bg-card); border:1px solid var(--border); padding:38px;
  border-radius:6px;
}
.notice h1{font-size:22px; margin-bottom:14px}
.notice p{color:var(--text-muted); line-height:1.7; margin-bottom:18px}
.notice .back-link{
  display:inline-block; border:1px solid var(--border);
  padding:8px 22px; border-radius:3px; font-size:13px;
}

@media (max-width:768px){
  .topbar{flex-wrap:wrap; gap:12px}
  .topbar form.search-form{order:3; flex-basis:100%}
  .footer{grid-template-columns:1fr}
  main.page{padding:14px}
}
`;

const PLAYER_CSS = `
/* video-js theme overrides for the Invidious build */
.video-js{ width:100%; height:auto; background:#000; }
.vjs-poster{ background-size:cover; }
.vjs-theme-invidious .vjs-big-play-button{
  border:none; background:rgba(20,20,20,.7); border-radius:50%;
  width:80px; height:80px; line-height:80px; font-size:34px;
}
.vjs-control-bar{background:linear-gradient(0deg, rgba(0,0,0,.85), rgba(0,0,0,0));}
.vjs-quality-popup{z-index:99}

#vp-shell{position:relative; background:#000; border-radius:6px; overflow:hidden}
#vp-shell .vp-loading{
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  color:#ddd; font-size:14px; pointer-events:none; background:rgba(0,0,0,.4);
  transition:opacity .25s; z-index:2;
}
#vp-shell .vp-loading.hidden{opacity:0; visibility:hidden}

.watch-grid{display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:22px; margin-top:8px}
@media(max-width:1100px){.watch-grid{grid-template-columns:1fr}}

.video-meta-box{margin-top:14px}
.video-meta-box .vt{font-size:18px; font-weight:600; line-height:1.35}
.video-meta-box .meta-row{
  display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center;
  margin-top:10px; gap:10px; font-size:13px; color:var(--text-muted);
}
.video-meta-box .author-row{
  display:flex; align-items:center; gap:14px; padding:14px 0;
  border-top:1px solid var(--border-soft); border-bottom:1px solid var(--border-soft);
  margin-top:14px;
}
.author-row .avatar{width:48px;height:48px;border-radius:50%;background:#333;overflow:hidden;flex:0 0 48px}
.author-row .ainfo{flex:1}
.author-row .aname{font-weight:600; font-size:14px}
.author-row .subs{font-size:12px; color:var(--text-muted)}
.action-row{display:flex; gap:10px; flex-wrap:wrap; margin-top:14px}
.action-row .btn{
  background:var(--pill); color:var(--text); border:none;
  padding:8px 16px; font-size:13px; border-radius:20px; cursor:pointer;
}
.action-row .btn:hover{background:var(--pill-active)}

.description-box{
  background:var(--bg-card); padding:14px 16px; margin-top:14px;
  border-radius:6px; font-size:14px; line-height:1.55; white-space:pre-wrap;
  max-height:160px; overflow:hidden; position:relative;
}
.description-box.open{max-height:none}
.description-box .toggle{
  display:inline-block; margin-top:6px; color:var(--text-muted);
  cursor:pointer; font-size:12px; user-select:none;
}

/* Related sidebar */
.related-side{display:flex; flex-direction:column; gap:10px}
.related-side .card{flex-direction:row; gap:10px}
.related-side .card .thumb{width:160px; flex:0 0 160px}
.related-side .card .info{padding:0}
.related-side .card .title{font-size:13px; -webkit-line-clamp:2}
.related-side .card .channel{font-size:12px}

/* Comments */
.comments-box{margin-top:24px}
.comments-box h3{font-size:16px; margin-bottom:14px; color:var(--text)}
.comments-list .comment{
  display:flex; gap:12px; padding:12px 0;
  border-bottom:1px solid var(--border-soft);
}
.comment .cm-avatar{width:36px; height:36px; border-radius:50%; background:#333; flex:0 0 36px; overflow:hidden}
.comment .cm-author{font-size:13px; font-weight:600}
.comment .cm-author .cm-when{font-weight:400; color:var(--text-muted); margin-left:8px}
.comment .cm-text{font-size:13px; line-height:1.55; margin-top:4px; white-space:pre-wrap}
.comment .cm-likes{font-size:12px; color:var(--text-muted); margin-top:6px}
.comments-box .cm-loading{color:var(--text-muted); font-size:13px; padding:12px 0}
.comments-box .cm-more{
  display:block; margin:18px auto; padding:10px 22px;
  background:var(--pill); color:var(--text); border:none; border-radius:20px;
  cursor:pointer; font-size:13px;
}
.comments-box .cm-more:hover{background:var(--pill-active)}

/* Quality switcher pill (custom overlay shown in the player chrome) */
.vp-quality-pill{
  position:absolute; bottom:50px; right:16px; z-index:30;
  background:rgba(20,20,20,.85); border:1px solid #333; border-radius:3px;
  font-size:12px; color:#ddd; display:none;
}
.vp-quality-pill .qopt{padding:6px 14px; cursor:pointer; min-width:120px}
.vp-quality-pill .qopt:hover{background:#333}
.vp-quality-pill .qopt.selected{color:#fff; font-weight:700}

/* Channel banner */
.channel-banner{width:100%; aspect-ratio:1024/144; background:#222; border-radius:6px; overflow:hidden; margin-bottom:16px}
.channel-banner img{width:100%; height:100%; object-fit:cover}
.channel-head{display:flex; gap:18px; align-items:center; margin-bottom:18px}
.channel-head .avatar{width:96px;height:96px;border-radius:50%;background:#333;overflow:hidden;flex:0 0 96px}
.channel-head .name{font-size:22px; font-weight:700}
.channel-head .handle{color:var(--text-muted); font-size:13px}
.channel-head .stats{color:var(--text-muted); font-size:13px; margin-top:6px}
.channel-tabs{display:flex; gap:8px; border-bottom:1px solid var(--border); margin-bottom:18px; overflow-x:auto}
.channel-tabs a{
  padding:10px 14px; color:var(--text-muted); font-size:13px;
  border-bottom:2px solid transparent;
}
.channel-tabs a.active{color:var(--text); border-bottom-color:var(--text)}
`;

function renderHead(title, extraHead = '') {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <meta name="generator" content="Invidious ${VERSION} (${BUILD_BRANCH})">
  <title>${escHTML(title)}</title>
  <link rel="icon" href="/favicon.ico">
  <style>${BASE_CSS}</style>
  ${extraHead}
</head>`;
}

function renderBackendBar(active) {
  const parts = BACKENDS.map(b => {
    const health = backendHealth.get(b.id) || 'ok';
    const cls = ['' , b.id === active.id ? 'active' : ''].filter(Boolean).join(' ');
    return `<a href="?B=${b.id}" class="${cls}">${b.id} (${b.region})</a><span class="dot${health === 'down' ? ' down' : ''}" title="${health}"></span>`;
  });
  return `<div class="backend-bar">
    <span class="label">Switch backend:</span>
    ${parts.join(' <span class="sep">|</span> ')}
  </div>`;
}

function renderTopbar(active, query = '') {
  return `<header class="topbar">
    <a href="/" class="brand">INVIDIOUS</a>
    <nav class="nav-links">
      <a href="/feed/trending">急上昇</a>
    </nav>
    <form class="search-form" action="/search" method="GET" role="search">
      <input type="text" name="q" class="search-input" placeholder="検索" value="${escAttr(query)}" autocomplete="off">
      <button type="submit" class="search-btn" aria-label="検索">${SEARCH_ICON_SVG}</button>
    </form>
    <div class="right">
      <button class="icon-btn" id="theme-toggle" aria-label="テーマ切替" title="テーマ切替">${ICON_THEME}</button>
      <a class="icon-btn" href="/preferences" aria-label="設定" title="設定">${ICON_PREFS}</a>
      <a href="/login" style="font-size:13px">ログイン</a>
    </div>
  </header>
  ${renderBackendBar(active)}`;
}

function renderFooter() {
  return `<footer class="footer">
    <div>
      <p><a href="https://github.com/iv-org/invidious">⭮ 元のソースコード / 改変し使用中</a></p>
      <p><a href="https://docs.invidious.io/">🕮 説明書</a></p>
    </div>
    <div>
      <p>GitHub 上で AGPLv3 の元で公開</p>
      <p><a href="/licenses">JS JavaScriptライセンス情報</a></p>
      <p><a href="/privacy">🕮 個人情報保護方針</a></p>
    </div>
    <div>
      <p><a href="/api/v1/stats">🗀 Services</a></p>
      <p><a href="/feed/trending">≡ Forum</a></p>
      <p><a href="https://liberapay.com/tiekoetter">☕ 寄付する @ Tiekoetter.com</a></p>
      <p><a href="https://invidious.io/donate/">☕ 寄付する @ Invidious.io</a></p>
      <p>現在のバージョン: ${VERSION} @ ${BUILD_BRANCH}</p>
    </div>
  </footer>`;
}

function renderThemeScript() {
  return `<script>
  (function(){
    var saved = localStorage.getItem('inv-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', function(){
      var cur = document.documentElement.getAttribute('data-theme') || 'dark';
      var next = cur === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('inv-theme', next);
    });
  })();
  </script>`;
}


// -------------------------------------------------------------------------
//  Card renderer  (shared between search/channel/trending/playlist)
// -------------------------------------------------------------------------
function renderVideoCard(v) {
  // Accepts both Invidious VideoObject and youtube-search-api item shapes.
  const id    = v.videoId || v.id;
  if (!id) return '';
  const title = v.title || 'No Title';
  let thumb   = '';
  if (Array.isArray(v.videoThumbnails) && v.videoThumbnails.length) {
    thumb = v.videoThumbnails.find(t => t.quality === 'medium')?.url
         || v.videoThumbnails[0]?.url
         || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  } else if (v.thumbnail?.thumbnails?.length) {
    thumb = v.thumbnail.thumbnails[v.thumbnail.thumbnails.length-1]?.url
         || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  } else {
    thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  const lengthSec = v.lengthSeconds || (v.length?.simpleText ? parseDurationText(v.length.simpleText) : null);
  const duration = v.length?.simpleText || formatDuration(lengthSec) || '';
  const channelName = v.author || v.channelTitle || '';
  const authorId    = v.authorId || (v.channelId || (v.channel && v.channel.id) || null);
  const verified    = v.authorVerified;
  let viewCountText = v.viewCountText;
  if (!viewCountText && v.viewCount != null) viewCountText = `${formatViews(v.viewCount)} views`;
  if (!viewCountText && v.viewCount?.short)  viewCountText = v.viewCount.short;
  if (!viewCountText && v.viewCount?.text)   viewCountText = v.viewCount.text;
  const published = v.publishedText || v.publishedTimeText || '';
  const isLive    = !!v.liveNow || !!v.isLive;

  return `<article class="card">
    <a class="thumb" href="/watch?v=${escAttr(id)}">
      <img src="${escAttr(thumb)}" alt="${escAttr(title)}" loading="lazy">
      ${isLive ? `<span class="live-tag">LIVE</span>` : ''}
      ${duration ? `<span class="duration">${escHTML(duration)}</span>` : ''}
    </a>
    <div class="info">
      <h3 class="title"><a href="/watch?v=${escAttr(id)}">${escHTML(title)}</a></h3>
      <div class="channel">
        ${authorId ? `<a href="/channel/${escAttr(authorId)}">${escHTML(channelName)}</a>` : escHTML(channelName)}
        ${verified ? ' <span class="verified" title="認証済み">✔</span>' : ''}
      </div>
      <div class="meta">
        ${published ? `<span>${escHTML(published)}</span>` : ''}
        ${published && viewCountText ? ' · ' : ''}
        ${viewCountText ? `<span>${escHTML(viewCountText)}</span>` : ''}
      </div>
    </div>
  </article>`;
}

function renderChannelCard(c) {
  const id   = c.authorId || c.channelId;
  const name = c.author || c.title || '';
  const thumb = c.authorThumbnails?.[c.authorThumbnails.length-1]?.url || '';
  return `<article class="card">
    <a class="thumb" href="/channel/${escAttr(id)}" style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#222">
      ${thumb ? `<img src="${escAttr(thumb)}" alt="${escAttr(name)}" loading="lazy" style="border-radius:50%;width:60%;height:auto">` : ''}
    </a>
    <div class="info">
      <h3 class="title">${escHTML(name)}${c.authorVerified ? ' <span class="verified">✔</span>' : ''}</h3>
      <div class="meta">${c.subCount ? `${formatViews(c.subCount)} 登録者` : ''}${c.videoCount ? ` · ${c.videoCount} 動画` : ''}</div>
    </div>
  </article>`;
}

function renderPlaylistCard(p) {
  const id = p.playlistId;
  const title = p.title || '';
  const thumb = p.playlistThumbnail || (p.videos?.[0]?.videoThumbnails?.[0]?.url) || '';
  return `<article class="card">
    <a class="thumb" href="/playlist?list=${escAttr(id)}">
      ${thumb ? `<img src="${escAttr(thumb)}" alt="${escAttr(title)}" loading="lazy">` : ''}
      ${p.videoCount ? `<span class="duration">▶ ${p.videoCount}</span>` : ''}
    </a>
    <div class="info">
      <h3 class="title">${escHTML(title)}</h3>
      <div class="channel">${escHTML(p.author || '')}</div>
    </div>
  </article>`;
}

// -------------------------------------------------------------------------
//  Page : Home  (matches the screenshot the user provided)
// -------------------------------------------------------------------------
function renderHomePage(active) {
  return `${renderHead('Invidious')}
<body>
  ${renderTopbar(active)}
  <main class="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh">
    <h1 style="font-size:64px; letter-spacing:2px; color:var(--text-muted); margin:30px 0;">INVIDIOUS</h1>
    <form class="search-form" action="/search" method="GET" style="width:min(560px,90%)">
      <input class="search-input" type="text" name="q" placeholder="検索" autofocus autocomplete="off">
      <button class="search-btn" type="submit" aria-label="検索">${SEARCH_ICON_SVG}</button>
    </form>
    <nav style="margin-top:18px; display:flex; gap:30px; font-size:14px; color:var(--text-muted)">
      <a href="/feed/trending">急上昇</a>
    </nav>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

// -------------------------------------------------------------------------
//  Page : Search results
// -------------------------------------------------------------------------
function renderSearchPage(query, items, page, active) {
  const cards = items.map(it => {
    if (it.type === 'channel') return renderChannelCard(it);
    if (it.type === 'playlist') return renderPlaylistCard(it);
    return renderVideoCard(it);
  }).join('');

  return `${renderHead(`${query} - Invidious`)}
<body>
  ${renderTopbar(active, query)}
  <main class="page">
    <div class="filter-bar">
      <button class="pill active" data-filter="all">すべて</button>
      <button class="pill" data-filter="video">動画</button>
      <button class="pill" data-filter="channel">チャンネル</button>
      <button class="pill" data-filter="playlist">プレイリスト</button>
    </div>
    <div class="grid">
      ${cards || '<p style="color:var(--text-muted)">結果が見つかりませんでした。</p>'}
    </div>
    <nav class="pager">
      ${page > 1 ? `<a href="/search?q=${encodeURIComponent(query)}&page=${page-1}">← 前のページ</a>` : `<span class="disabled">← 前のページ</span>`}
      <span>ページ ${page}</span>
      <a href="/search?q=${encodeURIComponent(query)}&page=${page+1}">次のページ →</a>
    </nav>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
  <script>
    document.querySelectorAll('.pill[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pill[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.filter;
        document.querySelectorAll('.card').forEach(c => {
          if (f === 'all') { c.style.display = ''; return; }
          // crude filter based on card thumbnail link
          const href = c.querySelector('.thumb')?.getAttribute('href') || '';
          let kind = 'video';
          if (href.startsWith('/channel/')) kind = 'channel';
          else if (href.startsWith('/playlist')) kind = 'playlist';
          c.style.display = (kind === f) ? '' : 'none';
        });
      });
    });
  </script>
</body>
</html>`;
}

// -------------------------------------------------------------------------
//  Page : Trending
// -------------------------------------------------------------------------
function renderTrendingPage(items, active, currentType = '') {
  const cards = items.map(renderVideoCard).join('');
  const types = [
    { id: '',       label: 'すべて' },
    { id: 'music',  label: '音楽' },
    { id: 'gaming', label: 'ゲーム' },
    { id: 'movies', label: '映画' },
  ];
  return `${renderHead('急上昇 - Invidious')}
<body>
  ${renderTopbar(active)}
  <main class="page">
    <h1 class="page-title">急上昇</h1>
    <div class="filter-bar">
      ${types.map(t => `<a class="pill${t.id === currentType ? ' active' : ''}" href="/feed/trending${t.id ? `?type=${t.id}` : ''}">${t.label}</a>`).join('')}
    </div>
    <div class="grid">${cards}</div>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

// -------------------------------------------------------------------------
//  Page : Watch / Video
// -------------------------------------------------------------------------
function renderWatchPage(meta, active) {
  const id = meta.videoId;
  const desc = meta.description || '';
  const captions = (meta.captions || []).map(c =>
    `<track kind="captions" srclang="${escAttr(c.languageCode || '')}" label="${escAttr(c.label || '')}" src="/api/v1/captions/${id}?label=${encodeURIComponent(c.label || '')}">`
  ).join('');

  const recommendedCards = (meta.recommendedVideos || []).slice(0, 20).map(renderVideoCard).join('') || '';

  // The player loads 360p (audio-included) as the primary source — the user
  // can opt in to 720p/1080p, in which case we transparently start a parallel
  // audio track sourced from the 360p stream and keep both elements in sync.
  return `${renderHead(`${meta.title} - Invidious`, `
    <link rel="stylesheet" href="/videojs/video.js/video-js.css?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="/videojs/videojs-http-source-selector/videojs-http-source-selector.css?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="/videojs/videojs-markers/videojs.markers.css?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="/videojs/videojs-share/videojs-share.css?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="/videojs/videojs-mobile-ui/videojs-mobile-ui.css?v=${ASSET_VERSION}">
    <link rel="stylesheet" href="/css/player.css?v=${ASSET_VERSION}">
    <style>${PLAYER_CSS}</style>
    <script src="/videojs/video.js/video.js?v=${ASSET_VERSION}" defer></script>
    <script src="/videojs/videojs-mobile-ui/videojs-mobile-ui.js?v=${ASSET_VERSION}" defer></script>
    <script src="/videojs/videojs-contrib-quality-levels/videojs-contrib-quality-levels.js?v=${ASSET_VERSION}" defer></script>
    <script src="/videojs/videojs-http-source-selector/videojs-http-source-selector.js?v=${ASSET_VERSION}" defer></script>
    <script src="/videojs/videojs-markers/videojs-markers.js?v=${ASSET_VERSION}" defer></script>
    <script src="/videojs/videojs-share/videojs-share.js?v=${ASSET_VERSION}" defer></script>
    <script src="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.js?v=${ASSET_VERSION}" defer></script>
  `)}
<body>
  ${renderTopbar(active)}
  <main class="page">
    <div class="watch-grid">
      <div>
        <div id="vp-shell">
          <video id="player" class="video-js vjs-theme-invidious" controls preload="metadata"
                 poster="https://i.ytimg.com/vi/${id}/hqdefault.jpg"
                 playsinline crossorigin="anonymous"
                 data-video-id="${escAttr(id)}">
            <source src="/stream/${id}?q=360" type="video/mp4">
            ${captions}
          </video>
          <!-- Hidden audio companion used when switching to the video-only HD tracks -->
          <audio id="player-audio" preload="auto"
                 src="/stream/${id}?q=360"
                 crossorigin="anonymous"></audio>
          <div class="vp-loading" id="vp-loading">読み込み中…</div>
          <div class="vp-quality-pill" id="vp-quality">
            <div class="qopt selected" data-q="360">360p (音声付き)</div>
            <div class="qopt" data-q="720">720p</div>
            <div class="qopt" data-q="1080">1080p</div>
          </div>
        </div>

        <div class="video-meta-box">
          <h1 class="vt">${escHTML(meta.title)}</h1>
          <div class="meta-row">
            <div>
              ${meta.viewCount != null ? `<span>${formatViews(meta.viewCount)} 回視聴</span>` : ''}
              ${meta.publishedText ? ` · <span>${escHTML(meta.publishedText)}</span>` : (meta.publishDate ? ` · <span>${escHTML(meta.publishDate)}</span>` : '')}
            </div>
            <div>
              ${meta.likeCount != null ? `<span>👍 ${formatViews(meta.likeCount)}</span>` : ''}
            </div>
          </div>

          <div class="author-row">
            <a class="avatar" href="/channel/${escAttr(meta.authorId || '')}">
              ${meta.authorThumbnails?.[0]?.url ? `<img src="${escAttr(meta.authorThumbnails[meta.authorThumbnails.length-1].url)}" alt="${escAttr(meta.author || '')}">` : ''}
            </a>
            <div class="ainfo">
              <div class="aname">
                <a href="/channel/${escAttr(meta.authorId || '')}">${escHTML(meta.author || '')}</a>
                ${meta.authorVerified ? '<span class="verified">✔</span>' : ''}
              </div>
              <div class="subs">${escHTML(meta.subCountText || '')}</div>
            </div>
            <div class="action-row" style="margin-top:0">
              <button class="btn" id="btn-listen">音声のみ</button>
              <button class="btn" id="btn-quality">画質: 360p</button>
              <button class="btn" id="btn-share">共有</button>
              <a class="btn" href="/api/v1/videos/${id}">JSON</a>
            </div>
          </div>

          <div class="description-box" id="desc">
            ${escHTML(desc)}
            <span class="toggle" id="desc-toggle">続きを表示 ▾</span>
          </div>

          <div class="comments-box" id="comments-box">
            <h3>コメント</h3>
            <div class="cm-loading" id="cm-loading">読み込み中…</div>
            <div class="comments-list" id="comments-list"></div>
            <button class="cm-more" id="cm-more" style="display:none">さらに読み込む</button>
          </div>
        </div>
      </div>

      <aside class="related-side">
        <h3 class="section-title">関連動画</h3>
        ${recommendedCards}
      </aside>
    </div>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}

  <script>
  // ---------------- video player bootstrap ----------------
  (function(){
    var videoId = ${JSON.stringify(id)};
    var qualityState = '360';
    var loadingEl = document.getElementById('vp-loading');
    var qualityPill = document.getElementById('vp-quality');
    var audioEl = document.getElementById('player-audio');

    function whenVjsReady(cb){
      if (window.videojs) return cb();
      var i = setInterval(function(){ if (window.videojs){ clearInterval(i); cb(); } }, 60);
    }

    whenVjsReady(function(){
      var player = videojs('player', {
        fluid: true,
        playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
        userActions: { hotkeys: true },
        html5: { vhs: { overrideNative: true } }
      });

      player.ready(function(){
        loadingEl.classList.add('hidden');
        if (player.mobileUi) player.mobileUi();
      });

      player.on('waiting', function(){ loadingEl.classList.remove('hidden'); });
      player.on('playing', function(){ loadingEl.classList.add('hidden'); });
      player.on('error', function(){
        // fall back to the alternate origin
        if (qualityState === '360') {
          player.src({ src: '/stream/' + videoId + '?q=360&fb=1', type: 'video/mp4' });
          player.load();
        }
      });

      // -------- HD mode: video-only stream + parallel audio track --------
      function syncAudio() {
        try {
          if (!audioEl) return;
          var drift = Math.abs(audioEl.currentTime - player.currentTime());
          if (drift > 0.25) audioEl.currentTime = player.currentTime();
        } catch(e){}
      }
      player.on('play',   function(){ if (qualityState !== '360'){ audioEl.play().catch(function(){}); syncAudio(); }});
      player.on('pause',  function(){ if (qualityState !== '360'){ audioEl.pause(); }});
      player.on('seeked', function(){ if (qualityState !== '360'){ syncAudio(); }});
      player.on('volumechange', function(){
        if (qualityState !== '360') {
          audioEl.volume = player.volume();
          audioEl.muted  = player.muted();
        }
      });
      player.on('ratechange', function(){
        if (qualityState !== '360' && audioEl) audioEl.playbackRate = player.playbackRate();
      });
      setInterval(function(){ if (qualityState !== '360') syncAudio(); }, 1000);

      // -------- Quality switcher (button + popup) --------
      var btnQ = document.getElementById('btn-quality');
      btnQ.addEventListener('click', function(){
        qualityPill.style.display = (qualityPill.style.display === 'block') ? 'none' : 'block';
      });
      qualityPill.querySelectorAll('.qopt').forEach(function(opt){
        opt.addEventListener('click', function(){
          var q = opt.dataset.q;
          if (q === qualityState) { qualityPill.style.display = 'none'; return; }
          qualityState = q;
          qualityPill.querySelectorAll('.qopt').forEach(function(x){ x.classList.toggle('selected', x === opt); });
          btnQ.textContent = '画質: ' + q + 'p';
          qualityPill.style.display = 'none';

          var t = player.currentTime();
          var paused = player.paused();
          player.src({ src: '/stream/' + videoId + '?q=' + q, type: 'video/mp4' });
          player.load();
          player.one('loadedmetadata', function(){
            player.currentTime(t);
            if (!paused) player.play();
          });

          if (q === '360') {
            audioEl.pause(); audioEl.currentTime = 0; player.muted(false);
          } else {
            // HD streams have no audio: mute the video element, pipe audio from the 360p ghost track.
            player.muted(true);
            audioEl.volume = player.volume();
            audioEl.currentTime = t;
            if (!paused) audioEl.play().catch(function(){});
          }
        });
      });

      // -------- Audio-only / Listen mode --------
      var btnListen = document.getElementById('btn-listen');
      var listenMode = false;
      btnListen.addEventListener('click', function(){
        listenMode = !listenMode;
        document.getElementById('vp-shell').style.aspectRatio = listenMode ? '8/1' : '';
        if (listenMode) { player.poster('https://i.ytimg.com/vi/' + videoId + '/maxresdefault.jpg'); }
      });

      // -------- Share --------
      document.getElementById('btn-share').addEventListener('click', function(){
        var url = location.origin + '/watch?v=' + videoId;
        if (navigator.share) navigator.share({ url: url, title: document.title }).catch(function(){});
        else { navigator.clipboard.writeText(url); alert('リンクをコピーしました'); }
      });
    });

    // ---------------- description expander ----------------
    var desc = document.getElementById('desc');
    var dt   = document.getElementById('desc-toggle');
    if (dt) dt.addEventListener('click', function(){
      desc.classList.toggle('open');
      dt.textContent = desc.classList.contains('open') ? '折りたたむ ▴' : '続きを表示 ▾';
    });

    // ---------------- Deferred comments loader ----------------
    var cmList = document.getElementById('comments-list');
    var cmLoad = document.getElementById('cm-loading');
    var cmMore = document.getElementById('cm-more');
    var cmCont = null;

    function appendComments(payload){
      cmLoad.style.display = 'none';
      var comments = (payload && payload.comments) || [];
      comments.forEach(function(c){
        var el = document.createElement('div'); el.className = 'comment';
        var avatar = (c.authorThumbnails && c.authorThumbnails[c.authorThumbnails.length-1]?.url) || '';
        el.innerHTML =
          '<a class="cm-avatar" href="/channel/' + (c.authorId || '') + '">' +
            (avatar ? '<img src="' + avatar + '" alt="" loading="lazy">' : '') +
          '</a>' +
          '<div style="flex:1">' +
            '<div class="cm-author">' +
              '<a href="/channel/' + (c.authorId || '') + '">' + escapeHtml(c.author || '') + '</a>' +
              '<span class="cm-when">' + escapeHtml(c.publishedText || '') + '</span>' +
            '</div>' +
            '<div class="cm-text">' + escapeHtml(c.content || '') + '</div>' +
            '<div class="cm-likes">👍 ' + (c.likeCount || 0) + (c.replies ? ' · 返信 ' + (c.replies.replyCount || 0) : '') + '</div>' +
          '</div>';
        cmList.appendChild(el);
      });
      cmCont = (payload && payload.continuation) || null;
      cmMore.style.display = cmCont ? 'block' : 'none';
    }
    function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

    function loadComments(continuation){
      cmLoad.style.display = 'block';
      var url = '/api/v1/comments/' + videoId + (continuation ? '?continuation=' + encodeURIComponent(continuation) : '');
      fetch(url).then(function(r){ return r.json(); }).then(appendComments).catch(function(){
        cmLoad.textContent = 'コメントを取得できませんでした。';
      });
    }
    cmMore.addEventListener('click', function(){ if (cmCont) loadComments(cmCont); });
    // Load comments lazily after the page becomes interactive.
    if ('requestIdleCallback' in window) requestIdleCallback(function(){ loadComments(); }, { timeout: 1500 });
    else setTimeout(loadComments, 800);
  })();
  </script>
</body>
</html>`;
}


// -------------------------------------------------------------------------
//  Page : Channel  (videos / shorts / streams / playlists / community / about)
// -------------------------------------------------------------------------
const CHANNEL_TABS = [
  { id: 'videos',    label: '動画'        },
  { id: 'shorts',    label: 'Shorts'      },
  { id: 'streams',   label: 'ライブ'      },
  { id: 'playlists', label: 'プレイリスト' },
  { id: 'podcasts',  label: 'ポッドキャスト' },
  { id: 'releases',  label: 'リリース'    },
  { id: 'channels',  label: '関連チャンネル' },
  { id: 'community', label: 'コミュニティ' },
  { id: 'about',     label: '概要'        },
];

function renderChannelPage(channelId, info, tab, items, active, continuation) {
  const banner = info?.authorBanners?.[0]?.url || info?.banner?.[0]?.url || '';
  const avatar = info?.authorThumbnails?.[info?.authorThumbnails?.length-1]?.url || '';
  const name   = info?.author || channelId;
  const handle = info?.authorHandle || '';
  const subText = info?.subCount ? `${formatViews(info.subCount)} 登録者` : (info?.subCountText || '');
  const cardsHtml = (items || []).map(it => {
    if (it.type === 'playlist') return renderPlaylistCard(it);
    if (it.type === 'channel')  return renderChannelCard(it);
    return renderVideoCard(it);
  }).join('') || '<p style="color:var(--text-muted)">表示できる項目がありません。</p>';

  return `${renderHead(`${name} - Invidious`)}
<body>
  ${renderTopbar(active)}
  <main class="page">
    ${banner ? `<div class="channel-banner"><img src="${escAttr(banner)}" alt=""></div>` : ''}
    <div class="channel-head">
      <div class="avatar">${avatar ? `<img src="${escAttr(avatar)}" alt="${escAttr(name)}">` : ''}</div>
      <div>
        <div class="name">${escHTML(name)} ${info?.authorVerified ? '<span class="verified">✔</span>' : ''}</div>
        <div class="handle">${escHTML(handle)}</div>
        <div class="stats">${escHTML(subText)}${info?.totalViews ? ` · ${formatViews(info.totalViews)} 総視聴` : ''}</div>
      </div>
    </div>
    <nav class="channel-tabs">
      ${CHANNEL_TABS.map(t => `<a href="/channel/${escAttr(channelId)}/${t.id}" class="${tab === t.id ? 'active' : ''}">${t.label}</a>`).join('')}
    </nav>
    ${tab === 'about'
      ? `<div class="description-box open">${escHTML(info?.description || '')}</div>`
      : `<div class="grid">${cardsHtml}</div>
         ${continuation ? `<div class="pager"><a href="/channel/${escAttr(channelId)}/${tab}?continuation=${encodeURIComponent(continuation)}">続きを読み込む →</a></div>` : ''}`
    }
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

// -------------------------------------------------------------------------
//  Page : Playlist
// -------------------------------------------------------------------------
function renderPlaylistPage(data, active, page) {
  const videos = (data.videos || []).map(v => renderVideoCard({
    videoId: v.videoId, title: v.title, lengthSeconds: v.lengthSeconds,
    author: v.author, authorId: v.authorId,
    videoThumbnails: v.videoThumbnails, viewCountText: v.viewCountText,
  })).join('');
  return `${renderHead(`${data.title || 'プレイリスト'} - Invidious`)}
<body>
  ${renderTopbar(active)}
  <main class="page">
    <h1 class="page-title">${escHTML(data.title || '')}</h1>
    <p style="color:var(--text-muted);font-size:14px;margin-bottom:18px">
      ${escHTML(data.author || '')} · ${data.videoCount || 0} 動画
    </p>
    <div class="grid">${videos}</div>
    <nav class="pager">
      ${page > 1 ? `<a href="/playlist?list=${encodeURIComponent(data.playlistId)}&page=${page-1}">← 前のページ</a>` : `<span class="disabled">← 前のページ</span>`}
      <span>ページ ${page}</span>
      <a href="/playlist?list=${encodeURIComponent(data.playlistId)}&page=${page+1}">次のページ →</a>
    </nav>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

// -------------------------------------------------------------------------
//  Page : Hashtag
// -------------------------------------------------------------------------
function renderHashtagPage(tag, items, active, page) {
  const cards = items.map(renderVideoCard).join('');
  return `${renderHead(`#${tag} - Invidious`)}
<body>
  ${renderTopbar(active)}
  <main class="page">
    <h1 class="page-title">#${escHTML(tag)}</h1>
    <div class="grid">${cards}</div>
    <nav class="pager">
      ${page > 1 ? `<a href="/hashtag/${encodeURIComponent(tag)}?page=${page-1}">← 前のページ</a>` : `<span class="disabled">← 前のページ</span>`}
      <span>ページ ${page}</span>
      <a href="/hashtag/${encodeURIComponent(tag)}?page=${page+1}">次のページ →</a>
    </nav>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

// -------------------------------------------------------------------------
//  Page : Preferences, Login, Privacy, Licenses, Error, Deleted
// -------------------------------------------------------------------------
function renderPreferencesPage(active) {
  return `${renderHead('設定 - Invidious')}
<body>
  ${renderTopbar(active)}
  <main class="page" style="max-width:780px">
    <h1 class="page-title">設定</h1>

    <form id="prefs-form" style="display:flex;flex-direction:column;gap:18px">
      <fieldset style="border:1px solid var(--border);padding:14px;border-radius:6px">
        <legend style="padding:0 8px;font-weight:600">プレイヤー設定</legend>
        <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span>自動再生</span>
          <input type="checkbox" name="autoplay">
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span>関連動画を表示</span>
          <input type="checkbox" name="related_videos" checked>
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span>コメントを表示</span>
          <input type="checkbox" name="comments" checked>
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span>既定の画質</span>
          <select name="quality" style="background:var(--bg-card);color:var(--text);border:1px solid var(--border);padding:5px 8px">
            <option value="360">360p (音声付き)</option>
            <option value="720">720p</option>
            <option value="1080">1080p</option>
          </select>
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span>再生速度</span>
          <input type="number" step="0.25" min="0.25" max="2" name="speed" value="1" style="background:var(--bg-card);color:var(--text);border:1px solid var(--border);padding:5px 8px;width:80px">
        </label>
      </fieldset>

      <fieldset style="border:1px solid var(--border);padding:14px;border-radius:6px">
        <legend style="padding:0 8px;font-weight:600">サイト設定</legend>
        <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span>ダークモード</span>
          <select name="dark_mode" style="background:var(--bg-card);color:var(--text);border:1px solid var(--border);padding:5px 8px">
            <option value="auto">自動</option>
            <option value="true">ダーク</option>
            <option value="false">ライト</option>
          </select>
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span>地域</span>
          <select name="region" style="background:var(--bg-card);color:var(--text);border:1px solid var(--border);padding:5px 8px">
            <option value="JP">日本</option>
            <option value="US">アメリカ</option>
            <option value="DE">ドイツ</option>
            <option value="CL">チリ</option>
            <option value="GB">イギリス</option>
          </select>
        </label>
        <label style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
          <span>優先バックエンド</span>
          <select name="backend" style="background:var(--bg-card);color:var(--text);border:1px solid var(--border);padding:5px 8px">
            ${BACKENDS.map(b => `<option value="${b.id}">${b.id} (${b.region})</option>`).join('')}
          </select>
        </label>
      </fieldset>

      <button type="submit" class="btn" style="align-self:flex-start;background:var(--pill);color:var(--text);border:none;padding:10px 22px;font-size:14px;border-radius:4px;cursor:pointer">保存</button>
    </form>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
  <script>
    var form = document.getElementById('prefs-form');
    var saved = JSON.parse(localStorage.getItem('inv-prefs') || '{}');
    Object.entries(saved).forEach(function(kv){
      var el = form.elements[kv[0]];
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!kv[1];
      else el.value = kv[1];
    });
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var data = {};
      Array.from(form.elements).forEach(function(el){
        if (!el.name) return;
        data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
      });
      localStorage.setItem('inv-prefs', JSON.stringify(data));
      alert('設定を保存しました');
      if (data.backend) location.href = '/?B=' + data.backend;
    });
  </script>
</body>
</html>`;
}

function renderLoginPage(active) {
  return `${renderHead('ログイン - Invidious')}
<body>
  ${renderTopbar(active)}
  <main class="page" style="max-width:480px">
    <div class="notice">
      <h1>ログイン</h1>
      <p>このミラーは公開バックエンドを介して動作しており、ローカルでのアカウント機能は無効化されています。
        設定は端末に保存されます。</p>
      <a class="back-link" href="/preferences">設定へ</a>
    </div>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

function renderPrivacyPage(active) {
  return `${renderHead('プライバシー - Invidious')}
<body>
  ${renderTopbar(active)}
  <main class="page" style="max-width:780px;line-height:1.8">
    <h1 class="page-title">個人情報保護方針</h1>
    <p style="margin-bottom:14px">本サービスは YouTube への匿名アクセスを提供することを目的としています。</p>
    <h2 style="margin:18px 0 10px">収集する情報</h2>
    <p>サーバーは IP アドレスや User-Agent をリクエスト処理のために一時的にメモリへ保持しますが、永続化はしません。</p>
    <h2 style="margin:18px 0 10px">Cookie</h2>
    <p>ログイン機能は無効化されています。設定は端末の localStorage に保存され、サーバーには送信されません。</p>
    <h2 style="margin:18px 0 10px">第三者</h2>
    <p>動画ストリームは YouTube の CDN から直接配信されます。本サービスは中継サーバーとして機能します。</p>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

function renderLicensesPage(active) {
  return `${renderHead('ライセンス - Invidious')}
<body>
  ${renderTopbar(active)}
  <main class="page" style="max-width:780px;line-height:1.8">
    <h1 class="page-title">JavaScript ライセンス情報</h1>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;padding:8px">スクリプト</th>
          <th style="text-align:left;padding:8px">ライセンス</th>
          <th style="text-align:left;padding:8px">ソース</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:8px">video.js</td><td>Apache-2.0</td><td><a href="https://github.com/videojs/video.js">github</a></td></tr>
        <tr><td style="padding:8px">videojs-http-source-selector</td><td>MIT</td><td><a href="https://github.com/jasonsanjose/videojs-http-source-selector">github</a></td></tr>
        <tr><td style="padding:8px">videojs-markers</td><td>MIT</td><td><a href="https://github.com/spchuang/videojs-markers">github</a></td></tr>
        <tr><td style="padding:8px">videojs-share</td><td>MIT</td><td><a href="https://github.com/mycroftvision/videojs-share">github</a></td></tr>
        <tr><td style="padding:8px">videojs-vtt-thumbnails</td><td>MIT</td><td><a href="https://github.com/chrisboustead/videojs-vtt-thumbnails">github</a></td></tr>
        <tr><td style="padding:8px">videojs-mobile-ui</td><td>MIT</td><td><a href="https://github.com/mister-ben/videojs-mobile-ui">github</a></td></tr>
        <tr><td style="padding:8px">invidious frontend</td><td>AGPL-3.0</td><td><a href="https://github.com/iv-org/invidious">github</a></td></tr>
      </tbody>
    </table>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

function renderDeletedPage(active, title) {
  return `${renderHead(`${title} - Invidious`)}
<body>
  ${renderTopbar(active)}
  <main class="page">
    <div class="notice">
      <h1>${escHTML(title)}</h1>
      <p>This page has been deleted to reduce maintenance costs.</p>
      <a class="back-link" href="/">ホームに戻る</a>
    </div>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}

function renderErrorPage(active, status, message) {
  return `${renderHead(`エラー ${status} - Invidious`)}
<body>
  ${renderTopbar(active)}
  <main class="page">
    <div class="notice">
      <h1>エラー ${status}</h1>
      <p>${escHTML(message || '不明なエラーが発生しました。')}</p>
      <a class="back-link" href="/">ホームに戻る</a>
    </div>
  </main>
  ${renderFooter()}
  ${renderThemeScript()}
</body>
</html>`;
}


// =========================================================================
//                              ROUTING
// =========================================================================

// Tiny cookie reader (used only for the active backend selection).
app.use((req, _res, next) => {
  const hdr = req.headers.cookie || '';
  req.cookies = {};
  hdr.split(';').forEach(c => {
    const [k, ...rest] = c.trim().split('=');
    if (k) req.cookies[k] = decodeURIComponent(rest.join('=') || '');
  });
  next();
});

// CORS for the JSON API surface
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Persist the backend choice via a long-lived cookie (mirrors upstream behaviour).
app.use((req, res, next) => {
  if (req.query.B && BACKENDS.find(b => b.id === req.query.B.toUpperCase())) {
    res.setHeader('Set-Cookie', `B=${req.query.B.toUpperCase()}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  next();
});

// -------------------------------------------------------------------------
//  Static asset stubs
//
//  Upstream Invidious ships the video.js bundle under /videojs/*; we serve
//  the same paths but reuse the public unpkg CDN under the covers so the
//  client devtools surface the canonical URLs in the network panel.
// -------------------------------------------------------------------------
const VENDOR_MAP = {
  '/videojs/video.js/video.js':                                      'https://unpkg.com/video.js@8.10.0/dist/video.min.js',
  '/videojs/video.js/video-js.css':                                  'https://unpkg.com/video.js@8.10.0/dist/video-js.min.css',
  '/videojs/videojs-mobile-ui/videojs-mobile-ui.js':                 'https://unpkg.com/videojs-mobile-ui@1.0.0/dist/videojs-mobile-ui.min.js',
  '/videojs/videojs-mobile-ui/videojs-mobile-ui.css':                'https://unpkg.com/videojs-mobile-ui@1.0.0/dist/videojs-mobile-ui.css',
  '/videojs/videojs-contrib-quality-levels/videojs-contrib-quality-levels.js':
                                                                     'https://unpkg.com/videojs-contrib-quality-levels@4.1.0/dist/videojs-contrib-quality-levels.min.js',
  '/videojs/videojs-http-source-selector/videojs-http-source-selector.js':
                                                                     'https://unpkg.com/videojs-http-source-selector@1.1.6/dist/videojs-http-source-selector.min.js',
  '/videojs/videojs-http-source-selector/videojs-http-source-selector.css':
                                                                     'https://unpkg.com/videojs-http-source-selector@1.1.6/dist/videojs-http-source-selector.min.css',
  '/videojs/videojs-markers/videojs-markers.js':                     'https://unpkg.com/videojs-markers@1.0.1/dist/videojs.markers.min.js',
  '/videojs/videojs-markers/videojs.markers.css':                    'https://unpkg.com/videojs-markers@1.0.1/dist/videojs.markers.min.css',
  '/videojs/videojs-share/videojs-share.js':                         'https://unpkg.com/videojs-share@3.1.5/dist/videojs-share.min.js',
  '/videojs/videojs-share/videojs-share.css':                        'https://unpkg.com/videojs-share@3.1.5/dist/videojs-share.css',
  '/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.js':       'https://unpkg.com/videojs-vtt-thumbnails-freetube@0.0.14/dist/videojs-vtt-thumbnails.min.js',
  '/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css':      'https://unpkg.com/videojs-vtt-thumbnails-freetube@0.0.14/dist/videojs-vtt-thumbnails.css',
};

app.get(/^\/(videojs|css)\//, async (req, res) => {
  const path = req.path;
  const upstream = VENDOR_MAP[path];
  if (!upstream) {
    // Synthesize a no-op stylesheet/script — keeps the network log tidy even when
    // a plugin asset is referenced but not actually needed by the current build.
    if (path.endsWith('.css')) { res.type('text/css').send('/* no-op */'); return; }
    if (path.endsWith('.js'))  { res.type('application/javascript').send('/* no-op */'); return; }
    return res.status(404).send('Not found');
  }
  try {
    const r = await fetch(upstream, { dispatcher: AGENT });
    if (!r.ok) return res.status(502).send('Upstream asset error');
    res.setHeader('Content-Type', r.headers.get('content-type') || (path.endsWith('.css') ? 'text/css' : 'application/javascript'));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) {
    res.status(502).send('Upstream fetch failed');
  }
});

app.get('/favicon.ico', (_req, res) => {
  // 1x1 transparent PNG -- avoids 404 noise in the network log
  res.setHeader('Content-Type', 'image/x-icon');
  res.send(Buffer.from('AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=','base64'));
});

// -------------------------------------------------------------------------
//  Pages
// -------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.type('text/html; charset=utf-8').send(renderHomePage(resolveBackend(req)));
});

app.get('/search', async (req, res) => {
  const q    = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const active = resolveBackend(req);
  if (!q) return res.redirect('/');
  try {
    const { items } = await performSearch(q, page);
    res.type('text/html; charset=utf-8').send(renderSearchPage(q, items, page, active));
  } catch (e) {
    res.status(500).type('text/html; charset=utf-8').send(renderErrorPage(active, 500, e.message));
  }
});

// Deleted feed (per request)
app.get('/feed/popular', (req, res) => {
  res.status(410).type('text/html; charset=utf-8').send(renderDeletedPage(resolveBackend(req), '人気'));
});
// Many older clients hit /popular directly -- also gated.
app.get('/popular', (req, res) => {
  res.status(410).type('text/html; charset=utf-8').send(renderDeletedPage(resolveBackend(req), '人気'));
});

app.get('/feed/trending', async (req, res) => {
  const active = resolveBackend(req);
  const type   = (req.query.type || '').toLowerCase();
  const region = (req.query.region || 'JP').toUpperCase();
  try {
    const ttype = ({ music: 'Music', gaming: 'Gaming', movies: 'Movies' }[type] || '');
    const data = await fetchTrending(req, ttype, region);
    const items = Array.isArray(data) ? data : (data?.videos || []);
    res.type('text/html; charset=utf-8').send(renderTrendingPage(items, active, type));
  } catch (e) {
    res.status(502).type('text/html; charset=utf-8').send(renderErrorPage(active, 502, '急上昇の取得に失敗しました'));
  }
});

// Watch page
app.get('/watch', async (req, res) => {
  const id = req.query.v;
  const active = resolveBackend(req);
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).type('text/html; charset=utf-8').send(renderErrorPage(active, 400, '動画 ID が無効です'));
  }
  try {
    const meta = await getVideoMeta(req, id);
    res.type('text/html; charset=utf-8').send(renderWatchPage(meta, active));
  } catch (e) {
    res.status(502).type('text/html; charset=utf-8').send(renderErrorPage(active, 502, '動画情報の取得に失敗しました'));
  }
});

// Channel page
app.get(['/channel/:id', '/channel/:id/:tab', '/c/:handle', '/@:handle', '/user/:handle'], async (req, res) => {
  const active = resolveBackend(req);
  let channelId = req.params.id;
  const handle  = req.params.handle;
  const tab     = (req.params.tab || 'videos').toLowerCase();
  const continuation = req.query.continuation || null;

  try {
    if (handle && !channelId) {
      // Resolve handle -> UCID via the mirror's resolveurl endpoint.
      try {
        const resolved = await invFetch(req, `/api/v1/resolveurl?url=${encodeURIComponent(`https://www.youtube.com/@${handle}`)}`);
        channelId = resolved?.ucid || resolved?.channelId;
      } catch {}
      if (!channelId) return res.status(404).type('text/html; charset=utf-8').send(renderErrorPage(active, 404, 'チャンネルが見つかりません'));
    }

    const [infoRes, tabRes] = await Promise.allSettled([
      fetchChannel(req, channelId, 'info'),
      tab === 'about' ? Promise.resolve(null) : fetchChannel(req, channelId, tab, continuation),
    ]);
    const info = infoRes.status === 'fulfilled' ? infoRes.value : null;
    const payload = tabRes.status === 'fulfilled' ? tabRes.value : null;
    const items = (payload?.videos || payload?.shorts || payload?.streams || payload?.playlists ||
                   payload?.podcasts || payload?.releases || payload?.channels || payload?.community || payload?.latestVideos || []);
    const nextCont = payload?.continuation || null;
    res.type('text/html; charset=utf-8').send(renderChannelPage(channelId, info, tab, items, active, nextCont));
  } catch (e) {
    res.status(502).type('text/html; charset=utf-8').send(renderErrorPage(active, 502, e.message));
  }
});

// Playlist page
app.get('/playlist', async (req, res) => {
  const active = resolveBackend(req);
  const list = req.query.list;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  if (!list) return res.status(400).type('text/html; charset=utf-8').send(renderErrorPage(active, 400, 'プレイリスト ID が無効です'));
  try {
    const data = await fetchPlaylist(req, list, page);
    res.type('text/html; charset=utf-8').send(renderPlaylistPage(data, active, page));
  } catch (e) {
    res.status(502).type('text/html; charset=utf-8').send(renderErrorPage(active, 502, e.message));
  }
});

// Mix (radio) page -- maps to /watch?v=...&list=RD...
app.get('/mix', async (req, res) => {
  const list = req.query.list;
  const active = resolveBackend(req);
  if (!list) return res.redirect('/');
  try {
    const data = await invFetch(req, `/api/v1/mixes/${encodeURIComponent(list)}`);
    res.type('text/html; charset=utf-8').send(renderPlaylistPage({
      title: data?.title || 'ミックス',
      author: data?.author || '',
      videoCount: (data?.videos || []).length,
      playlistId: list,
      videos: data?.videos || [],
    }, active, 1));
  } catch (e) {
    res.status(502).type('text/html; charset=utf-8').send(renderErrorPage(active, 502, e.message));
  }
});

// Hashtag
app.get('/hashtag/:tag', async (req, res) => {
  const active = resolveBackend(req);
  const tag = req.params.tag;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  try {
    const data = await fetchHashtag(req, tag, page);
    const items = Array.isArray(data) ? data : (data?.results || data?.videos || []);
    res.type('text/html; charset=utf-8').send(renderHashtagPage(tag, items, active, page));
  } catch (e) {
    res.status(502).type('text/html; charset=utf-8').send(renderErrorPage(active, 502, e.message));
  }
});

// Static informational pages
app.get('/preferences', (req, res) => res.type('text/html; charset=utf-8').send(renderPreferencesPage(resolveBackend(req))));
app.get('/login',       (req, res) => res.type('text/html; charset=utf-8').send(renderLoginPage(resolveBackend(req))));
app.get('/privacy',     (req, res) => res.type('text/html; charset=utf-8').send(renderPrivacyPage(resolveBackend(req))));
app.get('/licenses',    (req, res) => res.type('text/html; charset=utf-8').send(renderLicensesPage(resolveBackend(req))));

// -------------------------------------------------------------------------
//  /stream/:id -- video proxy
//
//  Supports `?q=360|720|1080|audio` and an optional `&fb=1` to force the
//  fallback origin. The resolved URL is cached for ~50s; we then perform
//  a transparent HTTP byte-range proxy so that the browser's seek bar
//  works correctly.
// -------------------------------------------------------------------------
function qualityToTag(q) {
  switch (String(q)) {
    case '1080': return 'v1080';
    case '720':  return 'v720';
    case 'audio':return 'audio360';
    case '360':
    default:     return 'audio360';
  }
}

app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).end('bad id');
  let tag = qualityToTag(req.query.q);
  if (req.query.fb === '1') tag = 'fallback';

  let url;
  try { url = await fetchStreamUrl(videoId, tag); }
  catch (e) {
    // last-ditch: ask the mirror for a googlevideo URL
    try {
      const meta = await invFetch(req, `/api/v1/videos/${videoId}`, { timeout: 6000 });
      const formats = (meta.formatStreams || []).concat(meta.adaptiveFormats || []);
      const pick = formats.find(f => /360/.test(f.qualityLabel || ''))
                || formats.find(f => f.itag === 18)
                || formats[0];
      if (pick && pick.url) url = pick.url;
    } catch {}
  }
  if (!url) return res.status(502).end('stream_unavailable');

  // Stream-proxy with range support
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': getUA(),
        ...(req.headers.range ? { 'Range': req.headers.range } : {}),
      },
      redirect: 'follow',
      dispatcher: AGENT,
    });
    res.status(upstream.status);
    upstream.headers.forEach((v, k) => {
      const kl = k.toLowerCase();
      if (['content-type','content-length','accept-ranges','content-range','cache-control','last-modified','etag'].includes(kl)) {
        res.setHeader(k, v);
      }
    });
    if (!upstream.body) { res.end(); return; }
    const reader = upstream.body.getReader();
    res.on('close', () => { try { reader.cancel(); } catch {} });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.write(value)) await new Promise(r => res.once('drain', r));
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(502);
    res.end();
  }
});

// -------------------------------------------------------------------------
//  /api/v1/*  API surface (mirror passthroughs + 1st-party shims)
// -------------------------------------------------------------------------

// Direct passthroughs (cached). These mirror the upstream Invidious API 1:1.
const PASSTHROUGH = [
  '/api/v1/stats',
  '/api/v1/videos/:id',
  '/api/v1/captions/:id',
  '/api/v1/annotations/:id',
  '/api/v1/comments/:id',
  '/api/v1/trending',
  '/api/v1/search/suggestions',
  '/api/v1/playlists/:plid',
  '/api/v1/mixes/:rdid',
  '/api/v1/hashtag/:tag',
  '/api/v1/resolveurl',
  '/api/v1/clips',
  '/api/v1/channels/:id',
  '/api/v1/channels/:id/videos',
  '/api/v1/channels/:id/shorts',
  '/api/v1/channels/:id/streams',
  '/api/v1/channels/:id/playlists',
  '/api/v1/channels/:id/podcasts',
  '/api/v1/channels/:id/releases',
  '/api/v1/channels/:id/channels',
  '/api/v1/channels/:id/latest',
  '/api/v1/channels/:id/community',
  '/api/v1/post/:id',
];

PASSTHROUGH.forEach(routePath => {
  app.get(routePath, async (req, res) => {
    try {
      const upstreamPath = req.originalUrl;
      const data = await invFetch(req, upstreamPath, { timeout: 12000 });
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });
});

// /api/v1/search — backed by the local module so it can paginate without
// hitting the mirror.
app.get('/api/v1/search', async (req, res) => {
  const q = req.query.q || '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  if (!q) return res.json([]);
  try {
    const { items } = await performSearch(q, page);
    const mapped = items.map(it => {
      if (it.type === 'channel') return {
        type: 'channel',
        author: it.title || it.channelTitle || '',
        authorId: it.id || it.channelId,
        authorUrl: `/channel/${it.id || it.channelId}`,
        authorVerified: !!it.verified,
        authorThumbnails: it.thumbnail?.thumbnails || [],
        description: '', descriptionHtml: '',
        subCount: 0, videoCount: 0, autoGenerated: false,
      };
      if (it.type === 'playlist') return {
        type: 'playlist', title: it.title, playlistId: it.id,
        playlistThumbnail: it.thumbnail?.thumbnails?.[0]?.url || '',
        author: it.shortBylineText || '', authorId: '',
        videoCount: it.videoCount || (it.videos?.length || 0), videos: [],
      };
      return {
        type: 'video',
        title: it.title, videoId: it.id,
        author: it.channelTitle || '', authorId: it.channelId || (it.channel && it.channel.id) || '',
        authorUrl: '', authorVerified: !!it.verified,
        videoThumbnails: (it.thumbnail?.thumbnails || []).map(t => ({ quality: 'default', url: t.url, width: t.width, height: t.height })),
        description: '', descriptionHtml: '',
        viewCount: parseCount(it.viewCount?.text) || 0,
        viewCountText: it.viewCount?.text || it.viewCount?.short || '',
        lengthSeconds: it.length?.simpleText ? parseDurationText(it.length.simpleText) : 0,
        published: 0, publishedText: it.publishedTimeText || '',
        liveNow: !!(it.isLive || it.live), premium: false, isUpcoming: false,
      };
    });
    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// /api/v1/popular — explicitly disabled
app.get('/api/v1/popular', (_req, res) => {
  res.status(410).json({ error: 'This page has been deleted to reduce maintenance costs.' });
});

// /yt-sc/:videoId  -- raw scraper output (legacy)
app.get('/yt-sc/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ success: false, error: 'Invalid YouTube video ID' });
  }
  try {
    const meta = await getVideoMeta(req, videoId);
    res.json({ success: true, extractor: 'youtube', extractor_version: VERSION, id: videoId, ...meta });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({
    software: SOFTWARE,
    backends: BACKENDS.map(b => ({ id: b.id, region: b.region, url: b.url, health: backendHealth.get(b.id) || 'unknown' })),
    cache: {
      stream: streamUrlCache.map.size,
      meta:   videoMetaCache.map.size,
      search: searchCache.map.size,
    },
  });
});

// -------------------------------------------------------------------------
//  Catch-all -- friendly 404
// -------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).type('text/html; charset=utf-8').send(renderErrorPage(resolveBackend(req), 404, `${req.path} は見つかりませんでした`));
});

// -------------------------------------------------------------------------
//  Server boot
// -------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[invidious] Listening on :${PORT}`);
  console.log(`[invidious] Build ${VERSION} (${BUILD_BRANCH})`);
  console.log(`[invidious] Backends: ${BACKENDS.map(b => `${b.id}=${b.url}`).join(' ')}`);
});

module.exports = app;
