import express, { Router, type IRouter } from "express";
import { ADMIN_SCRIPT_CONTENT } from "../admin-script-content";
import { createHmac } from "crypto";

const CRAWL_KEY = createHmac("sha256", process.env.SESSION_SECRET || "itemmania-default")
  .update("crawl-key-v1")
  .digest("hex")
  .slice(0, 32);

const router: IRouter = Router();

function loadAdminScript(): string {
  return ADMIN_SCRIPT_CONTENT;
}

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>아이템매니아 어드민</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f4f6fb;color:#222;min-height:100vh}
#login-screen{display:none;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:#fff;border-radius:16px;padding:48px 40px;width:360px;box-shadow:0 4px 32px rgba(0,0,0,.10)}
.login-box h1{font-size:22px;font-weight:700;color:#1a1a1a;margin-bottom:6px}
.login-box p{font-size:13px;color:#888;margin-bottom:28px}
.login-box input{display:block;width:100%;padding:12px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;margin-bottom:12px;outline:none;transition:border .2s}
.login-box input:focus{border-color:#159EFD}
.login-box button{width:100%;padding:13px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer}
.login-box button:hover{background:#0e8de0}
.login-box .err{color:#e53e3e;font-size:13px;margin-top:8px;display:none}
#admin-screen{display:none;min-height:100vh}
.topbar{background:#fff;border-bottom:1px solid #e8ecf0;padding:0 32px;display:flex;align-items:center;gap:16px;height:60px;position:sticky;top:0;z-index:100}
.topbar .logo{font-size:18px;font-weight:800;color:#159EFD;letter-spacing:-.03em}
.topbar .logo span{color:#222}
.topbar .admin-badge{font-size:12px;font-weight:600;background:#edf8ff;color:#0e8de0;padding:3px 10px;border-radius:20px}
.topbar .spacer{flex:1}
.topbar .logout-btn{font-size:13px;color:#888;background:none;border:none;cursor:pointer;padding:6px 12px;border-radius:6px}
.topbar .logout-btn:hover{background:#f0f0f0}
.topbar .voice-btn{font-size:13px;background:none;border:1.5px solid #e0e0e0;border-radius:6px;cursor:pointer;padding:5px 11px;color:#888;transition:all .2s}
.topbar .voice-btn.on{background:#edf8ff;border-color:#159EFD;color:#0e8de0;font-weight:600}
.content{padding:28px 32px;max-width:1300px;margin:0 auto}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:28px}
.stat-card{background:#fff;border-radius:12px;padding:18px 20px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.stat-card .label{font-size:12px;color:#888;margin-bottom:5px}
.stat-card .value{font-size:26px;font-weight:700;color:#222}
.stat-card .value.blue{color:#159EFD}.stat-card .value.green{color:#38a169}.stat-card .value.orange{color:#dd6b20}.stat-card .value.purple{color:#6b46c1}
.tabs{display:flex;gap:0;border-bottom:2px solid #e8ecf0;margin-bottom:20px}
.tab-btn{padding:10px 22px;font-size:14px;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;cursor:pointer;color:#888;transition:all .2s}
.tab-btn.active{color:#159EFD;border-bottom-color:#159EFD}
.tab-panel{display:none}.tab-panel.active{display:block}
.table-wrap{background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden}
.table-toolbar{padding:14px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.table-toolbar .title{font-size:15px;font-weight:700}.table-toolbar .spacer{flex:1}
.filter-select{padding:7px 10px;border:1.5px solid #e0e0e0;border-radius:7px;font-size:13px;outline:none;cursor:pointer}
.refresh-btn{padding:7px 14px;background:#f4f6fb;border:1.5px solid #e0e0e0;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;color:#555}
.refresh-btn:hover{background:#eef0f5}
.primary-btn{padding:8px 18px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.primary-btn:hover{background:#0e8de0}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{background:#f8f9fc;padding:10px 12px;text-align:left;font-weight:600;color:#555;border-bottom:1px solid #eee;white-space:nowrap}
tbody td{padding:9px 12px;border-bottom:1px solid #f5f5f5;vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:#fafbff}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
.badge.admin{background:#fef3cd;color:#a06c00}.badge.user{background:#edf8ff;color:#0e8de0}
.badge.pending{background:#fff7e6;color:#dd6b20}.badge.approved{background:#e6f9ef;color:#276749}.badge.rejected{background:#fee;color:#c53030}
.badge.active{background:#e6f9ef;color:#276749}.badge.cancelled,.badge.inactive{background:#fee;color:#c53030}.badge.sold{background:#e9e3ff;color:#553c9a}
.badge.escrow{background:#edf8ff;color:#0e8de0}.badge.completed{background:#e6f9ef;color:#276749}
.badge.sell{background:#edf8ff;color:#0e8de0}.badge.buy{background:#e6f9ef;color:#276749}
.action-btn{padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:none;margin-right:3px}
.action-btn.approve{background:#e6f9ef;color:#276749}.action-btn.approve:hover{background:#c6f6e0}
.action-btn.reject{background:#fee;color:#c53030}.action-btn.reject:hover{background:#fcc}
.action-btn.delete{background:#fee;color:#c53030}.action-btn.delete:hover{background:#fcc}
.action-btn.edit{background:#edf8ff;color:#0e8de0}.action-btn.edit:hover{background:#bee3f8}
.action-btn.auth{background:#f0f4ff;color:#5a5fc7}.action-btn.auth:hover{background:#dde3ff}
.action-btn:disabled{opacity:.4;cursor:not-allowed}
.empty-row td{text-align:center;color:#aaa;padding:32px}
.auth-grid{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.auth-item{display:flex;align-items:center;gap:6px;padding:10px 14px;border:1.5px solid #e0e0e0;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;transition:border .2s;user-select:none}
.auth-item:hover{border-color:#159EFD}
.auth-item input[type=checkbox]{width:16px;height:16px;cursor:pointer;accent-color:#159EFD}
.registration-policy{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:#fff;border:1px solid #e8ecf0;border-radius:12px;padding:16px 20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
.registration-policy .policy-copy{flex:1;min-width:240px}
.registration-policy .policy-title{font-size:14px;font-weight:700;margin-bottom:4px}
.registration-policy .policy-description{font-size:12px;color:#666;line-height:1.6}
.registration-policy .policy-status{font-size:12px;color:#555;min-width:155px}
.registration-policy .policy-status.error{color:#b42318}
.policy-toggle{min-width:86px;padding:9px 14px;border:1px solid #aab3bd;border-radius:8px;background:#f4f6f8;color:#394150;font-size:14px;font-weight:700;cursor:pointer}
.policy-toggle[aria-checked="true"]{background:#fff0ed;border-color:#d92d20;color:#b42318}
.policy-toggle:focus-visible{outline:3px solid rgba(21,158,253,.35);outline-offset:2px}
.policy-toggle:disabled{opacity:.55;cursor:not-allowed}
/* 모달 */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;align-items:center;justify-content:center}
.modal-overlay.open{display:flex}
.modal{background:#fff;border-radius:16px;padding:32px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.18)}
.modal h2{font-size:18px;font-weight:700;margin-bottom:20px}
.modal label{display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:4px;margin-top:14px}
.modal label:first-of-type{margin-top:0}
.modal input,.modal select,.modal textarea{width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;outline:none;font-family:inherit;transition:border .2s}
.modal input:focus,.modal select:focus,.modal textarea:focus{border-color:#159EFD}
.modal textarea{resize:vertical;min-height:80px}
.modal .modal-btns{display:flex;gap:10px;margin-top:20px;justify-content:flex-end}
.modal .cancel-btn{padding:10px 20px;background:#f4f6fb;border:1.5px solid #e0e0e0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;color:#555}
.modal .save-btn{padding:10px 24px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
.modal .save-btn:hover{background:#0e8de0}
#toast{position:fixed;bottom:28px;right:28px;background:#222;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;opacity:0;pointer-events:none;transition:opacity .3s;z-index:9999}
#toast.show{opacity:1}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<div id="login-screen">
  <div class="login-box">
    <h1>어드민 로그인</h1>
    <p>아이템매니아 관리자 계정으로 로그인하세요</p>
    <form id="loginForm" method="POST" action="/banana777">
      <input type="text" id="loginEmail" name="email" placeholder="이메일 또는 아이디" autocomplete="username">
      <input type="password" id="loginPw" name="password" placeholder="비밀번호" autocomplete="current-password">
      <button type="submit">로그인</button>
    </form>
    <div class="err" id="loginErr"></div>
  </div>
</div>

<div id="admin-screen">
  <div class="topbar">
    <div class="logo">아이템매니아<span>어드민</span></div>
    <div class="admin-badge" id="adminNickname"></div>
    <div class="spacer"></div>
    <button class="voice-btn" id="adminSoundEnableBtn" onclick="_adminUnlockAudio()" style="display:none">🔔 알림음 켜기</button>
    <button class="voice-btn" id="voiceToggleBtn" onclick="toggleAdminVoice()">🔇 음성 OFF</button>
    <button class="voice-btn" id="voiceTestBtn" onclick="adminSpeakTest()" style="font-size:12px;padding:4px 9px">테스트🔊</button>
    <button class="logout-btn" onclick="doLogout()">로그아웃</button>
  </div>
  <div class="content">
    <div class="stats">
      <div class="stat-card"><div class="label">전체 회원</div><div class="value blue" id="statUsers">-</div></div>
      <div class="stat-card"><div class="label">전체 상품</div><div class="value purple" id="statProducts">-</div></div>
      <div class="stat-card"><div class="label">전체 주문</div><div class="value" id="statOrders">-</div></div>
      <div class="stat-card"><div class="label">출금 대기</div><div class="value orange" id="statPendingWd">-</div></div>
      <div class="stat-card"><div class="label">출금 완료</div><div class="value green" id="statApprovedWd">-</div></div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('products')">📦 상품 관리</button>
      <button class="tab-btn" onclick="switchTab('users')">👥 회원 관리</button>
      <button class="tab-btn" onclick="switchTab('orders')">🛒 주문 관리</button>
      <button class="tab-btn" onclick="switchTab('withdrawals')">💸 출금 관리</button>
      <button class="tab-btn" onclick="switchTab('crawl')">🕷️ 크롤링</button>
      <button class="tab-btn" onclick="switchTab('chatrooms')">💬 채팅 거래</button>
      <button class="tab-btn" onclick="switchTab('ipblocks')">🚫 IP 차단</button>
    </div>

    <!-- 상품 탭 -->
    <div class="tab-panel active" id="tab-products">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">상품 목록</span>
          <select class="filter-select" id="prodCategoryFilter" onchange="loadProducts(1)">
            <option value="">전체 유형</option>
            <option value="sell">팝니다</option>
            <option value="buy">삽니다</option>
          </select>
          <select class="filter-select" id="prodStatusFilter" onchange="loadProducts()">
            <option value="">판매중·완료</option>
            <option value="active">판매중</option>
            <option value="sold">판매완료</option>
            <option value="inactive">비활성</option>
          </select>
          <div class="spacer"></div>
          <button class="refresh-btn" onclick="loadProducts()">↻ 새로고침</button>
          <button class="danger-btn" onclick="deleteNoGradeProducts()" style="background:#dc3545;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">🗑 등급없는 상품 삭제</button>
          <button class="primary-btn" onclick="openProductModal()">+ 상품 등록</button>
        </div>
        <table>
          <thead><tr>
            <th>ID</th><th>유형</th><th>게임명</th><th>상품명</th><th>가격</th><th>판매자</th><th>상태</th><th>등록일</th><th>관리</th>
          </tr></thead>
          <tbody id="productsBody"><tr class="empty-row"><td colspan="9">로딩 중...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- 회원 탭 -->
    <div class="tab-panel" id="tab-users">
      <section class="registration-policy" aria-labelledby="registrationPolicyTitle">
        <div class="policy-copy">
          <div class="policy-title" id="registrationPolicyTitle">신규 회원 가입 차단</div>
          <div class="policy-description">ON = 차단, OFF = 허용. ON이면 일반 회원가입과 미등록 ID 로그인 시 자동 회원가입이 차단됩니다. 기존 회원의 로그인은 계속 허용됩니다.</div>
        </div>
        <button class="policy-toggle" id="registrationPolicyToggle" type="button" role="switch" aria-label="신규 회원 가입 차단" aria-checked="false" disabled onclick="toggleRegistrationPolicy()">—</button>
        <div class="policy-status" id="registrationPolicyStatus" role="status" aria-live="polite">상태 확인 중...</div>
        <button class="refresh-btn" id="registrationPolicyRetry" type="button" onclick="loadRegistrationPolicy()" hidden>정책 다시 불러오기</button>
      </section>
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">회원 목록</span>
          <div class="spacer"></div>
          <button class="refresh-btn" onclick="refreshUsers()">↻ 새로고침</button>
        </div>
        <p style="padding:0 14px;color:#777;font-size:12px">가입·최근 로그인 IP는 기록된 경우에만 표시됩니다. 과거 회원의 IP는 추정할 수 없습니다. 계정 차단과 IP 차단은 별개이며, IP 차단은 같은 IP를 쓰는 다른 사람에게도 적용됩니다.</p>
        <table>
          <thead><tr><th>ID</th><th>이메일</th><th>닉네임</th><th>전화번호</th><th>등급</th><th>잔액</th><th>가입일</th><th>IP 기록</th><th>계정 상태</th><th>인증</th><th>관리</th></tr></thead>
          <tbody id="usersBody"><tr class="empty-row"><td colspan="11">로딩 중...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- 주문 탭 -->
    <div class="tab-panel" id="tab-orders">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">주문 목록</span>
          <div class="spacer"></div>
          <select class="filter-select" id="orderStatusFilter" onchange="loadOrders()">
            <option value="">전체 상태</option>
            <option value="active">진행중</option>
            <option value="completed">완료</option>
            <option value="cancelled">취소됨</option>
            <option value="escrow">에스크로</option>
          </select>
          <button class="refresh-btn" onclick="loadOrders()">↻ 새로고침</button>
        </div>
        <table>
          <thead><tr><th>ID</th><th>상품명</th><th>구매자ID</th><th>판매자ID</th><th>금액</th><th>상태</th><th>주문일</th></tr></thead>
          <tbody id="ordersBody"><tr class="empty-row"><td colspan="7">로딩 중...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- 출금 탭 -->
    <div class="tab-panel" id="tab-withdrawals">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">출금 신청 목록</span>
          <div class="spacer"></div>
          <select class="filter-select" id="wdStatusFilter" onchange="loadWithdrawals()">
            <option value="pending">대기중</option>
            <option value="">전체</option>
            <option value="approved">승인됨</option>
            <option value="rejected">거절됨</option>
          </select>
          <button class="refresh-btn" onclick="loadWithdrawals()">↻ 새로고침</button>
        </div>
        <table>
          <thead><tr><th>ID</th><th>유저ID</th><th>금액</th><th>은행</th><th>계좌번호</th><th>예금주</th><th>상태</th><th>메모</th><th>신청일</th><th>처리</th></tr></thead>
          <tbody id="withdrawalsBody"><tr class="empty-row"><td colspan="10">로딩 중...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- 채팅 거래 탭 -->
    <div class="tab-panel" id="tab-chatrooms">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">채팅 거래 내역</span>
          <select class="filter-select" id="chatroomStatusFilter" onchange="loadChatRooms()">
            <option value="">전체 상태</option>
            <option value="active">진행중</option>
            <option value="handover">인계완료</option>
            <option value="ended">거래완료</option>
            <option value="cancelled">취소</option>
          </select>
          <div class="spacer"></div>
          <button class="refresh-btn" onclick="loadChatRooms()">↻ 새로고침</button>
        </div>
        <table>
          <thead><tr><th>ID</th><th>판매자</th><th>구매자</th><th>상품명</th><th>거래금액</th><th>상태</th><th>생성일</th><th>관리</th></tr></thead>
          <tbody id="chatroomsBody"><tr class="empty-row"><td colspan="8">탭을 클릭하면 로드됩니다</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- IP 차단 탭 -->
    <div class="tab-panel" id="tab-ipblocks">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">차단된 IP 목록</span>
          <span style="font-size:12px;color:#777">현재 접속 IP: <code id="ipBlocksCurrentIp">확인 중…</code></span>
          <div class="spacer"></div>
          <button class="refresh-btn" type="button" onclick="loadIpBlocks()">↻ 새로고침</button>
        </div>
        <div style="padding:20px">
          <div style="padding:12px 14px;background:#fff8e6;border:1px solid #f3d590;border-radius:8px;color:#795b16;font-size:13px;line-height:1.6;margin-bottom:18px">
            차단한 IP의 사이트 접속이 제한됩니다. 관리자 접속은 차단 대상에서 제외되므로, 관리자는 이 화면에서 차단 해제할 수 있습니다.
            <br>현재 접속 IP도 차단할 수 있지만, 같은 IP를 공유하는 일반 사이트 방문자는 차단될 수 있습니다.
          </div>
          <form id="ipBlockForm" onsubmit="createIpBlock(event)" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:10px">
            <label style="display:block;flex:1;min-width:220px;font-size:13px;font-weight:600;color:#555">
              IP 주소 (IPv4 또는 IPv6)
              <input id="ipBlockAddress" name="ip" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="45" placeholder="예: 203.0.113.10 또는 2001:db8::1" required style="display:block;width:100%;margin-top:5px;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px">
            </label>
            <label style="display:block;flex:2;min-width:220px;font-size:13px;font-weight:600;color:#555">
              사유 (선택)
              <input id="ipBlockReason" name="reason" type="text" maxlength="200" placeholder="예: 반복적인 스팸 등록" style="display:block;width:100%;margin-top:5px;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px">
            </label>
            <button id="ipBlockSubmit" class="primary-btn" type="submit" style="height:39px">IP 차단</button>
          </form>
          <div id="ipBlocksMessage" role="status" aria-live="polite" style="min-height:20px;margin-bottom:8px;font-size:13px"></div>
        </div>
        <table>
          <thead><tr><th>IP 주소</th><th>사유</th><th>차단일</th><th>관리</th></tr></thead>
          <tbody id="ipBlocksBody"><tr class="empty-row"><td colspan="4">탭을 열면 차단 목록을 불러옵니다.</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- 크롤링 탭 -->
    <div class="tab-panel" id="tab-crawl">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">itemmania.com 상품 크롤링</span>
        </div>
        <div style="padding:24px">
          <!-- 즉시 가져오기 (스냅샷) -->
          <div style="background:linear-gradient(135deg,#e8f5e9,#f0fdf4);border:2px solid #4caf50;border-radius:12px;padding:20px;margin-bottom:16px">
            <div style="font-size:16px;font-weight:800;color:#2e7d32;margin-bottom:6px">⚡ 즉시 상품 가져오기</div>
            <div style="font-size:13px;color:#555;margin-bottom:16px">
              서버에 저장된 게임별 상품 데이터를 DB에 바로 넣습니다. <b>가장 빠르고 확실합니다.</b><br>
              <span style="color:#888;font-size:12px">* 10개 게임 × 약 20~60개 = 최대 600여 개 상품 즉시 저장</span>
            </div>
            <button id="snapshotBtn" onclick="snapshotImport()" style="padding:14px 32px;background:#43a047;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 3px 10px rgba(67,160,71,0.35)">⚡ 지금 바로 가져오기</button>
            <div id="snapshotStatus" style="margin-top:12px;font-size:13px;display:none"></div>
          </div>


          <div style="margin-bottom:20px">
            <b style="display:block;margin-bottom:10px">수집 대상 게임</b>
            <div id="crawlGameList" style="display:flex;flex-wrap:wrap;gap:8px"></div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap">
            <label style="font-size:14px;font-weight:600">페이지 수:
              <select id="crawlPages" style="margin-left:8px;padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;outline:none">
                <option value="1">1페이지 (약 20개/게임)</option>
                <option value="2">2페이지 (약 40개/게임)</option>
                <option value="3">3페이지 (약 60개/게임)</option>
                <option value="5">5페이지 (약 100개/게임)</option>
              </select>
            </label>
          </div>

          <div style="margin-bottom:16px;padding:13px 16px;background:#f0f7ff;border:1px solid #b3d8ff;border-radius:8px;font-size:13px;color:#334;line-height:1.65">
            <b style="color:#135c9e">Firecrawl 서버 키를 우선 사용합니다.</b> 키는 서버 Secrets에 보관되며 브라우저에 전달되지 않습니다.
            상품 목록은 선택한 게임마다 팝니다·삽니다 두 카테고리를 각각 요청하므로, 1페이지 기준 <b>선택 게임 수 × 2회</b>의 Firecrawl 페이지 요청이 예상됩니다.
            무료 플랜은 월 1,000크레딧이며 재시도 등으로 실제 사용량이 달라질 수 있습니다. 실행 전 아래 예상치를 확인하세요.
          </div>

          <!-- Firecrawl 우선, 기존 ScraperAPI 키는 선택 입력 -->
          <details id="crawlApiKeySection" style="margin-bottom:20px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
            <summary style="padding:12px 16px;background:#f8f9fa;cursor:pointer;font-size:13px;font-weight:600;color:#666">⚙️ Firecrawl 상태 / 기존 ScraperAPI 키 (선택)</summary>
            <div style="padding:16px">
              <p style="font-size:13px;color:#555;margin:0 0 12px">
                기본 수집에는 브라우저 키 입력이 필요 없습니다. 서버의 <code>FIRECRAWL_API_KEY</code>를 사용합니다.
                기존 ScraperAPI 키는 서버에 Firecrawl 키가 없을 때만 선택적으로 사용할 수 있습니다.
              </p>
              <div style="display:flex;gap:8px;margin-bottom:8px">
                <input type="password" id="crawlApiKeyInput" placeholder="(선택) 기존 ScraperAPI 키" autocomplete="off" style="flex:1;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;outline:none">
                <button onclick="testApiKey()" style="padding:10px 16px;background:#6c757d;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px">기존 키 테스트</button>
              </div>
              <div id="crawlApiKeyStatus" style="font-size:12px;color:#888">서버 키 상태를 확인합니다. Firecrawl 키를 이 입력란에 붙여 넣지 마세요.</div>
              <div style="margin-top:12px;padding:10px 14px;background:#f0f7ff;border:1.5px solid #b3d8ff;border-radius:8px">
                <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
                  <input type="checkbox" id="crawlDetailCheck" style="width:16px;height:16px;margin-top:2px;accent-color:#159EFD;flex-shrink:0">
                  <span style="font-size:13px;color:#333">
                    <b style="color:#159EFD">상세 페이지 크롤 포함 (선택)</b>
                    <span style="display:block;color:#a33;margin-top:3px;font-size:12px">상품마다 별도 API 요청이 추가되어 크레딧을 크게 더 사용합니다. 무료 한도를 빠르게 소진할 수 있습니다.</span>
                    <span id="crawlDetailCost" style="display:block;color:#e57c00;margin-top:3px;font-size:12px"></span>
                  </span>
                </label>
              </div>
              <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
                <button id="crawlBtn" onclick="startCrawl()" style="padding:10px 20px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🕷️ Firecrawl로 수집</button>
                <button id="discoverBtn" onclick="discoverApi()" style="padding:10px 16px;background:#6c757d;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🔍 기존 ScraperAPI로 API 탐지</button>
              </div>
            </div>
          </details>
          <div id="discoverResult" style="display:none;background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;max-height:400px;overflow-y:auto;margin-bottom:16px;white-space:pre-wrap"></div>

          <div id="crawlStatus" style="display:none">
            <!-- 헤더: 스피너 + 상태텍스트 + 타이머 -->
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
              <div id="crawlSpinner" style="width:18px;height:18px;border:3px solid #e0e0e0;border-top-color:#159EFD;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0"></div>
              <span id="crawlStatusText" style="font-size:14px;color:#333;font-weight:600;flex:1">크롤링 중...</span>
              <span id="crawlTimer" style="font-size:13px;color:#888;font-family:monospace;min-width:60px;text-align:right">00:00</span>
            </div>

            <!-- 전체 진행률 바 -->
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:5px">
                <span id="crawlProgressLabel">준비 중...</span>
                <span id="crawlProgressPct">0%</span>
              </div>
              <div style="background:#e9ecef;border-radius:6px;height:10px;overflow:hidden">
                <div id="crawlProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,#159EFD,#0d7edf);border-radius:6px;transition:width 0.4s ease"></div>
              </div>
            </div>

            <!-- 실시간 통계 -->
            <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
              <div style="flex:1;min-width:100px;background:#f0f9ff;border:1px solid #b3d8ff;border-radius:8px;padding:10px 14px;text-align:center">
                <div id="crawlSavedCount" style="font-size:22px;font-weight:800;color:#159EFD;line-height:1.2">0</div>
                <div style="font-size:11px;color:#666;margin-top:2px">저장된 상품</div>
              </div>
              <div style="flex:1;min-width:100px;background:#fff8f0;border:1px solid #ffd599;border-radius:8px;padding:10px 14px;text-align:center">
                <div id="crawlFailedCount" style="font-size:22px;font-weight:800;color:#e57c00;line-height:1.2">0</div>
                <div style="font-size:11px;color:#666;margin-top:2px">실패</div>
              </div>
              <div style="flex:1;min-width:100px;background:#f0fff4;border:1px solid #9be6b0;border-radius:8px;padding:10px 14px;text-align:center">
                <div id="crawlStepCount" style="font-size:22px;font-weight:800;color:#28a745;line-height:1.2">0</div>
                <div style="font-size:11px;color:#666;margin-top:2px">완료 페이지</div>
              </div>
            </div>

            <!-- 게임별 상태 카드 -->
            <div id="crawlGameCards" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px"></div>

            <!-- 실시간 로그 -->
            <div id="crawlLiveLog" style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:11px;max-height:260px;overflow-y:auto;line-height:1.7;white-space:pre-wrap"></div>
          </div>

          <div id="crawlResult" style="display:none;background:#f0fff4;border:1px solid #9be6b0;border-radius:8px;padding:16px;margin-top:12px">
            <div id="crawlResultSummary" style="font-weight:700;font-size:15px;margin-bottom:8px"></div>
            <div id="crawlResultLog" style="font-size:12px;color:#555;max-height:200px;overflow-y:auto;line-height:1.6;font-family:monospace;white-space:pre-wrap"></div>
          </div>

          <!-- 자동 수집기 -->
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee">
            <b style="display:block;margin-bottom:4px;font-size:16px">🤖 자동 상품 수집기</b>
            <p style="font-size:13px;color:#555;margin-bottom:16px">
              PC에서 실행하면 <b>1시간마다 자동으로</b> 아이템마니아 상품을 가져와 DB에 쌓습니다.<br>
              창을 닫지 않고 켜두는 동안 계속 작동합니다.
            </p>

            <div style="background:#f0f7ff;border:1px solid #bee3f8;border-radius:10px;padding:20px;margin-bottom:16px">
              <div style="font-weight:700;margin-bottom:14px;font-size:14px;color:#1a56db">📋 사용 방법 (2단계)</div>

              <div style="display:flex;gap:12px;margin-bottom:16px;align-items:flex-start">
                <div style="background:#1a56db;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">1</div>
                <div>
                  <div style="font-weight:600;font-size:14px;margin-bottom:6px">스크립트 다운로드</div>
                  <button id="autoScriptDownloadBtn" onclick="downloadCrawlScript()"
                    style="padding:8px 18px;background:#1a56db;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer">
                    ⬇️ auto-crawl.mjs 다운로드
                  </button>
                  <div style="font-size:12px;color:#1a56db;margin-top:8px;font-weight:500">
                    ✅ 서버 주소·인증 키가 자동으로 입력됩니다. 수정 불필요!
                  </div>
                </div>
              </div>

              <div style="display:flex;gap:12px;align-items:flex-start">
                <div style="background:#1a56db;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">2</div>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:14px;margin-bottom:6px">터미널에서 실행 후 창 유지</div>
                  <div style="background:#1e1e1e;color:#d4d4d4;border-radius:7px;padding:12px;font-family:monospace;font-size:12px;line-height:2">
                    <span style="color:#6a9955"># 상시 자동 수집 (1시간마다, 전체 게임)</span><br>
                    node auto-crawl.mjs<br>
                    <br>
                    <span style="color:#6a9955"># 특정 게임만 대량 수집 후 종료 (예: 메이플랜드 50페이지)</span><br>
                    node auto-crawl.mjs --games 5990 --pages 50 --once
                  </div>
                  <div style="font-size:12px;color:#555;margin-top:8px">
                    ⚠️ Node.js 없으면 → <a href="https://nodejs.org" target="_blank" style="color:#1a56db">nodejs.org</a> 에서 LTS 버전 설치
                  </div>
                </div>
              </div>
            </div>

            <div style="background:#f6fff8;border:1px solid #9be6b0;border-radius:8px;padding:14px;font-size:13px;color:#276749">
              ✅ 상시 실행 시 1시간마다 11개 게임 × 5페이지씩 수집됩니다.<br>
              이미 있는 상품은 건너뛰고 새 상품만 추가되어 계속 쌓입니다.
            </div>
          </div>

          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee">
            <b style="display:block;margin-bottom:8px;color:#888;font-size:13px">💻 고급: 수동 크롤러 스크립트</b>
            <div style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;overflow-x:auto">
              <div style="color:#6a9955"># 1. 스크립트 다운로드</div>
              <div>curl -O <span id="crawlScriptUrl" style="color:#ce9178">/api/admin/crawl/script</span></div>
              <div style="margin-top:8px;color:#6a9955"># 2. 실행</div>
              <div>node crawl-itemmania.mjs --api-url <span id="crawlApiBaseUrl" style="color:#ce9178">https://your-app.replit.app</span> \</div>
              <div>&nbsp;&nbsp;--admin-email <span style="color:#9cdcfe">admin@example.com</span> --admin-pw <span style="color:#9cdcfe">yourpassword</span> \</div>
              <div>&nbsp;&nbsp;--games lostark,maplestory,dnf --pages 3</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- 마일리지 모달 -->
<div class="modal-overlay" id="balanceModal" onclick="if(event.target===this)closeBalanceModal()">
  <div class="modal" style="width:380px">
    <h2>💰 마일리지 수정</h2>
    <p id="balanceModalNick" style="font-size:14px;color:#555;margin-bottom:16px"></p>
    <label>현재 잔액</label>
    <div id="balanceCurrent" style="font-size:20px;font-weight:700;color:#159EFD;margin-bottom:4px">-</div>
    <label style="margin-top:16px">처리 방식</label>
    <select id="balanceMode" style="width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;outline:none;margin-bottom:0">
      <option value="add">추가 (현재 잔액에 더하기)</option>
      <option value="set">설정 (금액으로 직접 설정)</option>
    </select>
    <label>금액 (원)</label>
    <input type="number" id="balanceAmount" placeholder="예: 10000" min="0" style="width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;outline:none">
    <div class="modal-btns">
      <button class="cancel-btn" onclick="closeBalanceModal()">취소</button>
      <button class="save-btn" id="balanceSaveBtn" onclick="saveBalance()">저장</button>
    </div>
  </div>
</div>

<!-- 상품 등록/수정 모달 -->
<div class="modal-overlay" id="productModal" onclick="if(event.target===this)closeProductModal()">
  <div class="modal">
    <h2 id="modalTitle">상품 등록</h2>
    <input type="hidden" id="modalProductId">
    <label>유형 *</label>
    <select id="modalCategory">
      <option value="sell">팝니다 (판매)</option>
      <option value="buy">삽니다 (구매)</option>
    </select>
    <label>게임명</label>
    <input type="text" id="modalGameName" placeholder="예: 리니지클래식">
    <label>상품명 *</label>
    <input type="text" id="modalTitle2" placeholder="예: 리니지클래식 골드 1000개">
    <label>가격 (원) *</label>
    <input type="number" id="modalPrice" placeholder="예: 50000" min="1">
    <label>판매자 닉네임</label>
    <input type="text" id="modalSellerName" placeholder="예: 판매왕">
    <label>설명</label>
    <textarea id="modalDescription" placeholder="상품 상세 설명을 입력하세요"></textarea>
    <label>상태</label>
    <select id="modalStatus">
      <option value="active">판매중</option>
      <option value="sold">판매완료</option>
      <option value="inactive">비활성</option>
    </select>
    <div class="modal-btns">
      <button class="cancel-btn" onclick="closeProductModal()">취소</button>
      <button class="save-btn" id="modalSaveBtn" onclick="saveProduct()">등록</button>
    </div>
  </div>
</div>

<!-- 회원 정보 수정 모달 -->
<div class="modal-overlay" id="userEditModal" onclick="if(event.target===this)closeUserEditModal()">
  <div class="modal" style="width:460px">
    <h2>✏️ 회원 정보 수정</h2>
    <input type="hidden" id="userEditId">
    <label>이메일</label>
    <input type="email" id="userEditEmail" placeholder="예: user@example.com">
    <label>닉네임</label>
    <input type="text" id="userEditNickname" placeholder="닉네임">
    <label>이름 (실명)</label>
    <input type="text" id="userEditName" placeholder="홍길동">
    <label>전화번호</label>
    <input type="tel" id="userEditPhone" placeholder="예: 010-1234-5678">
    <label>신용점수</label>
    <input type="number" id="userEditScore" min="0" max="9999" placeholder="0" style="width:100%;box-sizing:border-box">
    <label>신용등급</label>
    <select id="userEditGrade">
      <option value="">없음</option>
      <option value="bronze">BRONZE (5점 미만)</option>
      <option value="silver">SILVER (5~100점)</option>
      <option value="gold">GOLD (51~100점)</option>
      <option value="platinum">PLATINUM (101~300점)</option>
      <option value="vip">VIP (301점+)</option>
    </select>
    <div id="userEditErr" style="margin-top:10px;font-size:13px;color:#e53e3e;min-height:18px"></div>
    <div class="modal-btns">
      <button class="cancel-btn" onclick="closeUserEditModal()">취소</button>
      <button class="save-btn" id="userEditSaveBtn" onclick="saveUserEdit()">저장</button>
    </div>
  </div>
</div>

<!-- 인증상태 모달 -->
<div class="modal-overlay" id="authModal" onclick="if(event.target===this)closeAuthModal()">
  <div class="modal">
    <h2>인증상태 관리 — <span id="authModalNick" style="color:#159EFD"></span></h2>
    <p style="font-size:13px;color:#888;margin-top:-12px;margin-bottom:16px">체크 = 인증 완료 (배지 활성), 미체크 = 미인증 (배지 회색)</p>
    <div class="auth-grid">
      <label class="auth-item"><input type="checkbox" id="authExcellent"> 🏅 우수인증</label>
      <label class="auth-item"><input type="checkbox" id="authPhone"> 📱 휴대폰</label>
      <label class="auth-item"><input type="checkbox" id="authEmail"> 📧 이메일</label>
      <label class="auth-item"><input type="checkbox" id="authIpin"> 🪪 아이핀</label>
      <label class="auth-item"><input type="checkbox" id="authWithdraw"> 🏦 출금계좌</label>
    </div>
    <div class="modal-btns">
      <button class="cancel-btn" onclick="closeAuthModal()">취소</button>
      <button class="save-btn" id="authSaveBtn" onclick="saveAuthStates()">저장</button>
    </div>
  </div>
</div>

<div id="toast"></div>

<!-- 실시간 알림 토스트 레이어 -->
<div id="admin_notice_layer" style="position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none"></div>

<style>
@keyframes _adm_slide_down{
  0%{transform:translateY(-30px);opacity:0}
  12%,85%{transform:translateY(0);opacity:1}
  100%{transform:translateY(-20px);opacity:0;visibility:hidden}
}
.adm-toast{background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.18);padding:13px 18px;min-width:260px;max-width:320px;border-left:3px solid #159EFD;pointer-events:auto;cursor:pointer;font-family:inherit;animation:_adm_slide_down 5s ease forwards}
.adm-toast-title{font-size:13px;font-weight:700;color:#222;margin-bottom:3px}
.adm-toast-body{font-size:12px;color:#666;line-height:1.4}
</style>

<script>
/* ── 어드민 음성·SSE ── */
var _adminVoiceOn = sessionStorage.getItem('adminVoice') !== 'off'; /* 기본값 ON */
var _adminSpeakQueue = [];
var _adminAudioCtx = null;
var _adminSeenIds = new Set();

/* 첫 번째 클릭/터치로 AudioContext 잠금 자동 해제 (브라우저 정책 대응) */
function _adminUnlockAudio() {
  try {
    if (!_adminAudioCtx) _adminAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_adminAudioCtx.state === 'suspended') {
      _adminAudioCtx.resume().then(_updateSoundEnableBtn).catch(function(){});
    }
    _updateSoundEnableBtn();
  } catch(e) {}
}
function _updateSoundEnableBtn() {
  var btn = document.getElementById('adminSoundEnableBtn');
  if (btn) btn.style.display = _adminAudioCtx && _adminAudioCtx.state === 'running' ? 'none' : '';
}
document.addEventListener('click', _adminUnlockAudio, { once: true, capture: true });
document.addEventListener('touchstart', _adminUnlockAudio, { once: true, capture: true });

/* AudioContext 비프음 — TTS 미지원 환경에서도 반드시 소리 남 */
function _adminBeep(freq, dur) {
  try {
    if (!_adminAudioCtx) _adminAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var ctx = _adminAudioCtx;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = freq || 880;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.3));
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + (dur || 0.3));
  } catch(e) {}
}

/* 한국어 TTS — voices 로딩 완료 후 최적 voice 선택 */
function _adminTTS(text) {
  if (!window.speechSynthesis) return;
  var synth = window.speechSynthesis;
  synth.cancel();
  function _speak() {
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1.0; u.volume = 1.0;
    var voices = synth.getVoices();
    var koVoice = voices.find(function(v){ return v.lang && v.lang.startsWith('ko'); });
    if (koVoice) u.voice = koVoice;
    synth.speak(u);
  }
  var voices = synth.getVoices();
  if (voices.length) { _speak(); }
  else { synth.onvoiceschanged = function(){ synth.onvoiceschanged = null; _speak(); }; }
}

function _updateVoiceBtn() {
  var btn = document.getElementById('voiceToggleBtn');
  if (!btn) return;
  if (_adminVoiceOn) {
    btn.textContent = '🔔 음성 ON';
    btn.className = 'voice-btn on';
  } else {
    btn.textContent = '🔇 음성 OFF';
    btn.className = 'voice-btn';
  }
}

function adminSpeakTest() {
  /* 테스트 버튼 — AudioContext 잠금 해제 + TTS + 비프 동시 확인 */
  try { if (!_adminAudioCtx) _adminAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (_adminAudioCtx.state === 'suspended') _adminAudioCtx.resume(); } catch(e) {}
  _adminBeep(880, 0.15);
  setTimeout(function(){ _adminBeep(1100, 0.15); }, 160);
  _adminTTS('테스트 알림입니다');
}

function toggleAdminVoice() {
  _adminVoiceOn = !_adminVoiceOn;
  sessionStorage.setItem('adminVoice', _adminVoiceOn ? 'on' : 'off');
  _updateVoiceBtn();
  if (_adminVoiceOn) {
    /* 첫 클릭으로 AudioContext + TTS 잠금 동시 해제 */
    try { if (!_adminAudioCtx) _adminAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (_adminAudioCtx.state === 'suspended') _adminAudioCtx.resume(); } catch(e) {}
    _adminBeep(880, 0.12);
    setTimeout(function(){ _adminBeep(1100, 0.12); }, 130);
    _adminTTS('음성 알림이 켜졌습니다');
    /* 큐에 쌓인 알림 재생 */
    if (_adminSpeakQueue.length) {
      setTimeout(function(){
        var txt = _adminSpeakQueue.pop();
        _adminSpeakQueue = [];
        if (txt) { _adminBeep(880, 0.15); _adminTTS(txt); }
      }, 1500);
    }
  }
}

function adminSpeak(text) {
  if (!text) return;
  if (!_adminVoiceOn) { _adminSpeakQueue = [text]; return; }
  _adminBeep(880, 0.15);
  setTimeout(function(){ _adminTTS(text); }, 100);
}

function showAdminToast(title, body) {
  var layer = document.getElementById('admin_notice_layer');
  if (!layer) return;
  var el = document.createElement('div');
  el.className = 'adm-toast';
  el.innerHTML = '<div class="adm-toast-title">' + (title||'') + '</div>' +
                 (body ? '<div class="adm-toast-body">' + body + '</div>' : '');
  el.onclick = function(){ if(el.parentNode) el.parentNode.removeChild(el); };
  layer.appendChild(el);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 5200);
}

function _adminHandleNotification(d) {
  if (d.id != null) {
    if (_adminSeenIds.has(d.id)) return;
    _adminSeenIds.add(d.id);
    if (_adminSeenIds.size > 100) _adminSeenIds.delete(_adminSeenIds.values().next().value);
  }
  showAdminToast(d.title, d.body);
  _adminBeep(880, 0.18);
  setTimeout(function(){ _adminBeep(1100, 0.18); }, 200);
  if (_adminVoiceOn) setTimeout(function(){ _adminTTS(d.title); }, 350);
  if (typeof window._adminBrowserNotif === 'function') window._adminBrowserNotif(d.title, d.body);
}
window._adminHandleNotification = _adminHandleNotification;

(function(){
  /* 버튼 초기 상태 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ _updateVoiceBtn(); _updateSoundEnableBtn(); });
  } else {
    _updateVoiceBtn();
    _updateSoundEnableBtn();
  }

  if (typeof EventSource === 'undefined') return;
  var _sseActive = false;

  /* OS 레벨 브라우저 알림 — 탭이 백그라운드여도 울림 */
  function _adminBrowserNotif(title, body) {
    if (!('Notification' in window)) return;
    function _send() {
      try {
        new Notification('\uD83D\uDD14 ' + (title || '\uC5B4\uB4DC\uBBFC \uC54C\uB9BC'), {
          body: body || '',
          icon: '/favicon.ico',
          tag: 'admin-' + Date.now()
        });
      } catch(e) {}
    }
    if (Notification.permission === 'granted') { _send(); }
    else if (Notification.permission !== 'denied') {
      Promise.resolve(Notification.requestPermission()).then(function(p) {
        if (p === 'granted') _send();
      });
    }
  }

  function connectSSE() {
    if (_sseActive) return;
    _sseActive = true;
    /* SSE 연결 시 알림 권한 미리 요청 */
    if ('Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch(e) {}
    }
    /* AudioContext 미리 잠금 해제 (connectSSE는 반드시 사용자 제스처 후 호출) */
    try {
      if (!_adminAudioCtx) _adminAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (_adminAudioCtx.state === 'suspended') _adminAudioCtx.resume();
    } catch(e) {}

    var es = new EventSource('/api/admin/events');
    es.addEventListener('notification', function(e){
      try {
        _adminHandleNotification(JSON.parse(e.data));
      } catch(ex){}
    });
    es.addEventListener('error', function(){
      es.close();
      _sseActive = false;
      setTimeout(connectSSE, 5000);
    });
  }
  window._adminConnectSSE = connectSSE;
  window._adminBrowserNotif = _adminBrowserNotif;
  /* connectSSE는 checkSession() 또는 doLogin() 성공 시에만 호출 */
})();
</script>

<!--ADMIN_SCRIPT-->
</body>
</html>`;

// 이전 관리자 화면 경로는 새 주소를 노출하지 않고 종료한다.
router.all(["/admin", "/admin/", "/admin-login", "/tkfwkwpqkf", "/tkfwkwpqkf/"], (_req, res): void => {
  res.sendStatus(404);
});

router.get(["/banana777", "/banana777/"], (req, res): void => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");

  // 세션 인증 체크 — 미인증이면 로그인 페이지 직접 서빙 (JS redirect 없이)
  const hasAdminSession = !!req.session?.adminId && req.session.adminRole === "admin";
  const hasUserAdminSession = !!req.session?.userId && req.session.userRole === "admin";
  if (!hasAdminSession && !hasUserAdminSession) {
    const loginError = typeof req.query.loginerror === "string" ? req.query.loginerror : undefined;
    res.send(ADMIN_LOGIN_PAGE(loginError));
    return;
  }

  const keyScript = `<script>window._CK=${JSON.stringify(CRAWL_KEY)};</script>`;
  const html = ADMIN_HTML.replace("<!--ADMIN_SCRIPT-->", keyScript + "\n<script>\n" + loadAdminScript() + "\n</script>");
  res.send(html);
});

const ADMIN_LOGIN_PAGE = (error?: string) => `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>어드민 로그인</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f4f6fb;display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{background:#fff;border-radius:16px;padding:48px 40px;width:360px;box-shadow:0 4px 32px rgba(0,0,0,.10)}
h1{font-size:22px;font-weight:700;margin-bottom:8px}
p{font-size:13px;color:#888;margin-bottom:28px}
input{display:block;width:100%;padding:12px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;margin-bottom:12px;outline:none}
input:focus{border-color:#159EFD}
button{width:100%;padding:13px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer}
button:hover{background:#0e8de0}
.err{color:#e53e3e;font-size:13px;margin-top:10px;padding:10px;background:#fff5f5;border-radius:6px}
</style>
</head>
<body>
<div class="box">
  <h1>어드민 로그인</h1>
  <p>관리자 계정으로 로그인하세요</p>
  <form method="POST" action="/banana777">
    <input type="text" name="email" placeholder="아이디 (admin)" autocomplete="username" required>
    <input type="password" name="password" placeholder="비밀번호" autocomplete="current-password" required>
    <button type="submit">로그인</button>
    ${error ? `<div class="err">${error}</div>` : ""}
  </form>
</div>
</body>
</html>`;

router.post(["/banana777", "/banana777/"], express.urlencoded({ extended: false }), async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.redirect("/banana777?loginerror=" + encodeURIComponent("아이디와 비밀번호를 입력하세요."));
    return;
  }
  try {
    const { db, usersTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const bcrypt = await import("bcryptjs");
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim()));
    if (!user || !(await bcrypt.compare(password, user.passwordHash)) || user.role !== "admin") {
      res.redirect("/banana777?loginerror=" + encodeURIComponent("아이디 또는 비밀번호가 올바르지 않습니다."));
      return;
    }
    // 어드민 전용 세션(admin.sid)에만 기록 — 회원 세션(connect.sid)과 완전 분리됨
    req.session.adminId = user.id;
    req.session.adminRole = user.role;
    await new Promise<void>((resolve, reject) => req.session.save((err) => err ? reject(err) : resolve()));
    res.redirect("/banana777");
  } catch {
    res.redirect("/banana777?loginerror=" + encodeURIComponent("서버 오류가 발생했습니다."));
  }
});

export default router;
