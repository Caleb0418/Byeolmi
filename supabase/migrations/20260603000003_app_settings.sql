-- (P3-3) 운영 설정(계좌/상호) 분리 — 하드코딩 제거를 위한 키-값 설정 테이블
-- 계좌 정보는 구매자(비인증)도 보는 명세서에 노출되므로 read 는 전체 허용, write 는 owner 만 허용한다.

create table if not exists public.app_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_settings' and policyname='Allow read settings for anyone') then
    create policy "Allow read settings for anyone" on public.app_settings
      for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='app_settings' and policyname='Allow write settings for owner') then
    create policy "Allow write settings for owner" on public.app_settings
      for all using (get_my_role() = 'owner') with check (get_my_role() = 'owner');
  end if;
end $$;

-- 기존 하드코딩 값과 동일한 기본값 시드 (적용 직후 화면 변화 없음, 이후 사장님이 대시보드에서 변경)
insert into public.app_settings (key, value) values
  ('business_name',  '별미집'),
  ('bank_name',      '국민은행'),
  ('account_number', '646801-01-557728'),
  ('account_holder', '김봉준(우모유통)')
on conflict (key) do nothing;
