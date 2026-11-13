import { MOVES } from '../data/moves.js';

// Biến đổi chỉ có trong trận (Transform / Imposter biến hình, Trace sao chép đặc tính).
// Các trường bị đổi được ghi đè thẳng lên Pokémon để mọi công thức trận đấu (hệ, chỉ số, chiêu, đặc tính) dùng luôn giá trị mới;
// giá trị gốc cất trong mon.battleBase. Hết hiệu ứng (rời sân, gục, hết trận, bị bắt) thì revertBattleForm trả lại nguyên trạng.
// battleBase, transformed và toJSON đều không đếm (không lưu): lưu game giữa trận luôn ghi dạng gốc của Pokémon,
// nên bản lưu không bao giờ chứa dạng biến hình.

export const TRANSFORM_PP = 5;
// Chỉ số chép từ đối thủ khi biến hình (như từ Gen 5: chép chỉ số thật của đối thủ, trừ HP)
export const TRANSFORM_STATS = ['atk', 'def', 'spAtk', 'spDef', 'speed'];

const hidden = (mon, key, value) => Object.defineProperty(mon, key, { value, enumerable: false, configurable: true, writable: true });
const copy = (v) => (Array.isArray(v) ? [...v] : v && typeof v === 'object' ? { ...v } : v);

// Lưu bản gốc: dạng gốc của Pokémon (các trường đang bị đổi lấy lại giá trị gốc)
function savedForm() {
  return { ...this, ...this.battleBase };
}

// Ghi nhớ giá trị gốc của các trường sắp bị đổi (đã ghi nhớ rồi thì giữ giá trị gốc cũ)
function remember(mon, keys) {
  if (!mon.battleBase) {
    hidden(mon, 'battleBase', {});
    hidden(mon, 'toJSON', savedForm);
  }
  for (const key of keys) if (!(key in mon.battleBase)) mon.battleBase[key] = copy(mon[key]);
}

// Loài gốc (đang biến hình thì là loài trước khi biến hình)
export const baseSpeciesId = (mon) => mon.battleBase?.speciesId ?? mon.speciesId;

// Shiny theo hình đang hiện (biến hình thì giống hệt đối thủ, kể cả màu shiny)
export const lookShiny = (mon) => Boolean(mon.transformed ? mon.transformed.shiny : mon.shiny);

// Lý do biến hình thất bại (null = được): đối thủ đã gục, một trong hai đang biến hình
export function transformBlocked(user, target) {
  if (!target || target.hp <= 0 || user.hp <= 0) return 'fainted';
  if (user.transformed || target.transformed) return 'transformed';
  return null;
}

// Biến hình thành target: loài (hệ, hình), chỉ số trừ HP, bậc chỉ số, đặc tính, chiêu (mỗi chiêu 5 PP, chiêu ít PP hơn thì giữ PP tối đa
// của chiêu). HP, cấp, giới tính, trạng thái xấu, đồ đang cầm giữ nguyên. Trả về true nếu biến hình được
export function transform(user, target) {
  if (transformBlocked(user, target)) return false;
  remember(user, ['speciesId', ...TRANSFORM_STATS, 'ability', 'moves', 'pp', 'stages']);
  user.speciesId = target.speciesId;
  for (const k of TRANSFORM_STATS) user[k] = target[k];
  user.ability = target.ability;
  user.moves = [...target.moves];
  user.pp = Object.fromEntries(user.moves.map((m) => [m, Math.min(TRANSFORM_PP, MOVES[m].pp)]));
  user.stages = { ...(target.stages ?? {}) };
  hidden(user, 'transformed', { speciesId: target.speciesId, shiny: Boolean(target.shiny) });
  return true;
}

// PP tối đa của chiêu với Pokémon này (đang biến hình: 5)
export const movePpMax = (mon, moveId) => (mon.transformed ? Math.min(TRANSFORM_PP, MOVES[moveId].pp) : MOVES[moveId].pp);

// Trace: mang đặc tính sao chép tới khi rời sân
export function setBattleAbility(mon, ability) {
  remember(mon, ['ability']);
  mon.ability = ability;
}

// Trả lại dạng gốc. Trả về true nếu Pokémon đang bị biến đổi
export function revertBattleForm(mon) {
  if (!mon?.battleBase) return false;
  Object.assign(mon, mon.battleBase);
  delete mon.battleBase;
  delete mon.toJSON;
  delete mon.transformed;
  return true;
}

// Tạm trả về dạng gốc (lên cấp / học chiêu giữa trận phải tính trên loài, chỉ số, bộ chiêu gốc), trả về dạng đang có
// để resumeBattleForm khoác lại sau đó. Không bị biến đổi thì trả về null
export function suspendBattleForm(mon) {
  if (!mon.battleBase) return null;
  const fields = Object.fromEntries(Object.keys(mon.battleBase).map((k) => [k, mon[k]]));
  const form = { fields, transformed: mon.transformed };
  revertBattleForm(mon);
  return form;
}

export function resumeBattleForm(mon, form) {
  if (!form) return;
  remember(mon, Object.keys(form.fields));
  Object.assign(mon, form.fields);
  if (form.transformed) hidden(mon, 'transformed', form.transformed);
}
