import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { effectiveSpeed, evYieldFor, expShares } from '../src/battle/formulas.js';
import { ITEMS } from '../src/data/items.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { SPECIES } from '../src/data/monsters.js';
import { createMonster } from '../src/game/monster.js';
import {
  PASS_MARKS, SAFARI, TICKET_MARKS, ballAllowed, ballRule, buyEffortTicket, buyPass, buyZoneTicket, crossedMark, effortOpen,
  effortPrice, formatLeft, markLabel, normalizeSafari, vnDay, zoneLeft, zoneOpen,
} from '../src/game/safari.js';
import { resetState, state } from '../src/game/state.js';
import { questMissing } from '../src/story/quests.js';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
// 10:00 sáng giờ Việt Nam
const T0 = Date.UTC(2026, 10, 21, 3, 0, 0);

function fresh(money = 200000) {
  resetState();
  state.money = money;
}

test('vé Safari: trừ tiền, 30 phút; còn hạn thì không mua thêm (không cộng dồn)', () => {
  fresh();
  assert.equal(zoneOpen(T0), false);
  assert.deepEqual(buyZoneTicket(T0), { ok: true });
  assert.equal(state.money, 200000 - SAFARI.zonePrice);
  assert.equal(zoneLeft(T0), 30 * MIN);
  assert.equal(zoneOpen(T0 + 29 * MIN), true);
  assert.equal(zoneOpen(T0 + 30 * MIN), false);
  assert.match(buyZoneTicket(T0 + 10 * MIN).error, /vẫn còn 20:00/);
  assert.equal(state.money, 200000 - SAFARI.zonePrice, 'không trừ tiền lần mua bị chặn');
  // Hết hạn rồi thì mua được vé mới, tính từ lúc mua
  assert.deepEqual(buyZoneTicket(T0 + 40 * MIN), { ok: true });
  assert.equal(zoneLeft(T0 + 40 * MIN), 30 * MIN);
  // Vé Safari Effort cũng vậy
  buyEffortTicket(T0);
  assert.ok(buyEffortTicket(T0 + 5 * MIN).error);
  assert.equal(effortOpen(T0 + 20 * MIN), false);
  assert.deepEqual(buyEffortTicket(T0 + 20 * MIN), { ok: true });
});

test('không đủ tiền: không bán, không đổi gì', () => {
  fresh(5000);
  assert.ok(buyZoneTicket(T0).error);
  assert.ok(buyEffortTicket(T0).error);
  assert.ok(buyPass(T0).error);
  assert.equal(state.money, 5000);
  assert.equal(zoneOpen(T0), false);
});

test('gói 24 giờ: vào khu tự do, vé Effort 2.000, không cần vé Safari; mỗi ngày (giờ VN) mua một lần', () => {
  fresh();
  assert.equal(effortPrice(T0), 10000);
  assert.deepEqual(buyPass(T0), { ok: true });
  assert.equal(state.money, 200000 - 55000);
  assert.equal(zoneOpen(T0 + 23 * HOUR), true);
  assert.equal(zoneOpen(T0 + 24 * HOUR), false);
  assert.equal(effortPrice(T0), 2000);
  assert.match(buyZoneTicket(T0).error, /gói 24 giờ/);
  assert.match(buyPass(T0 + HOUR).error, /vẫn còn/);
  buyEffortTicket(T0);
  assert.equal(state.money, 200000 - 55000 - 2000);
  // Gói hết hạn (sang ngày hôm sau, 10:00) thì mua lại được
  assert.deepEqual(buyPass(T0 + 24 * HOUR), { ok: true });
  // Cùng một ngày không mua hai lần, kể cả khi gói đã hết (vd chỉnh tay hạn gói trong bản lưu)
  state.safari.passUntil = 0;
  assert.match(buyPass(T0 + 25 * HOUR).error, /Mỗi ngày/);
  // Ngày tính theo giờ Việt Nam: 23:59 và 00:01 hôm sau là hai ngày khác nhau
  const day = (h, m) => vnDay(Date.UTC(2026, 10, 21, h - 7, m));
  assert.notEqual(day(23, 59), day(24, 1));
  assert.equal(day(0, 1), day(23, 59));
});

test('bóng: khu Safari ném mọi loại bóng như ngoài đường; khu Effort không bắt', () => {
  const ok = (id, rule) => ballAllowed(id, ITEMS[id], rule);
  assert.equal(ballRule('safariZone'), 'normal');
  assert.equal(ballRule('route1'), 'normal');
  assert.equal(ballRule('safariEffort'), 'none');
  assert.ok(ok('ball', 'normal') && ok('ultraBall', 'normal') && ok('masterBall', 'normal'));
  assert.ok(!ok('ball', 'none') && !ok('ultraBall', 'none'));
  assert.ok(ok('potion', 'none'), 'đồ không phải bóng vẫn dùng được');
  assert.equal(ITEMS.safariBall, undefined, 'không còn Safari Ball');
});

test('bản lưu: đọc hạn vé, dữ liệu lỗi thì coi như không có vé; hiện thời gian còn lại', () => {
  assert.deepEqual(normalizeSafari(undefined), { zoneUntil: 0, effortUntil: 0, passUntil: 0, passDay: -1 });
  assert.deepEqual(normalizeSafari({ zoneUntil: 5, effortUntil: 'x', passUntil: -1, passDay: 3 }), { zoneUntil: 5, effortUntil: 0, passUntil: 0, passDay: 3 });
  assert.equal(formatLeft(30 * MIN), '30:00');
  assert.equal(formatLeft(65 * 1000), '1:05');
  assert.equal(formatLeft(23 * HOUR + 10 * MIN), '23 giờ 10 phút');
});

test('giờ máy chủ: hàm server_now (supabase/safari.sql) trả về giờ hiện tại, ai cũng gọi được', async () => {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated;');
  await db.exec(readFileSync(new URL('../supabase/safari.sql', import.meta.url), 'utf8'));
  const { rows } = await db.query('select public.server_now() as t');
  assert.ok(Math.abs(new Date(rows[0].t).getTime() - Date.now()) < 60 * 1000);
  assert.equal((await db.query(`select has_function_privilege('anon', 'public.server_now()', 'execute') as ok`)).rows[0].ok, true);
});

test('nhà Safari ở Lò Gốm (gym 5): hai cửa lớn vào khu Safari / Safari Effort', () => {
  assert.ok(MAPS.town6.buildings.some((b) => b.to === 'safariGate'));
  assert.ok(!MAPS.town8.buildings.some((b) => b.to === 'safariGate'));
  assert.equal(MAPS.safariZone.place, 'town6');
  const to = MAPS.safariGate.warps.map((w) => w.to).sort();
  assert.deepEqual(to, ['safariEffort', 'safariZone']);
});

test('khu Safari: 4 khu + hồ; tỉ lệ gặp đúng yêu cầu (1% / 5% / 10%)', () => {
  const zone = MAPS.safariZone;
  assert.equal(zone.areas.length, 4);
  const tables = [...zone.areas.map((a) => a.table), ...Object.values(zone.water).filter((t) => ENCOUNTERS[t])];
  const want = {
    bulbasaur: 1, charmander: 1, squirtle: 1, eevee: 1,
    kangaskhan: 5, scyther: 5, dratini: 5, lapras: 5,
    exeggutor: 10, arcanine: 10, ninetales: 10, vileplume: 10, victreebel: 10, starmie: 10, chansey: 10,
  };
  const seen = new Set();
  for (const t of tables) {
    const total = ENCOUNTERS[t].reduce((s, e) => s + e.weight, 0);
    for (const e of ENCOUNTERS[t]) {
      if (!(e.species in want)) continue;
      seen.add(e.species);
      assert.equal((100 * e.weight) / total, want[e.species], `${e.species} ở ${t}`);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(want).sort(), 'đủ các loài trong danh sách');
  // Vẫn có loài chỉ gặp ngoài tự nhiên ở Safari
  const outside = new Set(Object.entries(ENCOUNTERS).filter(([t]) => !/^(safari|effort)-/.test(t)).flatMap(([, list]) => list.map((e) => e.species)));
  for (const s of ['bulbasaur', 'charmander', 'squirtle', 'arcanine', 'ninetales', 'starmie']) assert.ok(!outside.has(s), `${s} chỉ có ở Safari`);
});

test('mốc báo giờ: vé mỗi 5 phút, còn 5 phút mỗi 2 phút, còn 1 phút mỗi 30 giây; gói 24 giờ mỗi 15 phút', () => {
  const MIN_ = 60 * 1000;
  assert.deepEqual(TICKET_MARKS.map((m) => m / 1000), [1800, 1500, 1200, 900, 600, 300, 180, 60, 30]);
  assert.equal(PASS_MARKS[0], 24 * 60 * MIN_);
  assert.ok(PASS_MARKS.slice(0, -5).every((m, i, a) => i === 0 || a[i - 1] - m === 15 * MIN_), 'gói: cách nhau 15 phút');
  assert.deepEqual(PASS_MARKS.slice(-6).map((m) => m / 1000), [900, 600, 300, 180, 60, 30]);
  // Mỗi giây kiểm tra một lần: chỉ báo đúng lúc vừa qua mốc
  assert.equal(crossedMark(20 * MIN_ + 500, 20 * MIN_ - 500, TICKET_MARKS), 20 * MIN_);
  assert.equal(crossedMark(19 * MIN_, 19 * MIN_ - 1000, TICKET_MARKS), null);
  assert.equal(crossedMark(31 * 1000, 29 * 1000, TICKET_MARKS), 30 * 1000);
  // Qua nhiều mốc một lúc (vừa mở lại tab): báo mốc nhỏ nhất
  assert.equal(crossedMark(10 * MIN_, 2 * MIN_, TICKET_MARKS), 3 * MIN_);
  assert.equal(markLabel(5 * MIN_), '5 phút');
  assert.equal(markLabel(30 * 1000), '30 giây');
  assert.equal(markLabel(75 * MIN_), '1 giờ 15 phút');
  assert.equal(markLabel(24 * 60 * MIN_), '24 giờ');
});

test('khu Safari Effort: 3 khu x 2 bãi, mỗi bãi đúng 1 loài +3 EV cấp 10-12, đủ 6 chỉ số; luống quả đúng chỉ số', () => {
  const map = MAPS.safariEffort;
  assert.equal(map.areas.length, 6);
  const species = {};
  for (const area of map.areas) {
    const table = ENCOUNTERS[area.table];
    assert.equal(table.length, 1, area.table);
    const { species: id, min, max } = table[0];
    assert.ok(min >= 10 && max <= 12, `${id}: cấp ${min}-${max}`);
    const ev = SPECIES[id].evYield;
    assert.equal(Object.keys(ev).length, 1, `${id} chỉ cho một chỉ số`);
    const [[stat, n]] = Object.entries(ev);
    assert.equal(n, 3, `${id} cho +3`);
    species[stat] = id;
    // Trong khu Safari / Effort, loài này chỉ xuất hiện đúng ở bãi của nó
    const elsewhere = Object.entries(ENCOUNTERS)
      .filter(([t, list]) => /^effort-/.test(t) && t !== area.table && list.some((e) => e.species === id));
    assert.deepEqual(elsewhere.map(([t]) => t), [], `${id} chỉ ở ${area.table}`);
    const [x1, y1, x2, y2] = area.rect;
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) assert.equal(map.areaAt(x, y)?.table, area.table);
  }
  assert.deepEqual(species, {
    hp: 'wigglytuff', def: 'poliwrath', atk: 'victreebel', spAtk: 'alakazam', spDef: 'blastoise', speed: 'pidgeot',
  });
  // Mỗi chỉ số một luống 2 cây quả giảm đúng chỉ số đó, nằm cùng khu với loài của nó
  const trees = map.objects.filter((o) => o.kind === 'berry');
  assert.equal(trees.length, 12);
  for (const area of map.areas) {
    const stat = Object.keys(SPECIES[ENCOUNTERS[area.table][0].species].evYield)[0];
    const bed = trees.filter((t) => ITEMS[t.berry].ev === stat);
    assert.equal(bed.length, 2, stat);
    assert.equal(bed[0].y, bed[1].y);
    assert.equal(Math.abs(bed[0].x - bed[1].x), 1, `${stat}: 2 cây liền nhau`);
    assert.ok(bed.every((t) => !map.isSolid(t.x, t.y - 1)) || bed.every((t) => !map.isSolid(t.x, t.y + 1)));
    assert.ok(bed.every((t) => t.x >= area.rect[0] - 1 && t.x <= area.rect[2] + 1), `${stat}: luống cùng khu`);
  }
});

test('Macho Brace: EV gấp đôi, Tốc độ trong trận giảm một nửa', () => {
  const mon = createMonster('pikachu', 30);
  assert.deepEqual(evYieldFor(mon, { speed: 2 }), { speed: 2 });
  const fast = effectiveSpeed(mon);
  mon.heldItem = 'machoBrace';
  assert.deepEqual(evYieldFor(mon, { speed: 2, atk: 1 }), { speed: 4, atk: 2 });
  assert.equal(effectiveSpeed(mon), Math.floor(fast * 0.5));
});

test('Exp. Share: con không ra trận vẫn nhận 50% EXP; con ra trận không bị chia bớt', () => {
  const foe = createMonster('rattata', 20);
  const fighter = createMonster('pikachu', 20);
  const holder = createMonster('bulbasaur', 20);
  holder.heldItem = 'expShare';
  const alone = expShares(foe, [fighter])[0].amount;
  const shares = expShares(foe, [fighter], { sharers: [holder] });
  assert.equal(shares.length, 2);
  assert.equal(shares[0].amount, alone);
  assert.equal(shares[1].mon, holder);
  assert.equal(shares[1].amount, Math.floor(alone * 0.5));
  // Con ra trận mà cầm Exp. Share thì chỉ nhận phần của mình (không nhận hai lần)
  assert.equal(expShares(foe, [holder], { sharers: [holder] }).length, 1);
});

test('NPC tặng Exp. Share (bắt 30 loài) và Macho Brace (Pokémon đã luyện 100 EV)', () => {
  resetState();
  assert.ok(questMissing({ caught: 30 }).length);
  for (let i = 1; i <= 30; i++) state.dex.caught.add(i);
  assert.deepEqual(questMissing({ caught: 30 }), []);
  const mon = createMonster('pikachu', 20);
  state.party = [mon];
  assert.ok(questMissing({ evTotal: 100 }).length);
  mon.evs.atk = 60;
  mon.evs.speed = 40;
  assert.deepEqual(questMissing({ evTotal: 100 }), []);
  assert.equal(ITEMS.expShare.kind, 'held');
  assert.equal(ITEMS.machoBrace.kind, 'held');
});
