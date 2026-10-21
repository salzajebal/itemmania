import assert from "node:assert/strict";
import test from "node:test";
import { logoImageType } from "./login-branding";
import { renderMemberLogin } from "../routes/member-login";
import { memberPhoneVariants } from "./member-login-phone";
import { load } from "cheerio";

test("branding accepts raster image signatures, never HTML or SVG masquerading as an image", () => {
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(40)]);
  const jpg = Buffer.concat([Buffer.from([255,216,255]), Buffer.alloc(40)]);
  const webp = Buffer.alloc(40); webp.write("RIFF"); webp.write("WEBP",8);
  assert.equal(logoImageType(png)?.mime, "image/png");
  assert.equal(logoImageType(jpg)?.mime, "image/jpeg");
  assert.equal(logoImageType(webp)?.mime, "image/webp");
  assert.equal(logoImageType(Buffer.from("<svg onload='alert(1)'>".repeat(3))), null);
  assert.equal(logoImageType(Buffer.from("<html><script>alert(1)</script></html>")), null);
  assert.equal(logoImageType(Buffer.alloc(0)), null);
});
test("custom brand logo precedes inputs with a neutral member title and no removed notice", () => {
  const html = renderMemberLogin("", "/login", "/api/member-login/logo?v=sample.png");
  const $ = load(html);
  assert.equal($(".ml-logo").attr("src"), "/api/member-login/logo?v=sample.png");
  assert.equal($("h1").text(), "회원 로그인");
  assert.equal($(".ml-notice").length, 0);
  assert.ok(!html.includes("네이버 계정 로그인 화면이 아닙니다."));
  assert.equal($("#user_id").attr("placeholder"), "아이디 또는 전화번호");
  assert.equal($("#user_password").attr("placeholder"), "비밀번호");
  assert.ok(html.indexOf('class="ml-logo"') < html.indexOf('id="user_id"'));
  assert.equal(load(renderMemberLogin("", "/login", "javascript:alert(1)"))(".ml-logo").length, 0);
});
test("phone normalization accepts only domestic member numbers, leaving ordinary IDs unchanged", () => {
  assert.deepEqual(memberPhoneVariants("010-1234-5678"), ["01012345678", "821012345678"]);
  assert.deepEqual(memberPhoneVariants("+82 10 1234 5678"), ["01012345678", "821012345678"]);
  assert.deepEqual(memberPhoneVariants("02-123-4567"), ["021234567", "8221234567"]);
  assert.equal(memberPhoneVariants("member1234"), null);
  assert.equal(memberPhoneVariants("admin@example.com"), null);
  assert.equal(memberPhoneVariants("1234"), null);
});
