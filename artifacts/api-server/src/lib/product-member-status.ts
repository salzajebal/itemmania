import { load } from "cheerio";

// Reference-style display label, not a new live-presence or session API.
export const PRODUCT_MEMBER_ONLINE_BADGE = '<span class="product-member-online"><span class="product-member-online-dot" aria-hidden="true"></span>접속중</span>';
export const PRODUCT_MEMBER_ONLINE_STYLE = `
.product-member-online{display:inline-flex!important;align-items:center;gap:5px;padding:2px 8px;border-radius:12px;background:#eef9ef;color:#299c43;font-size:12px;font-weight:600;line-height:18px;white-space:nowrap;vertical-align:middle}
.product-member-online-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#36b44c;flex:none}
.certify_info .user_info .product-member-status{display:block;margin-top:5px;line-height:22px}
.certify_info .user_info .credit_mark{position:relative}
.certify_info .user_info .credit_mark::after{content:"";position:absolute;right:0;bottom:0;width:8px;height:8px;background:#36b44c;border:2px solid #fff;border-radius:50%}
`;

/** Change only the captured member-info fragment, preserving the remaining snapshot bytes. */
export function applyProductMemberStatus(html: string): string {
  let replaced = false;
  const result = html.replace(
    /<div\s+class=(?:"user_info"|user_info)>[\s\S]*?(?=<ul\s+class=(?:"add_info"|add_info)>)/g,
    fragment => {
      const $ = load(fragment, {}, false);
      const info = $(".user_info").first();
      if (!info.length) return fragment;
      info.find(".success_rate,.product-member-status").remove();
      const details = info.children("div").last();
      (details.length ? details : info).append(`<div class="product-member-status">${PRODUCT_MEMBER_ONLINE_BADGE}</div>`);
      replaced = true;
      return $.html();
    },
  );
  if (!replaced || result.includes('id="product-member-online-style"')) return result;
  const style = `<style id="product-member-online-style">${PRODUCT_MEMBER_ONLINE_STYLE}</style>`;
  return result.includes("</head>") ? result.replace("</head>", style + "</head>") : style + result;
}
