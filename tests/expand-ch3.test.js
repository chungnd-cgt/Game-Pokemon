import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';

// Mở rộng bản đồ phần ch3: Tuyến đường 4 (Đồng Gió Lúa), 5 (Bãi Đá Trạm Điện), 6 (Ven Hồ Gương)

const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const people = (mapId) => [...NPCS, ...TRAINERS].filter((n) => n.map === mapId);

// BFS trên một bản đồ: nhảy gờ một chiều (bước vào ô gờ đúng chiều thì đáp xuống ô bên kia), người đứng chắn đường.
// surf: được lướt trên mặt nước. Trả về Map "x,y" -> số bước và Map "x,y" -> ô trước đó
function walk(m, sx, sy, { surf = false } = {}) {
  const who = people(m.id);
  const open = (x, y) => x >= 0 && y >= 0 && x < m.width && y < m.height
    && (!m.isSolid(x, y) || (surf && m.tileAt(x, y) === 'w')) && !who.some((n) => n.x === x && n.y === y);
  const dist = new Map([[`${sx},${sy}`, 0]]);
  const prev = new Map();
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const d = dist.get(`${x},${y}`);
    for (const [dir, [dx, dy]] of Object.entries(D)) {
      let [nx, ny] = [x + dx, y + dy];
      if (m.info(nx, ny).ledge === dir) [nx, ny] = [nx + dx, ny + dy];
      const k = `${nx},${ny}`;
      if (!open(nx, ny) || dist.has(k)) continue;
      dist.set(k, d + 1);
      prev.set(k, `${x},${y}`);
      queue.push([nx, ny]);
    }
  }
  return { dist, prev };
}

// Lối vào / lối ra của tuyến: ô đứng ngay cạnh ô chuyển bản đồ sang bản đồ đó
function gate(m, to) {
  const w = m.warps.find((ww) => ww.to === to);
  const [dx, dy] = D[{ left: 'right', right: 'left', up: 'down', down: 'up' }[w.facing]];
  return { x: w.x + dx, y: w.y + dy, warp: w };
}

// Đường chính ngắn nhất từ lối vào tới lối ra (danh sách ô "x,y")
function mainPath(m, from, to) {
  const { dist, prev } = walk(m, from.x, from.y);
  const end = `${to.x},${to.y}`;
  assert.ok(dist.has(end), `${m.id}: không đi được từ lối vào tới lối ra`);
  const cells = [end];
  while (prev.has(cells[0])) cells.unshift(prev.get(cells[0]));
  return { steps: dist.get(end), cells };
}

// Khoảng cách (số bước) từ mỗi ô tới đường chính: vật phẩm ở xa đường chính là nằm trong ngách / nhánh rẽ
function branchDepth(m, cells) {
  const dist = new Map();
  const queue = cells.map((k) => k.split(',').map(Number));
  for (const k of cells) dist.set(k, 0);
  const who = people(m.id);
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of Object.values(D)) {
      const [nx, ny] = [x + dx, y + dy];
      const k = `${nx},${ny}`;
      if (dist.has(k) || nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || m.isSolid(nx, ny) || who.some((n) => n.x === nx && n.y === ny)) continue;
      dist.set(k, dist.get(`${x},${y}`) + 1);
      queue.push([nx, ny]);
    }
  }
  return dist;
}

const ROUTES = {
  route4: { from: 'town2', to: 'village2' },
  route5: { from: 'town3', to: 'village3' },
  route6: { from: 'town4', to: 'village4' },
};

test('Tuyến đường 4-6: gấp đôi diện tích cũ, đường chính quanh co, 3-4 nhà huấn luyện, ngách cụt có vật phẩm', () => {
  for (const [id, { from, to }] of Object.entries(ROUTES)) {
    const m = MAPS[id];
    assert.ok(m.width * m.height >= 1150, `${id}: ${m.width}x${m.height} chưa đủ rộng`);
    const entry = gate(m, from);
    const exit = gate(m, to);
    const { steps, cells } = mainPath(m, entry, exit);
    assert.ok(steps >= 60, `${id}: đường chính chỉ ${steps} bước`);
    // Quanh co: đường chính dài hơn hẳn khoảng cách đường chim bay
    const straight = Math.abs(entry.x - exit.x) + Math.abs(entry.y - exit.y);
    assert.ok(steps >= straight * 1.5, `${id}: đường chính gần như đi thẳng (${steps} / ${straight})`);
    // Nhà huấn luyện: 3-4, đứng trên ô đi được, và đa số nhìn thẳng ra đường chính
    const trainers = TRAINERS.filter((t) => t.map === id);
    assert.ok(trainers.length >= 3 && trainers.length <= 4, `${id}: ${trainers.length} nhà huấn luyện`);
    const onPath = new Set(cells);
    const watching = trainers.filter((t) => {
      const [dx, dy] = D[t.facing];
      for (let i = 1; i <= t.sight; i++) if (onPath.has(`${t.x + dx * i},${t.y + dy * i}`)) return true;
      return false;
    });
    assert.ok(watching.length >= 2, `${id}: nhà huấn luyện không chặn đường chính`);
    // Ngách cụt: vật phẩm cách đường chính từ 4 bước trở lên (tính cả đồ nhiệm vụ xe đạp)
    const depth = branchDepth(m, cells);
    const nook = m.objects.filter((o) => o.kind === 'item' && (depth.get(`${o.x},${o.y}`) ?? 0) >= 4);
    assert.ok(nook.length >= 2, `${id}: chỉ ${nook.length} vật phẩm trong ngách`);
    // Phụ tùng xe đạp vẫn nằm trên tuyến này, đi bộ tới nhặt được
    const part = m.objects.find((o) => o.quest === 'bike');
    assert.ok(part, `${id}: mất phụ tùng xe đạp`);
    const { dist } = walk(m, entry.x, entry.y);
    assert.ok(Object.values(D).some(([dx, dy]) => dist.has(`${part.x + dx},${part.y + dy}`)), `${id}: không tới được ${part.id}`);
    // Lối vào / ra nối đúng hai chiều với bản đồ bên cạnh
    for (const other of [from, to]) {
      const back = MAPS[other].warps.filter((w) => w.to === id);
      assert.ok(back.length && back.every((w) => m.warpAt(w.tx, w.ty) === null && !m.isSolid(w.tx, w.ty)), `${other} -> ${id}`);
    }
  }
});

test('Tuyến đường 4: đồng ruộng có rào, đi trên bờ ruộng ngoằn ngoèo, bãi chăn ngựa, bãi cỏ rậm là ngách cụt', () => {
  const m = MAPS.route4;
  const count = (ch) => m.rows.join('').split(ch).length - 1;
  assert.ok(count('p') >= 150, 'ruộng lúa');
  assert.ok(count('H') >= 80, 'hàng rào');
  assert.equal(count('v') + count('<') + count('>'), 0, 'đồng bằng, không có gờ đất');
  const { cells } = mainPath(m, gate(m, 'town2'), gate(m, 'village2'));
  // Bờ ruộng: đoạn đường đất kẹp giữa ruộng lúa nằm trên đường chính
  const dike = cells.filter((k) => {
    const [x, y] = k.split(',').map(Number);
    return m.tileAt(x, y) === '=' && Object.values(D).filter(([dx, dy]) => m.tileAt(x + dx, y + dy) === 'p').length >= 2;
  });
  assert.ok(dike.length >= 20, `chỉ ${dike.length} ô bờ ruộng trên đường chính`);
  // Ponyta trong bãi chăn có rào, vào được qua cổng
  const pony = NPCS.find((n) => n.id === 'r4-ponyta');
  assert.equal(pony.map, 'route4');
  const { dist } = walk(m, gate(m, 'town2').x, gate(m, 'town2').y);
  assert.ok(Object.values(D).some(([dx, dy]) => dist.has(`${pony.x + dx},${pony.y + dy}`)), 'tới được chỗ Ponyta');
  assert.ok(m.areas.some((a) => a.table === 'route4-deep'));
});

test('Tuyến đường 5: bãi đá bậc thang viền gờ, nhảy gờ về nhanh; trạm biến áp có kỹ sư canh; bãi đá cao có Pokémon hệ Đá', () => {
  const m = MAPS.route5;
  const count = (ch) => m.rows.join('').split(ch).length - 1;
  assert.ok(count('v') >= 50, 'hai dãy gờ đá');
  assert.ok(count('R') >= 40, 'bãi đá');
  const entry = gate(m, 'town3');
  const exit = gate(m, 'village3');
  const forward = mainPath(m, entry, exit).steps;
  // Gờ là đường tắt một chiều: đi về Lúa Vàng nhanh hơn hẳn đường lên
  const back = walk(m, exit.x, exit.y).dist.get(`${entry.x},${entry.y}`);
  assert.ok(back <= forward - 15, `đường tắt về (${back} / ${forward} bước)`);
  // Trạm biến áp: rào bao quanh, kỹ sư nhìn ra cổng, trong trạm có vật phẩm
  const engineer = TRAINERS.find((t) => t.id === 'r5-engineer');
  assert.equal(engineer.map, 'route5');
  const magnet = m.objects.find((o) => o.id === 'r5-magnet');
  const { dist } = walk(m, entry.x, entry.y);
  assert.ok(Object.values(D).some(([dx, dy]) => dist.has(`${magnet.x + dx},${magnet.y + dy}`)), 'vào được trạm biến áp');
  // Bãi đá cao: khu riêng có bảng Pokémon hệ Đá, tới được từ đường chính
  const rocks = m.areas.find((a) => a.table === 'route5-rocks');
  assert.ok(rocks && ENCOUNTERS['route5-rocks'].some((e) => e.species === 'geodude'));
  const [x1, y1] = rocks.rect;
  assert.ok(dist.has(`${x1},${y1}`), 'tới được bãi đá cao');
});

test('Tuyến đường 6: hồ lớn, đi vòng qua cầu gỗ; cồn cát giữa hồ chỉ lướt nước mới tới được', () => {
  const m = MAPS.route6;
  const count = (ch) => m.rows.join('').split(ch).length - 1;
  assert.ok(count('w') >= 300, 'hồ lớn');
  const entry = gate(m, 'town4');
  const exit = gate(m, 'village4');
  const { cells } = mainPath(m, entry, exit);
  assert.ok(cells.some((k) => m.tileAt(...k.split(',').map(Number)) === 'b'), 'đường chính qua cầu gỗ');
  const foot = walk(m, entry.x, entry.y).dist;
  const swim = walk(m, entry.x, entry.y, { surf: true }).dist;
  const near = (dist, o) => Object.values(D).some(([dx, dy]) => dist.has(`${o.x + dx},${o.y + dy}`));
  const sand = m.objects.filter((o) => o.kind === 'item' && m.tileAt(o.x, o.y) === 'd');
  assert.ok(sand.length >= 2, 'vật phẩm trên cồn cát');
  for (const o of sand) {
    assert.ok(!near(foot, o) && !foot.has(`${o.x},${o.y}`), `${o.id}: đi bộ tới được`);
    assert.ok(near(swim, o), `${o.id}: lướt nước không tới được`);
  }
  // Kình ngư bơi dưới hồ, còn lại là nhà huấn luyện trên bờ
  const swimmer = TRAINERS.find((t) => t.id === 'r6-swim-water');
  assert.equal(m.tileAt(swimmer.x, swimmer.y), 'w');
  assert.ok(TRAINERS.filter((t) => t.map === 'route6' && !t.swim).length >= 3);
});

test('Tuyến đường 4-6 mỗi tuyến một vẻ: ruộng rào / bậc đá có gờ / hồ nước', () => {
  const sig = (id) => {
    const s = MAPS[id].rows.join('');
    const n = (ch) => s.split(ch).length - 1;
    return { paddy: n('p'), ledge: n('v') + n('<') + n('>'), rock: n('R'), water: n('w') };
  };
  const [r4, r5, r6] = ['route4', 'route5', 'route6'].map(sig);
  assert.ok(r4.paddy > 100 && r5.paddy === 0 && r6.paddy === 0);
  assert.ok(r5.ledge > 0 && r4.ledge === 0 && r6.ledge === 0);
  assert.ok(r6.water > r4.water * 5 && r5.water === 0);
  assert.ok(r5.rock > r4.rock && r5.rock > r6.rock);
  // Bố cục không trùng nhau: kích thước hoặc vị trí lối vào khác nhau
  const shape = (id) => `${MAPS[id].width}x${MAPS[id].height}|${MAPS[id].warps.map((w) => `${w.x},${w.y}`).join(';')}`;
  assert.equal(new Set(['route4', 'route5', 'route6'].map(shape)).size, 3);
});
