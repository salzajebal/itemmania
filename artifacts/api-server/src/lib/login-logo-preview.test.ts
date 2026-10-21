import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function previewContext(bytes: Buffer, size = bytes.length) {
  const file = { type: "image/png", size, slice: () => ({ arrayBuffer: async () => Uint8Array.from(bytes).buffer }) };
  const elements: Record<string, any> = {
    loginLogoFile: { files: [file], value: "selected" },
    loginLogoPreview: { style: {}, removeAttribute() {}, onload: null, onerror: null },
    loginLogoEmpty: { style: {} },
    loginLogoStatus: { style: {}, textContent: "" },
  };
  const source = readFileSync(new URL("../admin-script.js", import.meta.url), "utf8");
  const block = source.match(/var loginLogoObjectUrl=null;[\s\S]*?(?=async function doLogout)/)?.[0];
  assert.ok(block);
  const context = vm.createContext({
    document: { getElementById: (id: string) => elements[id] },
    URL: { createObjectURL: () => "blob:qa", revokeObjectURL() {} },
    Uint8Array, FormData: class {}, console,
  });
  vm.runInContext(block, context);
  return { context, elements };
}
test("renamed SVG cannot become a raster-logo preview", async () => {
  const { context, elements } = previewContext(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"));
  await vm.runInContext("previewLoginLogo()", context);
  assert.equal(elements.loginLogoFile.value, "");
  assert.match(elements.loginLogoStatus.textContent, /올바른.*아닙니다/);
  assert.equal(vm.runInContext("loginLogoValidated", context), false);
  assert.equal(vm.runInContext("loginLogoObjectUrl", context), null);
});
test("oversized selection is rejected before decoding", async () => {
  const { context, elements } = previewContext(Buffer.alloc(40), 3 * 1024 * 1024);
  await vm.runInContext("previewLoginLogo()", context);
  assert.match(elements.loginLogoStatus.textContent, /최대 2MB/);
  assert.equal(elements.loginLogoFile.value, "");
});
test("preview must actually decode before save; decode failure restores the saved preview", async () => {
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(40)]);
  const { context, elements } = previewContext(png);
  vm.runInContext("loginLogoSavedUrl='/api/member-login/logo?v=original.png'", context);
  await vm.runInContext("previewLoginLogo()", context);
  assert.equal(vm.runInContext("loginLogoValidated", context), false);
  assert.equal(elements.loginLogoPreview.src, "blob:qa");
  elements.loginLogoPreview.onerror();
  assert.equal(elements.loginLogoFile.value, "");
  assert.equal(elements.loginLogoPreview.src, "/api/member-login/logo?v=original.png");
  assert.match(elements.loginLogoStatus.textContent, /읽을 수 없습니다/);
  const success = previewContext(png);
  await vm.runInContext("previewLoginLogo()", success.context);
  success.elements.loginLogoPreview.onload();
  assert.equal(vm.runInContext("loginLogoValidated", success.context), true);
});
