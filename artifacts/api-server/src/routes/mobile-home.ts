import * as cheerio from "cheerio";
import { mobileMenuMarkup, mobileMenuScript, mobileMenuStyles } from "./mobile-menu";

/**
 * Mobile-only home overlay for the prepared SingleFile homepage. All artwork
 * comes from the supplied snapshot, rather than from the original site's CDN.
 */
export function renderMobileHome(desktopHtml: string): string {
  const $ = cheerio.load(desktopHtml);
  const escape = (value: unknown): string => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const embedded = (value: string | undefined): string =>
    value && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";
  const image = (src: string, alt: string, className = ""): string =>
    src ? `<img class="${className}" src="${escape(src)}" alt="${escape(alt)}">` : "";
  const logo = embedded($('img[alt="아이템매니아"]').first().attr("src"));
  const isms = embedded($('img[alt="ISMS"]').first().attr("src"));
  const danal = embedded($('img[alt*="다날"]').first().attr("src"));

  const games = $(".trade-top10-thumb").toArray().map(el => {
    const anchor = $(el);
    const code = /[?&]search_game=(\d+)/.exec(anchor.attr("href") ?? "")?.[1] ?? "";
    return {
      name: anchor.find(".trade-top10-name").text().trim(),
      count: anchor.find(".trade-top10-badge").text().trim(),
      code,
      art: embedded(anchor.find("img").first().attr("src")),
    };
  }).filter(game => game.code && game.name);
  // The mobile ranking orders the first three pairs by column, not by row.
  const mobileOrder = [0, 2, 4, 1, 3, 5, 6, 7, 8, 9];
  const ordered = mobileOrder.map(index => games[index]).filter((game): game is typeof games[number] => !!game);
  const referenceCounts: Record<string, string> = {
    "리니지클래식": "12,836건",
    "메이플스토리월드": "8,011건",
    "로스트아크": "6,660건",
    "아이온2": "29,332건",
    "메이플스토리": "13,146건",
    "던전앤파이터": "4,827건",
  };

  const trends = $(".price-trend-card").toArray().map(el => {
    const card = $(el);
    const name = card.find(".price-trend-name").first().clone();
    name.find("span").remove();
    const href = card.find(".price-trend-button").attr("href") ?? "";
    return {
      title: name.text().trim(),
      kind: card.find(".price-trend-badge").text().trim(),
      subtitle: card.find(".price-trend-sub").text().trim().replace(/\s+/g, " "),
      price: card.find(".price-trend-price").first().clone().children().remove().end().text().trim(),
      change: card.find(".trade-top10-change").text().trim().replace(/\s+/g, " "),
      art: embedded(card.find(".price-trend-thumb img").attr("src")),
      code: /[?&]gamecode=(\d+)/.exec(href)?.[1] ?? games[0]?.code ?? "",
    };
  }).filter(trend => trend.code);

  const chevron = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>`;
  const heart = `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 24 3.8 14.3C-1.8 8.7 6.4.4 12.2 6.1L14 7.9l1.8-1.8c5.8-5.7 14 2.6 8.4 8.2Z"/></svg>`;
  const magnifier = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/></svg>`;
  const home = `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="m3 12 11-9 11 9v12h-8v-8h-6v8H3Z"/></svg>`;
  const chat = `<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M15 3C8 3 3 7.5 3 13c0 2.6 1 4.7 3 6l-1 6 6-3c1.2.3 2.6.5 4 .5 7 0 12-4.5 12-10S22 3 15 3Z"/><circle cx="10" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><circle cx="20" cy="13" r="1"/></svg>`;
  const user = `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="9" r="5"/><path d="M4 25c0-6 4-9 10-9s10 3 10 9"/></svg>`;
  const bars = `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M3 6h22M3 14h22M3 22h22"/></svg>`;
  const cardMarkup = (game: typeof games[number]): string => `<a class="im-game" href="/sell/list.html?search_game=${escape(game.code)}" aria-label="${escape(game.name)} 상품 보기">
    ${image(game.art, game.name)}<span class="im-game-count">${escape(referenceCounts[game.name] ?? game.count)}</span><span class="im-game-title">${escape(game.name)}</span></a>`;
  const cards = ordered.map(cardMarkup).join("");
  const chart = `<svg viewBox="0 0 230 77" preserveAspectRatio="none" aria-hidden="true"><path fill="#edf4ff" d="M0 48 L35 35 70 18 105 4 140 16 175 29 230 47 V77 H0Z"/><path fill="none" stroke="#2882e7" stroke-width="2" d="M0 48 L35 35 70 18 105 4 140 16 175 29 230 47"/>${[[0,48],[35,35],[70,18],[105,4],[140,16],[175,29],[230,47]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#2882e7"/>`).join("")}</svg>`;
  const trendCards = trends.map(trend => `<article class="im-trend-card"><div class="im-trend-head">
    ${image(trend.art, trend.subtitle, "im-trend-icon")}<div><div class="im-trend-name">${escape(trend.title)} <span>${escape(trend.kind)}</span></div>
    <div class="im-trend-sub">${escape(trend.subtitle)}</div><div class="im-trend-price">${escape(trend.price)}원 <small>${escape(trend.change)}</small></div></div></div>
    <div class="im-chart">${chart}</div><a href="/sell/list.html?search_game=${escape(trend.code)}" class="im-trend-more">시세 더보기 <span>▸</span></a></article>`).join("");

  return `${mobileMenuStyles()}<style>
@media (min-width:781px){#im-mobile-home{display:none!important}}
@media (max-width:780px){
  body:has(#im-mobile-home) .g_body{display:none!important}
  html:has(#im-mobile-home),body:has(#im-mobile-home){min-width:0!important;width:100%!important;max-width:100vw!important;overflow-x:hidden!important}
  body:has(#im-mobile-home){margin:0!important;background:#fff!important}
  #im-mobile-home,#im-mobile-home *{box-sizing:border-box}
  #im-mobile-home{--im-blue:#0876e8;position:relative;display:block!important;width:100vw;max-width:100vw;min-height:100dvh;background:#fff;color:#191b1e;font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;font-size:15px;line-height:1.4;overflow:hidden;padding-bottom:82px}
  #im-mobile-home a{text-decoration:none;color:inherit}#im-mobile-home button,#im-mobile-home input{font:inherit}#im-mobile-home button{cursor:pointer}#im-mobile-home svg{display:block}
  #im-mobile-home .im-header{height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;background:#fff}
  #im-mobile-home .im-brand{display:flex;align-items:center;gap:12px;min-width:0;flex:1}#im-mobile-home .im-brand img{width:103px;height:35px;object-fit:contain;flex:none}#im-mobile-home .im-brand span{color:#286197;font-size:22px;font-weight:700;letter-spacing:-1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  #im-mobile-home .im-header-actions{display:flex;align-items:center;gap:12px;flex:none}#im-mobile-home .im-heart{border:0;padding:0;background:none;color:#252729;flex:none}#im-mobile-home .im-heart svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:2.1;stroke-linejoin:round}
  #im-mobile-home .im-register{height:36px;width:96px;display:flex;align-items:center;justify-content:center;gap:4px;padding:0 6px;background:#e8f4ff;border:1px solid #a3c5e4;border-radius:7px;color:#1e659e;font-size:14px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px #b4cadf}
  #im-mobile-home .im-register b{background:#1679d2;color:#fff;border-radius:50%;width:16px;height:16px;display:grid;place-items:center;font-size:15px;line-height:16px}
  #im-mobile-home .im-search-section{padding:35px 12px 31px}#im-mobile-home h1{font-size:22px;line-height:1.35;margin:0 8px 12px;font-weight:700;letter-spacing:-1.2px}
  #im-mobile-home .im-search-form{display:flex;align-items:center;height:66px;padding:7px 9px 7px 12px;border:3px solid #398bd4;border-radius:11px;box-shadow:0 1px 4px #a2bfd7}
  #im-mobile-home .im-search-form input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#252525;font-size:17px}#im-mobile-home .im-search-form input::placeholder{color:#252525;opacity:1}
  #im-mobile-home .im-search-form button{width:107px;height:46px;display:grid;place-items:center;text-align:center;border:0;border-radius:9px;background:#0678ea;color:white;font-size:17px;box-shadow:0 2px 4px #9cb6d7}
  #im-mobile-home .im-search-error{min-height:0;color:#cf3140;font-size:13px;padding:0 5px}#im-mobile-home .im-search-error:not(:empty){padding-top:9px}
  #im-mobile-home .im-separator{height:21px;background:#f8f9fa}
  #im-mobile-home .im-ranking{padding:37px 12px 0}#im-mobile-home h2{font-size:20px;line-height:1.35;font-weight:700;letter-spacing:-.8px;margin:0 0 14px}#im-mobile-home .im-ranking h2{margin-bottom:10px}
  #im-mobile-home .im-game-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:17px;row-gap:14px;position:relative}
  #im-mobile-home .im-rank-arrow{position:absolute;z-index:4;top:calc((100vw - 58px)/3 - 12px);display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:50%;background:#fff;color:#444;font-size:26px;line-height:1;box-shadow:0 1px 4px #0003}
  #im-mobile-home .im-rank-arrow:disabled{opacity:.65}#im-mobile-home .im-rank-arrow-left{left:-8px}#im-mobile-home .im-rank-arrow-right{right:-8px}
  #im-mobile-home .im-game{position:relative;display:block;aspect-ratio:1;overflow:hidden;border-radius:11px;background:#dfdfdf}
  #im-mobile-home .im-game img{width:100%;height:100%;display:block;object-fit:cover}
  #im-mobile-home .im-game:after{content:"";position:absolute;inset:42% 0 0;background:linear-gradient(transparent,rgba(0,0,0,.91));pointer-events:none}
  #im-mobile-home .im-game-count{position:absolute;right:5px;top:5px;z-index:1;background:#252628b8;color:white;border-radius:5px;padding:0 5px;font-size:clamp(11px,3vw,14px);line-height:20px;white-space:nowrap;max-width:calc(100% - 10px);overflow:hidden;text-overflow:ellipsis}
  #im-mobile-home .im-game-title{position:absolute;z-index:1;bottom:8px;left:4px;right:4px;text-align:center;color:#fff;font-size:clamp(11px,3.2vw,14px);line-height:1.2;font-weight:700;letter-spacing:-.5px;white-space:normal;overflow-wrap:anywhere;word-break:keep-all}
  #im-mobile-home .im-page-controls{height:99px;display:flex;align-items:center;justify-content:center;gap:16px}
  #im-mobile-home .im-page-controls button{display:grid;place-items:center;width:28px;height:29px;border:1px solid #e0e0e0;border-radius:5px;background:white;color:#333;font-weight:700}
  #im-mobile-home .im-page-controls button:disabled{opacity:.45}
  #im-mobile-home .im-page-track{width:154px;height:7px;background:#dedede;border-radius:3px;overflow:hidden}
  #im-mobile-home .im-page-fill{display:block;width:33.333%;height:100%;background:#2886ee;transition:transform .2s ease}
  #im-mobile-home .im-page-label{color:#555;font-size:14px;white-space:nowrap}
  #im-mobile-home .im-trends{padding:0 12px}#im-mobile-home .im-trends h2{margin-bottom:12px}
  #im-mobile-home .im-trend-list{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:0 2px 9px 0}#im-mobile-home .im-trend-list::-webkit-scrollbar{display:none}
  #im-mobile-home .im-trend-card{position:relative;flex:0 0 285px;height:245px;scroll-snap-align:start;border:1px solid #eee;border-radius:13px;background:#fff;box-shadow:0 1px 7px #0002;padding:17px;overflow:hidden}
  #im-mobile-home .im-trend-head{display:flex;gap:10px;align-items:start}#im-mobile-home .im-trend-icon{width:33px;height:33px;object-fit:cover;border-radius:6px}
  #im-mobile-home .im-trend-name{font-weight:700;white-space:nowrap}#im-mobile-home .im-trend-name span{color:#4389c3;font-size:12px;font-weight:400;margin-left:4px}
  #im-mobile-home .im-trend-sub{font-size:12px;color:#777}#im-mobile-home .im-trend-price{font-size:17px;font-weight:700;margin-top:8px}#im-mobile-home .im-trend-price small{font-size:11px;color:#4590c9;font-weight:400}
  #im-mobile-home .im-chart{position:absolute;right:0;bottom:0;width:85%;height:75px}#im-mobile-home .im-chart svg{width:100%;height:100%}
  #im-mobile-home .im-trend-more{position:absolute;left:17px;bottom:17px;z-index:1;background:#303030;color:#fff!important;padding:6px 9px;border-radius:4px;font-size:14px}
  #im-mobile-home .im-guide{margin:22px 12px 29px;min-height:53px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:#f8f9fe;border-radius:12px;padding:8px 13px}
  #im-mobile-home .im-guide strong{font-size:16px;font-weight:500;letter-spacing:-.5px;white-space:nowrap}#im-mobile-home .im-guide strong span{display:inline-grid;place-items:center;background:#7798e5;color:#fff;border-radius:50%;width:20px;height:20px;margin-right:7px;font-size:14px;font-weight:700}
  #im-mobile-home .im-guide a{border:1px solid #e8e8e8;border-radius:9px;background:#fff;color:#666;padding:5px 8px;font-size:13px;white-space:nowrap}
  #im-mobile-home .im-trust{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 12px}#im-mobile-home .im-trust div{text-align:center;min-width:0;min-height:76px;padding:9px 7px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #eee;border-radius:10px;box-shadow:0 1px 6px #0002;background:#fff;overflow:hidden}
  #im-mobile-home .im-trust strong{font-size:clamp(13px,3.25vw,15px);line-height:1.3;letter-spacing:-.6px;overflow-wrap:anywhere;word-break:keep-all}#im-mobile-home .im-trust span{color:#646464;font-size:clamp(12px,3.1vw,14px);line-height:1.35;overflow-wrap:anywhere;word-break:keep-all}
  #im-mobile-home .im-notice{margin:34px 12px 46px;min-height:50px;background:#383838;color:#fff;border-radius:12px;display:flex;align-items:center;gap:14px;padding:10px 20px;font-size:14px;line-height:1.4}
  #im-mobile-home .im-notice span{min-width:0;overflow-wrap:anywhere;word-break:keep-all}
  #im-mobile-home .im-notice svg{width:24px;height:24px;flex:none;stroke:white;stroke-width:1.5;fill:none}
  #im-mobile-home .im-footer{border-top:1px solid #eee;font-size:14px}#im-mobile-home .im-policies{height:61px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #e5e5e5;gap:4px}
  #im-mobile-home .im-policies a{white-space:nowrap;font-size:14px}#im-mobile-home .im-policies a:nth-of-type(2){color:#246f9c}#im-mobile-home .im-policies i{height:15px;width:1px;background:#eee}
  #im-mobile-home .im-support{padding:22px 12px 50px;display:flex;align-items:center;justify-content:space-between}
  #im-mobile-home .im-support strong{font-size:24px;line-height:1.1}#im-mobile-home .im-support span{display:block;color:#666;font-size:14px}
  #im-mobile-home .im-badges{display:flex;align-items:center;gap:5px}#im-mobile-home .im-badges img{width:43px;height:43px;object-fit:contain}
  #im-mobile-home .im-company-toggle{margin:0 12px 29px;border:0;padding:0;background:none;font-size:15px;font-weight:700;color:#242424}#im-mobile-home .im-company-details{display:none;margin:0 12px 12px;color:#666;font-size:12px}#im-mobile-home .im-company-details.is-open{display:block}
  #im-mobile-home .im-copy{margin:0 12px 18px;color:#26719e;font-size:14px}#im-mobile-home .im-disclaimer{margin:0 12px;border-top:1px solid #e8e8e8;padding-top:18px;line-height:1.35;font-size:14px;color:#272727}
  #im-mobile-home .im-pc{display:inline-block;margin:10px 12px 11px;padding:4px 13px;border:1px solid #ddd;border-radius:13px;font-size:13px;background:#fff}
  #im-mobile-home .im-bottom-nav{position:fixed!important;z-index:2147483000;left:0;right:0;bottom:0;height:78px;background:linear-gradient(100deg,#2187ed 0%,#128cc2 49%,#00ae72 100%);display:grid;grid-template-columns:repeat(5,1fr);align-items:center;color:white;box-shadow:0 -1px 5px #0002}
  #im-mobile-home .im-bottom-nav a,#im-mobile-home .im-bottom-nav button{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;color:#fff;background:none;border:0;font-size:13px;padding:5px 0}
  #im-mobile-home .im-bottom-nav svg{width:28px;height:28px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}#im-mobile-home .im-bottom-nav .im-home-icon{fill:#fff;stroke:#fff}
  #im-mobile-home .im-bottom-nav .im-center{width:72px;height:72px;border-radius:50%;background:#fff;color:#333;box-shadow:0 1px 5px #0004;justify-self:center;align-self:start;transform:translateY(-10px)}#im-mobile-home .im-bottom-nav .im-center svg{width:35px;height:35px;stroke:#3b3b3b;stroke-width:2.4}
  @media (max-width:420px){
    #im-mobile-home .im-brand{gap:8px}#im-mobile-home .im-brand img{width:91px;height:32px}#im-mobile-home .im-brand span{font-size:18px}
    #im-mobile-home .im-header-actions{gap:8px}#im-mobile-home .im-heart svg{width:25px;height:25px}#im-mobile-home .im-register{width:86px;font-size:12px}
    #im-mobile-home .im-policies a{font-size:12px}
  }
  @media (max-width:360px){
    #im-mobile-home .im-brand span{display:none}
    #im-mobile-home .im-guide{flex-wrap:wrap;justify-content:flex-start;gap:5px 10px}
    #im-mobile-home .im-guide a{margin-left:26px}
    #im-mobile-home .im-policies{height:auto;min-height:61px;padding:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    #im-mobile-home .im-policies i{display:none}
  }
  #im-mobile-home :focus-visible{outline:2px solid #116ac2;outline-offset:2px}
}
</style>
<div id="im-mobile-home">
  <header class="im-header"><a class="im-brand" href="/">${image(logo, "아이템매니아")}<span>아이템매니아</span></a><div class="im-header-actions"><button class="im-heart" type="button" aria-label="찜목록" id="im-favorite">${heart}</button><a class="im-register" href="/sell/register.html"><b>+</b> 상품등록</a></div></header>
  <section class="im-search-section"><h1>No.1 게임 마켓플레이스</h1><form class="im-search-form" id="im-game-search"><input id="im-search-input" name="q" placeholder="제위" aria-label="게임 검색" autocomplete="off"><button type="submit">검색</button></form><div class="im-search-error" id="im-search-error" role="alert"></div></section>
  <div class="im-separator"></div>
  <section class="im-ranking"><h2>거래 상위 게임 TOP 10</h2><div class="im-game-grid" id="im-game-grid">${cards}<button class="im-rank-arrow im-rank-arrow-left" id="im-rank-prev" type="button" aria-label="이전 게임">‹</button><button class="im-rank-arrow im-rank-arrow-right" id="im-rank-next" type="button" aria-label="다음 게임">›</button></div><div class="im-page-controls"><button id="im-prev" type="button" aria-label="이전 게임">‹</button><span class="im-page-track"><span class="im-page-fill" id="im-page-fill"></span></span><span class="im-page-label" id="im-page-label">1 / 3</span><button id="im-next" type="button" aria-label="다음 게임">›</button></div></section>
  <section class="im-trends"><h2>인기 시세트렌드</h2><div class="im-trend-list">${trendCards}</div></section>
  <section class="im-guide"><strong><span>?</span>게임거래, 처음이라면?</strong><a href="/customer">안전거래 가이드 보기 ›</a></section>
  <section class="im-trust"><div><strong>23년간 업계 연속 1위</strong><span>부동의 TOP 거래 사이트</span></div><div><strong>1,100만 회원의 선택</strong><span>누적 거래 1억 2천만 건</span></div><div><strong>정보보호관리 체계 인증 획득</strong><span>업계 최초 ISMS 인증</span></div><div><strong>안전결제 에스크로서비스</strong><span>24시간 모니터링</span></div></section>
  <div class="im-notice"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l7-4v14l-7-4H3zM17 8c2 2 2 6 0 8m2-11c4 4 4 10 0 14"/></svg><span>2026년 추석 연휴 상품권몰 취소 업무 중단 안내</span></div>
  <footer class="im-footer"><nav class="im-policies"><a href="/customer">이용약관</a><i></i><a href="/customer">개인정보 처리방침</a><i></i><a href="/customer">청소년 보호정책</a><i></i><a href="/customer">고객센터</a></nav>
    <div class="im-support"><div><strong>1544-8278</strong><span>365일 24시간 연중무휴</span></div><div class="im-badges">${image(isms, "ISMS 인증")}${image(danal, "다날 결제 인증")}</div></div>
    <button class="im-company-toggle" id="im-company-toggle" type="button" aria-expanded="false">(주)아이엠아이 ⌄</button><div class="im-company-details" id="im-company-details">아이템매니아 운영사 · (주)아이엠아이</div>
    <div class="im-copy">Copyright © IMI. All rights reserved.</div><div class="im-disclaimer">아이템매니아는 통신판매중개자이며 통신판매의 당사자가 아닙니다. 따라서 아이템매니아는 상품 거래정보 및 거래에 대하여 책임을 지지 않습니다.</div><a class="im-pc" href="/?pc=1">PC버전</a>
  </footer>
  <nav class="im-bottom-nav" aria-label="하단 메뉴"><a href="/" aria-label="홈">${home.replace('viewBox=', 'class="im-home-icon" viewBox=')}<span>홈</span></a><a href="/myroom/chat/list.html" aria-label="채팅">${chat}<span>채팅</span></a><button class="im-center" id="im-bottom-search" type="button" aria-label="게임 검색">${magnifier}</button><a href="/myroom/index.html" aria-label="마이룸">${user}<span>마이룸</span></a><button id="im-menu-button" type="button" aria-label="메뉴" aria-expanded="false">${bars}<span>메뉴</span></button></nav>
   ${mobileMenuMarkup()}
</div>
<script>
(function(){
  var root=document.getElementById('im-mobile-home'); if(!root)return;
  if(new URLSearchParams(location.search).get('mobile')==='1'){
    root.querySelectorAll('a[href="/myroom/chat/list.html"]').forEach(function(a){a.href='/myroom/chat/list.html?mobile=1'});
    root.querySelectorAll('a[href="/myroom/index.html"]').forEach(function(a){a.href='/myroom/index.html?mobile=1'});
    root.querySelectorAll('a[href="/"]').forEach(function(a){a.href='/?mobile=1'});
  }
  var cards=Array.prototype.slice.call(root.querySelectorAll('.im-game')),page=0;
  function renderPage(){cards.forEach(function(card,index){card.style.display=(index>=page*3 && index<page*3+6)?'block':'none'});
    root.querySelector('#im-page-label').textContent=(page+1)+' / 3';
    root.querySelector('#im-page-fill').style.transform='translateX('+(page*100)+'%)';
    root.querySelector('#im-prev').disabled=page===0;root.querySelector('#im-next').disabled=page===2;
    root.querySelector('#im-rank-prev').disabled=page===0;root.querySelector('#im-rank-next').disabled=page===2;
  }
  root.querySelector('#im-prev').addEventListener('click',function(){page=Math.max(0,page-1);renderPage()});
  root.querySelector('#im-next').addEventListener('click',function(){page=Math.min(2,page+1);renderPage()});
  root.querySelector('#im-rank-prev').addEventListener('click',function(){root.querySelector('#im-prev').click()});
  root.querySelector('#im-rank-next').addEventListener('click',function(){root.querySelector('#im-next').click()});renderPage();
  root.querySelector('#im-game-search').addEventListener('submit',async function(event){
    event.preventDefault();var input=root.querySelector('#im-search-input'),error=root.querySelector('#im-search-error'),q=input.value.trim();
    if(!q){error.textContent='게임 이름을 입력해 주세요.';input.focus();return}error.textContent='';
    try{var response=await fetch('/api/games/search?q='+encodeURIComponent(q),{credentials:'include'});
      if(!response.ok)throw new Error('검색 요청에 실패했습니다.');
      var result=await response.json();if(!Array.isArray(result))throw new Error('검색 결과를 확인할 수 없습니다.');
      if(!result.length){error.textContent='검색 결과가 없습니다. 다른 게임 이름으로 검색해 주세요.';return}
      var exact=result.find(function(g){return g.name===q})||result[0],code=exact.code||exact.id;
      if(!code){error.textContent='게임 정보를 확인할 수 없습니다.';return}
      window.location.href='/sell/list.html?search_game='+encodeURIComponent(String(code));
    }catch(e){error.textContent='검색에 실패했습니다. 잠시 후 다시 시도해 주세요.'}
  });
  root.querySelector('#im-bottom-search').addEventListener('click',function(){window.location.href='/mobile-game-search?mode=search'+(new URLSearchParams(location.search).get('mobile')==='1'?'&mobile=1':'')});
   root.querySelector('#im-favorite').addEventListener('click',function(){window.location.href='/myroom/index.html'+(new URLSearchParams(location.search).get('mobile')==='1'?'?mobile=1':'')});
  root.querySelector('#im-company-toggle').addEventListener('click',function(){var details=root.querySelector('#im-company-details'),open=details.classList.toggle('is-open');this.setAttribute('aria-expanded',String(open))});
})();
 </script>${mobileMenuScript("im-menu-button")}`;
}