import express, { Router, type IRouter } from "express";
import { ADMIN_SCRIPT_CONTENT } from "../admin-script-content";

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
#admin-screen{display:block;min-height:100vh}
.topbar{background:#fff;border-bottom:1px solid #e8ecf0;padding:0 32px;display:flex;align-items:center;gap:16px;height:60px;position:sticky;top:0;z-index:100}
.topbar .logo{font-size:18px;font-weight:800;color:#159EFD;letter-spacing:-.03em}
.topbar .logo span{color:#222}
.topbar .admin-badge{font-size:12px;font-weight:600;background:#edf8ff;color:#0e8de0;padding:3px 10px;border-radius:20px}
.topbar .spacer{flex:1}
.topbar .logout-btn{font-size:13px;color:#888;background:none;border:none;cursor:pointer;padding:6px 12px;border-radius:6px}
.topbar .logout-btn:hover{background:#f0f0f0}
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
    <input type="text" id="loginEmail" placeholder="이메일 또는 아이디" autocomplete="username">
    <input type="password" id="loginPw" placeholder="비밀번호" autocomplete="current-password">
    <button onclick="doLogin()">로그인</button>
    <div class="err" id="loginErr"></div>
  </div>
</div>

<div id="admin-screen">
  <div class="topbar">
    <div class="logo">아이템매니아<span>어드민</span></div>
    <div class="admin-badge" id="adminNickname"></div>
    <div class="spacer"></div>
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
            <option value="">전체 상태</option>
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
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">회원 목록</span>
          <div class="spacer"></div>
          <button class="refresh-btn" onclick="loadUsers()">↻ 새로고침</button>
        </div>
        <table>
          <thead><tr><th>ID</th><th>이메일</th><th>닉네임</th><th>전화번호</th><th>등급</th><th>잔액</th><th>가입일</th><th>인증</th><th>관리</th></tr></thead>
          <tbody id="usersBody"><tr class="empty-row"><td colspan="9">로딩 중...</td></tr></tbody>
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
          <thead><tr><th>ID</th><th>판매자</th><th>구매자</th><th>상품명</th><th>거래금액</th><th>상태</th><th>생성일</th></tr></thead>
          <tbody id="chatroomsBody"><tr class="empty-row"><td colspan="7">탭을 클릭하면 로드됩니다</td></tr></tbody>
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

          <!-- ScraperAPI 방식 (접기) -->
          <details style="margin-bottom:20px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
            <summary style="padding:12px 16px;background:#f8f9fa;cursor:pointer;font-size:13px;font-weight:600;color:#666">⚙️ ScraperAPI 방식 (고급 — 상세 수집용)</summary>
            <div style="padding:16px">
              <p style="font-size:13px;color:#555;margin:0 0 12px">상세 설명·판매자명까지 수집하려면 ScraperAPI 키가 필요합니다.<br>
              <a href="https://www.scraperapi.com/" target="_blank" style="color:#159EFD">scraperapi.com</a> 무료 계정 → 5,000회/월 무료</p>
              <div style="display:flex;gap:8px;margin-bottom:8px">
                <input type="password" id="crawlApiKeyInput" placeholder="ScraperAPI 키 입력" style="flex:1;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;outline:none">
                <button onclick="testApiKey()" style="padding:10px 16px;background:#6c757d;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px">테스트</button>
              </div>
              <div id="crawlApiKeyStatus" style="font-size:12px;color:#888"></div>
              <div style="margin-top:12px;padding:10px 14px;background:#f0f7ff;border:1.5px solid #b3d8ff;border-radius:8px">
                <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
                  <input type="checkbox" id="crawlDetailCheck" style="width:16px;height:16px;margin-top:2px;accent-color:#159EFD;flex-shrink:0">
                  <span style="font-size:13px;color:#333">
                    <b style="color:#159EFD">상세 페이지 크롤 포함</b>
                    <span id="crawlDetailCost" style="display:block;color:#e57c00;margin-top:3px;font-size:12px"></span>
                  </span>
                </label>
              </div>
              <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
                <button id="crawlBtn" onclick="startCrawl()" style="padding:10px 20px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🕷️ ScraperAPI로 수집</button>
                <button id="discoverBtn" onclick="discoverApi()" style="padding:10px 16px;background:#6c757d;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">🔍 API 자동 탐지</button>
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
              <div style="font-weight:700;margin-bottom:14px;font-size:14px;color:#1a56db">📋 사용 방법 (3단계)</div>

              <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">
                <div style="background:#1a56db;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">1</div>
                <div>
                  <div style="font-weight:600;font-size:14px;margin-bottom:4px">스크립트 다운로드</div>
                  <a id="autoScriptDownloadBtn" href="/api/admin/crawl-script" download="auto-crawl.mjs"
                    style="display:inline-block;padding:8px 18px;background:#1a56db;color:#fff;border-radius:7px;font-size:13px;font-weight:600;text-decoration:none">
                    ⬇️ auto-crawl.mjs 다운로드
                  </a>
                </div>
              </div>

              <div style="display:flex;gap:12px;margin-bottom:12px;align-items:flex-start">
                <div style="background:#1a56db;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">2</div>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:14px;margin-bottom:4px">파일 열어서 3줄 수정</div>
                  <div style="background:#1e1e1e;color:#d4d4d4;border-radius:7px;padding:12px;font-family:monospace;font-size:12px;line-height:1.8">
                    <span style="color:#6a9955">// ★ 여기만 수정하세요 ★</span><br>
                    <span style="color:#9cdcfe">const</span> API_URL &nbsp;&nbsp;&nbsp;&nbsp; = <span style="color:#ce9178" id="autoScriptApiUrl">'https://itenmania.com'</span>;<br>
                    <span style="color:#9cdcfe">const</span> ADMIN_EMAIL = <span style="color:#ce9178">'<b style="color:#ff9999">내 이메일</b>'</span>;<br>
                    <span style="color:#9cdcfe">const</span> ADMIN_PW &nbsp;&nbsp; = <span style="color:#ce9178">'<b style="color:#ff9999">내 비밀번호</b>'</span>;
                  </div>
                </div>
              </div>

              <div style="display:flex;gap:12px;align-items:flex-start">
                <div style="background:#1a56db;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">3</div>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:14px;margin-bottom:4px">터미널에서 실행 후 창 유지</div>
                  <div style="background:#1e1e1e;color:#d4d4d4;border-radius:7px;padding:12px;font-family:monospace;font-size:13px">
                    node auto-crawl.mjs
                  </div>
                  <div style="font-size:12px;color:#555;margin-top:6px">
                    ⚠️ Node.js 없으면 → <a href="https://nodejs.org" target="_blank" style="color:#1a56db">nodejs.org</a> 에서 LTS 버전 설치
                  </div>
                </div>
              </div>
            </div>

            <div style="background:#f6fff8;border:1px solid #9be6b0;border-radius:8px;padding:14px;font-size:13px;color:#276749">
              ✅ 실행하면 1시간마다 자동으로 10개 게임 × 3페이지 = <b>약 1,500개</b>씩 수집됩니다.<br>
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
(function(){
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

  if (typeof EventSource === 'undefined') return;
  function adminSpeak(text) {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = 1.0; u.volume = 1.0;
    window.speechSynthesis.speak(u);
  }
  function connectSSE() {
    var es = new EventSource('/api/events');
    es.addEventListener('notification', function(e){
      try {
        var d = JSON.parse(e.data);
        showAdminToast(d.title, d.body);
        adminSpeak(d.title);
      } catch(ex){}
    });
    es.addEventListener('error', function(){
      es.close();
      setTimeout(connectSSE, 5000);
    });
  }
  connectSSE();
})();
</script>

<!--ADMIN_SCRIPT-->
</body>
</html>`;

router.get(["/tkfwkwpqkf", "/tkfwkwpqkf/"], (_req, res): void => {
  const html = ADMIN_HTML.replace("<!--ADMIN_SCRIPT-->", "<script>\n" + loadAdminScript() + "\n</script>");
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
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
  <form method="POST" action="/admin-login">
    <input type="text" name="email" placeholder="아이디 (admin)" autocomplete="username" required>
    <input type="password" name="password" placeholder="비밀번호" autocomplete="current-password" required>
    <button type="submit">로그인</button>
    ${error ? `<div class="err">${error}</div>` : ""}
  </form>
</div>
</body>
</html>`;

router.get("/admin-login", (_req, res): void => {
  res.set("Cache-Control", "no-store");
  res.send(ADMIN_LOGIN_PAGE());
});

router.post("/admin-login", express.urlencoded({ extended: false }), async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.send(ADMIN_LOGIN_PAGE("아이디와 비밀번호를 입력하세요."));
    return;
  }
  try {
    const { db, usersTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const bcrypt = await import("bcryptjs");
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim()));
    if (!user || !(await bcrypt.compare(password, user.passwordHash)) || user.role !== "admin") {
      res.send(ADMIN_LOGIN_PAGE("아이디 또는 비밀번호가 올바르지 않습니다."));
      return;
    }
    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.adminId = user.id;
    req.session.adminRole = user.role;
    await new Promise<void>((resolve) => req.session.save(() => resolve()));
    res.redirect("/admin");
  } catch {
    res.send(ADMIN_LOGIN_PAGE("서버 오류가 발생했습니다."));
  }
});

export default router;
