-- Bảng lưu game trên Supabase. Chạy một lần trong Supabase Dashboard → SQL Editor → New query → dán toàn bộ file → Run.
-- Chạy lại nhiều lần cũng không sao (không xoá dữ liệu đã có).
--
-- Mỗi tài khoản đúng 1 bản lưu (user_id là khoá chính). Bản lưu là JSON y như bản lưu trong localStorage (src/game/save.js).
-- RLS: mỗi người chỉ đọc / ghi được bản lưu của chính mình; khoá công khai (anon / publishable) nằm trong code game là an toàn.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  -- Tăng 1 mỗi lần ghi (trigger bên dưới). Game ghi kèm điều kiện version = bản đã đọc: máy khác đã ghi mới hơn thì
  -- lần ghi này không khớp dòng nào, game biết là bị lệch và hỏi người chơi giữ bản nào
  version    integer not null default 1,
  play_time  integer not null default 0, -- giây, để hiện ở màn hình chính mà không cần tải cả bản lưu
  updated_at timestamptz not null default now(),
  -- Chặn bản lưu bất thường (bản lưu thật chỉ vài chục KB)
  constraint saves_data_size check (octet_length(data::text) < 2000000)
);

alter table public.saves enable row level security;

drop policy if exists "saves: đọc của mình" on public.saves;
create policy "saves: đọc của mình" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "saves: tạo của mình" on public.saves;
create policy "saves: tạo của mình" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "saves: sửa của mình" on public.saves;
create policy "saves: sửa của mình" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "saves: xoá của mình" on public.saves;
create policy "saves: xoá của mình" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Mỗi lần sửa: tự tăng version và cập nhật updated_at (game không tự đặt được hai cột này)
create or replace function public.saves_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before update on public.saves
  for each row execute function public.saves_touch();
