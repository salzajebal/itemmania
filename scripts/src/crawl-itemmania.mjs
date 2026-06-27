#!/usr/bin/env node
/**
 * itemmania.com 로컬 크롤러
 * 
 * 사용법:
 *   node crawl-itemmania.mjs --api-url https://your-app.replit.app --session-cookie "connect.sid=..."
 * 
 * 옵션:
 *   --api-url       우리 서버 URL (기본: http://localhost:80)
 *   --games         크롤링할 게임 slug 목록, 쉼표 구분 (기본: 전체)
 *                   lostark, maplestory, dnf, lineage-classic, aion2, mabinogi, geosang
 *   --pages         페이지 수 (기본: 1, 최대: 10)
 *   --session-cookie 어드민 세션 쿠키 (예: "connect.sid=s%3Axxx...")
 *   --scraper-key   ScraperAPI 키 (있으면 API를 통해 서버에서 크롤링, 없으면 로컬 직접 크롤링)
 * 
 * 예시:
 *   node crawl-itemmania.mjs --api-url https://myapp.replit.app --games lostark,maplestory --pages 2
 */

import { createRequire } from 'module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);

const GAMES = {
  lostark:        { id: 2696, name: '로스트아크' },
  maplestory:     { id: 138,  name: '메이플스토리' },
  dnf:            { id: 281,  name: '던전앤파이터' },
  'lineage-classic': { id: 5913, name: '리니지 클래식' },
  aion2:          { id: 5799, name: '아이온2' },
  mabinogi:       { id: 155,  name: '마비노기' },
  geosang:        { id: 101,  name: '거상' },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    apiUrl: 'http://localhost:80',
    games: Object.keys(GAMES),
    pages: 1,
    sessionCookie: '',
    scraperKey: '',
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-url') opts.apiUrl = args[++i];
    else if (args[i] === '--games') opts.games = args[++i].split(',').map(s => s.trim());
    else if (args[i] === '--pages') opts.pages = Math.min(parseInt(args[++i]) || 1, 10);
    else if (args[i] === '--session-cookie') opts.sessionCookie = args[++i];
    else if (args[i] === '--scraper-key') opts.scraperKey = args[++i];
  }
  return opts;
}

async function fetchHtml(gameId, page, scraperKey) {
  const targetUrl = `https://www.itemmania.com/sell/list.html?search_game=${gameId}&search_goods=all&page=${page}`;
  const url = scraperKey
    ? `https://api.scraperapi.com/?api_key=${scraperKey}&url=${encodeURIComponent(targetUrl)}`
    : targetUrl;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

function parseProducts(html, gameId, gameName) {
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
      detailUrl: `https://www.itemmania.com/sell/view.html?no=${tid}`,
    });
  }
  return products;
}

async function uploadProducts(products, apiUrl, sessionCookie) {
  let ok = 0, fail = 0;
  for (const p of products) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionCookie) headers['Cookie'] = sessionCookie;
      const r = await fetch(`${apiUrl}/api/admin/products`, {
        method: 'POST',
        headers,
        body: JSON.stringify(p),
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) ok++;
      else fail++;
    } catch {
      fail++;
    }
  }
  return { ok, fail };
}

async function main() {
  const opts = parseArgs();
  console.log('🕷️  itemmania.com 로컬 크롤러 시작');
  console.log(`   서버: ${opts.apiUrl}`);
  console.log(`   게임: ${opts.games.join(', ')}`);
  console.log(`   페이지: ${opts.pages}`);
  if (opts.scraperKey) console.log('   ScraperAPI 키: 사용');
  console.log('');

  const targetGames = opts.games
    .map(s => ({ slug: s, ...GAMES[s] }))
    .filter(g => g.id);

  if (targetGames.length === 0) {
    console.error('오류: 유효한 게임을 선택하세요.');
    process.exit(1);
  }

  let totalSaved = 0;
  let totalFail = 0;

  for (const game of targetGames) {
    for (let page = 1; page <= opts.pages; page++) {
      process.stdout.write(`  [${game.name}] ${page}페이지 크롤링 중...`);
      try {
        const html = await fetchHtml(game.id, page, opts.scraperKey);
        const products = parseProducts(html, game.id, game.name);
        process.stdout.write(` ${products.length}개 파싱됨`);
        if (products.length > 0) {
          const { ok, fail } = await uploadProducts(products, opts.apiUrl, opts.sessionCookie);
          process.stdout.write(` → ${ok}개 저장, ${fail}개 실패\n`);
          totalSaved += ok;
          totalFail += fail;
        } else {
          process.stdout.write(' → 상품 없음\n');
        }
      } catch (e) {
        process.stdout.write(` → 실패: ${e.message}\n`);
        totalFail++;
      }
      if (page < opts.pages) await new Promise(r => setTimeout(r, 600));
    }
  }

  console.log('');
  console.log(`✅ 완료: ${totalSaved}개 저장, ${totalFail}개 실패`);
}

main().catch(e => {
  console.error('오류:', e.message);
  process.exit(1);
});
