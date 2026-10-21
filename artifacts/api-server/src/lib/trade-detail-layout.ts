export function renderTradeDetailLayout(side: "buy" | "sell", roomId: number): string {
  const id = Number.isFinite(roomId) ? Math.max(0, Math.floor(roomId)) : 0;
  const isBuy = side === "buy";
  const heading = isBuy ? "구매중인 물품" : "판매중인 물품";
  const partnerTitle = isBuy ? "판매자 정보" : "구매자 정보";
  const partnerRole = isBuy ? "판매자" : "구매자";
  const myCharLabel = isBuy ? "구매자" : "판매자";
  const listUrl = isBuy ? "/myroom/buy/buy_ing.html" : "/myroom/sell/sell_ing.html";
  const f = (n: string, d = "-") => `<span data-trade-field="${n}">${d}</span>`;

  const steps = isBuy
    ? [
        ["구매등록", "거래 대기 상태입니다.<br>판매 신청을 기다려 주세요"],
        ["결제 예정", "구매자가<br>결제 준비 중입니다.<br>결제 완료 후<br>거래를 진행하세요"],
        ["구매중", "거래 중입니다.<br>판매자와 반드시 통화로<br>거래를 진행하세요"],
        ["인수완료", "거래 종료 예정입니다.<br>물품인수확인 시<br>바로 거래가 종료됩니다."],
        ["구매완료", "거래가 완료되었습니다.<br>문제 발생 시<br>고객센터로 문의하세요."],
      ]
    : [
        ["판매등록", "거래 대기 상태입니다.<br>구매 신청을 기다려 주세요"],
        ["결제 예정", "구매자가<br>결제 준비 중입니다.<br>결제 완료 후<br>거래를 진행하세요"],
        ["판매중", "거래 중입니다.<br>구매자와 반드시 통화로<br>거래를 진행하세요"],
        ["인계완료", "거래 종료 예정입니다.<br>구매자의 인수확인 시<br>바로 거래가 종료됩니다."],
        ["판매완료", "거래가 완료되었습니다.<br>문제 발생 시<br>고객센터로 문의하세요."],
      ];
  const stepHtml = steps
    .map(
      (s, i) =>
        `<li class="td-step" data-step="${i + 1}"><span class="td-num">${i + 1}</span><strong>${s[0]}</strong><p>${s[1]}</p></li>`,
    )
    .join("");

  const cautions = isBuy
    ? [
        "판매자의 연락처가 다를 경우 거래를 중지하시고 고객센터를 통해 문의해 주시기 바랍니다.",
        "게임상에서 거래할 캐릭터명이 위의 판매자 캐릭터명과 같은지 확인하시기 바랍니다.",
        "거래시에는 게임상에서 채팅이나 귓말은 삼가시고 가능하면 전화통화를 유지하시기 바랍니다.",
        "반드시 상품을 정상적으로 인수하신 후 상품인수확인을 하시기 바랍니다.",
      ]
    : [
        "구매자의 연락처가 다를 경우 거래를 중지하시고 고객센터를 통해 문의해 주시기 바랍니다.",
        "게임상에서 거래할 캐릭터명이 위의 구매자 캐릭터명과 같은지 확인하시기 바랍니다.",
        "거래시에는 게임상에서 채팅이나 귓말은 삼가시고 가능하면 전화통화를 유지하시기 바랍니다.",
        "반드시 상품을 정상적으로 인계하신 후 거래를 진행하시기 바랍니다.",
      ];

  return `<div class="g_content trade-detail" data-trade-side="${side}" data-room-id="${id}">
<style>
html.trade-detail-page,body.trade-detail-page,.trade-detail-page #g_BODY{min-width:0!important}
.trade-detail{color:#222;font-size:13px;line-height:1.5;font-family:inherit}
.trade-detail *{box-sizing:border-box}
.trade-detail .td-mobile-back{display:none}
.trade-detail .td-h3{margin:0 0 22px;padding-bottom:7px;border-bottom:2px solid #1aa24b;font-size:17px;font-weight:700;color:#1b8a3f}
.trade-detail h4.td-h4{margin:0 0 12px;font-size:14px;font-weight:400;color:#333}
.trade-detail .td-sec{margin-bottom:34px}
.trade-detail .td-card{border:1px solid #c9ccd1;border-radius:8px;background:#fff;padding:16px 20px}
.trade-detail .td-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid #e5e7ea;font-size:12px;color:#444}
.trade-detail .td-top .td-time{color:#888}
.trade-detail .td-ref{margin-top:14px;font-size:12px;color:#1aa24b}
.trade-detail .td-title{margin:6px 0 20px;font-size:18px;font-weight:700;color:#222;word-break:break-all}
.trade-detail .td-boxes{display:flex;gap:16px}
.trade-detail .td-box{flex:1;min-width:0;border:1px solid #c9ccd1;border-radius:6px;padding:14px 8px;text-align:center}
.trade-detail .td-box small{display:block;font-size:12px;color:#555;margin-bottom:8px}
.trade-detail .td-box b{display:block;font-size:17px;font-weight:700;color:#222;word-break:break-all}
.trade-detail .td-box.td-amount b{color:#1aa24b}
.trade-detail .td-char{margin-top:18px;font-size:12px;color:#666}
.trade-detail .td-char b{font-size:14px;color:#222;margin-left:4px}
.trade-detail .td-pfirst{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.trade-detail .td-grade{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:700;color:#c28b1a}
.trade-detail .td-grade img{width:26px;height:28px;object-fit:contain}
.trade-detail .td-grade span.td-score{font-size:12px;font-weight:400;color:#333}
.trade-detail [data-trade-certifications]{display:flex;gap:6px;flex-wrap:wrap}
.trade-detail [data-trade-certifications] > *{border:1px solid #888;border-radius:4px;background:#fff;padding:4px 10px;font-size:12px;color:#444}
.trade-detail .td-id{margin-top:12px;font-size:14px;color:#222}
.trade-detail .td-id .td-name{display:block;margin-bottom:4px}
.trade-detail .td-pc{margin-top:14px;font-size:12px;color:#666}
.trade-detail .td-pc b{font-size:14px;color:#222;margin-left:4px}
.trade-detail .td-progress{background:#eaf7ee;border-radius:8px;padding:28px 12px 26px}
.trade-detail .td-steps{list-style:none;margin:0;padding:0;display:flex;position:relative}
.trade-detail .td-step{flex:1;text-align:center;position:relative;padding:0 4px;color:#555}
.trade-detail .td-step:not(:last-child)::after{content:"";position:absolute;top:10px;left:50%;width:100%;height:1px;background:#1aa24b}
.trade-detail .td-num{position:relative;z-index:1;display:inline-block;width:21px;height:21px;line-height:21px;text-align:center;border-radius:50%;background:#1aa24b;color:#fff;font-size:12px;font-weight:700}
.trade-detail .td-step strong{display:block;margin:14px 0 18px;font-size:14px;color:#222}
.trade-detail .td-step p{margin:0;font-size:11px;line-height:1.45;color:#555}
.trade-detail [data-trade-progress][data-current="1"] .td-step[data-step="1"] *,
.trade-detail [data-trade-progress][data-current="2"] .td-step[data-step="2"] *,
.trade-detail [data-trade-progress][data-current="3"] .td-step[data-step="3"] *,
.trade-detail [data-trade-progress][data-current="4"] .td-step[data-step="4"] *,
.trade-detail [data-trade-progress][data-current="5"] .td-step[data-step="5"] *{color:#1aa24b}
.trade-detail [data-trade-progress][data-current="1"] .td-step[data-step="1"] .td-num,
.trade-detail [data-trade-progress][data-current="2"] .td-step[data-step="2"] .td-num,
.trade-detail [data-trade-progress][data-current="3"] .td-step[data-step="3"] .td-num,
.trade-detail [data-trade-progress][data-current="4"] .td-step[data-step="4"] .td-num,
.trade-detail [data-trade-progress][data-current="5"] .td-step[data-step="5"] .td-num{color:#fff}
.trade-detail [data-trade-progress][data-current="0"] .td-step .td-num{background:#b8bec2}
.trade-detail .td-status{margin-top:12px;font-size:12px;color:#555}
.trade-detail .td-status [data-trade-field]{font-weight:700;color:#1b8a3f}
.trade-detail .td-notice{background:#f5f6f8;border-radius:8px;padding:18px 20px}
.trade-detail .td-notice ul{list-style:none;margin:0;padding:0;font-size:12px;color:#555;line-height:1.9}
.trade-detail .td-actions{display:flex;justify-content:center;gap:12px;margin:34px 0 48px;flex-wrap:wrap}
.trade-detail .td-btn{flex:0 1 168px;min-width:110px;height:43px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;justify-content:center;align-items:center;text-align:center;gap:8px}
.trade-detail .td-btn svg,.trade-detail .td-notice-icon{position:static;display:inline-block;vertical-align:middle;flex:none}
.trade-detail .td-btn:disabled{opacity:1;cursor:not-allowed}
.trade-detail #trade-scroll-chat{background:#fff;border:1px solid #1aa24b;color:#1b8a3f}
.trade-detail #trade-confirm{background:#1aa24b;border:1px solid #1aa24b;color:#fff}
.trade-detail #trade-cancel{background:#4a4a4a;border:1px solid #4a4a4a;color:#fff}
.trade-detail .td-help{width:100%;text-align:center;font-size:12px;color:#777;min-height:0}
.trade-detail .td-desc{padding:0}
.trade-detail .td-desc-body{padding:20px 26px;min-height:104px;max-height:104px;overflow:hidden;white-space:pre-wrap;word-break:break-all;color:#333}
.trade-detail .td-desc.is-open .td-desc-body{max-height:none}
.trade-detail .td-more{display:block;width:100%;border:0;border-top:1px solid #d9dbdf;background:none;padding:13px;font-size:12px;font-weight:700;color:#222;cursor:pointer;font-family:inherit;text-align:center}
.trade-detail .td-more i{font-style:normal;color:#1aa24b;margin-left:4px}
.trade-detail #trade-detail-error{display:none;margin:0 0 14px;padding:10px 12px;border:1px solid #e0a0a0;background:#fdf1f1;color:#b33;border-radius:6px}
.trade-detail #trade-detail-error:not(:empty){display:block}
.trade-detail .td-loading{margin:0 0 14px;padding:10px 12px;background:#f5f6f8;color:#666;border-radius:6px}
@media(max-width:640px){
.trade-detail-page #g_BODY{width:100%!important;overflow-x:hidden}
.trade-detail-page .g_header,.trade-detail-page #g_TAIL,.trade-detail-page #g_CONTENT>.aside{display:none!important}
.trade-detail-page #g_CONTENT{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:16px!important;min-height:0!important}
.trade-detail-page .g_content.trade-detail{float:none!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:0!important}
.trade-detail .td-mobile-back{display:block;margin-bottom:16px;color:#1b8a3f}
.trade-detail .td-ref{overflow-wrap:anywhere}
.trade-detail .td-card{padding:14px}
.trade-detail .td-boxes{flex-direction:column;gap:8px}
.trade-detail .td-steps{flex-direction:column;gap:14px;align-items:stretch}
.trade-detail .td-step{text-align:left;padding-left:32px}
.trade-detail .td-step:not(:last-child)::after{display:none}
.trade-detail .td-num{position:absolute;left:0;top:0}
.trade-detail .td-step strong{margin:2px 0 4px}
.trade-detail .td-btn{flex:1 1 100%}
}
</style>
<h3 class="td-h3">${heading}</h3>
<a class="td-mobile-back" href="${listUrl}">마이룸 · ${heading} 목록으로</a>
<div id="trade-detail-error" role="alert"></div>
<div class="td-loading" data-trade-loading>거래 정보를 불러오는 중입니다...</div>

<div class="td-sec">
<h4 class="td-h4">물품정보</h4>
<div class="td-card">
<div class="td-top"><span>${f("category")}</span><span class="td-time">${f("createdAt")}</span></div>
<div class="td-ref">#${f("reference")}</div>
<div class="td-title">${f("title")}</div>
<div class="td-boxes">
<div class="td-box"><small>${isBuy ? "구매수량" : "판매수량"}</small><b>${f("quantity")}</b></div>
<div class="td-box td-amount"><small>${isBuy ? "구매금액" : "판매금액"}</small><b>${f("amount")}</b></div>
<div class="td-box"><small>${isBuy ? "구매할인" : "판매할인"}</small><b>${f("purchaseConfirmation")}</b></div>
</div>
<div class="td-char">${myCharLabel} 캐릭터명 : <b>${f(isBuy ? "buyerCharacterName" : "sellerCharacterName")}</b></div>
</div>
</div>

<div class="td-sec">
<h4 class="td-h4">${partnerTitle}</h4>
<div class="td-card">
<div class="td-pfirst">
<div class="td-grade"><span>${f("partnerGrade")}</span><span class="td-score">${f("partnerCreditScore")}</span></div>
<div data-trade-certifications></div>
</div>
<div class="td-id"><span class="td-name">${f("partnerName")}</span>${f("partnerPhone")}<span hidden>${f("partnerNickname")}</span></div>
<div class="td-pc">${partnerRole} 캐릭터명 : <b>${f(isBuy ? "sellerCharacterName" : "buyerCharacterName")}</b><span style="display:none">${f("partnerCharacterName")}</span></div>
</div>
</div>

<div class="td-sec">
<h4 class="td-h4">내 거래정보</h4>
<div class="td-card">
<div class="td-id" style="margin-top:0"><span class="td-name">${f("myName")}</span>${f("myPhone")}</div>
<span hidden>${f("myNickname")}${f("myCharacterName")}</span>
</div>
</div>

<div class="td-sec">
<h4 class="td-h4">거래 진행 상황</h4>
<div class="td-progress" data-trade-progress data-current="3">
<ol class="td-steps">${stepHtml}</ol>
</div>
<div class="td-status" data-trade-status-line>현재 상태: ${f("status")}</div>
</div>

<div class="td-sec" style="margin-bottom:0">
<h4 class="td-h4"><svg class="td-notice-icon" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8l-4 3v-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="9" r="1"/><circle cx="10" cy="9" r="1"/><circle cx="14" cy="9" r="1"/></svg> 알아두기</h4>
<div class="td-notice"><ul>${cautions.map((c) => `<li>&middot; ${c}</li>`).join("")}</ul></div>
</div>

<div class="td-actions">
<button type="button" class="td-btn" id="trade-scroll-chat"><svg width="24" height="22" viewBox="0 0 24 22" aria-hidden="true"><path d="M4 2h13a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-4l-4 4v-4H4a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Z" fill="#80ce6c"/><circle cx="6" cy="10" r="1" fill="#fff"/><circle cx="10" cy="10" r="1" fill="#fff"/><circle cx="14" cy="10" r="1" fill="#fff"/></svg>채팅</button>
<button type="button" class="td-btn" id="trade-confirm">${isBuy ? "상품인수확인" : "상품인계확인"}</button>
<button type="button" class="td-btn" id="trade-cancel">${isBuy ? "구매취소" : "판매취소"}</button>
<div class="td-help" data-trade-help role="status" aria-live="polite"></div>
</div>

<div class="td-sec">
<h4 class="td-h4">상세설명</h4>
<div class="td-card td-desc" data-trade-desc>
<div class="td-desc-body" id="trade-product-description">${f("productDescription", "")}</div>
<button type="button" class="td-more" data-trade-description-toggle aria-controls="trade-product-description" aria-expanded="false">전체보기 <i>+</i></button>
</div>
</div>

<span style="display:none">${f("productCategory", "")}</span>
</div>`;
}
