-- Giao dịch giữa người chơi. Chạy SAU schema.sql: Supabase Dashboard → SQL Editor → New query → dán toàn bộ file → Run.
-- Chạy lại nhiều lần cũng không sao.
--
-- Cách hoạt động (game: src/online/trade.js):
--  1. Người mời gọi trade_open(người kia) -> có một dòng trades (status 'open'); người được mời đồng ý: trade_accept
--     (accepted = true; các giao dịch đang mở khác của người đó bị huỷ: nhiều lời mời thì lời nào được đồng ý trước thắng).
--  2. Mỗi bên đặt đề nghị của mình: trade_set_offer (đổi đề nghị thì cả hai bên phải đồng ý lại từ đầu).
--  3. Mỗi bên bấm Đồng ý: trade_ready(id, đề nghị của bên kia mà mình đang thấy). Bên kia vừa đổi đề nghị thì bị từ chối.
--  4. Cả hai đã Đồng ý: mỗi bên bấm Giao dịch: trade_confirm(id). Cả hai đã bấm: máy chủ kiểm tra lại cả hai đề nghị với bản
--     lưu trên mạng (huy hiệu, Pokémon, đồ, tiền) và chốt (status 'done'). Pokémon trong đề nghị được thay bằng đúng con
--     trong bản lưu (không sửa được chỉ số khi gửi). Huỷ giữa chừng (trade_cancel): không ai mất gì.
--  5. Mỗi bên tự nhận đồ vào bản lưu của mình rồi trade_mark_applied. Văng game giữa chừng: lần sau vào game nhận tiếp.
-- Bảng chỉ đọc được bởi hai người trong cuộc; mọi thay đổi đi qua các hàm dưới (security definer, tự kiểm tra auth.uid()).

create table if not exists public.trades (
  id         uuid primary key default gen_random_uuid(),
  a          uuid not null references auth.users (id) on delete cascade, -- người mời
  b          uuid not null references auth.users (id) on delete cascade, -- người được mời
  a_name     text not null default '',
  b_name     text not null default '',
  offer_a    jsonb not null default '{"mons": [], "items": {}, "money": 0}',
  offer_b    jsonb not null default '{"mons": [], "items": {}, "money": 0}',
  confirm_a  boolean not null default false,
  confirm_b  boolean not null default false,
  status     text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  applied_a  boolean not null default false,
  applied_b  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trades_two_people check (a <> b)
);
-- Bản đầu của bảng chưa có các cột này (chạy lại file là thêm)
alter table public.trades add column if not exists accepted boolean not null default false;
alter table public.trades add column if not exists ready_a boolean not null default false;
alter table public.trades add column if not exists ready_b boolean not null default false;
create index if not exists trades_a_idx on public.trades (a, status);
create index if not exists trades_b_idx on public.trades (b, status);

alter table public.trades enable row level security;
drop policy if exists "trades: người trong cuộc đọc" on public.trades;
create policy "trades: người trong cuộc đọc" on public.trades
  for select to authenticated using ((select auth.uid()) in (a, b));

-- Kiểm tra đề nghị của p_user với bản lưu trên mạng của người đó. Trả về đề nghị đã chuẩn hoá (Pokémon lấy đúng từ bản lưu).
-- Lỗi: raise exception 'TRADE: <câu báo>' (game hiện phần sau dấu hai chấm)
create or replace function public.trade_validated(p_user uuid, p_offer jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  save   jsonb;
  party  jsonb;
  mons   jsonb := coalesce(p_offer -> 'mons', '[]'::jsonb);
  items  jsonb := coalesce(p_offer -> 'items', '{}'::jsonb);
  amount bigint;
  mon    jsonb;
  item   record;
  n      int;
begin
  select data into save from public.saves where user_id = p_user;
  if save is null then
    raise exception 'TRADE: Không tìm thấy bản lưu trên mạng';
  end if;
  if jsonb_array_length(coalesce(save -> 'badges', '[]'::jsonb)) < 4 then
    raise exception 'TRADE: Cần ít nhất 4 huy hiệu để giao dịch';
  end if;
  -- Tài khoản bị khoá giao dịch do bản lưu đáng ngờ (supabase/anticheat.sql; chưa chạy file đó thì bỏ qua)
  if to_regclass('public.player_status') is not null then
    if exists (select 1 from public.player_status s where s.user_id = p_user and s.trade_blocked) then
      raise exception 'TRADE: Tài khoản đang bị tạm khoá giao dịch (bản lưu có dấu hiệu bất thường)';
    end if;
  end if;
  party :=coalesce(save -> 'party', '[]'::jsonb);
  n := jsonb_array_length(mons);
  if n > 5 then
    raise exception 'TRADE: Mỗi lần chỉ đưa tối đa 5 Pokémon';
  end if;
  if n > 0 and n >= jsonb_array_length(party) then
    raise exception 'TRADE: Phải chừa lại ít nhất 1 Pokémon trong đội';
  end if;
  if n <> (select count(distinct m ->> 'uid') from jsonb_array_elements(mons) m) then
    raise exception 'TRADE: Pokémon bị trùng';
  end if;
  for mon in select value from jsonb_array_elements(mons) loop
    -- Huyền thoại / huyền ảo (giữ khớp với src/game/trade.js: UNTRADEABLE_SPECIES)
    if mon ->> 'speciesId' in ('articuno', 'zapdos', 'moltres', 'mewtwo', 'mew') then
      raise exception 'TRADE: Pokémon huyền thoại / huyền ảo không giao dịch được';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(party) m
      where m ->> 'uid' = mon ->> 'uid' and m ->> 'speciesId' = mon ->> 'speciesId'
    ) then
      raise exception 'TRADE: % không còn trong đội', coalesce(mon ->> 'name', 'Pokémon');
    end if;
  end loop;
  amount := coalesce((p_offer ->> 'money')::bigint, 0);
  if amount < 0 or amount > coalesce((save ->> 'money')::bigint, 0) then
    raise exception 'TRADE: Không đủ tiền';
  end if;
  for item in select key, value from jsonb_each(items) loop
    if jsonb_typeof(item.value) <> 'number'
      or (item.value #>> '{}')::numeric <= 0
      or (item.value #>> '{}')::numeric > coalesce((save -> 'bag' ->> item.key)::numeric, 0) then
      raise exception 'TRADE: Không đủ vật phẩm %', item.key;
    end if;
  end loop;
  return jsonb_build_object(
    'mons', (
      select coalesce(jsonb_agg(m), '[]'::jsonb) from jsonb_array_elements(party) m
      where m ->> 'uid' in (select x ->> 'uid' from jsonb_array_elements(mons) x)
    ),
    'items', items,
    'money', amount
  );
end;
$$;
revoke all on function public.trade_validated(uuid, jsonb) from public, anon, authenticated;

-- Mời p_partner giao dịch. Huỷ các giao dịch đang mở khác của mình. Trả về id giao dịch
create or replace function public.trade_open(p_partner uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  last_at timestamptz;
  wait_s int;
begin
  if me is null then raise exception 'TRADE: Chưa đăng nhập'; end if;
  if p_partner = me then raise exception 'TRADE: Không thể tự giao dịch với chính mình'; end if;
  if coalesce((select jsonb_array_length(coalesce(data -> 'badges', '[]'::jsonb)) from public.saves where user_id = me), 0) < 4 then
    raise exception 'TRADE: Cần ít nhất 4 huy hiệu để giao dịch';
  end if;
  -- Chống spam: mỗi người tối đa 1 lời mời / 30 giây (khoá theo người để 2 lệnh gửi cùng lúc không cùng lọt)
  perform pg_advisory_xact_lock(hashtext('trade_open:' || me::text));
  select max(created_at) into last_at from public.trades where a = me;
  if last_at is not null and last_at > now() - interval '30 seconds' then
    wait_s := greatest(1, ceil(extract(epoch from (last_at + interval '30 seconds' - now())))::int);
    raise exception 'TRADE: Mỗi 30 giây chỉ gửi được 1 lời mời, chờ % giây nữa', wait_s;
  end if;
  update public.trades set status = 'cancelled', updated_at = now() where status = 'open' and me in (a, b);
  insert into public.trades (a, b, a_name) values (me, p_partner, left(coalesce(p_name, ''), 24)) returning id into new_id;
  return new_id;
end;
$$;

-- Người được mời đồng ý vào giao dịch
create or replace function public.trade_accept(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if coalesce((select jsonb_array_length(coalesce(data -> 'badges', '[]'::jsonb)) from public.saves where user_id = me), 0) < 4 then
    raise exception 'TRADE: Cần ít nhất 4 huy hiệu để giao dịch';
  end if;
  update public.trades set status = 'cancelled', updated_at = now() where status = 'open' and me in (a, b) and id <> p_id;
  update public.trades set b_name = left(coalesce(p_name, ''), 24), accepted = true, updated_at = now()
  where id = p_id and b = me and status = 'open' and not accepted;
  if not found then raise exception 'TRADE: Lời mời không còn hiệu lực'; end if;
end;
$$;

-- Đặt đề nghị của mình. Đề nghị đổi thì cả hai bên phải Đồng ý lại từ đầu
create or replace function public.trade_set_offer(p_id uuid, p_offer jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t public.trades;
begin
  if jsonb_typeof(p_offer -> 'mons') is distinct from 'array'
    or jsonb_typeof(p_offer -> 'items') is distinct from 'object'
    or jsonb_typeof(p_offer -> 'money') is distinct from 'number'
    or jsonb_array_length(p_offer -> 'mons') > 5
    or octet_length(p_offer::text) > 200000 then
    raise exception 'TRADE: Đề nghị không hợp lệ';
  end if;
  select * into t from public.trades where id = p_id for update;
  if t.id is null or me not in (t.a, t.b) then raise exception 'TRADE: Không tìm thấy giao dịch'; end if;
  if t.status <> 'open' or not t.accepted then raise exception 'TRADE: Giao dịch đã kết thúc'; end if;
  if me = t.a then
    update public.trades set offer_a = p_offer, ready_a = false, ready_b = false, confirm_a = false, confirm_b = false,
      updated_at = now() where id = p_id;
  else
    update public.trades set offer_b = p_offer, ready_a = false, ready_b = false, confirm_a = false, confirm_b = false,
      updated_at = now() where id = p_id;
  end if;
end;
$$;

-- Bản đầu: trade_confirm(id, seen) gộp Đồng ý và Giao dịch làm một
drop function if exists public.trade_confirm(uuid, jsonb);

-- Bước 1 — Đồng ý với đề nghị của bên kia đúng như p_seen (bên kia vừa đổi đề nghị thì bị từ chối)
create or replace function public.trade_ready(p_id uuid, p_seen jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t public.trades;
begin
  select * into t from public.trades where id = p_id for update;
  if t.id is null or me not in (t.a, t.b) then raise exception 'TRADE: Không tìm thấy giao dịch'; end if;
  if t.status <> 'open' or not t.accepted then raise exception 'TRADE: Giao dịch đã kết thúc'; end if;
  if (case when me = t.a then t.offer_b else t.offer_a end) <> p_seen then
    raise exception 'TRADE: Bên kia vừa đổi đề nghị, hãy xem lại';
  end if;
  if me = t.a then
    update public.trades set ready_a = true, updated_at = now() where id = p_id;
  else
    update public.trades set ready_b = true, updated_at = now() where id = p_id;
  end if;
end;
$$;

-- Bước 2 — Giao dịch (cả hai phải đã Đồng ý). Cả hai đã bấm Giao dịch thì kiểm tra lại và chốt.
-- Trả về 'open' (chờ bên kia) hoặc 'done'
create or replace function public.trade_confirm(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t public.trades;
begin
  select * into t from public.trades where id = p_id for update;
  if t.id is null or me not in (t.a, t.b) then raise exception 'TRADE: Không tìm thấy giao dịch'; end if;
  if t.status <> 'open' then raise exception 'TRADE: Giao dịch đã kết thúc'; end if;
  if not (t.ready_a and t.ready_b) then raise exception 'TRADE: Cả hai phải bấm Đồng ý trước'; end if;
  if me = t.a then t.confirm_a := true; else t.confirm_b := true; end if;
  if t.confirm_a and t.confirm_b then
    update public.trades set
      offer_a = public.trade_validated(t.a, t.offer_a),
      offer_b = public.trade_validated(t.b, t.offer_b),
      confirm_a = true, confirm_b = true, status = 'done', updated_at = now()
    where id = p_id;
    return 'done';
  end if;
  update public.trades set confirm_a = t.confirm_a, confirm_b = t.confirm_b, updated_at = now() where id = p_id;
  return 'open';
end;
$$;

-- Huỷ giao dịch đang mở (một trong hai bên)
create or replace function public.trade_cancel(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trades set status = 'cancelled', updated_at = now()
  where id = p_id and auth.uid() in (a, b) and status = 'open';
end;
$$;

-- Đã nhận đồ của giao dịch vào bản lưu
create or replace function public.trade_mark_applied(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trades set
    applied_a = applied_a or auth.uid() = a,
    applied_b = applied_b or auth.uid() = b
  where id = p_id and auth.uid() in (a, b) and status = 'done';
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'trade_open(uuid, text)', 'trade_accept(uuid, text)', 'trade_set_offer(uuid, jsonb)', 'trade_ready(uuid, jsonb)',
    'trade_confirm(uuid)',
    'trade_cancel(uuid)', 'trade_mark_applied(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
