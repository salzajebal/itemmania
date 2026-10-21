import { mobileMenuMarkup, mobileMenuScript, mobileMenuStyles } from "./mobile-menu";
import { memberLoginLabel } from "../lib/member-login-entry";

const icon = (body: string): string => `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
const home = icon('<path d="m4 14 12-10 12 10v14h-9v-9h-6v9H4Z"/>');
const chat = icon('<path d="M16 4C9 4 4 8 4 14c0 3 1 5 3 7l-1 6 7-3c1 .3 2 .4 3 .4 7 0 12-4 12-10S23 4 16 4Z"/><circle cx="11" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="21" cy="14" r="1"/>');
const search = icon('<circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/>');
const person = icon('<circle cx="16" cy="10" r="5"/><path d="M5 29c0-7 4-11 11-11s11 4 11 11"/>');
const menu = icon('<path d="M4 8h24M4 16h24M4 24h24"/>');

export function renderMobileLogin(fontFaceStyles: string, brandName: string = ""): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="data:,"><title>로그인 | 아이템매니아</title>
${mobileMenuStyles()}<style>${fontFaceStyles}
html,body{min-width:0;width:100%;margin:0;min-height:100%;background:#fff;overflow-x:hidden}
#im-mobile-login,#im-mobile-login *{box-sizing:border-box}
#im-mobile-login{min-height:100dvh;color:#202124;font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;font-size:14px;line-height:1.4;background:#fff;padding-bottom:calc(66px + env(safe-area-inset-bottom))}
#im-mobile-login a{color:inherit;text-decoration:none}#im-mobile-login button,#im-mobile-login input{font:inherit}#im-mobile-login button{cursor:pointer}
#im-mobile-login .iml-header{height:56px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:center;position:relative}
#im-mobile-login .iml-header strong{font-size:20px;font-weight:700}
#im-mobile-login .iml-back{position:absolute;left:10px;top:0;height:56px;width:30px;border:0;background:none;padding:0;display:grid;place-items:center}
#im-mobile-login .iml-back svg{width:25px;height:25px;fill:none;stroke:#1d1d1d;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#im-mobile-login .iml-main{max-width:500px;margin:0 auto;padding:50px 10px 120px}
#im-mobile-login .iml-field{display:block;width:100%;height:51px;padding:0 20px;border:1px solid #d5d5d5;border-radius:10px;outline:0;color:#222;background:#fff;font-size:15px;box-shadow:0 1px 2px #0000000b}
#im-mobile-login .iml-field::placeholder{color:#777;opacity:1}
#im-mobile-login .iml-field:focus{border-color:#199ff4;box-shadow:0 0 0 2px #199ff426}
#im-mobile-login .iml-password{margin-top:20px}
#im-mobile-login .iml-options{display:flex;gap:24px;align-items:center;margin:13px 4px 0}
#im-mobile-login .iml-options label{display:flex;align-items:center;gap:8px;white-space:nowrap;cursor:pointer;font-size:14px}
#im-mobile-login .iml-options input{appearance:none;width:23px;height:23px;flex:none;margin:0;border:1px solid #dedede;border-radius:4px;background:#fff;box-shadow:0 1px 2px #00000010;display:grid;place-items:center}
#im-mobile-login .iml-options input:after{content:"";width:11px;height:6px;border-left:2px solid #dedede;border-bottom:2px solid #dedede;transform:translateY(-2px) rotate(-45deg)}
#im-mobile-login .iml-options input:checked{background:#159efd;border-color:#159efd}
#im-mobile-login .iml-options input:checked:after{border-color:#fff}
#im-mobile-login .iml-options input:focus-visible,#im-mobile-login a:focus-visible,#im-mobile-login button:focus-visible{outline:2px solid #116ac2;outline-offset:2px}
#im-mobile-login .iml-submit,#im-mobile-login .iml-naver{width:100%;height:51px;border:0;border-radius:9px;color:#fff;font-size:17px;box-shadow:0 2px 4px #00000012}
#im-mobile-login .iml-submit{margin-top:21px;background:#159efd}
#im-mobile-login .iml-submit:disabled{opacity:.6;cursor:wait}
#im-mobile-login .iml-naver{margin-top:10px;background:#00c653;display:flex;justify-content:center;align-items:center;gap:9px}
#im-mobile-login .iml-naver b{font-weight:900;font-size:21px;line-height:1}
#im-mobile-login .iml-links{display:flex;gap:10px;align-items:center;margin-top:19px;font-size:14px}
#im-mobile-login .iml-links i{height:13px;width:1px;background:#dedede}
#im-mobile-login .iml-links .iml-join{margin-left:auto}
#im-mobile-login .iml-adult{display:flex;align-items:flex-start;gap:9px;margin-top:70px;font-size:13px;line-height:1.35;color:#444}
#im-mobile-login .iml-adult-badge{flex:none;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#ee2836;color:#fff;font-weight:700;font-size:14px}
#im-mobile-login .iml-adult p{margin:0}
#im-mobile-login .iml-adult a{display:inline-block;margin-top:9px;border-radius:15px;background:#555;color:#fff;padding:4px 14px;font-size:12px}
#im-mobile-login .iml-help{min-height:0;color:#b92b32;font-size:13px;margin:8px 0 0}
#im-mobile-login .iml-nav{position:fixed;z-index:100;left:0;right:0;bottom:0;height:calc(66px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;background:linear-gradient(100deg,#2187ed 0%,#128cc2 49%,#00ae72 100%);color:white}
#im-mobile-login .iml-nav a,#im-mobile-login .iml-nav button{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;background:none;color:#fff;font-size:12px;padding:4px 0}
#im-mobile-login .iml-nav svg{width:27px;height:27px;display:block;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
#im-mobile-login .iml-nav .iml-home svg{fill:#fff}
#im-mobile-login .iml-nav .iml-center{width:70px;height:70px;align-self:start;justify-self:center;transform:translateY(-10px);background:#fff;color:#333;border-radius:50%;box-shadow:0 1px 5px #0004}
#im-mobile-login .iml-nav .iml-center svg{width:35px;height:35px;stroke:#333;stroke-width:2.4}
@media(max-width:350px){#im-mobile-login .iml-options{gap:12px}#im-mobile-login .iml-options label{font-size:12px}}
</style></head><body><div id="im-mobile-login">
<header class="iml-header"><button type="button" class="iml-back" id="iml-back" aria-label="뒤로 가기">${icon('<path d="M27 16H5m0 0 9-9m-9 9 9 9"/>')}</button><strong>로그인</strong></header>
<main class="iml-main"><form name="g_LOGIN_FORM" id="iml-form" method="post">
<input class="iml-field" id="user_id" name="user_id" type="text" placeholder="아이디를 입력해주세요." autocomplete="username" maxlength="40" aria-label="아이디">
<input class="iml-field iml-password" id="user_password" name="user_password" type="password" placeholder="비밀번호를 입력해주세요." autocomplete="current-password" aria-label="비밀번호">
<div class="iml-options"><label><input type="checkbox" id="id_save" name="id_save">아이디 저장</label><label><input type="checkbox" id="auto_login" name="auto_login">자동 로그인</label></div>
<button class="iml-submit" type="submit">로그인</button></form>
<a href="/login/member" class="iml-naver im-member-login" id="im_member_login">${memberLoginLabel(brandName)}</a>
<div class="iml-links"><a href="/customer" data-iml-help="아이디 찾기는 고객센터에 문의해 주세요.">아이디 찾기</a><i></i><a href="/customer" data-iml-help="비밀번호 찾기는 고객센터에 문의해 주세요.">비밀번호 찾기</a><a class="iml-join" href="/join">회원가입</a></div>
<p class="iml-help" id="iml-help" role="status" aria-live="polite"></p>
<div class="iml-adult"><span class="iml-adult-badge" aria-label="19세 미만 이용 불가">19</span><div><p>본 정보내용은 청소년유해매체물로서 [정보통신망 이용촉진 및 정보보호 등에 관한 법률] 및 [청소년 보호법]에 따라 19세 미만의 청소년이 이용할 수 없습니다.</p><a href="/">19세 미만 나가기</a></div></div></main>
<nav class="iml-nav" aria-label="하단 메뉴"><a class="iml-home" href="/">${home}<span>홈</span></a><a href="/myroom/chat/list.html">${chat}<span>채팅</span></a><button type="button" class="iml-center" id="iml-search" aria-label="게임 검색">${search}</button><a href="/myroom/index.html">${person}<span>마이룸</span></a><button type="button" id="iml-menu-button" aria-label="메뉴" aria-expanded="false">${menu}<span>메뉴</span></button></nav>
${mobileMenuMarkup()}</div>
<script>(function(){
  var saved=document.getElementById('id_save'),user=document.getElementById('user_id');
  try{var value=localStorage.getItem('im-login-saved-id');if(value){user.value=value;saved.checked=true}}catch(e){}
  document.getElementById('iml-back').addEventListener('click',function(){if(history.length>1)history.back();else location.href='/'});
  document.getElementById('iml-search').addEventListener('click',function(){location.href='/mobile-game-search?mode=search'+(new URLSearchParams(location.search).get('mobile')==='1'?'&mobile=1':'')});
  document.querySelectorAll('[data-iml-help]').forEach(function(link){link.addEventListener('click',function(e){e.preventDefault();document.getElementById('iml-help').textContent=link.getAttribute('data-iml-help')})});
  if(new URLSearchParams(location.search).get('mobile')==='1')document.querySelectorAll('.iml-nav a[href]').forEach(function(link){link.href=link.getAttribute('href')+(link.getAttribute('href').includes('?')?'&':'?')+'mobile=1'});
})();</script>${mobileMenuScript("iml-menu-button")}
</body></html>`;
}