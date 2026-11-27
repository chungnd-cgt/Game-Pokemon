-- Bảng lưu game trên Supabase. Chạy một lần trong Supabase Dashboard → SQL Editor → New query → dán toàn bộ file → Run.
-- Chạy lại nhiều lần cũng không sao (không xoá dữ liệu đã có). Giao dịch giữa người chơi: chạy thêm supabase/trades.sql.
--
-- Mỗi tài khoản đúng 1 bản lưu (user_id là khoá chính). Bản lưu là JSON y như bản lưu trong localStorage (src/game/save.js).
-- RLS: mỗi người chỉ đọc / ghi được bản lưu của chính mình; khoá công khai (anon / publishable) nằm trong code game là an toàn.

-- ---------- Thiết bị tin cậy (xác nhận thiết bị mới bằng mã gửi qua email) ----------
-- Lần đầu đăng nhập trên một thiết bị (trình duyệt), game gửi mã 6 số tới email của tài khoản (Supabase Auth OTP); nhập
-- đúng mã thì thiết bị đó được nhớ (mã bí mật ngẫu nhiên lưu trong trình duyệt, máy chủ chỉ giữ SHA-256), lần sau không hỏi
-- nữa. Bấm link xác nhận đăng ký / đặt lại mật khẩu cũng tính là đã xác nhận email.
-- Chặn ở tầng dữ liệu theo PHIÊN đăng nhập (session_id trong JWT), không chỉ ở màn đăng nhập: phiên chưa xác nhận thì không
-- đọc / ghi bản lưu, không giao dịch, không giành quyền chơi, không vào kênh Realtime. Nên người biết mật khẩu (kể cả biết
-- email, đăng nhập thẳng qua Supabase Auth) mà không vào được hộp thư thì cũng không làm gì được với tài khoản.
--
-- CÔNG TẮC: mặc định TẮT (chạy file này không ảnh hưởng ai). Cần SMTP riêng gửi được mail tới mọi người (Gmail cũng được, không
-- cần tên miền: README mục "Gửi email (SMTP)") và mẫu email Magic Link có mã (supabase/email-templates/device-code.html).
-- Thử gửi được mail rồi mới bật:
--   update public.app_settings set value = 'true' where key = 'require_device_verification';
-- Tắt lại (vd SMTP hỏng, người chơi không nhận được mã): đổi 'true' thành 'false'.
create table if not exists public.app_settings (key text primary key, value jsonb not null);
alter table public.app_settings enable row level security; -- không ai đọc / ghi được từ game, chỉ sửa trong SQL Editor
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('require_device_verification', 'false') on conflict (key) do nothing;

create table if not exists public.trusted_devices (
  user_id      uuid not null references auth.users (id) on delete cascade,
  token_hash   text not null, -- SHA-256 (hex) của mã thiết bị, không lưu mã gốc
  device       text not null default '', -- trình duyệt (User-Agent rút gọn), để xem trong Dashboard
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  primary key (user_id, token_hash)
);
alter table public.trusted_devices enable row level security;
revoke all on public.trusted_devices from anon, authenticated;

-- Phiên đăng nhập đã xác nhận (session_id trong JWT của Supabase, giữ nguyên khi tự gia hạn token)
create table if not exists public.trusted_sessions (
  session_id uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.trusted_sessions enable row level security;
revoke all on public.trusted_sessions from anon, authenticated;

create or replace function public.device_verification_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::boolean from public.app_settings s where s.key = 'require_device_verification'), false);
$$;

-- Phiên đăng nhập hiện tại được dùng dữ liệu không (công tắc tắt: luôn được). Dùng trong RLS và các hàm của game
create or replace function public.session_trusted()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.device_verification_required()
    or exists (
      select 1 from public.trusted_sessions s
      where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid and s.user_id = auth.uid()
    );
$$;

-- Phiên này vừa chứng minh có quyền vào email (nhập mã / bấm link trong email) trong 15 phút qua (claim amr của JWT)
create or replace function public.email_verified_recently()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from jsonb_array_elements(case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end) a
    where a ->> 'method' in ('otp', 'magiclink', 'email/signup', 'recovery', 'invite', 'email_change')
      and (a ->> 'timestamp')::numeric > extract(epoch from now()) - 900
  );
$$;

-- Game gọi ngay sau khi đăng nhập (src/online/device.js). p_device_token: mã thiết bị trong trình duyệt (null nếu trình duyệt
-- chặn lưu). Trả về 'ok' (phiên được dùng dữ liệu: công tắc tắt / thiết bị đã biết / vừa xác nhận email thì nhớ luôn thiết
-- bị này) hoặc 'verify' (thiết bị lạ: game gửi mã tới email, nhập đúng thì gọi lại hàm này)
create or replace function public.device_check(p_device_token text, p_device text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  hash text;
begin
  if me is null then raise exception 'DEVICE: Chưa đăng nhập'; end if;
  if not public.device_verification_required() then return 'ok'; end if;
  if sid is null then return 'verify'; end if;
  if exists (select 1 from public.trusted_sessions s where s.session_id = sid and s.user_id = me) then return 'ok'; end if;
  hash := case when length(coalesce(p_device_token, '')) between 32 and 200
    then encode(sha256(convert_to(p_device_token, 'UTF8')), 'hex') end;
  if public.email_verified_recently() then
    -- Vừa xác nhận email: nhớ thiết bị này (mỗi tài khoản giữ tối đa 20 thiết bị dùng gần nhất)
    if hash is not null then
      insert into public.trusted_devices (user_id, token_hash, device) values (me, hash, left(coalesce(p_device, ''), 120))
      on conflict (user_id, token_hash) do update set last_used_at = now();
      delete from public.trusted_devices d
      where d.user_id = me and d.token_hash not in (
        select x.token_hash from public.trusted_devices x where x.user_id = me order by x.last_used_at desc limit 20
      );
    end if;
  elsif hash is null or not exists (select 1 from public.trusted_devices d where d.user_id = me and d.token_hash = hash) then
    return 'verify';
  else
    update public.trusted_devices d set last_used_at = now() where d.user_id = me and d.token_hash = hash;
  end if;
  insert into public.trusted_sessions (session_id, user_id) values (sid, me) on conflict (session_id) do nothing;
  if random() < 0.02 then
    delete from public.trusted_sessions where created_at < now() - interval '60 days';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.device_check(text, text) from public, anon;
grant execute on function public.device_check(text, text) to authenticated;

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
-- Chỉ phiên đăng nhập đã xác nhận thiết bị (session_trusted; công tắc tắt thì luôn được)
create policy "saves: đọc của mình" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id and (select public.session_trusted()));

drop policy if exists "saves: tạo của mình" on public.saves;
create policy "saves: tạo của mình" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id and (select public.session_trusted()));

drop policy if exists "saves: sửa của mình" on public.saves;
create policy "saves: sửa của mình" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id and (select public.session_trusted()))
  with check ((select auth.uid()) = user_id and (select public.session_trusted()));

-- Người chơi KHÔNG xoá được bản lưu: xoá rồi tạo lại thì chống gian lận (anticheat.sql) mất mốc để so. Game không bao giờ
-- xoá bản lưu trên mạng; xoá tài khoản (Dashboard) thì bản lưu tự xoá theo (on delete cascade)
drop policy if exists "saves: xoá của mình" on public.saves;
revoke delete on public.saves from anon, authenticated;

-- Mỗi lần tạo / sửa: máy chủ tự đặt version và updated_at (game không tự đặt được hai cột này)
create or replace function public.saves_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := case when tg_op = 'INSERT' then 1 else old.version + 1 end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before insert or update on public.saves
  for each row execute function public.saves_touch();
