-- (P0-3) orders / settlements 의 payment_status 컬럼 정식 정의
--
-- 문제: app.js 는 orders.payment_status / settlements.payment_status 를 읽고 쓰지만
--       db/schema.sql 에는 컬럼 정의가 없었다 (원격 DB에만 수동 추가 → 스키마 드리프트).
--
-- 조치: 두 컬럼을 마이그레이션으로 정식화한다. 코드 기본값('미수금')과 일치시키고
--       허용값을 CHECK 제약으로 고정한다. 이미 수동 추가된 운영 DB에서도 안전하도록 멱등 처리.

alter table public.orders
  add column if not exists payment_status text not null default '미수금';

alter table public.settlements
  add column if not exists payment_status text not null default '미수금';

-- CHECK 제약은 중복 추가 시 오류가 나므로 존재 여부 가드 후 추가
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_payment_status_check'
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('미수금', '수금완료'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'settlements_payment_status_check'
  ) then
    alter table public.settlements
      add constraint settlements_payment_status_check
      check (payment_status in ('미수금', '수금완료'));
  end if;
end $$;
