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
document.getElementById('loginPw').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});

async function checkSession(){
  try{
    var r=await fetch('/api/auth/me',{credentials:'include',cache:'no-store'});
    if(!r.ok){showLogin();return;}
    var d=await r.json();
    if(d.role!=='admin'){showLogin();return;}
    showAdmin(d);
  }catch(e){showLogin();}
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
}

var loadedTabs={};

async function doLogout(){
  await fetch('/api/admin/logout',{method:'POST',credentials:'include'});
  location.reload();
}

function switchTab(tab){
  currentTab=tab;
  var tabs=['products','users','orders','withdrawals','crawl','chatrooms'];
  document.querySelectorAll('.tab-btn').forEach(function(b,i){b.classList.toggle('active',tabs[i]===tab);});
  document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active');});
  document.getElementById('tab-'+tab).classList.add('active');
  if(tab==='crawl'){initCrawlTab();return;}
  if(!loadedTabs[tab]){
    loadedTabs[tab]=true;
    if(tab==='users')loadUsers();
    else if(tab==='orders')loadOrders();
    else if(tab==='withdrawals')loadWithdrawals();
    else if(tab==='chatrooms')loadChatRooms();
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

function fmtDate(d){if(!d)return'-';return new Date(d).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
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
    var data=await r.json();
    var products=Array.isArray(data)?data:(data.products||[]);
    var total=data.total||products.length;
    totalProductsPages=data.totalPages||1;
    currentProductsPage=data.page||currentProductsPage;
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
          +'<button class="action-btn delete" onclick="deleteProduct('+p.id+')">삭제</button>'
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

async function deleteProduct(id){
  if(!confirm('이 상품을 삭제하시겠습니까?'))return;
  try{
    var r=await fetch('/api/admin/products/'+id,{method:'DELETE',credentials:'include'});
    if(!r.ok){var d=await r.json();showToast('오류: '+(d.error||'삭제 실패'));return;}
    showToast('🗑 상품이 삭제되었습니다');
    loadProducts(currentProductsPage);
  }catch(e){showToast('서버 오류');}
}

async function deleteNoGradeProducts(){
  if(!confirm('등급 없는 상품을 전부 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.'))return;
  try{
    var r=await fetch('/api/admin/products/no-grade',{method:'DELETE',credentials:'include'});
    var d=await r.json();
    if(!r.ok){showToast('오류: '+(d.error||'삭제 실패'));return;}
    showToast('🗑 등급없는 상품 '+d.deleted+'개 삭제 완료');
    loadProducts(1);
    loadStats();
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

// ── 채팅 거래 ─────────────────────────────────────────────
async function loadChatRooms(){
  var tbody=document.getElementById('chatroomsBody');
  if(!tbody)return;
  tbody.innerHTML='<tr class="empty-row"><td colspan="7">로딩 중...</td></tr>';
  var statusFilter=document.getElementById('chatroomStatusFilter').value;
  var url='/api/admin/chat-rooms'+(statusFilter?'?status='+statusFilter:'');
  try{
    var r=await fetch(url,{credentials:'include'});
    var rooms=await r.json();
    if(!Array.isArray(rooms))rooms=[];
    if(!rooms.length){tbody.innerHTML='<tr class="empty-row"><td colspan="7">채팅 거래가 없습니다</td></tr>';return;}
    var filtered=statusFilter?rooms.filter(function(rm){return rm.status===statusFilter;}):rooms;
    if(!filtered.length){tbody.innerHTML='<tr class="empty-row"><td colspan="7">해당 상태의 거래가 없습니다</td></tr>';return;}
    var statusLabel={active:'진행중',handover:'인계완료',ended:'거래완료',cancelled:'취소'};
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
        ?'<button class="action-btn approve" onclick="processWd('+w.id+',' + "'approved'" + ')">승인</button>'
          +'<button class="action-btn reject" onclick="processWd('+w.id+',' + "'rejected'" + ')">거절</button>'
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