import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';

// Mở rộng Tuyến đường 7 (Đồi Đất Sét), 8 (Hẻm Núi Đá), 9 (Rừng Tre ven suối)
const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// BFS có tính nhảy gờ một chiều (bước vào ô gờ đúng chiều thì đáp xuống ô bên kia); NPC đứng trên bản đồ là vật cản
function dist(m, sx, sy) {
  const people = new Set([...TRAINERS, ...NPCS].filter((n) => n.map === m.id).map((n) => `${n.x},${n.y}`));
  const solid = (x, y) => m.isSolid(x, y) || people.has(`${x},${y}`);
  const out = new Map([[`${sx},${sy}`, 0]]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const d = out.get(`${x},${y}`);
    for (const [dir, [dx, dy]] of Object.entries(D)) {
      let [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      if (m.info(nx, ny).ledge === dir) [nx, ny] = [nx + dx, ny + dy];
      else if (solid(nx, ny)) continue;
      if (solid(nx, ny) || out.has(`${nx},${ny}`)) continue;
      out.set(`${nx},${ny}`, d + 1);
      queue.push([nx, ny]);
    }
  }
  return out;
}

// Ô đứng ngay khi vào bản đồ từ bản đồ `from` (chỗ đến của warp bên kia)
const landing = (id, from) => {
  const w = MAPS[from].warps.find((x) => x.to === id);
  return [w.tx, w.ty];
};
const at = (map, [x, y]) => map.get(`${x},${y}`);

// Vật phẩm nằm trong nhánh rẽ: đi vòng qua vật phẩm dài hơn hẳn đường chính
function sideItems(m, start, end) {
  const from = dist(m, ...start);
  const main = at(from, end);
  return m.objects.filter((o) => o.kind === 'item').filter((o) => {
    const go = from.get(`${o.x},${o.y}`);
    const back = at(dist(m, o.x, o.y), end);
    return go !== undefined && back !== undefined && go + back >= main + 10;
  });
}

const ROUTES = {
  route7: { start: landing('route7', 'town5'), end: landing('route7', 'village5') },
  route8: { start: landing('route8', 'town6'), end: landing('route8', 'village6') },
  route9: { start: landing('route9', 'town7'), end: landing('route9', 'cave2') },
};

test('Tuyến 7-9 mở rộng: rộng gấp đôi, đường chính quanh co, có nhánh cụt chứa đồ và 3-4 nhà huấn luyện', () => {
  for (const [id, { start, end }] of Object.entries(ROUTES)) {
    const m = MAPS[id];
    assert.ok(m.width * m.height >= 1200, `${id}: ${m.width}x${m.height} chưa gấp đôi 30x20`);
    const there = at(dist(m, ...start), end);
    assert.ok(there >= 60, `${id}: đường chính chỉ ${there} bước`);
    assert.ok(at(dist(m, ...end), start) !== undefined, `${id}: không đi ngược về được`);
    const side = sideItems(m, start, end);
    assert.ok(side.length >= 2, `${id}: chỉ ${side.length} vật phẩm trong nhánh rẽ`);
    const trainers = TRAINERS.filter((t) => t.map === id);
    assert.ok(trainers.length >= 3 && trainers.length <= 4, `${id}: ${trainers.length} nhà huấn luyện`);
    for (const t of trainers) {
      assert.ok(!m.isSolid(t.x, t.y) && !m.info(t.x, t.y).encounter, `${t.id} đứng trên ô cản / bụi cỏ`);
      assert.ok(D[t.facing], t.id);
    }
    // Mọi vật phẩm / cây quả trên đất liền đều tới được (đồ trên cồn cát giữa suối thì phải lướt nước)
    const reach = dist(m, ...start);
    for (const o of m.objects) {
      if (m.tileAt(o.x, o.y) === 'd') continue;
      const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reach.has(`${o.x + dx},${o.y + dy}`));
      assert.ok(near, `${id}: ${o.id} không tới được`);
    }
  }
});

test('Tuyến đường 7 Đồi Đất Sét: ruộng bậc thang ngăn bằng gờ, về Sông Nước nhảy gờ nhanh hơn; hố đất sét cỏ rậm', () => {
  const m = MAPS.route7;
  const { start, end } = ROUTES.route7;
  const ledges = m.rows.join('').split('').filter((c) => c === 'v').length;
  assert.ok(ledges >= 60, 'nhiều hàng gờ bậc thang');
  assert.ok(m.rows.join('').includes('p'), 'có ruộng');
  const there = at(dist(m, ...start), end);
  const back = at(dist(m, ...end), start);
  assert.ok(back < there - 25, `nhảy gờ về nhanh (${back} so với ${there})`);
  assert.ok(m.areas.some((a) => a.table === 'route7-deep') && m.areas.some((a) => a.table === 'route7-clay'));
  assert.ok(ENCOUNTERS['route7-clay'].length >= 3);
});

test('Tuyến đường 8 Hẻm Núi Đá: cao nguyên nhiều bậc gờ một chiều, đáy hẻm có người chặn ngang', () => {
  const m = MAPS.route8;
  const { start, end } = ROUTES.route8;
  const flat = m.rows.join('');
  assert.ok(flat.includes('>') && flat.includes('v'), 'gờ nhiều hướng');
  assert.equal(m.climate, 'sand');
  // Cao nguyên giữa hai khe: nhảy gờ (>) từ khe giữa sang, rồi chỉ nhảy tiếp xuống khe đông (về phía Lò Gốm) được
  const plateau = [24, 12];
  const fromEnd = dist(m, ...end);
  assert.ok(at(fromEnd, plateau) !== undefined, 'từ khe giữa nhảy gờ sang cao nguyên');
  assert.ok(at(dist(m, ...plateau), end) >= 60, 'từ cao nguyên không có đường tắt sang Bản Vách Đá');
  assert.ok(at(fromEnd, start) < at(dist(m, ...start), end) - 10, 'gờ là đường tắt về Lò Gốm');
  // Chị leo núi chặn đáy hẻm: hành lang 3 ô, chị đứng một ô và nhìn hết hai ô còn lại
  const climber = TRAINERS.find((t) => t.id === 'r8-climber');
  for (let i = 1; i <= climber.sight; i++) assert.ok(!m.isSolid(climber.x, climber.y + i));
  assert.ok(m.isSolid(climber.x, climber.y + climber.sight + 1), 'không lách qua được');
});

test('Tuyến đường 9 Rừng Tre: suối hai cầu gỗ, cửa Hang Sơn Động khớp hai chiều, cồn cát giữa suối chỉ lướt nước mới tới', () => {
  const m = MAPS.route9;
  const flat = m.rows.join('');
  assert.ok(flat.split('').filter((c) => c === 'b').length >= 16, 'hai cầu gỗ');
  for (const key of ['surf', 'oldRod', 'goodRod', 'superRod']) assert.ok(ENCOUNTERS[m.water[key]], key);
  const toCave = m.warps.find((w) => w.to === 'cave2');
  assert.equal(m.tileAt(toCave.x, toCave.y), 'C');
  const back = MAPS.cave2.warps.find((w) => w.to === 'route9');
  assert.deepEqual([back.tx, back.ty], [toCave.x, toCave.y + 1], 'ra khỏi hang đứng ngay trước cửa');
  assert.ok(MAPS.cave2.warpAt(toCave.tx, toCave.ty + 1)?.to === 'route9', 'vào hang đứng ngay trên cửa ra');
  // Bác Đá đứng cạnh cửa hang, nhìn thẳng vào ô trước cửa
  const hiker = TRAINERS.find((t) => t.id === 'r9-hiker');
  assert.deepEqual([hiker.x + D[hiker.facing][0], hiker.y + D[hiker.facing][1]], [back.tx, back.ty]);
  const island = m.objects.find((o) => o.id === 'r9-max-revive');
  assert.equal(m.tileAt(island.x, island.y), 'd');
  assert.ok(!dist(m, ...ROUTES.route9.start).has(`${island.x},${island.y}`), 'không đi bộ tới cồn cát được');
});
