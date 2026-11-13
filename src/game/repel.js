import { ITEMS } from '../data/items.js';
import { state } from './state.js';

// Repel như game gốc: trong số bước nhất định, Pokémon hoang dã có cấp thấp hơn Pokémon đầu đội
// (con đầu tiên còn chiến đấu được) sẽ không xuất hiện. Đang có hiệu lực thì không dùng thêm được.

export const leadMon = () => state.party.find((m) => m.hp > 0) ?? null;

export const repelActive = () => Boolean(state.repel && state.repel.steps > 0);

// Dùng Repel: trả về câu báo lỗi, hoặc null nếu dùng được
export function startRepel(id) {
  if (repelActive()) return `Hiệu lực của ${ITEMS[state.repel.item].name} trước vẫn còn.`;
  state.repel = { item: id, steps: ITEMS[id].steps };
  return null;
}

// Pokémon hoang dã cấp level có bị Repel đuổi đi không
export function repelBlocks(level) {
  const lead = leadMon();
  return repelActive() && Boolean(lead) && level < lead.level;
}

// Đi thêm một bước: trả về id Repel vừa hết hiệu lực, hoặc null
export function stepRepel() {
  if (!state.repel) return null;
  state.repel.steps--;
  if (state.repel.steps > 0) return null;
  const id = state.repel.item;
  state.repel = null;
  return id;
}
