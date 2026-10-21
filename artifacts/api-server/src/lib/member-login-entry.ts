export function memberLoginLabel(brandName: string = ""): string {
  const label = (brandName.trim() ? brandName.trim() + " " : "") + "회원 로그인";
  return label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function memberLoginEntry(html: string, brandName: string = ""): string {
  const label = memberLoginLabel(brandName);
  return html.replace(
    /<button\b[^>]*\bid=(?:"naver_id_login"|naver_id_login)(?=\s|>)[^>]*>[\s\S]*?<\/button>/g,
    () => `<a href="/login/member" id="im_member_login" class="btn btn_green im-member-login" aria-label="${label}">${label}</a>`,
  );
}
