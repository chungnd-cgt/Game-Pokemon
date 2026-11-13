import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';

// Mở rộng bản đồ phần ch5: Đường Chiến Thắng (route11) và Hang Vân Sơn 3 tầng (cave3, cave3b, cave3c)

const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const people = (mapId) => [...NPCS, ...TRAINERS].filter((n) => n.map === mapId);
const key = (m, x, y) => `${m}:${x},${y}`;

// Tìm đường (BFS) trên một hoặc nhiều bản đồ: nhảy gờ một chiều, người đứng chắn đường, ô cổng / ô né (avoid) coi như vách.
// Bước lên ô chuyển bản đồ tới bản đồ trong `maps` (thang giữa các tầng) thì sang bản đồ kia.
// start: một ô hoặc danh sách ô xuất phát. Trả về Map "id:x,y" -> số bước, kèm dist.prev (ô liền trước) để dựng lại đường đi
function walk(start, { maps, blockGates = false, avoid = new Set() } = {}) {
  const starts = [start].flat();
  const allowed = maps ?? [starts[0].map];
  const dist = new Map(starts.map((p) => [key(p.map, p.x, p.y), 0]));
  dist.prev = new Map();
  const queue = starts.map((p) => [p.map, p.x, p.y]);
  while (queue.length) {
    const [id, x, y] = queue.shift();
    const m = MAPS[id];
    const d = dist.get(key(id, x, y));
    const blocked = (nx, ny) => nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || m.isSolid(nx, ny)
      || people(id).some((n) => n.x === nx && n.y === ny) || (blockGates && m.gateAt(nx, ny)) || avoid.has(key(id, nx, ny));
    for (const [dir, [dx, dy]] of Object.entries(D)) {
      let [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      if (m.info(nx, ny).ledge === dir) [nx, ny] = [nx + dx, ny + dy];
      if (blocked(nx, ny)) continue;
      let [tm, tx, ty] = [id, nx, ny];
      const w = m.warpAt(nx, ny);
      if (w && allowed.includes(w.to) && w.to !== id) [tm, tx, ty] = [w.to, w.tx, w.ty];
      // Ô chuyển bản đồ cũng được ghi lại (để biết đã tới cửa ra)
      for (const k of new Set([key(id, nx, ny), key(tm, tx, ty)])) {
        if (dist.has(k)) continue;
        dist.set(k, d + 1);
        dist.prev.set(k, key(id, x, y));
        if (k === key(tm, tx, ty)) queue.push([tm, tx, ty]);
      }
    }
  }
  return dist;
}

// Các ô trên một đường ngắn nhất tới goal (dựng lại từ dist.prev)
function pathCells(dist, goal) {
  const cells = [];
  for (let k = goal; k !== undefined; k = dist.prev.get(k)) {
    const [map, xy] = k.split(':');
    const [x, y] = xy.split(',').map(Number);
    cells.push({ map, x, y });
  }
  return cells;
}

// Các ô nhà huấn luyện nhìn thấy (theo hướng đứng, tới khi gặp vách)
function sightCells(t) {
  const m = MAPS[t.map];
  const [dx, dy] = D[t.facing];
  const cells = new Set();
  for (let i = 1; i <= t.sight; i++) {
    const [x, y] = [t.x + dx * i, t.y + dy * i];
    if (m.isSolid(x, y)) break;
    cells.add(key(t.map, x, y));
  }
  return cells;
}

// Số bước tới ô kề vật phẩm (vật phẩm nằm đó thì đứng cạnh để nhặt)
const reachItem = (dist, mapId, o) => Math.min(...Object.values(D).map(([dx, dy]) => dist.get(key(mapId, o.x + dx, o.y + dy)) ?? Infinity));
const avgLevel = (table) => ENCOUNTERS[table].reduce((s, e) => s + (e.min + e.max) / 2, 0) / ENCOUNTERS[table].length;

test('Đường Chiến Thắng: lính gác 8 huy hiệu chặn lối vào, đường lên hang dài qua thung lũng và 3 bậc sườn núi', () => {
  const m = MAPS.route11;
  const entry = MAPS.town9.warps.find((w) => w.to === 'route11');
  const cave = m.warps.find((w) => w.to === 'cave3');
  const start = { map: 'route11', x: entry.tx, y: entry.ty };
  const caveKey = key('route11', cave.x, cave.y);
  // Cổng 8 huy hiệu: không qua cổng thì không đi tiếp được, lính gác đứng ngay cạnh cổng
  const gate = m.gates.find((g) => g.badges === 8);
  assert.ok(gate);
  assert.ok(!walk(start, { blockGates: true }).has(caveKey), 'đi vòng qua được lính gác');
  const guard = NPCS.find((n) => n.id === 'r11-guard');
  assert.equal(guard.map, 'route11');
  assert.ok(Math.abs(guard.x - gate.rect[2]) <= 1 && guard.y >= gate.rect[1] - 1 && guard.y <= gate.rect[3] + 1, 'lính gác đứng cạnh cổng');
  // Đường chính đủ dài (tính cả nhà huấn luyện đứng chắn), đi qua thung lũng phía nam rồi leo sườn núi
  const dist = walk(start);
  const steps = dist.get(caveKey);
  assert.ok(steps >= 70, `đường tới cửa hang quá ngắn (${steps} bước)`);
  // Sườn núi nhiều bậc: ít nhất 4 hàng gờ đất
  const ledgeRows = m.rows.filter((r) => (r.match(/v/g) ?? []).length >= 8);
  assert.ok(ledgeRows.length >= 4, `chỉ có ${ledgeRows.length} hàng gờ`);
  // Từ ngách tây cao nguyên nhảy gờ xuống là về bãi trống sau cổng nhanh hơn hẳn (đường tắt một chiều)
  const back = walk({ map: 'route11', x: cave.x, y: cave.y + 1 }).get(key('route11', gate.rect[2] + 1, entry.ty));
  assert.ok(back < steps / 2, `đường tắt về cổng (${back} bước)`);
  // Ngách cụt có vật phẩm hiếm: cách đường chính ít nhất 3 bước, phải rẽ vào mới nhặt được
  const fromPath = walk(pathCells(dist, caveKey));
  const items = m.objects.filter((o) => o.kind === 'item');
  for (const o of items) assert.ok(reachItem(dist, 'route11', o) < Infinity, `${o.id} không tới nhặt được`);
  const nooks = items.filter((o) => reachItem(fromPath, 'route11', o) >= 3);
  assert.ok(nooks.length >= 3, `chỉ ${nooks.length} vật phẩm nằm trong ngách`);
  assert.ok(nooks.some((o) => o.item === 'leftovers') && nooks.some((o) => o.item === 'rareCandy'));
  // Nhà huấn luyện mạnh: 4-5 người, cấp 47-52; cỏ rậm ở nhiều khu
  const trainers = TRAINERS.filter((t) => t.map === 'route11');
  assert.ok(trainers.length >= 4 && trainers.length <= 5, `${trainers.length} nhà huấn luyện`);
  for (const t of trainers) for (const [, lv] of t.team) assert.ok(lv >= 47 && lv <= 52, `${t.id}: cấp ${lv}`);
  assert.ok(Math.max(...trainers.flatMap((t) => t.team.map(([, lv]) => lv))) >= 51, 'tinh anh cuối phải mạnh nhất');
  // Mỗi tinh anh chặn một chặng: né tầm nhìn của bất kỳ ai thì không tới được cửa hang
  for (const t of trainers) assert.ok(!walk(start, { avoid: sightCells(t) }).has(caveKey), `${t.id}: đi vòng tránh được`);
  assert.ok(m.areas.filter((a) => a.table === 'route11-deep').length >= 2);
});

test('Hang Vân Sơn 3 tầng: vách băng chia đôi tầng 1, phải xuống tầng hầm mới tới lối ra; hầm băng sâu là ngách cụt có báu vật', () => {
  const FLOORS = ['cave3', 'cave3b', 'cave3c'];
  const f1 = MAPS.cave3;
  const entry = MAPS.route11.warps.find((w) => w.to === 'cave3');
  const exit = f1.warps.find((w) => w.to === 'league');
  const start = { map: 'cave3', x: entry.tx, y: entry.ty };
  const exitKey = key('cave3', exit.x, exit.y);
  assert.ok(!walk(start).has(exitKey), 'không đi thẳng tới lối ra trên tầng 1');
  const dist = walk(start, { maps: FLOORS });
  const steps = dist.get(exitKey);
  assert.ok(steps >= 70, `đường qua hang quá ngắn (${steps} bước)`);
  // Hang băng, chỉ dùng ô hang (không có sàn băng trượt của gym), thang L ở tầng trên / U ở tầng dưới nối từng cặp
  for (const id of FLOORS) {
    const m = MAPS[id];
    assert.equal(m.caveTheme, 'ice', `${id}: phải là hang băng`);
    assert.equal(m.place, 'cave3');
    assert.ok(m.rows.every((r) => /^[#.oCLUw]+$/.test(r)), `${id}: ký tự lạ`); // w: nước ngầm (hồ băng)
    for (const w of m.warps.filter((ww) => FLOORS.includes(ww.to))) {
      const down = FLOORS.indexOf(w.to) > FLOORS.indexOf(id);
      assert.equal(m.tileAt(w.x, w.y), down ? 'L' : 'U', `${id} (${w.x},${w.y}): thang sai loại`);
      const back = MAPS[w.to].warps.find((b) => b.to === id && Math.abs(b.x - w.tx) + Math.abs(b.y - w.ty) <= 1);
      assert.ok(back, `${w.to}: thiếu thang quay về ${id}`);
    }
  }
  // Hầm băng sâu chỉ có một thang lên: ngách cụt, vật phẩm hiếm
  const f3 = MAPS.cave3c;
  assert.equal(f3.warps.length, 1);
  assert.ok(f3.objects.some((o) => o.item === 'neverMeltIce') && f3.objects.some((o) => o.item === 'luckyEgg'));
  // Mọi vật phẩm tới nhặt được; tầng nào cũng có vật phẩm trong ngách (cách đường chính ít nhất 3 bước)
  const fromPath = walk(pathCells(dist, exitKey), { maps: FLOORS });
  for (const id of FLOORS) {
    const items = MAPS[id].objects.filter((o) => o.kind === 'item');
    // Món trên cồn / hốc đá giữa hồ băng (surf: true) chỉ lướt nước mới tới: kiểm tra ở tests/cave-water.test.js
    for (const o of items.filter((it) => !it.surf)) assert.ok(reachItem(dist, id, o) < Infinity, `${o.id} không tới nhặt được`);
    const nooks = items.filter((o) => reachItem(fromPath, id, o) >= 3);
    assert.ok(nooks.length >= 2, `${id}: chỉ ${nooks.length} vật phẩm trong ngách`);
  }
  // Nhà huấn luyện: 4 người, mỗi tầng trên có 2; Thạch, Tuệ (tầng 1) và Tuyết (tầng hầm) đứng chặn đường chính
  const count = (id) => TRAINERS.filter((t) => t.map === id).length;
  assert.equal(count('cave3') + count('cave3b') + count('cave3c'), 4);
  assert.ok(count('cave3') >= 2 && count('cave3b') >= 2);
  for (const id of ['c3-ace1', 'c3-psychic', 'c3b-ace']) {
    const t = TRAINERS.find((tt) => tt.id === id);
    assert.ok(!walk(start, { maps: FLOORS, avoid: sightCells(t) }).has(exitKey), `${id}: đi vòng tránh được`);
  }
  // Càng xuống sâu Pokémon hoang dã càng mạnh
  assert.deepEqual(FLOORS.map((id) => MAPS[id].areas[0].table), ['cave3', 'cave3-deep', 'cave3-depths']);
  assert.ok(avgLevel('cave3') < avgLevel('cave3-deep') && avgLevel('cave3-deep') < avgLevel('cave3-depths'));
  // Cửa ra lên Cao nguyên Liên Minh và lối từ Cao nguyên về đúng cửa hang
  const fromLeague = MAPS.league.warps.find((w) => w.to === 'cave3');
  assert.equal(Math.abs(fromLeague.tx - exit.x) + Math.abs(fromLeague.ty - exit.y), 1);
});
