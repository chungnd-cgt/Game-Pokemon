import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMonster, gainExp, expForLevel, expProgress } from '../src/game/monster.js';
import { calcDamage, catchChance, rollCatch, playerGoesFirst } from '../src/battle/formulas.js';
import { rollEncounter, ENCOUNTERS } from '../src/data/encounters.js';
import { MOVES } from '../src/data/moves.js';
import { SPECIES } from '../src/data/monsters.js';
import { DEX, DEX_BY_SLUG } from '../src/data/pokedex.js';
import { TYPES, typeMultiplier } from '../src/data/types.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { ITEMS, MART_STOCK, sellPrice } from '../src/data/items.js';
import { buy, itemCount, sell, state } from '../src/game/state.js';
import { MAPS, SPAWN, HEAL_RESPAWN } from '../src/data/map.js';
const route = MAPS.route1;

const fixed = (v) => () => v;

test('Pokédex có đủ 151 Pokémon, số thứ tự liên tục', () => {
  assert.equal(DEX.length, 151);
  DEX.forEach((p, i) => assert.equal(p.id, i + 1));
});

// pokemondb tính cả đặc tính đầu tiên vào "Type defenses" (game chưa có đặc tính)
const ABILITY_TYPES = {
  'Flash Fire': ['fire'],
  'Water Absorb': ['water'],
  'Volt Absorb': ['electric'],
  Levitate: ['ground'],
  'Thick Fat': ['fire', 'ice'],
};

test('bảng tương khắc trong game khớp "Type defenses" của cả 151 Pokémon', () => {
  for (const p of DEX) {
    const ability = p.abilities[0].name;
    for (const [moveType, expected] of Object.entries(p.typeDefenses)) {
      assert.ok(TYPES[moveType], `thiếu hệ ${moveType}`);
      if (ABILITY_TYPES[ability]?.includes(moveType)) continue;
      assert.equal(typeMultiplier(moveType, p.types), expected, `${p.name}: ${moveType}`);
    }
  }
});

test('Pokémon chơi được lấy chỉ số từ Pokédex', () => {
  for (const sp of Object.values(SPECIES)) {
    const dex = DEX_BY_SLUG[sp.id];
    assert.deepEqual(sp.types, dex.types);
    assert.equal(sp.base.speed, dex.stats.speed);
    assert.equal(sp.catchRate, dex.catchRate);
  }
});

test('Pokémon mới tạo đầy máu và biết chiêu theo cấp', () => {
  const mon = createMonster('charmander', 5);
  assert.equal(mon.hp, mon.maxHp);
  assert.deepEqual(mon.moves, ['scratch', 'ember']);
  assert.equal(mon.exp, expForLevel(5));
});

test('mọi chiêu trong learnset đều tồn tại', () => {
  for (const sp of Object.values(SPECIES)) {
    for (const [, move] of sp.learnset) assert.ok(MOVES[move], `${sp.id}: thiếu chiêu ${move}`);
  }
});

test('lên cấp tăng chỉ số và học chiêu mới', () => {
  const mon = createMonster('charmander', 12);
  const before = mon.maxHp;
  const events = gainExp(mon, expForLevel(13) - mon.exp);
  assert.equal(mon.level, 13);
  assert.ok(mon.maxHp > before);
  assert.ok(events.some((e) => e.type === 'learn' && e.move === 'fireFang'));
  assert.equal(expProgress(mon), 0);
});

test('khắc hệ gây sát thương gấp đôi', () => {
  const fire = createMonster('charmander', 10);
  const grass = createMonster('oddish', 10);
  const water = createMonster('poliwag', 10);
  const toGrass = calcDamage(fire, grass, MOVES.ember, fixed(0.5));
  const toWater = calcDamage(fire, water, MOVES.ember, fixed(0.5));
  assert.equal(toGrass.effectiveness, 2);
  assert.equal(toWater.effectiveness, 0.5);
  assert.ok(toGrass.damage > toWater.damage);
});

test('Pokémon càng yếu càng dễ bắt', () => {
  const mon = createMonster('pikachu', 5);
  const full = catchChance(mon);
  mon.hp = 1;
  assert.ok(catchChance(mon) > full);
  assert.deepEqual(rollCatch(mon, 1, fixed(0)), { caught: true, shakes: 3 });
  assert.equal(rollCatch(mon, 1, fixed(0.9999)).caught, false);
});

test('chiêu ưu tiên ra đòn trước dù chậm hơn', () => {
  const slow = createMonster('oddish', 5);
  const fast = createMonster('pikachu', 5);
  assert.equal(playerGoesFirst(slow, MOVES.quickAttack, fast, MOVES.thunderShock), true);
  assert.equal(playerGoesFirst(slow, MOVES.absorb, fast, MOVES.thunderShock), false);
});

test('bảng gặp Pokémon trả về cấp hợp lệ', () => {
  for (const zone of Object.keys(ENCOUNTERS)) {
    for (const r of [0, 0.3, 0.7, 0.9999]) {
      const { speciesId, level } = rollEncounter(zone, fixed(r));
      const entry = ENCOUNTERS[zone].find((e) => e.species === speciesId);
      assert.ok(level >= entry.min && level <= entry.max);
    }
  }
});

test('bản đồ hợp lệ: viền là cây, điểm xuất phát đi được', () => {
  for (let x = 0; x < route.width; x++) {
    assert.equal(route.tileAt(x, 0), 'T');
    assert.equal(route.tileAt(x, route.height - 1), 'T');
  }
  assert.ok(!MAPS[SPAWN.map].isSolid(SPAWN.x, SPAWN.y));
  assert.ok(!MAPS[HEAL_RESPAWN.map].isSolid(HEAL_RESPAWN.x, HEAL_RESPAWN.y));
  assert.ok(route.doorAt(SPAWN.x, SPAWN.y - 1), 'cửa Pokémon Center nằm ngay trên điểm xuất phát');
});

test('cây trên bản đồ luôn là khối 2x2 thẳng hàng', () => {
  for (let y = 0; y < route.height; y++) {
    for (let x = 0; x < route.width; x++) {
      if (route.tileAt(x, y) !== 'T') continue;
      const bx = x & ~1;
      const by = y & ~1;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        assert.equal(route.tileAt(bx + dx, by + dy), 'T', `cây lệch tại (${x}, ${y})`);
      }
    }
  }
});

test('cửa nhà dẫn vào trong, thảm trong nhà dẫn ra đúng trước cửa', () => {
  for (const b of route.buildings) {
    const inside = MAPS[b.to];
    assert.ok(inside, `thiếu bản đồ ${b.to}`);
    assert.ok(!inside.isSolid(inside.entry.x, inside.entry.y), `${b.to}: chỗ vào bị chặn`);
    assert.ok(!inside.info(inside.entry.x, inside.entry.y).exit, `${b.to}: vừa vào đã đứng trên thảm ra`);
    assert.deepEqual({ x: inside.exit.x, y: inside.exit.y }, { x: b.door.x, y: b.door.y + 1 });
    assert.ok(inside.rows.some((r) => r.includes('E')), `${b.to}: thiếu thảm cửa ra`);
  }
});

test('NPC và nhà huấn luyện đứng ở ô đi được, không chồng lên nhau', () => {
  const seen = new Set();
  for (const npc of [...NPCS, ...TRAINERS]) {
    const map = MAPS[npc.map];
    assert.ok(map, `${npc.name}: thiếu bản đồ ${npc.map}`);
    assert.ok(!map.isSolid(npc.x, npc.y), `${npc.name} đứng trên ô cản`);
    const key = `${npc.map}:${npc.x},${npc.y}`;
    assert.ok(!seen.has(key), `${npc.name} chồng lên NPC khác`);
    seen.add(key);
  }
});

test('Y tá Joy và nhân viên đứng sau quầy, nói chuyện được qua quầy', () => {
  for (const role of ['nurse', 'clerk']) {
    const npc = NPCS.find((n) => n.role === role);
    const map = MAPS[npc.map];
    assert.ok(map.info(npc.x, npc.y + 1).counter, `${npc.name}: phía trước không phải quầy`);
    assert.ok(!map.isSolid(npc.x, npc.y + 2), `${npc.name}: không có chỗ đứng trước quầy`);
  }
});

test('bán đồ được nửa giá', () => {
  state.money = 0;
  state.bag = { potion: 2 };
  assert.equal(sell('potion', 5, sellPrice('potion')), 2, 'chỉ bán được số đang có');
  assert.equal(state.money, 300);
  assert.equal(itemCount('potion'), 0);
});

test('đội hình nhà huấn luyện chỉ gồm Pokémon chơi được', () => {
  for (const t of TRAINERS) {
    assert.ok(t.team.length > 0);
    for (const [id, level] of t.team) {
      assert.ok(SPECIES[id], `${t.name}: chưa có ${id}`);
      assert.ok(createMonster(id, level).moves.length > 0);
    }
  }
});

test('cửa hàng bán đúng vật phẩm, trừ tiền khi mua', () => {
  for (const id of MART_STOCK) assert.ok(ITEMS[id]?.price > 0, id);
  state.money = 1000;
  state.bag = {};
  assert.equal(buy('ball', 3, ITEMS.ball.price), true);
  assert.equal(state.money, 400);
  assert.equal(itemCount('ball'), 3);
  assert.equal(buy('ultraBall', 1, ITEMS.ultraBall.price), false, 'không đủ tiền thì không mua được');
  assert.equal(state.money, 400);
});
