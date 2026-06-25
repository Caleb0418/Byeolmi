-- 구매자가 본인 미승인 주문만 취소할 수 있는 RPC
create or replace function public.cancel_my_pending_order(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders o
     set status = '취소됨'
   where o.id = p_order_id
     and o.status = '대기'
     and exists (
       select 1
         from public.buyers b
        where b.id = o.buyer_id
          and b.auth_uid = auth.uid()
     );

  if not found then
    raise exception '취소 가능한 승인 전 주문을 찾지 못했습니다.';
  end if;
end;
$$;

grant execute on function public.cancel_my_pending_order(bigint) to authenticated;
