import { Router } from "express";

const router = Router();
router.get("/member-password", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!req.session?.userId) {
    res.redirect("/login?returnUrl=%2Fmember-password");
    return;
  }
  res.type("html").send(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>비밀번호 변경</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f8fa;font-family:Arial,sans-serif;color:#222}
main{max-width:460px;margin:64px auto;padding:28px;background:#fff;border:1px solid #ddd;border-radius:12px}
h1{font-size:23px;margin-top:0}p{font-size:14px;line-height:1.6;color:#555}
label{display:block;margin-top:20px;font-size:14px}input{width:100%;padding:12px;margin-top:8px;border:1px solid #ccc;border-radius:6px;font-size:16px}
button{width:100%;padding:13px;margin-top:24px;border:0;border-radius:6px;background:#00b65b;color:#fff;font-size:16px;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}#message{color:#b42318}a{color:#14814a}nav{margin-top:20px}
@media(max-width:500px){main{margin:24px 16px;padding:22px}}
</style></head><body><main><h1>비밀번호 변경</h1>
<p>관리자에게 받은 임시 비밀번호 또는 현재 비밀번호를 입력하고, 본인만 아는 새 비밀번호로 변경하세요. 변경 후 모든 회원 로그인 세션이 해제되며 다시 로그인해야 합니다.</p>
<form id="password-form">
<label for="current-password">현재 비밀번호</label><input id="current-password" type="password" autocomplete="current-password" required>
<label for="new-password">새 비밀번호 (8~16자)</label><input id="new-password" type="password" autocomplete="new-password" minlength="8" maxlength="16" required>
<label for="confirm-password">새 비밀번호 확인</label><input id="confirm-password" type="password" autocomplete="new-password" minlength="8" maxlength="16" required>
<p id="message" role="alert"></p><button id="password-save" type="submit">비밀번호 변경</button>
</form><nav><a href="/myroom/">마이룸으로 돌아가기</a></nav></main>
<script>
(function(){
var form=document.getElementById('password-form'),button=document.getElementById('password-save'),message=document.getElementById('message');
form.addEventListener('submit',async function(event){
event.preventDefault();if(button.disabled)return;
var current=document.getElementById('current-password'),next=document.getElementById('new-password'),confirm=document.getElementById('confirm-password');
message.textContent='';
if(next.value!==confirm.value){message.textContent='새 비밀번호와 확인 값이 일치하지 않습니다.';return}
button.disabled=true;
try{
var response=await fetch('/api/auth/password',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:current.value,newPassword:next.value})});
var data=await response.json();
if(!response.ok)throw new Error(data.error||'비밀번호를 변경하지 못했습니다.');
form.reset();form.hidden=true;message.textContent='';
var notice=document.createElement('p');notice.textContent=data.message;form.parentNode.insertBefore(notice,form);
var link=document.createElement('a');link.href='/login';link.textContent='새 비밀번호로 로그인';form.parentNode.insertBefore(link,form);
}catch(error){message.textContent=error.message||'서버에 연결하지 못했습니다.'}
finally{button.disabled=false;current.value=''}
});
})();
</script></body></html>`);
});
export default router;
