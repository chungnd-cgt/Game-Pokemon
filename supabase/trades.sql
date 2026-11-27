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
--  5. Mỗi bên tự nhận đồ vào bản lưu của mình (ghi id giao dịch vào data.tradesDone) rồi trade_mark_applied. Văng game
--     giữa chừng: lần sau vào game nhận tiếp. Máy chủ không tin phần này: đồ đã đưa mà bản lưu chưa ghi nhận thì không đem
--     giao dịch lại được (trade_validated); ghi nhận rồi mà vẫn giữ đồ / tiền / Pokémon đã đưa thì bị khoá giao dịch
--     (anticheat.sql).
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
-- Lý do huỷ (hiện cho cả hai bên), vd một bên không nhận thêm được vật phẩm vì túi đã đầy
alter table public.trades add column if not exists cancel_reason text;
create index if not exists trades_a_idx on public.trades (a, status);
create index if not exists trades_b_idx on public.trades (b, status);

alter table public.trades enable row level security;
drop policy if exists "trades: người trong cuộc đọc" on public.trades;
create policy "trades: người trong cuộc đọc" on public.trades
  for select to authenticated using ((select auth.uid()) in (a, b) and (select public.session_trusted()));

-- Phiên đăng nhập chưa xác nhận thiết bị (schema.sql: session_trusted) thì không giao dịch được
create or replace function public.trade_require_device()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.session_trusted() then
    raise exception 'TRADE: Thiết bị này chưa được xác nhận. Hãy đăng nhập lại.';
  end if;
end;
$$;
revoke all on function public.trade_require_device() from public, anon, authenticated;

-- Pokémon p_user đã đưa đi trong các giao dịch đã chốt (và chưa nhận lại qua giao dịch sau đó). Nhận diện một con bằng
-- uid + IV + tính cách: uid chỉ duy nhất trong một bản lưu (game cấp lại khi tải), IV + tính cách thì gần như không trùng.
-- Bản lưu còn con như vậy = chưa nhận giao dịch vào bản lưu, hoặc cố giữ lại để nhân bản (anticheat.sql: traded_mon_kept)
create or replace function public.trade_given_away(p_user uuid)
returns table (trade_id uuid, uid text, ivs jsonb, nature text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, m ->> 'uid', m -> 'ivs', m ->> 'nature'
  from public.trades t
  cross join lateral jsonb_array_elements(case when t.a = p_user then t.offer_a else t.offer_b end -> 'mons') m
  where t.status = 'done' and p_user in (t.a, t.b) and m -> 'ivs' is not null
    and not exists (
      select 1 from public.trades t2
      cross join lateral jsonb_array_elements(case when t2.a = p_user then t2.offer_b else t2.offer_a end -> 'mons') r
      where t2.status = 'done' and p_user in (t2.a, t2.b) and t2.updated_at > t.updated_at
        and r -> 'ivs' = m -> 'ivs' and r ->> 'nature' is not distinct from m ->> 'nature'
    );
$$;
revoke all on function public.trade_given_away(uuid) from public, anon, authenticated;

-- Giao dịch đã chốt của p_user mà bản lưu p_save chưa ghi nhận (id chưa có trong data.tradesDone): tổng đã đưa / đã nhận
-- { gaveMoney, gotMoney, gaveItems: { id: số }, gotItems: { id: số } }
create or replace function public.trade_pending(p_user uuid, p_save jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select case when x.a = p_user then x.offer_a else x.offer_b end as gave,
           case when x.a = p_user then x.offer_b else x.offer_a end as got
    from public.trades x
    where x.status = 'done' and p_user in (x.a, x.b)
      and not coalesce(p_save -> 'tradesDone', '[]'::jsonb) ? x.id::text
  )
  select jsonb_build_object(
    'gaveMoney', (select coalesce(sum(coalesce((t.gave ->> 'money')::numeric, 0)), 0) from t),
    'gotMoney', (select coalesce(sum(coalesce((t.got ->> 'money')::numeric, 0)), 0) from t),
    'gaveItems', (
      select coalesce(jsonb_object_agg(z.k, z.s), '{}'::jsonb) from (
        select i.key as k, sum((i.value #>> '{}')::numeric) as s
        from t cross join lateral jsonb_each(coalesce(t.gave -> 'items', '{}'::jsonb)) i group by i.key
      ) z
    ),
    'gotItems', (
      select coalesce(jsonb_object_agg(z.k, z.s), '{}'::jsonb) from (
        select i.key as k, sum((i.value #>> '{}')::numeric) as s
        from t cross join lateral jsonb_each(coalesce(t.got -> 'items', '{}'::jsonb)) i group by i.key
      ) z
    )
  );
$$;
revoke all on function public.trade_pending(uuid, jsonb) from public, anon, authenticated;

-- p_user (tên p_name) có nhận hết được đề nghị p_theirs không, khi đưa đi p_mine: mỗi loại vật phẩm tối đa 999 (giữ khớp
-- src/game/state.js: ITEM_MAX), tiền tối đa 999.999.999 (anticheat.sql). Tính cả giao dịch đã chốt mà bản lưu chưa ghi
-- nhận. Trả về câu báo, hoặc null nếu nhận được
create or replace function public.trade_receive_problem(p_user uuid, p_name text, p_mine jsonb, p_theirs jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  save    jsonb;
  pending jsonb;
  item    record;
  have    numeric;
  item_name text;
  who     text := coalesce(nullif(p_name, ''), 'Người chơi');
begin
  select data into save from public.saves where user_id = p_user;
  if save is null then return null; end if; -- trade_validated báo lỗi này
  pending := public.trade_pending(p_user, save);
  for item in select key, value from jsonb_each(coalesce(p_theirs -> 'items', '{}'::jsonb)) loop
    continue when jsonb_typeof(item.value) <> 'number';
    have := greatest(0, coalesce((save -> 'bag' ->> item.key)::numeric, 0)
      - coalesce((pending -> 'gaveItems' ->> item.key)::numeric, 0)
      + coalesce((pending -> 'gotItems' ->> item.key)::numeric, 0)
      - coalesce((p_mine -> 'items' ->> item.key)::numeric, 0));
    if have + (item.value #>> '{}')::numeric > 999 then
      item_name := item.key;
      if to_regclass('public.game_items') is not null then
        execute 'select name from public.game_items where id = $1' into item_name using item.key;
      end if;
      return format('%s không nhận thêm được %s %s: túi chỉ chứa tối đa 999 mỗi loại (đang có %s).',
        who, item.value #>> '{}', coalesce(item_name, item.key), have);
    end if;
  end loop;
  if coalesce((save ->> 'money')::numeric, 0) - (pending ->> 'gaveMoney')::numeric + (pending ->> 'gotMoney')::numeric
    - coalesce((p_mine ->> 'money')::numeric, 0) + coalesce((p_theirs ->> 'money')::numeric, 0) > 999999999 then
    return format('%s không nhận thêm được tiền: tối đa 999.999.999₽.', who);
  end if;
  return null;
end;
$$;
revoke all on function public.trade_receive_problem(uuid, text, jsonb, jsonb) from public, anon, authenticated;

-- Kiểm tra đề nghị của p_user với bản lưu trên mạng của người đó. Trả về đề nghị đã chuẩn hoá (Pokémon lấy đúng từ bản lưu).
-- Giao dịch đã chốt mà bản lưu chưa ghi nhận (id chưa có trong data.tradesDone): tiền / đồ đã đưa được trừ ra, Pokémon đã
-- đưa không tính là còn trong đội. Nhờ vậy không đem cùng một món đi giao dịch hai lần trước khi bản lưu kịp cập nhật,
-- hay bằng cách không bao giờ cập nhật.
-- Lỗi: raise exception 'TRADE: <câu báo>' (game hiện phần sau dấu hai chấm)
create or replace function public.trade_validated(p_user uuid, p_offer jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  save    jsonb;
  party   jsonb;
  mons    jsonb := coalesce(p_offer -> 'mons', '[]'::jsonb);
  items   jsonb := coalesce(p_offer -> 'items', '{}'::jsonb);
  amount  bigint;
  mon     jsonb;
  item    record;
  n       int;
  pending jsonb;
  pending_money numeric;
  pending_items jsonb;
  item_kind text;
  item_name text;
begin
  select data into save from public.saves where user_id = p_user;
  if save is null then
    raise exception 'TRADE: Không tìm thấy bản lưu trên mạng';
  end if;
  -- Tiền / đồ đã đưa đi trong giao dịch đã chốt mà bản lưu chưa ghi nhận
  pending := public.trade_pending(p_user, save);
  pending_money := (pending ->> 'gaveMoney')::numeric;
  pending_items := pending -> 'gaveItems';
  if jsonb_array_length(coalesce(save -> 'badges', '[]'::jsonb)) < 4 then
    raise exception 'TRADE: Cần ít nhất 4 huy hiệu để giao dịch';
  end if;
  -- Tài khoản bị khoá giao dịch do bản lưu đáng ngờ (supabase/anticheat.sql; chưa chạy file đó thì bỏ qua)
  if to_regclass('public.player_status') is not null then
    if exists (select 1 from public.player_status s where s.user_id = p_user and s.trade_blocked) then
      raise exception 'TRADE: Tài khoản đang bị tạm khoá giao dịch (bản lưu có dấu hiệu bất thường)';
    end if;
  end if;
  -- Đội trong bản lưu, bỏ những con đã đưa đi (trade_given_away)
  select coalesce(jsonb_agg(m), '[]'::jsonb) into party
    from jsonb_array_elements(coalesce(save -> 'party', '[]'::jsonb)) m
    where not exists (
      select 1 from public.trade_given_away(p_user) g
      where g.uid = m ->> 'uid' and g.ivs = m -> 'ivs' and g.nature is not distinct from m ->> 'nature'
    );
  n := jsonb_array_length(mons);
  if n > 5 then
    raise exception 'TRADE: Mỗi lần chỉ đưa tối đa 5 Pokémon';
  end if;
  if n + (select count(*) from jsonb_object_keys(items)) > 6 then
    raise exception 'TRADE: Mỗi lần giao dịch tối đa 6 dòng (Pokémon + loại vật phẩm)';
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
  -- Đồ đang cầm của Pokémon đưa đi (lấy từ bản lưu, không theo đề nghị gửi lên): vật phẩm game không có / vật phẩm quan trọng /
  -- TM thì không giao dịch được (giữ khớp src/game/trade.js: monTradeProblem; chưa chạy anticheat.sql thì bỏ qua)
  if to_regclass('public.game_items') is not null then
    for mon in
      select m from jsonb_array_elements(party) m
      where m ->> 'uid' in (select x ->> 'uid' from jsonb_array_elements(mons) x)
        and jsonb_typeof(m -> 'heldItem') is not null and jsonb_typeof(m -> 'heldItem') <> 'null'
    loop
      item_kind := null;
      item_name := null;
      if jsonb_typeof(mon -> 'heldItem') = 'string' then
        execute 'select kind, name from public.game_items where id = $1' into item_kind, item_name using mon ->> 'heldItem';
      end if;
      if item_kind is null or item_kind in ('key', 'tm') then
        raise exception 'TRADE: %: đồ đang cầm không được phép giao dịch.', coalesce(mon ->> 'name', 'Pokémon');
      end if;
    end loop;
  end if;
  amount := coalesce((p_offer ->> 'money')::bigint, 0);
  if amount < 0 or amount > coalesce((save ->> 'money')::numeric, 0) - pending_money then
    raise exception 'TRADE: Không đủ tiền';
  end if;
  for item in select key, value from jsonb_each(items) loop
    -- Vật phẩm game không có / vật phẩm quan trọng (xe đạp, HM, thú cưỡi...): giữ khớp src/game/trade.js itemTradeable
    -- (game cũng không cho đưa vào đề nghị, câu báo giống nhau)
    if to_regclass('public.game_items') is not null then
      item_kind := null;
      item_name := null;
      execute 'select kind, name from public.game_items where id = $1' into item_kind, item_name using item.key;
      if item_kind is null or item_kind = 'key' then
        raise exception 'TRADE: %: vật phẩm không được phép giao dịch.', coalesce(item_name, item.key);
      end if;
    end if;
    if jsonb_typeof(item.value) = 'number' and (item.value #>> '{}')::numeric > 999 then
      raise exception 'TRADE: Mỗi loại vật phẩm chỉ đưa tối đa 999';
    end if;
    if jsonb_typeof(item.value) <> 'number'
      or (item.value #>> '{}')::numeric <= 0
      or (item.value #>> '{}')::numeric
        > coalesce((save -> 'bag' ->> item.key)::numeric, 0) - coalesce((pending_items ->> item.key)::numeric, 0) then
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

-- Tên hiện trong giao dịch: tên đăng nhập trong bảng profiles (máy chủ ghi khi đăng ký, người chơi không sửa được), không
-- dùng tên game gửi lên (sửa được: mạo danh người khác). Chưa chạy usernames.sql (không có bảng profiles) thì mới dùng p_name
create or replace function public.trade_player_name(p_user uuid, p_name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_name text;
begin
  if to_regclass('public.profiles') is null then
    return left(coalesce(p_name, ''), 24);
  end if;
  execute 'select username from public.profiles where user_id = $1' into found_name using p_user;
  return coalesce(found_name, ''); -- không có tên (tài khoản tạo trong Dashboard): game hiện "Người chơi"
end;
$$;
revoke all on function public.trade_player_name(uuid, text) from public, anon, authenticated;

-- Mời p_partner giao dịch. Huỷ các giao dịch đang mở khác của mình. Trả về id giao dịch.
-- p_name: chỉ dùng khi máy chủ chưa có bảng tên (trade_player_name)
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
  perform public.trade_require_device();
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
  insert into public.trades (a, b, a_name) values (me, p_partner, public.trade_player_name(me, p_name)) returning id into new_id;
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
  perform public.trade_require_device();
  if coalesce((select jsonb_array_length(coalesce(data -> 'badges', '[]'::jsonb)) from public.saves where user_id = me), 0) < 4 then
    raise exception 'TRADE: Cần ít nhất 4 huy hiệu để giao dịch';
  end if;
  update public.trades set status = 'cancelled', updated_at = now() where status = 'open' and me in (a, b) and id <> p_id;
  update public.trades set b_name = public.trade_player_name(me, p_name), accepted = true, updated_at = now()
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
  perform public.trade_require_device();
  if jsonb_typeof(p_offer -> 'mons') is distinct from 'array'
    or jsonb_typeof(p_offer -> 'items') is distinct from 'object'
    or jsonb_typeof(p_offer -> 'money') is distinct from 'number'
    or jsonb_array_length(p_offer -> 'mons') > 5
    or octet_length(p_offer::text) > 200000 then
    raise exception 'TRADE: Đề nghị không hợp lệ';
  end if;
  -- Mỗi bên tối đa 6 dòng: Pokémon (tối đa 5) + số loại vật phẩm (tiền không tính dòng). Giữ khớp src/game/trade.js
  if jsonb_array_length(p_offer -> 'mons') + (select count(*) from jsonb_object_keys(p_offer -> 'items')) > 6 then
    raise exception 'TRADE: Mỗi lần giao dịch tối đa 6 dòng (Pokémon + loại vật phẩm)';
  end if;
  if exists (select 1 from jsonb_each(p_offer -> 'items') i where jsonb_typeof(i.value) = 'number' and (i.value #>> '{}')::numeric > 999) then
    raise exception 'TRADE: Mỗi loại vật phẩm chỉ đưa tối đa 999';
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

-- Một bên không nhận hết được đồ của bên kia (túi đầy...): huỷ giao dịch kèm lý do, không ai mất gì
create or replace function public.trade_cancel_for(p_id uuid, p_problem text)
returns text
language sql
security definer
set search_path = ''
as $$
  update public.trades set status = 'cancelled', updated_at = now(),
    cancel_reason = p_problem || ' Giao dịch đã huỷ.'
  where id = p_id and status = 'open';
  select 'cancelled';
$$;
revoke all on function public.trade_cancel_for(uuid, text) from public, anon, authenticated;

-- Bước 1 — Đồng ý với đề nghị của bên kia đúng như p_seen (bên kia vừa đổi đề nghị thì bị từ chối).
-- Trả về 'ok', hoặc 'cancelled' nếu mình không nhận hết được đề nghị của bên kia (giao dịch bị huỷ, lý do trong cancel_reason)
drop function if exists public.trade_ready(uuid, jsonb);
create or replace function public.trade_ready(p_id uuid, p_seen jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t public.trades;
  problem text;
begin
  perform public.trade_require_device();
  select * into t from public.trades where id = p_id for update;
  if t.id is null or me not in (t.a, t.b) then raise exception 'TRADE: Không tìm thấy giao dịch'; end if;
  if t.status <> 'open' or not t.accepted then raise exception 'TRADE: Giao dịch đã kết thúc'; end if;
  if (case when me = t.a then t.offer_b else t.offer_a end) <> p_seen then
    raise exception 'TRADE: Bên kia vừa đổi đề nghị, hãy xem lại';
  end if;
  problem := case when me = t.a then public.trade_receive_problem(t.a, t.a_name, t.offer_a, t.offer_b)
                  else public.trade_receive_problem(t.b, t.b_name, t.offer_b, t.offer_a) end;
  if problem is not null then
    return public.trade_cancel_for(p_id, problem);
  end if;
  if me = t.a then
    update public.trades set ready_a = true, updated_at = now() where id = p_id;
  else
    update public.trades set ready_b = true, updated_at = now() where id = p_id;
  end if;
  return 'ok';
end;
$$;

-- Bước 2 — Giao dịch (cả hai phải đã Đồng ý). Cả hai đã bấm Giao dịch thì kiểm tra lại và chốt.
-- Trả về 'open' (chờ bên kia), 'done', hoặc 'cancelled' (một bên không nhận hết được đồ, hoặc cả hai không đưa gì: huỷ,
-- không ai mất gì)
create or replace function public.trade_confirm(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t public.trades;
  va jsonb;
  vb jsonb;
  problem text;
begin
  perform public.trade_require_device();
  select * into t from public.trades where id = p_id for update;
  if t.id is null or me not in (t.a, t.b) then raise exception 'TRADE: Không tìm thấy giao dịch'; end if;
  if t.status <> 'open' then raise exception 'TRADE: Giao dịch đã kết thúc'; end if;
  if not (t.ready_a and t.ready_b) then raise exception 'TRADE: Cả hai phải bấm Đồng ý trước'; end if;
  if me = t.a then t.confirm_a := true; else t.confirm_b := true; end if;
  if t.confirm_a and t.confirm_b then
    va := public.trade_validated(t.a, t.offer_a);
    vb := public.trade_validated(t.b, t.offer_b);
    -- Cả hai bên đều không đưa gì (không Pokémon, không vật phẩm, không tiền): coi như không có giao dịch, đóng lại
    -- (không ghi thành giao dịch đã chốt). Một bên không đưa gì / chỉ đưa tiền thì vẫn hợp lệ
    if jsonb_array_length(va -> 'mons') = 0 and va -> 'items' = '{}'::jsonb and (va ->> 'money')::numeric = 0
      and jsonb_array_length(vb -> 'mons') = 0 and vb -> 'items' = '{}'::jsonb and (vb ->> 'money')::numeric = 0 then
      update public.trades set status = 'cancelled', updated_at = now(), cancel_reason = 'Hai bên đều không đưa gì nên không có giao dịch.' where id = p_id;
      return 'cancelled';
    end if;
    problem := coalesce(public.trade_receive_problem(t.a, t.a_name, va, vb),
                        public.trade_receive_problem(t.b, t.b_name, vb, va));
    if problem is not null then
      return public.trade_cancel_for(p_id, problem);
    end if;
    update public.trades set offer_a = va, offer_b = vb,
      confirm_a = true, confirm_b = true, status = 'done', updated_at = now()
    where id = p_id;
    return 'done';
  end if;
  update public.trades set confirm_a = t.confirm_a, confirm_b = t.confirm_b, updated_at = now() where id = p_id;
  return 'open';
end;
$$;

-- Huỷ giao dịch đang mở (một trong hai bên). p_reason: lý do hiện cho bên kia (vd túi không chứa hết đồ)
drop function if exists public.trade_cancel(uuid);
create or replace function public.trade_cancel(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.trade_require_device();
  update public.trades set status = 'cancelled', updated_at = now(), cancel_reason = left(nullif(trim(p_reason), ''), 300)
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
  perform public.trade_require_device();
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
    'trade_cancel(uuid, text)', 'trade_mark_applied(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
