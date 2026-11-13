import { SPECIES } from '../data/monsters.js';
import { state } from './state.js';

// Trainer thường đấu lại được sau 3-4 ngày thật; thủ lĩnh, Tứ Thiên Vương, nhân vật cốt truyện (noRematch / onDefeat)
// thì không. state.defeatedTrainers: trainer đã từng thua người chơi (nhiệm vụ, huy hiệu dựa vào đây),
// state.trainerRest: id -> thời điểm (ms) trainer sẵn sàng đấu lại.
const DAY_MS = 24 * 3600 * 1000;
const REST_MIN_MS = 3 * DAY_MS;
const REST_SPREAD_MS = DAY_MS;

// Trainer dọc đường (không phải trong gym) đấu lại được
export const rematchable = (def) => !def.noRematch && !def.onDefeat && !def.map?.startsWith('gym');
// Trận bị gián đoạn (tắt game giữa trận) thì tính là thua trainer này; thủ lĩnh, Liên minh, cốt truyện thì được đấu lại ngay
export const forfeitable = (def) => !def.noRematch && !def.onDefeat;

export const restUntil = (now = Date.now()) => now + REST_MIN_MS + Math.random() * REST_SPREAD_MS;

// Trainer có chịu đấu với người chơi không
export function trainerReady(def, now = Date.now()) {
  if ((state.trainerRest[def.id] ?? 0) > now) return false;
  return !state.defeatedTrainers.has(def.id) || rematchable(def);
}

// Người chơi thắng trainer
export function trainerBeaten(def, now = Date.now()) {
  state.defeatedTrainers.add(def.id);
  if (rematchable(def) && !((state.trainerRest[def.id] ?? 0) > now)) state.trainerRest[def.id] = restUntil(now);
}

// Dạng tiến hoá theo cấp của loài ở cấp level (Rattata Lv 40 -> Raticate)
function evolvedAt(speciesId, level) {
  const next = SPECIES[speciesId].evolution?.find((e) => e.level && e.level <= level);
  return next ? evolvedAt(next.to, level) : speciesId;
}

// Đấu lại: đội hình lên cấp theo Pokémon mạnh nhất của người chơi (kém 3 cấp, không thấp hơn đội cũ), tiến hoá đúng cấp
export function rematchDef(def, party = state.party) {
  const top = Math.max(0, ...party.map((m) => m.level)) - 3;
  return {
    ...def,
    team: def.team.map(([id, lv, moves]) => {
      const level = Math.min(100, Math.max(lv, top));
      return moves ? [evolvedAt(id, level), level, moves] : [evolvedAt(id, level), level];
    }),
  };
}

// Trận với trainer bị gián đoạn: trainer nghỉ như vừa thắng người chơi, không có tiền thưởng
export function trainerForfeit(id, now = Date.now()) {
  state.trainerRest[id] = restUntil(now);
}
