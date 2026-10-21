import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { load } from "cheerio";
import { normalizeLoginBrandName } from "./login-branding";
import { memberLoginEntry } from "./member-login-entry";
import { renderMobileLogin } from "../routes/mobile-login";
import { renderMemberLogin } from "../routes/member-login";

test("brand validation trims names, permits clearing, rejects invalid types and controls", () => {
  assert.equal(normalizeLoginBrandName("  내 상점  "), "내 상점");
  assert.equal(normalizeLoginBrandName(""), "");
  for (const value of [null, 12, "x".repeat(41), "브랜드\n이름", "브랜드\u0000"])
    assert.throws(() => normalizeLoginBrandName(value));
});

test("configured brand is escaped and shared by desktop, mobile, and member form", () => {
  const name = `내 상점 & "<script>브랜드</script>" $&`;
  const captured = '<button id="naver_id_login">legacy</button>';
  for (const html of [memberLoginEntry(captured, name), renderMobileLogin("", name)]) {
    const $ = load(html);
    assert.equal($("#im_member_login").text(), name + " 회원 로그인");
    assert.equal($("#im_member_login script").length, 0);
    assert.equal($("#im_member_login").attr("href"), "/login/member");
  }
  const $ = load(renderMemberLogin("", "/login", null, name));
  assert.equal($("h1").text(), name + " 회원 로그인");
  assert.equal($("title").text(), name + " 회원 로그인");
  assert.equal($(".ml-notice").length, 0);
  assert.equal(load(memberLoginEntry(captured, "")).text(), "회원 로그인");
});

test("name persists across processes independently of logo replacement and removal", () => {
  const root = mkdtempSync(join(tmpdir(), "member-brand-test-"));
  const url = new URL("./login-branding.ts", import.meta.url).href;
  const run = (script: string) => {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
      `import assert from 'node:assert/strict'; import * as b from ${JSON.stringify(url)}; ${script}`],
    { env: { ...process.env, APP_ROOT: root }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    run(`assert.equal((await b.loginLogoStatus()).brandName,'');
      await b.updateLoginBrandName('  내 브랜드  ');
      await b.updateLoginLogo(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(40)]));
      const before=await b.loginLogoStatus();
      assert.ok(before.logoUrl); await b.updateLoginBrandName('새 브랜드');
      assert.equal((await b.loginLogoStatus()).logoUrl,before.logoUrl);
      await b.updateLoginLogo(null);
      assert.equal((await b.loginLogoStatus()).brandName,'새 브랜드');`);
    run(`assert.equal((await b.loginLogoStatus()).brandName,'새 브랜드');
      await b.updateLoginBrandName('');`);
    run(`assert.equal((await b.loginLogoStatus()).brandName,'');`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("admin save sends brandName, shows errors, and preserves unrelated logo selection", async () => {
  const elements: Record<string, any> = {
    loginBrandName: { value: "내 브랜드", disabled: false },
    loginBrandNameSave: { disabled: false },
    loginBrandNameStatus: { textContent: "", style: {} },
    loginBrandNamePreview: { textContent: "" },
    loginLogoFile: { value: "pending-logo.png" },
  };
  let failed = false;
  const source = readFileSync(new URL("../admin-script.js", import.meta.url), "utf8");
  const block = source.match(/var loginLogoObjectUrl=null;[\s\S]*?(?=async function doLogout)/)![0];
  const context = vm.createContext({
    document: { getElementById: (id: string) => elements[id] },
    fetch: async (path: string, options: any) => {
      assert.equal(path, "/api/admin/login-branding/name");
      assert.equal(options.method, "PUT");
      assert.equal(JSON.parse(options.body).brandName, "내 브랜드");
      return { ok: !failed, json: async () => failed ? { error: "저장 실패" } : { brandName: "내 브랜드" } };
    },
  });
  vm.runInContext(block, context);
  await vm.runInContext("saveLoginBrandName()", context);
  assert.equal(elements.loginBrandNamePreview.textContent, "내 브랜드 회원 로그인");
  assert.match(elements.loginBrandNameStatus.textContent, /저장했습니다/);
  assert.equal(elements.loginLogoFile.value, "pending-logo.png");
  failed = true;
  await vm.runInContext("saveLoginBrandName()", context);
  assert.equal(elements.loginBrandNameStatus.textContent, "저장 실패");
  assert.equal(elements.loginBrandNameSave.disabled, false);
  assert.equal(elements.loginBrandName.disabled, false);
});
