import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/data/map.js';
import { HOME_DX } from '../src/data/indoorLayout.js';
import { TRAINERS } from '../src/data/npcs.js';
import { ENCOUNTERS, encountersAt, rollEncounter } from '../src/data/encounters.js';
import { GAME_DAY_MS, PHASES, gameClock } from '../src/game/clock.js';
import { hasFlag, resetState, setFlag, state } from '../src/game/state.js';
import { forfeitable, rematchable, trainerBeaten, trainerForfeit, trainerReady } from '../src/game/trainers.js';
import { F, STORY_NPCS, objectVisible, objective } from '../src/story/chapter1.js';

const DAY = 24 * 3600 * 1000;
const def = (id) => [...TRAINERS, ...STORY_NPCS].find((t) => t.id === id);

test('đồng hồ game: 1 ngày thật = 3 ngày game, mỗi buổi dài bằng nhau', () => {
  assert.equal(GAME_DAY_MS * 3, DAY);
  const at = (h, m = 0) => gameClock(new Date(2026, 0, 1, h, m));
  assert.equal(at(0).phase, 'day');
  assert.equal(at(2, 39).phase, 'day');
  assert.equal(at(2, 40).phase, 'dusk');
  assert.equal(at(5, 20).phase, 'night');
  assert.equal(at(8).phase, 'day', 'sau 8 tiếng thật là sang ngày game mới');
  assert.equal(at(18, 40).phase, 'dusk');
  assert.equal(at(0).left, GAME_DAY_MS / 3);
  // Buổi nào cũng chiếm đúng 1/3 thời gian thật trong ngày
  const count = { day: 0, dusk: 0, night: 0 };
  for (let m = 0; m < 24 * 60; m++) count[gameClock(new Date(2026, 0, 1, 0, m)).phase]++;
  assert.deepEqual(count, { day: 480, dusk: 480, night: 480 });
});

test('nhà huấn luyện dọc đường đấu lại được sau 3-4 ngày; gym, thủ lĩnh, cốt truyện thì không', () => {
  resetState();
  const route = TRAINERS.find((t) => rematchable(t));
  const gym = TRAINERS.find((t) => t.map.startsWith('gym') && !t.noRematch);
  const leader = def('leader-wind');
  assert.ok(route && gym && leader);
  assert.equal(rematchable(gym), false);
  assert.equal(rematchable(leader), false);

  const now = Date.now();
  trainerBeaten(route, now);
  trainerBeaten(gym, now);
  trainerBeaten(leader, now);
  assert.equal(trainerReady(route, now + 3 * DAY - 1), false, 'chưa đủ 3 ngày');
  assert.equal(trainerReady(route, now + 4 * DAY + 1), true, 'quá 4 ngày thì chắc chắn đấu lại được');
  assert.ok(state.defeatedTrainers.has(route.id), 'đấu lại được nhưng vẫn tính là đã từng thắng (nhiệm vụ)');
  assert.equal(trainerReady(gym, now + 30 * DAY), false);
  assert.equal(trainerReady(leader, now + 30 * DAY), false);
});

test('tắt game giữa trận: trainer thường tính là thua, thủ lĩnh / cốt truyện thì không', () => {
  resetState();
  const route = TRAINERS.find((t) => rematchable(t));
  assert.equal(forfeitable(route), true);
  assert.equal(forfeitable(def('leader-wind')), false);
  assert.equal(forfeitable(def('elite-lan')), false);
  const now = Date.now();
  trainerForfeit(route.id, now);
  assert.equal(trainerReady(route, now + DAY), false, 'thua do gián đoạn: phải chờ');
  assert.equal(state.defeatedTrainers.has(route.id), false, 'không tính là đã thắng');
  assert.equal(trainerReady(route, now + 4 * DAY + 1), true);
});

test('Team Rocket: đứng hàng ngang trước cửa Poké Mart, thua cả hai trận thì bỏ lại gói hàng', () => {
  resetState();
  const rockets = STORY_NPCS.filter((n) => n.id.startsWith('rocket-pallet-'));
  assert.deepEqual(rockets.map((r) => [r.map, r.x, r.y]), [['town1', 40, 16], ['town1', 41, 16], ['town1', 42, 16]], 'ở Thị trấn Lục Bình');
  assert.ok(rockets.some((r) => r.mon === 'meowth'));
  assert.ok(!STORY_NPCS.some((n) => n.id === 'rocket-boss'), 'không còn chỉ huy Rocket');
  const door = MAPS.town1.buildings.find((b) => b.to === 'mart').door;
  assert.ok(rockets.some((r) => r.x === door.x && r.y === door.y + 1), 'chặn ngay trước cửa');

  const parcel = MAPS.town1.objects.find((o) => o.item === 'martParcel');
  for (const f of [F.MOM, F.MET_OAK, F.STARTER, F.RIVAL1, F.DEX, F.QUEST_DONE, F.RIVAL2]) setFlag(f);
  state.visited.add('town1');
  assert.equal(objective(), 'Đến Poké Mart Lục Bình xem có chuyện gì');
  assert.equal(objectVisible(parcel), false, 'chưa đánh thì chưa có gói hàng');
  assert.ok(rockets.every((r) => r.show()));
  setFlag('rocket:pallet:hung');
  assert.ok(rockets.every((r) => r.show()), 'thắng một người thì cả bọn vẫn đứng đó');
  setFlag(F.GRUNTS);
  assert.ok(rockets.every((r) => !r.show()), 'thắng cả hai thì bỏ chạy');
  assert.equal(objectVisible(parcel), true);
  assert.match(objective(), /gói hàng/);
  setFlag(`item:${parcel.id}`);
  setFlag(F.BOSS);
  assert.equal(objectVisible(parcel), false);
  assert.equal(objective(), 'Mang gói hàng vào trả cho Poké Mart Lục Bình');
  assert.ok(hasFlag(F.BOSS));
});

test('Team Rocket xuất hiện lại theo hành trình: chặn đúng lối, đội hình mạnh dần', () => {
  resetState();
  const groups = {};
  for (const n of STORY_NPCS.filter((d) => d.id.startsWith('rocket-'))) (groups[n.id.split('-')[1]] ??= []).push(n);
  assert.deepEqual(Object.keys(groups), ['pallet', 'cave1', 'town4', 'town6', 'town9']);
  for (const [id, npcs] of Object.entries(groups)) {
    const m = MAPS[npcs[0].map];
    for (const n of npcs) {
      assert.ok(!m.isSolid(n.x, n.y), `${n.id} đứng trên ô chặn`);
      assert.ok(!m.isSolid(n.x, n.y + 1), `${n.id}: ô trước mặt không đi được`);
      assert.ok(!(m.objects ?? []).some((o) => o.x === n.x && o.y === n.y && !o.after), `${n.id} chồng lên đồ vật`);
    }
    // Chặn kín: lối đi qua hàng của chúng chỉ có các ô chúng đứng
    if (id !== 'pallet') {
      const door = m.buildings?.find((b) => b.door.x >= npcs[0].x && b.door.x <= npcs[2].x && b.door.y === npcs[0].y - 1);
      const corridor = [npcs[0].x - 1, npcs[2].x + 1].every((x) => m.isSolid(x, npcs[0].y - 1));
      assert.ok(door || corridor, `${id}: không chặn cửa hay lối hẹp nào`);
    }
  }
  // Hang Thạch Nhũ: xuất hiện sau chương 1, trước huy hiệu đầu tiên
  setFlag(F.DONE);
  assert.ok(groups.cave1.every((n) => n.show()));
  state.badges.add('wind');
  assert.ok(groups.cave1.every((n) => !n.show()), 'đã qua hang thì không chặn nữa (bản lưu cũ)');
  for (const [badge, id] of [['grass', 'town4'], ['water', 'town6'], ['psychic', 'town9']]) {
    assert.ok(!groups[id][0].show());
    state.badges.add(badge);
    assert.ok(groups[id][0].show(), `${id} xuất hiện sau huy hiệu ${badge}`);
  }
});

test('Pokémon theo buổi: buổi nào mỗi khu cũng có ít nhất 2 loài, gặp đúng loài của buổi', () => {
  const timed = Object.entries(ENCOUNTERS).filter(([, t]) => t.some((e) => e.time));
  assert.ok(timed.length >= 20, 'phần lớn bụi cỏ có loài theo buổi');
  for (const [zone, table] of Object.entries(ENCOUNTERS)) {
    for (const phase of PHASES) {
      const here = encountersAt(zone, phase);
      assert.ok(new Set(here.map((e) => e.species)).size >= Math.min(2, table.length), `${zone} buổi ${phase} quá ít loài`);
      for (let r = 0; r < 1; r += 0.05) {
        const { speciesId } = rollEncounter(zone, () => r, null, phase);
        assert.ok(here.some((e) => e.species === speciesId), `${zone} buổi ${phase} ra ${speciesId}`);
      }
    }
  }
  // Lướt nước cũng chia theo buổi; hang và câu cá thì không
  for (const zone of ['pallet-lake-surf', 'route3-surf', 'route6-surf', 'route10-surf']) assert.ok(ENCOUNTERS[zone].some((e) => e.time), zone);
  for (const [zone, t] of Object.entries(ENCOUNTERS)) {
    if (/cave|-(old|good|super)$/.test(zone)) assert.ok(!t.some((e) => e.time), `${zone} không chia theo buổi`);
  }
  // Có loài riêng cho từng buổi, và có loài xuất hiện cả ngày
  for (const phase of PHASES) assert.ok(Object.values(ENCOUNTERS).flat().some((e) => e.time === phase), phase);
  assert.ok(Object.values(ENCOUNTERS).flat().some((e) => !e.time));
});

test('Rare Candy: 1 viên = 1 cấp, chỉ bán ở trung tâm thương mại, nhặt lại được sau 3 ngày', async () => {
  const { ITEMS, MART_TIERS, STORE_STOCK } = await import('../src/data/items.js');
  const { applyItem, itemProblem } = await import('../src/game/itemUse.js');
  const { createMonster, MAX_LEVEL } = await import('../src/game/monster.js');
  resetState();
  assert.equal(ITEMS.rareCandy.price, 15000);
  assert.ok(STORE_STOCK.general.includes('rareCandy'));
  assert.ok(!Object.values(MART_TIERS).flat().includes('rareCandy'), 'Poké Mart thường không bán');
  const mon = createMonster('charmander', 15);
  assert.equal(itemProblem('rareCandy', mon, { inBattle: true }), 'Không dùng được trong trận đấu.');
  assert.equal(itemProblem('rareCandy', mon), null);
  const lines = applyItem('rareCandy', mon);
  assert.equal(mon.level, 16);
  assert.match(lines[0], /lên cấp 16/);
  mon.hp = 0;
  assert.equal(itemProblem('rareCandy', mon), null, 'Pokémon đã gục vẫn ăn được');
  mon.level = MAX_LEVEL;
  assert.match(itemProblem('rareCandy', mon), /cấp tối đa/);

  const spots = Object.values(MAPS).flatMap((m) => (m.objects ?? []).filter((o) => o.item === 'rareCandy').map((o) => [m, o]));
  assert.ok(spots.length >= 4);
  for (const [m, o] of spots) {
    assert.equal(o.respawnDays, 3);
    assert.ok(!m.isSolid(o.x, o.y) && !m.info(o.x, o.y).encounter, `${o.id} nằm sai chỗ`);
    assert.equal(objectVisible(o), true);
  }
  const [, o] = spots[0];
  state.itemRespawn[o.id] = Date.now() + 3 * DAY;
  assert.equal(objectVisible(o), false, 'vừa nhặt thì chưa có');
  state.itemRespawn[o.id] = Date.now() - 1;
  assert.equal(objectVisible(o), true, '3 ngày sau lại có');
});

test('vật phẩm rơi: có món giữa bụi cỏ, có món phải lướt nước mới lấy được (trên mặt nước / cồn cát), món nào cũng tới nhặt được và không chắn lối', () => {
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let grass = 0;
  let water = 0;
  for (const m of Object.values(MAPS).filter((mm) => !mm.indoor)) {
    const items = (m.objects ?? []).filter((o) => o.kind === 'item' && !o.after);
    // Đi được (lướt nước tính là đi được), vật phẩm và cây chắn đường
    const solidObj = (x, y, skip) => (m.objects ?? []).some((o) => o !== skip && o.x === x && o.y === y && (o.kind === 'item' || o.kind === 'berry'));
    const open = (x, y, skip) => x >= 0 && y >= 0 && x < m.width && y < m.height && (!m.isSolid(x, y) || m.tileAt(x, y) === 'w') && !solidObj(x, y, skip);
    // Đi từ mọi ô chuyển bản đồ (cửa hang, thang giữa các tầng, lối sang bản đồ bên cạnh): bản đồ có thể bị vách chia
    // thành nhiều khu, khu nào cũng phải có lối vào
    const reachable = (skip) => {
      const starts = (m.warps ?? []).filter((w) => open(w.x, w.y, skip)).map((w) => `${w.x},${w.y}`);
      const seen = new Set(starts);
      const queue = starts.map((k) => k.split(',').map(Number));
      while (queue.length) {
        const [x, y] = queue.pop();
        for (const [dx, dy] of D) {
          const k = `${x + dx},${y + dy}`;
          if (!seen.has(k) && open(x + dx, y + dy, skip)) {
            seen.add(k);
            queue.push([x + dx, y + dy]);
          }
        }
      }
      return seen;
    };
    for (const o of items) {
      if (m.info(o.x, o.y).encounter) grass++;
      const surfOnly = ['w', 'd'].includes(m.tileAt(o.x, o.y)); // nổi trên nước hoặc nằm trên cồn cát giữa sông / hồ
      if (surfOnly) water++;
      if (!surfOnly && !m.info(o.x, o.y).encounter) continue;
      const seen = reachable(null);
      assert.ok(D.some(([dx, dy]) => seen.has(`${o.x + dx},${o.y + dy}`)), `${m.id}: ${o.id} không tới nhặt được`);
      // Nhặt rồi thì ô đó đi lại bình thường; còn nằm đó thì không cắt đôi bản đồ
      assert.equal(reachable(o).size, seen.size + 1, `${m.id}: ${o.id} chắn lối`);
    }
  }
  assert.ok(grass >= 5, `chỉ có ${grass} món trong bụi cỏ`);
  assert.ok(water >= 4, `chỉ có ${water} món phải lướt nước mới lấy được`);
});

test('Pokémon đi theo: kiểu di chuyển ghi đúng tên loài, mặc định là đi bộ', async () => {
  const { FOLLOW_STYLE_SPECIES, followStyle } = await import('../src/data/followStyle.js');
  const { SPECIES } = await import('../src/data/monsters.js');
  for (const id of Object.keys(FOLLOW_STYLE_SPECIES)) assert.ok(SPECIES[id], `${id} không có trong game`);
  assert.equal(followStyle('pidgey'), 'fly');
  assert.equal(followStyle('gastly'), 'float');
  assert.equal(followStyle('magikarp'), 'hop');
  assert.equal(followStyle('pikachu'), 'walk');
});

test('Pokémon đi theo chỉ kêu tiếng của loài mình', async () => {
  const { CRIES, followerCry } = await import('../src/data/followStyle.js');
  const { SPECIES } = await import('../src/data/monsters.js');
  for (const id of Object.keys(CRIES)) assert.ok(SPECIES[id], `${id} không có trong game`);
  assert.equal(followerCry('pikachu', 'Pikachu', () => 0), 'Pika pika!');
  assert.equal(followerCry('rattata', 'Rattata', () => 0), 'Rat rat!');
  for (const id of Object.keys(SPECIES)) assert.ok(followerCry(id, SPECIES[id].name).length > 1, id);
});

test('lưu rồi tải lại: giữ lịch đấu lại, trận dở, Rare Candy, ô phím tắt; Tứ Thiên Vương không bị khoá sau khi tải', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame } = await import('../src/game/save.js');
  const { resetLeague } = await import('../src/story/league.js');
  const pos = { map: 'elite1', x: 6, y: 9, facing: 'up' };
  resetState();
  const lan = def('elite-lan');
  trainerBeaten(lan);
  state.trainerRest['r2-x'] = 123;
  state.pendingBattle = { wild: true };
  state.itemRespawn['route3-rare-candy'] = 456;
  state.hotbar[2] = 'potion';
  assert.ok(saveGame(pos));
  resetState();
  assert.deepEqual(loadGame(), pos);
  assert.equal(state.trainerRest['r2-x'], 123);
  assert.deepEqual(state.pendingBattle, { wild: true });
  assert.equal(state.itemRespawn['route3-rare-candy'], 456);
  assert.equal(state.hotbar[2], 'potion');
  assert.equal(state.trainerRest[lan.id], undefined, 'tải lại không gắn lịch nghỉ cho Tứ Thiên Vương');
  resetLeague();
  assert.equal(trainerReady(lan), true, 'thua ở Liên minh rồi vào lại: Lan vẫn chịu đấu');

  // Bản lưu cũ (chưa có trainerRest): trainer đã thua nghỉ 3-4 ngày, Liên minh đặt lại thì vẫn đấu được
  const old = JSON.parse(store.get('pokemon-demo-save-v1'));
  delete old.trainerRest;
  store.set('pokemon-demo-save-v1', JSON.stringify(old));
  loadGame();
  assert.ok(state.trainerRest[lan.id] > Date.now());
  resetLeague();
  assert.equal(trainerReady(lan), true);
  delete globalThis.localStorage;
});

test('đấu lại nhà huấn luyện: đội hình lên cấp theo người chơi và tiến hoá đúng cấp', async () => {
  const { rematchDef } = await import('../src/game/trainers.js');
  const { createMonster } = await import('../src/game/monster.js');
  const youngster = { id: 'x', team: [['rattata', 3], ['pidgey', 4]] };
  assert.deepEqual(rematchDef(youngster, [createMonster('charmander', 5)]).team, [['rattata', 3], ['pidgey', 4]], 'không thấp hơn đội cũ');
  assert.deepEqual(rematchDef(youngster, [createMonster('charmander', 43)]).team, [['raticate', 40], ['pidgeot', 40]]);
});

test('giờ trong game 00:00-23:59: ban ngày 06:00-14:00, chạng vạng 14:00-22:00, ban đêm 22:00-06:00', () => {
  const at = (h, m = 0) => gameClock(new Date(2026, 0, 1, h, m));
  assert.equal(at(0).time, '06:00');
  assert.equal(at(2, 40).time, '14:00');
  assert.equal(at(2, 40).phase, 'dusk');
  assert.equal(at(5, 20).time, '22:00');
  assert.equal(at(5, 20).phase, 'night');
  assert.equal(at(6).time, '00:00');
  assert.equal(at(7, 59).time, '05:57');
  assert.equal(at(8).time, '06:00', '8 tiếng thật sau là ngày game mới');
});

test('phụ tùng xe đạp nhặt rồi không xuất hiện lại, kể cả sau khi đã đổi lấy xe đạp', () => {
  resetState();
  const parts = Object.values(MAPS).flatMap((m) => (m.objects ?? []).filter((o) => o.quest === 'bike'));
  assert.equal(parts.length, 3);
  assert.ok(parts.every((o) => !objectVisible(o)), 'chưa nhận nhiệm vụ thì chưa có');
  setFlag('quest:bike');
  assert.ok(parts.every((o) => objectVisible(o)));
  for (const o of parts) setFlag(`item:${o.id}`);
  assert.ok(parts.every((o) => !objectVisible(o)));
  setFlag('quest:bike:done');
  assert.ok(parts.every((o) => !objectVisible(o)) && !parts.some((o) => o.respawnDays));
});

test('Team Rocket: đội hình theo từng nơi, bản lưu cũ được bổ sung quà của mẹ', async () => {
  const team = (id, role) => STORY_NPCS.find((n) => n.id === `rocket-${id}-${role}`);
  assert.ok(team('town9', 'mai'));
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame } = await import('../src/game/save.js');
  const { itemCount } = await import('../src/game/state.js');
  resetState();
  setFlag(F.DEX);
  saveGame({ map: 'lab', x: 6, y: 9, facing: 'down' });
  resetState();
  loadGame();
  assert.equal(itemCount('townMap'), 0, 'bản lưu mới (đang trong phòng thí nghiệm): không bỏ qua cảnh mẹ tặng quà');
  // Bản lưu cũ (phiên bản 1) đã qua đoạn này thì được bổ sung
  const raw = JSON.parse(store.get('pokemon-demo-save-v1'));
  raw.version = 1;
  store.set('pokemon-demo-save-v1', JSON.stringify(raw));
  resetState();
  loadGame();
  assert.equal(itemCount('townMap'), 1);
  assert.equal(itemCount('badgeCase'), 1);
  delete globalThis.localStorage;
});

test('nhân vật chọn khi chơi mới (tên, giới tính) được lưu; bản lưu cũ mặc định nam, chưa đặt tên', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame, saveSummary } = await import('../src/game/save.js');
  const { playerName } = await import('../src/game/state.js');
  resetState();
  assert.equal(playerName(), 'Bạn');
  state.player = { name: 'Thắng', gender: 'female' };
  saveGame({ map: 'home', x: 3, y: 5, facing: 'down' });
  resetState();
  loadGame();
  assert.deepEqual(state.player, { name: 'Thắng', gender: 'female' });
  assert.equal(playerName(), 'Thắng');
  assert.equal(saveSummary().name, 'Thắng');
  const old = JSON.parse(store.get('pokemon-demo-save-v1'));
  delete old.player;
  store.set('pokemon-demo-save-v1', JSON.stringify(old));
  loadGame();
  assert.deepEqual(state.player, { name: '', gender: 'male' });
  delete globalThis.localStorage;
});

test('HM03 Surf: thủ lĩnh Gym Nước tặng; bản lưu cũ đã có huy hiệu Nước được bổ sung', async () => {
  const { ITEMS } = await import('../src/data/items.js');
  assert.equal(ITEMS.hmSurf.teaches, 'surf');
  assert.equal(def('leader-water').gift?.item, 'hmSurf');
  assert.equal(def('leader-wind').gift, undefined);
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame } = await import('../src/game/save.js');
  const { itemCount } = await import('../src/game/state.js');
  resetState();
  state.badges.add('water');
  saveGame({ map: 'town5', x: 5, y: 9, facing: 'down' });
  const raw = JSON.parse(store.get('pokemon-demo-save-v1'));
  raw.version = 1;
  store.set('pokemon-demo-save-v1', JSON.stringify(raw));
  resetState();
  loadGame();
  assert.equal(itemCount('hmSurf'), 1);
  delete globalThis.localStorage;
});

test('hai tab cùng chơi: tab cũ không ghi đè bản lưu mới hơn của tab khác', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame, saveBlocked } = await import('../src/game/save.js');
  resetState();
  assert.ok(saveGame({ map: 'home', x: 3, y: 5, facing: 'down' }));
  loadGame();
  // Tab khác lưu sau
  const other = JSON.parse(store.get('pokemon-demo-save-v1'));
  other.session = 'tab-khac';
  other.savedAt = Date.now() + 1000;
  other.money = 999;
  store.set('pokemon-demo-save-v1', JSON.stringify(other));
  assert.equal(saveGame({ map: 'home', x: 3, y: 5, facing: 'down' }), false);
  assert.ok(saveBlocked());
  assert.equal(JSON.parse(store.get('pokemon-demo-save-v1')).money, 999, 'không ghi đè');
  loadGame();
  assert.equal(saveBlocked(), false, 'tải lại thì lưu tiếp được');
  delete globalThis.localStorage;
});

test('bản lưu có vật phẩm / chiêu không còn trong game: tải lên được, bỏ id lạ', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame } = await import('../src/game/save.js');
  const { createMonster } = await import('../src/game/monster.js');
  resetState();
  const mon = createMonster('rattata', 10);
  mon.moves.push('khongCo');
  mon.heldItem = 'doCu';
  state.party = [mon];
  state.bag.doCu = 2;
  state.hotbar[0] = 'doCu';
  saveGame({ map: 'home', x: 3, y: 5, facing: 'down' });
  resetState();
  loadGame();
  assert.ok(!state.party[0].moves.includes('khongCo'));
  assert.equal(state.party[0].heldItem, null);
  assert.equal(state.bag.doCu, undefined);
  assert.equal(state.hotbar[0], null);
  delete globalThis.localStorage;
});

test('nhà 2 tầng: chơi mới thức dậy ở phòng ngủ tầng 2, cầu thang nối hai tầng, mẹ ngồi sofa ở tầng 1', async () => {
  const { SPAWN, HOME_RESPAWN } = await import('../src/data/map.js');
  const up = MAPS.home;
  const down = MAPS.home2f;
  assert.equal(SPAWN.map, 'home2f');
  assert.equal(down.tileAt(SPAWN.x - 1, SPAWN.y), 'B', 'thức dậy cạnh giường');
  // Ô cầu thang ở mỗi tầng là ô chuyển sang tầng kia
  const stairs = (m, ch) => m.rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === ch ? [{ x, y }] : [])));
  for (const [m, ch, to] of [[up, 'S', 'home2f'], [down, 's', 'home']]) {
    const cells = stairs(m, ch);
    assert.ok(cells.length > 0, `${m.id}: thiếu cầu thang`);
    for (const c of cells) assert.equal(m.warpAt(c.x, c.y)?.to, to, `${m.id} (${c.x},${c.y}): cầu thang không dẫn tới ${to}`);
  }
  assert.equal(down.exit, undefined, 'tầng 2 không có cửa ra ngoài');
  // Bộ sofa đối xứng hai bên bàn nước
  for (let y = 0; y < up.height; y++) {
    const row = up.rows[y];
    assert.equal(row.split('[').length, row.split(']').length, `hàng ${y}: sofa hai bên không đối xứng`);
    const l = row.indexOf('[');
    if (l >= 0) assert.equal(row.indexOf(']') - l - 1 > 0 && /^t+$/.test(row.slice(l + 1, row.indexOf(']'))), true, `hàng ${y}: giữa hai sofa phải là bàn`);
  }
  const mom = STORY_NPCS.find((n) => n.id === 'mom');
  assert.equal(mom.map, 'home');
  assert.ok(mom.seated && up.info(mom.x, mom.y).sofa === mom.facing, 'mẹ ngồi sofa, quay mặt vào bàn');
  // Thua trận khi chưa ghé Pokémon Center: tỉnh dậy đứng ngay cạnh mẹ, quay mặt về phía mẹ
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const [dx, dy] = DIRS[HOME_RESPAWN.facing];
  assert.deepEqual([HOME_RESPAWN.x + dx, HOME_RESPAWN.y + dy], [mom.x, mom.y]);
});

test('lời mô tả đồ đạc trong nhà nằm đúng trên đồ đạc (ô cản, không phải cầu thang)', () => {
  for (const id of ['home', 'home2f']) {
    const m = MAPS[id];
    for (const key of Object.keys(m.signs)) {
      const [x, y] = key.split(',').map(Number);
      assert.ok(m.isSolid(x, y), `${id} (${key}): không phải đồ đạc`);
      assert.ok(!m.warpAt(x, y), `${id} (${key}): trùng cầu thang`);
    }
  }
});

test('tải bản lưu: đang lướt nước thì giữ nguyên chỗ, đứng trên đồ đạc trong nhà thì về cửa vào', async () => {
  const { resumePosition, SPAWN } = await import('../src/data/map.js');
  const water = MAPS.route1.rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === 'w' ? [{ x, y }] : [])))[0];
  const surfing = { map: 'route1', ...water, facing: 'down', vehicle: 'surf' };
  assert.deepEqual(resumePosition(surfing), surfing, 'không bị đưa về phòng ngủ');
  // Bản lưu nhà 1 tầng cũ đứng ở chỗ giờ là sofa (phòng khách nằm giữa nhà đã nới rộng: cộng HOME_DX)
  assert.ok(MAPS.home.isSolid(3 + HOME_DX, 5));
  const fixed = resumePosition({ map: 'home', x: 3 + HOME_DX, y: 5, facing: 'down' });
  assert.deepEqual([fixed.map, fixed.x, fixed.y], ['home', MAPS.home.entry.x, MAPS.home.entry.y]);
  assert.deepEqual(resumePosition({ map: 'banDoKhongCon', x: 1, y: 1 }), SPAWN);
  const ok = { map: 'home', x: 5 + HOME_DX, y: 7, facing: 'up' };
  assert.deepEqual(resumePosition(ok), ok);
});

test('thời tiết theo vùng: thường 15% mưa, vùng tuyết 80% tuyết + 20% mưa đá, vùng núi đá 80% bão cát', async () => {
  const { rollWeather, CLIMATES } = await import('../src/game/weather.js');
  const share = (climate) => {
    const count = {};
    for (let i = 0; i < 1000; i++) {
      const k = rollWeather(climate, (i + 0.5) / 1000) ?? 'clear';
      count[k] = (count[k] ?? 0) + 1;
    }
    return count;
  };
  assert.deepEqual(share('normal'), { rain: 150, clear: 850 });
  assert.deepEqual(share('snow'), { snow: 800, hail: 200 });
  assert.deepEqual(share('sand'), { sand: 800, clear: 200 });
  assert.equal(rollWeather('khongCo', 0.1), 'rain', 'vùng lạ dùng thời tiết thường');
  for (const ps of Object.values(CLIMATES)) assert.ok(ps.reduce((s, [, p]) => s + p, 0) <= 1);
  // bản đồ gắn đúng vùng khí hậu
  assert.equal(MAPS.town9.climate, 'snow');
  assert.equal(MAPS.town7.climate, 'sand');
  assert.equal(MAPS.route8.climate, 'sand');
  assert.equal(MAPS.route1.climate, 'normal');
});

test('Hang Thạch Nhũ 2 tầng: tầng 1 bị vách chia đôi, phải xuống tầng hầm rồi leo lên mới tới lối ra; Team Rocket chắn ngay trước cửa ra', () => {
  const f1 = MAPS.cave1;
  const b1 = MAPS.cave1b;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // Tìm đường qua các tầng: thang (ô chuyển bản đồ giữa cave1 và cave1b) đưa sang tầng kia
  const walk = (from, useLadders) => {
    const key = (m, x, y) => `${m.id}:${x},${y}`;
    const seen = new Set([key(from.m, from.x, from.y)]);
    const queue = [from];
    while (queue.length) {
      const { m, x, y } = queue.pop();
      const w = m.warpAt(x, y);
      if (w && useLadders && ['cave1', 'cave1b'].includes(w.to) && w.to !== m.id) {
        const k = key(MAPS[w.to], w.tx, w.ty);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push({ m: MAPS[w.to], x: w.tx, y: w.ty });
        }
      }
      for (const [dx, dy] of D) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height || m.isSolid(nx, ny)) continue;
        const k = key(m, nx, ny);
        if (!seen.has(k)) {
          seen.add(k);
          queue.push({ m, x: nx, y: ny });
        }
      }
    }
    return seen;
  };
  const entry = MAPS.town1.warps.find((w) => w.to === 'cave1');
  const exit = f1.warps.find((w) => w.to === 'route3');
  const start = { m: f1, x: entry.tx, y: entry.ty };
  assert.ok(!walk(start, false).has(`cave1:${exit.x},${exit.y}`), 'không đi thẳng tới lối ra trên tầng 1');
  assert.ok(walk(start, true).has(`cave1:${exit.x},${exit.y}`), 'đi qua tầng hầm thì tới được lối ra');
  assert.equal(b1.warps.length, 2);
  assert.ok(b1.warps.every((w) => w.to === 'cave1'));
  // Nhà huấn luyện ở cả hai tầng, Team Rocket chắn hành lang trước cửa ra
  assert.ok(TRAINERS.filter((t) => t.map === 'cave1').length >= 2 && TRAINERS.filter((t) => t.map === 'cave1b').length >= 2);
  const rocket = STORY_NPCS.filter((n) => n.map === 'cave1' && n.id.startsWith('rocket-'));
  assert.ok(rocket.length >= 2);
  for (const n of rocket) assert.ok(Math.abs(n.y - exit.y) <= 2 && Math.abs(n.x - exit.x) <= 1, `${n.id} đứng ngay trước cửa ra`);
  // Mỗi tầng có vật phẩm ở các ngách
  assert.ok(f1.objects.filter((o) => o.kind === 'item').length >= 5 && b1.objects.filter((o) => o.kind === 'item').length >= 3);
});

test('toàn vùng: từ Pallet đi tới được mọi bản đồ (lối đi, cửa hang, thang, cửa nhà, ô dịch chuyển), không bản đồ nào bị bỏ rơi', () => {
  const seen = new Set(['route1']);
  const queue = ['route1'];
  while (queue.length) {
    const m = MAPS[queue.shift()];
    const next = [
      ...(m.warps ?? []).map((w) => w.to),
      ...(m.buildings ?? []).filter((b) => b.to).map((b) => b.to),
      ...(m.exit ? [m.exit.to] : []),
    ];
    for (const id of next) {
      if (!seen.has(id) && MAPS[id]) {
        seen.add(id);
        queue.push(id);
      }
    }
  }
  const missing = Object.keys(MAPS).filter((id) => !seen.has(id));
  assert.deepEqual(missing, [], `không tới được: ${missing.join(', ')}`);
});
