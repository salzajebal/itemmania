import { mobileMenuMarkup, mobileMenuScript, mobileMenuStyles } from "./mobile-menu";

/**
 * Mobile-only chat room. All API-provided text is rendered with textContent;
 * image URLs are restricted to same-origin HTTP(S) resources.
 */
export function renderMobileChatRoom(viewerId: number | null = null): string {
  const initialViewerId = viewerId !== null && Number.isSafeInteger(viewerId) && viewerId > 0 ? viewerId : null;
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#fff"><title>매니아 채팅</title>
${mobileMenuStyles()}
<style>
 *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;color:#17191d;background:#fff}button,a,textarea{font:inherit}a{color:inherit;text-decoration:none}button{cursor:pointer}[hidden]{display:none!important}
 .page{height:100dvh;display:flex;flex-direction:column;padding-bottom:calc(69px + env(safe-area-inset-bottom))}
 .header{height:56px;flex:none;background:#fff;display:flex;align-items:center;gap:7px;padding:0 11px}.back{height:40px;width:38px;display:grid;place-items:center;flex:none}.back svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .grade-badge{width:27px;height:32px;object-fit:contain;flex:none}
 .header h1{font-size:18px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0 0 0 2px;font-weight:700;flex:1;min-width:0}.options{border:0;background:none;font-size:24px;width:31px;height:40px;line-height:1;flex:none;padding:0}
 .menu-wrap{position:relative;flex:none}.room-menu{position:absolute;right:0;top:43px;width:142px;z-index:10;background:#fff;border:1px solid #dedede;border-radius:12px;box-shadow:0 4px 14px #0002;padding:9px 0}.room-menu button,.room-menu a{display:block;width:100%;text-align:left;background:none;border:0;padding:9px 18px;font-size:15px;white-space:nowrap}
 .product{flex:none;padding:12px 12px 24px;border-bottom:1px solid #eee;min-width:0}.product-main{display:flex;align-items:center;gap:9px;min-width:0}.product-tag{font-size:13px;white-space:nowrap;border:1px solid #333;border-radius:5px;padding:3px 8px;flex:none}.product-title{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.product-meta{font-size:14px;line-height:1.35;color:#656a70;margin-top:12px;overflow-wrap:anywhere}
 .trade{flex:none;padding:8px 12px 10px;border-bottom:1px solid #ececec}.trade-actions{display:flex;gap:8px;align-items:center}.trade button{border:0;border-radius:6px;padding:8px 12px;background:#228be5;color:#fff;font-weight:600;font-size:13px}.trade button:disabled{background:#ddd;color:#666;cursor:not-allowed}
  .messages{flex:1;min-height:0;overflow-y:auto;padding:15px 12px;display:flex;flex-direction:column;gap:13px}.message{max-width:86%;display:flex;flex-direction:column;gap:5px;align-self:flex-start}.message.mine{align-self:flex-end;align-items:flex-end}.message.pending .bubble{opacity:.65}.sender{font-size:12px;color:#788697;padding:0 3px}.bubble{background:#f2f4f7;border-radius:4px 15px 15px;padding:11px 13px;font-size:15px;line-height:1.48;white-space:pre-wrap;overflow-wrap:anywhere}.mine .bubble{background:#dff1ff;border-radius:15px 4px 15px 15px}.bubble img{display:block;max-width:min(65vw,260px);max-height:300px;object-fit:contain;border-radius:9px}.time{font-size:10px;color:#929eaa}
 .composer{flex:none;background:#fff;border-top:1px solid #eee;padding:5px 10px 8px;display:flex;align-items:flex-end;gap:7px}.composer textarea{resize:vertical;min-height:52px;max-height:110px;flex:1;border:0;padding:10px 2px;line-height:1.4;outline:none;color:#202529;min-width:0}.composer textarea:focus{outline:2px solid #d5e8ff}.attach,.send{height:40px;width:40px;border:0;border-radius:6px;flex:none;font-size:24px}.attach{background:#aaa;color:#fff}.send{background:#4266e9;color:#fff}.send:disabled,.attach:disabled{opacity:.55}.error{color:#bc3540;font-size:13px;padding:3px 12px;background:#fff}.error:empty{display:none}.state{margin:auto;text-align:center;padding:28px;color:#596879;line-height:1.5}.state strong{display:block;color:#26384a;margin-bottom:6px}.state a{display:inline-block;margin-top:14px;background:#258be8;border-radius:9px;color:#fff;padding:10px 18px}.loading{margin:auto;color:#778697}
 .bottom-nav{position:fixed;bottom:0;left:0;right:0;height:calc(69px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);display:grid;grid-template-columns:repeat(5,1fr);align-items:center;background:linear-gradient(100deg,#2187ed,#128cc2 52%,#00ae72);color:white;z-index:5}.bottom-nav a,.bottom-nav button{color:white;background:none;border:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;font-size:12px;height:100%;min-width:0}.bottom-nav svg{width:27px;height:27px;fill:none;stroke:currentColor;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}.bottom-nav .center{height:67px;width:67px;justify-self:center;align-self:start;transform:translateY(-10px);background:white;color:#333;border-radius:50%;box-shadow:0 1px 6px #0004}.bottom-nav .center svg{width:34px;height:34px}
</style></head><body>
<main class="page">
  <header class="header"><a class="back" id="back-link" href="/myroom/chat/list.html" aria-label="채팅 목록으로"><svg viewBox="0 0 28 28"><path d="M23 14H4m0 0 8-8m-8 8 8 8"/></svg></a><img class="grade-badge" id="partner-grade" alt="" hidden><h1 id="title">채팅방</h1><div class="menu-wrap"><button class="options" type="button" id="options" aria-label="채팅 메뉴" aria-expanded="false" aria-controls="room-menu">⋮</button><div class="room-menu" id="room-menu" hidden><a id="product-link" href="#" hidden>상품 보기</a><button type="button" id="menu-cancel" hidden>거래취소</button><button type="button" id="menu-exit">채팅종료</button></div></div></header>
  <section class="product" id="product" hidden><div class="product-main"><span class="product-tag" id="room-status">거래대기</span><span class="product-title" id="product-title"></span></div><div class="product-meta"><div id="product-number"></div><div id="product-game"></div><div id="room-mileage" aria-live="polite"></div></div></section>
  <section class="trade" id="trade" hidden aria-label="거래 진행"><div class="trade-actions"><button type="button" id="handover" hidden>인계하기</button><button type="button" id="confirm" hidden>인수하기</button></div></section>
 <section class="messages" id="messages" aria-live="polite" aria-label="채팅 메시지"><div class="loading">채팅을 불러오는 중입니다.</div></section>
  <div class="error" id="error" role="alert" aria-live="polite"></div>
  <form class="composer" id="composer" hidden><textarea id="message-input" rows="1" maxlength="2000" aria-label="메시지 입력" placeholder="메시지를 입력해주세요."></textarea><input type="file" id="image-file" accept="image/*" hidden><button class="attach" type="button" id="attach" aria-label="이미지 첨부">♧</button><button class="send" id="send" type="submit" aria-label="전송">➤</button></form>
</main>
<nav class="bottom-nav" aria-label="하단 메뉴"><a id="home-link" href="/"><svg viewBox="0 0 28 28" style="fill:currentColor"><path d="m3 12 11-9 11 9v12h-8v-8h-6v8H3Z"/></svg>홈</a><a id="chat-link" href="/myroom/chat/list.html" aria-current="page"><svg viewBox="0 0 30 30"><path d="M15 3C8 3 3 7.5 3 13c0 2.6 1 4.7 3 6l-1 6 6-3c1.2.3 2.6.5 4 .5 7 0 12-4.5 12-10S22 3 15 3Z"/><circle cx="10" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><circle cx="20" cy="13" r="1"/></svg>채팅</a><a id="search-link" class="center" href="/mobile-game-search?mode=search" aria-label="게임 검색"><svg viewBox="0 0 32 32"><circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/></svg></a><a id="my-link" href="/myroom/index.html"><svg viewBox="0 0 28 28"><circle cx="14" cy="9" r="5"/><path d="M4 25c0-6 4-9 10-9s10 3 10 9"/></svg>마이룸</a><button id="menu-button" type="button" aria-label="메뉴" aria-expanded="false"><svg viewBox="0 0 28 28"><path d="M3 6h22M3 14h22M3 22h22"/></svg>메뉴</button></nav>
${mobileMenuMarkup()}
<script>
(function(){
 'use strict';
 var params=new URLSearchParams(location.search);
 var roomId=params.get('roomId')||'';
 var preview=params.get('mobile')==='1';
 var listUrl='/myroom/chat/list.html'+(preview?'?mobile=1':'');
 var destination='/myroom/chat/new_chat.html?roomId='+encodeURIComponent(roomId)+(preview?'&mobile=1':'');
 var back=document.getElementById('back-link');
 back.href=listUrl;
  document.getElementById('home-link').href='/'+(preview?'?mobile=1':'');
  document.getElementById('chat-link').href=listUrl;
  document.getElementById('search-link').href='/mobile-game-search?mode=search'+(preview?'&mobile=1':'');
  document.getElementById('my-link').href='/myroom/index.html'+(preview?'?mobile=1':'');
 var messagesEl=document.getElementById('messages');
 var errorEl=document.getElementById('error');
 var form=document.getElementById('composer');
 var input=document.getElementById('message-input');
 var send=document.getElementById('send');
  var room=null,myId=${initialViewerId === null ? "null" : initialViewerId},timer=null,lastId=0,seen={},actionPending=false,events=null,loadVersion=0;
  var trade=document.getElementById('trade');
  var handover=document.getElementById('handover'),confirmBtn=document.getElementById('confirm'),cancel=document.getElementById('menu-cancel');
   var walletRefresh=null;
   function formatMileage(value){
     var amount=Number(value);
     return (Number.isFinite(amount)?amount:0).toLocaleString('ko-KR');
   }
   function orderlessCompletionPrompt(currentRoom){
     var amount=Number(currentRoom&&currentRoom.productPrice);
     if(!Number.isFinite(amount)||amount<0)amount=0;
     return '물품을 받았습니까?\\n\\n인수 확인 시 구매자 마일리지에서 상품 금액 '+formatMileage(amount)+
       '원이 차감되고, 수수료 없이 '+formatMileage(amount)+'원 전액이 판매자에게 지급됩니다.';
   }
   function refreshWallet(){
     if(walletRefresh)return walletRefresh;
     walletRefresh=fetch('/api/wallet',{credentials:'include',cache:'no-store'}).then(function(response){
       if(!response.ok)throw new Error('마일리지 잔액을 새로고침하지 못했습니다.');
       return response.json();
     }).then(function(data){
       if(!Number.isFinite(Number(data&&data.balance)))throw new Error('마일리지 잔액 응답을 확인할 수 없습니다.');
       document.getElementById('room-mileage').textContent='내 마일리지: '+formatMileage(data.balance)+'원';
     }).finally(function(){walletRefresh=null});
     return walletRefresh;
   }
   function refreshCompletionState(){
     load(false);
     refreshWallet().catch(function(){errorEl.textContent='거래는 완료되었지만 마일리지 잔액을 새로고침하지 못했습니다.'});
   }
  var gradeBadge=document.getElementById('partner-grade');
  var gradeNames={bronze:'브론즈',silver:'실버',gold:'골드',platinum:'플래티넘',vip:'VIP'};
  gradeBadge.addEventListener('error',function(){gradeBadge.hidden=true});
  var menu=document.getElementById('room-menu'),menuToggle=document.getElementById('options');
  function closeMenu(){menu.hidden=true;menuToggle.setAttribute('aria-expanded','false')}
  menuToggle.addEventListener('click',function(){menu.hidden=!menu.hidden;menuToggle.setAttribute('aria-expanded',String(!menu.hidden))});
  document.addEventListener('click',function(event){if(!event.target.closest('.menu-wrap'))closeMenu()});
  document.getElementById('menu-exit').addEventListener('click',function(){location.href=listUrl});
 function renderTrade(){
   if(!room)return;
   var closed=['ended','cancelled','rejected'].includes(room.status);
    var canHandoverOrder=!room.orderId||room.orderStatus==='pending';
    var canConfirmOrder=!room.orderId||room.orderStatus==='shipped';
   var buyer=Number(myId)===Number(room.buyerId),seller=Number(myId)===Number(room.sellerId);
    handover.hidden=!seller||closed;
    confirmBtn.hidden=!buyer||closed;
   cancel.hidden=closed;
      handover.disabled=actionPending||!seller||!canHandoverOrder||!['pending','active'].includes(room.status);
      confirmBtn.disabled=actionPending||!buyer||!canConfirmOrder||room.status!=='handover';
    cancel.disabled=actionPending;
    trade.hidden=closed||(!buyer&&!seller);
   form.hidden=closed;
 }
 async function runTrade(button,kind){
   if(actionPending||button.hidden||button.disabled||!room)return;
      var prompts={handover:'물품을 전달한 후 인계완료 처리하시겠습니까?',confirm:room.orderId?'물품을 받았습니까? 확인하면 판매자에게 거래 대금이 지급됩니다.':orderlessCompletionPrompt(room),cancel:room.orderId?'거래를 취소하시겠습니까? 결제한 잔액이 환불됩니다.':'거래를 취소하시겠습니까?'};
   if(!window.confirm(prompts[kind]))return;
   actionPending=true;renderTrade();errorEl.textContent='';
   try{
      var url='/api/chat/rooms/'+encodeURIComponent(roomId);
      var response=await fetch(url,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:{handover:'handover',confirm:'ended',cancel:'cancelled'}[kind]})});
     var result=await response.json().catch(function(){return {}});
     if(!response.ok)throw new Error(result.error||'거래 처리를 완료하지 못했습니다.');
     await load(false);
      if(kind==='confirm')refreshWallet().catch(function(){errorEl.textContent='거래는 완료되었지만 마일리지 잔액을 새로고침하지 못했습니다.'});
   }catch(e){errorEl.textContent=e instanceof Error?e.message:'거래를 처리하지 못했습니다.'}
   finally{actionPending=false;renderTrade()}
 }
 handover.addEventListener('click',function(){runTrade(handover,'handover')});
 confirmBtn.addEventListener('click',function(){runTrade(confirmBtn,'confirm')});
 cancel.addEventListener('click',function(){runTrade(cancel,'cancel')});
  var imageFile=document.getElementById('image-file'),attach=document.getElementById('attach');
  attach.addEventListener('click',function(){imageFile.click()});
  imageFile.addEventListener('change',async function(){
    var file=imageFile.files&&imageFile.files[0];if(!file)return;
    if(!file.type.startsWith('image/')||file.size>5*1024*1024){errorEl.textContent='5MB 이하의 이미지만 첨부할 수 있습니다.';imageFile.value='';return}
    attach.disabled=true;errorEl.textContent='';
    try{
      var data=new FormData();data.append('image',file);
      var response=await fetch('/api/chat/rooms/'+encodeURIComponent(roomId)+'/upload',{method:'POST',credentials:'include',body:data});
      var result=await response.json().catch(function(){return {}});
      if(!response.ok)throw new Error(result.error||'이미지 전송에 실패했습니다.');
      appendMessage(result);messagesEl.scrollTop=messagesEl.scrollHeight;
    }catch(e){errorEl.textContent=e instanceof Error?e.message:'이미지 전송에 실패했습니다.'}
    finally{attach.disabled=false;imageFile.value=''}
  });
 function clearMessages(){messagesEl.replaceChildren()}
 function showState(title,description,login){
    stopPolling();if(events){events.close();events=null}
   clearMessages();
    document.getElementById('product').hidden=true;trade.hidden=true;closeMenu();
   var panel=document.createElement('div');panel.className='state';
   var strong=document.createElement('strong');strong.textContent=title;panel.appendChild(strong);
   var text=document.createElement('span');text.textContent=description;panel.appendChild(text);
   if(login){var link=document.createElement('a');link.href='/login?returnUrl='+encodeURIComponent(destination);link.textContent='로그인하기';panel.appendChild(link)}
   messagesEl.appendChild(panel);
   form.hidden=true;
 }
 function formatTime(value){
   var date=new Date(value);
   return Number.isNaN(date.getTime())?'':date.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
 }
 function safeImageUrl(path){
   try{var url=new URL(path,location.origin);if((url.protocol==='https:'||url.protocol==='http:')&&url.origin===location.origin)return url.href}catch(e){}
   return '';
 }
 function appendMessage(message){
   if(!message||!Number.isSafeInteger(Number(message.id))||seen[String(message.id)])return;
   seen[String(message.id)]=true;lastId=Math.max(lastId,Number(message.id));
   var mine=Number(message.senderId)===Number(myId);
   var article=document.createElement('article');article.className='message'+(mine?' mine':'');
   if(!mine){var name=document.createElement('span');name.className='sender';name.textContent=Number(message.senderId)===Number(room.buyerId)?String(room.buyerNickname||'구매자'):String(room.sellerNickname||'판매자');article.appendChild(name)}
   var bubble=document.createElement('div');bubble.className='bubble';
   var content=String(message.content||'');
   if(content.indexOf('[img]')===0){
     var imageUrl=safeImageUrl(content.slice(5));
     if(imageUrl){var image=document.createElement('img');image.src=imageUrl;image.alt='채팅으로 받은 이미지';image.loading='lazy';bubble.appendChild(image)}
     else bubble.textContent='이미지를 표시할 수 없습니다.';
   }else bubble.textContent=content;
   article.appendChild(bubble);
   var time=document.createElement('time');time.className='time';time.dateTime=String(message.createdAt||'');time.textContent=formatTime(message.createdAt);article.appendChild(time);
   messagesEl.appendChild(article);
 }
  function pendingMessage(content){
    var article=document.createElement('article');article.className='message mine pending';
    var bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=content;article.appendChild(bubble);
    var time=document.createElement('time');time.className='time';time.textContent='전송 중';article.appendChild(time);
    messagesEl.appendChild(article);messagesEl.scrollTop=messagesEl.scrollHeight;
    return article;
  }
 function update(data,initial){
   if(!data||!data.room||!Array.isArray(data.messages))throw new Error('채팅 응답을 확인할 수 없습니다.');
   room=data.room;
    var buyer=Number(myId)===Number(room.buyerId);
    document.getElementById('title').textContent=String((buyer?room.sellerNickname:room.buyerNickname)||'상대방');
     var partnerGrade=String((buyer?room.sellerGrade:room.buyerGrade)||'').toLowerCase();
     if(Object.prototype.hasOwnProperty.call(gradeNames,partnerGrade)){
       gradeBadge.alt=gradeNames[partnerGrade]+' 등급';
       gradeBadge.hidden=false;
       if(gradeBadge.getAttribute('src')!=='/grade-icon/'+partnerGrade)gradeBadge.src='/grade-icon/'+partnerGrade;
     }else{
       gradeBadge.hidden=true;
       gradeBadge.removeAttribute('src');
       gradeBadge.alt='';
     }
    document.getElementById('product').hidden=false;
    document.getElementById('product-title').textContent=String(room.productTitle||'상품 채팅');
    document.getElementById('product-number').textContent=room.productId?'상품번호 #'+room.productId:'채팅번호 #'+room.id;
    document.getElementById('product-game').textContent=[room.gameName,room.serverName].filter(Boolean).join(' > ');
    var productLink=document.getElementById('product-link');
    productLink.hidden=!room.productId||!['buy','sell'].includes(room.productCategory);
    if(!productLink.hidden)productLink.href='/'+room.productCategory+'/application.html?id='+encodeURIComponent(room.productId)+(preview?'&mobile=1':'');
    var status=document.getElementById('room-status');
   status.textContent=({pending:'거래대기',active:'거래중',handover:'인계완료',ended:'거래종료',cancelled:'거래취소',rejected:'거래불가'})[room.status]||'';
    renderTrade();
    if(['ended','cancelled','rejected'].includes(room.status)){stopPolling();if(events){events.close();events=null}}
   var hasNew=initial||data.messages.some(function(m){return Number(m.id)>lastId});
   if(initial)clearMessages();
   data.messages.forEach(appendMessage);
   if(hasNew)messagesEl.scrollTop=messagesEl.scrollHeight;
 }
 async function load(initial){
    var version=++loadVersion;
   try{
     var response=await fetch('/api/chat/rooms/'+encodeURIComponent(roomId)+'/messages',{credentials:'include',cache:'no-store'});
      if(version!==loadVersion)return false;
     if(response.status===401){showState('로그인이 필요합니다.','로그인 후 채팅방을 확인할 수 있습니다.',true);stopPolling();return false}
     if(response.status===403||response.status===404){showState(response.status===403?'채팅방에 접근할 수 없습니다.':'채팅방을 찾을 수 없습니다.','권한이 있는 채팅방인지 확인해 주세요.',false);stopPolling();return false}
     if(!response.ok)throw new Error('채팅 내역을 불러오지 못했습니다.');
       var data=await response.json();if(version!==loadVersion)return false;
        var wasEnded=room&&room.status==='ended';
        update(data,initial);errorEl.textContent='';
        if(initial||(room.status==='ended'&&!wasEnded))refreshWallet().catch(function(){errorEl.textContent='마일리지 잔액을 새로고침하지 못했습니다.'});
        return true;
    }catch(e){if(version===loadVersion){errorEl.textContent=e instanceof Error?e.message:'채팅 내역을 불러오지 못했습니다.';if(initial)showState('채팅을 불러오지 못했습니다.',errorEl.textContent,false)}return false}
 }
 function stopPolling(){if(timer!==null){clearInterval(timer);timer=null}}
  function startPolling(){stopPolling();if(room&&['ended','cancelled','rejected'].includes(room.status))return;timer=setInterval(function(){if(!document.hidden)load(false)},2000)}
  function startEvents(){
    if(typeof EventSource==='undefined'||!room||['ended','cancelled','rejected'].includes(room.status))return;
    events=new EventSource('/api/events');
    var connected=false;
    events.addEventListener('connected',function(){if(connected&&room&&!document.hidden){load(false);refreshWallet().catch(function(){errorEl.textContent='마일리지 잔액을 새로고침하지 못했습니다.'})}connected=true});
    events.addEventListener('notification',function(event){
      try{
        var notice=JSON.parse(event.data);
          if(notice.link==='/myroom/chat/new_chat.html?roomId='+roomId&&
             ['chat_message','trade_handover','trade_ended','trade_cancelled'].includes(notice.type)&&!document.hidden){
            if(notice.type==='trade_ended')refreshCompletionState();
            else load(false);
          }
      }catch(e){}
    });
     events.addEventListener('balance',function(){if(!document.hidden)refreshWallet().catch(function(){errorEl.textContent='마일리지 잔액을 새로고침하지 못했습니다.'})});
    events.addEventListener('chat_handover',function(event){
      try{if(String(JSON.parse(event.data).roomId)===roomId&&!document.hidden)load(false)}catch(e){}
    });
  }
 form.addEventListener('submit',async function(event){
   event.preventDefault();var content=input.value.trim();if(!content||send.disabled)return;
    send.disabled=true;errorEl.textContent='';
    var pending=pendingMessage(content);
   try{
     var response=await fetch('/api/chat/rooms/'+encodeURIComponent(roomId)+'/messages',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:content})});
     if(response.status===401){showState('로그인이 필요합니다.','로그인 후 메시지를 보낼 수 있습니다.',true);return}
     var data=await response.json().catch(function(){return {}});
     if(!response.ok)throw new Error(data.error||'메시지를 전송하지 못했습니다.');
      if(input.value.trim()===content)input.value='';
      pending.remove();appendMessage(data);messagesEl.scrollTop=messagesEl.scrollHeight;
   }catch(e){errorEl.textContent=e instanceof Error?e.message:'메시지를 전송하지 못했습니다.'}
    finally{pending.remove();send.disabled=false}
 });
 document.addEventListener('visibilitychange',function(){if(document.hidden)stopPolling();else if(room)load(false).then(startPolling)});
  window.addEventListener('pagehide',function(){stopPolling();if(events)events.close()});
 if(!/^[1-9]\\d*$/.test(roomId)||!Number.isSafeInteger(Number(roomId))){
   showState('채팅방을 찾을 수 없습니다.','올바른 채팅방 주소가 아닙니다.',false);
  }else if(myId){
    load(true).then(function(ok){if(ok){startPolling();startEvents()}});
  }else{
   fetch('/api/auth/me',{credentials:'include',cache:'no-store'}).then(async function(response){
     if(response.status===401){showState('로그인이 필요합니다.','로그인 후 채팅방을 확인할 수 있습니다.',true);return}
     if(!response.ok)throw new Error('로그인 상태를 확인할 수 없습니다.');
     var user=await response.json();myId=user.id||user.userId||user.user&&user.user.id;
     if(!myId)throw new Error('사용자 정보를 확인할 수 없습니다.');
      if(await load(true)){startPolling();startEvents()}
   }).catch(function(e){showState('채팅방을 불러오지 못했습니다.',e instanceof Error?e.message:'다시 시도해 주세요.',false)});
 }
})();
  </script>${mobileMenuScript("menu-button")}</body></html>`;
}