import { Router, type IRouter } from "express";

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
/* 로그인 화면 */
#login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh}
.login-box{background:#fff;border-radius:16px;padding:48px 40px;width:360px;box-shadow:0 4px 32px rgba(0,0,0,.10)}
.login-box h1{font-size:22px;font-weight:700;color:#1a1a1a;margin-bottom:6px}
.login-box p{font-size:13px;color:#888;margin-bottom:28px}
.login-box input{display:block;width:100%;padding:12px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;margin-bottom:12px;outline:none;transition:border .2s}
.login-box input:focus{border-color:#159EFD}
.login-box button{width:100%;padding:13px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;margin-top:4px}
.login-box button:hover{background:#0e8de0}
.login-box .err{color:#e53e3e;font-size:13px;margin-top:8px;display:none}
/* 어드민 대시보드 */
#admin-screen{display:none;min-height:100vh}
.topbar{background:#fff;border-bottom:1px solid #e8ecf0;padding:0 32px;display:flex;align-items:center;gap:24px;height:60px;position:sticky;top:0;z-index:100}
.topbar .logo{font-size:18px;font-weight:800;color:#159EFD;letter-spacing:-.03em}
.topbar .logo span{color:#222}
.topbar .admin-badge{font-size:12px;font-weight:600;background:#edf8ff;color:#0e8de0;padding:3px 10px;border-radius:20px}
.topbar .spacer{flex:1}
.topbar .logout-btn{font-size:13px;color:#888;background:none;border:none;cursor:pointer;padding:6px 12px;border-radius:6px}
.topbar .logout-btn:hover{background:#f0f0f0}
.content{padding:28px 32px;max-width:1200px;margin:0 auto}
/* 통계 카드 */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px}
.stat-card{background:#fff;border-radius:12px;padding:20px 24px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.stat-card .label{font-size:13px;color:#888;margin-bottom:6px}
.stat-card .value{font-size:28px;font-weight:700;color:#222}
.stat-card .value.blue{color:#159EFD}
.stat-card .value.green{color:#38a169}
.stat-card .value.orange{color:#dd6b20}
/* 탭 */
.tabs{display:flex;gap:0;border-bottom:2px solid #e8ecf0;margin-bottom:20px}
.tab-btn{padding:10px 24px;font-size:15px;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;cursor:pointer;color:#888;transition:all .2s}
.tab-btn.active{color:#159EFD;border-bottom-color:#159EFD}
.tab-panel{display:none}
.tab-panel.active{display:block}
/* 테이블 */
.table-wrap{background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden}
.table-toolbar{padding:16px 20px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:12px}
.table-toolbar .title{font-size:15px;font-weight:700}
.table-toolbar .spacer{flex:1}
.filter-select{padding:7px 12px;border:1.5px solid #e0e0e0;border-radius:7px;font-size:13px;outline:none;cursor:pointer}
.refresh-btn{padding:7px 16px;background:#f4f6fb;border:1.5px solid #e0e0e0;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;color:#555}
.refresh-btn:hover{background:#eef0f5}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{background:#f8f9fc;padding:10px 14px;text-align:left;font-weight:600;color:#555;border-bottom:1px solid #eee;white-space:nowrap}
tbody td{padding:10px 14px;border-bottom:1px solid #f5f5f5;vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:#fafbff}
.badge{display:inline-block;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:600}
.badge.admin{background:#fef3cd;color:#a06c00}
.badge.user{background:#edf8ff;color:#0e8de0}
.badge.pending{background:#fff7e6;color:#dd6b20}
.badge.approved{background:#e6f9ef;color:#276749}
.badge.rejected{background:#fee;color:#c53030}
.badge.active{background:#e6f9ef;color:#276749}
.badge.cancelled{background:#fee;color:#c53030}
.badge.escrow{background:#edf8ff;color:#0e8de0}
.badge.completed{background:#e6f9ef;color:#276749}
.action-btn{padding:5px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;border:none;margin-right:4px}
.action-btn.approve{background:#e6f9ef;color:#276749}
.action-btn.approve:hover{background:#c6f6e0}
.action-btn.reject{background:#fee;color:#c53030}
.action-btn.reject:hover{background:#fcc}
.action-btn:disabled{opacity:.4;cursor:not-allowed}
.empty-row td{text-align:center;color:#aaa;padding:32px}
/* 토스트 */
#toast{position:fixed;bottom:28px;right:28px;background:#222;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;opacity:0;pointer-events:none;transition:opacity .3s;z-index:9999}
#toast.show{opacity:1}
</style>
</head>
<body>

<!-- 로그인 화면 -->
<div id="login-screen">
  <div class="login-box">
    <h1>어드민 로그인</h1>
    <p>아이템매니아 관리자 계정으로 로그인하세요</p>
    <input type="text" id="loginEmail" placeholder="이메일 또는 아이디" autocomplete="username">
    <input type="password" id="loginPw" placeholder="비밀번호" autocomplete="current-password">
    <button id="loginBtn" onclick="doLogin()">로그인</button>
    <div class="err" id="loginErr"></div>
  </div>
</div>

<!-- 어드민 대시보드 -->
<div id="admin-screen">
  <div class="topbar">
    <div class="logo">아이템매니아<span>어드민</span></div>
    <div class="admin-badge" id="adminNickname"></div>
    <div class="spacer"></div>
    <button class="logout-btn" onclick="doLogout()">로그아웃</button>
  </div>
  <div class="content">
    <div class="stats">
      <div class="stat-card">
        <div class="label">전체 회원</div>
        <div class="value blue" id="statUsers">-</div>
      </div>
      <div class="stat-card">
        <div class="label">전체 주문</div>
        <div class="value" id="statOrders">-</div>
      </div>
      <div class="stat-card">
        <div class="label">출금 대기</div>
        <div class="value orange" id="statPendingWd">-</div>
      </div>
      <div class="stat-card">
        <div class="label">출금 완료</div>
        <div class="value green" id="statApprovedWd">-</div>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('users')">👥 회원 관리</button>
      <button class="tab-btn" onclick="switchTab('orders')">📦 주문 관리</button>
      <button class="tab-btn" onclick="switchTab('withdrawals')">💸 출금 관리</button>
    </div>

    <!-- 회원 탭 -->
    <div class="tab-panel active" id="tab-users">
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="title">회원 목록</span>
          <div class="spacer"></div>
          <button class="refresh-btn" onclick="loadUsers()">↻ 새로고침</button>
        </div>
        <table>
          <thead><tr>
            <th>ID</th><th>이메일</th><th>닉네임</th><th>전화번호</th><th>등급</th><th>잔액</th><th>가입일</th>
          </tr></thead>
          <tbody id="usersBody"><tr class="empty-row"><td colspan="7">로딩 중...</td></tr></tbody>
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
          <thead><tr>
            <th>ID</th><th>상품명</th><th>구매자ID</th><th>판매자ID</th><th>금액</th><th>상태</th><th>주문일</th>
          </tr></thead>
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
          <thead><tr>
            <th>ID</th><th>유저ID</th><th>금액</th><th>은행</th><th>계좌번호</th><th>예금주</th><th>상태</th><th>메모</th><th>신청일</th><th>처리</th>
          </tr></thead>
          <tbody id="withdrawalsBody"><tr class="empty-row"><td colspan="10">로딩 중...</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<div id="toast"></div>

<script>
var currentTab = 'users';

async function doLogin() {
  var email = document.getElementById('loginEmail').value.trim();
  var pw = document.getElementById('loginPw').value;
  var errEl = document.getElementById('loginErr');
  errEl.style.display = 'none';
  if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력하세요.'; errEl.style.display = 'block'; return; }
  try {
    var r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password: pw })
    });
    var d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || '로그인 실패'; errEl.style.display = 'block'; return; }
    if (d.role !== 'admin') { errEl.textContent = '관리자 계정이 아닙니다.'; errEl.style.display = 'block'; return; }
    showAdmin(d);
  } catch(e) { errEl.textContent = '서버 연결 오류'; errEl.style.display = 'block'; }
}

document.getElementById('loginPw').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });

async function checkSession() {
  try {
    var r = await fetch('/api/auth/me', { credentials: 'include' });
    if (!r.ok) return;
    var d = await r.json();
    if (d.role === 'admin') showAdmin(d);
  } catch(e) {}
}

function showAdmin(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-screen').style.display = 'block';
  document.getElementById('adminNickname').textContent = (user.nickname || user.email) + ' (관리자)';
  loadAll();
}

async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  location.reload();
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(function(b,i){ b.classList.toggle('active', ['users','orders','withdrawals'][i]===tab); });
  document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
  document.getElementById('tab-'+tab).classList.add('active');
}

function fmtDate(d) { if(!d) return '-'; return new Date(d).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function fmtMoney(n) { if(n==null) return '-'; return Number(n).toLocaleString('ko-KR')+'원'; }

async function loadAll() {
  await Promise.all([loadUsers(), loadOrders(), loadWithdrawals()]);
}

async function loadUsers() {
  var tbody = document.getElementById('usersBody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="7">로딩 중...</td></tr>';
  try {
    var r = await fetch('/api/admin/users', { credentials: 'include' });
    var users = await r.json();
    document.getElementById('statUsers').textContent = users.length;
    if (!users.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">회원이 없습니다</td></tr>'; return; }
    tbody.innerHTML = users.map(function(u) {
      return '<tr>'
        +'<td>'+u.id+'</td>'
        +'<td>'+escHtml(u.email)+'</td>'
        +'<td>'+escHtml(u.nickname||'-')+'</td>'
        +'<td>'+escHtml(u.phone||'-')+'</td>'
        +'<td><span class="badge '+u.role+'">'+( u.role==='admin'?'관리자':'일반' )+'</span></td>'
        +'<td>'+fmtMoney(u.balance)+'</td>'
        +'<td>'+fmtDate(u.createdAt)+'</td>'
        +'</tr>';
    }).join('');
  } catch(e) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">오류 발생</td></tr>'; }
}

async function loadOrders() {
  var tbody = document.getElementById('ordersBody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="7">로딩 중...</td></tr>';
  var status = document.getElementById('orderStatusFilter').value;
  var url = '/api/admin/orders' + (status ? '?status='+status : '');
  try {
    var r = await fetch(url, { credentials: 'include' });
    var orders = await r.json();
    document.getElementById('statOrders').textContent = orders.length;
    if (!orders.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">주문이 없습니다</td></tr>'; return; }
    tbody.innerHTML = orders.map(function(o) {
      var statusLabel = {active:'진행중',completed:'완료',cancelled:'취소됨',escrow:'에스크로'}[o.status]||o.status;
      return '<tr>'
        +'<td>'+o.id+'</td>'
        +'<td>'+escHtml(o.productTitle||'-')+'</td>'
        +'<td>'+o.buyerId+'</td>'
        +'<td>'+o.sellerId+'</td>'
        +'<td>'+fmtMoney(o.amount)+'</td>'
        +'<td><span class="badge '+o.status+'">'+statusLabel+'</span></td>'
        +'<td>'+fmtDate(o.createdAt)+'</td>'
        +'</tr>';
    }).join('');
  } catch(e) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">오류 발생</td></tr>'; }
}

async function loadWithdrawals() {
  var tbody = document.getElementById('withdrawalsBody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="10">로딩 중...</td></tr>';
  var status = document.getElementById('wdStatusFilter').value;
  var url = '/api/admin/withdrawals' + (status ? '?status='+status : '');
  try {
    var r = await fetch(url, { credentials: 'include' });
    var wds = await r.json();
    var pending = wds.filter(function(w){ return w.status==='pending'; }).length;
    var approved = wds.filter(function(w){ return w.status==='approved'; }).length;
    document.getElementById('statPendingWd').textContent = pending;
    document.getElementById('statApprovedWd').textContent = approved;
    if (!wds.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="10">출금 신청이 없습니다</td></tr>'; return; }
    tbody.innerHTML = wds.map(function(w) {
      var statusLabel = {pending:'대기중',approved:'승인됨',rejected:'거절됨'}[w.status]||w.status;
      var actions = w.status==='pending'
        ? '<button class="action-btn approve" onclick="processWd('+w.id+',\'approved\')">승인</button>'
          +'<button class="action-btn reject" onclick="processWd('+w.id+',\'rejected\')">거절</button>'
        : '-';
      return '<tr id="wd-'+w.id+'">'
        +'<td>'+w.id+'</td>'
        +'<td>'+w.userId+'</td>'
        +'<td>'+fmtMoney(w.amount)+'</td>'
        +'<td>'+escHtml(w.bankName||'-')+'</td>'
        +'<td>'+escHtml(w.accountNumber||'-')+'</td>'
        +'<td>'+escHtml(w.accountHolder||'-')+'</td>'
        +'<td><span class="badge '+w.status+'">'+statusLabel+'</span></td>'
        +'<td>'+escHtml(w.adminNote||'-')+'</td>'
        +'<td>'+fmtDate(w.createdAt)+'</td>'
        +'<td>'+actions+'</td>'
        +'</tr>';
    }).join('');
  } catch(e) { tbody.innerHTML = '<tr class="empty-row"><td colspan="10">오류 발생</td></tr>'; }
}

async function processWd(id, status) {
  var note = '';
  if (status === 'rejected') {
    note = prompt('거절 사유를 입력하세요 (선택사항):') || '';
  }
  var btns = document.querySelectorAll('#wd-'+id+' .action-btn');
  btns.forEach(function(b){ b.disabled = true; });
  try {
    var r = await fetch('/api/admin/withdrawals/'+id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, adminNote: note })
    });
    var d = await r.json();
    if (!r.ok) { showToast('오류: '+(d.error||'처리 실패')); btns.forEach(function(b){ b.disabled=false; }); return; }
    showToast(status==='approved' ? '✅ 출금 승인 완료' : '❌ 출금 거절 완료');
    loadWithdrawals();
  } catch(e) { showToast('서버 오류'); btns.forEach(function(b){ b.disabled=false; }); }
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2800);
}

checkSession();
</script>
</body>
</html>`;

router.get(["/admin", "/admin/"], (_req, res): void => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache");
  res.send(ADMIN_HTML);
});

export default router;
