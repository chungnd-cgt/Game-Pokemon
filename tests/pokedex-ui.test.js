import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { DEX } from '../src/data/pokedex.js';
import { RADAR_STATS, dexLocations, dexMoves, filterDex, levelText, metric, radarPoint } from '../src/ui/dex/dexData.js';

test('Pokédex: lọc ẩn loài chưa gặp, tìm theo số và theo tên (không lộ tên loài chưa gặp)', () => {
  const seen = new Set([1, 4, 25, 129]);
  const status = (id) => (seen.has(id) ? 'seen' : 'unknown');
  assert.deepEqual(filterDex(DEX, { hideUnseen: true }, status).map((p) => p.id), [1, 4, 25, 129]);
  assert.equal(filterDex(DEX, {}, status).length, DEX.length);
  assert.deepEqual(filterDex(DEX, { query: '025' }, status).map((p) => p.id), [25]);
  assert.deepEqual(filterDex(DEX, { query: '15' }, status).map((p) => p.id), [15, 150, 151]);
  assert.deepEqual(filterDex(DEX, { query: 'pika' }, status).map((p) => p.id), [25]);
  assert.deepEqual(filterDex(DEX, { query: 'Mew' }, status).map((p) => p.id), [], 'Mew / Mewtwo chưa gặp thì không tìm ra theo tên');
});

test('Pokédex: nơi xuất hiện liệt kê mọi bản đồ / cách gặp, có buổi khi chỉ xuất hiện theo buổi', () => {
  const lapras = dexLocations('lapras');
  const night = lapras.find((l) => l.mapId === 'route10' && l.method === 'surf');
  assert.ok(night, 'Lapras lướt nước ở Tuyến đường 10');
  assert.deepEqual(night.times, ['night']);
  assert.equal(night.label, 'Lướt nước');
  assert.ok(lapras.some((l) => l.method === 'superRod'));
  assert.ok(dexLocations('zubat').every((l) => l.method === 'cave'));
  assert.ok(dexLocations('pikachu').some((l) => l.mapId === 'route2' && l.method === 'deep'));
  assert.deepEqual(dexLocations('mewtwo'), []);
  // Mọi loài trong bảng hoang dã đều có ít nhất một nơi xuất hiện, cấp hợp lệ
  const wild = new Set(Object.values(ENCOUNTERS).flat().map((e) => e.species));
  for (const slug of wild) {
    const locs = dexLocations(slug);
    assert.ok(locs.length, `${slug} không có nơi xuất hiện`);
    for (const l of locs) {
      assert.ok(MAPS[l.mapId] && l.min <= l.max && l.label, `${slug}: ${JSON.stringify(l)}`);
      assert.match(levelText(l), /^Lv \d+(-\d+)?$/);
    }
  }
});

test('Pokédex: mọi loài có bộ chiêu học khi lên cấp (chiêu có hệ), số liệu chiều cao / cân nặng đọc được', () => {
  for (const p of DEX) {
    const moves = dexMoves(p.slug);
    assert.ok(moves.length, `${p.slug} không có chiêu`);
    for (const { level, move } of moves) assert.ok((level === 'TH' || Number.isInteger(level)) && move.type, `${p.slug}: ${level}`);
    assert.match(metric(p.height), /^[\d.]+ m$/);
    assert.match(metric(p.weight), /^[\d.]+ kg$/);
  }
  const charmander = dexMoves('charmander');
  assert.equal(charmander.find((m) => m.move.id === 'ember').level, 7);
});

test('Pokédex: biểu đồ lục giác 6 trục, HP ở đỉnh trên', () => {
  assert.equal(RADAR_STATS.length, 6);
  const top = radarPoint(100, 100, 50, 0);
  assert.ok(Math.abs(top.x - 100) < 1e-9 && Math.abs(top.y - 50) < 1e-9);
  const half = radarPoint(100, 100, 50, 3, 0.5);
  assert.ok(Math.abs(half.y - 125) < 1e-9);
});
