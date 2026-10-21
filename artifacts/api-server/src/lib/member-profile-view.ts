export const MEMBER_PROFILE_MOBILE_STYLE = `@media (max-width:767px){.im-member-profile{width:100%!important;float:none!important}}`;

const CSS = `
.im-member-profile{font-family:inherit;color:#333;font-size:13px;line-height:1.5}
.im-member-profile *{box-sizing:border-box}
.im-member-profile h3.imp-title{margin:30px 0 12px;font-size:20px;font-weight:bold;color:#222}
.im-member-profile .imp-note{border:1px solid #d7e3f5;background:#f4f8fe;padding:12px 14px;margin-bottom:16px;color:#456;font-size:12px}
.im-member-profile .imp-sub{margin:18px 0 8px;font-size:14px;font-weight:bold;color:#1f4fa3}
.im-member-profile table{width:100%;border-collapse:collapse;border-top:2px solid #2f6fd0;background:#fff}
.im-member-profile th{width:150px;background:#f4f8fe;text-align:left;padding:12px 14px;border-bottom:1px solid #dde5f0;font-weight:bold;color:#333;vertical-align:middle}
.im-member-profile td{padding:10px 14px;border-bottom:1px solid #dde5f0}
.im-member-profile input[type=text],.im-member-profile input[type=tel]{width:100%;max-width:340px;height:34px;padding:0 10px;border:1px solid #c5ccd6;background:#fff;font-size:13px;font-family:inherit}
.im-member-profile input:focus{outline:2px solid #2f6fd0;outline-offset:-1px;border-color:#2f6fd0}
.im-member-profile input:disabled{background:#f1f3f6;color:#888}
.im-member-profile .imp-msg{min-height:20px;margin:12px 0 0;font-size:13px}
.im-member-profile .imp-err{color:#d33}
.im-member-profile .imp-ok{color:#1f4fa3;font-weight:bold}
.im-member-profile .imp-btns{text-align:center;margin:20px 0 40px}
.im-member-profile .imp-btn{display:inline-block;min-width:110px;height:40px;line-height:38px;padding:0 20px;margin:0 3px;border:1px solid #2f6fd0;font-size:14px;font-weight:bold;text-align:center;text-decoration:none;cursor:pointer;font-family:inherit;vertical-align:top}
.im-member-profile .imp-save{background:#2f6fd0;color:#fff}
.im-member-profile .imp-save:disabled{background:#9db8e3;border-color:#9db8e3;cursor:default}
.im-member-profile .imp-cancel{background:#fff;color:#2f6fd0}
.im-member-profile .imp-retry{margin-left:8px;height:26px;padding:0 10px;border:1px solid #d33;background:#fff;color:#d33;cursor:pointer;font-family:inherit}
@media (max-width:767px){
.im-member-profile th,.im-member-profile td{display:block;width:100%;border-bottom:0}
.im-member-profile th{padding:10px 12px 4px;background:#f4f8fe}
.im-member-profile td{padding:6px 12px 12px;border-bottom:1px solid #dde5f0}
.im-member-profile input[type=text],.im-member-profile input[type=tel]{max-width:none;height:40px;font-size:16px}
.im-member-profile .imp-btn{min-width:46%}
}`;

const SCRIPT = `
(function(){
var root=document.querySelector('.im-member-profile');
if(!root)return;
var form=document.getElementById('member-profile-form');
var save=document.getElementById('profile-save');
var msg=document.getElementById('profile-message');
var keys=['name','phone','bankName','bankAccountNumber','bankAccountHolder'];
var labels={name:'이름',phone:'휴대폰 번호',bankName:'은행명',bankAccountNumber:'계좌번호',bankAccountHolder:'예금주'};
var loading=true,saving=false,loaded=false;
function el(k){return document.getElementById('profile-'+k);}
function sync(){save.disabled=loading||saving||!loaded;save.textContent=saving?'저장 중...':'저장';keys.forEach(function(k){el(k).disabled=loading||saving;});}
function show(text,type,retry){
msg.textContent='';msg.className='imp-msg'+(type==='err'?' imp-err':type==='ok'?' imp-ok':'');
msg.setAttribute('role',type==='err'?'alert':'status');
msg.appendChild(document.createTextNode(text||''));
if(retry){var b=document.createElement('button');b.type='button';b.className='imp-retry';b.textContent='다시 시도';b.addEventListener('click',load);msg.appendChild(b);}
}
function login(){location.href='/login?redirect='+encodeURIComponent('/myroom/myinfo/myinfo_check.html');}
function fill(d){keys.forEach(function(k){var v=d&&typeof d[k]==='string'?d[k]:'';el(k).value=v;});}
function load(){
loading=true;loaded=false;sync();show('회원정보를 불러오는 중입니다.','');
fetch('/api/auth/profile',{credentials:'include',cache:'no-store'}).then(function(r){
if(r.status===401){login();return null;}
if(!r.ok)throw new Error('http');
return r.json();
}).then(function(d){
if(!d)return;
fill(d);loaded=true;loading=false;sync();show('','');
}).catch(function(){
loading=false;sync();show('회원정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.','err',true);
});
}
function validate(v){
var any=0;['bankName','bankAccountNumber','bankAccountHolder'].forEach(function(k){if(v[k])any++;});
if(any>0&&any<3)return '은행명, 계좌번호, 예금주는 모두 입력하거나 모두 비워 주세요.';
if(v.phone&&!/^[0-9+() -]{8,20}$/.test(v.phone))return '휴대폰 번호 형식이 올바르지 않습니다.';
return '';
}
form.addEventListener('submit',function(e){
e.preventDefault();
if(loading||saving||!loaded)return;
var v={};keys.forEach(function(k){v[k]=el(k).value.trim();});
var err=validate(v);
if(err){show(err,'err');return;}
saving=true;sync();show('저장 중입니다.','');
fetch('/api/auth/profile',{method:'PATCH',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)}).then(function(r){
if(r.status===401){login();return null;}
return r.json().catch(function(){return null;}).then(function(d){
if(!r.ok){var m=d&&typeof d.error==='string'&&/[가-힣]/.test(d.error)?d.error:'저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.';throw new Error(m);}
return d;
});
}).then(function(d){
if(!d)return;
fill(d);saving=false;sync();show('개인정보가 저장되었습니다.','ok');
}).catch(function(x){
saving=false;sync();show(x&&x.message&&x.message!=='Failed to fetch'?x.message:'저장하지 못했습니다. 네트워크 상태를 확인해 주세요.','err');
});
});
sync();load();
})();`;

function row(key: string, label: string, type: string, extra: string): string {
  return `<tr><th scope="row"><label for="profile-${key}">${label}</label></th><td><input type="${type}" id="profile-${key}" name="${key}" maxlength="${extra}" autocomplete="off" disabled></td></tr>`;
}

export function renderMemberProfileContent(): string {
  return `<style>${CSS}</style>
<div class="im-member-profile">
<h3 class="imp-title">개인정보수정</h3>
<div class="imp-note">입력하신 정보는 회원이 직접 입력한 정보이며, 은행 또는 문자(SMS) 본인인증을 거친 정보가 아닙니다. 휴대폰·계좌 변경 시 해당 인증 표시는 해제됩니다. 모든 항목은 선택 입력이며, 은행 정보는 은행명, 계좌번호, 예금주를 모두 입력하거나 모두 비워 주세요.</div>
<form id="member-profile-form" novalidate>
<div class="imp-sub">기본 정보</div>
<table><caption style="display:none">기본 정보</caption><tbody>
${row("name", "이름", "text", "50")}
${row("phone", "휴대폰 번호", "tel", "20")}
</tbody></table>
<div class="imp-sub">계좌 정보</div>
<table><caption style="display:none">계좌 정보</caption><tbody>
${row("bankName", "은행명", "text", "30")}
${row("bankAccountNumber", "계좌번호", "text", "30")}
${row("bankAccountHolder", "예금주", "text", "50")}
</tbody></table>
<p id="profile-message" class="imp-msg" role="status" aria-live="polite"></p>
<div class="imp-btns"><button type="submit" id="profile-save" class="imp-btn imp-save" disabled>저장</button><a href="/myroom/index.html" class="imp-btn imp-cancel">취소</a></div>
</form>
</div>
<script>${SCRIPT}</script>`;
}
