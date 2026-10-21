export const TRADE_DETAIL_SCRIPT = String.raw`<script>
(function(){
 'use strict';
 var root=document.querySelector('.trade-detail[data-room-id]');
 if(!root)return;
 var roomId=root.getAttribute('data-room-id'),side=root.getAttribute('data-trade-side');
 var error=document.getElementById('trade-detail-error'),busy=false,events=null,room=null,actionPending=false;
 var chatButton=document.getElementById('trade-scroll-chat');
 var confirmButton=document.getElementById('trade-confirm');
 var cancelButton=document.getElementById('trade-cancel');
 var help=root.querySelector('[data-trade-help]');
 var demo=location.pathname.indexOf('/dev-trade-preview')===0;
 function field(name,value){root.querySelectorAll('[data-trade-field="'+name+'"]').forEach(function(el){el.textContent=value==null||value===''?'미등록':String(value)})}
 function time(value){if(!value)return '미등록';var date=new Date(value);if(!Number.isFinite(date.getTime()))return '미등록';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date)}
 function description(value){
   var template=document.createElement('template');template.innerHTML=String(value||'');
   template.content.querySelectorAll('script,style').forEach(function(el){el.remove()});
   template.content.querySelectorAll('br').forEach(function(el){el.replaceWith(document.createTextNode('\n'))});
   template.content.querySelectorAll('p,div').forEach(function(el){el.appendChild(document.createTextNode('\n'))});
   return (template.content.textContent||'').trim()||'상세설명이 등록되지 않았습니다.';
 }
 function show(message){error.hidden=!message;error.textContent=message||''}
 function actions(){
  if(!room)return;
  var active=['pending','active'].includes(room.status),handover=room.status==='handover';
  confirmButton.disabled=actionPending||demo||!(active||handover);
  cancelButton.disabled=actionPending||demo||!(active||handover);
  confirmButton.title=side==='buy'&&!handover?'판매자가 물품을 인계한 뒤 인수확인할 수 있습니다.':'';
  if(demo){confirmButton.title='개발용 프리뷰에서는 거래를 종료할 수 없습니다.';cancelButton.title='개발용 프리뷰에서는 거래를 취소할 수 없습니다.'}
 }
 async function refresh(){
  if(busy)return;busy=true;
  try{
   var response=await fetch('/api/chat/rooms/'+encodeURIComponent(roomId)+'/messages',{credentials:'include',cache:'no-store'});
   if(!response.ok)throw Error(response.status===401?'로그인이 필요합니다.':response.status===403?'이 거래를 볼 권한이 없습니다.':'거래 정보를 불러오지 못했습니다.');
   var data=await response.json(),r=data.room,buyer=side==='buy',mine=buyer?'buyer':'seller',partner=buyer?'seller':'buyer';
   room=r;
   field('category',[r.gameName,r.serverName,r.productItemCategory].filter(Boolean).join(' > '));
   field('productCategory',r.productItemCategory||r.productCategory);
   field('title',r.productTitle);
   field('reference',r.productItemmaniaId||(r.orderId?String(r.orderId):((r.tradeInfo||'').match(/C-\d+/)||[])[0])||r.id);
   field('createdAt',time(r.productCreatedAt||r.orderCreatedAt||r.createdAt));
   var quantity=String(r.productTitle||'').match(/(?:^|[\s\[])(\d+(?:\.\d+)?(?:억|만|개))(?:\s?(게임머니|메소|아데나|골드))?/u);
   field('quantity',quantity?quantity[1]+(quantity[2]||(/게임머니/.test(String(r.productItemCategory||''))?'게임머니':'')):'-');
   field('amount',r.productPrice!=null?Number(r.productPrice).toLocaleString('ko-KR')+'원':'미등록');
   field('purchaseConfirmation','-');
   field('productDescription',description(r.productDescription));
   field('buyerCharacterName',r.buyerCharacterName||'미입력');field('sellerCharacterName',r.sellerCharacterName||'미입력');
   field('partnerName',r[partner+'Name']||r[partner+'Nickname']);field('partnerNickname',r[partner+'Nickname']);
   field('partnerPhone',r[partner+'Phone']||'연락처 미등록');field('partnerCharacterName',r[partner+'CharacterName']||'미입력');
   var grade=String(r[partner+'Grade']||'').toLowerCase();
   var grades={bronze:'BRONZE',silver:'SILVER',gold:'GOLD',platinum:'PLATINUM',diamond:'DIAMOND',vip:'VIP'};
   field('partnerGrade',grades[grade]||'등급 미등록');
   var badge=root.querySelector('.td-grade img');
   var hasIcon=['bronze','silver','gold','platinum','vip'].includes(grade);
   if(!badge&&hasIcon){
     badge=document.createElement('img');badge.alt='';badge.width=26;badge.height=28;
     root.querySelector('.td-grade').insertBefore(badge,root.querySelector('.td-grade').firstChild);
   }
   if(badge){if(hasIcon)badge.src='/grade-icon/'+grade;else badge.remove()}
   var score=r[partner+'CreditScore'];
   field('partnerCreditScore',Number.isFinite(Number(score))&&score!==null?Number(score)+'점':'');
   var certifications=root.querySelector('[data-trade-certifications]');
   certifications.replaceChildren();
   var verified=r[partner+'AuthStates']||{};
   [['excellent','우수인증'],['phone','휴대폰'],['email','이메일'],['withdraw','출금계좌']].forEach(function(entry){
     if(verified[entry[0]]===true){var tag=document.createElement('span');tag.textContent=entry[1];certifications.appendChild(tag)}
   });
   field('myName',r[mine+'Name']||r[mine+'Nickname']);field('myNickname',r[mine+'Nickname']);
   field('myPhone',r[mine+'Phone']||'연락처 미등록');field('myCharacterName',r[mine+'CharacterName']||'미입력');
   field('status',({pending:'거래대기',active:'거래중',handover:'인계완료(인수대기)',ended:'거래종료',cancelled:'거래취소',rejected:'거래불가'})[r.status]||r.status);
   var progress=root.querySelector('[data-trade-progress]');
   progress.setAttribute('data-current',r.status==='ended'?'5':r.status==='cancelled'||r.status==='rejected'?'0':'3');
   var statusLine=root.querySelector('[data-trade-status-line]');
   statusLine.hidden=r.status==='active'||r.status==='pending';
   actions();
   root.querySelectorAll('[data-trade-loading]').forEach(function(el){el.hidden=true});show('');
  }catch(e){show(e.message||'거래 정보를 불러오지 못했습니다.')}
  finally{busy=false}
 }
 chatButton.addEventListener('click',function(){
   var url='/myroom/chat/new_chat.html?roomId='+encodeURIComponent(roomId);
   var popup=window.open(url,'trade-chat-'+roomId,'width=780,height=850,resizable=yes,scrollbars=yes');
   if(popup){popup.focus()}else{window.location.assign(url)}
 });
 root.querySelector('[data-trade-description-toggle]').addEventListener('click',function(){
   var expanded=root.querySelector('[data-trade-desc]').classList.toggle('is-open');
   this.setAttribute('aria-expanded',expanded?'true':'false');
   this.innerHTML=expanded?'접기 <i>−</i>':'전체보기 <i>+</i>';
 });
 async function changeTrade(status){
   if(actionPending||!room||demo)return;
   if(status==='ended'&&room.status!=='handover'){help.textContent='판매자가 물품을 인계한 뒤 인수확인할 수 있습니다.';return}
   if(status==='handover'&&!['pending','active'].includes(room.status)){help.textContent='이미 인계했거나 종료된 거래입니다.';return}
   var message=status==='cancelled'?'이 거래를 취소하시겠습니까? 거래 채팅과 기록은 보존됩니다.':
     status==='ended'?'물품을 실제로 인수했습니까? 확인하면 거래가 종료되고 정산됩니다.':
     '물품을 실제로 전달했습니까? 인계 후 구매자가 인수확인할 수 있습니다.';
   if(!window.confirm(message))return;
   actionPending=true;actions();help.textContent='';
   try{
     var result=await fetch('/api/chat/rooms/'+encodeURIComponent(roomId),{
       method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({status:status})
     });
     if(!result.ok){var detail=await result.json().catch(function(){return {}});throw Error(detail.error||'거래 상태를 변경하지 못했습니다.')}
     await refresh();
   }catch(e){help.textContent=e.message||'거래 상태를 변경하지 못했습니다.'}
   finally{actionPending=false;actions()}
 }
 confirmButton.addEventListener('click',function(){changeTrade(side==='buy'?'ended':'handover')});
 cancelButton.addEventListener('click',function(){changeTrade('cancelled')});
 refresh();
 var timer=setInterval(function(){if(!document.hidden)refresh()},3000);
 if(typeof EventSource!=='undefined'){events=new EventSource('/api/events');events.addEventListener('notification',function(){if(!document.hidden)refresh()});events.addEventListener('chat_message',function(){if(!document.hidden)refresh()})}
 window.addEventListener('pagehide',function(){clearInterval(timer);if(events)events.close()});
 document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh()});
})();
</script>`;
