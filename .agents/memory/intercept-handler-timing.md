---
name: Intercept script handler timing
description: Why document.addEventListener inside init() misses clicks and how to fix it reliably.
---

## The Rule

Any `document.addEventListener` that needs to intercept clicks MUST be registered at the IIFE top level, NOT inside `init()`.

**Why:** Scripts injected before `</body>` run while `document.readyState === 'loading'`. This causes the `if (readyState === 'loading') addEventListener('DOMContentLoaded', init)` branch to fire, deferring `init()`. If the test agent (Playwright) clicks immediately after page load, the handler is not yet registered and the click is missed.

**How to apply:**
1. Define the handler function (e.g. `window._im_on_sell_btn`) at IIFE top level so it's available immediately.
2. Register `document.addEventListener('click', ..., true)` at IIFE top level (outside `init()`).
3. As belt-and-suspenders: inject `onclick="window._handler&&window._handler(this)"` into the element HTML server-side (in `serveBuyApplication()` or equivalent), so the onclick fires even if the addEventListener was missed.

**When it triggers:**
- Any time you add click/event handlers to injected scripts that go into `</body>` via `serveBuyApplication`, `serveApplication`, etc.
- Especially for "action buttons" (판매신청, 채팅, 찜하기) where the handler must be active immediately.
