import { ITEMS } from '../data/items.js';
import { SPECIES } from '../data/monsters.js';
import { DEX } from '../data/pokedex.js';
import { typeMultiplier } from '../data/types.js';
import { accuracyMultiplier, stageMultiplier, stageOf } from './status.js';
import { baseSpeciesId } from './transform.js';

export const CRIT_CHANCE = 1 / 16;
export const HIGH_CRIT_CHANCE = 1 / 8;

// ctx: tình hình trận đấu { weather: 'rain' | 'sun' | 'sand' | 'hail' | null, gas: true khi có Neutralizing Gas trên sân,
//       cloudNine: true khi có Cloud Nine trên sân (thời tiết mất tác dụng), lastMover: Pokémon ra đòn sau trong lượt,
//       screens: lớp chắn phía bên đỡ { reflect, lightScreen } (số lượt còn lại),
//       breaker: Pokémon có Mold Breaker đang ra đòn (đặc tính phòng thủ của bên kia mất tác dụng trong lúc đó) }

const weatherOf = (ctx) => (ctx.cloudNine ? null : ctx.weather);

// Đặc tính phòng thủ mà Mold Breaker bỏ qua (như Gen 5): chặn chiêu, miễn nhiễm trạng thái, giảm sát thương, chặn giảm chỉ số...
// Đặc tính phản đòn khi bị chạm (Static, Poison Point...) vẫn có tác dụng
export const BREAKABLE = new Set([
  'battleArmor', 'shellArmor', 'bigPecks', 'clearBody', 'hyperCutter', 'keenEye', 'damp', 'drySkin', 'filter', 'flashFire',
  'friendGuard', 'immunity', 'innerFocus', 'insomnia', 'vitalSpirit', 'leafGuard', 'levitate', 'lightningRod', 'limber',
  'marvelScale', 'multiscale', 'oblivious', 'ownTempo', 'sandVeil', 'snowCloak', 'shieldDust', 'soundproof', 'stickyHold',
  'sturdy', 'tangledFeet', 'thickFat', 'unaware', 'voltAbsorb', 'waterAbsorb', 'waterVeil', 'wonderSkin', 'overcoat',
]);

// Đặc tính đang có tác dụng (Neutralizing Gas vô hiệu đặc tính của mọi Pokémon khác; Mold Breaker của Pokémon đang ra đòn
// vô hiệu đặc tính phòng thủ của bên kia)
export function abilityOf(mon, ctx = {}) {
  if (ctx.gas && mon.ability !== 'neutralizingGas') return null;
  if (ctx.breaker && ctx.breaker !== mon && BREAKABLE.has(mon.ability)) return null;
  return mon.ability;
}

export const isSpecial = (move) => move.category === 'special';

// Đặc tính tăng 50% sức mạnh chiêu cùng hệ khi HP còn 1/3 trở xuống
const PINCH = { blaze: 'fire', torrent: 'water', overgrow: 'grass', swarm: 'bug' };
// Đặc tính miễn nhiễm một hệ chiêu
const ABSORB = { waterAbsorb: 'water', drySkin: 'water', voltAbsorb: 'electric', lightningRod: 'electric', flashFire: 'fire', levitate: 'ground' };

// Hiệu quả của chiêu lên bên đỡ: { effectiveness, absorbedBy } (absorbedBy: đặc tính đã chặn chiêu)
// Chiêu trạng thái cũng bị chặn (Thunder Wave vào Volt Absorb, Will-O-Wisp vào Flash Fire), trừ chiêu đổi thời tiết và Levitate.
// attacker (nếu biết): Scrappy đánh trúng hệ Ma bằng chiêu hệ Thường / Giác đấu
export function moveEffect(move, defender, ctx = {}, attacker = null) {
  const ability = abilityOf(defender, ctx);
  const blockable = move.category !== 'status' || (!move.weather && ability !== 'levitate');
  if (blockable && ABSORB[ability] === move.type) return { effectiveness: 0, absorbedBy: ability };
  let types = SPECIES[defender.speciesId].types;
  if (attacker && abilityOf(attacker, ctx) === 'scrappy' && ['normal', 'fighting'].includes(move.type)) types = types.filter((t) => t !== 'ghost');
  return { effectiveness: typeMultiplier(move.type, types), absorbedBy: null };
}

// Chiêu gây sát thương có hiệu ứng phụ (gây trạng thái / rối loạn / chùn bước theo xác suất, đổi chỉ số đối thủ, tự tăng chỉ số
// theo xác suất): Sheer Force tăng sức mạnh và bỏ hiệu ứng đó. Tự đổi chỉ số chắc chắn (Rapid Spin) không tính
export function hasSecondary(move) {
  if (move.category === 'status') return false;
  if (move.status || move.confuse || move.flinch) return true;
  return Boolean(move.stages) && (!move.self || (move.chance ?? 100) < 100);
}

// Hệ số xác suất hiệu ứng phụ của chiêu: 0 = không xảy ra (Sheer Force của bên đánh; Shield Dust của bên đỡ, trừ hiệu ứng lên
// chính bên đánh), 2 = gấp đôi (Serene Grace), còn lại 1. onSelf: hiệu ứng lên chính bên đánh (Metal Claw, Ancient Power)
export function secondaryFactor(attacker, defender, move, ctx = {}, onSelf = false) {
  const ability = abilityOf(attacker, ctx);
  if (ability === 'sheerForce' && hasSecondary(move)) return 0;
  if (!onSelf && abilityOf(defender, ctx) === 'shieldDust') return 0;
  return ability === 'sereneGrace' ? 2 : 1;
}

// Không bị chí mạng: Shell Armor, Battle Armor
const noCrit = (ability) => ability === 'shellArmor' || ability === 'battleArmor';
// Bão cát không làm mất máu
const SAND_PROOF = ['sandVeil', 'sandRush', 'sandForce'];

// Tốc độ thực: bậc chỉ số, tê liệt (x0.5), đặc tính theo thời tiết (x2), Quick Feet khi bị trạng thái xấu (x1.5, tê liệt không
// làm chậm), Unburden khi đã mất / dùng hết đồ đang cầm (x2)
export function effectiveSpeed(mon, ctx = {}) {
  let speed = mon.speed * stageMultiplier(stageOf(mon, 'speed'));
  const ability = abilityOf(mon, ctx);
  if (ability === 'quickFeet' && mon.status) speed *= 1.5;
  else if (mon.status === 'par') speed *= 0.5;
  const weather = weatherOf(ctx);
  if ((weather === 'rain' && ability === 'swiftSwim') || (weather === 'sun' && ability === 'chlorophyll')
    || (weather === 'sand' && ability === 'sandRush')) speed *= 2;
  if (ability === 'unburden' && mon.unburdened && !mon.heldItem) speed *= 2;
  if (ITEMS[mon.heldItem]?.held === 'machoBrace') speed *= 0.5; // Macho Brace: nặng nề, chậm đi một nửa
  return Math.floor(speed);
}

export function calcDamage(attacker, defender, move, rng = Math.random, ctx = {}) {
  const { effectiveness, absorbedBy } = moveEffect(move, defender, ctx, attacker);
  if (effectiveness === 0) return { damage: 0, effectiveness, crit: false, absorbedBy };
  // Sát thương cố định (Dragon Rage, Sonic Boom, Seismic Toss, Night Shade): bỏ qua chỉ số, khắc hệ, chí mạng, lớp chắn
  if (move.fixedDamage) {
    const damage = move.fixedDamage === 'level' ? attacker.level : move.fixedDamage;
    return { damage, effectiveness: 1, crit: false, absorbedBy: null };
  }

  const special = isSpecial(move);
  const atkKey = special ? 'spAtk' : 'atk';
  const defKey = special ? 'spDef' : 'def';
  // Đặc tính đã làm thay đổi đòn này (để trận đấu hiện tên đặc tính lên màn hình): mỗi bên tối đa một đặc tính
  let atkUsed = null;
  let defUsed = null;
  const atkMark = (id) => (atkUsed = id);
  const defMark = (id) => (defUsed = id);
  // Shell Armor / Battle Armor: không bao giờ bị chí mạng
  const critRoll = rng() < (move.highCrit ? HIGH_CRIT_CHANCE : CRIT_CHANCE);
  const crit = critRoll && !noCrit(abilityOf(defender, ctx));
  if (critRoll && !crit) defMark(abilityOf(defender, ctx));
  // Unaware: phớt lờ bậc chỉ số của đối thủ (bên đánh có Unaware thì bỏ qua bậc phòng thủ của bên đỡ và ngược lại)
  let atkStage = abilityOf(defender, ctx) === 'unaware' ? 0 : stageOf(attacker, atkKey);
  let defStage = abilityOf(attacker, ctx) === 'unaware' ? 0 : stageOf(defender, defKey);
  if (abilityOf(defender, ctx) === 'unaware' && stageOf(attacker, atkKey) !== 0) defMark('unaware');
  if (abilityOf(attacker, ctx) === 'unaware' && stageOf(defender, defKey) !== 0) atkMark('unaware');
  // Chí mạng bỏ qua bậc giảm chỉ số của bên đánh và bậc tăng của bên đỡ
  if (crit) {
    atkStage = Math.max(0, atkStage);
    defStage = Math.min(0, defStage);
  }
  const ability = abilityOf(attacker, ctx);
  let atk = attacker[atkKey] * stageMultiplier(atkStage);
  let def = defender[defKey] * stageMultiplier(defStage);
  // Bão cát: Pokémon hệ Đá tăng 50% Phòng thủ ĐB
  if (special && weatherOf(ctx) === 'sand' && SPECIES[defender.speciesId].types.includes('rock')) def *= 1.5;
  // Marvel Scale: đang bị trạng thái xấu thì Phòng thủ tăng 50%
  if (!special && defender.status && abilityOf(defender, ctx) === 'marvelScale') {
    def *= 1.5;
    defMark('marvelScale');
  }
  if (!special && (ability === 'hustle' || (ability === 'guts' && attacker.status))) {
    atk *= 1.5;
    atkMark(ability);
  }
  if (special && ability === 'solarPower' && weatherOf(ctx) === 'sun') {
    atk *= 1.5;
    atkMark(ability);
  }

  // Low Kick: sức mạnh theo cân nặng của bên đỡ
  let power = move.weightPower ? lowKickPower(weightOf(defender)) : move.power;
  // Knock Off: mạnh hơn 50% khi đối thủ đang cầm đồ (kể cả khi Sticky Hold giữ được đồ)
  if (move.knockOff && canLoseItem(defender)) power *= 1.5;
  // Technician: chiêu sức mạnh 60 trở xuống mạnh hơn 50% (Struggle thì không)
  if (ability === 'technician' && power <= 60 && move.id !== 'struggle') {
    power *= 1.5;
    atkMark(ability);
  }
  if (PINCH[ability] === move.type && attacker.hp <= attacker.maxHp / 3) {
    power *= 1.5;
    atkMark(ability);
  }
  // Sheer Force: chiêu có hiệu ứng phụ mạnh hơn 30% (hiệu ứng phụ bị bỏ, xem secondaryFactor)
  if (ability === 'sheerForce' && hasSecondary(move)) {
    power *= 1.3;
    atkMark(ability);
  }
  // Sand Force: bão cát làm chiêu hệ Đá / Đất / Thép mạnh hơn 30%
  if (ability === 'sandForce' && weatherOf(ctx) === 'sand' && ['rock', 'ground', 'steel'].includes(move.type)) {
    power *= 1.3;
    atkMark(ability);
  }
  // Rivalry: cùng giới mạnh hơn 25%, khác giới yếu đi 25%, không có giới tính thì như thường
  if (ability === 'rivalry' && attacker.gender && defender.gender) {
    power *= attacker.gender === defender.gender ? 1.25 : 0.75;
    atkMark(ability);
  }
  if (ability === 'flashFire' && attacker.flashFire && move.type === 'fire') {
    power *= 1.5;
    atkMark(ability);
  }
  if (ability === 'analytic' && ctx.lastMover === attacker) {
    power *= 1.3;
    atkMark(ability);
  }
  if ((ability === 'reckless' && move.recoil && move.id !== 'struggle') || (ability === 'ironFist' && move.punch)) {
    power *= 1.2;
    atkMark(ability);
  }
  // Đồ cầm tăng sức mạnh theo hệ (Charcoal, Mystic Water...)
  const held = ITEMS[attacker.heldItem];
  if (held?.held === 'boost' && held.boostType === move.type) power *= 1.2;

  // Cùng hệ x1.5, Adaptability x2
  const stab = SPECIES[attacker.speciesId].types.includes(move.type) ? (ability === 'adaptability' ? 2 : 1.5) : 1;
  if (stab === 2) atkMark(ability);
  let weather = 1;
  if (weatherOf(ctx) === 'rain') weather = move.type === 'water' ? 1.5 : move.type === 'fire' ? 0.5 : 1;
  if (weatherOf(ctx) === 'sun') weather = move.type === 'fire' ? 1.5 : move.type === 'water' ? 0.5 : 1;
  // Bỏng làm giảm một nửa sát thương vật lý (Guts thì không)
  const burn = attacker.status === 'brn' && !special && ability !== 'guts' ? 0.5 : 1;
  if (attacker.status === 'brn' && !special && ability === 'guts') atkMark(ability);
  // Đặc tính bên đỡ: Thick Fat chịu Lửa / Băng một nửa, Dry Skin bị Lửa đánh đau hơn 25%
  const defAbility = abilityOf(defender, ctx);
  let guard = 1;
  if (defAbility === 'thickFat' && ['fire', 'ice'].includes(move.type)) guard = 0.5;
  if (defAbility === 'drySkin' && move.type === 'fire') guard = 1.25;
  if (defAbility === 'multiscale' && defender.hp === defender.maxHp) guard *= 0.5;
  if (guard !== 1) defMark(defAbility);
  // Filter: chiêu rất hiệu quả giảm 25% • Tinted Lens (bên đánh): chiêu không hiệu quả lắm gây gấp đôi
  if (defAbility === 'filter' && effectiveness > 1) {
    guard *= 0.75;
    defMark(defAbility);
  }
  if (ability === 'tintedLens' && effectiveness < 1) {
    guard *= 2;
    atkMark(ability);
  }
  // Reflect / Light Screen phía bên đỡ: giảm một nửa sát thương vật lý / đặc biệt (chí mạng và Infiltrator xuyên qua)
  const screen = special ? ctx.screens?.lightScreen : ctx.screens?.reflect;
  if (screen && !crit && ability !== 'infiltrator') guard *= 0.5;
  if (screen && !crit && ability === 'infiltrator') atkMark(ability);
  const levelFactor = Math.floor((2 * attacker.level) / 5) + 2;
  const base = Math.floor(Math.floor((levelFactor * power * atk) / def) / 50) + 2;
  const random = 0.85 + rng() * 0.15;
  // Chí mạng x1.5, Sniper x2.25
  const critMult = crit ? (ability === 'sniper' ? 2.25 : 1.5) : 1;
  if (crit && ability === 'sniper') atkMark(ability);
  const damage = Math.max(1, Math.floor(base * weather * critMult * random * stab * effectiveness * burn * guard));
  return { damage, effectiveness, crit, absorbedBy: null, atkAbility: atkUsed, defAbility: defUsed };
}

// Trúng hay trượt, tính cả bậc độ chính xác của bên đánh và né tránh của bên đỡ
export function moveHits(move, attacker, defender, rng = Math.random, ctx = {}) {
  // Thunder / Hurricane luôn trúng khi mưa, chỉ 50% khi nắng gắt; Blizzard luôn trúng khi mưa đá
  const weather = weatherOf(ctx);
  const accuracy = weather && move.weatherAccuracy && weather in move.weatherAccuracy ? move.weatherAccuracy[weather] : move.accuracy;
  if (accuracy === null) return true;
  // No Guard: chiêu của nó và chiêu nhắm vào nó đều luôn trúng
  if (abilityOf(attacker, ctx) === 'noGuard' || abilityOf(defender, ctx) === 'noGuard') return true;
  const atkAbility = abilityOf(attacker, ctx);
  const defAbility = abilityOf(defender, ctx);
  // Unaware: bỏ qua bậc né tránh của bên đỡ (bên đánh có Unaware) / bậc chính xác của bên đánh (bên đỡ có Unaware)
  const accStage = defAbility === 'unaware' ? 0 : stageOf(attacker, 'accuracy');
  const evaStage = atkAbility === 'unaware' ? 0 : stageOf(defender, 'evasion');
  const stage = Math.max(-6, Math.min(6, accStage - evaStage));
  // Wonder Skin: chiêu trạng thái nhắm vào nó chỉ còn tối đa 50% độ chính xác
  const base = move.category === 'status' && defAbility === 'wonderSkin' ? Math.min(50, accuracy) : accuracy;
  let chance = base * accuracyMultiplier(stage);
  if (atkAbility === 'hustle' && move.category === 'physical') chance *= 0.8;
  if (atkAbility === 'compoundEyes') chance *= 1.3;
  // Né tránh của bên đỡ: Tangled Feet khi rối loạn (x2), Sand Veil khi có bão cát / Snow Cloak khi có mưa đá (x1.25)
  if (defAbility === 'tangledFeet' && defender.confused) chance *= 0.5;
  if ((defAbility === 'sandVeil' && weatherOf(ctx) === 'sand') || (defAbility === 'snowCloak' && weatherOf(ctx) === 'hail')) chance *= 0.8;
  return rng() * 100 < chance;
}

// Số đòn của chiêu đánh nhiều lần: hits: 2 luôn 2 lần • hits: [2, 5] đánh 2-5 lần (35/35/15/15%), Skill Link luôn 5 lần
export function hitCount(move, ability = null, rng = Math.random) {
  if (!move.hits) return 1;
  if (typeof move.hits === 'number') return move.hits;
  if (ability === 'skillLink') return move.hits[1];
  const r = rng();
  return r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : 5;
}

// Rối loạn tự đánh mình: đòn vật lý 40 sức mạnh không theo hệ, dùng Tấn công / Phòng thủ của chính nó, không chí mạng
export function confusionDamage(mon, rng = Math.random) {
  const atk = mon.atk * stageMultiplier(stageOf(mon, 'atk'));
  const def = mon.def * stageMultiplier(stageOf(mon, 'def'));
  const levelFactor = Math.floor((2 * mon.level) / 5) + 2;
  const base = Math.floor(Math.floor((levelFactor * 40 * atk) / def) / 50) + 2;
  return Math.max(1, Math.floor(base * (0.85 + rng() * 0.15)));
}

// Đồ đang cầm có thể bị lấy / hất đi không (vật phẩm quan trọng thì không)
export const canLoseItem = (mon) => Boolean(mon.heldItem) && ITEMS[mon.heldItem]?.kind !== 'key';

// Thời tiết cuối lượt: số HP thay đổi (dương = hồi, âm = mất). Bão cát làm mất 1/16 HP trừ hệ Đá / Đất / Thép và Sand Veil /
// Sand Rush / Sand Force, mưa đá làm mất 1/16 HP trừ hệ Băng và Snow Cloak; Ice Body hồi 1/16 HP khi mưa đá. Magic Guard, Overcoat không mất máu vì thời tiết.
export function weatherHpChange(mon, ctx = {}) {
  const weather = weatherOf(ctx);
  if (mon.hp <= 0 || (weather !== 'sand' && weather !== 'hail')) return 0;
  const ability = abilityOf(mon, ctx);
  const part = Math.max(1, Math.floor(mon.maxHp / 16));
  if (weather === 'hail' && ability === 'iceBody') return Math.min(part, mon.maxHp - mon.hp);
  if (ability === 'magicGuard' || ability === 'overcoat') return 0;
  const types = SPECIES[mon.speciesId].types;
  if (weather === 'sand' && (SAND_PROOF.includes(ability) || types.some((t) => ['rock', 'ground', 'steel'].includes(t)))) return 0;
  if (weather === 'hail' && (ability === 'snowCloak' || types.includes('ice'))) return 0;
  return -Math.min(part, mon.hp);
}

// Cân nặng (kg) theo Pokédex, vd "8.5 kg (18.7 lbs)" -> 8.5
export const weightOf = (mon) => parseFloat(DEX[SPECIES[mon.speciesId].dexId - 1].weight);

// Low Kick (từ Gen 3): sức mạnh theo cân nặng bên đỡ
export function lowKickPower(kg) {
  if (kg < 10) return 20;
  if (kg < 25) return 40;
  if (kg < 50) return 60;
  if (kg < 100) return 80;
  if (kg < 200) return 100;
  return 120;
}

// Đứng trên mặt đất: không phải hệ Bay, không có Levitate (Arena Trap giữ chân được)
export const grounded = (mon, ctx = {}) => !SPECIES[mon.speciesId].types.includes('flying') && abilityOf(mon, ctx) !== 'levitate';

// Bị giữ chân: Magnet Pull không cho Pokémon hệ Thép chạy trốn / rút về, Arena Trap giữ chân Pokémon đứng trên mặt đất;
// bị đối thủ trói (Wrap) cũng vậy. Hệ Ma luôn thoát được như từ Gen 6.
// Trả về id đặc tính (vd 'magnetPull') hoặc id chiêu (vd 'wrap') đang giữ chân, hoặc null.
export function trappedBy(mon, foe, ctx = {}) {
  if (!foe || foe.hp <= 0) return null;
  const types = SPECIES[mon.speciesId].types;
  if (types.includes('ghost')) return null;
  if (abilityOf(foe, ctx) === 'magnetPull' && types.includes('steel')) return 'magnetPull';
  if (abilityOf(foe, ctx) === 'arenaTrap' && grounded(mon, ctx)) return 'arenaTrap';
  if (mon.bound?.source === foe) return mon.bound.move;
  return null;
}

// Xác suất bắt thành công: máu càng thấp càng dễ bắt, đang ngủ / đóng băng / trạng thái xấu thì dễ hơn
export function catchChance(mon, ballBonus = 1) {
  const rate = SPECIES[baseSpeciesId(mon)].catchRate;
  const status = mon.status === 'slp' || mon.status === 'frz' ? 2.5 : mon.status ? 1.5 : 1;
  const a = ((3 * mon.maxHp - 2 * mon.hp) * rate * ballBonus * status) / (3 * mon.maxHp);
  return Math.min(1, a / 255);
}

// Bóng lắc tối đa 3 lần, qua đủ 3 lần là bắt được
export function rollCatch(mon, ballBonus = 1, rng = Math.random) {
  const perShake = Math.cbrt(catchChance(mon, ballBonus));
  let shakes = 0;
  while (shakes < 3 && rng() < perShake) shakes++;
  return { caught: shakes === 3, shakes };
}

// EXP khi hạ / bắt một Pokémon, theo công thức Gen 5 (EXP gốc trong dữ liệu là bộ số từ Gen 5):
//   (a × EXP gốc × cấp nó) / (5 × s) × ((2 × cấp nó + 10) / (cấp nó + cấp mình + 10))^2.5 + 1
// a: 1.5 nếu là Pokémon của nhà huấn luyện • s: số Pokémon chia nhau. Hệ số cuối làm cho hạ Pokémon cấp cao hơn mình
// được nhiều EXP hơn, hạ Pokémon yếu hơn hẳn thì được ít đi (không cày mãi ở bụi cỏ đầu game được)
export function expGain(defeated, level = defeated.level, { trainer = false, split = 1 } = {}) {
  const base = ((trainer ? 1.5 : 1) * SPECIES[defeated.speciesId].baseExp * defeated.level) / (5 * split);
  const scale = ((2 * defeated.level + 10) / (defeated.level + level + 10)) ** 2.5;
  return Math.floor(base * scale) + 1;
}

// Tốc độ nhận EXP của game: ít hơn công thức gốc (EXP_RATE) cho lên cấp chậm lại. Pokémon đã tiến hoá nhận ít hơn nữa
// (dạng tiến hoá như cần nhiều EXP hơn, lên cấp lâu hơn): chưa tiến hoá x1, đã tiến hoá 1 lần x0.8, 2 lần x0.65
export const EXP_RATE = 0.6;
const STAGE_RATE = [1, 0.8, 0.65];
let PREVO = null; // loài -> loài trước khi tiến hoá

// Số lần đã tiến hoá của loài (Charmander 0, Charmeleon 1, Charizard 2; Vaporeon 1)
export function evolutionStage(speciesId) {
  if (!PREVO) {
    PREVO = {};
    for (const [id, sp] of Object.entries(SPECIES)) for (const e of sp.evolution ?? []) PREVO[e.to] ??= id;
  }
  let n = 0;
  for (let id = speciesId; PREVO[id] && n < 3; id = PREVO[id]) n++;
  return n;
}

// Hệ số EXP của Pokémon nhận (theo loài gốc khi đang biến hình)
export const expRate = (mon) => EXP_RATE * STAGE_RATE[Math.min(STAGE_RATE.length - 1, evolutionStage(baseSpeciesId(mon)))];

// Chia EXP như Gen 5: các Pokémon đã ra sân đấu với nó và còn đứng (participants) chia nhau, mỗi con tính theo cấp của mình;
// cầm Lucky Egg x1.5; nhân hệ số expRate (tốc độ EXP của game, dạng tiến hoá). Trả về [{ mon, amount }] (ít nhất 1)
// sharers: Pokémon cầm Exp. Share không ra trận (còn chiến đấu được): mỗi con nhận 50% EXP như khi tự hạ một mình
// (con ra trận vẫn nhận đủ phần của mình, không bị chia bớt)
export function expShares(defeated, participants, { trainer = false, sharers = [] } = {}) {
  if (!participants.length) return [];
  const egg = (mon) => (ITEMS[mon.heldItem]?.held === 'luckyEgg' ? 1.5 : 1);
  const final = (mon, exp) => Math.max(1, Math.floor(exp * egg(mon) * expRate(mon)));
  return [
    ...participants.map((mon) => ({
      mon, amount: final(mon, expGain(defeated, mon.level, { trainer, split: participants.length })),
    })),
    ...sharers.filter((mon) => !participants.includes(mon)).map((mon) => ({
      mon, amount: final(mon, expGain(defeated, mon.level, { trainer, split: 1 }) * 0.5), shared: true,
    })),
  ];
}

// EV nhận được từ Pokémon bị hạ: cầm Macho Brace thì gấp đôi
export function evYieldFor(mon, evYield) {
  if (ITEMS[mon.heldItem]?.held !== 'machoBrace') return evYield;
  return Object.fromEntries(Object.entries(evYield).map(([k, n]) => [k, n * 2]));
}

export function escapeChance(runner, enemy, attempts, ctx = {}) {
  const mine = effectiveSpeed(runner, ctx);
  const theirs = effectiveSpeed(enemy, ctx);
  if (abilityOf(runner, ctx) === 'runAway' || mine >= theirs) return 1;
  return Math.min(1, ((mine * 128) / theirs + 30 * attempts) / 256);
}

// Ai ra đòn trước: độ ưu tiên chiêu > tốc độ (tính bậc, tê liệt, đặc tính) > ngẫu nhiên
export function playerGoesFirst(player, playerMove, enemy, enemyMove, rng = Math.random, ctx = {}) {
  if (playerMove.priority !== enemyMove.priority) return playerMove.priority > enemyMove.priority;
  const ps = effectiveSpeed(player, ctx);
  const es = effectiveSpeed(enemy, ctx);
  if (ps !== es) return ps > es;
  return rng() < 0.5;
}

// Thứ tự kích hoạt đặc tính khi hai bên cùng ra sân: nhanh trước, bằng tốc độ thì ngẫu nhiên
export function entryOrder(a, b, rng = Math.random, ctx = {}) {
  const sa = effectiveSpeed(a, ctx);
  const sb = effectiveSpeed(b, ctx);
  return sa > sb || (sa === sb && rng() < 0.5) ? [a, b] : [b, a];
}
