import { PARTY_SIZE, addItem, state } from './state.js';

// Hệ thống lưu trữ Pokémon (PC): hộp (state.storage) và đội hình.
// Hộp: mảng các ô liên tiếp, 30 ô một hộp (ô i nằm ở hộp floor(i / 30)); ô trống là null nên Pokémon nằm đúng ô đã thả.
// Đội hình luôn liền nhau (không có ô trống ở giữa).
// Vị trí: { area: 'box' | 'party', i } với i là chỉ số trong state.storage / state.party (ô trống: i >= độ dài hoặc null)

export const BOX_SLOTS = 30;
export const MIN_BOXES = 5;
export const KEEP_ONE = 'Phải giữ lại trong đội ít nhất một Pokémon còn chiến đấu được!';

const listOf = (area) => (area === 'box' ? state.storage : state.party);
export const monAt = ({ area, i }) => listOf(area)[i] ?? null;
const healthy = (party) => party.some((m) => m.hp > 0);

// Bỏ các ô trống thừa ở cuối hộp
function trimBox() {
  while (state.storage.length && !state.storage[state.storage.length - 1]) state.storage.pop();
}

function setBox(i, mon) {
  while (state.storage.length < i) state.storage.push(null);
  state.storage[i] = mon;
  trimBox();
}

// Kéo Pokémon ở from thả vào to: thả lên con khác thì đổi chỗ; thả vào ô trống của hộp thì nằm đúng ô đó,
// vào ô trống của đội thì đứng cuối đội. Trả về null nếu xong, hoặc câu báo lỗi (không thay đổi gì)
export function moveMon(from, to) {
  const mon = monAt(from);
  if (!mon || (from.area === to.area && from.i === to.i)) return null;
  const other = monAt(to);
  // Đội hình sau khi đổi: phải còn ít nhất một con chiến đấu được, không quá 6 con
  const party = state.party.slice();
  if (from.area === 'party' && to.area === 'box') {
    if (other) party[from.i] = other;
    else party.splice(from.i, 1);
  } else if (from.area === 'box' && to.area === 'party') {
    if (other) party[to.i] = mon;
    else if (party.length >= PARTY_SIZE) return `Đội hình đã đủ ${PARTY_SIZE} Pokémon.`;
    else party.push(mon);
  }
  if (!healthy(party)) return KEEP_ONE;
  if (from.area === 'party' && to.area === 'party') {
    if (other) [state.party[from.i], state.party[to.i]] = [other, mon];
    else state.party.push(...state.party.splice(from.i, 1));
  } else if (from.area === 'box' && to.area === 'box') {
    setBox(from.i, other);
    setBox(to.i, mon);
  } else if (from.area === 'party') {
    if (other) state.party[from.i] = other;
    else state.party.splice(from.i, 1);
    setBox(to.i, mon);
  } else {
    setBox(from.i, other);
    if (other) state.party[to.i] = mon;
    else state.party.push(mon);
  }
  return null;
}

// Thả được Pokémon ở from không (đội hình phải còn con chiến đấu được). Trả về câu báo lỗi hoặc null
export function releaseProblem(from) {
  if (!monAt(from)) return 'Không có Pokémon ở đó.';
  if (from.area === 'party' && !healthy(state.party.filter((_, i) => i !== from.i))) return KEEP_ONE;
  return null;
}

// Thả Pokémon (mất vĩnh viễn): đồ đang cầm cất vào túi. Trả về { mon, held, kept }
export function releaseMon(from) {
  const mon = monAt(from);
  if (from.area === 'box') setBox(from.i, null);
  else state.party.splice(from.i, 1);
  const held = mon.heldItem ?? null;
  const kept = held ? addItem(held) > 0 : false;
  mon.heldItem = null;
  return { mon, held, kept };
}

export const boxedCount = () => state.storage.filter(Boolean).length;

// Số hộp: có sẵn 5 hộp (150 ô) như game gốc; gửi nhiều hơn thì mở thêm hộp, luôn còn ô trống
export function boxCount() {
  const used = Math.ceil(state.storage.length / BOX_SLOTS);
  const n = Math.max(MIN_BOXES, used);
  return boxedCount() >= n * BOX_SLOTS ? n + 1 : n;
}
