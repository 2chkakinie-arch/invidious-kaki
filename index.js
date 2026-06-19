'use strict';

/*
 * Invidious — An open source alternative front-end to YouTube.
 * Single-file edition. Compatible with Invidious URL scheme and preferences cookie.
 *
 * Routes implemented (mirroring upstream Invidious):
 *   /                                home (popular / trending shortcut)
 *   /feed/popular                    popular feed
 *   /feed/trending                   trending feed
 *   /search                          search results (with pagination & filters)
 *   /watch                           watch page
 *   /embed/:id                       embed player
 *   /channel/:id                     channel root (videos)
 *   /channel/:id/videos              channel videos
 *   /channel/:id/playlists           channel playlists
 *   /channel/:id/community           channel community (placeholder)
 *   /channel/:id/about               channel about
 *   /playlist                        playlist viewer
 *   /hashtag/:tag                    hashtag page
 *   /preferences                     preferences (PREFS cookie)
 *   /licenses /privacy /redirect     legal / utility
 *
 *   /stream/:id                      progressive 360p stream (with audio)
 *   /stream/:id/:itag                higher quality video-only streams
 *   /yt-sc/:id                       compact video data (used internally)
 *   /api/v1/videos/:id               JSON video info
 *   /api/v1/search                   JSON search
 *   /api/v1/comments/:id             JSON comments (paginated)
 *   /api/v1/channels/:id             JSON channel info
 *   /api/v1/playlists/:id            JSON playlist
 *   /api/v1/trending /popular        JSON feeds
 *   /api/v1/search/suggestions       JSON suggestions
 *   /backend/switch/:id              switch active backend
 *   /backend/status                  JSON status of every backend (health)
 *
 *   /videojs/*  /css/* /js/*         vendor & site assets (served inline)
 */

const express = require('express');
const yts = require('youtube-search-api');
const { fetch, Agent, request } = require('undici');

const app = express();
const VERSION = '2.20240825.0-1';   // pretend to be upstream-stable
const BUILD = '07c38a4';            // CSS/JS cache buster, matches upstream pattern

app.disable('x-powered-by');
app.set('etag', 'strong');
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '256kb' }));

/* ────────────────────────────────────────────────────────────────────────── */
/*  Cookie parser (no extra dep)                                              */
/* ────────────────────────────────────────────────────────────────────────── */
app.use((req, _res, next) => {
  const header = req.headers.cookie || '';
  const jar = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) jar[k] = decodeURIComponent(v);
  });
  req.cookies = jar;
  // Parse PREFS cookie if present (Invidious-compatible JSON)
  req.prefs = (() => {
    try { return jar.PREFS ? JSON.parse(jar.PREFS) : {}; } catch { return {}; }
  })();
  next();
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Backend pool – B1..B8.                                                    */
/*  Each entry is a logical egress lane; CL/US/DE flags label the perceived   */
/*  region.  We use undici Agents with different connection profiles so each  */
/*  lane is independent and we can health-check / fail-over deterministically */
/* ────────────────────────────────────────────────────────────────────────── */
const BACKENDS = [
  { id: 'B1', region: 'CL', priority: 1, label: 'B1 (CL)', timeout: 12000 },
  { id: 'B2', region: 'US', priority: 2, label: 'B2 (US)', timeout: 10000 },
  { id: 'B3', region: 'US', priority: 3, label: 'B3 (US)', timeout: 10000 },
  { id: 'B4', region: 'US', priority: 4, label: 'B4 (US)', timeout: 10000 },
  { id: 'B5', region: 'US', priority: 5, label: 'B5 (US)', timeout: 10000 },
  { id: 'B6', region: 'US', priority: 6, label: 'B6 (US)', timeout: 10000 },
  { id: 'B7', region: 'DE', priority: 7, label: 'B7 (DE)', timeout: 14000 },
  { id: 'B8', region: 'DE', priority: 8, label: 'B8 (DE)', timeout: 14000 },
];

const backendState = new Map();
for (const b of BACKENDS) {
  backendState.set(b.id, {
    ...b,
    agent: new Agent({ connections: 8, pipelining: 1, keepAliveTimeout: 30000 }),
    ok: true,
    lastError: null,
    lastUsed: 0,
    inflight: 0,
  });
}

function pickBackend(preferredId) {
  // 1. requested id has priority if healthy
  if (preferredId && backendState.has(preferredId)) {
    const b = backendState.get(preferredId);
    if (b.ok) return b;
  }
  // 2. otherwise the lowest-priority healthy backend (B1 first)
  const list = [...backendState.values()].filter(b => b.ok)
    .sort((a, b) => a.priority - b.priority);
  return list[0] || backendState.get('B1');
}

function activeBackendFor(req) {
  return pickBackend(req.cookies.IV_BACKEND);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Obfuscated upstream URL builder (do NOT log the decoded string anywhere)  */
/*  Same scheme the project has been using – kept compatible.                 */
/* ────────────────────────────────────────────────────────────────────────── */
const _0xL1 = [0x79,0x85,0x85,0x81,0x84,0x4b,0x40,0x40,0x78,0x76,0x85,0x7d,0x72,0x85,0x76,0x3f,
               0x75,0x76,0x87,0x40,0x72,0x81,0x7a,0x40,0x85,0x80,0x80,0x7d,0x84,0x40,0x8a,0x80,
               0x86,0x85,0x86,0x73,0x76,0x3e];
const _0xL2 = [0x7d,0x7a,0x87,0x76,0x3e,0x75,0x80,0x88,0x7f,0x7d,0x80,0x72,0x75,0x76,0x83,0x50,
               0x86,0x83,0x7d,0x4e,0x79,0x85,0x85,0x81,0x84,0x36,0x44,0x52,0x36,0x43,0x57,0x36,
               0x43,0x57,0x88,0x88,0x88,0x3f,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3f,0x74,0x80,
               0x7e,0x36,0x43,0x57,0x88,0x72,0x85,0x74,0x79,0x36,0x44,0x57,0x87,0x36,0x44,0x55];
const _0xL3 = [0x7f,0x80,0x7a,0x3e,0x7d,0x7a,0x87,0x76,0x3e,0x75,0x80,0x88,0x7f,0x7d,0x80,0x72,
               0x75,0x76,0x83]; // 'video-downloader' variant for fallback
const _0xK  = [0x37,0x77,0x80,0x83,0x7e,0x72,0x85,0x5a,0x75,0x4e];
const _0xH  = ['\x6d\x61\x70','\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65','\x6a\x6f\x69\x6e'];

function _de(arr){ return arr[_0xH[0]](c => String[_0xH[1]](c - 0x11))[_0xH[2]](''); }

function buildStreamURL(videoId, formatId, useFallback) {
  const base = _de(_0xL1) + (useFallback ? _de(_0xL3) : '') + _de(_0xL2);
  return base + encodeURIComponent(videoId) + _de(_0xK) + String(formatId);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tiny LRU caches                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
class TinyCache {
  constructor(max = 500) { this.max = max; this.m = new Map(); }
  get(k) {
    const e = this.m.get(k);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { this.m.delete(k); return null; }
    this.m.delete(k); this.m.set(k, e);
    return e.v;
  }
  set(k, v, ttlMs) {
    if (this.m.size >= this.max) this.m.delete(this.m.keys().next().value);
    this.m.set(k, { v, exp: ttlMs ? Date.now() + ttlMs : 0 });
  }
}
const videoCache    = new TinyCache(400);   // stream URL cache
const ytScCache     = new TinyCache(300);   // /yt-sc data cache
const searchCache   = new TinyCache(200);
const trendingCache = new TinyCache(20);
const channelCache  = new TinyCache(200);
const playlistCache = new TinyCache(200);

/* ────────────────────────────────────────────────────────────────────────── */
/*  youtubei.js lazy loader (used for rich data: channel/comments/playlist).  */
/*  Falls back to youtube-search-api if youtubei.js cannot init.              */
/* ────────────────────────────────────────────────────────────────────────── */
let _yti = null;
async function getInnertube() {
  if (_yti) return _yti;
  try {
    const { Innertube } = require('youtubei.js');
    _yti = await Innertube.create({ retrieve_player: false, generate_session_locally: true });
  } catch (e) {
    console.warn('[innertube] init failed:', e.message);
    _yti = false;
  }
  return _yti;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */
const esc = (s = '') => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function nFmt(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function durFmt(secs) {
  secs = Number(secs) || 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
           : `${m}:${String(s).padStart(2,'0')}`;
}

function parseDur(text) {
  if (!text) return 0;
  const p = String(text).split(':').map(n => parseInt(n, 10) || 0);
  return p.reduce((a, x) => a * 60 + x, 0);
}

function ytThumb(id, q = 'mqdefault') {
  return `https://i.ytimg.com/vi/${id}/${q}.jpg`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Innertube-fed structured data: /yt-sc/:id (used by watch page)            */
/*  Returns: { title, author, authorId, description, viewCount, published,   */
/*            lengthSeconds, likeCount, thumbnails, related[], chapters[] }  */
/* ────────────────────────────────────────────────────────────────────────── */
async function fetchYtSc(videoId) {
  const hit = ytScCache.get(videoId);
  if (hit) return hit;

  const yt = await getInnertube();
  let info = null;
  if (yt) {
    try {
      const v = await yt.getBasicInfo(videoId);
      info = {
        videoId,
        title: v.basic_info?.title || '',
        author: v.basic_info?.author || v.basic_info?.channel?.name || '',
        authorId: v.basic_info?.channel?.id || '',
        authorUrl: v.basic_info?.channel?.url || '',
        authorThumbnails: (v.basic_info?.channel?.thumbnails || []).map(t => t.url),
        description: v.basic_info?.short_description || '',
        viewCount: v.basic_info?.view_count || 0,
        likeCount: v.basic_info?.like_count || 0,
        lengthSeconds: v.basic_info?.duration || 0,
        published: v.primary_info?.published?.text || '',
        keywords: v.basic_info?.keywords || [],
        thumbnails: (v.basic_info?.thumbnail || []).map(t => ({ url: t.url, w: t.width, h: t.height })),
        isLive: !!v.basic_info?.is_live,
        related: [],
      };
    } catch (e) {
      console.warn('[yt-sc] innertube failed:', e.message);
    }
  }

  // Fallback to youtube-search-api
  if (!info) {
    try {
      const d = await yts.GetVideoDetails(videoId);
      info = {
        videoId,
        title: d.title || '',
        author: d.channel || '',
        authorId: d.channelId || '',
        authorUrl: d.channelId ? `https://www.youtube.com/channel/${d.channelId}` : '',
        authorThumbnails: (d.channelThumbnail?.thumbnails || []).map(t => t.url),
        description: d.description || (Array.isArray(d.description?.runs) ? d.description.runs.map(r => r.text).join('') : ''),
        viewCount: parseInt(String(d.viewCount || '').replace(/\D/g, ''), 10) || 0,
        likeCount: 0,
        lengthSeconds: parseDur(d.duration?.simpleText || d.lengthSeconds || ''),
        published: d.publishDate || '',
        keywords: d.keywords || [],
        thumbnails: (d.thumbnail?.thumbnails || []).map(t => ({ url: t.url, w: t.width, h: t.height })),
        isLive: !!d.isLive,
        related: (d.suggestion || []).slice(0, 25).map(s => ({
          videoId: s.id, title: s.title, author: s.channelTitle, authorId: '',
          lengthSeconds: parseDur(s.length?.simpleText || ''),
          viewCount: 0, thumbnails: (s.thumbnail?.thumbnails || []).map(t => t.url),
        })),
      };
    } catch (e) {
      console.error('[yt-sc] fallback failed:', e.message);
      info = { videoId, title: '', author: '', description: '', viewCount: 0, lengthSeconds: 0, thumbnails: [], related: [] };
    }
  }

  // Enrich related list if missing
  if (!info.related || !info.related.length) {
    try {
      const rel = await yts.GetSuggestData(20);
      info.related = (rel.items || []).filter(it => it.type === 'video').map(it => ({
        videoId: it.id, title: it.title,
        author: it.channelTitle || '', authorId: '',
        lengthSeconds: parseDur(it.length?.simpleText || ''),
        viewCount: 0,
        thumbnails: (it.thumbnail?.thumbnails || []).map(t => t.url),
      }));
    } catch {}
  }

  ytScCache.set(videoId, info, 5 * 60 * 1000);
  return info;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Stream resolver — picks the right backend, follows redirects, encodes     */
/*  the upstream call so it's not obvious where we get the file from.         */
/* ────────────────────────────────────────────────────────────────────────── */
const FORMAT_MAP = {
  '360p': 2,    // 360p with audio
  '480p': 3,    // (treated as 360p fallback)
  '720p': 4,    // 720p video-only
  '1080p': 5,   // 1080p video-only
  'audio': 2,   // audio uses 360p combined track
};

async function resolveStreamURL(videoId, quality = '360p', backend = null) {
  const formatId = FORMAT_MAP[quality] ?? 2;
  const cacheKey = `${videoId}|${formatId}|${backend ? backend.id : 'auto'}`;
  const hit = videoCache.get(cacheKey);
  if (hit) return hit;

  const tryFetch = async (fb) => {
    const url = buildStreamURL(videoId, formatId, fb);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), (backend?.timeout) || 12000);
    try {
      const r = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
        dispatcher: backend?.agent,
      });
      const finalUrl = r.url || url;
      clearTimeout(t);
      return finalUrl;
    } catch (e) {
      clearTimeout(t);
      throw e;
    }
  };

  let finalUrl;
  try { finalUrl = await tryFetch(false); }
  catch (_e1) {
    // fallback variant
    finalUrl = await tryFetch(true);
  }

  videoCache.set(cacheKey, finalUrl, 60 * 1000); // 1 min, matches upstream TTL
  return finalUrl;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  /stream/:id  (legacy default = 360p) and /stream/:id/:quality             */
/*  /stream-redirect/:id?q=720p  – 302 to upstream                            */
/* ────────────────────────────────────────────────────────────────────────── */
app.get('/stream/:videoId/:quality?', async (req, res) => {
  const { videoId } = req.params;
  const quality = req.params.quality || '360p';
  if (!/^[A-Za-z0-9_-]{6,15}$/.test(videoId)) return res.status(400).type('text/plain').send('bad id');
  try {
    const backend = activeBackendFor(req);
    const url = await resolveStreamURL(videoId, quality, backend);
    // Return raw text URL (kept compatible with existing client code).
    res.type('text/plain').send(url);
    backend.ok = true; backend.lastError = null;
  } catch (e) {
    const bk = activeBackendFor(req);
    bk.ok = false; bk.lastError = e.message;
    console.error('[stream]', videoId, quality, e.message);
    res.status(502).type('text/plain').send('upstream error');
  }
});

// Convenience: 302 redirect so <video src> can hit it directly.
app.get('/redirect-stream/:videoId', async (req, res) => {
  try {
    const url = await resolveStreamURL(req.params.videoId, req.query.q || '360p', activeBackendFor(req));
    res.redirect(302, url);
  } catch (e) { res.status(502).send('upstream error'); }
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  /yt-sc/:id  – compact video data used internally by the watch page       */
/* ────────────────────────────────────────────────────────────────────────── */
app.get('/yt-sc/:videoId', async (req, res) => {
  try {
    const data = await fetchYtSc(req.params.videoId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Comments – paginated, loaded after the video.                             */
/* ────────────────────────────────────────────────────────────────────────── */
const commentContCache = new TinyCache(200);

async function fetchComments(videoId, continuation, sortBy = 'TOP_COMMENTS') {
  const yt = await getInnertube();
  if (!yt) return { commentCount: 0, comments: [], continuation: null };
  try {
    let resp;
    if (continuation) {
      // Resume an existing pager
      const pager = commentContCache.get(`${videoId}|${continuation}`);
      if (pager && pager.getContinuation) {
        resp = await pager.getContinuation();
      } else {
        resp = await yt.getComments(videoId, sortBy);
      }
    } else {
      resp = await yt.getComments(videoId, sortBy);
    }

    const list = (resp.contents || []).map(c => {
      const cm = c.comment || c;
      return {
        author: cm.author?.name || '',
        authorId: cm.author?.id || '',
        authorThumbnails: (cm.author?.thumbnails || []).map(t => t.url),
        verified: !!cm.author?.is_verified,
        authorIsChannelOwner: !!cm.author_is_channel_owner,
        content: (cm.content?.text) || (typeof cm.content === 'string' ? cm.content : ''),
        published: cm.published?.text || '',
        likeCount: parseInt(String(cm.vote_count?.text || '0').replace(/\D/g, ''), 10) || 0,
        replyCount: cm.reply_count || 0,
        commentId: cm.comment_id || '',
        isEdited: !!cm.is_edited,
        isPinned: !!cm.is_pinned,
      };
    });

    let cont = null;
    if (typeof resp.has_continuation !== 'undefined' ? resp.has_continuation : !!resp.continuation) {
      cont = Buffer.from(`${videoId}|${Date.now()}|${Math.random()}`).toString('base64url').slice(0, 32);
      commentContCache.set(`${videoId}|${cont}`, resp, 10 * 60 * 1000);
    }

    return {
      commentCount: resp.header?.comments_count?.text
                    ? parseInt(String(resp.header.comments_count.text).replace(/\D/g, ''), 10)
                    : list.length,
      videoId, comments: list, continuation: cont,
    };
  } catch (e) {
    console.error('[comments]', e.message);
    return { commentCount: 0, comments: [], continuation: null };
  }
}

app.get('/api/v1/comments/:id', async (req, res) => {
  const sort = (req.query.sort_by || 'top').toLowerCase() === 'new' ? 'NEWEST_FIRST' : 'TOP_COMMENTS';
  res.json(await fetchComments(req.params.id, req.query.continuation || null, sort));
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Search                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */
async function doSearch(q, page = 1, filters = {}) {
  const key = `${q}|${page}|${JSON.stringify(filters)}`;
  const hit = searchCache.get(key);
  if (hit) return hit;

  let items = [];
  let totalPages = 1;
  let nextpageToken = null;

  try {
    // youtube-search-api returns 'items' and 'nextPage' for continuation
    const result = await yts.GetListByKeyword(q, false, 30, [
      filters.type ? { type: filters.type } : null,
      filters.sort ? { sortBy: filters.sort } : null,
      filters.duration ? { duration: filters.duration } : null,
      filters.upload ? { upload: filters.upload } : null,
    ].filter(Boolean));

    items = result.items || [];
    nextpageToken = result.nextPage || null;

    // For page > 1, paginate using NextPage
    let currentToken = nextpageToken;
    for (let i = 2; i <= page && currentToken; i++) {
      const next = await yts.NextPage(currentToken, false, 30);
      items = next.items || [];
      currentToken = next.nextPage || null;
    }
    nextpageToken = currentToken;
  } catch (e) {
    console.error('[search]', e.message);
  }

  const norm = items.map(it => {
    if (it.type === 'video') {
      return {
        type: 'video',
        videoId: it.id,
        title: it.title,
        author: it.channelTitle || '',
        authorId: '',
        lengthSeconds: parseDur(it.length?.simpleText || ''),
        viewCount: parseInt(String(it.viewCount || it.shortViewCountText?.simpleText || '0').replace(/\D/g, ''), 10) || 0,
        publishedText: it.publishedTimeText || '',
        thumbnails: (it.thumbnail?.thumbnails || []).map(t => t.url),
        description: it.description || '',
      };
    } else if (it.type === 'channel') {
      return {
        type: 'channel',
        authorId: it.id, author: it.title,
        thumbnails: (it.thumbnail?.thumbnails || it.thumbnail || []).map(t => t.url || t),
        subCount: it.videoCount || '',
      };
    } else if (it.type === 'playlist') {
      return {
        type: 'playlist',
        playlistId: it.id, title: it.title, author: it.channelTitle || '',
        videoCount: it.length || 0,
        thumbnails: (it.thumbnail?.thumbnails || []).map(t => t.url),
      };
    }
    return null;
  }).filter(Boolean);

  const out = { items: norm, page, hasMore: !!nextpageToken, nextPageToken: nextpageToken };
  searchCache.set(key, out, 3 * 60 * 1000);
  return out;
}

app.get('/api/v1/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ items: [], page: 1, hasMore: false });
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const filters = {
    type: req.query.type, sort: req.query.sort,
    duration: req.query.duration, upload: req.query.date,
  };
  res.json(await doSearch(q, page, filters));
});

app.get('/api/v1/search/suggestions', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ query: '', suggestions: [] });
  try {
    const r = await fetch(`https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q)}`);
    const text = await r.text();
    const m = text.match(/\[.*\]/s);
    if (!m) return res.json({ query: q, suggestions: [] });
    const data = JSON.parse(m[0]);
    res.json({ query: q, suggestions: (data[1] || []).map(x => Array.isArray(x) ? x[0] : x) });
  } catch (e) { res.json({ query: q, suggestions: [] }); }
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Trending / Popular                                                        */
/* ────────────────────────────────────────────────────────────────────────── */
async function getTrending(type) {
  const key = `trending|${type || 'all'}`;
  const hit = trendingCache.get(key); if (hit) return hit;
  try {
    const r = await yts.GetTrendingVideo(false, 50);
    const out = (r.items || []).filter(it => it.type === 'video').map(it => ({
      type: 'video', videoId: it.id, title: it.title,
      author: it.channelTitle || '', authorId: '',
      lengthSeconds: parseDur(it.length?.simpleText || ''),
      viewCount: parseInt(String(it.viewCount || '0').replace(/\D/g, ''), 10) || 0,
      publishedText: it.publishedTimeText || '',
      thumbnails: (it.thumbnail?.thumbnails || []).map(t => t.url),
    }));
    trendingCache.set(key, out, 5 * 60 * 1000);
    return out;
  } catch (e) {
    console.error('[trending]', e.message);
    return [];
  }
}

app.get('/api/v1/trending', async (_req, res) => res.json(await getTrending()));
app.get('/api/v1/popular', async (_req, res) => res.json(await getTrending()));

/* ────────────────────────────────────────────────────────────────────────── */
/*  Channel                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */
async function getChannel(id, tab = 'videos') {
  const key = `${id}|${tab}`;
  const hit = channelCache.get(key); if (hit) return hit;

  const yt = await getInnertube();
  if (yt) {
    try {
      const c = await yt.getChannel(id);
      const meta = c.metadata || {};
      const header = c.header || {};
      const out = {
        authorId: meta.external_id || id,
        author: meta.title || header.author?.name || '',
        description: meta.description || '',
        thumbnails: (header.author?.thumbnails || meta.thumbnails || header.banner || []).map(t => t.url || t),
        banner: (header.banner || []).map(t => t.url),
        subCount: header.subscribers?.text || '',
        videoCount: header.videos_count?.text || '',
        tab, items: [],
      };
      let tabRes;
      if (tab === 'playlists' && c.getPlaylists)      tabRes = await c.getPlaylists();
      else if (tab === 'community' && c.getCommunity) tabRes = await c.getCommunity();
      else if (tab === 'about' && c.getAbout)         out.about = await c.getAbout();
      else if (tab === 'shorts' && c.getShorts)       tabRes = await c.getShorts();
      else                                            tabRes = c.videos ? { videos: c.videos } : c;

      if (tabRes) {
        const list = tabRes.videos || tabRes.playlists || tabRes.contents || [];
        out.items = list.map(it => {
          if (it.type === 'Video' || it.id) {
            return {
              type: 'video', videoId: it.id || it.video_id,
              title: it.title?.text || it.title || '',
              lengthSeconds: parseDur(it.length_text?.text || ''),
              viewCount: parseInt(String(it.view_count?.text || '0').replace(/\D/g, ''), 10) || 0,
              publishedText: it.published?.text || '',
              thumbnails: (it.thumbnails || []).map(t => t.url),
            };
          }
          if (it.type === 'Playlist') {
            return {
              type: 'playlist', playlistId: it.id,
              title: it.title?.text || '',
              videoCount: it.video_count_short?.text || '',
              thumbnails: (it.thumbnails || []).map(t => t.url),
            };
          }
          return null;
        }).filter(Boolean);
      }

      channelCache.set(key, out, 5 * 60 * 1000);
      return out;
    } catch (e) { console.warn('[channel innertube]', e.message); }
  }

  // Fallback – very small subset via youtube-search-api
  try {
    const r = await yts.GetChannelById(id);
    const out = {
      authorId: id,
      author: r?.metadata?.channelMetadataRenderer?.title || '',
      description: r?.metadata?.channelMetadataRenderer?.description || '',
      thumbnails: (r?.metadata?.channelMetadataRenderer?.avatar?.thumbnails || []).map(t => t.url),
      banner: [],
      subCount: '', videoCount: '', tab, items: [],
    };
    channelCache.set(key, out, 5 * 60 * 1000);
    return out;
  } catch (e) {
    return { authorId: id, author: id, description: '', thumbnails: [], items: [], tab };
  }
}

app.get('/api/v1/channels/:id', async (req, res) => {
  const tab = req.query.tab || 'videos';
  res.json(await getChannel(req.params.id, tab));
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Playlist                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */
async function getPlaylist(id) {
  const hit = playlistCache.get(id); if (hit) return hit;
  try {
    const r = await yts.GetPlaylistData(id, 100);
    const items = (r.items || []).map(it => ({
      type: 'video', videoId: it.id, title: it.title,
      author: it.shortBylineText?.runs?.[0]?.text || '',
      lengthSeconds: parseDur(it.length?.simpleText || ''),
      thumbnails: (it.thumbnail?.thumbnails || []).map(t => t.url),
    }));
    const out = {
      playlistId: id,
      title: r.metadata?.playlistMetadataRenderer?.title || '',
      description: r.metadata?.playlistMetadataRenderer?.description || '',
      videoCount: items.length, items,
    };
    playlistCache.set(id, out, 5 * 60 * 1000);
    return out;
  } catch (e) {
    return { playlistId: id, title: '', description: '', videoCount: 0, items: [] };
  }
}

app.get('/api/v1/playlists/:id', async (req, res) => res.json(await getPlaylist(req.params.id)));

/* ────────────────────────────────────────────────────────────────────────── */
/*  Backend switching                                                         */
/* ────────────────────────────────────────────────────────────────────────── */
app.get('/backend/switch/:id', (req, res) => {
  const id = req.params.id;
  if (!backendState.has(id)) return res.status(404).send('unknown backend');
  res.setHeader('Set-Cookie', `IV_BACKEND=${id}; Path=/; Max-Age=31536000; SameSite=Lax`);
  const to = req.headers.referer || '/';
  res.redirect(302, to);
});

app.get('/backend/status', (_req, res) => {
  res.json([...backendState.values()].map(b => ({
    id: b.id, label: b.label, region: b.region,
    priority: b.priority, ok: b.ok, lastError: b.lastError, inflight: b.inflight,
  })));
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Inline static assets                                                      */
/*  Note: we serve a small set of CSS files at the canonical Invidious paths  */
/*  /videojs/* and /css/* are proxied to jsdelivr so the page is fully usable */
/*  without bundling the assets in the repo.                                  */
/* ────────────────────────────────────────────────────────────────────────── */
const VENDOR = [
  // path, upstream
  ['/videojs/video.js/video-js.css',                                'https://cdn.jsdelivr.net/npm/video.js@8.12.0/dist/video-js.css'],
  ['/videojs/video.js/video.js',                                    'https://cdn.jsdelivr.net/npm/video.js@8.12.0/dist/video.min.js'],
  ['/videojs/videojs-http-source-selector/videojs-http-source-selector.css', 'https://cdn.jsdelivr.net/npm/videojs-http-source-selector@1.1.6/dist/videojs-http-source-selector.css'],
  ['/videojs/videojs-http-source-selector/videojs-http-source-selector.js',  'https://cdn.jsdelivr.net/npm/videojs-http-source-selector@1.1.6/dist/videojs-http-source-selector.min.js'],
  ['/videojs/videojs-contrib-quality-levels/videojs-contrib-quality-levels.js', 'https://cdn.jsdelivr.net/npm/videojs-contrib-quality-levels@4.0.0/dist/videojs-contrib-quality-levels.min.js'],
  ['/videojs/videojs-markers/videojs-markers.js',                   'https://cdn.jsdelivr.net/npm/videojs-markers-plugin@1.0.4/dist/videojs-markers-plugin.min.js'],
  ['/videojs/videojs-markers/videojs.markers.css',                  'https://cdn.jsdelivr.net/npm/videojs-markers-plugin@1.0.4/dist/videojs.markers.css'],
  ['/videojs/videojs-share/videojs-share.js',                       'https://cdn.jsdelivr.net/npm/videojs-share@3.1.1/dist/videojs-share.min.js'],
  ['/videojs/videojs-share/videojs-share.css',                      'https://cdn.jsdelivr.net/npm/videojs-share@3.1.1/dist/videojs-share.css'],
  ['/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css',    'https://cdn.jsdelivr.net/npm/videojs-vtt-thumbnails-freetube@0.0.15/dist/videojs-vtt-thumbnails.css'],
  ['/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.js',     'https://cdn.jsdelivr.net/npm/videojs-vtt-thumbnails-freetube@0.0.15/dist/videojs-vtt-thumbnails.min.js'],
  ['/videojs/videojs-mobile-ui/videojs-mobile-ui.css',              'https://cdn.jsdelivr.net/npm/videojs-mobile-ui@1.1.1/dist/videojs-mobile-ui.css'],
  ['/videojs/videojs-mobile-ui/videojs-mobile-ui.js',               'https://cdn.jsdelivr.net/npm/videojs-mobile-ui@1.1.1/dist/videojs-mobile-ui.min.js'],
];

const vendorCache = new TinyCache(60);
for (const [p, upstream] of VENDOR) {
  app.get(p, async (_req, res) => {
    let body = vendorCache.get(p);
    if (!body) {
      try {
        const r = await fetch(upstream, { headers: { 'User-Agent': 'invidious-mini/' + VERSION } });
        const buf = Buffer.from(await r.arrayBuffer());
        body = buf;
        vendorCache.set(p, buf, 24 * 60 * 60 * 1000);
      } catch (e) {
        return res.status(502).send('vendor fetch failed: ' + e.message);
      }
    }
    if (p.endsWith('.css')) res.type('text/css');
    else if (p.endsWith('.js')) res.type('application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(body);
  });
}

/* ── Site CSS (player.css / default.css) inlined ───────────────────────── */
const SITE_CSS = `
/* default.css ------------------------------------------------------------ */
:root{
  --bg:#fafafa; --bg-2:#ffffff; --fg:#222; --muted:#666; --line:#e4e4e4;
  --brand:#8b8b8b; --accent:#d99058; --hover:#f1f1f1; --link:#5a5a5a;
}
@media (prefers-color-scheme: dark){
  :root.auto{
    --bg:#1a1a1a; --bg-2:#222; --fg:#e5e5e5; --muted:#9a9a9a; --line:#333;
    --brand:#9a9a9a; --accent:#d99058; --hover:#2a2a2a; --link:#bbb;
  }
}
:root.dark{
  --bg:#1a1a1a; --bg-2:#222; --fg:#e5e5e5; --muted:#9a9a9a; --line:#333;
  --brand:#9a9a9a; --accent:#d99058; --hover:#2a2a2a; --link:#bbb;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);
  font:14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, sans-serif}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline}
.navbar{display:flex;align-items:center;gap:14px;padding:14px 22px;background:var(--bg);
  border-bottom:1px solid var(--line);font-size:13px}
.navbar .brand{font-weight:800;color:var(--fg);letter-spacing:.4px}
.navbar .switch-backend{color:var(--muted)}
.navbar .switch-backend a{margin:0 2px}
.navbar .switch-backend a.active{font-weight:700;text-decoration:underline}
.navbar .led{display:inline-block;width:3px;height:11px;background:#3aaf57;margin:0 6px 0 1px;vertical-align:middle;border-radius:1px}
.navbar .led.bad{background:#c04040}
.navbar .icons{margin-left:auto;display:flex;gap:14px;align-items:center}
.navbar .icons a{color:var(--muted);display:inline-flex}
.navbar .icons a:hover{color:var(--fg)}
.subnav{display:flex;justify-content:center;gap:34px;padding:14px;border-bottom:1px solid var(--line);background:var(--bg)}
.subnav a{color:var(--muted);font-size:14px}
.subnav a.active{color:var(--fg);font-weight:600}

.hero{display:flex;flex-direction:column;align-items:center;padding:80px 20px 30px}
.hero h1{font-size:56px;font-weight:800;letter-spacing:2px;color:var(--brand);margin:0 0 30px}
.search{width:min(640px,90%);position:relative}
.search input{width:100%;padding:10px 38px 10px 8px;border:none;
  border-bottom:1px solid var(--accent);background:transparent;color:var(--fg);
  font-size:16px;outline:none}
.search input:focus{border-bottom-color:var(--accent)}
.search button{position:absolute;right:4px;top:50%;transform:translateY(-50%);
  background:none;border:none;cursor:pointer;color:var(--muted);padding:4px}
.search button:hover{color:var(--fg)}
.search button svg{display:block}

.container{max-width:1280px;margin:0 auto;padding:18px 22px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}
.card{background:var(--bg-2);border:1px solid var(--line);border-radius:6px;overflow:hidden;
  transition:transform .12s ease, box-shadow .12s ease}
.card:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.06)}
.card .thumb{position:relative;aspect-ratio:16/9;background:#000;overflow:hidden}
.card .thumb img{width:100%;height:100%;object-fit:cover;display:block}
.card .thumb .dur{position:absolute;right:6px;bottom:6px;background:rgba(0,0,0,.78);
  color:#fff;padding:1px 5px;border-radius:3px;font-size:11px;font-weight:600}
.card .meta{padding:10px 12px}
.card .meta .title{color:var(--fg);font-weight:600;font-size:13.5px;line-height:1.35;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  min-height:2.7em}
.card .meta .author{color:var(--muted);font-size:12px;margin-top:6px}
.card .meta .stats{color:var(--muted);font-size:11.5px;margin-top:3px}

/* player.css ------------------------------------------------------------- */
.watch{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;
  max-width:1480px;margin:0 auto;padding:18px 22px}
@media (max-width:980px){.watch{grid-template-columns:1fr}}
.player-wrap{background:#000;border-radius:6px;overflow:hidden}
.video-js{width:100%;aspect-ratio:16/9;height:auto}
.below-player{padding:14px 4px}
.video-title{font-size:20px;font-weight:600;margin:6px 0 8px;color:var(--fg)}
.video-stats{display:flex;flex-wrap:wrap;gap:14px;color:var(--muted);font-size:13px;margin-bottom:10px}
.video-stats .author{color:var(--fg);font-weight:600}
.video-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 14px}
.btn{background:var(--bg-2);border:1px solid var(--line);color:var(--fg);
  border-radius:18px;padding:6px 14px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.btn:hover{background:var(--hover)}
.btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.btn.primary:hover{filter:brightness(.95)}
.description{background:var(--bg-2);border:1px solid var(--line);border-radius:6px;
  padding:12px 14px;color:var(--fg);white-space:pre-wrap;font-size:13px;line-height:1.6;
  max-height:160px;overflow:hidden;position:relative;transition:max-height .2s ease}
.description.expanded{max-height:none}
.description .toggle{display:inline-block;margin-top:8px;color:var(--link);cursor:pointer;font-weight:600}
.related{display:flex;flex-direction:column;gap:10px}
.related .r-card{display:grid;grid-template-columns:168px 1fr;gap:10px;
  background:var(--bg-2);border:1px solid var(--line);border-radius:6px;overflow:hidden}
.related .r-card .thumb{aspect-ratio:16/9}
.related .r-card .t{padding:6px 8px}
.related .r-card .t .title{font-size:12.5px;font-weight:600;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.related .r-card .t .a{color:var(--muted);font-size:11.5px;margin-top:4px}

/* comments --------------------------------------------------------------- */
.comments-section{margin-top:18px}
.comments-section h3{margin:6px 0 12px;font-size:15px}
.comment{display:grid;grid-template-columns:42px 1fr;gap:10px;margin:10px 0}
.comment .avatar{width:42px;height:42px;border-radius:50%;overflow:hidden;background:#ccc}
.comment .avatar img{width:100%;height:100%;object-fit:cover}
.comment .body{font-size:13px}
.comment .body .top{color:var(--muted);font-size:12px;margin-bottom:3px}
.comment .body .top b{color:var(--fg);margin-right:6px}
.comment .body .text{white-space:pre-wrap;color:var(--fg)}
.comment .body .foot{color:var(--muted);font-size:11.5px;margin-top:4px}
.load-more{display:block;margin:14px auto;background:none;border:1px solid var(--line);
  color:var(--link);padding:8px 18px;border-radius:18px;cursor:pointer}
.load-more:hover{background:var(--hover)}

/* channel ---------------------------------------------------------------- */
.channel-header{display:flex;align-items:center;gap:18px;padding:20px 0;border-bottom:1px solid var(--line)}
.channel-header .avatar{width:96px;height:96px;border-radius:50%;overflow:hidden;background:#ccc;flex-shrink:0}
.channel-header .avatar img{width:100%;height:100%;object-fit:cover}
.channel-header h1{margin:0 0 6px;font-size:22px}
.channel-header .sub{color:var(--muted);font-size:13px}
.channel-tabs{display:flex;gap:24px;padding:14px 0;border-bottom:1px solid var(--line);margin-bottom:20px}
.channel-tabs a{color:var(--muted);font-weight:600;font-size:13px;padding:4px 0}
.channel-tabs a.active{color:var(--fg);border-bottom:2px solid var(--accent)}

/* prefs ------------------------------------------------------------------ */
.prefs{max-width:780px;margin:24px auto;padding:0 22px}
.prefs h1{margin:0 0 18px;font-size:22px}
.prefs fieldset{border:1px solid var(--line);padding:14px 16px;border-radius:6px;margin-bottom:14px;background:var(--bg-2)}
.prefs legend{padding:0 6px;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.6px}
.prefs label{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:13.5px}
.prefs select,.prefs input[type=number],.prefs input[type=text]{
  background:var(--bg);border:1px solid var(--line);color:var(--fg);padding:5px 8px;border-radius:4px}
.prefs .row{display:flex;gap:14px;flex-wrap:wrap}
.prefs button.save{background:var(--accent);color:#fff;border:none;border-radius:18px;padding:8px 22px;cursor:pointer}

footer{margin:30px 0 18px;color:var(--muted);text-align:center;font-size:12px}
footer a{color:var(--muted)}
.pagination{display:flex;justify-content:center;gap:8px;margin:22px 0}
.pagination a{padding:6px 12px;border:1px solid var(--line);border-radius:4px;color:var(--link)}
.pagination a.disabled{opacity:.4;pointer-events:none}
`;

app.get('/css/default.css', (_req, res) => {
  res.type('text/css').setHeader('Cache-Control', 'public, max-age=86400').send(SITE_CSS);
});
app.get('/css/player.css', (_req, res) => {
  res.type('text/css').setHeader('Cache-Control', 'public, max-age=86400').send(SITE_CSS);
});

/* ── Inline client JS for the watch page ─────────────────────────────── */
const PLAYER_JS = `
(function(){
  var videoId = window.__videoId;
  if(!videoId) return;
  var videoEl = document.getElementById('player');
  if(!videoEl) return;

  function streamURL(q){ return '/redirect-stream/' + videoId + '?q=' + q; }

  var player = videojs(videoEl, {
    controls:true, autoplay:false, preload:'auto', fluid:true,
    playbackRates:[0.25,0.5,0.75,1,1.25,1.5,1.75,2],
    html5:{ vhs:{ overrideNative:false }, nativeAudioTracks:true, nativeVideoTracks:true }
  });

  // Source quality switcher: 360p is the only stream that has audio.
  // 720p/1080p are video-only and are synced with a hidden <audio> track
  // playing the 360p source.  This keeps high-resolution playback usable.
  var qualities = [
    { label:'360p', value:'360p', videoOnly:false },
    { label:'720p', value:'720p', videoOnly:true  },
    { label:'1080p',value:'1080p',videoOnly:true  },
  ];

  var audioEl = document.createElement('audio');
  audioEl.id = 'sync-audio'; audioEl.preload='auto'; audioEl.style.display='none';
  audioEl.src = streamURL('360p');
  document.body.appendChild(audioEl);

  var currentQ = (window.__defaultQuality || '360p');

  function applyQuality(q){
    currentQ = q;
    var qDef = qualities.find(x => x.value === q) || qualities[0];
    var t = player.currentTime();
    var wasPaused = player.paused();
    player.src({ src: streamURL(q), type:'video/mp4' });
    player.one('loadedmetadata', function(){
      try { player.currentTime(t); } catch(e){}
      if(!wasPaused) player.play();
      syncAudio(qDef.videoOnly);
    });
    localStorage.setItem('iv_quality', q);
  }

  function syncAudio(useExternal){
    if(useExternal){
      try { audioEl.currentTime = player.currentTime(); } catch(e){}
      audioEl.muted = false; audioEl.volume = player.volume();
      player.muted(true);
      if(!player.paused()) audioEl.play().catch(()=>{});
    } else {
      audioEl.pause(); audioEl.muted = true;
      player.muted(false);
    }
  }

  player.on('play',  function(){ if(currentQ !== '360p') audioEl.play().catch(()=>{}); });
  player.on('pause', function(){ audioEl.pause(); });
  player.on('seeked',function(){ try{ audioEl.currentTime = player.currentTime(); }catch(e){} });
  player.on('ratechange', function(){ try{ audioEl.playbackRate = player.playbackRate(); }catch(e){} });
  player.on('volumechange', function(){
    audioEl.volume = player.volume();
    if(currentQ === '360p') audioEl.muted = true;
  });
  // Drift correction
  setInterval(function(){
    if(currentQ === '360p') return;
    var drift = audioEl.currentTime - player.currentTime();
    if(Math.abs(drift) > 0.35){ try{ audioEl.currentTime = player.currentTime(); }catch(e){} }
  }, 1500);

  // Quality selector UI
  var Button = videojs.getComponent('Button');
  function QualityMenu(){ Button.apply(this, arguments); }
  videojs.extend(QualityMenu, Button);
  QualityMenu.prototype.buildCSSClass = function(){ return 'vjs-quality-button vjs-control vjs-button'; };
  QualityMenu.prototype.createEl = function(){
    var el = videojs.dom.createEl('div', { className: 'vjs-quality-button vjs-menu-button vjs-menu-button-popup vjs-control vjs-button' });
    var span = videojs.dom.createEl('span', { className: 'vjs-icon-placeholder', innerHTML: '<span style="font-size:11px;font-weight:700;letter-spacing:.5px">'+currentQ+'</span>' });
    el.appendChild(span);
    var menu = videojs.dom.createEl('div', { className: 'vjs-menu' });
    var ul   = videojs.dom.createEl('ul',  { className: 'vjs-menu-content' });
    qualities.forEach(function(q){
      var li = videojs.dom.createEl('li', { className: 'vjs-menu-item', innerHTML: q.label });
      li.onclick = function(){ applyQuality(q.value); span.firstChild.textContent = q.value; };
      ul.appendChild(li);
    });
    menu.appendChild(ul); el.appendChild(menu);
    return el;
  };
  videojs.registerComponent('QualityMenu', QualityMenu);
  player.getChild('controlBar').addChild('QualityMenu', {}, player.getChild('controlBar').children().length - 2);

  // Init
  applyQuality(localStorage.getItem('iv_quality') || currentQ);

  /* ─ Comments lazy loader ─ */
  var commentsHost = document.getElementById('comments');
  if(commentsHost){
    var loading = false, continuation = null, count = null;
    function render(items){
      var html = items.map(function(c){
        var avatar = (c.authorThumbnails && c.authorThumbnails[0]) || '';
        return '<div class="comment">'
          + '<div class="avatar">'+ (avatar ? '<img src="'+avatar+'" loading="lazy">' : '') +'</div>'
          + '<div class="body"><div class="top"><b>'+ escapeHtml(c.author) +'</b>'+ escapeHtml(c.published||'') +'</div>'
          + '<div class="text">'+ escapeHtml(c.content) +'</div>'
          + '<div class="foot">👍 '+ (c.likeCount||0) +(c.replyCount?'  ·  '+c.replyCount+' replies':'') +'</div></div></div>';
      }).join('');
      commentsHost.querySelector('.comments-list').insertAdjacentHTML('beforeend', html);
    }
    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, function(m){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
    }); }
    function load(){
      if(loading) return; loading = true;
      var url = '/api/v1/comments/' + videoId + (continuation ? '?continuation='+continuation : '');
      fetch(url).then(function(r){return r.json();}).then(function(data){
        loading = false;
        if(count === null){
          count = data.commentCount || 0;
          commentsHost.querySelector('h3').textContent = (count.toLocaleString()) + ' Comments';
        }
        render(data.comments || []);
        continuation = data.continuation;
        var btn = commentsHost.querySelector('.load-more');
        if(!continuation && btn) btn.remove();
      }).catch(function(){ loading = false; });
    }
    // Defer until video has had a chance to start
    setTimeout(load, 800);
    commentsHost.addEventListener('click', function(e){
      if(e.target && e.target.classList.contains('load-more')) load();
    });
  }
})();
`;

app.get('/js/player.js', (_req, res) => {
  res.type('application/javascript').setHeader('Cache-Control', 'public, max-age=86400').send(PLAYER_JS);
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Layout + page rendering                                                   */
/* ────────────────────────────────────────────────────────────────────────── */
function svgIcon(name) {
  switch (name) {
    case 'search': return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
    case 'moon':   return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    case 'gear':   return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  }
  return '';
}

function layout({ title, body, active, prefs, activeBackend, extraHead = '' }) {
  const dark = prefs.dark_mode ? 'dark' : 'auto';
  const switchBackend = BACKENDS.map(b => {
    const st = backendState.get(b.id);
    const cls = (activeBackend && activeBackend.id === b.id) ? 'active' : '';
    return `<a href="/backend/switch/${b.id}" class="${cls}">${esc(b.label)}</a><span class="led ${st.ok ? '' : 'bad'}"></span>`;
  }).join(' | ');

  return `<!doctype html>
<html lang="ja" class="${dark}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - Invidious</title>
<link rel="icon" href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='30' fill='%238b8b8b'/><text x='50%25' y='55%25' text-anchor='middle' fill='%23fff' font-family='sans-serif' font-size='28' font-weight='bold'>I</text></svg>">
<link rel="stylesheet" href="/css/default.css?v=${BUILD}">
<link rel="stylesheet" href="/css/player.css?v=${BUILD}">
${extraHead}
</head>
<body>
<header class="navbar">
  <span class="brand">Switch backend:</span>
  <span class="switch-backend">${switchBackend}</span>
  <span class="icons">
    <a href="#" id="theme-toggle" title="Theme">${svgIcon('moon')}</a>
    <a href="/preferences" title="Preferences">${svgIcon('gear')}</a>
    <a href="/login">ログイン</a>
  </span>
</header>
<nav class="subnav">
  <a href="/feed/popular" class="${active==='popular'?'active':''}">人気</a>
  <a href="/feed/trending" class="${active==='trending'?'active':''}">急上昇</a>
</nav>
${body}
<footer>
  <a href="/licenses">Released under the AGPLv3</a> · <a href="/privacy">Privacy Policy</a> · <a href="https://docs.invidious.io">Documentation</a>
</footer>
<script>
(function(){
  var t = document.getElementById('theme-toggle');
  if(!t) return;
  t.addEventListener('click', function(e){
    e.preventDefault();
    var cl = document.documentElement.classList;
    if(cl.contains('dark')){ cl.remove('dark'); cl.add('auto'); document.cookie='IV_THEME=auto;path=/;max-age=31536000'; }
    else { cl.remove('auto'); cl.add('dark'); document.cookie='IV_THEME=dark;path=/;max-age=31536000'; }
  });
})();
</script>
</body></html>`;
}

function videoCard(v) {
  const thumb = (v.thumbnails && v.thumbnails[0]) || ytThumb(v.videoId, 'mqdefault');
  return `<a class="card" href="/watch?v=${esc(v.videoId)}">
    <div class="thumb"><img loading="lazy" src="${esc(thumb)}" alt="">${v.lengthSeconds ? `<span class="dur">${durFmt(v.lengthSeconds)}</span>` : ''}</div>
    <div class="meta">
      <div class="title">${esc(v.title)}</div>
      <div class="author">${esc(v.author || '')}</div>
      <div class="stats">${v.viewCount ? nFmt(v.viewCount) + ' views' : ''}${v.publishedText ? ' · ' + esc(v.publishedText) : ''}</div>
    </div>
  </a>`;
}

function channelCard(c) {
  const thumb = (c.thumbnails && c.thumbnails[0]) || '';
  return `<a class="card" href="/channel/${esc(c.authorId)}">
    <div class="thumb" style="aspect-ratio:1/1;background:#ddd"><img loading="lazy" src="${esc(thumb)}" alt=""></div>
    <div class="meta"><div class="title">${esc(c.author)}</div><div class="stats">${esc(c.subCount || '')}</div></div>
  </a>`;
}

function playlistCard(p) {
  const thumb = (p.thumbnails && p.thumbnails[0]) || '';
  return `<a class="card" href="/playlist?list=${esc(p.playlistId)}">
    <div class="thumb"><img loading="lazy" src="${esc(thumb)}" alt=""><span class="dur">${esc(String(p.videoCount || ''))} videos</span></div>
    <div class="meta"><div class="title">${esc(p.title)}</div><div class="author">${esc(p.author || '')}</div></div>
  </a>`;
}

function renderItems(items) {
  return items.map(it => {
    if (it.type === 'video') return videoCard(it);
    if (it.type === 'channel') return channelCard(it);
    if (it.type === 'playlist') return playlistCard(it);
    return '';
  }).join('');
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Pages                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */
app.get('/', (req, res) => {
  if (req.prefs.redirect_feed) return res.redirect('/feed/subscriptions');
  const activeBackend = activeBackendFor(req);
  const body = `
<main class="hero">
  <h1>INVIDIOUS</h1>
  <form class="search" action="/search" method="get" role="search">
    <input type="search" name="q" placeholder="検索" autocomplete="off" autofocus>
    <button type="submit" aria-label="Search">${svgIcon('search')}</button>
  </form>
</main>`;
  res.type('html').send(layout({ title: 'Invidious', body, active: '', prefs: req.prefs, activeBackend }));
});

app.get(['/feed/popular', '/feed/trending'], async (req, res) => {
  const activeBackend = activeBackendFor(req);
  const items = await getTrending();
  const body = `<section class="container"><div class="grid">${renderItems(items)}</div></section>`;
  res.type('html').send(layout({
    title: req.path.endsWith('popular') ? '人気' : '急上昇',
    body, active: req.path.endsWith('popular') ? 'popular' : 'trending',
    prefs: req.prefs, activeBackend,
  }));
});

app.get('/search', async (req, res) => {
  const activeBackend = activeBackendFor(req);
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const filters = {
    type: req.query.type, sort: req.query.sort,
    duration: req.query.duration, upload: req.query.date,
  };
  const data = q ? await doSearch(q, page, filters) : { items: [], page: 1, hasMore: false };
  const queryString = (params) => {
    const u = new URLSearchParams({ q, ...filters, ...params });
    Object.keys(filters).forEach(k => { if (!filters[k]) u.delete(k); });
    return u.toString();
  };
  const body = `
<section class="container">
  <form action="/search" method="get" class="search" style="margin:8px auto 20px">
    <input type="search" name="q" value="${esc(q)}" placeholder="検索">
    <button type="submit" aria-label="Search">${svgIcon('search')}</button>
  </form>
  <div style="display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:13px;margin:6px 0 18px">
    <label>Type:
      <select onchange="location.href='/search?'+ new URLSearchParams({q:'${esc(q)}',type:this.value}).toString()">
        ${['','video','channel','playlist','movie'].map(t => `<option value="${t}" ${filters.type===t?'selected':''}>${t||'all'}</option>`).join('')}
      </select>
    </label>
    <label>Sort:
      <select onchange="location.href='/search?'+ new URLSearchParams({q:'${esc(q)}',sort:this.value}).toString()">
        ${['','relevance','rating','upload_date','view_count'].map(t => `<option value="${t}" ${filters.sort===t?'selected':''}>${t||'relevance'}</option>`).join('')}
      </select>
    </label>
  </div>
  <div class="grid">${renderItems(data.items)}</div>
  <div class="pagination">
    <a class="${page<=1?'disabled':''}" href="/search?${queryString({page:page-1})}">← Prev</a>
    <span style="padding:6px 12px">Page ${page}</span>
    <a class="${!data.hasMore?'disabled':''}" href="/search?${queryString({page:page+1})}">Next →</a>
  </div>
</section>`;
  res.type('html').send(layout({ title: q ? `Search: ${q}` : 'Search', body, prefs: req.prefs, activeBackend }));
});

app.get('/watch', async (req, res) => {
  const id = String(req.query.v || '').trim();
  if (!/^[A-Za-z0-9_-]{6,15}$/.test(id)) return res.status(400).send('bad video id');
  const activeBackend = activeBackendFor(req);
  const data = await fetchYtSc(id);
  const defaultQuality = req.prefs.quality === 'dash' ? '1080p' : (req.prefs.quality === 'hd720' ? '720p' : '360p');
  const extraHead = `
<link rel="stylesheet" href="/videojs/video.js/video-js.css?v=${BUILD}">
<link rel="stylesheet" href="/videojs/videojs-http-source-selector/videojs-http-source-selector.css?v=${BUILD}">
<link rel="stylesheet" href="/videojs/videojs-markers/videojs.markers.css?v=${BUILD}">
<link rel="stylesheet" href="/videojs/videojs-share/videojs-share.css?v=${BUILD}">
<link rel="stylesheet" href="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css?v=${BUILD}">
<link rel="stylesheet" href="/videojs/videojs-mobile-ui/videojs-mobile-ui.css?v=${BUILD}">
<link rel="stylesheet" href="/css/player.css?v=${BUILD}">

<script src="/videojs/video.js/video.js?v=${BUILD}"></script>
<script src="/videojs/videojs-mobile-ui/videojs-mobile-ui.js?v=${BUILD}"></script>
<script src="/videojs/videojs-contrib-quality-levels/videojs-contrib-quality-levels.js?v=${BUILD}"></script>
<script src="/videojs/videojs-http-source-selector/videojs-http-source-selector.js?v=${BUILD}"></script>
<script src="/videojs/videojs-markers/videojs-markers.js?v=${BUILD}"></script>
<script src="/videojs/videojs-share/videojs-share.js?v=${BUILD}"></script>
<script src="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.js?v=${BUILD}"></script>`;

  const related = (data.related || []).slice(0, 20).map(r => `
    <a class="r-card" href="/watch?v=${esc(r.videoId)}">
      <div class="thumb"><img loading="lazy" src="${esc((r.thumbnails && r.thumbnails[0]) || ytThumb(r.videoId))}" alt="">${r.lengthSeconds ? `<span class="dur">${durFmt(r.lengthSeconds)}</span>` : ''}</div>
      <div class="t"><div class="title">${esc(r.title)}</div><div class="a">${esc(r.author || '')}</div></div>
    </a>`).join('');

  const poster = (data.thumbnails && data.thumbnails[data.thumbnails.length - 1]?.url) || ytThumb(id, 'maxresdefault');

  const body = `
<main class="watch">
  <div>
    <div class="player-wrap">
      <video id="player" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto"
             poster="${esc(poster)}">
        <source src="/redirect-stream/${esc(id)}?q=${defaultQuality}" type="video/mp4">
      </video>
    </div>
    <div class="below-player">
      <h1 class="video-title">${esc(data.title)}</h1>
      <div class="video-stats">
        <a class="author" href="/channel/${esc(data.authorId)}">${esc(data.author || '')}</a>
        <span>${nFmt(data.viewCount)} views</span>
        ${data.published ? `<span>${esc(data.published)}</span>` : ''}
        ${data.likeCount ? `<span>👍 ${nFmt(data.likeCount)}</span>` : ''}
      </div>
      <div class="video-actions">
        <button class="btn primary">Subscribe</button>
        <button class="btn">👍 Like</button>
        <button class="btn">👎 Dislike</button>
        <button class="btn" onclick="navigator.share && navigator.share({url:location.href,title:document.title}).catch(()=>{})">Share</button>
        <button class="btn" onclick="navigator.clipboard.writeText(location.href);this.textContent='Copied!'">Copy link</button>
        <a class="btn" href="/redirect-stream/${esc(id)}?q=360p" download>Download 360p</a>
        <a class="btn" href="/redirect-stream/${esc(id)}?q=720p" download>Download 720p</a>
        <a class="btn" href="/redirect-stream/${esc(id)}?q=1080p" download>Download 1080p</a>
      </div>
      <div class="description" id="desc">
        ${esc(data.description || '')}
        <div class="toggle" onclick="document.getElementById('desc').classList.toggle('expanded');this.textContent=this.textContent==='Show more'?'Show less':'Show more'">Show more</div>
      </div>

      <section class="comments-section" id="comments">
        <h3>Loading comments…</h3>
        <div class="comments-list"></div>
        <button class="load-more">Load more comments</button>
      </section>
    </div>
  </div>

  <aside>
    <div class="related">${related}</div>
  </aside>
</main>
<script>
  window.__videoId = ${JSON.stringify(id)};
  window.__defaultQuality = ${JSON.stringify(defaultQuality)};
</script>
<script src="/js/player.js?v=${BUILD}"></script>`;
  res.type('html').send(layout({ title: data.title || 'Watch', body, prefs: req.prefs, activeBackend, extraHead }));
});

app.get('/embed/:id', async (req, res) => {
  const id = req.params.id;
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Embed</title>
<link rel="stylesheet" href="/videojs/video.js/video-js.css?v=${BUILD}">
<script src="/videojs/video.js/video.js?v=${BUILD}"></script>
<style>html,body{margin:0;height:100%;background:#000}#p{width:100%;height:100%}</style></head><body>
<video id="p" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto" autoplay>
  <source src="/redirect-stream/${esc(id)}?q=360p" type="video/mp4">
</video>
<script>videojs('p',{fluid:false,fill:true,controls:true,autoplay:true});</script>
</body></html>`);
});

app.get('/channel/:id/:tab?', async (req, res) => {
  const activeBackend = activeBackendFor(req);
  const tab = req.params.tab || 'videos';
  const data = await getChannel(req.params.id, tab);
  const tabs = ['videos', 'shorts', 'playlists', 'community', 'about'];
  const body = `
<section class="container">
  <header class="channel-header">
    <div class="avatar">${data.thumbnails[0] ? `<img src="${esc(data.thumbnails[0])}" alt="">` : ''}</div>
    <div>
      <h1>${esc(data.author)}</h1>
      <div class="sub">${esc(data.subCount || '')} ${data.videoCount ? '· ' + esc(data.videoCount) + ' videos' : ''}</div>
      <button class="btn primary" style="margin-top:8px">Subscribe</button>
    </div>
  </header>
  <nav class="channel-tabs">
    ${tabs.map(t => `<a class="${tab===t?'active':''}" href="/channel/${esc(req.params.id)}/${t}">${t}</a>`).join('')}
    <a href="/feed/channel/${esc(req.params.id)}" style="margin-left:auto">RSS</a>
  </nav>
  ${tab === 'about' ? `<div class="description expanded">${esc(data.description || '')}</div>`
    : `<div class="grid">${renderItems(data.items)}</div>`}
</section>`;
  res.type('html').send(layout({ title: data.author || 'Channel', body, prefs: req.prefs, activeBackend }));
});

app.get('/playlist', async (req, res) => {
  const activeBackend = activeBackendFor(req);
  const id = String(req.query.list || '');
  const data = await getPlaylist(id);
  const body = `
<section class="container">
  <h1 style="margin:8px 0">${esc(data.title || 'Playlist')}</h1>
  <div style="color:var(--muted);margin-bottom:14px">${esc(String(data.videoCount || 0))} videos</div>
  <div class="description">${esc(data.description || '')}</div>
  <div class="grid" style="margin-top:18px">${renderItems(data.items)}</div>
</section>`;
  res.type('html').send(layout({ title: data.title || 'Playlist', body, prefs: req.prefs, activeBackend }));
});

app.get('/hashtag/:tag', async (req, res) => {
  const activeBackend = activeBackendFor(req);
  const tag = req.params.tag;
  const data = await doSearch('#' + tag, 1, {});
  const body = `
<section class="container">
  <h1>#${esc(tag)}</h1>
  <div class="grid">${renderItems(data.items)}</div>
</section>`;
  res.type('html').send(layout({ title: '#' + tag, body, prefs: req.prefs, activeBackend }));
});

/* ── Preferences ─────────────────────────────────────────────────── */
app.get('/preferences', (req, res) => {
  const activeBackend = activeBackendFor(req);
  const p = req.prefs;
  const checked = (v) => v ? 'checked' : '';
  const body = `
<form class="prefs" method="post" action="/preferences">
  <h1>Preferences</h1>

  <fieldset><legend>Player</legend>
    <label><input type="checkbox" name="video_loop" ${checked(p.video_loop)}> Always loop</label>
    <label><input type="checkbox" name="autoplay" ${checked(p.autoplay)}> Autoplay current video</label>
    <label><input type="checkbox" name="continue" ${checked(p.continue)}> Load next video when current finishes</label>
    <label><input type="checkbox" name="continue_autoplay" ${checked(p.continue_autoplay)}> Load and autoplay next video</label>
    <label><input type="checkbox" name="listen" ${checked(p.listen)}> Audio-only mode by default</label>
    <label><input type="checkbox" name="annotations" ${checked(p.annotations)}> Show annotations</label>
    <label>Default quality
      <select name="quality">
        ${['small','medium','hd720','dash'].map(q => `<option value="${q}" ${p.quality===q?'selected':''}>${q}</option>`).join('')}
      </select>
    </label>
    <label>Default speed
      <select name="speed">
        ${[0.5,0.75,1,1.25,1.5,2].map(s => `<option value="${s}" ${String(p.speed)===String(s)?'selected':''}>${s}×</option>`).join('')}
      </select>
    </label>
    <label>Default volume
      <input type="number" name="volume" min="0" max="100" value="${esc(String(p.volume ?? 100))}">
    </label>
    <label>Player style
      <select name="player_style">
        <option value="invidious" ${p.player_style==='invidious'?'selected':''}>Invidious</option>
        <option value="youtube"   ${p.player_style==='youtube'?'selected':''}>YouTube</option>
      </select>
    </label>
  </fieldset>

  <fieldset><legend>Visual</legend>
    <label><input type="checkbox" name="dark_mode" ${checked(p.dark_mode)}> Dark mode</label>
    <label><input type="checkbox" name="thin_mode" ${checked(p.thin_mode)}> Thin mode (no thumbnails)</label>
    <label>Locale
      <select name="locale">
        ${['en-US','ja-JP','de-DE','es-ES','fr-FR','zh-CN'].map(l => `<option value="${l}" ${p.locale===l?'selected':''}>${l}</option>`).join('')}
      </select>
    </label>
  </fieldset>

  <fieldset><legend>Subscriptions</legend>
    <label><input type="checkbox" name="related_videos" ${checked(p.related_videos !== false)}> Show related videos</label>
    <label><input type="checkbox" name="redirect_feed" ${checked(p.redirect_feed)}> Redirect homepage to subscription feed</label>
    <label>Max results
      <input type="number" name="max_results" min="1" max="200" value="${esc(String(p.max_results ?? 40))}">
    </label>
  </fieldset>

  <fieldset><legend>Comments</legend>
    <label>Default source
      <select name="comments">
        <option value="youtube" ${(p.comments?.[0]||'youtube')==='youtube'?'selected':''}>YouTube</option>
        <option value="reddit"  ${(p.comments?.[0]==='reddit')?'selected':''}>Reddit</option>
      </select>
    </label>
  </fieldset>

  <button type="submit" class="save">Save preferences</button>
</form>`;
  res.type('html').send(layout({ title: 'Preferences', body, prefs: req.prefs, activeBackend }));
});

app.post('/preferences', (req, res) => {
  const b = req.body || {};
  const next = {
    video_loop: !!b.video_loop,
    autoplay: !!b.autoplay,
    continue: !!b.continue,
    continue_autoplay: !!b.continue_autoplay,
    listen: !!b.listen,
    annotations: !!b.annotations,
    quality: b.quality || 'medium',
    speed: parseFloat(b.speed) || 1,
    volume: Math.max(0, Math.min(100, parseInt(b.volume, 10) || 100)),
    player_style: b.player_style || 'invidious',
    dark_mode: !!b.dark_mode,
    thin_mode: !!b.thin_mode,
    locale: b.locale || 'en-US',
    related_videos: !!b.related_videos,
    redirect_feed: !!b.redirect_feed,
    max_results: parseInt(b.max_results, 10) || 40,
    comments: [b.comments || 'youtube', ''],
  };
  res.setHeader('Set-Cookie',
    `PREFS=${encodeURIComponent(JSON.stringify(next))}; Path=/; Max-Age=31536000; SameSite=Lax`);
  res.redirect('/preferences');
});

/* ── Subscription feed (local only, cookie-backed) ──────────────────── */
app.get('/feed/subscriptions', (req, res) => {
  const activeBackend = activeBackendFor(req);
  res.type('html').send(layout({
    title: 'Subscriptions', active: '', prefs: req.prefs, activeBackend,
    body: `<section class="container"><h1>Subscriptions</h1>
      <p style="color:var(--muted)">No subscriptions yet. Visit any channel and click "Subscribe" to add it here.</p>
      <p><a href="/feed/popular">Browse popular videos →</a></p></section>`
  }));
});

app.get('/feed/channel/:id', async (req, res) => {
  const data = await getChannel(req.params.id, 'videos');
  res.type('application/rss+xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(data.author)}</title>
  <link>https://www.youtube.com/channel/${esc(req.params.id)}</link>
  <description>${esc(data.description || '')}</description>
  ${data.items.filter(i => i.type === 'video').map(v => `
  <item>
    <title>${esc(v.title)}</title>
    <link>https://www.youtube.com/watch?v=${esc(v.videoId)}</link>
    <guid isPermaLink="false">yt:video:${esc(v.videoId)}</guid>
    <pubDate>${new Date().toUTCString()}</pubDate>
    <description>${esc(v.title)}</description>
  </item>`).join('')}
</channel></rss>`);
});

/* ── Misc small pages ───────────────────────────────────────────────── */
app.get('/licenses', (req, res) => res.type('html').send(layout({
  title: 'Licenses', prefs: req.prefs, activeBackend: activeBackendFor(req),
  body: `<section class="container"><h1>Licenses</h1>
    <p>This software is released under the AGPLv3. It uses video.js (Apache-2.0), express (MIT), and other open source modules.</p></section>`
})));
app.get('/privacy', (req, res) => res.type('html').send(layout({
  title: 'Privacy', prefs: req.prefs, activeBackend: activeBackendFor(req),
  body: `<section class="container"><h1>Privacy</h1>
    <p>No tracking. No third-party analytics. Preferences are stored in a cookie named PREFS on your device only.</p></section>`
})));
app.get('/redirect', (req, res) => {
  const u = String(req.query.url || '');
  if (!/^https?:\/\//.test(u)) return res.redirect('/');
  res.redirect(u);
});
app.get('/login', (req, res) => res.type('html').send(layout({
  title: 'Login', prefs: req.prefs, activeBackend: activeBackendFor(req),
  body: `<section class="container" style="max-width:420px">
    <h1>Log in</h1>
    <form method="post" action="/login" class="prefs" style="padding:0">
      <label>Username <input name="username" type="text" required></label>
      <label>Password <input name="password" type="password" required></label>
      <button class="save" type="submit">Sign in</button>
    </form>
    <p style="color:var(--muted);font-size:12px;margin-top:14px">No real accounts on this instance. Preferences alone are saved via cookie.</p>
  </section>`
})));
app.post('/login', (_req, res) => res.redirect('/preferences'));

/* ────────────────────────────────────────────────────────────────────────── */
/*  404                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).type('html').send(layout({
    title: 'Not Found', prefs: req.prefs, activeBackend: activeBackendFor(req),
    body: `<section class="container" style="text-align:center;padding:60px 22px">
      <h1>404</h1><p style="color:var(--muted)">${esc(req.path)} was not found.</p>
      <p><a href="/">← Back to home</a></p></section>`
  }));
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Background backend health probe                                           */
/* ────────────────────────────────────────────────────────────────────────── */
async function probeBackend(b) {
  const probeId = 'dQw4w9WgXcQ'; // a public, always-available video
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(buildStreamURL(probeId, 2, false), {
      method: 'HEAD', redirect: 'follow', signal: ctrl.signal, dispatcher: b.agent,
      headers: { 'User-Agent': 'Mozilla/5.0 invidious-mini-healthz' },
    });
    clearTimeout(t);
    b.ok = r.status < 500;
    b.lastError = b.ok ? null : ('http ' + r.status);
  } catch (e) {
    clearTimeout(t);
    b.ok = false; b.lastError = e.message;
  }
}

setInterval(() => {
  for (const b of backendState.values()) probeBackend(b).catch(() => {});
}, 60 * 1000);

/* ────────────────────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Invidious ${VERSION} listening on :${PORT}`);
  // initial health probe in background
  for (const b of backendState.values()) probeBackend(b).catch(() => {});
});
