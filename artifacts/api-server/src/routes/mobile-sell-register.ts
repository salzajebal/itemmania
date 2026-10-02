import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mobileMenuMarkup, mobileMenuScript, mobileMenuStyles } from "./mobile-menu";
import { mobileSellItemFooter, mobileSellItemMarkup, mobileSellItemScript, mobileSellItemStyles } from "./mobile-sell-item";
import { mobileSellAccountMarkup, mobileSellAccountScript, mobileSellAccountStyles } from "./mobile-sell-account";

const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const icon = (body: string): string => `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
const arrows = icon('<path d="M27 16H5m0 0 9-9m-9 9 9 9"/>');
const home = icon('<path d="m4 14 12-10 12 10v14h-9v-9h-6v9H4Z"/>');
const chat = icon('<path d="M16 4C9 4 4 8 4 14c0 3 1 5 3 7l-1 6 7-3c1 .3 2 .4 3 .4 7 0 12-4 12-10S23 4 16 4Z"/><circle cx="11" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="21" cy="14" r="1"/>');
const search = icon('<circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/>');
const person = icon('<circle cx="16" cy="10" r="5"/><path d="M5 29c0-7 4-11 11-11s11 4 11 11"/>');
const menu = icon('<path d="M4 8h24M4 16h24M4 24h24"/>');

/**
 * Standalone mobile-only registration / game-money entry screen.
 * assetDir is the filesystem path to static/mobile-sell-assets; artwork is
 * embedded, so the caller need not expose an additional public asset route.
 * Registration is confirmed before it is persisted and shown in the matching list.
 */
export function renderMobileSellRegister(
  game: { name: string; code: string; servers: string[] },
  assetDir: string,
  mode: "sell" | "buy" = "sell",
): string {
  const buy = mode === "buy";
  const art = (name: string): string => `data:image/png;base64,${readFileSync(join(assetDir, `${name}.png`)).toString("base64")}`;
  const assets = Object.fromEntries(
    ["sell", "buy", "meso", "item", "account", "other", "isms", "danal"].map(name => [name, art(name)]),
  );
  const servers = [...new Set(game.servers.filter((server): server is string => typeof server === "string" && !!server.trim()).map(server => server.trim()))];
  const selectedServer = servers.includes("일반") ? "일반" : (servers[0] ?? "");
  const mapleland = game.name === "메이플랜드" || game.code === "5990";
  const category = (key: string, label: string) =>
    `<button type="button" class="msr-category msr-${key}" data-category="${key}" aria-pressed="${key === "meso"}" data-testid="button-category-${key}"><img src="${assets[key]}" alt=""><span>${label}</span></button>`;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>상품등록 | 아이템매니아</title>
  ${mobileMenuStyles()}${mobileSellItemStyles()}${buy ? "" : mobileSellAccountStyles()}<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;background:#fff;color:#202124}
body{font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;letter-spacing:-.045em;font-size:16px}
button,input{font:inherit}button{cursor:pointer}a{text-decoration:none;color:inherit}
#im-mobile-sell-register{min-height:100dvh;padding-bottom:calc(78px + env(safe-area-inset-bottom));overflow:hidden}
#im-mobile-sell-register :focus-visible{outline:2px solid #168ad1;outline-offset:2px}
.msr-header{height:65px;border-bottom:1px solid #f0f0f0;position:relative;display:flex;align-items:center;justify-content:center;background:#fff}
.msr-header h1{margin:0;font-size:21px;font-weight:750;letter-spacing:-.065em}
.msr-back{position:absolute;left:4px;top:0;height:65px;width:47px;display:grid;place-items:center;border:0;background:transparent;color:#222}
.msr-back svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.msr-fields{padding:40px 18px 0}
.msr-section{margin:0}
.msr-section h2{font-size:18px;font-weight:750;line-height:24px;margin:0 0 14px;letter-spacing:-.06em}
.msr-choice{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.msr-mode{height:65px;border-radius:17px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:18px;font-weight:750;box-shadow:0 1px 5px #00000017}
.msr-mode img{width:48px;height:44px;object-fit:contain;mix-blend-mode:multiply}
.msr-mode-sell{border:2px solid #159aec;background:#1a9df0;color:#fff}
.msr-mode-sell img{mix-blend-mode:normal}
.msr-mode-buy{border:2px solid #20913b;background:#fff;color:#259a3a}
.msr-kind{margin-top:40px}
.msr-kind{scroll-margin-top:31px}
.msr-category-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}
.msr-category{height:102px;padding:8px 2px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:2px solid transparent;border-radius:12px;background:#eff0fc;color:#141414;font-size:17px;font-weight:750;box-shadow:0 2px 5px #00000008}
.msr-category img{display:block;height:56px;width:60px;object-fit:contain;mix-blend-mode:multiply}
.msr-category span{line-height:24px}.msr-meso{background:#f0ebf8}.msr-item{background:#eaf2fd}.msr-account{background:#f0f0fc}.msr-other{background:#fff6e8}
.msr-category[aria-pressed="true"]{border-color:#2598c2;box-shadow:0 1px 5px #308eb23b}
.msr-game{margin-top:43px}
.msr-game h2,.msr-type h2,.msr-quantity h2,.msr-price h2{margin-bottom:14px}
.msr-select{width:100%;height:54px;padding:0 12px;border:2px solid #2a98bf;border-radius:10px;box-shadow:0 1px 4px #2894ba32;background:#fff;color:#262626;text-align:left;font-size:18px}
.msr-server-list{margin:7px 0 0;padding:5px;border:1px solid #bdd4df;border-radius:10px;box-shadow:0 5px 20px #1d516024;max-height:240px;overflow:auto}
.msr-server-list[hidden]{display:none}
.msr-server-option{display:block;width:100%;border:0;border-radius:6px;padding:11px 10px;background:#fff;text-align:left;color:#202124}
.msr-server-option[aria-selected="true"],.msr-server-option:hover{background:#e7f5fa;color:#1585ae}
.msr-server-empty{padding:11px;color:#656d73}
 .msr-type{margin-top:42px;scroll-margin-top:42px}
.msr-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.msr-type-grid button{height:54px;border:1px solid #363636;border-radius:10px;background:#fff;color:#161616;font-size:17px;font-weight:750}
.msr-type-grid button[aria-pressed="true"]{border:2px solid #2b9ac2;box-shadow:0 1px 5px #3494bc35}
.msr-quantity{margin-top:41px}
.msr-input-wrap{width:100%;height:55px;display:flex;align-items:center;border:1px solid #515151;border-radius:11px;overflow:hidden;box-shadow:0 1px 4px #00000010}
.msr-input-wrap:focus-within{border-color:#228fbd;box-shadow:0 0 0 1px #228fbd}
.msr-input-wrap input{width:100%;min-width:0;flex:1;height:100%;padding:0 10px;border:0;outline:0;background:transparent;text-align:right;color:#242424;font-size:18px}
.msr-input-wrap input::placeholder{color:#a4a4a4;opacity:1}
.msr-input-wrap .msr-unit{flex:none;padding:0 12px 0 13px;border-left:1px solid #5e5e5e;line-height:23px;font-size:18px}
.msr-price{margin-top:40px}
.msr-price .msr-unit{border:0;padding-left:4px}
.msr-validation{margin:5px 0 0;color:#b44841;font-size:13px;line-height:18px}
.msr-validation:empty{display:none}
.msr-calculation{margin:10px 0 0;font-size:16px;line-height:22px;color:#222}
.msr-calculation strong{font-weight:750}.msr-calculation .msr-net{margin-left:10px}
.msr-quote{margin:8px 0 0;font-size:15px;line-height:23px;color:#333}
.msr-quote strong{color:#b2484b;font-size:16px}.msr-quote .msr-drop{color:#188fc0;font-weight:700}.msr-quote small{font-size:13px;color:#777}
.msr-quote-note{margin:0;font-size:11px;color:#777;line-height:16px}
.msr-warnings{margin:34px 0 0;padding:0;list-style:none}
.msr-warnings li{display:flex;gap:7px;align-items:flex-start;margin:0 0 10px;font-size:15px;line-height:19px;letter-spacing:-.055em}
.msr-check{flex:none;width:18px;height:18px;margin-top:1px;color:#2099c5;font-weight:900;font-size:23px;line-height:17px}
.msr-unavailable{display:none;margin:13px 0 0;padding:12px 14px;background:#eef7fb;border-radius:8px;color:#28546b;font-size:14px;line-height:1.4}
.msr-unavailable.is-visible{display:block}
.msr-footer{margin-top:137px;background:#fff;font-size:14px}
.msr-policies{display:flex;align-items:center;justify-content:space-between;min-height:59px;padding:0 12px;gap:4px;border-top:1px solid #eee;border-bottom:1px solid #ddd}
.msr-policies a{white-space:nowrap;font-size:14px}.msr-policies a:nth-of-type(2){color:#24739f;font-weight:650}
.msr-policies i{display:block;width:1px;height:16px;background:#e9e9e9;flex:none}
.msr-support{min-height:91px;display:flex;justify-content:space-between;align-items:center;padding:11px 12px}
.msr-support strong{display:block;font-size:24px;line-height:29px;letter-spacing:-.03em}
.msr-support span{display:block;color:#6f6f6f;font-size:14px;white-space:nowrap}
.msr-badges{display:flex;align-items:center;gap:6px}
.msr-badges img{display:block;width:47px;height:47px;object-fit:contain}
.msr-bottom{position:fixed;z-index:30;left:0;right:0;bottom:0;height:calc(78px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);display:grid;grid-template-columns:repeat(5,1fr);align-items:center;background:linear-gradient(100deg,#2187ed 0%,#128cc2 49%,#00ae72 100%);color:#fff;box-shadow:0 -1px 5px #0002}
.msr-bottom a,.msr-bottom button{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;color:#fff;background:none;border:0;font-size:13px;text-decoration:none;padding:5px 0}
.msr-bottom svg{display:block;width:28px;height:28px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.msr-bottom .msr-home-icon{fill:#fff;stroke:#fff}
.msr-bottom .msr-center{width:72px;height:72px;border-radius:50%;background:#fff;color:#333;box-shadow:0 1px 5px #0004;justify-self:center;align-self:start;transform:translateY(-10px)}
.msr-bottom .msr-center svg{width:35px;height:35px;stroke:#3b3b3b;stroke-width:2.4}
 #im-mobile-sell-register.is-buy .msr-mode-sell{background:#fff;color:#2298bd}
 #im-mobile-sell-register.is-buy .msr-mode-sell img{clip-path:polygon(10% 10%,32% 10%,37% 15%,42% 5%,65% 5%,74% 22%,94% 31%,95% 49%,81% 77%,48% 96%,24% 83%,11% 62%)}
 #im-mobile-sell-register.is-buy .msr-mode-buy{background:#1d9d21;color:#fff}
 #im-mobile-sell-register.is-buy .msr-mode-buy img{mix-blend-mode:normal;clip-path:polygon(13% 14%,48% 9%,58% 20%,70% 30%,90% 31%,97% 58%,79% 92%,51% 97%,29% 78%,12% 57%)}
 #im-mobile-sell-register.is-buy .msr-kind{margin-top:42px}
 #im-mobile-sell-register.is-buy .msr-kind h2{margin-bottom:18px}
 #im-mobile-sell-register.is-buy .msr-category[aria-pressed="true"]{border-color:#309638;box-shadow:0 1px 5px #2c913c3b}
 #im-mobile-sell-register.is-buy .msr-select,
 #im-mobile-sell-register.is-buy .msr-type-grid button[aria-pressed="true"]{border-color:#309638;box-shadow:0 1px 5px #2c913c3b}
 #im-mobile-sell-register.is-buy .msr-input-wrap:focus-within{border-color:#309638;box-shadow:0 0 0 1px #309638}
 #im-mobile-sell-register.is-buy .msr-server-option[aria-selected="true"],
 #im-mobile-sell-register.is-buy .msr-server-option:hover{background:#eef9ed;color:#248a2e}
 #im-mobile-sell-register.is-buy .msr-drop,
 #im-mobile-sell-register.is-buy .msr-check{color:#269a3d}
 #im-mobile-sell-register.is-buy .msr-warnings{margin-top:34px}
 #im-mobile-sell-register.is-buy .msr-warnings li{font-size:16px}
 #im-mobile-sell-register.is-buy .msr-drop,
 #im-mobile-sell-register.is-buy .msr-quote small{margin-left:3px}
 #im-mobile-sell-register.is-buy .msr-footer{margin-top:77px}
 .msr-buy-account-price{display:none}
 #im-mobile-sell-register.is-buy.is-account .msr-type,
 #im-mobile-sell-register.is-buy.is-account .msr-quantity,
 #im-mobile-sell-register.is-buy.is-account .msr-meso-price{display:none}
 #im-mobile-sell-register.is-buy.is-account .msr-buy-account-price{display:block}
 #im-mobile-sell-register.is-buy.is-item:not(.buy-detail) .msi-only{display:none}
 #im-mobile-sell-register.is-buy.is-item:not(.buy-detail) .msr-type-grid button[aria-pressed="true"]{border:1px solid #363636;box-shadow:none}
 #im-mobile-sell-register.is-buy.is-item:not(.buy-detail) .msr-buy-item-start{margin-top:50px}
 #im-mobile-sell-register.is-buy.is-item.buy-detail .msr-type{scroll-margin-top:10px}
 #im-mobile-sell-register.is-buy.is-item .msi-description{scroll-margin-top:13px}
 #im-mobile-sell-register.is-buy.is-other .msi-description{scroll-margin-top:36px;margin-top:39px}
 #im-mobile-sell-register.is-buy.is-other .msi-price .msr-input-wrap input{font-size:17px}
 #im-mobile-sell-register.is-buy.is-other .msi-price .msr-unit{padding-right:24px}
 #im-mobile-sell-register.is-buy.is-other .msi-character-row{gap:8px;padding-right:4px}
 #im-mobile-sell-register.is-buy.is-other .msi-banner{margin-top:45px;font-size:18px}
 #im-mobile-sell-register.is-buy.is-other .msi-title{margin-top:16px}
 #im-mobile-sell-register.is-buy.is-other .msi-title-line h2{margin-bottom:20px}
 #im-mobile-sell-register.is-buy.is-other .msi-next{width:calc(100% + 12px);margin-left:-6px}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-title-input,
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-editor{border-color:#309638;box-shadow:0 1px 4px #2c913c32}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-character-row input:focus{border-color:#309638}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-save,
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-banner,
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-next,
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-dialog-actions button:last-child{background:#159f45}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-banner{font-size:17px;box-shadow:0 1px 5px #209c4a40}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-price .msr-warnings{margin-top:34px}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msr-warnings.msi-post-warnings{margin-top:18px}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msr-warnings li{letter-spacing:-.02em}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-post-warnings li:first-child,
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-post-warnings li:first-child .msr-check{color:#c93840}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-next{margin-top:49px;box-shadow:0 2px 6px #248c2440}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-toolbar{column-gap:21px;padding-left:15px;padding-right:7px}
 #im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-toolbar select{width:110px}
 #im-mobile-sell-register.is-buy.is-item:not(.buy-detail) .msr-buy-item-start{display:block}
 .msr-buy-next{display:block;width:100%;height:72px;margin:55px 0 0;border:0;border-radius:15px;background:#1b9d21;color:#fff;font-size:22px;font-weight:750;box-shadow:0 2px 6px #248c2440}
  #im-mobile-sell-register:not(.is-buy) .msr-buy-next{background:#1c9eef;box-shadow:0 2px 6px #128fc13b}
 #im-mobile-sell-register .msr-buy-item-start{display:none}
 .msr-buy-message{margin:12px 0 0;font-size:14px;color:#267e34;line-height:1.4}
 .msr-buy-message:empty{display:none}
  .msr-review{width:min(390px,calc(100% - 32px));max-height:85dvh;overflow:auto;padding:24px;border:0;border-radius:16px;box-shadow:0 15px 45px #0005;color:#252525;font-family:inherit}
  .msr-review::backdrop{background:#0008}
  .msr-review h2{margin:0 0 18px;font-size:21px}
  .msr-review dl{margin:0 0 14px;display:grid;grid-template-columns:90px minmax(0,1fr);gap:13px 6px;font-size:15px;line-height:1.4}
  .msr-review dt{color:#6b7074}.msr-review dd{margin:0;overflow-wrap:anywhere}
  .msr-review-note{font-size:13px;line-height:1.5;color:#666;margin:10px 0 0}
  .msr-review-error{color:#b44841;font-size:14px;min-height:20px;margin:12px 0 0}
  .msr-review-actions{display:flex;gap:8px;margin-top:12px}
  .msr-review-actions button{flex:1;height:48px;border:1px solid #cdd1d4;border-radius:9px;background:#fff;color:#222;font-size:16px;font-weight:700}
  .msr-review-actions button:last-child{border:0;background:#1c9eef;color:#fff}
  .msr-review.is-buy .msr-review-actions button:last-child{background:#1b9d21}
  .msr-review-actions button:disabled{opacity:.6;cursor:wait}
 @media(max-width:390px){#im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-banner{font-size:14px}#im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-toolbar{column-gap:10px;padding-left:11px}#im-mobile-sell-register.is-buy:is(.is-item,.is-other) .msi-toolbar select{width:86px}}
@media(max-width:390px){.msr-fields{padding-left:14px;padding-right:14px}.msr-category-grid{gap:7px}.msr-category{font-size:15px}.msr-policies{padding:0 7px}.msr-policies a{font-size:11px}.msr-badges img{width:40px;height:40px}}
 </style></head><body><main id="im-mobile-sell-register"${buy ? ' class="is-buy"' : ""}>
<header class="msr-header"><button type="button" class="msr-back" id="msr-back" aria-label="게임 검색으로 돌아가기" data-testid="button-back">${arrows}</button><h1>상품등록</h1></header>
<div class="msr-fields">
 <section class="msr-section"><h2>거래방법을 선택해주세요.</h2><div class="msr-choice">${buy ? `<a class="msr-mode msr-mode-sell" data-preview-link href="/sell/register.html?search_game=${encodeURIComponent(game.code)}" data-testid="link-sell"><img src="${assets.sell}" alt="">팝니다</a><button class="msr-mode msr-mode-buy" type="button" aria-pressed="true" data-testid="button-buy"><img src="${assets.buy}" alt="">삽니다</button>` : `<button class="msr-mode msr-mode-sell" type="button" aria-pressed="true" data-testid="button-sell"><img src="${assets.sell}" alt="">팝니다</button><a class="msr-mode msr-mode-buy" data-preview-link href="/buy/register.html?search_game=${encodeURIComponent(game.code)}" data-testid="link-buy"><img src="${assets.buy}" alt="">삽니다</a>`}</div></section>
<section class="msr-section msr-kind" id="msr-categories"><h2>상품종류를 선택해주세요.</h2><div class="msr-category-grid">${category("meso", "메소")}${category("item", "아이템")}${category("account", "계정")}${category("other", "기타")}</div><p id="msr-category-notice" class="msr-unavailable" role="status" aria-live="polite"></p></section>
<section class="msr-section msr-game"><h2>게임 및 서버를 선택해주세요.</h2><button id="msr-select" class="msr-select" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="msr-servers" data-testid="button-select-server">${escapeHtml(game.name)} &gt; ${escapeHtml(selectedServer || "서버 선택")}</button><div id="msr-servers" class="msr-server-list" role="listbox" aria-label="서버 선택" hidden>${servers.length ? servers.map((server, index) => `<button class="msr-server-option" type="button" role="option" aria-selected="${server === selectedServer}" data-server-index="${index}" data-testid="button-server-${index}">${escapeHtml(server)}</button>`).join("") : '<div class="msr-server-empty">선택 가능한 서버가 없습니다.</div>'}</div></section>
  <section class="msr-section msr-type" id="msr-type-section"><h2>거래 유형을 선택해주세요.</h2><div class="msr-type-grid" id="msr-trade-type-options" role="group" aria-label="거래 유형"><button type="button" data-trade="normal" aria-pressed="true" data-testid="button-normal">일반</button><button type="button" data-trade="split" aria-pressed="false" data-testid="button-split">분할</button></div></section>
 ${buy ? '<button type="button" id="msr-buy-item-start" class="msr-buy-next msr-buy-item-start" data-testid="button-buy-item-start">다음</button>' : ""}
 <section class="msr-section msr-quantity"><h2><label for="msr-qty">${buy ? "구매" : "판매"}수량을 입력해주세요.</label></h2><div class="msr-input-wrap"><input id="msr-qty" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-describedby="msr-qty-error" data-testid="input-quantity"><span class="msr-unit">개</span></div><p id="msr-qty-error" class="msr-validation" role="alert"></p></section>
 <section class="msr-section msr-price msr-meso-price"><h2><label for="msr-price">${buy ? "구매" : "판매"}금액을 입력해주세요.</label></h2><div class="msr-input-wrap"><input id="msr-price" type="text" inputmode="numeric" pattern="[0-9,]*" autocomplete="off" placeholder="(1,000원 이상, 10원 단위 입력 가능)" aria-describedby="msr-price-error" data-testid="input-price"><span class="msr-unit">원</span></div><p id="msr-price-error" class="msr-validation" role="alert"></p>${buy ? "" : '<p class="msr-calculation">수수료 5% : <strong id="msr-fee" data-testid="text-fee">0원</strong><span class="msr-net">실 수령액 : <strong id="msr-net" data-testid="text-net">0원</strong></span></p>'}
 <p class="msr-quote" ${mapleland ? 'title="스크린샷에 표시된 참고 시세로, 실시간 시세가 아닙니다."' : 'title="현재 시세 정보를 제공하지 않습니다."'}>${mapleland ? `평균 시세 <strong>1,930원</strong> <span class="msr-drop">(▼10)</span> <small>(전일기준 / 100만 당${buy ? "" : " · 참고 시세, 비실시간"})</small>` : '평균 시세 <small>시세 정보 없음</small>'}</p>
  <ul class="msr-warnings"><li><span class="msr-check" aria-hidden="true">✓</span><span>평균 시세보다 현저히 낮은 금액으로 등록할 경우, 거래 상대자 피해 및 시세조작등의 사유로 상품등록이 제한될 수 있습니다.</span></li>${buy ? "" : '<li><span class="msr-check" aria-hidden="true">✓</span><span>연간 기준으로 4,800만원 이상 판매 시 과세 대상에 포함될 수 있습니다.</span></li>'}</ul><button type="button" class="msr-buy-next" id="${buy ? "msr-buy-next" : "msr-sell-next"}" data-testid="button-${buy ? "buy" : "sell"}-next">다음</button><p class="msr-buy-message" id="${buy ? "msr-buy-message" : "msr-sell-message"}" role="status" aria-live="polite"></p></section>
  ${mobileSellItemMarkup(buy)}
 ${buy ? "" : mobileSellAccountMarkup()}
  ${buy ? `<section class="msr-section msr-price msr-buy-account-price" id="msr-buy-account-price-section"><h2><label for="msr-account-price">구매금액을 입력해주세요.</label></h2><div class="msr-input-wrap"><input id="msr-account-price" type="text" inputmode="numeric" pattern="[0-9,]*" autocomplete="off" placeholder="(1,000원 이상, 10원 단위 입력 가능)" aria-describedby="msr-account-price-error" data-testid="input-buy-account-price"><span class="msr-unit">원</span></div><p id="msr-account-price-error" class="msr-validation" role="alert"></p><ul class="msr-warnings"><li><span class="msr-check" aria-hidden="true">✓</span><span>평균 시세보다 현저히 낮은 금액으로 등록할 경우, 거래 상대자 피해 및 시세조작등의 사유로 상품등록이 제한될 수 있습니다.</span></li></ul><button type="button" class="msr-buy-next" id="msr-buy-account-next" data-testid="button-buy-account-next">다음</button><p class="msr-buy-message" id="msr-buy-account-message" role="status" aria-live="polite"></p></section>` : ""}
</div>
  <footer class="msr-footer"><nav class="msr-policies" aria-label="운영 정책"><a href="/customer">이용약관</a><i></i><a href="/customer">개인정보 처리방침</a><i></i><a href="/customer">청소년 보호정책</a><i></i><a href="/customer">고객센터</a></nav><div class="msr-support"><div><strong>1544-8278</strong><span>365일 24시간 연중무휴</span></div><div class="msr-badges"><img src="${assets.isms}" alt="ISMS 인증"><img src="${assets.danal}" alt="다날 결제 인증"></div></div>${mobileSellItemFooter(game.code, buy)}</footer>
 </main><dialog class="msr-review${buy ? " is-buy" : ""}" id="msr-review" aria-labelledby="msr-review-title"><h2 id="msr-review-title">물품등록정보</h2><dl id="msr-review-details"></dl><p class="msr-review-note">상세설명은 텍스트로 등록됩니다. 내용을 확인한 뒤 등록해 주세요.</p><p class="msr-review-error" id="msr-review-error" role="alert"></p><div class="msr-review-actions"><button type="button" id="msr-review-cancel">취소</button><button type="button" id="msr-review-submit" data-testid="button-final-register">등록하기</button></div></dialog><nav class="msr-bottom" aria-label="하단 메뉴"><a href="/" data-preview-link aria-label="홈" data-testid="link-home">${home.replace("<svg", '<svg class="msr-home-icon"')}<span>홈</span></a><a href="/myroom/chat/list.html" data-preview-link aria-label="채팅" data-testid="link-chat">${chat}<span>채팅</span></a><a href="/mobile-game-search?mode=search" data-preview-link class="msr-center" aria-label="게임 검색" data-testid="link-search">${search}</a><a href="/myroom/index.html" data-preview-link aria-label="마이룸" data-testid="link-myroom">${person}<span>마이룸</span></a><button id="msr-menu-button" type="button" aria-label="메뉴" aria-expanded="false" data-testid="button-menu">${menu}<span>메뉴</span></button></nav>
${mobileMenuMarkup()}
<script>
(function(){
   var params=new URLSearchParams(location.search),preview=params.get('mobile')==='1',isBuy=${buy};
  if(preview)document.querySelectorAll('[data-preview-link]').forEach(function(link){link.href+=(link.href.includes('?')?'&':'?')+'mobile=1'});
   document.getElementById('msr-back').addEventListener('click',function(){if(history.length>1)history.back();else location.href='/mobile-game-search?mode='+ (isBuy?'buy':'sell')+(preview?'&mobile=1':'')});
  var select=document.getElementById('msr-select'),list=document.getElementById('msr-servers'),servers=${JSON.stringify(servers).replace(/</g, "\\u003c")},gameName=${JSON.stringify(game.name).replace(/</g, "\\u003c")};
  select.addEventListener('click',function(){list.hidden=!list.hidden;select.setAttribute('aria-expanded',String(!list.hidden))});
  list.querySelectorAll('[data-server-index]').forEach(function(option){option.addEventListener('click',function(){var chosen=servers[Number(option.getAttribute('data-server-index'))];if(!chosen)return;select.textContent=gameName+' > '+chosen;list.querySelectorAll('[role="option"]').forEach(function(item){item.setAttribute('aria-selected',String(item===option))});list.hidden=true;select.setAttribute('aria-expanded','false');select.focus()})});
  document.addEventListener('click',function(event){if(!select.contains(event.target)&&!list.contains(event.target)){list.hidden=true;select.setAttribute('aria-expanded','false')}});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&!list.hidden){list.hidden=true;select.setAttribute('aria-expanded','false');select.focus()}});
   var notice=document.getElementById('msr-category-notice'),root=document.getElementById('im-mobile-sell-register');
    function chooseCategory(kind){
         if(isBuy&&kind!=='meso'&&kind!=='item'&&kind!=='account'&&kind!=='other'){notice.textContent='이 상품종류의 구매 등록 양식은 아직 제공되지 않습니다.';notice.classList.add('is-visible');return}
      if(kind==='meso'||kind==='item'||kind==='account'||kind==='other'){
        var previous=root.classList.contains('is-other')?'other':root.classList.contains('is-item')?'item':null;
        if(previous&&previous!==kind)captureSellDetail(previous);
        if((kind==='item'||kind==='other')&&previous!==kind)restoreSellDetail(kind);
         if(isBuy&&previous!==kind)root.classList.remove('buy-detail');
       root.classList.toggle('is-item',kind==='item');
        root.classList.toggle('is-account',kind==='account');
        root.classList.toggle('is-other',kind==='other');
       document.querySelectorAll('[data-category]').forEach(function(tile){tile.setAttribute('aria-pressed',String(tile.getAttribute('data-category')===kind))});
        notice.textContent='';notice.classList.remove('is-visible');
         if(kind==='meso'&&!qty.value&&!price.value){if(isBuy)restoreBuyMesoDraft();else restoreSellMesoDraft()}
        return;
     }
   }
   document.querySelectorAll('[data-category]').forEach(function(button){button.addEventListener('click',function(){chooseCategory(button.getAttribute('data-category'))})});
    var categoryParam=params.get('itemCategory')||params.get('category');
    var initialCategory=({게임머니:'meso',아이템:'item',계정:'account',기타:'other'})[categoryParam]||categoryParam;
  document.querySelectorAll('[data-trade]').forEach(function(button){button.addEventListener('click',function(){document.querySelectorAll('[data-trade]').forEach(function(other){other.setAttribute('aria-pressed',String(button===other))})})});
  var qty=document.getElementById('msr-qty'),price=document.getElementById('msr-price'),fee=document.getElementById('msr-fee'),net=document.getElementById('msr-net');
  function update(){
     var q=Number(qty.value.replace(/,/g,'')),p=Number(price.value.replace(/,/g,'')),validQ=/^[1-9]\\d*$/.test(qty.value.replace(/,/g,''))&&Number.isSafeInteger(q),validP=price.value!==''&&Number.isSafeInteger(p)&&p>=1000&&p%10===0;
    document.getElementById('msr-qty-error').textContent=qty.value&&!validQ?'1개 이상의 정수로 입력해 주세요.':'';
    document.getElementById('msr-price-error').textContent=price.value&&!validP?'1,000원 이상, 10원 단위로 입력해 주세요.':'';
    qty.setAttribute('aria-invalid',String(Boolean(qty.value&&!validQ)));price.setAttribute('aria-invalid',String(Boolean(price.value&&!validP)));
     var total=validP?p:0,charge=Math.round(total*.05);
     if(fee&&net){fee.textContent=charge.toLocaleString('ko-KR')+'원';net.textContent=(total-charge).toLocaleString('ko-KR')+'원'}
  }
  qty.addEventListener('input',function(){qty.value=qty.value.replace(/\\D/g,'');update()});
  price.addEventListener('input',function(){var raw=price.value.replace(/\\D/g,'');price.value=raw?Number(raw).toLocaleString('ko-KR'):'';update()});
   var gameCode=${JSON.stringify(game.code).replace(/</g, "\\u003c")},review=document.getElementById('msr-review'),reviewDraft=null,reviewSubmit=document.getElementById('msr-review-submit');
   function categoryLabel(kind){return {meso:'게임머니',item:'아이템',account:'계정',other:'기타'}[kind]||''}
   function showRegistrationReview(draft){
     if(!draft||!categoryLabel(draft.category)||!Number.isSafeInteger(draft.price)||draft.price<1000)return;
     reviewDraft=draft;
     var details=document.getElementById('msr-review-details');details.replaceChildren();
     var title=draft.title||gameName+' '+categoryLabel(draft.category)+(isBuy?' 삽니다':' 팝니다');
     [['거래방법',isBuy?'삽니다':'팝니다'],['게임',gameName],['서버',draft.serverName||'서버전체'],['상품종류',categoryLabel(draft.category)],['상품제목',title],['구매/판매금액',Number(draft.price).toLocaleString('ko-KR')+'원']].forEach(function(entry){
       var dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=entry[0];dd.textContent=entry[1];details.append(dt,dd);
     });
     if(draft.quantity){var dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='수량';dd.textContent=Number(draft.quantity).toLocaleString('ko-KR')+'개';details.append(dt,dd)}
     document.getElementById('msr-review-error').textContent='';
     reviewSubmit.disabled=false;review.showModal();
   }
   document.getElementById('msr-review-cancel').addEventListener('click',function(){review.close()});
   reviewSubmit.addEventListener('click',async function(){
     if(!reviewDraft||reviewSubmit.disabled)return;
     reviewSubmit.disabled=true;reviewSubmit.textContent='등록 중...';
     var error=document.getElementById('msr-review-error'),registered=false;
     error.textContent='';
     try{
       var meResponse=await fetch('/api/auth/me',{credentials:'include'});
       if(meResponse.status===401){try{sessionStorage.setItem('_im_login_next',location.href)}catch(e){}location.href='/login';return}
       if(!meResponse.ok)throw Error('로그인 상태를 확인할 수 없습니다.');
       var me=await meResponse.json(),draft=reviewDraft;
       var description=[];
       if(draft.quantity)description.push('수량: '+Number(draft.quantity).toLocaleString('ko-KR')+'개');
       if(draft.tradeType)description.push('거래 유형: '+(draft.tradeType==='split'?'분할':'일반'));
       if(draft.character)description.push('캐릭터명: '+draft.character);
       if(draft.shopName)description.push('상점명: '+draft.shopName);
       if(draft.description)description.push(draft.description);
       var response=await fetch('/api/products',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({
         title:draft.title||gameName+' '+categoryLabel(draft.category)+(isBuy?' 삽니다':' 팝니다'),
         price:draft.price,gameName:gameName,serverName:draft.serverName||'',category:isBuy?'buy':'sell',
         itemCategory:categoryLabel(draft.category),sellerName:me.nickname||me.email||'',description:description.join('\\n')
       })});
       var created=await response.json().catch(function(){return {}});
       if(response.status===401){try{sessionStorage.setItem('_im_login_next',location.href)}catch(e){}location.href='/login';return}
       if(!response.ok)throw Error(created.error||'등록에 실패했습니다.');
       if(!created.id)throw Error('등록 결과를 확인할 수 없습니다. 목록에서 등록 여부를 확인해 주세요.');
       registered=true;
       try{sessionStorage.removeItem('mobile-'+(isBuy?'buy':'sell')+'-'+draft.category+'-draft')}catch(e){}
       var target=new URLSearchParams({search_game:gameCode,itemCategory:categoryLabel(draft.category)});
       if(preview)target.set('mobile','1');
       location.replace('/'+(isBuy?'buy':'sell')+'/list.html?'+target.toString());
     }catch(e){error.textContent=e instanceof Error?e.message:'서버 오류가 발생했습니다.'}
     finally{if(!registered){reviewSubmit.disabled=false;reviewSubmit.textContent='등록하기'}}
   });
    ${mobileSellItemScript()}
     ${buy ? "" : mobileSellAccountScript()}
      document.getElementById(isBuy?'msr-buy-next':'msr-sell-next').addEventListener('click',function(){
       update();
        var message=document.getElementById(isBuy?'msr-buy-message':'msr-sell-message'),server=list.querySelector('[aria-selected="true"]');
       if(!qty.value||qty.getAttribute('aria-invalid')==='true'){document.getElementById('msr-qty-error').textContent='1개 이상의 정수로 입력해 주세요.';qty.focus();return}
       if(!price.value||price.getAttribute('aria-invalid')==='true'){document.getElementById('msr-price-error').textContent='1,000원 이상, 10원 단위로 입력해 주세요.';price.focus();return}
        var draft={category:'meso',mode:isBuy?'buy':'sell',gameCode:gameCode,serverName:server?server.textContent.trim():'',tradeType:document.querySelector('[data-trade][aria-pressed="true"]').getAttribute('data-trade'),quantity:Number(qty.value),price:Number(price.value.replace(/,/g,''))};
        try{sessionStorage.setItem('mobile-'+(isBuy?'buy':'sell')+'-meso-draft',JSON.stringify(draft))}catch(e){}
        message.textContent='';showRegistrationReview(draft);
     });
     function restoreSellMesoDraft(){if(isBuy)return;try{
       var saved=JSON.parse(sessionStorage.getItem('mobile-sell-meso-draft')||'null');
       if(saved&&saved.gameCode===gameCode&&saved.category==='meso'&&saved.mode==='sell'){
         if(Number.isSafeInteger(saved.quantity)&&saved.quantity>0)qty.value=String(saved.quantity);
         if(Number.isSafeInteger(saved.price)&&saved.price>=1000)price.value=saved.price.toLocaleString('ko-KR');
         if(saved.tradeType==='split')document.querySelector('[data-trade="split"]').click();
         var savedServer=Array.from(list.querySelectorAll('[data-server-index]')).find(function(el){return el.textContent.trim()===saved.serverName});
         if(savedServer)savedServer.click();update();
       }
     }catch(e){}}
     if(!isBuy&&(!initialCategory||initialCategory==='meso'))restoreSellMesoDraft();
      ${buy ? `
      document.getElementById('msr-buy-item-start').addEventListener('click',function(){
        root.classList.add('buy-detail');
        var section=document.getElementById('msr-type-section');
        window.scrollTo({top:window.scrollY+section.getBoundingClientRect().top-10,behavior:'instant'});
      });
      function restoreBuyMesoDraft(){try{var buyDraft=JSON.parse(sessionStorage.getItem('mobile-buy-meso-draft')||'null');
        if(buyDraft&&buyDraft.gameCode===params.get('search_game')&&buyDraft.category==='meso'&&buyDraft.mode==='buy'){
         if(Number.isSafeInteger(buyDraft.quantity)&&buyDraft.quantity>0)qty.value=String(buyDraft.quantity);
         if(Number.isSafeInteger(buyDraft.price)&&buyDraft.price>=1000)price.value=buyDraft.price.toLocaleString('ko-KR');
         if(buyDraft.tradeType==='split')document.querySelector('[data-trade="split"]').click();
         if(typeof buyDraft.serverName==='string'){var savedServer=Array.from(list.querySelectorAll('[data-server-index]')).find(function(el){return el.textContent.trim()===buyDraft.serverName});if(savedServer)savedServer.click()}
         update();
       }
      }catch(e){}}
       if(!initialCategory||initialCategory==='meso')restoreBuyMesoDraft();
       var accountPrice=document.getElementById('msr-account-price'),accountPriceError=document.getElementById('msr-account-price-error');
       function updateBuyAccountPrice(){
         var raw=accountPrice.value.replace(/,/g,''),amount=Number(raw),valid=raw!==''&&Number.isSafeInteger(amount)&&amount>=1000&&amount%10===0;
         accountPriceError.textContent=raw&&!valid?'1,000원 이상, 10원 단위로 입력해 주세요.':'';
         accountPrice.setAttribute('aria-invalid',String(Boolean(raw&&!valid)));
         return valid;
       }
       accountPrice.addEventListener('input',function(){var raw=accountPrice.value.replace(/\\D/g,'');accountPrice.value=raw?Number(raw).toLocaleString('ko-KR'):'';updateBuyAccountPrice()});
       document.getElementById('msr-buy-account-next').addEventListener('click',function(){
         var valid=updateBuyAccountPrice(),message=document.getElementById('msr-buy-account-message');
         if(!valid){accountPriceError.textContent='1,000원 이상, 10원 단위로 입력해 주세요.';accountPrice.focus();return}
         var selected=list.querySelector('[aria-selected="true"]');
         var draft={category:'account',mode:'buy',gameCode:params.get('search_game'),serverName:selected?selected.textContent.trim():'',price:Number(accountPrice.value.replace(/,/g,''))};
          try{sessionStorage.setItem('mobile-buy-account-draft',JSON.stringify(draft))}catch(e){}
          message.textContent='';showRegistrationReview(draft);
       });
       try{var accountDraft=JSON.parse(sessionStorage.getItem('mobile-buy-account-draft')||'null');
         if(accountDraft&&accountDraft.gameCode===params.get('search_game')&&accountDraft.category==='account'&&accountDraft.mode==='buy'){
           if(Number.isSafeInteger(accountDraft.price)&&accountDraft.price>=1000&&accountDraft.price%10===0)accountPrice.value=accountDraft.price.toLocaleString('ko-KR');
           if(initialCategory==='account'&&typeof accountDraft.serverName==='string'){var accountServer=Array.from(list.querySelectorAll('[data-server-index]')).find(function(el){return el.textContent.trim()===accountDraft.serverName});if(accountServer)accountServer.click()}
           updateBuyAccountPrice();
         }
       }catch(e){}` : ""}
    if(['item','account','other'].includes(initialCategory))chooseCategory(initialCategory);
     if(isBuy&&initialCategory==='item'&&params.get('step')==='detail')root.classList.add('buy-detail');
})();
</script>${mobileMenuScript("msr-menu-button")}</body></html>`;
}

export function renderMobileBuyRegister(
  game: { name: string; code: string; servers: string[] },
  assetDir: string,
): string {
  return renderMobileSellRegister(game, assetDir, "buy");
}