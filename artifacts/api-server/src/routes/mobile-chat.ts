import { mobileMenuMarkup, mobileMenuScript, mobileMenuStyles } from "./mobile-menu";

/**
 * Standalone mobile chat list. API-provided strings are inserted only via
 * textContent; no room data is ever interpreted as markup.
 */
export function renderMobileChat(viewerId: number | null = null): string {
  const initialViewerId = viewerId !== null && Number.isSafeInteger(viewerId) && viewerId > 0 ? viewerId : null;
  const home = `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="m3 12 11-9 11 9v12h-8v-8h-6v8H3Z"/></svg>`;
  const chat = `<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M15 3C8 3 3 7.5 3 13c0 2.6 1 4.7 3 6l-1 6 6-3c1.2.3 2.6.5 4 .5 7 0 12-4.5 12-10S22 3 15 3Z"/><circle cx="10" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><circle cx="20" cy="13" r="1"/></svg>`;
  const search = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/></svg>`;
  const user = `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="9" r="5"/><path d="M4 25c0-6 4-9 10-9s10 3 10 9"/></svg>`;
  const bars = `<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M3 6h22M3 14h22M3 22h22"/></svg>`;
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>매니아 채팅</title>
 ${mobileMenuStyles()}<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;width:100%;}body{background:#f1f3ff;color:#202529;font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;font-size:16px;letter-spacing:-.45px}button,a{font:inherit}button{cursor:pointer}a{text-decoration:none;color:inherit}svg{display:block}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #136dc6;outline-offset:2px}
.page{min-height:100dvh;padding-bottom:calc(150px + env(safe-area-inset-bottom));display:flex;flex-direction:column}
.header{height:64px;flex:none;background:#fff;display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid #f1f2f5}.header h1{font-size:21px;letter-spacing:-1px;font-weight:700;margin:0}.back{position:absolute;left:8px;top:0;height:100%;width:40px;display:grid;place-items:center}.back svg{width:26px;height:26px;fill:none;stroke:#202529;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.filters{padding:23px 18px 24px;flex:none;background:#f1f3ff}.filter-top{display:flex;align-items:center;gap:17px;min-height:30px}.type-choice{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;font-size:16px;cursor:pointer}.type-choice input{position:absolute;opacity:0;width:1px;height:1px}.type-choice .radio{width:27px;height:27px;flex:none;border-radius:50%;background:#dcdfe4;display:grid;place-items:center}.type-choice input:checked+.radio{background:#2689e3}.type-choice input:checked+.radio:after{content:"";width:11px;height:11px;background:#fff;border-radius:50%}.type-choice input:focus-visible+.radio{outline:2px solid #136dc6;outline-offset:2px}
.sort{margin-left:auto;border:0;padding:0;display:flex;align-items:center;gap:4px;background:transparent;white-space:nowrap}.sort-track{height:29px;min-width:83px;border-radius:16px;background:#278fe5;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 4px 0 10px;font-size:14px;box-shadow:0 1px 3px #adc8e5}.sort-knob{height:21px;width:21px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #547a9e}.sort[aria-pressed="false"] .sort-track{flex-direction:row-reverse;padding:0 10px 0 4px;background:#8897ab}
.statuses{display:flex;gap:8px;margin-top:23px;overflow-x:auto;scrollbar-width:none;white-space:nowrap;padding:0 0 1px;scroll-snap-type:x proximity}.statuses::-webkit-scrollbar{display:none}.status{flex:none;min-width:80px;padding:0 12px;height:42px;border-radius:12px;background:#fff;border:1px solid #dfe3ea;color:#25292e;box-shadow:0 1px 2px #dce3ee;font-size:15px;scroll-snap-align:start}.status.active{background:#0b304f;border-color:#0b304f;color:#fff}
.content{margin:0 18px;flex:1;min-height:290px;background:#fff;border:1px solid #dfe2e9;border-radius:13px 13px 0 0;overflow:hidden}.state{min-height:calc(100dvh - 350px);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:70px 20px 0}.state-icon{width:78px;height:78px;margin-bottom:12px;filter:drop-shadow(0 3px 3px #b5c6e5)}.state p{margin:0;color:#506174;font-size:20px;line-height:1.3;letter-spacing:-.65px}.state small{display:block;margin-top:10px;color:#77879a;font-size:14px}.state a,.state button{margin-top:20px;padding:10px 24px;background:#258be8;color:#fff;border:0;border-radius:9px;font-size:15px;font-weight:600}.skeleton{width:100%;padding:17px}.skeleton-row{height:82px;border-bottom:1px solid #edf0f5;display:flex;gap:13px;align-items:center}.skeleton-circle,.skeleton-line{background:#e9eef7;animation:breathe 1.25s ease-in-out infinite alternate}.skeleton-circle{width:46px;height:46px;border-radius:50%;flex:none}.skeleton-line{height:13px;width:58%;border-radius:5px}.skeleton-line:last-child{width:38%;margin-top:10px}@keyframes breathe{to{opacity:.5}}
.rooms{list-style:none;margin:0;padding:0 15px}.rooms li+li{border-top:1px solid #edf0f4}.room{display:flex;align-items:center;gap:13px;min-height:92px;padding:14px 2px}.room-avatar{height:47px;width:47px;flex:none;border-radius:16px;display:grid;place-items:center;background:#e7f2ff;color:#297bc1;font-size:20px;font-weight:700}.room-main{min-width:0;flex:1}.room-head{display:flex;align-items:center;gap:7px}.room-name{font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.room-date{margin-left:auto;font-size:11px;color:#8995a2;white-space:nowrap}.room-detail,.room-preview{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:#718091;margin-top:4px}.room-preview{color:#536276}.room-tag{font-size:11px;color:#1979cb;background:#e8f3ff;padding:3px 6px;border-radius:5px;flex:none}
.fixed-bottom{position:fixed;left:0;right:0;bottom:0;z-index:20}.shortcuts{height:72px;background:#fff;display:grid;grid-template-columns:1fr 1fr}.shortcuts a,.shortcuts button{display:flex;align-items:center;justify-content:center;gap:11px;font-size:16px;background:none;border:0;color:inherit}.shortcuts button{border-right:1px solid #f6f7f9}.shortcuts svg{height:37px;width:37px}.bottom-nav{height:calc(78px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:linear-gradient(100deg,#2187ed 0%,#128cc2 49%,#00ae72 100%);display:grid;grid-template-columns:repeat(5,1fr);align-items:center;color:#fff;box-shadow:0 -1px 5px #0002}.bottom-nav a,.bottom-nav button{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;color:#fff;background:none;border:0;font-size:13px;padding:5px 0}.bottom-nav svg{height:28px;width:28px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.bottom-nav .home-icon{fill:#fff;stroke:#fff}.bottom-nav .center{height:72px;width:72px;border-radius:50%;background:#fff;color:#333;box-shadow:0 1px 5px #0004;justify-self:center;align-self:start;transform:translateY(-10px)}.bottom-nav .center svg{width:35px;height:35px;stroke:#3b3b3b;stroke-width:2.4}
@media(max-width:390px){.filter-top{gap:10px}.type-choice{gap:4px;font-size:14px}.type-choice .radio{width:24px;height:24px}.sort-track{min-width:75px}}
</style></head><body>
<main class="page">
 <header class="header"><a class="back" id="back" href="/" aria-label="뒤로 가기"><svg viewBox="0 0 28 28"><path d="M23 14H4m0 0 8-8m-8 8 8 8"/></svg></a><h1>매니아 채팅</h1></header>
 <section class="filters" aria-label="채팅 필터">
  <div class="filter-top">
   <label class="type-choice"><input type="radio" name="kind" value="all" checked><span class="radio"></span>전체</label>
   <label class="type-choice"><input type="radio" name="kind" value="sell"><span class="radio"></span>팝니다</label>
   <label class="type-choice"><input type="radio" name="kind" value="buy"><span class="radio"></span>삽니다</label>
   <button class="sort" id="sort" type="button" aria-pressed="true" aria-label="정렬: 최근순"><span class="sort-track"><span class="sort-label">최근순</span><span class="sort-knob"></span></span></button>
  </div>
  <div class="statuses" role="group" aria-label="거래 상태">
   <button type="button" class="status active" data-status="all" aria-pressed="true">전체</button>
   <button type="button" class="status" data-status="pending" aria-pressed="false">거래대기</button>
   <button type="button" class="status" data-status="active" aria-pressed="false">거래중</button>
   <button type="button" class="status" data-status="ended" aria-pressed="false">거래종료</button>
   <button type="button" class="status" data-status="cancelled" aria-pressed="false">거래취소</button>
   <button type="button" class="status" data-status="rejected" aria-pressed="false">거래불가</button>
  </div>
 </section>
 <section class="content" aria-live="polite" id="content"><div class="skeleton" aria-label="채팅 내역 불러오는 중"><div class="skeleton-row"><div class="skeleton-circle"></div><div><div class="skeleton-line"></div><div class="skeleton-line"></div></div></div><div class="skeleton-row"><div class="skeleton-circle"></div><div><div class="skeleton-line"></div><div class="skeleton-line"></div></div></div></div></section>
</main>
<div class="fixed-bottom">
  <div class="shortcuts"><button id="blocklist" type="button" aria-label="차단리스트"><svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="6" width="30" height="31" rx="2" fill="#438ad9"/><rect x="12" y="2" width="16" height="8" rx="3" fill="#1462b5"/><circle cx="20" cy="5" r="1.7" fill="#dcecff"/><path d="M12 16h3m4 0h10M12 23h3m4 0h10M12 30h3m4 0h10" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/></svg>차단리스트</button><a href="/myroom/index.html"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="12" r="10" fill="#9bcdf8"/><path d="M5 39v-6c0-9 7-15 15-15s15 6 15 15v6Z" fill="#3287e5"/><path d="m15 22 5 10 5-10" fill="#fff"/></svg>마이룸</a></div>
  <nav class="bottom-nav" aria-label="하단 메뉴"><a id="home-link" href="/" aria-label="홈">${home.replace("viewBox=", 'class="home-icon" viewBox=')}<span>홈</span></a><a id="chat-link" href="/myroom/chat/list.html" aria-current="page" aria-label="채팅">${chat}<span>채팅</span></a><a id="search-link" class="center" href="/mobile-game-search?mode=search" aria-label="게임 검색">${search}</a><a href="/myroom/index.html" aria-label="마이룸">${user}<span>마이룸</span></a><button id="menu-button" type="button" aria-label="메뉴" aria-expanded="false">${bars}<span>메뉴</span></button></nav>
</div>
 ${mobileMenuMarkup()}
<script>
(function(){
 var preview=new URLSearchParams(location.search).get('mobile')==='1',suffix=preview?'?mobile=1':'';
 var home='/'+suffix,chatList='/myroom/chat/list.html'+suffix;
 document.getElementById('home-link').href=home;document.getElementById('back').href=home;
  document.getElementById('chat-link').href=chatList;
  document.getElementById('search-link').href='/mobile-game-search?mode=search'+(preview?'&mobile=1':'');
  if(preview){document.querySelectorAll('a[href="/myroom/index.html"]').forEach(function(a){a.href='/myroom/index.html?mobile=1'})}
  var content=document.getElementById('content');
  var rooms=[],userId=${initialViewerId === null ? "null" : initialViewerId},status='all',kind='all',recent=true,loaded=false;
 var bubble='<svg class="state-icon" viewBox="0 0 84 84" aria-hidden="true"><defs><linearGradient id="bubble-fill" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#c0d8fc"/><stop offset="1" stop-color="#7397d2"/></linearGradient></defs><path d="M15 10h54a7 7 0 0 1 7 7v40a7 7 0 0 1-7 7H57L47 79 35 64H15a7 7 0 0 1-7-7V17a7 7 0 0 1 7-7Z" fill="url(#bubble-fill)"/><circle cx="25" cy="37" r="5" fill="#fff"/><circle cx="42" cy="37" r="5" fill="#fff"/><circle cx="59" cy="37" r="5" fill="#fff"/></svg>';
  function state(title,sub,action,label){content.replaceChildren();var wrap=document.createElement('div');wrap.className='state';wrap.innerHTML=bubble;var p=document.createElement('p');p.textContent=title;wrap.appendChild(p);if(sub){var small=document.createElement('small');small.textContent=sub;wrap.appendChild(small)}if(action){var control=label==='로그인하기'?document.createElement('a'):document.createElement('button');control.textContent=label;if(control.tagName==='A')control.href='/login?returnUrl='+encodeURIComponent(chatList);else{control.type='button';control.addEventListener('click',action)}wrap.appendChild(control)}content.appendChild(wrap)}
 function typeOf(room){return Number(room.sellerId)===Number(userId)?'sell':'buy'}
 function statusOf(room){return room.status==='handover'?'active':room.status}
 function labelOf(room){return ({pending:'거래대기',active:'거래중',handover:'거래중',ended:'거래종료',cancelled:'거래취소',rejected:'거래불가'})[room.status]||'거래중'}
 function dateOf(room){var n=Date.parse(room.lastMessageAt||room.createdAt||'');return Number.isFinite(n)?n:0}
 function render(){
  if(!loaded)return;
  var visible=rooms.filter(function(r){return (kind==='all'||typeOf(r)===kind)&&(status==='all'||statusOf(r)===status)}).slice().sort(function(a,b){return (dateOf(b)-dateOf(a))*(recent?1:-1)});
  if(!visible.length){state(rooms.length?'조건에 맞는 채팅내역이 없습니다.':'채팅내역이 없습니다.\\n매니아톡으로 상대방과 대화하며\\n거래해 보세요.');content.querySelector('.state p').style.whiteSpace='pre-line';return}
  var list=document.createElement('ul');list.className='rooms';
  visible.forEach(function(room){
   var id=Number(room.id);if(!Number.isSafeInteger(id)||id<1)return;
   var li=document.createElement('li'),a=document.createElement('a');a.className='room';a.href='/myroom/chat/new_chat.html?roomId='+encodeURIComponent(String(id))+'&type='+typeOf(room)+(preview?'&mobile=1':'');
   var avatar=document.createElement('span');avatar.className='room-avatar';
   var name=String((typeOf(room)==='sell'?room.buyerNickname:room.sellerNickname)||'상대방');avatar.textContent=name.slice(0,1);
   var main=document.createElement('span');main.className='room-main';var head=document.createElement('span');head.className='room-head';
   var title=document.createElement('span');title.className='room-name';title.textContent=name;
   var tag=document.createElement('span');tag.className='room-tag';tag.textContent=labelOf(room);
   var date=document.createElement('time');date.className='room-date';var d=new Date(dateOf(room));date.textContent=dateOf(room)?d.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'}):'';
   head.append(title,tag,date);
   var detail=document.createElement('div');detail.className='room-detail';detail.textContent=(typeOf(room)==='sell'?'팝니다':'삽니다')+' · '+String(room.productTitle||room.gameName||'상품 채팅');
   var previewEl=document.createElement('div');previewEl.className='room-preview';var msg=String(room.lastMessage||'대화를 시작해 보세요.');previewEl.textContent=msg.startsWith('[img]')?'사진을 보냈습니다.':msg;
   main.append(head,detail,previewEl);a.append(avatar,main);li.appendChild(a);list.appendChild(li);
  });content.replaceChildren(list)
 }
 async function load(){
  content.innerHTML='<div class="skeleton" aria-label="채팅 내역 불러오는 중"><div class="skeleton-row"><div class="skeleton-circle"></div><div><div class="skeleton-line"></div><div class="skeleton-line"></div></div></div><div class="skeleton-row"><div class="skeleton-circle"></div><div><div class="skeleton-line"></div><div class="skeleton-line"></div></div></div></div>';
  try{
    if(!userId){
      var auth=await fetch('/api/auth/me',{credentials:'include'});
      if(auth.status===401){state('로그인이 필요합니다.','로그인 후 채팅내역을 확인할 수 있습니다.',function(){},'로그인하기');return}
      if(!auth.ok)throw new Error('auth');
      var me=await auth.json();userId=me.id||me.userId||me.user&&me.user.id;
      if(!userId)throw new Error('identity');
    }
   var response=await fetch('/api/chat/rooms',{credentials:'include'});
   if(response.status===401){state('로그인이 필요합니다.','로그인 후 채팅내역을 확인할 수 있습니다.',function(){},'로그인하기');return}
   if(!response.ok)throw new Error('rooms');
   var data=await response.json();if(!Array.isArray(data))throw new Error('format');
   rooms=data;loaded=true;render();
  }catch(e){state('채팅내역을 불러오지 못했습니다.','연결 상태를 확인하고 다시 시도해 주세요.',load,'다시 시도')}
 }
 document.querySelectorAll('input[name="kind"]').forEach(function(input){input.addEventListener('change',function(){kind=input.value;render()})});
 document.querySelectorAll('.status').forEach(function(button){button.addEventListener('click',function(){status=button.dataset.status;document.querySelectorAll('.status').forEach(function(b){var active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});render()})});
 document.getElementById('sort').addEventListener('click',function(){recent=!recent;this.setAttribute('aria-pressed',String(recent));this.setAttribute('aria-label','정렬: '+(recent?'최근순':'오래된순'));this.querySelector('.sort-label').textContent=recent?'최근순':'오래된순';render()});
  document.getElementById('blocklist').addEventListener('click',function(){alert('차단리스트 기능은 준비 중입니다.')});
 load();
})();
 </script>${mobileMenuScript("menu-button")}</body></html>`;
}