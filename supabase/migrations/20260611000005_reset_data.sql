-- 시스템 설정 '초기화' 탭: 선택 항목/전체 데이터 초기화 RPC
-- 배경: 사장님이 시연/운영 전 데이터를 비울 수 있게 한다. 되돌릴 수 없는 작업이므로 클라이언트에서 2중 확인.
-- 의존성(FK): settlements/orders/buyer_item_prices 는 buyers·items 를 참조한다.
--   따라서 거래처(buyers) 삭제 시 → 발주·정산·전용가 선행 삭제, 품목(items) 삭제 시 → 발주·전용가·티어 선행 삭제.
--   아래에서 각 플래그를 의존성에 맞게 확장한 뒤 자식→부모 순서로 삭제한다.
-- 주의: 사장님 계정(approved_owners/user_roles)·계좌 설정(app_settings)은 건드리지 않는다.

create or replace function public.reset_data(
  p_orders      boolean default false,  -- 발주 내역
  p_settlements boolean default false,  -- 정산 내역
  p_prices      boolean default false,  -- 업체 전용 단가
  p_buyers      boolean default false,  -- 거래처(+의존 데이터)
  p_items       boolean default false   -- 품목(+의존 데이터)
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  del_settlements boolean := p_settlements or p_buyers;
  del_orders      boolean := p_orders or p_buyers or p_items;
  del_prices      boolean := p_prices or p_buyers or p_items;
  del_tiers       boolean := p_items;
  del_buyers      boolean := p_buyers;
  del_items       boolean := p_items;
begin
  -- 자식 → 부모 순서로 삭제(FK 안전)
  if del_settlements then delete from settlements; end if;
  if del_orders      then delete from orders; end if;
  if del_prices      then delete from buyer_item_prices; end if;
  if del_tiers       then delete from item_tiers; end if;
  if del_buyers      then delete from buyers; end if;
  if del_items       then delete from items; end if;

  return json_build_object(
    'settlements', del_settlements,
    'orders',      del_orders,
    'prices',      del_prices,
    'tiers',       del_tiers,
    'buyers',      del_buyers,
    'items',       del_items
  );
end;
$$;

-- 데모 대시보드(anon)에서도 사장님이 사용 가능하도록 grant. 정식 전환 시 owner 게이트 검토.
grant execute on function public.reset_data(boolean, boolean, boolean, boolean, boolean) to anon, authenticated;
