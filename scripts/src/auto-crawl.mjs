#!/usr/bin/env node
/**
 * 아이템마니아 로컬 크롤러 — AJAX 직접 POST 방식
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

// ─── AJAX POST 직접 호출 ───────────────────────────────────────────────────
// itemmania /sell/ajax_list.php 또는 /buy/ajax_list.php 에 form POST
async function fetchAjaxList(gameId, category, tid, retries = 2) {
  const url = `https://www.itemmania.com/${category}/ajax_list.php`;
  const body = new URLSearchParams({
    search_game: String(gameId),
    search_goods: 'all',
    tid: String(tid),
    search_kind: '',
    search_word: '',
  }).toString();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          method: 'POST',
          agent: AGENT,
          headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
            'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': `https://www.itemmania.com/${category}/list.html?search_game=${gameId}&search_goods=all`,
            'Origin': 'https://www.itemmania.com',
            'X-Requested-With': 'XMLHttpRequest',
          },
          timeout: 25000,
        };
        const req = https.request(options, (res) => {
          const stream = res.headers['content-encoding'] === 'gzip'
            ? res.pipe(createGunzip())
            : res;
          const chunks = [];
          stream.on('data', d => chunks.push(d));
          stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
          stream.on('error', reject);
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      return result;
    } catch (e) {
      if (attempt < retries) { await sleep(2000 * (attempt + 1)); continue; }
      throw e;
    }
  }
}

// ─── 응답 HTML에서 nextTid 추출 ───────────────────────────────────────────
// ajax_list.php 응답에는 data-tid 항목들 + 다음 페이지를 위한 tid 값이 포함됨
function extractNextTid(html) {
  // 형태 1: <input type="hidden" id="tid" value="12345">
  const m1 = html.match(/id=["']tid["'][^>]*value=["']([0-9]+)["']/i);
  if (m1) return parseInt(m1[1], 10);
  // 형태 2: value="12345" id="tid"
  const m2 = html.match(/value=["']([0-9]+)["'][^>]*id=["']tid["']/i);
  if (m2) return parseInt(m2[1], 10);
  // 형태 3: JS 변수 tid = 12345
  const m3 = html.match(/\btid\s*[=:]\s*['""]?([0-9]+)/);
  if (m3) return parseInt(m3[1], 10);
  // 형태 4: data-tid 마지막 값 (페이지 커서로 사용)
  const all = [...html.matchAll(/data-tid=["']([0-9]+)["']/g)];
  if (all.length > 0) return parseInt(all[all.length - 1][1], 10);
  return null;
}

// ─── HTML을 서버에 업로드 → 파싱 & DB 저장 ────────────────────────────────
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

// ─── 메인 수집 루프 ────────────────────────────────────────────────────────
async function runOnce() {
  let totalSaved = 0, totalFailed = 0;

  for (const cat of CATEGORIES) {
    const label = cat === 'sell' ? '팝니다' : '삽니다';
    log(`── [${label}] 수집 시작 ──`);

    for (const game of GAMES) {
      process.stdout.write(`  [${game.name}] `);
      let gameSaved = 0;
      let tid = 0;          // 첫 페이지는 tid=0
      let pagesDone = 0;

      for (let page = 1; page <= PAGES_PER_GAME; page++) {
        try {
          const { status, body: html } = await fetchAjaxList(game.id, cat, tid);

          if (status !== 200 || !html || html.length < 100) {
            process.stdout.write(`${page}p:❌(${status}) `);
            totalFailed++;
            break;
          }

          // 서버에 업로드 & 파싱
          const result = await uploadHtml(html, game.id, game.name, cat);
          const saved = result.saved ?? 0;
          const parsed = result.parsed ?? 0;

          if (parsed === 0) {
            // 첫 페이지에서 파싱 실패 시 디버그 출력
            if (page === 1) {
              const d = result.debug || {};
              process.stdout.write(`\n  [디버그] status=${status} len=${html.length} tid_count=${d.dataTidCount??'?'}\n`);
              process.stdout.write(`  응답 앞 300자: ${html.slice(0, 300).replace(/\s+/g, ' ')}\n`);
            }
            break; // 이 게임/카테고리 더 이상 데이터 없음
          }

          gameSaved += saved;
          totalSaved += saved;
          pagesDone++;
          process.stdout.write(`${page}p:${saved}개 `);

          // 다음 페이지 tid 추출
          const nextTid = extractNextTid(html);
          if (nextTid === null || nextTid === tid) break; // 더 이상 페이지 없음
          tid = nextTid;

        } catch (e) {
          process.stdout.write(`${page}p:❌ `);
          totalFailed++;
          if (page === 1) process.stdout.write(`\n  [오류] ${e.message}\n`);
          break;
        }
        if (page < PAGES_PER_GAME) await sleep(500);
      }
      console.log(`→ 합계 ${gameSaved}개 (${pagesDone}페이지)`);
      await sleep(800);
    }
  }

  return { totalSaved, totalFailed };
}

async function main() {
  console.log('\n' + '='.repeat(55));
  console.log('  🕷️  아이템마니아 로컬 크롤러 (AJAX 직접 POST)');
  console.log('='.repeat(55));
  console.log(`  서버:     ${SITE_URL}`);
  console.log(`  게임:     ${GAMES.map(g => g.name).join(', ')}`);
  console.log(`  페이지:   게임당 최대 ${PAGES_PER_GAME}페이지`);
  console.log(`  카테고리: ${CATEGORIES.join(', ')}`);
  console.log(`  반복:     ${_onceFlag ? '1회 실행 후 종료' : `${INTERVAL_MS / 60000}분마다 자동`}`);
  console.log('='.repeat(55));
  if (!_onceFlag) console.log('\n⚠️  이 창을 닫으면 수집이 멈춥니다. 계속 켜두세요!\n');

  // 서버 연결 테스트
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

  // itemmania AJAX 응답 포맷 확인 (첫 1회)
  log('🔍 itemmania AJAX 응답 확인 중...');
  try {
    const { status, body: testHtml } = await fetchAjaxList(5913, 'sell', 0, 1);
    log(`   status=${status} len=${testHtml?.length ?? 0}`);
    if (testHtml && testHtml.length > 100) {
      const tidCount = (testHtml.match(/data-tid=/g) || []).length;
      const nextTid = extractNextTid(testHtml);
      log(`   data-tid 항목 수: ${tidCount}`);
      log(`   nextTid: ${nextTid}`);
      log(`   응답 앞 400자: ${testHtml.slice(0, 400).replace(/\s+/g, ' ')}`);
    } else {
      log(`   ⚠️  응답이 짧습니다: ${testHtml?.slice(0, 300)}`);
    }
  } catch (e) {
    log(`   ⚠️  AJAX 테스트 실패: ${e.message}`);
  }

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
