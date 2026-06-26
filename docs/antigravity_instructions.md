# 안티그래비티 작업 지시서 (Antigravity Agent Brief)

> 본 문서는 **Antigravity 에이전트**가 별미집(BongBong) 도매 정산 시스템의 다음 작업을 자율적으로 수행하기 위한 지시서입니다.
> 작업 시작 전 본 문서를 끝까지 읽고, **§7 작업 원칙**과 **§8 보안 가드레일**을 반드시 준수하십시오.

---

## 1. 미션 (Mission)

별미집은 신선식품 **도매 사장님**이 거래처 발주를 취합하고, 수량별 차등단가로 정산한 뒤, **카카오 알림톡**으로 명세서를 발송하는 B2B 정산 시스템입니다.
현재 LocalStorage 목업 → Supabase 실DB 마이그레이션이 거의 끝난 상태이며, **배포 전 보안/데이터 정합성 결함을 제거**하고 **PRD 핵심 기능의 미완성 부분을 완성**하는 것이 이번 작업의 목표입니다.

작업은 **§6 작업 항목**의 우선순위(P0 → P1 → P2 → P3) 순서로 진행합니다. **P0는 배포 차단(blocker) 항목이므로 최우선으로 완료**해야 합니다.

---

## 2. 기술 스택 & 아키텍처

- **프론트엔드**: 순수 HTML / CSS(Tailwind CDN) / Vanilla JS — **빌드 과정 없음**. 브라우저에서 파일 직접 실행.
- **백엔드**: Supabase (PostgreSQL + RLS + Auth + Edge Functions)
- **인증**: 카카오 OAuth (Supabase Auth) — 역할(`owner` / `buyer`) 기반 권한
- **알림톡**: Solapi API (Deno Edge Function `send-alimtalk`)
- **검증**: Zod(클라이언트 입력), 차등단가 기밀은 `get_buyer_tier_benefit` RPC(SECURITY DEFINER)로 보호
- **외부 라이브러리**: 전역(window) 주입 방식 — `window.supabase`, `window.z`(Zod), `Chart.js`, `CryptoJS`

---

## 3. 저장소 구조

```
.
├── index.html      # 사장님 대시보드 (발주 취합, 품목/단가 CRUD, 분석탭, 마감/알림톡)
├── client.html     # 구매자 발주서 (카카오 로그인, 위저드 발주)
├── invoice.html    # 모바일 정산 명세서 웹뷰 (?buyer=... 파라미터 수신)
├── app.js          # 코어 로직 (BongBongStore / Calculator / Auth / Crypt 클래스)
├── db/schema.sql   # Supabase 스키마 + RLS 정책 + 시드 (⚠️ 단일 파일, 마이그레이션 이력 없음)
├── supabase/functions/send-alimtalk/index.ts   # Solapi 알림톡 Edge Function
├── tests/calculator.test.js                     # 유일한 테스트
├── legacy/         # 디자인 프로토타입 보관 (수정 금지)
└── docs/           # 기획 문서 (prd.md, task.md, implementation_plan.md 등)
```

핵심 클래스 (`app.js`):
- `BongBongStore` — Supabase 입출력(items/orders/buyers/settlements/approved_owners), 알림톡 호출
- `BongBongCalculator` — 수량별 차등 도매단가 계산
- `BongBongAuth` — 카카오 OAuth, 역할 조회
- `BongBongCrypt` — AES 암호화/마스킹 (⚠️ §6 P0-2 참조)

---

## 4. 현재 구현 완료 상태 (건드릴 필요 없음)

- 구매자: 카카오 로그인, 품목 리스트, 위저드 발주, 차등단가 미리보기, 전화번호 자동포맷, 성공 바텀시트
- 사장님: 실시간 취합 테이블, 일괄편집/삭제, 품목·단가 CRUD, 분석/통계 탭, 마감, 알림톡 프리뷰, approved_owners 관리, 프로필/로그아웃
- 명세서: 모바일 영수증, 계좌 원클릭 복사
- 백엔드: 스키마, RLS, 역할 분기, 단가 기밀 RPC, Solapi Edge Function

> `docs/task.md`의 Phase 1~8은 완료 처리됨. **이미 완료된 항목을 재작업하지 마십시오.**

---

## 5. 사전 준비 (작업 시작 전)

1. 현재 브랜치에서 새 작업 브랜치 생성 (예: `fix/security-hardening`). **main에 직접 커밋 금지.**
2. Supabase 프로젝트는 **원격 운영 DB가 살아있는 상태**임. 스키마 변경은 반드시 **마이그레이션 파일로 작성**하고, 파괴적 쿼리(DROP/DELETE) 실행 전 영향 범위를 점검할 것.
3. 비밀키(Solapi, Supabase service_role 등)는 **절대 코드/문서에 하드코딩하지 말 것.** 환경변수만 사용.

---

## 6. 작업 항목 (우선순위순)

각 항목은 **[대상 파일] → 작업 → 완료 기준(AC)** 형식입니다. 완료 시 해당 AC를 모두 충족해야 합니다.

### 🔴 P0 — 보안 / 데이터 정합성 (배포 차단, 최우선)

#### P0-1. 권한 부여 백도어 제거
- **대상**: `db/schema.sql` (`handle_new_user` 트리거 함수)
- **문제**: `new.email like '%seung%'` 및 `seung@example.com`, `willy0418@naver.com` 하드코딩으로 owner 권한 부여. **`seung`이 포함된 임의 이메일이면 누구나 사장님 권한 획득** → 심각한 권한 상승 취약점.
- **작업**: owner 권한은 **`approved_owners` 테이블에 등록된 이메일로만** 부여하도록 변경. 와일드카드(`like '%...%'`) 및 개인 이메일 하드코딩 전면 제거.
- **AC**:
  - [ ] `like` 패턴 매칭 제거됨
  - [ ] 하드코딩된 개인 이메일 0개
  - [ ] `approved_owners`에 사전 등록된 이메일만 가입 시 owner가 됨 (마이그레이션으로 초기 사장님 1명 시드)
  - [ ] 변경을 마이그레이션 파일로 작성

#### P0-2. 클라이언트 측 암호화 키 노출 제거
- **대상**: `app.js` (`CRYPTO_SECRET`, `BongBongCrypt`)
- **문제**: AES 비밀키가 브라우저 JS 소스에 하드코딩 → 누구나 복호화 가능, 암호화가 무의미.
- **작업**: 개인정보(연락처/주소)는 ① 화면 노출 시 **마스킹**(`maskContact`)으로 처리하고, ② 실제 기밀이 필요하면 **서버측(Edge Function 또는 DB pgcrypto)** 으로 이전. 클라이언트 하드코딩 키 제거.
- **AC**:
  - [ ] `CRYPTO_SECRET` 등 비밀키가 클라이언트 코드에 없음
  - [ ] 대시보드 개인정보 노출 시 마스킹 적용 확인
  - [ ] 기존 암호화 데이터가 있다면 마이그레이션 경로 명시

#### P0-3. 스키마 드리프트 해소 (`payment_status`)
- **대상**: `db/schema.sql`, `app.js`
- **문제**: 코드는 `orders.payment_status` / `settlements.payment_status`를 읽고 쓰지만 **스키마 정의에 컬럼이 없음** (원격 DB에만 수동 추가된 것으로 추정). 환경 재현 불가.
- **작업**: 두 컬럼을 마이그레이션으로 정식 정의(`text`, 기본값/CHECK 제약 포함, 예: `'미수금' | '수금완료'`). 코드의 기본값 로직과 일치시킬 것.
- **AC**:
  - [ ] 마이그레이션에 `payment_status` 컬럼 정의 포함
  - [ ] 코드의 기본값(`'미수금'`)과 CHECK 제약 일치
  - [ ] 빈 DB에서 스키마/마이그레이션만으로 앱이 정상 동작

#### P0-4. Supabase 마이그레이션 체계 도입
- **대상**: `supabase/migrations/` (신규)
- **문제**: 단일 `db/schema.sql`만 존재, 변경 이력 추적 불가.
- **작업**: `supabase/migrations/` 디렉토리 생성, 타임스탬프 기반 마이그레이션 파일로 전환. `db/schema.sql`은 초기 스냅샷으로 유지하거나 마이그레이션을 단일 진실원으로 정리.
- **AC**:
  - [ ] P0-1~3 변경이 마이그레이션 파일로 존재
  - [ ] 마이그레이션 순차 적용으로 현재 스키마 재현 가능

### 🟠 P1 — PRD 핵심 기능 미완성

#### P1-1. 알림톡 발송 실패 시 개별 재전송 (PRD 비기능 요구 §4 안정성)
- **대상**: `index.html`, `app.js`
- **작업**: `settlements.send_status='failed'` / `error_message` 데이터를 대시보드에 표시하고, **거래처별 [재전송] 버튼** + 재시도 로직 구현.
- **AC**:
  - [ ] 발송 실패 건이 시각적으로 구분 표시됨
  - [ ] 개별 재전송 버튼 동작, 성공 시 상태 `sent`로 갱신

#### P1-2. 발주 제출 시 구매자 알림톡 (PRD F-01)
- **대상**: `client.html`, `app.js`, `supabase/functions/`
- **작업**: 구매자 발주 직후 **주문요약 알림톡 자동 발송**(현재는 사장님 정산 발송만 존재).
- **AC**:
  - [ ] 발주 성공 시 구매자에게 주문요약 알림톡 발송 트리거 연결
  - [ ] 실패해도 발주 자체는 성공 처리(알림 실패는 별도 로깅)

#### P1-3. 분석 데이터 동적화
- **대상**: `app.js`(`ANALYTICS_DATA`), `index.html`
- **작업**: 하드코딩된 월간/주간/일간 매출 더미값을 **`settlements`/`orders` 실집계 기반**으로 교체.
- **AC**:
  - [ ] 차트/KPI가 실제 DB 집계를 반영
  - [ ] 데이터 없을 때 빈 상태(empty state) 처리

### 🟡 P2 — 안정성 / 품질

- **P2-1. 테스트 보강**: 차등단가 계산, 정산 로직, 입력 검증(Zod) 핵심 경로 단위 테스트 추가. (전역 규칙: 80% 목표)
- **P2-2. Silent failure 제거**: Store 메서드의 `console.error` 후 빈 배열/undefined 반환 패턴을 사용자 토스트/에러 상태로 표준화.
- **P2-3. Realtime + 30초 보조 갱신**: Supabase Realtime 구독을 기본으로 사용하고, 연결 누락/일시 끊김에 대비해 30초 보조 갱신만 유지. *편집 모드 중 리렌더 방어 로직은 유지.*
- **P2-4. 고령 사용자 접근성**: PRD 타깃(50대+ 사장님) 기준 버튼 크기/대비/단계 최소화 점검(WCAG).

### 🟢 P3 — 운영 준비

- **P3-1. 배포 파이프라인**: 정적 호스팅 + Edge Function 배포 자동화, Solapi/Supabase 환경변수 관리.
- **P3-2. 알림톡 템플릿 심사**: 운영용 `SOLAPI_TEMPLATE_ID` 카카오 사전 승인 확인.
- **P3-3. 온보딩 UX**: 품목 0개 첫 사용 플로우 점검, 테스트 시드 분리.

---

## 7. 작업 원칙

1. **우선순위 준수**: P0를 모두 끝내기 전 P1 이하로 넘어가지 말 것. P0는 독립적으로 PR 가능.
2. **원자적 커밋**: 항목 단위로 커밋. 커밋 메시지는 `<type>: <설명>` (feat/fix/refactor/docs/test/chore). 한 커밋에 무관한 변경 섞지 말 것.
3. **불변성 / 작은 파일**: 기존 코딩 컨벤션 유지 — 주변 코드의 네이밍/주석 밀도/스타일에 맞출 것. 한국어 주석 유지.
4. **검증 우선**: 변경 후 §9 검증 절차 수행. 추측으로 "완료" 보고 금지 — 실제 동작/테스트 결과로 보고.
5. **범위 한정**: 지시서에 없는 대규모 리팩토링/디자인 변경 금지. 발견한 추가 이슈는 별도로 기록만.
6. **`legacy/` 수정 금지**.

---

## 8. 보안 가드레일 (절대 위반 금지)

- 비밀키(API 키, secret, 비밀번호, service_role)를 코드/문서/커밋에 **하드코딩 금지**. 환경변수만 사용.
- 운영 DB에 대한 **파괴적 쿼리(DROP/DELETE/TRUNCATE)** 실행 전 영향 범위 확인 및 백업 고려.
- RLS 정책을 약화시키는 변경 금지(특히 `item_tiers` 기밀, `owner` 권한 경계).
- 사용자 입력은 항상 경계에서 검증(Zod/서버측). 외부 데이터 신뢰 금지.
- `client.html`은 비인증/저권한 사용자도 접근하므로, 단가 원본·기밀 데이터가 클라이언트로 새지 않는지 확인.

---

## 9. 검증 절차 (각 항목 완료 시)

1. **정적 동작**: `index.html` / `client.html` / `invoice.html`을 브라우저로 열어 콘솔 에러 0건 확인.
2. **DB 변경**: 마이그레이션을 깨끗한 환경(또는 브랜치 DB)에 적용해 스키마 재현 확인.
3. **권한 시나리오**(P0-1): ① approved_owners에 없는 일반 이메일 → buyer 권한, ② 등록된 이메일 → owner 권한 확인.
4. **알림톡**(P1): 발송 성공/실패 양쪽 경로 확인, 실패 시 재전송 동작.
5. **테스트**: `tests/` 실행해 통과 확인, 신규 로직은 테스트 추가.
6. 결과를 **사실대로** 보고(통과/실패/스킵 명시).

---

## 10. 산출물 (Deliverables)

- [ ] P0-1~4 완료 + 마이그레이션 파일 (`supabase/migrations/`)
- [ ] P1-1~3 완료
- [ ] 변경 요약 PR (커밋 히스토리 + 테스트 플랜 포함)
- [ ] `docs/task.md`에 신규 Phase로 진행 내역 추가
- [ ] 잔여/추가 발견 이슈를 `docs/`에 기록

> 참고 문서: `docs/prd.md`(요구사항 원본), `docs/implementation_plan.md`, `docs/compliance_policies.md`, `README.md`
