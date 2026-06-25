-- (P0-1) 회원가입 트리거 owner 권한 백도어 제거
--
-- 문제: 기존 handle_new_user()는 다음 조건으로 owner 권한을 부여했다.
--   new.email = 'willy0418@naver.com'
--   or new.email = 'seung@example.com'
--   or new.email like '%seung%'           <-- 'seung'이 포함된 임의 이메일이면 누구나 owner (권한 상승 취약점)
--   or exists(... approved_owners ...)
--
-- 조치: owner 권한은 approved_owners 테이블에 사전 등록된 이메일에만 부여한다.
--       와일드카드 매칭 및 개인 이메일 하드코딩을 전면 제거한다.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_role text := 'buyer';
begin
  -- owner 권한은 approved_owners 에 사전 등록된 이메일에만 부여 (화이트리스트 방식)
  if exists (select 1 from public.approved_owners where email = new.email) then
    v_role := 'owner';
  end if;

  insert into public.user_roles (id, role)
  values (new.id, v_role);

  insert into public.buyers (auth_uid, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', '신규 거래처'));

  return new;
end;
$$ language plpgsql security definer;

-- 초기 사장님 1명 시드 (기존 운영 owner 이메일). 필요 시 대시보드에서 추가 관리.
insert into public.approved_owners (email)
values ('willy0418@naver.com')
on conflict (email) do nothing;
