import express, { Router, type IRouter } from "express";

const router: IRouter = Router();

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>아이템매니아 어드민</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f4f6fb;color:#222;min-height:100vh}
#login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh}
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
    </div>

    <!-- 상품 탭 -->
    <div class="tab-panel active" id="tab-products">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">상품 목록</span>
          <select class="filter-select" id="prodCategoryFilter" onchange="loadProducts()">
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

    <!-- 크롤링 탭 -->
    <div class="tab-panel" id="tab-crawl">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">itemmania.com 상품 크롤링</span>
        </div>
        <div style="padding:24px">
          <div id="crawlApiKeySection" style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px;margin-bottom:20px">
            <b>⚠️ ScraperAPI 키 필요</b>
            <p style="font-size:13px;color:#555;margin:8px 0">itemmania.com이 Replit 서버 IP를 차단하고 있어 ScraperAPI 경유가 필요합니다.<br>
            <a href="https://www.scraperapi.com/" target="_blank" style="color:#159EFD">scraperapi.com</a>에서 무료 계정 생성 → API 키 발급 (무료 5,000회/월)</p>
            <div style="display:flex;gap:8px;margin-top:12px">
              <input type="password" id="crawlApiKeyInput" placeholder="ScraperAPI 키 입력 (또는 환경변수 SCRAPER_API_KEY 설정)" style="flex:1;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;outline:none">
              <button onclick="testApiKey()" style="padding:10px 16px;background:#6c757d;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px">테스트</button>
            </div>
            <div id="crawlApiKeyStatus" style="font-size:12px;margin-top:6px;color:#888"></div>
          </div>

          <div style="margin-bottom:20px">
            <b style="display:block;margin-bottom:10px">크롤링 대상 게임</b>
            <div id="crawlGameList" style="display:flex;flex-wrap:wrap;gap:8px"></div>
          </div>

          <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap">
            <label style="font-size:14px;font-weight:600">페이지 수:
              <select id="crawlPages" style="margin-left:8px;padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;outline:none">
                <option value="1">1페이지 (약 20개/게임)</option>
                <option value="2">2페이지 (약 40개/게임)</option>
                <option value="3">3페이지 (약 60개/게임)</option>
                <option value="5">5페이지 (약 100개/게임)</option>
              </select>
            </label>
          </div>
          <div style="margin-bottom:16px;padding:12px 16px;background:#f0f7ff;border:1.5px solid #b3d8ff;border-radius:8px">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
              <input type="checkbox" id="crawlDetailCheck" style="width:16px;height:16px;margin-top:2px;accent-color:#159EFD;flex-shrink:0">
              <span style="font-size:13px;color:#333">
                <b style="color:#159EFD">상세 페이지 크롤 포함</b>
                <span style="display:block;color:#666;margin-top:3px">판매자명·상세설명을 함께 수집합니다. ScraperAPI 크레딧이 상품 1개당 1회 추가 소모됩니다.</span>
                <span id="crawlDetailCost" style="display:block;color:#e57c00;margin-top:3px;font-size:12px"></span>
              </span>
            </label>
          </div>
          <div style="margin-bottom:20px;display:flex;gap:10px;flex-wrap:wrap">
            <button id="crawlBtn" onclick="startCrawl()" style="padding:12px 24px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer">🕷️ 크롤링 시작</button>
            <button id="discoverBtn" onclick="discoverApi()" style="padding:12px 20px;background:#6c757d;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer" title="itemmania.com JS를 자동 분석해 AJAX API URL을 탐지합니다">🔍 API 자동 탐지</button>
          </div>
          <div id="discoverResult" style="display:none;background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;max-height:400px;overflow-y:auto;margin-bottom:16px;white-space:pre-wrap"></div>

          <div id="crawlStatus" style="display:none">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div id="crawlSpinner" style="width:20px;height:20px;border:3px solid #e0e0e0;border-top-color:#159EFD;border-radius:50%;animation:spin 0.8s linear infinite"></div>
              <span id="crawlStatusText" style="font-size:14px;color:#333">크롤링 중...</span>
            </div>
            <div id="crawlLiveLog" style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:12px;max-height:320px;overflow-y:auto;line-height:1.8;white-space:pre-wrap"></div>
          </div>

          <div id="crawlResult" style="display:none;background:#f8f9fa;border-radius:8px;padding:16px;margin-top:12px">
            <div id="crawlResultSummary" style="font-weight:700;margin-bottom:10px"></div>
            <div id="crawlResultLog" style="font-size:12px;color:#555;max-height:200px;overflow-y:auto;line-height:1.6;font-family:monospace;white-space:pre-wrap"></div>
          </div>

          <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee">
            <b style="display:block;margin-bottom:8px">💻 로컬 크롤러 (ScraperAPI 없이 무료 사용)</b>
            <p style="font-size:13px;color:#555;margin-bottom:12px">
              자신의 PC에서 아래 스크립트를 실행하면 itemmania.com에서 직접 크롤링하여 이 서버 DB에 저장합니다.
            </p>
            <div style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:16px;font-family:monospace;font-size:13px;overflow-x:auto">
              <div style="color:#6a9955"># 1. 스크립트 다운로드 (Node.js 18+ 필요)</div>
              <div>curl -O <span id="crawlScriptUrl" style="color:#ce9178">/api/admin/crawl/script</span></div>
              <div style="margin-top:8px;color:#6a9955"># 2. 기본 실행 (목록만)</div>
              <div>node crawl-itemmania.mjs \</div>
              <div>&nbsp;&nbsp;--api-url <span id="crawlApiBaseUrl" style="color:#ce9178">https://your-app.replit.app</span> \</div>
              <div>&nbsp;&nbsp;--admin-email <span style="color:#9cdcfe">admin@example.com</span> \</div>
              <div>&nbsp;&nbsp;--admin-pw <span style="color:#9cdcfe">yourpassword</span> \</div>
              <div>&nbsp;&nbsp;--games lostark,maplestory,dnf --pages 3</div>
              <div style="margin-top:8px;color:#6a9955"># 3. 상세 포함 (판매자명·설명·이미지까지)</div>
              <div>node crawl-itemmania.mjs --api-url <span class="crawlApiBaseUrlRef" style="color:#ce9178">https://your-app.replit.app</span> \</div>
              <div>&nbsp;&nbsp;--admin-email <span style="color:#9cdcfe">admin@example.com</span> --admin-pw <span style="color:#9cdcfe">yourpassword</span> \</div>
              <div>&nbsp;&nbsp;--games all --pages 3 --with-detail</div>
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

<script>
var currentTab='products';

async function doLogin(){
  var email=document.getElementById('loginEmail').value.trim();
  var pw=document.getElementById('loginPw').value;
  var errEl=document.getElementById('loginErr');
  errEl.style.display='none';
  if(!email||!pw){errEl.textContent='이메일과 비밀번호를 입력하세요.';errEl.style.display='block';return;}
  try{
    var r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email,password:pw})});
    var d=await r.json();
    if(!r.ok){errEl.textContent=d.error||'로그인 실패';errEl.style.display='block';return;}
    if(d.role!=='admin'){errEl.textContent='관리자 계정이 아닙니다.';errEl.style.display='block';return;}
    showAdmin(d);
  }catch(e){errEl.textContent='서버 연결 오류';errEl.style.display='block';}
}
document.getElementById('loginPw').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});

async function checkSession(){
  try{
    var r=await fetch('/api/auth/me',{credentials:'include'});
    if(!r.ok)return;
    var d=await r.json();
    if(d.role==='admin')showAdmin(d);
  }catch(e){}
}

function showAdmin(user){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('admin-screen').style.display='block';
  document.getElementById('adminNickname').textContent=(user.nickname||user.email)+' (관리자)';
  loadAll();
}

async function doLogout(){
  await fetch('/api/admin/logout',{method:'POST',credentials:'include'});
  location.reload();
}

function switchTab(tab){
  currentTab=tab;
  var tabs=['products','users','orders','withdrawals','crawl'];
  document.querySelectorAll('.tab-btn').forEach(function(b,i){b.classList.toggle('active',tabs[i]===tab);});
  document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active');});
  document.getElementById('tab-'+tab).classList.add('active');
  if(tab==='crawl')initCrawlTab();
}

var crawlGamesData=[];
var crawlSelectedGames=new Set();

async function initCrawlTab(){
  if(crawlGamesData.length>0)return;
  try{
    var r=await fetch('/api/admin/crawl/games',{credentials:'include'});
    var d=await r.json();
    crawlGamesData=d.games||[];
    var hasKey=d.hasApiKey;
    if(hasKey){
      document.getElementById('crawlApiKeySection').style.background='#d4edda';
      document.getElementById('crawlApiKeySection').style.borderColor='#28a745';
      document.getElementById('crawlApiKeyStatus').textContent='✅ 환경변수 SCRAPER_API_KEY 설정됨';
      document.getElementById('crawlApiKeyStatus').style.color='#155724';
    }
    var container=document.getElementById('crawlGameList');
    container.innerHTML='';
    crawlGamesData.forEach(function(g){
      crawlSelectedGames.add(g.id);
      var btn=document.createElement('button');
      btn.textContent=g.name;
      btn.dataset.id=g.id;
      btn.style.cssText='padding:8px 14px;border:2px solid #159EFD;border-radius:20px;background:#e8f4fe;color:#0d6efd;font-size:13px;cursor:pointer;font-weight:600';
      btn.onclick=function(){
        if(crawlSelectedGames.has(g.id)){
          crawlSelectedGames.delete(g.id);
          btn.style.background='#f8f9fa';btn.style.color='#666';btn.style.borderColor='#ddd';
        }else{
          crawlSelectedGames.add(g.id);
          btn.style.background='#e8f4fe';btn.style.color='#0d6efd';btn.style.borderColor='#159EFD';
        }
        updateCrawlCostEstimate();
      };
      container.appendChild(btn);
    });
    document.getElementById('crawlPages').onchange=updateCrawlCostEstimate;
    document.getElementById('crawlDetailCheck').onchange=updateCrawlCostEstimate;
    var origin=location.origin;
    document.getElementById('crawlScriptUrl').textContent=origin+'/api/admin/crawl/script';
    document.getElementById('crawlApiBaseUrl').textContent=origin;
  }catch(e){console.error(e);}
}

async function discoverApi(){
  var key=document.getElementById('crawlApiKeyInput').value.trim();
  var btn=document.getElementById('discoverBtn');
  var resultEl=document.getElementById('discoverResult');
  btn.disabled=true;btn.textContent='🔍 탐지 중... (30~60초)';
  resultEl.style.display='block';resultEl.textContent='itemmania.com JS 파일 분석 중...\n';
  try{
    var r=await fetch('/api/admin/crawl/discover?scraperApiKey='+encodeURIComponent(key)+'&gameId=138',{credentials:'include'});
    var d=await r.json();
    if(!r.ok){resultEl.textContent='❌ 오류: '+(d.error||'실패');return;}
    var out='=== HTML 분석 결과 ===\n';
    out+='HTML 크기: '+d.htmlSize+'바이트\n';
    out+='list_item 수: '+d.listItemCount+', data-tid 수: '+d.dataTidCount+', __NEXT_DATA__: '+d.hasNextData+'\n\n';
    if(d.scriptSrcs&&d.scriptSrcs.length){
      out+='=== 발견된 JS 파일 ===\n'+d.scriptSrcs.join('\n')+'\n\n';
    }else{
      out+='=== JS 파일 없음 ===\n\n';
    }
    if(d.ajaxInHtml&&d.ajaxInHtml.length){
      out+='=== HTML 내 URL 패턴 ===\n'+d.ajaxInHtml.join('\n')+'\n\n';
    }
    if(d.jsFindings&&d.jsFindings.length){
      d.jsFindings.forEach(function(f){
        out+='=== JS 파일: '+f.url+' ===\n'+f.patterns.join('\n')+'\n\n';
      });
    }else{
      out+='=== JS 파일에서 API 패턴 없음 ===\n';
    }
    resultEl.textContent=out;
  }catch(e){resultEl.textContent='❌ 서버 오류: '+e.message;}
  finally{btn.disabled=false;btn.textContent='🔍 API 자동 탐지';}
}

async function testApiKey(){
  var key=document.getElementById('crawlApiKeyInput').value.trim();
  if(!key){document.getElementById('crawlApiKeyStatus').textContent='키를 입력하세요.';return;}
  document.getElementById('crawlApiKeyStatus').textContent='테스트 중...';
  try{
    var r=await fetch('https://api.scraperapi.com/account?api_key='+encodeURIComponent(key));
    var d=await r.json();
    if(d.requestCount!==undefined){
      document.getElementById('crawlApiKeyStatus').textContent='✅ 유효한 키 (사용: '+d.requestCount+'/'+d.requestLimit+')';
      document.getElementById('crawlApiKeyStatus').style.color='#155724';
    }else{
      document.getElementById('crawlApiKeyStatus').textContent='❌ 유효하지 않은 키';
      document.getElementById('crawlApiKeyStatus').style.color='#721c24';
    }
  }catch(e){
    document.getElementById('crawlApiKeyStatus').textContent='테스트 실패: '+e.message;
    document.getElementById('crawlApiKeyStatus').style.color='#721c24';
  }
}

function updateCrawlCostEstimate(){
  var selectedIds=Array.from(crawlSelectedGames);
  var pages=parseInt((document.getElementById('crawlPages')||{value:'1'}).value)||1;
  var withDetail=document.getElementById('crawlDetailCheck')&&document.getElementById('crawlDetailCheck').checked;
  var estProducts=selectedIds.length*pages*55;
  var listCredits=selectedIds.length*pages;
  var totalCredits=withDetail?listCredits+estProducts:listCredits;
  var costEl=document.getElementById('crawlDetailCost');
  if(costEl){
    if(withDetail){
      costEl.textContent='예상 크레딧 소모: 목록 '+listCredits+'회 + 상세 ~'+estProducts+'회 = 총 ~'+totalCredits+'회 ('+selectedIds.length+'게임×'+pages+'페이지×약55개)';
    }else{
      costEl.textContent='';
    }
  }
}

async function startCrawl(){
  var selectedIds=Array.from(crawlSelectedGames);
  if(selectedIds.length===0){showToast('게임을 선택하세요.');return;}
  var pages=parseInt(document.getElementById('crawlPages').value)||1;
  var apiKey=document.getElementById('crawlApiKeyInput').value.trim();
  var withDetail=!!(document.getElementById('crawlDetailCheck')&&document.getElementById('crawlDetailCheck').checked);

  document.getElementById('crawlBtn').disabled=true;
  document.getElementById('crawlStatus').style.display='block';
  document.getElementById('crawlResult').style.display='none';
  document.getElementById('crawlStatusText').textContent='크롤링 중... (게임 '+selectedIds.length+'개, '+pages+'페이지'+(withDetail?', 상세 포함':'')+')';
  var liveLog=document.getElementById('crawlLiveLog');
  liveLog.textContent='';

  function appendLog(msg,color){
    var span=document.createElement('span');
    span.style.color=color||'#d4d4d4';
    span.textContent=msg+'\\n';
    liveLog.appendChild(span);
    liveLog.scrollTop=liveLog.scrollHeight;
  }

  try{
    var body={gameIds:selectedIds,pages:pages,crawlDetail:withDetail};
    if(apiKey)body.scraperApiKey=apiKey;
    var resp=await fetch('/api/admin/crawl/stream',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify(body)
    });
    if(!resp.ok||!resp.body){throw new Error('스트림 연결 실패: '+resp.status);}

    var reader=resp.body.getReader();
    var decoder=new TextDecoder();
    var buf='';
    var lastData=null;

    while(true){
      var chunk=await reader.read();
      if(chunk.done)break;
      buf+=decoder.decode(chunk.value,{stream:true});
      var parts=buf.split('\\n\\n');
      buf=parts.pop()||'';
      for(var i=0;i<parts.length;i++){
        var line=parts[i].trim();
        if(!line.startsWith('data: '))continue;
        try{
          var ev=JSON.parse(line.slice(6));
          lastData=ev;
          if(ev.message){
            var color='#d4d4d4';
            if(ev.type==='ok')color='#6fcf97';
            else if(ev.type==='fail')color='#eb5757';
            else if(ev.type==='warn')color='#f2c94c';
            else if(ev.type==='game')color='#56b6c2';
            else if(ev.type==='done')color='#6fcf97';
            appendLog(ev.message,color);
          }
        }catch(e){}
      }
    }

    document.getElementById('crawlSpinner').style.display='none';
    if(lastData&&lastData.type==='done'){
      var summary='✅ 완료: '+lastData.upserted+'개 저장, '+lastData.failed+'개 실패';
      if(withDetail)summary+=' / 상세 '+lastData.detailFetched+'개';
      document.getElementById('crawlStatusText').textContent=summary;
    }
    loadStats();
    loadProducts();
  }catch(e){
    appendLog('\\n❌ 오류: '+e.message,'#eb5757');
    document.getElementById('crawlStatusText').textContent='크롤링 오류';
  }finally{
    document.getElementById('crawlBtn').disabled=false;
    document.getElementById('crawlSpinner').style.display='';
  }
}

function fmtDate(d){if(!d)return'-';return new Date(d).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function fmtMoney(n){if(n==null)return'-';return Number(n).toLocaleString('ko-KR')+'원';}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

async function loadStats(){
  try{
    var r=await fetch('/api/admin/stats',{credentials:'include'});
    if(!r.ok)return;
    var s=await r.json();
    document.getElementById('statUsers').textContent=s.users;
    document.getElementById('statProducts').textContent=s.products;
    document.getElementById('statOrders').textContent=s.orders;
  }catch(e){}
}

async function loadAll(){
  await Promise.all([loadStats(),loadProducts(),loadUsers(),loadOrders(),loadWithdrawals()]);
}

// ── 상품 ─────────────────────────────────────────────────
async function loadProducts(){
  var tbody=document.getElementById('productsBody');
  tbody.innerHTML='<tr class="empty-row"><td colspan="9">로딩 중...</td></tr>';
  var cat=document.getElementById('prodCategoryFilter').value;
  var st=document.getElementById('prodStatusFilter').value;
  var url='/api/admin/products'+(cat||st?'?':'')+(cat?'category='+cat:'')+(cat&&st?'&':'')+(st?'status='+st:'');
  try{
    var r=await fetch(url,{credentials:'include'});
    var products=await r.json();
    if(!Array.isArray(products))products=[];
    document.getElementById('statProducts').textContent=products.length;
    if(!products.length){tbody.innerHTML='<tr class="empty-row"><td colspan="9">상품이 없습니다</td></tr>';return;}
    tbody.innerHTML=products.map(function(p){
      var catLabel=p.category==='buy'?'삽니다':'팝니다';
      var catClass=p.category==='buy'?'buy':'sell';
      var stLabel={active:'판매중',sold:'판매완료',inactive:'비활성'}[p.status]||p.status;
      return '<tr id="prod-'+p.id+'">'
        +'<td>'+p.id+'</td>'
        +'<td><span class="badge '+catClass+'">'+catLabel+'</span></td>'
        +'<td>'+escHtml(p.gameName||'-')+'</td>'
        +'<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+escHtml(p.title)+'">'+escHtml(p.title)+'</td>'
        +'<td>'+fmtMoney(p.price)+'</td>'
        +'<td>'+escHtml(p.sellerName||'-')+'</td>'
        +'<td><span class="badge '+p.status+'">'+stLabel+'</span></td>'
        +'<td>'+fmtDate(p.createdAt)+'</td>'
        +'<td>'
          +'<button class="action-btn edit" onclick="openEditModal('+JSON.stringify(p).replace(/"/g,'&quot;')+')">수정</button>'
          +'<button class="action-btn delete" onclick="deleteProduct('+p.id+')">삭제</button>'
        +'</td>'
        +'</tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="9">오류 발생</td></tr>';}
}

function openProductModal(){
  document.getElementById('modalTitle').textContent='상품 등록';
  document.getElementById('modalProductId').value='';
  document.getElementById('modalCategory').value='sell';
  document.getElementById('modalGameName').value='';
  document.getElementById('modalTitle2').value='';
  document.getElementById('modalPrice').value='';
  document.getElementById('modalSellerName').value='';
  document.getElementById('modalDescription').value='';
  document.getElementById('modalStatus').value='active';
  document.getElementById('modalSaveBtn').textContent='등록';
  document.getElementById('productModal').classList.add('open');
  document.getElementById('modalTitle2').focus();
}

function openEditModal(p){
  document.getElementById('modalTitle').textContent='상품 수정';
  document.getElementById('modalProductId').value=p.id;
  document.getElementById('modalCategory').value=p.category||'sell';
  document.getElementById('modalGameName').value=p.gameName||'';
  document.getElementById('modalTitle2').value=p.title||'';
  document.getElementById('modalPrice').value=p.price||'';
  document.getElementById('modalSellerName').value=p.sellerName||'';
  document.getElementById('modalDescription').value=p.description||'';
  document.getElementById('modalStatus').value=p.status||'active';
  document.getElementById('modalSaveBtn').textContent='저장';
  document.getElementById('productModal').classList.add('open');
}

function closeProductModal(){
  document.getElementById('productModal').classList.remove('open');
}

async function saveProduct(){
  var id=document.getElementById('modalProductId').value;
  var title=document.getElementById('modalTitle2').value.trim();
  var price=document.getElementById('modalPrice').value.trim();
  var gameName=document.getElementById('modalGameName').value.trim();
  var category=document.getElementById('modalCategory').value;
  var sellerName=document.getElementById('modalSellerName').value.trim();
  var description=document.getElementById('modalDescription').value.trim();
  var status=document.getElementById('modalStatus').value;

  if(!title){showToast('상품명을 입력하세요.');return;}
  if(!price||parseInt(price)<=0){showToast('가격을 입력하세요.');return;}

  var btn=document.getElementById('modalSaveBtn');
  btn.disabled=true;
  try{
    var r;
    if(id){
      r=await fetch('/api/admin/products/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({title,price,gameName,category,sellerName,description,status})});
    }else{
      r=await fetch('/api/admin/products',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({title,price,gameName,category,sellerName,description})});
    }
    var d=await r.json();
    if(!r.ok){showToast('오류: '+(d.error||'처리 실패'));btn.disabled=false;return;}
    showToast(id?'✅ 상품이 수정되었습니다':'✅ 상품이 등록되었습니다');
    closeProductModal();
    loadProducts();
  }catch(e){showToast('서버 오류');btn.disabled=false;}
}

async function deleteProduct(id){
  if(!confirm('이 상품을 삭제하시겠습니까?'))return;
  try{
    var r=await fetch('/api/admin/products/'+id,{method:'DELETE',credentials:'include'});
    if(!r.ok){var d=await r.json();showToast('오류: '+(d.error||'삭제 실패'));return;}
    showToast('🗑 상품이 삭제되었습니다');
    loadProducts();
  }catch(e){showToast('서버 오류');}
}

// ── 회원 ─────────────────────────────────────────────────
async function loadUsers(){
  var tbody=document.getElementById('usersBody');
  tbody.innerHTML='<tr class="empty-row"><td colspan="9">로딩 중...</td></tr>';
  try{
    var r=await fetch('/api/admin/users',{credentials:'include'});
    var users=await r.json();
    document.getElementById('statUsers').textContent=users.length;
    if(!users.length){tbody.innerHTML='<tr class="empty-row"><td colspan="9">회원이 없습니다</td></tr>';return;}
    tbody.innerHTML=users.map(function(u){
      var delBtn=u.role!=='admin'
        ?'<button class="action-btn delete" onclick="deleteUser('+u.id+')">삭제</button>'
        :'-';
      var authBtn='<button class="action-btn auth" onclick="openAuthModal('+u.id+','+JSON.stringify(u.nickname||u.email).replace(/"/g,'&quot;')+')">인증</button>';
      var milBtn='<button class="action-btn edit" onclick="openBalanceModal('+u.id+','+JSON.stringify(u.nickname||u.email).replace(/"/g,'&quot;')+','+(u.balance||0)+')">💰</button>';
      var editBtn='<button class="action-btn" style="background:#f0f4ff;color:#5a5fc7" onclick="openUserEditModal('+JSON.stringify(u).replace(/"/g,'&quot;')+')">수정</button>';
      return '<tr id="user-row-'+u.id+'">'
        +'<td>'+u.id+'</td>'
        +'<td>'+escHtml(u.email)+'</td>'
        +'<td id="user-nick-'+u.id+'">'+escHtml(u.nickname||'-')+'</td>'
        +'<td id="user-phone-'+u.id+'">'+escHtml(u.phone||'-')+'</td>'
        +'<td id="user-grade-'+u.id+'">'+(function(g){var m={vip:['#7B5CAA','V'],platinum:['#E84060','P'],gold:['#D4941C','G'],silver:['#9B9EA4','S'],bronze:['#5CB85C','B']};var e=g?m[g]:null;return e?'<svg width="22" height="26" viewBox="0 0 22 26" xmlns="http://www.w3.org/2000/svg" title="'+g.toUpperCase()+'"><polygon points="11,0 22,6.5 22,19.5 11,26 0,19.5 0,6.5" fill="'+e[0]+'"/><text x="11" y="19" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial,Helvetica,sans-serif">'+e[1]+'</text></svg>':'-';})(u.grade)+'</td>'
        +'<td id="user-bal-'+u.id+'">'+fmtMoney(u.balance)+'</td>'
        +'<td>'+fmtDate(u.createdAt)+'</td>'
        +'<td>'+editBtn+milBtn+authBtn+'</td>'
        +'<td>'+delBtn+'</td>'
        +'</tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="9">오류 발생</td></tr>';}
}

async function deleteUser(id){
  if(!confirm('이 회원을 삭제하시겠습니까? 지갑 데이터도 함께 삭제됩니다.'))return;
  try{
    var r=await fetch('/api/admin/users/'+id,{method:'DELETE',credentials:'include'});
    var d=await r.json();
    if(!r.ok){showToast('오류: '+(d.error||'삭제 실패'));return;}
    showToast('🗑 회원이 삭제되었습니다');
    loadUsers();
  }catch(e){showToast('서버 오류');}
}

// ── 회원 정보 수정 ───────────────────────────────────────────
function openUserEditModal(u){
  document.getElementById('userEditId').value=u.id;
  document.getElementById('userEditEmail').value=u.email||'';
  document.getElementById('userEditNickname').value=u.nickname||'';
  document.getElementById('userEditName').value=u.name||'';
  document.getElementById('userEditPhone').value=u.phone||'';
  document.getElementById('userEditScore').value=u.creditScore!=null?u.creditScore:0;
  document.getElementById('userEditGrade').value=u.grade||'';
  document.getElementById('userEditErr').textContent='';
  document.getElementById('userEditModal').classList.add('open');
  setTimeout(function(){document.getElementById('userEditNickname').focus();},80);
}

function closeUserEditModal(){
  document.getElementById('userEditModal').classList.remove('open');
}

async function saveUserEdit(){
  var id=document.getElementById('userEditId').value;
  var email=document.getElementById('userEditEmail').value.trim();
  var nickname=document.getElementById('userEditNickname').value.trim();
  var name=document.getElementById('userEditName').value.trim();
  var phone=document.getElementById('userEditPhone').value.trim();
  var grade=document.getElementById('userEditGrade').value;
  var creditScore=parseInt(document.getElementById('userEditScore').value,10);
  if(isNaN(creditScore)||creditScore<0)creditScore=0;
  var errEl=document.getElementById('userEditErr');
  errEl.textContent='';

  if(!nickname){errEl.textContent='닉네임을 입력하세요.';return;}
  if(!email){errEl.textContent='이메일을 입력하세요.';return;}

  var btn=document.getElementById('userEditSaveBtn');
  btn.disabled=true;
  try{
    var r=await fetch('/api/admin/users/'+id,{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify({email,nickname,name:name||null,phone:phone||null,grade:grade||'',creditScore})
    });
    var d=await r.json();
    if(!r.ok){errEl.textContent=d.error||'저장 실패';btn.disabled=false;return;}
    // 행 즉시 업데이트 (실시간 반영)
    var nickEl=document.getElementById('user-nick-'+id);
    var phoneEl=document.getElementById('user-phone-'+id);
    var gradeEl=document.getElementById('user-grade-'+id);
    if(nickEl)nickEl.textContent=d.nickname||'-';
    if(phoneEl)phoneEl.textContent=d.phone||'-';
    if(gradeEl){var gm={vip:['#7B5CAA','V'],platinum:['#E84060','P'],gold:['#D4941C','G'],silver:['#9B9EA4','S'],bronze:['#5CB85C','B']};var ge=d.grade?gm[d.grade]:null;gradeEl.innerHTML=ge?'<svg width="22" height="26" viewBox="0 0 22 26" xmlns="http://www.w3.org/2000/svg" title="'+d.grade.toUpperCase()+'"><polygon points="11,0 22,6.5 22,19.5 11,26 0,19.5 0,6.5" fill="'+ge[0]+'"/><text x="11" y="19" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial,Helvetica,sans-serif">'+ge[1]+'</text></svg>':'-';}
    btn.disabled=false;
    showToast('✅ 회원 정보가 수정되었습니다');
    closeUserEditModal();
    loadUsers();
  }catch(e){errEl.textContent='서버 오류';btn.disabled=false;}
}

// ── 인증상태 ───────────────────────────────────────────────
var authModalUserId=null;

async function openAuthModal(id,nickname){
  authModalUserId=id;
  document.getElementById('authModalNick').textContent=nickname;
  document.getElementById('authExcellent').checked=false;
  document.getElementById('authPhone').checked=false;
  document.getElementById('authEmail').checked=false;
  document.getElementById('authIpin').checked=false;
  document.getElementById('authWithdraw').checked=false;
  document.getElementById('authModal').classList.add('open');
  try{
    var r=await fetch('/api/admin/users/'+id+'/auth-states',{credentials:'include'});
    if(!r.ok){showToast('인증 정보 로딩 실패');return;}
    var d=await r.json();
    document.getElementById('authExcellent').checked=!!d.excellent;
    document.getElementById('authPhone').checked=!!d.phone;
    document.getElementById('authEmail').checked=!!d.email;
    document.getElementById('authIpin').checked=!!d.ipin;
    document.getElementById('authWithdraw').checked=!!d.withdraw;
  }catch(e){showToast('서버 오류');}
}

function closeAuthModal(){
  document.getElementById('authModal').classList.remove('open');
  authModalUserId=null;
}

async function saveAuthStates(){
  if(!authModalUserId)return;
  var btn=document.getElementById('authSaveBtn');
  btn.disabled=true;
  var body={
    excellent:document.getElementById('authExcellent').checked,
    phone:document.getElementById('authPhone').checked,
    email:document.getElementById('authEmail').checked,
    ipin:document.getElementById('authIpin').checked,
    withdraw:document.getElementById('authWithdraw').checked
  };
  try{
    var r=await fetch('/api/admin/users/'+authModalUserId+'/auth-states',{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify(body)
    });
    if(!r.ok){var d=await r.json();showToast('오류: '+(d.error||'저장 실패'));btn.disabled=false;return;}
    showToast('✅ 인증상태가 저장되었습니다');
    closeAuthModal();
  }catch(e){showToast('서버 오류');btn.disabled=false;}
}

// ── 주문 ─────────────────────────────────────────────────
async function loadOrders(){
  var tbody=document.getElementById('ordersBody');
  tbody.innerHTML='<tr class="empty-row"><td colspan="7">로딩 중...</td></tr>';
  var status=document.getElementById('orderStatusFilter').value;
  var url='/api/admin/orders'+(status?'?status='+status:'');
  try{
    var r=await fetch(url,{credentials:'include'});
    var orders=await r.json();
    document.getElementById('statOrders').textContent=orders.length;
    if(!orders.length){tbody.innerHTML='<tr class="empty-row"><td colspan="7">주문이 없습니다</td></tr>';return;}
    tbody.innerHTML=orders.map(function(o){
      var sl={active:'진행중',completed:'완료',cancelled:'취소됨',escrow:'에스크로'}[o.status]||o.status;
      return '<tr>'
        +'<td>'+o.id+'</td>'
        +'<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(o.productTitle||'-')+'</td>'
        +'<td>'+o.buyerId+'</td>'
        +'<td>'+o.sellerId+'</td>'
        +'<td>'+fmtMoney(o.amount)+'</td>'
        +'<td><span class="badge '+o.status+'">'+sl+'</span></td>'
        +'<td>'+fmtDate(o.createdAt)+'</td>'
        +'</tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="7">오류 발생</td></tr>';}
}

// ── 출금 ─────────────────────────────────────────────────
async function loadWithdrawals(){
  var tbody=document.getElementById('withdrawalsBody');
  tbody.innerHTML='<tr class="empty-row"><td colspan="10">로딩 중...</td></tr>';
  var status=document.getElementById('wdStatusFilter').value;
  var url='/api/admin/withdrawals'+(status?'?status='+status:'');
  try{
    var r=await fetch(url,{credentials:'include'});
    var wds=await r.json();
    document.getElementById('statPendingWd').textContent=wds.filter(function(w){return w.status==='pending';}).length;
    document.getElementById('statApprovedWd').textContent=wds.filter(function(w){return w.status==='approved';}).length;
    if(!wds.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">출금 신청이 없습니다</td></tr>';return;}
    tbody.innerHTML=wds.map(function(w){
      var sl={pending:'대기중',approved:'승인됨',rejected:'거절됨'}[w.status]||w.status;
      var actions=w.status==='pending'
        ?'<button class="action-btn approve" onclick="processWd('+w.id+',\\'approved\\')">승인</button>'
          +'<button class="action-btn reject" onclick="processWd('+w.id+',\\'rejected\\')">거절</button>'
        :'-';
      var methodLabel=w.method==='phone'?'📱 휴대폰':'🏦 은행계좌';
      var contactInfo=w.method==='phone'
        ?escHtml(w.phoneNumber||'-')
        :escHtml(w.bankName||'-')+' / '+escHtml(w.accountNumber||'-')+' ('+escHtml(w.accountHolder||'-')+')';
      return '<tr id="wd-'+w.id+'">'
        +'<td>'+w.id+'</td><td>'+w.userId+'</td>'
        +'<td>'+methodLabel+'</td>'
        +'<td>'+fmtMoney(w.amount)+'</td>'
        +'<td>'+contactInfo+'</td>'
        +'<td><span class="badge '+w.status+'">'+sl+'</span></td>'
        +'<td>'+escHtml(w.adminNote||'-')+'</td>'
        +'<td>'+fmtDate(w.createdAt)+'</td>'
        +'<td>'+actions+'</td>'
        +'</tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="10">오류 발생</td></tr>';}
}

async function processWd(id,status){
  var note='';
  if(status==='rejected')note=prompt('거절 사유 (선택사항):')||'';
  var btns=document.querySelectorAll('#wd-'+id+' .action-btn');
  btns.forEach(function(b){b.disabled=true;});
  try{
    var r=await fetch('/api/admin/withdrawals/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({status,adminNote:note})});
    var d=await r.json();
    if(!r.ok){showToast('오류: '+(d.error||'처리 실패'));btns.forEach(function(b){b.disabled=false;});return;}
    showToast(status==='approved'?'✅ 출금 승인 완료':'❌ 출금 거절 완료');
    loadWithdrawals();
  }catch(e){showToast('서버 오류');btns.forEach(function(b){b.disabled=false;});}
}

// ── 마일리지 ───────────────────────────────────────────────
var balanceModalUserId=null;

function openBalanceModal(id,nickname,current){
  balanceModalUserId=id;
  document.getElementById('balanceModalNick').textContent=nickname+' 님의 마일리지';
  document.getElementById('balanceCurrent').textContent=fmtMoney(current);
  document.getElementById('balanceMode').value='add';
  document.getElementById('balanceAmount').value='';
  document.getElementById('balanceModal').classList.add('open');
  setTimeout(function(){document.getElementById('balanceAmount').focus();},100);
}

function closeBalanceModal(){
  document.getElementById('balanceModal').classList.remove('open');
  balanceModalUserId=null;
}

async function saveBalance(){
  if(!balanceModalUserId)return;
  var btn=document.getElementById('balanceSaveBtn');
  var amount=parseInt(document.getElementById('balanceAmount').value,10);
  var mode=document.getElementById('balanceMode').value;
  if(isNaN(amount)||amount<0){showToast('금액을 올바르게 입력하세요');return;}
  btn.disabled=true;
  try{
    var r=await fetch('/api/admin/users/'+balanceModalUserId+'/balance',{
      method:'PATCH',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify({amount,mode})
    });
    var d=await r.json();
    if(!r.ok){showToast('오류: '+(d.error||'저장 실패'));btn.disabled=false;return;}
    var modeLabel=mode==='add'?'추가':'설정';
    showToast('✅ 마일리지 '+modeLabel+' 완료: '+fmtMoney(d.balance));
    // 테이블 행의 잔액 셀 즉시 업데이트
    var balCell=document.getElementById('user-bal-'+balanceModalUserId);
    if(balCell)balCell.textContent=fmtMoney(d.balance);
    document.getElementById('balanceCurrent').textContent=fmtMoney(d.balance);
    closeBalanceModal();
  }catch(e){showToast('서버 오류');btn.disabled=false;}
}

function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2800);
}

checkSession();
</script>
</body>
</html>`;

router.get(["/admin", "/admin/"], (_req, res): void => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.send(ADMIN_HTML);
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
