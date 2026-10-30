import { DEX_BY_SLUG } from '../data/pokedex.js';

export const PARTY_SIZE = 6;
export const START_MONEY = 3000;

// Trạng thái người chơi dùng chung giữa các scene
export const state = {
  party: [],
  storage: [], // Pokémon bắt thêm khi đội hình đã đủ
  bag: { ball: 10, potion: 3 },
  money: START_MONEY,
  // Pokédex: số thứ tự (1-151) của Pokémon đã gặp / đã bắt
  dex: { seen: new Set(), caught: new Set() },
  defeatedTrainers: new Set(),
};

export function addCaught(mon) {
  markCaught(mon.speciesId);
  if (state.party.length < PARTY_SIZE) {
    state.party.push(mon);
    return 'party';
  }
  state.storage.push(mon);
  return 'storage';
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
  for (const mon of state.party) mon.hp = mon.maxHp;
}

export const itemCount = (id) => state.bag[id] ?? 0;

export function addItem(id, qty = 1) {
  state.bag[id] = itemCount(id) + qty;
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
  if (total > state.money) return false;
  state.money -= total;
  addItem(id, qty);
  return true;
}
