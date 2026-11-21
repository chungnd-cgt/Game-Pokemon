import { setSetting, settings } from './settings.js';

// Bảng phím: mỗi hành động có tối đa 2 phím (chính / phụ), ghi theo KeyboardEvent.code (vị trí phím trên bàn phím,
// không theo ký tự) nên bật bộ gõ tiếng Việt (Telex / VNI) vẫn nhận đúng. Người chơi đổi phím trong Cài đặt → Điều khiển
// (bảng phím trong ui/SettingsPanel.js), lưu trong cài đặt (game/settings.js, mục keybinds).
//  required: hành động bắt buộc luôn còn ít nhất một phím (di chuyển, xác nhận, quay lại) để không bị kẹt trong menu
export const KEY_ACTIONS = [
  { id: 'up', label: 'Đi lên', keys: ['ArrowUp', 'KeyW'], required: true },
  { id: 'down', label: 'Đi xuống', keys: ['ArrowDown', 'KeyS'], required: true },
  { id: 'left', label: 'Đi sang trái', keys: ['ArrowLeft', 'KeyA'], required: true },
  { id: 'right', label: 'Đi sang phải', keys: ['ArrowRight', 'KeyD'], required: true },
  { id: 'confirm', label: 'Xác nhận / nói chuyện', keys: ['Enter', 'Space'], required: true },
  { id: 'cancel', label: 'Quay lại / huỷ', keys: ['Escape', 'KeyX'], required: true },
  { id: 'party', label: 'Đội hình', keys: ['KeyM', null] },
  { id: 'bag', label: 'Túi đồ', keys: ['KeyB', null] },
  { id: 'dex', label: 'Pokédex', keys: ['KeyP', null] },
  { id: 'trainer', label: 'Thẻ HLV', keys: ['KeyT', null] },
  { id: 'map', label: 'Bản đồ vùng', keys: ['KeyN', null] },
  { id: 'settings', label: 'Cài đặt', keys: ['KeyX', 'Escape'] },
  { id: 'bike', label: 'Xe đạp', keys: ['KeyC', null] },
  { id: 'ride', label: 'Cưỡi thú', keys: ['KeyR', null] },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `slot${n}`, label: `Ô phím tắt ${n}`, keys: [`Digit${n}`, `Numpad${n}`] })),
];

export const HOTBAR_ACTIONS = KEY_ACTIONS.filter((a) => a.id.startsWith('slot')).map((a) => a.id);
export const DIRECTION_ACTIONS = ['up', 'down', 'left', 'right'];
const ACTION = Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a]));

// Hai hành động được dùng chung phím: trên bản đồ "Quay lại" chính là mở Cài đặt (mặc định cùng Esc / X)
const SHARED = new Set(['cancel|settings', 'settings|cancel']);
const canShare = (a, b) => SHARED.has(`${a}|${b}`);

// Phím không gán được: Tab (đổi ngăn túi đồ / thẻ Pokédex), phím hệ điều hành, F5 / F11 / F12 của trình duyệt
const UNBINDABLE = new Set(['', 'Unidentified', 'Tab', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ContextMenu', 'F5', 'F11', 'F12']);

// Enter ở bàn phím số coi như Enter
export const normalizeCode = (code) => (code === 'NumpadEnter' ? 'Enter' : code ?? '');
export const canBind = (code) => !UNBINDABLE.has(normalizeCode(code));

export const defaultBindings = () => Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, [...a.keys]]));

// Hai hành động a, b cùng giữ một phím có bị trùng không
const clash = (a, b) => a !== b && !canShare(a, b);

// Bảng phím hợp lệ: đủ mọi hành động, mỗi hành động 2 ô (chuỗi hoặc null), không trùng phím giữa hai hành động
// (trừ cặp dùng chung), hành động bắt buộc có ít nhất một phím
function valid(b) {
  const owner = new Map();
  for (const a of KEY_ACTIONS) {
    const keys = b[a.id];
    if (!Array.isArray(keys) || keys.length !== 2) return false;
    if (keys.some((k) => k !== null && (typeof k !== 'string' || !canBind(k) || k !== normalizeCode(k)))) return false;
    if (keys[0] && keys[0] === keys[1]) return false;
    if (a.required && !keys.some(Boolean)) return false;
    for (const k of keys.filter(Boolean)) {
      for (const other of owner.get(k) ?? []) if (clash(a.id, other)) return false;
      owner.set(k, [...(owner.get(k) ?? []), a.id]);
    }
  }
  return true;
}

// Đọc bảng phím đã lưu: thiếu hành động (bản lưu cũ chưa có) thì lấy mặc định của hành động đó; bảng lỗi / trùng phím
// thì quay về mặc định cả bảng
export function loadBindings(saved) {
  const b = defaultBindings();
  if (!saved || typeof saved !== 'object') return b;
  for (const a of KEY_ACTIONS) {
    const keys = saved[a.id];
    if (Array.isArray(keys)) b[a.id] = [keys[0] ?? null, keys[1] ?? null];
  }
  return valid(b) ? b : defaultBindings();
}

let bindings = loadBindings(settings.keybinds);
let byCode = new Map();
let version = 0;

function reindex() {
  byCode = new Map();
  for (const a of KEY_ACTIONS) {
    for (const k of bindings[a.id]) if (k) byCode.set(k, [...(byCode.get(k) ?? []), a.id]);
  }
  version++;
}
reindex();

function commit(next) {
  bindings = next;
  reindex();
  setSetting('keybinds', bindings);
}

// Số lần bảng phím đã đổi (giao diện vẽ lại nhãn phím khi số này đổi)
export const bindingsVersion = () => version;
export const getBindings = () => Object.fromEntries(Object.entries(bindings).map(([id, keys]) => [id, [...keys]]));
export const keysFor = (id) => (bindings[id] ?? []).filter(Boolean);
// Các hành động đang gán phím (code)
export const actionsForCode = (code) => byCode.get(normalizeCode(code)) ?? [];
// Phím của sự kiện bàn phím e có thuộc hành động id không
export const matches = (e, id) => Boolean(e?.code) && (bindings[id]?.includes(normalizeCode(e.code)) ?? false);
// Ô phím tắt (0-5) của phím e, hoặc null
export function hotbarSlotOf(e) {
  const i = HOTBAR_ACTIONS.findIndex((id) => matches(e, id));
  return i >= 0 ? i : null;
}

// Gán phím code vào ô slot (0 = chính, 1 = phụ) của hành động id. Phím đang thuộc hành động khác thì đổi chỗ: hành động kia
// nhận phím cũ của ô này (phím cũ lại trùng với ai đó hoặc ô này đang trống thì hành động kia mất phím đó).
// Trả về { ok, changed: [hành động khác bị đổi phím] } hoặc { ok: false, blocked: id } nếu làm một hành động bắt buộc mất hết phím
export function setBinding(id, slot, code) {
  code = normalizeCode(code);
  if (!ACTION[id] || (slot !== 0 && slot !== 1) || !canBind(code)) return { ok: false, blocked: null, changed: [] };
  const b = getBindings();
  const old = b[id][slot];
  if (old === code) return { ok: true, changed: [] };
  const other = 1 - slot;
  // Phím đã nằm ở ô kia của chính hành động này: đổi chỗ hai ô
  if (b[id][other] === code) {
    b[id][other] = old;
    b[id][slot] = code;
    commit(b);
    return { ok: true, changed: [] };
  }
  b[id][slot] = code;
  const changed = [];
  for (const a of KEY_ACTIONS) {
    const j = b[a.id].indexOf(code);
    if (a.id === id || j < 0 || !clash(id, a.id)) continue;
    // Phím cũ trao cho hành động kia, trừ khi nó trùng với hành động khác nữa
    const free = old && b[a.id][1 - j] !== old && KEY_ACTIONS.every((o) => o.id === a.id || !b[o.id].includes(old) || !clash(a.id, o.id));
    b[a.id][j] = free ? old : null;
    changed.push(a.id);
  }
  const stuck = KEY_ACTIONS.find((a) => a.required && !b[a.id].some(Boolean));
  if (stuck) return { ok: false, blocked: stuck.id, changed: [] };
  commit(b);
  return { ok: true, changed };
}

// Bỏ phím ở ô slot. Không bỏ được phím cuối cùng của hành động bắt buộc (trả về false)
export function clearBinding(id, slot) {
  const b = getBindings();
  if (!b[id] || !b[id][slot]) return false;
  if (ACTION[id].required && !b[id][1 - slot]) return false;
  b[id][slot] = null;
  commit(b);
  return true;
}

export function resetBindings() {
  commit(defaultBindings());
}

const NAMES = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Enter: 'Enter', Space: 'Space', Escape: 'Esc', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', CapsLock: 'Caps Lock',
  ShiftLeft: 'Shift', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl', ControlRight: 'Ctrl phải', AltLeft: 'Alt', AltRight: 'Alt phải',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', Backquote: '`', IntlBackslash: '\\',
  NumpadAdd: 'Numpad +', NumpadSubtract: 'Numpad -', NumpadMultiply: 'Numpad *', NumpadDivide: 'Numpad /', NumpadDecimal: 'Numpad .',
};

// Tên phím dễ đọc: "M", "1", "Numpad 1", "↑", "Esc", "Enter", "Space"
export function keyName(code) {
  if (!code) return '';
  if (NAMES[code]) return NAMES[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code);
  if (m) return `Numpad ${m[1]}`;
  return code;
}

// Tên ngắn cho ô nhỏ (số trên ô phím tắt): "1", "N1", "Spc"...
export function shortKeyName(code) {
  const m = /^Numpad(\d)$/.exec(code ?? '');
  if (m) return `N${m[1]}`;
  const short = { Space: 'Spc', Enter: 'Ent', Backspace: 'Bksp', 'Caps Lock': 'Caps', 'Shift phải': 'Shift', 'Ctrl phải': 'Ctrl', 'Alt phải': 'Alt' };
  const name = keyName(code);
  return short[code] ?? short[name] ?? (name.length > 5 ? name.slice(0, 5) : name);
}

// Tên phím đầu tiên đang gán cho hành động id ('' nếu chưa gán)
export const keyLabel = (id) => keyName(keysFor(id)[0]);

// Lời thoại nhắc phím ("Bấm {key:dex} để mở Pokédex"): thay {key:id} bằng tên phím hiện tại của hành động id
export const fillKeyNames = (text) => (typeof text === 'string'
  ? text.replace(/\{key:(\w+)\}/g, (_, id) => keyLabel(id) || '…')
  : text);
