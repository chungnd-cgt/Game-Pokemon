import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, SPAWN } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { STORY_NPCS } from '../src/story/chapter1.js';

// Nội thất nhà ở (giường, cây cảnh, TV, thảm...): bố trí hợp lý, không chắn lối đi

const homes = Object.values(MAPS).filter((m) => m.indoor && m.theme === 'home');
const PEOPLE = [...NPCS, ...TRAINERS, ...STORY_NPCS];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const cells = (m, ch) => m.rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === ch ? [[x, y]] : [])));
const wall = (m, x, y) => m.tileAt(x, y) === '#';

// Các ô đi tới được từ lối vào (thảm cửa / cầu thang / chỗ đứng khi vào nhà)
function reachable(m) {
  const starts = [...cells(m, 'E'), ...(m.warps ?? []).map((w) => [w.x, w.y]), ...(m.entry ? [[m.entry.x, m.entry.y]] : [])];
  const seen = new Set();
  const queue = starts.flatMap(([x, y]) => [[x, y], ...DIRS.map(([dx, dy]) => [x + dx, y + dy])]).filter(([x, y]) => !m.isSolid(x, y));
  while (queue.length) {
    const [x, y] = queue.shift();
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const [dx, dy] of DIRS) if (!m.isSolid(x + dx, y + dy)) queue.push([x + dx, y + dy]);
  }
  return seen;
}

test('nhà ở: giường 1 ô ngang x 2 ô dọc, đầu giường sát tường', () => {
  for (const m of homes) {
    for (const [x, y] of cells(m, 'B')) {
      if (m.tileAt(x, y - 1) === 'B') continue;
      assert.ok(wall(m, x, y - 1), `${m.id} (${x},${y}): đầu giường phải sát tường`);
      assert.equal(m.tileAt(x, y + 1), 'B', `${m.id} (${x},${y}): giường dài 2 ô`);
      assert.notEqual(m.tileAt(x, y + 2), 'B', `${m.id} (${x},${y}): giường chỉ dài 2 ô`);
    }
  }
  assert.equal(MAPS[SPAWN.map].tileAt(SPAWN.x - 1, SPAWN.y), 'B', 'thức dậy cạnh giường');
});

test('nhà ở: mọi chỗ trống đều đi tới được, đồ đạc có lời mô tả và NPC đều đứng tới cạnh được', () => {
  for (const m of homes) {
    const seen = reachable(m);
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) if (!m.isSolid(x, y)) assert.ok(seen.has(`${x},${y}`), `${m.id} (${x},${y}): ô trống bị đồ đạc chắn mất`);
    }
    for (const key of Object.keys(m.signs)) {
      const [x, y] = key.split(',').map(Number);
      assert.ok(m.isSolid(x, y), `${m.id} (${key}): lời mô tả không nằm trên đồ đạc`);
      // đồ nhiều ô (giường, TV): đứng cạnh một ô bất kỳ của món đó là được
      const piece = [[x, y], ...DIRS.map(([dx, dy]) => [x + dx, y + dy]).filter(([px, py]) => m.tileAt(px, py) === m.tileAt(x, y))];
      assert.ok(piece.some(([px, py]) => DIRS.some(([dx, dy]) => seen.has(`${px + dx},${py + dy}`))), `${m.id} (${key}): không đứng cạnh đồ đạc được`);
    }
    for (const n of PEOPLE.filter((p) => p.map === m.id)) {
      assert.ok(!m.isSolid(n.x, n.y) || m.info(n.x, n.y).sofa, `${m.id}: ${n.id} đứng trên đồ đạc`);
      assert.ok(DIRS.some(([dx, dy]) => seen.has(`${n.x + dx},${n.y + dy}`)), `${m.id}: không tới nói chuyện với ${n.id} được`);
    }
  }
});

test('nhà ở: TV nằm giữa trên tường sau, thẳng hàng với thảm / bàn phía trước', () => {
  for (const m of homes) {
    const tv = cells(m, 'V');
    if (!tv.length) continue;
    assert.ok(tv.every(([x, y]) => wall(m, x, y - 1)), `${m.id}: TV phải sát tường`);
    const tvMid = (Math.min(...tv.map(([x]) => x)) + Math.max(...tv.map(([x]) => x))) / 2;
    const table = cells(m, 't');
    if (table.length) {
      const mid = (Math.min(...table.map(([x]) => x)) + Math.max(...table.map(([x]) => x))) / 2;
      assert.equal(mid, tvMid, `${m.id}: bàn lệch so với TV`);
    }
    for (const [x1, y1, x2, y2] of m.rugs ?? []) {
      assert.ok(Math.abs((x1 + x2) / 2 - tvMid) <= 0.5, `${m.id}: thảm lệch so với TV`);
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) assert.ok(!wall(m, x, y), `${m.id}: thảm đè lên tường`);
    }
  }
});
