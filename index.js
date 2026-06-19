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
/* ============================================================
 *  INVIDIOUS-MINI front-end & extended routes
 *  製作者: Kakinie
 *  (NOTE: legacy /yt-sc scraper above is preserved as-is)
 * ============================================================ */

// -------- shared in-memory caches --------
const videoCache    = new Map(); // stream url cache  (60s)
const metaCache     = new Map(); // /yt-sc meta cache (5min)
const invCache      = new Map(); // invidious json cache (3min)

function cacheGet(map, key) {
  const v = map.get(key);
  if (!v) return null;
  if (v.expiry > Date.now()) return v.value;
  map.delete(key);
  return null;
}
function cacheSet(map, key, value, ttlMs) {
  map.set(key, { value, expiry: Date.now() + ttlMs });
}

// -------- HTML escape --------
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escAttr(s) { return esc(s); }
function nl2br(s) { return esc(s || '').replace(/\n/g, '<br>'); }

// ============================================================
//   Backend (Invidious instance) rotation - B1..B8
// ============================================================
const INVIDIOUS_INSTANCES = [
  { id: 'B1', label: 'B1 (CL)', url: 'https://invidious.ritoge.com'      },
  { id: 'B2', label: 'B2 (US)', url: 'https://yt.omada.cafe'             },
  { id: 'B3', label: 'B3 (US)', url: 'https://invidious.darkness.services'},
  { id: 'B4', label: 'B4 (US)', url: 'https://invidious.f5.si'           },
  { id: 'B5', label: 'B5 (US)', url: 'https://invidious.ducks.party'     },
  { id: 'B6', label: 'B6 (US)', url: 'https://y.com.sb'                  },
  { id: 'B7', label: 'B7 (DE)', url: 'https://super8.absturztau.be'      },
  { id: 'B8', label: 'B8 (DE)', url: 'https://inv.zoomerville.com'       },
];
const INVIDIOUS_EXTRA_FALLBACK = [
  'https://invidious.nerdvpn.de',
  'https://inv.thepixora.com',
];

function pickBackend(req) {
  const b = (req.query.backend || req.cookies_b || '').toString().toUpperCase();
  const found = INVIDIOUS_INSTANCES.find(x => x.id === b);
  return found || INVIDIOUS_INSTANCES[0];
}

// poor-man's cookie reader (no extra deps)
app.use((req, _res, next) => {
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(p => {
    const [k, ...rest] = p.trim().split('=');
    if (k === 'backend') req.cookies_b = decodeURIComponent(rest.join('='));
  });
  next();
});

// switch backend via cookie + redirect-back
app.get('/switch-backend', (req, res) => {
  const id = (req.query.b || '').toString().toUpperCase();
  const back = req.query.r || '/';
  if (INVIDIOUS_INSTANCES.find(x => x.id === id)) {
    res.setHeader('Set-Cookie', `backend=${id}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }
  res.redirect(back);
});

async function invFetch(req, path, { ttlMs = 180000, params = '' } = {}) {
  const cacheKey = (pickBackend(req).id) + '|' + path + '|' + params;
  const hit = cacheGet(invCache, cacheKey);
  if (hit) return hit;

  const primary = pickBackend(req);
  const order = [
    primary.url,
    ...INVIDIOUS_INSTANCES.filter(x => x.id !== primary.id).map(x => x.url),
    ...INVIDIOUS_EXTRA_FALLBACK,
  ];
  let lastErr;
  for (const base of order) {
    try {
      const u = base + path + (params ? (path.includes('?') ? '&' : '?') + params : '');
      const r = await fetch(u, {
        method: 'GET',
        headers: { 'User-Agent': getUA(), 'Accept': 'application/json' },
        dispatcher: AGENT,
        signal: AbortSignal.timeout(9000),
      });
      if (!r.ok) { lastErr = new Error('HTTP ' + r.status + ' @ ' + base); continue; }
      const j = await r.json();
      cacheSet(invCache, cacheKey, j, ttlMs);
      return j;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all backends failed');
}

// ============================================================
//   /stream/:videoId  – proxied stream URL resolver
//   (obfuscated style preserved, getlate.dev hidden)
// ============================================================
function _deob(arr, k) { return arr.map(c => String.fromCharCode(c - k)).join(''); }
const _SX = {
  // getlate.dev/api/tools/youtube-live-downloader?url=...&formatId=
  a: [0x79,0x85,0x85,0x81,0x84,0x4b,0x40,0x40,0x78,0x76,0x85,0x7d,0x72,0x85,0x76,0x3f,0x75,0x76,0x87,0x40,0x72,0x81,0x7a,0x40,0x85,0x80,0x80,0x7d,0x84,0x40,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3e,0x7d,0x7a,0x87,0x76,0x3e,0x75,0x80,0x88,0x7f,0x7d,0x80,0x72,0x75,0x76,0x83,0x50,0x86,0x83,0x7d,0x4e,0x79,0x85,0x85,0x81,0x84,0x36,0x44,0x52,0x36,0x43,0x57,0x36,0x43,0x57,0x88,0x88,0x88,0x3f,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3f,0x74,0x80,0x7e,0x36,0x43,0x57,0x88,0x72,0x85,0x74,0x79,0x36,0x44,0x57,0x87,0x36,0x44,0x55],
  // getlate.dev/api/tools/youtube-video-downloader?url=...&formatId=
  b: [0x79,0x85,0x85,0x81,0x84,0x4b,0x40,0x40,0x78,0x76,0x85,0x7d,0x72,0x85,0x76,0x3f,0x75,0x76,0x87,0x40,0x72,0x81,0x7a,0x40,0x85,0x80,0x80,0x7d,0x84,0x40,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3e,0x87,0x7d,0x75,0x76,0x80,0x3e,0x75,0x80,0x88,0x7f,0x7d,0x80,0x72,0x75,0x76,0x83,0x50,0x86,0x83,0x7d,0x4e,0x79,0x85,0x85,0x81,0x84,0x36,0x44,0x52,0x36,0x43,0x57,0x36,0x43,0x57,0x88,0x88,0x88,0x3f,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3f,0x74,0x80,0x7e,0x36,0x43,0x57,0x88,0x72,0x85,0x74,0x79,0x36,0x44,0x57,0x87,0x36,0x44,0x55],
  c: [0x37,0x77,0x80,0x83,0x7e,0x72,0x85,0x5a,0x75,0x4e],
};
function buildSrcUrl(kind, videoId, formatId) {
  const base = _deob(kind === 'b' ? _SX.b : _SX.a, 0x11);
  const tail = _deob(_SX.c, 0x11) + formatId;
  return base + videoId + tail;
}

async function resolveStream(videoId, formatId, kind = 'a') {
  const cacheKey = `${kind}|${videoId}|${formatId}`;
  const hit = cacheGet(videoCache, cacheKey);
  if (hit) return hit;

  const targetUrl = buildSrcUrl(kind, videoId, formatId);
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      'Accept': '*/*',
    },
    redirect: 'follow',
    dispatcher: AGENT,
    signal: AbortSignal.timeout(15000),
  });
  const finalUrl = response.url;
  if (!finalUrl || !/^https?:/i.test(finalUrl)) throw new Error('no redirect target');
  cacheSet(videoCache, cacheKey, finalUrl, 60000);
  return finalUrl;
}

// public stream endpoints
//   /stream/:id          -> 360p video+audio (formatId=2)
//   /stream/:id?q=1080   -> 1080p video only (formatId=5)
//   /stream/:id?q=720    -> 720p  video only (formatId=4)
//   /stream/:id?q=360    -> 360p alias
app.get('/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).send('bad id');
  const q = (req.query.q || '360').toString();
  let fmt = '2';
  if (q === '1080') fmt = '5';
  else if (q === '720')  fmt = '4';
  else if (q === '360')  fmt = '2';

  try {
    let url;
    try { url = await resolveStream(videoId, fmt, 'a'); }
    catch { url = await resolveStream(videoId, fmt, 'b'); }
    res.type('text/plain').send(url);
  } catch (e) {
    console.error('stream err', e.message);
    res.status(502).send('upstream unavailable');
  }
});

// audio-only companion (always 360p container which has audio)
app.get('/stream-audio/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).send('bad id');
  try {
    let url;
    try { url = await resolveStream(videoId, '2', 'a'); }
    catch { url = await resolveStream(videoId, '2', 'b'); }
    res.type('text/plain').send(url);
  } catch (e) { res.status(502).send('upstream unavailable'); }
});

// keep legacy /scratch-edu/:id alias (referenced in obfuscated snippet)
app.get('/scratch-edu/:id', async (req, res) => {
  req.params.videoId = req.params.id;
  return app._router.handle(Object.assign(req, { url: '/stream/' + req.params.id }), res, () => {});
});

// ============================================================
//   videojs / css assets proxy
//   (so that the <link> / <script> tags in pages resolve)
// ============================================================
const CDN_MAP = {
  '/videojs/video.js/video.js':                                  'https://cdn.jsdelivr.net/npm/video.js@8.10.0/dist/video.min.js',
  '/videojs/video.js/video-js.css':                              'https://cdn.jsdelivr.net/npm/video.js@8.10.0/dist/video-js.min.css',
  '/videojs/videojs-mobile-ui/videojs-mobile-ui.js':             'https://cdn.jsdelivr.net/npm/videojs-mobile-ui@1.1.1/dist/videojs-mobile-ui.min.js',
  '/videojs/videojs-mobile-ui/videojs-mobile-ui.css':            'https://cdn.jsdelivr.net/npm/videojs-mobile-ui@1.1.1/dist/videojs-mobile-ui.css',
  '/videojs/videojs-contrib-quality-levels/videojs-contrib-quality-levels.js':
                                                                 'https://cdn.jsdelivr.net/npm/videojs-contrib-quality-levels@4.1.0/dist/videojs-contrib-quality-levels.min.js',
  '/videojs/videojs-http-source-selector/videojs-http-source-selector.js':
                                                                 'https://cdn.jsdelivr.net/npm/videojs-http-source-selector@1.1.6/dist/videojs-http-source-selector.min.js',
  '/videojs/videojs-http-source-selector/videojs-http-source-selector.css':
                                                                 'https://cdn.jsdelivr.net/npm/videojs-http-source-selector@1.1.6/dist/videojs-http-source-selector.css',
  '/videojs/videojs-markers/videojs-markers.js':                 'https://cdn.jsdelivr.net/npm/videojs-markers@1.0.1/dist/videojs.markers.min.js',
  '/videojs/videojs-markers/videojs.markers.css':                'https://cdn.jsdelivr.net/npm/videojs-markers@1.0.1/dist/videojs.markers.min.css',
  '/videojs/videojs-share/videojs-share.js':                     'https://cdn.jsdelivr.net/npm/videojs-share@3.2.1/dist/videojs-share.min.js',
  '/videojs/videojs-share/videojs-share.css':                    'https://cdn.jsdelivr.net/npm/videojs-share@3.2.1/dist/videojs-share.min.css',
  '/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.js':   'https://cdn.jsdelivr.net/npm/videojs-vtt-thumbnails-freetube@0.0.15/dist/videojs-vtt-thumbnails.min.js',
  '/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css':  'https://cdn.jsdelivr.net/npm/videojs-vtt-thumbnails-freetube@0.0.15/dist/videojs-vtt-thumbnails.css',
};
const _assetCache = new Map();
app.get(/^\/(videojs|css)\/.*$/, async (req, res) => {
  // strip ?v=
  const cleanPath = req.path;
  // css inline route
  if (cleanPath === '/css/player.css') {
    res.type('text/css').send(PLAYER_CSS);
    return;
  }
  const target = CDN_MAP[cleanPath];
  if (!target) return res.status(404).send('not mapped');
  const hit = _assetCache.get(target);
  if (hit) {
    res.setHeader('Content-Type', hit.type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(hit.body);
  }
  try {
    const r = await fetch(target, { headers: { 'User-Agent': getUA() }, dispatcher: AGENT, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return res.status(502).send('bad gateway');
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get('content-type') || (target.endsWith('.css') ? 'text/css' : 'application/javascript');
    _assetCache.set(target, { body: buf, type: ct });
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) {
    res.status(502).send('asset err');
  }
});

const PLAYER_CSS = `
.video-js{font-family:inherit}
.vjs-default-skin{color:#fff}
.video-js .vjs-big-play-button{background-color:rgba(0,0,0,.55);border:2px solid #fff;border-radius:50%;width:80px;height:80px;line-height:76px;font-size:40px;left:50%;top:50%;margin-left:-40px;margin-top:-40px}
.video-js .vjs-control-bar{background:linear-gradient(0deg,rgba(0,0,0,.8),transparent)}
.vjs-poster{background-size:cover}
.player-wrap{position:relative;width:100%;background:#000;aspect-ratio:16/9;max-height:78vh}
.player-wrap .video-js{width:100%;height:100%}
`;

// ============================================================
//   Shared HTML chunks (logo, navbar, head, footer)
// ============================================================
const LOGO_SVG = `<svg viewBox="0 0 100 100" width="34" height="34" xmlns="http://www.w3.org/2000/svg" aria-label="Invidious">
  <circle cx="50" cy="50" r="46" fill="#ffffff" stroke="#d0d0d0" stroke-width="1.5"/>
  <path d="M50 22 L72 80 H62 L57 66 H43 L38 80 H28 Z M50 38 L46 58 H54 Z" fill="#3a3a3a"/>
  <circle cx="50" cy="22" r="5.5" fill="#1d9cff"/>
</svg>`;

const SEARCH_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const MOON_SVG   = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const GEAR_SVG   = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const USER_SVG   = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

function renderBackendStrip(currentId, returnPath) {
  return INVIDIOUS_INSTANCES.map(b => {
    const active = b.id === currentId;
    const text = `${esc(b.label)}`;
    return `<a class="bk ${active?'bk-active':''}" href="/switch-backend?b=${b.id}&r=${encodeURIComponent(returnPath)}">${text} <span class="bk-bar">❚</span></a>`;
  }).join(' | ');
}

const INVIDIOUS_CSS = `
:root{
  --bg:#f8f8f8;--bg-card:#ffffff;--text:#222;--muted:#666;--border:#dadada;
  --accent:#3a3a3a;--accent-hover:#000;--link:#1769aa;--btn:#e4e4e4;
  --nav-bg:#ffffff;--search-bar:#bbb;
}
html[data-theme="dark"]{
  --bg:#1f1f1f;--bg-card:#262626;--text:#ececec;--muted:#9c9c9c;--border:#3a3a3a;
  --accent:#ddd;--accent-hover:#fff;--link:#69b7ff;--btn:#333;
  --nav-bg:#1a1a1a;--search-bar:#666;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans JP",sans-serif;font-size:14px;line-height:1.5;min-height:100vh;display:flex;flex-direction:column}
a{color:inherit;text-decoration:none}
a:hover{text-decoration:underline}
.container{max-width:1280px;width:100%;margin:0 auto;padding:0 14px}
main{flex:1;width:100%}
.topbar{background:var(--nav-bg);border-bottom:1px solid var(--border);padding:6px 14px;font-size:13px;display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.bk-strip{flex:1;min-width:0;color:var(--muted)}
.bk{color:var(--link);text-decoration:none;margin-right:2px;white-space:nowrap}
.bk:hover{text-decoration:underline}
.bk-active{font-weight:bold;text-decoration:underline}
.bk-bar{color:#3aa15a;font-weight:bold}
.topbar-right{display:flex;align-items:center;gap:14px;color:var(--muted)}
.topbar-right a{display:inline-flex;align-items:center;gap:4px;color:var(--muted)}
.topbar-right a:hover{color:var(--accent-hover);text-decoration:none}
.navbar{background:var(--nav-bg);border-bottom:1px solid var(--border);padding:8px 14px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.brand{display:inline-flex;align-items:center;gap:10px;font-size:20px;font-weight:bold;letter-spacing:1px;color:var(--accent)}
.brand:hover{text-decoration:none;color:var(--accent-hover)}
.nav-tabs{display:flex;gap:18px;font-size:14px}
.nav-tabs a{color:var(--text);padding:6px 2px}
.search-form{flex:1;max-width:520px;display:flex;align-items:center;position:relative}
.search-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--search-bar);color:var(--text);font-size:15px;padding:6px 32px 6px 4px;outline:none}
.search-input:focus{border-bottom-color:#e67e22}
.search-btn{position:absolute;right:4px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--muted);cursor:pointer;display:inline-flex;padding:4px}
.search-btn:hover{color:var(--accent-hover)}
.home-hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px 80px;text-align:center}
.home-hero .brand-big{font-size:64px;font-weight:bold;letter-spacing:4px;color:var(--accent);margin:30px 0 24px;display:flex;align-items:center;gap:14px}
.home-hero .brand-big svg{width:48px;height:48px}
.home-hero .home-search{width:560px;max-width:92vw}
.subnav{display:flex;justify-content:center;gap:30px;padding:6px 0 0;font-size:14px}
.subnav a{color:var(--muted)}
.subnav a:hover{color:var(--accent-hover);text-decoration:none}
.section-title{padding:14px 0 10px;font-size:15px;font-weight:bold;border-bottom:1px solid var(--border);margin-bottom:14px}
.video-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;padding:14px 0}
.vcard{background:var(--bg-card);border:1px solid var(--border);border-radius:3px;overflow:hidden;display:flex;flex-direction:column}
.vcard .thumb{position:relative;width:100%;aspect-ratio:16/9;background:#000;display:block;overflow:hidden}
.vcard .thumb img{width:100%;height:100%;object-fit:cover;display:block}
.vcard .thumb .dur{position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.78);color:#fff;font-size:12px;padding:1px 5px;border-radius:2px}
.vcard .vbody{padding:10px 10px 12px}
.vcard .vtitle{font-size:14px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--text)}
.vcard .vmeta{color:var(--muted);font-size:12px;margin-top:6px;display:flex;flex-direction:column;gap:2px}
.vcard .vmeta a{color:var(--muted)}
.vcard .vmeta a:hover{color:var(--accent-hover);text-decoration:none}
.pager{display:flex;justify-content:center;gap:10px;padding:24px 0 40px}
.pager a,.pager span{display:inline-block;padding:6px 14px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);border-radius:2px;font-size:14px}
.pager a:hover{background:var(--btn);text-decoration:none}
.filter-bar{padding:10px 0;font-size:13px;color:var(--muted);display:flex;gap:14px;align-items:center;border-bottom:1px solid var(--border);margin-bottom:6px}
.filter-bar .filter-toggle{cursor:pointer;color:var(--link)}
.footer{border-top:1px solid var(--border);background:var(--nav-bg);padding:24px 14px;color:var(--muted);font-size:12px}
.footer .fcols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px;max-width:1280px;margin:0 auto}
.footer a{color:var(--muted)}
.footer a:hover{color:var(--accent-hover);text-decoration:underline}

/* === watch page === */
.watch-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;padding:14px 0}
@media(max-width:960px){.watch-grid{grid-template-columns:1fr}}
.watch-main{min-width:0}
.h-title{font-size:20px;font-weight:600;margin:10px 0 6px;word-break:break-word}
.h-meta{color:var(--muted);font-size:13px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px}
.author-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.author-row img{width:46px;height:46px;border-radius:50%}
.author-info{display:flex;flex-direction:column}
.author-info .a-name{font-weight:600}
.author-info .a-subs{color:var(--muted);font-size:12px}
.subscribe-btn{margin-left:auto;background:var(--btn);color:var(--text);padding:6px 14px;border-radius:2px;border:1px solid var(--border);font-size:13px;cursor:pointer}
.subscribe-btn:hover{background:var(--accent);color:var(--bg)}
.action-row{display:flex;flex-wrap:wrap;gap:8px;padding:10px 0;border-bottom:1px solid var(--border)}
.action-btn{background:var(--btn);color:var(--text);border:1px solid var(--border);border-radius:2px;padding:6px 12px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.action-btn:hover{background:var(--accent);color:var(--bg);text-decoration:none}
.action-btn select{background:transparent;border:none;color:inherit;font-size:13px;cursor:pointer}
.description{padding:14px 0;border-bottom:1px solid var(--border);white-space:pre-wrap;word-break:break-word;font-size:13.5px}
.description.collapsed{max-height:120px;overflow:hidden;position:relative}
.description.collapsed::after{content:"";position:absolute;left:0;right:0;bottom:0;height:40px;background:linear-gradient(transparent,var(--bg))}
.desc-toggle{color:var(--link);cursor:pointer;display:inline-block;padding:6px 0;font-size:13px}
.comments-section{padding:14px 0}
.comments-section h3{font-size:15px;margin-bottom:10px}
.comments-section .ctab{display:inline-block;padding:6px 12px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);border-radius:2px;font-size:13px;cursor:pointer;margin-right:6px}
.comments-section .ctab.active{background:var(--accent);color:var(--bg)}
.comment{display:flex;gap:10px;padding:10px 0;border-bottom:1px dotted var(--border)}
.comment img{width:38px;height:38px;border-radius:50%}
.comment .cmeta{font-size:12px;color:var(--muted);margin-bottom:4px}
.comment .ctext{font-size:13.5px;word-break:break-word;white-space:pre-wrap}
.comment .cstats{font-size:12px;color:var(--muted);margin-top:4px;display:flex;gap:14px}
.load-more{display:inline-block;margin:14px 0;padding:8px 18px;background:var(--btn);border:1px solid var(--border);color:var(--text);border-radius:2px;font-size:13px;cursor:pointer}
.load-more:hover{background:var(--accent);color:var(--bg)}
.sidebar{display:flex;flex-direction:column;gap:10px}
.sidebar .scard{display:flex;gap:10px;background:var(--bg-card);border:1px solid var(--border);border-radius:2px;padding:8px}
.sidebar .scard .sthumb{position:relative;flex:0 0 168px;aspect-ratio:16/9;background:#000;overflow:hidden}
.sidebar .scard .sthumb img{width:100%;height:100%;object-fit:cover}
.sidebar .scard .sthumb .dur{position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.75);color:#fff;font-size:11px;padding:1px 4px;border-radius:2px}
.sidebar .scard .sbody{display:flex;flex-direction:column;gap:4px;min-width:0}
.sidebar .scard .sbody .stitle{font-size:13px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sidebar .scard .sbody .smeta{font-size:12px;color:var(--muted);display:flex;flex-direction:column;gap:1px}

/* === channel page === */
.channel-header{position:relative;background:var(--bg-card);border:1px solid var(--border);border-radius:2px;overflow:hidden;margin:14px 0}
.channel-banner{width:100%;max-height:200px;object-fit:cover;display:block;background:#222}
.channel-info{display:flex;align-items:center;gap:14px;padding:14px}
.channel-info img.cavatar{width:80px;height:80px;border-radius:50%}
.channel-info .cmeta-block{flex:1}
.channel-info .cname{font-size:22px;font-weight:bold}
.channel-info .chandle{color:var(--muted);font-size:13px}
.channel-info .csubs{color:var(--muted);font-size:13px;margin-top:4px}
.channel-tabs{display:flex;gap:18px;border-bottom:1px solid var(--border);padding:0 4px;margin-bottom:10px;font-size:14px}
.channel-tabs a{padding:10px 4px;color:var(--muted)}
.channel-tabs a.active{color:var(--text);border-bottom:2px solid var(--accent);font-weight:bold}

/* === preferences === */
.prefs{max-width:780px;margin:24px auto;background:var(--bg-card);border:1px solid var(--border);padding:24px;border-radius:3px}
.prefs h1{font-size:20px;margin-bottom:14px}
.prefs h2{font-size:15px;margin:18px 0 8px;border-bottom:1px solid var(--border);padding-bottom:4px}
.prefs label{display:block;padding:6px 0;font-size:14px}
.prefs select,.prefs input[type=text],.prefs input[type=number]{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:5px 8px;font-size:14px;border-radius:2px;min-width:200px}
.prefs button{background:var(--accent);color:var(--bg);border:none;padding:8px 18px;font-size:14px;border-radius:2px;cursor:pointer;margin-top:14px}

/* === error === */
.err-box{max-width:680px;margin:60px auto;padding:30px;background:var(--bg-card);border:1px solid var(--border);text-align:center;border-radius:3px}
.err-box h1{margin-bottom:10px;font-size:20px}
.err-box p{color:var(--muted);margin-bottom:18px}
`;

function htmlHead(title, extraHead = '') {
  return `<!DOCTYPE html>
<html lang="ja" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<link rel="icon" href="data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}">
<style>${INVIDIOUS_CSS}</style>
${extraHead}
<script>
(function(){
  try{
    var t=localStorage.getItem('theme');
    if(t==='dark') document.documentElement.setAttribute('data-theme','dark');
  }catch(e){}
})();
function toggleTheme(){
  var d=document.documentElement;
  var cur=d.getAttribute('data-theme')==='dark'?'light':'dark';
  d.setAttribute('data-theme',cur);
  try{localStorage.setItem('theme',cur);}catch(e){}
}
</script>
</head>
<body>`;
}

function renderTopbar(req) {
  const cur = pickBackend(req).id;
  const back = req.originalUrl || '/';
  return `<div class="topbar">
  <div class="bk-strip"><b>Switch backend:</b> ${renderBackendStrip(cur, back)}</div>
  <div class="topbar-right">
    <a href="#" onclick="toggleTheme();return false;" title="テーマ切替">${MOON_SVG}</a>
    <a href="/preferences" title="設定">${GEAR_SVG}</a>
    <a href="/login" title="ログイン">${USER_SVG} <span>ログイン</span></a>
  </div>
</div>`;
}

function renderNavbar(req, q = '') {
  return `<div class="navbar">
  <a href="/" class="brand">${LOGO_SVG}<span>INVIDIOUS</span></a>
  <div class="nav-tabs">
    <a href="/feed/popular">人気</a>
    <a href="/feed/trending">急上昇</a>
  </div>
  <form class="search-form" action="/search" method="GET">
    <input type="text" name="q" class="search-input" placeholder="検索" value="${escAttr(q)}" autocomplete="off">
    <button type="submit" class="search-btn" aria-label="検索">${SEARCH_SVG}</button>
  </form>
</div>`;
}

function renderFooter() {
  return `<footer class="footer">
  <div class="fcols">
    <div>
      <p><a href="https://github.com/iv-org/invidious">⭮ 元のソースコード / 改変し使用中</a></p>
      <p><a href="/about">🕮 説明書</a></p>
    </div>
    <div>
      <p>GitHub 上で AGPLv3 の元で公開</p>
      <p><a href="/licenses">JS JavaScriptライセンス情報</a></p>
      <p><a href="/privacy">🕮 個人情報保護方針</a></p>
    </div>
    <div>
      <p><a href="/services">🗀 Services</a></p>
      <p><a href="/forum">≡ Forum</a></p>
      <p><a href="/donate">☕ 寄付する @ Tiekoetter.com</a></p>
      <p><a href="/donate">☕ 寄付する @ Invidious.io</a></p>
      <p>現在のバージョン: 2026.05.20-mini @ master</p>
    </div>
  </div>
</footer></body></html>`;
}

// ============================================================
//   Helpers - format / mapping invidious data
// ============================================================
function fmtDur(s) {
  s = +s || 0;
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), x = s%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`
          : `${m}:${String(x).padStart(2,'0')}`;
}
function pickThumb(arr, preferQuality = 'medium') {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  const pref = arr.find(t => t.quality === preferQuality);
  return pref ? pref.url : arr[arr.length - 1].url;
}
function absoluteInvUrl(req, u) {
  if (!u) return '';
  if (/^https?:/i.test(u)) return u;
  return pickBackend(req).url + u;
}

function videoCardHtml(v) {
  const id = v.videoId || v.id || '';
  const title = v.title || '';
  const thumb = pickThumb(v.videoThumbnails) || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const author = v.author || '';
  const authorId = v.authorId || '';
  const dur = (v.lengthSeconds && v.lengthSeconds > 0) ? fmtDur(v.lengthSeconds) : (v.lengthText || '');
  const views = (v.viewCountText) || (v.viewCount ? (Number(v.viewCount).toLocaleString() + ' 回視聴') : '');
  const published = v.publishedText || '';
  return `<div class="vcard">
    <a class="thumb" href="/watch?v=${esc(id)}">
      <img loading="lazy" src="${esc(thumb)}" alt="">
      ${dur ? `<span class="dur">${esc(dur)}</span>` : ''}
    </a>
    <div class="vbody">
      <a href="/watch?v=${esc(id)}"><div class="vtitle">${esc(title)}</div></a>
      <div class="vmeta">
        ${authorId ? `<a href="/channel/${esc(authorId)}">${esc(author)}</a>` : `<span>${esc(author)}</span>`}
        <span>${esc([views, published].filter(Boolean).join(' • '))}</span>
      </div>
    </div>
  </div>`;
}

function sidebarCardHtml(v) {
  const id = v.videoId || v.id || '';
  const title = v.title || '';
  const thumb = pickThumb(v.videoThumbnails) || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  const author = v.author || '';
  const authorId = v.authorId || '';
  const dur = (v.lengthSeconds && v.lengthSeconds > 0) ? fmtDur(v.lengthSeconds) : '';
  const views = v.viewCountText || (v.viewCount ? Number(v.viewCount).toLocaleString() + ' 回視聴' : '');
  return `<a class="scard" href="/watch?v=${esc(id)}">
    <div class="sthumb">
      <img loading="lazy" src="${esc(thumb)}" alt="">
      ${dur ? `<span class="dur">${esc(dur)}</span>` : ''}
    </div>
    <div class="sbody">
      <div class="stitle">${esc(title)}</div>
      <div class="smeta">
        <span>${esc(author)}</span>
        <span>${esc(views)}</span>
      </div>
    </div>
  </a>`;
}

// ============================================================
//   Replace placeholder routes with new full versions
//   (we use a small "remove last middleware" trick by routing
//    everything new BEFORE the old / handlers via app._router.stack
//    reordering: just attach a flag; old routes are still here but
//    Express picks first match.)
// ============================================================

// Because legacy `/`, `/search`, `/watch` were already declared above,
// we register new handlers under unique paths and then OVERRIDE.
// Cleanest path: remove the previously-registered routes from the stack.
(function purgeOldRoutes() {
  const stack = app._router && app._router.stack ? app._router.stack : [];
  const kill = new Set(['/', '/search', '/watch']);
  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i];
    if (layer.route && kill.has(layer.route.path)) stack.splice(i, 1);
  }
})();

// ----------- Home page ----------
app.get('/', async (req, res) => {
  let popular = [];
  try {
    const j = await invFetch(req, '/api/v1/popular');
    popular = Array.isArray(j) ? j.slice(0, 24) : [];
  } catch (e) { /* tolerate */ }

  const cards = popular.map(videoCardHtml).join('') ||
    `<p style="color:var(--muted);padding:20px;text-align:center;">バックエンドからデータを取得できませんでした。<br>上の「Switch backend」から別のバックエンドを試してください。</p>`;

  res.send(htmlHead('Invidious') +
    renderTopbar(req) +
    `<main>
       <div class="home-hero">
         <div class="subnav">
           <a href="/feed/popular">人気</a>
           <a href="/feed/trending">急上昇</a>
         </div>
         <div class="brand-big">${LOGO_SVG}<span>INVIDIOUS</span></div>
         <form class="search-form home-search" action="/search" method="GET">
           <input type="text" name="q" class="search-input" placeholder="検索" autofocus autocomplete="off">
           <button type="submit" class="search-btn" aria-label="検索">${SEARCH_SVG}</button>
         </form>
       </div>
       <div class="container">
         <div class="section-title">人気の動画</div>
         <div class="video-grid">${cards}</div>
       </div>
     </main>` +
    renderFooter());
});

// ----------- Search ----------
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').toString();
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  if (!q.trim()) return res.redirect('/');

  let items = [];
  let usedFallback = false;
  // primary: youtube-search-api (existing dep) only for page 1
  if (page === 1) {
    try {
      const sd = await yts.GetListByKeyword(q, false, 24);
      items = (sd.items || [])
        .filter(it => it.type === 'video' || it.type === 'channel' || it.type === 'playlist')
        .map(it => {
          if (it.type === 'video') {
            return {
              kind: 'video',
              videoId: it.id,
              title: it.title,
              author: it.channelTitle,
              authorId: it.channelId || '',
              videoThumbnails: it.thumbnail?.thumbnails || [],
              lengthText: it.length?.simpleText || '',
              viewCountText: it.viewCount?.text || it.viewCount?.short || '',
              publishedText: it.publishedTimeText || '',
            };
          }
          if (it.type === 'channel') {
            return { kind: 'channel', authorId: it.id, author: it.title, authorThumbnails: it.thumbnail?.thumbnails || [], subCount: it.subscriberCount || '' };
          }
          return { kind: 'playlist', playlistId: it.id, title: it.title, videoCount: it.length?.simpleText || '' };
        });
    } catch (e) { /* fall through to invidious */ }
  }
  if (!items.length) {
    try {
      const j = await invFetch(req, '/api/v1/search', { params: `q=${encodeURIComponent(q)}&page=${page}` });
      items = (j || []).map(it => {
        if (it.type === 'video') {
          return { kind:'video', videoId:it.videoId, title:it.title, author:it.author, authorId:it.authorId, videoThumbnails:it.videoThumbnails||[], lengthSeconds:it.lengthSeconds, viewCount:it.viewCount, publishedText:it.publishedText };
        }
        if (it.type === 'channel') {
          return { kind:'channel', authorId:it.authorId, author:it.author, authorThumbnails:it.authorThumbnails||[], subCount:it.subCount||'' };
        }
        if (it.type === 'playlist') {
          return { kind:'playlist', playlistId:it.playlistId, title:it.title, videoCount:it.videoCount||0, videoThumbnails:(it.videos&&it.videos[0]&&it.videos[0].videoThumbnails)||[] };
        }
        return null;
      }).filter(Boolean);
      usedFallback = true;
    } catch (e) {}
  }

  const cards = items.map(it => {
    if (it.kind === 'video') return videoCardHtml(it);
    if (it.kind === 'channel') {
      const t = (it.authorThumbnails && it.authorThumbnails.length) ? it.authorThumbnails[it.authorThumbnails.length-1].url : '';
      return `<div class="vcard"><a class="thumb" style="aspect-ratio:1/1;background:var(--bg)" href="/channel/${esc(it.authorId)}">
        <img loading="lazy" src="${esc(t)}" alt=""></a>
        <div class="vbody"><a href="/channel/${esc(it.authorId)}"><div class="vtitle">${esc(it.author)}</div></a>
        <div class="vmeta"><span>チャンネル • ${esc(it.subCount||'')}</span></div></div></div>`;
    }
    // playlist
    const t = pickThumb(it.videoThumbnails);
    return `<div class="vcard"><a class="thumb" href="/playlist?list=${esc(it.playlistId)}">
      <img loading="lazy" src="${esc(t)}" alt=""></a>
      <div class="vbody"><a href="/playlist?list=${esc(it.playlistId)}"><div class="vtitle">${esc(it.title)}</div></a>
      <div class="vmeta"><span>プレイリスト • ${esc(it.videoCount)} 本</span></div></div></div>`;
  }).join('') || `<p style="color:var(--muted);padding:20px;text-align:center;">結果がありません。</p>`;

  const next = page + 1;
  const prev = Math.max(1, page - 1);
  res.send(htmlHead(`${q} - Invidious`) +
    renderTopbar(req) +
    renderNavbar(req, q) +
    `<main><div class="container">
      <div class="filter-bar"><span class="filter-toggle">[ + ] フィルタ</span><span>ページ ${page}</span></div>
      <div class="video-grid">${cards}</div>
      <div class="pager">
        ${page>1?`<a href="/search?q=${encodeURIComponent(q)}&page=${prev}">« 前のページ</a>`:''}
        <span>${page}</span>
        <a href="/search?q=${encodeURIComponent(q)}&page=${next}">次のページ »</a>
      </div>
    </div></main>` +
    renderFooter());
});

// ----------- Watch ----------
app.get('/watch', async (req, res) => {
  const v = (req.query.v || '').toString();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(v)) return res.redirect('/');

  // Try local scraper first (already in this file), fall back to invidious api
  let meta = null;
  try {
    const c = cacheGet(metaCache, v);
    if (c) meta = c;
    else {
      const m = await scrapeYouTubeMeta(v);
      if (m && m.success !== false) {
        meta = m;
        cacheSet(metaCache, v, m, 300000);
      }
    }
  } catch (e) { /* fallback below */ }

  let invMeta = null;
  if (!meta) {
    try { invMeta = await invFetch(req, '/api/v1/videos/' + v); } catch (e) {}
  }

  const title       = (meta && meta.title) || (invMeta && invMeta.title) || 'Untitled';
  const channel     = (meta && (meta.channel || meta.uploader)) || (invMeta && invMeta.author) || '';
  const channelId   = (meta && meta.channel_id) || (invMeta && invMeta.authorId) || '';
  const channelThumb= (meta && meta.channel_thumbnail) ||
                      (invMeta && invMeta.authorThumbnails && invMeta.authorThumbnails[invMeta.authorThumbnails.length-1]?.url) || '';
  const subs        = (meta && meta.channel_subs_text) || (invMeta && invMeta.subCountText) || '';
  const views       = (meta && meta.view_count_text) || (invMeta && (Number(invMeta.viewCount||0).toLocaleString()+' 回視聴')) || '';
  const published   = (meta && meta.publish_date_text) || (invMeta && invMeta.publishedText) || '';
  const likes       = (meta && meta.like_count_text) || (invMeta && invMeta.likeCount ? Number(invMeta.likeCount).toLocaleString() : '');
  const descRaw     = (meta && meta.description) || (invMeta && invMeta.description) || '';
  const recommended = (meta && meta.related_videos) || (invMeta && invMeta.recommendedVideos) || [];

  const sidebar = recommended.slice(0, 20).map(r => sidebarCardHtml({
    videoId:        r.videoId || r.id,
    title:          r.title,
    author:         r.author || r.uploader || '',
    authorId:       r.authorId || r.channel_id || '',
    videoThumbnails:r.videoThumbnails || (r.thumbnail ? [{url:r.thumbnail}] : []),
    lengthSeconds:  r.lengthSeconds || r.duration || 0,
    viewCountText:  r.viewCountText || r.view_count_text || '',
  })).join('');

  const extraHead = `
<link rel="stylesheet" href="/videojs/video.js/video-js.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-http-source-selector/videojs-http-source-selector.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-markers/videojs.markers.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-share/videojs-share.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css?v=07c38a4">
<link rel="stylesheet" href="/videojs/videojs-mobile-ui/videojs-mobile-ui.css?v=07c38a4">
<link rel="stylesheet" href="/css/player.css?v=07c38a4">

<script src="/videojs/video.js/video.js?v=07c38a4"></script>
<script src="/videojs/videojs-mobile-ui/videojs-mobile-ui.js?v=07c38a4"></script>
<script src="/videojs/videojs-contrib-quality-levels/videojs-contrib-quality-levels.js?v=07c38a4"></script>
<script src="/videojs/videojs-http-source-selector/videojs-http-source-selector.js?v=07c38a4"></script>
<script src="/videojs/videojs-markers/videojs-markers.js?v=07c38a4"></script>
<script src="/videojs/videojs-share/videojs-share.js?v=07c38a4"></script>
<script src="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.js?v=07c38a4"></script>`;

  const playerScript = `
<script>
(function(){
  var VIDEO_ID = ${JSON.stringify(v)};
  var qPref = (new URLSearchParams(location.search)).get('quality') || '360';
  var qualities = ['360','720','1080'];

  function fetchText(u){ return fetch(u).then(r=>{ if(!r.ok) throw new Error('http '+r.status); return r.text();}); }

  var player = videojs('player', {
    fluid: false,
    fill: true,
    controls: true,
    preload: 'auto',
    playbackRates: [0.25,0.5,0.75,1,1.25,1.5,1.75,2],
    html5: { vhs: { overrideNative: true } }
  });

  var audioEl = document.getElementById('audio-sync');

  function syncAudio(){
    if(!audioEl) return;
    audioEl.currentTime = player.currentTime();
    if(player.paused()) audioEl.pause(); else audioEl.play().catch(function(){});
  }

  function loadQuality(q){
    var videoP = fetchText('/stream/'+VIDEO_ID+'?q='+q);
    if(q==='360'){
      // 360 has audio in same stream → no separate audio
      videoP.then(function(url){
        player.src({ src:url, type:'video/mp4' });
        if(audioEl){ audioEl.pause(); audioEl.removeAttribute('src'); audioEl.load(); }
        player.muted(false);
      }).catch(function(e){ console.error(e); });
    } else {
      // higher quality: video-only + sidecar audio
      Promise.all([videoP, fetchText('/stream-audio/'+VIDEO_ID)])
        .then(function(arr){
          var vu = arr[0], au = arr[1];
          var t = player.currentTime() || 0;
          player.src({ src: vu, type:'video/mp4' });
          player.muted(true);
          if(audioEl){
            audioEl.src = au;
            audioEl.currentTime = t;
            audioEl.load();
            audioEl.play().catch(function(){});
          }
          player.one('loadeddata', function(){ player.currentTime(t); player.play().catch(function(){}); syncAudio(); });
        }).catch(function(e){ console.error(e); });
    }
  }

  // wire events to keep audio in sync
  player.on('play',  syncAudio);
  player.on('pause', syncAudio);
  player.on('seeked',syncAudio);
  player.on('ratechange', function(){ if(audioEl) audioEl.playbackRate = player.playbackRate(); });
  player.on('volumechange', function(){ if(audioEl){ audioEl.volume = player.volume(); } });
  setInterval(function(){
    if(!audioEl || audioEl.paused) return;
    var diff = Math.abs(audioEl.currentTime - player.currentTime());
    if(diff>0.35) audioEl.currentTime = player.currentTime();
  }, 1500);

  // initial load
  loadQuality(qPref);

  // quality selector
  var sel = document.getElementById('q-select');
  sel.value = qPref;
  sel.addEventListener('change', function(){
    var url = new URL(location.href);
    url.searchParams.set('quality', sel.value);
    history.replaceState(null,'',url);
    loadQuality(sel.value);
  });

  // ===== description toggle =====
  var desc = document.getElementById('desc');
  var dtog = document.getElementById('desc-tog');
  if(desc && desc.scrollHeight > 130){
    desc.classList.add('collapsed');
    dtog.style.display = 'inline-block';
  }
  if(dtog){
    dtog.addEventListener('click', function(){
      var c = desc.classList.toggle('collapsed');
      dtog.textContent = c ? '続きを読む' : '一部を表示';
    });
    dtog.textContent = '続きを読む';
  }

  // ===== comments lazy load =====
  var cBox = document.getElementById('comments');
  var continuation = null;
  var loading = false;

  function renderComments(items, append){
    if(!append) cBox.innerHTML = '';
    items.forEach(function(c){
      var div = document.createElement('div');
      div.className='comment';
      var thumb = (c.authorThumbnails && c.authorThumbnails[c.authorThumbnails.length-1] && c.authorThumbnails[c.authorThumbnails.length-1].url) || '';
      div.innerHTML =
        '<img src="'+ (thumb||'') +'" alt="">' +
        '<div style="flex:1;min-width:0">' +
          '<div class="cmeta"><b>' + escapeHtml(c.author||'') + '</b> · ' + escapeHtml(c.publishedText||'') + (c.isPinned?' · 📌 固定':'') + (c.authorIsChannelOwner?' · 投稿者':'') + '</div>' +
          '<div class="ctext">' + (c.contentHtml || escapeHtml(c.content||'').replace(/\\n/g,'<br>')) + '</div>' +
          '<div class="cstats">👍 ' + (c.likeCount||0) + (c.replies&&c.replies.replyCount?' · 💬 返信 '+c.replies.replyCount+'件':'') + '</div>' +
        '</div>';
      cBox.appendChild(div);
    });
  }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, function(c){ return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c]; }); }

  function loadComments(){
    if(loading) return;
    loading = true;
    document.getElementById('cload').textContent = '読み込み中...';
    var u = '/api/comments/'+VIDEO_ID + (continuation?('?continuation='+encodeURIComponent(continuation)):'');
    fetch(u).then(r=>r.json()).then(function(j){
      loading=false;
      if(!j || !j.comments){ document.getElementById('cload').textContent='コメントを読み込めませんでした'; return; }
      renderComments(j.comments, !!continuation);
      continuation = j.continuation || null;
      document.getElementById('cload').textContent = continuation ? 'さらに読み込む' : (j.comments.length? 'これ以上ありません' : 'コメントはありません');
      document.getElementById('cload').disabled = !continuation;
    }).catch(function(){
      loading=false;
      document.getElementById('cload').textContent = 'コメントの取得に失敗しました';
    });
  }
  document.getElementById('cload').addEventListener('click', loadComments);
  // auto-load shortly after page renders so video starts first
  setTimeout(loadComments, 600);
})();
</script>`;

  res.send(htmlHead(`${title} - Invidious`, extraHead) +
    renderTopbar(req) +
    renderNavbar(req) +
    `<main><div class="container">
      <div class="watch-grid">
        <div class="watch-main">
          <div class="player-wrap">
            <video id="player" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto" poster="https://i.ytimg.com/vi/${esc(v)}/maxresdefault.jpg"></video>
            <audio id="audio-sync" preload="auto" style="display:none"></audio>
          </div>
          <h1 class="h-title">${esc(title)}</h1>
          <div class="h-meta">
            <span>${esc(views)}</span>
            <span>${esc(published)}</span>
            ${likes ? `<span>👍 ${esc(likes)}</span>` : ''}
            <span style="margin-left:auto;display:flex;align-items:center;gap:6px">
              画質:
              <select id="q-select" style="background:var(--btn);color:var(--text);border:1px solid var(--border);padding:4px 8px;border-radius:2px">
                <option value="360">360p</option>
                <option value="720">720p</option>
                <option value="1080">1080p</option>
              </select>
            </span>
          </div>
          <div class="author-row">
            ${channelThumb ? `<a href="/channel/${esc(channelId)}"><img src="${esc(channelThumb)}" alt=""></a>` : ''}
            <div class="author-info">
              <a class="a-name" href="/channel/${esc(channelId)}">${esc(channel)}</a>
              <span class="a-subs">${esc(subs)}</span>
            </div>
            <button class="subscribe-btn" onclick="alert('購読機能は今後実装予定です')">登録</button>
          </div>
          <div class="action-row">
            <a class="action-btn" href="https://www.youtube.com/watch?v=${esc(v)}" target="_blank" rel="noopener">YouTube で開く</a>
            <a class="action-btn" href="/stream/${esc(v)}?q=360" target="_blank">⇩ 360p</a>
            <a class="action-btn" href="/stream/${esc(v)}?q=720" target="_blank">⇩ 720p</a>
            <a class="action-btn" href="/stream/${esc(v)}?q=1080" target="_blank">⇩ 1080p</a>
            <button class="action-btn" onclick="navigator.share?navigator.share({url:location.href,title:document.title}):navigator.clipboard.writeText(location.href).then(()=>alert('リンクをコピーしました'))">↗ シェア</button>
          </div>
          <div id="desc" class="description">${nl2br(descRaw)}</div>
          <span id="desc-tog" class="desc-toggle" style="display:none"></span>

          <div class="comments-section">
            <h3>コメント</h3>
            <div id="comments"></div>
            <button id="cload" class="load-more">コメントを読み込み中...</button>
          </div>
        </div>

        <aside class="sidebar">
          <div class="section-title" style="margin-bottom:6px;padding-top:0">関連動画</div>
          ${sidebar || '<p style="color:var(--muted)">関連動画はありません</p>'}
        </aside>
      </div>
    </div></main>` +
    playerScript +
    renderFooter());
});

// ----------- Comments JSON ----------
app.get('/api/comments/:videoId', async (req, res) => {
  const v = req.params.videoId;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(v)) return res.status(400).json({ error: 'bad id' });
  try {
    const params = [];
    if (req.query.continuation) params.push('continuation=' + encodeURIComponent(req.query.continuation));
    if (req.query.sort_by)      params.push('sort_by=' + encodeURIComponent(req.query.sort_by));
    const j = await invFetch(req, '/api/v1/comments/' + v, { ttlMs: 60000, params: params.join('&') });
    res.json(j);
  } catch (e) {
    res.status(502).json({ error: 'comments unavailable', detail: e.message });
  }
});

// ----------- Channel ----------
app.get('/channel/:id', async (req, res) => {
  const id = req.params.id;
  const tab = (req.query.tab || 'videos').toString();
  let ch = null;
  try { ch = await invFetch(req, '/api/v1/channels/' + encodeURIComponent(id)); } catch (e) {}
  if (!ch) {
    return res.status(502).send(htmlHead('Error') + renderTopbar(req) + renderNavbar(req) +
      `<main><div class="err-box"><h1>チャンネルを取得できませんでした</h1><p>別のバックエンドをお試しください。</p><a class="action-btn" href="/">ホームに戻る</a></div></main>` +
      renderFooter());
  }
  const banner = (ch.authorBanners && ch.authorBanners[0] && ch.authorBanners[0].url) || '';
  const avatar = (ch.authorThumbnails && ch.authorThumbnails[ch.authorThumbnails.length-1] && ch.authorThumbnails[ch.authorThumbnails.length-1].url) || '';
  const videos = (ch.latestVideos || []);
  const cards = videos.map(videoCardHtml).join('') || '<p style="color:var(--muted)">動画がありません</p>';
  res.send(htmlHead(`${ch.author} - Invidious`) +
    renderTopbar(req) +
    renderNavbar(req) +
    `<main><div class="container">
      <div class="channel-header">
        ${banner ? `<img class="channel-banner" src="${esc(banner)}" alt="">` : ''}
        <div class="channel-info">
          ${avatar ? `<img class="cavatar" src="${esc(avatar)}" alt="">` : ''}
          <div class="cmeta-block">
            <div class="cname">${esc(ch.author)} ${ch.authorVerified?'<span title="認証済み">✔</span>':''}</div>
            <div class="chandle">${esc(ch.authorId||'')}</div>
            <div class="csubs">${esc(ch.subCountText || (ch.subCount?Number(ch.subCount).toLocaleString():''))} 登録者</div>
          </div>
          <button class="subscribe-btn" onclick="alert('購読機能は今後実装予定です')">登録</button>
        </div>
        ${ch.description ? `<div style="padding:0 14px 14px;color:var(--muted);font-size:13px;white-space:pre-wrap">${nl2br(ch.description)}</div>` : ''}
      </div>
      <nav class="channel-tabs">
        <a href="/channel/${esc(id)}?tab=videos" class="${tab==='videos'?'active':''}">動画</a>
        <a href="/channel/${esc(id)}?tab=shorts" class="${tab==='shorts'?'active':''}">ショート</a>
        <a href="/channel/${esc(id)}?tab=streams" class="${tab==='streams'?'active':''}">ライブ</a>
        <a href="/channel/${esc(id)}?tab=playlists" class="${tab==='playlists'?'active':''}">プレイリスト</a>
        <a href="/channel/${esc(id)}?tab=community" class="${tab==='community'?'active':''}">コミュニティ</a>
        <a href="/channel/${esc(id)}?tab=about" class="${tab==='about'?'active':''}">概要</a>
      </nav>
      <div class="video-grid">${cards}</div>
    </div></main>` +
    renderFooter());
});

// channel sub-pages -> proxy through tab
app.get('/channel/:id/videos',   (req, res) => res.redirect(`/channel/${req.params.id}?tab=videos`));
app.get('/channel/:id/shorts',   (req, res) => res.redirect(`/channel/${req.params.id}?tab=shorts`));
app.get('/channel/:id/streams',  (req, res) => res.redirect(`/channel/${req.params.id}?tab=streams`));
app.get('/channel/:id/playlists',(req, res) => res.redirect(`/channel/${req.params.id}?tab=playlists`));
app.get('/c/:handle',            (req, res) => res.redirect(`/search?q=${encodeURIComponent(req.params.handle)}`));
app.get('/user/:handle',         (req, res) => res.redirect(`/search?q=${encodeURIComponent(req.params.handle)}`));
app.get('/@:handle',             (req, res) => res.redirect(`/search?q=${encodeURIComponent('@'+req.params.handle)}`));

// ----------- Playlist ----------
app.get('/playlist', async (req, res) => {
  const list = (req.query.list || '').toString();
  if (!list) return res.redirect('/');
  let pl = null;
  try { pl = await invFetch(req, '/api/v1/playlists/' + encodeURIComponent(list)); } catch (e) {}
  if (!pl) {
    return res.status(502).send(htmlHead('Error') + renderTopbar(req) + renderNavbar(req) +
      `<main><div class="err-box"><h1>プレイリストを取得できませんでした</h1><a class="action-btn" href="/">ホームに戻る</a></div></main>` +
      renderFooter());
  }
  const cards = (pl.videos || []).map(videoCardHtml).join('') || '<p style="color:var(--muted)">空のプレイリストです</p>';
  res.send(htmlHead(`${pl.title} - Invidious`) +
    renderTopbar(req) + renderNavbar(req) +
    `<main><div class="container">
       <div class="section-title">📋 ${esc(pl.title)} — ${esc(pl.author||'')} (${(pl.videoCount||0)} 本)</div>
       ${pl.description ? `<div style="color:var(--muted);font-size:13px;padding:6px 0 14px;white-space:pre-wrap">${nl2br(pl.description)}</div>` : ''}
       <div class="video-grid">${cards}</div>
     </div></main>` +
    renderFooter());
});

// ----------- Trending ----------
app.get('/feed/trending', async (req, res) => {
  const type = (req.query.type || '').toString(); // music gaming movies default
  let items = [];
  try {
    const j = await invFetch(req, '/api/v1/trending', { params: type ? `type=${encodeURIComponent(type)}` : '' });
    items = Array.isArray(j) ? j : [];
  } catch (e) {}
  const cards = items.map(videoCardHtml).join('') || '<p style="color:var(--muted)">データを取得できませんでした</p>';
  res.send(htmlHead('急上昇 - Invidious') +
    renderTopbar(req) + renderNavbar(req) +
    `<main><div class="container">
       <div class="section-title">急上昇</div>
       <nav class="channel-tabs">
         <a href="/feed/trending" class="${!type?'active':''}">すべて</a>
         <a href="/feed/trending?type=music" class="${type==='music'?'active':''}">音楽</a>
         <a href="/feed/trending?type=gaming" class="${type==='gaming'?'active':''}">ゲーム</a>
         <a href="/feed/trending?type=movies" class="${type==='movies'?'active':''}">映画</a>
       </nav>
       <div class="video-grid">${cards}</div>
     </div></main>` +
    renderFooter());
});

// ----------- Popular ----------
app.get('/feed/popular', async (req, res) => {
  let items = [];
  try {
    const j = await invFetch(req, '/api/v1/popular');
    items = Array.isArray(j) ? j : [];
  } catch (e) {}
  const cards = items.map(videoCardHtml).join('') || '<p style="color:var(--muted)">データを取得できませんでした</p>';
  res.send(htmlHead('人気 - Invidious') +
    renderTopbar(req) + renderNavbar(req) +
    `<main><div class="container">
       <div class="section-title">人気</div>
       <div class="video-grid">${cards}</div>
     </div></main>` +
    renderFooter());
});

// ----------- Hashtag ----------
app.get('/hashtag/:tag', async (req, res) => {
  const tag = req.params.tag;
  let items = [];
  try {
    const j = await invFetch(req, '/api/v1/hashtag/' + encodeURIComponent(tag));
    items = (j && j.results) || [];
  } catch (e) {}
  if (!items.length) {
    // fallback to search
    return res.redirect('/search?q=' + encodeURIComponent('#' + tag));
  }
  const cards = items.map(videoCardHtml).join('');
  res.send(htmlHead(`#${tag} - Invidious`) +
    renderTopbar(req) + renderNavbar(req) +
    `<main><div class="container">
       <div class="section-title">#${esc(tag)}</div>
       <div class="video-grid">${cards}</div>
     </div></main>` +
    renderFooter());
});

// ----------- Post / Community ----------
app.get('/post/:id', async (req, res) => {
  const id = req.params.id;
  let post = null;
  try { post = await invFetch(req, '/api/v1/post/' + encodeURIComponent(id)); } catch (e) {}
  res.send(htmlHead('投稿 - Invidious') +
    renderTopbar(req) + renderNavbar(req) +
    `<main><div class="container">
       <div class="section-title">コミュニティ投稿</div>
       ${post ? `<div style="background:var(--bg-card);border:1px solid var(--border);padding:14px;border-radius:2px">
         <div style="font-weight:600;margin-bottom:6px">${esc(post.author||'')}</div>
         <div style="white-space:pre-wrap;font-size:14px">${nl2br(post.contentText||post.content||'')}</div>
       </div>` : '<p style="color:var(--muted)">取得できませんでした</p>'}
     </div></main>` +
    renderFooter());
});

// ----------- Preferences / Login / About / etc ----------
function simplePage(title, bodyHtml, req) {
  return htmlHead(title + ' - Invidious') +
    renderTopbar(req) + renderNavbar(req) +
    `<main><div class="container">${bodyHtml}</div></main>` +
    renderFooter();
}

app.get('/preferences', (req, res) => {
  res.send(simplePage('設定', `
    <div class="prefs">
      <h1>設定</h1>
      <h2>表示</h2>
      <label>テーマ
        <select onchange="document.documentElement.setAttribute('data-theme',this.value);try{localStorage.setItem('theme',this.value)}catch(e){}">
          <option value="light">ライト</option><option value="dark">ダーク</option>
        </select>
      </label>
      <label>既定の画質
        <select onchange="try{localStorage.setItem('defaultQuality',this.value)}catch(e){}">
          <option value="360">360p (音声同梱)</option>
          <option value="720">720p</option>
          <option value="1080">1080p</option>
        </select>
      </label>
      <h2>バックエンド</h2>
      <p>現在: <b>${esc(pickBackend(req).label)}</b></p>
      <p>ページ上部の Switch backend からも切替可能です。</p>
      <h2>言語</h2>
      <label>表示言語
        <select disabled><option>日本語</option></select>
      </label>
      <button onclick="alert('設定は端末に保存されます');history.back()">保存</button>
    </div>`, req));
});

app.get('/login', (req, res) => {
  res.send(simplePage('ログイン', `
    <div class="prefs">
      <h1>ログイン</h1>
      <p style="color:var(--muted)">このミラーではアカウント機能は無効です。<br>視聴と検索はアカウントなしで利用できます。</p>
      <a class="action-btn" href="/">ホームに戻る</a>
    </div>`, req));
});

app.get('/about', (req, res) => {
  res.send(simplePage('説明書', `
    <div class="prefs">
      <h1>このサイトについて</h1>
      <p>Invidious 互換のフロントエンドです。視聴・検索・チャンネル閲覧・コメント取得などをサポートします。</p>
      <p>動画ストリームは複数のバックエンド(B1〜B8)から取得され、失敗時は自動でフォールバックされます。</p>
      <p style="color:var(--muted);font-size:12px;margin-top:18px">製作者: Kakinie</p>
    </div>`, req));
});
app.get('/privacy', (req,res)=>res.send(simplePage('個人情報保護方針',
  `<div class="prefs"><h1>個人情報保護方針</h1><p>当サイトは Cookie をバックエンド選択の保存にのみ使用します。アクセスログは保管していません。</p></div>`, req)));
app.get('/licenses', (req,res)=>res.send(simplePage('JS ライセンス情報',
  `<div class="prefs"><h1>JavaScript ライセンス</h1><ul>
   <li>video.js — Apache-2.0</li><li>videojs-contrib-quality-levels — Apache-2.0</li>
   <li>videojs-http-source-selector — MIT</li><li>videojs-markers — MIT</li>
   <li>videojs-share — MIT</li><li>videojs-vtt-thumbnails — MIT</li><li>videojs-mobile-ui — MIT</li>
   </ul></div>`, req)));
app.get('/services', (req,res)=>res.send(simplePage('Services',
  `<div class="prefs"><h1>Services</h1><p>本フロントエンドが利用するサブシステム一覧は内部実装に含まれます。</p></div>`, req)));
app.get('/forum', (req,res)=>res.redirect('https://github.com/iv-org/invidious/discussions'));
app.get('/donate', (req,res)=>res.send(simplePage('寄付',
  `<div class="prefs"><h1>寄付</h1><p>このミラーへの寄付は受け付けていません。<br>Invidious 本体への寄付は <a href="https://invidious.io/donate/" target="_blank" rel="noopener">invidious.io/donate</a> から可能です。</p></div>`, req)));

// redirect helper used by Invidious
app.get('/redirect', (req, res) => {
  const u = (req.query.url || '').toString();
  if (!/^https?:\/\//i.test(u)) return res.redirect('/');
  res.send(`<!doctype html><meta http-equiv="refresh" content="0;url=${esc(u)}"><a href="${esc(u)}">${esc(u)}</a>`);
});

// generic 404 (kept after every other route)
app.use((req, res) => {
  res.status(404).send(htmlHead('404 - Invidious') +
    renderTopbar(req) + renderNavbar(req) +
    `<main><div class="err-box"><h1>404 — ページが見つかりません</h1><p>${esc(req.originalUrl)}</p><a class="action-btn" href="/">ホームに戻る</a></div></main>` +
    renderFooter());
});

// ============================================================
//   Server bootstrap
//   (the original `app.listen` below remains untouched)
// ============================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`INVIDIOUS-MINI by Kakinie v${VERSION} listening on :${PORT}`));

module.exports = app;
