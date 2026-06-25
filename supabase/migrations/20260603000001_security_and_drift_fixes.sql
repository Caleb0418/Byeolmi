-- P0-3. 스키마 드리프트 해소 (payment_status 컬럼 추가)
alter table public.orders
add column if not exists payment_status text not null default '미수금' check (payment_status in ('미수금', '수금완료'));

alter table public.settlements
add column if not exists payment_status text not null default '미수금' check (payment_status in ('미수금', '수금완료'));

-- P0-1. 권한 부여 백도어 제거 (handle_new_user 트리거 함수 수정)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_role text := 'buyer';
begin
  -- approved_owners 테이블에 등록된 이메일인 경우에만 owner 부여
  if exists(select 1 from public.approved_owners where email = new.email) then
    v_role := 'owner';
  end if;

  insert into public.user_roles (id, role)
  values (new.id, v_role);

  insert into public.buyers (auth_uid, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', '신규 거래처'));

  return new;
end;
$$ language plpgsql security definer;

-- approved_owners 에 초기 사장님 1명 시드 데이터 삽입
insert into public.approved_owners (email)
values ('willy0418@naver.com')
on conflict (email) do nothing;
