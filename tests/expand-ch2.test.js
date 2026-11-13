import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';

const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// BFS có tính nhảy gờ (bước vào ô gờ đúng chiều thì đáp xuống ô bên kia), trả về số bước tới từng ô
function dist(m, sx, sy) {
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
      if (m.isSolid(nx, ny) || out.has(`${nx},${ny}`)) continue;
      out.set(`${nx},${ny}`, d + 1);
      queue.push([nx, ny]);
    }
  }
  return out;
}

// Ô đến khi đi từ bản đồ `from` sang `m` (chỗ đứng đầu tiên trên m)
const arrival = (from, m) => {
  const w = MAPS[from].warps.find((ww) => ww.to === m.id);
  return [w.tx, w.ty];
};
const stepsTo = (m, [sx, sy], to) => {
  const d = dist(m, sx, sy);
  const ds = m.warps.filter((w) => w.to === to).map((w) => d.get(`${w.x},${w.y}`)).filter((v) => v !== undefined);
  return ds.length ? Math.min(...ds) : Infinity;
};
const cells = (m, ch) => m.rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === ch ? [[x, y]] : [])));
// Vật phẩm nằm ở nhánh rẽ: đi vòng qua vật phẩm dài hơn hẳn đường chính
function offPath(m, start, to, item) {
  const fromStart = dist(m, ...start);
  const via = Math.min(...Object.values(D).map(([dx, dy]) => {
    const [x, y] = [item.x + dx, item.y + dy];
    return fromStart.has(`${x},${y}`) ? fromStart.get(`${x},${y}`) + stepsTo(m, [x, y], to) : Infinity;
  }));
  return via < Infinity && via > stepsTo(m, start, to) + 8;
}

for (const [id, from, to] of [['route2', 'route1', 'town1'], ['route3', 'cave1', 'village1']]) {
  test(`${id}: rộng gấp đôi bản cũ, đường chính từ ${from} tới ${to} quanh co (>= 60 bước)`, () => {
    const m = MAPS[id];
    assert.ok(m.width * m.height >= 2 * 30 * 20, `${id}: ${m.width}x${m.height}`);
    const steps = stepsTo(m, arrival(from, m), to);
    assert.ok(steps >= 60 && steps < Infinity, `${id}: đường chính ${steps} bước`);
    // Đi ngược chiều cũng tới được (không bị gờ đất nhốt)
    assert.ok(stepsTo(m, arrival(to, m), from) < Infinity, `${id}: không quay về ${from} được`);
    // Nhánh cụt có vật phẩm
    const items = m.objects.filter((o) => o.kind === 'item');
    const side = items.filter((o) => m.tileAt(o.x, o.y) !== 'w' && m.tileAt(o.x, o.y) !== 'd' && offPath(m, arrival(from, m), to, o));
    assert.ok(side.length >= 3, `${id}: chỉ ${side.length} vật phẩm ở nhánh rẽ`);
    // Vật phẩm trên cồn cát phải lướt nước mới lấy được, ao / hồ có bảng câu cá
    assert.ok(items.some((o) => m.tileAt(o.x, o.y) === 'd'), `${id}: không có vật phẩm trên cồn cát`);
    assert.ok(m.water && ENCOUNTERS[m.water.surf] && ENCOUNTERS[m.water.oldRod], `${id}: thiếu bảng lướt nước / câu cá`);
    // Có cỏ rậm
    assert.ok(cells(m, 'G').length >= 16, `${id}: thiếu bụi cỏ rậm`);
    // Có người chỉ đường
    assert.ok(NPCS.filter((n) => n.map === id && n.lines?.length).length >= 2, `${id}: thiếu người chỉ đường`);
  });

  test(`${id}: gờ đất là đường tắt một chiều`, () => {
    const m = MAPS[id];
    const ledges = m.rows.flatMap((r, y) => [...r].flatMap((c, x) => (m.info(x, y).ledge ? [[x, y, m.info(x, y).ledge]] : [])));
    assert.ok(ledges.length >= 4, `${id}: chỉ ${ledges.length} ô gờ`);
    for (const [x, y, dir] of ledges) {
      const [dx, dy] = D[dir];
      assert.ok(!m.isSolid(x + dx, y + dy), `${id} (${x},${y}): nhảy xuống bị chặn`);
      assert.ok(!m.isSolid(x - dx, y - dy), `${id} (${x},${y}): không có chỗ đứng trước gờ`);
    }
    // Có gờ đất mà không đi bộ vòng lại được tới chỗ đứng trên gờ (nhảy xuống rồi thì phải đi đường dài)
    const shortcut = ledges.some(([x, y, dir]) => {
      const [dx, dy] = D[dir];
      const up = dist(m, x + dx, y + dy).get(`${x - dx},${y - dy}`);
      return up === undefined || up >= 20;
    });
    assert.ok(shortcut, `${id}: gờ đất không tắt được đường nào`);
  });
}

test('Tuyến đường 2: vẫn là tuyến làm quen (2 nhà huấn luyện), vào từ mép nam, ra mép đông sang Lục Bình', () => {
  const m = MAPS.route2;
  assert.equal(TRAINERS.filter((t) => t.map === 'route2').length, 2);
  assert.ok(m.warps.filter((w) => w.to === 'route1').every((w) => w.y === m.height - 1));
  assert.ok(m.warps.filter((w) => w.to === 'town1').every((w) => w.x === m.width - 1));
  // Từ lối ra Lục Bình nhảy gờ xuống là về Pallet nhanh hơn hẳn đường đi lên
  const forward = stepsTo(m, arrival('route1', m), 'town1');
  const back = stepsTo(m, arrival('town1', m), 'route1');
  assert.ok(back < forward - 15, `đường tắt về Pallet (${back} / ${forward} bước)`);
  // Có ao nhỏ và cồn cát
  assert.ok(cells(m, 'w').length >= 30 && cells(m, 'd').length >= 2);
  assert.ok(m.objects.filter((o) => o.kind === 'item').length >= 4);
  assert.ok(m.objects.some((o) => o.kind === 'berry'));
});

test('Tuyến đường 3: tuyến núi 3-4 nhà huấn luyện, hồ trên núi lướt nước + câu cá, nối cửa hang với Làng Chân Đồi', () => {
  const m = MAPS.route3;
  const trainers = TRAINERS.filter((t) => t.map === 'route3');
  assert.ok(trainers.length >= 3 && trainers.length <= 4, `${trainers.length} nhà huấn luyện`);
  assert.ok(trainers.filter((t) => !t.swim).length >= 3, 'ít nhất 3 nhà huấn luyện trên bờ');
  assert.equal(m.water.surf, 'route3-surf');
  assert.ok(cells(m, 'w').length >= 80, 'hồ đủ rộng');
  assert.ok(cells(m, 'R').length >= 40, 'có vách đá núi');
  // Cửa hang trên vách đá, đi ra là tới ô ngay dưới cửa
  const door = m.warps.find((w) => w.to === 'cave1');
  assert.equal(m.tileAt(door.x, door.y), 'C');
  const out = MAPS.cave1.warps.find((w) => w.to === 'route3');
  assert.deepEqual([out.tx, out.ty], [door.x, door.y + 1]);
  // Lối sang làng ở mép đông
  assert.ok(m.warps.filter((w) => w.to === 'village1').every((w) => w.x === m.width - 1));
  // Kình ngư bơi dưới hồ
  for (const t of trainers.filter((tt) => tt.swim)) assert.equal(m.tileAt(t.x, t.y), 'w');
  assert.ok(m.objects.filter((o) => o.kind === 'item').length >= 5);
});
