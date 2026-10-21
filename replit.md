# 아이템마니아 클론

게임 아이템 거래 사이트를 재현한 웹 앱으로, Express가 기본 화면과 API를 제공합니다.

## Run & Operate

- Replit의 `artifacts/api-server: API Server` 워크플로를 실행하면 기본 주소(`/`)에서 클론 화면을 볼 수 있습니다. API 상태 확인: `/api/healthz`.
- `artifacts/web-app: web` 워크플로는 별도의 React 개발 서버입니다. 현재 기본 주소와 `/app`은 Express 클론 화면으로 연결되므로 React 화면은 프록시에서 제공되지 않습니다.
- 처음 가져온 후에는 루트에서 `pnpm install --frozen-lockfile`, 빈 개발 DB에는 `pnpm --filter @workspace/db run push`를 실행합니다.
- Replit API 서버의 수집은 `FIRECRAWL_API_KEY` 비밀 설정을 우선 사용하며, 없을 때만 기존 `SCRAPER_API_KEY`를 사용합니다. Firecrawl 기본 자동 수집은 서버 시간 매일 01:00에 11개 게임의 판매·구매 첫 페이지를 각각 수집합니다(월 약 660~682페이지, 페이지당 1크레딧 기준). `AUTO_CRAWL_ENABLED=0`이면 자동 수집만 중지합니다. `AUTO_CRAWL_SCHEDULE`과 `AUTO_CRAWL_PAGES`를 명시하면 기본값보다 크레딧을 더 사용할 수 있습니다. 상세 페이지 수집과 관리자 수동 실행은 이 계산에 포함되지 않습니다. 운영 VPS에서 자동 수집 중일 때 Replit 개발 서버에도 동시에 켜두면 두 서버가 크레딧을 각각 소비합니다.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- 필수 환경 변수: Replit 관리 DB의 `DATABASE_URL`, 비밀 설정 `SESSION_SECRET`. 관리자 계정을 초기화/갱신하려면 비밀 설정 `ADMIN_PASSWORD`도 필요합니다. 비밀번호가 없으면 관리자 계정 초기화는 건너뜁니다.

### Hostinger VPS

- 공개 주소: `https://ltemmania.com/` (상태 확인: `/api/healthz`). Cloudflare 프록시를 거치므로 공개 A 조회에는 Cloudflare IP가 표시됩니다. 이전 `test02314.co.kr` 주소는 새 도메인으로 301 이동합니다. `www.ltemmania.com`은 현재 DNS가 설정되지 않았습니다. Replit과는 별개의 설치이며 데이터베이스도 분리되어 있습니다.
- Ubuntu 서버에서 소스는 `/opt/itemmania`, 비공개 실행 환경 변수는 `/etc/itemmania.env`, 서비스는 `itemmania.service`, 역방향 프록시는 Nginx, 새 도메인과 이전 도메인의 HTTPS 인증서는 Certbot이 관리합니다.
- 서비스 확인: `systemctl status itemmania`; 로그: `journalctl -u itemmania -f`. Replit 코드 변경은 VPS에 자동 반영되지 않습니다. 최근 운영 반영은 사용자 요청에 따라 컴파일된 `dist`만 교체했으므로, 운영 소스에서 그대로 다시 빌드하면 해당 수정이 사라질 수 있습니다. 이후 배포 방식은 사용자의 지시를 다시 확인하세요.
- 운영 관리자 화면은 `/banana777`이며 `/admin`, `/admin-login` 등 이전 화면 주소는 404입니다. `/api/admin/*` API 경로는 그대로 유지합니다. 관리자 주소 변경도 운영 중인 번들에만 반영되어 있으므로, 오래된 VPS 소스에서 재빌드하면 되돌아갈 수 있습니다.
- 운영 회원 비밀번호는 로그인용 해시를 유지하면서 이후 가입·변경·재설정 원문을 `member_password_originals`에 별도 저장합니다. 기존 해시를 복원하거나 기존 회원 로그인 시 원문을 수집하지 않습니다. `/banana777` 회원 관리의 비밀번호 관리에서 관리자 재인증 후 조회하며 관리자 계정·삭제된 회원은 조회 대상에서 제외합니다. 별도 VPS 배포 시 `vps-member-password-originals.sql`을 포함한 검증된 추가 테이블 생성과 실행 파일 교체만 사용하며, 원문·조회 응답·세션 쿠키는 로그나 공유 코드 백업에 포함하지 마세요.
- VPS는 기존 Replit 데이터를 복사하지 않은 신규 DB로 시작했습니다. 관리자 계정은 `ADMIN_PASSWORD`로 초기화됩니다. 운영 데이터의 외부 백업은 아직 설정되지 않았습니다.
- VPS 크롤러는 `FIRECRAWL_API_KEY`를 우선 사용합니다. VPS `/etc/itemmania.env`에 별도로 등록되어 있으며 Replit 비밀 설정을 바꿔도 VPS에 자동 전달되지 않습니다. 운영 자동 수집은 서버 시간 매일 01:00(`AUTO_CRAWL_SCHEDULE=0 1 * * *`)에 11개 게임의 판매·구매 첫 페이지(22페이지)를 수집합니다. 페이지당 1크레딧 기준 월 약 660~682크레딧이며 수동·상세·재시도 수집은 별도입니다. 기존 `SCRAPER_API_KEY`는 Firecrawl 키가 없을 때만 대체 경로로 사용합니다.
- Replit 개발 API 서버에는 `AUTO_CRAWL_ENABLED=0`을 설정해 운영 VPS와 자동 수집 크레딧을 중복 사용하지 않도록 했습니다. VPS의 데이터베이스와 Replit 개발 데이터베이스는 별개입니다. 운영의 `products.is_premium` 열을 추가했고 기존에 수집된 오딘의 옛 게임명도 정규화했습니다. 운영 DB·이전 `dist`·설정 파일의 배포 전 백업은 VPS의 `/root/itemmania-backups/firecrawl-current`가 가리키는 제한된 디렉토리에 있습니다. 이 백업은 서버 내부에만 있으며 외부 백업은 아직 없습니다.
- 신규 가입 차단 스위치는 관리자 회원 관리에 있으며 ON=가입 차단, OFF=허용(초기값)입니다. 일반 가입·아이디 최초 로그인 자동 가입·구형 로그인 자동 가입 모두 같은 DB 설정을 사용하며 기존 회원 로그인은 유지합니다. 사용자는 이 기능의 `registration_settings` 설정 테이블 추가와 설정 저장을 허용했으며, 기존 회원·거래 데이터 변경은 허용 범위가 아닙니다. 별도 VPS에 반영할 때는 먼저 `artifacts/api-server/scripts/vps-registration-settings.sql`로 이 테이블만 추가한 후 API `dist`를 교체해야 합니다. 앱 시작 시 DDL이나 전체 스키마 동기화를 실행하지 마세요.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server`: 기본 화면, 프록시, API 및 관리자 경로
- `artifacts/web-app`: 별도 React/Vite 화면
- `lib/db/src/schema`: PostgreSQL 스키마
- `lib/api-spec/openapi.yaml`: API 계약

## Architecture decisions

- 현재 기본 화면은 React/Vite가 아닌 Express가 제공합니다. `/app` 요청은 기본 화면으로 이동합니다.
- 모바일 홈·채팅 목록·마이룸은 휴대폰 요청에만 별도로 제공하며, 데스크톱 화면과 동작은 기존 상태를 유지합니다. 앞으로 전달되는 모바일 화면을 구현할 때도 데스크톱 환경은 변경하지 마세요.

## Product

- 게임/아이템 검색, 거래 관련 화면, 회원 및 관리자 기능.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- 기본 관리자 비밀번호를 코드에 두지 마세요. `ADMIN_PASSWORD` 비밀 설정으로만 관리합니다.
- `user_sessions` 테이블이 필요하며 개발 DB 스키마 적용 시 생성됩니다.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
