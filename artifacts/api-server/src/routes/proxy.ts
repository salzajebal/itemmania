import { Router, type IRouter, type Request } from "express";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import bcrypt from "bcryptjs";
import { load as loadHtml } from "cheerio";
import { logger } from "../lib/logger";
import { externalizeSnapshotFonts } from "../lib/snapshot-fonts";
import { externalizeHomepageImages, optimizeHomepageImages, reuseHomepageImages } from "../lib/homepage-assets";
import { stripSnapshotChatMessages } from "../lib/snapshot-chat";
import { TRADE_CHAT_COMPOSER_SCRIPT } from "../lib/trade-chat-composer";
import { applyViewerTradeInfo, VIEWER_TRADE_INFO_SCRIPT } from "../lib/viewer-trade-info";
import { listingTimeMarkup } from "../lib/listing-time";
import { listingQuantityLabel } from "../lib/listing-quantity";
import { installRegistrationQuantityInputs, registrationQuantityScript } from "../lib/registration-quantity";
import { renderMobileHome } from "./mobile-home";
import { renderMobileLogin } from "./mobile-login";
import { renderMemberLogin } from "./member-login";
import { memberLoginEntry } from "../lib/member-login-entry";
import { loginLogoStatus } from "../lib/login-branding";
import { renderMobileProductList } from "./mobile-product-list";
import { renderMobileSellDetail } from "./mobile-sell-detail";
import { recordProductView } from "../lib/product-views";
import { publicListingDescription } from "../lib/trade-character-names";
import { renderMobileChat } from "./mobile-chat";
import { renderMobileMyroom } from "./mobile-myroom";
import { renderMemberProfileContent, MEMBER_PROFILE_MOBILE_STYLE } from "../lib/member-profile-view";
import { renderMobileGameSearch } from "./mobile-game-search";
import { renderMobileBuyRegister, renderMobileSellRegister } from "./mobile-sell-register";
import { findGameByCode } from "./games";
import { fetchProxyPage } from "../lib/proxy";
import { db, usersTable, productsTable, ordersTable, chatRoomsTable, walletsTable, gamesTable, gameServersTable } from "@workspace/db";
import { ongoingTrades, ongoingTradeHref, type OngoingTrade } from "../lib/ongoing-trades";
import { renderTradeDetailLayout } from "../lib/trade-detail-layout";
import { CHAT_REFERENCE_STYLE } from "../lib/chat-reference-style";
import { TRADE_DETAIL_SCRIPT } from "../lib/trade-detail-script";
import { applyProductMemberStatus } from "../lib/product-member-status";
import { getTradePreview, previewHtml, proxyTradePreview, tradePreviewEnabled } from "../lib/trade-preview";
import { MYROOM_STATS_SCRIPT } from "../lib/myroom-stats-script";
import { eq, and, or, inArray, desc, asc } from "drizzle-orm";
import { localProductSellerId } from "./product-ownership";
import { createMemberAccount, getRegistrationPolicy, RegistrationBlockedError } from "../lib/registration-policy";

const router: IRouter = Router();

// OG 기본 이미지 — 외부 CDN 의존 없이 정적 파일에서 바로 서빙
const OG_DEFAULT_IMAGE_PATHS = [
  join(process.cwd(), "src", "static", "og-default.jpg"),
  join(process.cwd(), "artifacts", "api-server", "src", "static", "og-default.jpg"),
];
let ogDefaultImageBuf: Buffer | null = null;
for (const p of OG_DEFAULT_IMAGE_PATHS) {
  if (existsSync(p)) { ogDefaultImageBuf = readFileSync(p); break; }
}

// production: cwd = /home/runner/workspace, dev: cwd = artifacts/api-server
// 실제 static 폴더를 자동 탐지
const STATIC_DIR = (() => {
  const candidates = [
    join(process.cwd(), "src", "static"),
    join(process.cwd(), "artifacts", "api-server", "src", "static"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
})();
logger.info({ STATIC_DIR }, "static HTML 디렉토리");

function loadSnapshotHtml(path: string): string {
  return reuseHomepageImages(externalizeSnapshotFonts(readFileSync(path, "utf-8")));
}

// receipt_layer 캡처 파일 경로
const CAPTURED_RECEIPT_PATH = join(STATIC_DIR, "receipt-layer-captured.html");
let capturedReceiptHtml = "";
try {
  capturedReceiptHtml = loadSnapshotHtml(CAPTURED_RECEIPT_PATH);
  logger.info("receipt-layer-captured.html 로드 완료 (캡처된 원본 사용)");
} catch {
  logger.info("receipt-layer-captured.html 없음 → MutationObserver로 자동 캡처 예정");
}

// 서버 시작 시 정적 HTML 파일을 메모리에 로드
const STATIC_HTML_PATH = join(STATIC_DIR, "itemmania.html");
let staticHtml = "";

try {
  staticHtml = loadSnapshotHtml(STATIC_HTML_PATH);
  logger.info("itemmania.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "itemmania.html 로드 실패");
}
const mobileHomeHtml = staticHtml ? renderMobileHome(staticHtml) : "";
// Build once, retaining the original snapshot for all other screens/extractors.
const desktopHomepageHtml = optimizeHomepageImages(staticHtml, "desktop");
const mobileHomepageBaseHtml = optimizeHomepageImages(staticHtml, "hidden-desktop");
const optimizedMobileHomeHtml = optimizeHomepageImages(mobileHomeHtml, "mobile-overlay");
const mobileGameSearchHtml = staticHtml
  ? optimizeHomepageImages(renderMobileGameSearch(staticHtml, join(STATIC_DIR, "mobile-game-icons")), "mobile-overlay")
  : "";
const mobileFooterBadges = {
  isms: mobileHomeHtml.match(/<img[^>]*src="(data:image\/(?:png|jpeg|webp);base64,[^"]+)"[^>]*alt="ISMS 인증"/)?.[1] ?? "",
  danal: mobileHomeHtml.match(/<img[^>]*src="(data:image\/(?:png|jpeg|webp);base64,[^"]+)"[^>]*alt="다날 결제 인증"/)?.[1] ?? "",
};

const LOGIN_HTML_PATH = join(STATIC_DIR, "login.html");
let loginHtml = "";

try {
  loginHtml = loadSnapshotHtml(LOGIN_HTML_PATH);
  logger.info("login.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "login.html 로드 실패");
}

const JOIN_HTML_PATH = join(STATIC_DIR, "join.html");
let joinHtml = "";

try {
  joinHtml = loadSnapshotHtml(JOIN_HTML_PATH);
  logger.info("join.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "join.html 로드 실패");
}

const JOIN_AGREE_HTML_PATH = join(STATIC_DIR, "join-agree.html");
let joinAgreeHtml = "";

try {
  joinAgreeHtml = loadSnapshotHtml(JOIN_AGREE_HTML_PATH);
  logger.info("join-agree.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "join-agree.html 로드 실패");
}

const JOIN_FORM_HTML_PATH = join(STATIC_DIR, "join-form.html");
let joinFormHtml = "";

try {
  joinFormHtml = loadSnapshotHtml(JOIN_FORM_HTML_PATH)
    .replace(/<meta[^>]*content-security-policy[^>]*>/gi, "");
  logger.info("join-form.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "join-form.html 로드 실패");
}

const GIFTCARD_HTML_PATH = join(STATIC_DIR, "giftcard.html");
let giftcardHtml = "";

try {
  giftcardHtml = loadSnapshotHtml(GIFTCARD_HTML_PATH);
  logger.info("giftcard.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "giftcard.html 로드 실패");
}

const GAMEMANIA_HTML_PATH = join(STATIC_DIR, "gamemania.html");
let gamemanaHtml = "";

try {
  gamemanaHtml = loadSnapshotHtml(GAMEMANIA_HTML_PATH);
  logger.info("gamemania.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "gamemania.html 로드 실패");
}

const GAMECHARGE_HTML_PATH = join(STATIC_DIR, "game-charge.html");
let gamechargeHtml = "";

try {
  gamechargeHtml = loadSnapshotHtml(GAMECHARGE_HTML_PATH);
  logger.info("game-charge.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "game-charge.html 로드 실패");
}

const SELL_LINEAGE_CLASSIC_HTML_PATH = join(STATIC_DIR, "sell-lineage-classic.html");
let sellLineageClassicHtml = "";

try {
  sellLineageClassicHtml = loadSnapshotHtml(SELL_LINEAGE_CLASSIC_HTML_PATH);
  logger.info("sell-lineage-classic.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "sell-lineage-classic.html 로드 실패");
}

const SELL_MAPLESTORY_WORLD_HTML_PATH = join(STATIC_DIR, "sell-maplestory-world.html");
let sellMaplestoryWorldHtml = "";

try {
  sellMaplestoryWorldHtml = loadSnapshotHtml(SELL_MAPLESTORY_WORLD_HTML_PATH);
  logger.info("sell-maplestory-world.html 로드 완료");
} catch (e) {
  logger.error({ err: e }, "sell-maplestory-world.html 로드 실패");
}

function loadSellHtml(filename: string): string {
  try {
    const html = loadSnapshotHtml(join(STATIC_DIR, filename));
    logger.info(`${filename} 로드 완료`);
    return html;
  } catch (e) {
    logger.error({ err: e }, `${filename} 로드 실패`);
    return "";
  }
}

const buyLineageClassicHtml   = loadSellHtml("buy-lineage-classic.html");
const buyApplicationHtml      = loadSellHtml("buy-application-1.html");
const chatHtml                = loadSellHtml("chat.html");
const chatOrderedHtml         = loadSellHtml("chat-ordered.html");
const chatNewHtml             = stripSnapshotChatMessages(loadSellHtml("chat-new.html"));
const chatNewBuycheckHtml     = loadSellHtml("chat-new-buycheck.html");
const sellRegisterHtml        = loadSellHtml("sell-register.html");
const sellIndexViewHtml       = loadSellHtml("sell/index_view.html");
const buyRegisterHtml         = loadSellHtml("buy-register.html");
const sellNewHtml             = loadSellHtml("sell-new.html");
const batchGoodsHtml          = loadSellHtml("batch-goods.html");
const myroomHtml              = loadSellHtml("myroom.html");
const chargeKakaopayHtml      = loadSellHtml("charge-kakaopay.html");
const chargeNaverpayHtml      = loadSellHtml("charge-naverpay.html");
const chargePhoneArsHtml      = loadSellHtml("charge-phone-ars.html");
const chargeCreditcardHtml    = loadSellHtml("charge-creditcard.html");
const chargeOnlycultureHtml   = loadSellHtml("charge-onlyculture.html");
const chargeAccountHtml       = loadSellHtml("charge-account.html");
const chargeMileageHtml       = loadSellHtml("charge-mileage.html");
const chargeMybankHtml        = loadSellHtml("charge-mybank.html");
const chargeGift24Html        = loadSellHtml("charge-gift24.html");
const paymentIndexHtml        = loadSellHtml("payment-index.html");
const paymentPhoneHtml        = loadSellHtml("payment-phone.html");
const paymentListHtml         = loadSellHtml("payment-list.html");
const paymentPhoneListHtml    = loadSellHtml("payment-phone-list.html");
const sellApplicationHtml     = loadSellHtml("sell-application-1.html");
const sellMaplestoryHtml      = loadSellHtml("sell-maplestory.html");
const sellMaplelandHtml       = loadSellHtml("sell-mapleland.html");
const sellOdinHtml            = loadSellHtml("sell-odin.html");
const sellMabinogiHtml        = loadSellHtml("sell-mabinogi.html");
const sellLostarkHtml         = loadSellHtml("sell-lostark.html");
const sellLineageMHtml        = loadSellHtml("sell-lineage-m.html");
const sellGeosangHtml         = loadSellHtml("sell-geosang.html");
const sellAion2Html           = loadSellHtml("sell-aion2.html");
const sellDnfHtml             = loadSellHtml("sell-dnf.html");
const sellMyroomRegistHtml    = loadSellHtml("sell/sell_regist.html");
const sellMyroomCheckHtml     = loadSellHtml("sell/sell_check.html");
const sellMyroomPayWaitHtml   = loadSellHtml("sell/sell_pay_wait.html");
const sellMyroomIngHtml       = loadSellHtml("sell/sell_ing.html");
const buyMyroomRegistHtml     = loadSellHtml("buy/buy_regist.html");
const buyMyroomCheckHtml      = loadSellHtml("buy/buy_check.html");
const buyMyroomPayWaitHtml    = loadSellHtml("buy/buy_pay_wait.html");
const buyMyroomIngHtml        = loadSellHtml("buy/buy_ing.html");

// 리니지클래식 스냅샷 기반 게임: 서버 사이드에서 게임명 치환 필요
const LINEAGE_CLASSIC_BASED_GAMES: Record<string, string> = {
  "5990": "메이플랜드",
  "5491": "옛날바람",
  "6027": "제우스:오만의신",
  "6028": "이클립스:더어웨이크닝",
};

// game_id → html 매핑 (TOP 10)
const SELL_HTML_MAP: Record<string, string> = {
  "5913": "", // 리니지클래식 — 별도 변수로 처리
  "5233": "", // 메이플스토리월드 — 별도 변수로 처리
  "8458": sellMaplestoryHtml,  // 메이플스토리
  "4696": sellOdinHtml,        // 오딘
  "155":  sellMabinogiHtml,    // 마비노기
  "2696": sellLostarkHtml,     // 로스트아크
  "3449": sellLineageMHtml,    // 리니지M
  "101":  sellGeosangHtml,     // 거상
  "5799": sellAion2Html,       // 아이온2
  "281":  sellDnfHtml,         // 던전앤파이터
  "5990": sellMaplelandHtml,   // 메이플랜드
};

// ── 게임 서버 목록 캐시 (code → [{id, name}]) ──────────────────────────────
const _serversByCode: Record<string, {id: number; name: string}[]> = {};

async function getGameServersForCode(code: string): Promise<{id: number; name: string}[]> {
  if (!code || code === "5913") return [];
  if (_serversByCode[code]) return _serversByCode[code];
  const games = await db.select({ id: gamesTable.id }).from(gamesTable).where(eq(gamesTable.code, code)).limit(1);
  if (!games.length) return [];
  const servers = await db.select({ id: gameServersTable.id, name: gameServersTable.name })
    .from(gameServersTable)
    .where(eq(gameServersTable.gameId, games[0].id))
    .orderBy(asc(gameServersTable.sortOrder));
  _serversByCode[code] = servers;
  return servers;
}

// search_server_list <ul> 내용을 서버 목록으로 교체 (서버사이드)
function injectServerTabsHtml(html: string, servers: {id: number; name: string}[]): string {
  if (!servers.length) return html;
  const firstLi = `<li>\n <input id=row_server type=checkbox name=row_server value class=g_btn_white2_radio checked>\n <label for=row_server>서버전체</label>\n </li>`;
  const items = servers.map(sv =>
    `<li>\n <input id="row_server_dyn_${sv.id}" type=checkbox name=row_server value="${sv.name}" class=g_btn_white2_radio>\n <label for="row_server_dyn_${sv.id}">${sv.name}</label>\n </li>`
  ).join("\n ");
  return html.replace(
    /(<div[^>]*id=["']?search_server_list["']?[^>]*>[\s\S]*?<ul[^>]*>)([\s\S]*?)(<\/ul>)/,
    (_m, pre, _old, post) => `${pre}\n ${firstLi}\n ${items}\n ${post}`
  );
}

// 브론즈 등급 배지 이미지 (아이템마니아 등급 시스템과 동일한 방패형 PNG)
const GRADE_IMG_BRONZE_EARLY = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAA4CAYAAAC7UXvqAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3NzExNjY2NENCRDlFOTExODEzRkUxOTg1MTQ3MzI3NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpDQkExQUEwQUQ5RDIxMUU5QjM1REUyRDMwNjMyMjY5NSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpDQkExQUEwOUQ5RDIxMUU5QjM1REUyRDMwNjMyMjY5NSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjJBMEU0NzJCRDFEOUU5MTE4MTNGRTE5ODUxNDczMjc2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjc3MTE2NjY0Q0JEOUU5MTE4MTNGRTE5ODUxNDczMjc2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+G6e6rAAABopJREFUeNrUWntQVGUU/919AcuqgAsqbxQICQO1QNRQfOQjQJPG0kysydK0ckxHS0dTR7CUitIcNW2oqWmsfzKLMZ1stEyHMfNBmqAk4hsREFhY9tE5uxcHZEX2BZcz8xvu3vtx73e+73d+53zfvULMN2q4yWSEWYQ7hB/d+RB32HDCz4R8wg/i35ju4EAoYSvhoBnmCTpDPRqMOoGOZ9O5I4TVBB8pOuBNWEw4Sp2dR51W6Qw6jA1OR1LAKPBxk0nvS9ffI/xJmOkqB+TaTKWz95giUiTLYGrq0WhsRKxfPFYOzcWywTlID38eHnJPlFSfRYWuEgqZTCsTZJnUPolQTLjSVQ7EEzYT1prMpn51NMo+Hr54JXYxcoZtR7w20dJIIVMgqU8KxodkwAwjzledQb2hjs9HCRA4yLWEIkKNI50QHFAhf8JbhIWEXkQXqGQeSAufjrmxSxDjM6jdfy68eRgb/16JYzcOQSHIoZJ78OlSwibC5wS9u2aA4+VFwheEZ/QmvafO0IgEGukNydstndd69nnoTYK8wzAlfCbCegxASc1ZXK2/xrTyJVo9TZfHEMoIF13tAMviDsISo9mgrTc0IEQThrcT1mDVEx8jstdA+3hLtHrULwGTw56F2Wyw0KpGX0uOyEMFwUKr/iKtKp11IISwgZBHPI9mnntRQE6PnIPcEfkY2W880UfluHQpNBgVOBGjgyah1lCN4qpikAgISpkiAdb44JufJDTa64AX4Q3CLp7WRmOD3GQ24qmQdKLLDsyKno+NsqfLtNzfqy8mhWbiEd84XKw+h/K6cuq/2UsuyFNFleNsfqajDmSIPH+ZZbGeeD6gZxRWJ+ZhaUI2+qmD3VUVWKg4NeIF9PbUWuKjQlfBtPInWrHssqxdIJQ/yIFmWVxHySiIkw+PzPy4pcgetg0JvRPRGcaqNMQ/GRNCpkJnrMO5qlOWRKiUKaPE2ipAnI2aZgf4xDuEbYTBnP6J75gSMQMfDN+JiTS1nnIvdLb1VPlgXHAGHg8YgVu6a7hA1DKbTQqFTMkJMFOU2yLOA/vpYBypC9UtegwLeJJGfTlSgyZDKsbxl//vFsJmyujFFH9eoCTIl7bwDKwwmo1ab2UPvDloJdYnbbVbFt1tgiDDYG2SJVly8jt1u5CyupmduKHgqdBT/TLEfzgWxL3r0AMOXTqIQ+UHUK2/Y/N6sCYc0b4xSAxMRm+1v8OOcKJcOGgFCsq+x9W6MgpwZZOi5TQx9ykj2nXT7/75GqtOvtrh9ml9s7A8aY3DjuiojuLRd1k5vflsjl3t917Px7SCVJRVX5LGeuCmvtSh/1l3dJlLHFC4I+gCVBFI9EuxHFfpK/F7ZdslMZ/jWQjtFSY9Bz5M3oWhgYmtgvy1I2lt2hXdOum0A25Z1HurNK1+p4Sl2mxXq78r2V2JNjJry/r7REkzBnKPr4WPyq/dGIjVJLeimaQcsNXh+4P8o5Sdkt7YateiNXHwVqq7rwM8Q65KZm6h0LzI1Qj0DrIqTdNdHLn+WxtacTL79K/3sTH1M+k5MCEiDTHa2Hu/X4qfh4KSPVhcOKNNWbGmaRPUTtCp0ygU4RNp83xZ9X/Si4HSqpJWv+ub6rGvdK/Ntmqlt/QoxFT59XJWu3mgWU4lWQs18/thNi10dtfLKI+iIzbSLx1zExZ2vQPL47Mdktm8MbucUh+bFBJX+nbZpMgMUphCnL55gtapV1Be21ZVEvuMuFe8DfSPc6rj9/dR0XLlLwiCQzdlzW+p++40pVzVygmF9aQSV2nkso8vsTjSctEsJeMNhzrK7HebqulY3sIBQYUbumvYWpQLqRuTRC33urd7wg7IeMTl5JFGqUY3M5msqypSF5mZO7+IcLQbdn4PYR078Aus76bYkSvdoOP8xuY5WF98nGimj46QR2DB5jftjRLseAVhBW9yEHY/KBPzEul1wnjCAYl03ET4ShxcTvs1HSklDhMmEubA+lqnq4y/r+AXFVz1nbe3FjLC+glBki3P3WzlIhM4Nvc5W8zdFrk3kvCtmzveQPiEkNzRWLQnB5wmzBCn9JgbOv8TYTSsnzGUu7OcLhAftMieB7Vjp0RZTHNkYGROTDXLLn+CwPsiegfuUdGCmru7akFzmbBADLaOyi7L4pei8ywOTm1Ru6oO+qOF7BZ3oF3WQ9p1ybZKs+zyyK6/b2SbE+RYwn6Xltdu/OzyMVi/AOBPZnJcFPBt7H8BBgALOBe6yzLDVgAAAABJRU5ErkJggg==";

// 주입할 인터셉트 스크립트 (순수 JS/CSS, React 없음)
const INTERCEPT_SCRIPT = `
<style>
/* ── 회원 브론즈 등급 배지 — 등급 시스템 아이콘 (마이룸 credit_mark2와 동일 PNG) ── */
.credit_mark_new.bronze {
  background-image: url("${GRADE_IMG_BRONZE_EARLY}") !important;
  background-repeat: no-repeat !important;
  background-size: 100% auto !important;
  font-size: 0 !important;
  display: inline-block !important;
  width: 35px;
  height: 37px;
  vertical-align: middle;
}
/* ── 메인 배너 Swiper 스냅샷 height:100% 오버라이드 ──────────────────────────
   스냅샷에 height:100%로 고정된 컨테이너/슬라이드/이미지를 콘텐츠 기반 높이로 복원.
   CSS !important는 JS가 나중에 set하는 inline style도 오버라이드함. */
.main-banner .banner_content > div {
  height: auto !important;
  overflow: hidden;
}
.swiper-container-main {
  height: auto !important;
  overflow: hidden;
}
.swiper-container-main .swiper-wrapper {
  height: auto !important;
}
.swiper-container-main .swiper-slide {
  height: auto !important;
}
.swiper-container-main .swiper-slide img {
  height: auto !important;
}
/* ── 검색창 + 드롭다운 연결 테두리 ───────────────────────────────────────── */
.g_search_wrapper .search_area:has(.focus_on) {
  border-radius: 15px 15px 0 0 !important;
}
.g_search_frame {
  height: 300px;
}
.g_search_frame.g_hidden {
  display: inherit !important;
  visibility: hidden;
  height: 0 !important;
  padding: 0;
  opacity: 0;
}
/* ────────────────────────────────────────────────────────────────────────── */
#_im_overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(0,0,0,0.55);
  align-items: center;
  justify-content: center;
}
#_im_overlay.active { display: flex; }
#_im_modal {
  position: relative;
  background: #fff;
  border-radius: 14px;
  padding: 36px 32px 28px;
  width: 400px;
  max-width: 92vw;
  box-shadow: 0 24px 64px rgba(0,0,0,0.22);
  font-family: 'Pretendard', -apple-system, sans-serif;
}
#_im_modal h2 {
  margin: 0 0 22px;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -.02em;
}
#_im_modal .tab-row {
  display: flex;
  gap: 0;
  margin-bottom: 22px;
  border-bottom: 2px solid #eee;
}
#_im_modal .tab-btn {
  flex: 1;
  padding: 10px 0;
  font-size: 15px;
  font-weight: 600;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  color: #999;
  transition: all .2s;
}
#_im_modal .tab-btn.on {
  color: #159EFD;
  border-bottom-color: #159EFD;
}
#_im_modal input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 13px 15px;
  margin-bottom: 10px;
  border: 1.5px solid #ddd;
  border-radius: 9px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color .2s;
}
#_im_modal input:focus { border-color: #159EFD; }
#_im_modal .submit-btn {
  display: block;
  width: 100%;
  padding: 14px;
  margin-top: 6px;
  background: #159EFD;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: -.01em;
  transition: background .2s;
}
#_im_modal .submit-btn:hover { background: #0d88e0; }
#_im_modal .errmsg {
  margin-top: 10px;
  min-height: 20px;
  font-size: 13px;
  color: #e03030;
  text-align: center;
}
#_im_modal .close-btn {
  position: absolute;
  top: 14px; right: 18px;
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  color: #aaa;
  line-height: 1;
  padding: 4px;
}
#_im_modal .close-btn:hover { color: #333; }
/* ── 전체서비스 패널 (원본 CSS) ──────────────────────────────────── */
.header-menu{position:relative;z-index:401}
.header-panel{position:absolute;z-index:400;top:80px;left:0;width:100%}
.header-panel.is-open{display:block}
.header-panel .header-panel-backdrop{position:fixed;background:0 0;inset:0}
.header-panel .header-panel-inner{position:relative;z-index:2}
.header-panel .header-panel-card{width:584px;margin-left:auto;padding:18px 20px 24px;border-radius:15px;background:#fff;box-shadow:0 1px 10px rgba(0,0,0,.25)}
.header-panel .header-panel-title{font-weight:600;padding:4px 5px 14px;color:#000}
.header-panel .header-panel-title h2{font-size:18px}
.header-panel .header-panel-divider{height:1px;margin:0 5px 20px;background:#d9d9d9}
.header-panel .header-service-grid{display:grid;margin:0;padding:0 14px 35px;list-style:none;grid-template-columns:repeat(5,83px);gap:25px 25px}
.header-panel .header-service-item{text-align:center}
.header-panel .header-service-item a{display:block;text-decoration:none;color:#2e2e2e}
.header-panel .header-service-icon{display:flex;align-items:center;justify-content:center;width:63px;height:63px;margin:0 auto;border-radius:20px;background:#e8f2ff}
.header-panel .header-service-icon img{display:block;width:50px;height:50px}
.header-panel .header-service-label{font-size:16px;font-weight:500;display:block;margin-top:8px;text-align:center}
.header-panel .header-box{overflow:hidden;margin:0 20px 20px;border:1px solid var(--color-gray3);border-radius:15px;background:#fff}
.header-panel .header-box-title{font-size:16px;font-weight:600;display:flex;align-items:center;height:40px;padding:0 20px;margin:0;color:#2e2e2e;background:#e8f2ff}
.header-panel .header-box-grid{font-size:16px;font-weight:500;display:grid;margin:0;padding:20px 25px 24px;list-style:none;color:#2e2e2e;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px 5px}
.header-panel .header-box-grid li:last-child{width:100px}
.header-panel .header-box-grid a{color:inherit;text-decoration:none}
.header-panel .header-box-grid a:hover{color:#159EFD}
</style>

<div id="_im_overlay">
  <div id="_im_modal">
    <button class="close-btn" id="_im_close">✕</button>
    <div id="_im_body"></div>
  </div>
</div>

<script>
(function(){
  var overlay = document.getElementById('_im_overlay');
  var modalBody = document.getElementById('_im_body');
  var closeBtn = document.getElementById('_im_close');
  var currentUser = null;

  // 등급 배지 업데이트 공통 함수 (모든 페이지 grade 요소 대응)
  function applyGradeBadge(grade) {
    var GRADES = ['regular','bronze','silver','gold','platinum','vip'];
    var GRADE_EN = {regular:'REGULAR',bronze:'BRONZE',silver:'SILVER',gold:'GOLD',platinum:'PLATINUM',vip:'VIP'};
    var GRADE_KO = {regular:'레귤러',bronze:'브론즈',silver:'실버',gold:'골드',platinum:'플래티넘',vip:'VIP'};
    var cls = (grade && GRADES.indexOf(grade) !== -1) ? grade : 'regular';
    var enName = GRADE_EN[cls];
    var koName = GRADE_KO[cls];

    // 1a. .credit_mark_new (data-seller-id 없음) — chat/헤더 등 일반 배지
    document.querySelectorAll('.credit_mark_new:not([data-seller-id])').forEach(function(el) {
      GRADES.forEach(function(g) { el.classList.remove(g); });
      el.classList.add(cls);
      if (el.textContent.trim()) el.textContent = cls;
    });
    // 1b. .credit_mark_new[data-seller-id] — 물품 리스트 내 현재 유저 카드만 업데이트
    // 1c. .credit_mark[data-seller-id]       — 상품 상세 판매자 배지
    // 1d. .vip_txt[data-seller-id]            — 상품 상세 판매자 등급 텍스트
    if (currentUser && currentUser.id) {
      var uid = String(currentUser.id);
      document.querySelectorAll('.credit_mark_new[data-seller-id="' + uid + '"]').forEach(function(el) {
        GRADES.forEach(function(g) { el.classList.remove(g); });
        el.classList.add(cls);
        if (el.textContent.trim()) el.textContent = cls;
      });
      document.querySelectorAll('.credit_mark[data-seller-id="' + uid + '"]').forEach(function(el) {
        GRADES.forEach(function(g) { el.classList.remove(g); });
        el.classList.add(cls);
        var ltr = { vip:'V', platinum:'P', gold:'G', silver:'S', bronze:'B', regular:'' };
        el.textContent = ltr[cls] || '';
      });
      document.querySelectorAll('.vip_txt[data-seller-id="' + uid + '"]').forEach(function(el) {
        el.textContent = enName;
      });
    }

    // 2. .credit_mark2 — myroom 큰 육각형 아이콘 (credit_GOLD → credit_PLATINUM 등)
    // 아이콘 CSS는 서버 사이드에서 <head>에 주입 (gradeIconCss). 여기선 클래스만 교체.
    document.querySelectorAll('.credit_mark2').forEach(function(el) {
      GRADES.forEach(function(g) { el.classList.remove('credit_' + GRADE_EN[g]); });
      el.classList.add('credit_' + enName);
      el.textContent = enName;
    });

    // 3. .level_txt — myroom "GOLD" 큰 제목 (f_GOLD → f_PLATINUM + 텍스트)
    document.querySelectorAll('.level_txt').forEach(function(el) {
      GRADES.forEach(function(g) { el.classList.remove('f_' + GRADE_EN[g]); });
      el.classList.add('f_' + enName);
      el.textContent = enName;
    });

    // 4. .level_desc 내 f_GRADE span — myroom "골드 (81점)" 텍스트 부분
    document.querySelectorAll('.level_desc span, .level_desc [class]').forEach(function(el) {
      var fCls = [];
      el.classList.forEach(function(c) { if (/^f_/.test(c)) fCls.push(c); });
      if (!fCls.length) return;
      fCls.forEach(function(c) { el.classList.remove(c); });
      el.classList.add('f_' + enName);
      // 텍스트 내 한국어 등급명만 교체 (점수 숫자는 유지)
      var txt = el.textContent || '';
      GRADES.forEach(function(g) { txt = txt.replace(GRADE_KO[g], koName); });
      el.textContent = txt;
    });

    // 5. .level_desc > div 텍스트 노드 — "기우혁 회원님의 신용등급은 ..." 에서 등급명 교체
    document.querySelectorAll('.level_desc > div').forEach(function(div) {
      div.childNodes.forEach(function(node) {
        if (node.nodeType === 3) {
          var t = node.textContent || '';
          GRADES.forEach(function(g) { t = t.replace(GRADE_KO[g], koName); });
          node.textContent = t;
        }
      });
    });
  }

  // 어드민에서 닉네임 변경 시 SSE → CustomEvent → 여기서 수신
  window.addEventListener('im:nickname', function(e) {
    var nick = e.detail && e.detail.nickname;
    if (!nick) return;
    if (currentUser) {
      currentUser.nickname = nick;
      updateHeader();
    }
    // 마이룸: level_desc 텍스트 노드 교체
    var levelDesc = document.querySelector('.level_desc > div');
    if (levelDesc) {
      levelDesc.childNodes.forEach(function(node) {
        if (node.nodeType === 3 && node.textContent.trim()) {
          node.textContent = node.textContent.replace(/^[^\s]+/, nick);
        }
      });
    }
    // 공통 닉네임 셀렉터
    document.querySelectorAll('.mr_user_name,.user_name,.nick_name').forEach(function(el) {
      if (el.textContent.trim()) el.textContent = nick;
    });
  });

  // 어드민에서 등급 변경 시 SSE → CustomEvent → 여기서 수신
  window.addEventListener('im:grade', function(e) {
    var grade = e.detail && e.detail.grade;
    if (currentUser) currentUser.grade = grade || null;
    applyGradeBadge(grade);
    setTimeout(function() { applyGradeBadge(grade); }, 300);
    setTimeout(function() { applyGradeBadge(grade); }, 900);
    setTimeout(function() { applyGradeBadge(grade); }, 2500);
  });

  // --- 모달 열기/닫기 ---
  function openModal(html) {
    modalBody.innerHTML = html;
    overlay.classList.add('active');
  }
  function closeModal() {
    overlay.classList.remove('active');
    modalBody.innerHTML = '';
  }
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e){ if(e.target===overlay) closeModal(); });

  // --- API 호출 ---
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  // --- 헤더 업데이트 ---
  function updateHeader() {
    var loginsDiv = document.querySelector('.header-logins');
    if (!loginsDiv) return;
    if (currentUser) {
      loginsDiv.innerHTML =
        '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' +
          (currentUser.nickname || currentUser.email) + '님' +
        '</span>' +
        '<div class="divider"></div>' +
        '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
      document.getElementById('_im_logout_btn').addEventListener('click', function(e){
        e.stopImmediatePropagation();
        api('POST','/auth/logout').then(function(){ currentUser=null; location.href='/'; });
      }, true);
    } else {
      loginsDiv.innerHTML =
        '<a id="_im_login_link" href="/login" style="font-size:14px;font-weight:600;color:#2e2e2e;text-decoration:none">로그인</a>' +
        '<div class="divider"></div>' +
        '<a id="_im_join_link" href="/login" style="font-size:14px;font-weight:600;color:#2e2e2e;text-decoration:none">회원가입</a>';
      var ll = document.getElementById('_im_login_link');
      var jl = document.getElementById('_im_join_link');
      function _goLogin(e) { e.preventDefault(); e.stopImmediatePropagation(); try { sessionStorage.setItem('_im_login_next', location.href); } catch(ex) {} location.href = '/login'; }
      if (ll) ll.addEventListener('click', _goLogin, true);
      if (jl) jl.addEventListener('click', _goLogin, true);
    }
  }

  // --- 로그인 폼 ---
  function showLogin() {
    openModal(
      '<h2>로그인</h2>' +
      '<div class="tab-row">' +
        '<button class="tab-btn on" onclick="(function(){'+
          'document.querySelectorAll(\\'#_im_modal .tab-btn\\').forEach(function(b){b.classList.remove(\\'on\\')});'+
          'event.target.classList.add(\\'on\\');'+
        '})()">로그인</button>' +
        '<button class="tab-btn" onclick="IM_showRegister()">회원가입</button>' +
      '</div>' +
      '<input type="email" id="_im_e" placeholder="이메일" />' +
      '<input type="password" id="_im_p" placeholder="비밀번호" />' +
      '<button class="submit-btn" onclick="IM_doLogin()">로그인</button>' +
      '<div class="errmsg" id="_im_err"></div>'
    );
    setTimeout(function(){ var el=document.getElementById('_im_e'); if(el) el.focus(); }, 50);
  }

  function showRegister() {
    openModal(
      '<h2>회원가입</h2>' +
      '<div class="tab-row">' +
        '<button class="tab-btn" onclick="IM_showLogin()">로그인</button>' +
        '<button class="tab-btn on" onclick="(function(){'+
          'document.querySelectorAll(\\'#_im_modal .tab-btn\\').forEach(function(b){b.classList.remove(\\'on\\')});'+
          'event.target.classList.add(\\'on\\');'+
        '})()">회원가입</button>' +
      '</div>' +
      '<input type="text" id="_im_n" placeholder="닉네임" />' +
      '<input type="email" id="_im_e" placeholder="이메일" />' +
      '<input type="password" id="_im_p" placeholder="비밀번호 (6자 이상)" />' +
      '<button class="submit-btn" onclick="IM_doRegister()">가입하기</button>' +
      '<div class="errmsg" id="_im_err"></div>'
    );
    setTimeout(function(){ var el=document.getElementById('_im_n'); if(el) el.focus(); }, 50);
  }

  // 전역으로 노출 (onclick에서 사용)
  window.IM_showLogin = showLogin;
  window.IM_showRegister = showRegister;

  window.IM_doLogin = function() {
    var email = (document.getElementById('_im_e')||{}).value || '';
    var pw    = (document.getElementById('_im_p')||{}).value || '';
    var errEl = document.getElementById('_im_err');
    if (!email || !pw) { errEl.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }
    api('POST','/auth/login',{ email:email, password:pw }).then(function(data){
      if (data && data.id) {
        currentUser = data;
        window._IM_USER = data;
        updateHeader();
        if (typeof _imApplyHeader === 'function') _imApplyHeader(data);
        closeModal();
      } else {
        errEl.textContent = (data && data.error) || '로그인에 실패했습니다.';
      }
    });
  };

  window.IM_doRegister = function() {
    var nick  = (document.getElementById('_im_n')||{}).value || '';
    var email = (document.getElementById('_im_e')||{}).value || '';
    var pw    = (document.getElementById('_im_p')||{}).value || '';
    var errEl = document.getElementById('_im_err');
    if (!nick || !email || !pw) { errEl.textContent = '모든 항목을 입력해주세요.'; return; }
    api('POST','/auth/register',{ nickname:nick, email:email, password:pw }).then(function(data){
      if (data && data.id) {
        currentUser = data;
        window._IM_USER = data;
        updateHeader();
        if (typeof _imApplyHeader === 'function') _imApplyHeader(data);
        closeModal();
      } else {
        errEl.textContent = (data && data.error) || '가입에 실패했습니다.';
      }
    });
  };

  // --- 전체서비스 패널 토글 ---
  function initPanel() {
    var panel = document.getElementById('headerMainPanel');
    var menuBtn = document.querySelector('.header-menu');
    if (!panel || !menuBtn) { setTimeout(initPanel, 200); return; }

    // 패널 HTML 주입 — /api/panel-inner에서 원본 HTML fetch
    if (!panel.querySelector('.header-panel-inner')) {
      fetch('/api/panel-inner')
        .then(function(r){ return r.text(); })
        .then(function(html){ panel.innerHTML = html; })
        .catch(function(){});
    }

    // 패널 초기화: sf-hidden(display:none) 제거 후 display로 제어
    panel.classList.remove('is-open');
    panel.classList.remove('sf-hidden');
    panel.removeAttribute('aria-hidden');
    panel.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    panel.style.display = 'none';

    function openPanel() {
      panel.style.display = '';
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closePanel() {
      panel.classList.remove('is-open');
      panel.style.display = 'none';
      panel.setAttribute('aria-hidden', 'true');
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    // 3단바 버튼 클릭
    menuBtn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (panel.classList.contains('is-open')) { closePanel(); } else { openPanel(); }
    }, true);

    // 배경 클릭으로 닫기
    panel.addEventListener('click', function(e) {
      if (e.target.hasAttribute('data-header-panel-close') ||
          e.target.classList.contains('header-panel-backdrop')) {
        closePanel();
      }
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) { closePanel(); }
    });

    // 패널 내부: 프록시 링크는 그냥 이동 (href는 이미 서버에서 rewrite됨)
    panel.addEventListener('click', function(e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.startsWith('/')) { closePanel(); }
    });
  }

  initPanel();

  // 차단 마커가 붙은 링크 클릭 → 준비 중 안내 (body 버블링만, document 전역 X)
  document.body.addEventListener('click', function(e) {
    var a = e.target.closest && e.target.closest('a[data-blocked]');
    if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
  });

  // --- 버튼 후킹 ---
  function hookButtons() {
    var loginsDiv = document.querySelector('.header-logins');
    if (!loginsDiv) { setTimeout(hookButtons, 200); return; }

    var loginBtn     = loginsDiv.querySelector('button');
    var registerLink = loginsDiv.querySelector('a');

    if (loginBtn) {
      loginBtn.addEventListener('click', function(e){
        e.preventDefault(); e.stopImmediatePropagation();
        try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login';
      }, true);
    }
    if (registerLink) {
      registerLink.addEventListener('click', function(e){
        e.preventDefault(); e.stopImmediatePropagation();
        try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login';
      }, true);
    }

    // Enter 키 로그인/가입 지원
    document.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && overlay.classList.contains('active')) {
        var submitBtn = document.querySelector('#_im_modal .submit-btn');
        if (submitBtn) submitBtn.click();
      }
    });

    // 채팅 버튼 → 채팅 목록 별도 창으로 열기 (document 위임 — 어느 페이지서든 동작)
    document.addEventListener('click', function(e) {
      var target = e.target;
      // #chat_notice 안의 버튼/이미지/링크이거나 header-message 영역 클릭
      var el = target;
      while (el && el !== document.body) {
        if (el.id === 'chat_notice' || (el.classList && el.classList.contains('header-message'))) {
          e.preventDefault(); e.stopImmediatePropagation();
          var nOpen = window._nativeOpen || window.open.bind(window);
          var w = nOpen('/myroom/chat/list.html', 'im_chat_list', 'width=900,height=700,resizable=yes,scrollbars=yes');
          if (!w || w.closed) { location.href = '/myroom/chat/list.html'; }
          return;
        }
        el = el.parentElement;
      }
    }, true);

    // 이미 로그인 여부 확인 + 외부 JS 덮어쓰기 방어
    window._IM_auth().then(function(data){
      if (data && data.id) { currentUser = data; }
      updateHeader();

      // 원본 itemmania.js가 .header-logins를 덮어쓸 경우 즉시 재적용
      var loginsTarget = document.querySelector('.header-logins');
      if (loginsTarget) {
        var _headerObserver = new MutationObserver(function(){
          _headerObserver.disconnect();
          updateHeader();
          setTimeout(function(){
            var t = document.querySelector('.header-logins');
            if (t) _headerObserver.observe(t, { childList: true, subtree: true, characterData: true });
          }, 50);
        });
        _headerObserver.observe(loginsTarget, { childList: true, subtree: true, characterData: true });
      }

      // 지연 안전장치: 원본 JS가 늦게 실행돼도 최종 상태 보장
      setTimeout(updateHeader, 300);
      setTimeout(updateHeader, 800);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookButtons);
  } else {
    hookButtons();
  }
})();
</script>
`;

const HOMEPAGE_INTERCEPT_SCRIPT = externalizeHomepageImages(INTERCEPT_SCRIPT);

// 로그인 페이지 전용 인터셉트 스크립트
const LOGIN_INTERCEPT_SCRIPT = `
<style>
.im-member-login{display:flex!important;align-items:center;justify-content:center;width:100%;box-sizing:border-box;background:#03b753!important;background-image:none!important;color:#fff!important;text-decoration:none!important;font-size:15px;font-weight:700;min-height:40px;border-radius:5px}
.im-member-login::before,.im-member-login::after{content:none!important;background:none!important}
/* ── 로그인 페이지 모바일 ── */
@media(max-width:768px){
  html,body{overflow-x:hidden!important;}
  #g_POPUP,.popup_content,.popup_wrap{width:100%!important;min-width:0!important;box-sizing:border-box!important;}
  .login_form{width:100%!important;min-width:0!important;box-sizing:border-box!important;padding:40px 20px 80px!important;}
  .login_form .g_title{font-size:20px!important;}
  .login_form .btn,.login_form button{width:100%!important;box-sizing:border-box!important;}
  #naver_id_login,.naver_login,.kakao_login,.social_login{width:100%!important;box-sizing:border-box!important;}
  #naver_id_login img,.naver_login img{width:100%!important;height:auto!important;}
  .login_sns_area{width:100%!important;box-sizing:border-box!important;}
}
</style>
<script>
(function() {
  function stripCSP() {
    document.querySelectorAll('meta[http-equiv="content-security-policy"]').forEach(el => el.remove());
  }

  function showError(msg) {
    var errEl = document.getElementById('_im_login_err');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.id = '_im_login_err';
      errEl.style.cssText = 'color:#e53e3e;font-size:14px;margin:8px 0 0;text-align:center;';
      var form = document.querySelector('form[name=g_LOGIN_FORM]');
      if (form) form.appendChild(errEl);
    }
    errEl.textContent = msg;
  }

  function init() {
    stripCSP();

    // 로그인 폼 가로채기
    var loginForm = document.querySelector('form[name=g_LOGIN_FORM]');
    if (loginForm) {
      loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var userId = document.getElementById('user_id').value.trim();
        var userPw = document.getElementById('user_password').value;
        var btn = loginForm.querySelector('button[type=submit]');
        if (btn) btn.disabled = true;
        try {
          var res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
             body: JSON.stringify({
               email: userId, password: userPw,
               ...(document.getElementById('im-mobile-login') ? { autoLogin: document.getElementById('auto_login').checked } : {})
             })
          });
          var data = await res.json();
          if (res.ok) {
             if (document.getElementById('im-mobile-login')) {
               try {
                 if (document.getElementById('id_save').checked) localStorage.setItem('im-login-saved-id', userId);
                 else localStorage.removeItem('im-login-saved-id');
               } catch(e2) {}
             }
            var dest = '/myroom/index.html';
            try {
              var requested = new URLSearchParams(location.search).get('returnUrl');
              var next = sessionStorage.getItem('_im_login_next');
              var candidate = requested || next;
              if (candidate) {
                var target = new URL(candidate, location.origin);
                if (target.origin === location.origin && !target.pathname.startsWith('/login')) {
                  dest = target.pathname + target.search + target.hash;
                }
              }
              sessionStorage.removeItem('_im_login_next');
            } catch(e2) {}
            // 이 팝업 안에서 방을 준비해 곧바로 채팅 URL로 이동한다.
            // 상품 상세 페이지(전체 사이트)를 잠깐 띄우거나 원래 구매글 창을 이동시키지 않는다.
            var pendingChat = sessionStorage.getItem('_im_product_chat_after_login');
            var loginIntent;
            try { loginIntent = pendingChat && JSON.parse(pendingChat); } catch(ex) {}
            // 로그인은 판매신청이 아니다. 배포 전에 열었던 로그인 팝업도 처리한다.
            if (loginIntent && loginIntent.intent === 'sale') {
              sessionStorage.removeItem('_im_product_chat_after_login');
              sessionStorage.removeItem('_im_sale_after_login');
              sessionStorage.removeItem('_im_chat_after_login');
              if (window.opener && !window.opener.closed && loginIntent.returnPath === dest) {
                try {
                  if (window.opener.location.origin === location.origin) {
                    window.opener.location.href = dest;
                    window.close();
                    return;
                  }
                } catch(ex) {}
              }
              window.name = '';
              location.replace(dest);
              return;
            }
            if (pendingChat && window.opener && window.name.indexOf('im_product_chat_') === 0) {
              var pending;
              try { pending = JSON.parse(pendingChat); } catch(ex) {}
              if (pending && pending.returnPath === dest &&
                  Number.isSafeInteger(pending.productId) && pending.productId > 0 &&
                  Number.isSafeInteger(pending.buyerId) && pending.buyerId > 0) {
                var roomRes = await fetch('/api/chat/rooms', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ buyerId: pending.buyerId, productId: pending.productId })
                });
                var room = await roomRes.json();
                if (!roomRes.ok || !room.id) {
                  showError(room.error || '채팅방을 준비하지 못했습니다. 다시 시도해 주세요.');
                  if (btn) btn.disabled = false;
                  return;
                }
                sessionStorage.removeItem('_im_product_chat_after_login');
                if (pending.intent === 'sale' && window.opener && !window.opener.closed && window.opener._im_notify_sale_application) {
                  window.opener._im_notify_sale_application('판매신청이 되었습니다', false);
                }
                location.replace('/myroom/chat/new_chat.html?roomId=' + room.id);
                return;
              }
              sessionStorage.removeItem('_im_product_chat_after_login');
            }
            location.replace(dest);
          } else {
            showError(data.error || '아이디 또는 비밀번호가 올바르지 않습니다.');
            if (btn) btn.disabled = false;
          }
        } catch(err) {
          showError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          if (btn) btn.disabled = false;
        }
      });
    }

    // 자체 회원 로그인으로 명확하게 표시한 대체 화면. 외부 계정 인증이 아니다.
    document.addEventListener('click', function(e) {
      var entry = e.target.closest && e.target.closest('#im_member_login');
      if (!entry) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      location.assign('/login/member' + location.search);
    }, true);

    // 차단 마커 링크 → 준비 중 (body 버블링만)
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });

    // 헤더 로그인 버튼 → 현재 페이지 유지
    var headerLoginBtn = document.querySelector('.header-logins button');
    if (headerLoginBtn) {
      headerLoginBtn.addEventListener('click', function(e) {
        e.preventDefault();
      });
    }

    // 회원가입 링크 차단
    var joinLink = document.querySelector('.header-logins a');
    if (joinLink) {
      joinLink.addEventListener('click', function(e) {
        e.preventDefault();
        alert('회원가입은 메인 페이지에서 이용해주세요.');
        location.href = '/';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

const GIFTCARD_INTERCEPT_SCRIPT = `
<style>
/* 로그인 모달/오버레이 강제 숨김 */
.g_layer:not(.all_menu_layer),
.g_popup,
.g_dim,
[class*="login_layer"],
[class*="login_modal"],
[id*="login_layer"],
[id*="login_pop"] {
  display: none !important;
}
/* 캐러셀이 g_container min-height를 height:100%로 상속해 공백 발생 → 수정 */
.carousel_module { height: auto !important; }
.carousel_module > .banner_in > .banner_item .carousel_images {
  position: static !important;
  left: auto !important;
  transform: none !important;
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
}
.center_banner > .banner_item > a { height: auto !important; }
</style>
<script>
(function() {
  // 로그인 팝업 함수 무력화
  var noop = function() {};
  var loginFns = ['g_login_open','loginOpen','openLogin','showLogin','login_popup','loginPopup','g_login_popup'];
  loginFns.forEach(function(fn) { window[fn] = noop; });

  // MutationObserver로 동적으로 추가되는 로그인 모달 차단
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        var el = node;
        var cls = el.className || '';
        var id  = el.id || '';
        if (
          (cls.includes('g_layer') && !cls.includes('all_menu_layer')) ||
          cls.includes('g_popup') ||
          cls.includes('g_dim') ||
          id.toLowerCase().includes('login')
        ) {
          el.style.display = 'none';
        }
        // 자식 노드 중 로그인 모달도 처리
        el.querySelectorAll && el.querySelectorAll('.g_layer:not(.all_menu_layer), .g_popup, .g_dim').forEach(function(child) {
          child.style.display = 'none';
        });
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function init() {
    // 이미 있는 모달 숨김
    document.querySelectorAll('.g_layer:not(.all_menu_layer), .g_popup, .g_dim').forEach(function(el) {
      el.style.display = 'none';
    });

    // 로그인 팝업 함수 재무력화 (사이트 JS가 나중에 정의할 수 있으므로)
    loginFns.forEach(function(fn) { window[fn] = noop; });

    // 로그인 버튼 → 로그인 페이지 (특정 요소에만 핸들러)
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login';
      }, true);
    }

    // 차단 마커 링크 → 준비 중 (body 버블링만, document 전역 X)
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

const GAMEMANIA_INTERCEPT_SCRIPT = `
<script>
(function() {
  // 차단 마커 링크 → 준비 중 (body 버블링만)
  document.body.addEventListener('click', function(e) {
    var a = e.target.closest && e.target.closest('a[data-blocked]');
    if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
  });
})();
</script>
`;

const GAMECHARGE_INTERCEPT_SCRIPT = `
<style>
/* 캐러셀이 g_container min-height를 height:100%로 상속해 거대한 공백 발생 → 수정 */
.carousel_module { height: auto !important; }
.carousel_module > .banner_in > .banner_item .carousel_images {
  position: static !important;
  left: auto !important;
  transform: none !important;
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
}
.center_banner > .banner_item > a { height: auto !important; }
</style>
<script>
(function() {
  var noop = function() {};
  var loginFns = ['showLogin','openLogin','g_login','gLogin','loginPop','loginPopup'];
  loginFns.forEach(function(fn) { try { window[fn] = noop; } catch(e) {} });

  // 로그인 팝업 MutationObserver로 억제
  var observer = new MutationObserver(function() {
    document.querySelectorAll('.g_layer:not(.all_menu_layer), .g_popup, .g_dim').forEach(function(el) {
      el.style.display = 'none';
    });
    loginFns.forEach(function(fn) { try { if (window[fn] !== noop) window[fn] = noop; } catch(e) {} });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  function init() {
    document.querySelectorAll('.g_layer:not(.all_menu_layer), .g_popup, .g_dim').forEach(function(el) {
      el.style.display = 'none';
    });
    loginFns.forEach(function(fn) { try { window[fn] = noop; } catch(e) {} });

    // 로그인 버튼 → 로그인 페이지 (해당 요소에만)
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login';
      }, true);
    }

    // 충전 submit 버튼 → 준비 중 (해당 요소에만)
    document.querySelectorAll('form button[type=submit], .charge_btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        alert('게임 충전 서비스는 현재 준비 중입니다.');
      }, true);
    });

    // 차단 마커 링크 → 준비 중 (body 버블링만)
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

function stripCsp(html: string): string {
  return html.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi,
    ""
  );
}

/**
 * itemmania.com 경로를 /... 경로로 매핑 (더 구체적인 경로 우선)
 * query string / fragment 보존
 */
function mapImPath(rawPath: string): string {
  const path = rawPath || '/';
  const qi = path.indexOf('?');
  const hi = path.indexOf('#');
  const end = qi >= 0 ? qi : (hi >= 0 ? hi : path.length);
  const base = path.slice(0, end);
  const qs   = path.slice(end);

  if (base.startsWith('/portal/user/p_login_form'))              return '/login';
  if (base.startsWith('/sell/list'))                             return '/sell/list.html' + qs;
  if (base.startsWith('/sell/application'))                      return '/sell/application.html' + qs;
  if (base.startsWith('/sell/new'))                              return '/sell/new.html' + qs;
  if (base.startsWith('/sell/index_view'))                       return '/sell/index_view.html' + qs;
  if (base === '/sell' || base === '/sell/')                     return '/sell/register.html';
  if (base.startsWith('/sell/'))                                 return '/sell/list.html' + qs;
  if (base.startsWith('/buy/register'))                          return '/buy/register.html' + qs;
  if (base.startsWith('/buy/index_view'))                        return '/buy/index_view.html' + qs;
  if (base.startsWith('/buy/application'))                       return '/buy/application.html' + qs;
  if (base.startsWith('/buy/list'))                              return '/buy/list.html' + qs;
  if (base === '/buy' || base === '/buy/')                       return '/buy/register.html';
  if (base.startsWith('/myroom/mileage/payment/payment_phone_list')) return '/myroom/mileage/payment/payment_phone_list.html' + qs;
  if (base.startsWith('/myroom/mileage/payment/payment_phone'))  return '/myroom/mileage/payment/payment_phone.html';
  if (base.startsWith('/myroom/mileage/payment/payment_switch')) return '/myroom/mileage/payment/index.html';
  if (base.startsWith('/myroom/mileage/payment/payment_list'))   return '/myroom/mileage/payment/payment_list.html' + qs;
  if (base.startsWith('/myroom/mileage/payment/index') || base === '/myroom/mileage/payment/') return '/myroom/mileage/payment/index.html';
  if (base.startsWith('/myroom/mileage/my_mileage'))             return '/myroom/index.html';
  if (base.startsWith('/myroom/batch_goods'))                    return '/myroom/batch_goods/index.html';
  if (base.startsWith('/myroom/chat/new_chat'))                  return '/myroom/chat/new_chat.html';
  if (base.startsWith('/myroom/chat/list'))                      return '/myroom/chat/list.html' + qs;
  if (base.startsWith('/myroom/chat'))                           return '/myroom/chat/list.html';
  if (base.startsWith('/myroom/sell/sell_regist'))               return '/myroom/sell/sell_regist.html';
  if (base.startsWith('/myroom/sell/sell_check'))                return '/myroom/sell/sell_check.html';
  if (base.startsWith('/myroom/sell/sell_pay_wait'))             return '/myroom/sell/sell_pay_wait.html';
  if (base.startsWith('/myroom/sell/sell_ing'))                  return '/myroom/sell/sell_ing.html';
  if (base.startsWith('/myroom/buy/buy_regist'))                 return '/myroom/buy/buy_regist.html';
  if (base.startsWith('/myroom/buy/buy_check'))                  return '/myroom/buy/buy_check.html';
  if (base.startsWith('/myroom/buy/buy_pay_wait'))               return '/myroom/buy/buy_pay_wait.html';
  if (base.startsWith('/myroom/buy/buy_ing'))                    return '/myroom/buy/buy_ing.html';
  if (base === '/myroom' || base === '/myroom/')                 return '/myroom/index.html';
  if (base.startsWith('/game_charge'))                           return '/game-charge';
  if (base.startsWith('/portal/giftcard'))                       return '/giftcard';
  if (base === '/' || base === '')                               return '/';
  // 알 수 없는 경로: / 하위로 보냄 (Express 404 또는 302 처리)
  return (base.startsWith('/') ? base : '/' + base) + qs;
}

/** HTML 전체(JS 문자열 포함)에서 외부 도메인을 제거/치환 */
function rewriteExternalLinks(html: string): string {
  let result = html;

  // itemmania.com 모든 URL → /... (regex 기반, query string 보존)
  result = result.replace(
    /https?:\/\/(?:www\.|m\.|ssadaprice\.)?itemmania\.com([^"'\s<>\u0022\u0027]*)/g,
    (_match: string, path: string) => mapImPath(path)
  );

  // gamemania.co.kr → 프록시 경로
  for (const host of [
    'https://www.gamemania.co.kr',
    'http://www.gamemania.co.kr',
    'https://gamemania.co.kr',
  ]) {
    result = result.split(host).join('/gamemania');
  }

  return result;
}

/** 모든 페이지에 주입되는 전역 네비게이션 인터셉터 — window.open / location.assign 등 재정의 */
// Replit iframe 에러 감지 차단 + 원본 itemmania.com JS 에러 억제
const ERROR_SUPPRESSOR = `<script>
(function(){
  // 네이티브 window.open을 최초 시점에 저장 — 이후 스크립트가 재정의해도 채팅 팝업은 원본 사용
  window._nativeOpen = window.open.bind(window);
  // 모든 JS 에러 억제 (itemmania.com 원본 스크립트 SyntaxError 등)
  window.onerror = function(){ return true; };
  window.addEventListener('error', function(e){ e.stopImmediatePropagation(); }, true);
  window.addEventListener('unhandledrejection', function(e){ e.preventDefault(); e.stopImmediatePropagation(); }, true);
  // Replit/Vite runtime-error-plugin 의 postMessage 차단
  var _origPost = window.parent && window.parent !== window ? window.parent.postMessage.bind(window.parent) : null;
  if (_origPost) {
    window.parent.postMessage = function(data){ if (data && data.type === 'runtime-error') return; _origPost.apply(this, arguments); };
  }
})();
</script>`;

const GLOBAL_MOBILE_STYLE = `<style>
/* ── 전역 모바일 반응형 ── */
@media(max-width:768px){
  html,body{overflow-x:hidden!important;max-width:100vw!important;}

  /* 1. 1080px 고정 컨테이너 → 100% 반응형 */
  .content_center,.content_wrap,.inner_wrap,.wrap,.page_wrap{
    width:100%!important;min-width:0!important;max-width:100%!important;
    box-sizing:border-box!important;
  }

  /* 2. 헤더 */
  .g_header{width:100%!important;min-width:0!important;box-sizing:border-box!important;}
  .g_header .header-inner{width:100%!important;min-width:0!important;box-sizing:border-box!important;padding:0 12px!important;}
  .g_header .header-nav-wrapper{margin-left:8px!important;height:auto!important;flex:1!important;justify-content:flex-end!important;}
  .g_header .header-nav{display:none!important;}
  .g_header .header-actions{gap:6px!important;}
  .g_header .header-logins{gap:8px!important;font-size:13px!important;}
  .g_header .header-message,.g_header .header-fav{display:none!important;}
  .g_header .header-menu{display:flex!important;flex-direction:column!important;gap:5px!important;padding:8px!important;}

  /* 3. ★ float 2단 레이아웃 → 세로 스택 (마이룸/판매등록/결제/구매등록 공통) */
  .content_center{overflow:hidden!important;}
  .aside{float:none!important;width:100%!important;margin-bottom:16px!important;box-sizing:border-box!important;}
  .g_content{float:none!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;}

  /* 4. 테이블 → 반응형 */
  table{width:100%!important;table-layout:fixed!important;}
  table td,table th{word-break:break-all!important;white-space:normal!important;}

  /* 5. 폼 인풋/셀렉트/버튼 */
  input[type=text],input[type=number],input[type=password],input[type=email],
  select,textarea{
    width:100%!important;max-width:100%!important;box-sizing:border-box!important;
    min-height:40px!important;font-size:16px!important;
  }
  /* 입력 폼 wrapper */
  .table_form td,.form_row,.input_row{width:100%!important;box-sizing:border-box!important;display:block!important;}

  /* 6. 판매/구매 등록 폼 */
  #dvPopup,.reg_wrap,.sub_wrap{width:100%!important;min-width:0!important;box-sizing:border-box!important;}
  .menu_know{width:100%!important;box-sizing:border-box!important;}

  /* 7. 마이룸 판매/구매 주문 상세 카드 */
  .trade_wrap,.order_wrap,.trade_detail,.trade_item{
    width:100%!important;min-width:0!important;box-sizing:border-box!important;flex-wrap:wrap!important;
  }

  /* 8. 실시간 거래 탭 가로 스크롤 */
  .real_time_list,.realtime_wrap,.live_tab,.live_list,.top_game_list{
    overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;flex-wrap:nowrap!important;
  }
}
</style>`;

const GLOBAL_NAV_INTERCEPTOR = `<script>
(function(){
'use strict';
var ROUTE_MAP=[
  ['/portal/user/logout_ok.html','/'],
  ['/portal/user/p_logout_form.html','/'],
  ['/portal/user/logout.html','/'],
  ['/portal/user/p_login_form.html','/login'],
  ['/myroom/mileage/payment/payment_phone_list.html','/myroom/mileage/payment/payment_phone_list.html'],
  ['/myroom/mileage/payment/payment_switch.html','/myroom/mileage/payment/index.html'],
  ['/myroom/mileage/payment/payment_phone.html','/myroom/mileage/payment/payment_phone.html'],
  ['/myroom/mileage/payment/payment_list.html','/myroom/mileage/payment/payment_list.html'],
  ['/myroom/mileage/payment/index.html','/myroom/mileage/payment/index.html'],
  ['/myroom/mileage/my_mileage/','/myroom/index.html'],
  ['/myroom/mileage/my_mileage','/myroom/index.html'],
  ['/myroom/batch_goods/index.html','/myroom/batch_goods/index.html'],
  ['/sell/application.html','/sell/application.html'],
  ['/sell/new.html','/sell/new.html'],
  ['/sell/list.html','/sell/list.html'],
  ['/sell/index_view.html','/sell/index_view.html'],
  ['/sell/','/sell/register.html'],
  ['/sell','/sell/register.html'],
  ['/buy/register.html','/buy/register.html'],
  ['/buy/index_view.html','/buy/index_view.html'],
  ['/buy/application.html','/buy/application.html'],
  ['/buy/list.html','/buy/list.html'],
  ['/buy/','/buy/register.html'],
  ['/buy','/buy/register.html'],
  ['/myroom/chat/new_chat.html','/myroom/chat/new_chat.html'],
  ['/myroom/chat/list.html','/myroom/chat/list.html'],
  ['/myroom/chat/','/myroom/chat/list.html'],
  ['/myroom/chat','/myroom/chat/list.html'],
  ['/myroom/sell/sell_regist.html','/myroom/sell/sell_regist.html'],
  ['/myroom/sell/sell_check.html','/myroom/sell/sell_check.html'],
  ['/myroom/sell/sell_pay_wait.html','/myroom/sell/sell_pay_wait.html'],
  ['/myroom/sell/sell_ing.html','/myroom/sell/sell_ing.html'],
  ['/myroom/buy/buy_regist.html','/myroom/buy/buy_regist.html'],
  ['/myroom/buy/buy_check.html','/myroom/buy/buy_check.html'],
  ['/myroom/buy/buy_pay_wait.html','/myroom/buy/buy_pay_wait.html'],
  ['/myroom/buy/buy_ing.html','/myroom/buy/buy_ing.html'],
  ['/game_charge/','/game-charge'],
  ['/game_charge','/game-charge'],
  ['/portal/giftcard/','/giftcard'],
  ['/portal/giftcard','/giftcard'],
  ['/customer/','/customer/'],
  ['/customer','/customer/'],
  ['/myroom/','/myroom/index.html'],
  ['/myroom','/myroom/index.html'],
  ['/','/'],
];
var IM_ORIGINS=[
  'https://www.itemmania.com','http://www.itemmania.com',
  'https://itemmania.com','http://itemmania.com',
];
var GM_ORIGINS=['https://www.gamemania.co.kr','http://www.gamemania.co.kr','https://gamemania.co.kr'];
function rewrite(url){
  if(!url||typeof url!=='string') return url;
  var u=url.trim();
  for(var g=0;g<GM_ORIGINS.length;g++) if(u.startsWith(GM_ORIGINS[g])) return '/gamemania';
  for(var i=0;i<IM_ORIGINS.length;i++){
    if(u.startsWith(IM_ORIGINS[i])){
      var path=u.slice(IM_ORIGINS[i].length)||'/';
      for(var r=0;r<ROUTE_MAP.length;r++){
        if(path===ROUTE_MAP[r][0]||path.startsWith(ROUTE_MAP[r][0])){
          return ROUTE_MAP[r][1]+(path.length>ROUTE_MAP[r][0].length?path.slice(ROUTE_MAP[r][0].length):'');
        }
      }
      return '/';
    }
  }
  /* 로컬 경로도 ROUTE_MAP 첫 3개(logout)는 세션 보호를 위해 차단 */
  if(u.startsWith('/')){
    for(var lr=0;lr<3;lr++){
      if(u===ROUTE_MAP[lr][0]||u.startsWith(ROUTE_MAP[lr][0]+'?')){
        return ROUTE_MAP[lr][1];
      }
    }
  }
  return url;
}
/* ── fetch / XHR 인터셉터: itemmania.com API 호출 → 우리 API로 대체 ── */
var IM_API_ORIGINS=['https://www.itemmania.com','http://www.itemmania.com','https://itemmania.com','http://itemmania.com'];
function isImOrigin(url){if(!url)return false;for(var i=0;i<IM_API_ORIGINS.length;i++)if(url.startsWith(IM_API_ORIGINS[i]))return true;return false;}
function imPathOf(url){for(var i=0;i<IM_API_ORIGINS.length;i++)if(url.startsWith(IM_API_ORIGINS[i]))return url.slice(IM_API_ORIGINS[i].length);return url;}
/* 우리 API로 요청 라우팅 */
function proxyImFetch(url,init){
  var path=imPathOf(url);
  /* 상품 검색/목록 */
  if(/[/](item|goods|product|search|list)/.test(path)){
    var qs=path.includes('?')?path.slice(path.indexOf('?')):'';
    var params=new URLSearchParams(qs);
    var apiUrl='/api/products';
    var q=params.get('keyword')||params.get('search')||params.get('q')||params.get('search_keyword')||'';
    var game=params.get('search_game')||params.get('game_id')||params.get('game')||'';
    var parts=[];
    if(q) parts.push('search='+encodeURIComponent(q));
    if(game) parts.push('gameId='+encodeURIComponent(game));
    if(parts.length) apiUrl+='?'+parts.join('&');
    return fetch(apiUrl,{credentials:'include'});
  }
  /* 로그인 상태 확인 — itemmania 원본 JS가 비로그인으로 판단해 /login으로 리다이렉트하는 것 방지.
     상품 상세(application) 페이지는 누구나 볼 수 있어야 하므로 가짜 "로그인됨" 응답을 반환.
     실제 구매/채팅 액션은 우리 스크립트에서 window._IM_auth()로 별도 체크. */
  if(/[/](session|auth|login|member|user)/.test(path)){
    var _fakeGuest={result:'ok',isLogin:true,memberID:'guest',data:[{memberID:'guest',isLogin:true,grade:''}]};
    return Promise.resolve(new Response(JSON.stringify(_fakeGuest),{status:200,headers:{'Content-Type':'application/json'}}));
  }
  /* 나머지 → 빈 JSON */
  return Promise.resolve(new Response(JSON.stringify({result:'ok',data:[]}),{status:200,headers:{'Content-Type':'application/json'}}));
}
/* fetch override */
var _origFetch=window.fetch;
window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url?input.url:'');
  if(isImOrigin(url)) return proxyImFetch(url,init);
  return _origFetch.apply(this,arguments);
};
/* XMLHttpRequest override */
var _XHR=window.XMLHttpRequest;
window.XMLHttpRequest=function(){
  var xhr=new _XHR();
  var _open2=xhr.open.bind(xhr);
  var _captured={url:null,method:'GET'};
  xhr.open=function(method,url){
    _captured.method=method; _captured.url=url;
    if(isImOrigin(url)){
      _open2.call(xhr,method,'/api/products');
      return;
    }
    return _open2.apply(xhr,arguments);
  };
  return xhr;
};
/* window.open → 현재 탭 이동 */
var _open=window.open;
window.open=function(url,target,feat){
  var rw=rewrite(url);
  if(rw!==url){location.href=rw;return null;}
  return _open?_open.call(window,url,target,feat):null;
};
/* location.assign / replace */
try{
  var _ass=location.assign.bind(location);
  var _rep=location.replace.bind(location);
  location.assign=function(u){_ass(rewrite(u));};
  location.replace=function(u){_rep(rewrite(u));};
}catch(e){}

/* 로그인 이동 전 현재 URL 저장 (로그인 후 복귀용) */
function _imSaveLoginNext(dest){
  var d=dest||'';
  var isLogin=d==='/login'||d.startsWith('/login?')||d.startsWith('/login#')||d.includes('/login');
  if(isLogin&&location.pathname&&!location.pathname.startsWith('/login')){
    try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){}
  }
}
/* a[href] 전역 클릭 */
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href]');
  if(!a) return;
  var h=a.getAttribute('href')||'';
  _imSaveLoginNext(h);
  var rw=rewrite(h);
  if(rw!==h){e.preventDefault();e.stopImmediatePropagation();location.href=rw;}
},true);
/* ── location.href setter 인터셉터 ── */
try{
  var _locDesc=Object.getOwnPropertyDescriptor(Location.prototype,'href');
  if(_locDesc&&_locDesc.set){
    Object.defineProperty(Location.prototype,'href',{
      get:_locDesc.get,
      set:function(val){
        _imSaveLoginNext(val);
        var rw=rewrite(val);
        _locDesc.set.call(this,rw);
      },
      configurable:true
    });
  }
}catch(e){}
/* ── history.pushState / replaceState 인터셉터 ── */
try{
  var _push=history.pushState.bind(history);
  var _repl=history.replaceState.bind(history);
  history.pushState=function(s,t,url){_push(s,t,url?rewrite(String(url)):url);};
  history.replaceState=function(s,t,url){_repl(s,t,url?rewrite(String(url)):url);};
}catch(e){}
/* ── form submit 인터셉터 ── */
document.addEventListener('submit',function(e){
  var form=e.target;
  if(!form||form.tagName!=='FORM') return;
  /* g_searchbar_form/frmSell/frmBuy 는 자체 submit 핸들러(preventDefault 포함)가 따로 처리하므로
     여기서 가로채면 그 전용 로직이 아예 실행되지 못한다 (stopImmediatePropagation 때문) → 제외 */
  if(form.id==='g_searchbar_form'||form.id==='frmSell'||form.id==='frmBuy'||form.name==='g_LOGIN_FORM') return;
  var action=form.action||location.href;
  var rw=rewrite(action);
  var isPost=(form.method||'get').toLowerCase()==='post';
  /* 경로 재작성이 필요 없어도, POST 폼은 서버가 GET만 지원하는 정적 스냅샷 페이지일 수 있으므로
     항상 GET 쿼리스트링 이동으로 변환한다 (Cannot POST 오류 방지) */
  if(rw!==action||isPost){
    e.preventDefault();
    e.stopImmediatePropagation();
    if(!isPost){
      /* GET 폼: action 바꿔서 재제출 */
      form.action=rw;
      form.submit();
    } else {
      /* POST 폼 (검색 등): 쿼리 파라미터로 변환해서 GET 이동 */
      var fd=new FormData(form);
      var params=new URLSearchParams();
      fd.forEach(function(v,k){params.set(k,String(v));});
      var qs=params.toString();
      location.href=rw+(qs?'?'+qs:'');
    }
  }
},true);
/* ── 메인 검색 공통 함수: 카테고리 포함 sell list 이동 ── */
var _IM_GOODS_CAT_MAP = {all:'',money:'게임머니',item:'아이템',character:'계정',etc:'기타'};
function _imDoGameSearch() {
  var form = document.getElementById('g_searchbar_form');
  var inp = form ? form.querySelector('input[name="searchGameServer"],input.search_gs_name') : null;
  var goodsEl = form ? form.querySelector('input[name="search_goods"]:checked') : null;
  var goods = goodsEl ? goodsEl.value : 'all';
  var itemCat = _IM_GOODS_CAT_MAP[goods] || '';
  function doNav(code) {
    var url = '/sell/list.html?search_game=' + encodeURIComponent(code);
    if (itemCat) url += '&itemCategory=' + encodeURIComponent(itemCat);
    location.href = url;
  }
  if (window._IM_sel_game && (window._IM_sel_game.code || window._IM_sel_game.id)) {
    doNav(window._IM_sel_game.code || String(window._IM_sel_game.id));
    return;
  }
  var keyword = (inp && inp.value.trim()) || '';
  if (keyword) {
    fetch('/api/games/search?q=' + encodeURIComponent(keyword), {credentials:'include'})
      .then(function(r){return r.ok?r.json():null;})
      .then(function(data){
        var games = data&&data.items ? data.items : (Array.isArray(data)?data:[]);
        if (games.length && (games[0].code || games[0].id)) {
          doNav(games[0].code || String(games[0].id));
        } else { location.href='/'; }
      })
      .catch(function(){ location.href='/'; });
  } else {
    location.href='/';
  }
}
/* ── g_searchbar_form submit 인터셉트 ── */
document.addEventListener('submit',function(e){
  var form=e.target;
  if(!form||form.id!=='g_searchbar_form') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  _imDoGameSearch();
},true);
/* ── 검색 버튼 직접 클릭 인터셉트 (원본 JS 보다 먼저 capture) ── */
document.addEventListener('click',function(e){
  var btn = e.target && e.target.closest && e.target.closest('#g_search_list, button.g_search_list[type="submit"]');
  if (!btn) return;
  if (!btn.closest('#g_searchbar_form')) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  _imDoGameSearch();
},true);
/* ── 카테고리 선택 패널 표시/숨김 ── */
function _imSetupSearchFrame() {
  var inp = document.getElementById('searchGameServer');
  if (!inp) { setTimeout(_imSetupSearchFrame, 300); return; }
  var form = inp.closest('#g_searchbar_form');
  if (!form) return;
  var frame = form.querySelector('.g_search_frame');
  if (!frame) return;
  var initScr = frame.querySelector('.initial_screen');
  var gsList = frame.querySelector('.gs_list');
  var _acTimer = null;
  /* 카테고리 탭: document 레벨 capture로 원본 JS보다 반드시 먼저 실행 */
  try { sessionStorage.setItem('_imSelGoods', 'all'); } catch(e) {}
  document.addEventListener('mousedown', function(e) {
    var item = e.target.closest && e.target.closest('.search-select-item');
    if (!item || !frame.contains(item)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var radio = item.querySelector('input[name=search_goods]');
    if (!radio) return;
    frame.querySelectorAll('input[name=search_goods]').forEach(function(r) { r.checked = false; });
    radio.checked = true;
    try { sessionStorage.setItem('_imSelGoods', radio.value); } catch(ex) {}
    setTimeout(function() { inp.focus(); }, 0);
  }, true);
  document.addEventListener('click', function(e) {
    var item = e.target.closest && e.target.closest('.search-select-item');
    if (!item || !frame.contains(item)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  /* 게임 결과 목록도 mousedown에서 포커스 이탈 방지 (게임 선택은 mousedown에서 처리) */
  function showFrame() { frame.classList.remove('g_hidden'); inp.classList.add('focus_on'); }
  function hideFrame() { frame.classList.add('g_hidden'); inp.classList.remove('focus_on'); }
  function showInitial() {
    if (initScr) initScr.style.display = '';
    if (gsList) { gsList.classList.add('g_hidden'); gsList.classList.add('sf-hidden'); gsList.innerHTML = ''; }
  }
  function highlightName(name, q) {
    if (!q) return name.replace(/[&<>"]/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
    var CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    function getCho(c) { var code = c.charCodeAt(0); return (code >= 0xAC00 && code <= 0xD7A3) ? CHOSUNG[Math.floor((code-0xAC00)/(21*28))] : c; }
    function isChoOnly(s) { return s.length > 0 && Array.from(s).every(function(c) { return c >= 'ㄱ' && c <= 'ㅎ'; }); }
    function esc(s) { return s.replace(/[&<>"]/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    if (isChoOnly(q)) {
      var result = '';
      var chars = Array.from(name);
      var qi = 0, qArr = Array.from(q);
      for (var i = 0; i < chars.length; i++) {
        if (qi < qArr.length && getCho(chars[i]) === qArr[qi]) {
          result += '<span style="color:var(--color-blue7);font-weight:700">' + esc(chars[i]) + '</span>';
          qi++;
        } else {
          result += esc(chars[i]);
        }
      }
      return result;
    }
    var lq = q.toLowerCase(), ln = name.toLowerCase(), idx = ln.indexOf(lq);
    if (idx < 0) return name.replace(/[&<>"]/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
    return esc(name.slice(0, idx)) + '<span style="color:var(--color-blue7);font-weight:700">' + esc(name.slice(idx, idx + q.length)) + '</span>' + esc(name.slice(idx + q.length));
  }
  function renderResults(games, q) {
    var gl = frame.querySelector('.gs_list');
    if (!gl) return;
    if (!games || !games.length) {
      gl.innerHTML = '<ul style="padding:10px 5px"><li style="color:var(--color-gray6);font-size:14px">검색 결과가 없습니다.</li></ul>';
      gl.classList.remove('g_hidden'); gl.classList.remove('sf-hidden');
      if (initScr) initScr.style.display = 'none';
      return;
    }
    var html = '<ul style="padding:5px 0;list-style:none;margin:0">';
    games.forEach(function(g) {
      html += '<li data-code="' + (g.code||'') + '" data-id="' + (g.id||'') + '" data-name="' + (g.name||'').replace(/"/g,'&quot;') + '" style="padding:7px 10px;cursor:pointer;border-radius:7px;font-size:15px">' + highlightName(g.name, q) + '</li>';
    });
    html += '</ul>';
    gl.innerHTML = html;
    gl.classList.remove('g_hidden'); gl.classList.remove('sf-hidden');
    if (initScr) initScr.style.display = 'none';
  }
  function doSearch(q) {
    fetch('/api/games/search?q=' + encodeURIComponent(q), { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(function(data) { renderResults(Array.isArray(data) ? data : (data && data.items ? data.items : []), q); })
      .catch(function() { renderResults([], q); });
  }
  inp.addEventListener('focus', showFrame, true);
  inp.addEventListener('input', function() {
    showFrame();
    var q = inp.value.trim();
    if (!q) { showInitial(); return; }
    clearTimeout(_acTimer);
    _acTimer = setTimeout(function() { doSearch(q); }, 120);
  }, true);
  /* 게임 결과 목록: document 레벨 capture + 동적 .gs_list 조회(stale ref 방지) */
  document.addEventListener('mousedown', function(e) {
    var li = e.target.closest && e.target.closest('li[data-id]');
    if (!li) return;
    var currentGsList = frame.querySelector('.gs_list');
    if (!currentGsList || !currentGsList.contains(li)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var code = li.getAttribute('data-code');
    var id = li.getAttribute('data-id');
    var name = li.getAttribute('data-name');
    inp.value = name || '';
    window._IM_sel_game = { code: code, id: id, name: name };
    hideFrame();
    var goodsVal = (function() { try { return sessionStorage.getItem('_imSelGoods') || 'all'; } catch(e2) { return 'all'; } })();
    if (goodsVal && goodsVal !== 'all') {
      try { sessionStorage.setItem('_imPendingCategory', goodsVal); } catch(e3) {}
    } else {
      try { sessionStorage.removeItem('_imPendingCategory'); } catch(e4) {}
    }
    var url = '/sell/list.html?search_game=' + encodeURIComponent(code || id);
    location.href = url;
  }, true);
  inp.addEventListener('blur', function() {
    setTimeout(function() {
      if (!form.contains(document.activeElement)) { hideFrame(); }
    }, 150);
  }, false);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { hideFrame(); inp.blur(); }
  }, false);
}
_imSetupSearchFrame();
/* ── 전역 헤더 로그인/로그아웃 업데이트 (모든 페이지 공통) ── */
var _imHeaderObserver=null;
function _imApplyHeader(data){
  var loginsDiv=document.querySelector('.header-logins');
  if(!loginsDiv) return;
  if(data&&data.id){
    loginsDiv.innerHTML=
      '<span style="font-size:14px;font-weight:600;color:#2e2e2e">'+(data.nickname||data.email)+'님</span>'+
      '<div class="divider"></div>'+
      '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
    var btn=document.getElementById('_im_logout_btn');
    if(btn) btn.addEventListener('click',function(e){
      e.stopImmediatePropagation();
      fetch('/api/auth/logout',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}})
        .catch(function(){}).then(function(){ location.href='/'; });
    },true);
  } else {
    loginsDiv.innerHTML=
      '<a href="/login" style="font-size:14px;font-weight:600;color:#2e2e2e;text-decoration:none">로그인</a>'+
      '<div class="divider"></div>'+
      '<a href="/join" style="font-size:14px;font-weight:600;color:#2e2e2e;text-decoration:none">회원가입</a>';
  }
  /* 원본 itemmania JS가 .header-logins를 덮어쓸 경우 즉시 재적용 (MutationObserver) */
  if(_imHeaderObserver) _imHeaderObserver.disconnect();
  _imHeaderObserver=new MutationObserver(function(){
    _imHeaderObserver.disconnect();
    _imApplyHeader(data);
    setTimeout(function(){
      var t=document.querySelector('.header-logins');
      if(t) _imHeaderObserver.observe(t,{childList:true,subtree:true,characterData:true});
    },50);
  });
  var t=document.querySelector('.header-logins');
  if(t) _imHeaderObserver.observe(t,{childList:true,subtree:true,characterData:true});
}
function _imUpdateHeaderAuth(freshData){
  var loginsDiv=document.querySelector('.header-logins');
  if(!loginsDiv){ setTimeout(function(){_imUpdateHeaderAuth(freshData);},200); return; }
  var doUpdate=function(data){
    _imApplyHeader(data);
    /* 원본 JS가 늦게 실행돼도 최종 상태 보장 */
    setTimeout(function(){_imApplyHeader(data);},400);
    setTimeout(function(){_imApplyHeader(data);},1000);
  };
  if(freshData!==undefined){
    doUpdate(freshData);
  } else {
    window._IM_auth().then(doUpdate);
  }
}
/* bfcache 복원 시 서버에서 실제 세션 재검증 — no-store 헤더의 보조 방어선 */
window.addEventListener('pageshow',function(e){
  if(!e.persisted) return;
  fetch('/api/auth/me',{credentials:'include'})
    .then(function(r){ return r.ok?r.json():null; })
    .catch(function(){ return null; })
    .then(function(data){
      window._IM_USER = data;
      _imUpdateHeaderAuth(data);
    });
});
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){_imUpdateHeaderAuth();});
}else{
  _imUpdateHeaderAuth();
}
/* ── 채팅 아이콘 (#chat_notice / .header-message) — 모든 페이지 공통 ── */
document.addEventListener('click',function(e){
  var el=e.target;
  while(el&&el!==document.body){
    if(el.id==='chat_notice'||(el.classList&&el.classList.contains('header-message'))){
      e.preventDefault();e.stopImmediatePropagation();
      var nOpen=window._nativeOpen||window.open.bind(window);
      var w=nOpen('/myroom/chat/list.html','im_chat_list','width=900,height=700,resizable=yes,scrollbars=yes');
      if(!w||w.closed){location.href='/myroom/chat/list.html';}
      return;
    }
    el=el.parentElement;
  }
},true);
})();
</script>`;

function buildUserScript(user: Record<string, unknown> | null): string {
  return `<script>window._IM_USER=${user ? JSON.stringify(user) : 'null'};window._IM_auth=function(){return Promise.resolve(window._IM_USER||null);};</script>`;
}

async function getSessionUser(req: Request): Promise<Record<string, unknown> | null> {
  const userId = (req.session as { userId?: number })?.userId;
  if (!userId) return null;
  try {
    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      nickname: usersTable.nickname,
      phone: usersTable.phone,
      role: usersTable.role,
      grade: usersTable.grade,
      creditScore: usersTable.creditScore,
      authStates: usersTable.authStates,
    }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      phone: user.phone,
      role: user.role,
      grade: user.grade ?? null,
      creditScore: user.creditScore ?? 0,
      authStates: user.authStates ?? { excellent: false, phone: false, email: false, ipin: false, withdraw: false },
    };
  } catch {
    return null;
  }
}

const BALANCE_SSE_SCRIPT = `<script>
(function(){
  // 잔액 표시 요소를 모두 업데이트하는 공유 함수
  window._IM_updateBalance = function(balance) {
    var b = Number(balance || 0);
    var formatted = b.toLocaleString('ko-KR');
    var formattedWon = formatted + '원';
    var avail = document.querySelector('.over_mile');
    var total = document.querySelector('.total_mile');
    if (avail) avail.textContent = formatted;
    if (total) total.textContent = formatted;
    if (!avail || !total) {
      var mileageTxt = document.querySelector('.mr_user_mileage_txt');
      if (mileageTxt) {
        mileageTxt.innerHTML =
          '<div class="mileage_area">'
          + '<div class="mileage_area_content available_mileage">사용가능 마일리지</div>'
          + '<div class="mileage_result"><span class="over_mile">' + formatted + '</span> 원</div>'
          + '</div>'
          + '<div class="mileage_area">'
          + '<div class="mileage_area_content all_mileage">총 마일리지</div>'
          + '<div class="mileage_result"><span class="total_mile">' + formatted + '</span> 원</div>'
          + '</div>'
          + '<div class="mileage_area mileage_btn_area">'
          + '<button type="button" class="mileage_btn mileage_charge_btn">충전하기</button>'
          + '<a href="/myroom/mileage/payment/index.html" class="mileage_btn mileage_withdraw_btn">출금하기</a>'
          + '</div>';
      }
    }
    document.querySelectorAll('#txtCurrentMileage,[id="txtCurrentMileage"]')
      .forEach(function(el){ el.textContent = formattedWon; });
  };

  if(typeof EventSource==='undefined')return;
  var es=new EventSource('/api/events');
  var connected=false;
  es.addEventListener('connected',function(){connected=true;});
  es.addEventListener('error',function(){if(!connected)es.close();});
  es.addEventListener('balance',function(e){
    try{ var d=JSON.parse(e.data); window._IM_updateBalance(d.balance); }catch(ex){}
  });
  es.addEventListener('nickname',function(e){
    try{ var d=JSON.parse(e.data); if(d.nickname) window.dispatchEvent(new CustomEvent('im:nickname',{detail:{nickname:d.nickname}})); }catch(ex){}
  });
  es.addEventListener('grade',function(e){
    try{ var d=JSON.parse(e.data); window.dispatchEvent(new CustomEvent('im:grade',{detail:{grade:d.grade||null}})); }catch(ex){}
  });
  es.addEventListener('credit_score',function(e){
    try{ var d=JSON.parse(e.data); window.dispatchEvent(new CustomEvent('im:credit_score',{detail:{score:d.score??0}})); }catch(ex){}
  });
  es.addEventListener('notification',function(e){
    try{ var d=JSON.parse(e.data); window._IM_NOTI.showToast(d); window._IM_NOTI.addUnread(); }catch(ex){}
  });
})();

/* ── 알림 토스트 시스템 (원본 chat_notice_layer + slide_up 애니메이션 활용) ── */
(function(){
  /* chat_notice_layer CSS 없는 페이지를 위한 폴백 스타일 보장 */
  function ensureLayerStyle(){
    if(document.getElementById('_im_noti_style')) return;
    var s=document.createElement('style');
    s.id='_im_noti_style';
    s.textContent=
      '@keyframes _im_slide_up{'
      +'0%{transform:translateY(40px);opacity:0}'
      +'12%,85%{transform:translateY(0);opacity:1}'
      +'100%{transform:translateY(-20px);opacity:0;visibility:hidden}'
      +'}'
      +'#chat_notice_layer{'
      +'position:fixed!important;z-index:9999!important;'
      +'top:20px!important;right:20px!important;bottom:auto!important;'
      +'display:flex!important;flex-direction:column!important;gap:10px!important;'
      +'pointer-events:none'
      +'}';
    document.head.appendChild(s);
  }

  function getLayer(){
    var layer=document.getElementById('chat_notice_layer');
    if(!layer){
      layer=document.createElement('div');
      layer.id='chat_notice_layer';
      document.body.appendChild(layer);
    }
    return layer;
  }

  window._IM_NOTI={
    _unread: 0,

    showToast: function(n){
      ensureLayerStyle();
      var layer=getLayer();
      var toast=document.createElement('div');
      toast.style.cssText=
        'background:#fff;border-radius:10px;'
        +'box-shadow:0 4px 20px rgba(0,0,0,0.18);'
        +'padding:13px 18px;min-width:240px;max-width:300px;'
        +'border-left:3px solid #159EFD;'
        +'pointer-events:auto;cursor:'+(n.link?'pointer':'default')+';'
        +'animation:_im_slide_up 4s ease forwards;'
        +'font-family:Pretendard,-apple-system,sans-serif';

      var title=document.createElement('div');
      title.style.cssText='font-size:13px;font-weight:700;color:#222;margin-bottom:3px';
      title.textContent=n.title||'알림';
      toast.appendChild(title);

      if(n.body){
        var body=document.createElement('div');
        body.style.cssText='font-size:12px;color:#666;line-height:1.4';
        body.textContent=n.body;
        toast.appendChild(body);
      }

      if(n.link){
        toast.onclick=function(){ location.href=n.link; };
      }

      layer.appendChild(toast);
      setTimeout(function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); },4100);
    },

    addUnread: function(){
      this._unread++;
      this._updateChatBadge();
    },

    _updateChatBadge: function(){
      var chatEl=document.getElementById('chat_notice');
      if(!chatEl) return;
      var badge=chatEl.querySelector('.header-new');
      if(!badge) return;
      if(this._unread>0){
        badge.textContent='N';
        badge.classList.remove('sf-hidden');
        badge.style.display='';
      } else {
        badge.classList.add('sf-hidden');
        badge.style.display='none';
      }
    },

    loadInitial: function(){
      var self=this;
      fetch('/api/notifications',{credentials:'include'})
        .then(function(r){ return r.ok?r.json():null; })
        .then(function(d){
          if(!d) return;
          self._unread=d.unreadCount||0;
          self._updateChatBadge();
        }).catch(function(){});
    }
  };

  function init(){
    ensureLayerStyle();
    window._IM_NOTI.loadInitial();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }
})();
</script>`;

/* ── 마이룸 사이드바/탭 링크 서버사이드 로컬 경로 치환 ───────────────────
 *  href="https://www.itemmania.com/myroom/sell/sell_pay_wait.html?..."
 *  → href="/myroom/sell/sell_pay_wait.html"
 *  JS 클릭 인터셉터 의존 없이 브라우저 기본 링크 이동으로 처리.
 * ────────────────────────────────────────────────────────────────────── */
const MYROOM_NAV_REWRITE: Array<[RegExp, string]> = [
  [/https?:\/\/(?:www\.)?itemmania\.com\/myroom\/sell\/sell_pay_wait\.html[^"'\s]*/g, "/myroom/sell/sell_pay_wait.html"],
  [/https?:\/\/(?:www\.)?itemmania\.com\/myroom\/sell\/sell_ing\.html[^"'\s]*/g,      "/myroom/sell/sell_ing.html"],
  [/https?:\/\/(?:www\.)?itemmania\.com\/myroom\/sell\/sell_check\.html[^"'\s]*/g,    "/myroom/sell/sell_check.html"],
  [/https?:\/\/(?:www\.)?itemmania\.com\/myroom\/sell\/sell_regist\.html[^"'\s]*/g,   "/myroom/sell/sell_regist.html"],
  [/https?:\/\/(?:www\.)?itemmania\.com\/myroom\/buy\/buy_pay_wait\.html[^"'\s]*/g,   "/myroom/buy/buy_pay_wait.html"],
  [/https?:\/\/(?:www\.)?itemmania\.com\/myroom\/buy\/buy_ing\.html[^"'\s]*/g,        "/myroom/buy/buy_ing.html"],
  [/https?:\/\/(?:www\.)?itemmania\.com\/myroom\/buy\/buy_check\.html[^"'\s]*/g,      "/myroom/buy/buy_check.html"],
  [/https?:\/\/(?:www\.)?itemmania\.com\/myroom\/buy\/buy_regist\.html[^"'\s]*/g,     "/myroom/buy/buy_regist.html"],
];
function fixMyroomNavLinks(html: string): string {
  let result = html;
  for (const [pattern, replacement] of MYROOM_NAV_REWRITE) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// The home snapshot wires its own service menu. Other captured pages contain
// the same header/button but no working toggle, so install it on those pages.
const SHARED_HEADER_MENU = `
<style>
.header-menu{position:relative;z-index:401}
.header-panel{position:absolute;z-index:400;top:80px;left:0;width:100%}
.header-panel.is-open{display:block}
.header-panel .header-panel-backdrop{position:fixed;background:transparent;inset:0}
.header-panel .header-panel-inner{position:relative;z-index:2}
.header-panel .header-panel-card{width:584px;margin-left:auto;padding:18px 20px 24px;border-radius:15px;background:#fff;box-shadow:0 1px 10px rgba(0,0,0,.25)}
.header-panel .header-panel-title{font-weight:600;padding:4px 5px 14px;color:#000}
.header-panel .header-panel-title h2{font-size:18px}
.header-panel .header-panel-divider{height:1px;margin:0 5px 20px;background:#d9d9d9}
.header-panel .header-service-grid{display:grid;margin:0;padding:0 14px 35px;list-style:none;grid-template-columns:repeat(5,83px);gap:25px 25px}
.header-panel .header-service-item{text-align:center}
.header-panel .header-service-item a{display:block;text-decoration:none;color:#2e2e2e}
.header-panel .header-service-icon{display:flex;align-items:center;justify-content:center;width:63px;height:63px;margin:0 auto;border-radius:20px;background:#e8f2ff}
.header-panel .header-service-icon img{display:block;width:50px;height:50px}
.header-panel .header-service-label{font-size:16px;font-weight:500;display:block;margin-top:8px;text-align:center}
.header-panel .header-box{overflow:hidden;margin:0 20px 20px;border:1px solid var(--color-gray3);border-radius:15px;background:#fff}
.header-panel .header-box-title{font-size:16px;font-weight:600;display:flex;align-items:center;height:40px;padding:0 20px;color:#2e2e2e;background:#e8f2ff}
.header-panel .header-box-grid{font-size:16px;font-weight:500;display:grid;margin:0;padding:20px 25px 24px;list-style:none;color:#2e2e2e;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px 5px}
.header-panel .header-box-grid li:last-child{width:100px}
.header-panel .header-box-grid a{color:inherit;text-decoration:none}
.header-panel .header-box-grid a:hover{color:#159EFD}
</style>
<script>
(function(){
  var previousOverflow = '';
  function elements() {
    return { panel: document.getElementById('headerMainPanel'), menu: document.querySelector('.header-menu') };
  }
  function closePanel() {
    var refs = elements();
    if (!refs.panel) return;
    refs.panel.classList.remove('is-open');
    refs.panel.style.display = 'none';
    refs.panel.setAttribute('aria-hidden', 'true');
    if (refs.menu) refs.menu.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = previousOverflow;
  }
  function initPanel() {
    var refs = elements();
    if (!refs.panel || !refs.menu || refs.panel.dataset.imMenuReady) return refs;
    refs.panel.dataset.imMenuReady = '1';
    refs.panel.classList.remove('sf-hidden');
    refs.panel.classList.remove('is-open');
    refs.panel.style.display = 'none';
    refs.panel.setAttribute('aria-hidden', 'true');
    refs.menu.setAttribute('aria-expanded', 'false');
    if (!refs.panel.querySelector('.header-panel-inner')) {
      fetch('/api/panel-inner').then(function(response) {
        if (!response.ok) throw new Error('menu');
        return response.text();
      }).then(function(html) {
        refs.panel.innerHTML = html;
      }).catch(function() {
        refs.panel.innerHTML = '<div class="header-panel-inner"><div class="header-panel-card">메뉴를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</div></div>';
      });
    }
    return refs;
  }
  document.addEventListener('click', function(event) {
    var trigger = event.target.closest('.header-menu');
    if (trigger) {
      var refs = initPanel();
      if (!refs.panel) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (refs.panel.classList.contains('is-open')) {
        closePanel();
      } else {
        previousOverflow = document.body.style.overflow;
        refs.panel.style.display = '';
        refs.panel.classList.add('is-open');
        refs.panel.setAttribute('aria-hidden', 'false');
        refs.menu.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
      }
      return;
    }
    var panel = document.getElementById('headerMainPanel');
    if (!panel || !panel.classList.contains('is-open')) return;
    if (event.target.closest('.header-panel-backdrop, [data-header-panel-close]')) {
      event.preventDefault();
      closePanel();
    } else if (panel.contains(event.target) && event.target.closest('a[href]')) {
      closePanel();
    }
  }, true);
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') closePanel();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPanel);
  else initPanel();
})();
</script>`;

const CURRENT_GRADE_MARK_STYLE = `<style>${["vip", "platinum", "gold", "silver", "bronze"]
  .map(grade => `.credit_mark.${grade}{background-image:url("/grade-icon/${grade}")!important;background-repeat:no-repeat!important;background-size:100% auto!important}`)
  .join("")}</style>`;

function prepare(html: string, user: Record<string, unknown> | null = null, includeHeaderMenu = true): string {
  const clean = applyViewerTradeInfo(fixMyroomNavLinks(rewriteExternalLinks(stripCsp(html))), user);
  const headInject = buildUserScript(user) + (clean.includes('data-im-viewer-name') ? VIEWER_TRADE_INFO_SCRIPT : "") + ERROR_SUPPRESSOR + GLOBAL_MOBILE_STYLE + CURRENT_GRADE_MARK_STYLE + GLOBAL_NAV_INTERCEPTOR + (includeHeaderMenu ? SHARED_HEADER_MENU : "");
  // <head> 또는 문서 맨 앞에 에러 억제 + 전역 인터셉터 주입
  let result: string;
  if (clean.includes("<head>")) {
    result = clean.replace("<head>", "<head>" + headInject);
  } else if (clean.includes("<head ")) {
    result = clean.replace(/<head [^>]*>/, (m) => m + headInject);
  } else {
    result = headInject + clean;
  }
  // SSE 마일리지 실시간 업데이트 스크립트 (로그인 유저 전용, </body> 직전)
  if (user) {
    if (result.includes("</body>")) {
      return result.replace("</body>", BALANCE_SSE_SCRIPT + MYROOM_STATS_SCRIPT + "</body>");
    }
    return result + BALANCE_SSE_SCRIPT + MYROOM_STATS_SCRIPT;
  }
  return result;
}

// The mobile home is appended after the large desktop snapshot. Hide the desktop
// shell before the browser starts painting it, rather than waiting for the
// overlay's CSS near the end of the document to be parsed.
const MOBILE_HOME_FIRST_PAINT_STYLE = `<style>
@media (max-width:780px) {
  html,body{min-width:0!important;width:100%!important;max-width:100vw!important;overflow-x:hidden!important;background:#fff!important}
  body .g_body{display:none!important}
}
</style>`;

function serveItemmania(html: string, user: Record<string, unknown> | null = null, mobile = false): string {
  let result = prepare(html, user, false);
  if (mobile) {
    result = result.includes("</head>")
      ? result.replace("</head>", MOBILE_HOME_FIRST_PAINT_STYLE + "</head>")
      : MOBILE_HOME_FIRST_PAINT_STYLE + result;
  }

  // ── 메인 배너 스냅샷 상태 리셋 ──────────────────────────────────────────
  // SingleFile 스냅샷이 Swiper 초기화 완료 상태를 굳혀 저장하기 때문에,
  // 페이지를 다시 열 때 스냅샷 시점의 잘못된 값들이 그대로 남음.
  //
  // swiper-wrapper transform 초기화: 스냅샷 시점 슬라이드 위치 → 0번으로 리셋
  result = result.replace(
    "transform:translate3d(0px,-450px,0px);transition-delay:0ms",
    "transform:translate3d(0px,0px,0px);transition-delay:0ms"
  );
  // swiper-container/wrapper/slide의 height:100% 오버라이드는 INTERCEPT_SCRIPT
  // CSS (!important)로 처리 → Swiper.js가 JS로 set하는 inline style도 무력화

  if (result.includes("</body>")) {
    return result.replace("</body>", HOMEPAGE_INTERCEPT_SCRIPT + (mobile ? optimizedMobileHomeHtml : "") + "</body>");
  }
  return result + HOMEPAGE_INTERCEPT_SCRIPT + (mobile ? optimizedMobileHomeHtml : "");
}

function serveLogin(html: string, user: Record<string, unknown> | null = null, brandName: string = ""): string {
  const result = memberLoginEntry(prepare(html, user), brandName);
  if (result.includes("</body>")) {
    return result.replace("</body>", LOGIN_INTERCEPT_SCRIPT + "</body>");
  }
  return result + LOGIN_INTERCEPT_SCRIPT;
}

const mobileLoginFontStyles = ((loginHtml as string).match(/@font-face\s*\{[^}]+\}/g) ?? [] as string[])
  .filter(face => face.includes('font-family:"Pretendard"'))
  .join("");

function serveGiftcard(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", GIFTCARD_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GIFTCARD_INTERCEPT_SCRIPT;
}

function serveGamemania(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", GAMEMANIA_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GAMEMANIA_INTERCEPT_SCRIPT;
}

function serveGameCharge(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  if (result.includes("</body>")) {
    return result.replace("</body>", GAMECHARGE_INTERCEPT_SCRIPT + "</body>");
  }
  return result + GAMECHARGE_INTERCEPT_SCRIPT;
}

const SELL_INTERCEPT_SCRIPT = `
<script>
(function() {
  function isLoggedIn() {
    return !!(window._IM_USER && window._IM_USER.id);
  }

  function showLoginModal() {
    try { sessionStorage.setItem('_im_login_next', location.href); } catch(ex) {}
    location.href = '/login';
  }

  function interceptBuyButtons() {
    document.querySelectorAll('a.buy-btn, a[href*="buy"], a[href*="order"], button.buy-btn, .btn_buy, .sell-buy-btn, a.btn_trade, .item-buy-btn, [class*="buy"], [class*="order_btn"]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (!isLoggedIn()) { e.preventDefault(); e.stopPropagation(); showLoginModal(); }
      }, true);
    });
  }

  function _sellListSetup() {
    // 팝니다 탭 active 표시 (sell 페이지는 팝니다가 선택됨)
    document.querySelectorAll('button[data-type="sell"]').forEach(function(btn) {
      btn.classList.add('selected'); btn.textContent = '팝니다';
    });
    document.querySelectorAll('button[data-type="buy"]').forEach(function(btn) {
      btn.classList.remove('selected'); btn.textContent = '삽니다';
    });

    // 삽니다 탭 → 삽니다 목록으로 이동 (search_game 유지)
    document.querySelectorAll('button[data-type="buy"]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var params = new URLSearchParams(location.search);
        var game = params.get('search_game') || '5913';
        location.href = '/buy/list.html?search_game=' + game;
      }, true);
    });

    // 로그인·회원가입 버튼
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation(); try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login';
      });
    }
    var joinBtn = document.querySelector('.header-logins a');
    if (joinBtn) { joinBtn.href = '/login'; }

    // 구매 버튼 인터셉트
    interceptBuyButtons();

    // 동적 콘텐츠를 위한 MutationObserver
    var mo = new MutationObserver(function() { interceptBuyButtons(); });
    mo.observe(document.body, { childList: true, subtree: true });

    // 상품 리스트 아이템 클릭 → 상세 페이지 이동
    document.body.addEventListener('click', function(e) {
      var li = e.target.closest && e.target.closest('li.list_item[data-tid]');
      if (li) {
        var tid = li.getAttribute('data-tid');
        if (tid) {
          e.preventDefault(); e.stopPropagation();
          try {
            var titleEl = li.querySelector('.kind_title');
            var priceEl = li.querySelector('.trade_money');
            var serverEls = li.querySelectorAll('.server li a');
            var servers = Array.prototype.map.call(serverEls, function(a) { return a.textContent.trim(); });
            var priceNode = priceEl ? priceEl.firstChild : null;
            var priceNum = priceNode ? parseInt((priceNode.textContent || '').replace(/[^0-9]/g, ''), 10) || 0 : 0;
            var card = {
              id: tid,
              title: titleEl ? titleEl.textContent.trim() : '',
              price: priceNum,
              priceRaw: priceEl ? priceEl.textContent.trim() : '',
              gameName: servers[0] || '',
              serverName: servers[1] || '',
              itemCategory: servers[2] || '',
              sellerName: '', description: '',
              _source: 'itemmania'
            };
            sessionStorage.setItem('_im_card_' + tid, JSON.stringify(card));
          } catch(ex) {}
          location.href = '/sell/application.html?id=' + tid;
        }
      }
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _sellListSetup);
  else _sellListSetup();
})();

// ── search_game으로 서버 탭 동적 교체 (기본 HTML은 리니지클래식) ───────
(function() {
  var _gc = new URLSearchParams(location.search).get('search_game') || '5913';
  if (_gc === '5913') return;
  fetch('/api/games/bycode/' + encodeURIComponent(_gc), { credentials: 'include' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(g) {
      if (!g || !g.name) return;
      var gn = g.name;
      function replaceText(node) {
        if (node.nodeType === 3) {
          if (node.nodeValue.indexOf('리니지클래식') >= 0)
            node.nodeValue = node.nodeValue.replace(/리니지클래식/g, gn);
        } else if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
          for (var i = 0; i < node.childNodes.length; i++) replaceText(node.childNodes[i]);
        }
      }
      replaceText(document.body);
      document.title = document.title.replace(/리니지클래식/g, gn);
      if (!g.id) return;
      fetch('/api/games/' + g.id + '/servers', { credentials: 'include' })
        .then(function(rs) { return rs.ok ? rs.json() : []; })
        .then(function(servers) {
          if (!servers || !servers.length) return;
          var serverList = document.getElementById('search_server_list');
          if (!serverList) return;
          var currentSv = new URLSearchParams(location.search).get('search_server') || '';
          var ul = serverList.querySelector('ul');
          if (ul) {
            var firstLi = ul.querySelector('li:first-child');
            ul.innerHTML = '';
            if (firstLi) {
              var fi = firstLi.querySelector('input');
              if (fi) fi.checked = !currentSv;
              ul.appendChild(firstLi);
            }
            servers.forEach(function(sv) {
              var li = document.createElement('li');
              var uid = 'row_server_dyn_' + sv.id;
              li.innerHTML = '<input id="' + uid + '" type=checkbox name=row_server value="' + sv.name + '" class=g_btn_white2_radio' + (currentSv === sv.name ? ' checked' : '') + '><label for="' + uid + '">' + sv.name + '</label>';
              ul.appendChild(li);
            });
          } else {
            var allInps = Array.from(serverList.querySelectorAll('input[name=row_server]'));
            var firstInp = allInps[0] || null;
            var firstLbl = firstInp ? serverList.querySelector('label[for="' + firstInp.id + '"]') : null;
            serverList.innerHTML = '';
            if (firstInp) { firstInp.checked = !currentSv; serverList.appendChild(firstInp); }
            if (firstLbl) serverList.appendChild(firstLbl);
            servers.forEach(function(sv) {
              var uid = 'row_server_dyn_' + sv.id;
              var inp = document.createElement('input');
              inp.id = uid; inp.type = 'checkbox'; inp.name = 'row_server';
              inp.value = sv.name; inp.className = 'g_btn_white2_radio';
              if (currentSv === sv.name) inp.checked = true;
              var lbl = document.createElement('label');
              lbl.setAttribute('for', uid); lbl.textContent = sv.name;
              serverList.appendChild(inp);
              serverList.appendChild(lbl);
            });
          }
        })
        .catch(function() {});
    })
    .catch(function() {});
})();
</script>
`;

function serveLineageClassic(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  const combined = SELL_INTERCEPT_SCRIPT + SELL_LIST_INTERCEPT_SCRIPT;
  if (result.includes("</body>")) {
    return result.replace("</body>", combined + "</body>");
  }
  return result + combined;
}


const SELL_LIST_INTERCEPT_SCRIPT = `
<style>
/* Completed DB listings retain their original card data beneath a quiet, non-interactive veil. */
ul.search_list_normal > li.list_item.im-sold,
ul.search_list_premium > li.list_item.im-sold {
  position: relative !important;
  overflow: hidden;
  border-radius: 12px;
}
li.list_item.im-sold > .im-sold-veil {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background: rgba(238, 239, 241, .85);
  color: #24262b;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -.04em;
  cursor: not-allowed;
}
/* ── 팝니다/삽니다 목록 모바일 ── */
@media(max-width:768px){
  /* 서버 탭: 가로 스크롤 */
  #search_server_list,.search_server_row{
    display:flex!important;flex-wrap:nowrap!important;
    overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;
    gap:6px!important;padding-bottom:6px!important;
    scrollbar-width:none!important;
  }
  #search_server_list::-webkit-scrollbar,.search_server_row::-webkit-scrollbar{display:none!important;}
  #search_server_list label,.search_server_row label{white-space:nowrap!important;flex-shrink:0!important;}
  /* 카테고리 탭도 가로 스크롤 */
  .detail_search,.search_cate_wrap,.cate_tab_list{
    overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;
  }
  .detail_search .search_row{flex-wrap:nowrap!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;gap:6px!important;}
  .detail_search .search_row label{white-space:nowrap!important;flex-shrink:0!important;}
  /* 상품 목록 */
  .gs_list,.item_list{width:100%!important;min-width:0!important;}
  .gs_list li,.item_list li{width:100%!important;box-sizing:border-box!important;}
}
</style>
<script>
(function() {
  var _oXOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) {
    if (typeof u === 'string' && u.indexOf('itemmania.com') > -1) { this._imBlocked = true; }
    return _oXOpen.apply(this, arguments);
  };
  var _oXSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(b) {
    if (this._imBlocked) {
      var self = this;
      setTimeout(function() {
        try {
          Object.defineProperty(self, 'readyState', { get: function(){ return 4; }, configurable: true });
          Object.defineProperty(self, 'status', { get: function(){ return 200; }, configurable: true });
          Object.defineProperty(self, 'responseText', { get: function(){ return '{"result":"ok","list":[],"TradeCount":0}'; }, configurable: true });
          if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
          if (typeof self.onload === 'function') self.onload();
        } catch(e2) {}
      }, 0);
      return;
    }
    return _oXSend.apply(this, arguments);
  };
  var _oFetch = window.fetch;
  window.fetch = function(input, init) {
    var u2 = typeof input === 'string' ? input : (input && input.url) || '';
    if (u2.indexOf('itemmania.com') > -1) {
      return Promise.resolve(new Response('{"result":"ok","list":[],"TradeCount":0}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return _oFetch.apply(this, arguments);
  };
})();
(function() {
  /* ── sessionStorage 대기 카테고리 → URL 즉시 반영 ─────────────────────── */
  (function() {
    try {
      var pending = sessionStorage.getItem('_imPendingCategory');
      if (!pending || pending === 'all') return;
      var params = new URLSearchParams(location.search);
      if (params.get('itemCategory')) return; /* 이미 있으면 스킵 */
      var _CAT = {money:'게임머니', item:'아이템', character:'계정', etc:'기타'};
      var label = _CAT[pending];
      if (!label) return;
      sessionStorage.removeItem('_imPendingCategory');
      params.set('itemCategory', label);
      location.replace(location.pathname + '?' + params.toString());
    } catch(e) {}
  })();
  function fmt(n) { return Number(n||0).toLocaleString('ko-KR'); }
  var listingQuantityLabel = ${listingQuantityLabel.toString()};
  function timeLabel(d) {
    if (!d) return '';
    var dt = new Date(d), now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dt >= today) {
      var h = dt.getHours(), mn = dt.getMinutes();
      return (h < 10 ? '0'+h : h) + ':' + (mn < 10 ? '0'+mn : mn);
    }
    return (dt.getMonth()+1) + '/' + dt.getDate();
  }
  // 아이템매니아 시간 텍스트 → timestamp(ms) 파싱
  function parseTimeText(txt) {
    if (!txt) return 0;
    txt = txt.trim();
    var now = Date.now();
    var m;
    if ((m = txt.match(/^(\\d+)초\\s*전$/))) return now - parseInt(m[1]) * 1000;
    if ((m = txt.match(/^(\\d+)분\\s*전$/))) return now - parseInt(m[1]) * 60000;
    if ((m = txt.match(/^(\\d+)시간\\s*전$/))) return now - parseInt(m[1]) * 3600000;
    if ((m = txt.match(/^(\\d{1,2}):(\\d{2})$/))) {
      var d = new Date(); d.setHours(parseInt(m[1]), parseInt(m[2]), 0, 0);
      if (d.getTime() > now) d.setDate(d.getDate() - 1);
      return d.getTime();
    }
    if ((m = txt.match(/^(\\d{1,2})\\/(\\d{1,2})$/))) {
      var d2 = new Date(); d2.setMonth(parseInt(m[1])-1, parseInt(m[2])); d2.setHours(0,0,0,0);
      if (d2.getTime() > now) d2.setFullYear(d2.getFullYear() - 1);
      return d2.getTime();
    }
    return 0;
  }

  // 아이템매니아 DOM li 요소에서 timestamp 추출
  function getItemTs(el) {
    var ts = el.getAttribute('data-ts');
    if (ts) return parseInt(ts);
    var dateEl = el.querySelector('.col.reg_date, .reg_date');
    var t = parseTimeText(dateEl ? dateEl.textContent : '');
    el.setAttribute('data-ts', String(t));
    return t;
  }

  var verifiedSoldIds = {};
  function markSold(li) {
    li.classList.add('im-sold');
    li.setAttribute('aria-label', '거래 완료');
    li.querySelectorAll('a, button, input').forEach(function(control) {
      control.setAttribute('tabindex', '-1');
      control.setAttribute('aria-disabled', 'true');
    });
    var veil = document.createElement('div');
    veil.className = 'im-sold-veil';
    veil.textContent = '거래 완료';
    veil.setAttribute('aria-hidden', 'true');
    li.appendChild(veil);
    li.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
    }, true);
    return li;
  }

  function makeCard(p, type) {
    var li = document.createElement('li');
    li.className = 'list_item';
    li.setAttribute('data-tid', String(p.id));
    li.setAttribute('data-ts', String(p.createdAt ? new Date(p.createdAt).getTime() : 0));
    li.setAttribute('data-our', '1');
    var href = '/' + type + '/application.html?id=' + p.id;
    var GRADE_LETTERS = { vip:'V', platinum:'P', gold:'G', silver:'S', bronze:'B' };
    var gradeKey = p.sellerGrade && GRADE_LETTERS[p.sellerGrade] ? p.sellerGrade : null;
    var sellerId = p.sellerId ? String(p.sellerId) : '';
    var gradeHtml = gradeKey
      ? '<span class="credit_mark_new ' + gradeKey + '" data-seller-id="' + sellerId + '">' + GRADE_LETTERS[gradeKey] + '</span>'
      : '<span class="credit_mark_new regular" data-seller-id="' + sellerId + '"></span>';
    li.innerHTML =
      '<div class="col info">' + gradeHtml + '</div>' +
      '<div class="col subject_info">' +
        '<ul class=server>' +
          '<li><a href="javascript:void(0)" data-search=game>' + (p.gameName||'') + '</a></li>' +
          (p.serverName ? '<li><a href="javascript:void(0)" data-search=server data-title="'+p.serverName+'">' + p.serverName + '</a></li>' : '') +
          '<li><a href="javascript:void(0)" data-search=goods>' + (p.itemCategory||'게임머니') + '</a></li>' +
        '</ul>' +
        '<a href="' + href + '" class="subject active">' +
          '<div><span class="text_ellipsis kind_title">' + p.title + '</span></div>' +
        '</a>' +
      '</div>' +
      '<div class="col quickicon"></div>' +
      '<div class="col quantity">' + listingQuantityLabel(p) + '</div>' +
      '<div class="col price"><span class=trade_money>' + fmt(p.price) + '원</span></div>' +
      '<div class="col reg_date">' + timeLabel(p.createdAt) + '</div>';
    return p.status === 'sold' ? markSold(li) : li;
  }

  // 실시간 아이템마니아 상품 카드 (live-list API에서 받은 데이터)
  function makeLiveCard(p, type) {
    var li = document.createElement('li');
    li.className = 'list_item';
    var linkId = p.dbId ? String(p.dbId) : encodeURIComponent(p.tid);
    li.setAttribute('data-tid', linkId);
    li.setAttribute('data-ts', String(p.timestamp || 0));
    var href = '/' + type + '/application.html?id=' + linkId;
    var GRADE_LETTERS = { vip:'V', platinum:'P', gold:'G', silver:'S', bronze:'B' };
    var gradeKey = p.sellerGrade && GRADE_LETTERS[p.sellerGrade] ? p.sellerGrade : null;
    var gradeHtml = gradeKey
      ? '<span class="credit_mark_new ' + gradeKey + '">' + GRADE_LETTERS[gradeKey] + '</span>'
      : '<span class="credit_mark_new regular"></span>';
    li.innerHTML =
      '<div class="col info">' + gradeHtml + '</div>' +
      '<div class="col subject_info">' +
        '<ul class=server>' +
          '<li><a href="javascript:void(0)" data-search=game>' + (p.gameName||'') + '</a></li>' +
          (p.serverName ? '<li><a href="javascript:void(0)" data-search=server data-title="' + p.serverName + '">' + p.serverName + '</a></li>' : '') +
          '<li><a href="javascript:void(0)" data-search=goods>' + (p.itemCategory||'게임머니') + '</a></li>' +
        '</ul>' +
        '<a href="' + href + '" class="subject active">' +
          '<div><span class="text_ellipsis kind_title">' + (p.title||'') + '</span></div>' +
        '</a>' +
      '</div>' +
      '<div class="col quickicon"></div>' +
      '<div class="col quantity">' + listingQuantityLabel(p) + '</div>' +
      '<div class="col price"><span class=trade_money>' + fmt(p.price||0) + '원</span></div>' +
      '<div class="col reg_date">' + timeLabel(p.timestamp) + '</div>';
    // A snapshot/live-list entry alone does not prove a sale. Only a sold DB row can.
    return p.dbId && verifiedSoldIds[String(p.dbId)] ? markSold(li) : li;
  }

  // tab_bx data-value → DB itemCategory 값 매핑
  var ITEM_CAT_MAP = { all:'', money:'게임머니', item:'아이템', character:'계정', etc:'기타' };
  var SORT_MAP = { '1':'price_asc', '2':'recent', '3':'price_desc' };

  function getParams() {
    return new URLSearchParams(location.search);
  }

  function navigate(updates) {
    var q = new URLSearchParams(location.search);
    Object.keys(updates).forEach(function(k) {
      if (updates[k] === null || updates[k] === '') q.delete(k);
      else q.set(k, updates[k]);
    });
    q.delete('page'); // 필터 변경 시 1페이지로
    location.search = q.toString();
  }

  function initFilters() {
    var params = getParams();
    var currentItemCat = params.get('itemCategory') || '';
    var currentSort = params.get('sort') || 'recent';
    var currentServer = params.get('search_server') || '';
    var currentKeyword = params.get('keyword') || '';

    // ── 카테고리 탭: 버튼 유지, 클릭 이벤트만 intercept ─
    document.querySelectorAll('button.tab_bx[data-value]').forEach(function(btn) {
      var val = btn.getAttribute('data-value');
      var mapped = ITEM_CAT_MAP[val] !== undefined ? ITEM_CAT_MAP[val] : '';
      // active 상태 표시
      if (mapped === currentItemCat) btn.classList.add('selected');
      else btn.classList.remove('selected');
      var clone = btn.cloneNode(true);
      if (btn.parentNode) btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var q = new URLSearchParams(location.search);
        q.delete('page');
        if (mapped) q.set('itemCategory', mapped);
        else q.delete('itemCategory');
        location.href = location.pathname + '?' + q.toString();
      });
    });

    // ── 정렬 버튼 (data-type=1/2/3만) — button 태그 유지, 클릭만 intercept ──
    document.querySelectorAll('button[data-type]').forEach(function(btn) {
      var t = btn.getAttribute('data-type');
      if (!SORT_MAP[t]) return;
      var sortVal = SORT_MAP[t];
      if (sortVal === currentSort || (sortVal === 'recent' && !params.get('sort'))) {
        btn.classList.add('active');
        btn.style.fontWeight = '800';
        btn.style.color = '#159EFD';
      } else {
        btn.style.fontWeight = '';
        btn.style.color = '';
      }
      var clone = btn.cloneNode(true);
      if (btn.parentNode) btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var q2 = new URLSearchParams(location.search);
        q2.delete('page');
        if (sortVal === 'recent') q2.delete('sort'); else q2.set('sort', sortVal);
        location.href = location.pathname + '?' + q2.toString();
      });
    });

    // ── 필터 전체보기 토글 ────────────────────────────────
    document.querySelectorAll('button.toggles').forEach(function(toggleBtn) {
      /* 버튼을 클론해 원본 핸들러 제거 후 우리 핸들러만 붙임 */
      var clone = toggleBtn.cloneNode(true);
      if (toggleBtn.parentNode) toggleBtn.parentNode.replaceChild(clone, toggleBtn);
      clone.addEventListener('click', function(e) {
        e.stopPropagation();
        var box = document.querySelector('.detail_search .search_box');
        if (!box) return;
        var isOpen = box.classList.contains('_im_open');
        if (isOpen) {
          box.style.maxHeight = '0';
          box.classList.remove('_im_open');
          clone.textContent = '필터 전체보기';
        } else {
          box.style.transition = 'max-height .3s ease-in-out';
          box.style.maxHeight = box.scrollHeight + 'px';
          box.classList.add('_im_open');
          clone.textContent = '필터 접기 ▲';
        }
      });
    });

    // ── 상품 검색 인풋 ───────────────────────────────────
    var searchInput = document.querySelector('input#word, input[name=word], input.g_text[placeholder=상품검색]');
    var searchBtn = document.querySelector('button.btn_search, .search_word button');
    if (searchInput) {
      if (currentKeyword) searchInput.value = currentKeyword;
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') navigate({ keyword: searchInput.value.trim() || null });
      });
    }
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', function() {
        navigate({ keyword: searchInput.value.trim() || null });
      });
    }

    // ── 서버 탭: 이벤트 위임으로 checkbox/radio 모두 처리 ─────────
    (function() {
      var srvBox = document.getElementById('search_server_list') || document.querySelector('.search_server_row');
      if (srvBox) {
        // 초기 checked 상태 (스냅샷 value=숫자ID 또는 이름 모두 대응)
        srvBox.querySelectorAll('input[name=row_server]').forEach(function(inp) {
          var lbl = document.querySelector('label[for="' + inp.id + '"]');
          var sv = (inp.value && !/^\d+$/.test(inp.value)) ? inp.value : (lbl ? lbl.textContent.trim() : '');
          inp.checked = currentServer ? (sv === currentServer) : !inp.value;
        });
        // 이벤트 위임 — 동적 교체 후 새로 삽입된 요소에도 적용
        srvBox.addEventListener('change', function(e) {
          var inp = e.target;
          if (!inp || inp.name !== 'row_server') return;
          srvBox.querySelectorAll('input[name=row_server]').forEach(function(o) { if (o !== inp) o.checked = false; });
          var sv = inp.value || '';
          if (/^\d+$/.test(sv)) {
            var lbl2 = document.querySelector('label[for="' + inp.id + '"]');
            sv = lbl2 ? lbl2.textContent.trim() : sv;
          }
          navigate({ search_server: sv || null });
        });
      }
      document.querySelectorAll('.search_row button[data-server], .server_filter_btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var sv = btn.getAttribute('data-server') || btn.textContent.trim();
          navigate({ search_server: sv === '서버전체' ? null : sv });
        });
      });
    })();

    // ── 초기화 버튼 ──────────────────────────────────────
    document.querySelectorAll('button.reset_btn, a.reset_btn, .filter_reset, button.search_reset').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var q = new URLSearchParams();
        var game = getParams().get('search_game');
        if (game) q.set('search_game', game);
        location.search = q.toString();
      });
    });
  }

  // 우리 DB 상품 카드 (배지 없음 — 원본 카드와 동일 구조)
  function makeCardWithBadge(p, type) {
    return makeCard(p, type);
  }

  function loadList() {
    var params = getParams();
    var gameCode = params.get('search_game') || '';
    var serverName = params.get('search_server') || '';
    var keyword = params.get('keyword') || '';
    var page = parseInt(params.get('page') || '1', 10);
    var sort = params.get('sort') || '';
    var type = location.pathname.indexOf('/buy/') >= 0 ? 'buy' : 'sell';

    var itemCat = params.get('itemCategory') || '';
    var apiQ = [];
    apiQ.push('category=' + type);
    if (gameCode) apiQ.push('gameCode=' + encodeURIComponent(gameCode));
    if (serverName) apiQ.push('serverName=' + encodeURIComponent(serverName));
    if (keyword) apiQ.push('keyword=' + encodeURIComponent(keyword));
    if (itemCat) apiQ.push('itemCategory=' + encodeURIComponent(itemCat));
    if (sort) apiQ.push('sort=' + encodeURIComponent(sort));
    apiQ.push('page=' + Math.max(1, page));
    apiQ.push('limit=50');
    apiQ.push('premium=0');

    var normalList = document.querySelector('ul.search_list_normal');
    var premiumList = document.querySelector('ul.search_list_premium');
    var countEl = document.getElementById('premium_count');

    if (!normalList) return;

    // ── 아이템매니아 원본 리스팅 저장 (지우기 전에) ──────────────
    var origNormalItems = Array.from(normalList.querySelectorAll('li.list_item, li[data-tid]'));
    var origPremiumItems = premiumList ? Array.from(premiumList.querySelectorAll('li.list_item, li[data-tid]')) : [];
    var origNormalCount = origNormalItems.length;

    // ── 아이템매니아 원본 총 건수 저장 (덮어쓰기 전에) ──────────
    var origImCountText = countEl ? countEl.textContent.trim() : '';
    var origImCount = parseInt(origImCountText.replace(/[^0-9]/g, ''), 10) || origNormalCount;

    // 프리미엄은 관리자 전용 크롤링 API가 아닌 활성 상품 DB에서 별도로 조회한다.
    var premiumQ = apiQ.filter(function(q) { return !/^(page|limit|premium)=/.test(q); });
    premiumQ.push('page=1', 'limit=10', 'premium=1');
    var premiumPromise = fetch('/api/products?' + premiumQ.join('&'), { credentials: 'include' })
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function() { return { items: [], total: 0, error: true }; });
    var soldQ = apiQ.concat('status=sold');
    var soldPremiumQ = premiumQ.concat('status=sold');
    var soldPromise = fetch('/api/products?' + soldQ.join('&'), { credentials: 'include' })
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function() { return { items: [], total: 0 }; });
    var soldPremiumPromise = fetch('/api/products?' + soldPremiumQ.join('&'), { credentials: 'include' })
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function() { return { items: [], total: 0 }; });

    Promise.all([
      fetch('/api/products?' + apiQ.join('&'), { credentials: 'include' })
        .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
      soldPromise, premiumPromise, soldPremiumPromise
    ])
      .then(function(results) {
        var data = results[0], soldData = results[1], premiumData = results[2], soldPremiumData = results[3];
        verifiedSoldIds = {};
        var seenDbIds = {}, seenItemmaniaIds = {};
        var items = [];
        [data.items || [], soldData.items || [], premiumData.items || [], soldPremiumData.items || []].forEach(function(group) {
          group.forEach(function(p) {
            if (!p || !p.id || seenDbIds[String(p.id)]) return;
            seenDbIds[String(p.id)] = true;
            if (p.itemmaniaid) seenItemmaniaIds[String(p.itemmaniaid)] = true;
            if (p.status === 'sold') verifiedSoldIds[String(p.id)] = true;
          });
        });
        (data.items || []).concat(soldData.items || []).forEach(function(p) {
          if (!p || !p.id || items.some(function(existing) { return existing.id === p.id; })) return;
          items.push(p);
        });
        var ourTotal = (data.total || 0) + (soldData.total || 0);
        function notInDb(el) {
          var tid = el.getAttribute('data-tid') || '';
          return !seenItemmaniaIds[tid] && !seenDbIds[tid];
        }

        // ── itemCategory 필터: 원본 상품도 탭에 맞게 걸러냄 ─────
        // gameCode가 있으면 스냅샷 원본(리니지클래식 기본)은 표시하지 않음 — Phase 2에서 실시간으로 교체
        var filteredOrig = gameCode ? [] : (itemCat ? origNormalItems.filter(function(el) {
          var goodsEl = el.querySelector('[data-search=goods]');
          return goodsEl && goodsEl.textContent.trim() === itemCat;
        }) : origNormalItems).filter(notInDb);

        // ── 프리미엄 섹션 itemCategory 필터 ────────────────────────
        var filteredPremium = gameCode ? [] : (itemCat ? origPremiumItems.filter(function(el) {
          var goodsEl = el.querySelector('[data-search=goods]');
          return goodsEl && goodsEl.textContent.trim() === itemCat;
        }) : origPremiumItems).filter(notInDb);

        // 전체 건수: gameCode/itemCategory 필터 없으면 스냅샷 총 건수, 있으면 filteredOrig 길이 사용
        var snapshotCount = (gameCode || itemCat) ? filteredOrig.length : origImCount;
        var totalCount = snapshotCount + ourTotal;
        if (countEl) countEl.textContent = fmt(totalCount) + '건';

        // 기존 원본 아이템매니아 리스팅 제거 (다시 정렬해서 붙일 것)
        origNormalItems.forEach(function(el) { el.remove(); });
        if (premiumList) origPremiumItems.forEach(function(el) { el.remove(); });

        // normalList 비우기
        normalList.innerHTML = '';

        // ── 우리 DB 상품은 전부 일반 목록에 시간순으로 배치 ──────
        var ourEls = items.map(function(p){return makeCardWithBadge(p,type);});

        // ── 업로드 시간순 병합 (최신 순) ──────────────────────────
        // 아이템매니아 원본은 이미 최신순. 같은 분(HH:MM) 내 순서는 원본 순서 보존.
        // idx=0(첫 항목)이 가장 최신이므로 뒤에서부터 오프셋 부여.
        filteredOrig.forEach(function(el, idx) {
          var baseTs = getItemTs(el);
          el.setAttribute('data-ts', String(baseTs + (filteredOrig.length - 1 - idx)));
        });

        var all = ourEls.concat(filteredOrig);
        all.sort(function(a, b) {
          return (parseInt(b.getAttribute('data-ts') || '0') || 0)
               - (parseInt(a.getAttribute('data-ts') || '0') || 0);
        });
        all.forEach(function(el) { normalList.appendChild(el); });

        // 둘 다 없으면 안내 메시지 (gameCode 있을 때 filteredOrig=[]이므로 length로 판단)
        if (items.length === 0 && filteredOrig.length === 0) {
          normalList.innerHTML =
            '<li style="padding:60px 0;text-align:center;color:#999;font-size:15px;list-style:none">' +
            '등록된 상품이 없습니다.<br><br>' +
            '<a href="/' + type + '/register.html" style="display:inline-block;padding:12px 24px;background:#159EFD;color:#fff;border-radius:8px;font-weight:700;text-decoration:none">+ 첫 번째 상품 등록하기</a>' +
            '</li>';
        }

        // 프리미엄 리스트: 아이템매니아 원본 프리미엄 상품만
        if (premiumList) {
          filteredPremium.forEach(function(el) { premiumList.appendChild(el); });
          var premParent = premiumList.closest('div, section') || premiumList.parentElement;
          if (premParent) premParent.style.display = gameCode ? '' : (filteredPremium.length === 0 ? 'none' : '');
        }

        // 페이지네이션 (우리 DB 기준)
        var totalPages = Math.ceil(ourTotal / 50);
        var gPaging = document.querySelector('ul.g_paging');
        var dvPaging = document.querySelector('div.dvPaging');
        if (gPaging) {
          gPaging.innerHTML = '';
          if (totalPages > 1) {
            var pageNums = document.createElement('li');
            pageNums.className = 'page_nums';
            var start = Math.max(1, page - 4), end = Math.min(totalPages, start + 9);
            for (var i = start; i <= end; i++) {
              var q2 = new URLSearchParams(location.search);
              q2.set('page', String(i));
              if (i === page) {
                var strong = document.createElement('strong');
                strong.textContent = String(i);
                pageNums.appendChild(strong);
              } else {
                var a = document.createElement('a');
                a.href = location.pathname + '?' + q2.toString();
                a.textContent = String(i);
                pageNums.appendChild(a);
              }
            }
            gPaging.appendChild(pageNums);
          } else {
            if (dvPaging) dvPaging.style.display = 'none';
          }
        }

        {
          var premiumItems = [];
          (premiumData.items || []).concat(soldPremiumData.items || []).forEach(function(p) {
            if (!p || !p.id || premiumItems.some(function(existing) { return existing.id === p.id; })) return;
            premiumItems.push(p);
          });
          if (premiumList) {
            premiumItems.forEach(function(p) { premiumList.appendChild(makeCardWithBadge(p, type)); });
            if (gameCode && premiumItems.length === 0) {
              premiumList.innerHTML = '<li style="padding:22px;text-align:center;color:#747b86;list-style:none">' +
                (premiumData.error ? '프리미엄 상품을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.' :
                '현재 확인된 프리미엄 상품이 없습니다. 최신 수집이 지연되었을 수 있습니다.') + '</li>';
            }
            var premiumWrap = premiumList.closest('div.list_premium_wrap') || premiumList.parentElement;
            if (premiumWrap) premiumWrap.style.display = (gameCode || premiumItems.length || filteredPremium.length) ? '' : 'none';
          }
          if (countEl) countEl.textContent = fmt(totalCount + (premiumData.total || 0) + (soldPremiumData.total || 0)) + '건';
        }
      })
      .catch(function() {
        var loadEl2 = document.getElementById('_im_loading');
        if (loadEl2) loadEl2.remove();
        // 에러 시 원본 아이템매니아 항목만 유지
      });
  }

  function injectGradeStyles() {
    if (document.getElementById('im-grade-all-style')) return;
    var s = document.createElement('style');
    s.id = 'im-grade-all-style';
    var base = '.credit_mark_new{font-size:0!important;display:inline-block!important;width:35px;height:37px;vertical-align:middle;background-repeat:no-repeat!important;background-size:100% auto!important;}';
    var grades = ['vip','platinum','gold','silver','bronze'];
    for (var i = 0; i < grades.length; i++) {
      base += '.credit_mark_new.' + grades[i] + '{background-image:url("/grade-icon/' + grades[i] + '")!important;}';
    }
    s.textContent = base;
    document.head.appendChild(s);
  }
  function init() { injectGradeStyles(); loadList(); initFilters(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const SELL_REGISTER_INTERCEPT_SCRIPT = `
<style>
#charge_service,#dv_power,
.charge_service,.credit_benefit_area,#credit_benefit{display:none!important}

/* ─── 프리미엄/현금영수증 팝업 완전 제거 ─────────── */
#dvPremium,#receipt_layer{display:none!important;}

/* ─── 물품등록정보 팝업 오버레이 ─────────────────── */
#dvPopup{
  position:fixed!important;inset:0!important;z-index:10000!important;
  background:rgba(0,0,0,0.55)!important;
  display:none!important;
  align-items:flex-start!important;justify-content:center!important;
  padding:40px 16px!important;overflow-y:auto!important;
  box-sizing:border-box!important;
}
#dvPopup.im-show{display:flex!important;}

/* 팝업 흰 박스 + 파란 테두리 */
#dvPopup .inner{
  background:#fff!important;
  border-radius:10px!important;
  border:2px solid #159EFD!important;
  width:100%!important;max-width:640px!important;
  overflow:hidden!important;position:relative!important;
  text-align:left!important;
}
/* 제목 "물품등록정보" */
#dvPopup .title{
  display:block!important;
  font-size:18px!important;font-weight:700!important;color:#159EFD!important;
  padding:20px 22px 16px!important;margin:0!important;
  border-bottom:2px solid #159EFD!important;
  background:#fff!important;
}
/* 본문 영역 */
#dvPopup .cont{padding:18px 22px 0!important;}
/* 테이블 */
#dvPopup .g_blue_table{
  width:100%!important;border-collapse:collapse!important;margin-bottom:10px!important;
}
#dvPopup .g_blue_table th{
  background:#EEF5FF!important;font-size:13px!important;font-weight:600!important;
  padding:10px 14px!important;border:1px solid #D5E2F2!important;
  text-align:left!important;white-space:nowrap!important;color:#333!important;
}
#dvPopup .g_blue_table td{
  padding:10px 14px!important;border:1px solid #D5E2F2!important;
  font-size:13px!important;color:#222!important;
}
/* 거래 사고 주의사항 헤더 */
#dvPopup .attention{
  font-size:13px!important;font-weight:700!important;color:#e53e3e!important;
  margin:10px 0 6px!important;padding:0!important;
}
/* 빨간 경고 박스 */
#dvPopup .attention_box{
  padding:12px 16px!important;
  border:1px solid #f5c6cb!important;
  background:#FFF5F5!important;
  font-size:13px!important;line-height:1.75!important;
  margin-bottom:10px!important;border-radius:4px!important;
  list-style:none!important;
}
#dvPopup .attention_box li{
  margin-bottom:4px!important;list-style:none!important;padding:0!important;
}
#dvPopup .attention_box .deco{font-weight:700!important;}
#dvPopup .attention_box .f_blue3{color:#159EFD!important;font-size:12px!important;}
/* 약관 회색 박스 */
#dvPopup .box6{
  padding:10px 16px!important;
  border:1px solid #e0e0e0!important;
  background:#f9f9f9!important;
  font-size:12px!important;color:#555!important;
  line-height:1.75!important;margin-bottom:10px!important;border-radius:4px!important;
}
#dvPopup .box6 li{list-style:none!important;margin-bottom:2px!important;padding:0!important;}
#dvPopup .list_non::before{content:""!important;}
/* checkbox 영역 숨김 */
#dvPopup .warning_txt_layer{display:none!important;}
/* "등록하시려는 물품이 위와 같습니까?" */
#dvPopup .last_txt{
  text-align:center!important;font-size:14px!important;font-weight:600!important;color:#333!important;
  padding:14px 0 16px!important;border-top:1px solid #e8e8e8!important;margin-top:4px!important;
}
/* 버튼 영역 */
#dvPopup .g_btn_new{
  padding:0 22px 22px!important;display:flex!important;gap:10px!important;
  justify-content:center!important;
}
/* 확인(파란) 버튼 */
#reg_submit{
  flex:0 0 140px!important;padding:15px 0!important;
  background:#159EFD!important;color:#fff!important;border:none!important;
  border-radius:8px!important;font-size:16px!important;font-weight:700!important;
  cursor:pointer!important;text-align:center!important;
}
/* 취소(회색) 버튼 */
#cancel_submit{
  flex:0 0 140px!important;padding:15px 0!important;
  background:#666!important;color:#fff!important;border:none!important;
  border-radius:8px!important;font-size:16px!important;font-weight:700!important;
  cursor:pointer!important;text-align:center!important;
}
</style>
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  // ── 게임 검색 자동완성 ───────────────────────────────────────────
  // 기존 HTML의 .g_search_frame (#reg_gameserver) 3열 구조 활용:
  // .game(게임목록) | .server(서버목록) | .goods(카테고리)
  function setupGameSearch(inp) {
    if (!inp) return;
    var _debounce = null;

    // 기존 #reg_gameserver 드롭다운 찾기
    var frame = document.getElementById(\'reg_gameserver\');
    if (!frame) {
      var p = inp.parentElement;
      for (var k = 0; k < 10 && p; k++) {
        var found = p.querySelector(\'.g_search_frame\');
        if (found) { frame = found; break; }
        p = p.parentElement;
      }
    }

    // fallback: 커스텀 드롭다운
    var useCustom = !frame;
    var dd = null;
    if (useCustom) {
      var wrapper = inp.parentElement;
      for (var wk = 0; wk < 8 && wrapper; wk++) {
        if (wrapper.classList && wrapper.classList.contains(\'g_search_wrapper\')) break;
        wrapper = wrapper.parentElement;
      }
      var existDd = document.getElementById(\'_im_game_dd_fb\');
      if (existDd) existDd.remove();
      dd = document.createElement(\'div\');
      dd.id = \'_im_game_dd_fb\';
      dd.style.cssText = \'position:absolute;top:38px;left:0;width:100%;z-index:200;\'
        + \'background:var(--color-body,#fff);border:4px solid var(--color-blue7,#159EFD);\'
        + \'border-top:0;border-radius:0 0 15px 15px;overflow-y:auto;max-height:320px;\'
        + \'box-sizing:border-box;padding:8px 0;display:none;box-shadow:0 8px 24px rgba(0,0,0,.12)\';
      if (wrapper) wrapper.appendChild(dd);
    }

    var listEl = frame ? (document.getElementById(\'reg_gameserver_list\') || frame.querySelector(\'.gs_list\')) : null;

    function showDrop() {
      if (useCustom && dd) { dd.style.display = \'block\'; }
      else if (frame) {
        frame.classList.remove(\'g_hidden\');
        // .g_search_frame_wrapper{height:100%} collapse 방지 — inline으로 override
        frame.style.height = \'auto\';
        frame.style.overflow = \'visible\';
        var fw = frame.querySelector(\'.g_search_frame_wrapper\');
        if (fw) fw.style.height = \'auto\';
        var gl = frame.querySelector(\'.gs_list\');
        if (gl) { gl.style.minHeight = \'180px\'; gl.style.height = \'180px\'; }
      }
    }
    function hideDrop() {
      if (useCustom && dd) { dd.style.display = \'none\'; }
      else if (frame) {
        frame.classList.add(\'g_hidden\');
        frame.style.height = \'\';
        frame.style.overflow = \'\';
        var fw = frame.querySelector(\'.g_search_frame_wrapper\');
        if (fw) fw.style.height = \'\';
        var gl = frame.querySelector(\'.gs_list\');
        if (gl) { gl.style.minHeight = \'\'; gl.style.height = \'\'; }
      }
    }
    function dropContains(el) {
      if (useCustom && dd) return dd.contains(el);
      if (frame) return frame.contains(el);
      return false;
    }

    // ─── 구조화된 드롭다운 (기존 HTML 활용) ─────────────────────────
    function renderStructured(games) {
      var gameDiv = listEl.querySelector(\'.game\');
      var serverDiv = listEl.querySelector(\'.server\');
      if (!gameDiv) return;
      var gameUl = gameDiv.querySelector(\'ul\');
      if (!gameUl) { gameUl = document.createElement(\'ul\'); gameDiv.appendChild(gameUl); }
      gameUl.innerHTML = \'\';

      if (!games.length) {
        var li = document.createElement(\'li\');
        li.textContent = \'검색 결과가 없습니다\';
        li.style.cssText = \'color:#999;cursor:default\';
        gameUl.appendChild(li);
        if (serverDiv) { var su = serverDiv.querySelector(\'ul\'); if (su) su.innerHTML = \'\'; }
      } else {
        games.forEach(function(g, idx) {
          var li = document.createElement(\'li\');
          li.textContent = g.name;
          if (idx === 0) {
            li.classList.add(\'sel_on\');
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            renderStructuredServers(g, serverDiv);
          }
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            gameUl.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            renderStructuredServers(g, serverDiv);
          });
          gameUl.appendChild(li);
        });
      }

      // 카테고리(.goods) 클릭 처리
      var goodsDiv = listEl.querySelector(\'.goods\');
      if (goodsDiv && !goodsDiv._imBound) {
        goodsDiv._imBound = true;
        goodsDiv.querySelectorAll(\'li\').forEach(function(li) {
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            goodsDiv.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_category = li.textContent.replace(/NEW/g, \'\').trim();
            if (window._IM_sel_game) {
              inp.value = window._IM_sel_game.name
                + (window._IM_sel_server ? \' > \' + window._IM_sel_server.name : \'\')
                + \' > \' + window._IM_sel_category;
              hideDrop();
            }
          });
        });
      }

      showDrop();
    }

    function renderStructuredServers(g, serverDiv) {
      if (!serverDiv) return;
      var serverUl = serverDiv.querySelector(\'ul\');
      if (!serverUl) { serverUl = document.createElement(\'ul\'); serverDiv.appendChild(serverUl); }
      serverUl.innerHTML = \'\';
      if (g.servers && g.servers.length) {
        g.servers.forEach(function(s, sidx) {
          var li = document.createElement(\'li\');
          li.textContent = s.name;
          if (sidx === 0) {
            li.classList.add(\'sel_on\');
            window._IM_sel_server = s;
            inp.value = g.name + \' > \' + s.name;
          }
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            serverUl.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_server = s;
            inp.value = g.name + \' > \' + s.name;
          });
          serverUl.appendChild(li);
        });
      } else {
        inp.value = g.name;
      }
    }

    // ─── 커스텀 드롭다운 fallback ────────────────────────────────────
    function renderCustom(games) {
      if (!dd) return;
      dd.innerHTML = \'\';
      if (!games.length) {
        var row = document.createElement(\'div\');
        row.style.cssText = \'padding:8px 16px;color:#999;font-size:14px\';
        row.textContent = \'검색 결과가 없습니다\';
        dd.appendChild(row);
      } else {
        games.forEach(function(g) {
          var row = document.createElement(\'div\');
          row.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px\';
          row.textContent = g.name + (g.servers && g.servers.length ? \' (\' + g.servers.length + \'개 서버)\' : \'\');
          row.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          row.addEventListener(\'click\', function() {
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            if (g.servers && g.servers.length) {
              renderCustomServers(g);
            } else {
              inp.value = g.name;
              hideDrop();
            }
          });
          dd.appendChild(row);
        });
      }
      showDrop();
    }

    function renderCustomServers(g) {
      if (!dd) return;
      dd.innerHTML = \'\';
      var back = document.createElement(\'div\');
      back.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px;color:#0070d2;font-weight:600;border-bottom:1px solid #eee;margin-bottom:4px\';
      back.textContent = \'← \' + g.name + \' (게임 목록)\';
      back.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
      back.addEventListener(\'click\', function() { search(inp.value); });
      dd.appendChild(back);
      g.servers.forEach(function(s) {
        var row = document.createElement(\'div\');
        row.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px\';
        row.textContent = s.name;
        row.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
        row.addEventListener(\'click\', function() {
          window._IM_sel_server = s;
          inp.value = g.name + \' > \' + s.name;
          hideDrop();
        });
        dd.appendChild(row);
      });
      showDrop();
    }

    function search(q) {
      clearTimeout(_debounce);
      _debounce = setTimeout(function() {
        fetch(\'/api/games/search?q=\' + encodeURIComponent(q || \'\'), { credentials: \'include\' })
          .then(function(r) { return r.json(); })
          .then(function(games) {
            if (!useCustom && listEl) renderStructured(games);
            else renderCustom(games);
          })
          .catch(function() {});
      }, q ? 200 : 0);
    }

    inp.addEventListener(\'focus\', function() { if (inp.value.trim()) search(inp.value); }, true);
    inp.addEventListener(\'input\', function() { if (inp.value.trim()) search(inp.value); else hideDrop(); }, true);
    document.addEventListener(\'click\', function(e) {
      if (e.target !== inp && !dropContains(e.target)) hideDrop();
    });
  }

  function clearSnapshot() {
    // 폼 검색 입력(searchRegGameServer)과 헤더 검색(searchGameServer) 모두 초기화
    var _clearIds = ['searchRegGameServer','searchGameServer','user_price','user_title','user_character'];
    _clearIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el && !el._imUserTouched) el.value = '';
    });
    var qlEditor = document.querySelector('.ql-editor');
    if (qlEditor && !qlEditor._imUserTouched) qlEditor.innerHTML = '<p><br></p>';
    window._IM_sel_game = null;
    window._IM_sel_server = null;
    window._IM_sel_category = null;
    document.querySelectorAll('.g_search_frame .goods li, .gs_list .goods li').forEach(function(li) {
      li.classList.remove('sel_on');
    });
  }

  // ── 내 거래정보 섹션 동적 로딩 ───────────────────────────────────
  function loadUserTradeInfo() {
    if (window._IM_refreshTradeInfo) { window._IM_refreshTradeInfo(); return; }
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(me) {
        if (!me) return;
        var displayName = me.nickname || me.email || String(me.id);
        // li.user_name 안의 텍스트 노드만 교체 (수정 버튼 <a> 유지)
        var nameEl = document.querySelector('.my_private li.user_name, li.user_name');
        if (nameEl) {
          Array.prototype.forEach.call(nameEl.childNodes, function(node) {
            if (node.nodeType === 3) node.textContent = displayName + ' ';
          });
        }
        var phoneEl = document.getElementById('spnUserPhone');
        if (phoneEl) phoneEl.textContent = '자택번호 없음 ';
        var cellEl = document.getElementById('spnUserCell');
        if (cellEl) cellEl.textContent = me.phone || '';
        var mileageEl = document.getElementById('txtCurrentMileage');
        if (mileageEl && me.balance != null)
          mileageEl.textContent = Number(me.balance).toLocaleString() + '원';
      })
      .catch(function() {});
  }

  function init() {
    loadUserTradeInfo();
    // 2초간 80ms 인터벌로 스냅샷 JS 값 복원 차단
    clearSnapshot();
    var _clearTicker = setInterval(function() {
      var el = document.getElementById('searchRegGameServer') || document.getElementById('searchGameServer');
      if (el && el.value && !el._imUserTouched) el.value = '';
    }, 80);
    setTimeout(function() { clearInterval(_clearTicker); }, 2000);
    var _gsInp = document.getElementById('searchRegGameServer') || document.getElementById('searchGameServer');
    if (_gsInp) {
      _gsInp.addEventListener('focus', function() { _gsInp._imUserTouched = true; clearInterval(_clearTicker); }, { once: true });
    }

    // URL search_game으로 게임 사전 선택 (메이플랜드 등 목록에서 등록 클릭 시 게임 유지)
    (function() {
      var sgCode = new URLSearchParams(location.search).get('search_game');
      if (!sgCode) return;
      fetch('/api/games/bycode/' + encodeURIComponent(sgCode), { credentials: 'include' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(g) {
          if (!g || !g.name) return;
          window._IM_sel_game = { id: g.id, code: g.code, name: g.name };
          window._IM_sel_server = null;
          var inp = document.getElementById('searchRegGameServer') || document.getElementById('searchGameServer');
          if (inp && !inp._imUserTouched) {
            inp.value = g.name;
            inp._imUserTouched = true;
            clearInterval(_clearTicker);
          }
        })
        .catch(function() {});
    })();

    // ── receipt_layer: 캡처된 원본 HTML 사용 or MutationObserver로 자동 캡처 ─────
    (function() {
      var rl = document.getElementById('receipt_layer');
      if (!rl) return;
      var captured = ${JSON.stringify(capturedReceiptHtml)};
      if (captured) {
        // 이미 캡처된 원본 HTML 사용
        if (!rl.querySelector('.inner')) rl.innerHTML = captured;
      } else {
        // 아직 캡처 전 → MutationObserver로 itemmania JS가 채울 때 자동 저장
        var obs = new MutationObserver(function(muts) {
          for (var i = 0; i < muts.length; i++) {
            var inner = rl.innerHTML.trim();
            if (inner && inner.length > 50) {
              obs.disconnect();
              fetch('/im-capture-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: inner
              }).then(function(r) {
                if (r.ok) console.log('[IM] receipt_layer 원본 캡처 완료 ✓');
              }).catch(function(e) {
                console.warn('[IM] receipt_layer 캡처 실패:', e);
              });
              break;
            }
          }
        });
        obs.observe(rl, { childList: true, subtree: true, characterData: true });
      }
    })();

    // 수수료 영역 초기 숨김
    var comsArea = document.getElementById('coms_area');
    if (comsArea) comsArea.style.display = 'none';

    // 가격 입력시 수수료 자동계산
    var priceInp = document.getElementById('user_price');
    if (priceInp) {
      priceInp.addEventListener('input', function() {
        var raw = parseInt(priceInp.value.replace(/[^0-9]/g, ''), 10) || 0;
        var fee = Math.round(raw * 0.05);
        var recv = raw - fee;
        var commEl = document.getElementById('commission_price');
        var recvEl = document.getElementById('receive_price');
        if (commEl) commEl.textContent = fee.toLocaleString();
        if (recvEl) recvEl.textContent = recv.toLocaleString();
        if (comsArea) comsArea.style.display = raw > 0 ? 'block' : 'none';
        // 천단위 콤마 표시
        priceInp.value = raw > 0 ? raw.toLocaleString() : '';
      });
    }

    // 스냅샷 JS 이벤트 리스너 완전 제거: cloneNode + id 변경으로 스냅샷 JS 재부착 차단
    (function() {
      var origIds = ['searchRegGameServer', 'searchGameServer'];
      var cleanInp = null;
      for (var _i = 0; _i < origIds.length; _i++) {
        var orig = document.getElementById(origIds[_i]);
        if (orig) {
          var clone = orig.cloneNode(true);
          // 스냅샷 JS가 id로 재쿼리해 리스너를 붙이지 못하도록 원본 id 제거
          orig.removeAttribute('id');
          // 클론에 id 유지 (폼 submit 핸들러 등이 참조)
          orig.parentNode.replaceChild(clone, orig);
          cleanInp = clone;
          break;
        }
      }
      // 게임 검색 자동완성 활성화
      setupGameSearch(cleanInp);
    })();

    // 캐릭터명 저장 버튼 → "저장되었습니다." 토스트 (캡처 페이즈로 stopPropagation 우회)
    document.addEventListener('click', function(e) {
      var btn = e.target;
      if (btn && btn.classList && btn.classList.contains('btn_name_save')) {
        showToast('저장되었습니다.', true);
      }
    }, true);

    // 구매등록 링크 → /buy/register.html
    document.querySelectorAll('a[href*="/buy/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/buy/') && !h.includes('/buy/list') && !h.includes('/buy/application')) {
        a.href = '/buy/register.html';
        a.addEventListener('click', function(e) {
          e.preventDefault(); location.href = '/buy/register.html';
        });
      }
    });

    // 판매등록 폼 제출 인터셉트
    var form = document.getElementById('frmSell');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login'; }, 1200);
              return;
            }
            var gameEl = form.querySelector('[name=searchGameServer],[id=searchRegGameServer]');
            var priceEl = form.querySelector('[name=user_price]');
            var titleEl = form.querySelector('[name=user_title],[name=title_name]');
            var game = window._IM_sel_game ? window._IM_sel_game.name : (gameEl ? gameEl.value.trim() : '');
            var server = window._IM_sel_server ? window._IM_sel_server.name : '';
            var price = priceEl ? priceEl.value.trim() : '';
            var title = titleEl ? titleEl.value.trim() : '';
            if (!game) { showToast('게임을 선택해주세요.', false); return; }
            if (!price) { showToast('가격을 입력해주세요.', false); return; }
            if (!title) { showToast('상품명을 입력해주세요.', false); return; }
            var qlEl = form.querySelector('.ql-editor');
            var quantityLabel = window._im_registration_quantity(form);
            if (!quantityLabel) { showToast('수량과 단위를 올바르게 입력해주세요.', false); return; }
            var description = '';
            if (qlEl) {
              var raw = qlEl.innerText || qlEl.textContent || '';
              description = raw.trim();
            }
            fetch('/api/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                title: title,
                price: parseInt(price.replace(/[^0-9]/g, ''), 10),
                gameName: game,
                serverName: server,
                category: 'sell',
                quantityLabel: quantityLabel,
                itemCategory: window._IM_sel_category || '기타',
                sellerName: d.nickname || d.email,
                characterName: (form.querySelector('[name=user_character]') || {}).value || undefined,
                description: description
              })
            })
            .then(function(r) {
              if (r.ok) {
                return r.json().then(function(created) {
                  // 등록된 데이터 저장 (dvPopup 표시에 사용)
                  window._IM_reg_data = {
                    id: created.id || created.productId || '',
                    game: game,
                    server: server,
                    category: window._IM_sel_category || '기타',
                    title: title,
                    price: parseInt(price.replace(/[^0-9]/g, ''), 10),
                    tradeType: '일반판매'
                  };
                  // ── 팝업 플로우: dvPremium → receipt_layer → dvPopup → 완료 ──
                  function showOverlay() {
                    document.body.classList.add('mask_on');
                    var ov = document.getElementById('g_OVERLAY');
                    var sl = document.getElementById('g_SLEEP');
                    if (sl) sl.classList.remove('g_hidden');
                    if (ov) ov.style.display = 'block';
                  }
                  function hideOverlay() {
                    document.body.classList.remove('mask_on');
                    var ov = document.getElementById('g_OVERLAY');
                    var sl = document.getElementById('g_SLEEP');
                    if (sl) sl.classList.add('g_hidden');
                    if (ov) ov.style.display = 'none';
                  }
                  function fillAndShowDvPopup() {
                    var regData = window._IM_reg_data || {};
                    var catEl   = document.getElementById('popup_category');
                    var titleEl     = document.getElementById('popup_title');
                    var priceEl     = document.getElementById('popup_price');
                    var tradeTypeEl = document.getElementById('popup_trade_type');
                    if (catEl) {
                      var catStr = regData.game || '';
                      if (regData.server)   catStr += ' &gt; ' + regData.server;
                      if (regData.category) catStr += ' &gt; <span class=f_blue3>' + regData.category + '</span>';
                      catEl.innerHTML = catStr;
                    }
                    if (titleEl)     titleEl.textContent     = regData.title || '';
                    if (priceEl)     priceEl.textContent     = (regData.price || 0).toLocaleString() + '원';
                    if (tradeTypeEl) tradeTypeEl.textContent = regData.tradeType || '일반판매';
                    var dvPopup = document.getElementById('dvPopup');
                    showLayer(dvPopup);
                    // reg_submit(확인) → 완료 페이지
                    var regBtn = document.getElementById('reg_submit');
                    if (regBtn && !regBtn._imBound) {
                      regBtn._imBound = true;
                      regBtn.addEventListener('click', function() {
                        var rd  = window._IM_reg_data || {};
                        var pid = rd.id || '';
                        var gid = (window._IM_sel_game && window._IM_sel_game.id) ? window._IM_sel_game.id : '';
                        var cat = encodeURIComponent(rd.category || '');
                        var url = '/sell/index_view.html';
                        if (pid) {
                          url += '?id=' + pid;
                          if (gid) url += '&gid=' + gid;
                          if (cat) url += '&cat=' + cat;
                        }
                        location.href = url;
                      });
                    }
                    // cancel_submit(취소) → 팝업 닫기
                    var cancelBtn = document.getElementById('cancel_submit');
                    if (cancelBtn && !cancelBtn._imBound) {
                      cancelBtn._imBound = true;
                      cancelBtn.addEventListener('click', function() {
                        hideLayer(dvPopup);
                      });
                    }
                  }

                  // ── 팝업 show/hide 헬퍼 ──────────────────────────────────
                  function showLayer(el) {
                    if (!el) return;
                    el.classList.remove('sf-hidden');
                    el.classList.add('im-show');
                  }
                  function hideLayer(el) {
                    if (!el) return;
                    el.classList.remove('im-show');
                  }

                  // 프리미엄/현금영수증 건너뜀 → 바로 물품등록정보 표시
                  fillAndShowDvPopup();
                });
              } else {
                return r.json().then(function(e) { showToast('등록 실패: ' + (e.error || '오류'), false); });
              }
            })
            .catch(function() { showToast('서버 오류가 발생했습니다.', false); });
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── NEW 모드 버튼 (#change_mode data-mode=n) ───────────────────
    var newModeBtn = document.getElementById('change_mode');
    if (newModeBtn && newModeBtn.getAttribute('data-mode') === 'n') {
      newModeBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/sell/new.html';
      }, true);
    }

    // ── 물품일괄등록 (#batch_move) ──────────────────────────────────
    var batchBtn = document.getElementById('batch_move');
    if (batchBtn) {
      batchBtn.href = '/myroom/batch_goods/index.html';
      batchBtn.addEventListener('click', function(e) {
        e.preventDefault(); location.href = '/myroom/batch_goods/index.html';
      });
    }

    // 뒤로가기 / 홈
    var backLinks = document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]');
    backLinks.forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const BUY_REGISTER_INTERCEPT_SCRIPT = `
<style>
#charge_service,#dvPremium,.premium_info,.g_layer.premium_info,#dv_power,
.charge_service,.credit_benefit_area,#credit_benefit{display:none!important}

/* 검색 드롭다운: initial_screen / search-select 숨김 — gs_list만 표시 */
#reg_gameserver .initial_screen,
#reg_gameserver .search-select{display:none!important}

/* ─── gs_list 3열 레이아웃 (buy-register에는 sell CSS 없으므로 직접 정의) ─ */
#reg_gameserver .g_search_frame_wrapper{overflow:visible!important;height:auto!important}
#reg_gameserver .gs_list{
  display:flex!important;height:180px!important;overflow:hidden!important;
  border:1px solid #ddd!important;border-top:none!important;background:#fff!important;
}
#reg_gameserver .gs_list>div{
  flex:1!important;height:100%!important;overflow-y:auto!important;display:block!important;
  border-right:1px solid #e8e8e8!important;box-sizing:border-box!important;
}
#reg_gameserver .gs_list>div:last-child{border-right:none!important}
#reg_gameserver .gs_list ul{list-style:none!important;margin:0!important;padding:0!important}
#reg_gameserver .gs_list li{
  padding:7px 12px!important;cursor:pointer!important;font-size:13px!important;
  line-height:1.4!important;color:#333!important;white-space:nowrap!important;
  overflow:hidden!important;text-overflow:ellipsis!important;
}
#reg_gameserver .gs_list li:hover,
#reg_gameserver .gs_list li.sel_on{
  background:#e8f4ff!important;color:#0070d2!important;font-weight:600!important;
}

/* ─── 구매 물품등록정보 팝업 오버레이 ─────────────── */
#dvPopup{
  position:fixed!important;inset:0!important;z-index:10000!important;
  background:rgba(0,0,0,0.55)!important;
  display:none!important;
  align-items:flex-start!important;justify-content:center!important;
  padding:40px 16px!important;overflow-y:auto!important;
  box-sizing:border-box!important;
}
#dvPopup.im-show{display:flex!important;}

/* 팝업 흰 박스 + 초록 테두리 */
#dvPopup .inner{
  background:#fff!important;
  border-radius:10px!important;
  border:2px solid #39A742!important;
  width:100%!important;max-width:640px!important;
  overflow:hidden!important;position:relative!important;
  text-align:left!important;
}
/* 제목 "물품등록정보" */
#dvPopup .title{
  display:block!important;
  font-size:18px!important;font-weight:700!important;color:#39A742!important;
  padding:20px 22px 16px!important;margin:0!important;
  border-bottom:2px solid #39A742!important;
  background:#fff!important;
}
/* 본문 */
#dvPopup .cont{padding:18px 22px 0!important;}
/* 테이블 */
#dvPopup .g_blue_table{
  width:100%!important;border-collapse:collapse!important;margin-bottom:10px!important;
}
#dvPopup .g_blue_table th{
  background:#EEF5FF!important;font-size:13px!important;font-weight:600!important;
  padding:10px 14px!important;border:1px solid #D5E2F2!important;
  text-align:left!important;white-space:nowrap!important;color:#333!important;
}
#dvPopup .g_blue_table td{
  padding:10px 14px!important;border:1px solid #D5E2F2!important;
  font-size:13px!important;color:#222!important;
}
/* 거래 사고 주의사항 */
#dvPopup .attention{
  font-size:13px!important;font-weight:700!important;color:#e53e3e!important;
  margin:10px 0 6px!important;padding:0!important;
}
/* 빨간 경고 박스 */
#dvPopup .attention_box{
  padding:12px 16px!important;
  border:1px solid #f5c6cb!important;background:#FFF5F5!important;
  font-size:13px!important;line-height:1.75!important;
  margin-bottom:10px!important;border-radius:4px!important;
  list-style:none!important;
}
#dvPopup .attention_box li{margin-bottom:4px!important;list-style:none!important;padding:0!important;}
#dvPopup .attention_box .deco{font-weight:700!important;}
#dvPopup .attention_box .f_blue3{color:#159EFD!important;font-size:12px!important;}
/* 약관 회색 박스 */
#dvPopup .box6{
  padding:10px 16px!important;
  border:1px solid #e0e0e0!important;background:#f9f9f9!important;
  font-size:12px!important;color:#555!important;
  line-height:1.75!important;margin-bottom:10px!important;border-radius:4px!important;
}
#dvPopup .box6 li{list-style:none!important;margin-bottom:2px!important;padding:0!important;}
#dvPopup .list_non::before{content:""!important;}
/* "등록하시려는 물품이 위와 같습니까?" */
#dvPopup .last_txt{
  text-align:center!important;font-size:14px!important;font-weight:600!important;color:#333!important;
  padding:14px 0 16px!important;border-top:1px solid #e8e8e8!important;margin-top:4px!important;
}
/* 버튼 영역 */
#dvPopup .g_btn_new{padding:0 22px 22px!important;display:flex!important;gap:10px!important;justify-content:center!important;}
/* 확인(초록) 버튼 */
#buy_reg_submit{
  flex:0 0 140px!important;padding:15px 0!important;
  background:#39A742!important;color:#fff!important;border:none!important;
  border-radius:8px!important;font-size:16px!important;font-weight:700!important;cursor:pointer!important;text-align:center!important;
}
/* 취소(회색) 버튼 */
#buy_cancel_submit{
  flex:0 0 140px!important;padding:15px 0!important;
  background:#666!important;color:#fff!important;border:none!important;
  border-radius:8px!important;font-size:16px!important;font-weight:700!important;cursor:pointer!important;text-align:center!important;
}
</style>
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#39A742' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  // ── 게임 검색 자동완성 ───────────────────────────────────────────
  // 기존 HTML의 .g_search_frame (#reg_gameserver) 3열 구조 활용:
  // .game(게임목록) | .server(서버목록) | .goods(카테고리)
  function setupGameSearch(inp) {
    if (!inp) return;
    var _debounce = null;

    // 기존 #reg_gameserver 드롭다운 찾기
    var frame = document.getElementById(\'reg_gameserver\');
    if (!frame) {
      var p = inp.parentElement;
      for (var k = 0; k < 10 && p; k++) {
        var found = p.querySelector(\'.g_search_frame\');
        if (found) { frame = found; break; }
        p = p.parentElement;
      }
    }

    // fallback: 커스텀 드롭다운
    var useCustom = !frame;
    var dd = null;
    if (useCustom) {
      var wrapper = inp.parentElement;
      for (var wk = 0; wk < 8 && wrapper; wk++) {
        if (wrapper.classList && wrapper.classList.contains(\'g_search_wrapper\')) break;
        wrapper = wrapper.parentElement;
      }
      var existDd = document.getElementById(\'_im_game_dd_fb\');
      if (existDd) existDd.remove();
      dd = document.createElement(\'div\');
      dd.id = \'_im_game_dd_fb\';
      dd.style.cssText = \'position:absolute;top:38px;left:0;width:100%;z-index:200;\'
        + \'background:var(--color-body,#fff);border:4px solid var(--color-blue7,#159EFD);\'
        + \'border-top:0;border-radius:0 0 15px 15px;overflow-y:auto;max-height:320px;\'
        + \'box-sizing:border-box;padding:8px 0;display:none;box-shadow:0 8px 24px rgba(0,0,0,.12)\';
      if (wrapper) wrapper.appendChild(dd);
    }

    var listEl = frame ? (document.getElementById(\'reg_gameserver_list\') || frame.querySelector(\'.gs_list\')) : null;

    // gs_list에 .game/.server/.goods 구조 주입 — sell 페이지와 완전 동일한 3열 드롭다운
    if (!useCustom && listEl && !listEl.querySelector(\'.game\')) {
      listEl.innerHTML = \'\';
      var gameD = document.createElement(\'div\');
      gameD.className = \'game\';
      gameD.innerHTML = \'<ul></ul>\';
      var serverD = document.createElement(\'div\');
      serverD.className = \'server\';
      serverD.innerHTML = \'<ul></ul>\';
      var goodsD = document.createElement(\'div\');
      goodsD.className = \'goods\';
      goodsD.innerHTML = \'<ul><li>게임머니</li><li>아이템</li><li>계정</li><li class=sel_on>기타</li></ul>\';
      listEl.appendChild(gameD);
      listEl.appendChild(serverD);
      listEl.appendChild(goodsD);
      window._IM_sel_category = \'기타\';
      // initial_screen 숨김
      var initScr = frame.querySelector(\'.initial_screen\');
      if (initScr) initScr.classList.add(\'g_hidden\');
    }

    function showDrop() {
      if (useCustom && dd) { dd.style.display = \'block\'; }
      else if (frame) {
        frame.classList.remove(\'g_hidden\');
        frame.classList.remove(\'sf-hidden\');
        frame.style.setProperty(\'display\',\'block\',\'important\');
        frame.style.setProperty(\'height\',\'auto\',\'important\');
        frame.style.setProperty(\'overflow\',\'visible\',\'important\');
        frame.style.setProperty(\'visibility\',\'visible\',\'important\');
        var fw = frame.querySelector(\'.g_search_frame_wrapper\');
        if (fw) {
          fw.style.setProperty(\'height\',\'auto\',\'important\');
          fw.style.setProperty(\'overflow\',\'visible\',\'important\');
        }
        var gl = frame.querySelector(\'.gs_list\');
        if (gl) {
          gl.style.setProperty(\'display\',\'flex\',\'important\');
          gl.style.setProperty(\'height\',\'180px\',\'important\');
          gl.style.setProperty(\'min-height\',\'180px\',\'important\');
        }
        var is2 = frame.querySelector(\'.initial_screen\');
        if (is2) is2.style.setProperty(\'display\',\'none\',\'important\');
        var ss2 = frame.querySelector(\'.search-select\');
        if (ss2) ss2.style.setProperty(\'display\',\'none\',\'important\');
      }
    }
    function hideDrop() {
      if (useCustom && dd) { dd.style.display = \'none\'; }
      else if (frame) {
        frame.classList.add(\'g_hidden\');
        frame.style.removeProperty(\'display\');
        frame.style.removeProperty(\'height\');
        frame.style.removeProperty(\'overflow\');
        frame.style.removeProperty(\'visibility\');
        var fw = frame.querySelector(\'.g_search_frame_wrapper\');
        if (fw) { fw.style.removeProperty(\'height\'); fw.style.removeProperty(\'overflow\'); }
        var gl = frame.querySelector(\'.gs_list\');
        if (gl) { gl.style.removeProperty(\'display\'); gl.style.removeProperty(\'height\'); gl.style.removeProperty(\'min-height\'); }
      }
    }
    function dropContains(el) {
      if (useCustom && dd) return dd.contains(el);
      if (frame) return frame.contains(el);
      return false;
    }

    // ─── 구조화된 드롭다운 (기존 HTML 활용) ─────────────────────────
    function renderStructured(games) {
      var gameDiv = listEl.querySelector(\'.game\');
      var serverDiv = listEl.querySelector(\'.server\');
      if (!gameDiv) return;
      var gameUl = gameDiv.querySelector(\'ul\');
      if (!gameUl) { gameUl = document.createElement(\'ul\'); gameDiv.appendChild(gameUl); }
      gameUl.innerHTML = \'\';

      if (!games.length) {
        var li = document.createElement(\'li\');
        li.textContent = \'검색 결과가 없습니다\';
        li.style.cssText = \'color:#999;cursor:default\';
        gameUl.appendChild(li);
        if (serverDiv) { var su = serverDiv.querySelector(\'ul\'); if (su) su.innerHTML = \'\'; }
      } else {
        games.forEach(function(g, idx) {
          var li = document.createElement(\'li\');
          li.textContent = g.name;
          if (idx === 0) {
            li.classList.add(\'sel_on\');
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            renderStructuredServers(g, serverDiv);
          }
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            gameUl.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            renderStructuredServers(g, serverDiv);
          });
          gameUl.appendChild(li);
        });
      }

      // 카테고리(.goods) 클릭 처리
      var goodsDiv = listEl.querySelector(\'.goods\');
      if (goodsDiv && !goodsDiv._imBound) {
        goodsDiv._imBound = true;
        goodsDiv.querySelectorAll(\'li\').forEach(function(li) {
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            goodsDiv.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_category = li.textContent.replace(/NEW/g, \'\').trim();
            if (window._IM_sel_game) {
              inp.value = window._IM_sel_game.name
                + (window._IM_sel_server ? \' > \' + window._IM_sel_server.name : \'\')
                + \' > \' + window._IM_sel_category;
              hideDrop();
            }
          });
        });
      }

      showDrop();
    }

    function renderStructuredServers(g, serverDiv) {
      if (!serverDiv) return;
      var serverUl = serverDiv.querySelector(\'ul\');
      if (!serverUl) { serverUl = document.createElement(\'ul\'); serverDiv.appendChild(serverUl); }
      serverUl.innerHTML = \'\';
      if (g.servers && g.servers.length) {
        g.servers.forEach(function(s, sidx) {
          var li = document.createElement(\'li\');
          li.textContent = s.name;
          if (sidx === 0) {
            li.classList.add(\'sel_on\');
            window._IM_sel_server = s;
            // 자동완성 제거 — 클릭할 때만 inp.value 변경
          }
          li.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          li.addEventListener(\'click\', function() {
            serverUl.querySelectorAll(\'li\').forEach(function(el) { el.classList.remove(\'sel_on\'); });
            li.classList.add(\'sel_on\');
            window._IM_sel_server = s;
            inp.value = g.name + \' > \' + s.name;
          });
          serverUl.appendChild(li);
        });
      }
    }

    // ─── 커스텀 드롭다운 fallback ────────────────────────────────────
    function renderCustom(games) {
      if (!dd) return;
      dd.innerHTML = \'\';
      if (!games.length) {
        var row = document.createElement(\'div\');
        row.style.cssText = \'padding:8px 16px;color:#999;font-size:14px\';
        row.textContent = \'검색 결과가 없습니다\';
        dd.appendChild(row);
      } else {
        games.forEach(function(g) {
          var row = document.createElement(\'div\');
          row.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px\';
          row.textContent = g.name + (g.servers && g.servers.length ? \' (\' + g.servers.length + \'개 서버)\' : \'\');
          row.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
          row.addEventListener(\'click\', function() {
            window._IM_sel_game = g;
            window._IM_sel_server = null;
            if (g.servers && g.servers.length) {
              renderCustomServers(g);
            } else {
              inp.value = g.name;
              hideDrop();
            }
          });
          dd.appendChild(row);
        });
      }
      showDrop();
    }

    function renderCustomServers(g) {
      if (!dd) return;
      dd.innerHTML = \'\';
      var back = document.createElement(\'div\');
      back.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px;color:#0070d2;font-weight:600;border-bottom:1px solid #eee;margin-bottom:4px\';
      back.textContent = \'← \' + g.name + \' (게임 목록)\';
      back.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
      back.addEventListener(\'click\', function() { search(inp.value); });
      dd.appendChild(back);
      g.servers.forEach(function(s) {
        var row = document.createElement(\'div\');
        row.style.cssText = \'padding:6px 16px;cursor:pointer;font-size:14px\';
        row.textContent = s.name;
        row.addEventListener(\'mousedown\', function(e) { e.preventDefault(); });
        row.addEventListener(\'click\', function() {
          window._IM_sel_server = s;
          inp.value = g.name + \' > \' + s.name;
          hideDrop();
        });
        dd.appendChild(row);
      });
      showDrop();
    }

    function search(q) {
      clearTimeout(_debounce);
      _debounce = setTimeout(function() {
        fetch(\'/api/games/search?q=\' + encodeURIComponent(q || \'\'), { credentials: \'include\' })
          .then(function(r) { return r.json(); })
          .then(function(games) {
            if (!useCustom && listEl) renderStructured(games);
            else renderCustom(games);
          })
          .catch(function() {});
      }, q ? 200 : 0);
    }

    inp.addEventListener(\'focus\', function() { if (inp.value.trim()) search(inp.value); }, true);
    inp.addEventListener(\'input\', function() { if (inp.value.trim()) search(inp.value); else hideDrop(); }, true);
    document.addEventListener(\'click\', function(e) {
      if (e.target !== inp && !dropContains(e.target)) hideDrop();
    });
  }

  // ── 내 거래정보 섹션 동적 로딩 ───────────────────────────────────
  function loadUserTradeInfo() {
    if (window._IM_refreshTradeInfo) { window._IM_refreshTradeInfo(); return; }
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(me) {
        if (!me) return;
        var displayName = me.nickname || me.email || String(me.id);
        var nameEl = document.querySelector('.my_private li.user_name, li.user_name');
        if (nameEl) {
          Array.prototype.forEach.call(nameEl.childNodes, function(node) {
            if (node.nodeType === 3) node.textContent = displayName + ' ';
          });
        }
        var phoneEl = document.getElementById('spnUserPhone');
        if (phoneEl) phoneEl.textContent = '자택번호 없음 ';
        var cellEl = document.getElementById('spnUserCell');
        if (cellEl) cellEl.textContent = me.phone || '';
        var mileageEl = document.getElementById('txtCurrentMileage');
        if (mileageEl && me.balance != null)
          mileageEl.textContent = Number(me.balance).toLocaleString() + '원';
      })
      .catch(function() {});
  }

  // ── 구매 팝업 HTML 주입 ──────────────────────────────────────────
  function injectBuyPopup() {
    var dvPopup = document.getElementById('dvPopup');
    if (!dvPopup) return;
    dvPopup.innerHTML = '<div class=inner>'
      + '<div class=title>물품등록정보</div>'
      + '<div class=cont>'
      + '<table class=g_blue_table><colgroup><col width=122><col width=180><col width=122><col width=180></colgroup>'
      + '<tbody><tr><th>카테고리</th><td colspan=3 id=buy_popup_category></td></tr></tbody></table>'
      + '<table class="g_blue_table g_blue_table2"><colgroup><col width=122><col width=180><col width=122><col width=180></colgroup>'
      + '<tbody>'
      + '<tr><th>물품제목</th><td colspan=3 id=buy_popup_title></td></tr>'
      + '<tr><th>거래유형</th><td id=buy_popup_trade_type>일반구매</td><th>구매금액</th><td id=buy_popup_price></td></tr>'
      + '</tbody></table>'
      + '<div class=attention>거래 사고 주의사항</div>'
      + '<ul class=attention_box>'
      + '<li>1. 전달받은 <span class=deco style="color:red">물품은 절대 돌려주지</span> 마세요.</li>'
      + '<li>2. 구매 등록 시 반드시 <span class=deco style="color:red">본인 정보(게임명/서버/캐릭터)를 등록</span>하세요.</li>'
      + '<li class=f_blue3>타인 게임정보 기재 또는, 다른 게임/서버에 구매 신청할 경우 물품신청자에게 불이익이 발생할 수 있습니다.</li>'
      + '</ul>'
      + '<ul class="box6 g_list">'
      + '<li>상대방의 판매 신청 후 10분 이내에 결제를 해주셔야만 거래가 가능합니다.</li>'
      + '<li>단, 즉시구매 등록 물품은 판매신청이 들어오면 바로거래가 가능합니다.</li>'
      + '<li>[물품등록유지기간]<br></li>'
      + '<li class=list_non>등록물품은 7일 후 자동으로 삭제됩니다. (계정거래의 경우 30일)<br></li>'
      + '<li class=list_non>* 팝니다/삽니다 등록물품 모두 포함</li>'
      + '<li class=list_non>단, 부가서비스 이용중인 물품의 경우 잔여 시간 경과 후 자동 삭제</li>'
      + '</ul>'
      + '<div class=last_txt>등록하시려는 물품이 위와 같습니까?</div>'
      + '<div class=g_btn_new>'
      + '<button type=button id=buy_reg_submit>확인</button>'
      + '<button type=button id=buy_cancel_submit>취소</button>'
      + '</div>'
      + '</div></div>';
  }

  // ── 구매 팝업 데이터 채우고 표시 ──────────────────────────────────
  function fillAndShowBuyPopup(data) {
    var dvPopup = document.getElementById('dvPopup');
    if (!dvPopup) return;
    var catEl = document.getElementById('buy_popup_category');
    var titEl = document.getElementById('buy_popup_title');
    var prcEl = document.getElementById('buy_popup_price');
    if (catEl) catEl.textContent = (data.gameName || '') + (data.serverName ? ' > ' + data.serverName : '') + (data.itemCategory ? ' > ' + data.itemCategory : '');
    if (titEl) titEl.textContent = data.title || '';
    if (prcEl) prcEl.textContent = Number(data.price || 0).toLocaleString() + '원';

    // 확인 버튼
    var regBtn = document.getElementById('buy_reg_submit');
    if (regBtn && !regBtn._imBound) {
      regBtn._imBound = true;
      regBtn.addEventListener('click', function() {
        var pid = data.id || '';
        var gc  = data.gameCode || '';
        if (pid) {
          location.href = '/buy/index_view.html?id=' + pid + (gc ? '&gid=' + gc : '');
        } else {
          location.href = '/buy/list.html' + (gc ? '?search_game=' + gc : '');
        }
      });
    }
    // 취소 버튼
    var cancelBtn = document.getElementById('buy_cancel_submit');
    if (cancelBtn && !cancelBtn._imBound) {
      cancelBtn._imBound = true;
      cancelBtn.addEventListener('click', function() {
        dvPopup.classList.remove('im-show');
      });
    }
    dvPopup.classList.remove('sf-hidden');
    dvPopup.classList.add('im-show');
  }

  function init() {
    loadUserTradeInfo();
    injectBuyPopup();
    // 스냅샷에 미리 채워진 폼 값 초기화
    var _inputs = [
      document.getElementById('searchRegGameServer'),
      document.getElementById('searchGameServer'),
      document.getElementById('user_price'),
      document.getElementById('user_title'),
      document.getElementById('buy_title'),
      document.getElementById('user_character')
    ];
    _inputs.forEach(function(el) { if (el) el.value = ''; });
    document.querySelectorAll('.ql-editor').forEach(function(el) { el.innerHTML = '<p><br></p>'; });

    // 스냅샷 JS 이벤트 리스너 완전 제거: cloneNode + id 변경으로 스냅샷 JS 재부착 차단
    (function() {
      var origIds = ['searchRegGameServer', 'searchGameServer'];
      var cleanInp = null;
      for (var _i = 0; _i < origIds.length; _i++) {
        var orig = document.getElementById(origIds[_i]);
        if (orig) {
          var clone = orig.cloneNode(true);
          orig.removeAttribute('id');
          orig.parentNode.replaceChild(clone, orig);
          cleanInp = clone;
          break;
        }
      }
      setupGameSearch(cleanInp);
    })();

    // URL search_game으로 게임 사전 선택 (메이플랜드 등 목록에서 구매등록 클릭 시 게임 유지)
    (function() {
      var sgCode = new URLSearchParams(location.search).get('search_game');
      if (!sgCode) return;
      fetch('/api/games/bycode/' + encodeURIComponent(sgCode), { credentials: 'include' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(g) {
          if (!g || !g.name) return;
          window._IM_sel_game = { id: g.id, code: g.code, name: g.name };
          window._IM_sel_server = null;
          var inp = document.getElementById('searchRegGameServer') || document.getElementById('searchGameServer');
          if (inp) { inp.value = g.name; }
        })
        .catch(function() {});
    })();

    // 캐릭터명 저장 버튼 → "저장되었습니다." 토스트 (캡처 페이즈로 stopPropagation 우회)
    document.addEventListener('click', function(e) {
      var btn = e.target;
      if (btn && btn.classList && btn.classList.contains('btn_name_save')) {
        showToast('저장되었습니다.', true);
      }
    }, true);

    // 판매등록 링크 → /sell/register.html
    document.querySelectorAll('a[href*="/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/sell/') && !h.includes('/sell/list') && !h.includes('/sell/application')) {
        a.href = '/sell/register.html';
        a.addEventListener('click', function(e) {
          e.preventDefault(); location.href = '/sell/register.html';
        });
      }
    });

    // 구매등록 폼 제출 인터셉트
    var form = document.getElementById('frmBuy');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login'; }, 1200);
              return;
            }
            var priceEl = form.querySelector('[name=user_price]');
            var titleEl2 = form.querySelector('[name=user_title],[name=title_name],[name=buy_title]');
            var price = priceEl ? priceEl.value.trim() : '';
            var title2 = titleEl2 ? titleEl2.value.trim() : '';
            var game2 = window._IM_sel_game ? window._IM_sel_game.name : '';
            var server2 = window._IM_sel_server ? window._IM_sel_server.name : '';
            if (!game2) { showToast('게임을 선택해주세요.', false); return; }
            if (!price) { showToast('가격을 입력해주세요.', false); return; }
            if (!title2) { showToast('구매 희망 아이템명을 입력해주세요.', false); return; }
            var qlEl2 = form.querySelector('.ql-editor');
            var quantityLabel2 = window._im_registration_quantity(form);
            if (!quantityLabel2) { showToast('수량과 단위를 올바르게 입력해주세요.', false); return; }
            var description2 = '';
            if (qlEl2) {
              var raw2 = qlEl2.innerText || qlEl2.textContent || '';
              description2 = raw2.trim();
            }
            fetch('/api/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                title: title2,
                price: parseInt(price.replace(/[^0-9]/g, ''), 10),
                gameName: game2,
                serverName: server2,
                category: 'buy',
                quantityLabel: quantityLabel2,
                itemCategory: window._IM_sel_category || '기타',
                sellerName: d.nickname || d.email,
                characterName: (form.querySelector('[name=user_character]') || {}).value || undefined,
                description: description2
              })
            })
            .then(function(r) {
              if (r.ok) {
                return r.json().then(function(rd) {
                  fillAndShowBuyPopup({
                    id: rd.id || '',
                    gameName: game2,
                    serverName: server2,
                    itemCategory: window._IM_sel_category || '',
                    title: title2,
                    price: parseInt(price.replace(/[^0-9]/g, ''), 10),
                    gameCode: window._IM_sel_game ? (window._IM_sel_game.code || '') : ''
                  });
                });
              } else {
                return r.json().then(function(e) { showToast('등록 실패: ' + (e.error || '오류'), false); });
              }
            })
            .catch(function() { showToast('서버 오류가 발생했습니다.', false); });
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── NEW 모드 버튼 (#change_mode data-mode=n) ───────────────────
    var newModeBtn = document.getElementById('change_mode');
    if (newModeBtn && newModeBtn.getAttribute('data-mode') === 'n') {
      newModeBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/buy/new.html';
      }, true);
    }

    // 뒤로가기 / 홈
    var backLinks = document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]');
    backLinks.forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const SELL_NEW_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#8354ff' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function init() {
    // ── 클래식모드 버튼 (#change_mode data-mode=c) → 판매등록 클래식으로 복귀 ──
    var classicBtn = document.getElementById('change_mode');
    if (classicBtn) {
      classicBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/sell/register.html';
      }, true);
    }

    // ── 물품일괄등록 ─────────────────────────────────────────────────
    var batchBtn = document.getElementById('batch_move');
    if (batchBtn) {
      batchBtn.href = '/myroom/batch_goods/index.html';
      batchBtn.addEventListener('click', function(e) {
        e.preventDefault(); location.href = '/myroom/batch_goods/index.html';
      });
    }

    // ── 구매등록 링크 ─────────────────────────────────────────────────
    document.querySelectorAll('a[href*="/buy/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/buy/') && !h.includes('/buy/list') && !h.includes('/buy/application')) {
        a.href = '/buy/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/buy/register.html'; });
      }
    });

    // ── 판매등록 폼 제출 인터셉트 ─────────────────────────────────────
    var form = document.getElementById('frmSell');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login'; }, 1200); return;
            }
            var priceEl = form.querySelector('[name=user_price]');
            if (!priceEl || !priceEl.value.trim()) { showToast('가격을 입력해주세요.', false); return; }
            showToast('판매 등록이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/sell/list.html'; }, 1800);
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const BUY_NEW_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#39A742' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function init() {
    // ── DOM 적응: 판매→구매 UI 전환 ────────────────────────────────
    // 제목 영역 변경
    var titleEl = document.querySelector('.g_title_blue');
    if (titleEl) titleEl.className = titleEl.className.replace('g_title_blue','g_title_green');
    var h2 = document.querySelector('#sell_title h2, .g_title_blue h2, .g_title_green h2');
    if (h2 && h2.textContent.includes('판매')) h2.textContent = h2.textContent.replace('판매등록','구매등록');

    // ── 클래식모드 버튼 → 구매등록 클래식으로 복귀 ─────────────────
    var classicBtn = document.getElementById('change_mode');
    if (classicBtn) {
      classicBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/buy/register.html';
      }, true);
    }

    // ── 판매등록 링크 ─────────────────────────────────────────────────
    document.querySelectorAll('a[href*="/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/sell/') && !h.includes('/sell/list') && !h.includes('/sell/application')) {
        a.href = '/sell/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/sell/register.html'; });
      }
    });

    // ── 폼 제출 인터셉트 (frmSell → 구매등록으로 처리) ───────────────
    var form = document.getElementById('frmSell') || document.getElementById('frmBuy');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login'; }, 1200); return;
            }
            var priceEl = form.querySelector('[name=user_price]');
            if (!priceEl || !priceEl.value.trim()) { showToast('가격을 입력해주세요.', false); return; }
            showToast('구매 등록이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/buy/list.html'; }, 1800);
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const BATCH_GOODS_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function init() {
    // ── 폼 제출 인터셉트 ────────────────────────────────────────────
    var form = document.querySelector('form[action*="batch_goods"]');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        window._IM_auth()
          .then(function(d) {
            if (!d || !d.id) {
              showToast('로그인이 필요합니다.', false);
              setTimeout(function() { try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login'; }, 1200); return;
            }
            var fileEl = document.getElementById('excel_upload');
            showToast('일괄등록이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/sell/list.html'; }, 1800);
          })
          .catch(function() { showToast('오류가 발생했습니다.', false); });
      });
    }

    // ── 파일 업로드 UI (실제 파일 첨부 없이 파일명 표시) ────────────
    var excelInput = document.querySelector('#excel_upload input[type=file]');
    if (excelInput) {
      excelInput.addEventListener('change', function() {
        var status = document.getElementById('excel_status');
        if (status && this.files && this.files[0]) {
          var p = status.querySelector('p') || status;
          p.textContent = '📎 ' + this.files[0].name;
        }
      });
    }

    // ── 판매등록으로 돌아가기 링크 ───────────────────────────────────
    document.querySelectorAll('a[href*="/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (h.includes('/sell/') && !h.includes('/sell/list') && !h.includes('/sell/application')) {
        a.href = '/sell/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/sell/register.html'; });
      }
    });

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const CHARGE_INTERCEPT_SCRIPT = `<script>
(function(){
  var FEE_MAP = {
    kakaopay:    {rate: 0.055, flat: 0,    min: 0},
    naverpay:    {rate: 0.055, flat: 0,    min: 0},
    creditcard:  {rate: 0.055, flat: 0,    min: 0},
    'phone-ars': {rate: 0.195, flat: 0,    min: 0},
    onlyculture: {rate: 0.12,  flat: 0,    min: 0},
    gift24:      {rate: 0,     flat: 0,    min: 0},
    mileage:     {rate: 0.06,  flat: 0,    min: 0},
    mybank:      {rate: 0.02,  flat: 0,    min: 500},
    account:     {rate: 0,     flat: 1000, min: 0},
  };

  // ── 네비게이션 맵 (메뉴 텍스트 키워드 → 충전 URL) ─────────────────────
  // 긴 키워드를 먼저 배치 (부분 매칭 우선순위)
  var NAV_MAP = [
    // 카테고리 버튼 (charge_menu)
    {kw: 'ARS',        url: '/myroom/mileage/charge/charge-phone-ars.html'},
    {kw: '신용카드',   url: '/myroom/mileage/charge/charge-creditcard.html'},
    {kw: '간편결제',   url: '/myroom/mileage/charge/charge-kakaopay.html'},
    {kw: '이달의',       url: '/myroom/mileage/charge/charge-onlyculture.html'},
    {kw: '전용계좌',     url: '/myroom/mileage/charge/charge-account.html'},
    {kw: '매니아 전용',  url: '/myroom/mileage/charge/charge-mileage.html'},
    {kw: '계좌 충전',    url: '/myroom/mileage/charge/charge-mybank.html'},
    {kw: '기타 충전',    url: '/myroom/mileage/charge/charge-gift24.html'},
    // 서브메뉴 버튼 (child_menu_wrapper) — 구체적인 키워드 먼저
    {kw: '카카오페이',   url: '/myroom/mileage/charge/charge-kakaopay.html'},
    {kw: '네이버페이',   url: '/myroom/mileage/charge/charge-naverpay.html'},
    {kw: '토스',         url: '/myroom/mileage/charge/charge-kakaopay.html'},
    {kw: '컬쳐랜드',     url: '/myroom/mileage/charge/charge-onlyculture.html'},
    {kw: '도서문화',     url: '/myroom/mileage/charge/charge-onlyculture.html'},
    {kw: '에그머니',     url: '/myroom/mileage/charge/charge-onlyculture.html'},
    {kw: '스마트문상',   url: '/myroom/mileage/charge/charge-onlyculture.html'},
    {kw: '틴캐시',       url: '/myroom/mileage/charge/charge-onlyculture.html'},
    {kw: '마일리지 상품권', url: '/myroom/mileage/charge/charge-mileage.html'},
    {kw: '이벤트 쿠폰',    url: '/myroom/mileage/charge/charge-mileage.html'},
    {kw: '상품권',       url: '/myroom/mileage/charge/charge-onlyculture.html'},
    {kw: '내통장결제',   url: '/myroom/mileage/charge/charge-mybank.html'},
    {kw: '케이뱅크',     url: '/myroom/mileage/charge/charge-mybank.html'},
    {kw: '자동이체',     url: '/myroom/mileage/charge/charge-mybank.html'},
    {kw: '기프트24',     url: '/myroom/mileage/charge/charge-gift24.html'},
    {kw: 'TCash',        url: '/myroom/mileage/charge/charge-gift24.html'},
    {kw: '모바일팝',     url: '/myroom/mileage/charge/charge-gift24.html'},
    {kw: '모바일티머니', url: '/myroom/mileage/charge/charge-gift24.html'},
    {kw: '카드포인트',   url: '/myroom/mileage/charge/charge-gift24.html'},
  ];

  // 현재 페이지 수수료
  var slug = location.pathname.split('/').pop().replace('.html','').replace('charge-','');
  var fee = FEE_MAP[slug] || {rate: 0, flat: 0, min: 0};
  var curBalance = 0;

  function calcNet(gross) {
    if (!gross) return 0;
    var net = Math.floor(gross * (1 - fee.rate)) - fee.flat;
    if (fee.min > 0 && (gross - Math.floor(gross * fee.rate)) < fee.min) net = gross - fee.min;
    return Math.max(0, net);
  }
  function fmt(n) { return Number(n).toLocaleString('ko-KR'); }

  function updatePriceDisplay(gross) {
    var net = calcNet(gross);
    var sp = document.getElementById('spnPrice');
    var tm = document.getElementById('total_mileage');
    if (sp) sp.textContent = fmt(net);
    if (tm) tm.textContent = fmt(curBalance + net);
  }

  // ── 모든 조상 overflow 강제 해제 (CSS cascade 우회) ──────────────────────
  function fixOverflow(el) {
    while (el && el !== document.body) {
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('clip', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      var h = el.style.height;
      if (h && h !== 'auto' && !h.includes('%')) {
        el.style.setProperty('height', 'auto', 'important');
      }
      el = el.parentElement;
    }
  }

  // ── 충전 UI 동적 생성 및 삽입 ───────────────────────────────────────────
  function buildChargeUI() {
    // 기존 폼에서 금액 옵션 수집
    var amounts = [];
    var radios = document.querySelectorAll('input[name=selectPrice]');
    radios.forEach(function(r) { amounts.push(Number(r.value)); });
    if (!amounts.length) amounts = [5000,10000,20000,30000,50000,100000];

    // #g_POPUP 찾기
    var popup = document.getElementById('g_POPUP');
    if (!popup) return;

    // 기존 #charge_main 숨김 (overflow 문제 있는 영역)
    var cm = document.getElementById('charge_main');
    if (cm) cm.style.setProperty('display', 'none', 'important');
    // 기존 .m_button 숨김
    var oldBtn = document.querySelector('.m_button');
    if (oldBtn) oldBtn.style.setProperty('display', 'none', 'important');

    // overflow 강제 해제
    fixOverflow(popup);

    // 새 충전 패널 생성
    var panel = document.createElement('div');
    panel.id = 'im-charge-panel';
    panel.style.cssText = [
      'display:block', 'width:100%', 'background:#fff',
      'padding:0 20px 40px', 'box-sizing:border-box',
      'border-bottom-left-radius:10px', 'border-bottom-right-radius:10px',
    ].join(';');

    // 충전한도 정보 (기존 mile_detail 복사)
    var mileDetail = cm ? cm.querySelector('.mile_detail') : null;
    if (mileDetail) {
      var infoCopy = mileDetail.cloneNode(true);
      panel.appendChild(infoCopy);
    }

    // 구분선
    var sep = document.createElement('hr');
    sep.style.cssText = 'border:none;border-top:1px solid #edeff2;margin:0';
    panel.appendChild(sep);

    // 금액 선택 헤더
    var amtTitle = document.createElement('p');
    amtTitle.style.cssText = 'font-size:14px;color:#888;margin:16px 0 8px;font-weight:600';
    amtTitle.textContent = '충전금액 선택';
    panel.appendChild(amtTitle);

    // 금액 라디오 그리드
    var grid = document.createElement('ul');
    grid.style.cssText = [
      'display:flex', 'flex-wrap:wrap', 'gap:8px', 'list-style:none',
      'padding:0', 'margin:0 0 20px',
    ].join(';');

    var selectedAmt = amounts[0];
    amounts.forEach(function(amt, i) {
      var li = document.createElement('li');
      li.style.cssText = 'width:calc(33.3% - 6px)';
      var lbl = document.createElement('label');
      lbl.style.cssText = [
        'display:flex', 'align-items:center', 'justify-content:center',
        'border:1px solid #dcdee0', 'border-radius:5px', 'padding:10px 6px',
        'cursor:pointer', 'font-size:15px', 'color:#333', 'gap:6px',
        'user-select:none',
      ].join(';');
      var radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'imSelectPrice';
      radio.value = String(amt);
      radio.style.cssText = 'accent-color:#159EFD;width:15px;height:15px;cursor:pointer';
      if (i === 0) { radio.checked = true; lbl.style.borderColor = '#159EFD'; lbl.style.outline = '1px solid #159EFD'; }
      var txt = document.createTextNode(fmt(amt) + ' 원');
      lbl.appendChild(radio);
      lbl.appendChild(txt);
      li.appendChild(lbl);
      grid.appendChild(li);
    });
    panel.appendChild(grid);

    // 가격 표시 구분선
    var sep2 = document.createElement('hr');
    sep2.style.cssText = 'border:none;border-top:1px solid #edeff2;margin:0 0 16px';
    panel.appendChild(sep2);

    // 보유/실충전/충전후 표시
    var priceBox = document.createElement('div');
    priceBox.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-bottom:20px;font-size:15px;color:#333';

    function makeRow(label, id) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
      var lspan = document.createElement('span');
      lspan.textContent = label;
      lspan.style.cssText = 'font-weight:600;color:#555';
      var rspan = document.createElement('span');
      rspan.id = id;
      rspan.textContent = '0';
      rspan.style.cssText = 'color:#159EFD;font-weight:700';
      var unit = document.createElement('span');
      unit.textContent = ' 원';
      unit.style.color = '#555';
      row.appendChild(lspan);
      var right = document.createElement('span');
      right.appendChild(rspan);
      right.appendChild(unit);
      row.appendChild(right);
      return row;
    }
    priceBox.appendChild(makeRow('보유 마일리지', 'im-my-mileage'));
    priceBox.appendChild(makeRow('실충전 마일리지', 'im-spn-price'));
    priceBox.appendChild(makeRow('충전 후 마일리지', 'im-total-mileage'));
    panel.appendChild(priceBox);

    // 충전하기 버튼
    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;justify-content:center;padding-top:8px';
    var chargeBtn = document.createElement('button');
    chargeBtn.type = 'button';
    chargeBtn.id = 'im-btn-charge';
    chargeBtn.textContent = '충전하기';
    chargeBtn.style.cssText = [
      'width:240px', 'line-height:55px', 'height:55px',
      'background:#159EFD', 'color:#fff', 'border:none',
      'border-radius:10px', 'font-size:18px', 'font-weight:700',
      'cursor:pointer', 'text-align:center',
    ].join(';');
    btnWrap.appendChild(chargeBtn);
    panel.appendChild(btnWrap);

    // popup 뒤에 삽입
    popup.parentNode.insertBefore(panel, popup.nextSibling);

    // ── 라디오 변경 이벤트 ──────────────────────────────────────────────
    function updateUI(gross) {
      var net = calcNet(gross);
      var sp = document.getElementById('im-spn-price');
      var tm = document.getElementById('im-total-mileage');
      if (sp) sp.textContent = fmt(net);
      if (tm) tm.textContent = fmt(curBalance + net);
      // 선택된 라디오 테두리 강조
      grid.querySelectorAll('label').forEach(function(l) {
        var r = l.querySelector('input');
        if (r && r.checked) {
          l.style.borderColor = '#159EFD';
          l.style.outline = '1px solid #159EFD';
        } else {
          l.style.borderColor = '#dcdee0';
          l.style.outline = 'none';
        }
      });
    }
    grid.addEventListener('change', function(e) {
      if (e.target && e.target.name === 'imSelectPrice') {
        updateUI(Number(e.target.value));
      }
    });
    updateUI(selectedAmt);

    // ── 충전하기 버튼 클릭 ─────────────────────────────────────────────
    chargeBtn.addEventListener('click', function() {
      var checked = grid.querySelector('input[name=imSelectPrice]:checked');
      var gross = checked ? Number(checked.value) : 0;
      if (!gross || gross < 1000) { alert('충전 금액을 선택해주세요.'); return; }
      var net = calcNet(gross);
      if (!confirm(fmt(gross) + '원을 충전하시겠습니까?\\n\\n실충전 마일리지: ' + fmt(net) + '원')) return;
      chargeBtn.disabled = true;
      chargeBtn.textContent = '처리중...';
      fetch('/api/wallet/charge', {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({amount: gross, method: slug})
      }).then(function(r){ return r.json(); })
        .then(function(d){
          if (d.error) { alert(d.error); return; }
          curBalance = Number(d.balance || 0);
          var el = document.getElementById('im-my-mileage');
          if (el) el.textContent = fmt(curBalance);
          updateUI(gross);
          alert('충전이 완료되었습니다!\\n현재 마일리지: ' + fmt(curBalance) + '원');
        })
        .catch(function(){ alert('충전 처리 중 오류가 발생했습니다.'); })
        .finally(function(){ chargeBtn.disabled = false; chargeBtn.textContent = '충전하기'; });
    });

    return panel;
  }

  // ── 잔액 로드 후 UI 초기화 ───────────────────────────────────────────────
  var panel = buildChargeUI();

  fetch('/api/wallet', {credentials:'include'})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      if (!d) return;
      curBalance = Number(d.balance || 0);
      var el = document.getElementById('im-my-mileage');
      if (el) el.textContent = fmt(curBalance);
      // 현재 선택된 금액으로 업데이트
      var checked = panel ? panel.querySelector('input[name=imSelectPrice]:checked') : null;
      if (checked) {
        var net = calcNet(Number(checked.value));
        var tm = document.getElementById('im-total-mileage');
        if (tm) tm.textContent = fmt(curBalance + net);
      }
    }).catch(function(){});

  // ── 메뉴 클릭 네비게이션 ─────────────────────────────────────────────────
  // capture phase 위임: <a> 기본 href 이동보다 먼저 가로챔
  function resolveNavUrl(txt) {
    for (var i = 0; i < NAV_MAP.length; i++) {
      if (txt.indexOf(NAV_MAP[i].kw) !== -1) return NAV_MAP[i].url;
    }
    return null;
  }
  function menuClickCapture(e) {
    // 클릭된 요소부터 li까지 텍스트 수집
    var node = e.target;
    while (node && node.tagName !== 'UL') {
      var url = resolveNavUrl(node.textContent || '');
      if (url) {
        e.preventDefault();
        e.stopPropagation();
        location.href = url;
        return;
      }
      if (node.tagName === 'LI') break;
      node = node.parentElement;
    }
  }
  ['#charge_menu', '#child_menu_wrapper'].forEach(function(sel) {
    var el = document.querySelector(sel);
    if (el) el.addEventListener('click', menuClickCapture, true);
  });
})();
</script>`;

const MYROOM_INTERCEPT_SCRIPT = `
<style>
/* 인증 배지 비활성 상태 */
.im-auth-disabled {
  filter: grayscale(100%) opacity(0.38) !important;
  cursor: default !important;
  pointer-events: none !important;
}
</style>
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function applyAuthBadges(authStates) {
    var auth = authStates || {};
    var map = [
      { key: 'excellent', sel: '.cert_excellent_on, .cert_excellent' },
      { key: 'phone',     sel: '.cert_hp_on, .cert_hp' },
      { key: 'email',     sel: '.cert_email_on, .cert_email' },
      { key: 'ipin',      sel: '.cert_ipin_on, .cert_ipin' },
      { key: 'withdraw',  sel: '.cert_account_on, .cert_account' },
    ];
    map.forEach(function(item) {
      var el = document.querySelector(item.sel);
      if (!el) return;
      if (auth[item.key]) {
        el.classList.remove('im-auth-disabled');
      } else {
        el.classList.add('im-auth-disabled');
      }
    });
  }

  function applyGradeBadge(grade) {
    var GRADES = ['regular','bronze','silver','gold','platinum','vip'];
    var GRADE_EN = {regular:'REGULAR',bronze:'BRONZE',silver:'SILVER',gold:'GOLD',platinum:'PLATINUM',vip:'VIP'};
    var GRADE_KO = {regular:'레귤러',bronze:'브론즈',silver:'실버',gold:'골드',platinum:'플래티넘',vip:'VIP'};
    var cls = (grade && GRADES.indexOf(grade) !== -1) ? grade : 'regular';
    var enName = GRADE_EN[cls];
    var koName = GRADE_KO[cls];
    document.querySelectorAll('.credit_mark2').forEach(function(el) {
      GRADES.forEach(function(g) { el.classList.remove('credit_' + GRADE_EN[g]); });
      el.classList.add('credit_' + enName);
      el.textContent = enName;
    });
    document.querySelectorAll('.level_txt').forEach(function(el) {
      GRADES.forEach(function(g) { el.classList.remove('f_' + GRADE_EN[g]); });
      el.classList.add('f_' + enName);
      el.textContent = enName;
    });
    document.querySelectorAll('.level_desc span, .level_desc [class]').forEach(function(el) {
      var fCls = [];
      el.classList.forEach(function(c) { if (c.indexOf('f_') === 0) fCls.push(c); });
      if (!fCls.length) return;
      fCls.forEach(function(c) { el.classList.remove(c); });
      el.classList.add('f_' + enName);
      var txt = el.textContent || '';
      GRADES.forEach(function(g) { txt = txt.replace(GRADE_KO[g], koName); });
      el.textContent = txt;
    });
    document.querySelectorAll('.level_desc > div').forEach(function(div) {
      div.childNodes.forEach(function(node) {
        if (node.nodeType === 3) {
          var t = node.textContent || '';
          GRADES.forEach(function(g) { t = t.replace(GRADE_KO[g], koName); });
          node.textContent = t;
        }
      });
    });
  }

  function applyScore(score) {
    var s = parseInt(score, 10);
    if (isNaN(s)) s = 0;
    var txt = '(' + s + '점)';
    document.querySelectorAll('.level_desc span, .level_desc [class]').forEach(function(el) {
      var hasFCls = false;
      el.classList.forEach(function(c) { if (c.indexOf('f_') === 0) hasFCls = true; });
      if (!hasFCls) return;
      var cur = el.textContent || '';
      el.textContent = cur.replace(/\(\d+점\)/, txt);
    });
  }

  function init() {
    // ── 충전하기 버튼 → 충전 팝업 ─────────────────────────────────────
    document.querySelectorAll('button.mileage_charge_btn,.mileage_charge_btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var w = window.open(
          '/myroom/mileage/charge/charge-kakaopay.html',
          'charge_popup',
          'width=660,height=900,resizable=yes,scrollbars=yes,left=' +
          Math.round((screen.width - 660) / 2) + ',top=' + Math.round((screen.height - 900) / 2)
        );
        if (w) w.focus();
      });
    });

    // ── 내마일리지 / 마일리지 카테고리 링크 → 마이룸 홈 ─────────────────
    document.querySelectorAll('a[href*="my_mileage"]').forEach(function(a) {
      a.href = '/myroom/index.html';
      a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/myroom/index.html'; });
    });

    // ── 마이룸 nav_subject / 상단 GNB 마이룸 링크 강제 처리 ─────────────
    document.querySelectorAll('a.myroom, a[href="/myroom/"], a[href="/myroom"], a[href="/myroom/index.html"]').forEach(function(a) {
      a.href = '/myroom/index.html';
      a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/myroom/index.html'; });
    });

    // ── 사이드 메뉴 마일리지충전 링크 ──────────────────────────────────
    document.querySelectorAll('a[href="javascript:void(0)"]').forEach(function(a) {
      if ((a.textContent||'').trim() === '마일리지충전') {
        a.href = '#';
        a.addEventListener('click', function(e) {
          e.preventDefault();
          var w = window.open(
            '/myroom/mileage/charge/charge-kakaopay.html',
            'charge_popup',
            'width=660,height=900,resizable=yes,scrollbars=yes,left=' +
            Math.round((screen.width - 660) / 2) + ',top=' + Math.round((screen.height - 900) / 2)
          );
          if (w) w.focus();
        });
      }
    });

    // ── 출금하기 버튼 → 출금 신청 폼 페이지 ───────────────────────
    document.querySelectorAll('a[href*="payment_switch"],a.mileage_withdraw_btn').forEach(function(a) {
      a.href = '/myroom/mileage/payment/index.html';
      a.addEventListener('click', function(e) {
        e.preventDefault();
        location.href = '/myroom/mileage/payment/index.html';
      });
    });

    // ── 마이룸 판매관련 카테고리 링크 ────────────────────────────────────
    var SELL_PAGE_MAP = {
      'sell_regist':   '/myroom/sell/sell_regist.html',
      'sell_check':    '/myroom/sell/sell_check.html',
      'sell_pay_wait': '/myroom/sell/sell_pay_wait.html',
      'sell_ing':      '/myroom/sell/sell_ing.html',
    };
    document.querySelectorAll('a[href*="/myroom/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      var matched = null;
      Object.keys(SELL_PAGE_MAP).forEach(function(k) {
        if (h.indexOf(k) !== -1) matched = SELL_PAGE_MAP[k];
      });
      if (matched) {
        var dest = matched;
        a.href = dest;
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = dest; });
      }
    });

    // ── 마이룸 구매관련 카테고리 링크 ────────────────────────────────────
    var BUY_PAGE_MAP = {
      'buy_regist':   '/myroom/buy/buy_regist.html',
      'buy_check':    '/myroom/buy/buy_check.html',
      'buy_pay_wait': '/myroom/buy/buy_pay_wait.html',
      'buy_ing':      '/myroom/buy/buy_ing.html',
    };
    document.querySelectorAll('a[href*="/myroom/buy/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      var matched = null;
      Object.keys(BUY_PAGE_MAP).forEach(function(k) {
        if (h.indexOf(k) !== -1) matched = BUY_PAGE_MAP[k];
      });
      if (matched) {
        var dest = matched;
        a.href = dest;
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = dest; });
      }
    });

    // ── 상단 GNB의 판매등록/구매등록 링크 (/sell/, /buy/ 최상위 경로) ─────
    document.querySelectorAll('a[href*="itemmania.com/sell/"],a[href^="/sell/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (!h.includes('/myroom/') && !h.includes('/sell/list') && !h.includes('/sell/application')) {
        a.href = '/sell/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/sell/register.html'; });
      }
    });
    document.querySelectorAll('a[href*="itemmania.com/buy/"],a[href^="/buy/"]').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      if (!h.includes('/myroom/') && !h.includes('/buy/list') && !h.includes('/buy/application')) {
        a.href = '/buy/register.html';
        a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/buy/register.html'; });
      }
    });

    // ── 일괄등록 링크 ─────────────────────────────────────────────────
    document.querySelectorAll('a[href*="batch_goods"]').forEach(function(a) {
      a.href = '/myroom/batch_goods/index.html';
      a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/myroom/batch_goods/index.html'; });
    });

    // ── 채팅 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href*="/myroom/chat"]').forEach(function(a) {
      a.href = '/myroom/chat/list.html';
      a.addEventListener('click', function(e) { e.preventDefault(); location.href = '/myroom/chat/list.html'; });
    });

    // ── 홈 링크 ──────────────────────────────────────────────────────
    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });

    // ── 마이룸에 실제 사용자 정보 표시 ────────────────────────────────
    window._IM_auth()
      .then(function(d) {
        if (!d) return;
        var nick = d.nickname || d.email || '';

        // 닉네임: level_desc 안의 텍스트 노드 교체 ("OOO 회원님의..." 형태)
        var levelDesc = document.querySelector('.level_desc > div');
        if (levelDesc) {
          levelDesc.childNodes.forEach(function(node) {
            if (node.nodeType === 3 && node.textContent && node.textContent.includes('회원님의')) {
              node.textContent = node.textContent.replace(/^[^\s]+/, nick);
            }
          });
        }
        // 혹시 다른 닉네임 셀렉터도 갱신
        document.querySelectorAll('.mr_user_name,.user_name,.nick_name').forEach(function(el) {
          if (el.textContent.trim()) el.textContent = nick;
        });

        // 쿠폰·포인트 값 초기화 (스냅샷에 다른 유저 값이 박혀 있음)
        document.querySelectorAll('.coupon_result').forEach(function(el) { el.textContent = '0'; });

        // 잔액 표시: 즉시 + MutationObserver + setTimeout 재적용
        fetch('/api/wallet', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(b) {
            if (!b) return;
            var cachedBalance = b.balance;
            var _applying = false;
            var applyBalance = function() {
              _applying = true;
              if (typeof window._IM_updateBalance === 'function') {
                window._IM_updateBalance(cachedBalance);
              }
              setTimeout(function() { _applying = false; }, 80);
            };
            applyBalance();
            setTimeout(applyBalance, 300);
            setTimeout(applyBalance, 800);
            setTimeout(applyBalance, 2000);
            setTimeout(applyBalance, 4000);
            // MutationObserver: 스냅샷 JS가 덮어쓰면 즉시 재적용
            var mileageTxt = document.querySelector('.mr_user_mileage_txt');
            if (mileageTxt && typeof MutationObserver !== 'undefined') {
              var obs = new MutationObserver(function() {
                if (!_applying) applyBalance();
              });
              obs.observe(mileageTxt, { childList: true, characterData: true, subtree: true });
              setTimeout(function() { obs.disconnect(); }, 6000);
            }
          });

        // 인증 배지 상태 반영
        applyAuthBadges(d.authStates);

        // 신용등급 배지 반영 — 스냅샷 JS 덮어쓰기 대비 재시도
        (function(g) {
          applyGradeBadge(g);
          setTimeout(function() { applyGradeBadge(g); }, 300);
          setTimeout(function() { applyGradeBadge(g); }, 900);
          setTimeout(function() { applyGradeBadge(g); }, 2500);
        })(d.grade);

        // 신용점수 반영
        (function(sc) {
          applyScore(sc);
          setTimeout(function() { applyScore(sc); }, 300);
          setTimeout(function() { applyScore(sc); }, 900);
          setTimeout(function() { applyScore(sc); }, 2500);
        })(d.creditScore != null ? d.creditScore : 0);

        // ── 나의 거래 현황 수치 반영 ───────────────────────────────────
        fetch('/api/products/my/stats', { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(s) {
            if (!s) return;
            var set = function(sel, val) {
              var el = document.querySelector(sel);
              if (el) el.textContent = String(val || 0);
            };
            // 판매
            set('.sell_result.trade_result a', s.sellTotal);
            set('.sell_pay_wait_result.trade_result2 a', s.sellPending);
            set('.sell_ing_title.trade_result2 a', s.sellActive);
            // 구매
            set('.buy_result.trade_result a', s.buyTotal);
            set('.buy_pay_wait_result.trade_result2 a', s.buyPending);
            set('.buy_ing_title.trade_result2 a', s.buyProcessing);
          })
          .catch(function() {});

        // ── 실제 주문 내역 표시 ────────────────────────────────────────
        Promise.all([
          fetch('/api/orders', { credentials: 'include' }).then(function(r) { if(!r.ok)throw new Error('orders');return r.json(); }),
          fetch('/api/chat/rooms?includeDismissed=1', { credentials: 'include' }).then(function(r) { if(!r.ok)throw new Error('rooms');return r.json(); })
        ])
          .then(function(data) {
            var orders=data[0]||[],rooms=data[1]||[];
            rooms.filter(function(r){return !r.orderId&&r.productId&&['pending','active','handover'].includes(r.status)}).forEach(function(r){
              orders.push({id:r.id,roomId:r.id,buyerId:r.buyerId,sellerId:r.sellerId,productId:r.productId,
                productTitle:r.productTitle,gameName:r.gameName,amount:r.productPrice,status:'processing',createdAt:r.createdAt});
            });
            return orders.sort(function(a,b){var aa=['pending','processing','shipped'].includes(a.status),bb=['pending','processing','shipped'].includes(b.status);return Number(bb)-Number(aa)||new Date(b.createdAt)-new Date(a.createdAt)});
          })
          .then(function(orders) {
            orders = orders || [];
            var fmt = function(n) { return (n||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
            var statusLabel = function(s, selling) {
              var m = { pending: selling?'입금대기':'입금예정', processing: selling?'판매중':'구매중', shipped: '발송완료', completed: '완료', cancelled: '취소' };
              return m[s] || s;
            };

            // 구매 내역 (구매자인 경우)
            var buyTbody = document.querySelector('tr.tbl_buy_area');
            if (buyTbody && orders.length > 0) {
              var parent = buyTbody.parentNode;
              buyTbody.remove();
              orders.slice(0, 5).forEach(function(o) {
                var dt = new Date(o.createdAt);
                var dateStr = (dt.getMonth()+1) + '/' + dt.getDate();
                var tr = document.createElement('tr');
                tr.innerHTML =
                  '<td><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" style="width:40px;height:40px;object-fit:cover;border-radius:4px" alt></td>' +
                  '<td>' + (Number(o.sellerId)===Number(d.id)?'판매':'구매') + '</td>' +
                  '<td>' + String(o.gameName || '게임').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</td>' +
                  '<td style="text-align:left">' +
                    '<a href="/myroom/' + (Number(o.sellerId)===Number(d.id)?'sell/sell_ing.html':'buy/buy_ing.html') + (o.roomId?'?roomId='+o.roomId:'?orderId='+o.id) + '" style="font-weight:600;color:#222">' + String(o.productTitle||'').substring(0,30).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</a>' +
                    '<br><small style="color:#888">' + (o.roomId?'채팅방 ':'거래번호 ') + o.id + '</small>' +
                  '</td>' +
                  '<td style="font-weight:700;color:#e53e3e">' + fmt(o.amount) + '원</td>' +
                  '<td><span style="padding:4px 10px;border-radius:20px;font-size:12px;background:' + (o.status==='completed'?'#e8f5e9;color:#2e7d32':o.status==='cancelled'?'#ffebee;color:#c62828':'#e3f2fd;color:#1565c0') + '">' + statusLabel(o.status,Number(o.sellerId)===Number(d.id)) + '</span></td>' +
                  '<td>' + dateStr + '</td>';
                if (parent) parent.appendChild(tr);
              });

              // Counts come from the shared server-side trade query above.
            } else if (buyTbody && orders.length === 0) {
              buyTbody.querySelector('td').textContent = '구매 내역이 없습니다.';
            }
          })
          .catch(function() {});
      });
  }

  // 어드민에서 등급 변경 시 SSE → im:grade CustomEvent → 마이룸 실시간 반영
  window.addEventListener('im:grade', function(e) {
    var grade = e.detail && e.detail.grade;
    applyGradeBadge(grade);
    setTimeout(function() { applyGradeBadge(grade); }, 300);
    setTimeout(function() { applyGradeBadge(grade); }, 900);
    setTimeout(function() { applyGradeBadge(grade); }, 2500);
  });

  // 어드민에서 신용점수 변경 시 SSE → im:credit_score CustomEvent → 마이룸 실시간 반영
  window.addEventListener('im:credit_score', function(e) {
    var score = e.detail && e.detail.score != null ? e.detail.score : 0;
    applyScore(score);
    setTimeout(function() { applyScore(score); }, 300);
    setTimeout(function() { applyScore(score); }, 900);
    setTimeout(function() { applyScore(score); }, 2500);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const PAYMENT_INDEX_INTERCEPT_SCRIPT = `
<script>
(function() {
  var BANKS = ['KB국민은행','신한은행','우리은행','하나은행','IBK기업은행','NH농협은행',
    'SC제일은행','씨티은행','대구은행','부산은행','광주은행','경남은행','전북은행',
    '제주은행','수협은행','우체국','새마을금고','신협','저축은행','카카오뱅크','토스뱅크','케이뱅크'];

  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) { return r.json(); }).catch(function() { return {}; });
  }

  function fixTabs() {
    var map = {
      'index.html': '/myroom/mileage/payment/index.html',
      'payment_phone.html': '/myroom/mileage/payment/payment_phone.html',
      'payment_list.html': '/myroom/mileage/payment/payment_list.html',
      'payment_phone_list.html': '/myroom/mileage/payment/payment_phone_list.html',
      'payment_switch.html': '/myroom/mileage/payment/index.html'
    };
    document.querySelectorAll('a').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      var keys = Object.keys(map);
      for (var i = 0; i < keys.length; i++) {
        if (h.includes(keys[i])) {
          var dest = map[keys[i]];
          a.href = dest;
          a.addEventListener('click', function(dest2) { return function(e) { e.preventDefault(); location.href = dest2; }; }(dest), true);
          break;
        }
      }
    });
  }

  function init() {
    fixTabs();

    // 내 계좌정보 섹션 → 은행 입력 폼으로 교체
    var tables = document.querySelectorAll('table.table_form');
    if (tables.length > 0) {
      var tbody0 = tables[0].querySelector('tbody');
      if (tbody0) {
        var bankOpts = '<option value="">은행을 선택하세요</option>'
          + BANKS.map(function(b) { return '<option value="' + b + '">' + b + '</option>'; }).join('');
        tbody0.innerHTML =
          '<tr><th style="width:120px">은행 선택</th><td>'
          + '<select id="im_bank_sel" class="g_select" style="max-width:280px;width:100%">' + bankOpts + '</select>'
          + '</td></tr>'
          + '<tr><th>계좌번호</th><td>'
          + '<input type="text" id="im_acc_num" class="g_text_new" placeholder="숫자만 입력하세요" maxlength="30" style="max-width:280px;width:100%">'
          + '</td></tr>'
          + '<tr><th>예금주</th><td>'
          + '<input type="text" id="im_acc_holder" class="g_text_new" placeholder="예금주명" maxlength="30" style="max-width:200px;width:100%">'
          + '</td></tr>';
      }
    }

    // 잔액 조회
    var balance = 0;
    api('GET', '/wallet').then(function(d) {
      balance = d.balance || 0;
      var el = document.getElementById('mileage_total');
      if (el) el.textContent = fmt(balance) + ' ';
      updateNet();
    });

    function updateNet() {
      var amtEl = document.getElementById('mileage');
      var netEl = document.getElementById('spnPayment_mileage');
      var chargeEl = document.getElementById('spnPayment_charge');
      var btn = document.getElementById('payment_btn');
      var v = amtEl ? Number(amtEl.value.replace(/,/g, '')) : 0;
      if (netEl) netEl.textContent = fmt(v);
      if (chargeEl) chargeEl.textContent = '(출금 수수료 : 0원)';
      if (btn) btn.disabled = !(v >= 1000 && v <= balance);
    }

    var mileageEl = document.getElementById('mileage');
    if (mileageEl) {
      mileageEl.addEventListener('input', updateNet);
      mileageEl.addEventListener('keyup', updateNet);
    }

    var allBtn = document.getElementById('add_all_mileage');
    if (allBtn) allBtn.addEventListener('click', function() {
      var el = document.getElementById('mileage');
      if (el) { el.value = String(balance); updateNet(); }
    });

    // 폼 제출 인터셉트
    var form = document.getElementById('frmPayment');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        doWithdraw();
      });
    }

    var payBtn = document.getElementById('payment_btn');
    if (payBtn) {
      payBtn.addEventListener('click', function(e) {
        e.preventDefault();
        doWithdraw();
      });
    }

    function doWithdraw() {
      var bankEl = document.getElementById('im_bank_sel');
      var numEl = document.getElementById('im_acc_num');
      var holderEl = document.getElementById('im_acc_holder');
      var amtEl = document.getElementById('mileage');
      var bankName = bankEl ? bankEl.value : '';
      var accountNumber = numEl ? numEl.value.replace(/\\s/g, '') : '';
      var accountHolder = holderEl ? holderEl.value.trim() : '';
      var amount = amtEl ? Number(amtEl.value.replace(/,/g, '')) : 0;
      if (!bankName) { showToast('은행을 선택해주세요.', false); return; }
      if (!accountNumber) { showToast('계좌번호를 입력해주세요.', false); return; }
      if (!accountHolder) { showToast('예금주를 입력해주세요.', false); return; }
      if (!amount || amount < 1000) { showToast('최소 1,000원 이상 출금하세요.', false); return; }
      if (amount > balance) { showToast('잔액이 부족합니다.', false); return; }
      var btn = document.getElementById('payment_btn');
      if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }
      api('POST', '/wallet/withdraw', { method: 'bank', bankName: bankName, accountNumber: accountNumber, accountHolder: accountHolder, amount: amount })
        .then(function(d) {
          if (d.error) {
            showToast(d.error, false);
            if (btn) { btn.disabled = false; btn.textContent = '마일리지 출금하기'; }
          } else {
            showToast('출금 신청이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/myroom/mileage/payment/payment_list.html'; }, 1500);
          }
        }).catch(function() {
          showToast('오류가 발생했습니다.', false);
          if (btn) { btn.disabled = false; btn.textContent = '마일리지 출금하기'; }
        });
    }

    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const PAYMENT_PHONE_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) { return r.json(); }).catch(function() { return {}; });
  }

  function fixTabs() {
    var map = {
      'index.html': '/myroom/mileage/payment/index.html',
      'payment_phone.html': '/myroom/mileage/payment/payment_phone.html',
      'payment_list.html': '/myroom/mileage/payment/payment_list.html',
      'payment_phone_list.html': '/myroom/mileage/payment/payment_phone_list.html',
      'payment_switch.html': '/myroom/mileage/payment/index.html'
    };
    document.querySelectorAll('a').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      var keys = Object.keys(map);
      for (var i = 0; i < keys.length; i++) {
        if (h.includes(keys[i])) {
          var dest = map[keys[i]];
          a.href = dest;
          a.addEventListener('click', function(dest2) { return function(e) { e.preventDefault(); location.href = dest2; }; }(dest), true);
          break;
        }
      }
    });
  }

  function init() {
    fixTabs();

    // 휴대폰번호 섹션 → 입력 폼으로 교체
    var tables = document.querySelectorAll('table.table_form');
    if (tables.length > 0) {
      var tbody0 = tables[0].querySelector('tbody');
      if (tbody0) {
        tbody0.innerHTML =
          '<tr><th style="width:120px">휴대폰번호</th><td>'
          + '<input type="text" id="im_phone_num" class="g_text_new" placeholder="010-0000-0000" maxlength="13" style="max-width:200px;width:100%">'
          + '</td></tr>';
      }
    }

    // 잔액 조회
    var balance = 0;
    api('GET', '/wallet').then(function(d) {
      balance = d.balance || 0;
      var el = document.getElementById('mileage_total');
      if (el) el.textContent = fmt(balance) + ' ';
      updateNet();
    });

    function updateNet() {
      var amtEl = document.getElementById('mileage');
      var netEl = document.getElementById('spnPayment_mileage');
      var chargeEl = document.getElementById('spnPayment_charge');
      var btn = document.getElementById('payment_btn');
      var v = amtEl ? Number(amtEl.value.replace(/,/g, '')) : 0;
      if (netEl) netEl.textContent = fmt(v);
      if (chargeEl) chargeEl.textContent = '(출금 수수료 : 0원)';
      if (btn) btn.disabled = !(v >= 1000 && v <= balance);
    }

    var mileageEl = document.getElementById('mileage');
    if (mileageEl) {
      mileageEl.addEventListener('input', updateNet);
      mileageEl.addEventListener('keyup', updateNet);
    }

    var allBtn = document.getElementById('add_all_mileage');
    if (allBtn) allBtn.addEventListener('click', function() {
      var el = document.getElementById('mileage');
      if (el) { el.value = String(balance); updateNet(); }
    });

    function doWithdraw() {
      var phoneEl = document.getElementById('im_phone_num');
      var amtEl = document.getElementById('mileage');
      var phone = phoneEl ? phoneEl.value.replace(/\\D/g, '') : '';
      var amount = amtEl ? Number(amtEl.value.replace(/,/g, '')) : 0;
      if (!phone || phone.length < 10 || phone.length > 11) {
        showToast('올바른 휴대폰번호를 입력해주세요.', false); return;
      }
      if (!amount || amount < 1000) { showToast('최소 1,000원 이상 출금하세요.', false); return; }
      if (amount > balance) { showToast('잔액이 부족합니다.', false); return; }
      var btn = document.getElementById('payment_btn');
      if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }
      api('POST', '/wallet/withdraw', { method: 'phone', phoneNumber: phone, amount: amount })
        .then(function(d) {
          if (d.error) {
            showToast(d.error, false);
            if (btn) { btn.disabled = false; btn.textContent = '휴대폰번호 출금하기'; }
          } else {
            showToast('출금 신청이 완료되었습니다!', true);
            setTimeout(function() { location.href = '/myroom/mileage/payment/payment_phone_list.html'; }, 1500);
          }
        }).catch(function() {
          showToast('오류가 발생했습니다.', false);
          if (btn) { btn.disabled = false; btn.textContent = '휴대폰번호 출금하기'; }
        });
    }

    var form = document.getElementById('payment');
    if (form) form.addEventListener('submit', function(e) { e.preventDefault(); doWithdraw(); });

    var payBtn = document.getElementById('payment_btn');
    if (payBtn) payBtn.addEventListener('click', function(e) { e.preventDefault(); doWithdraw(); });

    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const PAYMENT_LIST_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) { return r.json(); }).catch(function() { return {}; });
  }

  function fmtDate(s) {
    if (!s) return '-';
    var d = new Date(s);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
      + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  function statusBadge(status) {
    var map = { pending: ['처리중','#f6a623'], approved: ['완료','#0070d2'], rejected: ['반려','#e53e3e'] };
    var info = map[status] || ['알수없음','#888'];
    return '<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;color:#fff;background:' + info[1] + '">' + info[0] + '</span>';
  }

  function fixTabs() {
    var map = {
      'index.html': '/myroom/mileage/payment/index.html',
      'payment_phone.html': '/myroom/mileage/payment/payment_phone.html',
      'payment_list.html': '/myroom/mileage/payment/payment_list.html',
      'payment_phone_list.html': '/myroom/mileage/payment/payment_phone_list.html',
      'payment_switch.html': '/myroom/mileage/payment/index.html'
    };
    document.querySelectorAll('a').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      var keys = Object.keys(map);
      for (var i = 0; i < keys.length; i++) {
        if (h.includes(keys[i])) {
          var dest = map[keys[i]];
          a.href = dest;
          a.addEventListener('click', function(dest2) { return function(e) { e.preventDefault(); location.href = dest2; }; }(dest), true);
          break;
        }
      }
    });
  }

  function renderList(list, tbody) {
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty_item" style="text-align:center;padding:30px;color:#888">출금 내역이 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = '<tr style="background:#f8f9fa;font-weight:600;font-size:13px">'
      + '<td style="padding:8px 12px;text-align:center">신청일시</td>'
      + '<td style="padding:8px 12px;text-align:center">은행명</td>'
      + '<td style="padding:8px 12px;text-align:center">계좌번호 / 예금주</td>'
      + '<td style="padding:8px 12px;text-align:center">출금금액</td>'
      + '<td style="padding:8px 12px;text-align:center">상태</td>'
      + '</tr>'
      + list.map(function(w) {
        var cancelBtn = w.status === 'pending'
          ? '<br><button class="btn_cancel_w" data-id="' + w.id + '" style="margin-top:4px;padding:3px 10px;font-size:12px;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#fff">취소</button>'
          : '';
        return '<tr style="border-bottom:1px solid #eee">'
          + '<td style="padding:8px 12px;text-align:center;font-size:13px">' + fmtDate(w.createdAt) + '</td>'
          + '<td style="padding:8px 12px;text-align:center">' + (w.bankName || '-') + '</td>'
          + '<td style="padding:8px 12px;text-align:center;font-size:13px">' + (w.accountNumber || '-') + '<br><span style="color:#888;font-size:12px">' + (w.accountHolder || '') + '</span></td>'
          + '<td style="padding:8px 12px;text-align:right;font-weight:600">' + fmt(w.amount) + '원</td>'
          + '<td style="padding:8px 12px;text-align:center">' + statusBadge(w.status) + cancelBtn + '</td>'
          + '</tr>';
      }).join('');

    tbody.querySelectorAll('.btn_cancel_w').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        if (!confirm('출금을 취소하시겠습니까? 마일리지가 즉시 반환됩니다.')) return;
        btn.disabled = true;
        api('DELETE', '/wallet/withdrawals/' + id)
          .then(function(d) {
            if (d.ok) { showToast('출금이 취소되었습니다.', true); setTimeout(function() { location.reload(); }, 1000); }
            else { showToast(d.error || '오류가 발생했습니다.', false); btn.disabled = false; }
          });
      });
    });
  }

  function init() {
    fixTabs();

    // 출금 내역 로드
    var tbody = document.querySelector('tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#888">로딩 중...</td></tr>';

    api('GET', '/wallet/withdrawals?method=bank').then(function(list) {
      if (!tbody) {
        tbody = document.querySelector('tbody');
      }
      if (tbody) renderList(Array.isArray(list) ? list : [], tbody);
    });

    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const PAYMENT_PHONE_LIST_INTERCEPT_SCRIPT = `
<script>
(function() {
  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;'
      + 'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;'
      + 'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function fmt(n) { return Number(n || 0).toLocaleString('ko-KR'); }

  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) { return r.json(); }).catch(function() { return {}; });
  }

  function fmtDate(s) {
    if (!s) return '-';
    var d = new Date(s);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
      + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  function fmtPhone(p) {
    if (!p) return '-';
    var n = p.replace(/\\D/g, '');
    if (n.length === 11) return n.slice(0,3) + '-' + n.slice(3,7) + '-' + n.slice(7);
    if (n.length === 10) return n.slice(0,3) + '-' + n.slice(3,6) + '-' + n.slice(6);
    return p;
  }

  function statusBadge(status) {
    var map = { pending: ['처리중','#f6a623'], approved: ['완료','#0070d2'], rejected: ['반려','#e53e3e'] };
    var info = map[status] || ['알수없음','#888'];
    return '<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;color:#fff;background:' + info[1] + '">' + info[0] + '</span>';
  }

  function fixTabs() {
    var map = {
      'index.html': '/myroom/mileage/payment/index.html',
      'payment_phone.html': '/myroom/mileage/payment/payment_phone.html',
      'payment_list.html': '/myroom/mileage/payment/payment_list.html',
      'payment_phone_list.html': '/myroom/mileage/payment/payment_phone_list.html',
      'payment_switch.html': '/myroom/mileage/payment/index.html'
    };
    document.querySelectorAll('a').forEach(function(a) {
      var h = a.getAttribute('href') || '';
      var keys = Object.keys(map);
      for (var i = 0; i < keys.length; i++) {
        if (h.includes(keys[i])) {
          var dest = map[keys[i]];
          a.href = dest;
          a.addEventListener('click', function(dest2) { return function(e) { e.preventDefault(); location.href = dest2; }; }(dest), true);
          break;
        }
      }
    });
  }

  function renderList(list, tbody) {
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty_item" style="text-align:center;padding:30px;color:#888">출금 내역이 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = '<tr style="background:#f8f9fa;font-weight:600;font-size:13px">'
      + '<td style="padding:8px 12px;text-align:center">신청일시</td>'
      + '<td style="padding:8px 12px;text-align:center">휴대폰번호</td>'
      + '<td style="padding:8px 12px;text-align:center">출금금액</td>'
      + '<td style="padding:8px 12px;text-align:center">상태</td>'
      + '<td style="padding:8px 12px;text-align:center">처리메모</td>'
      + '<td style="padding:8px 12px;text-align:center">취소</td>'
      + '</tr>'
      + list.map(function(w) {
        var cancelCell = w.status === 'pending'
          ? '<button class="btn_cancel_w" data-id="' + w.id + '" style="padding:3px 10px;font-size:12px;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#fff">취소</button>'
          : '-';
        return '<tr style="border-bottom:1px solid #eee">'
          + '<td style="padding:8px 12px;text-align:center;font-size:13px">' + fmtDate(w.createdAt) + '</td>'
          + '<td style="padding:8px 12px;text-align:center">' + fmtPhone(w.phoneNumber) + '</td>'
          + '<td style="padding:8px 12px;text-align:right;font-weight:600">' + fmt(w.amount) + '원</td>'
          + '<td style="padding:8px 12px;text-align:center">' + statusBadge(w.status) + '</td>'
          + '<td style="padding:8px 12px;text-align:center;font-size:12px;color:#666">' + (w.adminNote || '-') + '</td>'
          + '<td style="padding:8px 12px;text-align:center">' + cancelCell + '</td>'
          + '</tr>';
      }).join('');

    tbody.querySelectorAll('.btn_cancel_w').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        if (!confirm('출금을 취소하시겠습니까? 마일리지가 즉시 반환됩니다.')) return;
        btn.disabled = true;
        api('DELETE', '/wallet/withdrawals/' + id)
          .then(function(d) {
            if (d.ok) { showToast('출금이 취소되었습니다.', true); setTimeout(function() { location.reload(); }, 1000); }
            else { showToast(d.error || '오류가 발생했습니다.', false); btn.disabled = false; }
          });
      });
    });
  }

  function init() {
    fixTabs();

    var tbody = document.querySelector('tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#888">로딩 중...</td></tr>';

    api('GET', '/wallet/withdrawals?method=phone').then(function(list) {
      if (!tbody) tbody = document.querySelector('tbody');
      if (tbody) renderList(Array.isArray(list) ? list : [], tbody);
    });

    document.querySelectorAll('a[href="/"],a[href="https://www.itemmania.com/"]')
      .forEach(function(a) { a.href = '/'; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>
`;

const CHAT_NEW_INTERCEPT_SCRIPT = `
<style>
/* ── 채팅창 반응형 오버라이드 ── */
.popup_content{min-width:0!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;}
.chat_room{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:hidden!important;}
.chat_info_wrap{box-sizing:border-box!important;min-width:0!important;}
.chat_content_wrap{flex:1 1 auto!important;width:calc(100% - 210px)!important;min-width:0!important;box-sizing:border-box!important;}
.chat_area,.chat_content{min-width:0!important;box-sizing:border-box!important;}
/* ── 사이드바 레이아웃: 상단 버튼5개 / 하단 인계하기+거래취소+거래금액 ── */
.chat_menu_area{justify-content:flex-start!important;width:210px!important;flex:0 0 210px!important;min-width:0!important;box-sizing:border-box!important;padding:16px 12px!important;}
.chat_menu_area .chat_menu,.chat_menu_area>div{width:100%!important;min-width:0!important;box-sizing:border-box!important;}
.chat_menu_area button,.trade_price_change{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;}
.chat_user .credit_mark_new{display:none!important;}
.chat_menu_area>div:last-child{margin-top:auto!important;}
@media(max-width:780px){
  html,body{overflow-x:hidden!important;}
  .popup_content{width:100%!important;min-width:0!important;overflow-x:hidden!important;}
  .chat_room{flex-direction:column!important;height:auto!important;min-height:100vh!important;}
  .chat_content_wrap{width:100%!important;min-width:0!important;flex:1!important;height:auto!important;min-height:60vh!important;}
  .chat_area{width:100%!important;min-width:0!important;height:auto!important;}
  .chat_content{width:100%!important;min-width:0!important;}
  .chat_content_list{height:40vh!important;min-height:200px!important;}
  .chat_menu_area{width:100%!important;min-width:0!important;flex:0 0 auto!important;display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;gap:6px!important;padding:8px!important;box-sizing:border-box!important;}
  .chat_menu_area .chat_menu{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;gap:6px!important;width:100%!important;}
  .chat_menu_area .chat_menu button{flex:1!important;min-width:80px!important;white-space:nowrap!important;}
  .chat_menu_area>div{width:100%!important;}
  .trade_price_change{width:100%!important;box-sizing:border-box!important;}
}
@media(max-width:500px){
  .chat_info_wrap{flex-wrap:wrap!important;}
  .chat_info{flex-wrap:wrap!important;}
  .chat_content_list{height:35vh!important;}
}
</style>
<script>
(function() {
  ${TRADE_CHAT_COMPOSER_SCRIPT}
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(data) {
        data._ok = r.ok;
        data._status = r.status;
        return data;
      });
    }).catch(function(){ return { _ok:false, error:'요청을 처리하지 못했습니다.' }; });
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit', hour12:false }).format(d) : '';
  }
  function formatMileage(value) {
    var amount = Number(value);
    return (Number.isFinite(amount) ? amount : 0).toLocaleString('ko-KR');
  }
  function orderlessCompletionPrompt(room) {
    var amount = Number(room && room.productPrice);
    if (!Number.isFinite(amount) || amount < 0) amount = 0;
    return '거래완료(인수확인) 처리하시겠습니까?\\n\\n구매자 마일리지에서 상품 금액 ' + formatMileage(amount) +
      '원이 차감되고, 수수료 없이 ' + formatMileage(amount) + '원 전액이 판매자에게 지급됩니다.';
  }

  var STATUS_LABEL = { pending:'거래대기', active:'거래중', handover:'인계완료(인수대기)', ended:'거래종료', cancelled:'거래취소', rejected:'거래불가' };
  var stateTextEl = document.getElementById('trade_state_text');
  if (stateTextEl) stateTextEl.style.cssText += ';width:auto;min-width:80px;max-width:160px;white-space:normal;line-height:1.3;padding:4px 10px;text-align:center;word-break:keep-all;';
  var roomId = null;
  var myId = null;
  var lastMsgId = 0;
  var pollTimer = null;
  var currentRoom = null;
  var chatEvents = null;
  var lastMessageDay = '';
  function showChatConnection(connected) {
    var pill = document.querySelector('.chat-connection-state');
    if (pill) {
      pill.textContent = connected ? '접속중' : '연결중';
      pill.classList.toggle('connected', connected);
    }
  }

  function refreshWallet() {
    return fetch('/api/wallet', { credentials: 'include', cache: 'no-store' })
      .then(function(response) {
        if (!response.ok) throw new Error('마일리지 잔액을 새로고침하지 못했습니다.');
        return response.json();
      })
      .then(function(data) {
        var balance = Number(data && data.balance);
        if (!Number.isFinite(balance)) throw new Error('마일리지 잔액 응답을 확인할 수 없습니다.');
        if (typeof window._IM_updateBalance === 'function') window._IM_updateBalance(balance);
      });
  }

  function refreshAfterCompletion() {
    loadMessages();
    refreshWallet().catch(function() {
      showTradeError('거래는 완료되었지만 마일리지 잔액을 새로고침하지 못했습니다.');
    });
  }

  function canHandoverRoom(room) {
    return !!(room && room.sellerId === myId && (room.status === 'pending' || room.status === 'active') &&
      (!room.orderId || room.orderStatus === 'pending'));
  }

  function canConfirmRoom(room) {
    return !!(room && room.buyerId === myId && room.status === 'handover' &&
      (!room.orderId || room.orderStatus === 'shipped'));
  }

   function showTradeError(message) {
     alert(message || '거래 상태를 변경하지 못했습니다.');
   }

   function updateTradeActions(room) {
    currentRoom = room || currentRoom;
    room = currentRoom;
    if (!room) return;
    var handover = document.getElementById('_im_handover_btn');
    if (handover) {
       handover.disabled = !canHandoverRoom(room) || !!handover._busy;
      handover.style.opacity = handover.disabled ? '0.5' : '';
    }
    var confirmReceipt = document.getElementById('trade_ing');
    if (confirmReceipt) {
      confirmReceipt.textContent = room.status === 'ended' ? '거래완료' : '인수하기';
       var canConfirm = canConfirmRoom(room);
      confirmReceipt.style.display = isBuyerChat ? '' : 'none';
      confirmReceipt.disabled = !canConfirm;
      confirmReceipt.style.opacity = confirmReceipt.disabled ? '0.45' : '';
    }
  }

  function appendMessage(m) {
    var list = document.getElementById('chat_content_list');
    if (!list) return;
    if (m.id && m.id <= lastMsgId) return;
    if (m.id) lastMsgId = Math.max(lastMsgId, m.id);
    var isMe = (m.senderId === myId);
    var hhmm = fmtTime(m.createdAt);
    var messageDate = new Date(m.createdAt);
    if (Number.isFinite(messageDate.getTime())) {
      var day = new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', year:'numeric', month:'numeric', day:'numeric' }).format(messageDate);
      if (day !== lastMessageDay) {
        var dateEl = document.createElement('div');
        dateEl.className = 'date';
        var dateText = document.createElement('span');
        dateText.textContent = day;
        dateEl.appendChild(dateText);
        list.appendChild(dateEl);
        lastMessageDay = day;
      }
    }
    var div = document.createElement('div');
    div.className = 'chat_item ' + (isMe ? 'me' : 'another');
    var isImg = m.content && m.content.startsWith('[img]');
    var msgHtml;
    if (isImg) {
      var imgUrl = m.content.slice(5);
      msgHtml = '<div class=chat_msg><img src="' + imgUrl + '" style="max-width:220px;max-height:220px;border-radius:8px;display:block;cursor:pointer" onclick="window.open(this.src,\\'_blank\\')" onerror="this.style.display=\\'none\\'"></div>';
    } else {
      msgHtml = '<div class=chat_msg><span>' + esc(m.content) + '</span></div>';
    }
    div.innerHTML = msgHtml + '<div class=send_time>' + hhmm + '</div>';
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  var isBuyerChat = false;

  function updateStatusUI(status) {
    if (currentRoom) currentRoom.status = status;
    var stateEl = document.getElementById('trade_state_text');
    if (stateEl) stateEl.textContent = STATUS_LABEL[status] || status;
    var ti = document.getElementById('trade_ing');
    var tc = document.getElementById('trade_cancel');
    var hBtn = document.getElementById('_im_handover_btn');
    if (status === 'ended' || status === 'cancelled' || status === 'rejected') {
      if (ti) { ti.disabled = true; ti.style.opacity = '0.4'; }
      if (tc) { tc.disabled = true; tc.style.opacity = '0.4'; }
      if (hBtn) { hBtn.disabled = true; hBtn.textContent = '인계완료'; hBtn.style.opacity = '0.4'; }
      // 거래종료 시 핑크 알림 박스 (아직 없는 경우에만)
      if (status === 'ended' && !document.getElementById('_im_trade_end_notice')) {
        var list2 = document.getElementById('chat_content_list');
        if (list2) {
          var box2 = document.createElement('div');
          box2.id = '_im_trade_end_notice';
          box2.style.cssText = 'margin:12px 8px 4px;padding:10px 16px;background:#fff0f3;border-radius:8px;color:#222;font-size:13px;font-weight:500;text-align:center;line-height:1.4';
          box2.textContent = '거래가 종료되었습니다.';
          list2.appendChild(box2);
          list2.scrollTop = list2.scrollHeight;
        }
      }
    } else if (status === 'handover') {
      // 판매자 인계완료 → 인계하기 버튼 비활성, 인수하기는 구매자가 누를 수 있도록 활성
      if (hBtn) { hBtn.disabled = true; hBtn.textContent = '인계완료✓'; hBtn.style.opacity = '0.6'; }
      if (ti) { ti.disabled = false; ti.style.opacity = ''; if (isBuyerChat) ti.style.display = ''; }
      if (tc) { tc.disabled = false; tc.style.opacity = ''; }
    } else {
      // 구매자 채팅창에서만 인수하기 표시
      if (ti) { ti.style.display = isBuyerChat ? '' : 'none'; }
      if (hBtn) { hBtn.disabled = false; hBtn.textContent = '인계하기'; hBtn.style.opacity = ''; }
    }
     updateTradeActions(currentRoom);
  }

  function loadMessages() {
    if (!roomId) return;
    api('GET', '/chat/rooms/' + roomId + '/messages').then(function(data) {
      if (!data || !Array.isArray(data.messages) || !data.room) {
        var content = document.querySelector('.popup_content');
        if (content) {
          content.textContent = data && data.error ? data.error : '채팅방을 불러올 수 없습니다. 다시 시도해 주세요.';
          content.style.cssText += ';padding:40px;text-align:center;';
        }
        return;
      }
      if (data.room) {
        var r = data.room;
        var previousStatus = currentRoom && currentRoom.status;
        currentRoom = r;
        var isBuyer = r.buyerId === myId;
        isBuyerChat = isBuyer;
        // 인수하기 버튼: 구매자 채팅창에서만 표시
        var tiEl = document.getElementById('trade_ing');
        if (tiEl) tiEl.style.display = isBuyer ? '' : 'none';
        // 인계하기 버튼: 판매자 채팅창에서만 주입
        if (!isBuyer && !document.getElementById('_im_handover_btn')) {
          var tc2 = document.getElementById('trade_cancel');
          if (tc2 && tc2.parentNode) {
            var hBtn2 = document.createElement('button');
            hBtn2.id = '_im_handover_btn';
            hBtn2.textContent = '인계하기';
            hBtn2.style.cssText = 'display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;box-sizing:border-box!important;margin-bottom:8px;padding:0;height:46px;background-color:#fff!important;color:#159EFD!important;border:1px solid #159EFD!important;border-radius:10px;font-size:15px!important;font-weight:bold!important;cursor:pointer;letter-spacing:-.02em;line-height:1.2;';
            tc2.parentNode.insertBefore(hBtn2, tc2);
          }
        }
        var partnerName = isBuyer ? (r.sellerNickname || '판매자') : (r.buyerNickname || '구매자');
        var uidEl = document.querySelector('.chat_user .uid');
        if (uidEl) uidEl.textContent = partnerName;
        var gradeEl = document.querySelector('.chat_user .credit_mark_new');
        var partnerGrade = String(isBuyer ? (r.sellerGrade || '') : (r.buyerGrade || '')).toLowerCase();
        if (gradeEl) {
          var knownGrade = ['bronze','silver','gold','platinum','vip'].indexOf(partnerGrade) !== -1;
          gradeEl.className = 'credit_mark_new' + (knownGrade ? ' ' + partnerGrade : '');
          gradeEl.textContent = knownGrade ? partnerGrade : '';
          gradeEl.setAttribute('aria-label', knownGrade ? partnerGrade + ' 등급' : '');
          gradeEl.style.setProperty('display', knownGrade ? 'inline-block' : 'none', 'important');
          gradeEl.style.setProperty('background-image', knownGrade ? 'url("/grade-icon/' + partnerGrade + '")' : 'none', 'important');
        }
        var tidEl = document.querySelector('.chat_user2 .sub_info .tid a');
        if (tidEl) {
          tidEl.textContent = r.productItemmaniaId ? '#' + r.productItemmaniaId : (r.productId ? '#' + r.productId : '채팅방 #' + r.id);
          tidEl.title = r.tradeInfo || '';
          tidEl.style.whiteSpace = 'normal';
          tidEl.style.lineHeight = '1.6';
          tidEl.style.overflowWrap = 'anywhere';
          if (tidEl.parentElement) tidEl.parentElement.style.whiteSpace = 'normal';
        }
        var oldCategory = document.querySelector('.chat_user2 .sub_info > a');
        if (oldCategory) oldCategory.textContent = [r.gameName, r.serverName, ({currency:'게임머니',item:'아이템',account:'계정',other:'기타'})[r.productItemCategory] || r.productItemCategory].filter(Boolean).join(' > ');
        var subjectA = document.querySelector('.chat_user2 .subject a');
        var subjectDiv = document.querySelector('.chat_user2 .subject');
        if (r.productTitle) {
          if (subjectA) subjectA.textContent = r.productTitle;
          else if (subjectDiv) subjectDiv.textContent = r.productTitle;
        } else {
          if (subjectA) subjectA.textContent = '';
          else if (subjectDiv) subjectDiv.textContent = '';
        }
        if (subjectA && r.productId && (r.productCategory === 'buy' || r.productCategory === 'sell')) {
          subjectA.href = '/' + r.productCategory + '/application.html?id=' + r.productId;
        }
        var priceEl = document.querySelector('.trade_price_num, .goods_price');
        var priceInput = document.getElementById('trade_money');
        if (r.productPrice) {
          var priceStr = Number(r.productPrice).toLocaleString();
          if (priceEl) priceEl.textContent = priceStr + '원';
          if (priceInput) priceInput.value = priceStr;
        } else {
          if (priceEl) priceEl.textContent = '';
          if (priceInput) priceInput.value = '';
        }
        updateStatusUI(r.status || 'pending');
        if (r.status === 'ended' && previousStatus !== 'ended') {
          refreshWallet().catch(function() {
            showTradeError('거래는 완료되었지만 마일리지 잔액을 새로고침하지 못했습니다.');
          });
        }
        if (['ended', 'cancelled', 'rejected'].indexOf(r.status) !== -1 && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
         updateTradeActions(r);
        var userInfoEl = document.getElementById('chat_user_info');
        if (userInfoEl) {
          userInfoEl.className = 'chat_user_info ' + (isBuyer ? 'sell' : 'buy');
          var roleLabel = userInfoEl.querySelector('.user_info_txt');
          if (roleLabel) roleLabel.innerHTML = isBuyer ? '판매자<br>정보' : '구매자<br>정보';
          var ul = userInfoEl.querySelector('ul');
          if (ul) {
            // 기존 li 모두 제거 후 재구성
            ul.innerHTML = '';
            // 이름 마스킹: 첫 글자 + * + 마지막 글자 (2자 이하: 첫 글자 + *)
            function maskName(n) {
              if (!n || n.length <= 1) return n || '';
              if (n.length === 2) return n[0] + '*';
              return n[0] + '*' + n[n.length - 1];
            }
            var account = document.createElement('li');
            account.textContent = maskName((isBuyer ? r.sellerName : r.buyerName) || partnerName);
            ul.appendChild(account);
            var liPhone = document.createElement('li');
            liPhone.textContent = (isBuyer ? r.sellerPhone : r.buyerPhone) || '연락처 미등록';
            ul.appendChild(liPhone);
            [isBuyer ? 'seller' : 'buyer'].forEach(function(role) {
              var charLi = document.createElement('li');
              charLi.id = 'trade-' + role + '-character';
              charLi.className = 'character';
              charLi.textContent = '캐릭터명: ' +
                ((role === 'seller' ? r.sellerCharacterName : r.buyerCharacterName) || '미입력');
              var fontButton = document.createElement('button');
              fontButton.type = 'button';
              fontButton.className = 'other_font';
              fontButton.textContent = '다른 글꼴로 보기';
              charLi.appendChild(document.createTextNode(' '));
              charLi.appendChild(fontButton);
              ul.appendChild(charLi);
            });
          }
        }
        // 사용자 요청에 따른 고정 안내 문구. 결제/정산 상태 판단에 사용하지 않는다.
        var noticeEl2 = document.getElementById('chat_notice_txt');
        if (noticeEl2) {
          noticeEl2.innerHTML = '<b>결제가 완료된 상품입니다.</b><br><span class="sub_txt">안전한 거래를 위해 실제 거래 당사자인지 확인 후 진행해 주시기 바랍니다.</span>';
          noticeEl2.style.display = '';
        }
      }
      var list = document.getElementById('chat_content_list');
      if (list && lastMsgId === 0) list.innerHTML = '';
      data.messages.forEach(appendMessage);
      if (data.room) {
        currentRoom = data.room;
         updateTradeActions(currentRoom);
      }
      var roomEl = document.querySelector('.chat_room');
      if (roomEl) roomEl.style.visibility = 'visible';
      // A textarea inside visibility:hidden cannot take focus. Wait until the
      // real room history is loaded, and do not steal focus from another control.
      var initialComposer = document.getElementById('write_chat');
      if (initialComposer && window.innerWidth > 780 &&
          (!document.activeElement || document.activeElement === document.body)) initialComposer.focus();
      showChatConnection(true);
    });
  }

  var sendingMessage = false;
  function sendMsg() {
    if (!roomId || sendingMessage) return;
    var textarea = document.getElementById('write_chat');
    if (!textarea) return;
    var draft = textarea.value;
    var msg = draft.trim();
    if (!msg) return;
    var sendButton = document.getElementById('send_btn');
    sendingMessage = true;
    if (sendButton) sendButton.disabled = true;
    return api('POST', '/chat/rooms/' + roomId + '/messages', { content: msg })
      .then(function(m) {
        if (!m || !m._ok || !m.id) throw new Error(m && m.error ? m.error : '메시지를 전송하지 못했습니다.');
        appendMessage(m);
        // Never discard text the member added while the request was in flight.
        if (textarea.value === draft) textarea.value = '';
      })
      .catch(function(error) {
        showTradeError(error && error.message ? error.message : '메시지를 전송하지 못했습니다. 입력한 글은 유지됩니다.');
      })
      .finally(function() {
        sendingMessage = false;
        if (sendButton) sendButton.disabled = false;
      });
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function() {
      if (!roomId) return;
      api('GET', '/chat/rooms/' + roomId + '/messages').then(function(data) {
        if (!data || !data.messages) return;
        data.messages.forEach(appendMessage);
        if (data.room) {
          var previousStatus = currentRoom && currentRoom.status;
          currentRoom = data.room;
          updateStatusUI(data.room.status || 'pending');
           updateTradeActions(currentRoom);
          if (data.room.status === 'ended' && previousStatus !== 'ended') {
            refreshWallet().catch(function() {
              showTradeError('거래는 완료되었지만 마일리지 잔액을 새로고침하지 못했습니다.');
            });
          }
          if (['ended', 'cancelled', 'rejected'].indexOf(data.room.status) !== -1 && pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        }
      });
    }, 4000);
  }

  function startChatEvents() {
    if (typeof EventSource === 'undefined' || !roomId) return;
    chatEvents = new EventSource('/api/events');
    var connected = false;
    chatEvents.addEventListener('connected', function() {
      if (connected && !document.hidden) refreshAfterCompletion();
      connected = true;
      showChatConnection(true);
    });
    chatEvents.addEventListener('error', function() { showChatConnection(false); });
    chatEvents.addEventListener('notification', function(event) {
      try {
        var notice = JSON.parse(event.data);
        if (!document.hidden && notice.type === 'trade_ended' &&
            notice.link === '/myroom/chat/new_chat.html?roomId=' + roomId) {
          refreshAfterCompletion();
        }
      } catch (error) {}
    });
    chatEvents.addEventListener('balance', function() {
      if (!document.hidden) refreshWallet().catch(function() {
        showTradeError('마일리지 잔액을 새로고침하지 못했습니다.');
      });
    });
  }

  function changeStatus(newStatus, confirmMsg) {
    if (!confirm(confirmMsg)) return;
    api('PATCH', '/chat/rooms/' + roomId, { status: newStatus }).then(function(res) {
      if (res && res._ok && res.status) updateStatusUI(res.status);
       else showTradeError(res && res.error ? res.error : '거래 상태를 변경하지 못했습니다.');
    });
  }

  function init() {
    var params = new URLSearchParams(location.search);
    roomId = params.get('roomId') ? Number(params.get('roomId')) : null;

    // 인수하기는 실제 역할/거래 상태로 판단한다. 고정 안내와는 무관하다.
    var tiInit = document.getElementById('trade_ing');
    if (tiInit) tiInit.style.display = 'none';

    var myroomBtn = document.querySelector('button.go_myroom');
    if (myroomBtn) myroomBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (window.opener) { window.close(); } else { location.href = '/myroom/index.html'; }
    });

    var exitBtn = document.getElementById('chat_exit');
    if (exitBtn) exitBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (exitBtn.disabled) return;
      if (confirm('내 채팅 목록에서 닫으시겠습니까? 거래 상태와 대화 기록은 유지됩니다.')) {
        exitBtn.disabled = true;
        api('POST', '/chat/rooms/' + roomId + '/dismiss').then(function(result) {
          if (!result._ok) {
            exitBtn.disabled = false;
            alert(result.error || '채팅을 닫지 못했습니다. 다시 시도해 주세요.');
            return;
          }
          if (pollTimer) clearInterval(pollTimer);
          try {
            if (window.opener && window.opener._IM_refreshChatList) window.opener._IM_refreshChatList();
          } catch (ignore) {}
          if (window.opener) window.close();
          location.href = '/myroom/chat/list.html';
        });
      }
    });

    // 채팅차단
    var chatBlockBtn = document.getElementById('chat_block');
    if (chatBlockBtn) chatBlockBtn.addEventListener('click', function(e) {
      e.preventDefault();
      alert('차단되었습니다.');
    });
    // 신고하기
    var userReportBtn = document.getElementById('user_report');
    if (userReportBtn) userReportBtn.addEventListener('click', function(e) {
      e.preventDefault();
      alert('신고되었습니다.');
    });
    // 자주쓰는채팅
    var chatTemplateBtn = document.getElementById('chat_template');
    if (chatTemplateBtn) chatTemplateBtn.addEventListener('click', function(e) {
      e.preventDefault();
      alert('현재 거래 상대방이 채팅에 참여 중입니다. 해당 기능은 이용하실 수 없습니다.');
    });
    // 알림보내기
    var chatAlarmBtn = document.getElementById('chat_alarm');
    if (chatAlarmBtn) chatAlarmBtn.addEventListener('click', function(e) {
      e.preventDefault();
      alert('알림을 보내었습니다.');
    });
    // 인쇄
    var chatPrintBtn = document.getElementById('chat_print');
    if (chatPrintBtn) chatPrintBtn.addEventListener('click', function(e) { e.preventDefault(); alert('해당 기능은 준비 중입니다.'); });

    // 파일(이미지) 첨부
    var sendFileBtn = document.getElementById('send_file');
    if (sendFileBtn) {
      var _fileInput = document.createElement('input');
      _fileInput.type = 'file';
      _fileInput.accept = 'image/*';
      _fileInput.style.display = 'none';
      document.body.appendChild(_fileInput);

      sendFileBtn.addEventListener('click', function(e) {
        e.preventDefault();
        _fileInput.value = '';
        _fileInput.click();
      });

      _fileInput.addEventListener('change', function() {
        var file = _fileInput.files && _fileInput.files[0];
        if (!file || !roomId) return;
        var formData = new FormData();
        formData.append('image', file);
        sendFileBtn.disabled = true;
        fetch('/api/chat/rooms/' + roomId + '/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData
        }).then(function(r) { return r.json(); }).then(function(m) {
          if (m && m.id) appendMessage(m);
        }).catch(function() {
          alert('이미지 업로드에 실패했습니다.');
        }).finally(function() {
          sendFileBtn.disabled = false;
          _fileInput.value = '';
        });
      });
    }

    var tradeIngBtn = document.getElementById('trade_ing');
    if (tradeIngBtn) {
      tradeIngBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!canConfirmRoom(currentRoom)) return;
        if (!confirm(currentRoom.orderId
          ? '거래완료(인수확인) 처리하시겠습니까? 판매자에게 대금이 지급됩니다.'
          : orderlessCompletionPrompt(currentRoom))) return;
        api('PATCH', '/chat/rooms/' + roomId, { status: 'ended' }).then(function(res) {
          if (res && res._ok && res.status) {
            var notice = document.getElementById('chat_notice_txt');
            if (notice) notice.style.display = '';
            updateStatusUI(res.status);
            // 채팅 목록 맨 아래에 핑크색 종료 알림 박스 추가
            var list = document.getElementById('chat_content_list');
            if (list && !document.getElementById('_im_trade_end_notice')) {
              var box = document.createElement('div');
              box.id = '_im_trade_end_notice';
              box.style.cssText = 'margin:12px 8px 4px;padding:10px 16px;background:#fff0f3;border-radius:8px;color:#222;font-size:13px;font-weight:500;text-align:center;line-height:1.4';
              box.textContent = '거래가 종료되었습니다.';
              list.appendChild(box);
              list.scrollTop = list.scrollHeight;
            }
            refreshAfterCompletion();
          } else { alert(res && res.error ? res.error : '거래 완료 처리에 실패했습니다.'); }
        });
      }, true);
    }

    var tradeCancelBtn = document.getElementById('trade_cancel');
    if (tradeCancelBtn) {
      tradeCancelBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        changeStatus('cancelled', '거래를 취소하시겠습니까?');
      }, true);
    }

    // 인계하기 버튼: 동적 주입 후 document 위임으로 처리
    document.addEventListener('click', function(e) {
      var btn = e.target && (e.target.id === '_im_handover_btn' ? e.target : (e.target.closest && e.target.closest('#_im_handover_btn')));
      if (!btn || btn.disabled) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!canHandoverRoom(currentRoom)) return;
      if (!confirm('인계하기를 처리하시겠습니까?\\n\\n구매자에게 물품/아이템을 전달한 후 클릭하세요.')) return;
      btn._busy = true;
      btn.disabled = true;
      btn.textContent = '처리중...';
      api('PATCH', '/chat/rooms/' + roomId, { status: 'handover' }).then(function(res) {
        if (res && res._ok && res.status) {
          updateStatusUI(res.status);
          currentRoom.status = res.status;
           updateTradeActions(currentRoom);
        } else {
           showTradeError(res && res.error ? res.error : '인계 처리에 실패했습니다.');
        }
      }).catch(function() {
         showTradeError('인계 처리에 실패했습니다.');
      }).finally(function() {
        btn._busy = false;
         updateTradeActions(currentRoom);
        if (!currentRoom || currentRoom.status !== 'handover') btn.textContent = '인계하기';
      });
    }, true);

    var backBtn = document.querySelector('a.back_btn');
    if (backBtn) {
      backBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (window.opener) { window.close(); } else { location.href = '/myroom/chat/list.html'; }
      });
    }

    var sendBtn = document.getElementById('send_btn');
    var textarea = document.getElementById('write_chat');
    setupTradeChatComposer(textarea, sendBtn, sendMsg);

    // Chat roles must come from the current authenticated session, not mutable header state.
    fetch('/api/auth/me', { credentials:'include', cache:'no-store' })
      .then(function(response) { return response.ok ? response.json() : null; })
      .catch(function() { return null; })
      .then(function(me) {
      if (!me || !me.id) {
        if (window.opener) { alert('로그인이 필요합니다.'); window.close(); }
        else { try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login'; }
        return;
      }
      myId = Number(me.id);
      if (!roomId) {
        var list = document.getElementById('chat_content_list');
        if (list) list.innerHTML = '<div style="padding:40px;text-align:center;color:#888">채팅방을 찾을 수 없습니다.</div>';
        return;
      }
      loadMessages();
      startPolling();
      startChatEvents();
    });
  }

  window.addEventListener('pagehide', function() {
    if (pollTimer) clearInterval(pollTimer);
    if (chatEvents) chatEvents.close();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
</script>
`;

const CHAT_INTERCEPT_SCRIPT = `
<script>
(function() {
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var yy = String(d.getFullYear()).slice(2);
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    var hh = String(d.getHours()).padStart(2,'0');
    var min = String(d.getMinutes()).padStart(2,'0');
    return yy + '-' + mm + '-' + dd + ' ' + hh + ':' + min;
  }
  function makeTid(r) {
    var d = new Date(r.createdAt || Date.now());
    var yy = String(d.getFullYear());
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var day = String(d.getDate()).padStart(2,'0');
    var hh = String(d.getHours()).padStart(2,'0');
    var min = String(d.getMinutes()).padStart(2,'0');
    var rid = String(r.id).padStart(4,'0');
    return yy + mm + day + hh + min + rid;
  }
  function maskEmail(email) {
    var id = email ? email.split('@')[0] : '';
    if (!id) return '***';
    if (id.length <= 1) return id + '***';
    if (id.length <= 4) return id[0] + '***';
    return id[0] + '***' + id.slice(4);
  }
  var GRADE_LETTERS_CHAT = { vip:'V', platinum:'P', gold:'G', silver:'S', bronze:'B' };
  function gradeIcon(grade, email) {
    var g = grade && GRADE_LETTERS_CHAT[grade] ? grade : null;
    var letter = g ? GRADE_LETTERS_CHAT[g] : '';
    var icon = g ? '<span class="credit_mark_new ' + g + '" style="margin-right:3px">' + letter + '</span>' : '';
    return icon + maskEmail(email);
  }

  var STATUS_FILTER = { pending:'a', active:'b', ended:'c', cancelled:'d', rejected:'e' };
  var STATUS_CLASS_SELL = { pending:'sell_wait', active:'sell_ing', ended:'sell_end', cancelled:'sell_cancel', rejected:'sell_impossible' };
  var STATUS_CLASS_BUY  = { pending:'buy_wait',  active:'buy_ing',  ended:'buy_end',  cancelled:'buy_cancel',  rejected:'buy_impossible' };
  var STATUS_LABEL = { pending:'거래대기', active:'거래중', ended:'거래종료', cancelled:'거래취소', rejected:'거래불가' };

  var allRooms = [];
  var myId = null;

  function openChat(roomId, isBuyer) {
    var url = '/myroom/chat/new_chat.html?roomId=' + roomId + '&type=' + (isBuyer ? 'buy' : 'sell');
    location.href = url;
  }

  /* chat_sub_list 열기/닫기 — li.expanded 클래스로 상태 추적 */
  function toggleSubList(li) {
    var sub = li.querySelector('.chat_sub_list');
    if (!sub) return;
    if (li.classList.contains('expanded')) {
      li.classList.remove('expanded');
      sub.style.height = '0';
    } else {
      li.classList.add('expanded');
      /* scrollHeight 측정: 잠깐 auto 세팅 후 즉시 0으로 리셋 → rAF에서 목표값 세팅 */
      sub.style.transition = 'none';
      sub.style.height = 'auto';
      var h = sub.scrollHeight;
      sub.style.height = '0';
      sub.style.transition = '';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          sub.style.height = h + 'px';
        });
      });
    }
  }

  function buildItem(r) {
    var isBuyer = r.buyerId === myId;
    var typeClass = isBuyer ? 'buy' : 'sell';
    var typeLabel = isBuyer ? '삽니다' : '팝니다';
    var stateKey  = r.status || 'pending';
    var stateClass = isBuyer ? (STATUS_CLASS_BUY[stateKey] || 'buy_wait') : (STATUS_CLASS_SELL[stateKey] || 'sell_wait');
    var stateLabel = STATUS_LABEL[stateKey] || '거래대기';
    var stateFilter = STATUS_FILTER[stateKey] || 'a';
    var partnerEmail = isBuyer ? (r.sellerEmail || '') : (r.buyerEmail || '');
    var partnerGrade = isBuyer ? (r.sellerGrade || null) : (r.buyerGrade || null);
    var productTitle = r.productTitle || '상품 문의';
    var price = r.productPrice ? Number(r.productPrice).toLocaleString() + '원' : '-';
    var roomIdStr = String(r.id);
    var tidStr = makeTid(r);
    var lastMsg = r.lastMessage || '';
    var lastTime = fmtDateTime(r.lastMessageAt || r.createdAt);
    var breadcrumb = [r.gameName, r.serverName, r.itemCategory].filter(Boolean).join(' > ') || '';

    /* ─── 서브 리스트 아이템: 원본 chat_list_item flex 구조 완전 일치 ─── */
    /* .chat_group(67px) + .chat_info_area(flex:1) + .chat_user(110px) + .dt(120px) + .chat_proc(124px) */
    var subItemHtml =
      '<li class="chat_list_item" style="cursor:pointer" data-sub-room="' + roomIdStr + '">' +
        '<div class=chat_group>' +
          '<div class="trade_type ' + typeClass + '"></div>' +
        '</div>' +
        '<div class=chat_info_area>' +
          '<div class="subject reply">' + esc(lastMsg || '새 채팅을 시작하세요') + '</div>' +
          '<div class=sub_info>' + (breadcrumb ? esc(breadcrumb) : '') + '</div>' +
        '</div>' +
        '<div class=chat_user>' + gradeIcon(partnerGrade, partnerEmail) + '</div>' +
        '<div class=dt>' + lastTime + '</div>' +
        '<div class=chat_proc>' +
          '<button type=button class=chat_exit data-roomid="' + roomIdStr + '">채팅종료</button>' +
        '</div>' +
      '</li>';

    var li = document.createElement('li');
    li.className = 'chat_list_item';
    /* 거래종료/취소/불가 → state_block 클래스 (회색 오버레이) */
    if (stateKey === 'ended' || stateKey === 'cancelled' || stateKey === 'rejected') {
      li.classList.add('state_block');
    }
    li.setAttribute('data-expand', roomIdStr);
    li.setAttribute('data-type', typeClass);
    li.setAttribute('data-state', stateFilter);
    li.setAttribute('data-time', r.lastMessageAt || r.createdAt || '');
    li.style.cursor = 'pointer';
    li.innerHTML =
      '<div class=chat_group>' +
        '<div class="trade_type ' + typeClass + '">' + typeLabel + '</div>' +
        '<button type=button class=chat_group_expand>그룹보기</button>' +
      '</div>' +
      '<div class=chat_info_area>' +
        '<div class="trade_state ' + stateClass + '">' + stateLabel + '</div>' +
        '<div class=tid>#' + tidStr + '</div>' +
        '<div class=subject>' + esc(productTitle) + '</div>' +
        '<div class=sub_info>' + (breadcrumb ? esc(breadcrumb) : '') + '</div>' +
      '</div>' +
      '<div class=chat_user><span>1명과</span> 대화중</div>' +
      '<div class=dt>' + price + '</div>' +
      '<div class=chat_proc>' +
        '<button type=button class=chat_exit data-roomid="' + roomIdStr + '">채팅종료</button>' +
      '</div>' +
      '<div class=chat_sub_list><ul style="margin:0;padding:0;list-style:none">' + subItemHtml + '</ul></div>';

    /* 서브 아이템 클릭 → 팝업 */
    li.querySelector('[data-sub-room]').addEventListener('click', function(e) {
      if (e.target.classList.contains('chat_exit')) return;
      e.stopPropagation();
      openChat(r.id, isBuyer);
    });

    /* 채팅종료 버튼들 */
    li.querySelectorAll('.chat_exit').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        if (confirm('내 채팅 목록에서 닫으시겠습니까? 거래 상태와 대화 기록은 유지됩니다.')) {
          btn.disabled = true;
          fetch('/api/chat/rooms/' + r.id + '/dismiss', {
            method: 'POST', credentials: 'include'
          }).then(function(res) {
            if (!res.ok) return res.json().catch(function(){return {};}).then(function(data){
              throw new Error(data.error || '채팅을 닫지 못했습니다.');
            });
            listVersion++;
            allRooms = allRooms.filter(function(room) { return room.id !== r.id; });
            renderRooms(allRooms);
          }).catch(function(error) {
            btn.disabled = false;
            alert(error.message || '채팅을 닫지 못했습니다. 다시 시도해 주세요.');
          });
        }
      });
    });

    /* 그룹보기 버튼 → 펼치기/접기 */
    li.querySelector('.chat_group_expand').addEventListener('click', function(e) {
      e.stopPropagation();
      toggleSubList(li);
    });

    /* chat_sub_list 클릭이 부모 li 로 버블링되지 않도록 차단 */
    var subDiv = li.querySelector('.chat_sub_list');
    if (subDiv) {
      subDiv.addEventListener('click', function(e) { e.stopPropagation(); });
    }

    /* 메인 아이템 클릭 (chat_group, chat_info_area 등) → 펼치기/접기 */
    li.addEventListener('click', function(e) {
      var tgt = e.target;
      if (tgt.classList.contains('chat_exit') || tgt.classList.contains('chat_group_expand')) return;
      toggleSubList(li);
    });

    return li;
  }

  function applyFilters() {
    var typeEl  = document.querySelector('input[name=trade_type]:checked');
    var stateEl = document.querySelector('input[name=trade_state]:checked');
    var typeVal  = typeEl  ? typeEl.value  : '';
    var stateVal = stateEl ? stateEl.value : '';
    var list = document.querySelector('.chat_list');
    if (!list) return;
    Array.from(list.querySelectorAll('li.chat_list_item')).forEach(function(li) {
      var t = li.getAttribute('data-type') || '';
      var s = li.getAttribute('data-state') || '';
      var ok = (!typeVal || t === typeVal) && (!stateVal || s === stateVal);
      li.style.display = ok ? '' : 'none';
    });
  }

  function renderRooms(rooms) {
    var list = document.querySelector('.chat_list');
    if (!list) return;
    var expanded = Array.from(list.querySelectorAll('.expanded[data-expand]')).map(function(li){ return li.getAttribute('data-expand'); });
    var scrollY = window.scrollY;
    list.innerHTML = '';
    if (!rooms.length) {
      var empty = document.createElement('li');
      empty.style.cssText = 'padding:40px;text-align:center;color:#888;font-size:15px';
      empty.innerHTML = '채팅 내역이 없습니다.<br><small>상품 상세 페이지의 채팅 버튼을 눌러 시작하세요.</small>';
      list.appendChild(empty);
      return;
    }
    rooms.forEach(function(r) {
      var item = buildItem(r);
      list.appendChild(item);
      if (expanded.indexOf(String(r.id)) !== -1) {
        item.classList.add('expanded');
        item.querySelector('.chat_sub_list').style.height = 'auto';
      }
    });
    applyFilters();
    window.scrollTo(0, scrollY);
  }

  var refreshing = false, refreshTimer = null, listVersion = 0;
  function refreshRooms() {
    if (refreshing || !myId || document.hidden) return;
    refreshing = true;
    var version = listVersion;
    return fetch('/api/chat/rooms', { credentials:'include', cache:'no-store' })
      .then(function(response) {
        if (!response.ok) throw new Error('채팅 목록을 새로고침하지 못했습니다.');
        return response.json();
      }).then(function(rooms) {
        if (version !== listVersion) return;
        if (!Array.isArray(rooms)) throw new Error('채팅 목록 응답을 확인할 수 없습니다.');
        var old = JSON.stringify(allRooms);
        var order = document.querySelector('input[name=order]');
        rooms.sort(function(a,b) { return order && order.checked
          ? new Date(b.lastMessageAt || b.createdAt)-new Date(a.lastMessageAt || a.createdAt)
          : new Date(b.createdAt)-new Date(a.createdAt); });
        allRooms = rooms;
        if (JSON.stringify(allRooms) !== old) renderRooms(allRooms);
      }).catch(function(error) {
        var list = document.querySelector('.chat_list');
        if (list) list.setAttribute('aria-label', error.message + ' 잠시 후 다시 시도합니다.');
      }).finally(function(){ refreshing = false; });
  }
  window._IM_refreshChatList = refreshRooms;
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) refreshRooms(); });
  window.addEventListener('pagehide', function(){ if (refreshTimer) clearInterval(refreshTimer); refreshTimer = null; });
  window.addEventListener('pageshow', function(event){
    if (event.persisted) { refreshRooms(); refreshTimer = setInterval(refreshRooms, 5000); }
  });

  function init() {
    var layout = document.createElement('style');
    layout.setAttribute('data-chat-list-layout', '');
    layout.textContent = 'html,body{height:auto!important;min-height:100%!important;overflow-y:auto!important}.chat_list{height:auto!important;min-height:0!important;flex:none!important}.chat_list>.chat_list_item{flex:0 0 auto!important;min-height:104px!important}.chat_list_item.state_block::before{pointer-events:none!important}';
    document.head.appendChild(layout);
    refreshTimer = setInterval(refreshRooms, 5000);
    var myroomBtn = document.querySelector('button.go_myroom');
    if (myroomBtn) myroomBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (window.opener && !window.opener.closed) {
        window.opener.location.href = '/myroom/index.html';
        window.close();
      } else {
        window.top.location.href = '/myroom/index.html';
      }
    });
    var blockBtn = document.querySelector('button.block_list');
    if (blockBtn) blockBtn.addEventListener('click', function(e) { e.preventDefault(); alert('차단리스트 기능은 준비 중입니다.'); });

    document.querySelectorAll('input[name=trade_type]').forEach(function(el) { el.addEventListener('change', applyFilters); });
    document.querySelectorAll('input[name=trade_state]').forEach(function(el) { el.addEventListener('change', applyFilters); });

    var orderEl = document.querySelector('input[name=order]');
    if (orderEl) {
      orderEl.addEventListener('change', function() {
        var sorted = allRooms.slice();
        if (orderEl.checked) {
          sorted.sort(function(a, b) { return new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt); });
        }
        renderRooms(sorted);
      });
    }

    window._IM_auth().then(function(me) {
      if (!me || !me.id) {
        var list = document.querySelector('.chat_list');
        if (list) list.innerHTML = '<li style="padding:40px;text-align:center;color:#888;font-size:15px"><a href="/login" style="color:#159EFD;font-weight:700">로그인</a>하면 채팅 내역을 확인할 수 있습니다.</li>';
        return;
      }
      myId = me.id;
      fetch('/api/chat/rooms', { credentials: 'include' })
        .then(function(r) { return r.json(); })
        .then(function(rooms) {
          allRooms = rooms;
          allRooms.sort(function(a, b) { return new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt); });
          renderRooms(allRooms);
        })
        .catch(function() {
          var list = document.querySelector('.chat_list');
          if (list) list.innerHTML = '<li style="padding:40px;text-align:center;color:#e03030">채팅 목록을 불러오지 못했습니다.</li>';
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
</script>
`;

const SELL_CHAT_HEAD_INTERCEPT = `<script>
document.addEventListener('click', function(e) {
  var purchaseBtn = e.target && e.target.closest ? e.target.closest('.g_btn_new button') : null;
  if (purchaseBtn && purchaseBtn.textContent.trim() === '구매신청') {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (window._im_on_purchase) window._im_on_purchase(purchaseBtn);
    return;
  }
  var btn = e.target && e.target.closest ? e.target.closest('button.go_chat, button[name=go_chat]') : null;
  if (!btn) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (window._im_on_sell_chat) window._im_on_sell_chat();
}, true);
 document.addEventListener('submit', function(e) {
   if (!e.target || e.target.id !== 'frmSell') return;
   e.preventDefault();
   e.stopImmediatePropagation();
   if (window._im_on_purchase) window._im_on_purchase(document.querySelector('.g_btn_new button[data-im-purchase]'));
 }, true);
</script>`;

const SELL_APPLICATION_INTERCEPT_SCRIPT = `
<script>
(function() {
  var purchasePending = false;
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  function showLoginModal() {
    try {
      sessionStorage.setItem('_im_login_next', location.href);
      sessionStorage.setItem('_im_purchase_after_login', location.pathname + location.search);
    } catch(ex) {}
    location.href = '/login';
  }

  window._im_on_purchase = function(btn) {
    if (purchasePending) return false;
    var user = window._IM_USER;
    if (!user || !user.id) { showLoginModal(); return false; }
    var prod = window.__PRODUCT__;
    if (!prod || !prod.id || !prod.sellerId) {
      alert('이 글은 이 사이트의 판매자 계정과 연결되어 있지 않아 구매신청할 수 없습니다.');
      return false;
    }
    if (prod.status !== 'active') {
      alert('현재 거래할 수 없는 상품입니다.');
      return false;
    }
    if (Number(prod.sellerId) === Number(user.id)) {
      alert('자신의 상품에는 구매신청할 수 없습니다.');
      return false;
    }
    purchasePending = true;
    var oldLabel = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '처리 중...'; }
    fetch('/api/chat/rooms', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerId: Number(prod.sellerId), productId: Number(prod.id),
        characterName: (document.getElementById('user_character') || {}).value || undefined
      })
    }).then(function(r) {
      return r.json().catch(function(){ return {}; }).then(function(room) {
        if (!r.ok) throw new Error(room.error || '구매신청에 실패했습니다.');
        return room;
      });
    }).then(function(room) {
      if (!room || !room.id) throw new Error('거래 채팅방을 열 수 없습니다.');
      location.href = '/myroom/buy/buy_ing.html?roomId=' + encodeURIComponent(room.id);
    }).catch(function(err) {
      alert(err.message || '구매신청에 실패했습니다.');
    }).finally(function() {
      purchasePending = false;
      if (btn) { btn.disabled = false; btn.textContent = oldLabel; }
    });
    return false;
  };

  window._im_on_sell_chat = function() {
    var user = window._IM_USER;
    if (!user || !user.id) {
      try { sessionStorage.setItem('_im_login_next', location.href); } catch(ex) {}
      location.href = '/login';
      return false;
    }
    var prod = window.__PRODUCT__;
    if (!prod || !prod.sellerId || !prod.id) {
      alert('이 글은 이 사이트의 판매자 계정과 연결되어 있지 않아 채팅할 수 없습니다.');
      return false;
    }
    if (Number(prod.sellerId) === Number(user.id)) {
      alert('자신의 상품에는 채팅할 수 없습니다.');
      return false;
    }
    var popup = (window._nativeOpen || window.open.bind(window))(
      'about:blank', 'im_product_chat_' + prod.id, 'width=900,height=700,resizable=yes,scrollbars=yes'
    );
    if (popup && !popup.closed) {
      try { popup.document.body.textContent = '채팅방을 준비 중입니다...'; } catch(ex) {}
    }
    var charEl = document.getElementById('user_character');
    var charName = charEl ? (charEl.value || '').trim() : '';
    var unitTxt = (document.querySelector('.unit_info') || {}).textContent || '';
    var goodsType = document.querySelector('.character_write')
      ? (unitTxt.indexOf('게임머니') >= 0 ? '게임머니' : '아이템') : '계정';
    fetch('/api/chat/rooms', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sellerId: Number(prod.sellerId), productId: Number(prod.id),
        characterName: charName || undefined, goodsType: goodsType
      })
    }).then(function(r) {
      return r.json().then(function(room) {
        if (!r.ok) throw new Error(room.error || '채팅방을 만들 수 없습니다.');
        return room;
      });
    }).then(function(room) {
      if (!room || !room.id) throw new Error('채팅방을 찾을 수 없습니다.');
      var chatUrl = '/myroom/chat/new_chat.html?roomId=' + room.id;
      if (popup && !popup.closed) popup.location.replace(chatUrl);
      else location.href = chatUrl;
    }).catch(function(err) {
      if (popup && !popup.closed) popup.close();
      alert(err.message || '채팅방을 열 수 없습니다.');
    });
    return false;
  };

  // ── 내 거래정보 섹션: 로그인 유저 정보로 교체 ────────────────────
  function loadUserTradeInfo() {
    if (window._IM_refreshTradeInfo) { window._IM_refreshTradeInfo(); return; }
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(me) {
        if (!me) return;
        var displayName = me.nickname || me.email || String(me.id);
        var nameEl = document.querySelector('.my_private li.user_name, li.user_name');
        if (nameEl) {
          Array.prototype.forEach.call(nameEl.childNodes, function(node) {
            if (node.nodeType === 3) node.textContent = displayName + ' ';
          });
        }
        var phoneEl = document.getElementById('spnUserPhone');
        if (phoneEl) phoneEl.textContent = '자택번호 없음 ';
        var cellEl = document.getElementById('spnUserCell');
        if (cellEl) cellEl.textContent = me.phone || '';
      })
      .catch(function() {});
  }

  function init() {
    loadUserTradeInfo();

    // 검색창 게임명 교체 (스냅샷 하드코딩 "리니지클래식" → 실제 상품 게임명)
    (function() {
      var _prod = window.__PRODUCT__;
      if (_prod && _prod.gameName) {
        var _gsInp = document.getElementById('searchGameServer');
        if (_gsInp) _gsInp.value = _prod.gameName;
        var _gsInp2 = document.querySelector('input.search_gs_name:not(#searchGameServer)');
        if (_gsInp2) _gsInp2.value = _prod.gameName;
      }
    })();

    // ── 구매수량 컨트롤 (document 레벨 위임, 초기화) ────────
    (function() {
      function fmtKr(n) { return Number(n||0).toLocaleString('ko-KR'); }
      function getPrice() {
        var prod = window.__PRODUCT__ || window._IM_PRODUCT;
        return prod ? Number(prod.price) || 0 : 0;
      }
      function getQtyInput() { return document.getElementById('buy_quantity'); }
      function getQty() {
        var inp = getQtyInput();
        if (!inp) return 1;
        var v = parseInt(inp.value, 10);
        return (isNaN(v) || v < 1) ? 1 : v;
      }
      function updateQtyDisplay(qty) {
        var inp = getQtyInput();
        if (!inp) return;
        inp.value = String(qty);
        var spnQty   = document.getElementById('spnQuantity');
        var spnTotal = document.getElementById('spnQuantity_total');
        var minusBtn = document.querySelector('.quantity_input button[name=minus], .quantity_input button.minus');
        if (spnQty)   spnQty.textContent   = String(qty);
        if (spnTotal) spnTotal.textContent = String(qty);
        if (minusBtn) {
          if (qty <= 1) minusBtn.setAttribute('disabled', '');
          else          minusBtn.removeAttribute('disabled');
        }
        var total = getPrice() * qty;
        var tf = fmtKr(total);
        var tmEl2 = document.getElementById('trade_money');
        if (tmEl2) tmEl2.textContent = tf;
        document.querySelectorAll('.pay_mileage').forEach(function(el) { el.textContent = tf; });
        document.querySelectorAll('.add_pay.price_font, .add_pay').forEach(function(el) { el.textContent = tf; });
        document.querySelectorAll('.settle_amount, .final_amount').forEach(function(el) { el.textContent = tf; });
      }
      // document 레벨 위임: 어떤 타이밍에도 클릭 감지
      document.addEventListener('click', function(e) {
        var btn = e.target;
        if (!btn || btn.tagName !== 'BUTTON') return;
        var inQty = btn.closest ? btn.closest('.quantity_input') : null;
        if (!inQty) return;
        if (btn.name === 'plus' || btn.classList.contains('plus')) {
          e.preventDefault();
          updateQtyDisplay(getQty() + 1);
        } else if ((btn.name === 'minus' || btn.classList.contains('minus')) && !btn.disabled) {
          e.preventDefault();
          var q = getQty();
          if (q > 1) updateQtyDisplay(q - 1);
        }
      });
      // input 직접 입력 지원 (change 이벤트)
      document.addEventListener('change', function(e) {
        var el = e.target;
        if (!el || el.id !== 'buy_quantity') return;
        var q = parseInt(el.value, 10);
        if (isNaN(q) || q < 1) updateQtyDisplay(1);
        else updateQtyDisplay(q);
      });
    })();

    // 로그인 후 원래 상품으로 돌아왔으면 구매신청을 한 번만 재개
    try {
      var currentPath = location.pathname + location.search;
      if (window._IM_USER && window._IM_USER.id &&
          sessionStorage.getItem('_im_purchase_after_login') === currentPath) {
        sessionStorage.removeItem('_im_purchase_after_login');
        window._im_on_purchase(document.querySelector('.g_btn_new button[data-im-purchase]'));
      }
    } catch(ex) {}

    // 충전하기 버튼 → 준비 중
    document.querySelectorAll('button.charge_btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        alert('충전 서비스는 게임 할인충전 페이지를 이용해주세요.');
      }, true);
    });

    // 쿠폰, 찜하기 버튼 → 준비 중
    document.querySelectorAll('#coupon_btn, .btn_fav').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        alert('해당 기능은 현재 준비 중입니다.');
      }, true);
    });

    // 헤더 로그인 버튼
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login';
      }, true);
    }

    // 채팅 버튼 (헤더)
    var chatBtn = document.querySelector('#chat_notice button');
    if (chatBtn) {
      chatBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/myroom/chat/list.html';
      }, true);
    }

    // 링크복사 버튼 → 현재 URL 클립보드 복사
    var linkCopyBtn = document.getElementById('link_copy');
    if (linkCopyBtn) {
      linkCopyBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var url = location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function() {
            linkCopyBtn.textContent = '복사완료!';
            setTimeout(function() { linkCopyBtn.textContent = '링크복사'; }, 2000);
          }).catch(function() {
            fallbackCopy(url);
          });
        } else {
          fallbackCopy(url);
        }
        function fallbackCopy(text) {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
            linkCopyBtn.textContent = '복사완료!';
            setTimeout(function() { linkCopyBtn.textContent = '링크복사'; }, 2000);
          } catch(ex) {}
          ta.remove();
        }
      }, true);
    }

    // 차단 마커 링크
    document.body.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('a[data-blocked]');
      if (a) { e.preventDefault(); alert('해당 기능은 현재 준비 중입니다.'); }
    });

    // 로그인 상태에 따라 헤더 업데이트
    window._IM_auth().then(function(data){
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(e){
            e.stopImmediatePropagation();
            api('POST', '/auth/logout').then(function(){ location.href='/'; });
          }, true);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;


const APPLICATION_DYNAMIC_SCRIPT = `
<script>
(function() {
  var listingQuantityLabel = ${listingQuantityLabel.toString()};
  var params = new URLSearchParams(location.search);
  var productId = params.get('id');
  if (!productId || isNaN(Number(productId))) return; // 정적 스냅샷이면 스킵

  var type = location.pathname.indexOf('/buy/') >= 0 ? 'buy' : 'sell';

  function fmt(n) { return Number(n||0).toLocaleString('ko-KR'); }

  function showToast(msg, ok) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:99999;' +
      'padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;color:#fff;' +
      'background:' + (ok ? '#0070d2' : '#e53e3e') + ';box-shadow:0 4px 20px rgba(0,0,0,.18);pointer-events:none';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, 3000);
  }

  function renderBuyBox(p) {
    var existing = document.getElementById('_im_buy_box');
    if (existing) existing.remove();
    // Buying listings already have their native right-hand sales-application form.
    if (type === 'buy') return;
    var box = document.createElement('div');
    box.id = '_im_buy_box';
    box.style.cssText = 'margin:20px 0;padding:24px;background:#f0f7ff;border-radius:12px;border:2px solid #159EFD';

    if (type === 'sell') {
      box.innerHTML =
        '<div style="font-size:16px;font-weight:700;margin-bottom:8px">이 상품 구매하기</div>' +
        '<div style="font-size:26px;font-weight:800;color:#e53e3e;margin-bottom:18px">' + fmt(p.price) + '원</div>' +
        '<div style="display:flex;gap:10px;margin-bottom:12px">' +
          '<button id=_im_buy_btn style="flex:2;padding:14px;background:#159EFD;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer">💳 구매하기</button>' +
          (p.sellerId
            ? '<button id=_im_chat_btn style="flex:1;padding:14px;background:#25d366;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">💬 채팅</button>'
            : '<button type=button disabled style="flex:1;padding:14px;background:#ddd;color:#666;border:none;border-radius:8px;font-size:15px">채팅 불가</button>') +
        '</div>' +
        (!p.sellerId ? '<p style="margin:0 0 12px;font-size:13px;color:#666">이 글은 이 사이트의 판매자 계정과 연결되어 있지 않아 채팅할 수 없습니다.</p>' : '') +
        '<p style="margin:0;font-size:13px;color:#555">* 아이템마니아 에스크로로 안전하게 보호됩니다. 판매자가 거래를 완료해야 금액이 지급됩니다.</p>';
    }

    // trade_info 다음에 삽입
    var anchor = document.querySelector('.flex_area.trade_info, .trade_info, .border_box, .trade_money');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
    } else {
      (document.querySelector('.g_body, main, article, body')).appendChild(box);
    }

    // 구매하기 버튼
    var buyBtn = document.getElementById('_im_buy_btn');
    if (buyBtn) {
      buyBtn.addEventListener('click', function() {
        if (type !== 'sell') {
          if (window._im_on_sell_btn) window._im_on_sell_btn(buyBtn);
          else showToast('판매신청을 처리할 수 없습니다.', false);
          return;
        }
        window._IM_auth().then(function(user) {
          if (!user || !user.id) {
            showToast('로그인이 필요합니다.', false);
            setTimeout(function() { try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login'; }, 1200);
            return;
          }
          if (!p.sellerId) {
            // Existing external-listing checkout stays on the legacy order path.
            fetch('/api/wallet', { credentials: 'include' })
              .then(function(r) { return r.json(); })
              .then(function(w) {
                var balance = Number(w.balance) || 0;
                if (balance < p.price) {
                  var msg = '잔액이 부족합니다.\\n현재 잔액: ' + fmt(balance) + '원\\n필요 금액: ' + fmt(p.price) + '원\\n\\n충전 페이지로 이동하시겠습니까?';
                  if (confirm(msg)) location.href = '/myroom/mileage/payment/payment_list.html';
                  return;
                }
                if (!confirm('[' + p.title + ']\\n' + fmt(p.price) + '원을 구매하시겠습니까?\\n\\n(에스크로 보호 거래)')) return;
                buyBtn.disabled = true;
                fetch('/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ productId: p.id, productTitle: p.title, amount: p.price })
                }).then(function(r) { return r.json(); })
                  .then(function(order) {
                    if (order.error) { showToast('구매 실패: ' + order.error, false); buyBtn.disabled = false; return; }
                    showToast('구매가 완료되었습니다! 판매자와 채팅하세요.', true);
                    setTimeout(function() { location.href = '/myroom/index.html'; }, 1800);
                  })
                  .catch(function() { showToast('오류가 발생했습니다. 다시 시도해주세요.', false); buyBtn.disabled = false; });
              })
              .catch(function() { showToast('잔액을 확인할 수 없습니다.', false); });
            return;
          }
          if (Number(user.id) === Number(p.sellerId)) {
            showToast('자신의 상품은 구매할 수 없습니다.', false); return;
          }

          buyBtn.disabled = true;
          fetch('/api/chat/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ productId: Number(p.id), sellerId: Number(p.sellerId), characterName: (document.getElementById('user_character') || {}).value || undefined })
          }).then(function(r) {
            return r.json().then(function(room) {
              if (!r.ok || !room.id) throw new Error(room.error || '채팅방을 열 수 없습니다.');
              return room;
            });
          }).then(function(room) {
            location.href = '/myroom/buy/buy_ing.html?roomId=' + encodeURIComponent(room.id);
          }).catch(function(err) {
            showToast(err.message || '구매신청에 실패했습니다.', false);
            buyBtn.disabled = false;
          });
        });
      });
    }

    // 채팅 버튼 → 판매자와 채팅방 생성 후 이동
    var chatBtn = document.getElementById('_im_chat_btn');
    if (chatBtn) {
      chatBtn.addEventListener('click', function() {
        window._IM_auth().then(function(user) {
          if (!user || !user.id) {
            try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login';
            return;
          }
          if (!p || !p.sellerId) {
            alert('이 글은 이 사이트의 판매자 계정과 연결되어 있지 않아 채팅할 수 없습니다.');
            return;
          }
          if (Number(p.sellerId) === Number(user.id)) {
            location.href = '/myroom/chat/list.html'; return;
          }
          var charEl2 = document.getElementById('user_character');
          var charName2 = charEl2 ? (charEl2.value || '').trim() : '';
          var detectedType2 = '';
          if (document.querySelector('.character_write')) {
            var unitTxt2 = (document.querySelector('.unit_info') || {}).textContent || '';
            detectedType2 = unitTxt2.indexOf('게임머니') >= 0 ? '게임머니' : '아이템';
          } else {
            detectedType2 = '계정';
          }
          fetch('/api/chat/rooms', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sellerId: Number(p.sellerId), productId: Number(p.id),
              characterName: charName2 || undefined,
              goodsType: detectedType2 || undefined
            })
          }).then(function(r) { return r.json(); })
          .then(function(room) {
            if (room && room.id) {
              var opener3 = window._nativeOpen || window.open.bind(window);
              var w3 = opener3('/myroom/chat/new_chat.html?roomId=' + room.id, '_chat_' + room.id, 'width=900,height=700,resizable=yes,scrollbars=yes');
              if (!w3 || w3.closed) { w3 = opener3('/myroom/chat/new_chat.html?roomId=' + room.id, '_blank'); }
              if (!w3 || w3.closed) { location.href = '/myroom/chat/new_chat.html?roomId=' + room.id; }
            } else { alert(room.error || '채팅방을 열 수 없습니다.'); }
          }).catch(function() { alert('채팅방을 열 수 없습니다.'); });
        });
      });
    }
  }

  function injectProduct(p) {
    document.querySelectorAll('.trade_info dt').forEach(function(dt) {
      if (!dt.querySelector('label') && /^(판매|구매)수량$/.test(dt.textContent.trim()) && dt.nextElementSibling) {
        dt.nextElementSibling.textContent = listingQuantityLabel(p);
      }
    });
    // ── 제목 ─────────────────────────────────────────────
    var titleEl = document.querySelector('.trade_subject');
    if (titleEl) {
      var sig = titleEl.querySelector('.signboard');
      titleEl.textContent = '';
      if (sig) titleEl.appendChild(sig);
      titleEl.appendChild(document.createTextNode(' ' + p.title));
    }
    document.title = p.title + ' - 아이템매니아';

    // ── 거래 ID ──────────────────────────────────────────
    var tidEl = document.querySelector('.trade_id');
    if (tidEl && tidEl.firstChild && tidEl.firstChild.nodeType === 3) {
      tidEl.firstChild.textContent = '#' + p.id + ' ';
    }

    // ── 가격 ─────────────────────────────────────────────
    var moneyEl = document.querySelector('dd.trade_money');
    if (moneyEl) {
      // 아이템마니아 상품은 priceRaw(예:"1,000원 (1만당)") 그대로 표시, DB 상품은 fmt
      var priceDisplay = p.priceRaw
        ? p.priceRaw
        : (fmt(p.price) + '원');
      moneyEl.innerHTML = '<strong style="font-size:1.1em">' + priceDisplay + '</strong>';
    }
    var tradeMoneySp = document.getElementById('trade_money');
    if (tradeMoneySp) tradeMoneySp.textContent = fmt(p.price);
    // 총 구매금액·결제 해야할 금액 — 스냅샷 JS 덮어쓰기 방지용 전체 교체
    var pf = fmt(p.price);
    // ID 직접 교체 (#pay_mileage는 class가 아닌 id)
    var payMilEl = document.getElementById('pay_mileage');
    if (payMilEl) payMilEl.textContent = pf;
    document.querySelectorAll('.pay_mileage').forEach(function(el) { el.textContent = pf; });
    document.querySelectorAll('.add_pay.price_font, .add_pay').forEach(function(el) { el.textContent = pf; });
    document.querySelectorAll('.settle_amount, .final_amount').forEach(function(el) { el.textContent = pf; });

    // ── buy 페이지: 판매수량 컨트롤 숨기기 ──────────────
    if (type === 'buy') {
      var buyInfoDl = document.querySelector('.buy_info dl');
      if (buyInfoDl) buyInfoDl.style.setProperty('display', 'none', 'important');
    }

    // ── 게임/서버/카테고리 breadcrumb (.kind) ────────────
    var kindEl = document.querySelector('.kind');
    if (kindEl) {
      var crumb = p.gameName || '게임';
      if (p.serverName) crumb += ' &gt; ' + p.serverName;
      if (p.itemCategory) crumb += ' &gt; ' + p.itemCategory;
      kindEl.innerHTML = crumb;
    }

    // ── 판매자 grade 배지 (.credit_mark) + 이름 ─────────
    (function() {
      var GRADE_LTR = { vip:'V', platinum:'P', gold:'G', silver:'S', bronze:'B' };
      var GRADE_NM  = { vip:'VIP', platinum:'PLATINUM', gold:'GOLD', silver:'SILVER', bronze:'BRONZE' };
      var ALL_G = ['vip','platinum','gold','silver','bronze'];
      var creditMark = document.querySelector('.user_info .credit_mark');
      if (creditMark && p.sellerId) {
        creditMark.setAttribute('data-seller-id', String(p.sellerId));
        ALL_G.forEach(function(g) { creditMark.classList.remove(g); });
        var gk = p.sellerGrade && GRADE_LTR[p.sellerGrade] ? p.sellerGrade : null;
        if (gk) {
          creditMark.classList.add(gk);
          creditMark.textContent = GRADE_LTR[gk];
        } else {
          creditMark.classList.add('regular');
          creditMark.textContent = '';
        }
      }
      // .vip_txt — 등급 명칭 텍스트 (e.g. "VIP") + data-seller-id
      var vipTxt = document.querySelector('.vip_txt');
      if (vipTxt && p.sellerId) {
        vipTxt.setAttribute('data-seller-id', String(p.sellerId));
        var gk2 = p.sellerGrade && GRADE_NM[p.sellerGrade] ? p.sellerGrade : null;
        vipTxt.textContent = gk2 ? GRADE_NM[gk2] : '';
      }
      // The only existing strong in some snapshots is .vip_txt (the grade
      // label). Never replace it with the seller's name.
      if (p.sellerName) {
        var sellerEl = document.querySelector('.user_nick, .user_info strong:not(.vip_txt)');
        if (sellerEl) sellerEl.textContent = p.sellerName;
        else {
          var userInfo = document.querySelector('.user_info');
          if (userInfo) {
            sellerEl = document.createElement('strong');
            sellerEl.className = 'user_nick';
            sellerEl.style.cssText = 'font-size:15px;font-weight:700;margin-right:6px';
            sellerEl.textContent = p.sellerName;
            userInfo.insertBefore(sellerEl, userInfo.firstChild);
          }
        }
      }
    })();

    // ── 상세 설명 ─────────────────────────────────────────
    var descEl = document.querySelector('.ql-editor.detail_text');
    if (descEl) {
      if (p._source === 'itemmania') {
        // 아이템마니아 상품: 상세 설명 없음 안내 (스냅샷 내용 유지하지 않음)
        descEl.innerHTML = '<p style="color:#888">상세 설명은 판매자에게 채팅으로 문의해주세요.</p>';
      } else if (p.description) {
        descEl.innerHTML = '<p>' + p.description.replace(/\\n/g, '</p><p>') + '</p>';
      } else {
        descEl.innerHTML = '<p>상세 설명이 없습니다.</p>';
      }
    }

    // ── 구매수량/구매할인 섹션 처리 ──────────────────────
    // DB 상품: 항상 수량 컨트롤 표시
    // 아이템마니아 상품: 게임머니 카테고리만 표시, 나머지(아이템/계정 등) 숨김
    if (p._source === 'itemmania') {
      var moneyKws = ['머니', '아데나', '골드', '재화', '코인', '냥', '젠', '실버', '크로나', '베릴', '금화'];
      var cat = (p.itemCategory || '').toString();
      var isGameMoney = moneyKws.some(function(kw) { return cat.indexOf(kw) >= 0; });
      if (!isGameMoney) {
        var buyInfo = document.querySelector('.buy_info');
        if (buyInfo) buyInfo.style.setProperty('display', 'none', 'important');
      }
    }

    // 수량 컨트롤은 SELL_APPLICATION_INTERCEPT_SCRIPT의 init()에서
    // document 레벨 위임으로 처리하므로 여기서는 생략

    // ── 구매 박스 렌더링 ──────────────────────────────────
    if (p._source !== 'itemmania') {
      renderBuyBox(p);
    }
  }

  // snapshot JS가 DOM을 덮어쓸 때 즉시 재주입 (MutationObserver + retry)
  function runInject(p) {
    window._IM_PRODUCT = p;
    injectProduct(p);

    // 주요 요소를 감시하다가 snapshot JS가 바꾸면 즉시 재주입
    var watchRoot = document.querySelector('.trade_area, .g_body_wrap, main, body');
    if (watchRoot) {
      var busy = false;
      var observer = new MutationObserver(function() {
        if (busy) return;
        busy = true;
        // disconnect 후 재주입 → 다시 연결 (무한루프 방지)
        observer.disconnect();
        injectProduct(p);
        setTimeout(function() {
          busy = false;
          if (watchRoot) observer.observe(watchRoot, { childList: true, subtree: true, characterData: true });
        }, 120);
      });
      observer.observe(watchRoot, { childList: true, subtree: true, characterData: true });
      // 12초 후 해제
      setTimeout(function() { observer.disconnect(); }, 12000);
    }

    // 초기 타이밍 보장용 retry
    [400, 1200, 3000, 6000].forEach(function(ms) {
      setTimeout(function() { injectProduct(p); }, ms);
    });
  }

  function loadProduct() {
    // 서버에서 미리 주입된 데이터 우선 사용 (race condition 없음)
    if (window.__PRODUCT__) { runInject(window.__PRODUCT__); return; }

    fetch('/api/products/' + productId, { credentials: 'include' })
      .then(function(r) {
        // HTTP 에러(404/500 등)도 error 객체로 통일
        if (!r.ok) return { error: 'not_found' };
        return r.json();
      })
      .then(function(p) {
        if (p.error) {
          // DB에 없는 상품 → sessionStorage 폴백 (아이템마니아 상품)
          var stored = null;
          try { stored = JSON.parse(sessionStorage.getItem('_im_card_' + productId) || 'null'); } catch(ex) {}
          if (stored) { runInject(stored); }
          return;
        }
        runInject(p);
      })
      .catch(function() {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadProduct);
  else loadProduct();
})();
</script>
`;

const BUY_INTERCEPT_SCRIPT = `
<script>
(function() {
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  // ── search_game으로 게임명 + 서버필터 동적 교체 (기본 HTML은 리니지클래식) ───────
  (function() {
    var _gc = new URLSearchParams(location.search).get('search_game') || '5913';
    if (_gc === '5913') return;
    fetch('/api/games/bycode/' + encodeURIComponent(_gc), { credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(g) {
        if (!g || !g.name) return;
        var gn = g.name;
        function replaceText(node) {
          if (node.nodeType === 3) {
            if (node.nodeValue.indexOf('리니지클래식') >= 0) {
              node.nodeValue = node.nodeValue.replace(/리니지클래식/g, gn);
            }
          } else if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
            for (var i = 0; i < node.childNodes.length; i++) replaceText(node.childNodes[i]);
          }
        }
        replaceText(document.body);
        document.title = document.title.replace(/리니지클래식/g, gn);
        /* ── 서버 필터 버튼 동적 교체 ── */
        if (g.id) {
          fetch('/api/games/' + g.id + '/servers', { credentials: 'include' })
            .then(function(rs) { return rs.ok ? rs.json() : []; })
            .then(function(servers) {
              if (!servers || !servers.length) return;
              var serverList = document.getElementById('search_server_list');
              if (!serverList) return;
              var currentSv = new URLSearchParams(location.search).get('search_server') || '';
              var ul = serverList.querySelector('ul');
              if (ul) {
                var firstLi = ul.querySelector('li:first-child');
                ul.innerHTML = '';
                if (firstLi) { var fi = firstLi.querySelector('input'); if (fi) fi.checked = !currentSv; ul.appendChild(firstLi); }
                servers.forEach(function(sv) {
                  var li = document.createElement('li');
                  var uid = 'row_server_dyn_' + sv.id;
                  li.innerHTML = '<input id="' + uid + '" type=checkbox name=row_server value="' + sv.name + '" class=g_btn_white2_radio' + (currentSv === sv.name ? ' checked' : '') + '><label for="' + uid + '">' + sv.name + '</label>';
                  ul.appendChild(li);
                });
              } else {
                /* <ul> 없이 input+label 직접 자식 구조 */
                var allInps = Array.from(serverList.querySelectorAll('input[name=row_server]'));
                var firstInp = allInps[0] || null;
                var firstLbl = firstInp ? serverList.querySelector('label[for="' + firstInp.id + '"]') : null;
                serverList.innerHTML = '';
                if (firstInp) { firstInp.checked = !currentSv; serverList.appendChild(firstInp); }
                if (firstLbl) serverList.appendChild(firstLbl);
                servers.forEach(function(sv) {
                  var uid = 'row_server_dyn_' + sv.id;
                  var inp = document.createElement('input');
                  inp.id = uid; inp.type = 'checkbox'; inp.name = 'row_server';
                  inp.value = sv.name; inp.className = 'g_btn_white2_radio';
                  if (currentSv === sv.name) inp.checked = true;
                  var lbl = document.createElement('label');
                  lbl.setAttribute('for', uid); lbl.textContent = sv.name;
                  serverList.appendChild(inp);
                  serverList.appendChild(lbl);
                });
              }
            })
            .catch(function() {});
        }
      })
      .catch(function() {});
  })();

  function init() {
    // ── buy list: 스냅샷의 sell 원본 상품 제거 (sell 스냅샷 재사용 시) ───
    // SELL_LIST_INTERCEPT_SCRIPT가 origNormalItems를 수집하기 전에 비워야 함
    // (BUY_INTERCEPT_SCRIPT가 먼저 주입·실행됨)
    if (location.pathname.indexOf('/buy/list') >= 0) {
      var _nl = document.querySelector('ul.search_list_normal');
      var _pl = document.querySelector('ul.search_list_premium');
      if (_nl) _nl.innerHTML = '';
      if (_pl) _pl.innerHTML = '';
      // 검색창에 남아있는 게임명 업데이트 (searchRegGameServer value)
      var _gc = new URLSearchParams(location.search).get('search_game') || '5913';
      if (_gc !== '5913') {
        fetch('/api/games/bycode/' + encodeURIComponent(_gc), { credentials: 'include' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(g) {
            if (!g || !g.name) return;
            var gn = g.name;
            // 검색창 input value 교체
            var inp = document.getElementById('searchRegGameServer');
            if (inp) inp.value = gn;
            // 헤더 검색창
            var mainInp = document.querySelector('input.search-input, input[placeholder*="게임명"]');
            if (mainInp) mainInp.value = gn;
            // 텍스트 노드 교체
            function replaceText(node) {
              if (node.nodeType === 3) {
                if (node.nodeValue.indexOf('리니지클래식') >= 0)
                  node.nodeValue = node.nodeValue.replace(/리니지클래식/g, gn);
              } else if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
                for (var i = 0; i < node.childNodes.length; i++) replaceText(node.childNodes[i]);
              }
            }
            replaceText(document.body);
            document.title = document.title.replace(/리니지클래식/g, gn);
            /* ── 서버 필터 버튼 동적 교체 (buy list) ── */
            if (g.id) {
              fetch('/api/games/' + g.id + '/servers', { credentials: 'include' })
                .then(function(rs) { return rs.ok ? rs.json() : []; })
                .then(function(servers) {
                  if (!servers || !servers.length) return;
                  var serverList = document.getElementById('search_server_list');
                  if (!serverList) return;
                  var currentSv2 = new URLSearchParams(location.search).get('search_server') || '';
                  var ul2 = serverList.querySelector('ul');
                  if (ul2) {
                    var firstLi2 = ul2.querySelector('li:first-child');
                    ul2.innerHTML = '';
                    if (firstLi2) { var fi2 = firstLi2.querySelector('input'); if (fi2) fi2.checked = !currentSv2; ul2.appendChild(firstLi2); }
                    servers.forEach(function(sv) {
                      var li = document.createElement('li');
                      var uid = 'row_server_dyn_' + sv.id;
                      li.innerHTML = '<input id="' + uid + '" type=checkbox name=row_server value="' + sv.name + '" class=g_btn_white2_radio' + (currentSv2 === sv.name ? ' checked' : '') + '><label for="' + uid + '">' + sv.name + '</label>';
                      ul2.appendChild(li);
                    });
                  } else {
                    var allInps2 = Array.from(serverList.querySelectorAll('input[name=row_server]'));
                    var firstInp2 = allInps2[0] || null;
                    var firstLbl2 = firstInp2 ? serverList.querySelector('label[for="' + firstInp2.id + '"]') : null;
                    serverList.innerHTML = '';
                    if (firstInp2) { firstInp2.checked = !currentSv2; serverList.appendChild(firstInp2); }
                    if (firstLbl2) serverList.appendChild(firstLbl2);
                    servers.forEach(function(sv) {
                      var uid = 'row_server_dyn_' + sv.id;
                      var inp = document.createElement('input');
                      inp.id = uid; inp.type = 'checkbox'; inp.name = 'row_server';
                      inp.value = sv.name; inp.className = 'g_btn_white2_radio';
                      if (currentSv2 === sv.name) inp.checked = true;
                      var lbl = document.createElement('label');
                      lbl.setAttribute('for', uid); lbl.textContent = sv.name;
                      serverList.appendChild(inp);
                      serverList.appendChild(lbl);
                    });
                  }
                })
                .catch(function() {});
            }
          })
          .catch(function() {});
      }
    }

    // ── 상품등록(구매등록) 버튼 → /buy/register.html ──────────────────
    // trade-btn-blue 클릭: buy list에서는 모달 없이 바로 구매등록으로
    document.querySelectorAll('a.trade-btn-blue, .trade-btn a').forEach(function(a) {
      a.setAttribute('href', '/buy/register.html');
      a.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        location.href = '/buy/register.html';
      }, true);
    });

    // 삽니다 탭 active 표시 (buy list에서는 삽니다가 선택됨)
    document.querySelectorAll('button[data-type="sell"]').forEach(function(btn) {
      btn.classList.remove('selected'); btn.textContent = '팝니다';
    });
    document.querySelectorAll('button[data-type="buy"]').forEach(function(btn) {
      btn.classList.add('selected'); btn.textContent = '삽니다';
    });

    // 팝니다 탭 → 판매 목록으로 이동 (search_game 유지)
    document.querySelectorAll('button[data-type="sell"]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var params = new URLSearchParams(location.search);
        var game = params.get('search_game') || '5913';
        location.href = '/sell/list.html?search_game=' + game;
      }, true);
    });

    // 채팅 버튼 (헤더) → 별도 창
    var chatBtn = document.querySelector('#chat_notice button');
    if (chatBtn) {
      chatBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
      }, true);
    }

    // 헤더 로그인/로그아웃
    var loginBtn = document.querySelector('.header-logins button');
    if (loginBtn) {
      loginBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        try{sessionStorage.setItem('_im_login_next',location.href);}catch(ex){} location.href = '/login';
      }, true);
    }

    // 삽니다 상품 리스트 아이템 클릭 → 상세 페이지 이동
    document.body.addEventListener('click', function(e) {
      var li = e.target.closest && e.target.closest('li.list_item[data-tid]');
      if (li) {
        var tid = li.getAttribute('data-tid');
        if (tid) {
          e.preventDefault(); e.stopPropagation();
          try {
            var titleEl = li.querySelector('.kind_title');
            var priceEl = li.querySelector('.trade_money');
            var serverEls = li.querySelectorAll('.server li a');
            var servers = Array.prototype.map.call(serverEls, function(a) { return a.textContent.trim(); });
            var priceNode = priceEl ? priceEl.firstChild : null;
            var priceNum = priceNode ? parseInt((priceNode.textContent || '').replace(/[^0-9]/g, ''), 10) || 0 : 0;
            var card = {
              id: tid,
              title: titleEl ? titleEl.textContent.trim() : '',
              price: priceNum,
              priceRaw: priceEl ? priceEl.textContent.trim() : '',
              gameName: servers[0] || '',
              serverName: servers[1] || '',
              itemCategory: servers[2] || '',
              sellerName: '', description: '',
              _source: 'itemmania'
            };
            sessionStorage.setItem('_im_card_' + tid, JSON.stringify(card));
          } catch(ex) {}
          location.href = '/buy/application.html?id=' + tid;
        }
      }
    }, true);

    // 로그인 상태 반영
    window._IM_auth().then(function(data){
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(e){
            e.stopImmediatePropagation();
            api('POST', '/auth/logout').then(function(){ location.href='/'; });
          }, true);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

const BUY_CHAT_HEAD_INTERCEPT = `<script>
document.addEventListener('click', function(e) {
  var btn = e.target && e.target.closest ? e.target.closest('button.go_chat, button[name=go_chat]') : null;
  if (!btn) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (window._im_on_buy_chat) window._im_on_buy_chat();
}, true);
</script>`;

const BUY_APPLICATION_INTERCEPT_SCRIPT = `
<script>
(function() {
  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.json(); }).catch(function(){ return {}; });
  }

  function showLoginModal() {
    try { sessionStorage.setItem('_im_login_next', location.href); } catch(ex) {}
    location.href = '/login';
  }

  function showApplicationToast(msg, error) {
    var previous = document.getElementById('_im_sale_application_toast');
    if (previous) previous.remove();
    var toast = document.createElement('div');
    toast.id = '_im_sale_application_toast';
    toast.setAttribute('role', error ? 'alert' : 'status');
    toast.style.cssText = 'position:fixed;top:24px;right:24px;z-index:2147483647;' +
      'background:#fff;color:#222;border-left:4px solid ' + (error ? '#e53e3e' : '#00b767') + ';' +
      'border-radius:8px;padding:15px 20px;box-shadow:0 5px 24px rgba(0,0,0,.2);' +
      'font-size:15px;font-weight:700;max-width:320px';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 4000);
  }
  window._im_notify_sale_application = showApplicationToast;

  var _loggedIn = null;
  var applicationPending = false;
  function checkLogin() {
    if (_loggedIn !== null) return Promise.resolve(_loggedIn);
    return window._IM_auth().then(function(d){ _loggedIn = !!(d && d.id); return _loggedIn; });
  }

  function updateBuyerInfo() {
    var p = window.__PRODUCT__;
    if (!p) return;
    var GRADE_LTR = { vip:'V', platinum:'P', gold:'G', silver:'S', bronze:'B' };
    var GRADE_NM  = { vip:'VIP', platinum:'PLATINUM', gold:'GOLD', silver:'SILVER', bronze:'BRONZE' };
    var ALL_G = ['vip','platinum','gold','silver','bronze'];

    // 구매자 등급 배지 교체
    var creditMark = document.querySelector('.user_info .credit_mark');
    if (creditMark) {
      ALL_G.forEach(function(g) { creditMark.classList.remove(g); });
      var gk = p.sellerGrade && GRADE_LTR[p.sellerGrade] ? p.sellerGrade : null;
      if (gk) {
        creditMark.classList.add(gk);
        creditMark.textContent = GRADE_LTR[gk];
      } else {
        creditMark.classList.add('regular');
        creditMark.textContent = '';
      }
    }

    // vip_txt (등급명) + 그 뒤 텍스트 노드(신용점수)
    var vipTxt = document.querySelector('.user_info .vip_txt');
    if (vipTxt) {
      var gk2 = p.sellerGrade && GRADE_NM[p.sellerGrade] ? p.sellerGrade : null;
      vipTxt.textContent = gk2 ? GRADE_NM[gk2] : '';
      // 신용점수 텍스트 노드 교체 (vip_txt 다음 텍스트 노드)
      var scoreText = vipTxt.nextSibling;
      var score = (p.sellerCreditScore !== null && p.sellerCreditScore !== undefined)
        ? Number(p.sellerCreditScore).toLocaleString('ko-KR') + '점'
        : '0점';
      if (scoreText && scoreText.nodeType === 3) {
        scoreText.nodeValue = ' ' + score + ' ';
      } else {
        var tn = document.createTextNode(' ' + score + ' ');
        if (vipTxt.nextSibling) vipTxt.parentNode.insertBefore(tn, vipTxt.nextSibling);
        else vipTxt.parentNode.appendChild(tn);
      }
    }

    // 구매자 닉네임 표시 (user_nick 또는 user_info strong:not(.vip_txt))
    if (p.sellerName) {
      var nameEl = document.querySelector('.user_nick, .user_info strong:not(.vip_txt)');
      if (nameEl) nameEl.textContent = p.sellerName;
      else {
        // user_info 상단에 닉네임 추가
        var uiDiv = document.querySelector('.user_info');
        if (uiDiv) {
          var sp = document.createElement('strong');
          sp.className = 'user_nick';
          sp.style.cssText = 'font-size:15px;font-weight:700;margin-right:6px';
          sp.textContent = p.sellerName;
          uiDiv.insertBefore(sp, uiDiv.firstChild);
        }
      }
    }

    // 인증 상태 배지 (우수인증·휴대폰·이메일·출금계좌)
    var as = p.sellerAuthStates || {};
    var certItems = document.querySelectorAll('ul.add_info .cert_state');
    var authMap = [
      { key: 'excellent', label: '우수인증' },
      { key: 'phone', label: '휴대폰' },
      { key: 'email', label: '이메일' },
      { key: 'withdraw', label: '출금계좌' },
    ];
    certItems.forEach(function(el, i) {
      var am = authMap[i];
      if (!am) return;
      el.textContent = am.label;
      if (as[am.key]) el.classList.add('on'); else el.classList.remove('on');
    });

  }

  function fixBuyPagePriceAndQty() {
    var p = window.__PRODUCT__;
    if (!p) return;
    var unitPrice = Number(p.price || 0);
    var price = unitPrice.toLocaleString('ko-KR');

    // sell_quantity 값 읽어 총 판매금액 계산 (기본값 1)
    var qtyInp = document.getElementById('sell_quantity');
    var qty = qtyInp ? Math.max(1, parseInt(qtyInp.value, 10) || 1) : 1;
    var total = (unitPrice * qty).toLocaleString('ko-KR');

    // 판매금액 = 단가 (항상 덮어쓰기)
    var tm = document.getElementById('trade_money');
    if (tm) tm.textContent = price;
    // 총 판매금액 = qty × 단가 (항상 덮어쓰기)
    var pm = document.getElementById('pay_mileage');
    if (pm) pm.textContent = total;
  }

  function openProductLoginPopup(p, intent) {
    if (!p || !p.id || !p.sellerId) {
      showApplicationToast('채팅할 상대방 정보를 찾을 수 없습니다.', true);
      return false;
    }
    var returnPath = location.pathname + location.search;
    if (intent === 'sale') {
      sessionStorage.removeItem('_im_product_chat_after_login');
      sessionStorage.removeItem('_im_sale_after_login');
      sessionStorage.removeItem('_im_chat_after_login');
      sessionStorage.setItem('_im_login_next', returnPath);
      location.href = '/login?returnUrl=' + encodeURIComponent(returnPath);
      return false;
    }
    var popup = (window._nativeOpen || window.open.bind(window))(
      'about:blank', 'im_product_chat_' + p.id, 'width=900,height=700,resizable=yes,scrollbars=yes'
    );
    if (!popup || popup.closed) {
      showApplicationToast('채팅 팝업을 허용한 뒤 다시 시도해 주세요.', true);
      return false;
    }
    try {
      popup.document.body.textContent = '로그인 후 채팅방을 준비 중입니다...';
      popup.sessionStorage.setItem('_im_login_next', returnPath);
      popup.sessionStorage.removeItem('_im_chat_after_login');
      popup.sessionStorage.removeItem('_im_sale_after_login');
      popup.sessionStorage.setItem('_im_product_chat_after_login', JSON.stringify({
        returnPath: returnPath, productId: Number(p.id), buyerId: Number(p.sellerId), intent: intent
      }));
      popup.location.replace('/login?returnUrl=' + encodeURIComponent(returnPath));
    } catch(ex) {
      popup.close();
      showApplicationToast('로그인 팝업을 열 수 없습니다. 다시 시도해 주세요.', true);
    }
    return false;
  }

  function openBuyProductChat(user, resumed) {
    var p = window.__PRODUCT__;
    if (!p || !p.sellerId) {
      alert('이 상품은 채팅할 상대방 정보가 없습니다.');
      return;
    }
    if (Number(p.sellerId) === Number(user.id)) {
      alert('자신의 글에는 채팅할 수 없습니다.');
      return;
    }
    var isLoginPopup = resumed && window.opener && window.name.indexOf('im_product_chat_') === 0;
    var popup = isLoginPopup ? window : (window._nativeOpen || window.open.bind(window))(
      'about:blank', 'im_product_chat_' + p.id, 'width=900,height=700,resizable=yes,scrollbars=yes'
    );
    if (!popup || popup.closed) {
      alert('채팅 팝업을 허용한 뒤 다시 시도해 주세요.');
      return;
    }
    if (popup && popup !== window && !popup.closed) {
      try { popup.document.body.textContent = '채팅방을 준비 중입니다...'; } catch(ex) {}
    }
    fetch('/api/chat/rooms', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId: Number(p.sellerId), productId: Number(p.id) })
    }).then(function(r) {
      return r.json().then(function(room) {
        if (!r.ok) throw new Error(room.error || '채팅방을 만들 수 없습니다.');
        return room;
      });
    }).then(function(room) {
      if (!room || !room.id) throw new Error('채팅방을 찾을 수 없습니다.');
      var chatUrl = '/myroom/chat/new_chat.html?roomId=' + room.id;
      if (popup && !popup.closed) popup.location.replace(chatUrl);
      else alert('채팅 팝업이 닫혔습니다. 다시 시도해 주세요.');
    }).catch(function(err) {
      if (popup && popup !== window && !popup.closed) popup.close();
      alert(err.message || '채팅방을 열 수 없습니다.');
    });
  }

  window._im_on_buy_chat = function() {
    var user = window._IM_USER;
    if (!user || !user.id) {
      return openProductLoginPopup(window.__PRODUCT__ || {}, 'chat');
    }
    openBuyProductChat(user, false);
    return false;
  };

  function init() {
    updateBuyerInfo();

    // 검색창 게임명 교체 (스냅샷 하드코딩 "리니지클래식" → 실제 상품 게임명)
    (function() {
      var _prod = window.__PRODUCT__;
      if (_prod && _prod.gameName) {
        var _gsInp = document.getElementById('searchGameServer');
        if (_gsInp) _gsInp.value = _prod.gameName;
        var _gsInp2 = document.querySelector('input.search_gs_name:not(#searchGameServer)');
        if (_gsInp2) _gsInp2.value = _prod.gameName;
      }
    })();

    // buy 페이지 전용: 가격·수량 컨트롤 고정 (스냅샷 JS 덮어쓰기 방지)
    fixBuyPagePriceAndQty();
    var _fixInterval = setInterval(fixBuyPagePriceAndQty, 300);
    setTimeout(function() { clearInterval(_fixInterval); }, 10000);

    // (판매신청 버튼 핸들러는 IIFE 최상위 레벨에서 즉시 등록됨 — 아래 참조)

    // form submit 차단 (frmSell) — capture로 스냅샷보다 먼저 실행
    var form = document.getElementById('frmSell');
    if (form) {
      form.addEventListener('submit', function(e){ e.preventDefault(); e.stopImmediatePropagation(); }, true);
    }

    // 찜하기 버튼
    document.querySelectorAll('button.btn_fav, button.btn_fav2').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        checkLogin().then(function(ok) {
          if (!ok) { showLoginModal(); return; }
          btn.textContent = '찜완료 ♥';
          btn.style.color = '#ff4d4d';
        });
      }, true);
    });

    // 헤더 채팅 버튼
    var chatBtn = document.querySelector('#chat_notice button');
    if (chatBtn) {
      chatBtn.addEventListener('click', function(e) {
        e.preventDefault(); e.stopImmediatePropagation();
        window.open('/myroom/chat/list.html', '_blank', 'width=900,height=700,resizable=yes,scrollbars=yes');
      }, true);
    }

    // 로그인 상태 반영
    window._IM_auth().then(function(data){
      _loggedIn = !!(data && data.id);
      if (data && data.id) {
        var loginsDiv = document.querySelector('.header-logins');
        if (loginsDiv) {
          loginsDiv.innerHTML =
            '<span style="font-size:14px;font-weight:600;color:#2e2e2e">' + (data.nickname || data.email) + '님</span>' +
            '<div class="divider"></div>' +
            '<button type="button" id="_im_logout_btn" style="font-size:14px;font-weight:600;background:none;border:none;cursor:pointer;color:#2e2e2e">로그아웃</button>';
          document.getElementById('_im_logout_btn').addEventListener('click', function(e){
            e.stopImmediatePropagation();
            api('POST', '/auth/logout').then(function(){ location.href='/'; });
          }, true);
        }
      }
    });

    // 판매신청은 로그인 후 직접 눌러야 한다. 일반 채팅 요청만 재개한다.
    try {
      var currentPath = location.pathname + location.search;
      var isChatPopup = window.opener && window.name.indexOf('im_product_chat_') === 0;
      if (isChatPopup && window._IM_USER && window._IM_USER.id) {
        if (sessionStorage.getItem('_im_sale_after_login') === currentPath) {
          sessionStorage.removeItem('_im_sale_after_login');
          sessionStorage.removeItem('_im_chat_after_login');
          sessionStorage.removeItem('_im_product_chat_after_login');
          window.name = '';
        } else if (sessionStorage.getItem('_im_chat_after_login') === currentPath) {
          sessionStorage.removeItem('_im_chat_after_login');
          openBuyProductChat(window._IM_USER, true);
        }
      }
    } catch(ex) {}
  }

  // ── 판매신청 버튼 핸들러: IIFE 최상위에서 즉시 등록 (DOMContentLoaded 대기 없음) ──
  window._im_on_sell_btn = function(btn, resumed) {
    if (applicationPending) return false;
    var user = window._IM_USER;
    if (!user || !user.id) {
      return openProductLoginPopup(window.__PRODUCT__ || {}, 'sale');
    }
    var p = window.__PRODUCT__;
    if (!p || !p.id || !p.sellerId) {
      showApplicationToast('채팅할 구매자 정보를 찾을 수 없습니다.', true);
      return false;
    }
    if (Number(p.sellerId) === Number(user.id)) {
      showApplicationToast('자신의 글에는 판매신청할 수 없습니다.', true);
      return false;
    }
    var characterInput = document.getElementById('user_character');
    var characterName = characterInput ? characterInput.value.trim() : '';
    if (!characterName) {
      showApplicationToast('캐릭터명을 입력한 후 판매신청해 주세요.', true);
      if (characterInput) characterInput.focus();
      return false;
    }
    var popup = window;
    applicationPending = true;
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '처리 중...';
    fetch('/api/chat/rooms', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId: Number(p.sellerId), productId: Number(p.id),
        characterName: characterName })
    }).then(function(r) {
      return r.json().then(function(room) {
        if (!r.ok) throw new Error(room.error || '판매신청에 실패했습니다.');
        return room;
      });
    })
    .then(function(room) {
      if (!room || !room.id) throw new Error('채팅방을 열 수 없습니다.');
      if (popup.closed) throw new Error('채팅 팝업이 닫혔습니다. 다시 시도해 주세요.');
      if (popup === window && window.opener && !window.opener.closed && window.opener._im_notify_sale_application) {
        window.opener._im_notify_sale_application('판매신청이 되었습니다', false);
      } else {
        showApplicationToast('판매신청이 되었습니다', false);
      }
      popup.location.replace('/myroom/sell/sell_ing.html?roomId=' + room.id);
      if (popup === window) {
        try { if (window.opener && !window.opener.closed) window.opener.location.href = '/myroom/sell/sell_ing.html'; } catch(ex) {}
      } else {
        location.href = '/myroom/sell/sell_ing.html';
      }
      setTimeout(function() { if (!popup.closed) popup.focus(); }, 700);
    }).catch(function(err) {
      if (popup !== window && !popup.closed) popup.close();
      showApplicationToast(err.message || '판매신청에 실패했습니다.', true);
    }).finally(function() {
      applicationPending = false;
      btn.disabled = false;
      btn.textContent = originalLabel;
    });
    return false;
  };

  // document 레벨 capture 위임: DOMContentLoaded 전에도 즉시 활성
  document.addEventListener('click', function(e) {
    var tgt = e.target;
    if (!tgt) return;
    var btn = tgt.classList && tgt.classList.contains('btn_green')
      ? tgt
      : (tgt.closest ? tgt.closest('button.btn_green') : null);
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();
    window._im_on_sell_btn(btn);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>
`;

function serveBuyApplication(html: string, user: Record<string, unknown> | null = null, product: Record<string, unknown> | null = null, siteUrl = 'https://itenmania.com'): string {
  let result = prepare(html, user);
  if (product) {
    // 서버 사이드에서 스냅샷 HTML 내 하드코딩된 값을 DB 데이터로 직접 교체 (serveApplication과 동일)
    result = applyProductToHtml(result, product, siteUrl);
    const ps = BUY_CHAT_HEAD_INTERCEPT + buildProductScript(product);
    result = result.includes("<head>")
      ? result.replace("<head>", "<head>" + ps)
      : result.replace("<body", ps + "<body");
  }
  // btn_green에 onclick 직접 주입 (document 위임 핸들러와 이중 보호)
  result = result.replace(
    '<button type=button class=btn_green>판매신청</button>',
    '<button type=button class=btn_green onclick="window._im_on_sell_btn&&window._im_on_sell_btn(this);return false;">판매신청</button>'
  );
  result = result.replace(
    '<button type=button class=go_chat name=go_chat>채팅</button>',
    '<button type=button class=go_chat name=go_chat onclick="window._im_on_buy_chat&&window._im_on_buy_chat();return false;">채팅</button>'
  );
  const combined = BUY_APPLICATION_INTERCEPT_SCRIPT + APPLICATION_DYNAMIC_SCRIPT;
  result = applyProductMemberStatus(result);
  return result.includes("</body>")
    ? result.replace("</body>", combined + "</body>")
    : result + combined;
}

// product가 DB에 없을 때 — Discord 봇은 OG 태그로 이미지를 읽고, 사람은 목록 페이지로 이동
function serveOgFallback(_html: string, siteUrl: string, type: "sell" | "buy", rawId: string): string {
  const listPath = `/${type}/list.html`;
  const ogImgUrl = `${siteUrl}/og-image/default`;
  const ogTitle = '아이템매니아 — 안전한 아이템 거래';
  const ogDesc  = '아이템매니아에서 안전하게 게임 아이템을 거래하세요.';
  const ogUrl   = `${siteUrl}/${type}/application.html${rawId ? '?id=' + encodeURIComponent(rawId) : ''}`;

  // Never return a real captured listing for a missing product. With JS disabled
  // or before redirect, that exposed the captured owner's and viewer's data.
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ogTitle}</title><meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:image" content="${escHtml(ogImgUrl)}">
<meta name="twitter:image" content="${escHtml(ogImgUrl)}">
<meta property="og:url" content="${escHtml(ogUrl)}">
</head><body><p>물품을 찾을 수 없습니다.</p><a href="${listPath}">목록으로 돌아가기</a>
<script>location.replace(${JSON.stringify(listPath)});</script></body></html>`;
}

function serveBuy(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  const combined = BUY_INTERCEPT_SCRIPT + SELL_LIST_INTERCEPT_SCRIPT;
  return result.includes("</body>")
    ? result.replace("</body>", combined + "</body>")
    : result + combined;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 스냅샷 HTML에 하드코딩된 상품 데이터를 DB 상품 데이터로 서버 사이드 교체.
 * JavaScript 실행 타이밍 경쟁 없이 HTML 자체가 올바른 데이터를 갖게 됨.
 */
function applyProductToHtml(html: string, p: Record<string, unknown>, siteUrl = 'https://itenmania.com'): string {
  let r = html;
  const title = escHtml(String(p.title || ''));
  const price = Number(p.price || 0).toLocaleString('ko-KR');
  // 1. <title> 태그 — 사용자가 등록한 제목 그대로
  r = r.replace(/<title>[^<]*<\/title>/, `<title>${title} | 아이템매니아</title>`);

  // 2. 숨겨진 h1.g_hidden 제목 교체
  r = r.replace(/<h1[^>]*class="[^"]*g_hidden[^"]*"[^>]*>OOOO+[^<]*OOOO+<\/h1>/, `<h1 class="g_hidden sf-hidden">${title}</h1>`);

  // og:image / twitter:image — 항상 우리 서버에 저장된 기본 이미지 사용 (외부 CDN 의존 없음)
  const ogImgUrl = `${siteUrl}/og-image/default`;
  r = r.replace(
    /(<meta[^>]*property=og:image[^>]*content=)[^\s>]+/g,
    `$1${ogImgUrl}`
  );
  r = r.replace(
    /(<meta[^>]*name=twitter:image[^>]*content=)[^\s>]+/g,
    `$1${ogImgUrl}`
  );

  // og:title / twitter:title — 사용자가 등록한 제목 그대로
  r = r.replace(
    /(<meta[^>]*property=og:title[^>]*content=")[^"]*(" *[/]?>)/,
    `$1${title} | 아이템매니아$2`
  );
  r = r.replace(
    /(<meta[^>]*name=twitter:title[^>]*content=")[^"]*(" *[/]?>)/,
    `$1${title} | 아이템매니아$2`
  );

  // og:description / twitter:description — 사용자가 작성한 내용 그대로
  const ogDesc = escHtml(String(p.description || p.title || '').replace(/\s+/g, ' ').trim().slice(0, 200));
  if (ogDesc) {
    r = r.replace(
      /(<meta[^>]*property=og:description[^>]*content=")[^"]*(")/,
      `$1${ogDesc}$2`
    );
    r = r.replace(
      /(<meta[^>]*name=twitter:description[^>]*content=")[^"]*(")/,
      `$1${ogDesc}$2`
    );
  }

  // og:url — 절대 URL로 교체 (itemmania.com 도메인 또는 상대경로 모두 처리)
  const productPath = `/sell/application.html?id=${p.id}`;
  const absoluteOgUrl = `${siteUrl}${productPath}`;
  r = r.replace(
    /(<meta[^>]*property=og:url[^>]*content=")(?:https?:\/\/(?:www\.)?itemmania\.com)?[^"]*(")/,
    `$1${absoluteOgUrl}$2`
  );
  r = r.replace(
    /(<meta[^>]*name=twitter:url[^>]*content=")(?:https?:\/\/(?:www\.)?itemmania\.com)?[^"]*(")/,
    `$1${absoluteOgUrl}$2`
  );

  // JSON-LD "name" 필드 교체
  r = r.replace(/"name":"OOOO+[^"]*OOOO+"/, `"name":${JSON.stringify(title)}`);

  // 3. .trade_subject 내 제목 텍스트 (signboard span 이후 텍스트 노드 교체)
  // sell 스냅샷은 OOOOO(5개), buy 스냅샷은 OOOO(4개) 사용 → OOOO+ 로 통합
  r = r.replace(
    /(<div class=trade_subject>[\s\S]*?<span class=signboard>[^<]*<\/span>[^<]*)OOOO+[^\n]*OOOO+\s*/,
    `$1${title} `
  );

  // 3. span#trade_money (총 거래가)
  r = r.replace(/<span id=trade_money>[^<]*<\/span>/, `<span id=trade_money>${price}</span>`);

  // 4. dd.trade_money (단가 표시 → 총 가격으로 교체)
  r = r.replace(
    /(<dd class=trade_money>)[\s\S]*?(<\/dd>)/,
    `$1<strong style="font-size:1.1em">${price}원</strong>$2`
  );

  // 5. 설명 (ql-editor detail_text 내부)
  // Replace only the listing quantity, never the right-hand transaction quantity controls.
  r = r.replace(
    /(<dt\b[^>]*>\s*(?:판매수량|구매수량)\s*<\/dt>\s*<dd\b[^>]*>)[\s\S]*?(<\/dd>)/g,
    (_match, start, end) => start + escHtml(listingQuantityLabel(p)) + end,
  );
  const desc = p.description
    ? `<p>${escHtml(String(p.description)).replace(/\n/g, '</p><p>')}</p>`
    : '<p>상세 설명이 없습니다.</p>';
  r = r.replace(
    /(<div class="ql-editor detail_text">)[\s\S]*?(<\/div>)/,
    `$1${desc}$2`
  );

  // 6. breadcrumb (.kind)
  let crumb = escHtml(String(p.gameName || '게임'));
  if (p.serverName) crumb += ' &gt; ' + escHtml(String(p.serverName));
  if (p.itemCategory) crumb += ' &gt; ' + escHtml(String(p.itemCategory));
  r = r.replace(/(<div class=kind>)[\s\S]*?(<\/div>)/, `$1${crumb}$2`);

  // 7. 구매수량 컨트롤 초기값 리셋 (서버사이드)
  const priceNum = Number(p.price || 0);
  const priceFmt = priceNum.toLocaleString('ko-KR');
  // sell_quantity (buy-application 판매수량 input) → 1 로 리셋
  r = r.replace(/(<input\b[^>]*\bid=sell_quantity\b[^>]*?\bvalue=)(\d+)/i, '$11');
  // buy_quantity (sell-application 구매수량 input) → 1 로 리셋 (혹시 있을 경우)
  r = r.replace(/(<input\b[^>]*\bid=buy_quantity\b[^>]*?\bvalue=)(\d+)/i, '$11');
  // spnQuantity_Unit: "1만" 등 → "1"
  r = r.replace(/(<span\b[^>]*\bid=spnQuantity_Unit\b[^>]*>)[^<]*(<\/span>)/i, '$11$2');
  // spnQuantity: "50" → "1"
  r = r.replace(/(<span\b[^>]*\bid=spnQuantity\b[^>]*>)[^<]*(<\/span>)/i, '$11$2');
  // spnQuantity_total: "50만" → "1"
  r = r.replace(/(<span\b[^>]*\bid=spnQuantity_total\b[^>]*>)[^<]*(<\/span>)/i, '$11$2');
  // unit_info: "아데나" 등 게임화폐 텍스트 → "개"
  r = r.replace(/(id=spnQuantity_total[^>]*>[^<]*<\/span>)\s*[가-힣]{2,6}/g, '$1 개');
  r = r.replace(/(id=spnQuantity_total[^>]*>[^<]*<\/span>)\s*아데나/g, '$1 개');
  // trade_money (판매금액 단가) — id 직접 교체
  r = r.replace(/<span\b[^>]*\bid=trade_money\b[^>]*>[^<]*<\/span>/i, `<span id=trade_money>${priceFmt}</span>`);
  // pay_mileage (총 판매금액) — id 직접 교체 (class=f_red1, class=pay_mileage regex 미스)
  r = r.replace(/<span\b[^>]*\bid=pay_mileage\b[^>]*>[^<]*<\/span>/i, `<span id=pay_mileage class=f_red1>${priceFmt}</span>`);
  // pay_mileage (class 기반) — 하단 바 등 추가 교체
  r = r.replace(/(<span\b[^>]*\bclass=pay_mileage\b[^>]*>)[^<]*(<\/span>)/gi, `$1${priceFmt}$2`);
  // settle_amount / final_amount — 모두 교체
  r = r.replace(/(<span\b[^>]*\bclass=settle_amount\b[^>]*>)[^<]*(<\/span>)/gi, `$1${priceFmt}$2`);
  // add_pay price_font (결제 해야할 금액)
  r = r.replace(/(<span\b[^>]*class="add_pay price_font"[^>]*>)[^<]*(<\/span>)/gi, `$1${priceFmt}$2`);

  // 8. 거래번호 교체 (.trade_id 내 #20260...) → 우리 DB id로
  r = r.replace(/(<div class=trade_id>\s*)#\d+(\s*)/, `$1#${p.id}$2`);

  // 8-a. 날짜 교체 (trade_view_info 내 스냅샷 하드코딩 날짜 → 우리 DB createdAt)
  if (p.createdAt) {
    const registrationTime = listingTimeMarkup(p.createdAt);
    if (registrationTime) {
      r = r.replace(
        /(<span class=trade_view_info>)<span>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}<\/span>/,
        (_match, prefix: string) => prefix + registrationTime,
      );
    }
  }

  // 캡처 당시 값이 아닌, 이번 상세 열람까지 포함한 저장 조회수.
  r = r.replace(/(<span class=["']?trade_view_cnt["']?>)[\d,]+(<\/span>)/g,
    (_match, before: string, after: string) => before + Number(p.viewCount ?? 0).toLocaleString("ko-KR") + after);

  // 9. btn_fav data-id (찜하기 버튼) → 우리 DB id로
  r = r.replace(/(data-id=)\d{10,}/g, `$1${p.id}`);

  // 10. 판매자 등급 배지 교체 (credit_mark 클래스·텍스트)
  const GRADE_LETTERS_S: Record<string, string> = { vip:'V', platinum:'P', gold:'G', silver:'S', bronze:'B' };
  const GRADE_NAMES_S: Record<string, string>   = { vip:'VIP', platinum:'PLATINUM', gold:'GOLD', silver:'SILVER', bronze:'BRONZE' };
  const gKey  = (p.sellerGrade && GRADE_LETTERS_S[p.sellerGrade as string]) ? (p.sellerGrade as string) : null;
  const gLtr  = gKey ? GRADE_LETTERS_S[gKey] : '';
  const gCls  = gKey ? `credit_mark ${gKey}` : 'credit_mark regular';
  const gName = gKey ? GRADE_NAMES_S[gKey] : '';
  const cScore = (p.sellerCreditScore !== null && p.sellerCreditScore !== undefined)
    ? Number(p.sellerCreditScore).toLocaleString('ko-KR') + '점'
    : '0점';
  r = r.replace(/<span class="credit_mark [^"]*">[^<]*<\/span>/, `<span class="${gCls}">${gLtr}</span>`);

  // 11. Captured markup wraps the score in a div after vip_txt. Replace
  // the grade label independently so the static first paint is also correct.
  r = r.replace(
    /(<strong class=vip_txt>)[^<]*(<\/strong>)/,
    `$1${gName}$2`
  );
  r = r.replace(
    /(<strong class=vip_txt>[^<]*<\/strong>\s*<div>\s*)[\d,]+점/,
    `$1${cScore}`
  );


  // 13. 헤더 검색창 게임명 교체 (value=리니지클래식 → 실제 게임명)
  const searchGameName = escHtml(String(p.gameName || ''));
  if (searchGameName) {
    r = r.replace(
      /(data-gameserver=true\s+value=)[^\s>]+/,
      `$1${searchGameName}`
    );
    // 역순 속성 배치 대응
    r = r.replace(
      /(id=searchGameServer[^>]*\bvalue=)[^\s>]+/,
      `$1${searchGameName}`
    );
  }

  return r;
}

function buildProductScript(product: Record<string, unknown>): string {
  return `<script>window.__PRODUCT__ = ${JSON.stringify(product)};</script>`;
}

function serveApplication(html: string, user: Record<string, unknown> | null = null, product: Record<string, unknown> | null = null, siteUrl = 'https://itenmania.com'): string {
  let result = prepare(html, user);
  if (product) {
    // 서버 사이드에서 스냅샷 HTML 내 하드코딩된 값을 DB 데이터로 직접 교체
    result = applyProductToHtml(result, product, siteUrl);
    // window.__PRODUCT__ 주입 (클라이언트 JS 구매 박스용)
    const ps = SELL_CHAT_HEAD_INTERCEPT + buildProductScript(product);
    result = result.includes("<head>")
      ? result.replace("<head>", "<head>" + ps)
      : result.replace("<body", ps + "<body");
  }
  result = result.replace(
    '<button type=button class=go_chat name=go_chat>채팅</button>',
    product && !product.sellerId
      ? '<button type=button class=go_chat name=go_chat disabled title="이 사이트의 판매자 계정이 연결되지 않았습니다">채팅 불가</button><span style="display:block;margin-top:6px;font-size:12px;color:#666">이 글은 이 사이트의 판매자 계정과 연결되어 있지 않아 채팅할 수 없습니다.</span>'
      : '<button type=button class=go_chat name=go_chat onclick="window._im_on_sell_chat&&window._im_on_sell_chat();return false;">채팅</button>'
  );
  if (product) {
    const purchaseButton = '<button type=button>구매신청</button>';
    const replacement = product.status !== 'active'
      ? '<button type=button disabled title="현재 거래할 수 없는 상품입니다">구매신청 불가</button>'
      : !product.sellerId
        ? '<button type=button disabled title="이 사이트의 판매자 계정이 연결되지 않았습니다">구매신청 불가</button>'
        : '<button type=button data-im-purchase onclick="window._im_on_purchase&&window._im_on_purchase(this);return false;">구매신청</button>';
    result = result.replaceAll(purchaseButton, replacement);
  }
  const combined = SELL_APPLICATION_INTERCEPT_SCRIPT + APPLICATION_DYNAMIC_SCRIPT;
  result = applyProductMemberStatus(result);
  if (result.includes("</body>")) {
    return result.replace("</body>", combined + "</body>");
  }
  return result + combined;
}

function serveChat(html: string, user: Record<string, unknown> | null = null): string {
  let result = prepare(html, user);
  // 스냅샷에 하드코딩된 채팅 목록 항목 제거 — JS 교체 전 잠깐 보이는 현상 방지
  result = result.replace(
    /(<ul\b[^>]*\bclass=[^>]*\bchat_list\b[^>]*>)[\s\S]*?(<\/ul>)/,
    '$1$2'
  );
  if (result.includes("</body>")) {
    return result.replace("</body>", CHAT_INTERCEPT_SCRIPT + "</body>");
  }
  return result + CHAT_INTERCEPT_SCRIPT;
}

function extractBuyCheckLayer(src: string): string | null {
  const start = src.indexOf('id=buy_check_layer');
  if (start < 0) return null;
  const divStart = src.lastIndexOf('<div', start);
  if (divStart < 0) return null;
  let depth = 0, i = divStart;
  while (i < src.length) {
    if (src.slice(i, i + 4) === '<div') depth++;
    else if (src.slice(i, i + 6) === '</div>') { depth--; if (depth === 0) return src.slice(divStart, i + 6); }
    i++;
  }
  return null;
}

/** 스냅샷 HTML에서 게임 검색 입력창의 미리 채워진 value 속성 제거 */
function stripGameSearchValue(html: string): string {
  // searchGameServer 또는 searchRegGameServer 입력에서 value=... 속성 제거
  return html
    .replace(/(<input\b[^>]*\bid=searchGameServer\b[^>]*?)\s+value=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '$1')
    .replace(/(<input\b[^>]*\bid=searchRegGameServer\b[^>]*?)\s+value=(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '$1');
}

function serveSellRegister(html: string, user: Record<string, unknown> | null = null): string {
  const result = installRegistrationQuantityInputs(stripGameSearchValue(prepare(html, user)), "sell");
  const scripts = registrationQuantityScript() + SELL_REGISTER_INTERCEPT_SCRIPT;
  return result.includes("</body>")
    ? result.replace("</body>", scripts + "</body>")
    : result + scripts;
}

function serveBuyRegister(html: string, user: Record<string, unknown> | null = null): string {
  const result = installRegistrationQuantityInputs(stripGameSearchValue(prepare(html, user)), "buy");
  const scripts = registrationQuantityScript() + BUY_REGISTER_INTERCEPT_SCRIPT;
  return result.includes("</body>")
    ? result.replace("</body>", scripts + "</body>")
    : result + scripts;
}

function serveSellNew(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", SELL_NEW_INTERCEPT_SCRIPT + "</body>")
    : result + SELL_NEW_INTERCEPT_SCRIPT;
}

function serveBuyNew(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", BUY_NEW_INTERCEPT_SCRIPT + "</body>")
    : result + BUY_NEW_INTERCEPT_SCRIPT;
}

function serveBatchGoods(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", BATCH_GOODS_INTERCEPT_SCRIPT + "</body>")
    : result + BATCH_GOODS_INTERCEPT_SCRIPT;
}

const CHARGE_FORCE_STYLE = `<style id="charge-force-style">
#charge_main{display:block!important}
#charge_main form{display:block!important}
.m_chargelist{display:flex!important;flex-wrap:wrap!important}
.m_chargelist li{display:block!important;opacity:1!important;visibility:visible!important}
.real_price{display:block!important;opacity:1!important;visibility:visible!important}
.real_price .price_table{display:flex!important}
.m_button{display:flex!important;opacity:1!important;visibility:visible!important}
#btn_charge{display:inline-block!important;opacity:1!important;visibility:visible!important}
#g_POPUP{overflow:visible!important;height:auto!important}
.charge_banner_module_wrapper{display:none!important}
</style>`;

function serveCharge(html: string, user: Record<string, unknown> | null = null): string {
  // 원본 JS 제거 (로그인 체크로 요소 숨김 방지)
  let stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  // CSP 메타태그 제거 (fetch/XHR 차단 방지)
  stripped = stripped.replace(/<meta[^>]*content-security-policy[^>]*>/gi, "");
  // 핵심 요소에 인라인 스타일 직접 삽입
  stripped = stripped
    .replace(/<ul class=m_chargelist>/gi,
      '<ul class=m_chargelist style="display:flex!important;flex-wrap:wrap;gap:1%;padding:20px 0;border-top:1px solid #edeff2;border-bottom:1px solid #edeff2;min-height:30px">')
    .replace(/<div class=real_price>/gi,
      '<div class=real_price style="display:block!important;padding:20px 0;width:100%;min-height:20px">')
    .replace(/<div class=m_button>/gi,
      '<div class=m_button style="display:flex!important;justify-content:center;padding:20px 0 40px;width:100%;min-height:60px">')
    .replace(/id=g_POPUP\b/gi,
      'id=g_POPUP style="overflow:visible!important;height:auto!important;min-height:0!important"');
  // head에 강제 표시 스타일 주입
  const withStyle = stripped.includes("</head>")
    ? stripped.replace("</head>", CHARGE_FORCE_STYLE + "</head>")
    : CHARGE_FORCE_STYLE + stripped;
  const result = prepare(withStyle, user);
  return result.includes("</body>")
    ? result.replace("</body>", CHARGE_INTERCEPT_SCRIPT + "</body>")
    : result + CHARGE_INTERCEPT_SCRIPT;
}

// 스냅샷에 하드코딩된 등급 데이터
const SNAPSHOT_GRADE_EN = 'GOLD';
const SNAPSHOT_GRADE_KO = '골드';

const MYROOM_GRADE_EN: Record<string, string> = {
  regular: 'REGULAR', bronze: 'BRONZE', silver: 'SILVER',
  gold: 'GOLD', platinum: 'PLATINUM', vip: 'VIP',
};
const MYROOM_GRADE_KO: Record<string, string> = {
  regular: '레귤러', bronze: '브론즈', silver: '실버',
  gold: '골드', platinum: '플래티넘', vip: 'VIP',
};

/** 원본 PNG 등급 아이콘 — credit_rating.html에서 추출 (48×56px) */
const GRADE_IMG_VIP      = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAA4CAYAAAC7UXvqAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3NzExNjY2NENCRDlFOTExODEzRkUxOTg1MTQ3MzI3NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoxNEY4OUQxOERBN0YxMUU5QjI2REJDREMwRENEN0E2MCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxNEY4OUQxN0RBN0YxMUU5QjI2REJDREMwRENEN0E2MCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjJCMEU0NzJCRDFEOUU5MTE4MTNGRTE5ODUxNDczMjc2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjc3MTE2NjY0Q0JEOUU5MTE4MTNGRTE5ODUxNDczMjc2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+fE+dRwAABhRJREFUeNrMWltsFFUY/me2pO12L71sJAIhWJVYrMVSpS0Vu9ImSiJEiME++YAJb8ZLCMoDGomJAioY44sGwyuCBSTxQltaqNql1LRdMAUTaWlEWWm3u71sS7c743/OzOye7Mx2uzuX9my+3Z3umc7/nfP/37n8hxNFEUwslYgqxAnEnClPIARMgAfxJSLa3R7CD/EawmvGsziDeyAHsQfxYdvZ0aK2M0EQYiJUVDuhptENpWX2ZvztLcSwUQ80koAX8UVXa6jc1xqGwN/31RW2FcMLr3im8esniI8Q00uBwGrE0VsDkZ3EcP+ViXkrFzht4N1eDJu3FpFe2Ic4uVgE8hH7EXt/OjmS33E+mNHNpWX5UNNQCBU1zg68fBvRayWBJsShzh/HVnd8H4SpiVjWLbjxOTfsfG05UaivEO8jRswkQGTxs/6uCa+vLQSDN6YNCR7exkHDjmJoeKmEdOMBmcyckQQ8iA+IwjQfD+R0t4dNkfTlq3KpWtU2Fl7Hy9cRHXoJaMqi2YWR3e/k+BjOhkBaWTS7MLJ7BPGxluxqEchIFs0uBS4bJZJKdlkCumTR7JIku2Q072MJGCaLZpeNW1B2dydklxA4iLJ4wEhZNLuwsssTiRy8Oa3LeJHOamWYeI9SiBK2nB4lX4tzdE3Fpfk4KGEkUp/ETw4/yYvTmr5LNVnDOXoj/aZ5Tzqd19HqImyod0BdYxG9DgWjcPrrAETGBeBlQzjGIsloEba96oE1j+bTe4b+jMC5E/ewPhpP/EHMjET2PSAb37RnZUJ/SwEKi5fB0XeHAGw88EC7AhgKULfVDZufL2HusUNkKgYXvg2CjRDmAdg70saDHp+vqnOr59ZokGfVMhAEacWk+JfytbahSHVPWaWT1heyiAleTwyMjUa1Z3ybHBAThCSDRPCszIEHHsxV/5+RWawrQubhrJMArnc1/161qSjeA2ygr691atbvuhiU17hgDQHFQwcHZuC/f2fUs8oVeWB38bRVFcMIlbInHaq64bFZ8PsmabBnqkC6eoA8jDz011btKcfTXjeIQmL3wI5zGhIfyaXntzGqQFSFuOSgN9WFpBbr7ZzU/LW8yin3ANBYqHzGoVnvl5+RAGouASePH9b1AL6mUPP9V9ULnMfKXVDgtsVjYV2lmsDQX1MQGI7KrS8bz1kYxJIbAVz/XXvK/VS9i/aC3cnD2sfVAXy1Myj9D56LxwBnpQqB7Ls97RMQDkW13Qh7oPJZRwoVG5fcR/F/4KyVUXn6Qg244Z/QdCO7i4PyDS7Vb73dYzAVFmTflzzfUhViSZAHt59LpUYuWPOIWn383WGm9bMz3hACIHf/vTtRzTFhe9MKyM2zqbTf1zIeb31eBwPDeiDVmJBsPCl/9Cd8n89C+43tgfiYwNEx4f6MkLZ2S/NIQvd1GG8YAcUIMibcvDb/Lkbgnxm4OzwruQ6vjL7c4hJgx4TuS6F5612+IC1eeB3abwoBZUwY6IlojglGar85PSC/EaP6fNp7p32o/XS5qVP7jVlSaocyGiRCV2sIHlprh+RdPx+uH2y41LTxPF0z6zXecAIgT8hG7szBsf23IRYT4jNSRWptvDHBa1IPSO90R4In9vHyWlhMBCzHjL6w1Hog7tMyCZGjKzG6UaRssSiGG+E/CoG8fN4UEkpcMDtXukZdtjy8zi5vioki2U7/9NZA5OWlsJ2erjhwkVT/Yny7fS+7ve5FfI4KUrFYCY10hUl4HEIcRkwnJziUlNLBtrOjJVallNIVJuV0irQ6MCmnVCmmeFLvzDeBnCsXw4tiOJP068fLN0Ej6ZcuybcecQzjwkvcCuPEEsOZ/X+SMya545Rp14WmWXchjpAMzqXzQZgcNy+DU73FDTt2LzzxnUmim+TQ3kHsMyOHRmSxpsENT1TTHBhxl/4FSXYWRw0MlV2HC2UxkYUkAXoqozFHx2EP3bLLyOJhWRozznPpPW6TlezOJ4tWE8hIdhlZ9OPlG7CAsxBWEZhXdhlZJKnF9yCD0yhpi0mH/nYhbl/+ISg2H79LDv1F5UOAnqV+6E9LdmtBOuPQb8ZD/hdgAE5X67WRRV0VAAAAAElFTkSuQmCC";
const GRADE_IMG_PLATINUM = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAA4CAYAAAC7UXvqAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3NzExNjY2NENCRDlFOTExODEzRkUxOTg1MTQ3MzI3NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpGMDFEMUM3QUQ5RDIxMUU5QjlCQ0E4MEUxMDdBODgyRCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpGMDFEMUM3OUQ5RDIxMUU5QjlCQ0E4MEUxMDdBODgyRCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjJBMEU0NzJCRDFEOUU5MTE4MTNGRTE5ODUxNDczMjc2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjc3MTE2NjY0Q0JEOUU5MTE4MTNGRTE5ODUxNDczMjc2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+vZq2MQAABk1JREFUeNrUWltsVFUUXefemTsPikDBUAWMQKSh4cMEKZDy8kOsrZIQNSAYjeKHH1KIH8ZoBAX9wQ+1EGMUEgzh8SERA8USiCBpwPKQh4BQ0SBUolDKo+3MdB73uM+95w7T6cx0OnPvdLqT1ZnO6+61z95r7zNnWNuMN+GgTSAsIOwiXHHiAopDjvsIdYTDhM8ITYTlBO9gIFBDOET4AtHYGB7sBmKxMfR/PeEgobpYCUwmbCM0QNcreVcIbOQD8NbMBCvxg3cGAZ3PoOf3ErbK1+dtLhs+YzhhhZEyHKU8RBF3u6A99QSGLH8e6qNliF66iuDmRoQPnACPxBjTtCVgxkqIVfmccDfXi7M8ipgRlhDeN6IZjZFzUbinlsP3ei20qim93hA+fAaBL79H9OJVCp0K5jbid57wCWEHgReKQJV0/BlKF/BQGMqDI+BbVgvvC3Mtx1KaqInQzsMI7TiA2LUbYF4PJbKIBRoJawhHnSTwCOFdwjKCxgOU50P98C6ogvfl+VAfHpX1B+n/tSOwqQGhXSRQ3REwn0beMMo/bCSsI1y1k4Cf8IZ0/iFOF0RMhzajgtKlBu7pFTkXUOTXFgSJSPjIOUEAzOMWD/8jSXxNCOVL4FnCB4RKI8/JebV8HPyv1cBTXUnLb4+Qdf/YjOA3uxFtuUar4TFqhOw44UOpXP0mUCEdX0zyBx7ohlI6FJ6Fs+GnqLMHhtjeQPRbd6k2fqIa+Znu36P60Kz62E74mHAhGwIjZBcVKBUFyjQhi9Pge6Uarklj4bTF/ryOwIadCDedFbJrrgjQLmVX4HY6AksJ74noC0kEwTVlAvxvLYQ2cwoKbeFDpxH8thGRUy2msplpZcnu9kQCokOuMmTRWEsd6rjRFPH58CyYhYG27h+a0LVpD/iNu2b3Ma2BsFYQqJbTosdyng0rgXfhHKgiXSj3OSlOn8blnx63adqf+NPjNoPKqCQSVAuxy60I7TkK/eYd8zHTQqLjjI47b0xHCnhHAIGNu2kNo9mHiVOhW15znsQsyUvG4mwYA/pkIYzqUKRRgvPCvIJASi+ZRnqsubN2Xp02Ef5lz8FdPt4qul4Wbf0XetttdB85i9Dm/eS8IkmwBFKFHuZEtEeVYNi6urSOxy82tgwgaI9Phn/x07i36itEj102hmImBuMcSNjShTy1lX06n2xq6XAM/3Ql1MqJFAPdQM/UKxABkfdK2cjcxlmfFyV1i8F16vBWDfWTRP4rkOF6sVt3EL70lwFxP2VtThoPdfpj9Dm5rYAdG5q0LNoWvQN+szOe28M2vA3frKm9SVRWINj8BxgnBWRclHWBVsCIWPqo6Tc6wBSVlNkFRXXjXl196lSiLWcPGS6CbyWk3AtlUQwSJhTE2u+kXkEumx8vIgJGo41rPIOrfIyhPv0spULUQPrS4NyMrvfFKviX1qRucC1/gxUjgbIzW7ObOg+eNleJZTdVFC6FsrDOnftIqTrMWsmBwYASCDadQOfaLWaBM3OUYEVVAxkaXPBQM7rIeSVBocD6Pw85SqDzu8YeDvHOACK/X0G48aQRcaa68oq+4wQ61mwmv6zosvjoLJqaKa9K/DmG3EZqRwmweBNT4k3N2tAwSSge+QHbD2RmYDofTxPlfoOzEoaxvC5hAwGW4RkZYeG4tQo2m5JvhDOSsLTdynEHzGXHAkROXkSXnEy5nOnNGlXyThHHCYjIRvafQXjfKbkt1O8/kyCRRUugR7FyRiSSCjUhjYo0hcg9bt4auymeNE476LxFgNlB4r7qFHYsEesdwyA2QWA/4SMkfGU9SEzsTVcLAm0wT0HmwjwpHAwmvloXX5uvSWxkvxFeItQSmovU8V+kf+J493y6TizOo+bBPKG5ViSOt8L8rcWTSDovSzdKiJPB9TAPPtajj5NCJzdtEL+5AKYTNqTyo69Z6LpciXnIcFLokO2VdblS+pHXMCdqQhy3ijO0Cw47fk7muMj143ZOo6LHbrOq3wHZFaeQq2XUtzs5Tt+WF5pjo+wKh2fLwLQXaj9wTsquSK1jOX6GlZpLck1NO7ZIDbLIMxZbkonfQqyQ72sYuB1ZarnLJLvi8Xopz/V2yLPdm9RWKbtzU8juHpnnK+TrimhD09uOSRl8lbBIFukWJy70vwADAIiO9T1fWjxRAAAAAElFTkSuQmCC";
const GRADE_IMG_GOLD     = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAA4CAYAAAC7UXvqAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3NzExNjY2NENCRDlFOTExODEzRkUxOTg1MTQ3MzI3NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpFNDgwNjREQUQ5RDIxMUU5QjJFQ0JGQTdBRjk2QjBGOCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpFNDgwNjREOUQ5RDIxMUU5QjJFQ0JGQTdBRjk2QjBGOCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjJBMEU0NzJCRDFEOUU5MTE4MTNGRTE5ODUxNDczMjc2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjc3MTE2NjY0Q0JEOUU5MTE4MTNGRTE5ODUxNDczMjc2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+toSUwAAABhFJREFUeNrUWmlsVFUU/m43aCkBC5SCQrFUCpVVVFBETUVExAAiamiiUVkUY4KomOASlxgiihrjDwsYNSJpRFSMQnADyqKmCgWBUqQLVChlaUHasnSY63feuw3ttFPmzdKZ3uTrTN/MvHvOvd/5zrn3PuVeOQQhajHEw8RhYn2oOokK0X1vM0Z/TKwllhPp7cGBq4llxM/Q7iy4zgIXz0sfjxO/EwuJzpHogBj1gjFyJg2Pgb4I9B0PdB8K1NcAblc3fvYmsZW4P5g8DbSJMS8TQ+GuhzXqPUZADXkK6DOOxtcC+1dC71kKnKtij/FDoKJW8ftriDeIvwLpXAUQxNcTLxGTSRdS5RwQ3xMqYwYwIBvo0LXpt6v2QO/7DCj7gd+9II7IVU4NPiLeISrbyoGexLPEk0SiNeLRHTjaWVDD55NM/Vr9sT76G7A7B6jYQgKTAFFxcvkA8RbxKeEKlQOxRhYlENMsumj2lXwjMHgOVO+xcjvf7sT40EVfADIj/5VyADrazgAbiNeJjcF24HbD8ywGo83zxD5Qw56mK1PYeax/JGRM6MJPrBjB+VOkVQItUi4zE4uIkkAd6Gd4/giHLcYKSOF2+nSogbzUqXdwpKSqELrgXeBInkyPPSPACYIX8SFxxqkDiYbj5LruSS3nC2/c9y571LtmhCb9lf8EvesD4OSexrTabWi1ylcH7jOjPsKii5uKkUTly3yMaepehLydPc6Q/pIxsgKoO2arlbLSVYuy29iBkYbntiy66iiLyUBGNtQgGh/bCW3azhxk7mBSL6XdrnONZZcShiVERYMDvfj6DDGX6GR9WWSx30Soa2cDXfojnE2X/wIUsqSqzCelohtkt8QE+efiwCa+udVK/ZKMkm8gz+cBKaMRMY2SrUs4E3uZzU8Vkw0JDZK9RKKkt0WZWJYzIxdC9Z9qy1kkNcq0SmfFclUW9M73gOJvjP0qVRyotwK122CWAdnB6bDuJCUxH7r6H7L230vX47pAXTEAuHIUqdnH+X07JlnZXh/ezGCvFMfqLxVzMgsCFRWQ4fqPxcDRdd45fYh/dhJJN0ONftG5I5JEJVcEfT1wcDP0ugdaNb5p8toGnfdchKwHZOT/fBW4cNzZ72oKgdPl4XdA78hxbryV7wf5FwtBXdDUk5OHcluuU4a9AlxzDxUuvmlwl2+ASpsEpI4N4opMgtefAD59yLvxmR4rxwSuKtMnUBIn+G9xdFyTst04oOylX/U+44T2/Ya1dCAhpfn1ZMrlqaLg5gOxrbbSXocYJ2wHpHSQJd/6h5zfNOVuqMk/No+L3OHN+Z7osVqrKbMD2VnE2ZWxXal6xIDb5UcEu72k/0b3Sp0BNWahF/ndAr31CSfTIIseLyrUEAeOoLxPt4HKmObdntRbgO5j/e4vVDtzDrcJ/C8c28QBvX9166SISwzrxpYPZUYudNUuK4hVxoNArxERuzfaiNseinZmL9dQaymtJUHtJnAHRApbosXwOUDnTI8dVP6fPrE5xaqLwkghGVkpESTLemRdNYklRsUOe9S7pnmnjtArrMVcQY73D8XoQdO8G3+iyB6EsMYAg1QSkj+FoN7+fmQEsd42Fyhc7WwNsWE+cHJrmMvpJlR6jQvuVVADHwV6ZLZc63MBo8t+BQ6s4BqiMuA+g58HyGed/3xT5ZEiTtQqAK6HL5GJ0SEwPLJqoQAdUO3ZfnEgth074BYH5iHAk8IwNdHsReLA97CPkOSct6IdGL6dmAr7ePfvhiCWfffFhOxzyGMBFyPQ8KPEAshOOvCtNxUqJmYRdxJ5EWK4LK7lmYsxxNuyD+KLjMpx5ziCNTHKwmh8nhnMmfByYtlaHqgnlhKjDL1q2tDwUmI2cQcuc2bsSyI7ZgJc4uOrEBteZ2gidFkGH07tnWTiAmI65BAwNLK7xgzSAidq6E8p8R3sB5oWGGUIhizKxtEU875NaqHaRlO93MSL01ZpBkFG/etwFXMlRnbHw/cHNFzG6ZvMINRFQjW60cjdrMvIboM8zzJKE1HltOfI1rYwU+LkpmBGvgrhY5fXGfk9YvJISOqs/wUYAAoi54rmQiCRAAAAAElFTkSuQmCC";
const GRADE_IMG_SILVER   = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAA4CAYAAAC7UXvqAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3NzExNjY2NENCRDlFOTExODEzRkUxOTg1MTQ3MzI3NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpENzUxQzI5QUQ5RDIxMUU5QjYxMEEyMTUyQTQ2MTg2NCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpENzUxQzI5OUQ5RDIxMUU5QjYxMEEyMTUyQTQ2MTg2NCIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjJBMEU0NzJCRDFEOUU5MTE4MTNGRTE5ODUxNDczMjc2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjc3MTE2NjY0Q0JEOUU5MTE4MTNGRTE5ODUxNDczMjc2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+OfZrEgAABhNJREFUeNrUWllMXGUUPsOwFFqaAdtA2WnYKQmBhk2hBoviEoMJGEUTNSYu8UV90Ae3uPXBGLcHo0aDPrn1pQZrTCwJqIjUpqyhYSlFaEmgUJYCZRnw+/65g1M6wFzmDr2c5Mtk7nrO/5/znXP+/1pqamrER5IFlALfAiO+eomfD55pA14HGoCPgN+Bx3z0LsMf+hDwJ/Dm8vKybWlpSfCbgv9fA78Ct5rVgDyglu6ysrKSsbCwICEhIZKUlCQBAQGyuLgoOH4U5+uAT4FYowzw9/L+SOBl4GkgmIpS4YyMDDl06JDYbDa5fPmynD59Wi5evMjrA/39/Z/F7/3A+8DnwJw3Cli2GMQBwJPAS0Ci3W7nCEtsbKxkZ2dLRETEDTecP39eWlpalEEwQvz81OT/A7wN/LSdM1AGvAYUU2n6eVhYmBrx1NRUsVgsbm86ePCgHDhwQDo7O+XcuXMyNzdHQw7j+hM4/SNwDGjRq4y1oqLC02vTgQ+A96B4AhXnSGZlZUlJSYlERkauq/zqtMG9oqKiJD4+Xhl+5coV4exhNjJx+hFgL9AGzBppgE1zlS+BfLzYQkUTEhKU4snJycoQPbJr1y5lRHh4uFy9elWmpqZ4OAiG3IbfBwAe6ABWvHWhhzVOT+NIEfTvnJwc5e/eCo2IiYmRnp4eaWtrk4mJCQ5GEgwh7T4KvKXlEd0G5ANvAHc7/XzPnj2SmZmp/DwoKMgwHrdarZKWliZxcXFy9uxZZYzGZqTdEqBGi49/PXGhaM3qT4AMPohskZ6ertyFo67XXTymNcQHjYiOjpZr166p+MDgWfH+wzj9IGAHWoEldwYEAk8BXwHlyJ4BgHpYUVGRGvnAwEDZDtm9e7dirNDQUJmenlYxgpjbC5Tj9J3AMNDj6kJ3aH5eQqXp57yZfs4A3YxZfCF8Z0pKiiKKrq4u6ejokNnZWc5+Hs4x4/8AvEvGYiLjlFjpLmQH+iM5PTg4WMwidCfGx4ULF1TCZNxoTHUPZ8DKUScj5OXlqfRvNmGiLC0tlaGhIWlublZshdhgzrhF5XO6jrN2MbOQchMTE5Wba2JfpRSXg15Lf3+/jI+Py9jY2OoxxhUTF5VgoG5VONhGVqPXCSvOhoYGmZ+f37hVQ/mRm5trinL6ulGvr6/36Nr29nb1a4QRhjQ0ZLCmpiZd9ziNMIUBrPU3c5u1wpgwjQsNDAy4VbC8vHw1YBkfvb29ytV4rri42Fwx4M4AV7ZhWUIcOXLE9MsqSi5duiRnzpyRmZkZn+YGQ2aAWZwKuwtUgsmHlSZzAKtO0xlAxdgjrBfI9HuC1zDjMw+YyoXo6wUFBZteRwPpVrW1tYp6TRUDdJOysjKPujUurTQ2NpoviMkylZWVUlhYKPv27ds0c7OqNCwGjGoVGaTsmwkyENeAuru73cbH4OCg7gpY6wWuN4B9L18yOjqqGgZDWQIDwyaJ66Vrn83et7W11XN3gZ7Dw8POVb3/DaBVNGBtqapnnYdLilzc4qpCX1+fUs71fHV19Q0Uyhk4efKk7gFxnQV/16nfqlRVVanVaArXjfLz82VkZES1gs5lRXfPn5yc9HqJxhDHdyrvOhjO0mEjYY9rChbiisFW+gfSqSkMqKur05WY9DQ/2+JCHMnjx48r6uTq3f79+902PVxVYEmtbXaYq5wmz3OBlnBNbM5ewNTV6EZNvq/FT3a2WHa6AXYa8DGz+g5TnL75IvAXDXgeuB34eQcoTq7+DOCKwIfAhNOF/gbuE8dOe5tJlT8ljq0A7jP3rxfE3wPcaHuV9G4SxbuBJ4C7xM1+mbsgnhbH5kER8A2wfJMU5/r/O0ChOL61sOulUW7jPC6ObZ0/tlFxNg38RIdNNjfUx73NA07fe44FpI+Vb9ZisRroMjKRLYjjKxNGP78BmjNYcdLiCxob6upw9CayIZcX/WKA4gsutLilgfHzYqrvFcdOfucWn/EbcHQtLW5nLcRg+05jK9LumIf39Wnk4JYWb0YxN6XRboFGu/YNrjvmcp0h9GxkMdfrMrIN68zUK0YnSF/0A6c013hGM+YL4ISvePc/AQYAwlo7kw18m9sAAAAASUVORK5CYII=";
const GRADE_IMG_BRONZE   = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAA4CAYAAAC7UXvqAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA2ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3NzExNjY2NENCRDlFOTExODEzRkUxOTg1MTQ3MzI3NiIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpDQkExQUEwQUQ5RDIxMUU5QjM1REUyRDMwNjMyMjY5NSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpDQkExQUEwOUQ5RDIxMUU5QjM1REUyRDMwNjMyMjY5NSIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ1M2IChXaW5kb3dzKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjJBMEU0NzJCRDFEOUU5MTE4MTNGRTE5ODUxNDczMjc2IiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjc3MTE2NjY0Q0JEOUU5MTE4MTNGRTE5ODUxNDczMjc2Ii8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+G6e6rAAABopJREFUeNrUWntQVGUU/919AcuqgAsqbxQICQO1QNRQfOQjQJPG0kysydK0ckxHS0dTR7CUitIcNW2oqWmsfzKLMZ1stEyHMfNBmqAk4hsREFhY9tE5uxcHZEX2BZcz8xvu3vtx73e+73d+53zfvULMN2q4yWSEWYQ7hB/d+RB32HDCz4R8wg/i35ju4EAoYSvhoBnmCTpDPRqMOoGOZ9O5I4TVBB8pOuBNWEw4Sp2dR51W6Qw6jA1OR1LAKPBxk0nvS9ffI/xJmOkqB+TaTKWz95giUiTLYGrq0WhsRKxfPFYOzcWywTlID38eHnJPlFSfRYWuEgqZTCsTZJnUPolQTLjSVQ7EEzYT1prMpn51NMo+Hr54JXYxcoZtR7w20dJIIVMgqU8KxodkwAwjzledQb2hjs9HCRA4yLWEIkKNI50QHFAhf8JbhIWEXkQXqGQeSAufjrmxSxDjM6jdfy68eRgb/16JYzcOQSHIoZJ78OlSwibC5wS9u2aA4+VFwheEZ/QmvafO0IgEGukNydstndd69nnoTYK8wzAlfCbCegxASc1ZXK2/xrTyJVo9TZfHEMoIF13tAMviDsISo9mgrTc0IEQThrcT1mDVEx8jstdA+3hLtHrULwGTw56F2Wyw0KpGX0uOyEMFwUKr/iKtKp11IISwgZBHPI9mnntRQE6PnIPcEfkY2W880UfluHQpNBgVOBGjgyah1lCN4qoikAgISpkiAdb44JufJDTa64AX4Q3CLp7WRmOD3GQ24qmQdKLLDsyKng+NsqfLtNzfqy8mhWbiEd84XKw+h/K6cuq/2UsuyFNFleNsfqajDmSIPH+ZZbGeeD6gZxRWJ+ZhaUI2+qmD3VUVWKg4NeIF9PbUWuKjQlfBtPInWrHssqxdIJQ/yIFmWVxHySiIkw+PzPy4pcgetg0JvRPRGcaqNMQ/GRNCpkJnrMO5qlOWRKiUKaPE2ipAnI2aZgf4xDuEbYTBnP6J75gSMQMfDN+JiTS1nnIvdLb1VPlgXHAGHg8YgVu6a7hA1DKbTQqFTMkJMFOU2yLOA/vpYBypC9UtegwLeJJGfTlSgyZDKsbxl//vFsJmyujFFH9eoCTIl7bwDKwwmo1ab2UPvDloJdYnbbVbFt1tgiDDYG2SJVly8jt1u5CyupmduKHgqdBT/TLEfzgWxL3r0AMOXTqIQ+UHUK2/Y/N6sCYc0b4xSAxMRm+1v8OOcKJcOGgFCsq+x9W6MgpwZZOi5TQx9ykj2nXT7/75GqtOvtrh9ml9s7A8aY3DjuiojuLRd1k5vflsjl3t917Px7SCVJRVX5LGeuCmvtSh/1l3dJlLHFC4I+gCVBFI9EuxHFfpK/F7ZdslMZ/jWQjtFSY9Bz5M3oWhgYmtgvy1I2lt2hXdOum0A25Z1HurNK1+p4Sl2mxXq78r2V2JNjJry/r7REkzBnKPr4WPyq/dGIjVJLeimaQcsNXh+4P8o5Sdkt7YateiNXHwVqq7rwM8Q65KZm6h0LzI1Qj0DrIqTdNdHLn+WxtacTL79K/3sTH1M+k5MCEiDTHa2Hu/X4qfh4KSPVhcOKNNWbGmaRPUTtCp0ygU4RNp83xZ9X/Si4HSqpJWv+ub6rGvdK/Ntmqlt/QoxFT59XJWu3mgWU4lWQs18/thNi10dtfLKI+iIzbSLx1zExZ2vQPL47Mdktm8MbucUh+bFBJX+nbZpMgMUphCnL55gtapV1Be21ZVEvuMuFe8DfSPc6rj9/dR0XLlLwiCQzdlzW+p++40pVzVygmF9aQSV2nkso8vsTjSctEsJeMNhzrK7HebqulY3sIBQYUbumvYWpQLqRuTRC33urd7wg7IeMTl5JFGqUY3M5msqypSF5mZO7+IcLQbdn4PYR078Aus76bYkSvdoOP8xuY5WF98nGimj46QR2DB5jftjRLseAVhBW9yEHY/KBPzEul1wnjCAYl03ET4ShxcTvs1HSklDhMmEubA+lqnq4y/r+AXFVz1nbe3FjLC+glBki3P3WzlIhM4Nvc5W8zdFrk3kvCtmzveQPiEkNzRWLQnB5wmzBCn9JgbOv8TYTSsnzGUu7OcLhAftMieB7Vjp0RZTHNkYGROTDXLLn+CwPsiegfuUdGCmru7akFzmbBADLaOyi7L4pei8ywOTm1Ru6oO+qOF7BZ3oF3WQ9p1ybZKs+zyyK6/b2SbE+RYwn6Xltdu/OzyMVi/AOBPZnJcFPBt7H8BBgALOBe6yzLDVgAAAABJRU5ErkJggg==";

function buildGradeIconStyle(): string {
  const rules = [
    `.credit_mark2.credit_REGULAR{background-image:none!important}`,
    `.credit_mark2.credit_VIP{background-image:url("${GRADE_IMG_VIP}")!important;background-repeat:no-repeat!important;background-size:100% auto!important}`,
    `.credit_mark2.credit_PLATINUM{background-image:url("${GRADE_IMG_PLATINUM}")!important;background-repeat:no-repeat!important;background-size:100% auto!important}`,
    `.credit_mark2.credit_GOLD{background-image:url("${GRADE_IMG_GOLD}")!important;background-repeat:no-repeat!important;background-size:100% auto!important}`,
    `.credit_mark2.credit_SILVER{background-image:url("${GRADE_IMG_SILVER}")!important;background-repeat:no-repeat!important;background-size:100% auto!important}`,
    `.credit_mark2.credit_BRONZE{background-image:url("${GRADE_IMG_BRONZE}")!important;background-repeat:no-repeat!important;background-size:100% auto!important}`,
  ];
  return `<style id="_im_grade_icons">${rules.join('')}</style>`;
}

const GRADE_ICON_STYLE = buildGradeIconStyle();

function applyServerGrade(html: string, grade: string | null | undefined): string {
  const key = (grade && MYROOM_GRADE_EN[grade]) ? grade : 'regular';
  const enName = MYROOM_GRADE_EN[key];
  const koName = MYROOM_GRADE_KO[key];
  if (enName === SNAPSHOT_GRADE_EN) return html; // 스냅샷과 같으면 변경 없음
  // 1. credit_mark2 아이콘 클래스 + 텍스트
  let out = html.replace(
    `class="credit_mark2 credit_${SNAPSHOT_GRADE_EN} _lg">${SNAPSHOT_GRADE_EN}`,
    `class="credit_mark2 credit_${enName} _lg">${enName}`,
  );
  // 2. level_txt 클래스 + 텍스트 (공백 포함)
  out = out.replace(
    new RegExp(`class="level_txt f_${SNAPSHOT_GRADE_EN}">\\s*${SNAPSHOT_GRADE_EN}\\s*<`, 'g'),
    `class="level_txt f_${enName}">\n ${enName} <`,
  );
  // 3. level_desc f_GRADE span 클래스 + 한국어 등급명
  out = out.replace(
    `<span class=f_${SNAPSHOT_GRADE_EN}> ${SNAPSHOT_GRADE_KO}`,
    `<span class=f_${enName}> ${koName}`,
  );
  return out;
}

function serveMyroom(html: string, user: Record<string, unknown> | null = null): string {
  let result = prepare(html, user);
  // 등급 아이콘 CSS 주입 (스냅샷에는 credit_GOLD만 있음)
  result = result.includes("</head>")
    ? result.replace("</head>", GRADE_ICON_STYLE + "</head>")
    : GRADE_ICON_STYLE + result;
  // 스냅샷에 하드코딩된 이전 유저 이름 → 실제 로그인 유저 닉네임으로 교체
  if (user) {
    const nick = (user.nickname as string) || (user.email as string) || '';
    if (nick) result = result.replace(/기우혁/g, nick);
    // 스냅샷 GOLD 등급 → 실제 사용자 등급으로 서버 사이드 교체
    result = applyServerGrade(result, user.grade as string | null);
    // 스냅샷의 신용점수 (81점) → 실제 사용자 신용점수로 서버 사이드 교체
    // client-side applyScore()가 늦게 실행되며 발생하는 "초기화" 플래시 버그 방지
    const score = typeof user.creditScore === 'number' ? user.creditScore : 0;
    result = result.replace(/\(\d+점\)/g, `(${score}점)`);
  }
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_INTERCEPT_SCRIPT + "</body>")
    : result + MYROOM_INTERCEPT_SCRIPT;
}

function servePaymentList(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", PAYMENT_LIST_INTERCEPT_SCRIPT + "</body>")
    : result + PAYMENT_LIST_INTERCEPT_SCRIPT;
}

function servePaymentPhoneList(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", PAYMENT_PHONE_LIST_INTERCEPT_SCRIPT + "</body>")
    : result + PAYMENT_PHONE_LIST_INTERCEPT_SCRIPT;
}

function servePaymentIndex(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", PAYMENT_INDEX_INTERCEPT_SCRIPT + "</body>")
    : result + PAYMENT_INDEX_INTERCEPT_SCRIPT;
}

function servePaymentPhone(html: string, user: Record<string, unknown> | null = null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", PAYMENT_PHONE_INTERCEPT_SCRIPT + "</body>")
    : result + PAYMENT_PHONE_INTERCEPT_SCRIPT;
}

function serveChatNew(html: string, user: Record<string, unknown> | null = null): string {
  let result = prepare(html, user);

  // buy_check_layer: 빈 레이어를 buycheck 파일의 전체 레이어로 교체
  if (chatNewBuycheckHtml) {
    const fullLayer = extractBuyCheckLayer(chatNewBuycheckHtml);
    if (fullLayer) {
      // hidden 스타일로 교체 (JS로 display:block 토글)
      const hiddenLayer = fullLayer
        .replace('style=display:block', 'style="display:none"')
        .replace(/class="g_layer buy_check_layer"/, 'class="g_layer buy_check_layer" style="display:none"');
      result = result.replace(
        /<div[^>]+class="g_layer buy_check_layer[^"]*"[^>]*id=buy_check_layer[^>]*>[\s\S]*?<\/div>/,
        hiddenLayer
      );
    }
  }

  const $ = loadHtml(result);
  $(".chat_room").css("visibility", "hidden");
  $(".chat_user .uid").text("채팅방");
  $(".chat_user .credit_mark_new").attr("class", "credit_mark_new").attr("style", "display:none!important").text("");
  $(".chat_user").append('<span class="chat-connection-state" aria-label="채팅 서버 연결 상태">연결중</span>');
  $(".chat_user2 .subject a").text("채팅을 불러오는 중입니다.");
  $(".chat_user2 .sub_info a").text("");
  $("#chat_user_info ul").empty();
  $("#chat_notice_txt").html('<b>결제가 완료된 상품입니다.</b><br><span class="sub_txt">안전한 거래를 위해 실제 거래 당사자인지 확인 후 진행해 주시기 바랍니다.</span>');
  result = $.html();
  return result.includes("</body>")
    ? result.replace("</body>", CHAT_NEW_INTERCEPT_SCRIPT + CHAT_REFERENCE_STYLE + "</body>")
    : result + CHAT_NEW_INTERCEPT_SCRIPT + CHAT_REFERENCE_STYLE;
}

// ─── 마이룸 판매관련 페이지 공통 유틸 ────────────────────────────────────

function fmtKRW(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtKRDate(d: Date): string {
  // 서버는 UTC로 동작 → KST(UTC+9)로 변환해서 표시
  const kst = new Date(d.getTime() + 9 * 3600000);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

function injectSellTableRows(html: string, rowsHtml: string): string {
  const tableMarker = '<table class="g_blue_table tb_list">';
  const tIdx = html.indexOf(tableMarker);
  if (tIdx === -1) return html;
  const tbodyStart = html.indexOf("<tbody>", tIdx);
  if (tbodyStart === -1) return html;
  const tableEnd = html.indexOf("</table>", tbodyStart);
  if (tableEnd === -1) return html;
  return (
    html.slice(0, tbodyStart) +
    "<tbody>" + rowsHtml + "</tbody>\n" +
    html.slice(tableEnd)
  );
}

const MYROOM_SELL_SCRIPT = `<script>
(function(){
  window.addEventListener('DOMContentLoaded',function(){
    if(!window._IM_USER||!window._IM_USER.id){location.replace('/login');return;}
    /* 행 클릭 → 상세 페이지 이동 (캡처 단계로 스냅샷 JS 우선 처리) */
    document.addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('.list_icon')) return;
      if(e.target.closest&&e.target.closest('.btn-shipped')) return;
      var tr=e.target.closest&&e.target.closest('tr[data-href]');
      if(!tr) return;
      e.preventDefault(); e.stopImmediatePropagation();
      location.href=tr.getAttribute('data-href');
    },true);
    /* 삭제 버튼 */
    document.addEventListener('click',function(e){
      var btn=e.target.closest&&e.target.closest('.list_icon.delete[data-id]');
      if(!btn)return;
      e.preventDefault(); e.stopImmediatePropagation();
      var pid=btn.getAttribute('data-id');
      if(!pid||!confirm('이 물품을 삭제하시겠습니까?'))return;
      fetch('/api/products/'+pid,{method:'DELETE',credentials:'include'})
        .then(function(r){if(r.ok)location.reload();else alert('삭제 실패');})
        .catch(function(){alert('삭제 실패');});
    });
    /* 인계완료 버튼 */
    document.addEventListener('click',function(e){
      var btn=e.target.closest&&e.target.closest('.btn-shipped[data-order-id]');
      if(!btn)return;
      e.preventDefault(); e.stopImmediatePropagation();
      var oid=btn.getAttribute('data-order-id');
      if(!oid||!confirm('인계완료 처리하시겠습니까?\\n\\n구매자에게 물품을 전달한 후 클릭하세요.'))return;
      btn.disabled=true; btn.textContent='처리중...';
      fetch('/api/orders/'+oid+'/shipped',{method:'PATCH',credentials:'include'})
        .then(function(r){
          if(r.ok){alert('인계완료 처리되었습니다.');location.reload();}
          else r.json().then(function(d){alert(d.error||'인계완료 실패');btn.disabled=false;btn.textContent='인계완료';});
        })
        .catch(function(){alert('인계완료 처리 실패');btn.disabled=false;btn.textContent='인계완료';});
    });
  });
})();
</script>`;

function serveSellMyregist(
  html: string,
  user: Record<string, unknown> | null,
  products: Array<{
    id: number; title: string; price: number;
    gameName: string | null; serverName: string | null;
    itemCategory: string | null; category: string | null;
    createdAt: Date;
  }>
): string {
  let result = prepare(html, user);

  let rowsHtml: string;
  if (products.length === 0) {
    rowsHtml = "<tr><td colspan=5 class=empty_item>등록된 판매 물품이 없습니다.</td></tr>";
  } else {
    rowsHtml = products.map((p) => {
      const game = p.gameName || "";
      const server = p.serverName ? `<p class=f_gray>${p.serverName}</p>` : "";
      const cat = p.itemCategory || p.category || "아이템";
      const price = fmtKRW(p.price);
      const date = fmtKRDate(p.createdAt);
      const detailHref = `/sell/application.html?id=${p.id}`;
      return (
        `<tr data-href="${detailHref}" style="cursor:pointer">` +
        `<td class="first f_left" style="text-align:center"><strong>${game}</strong><br>${server}</td>` +
        `<td>${cat}</td>` +
        `<td class=left><div class=trade_title>${p.title}</div></td>` +
        `<td class="right td_money">${price}원</td>` +
        `<td class=flex_box><p class=f_gray>${date}</p>` +
        `<div class=icon_box><a href="javascript:void(0)" class="list_icon delete" data-id="${p.id}" data-desc=삭제>` +
        `<span class=list_icon_img></span></a></div></td>` +
        "</tr>"
      );
    }).join("");
  }

  result = injectSellTableRows(result, rowsHtml);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_SELL_SCRIPT + "</body>")
    : result + MYROOM_SELL_SCRIPT;
}

function serveSellMycheck(html: string, user: Record<string, unknown> | null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_SELL_SCRIPT + "</body>")
    : result + MYROOM_SELL_SCRIPT;
}

function serveSellMypaywait(
  html: string,
  user: Record<string, unknown> | null,
  orders: Array<{
    id: number; productId: number | null; productTitle: string; amount: number; createdAt: Date;
    gameName: string | null; serverName: string | null; itemCategory: string | null; category: string | null;
  }>
): string {
  let result = prepare(html, user);

  let rowsHtml: string;
  if (orders.length === 0) {
    rowsHtml = "<tr><td colspan=6 class=empty_item>입금 대기중인 물품이 없습니다.</td></tr>";
  } else {
    rowsHtml = orders.map((o) => {
      const game = o.gameName || "";
      const server = o.serverName ? `<p class=f_gray>${o.serverName}</p>` : "";
      const cat = o.itemCategory || o.category || "아이템";
      const price = fmtKRW(o.amount);
      const date = fmtKRDate(o.createdAt);
      const titleLink = o.productId
        ? `<a href="/sell/application.html?id=${o.productId}"><div class=trade_title>${o.productTitle}</div></a>`
        : `<div class=trade_title>${o.productTitle}</div>`;
      return (
        "<tr>" +
        `<td class="first f_left" style="text-align:center"><strong>${game}</strong><br>${server}</td>` +
        `<td>${cat}</td>` +
        `<td class=left>${titleLink}</td>` +
        `<td class="right td_money">${price}원</td>` +
        `<td>구매자</td>` +
        `<td class=flex_box><p class=f_gray>${date}</p></td>` +
        "</tr>"
      );
    }).join("");
  }

  result = injectSellTableRows(result, rowsHtml);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_SELL_SCRIPT + "</body>")
    : result + MYROOM_SELL_SCRIPT;
}

function serveSellMying(
  html: string,
  user: Record<string, unknown> | null,
  orders: OngoingTrade[]
): string {
  let result = prepare(html, user);

  let rowsHtml: string;
  if (orders.length === 0) {
    rowsHtml = "<tr><td colspan=7 class=empty_item>판매중인 물품이 없습니다.</td></tr>";
  } else {
    rowsHtml = orders.map((o) => {
      const game = escHtml(o.gameName || "");
      const server = o.serverName ? `<p class=f_gray>${escHtml(o.serverName)}</p>` : "";
      const cat = escHtml(o.itemCategory || "아이템");
      const price = fmtKRW(o.amount);
      const date = fmtKRDate(o.createdAt);
      const chatHref = escHtml(ongoingTradeHref(o, "sell"));
      const titleLink = `<a href="${chatHref}"><div class=trade_title>${escHtml(o.productTitle)}</div></a>`;
      const shippedBtn = o.orderId === null
        ? `<a href="${chatHref}" class="btn_blue">거래채팅</a>`
        : o.status === "pending"
        ? `<button class="btn-shipped" data-order-id="${o.id}" style="padding:5px 10px;border:none;border-radius:6px;background:#159efd;color:#fff;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap">인계완료</button>`
        : `<span style="color:#159efd;font-size:12px;font-weight:600;white-space:nowrap">인계완료✓</span>`;
      return (
        `<tr data-href="${chatHref}">` +
        `<td class="first f_left" style="text-align:center"><strong>${game}</strong><br>${server}</td>` +
        `<td>${cat}</td>` +
        `<td class=left>${titleLink}</td>` +
        `<td class="right td_money">${price}원</td>` +
        `<td>${shippedBtn}</td>` +
        `<td class=flex_box><p class=f_gray>${date}</p>` +
        `<div class=icon_box><a href="${chatHref}" class="list_icon chat" data-desc=채팅>` +
        `<span class=list_icon_img></span></a></div></td>` +
        "</tr>"
      );
    }).join("");
  }

  result = injectSellTableRows(result, rowsHtml);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_SELL_SCRIPT + "</body>")
    : result + MYROOM_SELL_SCRIPT;
}

async function serveMyroomTradeDetail(
  req: Request, res: import("express").Response,
  user: Record<string, unknown>, side: "buy" | "sell", html: string,
): Promise<boolean> {
  const key = req.query.roomId !== undefined ? "roomId" : req.query.orderId !== undefined ? "orderId" : null;
  if (!key) return false;
  const value = String(req.query[key]);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    res.status(400).send("올바른 거래번호가 필요합니다."); return true;
  }
  const [room] = await db.select().from(chatRoomsTable).where(
    key === "roomId" ? eq(chatRoomsTable.id, Number(value)) : and(
      eq(chatRoomsTable.orderId, Number(value)),
      or(eq(chatRoomsTable.buyerId, user.id as number), eq(chatRoomsTable.sellerId, user.id as number)),
    ),
  ).limit(1);
  if (!room) { res.status(404).send("거래를 찾을 수 없습니다."); return true; }
  if (room.buyerId !== user.id && room.sellerId !== user.id) {
    res.status(403).send("이 거래를 볼 권한이 없습니다."); return true;
  }
  const actualSide = room.buyerId === user.id ? "buy" : "sell";
  if (side !== actualSide) {
    res.redirect(302, `/myroom/${actualSide}/${actualSide}_ing.html?roomId=${room.id}`); return true;
  }
  const $ = loadHtml(prepare(html, user));
  $(".g_content").first().replaceWith(renderTradeDetailLayout(side, room.id));
  $("html,body").addClass("trade-detail-page");
  $("title").text(side === "buy" ? "구매중인 물품 | 아이템매니아" : "판매중인 물품 | 아이템매니아");
  $("body").append(TRADE_DETAIL_SCRIPT);
  res.send($.html());
  return true;
}

// ─── 마이룸 구매관련 serve 함수 ────────────────────────────────────────

function injectBuyTableRows(html: string, rowsHtml: string): string {
  const tableMarker = '<table class="g_green_table tb_list';
  const tIdx = html.indexOf(tableMarker);
  if (tIdx === -1) return html;
  const tbodyStart = html.indexOf("<tbody>", tIdx);
  if (tbodyStart === -1) return html;
  const tableEnd = html.indexOf("</table>", tbodyStart);
  if (tableEnd === -1) return html;
  return (
    html.slice(0, tbodyStart) +
    "<tbody>" + rowsHtml + "</tbody>\n" +
    html.slice(tableEnd)
  );
}

const MYROOM_BUY_REGIST_SCRIPT = `<script>
(function(){
  window.addEventListener('DOMContentLoaded',function(){
    if(!window._IM_USER||!window._IM_USER.id){location.replace('/login');return;}
    /* 행 클릭 → 상세 페이지 이동 */
    document.addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('.list_icon')) return;
      var tr=e.target.closest&&e.target.closest('tr[data-href]');
      if(!tr) return;
      e.preventDefault(); e.stopImmediatePropagation();
      location.href=tr.getAttribute('data-href');
    },true);
    /* 삭제 버튼 — product DELETE */
    document.addEventListener('click',function(e){
      var btn=e.target.closest&&e.target.closest('.list_icon.delete[data-id]');
      if(!btn)return;
      e.preventDefault(); e.stopImmediatePropagation();
      var pid=btn.getAttribute('data-id');
      if(!pid||!confirm('이 구매 등록글을 삭제하시겠습니까?'))return;
      fetch('/api/products/'+pid,{method:'DELETE',credentials:'include'})
        .then(function(r){if(r.ok)location.reload();else alert('삭제 실패');})
        .catch(function(){alert('삭제 실패');});
    });
  });
})();
</script>`;

const MYROOM_BUY_SCRIPT = `<script>
(function(){
  window.addEventListener('DOMContentLoaded',function(){
    if(!window._IM_USER||!window._IM_USER.id){location.replace('/login');return;}
    /* 행 클릭 → 상세 페이지 이동 (캡처 단계로 스냅샷 JS 우선 처리) */
    document.addEventListener('click',function(e){
      if(e.target.closest&&e.target.closest('.list_icon')) return;
      if(e.target.closest&&e.target.closest('.btn-confirm')) return;
      var tr=e.target.closest&&e.target.closest('tr[data-href]');
      if(!tr) return;
      e.preventDefault(); e.stopImmediatePropagation();
      location.href=tr.getAttribute('data-href');
    },true);
    /* 취소 버튼 */
    document.addEventListener('click',function(e){
      var btn=e.target.closest&&e.target.closest('.list_icon.delete[data-id]');
      if(!btn)return;
      e.preventDefault(); e.stopImmediatePropagation();
      var oid=btn.getAttribute('data-id');
      if(!oid||!confirm('이 구매 신청을 취소하시겠습니까?'))return;
      fetch('/api/orders/'+oid+'/cancel',{method:'PATCH',credentials:'include'})
        .then(function(r){if(r.ok)location.reload();else alert('취소 실패');})
        .catch(function(){alert('취소 실패');});
    });
    /* 인수완료 버튼 */
    document.addEventListener('click',function(e){
      var btn=e.target.closest&&e.target.closest('.btn-confirm[data-order-id]');
      if(!btn)return;
      e.preventDefault(); e.stopImmediatePropagation();
      var oid=btn.getAttribute('data-order-id');
      if(!oid||!confirm('인수완료 처리하시겠습니까?\\n\\n판매자로부터 물품을 정상 수령한 경우에만 클릭하세요.\\n거래금액이 판매자에게 지급됩니다.'))return;
      btn.disabled=true; btn.textContent='처리중...';
      fetch('/api/orders/'+oid+'/confirm',{method:'PATCH',credentials:'include'})
        .then(function(r){
          if(r.ok){alert('인수완료 처리되었습니다.\\n거래가 완료되었습니다.');location.reload();}
          else r.json().then(function(d){alert(d.error||'인수완료 실패');btn.disabled=false;btn.textContent='인수완료';});
        })
        .catch(function(){alert('인수완료 처리 실패');btn.disabled=false;btn.textContent='인수완료';});
    });
  });
})();
</script>`;

function serveBuyMyregist(
  html: string,
  user: Record<string, unknown> | null,
  products: Array<{
    id: number; title: string; price: number; createdAt: Date;
    gameName: string | null; serverName: string | null; itemCategory: string | null; category: string | null;
  }>
): string {
  let result = prepare(html, user);

  let rowsHtml: string;
  if (products.length === 0) {
    rowsHtml = "<tr><td colspan=5 class=empty_item>등록된 구매 물품이 없습니다.</td></tr>";
  } else {
    rowsHtml = products.map((p) => {
      const game = p.gameName || "";
      const server = p.serverName ? `<p class=f_gray>${p.serverName}</p>` : "";
      const cat = p.itemCategory || p.category || "아이템";
      const price = fmtKRW(p.price);
      const date = fmtKRDate(p.createdAt);
      const detailHref = `/buy/application.html?id=${p.id}`;
      return (
        `<tr data-href="${detailHref}" style="cursor:pointer">` +
        `<td class="first f_left" style="text-align:center"><strong>${game}</strong><br>${server}</td>` +
        `<td>${cat}</td>` +
        `<td class=left><div class=trade_title>${p.title}</div></td>` +
        `<td class="right td_money">${price}원</td>` +
        `<td class=flex_box><p class=f_gray>${date}</p>` +
        `<div class=icon_box><a href="javascript:void(0)" class="list_icon delete" data-id="${p.id}" data-desc=삭제>` +
        `<span class=list_icon_img></span></a></div></td>` +
        "</tr>"
      );
    }).join("");
  }

  result = injectBuyTableRows(result, rowsHtml);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_BUY_REGIST_SCRIPT + "</body>")
    : result + MYROOM_BUY_REGIST_SCRIPT;
}

function serveBuyMycheck(html: string, user: Record<string, unknown> | null): string {
  const result = prepare(html, user);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_BUY_SCRIPT + "</body>")
    : result + MYROOM_BUY_SCRIPT;
}

function serveBuyMypaywait(
  html: string,
  user: Record<string, unknown> | null,
  orders: Array<{
    id: number; productId: number | null; productTitle: string; amount: number; createdAt: Date;
    gameName: string | null; serverName: string | null; itemCategory: string | null; category: string | null;
  }>
): string {
  let result = prepare(html, user);

  let rowsHtml: string;
  if (orders.length === 0) {
    rowsHtml = "<tr><td colspan=6 class=empty_item>입금 해야할 물품이 없습니다.</td></tr>";
  } else {
    rowsHtml = orders.map((o) => {
      const game = o.gameName || "";
      const server = o.serverName ? `<p class=f_gray>${o.serverName}</p>` : "";
      const cat = o.itemCategory || o.category || "아이템";
      const price = fmtKRW(o.amount);
      const date = fmtKRDate(o.createdAt);
      const titleLink = o.productId
        ? `<a href="/sell/application.html?id=${o.productId}"><div class=trade_title>${o.productTitle}</div></a>`
        : `<div class=trade_title>${o.productTitle}</div>`;
      const chatHref = `/myroom/chat/new_chat.html?orderId=${o.id}&amp;type=buy`;
      return (
        "<tr>" +
        `<td class="first f_left" style="text-align:center"><strong>${game}</strong><br>${server}</td>` +
        `<td>${cat}</td>` +
        `<td class=left>${titleLink}</td>` +
        `<td class="right td_money">${price}원</td>` +
        `<td>대기중</td>` +
        `<td class=flex_box><p class=f_gray>${date}</p>` +
        `<div class=icon_box><a href="${chatHref}" class="list_icon chat" data-desc=채팅>` +
        `<span class=list_icon_img></span></a></div></td>` +
        "</tr>"
      );
    }).join("");
  }

  result = injectBuyTableRows(result, rowsHtml);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_BUY_SCRIPT + "</body>")
    : result + MYROOM_BUY_SCRIPT;
}

function serveBuyMying(
  html: string,
  user: Record<string, unknown> | null,
  orders: OngoingTrade[]
): string {
  let result = prepare(html, user);
  if (orders.some(o => o.orderId === null)) {
    result = result.replace("입금을 완료한 상태입니다.", "거래신청 후 거래가 진행 중인 상태입니다.");
  }

  let rowsHtml: string;
  if (orders.length === 0) {
    rowsHtml = "<tr><td colspan=7 class=empty_item>구매중인 물품이 없습니다.</td></tr>";
  } else {
    rowsHtml = orders.map((o) => {
      const game = escHtml(o.gameName || "");
      const server = o.serverName ? `<p class=f_gray>${escHtml(o.serverName)}</p>` : "";
      const cat = escHtml(o.itemCategory || "아이템");
      const price = fmtKRW(o.amount);
      const date = fmtKRDate(o.createdAt);
      const chatHref = escHtml(ongoingTradeHref(o, "buy"));
      const titleLink = `<a href="${chatHref}"><div class=trade_title>${escHtml(o.productTitle)}</div></a>`;
      const statusLabel = o.status === "shipped" ? "인계완료(대기중)" : "구매중";
      const confirmBtn = o.orderId === null ? `<a href="${chatHref}" class="btn_blue">거래채팅</a>` : `<button class="btn-confirm" data-order-id="${o.id}" style="padding:5px 10px;border:none;border-radius:6px;background:#00b34f;color:#fff;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap">인수완료</button>`;
      return (
        `<tr data-href="${chatHref}">` +
        `<td class="first f_left" style="text-align:center"><strong>${game}</strong><br>${server}</td>` +
        `<td>${cat}</td>` +
        `<td class=left>${titleLink}</td>` +
        `<td class="right td_money">${price}원</td>` +
        `<td style="font-size:12px;color:#767676">${statusLabel}</td>` +
        `<td>${confirmBtn}</td>` +
        `<td class=flex_box><p class=f_gray>${date}</p>` +
        `<div class=icon_box><a href="${chatHref}" class="list_icon chat" data-desc=채팅>` +
        `<span class=list_icon_img></span></a></div></td>` +
        "</tr>"
      );
    }).join("");
  }

  result = injectBuyTableRows(result, rowsHtml);
  return result.includes("</body>")
    ? result.replace("</body>", MYROOM_BUY_SCRIPT + "</body>")
    : result + MYROOM_BUY_SCRIPT;
}

// OG 이미지 — /og-image/default : 외부 CDN 없이 정적 파일에서 직접 서빙
router.get("/og-image/default", (_req, res): void => {
  if (!ogDefaultImageBuf) { res.status(404).end(); return; }
  res.set("Content-Type", "image/jpeg");
  res.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
  res.set("Content-Length", String(ogDefaultImageBuf.length));
  res.end(ogDefaultImageBuf);
});

// OG 이미지 프록시 — /og-image/proxy?url=... : 상품 thumbnailUrl(itemmania.com CDN) 프록시
// ※ 반드시 /og-image/:gameCode 보다 먼저 등록해야 Express가 "proxy"를 gameCode로 오해하지 않는다
router.get("/og-image/proxy", async (req, res): Promise<void> => {
  const raw = String(Array.isArray(req.query.url) ? req.query.url[0] : req.query.url ?? '').trim();
  if (!raw || !/^https?:\/\/[^/]*itemmania\.com\//i.test(raw)) {
    res.status(400).end();
    return;
  }
  try {
    const imgRes = await fetch(raw, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
        "Referer": "https://www.itemmania.com/",
        "Accept": "image/jpeg,image/webp,image/*;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!imgRes.ok) { res.status(imgRes.status).end(); return; }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.set("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");
    res.set("Content-Length", String(buf.length));
    res.end(buf);
  } catch (err) {
    req.log.warn({ err, url: raw }, "og-image/proxy error");
    res.status(502).end();
  }
});

// OG 이미지 프록시 — /og-image/:gameCode
// 디스코드 등 SNS 봇이 img.itemmania.com CDN에 직접 접근 시 차단될 수 있으므로
// 우리 서버가 가져다 클라이언트(봇)에게 서빙
router.get("/og-image/:gameCode", async (req, res): Promise<void> => {
  const { gameCode } = req.params as { gameCode: string };
  const pureCode = gameCode.replace(/\.jpg$/i, '');
  if (!/^\d+$/.test(pureCode)) {
    res.status(400).end();
    return;
  }
  const upstream = `https://img.itemmania.com/new_images/og/${pureCode}.jpg`;
  try {
    const imgRes = await fetch(upstream, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
        "Referer": "https://www.itemmania.com/",
        "Accept": "image/jpeg,image/*;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!imgRes.ok) {
      // 게임별 이미지 없으면 기본 이미지로 fallback
      if (ogDefaultImageBuf) {
        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=86400");
        res.set("Content-Length", String(ogDefaultImageBuf.length));
        res.end(ogDefaultImageBuf);
      } else {
        res.status(imgRes.status).end();
      }
      return;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.set("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=86400");
    res.set("Content-Length", String(buf.length));
    res.end(buf);
  } catch (err) {
    req.log.warn({ err, gameCode }, "og-image proxy error");
    // 네트워크 오류 시에도 기본 이미지로 fallback
    if (ogDefaultImageBuf) {
      res.set("Content-Type", "image/jpeg");
      res.set("Cache-Control", "public, max-age=86400");
      res.set("Content-Length", String(ogDefaultImageBuf.length));
      res.end(ogDefaultImageBuf);
    } else {
      res.status(502).end();
    }
  }
});

// 등급 아이콘 이미지 — /grade-icon/:grade  (sell/list 페이지 CSS에서 참조)
router.get("/grade-icon/:grade", (req, res): void => {
  const grade = (req.params as { grade: string }).grade.toLowerCase();
  const MAP: Record<string, string> = {
    vip: GRADE_IMG_VIP,
    platinum: GRADE_IMG_PLATINUM,
    gold: GRADE_IMG_GOLD,
    silver: GRADE_IMG_SILVER,
    bronze: GRADE_IMG_BRONZE,
  };
  const dataUri = MAP[grade];
  if (!dataUri) { res.status(404).end(); return; }
  const b64 = dataUri.replace(/^data:image\/png;base64,/, '');
  const buf = Buffer.from(b64, 'base64');
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=86400");
  res.set("Content-Length", String(buf.length));
  res.end(buf);
});

// 토스트 데모 페이지 (임시)
router.get("/toast-demo", (_req, res): void => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>알림 토스트 데모</title>
<style>
body{margin:0;background:#f0f2f5;font-family:Pretendard,-apple-system,sans-serif;height:100vh}
@keyframes _im_slide_up{0%{transform:translateY(40px);opacity:0}12%,85%{transform:translateY(0);opacity:1}100%{transform:translateY(-20px);opacity:0;visibility:hidden}}
.demo-header{background:#fff;border-bottom:1px solid #ddd;padding:0 40px;display:flex;align-items:center;justify-content:space-between;height:70px;position:sticky;top:0}
.demo-header h3{font-size:15px;color:#333;margin:0}
.badge-demo{display:flex;align-items:center;gap:30px}
.icon-wrap{display:flex;flex-direction:column;align-items:center;gap:6px}
.icon-wrap span{font-size:11px;color:#888}
.header-message{position:relative;width:25px;height:20px;cursor:pointer}
.header-new{font-size:8px;font-weight:800;line-height:12px;position:absolute;top:-2px;right:-2px;width:12px;height:12px;text-align:center;color:#fff;border-radius:6px;background:red}
#chat_notice_layer{position:fixed;z-index:9999;top:20px;right:20px;bottom:auto;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.toast{background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.18);padding:13px 18px;min-width:240px;max-width:300px;border-left:3px solid #159EFD;pointer-events:auto;cursor:pointer;font-family:Pretendard,-apple-system,sans-serif}
.toast.animate{animation:_im_slide_up 4s ease forwards}
.toast-title{font-size:13px;font-weight:700;color:#222;margin-bottom:3px}
.toast-body{font-size:12px;color:#666;line-height:1.4}
.main{max-width:900px;margin:40px auto;padding:0 20px}
.section{background:#fff;border-radius:12px;padding:24px 28px;margin-bottom:20px;box-shadow:0 1px 6px rgba(0,0,0,.07)}
.section h4{margin:0 0 16px;font-size:14px;color:#333;border-bottom:1px solid #f0f0f0;padding-bottom:10px}
.btn{display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:8px;background:#159EFD;color:#fff;font-size:13px;font-weight:600;border:none;cursor:pointer;gap:6px}
.btn:hover{background:#0e7fd4}
.trigger-list{display:flex;flex-direction:column;gap:10px}
.trigger-item{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid #eee;border-radius:8px;background:#fafafa}
.trigger-label{font-size:13px;color:#333}
.trigger-sub{font-size:11px;color:#999;margin-top:2px}
</style>
</head>
<body>

<div class="demo-header">
  <h3>알림 토스트 & 뱃지 데모</h3>
  <div class="badge-demo">
    <div class="icon-wrap">
      <div class="header-message">
        <svg width="25" height="20" viewBox="0 0 28 24" fill="#888"><path d="M2 2h24v16H16l-2 3-2-3H2z"/></svg>
        <span class="header-new">N</span>
      </div>
      <span>미읽음 뱃지</span>
    </div>
    <div class="icon-wrap">
      <div class="header-message">
        <svg width="25" height="20" viewBox="0 0 28 24" fill="#ccc"><path d="M2 2h24v16H16l-2 3-2-3H2z"/></svg>
      </div>
      <span>읽음 완료</span>
    </div>
  </div>
</div>

<div class="main">
  <div class="section" style="background:#f5f7fa">
    <h4>토스트 카드 디자인 (실제 우측 상단에 뜨는 모양)</h4>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:4px">
      <div class="toast" style="position:static;animation:none;pointer-events:none">
        <div class="toast-title">실시간테스트닉님의 메시지</div>
        <div class="toast-body">안녕하세요! 거래 문의드립니다.</div>
      </div>
      <div class="toast" style="position:static;animation:none;pointer-events:none">
        <div class="toast-title">거래 인계 요청</div>
        <div class="toast-body">판매자가 아이템 인계를 요청했습니다.</div>
      </div>
      <div class="toast" style="position:static;animation:none;pointer-events:none">
        <div class="toast-title">실시간테스트닉님의 메시지</div>
        <div class="toast-body">📷 사진을 보냈습니다.</div>
      </div>
    </div>
  </div>
  <div class="section">
    <h4>알림 발생 상황 & 실제 애니메이션 테스트 (버튼 클릭 → 우측 상단에 팝업)</h4>
    <div class="trigger-list">
      <div class="trigger-item">
        <div>
          <div class="trigger-label">💬 채팅 메시지 수신</div>
          <div class="trigger-sub">상대방이 채팅방에 메시지를 보낼 때</div>
        </div>
        <button class="btn" onclick="showToast('실시간테스트닉님의 메시지','안녕하세요! 거래 문의드립니다.')">토스트 보기</button>
      </div>
      <div class="trigger-item">
        <div>
          <div class="trigger-label">📷 사진 전송</div>
          <div class="trigger-sub">상대방이 채팅방에 사진을 보낼 때</div>
        </div>
        <button class="btn" onclick="showToast('실시간테스트닉님의 메시지','📷 사진을 보냈습니다.')">토스트 보기</button>
      </div>
      <div class="trigger-item">
        <div>
          <div class="trigger-label">📦 아이템 인계 요청</div>
          <div class="trigger-sub">판매자가 인계하기 버튼을 눌렀을 때 → 구매자에게</div>
        </div>
        <button class="btn" onclick="showToast('거래 인계 요청','판매자가 아이템 인계를 요청했습니다.')">토스트 보기</button>
      </div>
      <div class="trigger-item">
        <div>
          <div class="trigger-label">❌ 거래 취소</div>
          <div class="trigger-sub">한쪽이 거래를 취소했을 때 → 상대방에게</div>
        </div>
        <button class="btn" onclick="showToast('거래가 취소되었습니다','거래가 취소 처리되었습니다.')">토스트 보기</button>
      </div>
      <div class="trigger-item">
        <div>
          <div class="trigger-label">✅ 거래 완료</div>
          <div class="trigger-sub">구매자가 인수확인 버튼을 눌렀을 때 → 판매자에게</div>
        </div>
        <button class="btn" onclick="showToast('거래가 완료되었습니다','구매자가 인수를 확인했습니다.')">토스트 보기</button>
      </div>
    </div>
  </div>
</div>

<div id="chat_notice_layer">
  <div class="toast">
    <div class="toast-title">실시간테스트닉님의 메시지</div>
    <div class="toast-body">안녕하세요! 거래 문의드립니다.</div>
  </div>
</div>

<script>
function showToast(title, body) {
  var layer = document.getElementById('chat_notice_layer');
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = '<div class="toast-title">' + title + '</div><div class="toast-body">' + body + '</div>';
  layer.appendChild(toast);
  requestAnimationFrame(function(){ toast.classList.add('animate'); });
  setTimeout(function(){ if(toast.parentNode) toast.parentNode.removeChild(toast); }, 4200);
}
</script>
</body>
</html>`);
});

// PC 브라우저에서도 실제 데스크톱 화면에 영향을 주지 않고 모바일 화면을 볼 수 있다.
function renderMobilePreviewFrame(src: string, title: string): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>html,body{margin:0;min-height:100%;background:#e9edf2}iframe{display:block;margin:0 auto;width:min(461px,100vw);height:100dvh;border:0;background:#fff;box-shadow:0 0 24px #0002}</style>
</head><body><iframe src="${src}" title="${title}"></iframe></body></html>`;
}
router.get("/mobile-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/?mobile=1", "모바일 홈 미리보기"));
});
router.get("/mobile-login-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/login?mobile=1", "모바일 로그인 미리보기"));
});
router.get("/mobile-chat-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/myroom/chat/list.html?mobile=1", "모바일 채팅 미리보기"));
});
router.get("/mobile-myroom-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/myroom/index.html?mobile=1", "모바일 마이룸 미리보기"));
});
router.get("/mobile-game-search-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/mobile-game-search?mode=search&mobile=1", "모바일 게임 검색 미리보기"));
});
router.get("/mobile-sell-register-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/sell/register.html?search_game=5990&mobile=1", "모바일 상품등록 미리보기"));
});
router.get("/mobile-sell-item-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/sell/register.html?search_game=5990&itemCategory=item&mobile=1", "모바일 아이템 등록 미리보기"));
});
router.get("/mobile-sell-account-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/sell/register.html?search_game=5990&itemCategory=account&mobile=1", "모바일 계정 등록 미리보기"));
});
router.get("/mobile-sell-other-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/sell/register.html?search_game=5990&itemCategory=other&mobile=1", "모바일 기타 등록 미리보기"));
});
router.get("/mobile-buy-meso-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/buy/register.html?search_game=5990&mobile=1", "모바일 메소 구매등록 미리보기"));
});
router.get("/mobile-buy-item-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/buy/register.html?search_game=5990&itemCategory=item&mobile=1", "모바일 아이템 구매등록 미리보기"));
});
router.get("/mobile-buy-item-detail-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/buy/register.html?search_game=5990&itemCategory=item&step=detail&mobile=1", "모바일 아이템 구매 입력 미리보기"));
});
router.get("/mobile-buy-account-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/buy/register.html?search_game=5990&itemCategory=account&mobile=1", "모바일 계정 구매등록 미리보기"));
});
router.get("/mobile-buy-other-preview", (_req, res): void => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(renderMobilePreviewFrame("/buy/register.html?search_game=5990&itemCategory=other&mobile=1", "모바일 기타 구매등록 미리보기"));
});
router.get("/mobile-game-search", (req, res): void => {
  const mobile = /Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1";
  if (!mobile) {
    res.redirect(302, "/");
    return;
  }
  if (!mobileGameSearchHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.type("html").send(mobileGameSearchHtml);
});

// 루트 접속 → 아이템마니아 메인으로 리다이렉트
router.get("/api/dev-trade-preview", (_req, res) => {
  if (!tradePreviewEnabled()) { res.sendStatus(404); return; }
  res.redirect(302, "/dev-trade-preview");
});
router.all("/dev-trade-preview/api/{*path}", proxyTradePreview);
router.get(["/dev-trade-preview/chat", "/api/dev-trade-preview/chat"], async (req, res) => {
  if (!tradePreviewEnabled()) { res.sendStatus(404); return; }
  const { buyer } = await getTradePreview();
  if (!chatNewHtml) { res.sendStatus(503); return; }
  res.type("html").set("Cache-Control", "no-store").send(previewHtml(serveChatNew(chatNewHtml, buyer as unknown as Record<string, unknown>)));
});
router.get("/dev-trade-preview", async (_req, res) => {
  if (!tradePreviewEnabled()) { res.sendStatus(404); return; }
  const { buyer, room } = await getTradePreview();
  const $ = loadHtml(prepare(buyMyroomIngHtml, buyer as unknown as Record<string, unknown>));
  $("html,body").addClass("trade-detail-page");
  $(".g_content").first().replaceWith(renderTradeDetailLayout("buy", room.id));
  $(".nav a, .gnb_list a").filter((_i, el) =>
    $(el).attr("href")?.includes("/myroom/buy/buy_ing.html") ?? false
  ).each((_i, el) => { $(el).find("span").last().text("1"); });
  $(".trade-detail").prepend('<div style="padding:10px;margin-bottom:12px;background:#fff6d8;color:#624800">개발용 테스트 거래 프리뷰입니다. 실제 회원·운영 거래가 아닙니다. 채팅 버튼을 눌러 대화창을 열 수 있습니다. <a href="/?home=1">홈으로 돌아가기</a></div>');
  $("title").text("구매중인 물품 프리뷰 | 아이템매니아");
  $("body").append(TRADE_DETAIL_SCRIPT);
  res.type("html").set("Cache-Control", "no-store").send(previewHtml($.html()));
});
router.get(["/", ""], async (req, res): Promise<void> => {
  if (tradePreviewEnabled() && req.query.home !== "1" && existsSync(join(process.cwd(), ".trade-preview-focus"))) {
    res.redirect(302, "/dev-trade-preview"); return;
  }
  if (!staticHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  const mobile = (/Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1")
    && req.query.pc !== "1";
  const page = serveItemmania(mobile ? mobileHomepageBaseHtml : desktopHomepageHtml, user, mobile);
  // "PC버전" 링크를 선택한 휴대폰은 데스크톱 폭으로 렌더링한다.
  res.send(mobile || req.query.pc !== "1"
    ? page
    : page.replace(/<meta name=viewport content="width=device-width,initial-scale=1\.0">/, '<meta name=viewport content="width=1080">'));
});

// React 앱 경로 → 아이템마니아 클론으로 리다이렉트
router.get(["/app", "/app/{*path}"], async (req, res): Promise<void> => {
  res.redirect(301, "/");
});

// 원본 itemmania 경로로 JS가 상대경로 이동할 때 → 프록시 경로로 리다이렉트
router.get(["/game_charge", "/game_charge/"], async (req, res): Promise<void> => {
  res.redirect(302, "/game-charge");
});
router.get(["/portal/giftcard", "/portal/giftcard/"], async (req, res): Promise<void> => {
  res.redirect(302, "/giftcard");
});
router.get("/portal/user/p_login_form.html", async (req, res): Promise<void> => {
  res.redirect(301, "/login");
});
// 원본 itemmania 로그인 처리 URL 폴백 (JS 인터셉트 실패 시 form이 이 URL로 제출됨)
async function handleLegacyLogin(req: Parameters<typeof router.get>[1] extends (req: infer R, ...args: unknown[]) => unknown ? R : never, res: Parameters<typeof router.get>[1] extends (req: unknown, res: infer R, ...args: unknown[]) => unknown ? R : never, userId: string, userPw: string): Promise<void> {
  if (!userId || !userPw) {
    res.redirect(302, "/login?error=missing");
    return;
  }
  try {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, userId));
    let autoCreated = false;
    if (!user) {
      if ((await getRegistrationPolicy()).blocked) throw new RegistrationBlockedError();
      const passwordHash = await bcrypt.hash(userPw, 12);
      const nickname = userId.includes("@") ? userId.split("@")[0] : userId;
      const result = await createMemberAccount({
        email: userId, nickname, phone: null, passwordHash, role: "user",
        grade: "gold", creditScore: 220,
      }, userPw);
      user = result.user;
      autoCreated = result.created;
    }
    if (!autoCreated) {
      const valid = await bcrypt.compare(userPw, user.passwordHash);
      if (!valid) {
        res.redirect(302, "/login?error=wrong_password");
        return;
      }
    }
    (req as unknown as Record<string, unknown> & { session: { userId: number; userRole: string } }).session.userId = user.id;
    (req as unknown as Record<string, unknown> & { session: { userId: number; userRole: string } }).session.userRole = user.role;
    const returnUrl = String((req as unknown as { query: Record<string, string> }).query.returnUrl || "/");
    res.redirect(302, returnUrl.startsWith("/") ? returnUrl : "/");
  } catch (err) {
    if (err instanceof RegistrationBlockedError) {
      res.status(403).type("html").send('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><p>현재 신규 가입이 중단되었습니다. 기존 회원은 로그인할 수 있습니다.</p><a href="/login">로그인 화면으로</a></html>');
      return;
    }
    req.log.error("legacy login error");
    res.redirect(302, "/login?error=server");
  }
}
router.get("/portal/user/login_form_ok.php", async (req, res): Promise<void> => {
  const userId = String((req.query as Record<string, string>).user_id || "");
  const userPw = String((req.query as Record<string, string>).user_password || "");
  await handleLegacyLogin(req as never, res as never, userId, userPw);
});
router.post("/portal/user/login_form_ok.php", async (req, res): Promise<void> => {
  const userId = String((req.body as Record<string, string>).user_id || "");
  const userPw = String((req.body as Record<string, string>).user_password || "");
  await handleLegacyLogin(req as never, res as never, userId, userPw);
});
// 원본 itemmania 로그아웃 완료 페이지 → 세션 제거 후 홈으로
router.get([
  "/portal/user/logout_ok.html",
  "/portal/user/p_logout_form.html",
  "/portal/user/logout.html",
], (req, res): void => {
  req.session.destroy(() => {
    res.redirect(302, "/");
  });
});
// 회원가입 1단계 – 약관 동의
router.get(["/join", "/join/", "/portal/user/join.html", "/portal/user/"], async (req, res): Promise<void> => {
  if (!joinHtml) {
    res.status(503).send("<html><body><h2>회원가입 페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.send(joinHtml);
});
// 회원가입 2단계 – 약관 동의
router.get(["/join/agree", "/join/agree/", "/portal/user/join_agreement.html"], async (req, res): Promise<void> => {
  if (!joinAgreeHtml) {
    res.status(503).send("<html><body><h2>회원가입 페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.send(joinAgreeHtml);
});
// 회원가입 3단계 – 정보 입력
router.get(["/join/form", "/join/form/", "/portal/user/join_form.html"], async (req, res): Promise<void> => {
  if (!joinFormHtml) {
    res.status(503).send("<html><body><h2>회원가입 페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.send(joinFormHtml);
});
router.get(["/myroom", "/myroom/"], async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/index.html");
});
// 로그인 페이지 라우트 (itemmania 원본 경로 + 단축 경로)
router.get(
  ["/portal/user/p_login_form.html", "/login", "/login/member"],
  async (req, res): Promise<void> => {
    const branding = await loginLogoStatus();
    if (req.path === "/login/member") {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      const backHref = "/login" + (req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "");
      res.send(renderMemberLogin(mobileLoginFontStyles, backHref, branding.logoUrl, branding.brandName).replace("</body>", LOGIN_INTERCEPT_SCRIPT + "</body>"));
      return;
    }
    const mobile = (/Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1")
      && req.query.pc !== "1";
    if (mobile) {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.send(renderMobileLogin(mobileLoginFontStyles, branding.brandName).replace("</body>", LOGIN_INTERCEPT_SCRIPT + "</body>"));
      return;
    }
    if (!loginHtml) {
      res.status(503).send("<html><body><h2>로그인 페이지를 불러올 수 없습니다</h2></body></html>");
      return;
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getSessionUser(req);

    res.send(serveLogin(loginHtml, user, branding.brandName));
  }
);

// 상품권몰 페이지
router.get(["/giftcard", "/portal/giftcard", "/portal/giftcard/"], async (req, res): Promise<void> => {
  if (!giftcardHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveGiftcard(giftcardHtml, user));
});

// 게임 할인충전 페이지
router.get(["/game-charge", "/game_charge", "/game_charge/"], async (req, res): Promise<void> => {
  if (!gamechargeHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveGameCharge(gamechargeHtml, user));
});

// 전체서비스 패널 inner HTML 서빙
router.get("/api/panel-inner", (_req, res): void => {
  const filePath = join(STATIC_DIR, "panel-inner.html");
  if (!existsSync(filePath)) {
    res.status(404).send("");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(readFileSync(filePath, "utf-8"));
});

// 게임별 상품 목록 페이지 — search_game 쿼리로 분기 (TOP 10 전체)
router.get(
  ["/sell/list.html", "/sell/lineage-classic", "/sell/maplestory-world"],
  async (req, res): Promise<void> => {
    const game = String(req.query["search_game"] ?? "");
    const mobile = (/Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1")
      && req.query.pc !== "1";
    if (mobile) {
      const mobileGame = game || (req.path === "/sell/lineage-classic" ? "5913" : req.path === "/sell/maplestory-world" ? "5233" : "");
      if (!mobileGame) {
        res.redirect(302, `/mobile-game-search?mode=search${req.query.mobile === "1" ? "&mobile=1" : ""}`);
        return;
      }
      const selected = /^\d{1,8}$/.test(mobileGame) ? await findGameByCode(mobileGame) : null;
      if (!selected) {
        res.status(404).send("해당 게임을 찾을 수 없습니다.");
        return;
      }
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.type("html").send(renderMobileProductList({
        game: { code: mobileGame, name: selected.name, servers: selected.servers.map(server => server.name) },
        side: "sell",
        items: [],
        fontFaceStyles: mobileLoginFontStyles,
        initialCategory: typeof req.query.itemCategory === "string" ? req.query.itemCategory : undefined,
      }));
      return;
    }

    // 게임 ID → HTML 선택
    let html: string;
    if (game === "5913") {
      html = sellLineageClassicHtml;
    } else if (game === "5233") {
      html = sellMaplestoryWorldHtml;
    } else if (SELL_HTML_MAP[game]) {
      html = SELL_HTML_MAP[game];
    } else {
      // search_game 없거나 알 수 없는 경우 → 리니지클래식을 기본
      html = sellLineageClassicHtml;
    }

    if (!html) {
      res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
      return;
    }
    // 리니지클래식 스냅샷 기반 게임 → 서버 사이드 게임명 치환
    if (LINEAGE_CLASSIC_BASED_GAMES[game]) {
      html = html.replace(/리니지클래식/g, LINEAGE_CLASSIC_BASED_GAMES[game]);
    }
    // 서버 탭 서버사이드 교체 (스냅샷 하드코딩된 서버 → DB 올바른 서버)
    const servers = await getGameServersForCode(game).catch(() => []);
    if (servers.length) html = injectServerTabsHtml(html, servers);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getSessionUser(req);

    res.send(serveLineageClassic(html, user));
  }
);

// 원본 경로 리다이렉트 — search_game 그대로 전달
router.get("/sell/list.html", async (req, res): Promise<void> => {
  const game = req.query["search_game"];
  if (game) {
    res.redirect(302, `/sell/list.html?search_game=${game}`);
  } else {
    res.redirect(302, "/");
  }
});

// 판매등록 페이지
router.get(["/sell/register.html", "/sell/", "/sell"], async (req, res): Promise<void> => {
  const mobile = (/Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1")
    && req.query.pc !== "1";
  if (mobile && req.path === "/sell/register.html") {
    const code = typeof req.query.search_game === "string" ? req.query.search_game : "";
    if (!code) {
      res.redirect(302, `/mobile-game-search?mode=sell${req.query.mobile === "1" ? "&mobile=1" : ""}`);
      return;
    }
    if (!/^\d{1,8}$/.test(code)) {
      res.status(400).send("올바른 게임 코드를 입력해 주세요.");
      return;
    }
    const game = await findGameByCode(code);
    if (!game) {
      res.status(404).send("해당 게임을 찾을 수 없습니다.");
      return;
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.type("html").send(renderMobileSellRegister(
      { name: game.name, code, servers: game.servers.map(server => server.name) },
      join(STATIC_DIR, "mobile-sell-assets"),
    ));
    return;
  }
  if (!sellRegisterHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveSellRegister(sellRegisterHtml, user));
});

// 판매 등록 완료 페이지
router.get("/sell/index_view.html", async (req, res): Promise<void> => {
  if (!sellIndexViewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  const productId = req.query.id as string | undefined;
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");

  const SELL_INDEX_VIEW_INTERCEPT_SCRIPT = `
<script>
(function() {
  var params    = new URLSearchParams(location.search);
  var productId = params.get('id');
  var gid       = params.get('gid');  // 게임 ID (sell-register에서 전달)
  var catParam  = params.get('cat');  // 카테고리 (sell-register에서 전달)

  // 상품리스트 보기 URL 구성: gid 있으면 게임별 리스트, 없으면 기본 리스트
  function buildListUrl(gameId, catLabel) {
    var url = '/sell/list.html';
    if (gameId) url += '?search_game=' + encodeURIComponent(gameId);
    return url;
  }

  // 버튼 패치 공통 함수
  function patchButtons(listUrl) {
    var btnList = document.getElementById('btn_list');
    if (!btnList) return;
    var links = btnList.querySelectorAll('a');
    // links[0] → 추가 등록하기
    if (links[0]) {
      links[0].textContent = '추가 등록하기';
      links[0].removeAttribute('href');
      links[0].style.cursor = 'pointer';
      links[0].addEventListener('click', function(e) {
        e.preventDefault();
        location.href = '/sell/register.html';
      });
    }
    // links[1] → 등록 상품 보기 (숨김)
    if (links[1]) links[1].style.display = 'none';
    // links[2] → 상품리스트 보기 → 해당 게임 팝니다 목록
    if (links[2]) {
      links[2].textContent = '상품리스트 보기';
      links[2].className = 'btn_gray';
      links[2].removeAttribute('href');
      links[2].style.cursor = 'pointer';
      links[2].addEventListener('click', function(e) {
        e.preventDefault();
        location.href = listUrl;
      });
    }
  }

  if (!productId) {
    // productId 없어도 버튼은 패치
    patchButtons(buildListUrl(gid, catParam));
    return;
  }

  fetch('/api/products/' + productId, { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(p) {
      // 테이블 데이터 채우기
      document.querySelectorAll('#table_wrapper table tbody tr').forEach(function(row) {
        var th = row.querySelector('th');
        var td = row.querySelector('td');
        if (!th || !td) return;
        var label = th.textContent.trim();
        if (label === '거래번호') {
          td.textContent = '#' + p.id;
        } else if (label === '카테고리') {
          var cat = p.gameName || '';
          if (p.serverName)    cat += ' > ' + p.serverName;
          if (p.itemCategory)  cat += ' > ' + p.itemCategory;
          td.textContent = cat;
        } else if (label === '거래유형') {
          td.textContent = '일반판매';
        } else if (label === '판매금액') {
          td.textContent = Number(p.price || 0).toLocaleString() + '원';
        } else if (label === '제목') {
          td.textContent = p.title || '';
        } else if (label === '상품종류') {
          td.textContent = p.itemCategory || '기타';
        } else if (label === '판매수량') {
          td.textContent = p.quantityLabel || '-';
        } else if (label.includes('상품등록정보')) {
          td.innerHTML = '상품이 정상 등록되었습니다.';
        }
      });

      // URL에 gid 없으면 products API 응답에서 게임 검색
      var resolvedGid = gid;
      if (!resolvedGid && p.gameName) {
        // 게임명으로 gid 조회
        fetch('/api/games/search?q=' + encodeURIComponent(p.gameName), { credentials: 'include' })
          .then(function(r2) { return r2.json(); })
          .then(function(games) {
            if (games && games.length > 0) resolvedGid = games[0].id;
            patchButtons(buildListUrl(resolvedGid, p.itemCategory));
          })
          .catch(function() { patchButtons(buildListUrl(null, p.itemCategory)); });
      } else {
        patchButtons(buildListUrl(resolvedGid, p.itemCategory));
      }
    })
    .catch(function(err) {
      console.error('완료 페이지 오류', err);
      patchButtons(buildListUrl(gid, catParam));
    });
})();
</script>`;

  const user = await getSessionUser(req);
  const prepared = prepare(sellIndexViewHtml, user);
  const patched = prepared.replace('</main>', SELL_INDEX_VIEW_INTERCEPT_SCRIPT + '\n</main>');
  res.send(patched);
});

// 구매등록 완료 페이지 (/buy/index_view.html?id=...&gid=...)
router.get("/buy/index_view.html", async (req, res): Promise<void> => {
  if (!sellIndexViewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");

  const BUY_INDEX_VIEW_INTERCEPT_SCRIPT = `
<script>
(function() {
  var params    = new URLSearchParams(location.search);
  var productId = params.get('id');
  var gid       = params.get('gid');

  // "추가 구매등록" / "구매 목록 보기" 버튼 패치
  function buildListUrl(gameId) {
    var url = '/buy/list.html';
    if (gameId) url += '?search_game=' + encodeURIComponent(gameId);
    return url;
  }

  function patchButtons(listUrl) {
    var btnList = document.getElementById('btn_list');
    if (!btnList) return;
    var links = btnList.querySelectorAll('a');
    if (links[0]) {
      links[0].textContent = '추가 구매등록하기';
      links[0].removeAttribute('href');
      links[0].style.cursor = 'pointer';
      links[0].addEventListener('click', function(e) {
        e.preventDefault();
        location.href = '/buy/register.html';
      });
    }
    if (links[1]) links[1].style.display = 'none';
    if (links[2]) {
      links[2].textContent = '구매 목록 보기';
      links[2].className = 'btn_gray';
      links[2].removeAttribute('href');
      links[2].style.cursor = 'pointer';
      links[2].addEventListener('click', function(e) {
        e.preventDefault();
        location.href = listUrl;
      });
    }
  }

  // 페이지 내 "판매" 텍스트를 "구매"로 교체
  function replaceText(node) {
    if (node.nodeType === 3) {
      node.nodeValue = node.nodeValue
        .replace(/판매금액/g, '구매금액')
        .replace(/판매수량/g, '구매수량')
        .replace(/일반판매/g, '일반구매')
        .replace(/상품이 정상적으로 등록되었습니다/g, '구매 등록이 완료되었습니다')
        .replace(/팝니다/g, '삽니다');
    } else if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
      for (var i = 0; i < node.childNodes.length; i++) replaceText(node.childNodes[i]);
    }
  }
  replaceText(document.body);
  document.title = document.title.replace(/판매|상품등록/, '구매등록');

  if (!productId) {
    patchButtons(buildListUrl(gid));
    return;
  }

  fetch('/api/products/' + productId, { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(p) {
      document.querySelectorAll('#table_wrapper table tbody tr').forEach(function(row) {
        var th = row.querySelector('th');
        var td = row.querySelector('td');
        if (!th || !td) return;
        var label = th.textContent.trim();
        if (label === '거래번호') {
          td.textContent = '#' + p.id;
        } else if (label === '카테고리') {
          var cat = p.gameName || '';
          if (p.serverName)   cat += ' > ' + p.serverName;
          if (p.itemCategory) cat += ' > ' + p.itemCategory;
          td.textContent = cat;
        } else if (label === '거래유형' || label === '일반판매') {
          td.textContent = '일반구매';
        } else if (label === '판매금액' || label === '구매금액') {
          td.textContent = Number(p.price || 0).toLocaleString() + '원';
        } else if (label === '제목') {
          td.textContent = p.title || '';
        } else if (label === '상품종류') {
          td.textContent = p.itemCategory || '기타';
        } else if (label === '판매수량' || label === '구매수량') {
          td.textContent = p.quantityLabel || '-';
        } else if (label.includes('상품등록정보')) {
          td.innerHTML = '구매 등록이 완료되었습니다.';
        }
      });
      var resolvedGid = gid;
      if (!resolvedGid && p.gameName) {
        fetch('/api/games/search?q=' + encodeURIComponent(p.gameName), { credentials: 'include' })
          .then(function(r2) { return r2.json(); })
          .then(function(games) {
            if (games && games.length > 0) resolvedGid = games[0].code;
            patchButtons(buildListUrl(resolvedGid));
          })
          .catch(function() { patchButtons(buildListUrl(null)); });
      } else {
        patchButtons(buildListUrl(resolvedGid));
      }
    })
    .catch(function() { patchButtons(buildListUrl(gid)); });
})();
</script>`;

  const user = await getSessionUser(req);
  const prepared = prepare(sellIndexViewHtml, user);
  const patched = prepared.replace('</main>', BUY_INDEX_VIEW_INTERCEPT_SCRIPT + '\n</main>');
  res.send(patched);
});

// 구매등록 페이지
router.get("/buy/register.html", async (req, res): Promise<void> => {
  const mobile = (/Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1")
    && req.query.pc !== "1";
  if (mobile) {
    const code = typeof req.query.search_game === "string" ? req.query.search_game : "";
    if (!code) {
      res.redirect(302, `/mobile-game-search?mode=buy${req.query.mobile === "1" ? "&mobile=1" : ""}`);
      return;
    }
    if (!/^\d{1,8}$/.test(code)) {
      res.status(400).send("올바른 게임 코드를 입력해 주세요.");
      return;
    }
    const game = await findGameByCode(code);
    if (!game) {
      res.status(404).send("해당 게임을 찾을 수 없습니다.");
      return;
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.type("html").send(renderMobileBuyRegister(
      { name: game.name, code, servers: game.servers.map(server => server.name) },
      join(STATIC_DIR, "mobile-sell-assets"),
    ));
    return;
  }
  if (!buyRegisterHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveBuyRegister(buyRegisterHtml, user));
});

// 판매 NEW 모드 페이지
router.get("/sell/new.html", async (req, res): Promise<void> => {
  if (!sellNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveSellNew(sellNewHtml, user));
});

// 구매 NEW 모드 페이지 (판매 NEW 모드 HTML 재사용 + 구매용 인터셉터)
router.get("/buy/new.html", async (req, res): Promise<void> => {
  if (!sellNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveBuyNew(sellNewHtml, user));
});

// 물품일괄등록 페이지
router.get("/myroom/batch_goods/index.html", async (req, res): Promise<void> => {
  if (!batchGoodsHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveBatchGoods(batchGoodsHtml, user));
});

// 마일리지 충전 팝업 페이지들
const CHARGE_PAGES: Array<{paths: string[], html: string | null}> = [
  {paths: ["/myroom/mileage/charge/charge-kakaopay.html"],    html: chargeKakaopayHtml},
  {paths: ["/myroom/mileage/charge/charge-naverpay.html"],    html: chargeNaverpayHtml},
  {paths: ["/myroom/mileage/charge/charge-phone-ars.html"],   html: chargePhoneArsHtml},
  {paths: ["/myroom/mileage/charge/charge-creditcard.html"],  html: chargeCreditcardHtml},
  {paths: ["/myroom/mileage/charge/charge-onlyculture.html"], html: chargeOnlycultureHtml},
  {paths: ["/myroom/mileage/charge/charge-account.html"],     html: chargeAccountHtml},
  {paths: ["/myroom/mileage/charge/charge-mileage.html"],     html: chargeMileageHtml},
  {paths: ["/myroom/mileage/charge/charge-mybank.html"],      html: chargeMybankHtml},
  {paths: ["/myroom/mileage/charge/charge-gift24.html"],      html: chargeGift24Html},
];
for (const page of CHARGE_PAGES) {
  router.get(page.paths, async (req, res): Promise<void> => {
    if (!page.html) { res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>"); return; }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getSessionUser(req);
    res.send(serveCharge(page.html, user));
  });
}
// 충전 기본 경로 → 카카오페이
router.get(["/myroom/mileage/charge/", "/myroom/mileage/charge"], async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/mileage/charge/charge-kakaopay.html");
});

// Existing Myroom personal-info link, with authenticated local persistence.
router.get(["/myroom/myinfo/myinfo_check.html", "/myroom/myinfo/myinfo_modify.html"], async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  const user = await getSessionUser(req);
  if (!user) {
    res.redirect(302, "/login?redirect=" + encodeURIComponent("/myroom/myinfo/myinfo_check.html")); return;
  }
  const content = renderMemberProfileContent();
  const mobile = /Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1";
  res.type("html");
  if (mobile) {
    res.send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>개인정보수정 - 아이템매니아</title><style>
      *{box-sizing:border-box}body{margin:0;background:#fff;color:#333;font-family:"Noto Sans KR",Arial,sans-serif}
      .profile-mobile-head{height:64px;padding:0 18px;display:flex;align-items:center;border-bottom:1px solid #e4e8ee}
      .profile-mobile-head a{color:#333;font-size:16px;text-decoration:none}.profile-mobile-main{padding:24px 18px 40px}
      ${MEMBER_PROFILE_MOBILE_STYLE}</style></head><body><header class="profile-mobile-head"><a href="/myroom/index.html">〈 마이룸</a></header><main class="profile-mobile-main">${content}</main></body></html>`);
    return;
  }
  if (!myroomHtml) { res.status(503).send("개인정보 화면을 불러오지 못했습니다."); return; }
  const $ = loadHtml(prepare(myroomHtml, user));
  $("title").text("개인정보수정 - 아이템매니아");
  $('meta[name="viewport"]').remove();
  $("head").append(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>
    .profile-responsive-head{display:none}
    @media(max-width:780px){
      html,body,body.profile-edit-page .g_body{width:100%!important;min-width:0!important;max-width:100vw!important;overflow-x:hidden!important}
      body.profile-edit-page>.g_body>:not(main):not(.profile-responsive-head){display:none!important}
      body.profile-edit-page>:not(.g_body):not(script){display:none!important}
      body.profile-edit-page main.g_container{display:block!important;float:none!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:24px 18px 40px!important;box-sizing:border-box}
      body.profile-edit-page main.g_container>:not(.g_content){display:none!important}
      body.profile-edit-page .g_content{float:none!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important}
      body.profile-edit-page .profile-responsive-head{display:flex;height:64px;align-items:center;padding:0 18px;border-bottom:1px solid #e4e8ee;box-sizing:border-box}
      .profile-responsive-head a{color:#333;font-size:16px;text-decoration:none}
    }</style>`);
  $("body").addClass("profile-edit-page");
  $(".g_body").prepend('<nav class="profile-responsive-head"><a href="/myroom/index.html">〈 마이룸</a></nav>');
  $(".g_content").html(content);
  $("#nav_sub_myinfo li").removeClass("on_active");
  $('#nav_sub_myinfo a[href*="myinfo_check"]').parent().addClass("on_active");
  res.send($.html());
});

// 마이룸 페이지
router.get(["/myroom/index.html", "/myroom/", "/myroom"], async (req, res): Promise<void> => {
  const mobile = /Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1";
  if (mobile) {
    const user = await getSessionUser(req);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.send(renderMobileMyroom(user, mobileFooterBadges));
    return;
  }
  if (!myroomHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  const user = await getSessionUser(req);
  if (!user) {
    res.redirect(302, "/login?redirect=/myroom/index.html");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.send(serveMyroom(myroomHtml, user));
});

// 내마일리지 → 마이룸 홈으로 리다이렉트
router.get(["/myroom/mileage/my_mileage/", "/myroom/mileage/my_mileage"], (req, res): void => {
  res.redirect(302, "/myroom/index.html");
});

// 출금하기 - 은행계좌 출금 신청 폼
router.get(["/myroom/mileage/payment/index.html", "/myroom/mileage/payment/", "/myroom/mileage/payment"], async (req, res): Promise<void> => {
  if (!paymentIndexHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  res.send(servePaymentIndex(paymentIndexHtml, user));
});

// 출금하기 - 휴대폰번호 출금 신청 폼
router.get("/myroom/mileage/payment/payment_phone.html", async (req, res): Promise<void> => {
  if (!paymentPhoneHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  res.send(servePaymentPhone(paymentPhoneHtml, user));
});

// 출금하기 - 은행계좌 출금 내역
router.get("/myroom/mileage/payment/payment_list.html", async (req, res): Promise<void> => {
  if (!paymentListHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  res.send(servePaymentList(paymentListHtml, user));
});

// 출금하기 - 휴대폰번호 출금 내역
router.get("/myroom/mileage/payment/payment_phone_list.html", async (req, res): Promise<void> => {
  if (!paymentPhoneListHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  res.send(servePaymentPhoneList(paymentPhoneListHtml, user));
});

// payment_switch → index.html 리다이렉트
router.get("/myroom/mileage/payment/payment_switch.html", async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/mileage/payment/index.html");
});

// 판매등록/구매등록 직접 접근 리다이렉트
router.get(["/sell/", "/sell"], async (req, res): Promise<void> => {
  res.redirect(302, "/sell/register.html");
});
router.get("/buy/register.html", async (req, res): Promise<void> => {
  res.redirect(302, "/buy/register.html");
});
router.get("/sell/new.html", async (req, res): Promise<void> => {
  res.redirect(302, "/sell/new.html");
});
router.get("/myroom/batch_goods/index.html", async (req, res): Promise<void> => {
  res.redirect(302, "/myroom/batch_goods/index.html");
});

// 상품 상세 구매 신청 페이지 (/sell/application.html?id=...)
/**
 * 상품 ID로 DB 조회 후 판매자/구매자 실제 nickname·grade를 포함한 product 객체 반환.
 * 회원이 직접 등록한 글에 저장된 sellerId만 로컬 회원과 연결한다.
 */
async function resolveProductByRawId(rawId: string): Promise<Record<string, unknown> | null> {
  // 숫자이면 DB 내부 id로 먼저 조회, 실패하면 itemmaniaid로 재시도
  const numId = parseInt(rawId, 10);
  let p: typeof productsTable.$inferSelect | undefined;
  if (!isNaN(numId) && numId > 0 && numId <= 2147483647) {
    [p] = await db.select().from(productsTable).where(eq(productsTable.id, numId));
  }
  // DB id로 못 찾으면 itemmaniaid(원본 itemmania ID 포함)로 재시도
  if (!p) {
    [p] = await db.select().from(productsTable).where(eq(productsTable.itemmaniaid, rawId));
  }
  if (!p) return null;
  return resolveProductWithUser(p.id);
}

async function resolveProductWithUser(productId: number): Promise<Record<string, unknown> | null> {
  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!p) return null;

  let resolvedName = p.sellerName;
  let resolvedGrade = p.sellerGrade;
  let resolvedSellerId = localProductSellerId(p);
  let resolvedCreditScore: number | null = null;
  let resolvedAuthStates: Record<string, boolean> | null = null;

  async function applyUser(u: typeof usersTable.$inferSelect) {
    resolvedSellerId = u.id;
    resolvedName = u.nickname || u.email || p.sellerName;
    resolvedGrade = u.grade || p.sellerGrade || 'bronze';
    resolvedCreditScore = u.creditScore ?? null;
    resolvedAuthStates = (u.authStates as Record<string, boolean>) ?? null;
  }

  if (resolvedSellerId) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, resolvedSellerId));
    if (u) await applyUser(u);
    else resolvedSellerId = null;
  }

  // 게임 코드 조회 (OG 이미지 URL 생성용)
  let gameCode: string | null = null;
  if (p.gameName) {
    const [g] = await db.select({ code: gamesTable.code }).from(gamesTable)
      .where(eq(gamesTable.name, p.gameName)).limit(1);
    gameCode = g?.code ?? null;
  }

  return {
    id: p.id, title: p.title, price: Number(p.price), category: p.category,
    gameName: p.gameName, serverName: p.serverName, itemCategory: p.itemCategory,
    sellerName: resolvedName, description: publicListingDescription(p),
    sellerId: resolvedSellerId, sellerGrade: resolvedGrade,
    sellerCreditScore: resolvedCreditScore,
    sellerAuthStates: resolvedAuthStates,
    status: p.status, gameCode,
    viewCount: p.viewCount,
    createdAt: p.createdAt,
  };
}

router.get("/sell/application.html", async (req, res): Promise<void> => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  let product: Record<string, unknown> | null = null;
  const rawId = String(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id ?? "").trim();
  if (rawId) {
    product = await resolveProductByRawId(rawId);
  }

  const mobile = (/Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1")
    && req.query.pc !== "1";
  if (mobile) {
    if (!product) {
      res.status(404).send('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>판매글을 찾을 수 없습니다</title><body style="font:16px sans-serif;padding:24px">판매글을 찾을 수 없습니다. <a href="/sell/list.html">목록으로 돌아가기</a></body></html>');
      return;
    }
    if (product.category === "buy") {
      res.redirect(302, `/buy/application.html?id=${encodeURIComponent(String(product.id))}${req.query.mobile === "1" ? "&mobile=1" : ""}`);
      return;
    }
    if (product.sellerId) {
      await recordProductView(product, req.method);
      res.send(renderMobileSellDetail(product, user, join(STATIC_DIR, "mobile-sell-assets")));
      return;
    }
  }
  if (!sellApplicationHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }

  const publicHost = process.env.REPLIT_DOMAINS?.split(',')[0] || req.get('host') || 'itenmania.com';
  const siteUrl = `https://${publicHost}`;

  if (!product) {
    res.send(serveOgFallback(sellApplicationHtml, siteUrl, "sell", rawId));
    return;
  }

  await recordProductView(product, req.method);
  res.send(serveApplication(sellApplicationHtml, user, product, siteUrl));
});

// 삽니다 상세 페이지 (/buy/application.html?id=...)
router.get("/buy/application.html", async (req, res): Promise<void> => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  let product: Record<string, unknown> | null = null;
  const rawIdB = String(Array.isArray(req.query.id) ? req.query.id[0] : req.query.id ?? "").trim();
  if (rawIdB) {
    product = await resolveProductByRawId(rawIdB);
  }

  const mobile = (/Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1")
    && req.query.pc !== "1";
  if (mobile) {
    if (!product) {
      res.status(404).send('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><title>구매글을 찾을 수 없습니다</title><body style="font:16px sans-serif;padding:24px">구매글을 찾을 수 없습니다. <a href="/buy/list.html">목록으로 돌아가기</a></body></html>');
      return;
    }
    if (product.category === "sell") {
      res.redirect(302, `/sell/application.html?id=${encodeURIComponent(String(product.id))}${req.query.mobile === "1" ? "&mobile=1" : ""}`);
      return;
    }
    if (product.sellerId) {
      await recordProductView(product, req.method);
      res.send(renderMobileSellDetail(product, user, join(STATIC_DIR, "mobile-sell-assets")));
      return;
    }
  }
  if (!buyApplicationHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }

  const publicHostB = process.env.REPLIT_DOMAINS?.split(',')[0] || req.get('host') || 'itenmania.com';
  const siteUrlB = `https://${publicHostB}`;

  if (!product) {
    res.send(serveOgFallback(buyApplicationHtml, siteUrlB, "buy", rawIdB));
    return;
  }

  await recordProductView(product, req.method);
  res.send(serveBuyApplication(buyApplicationHtml, user, product, siteUrlB));
});


// 삽니다 목록 페이지 (/buy/list.html?search_game=...)
router.get("/buy/list.html", async (req, res): Promise<void> => {
  const game = String(req.query["search_game"] ?? "");
  const mobile = (/Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1")
    && req.query.pc !== "1";
  if (mobile && game) {
    const selected = /^\d{1,8}$/.test(game) ? await findGameByCode(game) : null;
    if (!selected) {
      res.status(404).send("해당 게임을 찾을 수 없습니다.");
      return;
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.type("html").send(renderMobileProductList({
      game: { code: game, name: selected.name, servers: selected.servers.map(server => server.name) },
      side: "buy",
      items: [],
      fontFaceStyles: mobileLoginFontStyles,
      initialCategory: typeof req.query.itemCategory === "string" ? req.query.itemCategory : undefined,
    }));
    return;
  }

  // search_game 없으면 마이룸 구매등록물품으로 리다이렉트
  if (!game) {
    res.redirect(302, "/myroom/buy/buy_regist.html");
    return;
  }

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  // 게임별 sell 스냅샷 재사용: 게임 이미지·서버 목록·UI가 올바른 게임으로 표시됨
  // BUY_INTERCEPT_SCRIPT가 스냅샷의 sell 원본 상품을 제거하고
  // SELL_LIST_INTERCEPT_SCRIPT가 category=buy 상품을 우리 DB에서 로드함
  let html: string;
  if (game === "5913") {
    html = sellLineageClassicHtml;
  } else if (game === "5233") {
    html = sellMaplestoryWorldHtml;
  } else if (SELL_HTML_MAP[game]) {
    html = SELL_HTML_MAP[game];
  } else {
    // 알 수 없는 게임 코드: 리니지클래식 스냅샷 폴백
    html = sellLineageClassicHtml;
  }

  if (!html) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  // 리니지클래식 스냅샷 기반 게임 → 서버 사이드 게임명 치환
  if (LINEAGE_CLASSIC_BASED_GAMES[game]) {
    html = html.replace(/리니지클래식/g, LINEAGE_CLASSIC_BASED_GAMES[game]);
  }
  // 서버 탭 서버사이드 교체
  const buyServers = await getGameServersForCode(game).catch(() => []);
  if (buyServers.length) html = injectServerTabsHtml(html, buyServers);

  res.send(serveBuy(html, user));
});

// 구매등록 리다이렉트 (/buy/ 단독 → 구매등록 페이지)
router.get("/buy/", async (req, res): Promise<void> => {
  res.redirect(302, `/buy/register.html`);
});

// 개별 채팅방 페이지
router.get("/myroom/chat/new_chat.html", async (req, res): Promise<void> => {
  const rawOrderId = String(req.query.orderId ?? "");
  if (!req.query.roomId && /^[1-9]\d*$/.test(rawOrderId) && Number.isSafeInteger(Number(rawOrderId))) {
    const user = await getSessionUser(req);
    if (!user) {
      res.redirect(302, `/login?returnUrl=${encodeURIComponent(req.originalUrl)}`);
      return;
    }
    const [room] = await db.select().from(chatRoomsTable).where(and(
      eq(chatRoomsTable.orderId, Number(rawOrderId)),
      or(eq(chatRoomsTable.buyerId, user.id as number), eq(chatRoomsTable.sellerId, user.id as number)),
    )).limit(1);
    res.redirect(302, room
      ? `/myroom/chat/new_chat.html?roomId=${room.id}${req.query.mobile === "1" ? "&mobile=1" : ""}`
      : "/myroom/chat/list.html");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  if (!chatNewHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  const user = await getSessionUser(req);
  if (!user) {
    const roomId = String(req.query.roomId ?? "");
    const returnPath = /^\d+$/.test(roomId)
      ? `/myroom/chat/new_chat.html?roomId=${roomId}`
      : "/myroom/chat/list.html";
    res.redirect(302, `/login?returnUrl=${encodeURIComponent(returnPath)}`);
    return;
  }

  res.send(serveChatNew(chatNewHtml, user));
});

// 채팅방 직접 접근 리다이렉트
router.get("/myroom/chat/new_chat.html", async (req, res): Promise<void> => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/myroom/chat/new_chat.html${qs}`);
});

// 매니아 채팅 페이지
router.get(["/myroom/chat/list.html", "/myroom/chat/"], async (req, res): Promise<void> => {
  const mobile = /Android|iPhone|iPod|Mobile/i.test(req.get("user-agent") ?? "") || req.query.mobile === "1";
  if (mobile) {
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.send(renderMobileChat(req.session.userId ?? null));
    return;
  }
  const order = req.query["order"];
  const html = order === "1" ? chatOrderedHtml : chatHtml;
  if (!html) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveChat(html, user));
});

// 게임매니아 페이지
router.get("/gamemania", async (req, res): Promise<void> => {
  if (!gamemanaHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);

  res.send(serveGamemania(gamemanaHtml, user));
});

// ── receipt_layer 원본 HTML 캡처 저장 엔드포인트 ─────────────────────
router.post("/im-capture-receipt", async (req, res): Promise<void> => {
  let body = "";
  req.setEncoding("utf-8");
  req.on("data", (chunk: string) => { body += chunk; });
  req.on("end", () => {
    const html = body.trim();
    if (!html || html.length < 50) {
      res.status(400).send("too short");
      return;
    }
    try {
      writeFileSync(CAPTURED_RECEIPT_PATH, html, "utf-8");
      capturedReceiptHtml = html;
      logger.info({ bytes: html.length }, "receipt_layer 원본 캡처 저장 완료");
      res.json({ ok: true, bytes: html.length });
    } catch (e) {
      logger.error({ err: e }, "receipt_layer 캡처 저장 실패");
      res.status(500).send("save failed");
    }
  });
});

// ── 팝업 미리보기 테스트 페이지 (원본 HTML 사용) ────────────────────
router.get("/test-popups", (_req, res): void => {
  if (!sellRegisterHtml) {
    res.status(503).send("sell-register.html not loaded");
    return;
  }

  // sell-register.html에서 CSS 추출 (style block 0 = 5MB base64 폰트 제외, 1번 이후만)
  const styleMatches = [...sellRegisterHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
  const originalCss = styleMatches.slice(1).map(m => m[1]).join("\n");

  // dvPremium 원본 HTML 추출 (dvPopup 직전까지)
  const dvPremiumMatch = sellRegisterHtml.match(/<div id=dvPremium[\s\S]*?(?=\n? *<div id=dvPopup)/);
  const dvPremiumHtml = dvPremiumMatch ? dvPremiumMatch[0].trimEnd() : "";

  // dvPopup 원본 HTML 추출 (dvSignboard 직전까지)
  const dvPopupMatch = sellRegisterHtml.match(/<div id=dvPopup[\s\S]*?(?=\n? *<div id=dvSignboard)/);
  const dvPopupHtml = dvPopupMatch ? dvPopupMatch[0].trimEnd() : "";

  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang=ko>
<head>
<meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1.0">
<title>팝업 미리보기 (원본)</title>
<!-- sell-register.html 원본 CSS (폰트 블록 제외) -->
<style>${originalCss}</style>
<style>
/* ─── 테스트 페이지 전용 ─── */
body{background:#d0d0d0;padding:30px;font-family:sans-serif}
h2{margin-bottom:6px;font-size:20px}
p.note{margin:0 0 20px;font-size:13px;color:#555}
.btn{margin:6px;padding:10px 22px;font-size:15px;cursor:pointer;
  background:#159EFD;color:#fff;border:none;border-radius:8px;font-weight:700}
/* im-show 토글: g_layer에 flex 강제 적용 */
.g_layer.im-show{display:flex!important}
/* receipt_layer 커스텀 내부 스타일 */
.receipt-notice{background:#EBF5FF;border:1px solid #B0D4F1;border-radius:6px;
  padding:14px 16px;margin-bottom:18px;font-size:14px;font-weight:600;color:#1a6fb0}
.receipt-row{border:1px solid #ddd;border-radius:6px;padding:16px 20px;
  display:flex;align-items:center;gap:24px;margin-bottom:16px}
.receipt-row span{font-size:14px;font-weight:600}
.receipt-row label{display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px}
.receipt-hint{font-size:13px;color:#666;margin:0 0 4px;line-height:1.6}
/* g_hidden/sf-hidden 숨김 클래스 해제 (테스트용) */
.g_hidden,.sf-hidden{display:none!important}
input[type=checkbox].g_hidden,input[type=checkbox].sf-hidden{display:none!important}
</style>
</head>
<body>
<h2>팝업 미리보기 테스트 <small style="font-size:13px;color:#555">(sell-register.html 원본 HTML 사용)</small></h2>
<p class=note>버튼을 클릭하면 해당 팝업이 표시됩니다. 폰트는 폴백 적용(5MB 폰트 블록 로딩 생략).</p>
<p class=note style="color:${capturedReceiptHtml ? '#2a7a2a' : '#b84000'}">
  ② 현금영수증 팝업: ${capturedReceiptHtml
    ? `✓ 원본 캡처됨 (${capturedReceiptHtml.length.toLocaleString()}자) — 원본 HTML 사용 중`
    : '⚠️ 미캡처 — 판매 등록 플로우 1회 실행 시 자동 저장됩니다'
  }
</p>
<button class=btn onclick="showPopup('dvPremium')">① 프리미엄 등록안내</button>
<button class=btn onclick="showPopup('receipt_layer')">② 현금 영수증</button>
<button class=btn onclick="showPopup('dvPopup')">③ 물품등록정보</button>

<!-- ① dvPremium: 원본 HTML ──────────────────────────────────────── -->
${dvPremiumHtml}

<!-- ② receipt_layer: 캡처된 원본 HTML 우선, 없으면 임시 안내 -->
<div id=receipt_layer class="g_layer receipt_layer" style=display:none>
${capturedReceiptHtml
  ? capturedReceiptHtml
  : ` <div class=inner>
  <div class=title>현금 영수증</div>
  <div class=cont>
   <p style="color:#888;font-size:14px;text-align:center;padding:30px 0">
    ⚠️ 원본 HTML 미캡처 상태<br>
    판매 등록 플로우를 한 번 거치면 자동 저장됩니다.
   </p>
  </div>
 </div>`
}
</div>

<!-- ③ dvPopup: 원본 HTML ───────────────────────────────────────── -->
${dvPopupHtml}

<script>
function showPopup(id){
  ['dvPremium','receipt_layer','dvPopup'].forEach(function(x){
    document.getElementById(x).classList.remove('im-show');
  });
  document.getElementById(id).classList.add('im-show');
}
function hidePopup(id){ document.getElementById(id).classList.remove('im-show'); }

// 확인/취소 버튼 연결 (원본 HTML의 onclick이 없으므로 JS로 연결)
window.addEventListener('DOMContentLoaded', function(){
  // dvPremium 확인 → receipt_layer
  var premiumBtn = document.getElementById('premium_btn');
  if(premiumBtn) premiumBtn.addEventListener('click', function(){
    hidePopup('dvPremium'); showPopup('receipt_layer');
  });
  // dvPopup 확인/취소 → 닫기
  var regSubmit = document.getElementById('reg_submit');
  if(regSubmit) regSubmit.addEventListener('click', function(){ hidePopup('dvPopup'); });
  var cancelSubmit = document.getElementById('cancel_submit');
  if(cancelSubmit) cancelSubmit.addEventListener('click', function(){ hidePopup('dvPopup'); });

  // 페이지 로드 시 첫 번째 팝업 자동 표시
  showPopup('dvPremium');
});
</script>
</body>
</html>`);
});

// ─── 마이룸 판매관련 4개 페이지 ────────────────────────────────────────

// 판매등록물품
router.get("/myroom/sell/sell_regist.html", async (req, res): Promise<void> => {
  if (!sellMyroomRegistHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  if (!user) { res.redirect(302, "/login"); return; }

  const prods = await db
    .select()
    .from(productsTable)
    .where(and(
      eq(productsTable.sellerId, user.id as number),
      eq(productsTable.category, "sell"),
      eq(productsTable.status, "active"),
    ))
    .orderBy(desc(productsTable.createdAt));

  res.send(serveSellMyregist(sellMyroomRegistHtml, user, prods.map((p) => ({
    id: p.id,
    title: p.title,
    price: Number(p.price),
    gameName: p.gameName,
    serverName: p.serverName,
    itemCategory: p.itemCategory,
    category: p.category,
    createdAt: p.createdAt,
  }))));
});

// 흥정신청된 물품 (우리 시스템엔 흥정 없음 → 항상 빈 목록)
router.get("/myroom/sell/sell_check.html", async (req, res): Promise<void> => {
  if (!sellMyroomCheckHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  if (!user) { res.redirect(302, "/login"); return; }
  res.send(serveSellMycheck(sellMyroomCheckHtml, user));
});

// 입금대기 물품 (orders WHERE sellerId=userId AND status='pending')
router.get("/myroom/sell/sell_pay_wait.html", async (req, res): Promise<void> => {
  if (!sellMyroomPayWaitHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  if (!user) { res.redirect(302, "/login"); return; }

  const rows = await db
    .select({ o: ordersTable, p: productsTable })
    .from(ordersTable)
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(and(eq(ordersTable.sellerId, user.id as number), eq(ordersTable.status, "pending")))
    .orderBy(desc(ordersTable.createdAt));

  res.send(serveSellMypaywait(sellMyroomPayWaitHtml, user, rows.map((r) => ({
    id: r.o.id,
    productId: r.o.productId,
    productTitle: r.o.productTitle,
    amount: Number(r.o.amount),
    createdAt: r.o.createdAt,
    gameName: r.p?.gameName ?? null,
    serverName: r.p?.serverName ?? null,
    itemCategory: r.p?.itemCategory ?? null,
    category: r.p?.category ?? null,
  }))));
});

// 판매중인 물품 (orders WHERE sellerId=userId AND status IN ['shipped','confirmed'])
router.get("/myroom/sell/sell_ing.html", async (req, res): Promise<void> => {
  if (!sellMyroomIngHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  if (!user) { res.redirect(302, `/login?returnUrl=${encodeURIComponent(req.originalUrl)}`); return; }
  if (await serveMyroomTradeDetail(req, res, user, "sell", sellMyroomIngHtml)) return;

  res.send(serveSellMying(sellMyroomIngHtml, user, await ongoingTrades(user.id as number, "sell")));
});

// ─── 마이룸 구매관련 4개 페이지 ────────────────────────────────────────

// 구매등록물품 (내가 올린 구매 글 — products WHERE sellerId=userId AND category='buy')
router.get("/myroom/buy/buy_regist.html", async (req, res): Promise<void> => {
  if (!buyMyroomRegistHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  if (!user) { res.redirect(302, "/login"); return; }

  const prods = await db
    .select()
    .from(productsTable)
    .where(and(
      eq(productsTable.sellerId, user.id as number),
      eq(productsTable.category, "buy"),
      eq(productsTable.status, "active"),
    ))
    .orderBy(desc(productsTable.createdAt));

  res.send(serveBuyMyregist(buyMyroomRegistHtml, user, prods.map((p) => ({
    id: p.id,
    title: p.title,
    price: Number(p.price),
    createdAt: p.createdAt,
    gameName: p.gameName,
    serverName: p.serverName,
    itemCategory: p.itemCategory,
    category: p.category,
  }))));
});

// 흥정신청된 물품 (우리 시스템엔 흥정 없음 → 항상 빈 목록)
router.get("/myroom/buy/buy_check.html", async (req, res): Promise<void> => {
  if (!buyMyroomCheckHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  if (!user) { res.redirect(302, "/login"); return; }
  res.send(serveBuyMycheck(buyMyroomCheckHtml, user));
});

// 입금해야할 물품 (orders WHERE buyerId=userId AND status='pending')
router.get("/myroom/buy/buy_pay_wait.html", async (req, res): Promise<void> => {
  if (!buyMyroomPayWaitHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  if (!user) { res.redirect(302, "/login"); return; }

  const rows = await db
    .select({ o: ordersTable, p: productsTable })
    .from(ordersTable)
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(and(eq(ordersTable.buyerId, user.id as number), eq(ordersTable.status, "pending")))
    .orderBy(desc(ordersTable.createdAt));

  res.send(serveBuyMypaywait(buyMyroomPayWaitHtml, user, rows.map((r) => ({
    id: r.o.id,
    productId: r.o.productId,
    productTitle: r.o.productTitle,
    amount: Number(r.o.amount),
    createdAt: r.o.createdAt,
    gameName: r.p?.gameName ?? null,
    serverName: r.p?.serverName ?? null,
    itemCategory: r.p?.itemCategory ?? null,
    category: r.p?.category ?? null,
  }))));
});

// 구매중인 물품 (orders WHERE buyerId=userId AND status IN ['shipped','confirmed'])
router.get("/myroom/buy/buy_ing.html", async (req, res): Promise<void> => {
  if (!buyMyroomIngHtml) {
    res.status(503).send("<html><body><h2>페이지를 불러올 수 없습니다</h2></body></html>");
    return;
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  const user = await getSessionUser(req);
  if (!user) { res.redirect(302, `/login?returnUrl=${encodeURIComponent(req.originalUrl)}`); return; }
  if (await serveMyroomTradeDetail(req, res, user, "buy", buyMyroomIngHtml)) return;

  res.send(serveBuyMying(buyMyroomIngHtml, user, await ongoingTrades(user.id as number, "buy")));
});

// /proxy 및 나머지 하위 경로 → itemmania.html 서빙
// /proxy/* 구버전 경로 → 새 경로로 301 리다이렉트 (하위호환)
router.get(["/proxy", "/proxy/{*splat}"], async (req, res): Promise<void> => {
  const params = req.params as { splat?: string };
  const splat = params.splat || "";
  res.redirect(301, splat ? "/" + splat : "/");
});

export default router;
