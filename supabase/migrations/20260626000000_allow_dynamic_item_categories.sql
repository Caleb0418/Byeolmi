-- Allow owner-defined item category labels instead of the initial fixed category set.
alter table public.items drop constraint if exists items_category_check;
alter table public.items drop constraint if exists items_category_not_empty;
alter table public.items add constraint items_category_not_empty check (length(btrim(category)) > 0);