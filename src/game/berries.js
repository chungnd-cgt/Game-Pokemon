import { ITEM_MAX, addItem, itemCount, state } from './state.js';

// Cây quả mọng: hái xong cây vẫn còn, chỉ hết quả. Sau 2-3 ngày (giờ thật) cây ra quả lại.
const DAY_MS = 24 * 60 * 60 * 1000;
export const REGROW_MIN_MS = 2 * DAY_MS;
export const REGROW_MAX_MS = 3 * DAY_MS;
export const PICK_MIN = 1;
export const PICK_MAX = 3;

export const isRipe = (treeId, now = Date.now()) => (state.berryTrees[treeId] ?? 0) <= now;

// Hái quả: 1-3 quả vào túi, cây hẹn ngày ra quả lại. Túi đã đủ 999 quả loại này thì không hái.
// Trả về { full } hoặc { qty } (số quả thực nhận)
export function pickBerries(tree, rng = Math.random, now = Date.now()) {
  if (itemCount(tree.berry) >= ITEM_MAX) return { full: true };
  const qty = addItem(tree.berry, PICK_MIN + Math.floor(rng() * (PICK_MAX - PICK_MIN + 1)));
  state.berryTrees[tree.id] = now + REGROW_MIN_MS + Math.floor(rng() * (REGROW_MAX_MS - REGROW_MIN_MS));
  return { qty };
}

// "khoảng 2 ngày", "khoảng 5 giờ", "chưa tới 1 giờ"
export function regrowLabel(treeId, now = Date.now()) {
  const ms = (state.berryTrees[treeId] ?? 0) - now;
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours >= 24) return `khoảng ${Math.round(hours / 24)} ngày`;
  return hours > 1 ? `khoảng ${hours} giờ` : 'chưa tới 1 giờ';
}

// Giai đoạn của cây sau khi hái, theo thời gian còn lại tới lúc chín:
// 'bare' (lá non) -> 'bloom' (ra hoa, còn dưới 1,2 ngày) -> 'unripe' (quả xanh, còn dưới 0,4 ngày) -> 'ripe'
export function berryStage(treeId, now = Date.now()) {
  const left = (state.berryTrees[treeId] ?? 0) - now;
  if (left <= 0) return 'ripe';
  if (left <= 0.4 * DAY_MS) return 'unripe';
  if (left <= 1.2 * DAY_MS) return 'bloom';
  return 'bare';
}
