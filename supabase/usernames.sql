-- Tên đăng nhập: đăng ký nhập tên đăng nhập + email + mật khẩu, đăng nhập bằng tên đăng nhập + mật khẩu.
-- Supabase Auth chỉ đăng nhập được bằng email, nên game gọi login_email(tên, mật khẩu): đúng mật khẩu thì trả về email để
-- đăng nhập Supabase như thường (src/online/account.js). Sai tên / sai mật khẩu đều chỉ trả null: người lạ không lấy được
-- email của người khác từ tên đăng nhập.
-- Chạy sau schema.sql (SQL Editor → dán → Run). Chạy lại nhiều lần không sao.
--
-- Quy tắc tên (giống src/online/username.js): bỏ khoảng trắng 2 đầu; 1-18 ký tự; chỉ chữ cái không dấu và số (không khoảng
-- trắng, ký tự đặc biệt, biểu tượng); chữ cái đầu tự viết hoa. Không trùng, không phân biệt hoa thường (Chung = chung).
-- Tài khoản đăng ký mà không xác nhận email sau 1 ngày thì tên được nhả ra cho người khác dùng.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Z0-9][A-Za-z0-9]{0,17}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

alter table public.profiles enable row level security;
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Đếm lần nhập sai để chống dò mật khẩu qua login_email (hàm này không đi qua giới hạn của Supabase Auth)
create table if not exists public.login_failures (
  id bigserial primary key,
  name_key text not null,
  at timestamptz not null default now()
);
create index if not exists login_failures_name_at on public.login_failures (name_key, at);
create index if not exists login_failures_at on public.login_failures (at);
alter table public.login_failures enable row level security;
revoke all on public.login_failures from anon, authenticated;

-- Chuẩn hoá tên: bỏ khoảng trắng 2 đầu, viết hoa chữ cái đầu. Sai quy tắc thì null
create or replace function public.normalize_username(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text := regexp_replace(coalesce(p_name, ''), '^\s+|\s+$', '', 'g');
begin
  if s !~ '^[A-Za-z0-9]{1,18}$' then
    return null;
  end if;
  return upper(left(s, 1)) || substr(s, 2);
end;
$$;

-- Tên của tài khoản chưa xác nhận email quá 1 ngày: nhả ra
create or replace function public.free_stale_username(p_name text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.profiles p
  using auth.users u
  where u.id = p.user_id and lower(p.username) = lower(p_name)
    and u.email_confirmed_at is null and u.created_at < now() - interval '1 day';
$$;
revoke execute on function public.free_stale_username(text) from public, anon, authenticated;

-- Trước khi đăng ký: 'ok' | 'taken' (đã có người dùng) | 'invalid' (sai quy tắc)
create or replace function public.username_available(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := public.normalize_username(p_name);
begin
  if name is null then
    return 'invalid';
  end if;
  perform public.free_stale_username(name);
  if exists (select 1 from public.profiles where lower(username) = lower(name)) then
    return 'taken';
  end if;
  return 'ok';
end;
$$;
revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Đăng ký (signUp gửi kèm data.username): tạo dòng profiles. Tên sai quy tắc / đã có người dùng thì huỷ đăng ký
-- (Supabase báo "Database error saving new user"). Đăng ký lại bằng email chưa xác nhận: đổi theo tên mới.
-- Không có username (vd tạo tài khoản trong Dashboard) thì bỏ qua. Người chơi tự sửa user_metadata sau khi đã xác nhận
-- email (supabase.auth.updateUser) thì không đổi được tên ở đây
create or replace function public.handle_user_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text := new.raw_user_meta_data ->> 'username';
  name text := public.normalize_username(raw);
begin
  if raw is null or (tg_op = 'UPDATE' and new.email_confirmed_at is not null) then
    return new;
  end if;
  if name is null then
    raise exception 'USERNAME: Tên đăng nhập không hợp lệ';
  end if;
  perform pg_advisory_xact_lock(hashtext('username:' || lower(name)));
  perform public.free_stale_username(name);
  if exists (select 1 from public.profiles where lower(username) = lower(name) and user_id <> new.id) then
    raise exception 'USERNAME: Tên đăng nhập đã có người dùng';
  end if;
  insert into public.profiles (user_id, username) values (new.id, name)
  on conflict (user_id) do update set username = excluded.username;
  return new;
end;
$$;
revoke execute on function public.handle_user_username() from public, anon, authenticated;

drop trigger if exists on_auth_user_username on auth.users;
create trigger on_auth_user_username
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.handle_user_username();

-- Đăng nhập bằng tên: đúng tên + mật khẩu thì trả về email (game đăng nhập Supabase bằng email đó), sai thì null.
-- Sai quá 10 lần / 15 phút cho một tên: báo LOGIN_LOCKED; cả máy chủ bị dò quá 300 lần / phút: LOGIN_BUSY
create or replace function public.login_email(p_name text, p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := public.normalize_username(p_name);
  key text;
  em text;
  hash text;
begin
  if name is null or coalesce(p_password, '') = '' then
    return null;
  end if;
  key := lower(name);
  perform pg_advisory_xact_lock(hashtext('login:' || key));
  if (select count(*) from public.login_failures where name_key = key and at > now() - interval '15 minutes') >= 10 then
    raise exception 'LOGIN_LOCKED: Sai quá nhiều lần, thử lại sau 15 phút';
  end if;
  if (select count(*) from public.login_failures where at > now() - interval '1 minute') >= 300 then
    raise exception 'LOGIN_BUSY: Máy chủ đang bận, thử lại sau ít phút';
  end if;
  select u.email, u.encrypted_password into em, hash
  from public.profiles p join auth.users u on u.id = p.user_id
  where lower(p.username) = key;
  if hash is not null and hash <> '' and extensions.crypt(p_password, hash) = hash then
    delete from public.login_failures where name_key = key;
    return em;
  end if;
  insert into public.login_failures (name_key) values (key);
  -- Dọn bớt dòng cũ (thỉnh thoảng)
  if random() < 0.02 then
    delete from public.login_failures where at < now() - interval '1 day';
  end if;
  return null;
end;
$$;
revoke execute on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;
