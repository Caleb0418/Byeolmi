-- 주문 취소 상태 지원
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
add constraint orders_status_check
check (status in ('대기','승인','배송중','완료','취소됨'));
