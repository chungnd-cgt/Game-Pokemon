import { DEX_BY_SLUG } from '../data/pokedex.js';
import { healMonster } from './monster.js';

export const PARTY_SIZE = 6;
export const START_MONEY = 10000;
// Thua trận: mất 5% số tiền đang có, tối đa 25.000
export const BLACKOUT_RATE = 0.05;
export const BLACKOUT_MAX = 25000;
export const ITEM_MAX = 999; // mỗi loại vật phẩm giữ tối đa 999 cái

// Tên mặc định khi người chơi để trống ô đặt tên
export const DEFAULT_NAMES = { male: 'Khang', female: 'Linh' };

function freshState() {
  return {
    // nhân vật chọn khi chơi mới: tên, giới tính ('male' | 'female') và diện mạo tự chọn
    // look = { hairStyle, hair, skin, outfit, eyes } (mã lựa chọn trong data/playerCustom.js), null = mặc định
    player: { name: '', gender: 'male', look: null },
    party: [],
    storage: [], // hộp PC: Pokémon bắt thêm khi đội hình đã đủ; ô trống là null (xem game/storage.js)
    bag: {},
    money: START_MONEY,
    // Pokédex: số thứ tự (1-151) của Pokémon đã gặp / đã bắt
    dex: { seen: new Set(), caught: new Set() },
    defeatedTrainers: new Set(),
    trainerRest: {}, // id trainer -> thời điểm (ms) đấu lại được (game/trainers.js)
    pendingBattle: null, // trận đang đánh dở (lưu giữa trận): { wild } | { trainer, name, forfeit }
    itemRespawn: {}, // id đồ vật nhặt lại được (Rare Candy) -> thời điểm (ms) lại có
    hotbar: [null, null, null, null, null, null], // 6 ô phím tắt vật phẩm (ui/Hotbar.js)
    flags: new Set(), // các mốc cốt truyện đã qua
    berryTrees: {}, // id cây -> thời điểm (ms) cây ra quả lại; không có = đang có quả
    repel: null, // { item, steps }: Repel đang có hiệu lực, còn steps bước
    lastCenter: null, // nơi hồi phục gần nhất (Pokémon Center đã vào), null = ở nhà
    badges: new Set(), // huy hiệu gym đã nhận (data/badges.js)
    visited: new Set(), // khu vực đã đặt chân tới (data/region.js)
    hallOfFame: [], // các lần vô địch Liên minh: { at, team: [{ speciesId, name, level, shiny }] }
    playTime: 0, // giây
    startedAt: Date.now(), // lúc bắt đầu chơi mới (ms, hiện trên Thẻ Huấn luyện viên); bản lưu cũ không có thì null
  };
}

// Trạng thái người chơi dùng chung giữa các scene
export const state = freshState();

// Chơi mới: xoá sạch trạng thái
export function resetState() {
  Object.assign(state, freshState());
}

export const blackoutLoss = (money) => Math.min(BLACKOUT_MAX, Math.floor(money * BLACKOUT_RATE));

export const hasFlag = (flag) => state.flags.has(flag);

// Tên người chơi trong lời thoại (bản lưu cũ chưa đặt tên thì gọi chung là "bạn")
export const playerName = () => state.player?.name || 'Bạn';
export const setFlag = (flag) => state.flags.add(flag);

export function addCaught(mon) {
  markCaught(mon.speciesId);
  if (state.party.length < PARTY_SIZE) {
    state.party.push(mon);
    return 'party';
  }
  // Vào ô trống đầu tiên của hộp PC
  const free = state.storage.indexOf(null);
  if (free >= 0) state.storage[free] = mon;
  else state.storage.push(mon);
  return 'storage';
}

// Đổi chỗ hai Pokémon trong đội (con đứng đầu đi theo người chơi và ra trận đầu tiên)
export function swapParty(a, b) {
  const { party } = state;
  if (a === b || !party[a] || !party[b]) return false;
  [party[a], party[b]] = [party[b], party[a]];
  return true;
}

export function markSeen(speciesId) {
  state.dex.seen.add(DEX_BY_SLUG[speciesId].id);
}

export function markCaught(speciesId) {
  markSeen(speciesId);
  state.dex.caught.add(DEX_BY_SLUG[speciesId].id);
}

// 'caught' | 'seen' | 'unknown'
export function dexStatus(dexId) {
  if (state.dex.caught.has(dexId)) return 'caught';
  if (state.dex.seen.has(dexId)) return 'seen';
  return 'unknown';
}

export function healParty() {
  for (const mon of state.party) healMonster(mon);
}

export const itemCount = (id) => state.bag[id] ?? 0;

// Trả về số thực nhận được (túi đầy 999 thì phần dư bỏ đi)
export function addItem(id, qty = 1) {
  const n = Math.max(0, Math.min(qty, ITEM_MAX - itemCount(id)));
  if (n > 0) state.bag[id] = itemCount(id) + n;
  return n;
}

export function useItem(id) {
  state.bag[id] = itemCount(id) - 1;
  if (state.bag[id] <= 0) delete state.bag[id];
}

// Bán đồ cho cửa hàng
export function sell(id, qty, price) {
  const n = Math.min(qty, itemCount(id));
  state.money += n * price;
  state.bag[id] = itemCount(id) - n;
  if (state.bag[id] <= 0) delete state.bag[id];
  return n;
}

// Mua hàng: trả về false nếu không đủ tiền
export function buy(id, qty, price) {
  const total = qty * price;
  if (total > state.money || itemCount(id) + qty > ITEM_MAX) return false;
  state.money -= total;
  addItem(id, qty);
  return true;
}
