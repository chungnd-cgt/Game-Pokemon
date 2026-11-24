import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abilityOf, calcDamage, catchChance, effectiveSpeed, escapeChance, moveEffect, moveHits,
} from '../src/battle/formulas.js';
import {
  changeStage, checkCanMove, inflictStatus, stageMessage, stageMultiplier, statusBlocked, statusDamage,
} from '../src/battle/status.js';
import { speciesAbilities } from '../src/data/abilities.js';
import { BERRY_IDS, ITEMS } from '../src/data/items.js';
import { MAPS } from '../src/data/map.js';
import { MOVES } from '../src/data/moves.js';
import { SPECIES } from '../src/data/monsters.js';
import { NATURES, NATURE_IDS } from '../src/data/natures.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { EV_MAX_STAT, EV_MAX_TOTAL, IV_MAX, STAT_KEYS, parseEvYield, parseFemaleRatio } from '../src/data/stats.js';
import { REGROW_MAX_MS, REGROW_MIN_MS, isRipe, pickBerries } from '../src/game/berries.js';
import { applyItem, itemProblem } from '../src/game/itemUse.js';
import {
  SHINY_ODDS, calcStats, createMonster, evTotal, gainEvs, healMonster, upgradeMonster,
} from '../src/game/monster.js';
import { loadGame, saveGame } from '../src/game/save.js';
import { assignHotbar, setHotbarSlot, swapHotbarSlots } from '../src/game/hotbar.js';
import { BOX_SLOTS, boxCount, moveMon, releaseMon, releaseProblem } from '../src/game/storage.js';
import { ITEM_MAX, addCaught, addItem, itemCount, resetState, setFlag, state } from '../src/game/state.js';
import { STORY_NPCS } from '../src/story/chapter1.js';

const fixed = (v) => () => v;
// Pokémon cố định để tính toán: IV 31, không EV, tính cách trung tính
function mon(speciesId, level, extra = {}) {
  const m = createMonster(speciesId, level, { rng: fixed(0.99), shiny: false, hiddenAbility: false });
  Object.assign(m, { ivs: Object.fromEntries(STAT_KEYS.map((k) => [k, 31])), nature: 'hardy' });
  Object.assign(m, calcStats(SPECIES[speciesId], level, m.ivs, m.evs, m.nature), extra);
  m.hp = extra.hp ?? m.maxHp;
  return m;
}

// ---------- IV / EV / tính cách ----------

test('công thức chỉ số chuẩn: IV, EV và tính cách', () => {
  const sp = SPECIES.bulbasaur; // HP 45, Atk 49
  const ivs = Object.fromEntries(STAT_KEYS.map((k) => [k, 31]));
  const none = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
  assert.equal(calcStats(sp, 50, ivs, none, 'hardy').maxHp, 120);
  assert.equal(calcStats(sp, 50, ivs, none, 'hardy').atk, 69);
  assert.equal(calcStats(sp, 50, ivs, none, 'adamant').atk, 75, '+10% Atk');
  assert.equal(calcStats(sp, 50, ivs, none, 'modest').atk, 62, '-10% Atk');
  assert.equal(calcStats(sp, 100, ivs, { ...none, atk: 252 }, 'hardy').atk, calcStats(sp, 100, ivs, none, 'hardy').atk + 63);
});

test('25 tính cách, 5 tính cách trung tính, HP không bị ảnh hưởng', () => {
  assert.equal(NATURE_IDS.length, 25);
  assert.equal(Object.values(NATURES).filter((n) => !n.up).length, 5);
  for (const n of Object.values(NATURES)) assert.notEqual(n.up, 'hp');
});

test('Pokémon mới có IV 0-31, EV 0, tính cách, đặc tính đúng loài, giới tính theo tỉ lệ', () => {
  for (let i = 0; i < 50; i++) {
    const m = createMonster('pikachu', 5);
    for (const k of STAT_KEYS) assert.ok(m.ivs[k] >= 0 && m.ivs[k] <= IV_MAX);
    assert.equal(evTotal(m), 0);
    assert.ok(NATURES[m.nature]);
    const { normal, hidden } = SPECIES.pikachu.abilities;
    assert.ok(m.hiddenAbility ? m.ability === hidden : normal.includes(m.ability));
    assert.ok(['male', 'female'].includes(m.gender));
  }
  assert.equal(createMonster('charmander', 5, { rng: fixed(0.2) }).gender, 'male', 'Charmander chỉ 12.5% là cái');
  assert.equal(createMonster('charmander', 5, { rng: fixed(0.1) }).gender, 'female');
});

test('dữ liệu Pokédex: EV nhận được, tỉ lệ giới tính, đặc tính ẩn', () => {
  assert.deepEqual(parseEvYield('2 Speed'), { speed: 2 });
  assert.deepEqual(parseEvYield('1 Sp. Atk, 1 Defense'), { spAtk: 1, def: 1 });
  assert.equal(parseFemaleRatio('87.5% male, 12.5% female'), 0.125);
  assert.equal(parseFemaleRatio('Genderless'), null);
  assert.deepEqual(speciesAbilities('pikachu'), { normal: ['static'], hidden: 'lightningRod' });
  assert.deepEqual(SPECIES.pikachu.evYield, { speed: 2 });
  for (const sp of Object.values(SPECIES)) assert.ok(sp.abilities.normal.length > 0, `${sp.id} thiếu đặc tính`);
});

test('shiny 1/8192, Pokémon của nhà huấn luyện không bao giờ shiny', () => {
  assert.equal(SHINY_ODDS, 8192);
  assert.equal(createMonster('rattata', 3, { rng: fixed(0) }).shiny, true);
  assert.equal(createMonster('rattata', 3, { rng: fixed(1 / 8192 + 1e-9) }).shiny, false);
  assert.equal(createMonster('rattata', 3, { rng: fixed(0), trainer: true }).shiny, false);
});

test('EV: tối đa 252 mỗi chỉ số, 510 tổng, chỉ số tăng theo', () => {
  const m = mon('pidgey', 50);
  const before = m.speed;
  for (let i = 0; i < 300; i++) gainEvs(m, { speed: 1 });
  assert.equal(m.evs.speed, EV_MAX_STAT);
  assert.ok(m.speed > before);
  for (let i = 0; i < 300; i++) gainEvs(m, { atk: 2, def: 2 });
  assert.equal(evTotal(m), EV_MAX_TOTAL);
});

// ---------- Loại chiêu, bậc chỉ số, đặc tính ----------

test('mỗi chiêu tự mang loại: Fire Fang là vật lý dù hệ Lửa, Ember là đặc biệt', () => {
  assert.equal(MOVES.fireFang.category, 'physical');
  assert.equal(MOVES.ember.category, 'special');
  for (const m of Object.values(MOVES)) {
    assert.ok(['physical', 'special', 'status'].includes(m.category), m.id);
    assert.ok(m.pp > 0, `${m.id} thiếu PP`);
  }
  const target = mon('rattata', 20);
  const strong = mon('growlithe', 20, { atk: 200, spAtk: 10 });
  const weak = mon('growlithe', 20, { atk: 20, spAtk: 10 });
  const r = fixed(0.5);
  assert.ok(calcDamage(strong, target, MOVES.fireFang, r).damage > calcDamage(weak, target, MOVES.fireFang, r).damage);
  assert.equal(calcDamage(strong, target, MOVES.ember, r).damage, calcDamage(weak, target, MOVES.ember, r).damage);
});

test('bậc chỉ số -6..+6 và câu thông báo', () => {
  assert.equal(stageMultiplier(1), 1.5);
  assert.equal(stageMultiplier(-1), 2 / 3);
  assert.equal(stageMultiplier(6), 4);
  assert.equal(stageMultiplier(-6), 0.25);
  const m = mon('rattata', 5);
  assert.equal(changeStage(m, 'atk', -2), -2);
  assert.equal(changeStage(m, 'atk', -10), -4);
  assert.equal(changeStage(m, 'atk', -1), 0);
  assert.equal(stageMessage('Rattata', 'atk', 0, -1), 'Rattata không thể giảm Atk thêm nữa!');
  assert.equal(stageMessage('Rattata', 'def', -2, -2), 'Rattata bị giảm mạnh Def!');
  const fast = mon('pikachu', 20);
  const base = effectiveSpeed(fast);
  changeStage(fast, 'speed', 1);
  assert.equal(effectiveSpeed(fast), Math.floor(fast.speed * 1.5));
  assert.ok(base < effectiveSpeed(fast));
});

test('bậc chỉ số ảnh hưởng sát thương: Tấn công / Phòng thủ cho chiêu vật lý, ĐB cho chiêu đặc biệt; chí mạng bỏ bậc bất lợi', () => {
  const a = mon('rattata', 30, { ability: 'guts' });
  const d = mon('pidgey', 30, { ability: 'keenEye' });
  const hit = (move, rng = fixed(0.5)) => calcDamage(a, d, MOVES[move], rng).damage;
  const set = (as, ds) => { a.stages = as; d.stages = ds; };
  set({}, {});
  const tackle = hit('tackle');
  const swift = hit('swift');
  const atkUp = (set({ atk: 2 }, {}), hit('tackle'));
  const atkDown = (set({ atk: -2 }, {}), hit('tackle'));
  assert.ok(atkUp > tackle && atkDown < tackle, `Tấn công ±2: ${atkDown} < ${tackle} < ${atkUp}`);
  const defUp = (set({}, { def: 2 }), hit('tackle'));
  const defDown = (set({}, { def: -2 }), hit('tackle'));
  assert.ok(defUp < tackle && defDown > tackle, `Phòng thủ ±2: ${defDown} > ${tackle} > ${defUp}`);
  // Bậc Tấn công / Phòng thủ không đụng tới chiêu đặc biệt và ngược lại
  set({ atk: 6 }, { def: -6 });
  assert.equal(hit('swift'), swift);
  set({ spAtk: 2 }, {});
  assert.ok(hit('swift') > swift);
  assert.equal(hit('tackle'), tackle);
  set({}, { spDef: 2 });
  assert.ok(hit('swift') < swift);
  // Chí mạng bỏ qua bậc giảm của bên đánh và bậc tăng của bên đỡ, nhưng vẫn giữ bậc có lợi
  set({}, {});
  const crit = hit('tackle', fixed(0));
  set({ atk: -2 }, { def: 2 });
  assert.equal(hit('tackle', fixed(0)), crit);
  set({ atk: 2 }, {});
  assert.ok(hit('tackle', fixed(0)) > crit);
});

test('đặc tính: hút chiêu, Neutralizing Gas, Blaze, Hustle, Swift Swim, Run Away', () => {
  const poliwag = mon('poliwag', 10, { ability: 'waterAbsorb' });
  assert.deepEqual(moveEffect(MOVES.waterGun, poliwag), { effectiveness: 0, absorbedBy: 'waterAbsorb' });
  assert.equal(moveEffect(MOVES.waterGun, poliwag, { gas: true }).effectiveness, 0.5, 'Neutralizing Gas tắt Water Absorb');
  assert.equal(abilityOf(mon('koffing', 10, { ability: 'neutralizingGas' }), { gas: true }), 'neutralizingGas');

  const target = mon('rattata', 20);
  const full = mon('charmander', 20, { ability: 'blaze' });
  const pinch = mon('charmander', 20, { ability: 'blaze' });
  pinch.hp = 1;
  assert.ok(calcDamage(pinch, target, MOVES.ember, fixed(0.5)).damage > calcDamage(full, target, MOVES.ember, fixed(0.5)).damage);

  const hustle = mon('rattata', 10, { ability: 'hustle' });
  assert.equal(moveHits(MOVES.tackle, hustle, target, fixed(0.85)), false, 'Hustle: chiêu vật lý chỉ còn 80% chính xác');
  assert.equal(moveHits(MOVES.tackle, mon('rattata', 10, { ability: 'guts' }), target, fixed(0.85)), true);

  const swimmer = mon('poliwag', 10, { ability: 'swiftSwim' });
  assert.equal(effectiveSpeed(swimmer, { weather: 'rain' }), swimmer.speed * 2);
  assert.equal(escapeChance(mon('rattata', 2, { ability: 'runAway' }), mon('pikachu', 50), 0), 1);
});

test('độ chính xác giảm theo bậc (Sand Attack)', () => {
  const a = mon('rattata', 10, { ability: 'guts' });
  const b = mon('pidgey', 10);
  assert.equal(moveHits(MOVES.tackle, a, b, fixed(0.7)), true);
  changeStage(a, 'accuracy', -1);
  assert.equal(moveHits(MOVES.tackle, a, b, fixed(0.7)), true);
  changeStage(a, 'accuracy', -1);
  assert.equal(moveHits(MOVES.tackle, a, b, fixed(0.7)), false, '-2 bậc: còn 60%');
  assert.equal(moveHits(MOVES.withdraw, a, b, fixed(0.999)), true, 'chiêu tự dùng không bao giờ trượt');
});

// ---------- Trạng thái ----------

test('miễn nhiễm trạng thái theo hệ', () => {
  assert.equal(statusBlocked(mon('charmander', 5), 'brn'), 'immune');
  assert.equal(statusBlocked(mon('pikachu', 5), 'par'), 'immune');
  assert.equal(statusBlocked(mon('ekans', 5), 'psn'), 'immune');
  assert.equal(statusBlocked(mon('bulbasaur', 5), 'slp', MOVES.sleepPowder), 'immune', 'hệ Cỏ không dính bột');
  assert.equal(statusBlocked(mon('rattata', 5), 'slp', MOVES.sleepPowder), null);
  const sick = mon('rattata', 5);
  inflictStatus(sick, 'psn');
  assert.equal(statusBlocked(sick, 'par'), 'already');
});

test('ngủ 1-3 lượt, tê liệt 25% không cử động và chậm một nửa, đóng băng 20% tự tan', () => {
  const m = mon('rattata', 5);
  inflictStatus(m, 'slp', fixed(0.99));
  assert.equal(m.sleepTurns, 3);
  for (let i = 0; i < 3; i++) assert.equal(checkCanMove(m).canMove, false);
  assert.equal(checkCanMove(m).canMove, true);
  assert.equal(m.status, null);

  inflictStatus(m, 'par');
  assert.equal(checkCanMove(m, fixed(0.2)).canMove, false);
  assert.equal(checkCanMove(m, fixed(0.3)).canMove, true);
  assert.equal(effectiveSpeed(m), Math.floor(m.speed / 2));

  m.status = 'frz';
  assert.equal(checkCanMove(m, fixed(0.5)).canMove, false);
  assert.equal(checkCanMove(m, fixed(0.1)).canMove, true);
  assert.equal(m.status, null);
});

test('bỏng mất 1/16 HP và giảm nửa sát thương vật lý, độc mất 1/8 HP', () => {
  const target = mon('pidgey', 20);
  const a = mon('rattata', 40, { ability: 'runAway' });
  const before = calcDamage(a, target, MOVES.tackle, fixed(0.5)).damage;
  a.status = 'brn';
  assert.ok(calcDamage(a, target, MOVES.tackle, fixed(0.5)).damage < before);
  assert.equal(statusDamage(a), Math.floor(a.maxHp / 16));
  const guts = mon('rattata', 40, { ability: 'guts', status: 'brn' });
  assert.ok(calcDamage(guts, target, MOVES.tackle, fixed(0.5)).damage > before, 'Guts: bị bỏng còn mạnh hơn');
  const p = mon('pidgey', 40, { status: 'psn' });
  assert.equal(statusDamage(p), Math.floor(p.maxHp / 8));
  const asleep = mon('pidgey', 5, { hp: 3, status: 'slp' });
  const awake = mon('pidgey', 5, { hp: 3 });
  assert.ok(catchChance(asleep) > catchChance(awake), 'đang ngủ thì dễ bắt hơn');
});

// ---------- Vật phẩm, quả mọng ----------

test('quả mọng và thuốc: hồi HP, chữa trạng thái, hồi PP, giảm EV', () => {
  const m = mon('pidgey', 40);
  m.hp = 1;
  applyItem('oranBerry', m);
  assert.equal(m.hp, 11);
  applyItem('sitrusBerry', m);
  assert.equal(m.hp, 11 + Math.floor(m.maxHp / 4));

  assert.equal(itemProblem('rawstBerry', m), `${m.name} hiện không bị bỏng.`);
  m.status = 'brn';
  assert.equal(itemProblem('cheriBerry', m), `${m.name} hiện không bị tê liệt.`);
  applyItem('rawstBerry', m);
  assert.equal(m.status, null);
  for (const s of ['brn', 'psn', 'par', 'slp', 'frz']) {
    m.status = s;
    applyItem('lumBerry', m);
    assert.equal(m.status, null, `Lum chữa ${s}`);
  }

  const move = m.moves[0];
  assert.ok(itemProblem('leppaBerry', m, { moveId: move }));
  m.pp[move] = 0;
  assert.equal(itemProblem('leppaBerry', m, { moveId: move }), null);
  applyItem('leppaBerry', m, move);
  assert.equal(m.pp[move], 10);

  m.evs.atk = 25;
  applyItem('kelpsyBerry', m);
  assert.equal(m.evs.atk, 15);
  applyItem('kelpsyBerry', m);
  applyItem('kelpsyBerry', m);
  assert.equal(m.evs.atk, 0);
  assert.ok(itemProblem('kelpsyBerry', m));
  m.evs.atk = 10;
  assert.ok(itemProblem('kelpsyBerry', m, { inBattle: true }), 'quả giảm EV chỉ dùng ngoài trận');
});

test('hồi phục toàn phần: đầy HP, hết trạng thái, đầy PP', () => {
  const m = mon('rattata', 10, { status: 'psn' });
  m.hp = 1;
  for (const id of m.moves) m.pp[id] = 0;
  healMonster(m);
  assert.equal(m.hp, m.maxHp);
  assert.equal(m.status, null);
  for (const id of m.moves) assert.equal(m.pp[id], MOVES[id].pp);
});

test('túi đồ giữ tối đa 999 mỗi loại', () => {
  resetState();
  assert.equal(addItem('oranBerry', 998), 998);
  assert.equal(addItem('oranBerry', 5), 1);
  assert.equal(itemCount('oranBerry'), ITEM_MAX);
});

test('cây quả mọng: đứng ở ô đi được, mỗi loại quả có cây và có hình, Pallet không có cây', () => {
  assert.ok(!MAPS.route1.objects.some((o) => o.kind === 'berry'), 'Pallet không có cây quả mọng');
  const all = Object.values(MAPS).flatMap((m) => m.objects.filter((o) => o.kind === 'berry').map((t) => [m, t]));
  assert.equal(new Set(all.map(([, t]) => t.berry)).size, BERRY_IDS.length);
  assert.equal(new Set(all.map(([, t]) => t.id)).size, all.length, 'id cây không trùng (lưu giờ chín riêng từng cây)');
  for (const [route, t] of all) {
    const trees = route.objects.filter((o) => o.kind === 'berry');
    const people = [...NPCS, ...TRAINERS, ...STORY_NPCS].filter((n) => n.map === route.id);
    assert.ok(ITEMS[t.berry]?.berry, t.berry);
    const ch = route.tileAt(t.x, t.y);
    assert.equal(ch, '.', `${t.id} không đứng trên cỏ thường (${ch})`);
    assert.ok(!people.some((n) => n.x === t.x && n.y === t.y), `${t.id} chồng lên NPC`);
    const reachable = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => !route.isSolid(t.x + dx, t.y + dy)
      && !trees.some((o) => o.x === t.x + dx && o.y === t.y + dy));
    assert.ok(reachable, `${t.id} không có chỗ đứng để hái`);
  }
});

test('hái quả: 1-3 quả vào túi, cây còn nguyên, 2-3 ngày sau ra quả lại', () => {
  resetState();
  const tree = MAPS.route2.objects.find((o) => o.kind === 'berry');
  const now = 1_000_000;
  assert.equal(isRipe(tree.id, now), true);
  assert.deepEqual(pickBerries(tree, fixed(0), now), { qty: 1 });
  assert.equal(itemCount(tree.berry), 1);
  assert.equal(isRipe(tree.id, now + REGROW_MIN_MS - 1), false);
  assert.equal(isRipe(tree.id, now + REGROW_MIN_MS), true);

  assert.deepEqual(pickBerries(tree, fixed(0.99), now), { qty: 3 });
  const regrow = REGROW_MIN_MS + Math.floor(0.99 * (REGROW_MAX_MS - REGROW_MIN_MS));
  assert.ok(regrow < REGROW_MAX_MS);
  assert.equal(isRipe(tree.id, now + regrow - 1), false);
  assert.equal(isRipe(tree.id, now + regrow), true);

  state.bag[tree.berry] = ITEM_MAX;
  assert.deepEqual(pickBerries(tree, fixed(0), now + REGROW_MAX_MS), { full: true });
  assert.equal(isRipe(tree.id, now + REGROW_MAX_MS), true, 'túi đầy thì không hái, cây vẫn còn quả');
});

// ---------- Lưu game ----------

test('lưu / tải giữ IV, EV, tính cách, trạng thái, PP, cây quả; bản lưu cũ được bổ sung', () => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  resetState();
  const m = createMonster('pikachu', 8, { shiny: true });
  m.evs.speed = 40;
  m.status = 'par';
  m.pp[m.moves[0]] = 3;
  state.party = [m];
  state.berryTrees = { 'tree-oran': 12345 };
  saveGame({ map: 'route1', x: 9, y: 16, facing: 'down' });
  resetState();
  loadGame();
  const back = state.party[0];
  assert.deepEqual(back.ivs, m.ivs);
  assert.equal(back.evs.speed, 40);
  assert.equal(back.nature, m.nature);
  assert.equal(back.shiny, true);
  assert.equal(back.status, 'par');
  assert.equal(back.pp[m.moves[0]], 3);
  assert.deepEqual(state.berryTrees, { 'tree-oran': 12345 });

  const old = { uid: 99, speciesId: 'rattata', name: 'Rattata', level: 6, exp: 216, hp: 5, maxHp: 22, moves: ['tackle'] };
  upgradeMonster(old);
  assert.ok(old.ivs && old.evs && old.nature && old.ability);
  assert.equal(old.uid, 99);
  assert.equal(old.pp.tackle, 35);
  assert.equal(old.shiny, false);
  assert.ok(old.hp <= old.maxHp && old.hp === 5);
});

test('thời tiết trận đấu: nắng / mưa đổi sức mạnh chiêu, Chlorophyll, nắng thì không bị đóng băng', () => {
  assert.equal(MOVES.sunnyDay.weather, 'sun');
  assert.equal(MOVES.rainDance.weather, 'rain');
  const target = mon('rattata', 20);
  const fire = mon('charmander', 20, { ability: 'blaze' });
  const water = mon('squirtle', 20, { ability: 'torrent' });
  const r = fixed(0.5);
  const dmg = (a, move, weather) => calcDamage(a, target, MOVES[move], r, { weather }).damage;
  assert.ok(dmg(fire, 'ember', 'sun') > dmg(fire, 'ember', null));
  assert.ok(dmg(water, 'waterGun', 'sun') < dmg(water, 'waterGun', null));
  assert.ok(dmg(water, 'waterGun', 'rain') > dmg(water, 'waterGun', null));
  assert.ok(dmg(fire, 'ember', 'rain') < dmg(fire, 'ember', null));
  const leaf = mon('oddish', 20, { ability: 'chlorophyll' });
  assert.equal(effectiveSpeed(leaf, { weather: 'sun' }), leaf.speed * 2);
  assert.equal(effectiveSpeed(leaf, { weather: 'sun', gas: true }), leaf.speed, 'Neutralizing Gas tắt Chlorophyll');
  const solar = mon('charmander', 20, { ability: 'solarPower' });
  assert.ok(dmg(solar, 'ember', 'sun') > dmg(fire, 'ember', 'sun'), 'Solar Power: Tấn công ĐB x1.5 khi nắng');
  assert.equal(statusBlocked(mon('rattata', 5), 'frz', null, 'sun'), 'immune');
  assert.equal(statusBlocked(mon('rattata', 5), 'frz', null, null), null);
});

// ---------- Tiến hoá, đồ cầm ----------

test('tiến hoá theo cấp và bằng đá; Everstone chặn tiến hoá theo cấp', async () => {
  const { evolutionTarget, evolve } = await import('../src/game/evolution.js');
  resetState();
  const c = mon('charmander', 15, { ability: 'blaze' });
  assert.equal(evolutionTarget(c), null);
  c.level = 16;
  assert.equal(evolutionTarget(c), 'charmeleon');
  c.heldItem = 'everstone';
  assert.equal(evolutionTarget(c), null);
  c.heldItem = null;
  const hpBefore = c.maxHp;
  evolve(c, 'charmeleon');
  assert.equal(c.speciesId, 'charmeleon');
  assert.equal(c.name, 'Charmeleon');
  assert.equal(c.ability, 'blaze');
  assert.ok(c.maxHp > hpBefore);
  assert.ok(state.dex.caught.has(SPECIES.charmeleon.dexId), 'tiến hoá thì Pokédex ghi nhận loài mới');

  const pika = mon('pikachu', 10);
  assert.equal(evolutionTarget(pika), null, 'Pikachu không tiến hoá theo cấp');
  assert.equal(evolutionTarget(pika, 'fireStone'), null);
  assert.equal(evolutionTarget(pika, 'thunderStone'), 'raichu');
  pika.heldItem = 'everstone';
  assert.equal(evolutionTarget(pika, 'thunderStone'), 'raichu', 'Everstone không chặn đá tiến hoá');
  assert.equal(itemProblem('thunderStone', pika), null);
  assert.equal(itemProblem('fireStone', pika), 'Không có tác dụng.');

  const hidden = mon('bulbasaur', 16, { ability: 'chlorophyll', hiddenAbility: true });
  evolve(hidden, 'ivysaur');
  assert.equal(hidden.ability, 'chlorophyll', 'đặc tính ẩn vẫn là đặc tính ẩn');

  for (const sp of Object.values(SPECIES)) {
    for (const e of sp.evolution ?? []) {
      assert.ok(SPECIES[e.to], `${sp.id} -> ${e.to} chưa có dữ liệu`);
      if (e.item) assert.equal(ITEMS[e.item]?.kind, 'evolution', e.item);
    }
    for (const [, m] of sp.learnset) assert.ok(MOVES[m], `${sp.id}: thiếu chiêu ${m}`);
  }
});

test('cầm vật phẩm: lấy từ túi, đổi món, cất lại; đồ tăng sức mạnh theo hệ', async () => {
  const { giveHeldItem, takeHeldItem, heldBerryTrigger } = await import('../src/game/heldItems.js');
  resetState();
  state.bag = { charcoal: 1, oranBerry: 2, bicycle: 1 };
  const c = mon('charmander', 20);
  assert.ok(giveHeldItem(c, 'bicycle'), 'không cầm được vật phẩm quan trọng');
  assert.equal(giveHeldItem(c, 'charcoal'), null);
  assert.equal(c.heldItem, 'charcoal');
  assert.equal(itemCount('charcoal'), 0);
  assert.equal(giveHeldItem(c, 'oranBerry'), null);
  assert.equal(itemCount('charcoal'), 1, 'món cũ trả về túi');
  assert.equal(itemCount('oranBerry'), 1);
  assert.equal(takeHeldItem(c), 'oranBerry');
  assert.equal(itemCount('oranBerry'), 2);
  assert.equal(c.heldItem, null);

  const target = mon('rattata', 20);
  const plain = calcDamage(c, target, MOVES.ember, fixed(0.5)).damage;
  c.heldItem = 'charcoal';
  assert.ok(calcDamage(c, target, MOVES.ember, fixed(0.5)).damage > plain);
  assert.equal(calcDamage(c, target, MOVES.scratch, fixed(0.5)).damage, calcDamage(mon('charmander', 20), target, MOVES.scratch, fixed(0.5)).damage);

  c.heldItem = 'sitrusBerry';
  assert.equal(heldBerryTrigger(c), null, 'đầy máu thì chưa ăn');
  c.hp = Math.floor(c.maxHp / 2);
  assert.deepEqual(heldBerryTrigger(c), { moveId: null });
  c.heldItem = 'rawstBerry';
  assert.equal(heldBerryTrigger(c), null);
  c.status = 'brn';
  assert.ok(heldBerryTrigger(c));
  c.heldItem = 'leppaBerry';
  c.pp[c.moves[1]] = 0;
  assert.deepEqual(heldBerryTrigger(c), { moveId: c.moves[1] });
});

test('đặc tính ra sân theo tốc độ: Drought vs Drizzle thì con chậm hơn quyết định thời tiết', async () => {
  const { entryOrder } = await import('../src/battle/formulas.js');
  const fast = mon('pikachu', 30);
  const slow = mon('koffing', 30);
  assert.deepEqual(entryOrder(slow, fast).map((m) => m.speciesId), ['pikachu', 'koffing']);
});

// ---------- Khu vực, cần câu, Repel, tiền, cửa hàng theo tiến độ ----------

test('khu bụi cỏ: mỗi khu có bảng riêng, cấp tăng dần, dạng tiến hoá chỉ ở khu sau', async () => {
  const { ENCOUNTERS } = await import('../src/data/encounters.js');
  const route = MAPS.route1;
  let lastMax = 0;
  route.areas.forEach((a) => {
    const t = ENCOUNTERS[a.table];
    assert.ok(t, `${a.name}: thiếu bảng ${a.table}`);
    const [x1, y1, x2, y2] = a.rect;
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) assert.ok(route.info(x, y).encounter, `${a.name}: (${x},${y}) không phải bụi cỏ`);
    const max = Math.max(...t.map((e) => e.max));
    assert.ok(max >= lastMax, `${a.name}: cấp phải tăng dần theo khu`);
    lastMax = max;
  });
  for (let y = 0; y < route.height; y++) {
    for (let x = 0; x < route.width; x++) {
      if (route.info(x, y).encounter) assert.ok(route.areaAt(x, y), `bụi cỏ (${x},${y}) chưa thuộc khu nào`);
    }
  }
  const isEvolved = (id) => Object.values(SPECIES).some((s) => s.evolution?.some((e) => e.to === id));
  assert.ok(!ENCOUNTERS[route.areas[0].table].some((e) => isEvolved(e.species)), 'khu đầu không có dạng tiến hoá');
  for (const t of Object.values(ENCOUNTERS)) for (const e of t) assert.ok(SPECIES[e.species], e.species);
  for (const key of ['surf', 'oldRod', 'goodRod', 'superRod']) assert.ok(ENCOUNTERS[route.water[key]], `hồ thiếu bảng ${key}`);
  assert.deepEqual([...new Set(ENCOUNTERS[route.water.oldRod].map((e) => e.species))], ['magikarp'], 'cần cũ chỉ câu được Magikarp');
});

test('cửa hàng và cây quả tốt mở dần theo tiến độ', async () => {
  const { progressTier } = await import('../src/story/chapter1.js');
  const { objectVisible, F } = await import('../src/story/chapter1.js');
  const { setFlag } = await import('../src/game/state.js');
  resetState();
  assert.equal(progressTier(), 0);
  const trees = Object.values(MAPS).flatMap((m) => m.objects.filter((o) => o.kind === 'berry'));
  const sitrus = trees.find((t) => t.berry === 'sitrusBerry');
  const lum = trees.find((t) => t.berry === 'lumBerry');
  const leppa = trees.find((t) => t.berry === 'leppaBerry');
  assert.equal(objectVisible(sitrus), false);
  assert.equal(objectVisible(leppa), true, 'Leppa có ngay từ đầu');
  assert.ok(trees.filter((t) => ITEMS[t.berry].kind === 'ev').every(objectVisible), 'quả giảm EV có ngay từ đầu');
  setFlag(F.MART_REWARD);
  assert.equal(progressTier(), 1);
  assert.equal(objectVisible(sitrus), true);
  assert.equal(objectVisible(lum), false);
  setFlag(F.DONE);
  assert.equal(objectVisible(lum), true);
});

test('Repel: chặn Pokémon yếu hơn Pokémon đầu đội, hết sau số bước, không dùng chồng', async () => {
  const { repelBlocks, startRepel, stepRepel } = await import('../src/game/repel.js');
  resetState();
  const fainted = mon('rattata', 30);
  fainted.hp = 0;
  state.party = [fainted, mon('pidgey', 10)];
  assert.equal(repelBlocks(3), false, 'chưa dùng Repel');
  assert.equal(startRepel('repel'), null);
  assert.ok(startRepel('superRepel'), 'đang có hiệu lực thì không dùng thêm');
  assert.equal(repelBlocks(9), true, 'so với Pokémon đầu đội còn chiến đấu được (Lv10)');
  assert.equal(repelBlocks(10), false);
  for (let i = 0; i < 99; i++) assert.equal(stepRepel(), null);
  assert.equal(stepRepel(), 'repel');
  assert.equal(repelBlocks(3), false);
  assert.equal(ITEMS.superRepel.steps, 200);
  assert.equal(ITEMS.maxRepel.steps, 250);
});

test('tiền: bắt đầu 10.000, thua mất 5% (tối đa 25.000)', async () => {
  const { blackoutLoss, START_MONEY } = await import('../src/game/state.js');
  resetState();
  assert.equal(START_MONEY, 10000);
  assert.equal(state.money, 10000);
  assert.equal(blackoutLoss(10000), 500);
  assert.equal(blackoutLoss(1_000_000), 25000);
  assert.equal(blackoutLoss(0), 0);
});

test('đặc tính dưới nước: Water Veil không bị bỏng, Cloud Nine tắt thời tiết', () => {
  assert.equal(statusBlocked(mon('goldeen', 10, { ability: 'waterVeil' }), 'brn'), 'immune');
  const fire = mon('charmander', 20);
  const target = mon('rattata', 20);
  const r = fixed(0.5);
  assert.equal(calcDamage(fire, target, MOVES.ember, r, { weather: 'rain', cloudNine: true }).damage, calcDamage(fire, target, MOVES.ember, r).damage);
  const swim = mon('magikarp', 10, { ability: 'swiftSwim' });
  assert.equal(effectiveSpeed(swim, { weather: 'rain', cloudNine: true }), swim.speed);
});

test('cây quả mọng sau khi hái: lá non -> ra hoa -> quả xanh -> chín', async () => {
  const { berryStage } = await import('../src/game/berries.js');
  resetState();
  const day = 24 * 60 * 60 * 1000;
  const now = 5_000_000;
  state.berryTrees['tree-oran'] = now + 2.5 * day;
  assert.equal(berryStage('tree-oran', now), 'bare');
  assert.equal(berryStage('tree-oran', now + 1.5 * day), 'bloom');
  assert.equal(berryStage('tree-oran', now + 2.2 * day), 'unripe');
  assert.equal(berryStage('tree-oran', now + 2.5 * day), 'ripe');
  assert.equal(berryStage('tree-chưa-hái', now), 'ripe');
});

test('Analytic: ra đòn sau thì chiêu mạnh hơn 30%', () => {
  const a = mon('magnemite', 30, { ability: 'analytic' });
  const target = mon('pidgey', 30);
  const r = fixed(0.5);
  const first = calcDamage(a, target, MOVES.thunderShock, r, {}).damage;
  const last = calcDamage(a, target, MOVES.thunderShock, r, { lastMover: a }).damage;
  assert.ok(last > first);
});

test('Thick Fat, Dry Skin, Shell Armor: đặc tính bên đỡ đổi sát thương', () => {
  const fire = mon('vulpix', 40);
  const r = fixed(0.5);
  const plain = calcDamage(fire, mon('seel', 40), MOVES.ember, r, {}).damage;
  const fat = calcDamage(fire, mon('seel', 40, { ability: 'thickFat' }), MOVES.ember, r, {}).damage;
  assert.ok(fat <= Math.ceil(plain / 2) && fat > 0, `${fat} / ${plain}`);
  const dry = calcDamage(fire, mon('seel', 40, { ability: 'drySkin' }), MOVES.ember, r, {}).damage;
  assert.ok(dry > plain);
  assert.equal(moveEffect(MOVES.waterGun, mon('jynx', 40, { ability: 'drySkin' })).absorbedBy, 'drySkin');
  // rng 0 thì luôn chí mạng, Shell Armor chặn được
  const shell = mon('shellder', 40, { ability: 'shellArmor' });
  assert.equal(calcDamage(fire, shell, MOVES.ember, fixed(0), {}).crit, false);
  assert.equal(calcDamage(fire, mon('shellder', 40, { ability: 'skillLink' }), MOVES.ember, fixed(0), {}).crit, true);
});

test('Insomnia không ngủ, Overcoat miễn nhiễm chiêu bột', () => {
  assert.equal(statusBlocked(mon('drowzee', 30, { ability: 'insomnia' }), 'slp'), 'immune');
  assert.equal(statusBlocked(mon('drowzee', 30, { ability: 'forewarn' }), 'slp'), null);
  assert.equal(statusBlocked(mon('shellder', 30, { ability: 'overcoat' }), 'slp', MOVES.sleepPowder), 'immune');
  assert.equal(statusBlocked(mon('shellder', 30, { ability: 'shellArmor' }), 'slp', MOVES.sleepPowder), null);
});

test('gym 5-8: Pokémon của thủ lĩnh có đặc tính hợp lệ, chiêu Băng gây được đóng băng', () => {
  for (const id of ['vulpix', 'ponyta', 'arcanine', 'graveler', 'onix', 'rhydon', 'hypno', 'slowbro', 'alakazam', 'dewgong', 'cloyster', 'jynx', 'lapras']) {
    const m = mon(id, 40);
    assert.ok(m.ability, `${id}: chưa có đặc tính`);
  }
  assert.deepEqual(MOVES.iceBeam.status, ['frz', 10]);
  assert.equal(statusBlocked(mon('pidgey', 30), 'frz', MOVES.iceBeam), null);
  assert.equal(statusBlocked(mon('jynx', 30), 'frz', MOVES.iceBeam), 'immune');
});

test('chiêu học được không trùng nhau, Pokémon mới tạo không có chiêu trùng', () => {
  for (const [id, s] of Object.entries(SPECIES)) {
    // Dạng tiến hoá có thể biết sẵn một chiêu ở cấp 1 và học lại ở cấp sau (Raticate: Quick Attack cấp 1 và 7), nhưng không trùng cùng cấp
    const pairs = s.learnset.map(([lv, m]) => `${lv}:${m}`);
    assert.equal(new Set(pairs).size, pairs.length, `${id}: trùng chiêu`);
    assert.ok(s.learnset.every(([lv], i) => i === 0 || s.learnset[i - 1][0] <= lv), `${id}: chưa xếp theo cấp`);
  }
  assert.ok(SPECIES.raticate.learnset.filter(([, m]) => m === 'quickAttack').length > 1);
  for (const [id, lv] of [['dewgong', 47], ['raticate', 10], ['vileplume', 47], ['oddish', 18]]) {
    const m = createMonster(id, lv);
    assert.equal(new Set(m.moves).size, m.moves.length, id);
  }
});

test('No Guard luôn trúng, Iron Fist / Multiscale / Marvel Scale đổi sát thương, Limber / Immunity / Vital Spirit', () => {
  const machamp = mon('machamp', 50, { ability: 'noGuard' });
  assert.equal(moveHits(MOVES.crossChop, machamp, mon('pidgey', 50), fixed(0.99)), true);
  assert.equal(moveHits(MOVES.crossChop, mon('machamp', 50, { ability: 'guts' }), mon('pidgey', 50), fixed(0.99)), false);
  const r = fixed(0.5);
  const target = mon('snorlax', 50, { ability: 'immunity' });
  const fist = calcDamage(mon('hitmonchan', 50, { ability: 'ironFist' }), target, MOVES.thunderPunch, r, {}).damage;
  const plain = calcDamage(mon('hitmonchan', 50, { ability: 'keenEye' }), target, MOVES.thunderPunch, r, {}).damage;
  assert.ok(fist > plain);
  const dnite = mon('dragonite', 60, { ability: 'multiscale' });
  const full = calcDamage(mon('lapras', 60), dnite, MOVES.iceBeam, r, {}).damage;
  dnite.hp -= 1;
  assert.ok(calcDamage(mon('lapras', 60), dnite, MOVES.iceBeam, r, {}).damage > full * 1.8);
  const scaled = mon('dragonair', 50, { ability: 'marvelScale', status: 'par' });
  const normal = mon('dragonair', 50, { ability: 'shedSkin', status: 'par' });
  assert.ok(calcDamage(machamp, scaled, MOVES.brickBreak, r, {}).damage < calcDamage(machamp, normal, MOVES.brickBreak, r, {}).damage);
  assert.equal(statusBlocked(mon('hitmonlee', 50, { ability: 'limber' }), 'par'), 'immune');
  assert.equal(statusBlocked(target, 'psn'), 'immune');
  assert.equal(statusBlocked(mon('primeape', 50, { ability: 'vitalSpirit' }), 'slp'), 'immune');
});

test('Cursed Body: chiêu bị phong ấn không dùng được', async () => {
  const { canUseMove } = await import('../src/battle/status.js');
  const m = mon('machamp', 50);
  const [first] = m.moves;
  assert.equal(canUseMove(m, first), true);
  m.disabled = { move: first, turns: 4 };
  assert.equal(canUseMove(m, first), false);
  assert.equal(canUseMove(m, m.moves[1]), true);
});

test('Revive hồi một nửa, Max Revive hồi đầy; Max Revive chỉ bán ở Poké Mart bậc cuối', async () => {
  const { MART_TIERS, martStock, STORE_STOCK } = await import('../src/data/items.js');
  const a = mon('pidgey', 30);
  a.hp = 0;
  applyItem('revive', a);
  assert.equal(a.hp, Math.floor(a.maxHp / 2));
  a.hp = 0;
  applyItem('maxRevive', a);
  assert.equal(a.hp, a.maxHp);
  assert.ok(!martStock(2).includes('maxRevive') && martStock(3).includes('maxRevive'));
  assert.ok(martStock(1).includes('revive') && !martStock(0).includes('revive'));
  // Đồ cầm tăng sức mạnh, Leftovers, Lucky Egg không bán ở đâu; đá tiến hoá chỉ ở Trung tâm thương mại
  const sold = [...MART_TIERS.flat(), ...STORE_STOCK.general, ...STORE_STOCK.stones];
  for (const id of Object.keys(ITEMS)) {
    if (ITEMS[id].held === 'boost' || ['leftovers', 'luckyEgg'].includes(id)) assert.ok(!sold.includes(id), `${id} không được bán`);
  }
  for (const stone of ['fireStone', 'waterStone', 'thunderStone', 'leafStone']) {
    assert.ok(!MART_TIERS.flat().includes(stone) && STORE_STOCK.stones.includes(stone));
  }
});

test('Đá tiến hoá: Eevee 3 dạng, Weepinbell thành Victreebel; không loài nào tự chở người chơi', async () => {
  const { evolutionTarget } = await import('../src/game/evolution.js');
  const eevee = mon('eevee', 20);
  assert.equal(evolutionTarget(eevee, 'waterStone'), 'vaporeon');
  assert.equal(evolutionTarget(eevee, 'thunderStone'), 'jolteon');
  assert.equal(evolutionTarget(eevee, 'fireStone'), 'flareon');
  assert.equal(evolutionTarget(eevee, 'leafStone'), null);
  assert.equal(evolutionTarget(mon('weepinbell', 30), 'leafStone'), 'victreebel');
  assert.equal(evolutionTarget(mon('pikachu', 20), 'thunderStone'), 'raichu');
  for (const s of Object.values(SPECIES)) assert.equal(s.ride, undefined, `${s.id} còn cờ ride`);
  assert.equal(ITEMS.arcanineMount.mount, 'ride');
  assert.equal(ITEMS.laprasMount.mount, 'waterRide');
});

test('nhiệm vụ phụ: điều kiện, vật phẩm nhiệm vụ chỉ hiện khi đã nhận, phần thưởng hợp lý', async () => {
  const { QUEST_NPCS, questMissing } = await import('../src/story/quests.js');
  const { objectVisible } = await import('../src/story/chapter1.js');
  resetState();
  state.party = [mon('pidgey', 25)];
  assert.equal(questMissing({ show: { type: 'normal', level: 20 } }).length, 0);
  assert.equal(questMissing({ show: { type: 'poison' } }).length, 1);
  addItem('oranBerry', 3);
  assert.match(questMissing({ items: { oranBerry: 5 } })[0], /3\/5/);
  addItem('oranBerry', 2);
  assert.equal(questMissing({ items: { oranBerry: 5 } }).length, 0);
  assert.equal(questMissing({ trainers: ['r5-engineer'] }).length, 1);
  assert.equal(questMissing({ badge: 'fire' }).length, 1);
  // Phụ tùng xe đạp chỉ hiện khi đã nhận nhiệm vụ của tiệm xe
  const chain = MAPS.route4.objects.find((o) => o.item === 'bikeChain');
  assert.equal(objectVisible(chain), false);
  state.flags.add('quest:bike');
  assert.equal(objectVisible(chain), true);
  // Đồ cầm quý (Leftovers, Lucky Egg, đồ tăng sức mạnh) đều nhận trước gym 5; thú cưỡi và xe đạp có nhiệm vụ riêng
  const before5 = ['town2', 'town3', 'town4', 'town5'];
  const giver = (item) => QUEST_NPCS.find((n) => n.reward?.[0] === item);
  for (const item of ['leftovers', 'luckyEgg', 'poisonBarb', 'silkScarf', 'blackGlasses']) {
    assert.ok(before5.includes(giver(item)?.map), `${item}: phải nhận được trước gym 5`);
  }
  assert.equal(giver('bicycle').map, 'bikeShop');
  assert.equal(giver('arcanineMount').map, 'town6');
  assert.equal(giver('laprasMount').map, 'town9');
  for (const n of QUEST_NPCS) {
    assert.ok(MAPS[n.map], `${n.id}: thiếu bản đồ`);
    assert.ok(!MAPS[n.map].isSolid(n.x, n.y), `${n.id}: đứng trên ô cản`);
  }
  assert.ok(QUEST_NPCS.filter((n) => before5.includes(n.map)).length >= 5);
  // Mẹ không tặng xe đạp, không vật phẩm quý nằm sẵn ở Pallet
  assert.ok(!MAPS.route1.objects.some((o) => ['leftovers', 'luckyEgg'].includes(o.item)));
  resetState();
});

test('review: Neutralizing Gas vô hiệu đặc tính chặn trạng thái, chiêu trạng thái bị hấp thụ, chạy trốn tính bậc tốc độ', () => {
  const sleepy = mon('drowzee', 30, { ability: 'insomnia' });
  assert.equal(statusBlocked(sleepy, 'slp'), 'immune');
  assert.equal(statusBlocked(sleepy, 'slp', null, null, null), null, 'đặc tính bị vô hiệu thì ngủ được');
  assert.equal(moveEffect(MOVES.thunderWave, mon('jolteon', 30, { ability: 'voltAbsorb' })).absorbedBy, 'voltAbsorb');
  assert.equal(moveEffect(MOVES.willOWisp, mon('vulpix', 30, { ability: 'flashFire' })).absorbedBy, 'flashFire');
  assert.equal(moveEffect(MOVES.rainDance, mon('vaporeon', 30, { ability: 'waterAbsorb' })).absorbedBy, null, 'chiêu đổi thời tiết không bị chặn');
  const fast = mon('pidgey', 30);
  const slow = mon('pidgey', 30);
  assert.equal(escapeChance(fast, slow, 0), 1);
  fast.stages = { speed: -6 };
  assert.ok(escapeChance(fast, slow, 0) < 1, 'bị giảm tốc độ thì khó chạy hơn');
});

test('review: gym điện về trạng thái ban đầu khi vào lại; mỗi loại quả nhiệm vụ có ít nhất 3 cây', () => {
  assert.deepEqual(MAPS.gym3.resetFlags, ['gym3:power']);
  for (const berry of ['oranBerry', 'aspearBerry']) {
    const trees = Object.values(MAPS).flatMap((m) => m.objects).filter((o) => o.kind === 'berry' && o.berry === berry);
    assert.ok(trees.length >= 3, `${berry}: ${trees.length} cây`);
  }
  // Lính gác Đường Chiến Thắng chặn kín chiều cao bản đồ
  const [x1, y1, , y2] = MAPS.route11.gates[0].rect;
  for (let y = 0; y < MAPS.route11.height; y++) if (!MAPS.route11.isSolid(x1, y)) assert.ok(y >= y1 && y <= y2, `đi vòng được ở hàng ${y}`);
});

// ---------- Rối loạn, thời tiết cát / mưa đá, chiêu nhiều đòn, lớp chắn, Attract / Taunt, lấy đồ ----------

test('rối loạn: 1-4 lượt, 1/3 tự đánh mình, Own Tempo miễn nhiễm; Tangled Feet né gấp đôi khi rối loạn', async () => {
  const { checkConfusion, confuseBlocked, inflictConfusion } = await import('../src/battle/status.js');
  const { confusionDamage } = await import('../src/battle/formulas.js');
  const p = mon('pidgey', 20, { ability: 'tangledFeet' });
  for (const [r, turns] of [[0, 1], [0.99, 4]]) {
    inflictConfusion(p, fixed(r));
    let confusedTurns = 0;
    while (checkConfusion(p, fixed(0.5)) !== 'snapped') confusedTurns++;
    assert.equal(confusedTurns, turns);
    assert.equal(p.confused, undefined, 'hết rối loạn');
  }
  inflictConfusion(p, fixed(0.99));
  assert.equal(checkConfusion(p, fixed(0.3)), 'hitSelf');
  assert.equal(checkConfusion(p, fixed(0.4)), 'confused');
  assert.ok(confusionDamage(p, fixed(0)) > 0);
  assert.equal(confuseBlocked(p), 'already');
  assert.equal(confuseBlocked(mon('slowpoke', 20, { ability: 'ownTempo' })), 'immune');
  assert.equal(confuseBlocked(mon('slowpoke', 20, { ability: 'oblivious' })), null);
  // Tangled Feet: Tackle 100% chỉ còn 50% khi nó đang rối loạn
  const foe = mon('rattata', 20);
  assert.equal(moveHits(MOVES.tackle, foe, p, fixed(0.6)), false);
  delete p.confused;
  assert.equal(moveHits(MOVES.tackle, foe, p, fixed(0.6)), true);
  // Chiêu gây rối loạn có thể học được
  assert.equal(MOVES.confuseRay.confuse, 100);
  assert.equal(MOVES.psybeam.confuse, 10);
});

test('bão cát / mưa đá: mất 1/16 HP trừ hệ miễn nhiễm, Sand Veil né tốt hơn, Ice Body hồi máu, đá tăng Phòng thủ ĐB', async () => {
  const { weatherHpChange } = await import('../src/battle/formulas.js');
  const sand = { weather: 'sand' };
  const hail = { weather: 'hail' };
  const pidgey = mon('pidgey', 30);
  const sixteenth = Math.floor(pidgey.maxHp / 16);
  assert.equal(weatherHpChange(pidgey, sand), -sixteenth);
  assert.equal(weatherHpChange(pidgey, hail), -sixteenth);
  assert.equal(weatherHpChange(pidgey, { weather: 'sand', cloudNine: true }), 0, 'Cloud Nine tắt thời tiết');
  assert.equal(weatherHpChange(mon('geodude', 30), sand), 0, 'hệ Đá / Đất không mất máu vì bão cát');
  assert.equal(weatherHpChange(mon('magnemite', 30), sand), 0, 'hệ Thép không mất máu vì bão cát');
  assert.equal(weatherHpChange(mon('magnemite', 30), hail), -Math.floor(mon('magnemite', 30).maxHp / 16));
  assert.equal(weatherHpChange(mon('dewgong', 30), hail), 0, 'hệ Băng không mất máu vì mưa đá');
  assert.equal(weatherHpChange(mon('pidgey', 30, { ability: 'sandVeil' }), sand), 0);
  assert.equal(weatherHpChange(mon('pidgey', 30, { ability: 'overcoat' }), hail), 0);
  // Ice Body: mưa đá thì hồi 1/16 HP, đầy máu thì thôi, không có mưa đá thì không hồi
  const seel = mon('seel', 30, { ability: 'iceBody' });
  assert.equal(weatherHpChange(seel, hail), 0);
  seel.hp = 10;
  assert.equal(weatherHpChange(seel, hail), Math.floor(seel.maxHp / 16));
  assert.equal(weatherHpChange(seel, sand), -Math.floor(seel.maxHp / 16));
  // Sand Veil: Tackle 100% còn 80% khi có bão cát
  const veil = mon('graveler', 30, { ability: 'sandVeil' });
  const foe = mon('rattata', 30);
  assert.equal(moveHits(MOVES.tackle, foe, veil, fixed(0.85), sand), false);
  assert.equal(moveHits(MOVES.tackle, foe, veil, fixed(0.85), {}), true);
  // Bão cát: hệ Đá chịu chiêu đặc biệt tốt hơn
  const onix = mon('onix', 30);
  const plain = calcDamage(foe, onix, MOVES.waterGun, fixed(0.5)).damage;
  assert.ok(calcDamage(foe, onix, MOVES.waterGun, fixed(0.5), sand).damage < plain);
  assert.equal(MOVES.sandstorm.weather, 'sand');
  assert.equal(MOVES.hail.weather, 'hail');
});

test('chiêu đánh nhiều lần 2-5 lần (35/35/15/15%), Skill Link luôn 5 lần; Technician', async () => {
  const { hitCount } = await import('../src/battle/formulas.js');
  const counts = [0.1, 0.4, 0.8, 0.9].map((r) => hitCount(MOVES.furySwipes, null, fixed(r)));
  assert.deepEqual(counts, [2, 3, 4, 5]);
  assert.equal(hitCount(MOVES.icicleSpear, 'skillLink', fixed(0)), 5);
  assert.equal(hitCount(MOVES.doubleKick, 'skillLink', fixed(0.9)), 2, 'Double Kick luôn 2 lần');
  assert.equal(hitCount(MOVES.tackle, 'skillLink'), 1);
  const target = mon('rattata', 30);
  const plain = calcDamage(mon('meowth', 30, { ability: 'unnerve' }), target, MOVES.furySwipes, fixed(0.5)).damage;
  const tech = calcDamage(mon('meowth', 30, { ability: 'technician' }), target, MOVES.furySwipes, fixed(0.5)).damage;
  assert.ok(tech > plain * 1.4, 'Technician tăng chiêu yếu');
  assert.equal(
    calcDamage(mon('meowth', 30, { ability: 'technician' }), target, MOVES.slash, fixed(0.5)).damage,
    calcDamage(mon('meowth', 30, { ability: 'unnerve' }), target, MOVES.slash, fixed(0.5)).damage,
    'Slash (70) không được Technician tăng',
  );
});

test('Reflect / Light Screen giảm nửa sát thương, chí mạng và Infiltrator xuyên qua', () => {
  const attacker = mon('rattata', 30);
  const target = mon('pidgey', 30);
  const reflect = { screens: { reflect: 5 } };
  const plain = calcDamage(attacker, target, MOVES.tackle, fixed(0.5)).damage;
  const screened = calcDamage(attacker, target, MOVES.tackle, fixed(0.5), reflect).damage;
  assert.ok(Math.abs(screened - plain / 2) <= 1, `${screened} ~ ${plain} / 2`);
  assert.equal(calcDamage(attacker, target, MOVES.waterGun, fixed(0.5), reflect).damage, calcDamage(attacker, target, MOVES.waterGun, fixed(0.5)).damage, 'Reflect không chặn đòn đặc biệt');
  assert.ok(calcDamage(attacker, target, MOVES.waterGun, fixed(0.5), { screens: { lightScreen: 5 } }).damage < calcDamage(attacker, target, MOVES.waterGun, fixed(0.5)).damage);
  // Chí mạng (rng 0) bỏ qua lớp chắn
  assert.equal(calcDamage(attacker, target, MOVES.tackle, fixed(0), reflect).damage, calcDamage(attacker, target, MOVES.tackle, fixed(0)).damage);
  const zubat = mon('golbat', 30, { ability: 'infiltrator' });
  assert.equal(calcDamage(zubat, target, MOVES.wingAttack, fixed(0.5), reflect).damage, calcDamage(zubat, target, MOVES.wingAttack, fixed(0.5)).damage);
  assert.equal(MOVES.reflect.screen, 'reflect');
  assert.ok(MOVES.brickBreak.breaksScreens);
});

test('Attract chỉ với khác giới, Oblivious miễn nhiễm Attract và Taunt; bị khiêu khích thì không dùng được chiêu trạng thái', async () => {
  const { attractBlocked, canUseMove, tauntBlocked } = await import('../src/battle/status.js');
  const male = mon('meowth', 30, { gender: 'male' });
  const female = mon('pidgey', 30, { gender: 'female' });
  assert.equal(attractBlocked(female, male), null);
  assert.equal(attractBlocked(mon('pidgey', 30, { gender: 'male' }), male), 'gender');
  assert.equal(attractBlocked(mon('magnemite', 30), male), 'gender', 'không có giới tính');
  assert.equal(attractBlocked(mon('slowpoke', 30, { gender: 'female', ability: 'oblivious' }), male), 'immune');
  assert.equal(tauntBlocked(mon('slowpoke', 30, { ability: 'oblivious' })), 'immune');
  assert.equal(tauntBlocked(mon('slowpoke', 30, { ability: 'ownTempo' })), null);
  const p = mon('pidgey', 30);
  p.moves = ['tackle', 'sandAttack'];
  p.pp = { tackle: 35, sandAttack: 15 };
  p.taunted = 3;
  assert.equal(canUseMove(p, 'sandAttack'), false);
  assert.equal(canUseMove(p, 'tackle'), true);
  assert.equal(tauntBlocked(p), 'already');
});

test('Self-Destruct / Explosion, Thief / Knock Off, Sticky Hold; hết trận trả lại đồ bị lấy', async () => {
  const { canLoseItem } = await import('../src/battle/formulas.js');
  const { clearBattleState } = await import('../src/battle/status.js');
  assert.ok(MOVES.explosion.explode && MOVES.selfDestruct.explode);
  assert.ok(MOVES.thief.steal && MOVES.covet.steal && MOVES.knockOff.knockOff);
  // Knock Off mạnh hơn 50% khi đối thủ đang cầm đồ
  const machop = mon('machop', 30);
  const holder = mon('grimer', 30, { heldItem: 'leftovers' });
  const bare = mon('grimer', 30);
  assert.ok(canLoseItem(holder) && !canLoseItem(bare));
  assert.ok(calcDamage(machop, holder, MOVES.knockOff, fixed(0.5)).damage > calcDamage(machop, bare, MOVES.knockOff, fixed(0.5)).damage * 1.4);
  // Bị lấy đồ trong trận: hết trận được trả lại; xoá mọi hiệu ứng tạm thời nhưng giữ trạng thái xấu
  const p = mon('pidgey', 30, { heldItem: null, itemBeforeBattle: 'leftovers', status: 'psn' });
  Object.assign(p, { confused: 3, taunted: 2, infatuated: holder, flinched: true, stages: { atk: 2 }, disabled: { move: 'tackle', turns: 2 } });
  clearBattleState(p);
  assert.equal(p.heldItem, 'leftovers');
  assert.equal(p.status, 'psn');
  for (const key of ['confused', 'taunted', 'infatuated', 'flinched', 'stages', 'disabled', 'itemBeforeBattle']) assert.ok(!(key in p), key);
  // Lấy đồ của Pokémon hoang dã thì giữ được (không có itemBeforeBattle)
  const thief = mon('meowth', 30, { heldItem: 'leftovers' });
  clearBattleState(thief);
  assert.equal(thief.heldItem, 'leftovers');
});

test('Magnet Pull: Pokémon hệ Thép không chạy được; đứng đầu đội thì 50% gặp Pokémon hệ Thép', async () => {
  const { trappedBy } = await import('../src/battle/formulas.js');
  const { ENCOUNTERS, rollEncounter } = await import('../src/data/encounters.js');
  const puller = mon('magnemite', 22, { ability: 'magnetPull' });
  assert.equal(trappedBy(mon('magneton', 30), puller), 'magnetPull');
  assert.equal(trappedBy(mon('pikachu', 30), puller), null, 'không phải hệ Thép');
  assert.equal(trappedBy(mon('magneton', 30), mon('magnemite', 22, { ability: 'sturdy' })), null);
  assert.equal(trappedBy(mon('magneton', 30), puller, { gas: true }), null, 'Neutralizing Gas');
  // route5-grass có Magnemite nhưng xếp sau Voltorb / Pikachu...: rng 0.3 bình thường không ra Magnemite
  const steel = (id) => SPECIES[id].types.includes('steel');
  assert.ok(ENCOUNTERS['route5-grass'].some((e) => steel(e.species)));
  assert.equal(rollEncounter('route5-grass', fixed(0.3), null, 'day').speciesId, 'voltorb');
  assert.equal(rollEncounter('route5-grass', fixed(0.3), puller, 'day').speciesId, 'magnemite');
  assert.equal(rollEncounter('route5-grass', fixed(0.6), puller, 'day').speciesId, rollEncounter('route5-grass', fixed(0.6), null, 'day').speciesId, '50% còn lại gặp như thường');
  assert.equal(rollEncounter('route4-grass', fixed(0.3), puller, 'day').speciesId, rollEncounter('route4-grass', fixed(0.3), null, 'day').speciesId, 'khu không có hệ Thép');
});

test('Gluttony ăn quả lúc nguy khi còn một nửa HP thay vì 1/4', async () => {
  const { berryHpLimit, heldBerryTrigger } = await import('../src/game/heldItems.js');
  assert.equal(berryHpLimit(ITEMS.sitrusBerry), 1 / 2);
  assert.equal(berryHpLimit(ITEMS.sitrusBerry, 'gluttony'), 1 / 2);
  // Quả lúc nguy (pinch) dựng tạm cho kiểm thử
  ITEMS.testPinchBerry = { name: 'Test', kind: 'heal', healPct: 1 / 3, berry: true, pinch: true };
  try {
    const plain = mon('snorlax', 30, { heldItem: 'testPinchBerry', ability: 'immunity' });
    const glutton = mon('snorlax', 30, { heldItem: 'testPinchBerry', ability: 'gluttony' });
    plain.hp = glutton.hp = Math.floor(plain.maxHp * 0.4);
    assert.equal(heldBerryTrigger(plain), null);
    assert.ok(heldBerryTrigger(glutton));
    assert.equal(heldBerryTrigger(glutton, null), null, 'Neutralizing Gas tắt Gluttony');
    plain.hp = Math.floor(plain.maxHp / 4);
    assert.ok(heldBerryTrigger(plain));
  } finally {
    delete ITEMS.testPinchBerry;
  }
});

test('11 đặc tính trước đây chưa có tác dụng đã có cơ chế, chiêu liên quan đều học được; Meowth / Persian bắt được', async () => {
  const { ABILITIES } = await import('../src/data/abilities.js');
  const { ENCOUNTERS } = await import('../src/data/encounters.js');
  for (const [id, a] of Object.entries(ABILITIES)) assert.ok(!a.desc.includes('chưa có'), `${id}: còn ghi chưa có tác dụng`);
  const learnable = new Set(Object.values(SPECIES).flatMap((s) => [...s.learnset.map(([, m]) => m), ...s.evolutionMoves]));
  // Chiêu kích hoạt từng đặc tính: mỗi đặc tính phải có ít nhất một chiêu học được theo bộ chiêu gốc.
  // Thief, Attract, Taunt, Hail chỉ học bằng TM ở FireRed/LeafGreen nên không loài nào học khi lên cấp,
  // vẫn giữ trong moves.js (cho TM sau này). Vì vậy Oblivious (Attract / Taunt) và Ice Body (Hail) chưa có chiêu kích hoạt
  const TRIGGERS = {
    ownTempo: ['supersonic', 'confuseRay'], sandVeil: ['sandstorm'], skillLink: ['furySwipes', 'icicleSpear', 'spikeCannon', 'rockBlast'],
    damp: ['selfDestruct', 'explosion'], infiltrator: ['reflect', 'lightScreen'], stickyHold: ['thief', 'covet', 'knockOff'],
  };
  for (const m of ['attract', 'taunt', 'hail']) assert.ok(MOVES[m], `${m}: thiếu chiêu`);
  for (const [ability, moves] of Object.entries(TRIGGERS)) {
    for (const m of moves) assert.ok(MOVES[m], `${m}: thiếu chiêu`);
    assert.ok(moves.some((m) => learnable.has(m)), `${ability}: không loài nào học được chiêu kích hoạt`);
  }
  for (const m of ['supersonic', 'confuseRay', 'sandstorm', 'furySwipes', 'icicleSpear', 'spikeCannon', 'rockBlast',
    'selfDestruct', 'explosion', 'reflect', 'lightScreen', 'covet', 'knockOff']) {
    assert.ok(learnable.has(m), `${m}: không loài nào học được`);
  }
  assert.equal(MOVES.hail.weather, 'hail');
  assert.equal(SPECIES.meowth.evolution[0].to, 'persian');
  assert.deepEqual(SPECIES.meowth.abilities, { normal: ['pickup', 'technician'], hidden: 'unnerve' });
  const wild = new Set(Object.values(ENCOUNTERS).flat().map((e) => e.species));
  assert.ok(wild.has('meowth') && wild.has('persian'));
  // FireRed/LeafGreen: Growl, Scratch cấp 1, Bite cấp 10
  const m = createMonster('meowth', 5);
  assert.deepEqual([...m.moves].sort(), ['growl', 'scratch']);
});

// ---------- Chiêu có hiệu ứng riêng, học chiêu khi đã đủ 4 chiêu, chia EXP ----------

test('replaceMove: quên chiêu cũ, chiêu mới vào đúng ô với đầy PP', async () => {
  const { replaceMove } = await import('../src/game/monster.js');
  const m = mon('charmeleon', 30);
  m.moves = ['scratch', 'growl', 'ember', 'metalClaw'];
  m.pp = { scratch: 3, growl: 40, ember: 1, metalClaw: 35 };
  assert.equal(replaceMove(m, 'ember', 'flamethrower'), true);
  assert.deepEqual(m.moves, ['scratch', 'growl', 'flamethrower', 'metalClaw']);
  assert.equal(m.pp.flamethrower, MOVES.flamethrower.pp);
  assert.ok(!('ember' in m.pp));
  assert.equal(replaceMove(m, 'tackle', 'slash'), false, 'không biết chiêu cũ');
  assert.equal(replaceMove(m, 'scratch', 'growl'), false, 'đã biết chiêu mới');
  assert.deepEqual(m.moves, ['scratch', 'growl', 'flamethrower', 'metalClaw']);
});

test('lên nhiều cấp một lúc: mỗi lần lên cấp kèm cấp / HP tối đa / HP lúc đó; Rare Candy báo chiêu không học được', async () => {
  const { expToReach, gainExp } = await import('../src/game/monster.js');
  const m = mon('charmander', 5);
  const ups = gainExp(m, expToReach(m, 9) - m.exp).filter((e) => e.type === 'levelUp');
  assert.deepEqual(ups.map((e) => e.level), [6, 7, 8, 9]);
  for (let i = 1; i < ups.length; i++) assert.ok(ups[i].maxHp > ups[i - 1].maxHp);
  assert.equal(ups.at(-1).maxHp, m.maxHp);
  assert.equal(ups.at(-1).hp, m.hp);

  const full = createMonster('charmander', 30);
  full.exp = expToReach(full, 30);
  assert.equal(full.moves.length, 4);
  const lines = applyItem('rareCandy', full);
  assert.equal(full.level, 31);
  assert.deepEqual(lines.cantLearn, ['flamethrower']);
  assert.ok(lines.every((l) => !l.includes('Flamethrower')), 'không có câu báo riêng, bên gọi hỏi quên chiêu');
  assert.deepEqual(applyItem('potion', mon('pidgey', 10, { hp: 1 })).cantLearn, undefined);
});

test('Low Kick: sức mạnh theo cân nặng (bảng từ Gen 3); Leech Life 80 / 100% / 10 PP; dữ liệu chiêu đặc biệt', async () => {
  const { lowKickPower, weightOf } = await import('../src/battle/formulas.js');
  assert.deepEqual([0.1, 9.9, 10, 24.9, 25, 49.9, 50, 99.9, 100, 199.9, 200, 460].map(lowKickPower),
    [20, 20, 40, 40, 60, 60, 80, 80, 100, 100, 120, 120]);
  assert.equal(weightOf(mon('pikachu', 5)), 6);
  assert.equal(weightOf(mon('snorlax', 5)), 460);
  const hitter = mon('machop', 30);
  const dmg = (target) => calcDamage(hitter, target, MOVES.lowKick, fixed(0.5)).damage;
  // Cùng chỉ số Phòng thủ: chỉ khác cân nặng
  const light = mon('pikachu', 30);
  const heavy = mon('pikachu', 30);
  heavy.speciesId = 'snorlax';
  heavy.def = light.def;
  assert.ok(dmg(heavy) > dmg(light) * 4, `${dmg(heavy)} vs ${dmg(light)}`);
  assert.equal(MOVES.lowKick.power, null);

  assert.deepEqual([MOVES.leechLife.power, MOVES.leechLife.accuracy, MOVES.leechLife.pp, MOVES.leechLife.drain], [80, 100, 10, 0.5]);
  assert.equal(MOVES.wrap.bind, true);
  assert.equal(MOVES.outrage.rampage, true);
  assert.equal(MOVES.highJumpKick.crash, 0.5);
});

test('Wrap: trói 4-5 lượt, mất 1/8 HP, không chạy / rút được trừ hệ Ma; đổi Pokémon thì hết', async () => {
  const { trappedBy } = await import('../src/battle/formulas.js');
  const { bindDamage, clearVolatile, startBind } = await import('../src/battle/status.js');
  const ekans = mon('ekans', 20);
  const pidgey = mon('pidgey', 20);
  assert.equal(startBind(pidgey, ekans, 'wrap', fixed(0.1)), true);
  assert.equal(pidgey.bound.turns, 4);
  assert.equal(startBind(pidgey, ekans, 'wrap', fixed(0.9)), false, 'đang bị trói thì không tính lại');
  assert.equal(trappedBy(pidgey, ekans), 'wrap');
  assert.equal(trappedBy(pidgey, mon('ekans', 20)), null, 'Pokémon khác trói thì không tính');
  assert.equal(bindDamage(pidgey), Math.floor(pidgey.maxHp / 8));
  assert.ok(!JSON.stringify(pidgey).includes('bound'), 'không lưu tham chiếu tới đối thủ');
  const gastly = mon('gastly', 20);
  startBind(gastly, ekans, 'wrap', fixed(0.9));
  assert.equal(gastly.bound.turns, 5);
  assert.equal(trappedBy(gastly, ekans), null, 'hệ Ma luôn thoát được');
  clearVolatile(pidgey);
  assert.equal(pidgey.bound, undefined);
  assert.equal(trappedBy(pidgey, ekans), null);
});

test('chiêu đổi chỉ số vô ích khi đã chạm giới hạn hoặc bị đặc tính chặn', async () => {
  const { stageGuarded, stageMoveUseless } = await import('../src/battle/status.js');
  const m = mon('charmeleon', 30);
  assert.equal(stageMoveUseless(MOVES.dragonDance, m), false);
  changeStage(m, 'atk', 6);
  assert.equal(stageMoveUseless(MOVES.dragonDance, m), false, 'Tốc độ vẫn tăng được');
  changeStage(m, 'speed', 6);
  assert.equal(stageMoveUseless(MOVES.dragonDance, m), true);
  const foe = mon('pidgey', 20);
  changeStage(foe, 'atk', -6);
  assert.equal(stageMoveUseless(MOVES.growl, foe), true);
  assert.equal(stageMoveUseless(MOVES.leer, foe), false);
  assert.equal(stageMoveUseless(MOVES.leer, foe, 'bigPecks'), true);
  assert.equal(stageMoveUseless(MOVES.sandAttack, foe, 'keenEye'), true);
  assert.equal(stageMoveUseless(MOVES.screech, foe, 'clearBody'), true);
  assert.equal(stageMoveUseless(MOVES.swagger, foe), false, 'Swagger còn gây rối loạn');
  assert.equal(stageMoveUseless(MOVES.acid, foe), false, 'chiêu gây sát thương không tính');
  assert.equal(stageGuarded('def', -1, 'bigPecks'), 'bigPecks');
  assert.equal(stageGuarded('def', -1, 'bigPecks', false), null, 'tự giảm chỉ số thì không chặn');
  assert.equal(stageGuarded('atk', 1, 'clearBody'), null);
});

test('EXP theo công thức Gen 5: chênh lệch cấp, chia cho các Pokémon đã ra sân, nhà huấn luyện x1.5, Lucky Egg x1.5', async () => {
  const { expGain, expRate, expShares } = await import('../src/battle/formulas.js');
  // Pidgey (EXP gốc 50) cấp 8 bị Pokémon cấp 10 hạ: 50*8/5 * (26/28)^2.5 + 1 = 67
  const pidgey = mon('pidgey', 8);
  assert.equal(expGain(pidgey, 10), 67);
  // Cùng cấp thì hệ số = 1: 50*8/5 + 1
  assert.equal(expGain(pidgey, 8), 81);
  // Hạ Pokémon cấp cao hơn mình được nhiều hơn, yếu hơn hẳn thì ít đi
  assert.ok(expGain(pidgey, 5) > expGain(pidgey, 8));
  assert.ok(expGain(pidgey, 30) < expGain(pidgey, 8) / 3);
  assert.equal(expGain(pidgey, 8, { trainer: true }), Math.floor(1.5 * 80) + 1);

  const foe = mon('pidgeotto', 30);
  const a = mon('charmeleon', 30);
  const b = mon('pikachu', 30, { heldItem: 'luckyEgg' });
  const solo = expGain(foe, 30);
  const got = (m, exp, egg = 1) => Math.floor(exp * egg * expRate(m));
  assert.deepEqual(expShares(foe, [a]).map((s) => s.amount), [got(a, solo)]);
  const half = expGain(foe, 30, { split: 2 });
  assert.ok(Math.abs(half - solo / 2) <= 1);
  assert.deepEqual(expShares(foe, [a, b]).map((s) => [s.mon, s.amount]), [[a, got(a, half)], [b, got(b, half, 1.5)]]);
  const tHalf = expGain(foe, 30, { trainer: true, split: 2 });
  assert.deepEqual(expShares(foe, [a, b], { trainer: true }).map((s) => s.amount), [got(a, tHalf), got(b, tHalf, 1.5)]);
  assert.deepEqual(expShares(foe, []), []);
});

test('EXP: cả game nhận ít hơn công thức gốc; Pokémon đã tiến hoá nhận ít hơn chưa tiến hoá', async () => {
  const { EXP_RATE, evolutionStage, expRate } = await import('../src/battle/formulas.js');
  assert.deepEqual(['charmander', 'charmeleon', 'charizard', 'vaporeon'].map(evolutionStage), [0, 1, 2, 1]);
  assert.equal(expRate(mon('charmander', 10)), EXP_RATE);
  assert.ok(EXP_RATE < 1);
  assert.ok(expRate(mon('charmeleon', 20)) < expRate(mon('charmander', 20)));
  assert.ok(expRate(mon('charizard', 40)) < expRate(mon('charmeleon', 40)));
});

test('tiến hoá giữ nguyên đặc tính nếu loài mới cũng có (Meowth Technician -> Persian Technician)', async () => {
  const { evolve } = await import('../src/game/evolution.js');
  const { createMonster } = await import('../src/game/monster.js');
  const meowth = createMonster('meowth', 28);
  meowth.hiddenAbility = false;
  meowth.ability = 'technician';
  evolve(meowth, 'persian');
  assert.equal(meowth.speciesId, 'persian');
  assert.equal(meowth.ability, 'technician');
});

test('Pokémon gục mất trạng thái: Revive hồi sinh không còn bị độc / ngủ', async () => {
  const { applyItem } = await import('../src/game/itemUse.js');
  const { createMonster } = await import('../src/game/monster.js');
  const mon = createMonster('pidgey', 10);
  mon.hp = 0;
  mon.status = 'slp';
  mon.sleepTurns = 3;
  applyItem('revive', mon);
  assert.ok(mon.hp > 0);
  assert.equal(mon.status, null);
  assert.equal(mon.sleepTurns, 0);
});

test('bản lưu rất cũ (chưa có IV) mà có chiêu đã bỏ khỏi game: vẫn tải được, chiêu lạ bị bỏ', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame } = await import('../src/game/save.js');
  const { resetState, state } = await import('../src/game/state.js');
  const { createMonster } = await import('../src/game/monster.js');
  resetState();
  state.party = [createMonster('pidgey', 8)];
  saveGame({ map: 'route1', x: 5, y: 10, facing: 'down' });
  const raw = JSON.parse(store.get('pokemon-demo-save-v1'));
  const old = raw.party[0];
  delete old.ivs;
  old.moves = ['tackle', 'moveDaBoKhoiGame'];
  store.set('pokemon-demo-save-v1', JSON.stringify(raw));
  resetState();
  assert.doesNotThrow(() => loadGame());
  assert.deepEqual(state.party[0].moves, ['tackle']);
  assert.ok(state.party[0].ivs, 'được bổ sung IV');
  assert.equal(state.party[0].pp.tackle, MOVES.tackle.pp);
  delete globalThis.localStorage;
});

test('thông tin chiêu: mô tả hiệu ứng phụ và gợi ý khắc chế theo hệ', async () => {
  const { moveNotes, effectivenessHint } = await import('../src/battle/moveInfo.js');
  assert.deepEqual(moveNotes(MOVES.ember), ['10% gây bỏng']);
  assert.ok(moveNotes(MOVES.quickAttack).includes('Luôn ra đòn trước'));
  assert.ok(moveNotes(MOVES.ancientPower).some((n) => n.includes('mọi chỉ số') && n.includes('bản thân')));
  assert.ok(moveNotes(MOVES.growl).some((n) => n.includes('đối thủ')));
  assert.deepEqual(moveNotes(MOVES.tackle), []);
  // mọi chiêu đều mô tả được (không lỗi, không có chữ undefined)
  for (const m of Object.values(MOVES)) for (const n of moveNotes(m)) assert.ok(!n.includes('undefined'), `${m.id}: ${n}`);
  assert.equal(effectivenessHint(MOVES.waterGun, ['fire']).mult, 2);
  assert.equal(effectivenessHint(MOVES.tackle, ['ghost']).mult, 0);
  assert.equal(effectivenessHint(MOVES.growl, ['fire']), null);
});

test('hiệu ứng chiêu: mọi chiêu gây sát thương đều có hiệu ứng, bảng gán chỉ trỏ tới chiêu và kiểu có thật', async () => {
  // moveFx.js dùng Phaser (cần trình duyệt): kiểm tra bảng bằng cách đọc mã nguồn
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/gfx/moveFx.js', import.meta.url), 'utf8');
  const table = src.slice(src.indexOf('const MOVE_FX = {'), src.indexOf('// Kiểu mặc định theo hệ'));
  const kinds = new Set([...src.slice(src.indexOf('const KINDS = {')).matchAll(/^ {2}async (\w+)\(/gm)].map((m) => m[1]));
  for (const [, id, kind] of table.matchAll(/(\w+): \['(\w+)'/g)) {
    assert.ok(MOVES[id], `chiêu ${id} không tồn tại`);
    assert.ok(kinds.has(kind), `${id}: kiểu ${kind} chưa có`);
  }
});

test('chiêu Rest: hệ Siêu linh, 5 PP, tự dùng, có mô tả; Snorlax / Seel / Dewgong học được khi lên cấp', async () => {
  const { moveNotes } = await import('../src/battle/moveInfo.js');
  assert.equal(MOVES.rest.type, 'psychic');
  assert.equal(MOVES.rest.pp, 5);
  assert.ok(MOVES.rest.self && MOVES.rest.rest);
  assert.ok(moveNotes(MOVES.rest).some((n) => /ngủ 2 lượt/.test(n)));
  for (const id of ['snorlax', 'seel', 'dewgong']) assert.ok(SPECIES[id].learnset.some(([, m]) => m === 'rest'), id);
});

test('bắt Pokémon: đội chưa đủ 6 thì vào đội, đủ 6 thì tự gửi vào hộp PC; lưu / tải giữ nguyên hộp', async () => {
  const { addCaught } = await import('../src/game/state.js');
  resetState();
  state.party = [];
  for (let i = 0; i < 6; i++) assert.equal(addCaught(mon('rattata', 5)), 'party');
  const seventh = mon('pidgey', 5);
  assert.equal(addCaught(seventh), 'storage');
  assert.equal(state.party.length, 6);
  assert.deepEqual(state.storage, [seventh]);
  assert.ok(state.dex.caught.size >= 2, 'Pokédex ghi nhận cả con gửi vào PC');
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  saveGame({ map: 'town1', x: 14, y: 9, facing: 'down' });
  resetState();
  loadGame();
  assert.equal(state.storage.length, 1);
  assert.equal(state.storage[0].speciesId, 'pidgey');
});

test('đổi chỗ Pokémon trong đội: con mới lên đầu đi theo và ra trận trước; lưu / tải giữ thứ tự', async () => {
  const { swapParty } = await import('../src/game/state.js');
  resetState();
  const [a, b, c] = [mon('charmander', 5), mon('pidgey', 4), mon('rattata', 3)];
  state.party = [a, b, c];
  assert.equal(swapParty(0, 2), true);
  assert.deepEqual(state.party, [c, b, a]);
  assert.equal(swapParty(1, 1), false, 'chọn chính nó thì không đổi');
  assert.equal(swapParty(0, 5), false, 'vị trí không có Pokémon thì không đổi');
  assert.deepEqual(state.party, [c, b, a]);
  const store = {};
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  saveGame({ map: 'town1', x: 14, y: 9, facing: 'down' });
  resetState();
  loadGame();
  assert.deepEqual(state.party.map((m) => m.speciesId), ['rattata', 'pidgey', 'charmander']);
});

test('ô phím tắt: gán / chuyển ô / bỏ gán, mỗi vật phẩm chỉ nằm một ô; gán tự động vào ô trống đầu tiên', () => {
  resetState();
  assert.match(setHotbarSlot(2, 'bicycle'), /ô phím tắt 3/);
  assert.equal(state.hotbar[2], 'bicycle');
  setHotbarSlot(4, 'bicycle');
  assert.deepEqual(state.hotbar, [null, null, null, null, 'bicycle', null], 'chuyển sang ô mới, ô cũ trống');
  assert.match(setHotbarSlot(4, 'potion'), /thay Xe đạp|thay/);
  assert.equal(state.hotbar[4], 'potion');
  assert.match(setHotbarSlot(4, 'potion'), /bỏ/);
  assert.equal(state.hotbar[4], null);
  assert.equal(assignHotbar('oldRod'), 0);
  assert.equal(assignHotbar('oldRod'), null, 'đã gán rồi thì thôi');
  state.hotbar = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(assignHotbar('oldRod'), null, 'hết ô trống');
});

test('ô phím tắt: kéo thả đổi chỗ hai ô, thả vào ô trống là chuyển sang', () => {
  resetState();
  state.hotbar = ['bicycle', null, 'potion', null, null, null];
  swapHotbarSlots(0, 2);
  assert.deepEqual(state.hotbar.slice(0, 3), ['potion', null, 'bicycle']);
  swapHotbarSlots(2, 4);
  assert.deepEqual(state.hotbar, ['potion', null, null, null, 'bicycle', null]);
});

test('PC: kéo thả giữa hộp và đội hình (đổi chỗ / gửi / rút), đội luôn còn con chiến đấu được, thả Pokémon trả đồ cầm', () => {
  resetState();
  const mk = (id, hp = null) => {
    const m = createMonster(id, 5);
    if (hp !== null) m.hp = hp;
    return m;
  };
  const [a, b, c, d] = [mk('pikachu'), mk('rattata', 0), mk('pidgey'), mk('oddish')];
  state.party = [a, b];
  state.storage = [c, d];
  // Đổi chỗ trong hộp, trong đội
  assert.equal(moveMon({ area: 'box', i: 0 }, { area: 'box', i: 1 }), null);
  assert.deepEqual(state.storage, [d, c]);
  assert.equal(moveMon({ area: 'party', i: 0 }, { area: 'party', i: 1 }), null);
  assert.deepEqual(state.party, [b, a]);
  // Gửi con khoẻ duy nhất vào ô trống của hộp: không được
  assert.match(moveMon({ area: 'party', i: 1 }, { area: 'box', i: 7 }), /ít nhất một/);
  assert.deepEqual(state.party, [b, a]);
  // Đổi con khoẻ trong đội với con khoẻ trong hộp: được
  assert.equal(moveMon({ area: 'party', i: 1 }, { area: 'box', i: 0 }), null);
  assert.deepEqual(state.party, [b, d]);
  assert.deepEqual(state.storage, [a, c]);
  // Rút về ô trống của đội: thêm vào cuối đội
  assert.equal(moveMon({ area: 'box', i: 1 }, { area: 'party', i: 5 }), null);
  assert.deepEqual(state.party, [b, d, c]);
  assert.deepEqual(state.storage, [a]);
  // Gửi con đã gục vào ô trống thứ 4 của hộp: nằm đúng ô đó (các ô giữa để trống)
  assert.equal(moveMon({ area: 'party', i: 0 }, { area: 'box', i: 3 }), null);
  assert.deepEqual(state.storage, [a, null, null, b]);
  // Chuyển sang hộp 2 (ô 31), ô cũ trống, ô trống thừa ở cuối được bỏ
  assert.equal(moveMon({ area: 'box', i: 3 }, { area: 'box', i: BOX_SLOTS + 1 }), null);
  assert.equal(state.storage.length, BOX_SLOTS + 2);
  assert.equal(state.storage[BOX_SLOTS + 1], b);
  assert.equal(state.storage.filter(Boolean).length, 2);
  // Bắt thêm khi đội đầy: vào ô trống đầu tiên của hộp
  state.party = [mk('pikachu'), mk('pikachu'), mk('pikachu'), mk('pikachu'), mk('pikachu'), mk('pikachu')];
  const caught = mk('zubat');
  assert.equal(addCaught(caught), 'storage');
  assert.equal(state.storage[1], caught);
  // Đội đầy 6 con thì không rút thêm vào ô trống
  assert.match(moveMon({ area: 'box', i: 0 }, { area: 'party', i: 6 }), /đủ 6/);
  // Thả: không thả con khoẻ cuối cùng trong đội; thả xong đồ cầm về túi
  state.party = [a, b];
  assert.match(releaseProblem({ area: 'party', i: 0 }), /ít nhất một/);
  assert.equal(releaseProblem({ area: 'party', i: 1 }), null);
  c.heldItem = 'oranBerry';
  state.storage = [c];
  const before = itemCount('oranBerry');
  const { mon, held, kept } = releaseMon({ area: 'box', i: 0 });
  assert.equal(mon, c);
  assert.equal(held, 'oranBerry');
  assert.ok(kept);
  assert.equal(itemCount('oranBerry'), before + 1);
  assert.equal(state.storage.length, 0);
  // Có sẵn 5 hộp 30 ô; đầy cả 5 hộp thì mở thêm hộp mới
  assert.equal(boxCount(), 5);
  state.storage = Array.from({ length: BOX_SLOTS * 5 }, () => mk('pidgey'));
  assert.equal(boxCount(), 6);
});

test('cần câu tặng dọc đường: cũ ở bến câu Hồ Gương, tốt ở bờ suối Tuyến 9, siêu là quà của Lão Ngư Hồ Lạnh sau trận Gyarados chúa', async () => {
  const { MAPS } = await import('../src/data/map.js');
  const { ENCOUNTERS } = await import('../src/data/encounters.js');
  resetState();
  let answer = false;
  let battleResult = 'run';
  const said = [];
  const battles = [];
  const world = {
    say: async (who, lines) => said.push(...lines),
    ask: async (q) => (said.push(q), answer),
    giveItem: async (id) => addItem(id),
    assignHotbar: (id) => assignHotbar(id),
    startBattle: async (data) => (battles.push(data), battleResult),
  };
  const npc = (id) => STORY_NPCS.find((n) => n.id === id);
  // Ngư dân hồ Pallet không còn cho cần, chỉ chỉ đường
  await npc('fisher').onTalk(world);
  assert.equal(itemCount('oldRod'), 0);
  assert.ok(said.some((l) => /Hồ Gương/.test(l)), 'ngư dân chỉ đường tới bến câu Hồ Gương');
  // Hỏi trước, đồng ý mới nhận, tự gán phím tắt, có hướng dẫn dùng (không còn phím F)
  await npc('r6-rod-giver').onTalk(world);
  assert.equal(itemCount('oldRod'), 0, 'từ chối thì không nhận');
  answer = true;
  await npc('r6-rod-giver').onTalk(world);
  assert.equal(itemCount('oldRod'), 1);
  assert.equal(state.hotbar[0], 'oldRod', 'tự gán vào ô phím tắt trống');
  assert.ok(said.some((l) => /quay mặt ra mặt nước/.test(l)) && !said.some((l) => /bấm F/.test(l)));
  await npc('r9-rod-giver').onTalk(world);
  assert.equal(itemCount('goodRod'), 1);
  // Lão Ngư: phải có cần câu tốt; thắng / bắt được Gyarados chúa mới tặng cần siêu
  const old = npc('r10-rod-giver');
  battleResult = 'run';
  await old.onTalk(world);
  assert.equal(itemCount('superRod'), 0, 'bỏ chạy thì chưa nhận');
  assert.equal(battles.at(-1).enemy.speciesId, 'gyarados');
  battleResult = 'win';
  await old.onTalk(world);
  assert.equal(itemCount('superRod'), 1);
  // Người tặng đứng trên ô đi được; cá câu được ở chính khu đó không mạnh vượt đội lúc tới đó quá xa
  // (cấp thủ lĩnh gym ngay trước khu: Đèn Lồng 28, Thạch Sơn 39, Chùa Cổ 41 + trận Gyarados Lv 46)
  for (const [id, rod, level] of [['r6-rod-giver', 'oldRod', 28], ['r9-rod-giver', 'goodRod', 39], ['r10-rod-giver', 'superRod', 46]]) {
    const n = npc(id);
    assert.equal(MAPS[n.map].isSolid(n.x, n.y), false, `${id} đứng trên ô cản`);
    const table = ENCOUNTERS[MAPS[n.map].water[rod]];
    assert.ok(Math.max(...table.map((e) => e.max)) <= level + 4, `${n.map} ${rod}: cá quá mạnh so với lúc nhận cần`);
  }
});

test('đầu game: mẹ cho 2 Potion, Oak cho Pokédex + 5 Poké Ball sau trận với Gary, bắt Pokémon đầu tiên thì thưởng 3 Potion', async () => {
  const { MAPS } = await import('../src/data/map.js');
  const items = MAPS.route1.objects.filter((o) => o.kind === 'item');
  // Bãi cỏ Pallet không có đồ; hai góc dưới: 2 thuốc giải độc, 2 thuốc giải tê liệt
  assert.deepEqual(items.map((o) => [o.item, o.qty]).sort(), [['antidote', 2], ['paralyzeHeal', 2]]);
  for (const o of items) assert.ok(!MAPS.route1.info(o.x, o.y).encounter, `${o.id} nằm trong bụi cỏ`);
  resetState();
  const world = {
    say: async () => {},
    ask: async () => true,
    giveItem: async (id, qty = 1) => addItem(id, qty),
  };
  await STORY_NPCS.find((n) => n.id === 'mom').onTalk(world);
  assert.equal(itemCount('potion'), 2);
  const oak = STORY_NPCS.find((n) => n.id === 'oak');
  for (const f of ['metOak', 'gotStarter', 'starter:charmander', 'rival1', 'gotPokedex']) setFlag(f);
  state.party = [createMonster('charmander', 5), createMonster('pidgey', 3)];
  const before = itemCount('potion');
  await oak.onTalk(world);
  assert.equal(itemCount('potion'), before, 'chưa bắt Pokémon nào thì chưa thưởng');
  state.dex.caught.add(SPECIES.pidgey.dexId);
  await oak.onTalk(world);
  assert.ok(state.flags.has('questDone'));
  assert.equal(itemCount('potion'), before + 3, 'thưởng 3 Potion');
  assert.equal(itemCount('greatBall'), 0, 'không còn tặng Great Ball')
});

test('túi đồ chia 6 ngăn: mỗi vật phẩm thuộc đúng một ngăn, ngăn nào cũng có đồ', async () => {
  const { BAG_POCKETS, pocketOf } = await import('../src/data/items.js');
  const ids = Object.keys(ITEMS);
  const pockets = BAG_POCKETS.map((p) => p.id);
  for (const id of ids) assert.ok(pockets.includes(pocketOf(id)), `${id}: không thuộc ngăn nào`);
  for (const p of pockets) assert.ok(ids.some((id) => pocketOf(id) === p), `ngăn ${p} trống`);
  assert.deepEqual(BAG_POCKETS.map((p) => p.name), ['Vật phẩm', 'Bóng', 'Quả mọng', 'Kỹ năng', 'Phụ kiện']);
  assert.equal(pocketOf('potion'), 'item', 'thuốc hồi phục gộp vào ngăn Vật phẩm');
  assert.equal(pocketOf('greatBall'), 'ball');
  assert.equal(pocketOf('oranBerry'), 'berry');
  assert.equal(pocketOf('leppaBerry'), 'berry', 'quả mọng nào cũng vào ngăn quả mọng');
  assert.equal(pocketOf('rareCandy'), 'item');
  assert.equal(pocketOf('bicycle'), 'held');
  assert.equal(pocketOf('leftovers'), 'held', 'đồ cầm vào ngăn Phụ kiện');
  assert.equal(pocketOf('hmSurf'), 'tm', 'HM vào ngăn Kỹ năng');
  assert.equal(pocketOf('tmThunderbolt'), 'tm', 'đĩa kỹ năng vào ngăn Kỹ năng');
  for (const p of BAG_POCKETS) assert.ok(ITEMS[p.item], `${p.id}: icon ngăn không có`);
});
