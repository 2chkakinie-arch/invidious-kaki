/* ============================================================================
 *  CroxyProxy URL Generator API   (Vercel / Node 18+ / Pure built-ins)
 *
 *  使い方:
 *    GET /croxy/<URL>
 *      
 * 
 *
 *  返却(JSON):
 *    {
 *      "target": "https://example.com",
 *      "generated_at": "...",
 *      "count": 3,
 *      "proxies": [
 *        {
 *          "server_ip"   : "151.115.90.222",
 *          "proxy_url"   : "https://151.115.90.222/__cpi.php?s=...&r=...&__cpo=1",
 *          "fallback_url": "https://151.115.90.222?__cpo=aHR0cHM6Ly9leGFtcGxlLmNvbQ"
 *        },
 *        ...
 *      ]
 *    }
 *
 *  プロキシIPを増やすには  PROXY_SERVERS  配列に追記するだけ。
 * ==========================================================================*/

'use strict';

const https   = require('https');
const http    = require('http');
const { URL } = require('url');

const PROXY_SERVERS = [
  '151.115.90.222',
  '51.38.135.193',
  '51.38.132.99',
  '51.158.204.41',
  '195.3.223.166,
  '185.16.39.144'
];

/* ─────────────────────────────────────────────────────────────────────────
 *  CroxyProxy のメインサイト
 * ─────────────────────────────────────────────────────────────────────── */
const CROXY_HOST   = 'www.croxyproxy.com';
const CROXY_ORIGIN = 'https://' + CROXY_HOST;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/* ===========================================================================
 *  低レベル: Cookie を維持しながら HTTPS リクエストを送るヘルパ
 * =========================================================================*/
function httpsRequest(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opt = {
      method,
      hostname: u.hostname,
      port:     u.port || 443,
      path:     u.pathname + (u.search || ''),
      headers:  { 'User-Agent': UA, ...headers },
      // ↓ プロキシIP直接アクセスの保険(自己署名証明書対策)
      rejectUnauthorized: false,
    };
    if (body) opt.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(opt, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => {
        resolve({
          status:  res.statusCode,
          headers: res.headers,
          body:    Buffer.concat(chunks).toString('utf-8'),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(20_000, () => req.destroy(new Error('Request timeout')));
    if (body) req.write(body);
    req.end();
  });
}

/** Set-Cookie ヘッダ → "k=v; k2=v2" 形式 */
function buildCookieHeader(setCookieArr = []) {
  return setCookieArr
    .map((s) => s.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/** 既存Cookie文字列に新しいSet-Cookieをマージ */
function mergeCookies(existing, setCookieArr = []) {
  const jar = new Map();
  (existing || '').split(';').map((s) => s.trim()).filter(Boolean).forEach((kv) => {
    const i = kv.indexOf('=');
    if (i > 0) jar.set(kv.slice(0, i), kv.slice(i + 1));
  });
  (setCookieArr || []).forEach((line) => {
    const first = line.split(';')[0];
    const i = first.indexOf('=');
    if (i > 0) jar.set(first.slice(0, i).trim(), first.slice(i + 1).trim());
  });
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

/* ===========================================================================
 *  CroxyProxy にリクエストして 1 サーバー分の {s, r} を取得する
 *
 *  〜なぜサーバーリクエストが必要か〜
 *    s パラメータは CroxyProxy のメインサイトが HTML 内
 *    <input name="csrf" value="..."> として埋め込んでくる
 *    サーバー側暗号化トークン (AES/独自) であり、
 *    クライアント側で再生成することはできない。
 *    そのため、毎回:
 *       (1) GET /        → csrf を取得 (Cookieも保存)
 *       (2) POST /servers → このcsrf がそのまま s として再利用される
 *    という公式と同一のフローを踏む。
 * =========================================================================*/
async function fetchCsrfAndCookies() {
  const res = await httpsRequest('GET', CROXY_ORIGIN + '/', {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  });

  if (res.status !== 200) {
    throw new Error(`Croxy main page returned ${res.status}`);
  }
  const m = res.body.match(/name="csrf"[^>]*value="([^"]+)"/);
  if (!m) throw new Error('csrf token not found on Croxy main page');

  const cookie = buildCookieHeader(res.headers['set-cookie'] || []);
  return { csrf: m[1], cookie };
}

/* ===========================================================================
 *  r パラメータの生成
 *      r = base64( "https://<proxy_ip>?__cpo=" + base64(target_url) )
 *
 *  これは CroxyProxy 内部のリダイレクト用フィールドで、
 *  仕様としてはサイト全体で共通(クライアント側でそのまま再現可)。
 * =========================================================================*/
function buildRParam(proxyIp, targetUrl) {
  const inner = Buffer.from(targetUrl, 'utf-8')
                  .toString('base64')
                  .replace(/=+$/, '');                 // 例:  base64("https://example.com")
  const full  = `https://${proxyIp}?__cpo=${inner}`;
  return Buffer.from(full, 'utf-8').toString('base64'); // r パラメータ
}

/* ===========================================================================
 *  /servers に POST して、CroxyProxy が選んだサーバー分の
 *  正規 s パラメータを取り出す
 * =========================================================================*/
async function postToServers(targetUrl, csrf, cookie) {
  const body = new URLSearchParams({ url: targetUrl, csrf }).toString();

  const res = await httpsRequest(
    'POST',
    CROXY_ORIGIN + '/servers',
    {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer:        CROXY_ORIGIN + '/',
      Origin:         CROXY_ORIGIN,
      Cookie:         cookie,
    },
    body
  );

  return res; // status / body / headers
}

/* ===========================================================================
 *  POST レスポンスから s パラメータ (=暗号化トークン) を取り出す
 *
 *  Croxy は launching ページ HTML 内の data-* 属性 や JSON、
 *  あるいは form input として s に相当する文字列を埋め込んでくる。
 *  以下の優先順で探索する:
 *    1) input[name=s] value
 *    2) data-script-config / scriptConfig JSON
 *    3) HTML 全体に対する base64 風長文字列のうち、最初の csrf と
 *       先頭一致 (= 同シリーズ) のもの
 *    4) どれも無ければ、csrf をそのまま s として再利用 (Croxy仕様上 OK)
 * =========================================================================*/
function extractSToken(launchHtml, csrfFallback) {
  // 1) hidden input
  let m = launchHtml.match(/name="s"[^>]*value="([^"]+)"/);
  if (m) return m[1];

  // 2) scriptConfig / data-script-config JSON
  m = launchHtml.match(/data-script-config="([^"]+)"/);
  if (m) {
    try {
      const decoded = m[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g,  '&');
      const j = JSON.parse(decoded);
      if (j && (j.s || j.csrf || j.token)) return j.s || j.csrf || j.token;
    } catch (_) { /* ignore */ }
  }

  // 3) HTML 中の長い base64 文字列を全部拾い、csrf と接頭辞が一致するもの優先
  const prefix = csrfFallback.slice(0, 24);
  const longB64 = launchHtml.match(/[A-Za-z0-9+/]{200,}={0,2}/g) || [];
  const sameSeries = longB64.find((tok) => tok.startsWith(prefix));
  if (sameSeries) return sameSeries;

  // 4) 最後の手段: csrf 自身を s として返す
  return csrfFallback;
}

/* ===========================================================================
 *  ターゲットURLを正規化
 * =========================================================================*/
function normalizeUrl(input) {
  if (!input) return null;
  let u = String(input).trim();
  // 先頭スラッシュやエンコード除去
  while (u.startsWith('/')) u = u.slice(1);
  try { u = decodeURIComponent(u); } catch (_) { /* ignore */ }
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).toString(); } catch (_) { return null; }
}

/* ===========================================================================
 *  メイン: 全プロキシ分のURLを構築
 * =========================================================================*/
async function generateProxyUrls(targetUrl) {
  const { csrf, cookie } = await fetchCsrfAndCookies();

  const post = await postToServers(targetUrl, csrf, cookie);
  // launching HTML が返るのが正常。404/500 でも csrf を s として使えるので継続。
  const sToken = extractSToken(post.body || '', csrf);

  const proxies = PROXY_SERVERS.map((ip) => {
    const r = buildRParam(ip, targetUrl);
    return {
      server_ip:   ip,
      proxy_url:
        `https://${ip}/__cpi.php` +
        `?s=${encodeURIComponent(sToken)}` +
        `&r=${encodeURIComponent(r)}` +
        `&__cpo=1`,
      // s 無しでも動く保険ルート (__cpo だけのリダイレクト)
      fallback_url:
        `https://${ip}?__cpo=` +
        Buffer.from(targetUrl, 'utf-8').toString('base64').replace(/=+$/, ''),
    };
  });

  return {
    target:       targetUrl,
    generated_at: new Date().toISOString(),
    count:        proxies.length,
    proxies,
  };
}

/* ===========================================================================
 *  自分自身で生成 URL の到達性を検証(オプション)
 *    /croxy/<URL>?verify=1 を付けると HEAD で疎通確認して結果を埋め込む
 * =========================================================================*/
function headCheck(urlStr) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const lib = u.protocol === 'http:' ? http : https;
      const req = lib.request(
        {
          method: 'HEAD',
          hostname: u.hostname,
          port: u.port || (u.protocol === 'http:' ? 80 : 443),
          path: u.pathname + (u.search || ''),
          headers: { 'User-Agent': UA },
          rejectUnauthorized: false,
        },
        (res) => {
          resolve({ status: res.statusCode, location: res.headers.location || null });
        }
      );
      req.on('error', (e) => resolve({ status: 0, error: e.message }));
      req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
      req.end();
    } catch (e) {
      resolve({ status: 0, error: e.message });
    }
  });
}

/* ===========================================================================
 *  Vercel / Node の HTTP ハンドラ
 * =========================================================================*/
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const fullUrl  = new URL(req.url, 'http://localhost');
  const pathname = fullUrl.pathname;

  // ── Health / index ────────────────────────────────────────────────
  if (pathname === '/' || pathname === '/health') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      name:    'CroxyProxy URL Generator',
      usage:   'GET /croxy/<target_url>',
      example: '/croxy/https://example.com',
      proxy_servers: PROXY_SERVERS,
    }, null, 2));
  }

  // ── /croxy/<URL> ──────────────────────────────────────────────────
  if (pathname.startsWith('/croxy/')) {
    const raw     = pathname.slice('/croxy/'.length) + (fullUrl.search || '');
    const target  = normalizeUrl(raw.split('?verify=')[0]);
    const verify  = fullUrl.searchParams.get('verify') === '1';

    if (!target) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: 'invalid target URL' }));
    }

    try {
      const data = await generateProxyUrls(target);

      if (verify) {
        await Promise.all(
          data.proxies.map(async (p) => { p.check = await headCheck(p.proxy_url); })
        );
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify(data, null, 2));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        error:   'failed to generate proxy URL',
        message: err.message,
      }));
    }
  }

  // ── default 404 ───────────────────────────────────────────────────
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify({ error: 'not found', try: '/croxy/https://example.com' }));
};

/* ===========================================================================
 *  ローカル単独起動 (node index.js)
 * =========================================================================*/
if (require.main === module) {
  const port = process.env.PORT || 3000;
  http.createServer(module.exports).listen(port, () => {
    console.log(`CroxyProxy API listening on http://localhost:${port}`);
    console.log(`Try: http://localhost:${port}/croxy/https://example.com`);
  });
}
