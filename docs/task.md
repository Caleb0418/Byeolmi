# 개발 태스크 현황판 (task.md)

브랜딩명 변경('별미집') 및 모바일 정산 영수증 웹뷰 신설, 카카오톡 알림 프리뷰 모달 구현에 이어 **분석 및 통계 탭의 고도화**와 **실시간 카카오 취합 내역 테이블 일괄 편집(Bulk Edit) 및 삭제 기능**을 추적하기 위한 최종 할 일 목록입니다.

## 📋 개발 체크리스트

- `[x]` **[Phase 1] 전역 브랜딩 명칭 변경 ('별미집')**
  - `[x]` `client.html`, `index.html`, `test_bed.html`, `app.js` 내 모든 '봉봉마켓/봉봉 마켓'을 '별미집'으로 일괄 변경

- `[x]` **[Phase 2] 모바일 상세 정산 영수증 웹뷰 추가 (`invoice.html`)**
  - `[x]` 모바일 친화형 세련된 영수증 레이아웃 마크업 및 스타일링 작성
  - `[x]` URL 파라미터(`?buyer=...`) 수신 및 `localStorage` 데이터를 통한 차등 도매가 자동 적용 바인딩 스크립트 작성
  - `[x]` 무통장 입금 정보 연동 및 계좌번호 클립보드 원클릭 복사 기능 구현

- `[x]` **[Phase 3] 사장님 대시보드 알림톡 프리뷰 모달 추가 (`index.html`)**
  - `[x]` 정산 일괄 발송 버튼 클릭 시 나타나는 카카오톡 대화방 모양의 커스텀 프리뷰 모달 구현
  - `[x]` 각 거래처 말풍선 하단에 `[상세 정산 명세서 보기]` 버튼을 추가하여 클릭 시 `invoice.html?buyer=...`로 신규 웹뷰가 뜨게 연동

- `[x]` **[Phase 4] 구매자 발주 성공 완료 모달 추가 (`client.html`)**
  - `[x]` 밋밋한 브라우저 `alert()`를 걷어내고, 화면 하단에서 햅틱하게 튕기며 올라오는 커스텀 성공 완료 바텀 시트 구현

- `[x]` **[Phase 5] 이전 작업 최종 시뮬레이션 및 검증 완료**
  - `[x]` `test_bed.html` 통합 테스트 베드에서 발주 전송 ➔ 실시간 취합 ➔ 정산 알림톡 발행 ➔ 영수증 페이지 연동 확인까지 전 단계 무오류 연동 확인

- `[x]` **[Phase 6] 분석 및 통계 탭 고도화 및 데이터 동적화**
  - `[x]` `app.js` 내 `BongBongStore`에 수금 데이터를 관리하기 위한 `bb_analytics_buyers` 로컬 스토리지 연동 및 초기 데이터 적재 구현
  - `[x]` `index.html` 내 기간별 차트 전환을 처리하는 `updateChartType` 함수 신설 및 Chart.js 데이터 바인딩
  - `[x]` `index.html` 내 도넛 차트 비율(%) 및 툴팁 표기 고도화
  - `[x]` `index.html` 내 거래처별 통계 테이블의 수금 상태를 `select` 드롭다운으로 교체하고 동적 상태 업데이트 및 영구 보존 로직 추가
  - `[x]` `index.html` 내 KPI 카드 통계값에 오늘 마감된 발주 정보(실시간 매출액 및 수량)를 합산하여 노출하도록 보완

- `[x]` **[Phase 7] 실시간 카카오 취합 내역 일괄 편집(Bulk Edit) 및 삭제 구현**
  - `[x]` `app.js` 내 `BongBongStore`에 개별 주문 정보 수정 및 주문 취소 로직 신설
  - `[x]` `index.html` 내 테이블 헤더 우측 끝 '관리' 열에 `[수정 / 완료]` 일괄 토글 버튼 구현
  - `[x]` `[수정]` 클릭 시, 모든 행이 일괄적으로 편집 폼(`input/select`)으로 전환되는 렌더링 로직 적용
  - `[x]` 편집 모드 실행 중 3초 자동 새로고침 타이머가 리렌더링을 일으켜 타이핑이 리셋되지 않도록 방어 로직 설계 및 적용
  - `[x]` `[완료]` 클릭 시, 화면에 렌더링된 모든 인풋의 변경 데이터를 검증하여 일괄적으로 영구 저장하는 toggleBulkEdit 로직 추가
  - `[x]` 각 행의 우측 끝에 주문 삭제를 즉시 실행하는 `X` 아이콘 버튼 구현 및 연동

- `[x]` **[Phase 8] 최종 통합 시뮬레이션 및 깃 커밋**
  - `[x]` `test_bed.html`에서 통계 탭 및 테이블 일괄 편집의 모든 신규 고도화 기능 검증
  - `[x]` 변경 사항을 Atomic Commit에 따라 Git 저장소에 커밋 및 푸시

- `[x]` **[Phase 9] P0 보안/데이터 정합성 하드닝 (배포 차단 항목)** — 상세: `docs/antigravity_progress.md`
  - `[x]` (P0-1) `handle_new_user` 트리거의 owner 권한 백도어 제거 → `approved_owners` 화이트리스트 전용
  - `[x]` (P0-2) `app.js` 클라이언트 측 하드코딩 암호화 키(`CRYPTO_SECRET`) 및 AES 제거, RLS+마스킹 정책 전환
  - `[x]` (P0-3) `orders`/`settlements` `payment_status` 컬럼 정식 정의 (코드-스키마 드리프트 해소)
  - `[x]` (P0-4) `supabase/migrations/` 마이그레이션 체계 도입 (이력 추적)
  - `[ ]` (배포) 운영 DB에 마이그레이션 적용 + 레거시 암호문 점검 + 프론트 재배포 — 담당자 확인 필요

- `[x]` **[Phase 10] P1 PRD 핵심 기능** — 상세: `docs/antigravity_progress.md`
  - `[x]` (P1-1) 알림톡 발송 실패 개별 재전송 UI/로직 (정산 모달 + `resendAlimtalk`)
  - `[x]` (P1-2) 발주 제출 시 구매자 주문요약 알림톡 (코드 경로 구현, fail-safe)
    - `[ ]` (배포) Solapi 발주확인 템플릿 승인 + `SOLAPI_ORDER_TEMPLATE_ID` 설정 + Edge Function 재배포
  - `[x]` (P1-3) 분석 데이터(`ANALYTICS_DATA`) 실집계 기반 동적화 + 빈 상태 처리

- `[x]` **[Phase 11] P2 안정성/품질** — 상세: `docs/antigravity_progress.md`
  - `[x]` (P2-1) 테스트 보강 — 실제 로직 import, 20개 케이스, `npm test`
  - `[x]` (P2-2) silent failure 제거 — 공용 토스트 + 렌더링 catch 연결, `deleteApprovedOwner` 전파
  - `[x]` (P2-3) 폴링→Realtime — 기존 구현 확인(orders/items/client 구독, 폴링 0건)
  - `[x]` (P2-4) 접근성 초기 개선 — focus-visible + prefers-reduced-motion (3개 페이지)
    - `[ ]` (후속) 색대비·터치타깃·aria-label·스크린리더 정식 WCAG 감사 (a11y-architect + 브라우저)

- `[ ]` **[Phase 12] P3 운영 준비 (다음 작업)**
  - `[ ]` (P3-1) 배포 파이프라인 · (P3-2) 알림톡 템플릿 심사 · (P3-3) 온보딩 UX
