import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage giả (Node không có): cài trước khi nạp game/settings.js
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  KEY_ACTIONS, actionsForCode, clearBinding, defaultBindings, getBindings, hotbarSlotOf, keyLabel, keyName, loadBindings,
  fillKeyNames, resetBindings, setBinding,
} = await import('../src/game/keybinds.js');
const { directionOf, isCancel, isConfirm } = await import('../src/ui/input.js');
const { settings } = await import('../src/game/settings.js');

const key = (code, extra = {}) => ({ code, repeat: false, ...extra });
const SETTINGS_KEY = 'pokemon-demo-settings-v1';

beforeEach(() => resetBindings());

test('phím mặc định: di chuyển mũi tên + WASD, xác nhận Enter / Space, quay lại Esc / X, phím tắt chữ cái, ô 1-6 (cả bàn phím số)', () => {
  const b = getBindings();
  assert.deepEqual(b.up, ['ArrowUp', 'KeyW']);
  assert.deepEqual(b.left, ['ArrowLeft', 'KeyA']);
  assert.deepEqual(b.confirm, ['Enter', 'Space']);
  assert.deepEqual(b.cancel, ['Escape', 'KeyX']);
  assert.deepEqual(b.party, ['KeyM', null]);
  assert.deepEqual(b.bag, ['KeyB', null]);
  assert.deepEqual(b.dex, ['KeyP', null]);
  assert.deepEqual(b.trainer, ['KeyT', null]);
  assert.deepEqual(b.map, ['KeyN', null]);
  assert.deepEqual(b.bike, ['KeyC', null]);
  assert.deepEqual(b.ride, ['KeyR', null]);
  assert.deepEqual(b.slot1, ['Digit1', 'Numpad1']);
  assert.deepEqual(b.slot6, ['Digit6', 'Numpad6']);
  // Esc / X vừa là quay lại vừa mở Cài đặt (trên bản đồ)
  assert.deepEqual(actionsForCode('Escape').sort(), ['cancel', 'settings']);
  assert.equal(hotbarSlotOf(key('Digit3')), 2);
  assert.equal(hotbarSlotOf(key('Numpad6')), 5);
  assert.equal(hotbarSlotOf(key('Digit7')), null);
  // Mọi hành động có nhãn tiếng Việt, không có H (bảng trợ giúp cũ)
  assert.ok(KEY_ACTIONS.every((a) => a.label));
  assert.deepEqual(actionsForCode('KeyH'), []);
});

test('isConfirm / isCancel / directionOf theo bảng phím, NumpadEnter như Enter, bỏ qua phím giữ lặp', () => {
  assert.ok(isConfirm(key('Enter')) && isConfirm(key('NumpadEnter')) && isConfirm(key('Space')));
  assert.ok(!isConfirm(key('Enter', { repeat: true })));
  assert.ok(isCancel(key('Escape')) && isCancel(key('KeyX')));
  assert.equal(directionOf(key('KeyW')), 'up');
  assert.equal(directionOf(key('ArrowRight')), 'right');
  assert.equal(directionOf(key('KeyQ')), null);

  assert.ok(setBinding('confirm', 1, 'KeyZ').ok);
  assert.ok(isConfirm(key('KeyZ')) && !isConfirm(key('Space')));
  assert.ok(setBinding('cancel', 0, 'Backspace').ok);
  assert.ok(isCancel(key('Backspace')) && !isCancel(key('Escape')));
  assert.ok(setBinding('up', 1, 'KeyI').ok);
  assert.equal(directionOf(key('KeyI')), 'up');
  assert.equal(directionOf(key('KeyW')), null);
});

test('đổi phím trùng với hành động khác thì hai bên đổi phím cho nhau', () => {
  // Túi đồ sang I: B được giải phóng
  let r = setBinding('bag', 0, 'KeyI');
  assert.ok(r.ok);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(actionsForCode('KeyI'), ['bag']);
  assert.deepEqual(actionsForCode('KeyB'), []);
  // Túi đồ sang M (của Đội hình): Đội hình nhận lại I
  r = setBinding('bag', 0, 'KeyM');
  assert.deepEqual(r, { ok: true, changed: ['party'] });
  assert.deepEqual(getBindings().party, ['KeyI', null]);
  assert.deepEqual(getBindings().bag, ['KeyM', null]);
  // Ô trống (phím phụ) lấy phím của hành động khác: hành động kia mất phím đó (không bắt buộc nên được)
  r = setBinding('dex', 1, 'KeyC');
  assert.deepEqual(r, { ok: true, changed: ['bike'] });
  assert.deepEqual(getBindings().bike, [null, null]);
  // Phím phụ trùng phím chính của chính nó: đổi chỗ hai ô
  assert.ok(setBinding('up', 0, 'KeyW').ok);
  assert.deepEqual(getBindings().up, ['KeyW', 'ArrowUp']);
  // Gán X (của cả Quay lại và Cài đặt) cho Túi đồ: cả hai nhận phím cũ của Túi đồ (M)
  r = setBinding('bag', 0, 'KeyX');
  assert.ok(r.ok);
  assert.deepEqual(r.changed.sort(), ['cancel', 'settings']);
  assert.deepEqual(getBindings().cancel, ['Escape', 'KeyM']);
  assert.deepEqual(getBindings().settings, ['KeyM', 'Escape']);
  // Không phím nào thuộc hai hành động (trừ cặp Quay lại / Cài đặt)
  for (const [code, ids] of Object.entries(groupByCode())) {
    const others = ids.filter((id) => id !== 'cancel' && id !== 'settings');
    assert.ok(others.length <= 1 && (others.length === 0 || ids.length === 1), `${code}: ${ids}`);
  }
});

function groupByCode() {
  const out = {};
  for (const [id, keys] of Object.entries(getBindings())) for (const k of keys) if (k) (out[k] ??= []).push(id);
  return out;
}

test('không bỏ được phím cuối cùng của xác nhận / quay lại / di chuyển', () => {
  assert.ok(clearBinding('confirm', 1));
  assert.equal(clearBinding('confirm', 0), false);
  assert.deepEqual(getBindings().confirm, ['Enter', null]);
  assert.ok(clearBinding('cancel', 0));
  assert.equal(clearBinding('cancel', 1), false);
  assert.ok(isCancel(key('KeyX')));
  assert.ok(clearBinding('left', 1));
  assert.equal(clearBinding('left', 0), false);
  // Lấy mất phím duy nhất của xác nhận bằng cách gán cho ô trống của hành động khác: bị chặn, không đổi gì
  const before = getBindings();
  const r = setBinding('party', 1, 'Enter');
  assert.equal(r.ok, false);
  assert.equal(r.blocked, 'confirm');
  assert.deepEqual(getBindings(), before);
  // Hành động không bắt buộc thì bỏ hết phím được
  assert.ok(clearBinding('party', 0));
  assert.deepEqual(getBindings().party, [null, null]);
  // Tab không gán được
  assert.equal(setBinding('bag', 0, 'Tab').ok, false);
});

test('lưu bảng phím vào cài đặt (localStorage) và đọc lại được y nguyên; bản lưu cũ / lỗi thì dùng mặc định', () => {
  setBinding('bag', 0, 'KeyI');
  setBinding('confirm', 1, 'KeyZ');
  clearBinding('slot6', 1);
  const saved = JSON.parse(store.get(SETTINGS_KEY));
  assert.deepEqual(saved.keybinds, getBindings());
  assert.deepEqual(settings.keybinds, getBindings());
  assert.deepEqual(loadBindings(saved.keybinds), getBindings());
  // Cài đặt cũ chưa có bảng phím, hoặc thiếu hành động mới: phím mặc định
  assert.deepEqual(loadBindings(undefined), defaultBindings());
  const partial = { bag: ['KeyI', null] };
  assert.deepEqual(loadBindings(partial).bag, ['KeyI', null]);
  assert.deepEqual(loadBindings(partial).dex, ['KeyP', null]);
  // Bảng hỏng (trùng phím, mất hết phím xác nhận, kiểu sai) thì quay về mặc định cả bảng
  assert.deepEqual(loadBindings({ bag: ['KeyM', null] }), defaultBindings());
  assert.deepEqual(loadBindings({ confirm: [null, null] }), defaultBindings());
  assert.deepEqual(loadBindings({ bag: 'KeyB' }), defaultBindings());
  assert.deepEqual(loadBindings({ bag: [42, null] }), defaultBindings());
  resetBindings();
  assert.deepEqual(JSON.parse(store.get(SETTINGS_KEY)).keybinds, defaultBindings());
});

test('tên phím dễ đọc và lời thoại nhắc phím theo phím hiện tại', () => {
  assert.equal(keyName('KeyM'), 'M');
  assert.equal(keyName('Digit1'), '1');
  assert.equal(keyName('Numpad1'), 'Numpad 1');
  assert.equal(keyName('ArrowUp'), '↑');
  assert.equal(keyName('Escape'), 'Esc');
  assert.equal(keyName('Space'), 'Space');
  assert.equal(keyName('Enter'), 'Enter');
  assert.equal(keyLabel('dex'), 'P');
  assert.equal(fillKeyNames('Bấm {key:dex} để mở Pokédex nha!'), 'Bấm P để mở Pokédex nha!');
  setBinding('dex', 0, 'KeyO');
  assert.equal(fillKeyNames('Bấm {key:dex} để mở Pokédex nha!'), 'Bấm O để mở Pokédex nha!');
  clearBinding('bike', 0);
  assert.equal(fillKeyNames('Bấm {key:bike}'), 'Bấm …');
});
