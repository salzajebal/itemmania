import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { injectSupportUi } from "./support-ui";

function inject(body: string, path = "/", type = "text/html") {
  let result = "";
  const response = { get: () => type, send(value: string) { result = value; return this; } } as unknown as Response;
  injectSupportUi({ path } as Request, response, () => {});
  response.send(body);
  return result;
}
test("support loader covers incomplete captured HTML and preserves the last closing tag", () => {
  assert.ok(inject("<html><body>captured").endsWith('src="/api/support/widget.js"></script>'));
  const complete = inject('<body><script>var s="</body>";</script></body>');
  assert.ok(complete.includes('var s="</body>"'));
  assert.ok(complete.endsWith('src="/api/support/widget.js"></script></body>'));
  assert.ok(inject("<body></body>", "/banana777").includes("/api/support/admin-ui.js"));
  assert.equal(inject("<body>example</body>", "/api/example"), "<body>example</body>");
});
test("captured CSP permits first-party support scripts/streams without removing other restrictions", () => {
  const result = inject(`<html><meta http-equiv=content-security-policy content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:"><body>`);
  assert.ok(result.includes("default-src 'none'"));
  assert.ok(result.includes("script-src 'unsafe-inline' 'self'"));
  assert.ok(result.includes("connect-src 'self'"));
  assert.ok(result.includes("font-src data:"));
  assert.ok(result.includes("style-src 'unsafe-inline'"));
});
