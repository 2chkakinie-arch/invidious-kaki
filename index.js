'use strict';

/* =====================================================================
 * Invidious-style YouTube front-end (single-file)
 *
 *   - Backend switching (B1..B8) with country flag indicators
 *   - Video page with Video.js player, quality switcher (360p combined /
 *     720p video + 360p audio / 1080p video + 360p audio synchronized)
 *   - Lazy-loaded comments (with "Load more" continuation)
 *   - Channel page (videos / shorts / streams / playlists / community / search)
 *   - Playlist / Mix / Hashtag / Post pages
 *   - Search using youtube-search-api module (with pagination)
 *   - Trending / Popular pages explicitly removed (maintenance notice)
 *   - All single-file, robust fallback, no crashes
 * ===================================================================== */

const express = require('express');
const yts = require('youtube-search-api');
const { fetch, Agent } = require('undici');

const app = express();
const VERSION = '5.0.0';

/* ---------------------------------------------------------------------
 * InnerTube clients (preserved from previous build for /yt-sc scraping)
 * ------------------------------------------------------------------- */
const INNERTUBE_KEYS = [
  'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
  'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
  'AIzaSyA8eiZmM1fanX44Xqp1Gg9mGKL0r2GzUQw',
];

const CLIENTS = {
  WEB_EMBEDDED: { name:'WEB_EMBEDDED_PLAYER', version:'2.20210721.00.00', key:INNERTUBE_KEYS[0], clientName:'56', userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
  TV_EMBEDDED:  { name:'TVHTML5_SIMPLY_EMBEDDED_PLAYER', version:'2.0', key:INNERTUBE_KEYS[0], clientName:'85', userAgent:'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1' },
  WEB:          { name:'WEB', version:'2.20241121.01.00', key:INNERTUBE_KEYS[0], clientName:'1', userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
  IOS:          { name:'iOS', version:'19.45.4', key:INNERTUBE_KEYS[1], clientName:'5', userAgent:'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)', deviceMake:'Apple', deviceModel:'iPhone16,2', osName:'iPhone', osVersion:'18.1.0.22B83' },
  ANDROID:      { name:'ANDROID', version:'19.44.38', key:INNERTUBE_KEYS[2], clientName:'3', userAgent:'com.google.android.youtube/19.44.38(Linux; U; Android 14; en_US; Pixel 9 Pro; Build/AP3A.241005.015) gzip', androidSdkVersion:34 },
};

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
];
let _uaIdx = 0;
const getUA = () => UA_POOL[(_uaIdx++) % UA_POOL.length];

const AGENT = new Agent({ connect:{ timeout:25000 }, keepAliveTimeout:15000, keepAliveMaxTimeout:60000, maxRedirections:5 });

/* ---------------------------------------------------------------------
 * Backend instances (B1..B8) - shown in UI as switch backend bar
 * ------------------------------------------------------------------- */
const BACKENDS = [
  { id:'B1', cc:'CL', name:'Chile',   url:'https://invidious.ritoge.com' },
  { id:'B2', cc:'US', name:'USA-1',   url:'https://invidious.darkness.services' },
  { id:'B3', cc:'US', name:'USA-2',   url:'https://yt.omada.cafe' },
  { id:'B4', cc:'US', name:'USA-3',   url:'https://y.com.sb' },
  { id:'B5', cc:'US', name:'USA-4',   url:'https://invidious.ducks.party' },
  { id:'B6', cc:'US', name:'USA-5',   url:'https://inv.thepixora.com' },
  { id:'B7', cc:'DE', name:'Germany', url:'https://invidious.nerdvpn.de' },
  { id:'B8', cc:'DE', name:'Germany', url:'https://invidious.f5.si' },
];
const DEFAULT_BACKEND = 'B6';

/* ---------------------------------------------------------------------
 * In-memory caches with TTL
 * ------------------------------------------------------------------- */
class TTLCache {
  constructor(maxSize=500) { this.map = new Map(); this.maxSize = maxSize; }
  get(k) {
    const v = this.map.get(k);
    if (!v) return null;
    if (v.exp < Date.now()) { this.map.delete(k); return null; }
    return v.val;
  }
  set(k, val, ttlMs) {
    if (this.map.size >= this.maxSize) {
      const first = this.map.keys().next().value;
      this.map.delete(first);
    }
    this.map.set(k, { val, exp: Date.now()+ttlMs });
  }
}
const streamCache  = new TTLCache(300);
const videoCache   = new TTLCache(300);
const channelCache = new TTLCache(200);
const commentCache = new TTLCache(500);

/* ---------------------------------------------------------------------
 * HTTP helpers
 * ------------------------------------------------------------------- */
async function httpGet(url, headers = {}, timeout = 15000) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': getUA(), 'Accept': '*/*', ...headers },
      dispatcher: AGENT,
      signal: ctrl.signal,
    });
    return res;
  } finally { clearTimeout(tm); }
}

async function httpJSON(url, headers = {}, timeout = 12000) {
  const res = await httpGet(url, { Accept:'application/json', ...headers }, timeout);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();
  // Some instances mis-declare content-type; try JSON parse on body
  try { return JSON.parse(txt); }
  catch { throw new Error('Invalid JSON response'); }
}

/* ---------------------------------------------------------------------
 * Invidious helper: try a list of instances in user-preferred order
 * ------------------------------------------------------------------- */
function orderedBackends(preferId) {
  const idx = BACKENDS.findIndex(b => b.id === preferId);
  if (idx < 0) return BACKENDS.slice();
  return [BACKENDS[idx], ...BACKENDS.slice(0,idx), ...BACKENDS.slice(idx+1)];
}

async function invidiousGet(path, preferId, timeout = 9000) {
  const list = orderedBackends(preferId);
  let lastErr = null;
  for (const b of list) {
    try {
      const data = await httpJSON(b.url + path, {}, timeout);
      return { data, backend: b };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All backends failed');
}

/* ---------------------------------------------------------------------
 * getlate.dev stream resolver  (preserved obfuscation pattern)
 * formatId: 2 = 360p (a+v),  4 = 720p video-only,  5 = 1080p video-only
 * ------------------------------------------------------------------- */
const _OBF_A = [0x79,0x85,0x85,0x81,0x84,0x4b,0x40,0x40,0x78,0x76,0x85,0x7d,0x72,0x85,0x76,0x3f,0x75,0x76,0x87,0x40,0x72,0x81,0x7a,0x40,0x85,0x80,0x80,0x7d,0x84,0x40,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3e,0x7d,0x7a,0x87,0x76,0x3e,0x75,0x80,0x88,0x7f,0x7d,0x80,0x72,0x75,0x76,0x83,0x50,0x86,0x83,0x7d,0x4e,0x79,0x85,0x85,0x81,0x84,0x36,0x44,0x52,0x36,0x43,0x57,0x36,0x43,0x57,0x88,0x88,0x88,0x3f,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3f,0x74,0x80,0x7e,0x36,0x43,0x57,0x88,0x72,0x85,0x74,0x79,0x36,0x44,0x57,0x87,0x36,0x44,0x55];
const _OBF_B = [0x37,0x77,0x80,0x83,0x7e,0x72,0x85,0x5a,0x75,0x4e];
const _OBF_C = [0x37,0x77,0x80,0x83,0x7e,0x72,0x85,0x5a,0x75,0x4e,0x44,0x37,0x76,0x7a,0x75,0x81,0x80,0x7d,0x7a,0x85,0x4e,0x80,0x84,0x76,0x74,0x80,0x7a,0x75];
const _decode = arr => arr.map(c => String.fromCharCode(c - 0x11)).join('');
const _ENDPOINT_PRIMARY  = _decode(_OBF_A);                  // https://<provider>/api/tools/youtube-live-downloader?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D
const _ENDPOINT_PRIMARY_SUFFIX_FMT = id => `&formatId=${id}`; // appended at runtime
const _ENDPOINT_FALLBACK = _ENDPOINT_PRIMARY.replace('youtube-live-downloader','youtube-video-downloader');

async function resolveStream(videoId, formatId = 2) {
  const cacheKey = videoId + ':' + formatId;
  const c = streamCache.get(cacheKey);
  if (c) return c;
  const targets = [
    `${_ENDPOINT_PRIMARY}${videoId}${_ENDPOINT_PRIMARY_SUFFIX_FMT(formatId)}`,
    `${_ENDPOINT_FALLBACK}${videoId}${_ENDPOINT_PRIMARY_SUFFIX_FMT(formatId)}`,
  ];
  for (const t of targets) {
    try {
      const r = await fetch(t, {
        method:'GET',
        headers:{ 'User-Agent': getUA() },
        redirect:'follow',
        dispatcher: AGENT,
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok && r.url && r.url !== t) {
        streamCache.set(cacheKey, r.url, 60_000);
        return r.url;
      }
      // Some endpoints return JSON body containing { url }
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const j = await r.json();
        if (j && (j.url || j.directUrl)) {
          const u = j.url || j.directUrl;
          streamCache.set(cacheKey, u, 60_000);
          return u;
        }
      }
    } catch (_) {}
  }
  return null;
}

/* ---------------------------------------------------------------------
 * Util: HTML escape & formatting
 * ------------------------------------------------------------------- */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const fmtViews = n => {
  n = Number(n) || 0;
  if (n >= 1e9) return (n/1e9).toFixed(1).replace(/\.0$/,'') + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K';
  return String(n);
};
const fmtDur = s => {
  s = Math.max(0, Math.floor(Number(s)||0));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), x = s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`
          : `${m}:${String(x).padStart(2,'0')}`;
};
const timeAgo = ts => {
  if (!ts) return '';
  const sec = Math.floor(Date.now()/1000 - Number(ts));
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec/60)}分前`;
  if (sec < 86400) return `${Math.floor(sec/3600)}時間前`;
  if (sec < 2592000) return `${Math.floor(sec/86400)}日前`;
  if (sec < 31536000) return `${Math.floor(sec/2592000)}か月前`;
  return `${Math.floor(sec/31536000)}年前`;
};

/* Pick highest-resolution thumbnail */
const pickThumb = (thumbs, prefer = 'medium') => {
  if (!Array.isArray(thumbs) || !thumbs.length) return '';
  const byQuality = thumbs.find(t => t.quality === prefer);
  if (byQuality) return byQuality.url;
  return thumbs.sort((a,b)=>(b.width||0)-(a.width||0))[0].url;
};

const proxyImg = url => {
  if (!url) return '';
  if (url.startsWith('//')) url = 'https:' + url;
  return `/img-proxy?u=${encodeURIComponent(url)}`;
};

/* Parse Invidious recommended/video object array uniformly */
const normalizeVideoList = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(v => ({
    videoId:        v.videoId || v.id || '',
    title:          v.title || '',
    author:         v.author || v.authorName || '',
    authorId:       v.authorId || v.uploaderId || '',
    authorVerified: !!v.authorVerified,
    authorThumb:    pickThumb(v.authorThumbnails, 'default'),
    thumb:          pickThumb(v.videoThumbnails, 'medium'),
    lengthSeconds:  v.lengthSeconds || 0,
    viewCount:      v.viewCount || 0,
    viewCountText:  v.viewCountText || (v.viewCount ? fmtViews(v.viewCount) + ' 回視聴' : ''),
    publishedText:  v.publishedText || '',
    description:    v.description || '',
    liveNow:        !!v.liveNow,
    isUpcoming:     !!v.isUpcoming,
  })).filter(v => v.videoId);
};


/* ---------------------------------------------------------------------
 * Cookie helpers for backend preference
 * ------------------------------------------------------------------- */
function parseCookies(req) {
  const h = req.headers.cookie || '';
  const out = {};
  h.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1).trim());
  });
  return out;
}
function getBackend(req) {
  const q = req.query.backend;
  if (q && BACKENDS.find(b => b.id === q)) return q;
  const c = parseCookies(req).backend;
  if (c && BACKENDS.find(b => b.id === c)) return c;
  return DEFAULT_BACKEND;
}

/* ---------------------------------------------------------------------
 * Global CSS — Invidious-look monochrome theme
 * ------------------------------------------------------------------- */
const GLOBAL_CSS = `
:root{
  --bg:#1a1a1a; --fg:#ececec; --muted:#9b9b9b; --border:#2d2d2d;
  --link:#cfcfcf; --hl:#ffffff; --accent:#e0e0e0; --hover:#262626;
  --card:#1f1f1f;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
a{color:inherit;text-decoration:none}
a:hover{text-decoration:underline}
img{display:block;max-width:100%}

/* top bar */
.topbar{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1px solid var(--border)}
.topbar .left{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.topbar .right{display:flex;align-items:center;gap:14px;color:var(--muted);font-size:14px}
.topbar .right a{color:var(--muted)}
.brand{font-weight:800;letter-spacing:2px;font-size:18px;color:var(--hl)}
.nav-links{display:flex;gap:18px;color:var(--muted);font-size:14px}
.nav-links a:hover{color:var(--fg);text-decoration:none}
.backend-switch{display:flex;flex-wrap:wrap;align-items:center;gap:4px;font-size:13px;color:var(--muted);padding:6px 14px}
.backend-switch b{color:var(--fg);margin-right:6px}
.backend-switch a{color:#7aa2ff;margin-right:2px}
.backend-switch a.active{color:#fff;font-weight:700;text-decoration:underline}
.flag{display:inline-block;width:4px;height:14px;vertical-align:-2px;margin-left:3px;background:#0a0}
.flag.cc-CL{background:linear-gradient(to right,#d52b1e 50%,#fff 50%)}
.flag.cc-US{background:linear-gradient(to bottom,#b22234 33%,#fff 33%,#fff 66%,#3c3b6e 66%)}
.flag.cc-DE{background:linear-gradient(to bottom,#000 33%,#dd0000 33%,#dd0000 66%,#ffce00 66%)}

/* search bar */
.search-wrap{display:flex;align-items:center;justify-content:center;padding:60px 16px 30px}
.search-form{display:flex;align-items:center;width:min(560px,100%);position:relative}
.search-input{flex:1;background:transparent;border:none;border-bottom:1px solid #555;color:var(--fg);font-size:18px;padding:10px 36px 10px 6px;outline:none;transition:border-color .2s}
.search-input:focus{border-bottom-color:var(--fg)}
.search-btn{position:absolute;right:4px;top:50%;transform:translateY(-50%);background:transparent;border:none;cursor:pointer;color:var(--muted);padding:6px}
.search-btn:hover{color:var(--fg)}
.search-btn svg{display:block;width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

/* home hero */
.hero{text-align:center;margin-top:20px}
.hero h1{font-size:54px;color:#7a7a7a;font-weight:800;letter-spacing:5px}
.subnav{display:flex;justify-content:center;gap:34px;margin-top:18px;color:var(--muted);font-size:15px}
.subnav a:hover{color:var(--fg);text-decoration:none}

/* grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px;padding:18px 18px 60px}
.card{background:var(--card);border:1px solid var(--border);border-radius:6px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s, box-shadow .15s}
.card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.4)}
.thumb{position:relative;width:100%;aspect-ratio:16/9;background:#000;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover}
.badge{position:absolute;right:6px;bottom:6px;background:rgba(0,0,0,.78);color:#fff;font-size:12px;padding:2px 6px;border-radius:3px}
.badge.live{background:#cc0000;left:6px;right:auto}
.info{padding:10px 12px;display:flex;flex-direction:column;gap:6px;flex:1}
.info .title{font-size:14.5px;font-weight:600;line-height:1.35;color:var(--fg);
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.info .author{font-size:13px;color:var(--muted)}
.info .meta{font-size:12px;color:var(--muted)}

/* pagination */
.pager{display:flex;justify-content:center;gap:14px;padding:18px 0 40px}
.pager a, .pager span{padding:8px 16px;border:1px solid var(--border);border-radius:4px;color:var(--fg);background:var(--card)}
.pager a:hover{background:var(--hover);text-decoration:none}
.pager span{opacity:.5}

/* watch page */
.watch-wrap{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;padding:18px;max-width:1500px;margin:0 auto}
@media(max-width:1100px){.watch-wrap{grid-template-columns:1fr}}
.player-card{background:#000;border-radius:6px;overflow:hidden}
.video-js{width:100%;aspect-ratio:16/9}
.meta-card{padding:14px 0 0}
.meta-card h1{font-size:21px;font-weight:700;margin-bottom:10px;line-height:1.3}
.meta-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.author-line{display:flex;align-items:center;gap:10px}
.author-line img{width:42px;height:42px;border-radius:50%}
.author-line .name{font-weight:600}
.author-line .subs{font-size:12px;color:var(--muted)}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{background:#252525;border:1px solid var(--border);color:var(--fg);padding:8px 14px;border-radius:18px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.btn:hover{background:#303030}
.desc-box{margin-top:14px;background:var(--card);border:1px solid var(--border);border-radius:6px;padding:12px 14px;font-size:14px;line-height:1.55;color:#d4d4d4;white-space:pre-wrap;max-height:160px;overflow:hidden;position:relative}
.desc-box.expanded{max-height:none}
.desc-box .expand{position:absolute;bottom:6px;right:10px;color:#7aa2ff;cursor:pointer;background:linear-gradient(transparent, var(--card) 60%);padding:8px 4px 0 16px}

/* quality switcher */
.quality-bar{display:flex;gap:8px;padding:10px 0 4px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--muted)}
.quality-bar .label{margin-right:4px}
.q-btn{background:#252525;border:1px solid var(--border);color:var(--fg);padding:5px 10px;border-radius:14px;font-size:12px;cursor:pointer}
.q-btn.active{background:var(--fg);color:#000}

/* sidebar recommended */
.recs{display:flex;flex-direction:column;gap:10px}
.rec{display:flex;gap:8px;background:var(--card);border:1px solid var(--border);border-radius:6px;overflow:hidden}
.rec:hover{background:var(--hover);text-decoration:none}
.rec .rt{flex:0 0 168px;aspect-ratio:16/9;position:relative;background:#000}
.rec .rt img{width:100%;height:100%;object-fit:cover}
.rec .ri{padding:6px 8px;flex:1;min-width:0}
.rec .ri .rtitle{font-size:13.5px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rec .ri .rmeta{font-size:11.5px;color:var(--muted);margin-top:4px}

/* comments */
.comments{margin:24px auto;max-width:980px;padding:0 18px 60px}
.comments h2{font-size:16px;margin-bottom:14px;color:var(--muted)}
.comment{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)}
.comment img.av{width:38px;height:38px;border-radius:50%;flex:0 0 38px;background:#333}
.comment .cb{flex:1;min-width:0}
.comment .ch{font-size:13px;color:var(--muted);margin-bottom:4px}
.comment .ch b{color:var(--fg);font-weight:600;margin-right:6px}
.comment .ct{font-size:14px;line-height:1.55;color:#e8e8e8;white-space:pre-wrap;word-break:break-word}
.comment .cm{margin-top:6px;font-size:12px;color:var(--muted);display:flex;gap:14px}
.replies{margin-top:8px;border-left:2px solid var(--border);padding-left:14px}
#comments-load{text-align:center;padding:20px;color:var(--muted)}
#comments-more{background:#252525;border:1px solid var(--border);color:var(--fg);padding:8px 18px;border-radius:18px;cursor:pointer;font-size:13px}
#comments-more:hover{background:#303030}

/* channel page */
.ch-banner{width:100%;height:200px;background:#222 center/cover no-repeat}
.ch-header{display:flex;gap:18px;align-items:center;padding:18px;border-bottom:1px solid var(--border)}
.ch-header img.cha{width:96px;height:96px;border-radius:50%;background:#333}
.ch-header h1{font-size:24px;margin-bottom:6px}
.ch-header .csubs{color:var(--muted);font-size:14px}
.ch-tabs{display:flex;gap:6px;padding:14px 18px;border-bottom:1px solid var(--border);flex-wrap:wrap}
.ch-tab{padding:8px 14px;color:var(--muted);font-size:14px;border-radius:18px;background:transparent;border:1px solid var(--border)}
.ch-tab.active,.ch-tab:hover{background:var(--hover);color:var(--fg);text-decoration:none}

/* error & deleted page */
.notice{padding:80px 24px;text-align:center;color:var(--muted)}
.notice h2{color:var(--fg);font-size:22px;margin-bottom:14px}
.notice a{color:#7aa2ff}

/* skeleton loader */
.skel{display:inline-block;background:linear-gradient(90deg,#222 0%,#2a2a2a 50%,#222 100%);background-size:200% 100%;animation:sh 1.2s infinite;border-radius:4px}
@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}

footer{padding:14px 18px;color:var(--muted);font-size:12px;border-top:1px solid var(--border);text-align:center}
`;

/* ---------------------------------------------------------------------
 * SVG search icon (monochrome, clean)
 * ------------------------------------------------------------------- */
const ICON_SEARCH = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;

/* ---------------------------------------------------------------------
 * Common layout
 * ------------------------------------------------------------------- */
function renderBackendSwitch(currentId, queryString = '') {
  const sep = queryString ? (queryString.includes('?') ? '&' : '?') : '?';
  const html = BACKENDS.map(b => {
    const sep2 = queryString.includes('?') ? '&' : '?';
    const q = queryString ? `${queryString}${queryString.includes('?')?'&':'?'}backend=${b.id}` : `?backend=${b.id}`;
    const cls = b.id === currentId ? 'active' : '';
    return `<a class="${cls}" href="${q}" title="${esc(b.name)} (${b.url})">${b.id} (${b.cc})<i class="flag cc-${b.cc}"></i></a>`;
  }).join(' | ');
  return `<div class="backend-switch"><b>Switch backend:</b> ${html}</div>`;
}

function layout({ title='INVIDIOUS', body='', extraHead='', backend=DEFAULT_BACKEND, currentPath='/', includePlayer=false }) {
  // Invidious-style asset references (cosmetic; harmless if not served)
  const playerAssets = includePlayer ? `
<link rel="stylesheet" href="/videojs/video.js/video-js.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-http-source-selector/videojs-http-source-selector.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-markers/videojs.markers.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-share/videojs-share.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-mobile-ui/videojs-mobile-ui.css?v=07c38a4">
<link rel="stylesheet" href="/css/player.css?v=07c38a4">
<script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
<script src="https://unpkg.com/videojs-contrib-quality-levels@4.1.0/dist/videojs-contrib-quality-levels.min.js"></script>
` : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} - Invidious</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231a1a1a'/%3E%3Ctext x='50%25' y='58%25' text-anchor='middle' font-family='sans-serif' font-weight='bold' font-size='28' fill='%23ececec'%3EI%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="/css/default.css?v=07c38a4">
<link rel="stylesheet" href="/css/style.css?v=07c38a4">
${playerAssets}
<style>${GLOBAL_CSS}</style>
${extraHead}
</head>
<body>
${renderBackendSwitch(backend, '')}
<header class="topbar">
  <div class="left">
    <a class="brand" href="/">INVIDIOUS</a>
    <nav class="nav-links">
      <a href="/feed/subscriptions">登録チャンネル</a>
      <a href="/feed/playlists">プレイリスト</a>
      <a href="/feed/history">履歴</a>
    </nav>
  </div>
  <div class="right">
    <a href="#" title="テーマ切替" id="theme-toggle">☾</a>
    <a href="/preferences" title="設定">⚙</a>
    <a href="/login">ログイン</a>
  </div>
</header>
${body}
<footer>Released under the AGPLv3 by Invidious. Source available <a href="#">here</a>. View JavaScript license information.</footer>
<script>
document.getElementById('theme-toggle')?.addEventListener('click',e=>{e.preventDefault();document.documentElement.style.filter=document.documentElement.style.filter?'':'invert(1) hue-rotate(180deg)'});
</script>
</body>
</html>`;
}

/* ---------------------------------------------------------------------
 * Pages
 * ------------------------------------------------------------------- */
function renderHome(backend) {
  const body = `
<div class="search-wrap">
  <form class="search-form" action="/search" method="get" role="search">
    <input class="search-input" name="q" autocomplete="off" placeholder="検索" autofocus>
    <button class="search-btn" type="submit" aria-label="search">${ICON_SEARCH}</button>
  </form>
</div>
<div class="hero">
  <h1>INVIDIOUS</h1>
  <nav class="subnav">
    <a href="/popular">人気</a>
    <a href="/feed/trending">急上昇</a>
  </nav>
</div>`;
  return layout({ title:'Invidious', body, backend });
}

function renderSearchResults({ q, page, items, backend, sort='relevance', type='video' }) {
  const cards = items.length ? items.map(v => `
    <a class="card" href="/watch?v=${encodeURIComponent(v.videoId)}">
      <div class="thumb">
        <img loading="lazy" src="${esc(v.thumb)}" alt="">
        ${v.liveNow ? '<span class="badge live">LIVE</span>' : (v.lengthSeconds ? `<span class="badge">${fmtDur(v.lengthSeconds)}</span>`:'')}
      </div>
      <div class="info">
        <div class="title">${esc(v.title)}</div>
        <div class="author"><a href="/channel/${esc(v.authorId)}">${esc(v.author)}</a></div>
        <div class="meta">${esc(v.viewCountText || '')} ${v.publishedText?'・'+esc(v.publishedText):''}</div>
      </div>
    </a>`).join('') : `<div class="notice"><h2>検索結果が見つかりませんでした</h2></div>`;

  const queryEnc = encodeURIComponent(q);
  const pager = `
  <div class="pager">
    ${page > 1 ? `<a href="/search?q=${queryEnc}&page=${page-1}">‹ 前のページ</a>` : '<span>‹ 前のページ</span>'}
    <span>ページ ${page}</span>
    <a href="/search?q=${queryEnc}&page=${page+1}">次のページ ›</a>
  </div>`;

  const body = `
<div class="search-wrap" style="padding:20px 16px 14px">
  <form class="search-form" action="/search" method="get" role="search">
    <input class="search-input" name="q" value="${esc(q)}" autocomplete="off">
    <button class="search-btn" type="submit" aria-label="search">${ICON_SEARCH}</button>
  </form>
</div>
<div class="grid">${cards}</div>
${pager}`;
  return layout({ title:`${q} - Invidious`, body, backend });
}

/* ----- watch page (player + meta + lazy comments) ----- */
function renderWatch({ video, related, backend }) {
  const v = video;
  const thumb = proxyImg(pickThumb(v.videoThumbnails,'maxres') || pickThumb(v.videoThumbnails,'high'));
  const recCards = (related || []).slice(0,25).map(r => `
    <a class="rec" href="/watch?v=${encodeURIComponent(r.videoId)}">
      <div class="rt">
        <img loading="lazy" src="${esc(proxyImg(r.thumb))}" alt="">
        ${r.lengthSeconds ? `<span class="badge">${fmtDur(r.lengthSeconds)}</span>`:''}
      </div>
      <div class="ri">
        <div class="rtitle">${esc(r.title)}</div>
        <div class="rmeta">${esc(r.author)}</div>
        <div class="rmeta">${esc(r.viewCountText || (r.viewCount?fmtViews(r.viewCount)+' 回視聴':''))} ${r.publishedText?'・'+esc(r.publishedText):''}</div>
      </div>
    </a>`).join('');

  const desc = v.descriptionHtml ?
    v.descriptionHtml.replace(/href="\/(redirect|watch|channel)/g,'href="/$1') :
    esc(v.description || '');

  const body = `
<div class="watch-wrap">
  <div>
    <div class="player-card">
      <video id="player" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="metadata" poster="${esc(thumb)}" playsinline crossorigin="anonymous">
      </video>
    </div>
    <div class="quality-bar">
      <span class="label">画質:</span>
      <button class="q-btn active" data-q="360">360p (音声込み)</button>
      <button class="q-btn" data-q="720">720p (音声同期)</button>
      <button class="q-btn" data-q="1080">1080p (音声同期)</button>
      <span style="margin-left:auto;color:var(--muted);font-size:12px">バックエンド: ${backend}</span>
    </div>
    <div class="meta-card">
      <h1>${esc(v.title)}</h1>
      <div class="meta-row">
        <a class="author-line" href="/channel/${esc(v.authorId)}">
          <img src="${esc(proxyImg(pickThumb(v.authorThumbnails,'default')))}" alt="">
          <div>
            <div class="name">${esc(v.author)}${v.authorVerified?' ✓':''}</div>
            <div class="subs">${esc(v.subCountText || '')}</div>
          </div>
        </a>
        <div class="actions">
          <button class="btn" title="高評価">👍 ${fmtViews(v.likeCount||0)}</button>
          <button class="btn" title="低評価">👎</button>
          <button class="btn" title="共有">↗ 共有</button>
          <button class="btn" title="保存">＋ 保存</button>
        </div>
      </div>
      <div class="meta-row" style="font-size:13px;color:var(--muted)">
        <div>${fmtViews(v.viewCount||0)} 回視聴 ・ ${esc(v.publishedText||'')} ${v.liveNow?'<span style="color:#cc0000">●LIVE</span>':''}</div>
        <div>長さ: ${fmtDur(v.lengthSeconds||0)}</div>
      </div>
      <div class="desc-box" id="descBox">${desc}<span class="expand" onclick="document.getElementById('descBox').classList.toggle('expanded');this.style.display='none'">…もっと見る</span></div>
    </div>
  </div>
  <aside>
    <div class="recs">${recCards}</div>
  </aside>
</div>

<section class="comments" id="commentsSection">
  <h2>コメント</h2>
  <div id="comments-load">読み込み中…</div>
</section>

<script>
(function(){
  var vid = ${JSON.stringify(v.videoId)};
  var audioEl = new Audio();
  audioEl.crossOrigin = 'anonymous';
  audioEl.preload = 'auto';
  var hasAudioTrack = false;
  var currentQ = '360';

  var player = videojs('player',{
    fluid:true, responsive:true, playbackRates:[0.25,0.5,0.75,1,1.25,1.5,1.75,2],
    controlBar:{ pictureInPictureToggle:true }
  });

  function fetchStream(q){
    var fmt = q === '1080' ? 5 : (q === '720' ? 4 : 2);
    return fetch('/stream/'+vid+'?formatId='+fmt,{cache:'no-store'}).then(function(r){return r.text()});
  }

  function setSource(q){
    fetchStream(q).then(function(url){
      if(!url || url.indexOf('http')!==0){
        // fallback to 360p
        if(q!=='360'){ document.querySelector('.q-btn[data-q="360"]').click(); return; }
        return;
      }
      var t = player.currentTime();
      var wasPaused = player.paused();
      player.src({src:url,type:'video/mp4'});
      if(q==='360'){
        hasAudioTrack = false;
        audioEl.pause(); audioEl.src='';
        player.muted(false);
      } else {
        // load 360p audio for sync
        fetchStream('360').then(function(audUrl){
          if(!audUrl || audUrl.indexOf('http')!==0) return;
          audioEl.src = audUrl;
          hasAudioTrack = true;
          player.muted(true);
          audioEl.currentTime = player.currentTime();
          if(!wasPaused){ audioEl.play().catch(function(){}); }
        });
      }
      player.one('loadedmetadata',function(){
        try{ player.currentTime(t); }catch(_){}
        if(!wasPaused) player.play().catch(function(){});
      });
    }).catch(function(){});
  }

  // sync helpers
  player.on('play', function(){ if(hasAudioTrack){ audioEl.currentTime = player.currentTime(); audioEl.play().catch(function(){}); } });
  player.on('pause',function(){ if(hasAudioTrack){ audioEl.pause(); } });
  player.on('seeked',function(){ if(hasAudioTrack){ audioEl.currentTime = player.currentTime(); } });
  player.on('ratechange',function(){ if(hasAudioTrack){ audioEl.playbackRate = player.playbackRate(); } });
  player.on('volumechange',function(){ /* audio always carries sound; track player volume */
    if(hasAudioTrack){ audioEl.volume = player.muted()?0:player.volume(); }
  });
  setInterval(function(){
    if(!hasAudioTrack || player.paused()) return;
    var diff = audioEl.currentTime - player.currentTime();
    if(Math.abs(diff) > 0.35){ audioEl.currentTime = player.currentTime(); }
  }, 1500);

  document.querySelectorAll('.q-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.q-btn').forEach(function(b){b.classList.remove('active')});
      btn.classList.add('active');
      currentQ = btn.dataset.q;
      setSource(currentQ);
    });
  });
  setSource('360');

  // ---- lazy comments load ----
  function escHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]})}
  function renderComments(list, container){
    list.forEach(function(c){
      var el = document.createElement('div');
      el.className = 'comment';
      var av = (c.authorThumbnails && c.authorThumbnails[0]) ? c.authorThumbnails[0].url : '';
      el.innerHTML =
        '<img class="av" loading="lazy" src="'+(av?('/img-proxy?u='+encodeURIComponent(av)):'')+'" alt="">'+
        '<div class="cb">'+
          '<div class="ch"><b>'+escHtml(c.author||'')+'</b>'+escHtml(c.publishedText||'')+'</div>'+
          '<div class="ct">'+escHtml(c.content||'').replace(/\\n/g,'<br>')+'</div>'+
          '<div class="cm"><span>👍 '+(c.likeCount||0)+'</span>'+(c.replies?('<span>↳ '+(c.replies.replyCount||'返信')+'</span>'):'')+'</div>'+
        '</div>';
      container.appendChild(el);
    });
  }
  var section = document.getElementById('commentsSection');
  var loadEl = document.getElementById('comments-load');
  var contToken = null;
  function loadComments(){
    var url = '/api/comments/'+vid + (contToken?('?continuation='+encodeURIComponent(contToken)):'');
    fetch(url).then(function(r){return r.json()}).then(function(j){
      if(!j || !j.comments){ loadEl.textContent='コメントを取得できませんでした'; return; }
      var container = document.createElement('div');
      renderComments(j.comments, container);
      loadEl.parentNode.insertBefore(container, loadEl);
      contToken = j.continuation || null;
      if(contToken){
        loadEl.innerHTML = '<button id="comments-more">さらに読み込む</button>';
        document.getElementById('comments-more').addEventListener('click', function(){ loadEl.textContent='読み込み中…'; loadComments(); });
      } else {
        loadEl.textContent = j.commentCount === 0 ? 'コメントはまだありません' : '';
      }
    }).catch(function(){ loadEl.textContent='コメントを取得できませんでした'; });
  }
  // fire after a small delay to prioritize video loading
  setTimeout(loadComments, 600);
})();
</script>`;
  return layout({ title: v.title, body, backend, includePlayer:true });
}

/* ----- channel page ----- */
function renderChannel({ ch, items, tab, backend }) {
  const tabs = ['videos','shorts','streams','playlists','community','channels'];
  const tabsHtml = tabs.map(t => `<a class="ch-tab ${t===tab?'active':''}" href="/channel/${esc(ch.authorId)}?tab=${t}">${t.toUpperCase()}</a>`).join('');
  const banner = pickThumb(ch.authorBanners,'maxresdefault') || pickThumb(ch.authorBanners);
  const ava = pickThumb(ch.authorThumbnails);
  const cardsHtml = items.length ? items.map(v => `
    <a class="card" href="/watch?v=${encodeURIComponent(v.videoId)}">
      <div class="thumb">
        <img loading="lazy" src="${esc(proxyImg(v.thumb))}" alt="">
        ${v.liveNow?'<span class="badge live">LIVE</span>':(v.lengthSeconds?`<span class="badge">${fmtDur(v.lengthSeconds)}</span>`:'')}
      </div>
      <div class="info">
        <div class="title">${esc(v.title)}</div>
        <div class="meta">${esc(v.viewCountText||(v.viewCount?fmtViews(v.viewCount)+' 回視聴':''))} ${v.publishedText?'・'+esc(v.publishedText):''}</div>
      </div>
    </a>`).join('') : `<div class="notice">このタブにはコンテンツがありません</div>`;

  const body = `
${banner?`<div class="ch-banner" style="background-image:url('${esc(proxyImg(banner))}')"></div>`:''}
<div class="ch-header">
  <img class="cha" src="${esc(proxyImg(ava))}" alt="">
  <div>
    <h1>${esc(ch.author)}${ch.authorVerified?' ✓':''}</h1>
    <div class="csubs">${esc(ch.subCount?fmtViews(ch.subCount)+' 人のチャンネル登録者':'')} ${ch.totalViews?'・ '+fmtViews(ch.totalViews)+' 回再生':''}</div>
    <div style="margin-top:8px"><button class="btn">＋ 登録</button></div>
  </div>
</div>
<div class="ch-tabs">${tabsHtml}</div>
<div class="grid">${cardsHtml}</div>
`;
  return layout({ title: ch.author, body, backend });
}

/* ----- playlist page ----- */
function renderPlaylist({ pl, backend }) {
  const items = (pl.videos||[]).map((v,i) => `
    <a class="card" href="/watch?v=${encodeURIComponent(v.videoId)}&list=${esc(pl.playlistId)}&index=${i+1}">
      <div class="thumb">
        <img loading="lazy" src="${esc(proxyImg(pickThumb(v.videoThumbnails,'medium')))}" alt="">
        ${v.lengthSeconds?`<span class="badge">${fmtDur(v.lengthSeconds)}</span>`:''}
      </div>
      <div class="info">
        <div class="title">${i+1}. ${esc(v.title)}</div>
        <div class="author">${esc(v.author||'')}</div>
      </div>
    </a>`).join('');
  const body = `
<div style="padding:18px 18px 8px;max-width:1500px;margin:0 auto">
  <h1 style="font-size:22px">${esc(pl.title||'プレイリスト')}</h1>
  <div style="color:var(--muted);font-size:13px;margin-top:6px">作成者: ${esc(pl.author||'')} ・ ${pl.videoCount||(pl.videos?pl.videos.length:0)} 本の動画</div>
  <div style="color:#ccc;margin-top:10px;white-space:pre-wrap">${esc(pl.description||'')}</div>
</div>
<div class="grid">${items}</div>`;
  return layout({ title:pl.title||'Playlist', body, backend });
}

/* ----- 404 / removed / error pages ----- */
const renderDeleted = (backend) => layout({
  title:'削除されました',
  body:`<div class="notice"><h2>This page has been deleted to reduce maintenance costs.</h2><p>このページはメンテナンスコスト削減のため削除されました。</p><a href="/">← ホームへ</a></div>`,
  backend
});
const renderError = (backend, msg='エラーが発生しました', code=500) => layout({
  title:'Error',
  body:`<div class="notice"><h2>${esc(msg)}</h2><p style="margin-top:14px">エラーコード: ${code}</p><a href="/">← ホームへ</a></div>`,
  backend
});


/* ---------------------------------------------------------------------
 * /yt-sc/:videoId  — preserved InnerTube scraper (returns JSON)
 *  (full implementation from previous build, condensed)
 * ------------------------------------------------------------------- */
async function innertubeRequest(clientKey, endpoint, payload) {
  const cli = CLIENTS[clientKey];
  if (!cli) throw new Error('unknown client');
  const url = `https://www.youtube.com/youtubei/v1/${endpoint}?key=${cli.key}&prettyPrint=false`;
  const ctx = {
    client: {
      hl:'en', gl:'US',
      clientName: cli.name, clientVersion: cli.version,
      ...(cli.deviceMake?{deviceMake:cli.deviceMake,deviceModel:cli.deviceModel}:{}),
      ...(cli.osName?{osName:cli.osName,osVersion:cli.osVersion}:{}),
      ...(cli.androidSdkVersion?{androidSdkVersion:cli.androidSdkVersion}:{}),
      userAgent: cli.userAgent,
    },
    user:{lockedSafetyMode:false},
    request:{useSsl:true},
  };
  const body = JSON.stringify({ context: ctx, ...payload });
  const res = await fetch(url, {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'User-Agent': cli.userAgent,
      'X-YouTube-Client-Name': cli.clientName,
      'X-YouTube-Client-Version': cli.version,
      Origin:'https://www.youtube.com',
      Referer:'https://www.youtube.com/',
    },
    body,
    dispatcher: AGENT,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`InnerTube HTTP ${res.status}`);
  return res.json();
}

async function scrapeYouTubeMeta(videoId) {
  const cached = videoCache.get(videoId);
  if (cached) return cached;
  const tries = ['IOS','ANDROID','TV_EMBEDDED','WEB_EMBEDDED','WEB'];
  let lastErr;
  for (const c of tries) {
    try {
      const j = await innertubeRequest(c, 'player', { videoId });
      if (!j || !j.videoDetails) continue;
      const vd = j.videoDetails;
      const out = {
        success:true,
        videoId,
        title: vd.title,
        author: vd.author,
        authorId: vd.channelId,
        lengthSeconds: Number(vd.lengthSeconds)||0,
        viewCount: Number(vd.viewCount)||0,
        description: vd.shortDescription || '',
        thumbnails: vd.thumbnail?.thumbnails || [],
        keywords: vd.keywords || [],
        isLive: !!vd.isLiveContent,
        client: c,
      };
      videoCache.set(videoId, out, 90_000);
      return out;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All clients failed');
}

/* ---------------------------------------------------------------------
 * Express routing
 * ------------------------------------------------------------------- */
app.disable('x-powered-by');
app.set('etag', false);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  // store backend cookie if user picks one
  const q = req.query.backend;
  if (q && BACKENDS.find(b => b.id === q)) {
    res.setHeader('Set-Cookie', `backend=${q}; Path=/; Max-Age=2592000; SameSite=Lax`);
  }
  next();
});

/* ----- Home ----- */
app.get('/', (req, res) => {
  res.type('html').send(renderHome(getBackend(req)));
});

/* ----- Trending / Popular  -> "removed" page ----- */
const removedHandler = (req, res) => res.type('html').send(renderDeleted(getBackend(req)));
app.get('/feed/trending', removedHandler);
app.get('/popular',       removedHandler);
app.get('/trending',      removedHandler);

/* ----- Search ----- */
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const backend = getBackend(req);
  if (!q) return res.redirect('/');

  try {
    // Use youtube-search-api module — no Invidious dependency for search
    let items = [];
    if (page === 1) {
      const data = await yts.GetListByKeyword(q, false, 30, [{ type:'video' }]);
      items = (data.items || []).filter(it => it.type === 'video' || !it.type);
    } else {
      // re-execute and slice as approximation (youtube-search-api has no easy page param)
      const data = await yts.GetListByKeyword(q, false, 30 * page, [{ type:'video' }]);
      const all = (data.items || []).filter(it => it.type === 'video' || !it.type);
      items = all.slice((page-1)*30);
    }
    const normalized = items.map(it => ({
      videoId: it.id,
      title:   it.title,
      author:  it.channelTitle || (it.shortBylineText && it.shortBylineText.runs && it.shortBylineText.runs[0]?.text) || '',
      authorId:(it.shortBylineText && it.shortBylineText.runs && it.shortBylineText.runs[0]?.navigationEndpoint?.browseEndpoint?.browseId) || '',
      thumb:   (it.thumbnail && it.thumbnail.thumbnails && it.thumbnail.thumbnails[it.thumbnail.thumbnails.length-1]?.url) || '',
      lengthSeconds: it.length && it.length.simpleText ? parseLen(it.length.simpleText) : 0,
      viewCountText: it.viewCount || (it.shortViewCountText?.simpleText) || '',
      publishedText: it.publishedTimeText?.simpleText || '',
      liveNow: !!it.isLive,
    })).filter(v => v.videoId);

    // If module returns nothing, fallback to Invidious
    let finalItems = normalized;
    if (!finalItems.length) {
      try {
        const { data } = await invidiousGet(`/api/v1/search?q=${encodeURIComponent(q)}&page=${page}&type=video`, backend);
        finalItems = normalizeVideoList(data);
      } catch (_) {}
    }
    res.type('html').send(renderSearchResults({ q, page, items: finalItems, backend }));
  } catch (e) {
    res.type('html').send(renderError(backend, '検索処理でエラーが発生しました: '+e.message));
  }
});

function parseLen(s) {
  if (!s) return 0;
  const parts = s.split(':').map(n => parseInt(n)||0);
  if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  if (parts.length === 2) return parts[0]*60 + parts[1];
  return parts[0]||0;
}

/* ----- /yt-sc/:videoId (preserved scraper) ----- */
app.get('/yt-sc/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).json({ success:false, error:'Invalid videoId' });
  try { res.json(await scrapeYouTubeMeta(videoId)); }
  catch (e) { res.status(500).json({ success:false, error:e.message, videoId }); }
});

/* ----- Stream endpoint -> redirects/returns URL text ----- */
app.get('/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).send('Invalid id');
  const formatId = parseInt(req.query.formatId) || 2;
  if (![2,4,5].includes(formatId)) return res.status(400).send('Invalid formatId');
  try {
    const url = await resolveStream(videoId, formatId);
    if (!url) return res.status(502).send('Stream unavailable');
    res.type('text/plain').send(url);
  } catch (e) {
    res.status(500).send('Stream error');
  }
});

/* ----- Image proxy (to avoid mixed-content + referrer issues) ----- */
app.get('/img-proxy', async (req, res) => {
  const u = req.query.u;
  if (!u || !/^https?:\/\//.test(u)) return res.status(400).send('Bad url');
  try {
    const r = await fetch(u, { headers:{'User-Agent':getUA(),Referer:'https://www.youtube.com/'}, signal: AbortSignal.timeout(10000), dispatcher: AGENT });
    if (!r.ok) return res.status(r.status).end();
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control','public, max-age=86400');
    const buf = Buffer.from(await r.arrayBuffer());
    res.send(buf);
  } catch (e) { res.status(502).end(); }
});

/* ----- /watch?v=ID  (video page) ----- */
app.get('/watch', async (req, res) => {
  const videoId = req.query.v;
  const backend = getBackend(req);
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.redirect('/');

  try {
    const { data } = await invidiousGet(`/api/v1/videos/${videoId}`, backend, 10000);
    const related = normalizeVideoList(data.recommendedVideos || []);
    res.type('html').send(renderWatch({ video: data, related, backend }));
  } catch (e) {
    // Fallback: build minimal page from scraper
    try {
      const meta = await scrapeYouTubeMeta(videoId);
      const stub = {
        videoId,
        title: meta.title,
        author: meta.author,
        authorId: meta.authorId,
        authorThumbnails: [],
        videoThumbnails: meta.thumbnails || [],
        viewCount: meta.viewCount,
        likeCount: 0,
        lengthSeconds: meta.lengthSeconds,
        publishedText: '',
        descriptionHtml: esc(meta.description||'').replace(/\n/g,'<br>'),
        liveNow: meta.isLive,
        subCountText:'',
      };
      res.type('html').send(renderWatch({ video: stub, related: [], backend }));
    } catch (e2) {
      res.type('html').send(renderError(backend, '動画情報の取得に失敗しました: '+e.message));
    }
  }
});

/* ----- Comments (JSON, lazy-loaded by browser) ----- */
app.get('/api/comments/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  const backend = getBackend(req);
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).json({error:'bad id'});
  const cont = req.query.continuation ? `&continuation=${encodeURIComponent(req.query.continuation)}` : '';
  const cacheKey = `${videoId}:${cont}`;
  const cached = commentCache.get(cacheKey);
  if (cached) return res.json(cached);
  try {
    const { data } = await invidiousGet(`/api/v1/comments/${videoId}?hl=ja${cont}`, backend, 10000);
    commentCache.set(cacheKey, data, 120_000);
    res.json(data);
  } catch (e) {
    res.json({ comments: [], commentCount: 0, continuation: null, error: e.message });
  }
});

/* ----- Channel page ----- */
app.get('/channel/:id', async (req, res) => {
  const id = req.params.id;
  const tab = (req.query.tab || 'videos').toLowerCase();
  const backend = getBackend(req);
  const validTabs = ['videos','shorts','streams','playlists','community','channels'];
  if (!validTabs.includes(tab)) return res.redirect(`/channel/${id}?tab=videos`);

  try {
    const { data: ch } = await invidiousGet(`/api/v1/channels/${id}`, backend, 12000);
    let items = [];
    if (tab === 'videos') {
      items = normalizeVideoList(ch.latestVideos || []);
      // Try to fetch /videos endpoint for fuller list
      try {
        const { data: vlist } = await invidiousGet(`/api/v1/channels/${id}/videos`, backend, 9000);
        if (Array.isArray(vlist.videos) && vlist.videos.length) items = normalizeVideoList(vlist.videos);
      } catch (_) {}
    } else if (tab === 'shorts' || tab === 'streams') {
      try {
        const { data: list } = await invidiousGet(`/api/v1/channels/${id}/${tab}`, backend, 9000);
        items = normalizeVideoList(list.videos || []);
      } catch (_) { items = []; }
    } else if (tab === 'playlists') {
      try {
        const { data: list } = await invidiousGet(`/api/v1/channels/${id}/playlists`, backend, 9000);
        items = (list.playlists || []).map(p => ({
          videoId: '', title: p.title, author: ch.author, authorId: ch.authorId,
          thumb: pickThumb(p.playlistThumbnails) || (p.videos?.[0]?.videoThumbnails?.[0]?.url) || '',
          viewCountText: `${p.videoCount||0} 本の動画`,
        })).map(p => ({...p, _playlistLink:true}));
      } catch (_) {}
    } else if (tab === 'community') {
      try {
        const { data: list } = await invidiousGet(`/api/v1/channels/${id}/community`, backend, 9000);
        // Render community items as simple cards
        items = (list.comments || []).map(c => ({
          videoId:'', title:c.contentHtml ? c.contentHtml.replace(/<[^>]+>/g,'').slice(0,140) : (c.content||'').slice(0,140),
          author: ch.author, thumb: pickThumb(ch.authorThumbnails),
          viewCountText: `👍 ${c.likeCount||0}`, publishedText: c.publishedText||''
        }));
      } catch (_) {}
    } else if (tab === 'channels') {
      try {
        const { data: list } = await invidiousGet(`/api/v1/channels/${id}/channels`, backend, 9000);
        items = (list.relatedChannels || list.channels || []).map(c => ({
          videoId:'', title: c.author, author:'', thumb: pickThumb(c.authorThumbnails),
          viewCountText: c.subCount ? fmtViews(c.subCount)+' 人' : '',
        }));
      } catch (_) {}
    }
    res.type('html').send(renderChannel({ ch, items, tab, backend }));
  } catch (e) {
    res.type('html').send(renderError(backend, 'チャンネル情報の取得に失敗しました'));
  }
});

/* ----- Playlist page ----- */
app.get('/playlist', async (req, res) => {
  const list = req.query.list;
  const backend = getBackend(req);
  if (!list) return res.redirect('/');
  try {
    const { data } = await invidiousGet(`/api/v1/playlists/${list}`, backend, 12000);
    res.type('html').send(renderPlaylist({ pl: data, backend }));
  } catch (e) {
    res.type('html').send(renderError(backend, 'プレイリストの取得に失敗しました'));
  }
});

/* ----- Mix ----- */
app.get('/mix', async (req, res) => {
  const list = req.query.list;
  const backend = getBackend(req);
  if (!list) return res.redirect('/');
  try {
    const { data } = await invidiousGet(`/api/v1/mixes/${list}`, backend, 10000);
    const pl = { title: data.title, author: data.author, videos: data.videos, playlistId: list };
    res.type('html').send(renderPlaylist({ pl, backend }));
  } catch (e) {
    res.type('html').send(renderError(backend, 'Mixの取得に失敗しました'));
  }
});

/* ----- Hashtag ----- */
app.get('/hashtag/:tag', async (req, res) => {
  const backend = getBackend(req);
  const tag = req.params.tag;
  try {
    const { data } = await invidiousGet(`/api/v1/hashtag/${encodeURIComponent(tag)}`, backend, 9000);
    const items = normalizeVideoList(data.results || data);
    res.type('html').send(renderSearchResults({ q:'#'+tag, page:1, items, backend }));
  } catch (e) {
    res.type('html').send(renderError(backend, 'ハッシュタグの取得に失敗しました'));
  }
});

/* ----- Post ----- */
app.get('/post/:id', async (req, res) => {
  const backend = getBackend(req);
  try {
    const { data } = await invidiousGet(`/api/v1/post/${req.params.id}`, backend, 9000);
    const body = `
<div class="comments" style="margin-top:30px">
  <div class="comment">
    <img class="av" src="${esc(proxyImg(pickThumb(data.authorThumbnails)))}" alt="">
    <div class="cb">
      <div class="ch"><b>${esc(data.author)}</b> ${esc(data.publishedText||'')}</div>
      <div class="ct">${esc(data.content||'').replace(/\n/g,'<br>')}</div>
      <div class="cm"><span>👍 ${data.likeCount||0}</span></div>
    </div>
  </div>
</div>`;
    res.type('html').send(layout({ title:'Post', body, backend }));
  } catch (e) {
    res.type('html').send(renderError(backend, 'コミュニティ投稿の取得に失敗しました'));
  }
});

/* ----- Suggestions (search bar autocomplete, JSON) ----- */
app.get('/api/v1/search/suggestions', async (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.json({ query:'', suggestions:[] });
  try {
    const u = `https://suggestqueries-clients.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}`;
    const r = await fetch(u, { headers:{'User-Agent':getUA()}, signal:AbortSignal.timeout(7000) });
    const txt = await r.text();
    const m = txt.match(/\[.*\]/s);
    if (m) {
      const arr = JSON.parse(m[0]);
      const sugs = (arr[1] || []).map(s => Array.isArray(s) ? s[0] : s);
      return res.json({ query:q, suggestions:sugs });
    }
  } catch(_){}
  res.json({ query:q, suggestions:[] });
});

/* ----- /preferences (stub) ----- */
app.get('/preferences', (req,res) => {
  const backend = getBackend(req);
  const body = `
<div style="max-width:720px;margin:30px auto;padding:20px;background:var(--card);border:1px solid var(--border);border-radius:6px">
  <h1 style="font-size:22px;margin-bottom:14px">設定 / Preferences</h1>
  <p style="color:var(--muted);font-size:14px;margin-bottom:14px">使用するバックエンドを選択してください。</p>
  <form method="get" action="/">
    <select name="backend" style="background:#222;color:#fff;border:1px solid var(--border);padding:8px 10px;border-radius:4px;width:100%">
      ${BACKENDS.map(b => `<option value="${b.id}" ${b.id===backend?'selected':''}>${b.id} - ${b.name} (${b.url})</option>`).join('')}
    </select>
    <button class="btn" style="margin-top:14px" type="submit">保存して戻る</button>
  </form>
</div>`;
  res.type('html').send(layout({ title:'設定', body, backend }));
});

/* ----- /login (stub) ----- */
app.get('/login', (req,res) => {
  const backend = getBackend(req);
  const body = `
<div style="max-width:420px;margin:80px auto;padding:30px;background:var(--card);border:1px solid var(--border);border-radius:6px">
  <h1 style="font-size:22px;margin-bottom:18px">ログイン</h1>
  <form>
    <input style="display:block;width:100%;background:#222;color:#fff;border:1px solid var(--border);padding:10px;border-radius:4px;margin-bottom:10px" placeholder="ユーザー名">
    <input type="password" style="display:block;width:100%;background:#222;color:#fff;border:1px solid var(--border);padding:10px;border-radius:4px;margin-bottom:10px" placeholder="パスワード">
    <button class="btn" type="button" onclick="alert('現在ログイン機能はメンテナンス中です')">ログイン</button>
  </form>
</div>`;
  res.type('html').send(layout({ title:'ログイン', body, backend }));
});

/* ----- /feed/* (stubs) ----- */
const feedStubs = ['subscriptions','playlists','history'];
feedStubs.forEach(f => {
  app.get(`/feed/${f}`, (req,res) => {
    const backend = getBackend(req);
    const body = `<div class="notice"><h2>${f.toUpperCase()}</h2><p>この機能を利用するには <a href="/login">ログイン</a> してください。</p></div>`;
    res.type('html').send(layout({ title:f, body, backend }));
  });
});

/* ----- /redirect (Invidious-style external redirect helper) ----- */
app.get('/redirect', (req,res) => {
  const u = req.query.q;
  if (!u || !/^https?:\/\//.test(u)) return res.redirect('/');
  res.redirect(u);
});

/* ----- 404 ----- */
app.use((req, res) => {
  const backend = getBackend(req);
  res.status(404).type('html').send(renderError(backend, 'ページが見つかりませんでした', 404));
});

/* ----- Error handler ----- */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).type('html').send(renderError(getBackend(req), 'サーバー内部エラーが発生しました'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[INVIDIOUS-MINI v${VERSION}] listening on port ${PORT}`));

module.exports = app;
