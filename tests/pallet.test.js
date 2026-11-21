import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS, encountersAt } from '../src/data/encounters.js';
import { BERRY_IDS, ITEMS } from '../src/data/items.js';
import { HEAL_RESPAWN, HOME_RESPAWN, MAPS, resumePosition } from '../src/data/map.js';
import { SPECIES } from '../src/data/monsters.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { PLACES } from '../src/data/region.js';
import { PHASES } from '../src/game/clock.js';
import { hasFlag, markCaught, resetState, setFlag, state } from '../src/game/state.js';
import { F, STORY_NPCS, clerkTalk, objective, stepBlocker, stepTrigger } from '../src/story/chapter1.js';
import { GYMS } from '../src/story/chapter2.js';
import { RIVAL_EVENTS, RIVAL_ORDER, RIVAL_TEAMS, rivalTrigger } from '../src/story/rival.js';

const pallet = MAPS.route1;
const town1 = MAPS.town1;
const peopleOn = (mapId) => [...NPCS, ...TRAINERS, ...STORY_NPCS].filter((n) => n.map === mapId);

// Thế giới giả để chạy sự kiện cốt truyện ngoài trình duyệt; result: kết quả trận đấu
function fakeWorld(mapId, pos, result = 'win') {
  const log = { said: [], battles: [], chapterEnd: 0, items: [], leaves: [] };
  const npc = (d) => ({ ...d, def: d, pos: { x: d.x, y: d.y } });
  return {
    log,
    map: MAPS[mapId],
    pos: { ...pos },
    say: async (who, lines) => log.said.push([who, ...lines]),
    ask: async () => true,
    giveItem: async (item, qty = 1) => log.items.push([item, qty]),
    startBattle: async (data) => (log.battles.push(data), result),
    spawnNpc: (d) => npc(d),
    findNpc: (id) => { const d = STORY_NPCS.find((n) => n.id === id); return d ? npc(d) : null; },
    openDoor: async () => ({}),
    closeDoor: async () => {},
    walkNpc: async () => {},
    walkNpcTo: async () => {},
    walkNpcAway: async () => {},
    npcEntersDoor: async () => {},
    npcLeave: async (npc, where) => log.leaves?.push(where),
    npcFlyAway: async () => {},
    removeNpc: () => {},
    faceNpcToPlayer: () => {},
    facePlayerTo: () => {},
    showChapterEnd: async () => { log.chapterEnd++; },
  };
}

// Ô đi tới được từ start mà không bước vào bụi cỏ
function walkable(map, start, avoidGrass = true) {
  const seen = new Set();
  const queue = [start];
  while (queue.length) {
    const p = queue.shift();
    const key = `${p.x},${p.y}`;
    if (seen.has(key) || p.x < 0 || p.y < 0 || p.x >= map.width || p.y >= map.height) continue;
    if (map.isSolid(p.x, p.y) || (avoidGrass && map.info(p.x, p.y).encounter)) continue;
    seen.add(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ x: p.x + dx, y: p.y + dy });
  }
  return seen;
}

test('Pallet: đúng 4 ngôi nhà (nhà bạn, nhà Gary, nhà hàng xóm, phòng thí nghiệm), vào được cả 4', () => {
  assert.deepEqual(pallet.buildings.map((b) => b.to).sort(), ['garyHome', 'home', 'lab', 'palletHouse']);
  for (const b of pallet.buildings) {
    const inside = MAPS[b.to];
    assert.ok(inside?.indoor, b.to);
    assert.ok(!inside.heal, `${b.to}: Pallet không có Pokémon Center`);
    assert.deepEqual(inside.exit, { to: 'route1', x: b.door.x, y: b.door.y + 1 });
  }
  assert.ok(!pallet.buildings.some((b) => ['center', 'mart'].includes(b.type)));
  assert.ok(peopleOn('garyHome').some((n) => n.id === 'daisy'), 'nhà Gary có chị Đào');
  assert.ok(peopleOn('palletHouse').length >= 1, 'nhà hàng xóm có người');
  assert.ok(pallet.width <= 30 && pallet.height <= 24, 'thị trấn gọn, không rộng thừa');
});

test('Pallet: hồi phục duy nhất ở nhà (mẹ), Pokémon Center / Poké Mart ở Thị trấn Lục Bình', () => {
  assert.equal(HOME_RESPAWN.map, 'home');
  assert.ok(STORY_NPCS.some((n) => n.id === 'mom' && n.map === 'home'));
  assert.ok(!peopleOn('route1').some((n) => n.role === 'nurse'));
  assert.equal(MAPS.center.exit.to, 'town1');
  assert.equal(MAPS.mart.exit.to, 'town1');
  assert.equal(MAPS[HEAL_RESPAWN.map].exit.to, 'town1');
  assert.ok(!peopleOn('route1').some((n) => n.id.startsWith('rocket-')), 'Team Rocket không còn ở Pallet');
  assert.ok(PLACES.some((p) => p.id === 'town1' && p.kind === 'town'));
});

test('Pallet: bụi cỏ duy nhất và lối ra ở phía bắc, hồ nước và dòng sông ở phía nam', () => {
  assert.equal(pallet.areas.length, 1);
  const [x1, y1, x2, y2] = pallet.areas[0].rect;
  for (let y = 0; y < pallet.height; y++) {
    for (let x = 0; x < pallet.width; x++) {
      const inGrass = x >= x1 && x <= x2 && y >= y1 && y <= y2;
      assert.equal(Boolean(pallet.info(x, y).encounter), inGrass, `(${x},${y})`);
    }
  }
  const exits = pallet.warps.filter((w) => w.to === 'route2');
  const river = pallet.warps.filter((w) => w.to === 'river1');
  assert.ok(exits.length && exits.every((w) => w.y === 0), 'lối ra Tuyến đường 2 ở mép bắc');
  assert.ok(river.length && river.every((w) => w.y === pallet.height - 1), 'dòng sông chảy ra mép nam');
  const water = pallet.rows.flatMap((r, y) => [...r].flatMap((c) => (c === 'w' ? [y] : [])));
  assert.ok(Math.min(...water) > y2 && Math.min(...water) > pallet.height / 2, 'hồ nằm ở nửa phía nam');
  assert.ok(y2 < pallet.height / 2, 'bụi cỏ nằm ở nửa phía bắc');
  // Từ trong thị trấn ra lối phía bắc đều phải đi qua bụi cỏ
  const home = pallet.buildings.find((b) => b.to === 'home').door;
  const reach = walkable(pallet, { x: home.x, y: home.y + 1 });
  assert.ok(!exits.some((w) => reach.has(`${w.x},${w.y}`)), 'đi vòng được, không cần qua bụi cỏ');
  assert.ok(exits.some((w) => walkable(pallet, { x: home.x, y: home.y + 1 }, false).has(`${w.x},${w.y}`)), 'đi qua bụi cỏ thì tới lối ra');
  for (const phase of PHASES) assert.ok(encountersAt(pallet.areas[0].table, phase).length >= 2, phase);
});

test('Pallet: 2-3 vật phẩm, không có cây quả mọng', () => {
  const items = pallet.objects.filter((o) => o.kind === 'item');
  assert.ok(items.length >= 2 && items.length <= 3, `${items.length} vật phẩm`);
  assert.ok(!pallet.objects.some((o) => o.kind === 'berry'));
});

test('nhiệm vụ của Giáo sư Oak: bắt Pokémon đầu tiên (không tính Pokémon khởi đầu)', () => {
  resetState();
  for (const f of [F.MOM, F.MET_OAK, F.STARTER, F.RIVAL1, F.DEX]) setFlag(f);
  setFlag('starter:bulbasaur');
  markCaught('bulbasaur');
  assert.equal(objective(), 'Bắt Pokémon hoang dã đầu tiên');
  markCaught('magikarp');
  assert.equal(objective(), 'Quay lại báo cho Giáo sư Oak');
});

test('Sông Lục Bình: hồ phía nam Pallet thông ra sông, sông chảy tới ao Lục Bình, chỉ lướt nước mới đi được', () => {
  const river = MAPS.river1;
  const links = [...pallet.warps, ...town1.warps].filter((w) => w.to === 'river1').concat(river.warps);
  assert.ok(river.warps.some((w) => w.to === 'route1') && river.warps.some((w) => w.to === 'town1'));
  for (const w of links) {
    const from = [pallet, river, town1].find((m) => m.warps.includes(w));
    assert.equal(from.tileAt(w.x, w.y), 'w', `${from.id} (${w.x},${w.y}): lối sang sông phải là mặt nước`);
    assert.equal(MAPS[w.to].tileAt(w.tx, w.ty), 'w', `${w.to} (${w.tx},${w.ty}): chỗ đến phải là mặt nước`);
  }
  // Ao Lục Bình ở nửa phía nam thị trấn
  assert.ok(town1.warps.filter((w) => w.to === 'river1').every((w) => w.y >= town1.height / 2));
  // Viền sông chỉ là cây hoặc ô nước nối bản đồ: không có lối đi bộ vào
  for (let y = 0; y < river.height; y++) {
    for (let x = 0; x < river.width; x++) {
      if (x > 0 && y > 0 && x < river.width - 1 && y < river.height - 1) continue;
      const t = river.tileAt(x, y);
      assert.ok(t === 'T' || (t === 'w' && river.warpAt(x, y)), `(${x},${y}): ${t}`);
    }
  }
  assert.ok(river.objects.filter((o) => o.kind === 'item').length >= 3, 'có đồ để quay lại khám phá');
  assert.ok(PLACES.some((p) => p.id === 'river1' && p.water));
});

test('cổng Pallet: chưa xong nhiệm vụ của Oak thì chưa ra được, xong thì đi thẳng (Gary không chặn ở Pallet)', () => {
  resetState();
  const exit = pallet.warps.find((w) => w.to === 'route2');
  const world = fakeWorld('route1', { x: exit.x, y: exit.y + 1 });
  assert.equal(typeof stepBlocker(world, exit.x, exit.y), 'function', 'chưa xong nhiệm vụ thì chặn');
  for (const f of [F.MOM, F.MET_OAK, F.STARTER, F.RIVAL1, F.DEX, F.QUEST_DONE]) setFlag(f);
  // Sắp bước sang tuyến đường đầu tiên: mẹ gọi lại tặng quà (một lần), xong thì lối ra mở
  assert.equal(typeof stepBlocker(world, exit.x, exit.y), 'function', 'chưa nhận quà của mẹ thì mẹ gọi lại');
  setFlag(F.MOM_GIFT);
  assert.equal(stepBlocker(world, exit.x, exit.y), null, 'xong nhiệm vụ, nhận quà rồi thì mở lối ra');
  for (let y = 1; y < 6; y++) {
    world.pos = { x: exit.x, y };
    assert.equal(stepTrigger(world), null, 'Gary không chặn ở Pallet nữa');
  }
});

test('Thị trấn Lục Bình: trả gói hàng xong, lên đường tới Hang Thạch Nhũ thì Gary đấu lại (Lv 8), thắng là hết chương 1', async () => {
  resetState();
  setFlag('rivalStarter:squirtle');
  const cave = town1.warps.find((w) => w.to === 'cave1');
  const front = { x: cave.x, y: cave.y + 1 };
  const world = fakeWorld('town1', front);
  assert.equal(typeof stepBlocker(world, cave.x, cave.y), 'function', 'chưa xong chương 1 thì chưa vào hang');
  for (const f of [F.STARTER, F.QUEST_DONE, F.GRUNTS, F.BOSS]) setFlag(f);
  assert.equal(stepTrigger(world), null, 'chưa trả gói hàng thì Gary chưa ra');
  assert.equal(await clerkTalk(world), true);
  assert.ok(hasFlag(F.MART_REWARD) && !hasFlag(F.DONE), 'trả gói hàng xong vẫn còn trận với Gary');
  assert.equal(world.log.chapterEnd, 0);
  // Tới gần cửa hang: nhân viên Poké Mart đang chặn cửa hang cảm ơn rồi về cửa hàng (chưa có trận nào)
  const thanks = stepTrigger(world);
  assert.equal(typeof thanks, 'function');
  await thanks();
  assert.ok(hasFlag(F.CLERK_BACK) && !hasFlag(F.RIVAL2), 'nhân viên về cửa hàng');
  assert.equal(world.log.battles.length, 0);
  assert.ok(!STORY_NPCS.find((n) => n.id === 't1-clerk').show(), 'không còn chặn cửa hang');
  // Mọi lối tới cửa hang đều đi qua chỗ Gary chặn
  const event = stepTrigger(world);
  assert.equal(typeof event, 'function');
  await event();
  const team = world.log.battles[0].trainer.team;
  assert.deepEqual(team.map(([, lv]) => lv), [8, 8], 'Pokémon của Gary Lv 8');
  assert.equal(team.at(-1)[0], 'squirtle');
  assert.ok(hasFlag(F.RIVAL2) && hasFlag(F.DONE));
  assert.equal(world.log.chapterEnd, 0, 'không còn màn tổng kết chương');
  assert.equal(stepTrigger(world), null, 'thắng rồi thì không chặn nữa');
  assert.equal(stepBlocker(world, cave.x, cave.y), null, 'cửa hang mở');

  // Thua thì lần sau tới cửa hang lại gặp
  resetState();
  for (const f of [F.STARTER, F.QUEST_DONE, F.GRUNTS, F.BOSS, F.MART_REWARD, F.CLERK_BACK]) setFlag(f);
  const lose = fakeWorld('town1', front, 'lose');
  await stepTrigger(lose)();
  assert.ok(!hasFlag(F.RIVAL2) && !hasFlag(F.DONE));
  assert.equal(typeof stepTrigger(lose), 'function');
});

test('Thị trấn Lục Bình: không đi vòng tới cửa hang mà tránh được chỗ Gary chặn', () => {
  const cave = town1.warps.find((w) => w.to === 'cave1');
  const world = fakeWorld('town1', { x: 0, y: 0 });
  resetState();
  for (const f of [F.STARTER, F.QUEST_DONE, F.GRUNTS, F.BOSS, F.MART_REWARD]) setFlag(f);
  // Các ô sát cửa hang (đứng đó mới bước vào hang được) đều nằm trong vùng Gary chặn
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0]]) {
    const x = cave.x + dx;
    const y = cave.y + dy;
    if (town1.isSolid(x, y)) continue;
    world.pos = { x, y };
    assert.equal(typeof stepTrigger(world), 'function', `(${x},${y})`);
  }
});

test('bản lưu cũ: đã đấu Gary ở Pallet cũ thì trả gói hàng là hết chương 1; chỗ đứng cũ ngoài bản đồ được dời vào trong', async () => {
  resetState();
  for (const f of [F.STARTER, F.QUEST_DONE, F.RIVAL2, F.GRUNTS, F.BOSS]) setFlag(f);
  const world = fakeWorld('town1', { x: 20, y: 8 });
  await clerkTalk(world);
  assert.ok(hasFlag(F.DONE));
  assert.equal(world.log.chapterEnd, 0, 'không còn màn tổng kết chương');
  // Pallet cũ rộng 40 ô: chỗ đứng (35, 21) giờ là cây / ngoài bản đồ
  const moved = resumePosition({ map: 'route1', x: 35, y: 21, facing: 'down' });
  assert.ok(!pallet.isSolid(moved.x, moved.y));
  assert.ok(moved.x < pallet.width && moved.y < pallet.height);
  const swim = { map: 'route1', x: 12, y: 19, facing: 'up', vehicle: 'surf' };
  assert.deepEqual(resumePosition(swim), swim, 'đang lướt nước trên hồ thì giữ nguyên');
});

test('Gary: đội hình mạnh dần qua từng lần gặp, Pokémon khởi đầu tiến hoá theo hành trình', () => {
  for (const [starter, line] of [['bulbasaur', ['bulbasaur', 'ivysaur', 'venusaur']], ['charmander', ['charmander', 'charmeleon', 'charizard']], ['squirtle', ['squirtle', 'wartortle', 'blastoise']]]) {
    resetState();
    setFlag(`rivalStarter:${starter}`);
    let prevMax = 0;
    let prevSize = 0;
    let prevStage = 0;
    for (const id of RIVAL_ORDER) {
      const team = RIVAL_TEAMS[id]();
      const max = Math.max(...team.map(([, lv]) => lv));
      assert.ok(max > prevMax, `${id}: cấp phải cao hơn lần trước`);
      assert.ok(team.length >= prevSize, `${id}: đội hình không được ít đi`);
      for (const [s, lv] of team) assert.ok(SPECIES[s] && lv > 0, `${id}: ${s}`);
      const ace = team.at(-1);
      const stage = line.indexOf(ace[0]);
      assert.ok(stage >= prevStage, `${id}: Pokémon khởi đầu của Gary không thoái hoá`);
      assert.equal(ace[1], max, `${id}: Pokémon khởi đầu là con mạnh nhất`);
      // Tiến hoá đúng cấp: dạng giữa từ Lv 16, dạng cuối từ Lv 32-36
      if (stage === 1) assert.ok(ace[1] >= 16);
      if (stage === 2) assert.ok(ace[1] >= 32);
      [prevMax, prevSize, prevStage] = [max, team.length, stage];
    }
  }
  assert.equal(Math.max(...RIVAL_TEAMS.town1().map(([, lv]) => lv)), 8);
});

test('Gary ở các thành phố: đứng cạnh lối ra, xuất hiện sau khi có huy hiệu của thành phố, thắng thì đi', async () => {
  const cities = RIVAL_EVENTS.map((ev) => ev.map);
  assert.deepEqual(cities, ['town2', 'town5', 'town9']);
  for (const ev of RIVAL_EVENTS) {
    const m = MAPS[ev.map];
    const gym = GYMS.find((g) => g.place === ev.map);
    assert.ok(gym, `${ev.map}: thành phố có gym`);
    assert.ok(!m.isSolid(ev.x, ev.y) && !m.warpAt(ev.x, ev.y), `${ev.id}: chỗ Gary đứng`);
    const [x1, y1, x2, y2] = ev.zone;
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) assert.ok(!m.isSolid(x, y), `${ev.id}: (${x},${y})`);
    const gate = m.gates.find((g) => g.badge === gym.badge);
    assert.ok(gate, `${ev.map}: lối ra có cổng huy hiệu`);
    const near = Math.min(Math.abs(gate.rect[0] - x2), Math.abs(gate.rect[2] - x1));
    assert.ok(near <= 2, `${ev.id}: chỗ Gary chặn phải sát lối ra`);
    assert.ok(!peopleOn(ev.map).some((n) => n.id !== `gary-${ev.id}` && n.x === ev.x && n.y === ev.y), `${ev.id}: chồng lên NPC khác`);

    resetState();
    setFlag('rivalStarter:charmander');
    const npc = STORY_NPCS.find((n) => n.id === `gary-${ev.id}`);
    assert.equal(npc.show(), false, 'chưa có huy hiệu thì chưa xuất hiện');
    state.badges.add(gym.badge);
    assert.equal(npc.show(), true);
    const world = fakeWorld(ev.map, { x: x1, y: y1 });
    const event = rivalTrigger(world);
    assert.equal(typeof event, 'function');
    await event();
    assert.equal(world.log.battles[0].trainer.team.length, RIVAL_TEAMS[ev.id]().length);
    assert.equal(npc.show(), false, 'thắng rồi thì Gary đi trước');
    const to = world.log.leaves.at(-1)?.toMap;
    assert.ok(m.warps.some((w) => w.to === to), `${ev.id}: Gary đi ra lối sang bản đồ khác (${to}), không biến mất giữa đường`);
    assert.equal(rivalTrigger(world), null);
  }
});

test('Gary ở thành phố: thua thì Gary vẫn đợi, lần sau nói câu khác', async () => {
  resetState();
  state.badges.add('wind');
  const world = fakeWorld('town2', { x: 27, y: 10 }, 'lose');
  await rivalTrigger(world)();
  assert.equal(typeof rivalTrigger(world), 'function');
  const first = world.log.said[0];
  await rivalTrigger(world)();
  assert.notDeepEqual(world.log.said.at(-1), first);
  state.badges.add('grass');
  assert.equal(rivalTrigger(world), null, 'qua giai đoạn đó rồi (bản lưu cũ) thì thôi');
});

test('Tuyến đường 2 (tuyến làm quen): 2 nhà huấn luyện, mọi Pokémon tối đa Lv 7; vào từ lối phía bắc Pallet, sang Lục Bình', () => {
  const trainers = TRAINERS.filter((t) => t.map === 'route2');
  assert.equal(trainers.length, 2);
  for (const t of trainers) assert.ok(Math.max(...t.team.map(([, lv]) => lv)) <= 7, t.id);
  for (const id of ['route2-grass', 'route2-deep']) for (const e of ENCOUNTERS[id]) assert.ok(e.max <= 7, `${id} ${e.species}`);
  const back = MAPS.route2.warps.filter((w) => w.to === 'route1');
  assert.ok(back.length && back.every((w) => w.y === MAPS.route2.height - 1), 'từ Pallet đi lên vào mép nam Tuyến đường 2');
  assert.ok(MAPS.route2.warps.some((w) => w.to === 'town1'));
  assert.ok(!MAPS.route2.warps.some((w) => w.to === 'cave1'));
  assert.equal(MAPS.cave1.warps.find((w) => w.to !== 'route3').to, 'town1');
});

// ---------- Cây quả mọng ----------

const treesOf = (m) => m.objects.filter((o) => o.kind === 'berry');
// Gom cây thành từng dãy: cây liền nhau trên cùng một hàng
function rowsOf(m) {
  const rows = [];
  for (const t of [...treesOf(m)].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = rows.at(-1);
    if (last && last.at(-1).y === t.y && last.at(-1).x === t.x - 1) last.push(t);
    else rows.push([t]);
  }
  return rows;
}

test('cây quả mọng: trồng thành dãy 2-3 cây liền nhau trên một luống, rải đều dọc hành trình', () => {
  const maps = Object.values(MAPS).filter((m) => treesOf(m).length);
  assert.ok(maps.length >= 15, `chỉ có ${maps.length} bản đồ có cây`);
  for (const m of maps) {
    if (m.id === 'town6' || m.id === 'safariEffort') continue; // vườn quả Lò Gốm, luống quả khu Safari Effort: kiểm tra riêng
    const rows = rowsOf(m);
    assert.ok(rows.length >= 1 && rows.length <= 2, `${m.id}: ${rows.length} dãy`);
    for (const row of rows) assert.ok(row.length >= 2 && row.length <= 3, `${m.id}: dãy ${row.length} cây ở (${row[0].x},${row[0].y})`);
  }
  // Có cây từ tuyến đường đầu tiên tới thành phố cuối cùng
  for (const id of ['route2', 'town2', 'town4', 'town7', 'town9']) assert.ok(treesOf(MAPS[id]).length, id);
  // Cây không chắn đường: ô bên dưới hoặc bên trên cả dãy đều đi được để đứng hái
  for (const m of maps) {
    for (const row of rowsOf(m)) {
      const stand = (dy) => row.every((t) => !m.isSolid(t.x, t.y + dy) && m.tileAt(t.x, t.y + dy) !== 'w');
      assert.ok(stand(1) || stand(-1), `${m.id} (${row[0].x},${row[0].y}): không có chỗ đứng hái`);
      // Không trồng ngay trên hàng cây viền: tán cây thông cao 3 ô che mất cây quả mọng
      assert.ok(row.every((t) => m.tileAt(t.x, t.y + 1) !== 'T'), `${m.id} (${row[0].x},${row[0].y}): bị cây viền che`);
      // Không sát biển báo: tán cây che biển và chắn chỗ đứng đọc biển
      const nearSign = row.some((t) => [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => m.tileAt(t.x + dx, t.y + dy) === 's'));
      assert.ok(!nearSign, `${m.id} (${row[0].x},${row[0].y}): sát biển báo`);
    }
  }
});

test('vườn quả mọng Thành phố Lò Gốm: đủ mọi loại quả, mỗi loại quả giảm EV 2 cây, dãy 3 cây có lối đi giữa các dãy', () => {
  const garden = MAPS.town6;
  const trees = treesOf(garden);
  assert.ok(trees.length >= 20, `${trees.length} cây`);
  assert.deepEqual([...new Set(trees.map((t) => t.berry))].sort(), [...BERRY_IDS].sort());
  for (const id of BERRY_IDS.filter((b) => ITEMS[b].kind === 'ev')) {
    assert.ok(trees.filter((t) => t.berry === id).length >= 2, `${id}: ít hơn 2 cây`);
  }
  for (const row of rowsOf(garden)) assert.equal(row.length, 3);
  assert.ok(garden.signs['14,19'], 'có biển báo vườn quả');
  // Vườn nằm giữa / cuối hành trình (thành phố của gym thứ 5)
  assert.equal(GYMS.findIndex((g) => g.place === 'town6'), 4);
});

test('Lục Bình: nhà dân góc tây bắc, Pokémon Center / Poké Mart phía nam đường chính cạnh ao, gò đất 2 tầng viền gờ chữ L trước cửa hang', () => {
  const town = MAPS.town1;
  const center = town.buildings.find((b) => b.to === 'center');
  const mart = town.buildings.find((b) => b.to === 'mart');
  assert.ok(center.x + center.w <= mart.x, 'Center rồi Mart, cạnh nhau');
  for (const b of [center, mart]) {
    assert.ok(b.y >= 10, `${b.to} ở phía nam đường chính`);
    assert.equal(town.isSolid(b.door.x, b.door.y + 1), false, `trước cửa ${b.to} đi được`);
  }
  // Hai nhà dân ở chỗ cũ của Center / Mart (góc tây bắc)
  assert.equal(town.buildings.filter((b) => b.type === 'house' && b.y <= 3 && b.x <= 12).length, 2);
  // Biển tên đặt cạnh cửa, đọc được (ô trước biển đi được)
  for (const [key, lines] of Object.entries(town.signs)) {
    const [sx, sy] = key.split(',').map(Number);
    if (/POKé/.test(lines[0])) assert.equal(town.isSolid(sx, sy + 1), false, `${lines[0]}: trước biển bị chắn`);
  }
  const cells = (ch) => {
    const out = [];
    for (let y = 0; y < town.height; y++) for (let x = 0; x < town.width; x++) if (town.tileAt(x, y) === ch) out.push([x, y]);
    return out;
  };
  // Hai góc: chữ L (gờ dọc < phía trên, gờ ngang v bên phải) và chữ L ngược (gờ dọc > phía trên, gờ ngang v bên trái)
  const corners = cells('J');
  assert.equal(corners.length, 2);
  const outer = corners.find(([x, y]) => town.tileAt(x, y - 1) === '<' && town.tileAt(x + 1, y) === 'v');
  const inner = corners.find(([x, y]) => town.tileAt(x, y - 1) === '>' && town.tileAt(x - 1, y) === 'v');
  assert.ok(outer && inner, 'đủ chữ L và chữ L ngược');
  assert.ok(inner[0] > outer[0] && inner[1] < outer[1], 'chữ L ngược nằm trong gò');
  const dirs = { v: [0, 1, 'down'], '<': [-1, 0, 'left'], '>': [1, 0, 'right'] };
  for (const [ch, [dx, dy, ledge]] of Object.entries(dirs)) {
    const ledges = cells(ch);
    assert.ok(ledges.length >= 3, `gờ ${ch} đủ dài`);
    for (const [x, y] of ledges) {
      assert.equal(town.isSolid(x, y), true);
      assert.equal(town.info(x, y).ledge, ledge);
    }
    const landable = ledges.filter(([x, y]) => !town.isSolid(x + dx, y + dy));
    assert.ok(landable.length >= ledges.length - 1, `nhảy gờ ${ch} xuống được gần hết chiều dài`);
  }
  // Đi bộ (không nhảy gờ) từ đường lớn lên được cả 2 tầng: tầng trên có Repel và dãy 3 cây quả mọng
  const seen = new Set();
  const queue = [[3, 9]];
  while (queue.length) {
    const [x, y] = queue.pop();
    const key = `${x},${y}`;
    if (seen.has(key) || x < 0 || y < 0 || x >= town.width || y >= town.height || town.isSolid(x, y)) continue;
    if (town.objectAt(x, y)?.kind === 'berry') continue;
    seen.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const item = town.objects.find((o) => o.id === 't1-repel');
  const berries = town.objects.filter((o) => o.kind === 'berry');
  assert.equal(berries.length, 3, 'dãy 3 cây quả mọng dời từ Tuyến đường 2 sang');
  for (const o of [item, ...berries]) {
    assert.ok(o.x > outer[0] && o.x < inner[0] && o.y < inner[1], `${o.id} nằm trên tầng trên`);
  }
  assert.ok(seen.has(`${item.x},${item.y}`), 'đi bộ lên tầng trên được (vòng phía đông rồi qua khe phía tây)');
  assert.ok(berries.every((b) => seen.has(`${b.x},${b.y + 1}`) || seen.has(`${b.x},${b.y - 1}`)), 'đứng hái được');
  assert.ok(seen.has('27,6'), 'tới được cửa hang');
});

test('Lục Bình: nhân viên Poké Mart chặn cửa hang tới khi trả gói hàng, cảm ơn rồi về cửa hàng; hang ở trước Center / Mart', async () => {
  resetState();
  const clerk = STORY_NPCS.find((n) => n.id === 't1-clerk');
  const cave = town1.warps.find((w) => w.to === 'cave1');
  assert.deepEqual([clerk.map, clerk.x, clerk.y], ['town1', cave.x, cave.y + 1], 'đứng ngay trước cửa hang');
  // Từ lối vào (Tuyến đường 2, mép tây) đi tới cửa hang trước, Pokémon Center / Poké Mart ở khu phía đông
  const entry = town1.warps.find((w) => w.to === 'route2');
  for (const b of town1.buildings.filter((x) => x.to === 'center' || x.to === 'mart')) {
    assert.ok(b.door.x - entry.x > cave.x - entry.x, `${b.to} xa lối vào hơn cửa hang`);
  }
  for (const [flags, show] of [[[], true], [[F.GRUNTS], true], [[F.GRUNTS, F.BOSS], true], [[F.GRUNTS, F.BOSS, F.MART_REWARD], true]]) {
    resetState();
    for (const f of flags) setFlag(f);
    assert.equal(clerk.show(), show);
    const world = fakeWorld('town1', { x: cave.x - 1, y: cave.y + 1 });
    await clerk.onTalk.call(clerk, world);
    assert.equal(hasFlag(F.CLERK_BACK), flags.includes(F.MART_REWARD), `cờ: ${flags.join(',')}`);
  }
  assert.equal(clerk.show(), false, 'cảm ơn xong thì về cửa hàng');
});
