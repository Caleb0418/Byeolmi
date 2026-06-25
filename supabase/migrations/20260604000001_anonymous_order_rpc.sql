-- (UX/P0) 비로그인 즉시 발주 지원
-- 배경: client.html 은 "로그인 없이 즉시 발주"가 제품 결정이나,
--   orders/buyers 의 INSERT 정책이 auth.role()='authenticated' 를 요구해
--   익명 발주가 RLS 로 100% 차단되었다(POST /orders → 401, "row-level security policy").
-- 해결: 테이블을 직접 열지 않고, 검증된 단일 진입점(SECURITY DEFINER RPC)만 anon 에 노출한다.
--   - buyers/orders 의 SELECT 정책은 그대로 잠가 두어 거래처 enumeration·연락처 유출을 방지
--   - 거래처명(name) 기준 dedupe 로 익명 발주의 중복 buyer 생성을 차단
--   - 품목 유효성·수량 검증을 서버에서 강제 (클라이언트 검증 우회 방지)

create or replace function public.submit_anonymous_order(
  p_buyer_name text,
  p_contact    text,
  p_item_id    text,
  p_qty        integer
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_order_id bigint;
  v_name     text := nullif(trim(p_buyer_name), '');
  v_contact  text := nullif(trim(coalesce(p_contact, '')), '');
begin
  -- 입력 검증 (시스템 경계)
  if v_name is null then
    raise exception '거래처명(대표자/업체명)이 필요합니다.';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception '발주 수량은 1 이상이어야 합니다.';
  end if;
  if not exists (select 1 from items where id = p_item_id and is_available) then
    raise exception '판매 중인 품목이 아닙니다.';
  end if;

  -- 거래처 upsert (이름 기준 dedupe)
  select id into v_buyer_id from buyers where name = v_name limit 1;
  if v_buyer_id is null then
    insert into buyers (name, contact) values (v_name, v_contact)
    returning id into v_buyer_id;
  elsif v_contact is not null then
    update buyers
       set contact = v_contact
     where id = v_buyer_id
       and (contact is null or contact = '');
  end if;

  -- 주문 생성 (대기 상태)
  insert into orders (buyer_id, buyer_name, item_id, qty, status, time)
  values (
    v_buyer_id, v_name, p_item_id, p_qty, '대기',
    to_char(now() at time zone 'Asia/Seoul', 'HH24:MI')
  )
  returning id into v_order_id;

  return v_order_id;
end;
$$;

-- anon/authenticated 모두 호출 가능 (구매자 발주 진입점)
grant execute on function public.submit_anonymous_order(text, text, text, integer) to anon, authenticated;
