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


// ==========================================
// Invidious-compat backend layer
// ==========================================

const INVIDIOUS_INSTANCES = [
  'https://invidious.ritoge.com',
  'https://yt.omada.cafe',
  'https://invidious.darkness.services',
  'https://invidious.f5.si',
  'https://invidious.ducks.party',
  'https://y.com.sb',
  'https://super8.absturztau.be',
  'https://inv.zoomerville.com',
  'https://invidious.nerdvpn.de',
  'https://inv.thepixora.com',
];

// バックエンド表記 (region tags) — フロントエンドのスイッチャーで使用
const BACKEND_LABELS = [
  { id: 'B1', region: 'CL', url: INVIDIOUS_INSTANCES[0] },
  { id: 'B2', region: 'US', url: INVIDIOUS_INSTANCES[1] },
  { id: 'B3', region: 'US', url: INVIDIOUS_INSTANCES[2] },
  { id: 'B4', region: 'US', url: INVIDIOUS_INSTANCES[3] },
  { id: 'B5', region: 'US', url: INVIDIOUS_INSTANCES[4] },
  { id: 'B6', region: 'US', url: INVIDIOUS_INSTANCES[5] },
  { id: 'B7', region: 'DE', url: INVIDIOUS_INSTANCES[6] },
  { id: 'B8', region: 'DE', url: INVIDIOUS_INSTANCES[7] },
];

// バックエンドの健全性ステータスをメモリに保持
const _backendHealth = new Map(); // key: instance url, value: { failures, lastFail }
function _markBackendFail(url) {
  const cur = _backendHealth.get(url) || { failures: 0, lastFail: 0 };
  cur.failures++;
  cur.lastFail = Date.now();
  _backendHealth.set(url, cur);
}
function _markBackendOk(url) {
  _backendHealth.set(url, { failures: 0, lastFail: 0 });
}
function _sortedInstances() {
  // failure 回数の少ないものを優先 (5分以上経過した failure は半減)
  const now = Date.now();
  return [...INVIDIOUS_INSTANCES].sort((a, b) => {
    const ha = _backendHealth.get(a) || { failures: 0, lastFail: 0 };
    const hb = _backendHealth.get(b) || { failures: 0, lastFail: 0 };
    const fa = ha.failures * (now - ha.lastFail > 300000 ? 0.5 : 1);
    const fb = hb.failures * (now - hb.lastFail > 300000 ? 0.5 : 1);
    return fa - fb;
  });
}

/**
 * Invidious API をシーケンシャルに試して最初に成功したレスポンスを返す。
 * @param {string} path - "/api/v1/..." 形式
 * @param {object} opts - { preferInstance, timeout }
 */
async function invidiousApi(path, opts = {}) {
  const timeout = opts.timeout || 8000;
  const instances = opts.preferInstance
    ? [opts.preferInstance, ..._sortedInstances().filter(i => i !== opts.preferInstance)]
    : _sortedInstances();

  let lastErr = null;
  for (const base of instances) {
    const url = base.replace(/\/+$/, '') + path;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': getUA(), 'Accept': 'application/json' },
        signal: ctrl.signal,
        dispatcher: AGENT,
      });
      clearTimeout(timer);
      if (!r.ok) {
        _markBackendFail(base);
        lastErr = new Error(`HTTP ${r.status} from ${base}`);
        continue;
      }
      const data = await r.json();
      _markBackendOk(base);
      return { data, instance: base };
    } catch (e) {
      clearTimeout(timer);
      _markBackendFail(base);
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Invidious instances failed');
}

// ==========================================
// Stream URL resolution (obfuscated upstream)
// ==========================================
//
// 上流のサードパーティ helper の素性を読み解かれにくくするため、
// host / path 文字列はランタイムでオフセット復号する。
//
// 既存実装 (videoCache 周り) と互換性のあるロジックを継承。
//
const streamCache = new Map(); // key: `${videoId}:${formatId}` -> { url, expiry }
const STREAM_TTL = 60_000;

// 上流ホスト (LIVE系): "https://getlate.dev/api/tools/youtube-live-downloader"
const _hostBytesA = [
  0x79,0x85,0x85,0x81,0x84,0x4b,0x40,0x40,0x78,0x76,0x85,0x7d,0x72,0x85,0x76,0x3f,
  0x75,0x76,0x87,0x40,0x72,0x81,0x7a,0x40,0x85,0x80,0x80,0x7d,0x84,0x40,0x8a,0x80,
  0x86,0x85,0x86,0x73,0x76,0x3e,0x7d,0x7a,0x87,0x76,0x3e,0x75,0x80,0x88,0x7f,0x7d,
  0x80,0x72,0x75,0x76,0x83,
];
// 上流ホスト (VIDEO系 fallback): "https://getlate.dev/api/tools/youtube-video-downloader"
const _hostBytesB = [
  0x79,0x85,0x85,0x81,0x84,0x4b,0x40,0x40,0x78,0x76,0x85,0x7d,0x72,0x85,0x76,0x3f,
  0x75,0x76,0x87,0x40,0x72,0x81,0x7a,0x40,0x85,0x80,0x80,0x7d,0x84,0x40,0x8a,0x80,
  0x86,0x85,0x86,0x73,0x76,0x3e,0x87,0x7d,0x75,0x76,0x80,0x3e,0x75,0x80,0x88,0x7f,
  0x7d,0x80,0x72,0x75,0x76,0x83,
];
const _qsPrefix = [0x37,0x87,0x83,0x7d,0x4e,0x79,0x85,0x85,0x81,0x84,0x36,0x44,0x52,0x36,0x43,0x57,0x36,0x43,0x57,0x88,0x88,0x88,0x3f,0x8a,0x80,0x86,0x85,0x86,0x73,0x76,0x3f,0x74,0x80,0x7e,0x36,0x43,0x57,0x88,0x72,0x85,0x74,0x79,0x36,0x44,0x57,0x87,0x36,0x44,0x55];
const _qsFmt    = [0x37,0x77,0x80,0x83,0x7e,0x72,0x85,0x5a,0x75,0x4e]; // "&formatId="
const _ops = ['map','fromCharCode','join'];
const _dec = (arr) => arr[_ops[0]](b => String[_ops[1]](b - 0x11))[_ops[2]]('');

function _buildUpstreamUrl(kind, videoId, formatId) {
  const host = kind === 'video' ? _dec(_hostBytesB) : _dec(_hostBytesA);
  const qs   = _dec(_qsPrefix) + videoId + _dec(_qsFmt) + String(formatId);
  return host + qs;
}

/**
 * format 別のストリーム最終 URL を取得 (リダイレクト解決後)。
 *   formatId=2 : 360p (audio+video)
 *   formatId=4 : 720p (video only)
 *   formatId=5 : 1080p (video only)
 * 失敗時は VIDEO 系エンドポイントへフォールバック。
 */
async function resolveStreamUrl(videoId, formatId) {
  const key = `${videoId}:${formatId}`;
  const cached = streamCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.url;

  const attempts = [
    _buildUpstreamUrl('live',  videoId, formatId),
    _buildUpstreamUrl('video', videoId, formatId),
  ];

  let lastErr = null;
  for (const url of attempts) {
    try {
      const r = await fetch(url, {
        method: 'GET',
        headers: { 'User-Agent': getUA() },
        redirect: 'follow',
        dispatcher: AGENT,
      });
      const finalUrl = r.url;
      if (finalUrl && /^https?:\/\//.test(finalUrl) && finalUrl !== url) {
        streamCache.set(key, { url: finalUrl, expiry: Date.now() + STREAM_TTL });
        return finalUrl;
      }
      lastErr = new Error('No redirect URL');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Stream resolve failed');
}

/**
 * 最終フォールバック: Invidious 直接の latest_version 取得。
 * itag マッピング: 360p=18, 720p=22, 1080p video-only=137(+140 audio).
 */
async function resolveInvidiousStream(videoId, quality) {
  const itagMap = { '360p': 18, '720p': 22, '1080p': 137 };
  const itag = itagMap[quality] || 18;
  for (const base of _sortedInstances()) {
    try {
      const url = `${base}/latest_version?id=${videoId}&itag=${itag}&local=true`;
      const r = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': getUA() },
        redirect: 'manual',
        dispatcher: AGENT,
      });
      if (r.status === 302 || r.status === 301 || r.ok) {
        _markBackendOk(base);
        return r.headers.get('location') || url;
      }
    } catch (_) {}
  }
  return null;
}

// 表示用ユーティリティ
function _esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function _fmtNum(n) {
  if (n == null || isNaN(n)) return '';
  n = Number(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function _fmtViews(n) {
  if (n == null) return '';
  const num = Number(n);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-US') + ' views';
}
function _fmtDuration(sec) {
  if (sec == null || isNaN(sec)) return '';
  sec = Math.floor(Number(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function _timeAgo(unixSec) {
  if (!unixSec) return '';
  const diff = Math.floor(Date.now() / 1000) - Number(unixSec);
  if (diff < 60)        return `${diff} seconds ago`;
  if (diff < 3600)      return `${Math.floor(diff/60)} minutes ago`;
  if (diff < 86400)     return `${Math.floor(diff/3600)} hours ago`;
  if (diff < 86400*7)   return `${Math.floor(diff/86400)} days ago`;
  if (diff < 86400*30)  return `${Math.floor(diff/86400/7)} weeks ago`;
  if (diff < 86400*365) return `${Math.floor(diff/86400/30)} months ago`;
  return `${Math.floor(diff/86400/365)} years ago`;
}

// チャンネルアバター URL 推定
function _avatarUrl(ucid) {
  if (!ucid) return '';
  return `/ggpht/ytc/${encodeURIComponent(ucid)}`;
}


// ==========================================
// Common CSS — Invidious "light" theme
// (デザインはユーザー提供のスクリーンショットを忠実に再現)
// ==========================================

const LAYOUT_VERSION = '07c38a4';

const commonCSS = `
:root {
  --bg-color: #ffffff;
  --bg-alt: #f8f8f8;
  --text-color: #303030;
  --muted-color: #707070;
  --border-color: #e1e1e1;
  --search-border: #cccccc;
  --hover-bg: #f1f1f1;
  --link-color: #075f9e;
  --accent: #f1683a;
  --error-bg: #fce8e6;
  --error-text: #b00020;
}
[data-theme="dark"] {
  --bg-color: #1f1f1f;
  --bg-alt: #2a2a2a;
  --text-color: #f1f1f1;
  --muted-color: #b0b0b0;
  --border-color: #3a3a3a;
  --search-border: #555;
  --hover-bg: #2f2f2f;
  --link-color: #4ea3e0;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background-color: var(--bg-color);
  color: var(--text-color);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  line-height: 1.5;
}
a { color: var(--link-color); text-decoration: none; }
a:hover { text-decoration: underline; }
.muted { color: var(--muted-color); }

/* ===== Top backend switch bar ===== */
.backend-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 16px 0 16px;
  font-size: 13px;
  color: var(--text-color);
}
.backend-bar strong { margin-right: 6px; }
.backend-bar a {
  color: var(--link-color);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.backend-bar .sep { color: var(--muted-color); margin: 0 2px; }
.backend-bar .bdot {
  display: inline-block;
  width: 4px; height: 14px;
  background: #2bb24c;
  vertical-align: middle;
}
.backend-bar .bdot.warn { background: #e0a52b; }
.backend-bar .bdot.bad  { background: #b00020; }
.backend-bar a.active { font-weight: bold; text-decoration: underline; }

/* ===== Navbar (top) ===== */
.h-nav {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
}
.h-nav .nav-brand {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-color);
  text-decoration: none;
}
.h-nav .nav-brand:hover { text-decoration: none; }
.h-nav .nav-center {
  display: flex;
  gap: 28px;
  flex: 1;
  justify-content: center;
  color: var(--text-color);
}
.h-nav .nav-center a { color: var(--text-color); }
.h-nav .nav-right {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--muted-color);
}
.h-nav .nav-right .icon-btn {
  background: none; border: none; color: var(--muted-color);
  font-size: 16px; cursor: pointer; padding: 4px;
}
.h-nav .nav-right a { color: var(--text-color); }

/* ===== Search form ===== */
.search-form { display: flex; align-items: center; position: relative; }
.search-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--search-border);
  color: var(--text-color);
  font-size: 16px;
  padding: 8px 34px 8px 8px;
  outline: none;
  transition: border-color 0.2s;
  width: 500px;
  max-width: 90vw;
}
.search-input:focus { border-bottom-color: var(--accent); }
.search-btn {
  background: transparent;
  border: none;
  color: var(--muted-color);
  position: absolute;
  right: 6px; top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  padding: 4px;
  display: flex; align-items: center; justify-content: center;
}
.search-btn svg { width: 18px; height: 18px; }
.nav-search .search-input { width: 360px; }

/* ===== Footer ===== */
.footer {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 30px 40px;
  font-size: 13px;
  color: var(--muted-color);
  border-top: 1px solid var(--border-color);
  margin-top: 32px;
  gap: 20px;
}
.footer p { margin: 6px 0; }
.footer a { color: var(--link-color); }

/* ===== Video grid ===== */
.results-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding: 20px;
}
.video-card { display: flex; flex-direction: column; background: var(--bg-color); }
.thumbnail-wrapper {
  position: relative; width: 100%; aspect-ratio: 16/9;
  background-color: #000; overflow: hidden; display: block;
}
.thumbnail-wrapper img {
  width: 100%; height: 100%; object-fit: cover; transition: opacity .2s;
}
.thumbnail-wrapper:hover img { opacity: .85; }
.duration {
  position: absolute; bottom: 5px; right: 5px;
  background: rgba(0,0,0,.8); color: #fff;
  font-size: 12px; padding: 2px 5px; border-radius: 2px;
}
.live-badge {
  position: absolute; bottom: 5px; right: 5px;
  background: #d33; color: #fff; font-size: 12px;
  padding: 2px 5px; border-radius: 2px; font-weight: 700;
}
.video-info { padding-top: 10px; }
.video-title {
  font-size: 14px; font-weight: 600; line-height: 1.4;
  margin: 0 0 4px 0; color: var(--text-color);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.video-title a { color: var(--text-color); }
.channel-name { font-size: 13px; color: var(--muted-color); margin-bottom: 3px; }
.video-meta { font-size: 12px; color: var(--muted-color); }

/* ===== Filter bar ===== */
.filter-bar {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  font-size: 14px;
  display: flex; align-items: center; gap: 12px;
  flex-wrap: wrap;
}
.filter-bar details { display: inline-block; }
.filter-bar summary { cursor: pointer; font-weight: 600; }
.filter-bar form { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.filter-bar select { padding: 4px 8px; }

/* ===== Pagination ===== */
.pagination {
  display: flex; justify-content: center; gap: 10px;
  padding: 20px; font-size: 14px;
}
.pagination a, .pagination span {
  padding: 6px 14px; border: 1px solid var(--border-color);
  color: var(--link-color); border-radius: 3px;
}
.pagination .disabled { color: var(--muted-color); }

/* ===== Notice ===== */
.notice-box {
  margin: 60px auto; padding: 40px; max-width: 600px;
  background: var(--bg-alt); border: 1px solid var(--border-color);
  border-radius: 4px; text-align: center;
}
.notice-box h2 { margin-bottom: 16px; }
.notice-box p { color: var(--muted-color); }
`;

/**
 * バックエンドスイッチャー (B1-B8) のレンダリング
 */
function renderBackendBar() {
  const items = BACKEND_LABELS.map((b, i) => {
    const h = _backendHealth.get(b.url);
    const cls = !h ? 'bdot' : h.failures === 0 ? 'bdot' : h.failures < 3 ? 'bdot warn' : 'bdot bad';
    return `<a href="#" class="be-switch" data-idx="${i}" data-url="${_esc(b.url)}">${b.id} (${b.region})</a> <span class="${cls}"></span>`;
  }).join('<span class="sep">|</span> ');
  return `<div class="backend-bar"><strong>Switch backend:</strong> ${items}</div>`;
}

/**
 * トップナビ (検索ページ等の上部)
 */
function renderNav(searchQuery = '', opts = {}) {
  const showCenter = opts.showCenter !== false;
  return `
  ${renderBackendBar()}
  <nav class="h-nav">
    <a href="/" class="nav-brand">INVIDIOUS</a>
    ${showCenter ? `<div class="nav-center">
      <a href="/feed/popular">人気</a>
      <a href="/feed/trending">急上昇</a>
    </div>` : '<div style="flex:1"></div>'}
    <form class="search-form nav-search" action="/search" method="GET" role="search">
      <input type="text" name="q" class="search-input" value="${_esc(searchQuery)}" placeholder="検索" autocomplete="off">
      <button type="submit" class="search-btn" aria-label="検索">${SEARCH_ICON_SVG}</button>
    </form>
    <div class="nav-right">
      <button class="icon-btn" id="theme-toggle" title="ダーク／ライト">${THEME_ICON_SVG}</button>
      <a href="/preferences" title="設定" class="icon-btn">${GEAR_ICON_SVG}</a>
      <a href="/login">ログイン</a>
    </div>
  </nav>
  `;
}

// 画像のスクリーンショットに合わせたモノクロのきれいな虫眼鏡 SVG
const SEARCH_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/>
  <line x1="16.1" y1="16.1" x2="20.5" y2="20.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

const THEME_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

const GEAR_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>`;

/**
 * フッター (Invidious 風)
 */
function renderFooter() {
  return `
  <footer class="footer">
    <div>
      <p><a href="https://github.com/iv-org/invidious">⭮ 元のソースコード</a> / 改変し使用中</p>
      <p><a href="https://docs.invidious.io/">🕮 説明書</a></p>
    </div>
    <div>
      <p>GitHub 上で <a href="https://www.gnu.org/licenses/agpl-3.0.html">AGPLv3</a> の元で公開</p>
      <p><a href="/licenses">JS JavaScriptライセンス情報</a></p>
      <p><a href="/privacy">🕮 個人情報保護方針</a></p>
    </div>
    <div>
      <p><a href="https://invidious.io/">🗀 Services</a></p>
      <p><a href="https://github.com/iv-org/invidious/discussions">≡ Forum</a></p>
      <p>☕ <a href="https://liberapay.com/invidious">寄付する @ Invidious.io</a></p>
      <p>現在のバージョン: 2026.05.20-mini @ master</p>
    </div>
  </footer>
  `;
}

/**
 * 共通の <head> + アセット (Invidious が読み込んでいるパスに似せる)。
 * 動画ページで真贋判定されないよう、player 用 CSS/JS は明示的にぶら下げる。
 */
function renderHead(title, extra = '') {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#ffffff">
<meta name="robots" content="noindex, nofollow">
<title>${_esc(title)}</title>
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="stylesheet" href="/css/default.css?v=${LAYOUT_VERSION}">
<style>${commonCSS}</style>
${extra}
</head>`;
}

/**
 * グローバル JS — テーマ切替 + バックエンドスイッチャー の挙動。
 * 全ページに <script> として埋め込む。
 */
const GLOBAL_JS = `
(function(){
  // ===== Theme toggle =====
  try {
    var saved = localStorage.getItem('iv-theme');
    if (saved === 'dark' || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(_) {}
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('#theme-toggle');
    if (t) {
      var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? '' : 'dark';
      if (cur) document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('iv-theme', cur || 'light'); } catch(_) {}
    }
  });

  // ===== Backend switcher =====
  function activeBackend() {
    try { return localStorage.getItem('iv-backend') || ''; } catch(_) { return ''; }
  }
  function markActive() {
    var cur = activeBackend();
    document.querySelectorAll('.be-switch').forEach(function(a){
      if (a.dataset.url === cur) a.classList.add('active');
      else a.classList.remove('active');
    });
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('.be-switch');
    if (t) {
      e.preventDefault();
      try { localStorage.setItem('iv-backend', t.dataset.url); } catch(_) {}
      markActive();
    }
  });
  markActive();

  // ===== Backend header propagation (API 呼び出しに乗せる) =====
  var _fetch = window.fetch;
  window.fetch = function(input, init) {
    init = init || {};
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/v1/') === 0 || url.indexOf('/api/internal/') === 0) {
      init.headers = Object.assign({}, init.headers || {}, { 'X-Iv-Backend': activeBackend() });
    }
    return _fetch(input, init);
  };
})();
`;


// ==========================================
// Page renderers
// ==========================================

// ---- HOME ----
function renderHomePage() {
  return `${renderHead('Invidious')}
<body>
  ${renderBackendBar()}
  <div style="position:absolute;top:14px;right:20px;display:flex;gap:14px;align-items:center;color:var(--muted-color);">
    <button class="icon-btn" id="theme-toggle" title="ダーク／ライト" style="background:none;border:none;cursor:pointer;color:inherit;">${THEME_ICON_SVG}</button>
    <a href="/preferences" title="設定" class="icon-btn" style="color:inherit;">${GEAR_ICON_SVG}</a>
    <a href="/login" style="color:var(--text-color);">ログイン</a>
  </div>
  <main style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;">
    <div style="display:flex;gap:34px;margin-bottom:30px;font-size:14px;">
      <a href="/feed/popular" style="color:var(--text-color);">人気</a>
      <a href="/feed/trending" style="color:var(--text-color);">急上昇</a>
    </div>
    <h1 style="font-size:64px;font-weight:700;letter-spacing:2px;color:var(--muted-color);margin:20px 0 30px 0;">INVIDIOUS</h1>
    <form class="search-form" action="/search" method="GET" role="search">
      <input type="text" name="q" class="search-input" placeholder="検索" autofocus autocomplete="off">
      <button type="submit" class="search-btn" aria-label="検索">${SEARCH_ICON_SVG}</button>
    </form>
  </main>
  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
</body>
</html>`;
}

// ---- SEARCH RESULTS ----
function renderSearchResults(query, videos, page, filters) {
  const cards = videos.map(v => {
    const id = v.videoId || v.id;
    const isChannel = v.type === 'channel' || v.authorId === id;
    const isPlaylist = v.type === 'playlist' || v.playlistId;
    if (isChannel) {
      const ucid = v.authorId || v.id;
      return `
        <div class="video-card">
          <a href="/channel/${_esc(ucid)}" class="thumbnail-wrapper" style="aspect-ratio:1;background:#ccc;border-radius:50%;">
            <img src="${_esc((v.authorThumbnails && v.authorThumbnails[0] && v.authorThumbnails[0].url) || '/ggpht/default')}" alt="" loading="lazy" style="border-radius:50%;">
          </a>
          <div class="video-info">
            <h3 class="video-title"><a href="/channel/${_esc(ucid)}">${_esc(v.author || v.title || 'Channel')}</a></h3>
            <div class="video-meta">${_fmtNum(v.subCount)} subscribers · ${_fmtNum(v.videoCount)} videos</div>
            <div class="channel-name">${_esc(v.description || '')}</div>
          </div>
        </div>`;
    }
    if (isPlaylist) {
      const plid = v.playlistId;
      const thumb = (v.playlistThumbnail) || (v.videos && v.videos[0] && `https://i.ytimg.com/vi/${v.videos[0].videoId}/hqdefault.jpg`) || '';
      return `
        <div class="video-card">
          <a href="/playlist?list=${_esc(plid)}" class="thumbnail-wrapper">
            <img src="${_esc(thumb)}" alt="" loading="lazy">
            <span class="duration">▶ ${_fmtNum(v.videoCount)} videos</span>
          </a>
          <div class="video-info">
            <h3 class="video-title"><a href="/playlist?list=${_esc(plid)}">${_esc(v.title)}</a></h3>
            <div class="channel-name"><a href="/channel/${_esc(v.authorId)}">${_esc(v.author)}</a></div>
          </div>
        </div>`;
    }
    // Video
    const title = v.title || 'No Title';
    const thumb = v.videoThumbnails?.[0]?.url
               || v.thumbnail?.thumbnails?.[0]?.url
               || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const durStr = v.lengthSeconds ? _fmtDuration(v.lengthSeconds)
                 : (v.length?.simpleText || v.duration || '');
    const ch = v.author || v.channelTitle || '';
    const ucid = v.authorId || v.channelId || '';
    const views = v.viewCount != null
      ? _fmtViews(v.viewCount)
      : (v.viewCountText || v.viewCount?.text || v.viewCount?.short || '');
    const published = v.publishedText || v.publishedTimeText || (v.published ? _timeAgo(v.published) : '');
    const isLive = v.liveNow || v.isLive;
    return `
      <div class="video-card">
        <a href="/watch?v=${_esc(id)}" class="thumbnail-wrapper">
          <img src="${_esc(thumb)}" alt="${_esc(title)}" loading="lazy">
          ${isLive ? `<span class="live-badge">LIVE</span>` : (durStr ? `<span class="duration">${_esc(durStr)}</span>` : '')}
        </a>
        <div class="video-info">
          <h3 class="video-title"><a href="/watch?v=${_esc(id)}">${_esc(title)}</a></h3>
          <div class="channel-name">${ucid ? `<a href="/channel/${_esc(ucid)}">${_esc(ch)}</a>` : _esc(ch)}</div>
          <div class="video-meta">${_esc(published)}${published && views ? ' · ' : ''}${_esc(views)}</div>
        </div>
      </div>`;
  }).join('');

  const qs = (extra) => {
    const p = new URLSearchParams({ q: query, ...filters, ...extra });
    return p.toString();
  };

  return `${renderHead(`${query} - Invidious`)}
<body>
  ${renderNav(query)}
  <div class="filter-bar">
    <details>
      <summary>[ + ] フィルタ</summary>
      <form method="GET" action="/search">
        <input type="hidden" name="q" value="${_esc(query)}">
        <label>並び順
          <select name="sort">
            <option value="relevance" ${filters.sort==='relevance'?'selected':''}>関連性</option>
            <option value="rating" ${filters.sort==='rating'?'selected':''}>評価</option>
            <option value="upload_date" ${filters.sort==='upload_date'?'selected':''}>新しい順</option>
            <option value="view_count" ${filters.sort==='view_count'?'selected':''}>視聴回数</option>
          </select>
        </label>
        <label>期間
          <select name="date">
            <option value="">指定なし</option>
            <option value="hour" ${filters.date==='hour'?'selected':''}>1時間以内</option>
            <option value="today" ${filters.date==='today'?'selected':''}>今日</option>
            <option value="week" ${filters.date==='week'?'selected':''}>今週</option>
            <option value="month" ${filters.date==='month'?'selected':''}>今月</option>
            <option value="year" ${filters.date==='year'?'selected':''}>今年</option>
          </select>
        </label>
        <label>長さ
          <select name="duration">
            <option value="">指定なし</option>
            <option value="short" ${filters.duration==='short'?'selected':''}>短い (&lt;4分)</option>
            <option value="medium" ${filters.duration==='medium'?'selected':''}>中 (4-20分)</option>
            <option value="long" ${filters.duration==='long'?'selected':''}>長い (&gt;20分)</option>
          </select>
        </label>
        <label>種類
          <select name="type">
            <option value="all" ${filters.type==='all'?'selected':''}>全て</option>
            <option value="video" ${filters.type==='video'?'selected':''}>動画</option>
            <option value="channel" ${filters.type==='channel'?'selected':''}>チャンネル</option>
            <option value="playlist" ${filters.type==='playlist'?'selected':''}>プレイリスト</option>
          </select>
        </label>
        <button type="submit">適用</button>
      </form>
    </details>
    <span class="muted">${videos.length} 件 · ページ ${page}</span>
  </div>

  <div class="results-container">${cards || '<p style="padding:20px;">結果なし</p>'}</div>

  <div class="pagination">
    ${page > 1 ? `<a href="/search?${qs({ page: page-1 })}">← 前のページ</a>` : `<span class="disabled">← 前のページ</span>`}
    <span>ページ ${page}</span>
    <a href="/search?${qs({ page: page+1 })}">次のページ →</a>
  </div>

  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
</body>
</html>`;
}

// ---- WATCH ----
function renderWatchPage(videoId, meta) {
  const m = meta || {};
  const title = m.title || `動画 ${videoId}`;
  const author = m.author || m.channelTitle || '';
  const ucid = m.channelId || m.authorId || '';
  const viewCount = m.viewCount != null ? _fmtViews(m.viewCount) : (m.viewCountText || '');
  const desc = m.description || m.shortDescription || '';
  const published = m.publishDate || m.uploadDate || '';
  const likeCount = m.likeCount != null ? _fmtNum(m.likeCount) : '';
  const lengthSec = m.lengthSeconds || m.duration || 0;
  const thumb = (m.thumbnails && m.thumbnails[m.thumbnails.length-1]?.url)
             || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  // 関連動画
  const related = (m.relatedVideos || []).slice(0, 20).map(r => `
    <a href="/watch?v=${_esc(r.videoId || r.id)}" class="related-card">
      <img src="${_esc(r.thumbnail || r.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${r.videoId||r.id}/mqdefault.jpg`)}" alt="" loading="lazy">
      <div class="related-info">
        <div class="related-title">${_esc(r.title || '')}</div>
        <div class="related-meta">${_esc(r.author || '')}<br>${_esc(r.viewCountText || (r.viewCount ? _fmtViews(r.viewCount) : ''))}</div>
      </div>
    </a>
  `).join('');

  const extraHead = `
<link rel="stylesheet" href="/videojs/video.js/video-js.css?v=${LAYOUT_VERSION}">
<link rel="stylesheet" href="/videojs/videojs-http-source-selector/videojs-http-source-selector.css?v=${LAYOUT_VERSION}">
<link rel="stylesheet" href="/videojs/videojs-markers/videojs.markers.css?v=${LAYOUT_VERSION}">
<link rel="stylesheet" href="/videojs/videojs-share/videojs-share.css?v=${LAYOUT_VERSION}">
<link rel="stylesheet" href="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.css?v=${LAYOUT_VERSION}">
<link rel="stylesheet" href="/videojs/videojs-mobile-ui/videojs-mobile-ui.css?v=${LAYOUT_VERSION}">
<link rel="stylesheet" href="/css/player.css?v=${LAYOUT_VERSION}">
<script src="/videojs/video.js/video.js?v=${LAYOUT_VERSION}"></script>
<script src="/videojs/videojs-mobile-ui/videojs-mobile-ui.js?v=${LAYOUT_VERSION}"></script>
<script src="/videojs/videojs-contrib-quality-levels/videojs-contrib-quality-levels.js?v=${LAYOUT_VERSION}"></script>
<script src="/videojs/videojs-http-source-selector/videojs-http-source-selector.js?v=${LAYOUT_VERSION}"></script>
<script src="/videojs/videojs-markers/videojs-markers.js?v=${LAYOUT_VERSION}"></script>
<script src="/videojs/videojs-share/videojs-share.js?v=${LAYOUT_VERSION}"></script>
<script src="/videojs/videojs-vtt-thumbnails/videojs-vtt-thumbnails.js?v=${LAYOUT_VERSION}"></script>
<style>
  .watch-grid {
    display: grid; grid-template-columns: minmax(0, 1fr) 360px;
    gap: 24px; padding: 20px; max-width: 1600px; margin: 0 auto;
  }
  @media (max-width: 1000px) { .watch-grid { grid-template-columns: 1fr; } }
  .player-wrap { width: 100%; background: #000; position: relative; aspect-ratio: 16/9; }
  .player-wrap video, .player-wrap .video-js { width: 100%; height: 100%; }
  .video-title-h1 { font-size: 20px; margin: 16px 0 8px 0; }
  .meta-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 14px; color: var(--muted-color); }
  .meta-row .ch-link { color: var(--text-color); font-weight: 600; }
  .meta-actions { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }
  .meta-actions button, .meta-actions a {
    background: var(--bg-alt); border: 1px solid var(--border-color);
    color: var(--text-color); padding: 6px 12px; border-radius: 18px;
    cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 5px;
  }
  .meta-actions button:hover, .meta-actions a:hover { background: var(--hover-bg); text-decoration: none; }
  .desc-box {
    background: var(--bg-alt); border: 1px solid var(--border-color);
    border-radius: 8px; padding: 12px; margin-top: 14px; white-space: pre-wrap;
    font-size: 14px; line-height: 1.6; max-height: 200px; overflow: hidden;
    transition: max-height 0.3s;
  }
  .desc-box.expanded { max-height: none; }
  .desc-toggle {
    display: block; margin-top: 6px; background: none; border: none;
    color: var(--link-color); font-weight: 600; cursor: pointer; padding: 4px 0;
  }
  .quality-bar {
    display: flex; gap: 8px; padding: 8px 0; flex-wrap: wrap;
    font-size: 13px; align-items: center;
  }
  .quality-bar button {
    background: var(--bg-alt); border: 1px solid var(--border-color);
    padding: 4px 10px; border-radius: 12px; cursor: pointer; color: var(--text-color);
  }
  .quality-bar button.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  .related-card { display: flex; gap: 8px; padding: 8px; border-radius: 4px; }
  .related-card:hover { background: var(--hover-bg); text-decoration: none; }
  .related-card img { width: 160px; aspect-ratio: 16/9; object-fit: cover; background: #000; }
  .related-info { flex: 1; min-width: 0; }
  .related-title {
    font-size: 13px; font-weight: 600; color: var(--text-color);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .related-meta { font-size: 12px; color: var(--muted-color); margin-top: 4px; }

  /* Comments */
  .comments-section { margin-top: 20px; }
  .comments-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
  .comment {
    display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--border-color);
  }
  .comment img.avatar { width: 40px; height: 40px; border-radius: 50%; background: #ccc; }
  .comment .c-author { font-weight: 600; font-size: 13px; }
  .comment .c-meta   { color: var(--muted-color); font-size: 12px; margin-left: 6px; }
  .comment .c-text   { font-size: 14px; margin-top: 4px; white-space: pre-wrap; }
  .comment .c-stats  { font-size: 12px; color: var(--muted-color); margin-top: 6px; }
  .comments-loading, .comments-error { padding: 20px; text-align: center; color: var(--muted-color); }
  .load-more-btn {
    display: block; margin: 16px auto; padding: 8px 20px;
    background: var(--bg-alt); border: 1px solid var(--border-color);
    border-radius: 18px; cursor: pointer; color: var(--text-color); font-size: 14px;
  }
  .load-more-btn:hover { background: var(--hover-bg); }
</style>`;

  return `${renderHead(`${title} - Invidious`, extraHead)}
<body>
  ${renderNav('')}
  <div class="watch-grid">
    <div class="main-col">
      <div class="player-wrap" id="player-wrap">
        <video id="iv-player" class="video-js vjs-default-skin vjs-big-play-centered" controls preload="auto" poster="${_esc(thumb)}" data-setup='{"playbackRates":[0.25,0.5,0.75,1,1.25,1.5,1.75,2]}'>
          <p class="vjs-no-js">JavaScript を有効にしてください。</p>
        </video>
      </div>

      <div class="quality-bar">
        <span class="muted">画質:</span>
        <button class="q-btn active" data-q="360p">360p (音声込み)</button>
        <button class="q-btn" data-q="720p">720p HD</button>
        <button class="q-btn" data-q="1080p">1080p HD</button>
        <span class="muted" style="margin-left:auto;font-size:12px;" id="q-status">ロード中…</span>
      </div>

      <h1 class="video-title-h1">${_esc(title)}</h1>
      <div class="meta-row">
        ${ucid ? `<a href="/channel/${_esc(ucid)}" class="ch-link">${_esc(author)}</a>` : `<span class="ch-link">${_esc(author)}</span>`}
        <span>${_esc(viewCount)}</span>
        <span>${_esc(published)}</span>
        <div class="meta-actions">
          <button id="btn-like" type="button">👍 ${_esc(likeCount)}</button>
          <button id="btn-dislike" type="button">👎</button>
          <button id="btn-share" type="button">🔗 共有</button>
          <a href="https://www.youtube.com/watch?v=${_esc(videoId)}" target="_blank" rel="noopener">YouTube</a>
        </div>
      </div>

      <div class="desc-box" id="desc-box">${_esc(desc)}</div>
      <button class="desc-toggle" id="desc-toggle" type="button">… 続きを読む</button>

      <section class="comments-section">
        <div class="comments-title">コメント</div>
        <div id="comments-list">
          <div class="comments-loading">コメントを読み込み中…</div>
        </div>
        <button class="load-more-btn" id="load-more-comments" type="button" style="display:none;">もっと読み込む</button>
      </section>
    </div>

    <aside class="related-col">
      <h3 style="font-size:14px;margin:0 0 8px 0;">関連動画</h3>
      <div id="related-list">${related || '<div class="muted">関連動画を読み込み中…</div>'}</div>
    </aside>
  </div>

  ${renderFooter()}

  <script>${GLOBAL_JS}</script>
  <script>
  (function(){
    var videoId = ${JSON.stringify(videoId)};
    var qStatus = document.getElementById('q-status');

    // 説明欄
    var descBox = document.getElementById('desc-box');
    var descTgl = document.getElementById('desc-toggle');
    if (descBox && descTgl) {
      if (descBox.scrollHeight <= descBox.clientHeight) descTgl.style.display = 'none';
      descTgl.addEventListener('click', function(){
        descBox.classList.toggle('expanded');
        descTgl.textContent = descBox.classList.contains('expanded') ? '折りたたむ' : '… 続きを読む';
      });
    }

    // 共有
    document.getElementById('btn-share').addEventListener('click', function(){
      var url = location.origin + '/watch?v=' + videoId;
      if (navigator.share) { navigator.share({ url: url, title: ${JSON.stringify(title)} }); return; }
      navigator.clipboard.writeText(url).then(function(){ alert('リンクをコピーしました'); });
    });

    // ===== Player setup with video.js + 高画質+音声分離 同期再生 =====
    var player = videojs('iv-player', { fluid: false, playbackRates:[0.25,0.5,0.75,1,1.25,1.5,1.75,2] });
    var audioEl = null; // 音声同期用のサブ <audio>
    var currentQ = '360p';

    function destroyAudioEl() {
      if (audioEl) { try { audioEl.pause(); } catch(_){}; audioEl.remove(); audioEl = null; }
    }
    function syncAudio() {
      if (!audioEl) return;
      if (Math.abs((audioEl.currentTime||0) - (player.currentTime()||0)) > 0.25) {
        audioEl.currentTime = player.currentTime();
      }
    }

    function setQuality(q) {
      currentQ = q;
      document.querySelectorAll('.q-btn').forEach(function(b){
        b.classList.toggle('active', b.dataset.q === q);
      });
      qStatus.textContent = '画質切替: ' + q + ' …';
      var t = player.currentTime() || 0;
      var paused = player.paused();
      destroyAudioEl();

      if (q === '360p') {
        // 音声付き 360p (formatId=2)
        fetch('/api/stream/' + videoId + '?q=360p').then(function(r){return r.text();}).then(function(url){
          player.src({ src: url, type: 'video/mp4' });
          player.one('loadedmetadata', function(){
            try { player.currentTime(t); } catch(_) {}
            if (!paused) player.play();
            qStatus.textContent = '360p (音声込み)';
          });
        }).catch(function(){ qStatus.textContent = '取得失敗'; });
      } else {
        // 高画質映像 (音声無し) + 別音声 (360p の音声) で同期再生
        var fmt = q === '720p' ? '720p' : '1080p';
        Promise.all([
          fetch('/api/stream/' + videoId + '?q=' + fmt).then(function(r){return r.text();}),
          fetch('/api/stream/' + videoId + '?q=360p').then(function(r){return r.text();}),
        ]).then(function(arr){
          var vUrl = arr[0], aUrl = arr[1];
          player.src({ src: vUrl, type: 'video/mp4' });
          player.muted(true); // 動画は無音にして audio 要素で鳴らす
          audioEl = document.createElement('audio');
          audioEl.src = aUrl;
          audioEl.preload = 'auto';
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          player.one('loadedmetadata', function(){
            try { player.currentTime(t); audioEl.currentTime = t; } catch(_) {}
            if (!paused) { player.play(); audioEl.play(); }
            qStatus.textContent = q + ' HD (音声同期中)';
          });
        }).catch(function(){ qStatus.textContent = '取得失敗'; });
      }
    }

    // 音声と動画の同期: 再生/停止/シーク
    player.on('play',  function(){ if (audioEl) audioEl.play().catch(function(){}); });
    player.on('pause', function(){ if (audioEl) audioEl.pause(); });
    player.on('seeked',function(){ syncAudio(); });
    player.on('ratechange', function(){ if (audioEl) audioEl.playbackRate = player.playbackRate(); });
    player.on('volumechange', function(){ if (audioEl) audioEl.volume = player.volume(); });
    setInterval(syncAudio, 1500);

    document.querySelectorAll('.q-btn').forEach(function(b){
      b.addEventListener('click', function(){ setQuality(b.dataset.q); });
    });

    // 初期ロード: 360p
    setQuality('360p');

    // ===== コメント遅延ロード =====
    var commentsList = document.getElementById('comments-list');
    var loadMoreBtn = document.getElementById('load-more-comments');
    var continuation = null;

    function renderComment(c) {
      var av = c.authorThumbnails && c.authorThumbnails[0] ? c.authorThumbnails[0].url : '';
      return '<div class="comment">'
        + '<img class="avatar" src="' + (av || '/ggpht/default') + '" alt="" loading="lazy">'
        + '<div style="flex:1;min-width:0;">'
        + '<span class="c-author">' + (c.author || '匿名') + '</span>'
        + '<span class="c-meta">' + (c.publishedText || '') + '</span>'
        + '<div class="c-text">' + (c.contentHtml || (c.content||'').replace(/</g,'&lt;')) + '</div>'
        + '<div class="c-stats">👍 ' + (c.likeCount||0) + (c.replies && c.replies.replyCount ? ' · ' + c.replies.replyCount + ' 件の返信' : '') + '</div>'
        + '</div></div>';
    }

    function loadComments(token) {
      var url = '/api/v1/comments/' + videoId + (token ? '?continuation=' + encodeURIComponent(token) : '');
      return fetch(url).then(function(r){
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }

    setTimeout(function(){
      loadComments(null).then(function(data){
        commentsList.innerHTML = '';
        (data.comments || []).forEach(function(c){
          commentsList.insertAdjacentHTML('beforeend', renderComment(c));
        });
        continuation = data.continuation;
        if (continuation) loadMoreBtn.style.display = 'block';
        if (!data.comments || data.comments.length === 0) {
          commentsList.innerHTML = '<div class="comments-loading">コメントはありません。</div>';
        }
      }).catch(function(e){
        commentsList.innerHTML = '<div class="comments-error">コメントの読み込みに失敗しました。</div>';
      });
    }, 200);

    loadMoreBtn.addEventListener('click', function(){
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = '読み込み中…';
      loadComments(continuation).then(function(data){
        (data.comments || []).forEach(function(c){
          commentsList.insertAdjacentHTML('beforeend', renderComment(c));
        });
        continuation = data.continuation;
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'もっと読み込む';
        if (!continuation) loadMoreBtn.style.display = 'none';
      }).catch(function(){
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '再試行';
      });
    });
  })();
  </script>
</body>
</html>`;
}

// ---- CHANNEL ----
function renderChannelPage(ucid, channel, videos, tab) {
  const c = channel || {};
  const banner = c.authorBanners?.[c.authorBanners.length-1]?.url || '';
  const avatar = c.authorThumbnails?.[c.authorThumbnails.length-1]?.url || '';
  const subCount = c.subCount != null ? _fmtNum(c.subCount) + ' subscribers' : '';

  const tabs = ['videos', 'shorts', 'streams', 'playlists', 'community', 'about'];
  const tabNav = tabs.map(t => {
    const active = t === tab ? 'style="font-weight:700;border-bottom:2px solid var(--accent);"' : '';
    return `<a href="/channel/${_esc(ucid)}?tab=${t}" ${active}>${t}</a>`;
  }).join('');

  const items = (videos || []).map(v => {
    const id = v.videoId || v.id;
    const title = v.title || '';
    const thumb = v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const dur = v.lengthSeconds ? _fmtDuration(v.lengthSeconds) : '';
    const views = v.viewCount != null ? _fmtViews(v.viewCount) : '';
    const published = v.publishedText || (v.published ? _timeAgo(v.published) : '');
    return `
      <div class="video-card">
        <a href="/watch?v=${_esc(id)}" class="thumbnail-wrapper">
          <img src="${_esc(thumb)}" alt="" loading="lazy">
          ${dur ? `<span class="duration">${_esc(dur)}</span>` : ''}
        </a>
        <div class="video-info">
          <h3 class="video-title"><a href="/watch?v=${_esc(id)}">${_esc(title)}</a></h3>
          <div class="video-meta">${_esc(views)}${views && published ? ' · ' : ''}${_esc(published)}</div>
        </div>
      </div>`;
  }).join('');

  const extraHead = `<style>
    .ch-banner { width:100%; aspect-ratio: 6.2/1; background:#222 center/cover no-repeat; ${banner ? `background-image:url('${_esc(banner)}');` : ''} }
    .ch-header { display:flex; gap:16px; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border-color); }
    .ch-header img { width:80px; height:80px; border-radius:50%; background:#ccc; }
    .ch-name { font-size:22px; font-weight:700; }
    .ch-sub  { color:var(--muted-color); font-size:13px; }
    .ch-tabs { display:flex; gap:24px; padding:10px 20px; border-bottom:1px solid var(--border-color); text-transform:uppercase; font-size:13px; }
    .ch-tabs a { color:var(--text-color); padding-bottom:8px; }
  </style>`;

  return `${renderHead(`${c.author || 'Channel'} - Invidious`, extraHead)}
<body>
  ${renderNav('')}
  <div class="ch-banner"></div>
  <div class="ch-header">
    ${avatar ? `<img src="${_esc(avatar)}" alt="">` : `<img src="/ggpht/default" alt="">`}
    <div style="flex:1;">
      <div class="ch-name">${_esc(c.author || 'Channel')}</div>
      <div class="ch-sub">${_esc(subCount)}${c.totalViews ? ' · ' + _fmtNum(c.totalViews) + ' total views' : ''}</div>
      <div class="ch-sub">${_esc((c.description||'').slice(0, 200))}${c.description && c.description.length>200 ? '…' : ''}</div>
    </div>
    <button class="meta-actions" style="background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:18px;cursor:pointer;font-size:14px;" id="btn-subscribe">登録</button>
  </div>
  <nav class="ch-tabs">${tabNav}</nav>

  <div class="results-container">${items || '<p style="padding:20px;">コンテンツがありません</p>'}</div>

  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
  <script>
    document.getElementById('btn-subscribe').addEventListener('click', function(){
      try {
        var subs = JSON.parse(localStorage.getItem('iv-subs') || '[]');
        var ucid = ${JSON.stringify(ucid)};
        if (subs.indexOf(ucid) >= 0) { subs = subs.filter(function(s){return s!==ucid;}); this.textContent='登録'; }
        else { subs.push(ucid); this.textContent='登録解除'; }
        localStorage.setItem('iv-subs', JSON.stringify(subs));
      } catch(_) {}
    });
    try {
      var subs = JSON.parse(localStorage.getItem('iv-subs') || '[]');
      if (subs.indexOf(${JSON.stringify(ucid)}) >= 0) document.getElementById('btn-subscribe').textContent='登録解除';
    } catch(_) {}
  </script>
</body>
</html>`;
}

// ---- PLAYLIST ----
function renderPlaylistPage(plid, pl) {
  const videos = (pl.videos || []).map(v => {
    const id = v.videoId;
    const title = v.title || '';
    const thumb = v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const dur = v.lengthSeconds ? _fmtDuration(v.lengthSeconds) : '';
    return `
      <div class="video-card">
        <a href="/watch?v=${_esc(id)}&list=${_esc(plid)}" class="thumbnail-wrapper">
          <img src="${_esc(thumb)}" alt="" loading="lazy">
          ${dur ? `<span class="duration">${_esc(dur)}</span>` : ''}
        </a>
        <div class="video-info">
          <h3 class="video-title"><a href="/watch?v=${_esc(id)}&list=${_esc(plid)}">${_esc(title)}</a></h3>
          <div class="channel-name">${_esc(v.author || '')}</div>
        </div>
      </div>`;
  }).join('');

  return `${renderHead(`${pl.title || 'Playlist'} - Invidious`)}
<body>
  ${renderNav('')}
  <div style="padding:20px;border-bottom:1px solid var(--border-color);">
    <h1 style="margin:0 0 6px 0;font-size:22px;">${_esc(pl.title || 'Playlist')}</h1>
    <div class="muted">${pl.videoCount || (pl.videos||[]).length} 本 · <a href="/channel/${_esc(pl.authorId||'')}">${_esc(pl.author||'')}</a></div>
    <p style="margin-top:8px;">${_esc(pl.description || '')}</p>
  </div>
  <div class="results-container">${videos || '<p style="padding:20px;">空のプレイリストです</p>'}</div>
  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
</body>
</html>`;
}

// ---- TRENDING ----
function renderTrendingPage(videos, type) {
  const cards = (videos || []).map(v => {
    const id = v.videoId;
    const thumb = v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const dur = v.lengthSeconds ? _fmtDuration(v.lengthSeconds) : '';
    return `
      <div class="video-card">
        <a href="/watch?v=${_esc(id)}" class="thumbnail-wrapper">
          <img src="${_esc(thumb)}" alt="" loading="lazy">
          ${dur ? `<span class="duration">${_esc(dur)}</span>` : ''}
        </a>
        <div class="video-info">
          <h3 class="video-title"><a href="/watch?v=${_esc(id)}">${_esc(v.title||'')}</a></h3>
          <div class="channel-name"><a href="/channel/${_esc(v.authorId||'')}">${_esc(v.author||'')}</a></div>
          <div class="video-meta">${v.viewCount != null ? _fmtViews(v.viewCount) : ''}${v.publishedText ? ' · ' + _esc(v.publishedText) : ''}</div>
        </div>
      </div>`;
  }).join('');
  const tabs = [['default','全て'],['music','音楽'],['gaming','ゲーム'],['movies','映画']]
    .map(([t,l]) => `<a href="/feed/trending?type=${t}" ${type===t?'style="font-weight:700;border-bottom:2px solid var(--accent);"':''}>${l}</a>`).join(' ');
  return `${renderHead('急上昇 - Invidious')}
<body>
  ${renderNav('')}
  <div style="padding:16px 20px;border-bottom:1px solid var(--border-color);">
    <h1 style="margin:0 0 8px 0;font-size:20px;">急上昇</h1>
    <div style="display:flex;gap:18px;">${tabs}</div>
  </div>
  <div class="results-container">${cards || '<p style="padding:20px;">読み込めませんでした</p>'}</div>
  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
</body>
</html>`;
}

// ---- DELETED / NOTICE ----
function renderDeletedPage(title) {
  return `${renderHead(`${title} - Invidious`)}
<body>
  ${renderNav('')}
  <main style="flex:1;">
    <div class="notice-box">
      <h2>${_esc(title)}</h2>
      <p>This page has been deleted to reduce maintenance costs.</p>
      <p style="margin-top:16px;"><a href="/">ホームに戻る</a></p>
    </div>
  </main>
  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
</body>
</html>`;
}

// ---- PREFERENCES ----
function renderPreferencesPage() {
  return `${renderHead('設定 - Invidious')}
<body>
  ${renderNav('')}
  <main style="flex:1;padding:20px;max-width:800px;margin:0 auto;">
    <h1>設定</h1>
    <section style="margin-top:20px;">
      <h3>表示</h3>
      <label><input type="checkbox" id="pref-dark"> ダークテーマを使用</label>
    </section>
    <section style="margin-top:20px;">
      <h3>再生</h3>
      <label>デフォルト画質
        <select id="pref-quality">
          <option value="360p">360p</option>
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
        </select>
      </label>
    </section>
    <section style="margin-top:20px;">
      <h3>バックエンド</h3>
      <p class="muted">優先するバックエンドを画面上部のスイッチャーから選択できます。</p>
      <div id="pref-be"></div>
    </section>
    <button type="button" id="pref-save" style="margin-top:20px;padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:18px;cursor:pointer;">保存</button>
  </main>
  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
  <script>
    try {
      document.getElementById('pref-dark').checked = (localStorage.getItem('iv-theme') === 'dark');
      document.getElementById('pref-quality').value = localStorage.getItem('iv-default-q') || '360p';
    } catch(_){}
    document.getElementById('pref-save').addEventListener('click', function(){
      try {
        localStorage.setItem('iv-theme', document.getElementById('pref-dark').checked ? 'dark' : 'light');
        localStorage.setItem('iv-default-q', document.getElementById('pref-quality').value);
      } catch(_){}
      alert('保存しました');
      location.reload();
    });
  </script>
</body>
</html>`;
}

// ---- LOGIN (dummy) ----
function renderLoginPage() {
  return `${renderHead('ログイン - Invidious')}
<body>
  ${renderNav('')}
  <main style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px;">
    <form style="background:var(--bg-alt);padding:30px;border:1px solid var(--border-color);border-radius:8px;min-width:300px;" method="POST" action="/login" onsubmit="event.preventDefault();alert('現在このインスタンスは登録を停止しています。');">
      <h2 style="margin-top:0;">ログイン</h2>
      <p><label>ユーザー名<br><input type="text" name="username" required style="width:100%;padding:8px;margin-top:4px;"></label></p>
      <p><label>パスワード<br><input type="password" name="password" required style="width:100%;padding:8px;margin-top:4px;"></label></p>
      <p><button type="submit" style="background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:18px;cursor:pointer;">ログイン</button></p>
    </form>
  </main>
  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
</body>
</html>`;
}

// ---- ERROR ----
function renderErrorPage(msg) {
  return `${renderHead('エラー - Invidious')}
<body>
  ${renderNav('')}
  <main style="flex:1;">
    <div class="notice-box">
      <h2>エラーが発生しました</h2>
      <p>${_esc(msg)}</p>
      <p style="margin-top:16px;"><a href="/">ホームに戻る</a></p>
    </div>
  </main>
  ${renderFooter()}
  <script>${GLOBAL_JS}</script>
</body>
</html>`;
}


// ==========================================
// Routing
// ==========================================

// CORS (元の挙動を継承)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Iv-Backend');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 軽量 X-Iv-Backend ヘッダーからフロントエンドが選んだバックエンドを取得
function preferredBackend(req) {
  const h = req.headers['x-iv-backend'];
  if (h && INVIDIOUS_INSTANCES.includes(h)) return h;
  return null;
}

// ---- 既存 /yt-sc/:videoId (scrapeYouTubeMeta) ----
app.get('/yt-sc/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ success: false, error: 'Invalid YouTube video ID (must be exactly 11 characters)' });
  }
  try {
    const data = await scrapeYouTubeMeta(videoId);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, videoId });
  }
});

// ---- HOME ----
app.get('/', (req, res) => res.send(renderHomePage()));

// ---- 検索 (page 1 は yts、page 2+ は Invidious、Channel/Playlist は Invidious) ----
app.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.redirect('/');

  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const filters = {
    sort:     req.query.sort     || 'relevance',
    date:     req.query.date     || '',
    duration: req.query.duration || '',
    type:     req.query.type     || 'all',
  };

  try {
    let videos = [];
    const useYtsModule = page === 1
      && filters.type === 'all'
      && filters.sort === 'relevance'
      && !filters.date
      && !filters.duration;

    if (useYtsModule) {
      // 最速ルート: youtube-search-api モジュールを使用
      try {
        const searchData = await yts.GetListByKeyword(q, false, 24);
        videos = (searchData.items || []).map(it => {
          if (it.type === 'video') {
            return {
              type: 'video',
              videoId: it.id,
              title: it.title,
              thumbnail: it.thumbnail,
              videoThumbnails: (it.thumbnail?.thumbnails || []).map(t => ({ url: t.url })),
              lengthSeconds: it.length?.simpleText ? null : null,
              length: it.length,
              author: it.channelTitle,
              channelTitle: it.channelTitle,
              authorId: it.channelId || '',
              viewCountText: it.viewCount?.text || it.viewCount?.short || '',
              publishedTimeText: it.publishedTimeText || '',
              liveNow: !!it.isLive,
            };
          }
          return it;
        });
      } catch (e) {
        // モジュール失敗時は Invidious にフォールバック
        videos = [];
      }
    }

    if (videos.length === 0) {
      // Invidious 検索 API
      const params = new URLSearchParams({
        q,
        page: String(page),
        sort_by: filters.sort,
        type: filters.type,
      });
      if (filters.date) params.set('date', filters.date);
      if (filters.duration) params.set('duration', filters.duration);

      const { data } = await invidiousApi(`/api/v1/search?${params.toString()}`, {
        preferInstance: preferredBackend(req),
        timeout: 12000,
      });
      videos = data || [];
    }

    res.type('html').send(renderSearchResults(q, videos, page, filters));
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).send(renderErrorPage(err.message));
  }
});

// ---- 検索サジェスト ----
app.get('/api/v1/search/suggestions', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ query: '', suggestions: [] });
  try {
    const { data } = await invidiousApi(`/api/v1/search/suggestions?q=${encodeURIComponent(q)}`, {
      preferInstance: preferredBackend(req),
    });
    res.json(data);
  } catch (e) {
    res.json({ query: q, suggestions: [] });
  }
});

// ---- 動画ページ ----
app.get('/watch', async (req, res) => {
  const videoId = req.query.v;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.redirect('/');

  let meta = {};
  // 並列で 2 系統取得 (yt-sc を最優先 / Invidious をフォールバック)
  try {
    const scrapePromise = scrapeYouTubeMeta(videoId).catch(() => null);
    const ivPromise = invidiousApi(`/api/v1/videos/${videoId}`, {
      preferInstance: preferredBackend(req),
      timeout: 6000,
    }).then(r => r.data).catch(() => null);

    const [s, iv] = await Promise.all([scrapePromise, ivPromise]);
    if (iv) {
      meta = {
        title: iv.title,
        author: iv.author,
        channelId: iv.authorId,
        viewCount: iv.viewCount,
        likeCount: iv.likeCount,
        lengthSeconds: iv.lengthSeconds,
        description: iv.description,
        publishDate: iv.publishedText,
        thumbnails: iv.videoThumbnails,
        relatedVideos: iv.recommendedVideos,
      };
    } else if (s) {
      meta = {
        title: s.title,
        author: s.author || s.channelTitle,
        channelId: s.channelId,
        viewCount: s.viewCount,
        likeCount: s.likeCount,
        lengthSeconds: s.lengthSeconds,
        description: s.description || s.shortDescription,
        publishDate: s.uploadDate || s.publishDate,
        thumbnails: s.thumbnails,
        relatedVideos: [],
      };
    }
  } catch (_) {}

  res.type('html').send(renderWatchPage(videoId, meta));
});

// ---- チャンネルページ ----
app.get('/channel/:ucid', async (req, res) => {
  const ucid = req.params.ucid;
  const tab = req.query.tab || 'videos';
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(ucid)) {
    return res.status(404).send(renderErrorPage('Invalid channel ID'));
  }
  try {
    const pref = preferredBackend(req);
    const [chRes, listRes] = await Promise.all([
      invidiousApi(`/api/v1/channels/${ucid}`, { preferInstance: pref }).catch(() => ({ data: {} })),
      tab === 'about' ? Promise.resolve({ data: [] })
        : invidiousApi(`/api/v1/channels/${ucid}/${tab === 'community' ? 'community' : tab}`, { preferInstance: pref }).catch(() => ({ data: { videos: [] } })),
    ]);
    const channel = chRes.data || {};
    let items = [];
    if (listRes.data) {
      if (Array.isArray(listRes.data)) items = listRes.data;
      else if (Array.isArray(listRes.data.videos)) items = listRes.data.videos;
      else if (Array.isArray(listRes.data.playlists)) items = listRes.data.playlists;
      else if (Array.isArray(listRes.data.latestVideos)) items = listRes.data.latestVideos;
    }
    if (items.length === 0 && Array.isArray(channel.latestVideos)) items = channel.latestVideos;

    res.type('html').send(renderChannelPage(ucid, channel, items, tab));
  } catch (err) {
    res.status(500).send(renderErrorPage(err.message));
  }
});

// /c/:name, /user/:name, /@:handle はチャンネル ID 解決経由
app.get(['/c/:name', '/user/:name', '/@:handle'], async (req, res) => {
  const name = req.params.name || req.params.handle;
  const path = req.path;
  try {
    const target = path.startsWith('/@') ? `/@${name}` : path;
    const { data } = await invidiousApi(`/api/v1/resolveurl?url=${encodeURIComponent('https://www.youtube.com' + target)}`, {
      preferInstance: preferredBackend(req),
    });
    if (data && data.ucid) return res.redirect(`/channel/${data.ucid}`);
    res.status(404).send(renderErrorPage('チャンネルが見つかりません'));
  } catch (e) {
    res.status(500).send(renderErrorPage(e.message));
  }
});

// ---- プレイリスト ----
app.get('/playlist', async (req, res) => {
  const plid = req.query.list;
  if (!plid) return res.redirect('/');
  try {
    const page = parseInt(req.query.page || '1', 10) || 1;
    const { data } = await invidiousApi(`/api/v1/playlists/${plid}?page=${page}`, {
      preferInstance: preferredBackend(req),
    });
    res.type('html').send(renderPlaylistPage(plid, data));
  } catch (err) {
    res.status(500).send(renderErrorPage(err.message));
  }
});

// ---- 急上昇 ----
app.get('/feed/trending', async (req, res) => {
  const type = req.query.type || 'default';
  try {
    const { data } = await invidiousApi(`/api/v1/trending?type=${type}`, {
      preferInstance: preferredBackend(req),
    });
    res.type('html').send(renderTrendingPage(data, type));
  } catch (err) {
    res.status(500).send(renderErrorPage(err.message));
  }
});

// ---- 人気 (削除済み) ----
app.get('/feed/popular', (req, res) => {
  res.status(200).send(renderDeletedPage('人気'));
});
// feed (旧) も削除
app.get('/feed', (req, res) => res.status(200).send(renderDeletedPage('Feed')));
app.get('/feed/subscriptions', (req, res) => res.status(200).send(renderDeletedPage('サブスクリプション')));

// ---- ハッシュタグ ----
app.get('/hashtag/:tag', async (req, res) => {
  const tag = req.params.tag;
  const page = parseInt(req.query.page || '1', 10) || 1;
  try {
    const { data } = await invidiousApi(`/api/v1/hashtag/${encodeURIComponent(tag)}?page=${page}`, {
      preferInstance: preferredBackend(req),
    });
    res.type('html').send(renderTrendingPage(data?.results || data || [], 'default'));
  } catch (err) {
    res.status(500).send(renderErrorPage(err.message));
  }
});

// ---- 設定 / ログイン / 静的 ----
app.get('/preferences', (req, res) => res.send(renderPreferencesPage()));
app.get('/login', (req, res) => res.send(renderLoginPage()));
app.get('/licenses', (req, res) => res.send(renderDeletedPage('Licenses')));
app.get('/privacy', (req, res) => res.send(renderDeletedPage('Privacy')));

// ---- /redirect (Invidious のリダイレクト互換) ----
app.get('/redirect', (req, res) => {
  const url = req.query.url || req.query.q;
  if (!url || !/^https?:\/\//.test(url)) return res.redirect('/');
  res.redirect(url);
});

// ==========================================
// API endpoints
// ==========================================

// ストリーム URL 取得 (getlate を隠蔽)
//   /api/stream/:videoId?q=360p|720p|1080p
app.get('/api/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const q = req.query.q || '360p';
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).type('text').send('bad id');
  const fmtMap = { '360p': 2, '720p': 4, '1080p': 5 };
  const fmt = fmtMap[q] || 2;
  try {
    const url = await resolveStreamUrl(videoId, fmt);
    return res.type('text').send(url);
  } catch (e) {
    // 最終フォールバック: Invidious latest_version
    const fb = await resolveInvidiousStream(videoId, q);
    if (fb) return res.type('text').send(fb);
    return res.status(502).type('text').send('stream unavailable');
  }
});

// 旧互換: /stream/:videoId (デフォルト 360p, 元コードの形式を保持)
const videoCache = new Map();
app.get('/stream/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return res.status(400).type('text').send('bad id');
  const now = Date.now();
  const cached = videoCache.get(videoId);
  if (cached && cached.expiry > now) return res.type('text').send(cached.url);
  try {
    const url = await resolveStreamUrl(videoId, 2);
    videoCache.set(videoId, { url, expiry: now + 60000 });
    res.type('text').send(url);
  } catch (e) {
    res.status(500).send('Internal Server Error');
  }
});

// /scratch-edu/:id (元コードの placeholder を維持)
app.get('/scratch-edu/:id', (req, res) => {
  res.type('text').send(req.params.id);
});

// ---- /api/v1/comments/:id (Invidious プロキシ) ----
app.get('/api/v1/comments/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const continuation = req.query.continuation;
  const sort = req.query.sort_by || 'top';
  const qs = new URLSearchParams({ sort_by: sort });
  if (continuation) qs.set('continuation', continuation);
  try {
    const { data } = await invidiousApi(`/api/v1/comments/${id}?${qs.toString()}`, {
      preferInstance: preferredBackend(req),
      timeout: 10000,
    });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'comments_unavailable', detail: e.message });
  }
});

// ---- /api/v1/videos/:id, /api/v1/channels/:id, etc (透過プロキシ) ----
const PROXY_PATHS = [
  '/api/v1/videos/:id',
  '/api/v1/channels/:id',
  '/api/v1/channels/:id/videos',
  '/api/v1/channels/:id/shorts',
  '/api/v1/channels/:id/streams',
  '/api/v1/channels/:id/playlists',
  '/api/v1/channels/:id/community',
  '/api/v1/playlists/:plid',
  '/api/v1/mixes/:rdid',
  '/api/v1/trending',
  '/api/v1/stats',
  '/api/v1/captions/:id',
];
PROXY_PATHS.forEach(p => {
  app.get(p, async (req, res) => {
    const rest = req.originalUrl;
    try {
      const { data } = await invidiousApi(rest, {
        preferInstance: preferredBackend(req),
        timeout: 10000,
      });
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: 'upstream_unavailable', detail: e.message });
    }
  });
});

// ==========================================
// "本物に見せる" 静的アセットの透過プロキシ
//   /videojs/*  -> jsdelivr CDN
//   /css/*      -> インライン or CDN
//   /ggpht/*    -> YouTube 画像プロキシ
// ==========================================

const CDN_BASE = 'https://cdn.jsdelivr.net/npm';
const VJS_MAP = {
  'video.js/video.js':                              `${CDN_BASE}/video.js@8/dist/video.min.js`,
  'video.js/video-js.css':                          `${CDN_BASE}/video.js@8/dist/video-js.min.css`,
  'videojs-mobile-ui/videojs-mobile-ui.js':         `${CDN_BASE}/videojs-mobile-ui/dist/videojs-mobile-ui.min.js`,
  'videojs-mobile-ui/videojs-mobile-ui.css':        `${CDN_BASE}/videojs-mobile-ui/dist/videojs-mobile-ui.css`,
  'videojs-contrib-quality-levels/videojs-contrib-quality-levels.js':
                                                    `${CDN_BASE}/videojs-contrib-quality-levels@4/dist/videojs-contrib-quality-levels.min.js`,
  'videojs-http-source-selector/videojs-http-source-selector.js':
                                                    `${CDN_BASE}/videojs-http-source-selector/dist/videojs-http-source-selector.min.js`,
  'videojs-http-source-selector/videojs-http-source-selector.css':
                                                    `${CDN_BASE}/videojs-http-source-selector/dist/videojs-http-source-selector.css`,
  'videojs-markers/videojs-markers.js':             `${CDN_BASE}/videojs-markers/dist/videojs-markers.min.js`,
  'videojs-markers/videojs.markers.css':            `${CDN_BASE}/videojs-markers/dist/videojs.markers.min.css`,
  'videojs-share/videojs-share.js':                 `${CDN_BASE}/videojs-share/dist/videojs-share.js`,
  'videojs-share/videojs-share.css':                `${CDN_BASE}/videojs-share/dist/videojs-share.css`,
  'videojs-vtt-thumbnails/videojs-vtt-thumbnails.js':
                                                    `${CDN_BASE}/videojs-vtt-thumbnails-freetube/dist/videojs-vtt-thumbnails.js`,
  'videojs-vtt-thumbnails/videojs-vtt-thumbnails.css':
                                                    `${CDN_BASE}/videojs-vtt-thumbnails-freetube/dist/videojs-vtt-thumbnails.css`,
};

// シンプルなインメモリ静的キャッシュ
const _assetCache = new Map(); // key -> { ct, body, exp }
const ASSET_TTL = 6 * 3600 * 1000;

async function _serveAsset(req, res, cdnUrl) {
  const now = Date.now();
  const c = _assetCache.get(cdnUrl);
  if (c && c.exp > now) {
    res.setHeader('Content-Type', c.ct);
    res.setHeader('Cache-Control', 'public, max-age=21600');
    return res.send(c.body);
  }
  try {
    const r = await fetch(cdnUrl, { headers: { 'User-Agent': getUA() }, dispatcher: AGENT });
    if (!r.ok) return res.status(502).send('upstream error');
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await r.arrayBuffer());
    _assetCache.set(cdnUrl, { ct, body: buf, exp: now + ASSET_TTL });
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=21600');
    res.send(buf);
  } catch (e) {
    res.status(502).send('upstream error');
  }
}

app.get('/videojs/*', async (req, res) => {
  const sub = req.params[0]; // e.g. "video.js/video.js"
  const cdnUrl = VJS_MAP[sub];
  if (!cdnUrl) return res.status(404).send('not found');
  return _serveAsset(req, res, cdnUrl);
});

app.get('/css/default.css', (req, res) => {
  res.type('text/css').setHeader('Cache-Control', 'public, max-age=21600').send(`/* Invidious default theme (proxied) */`);
});
app.get('/css/player.css', (req, res) => {
  res.type('text/css').setHeader('Cache-Control', 'public, max-age=21600').send(`
/* Invidious player tweaks */
.video-js .vjs-big-play-button { background-color: rgba(0,0,0,.6); border-radius: 50%; }
.video-js { font-family: inherit; }
`);
});

// チャンネルアバター透過プロキシ
app.get('/ggpht/*', async (req, res) => {
  // 任意のサブパスは "default" 画像にフォールバック
  const fallback = 'https://www.gstatic.com/youtube/img/promos/youtube_red_logo.svg';
  try {
    let target = decodeURIComponent(req.params[0] || '');
    // 完全 URL ではない場合は YouTube の avatar フォーマットを試す
    if (!/^https?:\/\//.test(target)) {
      target = `https://yt3.ggpht.com/${target}`;
    }
    const r = await fetch(target, { headers: { 'User-Agent': getUA() }, dispatcher: AGENT });
    if (!r.ok) {
      // フォールバック
      const fb = await fetch(fallback, { headers: { 'User-Agent': getUA() }, dispatcher: AGENT });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(Buffer.from(await fb.arrayBuffer()));
    }
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.status(404).end();
  }
});

// favicon: 1x1 transparent gif
app.get('/favicon.ico', (req, res) => {
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'public, max-age=2592000');
  res.send(gif);
});

// 健康確認
app.get('/health', (req, res) => res.json({ ok: true, version: VERSION }));

// 404
app.use((req, res) => {
  res.status(404).send(renderErrorPage(`404 - ${req.path} は見つかりません`));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`INVIDIOUS-MINI v${VERSION} on port ${PORT}`));
