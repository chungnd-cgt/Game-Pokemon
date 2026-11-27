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
-- IP người gửi (request_ip), null nếu không biết. Bản đầu của bảng chưa có cột này (chạy lại file là thêm)
alter table public.login_failures add column if not exists ip text;
create index if not exists login_failures_name_at on public.login_failures (name_key, at);
create index if not exists login_failures_ip_at on public.login_failures (ip, at);
create index if not exists login_failures_at on public.login_failures (at);
alter table public.login_failures enable row level security;
revoke all on public.login_failures from anon, authenticated;

-- IP của người đang gọi API (PostgREST đưa header vào setting request.headers). Ưu tiên cf-connecting-ip (Cloudflare đứng
-- trước Supabase ghi đè header này nên người gọi không tự đặt được); không có thì lấy IP đầu trong x-forwarded-for — cái
-- này người gọi tự giả được, nên chỉ dùng để giới hạn, không dùng để tin ai. Không có header (SQL Editor): null
create or replace function public.request_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(trim(coalesce(h ->> 'cf-connecting-ip', split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1))), '')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) x;
$$;
revoke all on function public.request_ip() from public, anon, authenticated;

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

-- ---------- Chặn email rác (email tạm thời / dùng một lần) ----------
-- Đăng ký (hoặc đổi email) bằng email thuộc tên miền trong danh sách thì bị từ chối ngay trong database (trigger trên
-- auth.users: gọi thẳng Supabase Auth cũng không lách được). Game hỏi trước (email_allowed) để báo "Email không hợp lệ."
-- Chặn cả tên miền con (vd x.mailinator.com). Tài khoản đã có từ trước không bị ảnh hưởng.
-- Thêm / bỏ tên miền trong SQL Editor (không cần build lại game):
--   insert into public.blocked_email_domains (domain) values ('ten-mien-rac.com') on conflict do nothing;
--   delete from public.blocked_email_domains where domain = 'ten-mien-rac.com';
-- (Chạy lại file này thì các tên miền mặc định bên dưới được thêm lại nếu đã xoá; tên miền tự thêm vẫn giữ.)
create table if not exists public.blocked_email_domains (
  domain     text primary key check (domain = lower(domain) and domain !~ '[@\s]'),
  created_at timestamptz not null default now()
);
alter table public.blocked_email_domains enable row level security;
revoke all on public.blocked_email_domains from anon, authenticated;

insert into public.blocked_email_domains (domain) values
  -- Tên miền dành riêng cho ví dụ / thử (RFC 2606): không có hộp thư thật
  ('example.com'), ('example.net'), ('example.org'),
  -- Mailinator
  ('mailinator.com'), ('mailinator.net'), ('mailinator.org'), ('mailinator2.com'),
  -- Guerrilla Mail
  ('guerrillamail.com'), ('guerrillamail.net'), ('guerrillamail.org'), ('guerrillamail.biz'), ('guerrillamail.de'),
  ('guerrillamail.info'), ('guerrillamailblock.com'), ('sharklasers.com'), ('grr.la'), ('pokemail.net'), ('spam4.me'),
  -- 10 Minute Mail và tương tự
  ('10minutemail.com'), ('10minutemail.net'), ('10minutemail.co.uk'), ('20minutemail.com'), ('minuteinbox.com'),
  -- Temp Mail và tương tự
  ('temp-mail.org'), ('temp-mail.io'), ('tempmail.com'), ('tempmail.net'), ('tempmailo.com'), ('tempmail.dev'),
  ('tempinbox.com'), ('tempr.email'), ('mytemp.email'), ('tmpmail.org'), ('tmpmail.net'), ('tmail.ws'),
  -- YOPmail
  ('yopmail.com'), ('yopmail.net'), ('yopmail.fr'), ('cool.fr.nf'), ('jetable.fr.nf'), ('courriel.fr.nf'),
  ('moncourrier.fr.nf'), ('monemail.fr.nf'), ('monmail.fr.nf'), ('nospam.ze.tc'), ('nomail.xl.cx'), ('speed.1s.fr'),
  -- Trashmail / Wegwerfmail
  ('trashmail.com'), ('trashmail.net'), ('trashmail.de'), ('trashmail.io'), ('trashmail.me'), ('wegwerfmail.de'),
  ('wegwerfmail.net'), ('wegwerfmail.org'), ('byom.de'),
  -- 1secmail / Dropmail / Fake Mail Generator
  ('1secmail.com'), ('1secmail.org'), ('1secmail.net'), ('dropmail.me'), ('10mail.org'), ('armyspy.com'), ('cuvox.de'),
  ('dayrep.com'), ('einrot.com'), ('fleckens.hu'), ('gustr.com'), ('jourrapide.com'), ('rhyta.com'), ('superrito.com'),
  ('teleworm.us'),
  -- Khác
  ('throwawaymail.com'), ('maildrop.cc'), ('mailnesia.com'), ('dispostable.com'), ('getnada.com'), ('mintemail.com'),
  ('discard.email'), ('emailondeck.com'), ('fakeinbox.com'), ('mohmal.com'), ('mailcatch.com'), ('spamgourmet.com'),
  ('mailnull.com'), ('getairmail.com'), ('burnermail.io'), ('inboxkitten.com'), ('mailpoof.com'), ('moakt.com'),
  ('emailfake.com'), ('generator.email'), ('harakirimail.com'), ('mailsac.com'), ('mailforspam.com'), ('spambox.us')
on conflict (domain) do nothing;

-- Email p_email có bị chặn không (tên miền hoặc tên miền cha nằm trong danh sách)
create or replace function public.email_blocked(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocked_email_domains b
    where lower(trim(split_part(coalesce(p_email, ''), '@', 2))) = b.domain
       or lower(trim(split_part(coalesce(p_email, ''), '@', 2))) like '%.' || b.domain
  );
$$;
revoke all on function public.email_blocked(text) from public, anon, authenticated;

-- Game hỏi trước khi đăng ký (màn Đăng ký): true nếu email dùng được
create or replace function public.email_allowed(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.email_blocked(p_email);
$$;
revoke all on function public.email_allowed(text) from public;
grant execute on function public.email_allowed(text) to anon, authenticated;

create or replace function public.block_junk_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sửa tài khoản mà không đổi email (đăng nhập, xác nhận...) thì bỏ qua: tài khoản cũ không bị ảnh hưởng
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return new;
  end if;
  if public.email_blocked(new.email) then
    raise exception 'EMAIL_BLOCKED: Email không hợp lệ';
  end if;
  return new;
end;
$$;
revoke execute on function public.block_junk_email() from public, anon, authenticated;

drop trigger if exists before_auth_user_email on auth.users;
create trigger before_auth_user_email
  before insert or update of email on auth.users
  for each row execute function public.block_junk_email();

-- Đăng nhập bằng tên: đúng tên + mật khẩu thì trả về email (game đăng nhập Supabase bằng email đó), sai thì null.
-- Chống dò mật khẩu mà không để người lạ khoá được tài khoản của người khác:
--  • Một tên, từ một IP: sai 10 lần / 15 phút thì khoá tên đó với IP đó (kẻ dò chỉ tự khoá mình, chủ tài khoản ở IP khác
--    vẫn đăng nhập được).
--  • Một IP, mọi tên: sai 30 lần / 15 phút thì khoá IP đó (chống dò lần lượt nhiều tên).
--  • Một tên, mọi IP: sai 30 lần / 1 giờ thì khoá tên đó (lưới cuối khi IP bị giả / dò từ nhiều máy). Lúc này chủ tài khoản
--    vẫn vào được bằng EMAIL + mật khẩu (Supabase Auth tự giới hạn theo IP thật) hoặc Quên mật khẩu.
-- Bỏ ngưỡng chung cả máy chủ (bản cũ: 300 lần / phút thì chặn mọi người): một người dò là ai cũng không đăng nhập được.
-- Bị khoá: raise 'LOGIN_LOCKED'
create or replace function public.login_email(p_name text, p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := public.normalize_username(p_name);
  key text;
  req_ip text := public.request_ip();
  em text;
  hash text;
begin
  if name is null or coalesce(p_password, '') = '' then
    return null;
  end if;
  key := lower(name);
  perform pg_advisory_xact_lock(hashtext('login:' || key));
  if (select count(*) from public.login_failures f
      where f.name_key = key and f.ip is not distinct from req_ip and f.at > now() - interval '15 minutes') >= 10
    or (req_ip is not null and (select count(*) from public.login_failures f
      where f.ip = req_ip and f.at > now() - interval '15 minutes') >= 30)
    or (select count(*) from public.login_failures f where f.name_key = key and f.at > now() - interval '1 hour') >= 30 then
    raise exception 'LOGIN_LOCKED: Sai quá nhiều lần, thử lại sau ít phút';
  end if;
  select u.email, u.encrypted_password into em, hash
  from public.profiles p join auth.users u on u.id = p.user_id
  where lower(p.username) = key;
  if hash is not null and hash <> '' and extensions.crypt(p_password, hash) = hash then
    delete from public.login_failures where name_key = key;
    return em;
  end if;
  insert into public.login_failures (name_key, ip) values (key, req_ip);
  -- Dọn bớt dòng cũ (thỉnh thoảng)
  if random() < 0.02 then
    delete from public.login_failures where at < now() - interval '1 day';
  end if;
  return null;
end;
$$;
revoke execute on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;

-- Tên thật (bảng profiles, máy chủ ghi khi đăng ký) của các người chơi p_ids, để game hiện đúng tên người khác trên bản đồ
-- và trong lời mời giao dịch thay vì tên do máy người đó tự gửi qua Realtime (giả được). Tối đa 50 id mỗi lần; chỉ người
-- đã đăng nhập. Tên vốn đã hiện công khai trên bản đồ nên không lộ thêm gì
create or replace function public.player_names(p_ids uuid[])
returns table (user_id uuid, username text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, p.username from public.profiles p
  where p.user_id = any (p_ids[1:50]) and auth.uid() is not null;
$$;
revoke all on function public.player_names(uuid[]) from public, anon;
grant execute on function public.player_names(uuid[]) to authenticated;
