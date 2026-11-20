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

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const species = Object.entries(SPECIES)
  .map(([id, sp]) => `  (${q(id)}, ${q(JSON.stringify(sp.base))}::jsonb)`)
  .join(',\n');
const natures = Object.values(NATURES)
  .map((n) => `  (${q(n.id)}, ${n.up ? q(n.up) : 'null'}, ${n.down ? q(n.down) : 'null'})`)
  .join(',\n');
const badges = BADGES.map((b) => q(b.id)).join(', ');

const sql = `-- TỰ SINH bởi scripts/gen-anticheat-sql.mjs (npm run gen:anticheat) — đừng sửa tay, sửa script rồi sinh lại.
-- Chống gian lận phía máy chủ. Chạy SAU schema.sql và trades.sql: Supabase SQL Editor → dán toàn bộ → Run (chạy lại được).
--
-- Mỗi lần game gửi bản lưu lên (bảng saves), máy chủ kiểm tra:
--  • Chặn hẳn (không ghi bản lưu đó lên mạng, bản trên mạng giữ nguyên): dữ liệu không thể có trong game — loài lạ, cấp ngoài
--    1-${MAX_LEVEL}, IV ngoài 0-${IV_MAX}, EV quá ${EV_MAX_STAT} / tổng quá ${EV_MAX_TOTAL}, chiêu ngoài 1-4, HP quá HP tối đa, đội quá ${PARTY_SIZE} con, đồ quá ${ITEM_MAX},
--    tiền âm / quá lớn, huy hiệu lạ / quá 8.
--  • Đáng ngờ (vẫn ghi, nhưng ghi lại và KHOÁ GIAO DỊCH tài khoản): chỉ số không khớp công thức của game (sửa thẳng chỉ số),
--    tiền / số Pokémon / tổng cấp / số Pokémon shiny tăng vọt so với thời gian chơi thêm, thời gian chơi bị lùi.
--    Tiền và Pokémon nhận được qua giao dịch (bảng trades) được trừ ra, không bị tính là đáng ngờ.
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

-- ---------- Kiểm tra một bản lưu ----------
-- p_old: bản lưu đang có trên mạng (null nếu chưa có), p_since: lúc bản đó được ghi. Trả về các vấn đề (severity, reason, detail)
create or replace function public.save_problems(p_user uuid, p_old jsonb, p_new jsonb, p_since timestamptz)
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
  old_money numeric;
  minutes numeric;
  traded_money numeric := 0;
  traded_mons int := 0;
  count_new int;
  count_old int;
  shiny_new int;
  shiny_old int;
  levels_new int;
  levels_old int;
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
    if (mon ->> 'hp')::numeric > (mon ->> 'maxHp')::numeric or (mon ->> 'hp')::numeric < 0 then
      return query select 'hard', 'hp', jsonb_build_object('species', mon ->> 'speciesId');
    end if;
    continue when mon -> 'ivs' is null; -- bản lưu rất cũ chưa có IV (game tự bổ sung khi tải)
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
    -- Chỉ số theo đúng công thức của game (src/game/monster.js: calcStats). Đang biến hình trong trận thì bỏ qua
    continue when mon ? 'transformed';
    select n.up, n.down into nat from public.game_natures n where n.id = mon ->> 'nature';
    foreach k in array stat_keys loop
      core := floor(((2 * (base ->> k)::int + (mon -> 'ivs' ->> k)::int + floor(coalesce((mon -> 'evs' ->> k)::int, 0) / 4)) * lvl) / 100);
      if k = 'hp' then
        expect := core + lvl + 10;
        if (mon ->> 'maxHp')::int <> expect then
          return query select 'soft', 'stats', jsonb_build_object('species', mon ->> 'speciesId', 'stat', 'maxHp', 'have', mon -> 'maxHp', 'expect', expect);
        end if;
      else
        mult := case when nat.up = k then 1.1 when nat.down = k then 0.9 else 1 end;
        expect := floor(((core + 5) * round(mult * 100)) / 100);
        if (mon ->> k)::int <> expect then
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

  -- So với bản trước: tăng vọt so với thời gian chơi thêm
  if p_old is null then return; end if;
  minutes := greatest(1, (coalesce((p_new ->> 'playTime')::numeric, 0) - coalesce((p_old ->> 'playTime')::numeric, 0)) / 60);
  if coalesce((p_new ->> 'playTime')::numeric, 0) < coalesce((p_old ->> 'playTime')::numeric, 0) - 60 then
    return query select 'soft', 'playtime_back', jsonb_build_object('old', p_old -> 'playTime', 'new', p_new -> 'playTime');
  end if;
  -- Nhận được qua giao dịch từ lúc ghi bản trước: không tính
  select coalesce(sum(coalesce(((case when t.a = p_user then t.offer_b else t.offer_a end) ->> 'money')::numeric, 0)), 0),
         coalesce(sum(jsonb_array_length(coalesce((case when t.a = p_user then t.offer_b else t.offer_a end) -> 'mons', '[]'::jsonb))), 0)
    into traded_money, traded_mons
    from public.trades t
    where t.status = 'done' and p_user in (t.a, t.b) and t.updated_at >= coalesce(p_since, now()) - interval '10 minutes';
  old_money := coalesce((p_old ->> 'money')::numeric, 0);
  if money - old_money - traded_money > 50000 + 5000 * minutes then
    return query select 'soft', 'money_gain', jsonb_build_object('gain', money - old_money, 'minutes', minutes);
  end if;
  select count(*) filter (where jsonb_typeof(m) = 'object'),
         count(*) filter (where (m ->> 'shiny')::boolean),
         coalesce(sum((m ->> 'level')::int), 0)
    into count_new, shiny_new, levels_new
    from jsonb_array_elements(mons) m;
  select count(*) filter (where jsonb_typeof(m) = 'object'),
         count(*) filter (where (m ->> 'shiny')::boolean),
         coalesce(sum((m ->> 'level')::int), 0)
    into count_old, shiny_old, levels_old
    from jsonb_array_elements(coalesce(p_old -> 'party', '[]'::jsonb) || coalesce(p_old -> 'storage', '[]'::jsonb)) m;
  if count_new - count_old - traded_mons > 6 + 3 * minutes then
    return query select 'soft', 'mons_gain', jsonb_build_object('gain', count_new - count_old, 'minutes', minutes);
  end if;
  if shiny_new - shiny_old - traded_mons > 1 + floor(minutes / 20) then
    return query select 'soft', 'shiny_gain', jsonb_build_object('gain', shiny_new - shiny_old, 'minutes', minutes);
  end if;
  if levels_new - levels_old > 40 + 10 * minutes + 100 * traded_mons then
    return query select 'soft', 'level_gain', jsonb_build_object('gain', levels_new - levels_old, 'minutes', minutes);
  end if;
end;
$$;
revoke all on function public.save_problems(uuid, jsonb, jsonb, timestamptz) from public, anon, authenticated;

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
begin
  for r in select * from public.save_problems(
    new.user_id,
    case when tg_op = 'UPDATE' then old.data end,
    new.data,
    case when tg_op = 'UPDATE' then old.updated_at end
  ) loop
    insert into public.save_flags (user_id, severity, reason, detail) values (new.user_id, r.severity, r.reason, r.detail);
    if r.severity = 'hard' then hard := true; else soft := soft + 1; end if;
  end loop;
  if hard or soft > 0 then
    insert into public.player_status (user_id, trade_blocked, flags) values (new.user_id, true, soft + (case when hard then 1 else 0 end))
    on conflict (user_id) do update
      set trade_blocked = true, flags = public.player_status.flags + excluded.flags, updated_at = now();
  end if;
  if hard then
    if tg_op = 'INSERT' then return null; end if; -- không tạo bản lưu
    new.data := old.data; -- giữ bản lưu cũ trên mạng
  end if;
  return new;
end;
$$;

drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves
  for each row execute function public.saves_guard();
`;

writeFileSync(new URL('../supabase/anticheat.sql', import.meta.url), sql);
console.log(`supabase/anticheat.sql: ${Object.keys(SPECIES).length} loài, ${Object.keys(NATURES).length} tính cách`);
