import { ITEMS } from '../data/items.js';
import { SPECIES } from '../data/monsters.js';
import { takeUid } from './monster.js';
import { ITEM_MAX, addCaught, addItem, itemCount, markSeen, state } from './state.js';

// Luật giao dịch giữa người chơi (không phụ thuộc Phaser / mạng, để test). Phần mạng: online/trade.js, giao diện: ui/TradePanel.js.
// Máy chủ kiểm tra lại đúng các luật này với bản lưu trên mạng (supabase/schema.sql: trade_check)
//  - Cả hai bên cần ít nhất 4 huy hiệu, chỉ giao dịch trong Pokémon Center
//  - Đưa tối đa 5 Pokémon trong đội mỗi lần và phải chừa lại ít nhất 1 con trong đội
//  - Không đưa được Pokémon huyền thoại / huyền ảo, vật phẩm quan trọng (xe đạp, HM, thẻ...)
//  - Được đưa vật phẩm (kể cả quả mọng) và tiền

export const TRADE_MIN_BADGES = 4;
export const TRADE_MAX_MONS = 5;
// Huyền thoại / huyền ảo vùng Kanto (giữ khớp với supabase/schema.sql)
export const UNTRADEABLE_SPECIES = new Set(['articuno', 'zapdos', 'moltres', 'mewtwo', 'mew']);

export const emptyOffer = () => ({ mons: [], items: {}, money: 0 });

export const canTrade = () => state.badges.size >= TRADE_MIN_BADGES;

// Lý do không đưa được Pokémon này, hoặc null
export function monTradeProblem(mon) {
  if (UNTRADEABLE_SPECIES.has(mon.speciesId)) return 'Pokémon huyền thoại / huyền ảo không giao dịch được';
  return null;
}

export const itemTradeable = (id) => Boolean(ITEMS[id]) && ITEMS[id].kind !== 'key';

// Số Pokémon tối đa còn đưa được (đã tính phải chừa 1 con trong đội)
export const maxOfferMons = () => Math.max(0, Math.min(TRADE_MAX_MONS, state.party.length - 1));

// Lý do đề nghị của mình không hợp lệ (so với túi đồ / đội hình hiện tại), hoặc null
export function offerProblem(offer) {
  if (offer.mons.length > TRADE_MAX_MONS) return `Mỗi lần chỉ đưa tối đa ${TRADE_MAX_MONS} Pokémon`;
  if (offer.mons.length && offer.mons.length >= state.party.length) return 'Phải chừa lại ít nhất 1 Pokémon trong đội';
  for (const m of offer.mons) {
    if (!state.party.some((p) => p.uid === m.uid)) return `${m.name} không còn trong đội`;
    const problem = monTradeProblem(m);
    if (problem) return problem;
  }
  for (const [id, qty] of Object.entries(offer.items)) {
    if (!itemTradeable(id)) return `${ITEMS[id]?.name ?? id} không giao dịch được`;
    if (!(qty > 0) || qty > itemCount(id)) return `Không đủ ${ITEMS[id].name}`;
  }
  if (!(offer.money >= 0) || offer.money > state.money) return 'Không đủ tiền';
  return null;
}

// Nhận đề nghị của bên kia thì có bị mất gì không (túi mỗi loại chỉ giữ 999). Trả về câu báo hoặc null.
// Tính cả đồ mình đưa đi (đưa 10 Potion, nhận 10 Potion thì vẫn vừa)
export function receiveProblem(mine, theirs) {
  for (const [id, qty] of Object.entries(theirs.items ?? {})) {
    if (!ITEMS[id]) return 'Có vật phẩm game của bạn không có';
    const after = itemCount(id) - (mine.items[id] ?? 0) + qty;
    if (after > ITEM_MAX) return `Túi không chứa hết ${ITEMS[id].name} (tối đa ${ITEM_MAX})`;
  }
  for (const m of theirs.mons ?? []) if (!SPECIES[m.speciesId]) return 'Có Pokémon game của bạn không có';
  return null;
}

// Giao dịch đã chốt: bỏ đồ mình đưa, nhận đồ bên kia đưa. Pokémon nhận được cấp uid mới (uid của máy bên kia có thể trùng),
// vào đội nếu còn chỗ, không thì vào hộp PC; ghi vào Pokédex. Trả về danh sách Pokémon nhận được (đã ở trong state)
export function applyTrade(mine, theirs) {
  const given = new Set(mine.mons.map((m) => m.uid));
  state.party = state.party.filter((m) => !given.has(m.uid));
  // Pokémon đi theo / thú cưỡi là con đã đưa đi: game tự chọn lại khi vẽ (WorldScene.refreshFollower)
  for (const [id, qty] of Object.entries(mine.items)) {
    state.bag[id] = itemCount(id) - qty;
    if (state.bag[id] <= 0) delete state.bag[id];
    state.hotbar = state.hotbar.map((slot) => (slot === id && !itemCount(id) ? null : slot));
  }
  state.money = Math.max(0, state.money - mine.money) + Math.max(0, theirs.money ?? 0);
  for (const [id, qty] of Object.entries(theirs.items ?? {})) if (ITEMS[id]) addItem(id, qty);
  const received = [];
  for (const m of theirs.mons ?? []) {
    if (!SPECIES[m.speciesId]) continue;
    const mon = structuredClone(m);
    mon.uid = takeUid();
    markSeen(mon.speciesId);
    addCaught(mon);
    received.push(mon);
  }
  return received;
}
