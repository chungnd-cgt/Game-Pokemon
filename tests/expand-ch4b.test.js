import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { TRAINERS } from '../src/data/npcs.js';

const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// BFS tính số bước tới từng ô, có nhảy gờ một chiều (bước vào ô gờ đúng chiều thì đáp xuống ô bên kia).
// ladders: danh sách id bản đồ đi qua lại được bằng thang (ô chuyển bản đồ giữa các tầng). Khoá: 'mapId:x,y'
function dist(start, ladders = []) {
  const key = (m, x, y) => `${m.id}:${x},${y}`;
  const out = new Map([[key(start.m, start.x, start.y), 0]]);
  const queue = [start];
  while (queue.length) {
    const { m, x, y } = queue.shift();
    const d = out.get(key(m, x, y));
    const w = m.warpAt(x, y);
    if (w && ladders.includes(w.to) && w.to !== m.id) {
      const k = key(MAPS[w.to], w.tx, w.ty);
      if (!out.has(k)) {
        out.set(k, d + 1);
        queue.push({ m: MAPS[w.to], x: w.tx, y: w.ty });
      }
    }
    for (const [dir, [dx, dy]] of Object.entries(D)) {
      let [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      if (m.info(nx, ny).ledge === dir) [nx, ny] = [nx + dx, ny + dy];
      else if (m.isSolid(nx, ny)) continue;
      const k = key(m, nx, ny);
      if (m.isSolid(nx, ny) || out.has(k)) continue;
      out.set(k, d + 1);
      queue.push({ m, x: nx, y: ny });
    }
  }
  return out;
}

// Số bước ngắn nhất tới cạnh vật phẩm (đứng cạnh để nhặt)
const reach = (dmap, m, o) => Math.min(...Object.values(D).map(([dx, dy]) => dmap.get(`${m.id}:${o.x + dx},${o.y + dy}`) ?? Infinity));
// Vật phẩm nằm trong ngách cụt: muốn nhặt phải rẽ khỏi đường chính ít nhất `detour` bước
const offPath = (fromEntry, fromExit, total, m, o, detour) => reach(fromEntry, m, o) + reach(fromExit, m, o) - total >= detour;
const avgLevel = (table) => ENCOUNTERS[table].reduce((s, e) => s + (e.min + e.max) / 2, 0) / ENCOUNTERS[table].length;

test('Hang Sơn Động 2 tầng: vách chia đôi tầng 1, phải qua tầng hầm; phòng kín chỉ tới bằng thang dưới hầm', () => {
  const f1 = MAPS.cave2;
  const b1 = MAPS.cave2b;
  const ladders = ['cave2', 'cave2b'];
  const entryWarp = MAPS.route9.warps.find((w) => w.to === 'cave2');
  const exitWarp = MAPS.village7.warps.find((w) => w.to === 'cave2');
  const entry = { m: f1, x: entryWarp.tx, y: entryWarp.ty };
  const exit = { m: f1, x: exitWarp.tx, y: exitWarp.ty };
  const exitKey = `cave2:${exit.x},${exit.y}`;
  assert.ok(!dist(entry).has(exitKey), 'không đi thẳng tới cửa ra trên tầng 1');
  const fromEntry = dist(entry, ladders);
  const fromExit = dist(exit, ladders);
  const total = fromEntry.get(exitKey);
  assert.ok(total >= 120, `đường qua hang đủ dài (${total} bước)`);
  // Tầng hầm: 3 thang đều lên tầng 1; mỗi thang dưới hầm dẫn tới một khu khác nhau của tầng 1
  assert.equal(b1.warps.length, 3);
  assert.ok(b1.warps.every((w) => w.to === 'cave2' && b1.tileAt(w.x, w.y) === 'U'));
  assert.equal(f1.warps.filter((w) => w.to === 'cave2b' && f1.tileAt(w.x, w.y) === 'L').length, 3);
  // Phòng kín: không tới được từ cửa vào hay cửa ra nếu không xuống hầm; có Pokémon hiếm riêng
  const secret = f1.warps.find((w) => w.to === 'cave2b' && f1.areaAt(w.x, w.y)?.table === 'cave2-hidden');
  assert.ok(secret, 'có thang trong phòng kín');
  const room = `cave2:${secret.x},${secret.y + 1}`;
  assert.ok(!dist(entry).has(room) && !dist(exit).has(room), 'phòng kín bị vách bao quanh');
  assert.ok(fromEntry.has(room), 'leo thang dưới hầm thì tới phòng kín');
  // Nhà huấn luyện ở cả hai tầng (3-4 người), Pokémon dưới hầm / phòng kín mạnh hơn tầng 1
  const trainers = TRAINERS.filter((t) => t.map === 'cave2' || t.map === 'cave2b');
  assert.ok(trainers.length >= 3 && trainers.length <= 4, `${trainers.length} nhà huấn luyện`);
  assert.ok(trainers.some((t) => t.map === 'cave2') && trainers.some((t) => t.map === 'cave2b'));
  for (const t of trainers) assert.ok(!MAPS[t.map].isSolid(t.x, t.y), `${t.id} đứng trên ô đi được`);
  assert.ok(b1.areas.every((a) => a.table === 'cave2-deep'));
  assert.ok(avgLevel('cave2-deep') > avgLevel('cave2') && avgLevel('cave2-hidden') > avgLevel('cave2'));
  // Vật phẩm: tầng nào cũng có món nằm trong ngách cụt (phải rẽ khỏi đường chính mới nhặt được), món nào cũng tới được
  for (const m of [f1, b1]) {
    const items = m.objects.filter((o) => o.kind === 'item');
    assert.ok(items.length >= 4, `${m.id}: ${items.length} vật phẩm`);
    // Món trên bờ suối ngầm (surf: true) chỉ lướt nước mới tới: kiểm tra riêng ở tests/cave-water.test.js
    for (const o of items.filter((it) => !it.surf)) assert.ok(reach(fromEntry, m, o) < Infinity, `${m.id}: ${o.id} tới nhặt được`);
    const nooks = items.filter((o) => offPath(fromEntry, fromExit, total, m, o, 10));
    assert.ok(nooks.length >= 2, `${m.id}: chỉ ${nooks.length} món trong ngách cụt`);
  }
});

test('Tuyến đường 10: đường núi tuyết quanh co gấp đôi, gờ đá là đường tắt một chiều về Chùa Cổ, nhiều ngách cụt', () => {
  const r = MAPS.route10;
  assert.ok(r.width * r.height >= 2 * 30 * 20, `diện tích ${r.width}x${r.height}`);
  const fromTown = MAPS.town8.warps.find((w) => w.to === 'route10');
  const fromVillage = MAPS.village8.warps.find((w) => w.to === 'route10');
  const a = { m: r, x: fromTown.tx, y: fromTown.ty };
  const b = { m: r, x: fromVillage.tx, y: fromVillage.ty };
  const fromA = dist(a);
  const fromB = dist(b);
  const forward = fromA.get(`route10:${b.x},${b.y}`);
  const back = fromB.get(`route10:${a.x},${a.y}`);
  assert.ok(forward >= 60, `đường Chùa Cổ -> Làng Đèo Tuyết đủ dài (${forward} bước)`);
  assert.ok(back !== undefined, 'đi ngược về Chùa Cổ được');
  assert.ok(back < forward - 20, `nhảy gờ đá về Chùa Cổ nhanh hơn hẳn (${back} so với ${forward} bước)`);
  // Có gờ nhảy xuống (v) và gờ một chiều sang trái (<)
  const tiles = r.rows.join('');
  assert.ok(tiles.includes('v') && tiles.includes('<'));
  // Càng về đông càng nhiều thông phủ tuyết
  const pines = (x1, x2) => r.rows.reduce((s, row) => s + [...row.slice(x1, x2)].filter((c) => c === 'n').length, 0);
  assert.ok(pines(r.width / 2, r.width) > 3 * pines(0, r.width / 2), 'phía đông nhiều thông tuyết hơn');
  // Hồ Lạnh có cồn cát giữa hồ, vật phẩm phải lướt nước mới lấy được
  assert.ok(r.objects.some((o) => o.kind === 'item' && r.tileAt(o.x, o.y) === 'd'));
  // 3-4 nhà huấn luyện, đứng trên ô đi được (kình ngư đứng dưới nước)
  const trainers = TRAINERS.filter((t) => t.map === 'route10');
  assert.ok(trainers.length >= 3 && trainers.length <= 4, `${trainers.length} nhà huấn luyện`);
  for (const t of trainers) assert.ok(t.swim ? r.tileAt(t.x, t.y) === 'w' : !r.isSolid(t.x, t.y), `${t.id} đứng sai chỗ`);
  // Ít nhất 2 món nằm trong ngách cụt (đi bộ tới được, phải rẽ khỏi đường chính)
  const items = r.objects.filter((o) => o.kind === 'item' && r.tileAt(o.x, o.y) !== 'd');
  const nooks = items.filter((o) => reach(fromA, r, o) < Infinity && offPath(fromA, fromB, forward, r, o, 8));
  assert.ok(nooks.length >= 2, `chỉ ${nooks.length} món trong ngách cụt`);
  // Bãi cỏ rậm khuất là ngách cụt riêng
  assert.ok(r.areas.some((ar) => ar.table === 'route10-deep'));
});
