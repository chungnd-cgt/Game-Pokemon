import { ITEMS } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { SPECIES } from '../data/monsters.js';

// Đĩa kỹ năng (TM / HM, data/items.js) và người dạy lại chiêu.

// Loài không học được đĩa nào (như game gốc): chỉ biết vài chiêu bẩm sinh
const NO_DISC = new Set(['magikarp', 'caterpie', 'metapod', 'weedle', 'kakuna', 'ditto']);

// Loài speciesId học được chiêu của đĩa id không: chiêu cùng hệ với Pokémon, có trong bộ chiêu học theo cấp / khi tiến
// hoá, loài nằm trong learners, Pokémon có hệ trong types của đĩa, hoặc chiêu thông dụng (universal)
export function canLearnDisc(speciesId, id) {
  const item = ITEMS[id];
  const sp = SPECIES[speciesId];
  const move = MOVES[item?.teaches];
  if (!item || !sp || !move) return false;
  if (item.learners?.includes(speciesId)) return true;
  if (NO_DISC.has(speciesId)) return false;
  if (sp.types.includes(move.type)) return true;
  if (item.types?.some((t) => sp.types.includes(t))) return true;
  if (item.universal) return true;
  return sp.learnset.some(([, m]) => m === item.teaches) || (sp.evolutionMoves ?? []).includes(item.teaches);
}

// Người dạy lại chiêu: các chiêu mon từng học được theo cấp (tới cấp hiện tại) hoặc khi tiến hoá mà đang không biết,
// theo thứ tự học, không trùng
export function relearnableMoves(mon) {
  const sp = SPECIES[mon.speciesId];
  const learned = [...(sp.evolutionMoves ?? []), ...sp.learnset.filter(([lv]) => lv <= mon.level).map(([, m]) => m)];
  return [...new Set(learned)].filter((m) => MOVES[m] && !mon.moves.includes(m));
}

// Giá dạy lại một chiêu
export const RELEARN_PRICE = 2000;
