import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { hasFlag, resetState, setFlag } from '../src/game/state.js';
import { STORY_NPCS } from '../src/story/chapter1.js';
import { VILLAGE_NPCS, houseKnock, villageDone, villageGate, villageObjective } from '../src/story/villages.js';

// Khu phụ quanh làng 6-8 (data/mapsVillageAreasB.js): Mỏ Đá Vách Núi, Nghĩa Trang Rừng Trúc, Đèo Tuyết

const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const npc = (id) => VILLAGE_NPCS.find((n) => n.id === id);
const people = (mapId) => [...NPCS, ...TRAINERS, ...STORY_NPCS].filter((n) => n.map === mapId);

// BFS có tính nhảy gờ một chiều (bước vào ô gờ đúng chiều thì đáp xuống ô bên kia); block: ô coi như bị chặn thêm
function dist(m, sx, sy, block = new Set()) {
  const out = new Map([[`${sx},${sy}`, 0]]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const d = out.get(`${x},${y}`);
    for (const [dir, [dx, dy]] of Object.entries(D)) {
      let [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      if (m.info(nx, ny).ledge === dir) [nx, ny] = [nx + dx, ny + dy];
      else if (m.isSolid(nx, ny)) continue;
      const k = `${nx},${ny}`;
      if (m.isSolid(nx, ny) || block.has(k) || out.has(k)) continue;
      out.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }
  return out;
}
// Số bước ngắn nhất tới một ô cạnh (x, y) (chỗ đứng nói chuyện với NPC)
const reachNear = (d, x, y) => Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => d.get(`${x + dx},${y + dy}`) ?? Infinity));
// Ô vào khu phụ từ làng
const entryOf = (village, area) => {
  const w = MAPS[village].warps.find((ww) => ww.to === area);
  return [w.tx, w.ty];
};

const AREAS = [
  { id: 'quarry6', village: 'village6', name: 'Mỏ Đá Vách Núi' },
  { id: 'grave7', village: 'village7', name: 'Nghĩa Trang Rừng Trúc' },
  { id: 'pass8', village: 'village8', name: 'Đèo Tuyết' },
];

test('khu phụ làng 6-8: thuộc làng, nối hai chiều với làng, đi khắp được, có bảng Pokémon riêng, 2 nhà huấn luyện, NPC gợi ý', () => {
  for (const { id, village, name } of AREAS) {
    const m = MAPS[id];
    assert.equal(m.name, name);
    assert.equal(m.place, village, `${id}: phải thuộc ${village} trên bản đồ vùng`);
    assert.ok(m.width >= 34 && m.height >= 30, `${id}: quá nhỏ`);
    // Chỉ nối với làng của mình, lối vào và lối ra khớp nhau hai chiều
    assert.ok(m.warps.length >= 2 && m.warps.every((w) => w.to === village), `${id}: chỉ nối với ${village}`);
    const back = MAPS[village].warps.filter((w) => w.to === id);
    assert.equal(back.length, 2, `${village}: lối sang ${id}`);
    for (const [from, to, list] of [[m, MAPS[village], m.warps], [MAPS[village], m, back]]) {
      for (const w of list) {
        assert.ok(!to.isSolid(w.tx, w.ty) && !to.warpAt(w.tx, w.ty), `${from.id} -> ${to.id}: chỗ đến (${w.tx},${w.ty})`);
        assert.ok(to.warps.some((b) => b.to === from.id && Math.abs(b.x - w.tx) + Math.abs(b.y - w.ty) <= 1), `${to.id}: không có lối quay về ${from.id}`);
      }
    }
    // Không có ô đi được nào bị cô lập
    const [ex, ey] = entryOf(village, id);
    const all = dist(m, ex, ey);
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) if (!m.isSolid(x, y)) assert.ok(all.has(`${x},${y}`), `${id} (${x},${y}): không tới được`);
    }
    // Bảng Pokémon riêng của khu, mọi ô cỏ thuộc một khu
    assert.ok(m.areas.length && m.areas.every((a) => a.table.startsWith(id) && ENCOUNTERS[a.table]), `${id}: bảng Pokémon riêng`);
    let grass = 0;
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.info(x, y).encounter) grass++;
    assert.ok(grass >= 40, `${id}: ít bụi cỏ (${grass})`);
    assert.equal(TRAINERS.filter((t) => t.map === id).length, 2, `${id}: 2 nhà huấn luyện`);
    assert.ok(NPCS.some((n) => n.map === id && n.lines?.length), `${id}: NPC gợi ý đường`);
    assert.ok(Object.keys(m.signs).length >= 1, `${id}: biển báo`);
    // Người đứng trên ô đi được, không đứng trên ô chuyển bản đồ
    for (const p of people(id)) {
      assert.ok(!m.isSolid(p.x, p.y) && !m.warpAt(p.x, p.y), `${p.id} đứng sai chỗ (${p.x},${p.y})`);
      assert.ok(all.has(`${p.x},${p.y}`) || p.id === 'v8-guide-lost' || p.id === 'v6-machoke-lost', `${p.id}: không tới được`);
    }
  }
  // Làng không có bụi cỏ
  for (const { village } of AREAS) {
    const v = MAPS[village];
    for (let y = 0; y < v.height; y++) for (let x = 0; x < v.width; x++) assert.ok(!v.info(x, y).encounter, `${village} (${x},${y}) có bụi cỏ`);
  }
});

test('khu phụ làng 6-8: đường tới nơi diễn ra nhiệm vụ dài, quanh co, nhánh cụt có vật phẩm, nhà huấn luyện chắn lối không đi vòng được', () => {
  const goals = { quarry6: 'v6-aerodactyl', grave7: 'v7-haunter', pass8: 'v8-jynx' };
  const minSteps = { quarry6: 70, grave7: 85, pass8: 100 };
  for (const { id, village } of AREAS) {
    const m = MAPS[id];
    const [ex, ey] = entryOf(village, id);
    const goal = npc(goals[id]);
    assert.equal(goal.map, id);
    const steps = reachNear(dist(m, ex, ey), goal.x, goal.y);
    assert.ok(steps >= minSteps[id], `${id}: đường tới ${goal.id} quá ngắn (${steps} bước)`);
    // Vật phẩm: ít nhất 4 món, có món nằm ở ngách cụt (rời đường chính đáng kể)
    const items = m.objects.filter((o) => o.kind === 'item');
    assert.ok(items.length >= 4, `${id}: ${items.length} vật phẩm`);
    assert.ok(items.some((o) => m.info(o.x, o.y).encounter), `${id}: có vật phẩm giữa bụi cỏ`);
    // Nhà huấn luyện đứng ở chỗ hẹp: chặn chỗ đứng + tầm nhìn thì không tới được nơi diễn ra nhiệm vụ
    for (const t of TRAINERS.filter((tt) => tt.map === id)) {
      const block = new Set([`${t.x},${t.y}`]);
      for (let i = 1; i <= t.sight; i++) block.add(`${t.x + D[t.facing][0] * i},${t.y + D[t.facing][1] * i}`);
      assert.equal(reachNear(dist(m, ex, ey, block), goal.x, goal.y), Infinity, `${t.id}: đi vòng tránh được`);
      assert.ok(t.team.every(([, lv]) => lv >= 36 && lv <= 45), `${t.id}: cấp không hợp hành trình`);
    }
  }
  // Mỏ Đá: đá lở chắn thẳng lối giữa sân lên lòng mỏ; gờ đá từ hố mỏ là đường tắt một chiều về sân mỏ
  const q = MAPS.quarry6;
  const [qx, qy] = entryOf('village6', 'quarry6');
  const aero = npc('v6-aerodactyl');
  assert.ok([...q.rows[22]].filter((c) => c === 'R').length >= 6, 'đống đá lở giữa mỏ');
  const backQ = dist(q, aero.x, aero.y + 1).get(`${qx},${qy}`);
  assert.ok(backQ < reachNear(dist(q, qx, qy), aero.x, aero.y) - 30, `đường tắt về sân mỏ (${backQ} bước)`);
  assert.ok(q.areas[0].table === 'quarry6-deep', 'hốc cỏ rậm');
  // Nghĩa trang: Haunter lần đầu hiện giữa đường (nghĩa trang cổ), lần cuối chặn cửa miếu hoang: chú tiểu ở trong miếu,
  // chỉ vào được qua chỗ Haunter đứng
  const g = MAPS.grave7;
  const [gx, gy] = entryOf('village7', 'grave7');
  const trail = npc('v7-haunter-trail');
  const final = npc('v7-haunter');
  const novice = npc('v7-novice');
  const gd = dist(g, gx, gy);
  assert.ok(reachNear(gd, trail.x, trail.y) < reachNear(gd, final.x, final.y) - 40, 'Haunter bay đi xa');
  assert.equal(reachNear(dist(g, gx, gy, new Set([`${final.x},${final.y}`])), novice.x, novice.y), Infinity, 'chú tiểu trốn sau Haunter');
  assert.ok(g.areas[0].table === 'grave7-deep', 'hốc cỏ rậm');
  // Đèo Tuyết: bản đồ tuyết, anh Đông trong hốc đá sau Jynx; gờ tuyết là đường tắt xuống
  const p = MAPS.pass8;
  const [px, py] = entryOf('village8', 'pass8');
  const jynx = npc('v8-jynx');
  const dong = npc('v8-guide-lost');
  assert.equal(p.snow, true);
  assert.equal(p.climate, 'snow');
  assert.equal(reachNear(dist(p, px, py, new Set([`${jynx.x},${jynx.y}`])), dong.x, dong.y), Infinity, 'anh Đông bị Jynx chặn trong hốc đá');
  const backP = dist(p, jynx.x, jynx.y + 1).get(`${px},${py}`);
  assert.ok(backP < reachNear(dist(p, px, py), jynx.x, jynx.y) - 30, `gờ tuyết là đường tắt (${backP} bước)`);
});

// Thế giới giả cho cảnh cắt: ghi lại các lệnh, trận đấu nào cũng thắng (hoặc theo battle()), có NPC nào cũng tìm thấy
function fakeWorld(mapId, battle = () => 'win') {
  const calls = [];
  const fake = (id) => ({ def: { id }, pos: { x: 5, y: 5 } });
  const t = {
    map: MAPS[mapId],
    pos: { x: 5, y: 6 },
    calls,
    battles: [],
    ask: async () => true,
    say: async () => {},
    startBattle: async (data) => (t.battles.push(data), battle(data)),
    findNpc: (id) => fake(id),
    spawnNpc: (def) => (calls.push(['spawnNpc', def.id]), { def, pos: { x: def.x, y: def.y } }),
    warpTo: async (w) => {
      calls.push(['warpTo', w.to]);
      t.map = MAPS[w.to];
    },
  };
  return new Proxy(t, {
    get: (target, k) => (k in target ? target[k] : (...args) => (calls.push([k, ...args]), Promise.resolve())),
  });
}
const called = (world, name) => world.calls.filter(([k]) => k === name);

test('Bản Vách Đá: đuổi Aerodactyl cứu Machoke, thắng võ sư Hổ thì thầy trò xuống bản dọn đá rồi về chỗ tập', async () => {
  resetState();
  assert.match(villageObjective('v6'), /hỏi trưởng bản/);
  const gate = MAPS.village6.gates[0];
  assert.equal(typeof villageGate({ say: async () => {} }, gate), 'function', 'chưa xong thì cổng chặn');
  // Trước khi cứu: võ sư và Machoke ở trong mỏ, chưa ở bản
  assert.equal(npc('v6-master-quarry').map, 'quarry6');
  assert.ok(npc('v6-aerodactyl').show() && npc('v6-machoke-lost').show() && npc('v6-master-quarry').show());
  assert.ok(!npc('v6-master').show() && !npc('v6-machoke').show() && !npc('v6-machoke-quarry').show());
  setFlag('quest:v6');
  assert.match(villageObjective('v6'), /Mỏ Đá Vách Núi/);
  // Đánh Aerodactyl nhưng chưa đồng ý đấu võ sư: Machoke đã về với thầy, chưa xong nhiệm vụ
  let world = fakeWorld('quarry6');
  world.ask = async () => false;
  await npc('v6-aerodactyl').onTalk(world);
  assert.ok(hasFlag('village:v6:rescued') && !villageDone('v6'));
  assert.equal(called(world, 'npcFlyAway').length, 1, 'Aerodactyl bay đi');
  assert.ok(called(world, 'walkNpcTo').length >= 1, 'Machoke chạy về với thầy');
  assert.ok(!npc('v6-aerodactyl').show() && !npc('v6-machoke-lost').show() && npc('v6-machoke-quarry').show());
  assert.match(villageObjective('v6'), /Thách đấu võ sư Hổ/);
  // Thua võ sư thì vẫn ở mỏ
  world = fakeWorld('quarry6', (b) => (b.trainer ? 'lose' : 'win'));
  await npc('v6-master-quarry').onTalk(world);
  assert.ok(!villageDone('v6') && called(world, 'warpTo').length === 0);
  // Thắng: xuống bản, dọn đá, nhận quà, hai thầy trò về chỗ tập
  world = fakeWorld('quarry6');
  await npc('v6-master-quarry').onTalk(world);
  assert.ok(villageDone('v6'));
  assert.equal(world.battles.at(-1).trainer.id, 'v6-master');
  assert.deepEqual(called(world, 'warpTo').map(([, to]) => to), ['village6']);
  assert.deepEqual(called(world, 'spawnNpc').map(([, id]) => id).sort(), ['v6-machoke', 'v6-master']);
  assert.ok(called(world, 'giveItem').some(([, item, qty]) => item === 'revive' && qty === 2));
  const walks = called(world, 'walkNpcTo').map(([, , target]) => `${target.x},${target.y}`);
  assert.ok(walks.includes(`${npc('v6-master').x},${npc('v6-master').y}`) && walks.includes(`${npc('v6-machoke').x},${npc('v6-machoke').y}`));
  assert.equal(called(world, 'walkNpcAway').length, 0);
  assert.ok(npc('v6-master').show() && npc('v6-machoke').show() && !npc('v6-master-quarry').show() && !npc('v6-machoke-quarry').show());
  assert.equal(villageGate({ say: async () => {} }, gate), null, 'xong thì cổng mở');
});

test('Xóm Hương Khói: Haunter bay từ nghĩa trang cổ về miếu hoang, đánh xong đưa chú tiểu về miếu, sư thầy gióng chuông rồi Gary chặn cổng', async () => {
  resetState();
  // Chưa nhận lời: chưa thấy Haunter; chú tiểu đã trốn trong miếu hoang
  assert.ok(!npc('v7-haunter-trail').show() && !npc('v7-haunter').show() && npc('v7-novice').show());
  setFlag('quest:v7');
  assert.match(villageObjective('v7'), /Nghĩa Trang Rừng Trúc/);
  assert.ok(npc('v7-haunter-trail').show() && !npc('v7-haunter').show());
  let world = fakeWorld('grave7');
  await npc('v7-haunter-trail').onTalk(world);
  assert.equal(world.battles.length, 0, 'lần đầu Haunter chỉ trêu rồi bay mất');
  assert.equal(called(world, 'npcFlyAway').length, 1);
  assert.ok(!npc('v7-haunter-trail').show() && npc('v7-haunter').show());
  assert.match(villageObjective('v7'), /miếu hoang/);
  // Bỏ chạy khỏi trận thì chưa có gì thay đổi
  world = fakeWorld('grave7', () => 'run');
  await npc('v7-haunter').onTalk(world);
  assert.ok(npc('v7-haunter').show() && !hasFlag('village:v7:haunter'));
  // Thắng: chú tiểu về xóm, vào miếu; chuông ngân; chưa xong nhiệm vụ vì Gary còn chặn cổng
  world = fakeWorld('grave7');
  await npc('v7-haunter').onTalk(world);
  assert.ok(world.battles[0].enemy && !world.battles[0].persist);
  assert.ok(hasFlag('village:v7:haunter') && hasFlag('village:v7:bell') && !villageDone('v7'));
  assert.deepEqual(called(world, 'warpTo').map(([, to]) => to), ['village7']);
  const [[, kid, opts]] = called(world, 'npcLeave');
  assert.equal(kid.def.id, 'v7-novice-walk');
  assert.ok(opts.building && opts.building.door.x === 13 && opts.building.door.y === 5, 'chú tiểu vào miếu');
  assert.ok(called(world, 'giveItem').some(([, item, qty]) => item === 'fullHeal' && qty === 2));
  assert.equal(called(world, 'walkNpcAway').length, 0);
  assert.ok(!npc('v7-novice').show() && !npc('v7-haunter').show());
  assert.ok(npc('gary-v7').show(), 'Gary chờ ở cổng');
  assert.match(villageObjective('v7'), /Gary/);
  assert.ok(houseKnock('village7', { x: 13, y: 5 }), 'miếu có tiếng chú tiểu tụng kinh');
  const fight = villageGate({ say: async () => {} }, MAPS.village7.gates[0]);
  assert.equal(typeof fight, 'function', 'Gary chặn cổng');
  setFlag('village:v7');
  assert.ok(!npc('gary-v7').show());
});

test('Làng Đèo Tuyết: đuổi Jynx trên đỉnh đèo, dìu anh Đông về với mẹ rồi anh ra cổng đèo chờ dẫn đường', async () => {
  resetState();
  assert.match(villageObjective('v8'), /qua đèo/);
  assert.equal(npc('v8-guide-lost').map, 'pass8');
  assert.ok(npc('v8-guide-lost').show() && npc('v8-jynx').show() && !npc('v8-guide').show());
  setFlag('quest:v8');
  assert.match(villageObjective('v8'), /Đèo Tuyết/);
  const world = fakeWorld('pass8');
  await npc('v8-jynx').onTalk(world);
  assert.ok(villageDone('v8'));
  assert.equal(called(world, 'npcFlyAway').length, 1, 'Jynx đi mất');
  assert.deepEqual(called(world, 'warpTo').map(([, to]) => to), ['village8']);
  assert.deepEqual(called(world, 'spawnNpc').map(([, id]) => id), ['v8-guide']);
  assert.ok(called(world, 'giveItem').some(([, item, qty]) => item === 'iceHeal' && qty === 3));
  // Anh Đông ra đúng chỗ đứng chờ ở cổng đèo, bà cụ về chỗ cũ trước nhà
  const guide = npc('v8-guide');
  const granny = npc('v8-granny');
  const walks = called(world, 'walkNpcTo').map(([, , target]) => `${target.x},${target.y}`);
  assert.ok(walks.includes(`${guide.x},${guide.y}`) && walks.includes(`${granny.x},${granny.y}`));
  assert.equal(called(world, 'walkNpcAway').length, 0);
  assert.ok(!npc('v8-guide-lost').show() && !npc('v8-jynx').show() && guide.show());
  assert.equal(villageGate({ say: async () => {} }, MAPS.village8.gates[0]), null);
});
