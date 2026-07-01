#!/usr/bin/env node
/**
 * 아이템마니아 자동 상품 수집기
 *
 * ─────────────────────────────────────
 * 1. 아래 설정 3줄만 채우세요
 * 2. 터미널에서: node auto-crawl.mjs
 * 3. 창 닫지 말고 켜두면 1시간마다 자동 수집
 * ─────────────────────────────────────
 */

// ★ 여기만 수정하세요 ★
const API_URL     = 'https://itenmania.com';   // 우리 사이트 주소
const ADMIN_EMAIL = 'admin@example.com';        // 관리자 이메일
const ADMIN_PW    = 'yourpassword';             // 관리자 비밀번호

// 수집할 게임 목록 (전부 원하면 그대로 두세요)
const GAMES = [
  { slug: 'maplestory-world',  id: 5233, name: '메이플스토리월드' },
  { slug: 'lostark',           id: 2696, name: '로스트아크' },
  { slug: 'lineage-classic',   id: 5913, name: '리니지클래식' },
  { slug: 'maplestory',        id: 8458, name: '메이플스토리' },
  { slug: 'odin',              id: 4696, name: '오딘' },
  { slug: 'mabinogi',          id: 155,  name: '마비노기' },
  { slug: 'lineage-m',         id: 3449, name: '리니지M' },
  { slug: 'geosang',           id: 101,  name: '거상' },
  { slug: 'aion2',             id: 5799, name: '아이온2' },
  { slug: 'dnf',               id: 281,  name: '던전앤파이터' },
];

// 1회 실행 시 게임당 가져올 페이지 수 (1페이지 = 약 50개)
const PAGES_PER_GAME = 3;

// 수집 주기 (밀리초) — 기본 1시간
const INTERVAL_MS = 60 * 60 * 1000;

// ──────────────────────────────────────
// 이하 수정 불필요
// ──────────────────────────────────────

import https from 'https';
import { JSDOM } from 'jsdom';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function now() {
  return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

async function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent: HTTPS_AGENT,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.itemmania.com/',
      },
      timeout: 20000,
    }, (res) => {
      let body = res;
      if (res.headers['content-encoding'] === 'gzip') {
        const { createGunzip } = await import('zlib');
        body = res.pipe(createGunzip());
      }
      const chunks = [];
      body.on('data', d => chunks.push(d));
      body.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      body.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

async function adminLogin() {
  const res = await fetch(`${API_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PW }),
    signal: AbortSignal.timeout(10000),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/(connect\.sid=[^;]+)/);
  if (!match) throw new Error('로그인 실패 — 이메일/비밀번호를 확인하세요');
  return match[1];
}

function parseProducts(html, gameId, gameName) {
  const doc = new JSDOM(html).window.document;
  const products = [];
  for (const el of doc.querySelectorAll('li.list_item')) {
    const tid = el.getAttribute('data-tid');
    if (!tid) continue;
    const title   = el.querySelector('.goods_name, [data-search=name], .name')?.textContent?.trim() || '';
    const priceRaw = el.querySelector('.goods_price, .price, [data-search=price]')?.textContent?.replace(/[^0-9]/g,'') || '0';
    const server  = el.querySelector('[data-search=server]')?.textContent?.trim() || '';
    const cat     = el.querySelector('[data-search=goods]')?.textContent?.trim()  || '';
    const img     = el.querySelector('img')?.src || '';
    const grade   = el.classList.contains('vip') ? 'vip'
                  : el.classList.contains('platinum') ? 'platinum' : null;
    if (!title) continue;
    products.push({
      itemmaniaid: tid, gameId, gameName,
      title, price: parseInt(priceRaw, 10) || 0,
      server, itemCategory: cat,
      thumbnailUrl: img.startsWith('http') ? img : null,
      sellerGrade: grade,
    });
  }
  return products;
}

async function uploadBatch(products, cookie) {
  const res = await fetch(`${API_URL}/api/admin/crawl/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ products }),
    signal: AbortSignal.timeout(30000),
  });
  return res.json();
}

async function runOnce() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🕷️  수집 시작: ${now()}`);
  console.log('='.repeat(50));

  let cookie;
  try {
    process.stdout.write('🔑 로그인 중...');
    cookie = await adminLogin();
    console.log(' ✅');
  } catch (e) {
    console.log(` ❌ ${e.message}`);
    return;
  }

  let totalSaved = 0;

  for (const game of GAMES) {
    console.log(`\n📦 [${game.name}]`);
    for (let page = 1; page <= PAGES_PER_GAME; page++) {
      process.stdout.write(`   ${page}페이지 수집 중...`);
      try {
        const html = await httpsGet(
          `https://www.itemmania.com/sell/list.html?search_game=${game.id}&search_goods=all&page=${page}`
        );
        const products = parseProducts(html, game.id, game.name);
        if (products.length === 0) { console.log(' 상품 없음'); break; }
        const result = await uploadBatch(products, cookie);
        const saved = result.upserted ?? 0;
        totalSaved += saved;
        console.log(` ${saved}개 저장 (누적: ${totalSaved}개)`);
      } catch (e) {
        console.log(` ❌ ${e.message}`);
      }
      if (page < PAGES_PER_GAME) await sleep(800);
    }
    await sleep(1000);
  }

  console.log(`\n✅ 이번 수집 완료 — 총 ${totalSaved}개 저장`);
  console.log(`⏰ 다음 수집: ${new Date(Date.now() + INTERVAL_MS).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
}

async function main() {
  console.log('🚀 자동 상품 수집기 시작');
  console.log(`   서버: ${API_URL}`);
  console.log(`   게임 수: ${GAMES.length}개`);
  console.log(`   게임당 페이지: ${PAGES_PER_GAME}페이지 (약 ${PAGES_PER_GAME * 50}개)`);
  console.log(`   수집 주기: 1시간`);
  console.log('\n⚠️  이 창을 닫으면 수집이 멈춥니다. 켜두세요!');

  while (true) {
    await runOnce();
    console.log(`\n💤 1시간 대기 중... (창 닫지 마세요)`);
    await sleep(INTERVAL_MS);
  }
}

main().catch(e => {
  console.error('\n❌ 오류:', e.message);
  process.exit(1);
});
