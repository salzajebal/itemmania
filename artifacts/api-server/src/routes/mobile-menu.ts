/**
 * One shared mobile navigation drawer. The HTML is static; account data is
 * populated only from the current session, using textContent.
 */
const svg = (paths: string, viewBox = "0 0 32 32") =>
  `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${paths}</svg>`;
const stroke = 'fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"';
const icons = {
  home: svg(`<path ${stroke} d="m5 14 11-9 11 9v13h-8v-9h-6v9H5z"/>`),
  close: svg(`<path ${stroke} d="M6 6l20 20M26 6 6 26"/>`),
  mail: svg(`<rect ${stroke} x="3" y="7" width="26" height="18" rx="2"/><path ${stroke} d="m4 9 12 10L28 9"/>`),
  heart: svg(`<path ${stroke} d="M16 27 4.9 16.4C-1.1 10.6 7.2 2 13.3 8L16 10.5 18.7 8C24.8 2 33.1 10.6 27.1 16.4Z"/>`),
  sell: svg(`<g transform="rotate(-23 16 16)"><rect ${stroke} x="5" y="8" width="23" height="16" rx="2"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><text x="17" y="19" text-anchor="middle" font-size="8" font-weight="800" fill="currentColor">SELL</text></g>`),
  buy: svg(`<g transform="rotate(-23 16 16)"><rect ${stroke} x="5" y="8" width="23" height="16" rx="2"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><text x="17" y="19" text-anchor="middle" font-size="9" font-weight="800" fill="currentColor">BUY</text></g>`),
  bag: svg(`<rect ${stroke} x="4" y="10" width="24" height="19" rx="2"/><path ${stroke} d="M10 13V8a6 6 0 0 1 12 0v5m-15 1 9 6 9-6m-9-3v9"/>`),
  bolt: svg(`<path ${stroke} d="m18 2-10 15h7l-2 13 11-17h-7z"/>`),
  gift: svg(`<rect ${stroke} x="4" y="13" width="24" height="16" rx="1"/><path ${stroke} d="M3 10h26v5H3zm13 0v19M16 10c-8-1-9-8-5-8 3 0 5 4 5 8Zm0 0c8-1 9-8 5-8-3 0-5 4-5 8Z"/>`),
  points: svg(`<circle ${stroke} cx="16" cy="16" r="12"/><text x="16" y="22" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor">P</text>`),
  diamond: svg(`<path ${stroke} d="M8 6h16l6 9-14 15L2 15zM2 15h28M8 6l4 9 4 15 4-15 4-9"/>`),
  cheap: svg(`<text x="16" y="23" text-anchor="middle" font-size="16" font-weight="900" letter-spacing="-2" fill="currentColor">싸다</text>`),
  info: svg(`<circle ${stroke} cx="16" cy="16" r="12"/><path ${stroke} d="M16 14v8m0-13v.5"/>`),
  notice: svg(`<path ${stroke} d="M4 14v5h5l10 6V8L9 14H4Zm5 5 2 9h4l-2-7m10-10c4 3 4 11 0 14"/>`),
  support: svg(`<path ${stroke} d="M5 18v-3a11 11 0 0 1 22 0v3M5 17H3v8h6v-8H5Zm22 0h2v8h-6v-8h4Zm0 8c0 3-3 5-8 5h-3"/>`),
  people: svg(`<circle ${stroke} cx="11" cy="9" r="3"/><path ${stroke} d="M3 24v-3c0-5 3-7 8-7s8 2 8 7v3H3Zm17-16c5-1 7 5 2 7m1 2c4 0 6 3 6 7v1h-7"/>`),
};
const shortcuts: [string, string, string?][] = [
  ["판매등록", "sell", "/mobile-game-search?mode=sell"], ["구매등록", "buy", "/mobile-game-search?mode=buy"],
  ["상품권몰", "bag", "/giftcard"], ["게임충전", "bolt"],
  ["랜덤BOX", "gift"], ["쇼핑포인트", "points"], ["이벤트", "diamond"], ["싸다프라이...", "cheap"],
  ["이용안내", "info"], ["공지사항", "notice"], ["고객센터", "support"], ["커뮤니티", "people"],
];
const room: [string, string?][] = [
  ["메시지함"], ["판매관련", "/myroom/sell/sell_regist.html"], ["구매관련", "/myroom/buy/buy_regist.html"],
  ["종료내역"], ["취소내역"], ["마일리지", "/myroom/index.html"],
  ["충전", "/myroom/mileage/charge/charge-kakaopay.html"], ["출금", "/myroom/mileage/payment/index.html"], ["개인정보"],
  ["이용권 현황"], ["보안센터"], ["상품등록 알리미"],
];
const action = (label: string, href: string | undefined, content: string, cls: string) =>
  href ? `<a class="${cls}" href="${href}">${content}</a>` :
    `<button class="${cls}" type="button" data-menu-unavailable="${label}">${content}</button>`;

export function mobileMenuMarkup(): string {
  return `<div id="im-mobile-menu" aria-hidden="true">
  <div class="imm-backdrop" data-menu-dismiss></div>
  <aside class="imm-drawer" role="dialog" aria-modal="true" aria-label="전체서비스" tabindex="-1">
    <div class="imm-top"><a href="/" aria-label="홈" class="imm-home">${icons.home}</a><span class="imm-top-actions"><button type="button" class="imm-auth" id="imm-auth" hidden>로그인</button><button type="button" class="imm-close" data-menu-dismiss aria-label="메뉴 닫기">${icons.close}</button></span></div>
     <div class="imm-profile" id="imm-profile"><span class="imm-grade" id="imm-grade" hidden>–</span><div class="imm-identity"><strong id="imm-nickname"></strong><span id="imm-email"></span></div><span class="imm-profile-actions"><button type="button" aria-label="메시지함" data-menu-unavailable="메시지함">${icons.mail}</button><button type="button" aria-label="찜목록" data-menu-unavailable="찜목록">${icons.heart}</button></span></div>
    <h2 class="imm-heading">전체서비스</h2>
    <div class="imm-shortcuts">${shortcuts.map(([label, symbol, href]) => action(label, href, `<span class="imm-icon">${icons[symbol as keyof typeof icons]}</span><span class="imm-shortcut-label">${label}</span>`, "imm-shortcut")).join("")}</div>
    <section class="imm-card"><h3>마이룸</h3><div class="imm-room-grid">${room.map(([label, href]) => action(label, href, label, "imm-room-link")).join("")}</div></section>
    <section class="imm-card imm-app-card"><h3>아이템매니아 APP</h3><div class="imm-app-links"><button type="button" data-menu-unavailable="아이템매니아 APP"><span class="imm-app-icon">m</span>아이템매니아</button><button type="button" data-menu-unavailable="게임시세 APP"><span class="imm-app-icon imm-app-icon-price">m</span>게임시세</button></div></section>
    <div class="imm-feedback" role="status" aria-live="polite"></div>
  </aside></div>`;
}

export function mobileMenuStyles(): string {
  return `<style>
#im-mobile-menu,#im-mobile-menu *{box-sizing:border-box}
#im-mobile-menu{position:fixed!important;inset:0!important;z-index:2147483647!important;visibility:hidden;pointer-events:none;font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;letter-spacing:-.5px;color:#16191c;text-align:left;line-height:1.4}
#im-mobile-menu.is-open{visibility:visible;pointer-events:auto}
#im-mobile-menu .imm-backdrop{position:absolute;inset:0;background:rgba(8,12,19,.55);opacity:0;transition:opacity .23s ease}
#im-mobile-menu.is-open .imm-backdrop{opacity:1}
 #im-mobile-menu .imm-drawer{position:absolute;right:0;top:0;bottom:0;width:calc(100% - 69px);max-width:392px;overflow-y:auto;overscroll-behavior:contain;background:#fff;padding:0 24px 46px;transform:translateX(100%);transition:transform .25s ease;scrollbar-width:none;box-shadow:-1px 0 4px #00000012}
 #im-mobile-menu .imm-drawer::-webkit-scrollbar{display:none}
#im-mobile-menu.is-open .imm-drawer{transform:translateX(0)}
#im-mobile-menu a{color:inherit;text-decoration:none}#im-mobile-menu button{font:inherit;cursor:pointer;color:inherit}#im-mobile-menu svg{display:block;width:29px;height:29px}
#im-mobile-menu [hidden]{display:none!important}
#im-mobile-menu a:focus-visible,#im-mobile-menu button:focus-visible{outline:2px solid #1578ce;outline-offset:3px}
#im-mobile-menu .imm-top{height:94px;display:flex;align-items:center;justify-content:space-between}
 #im-mobile-menu .imm-home{color:#a3a5a7;display:grid;place-items:center;width:25px;height:35px}#im-mobile-menu .imm-home svg{width:24px;height:24px}#im-mobile-menu .imm-home path{fill:#a3a5a7;stroke:none}
#im-mobile-menu .imm-top-actions{display:flex;align-items:center;gap:14px}
#im-mobile-menu .imm-auth{border:0;background:#238bdc;color:white!important;border-radius:3px;font-size:14px!important;line-height:23px;padding:0 9px;box-shadow:0 1px 3px #0003}
#im-mobile-menu .imm-auth[hidden]{display:none}
#im-mobile-menu .imm-close{border:0;background:none;padding:0;display:grid;place-items:center;width:25px;height:32px}#im-mobile-menu .imm-close svg{width:28px;height:28px;stroke-width:1.3}
#im-mobile-menu .imm-profile{height:83px;display:flex;align-items:center;gap:13px;min-width:0}
#im-mobile-menu .imm-grade{width:43px;height:47px;flex:none;clip-path:polygon(50% 0,100% 24%,100% 76%,50% 100%,0 76%,0 24%);background:#2cac45;display:grid;place-items:center;color:#2cac45;font-weight:800;font-size:23px;position:relative}
#im-mobile-menu .imm-grade:before{content:"";position:absolute;inset:4px;background:#fff;clip-path:inherit}#im-mobile-menu .imm-grade b{z-index:1}
#im-mobile-menu .imm-grade[hidden]{display:none}#im-mobile-menu .imm-grade[data-grade="gold"]{background:#cf9e32;color:#b0832a}#im-mobile-menu .imm-grade[data-grade="silver"]{background:#8f9cb1;color:#718298}#im-mobile-menu .imm-grade[data-grade="platinum"]{background:#59a9bc;color:#488da4}#im-mobile-menu .imm-grade[data-grade="vip"]{background:#826eb9;color:#6c58a8}
#im-mobile-menu .imm-identity{min-width:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden}#im-mobile-menu .imm-identity strong{font-size:18px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#im-mobile-menu .imm-identity span{font-size:16px;color:#777;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #im-mobile-menu .imm-profile-actions{margin-left:auto;display:flex;gap:12px;flex:none}#im-mobile-menu .imm-profile-actions button{border:0;background:none;padding:0;display:grid;place-items:center}#im-mobile-menu .imm-profile-actions svg{width:27px;height:27px}
#im-mobile-menu .imm-heading{margin:16px 5px 0;border-bottom:1px solid #dedede;padding:0 0 14px;font-size:17px;font-weight:700;line-height:25px}
#im-mobile-menu .imm-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));row-gap:24px;margin:18px 0 40px}
#im-mobile-menu .imm-shortcut{min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:0;border:0;background:none;font-size:15px;white-space:nowrap}
#im-mobile-menu .imm-icon{width:61px;height:61px;border-radius:21px;background:#e8f2fc;display:grid;place-items:center;flex:none}#im-mobile-menu .imm-icon svg{width:32px;height:32px}
#im-mobile-menu .imm-shortcut-label{display:block;width:100%;overflow:hidden;text-overflow:ellipsis;line-height:21px}
#im-mobile-menu .imm-card{border:1px solid #dedede;border-radius:17px;overflow:hidden;margin-bottom:24px}
#im-mobile-menu .imm-card h3{margin:0;background:#e7f2fd;font-size:16px;font-weight:700;height:48px;display:flex;align-items:center;padding:0 23px}
#im-mobile-menu .imm-room-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));row-gap:19px;padding:21px 17px 25px}
#im-mobile-menu .imm-room-link{display:block;min-width:0;padding:0;text-align:left;font-size:15px;line-height:22px;border:0;background:none;white-space:nowrap}
#im-mobile-menu .imm-app-links{padding:17px 20px 20px;display:grid;gap:12px}
#im-mobile-menu .imm-app-links button{display:flex;align-items:center;gap:11px;border:0;background:none;padding:0;text-align:left;font-size:15px}
#im-mobile-menu .imm-app-icon{width:23px;height:23px;border-radius:5px;background:#0fc2d2;color:#fff;display:grid;place-items:center;font-weight:800;font-size:19px;line-height:1;box-shadow:inset 0 -3px #e5edfa}
#im-mobile-menu .imm-app-icon-price{background:#27a2bc}
 #im-mobile-menu .imm-feedback{display:none;position:fixed;bottom:24px;right:20px;width:min(340px,calc(100% - 109px));z-index:1;padding:12px 14px;border-radius:9px;background:#26394b;color:#fff;font-size:13px;text-align:center;box-shadow:0 4px 16px #0003}
 #im-mobile-menu .imm-feedback.has-message{display:block}
@media(min-width:781px){body:has(#im-mobile-home) #im-mobile-menu{display:none!important}}
@media(max-width:390px){#im-mobile-menu .imm-drawer{width:calc(100% - 54px);padding-left:18px;padding-right:18px}#im-mobile-menu .imm-icon{width:56px;height:56px}#im-mobile-menu .imm-shortcut{font-size:13px}#im-mobile-menu .imm-room-grid{padding-left:12px;padding-right:12px}#im-mobile-menu .imm-room-link{font-size:13px}}
@media(prefers-reduced-motion:reduce){#im-mobile-menu .imm-backdrop,#im-mobile-menu .imm-drawer{transition:none}}
</style>`;
}

export function mobileMenuScript(buttonId: string): string {
  return `<script>
(function(){
 var menu=document.getElementById('im-mobile-menu'),toggle=document.getElementById('${buttonId}');
 if(!menu||!toggle)return;
 var drawer=menu.querySelector('.imm-drawer'),auth=menu.querySelector('#imm-auth'),grade=menu.querySelector('#imm-grade'),name=menu.querySelector('#imm-nickname'),email=menu.querySelector('#imm-email'),feedback=menu.querySelector('.imm-feedback');
  var previous=null,htmlOverflow='',bodyOverflow='',request=0,feedbackTimer;
 var preview=new URLSearchParams(location.search).get('mobile')==='1';
 var home=preview?'/?mobile=1':'/';
  if(preview)menu.querySelectorAll('a').forEach(function(a){var url=new URL(a.href,location.origin);if(['/','/myroom/chat/list.html','/myroom/index.html','/mobile-game-search'].includes(url.pathname)){url.searchParams.set('mobile','1');a.href=url.pathname+url.search+url.hash}});
  function signin(){var target=location.pathname+location.search;location.href='/login?returnUrl='+encodeURIComponent(target)}
  function notice(message){feedback.textContent=message;feedback.classList.add('has-message');clearTimeout(feedbackTimer);feedbackTimer=setTimeout(function(){feedback.classList.remove('has-message');feedback.textContent=''},3200)}
 function showGuest(){grade.hidden=true;name.textContent='로그인이 필요합니다';email.textContent='';auth.hidden=false;auth.textContent='로그인';auth.onclick=signin;menu.querySelector('.imm-profile-actions').hidden=true}
 async function showAccount(){
   var current=++request;showGuest();name.textContent='확인 중…';auth.hidden=true;
   try{
     var response=await fetch('/api/auth/me',{credentials:'include',cache:'no-store'});
     if(current!==request)return;
     if(response.status===401){showGuest();return}
     if(!response.ok)throw Error('auth');
     var data=await response.json();if(current!==request)return;
     var user=data&&data.user&&typeof data.user==='object'?data.user:data;
     if(!user||!user.id){showGuest();return}
     name.textContent=typeof user.nickname==='string'?user.nickname:'';
     email.textContent=typeof user.email==='string'?user.email.split('@')[0]:'';
     var allowed={bronze:'B',silver:'S',gold:'G',platinum:'P',vip:'V'},g=String(user.grade||'').toLowerCase();
     grade.hidden=!allowed[g];grade.dataset.grade=g;grade.replaceChildren();
     if(allowed[g]){var letter=document.createElement('b');letter.textContent=allowed[g];grade.appendChild(letter)}
     menu.querySelector('.imm-profile-actions').hidden=false;
     auth.hidden=false;auth.textContent='로그아웃';
     auth.onclick=async function(){
       auth.disabled=true;
       try{var res=await fetch('/api/auth/logout',{method:'POST',credentials:'include'});if(!res.ok)throw Error('logout');location.href=home}
        catch(e){notice('로그아웃에 실패했습니다. 다시 시도해 주세요.');auth.disabled=false}
     };
    }catch(e){if(current!==request)return;showGuest();notice('회원 정보를 불러오지 못했습니다.')}
 }
 function setOpen(open){
   if(open===menu.classList.contains('is-open'))return;
   menu.classList.toggle('is-open',open);menu.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));
    if(open){previous=document.activeElement;htmlOverflow=document.documentElement.style.overflow;bodyOverflow=document.body.style.overflow;document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';drawer.scrollTop=0;feedback.classList.remove('has-message');feedback.textContent='';drawer.focus();showAccount()}
    else{++request;clearTimeout(feedbackTimer);feedback.classList.remove('has-message');document.documentElement.style.overflow=htmlOverflow;document.body.style.overflow=bodyOverflow;if(previous&&typeof previous.focus==='function')previous.focus()}
 }
 toggle.addEventListener('click',function(){setOpen(!menu.classList.contains('is-open'))});
 menu.querySelectorAll('[data-menu-dismiss]').forEach(function(el){el.addEventListener('click',function(){setOpen(false)})});
 document.addEventListener('keydown',function(e){
   if(!menu.classList.contains('is-open'))return;
   if(e.key==='Escape'){e.preventDefault();setOpen(false);return}
   if(e.key!=='Tab')return;
   var focusables=Array.from(drawer.querySelectorAll('a[href],button:not([disabled]):not([hidden])')).filter(function(el){return el.getClientRects().length>0});
   if(!focusables.length){e.preventDefault();drawer.focus();return}
   if(e.shiftKey&&document.activeElement===focusables[0]){e.preventDefault();focusables[focusables.length-1].focus()}
   else if(!e.shiftKey&&document.activeElement===focusables[focusables.length-1]){e.preventDefault();focusables[0].focus()}
   else if(document.activeElement===drawer){e.preventDefault();focusables[e.shiftKey?focusables.length-1:0].focus()}
 });
  menu.querySelectorAll('[data-menu-unavailable]').forEach(function(button){button.addEventListener('click',function(){notice(button.getAttribute('data-menu-unavailable')+' 서비스는 현재 이용할 수 없습니다.')})});
})();
</script>`;
}