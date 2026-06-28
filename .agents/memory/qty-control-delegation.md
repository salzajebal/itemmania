---
name: Quantity control event delegation
description: Why direct button listeners in injectProduct fail; document-level delegation in init() is the fix.
---

## Rule
수량 +/- 버튼 이벤트 리스너는 `injectProduct` 내 IIFE가 아닌 `SELL_APPLICATION_INTERCEPT_SCRIPT`의 `init()` 함수 안에 `document.addEventListener('click', ...)` **위임** 방식으로 등록해야 한다.

**Why:** `injectProduct`는 MutationObserver + retry timers에 의해 반복 호출되는데, 내부 IIFE에서 `addEventListener`를 등록해도 클릭 이벤트가 발화하지 않는다. 정확한 원인은 불명확하지만 `SELL_APPLICATION_INTERCEPT_SCRIPT`의 전역 error suppressor(`addEventListener('error', fn, true)`)가 무음 처리할 가능성이 높다. `init()`은 DOM ready 시점에 확실히 실행되고, document 위임은 DOM 타이밍 의존성이 없어 항상 신뢰할 수 있다.

**How to apply:**
- 수량 버튼 핸들러: `document.addEventListener('click', fn)` — `btn.closest('.quantity_input')`으로 scope 검사
- 가격은 클릭 핸들러 실행 시 `window.__PRODUCT__ || window._IM_PRODUCT`에서 lazy 읽기
- `injectProduct` 안에는 이벤트 리스너 코드를 넣지 않는다
