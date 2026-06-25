-- 거래처 접속 승인제 (카카오 로그인 필수 전환)
-- 배경: 사장님 요청 — 결제를 잘 안 하는 업체의 접속을 차단하고, 승인된 거래처만 발주 가능하게 한다.
--   직전(20260604000001)에 복구했던 "비로그인 즉시 발주"(submit_anonymous_order)는 폐기하고
--   "카카오 로그인 + 승인" 모델로 전환한다. (싹싹 빌면 사장님이 다시 '승인'으로 풀어줄 수 있음)

-- 1. buyers 에 승인 상태 추가 (신규 카카오 가입 기본값 '대기')
alter table buyers
  add column if not exists approval_status text not null default '대기'
    check (approval_status in ('대기', '승인', '차단'));

-- 2. 비로그인 발주 RPC 폐기 (로그인 필수 전환)
drop function if exists public.submit_anonymous_order(text, text, text, integer);

-- 3. 주문 INSERT 정책 강화: 로그인 + 본인 소유의 '승인'된 거래처만 발주 가능
--    (기존 정책은 authenticated 면 무조건 허용 → 미승인 사용자도 발주 가능했음)
--    owner 는 "Allow update/delete orders for owner"(for all) 정책으로 계속 삽입 가능.
drop policy if exists "Allow insert orders for authenticated" on orders;
create policy "Allow insert orders for approved buyer" on orders
  for insert with check (
    exists (
      select 1 from public.buyers b
      where b.id = orders.buyer_id
        and b.auth_uid = auth.uid()
        and b.approval_status = '승인'
    )
  );

-- 4. 현재 로그인 사용자의 거래처 정보(승인 상태 포함)를 안전하게 조회하는 RPC
--    client.html 의 접속 게이트(승인/대기/차단 분기)에서 사용한다.
create or replace function public.get_my_buyer()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_name    text;
  v_contact text;
  v_status  text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select id, name, contact, approval_status
    into v_id, v_name, v_contact, v_status
    from buyers
   where auth_uid = auth.uid()
   limit 1;
  if v_id is null then
    return null;
  end if;
  return json_build_object(
    'id', v_id,
    'name', v_name,
    'contact', v_contact,
    'approvalStatus', v_status
  );
end;
$$;

grant execute on function public.get_my_buyer() to authenticated;
