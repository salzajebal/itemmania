import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import ts from "typescript";

const source = ts.createSourceFile("proxy.ts",
  readFileSync(new URL("../src/routes/proxy.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function embedded(name: string) {
  let code = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name &&
      node.initializer && ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
      code = Array.from(node.initializer.text.matchAll(/<script\b[^>]*>([\s\S]*?)<[/]script>/g), m => m[1]).join("\n");
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!code) throw new Error("Missing embedded script: " + name);
  new Script(code);
  return ts.createSourceFile(name + ".js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}
const login = embedded("LOGIN_INTERCEPT_SCRIPT");
const sale = embedded("BUY_APPLICATION_INTERCEPT_SCRIPT");
let loginFunction = "", saleAssignment = "";
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "openProductLoginPopup") loginFunction = node.getText(sale);
  if (ts.isExpressionStatement(node) && node.getText(sale).startsWith("window._im_on_sell_btn =")) saleAssignment = node.getText(sale);
  ts.forEachChild(node, visit);
}
visit(sale);
if (!loginFunction || !saleAssignment) throw new Error("Missing sale handlers");
const store = new Map([
  ["_im_product_chat_after_login", "stale"], ["_im_sale_after_login", "stale"], ["_im_chat_after_login", "stale"],
]);
let focused = false, posts = 0;
const input = { value: "   ", focus() { focused = true; } };
const context = createContext({
  window: { __PRODUCT__: { id: 99, sellerId: 101 }, _IM_USER: null },
  location: { pathname: "/buy/application.html", search: "?id=99", href: "" },
  sessionStorage: { removeItem(k: string) { store.delete(k); }, setItem(k: string, v: string) { store.set(k, v); } },
  document: { getElementById() { return input; } },
  applicationPending: false, showApplicationToast() {}, encodeURIComponent,
  fetch() { posts++; throw new Error("Unexpected room request"); },
});
new Script(loginFunction + "\n" + saleAssignment).runInContext(context);
new Script("window._im_on_sell_btn({})").runInContext(context);
if (context.location.href !== "/login?returnUrl=%2Fbuy%2Fapplication.html%3Fid%3D99" ||
  store.has("_im_product_chat_after_login") || store.has("_im_sale_after_login") || posts) {
  throw new Error("Guest sale must only navigate to login and clear automatic intents");
}
new Script("window._IM_USER={id:102};window._im_on_sell_btn({})").runInContext(context);
if (!focused || posts) throw new Error("Blank character must not create a trade");
console.log("Embedded login/sale scripts parse; guest login and blank-character application never POST a room.");

for (const intent of ["new-sale", "legacy-sale", "chat"]) {
  let submit: ((event: { preventDefault(): void }) => Promise<void>) | undefined;
  let roomPosts = 0, destination = "", closed = false;
  const returnPath = "/buy/application.html?id=99&pc=1";
  const values = new Map([["_im_login_next", returnPath]]);
  const opener = intent === "new-sale" ? null : { closed: false, location: { origin: "https://example.test", href: "" } };
  if (intent !== "new-sale") values.set("_im_product_chat_after_login",
    JSON.stringify({ intent: intent === "chat" ? "chat" : "sale", returnPath, productId: 99, buyerId: 101 }));
  const form = {
    addEventListener(_name: string, callback: typeof submit) { submit = callback; },
    querySelector() { return { disabled: false }; },
  };
  const ctx = createContext({
    window: { opener, name: intent === "new-sale" ? "" : "im_product_chat_99", close() { closed = true; } },
    document: {
      readyState: "complete", body: { addEventListener() {} },
      querySelector(selector: string) { return selector === "form[name=g_LOGIN_FORM]" ? form : null; },
      querySelectorAll() { return []; },
      getElementById(id: string) { return ["user_id", "user_password"].includes(id) ? { value: "synthetic-test-input" } : null; },
    },
    location: { origin: "https://example.test", search: "?returnUrl=" + encodeURIComponent(returnPath),
      replace(path: string) { destination = path; } },
    sessionStorage: { getItem(k: string) { return values.get(k) || null; }, removeItem(k: string) { values.delete(k); } },
    URL, URLSearchParams,
    fetch: async (path: string) => {
      if (path === "/api/auth/login") return { ok: true, json: async () => ({ id: 102 }) };
      if (path === "/api/chat/rooms") { roomPosts++; return { ok: true, json: async () => ({ id: 55 }) }; }
      throw new Error("Unexpected request");
    },
  });
  new Script(login.getFullText()).runInContext(ctx);
  if (!submit) throw new Error("Login form handler not installed");
  await submit({ preventDefault() {} });
  if (intent === "chat") {
    if (roomPosts !== 1 || destination !== "/myroom/chat/new_chat.html?roomId=55") throw new Error("Ordinary chat continuation changed");
  } else {
    if (roomPosts || (intent === "new-sale" ? destination !== returnPath : !closed || opener?.location.href !== returnPath)) {
      throw new Error(intent + ": signin must return to product without submitting");
    }
  }
  console.log(intent + ": login continuation passed");
}
