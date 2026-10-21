var currentTab='products';
var currentProductsPage=1;
var totalProductsPages=1;

window.onerror=function(msg,src,line,col,err){
  var d=document.createElement('div');
  d.style='position:fixed;top:0;left:0;right:0;background:#c0392b;color:#fff;padding:12px 16px;z-index:99999;font-size:13px;font-family:monospace';
  d.textContent='JS 오류: '+msg+' (line '+line+')';
  document.body.appendChild(d);
};

async function downloadCrawlScript(){
  var btn=document.getElementById('autoScriptDownloadBtn');
  var orig=btn.textContent;
  btn.disabled=true;btn.textContent='다운로드 중...';
  try{
    var r=await fetch('/api/admin/crawl-script',{
      credentials:'include',
      headers:{'X-Crawl-Key':window._CK||''}
    });
    if(!r.ok){
      var err=await r.json().catch(function(){return{};});
      alert('다운로드 오류: '+(err.error||r.status));
      return;
    }
    var blob=await r.blob();
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;a.download='auto-crawl.mjs';
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
  }catch(e){alert('다운로드 오류: '+e.message);}
  finally{btn.disabled=false;btn.textContent=orig;}
}

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
document.getElementById('loginForm').addEventListener('submit',function(e){e.preventDefault();doLogin();});

async function checkSession(){
  try{
    var r=await fetch('/api/admin/me',{credentials:'include',cache:'no-store'});
    if(r.status===401||r.status===403){showLogin();return;}
    if(!r.ok){throw new Error('관리자 로그인 상태 확인 실패');}
    var d=await r.json();
    if(d.role!=='admin'){showLogin();return;}
    showAdmin(d);
  }catch(e){
    showToast('연결 오류로 로그인 상태를 확인하지 못했습니다. 잠시 후 다시 확인합니다.');
    setTimeout(checkSession,5000);
  }
}

function showLogin(){
  document.getElementById('login-screen').style.display='block';
  document.getElementById('admin-screen').style.display='none';
}

function showAdmin(user){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('admin-screen').style.display='block';
  document.getElementById('adminNickname').textContent=(user.nickname||user.email)+' (관리자)';
  loadAll();
  if(typeof window._adminConnectSSE==='function') window._adminConnectSSE();
  startNotifPolling();
}

/* ── 알림 폴링 (SSE가 인스턴스 간 공유 안 될 경우 대비, DB 직접 조회) ── */
var _notifPollTimer=null;
var _notifBaseline=-1; /* -1: 아직 baseline 미설정 */

async function _pollAdminNotifs(){
  try{
    var r=await fetch('/api/admin/notifications',{credentials:'include',cache:'no-store'});
    if(!r.ok)return;
    var d=await r.json();
    var rows=d.notifications||[];
    if(_notifBaseline===-1){
      /* 첫 호출: 현재 최신 ID를 baseline으로 기록 (기존 알림 토스트 방지) */
      _notifBaseline=rows.length?rows[0].id:0;
      return;
    }
    var newRows=rows.filter(function(n){return n.id>_notifBaseline;});
    if(newRows.length){
      _notifBaseline=rows[0].id;
      newRows.forEach(function(n){
        if(typeof window._adminHandleNotification==='function') window._adminHandleNotification(n);
      });
    }
  }catch(e){}
}

function startNotifPolling(){
  if(_notifPollTimer)return;
  _pollAdminNotifs(); /* baseline 설정 */
  _notifPollTimer=setInterval(_pollAdminNotifs,10000); /* 10초마다 체크 */
}

var loadedTabs={};

var loginLogoObjectUrl=null;
var loginLogoSavedUrl=null;
var loginLogoValidated=false;
function showLoginLogo(url){
  var image=document.getElementById('loginLogoPreview');
  image.style.display=url?'block':'none';
  if(url)image.src=url;else image.removeAttribute('src');
  document.getElementById('loginLogoEmpty').style.display=url?'none':'block';
}
function loginLogoMessage(message,error){
  var el=document.getElementById('loginLogoStatus');
  el.textContent=message;el.style.color=error?'#b92b32':'#347348';
}
function previewLoginBrandName(){
  var value=document.getElementById('loginBrandName').value.trim();
  document.getElementById('loginBrandNamePreview').textContent=(value?value+' ':'')+'회원 로그인';
}
async function saveLoginBrandName(){
  var input=document.getElementById('loginBrandName'),button=document.getElementById('loginBrandNameSave'),status=document.getElementById('loginBrandNameStatus');
  input.disabled=true;button.disabled=true;status.textContent='브랜드 이름을 저장하는 중입니다.';
  try{
    var r=await fetch('/api/admin/login-branding/name',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({brandName:input.value})});
    var d=await r.json();if(!r.ok)throw new Error(d.error||'브랜드 이름 저장에 실패했습니다.');
    input.value=d.brandName;previewLoginBrandName();
    status.style.color='#347348';status.textContent='저장했습니다. PC·모바일 로그인 화면에 반영됩니다.';
  }catch(e){status.style.color='#b92b32';status.textContent=e.message;}
  finally{input.disabled=false;button.disabled=false;}
}
async function loadLoginBranding(keepBrandName){
  try{
    var r=await fetch('/api/admin/login-branding',{credentials:'include',cache:'no-store'});
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'로고 설정을 불러오지 못했습니다.');
    loginLogoSavedUrl=d.logoUrl;
    if(!keepBrandName){
      document.getElementById('loginBrandName').value=d.brandName||'';
      previewLoginBrandName();
    }
    loginLogoValidated=false;
    if(loginLogoObjectUrl){URL.revokeObjectURL(loginLogoObjectUrl);loginLogoObjectUrl=null;}
    document.getElementById('loginLogoFile').value='';
    showLoginLogo(d.logoUrl);loginLogoMessage(d.logoUrl?'저장된 로고가 표시됩니다.':'로고 파일을 선택한 뒤 저장해 주세요.',false);
  }catch(e){loginLogoMessage(e.message,true);}
}
async function previewLoginLogo(){
  var input=document.getElementById('loginLogoFile'),file=input.files[0];
  var image=document.getElementById('loginLogoPreview');
  image.onload=null;image.onerror=null;loginLogoValidated=false;
  if(loginLogoObjectUrl){URL.revokeObjectURL(loginLogoObjectUrl);loginLogoObjectUrl=null;}
  if(!file){showLoginLogo(loginLogoSavedUrl);return;}
  if(['image/png','image/jpeg','image/webp'].indexOf(file.type)===-1||file.size>2*1024*1024){
    input.value='';showLoginLogo(loginLogoSavedUrl);
    loginLogoMessage('PNG, JPG, WEBP 이미지 파일만, 최대 2MB까지 선택할 수 있습니다.',true);return;
  }
  try{
    var bytes=new Uint8Array(await file.slice(0,32).arrayBuffer());
    if(input.files[0]!==file)return;
    var png=bytes.length>=32&&[137,80,78,71,13,10,26,10].every(function(value,i){return bytes[i]===value;});
    var jpg=bytes.length>=32&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    var webp=bytes.length>=32&&String.fromCharCode.apply(null,bytes.slice(0,4))==='RIFF'&&String.fromCharCode.apply(null,bytes.slice(8,12))==='WEBP';
    if(!png&&!jpg&&!webp)throw new Error('올바른 PNG, JPG, WEBP 이미지 파일이 아닙니다.');
    image.onload=function(){
      if(input.files[0]!==file)return;
      loginLogoValidated=true;image.onload=null;image.onerror=null;
      loginLogoMessage('미리보기입니다. 저장 버튼을 눌러야 실제 화면에 반영됩니다.',false);
    };
    image.onerror=function(){
      image.onload=null;image.onerror=null;input.value='';loginLogoValidated=false;
      if(loginLogoObjectUrl){URL.revokeObjectURL(loginLogoObjectUrl);loginLogoObjectUrl=null;}
      showLoginLogo(loginLogoSavedUrl);loginLogoMessage('이미지 파일을 읽을 수 없습니다. 다른 파일을 선택하세요.',true);
    };
    loginLogoObjectUrl=URL.createObjectURL(file);showLoginLogo(loginLogoObjectUrl);
    loginLogoMessage('이미지 파일을 확인하는 중입니다.',false);
  }catch(e){
    input.value='';showLoginLogo(loginLogoSavedUrl);loginLogoMessage(e.message,true);
  }
}
function loginLogoBusy(busy){
  document.getElementById('loginLogoSave').disabled=busy;
  document.getElementById('loginLogoRemove').disabled=busy;
  document.getElementById('loginLogoFile').disabled=busy;
}
async function saveLoginLogo(){
  var file=document.getElementById('loginLogoFile').files[0];
  if(!file){loginLogoMessage('업로드할 로고 이미지 파일을 선택하세요.',true);return;}
  if(!loginLogoValidated){loginLogoMessage('올바른 이미지의 미리보기가 표시된 뒤 저장하세요.',true);return;}
  loginLogoBusy(true);loginLogoMessage('로고를 저장하는 중입니다.',false);
  try{
    var data=new FormData();data.append('logo',file);
    var r=await fetch('/api/admin/login-branding/logo',{method:'POST',credentials:'include',body:data});
    var d=await r.json();if(!r.ok)throw new Error(d.error||'로고 저장에 실패했습니다.');
    await loadLoginBranding(true);loginLogoMessage('저장했습니다. 로그인 화면에 바로 반영됩니다.',false);
  }catch(e){loginLogoMessage(e.message,true);}finally{loginLogoBusy(false);}
}
async function removeLoginLogo(){
  if(!confirm('로그인 화면에 표시되는 로고를 삭제할까요? 회원·거래 데이터에는 영향을 주지 않습니다.'))return;
  loginLogoBusy(true);
  try{
    var r=await fetch('/api/admin/login-branding/logo',{method:'DELETE',credentials:'include'});
    var d=await r.json();if(!r.ok)throw new Error(d.error||'로고 삭제에 실패했습니다.');
    await loadLoginBranding(true);loginLogoMessage('로그인 화면에서 로고를 삭제했습니다.',false);
  }catch(e){loginLogoMessage(e.message,true);}finally{loginLogoBusy(false);}
}

async function doLogout(){
  await fetch('/api/admin/logout',{method:'POST',credentials:'include'});
  location.reload();
}

function switchTab(tab){
  currentTab=tab;
  var tabs=['products','users','orders','withdrawals','crawl','chatrooms','ipblocks','support','loginbranding'];
  document.querySelectorAll('.tab-btn').forEach(function(b,i){b.classList.toggle('active',tabs[i]===tab);});
  document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active');});
  document.getElementById('tab-'+tab).classList.add('active');
  if(tab==='loginbranding'){loadLoginBranding();return;}
  if(tab==='support'){if(typeof window.initializeSupportAdmin==='function')window.initializeSupportAdmin();else showToast('고객센터 스크립트를 불러오는 중입니다.');return;}
  if(tab==='crawl'){initCrawlTab();return;}
  if(tab==='users')loadRegistrationPolicy();
  if(!loadedTabs[tab]){
    loadedTabs[tab]=true;
    if(tab==='users')loadUsers();
    else if(tab==='orders')loadOrders();
    else if(tab==='withdrawals')loadWithdrawals();
    else if(tab==='chatrooms')loadChatRooms();
    else if(tab==='ipblocks')loadIpBlocks();
  }
}

var crawlGamesData=[];
var crawlSelectedGames=new Set();

async function initCrawlTab(){
  if(crawlGamesData.length>0)return;
  try{
    var r=await fetch('/api/admin/crawl/games',{credentials:'include'});
    var d=await r.json();
    crawlGamesData=d.games||[];
    var provider=d.provider||d.crawlProvider;
    var hasFirecrawl=provider==='firecrawl'||d.hasFirecrawlKey===true;
    var hasKey=hasFirecrawl||d.hasApiKey;
    if(hasKey){
      document.getElementById('crawlApiKeySection').style.background='#d4edda';
      document.getElementById('crawlApiKeySection').style.borderColor='#28a745';
      document.getElementById('crawlApiKeyStatus').textContent=hasFirecrawl
        ?'✅ 서버 Firecrawl 키 설정됨 (키는 이 브라우저로 전달되지 않습니다)'
        :provider==='scraperapi'
          ?'✅ 서버 ScraperAPI 키 설정됨'
          :'✅ 서버 수집 API 키 설정됨 (Firecrawl 키가 있으면 우선 사용)';
      document.getElementById('crawlApiKeyStatus').style.color='#155724';
    }else{
      document.getElementById('crawlApiKeyStatus').textContent='서버 Firecrawl 키를 찾지 못했습니다. FIRECRAWL_API_KEY를 서버 Secrets에 설정하거나 기존 ScraperAPI 키를 선택 입력하세요.';
      document.getElementById('crawlApiKeyStatus').style.color='#8a5a00';
    }
    if(provider==='firecrawl'||hasFirecrawl)document.getElementById('crawlBtn').textContent='🕷️ Firecrawl로 수집';
    else if(provider==='scraperapi')document.getElementById('crawlBtn').textContent='🕷️ ScraperAPI로 수집';
    else document.getElementById('crawlBtn').textContent='🕷️ 서버 수집 API로 시작';
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
    updateCrawlCostEstimate();
    var origin=location.origin;
    document.getElementById('crawlScriptUrl').textContent=origin+'/api/admin/crawl-script';
    document.getElementById('crawlApiBaseUrl').textContent=origin;
  }catch(e){console.error(e);}
}

async function discoverApi(){
  var key=document.getElementById('crawlApiKeyInput').value.trim();
  var btn=document.getElementById('discoverBtn');
  var resultEl=document.getElementById('discoverResult');
  btn.disabled=true;btn.textContent='API 탐지 중...';
  resultEl.style.display='block';resultEl.textContent='itemmania.com JS 분석 중...';
  try{
    var r=await fetch('/api/admin/crawl/discover?scraperApiKey='+encodeURIComponent(key)+'&gameId=138',{credentials:'include'});
    var d=await r.json();
    if(!r.ok){resultEl.textContent='오류: '+(d.error||'실패');return;}
    var lines=[];
    lines.push('=== HTML 분석 결과 ===');
    lines.push('HTML 크기: '+d.htmlSize+'바이트');
    lines.push('list_item: '+d.listItemCount+', data-tid: '+d.dataTidCount+', __NEXT_DATA__: '+d.hasNextData);
    lines.push('');
    if(d.scriptSrcs&&d.scriptSrcs.length){lines.push('=== JS 파일 ===');d.scriptSrcs.forEach(function(s){lines.push(s);});lines.push('');}
    else{lines.push('=== JS 파일 없음 ===');lines.push('');}
    if(d.ajaxInHtml&&d.ajaxInHtml.length){lines.push('=== HTML URL 패턴 ===');d.ajaxInHtml.forEach(function(u){lines.push(u);});lines.push('');}
    if(d.jsFindings&&d.jsFindings.length){
      d.jsFindings.forEach(function(f){
        lines.push('=== JS: '+f.url+' ===');
        f.patterns.forEach(function(p){lines.push(p);});
        lines.push('');
      });
    }else{lines.push('=== JS API 패턴 없음 ===');}
    resultEl.textContent=lines.join('\n');
  }catch(e){resultEl.textContent='서버 오류: '+e.message;}
  finally{btn.disabled=false;btn.textContent='API 자동 탐지';}
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
  var categoryCount=2; /* 팝니다 + 삽니다 */
  var listRequests=selectedIds.length*pages*categoryCount;
  var estimatedDetailRequests=selectedIds.length*pages*categoryCount*55;
  var totalRequests=listRequests+(withDetail?estimatedDetailRequests:0);
  var costEl=document.getElementById('crawlDetailCost');
  if(costEl){
    costEl.textContent='예상 기본 소모: 목록 '+listRequests+'페이지 요청 (게임 '+selectedIds.length+'개 × '+pages+'페이지 × 팝니다·삽니다 2종)'
      +(withDetail?' + 상세 약 '+estimatedDetailRequests+'건 = 총 약 '+totalRequests+'크레딧':' = 약 '+totalRequests+'크레딧')
      +'. 상세 추정은 페이지당 약 55개 기준이며, 재시도·옵션에 따라 실제 사용량은 달라질 수 있습니다.';
  }
}

var crawlTimerInterval=null;
var crawlStartTime=0;
var crawlGameNames=[];

function updateCrawlTimer(){
  var elapsed=Math.floor((Date.now()-crawlStartTime)/1000);
  var mm=String(Math.floor(elapsed/60)).padStart(2,'0');
  var ss=String(elapsed%60).padStart(2,'0');
  var el=document.getElementById('crawlTimer');
  if(el)el.textContent=mm+':'+ss;
}

function initGameCards(games){
  crawlGameNames=games||[];
  var container=document.getElementById('crawlGameCards');
  if(!container)return;
  container.innerHTML='';
  crawlGameNames.forEach(function(name,i){
    var card=document.createElement('div');
    card.id='crawlGameCard-'+i;
    card.style.cssText='padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;background:#f0f0f0;color:#888;border:1.5px solid #ddd;display:flex;align-items:center;gap:6px;transition:all 0.3s';
    card.innerHTML='<span>⏸</span><span>'+escHtml(name)+'</span><span class="card-saved" style="font-size:11px;font-weight:400;color:#aaa"></span>';
    container.appendChild(card);
  });
}

function setGameCardState(idx,state,saved){
  var card=document.getElementById('crawlGameCard-'+idx);
  if(!card)return;
  var configs={
    waiting:{bg:'#f0f0f0',color:'#888',border:'#ddd',icon:'⏸'},
    running:{bg:'#e8f4ff',color:'#159EFD',border:'#159EFD',icon:'🔄'},
    ok:{bg:'#f0fff4',color:'#28a745',border:'#9be6b0',icon:'✅'},
    warn:{bg:'#fff8e1',color:'#e57c00',border:'#ffd599',icon:'⚠️'},
    fail:{bg:'#fff0f0',color:'#dc3545',border:'#f5c6cb',icon:'❌'}
  };
  var cfg=configs[state]||configs.waiting;
  card.style.background=cfg.bg;
  card.style.color=cfg.color;
  card.style.borderColor=cfg.border;
  card.querySelector('span').textContent=cfg.icon;
  var savedEl=card.querySelector('.card-saved');
  if(savedEl&&saved!=null)savedEl.textContent=' '+saved+'개';
}

function updateProgress(completed,total,saved,failed){
  var pct=total>0?Math.round(completed/total*100):0;
  var bar=document.getElementById('crawlProgressBar');
  var pctEl=document.getElementById('crawlProgressPct');
  var labelEl=document.getElementById('crawlProgressLabel');
  var savedEl=document.getElementById('crawlSavedCount');
  var failedEl=document.getElementById('crawlFailedCount');
  var stepEl=document.getElementById('crawlStepCount');
  if(bar)bar.style.width=pct+'%';
  if(pctEl)pctEl.textContent=pct+'%';
  if(labelEl)labelEl.textContent=completed+' / '+total+' 페이지 완료';
  if(savedEl)savedEl.textContent=saved;
  if(failedEl)failedEl.textContent=failed;
  if(stepEl)stepEl.textContent=completed;
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
  document.getElementById('crawlStatusText').textContent='연결 중...';
  document.getElementById('crawlTimer').textContent='00:00';
  updateProgress(0,1,0,0);

  var liveLog=document.getElementById('crawlLiveLog');
  liveLog.textContent='';

  crawlStartTime=Date.now();
  if(crawlTimerInterval)clearInterval(crawlTimerInterval);
  crawlTimerInterval=setInterval(updateCrawlTimer,1000);

  var pollInterval=null;
  var lastLogTs=0;
  var gameSaved={};
  var cardsInited=false;

  function appendLog(msg,color){
    var span=document.createElement('span');
    span.style.color=color||'#d4d4d4';
    span.textContent=msg+'\n';
    liveLog.appendChild(span);
    liveLog.scrollTop=liveLog.scrollHeight;
  }

  function handleLog(ev){
    if(ev.type==='progress'||ev.type==='session_ok'){
      updateProgress(ev.completedSteps||0,ev.totalSteps||1,ev.totalSaved||0,ev.totalFailed||0);
      appendLog(ev.message,'#d4d4d4');
    } else if(ev.type==='game'){
      setGameCardState(ev.gameIndex,'running',null);
      document.getElementById('crawlStatusText').textContent='['+ev.gameName+'] 크롤 중...';
      appendLog(ev.message,'#56b6c2');
    } else if(ev.type==='ok'){
      gameSaved[ev.gameIndex]=(gameSaved[ev.gameIndex]||0)+(ev.pageSaved||0);
      setGameCardState(ev.gameIndex,ev.page>=ev.totalPages?'ok':'running',gameSaved[ev.gameIndex]);
      updateProgress(ev.completedSteps,ev.totalSteps,ev.totalSaved,ev.totalFailed);
      appendLog(ev.message,'#6fcf97');
    } else if(ev.type==='warn'){
      setGameCardState(ev.gameIndex,'warn',gameSaved[ev.gameIndex]||0);
      updateProgress(ev.completedSteps,ev.totalSteps,ev.totalSaved,ev.totalFailed);
      appendLog(ev.message,'#f2c94c');
    } else if(ev.type==='fail'){
      setGameCardState(ev.gameIndex,'fail',gameSaved[ev.gameIndex]||0);
      updateProgress(ev.completedSteps,ev.totalSteps,ev.totalSaved,ev.totalFailed);
      appendLog(ev.message,'#eb5757');
    } else if(ev.type==='debug'){
      appendLog(ev.message,'#888');
    } else if(ev.type==='done'){
      updateProgress(ev.completedSteps||ev.totalSteps,ev.totalSteps||1,ev.totalSaved,ev.totalFailed);
      appendLog(ev.message,'#6fcf97');
    }
  }

  try{
    var body={gameIds:selectedIds,pages:pages,crawlDetail:withDetail};
    /* Firecrawl 키는 서버 Secrets에만 보관하며 브라우저 요청에 포함하지 않습니다.
       아래 필드는 사용자가 선택 입력한 기존 ScraperAPI 키가 있을 때만 전송합니다. */
    if(apiKey)body.scraperApiKey=apiKey;

    /* 1. 작업 시작 — 즉시 jobId 반환 */
    var startResp=await fetch('/api/admin/crawl/start',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify(body)
    });
    if(!startResp.ok){
      var errData=await startResp.json().catch(function(){return{};});
      throw new Error(errData.error||'시작 실패: '+startResp.status);
    }
    var startData=await startResp.json();
    var jobId=startData.jobId;
    document.getElementById('crawlStatusText').textContent='크롤링 시작됨 (서버 백그라운드 실행 중)...';
    appendLog('🚀 작업 시작: '+jobId,'#56b6c2');

    /* 2. 2초마다 polling */
    await new Promise(function(resolve,reject){
      pollInterval=setInterval(async function(){
        try{
          var r=await fetch('/api/admin/crawl/status/'+jobId+'?since='+lastLogTs,{credentials:'include'});
          if(!r.ok){reject(new Error('polling 실패: '+r.status));return;}
          var data=await r.json();

          /* 게임카드 초기화 (games 목록 받은 후 최초 1회) */
          if(!cardsInited&&data.games&&data.games.length>0){
            initGameCards(data.games);
            updateProgress(0,data.totalSteps||1,0,0);
            document.getElementById('crawlStatusText').textContent=
              '크롤링 중 (게임 '+data.totalGames+'개 × '+data.totalPages+'페이지)';
            cardsInited=true;
          }

          /* 새 로그만 처리 */
          if(data.logs&&data.logs.length>0){
            for(var i=0;i<data.logs.length;i++){
              handleLog(data.logs[i]);
              if(data.logs[i].ts>lastLogTs)lastLogTs=data.logs[i].ts;
            }
          }

          /* 완료 또는 실패 */
          if(data.status==='done'||data.status==='failed'){
            clearInterval(pollInterval);
            document.getElementById('crawlSpinner').style.display='none';
            var summary='✅ 완료: '+data.totalSaved+'개 저장';
            if(data.totalFailed>0)summary+=' / '+data.totalFailed+'개 실패';
            if(withDetail)summary+=' / 상세 '+data.detailFetched+'개';
            document.getElementById('crawlStatusText').textContent=summary;
            document.getElementById('crawlResult').style.display='block';
            document.getElementById('crawlResultSummary').textContent=summary;
            loadStats();
            loadProducts();
            resolve();
          }
        }catch(e2){reject(e2);}
      },2000);
    });

    clearInterval(crawlTimerInterval);
  }catch(e){
    if(pollInterval)clearInterval(pollInterval);
    clearInterval(crawlTimerInterval);
    appendLog('\n❌ 오류: '+e.message,'#eb5757');
    document.getElementById('crawlStatusText').textContent='크롤링 오류: '+e.message;
  }finally{
    document.getElementById('crawlBtn').disabled=false;
    document.getElementById('crawlSpinner').style.display='';
  }
}

async function snapshotImport(){
  var btn=document.getElementById('snapshotBtn');
  var statusEl=document.getElementById('snapshotStatus');
  btn.disabled=true;
  btn.textContent='\u23f3 \uac00\uc838\uc624\ub294 \uc911...';
  statusEl.style.display='block';
  statusEl.style.color='#555';
  statusEl.textContent='\uc11c\ubc84 \uc2a4\ub0c5\uc0f7 \ud30c\uc77c \ud30c\uc2f1 \uc911...';
  try{
    var r=await fetch('/api/admin/crawl/from-snapshots',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}});
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'\uc2e4\ud328');
    var lines=d.results.map(function(x){
      if(x.error)return '\u274c '+x.gameName+': '+x.error;
      return '\u2705 '+x.gameName+': \ud30c\uc2f1 '+x.parsed+'\uac1c \u2192 \uc800\uc7a5 '+x.saved+'\uac1c';
    });
    statusEl.style.color='#155724';
    statusEl.innerHTML='<b>\u2705 \uc644\ub8cc! \uc804\uccb4 '+d.totalSaved+'\uac1c \uc800\uc7a5</b><br><span style="font-size:12px;font-family:monospace;color:#444">'+lines.join('<br>')+'</span>';
    btn.textContent='\u26a1 \uc9c0\uae08 \ubc14\ub85c \uac00\uc838\uc624\uae30';
    loadStats();
    loadProducts();
  }catch(e){
    statusEl.style.color='#721c24';
    statusEl.textContent='\u274c \uc624\ub958: '+e.message;
    btn.textContent='\u26a1 \uc9c0\uae08 \ubc14\ub85c \uac00\uc838\uc624\uae30';
  }finally{
    btn.disabled=false;
  }
}

async function browserCrawl(){
  if(crawlGamesData.length===0)await initCrawlTab();
  if(crawlSelectedGames.size===0)crawlGamesData.forEach(function(g){crawlSelectedGames.add(g.id);});
  var selectedIds=Array.from(crawlSelectedGames);
  if(selectedIds.length===0){showToast('게임 목록을 불러올 수 없습니다. 잠시 후 다시 시도하세요.');return;}
  var pages=parseInt(document.getElementById('crawlPages').value)||1;

  var btn=document.getElementById('browserCrawlBtn');
  btn.disabled=true;
  document.getElementById('crawlStatus').style.display='block';
  document.getElementById('crawlResult').style.display='none';
  document.getElementById('crawlStatusText').textContent='브라우저 직접 수집 시작...';
  document.getElementById('crawlTimer').textContent='00:00';
  updateProgress(0,1,0,0);

  var liveLog=document.getElementById('crawlLiveLog');
  liveLog.textContent='';

  crawlStartTime=Date.now();
  if(crawlTimerInterval)clearInterval(crawlTimerInterval);
  crawlTimerInterval=setInterval(updateCrawlTimer,1000);

  function appendLog(msg,color){
    var span=document.createElement('span');
    span.style.color=color||'#d4d4d4';
    span.textContent=msg+'\n';
    liveLog.appendChild(span);
    liveLog.scrollTop=liveLog.scrollHeight;
  }

  var selectedGames=crawlGamesData.filter(function(g){return crawlSelectedGames.has(g.id);});
  var totalSteps=selectedGames.length*pages;
  var completedSteps=0;
  var totalSaved=0;
  var totalFailed=0;

  initGameCards(selectedGames.map(function(g){return g.name;}));
  updateProgress(0,totalSteps,0,0);

  var gameSaved={};

  async function fetchItemmaniaPage(gameId,page){
    var url='https://www.itemmania.com/sell/list.html?search_game='+gameId+'&page='+page;
    var proxyUrl='https://api.allorigins.win/get?url='+encodeURIComponent(url);
    var r=await fetch(proxyUrl,{signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw new Error('allorigins HTTP '+r.status);
    var d=await r.json();
    if(!d.contents)throw new Error('응답 비어있음');
    return d.contents;
  }

  function parseItemsFromHtml(html,gameFallback){
    var parser=new DOMParser();
    var doc=parser.parseFromString(html,'text/html');
    var items=[];
    doc.querySelectorAll('[data-tid]').forEach(function(el){
      var tid=el.getAttribute('data-tid');
      if(!tid||el.classList.contains('skeleton-item'))return;
      var gEl=el.querySelector('[data-search=game]');
      var sEl=el.querySelector('[data-search=server]');
      var catEl=el.querySelector('[data-search=goods]');
      var titleEl=el.querySelector('.kind_title')||el.querySelector('.tit')||el.querySelector('strong');
      var priceEl=el.querySelector('.price,.list_price,.cost')||el.querySelector('[class*=price]')||el.querySelector('[class*=cost]');
      var thumbEl=el.querySelector('img');
      var sellerEl=el.querySelector('.seller,.nick,[class*=seller],[class*=nick]');
      var aEl=el.querySelector('a[href*="view"]')||el.querySelector('a');
      var title=(titleEl&&titleEl.textContent.trim())||'';
      if(!title)return;
      var priceText=(priceEl&&priceEl.textContent.trim())||'';
      var price=parseInt(priceText.replace(/[^0-9]/g,''),10)||0;
      var detailHref=aEl?aEl.getAttribute('href'):'';
      var detailUrl=detailHref?(detailHref.startsWith('http')?detailHref:'https://www.itemmania.com'+detailHref):'';
      items.push({
        itemmaniaid:tid,
        title:title,
        price:price,
        gameName:(gEl&&gEl.textContent.trim())||gameFallback||'',
        serverName:(sEl&&(sEl.getAttribute('data-title')||sEl.textContent.trim()))||'',
        itemCategory:(catEl&&catEl.textContent.trim())||'',
        category:'sell',
        detailUrl:detailUrl,
        thumbnailUrl:(thumbEl&&(thumbEl.getAttribute('src')||thumbEl.getAttribute('data-src')))||'',
        sellerName:(sellerEl&&sellerEl.textContent.trim())||'',
      });
    });
    return items;
  }

  try{
    for(var gi=0;gi<selectedGames.length;gi++){
      var game=selectedGames[gi];
      setGameCardState(gi,'running',null);
      document.getElementById('crawlStatusText').textContent='['+game.name+'] 수집 중...';
      appendLog('['+game.name+'] 수집 시작...','#56b6c2');

      for(var page=1;page<=pages;page++){
        try{
          appendLog('  '+game.name+' '+page+'페이지 가져오는 중...','#888');
          var html=await fetchItemmaniaPage(game.id,page);
          var items=parseItemsFromHtml(html,game.name);
          appendLog('  파싱: '+items.length+'개 상품 발견','#888');

          if(items.length>0){
            var batchR=await fetch('/api/admin/crawl/batch',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              credentials:'include',
              body:JSON.stringify({products:items})
            });
            var batchD=await batchR.json();
            var saved=batchD.upserted||0;
            gameSaved[gi]=(gameSaved[gi]||0)+saved;
            totalSaved+=saved;
            setGameCardState(gi,page>=pages?'ok':'running',gameSaved[gi]);
            appendLog('  \u2705 '+game.name+' '+page+'\ud398\uc774\uc9c0: '+saved+'\uac1c \uc800\uc7a5','#6fcf97');
          }else{
            appendLog('  \u26a0 '+game.name+' '+page+'\ud398\uc774\uc9c0: \uc0c1\ud488 \uc5c6\uc74c (HTML '+html.length+'\ubc14\uc774\ud2b8)','#f2c94c');
            setGameCardState(gi,page>=pages?(gameSaved[gi]>0?'ok':'warn'):'running',gameSaved[gi]||0);
          }
        }catch(pageErr){
          totalFailed++;
          appendLog('  \u274c '+game.name+' '+page+'\ud398\uc774\uc9c0 \uc624\ub958: '+pageErr.message,'#eb5757');
          setGameCardState(gi,'fail',gameSaved[gi]||0);
        }
        completedSteps++;
        updateProgress(completedSteps,totalSteps,totalSaved,totalFailed);
        if(page<pages)await new Promise(function(rr){setTimeout(rr,1000);});
      }
      if(gi<selectedGames.length-1)await new Promise(function(rr){setTimeout(rr,500);});
    }

    clearInterval(crawlTimerInterval);
    document.getElementById('crawlSpinner').style.display='none';
    var summary='\u2705 \uc644\ub8cc: '+totalSaved+'\uac1c \uc800\uc7a5';
    if(totalFailed>0)summary+=' / '+totalFailed+'\uac1c \uc2e4\ud328';
    document.getElementById('crawlStatusText').textContent=summary;
    document.getElementById('crawlResult').style.display='block';
    document.getElementById('crawlResultSummary').textContent=summary;
    appendLog('\n'+summary,'#6fcf97');
    loadStats();
    loadProducts();
  }catch(e){
    clearInterval(crawlTimerInterval);
    appendLog('\n\u274c \uc624\ub958: '+e.message,'#eb5757');
    document.getElementById('crawlStatusText').textContent='\uc624\ub958: '+e.message;
  }finally{
    btn.disabled=false;
    document.getElementById('crawlSpinner').style.display='';
  }
}

function fmtDate(d){if(!d)return'-';return new Date(d).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function fmtMoney(n){if(n==null)return'-';return Number(n).toLocaleString('ko-KR')+'원';}
function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

async function loadStats(){
  try{
    var r=await fetch('/api/admin/stats',{credentials:'include',cache:'no-store'});
    if(!r.ok)return;
    var s=await r.json();
    document.getElementById('statUsers').textContent=s.users;
    document.getElementById('statProducts').textContent=s.products;
    document.getElementById('statOrders').textContent=s.orders;
  }catch(e){}
}

async function loadAll(){
  loadedTabs['products']=true;
  await Promise.all([loadStats(),loadProducts()]);
}

// ── 상품 ─────────────────────────────────────────────────
async function loadProducts(page){
  if(page!==undefined)currentProductsPage=page;
  var tbody=document.getElementById('productsBody');
  tbody.innerHTML='<tr class="empty-row"><td colspan="9">로딩 중...</td></tr>';
  var cat=document.getElementById('prodCategoryFilter').value;
  var st=document.getElementById('prodStatusFilter').value;
  var params='page='+currentProductsPage+'&limit=10';
  if(cat)params+='&category='+cat;
  if(st)params+='&status='+st;
  var url='/api/admin/products?'+params;
  try{
    var r=await fetch(url,{credentials:'include',cache:'no-store'});
    if(!r.ok)throw new Error('상품 목록을 불러오지 못했습니다.');
    var data=await r.json();
    var products=Array.isArray(data)?data:(data.products||[]);
    var total=data.total||products.length;
    totalProductsPages=data.totalPages||1;
    currentProductsPage=data.page||currentProductsPage;
    if(!products.length&&currentProductsPage>1){
      currentProductsPage=Math.max(1,Math.min(currentProductsPage-1,data.totalPages||1));
      return loadProducts();
    }
    document.getElementById('statProducts').textContent=total;
    if(!products.length){tbody.innerHTML='<tr class="empty-row"><td colspan="9">상품이 없습니다</td></tr>';renderProductsPagination(0);return;}
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
          +'<button class="action-btn delete" onclick="deleteProduct('+p.id+','+(p.status==='inactive')+')">삭제</button>'
        +'</td>'
        +'</tr>';
    }).join('');
    renderProductsPagination(total);
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="9">오류 발생</td></tr>';}
}

function renderProductsPagination(total){
  var existing=document.getElementById('productsPagination');
  if(existing)existing.remove();
  if(totalProductsPages<=1)return;
  var wrap=document.createElement('div');
  wrap.id='productsPagination';
  wrap.style='display:flex;align-items:center;gap:4px;justify-content:center;margin-top:14px;flex-wrap:wrap';
  function btn(label,pg,disabled,active){
    var b=document.createElement('button');
    b.textContent=label;
    b.style='min-width:34px;height:32px;border-radius:6px;border:1px solid '+(active?'#159EFD':'#ddd')+';background:'+(active?'#159EFD':'#fff')+';color:'+(active?'#fff':'#333')+';font-size:13px;font-weight:'+(active?'700':'400')+';cursor:'+(disabled?'default':'pointer')+';opacity:'+(disabled?'0.4':'1');
    if(!disabled)b.onclick=function(){loadProducts(pg);};
    return b;
  }
  wrap.appendChild(btn('‹',currentProductsPage-1,currentProductsPage<=1,false));
  var start=Math.max(1,currentProductsPage-2);
  var end=Math.min(totalProductsPages,start+4);
  if(end-start<4)start=Math.max(1,end-4);
  if(start>1){wrap.appendChild(btn('1',1,false,false));if(start>2){var sp=document.createElement('span');sp.textContent='…';sp.style='padding:0 4px;color:#888';wrap.appendChild(sp);}}
  for(var i=start;i<=end;i++){wrap.appendChild(btn(String(i),i,false,i===currentProductsPage));}
  if(end<totalProductsPages){if(end<totalProductsPages-1){var sp2=document.createElement('span');sp2.textContent='…';sp2.style='padding:0 4px;color:#888';wrap.appendChild(sp2);}wrap.appendChild(btn(String(totalProductsPages),totalProductsPages,false,false));}
  wrap.appendChild(btn('›',currentProductsPage+1,currentProductsPage>=totalProductsPages,false));
  var info=document.createElement('span');
  info.style='margin-left:8px;font-size:12px;color:#888';
  info.textContent=currentProductsPage+' / '+totalProductsPages+' 페이지 (총 '+total+'개)';
  wrap.appendChild(info);
  var table=document.querySelector('#tab-products .data-table');
  if(table)table.parentNode.insertBefore(wrap,table.nextSibling);
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
    loadProducts(1);
  }catch(e){showToast('서버 오류');btn.disabled=false;}
}

var deletingProducts={};
async function deleteProduct(id,fromInactive){
  if(deletingProducts[id])return;
  var message=fromInactive
    ?'비활성 상품을 관리자 목록에서 삭제하시겠습니까?\n원본 상품·거래·채팅·정산 기록은 보존됩니다.'
    :'이 상품을 삭제하시겠습니까?\n거래 기록이 있는 글은 거래 내역 보호를 위해 비활성화됩니다.';
  if(!confirm(message))return;
  deletingProducts[id]=true;
  var row=document.getElementById('prod-'+id);
  var buttons=row?row.querySelectorAll('.action-btn'):[];
  buttons.forEach(function(b){b.disabled=true;});
  try{
    var r=await fetch('/api/admin/products/'+id+(fromInactive?'/list-entry':''),{method:'DELETE',credentials:'include'});
    var d=await r.json().catch(function(){return {}});
    if(!r.ok||!d.ok||(fromInactive&&(!d.hidden||!d.preserved)))throw new Error(d.error||'삭제 실패');
    showToast(fromInactive?'관리자 목록에서 삭제했습니다. 원본 및 거래 기록은 보존됩니다.'
      :(d.archived?'거래 기록을 보존하며 글을 비활성화했습니다.':'🗑 상품이 삭제되었습니다'));
    await loadProducts(currentProductsPage);
  }catch(e){
    showToast('오류: '+(e.message||'삭제 요청을 전송하지 못했습니다. 다시 시도해 주세요.'));
    buttons.forEach(function(b){b.disabled=false;});
  }finally{delete deletingProducts[id];}
}

async function deleteNoGradeProducts(){
  if(!confirm('등급 없는 상품을 전부 삭제하시겠습니까?\n거래 기록이 없는 글은 영구 삭제되고, 거래 기록이 있는 글은 비활성화되어 이력이 보존됩니다.'))return;
  try{
    var r=await fetch('/api/admin/products/no-grade',{method:'DELETE',credentials:'include'});
    var d=await r.json().catch(function(){return {}});
    if(!r.ok){showToast('오류: '+(d.error||'삭제 실패'));return;}
    showToast('등급없는 상품 '+d.deleted+'개 삭제, 거래 이력 있는 '+(d.archived||0)+'개 비활성화 완료');
    loadProducts(1);
    loadStats();
  }catch(e){showToast('삭제 요청을 전송하지 못했습니다. 다시 시도해 주세요.');}
}

// ── 회원 ─────────────────────────────────────────────────
var adminUsersById=Object.create(null);
var registrationPolicyBlocked=null;
var registrationPolicyLoading=false;
var registrationPolicyPending=false;
var registrationPolicyError='';
var registrationPolicyRequestId=0;

function renderRegistrationPolicy(){
  var button=document.getElementById('registrationPolicyToggle');
  var status=document.getElementById('registrationPolicyStatus');
  if(!button||!status)return;
  var retry=document.getElementById('registrationPolicyRetry');
  var known=typeof registrationPolicyBlocked==='boolean';
  button.disabled=!known||registrationPolicyLoading||registrationPolicyPending||!!registrationPolicyError;
  button.setAttribute('aria-checked',known?String(registrationPolicyBlocked):'false');
  button.textContent=known?(registrationPolicyBlocked?'ON':'OFF'):'—';
  button.setAttribute('aria-label','신규 회원 가입 차단: '+(known?(registrationPolicyBlocked?'ON, 차단':'OFF, 허용'):'상태 확인 중'));
  status.classList.toggle('error',!!registrationPolicyError);
  if(retry)retry.hidden=!registrationPolicyError;
  if(registrationPolicyPending)status.textContent='저장 중...';
  else if(registrationPolicyLoading)status.textContent='상태 확인 중...';
  else if(registrationPolicyError)status.textContent=registrationPolicyError;
  else if(known)status.textContent='현재 상태: '+(registrationPolicyBlocked?'ON (차단)':'OFF (허용)');
  else status.textContent='상태를 확인할 수 없습니다.';
}

async function loadRegistrationPolicy(){
  if(registrationPolicyPending)return;
  var requestId=++registrationPolicyRequestId;
  registrationPolicyLoading=true;
  registrationPolicyError='';
  renderRegistrationPolicy();
  try{
    var r=await fetch('/api/admin/registration-policy',{credentials:'include',cache:'no-store'});
    var data=await r.json().catch(function(){return {};});
    if(!r.ok)throw new Error(data.error||'가입 정책을 불러오지 못했습니다. ('+r.status+')');
    if(typeof data.blocked!=='boolean')throw new Error('가입 정책 응답을 확인할 수 없습니다.');
    if(requestId===registrationPolicyRequestId)registrationPolicyBlocked=data.blocked;
  }catch(e){
    if(requestId===registrationPolicyRequestId)registrationPolicyError=e.message||'가입 정책을 불러오지 못했습니다.';
  }finally{
    if(requestId===registrationPolicyRequestId){
      registrationPolicyLoading=false;
      renderRegistrationPolicy();
    }
  }
}

async function toggleRegistrationPolicy(){
  if(typeof registrationPolicyBlocked!=='boolean'||registrationPolicyLoading||registrationPolicyPending)return;
  var savedState=registrationPolicyBlocked;
  var requestedState=!savedState;
  ++registrationPolicyRequestId;
  registrationPolicyLoading=false;
  registrationPolicyPending=true;
  registrationPolicyError='';
  renderRegistrationPolicy();
  try{
    var r=await fetch('/api/admin/registration-policy',{
      method:'PATCH',
      credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({blocked:requestedState})
    });
    var data=await r.json().catch(function(){return {};});
    if(!r.ok)throw new Error(data.error||'가입 정책을 저장하지 못했습니다. ('+r.status+')');
    if(typeof data.blocked==='boolean'&&data.blocked!==requestedState)throw new Error('저장된 가입 정책이 요청한 상태와 다릅니다.');
    registrationPolicyBlocked=typeof data.blocked==='boolean'?data.blocked:requestedState;
  }catch(e){
    registrationPolicyBlocked=savedState;
    registrationPolicyError=e.message||'가입 정책을 저장하지 못했습니다.';
  }finally{
    registrationPolicyPending=false;
    renderRegistrationPolicy();
  }
}

function refreshUsers(){
  loadUsers();
  loadRegistrationPolicy();
}

window.addEventListener('focus',function(){
  if(currentTab==='users'&&document.visibilityState!=='hidden')loadRegistrationPolicy();
});

async function loadUsers(){
  var tbody=document.getElementById('usersBody');
  tbody.innerHTML='<tr class="empty-row"><td colspan="11">로딩 중...</td></tr>';
  try{
    var includeDeleted=document.getElementById('usersIncludeDeleted').checked;
    var r=await fetch('/api/admin/users?limit=100'+(includeDeleted?'&includeDeleted=1':''),{credentials:'include',cache:'no-store'});
    if(!r.ok)throw new Error('회원 목록을 불러오지 못했습니다.');
    var users=await r.json();
    adminUsersById=Object.create(null);
    users.forEach(function(u){adminUsersById[u.id]=u});
    if(!users.length){tbody.innerHTML='<tr class="empty-row"><td colspan="11">회원이 없습니다</td></tr>';return;}
    tbody.innerHTML=users.map(function(u){
      var delBtn=u.deletedAt?'삭제됨':u.role!=='admin'
        ?'<button class="action-btn delete" onclick="deleteUser('+u.id+')">삭제</button>'
        :'-';
      var authBtn='<button class="action-btn auth" onclick="openAuthModal('+u.id+','+JSON.stringify(u.nickname||u.email).replace(/"/g,'&quot;')+')">인증</button>';
      var milBtn='<button class="action-btn edit" onclick="openBalanceModal('+u.id+','+JSON.stringify(u.nickname||u.email).replace(/"/g,'&quot;')+','+(u.balance||0)+')">💰</button>';
      var editBtn='<button class="action-btn" style="background:#f0f4ff;color:#5a5fc7" onclick="openUserEditModal('+JSON.stringify(u).replace(/"/g,'&quot;')+')">수정</button>';
      var passwordBtn=u.deletedAt||u.suspendedAt||u.role==='admin'?'':'<button class="action-btn" onclick="openUserPasswordModal('+u.id+')">비밀번호 관리</button>';
      var ipRow=function(label,ip,kind){
        return '<div style="white-space:nowrap">'+label+': <code>'+escHtml(ip||'미기록')+'</code>'
          +(ip? " <button class=\"action-btn\" onclick=\"blockMemberIp("+u.id+",'"+kind+"')\">이 IP 차단</button>":'')+'</div>';
      };
      var accountBtn=u.deletedAt||u.role==='admin'?'-':'<button class="action-btn '+(u.suspendedAt?'edit':'delete')+'" onclick="setMemberSuspension('+u.id+','+(!u.suspendedAt)+')">'+(u.suspendedAt?'차단 해제':'계정 차단')+'</button>';
      return '<tr id="user-row-'+u.id+'">'
        +'<td>'+u.id+'</td>'
        +'<td>'+escHtml(u.email)+'</td>'
        +'<td id="user-nick-'+u.id+'">'+escHtml(u.nickname||'-')+'</td>'
        +'<td id="user-phone-'+u.id+'">'+escHtml(u.phone||'-')+'</td>'
        +'<td id="user-grade-'+u.id+'">'+(function(g){var m={vip:['#7B5CAA','V'],platinum:['#E84060','P'],gold:['#D4941C','G'],silver:['#9B9EA4','S'],bronze:['#5CB85C','B']};var e=g?m[g]:null;return e?'<svg width="22" height="26" viewBox="0 0 22 26" xmlns="http://www.w3.org/2000/svg" title="'+g.toUpperCase()+'"><polygon points="11,0 22,6.5 22,19.5 11,26 0,19.5 0,6.5" fill="'+e[0]+'"/><text x="11" y="19" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Arial,Helvetica,sans-serif">'+e[1]+'</text></svg>':'-';})(u.grade)+'</td>'
        +'<td id="user-bal-'+u.id+'">'+fmtMoney(u.balance)+'</td>'
        +'<td>'+fmtDate(u.createdAt)+'</td>'
        +'<td>'+ipRow('가입',u.signupIp,'signup')+ipRow('최근 로그인',u.lastLoginIp,'login')+'</td>'
        +'<td>'+(u.deletedAt?'<strong style="color:#b42318">삭제됨 (기록 보존)</strong>':u.suspendedAt?'<strong style="color:#b42318">차단됨</strong>':'정상')+'<br>'+accountBtn+'</td>'
        +'<td>'+(u.deletedAt?'-':editBtn+milBtn+authBtn+passwordBtn)+'</td>'
        +'<td>'+delBtn+'</td>'
        +'</tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="11">회원 목록을 불러오지 못했습니다.</td></tr>';}
}

async function setMemberSuspension(id,suspended){
  var u=adminUsersById[id];if(!u||u.role==='admin')return;
  if(!confirm((suspended?'계정 차단':'계정 차단 해제')+' — '+(u.nickname||u.email)+'\\n'+(suspended?'현재 로그인된 세션도 곧 접근할 수 없게 됩니다. IP 차단은 별도로 적용해야 합니다.':'다시 로그인할 수 있게 됩니다.')+' 계속할까요?'))return;
  try{
    var r=await fetch('/api/admin/users/'+id+'/suspension',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({suspended:suspended})});
    var data=await r.json().catch(function(){return {}});
    if(!r.ok)throw new Error(data.error||'계정 상태 변경에 실패했습니다.');
    await loadUsers();
    showToast(suspended?'계정을 차단했습니다.':'계정 차단을 해제했습니다.');
  }catch(e){showToast(e.message||'계정 상태를 변경하지 못했습니다.')}
}

async function blockMemberIp(id,kind){
  var u=adminUsersById[id];if(!u)return;
  var ip=kind==='signup'?u.signupIp:kind==='login'?u.lastLoginIp:null;
  if(!ip||!isValidIpAddress(ip)){showToast('이 회원의 IP가 기록되지 않았습니다.');return}
  if(!confirm('IP '+ip+'를 차단할까요? 같은 IP를 사용하는 다른 사람도 차단됩니다. 이 회원의 계정이나 다른 IP는 차단되지 않습니다.'))return;
  var reason=prompt('차단 사유를 입력하세요.', '회원 #'+id+' 관련');
  if(reason===null)return;
  try{
    var r=await fetch('/api/admin/ip-blocks',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({ip:ip,reason:reason.trim()})});
    var data=await r.json().catch(function(){return {}});
    if(!r.ok)throw new Error(data.error||'IP 차단에 실패했습니다.');
    await loadIpBlocks();
    showToast('IP를 차단했습니다.');
  }catch(e){showToast(e.message||'IP를 차단하지 못했습니다.')}
}

async function deleteUser(id){
  if(!confirm('이 회원을 삭제하시겠습니까? 로그인은 해제되고 회원 목록에서 제외됩니다. 잔액·정산·거래·대화 기록은 보존됩니다. 진행 중인 거래나 대기 출금이 있으면 먼저 처리해야 합니다.'))return;
  try{
    var r=await fetch('/api/admin/users/'+id,{method:'DELETE',credentials:'include'});
    var d=await r.json();
    if(!r.ok){showToast('오류: '+(d.error||'삭제 실패'));return;}
    showToast(d.message||'회원이 삭제되었습니다. 기록은 보존됩니다.');
    await loadUsers();
    loadStats();
  }catch(e){showToast('서버 오류');}
}

var userPasswordBusy=false;
function openUserPasswordModal(id){
  if(userPasswordBusy)return;
  var u=adminUsersById[id];if(!u||u.role==='admin'||u.deletedAt||u.suspendedAt)return;
  document.getElementById('userPasswordId').value=id;
  document.getElementById('userPasswordMember').textContent=(u.nickname||'회원')+' / '+u.email+' (#'+id+')';
  document.getElementById('userPasswordVerified').checked=false;
  document.getElementById('userPasswordAdmin').value='';
  document.getElementById('userPasswordIssued').value='';
  document.getElementById('userPasswordErr').textContent='';
  document.getElementById('userPasswordResult').style.display='none';
  document.getElementById('userPasswordResetBtn').style.display='';
  document.getElementById('userPasswordModal').classList.add('open');
}
function closeUserPasswordModal(){
  if(userPasswordBusy)return;
  document.getElementById('userPasswordAdmin').value='';
  document.getElementById('userPasswordIssued').value='';
  document.getElementById('userPasswordId').value='';
  document.getElementById('userPasswordModal').classList.remove('open');
}
async function viewMemberPassword(){
  if(userPasswordBusy)return;
  var err=document.getElementById('userPasswordErr'),pw=document.getElementById('userPasswordAdmin');
  err.textContent='';
  document.getElementById('userPasswordIssued').value='';
  document.getElementById('userPasswordResult').style.display='none';
  if(!pw.value){err.textContent='관리자 본인의 비밀번호를 입력하세요.';return}
  userPasswordBusy=true;
  var btn=document.getElementById('userPasswordViewBtn'),close=document.getElementById('userPasswordCloseBtn'),reset=document.getElementById('userPasswordResetBtn');
  btn.disabled=true;close.disabled=true;reset.disabled=true;
  try{
    var r=await fetch('/api/admin/users/'+document.getElementById('userPasswordId').value+'/password-view',{
      method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({adminPassword:pw.value})
    });
    var data=await r.json();
    if(!r.ok)throw new Error(data.error||'비밀번호를 조회하지 못했습니다.');
    if(data.password===null){err.textContent='저장된 원문이 없습니다. 기존 해시는 복원할 수 없으며, 이후 비밀번호 변경·재설정 시 저장됩니다.';return}
    document.getElementById('userPasswordIssued').value=data.password;
    document.getElementById('userPasswordResult').style.display='block';
  }catch(e){err.textContent=e.message||'비밀번호를 조회하지 못했습니다.'}
  finally{pw.value='';userPasswordBusy=false;btn.disabled=false;close.disabled=false;reset.disabled=false}
}
async function issueMemberPassword(){
  if(userPasswordBusy)return;
  var err=document.getElementById('userPasswordErr'),pw=document.getElementById('userPasswordAdmin');
  err.textContent='';
  if(!document.getElementById('userPasswordVerified').checked){err.textContent='회원 본인 확인을 먼저 완료해 주세요.';return}
  if(!pw.value){err.textContent='관리자 본인의 비밀번호를 입력하세요.';return}
  if(!confirm('이 회원의 기존 비밀번호와 로그인 세션을 무효화하고 새 임시 비밀번호를 발급할까요?'))return;
  userPasswordBusy=true;
  var btn=document.getElementById('userPasswordResetBtn'),close=document.getElementById('userPasswordCloseBtn');
  btn.disabled=true;close.disabled=true;document.getElementById('userPasswordViewBtn').disabled=true;btn.textContent='발급 중…';
  try{
    var r=await fetch('/api/admin/users/'+document.getElementById('userPasswordId').value+'/password-reset',{
      method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({identityVerified:true,adminPassword:pw.value})
    });
    var data=await r.json();
    if(!r.ok)throw new Error(data.error||'임시 비밀번호를 발급하지 못했습니다.');
    document.getElementById('userPasswordIssued').value=data.temporaryPassword;
    document.getElementById('userPasswordResult').style.display='block';
    btn.style.display='none';
  }catch(e){err.textContent=e.message||'발급 결과를 확인하지 못했습니다. 상태를 확인한 뒤 다시 발급해 주세요.'}
  finally{pw.value='';userPasswordBusy=false;btn.disabled=false;close.disabled=false;document.getElementById('userPasswordViewBtn').disabled=false;btn.textContent='임시 비밀번호 발급'}
}
async function copyPasswordText(value,input){
  try{await navigator.clipboard.writeText(value);showToast('복사했습니다.')}
  catch(e){if(input){input.focus();input.select();showToast('복사 권한이 없습니다. 선택된 내용을 직접 복사해 주세요.')}else{showToast('주소: '+value)}}
}
function copyIssuedPassword(){var input=document.getElementById('userPasswordIssued');if(input.value)copyPasswordText(input.value,input)}
function copyPasswordChangeLink(){copyPasswordText(location.origin+'/member-password')}

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
  tbody.innerHTML='<tr class="empty-row"><td colspan="8">로딩 중...</td></tr>';
  var status=document.getElementById('orderStatusFilter').value;
  var params=new URLSearchParams();
  if(status)params.set('status',status);
  if(document.getElementById('ordersIncludeDeleted').checked)params.set('includeDeleted','1');
  var url='/api/admin/orders'+(params.toString()?'?'+params.toString():'');
  try{
    var r=await fetch(url,{credentials:'include'});
    var orders=await r.json();
    if(!r.ok||!Array.isArray(orders))throw new Error(orders.error||'주문을 불러오지 못했습니다.');
    document.getElementById('statOrders').textContent=orders.length;
    if(!orders.length){tbody.innerHTML='<tr class="empty-row"><td colspan="8">주문이 없습니다</td></tr>';return;}
    tbody.innerHTML=orders.map(function(o){
      var sl={pending:'거래대기',shipped:'인계완료',confirmed:'인수확인',completed:'완료',cancelled:'취소됨',disputed:'분쟁'}[o.status]||o.status;
      var action=o.adminDeletedAt
        ?'<span class="badge" title="'+escHtml(fmtDate(o.adminDeletedAt))+'">삭제됨 (기록 보존)</span>'
          +(o.canHide?'<br><button class="action-btn delete" id="hide-order-'+o.id+'" onclick="hideOrder('+o.id+')">목록에서 제거</button>':'')
        :o.canDelete
          ?'<button class="action-btn delete" id="delete-order-'+o.id+'" onclick="deleteOrder('+o.id+')">삭제</button>'
          :'<button class="action-btn delete" disabled title="완료 또는 취소된 주문만 삭제할 수 있습니다">삭제 불가</button>';
      return '<tr id="order-'+o.id+'">'
        +'<td>'+o.id+'</td>'
        +'<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(o.productTitle||'-')+'</td>'
        +'<td>'+o.buyerId+'</td>'
        +'<td>'+o.sellerId+'</td>'
        +'<td>'+fmtMoney(o.amount)+'</td>'
        +'<td><span class="badge '+o.status+'">'+sl+'</span></td>'
        +'<td>'+fmtDate(o.createdAt)+'</td>'
        +'<td>'+action+'</td>'
        +'</tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="8">'+escHtml(e.message||'오류 발생')+'</td></tr>';}
}

async function deleteOrder(id){
  if(!confirm('주문 #'+id+'을 관리자 목록에서 삭제하시겠습니까?\n정산·회원 잔액·연결된 거래 및 대화 기록은 보존됩니다.'))return;
  var btn=document.getElementById('delete-order-'+id);
  if(btn)btn.disabled=true;
  try{
    var response=await fetch('/api/admin/orders/'+id,{method:'DELETE',credentials:'include'});
    var result=await response.json();
    if(!response.ok)throw new Error(result.error||'주문 삭제 실패');
    showToast('주문을 관리자 목록에서 삭제했습니다. 정산·거래 기록은 보존됩니다.');
    await loadOrders();
  }catch(error){
    showToast(error.message||'서버 오류');
    if(btn)btn.disabled=false;
  }
}

async function hideOrder(id){
  if(!confirm('삭제된 주문 #'+id+'을 주문관리 목록에서 제거하시겠습니까?\n이후에는 “삭제된 항목 포함”을 선택해도 표시되지 않습니다.\n주문 원본·정산·회원 잔액·연결된 거래 및 대화 기록은 보존됩니다.'))return;
  var btn=document.getElementById('hide-order-'+id);
  if(btn)btn.disabled=true;
  try{
    var response=await fetch('/api/admin/orders/'+id+'/list-entry',{method:'DELETE',credentials:'include'});
    var result=await response.json();
    if(!response.ok)throw new Error(result.error||'목록 제거 실패');
    showToast('삭제된 주문을 목록에서 제거했습니다. 거래·정산 기록은 보존됩니다.');
    await loadOrders();
  }catch(error){
    showToast(error.message||'서버 오류');
    if(btn)btn.disabled=false;
  }
}

// ── 채팅 거래 ─────────────────────────────────────────────
async function loadChatRooms(){
  var tbody=document.getElementById('chatroomsBody');
  if(!tbody)return;
  tbody.innerHTML='<tr class="empty-row"><td colspan="8">로딩 중...</td></tr>';
  var statusFilter=document.getElementById('chatroomStatusFilter').value;
  var params=new URLSearchParams();
  if(statusFilter)params.set('status',statusFilter);
  if(document.getElementById('chatroomsIncludeDeleted').checked)params.set('includeDeleted','1');
  var url='/api/admin/chat-rooms'+(params.toString()?'?'+params.toString():'');
  try{
    var r=await fetch(url,{credentials:'include',cache:'no-store'});
    var rooms=await r.json();
    if(!r.ok||!Array.isArray(rooms))throw new Error(rooms.error||'채팅 거래를 불러오지 못했습니다.');
    if(!rooms.length){tbody.innerHTML='<tr class="empty-row"><td colspan="8">채팅 거래가 없습니다</td></tr>';return;}
    var filtered=statusFilter?rooms.filter(function(rm){return rm.status===statusFilter;}):rooms;
    if(!filtered.length){tbody.innerHTML='<tr class="empty-row"><td colspan="8">해당 상태의 거래가 없습니다</td></tr>';return;}
    var statusLabel={pending:'거래대기',active:'진행중',handover:'인계완료',ended:'거래완료',cancelled:'취소',rejected:'거래불가'};
    tbody.innerHTML=filtered.map(function(rm){
      var sl=statusLabel[rm.status]||rm.status;
      return '<tr>'
        +'<td>'+rm.id+'</td>'
        +'<td>'+escHtml(rm.sellerNickname||String(rm.sellerId))+'</td>'
        +'<td>'+escHtml(rm.buyerNickname||String(rm.buyerId))+'</td>'
        +'<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escHtml(rm.productTitle||'-')+'</td>'
        +'<td>'+(rm.amount!=null?fmtMoney(rm.amount):'-')+'</td>'
        +'<td><span class="badge '+rm.status+'">'+sl+'</span></td>'
        +'<td>'+fmtDate(rm.createdAt)+'</td>'
        +'<td>'+(rm.adminDeletedAt
          ?'<span class="badge" title="'+escHtml(fmtDate(rm.adminDeletedAt))+'">삭제됨 (기록 보존)</span>'
            +(rm.canHide?'<br><button class="action-btn delete" id="hide-chatroom-'+rm.id+'" onclick="hideChatRoom('+rm.id+')">목록에서 제거</button>':'')
          :rm.canDelete
          ?'<button class="action-btn delete" id="delete-chatroom-'+rm.id+'" onclick="deleteChatRoom('+rm.id+')">삭제</button>'
          :'<button class="action-btn delete" disabled title="주문에 연결된 진행 중인 거래는 종료 후 삭제할 수 있습니다">삭제 불가</button>')+'</td>'
        +'</tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="8">'+escHtml(e.message||'오류 발생')+'</td></tr>';}
}

async function deleteChatRoom(id){
  if(!confirm('채팅거래 #'+id+'을 관리자 목록에서 삭제하시겠습니까?\n회원의 대화 기록·주문·정산·잔액은 보존됩니다.'))return;
  var btn=document.getElementById('delete-chatroom-'+id);
  if(btn)btn.disabled=true;
  try{
    var r=await fetch('/api/admin/chat-rooms/'+id,{method:'DELETE',credentials:'include'});
    var d=await r.json().catch(function(){return {}});
    if(!r.ok){showToast('오류: '+(d.error||'삭제 실패'));loadChatRooms();return;}
    showToast('채팅거래를 관리자 목록에서 삭제했습니다. 대화·정산 기록은 보존됩니다.');
    loadChatRooms();
  }catch(e){
    showToast('삭제 요청을 전송하지 못했습니다. 다시 시도해 주세요.');
    loadChatRooms();
  }
}

async function hideChatRoom(id){
  if(!confirm('삭제된 채팅거래 #'+id+'을 채팅거래 목록에서 제거하시겠습니까?\n이후에는 “삭제된 항목 포함”을 선택해도 표시되지 않습니다.\n회원의 대화·거래·정산·잔액 및 원래 삭제 기록은 보존됩니다.'))return;
  var btn=document.getElementById('hide-chatroom-'+id);
  if(btn)btn.disabled=true;
  try{
    var response=await fetch('/api/admin/chat-rooms/'+id+'/list-entry',{method:'DELETE',credentials:'include'});
    var result=await response.json();
    if(!response.ok)throw new Error(result.error||'목록 제거 실패');
    showToast('삭제된 채팅거래를 목록에서 제거했습니다. 대화·거래·정산 기록은 보존됩니다.');
    await loadChatRooms();
  }catch(error){
    showToast(error.message||'목록 제거 실패');
    if(btn)btn.disabled=false;
  }
}

// ── IP 차단 ─────────────────────────────────────────────────
function isValidIpv4(value){
  var parts=value.split('.');
  return parts.length===4&&parts.every(function(part){
    return /^(0|[1-9]\d{0,2})$/.test(part)&&Number(part)<=255;
  });
}

function isValidIpAddress(value){
  if(!value||value.indexOf('/')!==-1||value.indexOf('%')!==-1)return false;
  if(value.indexOf(':')===-1)return isValidIpv4(value);

  var address=value;
  if(address.indexOf('.')!==-1){
    var lastColon=address.lastIndexOf(':');
    if(lastColon<0||!isValidIpv4(address.slice(lastColon+1)))return false;
    address=address.slice(0,lastColon+1)+'0:0';
  }
  var compression=address.indexOf('::');
  if(compression!==-1&&compression!==address.lastIndexOf('::'))return false;
  function validGroups(groups){
    return groups.every(function(group){return /^[0-9a-f]{1,4}$/i.test(group);});
  }
  if(compression!==-1){
    var halves=address.split('::');
    var left=halves[0]?halves[0].split(':'):[];
    var right=halves[1]?halves[1].split(':'):[];
    return validGroups(left)&&validGroups(right)&&left.length+right.length<8;
  }
  var groups=address.split(':');
  return groups.length===8&&validGroups(groups);
}

function setIpBlockMessage(message,isError){
  var el=document.getElementById('ipBlocksMessage');
  if(!el)return;
  el.textContent=message||'';
  el.style.color=isError?'#c53030':'#276749';
}

function renderIpBlocks(items){
  var tbody=document.getElementById('ipBlocksBody');
  if(!Array.isArray(items)){
    tbody.innerHTML='<tr class="empty-row"><td colspan="4">차단 목록 응답을 확인할 수 없습니다.</td></tr>';
    return;
  }
  if(!items.length){
    tbody.innerHTML='<tr class="empty-row"><td colspan="4">차단된 IP가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML=items.map(function(item){
    var id=Number(item&&item.id);
    var action=Number.isSafeInteger(id)&&id>0
      ?'<button class="action-btn delete" type="button" onclick="unblockIpBlock('+id+')">차단 해제</button>'
      :'<span style="color:#999">해제 불가</span>';
    var reason=item&&item.reason!=null?escHtml(String(item.reason)):'-';
    var createdAt=item&&item.createdAt?fmtDate(item.createdAt):'-';
    if(createdAt==='Invalid Date')createdAt='-';
    return '<tr>'
      +'<td><code>'+escHtml(String(item&&item.ip||'-'))+'</code></td>'
      +'<td>'+reason+'</td>'
      +'<td>'+escHtml(createdAt)+'</td>'
      +'<td>'+action+'</td>'
      +'</tr>';
  }).join('');
}

async function loadIpBlocks(){
  var tbody=document.getElementById('ipBlocksBody');
  var currentIpEl=document.getElementById('ipBlocksCurrentIp');
  if(!tbody)return;
  tbody.innerHTML='<tr class="empty-row"><td colspan="4">차단 목록을 불러오는 중...</td></tr>';
  setIpBlockMessage('',false);
  try{
    var r=await fetch('/api/admin/ip-blocks',{credentials:'include',cache:'no-store'});
    var data=await r.json().catch(function(){return{};});
    if(!r.ok)throw new Error(data.error||'차단 목록을 불러오지 못했습니다. ('+r.status+')');
    if(!data||!Array.isArray(data.items))throw new Error('차단 목록 응답 형식이 올바르지 않습니다.');
    if(currentIpEl)currentIpEl.textContent=String(data.currentIp||'확인할 수 없음');
    renderIpBlocks(data.items);
  }catch(e){
    tbody.innerHTML='<tr class="empty-row"><td colspan="4">차단 목록을 불러오지 못했습니다.</td></tr>';
    setIpBlockMessage(e.message||'차단 목록을 불러오지 못했습니다.',true);
  }
}

async function createIpBlock(event){
  if(event)event.preventDefault();
  var ipInput=document.getElementById('ipBlockAddress');
  var reasonInput=document.getElementById('ipBlockReason');
  var submit=document.getElementById('ipBlockSubmit');
  var ip=ipInput.value.trim();
  var reason=reasonInput.value.trim();
  if(!isValidIpAddress(ip)){
    setIpBlockMessage('유효한 IPv4 또는 IPv6 주소를 입력하세요. CIDR 대역 표기는 지원하지 않습니다.',true);
    ipInput.focus();
    return;
  }
  submit.disabled=true;
  var originalLabel=submit.textContent;
  submit.textContent='처리 중...';
  setIpBlockMessage('',false);
  try{
    var r=await fetch('/api/admin/ip-blocks',{
      method:'POST',
      credentials:'include',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ip:ip,reason:reason})
    });
    var data=await r.json().catch(function(){return{};});
    if(!r.ok)throw new Error(data.error||'IP를 차단하지 못했습니다. ('+r.status+')');
    document.getElementById('ipBlockForm').reset();
    await loadIpBlocks();
    setIpBlockMessage('IP 차단을 추가했습니다.',false);
  }catch(e){
    setIpBlockMessage(e.message||'IP를 차단하지 못했습니다.',true);
  }finally{
    submit.disabled=false;
    submit.textContent=originalLabel;
  }
}

async function unblockIpBlock(id){
  if(!Number.isSafeInteger(Number(id))||Number(id)<1)return;
  if(!confirm('이 IP의 차단을 해제할까요?'))return;
  setIpBlockMessage('',false);
  try{
    var r=await fetch('/api/admin/ip-blocks/'+Number(id),{
      method:'DELETE',
      credentials:'include'
    });
    var data=await r.json().catch(function(){return{};});
    if(!r.ok)throw new Error(data.error||'IP 차단을 해제하지 못했습니다. ('+r.status+')');
    await loadIpBlocks();
    setIpBlockMessage('IP 차단을 해제했습니다.',false);
  }catch(e){
    setIpBlockMessage(e.message||'IP 차단을 해제하지 못했습니다.',true);
  }
}

// ── 출금 ─────────────────────────────────────────────────
async function loadWithdrawals(){
  var tbody=document.getElementById('withdrawalsBody');
  tbody.innerHTML='<tr class="empty-row"><td colspan="10">로딩 중...</td></tr>';
  var status=document.getElementById('wdStatusFilter').value;
  var url='/api/admin/withdrawals'+(status?'?status='+status:'');
  try{
    var r=await fetch(url,{credentials:'include',cache:'no-store'});
    if(!r.ok)throw new Error('load failed');
    var wds=await r.json();
    document.getElementById('statPendingWd').textContent=wds.filter(function(w){return w.status==='pending';}).length;
    document.getElementById('statApprovedWd').textContent=wds.filter(function(w){return w.status==='approved';}).length;
    if(!wds.length){tbody.innerHTML='<tr class="empty-row"><td colspan="10">출금 신청이 없습니다</td></tr>';return;}
    tbody.innerHTML=wds.map(function(w){
      var sl={pending:'대기중',approved:'승인됨',rejected:'거절됨'}[w.status]||w.status;
      var actions=w.status==='pending'
        ?'<button class="action-btn approve" onclick="processWd('+w.id+',' + "'approved'" + ')">승인</button>'
          +'<button class="action-btn reject" onclick="processWd('+w.id+',' + "'rejected'" + ')">거절</button>'
        :(w.status==='approved'||w.status==='rejected'
          ?'<button class="action-btn reject" onclick="removeWithdrawal('+w.id+')" data-testid="remove-withdrawal-'+w.id+'">삭제</button>'
          :'-');
      return '<tr id="wd-'+w.id+'">'
        +'<td>'+w.id+'</td><td>'+w.userId+'</td>'
        +'<td>'+fmtMoney(w.amount)+'</td>'
        +'<td>'+(w.method==='phone'?'📱 휴대폰':escHtml(w.bankName||'-'))+'</td>'
        +'<td>'+escHtml((w.method==='phone'?w.phoneNumber:w.accountNumber)||'-')+'</td>'
        +'<td>'+escHtml(w.method==='phone'?'-':(w.accountHolder||'-'))+'</td>'
        +'<td><span class="badge '+w.status+'">'+sl+'</span></td>'
        +'<td>'+escHtml(w.adminNote||'-')+'</td>'
        +'<td>'+fmtDate(w.createdAt)+'</td>'
        +'<td>'+actions+'</td>'
        +'</tr>';
    }).join('');
  }catch(e){tbody.innerHTML='<tr class="empty-row"><td colspan="10">오류 발생</td></tr>';}
}

var removingWithdrawals={};
async function removeWithdrawal(id){
  if(removingWithdrawals[id])return;
  if(!confirm('이 출금 항목을 관리자 목록에서 삭제하시겠습니까?\n회원 출금 내역·잔액·정산 기록은 그대로 보존됩니다.'))return;
  removingWithdrawals[id]=true;
  var row=document.getElementById('wd-'+id);
  var btns=row?row.querySelectorAll('.action-btn'):[];
  btns.forEach(function(b){b.disabled=true;});
  try{
    var r=await fetch('/api/admin/withdrawals/'+id,{method:'DELETE',credentials:'include',cache:'no-store'});
    var d=await r.json();
    if(!r.ok||!d.ok||!d.preserved)throw new Error(d.error||'삭제 실패');
    showToast('관리자 목록에서 삭제했습니다. 회원 내역과 금액은 보존됩니다.');
    await loadWithdrawals();
  }catch(e){
    showToast('오류: '+(e.message||'목록에서 삭제하지 못했습니다.'));
    btns.forEach(function(b){b.disabled=false;});
  }finally{
    delete removingWithdrawals[id];
  }
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
  document.getElementById('balanceSaveBtn').disabled=false;
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
  if(btn.disabled)return;
  var userId=balanceModalUserId;
  var rawAmount=document.getElementById('balanceAmount').value.trim();
  var amount=Number(rawAmount);
  var mode=document.getElementById('balanceMode').value;
  if(!rawAmount||!Number.isSafeInteger(amount)||amount<0){showToast('금액은 0 이상의 정수로 입력하세요');return;}
  btn.disabled=true;
  try{
    var r=await fetch('/api/admin/users/'+userId+'/balance',{
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
    var balCell=document.getElementById('user-bal-'+userId);
    if(balCell)balCell.textContent=fmtMoney(d.balance);
    if(adminUsersById[userId])adminUsersById[userId].balance=d.balance;
    if(balanceModalUserId===userId){
      document.getElementById('balanceCurrent').textContent=fmtMoney(d.balance);
      closeBalanceModal();
    }
    await loadUsers();
    loadStats();
  }catch(e){showToast('서버 오류');}
  finally{btn.disabled=false;}
}

function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2800);
}

(async function(){
  try{
    await checkSession();
  }catch(e){
    var d=document.createElement('div');
    d.style='position:fixed;top:0;left:0;right:0;background:#c0392b;color:#fff;padding:12px 16px;z-index:99999;font-size:13px;font-family:monospace';
    d.textContent='checkSession 오류: '+e.message;
    document.body.appendChild(d);
  }
})();