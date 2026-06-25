---
name: Snapshot HTML data injection
description: How to reliably inject dynamic DB data into SingleFile snapshot HTML pages.
---

## Rule
Always use **server-side string/regex replacement** (`applyProductToHtml`) to substitute hardcoded snapshot values before serving. Do NOT rely on client-side JS injection alone.

## Why
- SingleFile snapshots have no explicit `<head>` tag; our injection fallback (`replace("<body", ...)`) puts the script before `<body>`, but `APPLICATION_DYNAMIC_SCRIPT` appended at end runs AFTER HTML is parsed.
- Despite `window.__PRODUCT__` being injected correctly and `injectProduct()` being present, the page still showed snapshot data — the JS-based injection appeared to have a timing or selector issue that was not diagnosed but **server-side replacement bypassed it entirely**.
- The snapshot has 0 `querySelector`/`textContent` calls — static HTML only. Server-side replace is therefore completely stable.

## How to apply
In `serveApplication()` (proxy.ts):
1. Call `applyProductToHtml(result, product)` first — replaces `<title>`, `.trade_subject` text, `<span id=trade_money>`, `dd.trade_money`, `.ql-editor.detail_text`, `.kind` breadcrumb.
2. Then inject `window.__PRODUCT__` script (still needed for client-side buy box / `renderBuyBox`).
3. Append `APPLICATION_DYNAMIC_SCRIPT` at end (handles buy button, MutationObserver etc.).

## Regex patterns used (sell-application-1.html)
- Title text in `.trade_subject`: `/(<div class=trade_subject>[\s\S]*?<span class=signboard>[^<]*<\/span>[^<]*)OOOOO[^\n]*OOOOO\s*/`
- Price span: `/<span id=trade_money>[^<]*<\/span>/`
- `dd.trade_money`: `/(<dd class=trade_money>)[\s\S]*?(<\/dd>)/`
- Description: `/(<div class="ql-editor detail_text">)[\s\S]*?(<\/div>)/`
- Breadcrumb: `/(<div class=kind>)[\s\S]*?(<\/div>)/`
