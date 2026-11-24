import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { HOUSE_RESIDENTS } from '../src/data/npcHouses.js';
import { createMonster } from '../src/game/monster.js';
import { hasFlag, itemCount, resetState, state } from '../src/game/state.js';
import { residentGift, residentTalk, residentTrade } from '../src/story/residents.js';

const houses = Object.entries(MAPS).flatMap(([id, m]) => m.buildings.filter((b) => b.type === 'house').map((b) => ({ map: id, b })));

test('nhà dân: phần lớn vào được, lác đác vài nhà khoá; nhà nhiệm vụ làng giữ nguyên', () => {
  const locked = houses.filter(({ b }) => !b.to);
  assert.ok(houses.length - locked.length > houses.length * 0.7, 'phần lớn nhà vào được');
  assert.ok(locked.length >= 1, 'vẫn có nhà khoá');
  for (const [map, x, y] of [['village1', 19, 15], ['village2', 11, 7], ['village5', 4, 16], ['village7', 13, 5]]) {
    const house = MAPS[map].buildings.find((b) => b.door.x === x && b.door.y === y);
    assert.ok(house && !house.to, `${map} (${x},${y}): nhà nhiệm vụ không có phòng dựng sẵn`);
  }
});

test('nhà dân: phòng có cửa ra về đúng trước cửa nhà, người ở đứng chỗ đi được, không chặn lối vào', () => {
  const ids = new Set();
  for (const r of HOUSE_RESIDENTS) {
    assert.ok(!ids.has(r.id), r.id);
    ids.add(r.id);
    const room = MAPS[r.map];
    const outside = houses.find(({ b }) => b.to === r.map);
    assert.ok(outside, `${r.map}: có nhà dẫn vào`);
    assert.deepEqual(room.exit, { to: outside.map, x: outside.b.door.x, y: outside.b.door.y + 1 });
    assert.equal(room.isSolid(r.x, r.y), false, `${r.id}: chỗ đứng`);
    assert.equal(room.isSolid(room.entry.x, room.entry.y), false, `${r.map}: chỗ vào`);
    assert.notDeepEqual([r.x, r.y], [room.entry.x, room.entry.y]);
  }
  const kinds = new Set(HOUSE_RESIDENTS.filter((r) => r.resident).map((r) => r.resident.kind));
  for (const k of ['chat', 'gift', 'battle', 'trade']) assert.ok(kinds.has(k), `có người ở kiểu ${k}`);
});

function fakeWorld(answers = [], pickIndex = 0) {
  const log = { said: [], items: [], battles: [], evolved: [] };
  return {
    log,
    say: async (who, lines) => log.said.push([who, ...lines]),
    ask: async () => answers.shift() ?? true,
    giveItem: async (id, qty) => {
      log.items.push([id, qty]);
      state.bag[id] = (state.bag[id] ?? 0) + qty;
    },
    pickMon: async () => pickIndex,
    startBattle: async (data) => (log.battles.push(data), 'win'),
    evolutionScene: async (mon, to) => log.evolved.push(to),
    refreshFollower: () => {},
  };
}

test('người ở tặng quà: chỉ tặng một lần', async () => {
  resetState();
  const def = HOUSE_RESIDENTS.find((r) => r.resident?.kind === 'gift');
  const [id, qty] = residentGift(def);
  const world = fakeWorld();
  await residentTalk(world, def);
  await residentTalk(world, def);
  assert.deepEqual(world.log.items, [[id, qty]]);
  assert.equal(itemCount(id), qty);
});

test('người ở đổi Pokémon: chọn đúng loài họ muốn thì nhận Pokémon của họ vào đúng chỗ trong đội, chỉ đổi một lần', async () => {
  resetState();
  const def = HOUSE_RESIDENTS.find((r) => r.resident?.kind === 'trade');
  const { want, give, nickname, item } = residentTrade(def);
  state.party = [createMonster('pikachu', 10), createMonster(want, 12)];
  // Chọn nhầm loài: không đổi
  await residentTalk(fakeWorld([true], 0), def);
  assert.equal(state.party[0].speciesId, 'pikachu');
  assert.equal(hasFlag(`resident:${def.id}:trade`), false);
  // Chọn đúng loài, xác nhận: đổi
  await residentTalk(fakeWorld([true, true], 1), def);
  assert.equal(state.party[1].speciesId, give);
  assert.equal(state.party[1].level, 12);
  assert.equal(state.party[1].name, nickname, 'có biệt danh');
  assert.equal(state.party[1].heldItem, item, 'cầm sẵn đồ');
  assert.ok(hasFlag(`resident:${def.id}:trade`));
  // Lần sau chỉ nói chuyện
  const again = fakeWorld([true, true], 0);
  await residentTalk(again, def);
  assert.equal(state.party[0].speciesId, 'pikachu');
});

test('người ở đổi Pokémon: muốn loài hay gặp quanh khu đó, đưa loài hiếm khu đó không có', () => {
  for (const def of HOUSE_RESIDENTS.filter((r) => r.resident?.kind === 'trade')) {
    const { want, give } = residentTrade(def);
    const outer = MAPS[MAPS[def.map].exit.to];
    const near = [outer, ...outer.warps.map((w) => MAPS[w.to]).filter((m) => m && !m.indoor)];
    const tables = near.flatMap((m) => [...(m.areas ?? []).map((a) => a.table), m.water?.surf]).filter(Boolean);
    const species = new Set(tables.flatMap((t) => (ENCOUNTERS[t] ?? []).map((e) => e.species)));
    if (species.size) assert.ok(species.has(want), `${def.id}: ${want} bắt được quanh đó`);
    assert.ok(!species.has(give), `${def.id}: ${give} không có quanh đó`);
    assert.notEqual(want, give);
  }
});

test('người ở thách đấu: đội hình theo cấp của khu (không theo đội người chơi)', async () => {
  const { residentLevel } = await import('../src/story/residents.js');
  resetState();
  const def = HOUSE_RESIDENTS.find((r) => r.resident?.kind === 'battle');
  state.party = [createMonster('mewtwo', 70)];
  const world = fakeWorld([true]);
  await residentTalk(world, def);
  const team = world.log.battles[0].trainer.team;
  const lv = residentLevel(def);
  assert.ok(team.length >= 1 && team.every(([, l], i) => l === lv + i));
  // Thị trấn Lục Bình (đầu game): đội người ở cấp thấp dù người chơi có Pokémon cấp cao
  const town1 = HOUSE_RESIDENTS.filter((r) => r.resident?.kind === 'battle' && r.map.includes('town1'));
  for (const r of town1) assert.ok(residentLevel(r) <= 10, `${r.id}: Lv${residentLevel(r)}`);
});

test('nhà dân: có nhà 2-3 người, có nhà nuôi Pokémon đi lại trong nhà (không tới cửa ra); mỗi nhà đúng một chủ nhà', () => {
  const byHouse = {};
  for (const r of HOUSE_RESIDENTS) (byHouse[r.map] ??= []).push(r);
  const counts = Object.values(byHouse).map((list) => list.filter((r) => !r.mon).length);
  assert.ok(counts.includes(1) && counts.includes(2) && counts.includes(3), 'đủ nhà 1, 2, 3 người');
  for (const [map, list] of Object.entries(byHouse)) {
    assert.equal(list.filter((r) => r.resident).length, 1, `${map}: một chủ nhà`);
    const spots = list.map((r) => `${r.x},${r.y}`);
    assert.equal(new Set(spots).size, spots.length, `${map}: không đứng chồng lên nhau`);
    for (const pet of list.filter((r) => r.mon)) {
      const room = MAPS[map];
      assert.ok(pet.x - pet.wander > room.entry.x, `${map}: Pokémon nuôi không đi tới chỗ vào / cửa ra`);
    }
  }
  assert.ok(HOUSE_RESIDENTS.some((r) => r.mon && r.wander), 'có Pokémon nuôi đi lại');
});

test('Lão Ma Mãnh: đổi Machoke lấy Haunter cầm Everstone, Haunter không tiến hoá', async () => {
  resetState();
  const def = HOUSE_RESIDENTS.find((r) => r.name === 'Lão Ma Mãnh');
  assert.ok(def, 'có Lão Ma Mãnh');
  assert.equal(MAPS[MAPS[def.map].exit.to].name, 'Bản Vách Đá');
  state.party = [createMonster('pikachu', 40), createMonster('machoke', 40)];
  const world = fakeWorld([true, true], 1);
  await residentTalk(world, def);
  const got = state.party[1];
  assert.equal(got.speciesId, 'haunter');
  assert.equal(got.heldItem, 'everstone');
  assert.equal(world.log.evolved.length, 0, 'Haunter cầm Everstone không tiến hoá');
  assert.ok(world.log.said.some((l) => l.join(' ').includes('Machamp')), 'Machoke của lão tiến hoá thành Machamp');
});

test('nhà dân: tên người ở không trùng nhau', () => {
  const names = HOUSE_RESIDENTS.filter((r) => !r.mon).map((r) => r.name);
  assert.equal(new Set(names).size, names.length, names.join(', '));
});
