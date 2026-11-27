// Sinh supabase/anticheat.sql: bảng chỉ số gốc các loài + tính cách (lấy thẳng từ dữ liệu game để máy chủ tính chỉ số
// đúng như game) và các hàm kiểm tra bản lưu trên máy chủ. Chạy lại mỗi khi đổi dữ liệu loài / tính cách:
//   npm run gen:anticheat     rồi chạy lại supabase/anticheat.sql trong Supabase SQL Editor
import { writeFileSync } from 'node:fs';
import { SPECIES } from '../src/data/monsters.js';
import { NATURES } from '../src/data/natures.js';
import { EV_MAX_STAT, EV_MAX_TOTAL, IV_MAX } from '../src/data/stats.js';
import { ITEM_MAX, PARTY_SIZE } from '../src/game/state.js';
import { MAX_LEVEL } from '../src/game/monster.js';
import { BADGES } from '../src/data/badges.js';
import { ITEMS } from '../src/data/items.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const species = Object.entries(SPECIES)
  .map(([id, sp]) => `  (${q(id)}, ${q(JSON.stringify(sp.base))}::jsonb)`)
  .join(',\n');
const natures = Object.values(NATURES)
  .map((n) => `  (${q(n.id)}, ${n.up ? q(n.up) : 'null'}, ${n.down ? q(n.down) : 'null'})`)
  .join(',\n');
const badges = BADGES.map((b) => q(b.id)).join(', ');
const items = Object.entries(ITEMS)
  .map(([id, it]) => `  (${q(id)}, ${q(it.name)}, ${q(it.kind)}, ${Number(it.price) || 0})`)
  .join(',\n');
// Mốc so "tăng vọt" giữ nguyên trong chừng này phút (xem phần đầu file SQL)
const BASE_WINDOW_MIN = 10;
// Ngưỡng "tăng vọt" của tài sản trong một mốc: cố định + theo mỗi phút chơi thêm
const WEALTH_BASE = 100000; // tiền + giá mua của đồ trong túi
const WEALTH_PER_MIN = 5000;
// Mốc ngày: tài sản tăng trong một mốc DAY_WINDOW_HOURS giờ không quá DAY_WEALTH_MAX. Người chơi thật kiếm nhiều nhất khoảng
// 660.000₽ / ngày (đấu lại cả 69 trainer cùng lúc, gom đồ mọc lại, cày đồ cầm của Pokémon hoang dã cả ngày, dồn nội dung chỉ có
// một lần; Liên minh chỉ đấu đến khi vô địch, không cày lại được). Chặn kiểu gian lận cộng lén từng chút mỗi BASE_WINDOW_MIN phút
// (mốc ngắn cho lọt tới ~900.000₽ / giờ)
const DAY_WINDOW_HOURS = 24;
const DAY_WEALTH_MAX = 1000000;

const sql = `-- TỰ SINH bởi scripts/gen-anticheat-sql.mjs (npm run gen:anticheat) — đừng sửa tay, sửa script rồi sinh lại.
-- Chống gian lận phía máy chủ. Chạy SAU schema.sql và trades.sql: Supabase SQL Editor → dán toàn bộ → Run (chạy lại được).
--
-- Mỗi lần game gửi bản lưu lên (bảng saves), máy chủ kiểm tra:
--  • Chặn hẳn (không ghi bản lưu đó lên mạng, bản trên mạng giữ nguyên): dữ liệu không thể có trong game — loài lạ, cấp ngoài
--    1-${MAX_LEVEL}, thiếu IV / IV ngoài 0-${IV_MAX}, thiếu HP, EV quá ${EV_MAX_STAT} / tổng quá ${EV_MAX_TOTAL}, chiêu ngoài 1-4, HP quá HP tối đa, đội quá ${PARTY_SIZE} con, đồ quá ${ITEM_MAX},
--    tiền âm / quá lớn, huy hiệu lạ / quá 8.
--  • Đáng ngờ (vẫn ghi, nhưng ghi lại và KHOÁ GIAO DỊCH tài khoản): chỉ số không khớp công thức của game (sửa thẳng chỉ số),
--    thiếu chỉ số, tài sản (tiền + giá mua của đồ trong túi) / số Pokémon / tổng cấp / số Pokémon shiny / số Master Ball
--    (đồ không bán) tăng vọt so với thời gian chơi thêm, thời gian chơi bị lùi, đã ghi nhận giao dịch mà vẫn giữ Pokémon đã
--    đưa đi. Tiền và đồ tính chung theo giá mua: mua đồ (tiền đổi ra đồ) hay bán đồ (giá bán thấp hơn) không làm tài sản tăng.
--
-- "Tăng vọt" so với MỐC (bảng save_baseline), không so với bản ngay trước: gửi nhiều lần, mỗi lần tăng một chút vẫn bị
-- cộng dồn. Mốc dời lên bản mới nhất khi đã cũ hơn ${BASE_WINDOW_MIN} phút. Thêm MỐC NGÀY (cột day_summary / day_at) dời mỗi
-- ${DAY_WINDOW_HOURS} giờ: tài sản tăng trong một mốc ngày quá ${DAY_WEALTH_MAX}₽ cũng là đáng ngờ (wealth_day), nên cộng lén từng chút
-- mỗi ${BASE_WINDOW_MIN} phút (dưới ngưỡng mốc ngắn) cũng không lọt quá ${DAY_WEALTH_MAX}₽ một ngày. Thời gian chơi thêm tính theo đồng hồ máy chủ: lấy số nhỏ
-- hơn giữa playTime tăng thêm (game gửi, sửa được) và thời gian thật đã trôi qua từ lúc đặt mốc. Bản lưu tạo mới so với mốc
-- rỗng tính từ lúc tạo tài khoản (người chơi không xoá được bản lưu, schema.sql, nên không "làm lại từ đầu" để né được).
-- Giao dịch mà bản lưu vừa ghi nhận (id mới có trong data.tradesDone) dời mốc theo phần nhận về trừ phần đưa đi: nhận thì
-- không bị tính là tăng vọt, đưa đi rồi mà vẫn giữ tiền / đồ / Pokémon thì bị tính.
-- Ghi tay trong Dashboard / SQL Editor (auth.uid() rỗng): chỉ kiểm tra dữ liệu không thể có, mốc đặt lại theo bản đó.
-- Xem nhật ký: bảng save_flags. Mở khoá giao dịch cho một tài khoản (sau khi xem xét):
--   update public.player_status set trade_blocked = false where user_id = '<uuid>';
-- Lưu ý: cheat "Chung" (src/cheats/chung.js) tặng 151 Pokémon Lv 50 một lúc nên tài khoản dùng cheat sẽ bị khoá giao dịch.

-- ---------- Dữ liệu game ----------
create table if not exists public.game_species (id text primary key, base jsonb not null);
create table if not exists public.game_natures (id text primary key, up text, down text);
alter table public.game_species enable row level security;
alter table public.game_natures enable row level security;
insert into public.game_species (id, base) values
${species}
on conflict (id) do update set base = excluded.base;
insert into public.game_natures (id, up, down) values
${natures}
on conflict (id) do update set up = excluded.up, down = excluded.down;
-- Vật phẩm: giá mua (tính tài sản), loại ('key' = vật phẩm quan trọng, không giao dịch được: trades.sql)
create table if not exists public.game_items (id text primary key, name text not null, kind text not null, price integer not null);
alter table public.game_items enable row level security;
insert into public.game_items (id, name, kind, price) values
${items}
on conflict (id) do update set name = excluded.name, kind = excluded.kind, price = excluded.price;

-- ---------- Nhật ký và trạng thái tài khoản ----------
create table if not exists public.save_flags (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  at        timestamptz not null default now(),
  severity  text not null check (severity in ('hard', 'soft')),
  reason    text not null,
  detail    jsonb
);
create index if not exists save_flags_user_idx on public.save_flags (user_id, at desc);
alter table public.save_flags enable row level security; -- không ai đọc được từ game, chỉ xem trong Dashboard

create table if not exists public.player_status (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  trade_blocked boolean not null default false,
  flags         integer not null default 0,
  updated_at    timestamptz not null default now()
);
alter table public.player_status enable row level security;
drop policy if exists "player_status: đọc của mình" on public.player_status;
create policy "player_status: đọc của mình" on public.player_status
  for select to authenticated using ((select auth.uid()) = user_id);

-- Mốc so "tăng vọt" của mỗi tài khoản: tóm tắt bản lưu (save_summary) và lúc đặt mốc. Không ai đọc / ghi được từ game
create table if not exists public.save_baseline (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary jsonb not null,
  at      timestamptz not null
);
-- Mốc ngày (xem phần đầu file): chưa có (tài khoản có từ trước) thì lấy theo mốc ngắn ở lần gửi bản lưu tiếp theo
alter table public.save_baseline add column if not exists day_summary jsonb;
alter table public.save_baseline add column if not exists day_at timestamptz;
alter table public.save_baseline enable row level security;
revoke all on public.save_baseline from anon, authenticated;

-- ---------- Tóm tắt bản lưu / giao dịch ----------
-- { money, playTime, mons, shiny, levels, wealth, special } của một bản lưu (đội + hộp PC + túi).
-- wealth: tiền + giá mua của đồ trong túi và đồ Pokémon đang cầm (heldItem). special: số đồ không có giá mà không phải vật
-- phẩm quan trọng (Master Ball), cũng tính cả đồ đang cầm: cất đồ vào tay Pokémon / tháo ra túi không làm tài sản đổi, và
-- không giấu được đồ bằng cách cho Pokémon cầm.
-- Dùng được cho cả đề nghị giao dịch ({ party: mons, money, bag: items })
create or replace function public.save_summary(p_data jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'money', coalesce((p_data ->> 'money')::numeric, 0),
    'playTime', coalesce((p_data ->> 'playTime')::numeric, 0),
    'mons', m.mons, 'shiny', m.shiny, 'levels', m.levels,
    'wealth', coalesce((p_data ->> 'money')::numeric, 0) + i.value,
    'special', i.special
  )
  from (
    select count(*) filter (where jsonb_typeof(x) = 'object') as mons,
           count(*) filter (where (x ->> 'shiny')::boolean) as shiny,
           coalesce(sum((x ->> 'level')::int), 0) as levels
    from jsonb_array_elements(coalesce(p_data -> 'party', '[]'::jsonb) || coalesce(p_data -> 'storage', '[]'::jsonb)) x
  ) m, (
    select coalesce(sum(b.n * g.price), 0) as value,
           coalesce(sum(b.n) filter (where g.price = 0 and g.kind <> 'key'), 0) as special
    from (
      select t.key, (t.value #>> '{}')::numeric as n
      from jsonb_each(case when jsonb_typeof(p_data -> 'bag') = 'object' then p_data -> 'bag' else '{}'::jsonb end) t
      where jsonb_typeof(t.value) = 'number'
      union all
      select x ->> 'heldItem', 1
      from jsonb_array_elements(coalesce(p_data -> 'party', '[]'::jsonb) || coalesce(p_data -> 'storage', '[]'::jsonb)) x
      where jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'heldItem') = 'string'
    ) b
    join public.game_items g on g.id = b.key
  ) i;
$$;
revoke all on function public.save_summary(jsonb) from public, anon, authenticated;

-- Giao dịch đã chốt mà p_new vừa ghi nhận (id có trong p_new.tradesDone, chưa có trong p_old.tradesDone): phần nhận về
-- trừ phần đưa đi { money, mons, shiny, levels, wealth, special }
create or replace function public.trade_applied_delta(p_user uuid, p_old jsonb, p_new jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t public.trades;
  got jsonb;
  gave jsonb;
  k text;
  total jsonb := '{"money": 0, "mons": 0, "shiny": 0, "levels": 0, "wealth": 0, "special": 0}';
begin
  for t in
    select * from public.trades x
    where x.status = 'done' and p_user in (x.a, x.b)
      and coalesce(p_new -> 'tradesDone', '[]'::jsonb) ? x.id::text
      and not coalesce(p_old -> 'tradesDone', '[]'::jsonb) ? x.id::text
  loop
    got := (case when t.a = p_user then t.offer_b else t.offer_a end);
    gave := (case when t.a = p_user then t.offer_a else t.offer_b end);
    got := public.save_summary(jsonb_build_object('party', got -> 'mons', 'money', got -> 'money', 'bag', got -> 'items'));
    gave := public.save_summary(jsonb_build_object('party', gave -> 'mons', 'money', gave -> 'money', 'bag', gave -> 'items'));
    foreach k in array array['money', 'mons', 'shiny', 'levels', 'wealth', 'special'] loop
      total := jsonb_set(total, array[k], to_jsonb((total ->> k)::numeric + (got ->> k)::numeric - (gave ->> k)::numeric));
    end loop;
  end loop;
  return total;
end;
$$;
revoke all on function public.trade_applied_delta(uuid, jsonb, jsonb) from public, anon, authenticated;

-- ---------- Kiểm tra một bản lưu ----------
-- p_old: bản lưu đang có trên mạng (null nếu chưa có). p_base / p_base_at: mốc so "tăng vọt" (save_summary, đã dời theo giao
-- dịch vừa ghi nhận) và lúc đặt mốc; null = không so (ghi tay trong Dashboard). Trả về các vấn đề (severity, reason, detail)
drop function if exists public.save_problems(uuid, jsonb, jsonb, timestamptz);
create or replace function public.save_problems(p_user uuid, p_old jsonb, p_new jsonb, p_base jsonb, p_base_at timestamptz)
returns table (severity text, reason text, detail jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  stat_keys text[] := array['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];
  mons jsonb := coalesce(p_new -> 'party', '[]'::jsonb) || coalesce(p_new -> 'storage', '[]'::jsonb);
  mon jsonb;
  base jsonb;
  nat record;
  k text;
  lvl int;
  ev_total int;
  core int;
  mult numeric;
  expect int;
  item record;
  money numeric;
  minutes numeric;
  now_sum jsonb;
  gain numeric;
begin
  if jsonb_typeof(p_new) is distinct from 'object' then
    return query select 'hard', 'format', null::jsonb; return;
  end if;
  if jsonb_array_length(coalesce(p_new -> 'party', '[]'::jsonb)) > ${PARTY_SIZE} then
    return query select 'hard', 'party_size', jsonb_build_object('size', jsonb_array_length(p_new -> 'party'));
  end if;

  for mon in select value from jsonb_array_elements(mons) loop
    continue when jsonb_typeof(mon) is distinct from 'object'; -- ô trống trong hộp PC
    select g.base into base from public.game_species g where g.id = mon ->> 'speciesId';
    if base is null then
      return query select 'hard', 'species', jsonb_build_object('species', mon ->> 'speciesId'); continue;
    end if;
    lvl := (mon ->> 'level')::int;
    if lvl is null or lvl < 1 or lvl > ${MAX_LEVEL} then
      return query select 'hard', 'level', jsonb_build_object('species', mon ->> 'speciesId', 'level', mon -> 'level'); continue;
    end if;
    if jsonb_array_length(coalesce(mon -> 'moves', '[]'::jsonb)) not between 1 and 4 then
      return query select 'hard', 'moves', jsonb_build_object('species', mon ->> 'speciesId');
    end if;
    -- Đồ đang cầm: không cầm gì (null) hoặc vật phẩm có trong game mà Pokémon cầm được (không phải vật phẩm quan trọng / TM,
    -- giữ khớp src/data/items.js: canHold)
    if jsonb_typeof(mon -> 'heldItem') is not null and jsonb_typeof(mon -> 'heldItem') <> 'null' and (
      jsonb_typeof(mon -> 'heldItem') <> 'string'
      or not exists (select 1 from public.game_items g where g.id = mon ->> 'heldItem' and g.kind not in ('key', 'tm'))
    ) then
      return query select 'hard', 'held_item', jsonb_build_object('species', mon ->> 'speciesId', 'item', mon -> 'heldItem');
    end if;
    if mon ->> 'hp' is null or (mon ->> 'hp')::numeric > (mon ->> 'maxHp')::numeric or (mon ->> 'hp')::numeric < 0 then
      return query select 'hard', 'hp', jsonb_build_object('species', mon ->> 'speciesId');
    end if;
    -- Thiếu IV: không tính được chỉ số đúng, nên không cho qua. Game luôn có IV (bản lưu rất cũ được bổ sung khi tải:
    -- src/game/monster.js upgradeMonster)
    if jsonb_typeof(mon -> 'ivs') is distinct from 'object' then
      return query select 'hard', 'iv', jsonb_build_object('species', mon ->> 'speciesId', 'missing', true); continue;
    end if;
    ev_total := 0;
    foreach k in array stat_keys loop
      if coalesce((mon -> 'ivs' ->> k)::int, -1) not between 0 and ${IV_MAX} then
        return query select 'hard', 'iv', jsonb_build_object('species', mon ->> 'speciesId', 'stat', k);
      end if;
      if coalesce((mon -> 'evs' ->> k)::int, 0) not between 0 and ${EV_MAX_STAT} then
        return query select 'hard', 'ev', jsonb_build_object('species', mon ->> 'speciesId', 'stat', k);
      end if;
      ev_total := ev_total + coalesce((mon -> 'evs' ->> k)::int, 0);
    end loop;
    if ev_total > ${EV_MAX_TOTAL} then
      return query select 'hard', 'ev_total', jsonb_build_object('species', mon ->> 'speciesId', 'total', ev_total);
    end if;
    -- Chỉ số theo đúng công thức của game (src/game/monster.js: calcStats). Thiếu chỉ số cũng tính là không khớp.
    -- Không có ngoại lệ cho Pokémon đang biến hình: dạng biến hình không bao giờ được lưu (battle/transform.js)
    select n.up, n.down into nat from public.game_natures n where n.id = mon ->> 'nature';
    foreach k in array stat_keys loop
      core := floor(((2 * (base ->> k)::int + (mon -> 'ivs' ->> k)::int + floor(coalesce((mon -> 'evs' ->> k)::int, 0) / 4)) * lvl) / 100);
      if k = 'hp' then
        expect := core + lvl + 10;
        if (mon ->> 'maxHp')::int is distinct from expect then
          return query select 'soft', 'stats', jsonb_build_object('species', mon ->> 'speciesId', 'stat', 'maxHp', 'have', mon -> 'maxHp', 'expect', expect);
        end if;
      else
        mult := case when nat.up = k then 1.1 when nat.down = k then 0.9 else 1 end;
        expect := floor(((core + 5) * round(mult * 100)) / 100);
        if (mon ->> k)::int is distinct from expect then
          return query select 'soft', 'stats', jsonb_build_object('species', mon ->> 'speciesId', 'stat', k, 'have', mon -> k, 'expect', expect);
        end if;
      end if;
    end loop;
  end loop;

  money := coalesce((p_new ->> 'money')::numeric, 0);
  if money < 0 or money > 999999999 then
    return query select 'hard', 'money', jsonb_build_object('money', money);
  end if;
  for item in select key, value from jsonb_each(coalesce(p_new -> 'bag', '{}'::jsonb)) loop
    if jsonb_typeof(item.value) <> 'number' or (item.value #>> '{}')::numeric not between 0 and ${ITEM_MAX} then
      return query select 'hard', 'bag', jsonb_build_object('item', item.key, 'count', item.value);
    end if;
  end loop;
  if jsonb_array_length(coalesce(p_new -> 'badges', '[]'::jsonb)) > 8
    or exists (select 1 from jsonb_array_elements_text(coalesce(p_new -> 'badges', '[]'::jsonb)) b where b not in (${badges})) then
    return query select 'hard', 'badges', p_new -> 'badges';
  end if;

  -- Ghi tay trong Dashboard: không so
  if p_base is null then return; end if;

  if p_old is not null and coalesce((p_new ->> 'playTime')::numeric, 0) < coalesce((p_old ->> 'playTime')::numeric, 0) - 60 then
    return query select 'soft', 'playtime_back', jsonb_build_object('old', p_old -> 'playTime', 'new', p_new -> 'playTime');
  end if;

  -- Đã ghi nhận giao dịch (id trong tradesDone) mà vẫn còn Pokémon đã đưa đi trong giao dịch đó: nhân bản
  if exists (
    select 1 from jsonb_array_elements(mons) m
    join public.trade_given_away(p_user) g
      on g.uid = m ->> 'uid' and g.ivs = m -> 'ivs' and g.nature is not distinct from m ->> 'nature'
    where coalesce(p_new -> 'tradesDone', '[]'::jsonb) ? g.trade_id::text
  ) then
    return query select 'soft', 'traded_mon_kept', null::jsonb;
  end if;

  -- Tăng vọt so với mốc. Phút chơi thêm: số nhỏ hơn giữa playTime tăng thêm và thời gian thật từ lúc đặt mốc
  minutes := greatest(0, least(
    coalesce((p_new ->> 'playTime')::numeric, 0) - coalesce((p_base ->> 'playTime')::numeric, 0),
    extract(epoch from now() - coalesce(p_base_at, now()))
  )) / 60;
  now_sum := public.save_summary(p_new);
  gain := (now_sum ->> 'wealth')::numeric - (p_base ->> 'wealth')::numeric;
  if gain > ${WEALTH_BASE} + ${WEALTH_PER_MIN} * minutes then
    return query select 'soft', 'wealth_gain', jsonb_build_object('gain', gain,
      'money', (now_sum ->> 'money')::numeric - (p_base ->> 'money')::numeric, 'minutes', round(minutes, 1));
  end if;
  gain := (now_sum ->> 'special')::numeric - (p_base ->> 'special')::numeric;
  if gain > 1 then
    return query select 'soft', 'item_gain', jsonb_build_object('gain', gain, 'minutes', round(minutes, 1));
  end if;
  gain := (now_sum ->> 'mons')::numeric - (p_base ->> 'mons')::numeric;
  if gain > 6 + 3 * minutes then
    return query select 'soft', 'mons_gain', jsonb_build_object('gain', gain, 'minutes', round(minutes, 1));
  end if;
  gain := (now_sum ->> 'shiny')::numeric - (p_base ->> 'shiny')::numeric;
  if gain > 1 + floor(minutes / 20) then
    return query select 'soft', 'shiny_gain', jsonb_build_object('gain', gain, 'minutes', round(minutes, 1));
  end if;
  gain := (now_sum ->> 'levels')::numeric - (p_base ->> 'levels')::numeric;
  if gain > 40 + 10 * minutes then
    return query select 'soft', 'level_gain', jsonb_build_object('gain', gain, 'minutes', round(minutes, 1));
  end if;
end;
$$;
revoke all on function public.save_problems(uuid, jsonb, jsonb, jsonb, timestamptz) from public, anon, authenticated;

-- Trước khi ghi bản lưu: ghi nhật ký; đáng ngờ thì khoá giao dịch; không thể có thì bỏ qua bản lưu này (giữ bản cũ)
create or replace function public.saves_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  hard boolean := false;
  soft int := 0;
  trusted boolean := auth.uid() is null; -- ghi tay trong Dashboard / SQL Editor
  old_data jsonb := case when tg_op = 'UPDATE' then old.data end;
  base jsonb;
  base_at timestamptz;
  day jsonb;
  day_at timestamptz;
  day_gain numeric;
  delta jsonb;
  k text;
begin
  -- Mốc so "tăng vọt". Chưa có mốc: bản đang có trên mạng (tài khoản có từ trước khi có bảng mốc), hoặc bản rỗng tính từ lúc
  -- tạo tài khoản (bản lưu đầu tiên)
  select b.summary, b.at, b.day_summary, b.day_at into base, base_at, day, day_at from public.save_baseline b
    where b.user_id = new.user_id and b.summary ? 'wealth'; -- mốc kiểu cũ (chưa có wealth): coi như chưa có
  if base is null then
    if tg_op = 'UPDATE' then
      base := public.save_summary(old.data);
      base_at := old.updated_at;
    else
      base := public.save_summary('{}'::jsonb);
      select u.created_at into base_at from auth.users u where u.id = new.user_id;
    end if;
  end if;
  base_at := coalesce(base_at, now());
  -- Chưa có mốc ngày: bắt đầu từ mốc ngắn
  if day is null or not day ? 'wealth' then
    day := base;
    day_at := base_at;
  end if;
  -- Giao dịch bản này vừa ghi nhận: dời cả hai mốc theo phần nhận về trừ phần đưa đi
  delta := public.trade_applied_delta(new.user_id, old_data, new.data);
  foreach k in array array['money', 'mons', 'shiny', 'levels', 'wealth', 'special'] loop
    base := jsonb_set(base, array[k], to_jsonb((base ->> k)::numeric + (delta ->> k)::numeric));
    day := jsonb_set(day, array[k], to_jsonb((day ->> k)::numeric + (delta ->> k)::numeric));
  end loop;

  for r in select * from public.save_problems(
    new.user_id, old_data, new.data, case when trusted then null else base end, base_at
  ) loop
    insert into public.save_flags (user_id, severity, reason, detail) values (new.user_id, r.severity, r.reason, r.detail);
    if r.severity = 'hard' then hard := true; else soft := soft + 1; end if;
  end loop;
  -- Mốc ngày: tài sản tăng trong một mốc ${DAY_WINDOW_HOURS} giờ quá ${DAY_WEALTH_MAX}₽ (không so khi ghi tay / bản lưu bị chặn hẳn)
  if not trusted and not hard then
    day_gain := (public.save_summary(new.data) ->> 'wealth')::numeric - (day ->> 'wealth')::numeric;
    if day_gain > ${DAY_WEALTH_MAX} then
      insert into public.save_flags (user_id, severity, reason, detail) values (new.user_id, 'soft', 'wealth_day',
        jsonb_build_object('gain', day_gain, 'since', day_at));
      soft := soft + 1;
    end if;
  end if;
  if hard or soft > 0 then
    insert into public.player_status (user_id, trade_blocked, flags) values (new.user_id, true, soft + (case when hard then 1 else 0 end))
    on conflict (user_id) do update
      set trade_blocked = true, flags = public.player_status.flags + excluded.flags, updated_at = now();
  end if;
  if hard then
    if tg_op = 'INSERT' then return null; end if; -- không tạo bản lưu
    new.data := old.data; -- giữ bản lưu cũ trên mạng (mốc cũng giữ nguyên)
    return new;
  end if;
  -- Mốc đã cũ (hoặc ghi tay): dời lên bản này. Không thì giữ mốc (đã dời theo giao dịch vừa ghi nhận)
  if trusted or base_at < now() - interval '${BASE_WINDOW_MIN} minutes' then
    base := public.save_summary(new.data);
    base_at := now();
  end if;
  if trusted or day_at < now() - interval '${DAY_WINDOW_HOURS} hours' then
    day := public.save_summary(new.data);
    day_at := now();
  end if;
  insert into public.save_baseline (user_id, summary, at, day_summary, day_at) values (new.user_id, base, base_at, day, day_at)
  on conflict (user_id) do update set summary = excluded.summary, at = excluded.at,
    day_summary = excluded.day_summary, day_at = excluded.day_at;
  return new;
end;
$$;

drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves
  for each row execute function public.saves_guard();
`;

writeFileSync(new URL('../supabase/anticheat.sql', import.meta.url), sql);
console.log(`supabase/anticheat.sql: ${Object.keys(SPECIES).length} loài, ${Object.keys(NATURES).length} tính cách`);
