-- 삭제된 거래처 재등록 동선: 로그인 시 거래처 정보가 없으면 '대기' 상태로 재생성
-- 배경: 거래처를 삭제하면 buyers 행이 사라져 접속 승인도 회수된다(정상). 그러나 그 사람이
--   다시 카카오 로그인해도 buyers 행은 '최초 가입' 트리거에서만 생기므로 재로그인 시엔 안 생긴다.
--   → 사장님 거래처 관리 탭에 다시 뜨지 않아 재승인이 불가했다.
--   본 RPC는 로그인 사용자의 거래처가 없으면 카카오 닉네임으로 '대기' 상태로 재생성해,
--   거래처 관리 탭에 다시 노출되어 승인/차단을 고를 수 있게 한다.
-- 보안: 거래처 본인은 RLS상 buyers INSERT 정책이 없으므로 SECURITY DEFINER 로 처리한다.

create or replace function public.ensure_my_buyer()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id      uuid;
  v_name    text;
  v_contact text;
  v_status  text;
  v_meta_name text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select id, name, contact, approval_status
    into v_id, v_name, v_contact, v_status
    from buyers
   where auth_uid = auth.uid()
   limit 1;

  -- 거래처 정보가 없으면(삭제됨/트리거 누락) 카카오 닉네임으로 '대기' 상태 재생성
  if v_id is null then
    select coalesce(raw_user_meta_data->>'name', raw_user_meta_data->>'nickname', '신규 거래처')
      into v_meta_name
      from auth.users
     where id = auth.uid();

    insert into buyers (auth_uid, name, approval_status)
    values (auth.uid(), coalesce(v_meta_name, '신규 거래처'), '대기')
    returning id, name, contact, approval_status
      into v_id, v_name, v_contact, v_status;
  end if;

  return json_build_object(
    'id', v_id,
    'name', v_name,
    'contact', v_contact,
    'approvalStatus', v_status
  );
end;
$$;

grant execute on function public.ensure_my_buyer() to authenticated;
