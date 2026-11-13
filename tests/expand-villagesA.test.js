import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { addItem, itemCount, resetState, setFlag, state } from '../src/game/state.js';
import { STORY_NPCS, objectVisible } from '../src/story/chapter1.js';
import { houseKnock, villageDone, villageGate, villageObjective } from '../src/story/villages.js';

// Khu phụ quanh 4 làng (phần villagesA): nơi diễn ra nhiệm vụ của làng
const AREAS = [
  { id: 'field2', village: 'village2', v: 'v2', name: 'Đồng Cối Xay' },
  { id: 'hill3', village: 'village3', v: 'v3', name: 'Đồi Cột Điện' },
  { id: 'marsh4', village: 'village4', v: 'v4', name: 'Đầm Lau' },
  { id: 'pit5', village: 'village5', v: 'v5', name: 'Mỏ Đất Sét' },
];
const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const npc = (id) => STORY_NPCS.find((n) => n.id === id);
const pos = (n) => [n.x, n.y];

// BFS có tính nhảy gờ một chiều; blocked: các ô bị chặn thêm (NPC đứng chắn, tầm nhìn nhà huấn luyện...)
function dist(m, [sx, sy], blocked = []) {
  const bl = new Set(blocked.map(([x, y]) => `${x},${y}`));
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
      if (m.isSolid(nx, ny) || bl.has(k) || out.has(k)) continue;
      out.set(k, d + 1);
      queue.push([nx, ny]);
    }
  }
  return out;
}
// Số bước tới ô đứng cạnh (x, y) (nói chuyện / nhặt đồ), Infinity nếu không tới được
const reach = (d, [x, y]) => Math.min(...Object.values(D).map(([dx, dy]) => d.get(`${x + dx},${y + dy}`) ?? Infinity));
const entry = (a) => {
  const w = MAPS[a.village].warps.find((ww) => ww.to === a.id);
  return [w.tx, w.ty];
};
const items = (m) => m.objects.filter((o) => o.kind === 'item');

test('khu phụ làng (A): mỗi làng có một khu mới nối bằng lối riêng, thuộc khu vực của làng, có bụi cỏ / hang có bảng Pokémon riêng', () => {
  for (const a of AREAS) {
    const m = MAPS[a.id];
    assert.equal(m.name, a.name);
    assert.equal(m.place, a.village, `${a.id}: phải thuộc khu vực ${a.village}`);
    assert.ok(m.width >= 32 && m.height >= 28, `${a.id}: khu quá nhỏ (${m.width}x${m.height})`);
    // Chỉ nối với làng của mình (không đi tắt sang thành phố hay tuyến đường)
    assert.ok(m.warps.every((w) => w.to === a.village), `${a.id}: lối ra lạ`);
    assert.ok(MAPS[a.village].warps.some((w) => w.to === a.id), `${a.village}: thiếu lối vào ${a.id}`);
    // Bảng Pokémon riêng của khu (không dùng chung bảng tuyến đường)
    for (const area of m.areas) {
      assert.ok(area.table.startsWith(a.id), `${a.id}: bảng ${area.table} không phải của khu`);
      assert.ok(ENCOUNTERS[area.table].length >= 4);
    }
    // Làng vẫn không có bụi cỏ
    const v = MAPS[a.village];
    for (let y = 0; y < v.height; y++) for (let x = 0; x < v.width; x++) assert.ok(!v.info(x, y).encounter, `${a.village} (${x},${y}) có bụi cỏ`);
    // Nhà huấn luyện và NPC gợi ý
    assert.ok(TRAINERS.filter((t) => t.map === a.id).length >= 2, `${a.id}: thiếu nhà huấn luyện`);
    assert.ok([...NPCS, ...STORY_NPCS].some((n) => n.map === a.id && !n.team && !n.mon), `${a.id}: thiếu NPC`);
    assert.ok(items(m).length >= 4, `${a.id}: ít vật phẩm`);
  }
  // Bụi cỏ rậm có bảng riêng ở các khu ngoài trời
  for (const id of ['field2', 'hill3', 'marsh4']) assert.ok(MAPS[id].areas.some((ar) => ar.table === `${id}-deep`), id);
  assert.ok(MAPS.pit5.cave);
});

test('Đồng Cối Xay: Oddish chắn cầu đông, Bellsprout chắn lối xuống sân kho, kho thóc cũ ở xa; gờ đất là đường tắt một chiều về', () => {
  const a = AREAS[0];
  const m = MAPS.field2;
  const start = entry(a);
  const gloom = pos(npc('v2-gloom'));
  const blockers = ['v2-oddish', 'v2-bellsprout'].map((id) => pos(npc(id)));
  const free = dist(m, start);
  assert.ok(reach(free, gloom) >= 60, `đường tới kho thóc cũ đủ dài (${reach(free, gloom)} bước)`);
  // Còn con nào chắn đường thì không tới được kho thóc
  for (const b of blockers) assert.equal(reach(dist(m, start, [b]), gloom), Infinity, `(${b}) phải chắn đường`);
  // Chỗ nép sang bên sau khi thua không chắn đường
  const aside = ['v2-oddish-aside', 'v2-bellsprout-aside'].map((id) => pos(npc(id)));
  assert.ok(reach(dist(m, start, aside), gloom) < Infinity);
  // Từ sân kho nhảy gờ về nhanh hơn hẳn đường đi lên
  const back = dist(m, [gloom[0], gloom[1] + 1]).get(`${start[0]},${start[1]}`);
  assert.ok(back < reach(free, gloom) - 20, `đường tắt về (${back} bước)`);
  // Anh Cốm nằm cạnh Gloom trước kho thóc cũ (nhà không vào được)
  const barn = m.buildings[0];
  assert.equal(barn.to, null);
  assert.deepEqual([barn.door.x, barn.door.y + 1], gloom, 'Gloom canh ngay trước cửa kho');
  assert.ok(Math.abs(npc('v2-com').x - gloom[0]) + Math.abs(npc('v2-com').y - gloom[1]) <= 3);
  // Nhánh cụt có vật phẩm: vật phẩm nào cũng tới nhặt được
  for (const o of items(m)) assert.ok(reach(free, [o.x, o.y]) < Infinity, o.id);
});

test('Đồi Cột Điện: bốn bậc đồi ngoằn ngoèo, 3 cầu chì (chỉ hiện khi nhận lời), cái cuối sau lưng Magneton', () => {
  resetState();
  const m = MAPS.hill3;
  const start = entry(AREAS[1]);
  const free = dist(m, start);
  const mag = pos(npc('v3-magneton'));
  assert.ok(reach(free, mag) >= 90, `đường xuống trạm phát cũ đủ dài (${reach(free, mag)} bước)`);
  const fuses = m.objects.filter((o) => o.item === 'fuse');
  assert.equal(fuses.length, 3);
  assert.ok(fuses.every((o) => o.quest === 'v3' && !objectVisible(o)));
  setFlag('quest:v3');
  assert.ok(fuses.every((o) => objectVisible(o)));
  // Cầu chì ở các góc xa nhau; cái cuối chỉ lấy được sau khi đuổi Magneton
  const withMag = dist(m, start, [mag]);
  const locked = fuses.filter((o) => reach(withMag, [o.x, o.y]) === Infinity);
  assert.equal(locked.length, 1, 'đúng một cầu chì nằm sau lưng Magneton');
  for (const o of fuses) assert.ok(reach(free, [o.x, o.y]) < Infinity, o.id);
  // Cậu Tín trốn ở bậc cuối, Magneton là NPC Pokémon hoang dã
  assert.equal(npc('v3-tin-lost').map, 'hill3');
  assert.equal(npc('v3-magneton').mon, 'magneton');
  assert.ok(MAPS.village3.objects.every((o) => o.item !== 'fuse'), 'cầu chì không còn rải trong xóm');
});

test('Đầm Lau: chỉ một cầu ván sang bờ tây, phải vòng xuống nam theo lau sậy; Gyarados chắn cầu ván ra cồn cát có bè gỗ', () => {
  const m = MAPS.marsh4;
  const start = entry(AREAS[2]);
  const gya = pos(npc('v4-gyarados'));
  const rafter = pos(npc('v4-rafter'));
  const free = dist(m, start);
  assert.ok(reach(free, gya) >= 80, `đường tới Gyarados đủ dài (${reach(free, gya)} bước)`);
  assert.equal(m.tileAt(...gya), 'b', 'Gyarados nằm trên cầu ván');
  assert.ok(['d', 'b'].includes(m.tileAt(...rafter)), 'anh thả bè ở trên cồn cát');
  assert.equal(reach(dist(m, start, [gya]), rafter), Infinity, 'Gyarados chắn đường ra cồn cát');
  assert.ok(reach(free, rafter) < Infinity);
  // Cầu ván qua sông là lối duy nhất sang bờ tây
  const bridge = [];
  for (let x = 0; x < m.width; x++) for (let y = 10; y < m.height; y++) if (m.tileAt(x, y) === 'b') bridge.push([x, y]);
  assert.ok(bridge.length > 0);
  assert.equal(reach(dist(m, start, bridge), gya), Infinity);
  // Thợ mộc đứng chắn cầu gỗ trong làng tới khi có gỗ
  const carpenter = npc('v4-carpenter');
  assert.equal(MAPS.village4.tileAt(carpenter.x, carpenter.y), 'b');
  assert.ok(!npc('v4-gyarados').map.startsWith('village'));
});

test('Mỏ Đất Sét: hầm ngoằn ngoèo, tay buôn Lực canh hầm đông (không lén qua được), Tài giữ chú Sét cạnh đường hầm một chiều lên làng', () => {
  const m = MAPS.pit5;
  const start = entry(AREAS[3]);
  const tai = npc('v5-thief-b');
  const luc = npc('v5-thief-a');
  const free = dist(m, start);
  assert.ok(reach(free, pos(tai)) >= 50, `đường tới hầm chính đủ dài (${reach(free, pos(tai))} bước)`);
  // Tầm nhìn của Lực cắt ngang hầm đông: tránh tầm nhìn thì không xuống được hầm chính
  const [dx, dy] = D[luc.facing];
  const sight = Array.from({ length: luc.sight }, (_, i) => [luc.x + dx * (i + 1), luc.y + dy * (i + 1)]);
  assert.equal(reach(dist(m, start, [pos(luc), ...sight]), pos(tai)), Infinity);
  // Đường hầm bọn buôn lậu: một chiều lên làng, ngay cạnh hầm chính
  const tunnel = m.warps.find((w) => w.oneWay);
  assert.equal(tunnel.to, 'village5');
  assert.ok(!MAPS.village5.warps.some((w) => w.to === 'pit5' && w.tx === tunnel.x && w.ty === tunnel.y));
  assert.ok(dist(m, pos(tai)).get(`${tunnel.x},${tunnel.y}`) <= 12, 'Tài chuồn ra đường hầm gần');
  assert.ok(Math.abs(npc('v5-set').x - tai.x) + Math.abs(npc('v5-set').y - tai.y) <= 6, 'chú Sét bị giữ cạnh Tài');
  assert.ok(TRAINERS.some((t) => t.map === 'pit5'), 'có nhà huấn luyện thường trong mỏ');
  // Món cuối hố ngập nước (surf: true) chỉ lướt nước mới tới: kiểm tra ở tests/cave-water.test.js
  for (const o of items(m).filter((it) => !it.surf)) assert.ok(reach(free, [o.x, o.y]) < Infinity, o.id);
});

// Thế giới giả cho cảnh cắt: NPC của bản đồ hiện tại theo show(), ghi lại NPC rời cảnh bằng cách nào
function fakeWorld(mapId, playerPos) {
  const world = {
    log: [],
    battles: 0,
    pos: { x: playerPos[0], y: playerPos[1] },
    npcs: [],
    load(id) {
      world.map = MAPS[id];
      world.npcs = STORY_NPCS.filter((n) => n.map === id && (!n.show || n.show())).map((def) => ({ def, pos: { x: def.x, y: def.y } }));
    },
    say: async () => {},
    ask: async () => true,
    giveItem: async (id, qty = 1) => addItem(id, qty),
    startBattle: async () => (world.battles++, 'win'),
    findNpc: (id) => world.npcs.find((n) => n.def.id === id) ?? null,
    spawnNpc: (def) => {
      const n = { def, pos: { x: def.x, y: def.y } };
      world.npcs.push(n);
      return n;
    },
    removeNpc: (n) => (world.npcs = world.npcs.filter((o) => o !== n)),
    walkNpcTo: async (n, target) => { n.pos = { ...target }; },
    async npcLeave(n, { building = null, toMap = null } = {}) {
      world.log.push({ id: n.def.id, building: building ? `${building.door.x},${building.door.y}` : null, toMap, map: world.map.id });
      world.removeNpc(n);
    },
    async npcEntersDoor(n, b) {
      world.log.push({ id: n.def.id, building: `${b.door.x},${b.door.y}`, map: world.map.id });
      world.removeNpc(n);
    },
    async npcFlyAway(n) {
      world.log.push({ id: n.def.id, fly: true, map: world.map.id });
      world.removeNpc(n);
    },
    // Như WorldScene.refreshNpcs sau mỗi sự kiện: NPC nào hết điều kiện thì biến mất, đủ điều kiện thì xuất hiện
    refresh() {
      for (const def of STORY_NPCS.filter((n) => n.map === world.map.id)) {
        const n = world.findNpc(def.id);
        const show = !def.show || def.show();
        if (show && !n) world.npcs.push({ def, pos: { x: def.x, y: def.y } });
        else if (!show && n) world.removeNpc(n);
      }
    },
    async warpTo(w) {
      world.load(w.to);
      world.pos = { x: w.tx, y: w.ty };
    },
    face() {}, faceNpcTo() {}, faceNpcToPlayer() {}, facePlayerTo() {},
  };
  world.load(mapId);
  return world;
}
const talk = async (world, id) => {
  const n = world.findNpc(id);
  await n.def.onTalk.call(n.def, world, n);
  world.refresh();
};

test('nhiệm vụ Xóm Cối Xay: đuổi cả bầy, anh Cốm cho chúng ở kho thóc cũ, về xóm nhận quà rồi vào nhà; về sau bầy sống quanh kho', async () => {
  resetState();
  setFlag('quest:v2');
  assert.match(villageObjective('v2'), /Đồng Cối Xay/);
  const world = fakeWorld('field2', [29, 16]);
  await talk(world, 'v2-oddish');
  assert.ok(!world.findNpc('v2-oddish') && world.findNpc('v2-oddish-aside'), 'Oddish nép sang bên');
  await talk(world, 'v2-bellsprout');
  assert.ok(!villageDone('v2'));
  await talk(world, 'v2-gloom');
  assert.equal(world.battles, 3);
  assert.ok(villageDone('v2'));
  assert.ok(itemCount('awakening') >= 3 && itemCount('antidote') >= 3);
  // Gloom, Bellsprout chui vào kho thóc cũ; anh Cốm về xóm vào nhà; không ai biến mất giữa đường
  const barn = MAPS.field2.buildings[0].door;
  assert.ok(world.log.some((l) => l.id === 'v2-gloom' && l.building === `${barn.x},${barn.y}`));
  assert.ok(world.log.some((l) => l.id === 'v2-bellsprout-aside' && l.building === `${barn.x},${barn.y}`));
  assert.ok(world.log.some((l) => l.id === 'v2-com-walk' && l.map === 'village2' && l.building));
  assert.ok(world.log.every((l) => l.building || l.toMap || l.fly));
  assert.ok(npc('v2-oddish-home').show() && npc('v2-gloom-home').show() && !npc('v2-com').show());
  assert.ok(houseKnock('field2', barn));
  assert.equal(villageGate({ say: async () => {} }, { village: 'v2' }), null);
});

test('nhiệm vụ Xóm Trạm Điện: Magneton bay đi, đủ cầu chì thì Tín dẫn về xóm lắp, rồi Gary chờ ở cổng', async () => {
  resetState();
  setFlag('quest:v3');
  assert.match(villageObjective('v3'), /Đồi Cột Điện/);
  const world = fakeWorld('hill3', [7, 27]);
  await talk(world, 'v3-magneton');
  assert.ok(world.log.some((l) => l.id === 'v3-magneton' && l.fly));
  addItem('fuse', 3);
  world.load('hill3');
  await talk(world, 'v3-tin-lost');
  assert.equal(world.map.id, 'village3', 'về xóm cùng Tín');
  assert.equal(itemCount('fuse'), 0);
  assert.ok(itemCount('paralyzeHeal') >= 3);
  assert.ok(!villageDone('v3') && npc('gary-v3').show(), 'có điện rồi Gary mới chặn cổng');
  // Tín đứng phụ việc trong xóm (cùng id với NPC của xóm: không hiện hai lần)
  assert.ok(world.findNpc('v3-tin') && npc('v3-tin').show() && !npc('v3-tin-lost').show());
});

test('nhiệm vụ Làng Bến Đò: Gyarados bơi về thượng nguồn, theo bè gỗ về làng sửa cầu; thợ mộc về nhà, anh thả bè vào Pokémon Center', async () => {
  resetState();
  const world = fakeWorld('marsh4', [15, 5]);
  await talk(world, 'v4-gyarados');
  assert.ok(world.log.some((l) => l.id === 'v4-gyarados' && l.fly));
  assert.ok(villageDone('v4'));
  const v4 = MAPS.village4;
  const center = v4.buildings.find((b) => b.type === 'center').door;
  assert.ok(world.log.some((l) => l.id === 'v4-carpenter' && l.building && l.building !== `${center.x},${center.y}`));
  assert.ok(world.log.some((l) => l.id === 'v4-rafter-walk' && l.building === `${center.x},${center.y}`));
  assert.ok(itemCount('hyperPotion') >= 2, 'ông lái đò tặng quà');
  assert.ok(!npc('v4-carpenter').show(), 'cầu thông');
});

test('nhiệm vụ Làng Đất Sét: thua cả hai, tay buôn chuồn theo đường hầm; chú Sét về làng, xe đất sang Lò Gốm, chú về nhà', async () => {
  resetState();
  setFlag('quest:v5');
  assert.match(villageObjective('v5'), /Mỏ Đất Sét/);
  const world = fakeWorld('pit5', [14, 12]);
  state.defeatedTrainers.add('v5-thief-a');
  await npc('v5-thief-a').onDefeat(world, world.findNpc('v5-thief-a'));
  assert.ok(!villageDone('v5'), 'còn tên Tài');
  state.defeatedTrainers.add('v5-thief-b');
  await npc('v5-thief-b').onDefeat(world, world.findNpc('v5-thief-b'));
  assert.ok(world.log.some((l) => l.id === 'v5-thief-b' && l.toMap === 'village5' && l.map === 'pit5'));
  assert.ok(villageDone('v5'));
  assert.ok(itemCount('burnHeal') >= 3);
  assert.ok(world.log.some((l) => l.id === 'v5-carter' && l.toMap === 'town6'), 'xe đất ra đúng lối sang thành phố');
  assert.ok(world.log.some((l) => l.id === 'v5-set-walk' && l.building));
  assert.ok(!npc('v5-set').show() && !npc('v5-carter').show());
});
