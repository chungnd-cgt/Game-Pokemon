-- TỰ SINH bởi scripts/gen-anticheat-sql.mjs (npm run gen:anticheat) — đừng sửa tay, sửa script rồi sinh lại.
-- Chống gian lận phía máy chủ. Chạy SAU schema.sql và trades.sql: Supabase SQL Editor → dán toàn bộ → Run (chạy lại được).
--
-- Mỗi lần game gửi bản lưu lên (bảng saves), máy chủ kiểm tra:
--  • Chặn hẳn (không ghi bản lưu đó lên mạng, bản trên mạng giữ nguyên): dữ liệu không thể có trong game — loài lạ, cấp ngoài
--    1-100, IV ngoài 0-31, EV quá 252 / tổng quá 510, chiêu ngoài 1-4, HP quá HP tối đa, đội quá 6 con, đồ quá 999,
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
  ('charmander', '{"hp":39,"atk":52,"def":43,"spAtk":60,"spDef":50,"speed":65}'::jsonb),
  ('squirtle', '{"hp":44,"atk":48,"def":65,"spAtk":50,"spDef":64,"speed":43}'::jsonb),
  ('bulbasaur', '{"hp":45,"atk":49,"def":49,"spAtk":65,"spDef":65,"speed":45}'::jsonb),
  ('rattata', '{"hp":30,"atk":56,"def":35,"spAtk":25,"spDef":35,"speed":72}'::jsonb),
  ('pidgey', '{"hp":40,"atk":45,"def":40,"spAtk":35,"spDef":35,"speed":56}'::jsonb),
  ('oddish', '{"hp":45,"atk":50,"def":55,"spAtk":75,"spDef":65,"speed":30}'::jsonb),
  ('poliwag', '{"hp":40,"atk":50,"def":40,"spAtk":40,"spDef":40,"speed":90}'::jsonb),
  ('pikachu', '{"hp":35,"atk":55,"def":40,"spAtk":50,"spDef":50,"speed":90}'::jsonb),
  ('ekans', '{"hp":35,"atk":60,"def":44,"spAtk":40,"spDef":54,"speed":55}'::jsonb),
  ('koffing', '{"hp":40,"atk":65,"def":95,"spAtk":60,"spDef":45,"speed":35}'::jsonb),
  ('magikarp', '{"hp":20,"atk":10,"def":55,"spAtk":15,"spDef":20,"speed":80}'::jsonb),
  ('goldeen', '{"hp":45,"atk":67,"def":60,"spAtk":35,"spDef":50,"speed":63}'::jsonb),
  ('psyduck', '{"hp":50,"atk":52,"def":48,"spAtk":65,"spDef":50,"speed":55}'::jsonb),
  ('zubat', '{"hp":40,"atk":45,"def":35,"spAtk":30,"spDef":40,"speed":55}'::jsonb),
  ('geodude', '{"hp":40,"atk":80,"def":100,"spAtk":30,"spDef":30,"speed":20}'::jsonb),
  ('bellsprout', '{"hp":50,"atk":75,"def":35,"spAtk":70,"spDef":30,"speed":40}'::jsonb),
  ('magnemite', '{"hp":25,"atk":35,"def":70,"spAtk":95,"spDef":55,"speed":45}'::jsonb),
  ('voltorb', '{"hp":40,"atk":30,"def":50,"spAtk":55,"spDef":55,"speed":100}'::jsonb),
  ('tentacool', '{"hp":40,"atk":40,"def":35,"spAtk":50,"spDef":100,"speed":70}'::jsonb),
  ('staryu', '{"hp":30,"atk":45,"def":55,"spAtk":70,"spDef":55,"speed":85}'::jsonb),
  ('vulpix', '{"hp":38,"atk":41,"def":40,"spAtk":50,"spDef":65,"speed":65}'::jsonb),
  ('ponyta', '{"hp":50,"atk":85,"def":55,"spAtk":65,"spDef":65,"speed":90}'::jsonb),
  ('onix', '{"hp":35,"atk":45,"def":160,"spAtk":30,"spDef":45,"speed":70}'::jsonb),
  ('rhyhorn', '{"hp":80,"atk":85,"def":95,"spAtk":30,"spDef":30,"speed":25}'::jsonb),
  ('abra', '{"hp":25,"atk":20,"def":15,"spAtk":105,"spDef":55,"speed":90}'::jsonb),
  ('drowzee', '{"hp":60,"atk":48,"def":45,"spAtk":43,"spDef":90,"speed":42}'::jsonb),
  ('slowpoke', '{"hp":90,"atk":65,"def":65,"spAtk":40,"spDef":40,"speed":15}'::jsonb),
  ('seel', '{"hp":65,"atk":45,"def":55,"spAtk":45,"spDef":70,"speed":45}'::jsonb),
  ('shellder', '{"hp":30,"atk":65,"def":100,"spAtk":45,"spDef":25,"speed":40}'::jsonb),
  ('jynx', '{"hp":65,"atk":50,"def":35,"spAtk":115,"spDef":95,"speed":95}'::jsonb),
  ('lapras', '{"hp":130,"atk":85,"def":80,"spAtk":85,"spDef":95,"speed":60}'::jsonb),
  ('gastly', '{"hp":30,"atk":35,"def":30,"spAtk":100,"spDef":35,"speed":80}'::jsonb),
  ('machop', '{"hp":70,"atk":80,"def":50,"spAtk":35,"spDef":35,"speed":35}'::jsonb),
  ('mankey', '{"hp":40,"atk":80,"def":35,"spAtk":35,"spDef":45,"speed":70}'::jsonb),
  ('hitmonlee', '{"hp":50,"atk":120,"def":53,"spAtk":35,"spDef":110,"speed":87}'::jsonb),
  ('hitmonchan', '{"hp":50,"atk":105,"def":79,"spAtk":35,"spDef":110,"speed":76}'::jsonb),
  ('grimer', '{"hp":80,"atk":80,"def":50,"spAtk":40,"spDef":50,"speed":25}'::jsonb),
  ('dratini', '{"hp":41,"atk":64,"def":45,"spAtk":50,"spDef":50,"speed":50}'::jsonb),
  ('aerodactyl', '{"hp":80,"atk":105,"def":65,"spAtk":60,"spDef":75,"speed":130}'::jsonb),
  ('snorlax', '{"hp":160,"atk":110,"def":65,"spAtk":65,"spDef":110,"speed":30}'::jsonb),
  ('lickitung', '{"hp":90,"atk":55,"def":75,"spAtk":60,"spDef":75,"speed":30}'::jsonb),
  ('eevee', '{"hp":55,"atk":55,"def":50,"spAtk":45,"spDef":65,"speed":55}'::jsonb),
  ('meowth', '{"hp":40,"atk":45,"def":35,"spAtk":40,"spDef":40,"speed":90}'::jsonb),
  ('growlithe', '{"hp":55,"atk":70,"def":45,"spAtk":70,"spDef":50,"speed":60}'::jsonb),
  ('charmeleon', '{"hp":58,"atk":64,"def":58,"spAtk":80,"spDef":65,"speed":80}'::jsonb),
  ('wartortle', '{"hp":59,"atk":63,"def":80,"spAtk":65,"spDef":80,"speed":58}'::jsonb),
  ('ivysaur', '{"hp":60,"atk":62,"def":63,"spAtk":80,"spDef":80,"speed":60}'::jsonb),
  ('raticate', '{"hp":55,"atk":81,"def":60,"spAtk":50,"spDef":70,"speed":97}'::jsonb),
  ('pidgeotto', '{"hp":63,"atk":60,"def":55,"spAtk":50,"spDef":50,"speed":71}'::jsonb),
  ('gloom', '{"hp":60,"atk":65,"def":70,"spAtk":85,"spDef":75,"speed":40}'::jsonb),
  ('poliwhirl', '{"hp":65,"atk":65,"def":65,"spAtk":50,"spDef":50,"speed":90}'::jsonb),
  ('raichu', '{"hp":60,"atk":90,"def":55,"spAtk":90,"spDef":80,"speed":110}'::jsonb),
  ('arbok', '{"hp":60,"atk":95,"def":69,"spAtk":65,"spDef":79,"speed":80}'::jsonb),
  ('weezing', '{"hp":65,"atk":90,"def":120,"spAtk":85,"spDef":70,"speed":60}'::jsonb),
  ('persian', '{"hp":65,"atk":70,"def":60,"spAtk":65,"spDef":65,"speed":115}'::jsonb),
  ('arcanine', '{"hp":90,"atk":110,"def":80,"spAtk":100,"spDef":80,"speed":95}'::jsonb),
  ('gyarados', '{"hp":95,"atk":125,"def":79,"spAtk":60,"spDef":100,"speed":81}'::jsonb),
  ('ninetales', '{"hp":73,"atk":76,"def":75,"spAtk":81,"spDef":100,"speed":100}'::jsonb),
  ('rapidash', '{"hp":65,"atk":100,"def":70,"spAtk":80,"spDef":80,"speed":105}'::jsonb),
  ('rhydon', '{"hp":105,"atk":130,"def":120,"spAtk":45,"spDef":45,"speed":40}'::jsonb),
  ('kadabra', '{"hp":40,"atk":35,"def":30,"spAtk":120,"spDef":70,"speed":105}'::jsonb),
  ('hypno', '{"hp":85,"atk":73,"def":70,"spAtk":73,"spDef":115,"speed":67}'::jsonb),
  ('slowbro', '{"hp":95,"atk":75,"def":110,"spAtk":100,"spDef":80,"speed":30}'::jsonb),
  ('dewgong', '{"hp":90,"atk":70,"def":80,"spAtk":70,"spDef":95,"speed":70}'::jsonb),
  ('cloyster', '{"hp":50,"atk":95,"def":180,"spAtk":85,"spDef":45,"speed":70}'::jsonb),
  ('weepinbell', '{"hp":65,"atk":90,"def":50,"spAtk":85,"spDef":45,"speed":55}'::jsonb),
  ('magneton', '{"hp":50,"atk":60,"def":95,"spAtk":120,"spDef":70,"speed":70}'::jsonb),
  ('electrode', '{"hp":60,"atk":50,"def":70,"spAtk":80,"spDef":80,"speed":150}'::jsonb),
  ('tentacruel', '{"hp":80,"atk":70,"def":65,"spAtk":80,"spDef":120,"speed":100}'::jsonb),
  ('starmie', '{"hp":60,"atk":75,"def":85,"spAtk":100,"spDef":85,"speed":115}'::jsonb),
  ('golbat', '{"hp":75,"atk":80,"def":70,"spAtk":65,"spDef":75,"speed":90}'::jsonb),
  ('graveler', '{"hp":55,"atk":95,"def":115,"spAtk":45,"spDef":45,"speed":35}'::jsonb),
  ('seaking', '{"hp":80,"atk":92,"def":65,"spAtk":65,"spDef":80,"speed":68}'::jsonb),
  ('golduck', '{"hp":80,"atk":82,"def":78,"spAtk":95,"spDef":80,"speed":85}'::jsonb),
  ('charizard', '{"hp":78,"atk":84,"def":78,"spAtk":109,"spDef":85,"speed":100}'::jsonb),
  ('blastoise', '{"hp":79,"atk":83,"def":100,"spAtk":85,"spDef":105,"speed":78}'::jsonb),
  ('venusaur', '{"hp":80,"atk":82,"def":83,"spAtk":100,"spDef":100,"speed":80}'::jsonb),
  ('pidgeot', '{"hp":83,"atk":80,"def":75,"spAtk":70,"spDef":70,"speed":101}'::jsonb),
  ('vileplume', '{"hp":75,"atk":80,"def":85,"spAtk":110,"spDef":90,"speed":50}'::jsonb),
  ('poliwrath', '{"hp":90,"atk":95,"def":95,"spAtk":70,"spDef":90,"speed":70}'::jsonb),
  ('alakazam', '{"hp":55,"atk":50,"def":45,"spAtk":135,"spDef":95,"speed":120}'::jsonb),
  ('victreebel', '{"hp":80,"atk":105,"def":65,"spAtk":100,"spDef":70,"speed":70}'::jsonb),
  ('vaporeon', '{"hp":130,"atk":65,"def":60,"spAtk":110,"spDef":95,"speed":65}'::jsonb),
  ('jolteon', '{"hp":65,"atk":65,"def":60,"spAtk":110,"spDef":95,"speed":130}'::jsonb),
  ('flareon', '{"hp":65,"atk":130,"def":60,"spAtk":95,"spDef":110,"speed":65}'::jsonb),
  ('haunter', '{"hp":45,"atk":50,"def":45,"spAtk":115,"spDef":55,"speed":95}'::jsonb),
  ('gengar', '{"hp":60,"atk":65,"def":60,"spAtk":130,"spDef":75,"speed":110}'::jsonb),
  ('machoke', '{"hp":80,"atk":100,"def":70,"spAtk":50,"spDef":60,"speed":45}'::jsonb),
  ('machamp', '{"hp":90,"atk":130,"def":80,"spAtk":65,"spDef":85,"speed":55}'::jsonb),
  ('primeape', '{"hp":65,"atk":105,"def":60,"spAtk":60,"spDef":70,"speed":95}'::jsonb),
  ('muk', '{"hp":105,"atk":105,"def":75,"spAtk":65,"spDef":100,"speed":50}'::jsonb),
  ('dragonair', '{"hp":61,"atk":84,"def":65,"spAtk":70,"spDef":70,"speed":70}'::jsonb),
  ('dragonite', '{"hp":91,"atk":134,"def":95,"spAtk":100,"spDef":100,"speed":80}'::jsonb),
  ('golem', '{"hp":80,"atk":120,"def":130,"spAtk":55,"spDef":65,"speed":45}'::jsonb),
  ('caterpie', '{"hp":45,"atk":30,"def":35,"spAtk":20,"spDef":20,"speed":45}'::jsonb),
  ('weedle', '{"hp":40,"atk":35,"def":30,"spAtk":20,"spDef":20,"speed":50}'::jsonb),
  ('spearow', '{"hp":40,"atk":60,"def":30,"spAtk":31,"spDef":31,"speed":70}'::jsonb),
  ('sandshrew', '{"hp":50,"atk":75,"def":85,"spAtk":20,"spDef":30,"speed":40}'::jsonb),
  ('nidoran-f', '{"hp":55,"atk":47,"def":52,"spAtk":40,"spDef":40,"speed":41}'::jsonb),
  ('nidoran-m', '{"hp":46,"atk":57,"def":40,"spAtk":40,"spDef":40,"speed":50}'::jsonb),
  ('clefairy', '{"hp":70,"atk":45,"def":48,"spAtk":60,"spDef":65,"speed":35}'::jsonb),
  ('jigglypuff', '{"hp":115,"atk":45,"def":20,"spAtk":45,"spDef":25,"speed":20}'::jsonb),
  ('paras', '{"hp":35,"atk":70,"def":55,"spAtk":45,"spDef":55,"speed":25}'::jsonb),
  ('venonat', '{"hp":60,"atk":55,"def":50,"spAtk":40,"spDef":55,"speed":45}'::jsonb),
  ('diglett', '{"hp":10,"atk":55,"def":25,"spAtk":35,"spDef":45,"speed":95}'::jsonb),
  ('farfetchd', '{"hp":52,"atk":90,"def":55,"spAtk":58,"spDef":62,"speed":60}'::jsonb),
  ('doduo', '{"hp":35,"atk":85,"def":45,"spAtk":35,"spDef":35,"speed":75}'::jsonb),
  ('krabby', '{"hp":30,"atk":105,"def":90,"spAtk":25,"spDef":25,"speed":50}'::jsonb),
  ('exeggcute', '{"hp":60,"atk":40,"def":80,"spAtk":60,"spDef":45,"speed":40}'::jsonb),
  ('cubone', '{"hp":50,"atk":50,"def":95,"spAtk":40,"spDef":50,"speed":35}'::jsonb),
  ('tangela', '{"hp":65,"atk":55,"def":115,"spAtk":100,"spDef":40,"speed":60}'::jsonb),
  ('kangaskhan', '{"hp":105,"atk":95,"def":80,"spAtk":40,"spDef":80,"speed":90}'::jsonb),
  ('horsea', '{"hp":30,"atk":40,"def":70,"spAtk":70,"spDef":25,"speed":60}'::jsonb),
  ('mr-mime', '{"hp":40,"atk":45,"def":65,"spAtk":100,"spDef":120,"speed":90}'::jsonb),
  ('scyther', '{"hp":70,"atk":110,"def":80,"spAtk":55,"spDef":80,"speed":105}'::jsonb),
  ('electabuzz', '{"hp":65,"atk":83,"def":57,"spAtk":95,"spDef":85,"speed":105}'::jsonb),
  ('magmar', '{"hp":65,"atk":95,"def":57,"spAtk":100,"spDef":85,"speed":93}'::jsonb),
  ('pinsir', '{"hp":65,"atk":125,"def":100,"spAtk":55,"spDef":70,"speed":85}'::jsonb),
  ('tauros', '{"hp":75,"atk":100,"def":95,"spAtk":40,"spDef":70,"speed":110}'::jsonb),
  ('chansey', '{"hp":250,"atk":5,"def":5,"spAtk":35,"spDef":105,"speed":50}'::jsonb),
  ('ditto', '{"hp":48,"atk":48,"def":48,"spAtk":48,"spDef":48,"speed":48}'::jsonb),
  ('porygon', '{"hp":65,"atk":60,"def":70,"spAtk":85,"spDef":75,"speed":40}'::jsonb),
  ('omanyte', '{"hp":35,"atk":40,"def":100,"spAtk":90,"spDef":55,"speed":35}'::jsonb),
  ('kabuto', '{"hp":30,"atk":80,"def":90,"spAtk":55,"spDef":45,"speed":55}'::jsonb),
  ('articuno', '{"hp":90,"atk":85,"def":100,"spAtk":95,"spDef":125,"speed":85}'::jsonb),
  ('zapdos', '{"hp":90,"atk":90,"def":85,"spAtk":125,"spDef":90,"speed":100}'::jsonb),
  ('moltres', '{"hp":90,"atk":100,"def":90,"spAtk":125,"spDef":85,"speed":90}'::jsonb),
  ('mewtwo', '{"hp":106,"atk":110,"def":90,"spAtk":154,"spDef":90,"speed":130}'::jsonb),
  ('mew', '{"hp":100,"atk":100,"def":100,"spAtk":100,"spDef":100,"speed":100}'::jsonb),
  ('metapod', '{"hp":50,"atk":20,"def":55,"spAtk":25,"spDef":25,"speed":30}'::jsonb),
  ('kakuna', '{"hp":45,"atk":25,"def":50,"spAtk":25,"spDef":25,"speed":35}'::jsonb),
  ('fearow', '{"hp":65,"atk":90,"def":65,"spAtk":61,"spDef":61,"speed":100}'::jsonb),
  ('sandslash', '{"hp":75,"atk":100,"def":110,"spAtk":45,"spDef":55,"speed":65}'::jsonb),
  ('nidorina', '{"hp":70,"atk":62,"def":67,"spAtk":55,"spDef":55,"speed":56}'::jsonb),
  ('nidorino', '{"hp":61,"atk":72,"def":57,"spAtk":55,"spDef":55,"speed":65}'::jsonb),
  ('clefable', '{"hp":95,"atk":70,"def":73,"spAtk":95,"spDef":90,"speed":60}'::jsonb),
  ('wigglytuff', '{"hp":140,"atk":70,"def":45,"spAtk":85,"spDef":50,"speed":45}'::jsonb),
  ('parasect', '{"hp":60,"atk":95,"def":80,"spAtk":60,"spDef":80,"speed":30}'::jsonb),
  ('venomoth', '{"hp":70,"atk":65,"def":60,"spAtk":90,"spDef":75,"speed":90}'::jsonb),
  ('dugtrio', '{"hp":35,"atk":100,"def":50,"spAtk":50,"spDef":70,"speed":120}'::jsonb),
  ('dodrio', '{"hp":60,"atk":110,"def":70,"spAtk":60,"spDef":60,"speed":110}'::jsonb),
  ('kingler', '{"hp":55,"atk":130,"def":115,"spAtk":50,"spDef":50,"speed":75}'::jsonb),
  ('exeggutor', '{"hp":95,"atk":95,"def":85,"spAtk":125,"spDef":75,"speed":55}'::jsonb),
  ('marowak', '{"hp":60,"atk":80,"def":110,"spAtk":50,"spDef":80,"speed":45}'::jsonb),
  ('seadra', '{"hp":55,"atk":65,"def":95,"spAtk":95,"spDef":45,"speed":85}'::jsonb),
  ('omastar', '{"hp":70,"atk":60,"def":125,"spAtk":115,"spDef":70,"speed":55}'::jsonb),
  ('kabutops', '{"hp":60,"atk":115,"def":105,"spAtk":65,"spDef":70,"speed":80}'::jsonb),
  ('butterfree', '{"hp":60,"atk":45,"def":50,"spAtk":90,"spDef":80,"speed":70}'::jsonb),
  ('beedrill', '{"hp":65,"atk":90,"def":40,"spAtk":45,"spDef":80,"speed":75}'::jsonb),
  ('nidoqueen', '{"hp":90,"atk":92,"def":87,"spAtk":75,"spDef":85,"speed":76}'::jsonb),
  ('nidoking', '{"hp":81,"atk":102,"def":77,"spAtk":85,"spDef":75,"speed":85}'::jsonb)
on conflict (id) do update set base = excluded.base;
insert into public.game_natures (id, up, down) values
  ('hardy', null, null),
  ('lonely', 'atk', 'def'),
  ('brave', 'atk', 'speed'),
  ('adamant', 'atk', 'spAtk'),
  ('naughty', 'atk', 'spDef'),
  ('bold', 'def', 'atk'),
  ('docile', null, null),
  ('relaxed', 'def', 'speed'),
  ('impish', 'def', 'spAtk'),
  ('lax', 'def', 'spDef'),
  ('timid', 'speed', 'atk'),
  ('hasty', 'speed', 'def'),
  ('serious', null, null),
  ('jolly', 'speed', 'spAtk'),
  ('naive', 'speed', 'spDef'),
  ('modest', 'spAtk', 'atk'),
  ('mild', 'spAtk', 'def'),
  ('quiet', 'spAtk', 'speed'),
  ('bashful', null, null),
  ('rash', 'spAtk', 'spDef'),
  ('calm', 'spDef', 'atk'),
  ('gentle', 'spDef', 'def'),
  ('sassy', 'spDef', 'speed'),
  ('careful', 'spDef', 'spAtk'),
  ('quirky', null, null)
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
  if jsonb_array_length(coalesce(p_new -> 'party', '[]'::jsonb)) > 6 then
    return query select 'hard', 'party_size', jsonb_build_object('size', jsonb_array_length(p_new -> 'party'));
  end if;

  for mon in select value from jsonb_array_elements(mons) loop
    continue when jsonb_typeof(mon) is distinct from 'object'; -- ô trống trong hộp PC
    select g.base into base from public.game_species g where g.id = mon ->> 'speciesId';
    if base is null then
      return query select 'hard', 'species', jsonb_build_object('species', mon ->> 'speciesId'); continue;
    end if;
    lvl := (mon ->> 'level')::int;
    if lvl is null or lvl < 1 or lvl > 100 then
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
      if coalesce((mon -> 'ivs' ->> k)::int, -1) not between 0 and 31 then
        return query select 'hard', 'iv', jsonb_build_object('species', mon ->> 'speciesId', 'stat', k);
      end if;
      if coalesce((mon -> 'evs' ->> k)::int, 0) not between 0 and 252 then
        return query select 'hard', 'ev', jsonb_build_object('species', mon ->> 'speciesId', 'stat', k);
      end if;
      ev_total := ev_total + coalesce((mon -> 'evs' ->> k)::int, 0);
    end loop;
    if ev_total > 510 then
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
    if jsonb_typeof(item.value) <> 'number' or (item.value #>> '{}')::numeric not between 0 and 999 then
      return query select 'hard', 'bag', jsonb_build_object('item', item.key, 'count', item.value);
    end if;
  end loop;
  if jsonb_array_length(coalesce(p_new -> 'badges', '[]'::jsonb)) > 8
    or exists (select 1 from jsonb_array_elements_text(coalesce(p_new -> 'badges', '[]'::jsonb)) b where b not in ('wind', 'grass', 'electric', 'water', 'fire', 'rock', 'psychic', 'ice')) then
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
