---
name: SingleFile charge page clipping
description: SingleFile-captured charge pages have an anonymous inner div inside #g_POPUP that clips content after .mile_detail; must inject charge UI via JS outside the clipped area.
---

## The Rule
Never try to make existing form content (m_chargelist, real_price, m_button) visible inside the SingleFile captured charge HTML — the inner anonymous `<div>` inside `#g_POPUP` clips it regardless of CSS overrides, inline styles, or overflow:visible on ancestors.

**Why:** The SingleFile HTML has a nameless `<div>` directly inside `#g_POPUP` which wraps `#title_wrapper` and `#menu_wrapper`. This div has computed height constraints from the original CSS cascade that cannot be overridden reliably. Content inside `#charge_main` (which is inside this div) is clipped after `.mile_detail` renders.

**How to apply:**
- In `CHARGE_INTERCEPT_SCRIPT`, dynamically build the charge UI with JS and insert it via `popup.parentNode.insertBefore(panel, popup.nextSibling)` — i.e., as a sibling AFTER `#g_POPUP`, not inside it.
- Hide existing `#charge_main` and `.m_button` via `el.style.setProperty('display','none','important')`.
- Read amounts from existing `input[name=selectPrice]` radios (they're in DOM but clipped visually).
- The `fixOverflow()` function traverses ancestors and sets `overflow:visible` — keep this as a precaution.
- The new panel uses entirely inline styles so no CSS from the captured page can affect it.
