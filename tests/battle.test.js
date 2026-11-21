import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMonster, gainExp, expForLevel, expProgress, expToReach } from '../src/game/monster.js';
import { calcDamage, catchChance, rollCatch, playerGoesFirst } from '../src/battle/formulas.js';
import { rollEncounter, ENCOUNTERS } from '../src/data/encounters.js';
import { MOVES } from '../src/data/moves.js';
import { SPECIES } from '../src/data/monsters.js';
import { DEX, DEX_BY_SLUG } from '../src/data/pokedex.js';
import { TYPES, typeMultiplier } from '../src/data/types.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { ITEMS, MART_TIERS, martStock, sellPrice } from '../src/data/items.js';
import { buy, itemCount, markCaught, resetState, sell, setFlag, state } from '../src/game/state.js';
import { deleteSave, hasSave, loadGame, saveGame } from '../src/game/save.js';
import { F, STORY_NPCS, declinedAllStarters, objectVisible, objective, questProgress } from '../src/story/chapter1.js';
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
  assert.deepEqual(mon.moves, ['growl', 'scratch']);
  assert.deepEqual(mon.pp, { growl: 40, scratch: 35 });
  assert.equal(mon.exp, expToReach(mon, 5));
});

test('mọi chiêu trong learnset đều tồn tại', () => {
  for (const sp of Object.values(SPECIES)) {
    for (const [, move] of sp.learnset) assert.ok(MOVES[move], `${sp.id}: thiếu chiêu ${move}`);
  }
});

test('lên cấp tăng chỉ số và học chiêu mới (đủ 4 chiêu thì không học được)', () => {
  // Rattata (FireRed/LeafGreen): Tackle, Tail Whip cấp 1, Quick Attack cấp 7, Hyper Fang cấp 13
  const mon = createMonster('rattata', 12);
  assert.deepEqual(mon.moves, ['tailWhip', 'tackle', 'quickAttack']);
  const before = mon.maxHp;
  const events = gainExp(mon, expToReach(mon, 13) - mon.exp);
  assert.equal(mon.level, 13);
  assert.ok(mon.maxHp > before);
  assert.ok(events.some((e) => e.type === 'learn' && e.move === 'hyperFang'));
  assert.equal(mon.pp.hyperFang, MOVES.hyperFang.pp);
  assert.equal(expProgress(mon), 0);

  // Charmander cấp 25 đã đủ 4 chiêu, cấp 31 không học được Flamethrower
  const full = createMonster('charmander', 25);
  assert.deepEqual(full.moves, ['ember', 'metalClaw', 'smokescreen', 'scaryFace']);
  const ev = gainExp(full, expToReach(full, 31) - full.exp);
  assert.ok(ev.some((e) => e.type === 'cantLearn' && e.move === 'flamethrower'));
});

test('Pokémon khởi đầu cấp 5 biết đúng chiêu FireRed/LeafGreen: chưa có chiêu theo hệ', () => {
  const expected = {
    bulbasaur: ['tackle', 'growl'],
    charmander: ['growl', 'scratch'],
    squirtle: ['tackle', 'tailWhip'],
    pikachu: ['growl', 'thunderShock'],
  };
  for (const [id, moves] of Object.entries(expected)) assert.deepEqual(createMonster(id, 5).moves, moves, id);
  // Đối thủ Gary: khởi đầu cấp 10 mới có chiêu theo hệ (Ember cấp 7, Bubble cấp 7, Vine Whip cấp 10)
  assert.deepEqual(createMonster('charmander', 10).moves, ['growl', 'scratch', 'ember']);
  assert.deepEqual(createMonster('squirtle', 10).moves, ['tackle', 'tailWhip', 'bubble', 'withdraw']);
  assert.deepEqual(createMonster('bulbasaur', 10).moves, ['tackle', 'growl', 'vineWhip']);
});

test('tiến hoá học chiêu tiến hoá và chiêu đúng cấp của loài mới (Gen 7+), sau đó lên cấp theo loài mới', async () => {
  const { evolve } = await import('../src/game/evolution.js');
  resetState();
  // Đá tiến hoá: Raichu học Thunder Punch khi tiến hoá
  const pika = createMonster('pikachu', 10);
  pika.moves = ['thunderShock'];
  pika.pp = { thunderShock: 30 };
  assert.deepEqual(evolve(pika, 'raichu'), [{ type: 'learn', move: 'thunderPunch' }]);
  assert.equal(pika.pp.thunderPunch, MOVES.thunderPunch.pp);
  // Tiến hoá theo cấp: Gyarados học Bite
  const karp = createMonster('magikarp', 20);
  assert.deepEqual(karp.moves, ['splash', 'tackle']);
  assert.deepEqual(evolve(karp, 'gyarados'), [{ type: 'learn', move: 'bite' }]);
  assert.deepEqual(karp.moves, ['splash', 'tackle', 'bite']);
  // Loài mới học chiêu đúng ở cấp hiện tại (Ivysaur học Razor Leaf cấp 22), lên cấp sau đó theo bộ chiêu của Ivysaur
  const bulb = createMonster('bulbasaur', 22);
  bulb.moves = ['tackle', 'vineWhip'];
  bulb.pp = { tackle: 35, vineWhip: 25 };
  assert.deepEqual(evolve(bulb, 'ivysaur'), [{ type: 'learn', move: 'razorLeaf' }]);
  const later = gainExp(bulb, expToReach(bulb, 29) - bulb.exp);
  assert.ok(later.some((e) => e.type === 'learn' && e.move === 'sweetScent'), 'Ivysaur học Sweet Scent cấp 29 (Bulbasaur học cấp 25)');
  // Đủ 4 chiêu thì không học được: chiêu tiến hoá (Air Slash) và chiêu cấp 36 của Charizard (Wing Attack)
  const full = createMonster('charmeleon', 36);
  assert.equal(full.moves.length, 4);
  assert.deepEqual(evolve(full, 'charizard'), [{ type: 'cantLearn', move: 'airSlash' }, { type: 'cantLearn', move: 'wingAttack' }]);
  // Chiêu tiến hoá của mọi loài đều có trong moves.js
  for (const sp of Object.values(SPECIES)) for (const m of sp.evolutionMoves) assert.ok(MOVES[m], `${sp.id}: thiếu chiêu ${m}`);
});

test('mọi loài có chiêu gây sát thương từ cấp thấp nhất gặp được (hoang dã, nhà huấn luyện, quà) trở lên', async () => {
  const { ROCKET_NPCS } = await import('../src/story/rocket.js');
  const minLevel = {};
  const seen = (id, lv) => { minLevel[id] = Math.min(minLevel[id] ?? Infinity, lv); };
  for (const list of Object.values(ENCOUNTERS)) for (const e of list) seen(e.species, e.min);
  for (const t of [...TRAINERS, ...STORY_NPCS, ...ROCKET_NPCS]) for (const [id, lv] of t.team ?? []) seen(id, lv);
  for (const id of ['bulbasaur', 'charmander', 'squirtle', 'pikachu']) seen(id, 5);
  seen('eevee', 20);
  for (const [id, min] of Object.entries(minLevel)) {
    // Ditto chỉ biết Transform: biến hình rồi đánh bằng chiêu của đối thủ (tests/abilities-full.test.js)
    if (id === 'ditto') {
      assert.deepEqual(createMonster(id, min).moves, ['transform']);
      continue;
    }
    // Magikarp gốc chỉ biết Splash tới cấp 15 (Tackle). Oddish / Gloom cấp 18-23 nhờ ngoại lệ trong createMonster
    for (let lv = id === 'magikarp' ? 15 : min; lv <= 100; lv++) {
      const mon = createMonster(id, lv);
      assert.ok(mon.moves.some((m) => MOVES[m].category !== 'status'), `${id} cấp ${lv}: không có chiêu gây sát thương`);
    }
  }
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

test('bản đồ hợp lệ: viền là cây (trừ lối ra phía bắc và dòng sông phía nam, đều là ô chuyển bản đồ), điểm xuất phát đi được', () => {
  for (let x = 0; x < route.width; x++) {
    for (const y of [0, route.height - 1]) {
      const t = route.tileAt(x, y);
      assert.ok(t === 'T' || route.warpAt(x, y), `(${x}, ${y}): ${t}`);
    }
  }
  for (let y = 0; y < route.height; y++) {
    for (const x of [0, route.width - 1]) assert.equal(route.tileAt(x, y), 'T', `(${x}, ${y})`);
  }
  assert.ok(!MAPS[SPAWN.map].isSolid(SPAWN.x, SPAWN.y));
  assert.ok(!MAPS[HEAL_RESPAWN.map].isSolid(HEAL_RESPAWN.x, HEAL_RESPAWN.y));
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
  for (const npc of [...NPCS, ...TRAINERS, ...STORY_NPCS]) {
    const map = MAPS[npc.map];
    assert.ok(map, `${npc.name}: thiếu bản đồ ${npc.map}`);
    // NPC ngồi (mẹ ngồi sofa) thì nằm trên ô sofa, phải có ô trống bên cạnh để tới nói chuyện
    if (npc.seated) {
      assert.ok(map.info(npc.x, npc.y).sofa, `${npc.name}: ngồi nhưng không phải trên sofa`);
      assert.ok([[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => !map.isSolid(npc.x + dx, npc.y + dy)), `${npc.name}: không có chỗ đứng nói chuyện`);
    } else if (npc.swim) {
      // Kình ngư bơi dưới nước: đứng trên ô nước, tầm nhìn toàn mặt nước
      assert.equal(map.tileAt(npc.x, npc.y), 'w', `${npc.name}: bơi nhưng không ở dưới nước`);
    } else assert.ok(!map.isSolid(npc.x, npc.y), `${npc.name} đứng trên ô cản`);
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
  for (const t of [...TRAINERS, ...STORY_NPCS.filter((n) => n.team)]) {
    assert.ok(t.team.length > 0);
    for (const [id, level] of t.team) {
      assert.ok(SPECIES[id], `${t.name}: chưa có ${id}`);
      assert.ok(createMonster(id, level).moves.length > 0);
    }
  }
});

test('cửa hàng bán đúng vật phẩm, trừ tiền khi mua', () => {
  for (const id of MART_TIERS.flat()) assert.ok(ITEMS[id]?.price > 0, id);
  assert.equal(new Set(MART_TIERS.flat()).size, MART_TIERS.flat().length, 'mỗi món chỉ thuộc một bậc');
  assert.ok(!martStock(0).includes('ultraBall'), 'đầu game chưa bán Ultra Ball');
  assert.ok(!martStock(0).includes('superPotion'), 'đầu game chưa bán Super Potion');
  assert.ok(martStock(0).includes('ball') && martStock(0).includes('potion') && martStock(0).includes('antidote'));
  assert.ok(martStock(2).includes('ultraBall') && martStock(2).includes('ball'), 'bậc cao gồm cả hàng bậc thấp');
  state.money = 1000;
  state.bag = {};
  assert.equal(buy('ball', 3, ITEMS.ball.price), true);
  assert.equal(state.money, 400);
  assert.equal(itemCount('ball'), 3);
  assert.equal(buy('ultraBall', 1, ITEMS.ultraBall.price), false, 'không đủ tiền thì không mua được');
  assert.equal(state.money, 400);
});

test('cốt truyện: mục tiêu đổi theo từng mốc', () => {
  resetState();
  assert.equal(objective(), 'Xuống tầng 1 nói chuyện với mẹ');
  assert.equal(objective('home'), 'Nói chuyện với mẹ');
  assert.equal(objective('route1'), 'Về nhà nói chuyện với mẹ');
  setFlag(F.MOM);
  assert.equal(objective(), 'Đi về phía bắc thị trấn tìm giáo sư');
  setFlag(F.MET_OAK);
  assert.equal(objective(), 'Chọn Pokémon ở phòng thí nghiệm');
  setFlag(F.STARTER);
  setFlag('starter:charmander');
  markCaught('charmander');
  assert.equal(questProgress(), 0, 'Pokémon khởi đầu không tính vào nhiệm vụ');
  assert.equal(objective(), 'Bắt Pokémon hoang dã đầu tiên');
  markCaught('rattata');
  assert.equal(objective(), 'Quay lại báo cho Giáo sư Oak', 'bắt được một con là xong');
  setFlag(F.QUEST_DONE);
  assert.equal(objective(), 'Đi theo Tuyến đường 2 tới Thị trấn Lục Bình');
  state.visited.add('town1');
  assert.equal(objective(), 'Đến Poké Mart Lục Bình xem có chuyện gì');
  for (const f of [F.GRUNTS, F.BOSS, F.MART_REWARD]) setFlag(f);
  assert.equal(objective(), 'Lên đường tới Hang Thạch Nhũ phía bắc Lục Bình', 'Gary đợi đấu lại trước khi lên đường');
  setFlag(F.RIVAL2);
  setFlag(F.DONE);
  assert.equal(objective(), 'Từ Thị trấn Lục Bình băng qua Hang Thạch Nhũ tới Làng Chân Đồi', 'xong chương 1 thì sang nhiệm vụ chương 2');
  // Tới làng trước thành phố: làm nhiệm vụ của làng thì đường vào thành phố mới mở
  state.visited.add('village1');
  assert.equal(objective(), 'Làng Chân Đồi: tìm hiểu vì sao đường lên dốc bị đóng');
  setFlag('quest:v1');
  assert.equal(objective(), 'Tìm bé Tí trong Rừng Thông sau Làng Chân Đồi');
  setFlag('village:v1:found');
  assert.equal(objective(), 'Đưa bé Tí về với mẹ ở Làng Chân Đồi');
  setFlag('village:v1');
  assert.equal(objective(), 'Vào Thành phố Đồi Gió');
  state.visited.add('town2');
  assert.equal(objective(), 'Thách đấu Gym Đồi Gió');
  state.badges.add('wind');
  assert.equal(objective(), 'Đi theo Tuyến đường 4 tới Xóm Cối Xay', 'có huy hiệu thì đi tiếp tới gym sau');
  for (const [place, badge] of [['town3', 'grass'], ['town4', 'electric'], ['town5', 'water']]) {
    state.visited.add(place);
    state.badges.add(badge);
  }
  assert.equal(objective(), 'Từ Sông Nước đi Tuyến đường 7 về phía tây tới Làng Đất Sét');
  state.visited.add('village5');
  assert.equal(objective(), 'Làng Đất Sét: hỏi trưởng làng vì sao xe đất chắn đường');
  // Bản lưu cũ đã tới thành phố trước khi có làng: coi như xong nhiệm vụ của làng
  state.visited.add('town6');
  assert.equal(objective(), 'Đánh đuổi Team Rocket trước Poké Mart Lò Gốm');
  for (const [place, badge] of [['town6', 'fire'], ['town7', 'rock'], ['town8', 'psychic'], ['town9', 'ice']]) {
    state.visited.add(place);
    state.badges.add(badge);
  }
  assert.equal(objective(), 'Vượt Đường Chiến Thắng, lên Cao nguyên Liên Minh');
  state.visited.add('league');
  assert.equal(objective(), 'Thách đấu Tứ Thiên Vương (0/4)');
  for (const n of [1, 2, 3, 4]) state.flags.add(`league:e${n}`);
  assert.equal(objective(), 'Thách đấu Nhà vô địch');
  state.flags.add('champion');
  assert.equal(objective(), 'Về nhà ở Pallet báo tin cho mẹ', 'vô địch xong về nhà gặp mẹ');
  state.flags.add('postgame:mom');
  assert.equal(objective(), 'Sang phòng thí nghiệm cho Giáo sư Oak xem Pokédex');
  state.flags.add('postgame:oak');
  assert.match(objective(), /^Huyền thoại \(0\/5\): tìm Zapdos/);
});

test('lưu game rồi tải lại giữ nguyên tiến độ', () => {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  resetState();
  state.party = [createMonster('squirtle', 7)];
  state.money = 1234;
  state.bag = { ball: 4 };
  setFlag(F.STARTER);
  markCaught('squirtle');
  state.defeatedTrainers.add('youngster');
  assert.equal(saveGame({ map: 'lab', x: 6, y: 9, facing: 'up' }), true);

  resetState();
  assert.equal(state.party.length, 0);
  const pos = loadGame();
  assert.deepEqual(pos, { map: 'lab', x: 6, y: 9, facing: 'up' });
  assert.equal(state.party[0].name, 'Squirtle');
  assert.equal(state.money, 1234);
  assert.equal(itemCount('ball'), 4);
  assert.ok(state.flags.has(F.STARTER));
  assert.ok(state.dex.caught.has(DEX_BY_SLUG.squirtle.id));
  assert.ok(state.defeatedTrainers.has('youngster'));
  assert.ok(createMonster('pidgey', 3).uid > state.party[0].uid, 'uid mới không trùng uid cũ');
  deleteSave();
  assert.equal(hasSave(), false);
});

test('bóng Pikachu chỉ mở khi đã từ chối cả 3 Pokémon khởi đầu', () => {
  resetState();
  const lab = MAPS.lab;
  const pikachuBall = lab.objects.find((o) => o.species === 'pikachu');
  assert.ok(pikachuBall, 'phòng thí nghiệm có bóng Pikachu');
  assert.ok(lab.info(pikachuBall.x, pikachuBall.y).counter, 'bóng Pikachu nằm trên bàn');
  assert.ok(!lab.isSolid(pikachuBall.x, pikachuBall.y + 1), 'đứng được trước bóng Pikachu');
  assert.equal(declinedAllStarters(), false);
  setFlag('declined:bulbasaur');
  setFlag('declined:charmander');
  assert.equal(declinedAllStarters(), false);
  setFlag('declined:squirtle');
  assert.equal(declinedAllStarters(), true);
});

test('vật phẩm trên bản đồ: nằm ở ô đi được, nhặt rồi thì biến mất', () => {
  resetState();
  // Vật phẩm thường (gói hàng của Poké Mart chỉ có trong một đoạn cốt truyện, xem test Team Rocket)
  const items = route.objects.filter((o) => o.kind === 'item' && !o.after);
  assert.ok(items.length > 0);
  assert.equal(new Set(items.map((o) => o.id)).size, items.length);
  for (const o of items) {
    assert.ok(ITEMS[o.item], o.item);
    // Nằm trên đất, trong bụi cỏ hoặc trên mặt nước (lướt nước tới nhặt)
    assert.ok(!route.isSolid(o.x, o.y) || route.tileAt(o.x, o.y) === 'w', `${o.id} nằm sai chỗ`);
    assert.equal(objectVisible(o), true);
  }
  setFlag(`item:${items[0].id}`);
  assert.equal(objectVisible(items[0]), false);
  assert.equal(objectVisible(items[1]), true);
});

test('Thunder / Hurricane luôn trúng khi mưa, 50% khi nắng; Blizzard luôn trúng khi mưa đá', async () => {
  const { moveHits } = await import('../src/battle/formulas.js');
  const a = createMonster('pikachu', 30);
  const d = createMonster('pidgey', 30);
  assert.equal(moveHits(MOVES.thunder, a, d, fixed(0.99), { weather: 'rain' }), true);
  assert.equal(moveHits(MOVES.thunder, a, d, fixed(0.99)), false);
  assert.equal(moveHits(MOVES.hurricane, a, d, fixed(0.6), { weather: 'sun' }), false);
  assert.equal(moveHits(MOVES.hurricane, a, d, fixed(0.4), { weather: 'sun' }), true);
  assert.equal(moveHits(MOVES.blizzard, a, d, fixed(0.99), { weather: 'hail' }), true);
  assert.equal(moveHits(MOVES.thunder, a, d, fixed(0.99), { weather: 'rain', cloudNine: true }), false, 'Cloud Nine: như trời quang');
});

test('sát thương cố định: Dragon Rage 40, Sonic Boom 20, Seismic Toss / Night Shade bằng cấp; hệ miễn nhiễm vẫn không trúng', () => {
  const user = createMonster('dratini', 30);
  const target = createMonster('snorlax', 50);
  assert.deepEqual(calcDamage(user, target, MOVES.dragonRage, fixed(0)), { damage: 40, effectiveness: 1, crit: false, absorbedBy: null });
  assert.equal(calcDamage(user, target, MOVES.sonicBoom, fixed(0.5)).damage, 20);
  assert.equal(calcDamage(user, target, MOVES.seismicToss, fixed(0.5)).damage, 30);
  assert.equal(calcDamage(user, target, MOVES.nightShade, fixed(0.5)).damage, 0, 'Night Shade không trúng hệ Thường');
  assert.equal(calcDamage(user, createMonster('gastly', 30), MOVES.seismicToss, fixed(0.5)).damage, 0, 'Seismic Toss không trúng hệ Ma');
});

test('đường cong EXP theo nhóm tăng trưởng của loài (Gen 3+), bản lưu cũ đổi sang mà giữ cấp và phần trăm thanh EXP', async () => {
  const { syncExpCurve } = await import('../src/game/monster.js');
  // Giá trị chuẩn ở cấp 50 / 100 của từng nhóm
  assert.equal(expForLevel(100, 'Fast'), 800000);
  assert.equal(expForLevel(100, 'Medium Fast'), 1000000);
  assert.equal(expForLevel(100, 'Medium Slow'), 1059860);
  assert.equal(expForLevel(100, 'Slow'), 1250000);
  assert.equal(expForLevel(50, 'Medium Slow'), 117360);
  assert.equal(expForLevel(1, 'Medium Slow'), 0);
  for (const rate of ['Fast', 'Medium Fast', 'Medium Slow', 'Slow']) {
    for (let n = 1; n < 100; n++) assert.ok(expForLevel(n + 1, rate) > expForLevel(n, rate), `${rate} ${n}`);
  }
  const char = createMonster('charmander', 10); // Medium Slow
  assert.equal(char.exp, expForLevel(10, 'Medium Slow'));
  const snorlax = createMonster('snorlax', 30); // Slow
  assert.equal(snorlax.exp, 33750);
  // Bản lưu cũ: Charmander cấp 10, nửa thanh EXP theo cấp³
  const old = createMonster('charmander', 10);
  delete old.expRate;
  old.exp = 1000 + Math.floor((1331 - 1000) / 2);
  syncExpCurve(old);
  assert.equal(old.level, 10);
  assert.ok(Math.abs(expProgress(old) - 0.5) < 0.01, `giữ nửa thanh: ${expProgress(old)}`);
  assert.equal(old.expRate, 'Medium Slow');
});
