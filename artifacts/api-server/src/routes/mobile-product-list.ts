import { mobileMenuMarkup, mobileMenuScript, mobileMenuStyles } from "./mobile-menu";

export type ListingProduct = {
  id: string;
  dbId?: number;
  title: string;
  sellerName: string;
  sellerGrade?: string;
  isPremium?: boolean;
  featured?: boolean;
  percentage?: number;
  immediate?: boolean;
  gameName: string;
  serverName: string;
  itemCategory: string;
  goodsType?: "general" | "split" | "hongjeong";
  tradeState?: "waiting" | "ended";
  conditions?: string[];
  price: number;
  quantity: string;
  time: string;
  timestamp: number;
  online?: boolean;
  badge?: string;
  minPrice?: string;
  unitPrice?: string;
  source?: string;
};

const escapeHtml = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char] || char);
const safeJson = (value: unknown): string => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const icon = (paths: string) => `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">${paths}</svg>`;
const icons = {
  arrow: icon('<path d="M27 16H5m0 0 9-9m-9 9 9 9"/>'),
  down: icon('<circle cx="16" cy="16" r="12"/><path d="m11 14 5 5 5-5"/>'),
  sliders: icon('<path d="M3 8h10m6 0h10M3 16h4m6 0h16M3 24h16m6 0h4"/><circle cx="16" cy="8" r="3"/><circle cx="10" cy="16" r="3"/><circle cx="22" cy="24" r="3"/>'),
  home: icon('<path d="m4 14 12-10 12 10v14h-9v-9h-6v9H4Z"/>'),
  chat: icon('<path d="M16 4C9 4 4 8 4 14c0 3 1 5 3 7l-1 6 7-3c1 .3 2 .4 3 .4 7 0 12-4 12-10S23 4 16 4Z"/><circle cx="11" cy="14" r="1"/><circle cx="16" cy="14" r="1"/><circle cx="21" cy="14" r="1"/>'),
  search: icon('<circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/>'),
  person: icon('<circle cx="16" cy="10" r="5"/><path d="M5 29c0-7 4-11 11-11s11 4 11 11"/>'),
  menu: icon('<path d="M4 8h24M4 16h24M4 24h24"/>'),
  up: icon('<path d="M16 27V5m0 0L7 14m9-9 9 9"/>'),
  camera: icon('<path d="M3 10h6l2-3h10l2 3h6v17H3z"/><circle cx="16" cy="18" r="5"/>'),
  write: icon('<path d="M5 27h22M8 23l1-6L22 4l6 6-13 13-7 1zM19 7l6 6"/>'),
};

const categories = [
  { value: "", label: "전체" },
  { value: "게임머니", label: "게임머니" },
  { value: "아이템", label: "아이템" },
  { value: "계정", label: "계정" },
  { value: "기타", label: "기타" },
];

function card(product: ListingProduct, side: "sell" | "buy"): string {
  const id = product.dbId ?? product.id;
  const href = `/${side}/application.html?id=${encodeURIComponent(String(id))}`;
  const ended = product.tradeState === "ended";
  const featured = side === "buy" ? !!product.featured : product.isPremium === true || !!product.badge;
  const grade = product.sellerGrade ? `<span class="mpl-grade">우수회원</span>` : "";
  const premium = product.isPremium === true ? `<span class="mpl-premium-label">프리미엄</span>` : "";
  const score = Number.isFinite(product.percentage) ? `<span class="mpl-score" style="--mpl-score:${Math.max(0, Math.min(100, Number(product.percentage)))}%">${Math.round(Number(product.percentage))}%</span>` : "";
  const immediate = product.immediate ? `<span class="mpl-immediate">즉시구매</span>` : "";
  const quantity = product.quantity ? `<span class="mpl-quantity">${escapeHtml(product.quantity)}</span>` : "";
  const price = Number(product.price || 0).toLocaleString("ko-KR");
  const priceLine = product.unitPrice || `${price}원${product.itemCategory === "계정" ? "" : " (1개당)"}`;
  const min = product.minPrice ? `<span class="mpl-min">최소 ${escapeHtml(product.minPrice)} </span>` : "";
  const online = product.online === true ? `<span class="mpl-online">접속중</span>` : product.online === false ? `<span class="mpl-offline">오프라인</span>` : `<span class="mpl-age">${escapeHtml(product.time)}</span>`;
  const categoryIcon = product.itemCategory === "계정" ? "S" : product.badge?.toLowerCase().includes("로켓") ? "P" : "V";
  const badge = product.badge ? `<span class="mpl-badge">${escapeHtml(product.badge)}</span>` : "";
  return `<${ended ? "div" : "a"} class="mpl-card${featured ? " mpl-featured" : ""}${ended ? " mpl-ended" : ""}" data-category="${escapeHtml(product.itemCategory)}" data-server="${escapeHtml(product.serverName)}" data-online="${product.online === true ? "true" : "false"}" data-price="${Number(product.price) || 0}" data-time="${Number(product.timestamp) || 0}" data-testid="card-product-${escapeHtml(id)}"${ended ? ' role="group" aria-label="거래 완료"' : ` href="${href}"`}>
    <div class="mpl-card-content"${ended ? ' aria-hidden="true"' : ""}>
    <div class="mpl-card-head"><span class="mpl-seller">${escapeHtml(product.sellerName)}</span>${premium}${score}${grade}${immediate}<time>${escapeHtml(product.time)}</time></div>
    <div class="mpl-title-row"><strong class="mpl-title">${escapeHtml(product.title)}</strong><span class="mpl-photo">${icons.camera}</span></div>
    <div class="mpl-card-bottom"><div class="mpl-detail-top"><span class="mpl-hex mpl-hex-${escapeHtml(categoryIcon.toLowerCase())}">${categoryIcon}</span>${badge}${quantity}</div>
    <div class="mpl-detail-bottom">${online}<span class="mpl-price-wrap">${min}<b class="mpl-price">${escapeHtml(priceLine)}</b></span></div></div></div>
    ${ended ? '<span class="mpl-complete" aria-hidden="true">거래 완료</span>' : ""}
  </${ended ? "div" : "a"}>`;
}

export function renderMobileProductList(opts: {
  game: { name: string; code: string; servers: string[] };
  side: "sell" | "buy";
  items: ListingProduct[];
  fontFaceStyles: string;
  initialCategory?: string;
}): string {
  const { game, side, items, fontFaceStyles } = opts;
  const code = encodeURIComponent(game.code);
  const initialCategory = categories.some(category => category.value === opts.initialCategory)
    ? opts.initialCategory : "";
  const initialPremiumCards = items.filter(p => p.isPremium === true && (!initialCategory || p.itemCategory === initialCategory)).map(p => card(p, side)).join("");
  const initialCards = items.filter(p => p.isPremium !== true && (!initialCategory || p.itemCategory === initialCategory)).map(p => card(p, side)).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="data:,"><title>${escapeHtml(game.name)} 상품리스트 | 아이템매니아</title>
${mobileMenuStyles()}<style>${fontFaceStyles}
html,body{margin:0;width:100%;min-width:0;min-height:100%;background:#fff;overflow-x:hidden}
#im-product-list,#im-product-list *{box-sizing:border-box}
#im-product-list{min-height:100dvh;padding-bottom:calc(84px + env(safe-area-inset-bottom));font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;color:#24272b;background:#fff;font-size:15px;letter-spacing:-.55px}
#im-product-list a{color:inherit;text-decoration:none}#im-product-list button,#im-product-list select,#im-product-list input{font:inherit}#im-product-list button{cursor:pointer}
#im-product-list svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
#im-product-list .mpl-top{height:56px;display:flex;align-items:center;gap:8px;padding:0 10px;background:#fff}
#im-product-list .mpl-back{display:grid;place-items:center;width:24px;height:42px;padding:0;border:0;background:transparent;flex:none}
#im-product-list .mpl-back svg{width:25px;height:25px;stroke-width:2.1}
#im-product-list .mpl-location{display:flex;align-items:center;gap:4px;min-width:0;font-size:17px;font-weight:650;white-space:nowrap}
#im-product-list .mpl-location-name{max-width:calc(100vw - 122px);overflow:hidden;text-overflow:ellipsis}
#im-product-list .mpl-server-open{display:flex;align-items:center;gap:3px;max-width:145px;border:0;padding:0;background:none;font-size:17px;font-weight:600;white-space:nowrap}
#im-product-list .mpl-server-open span{overflow:hidden;text-overflow:ellipsis}
#im-product-list .mpl-server-open svg{width:18px;height:18px;flex:none;stroke-width:1.4}
#im-product-list .mpl-controls{height:136px;padding:19px 10px 0;background:#f1f2ff}
#im-product-list .mpl-side-switch{display:grid;grid-template-columns:1fr 1fr;height:47px;border-radius:11px;overflow:hidden;filter:drop-shadow(0 1px 2px #939fc443)}
#im-product-list .mpl-side{display:flex;justify-content:center;align-items:center;gap:9px;font-size:16px;font-weight:750;border:2px solid #1da4f0;background:#f1f2ff;color:#2199dd}
#im-product-list .mpl-side:first-child{border-radius:10px 0 0 10px}#im-product-list .mpl-side:last-child{border-color:#24a331;border-radius:0 10px 10px 0;color:#299637}
#im-product-list .mpl-side.active.sell{background:#209df2;color:#fff}#im-product-list .mpl-side.active.buy{background:#219c24;color:#fff}
#im-product-list .mpl-side-mark{display:inline-grid;place-items:center;width:28px;height:28px;transform:rotate(-21deg);font-size:11px;font-weight:900;color:#fff;background:linear-gradient(140deg,#a7c8e7,#566bd6);clip-path:polygon(50% 0,100% 21%,100% 78%,50% 100%,0 78%,0 21%);text-shadow:0 1px 1px #38587d}
#im-product-list .buy .mpl-side-mark{background:linear-gradient(140deg,#b7dcb4,#34a747)}
#im-product-list .mpl-tab-row{display:flex;align-items:center;gap:6px;margin-top:10px}
#im-product-list .mpl-tab{height:40px;padding:0 12px;border:0;border-radius:25px;background:#fff;font-size:15px;white-space:nowrap}
#im-product-list .mpl-tab.active{background:#1c9ff0;color:#fff;box-shadow:0 2px 3px #70a9d650}
#im-product-list .mpl-filter{margin-left:auto;flex:none;width:40px;height:40px;border:0;border-radius:50%;background:#fff;display:grid;place-items:center}
#im-product-list .mpl-filter svg{width:23px;height:23px;stroke-width:1.5}
#im-product-list .mpl-main{padding:35px 10px 100px;max-width:650px;margin:auto}
#im-product-list .mpl-premium-section{margin:22px 10px 0;max-width:630px;margin-left:auto;margin-right:auto}
#im-product-list .mpl-premium-heading{display:flex;align-items:center;gap:7px;margin:0 0 10px;font-size:18px;line-height:26px;font-weight:750;letter-spacing:-1px}
#im-product-list .mpl-premium-mark{display:inline-grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#35424f;color:#fff;font-size:13px;font-weight:800}
#im-product-list .mpl-premium-results{display:grid;gap:10px}
#im-product-list .mpl-premium-results .mpl-card.mpl-featured,#im-product-list.mpl-buy .mpl-premium-results .mpl-card.mpl-featured{border-color:#b8cce3;background:#eef5ff;box-shadow:0 1px 4px #91a5c336}
#im-product-list .mpl-premium-label{flex:none;padding:1px 6px;border:1px solid #bfd0e2;border-radius:4px;background:#f8fbff;color:#547492;font-size:11px;line-height:17px;font-weight:700}
#im-product-list .mpl-premium-status{margin:10px 0 0;color:#707983;font-size:13px;line-height:19px}
#im-product-list .mpl-section-heading{height:28px;display:flex;justify-content:space-between;align-items:flex-start}
#im-product-list h1{font-size:18px;line-height:26px;margin:0;font-weight:750;letter-spacing:-1px}
#im-product-list .mpl-sort{border:0;background:transparent;padding:3px 2px;color:#303030;font-size:13px;display:flex;align-items:center;gap:2px}
#im-product-list .mpl-sort svg{width:14px;height:14px}
#im-product-list .mpl-results{display:grid;gap:12px}
#im-product-list .mpl-card{display:block;min-width:0;height:145px;padding:13px 13px 10px;border:2px solid #d9dce1;border-radius:10px;background:#fff;box-shadow:0 1px 2px #b8c0cb4a;overflow:hidden}
#im-product-list .mpl-card.mpl-featured{border-color:#91b4d9;background:#eef5ff;box-shadow:0 0 0 1px #b3cce2,0 1px 4px #91a5c36b}
#im-product-list a.mpl-card:active{transform:scale(.995)}
#im-product-list .mpl-card.mpl-ended{position:relative;isolation:isolate;cursor:default}
#im-product-list .mpl-card.mpl-ended:after{content:"";position:absolute;inset:0;z-index:1;border-radius:inherit;background:rgba(237,237,237,.78);pointer-events:none}
#im-product-list .mpl-complete{position:absolute;inset:0;z-index:2;display:grid;place-items:center;color:#202124;font-size:20px;font-weight:800;letter-spacing:-.7px;pointer-events:none}
#im-product-list .mpl-card-head{height:22px;display:flex;align-items:flex-start;gap:9px;font-size:14px;white-space:nowrap}
#im-product-list .mpl-seller{overflow:hidden;text-overflow:ellipsis;max-width:58%}
#im-product-list .mpl-grade{font-size:13px;line-height:20px;border:1px solid #d8e4ed;border-radius:4px;background:#f9fdff;color:#537d99;padding:0 7px;flex:none;margin-top:-1px}
#im-product-list .mpl-score{flex:none;min-width:47px;height:19px;line-height:19px;padding:0 5px;border-radius:11px;background:linear-gradient(90deg,#17a354 var(--mpl-score),#d4d6d7 var(--mpl-score));color:#fff;text-align:center;font-size:12px;font-weight:700;text-shadow:0 1px 2px #226d4d}
#im-product-list .mpl-immediate{flex:none;border:1px solid #d7ebdc;border-radius:4px;background:#f5fff7;color:#368449;font-size:12px;line-height:19px;padding:0 5px}
#im-product-list .mpl-card-head time{margin-left:auto;color:#666;font-size:14px}
#im-product-list .mpl-title-row{display:flex;align-items:center;gap:9px;height:33px;border-bottom:1px solid #dbe0e7;padding-bottom:6px}
#im-product-list .mpl-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:17px;line-height:26px;font-weight:680;min-width:0;letter-spacing:-.75px}
#im-product-list .mpl-photo{flex:none;color:#89a8df;opacity:.85}#im-product-list .mpl-photo svg{width:19px;height:19px;fill:#a9c5ee;stroke:#6697da;stroke-width:1.5}
#im-product-list .mpl-card-bottom{padding-top:6px}
#im-product-list .mpl-detail-top,#im-product-list .mpl-detail-bottom{height:27px;display:flex;align-items:center;gap:8px;min-width:0}
#im-product-list .mpl-hex{width:26px;height:28px;flex:none;display:grid;place-items:center;background:#6e4dbc;clip-path:polygon(50% 0,96% 23%,96% 76%,50% 100%,4% 76%,4% 23%);color:#fff;font-size:15px;font-weight:800;border:0}
#im-product-list .mpl-hex-s{background:#a8aaab}#im-product-list .mpl-hex-p{background:#d22e64}
#im-product-list .mpl-badge{max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:25px;border:1px solid #e1e6eb;border-radius:16px;padding:0 9px;font-size:13px;background:#ffffff8c}
#im-product-list .mpl-quantity{margin-left:auto;color:#65676b;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#im-product-list .mpl-online,#im-product-list .mpl-offline,#im-product-list .mpl-age{flex:none;border-radius:16px;padding:3px 9px;font-size:13px;line-height:19px}
#im-product-list .mpl-online{color:#219d38;background:#e8f9ef}#im-product-list .mpl-online:before{content:"";display:inline-block;width:7px;height:7px;background:#32ad48;border-radius:50%;margin-right:5px;vertical-align:2px}
#im-product-list .mpl-offline,#im-product-list .mpl-age{color:#989da3;background:#f1f2f3}#im-product-list .mpl-offline:before,#im-product-list .mpl-age:before{content:"";display:inline-block;width:7px;height:7px;background:#aeb3b8;border-radius:50%;margin-right:5px;vertical-align:2px}
#im-product-list .mpl-price-wrap{margin-left:auto;min-width:0;display:flex;align-items:baseline;justify-content:flex-end;gap:5px;white-space:nowrap}
#im-product-list .mpl-min{color:#838589;font-size:13px}#im-product-list .mpl-price{font-size:18px;color:#287dbb;letter-spacing:-.6px;overflow:hidden;text-overflow:ellipsis}#im-product-list .mpl-card:not(.mpl-featured) .mpl-price{color:#24272b}
#im-product-list.mpl-buy .mpl-tab.active{background:#219f24;box-shadow:0 2px 3px #7cbb8050}
#im-product-list.mpl-buy .mpl-card.mpl-featured{border-color:#a2c6ab;background:#edf8ee;box-shadow:0 0 0 1px #c5dbc9,0 1px 4px #91ae956b}
#im-product-list.mpl-buy .mpl-card.mpl-featured .mpl-price{color:#14862b}
#im-product-list.mpl-buy .mpl-grade{border-color:#d9e8dc;background:#f9fffa;color:#408450}
#im-product-list.mpl-buy .mpl-apply{background:#229f31}
#im-product-list.mpl-buy .mpl-options button.selected{color:#168c32;border-color:#168c32;background:#effaf1}
#im-product-list.mpl-buy .mpl-sheet input[type=checkbox]{accent-color:#219f24}
#im-product-list.mpl-buy .mpl-section-heading h1:after{content:"?";display:inline-grid;place-items:center;width:16px;height:16px;margin-left:6px;border-radius:50%;background:#2b2d30;color:#fff;font-size:11px;vertical-align:2px}
#im-product-list .mpl-empty{padding:52px 20px;border:1px solid #e3e6ec;border-radius:12px;background:#f7f9fd;text-align:center;color:#687482}
#im-product-list .mpl-empty strong{display:block;color:#293744;font-size:16px;margin-bottom:6px}#im-product-list .mpl-empty p{margin:0;font-size:14px}
#im-product-list .mpl-nav{position:fixed;z-index:30;left:0;right:0;bottom:0;height:calc(66px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;background:linear-gradient(100deg,#2187ed 0%,#128cc2 49%,#00ae72 100%);color:#fff}
#im-product-list .mpl-nav a,#im-product-list .mpl-nav button{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;background:none;color:#fff;font-size:13px;padding:4px 0}
#im-product-list .mpl-nav svg{width:28px;height:28px;stroke-width:2.2}
#im-product-list .mpl-nav .mpl-center{width:70px;height:70px;align-self:start;justify-self:center;transform:translateY(-10px);background:#fff;color:#333;border-radius:50%;box-shadow:0 1px 5px #0004}
#im-product-list .mpl-nav .mpl-center svg{width:37px;height:37px;stroke:#333;stroke-width:2.6}
#im-product-list .mpl-float{position:fixed;z-index:24;bottom:calc(66px + env(safe-area-inset-bottom));left:10px;right:10px;pointer-events:none;display:flex;justify-content:space-between;align-items:end}
#im-product-list .mpl-float a,#im-product-list .mpl-float button{pointer-events:auto;border:1px solid #a4d5e1;background:#ffffffed;border-radius:24px;min-height:45px;padding:0 13px;display:flex;align-items:center;gap:4px;box-shadow:0 1px 4px #0002;font-size:14px}
#im-product-list .mpl-float a svg{width:17px;height:17px;color:#4fb8ce}
#im-product-list .mpl-float-right{display:flex;flex-direction:column;align-items:end;gap:9px}
#im-product-list .mpl-float .mpl-to-top{width:48px;height:48px;border-color:#e4e6e8;border-radius:50%;justify-content:center;padding:0}#im-product-list .mpl-to-top svg{width:22px;height:22px}
#im-product-list .mpl-float .mpl-theme{border-color:#e4e6e8}
#im-product-list .mpl-dialog{position:fixed;inset:0;z-index:60;display:none;align-items:end;background:#16202b77}
#im-product-list .mpl-dialog.open{display:flex}
#im-product-list .mpl-sheet{width:100%;max-width:650px;margin:0 auto;background:#fff;border-radius:20px 20px 0 0;padding:20px 20px calc(25px + env(safe-area-inset-bottom));max-height:80dvh;overflow:auto;box-shadow:0 -8px 28px #0002}
#im-product-list .mpl-sheet-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
#im-product-list .mpl-sheet h2{font-size:19px;margin:0}#im-product-list .mpl-close{border:0;background:none;font-size:27px;line-height:1;padding:0 3px}
#im-product-list .mpl-options{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
#im-product-list .mpl-options button{border:1px solid #dce2e9;border-radius:8px;background:#fff;padding:11px 4px;color:#343e48}
#im-product-list .mpl-options button.selected{color:#168fde;border-color:#168fde;background:#eff8ff}
#im-product-list .mpl-sheet label{display:block;margin:15px 0;font-size:14px;font-weight:600}
#im-product-list .mpl-sheet input[type=number]{width:100%;height:42px;border:1px solid #d5dce4;border-radius:8px;margin-top:6px;padding:0 12px}
#im-product-list .mpl-sheet input[type=checkbox]{width:18px;height:18px;vertical-align:middle;accent-color:#1c9ff0;margin-right:7px}
#im-product-list .mpl-apply{width:100%;border:0;border-radius:9px;background:#1d9ff0;color:#fff;height:47px;margin-top:10px;font-weight:700}
#im-product-list .mpl-dialog.mpl-filter-dialog{bottom:calc(66px + env(safe-area-inset-bottom));z-index:25}
#im-product-list .mpl-filter-sheet{height:calc(100dvh - 140px - env(safe-area-inset-bottom));max-height:calc(100dvh - 140px - env(safe-area-inset-bottom));padding:0 20px 24px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}
#im-product-list .mpl-filter-sheet::-webkit-scrollbar{display:none}
#im-product-list .mpl-filter-header{height:65px;display:flex;align-items:flex-start;justify-content:space-between;padding-top:12px}
#im-product-list .mpl-filter-reset{border:0;background:transparent;padding:2px 0;color:#25282a;font-size:16px}
#im-product-list .mpl-filter-close{width:33px;height:33px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:#f0f1f2;font-size:25px;line-height:1}
#im-product-list .mpl-filter-group{margin-bottom:25px}
#im-product-list .mpl-filter-group h2{font-size:18px;line-height:24px;font-weight:700;margin:0 0 12px;letter-spacing:-.5px}
#im-product-list .mpl-filter-title{display:block;width:100%;height:36px;border:1px solid #c9cacc;border-radius:22px;background:#fff;padding:0 12px;font-size:15px;outline:0}
#im-product-list .mpl-filter-title::placeholder{color:#777}
#im-product-list .mpl-filter-title:focus{border-color:#368cd0}
#im-product-list .mpl-filter-chips{display:flex;flex-wrap:wrap;gap:6px 5px}
#im-product-list .mpl-filter-chip{height:39px;border:0;border-radius:22px;background:#f7f8fa;padding:0 11px;color:#303237;font-size:15px;line-height:1.2;white-space:nowrap}
#im-product-list .mpl-filter-chip.selected{background:#1e9ef2;color:#fff;box-shadow:0 1px 3px #0002}
#im-product-list.mpl-buy .mpl-filter-chip.selected{background:#229d25}
#im-product-list .mpl-filter-search{width:100%;height:60px;display:block;margin:18px 0 0;border:0;border-radius:9px;background:#1d9ff0;color:#fff;font-size:20px;font-weight:700;box-shadow:0 2px 5px #0002}
#im-product-list.mpl-buy .mpl-filter-search{background:#219e24}
#im-product-list .mpl-filter-group:last-of-type{margin-bottom:0}
#im-product-list .mpl-status{font-size:13px;color:#a34444;min-height:18px}
#im-product-list a:focus-visible,#im-product-list button:focus-visible,#im-product-list input:focus-visible{outline:2px solid #0b72bc;outline-offset:2px}
@media(max-width:365px){#im-product-list .mpl-tab{font-size:14px;padding:0 10px}#im-product-list .mpl-price{font-size:16px}#im-product-list .mpl-min{font-size:11px}}
@media(min-width:781px){#im-product-list{max-width:650px;margin:auto}#im-product-list .mpl-nav{max-width:650px;margin:auto}#im-product-list .mpl-float{max-width:626px;margin:auto}}
</style></head><body><div id="im-product-list" class="${side === "buy" ? "mpl-buy" : "mpl-sell"}">
<header class="mpl-top"><button type="button" class="mpl-back" id="mpl-back" aria-label="뒤로 가기">${icons.arrow}</button><div class="mpl-location"><span class="mpl-location-name">${escapeHtml(game.name)}</span><span>〉</span><button type="button" class="mpl-server-open" id="mpl-server-open"><span id="mpl-server-label">서버전체</span>${icons.down}</button></div></header>
<section class="mpl-controls" aria-label="상품 유형"><div class="mpl-side-switch"><a class="mpl-side sell${side === "sell" ? " active" : ""}" id="mpl-sell" href="/sell/list.html?search_game=${code}"><span class="mpl-side-mark">SELL</span>팝니다</a><a class="mpl-side buy${side === "buy" ? " active" : ""}" id="mpl-buy" href="/buy/list.html?search_game=${code}"><span class="mpl-side-mark">BUY</span>삽니다</a></div>
<div class="mpl-tab-row">${categories.map(c => `<button type="button" class="mpl-tab" data-category="${escapeHtml(c.value)}" aria-pressed="false">${escapeHtml(c.label)}</button>`).join("")}<button type="button" class="mpl-filter" id="mpl-filter-open" aria-label="상세 필터">${icons.sliders}</button></div></section>
<section class="mpl-premium-section" id="mpl-premium-section" aria-labelledby="mpl-premium-heading"><h2 class="mpl-premium-heading" id="mpl-premium-heading">프리미엄 상품 <span class="mpl-premium-mark" aria-hidden="true">?</span></h2><div class="mpl-premium-results" id="mpl-premium-results">${initialPremiumCards}</div><p class="mpl-premium-status" id="mpl-premium-status" role="status" aria-live="polite" data-testid="status-premium-products"></p></section>
<main class="mpl-main"><div class="mpl-section-heading"><h1>상품리스트</h1><button type="button" class="mpl-sort" id="mpl-sort-open">최근등록순 ${icons.down}</button></div><div class="mpl-results" id="mpl-results">${initialCards}</div><div id="mpl-status" class="mpl-status" role="status" aria-live="polite"></div></main>
<div class="mpl-float"><a id="mpl-register" href="/${side}/register.html?search_game=${code}">${icons.write}상품등록</a><div class="mpl-float-right"><button type="button" class="mpl-to-top" id="mpl-to-top" aria-label="맨 위로">${icons.up}</button><button type="button" class="mpl-theme" id="mpl-theme">☼ Light Mode</button></div></div>
<nav class="mpl-nav" aria-label="하단 메뉴"><a class="mpl-home" href="/">${icons.home}<span>홈</span></a><a href="/myroom/chat/list.html">${icons.chat}<span>채팅</span></a><button type="button" class="mpl-center" id="mpl-search" aria-label="게임 검색">${icons.search}</button><a href="/myroom/index.html">${icons.person}<span>마이룸</span></a><button type="button" id="mpl-menu-button" aria-label="메뉴" aria-expanded="false">${icons.menu}<span>메뉴</span></button></nav>
<div class="mpl-dialog" id="mpl-server-dialog" role="dialog" aria-label="서버 선택" aria-modal="true"><div class="mpl-sheet"><div class="mpl-sheet-head"><h2>서버 선택</h2><button class="mpl-close" type="button" data-close aria-label="닫기">×</button></div><div class="mpl-options" id="mpl-server-options"></div></div></div>
<div class="mpl-dialog" id="mpl-sort-dialog" role="dialog" aria-label="정렬 선택" aria-modal="true"><div class="mpl-sheet"><div class="mpl-sheet-head"><h2>정렬</h2><button class="mpl-close" type="button" data-close aria-label="닫기">×</button></div><div class="mpl-options" id="mpl-sort-options"></div></div></div>
<div class="mpl-dialog mpl-filter-dialog" id="mpl-filter-dialog" role="dialog" aria-label="상품 검색 필터" aria-modal="true"><div class="mpl-sheet mpl-filter-sheet">
  <div class="mpl-filter-header"><button class="mpl-filter-reset" id="mpl-filter-reset" type="button">⟳ 초기화</button><button class="mpl-filter-close" type="button" data-close aria-label="닫기">×</button></div>
  <section class="mpl-filter-group"><h2>제목검색</h2><input class="mpl-filter-title" id="mpl-filter-title" type="search" maxlength="17" placeholder="17글자 이하만 검색 가능" aria-label="제목검색"></section>
  <section class="mpl-filter-group"><h2>상품유형</h2><div class="mpl-filter-chips">
    <button class="mpl-filter-chip" type="button" data-filter-group="goodsType" data-value="all">전체</button><button class="mpl-filter-chip" type="button" data-filter-group="goodsType" data-value="general">일반</button><button class="mpl-filter-chip" type="button" data-filter-group="goodsType" data-value="split">분할</button>${side === "sell" ? '<button class="mpl-filter-chip" type="button" data-filter-group="goodsType" data-value="hongjeong">홍정</button>' : ""}
  </div></section>
  <section class="mpl-filter-group"><h2>거래상태</h2><div class="mpl-filter-chips">
    <button class="mpl-filter-chip" type="button" data-filter-group="tradeState" data-value="all">전체</button><button class="mpl-filter-chip" type="button" data-filter-group="tradeState" data-value="waiting">거래대기</button><button class="mpl-filter-chip" type="button" data-filter-group="tradeState" data-value="ended">거래종료</button>
  </div></section>
  <section class="mpl-filter-group"><h2>신용등급</h2><div class="mpl-filter-chips">
    <button class="mpl-filter-chip" type="button" data-filter-group="gradeMin" data-value="all">전체</button><button class="mpl-filter-chip" type="button" data-filter-group="gradeMin" data-value="vip">VIP 이상</button><button class="mpl-filter-chip" type="button" data-filter-group="gradeMin" data-value="platinum">플래티넘 이상</button><button class="mpl-filter-chip" type="button" data-filter-group="gradeMin" data-value="gold">골드 이상</button><button class="mpl-filter-chip" type="button" data-filter-group="gradeMin" data-value="silver">실버 이상</button>
  </div></section>
  <section class="mpl-filter-group"><h2>기타조건</h2><div class="mpl-filter-chips">
    ${side === "sell" ? '<button class="mpl-filter-chip" type="button" data-filter-group="conditions" data-value="premium200">200% 보상 상품</button><button class="mpl-filter-chip" type="button" data-filter-group="conditions" data-value="purchaseReward200">200% 구매 보상</button><button class="mpl-filter-chip" type="button" data-filter-group="conditions" data-value="purchaseDiscount">구매 할인 상품</button>' : '<button class="mpl-filter-chip" type="button" data-filter-group="conditions" data-value="immediate">즉시 구매 상품</button>'}
    <button class="mpl-filter-chip" type="button" data-filter-group="conditions" data-value="verified">우수 인증 상품</button><button class="mpl-filter-chip" type="button" data-filter-group="conditions" data-value="dedupe">중복 상품 제외</button>
  </div></section>
  <button class="mpl-filter-search" type="button" id="mpl-filter-apply">검색하기</button>
</div></div>
${mobileMenuMarkup()}</div>
<script type="application/json" id="mpl-data">${safeJson({ items, servers: game.servers, code: game.code, gameName: game.name, side })}</script>
<script>(function(){
var payload=JSON.parse(document.getElementById('mpl-data').textContent),params=new URLSearchParams(location.search),categories=['','게임머니','아이템','계정','기타'],aliases={money:'게임머니',item:'아이템',account:'계정',other:'기타'};
var selected=aliases[params.get('itemCategory')]||params.get('itemCategory')||'';if(categories.indexOf(selected)<0)selected='';
var server=params.get('search_server')||'',sort=params.get('sort')||'recent',min=Number(params.get('minPrice'))||0,max=Number(params.get('maxPrice'))||0,onlineOnly=params.get('online')==='1';
var titleFilter=(params.get('titleFilter')||'').slice(0,17).trim();
var goodsType=['all','general','split','hongjeong'].includes(params.get('goodsType'))?params.get('goodsType'):'all';
if(payload.side==='buy'&&goodsType==='hongjeong')goodsType='all';
var tradeState=['all','waiting','ended'].includes(params.get('tradeState'))?params.get('tradeState'):'all';
var gradeMin=['all','vip','platinum','gold','silver'].includes(params.get('gradeMin'))?params.get('gradeMin'):'all';
var allowedConditions=payload.side==='buy'?['immediate','verified','dedupe']:['premium200','purchaseReward200','purchaseDiscount','verified','dedupe'];
var conditions=(params.get('conditions')||'').split(',').filter(function(value){return allowedConditions.includes(value)});
 var products=payload.items.filter(function(p){return p.isPremium!==true||p.source==='snapshot'}),premiumProducts=payload.items.filter(function(p){return p.isPremium===true&&p.source!=='snapshot'}),list=document.getElementById('mpl-results'),premiumList=document.getElementById('mpl-premium-results'),premiumStatus=document.getElementById('mpl-premium-status'),status=document.getElementById('mpl-status'),loading=true,premiumLoading=true,premiumFailed=false;
function go(changes){var q=new URLSearchParams(location.search);Object.keys(changes).forEach(function(key){if(changes[key]===null||changes[key]==='')q.delete(key);else q.set(key,changes[key])});q.delete('page');location.href=location.pathname+'?'+q.toString()}
function elt(tag,className,text){var node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!==null)node.textContent=String(text);return node}
function timeOf(p){var t=Number(p.timestamp)||0;return t<100000000000&&t>1000000000?t*1000:t}
function renderCard(p){
   var ended=p.tradeState==='ended',featured=payload.side==='buy'?p.featured:(p.isPremium===true||p.badge);
  var a=elt(ended?'div':'a','mpl-card'+(featured?' mpl-featured':'')+(ended?' mpl-ended':''));if(!ended)a.href='/'+payload.side+'/application.html?id='+encodeURIComponent(String(p.dbId||p.id));else{a.setAttribute('role','group');a.setAttribute('aria-label','거래 완료')}a.dataset.category=p.itemCategory||'';a.dataset.server=p.serverName||'';a.dataset.price=String(Number(p.price)||0);a.dataset.online=String(p.online===true);a.dataset.time=String(timeOf(p));
 if(!ended&&p.source==='snapshot'&&!p.dbId)a.addEventListener('click',function(e){e.preventDefault();alert('보관된 목록의 상품입니다. 현재 거래 가능한 상품인지 확인할 수 없습니다.')});
  var content=elt('div','mpl-card-content');if(ended)content.setAttribute('aria-hidden','true');
  var head=elt('div','mpl-card-head');head.appendChild(elt('span','mpl-seller',p.sellerName||''));if(p.isPremium===true)head.appendChild(elt('span','mpl-premium-label','프리미엄'));if(Number.isFinite(p.percentage)){var score=elt('span','mpl-score',Math.round(p.percentage)+'%');score.style.setProperty('--mpl-score',Math.max(0,Math.min(100,p.percentage))+'%');head.appendChild(score)}if(['vip','platinum','gold','silver'].includes(String(p.sellerGrade||'').toLowerCase()))head.appendChild(elt('span','mpl-grade','우수회원'));if(p.immediate)head.appendChild(elt('span','mpl-immediate','즉시구매'));head.appendChild(elt('time','',p.time||''));content.appendChild(head);
 var title=elt('div','mpl-title-row');title.appendChild(elt('strong','mpl-title',p.title||''));var photo=elt('span','mpl-photo');var camera=document.createElementNS('http://www.w3.org/2000/svg','svg');camera.setAttribute('viewBox','0 0 32 32');var path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M3 10h6l2-3h10l2 3h6v17H3z');camera.appendChild(path);var circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx','16');circle.setAttribute('cy','18');circle.setAttribute('r','5');camera.appendChild(circle);photo.appendChild(camera);title.appendChild(photo);content.appendChild(title);
 var bottom=elt('div','mpl-card-bottom'),top=elt('div','mpl-detail-top');var letter=p.itemCategory==='계정'?'S':String(p.badge||'').includes('로켓')?'P':'V';top.appendChild(elt('span','mpl-hex mpl-hex-'+letter.toLowerCase(),letter));if(p.badge)top.appendChild(elt('span','mpl-badge',p.badge));if(p.quantity)top.appendChild(elt('span','mpl-quantity',p.quantity));bottom.appendChild(top);
 var row=elt('div','mpl-detail-bottom');row.appendChild(elt('span',p.online===true?'mpl-online':p.online===false?'mpl-offline':'mpl-age',p.online===true?'접속중':p.online===false?'오프라인':p.time||''));var wrap=elt('span','mpl-price-wrap');if(p.minPrice)wrap.appendChild(elt('span','mpl-min','최소 '+p.minPrice));wrap.appendChild(elt('b','mpl-price',p.unitPrice||Number(p.price||0).toLocaleString('ko-KR')+'원'+(p.itemCategory==='계정'?'':' (1개당)')));row.appendChild(wrap);bottom.appendChild(row);content.appendChild(bottom);a.appendChild(content);if(ended){var complete=elt('span','mpl-complete','거래 완료');complete.setAttribute('aria-hidden','true');a.appendChild(complete)}return a;
}
function render(){
 document.querySelectorAll('.mpl-tab').forEach(function(tab){var active=tab.dataset.category===selected;tab.classList.toggle('active',active);tab.setAttribute('aria-pressed',String(active))});
 document.getElementById('mpl-server-label').textContent=server||'서버전체';
 document.getElementById('mpl-sort-open').firstChild.textContent=sort==='price_asc'?'낮은가격순 ':sort==='price_desc'?'높은가격순 ':'최근등록순 ';
 var ranks={bronze:0,silver:1,gold:2,platinum:3,vip:4};
  function matches(p){
   if((selected&&p.itemCategory!==selected)||(server&&p.serverName!==server)||(onlineOnly&&p.online!==true)||(min&&Number(p.price)<min)||(max&&Number(p.price)>max))return false;
  if(titleFilter&&!String(p.title||'').toLocaleLowerCase().includes(titleFilter.toLocaleLowerCase()))return false;
  if(goodsType!=='all'&&(p.goodsType||'general')!==goodsType)return false;
  if(tradeState!=='all'&&(p.tradeState||'waiting')!==tradeState)return false;
  if(gradeMin!=='all'&&(ranks[String(p.sellerGrade||'').toLowerCase()]??-1)<ranks[gradeMin])return false;
  return conditions.every(function(value){return value==='dedupe'||(value==='immediate'?p.immediate===true:Array.isArray(p.conditions)&&p.conditions.includes(value))});
  }
  var filtered=products.filter(matches),filteredPremium=premiumProducts.filter(matches);
  function compare(a,b){return sort==='price_asc'?Number(a.price)-Number(b.price):sort==='price_desc'?Number(b.price)-Number(a.price):timeOf(b)-timeOf(a)}
  filtered.sort(compare);filteredPremium.sort(compare);
  if(conditions.includes('dedupe')){var seen=new Set();filteredPremium=filteredPremium.filter(function(p){var key=[p.title,p.serverName,p.itemCategory,p.price].join('|');if(seen.has(key))return false;seen.add(key);return true});filtered=filtered.filter(function(p){var key=[p.title,p.serverName,p.itemCategory,p.price].join('|');if(seen.has(key))return false;seen.add(key);return true})}
  premiumList.replaceChildren();filteredPremium.forEach(function(p){premiumList.appendChild(renderCard(p))});
  premiumStatus.textContent=filteredPremium.length?'':premiumLoading?'프리미엄 상품을 불러오는 중입니다.':premiumFailed?'프리미엄 상품을 불러오지 못했습니다.':premiumProducts.length?'조건에 맞는 프리미엄 상품이 없습니다.':'등록된 프리미엄 상품이 없습니다.';
  premiumStatus.hidden=filteredPremium.length>0;
  list.replaceChildren();if(!filtered.length){var empty=elt('div','mpl-empty');empty.appendChild(elt('strong','',loading?'물품을 불러오는 중입니다.':(titleFilter||goodsType!=='all'||tradeState!=='all'||gradeMin!=='all'||conditions.length)?'조건에 맞는 상품이 없습니다.':'등록된 상품이 없습니다.'));empty.appendChild(elt('p','',loading?'잠시만 기다려 주세요.':'다른 검색 조건이나 카테고리를 선택해 보세요.'));list.appendChild(empty)}else filtered.forEach(function(p){list.appendChild(renderCard(p))});
}
function open(id){document.getElementById(id).classList.add('open');document.body.style.overflow='hidden'}
function closeDialogs(){document.querySelectorAll('.mpl-dialog').forEach(function(d){d.classList.remove('open')});document.body.style.overflow=''}
document.querySelectorAll('.mpl-dialog').forEach(function(d){d.addEventListener('click',function(e){if(e.target===d||e.target.closest('[data-close]'))closeDialogs()})});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDialogs()});
document.querySelectorAll('.mpl-tab').forEach(function(tab){tab.addEventListener('click',function(){go({itemCategory:tab.dataset.category})})});
document.getElementById('mpl-server-open').addEventListener('click',function(){open('mpl-server-dialog')});
var serverChoices=document.getElementById('mpl-server-options');['서버전체'].concat(payload.servers||[]).forEach(function(name){var b=elt('button',(!server&&name==='서버전체')||server===name?'selected':'',name);b.type='button';b.addEventListener('click',function(){go({search_server:name==='서버전체'?null:name})});serverChoices.appendChild(b)});
document.getElementById('mpl-sort-open').addEventListener('click',function(){open('mpl-sort-dialog')});
[['recent','최근등록순'],['price_asc','낮은가격순'],['price_desc','높은가격순']].forEach(function(pair){var b=elt('button',sort===pair[0]?'selected':'',pair[1]);b.type='button';b.addEventListener('click',function(){go({sort:pair[0]==='recent'?null:pair[0]})});document.getElementById('mpl-sort-options').appendChild(b)});
var draft={goodsType:goodsType,tradeState:tradeState,gradeMin:gradeMin,conditions:conditions.slice()},titleInput=document.getElementById('mpl-filter-title');
function paintFilter(){document.querySelectorAll('.mpl-filter-chip').forEach(function(chip){var selected=chip.dataset.filterGroup==='conditions'?draft.conditions.includes(chip.dataset.value):draft[chip.dataset.filterGroup]===chip.dataset.value;chip.classList.toggle('selected',selected);chip.setAttribute('aria-pressed',String(selected))})}
document.getElementById('mpl-filter-open').addEventListener('click',function(){draft={goodsType:goodsType,tradeState:tradeState,gradeMin:gradeMin,conditions:conditions.slice()};titleInput.value=titleFilter;paintFilter();var sheet=document.querySelector('.mpl-filter-sheet');sheet.scrollTop=0;open('mpl-filter-dialog');var dialog=document.getElementById('mpl-filter-dialog');dialog.tabIndex=-1;dialog.focus({preventScroll:true})});
document.querySelectorAll('.mpl-filter-chip').forEach(function(chip){chip.addEventListener('click',function(){var group=chip.dataset.filterGroup,value=chip.dataset.value;if(group==='conditions'){var index=draft.conditions.indexOf(value);if(index<0)draft.conditions.push(value);else draft.conditions.splice(index,1)}else draft[group]=value;paintFilter()})});
document.getElementById('mpl-filter-reset').addEventListener('click',function(){draft={goodsType:'all',tradeState:'all',gradeMin:'all',conditions:[]};titleInput.value='';paintFilter()});
document.getElementById('mpl-filter-apply').addEventListener('click',function(){go({titleFilter:titleInput.value.trim().slice(0,17)||null,goodsType:draft.goodsType==='all'?null:draft.goodsType,tradeState:draft.tradeState==='all'?null:draft.tradeState,gradeMin:draft.gradeMin==='all'?null:draft.gradeMin,conditions:draft.conditions.length?draft.conditions.join(','):null,online:null,minPrice:null,maxPrice:null})});
if(location.hash==='#filter')document.getElementById('mpl-filter-open').click();
['mpl-sell','mpl-buy'].forEach(function(id){var link=document.getElementById(id),q=new URLSearchParams(location.search);q.set('search_game',payload.code);link.href=link.pathname+'?'+q.toString()});
var reg=document.getElementById('mpl-register'),rq=new URLSearchParams();rq.set('search_game',payload.code);rq.set('itemCategory',selected||'게임머니');if(params.get('mobile')==='1')rq.set('mobile','1');reg.href=reg.pathname+'?'+rq.toString();
document.getElementById('mpl-back').addEventListener('click',function(){if(history.length>1)history.back();else location.href='/mobile-game-search?mode=search'});
document.getElementById('mpl-search').addEventListener('click',function(){location.href='/mobile-game-search?mode=search'+(params.get('mobile')==='1'?'&mobile=1':'')});
document.getElementById('mpl-to-top').addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
document.getElementById('mpl-theme').addEventListener('click',function(){var button=this;button.textContent=button.textContent.includes('Light')?'☾ Dark Mode':'☼ Light Mode';document.getElementById('im-product-list').style.filter=button.textContent.includes('Dark')?'invert(1) hue-rotate(180deg)':''});
if(params.get('mobile')==='1')document.querySelectorAll('.mpl-nav a[href]').forEach(function(a){a.href=a.getAttribute('href')+(a.getAttribute('href').includes('?')?'&':'?')+'mobile=1'});
render();
 var query=new URLSearchParams({category:payload.side,gameCode:payload.code,limit:'50'});if(selected)query.set('itemCategory',selected);
if(titleFilter)query.set('keyword',titleFilter);if(gradeMin!=='all')query.set('gradeMin',gradeMin);if(server)query.set('serverName',server);if(sort!=='recent')query.set('sort',sort);
 // Premium and ordinary products use separate, independently failing requests.
 function requestProducts(extra){var q=new URLSearchParams(query);Object.keys(extra).forEach(function(key){q.set(key,String(extra[key]))});return fetch('/api/products?'+q.toString(),{credentials:'include'}).then(function(r){if(!r.ok)throw Error('products');return r.json()}).then(function(data){return Array.isArray(data)?data:Array.isArray(data.items)?data.items:[]})}
 Promise.all(['active','sold'].map(function(state){return requestProducts({premium:1,limit:10,status:state})})).then(function(responses){
   var knownPremium=new Set(premiumProducts.map(function(p){return String(p.dbId||p.id)}));
   responses.flat().forEach(function(p){if(!p||!p.title||!p.id||p.isPremium!==true)return;var key=String(p.id);if(knownPremium.has(key))return;knownPremium.add(key);var date=Date.parse(p.createdAt||p.crawledAt||'')||Date.now(),delta=Math.max(0,Date.now()-date),minutes=Math.floor(delta/60000),time=minutes<1?'방금 전':minutes<60?minutes+'분 전':minutes<1440?Math.floor(minutes/60)+'시간 전':new Date(date).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}).replace(/\\. /g,'-').replace('.','');premiumProducts.push({id:String(p.itemmaniaid||p.id),dbId:Number(p.id),title:String(p.title),sellerName:String(p.sellerName||''),sellerGrade:p.sellerGrade||undefined,isPremium:true,gameName:String(p.gameName||payload.gameName),serverName:String(p.serverName||''),itemCategory:String(p.itemCategory||''),goodsType:String(p.title||'').includes('홍정')?'hongjeong':String(p.title||'').includes('분할')?'split':'general',tradeState:p.status==='sold'?'ended':'waiting',price:Number(p.price)||0,quantity:String(p.description||''),time:time,timestamp:date,source:'api'})});
   premiumLoading=false;render();
 }).catch(function(){premiumLoading=false;premiumFailed=true;render()});
 Promise.all(['active','sold'].map(function(state){return requestProducts({premium:0,status:state,limit:50})})).then(function(responses){
 var current=responses.flatMap(function(data){return Array.isArray(data)?data:Array.isArray(data.items)?data.items:[]}),known=new Set();
 products.forEach(function(p){known.add(String(p.dbId||p.id));if(p.id)known.add(String(p.id))});
  current.forEach(function(p){if(!p||!p.title||!p.id)return;var external=String(p.itemmaniaid||p.id),internal=String(p.id);
  var date=Date.parse(p.createdAt||p.crawledAt||'')||Date.now(),delta=Math.max(0,Date.now()-date),minutes=Math.floor(delta/60000),time=minutes<1?'방금 전':minutes<60?minutes+'분 전':minutes<1440?Math.floor(minutes/60)+'시간 전':new Date(date).toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}).replace(/\\. /g,'-').replace('.','');
  var kind=String(p.title||'')+' '+String(p.description||'');
   if(p.isPremium===true)return;
   var fresh={id:external,dbId:Number(p.id),title:String(p.title),sellerName:String(p.sellerName||''),sellerGrade:p.sellerGrade||undefined,isPremium:false,featured:false,gameName:String(p.gameName||payload.gameName),serverName:String(p.serverName||''),itemCategory:String(p.itemCategory||''),goodsType:kind.includes('홍정')?'hongjeong':kind.includes('분할')?'split':'general',tradeState:p.status==='sold'?'ended':'waiting',price:Number(p.price)||0,quantity:String(p.description||''),time:time,timestamp:date,source:'api'};
  var existing=products.find(function(candidate){return String(candidate.id)===external||String(candidate.dbId||'')===internal});
  if(existing){Object.assign(existing,fresh);return}
  if(known.has(external)||known.has(internal))return;known.add(external);known.add(internal);products.push(fresh);
   });loading=false;render();
  }).catch(function(){loading=false;if(!products.length)status.textContent='최신 상품을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';render()});
})();</script>${mobileMenuScript("mpl-menu-button")}</body></html>`;
}