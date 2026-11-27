-- Mỗi tài khoản chỉ chơi ở MỘT nơi (một thiết bị, một tab) cùng lúc. Chạy SAU schema.sql: SQL Editor → dán toàn bộ → Run
-- (chạy lại được).
--
-- Mỗi lần vào game, tab đó nhận một mã phiên mới (claim_session). Đăng nhập bằng mật khẩu thì giành quyền khỏi mọi nơi
-- khác; tải lại trang / nhân bản tab (phiên đăng nhập còn trong tab) thì chỉ giành được khi tab đó vẫn đang giữ quyền.
-- Nơi bị giành quyền tự dừng game (src/online/session.js) và máy chủ không nhận bản lưu của nó nữa: bản lưu gửi lên mang
-- mã phiên (data.claim), khác mã đang giữ quyền thì bị từ chối (trigger saves_session_guard).

create table if not exists public.player_sessions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  session_id uuid not null,
  device     text not null default '',
  claimed_at timestamptz not null default now()
);
alter table public.player_sessions enable row level security;
revoke all on public.player_sessions from anon, authenticated;
grant select on public.player_sessions to authenticated;
drop policy if exists "player_sessions: đọc của mình" on public.player_sessions;
create policy "player_sessions: đọc của mình" on public.player_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

-- p_previous: null = vừa đăng nhập bằng mật khẩu (giành luôn); có giá trị = mã phiên cũ của tab này (chỉ đổi được khi
-- mã đó vẫn đang giữ quyền). Trả về 'ok' hoặc 'taken' (nơi khác đã đăng nhập sau: phải đăng nhập lại)
create or replace function public.claim_session(p_session uuid, p_previous uuid, p_device text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'SESSION: Chưa đăng nhập'; end if;
  -- Phiên chưa xác nhận thiết bị (schema.sql) không được giành quyền chơi (không đá được người đang chơi ra)
  if not public.session_trusted() then raise exception 'SESSION: DEVICE: Thiết bị này chưa được xác nhận'; end if;
  if p_session is null then raise exception 'SESSION: Thiếu mã phiên'; end if;
  perform pg_advisory_xact_lock(hashtext('claim_session:' || me::text));
  if p_previous is not null and exists (
    select 1 from public.player_sessions where user_id = me and session_id <> p_previous
  ) then
    return 'taken';
  end if;
  insert into public.player_sessions (user_id, session_id, device, claimed_at)
  values (me, p_session, left(coalesce(p_device, ''), 120), now())
  on conflict (user_id) do update
    set session_id = excluded.session_id, device = excluded.device, claimed_at = excluded.claimed_at;
  return 'ok';
end;
$$;
revoke all on function public.claim_session(uuid, uuid, text) from public, anon;
grant execute on function public.claim_session(uuid, uuid, text) to authenticated;

-- Bản lưu do người chơi gửi lên (auth.uid() có giá trị) phải mang đúng mã phiên đang giữ quyền.
-- Sửa tay trong Dashboard / SQL Editor (auth.uid() rỗng) thì không kiểm tra
create or replace function public.saves_session_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_session uuid;
begin
  if auth.uid() is null then return new; end if;
  select session_id into current_session from public.player_sessions where user_id = new.user_id;
  if current_session is not null and (new.data ->> 'claim') is distinct from current_session::text then
    raise exception 'SESSION: Tài khoản đang được chơi ở nơi khác' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists saves_session_guard on public.saves;
create trigger saves_session_guard before insert or update on public.saves
  for each row execute function public.saves_session_guard();
