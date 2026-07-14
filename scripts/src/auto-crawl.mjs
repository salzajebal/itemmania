#!/usr/bin/env node
/**
 * 아이템마니아 로컬 크롤러 (ScraperAPI 불필요)
 *
 * ─── 사용법 ───────────────────────────────────────
 *  1. Node.js 18 이상 필요 (https://nodejs.org)
 *  2. 아래 설정 2줄만 채우세요 (어드민 패널 > 스크립트 다운로드 시 자동 입력됨)
 *  3. 터미널에서: node auto-crawl.mjs
 *  4. 창 닫지 말고 켜두면 1시간마다 자동 수집
 * ──────────────────────────────────────────────────
 */

import { createGunzip } from 'zlib';
import https from 'https';

// ★ 여기만 수정하세요 ★
const SITE_URL  = 'https://YOUR_SITE.replit.app'; // 배포 주소 (끝에 / 없이)
const CRAWL_KEY = 'YOUR_CRAWL_KEY';               // 어드민 패널에서 확인

// ─── CLI 인수 파싱 ─────────────────────────────────────────────────────────
// 사용 예시:
//   node auto-crawl.mjs                      → 전체 게임, 5페이지, 1시간 반복
//   node auto-crawl.mjs --games 5990         → 메이플랜드만
//   node auto-crawl.mjs --games 5990,5913    → 여러 게임 (쉼표 구분)
//   node auto-crawl.mjs --pages 3            → 게임당 3페이지
//   node auto-crawl.mjs --once               → 1회만 실행 후 종료
//   node auto-crawl.mjs --games 5990 --pages 3 --once
// ──────────────────────────────────────────────────────────────────────────
const _args = process.argv.slice(2);
function _getArg(name) {
  const idx = _args.indexOf(name);
  return idx >= 0 ? _args[idx + 1] : undefined;
}
const _gamesArg  = _getArg('--games');
const _pagesArg  = _getArg('--pages');
const _onceFlag  = _args.includes('--once');

// 수집할 게임 목록
const ALL_GAMES = [
  { id: 5913, name: '리니지클래식' },
  { id: 8458, name: '메이플스토리' },
  { id: 5233, name: '메이플스토리월드' },
  { id: 5990, name: '메이플랜드' },
  { id: 281,  name: '던전앤파이터' },
  { id: 2696, name: '로스트아크' },
  { id: 3449, name: '리니지M' },
  { id: 4696, name: '오딘' },
  { id: 5799, name: '아이온2' },
  { id: 155,  name: '마비노기' },
  { id: 101,  name: '거상' },
];

// CLI --games 로 필터 (없으면 전체)
const _filterIds = _gamesArg ? _gamesArg.split(',').map(s => parseInt(s.trim(), 10)) : null;
const GAMES = _filterIds ? ALL_GAMES.filter(g => _filterIds.includes(g.id)) : ALL_GAMES;

// 팝니다/삽니다 둘 다 수집 (한쪽만 원하면 제거)
const CATEGORIES = ['sell', 'buy'];

// 게임당 수집 페이지 수 (CLI --pages 로 오버라이드 가능)
const PAGES_PER_GAME = _pagesArg ? Math.max(1, parseInt(_pagesArg, 10)) : 5;

// 자동 반복 주기 (기본 1시간) — --once 이면 무시
const INTERVAL_MS = 60 * 60 * 1000;

// ─── 이하 수정 불필요 ──────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const AGENT = new https.Agent({ keepAlive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ts() { return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

// itemmania 페이지 HTML 가져오기 (gzip 지원, 재시도 포함)
async function fetchHtml(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const html = await new Promise((resolve, reject) => {
        const req = https.get(url, {
          agent: AGENT,
          headers: {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': 'https://www.itemmania.com/',
          },
          timeout: 25000,
        }, (res) => {
          if (res.statusCode >= 301 && res.statusCode <= 302 && res.headers.location) {
            res.resume();
            resolve(fetchHtml(res.headers.location, retries - 1));
            return;
          }
          const stream = res.headers['content-encoding'] === 'gzip'
            ? res.pipe(createGunzip())
            : res;
          const chunks = [];
          stream.on('data', d => chunks.push(d));
          stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
          stream.on('error', reject);
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
      });
      if (typeof html === 'string' && html.length > 500) return html;
      throw new Error(`응답 너무 짧음 (${typeof html === 'string' ? html.length : 0}바이트)`);
    } catch (e) {
      if (attempt < retries) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
}

// itemmania 리스트 JS에서 API 엔드포인트 추출
async function discoverApi() {
  try {
    const html = await fetchHtml('https://www.itemmania.com/sell/list.html?search_game=5913&search_goods=all&page=1');
    const jsMatch = html.match(/src=["']([^"']*\/(?:list|goods|trade)[^"']*\.(?:js|min\.js)[^"']*)["']/i);
    if (!jsMatch) { log('⚠️  리스트 JS URL 탐지 실패'); return null; }
    const jsUrl = jsMatch[1].startsWith('http') ? jsMatch[1] : 'https://www.itemmania.com' + jsMatch[1].split('?')[0] + (jsMatch[1].includes('?') ? '?' + jsMatch[1].split('?')[1] : '');
    log(`🔍 리스트 JS: ${jsUrl}`);
    const jsText = await fetchHtml(jsUrl);
    // fetch/ajax 호출 패턴 추출
    const patterns = [];
    const re = /["'`](\/[a-z][a-z0-9/_-]{2,60}\?[^"'`]{0,120})["'`]/g;
    let m;
    while ((m = re.exec(jsText)) !== null) patterns.push(m[1]);
    const unique = [...new Set(patterns)].filter(p => /list|goods|trade|item|product|search/.test(p)).slice(0, 20);
    if (unique.length) {
      log(`📡 발견된 API 패턴 (${unique.length}개):`);
      unique.forEach(p => log(`   ${p}`));
    } else {
      log('⚠️  API 패턴 없음 — 직접 fetch URL 검색');
      const fe = /fetch\s*\(\s*["'`]([^"'`]{5,120})["'`]/g;
      while ((m = fe.exec(jsText)) !== null) patterns.push(m[1]);
      [...new Set(patterns)].slice(0, 10).forEach(p => log(`   fetch: ${p}`));
    }
    // 서버에 전송
    await fetch(`${SITE_URL}/api/admin/crawl/upload-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Crawl-Key': CRAWL_KEY },
      body: JSON.stringify({ html: jsText.slice(0, 50000), gameId: 0, category: 'sell', gameName: '__JS_DISCOVERY__' }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => {});
    return unique;
  } catch (e) {
    log(`⚠️  API 탐색 실패: ${e.message}`);
    return null;
  }
}

// HTML을 서버에 업로드 → 서버가 파싱 & 저장
async function uploadHtml(html, gameId, gameName, category) {
  const res = await fetch(`${SITE_URL}/api/admin/crawl/upload-html`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Crawl-Key': CRAWL_KEY,
    },
    body: JSON.stringify({ html, gameId, gameName, category }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`업로드 실패 (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function runOnce() {
  let totalSaved = 0, totalFailed = 0;

  for (const cat of CATEGORIES) {
    const label = cat === 'sell' ? '팝니다' : '삽니다';
    log(`── [${label}] 수집 시작 ──`);

    for (const game of GAMES) {
      process.stdout.write(`  [${game.name}] `);
      let gameSaved = 0;

      for (let page = 1; page <= PAGES_PER_GAME; page++) {
        const url = `https://www.itemmania.com/${cat}/list.html?search_game=${game.id}&search_goods=all&page=${page}`;
        try {
          const html = await fetchHtml(url);
          const result = await uploadHtml(html, game.id, game.name, cat);
          const saved = result.saved ?? 0;
          const parsed = result.parsed ?? 0;
          gameSaved += saved;
          totalSaved += saved;
          if (parsed === 0) {
            const d = result.debug || {};
            process.stdout.write(`\n  [디버그] tid=${d.dataTidCount??'?'} next=${d.hasNextData??'?'} len=${d.htmlLen??'?'}\n`);
            if (d.apiMatches?.length) process.stdout.write(`  API패턴: ${d.apiMatches.slice(0,3).join(' | ')}\n`);
            if (d.fetchUrls?.length) process.stdout.write(`  fetch: ${d.fetchUrls.slice(0,3).join(' | ')}\n`);
            if (d.scriptSrcs?.length) process.stdout.write(`  scripts: ${d.scriptSrcs.join(', ')}\n`);
            break;
          } else {
            process.stdout.write(`${page}p:${saved}개 `);
          }
        } catch (e) {
          process.stdout.write(`${page}p:❌ `);
          totalFailed++;
        }
        if (page < PAGES_PER_GAME) await sleep(600);
      }
      console.log(`→ 합계 ${gameSaved}개`);
      await sleep(1000);
    }
  }

  return { totalSaved, totalFailed };
}

async function main() {
  console.log('\n' + '='.repeat(55));
  console.log('  🕷️  아이템마니아 로컬 크롤러');
  console.log('='.repeat(55));
  console.log(`  서버:     ${SITE_URL}`);
  console.log(`  게임:     ${GAMES.map(g => g.name).join(', ')}`);
  console.log(`  페이지:   게임당 ${PAGES_PER_GAME}페이지`);
  console.log(`  카테고리: ${CATEGORIES.join(', ')}`);
  console.log(`  반복:     ${_onceFlag ? '1회 실행 후 종료' : `${INTERVAL_MS / 60000}분마다 자동`}`);
  console.log('='.repeat(55));
  if (!_onceFlag) console.log('\n⚠️  이 창을 닫으면 수집이 멈춥니다. 계속 켜두세요!\n');

  // 연결 테스트
  process.stdout.write('🔗 서버 연결 확인 중...');
  try {
    const testRes = await fetch(`${SITE_URL}/api/admin/crawl/upload-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Crawl-Key': CRAWL_KEY },
      body: JSON.stringify({ html: '<test>', gameId: 0, category: 'sell' }),
      signal: AbortSignal.timeout(10000),
    });
    if (testRes.status === 401) {
      console.error(' ❌ CRAWL_KEY가 올바르지 않습니다. 어드민 패널에서 키를 다시 확인하세요.');
      process.exit(1);
    }
    console.log(' ✅');
  } catch (e) {
    console.error(` ❌ 서버 연결 실패: ${e.message}`);
    console.error(`   SITE_URL을 확인하세요: ${SITE_URL}`);
    process.exit(1);
  }

  // API 엔드포인트 자동 탐색
  log('🔍 itemmania API 탐색 중...');
  await discoverApi();

  if (_onceFlag) {
    log('수집 시작 (1회 모드)');
    try {
      const { totalSaved, totalFailed } = await runOnce();
      log(`✅ 완료 — ${totalSaved}개 저장, ${totalFailed}개 실패`);
    } catch (e) {
      log(`❌ 오류: ${e.message}`);
      process.exit(1);
    }
    return;
  }

  while (true) {
    log('수집 시작');
    try {
      const { totalSaved, totalFailed } = await runOnce();
      log(`✅ 완료 — ${totalSaved}개 저장, ${totalFailed}개 실패`);
    } catch (e) {
      log(`❌ 오류: ${e.message}`);
    }
    log(`💤 ${INTERVAL_MS / 60000}분 후 재수집`);
    await sleep(INTERVAL_MS);
  }
}

main().catch(e => {
  console.error('\n❌ 치명적 오류:', e.message);
  process.exit(1);
});
