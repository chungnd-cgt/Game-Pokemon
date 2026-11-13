import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS } from '../src/data/map.js';
import { SPECIES } from '../src/data/monsters.js';
import { areaLabel, areaSpecies } from '../src/ui/areaSpecies.js';

// Bảng Pokémon hoang dã góc phải (ui/AreaNav.js): gộp các bảng gặp của bản đồ, nhãn khi rê chuột

test('bảng Pokémon hoang dã: gộp nhiều bảng, cấp gặp là khoảng nhỏ nhất - lớn nhất, loài có cả ngày thì không gắn buổi', () => {
  ENCOUNTERS.__testA = [
    { species: 'pidgey', min: 3, max: 5 },
    { species: 'hoothoot', min: 4, max: 6, time: 'night' },
    { species: 'rattata', min: 2, max: 4, time: 'day' },
  ];
  ENCOUNTERS.__testB = [
    { species: 'pidgey', min: 6, max: 8, time: 'day' },
    { species: 'hoothoot', min: 7, max: 7, time: 'night' },
  ];
  try {
    const found = areaSpecies(['__testA', '__testB', 'khong-co-bang-nay']);
    assert.deepEqual([...found.keys()], ['pidgey', 'hoothoot', 'rattata']);
    assert.deepEqual(found.get('pidgey'), { time: null, min: 3, max: 8 });
    assert.deepEqual(found.get('hoothoot'), { time: 'night', min: 4, max: 7 });
    assert.deepEqual(found.get('rattata'), { time: 'day', min: 2, max: 4 });
  } finally {
    delete ENCOUNTERS.__testA;
    delete ENCOUNTERS.__testB;
  }
});

test('bảng Pokémon hoang dã: nhãn tên + cấp (+ buổi nếu chỉ ra vào một buổi)', () => {
  assert.equal(areaLabel('Pidgey', { time: null, min: 3, max: 5 }), 'Pidgey  Lv3-5');
  assert.equal(areaLabel('???', { time: null, min: 7, max: 7 }), '???  Lv7');
  assert.equal(areaLabel('Hoothoot', { time: 'night', min: 4, max: 6 }), 'Hoothoot  Lv4-6  •  ☾ Ban đêm');
});

test('bảng Pokémon hoang dã: mọi bảng gặp của các bản đồ đều có loài hợp lệ và cấp min <= max', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    const tables = [...(map.areas ?? []).map((a) => a.table), ...Object.values(map.water ?? {}).filter((t) => ENCOUNTERS[t])];
    for (const [species, { min, max }] of areaSpecies(tables)) {
      assert.ok(SPECIES[species], `${id}: không có loài ${species}`);
      assert.ok(min <= max, `${id}: ${species} cấp ${min}-${max}`);
    }
  }
});

test('Pokédex: danh sách chiêu không lặp chiêu (giữ cấp sớm nhất)', async () => {
  const { dexMoves } = await import('../src/ui/dex/dexData.js');
  for (const slug of Object.keys(SPECIES)) {
    const ids = dexMoves(slug).map((m) => m.move.id);
    assert.equal(new Set(ids).size, ids.length, `${slug} có chiêu lặp`);
  }
  assert.equal(dexMoves('charmander').find((m) => m.move.id === 'ember').level, 7);
});
