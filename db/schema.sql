-- 1. 테이블 생성

-- 품목 테이블 (기본가 포함)
create table items (
  id           text primary key,                       -- 'potato' 등 슬러그
  category     text not null check (category in ('fresh','easy','snack','living')),
  name         text not null,
  base_price   integer not null check (base_price > 0), -- 구매자에게 노출되는 기본 판매가
  unit         text not null,
  is_available boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 차등 도매단가 테이블 (기밀 - RLS로 강력히 보호)
create table item_tiers (
  id        bigint generated always as identity primary key,
  item_id   text not null references items(id) on delete cascade,
  threshold integer not null check (threshold > 0),  -- 이 수량 이상이면
  price     integer not null check (price >= 0),     -- 이 단가 적용 (base_price보다 낮아야 함)
  unique (item_id, threshold)                        -- threshold 중복 방지 (Zod 규칙과 일치)
);

-- 구매자 테이블
create table buyers (
  id         uuid primary key default gen_random_uuid(),
  auth_uid   uuid,                                    -- 카카오 로그인(auth.users.id) 연결용
  name       text not null,                           -- '박민지 (맘공구)'
  contact    text,                                    -- 평문 저장(RLS로 보호)
  address    text,
  approval_status text not null default '대기'         -- 접속 승인 상태 (카카오 로그인 필수 승인제)
                  check (approval_status in ('대기', '승인', '차단')),
  created_at timestamptz not null default now()
);

-- 주문 테이블
create table orders (
  id         bigint generated always as identity primary key,
  buyer_id   uuid references buyers(id),
  buyer_name text not null,                            -- 기존 호환용 대표자/업체명
  item_id    text not null references items(id),
  qty        integer not null check (qty > 0),
  status     text not null default '대기'
             check (status in ('대기','승인','배송중','완료')),
  payment_status text not null default '미수금'         -- 수금 상태 (대시보드 정산 관리)
                 check (payment_status in ('미수금','수금완료')),
  time       text not null,                            -- 주문 시각 (예: '14:30')
  created_at timestamptz not null default now()
);

-- 일자별/거래처별 정산 스냅샷 (마감 시 생성)
create table settlements (
  id             bigint generated always as identity primary key,
  buyer_id       uuid references buyers(id),
  settled_date   date not null,
  total_amount   integer not null,
  detail         jsonb not null,                       -- 품목별 수량/확정단가 내역
  send_status    text not null default 'pending'
                 check (send_status in ('pending','sent','failed')),
  payment_status text not null default '미수금'         -- 수금 상태 (대시보드 정산 관리)
                 check (payment_status in ('미수금','수금완료')),
  sent_at        timestamptz,
  error_message  text,                                 -- 알림톡 발송 실패 사유
  created_at     timestamptz not null default now()
);


-- 사용자 역할 정의 테이블
create table user_roles (
  id   uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'buyer')) default 'buyer'
);

-- RLS 활성화
alter table items enable row level security;
alter table item_tiers enable row level security;
alter table buyers enable row level security;
alter table orders enable row level security;
alter table settlements enable row level security;
alter table user_roles enable row level security;

-- 2. 사용자 역할 구분을 위한 보안 헬퍼 함수
create or replace function get_my_role()
returns text
language plpgsql
security definer -- 정의자 권한으로 실행
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return 'buyer'; -- 비인증 유저는 기본적으로 buyer 역할
  end if;
  select role into v_role from public.user_roles where id = auth.uid();
  return coalesce(v_role, 'buyer');
end;
$$;

-- 3. RLS 정책 설정 (Phase 2: 역할 기반 정책)

-- user_roles 정책: 본인 역할 정보 조회 허용
create policy "Allow read own role" on user_roles
  for select using (auth.uid() = id);

create policy "Allow owner read all roles" on user_roles
  for select using (get_my_role() = 'owner');

-- items 정책: 전체 read 허용, write/delete는 owner만 허용
create policy "Allow read items for anyone" on items
  for select using (true);

create policy "Allow modify items for owner" on items
  for all using (get_my_role() = 'owner');

-- item_tiers 정책: owner만 전체 허용, 구매자(buyer)는 직접 select 차단
create policy "Allow select item_tiers for owner only" on item_tiers
  for all using (get_my_role() = 'owner');

-- buyers 정책: 본인 프로필 조회/수정 허용, owner는 전체 허용
create policy "Allow select own profile" on buyers
  for select using (auth_uid = auth.uid() or get_my_role() = 'owner');

create policy "Allow update own profile" on buyers
  for update using (auth_uid = auth.uid() or get_my_role() = 'owner');

create policy "Allow all to buyers for owner" on buyers
  for all using (get_my_role() = 'owner');

-- orders 정책: 본인 주문만 조회/수정 허용, owner는 전체 허용
create policy "Allow select orders" on orders
  for select using (buyer_id in (select id from buyers where auth_uid = auth.uid()) or get_my_role() = 'owner');

-- 발주는 로그인 + 본인 소유의 '승인'된 거래처만 가능 (접속 승인제). owner 는 아래 for all 정책으로 삽입.
create policy "Allow insert orders for approved buyer" on orders
  for insert with check (
    exists (
      select 1 from public.buyers b
      where b.id = orders.buyer_id
        and b.auth_uid = auth.uid()
        and b.approval_status = '승인'
    )
  );

create policy "Allow update/delete orders for owner" on orders
  for all using (get_my_role() = 'owner');

-- settlements 정책: 본인 정산 내역만 조회 허용, owner는 전체 허용
create policy "Allow select settlements" on settlements
  for select using (buyer_id in (select id from buyers where auth_uid = auth.uid()) or get_my_role() = 'owner');

create policy "Allow all to settlements for owner" on settlements
  for all using (get_my_role() = 'owner');

-- 사장님 계정 사전 등록 테이블
create table approved_owners (
  email text primary key,
  created_at timestamptz default now()
);

alter table approved_owners enable row level security;

create policy "Allow read approved_owners for owners" on approved_owners
  for select using (get_my_role() = 'owner');

create policy "Allow modify approved_owners for owners" on approved_owners
  for all using (get_my_role() = 'owner');

-- 4. 신규 유저 회원가입 시 자동으로 user_roles 및 buyers 프로필 추가하는 트리거 함수
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_role text := 'buyer';
begin
  -- owner 권한은 approved_owners 테이블에 사전 등록된 이메일에만 부여 (화이트리스트 방식)
  -- 주의: 이전의 like '%seung%' / 개인 이메일 하드코딩은 권한 상승 취약점이라 제거됨
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

-- 트리거 바인딩
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- 이를 통해 구매자는 item_tiers 테이블을 직접 읽지 않고도 안전하게 단가 계산 결과를 얻을 수 있습니다.
create or replace function get_buyer_tier_benefit(
  p_item_id  text,
  p_qty      integer,
  p_buyer_id uuid default null    -- 지정 시(또는 로그인 추론 시) 전용가 우선 적용
)
returns json
language plpgsql
security definer -- 정의자 권한으로 실행하여 RLS가 걸린 item_tiers / buyer_item_prices 를 읽을 수 있음
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
  -- 0. 유효 거래처 결정 (보안: owner 가 아니면 타 거래처 id 무시하고 본인으로 한정)
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


-- 4-2. 현재 로그인 사용자의 거래처 정보(승인 상태 포함) 조회 RPC
-- (마이그레이션 20260611000001_buyer_approval.sql 와 동일) — client.html 접속 게이트에서 사용.
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

-- 4-3. 거래처별 품목 전용 단가 (수량 할인 대체)
-- (마이그레이션 20260611000002_buyer_item_prices.sql 와 동일)
create table buyer_item_prices (
  id         bigint generated always as identity primary key,
  buyer_id   uuid not null references buyers(id) on delete cascade,
  item_id    text not null references items(id) on delete cascade,
  price      integer not null check (price >= 0),
  created_at timestamptz not null default now(),
  unique (buyer_id, item_id)
);

alter table buyer_item_prices enable row level security;

create policy "Allow all buyer_item_prices for owner" on buyer_item_prices
  for all using (get_my_role() = 'owner');

create policy "Allow select own buyer_item_prices" on buyer_item_prices
  for select using (
    buyer_id in (select id from buyers where auth_uid = auth.uid())
  );


-- 5. 테스트용 시드(Seed) 데이터 주입
-- 5-0. 초기 사장님(owner) 화이트리스트 등록 (handle_new_user 트리거가 참조)
insert into approved_owners (email) values
('willy0418@naver.com')
on conflict (email) do nothing;

-- 5-1. 기본 품목 추가
insert into items (id, category, name, base_price, unit, is_available) values
('potato', 'fresh', '골드 감자', 20000, '박스', true),
('garlic', 'fresh', '깐마늘 XL', 25000, 'kg', true),
('onion', 'fresh', '빨간 양파', 15000, '망', true)
on conflict (id) do nothing;

-- 5-2. 차등 도매가 할인 구간 설정
insert into item_tiers (item_id, threshold, price) values
('potato', 10, 18000),
('potato', 30, 15000),
('garlic', 20, 22000),
('onion', 50, 12000)
on conflict (item_id, threshold) do nothing;

-- 5-3. 샘플 구매자 추가
insert into buyers (id, name, contact, address, approval_status) values
('a0e829c6-6a7e-4b46-a7c5-ae4de4060ef1', '박민지 (맘공구)', '010-1234-5678', '인천 부평구', '승인'),
('b0e829c6-6a7e-4b46-a7c5-ae4de4060ef2', '최유진 (마트)', '010-8765-4321', '서울 강서구', '승인'),
('c0e829c6-6a7e-4b46-a7c5-ae4de4060ef3', '이정재 (대형유통)', '010-5555-5555', '경기 성남시', '차단')
on conflict (id) do nothing;

-- 5-4. 실시간 현황 시각화를 위한 주문 추가
insert into orders (buyer_id, buyer_name, item_id, qty, status, time) values
('a0e829c6-6a7e-4b46-a7c5-ae4de4060ef1', '박민지 (맘공구)', 'potato', 12, '승인', '10:15'),
('b0e829c6-6a7e-4b46-a7c5-ae4de4060ef2', '최유진 (마트)', 'garlic', 8, '대기', '11:30'),
('c0e829c6-6a7e-4b46-a7c5-ae4de4060ef3', '이정재 (대형유통)', 'potato', 25, '대기', '12:05')
on conflict do nothing;

