아이템마니아 수동 VPS 배포

이 패키지는 거래 완료 수수료 0원과 신규 가입 차단 설정의 영구 저장을 포함합니다.
운영의 오래된 소스에서 다시 빌드하지 마세요.

1. itemmania-vps-release.tar.gz를 서버의 /root/에 업로드합니다.
2. root 터미널에서 실행합니다:

mkdir -p /root/itemmania-release &&
tar --no-same-owner -xzf /root/itemmania-vps-release.tar.gz -C /root/itemmania-release &&
bash /root/itemmania-release/deploy.sh

대상: /opt/itemmania, itemmania.service, /etc/itemmania.env, ltemmania.com.
다른 설치, 다른 DB, 초기화 활성화, 공개 API 바인딩, 지원하지 않는 서비스 설정은 배포 전에 중단합니다.
기존 회원/지갑/거래 데이터, 업로드, 환경 파일, 원본 소스와 기존 백업은 변경하지 않습니다.
등록 설정 테이블만 추가하며, 테이블이 이미 있으면 기존 설정 행을 유지합니다.
현재 관리자/게임 초기화나 전체 DB 스키마 동기화는 실행하지 않습니다.
dist 전체를 검증한 후 원자적으로 교체하고 API 서비스를 잠시 중지/시작합니다.
이전 dist의 백업이나 자동 롤백 사본은 만들지 않습니다.
가입 차단은 ON=차단 / OFF=허용이며, 기존 회원 로그인은 계속 허용합니다.
과거 완료 거래는 바꾸지 않으며 이후 거래 완료 정산은 수수료 없이 전액 지급합니다.

실패 시 운영 소스 재빌드나 ALLOW_STARTUP_DB_SYNC=1 설정을 하지 마세요.
서비스 시작 실패는 journalctl -u itemmania -n 50 --no-pager로 확인하세요.
로그를 공유할 때는 비밀번호, DB 연결 문자열, 세션 값을 제거하세요.