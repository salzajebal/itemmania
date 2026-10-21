import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { ongoingTradeHref } from "./ongoing-trades";
import { TRADE_DETAIL_SCRIPT } from "./trade-detail-script";
import { renderTradeDetailLayout } from "./trade-detail-layout";
import { renderMobileChatRoom } from "../routes/mobile-chat-room";

test("ongoing rows go to participant Myroom information, not standalone chat", () => {
  for (const side of ["buy", "sell"] as const) {
    const page = `/myroom/${side}/${side}_ing.html`;
    assert.equal(ongoingTradeHref({ roomId: 17, orderId: null }, side), page + "?roomId=17");
    assert.equal(ongoingTradeHref({ roomId: 19, orderId: 17 }, side), page + "?roomId=19");
    assert.equal(ongoingTradeHref({ roomId: null, orderId: 17 }, side), page + "?orderId=17");
    assert.equal(ongoingTradeHref({ roomId: null, orderId: null }, side), page);
  }
});

test("trade information has no automatic inline chat and retains the chat button", () => {
  for (const side of ["buy", "sell"] as const) {
    const html = renderTradeDetailLayout(side, 17);
    for (const label of ["물품정보", side === "buy" ? "판매자 정보" : "구매자 정보", "내 거래정보", "상세설명"]) assert.ok(html.includes(label));
    assert.ok(!html.includes("<iframe"));
    assert.ok(!html.includes("trade-chat-section"));
    assert.ok(html.includes('id="trade-scroll-chat"'));
    assert.ok(html.includes('data-trade-field="buyerCharacterName"'));
    assert.ok(html.includes('data-trade-field="sellerCharacterName"'));
  }
  new vm.Script(TRADE_DETAIL_SCRIPT.replace(/^<script>|<\/script>$/g, ""));
});

test("clicking chat opens the same existing room, with a blocked-popup fallback", () => {
  const handler = TRADE_DETAIL_SCRIPT.match(/chatButton\.addEventListener\('click',function\(\)\{([\s\S]*?)\n \}\);/)![1];
  for (const blocked of [false, true]) {
    let opened = "", redirected = "", focused = false;
    const window = {
      open: (url: string, name: string) => {
        opened = url;
        assert.equal(name, "trade-chat-17");
        return blocked ? null : { focus: () => { focused = true; } };
      },
      location: { assign: (url: string) => { redirected = url; } },
    };
    vm.runInNewContext(handler, { window, roomId: "17", encodeURIComponent });
    assert.equal(opened, "/myroom/chat/new_chat.html?roomId=17");
    assert.equal(redirected, blocked ? opened : "");
    assert.equal(focused, !blocked);
  }
});

test("purchase information uses reference cards, five progress steps and real action controls", () => {
  const html = renderTradeDetailLayout("buy", 17);
  let previous = -1;
  for (const title of ["물품정보", "판매자 정보", "내 거래정보", "거래 진행 상황", "알아두기", "상세설명"]) {
    const position = html.indexOf(`${title}</h4>`);
    assert.ok(position > previous, title);
    previous = position;
  }
  assert.equal((html.match(/class="td-step"/g) || []).length, 5);
  assert.ok(html.includes('data-current="3"'));
  for (const id of ["trade-scroll-chat", "trade-confirm", "trade-cancel"]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  for (const field of ["quantity", "productDescription", "partnerCreditScore", "purchaseConfirmation"]) {
    assert.ok(html.includes(`data-trade-field="${field}"`));
  }
  assert.ok(html.includes("<div data-trade-certifications></div>"));
  assert.ok(!html.includes("안심번호 사용"));
  assert.ok(TRADE_DETAIL_SCRIPT.includes("r.productCreatedAt||r.orderCreatedAt||r.createdAt"));
  assert.ok(TRADE_DETAIL_SCRIPT.includes("verified[entry[0]]===true"));
  assert.ok(TRADE_DETAIL_SCRIPT.includes("method:'PATCH'"));
  assert.ok(TRADE_DETAIL_SCRIPT.includes("window.confirm(message)"));
  assert.ok(TRADE_DETAIL_SCRIPT.includes("status==='ended'&&room.status!=='handover'"));
});

test("embedded chat retains actual send, image upload and visible refresh behaviour", () => {
  const html = renderMobileChatRoom(17, true);
  assert.ok(html.includes("body .header,body #product,body #partner-info"));
  assert.ok(html.includes("'/messages'"));
  assert.ok(html.includes("'/upload'"));
  assert.ok(html.includes("method:'POST'"));
  assert.ok(html.includes("new EventSource('/api/events')"));
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  scripts.forEach(match => new vm.Script(match[1]));
});

test("explicit desktop application targets Myroom detail rather than chat or popup", () => {
  const source = readFileSync(new URL("../routes/proxy.ts", import.meta.url), "utf8");
  assert.ok(source.includes("popup.location.replace('/myroom/sell/sell_ing.html?roomId=' + room.id)"));
  assert.ok(source.includes('serveMyroomTradeDetail(req, res, user, "buy", buyMyroomIngHtml)'));
  assert.ok(source.includes('room.buyerId !== user.id && room.sellerId !== user.id'));
});
