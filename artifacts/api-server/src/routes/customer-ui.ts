import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CUSTOMER_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>고객감동센터 - 아이템매니아</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f8f9fb;color:#2e2e2e;min-width:1100px}
a{color:inherit;text-decoration:none}
a:hover{color:#159EFD}
:root{--blue:#159EFD;--gray1:#FBFBFB;--gray2:#F0F0F0;--gray3:#DDD;--gray6:#9F9F9F;--gray11:#2E2E2E;--bluegray2:#E4EBF2;--bluegray10:#EDF3FA}

/* ── 헤더 ── */
.g_header{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08);position:sticky;top:0;z-index:100}
.header-inner{max-width:1200px;margin:0 auto;padding:0 20px;display:flex;align-items:center;gap:16px;height:60px}
.header-logo img{height:36px;display:block}
.header-nav{display:flex;gap:4px;margin-left:16px}
.header-nav a{padding:6px 14px;font-size:14px;font-weight:500;border-radius:6px;color:#444;transition:background .15s}
.header-nav a:hover{background:#f0f7ff;color:var(--blue)}
.header-spacer{flex:1}
.header-btn{padding:7px 16px;border:1.5px solid var(--blue);border-radius:6px;font-size:13px;font-weight:600;color:var(--blue);background:#fff;cursor:pointer;transition:all .15s}
.header-btn:hover{background:var(--blue);color:#fff}
.header-btn.filled{background:var(--blue);color:#fff;margin-left:6px}
.header-btn.filled:hover{background:#0e8de0}

/* ── 레이아웃 ── */
.g_container{max-width:1200px;margin:0 auto;padding:28px 20px;display:flex;gap:24px}
.aside{width:200px;flex-shrink:0}
.g_content{flex:1;min-width:0}

/* ── 사이드바 ── */
.aside_box{background:#fff;border-radius:10px;border:1px solid var(--bluegray2);overflow:hidden;margin-bottom:16px}
.nav_subject a{display:block;padding:16px 20px;font-size:17px;font-weight:700;color:var(--gray11);background:var(--bluegray10)}
.nav .nav_title a{display:block;padding:10px 20px;font-size:14px;font-weight:600;color:var(--gray11);border-top:1px solid #f0f0f0;transition:color .15s}
.nav .nav_title a:hover,.nav .nav_title a.active{color:var(--blue)}
.nav_sub{list-style:none;border-top:1px solid #f0f0f0}
.nav_sub li a{display:block;padding:8px 20px 8px 32px;font-size:13px;color:#555;border-bottom:1px solid #f8f8f8;transition:color .15s}
.nav_sub li a:hover{color:var(--blue)}

.customer_banner_wrap{background:#fff;border:1px solid var(--bluegray2);border-radius:10px;padding:16px 20px;font-size:14px;color:var(--gray11)}
.tel_num{display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--blue);font-size:22px;font-weight:700}
.banner_desc{margin-top:8px;font-size:12px;color:var(--gray6);line-height:1.6}

/* ── 검색 배너 ── */
.search{padding:24px 60px;background:linear-gradient(to right,#2B9EFD,#A8A0FF);border-radius:10px;margin-bottom:24px}
.search_img_wrap{text-align:center;font-size:20px;font-weight:700;color:#fff;margin-bottom:14px}
.search_bar_wrap{position:relative;max-width:600px;margin:0 auto}
.search_bar{display:flex;background:#fff;border-radius:30px;overflow:hidden;align-items:center;padding:4px 4px 4px 20px}
.search_bar input{flex:1;border:none;outline:none;font-size:15px;background:none;padding:10px 0}
.search_bar button{padding:10px 20px;background:var(--blue);color:#fff;border:none;border-radius:26px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}
.search_bar button:hover{background:#0e8de0}
.search_list{display:flex;gap:6px;justify-content:center;margin-top:10px;flex-wrap:wrap}
.search_list li{list-style:none;font-size:13px;color:rgba(255,255,255,.85)}
.search_list li a{color:rgba(255,255,255,.9)}
.search_list li a:hover{color:#fff;text-decoration:underline}
.search_list li.label{color:rgba(255,255,255,.6)}

/* ── 빠른 메뉴 ── */
.submain_customer_info{display:flex;gap:16px;list-style:none;margin-bottom:24px;justify-content:center;flex-wrap:wrap}
.submain_customer_info li a{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 20px;background:#fff;border:1px solid var(--bluegray2);border-radius:10px;min-width:110px;font-size:13px;font-weight:600;color:var(--gray11);transition:all .15s}
.submain_customer_info li a:hover{border-color:var(--blue);color:var(--blue);box-shadow:0 2px 8px rgba(21,158,253,.12)}
.submain_customer_info .icon{width:52px;height:52px;background:var(--bluegray10);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px}

/* ── FAQ 카테고리 ── */
.g_subtitle{font-size:17px;font-weight:700;color:var(--gray11);margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--blue)}
.faq_category_wrapper{display:grid;gap:12px;grid-template-columns:repeat(4,1fr);margin-bottom:28px}
.faq_category{border:1px solid var(--bluegray2);border-radius:10px;overflow:hidden;background:#fff}
.faq_category .big_category{min-height:48px;padding:12px 20px;background:var(--bluegray10);font-size:15px;font-weight:700;color:var(--gray11);display:flex;align-items:center}
.faq_category li{list-style:none;padding:0 20px 8px;font-size:14px}
.faq_category li:last-child{padding-bottom:12px}
.faq_category li a{color:#555;transition:color .15s}
.faq_category li a:hover{color:var(--blue)}

/* ── FAQ Q&A ── */
.faq_section_title{font-size:17px;font-weight:700;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--blue)}
.cus_content{margin-top:0}
.faq_list{margin-bottom:8px}
.faq_list .sub_title{border-radius:10px;border:1px solid var(--bluegray2);cursor:pointer;display:flex;align-items:center;background:#fff;transition:border-color .15s}
.faq_list .sub_title:hover{border-color:var(--blue)}
.faq_list .sub_title.open{border-radius:10px 10px 0 0;border-color:var(--blue);border-bottom-color:transparent}
.faq_list .sub_title .ico{width:60px;text-align:center;font-size:22px;color:var(--blue);font-weight:700;padding:14px 0;flex-shrink:0}
.faq_list .sub_title .type{min-width:140px;max-width:140px;color:var(--blue);font-size:14px;font-weight:700;padding:14px 0}
.faq_list .sub_title .qtxt{flex:1;font-size:14px;color:var(--gray11);padding:14px 20px 14px 0;line-height:1.5}
.faq_list .sub_title .arrow{padding:14px 16px;font-size:12px;color:#aaa;transition:transform .2s;flex-shrink:0}
.faq_list .sub_title.open .arrow{transform:rotate(180deg)}
.faq_list .gray_box{display:none;padding:20px 24px;background:var(--gray1);border:1px solid var(--blue);border-top:none;border-radius:0 0 10px 10px;font-size:14px;line-height:1.8;color:#444}
.faq_list .gray_box.open{display:block}
.faq_list .gray_box .atxt{padding-left:60px}

/* ── 푸터 ── */
.g_footer{background:#fff;border-top:1px solid #eee;margin-top:40px;padding:28px 0}
.footer-inner{max-width:1200px;margin:0 auto;padding:0 20px}
.footer-links{display:flex;gap:20px;margin-bottom:14px;flex-wrap:wrap}
.footer-links a{font-size:13px;color:#555}
.footer-links a:hover{color:var(--blue)}
.footer-info{font-size:12px;color:#888;line-height:1.8}
.footer-copyright{margin-top:8px;font-size:12px;color:#aaa}

/* ── 공지 배너 ── */
.notice_banner{background:#fff8e6;border:1px solid #ffd166;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#7c5c00;display:flex;align-items:center;gap:8px}

@media(max-width:1100px){body{min-width:unset}}
</style>
</head>
<body>

<!-- 헤더 -->
<header class="g_header">
  <div class="header-inner">
    <div class="header-logo">
      <a href="/"><span style="font-size:22px;font-weight:900;color:#159EFD;letter-spacing:-.03em">아이템<span style="color:#222">매니아</span></span></a>
    </div>
    <nav class="header-nav">
      <a href="/">홈</a>
      <a href="/sell/list.html">팝니다</a>
      <a href="/buy/list.html">삽니다</a>
      <a href="/myroom">마이룸</a>
    </nav>
    <div class="header-spacer"></div>
    <button class="header-btn" onclick="location.href='/login'">로그인</button>
    <button class="header-btn filled" onclick="location.href='/join'">회원가입</button>
  </div>
</header>

<!-- 본문 -->
<div class="g_container">

  <!-- 사이드바 -->
  <aside class="aside">
    <div class="aside_box">
      <div class="nav_subject"><a href="/customer/" class="customer">고객감동센터</a></div>
      <div class="nav">
        <div class="nav_title"><a href="/customer/faq/" class="active">FAQ</a></div>
        <div class="nav_title"><a href="/customer/report/">1:1 상담하기</a></div>
        <ul class="nav_sub">
          <li><a href="/customer/report/">거래취소 / 종료</a></li>
          <li><a href="/customer/report/">이용관련</a></li>
          <li><a href="/customer/report/">거래사고</a></li>
        </ul>
        <div class="nav_title"><a href="/customer/myqna/">나의 질문과 답변</a></div>
        <div class="nav_title"><a href="/customer/safety/">안전거래</a></div>
        <div class="nav_title"><a href="/customer/compensate/">보상제도</a></div>
        <div class="nav_title"><a href="/customer/compensate/">200% 사고보상</a></div>
        <div class="nav_title"><a href="/notice/">공지사항</a></div>
      </div>
    </div>

    <div class="customer_banner_wrap">
      <div>아이템매니아 고객센터</div>
      <div class="tel_num">📞 1588-9527</div>
      <div class="banner_desc">
        평일 09:00 ~ 18:00<br>
        점심시간 12:00 ~ 13:00<br>
        토·일·공휴일 휴무
      </div>
    </div>
  </aside>

  <!-- 콘텐츠 -->
  <div class="g_content">

    <!-- 검색 배너 -->
    <div class="search">
      <div class="search_img_wrap">아이템매니아 고객센터. 무엇이든 물어보세요.</div>
      <div class="search_bar_wrap">
        <div class="search_bar">
          <input type="text" placeholder="검색어를 입력해 주세요." id="faqSearch" onkeydown="if(event.key==='Enter')doFaqSearch()">
          <button onclick="doFaqSearch()">검색</button>
        </div>
        <ul class="search_list">
          <li class="label">추천검색어 |</li>
          <li><a href="#" onclick="setSearch('충전')">충전</a></li>
          <li><a href="#" onclick="setSearch('출금')">출금</a></li>
          <li><a href="#" onclick="setSearch('전용계좌')">전용계좌</a></li>
          <li><a href="#" onclick="setSearch('수수료')">수수료</a></li>
          <li><a href="#" onclick="setSearch('신용등급')">신용등급</a></li>
          <li><a href="#" onclick="setSearch('거래방법')">거래방법</a></li>
        </ul>
      </div>
    </div>

    <!-- 빠른 메뉴 -->
    <ul class="submain_customer_info">
      <li><a href="/customer/report/">
        <div class="icon">🚫</div>
        <p class="name">거래취소/종료</p>
      </a></li>
      <li><a href="/customer/report/">
        <div class="icon">💬</div>
        <p class="name">이용관련</p>
      </a></li>
      <li><a href="/customer/report/">
        <div class="icon">⚠️</div>
        <p class="name">거래사고</p>
      </a></li>
      <li><a href="/customer/faq/">
        <div class="icon">❓</div>
        <p class="name">FAQ</p>
      </a></li>
      <li><a href="/customer/myqna/">
        <div class="icon">📝</div>
        <p class="name">나의 질문과 답변</p>
      </a></li>
    </ul>

    <!-- FAQ 카테고리 -->
    <div class="g_subtitle">FAQ 선택</div>
    <div class="faq_category_wrapper">
      <ul class="faq_category">
        <li class="big_category">마일리지</li>
        <li><a href="#" onclick="filterFaq('내마일리지')">내마일리지</a></li>
        <li><a href="#" onclick="filterFaq('입금')">입금</a></li>
        <li><a href="#" onclick="filterFaq('충전')">충전</a></li>
        <li><a href="#" onclick="filterFaq('결제')">결제</a></li>
        <li><a href="#" onclick="filterFaq('출금')">출금</a></li>
      </ul>
      <ul class="faq_category">
        <li class="big_category">거래방법</li>
        <li><a href="#" onclick="filterFaq('일반거래')">일반거래</a></li>
        <li><a href="#" onclick="filterFaq('분할거래')">분할거래</a></li>
        <li><a href="#" onclick="filterFaq('흥정거래')">흥정거래</a></li>
        <li><a href="#" onclick="filterFaq('알아두기')">알아두기</a></li>
        <li><a href="#" onclick="filterFaq('수수료')">수수료</a></li>
        <li><a href="#" onclick="filterFaq('거래취소')">거래취소/종료</a></li>
      </ul>
      <ul class="faq_category">
        <li class="big_category">거래문제발생</li>
        <li><a href="#" onclick="filterFaq('판매문제')">판매문제발생</a></li>
        <li><a href="#" onclick="filterFaq('구매문제')">구매문제발생</a></li>
        <li><a href="#" onclick="filterFaq('안전거래')">안전거래</a></li>
        <li><a href="#" onclick="filterFaq('보상제도')">보상제도</a></li>
      </ul>
      <ul class="faq_category">
        <li class="big_category">포탈서비스</li>
        <li><a href="#" onclick="filterFaq('상품권')">상품권몰</a></li>
        <li><a href="#" onclick="filterFaq('게임매니아')">게임매니아</a></li>
        <li><a href="#" onclick="filterFaq('게임충전')">게임충전</a></li>
      </ul>
      <ul class="faq_category">
        <li class="big_category">회원정보</li>
        <li><a href="#" onclick="filterFaq('회원가입')">회원가입</a></li>
        <li><a href="#" onclick="filterFaq('이용제한')">서비스이용제한</a></li>
        <li><a href="#" onclick="filterFaq('개인정보')">개인정보관리</a></li>
        <li><a href="#" onclick="filterFaq('탈퇴')">탈퇴</a></li>
      </ul>
      <ul class="faq_category">
        <li class="big_category">신용등급/보안</li>
        <li><a href="#" onclick="filterFaq('신용등급')">신용등급/인증</a></li>
        <li><a href="#" onclick="filterFaq('보안')">보안센터</a></li>
        <li><a href="#" onclick="filterFaq('마일리지결제')">마일리지결제인증</a></li>
      </ul>
      <ul class="faq_category">
        <li class="big_category">기타</li>
        <li><a href="#" onclick="filterFaq('앱')">앱/모바일</a></li>
        <li><a href="#" onclick="filterFaq('이벤트')">이벤트</a></li>
        <li><a href="#" onclick="filterFaq('기타')">기타문의</a></li>
      </ul>
    </div>

    <!-- FAQ Q&A 목록 -->
    <div class="faq_section_title">자주 묻는 질문 (FAQ)</div>
    <div class="cus_content" id="faqList">

      <div class="faq_list" data-tags="입금 마일리지 전용계좌">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[입금]</span>
          <span class="qtxt">[내전용계좌]로 입금을 했으나 마일리지 적립이 안 되어 있습니다. 왜 그런가요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            전용계좌로 입금 시 은행 처리 시간에 따라 최대 30분~1시간 정도 소요될 수 있습니다.<br>
            1시간 이상 지났는데도 적립이 안 된다면 입금 영수증을 첨부하여 1:1 상담을 이용해 주세요.<br><br>
            ※ 전용계좌는 본인 명의 계좌에서 입금하셔야 정상 처리됩니다.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="구매문제 해킹 거래사고">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[구매문제발생]</span>
          <span class="qtxt">판매자가 해킹머니(아이템)을 판매했어요. 어떻게 해야 하나요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            해킹 아이템/머니 구매로 피해를 입으셨다면 즉시 거래를 중단하고 1:1 상담을 통해 신고해 주세요.<br>
            아이템매니아는 200% 사고보상 제도를 운영하고 있으며, 확인된 피해에 대해 보상해 드립니다.<br><br>
            ※ 증빙 자료(채팅내용, 거래내역)를 꼭 보관해 두세요.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="출금 타인명의 계좌">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[출금]</span>
          <span class="qtxt">타인 명의로 출금을 하려 합니다. 어떻게 해야 하나요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            보안 정책상 본인 명의 계좌로만 출금이 가능합니다.<br>
            타인 명의 계좌로의 출금은 허용되지 않으며, 이 경우 출금 신청이 자동 반려됩니다.<br><br>
            본인 명의 계좌를 마이룸 → 마일리지 → 출금계좌 관리에서 등록 후 이용해 주세요.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="내마일리지 출금 ARS 충전 휴대폰">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[내마일리지]</span>
          <span class="qtxt">휴대폰 ARS 충전한 마일리지 출금하고 싶어요.</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            휴대폰 ARS로 충전하신 마일리지는 통신사 약관에 따라 출금이 제한될 수 있습니다.<br>
            단, 해당 금액을 사용하여 아이템 구매 거래를 완료하신 경우 판매자로 지급된 마일리지는 출금 가능합니다.<br><br>
            자세한 내용은 1:1 상담을 이용해 주세요.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="입금 해외 해외입금">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[입금]</span>
          <span class="qtxt">해외에서 입금 하는 방법을 알려주세요.</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            해외 거주 중이신 경우 국내 은행 앱(인터넷뱅킹)을 통해 전용계좌로 이체하시면 됩니다.<br>
            해외 은행에서의 국제 송금은 처리 시간이 길고 수수료가 발생할 수 있습니다.<br><br>
            ※ 해외에서 국내 계좌로 송금 시 은행별 안내를 먼저 확인하세요.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="수수료 거래방법 판매 구매">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[수수료]</span>
          <span class="qtxt">거래 수수료는 얼마인가요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            아이템매니아의 기본 거래 수수료는 <strong>판매금액의 5%</strong>입니다.<br>
            신용등급(BRONZE, SILVER, GOLD, PLATINUM, VIP)에 따라 수수료 할인 혜택이 적용됩니다.<br><br>
            · BRONZE: 5% / SILVER: 4.5% / GOLD: 4% / PLATINUM: 3.5% / VIP: 3%
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="회원가입 가입 아이디">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[회원가입]</span>
          <span class="qtxt">회원가입은 어떻게 하나요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            우측 상단 또는 <a href="/join" style="color:#159EFD;font-weight:600">회원가입 페이지</a>에서 이메일과 닉네임을 입력하여 가입하실 수 있습니다.<br>
            가입 후 이메일 인증을 완료하시면 모든 서비스를 이용하실 수 있습니다.<br><br>
            ※ 하나의 이메일로 하나의 계정만 생성 가능합니다.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="신용등급 등급 인증 점수">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[신용등급/인증]</span>
          <span class="qtxt">신용등급은 어떻게 올릴 수 있나요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            신용등급은 거래 완료 수, 긍정적 평가, 인증 완료 항목에 따라 자동으로 산정됩니다.<br><br>
            · BRONZE: 5점 미만 · SILVER: 5~50점 · GOLD: 51~100점<br>
            · PLATINUM: 101~300점 · VIP: 301점 이상<br><br>
            휴대폰, 이메일, 아이핀 인증을 완료하시면 추가 점수가 부여됩니다.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="안전거래 거래방법 보호">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[안전거래]</span>
          <span class="qtxt">안전거래란 무엇인가요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            안전거래는 아이템매니아가 구매자와 판매자 사이에서 거래 대금을 보관하는 에스크로 방식입니다.<br>
            구매자가 결제 후 판매자가 아이템을 인계하고, 구매자가 수령을 확인하면 판매자에게 대금이 지급됩니다.<br><br>
            이 과정에서 거래 사고가 발생하면 아이템매니아가 중재하여 보상합니다.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="거래취소 취소 종료">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[거래취소/종료]</span>
          <span class="qtxt">거래를 취소하고 싶습니다. 어떻게 해야 하나요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            채팅창에서 상대방과 합의 후 거래를 종료할 수 있습니다.<br>
            거래 취소 시 결제된 마일리지는 즉시 환불됩니다.<br><br>
            ※ 상대방이 응하지 않는 경우 1:1 상담을 통해 도움을 요청하세요.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="보상제도 200% 사고보상 보상">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[보상제도]</span>
          <span class="qtxt">200% 사고보상 제도는 어떻게 작동하나요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            아이템매니아는 안전거래 이용 중 발생한 사기 사고에 대해 피해금액의 200%를 보상합니다.<br>
            단, 아래 조건을 모두 충족해야 합니다:<br><br>
            1. 아이템매니아 안전거래(에스크로) 이용<br>
            2. 거래 완료 후 72시간 이내 신고<br>
            3. 증빙자료(채팅, 거래내역) 제출<br><br>
            자세한 내용은 1:1 상담을 통해 문의해 주세요.
          </div>
        </div>
      </div>

      <div class="faq_list" data-tags="탈퇴 회원탈퇴">
        <div class="sub_title" onclick="toggleFaq(this)">
          <span class="ico">Q</span>
          <span class="type">[탈퇴]</span>
          <span class="qtxt">회원 탈퇴는 어떻게 하나요?</span>
          <span class="arrow">▼</span>
        </div>
        <div class="gray_box">
          <div class="atxt">
            마이룸 → 회원정보 → 회원탈퇴 메뉴에서 탈퇴 신청이 가능합니다.<br>
            단, 아래 조건이 충족되어야 합니다:<br><br>
            · 잔여 마일리지 0원 (출금 완료 후 탈퇴)<br>
            · 진행 중인 거래 없음<br>
            · 미해결 분쟁 없음
          </div>
        </div>
      </div>

    </div><!-- /faqList -->

    <div id="noResult" style="display:none;text-align:center;padding:40px;color:#999;font-size:15px">
      검색 결과가 없습니다. 다른 검색어를 입력해 보세요.
    </div>

  </div><!-- /g_content -->
</div><!-- /g_container -->

<!-- 푸터 -->
<footer class="g_footer">
  <div class="footer-inner">
    <div class="footer-links">
      <a href="/customer/">이용약관</a>
      <a href="/customer/">개인정보처리방침</a>
      <a href="/customer/">청소년보호정책</a>
      <a href="/customer/">사업자정보확인</a>
      <a href="/customer/">광고/제휴문의</a>
    </div>
    <div class="footer-info">
      (주)아이템매니아 · 대표이사: 홍길동 · 사업자등록번호: 123-45-67890<br>
      통신판매업신고: 2024-서울강남-00000 · 주소: 서울특별시 강남구 테헤란로 123
    </div>
    <div class="footer-copyright">© 아이템매니아. All rights reserved.</div>
  </div>
</footer>

<script>
function toggleFaq(el) {
  el.classList.toggle('open');
  var box = el.nextElementSibling;
  box.classList.toggle('open');
}

function doFaqSearch() {
  var q = document.getElementById('faqSearch').value.trim().toLowerCase();
  filterByKeyword(q);
}

function setSearch(word) {
  document.getElementById('faqSearch').value = word;
  filterByKeyword(word.toLowerCase());
  return false;
}

function filterFaq(keyword) {
  document.getElementById('faqSearch').value = keyword;
  filterByKeyword(keyword.toLowerCase());
  return false;
}

function filterByKeyword(q) {
  var items = document.querySelectorAll('#faqList .faq_list');
  var shown = 0;
  items.forEach(function(item) {
    var tags = (item.dataset.tags || '').toLowerCase();
    var text = item.textContent.toLowerCase();
    var match = !q || tags.includes(q) || text.includes(q);
    item.style.display = match ? '' : 'none';
    if (match) shown++;
  });
  document.getElementById('noResult').style.display = shown === 0 ? 'block' : 'none';
}

// 페이지 진입 시 헤더 로그인 버튼 상태 반영
fetch('/api/auth/me', {credentials:'include'})
  .then(r => r.ok ? r.json() : null)
  .then(user => {
    if (user) {
      var btns = document.querySelectorAll('.header-btn');
      btns[0].textContent = '마이룸';
      btns[0].onclick = function(){ location.href='/myroom'; };
      btns[1].textContent = '로그아웃';
      btns[1].onclick = function(){
        fetch('/api/auth/logout',{method:'POST',credentials:'include'}).then(function(){ location.reload(); });
      };
    }
  }).catch(function(){});
</script>
</body>
</html>`;

router.get(["/customer", "/customer/", "/customer/faq", "/customer/faq/", "/customer/report", "/customer/report/", "/customer/safety", "/customer/safety/", "/customer/compensate", "/customer/compensate/", "/customer/myqna", "/customer/myqna/"], (_req, res): void => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  res.send(CUSTOMER_HTML);
});

export default router;
