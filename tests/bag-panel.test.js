import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAG_POCKETS, ITEMS, pocketOf } from '../src/data/items.js';
import { bagItems, matchesQuery, pocketCounts, searchKey } from '../src/ui/bagSearch.js';

const bag = { potion: 3, superPotion: 1, ball: 10, greatBall: 2, oranBerry: 4, bicycle: 1, rareCandy: 0 };
const count = (id) => bag[id] ?? 0;

test('túi đồ: tìm kiếm không phân biệt dấu, hoa / thường, mọi từ đều phải có', () => {
  assert.equal(searchKey('  Xe ĐẠP  '), 'xe dap');
  assert.ok(matchesQuery('Xe đạp', 'xe dap'));
  assert.ok(matchesQuery('Cần câu siêu', 'CAU sieu'));
  assert.ok(matchesQuery('Super Potion', 'pot'));
  assert.ok(!matchesQuery('Super Potion', 'pot ball'));
  assert.ok(matchesQuery('Poké Ball', 'poke'));
  assert.ok(matchesQuery('bất kỳ', ''));
});

test('túi đồ: không tìm thì chỉ hiện ngăn đang mở; có chữ tìm thì tìm trên mọi ngăn; đồ hết (0) không hiện', () => {
  const heal = BAG_POCKETS.findIndex((p) => p.id === 'item');
  assert.deepEqual(bagItems({ count, pocket: heal }), ['potion', 'superPotion']);
  const all = bagItems({ count, query: 'ball' });
  assert.deepEqual(all, ['ball', 'greatBall']);
  assert.deepEqual(bagItems({ count, query: 'xe' }), ['bicycle']);
  assert.ok(!bagItems({ count, query: 'candy' }).length);
  for (const id of bagItems({ count, pocket: heal })) assert.equal(pocketOf(id), 'item');
});

test('túi đồ: bộ lọc (vd trong trận) áp dụng cả khi tìm kiếm và khi đếm số món mỗi ngăn', () => {
  const allow = (id) => ['ball', 'heal'].includes(ITEMS[id].kind);
  assert.deepEqual(bagItems({ count, query: 'potion', allow }), ['potion', 'superPotion']);
  assert.deepEqual(bagItems({ count, query: 'xe', allow }), []);
  assert.deepEqual(bagItems({ count, query: 'ball', allow: (id) => ITEMS[id].kind === 'heal' }), []);
  const counts = pocketCounts({ count, allow });
  assert.equal(counts[BAG_POCKETS.findIndex((p) => p.id === 'held')], 0);
  assert.equal(counts[BAG_POCKETS.findIndex((p) => p.id === 'ball')], 2);
});
