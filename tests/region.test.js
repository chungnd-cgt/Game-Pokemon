import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGES } from '../src/data/badges.js';
import { ENCOUNTERS } from '../src/data/encounters.js';
import { ITEMS } from '../src/data/items.js';
import { MAPS } from '../src/data/map.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { PLACES, placeOf } from '../src/data/region.js';
import { STORY_NPCS } from '../src/story/chapter1.js';

const outdoor = Object.values(MAPS).filter((m) => !m.indoor && !m.cave);
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

test('mọi bản đồ ngoài trời: cây là khối 2x2 thẳng hàng, mọi hàng cùng độ rộng', () => {
  for (const m of Object.values(MAPS)) assert.equal(new Set(m.rows.map((r) => r.length)).size, 1, `${m.id}: hàng lệch độ rộng`);
  for (const m of outdoor) {
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        if (m.tileAt(x, y) !== 'T') continue;
        const bx = x & ~1;
        const by = y & ~1;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) assert.equal(m.tileAt(bx + dx, by + dy), 'T', `${m.id}: cây lệch tại (${x}, ${y})`);
      }
    }
  }
});

test('ô chuyển bản đồ: tới đúng bản đồ, chỗ đến đi được, có lối quay về', () => {
  for (const m of Object.values(MAPS)) {
    for (const w of m.warps ?? []) {
      const to = MAPS[w.to];
      assert.ok(to, `${m.id}: thiếu bản đồ ${w.to}`);
      // Dòng sông nối hai bản đồ: từ ô nước sang ô nước (đang lướt nước)
      const river = m.tileAt(w.x, w.y) === 'w' && to.tileAt(w.tx, w.ty) === 'w';
      assert.ok(river || !to.isSolid(w.tx, w.ty), `${m.id} -> ${w.to}: chỗ đến (${w.tx},${w.ty}) bị chặn`);
      assert.ok(!to.warpAt(w.tx, w.ty), `${m.id} -> ${w.to}: chỗ đến lại là ô chuyển bản đồ`);
      assert.ok(DIRS[w.facing], `${m.id}: hướng ${w.facing}`);
      // Từ chỗ đến bước ngược lại một ô (hoặc đứng cạnh) là có ô quay về bản đồ cũ (trừ cửa một chiều ở Liên minh)
      if (w.oneWay) continue;
      const back = (to.warps ?? []).some((b) => b.to === m.id && Math.abs(b.x - w.tx) + Math.abs(b.y - w.ty) <= 1);
      assert.ok(back, `${w.to} (${w.tx},${w.ty}): không có lối quay về ${m.id}`);
    }
  }
});

test('mọi ô có Pokémon hoang dã đều thuộc một khu, bảng tồn tại', () => {
  for (const m of Object.values(MAPS)) {
    for (const a of m.areas) assert.ok(ENCOUNTERS[a.table], `${m.id}: thiếu bảng ${a.table}`);
    for (const key of ['surf', 'oldRod', 'goodRod', 'superRod']) if (m.water) assert.ok(ENCOUNTERS[m.water[key]], `${m.id}: thiếu bảng ${key}`);
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        if (m.info(x, y).encounter) assert.ok(m.areaAt(x, y), `${m.id} (${x},${y}) chưa thuộc khu nào`);
      }
    }
  }
});

test('cửa nhà ở mọi thị trấn dẫn vào trong và thảm ra dẫn về đúng trước cửa', () => {
  for (const m of outdoor) {
    for (const b of m.buildings) {
      if (!b.to) continue;
      const inside = MAPS[b.to];
      assert.ok(inside, `${m.id}: thiếu bản đồ ${b.to}`);
      assert.equal(inside.exit.to, m.id, `${b.to}: cửa ra phải về ${m.id}`);
      assert.deepEqual({ x: inside.exit.x, y: inside.exit.y }, { x: b.door.x, y: b.door.y + 1 }, `${b.to}: thảm ra lệch cửa`);
      assert.ok(!inside.isSolid(inside.entry.x, inside.entry.y));
      assert.ok(!m.isSolid(b.door.x, b.door.y + 1), `${m.id}: trước cửa ${b.to} bị chặn`);
    }
  }
});

test('vật phẩm trên mọi bản đồ nằm ở ô đi được, id không trùng', () => {
  const ids = new Set();
  for (const m of Object.values(MAPS)) {
    for (const o of m.objects.filter((ob) => ob.kind === 'item' || ob.kind === 'berry')) {
      // Vật phẩm được nằm trên mặt nước (lướt nước tới nhặt); cây quả mọng thì không
      const water = o.kind === 'item' && m.tileAt(o.x, o.y) === 'w';
      assert.ok(water || !m.isSolid(o.x, o.y), `${m.id}: ${o.id} nằm trên ô cản`);
      assert.ok(!m.warpAt(o.x, o.y), `${m.id}: ${o.id} nằm trên ô chuyển bản đồ`);
      assert.ok(!ids.has(o.id), `${o.id} bị trùng`);
      ids.add(o.id);
      assert.ok(ITEMS[o.item ?? o.berry], `${o.id}: vật phẩm không tồn tại`);
    }
  }
});

test('mọi bản đồ thuộc một khu vực trên bản đồ vùng', () => {
  const ids = new Set(PLACES.map((p) => p.id));
  for (const m of Object.values(MAPS)) assert.ok(ids.has(placeOf(m.id)), `${m.id}: chưa có trên bản đồ vùng`);
  for (const p of PLACES.filter((pl) => !pl.future)) assert.ok(Object.values(MAPS).some((m) => m.place === p.id), `${p.id}: chưa có bản đồ`);
});

// Tìm đường trong gym, tính cả ô gió / dòng nước, cổng, công tắc, hàng rào điện, than hồng / xoáy nước (về lối vào),
// dịch chuyển, băng và tảng đá đẩy lấp hố (trạng thái = vị trí + cờ đang bật + vị trí các tảng đá + hố đã lấp).
// Miệng lò phun lửa (X / Y) coi như đi được: chỉ cần canh lúc lửa tắt.
// from / goal: điểm đi / điểm đến (mặc định từ lối vào tới trước mặt thủ lĩnh), start: cờ / đá / hố lúc xuất phát.
// gym.cleared (đã có huy hiệu): cổng / hàng rào không còn, công tắc vô tác dụng (ô đã dịu đi trong map.info).
// Tới đích thì trả về trạng thái lúc đó, không tới được thì null.
function solveGym(gym, leader, { boulders = gym.boulders ?? [], from = gym.entry, goal = { x: leader.x, y: leader.y + 1 }, start: init } = {}) {
  const people = [...NPCS, ...TRAINERS, ...STORY_NPCS].filter((n) => n.map === gym.id);
  const objectVisible = (o, flags) => {
    if (gym.cleared && (o.kind === 'gate' || o.kind === 'barrier')) return false;
    if (o.kind === 'gate') return !flags.has(o.flag);
    if (o.kind === 'barrier') return flags.has(o.flag) ? o.group === 'B' : o.group === 'A';
    return o.kind === 'lantern';
  };
  const inside = (x, y) => x >= 0 && y >= 0 && x < gym.width && y < gym.height;
  const blocked = (x, y, flags, rocks, filled) => !inside(x, y) || (gym.isSolid(x, y) && !filled.has(`${x},${y}`)) || gym.info(x, y).trap
    || rocks.has(`${x},${y}`) || people.some((n) => n.x === x && n.y === y)
    || gym.objects.some((o) => o.x === x && o.y === y && objectVisible(o, flags));
  // Sau khi bước vào ô (x, y) theo hướng (dx, dy): bị gió / dòng nước đẩy, trượt trên băng, hoặc dịch chuyển.
  // Trôi vào than hồng / xoáy nước thì về lối vào
  const settle = (x, y, flags, rocks, filled, dx, dy) => {
    for (let i = 0; i < 60; i++) {
      const pad = gym.padAt(x, y);
      if (pad) return [pad.tx, pad.ty];
      const info = gym.info(x, y);
      const [sx, sy] = info.push ? DIRS[info.push] : info.ice ? [dx, dy] : [0, 0];
      if (!sx && !sy) break;
      if (inside(x + sx, y + sy) && gym.info(x + sx, y + sy).trap) return [gym.entry.x, gym.entry.y];
      if (blocked(x + sx, y + sy, flags, rocks, filled)) break;
      [dx, dy] = [sx, sy];
      x += sx;
      y += sy;
    }
    return [x, y];
  };
  const press = (x, y, flags) => {
    if (gym.cleared) return flags;
    const o = gym.objects.find((ob) => ob.x === x && ob.y === y);
    const next = new Set(flags);
    if (o?.kind === 'switch') next.add(o.flag);
    if (o?.kind === 'toggle') {
      if (next.has(o.flag)) next.delete(o.flag);
      else next.add(o.flag);
    }
    return next;
  };
  const key = (x, y, flags, rocks, filled) => `${x},${y}|${[...flags].sort().join()}|${[...rocks].sort().join(';')}|${[...filled].sort().join(';')}`;
  const rocks0 = gym.cleared ? new Set() : new Set(boulders.map(([x, y]) => `${x},${y}`));
  const start = init ? [from.x, from.y, init.flags, init.rocks, init.filled] : [from.x, from.y, new Set(), rocks0, new Set()];
  const seen = new Set([key(...start)]);
  const queue = [start];
  while (queue.length) {
    const [x, y, flags, rocks, filled] = queue.shift();
    if (x === goal.x && y === goal.y) return { flags, rocks, filled };
    for (const [dx, dy] of Object.values(DIRS)) {
      const [nx, ny] = [x + dx, y + dy];
      let next;
      if (rocks.has(`${nx},${ny}`)) {
        // Đẩy đá: lăn một ô (vào hố thì lấp hố), người đứng yên
        const [bx, by] = [nx + dx, ny + dy];
        const hole = inside(bx, by) && gym.info(bx, by).hole && !filled.has(`${bx},${by}`);
        const nr = new Set(rocks);
        nr.delete(`${nx},${ny}`);
        if (hole) next = [x, y, flags, nr, new Set([...filled, `${bx},${by}`])];
        else if (!blocked(bx, by, flags, rocks, filled) && !gym.info(bx, by).push && !gym.info(bx, by).ice) next = [x, y, flags, nr.add(`${bx},${by}`), filled];
        else continue;
      } else {
        if (blocked(nx, ny, flags, rocks, filled)) continue;
        const [sx, sy] = settle(nx, ny, flags, rocks, filled, dx, dy);
        next = [sx, sy, press(sx, sy, flags), rocks, filled];
      }
      const k = key(...next);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(next);
      }
    }
  }
  return null;
}

test('mọi gym: đi được từ cửa tới trước mặt thủ lĩnh (ô gió, dòng nước, cổng, hàng rào điện, than hồng, dịch chuyển, băng)', () => {
  const leaders = STORY_NPCS.filter((n) => n.leader);
  assert.equal(leaders.length, 8);
  for (const leader of leaders) {
    const gym = MAPS[leader.map];
    assert.ok(gym, `${leader.id}: thiếu bản đồ`);
    assert.ok(solveGym(gym, leader), `${gym.name}: không tới được thủ lĩnh`);
  }
  // Câu đố có tác dụng thật (mỗi gym một kiểu): bỏ cơ chế đi thì không qua được
  const variant = (map, extra) => ({
    id: map.id, width: map.width, height: map.height, entry: map.entry, objects: map.objects, boulders: map.boulders,
    info: map.info.bind(map), isSolid: map.isSolid.bind(map), padAt: map.padAt.bind(map), ...extra,
  });
  const leaderOf = (id) => leaders.find((l) => l.map === id);
  const noSwitch = (map) => variant(map, { objects: map.objects.filter((o) => !['switch', 'toggle'].includes(o.kind)) });
  for (const id of ['gym2', 'gym3', 'gym4']) assert.equal(solveGym(noSwitch(MAPS[id]), leaderOf(id)), null, `${id}: đi thẳng được mà không cần công tắc`);
  // Gym Đồi Gió / Sông Nước: không dùng luồng gió / dòng nước thì không lên được
  const noPush = (map) => variant(map, { info: (x, y) => (map.info(x, y).push ? { solid: true } : map.info(x, y)), isSolid: (x, y) => map.isSolid(x, y) || Boolean(map.info(x, y).push) });
  for (const id of ['gym1', 'gym4']) assert.equal(solveGym(noPush(MAPS[id]), leaderOf(id)), null, `${id}: không cần luồng gió / dòng nước`);
  // Gym Chùa Cổ: không có ô dịch chuyển thì không sang được phòng thủ lĩnh
  assert.equal(solveGym(variant(MAPS.gym7, { padAt: () => null }), leaderOf('gym7')), null, 'gym7: đi bộ tới được thủ lĩnh');
  // Gym Núi Đá: không đẩy đá lấp hố thì không qua được
  assert.equal(solveGym(MAPS.gym6, leaderOf('gym6'), { boulders: [] }), null, 'gym6: không cần đẩy đá');
  assert.ok(MAPS.gym6.boulders.length >= 3);
  // Gym Lò Gốm: có 4 hàng miệng lửa thay phiên (cả hai nhóm), than hồng hai bên
  assert.ok(MAPS.gym5.vents);
  const ventRows = MAPS.gym5.rows.filter((r) => r.includes('X') && r.includes('Y') && r.includes('x'));
  assert.equal(ventRows.length, 4);
  // Gym Đèn Lồng tối, có đèn lồng để thắp; Gym Sương Mù có hai sân băng
  assert.equal(MAPS.gym3.dark, true);
  assert.ok(MAPS.gym3.objects.filter((o) => o.kind === 'lantern').length >= 4);
  assert.ok(MAPS.gym8.rows.filter((r) => /^i+$/.test(r.replace(/o/g, ''))).length >= 10);
  // 8 gym không còn chung một khuôn: kích thước / cơ chế khác nhau, người trong gym đứng trên ô đi được
  for (const leader of leaders) {
    const gym = MAPS[leader.map];
    for (const n of [...NPCS, ...TRAINERS].filter((p) => p.map === gym.id)) assert.equal(gym.isSolid(n.x, n.y), false, `${n.id} đứng trên ô cản`);
  }
});

test('gym: từ chỗ thủ lĩnh có đường về lối vào; đã có huy hiệu thì câu đố ngừng, đi thẳng tới / về được', () => {
  const leaders = STORY_NPCS.filter((n) => n.leader);
  for (const leader of leaders) {
    const gym = MAPS[leader.map];
    const front = { x: leader.x, y: leader.y + 1 };
    // Chưa thắng: tới được thủ lĩnh rồi (chưa muốn đấu) vẫn quay ra được, không bị kẹt
    const reached = solveGym(gym, leader);
    assert.ok(solveGym(gym, leader, { from: front, start: reached, goal: gym.entry }), `${gym.name}: từ chỗ thủ lĩnh không về được lối vào`);
    // Đã có huy hiệu
    assert.ok(gym.badge, `${gym.id}: thiếu huy hiệu`);
    assert.ok(leader.id === `leader-${gym.badge}`, `${gym.id}: huy hiệu không khớp thủ lĩnh`);
    gym.cleared = true;
    try {
      assert.ok(solveGym(gym, leader), `${gym.name} (đã thắng): không tới được thủ lĩnh`);
      assert.ok(solveGym(gym, leader, { from: front, goal: gym.entry }), `${gym.name} (đã thắng): không về được lối vào`);
      for (let y = 0; y < gym.height; y++) {
        for (let x = 0; x < gym.width; x++) {
          const info = gym.info(x, y);
          assert.ok(!info.trap && info.vent === undefined && !info.ice && !info.hole, `${gym.id} (${x},${y}): câu đố còn hoạt động`);
          if (gym.windy) assert.ok(!info.push, `${gym.id} (${x},${y}): gió còn thổi`);
        }
      }
    } finally {
      gym.cleared = false;
    }
  }
  // Gym Chùa Cổ đã thắng: ô ở phòng đầu đưa thẳng lên phòng thủ lĩnh; Gym Đồi Gió tắt gió
  assert.ok(MAPS.gym7.clearedPads.every((p) => MAPS.gym7.padAt(p.x, p.y)?.ty !== p.ty));
  assert.equal(MAPS.gym1.windy, true);
});

test('huy hiệu: thủ lĩnh gym tặng đúng huy hiệu có trong danh sách, 8 ô', () => {
  assert.equal(BADGES.length, 8);
  assert.deepEqual(BADGES.map((b) => b.id), ['wind', 'grass', 'electric', 'water', 'fire', 'rock', 'psychic', 'ice']);
  const leaders = STORY_NPCS.filter((n) => n.leader);
  assert.equal(leaders.length, 8);
  for (const l of leaders) {
    assert.ok(l.team.length > 0 && l.onDefeat, l.id);
    assert.ok(BADGES.some((b) => b && l.id === `leader-${b.id}`), `${l.id}: không có huy hiệu tương ứng`);
  }
  // Mỗi thị trấn có gym (trừ thị trấn cuối) chặn lối ra bằng đúng huy hiệu của gym đó
  const towns = [['town2', 'wind'], ['town3', 'grass'], ['town4', 'electric'], ['town5', 'water'], ['town6', 'fire'], ['town7', 'rock'], ['town8', 'psychic']];
  for (const [town, badge] of towns) {
    assert.ok(MAPS[town].gates?.some((g) => g.badge === badge), `${town}: thiếu cổng ${badge}`);
  }
});

test('Liên minh: cổng 8 huy hiệu, chuỗi phòng Tứ Thiên Vương một chiều tới Nhà vô địch', async () => {
  const { LEAGUE_NPCS, resetLeague } = await import('../src/story/league.js');
  const { SPECIES } = await import('../src/data/monsters.js');
  const { state } = await import('../src/game/state.js');
  assert.ok(MAPS.route11.gates.some((g) => g.badges === 8), 'Đường Chiến Thắng thiếu lính gác 8 huy hiệu');
  assert.ok(MAPS.town9.gates.some((g) => g.badge === 'ice'));
  // Sảnh -> elite1 -> ... -> elite4 -> champion, cửa nào cũng một chiều
  const start = MAPS.leagueLobby.warps.find((w) => w.to === 'elite1');
  assert.ok(start?.oneWay && start.resetLeague);
  assert.ok(MAPS.leagueLobby.heal, 'sảnh phải hồi phục được (thua thì tỉnh dậy ở đây)');
  let id = 'elite1';
  const order = [];
  for (let n = 1; id !== 'champion'; n++) {
    const room = MAPS[id];
    order.push(id);
    const seal = room.objects.find((o) => o.kind === 'gate');
    assert.equal(seal.flag, `league:e${n}`, `${id}: cửa phong ấn`);
    const warp = room.warps[0];
    assert.ok(warp.oneWay && warp.x === seal.x && warp.y === seal.y - 1, `${id}: cửa ra phải nằm sau cửa phong ấn`);
    const member = LEAGUE_NPCS.find((m) => m.map === id);
    assert.ok(member?.elite && member.team.length === 5, `${id}: thiếu Thiên Vương`);
    id = warp.to;
  }
  assert.deepEqual(order, ['elite1', 'elite2', 'elite3', 'elite4']);
  const champ = LEAGUE_NPCS.find((m) => m.map === 'champion');
  assert.equal(champ.team.length, 6);
  assert.ok(!champ.leader, 'Nhà vô địch không tính là thủ lĩnh gym');
  // Đội hình hợp lệ, cấp tăng dần qua từng phòng
  const tops = LEAGUE_NPCS.filter((m) => m.team).map((m) => Math.max(...m.team.map(([, lv]) => lv)));
  for (const m of LEAGUE_NPCS.filter((n) => n.team)) for (const [s] of m.team) assert.ok(SPECIES[s], `${m.id}: ${s}`);
  assert.deepEqual([...tops].sort((a, b) => a - b), tops);
  // Bắt đầu lại: xoá cờ phòng và kết quả đấu
  state.flags.add('league:e2');
  state.defeatedTrainers.add('elite-lan');
  state.defeatedTrainers.add('r11-ace1');
  resetLeague();
  assert.ok(!state.flags.has('league:e2') && !state.defeatedTrainers.has('elite-lan'));
  assert.ok(state.defeatedTrainers.has('r11-ace1'), 'không xoá nhà huấn luyện ngoài Liên minh');
});
