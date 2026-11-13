import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/data/map.js';
import { decorBlocks } from '../src/data/tiles.js';

// Bố cục bản đồ ngoài trời cho đẹp mắt: nhà không đè cây, ngọn thông không che đồ vật, ghế không quay mặt vào tường,
// gờ đất không đáp xuống đồ vật, cầu gỗ hai đầu nối bờ, đồ đạc trong nhà nằm trọn trong phòng

const outdoor = Object.values(MAPS).filter((m) => !m.indoor && !m.cave);
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

test('toà nhà đứng trên nền cỏ trống: không đè lên cây, đường, nước hay đồ trang trí', () => {
  for (const m of outdoor) {
    for (const b of m.buildings) {
      for (let y = b.y; y < b.y + b.h; y++) {
        for (let x = b.x; x < b.x + b.w; x++) assert.ok('.fh'.includes(m.tileAt(x, y)), `${m.id}: ${b.type} (${b.x},${b.y}) đè lên '${m.tileAt(x, y)}' tại (${x},${y})`);
      }
    }
  }
});

// Ô (x, y) nằm ngay trên đỉnh một khối cây thông 2x2: ngọn cây nhô lên che ô này
const underTip = (m, x, y) => (y + 1) % 2 === 0 && m.rows[y + 1]?.[x] === 'T' && m.rows[y + 1]?.[x & ~1] === 'T';

test('ngọn thông không che biển báo và đồ trang trí (khúc gỗ, gốc cây, ghế, thùng rác, đèn)', () => {
  for (const m of outdoor) {
    m.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if ('sXkEuQPl'.includes(ch)) assert.ok(!underTip(m, x, y), `${m.id}: '${ch}' tại (${x},${y}) bị ngọn thông phía dưới che`);
    }));
  }
});

test('ghế công viên quay ra chỗ thoáng: hai hàng trước mặt ghế không phải nhà, vách đá, hàng rào', () => {
  for (const m of outdoor) {
    for (const b of decorBlocks(m.rows).filter((d) => d.ch === 'E')) {
      for (const dy of [1, 2]) {
        for (const dx of [0, 1]) {
          const [x, y] = [b.x + dx, b.y + dy];
          assert.ok(!m.buildingAt(x, y) && !'RH'.includes(m.tileAt(x, y)), `${m.id}: ghế (${b.x},${b.y}) quay mặt vào '${m.tileAt(x, y)}' tại (${x},${y})`);
        }
      }
    }
  }
});

test('gờ đất không đáp xuống đồ trang trí, biển báo hay cây tán tròn', () => {
  for (const m of outdoor) {
    m.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const dir = m.tiles[ch]?.ledge;
      if (!dir) return;
      const [dx, dy] = DIRS[dir];
      const land = m.tileAt(x + dx, y + dy);
      assert.ok(!'XEukQPeOYs'.includes(land) && !m.signAt(x + dx, y + dy), `${m.id}: gờ (${x},${y}) đáp xuống '${land}'`);
    }));
  }
});

test('cầu gỗ: mỗi nhịp cầu bắc qua nước, hai đầu nối bờ đi được (bến câu: một đầu nối bờ, đầu kia chìa ra mặt nước)', () => {
  for (const m of outdoor) {
    const seen = new Set();
    m.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'b' || seen.has(`${x},${y}`)) return;
      // Chiều cầu: đầu trên / dưới cột cầu giáp nước thì cầu đi ngang (giống gfx/world.js)
      const end = (sx, sy, dx, dy) => {
        let [cx, cy] = [sx, sy];
        while (m.tileAt(cx, cy) === 'b') [cx, cy] = [cx + dx, cy + dy];
        return [cx, cy];
      };
      const across = [end(x, y, 0, -1), end(x, y, 0, 1)].some(([cx, cy]) => m.tileAt(cx, cy) === 'w');
      const [dx, dy] = across ? [1, 0] : [0, 1];
      const a = end(x, y, -dx, -dy);
      const b = end(x, y, dx, dy);
      for (let [cx, cy] = [a[0] + dx, a[1] + dy]; cx !== b[0] || cy !== b[1]; [cx, cy] = [cx + dx, cy + dy]) seen.add(`${cx},${cy}`);
      const ends = [a, b].map(([cx, cy]) => (m.tileAt(cx, cy) === 'w' ? 'water' : m.isSolid(cx, cy) ? 'solid' : 'land'));
      assert.ok(ends.includes('land') && !ends.includes('solid'), `${m.id}: cầu tại (${x},${y}) hai đầu ${ends.join(' / ')}`);
    }));
  }
});

test('đồ trang trí cao (đèn đường, cây tán tròn, cây hoa anh đào) không vẽ đè lên tường nhà', () => {
  // Khung hình (điểm ảnh) phần nhô lên của từng món, khớp với gfx/decor.js: đèn cao 42px, cây tán tròn chồm lên 1 ô,
  // tán hoa anh đào rộng ~60px (bỏ phần mép thưa ở hai bên)
  for (const m of outdoor) {
    const boxes = [];
    m.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === 'Q') boxes.push([ch, x, y, x * 16 + 1, (y + 1) * 16 - 42, x * 16 + 15, y * 16]);
      if (ch === 'Y') boxes.push([ch, x, y, x * 16 - 16, (y + 1) * 16 - 58, x * 16 + 32, (y + 1) * 16 - 16]);
    }));
    for (const b of decorBlocks(m.rows).filter((d) => d.ch === 'O')) boxes.push(['O', b.x, b.y, b.x * 16 + 2, b.y * 16 - 16, b.x * 16 + 30, b.y * 16]);
    for (const [ch, x, y, x0, y0, x1, y1] of boxes) {
      for (const b of m.buildings) {
        const ox = Math.min(x1, (b.x + b.w) * 16) - Math.max(x0, b.x * 16);
        const oy = Math.min(y1, (b.y + b.h) * 16) - Math.max(y0, b.y * 16);
        assert.ok(ox <= 0 || oy <= 0, `${m.id}: '${ch}' tại (${x},${y}) vẽ đè lên ${b.type} (${b.x},${b.y})`);
      }
    }
  }
});

test('thảm trong nhà nằm trọn trên sàn trong bản đồ', () => {
  for (const m of Object.values(MAPS).filter((mm) => mm.indoor)) {
    for (const [x1, y1, x2, y2] of m.rugs ?? []) {
      assert.ok(x1 >= 0 && y1 >= 0 && x2 < m.width && y2 < m.height && x1 <= x2 && y1 <= y2, `${m.id}: thảm ra ngoài phòng`);
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) assert.notEqual(m.tileAt(x, y), '#', `${m.id}: thảm đè tường (${x},${y})`);
    }
  }
});
