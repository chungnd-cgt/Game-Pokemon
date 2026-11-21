-- Giờ máy chủ cho Khu Safari (src/online/serverClock.js): vé / gói Safari tính theo giờ này, không theo đồng hồ máy người chơi
-- (chỉnh giờ máy không kéo dài được vé). Chạy trong SQL Editor (dán → Run). Chạy lại nhiều lần không sao.

create or replace function public.server_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke execute on function public.server_now() from public;
grant execute on function public.server_now() to anon, authenticated;
