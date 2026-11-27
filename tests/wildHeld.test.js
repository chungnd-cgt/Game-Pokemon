import assert from 'node:assert/strict';
import test from 'node:test';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { ITEMS, canHold } from '../src/data/items.js';
import { MAPS } from '../src/data/map.js';
import { SPECIES } from '../src/data/monsters.js';
import { RARE, WILD_HELD, canHoldWild, rollWildHeld } from '../src/data/wildHeld.js';
import { createMonster } from '../src/game/monster.js';
import { mapAreaInfo } from '../src/ui/areaSpecies.js';

// Pokémon hoang dã cầm sẵn vật phẩm (data/wildHeld.js) và bảng Pokémon khu vực (ui/AreaNav.js)

const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('bảng cầm đồ hoang dã: loài và vật phẩm hợp lệ, cầm được, tổng tỉ lệ không quá 100%', () => {
  const wild = new Set(Object.values(ENCOUNTERS).flat().map((e) => e.species));
  for (const [species, list] of Object.entries(WILD_HELD)) {
    assert.ok(SPECIES[species], `loài lạ ${species}`);
    assert.ok(wild.has(species), `${species} không gặp được ngoài tự nhiên`);
    let total = 0;
    for (const [id, chance] of list) {
      assert.ok(ITEMS[id] && canHold(id), `${species}: ${id} không cầm được`);
      assert.ok(chance > 0 && chance <= 1);
      total += chance;
    }
    assert.ok(total <= 1, `${species}: tổng tỉ lệ ${total}`);
  }
});

test('tung vật phẩm: tỉ lệ cộng dồn theo thứ tự, loài không có trong bảng thì không cầm gì', () => {
  assert.equal(rollWildHeld('snorlax', () => 0.1), 'leftovers');
  assert.equal(rollWildHeld('snorlax', () => 0.6), null);
  assert.equal(rollWildHeld('paras', () => 0.1), 'pechaBerry');
  assert.equal(rollWildHeld('paras', () => 0.22), 'lumBerry');
  assert.equal(rollWildHeld('paras', () => 0.3), null);
  assert.equal(rollWildHeld('pidgey', () => RARE - 0.001), 'sharpBeak');
  assert.equal(rollWildHeld('pidgey', () => RARE), null);
  assert.equal(rollWildHeld('magikarp', () => 0), null);
  assert.equal(canHoldWild('magikarp'), false);
  assert.equal(canHoldWild('pidgey'), true);
});

test('Pokémon hoang dã (wild: true) có thể cầm đồ; Pokémon thường / của nhà huấn luyện thì không', () => {
  assert.equal(createMonster('snorlax', 30, { wild: true, rng: () => 0 }).heldItem, 'leftovers');
  assert.equal(createMonster('snorlax', 30, { rng: () => 0 }).heldItem, null);
  assert.equal(createMonster('snorlax', 30, { trainer: true, rng: () => 0 }).heldItem, null);
  assert.equal(createMonster('magikarp', 5, { wild: true, rng: () => 0 }).heldItem, null);
  // Tung sau các đặc điểm khác: cùng chuỗi số ngẫu nhiên thì IV / tính cách y như Pokémon không tung đồ
  const a = createMonster('pidgey', 5, { wild: true, rng: seq(0.3, 0.7, 0.01, 0.9, 0.5) });
  const b = createMonster('pidgey', 5, { rng: seq(0.3, 0.7, 0.01, 0.9, 0.5) });
  assert.deepEqual(a.ivs, b.ivs);
  assert.equal(a.nature, b.nature);
});

test('bảng Pokémon khu vực: thông tin bản đồ (cỏ / hang / lướt nước / câu cá), trong nhà thì không có', () => {
  const pallet = mapAreaInfo(MAPS.route1);
  assert.equal(pallet.title, MAPS.route1.name);
  assert.deepEqual(pallet.sections.map((s) => s.kind), ['grass', 'surf', 'fish']);
  assert.deepEqual(pallet.sections[2].tables, ['pallet-lake-old', 'pallet-lake-good', 'pallet-lake-super']);
  assert.equal(mapAreaInfo(MAPS.lab), null);
  assert.equal(mapAreaInfo(MAPS.home), null);
});

