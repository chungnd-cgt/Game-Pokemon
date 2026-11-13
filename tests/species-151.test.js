import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, STARTERS } from '../src/data/monsters.js';
import { DEX } from '../src/data/pokedex.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MOVES } from '../src/data/moves.js';
import { ITEMS } from '../src/data/items.js';
import { createMonster } from '../src/game/monster.js';

// Loài không có ngoài tự nhiên: hồi sinh từ hoá thạch hoặc gặp trong nhiệm vụ cốt truyện sau khi vô địch
const FOSSILS = ['omanyte', 'kabuto', 'aerodactyl'];
const LEGENDS = ['articuno', 'zapdos', 'moltres', 'mewtwo', 'mew'];
const STORY_ONLY = [...FOSSILS, ...LEGENDS];

const wildSpecies = () => new Set(Object.values(ENCOUNTERS).flat().map((e) => e.species));
const minWildLevel = () => {
  const min = {};
  for (const e of Object.values(ENCOUNTERS).flat()) min[e.species] = Math.min(min[e.species] ?? Infinity, e.min);
  return min;
};
const isDamaging = (move) => MOVES[move].category !== 'status';

test('đủ 151 loài: mọi Pokémon trong Pokédex đều chơi được', () => {
  assert.equal(DEX.length, 151);
  for (const p of DEX) assert.ok(SPECIES[p.slug], `${p.slug} (#${p.id}) chưa có trong SPECIES`);
  assert.equal(Object.keys(SPECIES).length, 151);
  for (const sp of Object.values(SPECIES)) {
    assert.ok(sp.abilities.normal.length, `${sp.id}: không có đặc tính`);
    for (const e of sp.evolution ?? []) {
      assert.ok(SPECIES[e.to], `${sp.id} -> ${e.to}`);
      assert.ok(e.item ? ITEMS[e.item]?.kind === 'evolution' : Number.isInteger(e.level), `${sp.id} -> ${e.to}: thiếu cấp / đá tiến hoá`);
    }
  }
});

test('đủ 151 loài: loài nào cũng có cách để có được', () => {
  const obtainable = new Set([...wildSpecies(), ...STARTERS, ...STORY_ONLY]);
  // cộng thêm các dạng tiến hoá của loài đã có được
  for (let grew = true; grew;) {
    grew = false;
    for (const id of [...obtainable]) {
      for (const { to } of SPECIES[id].evolution ?? []) if (!obtainable.has(to)) grew = obtainable.add(to);
    }
  }
  for (const id of Object.keys(SPECIES)) assert.ok(obtainable.has(id), `${id}: không có cách nào để có được`);
});

test('đủ 151 loài: hoá thạch và huyền thoại không xuất hiện ngoài tự nhiên', () => {
  const wild = wildSpecies();
  const lines = [...STORY_ONLY, 'omastar', 'kabutops'];
  for (const id of lines) assert.ok(!wild.has(id), `${id} không được có trong bảng Pokémon hoang dã`);
  // Các loài mới bổ sung đều gặp được ở ít nhất một khu (trừ dạng tiến hoá bằng đá / cấp cao)
  for (const id of ['caterpie', 'weedle', 'spearow', 'sandshrew', 'nidoran-f', 'nidoran-m', 'clefairy', 'jigglypuff', 'paras',
    'venonat', 'diglett', 'farfetchd', 'doduo', 'krabby', 'exeggcute', 'cubone', 'tangela', 'kangaskhan', 'horsea', 'mr-mime',
    'scyther', 'electabuzz', 'magmar', 'pinsir', 'tauros', 'ditto', 'porygon', 'chansey']) {
    assert.ok(wild.has(id), `${id}: chưa có ở khu nào`);
  }
});

test('đủ 151 loài: loài nào cũng có chiêu gây sát thương từ cấp 5 (hoặc cấp thấp nhất gặp ngoài tự nhiên)', () => {
  const min = minWildLevel();
  for (const id of Object.keys(SPECIES)) {
    // Magikarp gốc chỉ biết Splash tới cấp 15; Ditto chỉ biết Transform (biến hình rồi đánh bằng chiêu của đối thủ)
    if (id === 'magikarp' || id === 'ditto') continue;
    for (const lv of [min[id] ?? 5, 50, 100]) {
      const mon = createMonster(id, lv);
      assert.ok(mon.moves.some(isDamaging), `${id} cấp ${lv}: không có chiêu gây sát thương (${mon.moves.join(', ')})`);
    }
  }
  // Ngoại lệ: Metapod / Kakuna giữ chiêu đánh của dạng trước. Ditto có đúng bộ chiêu gốc: chỉ Transform
  assert.ok(createMonster('metapod', 7).moves.includes('tackle'));
  assert.ok(createMonster('kakuna', 7).moves.includes('poisonSting'));
  assert.deepEqual(createMonster('ditto', 42).moves, ['transform']);
});
