-- 거래처 식별성 강화: 업체명(사장님 입력) + 카카오 식별정보 노출
-- 배경: 사장님 요청 — 접속 승인 대기 화면에서 누가 요청했는지 카카오 식별값(닉네임/고유ID)을
--   보고, 거래처별로 업체명을 직접 붙일 수 있게 한다.
--   (카카오는 email 스코프 미사용이라 이메일은 없음. 닉네임 = buyers.name, 고유ID = auth.identities.provider_id)

-- 1. 업체명 컬럼 (사장님이 직접 지정. 비우면 카카오 닉네임으로 표시)
alter table buyers add column if not exists company_name text;

-- 2. 거래처 계정 목록 RPC (카카오 식별정보 포함)
--    auth.identities 는 PostgREST 로 직접 못 읽으므로 SECURITY DEFINER 로 조인해 노출한다.
--    승인 대기 → 승인 → 차단 순으로 정렬해 대기 건이 위로 오게 한다.
create or replace function public.get_buyer_accounts()
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_result json;
begin
  select coalesce(json_agg(t), '[]'::json) into v_result
  from (
    select
      b.id,
      b.name,
      b.company_name,
      b.contact,
      b.approval_status,
      (b.auth_uid is not null) as is_kakao,
      (select i.provider_id
         from auth.identities i
        where i.user_id = b.auth_uid and i.provider = 'kakao'
        limit 1) as kakao_id
    from public.buyers b
    order by
      case b.approval_status when '대기' then 0 when '승인' then 1 else 2 end,
      b.created_at desc
  ) t;
  return v_result;
end;
$$;

-- 데모 대시보드(anon)에서도 보이도록 grant. 정식 전환 시 owner 게이트로 제한 검토.
grant execute on function public.get_buyer_accounts() to anon, authenticated;
