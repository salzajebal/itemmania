---
name: Itemmania clone architecture
description: Core architectural decisions for the itemmania.com clone — proxy, auth, and money flow separation.
---

## Rule
All auth, wallet, escrow, and order flows run 100% on our Express/PostgreSQL server. The `/proxy/*` path reverse-proxies itemmania's HTML with cheerio script injection. No auth or payment requests ever reach itemmania's servers.

**Why:** The platform clones itemmania's browsing UX but handles all trust-critical flows (login, wallet, escrow) independently to avoid dependency on itemmania's auth/payment systems.

**How to apply:**
- Server intercept script (`src/lib/proxy.ts`) overrides `window.fetch` and XHR to block itemmania API calls.
- Script sends `postMessage({type:'IM_LOGIN'})` and `postMessage({type:'IM_BUY', ...})` to the parent React app when user clicks native itemmania buttons.
- Parent React app listens for these messages and opens our own auth/buy modals.
- itemmania.com is NOT reachable from Replit's sandbox (blocked/timeout) — the proxy gracefully falls back to a 502 error page with DB-cached products.
- Home page shows our own product grid (from DB) as primary UX, not an iframe.
