---
name: Snapshot JS listener interference on game search
description: Snapshot JS attaches event listeners to searchRegGameServer input; fix is cloneNode + removeAttribute('id')
---

## The Rule

When setting up game search on sell/buy register pages, ALWAYS clone the input before calling `setupGameSearch()`. Do NOT call `setupGameSearch(document.getElementById('searchRegGameServer'))` directly.

```js
var orig = document.getElementById('searchRegGameServer');
var clone = orig.cloneNode(true);
orig.removeAttribute('id');           // prevent snapshot JS re-querying by id
orig.parentNode.replaceChild(clone, orig);
setupGameSearch(clone);
```

**Why:** The snapshot HTML's inline JS attaches event listeners to `#searchRegGameServer` at DOMContentLoaded. These listeners call external `itemmania.com` APIs that fail (CORS/network). The failure handler writes "검색 결과가 없습니다" into `.game ul`, overwriting our correctly-rendered game list. `cloneNode(true)` strips all pre-attached listeners; `removeAttribute('id')` on the original (now out of DOM) prevents the snapshot JS from re-querying the clone by id and re-attaching.

**How to apply:** Both `SELL_REGISTER_INTERCEPT_SCRIPT` and `BUY_REGISTER_INTERCEPT_SCRIPT` `init()` functions must use this pattern. Already implemented in proxy.ts ~line 1779 and ~line 2220.

## Companion findings

- `id=searchRegGameServer` = registration form search input (correct target)
- `id=searchGameServer` = header search bar (wrong target for registration)
- Snapshot HTML also has stale values to strip: `user_price`, `user_character`, `coms_area style=display:block`
- Strip stale values from HTML files directly via Python regex, AND clear in `clearSnapshot()` JS function
