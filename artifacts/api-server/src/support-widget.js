(function(){
if(window.SupportChat)return;
var LOGIN='/login',MAX=2000;
var S={open:false,user:null,status:'loading',conn:'connecting',msgs:[],hasMore:false,unread:0,readId:0,pending:null,draft:'',err:'',busy:false,gen:0,es:null,timer:null,loadingOlder:false};
var host=document.createElement('div');host.id='support-chat-host';
var root=host.attachShadow({mode:'open'});
root.innerHTML='<style>'+
':host{all:initial}*{box-sizing:border-box;font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif}'+
'.fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;height:52px;min-width:52px;padding:0 18px;border:0;border-radius:26px;background:#0f2a43;color:#fff;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(15,42,67,.35);display:flex;align-items:center;gap:8px}'+
'.fab:focus-visible,button:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid #159EFD;outline-offset:2px}'+
'.chat-icon{width:22px;height:22px;flex-shrink:0}'+
'.badge{position:absolute;top:-6px;right:-4px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#d92d20;color:#fff;font-size:11px;line-height:20px;text-align:center}'+
'.panel{position:fixed;right:20px;bottom:84px;z-index:2147483001;width:380px;height:min(600px,calc(100dvh - 104px));background:#fbfaf7;border:1px solid #cfd8e0;border-radius:14px;box-shadow:0 12px 40px rgba(15,42,67,.3);display:none;flex-direction:column;overflow:hidden}'+
'.panel.on{display:flex}'+
'header{background:#0f2a43;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}'+
'header h2{font-size:15px;flex:1;margin:0}header small{display:block;font-weight:400;font-size:11px;opacity:.75;margin-top:2px}'+
'.x{background:none;border:0;color:#fff;font-size:20px;cursor:pointer;width:32px;height:32px;border-radius:6px}.x:hover{background:rgba(255,255,255,.15)}'+
'.list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}'+
'.m{max-width:82%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}'+
'.m.member{align-self:flex-end;background:#159EFD;color:#fff;border-bottom-right-radius:3px}'+
'.m.admin{align-self:flex-start;background:#fff;border:1px solid #dde3e8;color:#222;border-bottom-left-radius:3px}'+
'.t{display:block;font-size:10px;opacity:.65;margin-top:4px}'+
'.who{font-size:11px;color:#667;margin-bottom:2px;align-self:flex-start}'+
'.note{text-align:center;font-size:12px;color:#667;padding:20px 10px;line-height:1.6}'+
'.err{background:#fee;color:#b42318;font-size:12px;padding:8px 12px;display:flex;gap:8px;align-items:center}'+
'.err button{margin-left:auto}'+
'form{border-top:1px solid #dde3e8;padding:10px;background:#fff;display:flex;flex-direction:column;gap:6px}'+
'.row{display:flex;gap:8px;align-items:flex-end}'+
'textarea{flex:1;resize:none;height:60px;border:1.5px solid #cfd8e0;border-radius:8px;padding:8px;font-size:14px;background:#fff}'+
'.send{height:40px;padding:0 16px;border:0;border-radius:8px;background:#0f2a43;color:#fff;font-weight:700;cursor:pointer}.send:disabled{opacity:.45;cursor:not-allowed}'+
'.sm{font-size:12px;border:1px solid #cfd8e0;background:#fff;border-radius:6px;padding:5px 10px;cursor:pointer;align-self:center}'+
'.cnt{font-size:11px;color:#778;display:flex;justify-content:space-between}'+
'a.login{display:inline-block;margin-top:10px;background:#0f2a43;color:#fff;padding:9px 18px;border-radius:8px;text-decoration:none;font-weight:700}'+
'@media(max-width:600px){.panel{right:0;bottom:0;width:100%;height:100dvh;border-radius:0}.fab{right:14px;bottom:14px}}'+
'@media(prefers-reduced-motion:no-preference){.panel.on{animation:up .18s ease-out}@keyframes up{from{transform:translateY(12px);opacity:0}}}'+
'</style>'+
'<button class="fab" type="button" aria-expanded="false" aria-controls="p" aria-label="고객센터 1:1 문의 열기"><svg class="chat-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h9M8 14h6"/></svg><span>고객센터</span><span class="badge" hidden></span></button>'+
'<section class="panel" id="p" role="dialog" aria-label="고객센터 1:1 문의"><header><h2>고객센터 1:1 문의<small id="cs"></small></h2><button class="x" type="button" aria-label="닫기">&times;</button></header>'+
'<div class="err" id="er" role="alert" hidden></div><div class="list" id="ls" aria-live="polite"></div>'+
'<form id="fm"><div class="row"><textarea id="ta" maxlength="2000" placeholder="문의 내용을 입력하세요" aria-label="메시지 입력"></textarea><button class="send" type="submit">전송</button></div><div class="cnt"><span>Enter 전송 / Shift+Enter 줄바꿈</span><span id="ct">0/2000</span></div></form></section>';
var $=function(s){return root.querySelector(s)};
var fab=$('.fab'),panel=$('.panel'),badge=$('.badge'),ls=$('#ls'),er=$('#er'),ta=$('#ta'),fm=$('#fm'),cs=$('#cs');
function api(path,opt){opt=opt||{};opt.credentials='include';opt.cache='no-store';
 if(opt.body&&!opt.headers)opt.headers={'Content-Type':'application/json'};
 return fetch(path,opt).then(function(r){
  if(r.status===401||r.status===403){authLost();var e=new Error('auth');e.auth=true;throw e}
  if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})}
function authLost(){S.gen++;S.user=null;S.status='login';S.msgs=[];S.hasMore=false;S.unread=0;S.readId=0;S.pending=null;S.busy=false;S.loadingOlder=false;S.draft='';ta.value='';stopStream();render()}
function kst(s){try{return new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' KST'}catch(e){return''}}
function lastId(){return S.msgs.length?S.msgs[S.msgs.length-1].id:0}
function render(){
 badge.hidden=!(S.unread>0&&!S.open);badge.textContent=S.unread>99?'99+':String(S.unread);
 fab.setAttribute('aria-label','고객센터 1:1 문의 '+(S.open?'닫기':'열기')+(S.unread?' (읽지 않은 메시지 '+S.unread+'개)':''));
 fab.setAttribute('aria-expanded',String(S.open));panel.classList.toggle('on',S.open);
 cs.textContent=S.conn==='live'?'실시간 연결됨':S.conn==='polling'?'연결 재시도 중 (주기적 확인)':'연결 중';
 er.hidden=!S.err;
 if(S.err){er.textContent='';var sp=document.createElement('span');sp.textContent=S.err;er.appendChild(sp);var rb=document.createElement('button');rb.className='sm';rb.type='button';rb.textContent='다시 시도';rb.onclick=function(){S.err='';refresh(true)};er.appendChild(rb)}
 fm.style.display=S.status==='ready'?'':'none';
 if(!S.open)return;
 var atBottom=ls.scrollHeight-ls.scrollTop-ls.clientHeight<60,prevH=ls.scrollHeight;
 ls.textContent='';
 function note(t,login){var d=document.createElement('div');d.className='note';d.textContent=t;if(login){d.appendChild(document.createElement('br'));var a=document.createElement('a');a.className='login';a.href=LOGIN;a.textContent='로그인하기';d.appendChild(a)}ls.appendChild(d)}
 if(S.status==='loading')return note('불러오는 중...');
 if(S.status==='login')return note('1:1 문의는 로그인 후 이용할 수 있습니다.',true);
 if(S.status==='error')return note('대화를 불러오지 못했습니다.');
 if(S.hasMore){var ob=document.createElement('button');ob.className='sm';ob.type='button';ob.textContent=S.loadingOlder?'불러오는 중...':'이전 대화 더보기';ob.disabled=S.loadingOlder;ob.onclick=older;ls.appendChild(ob)}
 if(!S.msgs.length)note('아직 대화가 없습니다. 문의 내용을 남겨 주시면 고객센터에서 답변드립니다.');
 S.msgs.forEach(function(m){
  if(m.sender==='admin'){var w=document.createElement('div');w.className='who';w.textContent=m.senderName||'고객센터';ls.appendChild(w)}
  var d=document.createElement('div');d.className='m '+(m.sender==='admin'?'admin':'member');
  d.appendChild(document.createTextNode(m.body));var t=document.createElement('span');t.className='t';t.textContent=kst(m.createdAt);d.appendChild(t);ls.appendChild(d)});
 if(S.pending){var p=document.createElement('div');p.className='m member';p.style.opacity='.6';p.textContent=S.pending.text;var pt=document.createElement('span');pt.className='t';pt.textContent=S.busy?'전송 중...':'전송 실패 - 다시 전송을 누르세요';p.appendChild(pt);ls.appendChild(p)}
 if(S.loadingOlder)ls.scrollTop=ls.scrollHeight-prevH+ls.scrollTop;else if(atBottom||S.forceBottom){ls.scrollTop=ls.scrollHeight;S.forceBottom=false}
 markRead()}
function visible(){return !document.hidden}
function markRead(){
 var id=lastId();if(!S.open||!visible()||S.status!=='ready'||!id||id<=S.readId)return;
 var g=S.gen,uid=S.user;S.readId=id;
 api('/api/support/read',{method:'POST',body:JSON.stringify({messageId:id})}).then(function(){if(g===S.gen&&S.user===uid){S.unread=0;render()}}).catch(function(){if(g===S.gen&&S.readId===id)S.readId=id-1})}
function merge(list){var seen={};S.msgs.forEach(function(m){seen[m.id]=1});list.forEach(function(m){if(!seen[m.id])S.msgs.push(m)});S.msgs.sort(function(a,b){return a.id-b.id})}
function resetConversation(){S.gen++;S.msgs=[];S.hasMore=false;S.readId=0;S.unread=0;S.pending=null;S.busy=false;S.loadingOlder=false;S.conversationId=null;S.status='loading';render()}
function generation(d){if(S.conversationId!=null&&S.conversationId!==d.conversationId){resetConversation();return true}S.conversationId=d.conversationId;return false}
function verifyIdentity(){
 return api('/api/auth/me').then(function(u){
  var id=u&&(u.id||(u.user&&u.user.id));if(!id)throw new Error('로그인 확인 실패');
  var changed=id!==S.user;
   if(changed){S.gen++;S.conversationId=null;stopStream();S.user=id;S.msgs=[];S.readId=0;S.pending=null;S.busy=false;S.hasMore=false;S.unread=0;S.draft='';ta.value='';S.status='loading';render();startStream();if(!S.timer)S.timer=setTimeout(tick,S.open?5000:18000)}
  return changed;
 })}
function refresh(initial){return verifyIdentity().then(function(changed){return refreshCurrent(initial||changed)}).catch(function(){})}
function refreshCurrent(initial){
 if(!S.user)return Promise.resolve();var g=S.gen;
 if(initial||!S.msgs.length){
   return api('/api/support/messages').then(function(d){if(g!==S.gen)return;generation(d);S.conversationId=d.conversationId;S.msgs=d.messages||[];S.hasMore=!!d.hasMore;S.unread=d.unreadCount||0;S.status='ready';S.err='';S.forceBottom=true;render()})
   .catch(function(e){if(g!==S.gen||e.auth)return;if(S.status==='loading')S.status='error';S.err='연결에 문제가 있습니다.';render()})}
  function step(){return api('/api/support/messages?afterId='+lastId()).then(function(d){if(g!==S.gen)return;if(generation(d))return refreshCurrent(true);var n=(d.messages||[]).length;merge(d.messages||[]);S.unread=d.unreadCount||0;S.err='';if(d.hasMore&&n)return step();render()})}
 return step().catch(function(e){if(g!==S.gen||e.auth)return;S.err='새 메시지를 확인하지 못했습니다.';render()})}
function older(){
 if(S.loadingOlder||!S.msgs.length)return;var g=S.gen;S.loadingOlder=true;render();
  api('/api/support/messages?beforeId='+S.msgs[0].id).then(function(d){if(g!==S.gen)return;if(generation(d))return refreshCurrent(true);merge(d.messages||[]);S.hasMore=!!d.hasMore}).catch(function(e){if(!e.auth&&g===S.gen)S.err='이전 대화를 불러오지 못했습니다.'}).then(function(){if(g===S.gen){S.loadingOlder=false;render()}})}
function summary(){return verifyIdentity().then(summaryCurrent).catch(function(){})}
function summaryCurrent(){
 if(!S.user)return;var g=S.gen;
  api('/api/support/summary').then(function(d){if(g!==S.gen)return;var reset=generation(d);S.conversationId=d.conversationId;var changed=d.latestMessageId>lastId();S.unread=d.unreadCount||0;if(S.open&&S.status==='ready'&&(changed||reset))refresh();else render()}).catch(function(){})}
function startStream(){
 if(S.es||!S.user||!window.EventSource)return;
 var es=new EventSource('/api/support/events',{withCredentials:true});S.es=es;
 es.addEventListener('connected',function(){S.conn='live';if(S.user){S.open?refresh():summary()}render()});
  es.addEventListener('support',function(ev){var d={};try{d=JSON.parse(ev.data)}catch(e){}if(d.kind==='deleted'){resetConversation();S.err='';if(S.open)refreshCurrent(true);else summary()}else if(S.open)refresh();else summary()});
 es.addEventListener('unauthorized',authLost);
 es.onerror=function(){S.conn='polling';render()}}
function stopStream(){if(S.es){S.es.close();S.es=null}S.conn='connecting';if(S.timer){clearTimeout(S.timer);S.timer=null}}
function tick(){
 S.timer=null;if(!S.user)return;
 if(visible()){if(S.open)refresh();else summary()}
 S.timer=setTimeout(tick,S.open?5000:18000)}
function boot(){
 api('/api/auth/me').then(function(u){
  var id=u&&(u.id||(u.user&&u.user.id));if(!id)throw new Error('x');
  if(S.user&&S.user!==id){S.msgs=[];S.draft='';ta.value=''}
  S.user=id;S.status='loading';render();startStream();if(!S.timer)S.timer=setTimeout(tick,S.open?5000:18000);
  if(S.open)refresh(true);else summary()})
 .catch(function(e){if(e.auth||S.status==='loading'){S.status='login';render()}})}
function open(){
 S.open=true;render();ta.value=S.draft;
 if(S.status==='login'||!S.user){S.status='loading';render();boot()}else if(S.status!=='ready'||!S.msgs.length)refresh(true);else{S.forceBottom=true;refresh()}
 setTimeout(function(){(S.status==='ready'?ta:root.querySelector('.x')).focus()},30)}
function close(){S.open=false;S.draft=ta.value;render();fab.focus()}
fab.onclick=function(){S.open?close():open()};
root.querySelector('.x').onclick=close;
panel.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
ta.addEventListener('input',function(){S.draft=ta.value;$('#ct').textContent=ta.value.length+'/'+MAX});
ta.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();fm.requestSubmit()}});
fm.addEventListener('submit',function(e){
 e.preventDefault();if(S.busy||!S.user)return;
 var text=ta.value.trim();
 if(S.pending&&(!text||text===S.pending.text)){text=S.pending.text}else if(S.pending&&text!==S.pending.text){S.pending=null}
 if(!text||text.length>MAX){S.err=text?'2000자 이하로 입력하세요.':'';render();return}
 if(!S.pending)S.pending={text:text,clientId:crypto.randomUUID()};
 var p=S.pending,g=S.gen;S.busy=true;S.err='';ta.value=p.text;render();
  api('/api/support/messages',{method:'POST',body:JSON.stringify({body:p.text,clientId:p.clientId,expectedUserId:S.user,expectedConversationId:S.conversationId})}).then(function(d){
  if(g!==S.gen)return;S.pending=null;S.busy=false;ta.value='';S.draft='';$('#ct').textContent='0/'+MAX;
   if(d&&d.message){if(S.conversationId===0)S.conversationId=d.message.id;merge([d.message])}S.forceBottom=true;render();refresh()})
 .catch(function(er2){if(g!==S.gen||er2.auth)return;S.busy=false;S.err='전송하지 못했습니다. 내용은 보존되었습니다. 다시 전송하면 중복 없이 처리됩니다.';render()})});
document.addEventListener('visibilitychange',function(){if(visible()&&S.user){S.open?refresh():summary();markRead()}});
window.addEventListener('online',function(){if(S.user)S.open?refresh():summary()});
window.SupportChat={open:function(){if(!S.open)open()},close:function(){if(S.open)close()}};
function mount(){document.body.appendChild(host);render();boot()}
if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount);
})();
