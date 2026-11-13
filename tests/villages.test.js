import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/data/map.js';
import { SPECIES } from '../src/data/monsters.js';
import { NPCS, TRAINERS } from '../src/data/npcs.js';
import { PLACES } from '../src/data/region.js';
import { resetState, setFlag, state } from '../src/game/state.js';
import { STORY_NPCS, objectVisible } from '../src/story/chapter1.js';
import { GYMS, badgeGate } from '../src/story/chapter2.js';
import { VILLAGES, VILLAGE_NPCS, rival3, rival4, villageDone, villageGate, villageObjective } from '../src/story/villages.js';

// Các bản đồ đi tới được từ Pallet qua lối chuyển bản đồ (không vào nhà), bỏ qua bản đồ skip
function reachable(skip = null) {
  const seen = new Set(['route1']);
  const queue = ['route1'];
  while (queue.length) {
    const id = queue.shift();
    for (const w of MAPS[id].warps ?? []) {
      if (w.to === skip || seen.has(w.to) || w.oneWay) continue;
      seen.add(w.to);
      queue.push(w.to);
    }
  }
  return seen;
}

test('làng: mỗi thành phố có gym chỉ tới được bằng cách đi qua làng ngay trước nó', () => {
  assert.equal(VILLAGES.length, 8);
  const all = reachable();
  for (const v of VILLAGES) {
    assert.ok(all.has(v.map), `${v.map}: không tới được từ Pallet`);
    assert.ok(all.has(v.city), `${v.city}: không tới được từ Pallet`);
    assert.ok(!reachable(v.map).has(v.city), `${v.city}: đi vòng được, không cần qua ${v.name}`);
  }
  assert.ok(all.has('league'), 'vẫn lên được Cao nguyên Liên Minh');
});

test('làng: thứ tự gym khớp với làng, cổng sang thành phố nằm đúng ô chuyển bản đồ', () => {
  assert.deepEqual(GYMS.map((g) => [g.village, g.place]), VILLAGES.map((v) => [v.id, v.city]));
  for (const v of VILLAGES) {
    const map = MAPS[v.map];
    assert.equal(map.name, v.name);
    assert.ok(MAPS[v.city].name.startsWith('Thành phố'), `${v.city}: gym phải nằm trong thành phố`);
    const toCity = map.warps.filter((w) => w.to === v.city);
    assert.ok(toCity.length, `${v.map}: không có lối sang ${v.city}`);
    for (const w of toCity) assert.equal(map.gateAt(w.x, w.y)?.village, v.id, `${v.map} (${w.x},${w.y}): lối sang thành phố thiếu cổng`);
    // Pokémon Center hồi phục được, Poké Mart có nhân viên
    const center = map.buildings.find((b) => b.type === 'center');
    const mart = map.buildings.find((b) => b.type === 'mart');
    assert.ok(MAPS[center.to].heal, `${v.map}: Pokémon Center không hồi phục được`);
    assert.ok(NPCS.some((n) => n.map === center.to && n.role === 'nurse'), `${center.to}: thiếu Y tá Joy`);
    assert.ok(NPCS.some((n) => n.map === mart.to && n.role === 'clerk'), `${mart.to}: thiếu nhân viên`);
    assert.ok(map.martTier >= 1 && map.martTier <= 2, `${v.map}: bậc hàng`);
    assert.ok(PLACES.some((p) => p.id === map.place && p.kind === 'village'), `${v.map}: chưa có trên bản đồ vùng`);
  }
});

test('làng: chưa xong nhiệm vụ thì cổng chặn, xong (hoặc bản lưu cũ đã tới thành phố) thì mở', () => {
  resetState();
  const world = { say: async () => {}, map: null };
  for (const v of VILLAGES) {
    world.map = MAPS[v.map];
    const gate = world.map.gates.find((g) => g.village === v.id);
    const [x, y] = gate.rect;
    assert.equal(typeof badgeGate(world, x, y), 'function', `${v.map}: cổng chưa chặn`);
    assert.ok(villageObjective(v.id).length > 0);
    setFlag(`village:${v.id}`);
    assert.equal(badgeGate(world, x, y), null, `${v.map}: xong nhiệm vụ mà cổng chưa mở`);
  }
  resetState();
  state.visited.add('town4');
  assert.ok(villageDone('v3') && !villageDone('v4'), 'đã tới thành phố từ trước thì không bắt làm lại nhiệm vụ');
  assert.equal(villageGate({ say: async () => {} }, { village: 'v3' }), null);
});

test('làng: cầu chì chỉ hiện khi đã nhận lời kỹ sư, NPC nhiệm vụ hiện theo tiến độ', () => {
  resetState();
  // Cầu chì nằm trên Đồi Cột Điện sau Xóm Trạm Điện
  const fuses = MAPS.hill3.objects.filter((o) => o.item === 'fuse');
  assert.equal(fuses.length, 3);
  assert.ok(fuses.every((o) => !objectVisible(o)));
  setFlag('quest:v3');
  assert.ok(fuses.every((o) => objectVisible(o)));
  const npc = (id) => VILLAGE_NPCS.find((n) => n.id === id);
  assert.ok(!npc('gary-v3').show(), 'Gary chưa tới khi trạm điện chưa có điện');
  setFlag('village:v3:power');
  assert.ok(npc('gary-v3').show());
  // Bé Tí đi lạc trong Rừng Thông (không phải trong làng); tìm thấy rồi thì về làng, xong thì hai mẹ con đã vào nhà
  assert.equal(npc('v1-ti-lost').map, 'forest1');
  assert.ok(npc('v1-ti-lost').show() && npc('v1-dad').show() && npc('v1-mom').show());
  setFlag('quest:v1');
  setFlag('village:v1:found');
  assert.ok(!npc('v1-ti-lost').show() && !npc('v1-dad').show() && !npc('v1-pidgeotto').show());
  setFlag('village:v1');
  assert.ok(!npc('v1-mom').show(), 'mẹ bé Tí đã dắt con vào nhà');
  assert.ok(npc('v4-gyarados').show());
  setFlag('village:v4');
  assert.ok(!npc('v4-gyarados').show(), 'đuổi Gyarados rồi thì cầu thông');
  // NPC làng có trong danh sách nhân vật cốt truyện, Pokémon hoang dã / đội hình đều là loài có trong game
  for (const n of VILLAGE_NPCS) {
    assert.ok(STORY_NPCS.includes(n), n.id);
    if (n.mon) assert.ok(SPECIES[n.mon], `${n.id}: ${n.mon}`);
    for (const [s] of n.team ?? []) assert.ok(SPECIES[s], `${n.id}: ${s}`);
  }
});

test('Gary ở làng: đội hình dùng dạng tiến hoá của Pokémon khởi đầu khắc hệ', () => {
  for (const [starter, mid, last] of [['bulbasaur', 'ivysaur', 'venusaur'], ['charmander', 'charmeleon', 'charizard'], ['squirtle', 'wartortle', 'blastoise']]) {
    resetState();
    setFlag(`rivalStarter:${starter}`);
    assert.equal(rival3().team.at(-1)[0], mid);
    assert.equal(rival4().team.at(-1)[0], last);
    for (const [s, lv] of [...rival3().team, ...rival4().team]) assert.ok(SPECIES[s] && lv > 0, s);
  }
});

test('trận Pokémon hoang dã trong nhiệm vụ không lưu giữa chừng (đóng tab lúc vừa bắt được không nhân bản được Pokémon nhiệm vụ)', async () => {
  resetState();
  const battles = [];
  // Thế giới giả: hàm nào cảnh cắt gọi mà không khai báo thì coi như chạy xong ngay
  const world = new Proxy({
    map: MAPS.marsh4,
    pos: { x: 15, y: 5 },
    ask: async () => true,
    startBattle: async (data) => (battles.push(data), 'catch'),
    findNpc: () => null,
  }, { get: (t, k) => (k in t ? t[k] : async () => {}) });
  await VILLAGE_NPCS.find((n) => n.id === 'v4-gyarados').onTalk(world);
  assert.equal(battles.length, 1);
  assert.ok(battles[0].enemy, 'đánh Gyarados hoang dã');
  assert.ok(!battles[0].persist, 'không persist: cờ nhiệm vụ ghi sau trận, phải lưu cùng lúc với Pokémon vừa bắt');
  assert.ok(villageDone('v4'));
});

test('Rừng Thông sau làng: bé Tí ở bãi hoa xa, phải đi vòng qua đông bắc; gờ đất là đường tắt một chiều về ngã tư', () => {
  const f = MAPS.forest1;
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  // BFS có tính nhảy gờ (bước vào ô gờ đúng chiều thì đáp xuống ô bên kia), trả về số bước tới từng ô
  const dist = (sx, sy) => {
    const out = new Map([[`${sx},${sy}`, 0]]);
    const queue = [[sx, sy]];
    while (queue.length) {
      const [x, y] = queue.shift();
      const d = out.get(`${x},${y}`);
      for (const [dir, [dx, dy]] of Object.entries(D)) {
        let [nx, ny] = [x + dx, y + dy];
        if (nx < 0 || ny < 0 || nx >= f.width || ny >= f.height) continue;
        if (f.info(nx, ny).ledge === dir) [nx, ny] = [nx + dx, ny + dy];
        else if (f.isSolid(nx, ny)) continue;
        if (f.isSolid(nx, ny) || out.has(`${nx},${ny}`)) continue;
        out.set(`${nx},${ny}`, d + 1);
        queue.push([nx, ny]);
      }
    }
    return out;
  };
  const village = MAPS.village1.warps.find((w) => w.to === 'forest1');
  const ti = VILLAGE_NPCS.find((n) => n.id === 'v1-ti-lost');
  const fromEntry = dist(village.tx, village.ty);
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => fromEntry.get(`${ti.x + dx},${ti.y + dy}`)).filter((d) => d !== undefined);
  assert.ok(near.length, 'tới được chỗ bé Tí');
  assert.ok(Math.min(...near) >= 60, `đường tới bé Tí đủ dài (${Math.min(...near)} bước)`);
  // Từ bãi hoa nhảy gờ xuống thì về đầu rừng nhanh hơn hẳn đường đi lên
  const back = dist(ti.x, ti.y + 1).get(`${village.tx},${village.ty}`);
  assert.ok(back < Math.min(...near) - 15, `đường tắt về (${back} bước)`);
  // Bố bé Tí ở bãi đầu rừng, có nhà huấn luyện, vật phẩm và bụi cỏ rậm
  assert.equal(VILLAGE_NPCS.find((n) => n.id === 'v1-dad').map, 'forest1');
  assert.ok(TRAINERS.filter((t) => t.map === 'forest1').length >= 2);
  assert.ok(f.objects.filter((o) => o.kind === 'item').length >= 4);
  assert.ok(f.areas.some((a) => a.table === 'forest1-deep'));
});
