# 최신 아이템마니아 코드와 VPS 실행 파일 복원

## 이 저장소에 포함되는 것

- 현재 프로젝트의 API·웹·모바일 화면 소스와 의존성 잠금 파일
- 거래 완료 시 구매자 전액 차감·판매자 전액 지급·수수료 0원 처리
- 관리자 `/banana777` → 회원 관리 → 신규 회원 가입 차단 ON/OFF의 DB 저장
- 기존 회원 로그인 유지, 회원/IP 차단 및 기존 프로젝트에 반영된 수정
- 검증된 VPS 실행 파일: `itemmania-vps-release.tar.gz`
- 제한된 가입 설정 테이블 추가 SQL과 기존 서버용 안전 배포 스크립트

실행 패키지 SHA-256:

```text
ad1b721f18efebae0429c914053ab32ada41533f832a7234d4e83e063e1f8c3c
```

이 패키지와 함께 사용해야 하는 화면 파일은
`artifacts/api-server/src/static/`에 있습니다. 실행 패키지만 옮기고 화면
파일을 빠뜨리면 정상 복원이 아닙니다.

## 이 저장소만으로는 복원되지 않는 것

운영 PostgreSQL 데이터, 회원·마일리지·거래·채팅·가입 차단 설정의 실제
기록, 운영 업로드 파일, 비밀번호·API 키·세션 키, `/etc/itemmania.env`,
Nginx 설정 및 HTTPS 인증서는 Git 코드 백업과 별개입니다.

이 자료들은 별도의 안전한 운영 백업에서 복원해야 합니다. GitHub 코드가
최신이어도 운영 데이터 백업이 없으면 기존 회원과 거래 기록은 복원할 수
없습니다. 다른 프로젝트의 백업이나 Replit 개발 DB를 운영 DB로 사용하지
마세요.

공개 업로드용 `.replit`에서는 비밀 설정 구역을 제거했습니다. 로컬 자동
저장 이력, 에이전트 메모리, 새 첨부파일·터미널 스크린샷, 환경파일 및
운영 데이터는 이번 업로드에 포함하지 않습니다. 기존 GitHub 이력은
유지합니다. 이 저장소에 비밀값을 추가하거나 로컬 자동 저장 이력을
검사 없이 통째로 push하지 마세요.

## 이미 운영 중인 동일 설치에 수정본 적용

대상은 `/opt/itemmania`, `itemmania.service`, `/etc/itemmania.env`,
`ltemmania.com`을 사용하는 기존 설치입니다. 서비스가 정상 동작하는지,
실제 운영 DB와 안전 설정이 맞는지 먼저 검사합니다.

저장소 루트에서 root로 실행:

```bash
bash <<'RELEASE'
set -Eeuo pipefail
[ "$(id -u)" -eq 0 ] || { echo "root로 실행하세요."; exit 1; }
PACKAGE="$PWD/artifacts/api-server/releases/itemmania-vps-release.tar.gz"
printf '%s  %s\n' \
  ad1b721f18efebae0429c914053ab32ada41533f832a7234d4e83e063e1f8c3c \
  "$PACKAGE" | sha256sum --check -
WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
tar --no-same-owner -xzf "$PACKAGE" -C "$WORK"
bash "$WORK/deploy.sh"
RELEASE
```

이 스크립트는 기존 회원·거래 데이터를 초기화하지 않습니다. 가입 설정
테이블만 없을 때 추가하고, 기존 설정 행은 유지합니다. 검증 후 API의
`dist`를 교체하고 서비스를 잠시 재시작합니다. 이전 `dist` 자동 롤백
사본은 만들지 않습니다. 다른 설치이거나 지원하지 않는 서비스 설정이면
수정 전에 중단합니다.

## 다른 새 서버로 복원

**위 배포 스크립트는 새 서버를 처음 설치하는 도구가 아닙니다.** 새 서버는
다음 순서로 별도 준비해야 합니다.

1. Node.js 24, pnpm 10, PostgreSQL, Nginx와 HTTPS를 준비합니다.
2. 이 저장소의 최신 `main`을 `/opt/itemmania`에 복원합니다.
3. 해당 폴더에서 `pnpm install --frozen-lockfile`로 의존성을 설치합니다.
   운영 DB를 대상으로 `db push`, 전체 스키마 동기화나 초기화 스크립트를
   실행하지 마세요.
4. 별도 운영 DB 백업을 **새로 준비한 빈 DB**에 복원합니다. 운영 업로드와
   필요한 외부 저장소 연결도 별도 백업에서 복원합니다. 기존 운영 DB를
   덮어쓰거나 지우지 마세요.
5. 비밀 환경파일을 안전한 백업에서 `/etc/itemmania.env`로 복원하고
   접근 권한을 제한합니다. `DATABASE_URL`이 새 서버의 복원된 운영 DB를
   가리키는지 확인합니다. 다음 안전 설정을 유지합니다:

   ```text
   NODE_ENV=production
   ALLOW_STARTUP_DB_SYNC=0
   BIND_HOST=127.0.0.1
   ```

   `PORT`는 Nginx의 로컬 API 연결 포트와 맞춥니다. 기존 `SESSION_SECRET`과
   필요한 API 키는 Git이 아닌 안전한 비밀 저장소에서 복원합니다.
6. 이전 백업에 `registration_settings` 테이블이 없다면 해당 DB에
   `artifacts/api-server/scripts/vps-registration-settings.sql`만 적용합니다.
   기존 설정 행은 수정하지 않습니다. 백업 자체에 설정 행이 없으면
   가입 차단 초기 상태는 OFF입니다.
7. 위 SHA-256으로 패키지를 검증하고 임시 폴더에 압축을 풉니다. **새 서버의
   비어 있는 실행 폴더** `artifacts/api-server/dist/`에 패키지의 `dist/`
   내용물을 배치합니다. 실행 패키지를 다시 빌드할 필요는 없습니다.
8. `itemmania.service`가 `/opt/itemmania` 또는 API 폴더를 작업 폴더로,
   `/etc/itemmania.env`를 환경파일로 사용하고 Node가
   `/opt/itemmania/artifacts/api-server/dist/index.mjs`를 직접 실행하도록
   준비합니다. Nginx는 지정한 로컬 포트로 연결합니다.
9. 서비스를 시작한 뒤 충분히 기다려 `/api/healthz`, 관리자 로그인,
   회원 관리의 가입 차단 표시, 기존 회원과 거래 기록을 확인합니다.
   실제 회원 잔액을 사용하는 테스트 거래나 과거 완료 거래의 재정산을
   하지 마세요.
10. 확인 후 도메인 연결을 전환합니다. 크롤러를 두 서버에서 동시에
    실행하지 않도록 전환 중에는 한쪽 자동 수집을 중지합니다.

가입 차단은 ON=신규 가입 차단, OFF=허용이며 기존 회원 로그인은 유지됩니다.
과거 완료 거래를 다시 계산하지 않습니다. 변경 후 거래 완료 정산은
수수료 없이 전액 처리합니다.

기존 VPS에는 실행 파일만 갱신된 이력이 있으므로, 그 서버에 남아 있는
오래된 소스를 다시 빌드해 복원하지 마세요. 이 저장소의 최신 소스 또는
위 검증된 실행 패키지를 사용하세요.