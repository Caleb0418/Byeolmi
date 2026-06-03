# 작업 진행 로그 (Antigravity 인수인계용)

> `docs/antigravity_instructions.md` 지시서에 따른 작업 진행 상황 기록입니다.
> Antigravity 에이전트는 이 문서를 읽고 **이미 완료된 항목을 재작업하지 말고**, "남은 작업"부터 이어서 진행하십시오.

---

## ✅ 완료: P0 — 보안 / 데이터 정합성 (배포 차단 항목 전부 해결)

작업일: 2026-06-03 · 검증: app.js 구문 파싱 OK, 기존 단위 테스트 5/5 통과, 실행 코드/SQL에 취약 패턴 0건

### P0-1. 권한 부여 백도어 제거 ✔
- **변경 파일**: `db/schema.sql`, `supabase/migrations/20260603000001_fix_owner_role_backdoor.sql`
- **내용**: `handle_new_user()` 트리거에서 `new.email like '%seung%'`, `seung@example.com`, `willy0418@naver.com` 하드코딩 조건을 **전부 제거**. owner 권한은 이제 **`approved_owners` 화이트리스트에 등록된 이메일에만** 부여.
- **시드**: 초기 사장님 `willy0418@naver.com`을 `approved_owners`에 등록(트리거가 참조). 이후 사장님 추가는 대시보드 UI로 관리.
- **AC 충족**: like 패턴 제거 ✔ / 개인 이메일 하드코딩 0개 ✔ / approved_owners 기준으로만 owner ✔ / 마이그레이션 작성 ✔

### P0-2. 클라이언트 측 암호화 키 노출 제거 ✔
- **변경 파일**: `app.js` (`BongBongCrypt`, `CRYPTO_SECRET` 제거)
- **내용**: 소스에 하드코딩됐던 `CRYPTO_SECRET` 및 `CryptoJS.AES` 암복호화를 제거. 연락처는 **평문 저장**하고 실제 보안은 **`buyers` 테이블 RLS**(소유자/본인만 접근)가 담당. 화면 노출 시 `maskContact()`로 마스킹.
- **호환성**: `encrypt()`/`decrypt()`는 호출부 호환을 위해 패스스루로 유지. 레거시 AES 암호문(`U2FsdGVk` 접두)은 복호화 불가하므로 빈 값 처리(재입력 유도) + 콘솔 경고.
- **AC 충족**: 클라이언트 코드에 비밀키 없음 ✔ / 마스킹 유틸 유지 ✔ / 레거시 데이터 마이그레이션 경로 명시 ✔
- **⚠️ Antigravity 확인 필요**: 레거시 AES로 저장된 운영 데이터(테스트 연락처)가 있으면 해당 거래처는 연락처 재입력이 필요. 운영 DB의 `buyers.contact`에 `U2FsdGVk`로 시작하는 값이 있는지 점검 권장.

### P0-3. 스키마 드리프트 해소 (`payment_status`) ✔
- **변경 파일**: `db/schema.sql`, `supabase/migrations/20260603000002_add_payment_status.sql`
- **내용**: 코드가 사용하던 `orders.payment_status` / `settlements.payment_status` 컬럼을 정식 정의. 기본값 `'미수금'`, CHECK 제약 `('미수금','수금완료')` — UI 드롭다운 값과 일치. 운영 DB에 이미 수동 추가됐을 수 있어 **멱등(if not exists + 제약 가드)** 처리.
- **AC 충족**: 마이그레이션에 컬럼 정의 포함 ✔ / 코드 기본값·CHECK 일치 ✔ / 빈 DB에서 스키마만으로 동작 ✔

### P0-4. Supabase 마이그레이션 체계 도입 ✔
- **변경 파일**: `supabase/migrations/` 신규 (`README.md` + 마이그레이션 2건)
- **내용**: 변경 이력 추적 가능한 마이그레이션 디렉토리 신설. `db/schema.sql`은 **신규 환경용 전체 스냅샷**으로 유지, 운영 DB에는 마이그레이션 순차 적용.
- **AC 충족**: P0-1~3 변경이 마이그레이션 파일로 존재 ✔ / 순차 적용으로 스키마 재현 가능 ✔

### 📌 P0 적용 시 운영 반영 절차 (배포 담당자)
1. `supabase db push` 또는 마이그레이션 2건을 순서대로 원격 DB에 적용.
2. `buyers.contact`에 레거시 암호문(`U2FsdGVk…`) 존재 여부 점검(P0-2).
3. `approved_owners`에 실제 사장님 이메일이 등록돼 있는지 확인.
4. 프론트엔드 정적 파일(app.js 등) 재배포.

---

## ✅ 완료: P1 — PRD 핵심 기능

작업일: 2026-06-03 · 검증: app.js 구문 파싱 OK, index/client 인라인 스크립트 파싱 OK, 단위 테스트 5/5 통과

### P1-1. 알림톡 발송 실패 시 개별 재전송 ✔
- **변경 파일**: `app.js`, `index.html`
- **내용**:
  - `BongBongStore.getFailedSettlements()` — `send_status='failed'` 정산을 거래처 정보와 함께 조회.
  - `BongBongStore.resendAlimtalk(settlementId)` — 정산/거래처 로드 → 명세서 요약 재구성 → Edge Function 재호출 → 성공 시 `send_status='sent'`/`sent_at` 갱신·`error_message` 초기화, 실패 시 사유 갱신.
  - `index.html` 정산 모달 상단에 **발송 실패 영역**(`#modal-failed-settlements`)을 추가하고, 해당 거래처의 실패 건마다 **[재전송] 버튼** 노출(`renderFailedSettlements`, `handleResendAlimtalk`).
- **AC 충족**: 실패 건 시각적 구분 표시 ✔ / 개별 재전송 동작 + 성공 시 상태 갱신 ✔
- **⚠️ 비고**: `buyer_id`가 비어 있는 실패 정산(거래처 매칭 실패 건)은 특정 거래처 모달에 노출되지 않음 — 필요 시 전역 실패 목록 뷰를 추가 검토.

### P1-2. 발주 제출 시 구매자 알림톡 ✔ (코드 경로 구현, 템플릿 승인 필요)
- **변경 파일**: `client.html`, `app.js`, `supabase/functions/send-alimtalk/index.ts`
- **내용**:
  - Edge Function에 `type` 파라미터 추가(`settlement` 기본 / `order_confirm`). 타입별 문구·템플릿·버튼 분기, **하위호환 유지**.
  - 발주확인용 템플릿 환경변수 `SOLAPI_ORDER_TEMPLATE_ID` 추가(미설정 시 정산 템플릿으로 폴백).
  - `BongBongStore.sendOrderConfirmation(...)` 추가.
  - `client.html` 발주 성공 직후 **fail-safe(비동기·catch)** 로 발주확인 알림톡 발송 — 발송 실패해도 발주 자체는 정상 처리.
- **AC 충족**: 발주 성공 시 발송 트리거 연결 ✔ / 실패해도 발주 성공 ✔
- **⚠️ Antigravity/배포 담당자 필수 조치**: 카카오 비즈니스에서 **발주 접수 확인용 알림톡 템플릿을 사전 승인**받고, 템플릿 ID를 `SOLAPI_ORDER_TEMPLATE_ID` 환경변수에 설정해야 실제 발송됨. (미설정 시 정산 템플릿 변수 불일치로 거부될 수 있음 — 단, fail-safe라 발주엔 영향 없음)

### P1-3. 분석 데이터 동적화 ✔
- **변경 파일**: `app.js`, `index.html`
- **내용**:
  - `app.js`의 하드코딩 더미 `ANALYTICS_DATA`(월/주/일 매출 + 가짜 거래처 5건)를 **빈 구조로 교체**.
  - `index.html` `buildSalesTrendChart`가 더미 폴백 없이 **항상 실제 주문(`aggregateChartData`) 기반**으로 렌더 → 데이터 없으면 0으로 채워진 실제 빈 상태.
  - KPI 카드의 하드코딩 base(`32450000`/`1540`/`76`) 제거 → 실제 발주 집계로 계산, 0건 분모 가드.
- **AC 충족**: 차트·KPI가 실 데이터 반영 ✔ / 빈 상태 처리 ✔

---

## ✅ 완료: P2 — 안정성/품질

작업일: 2026-06-03 · 검증: 단위 테스트 20/20 통과, app.js·3개 HTML 인라인 스크립트 파싱 OK

### P2-1. 테스트 보강 ✔
- **변경 파일**: `app.js`(CommonJS export 추가), `package.json`(신규), `tests/_util.js`(신규), `tests/calculator.test.js`(재작성), `tests/crypt.test.js`(신규)
- **내용**:
  - `app.js` 끝에 브라우저 안전한 CommonJS export 추가 → 테스트가 **복붙 사본이 아닌 실제 프로덕션 로직**을 검증(드리프트 방지).
  - 경량 테스트 유틸(`createSuite`/`loadApp`)로 구간단가 경계값·역순 tier·null 입력·혜택정보, 암호화 패스스루·레거시 암호문·마스킹 등 **총 20개 케이스** 작성.
  - `npm test`로 일괄 실행.
- **AC 비고**: 순수 로직(Calculator/Crypt) 행위 커버리지 확보. 커버리지 측정 도구(c8/nyc) 도입 및 Store/UI 통합 테스트는 후속(라이브 DB 필요).

### P2-2. Silent failure 제거 ✔
- **변경 파일**: `app.js`, `index.html`, `client.html`
- **내용**:
  - 공용 토스트 유틸 `BongBongUI.toast()` 추가(브라우저 전용, `document` 없으면 no-op, `role/aria-live` 부여).
  - 조용히 삼키던 렌더링 catch(분석 보드·정산 모달·품목 목록·사장님 목록·구매자 페이지)와 `getAnalyticsData` 폴백에 **사용자 토스트** 연결.
  - `deleteApprovedOwner`가 오류를 무시하던 부분을 **로깅+전파**로 수정.
- **AC 충족**: 실패가 사용자에게 보임 ✔ / Store 반환 계약은 유지(저위험) ✔

### P2-3. 폴링 → Realtime ✔ (기존 구현 확인)
- **상태**: `index.html`(orders·items 구독)와 `client.html`(items 구독)이 **이미 Supabase Realtime 구독**을 사용하며, `setInterval` 3초 폴링은 코드 전반에서 제거되어 있음(잔존 0건 확인). 추가 변경 불필요.

### P2-4. 고령 사용자 접근성 (초기 개선) ✔ / 전체 감사 ⏳
- **변경 파일**: `index.html`, `client.html`, `invoice.html`
- **내용**: 3개 페이지에 **키보드 포커스 가시성(`:focus-visible`)** 과 **`prefers-reduced-motion` 모션 축소** 스타일 추가. `lang="ko"`·viewport는 기존부터 양호.
- **⚠️ 남은 일**: 색 대비(WCAG AA)·터치 타깃 크기·아이콘 전용 버튼 `aria-label`·스크린리더 흐름은 **렌더링 기반 정식 감사 필요**(`a11y-architect` 에이전트 + 실제 브라우저 권장).

---

## ⏳ 남은 작업 (Antigravity가 이어서 진행)

### 🟢 P3 — 운영 준비
- P3-1 배포 파이프라인 · P3-2 알림톡 템플릿 심사 · P3-3 온보딩 UX

---

## 변경 파일 요약
| 파일 | 단계 | 변경 |
|------|------|------|
| `db/schema.sql` | P0 | 트리거 백도어 제거, payment_status 2컬럼 추가, approved_owners 시드 |
| `supabase/migrations/*` | P0 | 마이그레이션 체계 + P0-1/P0-3 마이그레이션 (3 파일) |
| `app.js` | P0·P1 | CRYPTO_SECRET/AES 제거 / ANALYTICS_DATA 더미 제거 / 재전송·발주확인·실패조회 메서드 추가 |
| `index.html` | P1 | 차트·KPI 동적화, 정산 모달 발송실패 재전송 UI |
| `client.html` | P1 | 발주 성공 후 발주확인 알림톡 fail-safe 호출 |
| `supabase/functions/send-alimtalk/index.ts` | P1 | `type` 분기(정산/발주확인), `SOLAPI_ORDER_TEMPLATE_ID` |
| `docs/antigravity_progress.md`, `docs/task.md` | P0·P1 | 진행 로그/태스크 갱신 |

## 📌 P1 배포 시 필수 조치
1. **Edge Function 재배포**: `supabase functions deploy send-alimtalk` (type 분기 반영).
2. **환경변수 설정**: `SOLAPI_ORDER_TEMPLATE_ID` = 카카오 승인된 발주확인 템플릿 ID (P1-2).
3. **프론트 재배포**: `app.js`, `index.html`, `client.html`.
