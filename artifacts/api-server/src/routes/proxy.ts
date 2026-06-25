import { Router, type IRouter, type Request } from "express";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// production: cwd = /home/runner/workspace, dev: cwd = artifacts/api-server
// 실제 static 폴더를 자동 탐지
const STATIC_DIR = (() => {
  const candidates = [
    join(process.cwd(), "src", "static"),
    join(process.cwd(), "artifacts", "api-server", "src", "static"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
})();
logger.info({ STATIC_DIR }, "static HTML 디렉토리");

// receipt_layer 캡처 파일 경로
const CAPTURED_RECEIPT_PATH = join(STATIC_DIR, "receipt-layer-captured.html");
let capturedReceiptHtml = "";
try {
  capturedReceiptHtml = readFileSync(CAPTURED_RECEIPT_PATH, "utf-8");
  logger.info("receipt-layer-captured.html 로드 완료 (캡처된 원본 사용)");
} catch {
  logger.info("receipt-layer-captured.html 없음 → MutationObserver로 자동 캡처 예정");
}

// 서버 시작 시 정적 HTML 파일을 메모리에 로드
const STATIC_HTML_PATH = join(STATIC_DIR, "itemmania.html");
let staticHtml = "";

try {
  staticHtml = readFileSync(STATIC_HTML_PATH, "utf-8");
  logger.info("itemmania.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "itemmania.html 로드 실패");
}

const LOGIN_HTML_PATH = join(STATIC_DIR, "login.html");
let loginHtml = "";

try {
  loginHtml = readFileSync(LOGIN_HTML_PATH, "utf-8");
  logger.info("login.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "login.html 로드 실패");
}

const JOIN_HTML_PATH = join(STATIC_DIR, "join.html");
let joinHtml = "";

try {
  joinHtml = readFileSync(JOIN_HTML_PATH, "utf-8");
  logger.info("join.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "join.html 로드 실패");
}

const JOIN_AGREE_HTML_PATH = join(STATIC_DIR, "join-agree.html");
let joinAgreeHtml = "";

try {
  joinAgreeHtml = readFileSync(JOIN_AGREE_HTML_PATH, "utf-8");
  logger.info("join-agree.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "join-agree.html 로드 실패");
}

const JOIN_FORM_HTML_PATH = join(STATIC_DIR, "join-form.html");
let joinFormHtml = "";

try {
  joinFormHtml = readFileSync(JOIN_FORM_HTML_PATH, "utf-8");
  logger.info("join-form.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "join-form.html 로드 실패");
}

const GIFTCARD_HTML_PATH = join(STATIC_DIR, "giftcard.html");
let giftcardHtml = "";

try {
  giftcardHtml = readFileSync(GIFTCARD_HTML_PATH, "utf-8");
  logger.info("giftcard.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "giftcard.html 로드 실패");
}

const GAMEMANIA_HTML_PATH = join(STATIC_DIR, "gamemania.html");
let gamemanaHtml = "";

try {
  gamemanaHtml = readFileSync(GAMEMANIA_HTML_PATH, "utf-8");
  logger.info("gamemania.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "gamemania.html 로드 실패");
}

const GAMECHARGE_HTML_PATH = join(STATIC_DIR, "game-charge.html");
let gamechargeHtml = "";

try {
  gamechargeHtml = readFileSync(GAMECHARGE_HTML_PATH, "utf-8");
  logger.info("game-charge.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "game-charge.html 로드 실패");
}

const SELL_LINEAGE_CLASSIC_HTML_PATH = join(STATIC_DIR, "sell-lineage-classic.html");
let sellLineageClassicHtml = "";

try {
  sellLineageClassicHtml = readFileSync(SELL_LINEAGE_CLASSIC_HTML_PATH, "utf-8");
  logger.info("sell-lineage-classic.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "sell-lineage-classic.html 로드 실패");
}

const SELL_MAPLESTORY_WORLD_HTML_PATH = join(STATIC_DIR, "sell-maplestory-world.html");
let sellMaplestoryWorldHtml = "";

try {
  sellMaplestoryWorldHtml = readFileSync(SELL_MAPLESTORY_WORLD_HTML_PATH, "utf-8");
  logger.info("sell-maplestory-world.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "sell-maplestory-world.html 로드 실패");
}

function loadSellHtml(filename: string): string {
  try {
    const html = readFileSync(join(STATIC_DIR, filename), "utf-8");
    logger.info(`${filename} 로드 완료`);
    return html;
  } catch (e) {
    logger.error({ err: e }, `${filename} 로드 실패`);
    return "";
  }
}

const buyLineageClassicHtml   = loadSellHtml("buy-lineage-classic.html");
const buyApplicationHtml      = loadSellHtml("buy-application-1.html");
const chatHtml                = loadSellHtml("chat.html");
const chatOrderedHtml         = loadSellHtml("chat-ordered.html");
const chatNewHtml             = loadSellHtml("chat-new.html");
const chatNewBuycheckHtml     = loadSellHtml("chat-new-buycheck.html");
const sellRegisterHtml        = loadSellHtml("sell-register.html");
const sellIndexViewHtml       = loadSellHtml("sell/index_view.html");
const buyRegisterHtml         = loadSellHtml("buy-register.html");
const sellNewHtml             = loadSellHtml("sell-new.html");
const batchGoodsHtml          = loadSellHtml("batch-goods.html");
const myroomHtml              = loadSellHtml("myroom.html");
const paymentListHtml         = loadSellHtml("payment-list.html");
const paymentPhoneListHtml    = loadSellHtml("payment-phone-list.html");
const sellApplicationHtml     = loadSellHtml("sell-application-1.html");
const sellMaplestoryHtml      = loadSellHtml("sell-maplestory.html");
const sellOdinHtml            = loadSellHtml("sell-odin.html");
const sellMabinogiHtml        = loadSellHtml("sell-mabinogi.html");
const sellLostarkHtml         = loadSellHtml("sell-lostark.html");
const sellLineageMHtml        = loadSellHtml("sell-lineage-m.html");
const sellGeosangHtml         = loadSellHtml("sell-geosang.html");
const sellAion2Html           = loadSellHtml("sell-aion2.html");
const sellDnfHtml             = loadSellHtml("sell-dnf.html");

// game_id → html 매핑 (TOP 10)
const SELL_HTML_MAP: Record<string, string> = {
  "5913": "", // 리니지클래식 — 별도 변수로 처리
  "5233": "", // 메이플스토리월드 — 별도 변수로 처리
  "138":  sellMaplestoryHtml,
  "4696": sellOdinHtml,
  "155":  sellMabinogiHtml,
  "2696": sellLostarkHtml,
  "3449": sellLineageMHtml,
  "101":  sellGeosangHtml,
  "5799": sellAion2Html,
  "281":  sellDnfHtml,
};

// 주입할 인터셉트 스크립트 (순수 JS/CSS, React 없음)
const INTERCEPT_SCRIPT = `
<style>
#_im_overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(0,0,0,0.55);
  align-items: center;
  justify-content: center;
}
#_im_overlay.active { display: flex; }
#_im_modal {
  position: relative;
  background: #fff;
  border-radius: 14px;
  padding: 36px 32px 28px;
  width: 400px;
  max-width: 92vw;
  box-shadow: 0 24px 64px rgba(0,0,0,0.22);
  font-family: 'Pretendard', -apple-system, sans-serif;
}
#_im_modal h2 {
  margin: 0 0 22px;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -.02em;
}
#_im_modal .tab-row {
  display: flex;
  gap: 0;
  margin-bottom: 22px;
  border-bottom: 2px solid #eee;
}
#_im_modal .tab-btn {
  flex: 1;
  padding: 10px 0;
  font-size: 15px;
  font-weight: 600;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  color: #999;
  transition: all .2s;
}
#_im_modal .tab-btn.on {
  color: #159EFD;
  border-bottom-color: #159EFD;
}
#_im_modal input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 13px 15px;
  margin-bottom: 10px;
  border: 1.5px solid #ddd;
  border-radius: 9px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color .2s;
}
#_im_modal input:focus { border-color: #159EFD; }
#_im_modal .submit-btn {
  display: block;
  width: 100%;
  padding: 14px;
  margin-top: 6px;
  background: #159EFD;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: -.01em;
  transition: background .2s;
}
#_im_modal .submit-btn:hover { background: #0d88e0; }
#_im_modal .errmsg {
  margin-top: 10px;
  min-height: 20px;
  font-size: 13px;
  color: #e03030;
  text-align: center;
}
#_im_modal .close-btn {
  position: absolute;
  top: 14px; right: 18px;
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #aaa;
  line-height: 1;
  padding: 4px;
}
#_im_modal .close-btn:hover { color: #333; }
</style>

<div id="_im_overlay">
  <div id="_im_modal">
    <button class="close-btn" id="_im_close">✕</button>
    <div id="_im_body"></div>
  </div>
</div>

<script>
(function(){
  var overlay = document.getElementById('_im_overlay');
  var modalBody = document.getElementById('_im_body');
  var closeBtn = document.getElementById('_im_close');
  var currentUser = null;

  // --- 모달 열기/닫기 ---
  function openModal(html) {
    modalBody.innerHTML = html;
    overlay.classList.add('active');
  }
  function closeModal() {
    overlay.classList.remove('active');
    modalBody.innerHTML = '';
  }
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) closeModal(); });

  // --- API 호출 ---
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  // --- 헤더 업데이트 ---
  function updateHeader() {
    var loginsDiv = document.querySelector('.header-logins');
    if (!loginsDiv) return;
    if (currentUser) {
      loginsDiv.innerHTML =
        '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' +
          (currentUser.nickname || currentUser.email) + '님' +
        '</span>' +
        '<div class="divider"></div>' +
        '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
      document.getElementById('_im_logout_btn').addEventListener('click', function(e){
        e.stopImmediatePropagation();
        api('POST','/auth/logout').then(function(){ currentUser=null; location.href='/'; });
      }, true);
    } else {
      loginsDiv.innerHTML =
        '<a href="/login" style="font-size:14px;font-weight:600;color:#2e2e2e;text-decoration:none">로그인</a>' +
        '<div class="divider"></div>' +
        '<a href="/join" style="font-size:14px;font-weight:600;color:#2e2e2e;text-decoration:none">회원가입</a>';
    }
  }

  // --- 로그인 폼 ---
  function showLogin() {
    openModal(
      '<h2>로그인</h2>' +
      '<div class="tab-row">' +
        '<button class="tab-btn on" onclick="(function(){'+
          'document.querySelectorAll(\\'#_im_modal .tab-btn\\').forEach(function(b){b.classList.remove(\\'on\\')});'+
          'event.target.classList.add(\\'on\\');'+
        '})()">로그인</button>' +
        '<button class="tab-btn" onclick="IM_showRegister()">회원가입</button>' +
      '</div>' +
      '<input type="email" id="_im_e" placeholder="이메일" />' +
      '<input type="password" id="_im_p" placeholder="비밀번호" />' +
      '<button class="submit-btn" onclick="IM_doLogin()">로그인</button>' +
      '<div class="errmsg" id="_im_err"></div>'
    );
    setTimeout(function(){ var el=document.getElementById('_im_e'); if(el) el.focus(); }, 50);
  }

  function showRegister() {
    openModal(
      '<h2>회원가입</h2>' +
      '<div class="tab-row">' +
        '<button class="tab-btn" onclick="IM_showLogin()">로그인</button>' +
        '<button class="tab-btn on" onclick="(function(){'+
          'document.querySelectorAll(\\'#_im_modal .tab-btn\\').forEach(function(b){b.classList.remove(\\'on\\')});'+
          'event.target.classList.add(\\'on\\');'+
        '})()">회원가입</button>' +
      '</div>' +
      '<input type="text" id="_im_n" placeholder="닉네임" />' +
      '<input type="email" id="_im_e" placeholder="이메일" />' +
      '<input type="password" id="_im_p" placeholder="비밀번호 (6자 이상)" />' +
      '<button class="submit-btn" onclick="IM_doRegister()">가입하기</button>' +
      '<div class="errmsg" id="_im_err"></div>'
    );
    setTimeout(function(){ var el=document.getElementById('_im_n'); if(el) el.focus(); }, 50);
  }

  // 전역으로 노출 (onclick에서 사용)
  window.IM_showLogin = showLogin;
  window.IM_showRegister = showRegister;

  window.IM_doLogin = function() {
    var email = (document.getElementById('_im_e')||{}).value || '';
    var pw    = (document.getElementById('_im_p')||{}).value || '';
    var errEl = document.getElementById('_im_err');
    if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }
    api('POST','/auth/login',{ email:email, password:pw }).then(function(data){
      if (data && data.id) {
        currentUser = data;
        updateHeader();
        closeModal();
      } else {
        errEl.textContent = (data && data.error) || '로그인에 실패했습니다.';
      }
    });
  };

  window.IM_doRegister = function() {
    var nick  = (document.getElementById('_im_n')||{}).value || '';
    var email = (document.getElementById('_im_e')||{}).value || '';
    var pw    = (document.getElementById('_im_p')||{}).value || '';
    var errEl = document.getElementById('_im_err');
    if (!nick || !email || !pw) { errEl.textContent = '모든 항목을 입력해주세요.'; return; }
    api('POST','/auth/register',{ nickname:nick, email:email, password:pw }).then(function(data){
      if (data && data.id) {
        currentUser = data;
        updateHeader();
        closeModal();
      } else {
        errEl.textContent = (data && data.error) || '가입에 실패했습니다.';
      }
    });
  };

  // --- 전체서비스 패널 토글 ---
  function initPanel() {
    var panel = document.getElementById('headerMainPanel');
    var menuBtn = document.querySelector('.header-menu');
    if (!panel || !menuBtn) { setTimeout(initPanel, 200); return; }

    // 패널 초기화: 항상 닫힌 상태로 강제 설정 (is-open이 붙은 채로 저장된 스냅샷 대비)
    panel.classList.remove('is-open');
    panel.removeAttribute('aria-hidden');
    panel.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    panel.style.visibility = 'hidden';
    panel.style.pointerEvents = 'none';

    function openPanel() {
      panel.classList.add('is-open');
      panel.style.visibility = '';
      panel.style.pointerEvents = '';
      panel.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closePanel() {
      panel.classList.remove('is-open');
      panel.style.visibility = 'hidden';
      panel.style.pointerEvents = 'none';
      panel.setAttribute('aria-hidden', 'true');
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    // 3단바 버튼 클릭
    menuBtn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (panel.classList.contains('is-open')) { closePanel(); } else { openPanel(); }
    }, true);

    // 배경 클릭으로 닫기
    panel.addEventListener('click', function(e) {
      if (e.target.hasAttribute('data-header-panel-close') ||
          e.target.classList.contains('header-panel-backdrop')) {
        closePanel();
      }
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) { closePanel(); }
    });

    // 패널 내부: 프록시 링크는 그냥 이동 (href는 이미 서버에서 rewrite됨)
    panel.addEventListener('click', function(e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.startsWith('/')) { closePanel(); }
    });
  }

  initPanel();

  // 차단 마커가 붙은 링크 클릭 → 준비 중 안내 (body 버블링만, document 전역 X)
  document.body.addEventListener('click', function(e) {
    var a = e.target.closest && e.target.closest('a[data-blocked]');
    if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
  });

  // --- 버튼 후킹 ---
  function hookButtons() {
    var loginsDiv = document.querySelector('.header-logins');
    if (!loginsDiv) { setTimeout(hookButtons, 200); return; }

    var loginBtn     = loginsDiv.querySelector('button');
    var registerLink = loginsDiv.querySelector('a');

    if (loginBtn) {
      loginBtn.addEventListener('click', function(e){
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/login';
      }, true);
    }
    if (registerLink) {
      registerLink.addEventListener('click', function(e){
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/login';
      }, true);
    }

    // Enter 키 로그인/가입 지원
    document.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && overlay.classList.contains('active')) {
        var submitBtn = document.querySelector('#_im_modal .submit-btn');
        if (submitBtn) submitBtn.click();
      }
    });

    // 채팅 버튼 → 별도 창으로 열기
    var chatBtn = document.querySelector('#chat_notice button[aria-label="채팅"], #chat_notice button');
    if (chatBtn) {
      chatBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
      }, true);
    }

    // 이미 로그인 여부 확인 + 외부 JS 덮어쓰기 방어
    window._IM_auth().then(function(data){
      if (data && data.id) { currentUser = data; }
      updateHeader();

      // 원본 itemmania.js가 .header-logins를 덮어쓸 경우 즉시 재적용
      var loginsTarget = document.querySelector('.header-logins');
      if (loginsTarget) {
        var _headerObserver = new MutationObserver(function(){
          _headerObserver.disconnect();
          updateHeader();
          setTimeout(function(){
            var t = document.querySelector('.header-logins');
            if (t) _headerObserver.observe(t, { childList: true, subtree: true, characterData: true });
          }, 50);
        });
        _headerObserver.observe(loginsTarget, { childList: true, subtree: true, characterData: true });
      }

      // 지연 안전장치: 원본 JS가 늦게 실행돼도 최종 상태 보장
      setTimeout(updateHeader, 300);
      setTimeout(updateHeader, 800);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookButtons);
  } else {
    hookButtons();
  }
})();
</script>
`;

// 로그인 페이지 전용 인터셉트 스크립트
const LOGIN_INTERCEPT_SCRIPT = `
<script>
(function() {
  function stripCSP() {
    document.querySelectorAll('meta[http-equiv="content-security-policy"]').forEach(el => el.remove());
  }

  function showError(msg) {
    var errEl = document.getElementById('_im_login_err');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.id = '_im_login_err';
      errEl.style.cssText = 'color:#e53e3e;font-size:14px;margin:8px 0 0;text-align:center;';
      var form = document.querySelector('form[name=g_LOGIN_FORM]');
      if (form) form.appendChild(errEl);
    }
    errEl.textContent = msg;
  }

  function init() {
    stripCSP();

    // 로그인 폼 가로채기
    var loginForm = document.querySelector('form[name=g_LOGIN_FORM]');
    if (loginForm) {
      loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var userId = document.getElementById('user_id').value.trim();
        var userPw = document.getElementById('user_password').value;
        var btn = loginForm.querySelector('button[type=submit]');
        if (btn) btn.disabled = true;

        try {
          var res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: userId, password: userPw })
          });
          var data = await res.json();
          if (res.ok) {
            var returnUrl = new URLSearchParams(location.search).get('returnUrl');
            location.href = returnUrl ? '/' : '/';
          } else {
            showError(data.error || '아이디 또는 비밀번호가 올바르지 않습니다.');
            if (btn) btn.disabled = false;
          }
        } catch(err) {
          showError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          if (btn) btn.disabled = false;
        }
      });
    }

    // 네이버/카카오 소셜 로그인 차단
    var naverBtn = document.getElementById('naver_id_login');
    if (naverBtn) {
      naverBtn.addEventListener('click', function(e) {
        e.preventDefault();
        alert('소셜 로그인은 지원하지 않습니다. 아이디/비밀번호로 로그인해주세요.');
      });
    }

    // 차단 마커 링크 → 준비 중 (body 버블링만)
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });

    // 헤더 로그인 버튼 → 현재 페이지 유지
    var headerLoginBtn = document.querySelector('.header-logins button');
    if (headerLoginBtn) {
      headerLoginBtn.addEventListener('click', function(e) {
        e.preventDefault();
      });
    }

    // 회원가입 링크 차단
    var joinLink = document.querySelector('.header-logins a');
    if (joinLink) {
      joinLink.addEventListener('click', function(e) {
        e.preventDefault();
        alert('회원가입은 메인 페이지에서 이용해주세요.');
        location.href = '/';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

const GIFTCARD_INTERCEPT_SCRIPT = `
<style>
/* 로그인 모달/오버레이 강제 숨김 */
.g_layer:not(.all_menu_layer),
.g_popup,
.g_dim,
[class*="login_layer"],
[class*="login_modal"],
[id*="login_layer"],
[id*="login_pop"] {
  display: none !important;
}
/* 캐러셀이 g_container min-height를 height:100%로 상속해 공백 발생 → 수정 */
.carousel_module { height: auto !important; }
.carousel_module > .banner_in > .banner_item .carousel_images {
  position: static !important;
  left: auto !important;
  transform: none !important;
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
}
.center_banner > .banner_item > a { height: auto !important; }
</style>
<script>
(function() {
  // 로그인 팝업 함수 무력화
  var noop = function() {};
  var loginFns = ['g_login_open','loginOpen','openLogin','showLogin','login_popup','loginPopup','g_login_popup'];
  loginFns.forEach(function(fn) { window[fn] = noop; });

  // MutationObserver로 동적으로 추가되는 로그인 모달 차단
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        var el = node;
        var cls = el.className || '';
        var id  = el.id || '';
        if (
          (cls.includes('g_layer') && !cls.includes('all_menu_layer')) ||
          cls.includes('g_popup') ||
          cls.includes('g_dim') ||
          id.toLowerCase().includes('login')
        ) {
          el.style.display = 'none';
        }
        // 자식 노드 중 로그인 모달도 처리
        el.querySelectorAll && el.querySelectorAll('.g_layer:not(.all_menu_layer), .g_popup, .g_dim').forEach(function(child) {
          child.style.display = 'none';
        });
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function init() {
    // 이미 있는 모달 숨김
    document.querySelectorAll('.g_layer:not(.all_menu_layer), .g_popup, .g_dim').forEach(function(el) {
      el.style.display = 'none';
    });

    // 로그인 팝업 함수 재무력화 (사이트 JS가 나중에 정의할 수 있으므로)
    loginFns.forEach(function(fn) { window[fn] = noop; });

    // 로그인 버튼 → 로그인 페이지 (특정 요소에만 핸들러)
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/login';
      }, true);
    }

    // 차단 마커 링크 → 준비 중 (body 버블링만, document 전역 X)
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

const GAMEMANIA_INTERCEPT_SCRIPT = `
<script>
(function() {
  // 차단 마커 링크 → 준비 중 (body 버블링만)
  document.body.addEventListener('click', function(e) {
    var a = e.target.closest && e.target.closest('a[data-blocked]');
    if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
  });
})();
</script>
`;

const GAMECHARGE_INTERCEPT_SCRIPT = `
<style>
/* 캐러셀이 g_container min-height를 height:100%로 상속해 거대한 공백 발생 → 수정 */
.carousel_module { height: auto !important; }
.carousel_module > .banner_in > .banner_item .carousel_images {
  position: static !important;
  left: auto !important;
  transform: none !important;
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
}
.center_banner > .banner_item > a { height: auto !important; }
</style>
<script>
(function() {
  var noop = function() {};
  var loginFns = ['showLogin','openLogin','g_login','gLogin','loginPop','loginPopup'];
  loginFns.forEach(function(fn) { try { window[fn] = noop; } catch(e) {} });

  // 로그인 팝업 MutationObserver로 억제
  var observer = new MutationObserver(function() {
    document.querySelectorAll('.g_layer:not(.all_menu_layer), .g_popup, .g_dim').forEach(function(el) {
      el.style.display = 'none';
    });
    loginFns.forEach(function(fn) { try { if (window[fn] !== noop) window[fn] = noop; } catch(e) {} });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function init() {
    document.querySelectorAll('.g_layer:not(.all_menu_layer), .g_popup, .g_dim').forEach(function(el) {
      el.style.display = 'none';
    });
    loginFns.forEach(function(fn) { try { window[fn] = noop; } catch(e) {} });

    // 로그인 버튼 → 로그인 페이지 (해당 요소에만)
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/login';
      }, true);
    }

    // 충전 submit 버튼 → 준비 중 (해당 요소에만)
    document.querySelectorAll('form button[type=submit], .charge_btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        alert('게임 충전 서비스는 현재 준비 중입니다.');
      }, true);
    });

    // 차단 마커 링크 → 준비 중 (body 버블링만)
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

function stripCsp(html: string): string {
  return html.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
    ""
  );
}

/**
 * itemmania.com 경로를 /... 경로로 매핑 (더 구체적인 경로 우선)
 * query string / fragment 보존
 */
function mapImPath(rawPath: string): string {
  const path = rawPath || '/';
  const qi = path.indexOf('?');
  const hi = path.indexOf('#');
  const end = qi >= 0 ? qi : (hi >= 0 ? hi : path.length);
  const base = path.slice(0, end);
  const qs   = path.slice(end);

  if (base.startsWith('/portal/user/p_login_form'))              return '/login';
  if (base.startsWith('/sell/list'))                             return '/sell/list.html' + qs;
  if (base.startsWith('/sell/application'))                      return '/sell/application.html' + qs;
  if (base.startsWith('/sell/new'))                              return '/sell/new.html' + qs;
  if (base.startsWith('/sell/index_view'))                       return '/sell/index_view.html' + qs;
  if (base === '/sell' || base === '/sell/')                     return '/sell/register.html';
  if (base.startsWith('/sell/'))                                 return '/sell/list.html' + qs;
  if (base.startsWith('/buy/register'))                          return '/buy/register.html' + qs;
  if (base.startsWith('/buy/application'))                       return '/buy/application.html' + qs;
  if (base.startsWith('/buy/list'))                              return '/buy/list.html' + qs;
  if (base === '/buy' || base === '/buy/')                       return '/buy/register.html';
  if (base.startsWith('/myroom/mileage/payment/payment_phone_list')) return '/myroom/mileage/payment/payment_phone_list.html' + qs;
  if (base.startsWith('/myroom/mileage/payment/payment_phone'))  return '/myroom/mileage/payment/payment_phone_list.html';
  if (base.startsWith('/myroom/mileage/payment/payment_switch')) return '/myroom/mileage/payment/payment_list.html';
  if (base.startsWith('/myroom/mileage/payment/payment_list'))   return '/myroom/mileage/payment/payment_list.html' + qs;
  if (base.startsWith('/myroom/batch_goods'))                    return '/myroom/batch_goods/index.html';
  if (base.startsWith('/myroom/chat/new_chat'))                  return '/myroom/chat/new_chat.html';
  if (base.startsWith('/myroom/chat/list'))                      return '/myroom/chat/list.html' + qs;
  if (base.startsWith('/myroom/chat'))                           return '/myroom/chat/list.html';
  if (base === '/myroom' || base === '/myroom/')                 return '/myroom/index.html';
  if (base.startsWith('/game_charge'))                           return '/game-charge';
  if (base.startsWith('/portal/giftcard'))                       return '/giftcard';
  if (base === '/' || base === '')                               return '/';
  // 알 수 없는 경로: / 하위로 보냄 (Express 404 또는 302 처리)
  return (base.startsWith('/') ? base : '/' + base) + qs;
}

/** HTML 전체(JS 문자열 포함)에서 외부 도메인을 제거/치환 */
function rewriteExternalLinks(html: string): string {
  let result = html;

  // itemmania.com 모든 URL → /... (regex 기반, query string 보존)
  result = result.replace(
    /https?:\/\/(?:www\.|m\.|ssadaprice\.)?itemmania\.com([^"'\s<>\u0022\u0027]*)/g,
    (_match: string, path: string) => mapImPath(path)
  );

  // gamemania.co.kr → 프록시 경로
  for (const host of [
    'https://www.gamemania.co.kr',
    'http://www.gamemania.co.kr',
    'https://gamemania.co.kr',
  ]) {
    result = result.split(host).join('/gamemania');
  }

  return result;
}

/** 모든 페이지에 주입되는 전역 네비게이션 인터셉터 — window.open / location.assign 등 재정의 */
// Replit iframe 에러 감지 차단 + 원본 itemmania.com JS 에러 억제
const ERROR_SUPPRESSOR = `<script>
(function(){
  // 모든 JS 에러 억제 (itemmania.com 원본 스크립트 SyntaxError 등)
  window.onerror = function(){ return true; };
  window.addEventListener('error', function(e){ e.stopImmediatePropagation(); }, true);
  window.addEventListener('unhandledrejection', function(e){ e.preventDefault(); e.stopImmediatePropagation(); }, true);
  // Replit/Vite runtime-error-plugin 의 postMessage 차단
  var _origPost = window.parent && window.parent !== window ? window.parent.postMessage.bind(window.parent) : null;
  if (_origPost) {
    window.parent.postMessage = function(data){ if (data && data.type === 'runtime-error') return; _origPost.apply(this, arguments); };
  }
})();
</script>`;

const GLOBAL_NAV_INTERCEPTOR = `<script>
(function(){
'use strict';
var ROUTE_MAP=[
  ['/portal/user/logout_ok.html','/'],
  ['/portal/user/p_logout_form.html','/'],
  ['/portal/user/logout.html','/'],
  ['/portal/user/p_login_form.html','/login'],
  ['/myroom/mileage/payment/payment_phone_list.html','/myroom/mileage/payment/payment_phone_list.html'],
  ['/myroom/mileage/payment/payment_switch.html','/myroom/mileage/payment/payment_list.html'],
  ['/myroom/mileage/payment/payment_phone.html','/myroom/mileage/payment/payment_phone_list.html'],
  ['/myroom/mileage/payment/payment_list.html','/myroom/mileage/payment/payment_list.html'],
  ['/myroom/batch_goods/index.html','/myroom/batch_goods/index.html'],
  ['/sell/application.html','/sell/application.html'],
  ['/sell/new.html','/sell/new.html'],
  ['/sell/list.html','/sell/list.html'],
  ['/sell/index_view.html','/sell/index_view.html'],
  ['/sell/','/sell/register.html'],
  ['/sell','/sell/register.html'],
  ['/buy/register.html','/buy/register.html'],
  ['/buy/application.html','/buy/application.html'],
  ['/buy/list.html','/buy/list.html'],
  ['/buy/','/buy/register.html'],
  ['/buy','/buy/register.html'],
  ['/myroom/chat/new_chat.html','/myroom/chat/new_chat.html'],
  ['/myroom/chat/list.html','/myroom/chat/list.html'],
  ['/myroom/chat/','/myroom/chat/list.html'],
  ['/myroom/chat','/myroom/chat/list.html'],
  ['/game_charge/','/game-charge'],
  ['/game_charge','/game-charge'],
  ['/portal/giftcard/','/giftcard'],
  ['/portal/giftcard','/giftcard'],
  ['/myroom/','/myroom/index.html'],
  ['/myroom','/myroom/index.html'],
  ['/','/'],
];
var IM_ORIGINS=[
  'https://www.itemmania.com','http://www.itemmania.com',
  'https://itemmania.com','http://itemmania.com',
];
var GM_ORIGINS=['https://www.gamemania.co.kr','http://www.gamemania.co.kr','https://gamemania.co.kr'];
function rewrite(url){
  if(!url||typeof url!=='string') return url;
  var u=url.trim();
  for(var g=0;g<GM_ORIGINS.length;g++) if(u.startsWith(GM_ORIGINS[g])) return '/gamemania';
  for(var i=0;i<IM_ORIGINS.length;i++){
    if(u.startsWith(IM_ORIGINS[i])){
      var path=u.slice(IM_ORIGINS[i].length)||'/';
      for(var r=0;r<ROUTE_MAP.length;r++){
        if(path===ROUTE_MAP[r][0]||path.startsWith(ROUTE_MAP[r][0])){
          return ROUTE_MAP[r][1]+(path.length>ROUTE_MAP[r][0].length?path.slice(ROUTE_MAP[r][0].length):'');
        }
      }
      return '/';
    }
  }
  return url;
}
/* ── fetch / XHR 인터셉터: itemmania.com API 호출 → 우리 API로 대체 ── */
var IM_API_ORIGINS=['https://www.itemmania.com','http://www.itemmania.com','https://itemmania.com','http://itemmania.com'];
function isImOrigin(url){if(!url)return false;for(var i=0;i<IM_API_ORIGINS.length;i++)if(url.startsWith(IM_API_ORIGINS[i]))return true;return false;}
function imPathOf(url){for(var i=0;i<IM_API_ORIGINS.length;i++)if(url.startsWith(IM_API_ORIGINS[i]))return url.slice(IM_API_ORIGINS[i].length);return url;}
/* 우리 API로 요청 라우팅 */
function proxyImFetch(url,init){
  var path=imPathOf(url);
  /* 상품 검색/목록 */
  if(/\/(item|goods|product|search|list)/.test(path)){
    var qs=path.includes('?')?path.slice(path.indexOf('?')):'';
    var params=new URLSearchParams(qs);
    var apiUrl='/api/products';
    var q=params.get('keyword')||params.get('search')||params.get('q')||params.get('search_keyword')||'';
    var game=params.get('search_game')||params.get('game_id')||params.get('game')||'';
    var parts=[];
    if(q) parts.push('search='+encodeURIComponent(q));
    if(game) parts.push('gameId='+encodeURIComponent(game));
    if(parts.length) apiUrl+='?'+parts.join('&');
    return fetch(apiUrl,{credentials:'include'});
  }
  /* 로그인 상태 확인 */
  if(/\/(session|auth|login|member|user)/.test(path)){
    return window._IM_auth();
  }
  /* 나머지 → 빈 JSON */
  return Promise.resolve(new Response(JSON.stringify({result:'ok',data:[]}),{status:200,headers:{'Content-Type':'application/json'}}));
}
/* fetch override */
var _origFetch=window.fetch;
window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url?input.url:'');
  if(isImOrigin(url)) return proxyImFetch(url,init);
  return _origFetch.apply(this,arguments);
};
/* XMLHttpRequest override */
var _XHR=window.XMLHttpRequest;
window.XMLHttpRequest=function(){
  var xhr=new _XHR();
  var _open2=xhr.open.bind(xhr);
  var _captured={url:null,method:'GET'};
  xhr.open=function(method,url){
    _captured.method=method; _captured.url=url;
    if(isImOrigin(url)){
      _open2.call(xhr,method,'/api/products');
      return;
    }
    return _open2.apply(xhr,arguments);
  };
  return xhr;
};
/* window.open → 현재 탭 이동 */
var _open=window.open;
window.open=function(url,target,feat){
  var rw=rewrite(url);
  if(rw!==url){location.href=rw;return null;}
  return _open?_open.call(window,url,target,feat):null;
};
/* location.assign / replace */
try{
  var _ass=location.assign.bind(location);
  var _rep=location.replace.bind(location);
  location.assign=function(u){_ass(rewrite(u));};
  location.replace=function(u){_rep(rewrite(u));};
}catch(e){}
/* 상품등록 버튼(.trade-btn-blue) 클릭 → 판매/구매 선택 모달 */
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a.trade-btn-blue');
  if(!a) return;
  var h=a.getAttribute('href')||'';
  if(h.indexOf('/sell/')>=0||h.indexOf('/sell?')>=0){
    e.preventDefault(); e.stopImmediatePropagation();
    // 이미 모달이 있으면 제거
    var old=document.getElementById('_im_reg_modal');
    if(old) old.remove();
    // 게임 ID 추출
    var gm=h.match(/[?&]game=(\d+)/);
    var gameId=gm?gm[1]:'';
    var modal=document.createElement('div');
    modal.id='_im_reg_modal';
    modal.style.cssText='position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)';
    modal.innerHTML='<div style="background:#fff;border-radius:16px;padding:36px 40px;min-width:340px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.18)">'
      +'<h3 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1d1d1d">상품 등록</h3>'
      +'<p style="margin:0 0 28px;color:#767676;font-size:14px">어떤 유형의 상품을 등록하시겠습니까?</p>'
      +'<div style="display:flex;gap:12px;justify-content:center">'
      +'<button id="_im_reg_sell" style="flex:1;padding:14px 0;border:2px solid #159EFD;border-radius:12px;background:#EDF8FF;font-size:16px;font-weight:700;color:#0070d2;cursor:pointer">📦 판매등록</button>'
      +'<button id="_im_reg_buy"  style="flex:1;padding:14px 0;border:2px solid #39A742;border-radius:12px;background:#ECF8EC;font-size:16px;font-weight:700;color:#2a7a2e;cursor:pointer">🛒 구매등록</button>'
      +'</div>'
      +'<button id="_im_reg_close" style="margin-top:18px;background:none;border:none;color:#9f9f9f;font-size:13px;cursor:pointer">닫기</button>'
      +'</div>';
    document.body.appendChild(modal);
    var sellUrl='/sell/register.html'+(gameId?'?game='+gameId:'');
    document.getElementById('_im_reg_sell').onclick=function(){modal.remove();location.href=sellUrl;};
    document.getElementById('_im_reg_buy').onclick=function(){modal.remove();location.href='/buy/register.html';};
    document.getElementById('_im_reg_close').onclick=function(){modal.remove();};
    modal.addEventListener('click',function(ev){if(ev.target===modal)modal.remove();});
    return;
  }
},true);
/* a[href] 전역 클릭 */
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href]');
  if(!a) return;
  var h=a.getAttribute('href')||'';
  var rw=rewrite(h);
  if(rw!==h){e.preventDefault();e.stopImmediatePropagation();location.href=rw;}
},true);
/* ── location.href setter 인터셉터 ── */
try{
  var _locDesc=Object.getOwnPropertyDescriptor(Location.prototype,'href');
  if(_locDesc&&_locDesc.set){
    Object.defineProperty(Location.prototype,'href',{
      get:_locDesc.get,
      set:function(val){
        var rw=rewrite(val);
        _locDesc.set.call(this,rw);
      },
      configurable:true
    });
  }
}catch(e){}
/* ── history.pushState / replaceState 인터셉터 ── */
try{
  var _push=history.pushState.bind(history);
  var _repl=history.replaceState.bind(history);
  history.pushState=function(s,t,url){_push(s,t,url?rewrite(String(url)):url);};
  history.replaceState=function(s,t,url){_repl(s,t,url?rewrite(String(url)):url);};
}catch(e){}
/* ── form submit 인터셉터 ── */
document.addEventListener('submit',function(e){
  var form=e.target;
  if(!form||form.tagName!=='FORM') return;
  var action=form.action||location.href;
  var rw=rewrite(action);
  if(rw!==action){
    e.preventDefault();
    e.stopImmediatePropagation();
    /* GET 폼: action 바꿔서 재제출 */
    if((form.method||'get').toLowerCase()==='get'){
      form.action=rw;
      form.submit();
    } else {
      /* POST 폼 (검색 등): 쿼리 파라미터로 변환해서 GET 이동 */
      var fd=new FormData(form);
      var params=new URLSearchParams();
      fd.forEach(function(v,k){params.set(k,String(v));});
      var qs=params.toString();
      location.href=rw+(qs?'?'+qs:'');
    }
  }
},true);
/* ── g_searchbar_form (게임 검색) 전용 처리 ── */
document.addEventListener('submit',function(e){
  var form=e.target;
  if(!form||form.id!=='g_searchbar_form') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  var inp=form.querySelector('input[name="searchGameServer"],input.search_gs_name');
  var keyword=(inp&&inp.value)||'';
  if(keyword){
    location.href='/sell/list.html?search_word='+encodeURIComponent(keyword);
  } else {
    location.href='/';
  }
},true);
/* ── 전역 헤더 로그인/로그아웃 업데이트 (모든 페이지 공통) ── */
function _imUpdateHeaderAuth(){
  var loginsDiv=document.querySelector('.header-logins');
  if(!loginsDiv) return;
  window._IM_auth().then(function(data){
    if(data&&data.id){
      loginsDiv.innerHTML=
        '<span style="font-size:14px;font-weight:600;color:#2e2e2e">'+(data.nickname||data.email)+'님</span>'+
        '<div class="divider"></div>'+
        '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
      document.getElementById('_im_logout_btn').addEventListener('click',function(e){
        e.stopImmediatePropagation();
        fetch('/api/auth/logout',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}})
          .catch(function(){}).then(function(){ location.href='/'; });
      },true);
    } else {
      loginsDiv.innerHTML=
        '<a href="/login" style="font-size:14px;font-weight:600;color:#2e2e2e;text-decoration:none">로그인</a>'+
        '<div class="divider"></div>'+
        '<a href="/join" style="font-size:14px;font-weight:600;color:#2e2e2e;text-decoration:none">회원가입</a>';
    }
  });
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',_imUpdateHeaderAuth);
}else{
  _imUpdateHeaderAuth();
}
})();
</script>`;

function buildUserScript(user: Record<string, unknown> | null): string {
  return `<script>window._IM_USER=${user ? JSON.stringify(user) : 'null'};window._IM_auth=function(){return Promise.resolve(window._IM_USER||null);};</script>`;
}

async function getSessionUser(req: Request): Promise<Record<string, unknown> | null> {
  const userId = (req.session as { userId?: number })?.userId;
  if (!userId) return null;
  try {
    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      nickname: usersTable.nickname,
      role: usersTable.role,
      authStates: usersTable.authStates,
    }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      authStates: user.authStates ?? { excellent: false, phone: false, email: false, ipin: false, withdraw: false },
    };
  } catch {
    return null;
  }
}

function prepare(html: string, user: Record<string, unknown> | null = null): string {
  const clean = rewriteExternalLinks(stripCsp(html));
  const headInject = buildUserScript(user) + ERROR_SUPPRESSOR + GLOBAL_NAV_INTERCEPTOR;
  // <head> 또는 문서 맨 앞에 에러 억제 + 전역 인터셉터 주입
  if (clean.includes("<head>")) {
    return clean.replace("<head>", "<head>" + headInject);
  }
  if (clean.includes("<head ")) {
    return clean.replace(/<head [^>]*>/, (m) => m + headInject);
  }
  return headInject + clean;
}

function serveItemmania(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", INTERCEPT_SCRIPT + "</body>");
  }
  return result + INTERCEPT_SCRIPT;
}

function serveLogin(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", LOGIN_INTERCEPT_SCRIPT + "</body>");
  }
  return result + LOGIN_INTERCEPT_SCRIPT;
}

function serveGiftcard(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", GIFTCARD_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GIFTCARD_INTERCEPT_SCRIPT;
}

function serveGamemania(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", GAMEMANIA_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GAMEMANIA_INTERCEPT_SCRIPT;
}

function serveGameCharge(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", GAMECHARGE_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GAMECHARGE_INTERCEPT_SCRIPT;
}

const SELL_INTERCEPT_SCRIPT = `
<script>
(function() {
  function isLoggedIn() {
    return !!(window._IM_USER && window._IM_USER.id);
  }

  function showLoginModal() {
    const ov = document.getElementById('_im_overlay');
    if (ov) { ov.classList.add('active'); return; }
    const div = document.createElement('div');
    div.innerHTML = '<div id="_im_overlay" style="display:flex;position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);align-items:center;justify-content:center"><div style="background:#fff;border-radius:14px;padding:36px 32px 28px;width:380px;max-width:92vw;box-shadow:0 24px 64px rgba(0,0,0,.22);font-family:Pretendard,-apple-system,sans-serif"><div style="text-align:right;margin-bottom:8px"><button id="_im_close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">&times;</button></div><h2 style="margin:0 0 8px;font-size:22px;font-weight:700">로그인이 필요합니다</h2><p style="color:#555;margin:0 0 24px;font-size:14px">구매하시려면 먼저 로그인해주세요.</p><button id="_im_login_btn" style="width:100%;padding:14px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer">로그인하기</button></div></div>';
    document.body.appendChild(div.firstChild);
    document.getElementById('_im_close').onclick = function() { document.getElementById('_im_overlay').style.display='none'; };
    document.getElementById('_im_login_btn').onclick = function() { location.href='/login'; };
  }

  function interceptBuyButtons() {
    document.querySelectorAll('a.buy-btn, a[href*="buy"], a[href*="order"], button.buy-btn, .btn_buy, .sell-buy-btn, a.btn_trade, .item-buy-btn, [class*="buy"], [class*="order_btn"]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (!isLoggedIn()) { e.preventDefault(); e.stopPropagation(); showLoginModal(); }
      }, true);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    // 삽니다 탭 → 삽니다 목록으로 이동 (search_game 유지)
    document.querySelectorAll('button[data-type="buy"]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var params = new URLSearchParams(location.search);
        var game = params.get('search_game') || '5913';
        location.href = '/buy/list.html?search_game=' + game;
      }, true);
    });

    // 로그인·회원가입 버튼
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); location.href = '/login';
      });
    }
    var joinBtn = document.querySelector('.header-logins a');
    if (joinBtn) { joinBtn.href = '/login'; }

    // 구매 버튼 인터셉트
    interceptBuyButtons();

    // 동적 콘텐츠를 위한 MutationObserver
    var mo = new MutationObserver(function() { interceptBuyButtons(); });
    mo.observe(document.body, { childList: true, subtree: true });

    // 상품 리스트 아이템 클릭 → 상세 페이지 이동
    document.body.addEventListener('click', function(e) {
      var li = e.target.closest && e.target.closest('li.list_item[data-tid]');
      if (li) {
        var tid = li.getAttribute('data-tid');
        if (tid) {
          e.preventDefault(); e.stopPropagation();
          location.href = '/sell/application.html?id=' + tid;
        }
      }
    }, true);
  });
})();
</script>
`;

function serveLineageClassic(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  const combined = SELL_INTERCEPT_SCRIPT + SELL_LIST_INTERCEPT_SCRIPT;
  if (result.includes("</body>")) {
    return result.replace("</body>", combined + "</body>");
  }
  return result + combined;
}


const SELL_LIST_INTERCEPT_SCRIPT = `
<script>
(function() {
  function fmt(n) { return Number(n||0).toLocaleString('ko-KR'); }
  function timeLabel(d) {
    if (!d) return '';
    var dt = new Date(d), now = new Date(), diff = Math.floor((now - dt) / 1000);
    if (diff < 60) return diff + '초 전';
    if (diff < 3600) return Math.floor(diff/60) + '분 전';
    if (diff < 86400) return Math.floor(diff/3600) + '시간 전';
    return (dt.getMonth()+1) + '/' + dt.getDate();
  }
  function makeCard(p, type) {
    var li = document.createElement('li');
    li.className = 'list_item';
    li.setAttribute('data-tid', String(p.id));
    var href = '/' + type + '/application.html?id=' + p.id;
    li.innerHTML =
      '<div class="col info"><span class="credit_mark_new regular"></span></div>' +
      '<div class="col subject_info">' +
        '<ul class=server>' +
          '<li><a href="javascript:void(0)" data-search=game>' + (p.gameName||'') + '</a></li>' +
          (p.serverName ? '<li><a href="javascript:void(0)" data-search=server data-title="'+p.serverName+'">' + p.serverName + '</a></li>' : '') +
          '<li><a href="javascript:void(0)" data-search=goods>' + (p.itemCategory||'게임머니') + '</a></li>' +
        '</ul>' +
        '<a href="' + href + '" class="subject active">' +
          '<div><span class="text_ellipsis kind_title">' + p.title + '</span></div>' +
        '</a>' +
      '</div>' +
      '<div class="col quickicon"></div>' +
      '<div class="col quantity"></div>' +
      '<div class="col price"><span class=trade_money>' + fmt(p.price) + '원</span></div>' +
      '<div class="col reg_date">' + timeLabel(p.createdAt) + '</div>';
    return li;
  }

  // tab_bx data-value → DB itemCategory 값 매핑
  var ITEM_CAT_MAP = { all:'', money:'게임머니', item:'아이템', character:'계정', etc:'기타' };
  var SORT_MAP = { '1':'price_asc', '2':'recent', '3':'price_desc' };

  function getParams() {
    return new URLSearchParams(location.search);
  }

  function navigate(updates) {
    var q = new URLSearchParams(location.search);
    Object.keys(updates).forEach(function(k) {
      if (updates[k] === null || updates[k] === '') q.delete(k);
      else q.set(k, updates[k]);
    });
    q.delete('page'); // 필터 변경 시 1페이지로
    location.search = q.toString();
  }

  function initFilters() {
    var params = getParams();
    var currentItemCat = params.get('itemCategory') || '';
    var currentSort = params.get('sort') || 'recent';
    var currentServer = params.get('search_server') || '';
    var currentKeyword = params.get('keyword') || '';

    // ── 카테고리 탭 ──────────────────────────────────────
    document.querySelectorAll('button.tab_bx[data-value]').forEach(function(btn) {
      var val = btn.getAttribute('data-value');
      var mapped = ITEM_CAT_MAP[val] !== undefined ? ITEM_CAT_MAP[val] : '';
      if (mapped === currentItemCat) btn.classList.add('selected');
      else btn.classList.remove('selected');
      btn.addEventListener('click', function() {
        navigate({ itemCategory: mapped || null });
      });
    });

    // ── 정렬 버튼 (data-type=1/2/3만, sell/buy 탭 제외) ──
    document.querySelectorAll('button[data-type]').forEach(function(btn) {
      var t = btn.getAttribute('data-type');
      if (!SORT_MAP[t]) return; // sell/buy 탭은 스킵
      var sortVal = SORT_MAP[t];
      if (sortVal === currentSort || (sortVal === 'recent' && currentSort === 'recent')) {
        btn.classList.add('active');
        btn.style.fontWeight = '800';
        btn.style.color = '#159EFD';
      }
      btn.addEventListener('click', function() {
        navigate({ sort: sortVal === 'recent' ? null : sortVal });
      });
    });

    // ── 상품 검색 인풋 ───────────────────────────────────
    var searchInput = document.querySelector('input#word, input[name=word], input.g_text[placeholder=상품검색]');
    var searchBtn = document.querySelector('button.btn_search, .search_word button');
    if (searchInput) {
      if (currentKeyword) searchInput.value = currentKeyword;
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') navigate({ keyword: searchInput.value.trim() || null });
      });
    }
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', function() {
        navigate({ keyword: searchInput.value.trim() || null });
      });
    }

    // ── 서버 탭 (label/input[radio] 또는 button) ─────────
    document.querySelectorAll('.detail_search input[type=radio][name*=server], .detail_search input[type=radio][name*=Server]').forEach(function(radio) {
      radio.addEventListener('change', function() {
        var serverVal = radio.value || radio.getAttribute('data-value') || '';
        navigate({ search_server: serverVal || null });
      });
    });
    // 서버 버튼 직접 클릭
    document.querySelectorAll('.search_row button[data-server], .server_filter_btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var sv = btn.getAttribute('data-server') || btn.textContent.trim();
        navigate({ search_server: sv === '서버전체' ? null : sv });
      });
    });

    // ── 초기화 버튼 ──────────────────────────────────────
    document.querySelectorAll('button.reset_btn, a.reset_btn, .filter_reset').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var q = new URLSearchParams();
        var game = getParams().get('search_game');
        if (game) q.set('search_game', game);
        location.search = q.toString();
      });
    });
  }

  // 우리 DB 상품 카드에 뱃지 추가
  function makeCardWithBadge(p, type) {
    var li = makeCard(p, type);
    // 제목 앞에 [이테매니아] 뱃지 삽입
    var subjectDiv = li.querySelector('.col.subject_info');
    if (subjectDiv) {
      var badge = document.createElement('span');
      badge.style.cssText = 'display:inline-block;margin-bottom:4px;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;color:#fff;background:#159EFD;vertical-align:middle;margin-right:4px';
      badge.textContent = '우리 사이트';
      subjectDiv.insertBefore(badge, subjectDiv.firstChild);
    }
    return li;
  }

  function loadList() {
    var params = getParams();
    var gameCode = params.get('search_game') || '';
    var serverName = params.get('search_server') || '';
    var keyword = params.get('keyword') || '';
    var page = parseInt(params.get('page') || '1', 10);
    var sort = params.get('sort') || '';
    var type = location.pathname.indexOf('/buy/') >= 0 ? 'buy' : 'sell';

    var itemCat = params.get('itemCategory') || '';
    var apiQ = [];
    apiQ.push('category=' + type);
    if (gameCode) apiQ.push('gameCode=' + encodeURIComponent(gameCode));
    if (serverName) apiQ.push('serverName=' + encodeURIComponent(serverName));
    if (keyword) apiQ.push('keyword=' + encodeURIComponent(keyword));
    if (itemCat) apiQ.push('itemCategory=' + encodeURIComponent(itemCat));
    if (sort) apiQ.push('sort=' + encodeURIComponent(sort));
    apiQ.push('page=1');
    apiQ.push('limit=50');

    var normalList = document.querySelector('ul.search_list_normal');
    var premiumList = document.querySelector('ul.search_list_premium');
    var countEl = document.getElementById('premium_count');

    if (!normalList) return;

    // ── 아이템매니아 원본 리스팅 저장 (지우기 전에) ──────────────
    var origNormalItems = Array.from(normalList.querySelectorAll('li.list_item, li[data-tid]'));
    var origPremiumItems = premiumList ? Array.from(premiumList.querySelectorAll('li.list_item, li[data-tid]')) : [];
    var origNormalCount = origNormalItems.length;

    // 로딩 표시 (원본 유지하면서 맨 위에 삽입)
    var loadingEl = document.createElement('li');
    loadingEl.id = '_im_loading';
    loadingEl.style.cssText = 'padding:20px 0;text-align:center;color:#999;font-size:14px;list-style:none';
    loadingEl.textContent = '우리 사이트 상품을 불러오는 중...';
    normalList.insertBefore(loadingEl, normalList.firstChild);

    fetch('/api/products?' + apiQ.join('&'), { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var items = data.items || [];
        var ourTotal = data.total || 0;

        // 로딩 표시 제거
        var loadEl = document.getElementById('_im_loading');
        if (loadEl) loadEl.remove();

        // 전체 건수 업데이트 (우리 DB + 아이템매니아 원본)
        var totalCount = ourTotal + origNormalCount;
        if (countEl) countEl.textContent = fmt(totalCount) + '건';

        // 기존 원본 아이템매니아 리스팅 제거 (다시 정렬해서 붙일 것)
        origNormalItems.forEach(function(el) { el.remove(); });
        if (premiumList) origPremiumItems.forEach(function(el) { el.remove(); });

        // normalList 비우기
        normalList.innerHTML = '';

        // ── 우리 DB 상품 먼저 표시 ────────────────────────────────
        if (items.length > 0) {
          // 우리 사이트 상품 구분 헤더
          var ourHeader = document.createElement('li');
          ourHeader.style.cssText = 'padding:10px 16px;background:#EDF8FF;border-radius:8px;margin-bottom:4px;list-style:none;font-size:13px;font-weight:700;color:#159EFD;border-left:3px solid #159EFD';
          ourHeader.textContent = '★ 우리 사이트 등록 상품 (' + ourTotal + '건)';
          normalList.appendChild(ourHeader);
          items.forEach(function(p) { normalList.appendChild(makeCardWithBadge(p, type)); });
        }

        // ── 아이템매니아 원본 상품 이어서 표시 ───────────────────
        if (origNormalCount > 0) {
          if (items.length > 0) {
            // 구분선
            var sep = document.createElement('li');
            sep.style.cssText = 'padding:10px 16px;background:#f8f8f8;border-radius:8px;margin:8px 0 4px;list-style:none;font-size:13px;font-weight:700;color:#666;border-left:3px solid #ccc';
            sep.textContent = '아이템매니아 상품 (' + origNormalCount + '건)';
            normalList.appendChild(sep);
          }
          origNormalItems.forEach(function(el) { normalList.appendChild(el); });
        }

        // 둘 다 없으면 안내 메시지
        if (items.length === 0 && origNormalCount === 0) {
          normalList.innerHTML =
            '<li style="padding:60px 0;text-align:center;color:#999;font-size:15px;list-style:none">' +
            '등록된 상품이 없습니다.<br><br>' +
            '<a href="/' + type + '/register.html" style="display:inline-block;padding:12px 24px;background:#159EFD;color:#fff;border-radius:8px;font-weight:700;text-decoration:none">+ 첫 번째 상품 등록하기</a>' +
            '</li>';
        }

        // 프리미엄 리스트: 원본 복원
        if (premiumList && origPremiumItems.length > 0) {
          origPremiumItems.forEach(function(el) { premiumList.appendChild(el); });
        }

        // 페이지네이션 (우리 DB 기준)
        var totalPages = Math.ceil(ourTotal / 50);
        var gPaging = document.querySelector('ul.g_paging');
        var dvPaging = document.querySelector('div.dvPaging');
        if (gPaging) {
          gPaging.innerHTML = '';
          if (totalPages > 1) {
            var pageNums = document.createElement('li');
            pageNums.className = 'page_nums';
            var start = Math.max(1, page - 4), end = Math.min(totalPages, start + 9);
            for (var i = start; i <= end; i++) {
              var q2 = new URLSearchParams(location.search);
              q2.set('page', String(i));
              if (i === page) {
                var strong = document.createElement('strong');
                strong.textContent = String(i);
                pageNums.appendChild(strong);
              } else {
                var a = document.createElement('a');
                a.href = location.pathname + '?' + q2.toString();
                a.textContent = String(i);
                pageNums.appendChild(a);
              }
            }
            gPaging.appendChild(pageNums);
          } else {
            if (dvPaging) dvPaging.style.display = 'none';
          }
        }
      })
      .catch(function() {
        var loadEl2 = document.getElementById('_im_loading');
        if (loadEl2) loadEl2.remove();
        // 에러 시 원본 아이템매니아 항목만 유지
      });
  }

  function init() { loadList(); initFilters(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const SELL_REGISTER_INTERCEPT_SCRIPT = `
<style>
#charge_service,#dv_power,
.charge_service,.credit_benefit_area,#credit_benefit{display:none!important}

/* ─── 프리미엄/현금영수증 팝업 완전 제거 ─────────── */
#dvPremium,#receipt_layer{display:none!important;}

/* ─── 물품등록정보 팝업 오버레이 ─────────────────── */
#dvPopup{
  position:fixed!important;inset:0!important;z-index:10000!important;
  background:rgba(0,0,0,0.55)!important;
  display:none!important;
  align-items:flex-start!important;justify-content:center!important;
  padding:40px 16px!important;overflow-y:auto!important;
  box-sizing:border-box!important;
}
#dvPopup.im-show{display:flex!important;}

/* 팝업 흰 박스 + 파란 테두리 */
#dvPopup .inner{
  background:#fff!important;
  border-radius:10px!important;
  border:2px solid #159EFD!important;
  width:100%!important;max-width:640px!important;
  overflow:hidden!important;position:relative!important;
  text-align:left!important;
}
/* 제목 "물품등록정보" */
#dvPopup .title{
  display:block!important;
  font-size:18px!important;font-weight:700!important;color:#159EFD!important;
  padding:20px 22px 16px!important;margin:0!important;
  border-bottom:2px solid #159EFD!important;
  background:#fff!important;
}
/* 본문 영역 */
#dvPopup .cont{padding:18px 22px 0!important;}
/* 테이블 */
#dvPopup .g_blue_table{
  width:100%!important;border-collapse:collapse!important;margin-bottom:10px!important;
}
#dvPopup .g_blue_table th{
  background:#EEF5FF!important;font-size:13px!important;font-weight:600!important;
  padding:10px 14px!important;border:1px solid #D5E2F2!important;
  text-align:left!important;white-space:nowrap!important;color:#333!important;
}
#dvPopup .g_blue_table td{
  padding:10px 14px!important;border:1px solid #D5E2F2!important;
  font-size:13px!important;color:#222!important;
}
/* 거래 사고 주의사항 헤더 */
#dvPopup .attention{
  font-size:13px!important;font-weight:700!important;color:#e53e3e!important;
  margin:10px 0 6px!important;padding:0!important;
}
/* 빨간 경고 박스 */
#dvPopup .attention_box{
  padding:12px 16px!important;
  border:1px solid #f5c6cb!important;
  background:#FFF5F5!important;
  font-size:13px!important;line-height:1.75!important;
  margin-bottom:10px!important;border-radius:4px!important;
  list-style:none!important;
}
#dvPopup .attention_box li{
  margin-bottom:4px!important;list-style:none!important;padding:0!important;
}
#dvPopup .attention_box .deco{font-weight:700!important;}
#dvPopup .attention_box .f_blue3{color:#159EFD!important;font-size:12px!important;}
/* 약관 회색 박스 */
#dvPopup .box6{
  padding:10px 16px!important;
  border:1px solid #e0e0e0!important;
  background:#f9f9f9!important;
  font-size:12px!important;color:#555!important;
  line-height:1.75!important;margin-bottom:10px!important;border-radius:4px!important;
}
#dvPopup .box6 li{list-style:none!important;margin-bottom:2px!important;padding:0!important;}
#dvPopup .list_non::before{content:""!important;}
/* checkbox 영역 숨김 */
#dvPopup .warning_txt_layer{display:none!important;}
/* "등록하시려는 물품이 위와 같습니까?" */
#dvPopup .last_txt{
  text-align:center!important;font-size:14px!important;font-weight:600!important;color:#333!important;
  padding:14px 0 16px!important;border-top:1px solid #e8e8e8!important;margin-top:4px!important;
}
/* 버튼 영역 */
#dvPopup .g_btn_new{
  padding:0 22px 22px!important;display:flex!important;gap:10px!important;
}
/* 확인(파란) 버튼 */
#reg_submit{
  flex:1!important;padding:15px 0!important;
  background:#159EFD!important;color:#fff!important;border:none!important;
  border-radius:8px!important;font-size:16px!important;font-weight:700!important;
  cursor:pointer!important;
}
/* 취소(회색) 버튼 */
#cancel_submit{
  flex:1!important;padding:15px 0!important;
  background:#666!important;color:#fff!important;border:none!important;
  border-radius:8px!important;font-size:16px!important;font-weight:700!important;
  cursor:pointer!important;
}
</style>
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  // ── 게임 검색 자동완성 ───────────────────────────────────────────
  // 기존 HTML의 .g_search_frame (#reg_gameserver) 3열 구조 활용:
  // .game(게임목록) | .server(서버목록) | .goods(카테고리)
  function setupGameSearch(inp) {
    if (!inp) return;
    var _debounce = null;

    // 기존 #reg_gameserver 드롭다운 찾기
    var frame = document.getElementById(\'reg_gameserver\');
    if (!frame) {
      var p = inp.parentElement;
      for (var k = 0; k < 10 && p; k++) {
        var found = p.querySelector(\'.g_search_frame\');
        if (found) { frame = found; break; }
        p = p.parentElement;
      }
    }

    // fallback: 커스텀 드롭다운
    var useCustom = !frame;
    var dd = null;
    if (useCustom) {
      var wrapper = inp.parentElement;
      for (var wk = 0; wk < 8 && wrapper; wk++) {
        if (wrapper.classList && wrapper.classList.contains(\'g_search_wrapper\')) break;
        wrapper = wrapper.parentElement;
      }
      var existDd = document.getElementById(\'_im_game_dd_fb\');
      if (existDd) existDd.remove();
      dd = document.createElement(\'div\');
      dd.id = \'_im_game_dd_fb\';
      dd.style.cssText = \'position:absolute;top:38px;left:0;width:100%;z-index:200;\'
        + \'background:var(--color-body,#fff);border:4px solid var(--color-blue7,#159EFD);\'
        + \'border-top:0;border-radius:0 0 15px 15px;overflow-y:auto;max-height:320px;\'
        + \'box-sizing:border-box;padding:8px 0;display:none;box-shadow:0 8px 24px rgba(0,0,0,.12)\';
      if (wrapper) wrapper.appendChild(dd);
    }

    var listEl = frame ? (document.getElementById(\'reg_gameserver_list\') || frame.querySelector(\'.gs_list\')) : null;

    function showDrop() {
      if (useCustom && dd) { dd.style.display = \'block\'; }
      else if (frame) {
        frame.classList.remove(\'g_hidden\');
        // .g_search_frame_wrapper{height:100%} collapse 방지 — inline으로 override
        frame.style.height = \'auto\';
        frame.style.overflow = \'visible\';
        var fw = frame.querySelector(\'.g_search_frame_wrapper\');
        if (fw) fw.style.height = \'auto\';
        var gl = frame.querySelector(\'.gs_list\');
        if (gl) { gl.style.minHeight = \'180px\'; gl.style.height = \'180px\'; }
      }
    }
    function hideDrop() {
      if (useCustom && dd) { dd.style.display = \'none\'; }
      else if (frame) {
        frame.classList.add(\'g_hidden\');
        frame.style.height = \'\';
        frame.style.overflow = \'\';
        var fw = frame.querySelector(\'.g_search_frame_wrapper\');
        if (fw) fw.style.height = \'\';
        var gl = frame.querySelector(\'.gs_list\');
        if (gl) { gl.style.minHeight = \'\'; gl.style.height = \'\'; }
      }
    }
    function dropContains(el) {
      if (useCustom && dd) return dd.contains(el);
      if (frame) return frame.contains(el);
      return false;
    }

    // ─── 구조화된 드롭다운 (기존 HTML 활용) ─────────────────────────
    function renderStructured(games) {
      var gameDiv = listEl.querySelector(\'.game\');
      var serverDiv = listEl.querySelector(\'.server\');
      if (!gameDiv) return;
      var gameUl = gameDiv.querySelector(\'ul\');
      if (!gameUl) { gameUl = document.createElement(\'ul\'); gameDiv.appendChild(gameUl); }
      gameUl.innerHTML = \'\';

      if (!games.length) {
        var li = document.createElement(\'li\');
        li.textContent = \'검색 결과가 없습니다\';
        li.style.cssText = \'color:#999;cursor:default\';
        gameUl.appendChild(li);
        if (serverDiv) { var su = serverDiv.querySelector(\'ul\'); if (su) su.innerHTML = \'\'; }
      } else {
        games.forEach(function(g, idx) {
          var li = document.createElement(\'li\');
          li.textContent = g.name;
          if (idx === 0) {
            li.classList.add(\'sel_on\');
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            renderStructuredServers(g, serverDiv);
          }
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            gameUl.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            renderStructuredServers(g, serverDiv);
          });
          gameUl.appendChild(li);
        });
      }

      // 카테고리(.goods) 클릭 처리
      var goodsDiv = listEl.querySelector(\'.goods\');
      if (goodsDiv && !goodsDiv._imBound) {
        goodsDiv._imBound = true;
        goodsDiv.querySelectorAll(\'li\').forEach(function(li) {
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            goodsDiv.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_category = li.textContent.replace(/NEW/g, \'\').trim();
            if (window._IM_sel_game) {
              inp.value = window._IM_sel_server
                ? window._IM_sel_game.name + \' (\' + window._IM_sel_server.name + \')\'
                : window._IM_sel_game.name;
              hideDrop();
            }
          });
        });
      }

      showDrop();
    }

    function renderStructuredServers(g, serverDiv) {
      if (!serverDiv) return;
      var serverUl = serverDiv.querySelector(\'ul\');
      if (!serverUl) { serverUl = document.createElement(\'ul\'); serverDiv.appendChild(serverUl); }
      serverUl.innerHTML = \'\';
      if (g.servers && g.servers.length) {
        g.servers.forEach(function(s, sidx) {
          var li = document.createElement(\'li\');
          li.textContent = s.name;
          if (sidx === 0) {
            li.classList.add(\'sel_on\');
            window._IM_sel_server = s;
            inp.value = g.name + \' (\' + s.name + \')\';
          }
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            serverUl.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_server = s;
            inp.value = g.name + \' (\' + s.name + \')\';
          });
          serverUl.appendChild(li);
        });
      } else {
        inp.value = g.name;
      }
    }

    // ─── 커스텀 드롭다운 fallback ────────────────────────────────────
    function renderCustom(games) {
      if (!dd) return;
      dd.innerHTML = \'\';
      if (!games.length) {
        var row = document.createElement(\'div\');
        row.style.cssText = \'padding:8px 16px;color:#999;font-size:14px\';
        row.textContent = \'검색 결과가 없습니다\';
        dd.appendChild(row);
      } else {
        games.forEach(function(g) {
          var row = document.createElement(\'div\');
          row.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px\';
          row.textContent = g.name + (g.servers && g.servers.length ? \' (\' + g.servers.length + \'개 서버)\' : \'\');
          row.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          row.addEventListener(\'click\', function() {
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            if (g.servers && g.servers.length) {
              renderCustomServers(g);
            } else {
              inp.value = g.name;
              hideDrop();
            }
          });
          dd.appendChild(row);
        });
      }
      showDrop();
    }

    function renderCustomServers(g) {
      if (!dd) return;
      dd.innerHTML = \'\';
      var back = document.createElement(\'div\');
      back.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px;color:#0070d2;font-weight:600;border-bottom:1px solid #eee;margin-bottom:4px\';
      back.textContent = \'← \' + g.name + \' (게임 목록)\';
      back.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
      back.addEventListener(\'click\', function() { search(inp.value); });
      dd.appendChild(back);
      g.servers.forEach(function(s) {
        var row = document.createElement(\'div\');
        row.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px\';
        row.textContent = s.name;
        row.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
        row.addEventListener(\'click\', function() {
          window._IM_sel_server = s;
          inp.value = g.name + \' (\' + s.name + \')\';
          hideDrop();
        });
        dd.appendChild(row);
      });
      showDrop();
    }

    function search(q) {
      clearTimeout(_debounce);
      _debounce = setTimeout(function() {
        fetch(\'/api/games/search?q=\' + encodeURIComponent(q || \'\'), { credentials: \'include\' })
          .then(function(r) { return r.json(); })
          .then(function(games) {
            if (!useCustom && listEl) renderStructured(games);
            else renderCustom(games);
          })
          .catch(function() {});
      }, q ? 200 : 0);
    }

    inp.addEventListener(\'focus\', function() { if (inp.value.trim()) search(inp.value); }, true);
    inp.addEventListener(\'input\', function() { if (inp.value.trim()) search(inp.value); else hideDrop(); }, true);
    document.addEventListener(\'click\', function(e) {
      if (e.target !== inp && !dropContains(e.target)) hideDrop();
    });
  }

  function clearSnapshot() {
    // 폼 검색 입력(searchRegGameServer)과 헤더 검색(searchGameServer) 모두 초기화
    var _clearIds = ['searchRegGameServer','searchGameServer','user_price','user_title','user_character'];
    _clearIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el && !el._imUserTouched) el.value = '';
    });
    var qlEditor = document.querySelector('.ql-editor');
    if (qlEditor && !qlEditor._imUserTouched) qlEditor.innerHTML = '<p><br></p>';
    window._IM_sel_game = null;
    window._IM_sel_server = null;
    window._IM_sel_category = null;
    document.querySelectorAll('.g_search_frame .goods li, .gs_list .goods li').forEach(function(li) {
      li.classList.remove('sel_on');
    });
  }

  // ── 내 거래정보 섹션 동적 로딩 ───────────────────────────────────
  function loadUserTradeInfo() {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(me) {
        if (!me) return;
        var nameCell = document.getElementById('userNameCell');
        if (nameCell) nameCell.textContent = me.email || me.nickname || '';
        var phoneEl = document.getElementById('spnUserPhone');
        if (phoneEl) phoneEl.textContent = '';
        var cellEl = document.getElementById('spnUserCell');
        if (cellEl) cellEl.textContent = '';
        var mileageEl = document.getElementById('txtCurrentMileage');
        if (mileageEl && me.balance != null)
          mileageEl.textContent = Number(me.balance).toLocaleString() + '원';
      })
      .catch(function() {});
  }

  function init() {
    loadUserTradeInfo();
    // 2초간 80ms 인터벌로 스냅샷 JS 값 복원 차단
    clearSnapshot();
    var _clearTicker = setInterval(function() {
      var el = document.getElementById('searchRegGameServer') || document.getElementById('searchGameServer');
      if (el && el.value && !el._imUserTouched) el.value = '';
    }, 80);
    setTimeout(function() { clearInterval(_clearTicker); }, 2000);
    var _gsInp = document.getElementById('searchRegGameServer') || document.getElementById('searchGameServer');
    if (_gsInp) {
      _gsInp.addEventListener('focus', function() { _gsInp._imUserTouched = true; clearInterval(_clearTicker); }, { once: true });
    }

    // ── receipt_layer: 캡처된 원본 HTML 사용 or MutationObserver로 자동 캡처 ─────
    (function() {
      var rl = document.getElementById('receipt_layer');
      if (!rl) return;
      var captured = ${JSON.stringify(capturedReceiptHtml)};
      if (captured) {
        // 이미 캡처된 원본 HTML 사용
        if (!rl.querySelector('.inner')) rl.innerHTML = captured;
      } else {
        // 아직 캡처 전 → MutationObserver로 itemmania JS가 채울 때 자동 저장
        var obs = new MutationObserver(function(muts) {
          for (var i = 0; i < muts.length; i++) {
            var inner = rl.innerHTML.trim();
            if (inner && inner.length > 50) {
              obs.disconnect();
              fetch('/im-capture-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: inner
              }).then(function(r) {
                if (r.ok) console.log('[IM] receipt_layer 원본 캡처 완료 ✓');
              }).catch(function(e) {
                console.warn('[IM] receipt_layer 캡처 실패:', e);
              });
              break;
            }
          }
        });
        obs.observe(rl, { childList: true, subtree: true, characterData: true });
      }
    })();

    // 수수료 영역 초기 숨김
    var comsArea = document.getElementById('coms_area');
    if (comsArea) comsArea.style.display = 'none';

    // 가격 입력시 수수료 자동계산
    var priceInp = document.getElementById('user_price');
    if (priceInp) {
      priceInp.addEventListener('input', function() {
        var raw = parseInt(priceInp.value.replace(/[^0-9]/g, ''), 10) || 0;
        var fee = Math.round(raw * 0.05);
        var recv = raw - fee;
        var commEl = document.getElementById('commission_price');
        var recvEl = document.getElementById('receive_price');
        if (commEl) commEl.textContent = fee.toLocaleString();
        if (recvEl) recvEl.textContent = recv.toLocaleString();
        if (comsArea) comsArea.style.display = raw > 0 ? 'block' : 'none';
        // 천단위 콤마 표시
        priceInp.value = raw > 0 ? raw.toLocaleString() : '';
      });
    }

    // 스냅샷 JS 이벤트 리스너 완전 제거: cloneNode + id 변경으로 스냅샷 JS 재부착 차단
    (function() {
      var origIds = ['searchRegGameServer', 'searchGameServer'];
      var cleanInp = null;
      for (var _i = 0; _i < origIds.length; _i++) {
        var orig = document.getElementById(origIds[_i]);
        if (orig) {
          var clone = orig.cloneNode(true);
          // 스냅샷 JS가 id로 재쿼리해 리스너를 붙이지 못하도록 원본 id 제거
          orig.removeAttribute('id');
          // 클론에 id 유지 (폼 submit 핸들러 등이 참조)
          orig.parentNode.replaceChild(clone, orig);
          cleanInp = clone;
          break;
        }
      }
      // 게임 검색 자동완성 활성화
      setupGameSearch(cleanInp);
    })();

    // 구매등록 링크 → /buy/register.html
    document.querySelectorAll('a[href*="/buy/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/buy/') && !h.includes('/buy/list') && !h.includes('/buy/application')) {
        a.href = '/buy/register.html';
        a.addEventListener('click', function(e) {
          e.preventDefault(); location.href = '/buy/register.html';
        });
      }
    });

    // 판매등록 폼 제출 인터셉트
    var form = document.getElementById('frmSell');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200);
              return;
            }
            var gameEl = form.querySelector('[name=searchGameServer],[id=searchRegGameServer]');
            var priceEl = form.querySelector('[name=user_price]');
            var titleEl = form.querySelector('[name=user_title],[name=title_name]');
            var game = window._IM_sel_game ? window._IM_sel_game.name : (gameEl ? gameEl.value.trim() : '');
            var server = window._IM_sel_server ? window._IM_sel_server.name : '';
            var price = priceEl ? priceEl.value.trim() : '';
            var title = titleEl ? titleEl.value.trim() : '';
            if (!game) { showToast('게임을 선택해주세요.', false); return; }
            if (!price) { showToast('가격을 입력해주세요.', false); return; }
            if (!title) { showToast('상품명을 입력해주세요.', false); return; }
            fetch('/api/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                title: title,
                price: parseInt(price.replace(/[^0-9]/g, ''), 10),
                gameName: game,
                serverName: server,
                category: 'sell',
                itemCategory: window._IM_sel_category || '기타',
                sellerName: d.nickname || d.email
              })
            })
            .then(function(r) {
              if (r.ok) {
                return r.json().then(function(created) {
                  // 등록된 데이터 저장 (dvPopup 표시에 사용)
                  window._IM_reg_data = {
                    id: created.id || created.productId || '',
                    game: game,
                    server: server,
                    category: window._IM_sel_category || '기타',
                    title: title,
                    price: parseInt(price.replace(/[^0-9]/g, ''), 10),
                    tradeType: '일반판매'
                  };
                  // ── 팝업 플로우: dvPremium → receipt_layer → dvPopup → 완료 ──
                  function showOverlay() {
                    document.body.classList.add('mask_on');
                    var ov = document.getElementById('g_OVERLAY');
                    var sl = document.getElementById('g_SLEEP');
                    if (sl) sl.classList.remove('g_hidden');
                    if (ov) ov.style.display = 'block';
                  }
                  function hideOverlay() {
                    document.body.classList.remove('mask_on');
                    var ov = document.getElementById('g_OVERLAY');
                    var sl = document.getElementById('g_SLEEP');
                    if (sl) sl.classList.add('g_hidden');
                    if (ov) ov.style.display = 'none';
                  }
                  function fillAndShowDvPopup() {
                    var regData = window._IM_reg_data || {};
                    var catEl   = document.getElementById('popup_category');
                    var titleEl     = document.getElementById('popup_title');
                    var priceEl     = document.getElementById('popup_price');
                    var tradeTypeEl = document.getElementById('popup_trade_type');
                    if (catEl) {
                      var catStr = regData.game || '';
                      if (regData.server)   catStr += ' &gt; ' + regData.server;
                      if (regData.category) catStr += ' &gt; <span class=f_blue3>' + regData.category + '</span>';
                      catEl.innerHTML = catStr;
                    }
                    if (titleEl)     titleEl.textContent     = regData.title || '';
                    if (priceEl)     priceEl.textContent     = (regData.price || 0).toLocaleString() + '원';
                    if (tradeTypeEl) tradeTypeEl.textContent = regData.tradeType || '일반판매';
                    var dvPopup = document.getElementById('dvPopup');
                    showLayer(dvPopup);
                    // reg_submit(확인) → 완료 페이지
                    var regBtn = document.getElementById('reg_submit');
                    if (regBtn && !regBtn._imBound) {
                      regBtn._imBound = true;
                      regBtn.addEventListener('click', function() {
                        var rd  = window._IM_reg_data || {};
                        var pid = rd.id || '';
                        var gid = (window._IM_sel_game && window._IM_sel_game.id) ? window._IM_sel_game.id : '';
                        var cat = encodeURIComponent(rd.category || '');
                        var url = '/sell/index_view.html';
                        if (pid) {
                          url += '?id=' + pid;
                          if (gid) url += '&gid=' + gid;
                          if (cat) url += '&cat=' + cat;
                        }
                        location.href = url;
                      });
                    }
                    // cancel_submit(취소) → 팝업 닫기
                    var cancelBtn = document.getElementById('cancel_submit');
                    if (cancelBtn && !cancelBtn._imBound) {
                      cancelBtn._imBound = true;
                      cancelBtn.addEventListener('click', function() {
                        hideLayer(dvPopup);
                      });
                    }
                  }

                  // ── 팝업 show/hide 헬퍼 ──────────────────────────────────
                  function showLayer(el) {
                    if (!el) return;
                    el.classList.remove('sf-hidden');
                    el.classList.add('im-show');
                  }
                  function hideLayer(el) {
                    if (!el) return;
                    el.classList.remove('im-show');
                  }

                  // 프리미엄/현금영수증 건너뜀 → 바로 물품등록정보 표시
                  fillAndShowDvPopup();
                });
              } else {
                return r.json().then(function(e) { showToast('등록 실패: ' + (e.error || '오류'), false); });
              }
            })
            .catch(function() { showToast('서버 오류가 발생했습니다.', false); });
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── NEW 모드 버튼 (#change_mode data-mode=n) ───────────────────
    var newModeBtn = document.getElementById('change_mode');
    if (newModeBtn && newModeBtn.getAttribute('data-mode') === 'n') {
      newModeBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/sell/new.html';
      }, true);
    }

    // ── 물품일괄등록 (#batch_move) ──────────────────────────────────
    var batchBtn = document.getElementById('batch_move');
    if (batchBtn) {
      batchBtn.href = '/myroom/batch_goods/index.html';
      batchBtn.addEventListener('click', function(e) {
        e.preventDefault(); location.href = '/myroom/batch_goods/index.html';
      });
    }

    // 뒤로가기 / 홈
    var backLinks = document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]');
    backLinks.forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const BUY_REGISTER_INTERCEPT_SCRIPT = `
<style>
#charge_service,#dvPremium,.premium_info,.g_layer.premium_info,#dv_power,
.charge_service,.credit_benefit_area,#credit_benefit{display:none!important}

/* ─── 구매 물품등록정보 팝업 오버레이 ─────────────── */
#dvPopup{
  position:fixed!important;inset:0!important;z-index:10000!important;
  background:rgba(0,0,0,0.55)!important;
  display:none!important;
  align-items:flex-start!important;justify-content:center!important;
  padding:40px 16px!important;overflow-y:auto!important;
  box-sizing:border-box!important;
}
#dvPopup.im-show{display:flex!important;}

/* 팝업 흰 박스 + 초록 테두리 */
#dvPopup .inner{
  background:#fff!important;
  border-radius:10px!important;
  border:2px solid #39A742!important;
  width:100%!important;max-width:640px!important;
  overflow:hidden!important;position:relative!important;
  text-align:left!important;
}
/* 제목 "물품등록정보" */
#dvPopup .title{
  display:block!important;
  font-size:18px!important;font-weight:700!important;color:#39A742!important;
  padding:20px 22px 16px!important;margin:0!important;
  border-bottom:2px solid #39A742!important;
  background:#fff!important;
}
/* 본문 */
#dvPopup .cont{padding:18px 22px 0!important;}
/* 테이블 */
#dvPopup .g_blue_table{
  width:100%!important;border-collapse:collapse!important;margin-bottom:10px!important;
}
#dvPopup .g_blue_table th{
  background:#EEF5FF!important;font-size:13px!important;font-weight:600!important;
  padding:10px 14px!important;border:1px solid #D5E2F2!important;
  text-align:left!important;white-space:nowrap!important;color:#333!important;
}
#dvPopup .g_blue_table td{
  padding:10px 14px!important;border:1px solid #D5E2F2!important;
  font-size:13px!important;color:#222!important;
}
/* 거래 사고 주의사항 */
#dvPopup .attention{
  font-size:13px!important;font-weight:700!important;color:#e53e3e!important;
  margin:10px 0 6px!important;padding:0!important;
}
/* 빨간 경고 박스 */
#dvPopup .attention_box{
  padding:12px 16px!important;
  border:1px solid #f5c6cb!important;background:#FFF5F5!important;
  font-size:13px!important;line-height:1.75!important;
  margin-bottom:10px!important;border-radius:4px!important;
  list-style:none!important;
}
#dvPopup .attention_box li{margin-bottom:4px!important;list-style:none!important;padding:0!important;}
#dvPopup .attention_box .deco{font-weight:700!important;}
#dvPopup .attention_box .f_blue3{color:#159EFD!important;font-size:12px!important;}
/* 약관 회색 박스 */
#dvPopup .box6{
  padding:10px 16px!important;
  border:1px solid #e0e0e0!important;background:#f9f9f9!important;
  font-size:12px!important;color:#555!important;
  line-height:1.75!important;margin-bottom:10px!important;border-radius:4px!important;
}
#dvPopup .box6 li{list-style:none!important;margin-bottom:2px!important;padding:0!important;}
#dvPopup .list_non::before{content:""!important;}
/* "등록하시려는 물품이 위와 같습니까?" */
#dvPopup .last_txt{
  text-align:center!important;font-size:14px!important;font-weight:600!important;color:#333!important;
  padding:14px 0 16px!important;border-top:1px solid #e8e8e8!important;margin-top:4px!important;
}
/* 버튼 영역 */
#dvPopup .g_btn_new{padding:0 22px 22px!important;display:flex!important;gap:10px!important;}
/* 확인(초록) 버튼 */
#buy_reg_submit{
  flex:1!important;padding:15px 0!important;
  background:#39A742!important;color:#fff!important;border:none!important;
  border-radius:8px!important;font-size:16px!important;font-weight:700!important;cursor:pointer!important;
}
/* 취소(회색) 버튼 */
#buy_cancel_submit{
  flex:1!important;padding:15px 0!important;
  background:#666!important;color:#fff!important;border:none!important;
  border-radius:8px!important;font-size:16px!important;font-weight:700!important;cursor:pointer!important;
}
</style>
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#39A742' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  // ── 게임 검색 자동완성 ───────────────────────────────────────────
  // 기존 HTML의 .g_search_frame (#reg_gameserver) 3열 구조 활용:
  // .game(게임목록) | .server(서버목록) | .goods(카테고리)
  function setupGameSearch(inp) {
    if (!inp) return;
    var _debounce = null;

    // 기존 #reg_gameserver 드롭다운 찾기
    var frame = document.getElementById(\'reg_gameserver\');
    if (!frame) {
      var p = inp.parentElement;
      for (var k = 0; k < 10 && p; k++) {
        var found = p.querySelector(\'.g_search_frame\');
        if (found) { frame = found; break; }
        p = p.parentElement;
      }
    }

    // fallback: 커스텀 드롭다운
    var useCustom = !frame;
    var dd = null;
    if (useCustom) {
      var wrapper = inp.parentElement;
      for (var wk = 0; wk < 8 && wrapper; wk++) {
        if (wrapper.classList && wrapper.classList.contains(\'g_search_wrapper\')) break;
        wrapper = wrapper.parentElement;
      }
      var existDd = document.getElementById(\'_im_game_dd_fb\');
      if (existDd) existDd.remove();
      dd = document.createElement(\'div\');
      dd.id = \'_im_game_dd_fb\';
      dd.style.cssText = \'position:absolute;top:38px;left:0;width:100%;z-index:200;\'
        + \'background:var(--color-body,#fff);border:4px solid var(--color-blue7,#159EFD);\'
        + \'border-top:0;border-radius:0 0 15px 15px;overflow-y:auto;max-height:320px;\'
        + \'box-sizing:border-box;padding:8px 0;display:none;box-shadow:0 8px 24px rgba(0,0,0,.12)\';
      if (wrapper) wrapper.appendChild(dd);
    }

    var listEl = frame ? (document.getElementById(\'reg_gameserver_list\') || frame.querySelector(\'.gs_list\')) : null;

    // gs_list가 있어도 .game div 없으면 커스텀 드롭다운으로 전환 (buy 페이지 구조 대응)
    if (!useCustom && listEl && !listEl.querySelector(\'.game\')) {
      useCustom = true;
      listEl = null;
      var wrapperB = inp.parentElement;
      for (var wkB = 0; wkB < 8 && wrapperB; wkB++) {
        if (wrapperB.classList && wrapperB.classList.contains(\'g_search_wrapper\')) break;
        wrapperB = wrapperB.parentElement;
      }
      var existDdB = document.getElementById(\'_im_game_dd_fb\');
      if (existDdB) existDdB.remove();
      dd = document.createElement(\'div\');
      dd.id = \'_im_game_dd_fb\';
      dd.style.cssText = \'position:absolute;top:38px;left:0;width:100%;z-index:200;\'
        + \'background:var(--color-body,#fff);border:4px solid var(--color-blue7,#159EFD);\'
        + \'border-top:0;border-radius:0 0 15px 15px;overflow-y:auto;max-height:320px;\'
        + \'box-sizing:border-box;padding:8px 0;display:none;box-shadow:0 8px 24px rgba(0,0,0,.12)\';
      if (wrapperB) wrapperB.appendChild(dd);
    }

    function showDrop() {
      if (useCustom && dd) { dd.style.display = \'block\'; }
      else if (frame) {
        frame.classList.remove(\'g_hidden\');
        // .g_search_frame_wrapper{height:100%} collapse 방지 — inline으로 override
        frame.style.height = \'auto\';
        frame.style.overflow = \'visible\';
        var fw = frame.querySelector(\'.g_search_frame_wrapper\');
        if (fw) fw.style.height = \'auto\';
        var gl = frame.querySelector(\'.gs_list\');
        if (gl) { gl.style.minHeight = \'180px\'; gl.style.height = \'180px\'; }
      }
    }
    function hideDrop() {
      if (useCustom && dd) { dd.style.display = \'none\'; }
      else if (frame) {
        frame.classList.add(\'g_hidden\');
        frame.style.height = \'\';
        frame.style.overflow = \'\';
        var fw = frame.querySelector(\'.g_search_frame_wrapper\');
        if (fw) fw.style.height = \'\';
        var gl = frame.querySelector(\'.gs_list\');
        if (gl) { gl.style.minHeight = \'\'; gl.style.height = \'\'; }
      }
    }
    function dropContains(el) {
      if (useCustom && dd) return dd.contains(el);
      if (frame) return frame.contains(el);
      return false;
    }

    // ─── 구조화된 드롭다운 (기존 HTML 활용) ─────────────────────────
    function renderStructured(games) {
      var gameDiv = listEl.querySelector(\'.game\');
      var serverDiv = listEl.querySelector(\'.server\');
      if (!gameDiv) return;
      var gameUl = gameDiv.querySelector(\'ul\');
      if (!gameUl) { gameUl = document.createElement(\'ul\'); gameDiv.appendChild(gameUl); }
      gameUl.innerHTML = \'\';

      if (!games.length) {
        var li = document.createElement(\'li\');
        li.textContent = \'검색 결과가 없습니다\';
        li.style.cssText = \'color:#999;cursor:default\';
        gameUl.appendChild(li);
        if (serverDiv) { var su = serverDiv.querySelector(\'ul\'); if (su) su.innerHTML = \'\'; }
      } else {
        games.forEach(function(g, idx) {
          var li = document.createElement(\'li\');
          li.textContent = g.name;
          if (idx === 0) {
            li.classList.add(\'sel_on\');
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            renderStructuredServers(g, serverDiv);
          }
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            gameUl.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            renderStructuredServers(g, serverDiv);
          });
          gameUl.appendChild(li);
        });
      }

      // 카테고리(.goods) 클릭 처리
      var goodsDiv = listEl.querySelector(\'.goods\');
      if (goodsDiv && !goodsDiv._imBound) {
        goodsDiv._imBound = true;
        goodsDiv.querySelectorAll(\'li\').forEach(function(li) {
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            goodsDiv.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_category = li.textContent.replace(/NEW/g, \'\').trim();
            if (window._IM_sel_game) {
              inp.value = window._IM_sel_server
                ? window._IM_sel_game.name + \' (\' + window._IM_sel_server.name + \')\'
                : window._IM_sel_game.name;
              hideDrop();
            }
          });
        });
      }

      showDrop();
    }

    function renderStructuredServers(g, serverDiv) {
      if (!serverDiv) return;
      var serverUl = serverDiv.querySelector(\'ul\');
      if (!serverUl) { serverUl = document.createElement(\'ul\'); serverDiv.appendChild(serverUl); }
      serverUl.innerHTML = \'\';
      if (g.servers && g.servers.length) {
        g.servers.forEach(function(s, sidx) {
          var li = document.createElement(\'li\');
          li.textContent = s.name;
          if (sidx === 0) {
            li.classList.add(\'sel_on\');
            window._IM_sel_server = s;
            inp.value = g.name + \' (\' + s.name + \')\';
          }
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            serverUl.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_server = s;
            inp.value = g.name + \' (\' + s.name + \')\';
          });
          serverUl.appendChild(li);
        });
      } else {
        inp.value = g.name;
      }
    }

    // ─── 커스텀 드롭다운 fallback ────────────────────────────────────
    function renderCustom(games) {
      if (!dd) return;
      dd.innerHTML = \'\';
      if (!games.length) {
        var row = document.createElement(\'div\');
        row.style.cssText = \'padding:8px 16px;color:#999;font-size:14px\';
        row.textContent = \'검색 결과가 없습니다\';
        dd.appendChild(row);
      } else {
        games.forEach(function(g) {
          var row = document.createElement(\'div\');
          row.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px\';
          row.textContent = g.name + (g.servers && g.servers.length ? \' (\' + g.servers.length + \'개 서버)\' : \'\');
          row.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          row.addEventListener(\'click\', function() {
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            if (g.servers && g.servers.length) {
              renderCustomServers(g);
            } else {
              inp.value = g.name;
              hideDrop();
            }
          });
          dd.appendChild(row);
        });
      }
      showDrop();
    }

    function renderCustomServers(g) {
      if (!dd) return;
      dd.innerHTML = \'\';
      var back = document.createElement(\'div\');
      back.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px;color:#0070d2;font-weight:600;border-bottom:1px solid #eee;margin-bottom:4px\';
      back.textContent = \'← \' + g.name + \' (게임 목록)\';
      back.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
      back.addEventListener(\'click\', function() { search(inp.value); });
      dd.appendChild(back);
      g.servers.forEach(function(s) {
        var row = document.createElement(\'div\');
        row.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px\';
        row.textContent = s.name;
        row.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
        row.addEventListener(\'click\', function() {
          window._IM_sel_server = s;
          inp.value = g.name + \' (\' + s.name + \')\';
          hideDrop();
        });
        dd.appendChild(row);
      });
      showDrop();
    }

    function search(q) {
      clearTimeout(_debounce);
      _debounce = setTimeout(function() {
        fetch(\'/api/games/search?q=\' + encodeURIComponent(q || \'\'), { credentials: \'include\' })
          .then(function(r) { return r.json(); })
          .then(function(games) {
            if (!useCustom && listEl) renderStructured(games);
            else renderCustom(games);
          })
          .catch(function() {});
      }, q ? 200 : 0);
    }

    inp.addEventListener(\'focus\', function() { if (inp.value.trim()) search(inp.value); }, true);
    inp.addEventListener(\'input\', function() { if (inp.value.trim()) search(inp.value); else hideDrop(); }, true);
    document.addEventListener(\'click\', function(e) {
      if (e.target !== inp && !dropContains(e.target)) hideDrop();
    });
  }

  // ── 내 거래정보 섹션 동적 로딩 ───────────────────────────────────
  function loadUserTradeInfo() {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(me) {
        if (!me) return;
        var nameCell = document.getElementById('userNameCell');
        if (nameCell) nameCell.textContent = me.email || me.nickname || '';
        var phoneEl = document.getElementById('spnUserPhone');
        if (phoneEl) phoneEl.textContent = '';
        var cellEl = document.getElementById('spnUserCell');
        if (cellEl) cellEl.textContent = '';
        var mileageEl = document.getElementById('txtCurrentMileage');
        if (mileageEl && me.balance != null)
          mileageEl.textContent = Number(me.balance).toLocaleString() + '원';
      })
      .catch(function() {});
  }

  // ── 구매 팝업 HTML 주입 ──────────────────────────────────────────
  function injectBuyPopup() {
    var dvPopup = document.getElementById('dvPopup');
    if (!dvPopup) return;
    dvPopup.innerHTML = '<div class=inner>'
      + '<div class=title>물품등록정보</div>'
      + '<div class=cont>'
      + '<table class=g_blue_table><colgroup><col width=122><col width=180><col width=122><col width=180></colgroup>'
      + '<tbody><tr><th>카테고리</th><td colspan=3 id=buy_popup_category></td></tr></tbody></table>'
      + '<table class="g_blue_table g_blue_table2"><colgroup><col width=122><col width=180><col width=122><col width=180></colgroup>'
      + '<tbody>'
      + '<tr><th>물품제목</th><td colspan=3 id=buy_popup_title></td></tr>'
      + '<tr><th>거래유형</th><td id=buy_popup_trade_type>일반구매</td><th>구매금액</th><td id=buy_popup_price></td></tr>'
      + '</tbody></table>'
      + '<div class=attention>거래 사고 주의사항</div>'
      + '<ul class=attention_box>'
      + '<li>1. 전달받은 <span class=deco style="color:red">물품은 절대 돌려주지</span> 마세요.</li>'
      + '<li>2. 구매 등록 시 반드시 <span class=deco style="color:red">본인 정보(게임명/서버/캐릭터)를 등록</span>하세요.</li>'
      + '<li class=f_blue3>타인 게임정보 기재 또는, 다른 게임/서버에 구매 신청할 경우 물품신청자에게 불이익이 발생할 수 있습니다.</li>'
      + '</ul>'
      + '<ul class="box6 g_list">'
      + '<li>상대방의 판매 신청 후 10분 이내에 결제를 해주셔야만 거래가 가능합니다.</li>'
      + '<li>단, 즉시구매 등록 물품은 판매신청이 들어오면 바로거래가 가능합니다.</li>'
      + '<li>[물품등록유지기간]<br></li>'
      + '<li class=list_non>등록물품은 7일 후 자동으로 삭제됩니다. (계정거래의 경우 30일)<br></li>'
      + '<li class=list_non>* 팝니다/삽니다 등록물품 모두 포함</li>'
      + '<li class=list_non>단, 부가서비스 이용중인 물품의 경우 잔여 시간 경과 후 자동 삭제</li>'
      + '</ul>'
      + '<div class=last_txt>등록하시려는 물품이 위와 같습니까?</div>'
      + '<div class=g_btn_new>'
      + '<button type=button id=buy_reg_submit>확인</button>'
      + '<button type=button id=buy_cancel_submit>취소</button>'
      + '</div>'
      + '</div></div>';
  }

  // ── 구매 팝업 데이터 채우고 표시 ──────────────────────────────────
  function fillAndShowBuyPopup(data) {
    var dvPopup = document.getElementById('dvPopup');
    if (!dvPopup) return;
    var catEl = document.getElementById('buy_popup_category');
    var titEl = document.getElementById('buy_popup_title');
    var prcEl = document.getElementById('buy_popup_price');
    if (catEl) catEl.textContent = (data.gameName || '') + (data.serverName ? ' > ' + data.serverName : '') + (data.itemCategory ? ' > ' + data.itemCategory : '');
    if (titEl) titEl.textContent = data.title || '';
    if (prcEl) prcEl.textContent = Number(data.price || 0).toLocaleString() + '원';

    // 확인 버튼
    var regBtn = document.getElementById('buy_reg_submit');
    if (regBtn && !regBtn._imBound) {
      regBtn._imBound = true;
      regBtn.addEventListener('click', function() {
        location.href = '/buy/list.html';
      });
    }
    // 취소 버튼
    var cancelBtn = document.getElementById('buy_cancel_submit');
    if (cancelBtn && !cancelBtn._imBound) {
      cancelBtn._imBound = true;
      cancelBtn.addEventListener('click', function() {
        dvPopup.classList.remove('im-show');
      });
    }
    dvPopup.classList.remove('sf-hidden');
    dvPopup.classList.add('im-show');
  }

  function init() {
    loadUserTradeInfo();
    injectBuyPopup();
    // 스냅샷에 미리 채워진 폼 값 초기화
    var _inputs = [
      document.getElementById('searchRegGameServer'),
      document.getElementById('searchGameServer'),
      document.getElementById('user_price'),
      document.getElementById('user_title'),
      document.getElementById('buy_title'),
      document.getElementById('user_character')
    ];
    _inputs.forEach(function(el) { if (el) el.value = ''; });
    document.querySelectorAll('.ql-editor').forEach(function(el) { el.innerHTML = '<p><br></p>'; });

    // 스냅샷 JS 이벤트 리스너 완전 제거: cloneNode + id 변경으로 스냅샷 JS 재부착 차단
    (function() {
      var origIds = ['searchRegGameServer', 'searchGameServer'];
      var cleanInp = null;
      for (var _i = 0; _i < origIds.length; _i++) {
        var orig = document.getElementById(origIds[_i]);
        if (orig) {
          var clone = orig.cloneNode(true);
          orig.removeAttribute('id');
          orig.parentNode.replaceChild(clone, orig);
          cleanInp = clone;
          break;
        }
      }
      setupGameSearch(cleanInp);
    })();

    // 판매등록 링크 → /sell/register.html
    document.querySelectorAll('a[href*="/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/sell/') && !h.includes('/sell/list') && !h.includes('/sell/application')) {
        a.href = '/sell/register.html';
        a.addEventListener('click', function(e) {
          e.preventDefault(); location.href = '/sell/register.html';
        });
      }
    });

    // 구매등록 폼 제출 인터셉트
    var form = document.getElementById('frmBuy');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200);
              return;
            }
            var priceEl = form.querySelector('[name=user_price]');
            var titleEl2 = form.querySelector('[name=user_title],[name=title_name],[name=buy_title]');
            var price = priceEl ? priceEl.value.trim() : '';
            var title2 = titleEl2 ? titleEl2.value.trim() : '';
            var game2 = window._IM_sel_game ? window._IM_sel_game.name : '';
            var server2 = window._IM_sel_server ? window._IM_sel_server.name : '';
            if (!game2) { showToast('게임을 선택해주세요.', false); return; }
            if (!price) { showToast('가격을 입력해주세요.', false); return; }
            if (!title2) { showToast('구매 희망 아이템명을 입력해주세요.', false); return; }
            fetch('/api/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                title: title2,
                price: parseInt(price.replace(/[^0-9]/g, ''), 10),
                gameName: game2,
                serverName: server2,
                category: 'buy',
                itemCategory: window._IM_sel_category || '기타',
                sellerName: d.nickname || d.email
              })
            })
            .then(function(r) {
              if (r.ok) {
                fillAndShowBuyPopup({
                  gameName: game2,
                  serverName: server2,
                  itemCategory: window._IM_sel_category || '',
                  title: title2,
                  price: parseInt(price.replace(/[^0-9]/g, ''), 10)
                });
              } else {
                return r.json().then(function(e) { showToast('등록 실패: ' + (e.error || '오류'), false); });
              }
            })
            .catch(function() { showToast('서버 오류가 발생했습니다.', false); });
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── NEW 모드 버튼 (#change_mode data-mode=n) ───────────────────
    var newModeBtn = document.getElementById('change_mode');
    if (newModeBtn && newModeBtn.getAttribute('data-mode') === 'n') {
      newModeBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/buy/new.html';
      }, true);
    }

    // 뒤로가기 / 홈
    var backLinks = document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]');
    backLinks.forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const SELL_NEW_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#8354ff' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function init() {
    // ── 클래식모드 버튼 (#change_mode data-mode=c) → 판매등록 클래식으로 복귀 ──
    var classicBtn = document.getElementById('change_mode');
    if (classicBtn) {
      classicBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/sell/register.html';
      }, true);
    }

    // ── 물품일괄등록 ─────────────────────────────────────────────────
    var batchBtn = document.getElementById('batch_move');
    if (batchBtn) {
      batchBtn.href = '/myroom/batch_goods/index.html';
      batchBtn.addEventListener('click', function(e) {
        e.preventDefault(); location.href = '/myroom/batch_goods/index.html';
      });
    }

    // ── 구매등록 링크 ─────────────────────────────────────────────────
    document.querySelectorAll('a[href*="/buy/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/buy/') && !h.includes('/buy/list') && !h.includes('/buy/application')) {
        a.href = '/buy/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/buy/register.html'; });
      }
    });

    // ── 판매등록 폼 제출 인터셉트 ─────────────────────────────────────
    var form = document.getElementById('frmSell');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200); return;
            }
            var priceEl = form.querySelector('[name=user_price]');
            if (!priceEl || !priceEl.value.trim()) { showToast('가격을 입력해주세요.', false); return; }
            showToast('판매 등록이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/sell/list.html'; }, 1800);
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const BUY_NEW_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#39A742' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function init() {
    // ── DOM 적응: 판매→구매 UI 전환 ────────────────────────────────
    // 제목 영역 변경
    var titleEl = document.querySelector('.g_title_blue');
    if (titleEl) titleEl.className = titleEl.className.replace('g_title_blue','g_title_green');
    var h2 = document.querySelector('#sell_title h2, .g_title_blue h2, .g_title_green h2');
    if (h2 && h2.textContent.includes('판매')) h2.textContent = h2.textContent.replace('판매등록','구매등록');

    // ── 클래식모드 버튼 → 구매등록 클래식으로 복귀 ─────────────────
    var classicBtn = document.getElementById('change_mode');
    if (classicBtn) {
      classicBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/buy/register.html';
      }, true);
    }

    // ── 판매등록 링크 ─────────────────────────────────────────────────
    document.querySelectorAll('a[href*="/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/sell/') && !h.includes('/sell/list') && !h.includes('/sell/application')) {
        a.href = '/sell/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/sell/register.html'; });
      }
    });

    // ── 폼 제출 인터셉트 (frmSell → 구매등록으로 처리) ───────────────
    var form = document.getElementById('frmSell') || document.getElementById('frmBuy');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200); return;
            }
            var priceEl = form.querySelector('[name=user_price]');
            if (!priceEl || !priceEl.value.trim()) { showToast('가격을 입력해주세요.', false); return; }
            showToast('구매 등록이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/buy/list.html'; }, 1800);
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const BATCH_GOODS_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function init() {
    // ── 폼 제출 인터셉트 ────────────────────────────────────────────
    var form = document.querySelector('form[action*="batch_goods"]');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200); return;
            }
            var fileEl = document.getElementById('excel_upload');
            showToast('일괄등록이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/sell/list.html'; }, 1800);
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── 파일 업로드 UI (실제 파일 첨부 없이 파일명 표시) ────────────
    var excelInput = document.querySelector('#excel_upload input[type=file]');
    if (excelInput) {
      excelInput.addEventListener('change', function() {
        var status = document.getElementById('excel_status');
        if (status && this.files && this.files[0]) {
          var p = status.querySelector('p') || status;
          p.textContent = '📎 ' + this.files[0].name;
        }
      });
    }

    // ── 판매등록으로 돌아가기 링크 ───────────────────────────────────
    document.querySelectorAll('a[href*="/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/sell/') && !h.includes('/sell/list') && !h.includes('/sell/application')) {
        a.href = '/sell/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/sell/register.html'; });
      }
    });

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const MYROOM_INTERCEPT_SCRIPT = `
<style>
/* 인증 배지 비활성 상태 */
.im-auth-disabled {
  filter: grayscale(100%) opacity(0.38) !important;
  cursor: default !important;
  pointer-events: none !important;
}
</style>
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function applyAuthBadges(authStates) {
    var auth = authStates || {};
    var map = [
      { key: 'excellent', sel: '.cert_excellent_on, .cert_excellent' },
      { key: 'phone',     sel: '.cert_hp_on, .cert_hp' },
      { key: 'email',     sel: '.cert_email_on, .cert_email' },
      { key: 'ipin',      sel: '.cert_ipin_on, .cert_ipin' },
      { key: 'withdraw',  sel: '.cert_account_on, .cert_account' },
    ];
    map.forEach(function(item) {
      var el = document.querySelector(item.sel);
      if (!el) return;
      if (auth[item.key]) {
        el.classList.remove('im-auth-disabled');
      } else {
        el.classList.add('im-auth-disabled');
      }
    });
  }

  function init() {
    // ── 출금하기 버튼 → 출금 목록 페이지 ───────────────────────────
    document.querySelectorAll('a[href*="payment_switch"],a.mileage_withdraw_btn').forEach(function(a) {
      a.href = '/myroom/mileage/payment/payment_list.html';
      a.addEventListener('click', function(e) {
        e.preventDefault();
        location.href = '/myroom/mileage/payment/payment_list.html';
      });
    });

    // ── 판매등록 링크 ─────────────────────────────────────────────────
    document.querySelectorAll('a[href*="/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/sell/') && !h.includes('/sell/list') && !h.includes('/sell/application')) {
        a.href = '/sell/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/sell/register.html'; });
      }
    });

    // ── 구매등록 링크 ─────────────────────────────────────────────────
    document.querySelectorAll('a[href*="/buy/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/buy/') && !h.includes('/buy/list') && !h.includes('/buy/application')) {
        a.href = '/buy/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/buy/register.html'; });
      }
    });

    // ── 일괄등록 링크 ─────────────────────────────────────────────────
    document.querySelectorAll('a[href*="batch_goods"]').forEach(function(a) {
      a.href = '/myroom/batch_goods/index.html';
      a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/myroom/batch_goods/index.html'; });
    });

    // ── 채팅 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href*="/myroom/chat"]').forEach(function(a) {
      a.href = '/myroom/chat/list.html';
      a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/myroom/chat/list.html'; });
    });

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });

    // ── 마이룸에 실제 사용자 정보 표시 ────────────────────────────────
    window._IM_auth()
      .then(function(d) {
        if (!d) return;
        var nick = d.nickname || d.email || '';

        // 닉네임: level_desc 안의 텍스트 노드 교체 ("OOO 회원님의..." 형태)
        var levelDesc = document.querySelector('.level_desc > div');
        if (levelDesc) {
          levelDesc.childNodes.forEach(function(node) {
            if (node.nodeType === 3 && node.textContent && node.textContent.includes('회원님의')) {
              node.textContent = node.textContent.replace(/^[^\s]+/, nick);
            }
          });
        }
        // 혹시 다른 닉네임 셀렉터도 갱신
        document.querySelectorAll('.mr_user_name,.user_name,.nick_name').forEach(function(el) {
          if (el.textContent.trim()) el.textContent = nick;
        });

        // 쿠폰·포인트 값 초기화 (스냅샷에 다른 유저 값이 박혀 있음)
        document.querySelectorAll('.coupon_result').forEach(function(el) { el.textContent = '0'; });

        // 잔액 표시 (사용가능 마일리지: .over_mile, 총 마일리지: .total_mile)
        fetch('/api/wallet', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(b) {
            if (!b) return;
            var amount = Number(b.balance || 0).toLocaleString('ko-KR');
            var avail = document.querySelector('.over_mile');
            var total = document.querySelector('.total_mile');
            if (avail) avail.textContent = amount;
            if (total) total.textContent = amount;
          });

        // 인증 배지 상태 반영
        applyAuthBadges(d.authStates);

        // ── 실제 주문 내역 표시 ────────────────────────────────────────
        fetch('/api/orders', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : []; })
          .then(function(orders) {
            orders = orders || [];
            var fmt = function(n) { return (n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
            var statusLabel = function(s) {
              var m = { pending: '입금예정', processing: '구매중', shipped: '발송완료', completed: '완료', cancelled: '취소' };
              return m[s] || s;
            };

            // 구매 내역 (구매자인 경우)
            var buyTbody = document.querySelector('tr.tbl_buy_area');
            if (buyTbody && orders.length > 0) {
              var parent = buyTbody.parentNode;
              buyTbody.remove();
              orders.slice(0, 5).forEach(function(o) {
                var dt = new Date(o.createdAt);
                var dateStr = (dt.getMonth()+1) + '/' + dt.getDate();
                var tr = document.createElement('tr');
                tr.innerHTML =
                  '<td><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" style="width:40px;height:40px;object-fit:cover;border-radius:4px" alt></td>' +
                  '<td>구매</td>' +
                  '<td>' + (o.gameName || '게임') + '</td>' +
                  '<td style="text-align:left">' +
                    '<a href="/sell/application.html?id=' + (o.productId||'') + '" style="font-weight:600;color:#222">' + (o.productTitle||'').substring(0,30) + '</a>' +
                    '<br><small style="color:#888">#' + o.id + '</small>' +
                  '</td>' +
                  '<td style="font-weight:700;color:#e53e3e">' + fmt(o.amount) + '원</td>' +
                  '<td><span style="padding:4px 10px;border-radius:20px;font-size:12px;background:' + (o.status==='completed'?'#e8f5e9;color:#2e7d32':o.status==='cancelled'?'#ffebee;color:#c62828':'#e3f2fd;color:#1565c0') + '">' + statusLabel(o.status) + '</span></td>' +
                  '<td>' + dateStr + '</td>';
                if (parent) parent.appendChild(tr);
              });

              // 구매 카운터 업데이트
              var buyingCount = orders.filter(function(o) { return o.status === 'processing'; }).length;
              var pendingCount = orders.filter(function(o) { return o.status === 'pending'; }).length;
              var sidebar = document.querySelector('.gnb_list');
              if (sidebar) {
                sidebar.querySelectorAll('a').forEach(function(a) {
                  var txt = a.textContent.trim();
                  var span = a.querySelector('span:last-child');
                  if (!span) return;
                  if (txt.includes('입금예정')) span.textContent = String(pendingCount);
                  if (txt.includes('구매중')) span.textContent = String(buyingCount);
                });
              }
            } else if (buyTbody && orders.length === 0) {
              buyTbody.querySelector('td').textContent = '구매 내역이 없습니다.';
            }
          })
          .catch(function() {});
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const PAYMENT_LIST_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function init() {
    // ── 탭: 휴대폰번호 출금 탭 ────────────────────────────────────────
    document.querySelectorAll('a[href*="payment_phone"]').forEach(function(a) {
      a.href = '/myroom/mileage/payment/payment_phone_list.html';
      a.addEventListener('click', function(e) {
        e.preventDefault(); location.href = '/myroom/mileage/payment/payment_phone_list.html';
      });
    });

    // ── 은행계좌 출금 폼 제출 인터셉트 ────────────────────────────────
    var form = document.getElementById('frm_pay') || document.querySelector('form[id*="pay"]');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200); return;
            }
            var amtEl = form.querySelector('[name=pay_amount],[name=amount],[name=withdraw_amount]');
            var amt = amtEl ? amtEl.value.trim() : '';
            if (!amt || isNaN(Number(amt.replace(/,/g,'')))) {
              showToast('출금 금액을 입력해주세요.', false); return;
            }
            showToast('출금 신청이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/myroom/index.html'; }, 1800);
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── 마이룸으로 돌아가기 ────────────────────────────────────────────
    document.querySelectorAll('a[href*="/myroom/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.match(/\/myroom\/?$/) || h.endsWith('/myroom/')) {
        a.href = '/myroom/index.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/myroom/index.html'; });
      }
    });

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const PAYMENT_PHONE_LIST_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function init() {
    // ── 탭: 은행계좌 출금 탭 ──────────────────────────────────────────
    document.querySelectorAll('a[href*="payment_list"]').forEach(function(a) {
      a.href = '/myroom/mileage/payment/payment_list.html';
      a.addEventListener('click', function(e) {
        e.preventDefault(); location.href = '/myroom/mileage/payment/payment_list.html';
      });
    });

    // ── 휴대폰 출금 폼 제출 인터셉트 ──────────────────────────────────
    var form = document.getElementById('frm') || document.querySelector('form');
    if (form && form.id !== 'g_searchbar_form') {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200); return;
            }
            var amtEl = form.querySelector('[name=pay_amount],[name=amount],[name=withdraw_amount]');
            var amt = amtEl ? amtEl.value.trim() : '';
            if (!amt || isNaN(Number(amt.replace(/,/g,'')))) {
              showToast('출금 금액을 입력해주세요.', false); return;
            }
            showToast('휴대폰 출금 신청이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/myroom/index.html'; }, 1800);
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── 마이룸으로 돌아가기 ────────────────────────────────────────────
    document.querySelectorAll('a[href*="/myroom/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.match(/\/myroom\/?$/) || h.endsWith('/myroom/')) {
        a.href = '/myroom/index.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/myroom/index.html'; });
      }
    });

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const CHAT_NEW_INTERCEPT_SCRIPT = `
<script>
(function() {
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  function init() {
    var params = new URLSearchParams(location.search);
    var type = params.get('type') || 'sell'; // sell | buy

    // ── 인수확인 버튼 텍스트 분기 ──────────────────────────────────
    var tradeIngBtn = document.getElementById('trade_ing');
    if (tradeIngBtn) {
      tradeIngBtn.textContent = (type === 'buy') ? '인수확인' : '인수확인요청';
    }

    // ── 인수확인(요청) 클릭 → buy_check_layer 표시 ─────────────────
    if (tradeIngBtn) {
      tradeIngBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var layer = document.getElementById('buy_check_layer');
        if (layer) {
          layer.style.display = 'block';
          layer.classList.remove('sf-hidden');
        }
      }, true);
    }

    // ── buy_check_layer 버튼들 ──────────────────────────────────────
    var cancelBtn = document.getElementById('cancel_btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var layer = document.getElementById('buy_check_layer');
        if (layer) layer.style.display = 'none';
      });
    }

    var tradeEndBtn = document.getElementById('trade_end_btn');
    if (tradeEndBtn) {
      tradeEndBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var layer = document.getElementById('buy_check_layer');
        if (layer) layer.style.display = 'none';
        var stateEl = document.getElementById('trade_state_text');
        if (stateEl) stateEl.textContent = '거래완료';
        var noticeEl = document.getElementById('chat_notice_txt');
        if (noticeEl) { noticeEl.innerHTML = '<b>거래가 완료되었습니다.</b><br><span class=sub_txt>아이템매니아를 이용해 주셔서 감사합니다.</span>'; }
        if (tradeIngBtn) { tradeIngBtn.disabled = true; tradeIngBtn.style.opacity = '0.4'; }
      });
    }

    // ── 거래취소 ────────────────────────────────────────────────────
    var cancelTrade = document.getElementById('trade_cancel');
    if (cancelTrade) {
      cancelTrade.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('거래를 취소하시겠습니까?')) {
          var stateEl = document.getElementById('trade_state_text');
          if (stateEl) stateEl.textContent = '거래취소';
          if (tradeIngBtn) { tradeIngBtn.disabled = true; tradeIngBtn.style.opacity='0.4'; }
          if (cancelTrade) { cancelTrade.disabled = true; cancelTrade.style.opacity='0.4'; }
        }
      });
    }

    // ── 채팅종료 ────────────────────────────────────────────────────
    var exitBtn = document.getElementById('chat_exit');
    if (exitBtn) {
      exitBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('채팅을 종료하시겠습니까?')) { window.close(); }
      });
    }

    // ── 채팅차단 / 신고하기 / 자주쓰는채팅 / 알림보내기 ───────────
    ['chat_block','user_report','chat_template','chat_alarm','chat_print','send_file'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function(e) {
        e.preventDefault(); alert('해당 기능은 준비 중입니다.');
      });
    });

    // ── 메시지 전송 ─────────────────────────────────────────────────
    var sendBtn = document.getElementById('send_btn');
    var textarea = document.getElementById('write_chat');
    if (sendBtn && textarea) {
      function sendMsg() {
        var msg = textarea.value.trim();
        if (!msg) return;
        var list = document.getElementById('chat_content_list');
        if (list) {
          var now = new Date();
          var hhmm = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
          var div = document.createElement('div');
          div.className = 'chat_item me';
          div.innerHTML = '<div class=chat_msg><span>' + msg.replace(/</g,'&lt;') + '</span></div><div class=send_time>' + hhmm + '</div>';
          list.appendChild(div);
          list.scrollTop = list.scrollHeight;
        }
        textarea.value = '';
      }
      sendBtn.addEventListener('click', sendMsg);
      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
      });
    }

    // ── 뒤로가기 링크 ───────────────────────────────────────────────
    var backBtn = document.querySelector('a.back_btn');
    if (backBtn) {
      backBtn.href = '/myroom/chat/list.html';
      backBtn.addEventListener('click', function(e) {
        e.preventDefault(); location.href = '/myroom/chat/list.html';
      });
    }

    // ── 로그인 상태 반영 ────────────────────────────────────────────
    window._IM_auth().then(function(data) {
      if (data && data.id) {
        var uidEl = document.querySelector('.chat_user .uid');
        // 내 채팅은 "me" 스타일 유지 — 별도 처리 없이 OK
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
</script>
`;

const CHAT_INTERCEPT_SCRIPT = `
<script>
(function() {
  // 로그인 상태 확인
  function isLoggedIn() {
    return window._IM_auth()
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) { return d && d.id; })
      .catch(function() { return false; });
  }

  function initButtons() {
    // 마이룸 버튼 → 메인으로
    var myroomBtn = document.querySelector('button.go_myroom');
    if (myroomBtn) {
      myroomBtn.addEventListener('click', function(e) {
        e.preventDefault();
        window.close();
      });
    }

    // 차단리스트
    var blockBtn = document.querySelector('button.block_list');
    if (blockBtn) {
      blockBtn.addEventListener('click', function(e) {
        e.preventDefault();
        alert('차단리스트 기능은 준비 중입니다.');
      });
    }

    // 채팅종료 버튼
    document.body.addEventListener('click', function(e) {
      var btn = e.target.closest && e.target.closest('button.chat_exit');
      if (btn) {
        e.preventDefault(); e.stopPropagation();
        if (confirm('채팅을 종료하시겠습니까?')) {
          var li = btn.closest('li.chat_list_item');
          if (li) {
            li.style.opacity = '0.4';
            var stateEl = li.querySelector('.trade_state');
            if (stateEl) { stateEl.textContent = '거래종료'; stateEl.className = 'trade_state end'; }
          }
        }
      }
    });

    // 그룹보기 (expand/collapse)
    document.body.addEventListener('click', function(e) {
      var btn = e.target.closest && e.target.closest('button.chat_group_expand');
      if (btn) {
        e.preventDefault(); e.stopPropagation();
        var li = btn.closest('li.chat_list_item');
        if (li) {
          li.classList.toggle('expand');
          var subList = li.querySelector('.chat_sub_list');
          if (subList) {
            if (li.classList.contains('expand')) {
              subList.style.height = 'auto';
              btn.textContent = '그룹닫기';
            } else {
              subList.style.height = '0';
              btn.textContent = '그룹보기';
            }
          }
        }
      }
    });

    // 채팅 목록 아이템 클릭 → 채팅방 오픈
    document.body.addEventListener('click', function(e) {
      // 버튼 클릭은 위의 �핸들러가 처리하므로 제외
      if (e.target.closest('button')) return;
      var li = e.target.closest && e.target.closest('li[data-expand], li[data-no]');
      if (!li) return;
      e.preventDefault(); e.stopPropagation();
      var tid = li.getAttribute('data-expand') || li.getAttribute('data-no') || '';
      var channel = li.getAttribute('data-channels') || '';
      // 거래 타입 추론: .trade_type 클래스에서
      var typeEl = li.querySelector('.trade_type');
      var tradeType = 'sell';
      if (typeEl) {
        var cls = typeEl.className || '';
        if (cls.includes('buy')) tradeType = 'buy';
      }
      if (tid) {
        var url = '/myroom/chat/new_chat.html?tid=' + tid + '&type=' + tradeType;
        if (channel) url += '&channel_no=' + channel;
        window.open(url, '_chat_' + tid, 'width=900,height=700,resizable=yes,scrollbars=yes');
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButtons);
  } else {
    initButtons();
  }
})();
</script>
`;

const SELL_APPLICATION_INTERCEPT_SCRIPT = `
<script>
(function() {
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  function showLoginModal() {
    var existing = document.getElementById('_im_overlay');
    if (existing) { existing.style.display = 'flex'; return; }
    var div = document.createElement('div');
    div.innerHTML = '<div id="_im_overlay" style="display:flex;position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);align-items:center;justify-content:center"><div style="background:#fff;border-radius:14px;padding:36px 32px 28px;width:400px;max-width:92vw;box-shadow:0 24px 64px rgba(0,0,0,.22);font-family:Pretendard,-apple-system,sans-serif"><div style="text-align:right;margin-bottom:8px"><button id="_im_close" style="background:none;border:none;font-size:22px;cursor:pointer;color:#888">&times;</button></div><h2 style="margin:0 0 8px;font-size:22px;font-weight:700">로그인이 필요합니다</h2><p style="color:#555;margin:0 0 24px;font-size:14px">구매하시려면 먼저 로그인해주세요.</p><input type="email" id="_im_e" placeholder="이메일" style="display:block;width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:10px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;outline:none"><input type="password" id="_im_p" placeholder="비밀번호" style="display:block;width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:10px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;outline:none"><button id="_im_login_btn" style="width:100%;padding:14px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer">로그인하기</button><div id="_im_err" style="margin-top:10px;min-height:18px;font-size:13px;color:#e03030;text-align:center"></div></div></div>';
    document.body.appendChild(div.firstChild);
    document.getElementById('_im_close').onclick = function(){ document.getElementById('_im_overlay').style.display='none'; };
    document.getElementById('_im_login_btn').onclick = function(){
      var email = document.getElementById('_im_e').value;
      var pw = document.getElementById('_im_p').value;
      var errEl = document.getElementById('_im_err');
      if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }
      api('POST', '/auth/login', { email: email, password: pw }).then(function(data){
        if (data && data.id) {
          document.getElementById('_im_overlay').style.display = 'none';
          showPurchaseSuccess();
        } else {
          errEl.textContent = (data && data.error) || '로그인에 실패했습니다.';
        }
      });
    };
    setTimeout(function(){ var el = document.getElementById('_im_e'); if(el) el.focus(); }, 50);
  }

  function showPurchaseSuccess() {
    alert('구매 신청이 완료되었습니다.\\n판매자와 채팅으로 거래를 진행해 주세요.');
  }

  function init() {
    // 구매신청 버튼 — form 제출 인터셉트
    var form = document.getElementById('frmSell');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth().then(function(data){
          if (data && data.id) { showPurchaseSuccess(); }
          else { showLoginModal(); }
        });
      });
    }
    // 구매신청 버튼 (button[type=button] 이름 없는 마지막 버튼)
    document.querySelectorAll('button[type=button]').forEach(function(btn) {
      if (btn.textContent.trim() === '구매신청') {
        btn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopImmediatePropagation();
          window._IM_auth().then(function(data){
            if (data && data.id) { showPurchaseSuccess(); }
            else { showLoginModal(); }
          });
        }, true);
      }
    });

    // 채팅 버튼 → 채팅 창
    document.querySelectorAll('button.go_chat, button[name=go_chat]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
      }, true);
    });

    // 충전하기 버튼 → 준비 중
    document.querySelectorAll('button.charge_btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        alert('충전 서비스는 게임 할인충전 페이지를 이용해주세요.');
      }, true);
    });

    // 쿠폰, 찜하기 버튼 → 준비 중
    document.querySelectorAll('#coupon_btn, .btn_fav').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        alert('해당 기능은 현재 준비 중입니다.');
      }, true);
    });

    // 헤더 로그인 버튼
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/login';
      }, true);
    }

    // 채팅 버튼 (헤더)
    var chatBtn = document.querySelector('#chat_notice button');
    if (chatBtn) {
      chatBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
      }, true);
    }

    // 차단 마커 링크
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });

    // 로그인 상태에 따라 헤더 업데이트
    window._IM_auth().then(function(data){
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(e){
            e.stopImmediatePropagation();
            api('POST', '/auth/logout').then(function(){ location.href='/'; });
          }, true);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;


const APPLICATION_DYNAMIC_SCRIPT = `
<script>
(function() {
  var params = new URLSearchParams(location.search);
  var productId = params.get('id');
  if (!productId || isNaN(Number(productId))) return; // 정적 스냅샷이면 스킵

  var type = location.pathname.indexOf('/buy/') >= 0 ? 'buy' : 'sell';

  function fmt(n) { return Number(n||0).toLocaleString('ko-KR'); }

  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;' +
      'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;' +
      'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function renderBuyBox(p) {
    var existing = document.getElementById('_im_buy_box');
    if (existing) existing.remove();
    var box = document.createElement('div');
    box.id = '_im_buy_box';
    box.style.cssText = 'margin:20px 0;padding:24px;background:#f0f7ff;border-radius:12px;border:2px solid #159EFD';

    if (type === 'sell') {
      box.innerHTML =
        '<div style="font-size:16px;font-weight:700;margin-bottom:8px">이 상품 구매하기</div>' +
        '<div style="font-size:26px;font-weight:800;color:#e53e3e;margin-bottom:18px">' + fmt(p.price) + '원</div>' +
        '<div style="display:flex;gap:10px;margin-bottom:12px">' +
          '<button id=_im_buy_btn style="flex:2;padding:14px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer">💳 구매하기</button>' +
          '<button id=_im_chat_btn style="flex:1;padding:14px;background:#25d366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">💬 채팅</button>' +
        '</div>' +
        '<p style="margin:0;font-size:13px;color:#555">* 아이템마니아 에스크로로 안전하게 보호됩니다. 판매자가 거래를 완료해야 금액이 지급됩니다.</p>';
    } else {
      box.innerHTML =
        '<div style="font-size:16px;font-weight:700;margin-bottom:8px">이 구매 요청에 판매하기</div>' +
        '<div style="font-size:26px;font-weight:800;color:#0070d2;margin-bottom:18px">' + fmt(p.price) + '원</div>' +
        '<button id=_im_buy_btn style="width:100%;padding:14px;background:#39A742;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer">💰 판매 신청하기</button>';
    }

    // trade_info 다음에 삽입
    var anchor = document.querySelector('.flex_area.trade_info, .trade_info, .border_box, .trade_money');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
    } else {
      (document.querySelector('.g_body, main, article, body')).appendChild(box);
    }

    // 구매하기 버튼
    var buyBtn = document.getElementById('_im_buy_btn');
    if (buyBtn) {
      buyBtn.addEventListener('click', function() {
        window._IM_auth().then(function(user) {
          if (!user || !user.id) {
            showToast('로그인이 필요합니다.', false);
            setTimeout(function() { location.href = '/login?redirect=' + encodeURIComponent(location.href); }, 1200);
            return;
          }
          if (p.sellerId && Number(user.id) === Number(p.sellerId)) {
            showToast('자신의 상품은 구매할 수 없습니다.', false); return;
          }
          // 잔액 확인 후 구매
          fetch('/api/wallet', { credentials: 'include' })
            .then(function(r) { return r.json(); })
            .then(function(w) {
              var balance = Number(w.balance) || 0;
              if (balance < p.price) {
                var msg = '잔액이 부족합니다.\n현재 잔액: ' + fmt(balance) + '원\n필요 금액: ' + fmt(p.price) + '원\n\n충전 페이지로 이동하시겠습니까?';
                if (confirm(msg)) location.href = '/myroom/mileage/payment/payment_list.html';
                return;
              }
              if (!confirm('[' + p.title + ']\n' + fmt(p.price) + '원을 구매하시겠습니까?\n\n(에스크로 보호 거래)')) return;

              fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  productId: p.id,
                  productTitle: p.title,
                  amount: p.price,
                  sellerId: p.sellerId
                })
              })
              .then(function(r) { return r.json(); })
              .then(function(order) {
                if (order.error) { showToast('구매 실패: ' + order.error, false); return; }
                showToast('구매가 완료되었습니다! 판매자와 채팅하세요.', true);
                setTimeout(function() { location.href = '/myroom/index.html'; }, 1800);
              })
              .catch(function() { showToast('오류가 발생했습니다. 다시 시도해주세요.', false); });
            });
        });
      });
    }

    // 채팅 버튼
    var chatBtn = document.getElementById('_im_chat_btn');
    if (chatBtn) {
      chatBtn.addEventListener('click', function() {
        window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
      });
    }
  }

  function loadProduct() {
    fetch('/api/products/' + productId, { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(p) {
        if (p.error) return;

        // 제목 업데이트
        var titleEl = document.querySelector('.trade_subject');
        if (titleEl) {
          var sig = titleEl.querySelector('.signboard');
          titleEl.textContent = '';
          if (sig) titleEl.appendChild(sig);
          titleEl.appendChild(document.createTextNode(' ' + p.title));
        }
        document.title = p.title + ' - 아이템매니아';

        // 거래 ID 업데이트
        var tidEl = document.querySelector('.trade_id');
        if (tidEl) tidEl.firstChild.textContent = '#' + p.id + ' ';

        // 가격 업데이트
        var moneyEl = document.querySelector('dd.trade_money, .trade_money');
        if (moneyEl) {
          var span = moneyEl.querySelector('span');
          if (span) { span.textContent = fmt(p.price) + '원'; }
          else { moneyEl.textContent = fmt(p.price) + '원'; }
        }

        // 서버 정보
        var serverLis = document.querySelectorAll('ul.server li');
        if (serverLis.length >= 1 && p.gameName) {
          var a = serverLis[0].querySelector('a');
          if (a) a.textContent = p.gameName; else serverLis[0].textContent = p.gameName;
        }
        if (serverLis.length >= 2 && p.serverName) {
          var a2 = serverLis[1].querySelector('a');
          if (a2) a2.textContent = p.serverName; else serverLis[1].textContent = p.serverName;
        }

        // 판매자명
        var sellerEl = document.querySelector('.user_nick, strong.vip_txt, .user_info strong');
        if (sellerEl && p.sellerName) sellerEl.textContent = p.sellerName;

        // 설명
        var descEl = document.querySelector('.ql-editor.detail_text');
        if (descEl && p.description) {
          descEl.innerHTML = '<p>' + p.description.replace(/\n/g, '</p><p>') + '</p>';
        }

        // 구매 박스 렌더링
        renderBuyBox(p);
      })
      .catch(function() {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProduct);
  else loadProduct();
})();
</script>
`;

const BUY_INTERCEPT_SCRIPT = `
<script>
(function() {
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  function init() {
    // ── 상품등록(구매등록) 버튼 → /buy/register.html ──────────────────
    // trade-btn-blue 클릭: buy list에서는 모달 없이 바로 구매등록으로
    document.querySelectorAll('a.trade-btn-blue, .trade-btn a').forEach(function(a) {
      a.setAttribute('href', '/buy/register.html');
      a.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/buy/register.html';
      }, true);
    });

    // 팝니다 탭 → 판매 목록으로 이동 (search_game 유지)
    document.querySelectorAll('button[data-type="sell"]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var params = new URLSearchParams(location.search);
        var game = params.get('search_game') || '5913';
        location.href = '/sell/list.html?search_game=' + game;
      }, true);
    });

    // 채팅 버튼 (헤더) → 별도 창
    var chatBtn = document.querySelector('#chat_notice button');
    if (chatBtn) {
      chatBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
      }, true);
    }

    // 헤더 로그인/로그아웃
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/login';
      }, true);
    }

    // 삽니다 상품 리스트 아이템 클릭 → 상세 페이지 이동
    document.body.addEventListener('click', function(e) {
      var li = e.target.closest && e.target.closest('li.list_item[data-tid]');
      if (li) {
        var tid = li.getAttribute('data-tid');
        if (tid) {
          e.preventDefault(); e.stopPropagation();
          location.href = '/buy/application.html?id=' + tid;
        }
      }
    }, true);

    // 로그인 상태 반영
    window._IM_auth().then(function(data){
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(e){
            e.stopImmediatePropagation();
            api('POST', '/auth/logout').then(function(){ location.href='/'; });
          }, true);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

const BUY_APPLICATION_INTERCEPT_SCRIPT = `
<script>
(function() {
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  function showLoginModal() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:36px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.18)">' +
      '<div style="font-size:22px;font-weight:700;margin-bottom:8px;color:#2e2e2e">로그인이 필요합니다</div>' +
      '<div style="font-size:14px;color:#767676;margin-bottom:24px">판매신청/채팅을 이용하려면 로그인해 주세요.</div>' +
      '<div style="display:flex;gap:10px;justify-content:center">' +
        '<button id="_im_modal_cancel" style="flex:1;padding:12px 0;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:15px;font-weight:600;cursor:pointer;color:#555">취소</button>' +
        '<button id="_im_modal_login" style="flex:1;padding:12px 0;border:none;border-radius:8px;background:#159EFD;color:#fff;font-size:15px;font-weight:700;cursor:pointer">로그인</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);
    document.getElementById('_im_modal_cancel').onclick = function(){ document.body.removeChild(overlay); };
    document.getElementById('_im_modal_login').onclick = function(){ location.href = '/login'; };
    overlay.addEventListener('click', function(e){ if(e.target === overlay) document.body.removeChild(overlay); });
  }

  function showSuccessModal(msg) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = '<div style="background:#fff;border-radius:12px;padding:36px 32px;max-width:380px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.18)">' +
      '<div style="font-size:40px;margin-bottom:12px">✅</div>' +
      '<div style="font-size:20px;font-weight:700;margin-bottom:8px;color:#2e2e2e">' + msg + '</div>' +
      '<div style="font-size:14px;color:#767676;margin-bottom:24px">채팅창에서 판매자와 거래를 진행해 주세요.</div>' +
      '<button id="_im_modal_ok" style="padding:12px 40px;border:none;border-radius:8px;background:#159EFD;color:#fff;font-size:15px;font-weight:700;cursor:pointer">확인</button>' +
    '</div>';
    document.body.appendChild(overlay);
    document.getElementById('_im_modal_ok').onclick = function(){ document.body.removeChild(overlay); };
  }

  var _loggedIn = null;
  function checkLogin() {
    if (_loggedIn !== null) return Promise.resolve(_loggedIn);
    return window._IM_auth().then(function(d){ _loggedIn = !!(d && d.id); return _loggedIn; });
  }

  function init() {
    // 판매신청 버튼 (btn_green)
    document.querySelectorAll('button.btn_green').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        checkLogin().then(function(ok) {
          if (!ok) { showLoginModal(); return; }
          showSuccessModal('판매신청이 완료되었습니다');
        });
      }, true);
    });

    // form submit 차단 (frmSell)
    var form = document.getElementById('frmSell');
    if (form) {
      form.addEventListener('submit', function(e){ e.preventDefault(); e.stopImmediatePropagation(); }, true);
    }

    // 채팅 버튼 (.go_chat)
    document.querySelectorAll('button.go_chat, button[name=go_chat]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        checkLogin().then(function(ok) {
          if (!ok) { showLoginModal(); return; }
          window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
        });
      }, true);
    });

    // 찜하기 버튼
    document.querySelectorAll('button.btn_fav, button.btn_fav2').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        checkLogin().then(function(ok) {
          if (!ok) { showLoginModal(); return; }
          btn.textContent = '찜완료 ♥';
          btn.style.color = '#ff4d4d';
        });
      }, true);
    });

    // 헤더 채팅 버튼
    var chatBtn = document.querySelector('#chat_notice button');
    if (chatBtn) {
      chatBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
      }, true);
    }

    // 로그인 상태 반영
    window._IM_auth().then(function(data){
      _loggedIn = !!(data && data.id);
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(e){
            e.stopImmediatePropagation();
            api('POST', '/auth/logout').then(function(){ location.href='/'; });
          }, true);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

function serveBuyApplication(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  const combined = BUY_APPLICATION_INTERCEPT_SCRIPT + APPLICATION_DYNAMIC_SCRIPT;
  return result.includes("</body>")
    ? result.replace("</body>", combined + "</body>")
    : result + combined;
}

function serveBuy(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  const combined = BUY_INTERCEPT_SCRIPT + SELL_LIST_INTERCEPT_SCRIPT;
  return result.includes("</body>")
    ? result.replace("</body>", combined + "</body>")
    : result + combined;
}

function serveApplication(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  const combined = SELL_APPLICATION_INTERCEPT_SCRIPT + APPLICATION_DYNAMIC_SCRIPT;
  if (result.includes("</body>")) {
    return result.replace("</body>", combined + "</body>");
  }
  return result + combined;
}

function serveChat(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", CHAT_INTERCEPT_SCRIPT + "</body>");
  }
  return result + CHAT_INTERCEPT_SCRIPT;
}

function extractBuyCheckLayer(src: string): string | null {
  const start = src.indexOf('id=buy_check_layer');
  if (start < 0) return null;
  const divStart = src.lastIndexOf('<div', start);
  if (divStart < 0) return null;
  let depth = 0, i = divStart;
  while (i < src.length) {
    if (src.slice(i, i + 4) === '<div') depth++;
    else if (src.slice(i, i + 6) === '</div>') { depth--; if (depth === 0) return src.slice(divStart, i + 6); }
    i++;
  }
  return null;
}

/** 스냅샷 HTML에서 게임 검색 입력창의 미리 채워진 value 속성 제거 */
function stripGameSearchValue(html: string): string {
  // searchGameServer 또는 searchRegGameServer 입력에서 value=... 속성 제거
  return html
    .replace(/(<input\b[^>]*\bid=searchGameServer\b[^>]*?)\s+value=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '$1')
    .replace(/(<input\b[^>]*\bid=searchRegGameServer\b[^>]*?)\s+value=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '$1');
}

function serveSellRegister(html: string, user: Record<string, unknown> | null = null): string {
  const result = stripGameSearchValue(prepare(html, user));
  return result.includes("</body>")
    ? result.replace("</body>", SELL_REGISTER_INTERCEPT_SCRIPT + "</body>")
    : result + SELL_REGISTER_INTERCEPT_SCRIPT;
}

function serveBuyRegister(html: string, user: Record<string, unknown> | null = null): string {
  const result = stripGameSearchValue(prepare(html, user));
  return result.includes("</body>")
    ? result.replace("</body>", BUY_REGISTER_INTERCEPT_SCRIPT + "</body>")
    : result + BUY_REGISTER_INTERCEPT_SCRIPT;
}

function serveSellNew(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", SELL_NEW_INTERCEPT_SCRIPT + "</body>")
    : result + SELL_NEW_INTERCEPT_SCRIPT;
}

function serveBuyNew(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", BUY_NEW_INTERCEPT_SCRIPT + "</body>")
    : result + BUY_NEW_INTERCEPT_SCRIPT;
}

function serveBatchGoods(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", BATCH_GOODS_INTERCEPT_SCRIPT + "</body>")
    : result + BATCH_GOODS_INTERCEPT_SCRIPT;
}

function serveMyroom(html: string, user: Record<string, unknown> | null = null): string {
  let result = prepare(html, user);
  // 스냅샷에 하드코딩된 이전 유저 이름 → 실제 로그인 유저 닉네임으로 교체
  if (user) {
    const nick = (user.nickname as string) || (user.email as string) || '';
    if (nick) result = result.replace(/기우혁/g, nick);
  }
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_INTERCEPT_SCRIPT + "</body>")
    : result + MYROOM_INTERCEPT_SCRIPT;
}

function servePaymentList(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", PAYMENT_LIST_INTERCEPT_SCRIPT + "</body>")
    : result + PAYMENT_LIST_INTERCEPT_SCRIPT;
}

function servePaymentPhoneList(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", PAYMENT_PHONE_LIST_INTERCEPT_SCRIPT + "</body>")
    : result + PAYMENT_PHONE_LIST_INTERCEPT_SCRIPT;
}

function serveChatNew(html: string, user: Record<string, unknown> | null = null): string {
  let result = prepare(html, user);

  // buy_check_layer: 빈 레이어를 buycheck 파일의 전체 레이어로 교체
  if (chatNewBuycheckHtml) {
    const fullLayer = extractBuyCheckLayer(chatNewBuycheckHtml);
    if (fullLayer) {
      // hidden 스타일로 교체 (JS로 display:block 토글)
      const hiddenLayer = fullLayer
        .replace('style=display:block', 'style="display:none"')
        .replace(/class="g_layer buy_check_layer"/, 'class="g_layer buy_check_layer" style="display:none"');
      result = result.replace(
        /<div[^>]+class="g_layer buy_check_layer[^"]*"[^>]*id=buy_check_layer[^>]*>[\s\S]*?<\/div>/,
        hiddenLayer
      );
    }
  }

  return result.includes("</body>")
    ? result.replace("</body>", CHAT_NEW_INTERCEPT_SCRIPT + "</body>")
    : result + CHAT_NEW_INTERCEPT_SCRIPT;
}

// 루트 접속 → 아이템마니아 메인으로 리다이렉트
router.get(["/", ""], async (req, res): Promise<void> => {
  if (!staticHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveItemmania(staticHtml, user));
});

// React 앱 경로 → 아이템마니아 클론으로 리다이렉트
router.get(["/app", "/app/{*path}"], async (req, res): Promise<void> => {
  res.redirect(301, "/");
});

// 원본 itemmania 경로로 JS가 상대경로 이동할 때 → 프록시 경로로 리다이렉트
router.get(["/game_charge", "/game_charge/"], async (req, res): Promise<void> => {
  res.redirect(302, "/game-charge");
});
router.get(["/portal/giftcard", "/portal/giftcard/"], async (req, res): Promise<void> => {
  res.redirect(302, "/giftcard");
});
router.get("/portal/user/p_login_form.html", async (req, res): Promise<void> => {
  res.redirect(301, "/login");
});
// 원본 itemmania 로그아웃 완료 페이지 → 세션 제거 후 홈으로
router.get([
  "/portal/user/logout_ok.html",
  "/portal/user/p_logout_form.html",
  "/portal/user/logout.html",
], (req, res): void => {
  req.session.destroy(() => {
    res.redirect(302, "/");
  });
});
// 회원가입 1단계 – 약관 동의
router.get(["/join", "/join/", "/portal/user/join.html", "/portal/user/"], async (req, res): Promise<void> => {
  if (!joinHtml) {
    res.status(503).send("<html><body><h2>회원가입 페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(joinHtml);
});
// 회원가입 2단계 – 약관 동의
router.get(["/join/agree", "/join/agree/", "/portal/user/join_agreement.html"], async (req, res): Promise<void> => {
  if (!joinAgreeHtml) {
    res.status(503).send("<html><body><h2>회원가입 페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(joinAgreeHtml);
});
// 회원가입 3단계 – 정보 입력
router.get(["/join/form", "/join/form/", "/portal/user/join_form.html"], async (req, res): Promise<void> => {
  if (!joinFormHtml) {
    res.status(503).send("<html><body><h2>회원가입 페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(joinFormHtml);
});
router.get(["/myroom", "/myroom/"], async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/index.html");
});
router.get(["/myroom/chat/list.html", "/myroom/chat/"], async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/chat/list.html");
});
// 로그인 페이지 라우트 (itemmania 원본 경로 + 단축 경로)
router.get(
  ["/portal/user/p_login_form.html", "/login"],
  async (req, res): Promise<void> => {
    if (!loginHtml) {
      res.status(503).send("<html><body><h2>로그인 페이지를 불러올 수 없습니다</h2></body></html>");
      return;
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-cache");
    const user = await getSessionUser(req);

    res.send(serveLogin(loginHtml, user));
  }
);

// 상품권몰 페이지
router.get(["/giftcard", "/portal/giftcard", "/portal/giftcard/"], async (req, res): Promise<void> => {
  if (!giftcardHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveGiftcard(giftcardHtml, user));
});

// 게임 할인충전 페이지
router.get(["/game-charge", "/game_charge", "/game_charge/"], async (req, res): Promise<void> => {
  if (!gamechargeHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveGameCharge(gamechargeHtml, user));
});

// 게임별 상품 목록 페이지 — search_game 쿼리로 분기 (TOP 10 전체)
router.get(
  ["/sell/list.html", "/sell/lineage-classic", "/sell/maplestory-world"],
  async (req, res): Promise<void> => {
    const game = String(req.query["search_game"] ?? "");

    // 게임 ID → HTML 선택
    let html: string;
    if (game === "5913") {
      html = sellLineageClassicHtml;
    } else if (game === "5233") {
      html = sellMaplestoryWorldHtml;
    } else if (SELL_HTML_MAP[game]) {
      html = SELL_HTML_MAP[game];
    } else {
      // search_game 없거나 알 수 없는 경우 → 리니지클래식을 기본
      html = sellLineageClassicHtml;
    }

    if (!html) {
      res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
      return;
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-cache");
    const user = await getSessionUser(req);

    res.send(serveLineageClassic(html, user));
  }
);

// 원본 경로 리다이렉트 — search_game 그대로 전달
router.get("/sell/list.html", async (req, res): Promise<void> => {
  const game = req.query["search_game"];
  if (game) {
    res.redirect(302, `/sell/list.html?search_game=${game}`);
  } else {
    res.redirect(302, "/");
  }
});

// 판매등록 페이지
router.get(["/sell/register.html", "/sell/", "/sell"], async (req, res): Promise<void> => {
  if (!sellRegisterHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveSellRegister(sellRegisterHtml, user));
});

// 판매 등록 완료 페이지
router.get("/sell/index_view.html", async (req, res): Promise<void> => {
  if (!sellIndexViewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  const productId = req.query.id as string | undefined;
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");

  const SELL_INDEX_VIEW_INTERCEPT_SCRIPT = `
<script>
(function() {
  var params    = new URLSearchParams(location.search);
  var productId = params.get('id');
  var gid       = params.get('gid');  // 게임 ID (sell-register에서 전달)
  var catParam  = params.get('cat');  // 카테고리 (sell-register에서 전달)

  // 상품리스트 보기 URL 구성: gid 있으면 게임별 리스트, 없으면 기본 리스트
  function buildListUrl(gameId, catLabel) {
    var url = '/sell/list.html';
    if (gameId) url += '?search_game=' + encodeURIComponent(gameId);
    return url;
  }

  // 버튼 패치 공통 함수
  function patchButtons(listUrl) {
    var btnList = document.getElementById('btn_list');
    if (!btnList) return;
    var links = btnList.querySelectorAll('a');
    // links[0] → 추가 등록하기
    if (links[0]) {
      links[0].textContent = '추가 등록하기';
      links[0].removeAttribute('href');
      links[0].style.cursor = 'pointer';
      links[0].addEventListener('click', function(e) {
        e.preventDefault();
        location.href = '/sell/register.html';
      });
    }
    // links[1] → 등록 상품 보기 (숨김)
    if (links[1]) links[1].style.display = 'none';
    // links[2] → 상품리스트 보기 → 해당 게임 팝니다 목록
    if (links[2]) {
      links[2].textContent = '상품리스트 보기';
      links[2].className = 'btn_gray';
      links[2].removeAttribute('href');
      links[2].style.cursor = 'pointer';
      links[2].addEventListener('click', function(e) {
        e.preventDefault();
        location.href = listUrl;
      });
    }
  }

  if (!productId) {
    // productId 없어도 버튼은 패치
    patchButtons(buildListUrl(gid, catParam));
    return;
  }

  fetch('/api/products/' + productId, { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(p) {
      // 테이블 데이터 채우기
      document.querySelectorAll('#table_wrapper table tbody tr').forEach(function(row) {
        var th = row.querySelector('th');
        var td = row.querySelector('td');
        if (!th || !td) return;
        var label = th.textContent.trim();
        if (label === '거래번호') {
          td.textContent = '#' + p.id;
        } else if (label === '카테고리') {
          var cat = p.gameName || '';
          if (p.serverName)    cat += ' > ' + p.serverName;
          if (p.itemCategory)  cat += ' > ' + p.itemCategory;
          td.textContent = cat;
        } else if (label === '거래유형') {
          td.textContent = '일반판매';
        } else if (label === '판매금액') {
          td.textContent = Number(p.price || 0).toLocaleString() + '원';
        } else if (label === '제목') {
          td.textContent = p.title || '';
        } else if (label === '상품종류') {
          td.textContent = p.itemCategory || '기타';
        } else if (label === '판매수량') {
          td.textContent = '-';
        } else if (label.includes('상품등록정보')) {
          td.innerHTML = '상품이 정상 등록되었습니다.';
        }
      });

      // URL에 gid 없으면 products API 응답에서 게임 검색
      var resolvedGid = gid;
      if (!resolvedGid && p.gameName) {
        // 게임명으로 gid 조회
        fetch('/api/games/search?q=' + encodeURIComponent(p.gameName), { credentials: 'include' })
          .then(function(r2) { return r2.json(); })
          .then(function(games) {
            if (games && games.length > 0) resolvedGid = games[0].id;
            patchButtons(buildListUrl(resolvedGid, p.itemCategory));
          })
          .catch(function() { patchButtons(buildListUrl(null, p.itemCategory)); });
      } else {
        patchButtons(buildListUrl(resolvedGid, p.itemCategory));
      }
    })
    .catch(function(err) {
      console.error('완료 페이지 오류', err);
      patchButtons(buildListUrl(gid, catParam));
    });
})();
</script>`;

  const patched = sellIndexViewHtml
    .replace(/<meta[^>]+content-security-policy[^>]*>/gi, '')
    .replace('</main>', SELL_INDEX_VIEW_INTERCEPT_SCRIPT + '\n</main>');
  res.send(patched);
});

// 구매등록 페이지
router.get("/buy/register.html", async (req, res): Promise<void> => {
  if (!buyRegisterHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveBuyRegister(buyRegisterHtml, user));
});

// 판매 NEW 모드 페이지
router.get("/sell/new.html", async (req, res): Promise<void> => {
  if (!sellNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveSellNew(sellNewHtml, user));
});

// 구매 NEW 모드 페이지 (판매 NEW 모드 HTML 재사용 + 구매용 인터셉터)
router.get("/buy/new.html", async (req, res): Promise<void> => {
  if (!sellNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveBuyNew(sellNewHtml, user));
});

// 물품일괄등록 페이지
router.get("/myroom/batch_goods/index.html", async (req, res): Promise<void> => {
  if (!batchGoodsHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveBatchGoods(batchGoodsHtml, user));
});

// 마이룸 페이지
router.get(["/myroom/index.html", "/myroom/", "/myroom"], async (req, res): Promise<void> => {
  if (!myroomHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveMyroom(myroomHtml, user));
});

// 출금하기 - 은행계좌 출금 내역
router.get("/myroom/mileage/payment/payment_list.html", async (req, res): Promise<void> => {
  if (!paymentListHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(servePaymentList(paymentListHtml, user));
});

// 출금하기 - 휴대폰번호 출금 내역
router.get("/myroom/mileage/payment/payment_phone_list.html", async (req, res): Promise<void> => {
  if (!paymentPhoneListHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(servePaymentPhoneList(paymentPhoneListHtml, user));
});

// payment_switch → payment_list 리다이렉트
router.get("/myroom/mileage/payment/payment_switch.html", async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/mileage/payment/payment_list.html");
});
router.get("/myroom/mileage/payment/payment_switch.html", async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/mileage/payment/payment_list.html");
});
router.get("/myroom/mileage/payment/payment_list.html", async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/mileage/payment/payment_list.html");
});
router.get("/myroom/mileage/payment/payment_phone_list.html", async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/mileage/payment/payment_phone_list.html");
});

// 판매등록/구매등록 직접 접근 리다이렉트
router.get(["/sell/", "/sell"], async (req, res): Promise<void> => {
  res.redirect(302, "/sell/register.html");
});
router.get("/buy/register.html", async (req, res): Promise<void> => {
  res.redirect(302, "/buy/register.html");
});
router.get("/sell/new.html", async (req, res): Promise<void> => {
  res.redirect(302, "/sell/new.html");
});
router.get("/myroom/batch_goods/index.html", async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/batch_goods/index.html");
});

// 상품 상세 구매 신청 페이지 (/sell/application.html?id=...)
router.get("/sell/application.html", async (req, res): Promise<void> => {
  if (!sellApplicationHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveApplication(sellApplicationHtml, user));
});

// 삽니다 상세 페이지 (/buy/application.html?id=...)
router.get("/buy/application.html", async (req, res): Promise<void> => {
  if (!buyApplicationHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveBuyApplication(buyApplicationHtml, user));
});


// 삽니다 목록 페이지 (/buy/list.html?search_game=...)
router.get("/buy/list.html", async (req, res): Promise<void> => {
  if (!buyLineageClassicHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveBuy(buyLineageClassicHtml, user));
});

// 삽니다 목록 리다이렉트
router.get("/buy/list.html", async (req, res): Promise<void> => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/buy/list.html${qs}`);
});

// 구매등록 리다이렉트 (/buy/ 단독 → 구매등록 페이지)
router.get("/buy/", async (req, res): Promise<void> => {
  res.redirect(302, `/buy/register.html`);
});

// 개별 채팅방 페이지
router.get("/myroom/chat/new_chat.html", async (req, res): Promise<void> => {
  if (!chatNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveChatNew(chatNewHtml, user));
});

// 채팅방 직접 접근 리다이렉트
router.get("/myroom/chat/new_chat.html", async (req, res): Promise<void> => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/myroom/chat/new_chat.html${qs}`);
});

// 매니아 채팅 페이지
router.get(["/myroom/chat/list.html", "/myroom/chat/"], async (req, res): Promise<void> => {
  const order = req.query["order"];
  const html = order === "1" ? chatOrderedHtml : chatHtml;
  if (!html) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveChat(html, user));
});

// 게임매니아 페이지
router.get("/gamemania", async (req, res): Promise<void> => {
  if (!gamemanaHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  const user = await getSessionUser(req);

  res.send(serveGamemania(gamemanaHtml, user));
});

// ── receipt_layer 원본 HTML 캡처 저장 엔드포인트 ─────────────────────
router.post("/im-capture-receipt", async (req, res): Promise<void> => {
  let body = "";
  req.setEncoding("utf-8");
  req.on("data", (chunk: string) => { body += chunk; });
  req.on("end", () => {
    const html = body.trim();
    if (!html || html.length < 50) {
      res.status(400).send("too short");
      return;
    }
    try {
      writeFileSync(CAPTURED_RECEIPT_PATH, html, "utf-8");
      capturedReceiptHtml = html;
      logger.info({ bytes: html.length }, "receipt_layer 원본 캡처 저장 완료");
      res.json({ ok: true, bytes: html.length });
    } catch (e) {
      logger.error({ err: e }, "receipt_layer 캡처 저장 실패");
      res.status(500).send("save failed");
    }
  });
});

// ── 팝업 미리보기 테스트 페이지 (원본 HTML 사용) ────────────────────
router.get("/test-popups", (_req, res): void => {
  if (!sellRegisterHtml) {
    res.status(503).send("sell-register.html not loaded");
    return;
  }

  // sell-register.html에서 CSS 추출 (style block 0 = 5MB base64 폰트 제외, 1번 이후만)
  const styleMatches = [...sellRegisterHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  const originalCss = styleMatches.slice(1).map(m => m[1]).join("\n");

  // dvPremium 원본 HTML 추출 (dvPopup 직전까지)
  const dvPremiumMatch = sellRegisterHtml.match(/<div id=dvPremium[\s\S]*?(?=\n? *<div id=dvPopup)/);
  const dvPremiumHtml = dvPremiumMatch ? dvPremiumMatch[0].trimEnd() : "";

  // dvPopup 원본 HTML 추출 (dvSignboard 직전까지)
  const dvPopupMatch = sellRegisterHtml.match(/<div id=dvPopup[\s\S]*?(?=\n? *<div id=dvSignboard)/);
  const dvPopupHtml = dvPopupMatch ? dvPopupMatch[0].trimEnd() : "";

  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang=ko>
<head>
<meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1.0">
<title>팝업 미리보기 (원본)</title>
<!-- sell-register.html 원본 CSS (폰트 블록 제외) -->
<style>${originalCss}</style>
<style>
/* ─── 테스트 페이지 전용 ─── */
body{background:#d0d0d0;padding:30px;font-family:sans-serif}
h2{margin-bottom:6px;font-size:20px}
p.note{margin:0 0 20px;font-size:13px;color:#555}
.btn{margin:6px;padding:10px 22px;font-size:15px;cursor:pointer;
  background:#159EFD;color:#fff;border:none;border-radius:8px;font-weight:700}
/* im-show 토글: g_layer에 flex 강제 적용 */
.g_layer.im-show{display:flex!important}
/* receipt_layer 커스텀 내부 스타일 */
.receipt-notice{background:#EBF5FF;border:1px solid #B0D4F1;border-radius:6px;
  padding:14px 16px;margin-bottom:18px;font-size:14px;font-weight:600;color:#1a6fb0}
.receipt-row{border:1px solid #ddd;border-radius:6px;padding:16px 20px;
  display:flex;align-items:center;gap:24px;margin-bottom:16px}
.receipt-row span{font-size:14px;font-weight:600}
.receipt-row label{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px}
.receipt-hint{font-size:13px;color:#666;margin:0 0 4px;line-height:1.6}
/* g_hidden/sf-hidden 숨김 클래스 해제 (테스트용) */
.g_hidden,.sf-hidden{display:none!important}
input[type=checkbox].g_hidden,input[type=checkbox].sf-hidden{display:none!important}
</style>
</head>
<body>
<h2>팝업 미리보기 테스트 <small style="font-size:13px;color:#555">(sell-register.html 원본 HTML 사용)</small></h2>
<p class=note>버튼을 클릭하면 해당 팝업이 표시됩니다. 폰트는 폴백 적용(5MB 폰트 블록 로딩 생략).</p>
<p class=note style="color:${capturedReceiptHtml ? '#2a7a2a' : '#b84000'}">
  ② 현금영수증 팝업: ${capturedReceiptHtml
    ? `✓ 원본 캡처됨 (${capturedReceiptHtml.length.toLocaleString()}자) — 원본 HTML 사용 중`
    : '⚠️ 미캡처 — 판매 등록 플로우 1회 실행 시 자동 저장됩니다'
  }
</p>
<button class=btn onclick="showPopup('dvPremium')">① 프리미엄 등록안내</button>
<button class=btn onclick="showPopup('receipt_layer')">② 현금 영수증</button>
<button class=btn onclick="showPopup('dvPopup')">③ 물품등록정보</button>

<!-- ① dvPremium: 원본 HTML ──────────────────────────────────────── -->
${dvPremiumHtml}

<!-- ② receipt_layer: 캡처된 원본 HTML 우선, 없으면 임시 안내 -->
<div id=receipt_layer class="g_layer receipt_layer" style=display:none>
${capturedReceiptHtml
  ? capturedReceiptHtml
  : ` <div class=inner>
  <div class=title>현금 영수증</div>
  <div class=cont>
   <p style="color:#888;font-size:14px;text-align:center;padding:30px 0">
    ⚠️ 원본 HTML 미캡처 상태<br>
    판매 등록 플로우를 한 번 거치면 자동 저장됩니다.
   </p>
  </div>
 </div>`
}
</div>

<!-- ③ dvPopup: 원본 HTML ───────────────────────────────────────── -->
${dvPopupHtml}

<script>
function showPopup(id){
  ['dvPremium','receipt_layer','dvPopup'].forEach(function(x){
    document.getElementById(x).classList.remove('im-show');
  });
  document.getElementById(id).classList.add('im-show');
}
function hidePopup(id){ document.getElementById(id).classList.remove('im-show'); }

// 확인/취소 버튼 연결 (원본 HTML의 onclick이 없으므로 JS로 연결)
window.addEventListener('DOMContentLoaded', function(){
  // dvPremium 확인 → receipt_layer
  var premiumBtn = document.getElementById('premium_btn');
  if(premiumBtn) premiumBtn.addEventListener('click', function(){
    hidePopup('dvPremium'); showPopup('receipt_layer');
  });
  // dvPopup 확인/취소 → 닫기
  var regSubmit = document.getElementById('reg_submit');
  if(regSubmit) regSubmit.addEventListener('click', function(){ hidePopup('dvPopup'); });
  var cancelSubmit = document.getElementById('cancel_submit');
  if(cancelSubmit) cancelSubmit.addEventListener('click', function(){ hidePopup('dvPopup'); });

  // 페이지 로드 시 첫 번째 팝업 자동 표시
  showPopup('dvPremium');
});
</script>
</body>
</html>`);
});

// /proxy 및 나머지 하위 경로 → itemmania.html 서빙
// /proxy/* 구버전 경로 → 새 경로로 301 리다이렉트 (하위호환)
router.get(["/proxy", "/proxy/{*splat}"], async (req, res): Promise<void> => {
  const params = req.params as { splat?: string };
  const splat = params.splat || "";
  res.redirect(301, splat ? "/" + splat : "/");
});

export default router;
