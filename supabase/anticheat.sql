-- TỰ SINH bởi scripts/gen-anticheat-sql.mjs (npm run gen:anticheat) — đừng sửa tay, sửa script rồi sinh lại.
-- Chống gian lận phía máy chủ. Chạy SAU schema.sql và trades.sql: Supabase SQL Editor → dán toàn bộ → Run (chạy lại được).
--
-- Mỗi lần game gửi bản lưu lên (bảng saves), máy chủ kiểm tra:
--  • Chặn hẳn (không ghi bản lưu đó lên mạng, bản trên mạng giữ nguyên): dữ liệu không thể có trong game — loài lạ, cấp ngoài
--    1-100, thiếu IV / IV ngoài 0-31, thiếu HP, EV quá 252 / tổng quá 510, chiêu ngoài 1-4, HP quá HP tối đa, đội quá 6 con, đồ quá 999,
--    tiền âm / quá lớn, huy hiệu lạ / quá 8.
--  • Đáng ngờ (vẫn ghi, nhưng ghi lại và KHOÁ GIAO DỊCH tài khoản): chỉ số không khớp công thức của game (sửa thẳng chỉ số),
--    thiếu chỉ số, tài sản (tiền + giá mua của đồ trong túi) / số Pokémon / tổng cấp / số Pokémon shiny / số Master Ball
--    (đồ không bán) tăng vọt so với thời gian chơi thêm, thời gian chơi bị lùi, đã ghi nhận giao dịch mà vẫn giữ Pokémon đã
--    đưa đi. Tiền và đồ tính chung theo giá mua: mua đồ (tiền đổi ra đồ) hay bán đồ (giá bán thấp hơn) không làm tài sản tăng.
--
-- "Tăng vọt" so với MỐC (bảng save_baseline), không so với bản ngay trước: gửi nhiều lần, mỗi lần tăng một chút vẫn bị
-- cộng dồn. Mốc dời lên bản mới nhất khi đã cũ hơn 10 phút. Thêm MỐC NGÀY (cột day_summary / day_at) dời mỗi
-- 24 giờ: tài sản tăng trong một mốc ngày quá 1000000₽ cũng là đáng ngờ (wealth_day), nên cộng lén từng chút
-- mỗi 10 phút (dưới ngưỡng mốc ngắn) cũng không lọt quá 1000000₽ một ngày. Thời gian chơi thêm tính theo đồng hồ máy chủ: lấy số nhỏ
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
-- Vật phẩm: giá mua (tính tài sản), loại ('key' = vật phẩm quan trọng, không giao dịch được: trades.sql)
create table if not exists public.game_items (id text primary key, name text not null, kind text not null, price integer not null);
alter table public.game_items enable row level security;
insert into public.game_items (id, name, kind, price) values
  ('ball', 'Poké Ball', 'ball', 200),
  ('greatBall', 'Great Ball', 'ball', 600),
  ('ultraBall', 'Ultra Ball', 'ball', 1200),
  ('masterBall', 'Master Ball', 'ball', 0),
  ('potion', 'Potion', 'heal', 300),
  ('superPotion', 'Super Potion', 'heal', 700),
  ('hyperPotion', 'Hyper Potion', 'heal', 1500),
  ('revive', 'Revive', 'revive', 2000),
  ('maxRevive', 'Max Revive', 'revive', 4000),
  ('antidote', 'Antidote', 'cure', 200),
  ('burnHeal', 'Burn Heal', 'cure', 300),
  ('paralyzeHeal', 'Paralyze Heal', 'cure', 300),
  ('awakening', 'Awakening', 'cure', 100),
  ('iceHeal', 'Ice Heal', 'cure', 100),
  ('fullHeal', 'Full Heal', 'cure', 400),
  ('fireStone', 'Fire Stone', 'evolution', 2100),
  ('waterStone', 'Water Stone', 'evolution', 2100),
  ('thunderStone', 'Thunder Stone', 'evolution', 2100),
  ('leafStone', 'Leaf Stone', 'evolution', 2100),
  ('moonStone', 'Moon Stone', 'evolution', 2100),
  ('charcoal', 'Charcoal', 'held', 1000),
  ('mysticWater', 'Mystic Water', 'held', 1000),
  ('miracleSeed', 'Miracle Seed', 'held', 1000),
  ('magnet', 'Magnet', 'held', 1000),
  ('sharpBeak', 'Sharp Beak', 'held', 1000),
  ('poisonBarb', 'Poison Barb', 'held', 1000),
  ('silkScarf', 'Silk Scarf', 'held', 1000),
  ('blackGlasses', 'Black Glasses', 'held', 1000),
  ('hardStone', 'Hard Stone', 'held', 1000),
  ('twistedSpoon', 'Twisted Spoon', 'held', 1000),
  ('neverMeltIce', 'Never-Melt Ice', 'held', 1000),
  ('everstone', 'Everstone', 'held', 300),
  ('leftovers', 'Leftovers', 'held', 4000),
  ('luckyEgg', 'Lucky Egg', 'held', 4000),
  ('machoBrace', 'Macho Brace', 'held', 3000),
  ('expShare', 'Exp. Share', 'held', 3000),
  ('bicycle', 'Xe đạp', 'key', 0),
  ('rareCandy', 'Rare Candy', 'level', 15000),
  ('hmSurf', 'HM03 Surf', 'key', 0),
  ('townMap', 'Bản đồ vùng', 'key', 0),
  ('badgeCase', 'Hộp huy hiệu', 'key', 0),
  ('martParcel', 'Gói hàng', 'key', 0),
  ('bikeChain', 'Xích xe đạp', 'key', 0),
  ('bikeWheel', 'Bánh xe đạp', 'key', 0),
  ('bikeSeat', 'Yên xe đạp', 'key', 0),
  ('fuse', 'Cầu chì', 'key', 0),
  ('helixFossil', 'Helix Fossil', 'key', 0),
  ('domeFossil', 'Dome Fossil', 'key', 0),
  ('oldAmber', 'Old Amber', 'key', 0),
  ('arcanineMount', 'Thú cưỡi Arcanine', 'key', 0),
  ('laprasMount', 'Thú cưỡi Lapras', 'key', 0),
  ('oldRod', 'Cần câu cũ', 'key', 0),
  ('goodRod', 'Cần câu tốt', 'key', 0),
  ('superRod', 'Cần câu siêu', 'key', 0),
  ('repel', 'Repel', 'repel', 400),
  ('superRepel', 'Super Repel', 'repel', 700),
  ('maxRepel', 'Max Repel', 'repel', 900),
  ('escapeRope', 'Escape Rope', 'escape', 550),
  ('oranBerry', 'Oran Berry', 'heal', 20),
  ('sitrusBerry', 'Sitrus Berry', 'heal', 20),
  ('figyBerry', 'Figy Berry', 'heal', 20),
  ('cheriBerry', 'Cheri Berry', 'cure', 20),
  ('chestoBerry', 'Chesto Berry', 'cure', 20),
  ('pechaBerry', 'Pecha Berry', 'cure', 20),
  ('rawstBerry', 'Rawst Berry', 'cure', 20),
  ('aspearBerry', 'Aspear Berry', 'cure', 20),
  ('lumBerry', 'Lum Berry', 'cure', 20),
  ('leppaBerry', 'Leppa Berry', 'pp', 20),
  ('pomegBerry', 'Pomeg Berry', 'ev', 20),
  ('kelpsyBerry', 'Kelpsy Berry', 'ev', 20),
  ('qualotBerry', 'Qualot Berry', 'ev', 20),
  ('hondewBerry', 'Hondew Berry', 'ev', 20),
  ('grepaBerry', 'Grepa Berry', 'ev', 20),
  ('tamatoBerry', 'Tamato Berry', 'ev', 20),
  ('tmMegaPunch', 'TM01 Mega Punch', 'tm', 3000),
  ('tmMegaKick', 'TM02 Mega Kick', 'tm', 3000),
  ('tmTakeDown', 'TM03 Take Down', 'tm', 3000),
  ('tmBodySlam', 'TM04 Body Slam', 'tm', 4000),
  ('tmSubmission', 'TM05 Submission', 'tm', 3000),
  ('tmDoubleTeam', 'TM06 Double Team', 'tm', 2000),
  ('tmReflect', 'TM07 Reflect', 'tm', 2000),
  ('tmLightScreen', 'TM08 Light Screen', 'tm', 2000),
  ('tmSwift', 'TM09 Swift', 'tm', 2000),
  ('tmRest', 'TM10 Rest', 'tm', 2000),
  ('tmSunnyDay', 'TM11 Sunny Day', 'tm', 3000),
  ('tmRainDance', 'TM12 Rain Dance', 'tm', 3000),
  ('tmAirSlash', 'TM13 Air Slash', 'tm', 3000),
  ('tmGigaDrain', 'TM14 Giga Drain', 'tm', 3000),
  ('tmThunderbolt', 'TM15 Thunderbolt', 'tm', 3000),
  ('tmWaterPulse', 'TM16 Water Pulse', 'tm', 3000),
  ('tmFlamethrower', 'TM17 Flamethrower', 'tm', 3000),
  ('tmRockSlide', 'TM18 Rock Slide', 'tm', 3000),
  ('tmPsychic', 'TM19 Psychic', 'tm', 3000),
  ('tmIceBeam', 'TM20 Ice Beam', 'tm', 3000),
  ('tmEarthquake', 'TM21 Earthquake', 'tm', 3000),
  ('tmShadowBall', 'TM22 Shadow Ball', 'tm', 3000),
  ('tmSludgeBomb', 'TM23 Sludge Bomb', 'tm', 3000),
  ('tmBrickBreak', 'TM24 Brick Break', 'tm', 3000),
  ('tmThunderWave', 'TM25 Thunder Wave', 'tm', 2000),
  ('tmEnergyBall', 'TM26 Energy Ball', 'tm', 3000)
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
    if jsonb_typeof(item.value) <> 'number' or (item.value #>> '{}')::numeric not between 0 and 999 then
      return query select 'hard', 'bag', jsonb_build_object('item', item.key, 'count', item.value);
    end if;
  end loop;
  if jsonb_array_length(coalesce(p_new -> 'badges', '[]'::jsonb)) > 8
    or exists (select 1 from jsonb_array_elements_text(coalesce(p_new -> 'badges', '[]'::jsonb)) b where b not in ('wind', 'grass', 'electric', 'water', 'fire', 'rock', 'psychic', 'ice')) then
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
  if gain > 100000 + 5000 * minutes then
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
  -- Mốc ngày: tài sản tăng trong một mốc 24 giờ quá 1000000₽ (không so khi ghi tay / bản lưu bị chặn hẳn)
  if not trusted and not hard then
    day_gain := (public.save_summary(new.data) ->> 'wealth')::numeric - (day ->> 'wealth')::numeric;
    if day_gain > 1000000 then
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
  if trusted or base_at < now() - interval '10 minutes' then
    base := public.save_summary(new.data);
    base_at := now();
  end if;
  if trusted or day_at < now() - interval '24 hours' then
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
