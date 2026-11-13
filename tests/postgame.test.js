import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catchChance, rollCatch } from '../src/battle/formulas.js';
import { ITEMS, MART_TIERS, STORE_STOCK, pocketOf } from '../src/data/items.js';
import { MAPS } from '../src/data/map.js';
import { SPECIES } from '../src/data/monsters.js';
import { DEX_BY_SLUG } from '../src/data/pokedex.js';
import { createMonster } from '../src/game/monster.js';
import { addItem, hasFlag, itemCount, resetState, setFlag, state } from '../src/game/state.js';
import { weatherOf } from '../src/game/weather.js';
import { F, STORY_NPCS, objectVisible, objective, useObject } from '../src/story/chapter1.js';
import { F_CHAMPION, F_STARTER_GIFT } from '../src/story/league.js';
import { LEGENDS, PG, POSTGAME_NPCS, legendAvailable, postgameStep } from '../src/story/postgame.js';

// Hậu truyện (story/postgame.js): mẹ → Giáo sư Oak xem Pokédex, tặng Master Ball → 5 Pokémon huyền thoại; hồi sinh hoá thạch

const npc = (id) => STORY_NPCS.find((n) => n.id === id);
const legendNpc = (id) => npc(`legend-${id}`);
const dexId = (s) => DEX_BY_SLUG[s].id;

// Thế giới giả cho cảnh cắt: ghi lời thoại, trận đấu trả về theo battle(), nhận đồ thì vào túi thật
function fakeWorld(mapId, { battle = () => 'win', ask = () => true } = {}) {
  const w = {
    map: MAPS[mapId],
    pos: { x: 5, y: 5 },
    lines: [],
    battles: [],
    calls: [],
    say: async (speaker, lines) => { w.lines.push(...lines); },
    ask: async (q) => ask(q),
    giveItem: async (id, qty = 1) => { addItem(id, qty); },
    startBattle: async (data) => (w.battles.push(data), battle(data)),
    findNpc: (id) => ({ def: { id }, pos: { x: 0, y: 0 } }),
    removeNpc: (n) => w.calls.push(['removeNpc', n.def.id]),
    npcFlyAway: async (n) => w.calls.push(['npcFlyAway', n.def.id]),
    fadeHeal: async () => w.calls.push(['fadeHeal']),
    refreshFollower: () => {},
    refreshObjects: () => {},
  };
  return w;
}
const said = (w, re) => w.lines.some((l) => re.test(l));

// Người chơi vừa thành Nhà vô địch (đã qua hết chương 1, có đội hình)
function champion() {
  resetState();
  for (const f of [F.MOM, F.MET_OAK, F.STARTER, F.DEX, F.QUEST_DONE, F.GRUNTS, F.BOSS, F.MART_REWARD, F.RIVAL2, F.DONE, F.MOM_GIFT, F.BIKE]) setFlag(f);
  setFlag('starter:charmander');
  setFlag('rivalStarter:squirtle');
  state.party = [createMonster('charizard', 60)];
  state.dex.caught.add(dexId('charizard'));
  state.dex.seen.add(dexId('charizard'));
  state.dex.seen.add(dexId('pidgey'));
  setFlag(F_CHAMPION);
}

// Giáo sư Oak đã xem Pokédex và tặng Master Ball
function postgame() {
  champion();
  setFlag(PG.MOM);
  setFlag(PG.OAK);
  setFlag(F_STARTER_GIFT);
}

// BFS trên ô (có nhảy gờ một chiều; vật phẩm nhặt được nên không tính là ô cản); block: các ô coi như bị chặn thêm
const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function reach(m, sx, sy, block = new Set()) {
  const out = new Set([`${sx},${sy}`]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dir, [dx, dy]] of Object.entries(D)) {
      let [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) continue;
      if (m.info(nx, ny).ledge === dir) [nx, ny] = [nx + dx, ny + dy];
      const k = `${nx},${ny}`;
      if (m.isSolid(nx, ny) || block.has(k) || out.has(k)) continue;
      out.add(k);
      queue.push([nx, ny]);
    }
  }
  return out;
}
const near = (set, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(`${x + dx},${y + dy}`));
// Chỗ đến khi đi vào bản đồ mapId từ một bản đồ khác (lối đi / thang) hoặc từ cửa nhà
function entryOf(mapId) {
  for (const m of Object.values(MAPS)) {
    const w = (m.warps ?? []).find((ww) => ww.to === mapId);
    if (w && m.id !== mapId) return [w.tx, w.ty];
  }
  const e = MAPS[mapId].entry;
  return [e.x, e.y];
}

test('vô địch → về nhà gặp mẹ → Giáo sư Oak xem Pokédex, tặng Pokémon khởi đầu còn lại và Master Ball', async () => {
  champion();
  assert.equal(objective('route1'), 'Về nhà ở Pallet báo tin cho mẹ');
  // Chưa gặp mẹ mà sang gặp Giáo sư trước: ông giục về nhà, chưa tặng gì
  let w = fakeWorld('lab');
  await npc('oak').onTalk(w);
  assert.ok(said(w, /về nhà chào mẹ/) && !itemCount('masterBall') && !hasFlag(PG.OAK));
  // Mẹ chúc mừng, dặn sang gặp Giáo sư Oak, vẫn hồi phục Pokémon như thường
  w = fakeWorld('home');
  await npc('mom').onTalk(w);
  assert.ok(hasFlag(PG.MOM) && said(w, /Giáo sư Oak/) && said(w, /Pokédex/));
  assert.ok(w.calls.some(([k]) => k === 'fadeHeal'), 'mẹ vẫn hồi phục Pokémon');
  assert.equal(objective('home'), 'Sang phòng thí nghiệm cho Giáo sư Oak xem Pokédex');
  // Giáo sư Oak xem Pokédex: nói số loài đã gặp / đã bắt, tặng 3 Pokémon khởi đầu chưa có (Charmander đã có dạng tiến hoá
  // nhưng chưa có trong Pokédex thì vẫn tặng), Master Ball, kể chuyện Pokémon huyền thoại
  w = fakeWorld('lab');
  await npc('oak').onTalk(w);
  assert.ok(said(w, /gặp 2 loài và bắt được 1 loài/), 'Giáo sư đọc số loài trong Pokédex');
  assert.equal(itemCount('masterBall'), 1);
  assert.ok(hasFlag(PG.OAK) && hasFlag(F_STARTER_GIFT));
  assert.deepEqual(state.party.map((m) => m.speciesId), ['charizard', 'bulbasaur', 'charmander', 'squirtle', 'pikachu']);
  for (const name of ['Zapdos', 'Articuno', 'Moltres', 'Hang Vân Sơn', 'Rừng Thông']) assert.ok(said(w, new RegExp(name)), `tin đồn về ${name}`);
  assert.match(objective('lab'), /^Huyền thoại \(0\/5\): tìm Zapdos ở .*Đồi Cột Điện/);
  // Nói chuyện lại: không tặng thêm
  w = fakeWorld('lab');
  await npc('oak').onTalk(w);
  assert.equal(itemCount('masterBall'), 1);
  assert.ok(said(w, /0\/5 Pokémon huyền thoại/));
  // Mẹ không nhắc lại
  w = fakeWorld('home');
  await npc('mom').onTalk(w);
  assert.ok(!said(w, /Nhà vô địch Khôi/));
});

test('bản lưu cũ đã nhận Pokémon khởi đầu: vẫn qua mẹ → Giáo sư Oak để nhận Master Ball, không tặng lại Pokémon', async () => {
  champion();
  setFlag(F_STARTER_GIFT);
  setFlag(PG.MOM);
  const w = fakeWorld('lab');
  await npc('oak').onTalk(w);
  assert.equal(itemCount('masterBall'), 1);
  assert.equal(state.party.length, 1);
});

test('Master Ball bắt chắc chắn 100%: mọi loài, đầy máu, không trạng thái; không bán ở cửa hàng', () => {
  const ball = ITEMS.masterBall;
  assert.equal(ball.kind, 'ball');
  assert.equal(pocketOf('masterBall'), 'ball');
  for (const id of Object.keys(SPECIES)) {
    const mon = createMonster(id, 70);
    assert.equal(mon.hp, mon.maxHp);
    assert.equal(catchChance(mon, ball.bonus), 1, `${id}: không chắc chắn bắt được`);
    // Kể cả số ngẫu nhiên lớn nhất (sát 1) bóng vẫn lắc đủ 3 lần
    assert.deepEqual(rollCatch(mon, ball.bonus, () => 0.9999999), { caught: true, shakes: 3 });
  }
  assert.ok(catchChance(createMonster('mewtwo', 70), ITEMS.ultraBall.bonus) < 0.05, 'Ultra Ball khó bắt Mewtwo đầy máu');
  assert.ok(!MART_TIERS.flat().includes('masterBall') && !STORE_STOCK.general.includes('masterBall'));
});

test('Pokémon huyền thoại chỉ xuất hiện sau khi vô địch và nghe Giáo sư Oak kể; Mewtwo cần đã gặp 3 chim, Mew cần quả Pecha', () => {
  assert.equal(LEGENDS.length, 5);
  assert.deepEqual(LEGENDS.map((l) => l.id), ['zapdos', 'articuno', 'moltres', 'mewtwo', 'mew']);
  resetState();
  for (const l of LEGENDS) assert.ok(!legendNpc(l.id).show(), `${l.id}: chưa vô địch`);
  champion();
  for (const l of LEGENDS) assert.ok(!legendNpc(l.id).show(), `${l.id}: chưa gặp Giáo sư Oak`);
  setFlag(PG.MOM);
  for (const l of LEGENDS) assert.ok(!legendNpc(l.id).show(), `${l.id}: chưa gặp Giáo sư Oak`);
  setFlag(PG.OAK);
  for (const id of ['zapdos', 'articuno', 'moltres']) assert.ok(legendNpc(id).show(), id);
  assert.ok(!legendNpc('mewtwo').show() && !legendNpc('mew').show());
  // Mewtwo: Pokédex đã gặp cả ba chim huyền thoại
  state.dex.seen.add(dexId('zapdos'));
  state.dex.seen.add(dexId('articuno'));
  assert.ok(!legendNpc('mewtwo').show());
  state.dex.seen.add(dexId('moltres'));
  assert.ok(legendNpc('mewtwo').show());
  // Mew: nghe cô bé hái hoa kể chuyện, mang theo quả Pecha
  assert.ok(!legendNpc('mew').show());
  addItem('pechaBerry', 1);
  assert.ok(!legendNpc('mew').show());
  setFlag(PG.MEW_HINT);
  assert.ok(legendNpc('mew').show());
  // Người kể chuyện cũng chỉ có sau khi Giáo sư Oak kể
  resetState();
  for (const id of ['pg-lineman', 'pg-climber', 'pg-kiln-elder', 'pg-researcher', 'pg-flower-girl']) assert.ok(!npc(id).show(), id);
});

test('đấu Pokémon huyền thoại: đúng loài và cấp; hạ gục thì bay đi, rời bản đồ quay lại là có lại; bắt được thì mất hẳn', async () => {
  const levels = { zapdos: 50, articuno: 50, moltres: 50, mewtwo: 70, mew: 40 };
  for (const legend of LEGENDS) {
    postgame();
    for (const s of ['zapdos', 'articuno', 'moltres']) state.dex.seen.add(dexId(s));
    setFlag(PG.MEW_HINT);
    addItem('pechaBerry', 5); // Mew ăn một quả mỗi lần ló ra đấu
    const def = legendNpc(legend.id);
    assert.equal(def.mon, legend.id);
    assert.ok(def.show());
    // Từ chối đấu: không có gì xảy ra
    let w = fakeWorld(legend.map, { ask: () => false });
    await def.onTalk(w);
    assert.equal(w.battles.length, 0);
    // Bỏ chạy: vẫn ở đó
    w = fakeWorld(legend.map, { battle: () => 'run' });
    await def.onTalk(w);
    assert.equal(w.battles[0].enemy.speciesId, legend.id);
    assert.equal(w.battles[0].enemy.level, levels[legend.id]);
    assert.ok(def.show(), `${legend.id}: bỏ chạy thì vẫn ở đó`);
    // Hạ gục: bay đi, còn ở bản đồ đó thì chưa quay lại; sang bản đồ khác rồi về là có lại
    w = fakeWorld(legend.map, { battle: () => 'win' });
    await def.onTalk(w);
    assert.ok(w.calls.some(([k, id]) => k === 'npcFlyAway' && id === def.id), `${legend.id}: bay đi`);
    assert.ok(!def.show());
    postgameStep(fakeWorld(legend.map));
    assert.ok(!def.show(), `${legend.id}: vẫn ở bản đồ đó thì chưa quay lại`);
    postgameStep(fakeWorld(legend.map === 'route1' ? 'home' : 'route1'));
    assert.ok(def.show(), `${legend.id}: rời bản đồ rồi thì quay lại chỗ cũ`);
    // Thua trận: vẫn ở đó
    w = fakeWorld(legend.map, { battle: () => 'lose' });
    await def.onTalk(w);
    assert.ok(def.show());
    // Bắt được: biến mất hẳn, rời bản đồ cũng không quay lại
    w = fakeWorld(legend.map, { battle: () => 'catch' });
    await def.onTalk(w);
    state.dex.caught.add(dexId(legend.id)); // BattleScene ghi vào Pokédex khi bắt được
    assert.ok(w.calls.some(([k, id]) => k === 'removeNpc' && id === def.id));
    assert.ok(!def.show());
    postgameStep(fakeWorld('route1'));
    assert.ok(!def.show(), `${legend.id}: bắt rồi thì không quay lại`);
  }
  // Pokédex đã ghi bắt được (tắt game ngay sau khi bắt, cờ chưa kịp lưu) cũng coi như đã bắt
  postgame();
  state.dex.caught.add(dexId('zapdos'));
  assert.ok(!legendAvailable('zapdos'));
  // Zapdos gọi giông: trận đấu diễn ra dưới mưa
  postgame();
  await legendNpc('zapdos').onTalk(fakeWorld('hill3', { battle: () => 'run' }));
  assert.equal(weatherOf('normal'), 'rain');
  // Mew ăn một quả Pecha mỗi lần ló ra đấu
  postgame();
  setFlag(PG.MEW_HINT);
  addItem('pechaBerry', 1);
  await legendNpc('mew').onTalk(fakeWorld('forest1', { battle: () => 'win' }));
  assert.equal(itemCount('pechaBerry'), 0);
});

test('mục tiêu hậu truyện dẫn lần lượt tới từng Pokémon huyền thoại rồi tới Pokédex', () => {
  postgame();
  assert.match(objective(), /Huyền thoại \(0\/5\): tìm Zapdos/);
  setFlag('legend:zapdos');
  assert.match(objective(), /Huyền thoại \(1\/5\): tìm Articuno ở .*Đèo Tuyết/);
  setFlag('legend:articuno');
  assert.match(objective(), /tìm Moltres ở .*Tuyến đường 7/);
  setFlag('legend:moltres');
  state.dex.seen.add(dexId('zapdos')); // đã gặp 2 chim: Mewtwo chưa lộ diện
  state.dex.seen.add(dexId('articuno'));
  assert.match(objective(), /tìm cả ba chim huyền thoại/);
  state.dex.seen.add(dexId('moltres'));
  assert.match(objective(), /Huyền thoại \(3\/5\): tìm Mewtwo ở .*Hang Vân Sơn/);
  setFlag('legend:mewtwo');
  assert.match(objective(), /hỏi cô bé hái hoa ở Rừng Thông/);
  setFlag(PG.MEW_HINT);
  assert.match(objective(), /mang theo quả Pecha/);
  addItem('pechaBerry', 1);
  assert.match(objective(), /tìm Mew ở .*Rừng Thông/);
  setFlag('legend:mew');
  assert.match(objective(), /^Hoàn thành Pokédex vùng Sơn Thủy \(\d+\/\d+\)$/);
});

test('hoá thạch: chỉ lấy được một trong hai ở Mỏ Đá Vách Núi, Tiến sĩ Thạch hồi sinh đúng loài Lv 30 và lấy hoá thạch', async () => {
  resetState();
  state.party = [createMonster('charizard', 40)];
  const q = MAPS.quarry6;
  const helix = q.objects.find((o) => o.item === 'helixFossil');
  const dome = q.objects.find((o) => o.item === 'domeFossil');
  assert.ok(objectVisible(helix) && objectVisible(dome));
  // Không lấy: cả hai vẫn còn
  let w = fakeWorld('quarry6', { ask: () => false });
  await useObject(w, helix);
  assert.ok(!itemCount('helixFossil') && objectVisible(helix) && objectVisible(dome));
  // Lấy Helix: Dome bị vùi mất
  w = fakeWorld('quarry6');
  await useObject(w, helix);
  assert.equal(itemCount('helixFossil'), 1);
  assert.ok(!objectVisible(helix) && !objectVisible(dome));
  assert.ok(said(w, /Viện Hoá thạch/));
  // Old Amber ở phòng kín Hang Sơn Động
  const amber = MAPS.cave2.objects.find((o) => o.item === 'oldAmber');
  await useObject(fakeWorld('cave2'), amber);
  assert.equal(itemCount('oldAmber'), 1);
  // Tiến sĩ Thạch: từ chối thì giữ hoá thạch; đồng ý thì hồi sinh từng cái
  const doctor = npc('pg-fossil-doctor');
  await doctor.onTalk(fakeWorld('fossilLab', { ask: () => false }));
  assert.equal(itemCount('helixFossil'), 1);
  assert.equal(state.party.length, 1);
  w = fakeWorld('fossilLab');
  await doctor.onTalk(w);
  assert.ok(!itemCount('helixFossil') && !itemCount('oldAmber'), 'hoá thạch đã đưa cho Tiến sĩ');
  const revived = state.party.slice(1);
  assert.deepEqual(revived.map((m) => [m.speciesId, m.level]), [['omanyte', 30], ['aerodactyl', 30]]);
  for (const s of ['omanyte', 'aerodactyl']) assert.ok(state.dex.caught.has(dexId(s)));
  // Đội đã đủ 6 con: Pokémon hồi sinh vào hộp PC
  state.party = Array.from({ length: 6 }, () => createMonster('pidgey', 10));
  addItem('domeFossil', 1);
  await doctor.onTalk(fakeWorld('fossilLab'));
  assert.equal(state.party.length, 6);
  assert.equal(state.storage.filter(Boolean).at(-1).speciesId, 'kabuto');
  // Hồi sinh không cần vô địch, Tiến sĩ luôn ở viện
  assert.equal(doctor.show, undefined);
  // Mỗi hoá thạch đúng loài
  assert.deepEqual(['helixFossil', 'domeFossil', 'oldAmber'].map((id) => [ITEMS[id].kind, ITEMS[id].fossil]), [['key', 'omanyte'], ['key', 'kabuto'], ['key', 'aerodactyl']]);
});

test('Pokémon hoá thạch chỉ có được bằng hồi sinh: Golbat (không còn Aerodactyl) dồn Machoke ở Mỏ Đá Vách Núi', () => {
  assert.equal(npc('v6-aerodactyl').mon, 'golbat');
  for (const n of STORY_NPCS.filter((d) => d.mon)) assert.ok(!['omanyte', 'kabuto', 'aerodactyl'].includes(n.mon), `${n.id}: ${n.mon}`);
});

test('chỗ đứng của Pokémon huyền thoại, người kể chuyện, hoá thạch: đi tới được, không chắn đường', () => {
  // Hoá thạch ở hốc đá Mỏ Đá Vách Núi (sau khi Golbat / Machoke rời đi), Old Amber ở phòng kín Hang Sơn Động
  const spots = [
    ...MAPS.quarry6.objects.filter((o) => o.item && ITEMS[o.item].fossil).map((o) => ({ id: o.id, map: 'quarry6', x: o.x, y: o.y })),
    ...MAPS.cave2.objects.filter((o) => o.item === 'oldAmber').map((o) => ({ id: o.id, map: 'cave2', x: o.x, y: o.y, from: [36, 11] })),
    ...POSTGAME_NPCS.map((n) => ({ id: n.id, map: n.map, x: n.x, y: n.y, fixed: n.fixed })),
  ];
  assert.equal(spots.filter((s) => s.id.endsWith('fossil') || s.id.endsWith('amber')).length, 3);
  for (const s of spots) {
    const m = MAPS[s.map];
    assert.ok(m, `${s.id}: thiếu bản đồ ${s.map}`);
    assert.ok(!m.isSolid(s.x, s.y) && !m.warpAt(s.x, s.y), `${s.id}: đứng trên ô cản (${s.x},${s.y})`);
    const [ex, ey] = s.from ?? entryOf(s.map);
    const all = reach(m, ex, ey);
    // Tiến sĩ đứng sau bàn: nói chuyện qua bàn
    if (s.id === 'pg-fossil-doctor') {
      assert.ok(m.info(s.x, s.y + 1).counter && all.has(`${s.x},${s.y + 2}`), 'nói chuyện với Tiến sĩ qua bàn');
      continue;
    }
    assert.ok(near(all, s.x, s.y), `${s.id}: không tới được (${s.map} ${s.x},${s.y})`);
    if (s.id.includes('fossil') || s.id.includes('amber')) continue;
    // Đứng đó không làm ô nào khác bị cô lập
    const without = reach(m, ex, ey, new Set([`${s.x},${s.y}`]));
    const lost = [...all].filter((k) => k !== `${s.x},${s.y}` && !without.has(k));
    assert.deepEqual(lost, [], `${s.id} chắn đường`);
  }
  // Viện Hoá thạch: nhà phía đông nam Thành phố Núi Đá
  const lab = MAPS.town7.buildings.find((b) => b.to === 'fossilLab');
  assert.ok(lab && MAPS.fossilLab.exit.to === 'town7');
  // Master Ball, hoá thạch có biểu tượng riêng
  for (const id of ['masterBall', 'helixFossil', 'domeFossil', 'oldAmber']) assert.ok(ITEMS[id].icon && ITEMS[id].desc, id);
});
