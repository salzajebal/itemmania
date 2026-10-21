import { listingQuantityLabel } from "../lib/listing-quantity";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listingTimeMarkup } from "../lib/listing-time";
import { PRODUCT_MEMBER_ONLINE_BADGE, PRODUCT_MEMBER_ONLINE_STYLE } from "../lib/product-member-status";

const escapeHtml = (value: unknown): string => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const icon = (paths: string, viewBox = "0 0 24 24") =>
  `<svg viewBox="${viewBox}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const backIcon = icon('<path d="M19 12H4m0 0 7-7m-7 7 7 7"/>');
const heartIcon = icon('<path d="M20.8 8.5c0 4.2-8.8 10.2-8.8 10.2S3.2 12.7 3.2 8.5a4.5 4.5 0 0 1 8.8-1.1 4.5 4.5 0 0 1 8.8 1.1Z"/>');
const linkIcon = icon('<path d="m10 13 4-4M8.5 15.3l-1.4 1.4a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M15.5 8.7l1.4-1.4a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/>');
const chatIcon = icon('<path d="M12 3c-5.2 0-9.5 3.5-9.5 8 0 2 1 3.9 2.7 5.3L4.5 21l5.2-2.2c.8.2 1.5.2 2.3.2 5.2 0 9.5-3.5 9.5-8S17.2 3 12 3Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>');
const homeIcon = icon('<path fill="currentColor" stroke="none" d="M12 2 2 10.5v2h2V21h6v-7h4v7h6v-8.5h2v-2L12 2Z"/>');
const searchIcon = icon('<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/>');
const userIcon = icon('<circle cx="12" cy="7.5" r="4"/><path d="M4 22c0-5.2 3-8 8-8s8 2.8 8 8"/>');
const menuIcon = icon('<path d="M3 6h18M3 12h18M3 18h18"/>');

/** Standalone, mobile-width listing page. The caller supplies the resolved listing and session user. */
export function renderMobileSellDetail(product: Record<string, unknown>, user: Record<string, unknown> | null, badgeDirectory: string): string {
  const badge = (file: string) => `data:image/png;base64,${readFileSync(join(badgeDirectory, file)).toString("base64")}`;
  const ismsBadge = badge("isms.png");
  const danalBadge = badge("danal.png");
  const isBuy = text(product.category).toLowerCase() === "buy";
  const id = Number(product.id);
  const sellerId = Number(product.sellerId);
  const validIds = Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(sellerId) && sellerId > 0;
  const own = !!user && Number(user.id) === sellerId;
  const status = text(product.status);
  const available = validIds && status === "active" && !own;
  const title = text(product.title);
  const game = text(product.gameName);
  const server = text(product.serverName);
  const category = text(product.itemCategory);
  const originalDescription = text(product.description).replace(/\r\n?/g, "\n");
  const lines = originalDescription.split("\n");
  let quantity = listingQuantityLabel(product), tradeType = "";
  // Registration writes these as leading metadata lines; never consume freeform text further down.
  while (lines.length) {
    const line = lines[0].trim();
    const q = line.match(/^수량\s*:\s*(.+)$/);
    const t = line.match(/^거래\s*유형\s*:\s*(.+)$/);
    if (q) { /* explicit registration metadata is already resolved above */ }
    else if (t && !tradeType) tradeType = t[1].trim();
    else break;
    lines.shift();
  }
  const description = lines.join("\n").trim();
  const rawPrice = Number(product.price);
  const price = Number.isFinite(rawPrice) && rawPrice >= 0
    ? `${rawPrice.toLocaleString("ko-KR")}원` : "";
  const date = listingTimeMarkup(product.createdAt, false, true);
  const viewCount = Number(product.viewCount ?? 0).toLocaleString("ko-KR");
  const breadcrumb = [game, server, category].filter(Boolean).map(escapeHtml).join(' <span aria-hidden="true">&gt;</span> ');
  const grade = text(product.sellerGrade);
  const score = product.sellerCreditScore !== null && product.sellerCreditScore !== undefined &&
    String(product.sellerCreditScore).trim() !== "" && Number.isFinite(Number(product.sellerCreditScore))
    ? String(product.sellerCreditScore) : "";
  const auth = product.sellerAuthStates;
  const authNames: Record<string, string> = {
    phone: "휴대폰", mobile: "휴대폰", email: "이메일", bank: "출금계좌",
    account: "출금계좌", identity: "본인인증", excellent: "우수인증",
  };
  const verified = Array.isArray(auth)
    ? auth.filter((entry): entry is string => typeof entry === "string").map(entry => authNames[entry.toLowerCase()] || entry)
    : auth && typeof auth === "object"
      ? Object.entries(auth).filter(([, value]) => value === true).map(([key]) => authNames[key.toLowerCase()] || key)
      : [];
  const chips = [...new Set(verified)].map(name => `<span class="msd-chip">${escapeHtml(name)}</span>`).join("");
  const sellerName = text(product.sellerName);
  const myName = user ? text(user.nickname) || text(user.email) : "";
  const myPhone = user ? text(user.phone) : "";
  const row = (label: string, value: string) => value
    ? `<div class="msd-detail-row"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>` : "";
  const payload = JSON.stringify({ id: validIds ? id : null, sellerId: validIds ? sellerId : null, isBuy })
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const disabledReason = own ? "내가 등록한 상품입니다" : status !== "active" ? "거래가 종료된 상품입니다" : "거래할 수 없는 상품입니다";
  const actionAttributes = available ? "" : ` disabled aria-label="${disabledReason}" title="${disabledReason}"`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escapeHtml(title || "판매 상세")} | 아이템매니아</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;overflow-x:hidden}html{background:#fff}body{font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;font-size:16px;letter-spacing:-.045em;color:#242424;background:#fff}
button,input{font:inherit}button{cursor:pointer}a{text-decoration:none;color:inherit}svg{display:block}button:focus-visible,a:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid #149ee8;outline-offset:2px}
.msd-page{width:100%;min-height:100dvh;padding-bottom:calc(194px + env(safe-area-inset-bottom));overflow:hidden}.msd-header{height:65px;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #f0f0f0;position:relative}
.msd-header h1{margin:0;max-width:calc(100% - 96px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:20px;line-height:1.3;font-weight:750;letter-spacing:-.06em}
.msd-back{position:absolute;left:0;top:0;width:47px;height:64px;border:0;background:transparent;display:grid;place-items:center}.msd-back svg{width:26px;height:26px}
.msd-main{padding:36px 12px 0}.msd-sale-line{height:48px;border-bottom:2px solid #69a9cf;display:flex;justify-content:space-between;align-items:flex-start}
.msd-sale-line strong{font-size:18px;color:#478db6;padding-top:3px}.msd-copy{min-width:112px;height:27px;border:1px solid #e1e1e1;border-radius:16px;background:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;color:#333}.msd-copy svg{height:14px;width:14px}
.msd-crumb{min-height:54px;border-bottom:1px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:16px}.msd-crumb p{margin:0;min-width:0;line-height:1.45;overflow-wrap:anywhere}.msd-crumb span{color:#777}.msd-heart{flex:none;border:0;background:none;color:#bf5872;padding:8px 0 8px 8px}.msd-heart svg{width:23px;height:23px}.msd-heart[aria-pressed=true] svg{fill:#bf5872}
.msd-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:12px;font-size:14px;color:#777}.msd-meta .msd-id{color:#4b9bc4;font-size:16px;font-weight:600}.msd-date{text-align:right;font-size:13px}
.msd-title{font-size:18px;font-weight:750;line-height:1.5;margin:24px 0 19px;overflow-wrap:anywhere}.msd-details{margin:0;border:1px solid #555;border-radius:11px;overflow:hidden}.msd-detail-row{min-height:42px;display:grid;grid-template-columns:96px minmax(0,1fr);align-items:center;padding:8px 17px;gap:1px;border-bottom:1px solid #e3e3e3;font-size:16px;line-height:1.35}.msd-detail-row:last-child{border-bottom:0}.msd-detail-row dt{color:#777}.msd-detail-row dd{margin:0;font-weight:650;overflow-wrap:anywhere}
.msd-warning{margin:12px 0 0;padding:18px 17px 20px;border:1px solid #6baabb;border-radius:11px;box-shadow:0 1px 5px #47a2bd15}.msd-warning h2{margin:0 0 4px;font-size:17px;color:#459abd}.msd-warning h2::before{content:"✓";font-size:24px;line-height:14px;margin-right:4px}.msd-warning p{margin:0 0 2px;padding-left:12px;font-size:15px;line-height:1.38}.msd-warning p::before{content:"-";margin-left:-12px;margin-right:5px}
.msd-section{margin-top:39px}.msd-section h2{font-size:18px;margin:0 0 13px;font-weight:750}.msd-seller-notice{border:2px solid #c2c2c2;border-radius:10px;background:#f5f5f5;padding:14px 16px 16px;font-size:15px;line-height:1.42}.msd-seller-notice p{margin:0 0 5px}.msd-seller-notice p:last-child{margin-bottom:0}.msd-seller-notice strong{font-weight:700}.msd-muted-tag{display:inline-block;vertical-align:middle;border-radius:20px;background:#b9b9b9;color:#fff;font-size:12px;font-weight:700;padding:4px 9px;margin-right:6px;white-space:nowrap}
.msd-seller-profile{margin-top:14px;border-radius:11px;background:#f2f2f2;padding:17px 18px}.msd-grade-line{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.msd-grade-icon{width:35px;height:36px;clip-path:polygon(50% 0,95% 25%,95% 75%,50% 100%,5% 75%,5% 25%);background:#8170b7;color:white;display:grid;place-items:center;font-weight:800}.msd-grade{font-size:21px;font-weight:750;color:#7960b2}.msd-score{font-size:16px}.msd-name{font-size:15px;color:#555}.msd-chips{margin-top:10px;display:flex;gap:5px;flex-wrap:wrap}.msd-chip{border:1px solid #b4b4b4;border-radius:10px;background:#fff;padding:5px 12px;font-size:14px;white-space:nowrap}
${PRODUCT_MEMBER_ONLINE_STYLE}
.msd-member-status{margin-top:5px}
.msd-description{border:1px solid #555;border-radius:11px;padding:16px 18px;font-size:17px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;min-height:110px}.msd-empty{color:#777;font-size:15px}
.msd-mycard{border:1px solid #555;border-radius:10px;padding:20px 23px 24px;font-size:17px;line-height:1.65}.msd-mycard p{margin:0 0 5px}.msd-mycard p:last-child{margin-bottom:0}.msd-edit{display:inline-block;margin-left:8px;border:1px solid #d7d7d7;border-radius:5px;padding:1px 8px;font-size:13px;line-height:22px;vertical-align:middle}.msd-safety{display:flex;gap:10px;align-items:center;background:#f1f9fe;border-radius:10px;padding:16px;margin-top:14px;line-height:1.35}.msd-shield{color:#3e91d5;font-size:26px}.msd-consent{margin:34px 0 69px;padding:17px 16px 18px;border:2px dashed #c8b172;border-radius:13px;background:#fffbf1;font-size:14px;line-height:1.65}.msd-consent h2{margin:0 0 12px;color:#a56026;font-size:16px}.msd-new{background:#ed6661;color:#fff;border-radius:4px;font-size:12px;padding:3px 7px;margin-right:4px}.msd-consent-line{background:#fff;border-radius:9px;padding:12px 10px;display:flex;align-items:flex-start;gap:7px}.msd-consent-line input{width:20px;height:20px;flex:none;margin:2px 2px 0 0;accent-color:#169cda}.msd-select{border:1px solid #aaa;border-radius:3px;font-size:13px;line-height:20px;padding:0 5px}.msd-consent b{color:#ae6831}.msd-consent p{margin:15px 0 8px}.msd-consent details{border-top:1px dashed #d8ccae;padding-top:9px;color:#a55f25}.msd-consent summary{cursor:pointer;font-weight:650}.msd-consent details p{margin:5px 0 0;color:#555}
.msd-footer{border-top:1px solid #eee}.msd-policies{min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:4px;padding:0 12px;border-bottom:1px solid #eee;font-size:13px;white-space:nowrap}.msd-policies a:nth-child(2){color:#3887ab;font-weight:700}.msd-footer-body{padding:23px 12px 22px}.msd-support{font-size:23px;font-weight:800}.msd-hours{font-size:14px;color:#777}.msd-company{margin-top:30px;font-weight:700}.msd-copyright{color:#4086aa;margin:17px 0;font-size:14px}.msd-disclaimer{border-top:1px solid #e6e6e6;padding-top:17px;font-size:13px;line-height:1.5}.msd-desktop{display:inline-block;margin-top:11px;padding:5px 12px;border:1px solid #ddd;border-radius:18px;font-size:13px}
.msd-footer-contact{display:flex;align-items:center;justify-content:space-between;gap:12px}.msd-footer-marks{display:flex;gap:7px;align-items:center}.msd-footer-marks img{width:42px;height:38px;object-fit:contain}
.msd-sticky{position:fixed;z-index:20;left:0;right:0;bottom:0;filter:drop-shadow(0 -2px 9px #19384a16)}.msd-actions{height:104px;padding:17px 17px 14px;background:#fff;display:grid;grid-template-columns:1fr 1fr 1.72fr;gap:11px}.msd-actions button{height:72px;border:1px solid #77aeba;border-radius:14px;background:#fff;color:#3889b7;font-size:17px;font-weight:750;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px}.msd-actions svg{width:27px;height:27px}.msd-actions .msd-buy{background:#189eeb;color:#fff;border-color:#189eeb;box-shadow:0 1px 4px #188dc83b;font-size:17px}.msd-actions button:disabled{opacity:.55;cursor:not-allowed}.msd-actions button[aria-busy=true]{opacity:.65}
.msd-page.is-buy .msd-sale-line{border-bottom-color:#5fad75}.msd-page.is-buy .msd-sale-line strong{color:#289c4c}.msd-page.is-buy .msd-meta .msd-id{color:#329a4d}.msd-page.is-buy .msd-warning{border-color:#86b98e;box-shadow:0 1px 5px #46955518}.msd-page.is-buy .msd-warning h2{color:#289b46}.msd-page.is-buy .msd-warning p{font-size:16px;line-height:1.36;letter-spacing:-.025em}.msd-page.is-buy .msd-safety{background:#eef9ef}.msd-page.is-buy .msd-shield{color:#4bad59}.msd-sticky.is-buy .msd-actions button:not(.msd-buy){border-color:#91b59a;color:#268943}.msd-sticky.is-buy #msd-chat svg path:first-child{fill:#69c976;stroke:#69c976}.msd-sticky.is-buy #msd-chat svg path:last-child{stroke:#fff;stroke-width:3}.msd-sticky.is-buy .msd-actions .msd-buy{background:#32aa44;border-color:#32aa44;box-shadow:0 1px 4px #1689453b}
.msd-nav{height:calc(78px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:linear-gradient(103deg,#2388ec 0%,#108fbd 53%,#00ac70 100%);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center}.msd-nav a,.msd-nav button{height:100%;color:#fff;border:0;background:none;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;font-size:13px;padding:4px 0}.msd-nav svg{width:28px;height:28px}.msd-nav a[aria-label="채팅"] svg path:first-child{fill:#fff;stroke:#fff}.msd-nav a[aria-label="채팅"] svg path:last-child{stroke:#168eac;stroke-width:3}.msd-nav .msd-search{width:70px;height:70px;justify-self:center;align-self:start;transform:translateY(-9px);border-radius:50%;background:#fff;color:#3a3a3a;box-shadow:0 2px 5px #1b333d48}.msd-search svg{width:36px;height:36px;stroke-width:2.5}.msd-menu-panel{position:fixed;z-index:19;bottom:calc(182px + env(safe-area-inset-bottom));right:10px;background:white;border:1px solid #ddd;border-radius:10px;box-shadow:0 3px 14px #0002;padding:14px;display:grid;gap:14px}.msd-menu-panel[hidden]{display:none}.msd-message{position:fixed;z-index:25;bottom:calc(190px + env(safe-area-inset-bottom));left:15px;right:15px;background:#243e4a;color:white;padding:11px 16px;border-radius:9px;text-align:center;font-size:14px}.msd-message:empty{display:none}
@media(max-width:380px){.msd-detail-row{grid-template-columns:83px minmax(0,1fr)}.msd-policies{font-size:11px}.msd-actions{gap:7px;padding-left:11px;padding-right:11px}.msd-actions button{font-size:15px}.msd-crumb{font-size:14px}}
</style></head><body><div class="msd-page${isBuy ? " is-buy" : ""}"><header class="msd-header"><button id="msd-back" class="msd-back" aria-label="뒤로 가기">${backIcon}</button><h1>${escapeHtml(game ? game + " 상세설명" : (isBuy ? "구매 상세설명" : "판매 상세설명"))}</h1></header>
<main class="msd-main"><div class="msd-sale-line"><strong>${isBuy ? "삽니다" : "팝니다"}</strong><button type="button" id="msd-copy" class="msd-copy" aria-label="상품 링크 복사">링크복사 ${linkIcon}</button></div>
<div class="msd-crumb"><p>${breadcrumb || "판매 상품"}</p><button type="button" id="msd-heart-top" class="msd-heart" aria-label="찜하기" aria-pressed="false">${heartIcon}</button></div>
<div class="msd-meta"><span class="msd-id">${Number.isSafeInteger(id) && id > 0 ? "#" + id : ""}</span><div>${date} <span class="msd-views">조회 <span class="trade_view_cnt">${viewCount}</span></span></div></div>
<h2 class="msd-title">${escapeHtml(title)}</h2><dl class="msd-details">${row(isBuy ? "구매수량" : "판매수량", quantity)}${row("거래유형", tradeType)}${row(isBuy ? "구매금액" : "판매금액", price)}</dl>
<aside class="msd-warning"><h2>${isBuy ? "판매신청 전 주의사항" : "구매신청 전 주의사항"}</h2>${isBuy ? "<p>고의적인 취소 또는 직거래 유도 시 사이트 이용 제한을 받게 됩니다.</p><p>거래 교환 창 스크린샷과 완료 스크린샷을 보유하시기 바랍니다.</p><p>연간 기준으로 4,800만원 이상 판매 시 과세 대상에 포함될 수 있습니다.</p>" : "<p>판매자로부터 물품 받은 후 게임머니(아이템)에 문제가 있는지 다른 것으로 바꿔 주겠다며 물품을 요구하는 경우가 있습니다.</p><p>절대 물품을 돌려주지 마시고 고객센터로 문의 주시기 바랍니다.</p>"}</aside>
<section id="msd-member-info" class="msd-section"><h2>${isBuy ? "구매자 정보" : "판매자 정보"}</h2><div class="msd-seller-notice"><p><span class="msd-muted-tag">정보제공 동의 없음</span><strong>이 ${isBuy ? "구매자" : "판매자"}의 거래 종료 후 본인 정보 제공 동의는 확인되지 않았습니다.</strong></p><p>상대방의 동의가 확인되지 않은 경우 개인정보는 제공되지 않습니다.</p><p>※ 수사기관·법원 또는 소비자분쟁조정기구의 요청이 있을 경우에는 관련 법령에 따라 해당 기관에 제공될 수 있습니다.</p></div>
<div class="msd-seller-profile"><div class="msd-grade-line">${grade ? `<span class="msd-grade-icon" aria-hidden="true">${escapeHtml(grade.charAt(0).toUpperCase())}</span><strong class="msd-grade">${escapeHtml(grade.toUpperCase())}</strong>` : ""}${score ? `<span class="msd-score">${escapeHtml(score)}점</span>` : ""}${sellerName ? `<span class="msd-name">${escapeHtml(sellerName)}</span>` : ""}</div><div class="msd-member-status">${PRODUCT_MEMBER_ONLINE_BADGE}</div>${chips ? `<div class="msd-chips">${chips}</div>` : ""}</div></section>
<section id="msd-description" class="msd-section"><h2>상세설명</h2><div class="msd-description">${description ? escapeHtml(description) : '<span class="msd-empty">등록된 상세설명이 없습니다.</span>'}</div></section>
<section id="msd-my-info" class="msd-section"><h2>내 거래정보</h2><div class="msd-mycard">${user ? `${myName ? `<p>${escapeHtml(myName)}</p>` : ""}${myPhone ? `<p>${escapeHtml(myPhone)}</p>` : ""}<label for="msd-character" style="display:block;margin-top:12px;font-size:14px">${isBuy ? "판매자" : "구매자"} 인게임 닉네임</label><input id="msd-character" type="text" maxlength="100" autocomplete="off" placeholder="이번 거래에 사용할 인게임 닉네임" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccd7df;border-radius:6px;font-size:16px"><div class="msd-safety"><span class="msd-shield" aria-hidden="true">⬡</span><span>개인정보 보호 및 사고예방을 위해 거래는 안전한 채팅에서 진행해 주세요.</span></div>` : '<p>로그인 후 내 거래정보를 확인할 수 있습니다.</p><a class="msd-edit" href="/login" data-preview-link>로그인</a>'}</div></section>
 <section id="msd-consent" class="msd-consent" aria-label="거래 후 정보 제공 안내"><h2><span class="msd-new">NEW</span>거래 후 분쟁 대비 · 개인정보 제공 안내</h2><label class="msd-consent-line"><input type="checkbox" id="msd-consent"><span><span class="msd-select">선택</span> 거래 종료 후 분쟁에 대비해, <b>${isBuy ? "구매자" : "판매자"}에게 내 정보(이름·연락처·캐릭터명) 제공</b>에 관한 안내를 확인합니다.</span></label><p>이 화면에서의 선택은 저장되거나 전달되지 않습니다. 정보 제공에 동의하지 않아도 거래 이용에는 제한이 없습니다. 상대방 정보를 확인할 수 있는지는 <b>상대방의 동의 여부</b>에 따릅니다.</p><details><summary>▶ 동의 내용 자세히 보기</summary><p>실제 개인정보 제공 또는 거래 상태 변경에 반영되지 않습니다.</p></details></section></main>
<footer id="msd-footer" class="msd-footer"><nav class="msd-policies" aria-label="정책"><a href="/customer" data-preview-link>이용약관</a><a href="/customer" data-preview-link>개인정보 처리방침</a><a href="/customer" data-preview-link>청소년 보호정책</a><a href="/customer" data-preview-link>고객센터</a></nav><div class="msd-footer-body"><div class="msd-footer-contact"><div><div class="msd-support">1544-8278</div><div class="msd-hours">365일 24시간 연중무휴</div></div><div class="msd-footer-marks"><img src="${ismsBadge}" alt="ISMS"><img src="${danalBadge}" alt="안전거래 인증"></div></div><div class="msd-company">(주)아이엠아이 ﹀</div><div class="msd-copyright">Copyright © IMI. All rights reserved.</div><div class="msd-disclaimer">아이템매니아는 통신판매중개자이며 통신판매의 당사자가 아닙니다. 따라서 아이템매니아는 상품 거래정보 및 거래에 대하여 책임을 지지 않습니다.</div><a class="msd-desktop" href="/?desktop=1">PC버전</a></div></footer></div>
<div id="msd-message" class="msd-message" role="status" aria-live="polite"></div>
<div class="msd-sticky${isBuy ? " is-buy" : ""}"><div class="msd-actions"><button type="button" id="msd-favorite" aria-label="찜하기" aria-pressed="false">${heartIcon}<span>찜하기</span></button><button type="button" id="msd-chat"${actionAttributes}>${chatIcon}<span>채팅</span></button><button type="button" id="msd-purchase" class="msd-buy"${actionAttributes}>${isBuy ? "판매신청" : "구매신청"}</button></div>
<nav class="msd-nav" aria-label="하단 메뉴"><a href="/" data-preview-link aria-label="홈">${homeIcon}<span>홈</span></a><a href="/myroom/chat/list.html" data-preview-link aria-label="채팅 목록">${chatIcon}<span>채팅</span></a><a href="/mobile-game-search?mode=search" data-preview-link class="msd-search" aria-label="게임 검색">${searchIcon}</a><a href="/myroom/index.html" data-preview-link aria-label="마이룸">${userIcon}<span>마이룸</span></a><button type="button" id="msd-menu" aria-expanded="false" aria-controls="msd-menu-panel" aria-label="메뉴">${menuIcon}<span>메뉴</span></button></nav></div>
<div id="msd-menu-panel" class="msd-menu-panel" hidden><a href="/sell/list.html" data-preview-link>판매 물품</a><a href="/buy/list.html" data-preview-link>구매 물품</a><a href="/customer" data-preview-link>고객센터</a></div>
<script>(function(){'use strict';
var listing=${payload},preview=new URLSearchParams(location.search).get('mobile')==='1';
function withPreview(path){if(!preview)return path;var u=new URL(path,location.origin);u.searchParams.set('mobile','1');return u.pathname+u.search+u.hash}
document.querySelectorAll('[data-preview-link]').forEach(function(a){a.href=withPreview(a.getAttribute('href'))});
var message=document.getElementById('msd-message'),timer;
function say(msg){message.textContent=msg;clearTimeout(timer);timer=setTimeout(function(){message.textContent=''},4000)}
document.getElementById('msd-back').addEventListener('click',function(){if(history.length>1)history.back();else location.href=withPreview(listing.isBuy?'/buy/list.html':'/sell/list.html')});
document.getElementById('msd-copy').addEventListener('click',async function(){try{await navigator.clipboard.writeText(location.href);say('링크를 복사했습니다.')}catch(e){var input=document.createElement('textarea');input.value=location.href;document.body.append(input);input.select();var copied=document.execCommand('copy');input.remove();say(copied?'링크를 복사했습니다.':'링크를 복사하지 못했습니다.')}});
var key='im:favorite:'+String(listing.id),topHeart=document.getElementById('msd-heart-top'),favorite=document.getElementById('msd-favorite');
function refreshFavorite(){var on=false;try{on=localStorage.getItem(key)==='1'}catch(e){}[topHeart,favorite].forEach(function(button){button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'찜 취소':'찜하기')});favorite.querySelector('span').textContent=on?'찜완료':'찜하기'}
function toggleFavorite(){try{localStorage.setItem(key,localStorage.getItem(key)==='1'?'0':'1')}catch(e){say('이 브라우저에서 찜하기를 저장할 수 없습니다.')}refreshFavorite()}topHeart.addEventListener('click',toggleFavorite);favorite.addEventListener('click',toggleFavorite);refreshFavorite();
var menu=document.getElementById('msd-menu'),panel=document.getElementById('msd-menu-panel');menu.addEventListener('click',function(){panel.hidden=!panel.hidden;menu.setAttribute('aria-expanded',String(!panel.hidden))});
document.addEventListener('keydown',function(event){if(event.key==='Escape'){panel.hidden=true;menu.setAttribute('aria-expanded','false')}});
var chat=document.getElementById('msd-chat'),buy=document.getElementById('msd-purchase'),pending=false;
async function openChat(event){if(pending||chat.disabled||buy.disabled)return;pending=true;chat.setAttribute('aria-busy','true');buy.setAttribute('aria-busy','true');
try{var auth=await fetch('/api/auth/me',{credentials:'include',cache:'no-store'});if(auth.status===401){location.href='/login?returnUrl='+encodeURIComponent(location.pathname+location.search);return}if(!auth.ok)throw Error('로그인 상태를 확인할 수 없습니다.');
var me=await auth.json();if(Number(me.id)===listing.sellerId){chat.disabled=buy.disabled=true;say('내가 등록한 상품입니다.');return}
if(!Number.isSafeInteger(listing.id)||!Number.isSafeInteger(listing.sellerId))throw Error('거래할 수 없는 상품입니다.');
var roomRequest=listing.isBuy?{buyerId:Number(listing.sellerId),productId:Number(listing.id)}:{productId:Number(listing.id),sellerId:Number(listing.sellerId)};
var characterInput=document.getElementById('msd-character');
roomRequest.characterName=characterInput?characterInput.value.trim():undefined;
if(listing.isBuy&&event&&event.currentTarget===buy&&!roomRequest.characterName){if(characterInput)characterInput.focus();throw Error('캐릭터명을 입력한 후 판매신청해 주세요.')}
if(listing.isBuy&&(!event||event.currentTarget!==buy))delete roomRequest.characterName;
var response=await fetch('/api/chat/rooms',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(roomRequest)});
if(response.status===401){location.href='/login?returnUrl='+encodeURIComponent(location.pathname+location.search);return}
var result=await response.json().catch(function(){return {}});if(!response.ok)throw Error(result.error||'채팅방을 열지 못했습니다.');
if(!Number.isSafeInteger(Number(result.id))||Number(result.id)<1)throw Error('채팅방 정보를 확인할 수 없습니다.');
location.href=withPreview('/myroom/'+(listing.isBuy?'sell/sell_ing.html':'buy/buy_ing.html')+'?roomId='+encodeURIComponent(result.id));
}catch(error){say(error instanceof Error?error.message:'잠시 후 다시 시도해 주세요.')}finally{pending=false;chat.removeAttribute('aria-busy');buy.removeAttribute('aria-busy')}}
chat.addEventListener('click',openChat);buy.addEventListener('click',openChat);
})();</script></body></html>`;
}