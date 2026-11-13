import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_RESPAWN, MAPS } from '../src/data/map.js';
import { RIDE_FRAMES, RIDE_SEAT, RIDE_SIZE, RIDE_VIEWS, RIDE_WATERLINE, hasRideArt, rideLayers } from '../src/gfx/mounts.js';
import { escapeProblem, itemProblem } from '../src/game/itemUse.js';
import { addItem, itemCount, resetState } from '../src/game/state.js';
import * as chapter1 from '../src/story/chapter1.js';

const { STORY_NPCS } = chapter1;

// Nhân vật 16x24 pixel logic (gfx/playerArt.js); người ngồi trên thú cưỡi giấu `hide` hàng dưới cùng (chân)
const RIDER_W = 16;
const RIDER_H = 24;

test('thú cưỡi: Arcanine, Lapras và khối nước Surf đủ 3 hướng x 2 nhịp, lớp trên nằm trong hình đầy đủ', () => {
  assert.deepEqual(RIDE_FRAMES.length, 6);
  for (const art of ['arcanine', 'lapras', 'surf']) {
    assert.ok(hasRideArt(art), `${art}: thiếu hình cưỡi`);
    for (const view of RIDE_VIEWS) {
      for (const f of [0, 1]) {
        const { under, over } = rideLayers(art, view, f);
        assert.equal(under.w, RIDE_SIZE.w);
        assert.equal(under.h, RIDE_SIZE.h);
        let overCount = 0;
        for (let i = 0; i < under.data.length; i++) {
          if (!over.data[i]) continue;
          overCount++;
          assert.equal(over.data[i], under.data[i], `${art} ${view}-${f}: pixel lớp trên khác lớp dưới`);
        }
        assert.ok(overCount > 0, `${art} ${view}-${f}: không có lớp che phía trước người ngồi`);
        // Chạm đất / mặt nước ở vài hàng dưới cùng của khung (đặt khung theo mép dưới ô)
        const bottom = under.data.slice((RIDE_SIZE.h - 4) * RIDE_SIZE.w).some(Boolean);
        assert.ok(bottom, `${art} ${view}-${f}: hình không chạm đất`);
      }
    }
  }
});

test('thú cưỡi: người ngồi trên lưng (không lơ lửng, không chìm mất thân trên), nhìn ngang thì lộ cả thân trên', () => {
  const { w: W, h: H } = RIDE_SIZE;
  for (const [art, views] of Object.entries(RIDE_SEAT)) {
    for (const view of RIDE_VIEWS) {
      const { dx, seat, hide } = views[view];
      assert.ok(hide >= 3 && hide <= 8, `${art} ${view}: giấu ${hide} hàng (chỉ giấu chân / cẳng chân)`);
      // Mép dưới phần người còn lại nằm ở hàng H - seat; người ngồi giữa khung, lệch dx về phía lưng
      const bottom = H - seat;
      const cx = W / 2 + dx;
      const { under, over } = rideLayers(art, view, 0);
      // Ngay dưới mông là lưng thú cưỡi (trong 3 hàng)
      let seated = false;
      for (let y = bottom - 1; y <= bottom + 2 && !seated; y++) {
        for (let x = cx - 3; x <= cx + 3; x++) if (under.get(x, y)) seated = true;
      }
      assert.ok(seated, `${art} ${view}: người ngồi lơ lửng trên lưng`);
      // Phần áo (hàng 13-15 của nhân vật) không bị lớp trên che kín: vẫn thấy người ngồi. Quay mặt xuống thì đầu thú cưỡi
      // che ngực là đúng; nhìn ngang thì cả thân trên phải lộ ra trên lưng (trước đây chỉ thấy đầu người ngồi)
      const shirtTop = bottom - (RIDER_H - hide) + 13;
      let visible = 0;
      for (let y = shirtTop; y < shirtTop + 3; y++) {
        for (let x = cx - RIDER_W / 2 + 3; x < cx + RIDER_W / 2 - 3; x++) if (!over.get(x, y)) visible++;
      }
      assert.ok(visible >= (view === 'side' ? 24 : 10), `${art} ${view}: thân trên người ngồi bị che gần hết`);
    }
  }
});

test('khối nước Surf và Lapras: dưới mặt nước chỉ có bọt sóng, không có thân', () => {
  const foam = new Set(['#f0f8ff', '#bfe0ff']);
  for (const art of ['lapras', 'surf']) {
    for (const view of RIDE_VIEWS) {
      const { under } = rideLayers(art, view, 1);
      for (let y = RIDE_WATERLINE; y < RIDE_SIZE.h; y++) {
        for (let x = 0; x < RIDE_SIZE.w; x++) {
          const c = under.get(x, y);
          if (c) assert.ok(foam.has(c), `${art} ${view}: pixel ${c} dưới mặt nước (${x},${y})`);
        }
      }
    }
  }
});

test('Lão Ngư Hồ Lạnh: thua Gyarados chúa (đã về chỗ hồi phục) thì lão không nói tiếp; bỏ chạy thì hẹn lần sau', async () => {
  resetState();
  addItem('goodRod');
  const said = [];
  let result = 'lose';
  const world = {
    say: async (who, lines) => said.push(...lines),
    ask: async () => true,
    giveItem: async (id) => addItem(id),
    assignHotbar: () => null,
    startBattle: async () => result,
  };
  const old = STORY_NPCS.find((n) => n.id === 'r10-rod-giver');
  await old.onTalk(world);
  assert.ok(!said.some((l) => /lặn mất/.test(l)), 'thua thì người chơi đang ở Pokémon Center, lão không đứng đó');
  assert.equal(itemCount('superRod'), 0);
  result = 'run';
  await old.onTalk(world);
  assert.ok(said.some((l) => /lặn mất/.test(l)));
  result = 'catch';
  await old.onTalk(world);
  assert.equal(itemCount('superRod'), 1);
});

test('Escape Rope: không dùng ở nơi hồi phục (kể cả tầng trên nhà mình), trong phòng Tứ Thiên Vương thì không thoát ra được', () => {
  const center = { map: 'center', ...MAPS.center.heal };
  assert.match(escapeProblem(MAPS.home2f, HOME_RESPAWN, MAPS), /nơi hồi phục/);
  assert.match(escapeProblem(MAPS.home, HOME_RESPAWN, MAPS), /nơi hồi phục/);
  assert.match(escapeProblem(MAPS.center, center, MAPS), /nơi hồi phục/);
  assert.equal(escapeProblem(MAPS.route2, center, MAPS), null);
  assert.equal(escapeProblem(MAPS.cave1, center, MAPS), null);
  for (const id of ['elite1', 'elite2', 'elite3', 'elite4', 'champion']) {
    assert.match(escapeProblem(MAPS[id], { map: 'leagueLobby', ...MAPS.leagueLobby.heal }, MAPS), /Liên minh/, id);
  }
});

test('dọn code: không còn hook arrivalTrigger bỏ trống; lời nhắc đồ cầm chỉ đúng cách cho cầm hiện tại', () => {
  assert.equal(chapter1.arrivalTrigger, undefined);
  assert.match(itemProblem('leftovers', null), /Cho cầm/);
  assert.doesNotMatch(itemProblem('leftovers', null), /Cho cầm vật phẩm/);
});

test('hướng dẫn viên gym: chưa có huy hiệu thì giải thích câu đố, có rồi (câu đố đã tắt) thì chúc mừng', async () => {
  const { GYM_GUIDES } = await import('../src/data/gymPeople.js');
  const { state } = await import('../src/game/state.js');
  resetState();
  assert.equal(GYM_GUIDES.length, 8);
  for (const [i, badge] of ['wind', 'grass', 'electric', 'water', 'fire', 'rock', 'psychic', 'ice'].entries()) {
    const guide = GYM_GUIDES[i];
    assert.equal(guide.map, `gym${i + 1}`);
    const said = [];
    const world = { say: async (who, lines) => said.push(...lines) };
    await guide.onTalk.call(guide, world);
    assert.deepEqual(said, guide.lines, `${guide.map}: chưa có huy hiệu thì giải thích câu đố`);
    state.badges.add(badge);
    said.length = 0;
    await guide.onTalk.call(guide, world);
    assert.ok(said.some((l) => /đã tắt/.test(l)), `${guide.map}: có huy hiệu rồi mà vẫn giải thích câu đố`);
  }
});
