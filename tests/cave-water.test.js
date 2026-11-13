import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { MAPS, resumePosition } from '../src/data/map.js';
import { SPECIES } from '../src/data/monsters.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { CAVE_TILES } from '../src/data/tiles.js';
import { STORY_NPCS } from '../src/story/chapter1.js';
import { LEGENDS } from '../src/story/postgame.js';
import { dexLocations } from '../src/ui/dex/dexData.js';

// Nước ngầm trong hang (ô w của CAVE_TILES): hồ / suối ngầm lướt nước và câu cá được, có đồ trên cồn / hốc đá chỉ lướt
// nước mới tới (vật phẩm ghi surf: true). Đường chính qua hang vẫn đi bộ được (Surf chỉ có sau Gym Sông Nước)

const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const RODS = ['surf', 'oldRod', 'goodRod', 'superRod'];
// Các hang (nhiều tầng nối bằng thang) và cửa vào từ bên ngoài
const SYSTEMS = [
  { floors: ['cave1', 'cave1b'], entry: ['town1', 'cave1'] },
  { floors: ['cave2', 'cave2b'], entry: ['route9', 'cave2'] },
  { floors: ['cave3', 'cave3b', 'cave3c'], entry: ['route11', 'cave3'] },
  { floors: ['pit5'], entry: ['village5', 'pit5'] },
];
const WATER_CAVES = ['cave1b', 'cave2b', 'cave3b', 'cave3c', 'pit5'];
const key = (id, x, y) => `${id}:${x},${y}`;
const people = (id) => [...NPCS, ...TRAINERS, ...STORY_NPCS].filter((n) => n.map === id && !n.show);

// BFS qua các tầng của một hang (thang = ô chuyển bản đồ giữa các tầng). surf: được đi trên ô nước.
// Vật phẩm còn nằm đó thì chắn ô (đứng cạnh để nhặt), người đứng yên (không có show) cũng chắn
function walk(floors, starts, { surf = false } = {}) {
  const seen = new Set(starts.map((s) => key(s.map, s.x, s.y)));
  const queue = [...starts];
  while (queue.length) {
    const { map, x, y } = queue.pop();
    const m = MAPS[map];
    const w = m.warpAt(x, y);
    if (w && floors.includes(w.to) && w.to !== map && !seen.has(key(w.to, w.tx, w.ty))) {
      seen.add(key(w.to, w.tx, w.ty));
      queue.push({ map: w.to, x: w.tx, y: w.ty });
    }
    for (const [dx, dy] of D) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || seen.has(key(map, nx, ny))) continue;
      const water = m.tileAt(nx, ny) === 'w';
      if (m.isSolid(nx, ny) && !(surf && water)) continue;
      if (m.objectAt(nx, ny)?.kind === 'item' || people(map).some((n) => n.x === nx && n.y === ny)) continue;
      seen.add(key(map, nx, ny));
      queue.push({ map, x: nx, y: ny });
    }
  }
  return seen;
}
const entryOf = ([from, cave]) => {
  const w = MAPS[from].warps.find((ww) => ww.to === cave);
  return { map: cave, x: w.tx, y: w.ty };
};
const nextTo = (seen, id, { x, y }) => D.some(([dx, dy]) => seen.has(key(id, x + dx, y + dy)));

test('ô nước ngầm w: có trong CAVE_TILES, đi bộ thì cản, không có Pokémon khi đi bộ; mọi ký tự trong hang đều được khai báo', () => {
  assert.ok(CAVE_TILES.w, 'CAVE_TILES thiếu ô nước');
  assert.equal(CAVE_TILES.w.solid, true);
  assert.equal(CAVE_TILES.w.encounter, undefined);
  for (const m of Object.values(MAPS).filter((mm) => mm.cave)) {
    for (const row of m.rows) for (const ch of row) assert.ok(CAVE_TILES[ch], `${m.id}: ký tự lạ ${ch}`);
  }
});

test('hang có nước: đủ bảng lướt nước + 3 loại cần câu, cấp hợp lý, cần cũ chỉ câu được Magikarp, không chia theo buổi', () => {
  const caves = Object.values(MAPS).filter((m) => m.cave && m.rows.some((r) => r.includes('w')));
  assert.deepEqual(caves.map((m) => m.id).sort(), [...WATER_CAVES].sort());
  for (const m of caves) {
    assert.ok(m.water?.name, `${m.id}: thiếu tên mặt nước`);
    const water = m.rows.join('').split('').filter((c) => c === 'w').length;
    assert.ok(water >= 12, `${m.id}: nước quá ít (${water} ô)`);
    for (const rod of RODS) {
      const table = ENCOUNTERS[m.water[rod]];
      assert.ok(table?.length, `${m.id}: thiếu bảng ${rod}`);
      for (const e of table) {
        assert.ok(SPECIES[e.species], `${m.water[rod]}: không có loài ${e.species}`);
        assert.ok(e.min <= e.max && !e.time, `${m.water[rod]}: ${e.species}`);
      }
    }
    assert.deepEqual([...new Set(ENCOUNTERS[m.water.oldRod].map((e) => e.species))], ['magikarp']);
    // Nước chỉ lướt được sau Gym Sông Nước: Pokémon lướt nước không yếu hơn Pokémon trên cạn của chính hang
    const land = ENCOUNTERS[m.areas[0].table];
    const lo = (t) => Math.min(...t.map((e) => e.min));
    assert.ok(lo(ENCOUNTERS[m.water.surf]) >= Math.min(lo(land), 26), `${m.id}: Pokémon lướt nước quá yếu`);
  }
  // Pokédex: nơi xuất hiện ghi đúng hang và cách gặp
  assert.ok(dexLocations('seel').some((l) => l.mapId === 'cave3b' && l.method === 'surf'));
  assert.ok(dexLocations('dewgong').some((l) => l.mapId === 'cave3c' && l.method === 'superRod'));
  assert.ok(dexLocations('krabby').some((l) => l.mapId === 'cave1b' && l.method === 'surf'));
});

test('đường chính qua hang vẫn đi bộ được: từ cửa vào tới mọi lối ra / thang / Mewtwo mà không cần lướt nước', () => {
  for (const sys of SYSTEMS) {
    const onFoot = walk(sys.floors, [entryOf(sys.entry)]);
    for (const id of sys.floors) {
      for (const w of MAPS[id].warps) {
        assert.ok(onFoot.has(key(id, w.x, w.y)) || nextTo(onFoot, id, w), `${id} (${w.x},${w.y}) -> ${w.to}: phải lướt nước mới tới`);
        assert.notEqual(MAPS[id].tileAt(w.x, w.y), 'w', `${id}: lối ra nằm trên mặt nước`);
      }
      // Mọi vật phẩm không ghi surf đều đi bộ tới nhặt được
      for (const o of MAPS[id].objects.filter((oo) => oo.kind === 'item' && !oo.surf)) {
        assert.ok(nextTo(onFoot, id, o), `${o.id}: không đi bộ tới được`);
      }
    }
  }
  // Mewtwo (sau Liên minh) và nhà nghiên cứu trong hầm băng: đi bộ tới đứng cạnh được
  const cave3 = SYSTEMS[2];
  const onFoot = walk(cave3.floors, [entryOf(cave3.entry)]);
  const mewtwo = LEGENDS.find((l) => l.id === 'mewtwo');
  assert.equal(mewtwo.map, 'cave3c');
  assert.ok(nextTo(onFoot, 'cave3c', mewtwo), 'Mewtwo phải đi bộ tới được');
  assert.notEqual(MAPS.cave3c.tileAt(mewtwo.x, mewtwo.y), 'w');
});

test('vật phẩm trên cồn / hốc đá giữa nước ngầm: đi bộ không tới, lướt nước thì tới nhặt được', () => {
  let count = 0;
  for (const sys of SYSTEMS) {
    const start = [entryOf(sys.entry)];
    const onFoot = walk(sys.floors, start);
    const swim = walk(sys.floors, start, { surf: true });
    for (const id of sys.floors) {
      for (const o of MAPS[id].objects.filter((oo) => oo.surf)) {
        count++;
        assert.ok(MAPS[id].water, `${id}: ${o.id} ghi surf nhưng bản đồ không có nước`);
        assert.ok(!nextTo(onFoot, id, o), `${o.id}: đi bộ cũng tới được, bỏ surf: true`);
        assert.ok(nextTo(swim, id, o), `${o.id}: lướt nước cũng không tới được`);
      }
    }
  }
  assert.ok(count >= 5, `chỉ có ${count} món phải lướt nước trong hang`);
  // Hang Thạch Nhũ: cồn đá giữa hồ ngầm tầng hầm có Leftovers
  assert.ok(MAPS.cave1b.objects.some((o) => o.surf && o.item === 'leftovers' && MAPS.cave1b.tileAt(o.x, o.y) === '.'));
});

test('xuống được nước từ bờ: mỗi vùng nước giáp ít nhất một ô bờ đi bộ tới được; không ai đứng trên mặt nước', () => {
  for (const sys of SYSTEMS) {
    const onFoot = walk(sys.floors, [entryOf(sys.entry)]);
    for (const id of sys.floors.filter((f) => WATER_CAVES.includes(f))) {
      const m = MAPS[id];
      const seen = new Set();
      for (let y = 0; y < m.height; y++) {
        for (let x = 0; x < m.width; x++) {
          if (m.tileAt(x, y) !== 'w' || seen.has(`${x},${y}`)) continue;
          // gom một vùng nước liền nhau, tìm ô bờ đi bộ tới được
          const stack = [[x, y]];
          seen.add(`${x},${y}`);
          let shore = false;
          while (stack.length) {
            const [cx, cy] = stack.pop();
            for (const [dx, dy] of D) {
              const [nx, ny] = [cx + dx, cy + dy];
              if (onFoot.has(key(id, nx, ny))) shore = true;
              if (m.tileAt(nx, ny) === 'w' && !seen.has(`${nx},${ny}`)) {
                seen.add(`${nx},${ny}`);
                stack.push([nx, ny]);
              }
            }
          }
          assert.ok(shore, `${id} (${x},${y}): vùng nước không có bờ để xuống`);
        }
      }
      for (const n of [...NPCS, ...TRAINERS, ...STORY_NPCS].filter((nn) => nn.map === id)) {
        assert.ok(n.swim || m.tileAt(n.x, n.y) !== 'w', `${n.id} đứng trên mặt nước`);
      }
    }
  }
});

test('lưu game lúc đang lướt nước trong hang: tải lại vẫn ở dưới nước, không bị đẩy lên bờ', () => {
  for (const id of WATER_CAVES) {
    const m = MAPS[id];
    const y = m.rows.findIndex((r) => r.includes('w'));
    const x = m.rows[y].indexOf('w');
    for (const vehicle of ['surf', 'waterRide']) {
      const pos = { map: id, x, y, facing: 'down', vehicle, mount: null };
      assert.deepEqual(resumePosition(pos), pos, `${id}: ${vehicle}`);
    }
  }
});
