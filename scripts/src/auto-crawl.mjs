#!/usr/bin/env node
/**
 * 아이템마니아 로컬 크롤러 — AJAX JSON 직접 파싱
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
const _args = process.argv.slice(2);
function _getArg(name) { const idx = _args.indexOf(name); return idx >= 0 ? _args[idx + 1] : undefined; }
const _gamesArg = _getArg('--games');
const _pagesArg = _getArg('--pages');
const _onceFlag = _args.includes('--once');

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

const _filterIds = _gamesArg ? _gamesArg.split(',').map(s => parseInt(s.trim(), 10)) : null;
const GAMES = _filterIds ? ALL_GAMES.filter(g => _filterIds.includes(g.id)) : ALL_GAMES;
const CATEGORIES = ['sell', 'buy'];
const PAGES_PER_GAME = _pagesArg ? Math.max(1, parseInt(_pagesArg, 10)) : 5;
const INTERVAL_MS = 60 * 60 * 1000;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const AGENT = new https.Agent({ keepAlive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ts() { return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

// ─── AJAX POST 직접 호출 ───────────────────────────────────────────────────
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
            'Accept': 'application/json, text/html, */*',
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
            ? res.pipe(createGunzip()) : res;
          const chunks = [];
          stream.on('data', d => chunks.push(d));
          stream.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
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

// ─── JSON 응답 → 상품 배열 변환 ───────────────────────────────────────────
// trade_id, trade_money, gs_name, str_trade_kind, trade_category 등 매핑
function parseProducts(data, gameId, gameName, category) {
  // data.p = 일반 상품 배열, data.pp = 프리미엄 상품 배열 (추정)
  const items = [
    ...(Array.isArray(data.p)  ? data.p  : []),
    ...(Array.isArray(data.pp) ? data.pp : []),
  ];

  return items.map(item => {
    const price = parseInt(String(item.trade_money ?? '0').replace(/[^0-9]/g, ''), 10) || 0;
    // 제목: trade_title > goods_name > str_trade_kind 순 fallback
    const title = (item.trade_title || item.goods_name || item.str_trade_kind || item.trade_kind_name || '').trim();
    // 서버명: server_name > gs_name (게임+서버 합산일 수 있음)
    const serverName = (item.server_name || item.gs_name || '').trim();
    // 종목: trade_category_name > str_goods_kind > str_trade_kind
    const itemCategory = (item.trade_category_name || item.str_goods_kind || item.str_trade_kind || '').trim();
    // 판매자 등급: seller_icon_type 또는 premium 필드
    const gradeRaw = (item.seller_icon_type || item.seller_grade || '').toLowerCase();
    const gradeMap = { vip: 'vip', platinum: 'platinum', gold: 'gold', silver: 'silver', bronze: 'bronze', p: 'platinum' };
    const sellerGrade = gradeMap[gradeRaw] ?? null;
    // 판매자명
    const sellerName = (item.seller_id || item.member_id || '').trim() || null;

    return {
      itemmaniaid: String(item.trade_id ?? ''),
      title: title || itemCategory || '(제목없음)',
      price,
      gameName,
      serverName,
      itemCategory,
      category,
      sellerGrade,
      sellerName,
      detailUrl: item.trade_id
        ? `https://www.itemmania.com/${category}/application.html?id=${item.trade_id}`
        : null,
    };
  }).filter(p => p.itemmaniaid);
}

// ─── 서버 배치 업로드 ──────────────────────────────────────────────────────
async function batchUpload(products) {
  const res = await fetch(`${SITE_URL}/api/admin/crawl/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Crawl-Key': CRAWL_KEY },
    body: JSON.stringify({ products }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`배치 업로드 실패 (${res.status}): ${body.slice(0, 200)}`);
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
      let tid = 0;
      let pagesDone = 0;

      for (let page = 1; page <= PAGES_PER_GAME; page++) {
        try {
          const { status, text } = await fetchAjaxList(game.id, cat, tid);

          if (status !== 200 || !text || text.length < 10) {
            process.stdout.write(`${page}p:❌(${status}) `);
            totalFailed++;
            break;
          }

          // JSON 파싱
          let json;
          try { json = JSON.parse(text); }
          catch { process.stdout.write(`${page}p:❌(JSON오류) `); break; }

          if (json.result !== 'SUCCESS') {
            process.stdout.write(`${page}p:❌(${json.result}) `);
            break;
          }

          const products = parseProducts(json.data ?? json, game.id, game.name, cat);

          if (products.length === 0) {
            if (page === 1) {
              // 첫 페이지 빈 응답: 필드 구조 출력
              const sampleItem = (json.data?.p ?? json.data?.pp ?? [])[0];
              if (sampleItem) {
                process.stdout.write(`\n  [필드구조] ${JSON.stringify(Object.keys(sampleItem))}\n`);
                process.stdout.write(`  [샘플] ${JSON.stringify(sampleItem)}\n`);
              } else {
                process.stdout.write(`\n  [데이터없음] keys=${JSON.stringify(Object.keys(json.data ?? json))}\n`);
              }
            }
            break;
          }

          // 서버에 배치 업로드
          const result = await batchUpload(products);
          const saved = result.upserted ?? 0;
          gameSaved += saved;
          totalSaved += saved;
          pagesDone++;
          process.stdout.write(`${page}p:${saved}개 `);

          // 다음 tid: JSON 응답에서 추출
          const nextTid = json.data?.tid ?? json.tid ?? json.data?.next_tid ?? null;
          if (nextTid === null || nextTid === tid || nextTid === 0) break;
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
  console.log('  🕷️  아이템마니아 로컬 크롤러 (AJAX JSON)');
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
    const testRes = await fetch(`${SITE_URL}/api/admin/crawl/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Crawl-Key': CRAWL_KEY },
      body: JSON.stringify({ products: [] }),
      signal: AbortSignal.timeout(10000),
    });
    if (testRes.status === 401) {
      console.error(' ❌ CRAWL_KEY가 올바르지 않습니다. 어드민 패널에서 키를 다시 확인하세요.');
      process.exit(1);
    }
    console.log(' ✅');
  } catch (e) {
    console.error(` ❌ 서버 연결 실패: ${e.message}`);
    process.exit(1);
  }

  // JSON 구조 사전 확인 (리니지클래식 1페이지)
  log('🔍 AJAX JSON 구조 확인 중...');
  try {
    const { status, text } = await fetchAjaxList(5913, 'sell', 0, 1);
    log(`   status=${status} len=${text?.length ?? 0}`);
    const json = JSON.parse(text);
    log(`   result=${json.result}`);
    log(`   data keys: ${JSON.stringify(Object.keys(json.data ?? json))}`);
    const pArr = json.data?.p ?? [];
    log(`   p[] 개수: ${pArr.length}`);
    if (pArr.length > 0) {
      log(`   첫 번째 항목 keys: ${JSON.stringify(Object.keys(pArr[0]))}`);
      log(`   첫 번째 항목: ${JSON.stringify(pArr[0])}`);
    }
    // tid/pagination 확인
    log(`   tid/pagination: tid=${json.data?.tid} next_tid=${json.data?.next_tid} total=${json.data?.total}`);
  } catch (e) {
    log(`   ⚠️  구조 확인 실패: ${e.message}`);
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
