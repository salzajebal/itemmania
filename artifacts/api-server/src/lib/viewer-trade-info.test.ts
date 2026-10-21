import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { applyViewerTradeInfo, VIEWER_TRADE_INFO_SCRIPT } from "./viewer-trade-info";
import { Script } from "node:vm";

for (const file of ["buy-application-1.html", "sell-application-1.html"]) {
  const source = readFileSync(new URL(`../static/${file}`, import.meta.url), "utf8");
  test(`${file}: guest HTML never contains captured viewer identity/contact`, () => {
    const $ = load(applyViewerTradeInfo(source, null));
    assert.equal($(".my_private [data-im-viewer-name]").text(), "로그인 후 확인");
    assert.equal($(".my_private #spnUserCell").text(), "로그인 후 확인");
    assert.ok(!$(".my_private").text().includes("기우혁"));
    assert.ok(!$(".my_private").text().includes("010-5863-1032"));
    assert.equal($(".my_private li.user_name a").is("[hidden]"), true);
  });
  test(`${file}: two viewers get independent panels, listing owner stays unchanged`, () => {
    const owner = load(source)(".certify_info").text();
    for (const [nickname, phone] of [["QA-viewer-A", "010-0000-1111"], ["QA-viewer-B", "010-0000-2222"]]) {
      const $ = load(applyViewerTradeInfo(source, { id: 1, nickname, phone }));
      assert.equal($(".my_private [data-im-viewer-name]").text(), nickname);
      assert.equal($(".my_private #spnUserCell").text(), phone);
      assert.equal($(".my_private li.user_name a").text(), "수정");
      assert.equal($(".certify_info").text(), owner);
    }
  });
  test(`${file}: missing phone clears snapshot number; nickname is escaped`, () => {
    const html = applyViewerTradeInfo(source, { nickname: '<img src=x onerror="bad()">', phone: null });
    const $ = load(html);
    assert.equal($(".my_private [data-im-viewer-name]").text(), '<img src=x onerror="bad()">');
    assert.equal($(".my_private [data-im-viewer-name] img").length, 0);
    assert.equal($(".my_private #spnUserCell").text(), "등록된 연락처 없음");
  });
}

test("unrelated markup is unchanged and repeated rendering is idempotent", () => {
  const source = '<p>public owner</p><div class="my_private"><ul><li class="user_name">captured <a>수정</a></li><li><span id="spnUserCell">old</span></li></ul><div>notice</div></div><footer>unchanged</footer>';
  const viewer = { nickname: "current", phone: "010-0000-3333" };
  const result = applyViewerTradeInfo(source, viewer);
  assert.ok(result.startsWith("<p>public owner</p>"));
  assert.ok(result.endsWith("<footer>unchanged</footer>"));
  assert.equal(applyViewerTradeInfo(result, viewer), result);
  assert.equal(applyViewerTradeInfo("<p>no private panel</p>", null), "<p>no private panel</p>");
  new Script(VIEWER_TRADE_INFO_SCRIPT.replace(/^<script>|<\/script>$/g, ""));
});
