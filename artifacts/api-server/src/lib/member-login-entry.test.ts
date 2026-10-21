import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "cheerio";
import { memberLoginEntry } from "./member-login-entry";
import { renderMemberLogin } from "../routes/member-login";
import { renderMobileLogin } from "../routes/mobile-login";

test("captured alternative button is rebranded without external identity or authorization URL", () => {
  const original = readFileSync(new URL("../static/login.html", import.meta.url), "utf8");
  const $ = load(memberLoginEntry(original));
  assert.equal($("#naver_id_login").length, 0);
  assert.equal($("#im_member_login").text(), "회원 로그인");
  assert.equal($("#im_member_login").attr("href"), "/login/member");
  assert.equal($("#im_member_login").attr("data-apiurl"), undefined);
  assert.equal($('form[name="g_LOGIN_FORM"] #user_id').length, 1);
  assert.equal($('form[name="g_LOGIN_FORM"] #user_password').length, 1);
  assert.ok(memberLoginEntry('<button id="naver_id_login">legacy</button>').includes('id="im_member_login"'));
});

test("both mobile and desktop entries use own-site member identity", () => {
  const $ = load(renderMobileLogin(""));
  assert.equal($("#im_member_login").text(), "회원 로그인");
  assert.equal($("#naver_id_login").length, 0);
  assert.equal($("#im_member_login").find("b,img").length, 0);
});

test("green member form retains existing login fields without the removed notice", () => {
  const $ = load(renderMemberLogin("", "/login?returnUrl=%2Fmyroom%2Findex.html&mobile=1"));
  assert.equal($('form[name="g_LOGIN_FORM"] #user_id').attr("autocomplete"), "username");
  assert.equal($("#user_password").attr("autocomplete"), "current-password");
  assert.equal($('button[type="submit"]').text(), "로그인");
  assert.equal($(".ml-notice").length, 0);
  assert.equal($("h1").text(), "회원 로그인");
  assert.equal($("title").text(), "회원 로그인");
  assert.equal($("img").length, 0);
  assert.equal($("#_im_login_err").attr("role"), "alert");
  assert.equal($(".ml-back").attr("href"), "/login?returnUrl=%2Fmyroom%2Findex.html&mobile=1");
  assert.equal(load(renderMemberLogin("", "https://example.com"))(".ml-back").attr("href"), "/login");
});

test("alternative form is wired to the same existing login and local return handler", () => {
  const source = readFileSync(new URL("../routes/proxy.ts", import.meta.url), "utf8");
  assert.ok(source.includes("renderMemberLogin(mobileLoginFontStyles, backHref, branding.logoUrl, branding.brandName).replace(\"</body>\", LOGIN_INTERCEPT_SCRIPT"));
  assert.ok(source.includes("location.assign('/login/member' + location.search)"));
  assert.ok(source.includes("target.origin === location.origin"));
});
