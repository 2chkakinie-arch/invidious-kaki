'use strict';

const express = require('express');
const yts = require('youtube-search-api');
const { fetch, Agent } = require('undici');

const app = express();


const VERSION = '5.0.0';

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
  } finally {
    clearTimeout(timer);
  }
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
  } finally {
    clearTimeout(timer);
  }
}



const sleep = ms => new Promise(r => setTimeout(r, ms));

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

  // 動画のサイズを読み取り、それに合ったソースで動画を取得する。サーバーの負荷を下げるためにInnerから取得
  const abbrevMatch = str.match(/^([\d,.]+)\s*([KMBkmb])/);
  if (abbrevMatch) {
    const num = parseFloat(abbrevMatch[1].replace(/,/g, ''));
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[abbrevMatch[2].toLowerCase()] || 1;
    return Math.round(num * mult);
  }

  return isNaN(direct) ? null : direct;
}


function getNavUrl(endpoint) {
  if (!endpoint) return null;
  const web = endpoint?.commandMetadata?.webCommandMetadata?.url;
  if (web) return web.startsWith('http') ? web : `https://www.youtube.com${web}`;
  const browseId = endpoint?.browseEndpoint?.browseId;
  if (browseId) {
    const canonical = endpoint?.browseEndpoint?.canonicalBaseUrl;
    if (canonical) return `https://www.youtube.com${canonical}`;
    return `https://www.youtube.com/channel/${browseId}`;
  }
  const watchId = endpoint?.watchEndpoint?.videoId;
  if (watchId) return `https://www.youtube.com/watch?v=${watchId}`;
  const urlEndpoint = endpoint?.urlEndpoint?.url;
  if (urlEndpoint) return urlEndpoint;
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
    { id: 'maxres',  url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,  width: 1280, height: 720  },
    { id: 'sd',      url: `https://i.ytimg.com/vi/${id}/sddefault.jpg`,      width: 640,  height: 480  },
    { id: 'hq',      url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,      width: 480,  height: 360  },
    { id: 'mq',      url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,      width: 320,  height: 180  },
    { id: 'default', url: `https://i.ytimg.com/vi/${id}/default.jpg`,        width: 120,  height: 90   },
  ];
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


function cleanRedirectUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'www.youtube.com' && u.pathname === '/redirect') {
      const q = u.searchParams.get('q');
      if (q) return decodeURIComponent(q);
    }
    return url;
  } catch { return url; }
}


function extractJsonBlock(html, varName) {
  if (!html || !varName) return null;

  const searchPatterns = [
    `var ${varName} = `,
    `var ${varName}=`,
    `window["${varName}"] = `,
    `window['${varName}'] = `,
    `"${varName}":`,
    `'${varName}':`,
    `${varName} = `,
    `${varName}=`,
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
  let depth = 0;
  let inString = false;
  let escape = false;
  let quoteChar = '';

  for (let i = startIdx; i < html.length; i++) {
    const ch = html[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }

    if (!inString) {
      if (ch === '"' || ch === "'") {
        inString = true;
        quoteChar = ch;
        continue;
      }
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
    } else {
      if (ch === quoteChar) { inString = false; }
    }
  }
  return null;
}


function extractArrayBlock(html, startIdx) {
  const actualStart = html.indexOf('[', startIdx);
  if (actualStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let quoteChar = '';

  for (let i = actualStart; i < html.length; i++) {
    const ch = html[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }

    if (!inString) {
      if (ch === '"' || ch === "'") { inString = true; quoteChar = ch; continue; }
      if (ch === '[') { depth++; continue; }
      if (ch === ']') {
        depth--;
        if (depth === 0) {
          const candidate = html.substring(actualStart, i + 1);
          return safeJSON(candidate);
        }
      }
    } else {
      if (ch === quoteChar) inString = false;
    }
  }
  return null;
}



function extractVisitorData(html) {
  const patterns = [
    /"visitorData"\s*:\s*"(C[a-zA-Z0-9+/=%_-]{20,})"/,
    /visitorData["']?\s*:\s*["'](C[a-zA-Z0-9+/=%_-]{20,})["']/,
    /"VISITOR_DATA"\s*:\s*"([^"]{20,})"/,
    /visitor_data["']?\s*=\s*["']([^"']{20,})["']/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1];
  }
  return '';
}

function extractApiKey(html) {
  const patterns = [
    /"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/,
    /"innertubeApiKey"\s*:\s*"([^"]+)"/,
    /innertubeApiKey["']?\s*:\s*["']([^"']+)["']/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1];
  }
  return INNERTUBE_KEYS[0];
}

function extractClientVersion(html) {
  const patterns = [
    /"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/,
    /"innertubeClientVersion"\s*:\s*"([^"]+)"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return m[1];
  }
  return CLIENTS.WEB.version;
}

function extractPageBuildLabel(html) {
  const m = html.match(/"CLIENT_PAGE_BUILD_LABEL"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}


async function fetchWatchPage(videoId) {
  const strategies = [
    async () => {
      const res = await httpGet(
        `https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US&persist_gl=1&has_verified=1`,
        { 'User-Agent': getUA(), 'Cookie': 'CONSENT=YES+cb; YSC=fake; VISITOR_INFO1_LIVE=fake' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    // フォーマットを直接読み（暗号化されてるから表示しない）
    async () => {
      const res = await httpGet(
        `https://www.youtube.com/watch?v=${videoId}&hl=en`,
        { 'User-Agent': getUA() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    // ボット回避できないから消してもいい
    async () => {
      const res = await httpGet(
        `https://www.youtube.com/watch?v=${videoId}`,
        { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },

    async () => {
      const res = await httpGet(
        `https://www.youtube.com/watch?v=${videoId}`,
        { 'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
  ];

  let lastError = null;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const text = await strategies[i]();
      if (text && (text.includes('ytInitialData') || text.includes('ytInitialPlayerResponse'))) {
        return text;
      }
    } catch (e) {
      lastError = e;
      if (i < strategies.length - 1) await sleep(300 * (i + 1));
    }
  }
  throw lastError || new Error('All watch page strategies failed');
}


function buildInnertubeContext(clientKey, videoId, visitorData, extraParams = {}) {
  const client = CLIENTS[clientKey];
  if (!client) throw new Error(`Unknown client: ${clientKey}`);

  const ctx = {
    client: {
      clientName: client.name,
      clientVersion: client.version,
      hl: 'en',
      gl: 'US',
      visitorData: visitorData || '',
      userAgent: client.userAgent,
      ...( client.deviceMake        ? { deviceMake: client.deviceMake }               : {} ),
      ...( client.deviceModel       ? { deviceModel: client.deviceModel }             : {} ),
      ...( client.osName            ? { osName: client.osName }                       : {} ),
      ...( client.osVersion         ? { osVersion: client.osVersion }                 : {} ),
      ...( client.androidSdkVersion ? { androidSdkVersion: client.androidSdkVersion } : {} ),
    },
  };

  const payload = {
    context: ctx,
    videoId,
    racyCheckOk: true,
    contentCheckOk: true,
    ...extraParams,
  };

  if (client.embedUrl) {
    payload.context.thirdParty = { embedUrl: client.embedUrl };
  }

  return {
    payload,
    url: `https://www.youtube.com/youtubei/v1`,
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
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: clientVersion || CLIENTS.WEB.version,
        hl: 'en',
        gl: 'US',
        visitorData: visitorData || '',
        userAgent: CLIENTS.WEB.userAgent,
      },
    },
    videoId,
    racyCheckOk: true,
    contentCheckOk: true,
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

async function callBrowse(browseId, params, apiKey, clientVersion) {
  const payload = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: clientVersion || CLIENTS.WEB.version,
        hl: 'en',
        gl: 'US',
        userAgent: CLIENTS.WEB.userAgent,
      },
    },
    browseId,
    params: params || '',
  };
  const res = await httpPost(
    `https://www.youtube.com/youtubei/v1/browse?key=${apiKey || INNERTUBE_KEYS[0]}&prettyPrint=false`,
    payload,
    {
      'User-Agent': CLIENTS.WEB.userAgent,
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': clientVersion || CLIENTS.WEB.version,
    }
  );
  if (!res.ok) throw new Error(`browse HTTP ${res.status}`);
  return res.json();
}


function parsePlayerResponse(pr) {
  if (!pr || typeof pr !== 'object') return {};

  const vd = pr.videoDetails                     || {};
  const mf = pr.microformat?.playerMicroformatRenderer || {};
  const ps = pr.playabilityStatus                || {};
  const sd = pr.streamingData                    || {};

  // 今のところ5個のソース
  let duration = null;
  const durationCandidates = [
    vd.lengthSeconds ? parseInt(vd.lengthSeconds, 10) : null,
    mf.lengthSeconds ? parseInt(mf.lengthSeconds, 10) : null,
    sd.formats?.[0]?.approxDurationMs ? Math.round(parseInt(sd.formats[0].approxDurationMs, 10) / 1000) : null,
    sd.adaptiveFormats?.[0]?.approxDurationMs ? Math.round(parseInt(sd.adaptiveFormats[0].approxDurationMs, 10) / 1000) : null,
  ];
  for (const d of durationCandidates) {
    if (d && d > 0) { duration = d; break; }
  }

  const kwSet = new Set();
  (Array.isArray(vd.keywords) ? vd.keywords : []).forEach(k => k && kwSet.add(k));
  (Array.isArray(mf.tags) ? mf.tags : []).forEach(k => k && kwSet.add(k));

  let viewCount = null;
  if (vd.viewCount) {
    const n = parseInt(vd.viewCount, 10);
    if (!isNaN(n)) viewCount = n;
  }

  const channelId = vd.channelId || mf.externalChannelId || null;

  // ライブ判定
  const isLive = !!(vd.isLiveContent && vd.isLive);


  const availableCountries = Array.isArray(mf.availableCountries)
    ? mf.availableCountries : [];


  const embed = mf.embed ? {
    iframe_url:        mf.embed.iframeUrl        || null,
    width:             mf.embed.width            || null,
    height:            mf.embed.height           || null,
    flash_secure_url:  mf.embed.flashSecureUrl   || null,
  } : null;


  const storyboards = [];
  try {
    const spec = pr.storyboards?.playerStoryboardSpecRenderer?.spec;
    if (spec) {
      spec.split('|').filter(Boolean).forEach((s, i) => storyboards.push({ index: i, spec: s }));
    }
  } catch {}


  const captions = [];
  try {
    const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    tracks.forEach(t => captions.push({
      language:          t.languageCode   || null,
      language_name:     getText(t.name)  || null,
      url:               t.baseUrl        || null,
      is_translatable:   !!t.isTranslatable,
      kind:              t.kind           || null,
      vss_id:            t.vssId          || null,
    }));
  } catch {}


  const playability = {
    status:         ps.status         || null,
    reason:         ps.reason         || null,
    error_code:     ps.errorCode      || null,
    messages:       ps.messages       || [],
    plays_anywhere: !!ps.playsAnyway,
  };

  return {
    videoId:           vd.videoId            || null,
    title:             vd.title              || getText(mf.title)       || null,
    description:       vd.shortDescription   || getText(mf.description) || null,
    duration,
    viewCount,
    author:            vd.author             || null,
    channelId,
    externalChannelId: mf.externalChannelId  || null,
    isLive,
    isLiveContent:     !!vd.isLiveContent,
    isPrivate:         !!vd.isPrivate,
    isUnlisted:        !!mf.isUnlisted,
    isAgeRestricted:   mf.isFamilySafe === false,
    isFamilySafe:      mf.isFamilySafe !== false,
    isUpcoming:        ps.status === 'LIVE_STREAM_OFFLINE',
    allowRatings:      !!vd.allowRatings,
    category:          mf.category           || null,
    uploadDate:        mf.uploadDate         || null,
    publishDate:       mf.publishDate        || null,
    availableCountries,
    keywords:          [...kwSet],
    embed,
    playability,
    captions,
    storyboards,
    hasStreamingData:  !!(sd.formats?.length || sd.adaptiveFormats?.length),
  };
}



function parsePrimaryInfo(initialData) {
  if (!initialData || typeof initialData !== 'object') return {};

  const result = {
    title: null, viewCount: null, dateText: null, likeCount: null,
    channelName: null, channelUrl: null, channelId: null,
    channelVerified: false, subscriberText: null, channelThumbs: [],
    description: null, descLinks: [], hashtags: [],
  };

  try {
    const contents = dig(initialData, 'contents', 'twoColumnWatchNextResults', 'results', 'results', 'contents') || [];
    let primary   = null;
    let secondary = null;

    for (const c of contents) {
      if (c?.videoPrimaryInfoRenderer)   primary   = c.videoPrimaryInfoRenderer;
      if (c?.videoSecondaryInfoRenderer) secondary = c.videoSecondaryInfoRenderer;
    }

    if (!primary && !secondary) {
      // モバイル版（slim）
      const mContents = dig(initialData, 'contents', 'singleColumnWatchNextResults', 'results', 'results', 'contents') || [];
      for (const c of mContents) {
        const slim = c?.slimVideoMetadataSectionRenderer?.contents || [];
        for (const s of slim) {
          if (s?.slimVideoMetadataRenderer) primary = s.slimVideoMetadataRenderer;
        }
      }
    }

    result.title = getText(primary?.title) || null;

    const vcr = primary?.viewCount?.videoViewCountRenderer;
    const vcText = getText(vcr?.viewCount) || getText(vcr?.shortViewCount);
    if (vcText) result.viewCount = parseCount(vcText);


    result.dateText = getText(primary?.dateText) || null;


    result.likeCount = extractLikeCount(primary);

    const ownerR = secondary?.owner?.videoOwnerRenderer;
    if (ownerR) {
      result.channelName    = getText(ownerR.title) || null;
      result.channelUrl     = getNavUrl(ownerR.navigationEndpoint) || null;
      result.channelId      = ownerR.navigationEndpoint?.browseEndpoint?.browseId || null;
      result.channelVerified = extractVerified(ownerR.badges);
      result.subscriberText = getText(ownerR.subscriberCountText) || null;
      result.channelThumbs  = normalizeThumbs(ownerR.thumbnail);
    }

    result.description = extractDescription(secondary);
    result.descLinks   = extractDescriptionLinks(secondary, result.description);

    result.hashtags = extractHashtags(primary, secondary);

  } catch (e) {
  }

  return result;
}


function extractLikeCount(primary) {
  if (!primary) return null;

  try {
    const buttons = primary?.videoActions?.menuRenderer?.topLevelButtons || [];

    for (const btn of buttons) {
      const sldvm = btn?.segmentedLikeDislikeButtonViewModel;
      if (sldvm) {
        const likeVM = sldvm.likeButtonViewModel?.likeButtonViewModel
          ?.toggleButtonViewModel?.toggleButtonViewModel;
        if (likeVM) {
          for (const textKey of ['defaultText', 'toggledText', 'accessibilityText']) {
            const txt = getText(likeVM[textKey]);
            if (txt) {
              const n = parseCount(txt);
              if (n && n > 0) return n;
            }
          }
        }
      }

      const bvm = btn?.buttonViewModel;
      if (bvm?.iconName === 'LIKE' || bvm?.accessibilityText?.includes('like')) {
        const txt = getText(bvm.title) || getText(bvm.accessibilityText);
        if (txt) {
          const n = parseCount(txt);
          if (n && n > 0) return n;
        }
      }

      const tbr = btn?.toggleButtonRenderer;
      if (tbr) {
        const txt = getText(tbr.defaultText) || getText(tbr.toggledText);
        if (txt) {
          const n = parseCount(txt);
          if (n && n > 0) return n;
        }
      }

     
      const sldbr = btn?.segmentedLikeDislikeButtonRenderer;
      if (sldbr) {
        const likeBtn = sldbr.likeButton?.toggleButtonRenderer;
        if (likeBtn) {
          const accLabel = likeBtn.accessibilityData?.accessibilityData?.label || '';
          const m = accLabel.match(/([\d,]+)\s+like/i);
          if (m) return parseInt(m[1].replace(/,/g, ''), 10);
          const txt = getText(likeBtn.defaultText);
          if (txt) {
            const n = parseCount(txt);
            if (n && n > 0) return n;
          }
        }
      }
    }
  } catch {}

  return null;
}


function extractVerified(badges) {
  if (!Array.isArray(badges)) return false;
  return badges.some(b => {
    const mbr = b?.metadataBadgeRenderer;
    return mbr?.style?.includes('VERIFIED') || mbr?.icon?.iconType === 'CHECK_CIRCLE_THICK';
  });
}


function extractDescription(secondary) {
  if (!secondary) return null;
  try {
    // 最も完全
    const attrDesc = secondary.attributedDescription;
    if (attrDesc?.content) return attrDesc.content;


    const desc = secondary.description;
    if (desc) return getText(desc);


    const expandable = secondary.expandableVideoDescriptionBodyRenderer;
    if (expandable) {
      return getText(expandable.descriptionBodyText) || getText(expandable.attributedDescriptionBodyText);
    }
  } catch {}
  return null;
}


function extractDescriptionLinks(secondary, descriptionText) {
  const links = [];
  if (!secondary) return links;

  try {
    const attrDesc = secondary.attributedDescription;
    if (attrDesc?.commandRuns) {
      for (const run of attrDesc.commandRuns) {
        const url = run?.onTap?.innertubeCommand?.urlEndpoint?.url
          || run?.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url;
        if (url) {
          const text = descriptionText
            ? descriptionText.substring(run.startIndex || 0, (run.startIndex || 0) + (run.length || 0))
            : null;
          links.push({
            text: text || null,
            url: cleanRedirectUrl(url),
            raw_url: url,
          });
        }
      }
    }

    // runs内のURLナビ
    if (links.length === 0 && secondary.description?.runs) {
      for (const run of secondary.description.runs) {
        const url = run?.navigationEndpoint?.urlEndpoint?.url
          || run?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
        if (url) {
          links.push({
            text: run.text || null,
            url: cleanRedirectUrl(url),
            raw_url: url,
          });
        }
      }
    }
  } catch {}

  return links;
}


function extractHashtags(primary, secondary) {
  const tags = new Set();
  try {
    const superRuns = primary?.superTitleLink?.runs || [];
    superRuns.filter(r => r?.text?.startsWith('#')).forEach(r => tags.add(r.text));

    const headerLinks = primary?.headerLinks?.runs || [];
    headerLinks.filter(r => r?.text?.startsWith('#')).forEach(r => tags.add(r.text));

    if (secondary?.description?.runs) {
      let count = 0;
      for (const run of secondary.description.runs) {
        if (run?.text?.startsWith('#') && count < 3) {
          const endpoint = run?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
          if (endpoint?.includes('/hashtag/')) {
            tags.add(run.text);
            count++;
          }
        }
      }
    }
  } catch {}
  return [...tags];
}


function parseRelatedVideos(initialData, nextData, limit = 30) {
  const videos = [];
  const seen = new Set();

  const addVideo = (item) => {
    if (!item?.id || seen.has(item.id)) return;
    seen.add(item.id);
    videos.push(item);
  };

  if (initialData) {
    const results1 = dig(initialData, 'contents', 'twoColumnWatchNextResults', 'secondaryResults', 'secondaryResults', 'results') || [];
    const results2 = dig(initialData, 'contents', 'twoColumnWatchNextResults', 'secondaryResults', 'results') || [];
    const results = results1.length > 0 ? results1 : results2;

    for (const item of results) {
      if (videos.length >= limit) break;
      extractRelatedItem(item, addVideo);
    }
  }

  if (videos.length < limit && nextData) {
    const results = dig(nextData, 'contents', 'twoColumnWatchNextResults', 'secondaryResults', 'secondaryResults', 'results') || [];
    for (const item of results) {
      if (videos.length >= limit) break;
      extractRelatedItem(item, addVideo);
    }
  }

  return videos;
}

function extractRelatedItem(item, addVideo) {
  if (!item) return;

  const cvr = item?.compactVideoRenderer;
  if (cvr?.videoId) {
    addVideo(buildVideoItem(cvr, false));
    return;
  }


  const auto = item?.compactAutoplayRenderer?.contents;
  if (auto) {
    for (const c of auto) {
      if (c?.compactVideoRenderer?.videoId) {
        addVideo(buildVideoItem(c.compactVideoRenderer, false));
      }
    }
    return;
  }

  const reel = item?.reelItemRenderer;
  if (reel?.videoId) {
    addVideo({
      id:         reel.videoId,
      title:      getText(reel.headline) || null,
      url:        `https://www.youtube.com/shorts/${reel.videoId}`,
      short_url:  `https://youtu.be/${reel.videoId}`,
      duration:   null,
      view_count: parseCount(getText(reel.viewCountText)) || null,
      view_count_text: getText(reel.viewCountText) || null,
      published:  null,
      thumbnail:  normalizeThumbs(reel.thumbnail)[0]?.url || `https://i.ytimg.com/vi/${reel.videoId}/hqdefault.jpg`,
      thumbnails: normalizeThumbs(reel.thumbnail),
      channel:    { name: null, id: null, url: null, thumbnail: null },
      is_live:    false,
      is_short:   true,
      badges:     [],
    });
    return;
  }

  const lockup = item?.lockupViewModel;
  if (lockup) {
    const vid = lockup?.contentId || lockup?.rendererContext?.commandContext?.onTap?.watchEndpoint?.videoId;
    if (vid) {
      const title = getText(lockup?.metadata?.lockupMetadataViewModel?.title?.content) || null;
      addVideo({
        id:         vid,
        title,
        url:        `https://www.youtube.com/watch?v=${vid}`,
        short_url:  `https://youtu.be/${vid}`,
        duration:   null,
        view_count: null,
        view_count_text: null,
        published:  null,
        thumbnail:  `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        thumbnails: buildVideoThumbs(vid),
        channel:    { name: null, id: null, url: null, thumbnail: null },
        is_live:    false,
        is_short:   false,
        badges:     [],
      });
    }
  }
}

function buildVideoItem(r, isShort) {
  const channelRuns = r.shortBylineText?.runs || r.longBylineText?.runs || [];
  const channelRun  = channelRuns[0];
  const vcText      = getText(r.viewCountText);
  const thumbs      = normalizeThumbs(r.thumbnail);

  return {
    id:              r.videoId,
    title:           getText(r.title) || null,
    url:             `https://www.youtube.com/watch?v=${r.videoId}`,
    short_url:       `https://youtu.be/${r.videoId}`,
    duration:        getText(r.lengthText) || null,
    duration_secs:   parseDurationText(getText(r.lengthText)),
    view_count:      parseCount(vcText) || null,
    view_count_text: vcText || null,
    published:       getText(r.publishedTimeText) || null,
    thumbnail:       thumbs[0]?.url || `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
    thumbnails:      thumbs,
    channel: {
      name:      getText(r.shortBylineText) || getText(r.longBylineText) || null,
      id:        channelRun?.navigationEndpoint?.browseEndpoint?.browseId || null,
      url:       getNavUrl(channelRun?.navigationEndpoint) || null,
      thumbnail: null,
    },
    is_live:  !!(r.badges?.find(b => b?.liveBadgeRenderer || b?.metadataBadgeRenderer?.style?.includes('LIVE'))),
    is_short: !!isShort,
    badges:   (r.badges || []).map(b => getText(b?.liveBadgeRenderer?.label || b?.metadataBadgeRenderer?.label)).filter(Boolean),
  };
}


function parseDurationText(text) {
  if (!text) return null;
  const parts = text.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}



function parseChapters(initialData) {
  if (!initialData) return [];

  try {
    const markersMap = dig(
      initialData,
      'playerOverlays', 'playerOverlayRenderer',
      'decoratedPlayerBarRenderer', 'decoratedPlayerBarRenderer',
      'playerBar', 'multiMarkersPlayerBarRenderer', 'markersMap'
    ) || [];

    for (const entry of markersMap) {
      const chapters = entry?.value?.chapters;
      if (Array.isArray(chapters) && chapters.length > 0) {
        return chapters.map(c => {
          const ch = c?.chapterRenderer;
          return {
            title:      getText(ch?.title)    || null,
            start_time: ch?.timeRangeStartMillis != null ? ch.timeRangeStartMillis / 1000 : null,
            thumbnail:  normalizeThumbs(ch?.thumbnail)[0]?.url || null,
          };
        });
      }
    }
  } catch {}


  try {
    const panels = initialData?.engagementPanels || [];
    for (const panel of panels) {
      const contents = dig(panel, 'engagementPanelSectionListRenderer', 'content', 'macroMarkersListRenderer', 'contents') || [];
      if (contents.length > 0) {
        return contents.map(i => {
          const m = i?.macroMarkersListItemRenderer;
          if (!m) return null;
          return {
            title:      getText(m.title)            || null,
            start_time: getText(m.timeDescription)  || null,
            thumbnail:  normalizeThumbs(m.thumbnail)[0]?.url || null,
          };
        }).filter(Boolean);
      }
    }
  } catch {}

  return [];
}


function parsePlaylist(initialData) {
  if (!initialData) return null;
  try {
    const pl = dig(initialData, 'contents', 'twoColumnWatchNextResults', 'playlist', 'playlist');
    if (!pl) return null;

    const items = (pl.contents || []).map(c => {
      const r = c?.playlistPanelVideoRenderer || c?.playlistPanelVideoWrapperRenderer?.primaryPlaylistPanelVideoRenderer;
      if (!r) return null;
      return {
        id:          r.videoId || null,
        title:       getText(r.title) || null,
        duration:    getText(r.lengthText) || null,
        url:         r.videoId ? `https://www.youtube.com/watch?v=${r.videoId}` : null,
        thumbnail:   normalizeThumbs(r.thumbnail)[0]?.url || null,
        is_selected: !!r.selected,
        index:       r.index?.simpleText ? parseInt(r.index.simpleText, 10) : null,
      };
    }).filter(Boolean);

    return {
      id:            pl.playlistId   || null,
      title:         getText(pl.title) || null,
      total:         parseCount(getText(pl.totalVideos)) || null,
      current_index: pl.currentIndex ?? null,
      items,
    };
  } catch { return null; }
}


function parseChannelBrowse(browseData) {
  if (!browseData || typeof browseData !== 'object') return null;

  try {
    const header = browseData?.header?.c4TabbedHeaderRenderer
      || browseData?.header?.pageHeaderRenderer
      || browseData?.header?.carouselHeaderRenderer?.contents?.[0]?.topicChannelDetailsRenderer
      || browseData?.header?.interactiveTabbedHeaderRenderer
      || null;

    if (!header) return null;

    const name = getText(header?.title) || null;


    let handle = null;
    const handleText = getText(header?.channelHandleText);
    if (handleText) handle = handleText.startsWith('@') ? handleText : `@${handleText}`;
    if (!handle) {
      const canonicalUrl = header?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
      if (canonicalUrl?.startsWith('/@')) handle = canonicalUrl.substring(1);
    }

    const verified    = extractVerified(header?.badges);
    const subText     = getText(header?.subscriberCountText) || null;
    const videosText  = getText(header?.videosCountText) || null;
    
    const avatar = normalizeThumbs(header?.avatar || header?.thumbnail || header?.channelAvatarImageUrl);

    const banner    = normalizeThumbs(header?.banner);
    const tvBanner  = normalizeThumbs(header?.tvBanner);
    const mobBanner = normalizeThumbs(header?.mobileBanner);

    let description = null;
    try {
      const tabs = browseData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      outer: for (const tab of tabs) {
        const sections = dig(tab, 'tabRenderer', 'content', 'sectionListRenderer', 'contents') || [];
        for (const sec of sections) {
          const items = sec?.itemSectionRenderer?.contents || [];
          for (const item of items) {
            const d = item?.channelAboutFullMetadataRenderer?.description
              || item?.structuredDescriptionContentRenderer?.items?.[0]?.expandableVideoDescriptionBodyRenderer?.attributedDescriptionBodyText;
            if (d) { description = getText(d); break outer; }
          }
        }
      }
    } catch {}


    let country = null;
    try {
      const tabs = browseData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      for (const tab of tabs) {
        const items = dig(tab, 'tabRenderer', 'content', 'sectionListRenderer', 'contents', 0, 'itemSectionRenderer', 'contents') || [];
        for (const item of items) {
          const meta = item?.channelAboutFullMetadataRenderer;
          if (meta) {
            country = getText(meta.country) || null;
            break;
          }
        }
      }
    } catch {}

    return {
      name, handle, verified,
      subscriber_count: subText,
      videos_count:     videosText,
      description,
      country,
      avatar, banner, tv_banner: tvBanner, mobile_banner: mobBanner,
    };
  } catch { return null; }
}

async function resolvePlayerData(videoId, visitorData) {
  const clientOrder = ['TV_EMBEDDED', 'WEB_EMBEDDED', 'IOS', 'ANDROID', 'MWEB', 'WEB'];
  const results = {};

  const settled = await Promise.allSettled(
    clientOrder.map(async key => {
      const data = await callPlayer(key, videoId, visitorData);
      return { key, data };
    })
  );

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      results[r.value.key] = r.value.data;
    }
  }

  let bestPR   = null;
  let bestKey  = null;

  for (const key of clientOrder) {
    const pr = results[key];
    if (!pr) continue;
    const status = pr?.playabilityStatus?.status;
    if (status === 'OK') {
      bestPR  = pr;
      bestKey = key;
      break;
    }
    if (!bestPR && pr?.videoDetails?.videoId) {
      bestPR  = pr;
      bestKey = key;
    }
  }

  return { bestPR, bestKey, allResults: results };
}



async function scrapeYouTubeMeta(videoId) {
  const debug = {
    html_fetched:    false,
    initial_data:    false,
    player_response: false,
    best_client:     null,
    client_statuses: {},
    next_api:        false,
    channel_browse:  false,
    errors:          [],
  };


  let html = '';
  try {
    html = await fetchWatchPage(videoId);
    debug.html_fetched = true;
  } catch (e) {
    debug.errors.push(`watch_page: ${e.message}`);
    throw new Error(`Watch page unavailable: ${e.message}`);
  }

  const visitorData    = extractVisitorData(html);
  const dynamicApiKey  = extractApiKey(html);
  const dynamicVersion = extractClientVersion(html);


  const initialData    = extractJsonBlock(html, 'ytInitialData');
  const embeddedPR     = extractJsonBlock(html, 'ytInitialPlayerResponse');

  debug.initial_data    = !!initialData;
  debug.player_response = !!embeddedPR;


  let earlyChannelId = null;
  try {
    earlyChannelId = embeddedPR?.videoDetails?.channelId
      || (() => {
        const contents = dig(initialData, 'contents', 'twoColumnWatchNextResults', 'results', 'results', 'contents') || [];
        for (const c of contents) {
          const id = c?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
          if (id) return id;
        }
        return null;
      })();
  } catch {}


  const [playerResult, nextResult, browseResult] = await Promise.allSettled([
    resolvePlayerData(videoId, visitorData),
    callNext(videoId, visitorData, dynamicApiKey, dynamicVersion),
    earlyChannelId
      ? callBrowse(earlyChannelId, 'EgVhYm91dA%3D%3D', dynamicApiKey, dynamicVersion)
      : Promise.resolve(null),
  ]);


  let bestPR  = null;
  let bestKey = null;
  if (playerResult.status === 'fulfilled') {
    bestPR  = playerResult.value.bestPR;
    bestKey = playerResult.value.bestKey;
    debug.best_client = bestKey;
    for (const [k, v] of Object.entries(playerResult.value.allResults || {})) {
      debug.client_statuses[k] = {
        status:    v?.playabilityStatus?.status || 'ERROR',
        reason:    v?.playabilityStatus?.reason || null,
        has_video: !!v?.videoDetails?.videoId,
      };
    }
  } else {
    debug.errors.push(`player: ${playerResult.reason?.message}`);
  }


  const finalPR = bestPR || embeddedPR;

  let nextData = null;
  if (nextResult.status === 'fulfilled') {
    nextData = nextResult.value;
    debug.next_api = true;
  } else {
    debug.errors.push(`next: ${nextResult.reason?.message}`);
  }

  let browseData = null;
  if (browseResult.status === 'fulfilled' && browseResult.value) {
    browseData = browseResult.value;
    debug.channel_browse = true;
  } else if (browseResult.status === 'rejected') {
    debug.errors.push(`browse: ${browseResult.reason?.message}`);
  }


  const prParsed    = parsePlayerResponse(finalPR);
  const primary     = parsePrimaryInfo(initialData);
  const channelEx   = parseChannelBrowse(browseData);
  const chapters    = parseChapters(initialData);
  const playlist    = parsePlaylist(initialData);
  const related     = parseRelatedVideos(initialData, nextData, 30);


  let nextKeywords = [];
  try {
    const engagements = nextData?.engagementPanels || [];
    for (const ep of engagements) {
      const kws = dig(ep, 'engagementPanelSectionListRenderer', 'content', 'structuredDescriptionContentRenderer', 'items');
      if (kws) {

      }
    }
  } catch {}



  const title       = prParsed.title       || primary.title       || null;
  const description = primary.description  || prParsed.description || null;
  const duration    = prParsed.duration    || null;
  const viewCount   = prParsed.viewCount   || primary.viewCount   || null;
  const uploadDate  = prParsed.uploadDate  || primary.dateText    || null;
  const publishDate = prParsed.publishDate || null;
  const category    = prParsed.category    || null;


  const kwSet = new Set([
    ...prParsed.keywords,
    ...nextKeywords,
  ]);
  const keywords = [...kwSet];

  const chId       = prParsed.channelId || primary.channelId || earlyChannelId || null;
  const chName     = primary.channelName  || prParsed.author   || channelEx?.name     || null;
  const chUrl      = primary.channelUrl   || (chId ? `https://www.youtube.com/channel/${chId}` : null);
  const chVerified = primary.channelVerified || channelEx?.verified || false;
  const chSubs     = primary.subscriberText  || channelEx?.subscriber_count || null;

  const chThumbs   = primary.channelThumbs?.length > 0
    ? primary.channelThumbs
    : (channelEx?.avatar || []);

  const videoThumbs = buildVideoThumbs(videoId);


  const captions = prParsed.captions.length > 0
    ? prParsed.captions
    : (embeddedPR ? parsePlayerResponse(embeddedPR).captions : []);



  return {
    success:           true,
    extractor:         'youtube',
    extractor_version: VERSION,


    id:                videoId,
    title,
    description,
    duration,
    duration_string:   formatDuration(duration),


    view_count:        viewCount,
    like_count:        primary.likeCount    || null,
    upload_date:       uploadDate,
    publish_date:      publishDate,
    category,


    is_live:           prParsed.isLive        || false,
    is_live_content:   prParsed.isLiveContent || false,
    is_private:        prParsed.isPrivate     || false,
    is_unlisted:       prParsed.isUnlisted    || false,
    is_upcoming:       prParsed.isUpcoming    || false,
    is_age_restricted: prParsed.isAgeRestricted || false,
    is_family_safe:    prParsed.isFamilySafe  !== false,
    allow_ratings:     prParsed.allowRatings  ?? null,


    available_countries: prParsed.availableCountries || [],

    keywords,
    tags:              keywords,
    hashtags:          primary.hashtags || [],


    channel: {
      id:               chId,
      external_id:      prParsed.externalChannelId || null,
      name:             chName,
      url:              chUrl,
      verified:         chVerified,
      subscriber_count: chSubs,
      description:      channelEx?.description   || null,
      handle:           channelEx?.handle         || null,
      country:          channelEx?.country        || null,
      videos_count:     channelEx?.videos_count   || null,
      thumbnail:        chThumbs[0]?.url          || null,
      thumbnails:       chThumbs,
      banner:           channelEx?.banner         || [],
      tv_banner:        channelEx?.tv_banner      || [],
      mobile_banner:    channelEx?.mobile_banner  || [],
    },


    thumbnails:         videoThumbs,
    thumbnail:          videoThumbs[0]?.url || null,


    webpage_url:        `https://www.youtube.com/watch?v=${videoId}`,
    embed_url:          `https://www.youtube.com/embed/${videoId}`,
    short_url:          `https://youtu.be/${videoId}`,
    embed_info:         prParsed.embed || null,


    captions,
    subtitles:          captions,


    chapters,


    storyboards:        prParsed.storyboards || [],


    related_videos:     related,
    related_count:      related.length,


    playlist,


    description_links:  primary.descLinks || [],


    playability:        prParsed.playability || { status: null, reason: null },


    _debug: debug,
  };
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/yt-sc/:videoId', async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({
      success: false,
      error:   'Invalid YouTube video ID (must be exactly 11 characters)',
    });
  }

  try {
    const data = await scrapeYouTubeMeta(videoId);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error:   err.message,
      videoId,
    });
  }
});

// ============================================================================
// INVIDIOUS BACKEND ROTATION & API CLIENT
// ============================================================================

const INVIDIOUS_INSTANCES = [
  { id: 'B1', region: 'CL', url: 'https://invidious.ritoge.com' },
  { id: 'B2', region: 'US', url: 'https://yt.omada.cafe' },
  { id: 'B3', region: 'US', url: 'https://invidious.darkness.services' },
  { id: 'B4', region: 'US', url: 'https://invidious.f5.si' },
  { id: 'B5', region: 'US', url: 'https://invidious.ducks.party' },
  { id: 'B6', region: 'US', url: 'https://y.com.sb' },
  { id: 'B7', region: 'DE', url: 'https://super8.absturztau.be' },
  { id: 'B8', region: 'DE', url: 'https://inv.zoomerville.com' },
];

// Health-state for each backend, used to color the indicator bars
const backendHealth = new Map(INVIDIOUS_INSTANCES.map(b => [b.id, { ok: true, lastCheck: 0 }]));

function getBackendByCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  const m = cookieHeader.match(/(?:^|;\s*)backend=([^;]+)/);
  if (m) {
    const found = INVIDIOUS_INSTANCES.find(b => b.id === m[1]);
    if (found) return found;
  }
  return INVIDIOUS_INSTANCES[5]; // default = B6
}

async function invFetch(req, path, { timeout = 9000 } = {}) {
  const primary = getBackendByCookie(req);
  const order = [primary, ...INVIDIOUS_INSTANCES.filter(b => b.id !== primary.id)];
  let lastErr = null;
  for (const backend of order) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeout);
      const r = await fetch(backend.url + path, {
        method: 'GET',
        headers: {
          'User-Agent': getUA(),
          'Accept': 'application/json',
        },
        signal: controller.signal,
        dispatcher: AGENT,
      });
      clearTimeout(t);
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status); continue; }
      const data = await r.json();
      backendHealth.set(backend.id, { ok: true, lastCheck: Date.now() });
      return { data, backend };
    } catch (e) {
      backendHealth.set(backend.id, { ok: false, lastCheck: Date.now() });
      lastErr = e;
    }
  }
  throw lastErr || new Error('All backends failed');
}

// ============================================================================
// GETLATE STREAM RESOLVER (hidden behind /proxy/*)
// ============================================================================

const streamCache = new Map();
const STREAM_TTL = 5 * 60 * 1000;

function gcStreamCache() {
  const now = Date.now();
  for (const [k, v] of streamCache) if (v.expiry < now) streamCache.delete(k);
}
setInterval(gcStreamCache, 60 * 1000);

async function resolveStream(videoId, formatId, useFallback = false) {
  const cacheKey = `${videoId}:${formatId}:${useFallback ? 'f' : 'p'}`;
  const cached = streamCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) return cached.url;

  const watchUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
  const endpoint = useFallback
    ? `https://getlate.dev/api/tools/youtube-video-downloader?url=${watchUrl}&formatId=${formatId}`
    : `https://getlate.dev/api/tools/youtube-live-downloader?url=+${watchUrl}&formatId=${formatId}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: controller.signal,
      dispatcher: AGENT,
    });
    clearTimeout(t);
    const finalUrl = r.url;
    if (!finalUrl || finalUrl.startsWith('https://getlate.dev')) {
      // remote returned an error page rather than redirecting
      throw new Error('upstream did not redirect');
    }
    streamCache.set(cacheKey, { url: finalUrl, expiry: Date.now() + STREAM_TTL });
    return finalUrl;
  } catch (e) {
    clearTimeout(t);
    if (!useFallback) {
      // fall back to alt endpoint
      return resolveStream(videoId, formatId, true);
    }
    throw e;
  }
}

// formatId mapping: 2=360p+audio, 5=1080p video-only, 4=720p video-only
const FORMAT_MAP = {
  '360':  { id: '2', hasAudio: true  },
  '720':  { id: '4', hasAudio: false },
  '1080': { id: '5', hasAudio: false },
};

// ============================================================================
// CACHE
// ============================================================================

const videoMetaCache = new Map();
const META_TTL = 5 * 60 * 1000;

function gcMetaCache() {
  const now = Date.now();
  for (const [k, v] of videoMetaCache) if (v.expiry < now) videoMetaCache.delete(k);
}
setInterval(gcMetaCache, 60 * 1000);

async function getVideoMeta(videoId) {
  const cached = videoMetaCache.get(videoId);
  if (cached && cached.expiry > Date.now()) return cached.data;
  const data = await scrapeYouTubeMeta(videoId);
  videoMetaCache.set(videoId, { data, expiry: Date.now() + META_TTL });
  return data;
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatNumber(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('ja-JP');
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(timestamp);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}日前`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}ヶ月前`;
  return `${Math.floor(diff / 31536000)}年前`;
}

function formatDur(sec) {
  sec = Number(sec) || 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ============================================================================
// SHARED LAYOUT
// ============================================================================

const PLAYER_CSS_LINKS = `
<link rel="stylesheet" href="/videojs/video.js/video-js.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-http-source-selector/videojs-http-source-selector.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-markers/videojs.markers.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-share/videojs-share.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-mobile-ui/videojs-mobile-ui.css?v=07c38a4">
<link rel="stylesheet" href="/css/player.css?v=07c38a4">
`;

const PLAYER_JS_LINKS = `
<script src="/videojs/video.js/video.js?v=07c38a4"></script>
<script src="/videojs/videojs-mobile-ui/videojs-mobile-ui.js?v=07c38a4"></script>
<script src="/videojs/videojs-contrib-quality-levels/videojs-contrib-quality-levels.js?v=07c38a4"></script>
<script src="/videojs/videojs-http-source-selector/videojs-http-source-selector.js?v=07c38a4"></script>
<script src="/videojs/videojs-markers/videojs-markers.js?v=07c38a4"></script>
<script src="/videojs/videojs-share/videojs-share.js?v=07c38a4"></script>
<script src="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.js?v=07c38a4"></script>
`;

// Returns the backend-bar HTML used in the header on every page
function renderBackendBar(activeId) {
  return INVIDIOUS_INSTANCES.map(b => {
    const isActive = b.id === activeId;
    const health = backendHealth.get(b.id);
    const ok = !health || health.ok;
    const color = ok ? '#3bbf3b' : '#c44';
    return `<a href="#" class="backend-link ${isActive ? 'active' : ''}" data-backend="${b.id}">${b.id} (${b.region})</a> <span class="backend-indicator" style="background:${color}"></span>`;
  }).join(' <span class="backend-sep">|</span> ');
}

function commonStyles() {
  return `
:root{
  --bg:#1a1a1a;--bg2:#222;--card:#1f1f1f;--border:#333;--border2:#2a2a2a;
  --text:#ececec;--muted:#9a9a9a;--muted2:#777;--link:#9fc7ff;
  --accent:#ff6b35;--accent2:#4a9eff;--ok:#3bbf3b;--err:#c44;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{
  background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;
  -webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column;
}
a{color:inherit;text-decoration:none}
a:hover{text-decoration:underline}

/* Header */
.iv-header{
  display:flex;align-items:center;padding:10px 18px;border-bottom:1px solid var(--border);
  background:var(--bg);position:sticky;top:0;z-index:50;flex-wrap:wrap;gap:10px;
}
.iv-header .logo{font-weight:bold;font-size:18px;letter-spacing:1px;margin-right:18px}
.iv-header .logo a{color:var(--text)}
.iv-header .backend-row{font-size:13px;color:var(--muted);display:flex;align-items:center;flex-wrap:wrap;gap:4px}
.iv-header .backend-row b{color:var(--text);margin-right:6px}
.backend-link{color:#7fa8ff}
.backend-link.active{text-decoration:underline;color:#bcd}
.backend-indicator{display:inline-block;width:4px;height:14px;border-radius:1px;vertical-align:middle;margin:0 2px}
.backend-sep{color:var(--muted2);margin:0 2px}
.iv-header .top-tools{margin-left:auto;display:flex;align-items:center;gap:14px;font-size:14px}
.iv-header .top-tools a{color:var(--muted)}
.iv-header .top-tools a:hover{color:var(--text);text-decoration:none}
.iv-header .nav-links{display:flex;gap:16px;font-size:14px}
.iv-header .nav-links a{color:var(--text)}
.iv-header .nav-links a:hover{color:#fff;text-decoration:none}

/* Search bar */
.search-form{display:flex;align-items:center;position:relative}
.search-input{
  background:transparent;border:none;border-bottom:1px solid #555;color:var(--text);
  font-size:15px;padding:6px 30px 6px 8px;outline:none;transition:border-color .2s;
  min-width:240px;
}
.search-input:focus{border-bottom-color:var(--text)}
.search-btn{
  background:transparent;border:none;color:var(--muted);position:absolute;right:6px;top:50%;
  transform:translateY(-50%);cursor:pointer;padding:2px;display:flex;align-items:center;
}
.search-btn svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.search-btn:hover{color:var(--text)}

/* Layout */
.iv-main{flex:1;max-width:1400px;width:100%;margin:0 auto;padding:18px}
.section-title{font-size:18px;font-weight:600;margin:18px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)}

/* Grid */
.video-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}
.video-card{background:var(--card);border:1px solid var(--border2);border-radius:6px;overflow:hidden;transition:transform .15s, border-color .15s}
.video-card:hover{border-color:#555;transform:translateY(-2px)}
.thumb-wrap{position:relative;background:#000;aspect-ratio:16/9;overflow:hidden}
.thumb-wrap img{width:100%;height:100%;object-fit:cover;display:block}
.thumb-duration{position:absolute;right:6px;bottom:6px;background:rgba(0,0,0,0.85);color:#fff;padding:2px 6px;font-size:12px;border-radius:2px;font-weight:500}
.thumb-live{position:absolute;left:6px;top:6px;background:#cc0000;color:#fff;padding:2px 6px;font-size:11px;border-radius:2px;font-weight:600;text-transform:uppercase}
.card-body{padding:10px 12px}
.card-title{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--text);margin-bottom:6px;min-height:38px}
.card-meta{font-size:12px;color:var(--muted);line-height:1.5}
.card-meta a{color:var(--muted)}
.card-meta a:hover{color:var(--text);text-decoration:none}

/* Channel result */
.channel-result{display:flex;gap:16px;padding:14px;background:var(--card);border:1px solid var(--border2);border-radius:6px;margin-bottom:14px}
.channel-result img{width:96px;height:96px;border-radius:50%}
.channel-result .ci-info{flex:1}
.channel-result .ci-name{font-size:17px;font-weight:600;margin-bottom:4px}
.channel-result .ci-meta{font-size:13px;color:var(--muted);margin-bottom:6px}
.channel-result .ci-desc{font-size:13px;color:#bbb;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* Footer */
.iv-footer{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:28px 24px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);margin-top:30px}
.iv-footer p{line-height:1.9}
.iv-footer a{color:var(--muted)}

/* Watch page */
.watch-layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px}
@media (max-width:1024px){.watch-layout{grid-template-columns:1fr}}
.player-wrap{position:relative;background:#000;border-radius:6px;overflow:hidden;aspect-ratio:16/9;width:100%}
.player-wrap video{width:100%;height:100%}
.video-title{font-size:20px;font-weight:600;margin:14px 0 8px;line-height:1.35}
.video-stats{font-size:13px;color:var(--muted);margin-bottom:12px;display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.like-bar{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--border);padding:6px 10px;border-radius:4px;font-size:13px}
.like-bar .like-num{color:#7fff8c}
.like-bar .dislike-num{color:#ff7f7f}
.channel-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:12px 0}
.channel-row img{width:48px;height:48px;border-radius:50%}
.channel-row .ch-name{font-weight:600}
.channel-row .ch-sub{font-size:12px;color:var(--muted)}
.action-bar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px}
.action-bar button,.action-bar a{
  background:var(--card);border:1px solid var(--border);color:var(--text);padding:8px 14px;
  font-size:13px;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;
  font-family:inherit;
}
.action-bar button:hover,.action-bar a:hover{background:#2a2a2a;text-decoration:none}
.action-bar .qbtn.active{background:#333;border-color:#666}
.desc-box{background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:14px;margin-bottom:18px}
.desc-box .desc-text{font-size:13px;line-height:1.6;color:#d0d0d0;white-space:pre-wrap;word-wrap:break-word;max-height:140px;overflow:hidden;position:relative;transition:max-height .3s}
.desc-box .desc-text.expanded{max-height:none}
.desc-box .desc-toggle{margin-top:8px;color:var(--accent2);font-size:12px;cursor:pointer;background:none;border:none;padding:0}

/* Sidebar */
.related-list{display:flex;flex-direction:column;gap:10px}
.related-item{display:flex;gap:10px;background:var(--card);border:1px solid var(--border2);border-radius:4px;overflow:hidden}
.related-item:hover{border-color:#555}
.related-item .rt{width:160px;flex-shrink:0;aspect-ratio:16/9;background:#000;position:relative}
.related-item .rt img{width:100%;height:100%;object-fit:cover}
.related-item .ri-body{padding:6px 8px;flex:1;min-width:0}
.related-item .ri-title{font-size:13px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:4px}
.related-item .ri-meta{font-size:11px;color:var(--muted);line-height:1.4}

/* Comments */
.comments-section{margin-top:8px}
.comments-loading{padding:14px;color:var(--muted);font-size:13px;background:var(--card);border:1px solid var(--border2);border-radius:6px;text-align:center}
.comment{padding:12px 0;border-bottom:1px solid var(--border2);display:flex;gap:12px}
.comment img{width:40px;height:40px;border-radius:50%;flex-shrink:0}
.comment .c-body{flex:1;min-width:0}
.comment .c-head{font-size:12px;color:var(--muted);margin-bottom:4px}
.comment .c-head .c-author{color:var(--text);font-weight:600;margin-right:8px}
.comment .c-text{font-size:13px;line-height:1.55;color:#d8d8d8;white-space:pre-wrap;word-wrap:break-word}
.comment .c-actions{font-size:12px;color:var(--muted);margin-top:6px}
.load-more-btn{display:block;margin:16px auto;padding:10px 28px;background:var(--card);border:1px solid var(--border);color:var(--text);font-size:13px;border-radius:4px;cursor:pointer;font-family:inherit}
.load-more-btn:hover{background:#2a2a2a}
.load-more-btn:disabled{opacity:.5;cursor:not-allowed}

/* Channel page */
.channel-banner{width:100%;aspect-ratio:6.2/1;background:#000;background-size:cover;background-position:center;border-radius:6px;margin-bottom:14px}
.channel-header{display:flex;gap:18px;align-items:center;margin-bottom:18px;flex-wrap:wrap}
.channel-header img{width:120px;height:120px;border-radius:50%}
.channel-header .ch-meta-h{flex:1;min-width:240px}
.channel-header h1{font-size:24px;margin-bottom:6px}
.channel-header .ch-sub-h{color:var(--muted);font-size:14px;margin-bottom:8px}
.channel-tabs{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:18px;overflow-x:auto}
.channel-tabs a{padding:10px 18px;font-size:14px;color:var(--muted);border-bottom:2px solid transparent;white-space:nowrap}
.channel-tabs a.active{color:var(--text);border-bottom-color:var(--text)}
.channel-tabs a:hover{color:var(--text);text-decoration:none}

/* Pagination */
.pagination{display:flex;justify-content:center;gap:10px;margin:24px 0}
.pagination a, .pagination span{padding:8px 18px;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:13px}
.pagination a:hover{background:#2a2a2a;text-decoration:none}
.pagination .disabled{opacity:.4;pointer-events:none}

/* Settings */
.settings-form{max-width:640px;margin:20px auto;background:var(--card);border:1px solid var(--border2);border-radius:6px;padding:24px}
.settings-form .field{margin-bottom:16px}
.settings-form label{display:block;font-size:13px;color:var(--muted);margin-bottom:6px}
.settings-form select,.settings-form input[type=text]{
  width:100%;padding:8px 10px;background:#161616;border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:14px;font-family:inherit;
}
.btn-primary{background:#3a6ea5;border:1px solid #4a82c0;color:#fff;padding:9px 22px;border-radius:4px;cursor:pointer;font-size:14px;font-family:inherit}
.btn-primary:hover{background:#4a82c0}

/* Error / notice */
.notice{background:var(--card);border:1px solid var(--border);padding:18px;border-radius:6px;color:#ccc;font-size:14px;line-height:1.6;margin:18px 0}

/* Trending categories */
.trend-cats{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:18px}
.trend-cats a{padding:10px 18px;font-size:14px;color:var(--muted);border-bottom:2px solid transparent}
.trend-cats a.active{color:var(--text);border-bottom-color:var(--text)}
.trend-cats a:hover{color:var(--text);text-decoration:none}
`;
}

function searchIconSvg() {
  // Clean monochrome magnifier (matches Invidious feather-icons style)
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
}

function renderHeader(req, { activePath = '' } = {}) {
  const active = getBackendByCookie(req);
  return `
<header class="iv-header">
  <div class="logo"><a href="/">Invidious</a></div>
  <nav class="nav-links">
    <a href="/feed/popular" class="${activePath==='popular'?'active':''}">人気</a>
    <a href="/feed/trending" class="${activePath==='trending'?'active':''}">急上昇</a>
  </nav>
  <div class="backend-row" id="backend-row">
    <b>Switch backend:</b> ${renderBackendBar(active.id)}
  </div>
  <form class="search-form" action="/search" method="GET" style="margin-left:auto">
    <input type="text" name="q" class="search-input" placeholder="検索" autocomplete="off">
    <button type="submit" class="search-btn" aria-label="検索">${searchIconSvg()}</button>
  </form>
  <div class="top-tools">
    <a href="/preferences" title="設定">⚙</a>
    <a href="/login" title="ログイン">ログイン</a>
  </div>
</header>
<script>
(function(){
  document.querySelectorAll('.backend-link').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      var b = this.getAttribute('data-backend');
      document.cookie = 'backend=' + b + '; path=/; max-age=' + (60*60*24*365);
      location.reload();
    });
  });
})();
</script>`;
}

function renderFooter() {
  return `
<footer class="iv-footer">
  <div>
    <p>⭮ <a href="https://github.com/iv-org/invidious">元のソースコード</a> / 改変し使用中</p>
    <p>🕮 <a href="https://docs.invidious.io/">説明書</a></p>
  </div>
  <div>
    <p>GitHub 上で <a href="https://www.gnu.org/licenses/agpl-3.0.html">AGPLv3</a> の元で公開</p>
    <p><a href="/licenses">JS JavaScriptライセンス情報</a></p>
    <p>🕮 <a href="/privacy">個人情報保護方針</a></p>
  </div>
  <div>
    <p>🗀 <a href="/services">Services</a></p>
    <p>≡ <a href="https://community.invidious.io/">Forum</a></p>
    <p>☕ 寄付する @ Tiekoetter.com</p>
    <p>☕ 寄付する @ Invidious.io</p>
    <p>現在のバージョン: 2026.05.20-mini @ master</p>
  </div>
</footer>`;
}

function pageShell(req, { title, body, activePath = '', extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} - Invidious</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
${PLAYER_CSS_LINKS}
<style>${commonStyles()}</style>
${extraHead}
</head>
<body>
${renderHeader(req, { activePath })}
<main class="iv-main">
${body}
</main>
${renderFooter()}
</body>
</html>`;
}

// ============================================================================
// CARD RENDERERS
// ============================================================================

function renderVideoCard(v) {
  // v is a normalized object
  const vid = v.videoId || v.id;
  const title = v.title || '';
  const thumb = (v.videoThumbnails && v.videoThumbnails[0] && v.videoThumbnails[0].url) ||
                v.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
  const author = v.author || '';
  const authorId = v.authorId || '';
  const viewCount = v.viewCountText || (v.viewCount != null ? formatNumber(v.viewCount) + ' 回視聴' : '');
  const published = v.publishedText || (v.published ? formatTimeAgo(v.published) : '');
  const dur = v.lengthSeconds ? formatDur(v.lengthSeconds) : (v.duration || '');
  const isLive = !!v.liveNow;
  return `
<div class="video-card">
  <a href="/watch?v=${encodeURIComponent(vid)}">
    <div class="thumb-wrap">
      <img loading="lazy" src="${escapeHtml(thumb)}" alt="">
      ${isLive ? '<span class="thumb-live">Live</span>' : (dur ? `<span class="thumb-duration">${escapeHtml(dur)}</span>` : '')}
    </div>
  </a>
  <div class="card-body">
    <a href="/watch?v=${encodeURIComponent(vid)}"><div class="card-title">${escapeHtml(title)}</div></a>
    <div class="card-meta">
      ${authorId ? `<a href="/channel/${encodeURIComponent(authorId)}">${escapeHtml(author)}</a>` : escapeHtml(author)}
      ${viewCount ? `<br>${escapeHtml(viewCount)}${published ? ' • ' + escapeHtml(published) : ''}` : (published ? '<br>' + escapeHtml(published) : '')}
    </div>
  </div>
</div>`;
}

function renderChannelResult(c) {
  const id = c.authorId;
  const name = c.author;
  const thumb = (c.authorThumbnails && c.authorThumbnails[c.authorThumbnails.length-1]?.url) || '';
  const subCount = c.subCount != null ? formatNumber(c.subCount) + ' 人の登録者' : '';
  const vcount = c.videoCount != null ? `${formatNumber(c.videoCount)} 本の動画` : '';
  const desc = c.description || '';
  return `
<div class="channel-result">
  <a href="/channel/${encodeURIComponent(id)}">
    <img src="${escapeHtml(thumb.startsWith('//') ? 'https:' + thumb : thumb)}" alt="">
  </a>
  <div class="ci-info">
    <a href="/channel/${encodeURIComponent(id)}"><div class="ci-name">${escapeHtml(name)}</div></a>
    <div class="ci-meta">${escapeHtml(subCount)}${subCount && vcount ? ' • ' : ''}${escapeHtml(vcount)}</div>
    <div class="ci-desc">${escapeHtml(desc)}</div>
  </div>
</div>`;
}

function renderPlaylistResult(p) {
  const id = p.playlistId;
  const title = p.title;
  const thumb = p.playlistThumbnail || (p.videos && p.videos[0] && p.videos[0].videoThumbnails && p.videos[0].videoThumbnails[0]?.url) || '';
  return `
<div class="video-card">
  <a href="/playlist?list=${encodeURIComponent(id)}">
    <div class="thumb-wrap">
      <img loading="lazy" src="${escapeHtml(thumb)}" alt="">
      <span class="thumb-duration">${formatNumber(p.videoCount)} 本</span>
    </div>
  </a>
  <div class="card-body">
    <a href="/playlist?list=${encodeURIComponent(id)}"><div class="card-title">${escapeHtml(title)}</div></a>
    <div class="card-meta">${escapeHtml(p.author || '')}<br>プレイリスト</div>
  </div>
</div>`;
}

// ============================================================================
// ROUTES
// ============================================================================

// --- Home -------------------------------------------------------------------
app.get('/', (req, res) => {
  const active = getBackendByCookie(req);
  const body = `
<div style="text-align:center;padding:80px 20px;">
  <div style="font-size:64px;font-weight:bold;letter-spacing:2px;color:#a0a0a0;margin-bottom:34px;">INVIDIOUS</div>
  <form class="search-form" action="/search" method="GET" style="display:inline-flex;">
    <input type="text" name="q" class="search-input" placeholder="検索" autofocus autocomplete="off" style="width:500px;max-width:90vw;font-size:17px">
    <button type="submit" class="search-btn" aria-label="検索">${searchIconSvg()}</button>
  </form>
  <div style="margin-top:36px;display:flex;justify-content:center;gap:30px;">
    <a href="/feed/popular" style="color:#9fc7ff">人気の動画</a>
    <a href="/feed/trending" style="color:#9fc7ff">急上昇</a>
  </div>
</div>`;
  res.send(pageShell(req, { title: 'Invidious', body }));
});

// --- Search -----------------------------------------------------------------
app.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const sortBy = req.query.sort_by || 'relevance';
  const dateFilter = req.query.date || '';
  const typeFilter = req.query.type || 'all';

  if (!query) return res.redirect('/');

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
  <div style="font-size:14px;color:var(--muted)">「<span style="color:var(--text)">${escapeHtml(query)}</span>」の検索結果 (ページ ${page})</div>
  <form method="GET" action="/search" style="display:flex;gap:8px;font-size:13px;align-items:center">
    <input type="hidden" name="q" value="${escapeHtml(query)}">
    <select name="sort_by" onchange="this.form.submit()" style="background:#161616;color:var(--text);border:1px solid var(--border);padding:5px 8px;border-radius:3px">
      <option value="relevance" ${sortBy==='relevance'?'selected':''}>関連度</option>
      <option value="rating" ${sortBy==='rating'?'selected':''}>評価</option>
      <option value="upload_date" ${sortBy==='upload_date'?'selected':''}>アップロード日</option>
      <option value="view_count" ${sortBy==='view_count'?'selected':''}>視聴回数</option>
    </select>
    <select name="type" onchange="this.form.submit()" style="background:#161616;color:var(--text);border:1px solid var(--border);padding:5px 8px;border-radius:3px">
      <option value="all" ${typeFilter==='all'?'selected':''}>すべて</option>
      <option value="video" ${typeFilter==='video'?'selected':''}>動画</option>
      <option value="channel" ${typeFilter==='channel'?'selected':''}>チャンネル</option>
      <option value="playlist" ${typeFilter==='playlist'?'selected':''}>プレイリスト</option>
    </select>
  </form>
</div>`;

  let items = [];
  try {
    const params = new URLSearchParams({ q: query, page: String(page), sort_by: sortBy });
    if (dateFilter) params.set('date', dateFilter);
    if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter);
    const { data } = await invFetch(req, '/api/v1/search?' + params.toString(), { timeout: 11000 });
    items = Array.isArray(data) ? data : [];
  } catch (e) {
    // Fall back to youtube-search-api for video-only results
    try {
      const r = await yts.GetListByKeyword(query, false, 24);
      items = (r.items || []).filter(it => it.type === 'video').map(it => ({
        type: 'video', videoId: it.id, title: it.title,
        author: it.channelTitle, authorId: '',
        videoThumbnails: [{ url: it.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg` }],
        lengthSeconds: 0, viewCount: 0, publishedText: it.publishedTimeText || '',
      }));
    } catch (e2) {
      html += `<div class="notice">検索結果を取得できませんでした: ${escapeHtml(e2.message)}</div>`;
    }
  }

  const channels = items.filter(i => i.type === 'channel');
  const playlists = items.filter(i => i.type === 'playlist');
  const videos = items.filter(i => i.type === 'video' || !i.type);

  if (channels.length) {
    html += `<div style="margin-bottom:16px">` + channels.map(renderChannelResult).join('') + `</div>`;
  }
  if (playlists.length) {
    html += `<div class="video-grid" style="margin-bottom:16px">` + playlists.map(renderPlaylistResult).join('') + `</div>`;
  }
  if (videos.length) {
    html += `<div class="video-grid">` + videos.map(renderVideoCard).join('') + `</div>`;
  }
  if (!items.length) {
    html += `<div class="notice">検索結果が見つかりませんでした。</div>`;
  }

  // Pagination
  const params = new URLSearchParams(req.query);
  params.set('page', String(page + 1));
  const prevParams = new URLSearchParams(req.query);
  prevParams.set('page', String(Math.max(1, page - 1)));
  html += `<div class="pagination">
    <a href="/search?${prevParams.toString()}" class="${page<=1?'disabled':''}">← 前のページ</a>
    <span>ページ ${page}</span>
    <a href="/search?${params.toString()}">次のページ →</a>
  </div>`;

  res.send(pageShell(req, { title: `検索: ${query}`, body: html }));
});

// --- Trending / Popular -----------------------------------------------------
app.get('/feed/trending', async (req, res) => {
  const cat = req.query.type || 'default';
  let html = `<div class="trend-cats">
    <a href="/feed/trending" class="${cat==='default'?'active':''}">急上昇</a>
    <a href="/feed/trending?type=music" class="${cat==='music'?'active':''}">音楽</a>
    <a href="/feed/trending?type=gaming" class="${cat==='gaming'?'active':''}">ゲーム</a>
    <a href="/feed/trending?type=movies" class="${cat==='movies'?'active':''}">映画</a>
  </div>`;
  try {
    const path = cat === 'default' ? '/api/v1/trending' : `/api/v1/trending?type=${encodeURIComponent(cat)}`;
    const { data } = await invFetch(req, path, { timeout: 11000 });
    const items = Array.isArray(data) ? data : [];
    html += `<div class="video-grid">` + items.map(renderVideoCard).join('') + `</div>`;
  } catch (e) {
    html += `<div class="notice">急上昇の取得に失敗しました: ${escapeHtml(e.message)}</div>`;
  }
  res.send(pageShell(req, { title: '急上昇', body: html, activePath: 'trending' }));
});

app.get('/feed/popular', async (req, res) => {
  let html = ``;
  try {
    const { data } = await invFetch(req, '/api/v1/popular', { timeout: 11000 });
    const items = Array.isArray(data) ? data : [];
    html += `<h2 class="section-title">人気の動画</h2><div class="video-grid">` + items.map(renderVideoCard).join('') + `</div>`;
  } catch (e) {
    html += `<div class="notice">人気の動画の取得に失敗しました: ${escapeHtml(e.message)}</div>`;
  }
  res.send(pageShell(req, { title: '人気の動画', body: html, activePath: 'popular' }));
});

// --- Watch page -------------------------------------------------------------
app.get('/watch', async (req, res) => {
  const videoId = req.query.v;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.redirect('/');
  }

  // Get metadata (own scraper)
  let meta = null;
  try { meta = await getVideoMeta(videoId); } catch (e) { /* meta will be null */ }

  // Try Invidious metadata as backup for richer info
  let invMeta = null;
  try {
    const { data } = await invFetch(req, `/api/v1/videos/${encodeURIComponent(videoId)}`, { timeout: 8000 });
    invMeta = data;
  } catch (e) { /* ignore */ }

  const title = (meta && meta.title) || (invMeta && invMeta.title) || '動画';
  const author = (meta && meta.author) || (invMeta && invMeta.author) || '';
  const authorId = (meta && meta.authorId) || (invMeta && invMeta.authorId) || '';
  const authorAvatar = (invMeta && invMeta.authorThumbnails && invMeta.authorThumbnails[invMeta.authorThumbnails.length-1]?.url) ||
                       (meta && meta.authorThumbnails && meta.authorThumbnails[0]?.url) || '';
  const subCount = invMeta && invMeta.subCountText ? invMeta.subCountText : '';
  const viewCount = (meta && meta.viewCount) || (invMeta && invMeta.viewCount) || 0;
  const likeCount = (meta && meta.likeCount) || (invMeta && invMeta.likeCount) || 0;
  const published = (invMeta && invMeta.publishedText) || (meta && meta.publishedText) || '';
  const description = (invMeta && invMeta.description) || (meta && meta.description) || '';
  const lengthSeconds = (invMeta && invMeta.lengthSeconds) || (meta && meta.lengthSeconds) || 0;
  const recommended = (invMeta && invMeta.recommendedVideos) || (meta && meta.recommendedVideos) || [];

  const relatedHtml = recommended.slice(0, 20).map(r => {
    const t = (r.videoThumbnails && r.videoThumbnails[0]?.url) || `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`;
    return `<a href="/watch?v=${encodeURIComponent(r.videoId)}" class="related-item">
      <div class="rt"><img loading="lazy" src="${escapeHtml(t)}" alt="">${r.lengthSeconds?`<span class="thumb-duration" style="right:4px;bottom:4px">${formatDur(r.lengthSeconds)}</span>`:''}</div>
      <div class="ri-body">
        <div class="ri-title">${escapeHtml(r.title || '')}</div>
        <div class="ri-meta">${escapeHtml(r.author || '')}<br>${r.viewCountText ? escapeHtml(r.viewCountText) : (r.viewCount ? formatNumber(r.viewCount)+'回視聴' : '')}${r.publishedText ? ' • ' + escapeHtml(r.publishedText) : ''}</div>
      </div>
    </a>`;
  }).join('');

  const body = `
<div class="watch-layout">
  <div>
    <div class="player-wrap">
      <video id="player" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto" poster="https://i.ytimg.com/vi/${escapeHtml(videoId)}/maxresdefault.jpg" data-setup='{"fluid":true}'>
      </video>
      <!-- Hidden audio element used for 720p/1080p (video-only) sync -->
      <audio id="player-audio" preload="auto" style="display:none"></audio>
    </div>

    <h1 class="video-title">${escapeHtml(title)}</h1>
    <div class="video-stats">
      <span>${formatNumber(viewCount)} 回視聴</span>
      ${published ? `<span>• ${escapeHtml(published)}</span>` : ''}
      <span class="like-bar">
        <span>👍 <span class="like-num">${formatNumber(likeCount)}</span></span>
      </span>
    </div>

    <div class="action-bar">
      <button type="button" class="qbtn ${''}" data-q="360">360p</button>
      <button type="button" class="qbtn" data-q="720">720p</button>
      <button type="button" class="qbtn" data-q="1080">1080p</button>
      <a href="https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}" target="_blank" rel="noopener">📋 共有</a>
      <button type="button" id="dlBtn">⬇ ダウンロード</button>
    </div>

    <div class="channel-row">
      ${authorAvatar ? `<a href="/channel/${encodeURIComponent(authorId)}"><img src="${escapeHtml(authorAvatar)}" alt=""></a>` : ''}
      <div>
        <div class="ch-name"><a href="/channel/${encodeURIComponent(authorId)}">${escapeHtml(author)}</a></div>
        <div class="ch-sub">${escapeHtml(subCount)}</div>
      </div>
    </div>

    <div class="desc-box">
      <div class="desc-text" id="descText">${escapeHtml(description)}</div>
      <button class="desc-toggle" id="descToggle">もっと表示</button>
    </div>

    <h3 class="section-title" style="font-size:16px">コメント</h3>
    <div class="comments-section" id="commentsRoot">
      <div class="comments-loading">コメントを読み込み中...</div>
    </div>
  </div>

  <aside>
    <h3 class="section-title" style="font-size:15px;margin-top:0">関連動画</h3>
    <div class="related-list">${relatedHtml || '<div class="notice">関連動画はありません。</div>'}</div>
  </aside>
</div>

${PLAYER_JS_LINKS}
<script>
(function(){
  var VIDEO_ID = ${JSON.stringify(videoId)};
  var player = videojs('player', { fluid: true, playbackRates: [0.5,0.75,1,1.25,1.5,2] });
  var audio = document.getElementById('player-audio');
  var currentQ = '360';

  function streamUrl(q){ return '/stream/' + VIDEO_ID + '?q=' + q; }
  function audioUrl(){ return '/stream/' + VIDEO_ID + '?q=360&audioOnly=1'; }

  function loadQuality(q){
    currentQ = q;
    document.querySelectorAll('.qbtn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-q') === q);
    });
    var t = player.currentTime() || 0;
    var paused = player.paused();
    if (q === '360') {
      audio.pause(); audio.src = '';
      player.src({ src: streamUrl('360'), type: 'video/mp4' });
      player.muted(false);
    } else {
      // video-only stream + synchronized audio track from 360p source
      player.src({ src: streamUrl(q), type: 'video/mp4' });
      player.muted(true);
      audio.src = audioUrl();
      audio.load();
    }
    player.one('loadedmetadata', function(){
      player.currentTime(t);
      if (!paused) player.play();
    });
  }

  // Sync engine for video-only + separate audio
  function syncAudio(){
    if (currentQ === '360') return;
    if (!audio.src) return;
    var drift = (player.currentTime() || 0) - audio.currentTime;
    if (Math.abs(drift) > 0.25) {
      try { audio.currentTime = player.currentTime() || 0; } catch(e){}
    }
  }
  player.on('play',  function(){ if (currentQ !== '360' && audio.src) audio.play().catch(function(){}); });
  player.on('pause', function(){ if (currentQ !== '360') audio.pause(); });
  player.on('seeked',function(){ if (currentQ !== '360' && audio.src){ audio.currentTime = player.currentTime() || 0; } });
  player.on('ratechange', function(){ audio.playbackRate = player.playbackRate(); });
  player.on('volumechange', function(){ if (currentQ !== '360'){ audio.volume = player.volume(); audio.muted = false; } });
  player.on('timeupdate', syncAudio);
  setInterval(syncAudio, 1500);

  document.querySelectorAll('.qbtn').forEach(function(b){
    b.addEventListener('click', function(){ loadQuality(this.getAttribute('data-q')); });
  });
  loadQuality('360');

  // Description expand
  var descText = document.getElementById('descText');
  var descToggle = document.getElementById('descToggle');
  if (descText.scrollHeight <= descText.clientHeight + 4) { descToggle.style.display = 'none'; }
  descToggle.addEventListener('click', function(){
    descText.classList.toggle('expanded');
    descToggle.textContent = descText.classList.contains('expanded') ? '閉じる' : 'もっと表示';
  });

  // Download
  document.getElementById('dlBtn').addEventListener('click', function(){
    var q = currentQ;
    window.open('/stream/' + VIDEO_ID + '?q=' + q + '&dl=1', '_blank');
  });

  // Lazy-load comments after the player is ready
  function loadComments(continuation){
    var root = document.getElementById('commentsRoot');
    if (!continuation) root.innerHTML = '<div class="comments-loading">コメントを読み込み中...</div>';
    var url = '/api/comments/' + VIDEO_ID + (continuation ? '?continuation=' + encodeURIComponent(continuation) : '');
    fetch(url).then(function(r){ return r.json(); }).then(function(data){
      if (!data || (!data.comments && !data.commentCount)) {
        root.innerHTML = '<div class="notice">コメントはありません。</div>';
        return;
      }
      var html = '';
      if (!continuation && data.commentCount != null) {
        html += '<div style="font-size:13px;color:var(--muted);margin-bottom:10px">' + data.commentCount.toLocaleString() + ' 件のコメント</div>';
      }
      (data.comments || []).forEach(function(c){
        var avatar = (c.authorThumbnails && c.authorThumbnails[c.authorThumbnails.length-1] && c.authorThumbnails[c.authorThumbnails.length-1].url) || '';
        html += '<div class="comment">' +
                  '<img src="' + (avatar||'') + '" alt="">' +
                  '<div class="c-body">' +
                    '<div class="c-head"><span class="c-author">' + (c.author||'') + '</span><span>' + (c.publishedText||'') + '</span></div>' +
                    '<div class="c-text">' + (c.content||'').replace(/</g,'&lt;') + '</div>' +
                    '<div class="c-actions">👍 ' + (c.likeCount||0).toLocaleString() + (c.replies && c.replies.replyCount ? ' • ' + c.replies.replyCount + ' 件の返信' : '') + '</div>' +
                  '</div>' +
                '</div>';
      });
      if (data.continuation) {
        html += '<button class="load-more-btn" id="moreBtn">さらに読み込む</button>';
      }
      if (continuation) {
        // append
        var btn = root.querySelector('#moreBtn');
        if (btn) btn.remove();
        root.insertAdjacentHTML('beforeend', html);
      } else {
        root.innerHTML = html;
      }
      var more = root.querySelector('#moreBtn');
      if (more) more.addEventListener('click', function(){
        more.disabled = true; more.textContent = '読み込み中...';
        loadComments(data.continuation);
      });
    }).catch(function(e){
      root.innerHTML = '<div class="notice">コメントの読み込みに失敗しました: ' + e.message + '</div>';
    });
  }
  // Defer until player is ready / next frame so video gets priority
  if ('requestIdleCallback' in window) requestIdleCallback(function(){ loadComments(); }, { timeout: 2500 });
  else setTimeout(loadComments, 1200);
})();
</script>`;

  res.send(pageShell(req, { title, body }));
});

// --- Stream proxy (hides getlate) ------------------------------------------
app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).send('bad id');
  const q = String(req.query.q || '360');
  const fmt = FORMAT_MAP[q] || FORMAT_MAP['360'];
  try {
    const url = await resolveStream(videoId, fmt.id, false);
    if (req.query.dl === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${videoId}_${q}.mp4"`);
    }
    return res.redirect(302, url);
  } catch (e) {
    // Try Invidious as a final fallback: pull formatStreams from /api/v1/videos
    try {
      const { data } = await invFetch(req, `/api/v1/videos/${encodeURIComponent(videoId)}`);
      const streams = (data.formatStreams || []).concat(data.adaptiveFormats || []);
      const want = q === '360' ? '360p' : (q === '720' ? '720p' : '1080p');
      const s = streams.find(s => (s.qualityLabel || s.quality) === want) || streams[0];
      if (s && s.url) return res.redirect(302, s.url);
    } catch (_) {}
    res.status(502).send('stream unavailable');
  }
});

// --- Comments API ----------------------------------------------------------
app.get('/api/comments/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).json({ error: 'bad id' });
  const path = '/api/v1/comments/' + encodeURIComponent(videoId) + (req.query.continuation ? '?continuation=' + encodeURIComponent(req.query.continuation) : '');
  try {
    const { data } = await invFetch(req, path, { timeout: 10000 });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'comments unavailable', detail: e.message });
  }
});

// --- Channel page ----------------------------------------------------------
app.get('/channel/:id', async (req, res) => {
  const { id } = req.params;
  const tab = req.query.tab || 'videos';
  const continuation = req.query.continuation || '';
  let info = null;
  try {
    const { data } = await invFetch(req, `/api/v1/channels/${encodeURIComponent(id)}`, { timeout: 11000 });
    info = data;
  } catch (e) {
    return res.send(pageShell(req, { title: 'チャンネル', body: `<div class="notice">チャンネル情報を取得できませんでした: ${escapeHtml(e.message)}</div>` }));
  }
  const banner = (info.authorBanners && info.authorBanners[0] && info.authorBanners[0].url) || '';
  const avatar = (info.authorThumbnails && info.authorThumbnails[info.authorThumbnails.length-1]?.url) || '';

  // Tab content
  let tabBody = '';
  const tabMap = { videos: 'videos', shorts: 'shorts', streams: 'streams', playlists: 'playlists', podcasts: 'podcasts', channels: 'channels', releases: 'releases' };
  if (tab === 'home') {
    const items = info.latestVideos || [];
    tabBody = `<div class="video-grid">` + items.map(v => renderVideoCard(Object.assign({}, v, { author: info.author, authorId: info.authorId }))).join('') + `</div>`;
  } else if (tab === 'about') {
    tabBody = `<div class="desc-box"><div class="desc-text expanded">${escapeHtml(info.description || '')}</div></div>`;
  } else if (tabMap[tab]) {
    try {
      const q = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
      const { data } = await invFetch(req, `/api/v1/channels/${encodeURIComponent(id)}/${tabMap[tab]}${q}`, { timeout: 11000 });
      let items = [];
      if (Array.isArray(data)) items = data;
      else if (data && data.videos) items = data.videos;
      else if (data && data.playlists) items = data.playlists;
      else if (data && data.channels) items = data.channels;
      else if (data && data.items) items = data.items;
      if (tab === 'playlists') {
        tabBody = `<div class="video-grid">` + items.map(p => renderPlaylistResult(Object.assign({}, p, { author: info.author }))).join('') + `</div>`;
      } else if (tab === 'channels') {
        tabBody = `<div>` + items.map(c => renderChannelResult(c)).join('') + `</div>`;
      } else {
        tabBody = `<div class="video-grid">` + items.map(v => renderVideoCard(Object.assign({}, v, { author: v.author || info.author, authorId: v.authorId || info.authorId }))).join('') + `</div>`;
      }
      if (data && data.continuation) {
        tabBody += `<div class="pagination"><a href="/channel/${encodeURIComponent(id)}?tab=${tab}&continuation=${encodeURIComponent(data.continuation)}">次のページ →</a></div>`;
      }
    } catch (e) {
      tabBody = `<div class="notice">読み込みに失敗しました: ${escapeHtml(e.message)}</div>`;
    }
  }

  const body = `
${banner ? `<div class="channel-banner" style="background-image:url('${escapeHtml(banner)}')"></div>` : ''}
<div class="channel-header">
  <img src="${escapeHtml(avatar)}" alt="">
  <div class="ch-meta-h">
    <h1>${escapeHtml(info.author || '')}</h1>
    <div class="ch-sub-h">${info.subCount ? formatNumber(info.subCount) + ' 人の登録者' : ''}${info.totalViews ? ' • 総再生回数 ' + formatNumber(info.totalViews) : ''}</div>
  </div>
  <form action="/search" method="GET" class="search-form">
    <input type="hidden" name="ucid" value="${escapeHtml(id)}">
    <input type="text" name="q" class="search-input" placeholder="チャンネル内検索">
    <button type="submit" class="search-btn">${searchIconSvg()}</button>
  </form>
</div>
<div class="channel-tabs">
  <a href="/channel/${encodeURIComponent(id)}?tab=videos"  class="${tab==='videos'?'active':''}">動画</a>
  <a href="/channel/${encodeURIComponent(id)}?tab=shorts"  class="${tab==='shorts'?'active':''}">ショート</a>
  <a href="/channel/${encodeURIComponent(id)}?tab=streams" class="${tab==='streams'?'active':''}">ライブ</a>
  <a href="/channel/${encodeURIComponent(id)}?tab=playlists" class="${tab==='playlists'?'active':''}">プレイリスト</a>
  <a href="/channel/${encodeURIComponent(id)}?tab=podcasts" class="${tab==='podcasts'?'active':''}">ポッドキャスト</a>
  <a href="/channel/${encodeURIComponent(id)}?tab=releases" class="${tab==='releases'?'active':''}">リリース</a>
  <a href="/channel/${encodeURIComponent(id)}?tab=channels" class="${tab==='channels'?'active':''}">関連チャンネル</a>
  <a href="/channel/${encodeURIComponent(id)}?tab=about" class="${tab==='about'?'active':''}">概要</a>
</div>
${tabBody}`;
  res.send(pageShell(req, { title: info.author || 'チャンネル', body }));
});

// Channel handle alias
app.get('/c/:handle', (req, res) => res.redirect('/channel/' + encodeURIComponent(req.params.handle)));
app.get('/@:handle', (req, res) => res.redirect('/channel/' + encodeURIComponent('@' + req.params.handle)));
app.get('/user/:handle', (req, res) => res.redirect('/channel/' + encodeURIComponent(req.params.handle)));

// --- Playlist page ----------------------------------------------------------
app.get('/playlist', async (req, res) => {
  const list = req.query.list;
  const page = parseInt(req.query.page) || 1;
  if (!list) return res.redirect('/');
  let info = null;
  try {
    const { data } = await invFetch(req, `/api/v1/playlists/${encodeURIComponent(list)}?page=${page}`, { timeout: 11000 });
    info = data;
  } catch (e) {
    return res.send(pageShell(req, { title: 'プレイリスト', body: `<div class="notice">プレイリストを取得できませんでした: ${escapeHtml(e.message)}</div>` }));
  }
  const videos = info.videos || [];
  const body = `
<div style="display:flex;gap:18px;margin-bottom:18px;flex-wrap:wrap;align-items:flex-start">
  ${info.playlistThumbnail ? `<img src="${escapeHtml(info.playlistThumbnail)}" alt="" style="width:280px;border-radius:6px">` : ''}
  <div style="flex:1;min-width:240px">
    <h1 style="font-size:22px;margin-bottom:8px">${escapeHtml(info.title || '')}</h1>
    <div style="color:var(--muted);font-size:13px;margin-bottom:8px">
      ${info.author ? `<a href="/channel/${encodeURIComponent(info.authorId)}">${escapeHtml(info.author)}</a>` : ''}
      ${info.videoCount != null ? ` • ${formatNumber(info.videoCount)} 本の動画` : ''}
      ${info.viewCount ? ` • ${formatNumber(info.viewCount)} 回視聴` : ''}
    </div>
    <div style="font-size:13px;color:#bbb;line-height:1.6">${escapeHtml(info.description || '')}</div>
  </div>
</div>
<div class="video-grid">${videos.map(renderVideoCard).join('')}</div>
<div class="pagination">
  <a href="/playlist?list=${encodeURIComponent(list)}&page=${Math.max(1,page-1)}" class="${page<=1?'disabled':''}">← 前のページ</a>
  <span>ページ ${page}</span>
  <a href="/playlist?list=${encodeURIComponent(list)}&page=${page+1}">次のページ →</a>
</div>`;
  res.send(pageShell(req, { title: info.title || 'プレイリスト', body }));
});

// --- Hashtag page -----------------------------------------------------------
app.get('/hashtag/:tag', async (req, res) => {
  const { tag } = req.params;
  try {
    const { data } = await invFetch(req, `/api/v1/hashtag/${encodeURIComponent(tag)}`, { timeout: 11000 });
    const items = (data && data.results) || [];
    const body = `<h1 style="font-size:24px;margin-bottom:18px">#${escapeHtml(tag)}</h1>
<div class="video-grid">${items.map(renderVideoCard).join('')}</div>`;
    res.send(pageShell(req, { title: '#' + tag, body }));
  } catch (e) {
    res.send(pageShell(req, { title: '#' + tag, body: `<div class="notice">${escapeHtml(e.message)}</div>` }));
  }
});

// --- Post page -------------------------------------------------------------
app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  const ucid = req.query.ucid || '';
  try {
    const { data } = await invFetch(req, `/api/v1/post/${encodeURIComponent(id)}${ucid?'?ucid='+encodeURIComponent(ucid):''}`, { timeout: 10000 });
    const body = `<div class="desc-box"><h2>${escapeHtml(data.author || '')}</h2>
<div style="color:var(--muted);font-size:12px;margin:6px 0">${escapeHtml(data.publishedText || '')}</div>
<div class="desc-text expanded" style="margin-top:10px">${escapeHtml(data.content || '')}</div></div>`;
    res.send(pageShell(req, { title: '投稿', body }));
  } catch (e) {
    res.send(pageShell(req, { title: '投稿', body: `<div class="notice">${escapeHtml(e.message)}</div>` }));
  }
});

// --- Preferences / Settings ------------------------------------------------
app.get('/preferences', (req, res) => {
  const active = getBackendByCookie(req);
  const body = `
<form class="settings-form" method="POST" action="/preferences">
  <h2 style="margin-bottom:18px">環境設定</h2>
  <div class="field">
    <label>優先バックエンド</label>
    <select name="backend">
      ${INVIDIOUS_INSTANCES.map(b => `<option value="${b.id}" ${active.id===b.id?'selected':''}>${b.id} (${b.region}) — ${b.url}</option>`).join('')}
    </select>
  </div>
  <div class="field">
    <label>既定の画質</label>
    <select name="quality">
      <option value="360">360p</option>
      <option value="720">720p</option>
      <option value="1080" selected>1080p</option>
    </select>
  </div>
  <div class="field">
    <label>テーマ</label>
    <select name="theme">
      <option value="dark" selected>ダーク</option>
      <option value="light">ライト</option>
    </select>
  </div>
  <div class="field">
    <label>言語</label>
    <select name="locale">
      <option value="ja" selected>日本語</option>
      <option value="en">English</option>
    </select>
  </div>
  <button class="btn-primary" type="submit">保存</button>
</form>`;
  res.send(pageShell(req, { title: '環境設定', body }));
});
app.post('/preferences', express.urlencoded({ extended: false }), (req, res) => {
  const b = (req.body && req.body.backend) || 'B6';
  res.setHeader('Set-Cookie', `backend=${b}; Path=/; Max-Age=${60*60*24*365}`);
  res.redirect('/preferences');
});

// --- Login / Register stubs ------------------------------------------------
app.get('/login', (req, res) => {
  const body = `
<form class="settings-form" method="POST" action="/login">
  <h2 style="margin-bottom:18px">ログイン</h2>
  <div class="field"><label>ユーザー名</label><input type="text" name="username"></div>
  <div class="field"><label>パスワード</label><input type="text" name="password"></div>
  <div style="display:flex;gap:10px;align-items:center">
    <button class="btn-primary" type="submit">ログイン</button>
    <a href="/login?type=register" style="color:var(--accent2);font-size:13px">アカウントを作成</a>
  </div>
  <div class="notice" style="margin-top:18px">この公開インスタンスではアカウント機能は限定的に提供されています。設定はブラウザの Cookie に保存されます。</div>
</form>`;
  res.send(pageShell(req, { title: 'ログイン', body }));
});
app.post('/login', express.urlencoded({ extended: false }), (req, res) => res.redirect('/'));

// --- Subscriptions / Feed / History / Playlists (placeholder views) --------
function placeholderPage(title, msg) {
  return `<div class="notice"><h2 style="margin-bottom:10px">${escapeHtml(title)}</h2><p>${escapeHtml(msg)}</p></div>`;
}
app.get('/feed/subscriptions', (req, res) => res.send(pageShell(req, { title: '登録チャンネル', body: placeholderPage('登録チャンネル', 'ログインすると登録チャンネルのフィードが表示されます。') })));
app.get('/feed/history',       (req, res) => res.send(pageShell(req, { title: '視聴履歴', body: placeholderPage('視聴履歴', '視聴履歴はブラウザに保存されています。') })));
app.get('/feed/playlists',     (req, res) => res.send(pageShell(req, { title: 'プレイリスト', body: placeholderPage('プレイリスト', '保存したプレイリストはここに表示されます。') })));
app.get('/feed/library',       (req, res) => res.send(pageShell(req, { title: 'ライブラリ', body: placeholderPage('ライブラリ', '保存した動画はここに表示されます。') })));

// --- Static page stubs -----------------------------------------------------
app.get('/privacy', (req, res) => res.send(pageShell(req, { title: '個人情報保護方針', body: `<div class="notice"><h2>個人情報保護方針</h2><p style="margin-top:8px">このインスタンスはユーザーの個人情報を最小限のみ取り扱います。アクセスログは一時的に保持され、定期的に消去されます。Cookie は設定の保存のためにのみ使用されます。</p></div>` })));
app.get('/licenses', (req, res) => res.send(pageShell(req, { title: 'ライセンス', body: `<div class="notice"><h2>JavaScript ライセンス情報</h2><p style="margin-top:8px">この Invidious インスタンスでは GNU AGPLv3 でライセンスされたコードを使用しています。</p></div>` })));
app.get('/services', (req, res) => res.send(pageShell(req, { title: 'サービス', body: `<div class="notice"><h2>関連サービス</h2><p style="margin-top:8px">Tor / I2P アクセスや RSS フィードなどが利用可能です。</p></div>` })));

// --- Invidious-compatible JSON API (re-exposed from our backend pool) -----
app.get('/api/v1/videos/:id', async (req, res) => {
  try { const { data } = await invFetch(req, `/api/v1/videos/${encodeURIComponent(req.params.id)}`); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/search', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try { const { data } = await invFetch(req, '/api/v1/search?' + qs); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/trending', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try { const { data } = await invFetch(req, '/api/v1/trending' + (qs?'?'+qs:'')); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/popular', async (req, res) => {
  try { const { data } = await invFetch(req, '/api/v1/popular'); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/channels/:id', async (req, res) => {
  try { const { data } = await invFetch(req, `/api/v1/channels/${encodeURIComponent(req.params.id)}`); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/channels/:id/:tab', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try { const { data } = await invFetch(req, `/api/v1/channels/${encodeURIComponent(req.params.id)}/${encodeURIComponent(req.params.tab)}${qs?'?'+qs:''}`); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/playlists/:id', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try { const { data } = await invFetch(req, `/api/v1/playlists/${encodeURIComponent(req.params.id)}${qs?'?'+qs:''}`); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/comments/:id', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try { const { data } = await invFetch(req, `/api/v1/comments/${encodeURIComponent(req.params.id)}${qs?'?'+qs:''}`); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/captions/:id', async (req, res) => {
  try { const { data } = await invFetch(req, `/api/v1/captions/${encodeURIComponent(req.params.id)}`); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/search/suggestions', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try { const { data } = await invFetch(req, '/api/v1/search/suggestions?' + qs); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/resolveurl', async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  try { const { data } = await invFetch(req, '/api/v1/resolveurl?' + qs); res.json(data); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
app.get('/api/v1/stats', async (req, res) => {
  res.json({
    version: '2.20260520-1-mini', software: { name: 'invidious', version: 'mini', branch: 'master' },
    openRegistrations: false, usage: { users: { total: 0, activeHalfyear: 0, activeMonth: 0 } },
    metadata: { updatedAt: Math.floor(Date.now()/1000), lastChannelRefreshedAt: Math.floor(Date.now()/1000) },
  });
});

// --- Health probe so the backend indicators show actual status ------------
async function probeBackends() {
  await Promise.all(INVIDIOUS_INSTANCES.map(async (b) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(b.url + '/api/v1/stats', { method: 'GET', signal: ctrl.signal, headers: { 'User-Agent': getUA() }, dispatcher: AGENT });
      clearTimeout(t);
      backendHealth.set(b.id, { ok: r.ok, lastCheck: Date.now() });
    } catch {
      backendHealth.set(b.id, { ok: false, lastCheck: Date.now() });
    }
  }));
}
probeBackends();
setInterval(probeBackends, 5 * 60 * 1000);

// --- Favicon stub ----------------------------------------------------------
app.get('/favicon.ico', (req, res) => res.status(204).end());

// --- 404 -------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).send(pageShell(req, { title: '404', body: `<div class="notice"><h2>404 - お探しのページは見つかりませんでした</h2><p><a href="/" style="color:var(--accent2)">ホームに戻る</a></p></div>` }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Invidious-mini v${VERSION} on port ${PORT}`));
