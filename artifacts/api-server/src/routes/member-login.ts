import { memberLoginLabel } from "../lib/member-login-entry";

export function renderMemberLogin(fontStyles: string = "", backHref = "/login", logoUrl: string | null = null, brandName: string = ""): string {
  const label = memberLoginLabel(brandName);
  const safeBackHref = backHref.startsWith("/login?") || backHref === "/login" ? backHref : "/login";
  const escapedBackHref = safeBackHref.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const logo = logoUrl?.startsWith("/api/member-login/logo?v=")
    ? `<img class="ml-logo" src="${logoUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}" alt="사이트 로고">` : "";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="data:,"><title>${label}</title>
<style>${fontStyles}
html,body{margin:0;min-height:100%;background:#fff}
#member-login,#member-login *{box-sizing:border-box}
#member-login{min-height:100dvh;background:#fff;color:#1d2a22;font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;font-size:15px;line-height:1.45}
#member-login button,#member-login input{font:inherit}
#member-login .ml-top{height:56px;display:flex;align-items:center;padding:0 10px}
#member-login .ml-back{width:40px;height:40px;display:grid;place-items:center;color:#1d2a22;border-radius:8px}
#member-login .ml-back svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#member-login .ml-main{max-width:600px;margin:0 auto;padding:40px 28px 80px}
#member-login .ml-logo{display:block;max-width:240px;width:auto;max-height:90px;height:auto;object-fit:contain;margin:0 auto 18px}
#member-login h1{margin:0 0 58px;font-size:20px;font-weight:700;color:#222;text-align:center}
#member-login label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
#member-login .ml-field{display:block;width:100%;height:60px;margin:0 0 40px;padding:0 5px;border:0;border-bottom:1px solid #dedede;border-radius:0;background:#fff;color:#222;font-size:20px;outline:0}
#member-login .ml-field:focus{border-color:#0a8f4a;box-shadow:0 0 0 3px #0a8f4a26}
#member-login .ml-submit{width:100%;height:66px;margin-top:8px;border:0;border-radius:10px;background:#03b753;color:#fff;font-size:22px;font-weight:700;cursor:pointer}
#member-login .ml-submit:disabled{opacity:.6;cursor:wait}
#member-login a:focus-visible,#member-login button:focus-visible{outline:2px solid #06703a;outline-offset:2px}
#member-login .ml-err{min-height:20px;margin:0 0 10px;color:#b92b32;font-size:13px}
</style></head><body><div id="member-login">
<header class="ml-top"><a class="ml-back" href="${escapedBackHref}" aria-label="뒤로 가기"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M27 16H5m0 0 9-9m-9 9 9 9"/></svg></a></header>
<main class="ml-main">${logo}<h1>${label}</h1>
<form name="g_LOGIN_FORM" id="ml-form" method="post">
<label for="user_id">사이트 회원 아이디 또는 전화번호</label>
<input class="ml-field" id="user_id" name="user_id" type="text" autocomplete="username" maxlength="40" placeholder="아이디 또는 전화번호" required>
<label for="user_password">사이트 회원 비밀번호</label>
<input class="ml-field" id="user_password" name="user_password" type="password" autocomplete="current-password" placeholder="비밀번호" required>
<div class="ml-err" id="_im_login_err" role="alert"></div>
<button class="ml-submit" type="submit">로그인</button></form></main></div>
</body></html>`;
}
