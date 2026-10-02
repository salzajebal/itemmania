import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mobileMenuMarkup, mobileMenuScript, mobileMenuStyles } from "./mobile-menu";

type FeaturedGame = { name: string; icon: string; snapshotName?: string; code?: string };

const popular: FeaturedGame[] = [
  { name: "리니지클래식", icon: "lineage-classic", snapshotName: "리니지클래식" },
  { name: "메이플스토리월드", icon: "maplestory-world", snapshotName: "메이플스토리월드" },
  { name: "아이온2", icon: "aion2", snapshotName: "아이온2" },
  { name: "메이플랜드", icon: "mapleland", code: "5990" },
  { name: "로스트아크", icon: "lostark", snapshotName: "로스트아크" },
  { name: "리니지M", icon: "lineage-m", snapshotName: "리니지M" },
  { name: "옛날바람", icon: "old-wind", code: "5491" },
  { name: "제우스:오만의신", icon: "zeus", code: "6027" },
  { name: "던전앤파이터", icon: "dungeon-fighter", snapshotName: "던전앤파이터" },
  { name: "마비노기", icon: "mabinogi", snapshotName: "마비노기" },
];
const newGames: FeaturedGame[] = [
  { name: "제우스:오만의신", icon: "zeus", code: "6027" },
  { name: "이클립스:더어웨이크닝", icon: "eclipse", code: "6028" },
];
const escape = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const svg = (content: string) => `<svg viewBox="0 0 32 32" aria-hidden="true">${content}</svg>`;
const searchIcon = svg('<circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/>');
const homeIcon = svg('<path d="m4 14 12-10 12 10v14h-9v-9h-6v9H4Z"/>');
const chatIcon = svg('<path d="M16 4C9 4 4 8 4 14c0 3 1 5 3 7l-1 6 7-3c1 .3 2 .4 3 .4 7 0 12-4 12-10S23 4 16 4Z"/><circle cx="11" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="21" cy="14" r="1"/>');
const personIcon = svg('<circle cx="16" cy="10" r="5"/><path d="M5 29c0-7 4-11 11-11s11 4 11 11"/>');
const menuIcon = svg('<path d="M4 8h24M4 16h24M4 24h24"/>');

/**
 * Returns a complete, cacheable standalone mobile HTML document.
 * assetDir is the filesystem directory containing the cropped PNGs
 * (usually join(STATIC_DIR, "mobile-game-icons")); icons are embedded as data URIs,
 * so no additional static-file route is required. User mode and saved games are
 * intentionally read only in the browser.
 */
export function renderMobileGameSearch(homeSnapshotHtml: string, assetDir: string): string {
  const $ = cheerio.load(homeSnapshotHtml);
  const snapshot = new Map<string, { art: string; code: string }>();
  $(".trade-top10-thumb").each((_, element) => {
    const anchor = $(element);
    const name = anchor.find(".trade-top10-name").text().trim();
    const code = /[?&]search_game=(\d+)/.exec(anchor.attr("href") ?? "")?.[1] ?? "";
    const art = anchor.find("img").first().attr("src") ?? "";
    if (name && code && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(art))
      snapshot.set(name, { art, code });
  });
  const cropped = new Map<string, string>();
  for (const game of [...popular, ...newGames]) {
    if (!cropped.has(game.icon)) {
      cropped.set(game.icon, `data:image/png;base64,${readFileSync(join(assetDir, `${game.icon}.png`)).toString("base64")}`);
    }
  }
  // Use the supplied reference's artwork for the visible cards; the desktop
  // snapshot uses different cover images for several of these same games.
  // Its links still provide the trusted codes used for registration.
  const decorate = (game: FeaturedGame) => ({
    name: game.name, icon: cropped.get(game.icon)!,
    code: game.code ?? snapshot.get(game.snapshotName ?? "")?.code ?? "",
  });
  const cards = popular.map(decorate);
  const latest = newGames.map(decorate);
  const card = (game: ReturnType<typeof decorate>, cls = "mgs-game") =>
    `<button type="button" class="${cls}" data-game="${escape(game.name)}" aria-label="${escape(game.name)} 선택"><img src="${game.icon}" alt=""><span title="${escape(game.name)}">${escape(game.name)}</span></button>`;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>게임 검색 | 아이템매니아</title>
${mobileMenuStyles()}<style>
html,body{margin:0;min-width:0;width:100%;background:#fff;color:#191919}
body{font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif}
#im-mobile-game-search,#im-mobile-game-search *{box-sizing:border-box}
#im-mobile-game-search{min-height:100dvh;padding-bottom:calc(78px + env(safe-area-inset-bottom));overflow:hidden;font-size:16px;letter-spacing:-.045em}
#im-mobile-game-search button,#im-mobile-game-search input{font:inherit}
#im-mobile-game-search button{cursor:pointer}
#im-mobile-game-search svg{display:block;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
#im-mobile-game-search .mgs-top{height:80px;padding:16px 24px 0 12px;display:flex;align-items:flex-start;gap:13px}
.mgs-back{width:35px;height:56px;flex:none;border:0;background:none;color:#272a2c;display:grid;place-items:center;padding:0}
.mgs-back svg{width:25px;height:25px}
.mgs-search-wrap{height:60px;flex:1;min-width:0;display:flex;align-items:center;border:2px solid #348bcc;border-radius:12px;box-shadow:0 1px 4px #b8cddf;overflow:hidden}
.mgs-search-wrap:focus-within{border-color:#2384d6}
.mgs-search-wrap input{height:100%;flex:1;min-width:0;padding:0 10px 0 12px;border:0;outline:0;background:transparent;color:#202124;font-size:18px!important;letter-spacing:-.05em}
.mgs-search-wrap input::placeholder{color:#787878;opacity:1}
.mgs-search-wrap input::-webkit-search-cancel-button{display:none}
.mgs-clear,.mgs-submit{border:0;background:none;display:grid;place-items:center;padding:0;color:#23272a}
.mgs-clear{width:29px;height:42px;color:#888}
.mgs-clear svg{width:18px;height:18px;stroke-width:1.3!important}
.mgs-submit{width:44px;height:54px}
.mgs-submit svg{width:31px;height:31px}
.mgs-quick{display:flex;justify-content:flex-end;padding-right:25px;height:27px}
.mgs-quick span{height:27px;display:flex;align-items:center;padding:0 9px;border-radius:16px;background:#7243e8;color:#fff;font-size:12px;line-height:1;box-shadow:0 1px 3px #5544ba55}
.mgs-quick svg{width:15px;height:15px;fill:#fff!important;stroke:none!important;margin-right:3px}
.mgs-featured{padding:8px 24px 0}
.mgs-section-head{display:flex;align-items:center;justify-content:space-between;height:35px;margin-bottom:9px}
.mgs-section-head h2,.mgs-new h2{font-size:21px;line-height:1.25;margin:0;font-weight:700;letter-spacing:-.055em}
.mgs-all{display:flex;align-items:center;gap:5px;border:0;background:none;padding:6px 0;color:#313131;font-size:14px!important}
.mgs-all svg{width:17px;height:17px;stroke-width:2.2!important}
.mgs-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));column-gap:9px;row-gap:21px}
.mgs-game{display:flex;min-width:0;flex-direction:column;align-items:center;gap:11px;padding:0;border:0;background:transparent;text-align:center;color:#171717}
.mgs-game img{width:min(100%,72px);aspect-ratio:1;object-fit:cover;border-radius:50%;display:block}
.mgs-game span{display:block;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:15px;line-height:20px}
.mgs-divider{height:1px;background:#d7d7d7;margin:31px 24px 0}
.mgs-new{padding:37px 24px 0}
.mgs-new h2{margin-bottom:9px}
.mgs-new-list{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mgs-new .mgs-game{flex-direction:row;text-align:left;gap:13px}
.mgs-new .mgs-game img{width:41px;flex:none}
.mgs-new .mgs-game span{font-size:14px}
.mgs-new + .mgs-divider{margin-top:19px}
.mgs-tabs{display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:24px 24px 0}
.mgs-tab{height:42px;border:1px solid #d4d4d4;border-radius:5px;background:#fff;color:#777;font-size:18px!important;letter-spacing:-.04em}
.mgs-tab[aria-selected="true"]{border-color:#3b3b3b;color:#171717;font-weight:700}
.mgs-saved{padding:16px 24px 24px;min-height:165px}
.mgs-empty{text-align:center;margin:0;padding:3px 0;font-size:20px;line-height:1.4;color:#1e1e1e}
.mgs-empty-help{text-align:center;color:#777;font-size:13px;margin:12px 0}
.mgs-empty-action{display:block;margin:12px auto;padding:8px 15px;border:1px solid #91bfe8;border-radius:8px;color:#237ac5;background:#f3f9ff}
.mgs-status{min-height:20px;color:#c44740;font-size:14px;padding:5px 24px;text-align:center}
.mgs-status:empty{display:none}
.mgs-results{padding:18px 24px 20px}
.mgs-results h2{font-size:19px;margin:0 0 17px}
.mgs-result{width:100%;min-height:61px;border:0;border-bottom:1px solid #ececec;background:#fff;display:flex;align-items:center;gap:12px;text-align:left;padding:7px 2px;color:#202020}
.mgs-result img{width:40px;height:40px;border-radius:50%;object-fit:cover;flex:none}
.mgs-result .mgs-result-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px}
.mgs-result .mgs-result-chevron{color:#858585;font-size:24px}
.mgs-fave{width:40px;height:40px;flex:none;border:0;background:none;color:#a0a0a0;font-size:28px!important;line-height:1}
.mgs-fave[aria-pressed="true"]{color:#438cdb}
.mgs-remove{width:38px;height:38px;flex:none;border:0;background:none;color:#777;font-size:22px!important}
.mgs-skeleton{height:57px;border-radius:8px;margin:8px 0;background:linear-gradient(90deg,#f0f3f5,#e5edf3,#f0f3f5);background-size:200% 100%;animation:mgs-shimmer 1.2s ease-in-out infinite}
@keyframes mgs-shimmer{to{background-position-x:-200%}}
.mgs-hidden{display:none!important}
.mgs-bottom{position:fixed;z-index:2147483000;bottom:0;left:0;right:0;height:calc(78px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:linear-gradient(100deg,#2187ed 0%,#128cc2 49%,#00ae72 100%);display:grid;grid-template-columns:repeat(5,1fr);align-items:center;color:#fff;box-shadow:0 -1px 5px #0002}
.mgs-bottom a,.mgs-bottom button{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;color:#fff;background:none;border:0;font-size:13px!important;text-decoration:none;padding:5px 0}
.mgs-bottom svg{width:28px;height:28px;stroke:#fff;stroke-width:2.2}
#im-mobile-game-search .mgs-bottom .mgs-home-icon{fill:#fff;stroke:#fff}
.mgs-bottom .mgs-center{width:72px;height:72px;border-radius:50%;background:#fff;color:#333;box-shadow:0 1px 5px #0004;justify-self:center;align-self:start;transform:translateY(-10px)}
.mgs-bottom .mgs-center svg{width:35px;height:35px;stroke:#3b3b3b;stroke-width:2.4}
#im-mobile-game-search :focus-visible{outline:2px solid #116ac2;outline-offset:2px}
@media(max-width:390px){.mgs-top{padding-right:14px!important}.mgs-featured,.mgs-new{padding-left:16px;padding-right:16px}.mgs-divider{margin-left:16px;margin-right:16px}.mgs-grid{column-gap:5px}.mgs-game span{font-size:13px}.mgs-tabs{padding-left:16px;padding-right:16px}.mgs-new .mgs-game{gap:7px}.mgs-new .mgs-game span{font-size:12px}}
</style></head><body><main id="im-mobile-game-search">
 <form class="mgs-top" id="mgs-form" role="search"><button type="button" class="mgs-back" id="mgs-back" aria-label="뒤로 가기">${svg('<path d="m19 7-9 9 9 9M10 16h19"/>')}</button><div class="mgs-search-wrap"><input id="mgs-input" type="search" name="q" placeholder="게임명을 입력해주세요." aria-label="게임명 검색" autocomplete="off"><button type="button" class="mgs-clear" id="mgs-clear" aria-label="검색어 지우기">${svg('<path d="M6 6l20 20M26 6 6 26"/>')}</button><button type="submit" class="mgs-submit" aria-label="검색">${searchIcon}</button></div></form>
<div class="mgs-quick"><span>${svg('<path d="m18 1-12 17h8l-2 13 14-19h-9z"/>')}빠른 거래 가능</span></div>
<div class="mgs-status" id="mgs-status" role="status" aria-live="polite"></div>
<div id="mgs-default">
<section class="mgs-featured"><div class="mgs-section-head"><h2>인기게임</h2><button type="button" class="mgs-all" id="mgs-all">전체 게임 ${svg('<path d="m12 5 9 11-9 11"/>')}</button></div><div class="mgs-grid">${cards.map(g => card(g)).join("")}</div></section>
<div class="mgs-divider"></div>
<section class="mgs-new"><h2>신규게임</h2><div class="mgs-new-list">${latest.map(g => card(g)).join("")}</div></section>
<div class="mgs-divider"></div>
<div class="mgs-tabs" role="tablist" aria-label="저장된 게임"><button type="button" class="mgs-tab" role="tab" id="mgs-recent-tab" aria-selected="true">최근 검색 게임</button><button type="button" class="mgs-tab" role="tab" id="mgs-mine-tab" aria-selected="false">나만의 게임</button></div>
<section class="mgs-saved" id="mgs-saved" aria-live="polite"></section></div>
<section class="mgs-results mgs-hidden" id="mgs-results" aria-live="polite"></section>
<nav class="mgs-bottom" aria-label="하단 메뉴"><a href="/" data-preview-link aria-label="홈">${homeIcon.replace("<svg", '<svg class="mgs-home-icon"')}<span>홈</span></a><a href="/myroom/chat/list.html" data-preview-link aria-label="채팅">${chatIcon}<span>채팅</span></a><button class="mgs-center" id="mgs-focus" type="button" aria-label="게임 검색">${searchIcon}</button><a href="/myroom/index.html" data-preview-link aria-label="마이룸">${personIcon}<span>마이룸</span></a><button id="mgs-menu-button" type="button" aria-label="메뉴" aria-expanded="false">${menuIcon}<span>메뉴</span></button></nav>
${mobileMenuMarkup()}</main>
<script>
(function(){
 var root=document.getElementById('im-mobile-game-search'),input=document.getElementById('mgs-input'),results=document.getElementById('mgs-results'),defaults=document.getElementById('mgs-default'),status=document.getElementById('mgs-status'),clear=document.getElementById('mgs-clear'),saved=document.getElementById('mgs-saved');
 var featured=${JSON.stringify([...cards, ...latest].map(g => ({ name: g.name, code: g.code, icon: g.icon })))};
 var params=new URLSearchParams(location.search),mode=['sell','buy','search'].includes(params.get('mode'))?params.get('mode'):'search',preview=params.get('mobile')==='1';
 var keyRecent='im-mobile-recent-games',keyMine='im-mobile-my-games',tab='recent',timer=null,serial=0,controller=null,items=[];
 if(preview)root.querySelectorAll('[data-preview-link]').forEach(function(a){a.href+=(a.href.includes('?')?'&':'?')+'mobile=1'});
 function read(key){try{var value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(function(x){return x&&typeof x.name==='string'&&typeof x.code==='string'}).slice(0,20):[]}catch(e){return []}}
 function write(key,entries){try{localStorage.setItem(key,JSON.stringify(entries))}catch(e){status.textContent='이 기기에서 게임 목록을 저장할 수 없습니다.'}}
 function matchingArt(name){var found=featured.find(function(g){return g.name===name});return found?found.icon:''}
 function makeRow(game,removable){
   var row=document.createElement('div');row.className='mgs-result';
   var select=document.createElement('button');select.type='button';select.className='mgs-result';select.style.border='0';select.style.minHeight='44px';select.style.flex='1';select.style.padding='0';select.style.width='auto';
   var art=matchingArt(game.name);if(art){var image=document.createElement('img');image.src=art;image.alt='';select.appendChild(image)}
   var name=document.createElement('span');name.className='mgs-result-name';name.textContent=game.name;select.appendChild(name);
   var next=document.createElement('span');next.className='mgs-result-chevron';next.textContent='›';select.appendChild(next);
   select.addEventListener('click',function(){choose(game)});row.appendChild(select);
   if(removable){var remove=document.createElement('button');remove.type='button';remove.className='mgs-remove';remove.setAttribute('aria-label',game.name+' 삭제');remove.textContent='×';remove.addEventListener('click',function(){var key=tab==='recent'?keyRecent:keyMine;write(key,read(key).filter(function(g){return g.name!==game.name}));renderSaved()});row.appendChild(remove)}
   else {var fav=document.createElement('button');fav.type='button';fav.className='mgs-fave';fav.setAttribute('aria-label',game.name+' 나만의 게임 저장');fav.textContent='☆';function paint(){var on=read(keyMine).some(function(x){return x.name===game.name});fav.textContent=on?'★':'☆';fav.setAttribute('aria-pressed',String(on))}paint();fav.addEventListener('click',function(){var list=read(keyMine),has=list.some(function(x){return x.name===game.name});write(keyMine,has?list.filter(function(x){return x.name!==game.name}):[game].concat(list).slice(0,20));paint()});row.appendChild(fav)}
   return row;
 }
 function renderSaved(){saved.replaceChildren();var list=read(tab==='recent'?keyRecent:keyMine);
   if(!list.length){var empty=document.createElement('p');empty.className='mgs-empty';empty.textContent=tab==='recent'?'최근 검색 게임이 없습니다.':'저장한 게임이 없습니다.';saved.appendChild(empty);
     if(tab==='mine'){var help=document.createElement('p');help.className='mgs-empty-help';help.textContent='검색 결과의 별을 눌러 자주 찾는 게임을 저장해 보세요.';saved.appendChild(help);var action=document.createElement('button');action.className='mgs-empty-action';action.type='button';action.textContent='게임 검색하기';action.onclick=function(){input.focus()};saved.appendChild(action)}return}
   list.forEach(function(g){saved.appendChild(makeRow(g,true))});
 }
 function setTab(value){tab=value;document.getElementById('mgs-recent-tab').setAttribute('aria-selected',String(value==='recent'));document.getElementById('mgs-mine-tab').setAttribute('aria-selected',String(value==='mine'));renderSaved()}
 document.getElementById('mgs-recent-tab').onclick=function(){setTab('recent')};document.getElementById('mgs-mine-tab').onclick=function(){setTab('mine')};renderSaved();
 function showResults(){defaults.classList.add('mgs-hidden');results.classList.remove('mgs-hidden')}
 function showDefault(){defaults.classList.remove('mgs-hidden');results.classList.add('mgs-hidden');status.textContent='';renderSaved()}
 function message(text){results.replaceChildren();var p=document.createElement('p');p.className='mgs-empty';p.textContent=text;results.appendChild(p)}
 function renderResults(list,title){showResults();results.replaceChildren();var h=document.createElement('h2');h.textContent=title;results.appendChild(h);if(!list.length){var p=document.createElement('p');p.className='mgs-empty';p.textContent='검색 결과가 없습니다.';results.appendChild(p);return}
   list.forEach(function(g){results.appendChild(makeRow(g,false))})}
 async function search(q){var request=++serial;if(controller)controller.abort();controller=new AbortController();showResults();results.replaceChildren();for(var i=0;i<3;i++){var skeleton=document.createElement('div');skeleton.className='mgs-skeleton';results.appendChild(skeleton)}status.textContent='';
   try{var response=await fetch('/api/games/search?q='+encodeURIComponent(q),{credentials:'include',signal:controller.signal});if(!response.ok)throw Error('search');var data=await response.json();if(request!==serial)return;if(!Array.isArray(data))throw Error('shape');
     items=data.filter(function(g){return g&&typeof g.name==='string'}).map(function(g){return {name:g.name,code:typeof g.code==='string'?g.code:'',id:g.id}});
     renderResults(items,'검색 결과');
   }catch(e){if(request!==serial||e.name==='AbortError')return;message('검색에 실패했습니다. 다시 시도해 주세요.');status.textContent='검색 결과를 불러오지 못했습니다.'}
 }
 function cancelSearch(){++serial;clearTimeout(timer);if(controller)controller.abort()}
  input.addEventListener('input',function(){cancelSearch();var q=input.value.trim();if(!q){showDefault();return}timer=setTimeout(function(){search(q)},280)});
  clear.onclick=function(){input.value='';cancelSearch();showDefault();input.focus()};
 document.getElementById('mgs-form').addEventListener('submit',function(e){e.preventDefault();var q=input.value.trim();if(!q){input.focus();return}cancelSearch();search(q);input.blur()});
  document.getElementById('mgs-all').onclick=async function(){input.value='';cancelSearch();var request=serial;showResults();message('전체 게임을 불러오는 중입니다.');
    try{var response=await fetch('/api/games',{credentials:'include'});if(!response.ok)throw Error('games');var games=await response.json();if(!Array.isArray(games))throw Error('format');
      if(request!==serial)return;
      renderResults(games.filter(function(g){return g&&typeof g.name==='string'}).map(function(g){return {name:g.name,code:typeof g.code==='string'?g.code:''}}),'전체 게임')}
    catch(e){if(request===serial)message('전체 게임을 불러오지 못했습니다. 다시 시도해 주세요.')}}
 document.querySelectorAll('[data-game]').forEach(function(button){button.addEventListener('click',function(){var item=featured.find(function(g){return g.name===button.getAttribute('data-game')});if(item)choose(item)})});
 async function choose(game){status.textContent='게임 정보를 확인하고 있습니다.';
   try{
     var code=typeof game.code==='string'&&/^\\d+$/.test(game.code)?game.code:'';
     if(!code){var trusted=featured.find(function(g){return g.name===game.name&&/^\\d+$/.test(g.code)});code=trusted?trusted.code:''}
     if(!code){var response=await fetch('/api/games/search?q='+encodeURIComponent(game.name),{credentials:'include'});if(!response.ok)throw Error('search');var choices=await response.json();var exact=Array.isArray(choices)&&choices.find(function(g){return g.name===game.name&&typeof g.code==='string'&&/^\\d+$/.test(g.code)});code=exact?exact.code:''}
     if(!code){status.textContent='이 게임은 현재 거래를 지원하지 않습니다.';return}
       // 게임 선택 후 조회 모드는 상품 목록, 판매/구매등록 모드는 등록 화면으로 이동한다.
     var verified=await fetch('/api/games/bycode/'+encodeURIComponent(code),{credentials:'include'});if(!verified.ok){status.textContent='이 게임은 현재 거래를 지원하지 않습니다.';return}
     var catalog=await verified.json();if(!catalog||String(catalog.code)!==code||catalog.name!==game.name){status.textContent='게임 정보를 확인할 수 없습니다.';return}
     var picked={name:catalog.name,code:code};write(keyRecent,[picked].concat(read(keyRecent).filter(function(g){return g.code!==code})).slice(0,20));
       var target=(mode==='search'?'/sell/list.html':mode==='buy'?'/buy/register.html':'/sell/register.html')+'?search_game='+encodeURIComponent(code);
      location.href=preview?target+'&mobile=1':target;
   }catch(e){status.textContent='게임 정보를 불러오지 못했습니다. 다시 시도해 주세요.'}
 }
 document.getElementById('mgs-focus').onclick=function(){input.focus()};
  document.getElementById('mgs-back').onclick=function(){if(!results.classList.contains('mgs-hidden')){input.value='';cancelSearch();showDefault()}else if(history.length>1)history.back();else location.href=preview?'/?mobile=1':'/'};
})();
</script>${mobileMenuScript("mgs-menu-button")}</body></html>`;
}