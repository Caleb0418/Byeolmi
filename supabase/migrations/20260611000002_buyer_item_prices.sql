-- 업체별 전용 단가 (수량 할인 대체)
-- 배경: 사장님 요청 — 친한 업체엔 더 싸게 준다. 전용가가 설정된 거래처는
--   수량 기준 차등(item_tiers) 대신 전용가를 수량과 무관하게 고정 적용한다(= 수량할인 대체).
--   전용가가 없는 거래처는 기존 item_tiers 로직을 그대로 사용한다.

-- 1. 거래처별 품목 전용 단가 테이블
create table if not exists buyer_item_prices (
  id         bigint generated always as identity primary key,
  buyer_id   uuid not null references buyers(id) on delete cascade,
  item_id    text not null references items(id) on delete cascade,
  price      integer not null check (price >= 0),
  created_at timestamptz not null default now(),
  unique (buyer_id, item_id)
);

alter table buyer_item_prices enable row level security;

-- owner 는 전체 조회/수정 (전용가는 거래처 간 비공개 정보)
create policy "Allow all buyer_item_prices for owner" on buyer_item_prices
  for all using (get_my_role() = 'owner');

-- 본인 전용가는 본인이 조회 가능 (발주 화면 단가 표시용)
create policy "Allow select own buyer_item_prices" on buyer_item_prices
  for select using (
    buyer_id in (select id from buyers where auth_uid = auth.uid())
  );

-- ⚠️ 임시(데모): DEMO_OPEN_ACCESS 대시보드(anon)에서도 전용가가 보이도록 개방.
--   정식 전환 시 20260604000002 복원 스니펫과 함께 아래 정책도 DROP 할 것:
--     drop policy if exists "TEMP_DEMO buyer_item_prices all" on buyer_item_prices;
create policy "TEMP_DEMO buyer_item_prices all" on buyer_item_prices
  for all to anon using (true) with check (true);

-- 2. 단가 계산 RPC 확장: 전용가가 있으면 수량 티어 대신 전용가를 고정 적용한다.
--    기존 2-인자 시그니처를 제거하고 p_buyer_id(선택) 를 받는 3-인자로 교체한다.
--    p_buyer_id 미지정 시 auth.uid() 로 본인 거래처를 추론한다.
drop function if exists get_buyer_tier_benefit(text, integer);
create or replace function get_buyer_tier_benefit(
  p_item_id  text,
  p_qty      integer,
  p_buyer_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_price integer;
  v_unit text;
  v_current_unit_price integer;
  v_current_total integer;
  v_base_total integer;
  v_saved_amount integer;
  v_current_threshold integer := 0;
  v_current_tier_price integer := 0;
  v_next_threshold integer := 0;
  v_next_price integer := 0;
  v_remaining_qty integer := 0;
  v_next_savings_per_unit integer := 0;
  v_has_tiers boolean := false;
  v_item_exists boolean := false;
  v_buyer_id uuid;
  v_custom_price integer;
begin
  -- 0. 유효 거래처 결정 (보안: owner 가 아니면 타 거래처 id 를 무시하고 본인으로 한정)
  if p_buyer_id is not null then
    if get_my_role() = 'owner'
       or exists (select 1 from buyers where id = p_buyer_id and auth_uid = auth.uid()) then
      v_buyer_id := p_buyer_id;
    end if;
  end if;
  if v_buyer_id is null then
    select id into v_buyer_id from buyers where auth_uid = auth.uid() limit 1;
  end if;

  -- 1. 기본 품목 정보 조회
  select base_price, unit, true
    into v_base_price, v_unit, v_item_exists
    from items
   where id = p_item_id;

  if not v_item_exists then
    return null;
  end if;

  -- 1-5. 전용가 우선: 전용가가 있으면 수량 티어를 무시하고 고정 적용
  if v_buyer_id is not null then
    select price into v_custom_price
      from buyer_item_prices
     where buyer_id = v_buyer_id and item_id = p_item_id;
  end if;

  if v_custom_price is not null then
    v_current_unit_price := v_custom_price;
    v_current_total := p_qty * v_current_unit_price;
    v_base_total := p_qty * v_base_price;
    v_saved_amount := v_base_total - v_current_total;
    return json_build_object(
      'basePrice', v_base_price,
      'currentUnitPrice', v_current_unit_price,
      'currentTotal', v_current_total,
      'savedAmount', v_saved_amount,
      'currentTier', null,
      'nextTier', null,
      'remainingQty', 0,
      'nextPrice', 0,
      'nextSavingsPerUnit', 0,
      'hasTiers', false,
      'isCustomPrice', true
    );
  end if;

  -- 2. Tiers 존재 여부 체크
  select exists(select 1 from item_tiers where item_id = p_item_id) into v_has_tiers;

  -- 3. 현재 적용 단가 계산 (가장 큰 threshold <= p_qty 인 tier 조회)
  v_current_unit_price := v_base_price;
  if v_has_tiers then
    select price, threshold
      into v_current_tier_price, v_current_threshold
      from item_tiers
     where item_id = p_item_id and threshold <= p_qty
     order by threshold desc
     limit 1;

    if v_current_tier_price is not null then
      v_current_unit_price := v_current_tier_price;
    else
      v_current_threshold := 0;
    end if;
  end if;

  v_current_total := p_qty * v_current_unit_price;
  v_base_total := p_qty * v_base_price;
  v_saved_amount := v_base_total - v_current_total;

  -- 4. 다음 할인 구간 조회 (가장 작은 threshold > p_qty 인 tier 조회)
  if v_has_tiers then
    select threshold, price
      into v_next_threshold, v_next_price
      from item_tiers
     where item_id = p_item_id and threshold > p_qty
     order by threshold asc
     limit 1;

    if v_next_threshold is not null then
      v_remaining_qty := v_next_threshold - p_qty;
      v_next_savings_per_unit := v_current_unit_price - v_next_price;
    end if;
  end if;

  return json_build_object(
    'basePrice', v_base_price,
    'currentUnitPrice', v_current_unit_price,
    'currentTotal', v_current_total,
    'savedAmount', v_saved_amount,
    'currentTier', case when v_current_threshold > 0 then json_build_object('threshold', v_current_threshold, 'price', v_current_unit_price) else null end,
    'nextTier', case when v_next_threshold > 0 then json_build_object('threshold', v_next_threshold, 'price', v_next_price) else null end,
    'remainingQty', v_remaining_qty,
    'nextPrice', v_next_price,
    'nextSavingsPerUnit', v_next_savings_per_unit,
    'hasTiers', v_has_tiers,
    'isCustomPrice', false
  );
end;
$$;

grant execute on function get_buyer_tier_benefit(text, integer, uuid) to anon, authenticated;
