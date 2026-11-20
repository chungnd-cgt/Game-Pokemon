-- Nhật ký lỗi JavaScript của người chơi (src/online/errorLog.js gửi lên), để biết game lỗi ở đâu trên máy người khác.
-- Chạy SAU schema.sql: Supabase SQL Editor → dán toàn bộ → Run (chạy lại được).
--
-- Người chơi chỉ GỬI được (qua hàm log_client_error), không ai đọc được qua API. Xem lỗi trong Dashboard:
--   Table Editor → client_errors, hoặc SQL Editor:  select * from public.client_errors_summary;
-- Chống spam: cùng một lỗi (cùng người, cùng nội dung) trong 1 giờ chỉ tăng số lần; mỗi người tối đa 30 dòng / giờ;
-- người chưa đăng nhập (màn hình chính) chung nhau tối đa 200 dòng / giờ; cả bảng tối đa 2000 dòng / giờ; tự xoá sau 30 ngày.

create table if not exists public.client_errors (
  id         bigserial primary key,
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null default 'error',  -- error | rejection | console
  message    text not null,
  stack      text,
  context    jsonb not null default '{}',    -- bản đồ, cảnh, trình duyệt, cỡ màn hình, phiên bản game...
  count      integer not null default 1,     -- số lần lặp lại (gộp)
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now()
);
create index if not exists client_errors_created_idx on public.client_errors (created_at);
create index if not exists client_errors_user_idx on public.client_errors (user_id, created_at);

-- Bật RLS, không có policy nào: anon / authenticated không đọc / ghi thẳng được bảng
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

create or replace function public.log_client_error(p_kind text, p_message text, p_stack text, p_context jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := auth.uid();
  msg  text := left(coalesce(nullif(trim(p_message), ''), '(không có nội dung)'), 500);
  ctx  jsonb := case when jsonb_typeof(p_context) = 'object' and octet_length(p_context::text) <= 2000 then p_context else '{}'::jsonb end;
  kind text := case when p_kind in ('error', 'rejection', 'console') then p_kind else 'error' end;
begin
  -- Gộp lỗi lặp lại
  update public.client_errors set count = count + 1, last_at = now()
  where id = (
    select id from public.client_errors
    where user_id is not distinct from me and message = msg and created_at > now() - interval '1 hour'
    order by id desc limit 1
  );
  if found then return; end if;

  if (select count(*) from public.client_errors where created_at > now() - interval '1 hour') >= 2000 then return; end if;
  if me is null then
    if (select count(*) from public.client_errors where user_id is null and created_at > now() - interval '1 hour') >= 200 then return; end if;
  elsif (select count(*) from public.client_errors where user_id = me and created_at > now() - interval '1 hour') >= 30 then
    return;
  end if;

  insert into public.client_errors (user_id, kind, message, stack, context)
  values (me, kind, msg, left(p_stack, 4000), ctx);

  -- Dọn lỗi cũ (thỉnh thoảng)
  if random() < 0.02 then
    delete from public.client_errors where last_at < now() - interval '30 days';
  end if;
end;
$$;
revoke all on function public.log_client_error(text, text, text, jsonb) from public;
grant execute on function public.log_client_error(text, text, text, jsonb) to anon, authenticated;

-- Tổng hợp để xem nhanh (chỉ xem được trong Dashboard / SQL Editor)
create or replace view public.client_errors_summary with (security_invoker = true) as
select
  message,
  sum(count)::int                  as times,
  count(distinct user_id)::int     as players,
  max(last_at)                     as last_seen,
  (array_agg(context order by last_at desc))[1] as last_context,
  (array_agg(stack order by last_at desc))[1]   as last_stack
from public.client_errors
group by message
order by max(last_at) desc;
revoke all on public.client_errors_summary from anon, authenticated;
