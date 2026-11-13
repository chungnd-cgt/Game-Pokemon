import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { BLOSSOM_CANOPY, DECOR_BLOCKS, DECOR_CHARS, OUTDOOR_TILES, decorBlocks, lanternGarlands } from '../src/data/tiles.js';
import { STORY_NPCS } from '../src/story/chapter1.js';

// Đồ trang trí ngoài trời (ghế, thùng rác, đèn đường, gốc cây, khúc gỗ, cây tán tròn, cây hoa anh đào, bồn hoa,
// bờ cây xén, sân đất): đủ khối, không chắn lối đi / cửa / NPC / vật phẩm, bản đồ vẫn liền mạch như khi chưa trang trí

const outdoor = Object.values(MAPS).filter((m) => !m.indoor && !m.cave);
const PEOPLE = [...NPCS, ...TRAINERS, ...STORY_NPCS];
const SOLID_DECOR = [...DECOR_CHARS].filter((ch) => OUTDOOR_TILES[ch].solid);
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const cells = (m, chars) => m.rows.flatMap((r, y) => [...r].flatMap((ch, x) => (chars.includes(ch) ? [[x, y, ch]] : [])));

test('đồ trang trí: ký tự có trong bảng ô ngoài trời, mỗi loại đều được dùng', () => {
  for (const ch of DECOR_CHARS) {
    assert.ok(OUTDOOR_TILES[ch], `thiếu ô ${ch}`);
    assert.ok(outdoor.some((m) => m.rows.some((r) => r.includes(ch))), `chưa bản đồ nào dùng ${ch}`);
  }
  assert.equal(OUTDOOR_TILES.a.solid, undefined, 'sân đất đi được');
  assert.equal(OUTDOOR_TILES.a.encounter, undefined, 'sân đất không có Pokémon hoang dã');
});

test('đồ trang trí nhiều ô: đủ khối, nằm trọn trong bản đồ', () => {
  for (const m of outdoor) {
    const blocks = decorBlocks(m.rows);
    for (const b of blocks) {
      for (let j = 0; j < b.h; j++) {
        for (let i = 0; i < b.w; i++) assert.equal(m.rows[b.y + j]?.[b.x + i], b.ch, `${m.id}: khối ${b.ch} tại (${b.x},${b.y}) thiếu ô`);
      }
    }
    for (const ch of Object.keys(DECOR_BLOCKS)) {
      const [w, h] = DECOR_BLOCKS[ch];
      assert.equal(cells(m, ch).length, blocks.filter((b) => b.ch === ch).length * w * h, `${m.id}: khối ${ch} lệch`);
    }
    // Cây hoa anh đào: tán 3x3 phía trên gốc nằm trong bản đồ, dưới tán là ô cỏ / đất trống (không nhà, không đồ cản)
    for (const [x, y] of cells(m, 'Y')) {
      for (let dy = BLOSSOM_CANOPY.y0; dy <= BLOSSOM_CANOPY.y1; dy++) {
        for (let dx = BLOSSOM_CANOPY.x0; dx <= BLOSSOM_CANOPY.x1; dx++) {
          const [cx, cy] = [x + dx, y + dy];
          assert.ok(cx >= 0 && cy >= 0 && cx < m.width && cy < m.height, `${m.id}: tán cây hoa (${x},${y}) ra ngoài bản đồ`);
          assert.ok('.afh'.includes(m.rows[cy][cx]) && !m.buildingAt(cx, cy), `${m.id}: dưới tán cây hoa (${x},${y}) có ${m.rows[cy][cx]} tại (${cx},${cy})`);
          assert.ok(!m.warpAt(cx, cy) && !m.objectAt(cx, cy) && !m.signAt(cx, cy), `${m.id}: dưới tán cây hoa (${x},${y}) che ô (${cx},${cy})`);
          assert.ok(!PEOPLE.some((n) => n.map === m.id && n.x === cx && n.y === cy), `${m.id}: NPC đứng dưới tán cây hoa (${cx},${cy})`);
        }
      }
    }
  }
});

test('đồ trang trí không đè lên ô chuyển bản đồ, trước cửa, biển báo, NPC, vật phẩm, cây quả, tầm nhìn nhà huấn luyện', () => {
  for (const m of outdoor) {
    const solid = new Set(cells(m, SOLID_DECOR).map(([x, y]) => `${x},${y}`));
    const decor = new Set(cells(m, DECOR_CHARS).map(([x, y]) => `${x},${y}`));
    const free = (x, y, why) => assert.ok(!solid.has(`${x},${y}`), `${m.id}: đồ trang trí chắn ${why} (${x},${y})`);
    for (const w of m.warps ?? []) assert.ok(!decor.has(`${w.x},${w.y}`), `${m.id}: đồ trang trí trên ô chuyển bản đồ (${w.x},${w.y})`);
    for (const b of m.buildings) free(b.door.x, b.door.y + 1, 'trước cửa');
    for (const key of Object.keys(m.signs)) {
      const [x, y] = key.split(',').map(Number);
      assert.ok(!decor.has(key), `${m.id}: đồ trang trí đè biển báo (${key})`);
      free(x, y + 1, 'trước biển báo');
    }
    for (const o of m.objects) {
      free(o.x, o.y, o.id ?? o.kind);
      if (o.kind === 'berry') for (const [dx, dy] of [[0, 1], [0, -1]]) free(o.x + dx, o.y + dy, `chỗ hái ${o.id}`);
    }
    for (const n of PEOPLE.filter((p) => p.map === m.id)) {
      const r = n.wander ?? 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) free(n.x + dx, n.y + dy, `chỗ đứng của ${n.id}`);
      for (let i = 1; i <= (n.sight ?? 0); i++) free(n.x + DIRS[n.facing][0] * i, n.y + DIRS[n.facing][1] * i, `tầm nhìn của ${n.id}`);
    }
  }
});

// Các ô đi tới được từ mọi lối chuyển bản đồ và cửa nhà (đi bộ, nhảy gờ đất). plain: coi đồ trang trí là cỏ thường
function reachable(m, plain) {
  const tile = (x, y) => {
    const ch = m.tileAt(x, y);
    return plain && DECOR_CHARS.includes(ch) ? '.' : ch;
  };
  const solid = (x, y) => x < 0 || y < 0 || x >= m.width || y >= m.height || Boolean(m.tiles[tile(x, y)].solid || m.buildingAt(x, y));
  const starts = [...(m.warps ?? []).map((w) => [w.x, w.y]), ...m.buildings.map((b) => [b.door.x, b.door.y + 1])];
  const seen = new Set();
  const queue = starts.filter(([x, y]) => !solid(x, y));
  while (queue.length) {
    const [x, y] = queue.shift();
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
      const [nx, ny] = [x + dx, y + dy];
      if (!solid(nx, ny)) queue.push([nx, ny]);
      else if (m.tiles[tile(nx, ny)]?.ledge === dir && !solid(nx + dx, ny + dy)) queue.push([nx + dx, ny + dy]);
    }
  }
  return seen;
}

test('đồ trang trí không chia cắt bản đồ: mọi ô tới được khi chưa trang trí vẫn tới được', () => {
  for (const m of outdoor) {
    const before = reachable(m, true);
    const after = reachable(m, false);
    const decor = new Set(cells(m, SOLID_DECOR).map(([x, y]) => `${x},${y}`));
    const lost = [...before].filter((k) => !after.has(k) && !decor.has(k));
    assert.deepEqual(lost, [], `${m.id}: đồ trang trí chặn mất các ô ${lost.join(' ')}`);
  }
});

test('đèn đường đôi và cột đèn lồng (hai đèn treo) sáng ban đêm; Thành phố Đèn Lồng có dây đèn lồng giăng ngang phố', () => {
  for (const m of outdoor) {
    const lamps = cells(m, 'Q');
    const garland = m.lanterns.filter((l) => l.small).length;
    assert.equal(m.lanterns.length, cells(m, 'l').length * 2 + lamps.length * 2 + garland, `${m.id}: thiếu quầng sáng đèn đường / đèn lồng`);
    if (!m.lanternGarlands) assert.equal(garland, 0, `${m.id}: có dây đèn mà không khai báo lanternGarlands`);
  }
  const town4 = MAPS.town4;
  const strings = lanternGarlands(town4.rows, town4.buildings);
  assert.ok(strings.length >= 6, 'phố Đèn Lồng phải có nhiều dây đèn');
  assert.ok(town4.lanterns.filter((l) => l.small).length >= 25);
  // Đèn lồng treo cao trên cột, không nằm sát đất
  for (const l of town4.lanterns.filter((x) => !x.small)) assert.ok(l.y % 1 !== 0, 'đèn lồng phải treo trên cột');
});
