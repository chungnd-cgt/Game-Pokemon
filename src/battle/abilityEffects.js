import { ITEMS } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { SPECIES } from '../data/monsters.js';
import { typeMultiplier } from '../data/types.js';
import { abilityOf } from './formulas.js';
import { stageMultiplier, stageOf } from './status.js';
import { transform } from './transform.js';

// Hiệu ứng của các đặc tính, viết thành hàm thuần (không cần Phaser) để BattleScene gọi và để kiểm thử.

// Đặc tính của bên bị đánh kích hoạt khi trúng đòn tiếp xúc (30%): Static (tê liệt), Flame Body (bỏng), Poison Point (độc),
// Effect Spore (độc / tê liệt / ngủ), Cute Charm (say mê). Trả về { ability, status } hoặc { ability, attract: true }, hoặc null.
// Chưa xét bên đánh có bị được hay không (miễn nhiễm theo hệ, Oblivious, khác giới...): BattleScene kiểm tra trước khi gây
const CONTACT_STATUS = { static: 'par', flameBody: 'brn', poisonPoint: 'psn' };
export function contactAbility(attacker, defender, move, ctx = {}, rng = Math.random) {
  if (!move.contact || attacker.hp <= 0) return null;
  const ability = abilityOf(defender, ctx);
  if (CONTACT_STATUS[ability]) return rng() < 0.3 ? { ability, status: CONTACT_STATUS[ability] } : null;
  if (ability === 'effectSpore') {
    if (attacker.status || rng() >= 0.3) return null;
    return { ability, status: ['psn', 'par', 'slp'][Math.floor(rng() * 3)] };
  }
  if (ability === 'cuteCharm') return rng() < 0.3 ? { ability, attract: true } : null;
  return null;
}

// Anticipation: đối thủ có chiêu gây sát thương khắc chế nó (theo hệ) hoặc chiêu tự nổ thì rùng mình
export function anticipates(mon, foe) {
  const types = SPECIES[mon.speciesId].types;
  return foe.moves.some((id) => {
    const m = MOVES[id];
    return m.category !== 'status' && (m.explode || typeMultiplier(m.type, types) > 1);
  });
}

// Download: Phòng thủ (tính bậc) của đối thủ thấp hơn Phòng thủ ĐB thì tăng Tấn công, không thì tăng Tấn công ĐB
export function downloadStat(foe) {
  const def = foe.def * stageMultiplier(stageOf(foe, 'def'));
  const spDef = foe.spDef * stageMultiplier(stageOf(foe, 'spDef'));
  return def < spDef ? 'atk' : 'spAtk';
}

// Trace không sao chép được những đặc tính này
export const UNTRACEABLE = new Set(['trace', 'imposter', 'neutralizingGas']);
export const traceable = (ability) => Boolean(ability) && !UNTRACEABLE.has(ability);

// Imposter: vừa ra sân thì biến hình thành đối thủ đang trên sân. Trả về true nếu biến hình được
export function imposterTransform(mon, foe, ctx = {}) {
  if (abilityOf(mon, ctx) !== 'imposter' || !foe || foe.hp <= 0) return false;
  return transform(mon, foe);
}

// ---------- Pickup ----------

// Như Gen 5: mỗi 10 cấp đẩy bảng đồ lên một bậc. 9 món thường (30/10/10/10/10/10/10/4/4%) và 2 món hiếm (1/1%)
// lấy từ hai danh sách dưới, bắt đầu ở vị trí = bậc cấp (cấp 1-10: bậc 0 ... cấp 91-100: bậc 9).
// Danh sách dùng vật phẩm game đang có, theo đúng tinh thần bảng gốc (cấp thấp: Potion, Antidote... cấp cao: Rare Candy, Max Revive)
export const PICKUP_COMMON = [
  'potion', 'antidote', 'superPotion', 'greatBall', 'repel', 'escapeRope', 'fullHeal', 'hyperPotion', 'ultraBall',
  'revive', 'rareCandy', 'moonStone', 'thunderStone', 'superRepel', 'maxRepel', 'fireStone', 'waterStone', 'maxRevive',
];
export const PICKUP_RARE = [
  'hyperPotion', 'sitrusBerry', 'lumBerry', 'leftovers', 'leppaBerry', 'maxRevive', 'luckyEgg', 'rareCandy', 'leftovers',
  'maxRevive', 'luckyEgg',
];
const COMMON_WEIGHTS = [30, 10, 10, 10, 10, 10, 10, 4, 4];
const RARE_WEIGHTS = [1, 1];
export const PICKUP_CHANCE = 0.1;

// Sau trận: Pokémon có Pickup, còn đứng, không cầm gì thì 10% nhặt được một món. Trả về id vật phẩm hoặc null
export function pickupItem(mon, rng = Math.random) {
  if (mon.ability !== 'pickup' || mon.heldItem || mon.hp <= 0) return null;
  if (rng() >= PICKUP_CHANCE) return null;
  const tier = Math.min(9, Math.floor((mon.level - 1) / 10));
  const table = [
    ...COMMON_WEIGHTS.map((w, i) => [PICKUP_COMMON[tier + i], w]),
    ...RARE_WEIGHTS.map((w, i) => [PICKUP_RARE[tier + i], w]),
  ];
  let roll = rng() * 100;
  for (const [id, w] of table) {
    if ((roll -= w) < 0) return id;
  }
  return table[0][0];
}

// ---------- Harvest ----------

// Cuối lượt: Pokémon có Harvest, đang không cầm gì và đã ăn quả mọng trong trận thì 50% mọc lại quả đó (trời nắng: chắc chắn).
// weather: thời tiết đang có tác dụng. Trả về id quả mọng mọc lại, hoặc null
export function harvestBerry(mon, weather, ability = mon.ability, rng = Math.random) {
  if (ability !== 'harvest' || mon.hp <= 0 || mon.heldItem || !ITEMS[mon.lastBerry]?.berry) return null;
  return weather === 'sun' || rng() < 0.5 ? mon.lastBerry : null;
}

// Ghi nhớ quả mọng vừa ăn trong trận (cho Harvest); không lưu vào bản lưu
export function rememberBerry(mon, id) {
  Object.defineProperty(mon, 'lastBerry', { value: id, enumerable: false, configurable: true, writable: true });
}
