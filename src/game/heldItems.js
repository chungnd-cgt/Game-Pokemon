import { ITEMS, canHold } from '../data/items.js';
import { maxPp } from './monster.js';
import { ITEM_MAX, addItem, itemCount, useItem } from './state.js';

// Cho Pokémon cầm vật phẩm (lấy từ túi). Đang cầm món khác thì món cũ trả về túi.
// Trả về null nếu được, hoặc câu báo lý do không được.
export function giveHeldItem(mon, id) {
  if (!canHold(id)) return `Không thể cho Pokémon cầm ${ITEMS[id].name}.`;
  if (itemCount(id) <= 0) return `Bạn không có ${ITEMS[id].name}.`;
  const old = mon.heldItem;
  if (old === id) return `${mon.name} đang cầm ${ITEMS[id].name} rồi.`;
  if (old && itemCount(old) >= ITEM_MAX) return `Túi đã đầy ${ITEMS[old].name}, không cất được món đang cầm.`;
  useItem(id);
  if (old) addItem(old);
  mon.heldItem = id;
  return null;
}

// Cất vật phẩm Pokémon đang cầm vào túi. Trả về id vật phẩm, hoặc null nếu không cất được.
export function takeHeldItem(mon) {
  const id = mon.heldItem;
  if (!id || itemCount(id) >= ITEM_MAX) return null;
  addItem(id);
  mon.heldItem = null;
  return id;
}

// Tác dụng của món đang cầm (null nếu không cầm hoặc món đó không có tác dụng khi cầm)
export const heldEffect = (mon) => ITEMS[mon.heldItem]?.held ?? null;

// Ngưỡng HP để tự ăn quả hồi máu: Oran / Sitrus ăn khi còn một nửa; quả "lúc nguy" (pinch: true, như Figy) ăn khi còn 1/4,
// Gluttony thì ăn quả lúc nguy sớm hơn, khi còn một nửa
export const berryHpLimit = (item, ability = null) => (item.pinch && ability !== 'gluttony' ? 1 / 4 : 1 / 2);

// Quả mọng đang cầm có nên tự ăn lúc này không. Trả về { moveId } (moveId: chiêu cần hồi PP với Leppa) hoặc null.
// Quả hồi máu: HP chạm ngưỡng (berryHpLimit) • quả chữa trạng thái: đang bị đúng trạng thái • Leppa: có chiêu hết PP
// ability: đặc tính đang có tác dụng (Neutralizing Gas thì null)
export function heldBerryTrigger(mon, ability = mon.ability) {
  const item = ITEMS[mon.heldItem];
  if (!item?.berry || mon.hp <= 0) return null;
  switch (item.kind) {
    case 'heal':
      return mon.hp <= mon.maxHp * berryHpLimit(item, ability) ? { moveId: null } : null;
    case 'cure':
      return item.cure.includes(mon.status) || (item.confusion && mon.confused) ? { moveId: null } : null;
    case 'pp': {
      const empty = mon.moves.find((m) => mon.pp[m] <= 0 && maxPp(m) > 0);
      return empty ? { moveId: empty } : null;
    }
    default:
      return null;
  }
}
