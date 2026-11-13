import { SPECIES } from '../data/monsters.js';
import { learnMoves, movesAtLevel, recalcStats } from './monster.js';
import { markCaught } from './state.js';

// Loài mà Pokémon sẽ tiến hoá thành, hoặc null.
// item: đá tiến hoá đang dùng. Không có item thì xét tiến hoá theo cấp (Everstone đang cầm thì không tiến hoá).
export function evolutionTarget(mon, item = null) {
  for (const evo of SPECIES[mon.speciesId].evolution ?? []) {
    if (evo.item) {
      if (evo.item === item) return evo.to;
    } else if (!item && mon.heldItem !== 'everstone' && mon.level >= evo.level) {
      return evo.to;
    }
  }
  return null;
}

// Tiến hoá: đổi loài, tên, chỉ số; đặc tính giữ đúng ô (thường thứ mấy / ẩn).
// Học chiêu như từ Gen 7: chiêu học khi tiến hoá của loài mới, rồi chiêu loài mới học đúng ở cấp hiện tại.
// Từ đó lên cấp học theo bộ chiêu của loài mới. Trả về các sự kiện học chiêu giống gainExp ({ type: 'learn' | 'cantLearn', move }).
export function evolve(mon, to) {
  const from = SPECIES[mon.speciesId];
  const species = SPECIES[to];
  const slot = Math.max(0, from.abilities.normal.indexOf(mon.ability));
  mon.speciesId = to;
  mon.name = species.name;
  // Loài mới cũng có đặc tính đang dùng thì giữ nguyên (danh sách chỉ gồm đặc tính game đã có nên số thứ tự ô
  // có thể lệch giữa hai loài, vd Meowth chỉ còn Technician ở ô 0 còn ô 0 của Persian là Limber)
  const keep = species.abilities.normal.includes(mon.ability);
  mon.ability = mon.hiddenAbility && species.abilities.hidden
    ? species.abilities.hidden
    : keep ? mon.ability : species.abilities.normal[Math.min(slot, species.abilities.normal.length - 1)];
  recalcStats(mon);
  markCaught(to);

  return learnMoves(mon, [...species.evolutionMoves, ...movesAtLevel(species, mon.level)]);
}
