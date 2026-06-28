#!/usr/bin/env node
/**
 * itemmania.com 로컬 크롤러
 *
 * 사용법:
 *   node crawl-itemmania.mjs --api-url https://your-app.replit.app --admin-email admin@example.com --admin-pw yourpw
 *
 * 옵션:
 *   --api-url        우리 서버 URL (필수)
 *   --admin-email    어드민 이메일 (자동 로그인용)
 *   --admin-pw       어드민 비밀번호
 *   --games          게임 slug 목록, 쉼표 구분 (기본: 전체)
 *                    lostark, maplestory, dnf, lineage-classic, aion2, mabinogi, geosang
 *   --pages          페이지 수 (기본: 1, 최대: 10)
 *   --with-detail    상세 페이지까지 크롤 (판매자명·설명·이미지 수집)
 *   --batch-size     한 번에 업로드할 상품 수 (기본: 50)
 *
 * 예시:
 *   node crawl-itemmania.mjs \
 *     --api-url https://myapp.replit.app \
 *     --admin-email admin@example.com \
 *     --admin-pw mypassword \
 *     --games lostark,maplestory,dnf \
 *     --pages 3 \
 *     --with-detail
 */

import { JSDOM } from 'jsdom';
import https from 'https';
import zlib from 'zlib';

const GAMES = {
  lostark:              { id: 2696, name: '로스트아크' },
  maplestory:           { id: 138,  name: '메이플스토리' },
  'maplestory-world':   { id: 5233, name: '메이플스토리월드' },
  dnf:                  { id: 281,  name: '던전앤파이터' },
  'lineage-classic':    { id: 5913, name: '리니지클래식' },
  aion2:                { id: 5799, name: '아이온2' },
  mabinogi:             { id: 155,  name: '마비노기' },
  geosang:              { id: 101,  name: '거상' },
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

let SESSION_COOKIES = '';

const HTTPS_AGENT = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

function httpsGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      agent: HTTPS_AGENT,
      timeout: 25000,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Referer': 'https://www.itemmania.com/',
        ...(SESSION_COOKIES ? { 'Cookie': SESSION_COOKIES } : {}),
        ...extraHeaders,
      },
    };
    const req = https.request(options, (res) => {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        const cookies = setCookie.map(c => c.split(';')[0]).join('; ');
        if (cookies) SESSION_COOKIES = cookies;
      }
      if (res.statusCode >= 301 && res.statusCode <= 302 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://www.itemmania.com${res.headers.location}`;
        res.resume();
        resolve(httpsGet(loc, extraHeaders));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const enc = res.headers['content-encoding'] || '';
      let stream = res;
      if (enc === 'gzip')   stream = res.pipe(zlib.createGunzip());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      const chunks = [];
      stream.on('data', d => chunks.push(d));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

async function initSession() {
  try {
    await httpsGet('https://www.itemmania.com/');
  } catch {
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    apiUrl: '',
    adminEmail: '',
    adminPw: '',
    games: Object.keys(GAMES),
    pages: 1,
    withDetail: false,
    batchSize: 50,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-url')       opts.apiUrl = args[++i];
    else if (args[i] === '--admin-email') opts.adminEmail = args[++i];
    else if (args[i] === '--admin-pw')    opts.adminPw = args[++i];
    else if (args[i] === '--games')       opts.games = args[++i].split(',').map(s => s.trim());
    else if (args[i] === '--pages')       opts.pages = Math.min(parseInt(args[++i]) || 1, 10);
    else if (args[i] === '--with-detail') opts.withDetail = true;
    else if (args[i] === '--batch-size')  opts.batchSize = parseInt(args[++i]) || 50;
  }
  return opts;
}

async function adminLogin(apiUrl, email, pw) {
  const r = await fetch(`${apiUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
    signal: AbortSignal.timeout(10000),
    redirect: 'manual',
  });
  const setCookie = r.headers.get('set-cookie') || '';
  const match = setCookie.match(/(connect\.sid=[^;]+)/);
  if (!match) throw new Error('로그인 실패: 세션 쿠키를 받지 못했습니다.');
  return match[1];
}

async function fetchListHtml(gameId, page) {
  const url = `https://www.itemmania.com/sell/list.html?search_game=${gameId}&search_goods=all&page=${page}`;
  return httpsGet(url);
}

async function fetchDetailHtml(tid) {
  const url = `https://www.itemmania.com/sell/application.html?id=${tid}`;
  try {
    return await httpsGet(url);
  } catch {
    return null;
  }
}

function parseListProducts(html, gameId, gameName) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const items = doc.querySelectorAll('li.list_item');
  const products = [];
  for (const el of items) {
    const tid = el.getAttribute('data-tid');
    if (!tid) continue;
    const gameSel = el.querySelector('[data-search=game]');
    const serverSel = el.querySelector('[data-search=server]');
    const categoryEl = el.querySelector('[data-search=goods]');
    const titleEl = el.querySelector('.kind_title');
    const priceEl = el.querySelector('.trade_money');
    const title = titleEl?.textContent?.trim() || '';
    if (!title) continue;
    const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') || '0';
    products.push({
      itemmaniaid: tid,
      title,
      price: parseInt(priceText) || 0,
      gameName: gameSel?.textContent?.trim() || gameName,
      serverName: serverSel?.getAttribute('data-title') || serverSel?.textContent?.trim() || '',
      category: 'sell',
      itemCategory: categoryEl?.textContent?.trim() || '',
      detailUrl: `https://www.itemmania.com/sell/application.html?id=${tid}`,
    });
  }
  return products;
}

function parseDetailData(html) {
  let description = null;
  let thumbnailUrl = null;
  let sellerName = null;

  const ldBlocks = html.match(/<script type=application\/ld\+json>([\s\S]*?)<\/script>/g) || [];
  for (const block of ldBlocks) {
    try {
      const inner = block
        .replace(/<script type=application\/ld\+json>/, '')
        .replace(/<\/script>/, '');
      const data = JSON.parse(inner);
      const graph = data['@graph'];
      if (!Array.isArray(graph)) continue;
      const product = graph.find(n => n['@type'] === 'Product');
      if (!product) continue;
      if (typeof product['description'] === 'string') {
        description = product['description'].trim() || null;
      }
      const img = typeof product['image'] === 'string' ? product['image'] : null;
      if (img && !img.includes('/common/') && !img.includes('og_')) {
        thumbnailUrl = img;
      }
      break;
    } catch {
      // ignore
    }
  }

  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const nickEl = doc.querySelector('.user_nick')
    || doc.querySelector('.user_info strong:not(.vip_txt)');
  sellerName = nickEl?.textContent?.trim() || null;

  return { description, thumbnailUrl, sellerName };
}

async function uploadBatch(products, apiUrl, cookie) {
  const r = await fetch(`${apiUrl}/api/admin/crawl/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({ products }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`업로드 실패: HTTP ${r.status}`);
  return r.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const opts = parseArgs();

  if (!opts.apiUrl) {
    console.error('오류: --api-url 이 필요합니다. (예: --api-url https://myapp.replit.app)');
    process.exit(1);
  }
  if (!opts.adminEmail || !opts.adminPw) {
    console.error('오류: --admin-email 과 --admin-pw 가 필요합니다.');
    process.exit(1);
  }

  const targetGames = opts.games
    .map(s => ({ slug: s, ...GAMES[s] }))
    .filter(g => g.id);

  if (targetGames.length === 0) {
    console.error('오류: 유효한 게임 slug를 선택하세요.');
    console.error('사용 가능:', Object.keys(GAMES).join(', '));
    process.exit(1);
  }

  console.log('🕷️  itemmania.com 로컬 크롤러');
  console.log(`   서버: ${opts.apiUrl}`);
  console.log(`   게임: ${targetGames.map(g => g.name).join(', ')}`);
  console.log(`   페이지: ${opts.pages}`);
  console.log(`   상세 크롤: ${opts.withDetail ? '포함' : '미포함'}`);
  console.log('');

  process.stdout.write('🌐 itemmania.com 세션 초기화 중...');
  await initSession();
  console.log(' 완료');

  process.stdout.write('🔑 어드민 로그인 중...');
  let cookie;
  try {
    cookie = await adminLogin(opts.apiUrl, opts.adminEmail, opts.adminPw);
    console.log(' 완료');
  } catch (e) {
    console.error('\n오류:', e.message);
    process.exit(1);
  }

  let totalSaved = 0;
  let totalFail = 0;
  let detailOk = 0;
  let detailFail = 0;

  for (const game of targetGames) {
    console.log(`\n[${game.name}]`);
    for (let page = 1; page <= opts.pages; page++) {
      process.stdout.write(`  ${page}페이지 목록 크롤링...`);
      let products;
      try {
        const html = await fetchListHtml(game.id, page);
        products = parseListProducts(html, game.id, game.name);
        process.stdout.write(` ${products.length}개 파싱`);
      } catch (e) {
        console.log(` 실패: ${e.message}`);
        totalFail++;
        continue;
      }

      if (products.length === 0) {
        console.log(' → 상품 없음');
        continue;
      }

      if (opts.withDetail) {
        process.stdout.write(`\n    상세 크롤링 중`);
        for (let i = 0; i < products.length; i++) {
          const p = products[i];
          try {
            const dhtml = await fetchDetailHtml(p.itemmaniaid);
            if (dhtml) {
              const detail = parseDetailData(dhtml);
              if (detail.description)  p.description  = detail.description;
              if (detail.thumbnailUrl) p.thumbnailUrl = detail.thumbnailUrl;
              if (detail.sellerName)   p.sellerName   = detail.sellerName;
              detailOk++;
            } else {
              detailFail++;
            }
          } catch {
            detailFail++;
          }
          if (i % 10 === 9) process.stdout.write('.');
          await sleep(300);
        }
        console.log(` 완료 (성공 ${detailOk}개)`);
        process.stdout.write(`    DB 저장 중...`);
      } else {
        process.stdout.write(' → 저장 중...');
      }

      try {
        const result = await uploadBatch(products, opts.apiUrl, cookie);
        console.log(` ${result.upserted}개 저장, ${result.failed}개 실패`);
        totalSaved += result.upserted;
        totalFail  += result.failed;
      } catch (e) {
        console.log(` 업로드 실패: ${e.message}`);
        totalFail += products.length;
      }

      if (page < opts.pages) await sleep(600);
    }
  }

  console.log('');
  console.log('━'.repeat(40));
  console.log(`✅ 완료`);
  console.log(`   상품 저장: ${totalSaved}개 성공, ${totalFail}개 실패`);
  if (opts.withDetail) {
    console.log(`   상세 크롤: ${detailOk}개 성공, ${detailFail}개 실패`);
  }
}

main().catch(e => {
  console.error('\n오류:', e.message);
  process.exit(1);
});
