import { ITEMS } from '../data/items.js';
import { state } from './state.js';

// Ô phím tắt (6 ô, state.hotbar) ở góc dưới màn hình bản đồ: xem ui/Hotbar.js

// Gán vật phẩm id vào ô slot: đã ở đúng ô đó thì bỏ gán; đang ở ô khác thì chuyển sang ô mới (mỗi món chỉ một ô).
// Trả về câu thông báo
export function setHotbarSlot(slot, id) {
  const name = ITEMS[id].name;
  if (state.hotbar[slot] === id) {
    state.hotbar[slot] = null;
    return `Đã bỏ ${name} khỏi ô phím tắt ${slot + 1}.`;
  }
  const old = state.hotbar.indexOf(id);
  if (old >= 0) state.hotbar[old] = null;
  const replaced = state.hotbar[slot];
  state.hotbar[slot] = id;
  return `Đã gán ${name} vào ô phím tắt ${slot + 1}${replaced ? ` (thay ${ITEMS[replaced].name})` : ''}.`;
}

// Gán vào ô trống đầu tiên (đã gán sẵn thì thôi). Trả về ô đã gán, hoặc null nếu đã có / hết ô trống
export function assignHotbar(id) {
  if (state.hotbar.includes(id)) return null;
  const slot = state.hotbar.indexOf(null);
  if (slot < 0) return null;
  state.hotbar[slot] = id;
  return slot;
}

// Đổi chỗ hai ô phím tắt (kéo icon từ ô a thả vào ô b; ô b trống thì chỉ chuyển sang)
export function swapHotbarSlots(a, b) {
  if (a === b) return;
  [state.hotbar[a], state.hotbar[b]] = [state.hotbar[b] ?? null, state.hotbar[a] ?? null];
}
