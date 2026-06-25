# Supabase 마이그레이션

본 디렉토리는 운영 DB의 스키마 변경 이력을 추적하는 **단일 진실원(source of truth)** 입니다.
이전에는 `db/schema.sql` 하나로만 관리되어 변경 이력이 추적되지 않았고, 일부 컬럼(`payment_status`)이
원격 DB에만 수동으로 추가되어 코드와 스키마가 어긋나는 문제(drift)가 있었습니다.

## 적용 방법

```bash
# 로컬/원격 적용 (Supabase CLI)
supabase db push          # 원격에 미적용 마이그레이션 반영
supabase migration list   # 적용 상태 확인
```

## 파일 규칙

- 파일명: `<타임스탬프>_<설명>.sql` (타임스탬프 오름차순으로 순차 적용)
- 모든 마이그레이션은 **멱등(idempotent)** 하게 작성한다 (`if not exists`, 가드 블록 사용).
  운영 DB에 이미 수동 반영된 변경이 있어도 안전하게 재적용되도록 한다.

## 이력

| 파일 | 내용 |
|------|------|
| `20260603000001_fix_owner_role_backdoor.sql` | (P0-1) 회원가입 트리거의 owner 권한 백도어 제거 — `approved_owners` 등록 이메일만 owner |
| `20260603000002_add_payment_status.sql` | (P0-3) `orders`/`settlements`에 `payment_status` 컬럼 정식 정의 (코드와 정합) |

> `db/schema.sql`은 위 변경이 반영된 **신규 환경용 전체 스냅샷**으로 유지됩니다.
> 이미 배포된 운영 DB에는 위 마이그레이션을 순차 적용하십시오.
