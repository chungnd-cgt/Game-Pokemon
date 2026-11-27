import { MOVES } from '../data/moves.js';
import { SPECIES } from '../data/monsters.js';
import { NATURE_IDS, natureMultiplier } from '../data/natures.js';
import { EV_MAX_STAT, EV_MAX_TOTAL, IV_MAX, STAT_KEYS, emptyStats } from '../data/stats.js';
import { rollWildHeld } from '../data/wildHeld.js';

export const MAX_LEVEL = 100;
export const MAX_MOVES = 4;
export const SHINY_ODDS = 8192; // 1/8192 như Gen 2-5
export const HIDDEN_ABILITY_ODDS = 20; // Pokémon hoang dã có 1/20 mang đặc tính ẩn

// Tổng EXP cần để đạt một cấp, theo nhóm tăng trưởng của loài như game gốc (Gen 3+):
//   Fast 4n³/5 • Medium Fast n³ • Medium Slow 6n³/5 - 15n² + 100n - 140 • Slow 5n³/4
const GROWTH = {
  Fast: (n) => (4 * n ** 3) / 5,
  'Medium Fast': (n) => n ** 3,
  'Medium Slow': (n) => (6 * n ** 3) / 5 - 15 * n ** 2 + 100 * n - 140,
  Slow: (n) => (5 * n ** 3) / 4,
};
export const expForLevel = (level, rate = 'Medium Fast') => (level <= 1 ? 0 : Math.floor((GROWTH[rate] ?? GROWTH['Medium Fast'])(level)));
// EXP cần để Pokémon này đạt cấp level (theo nhóm tăng trưởng của loài)
export const expToReach = (mon, level) => expForLevel(level, SPECIES[mon.speciesId].growthRate);

// Công thức chuẩn từ Gen 3: chỉ số gốc, IV (0-31), EV (mỗi 4 điểm +1 ở cấp 100) và tính cách (±10%)
export function calcStats(species, level, ivs = emptyStats(), evs = emptyStats(), nature = null) {
  const core = (k) => Math.floor(((2 * species.base[k] + ivs[k] + Math.floor(evs[k] / 4)) * level) / 100);
  const stats = { maxHp: core('hp') + level + 10 };
  for (const k of STAT_KEYS.slice(1)) {
    stats[k] = Math.floor(((core(k) + 5) * Math.round(natureMultiplier(nature, k) * 100)) / 100);
  }
  return stats;
}

// Tính lại chỉ số (sau khi lên cấp / đổi EV), HP hiện tại tăng giảm theo HP tối đa
export function recalcStats(mon) {
  const oldMax = mon.maxHp;
  Object.assign(mon, calcStats(SPECIES[mon.speciesId], mon.level, mon.ivs, mon.evs, mon.nature));
  if (oldMax !== undefined && mon.hp > 0) mon.hp = Math.max(1, Math.min(mon.maxHp, mon.hp + mon.maxHp - oldMax));
}

let nextUid = 1;

// Độ thân thiết (happiness): 0..255, Pokémon mới có 70 như game gốc. Hạ gục Pokémon hoang dã / của nhà huấn luyện +1,
// bị gục -5 (BattleScene). Hiện chỉ lưu lại cho tính năng sau này (tiến hoá theo độ thân thiết...), chưa ảnh hưởng gì
export const HAPPINESS_MAX = 255;
export const HAPPINESS_START = 70;
export const HAPPINESS_KO = 1;
export const HAPPINESS_FAINT = -5;
export function changeHappiness(mon, delta) {
  if (!mon) return;
  const now = Number.isFinite(mon.happiness) ? mon.happiness : HAPPINESS_START;
  mon.happiness = Math.max(0, Math.min(HAPPINESS_MAX, now + delta));
}
// uid mới chưa trùng Pokémon nào đang có (Pokémon nhận qua giao dịch mang uid của máy người kia)
export const takeUid = () => nextUid++;

// Sau khi tải save: uid mới không được trùng uid của Pokémon đã có
export function syncUid(mons) {
  nextUid = Math.max(nextUid, ...mons.map((m) => (Number.isFinite(m.uid) ? m.uid + 1 : 0)));
  // Bản lưu cũ có Pokémon thiếu uid: cấp uid mới
  for (const m of mons) if (!Number.isFinite(m.uid)) m.uid = nextUid++;
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];

// Đặc điểm ngẫu nhiên của từng cá thể: IV, tính cách, đặc tính, giới tính, shiny.
// opts: rng • trainer (Pokémon của nhà huấn luyện không bao giờ shiny) • shiny / hiddenAbility: ép giá trị
function rollTraits(species, opts) {
  const rng = opts.rng ?? Math.random;
  const { normal, hidden } = species.abilities;
  const hiddenAbility = Boolean(hidden) && (opts.hiddenAbility ?? rng() < 1 / HIDDEN_ABILITY_ODDS);
  return {
    ivs: Object.fromEntries(STAT_KEYS.map((k) => [k, Math.floor(rng() * (IV_MAX + 1))])),
    evs: emptyStats(),
    nature: pick(NATURE_IDS, rng),
    ability: hiddenAbility || !normal.length ? hidden : pick(normal, rng),
    hiddenAbility,
    gender: species.femaleRatio === null ? null : rng() < species.femaleRatio ? 'female' : 'male',
    shiny: opts.shiny ?? (!opts.trainer && rng() < 1 / SHINY_ODDS),
    status: null, // 'brn' | 'psn' | 'par' | 'slp' | 'frz'
    sleepTurns: 0,
    heldItem: null, // id vật phẩm đang cầm
  };
}

const fullPp = (moves) => Object.fromEntries(moves.map((m) => [m, MOVES[m].pp]));

// opts.wild: Pokémon hoang dã, có thể cầm sẵn vật phẩm theo bảng data/wildHeld.js (tung sau các đặc điểm khác)
export function createMonster(speciesId, level, opts = {}) {
  const species = SPECIES[speciesId];
  const traits = rollTraits(species, opts);
  if (opts.wild) traits.heldItem = rollWildHeld(speciesId, opts.rng ?? Math.random);
  const stats = calcStats(species, level, traits.ivs, traits.evs, traits.nature);
  // Như game gốc: 4 chiêu khác nhau học gần nhất ở cấp hiện tại trở xuống.
  // Chiêu học khi tiến hoá tính như học ở cấp 0 (xếp đầu, chỉ còn khi loài biết ít chiêu)
  const learned = [...species.evolutionMoves.map((move) => [0, move]), ...species.learnset].filter(([lv]) => lv <= level);
  const recent = [...new Set(learned.map(([, move]) => move).reverse())];
  const moves = recent.slice(0, MAX_MOVES).reverse();
  // Ngoại lệ riêng của game: 4 chiêu gần nhất toàn chiêu trạng thái (Oddish / Gloom cấp 18-23 theo FireRed/LeafGreen)
  // thì thay chiêu cũ nhất bằng chiêu gây sát thương học gần nhất, để Pokémon nào cũng đánh được
  const attack = recent.find((move) => MOVES[move].category !== 'status');
  if (attack && !moves.includes(attack)) moves[0] = attack;
  // Pokémon của nhà huấn luyện: đã học được chiêu cùng hệ mà 4 chiêu gần nhất không có thì thay chiêu trạng thái cũ nhất
  // bằng chiêu cùng hệ học gần nhất (vd: Weepinbell giữ Vine Whip thay vì toàn chiêu bột phấn)
  const stab = (move) => MOVES[move].category !== 'status' && (MOVES[move].power || MOVES[move].weightPower) && species.types.includes(MOVES[move].type);
  const best = recent.find(stab);
  if (opts.trainer && best && !moves.some(stab)) {
    const slot = moves.findIndex((move) => MOVES[move].category === 'status');
    moves[slot === -1 ? 0 : slot] = best;
  }
  // Đội hình khai báo bộ chiêu riêng (thủ lĩnh, Tứ Thiên Vương...): dùng đúng bộ đó
  if (opts.moves) moves.splice(0, moves.length, ...opts.moves.filter((move) => MOVES[move]).slice(0, MAX_MOVES));
  return {
    uid: nextUid++,
    speciesId,
    name: species.name,
    level,
    exp: expForLevel(level, species.growthRate),
    expRate: species.growthRate,
    hp: stats.maxHp,
    ...stats,
    moves,
    pp: fullPp(moves),
    happiness: HAPPINESS_START,
    ...traits,
  };
}

// Bản lưu cũ (trước khi có IV / EV / tính cách...): bổ sung các trường còn thiếu
export function upgradeMonster(mon, rng = Math.random) {
  syncExpCurve(mon);
  // Bản lưu trước khi có độ thân thiết
  if (!Number.isFinite(mon.happiness)) mon.happiness = HAPPINESS_START;
  if (mon.ivs) return syncAbility(mon);
  const hp = mon.hp;
  Object.assign(mon, rollTraits(SPECIES[mon.speciesId], { rng, shiny: false }), { pp: fullPp(mon.moves) });
  recalcStats(mon);
  mon.hp = Math.min(hp, mon.maxHp);
  return mon;
}

// Bản lưu cũ (trước khi game có đủ đặc tính của 151 loài) có thể mang đặc tính tạm thay thế không phải của loài
// (vd Butterfree mang Keen Eye thay Compound Eyes, Jigglypuff mang Oblivious thay Cute Charm), hoặc mang đặc tính ẩn ở ô
// đặc tính thường (vd Caterpie mang Run Away khi Shield Dust chưa có). Sửa lại cho đúng loài:
//  - đặc tính ẩn thật của loài: giữ nguyên, đánh dấu là đặc tính ẩn
//  - đặc tính không phải của loài: đổi sang một đặc tính thường của loài (chọn theo uid nên tải lại nhiều lần vẫn ra cùng kết quả)
export function syncAbility(mon) {
  const { normal, hidden } = SPECIES[mon.speciesId].abilities;
  if (normal.includes(mon.ability) && !mon.hiddenAbility) return mon;
  if (hidden && mon.ability === hidden) {
    mon.hiddenAbility = true;
    return mon;
  }
  if (normal.includes(mon.ability)) {
    mon.hiddenAbility = false;
    return mon;
  }
  mon.ability = normal[Math.abs(mon.uid ?? 0) % normal.length] ?? hidden;
  mon.hiddenAbility = !normal.length;
  return mon;
}

// Bản lưu cũ tính EXP theo một đường cong chung (cấp³), hoặc loài đổi nhóm tăng trưởng: giữ nguyên cấp và
// phần trăm thanh EXP, đổi số EXP sang đường cong của loài
export function syncExpCurve(mon) {
  const rate = SPECIES[mon.speciesId].growthRate;
  if (mon.expRate === rate) return mon;
  const old = mon.expRate ?? 'Medium Fast';
  const lo = expForLevel(mon.level, old);
  const hi = expForLevel(mon.level + 1, old);
  const frac = mon.level >= MAX_LEVEL ? 0 : Math.min(Math.max((mon.exp - lo) / (hi - lo), 0), 0.999);
  const newLo = expForLevel(mon.level, rate);
  mon.exp = newLo + (mon.level >= MAX_LEVEL ? 0 : Math.floor(frac * (expForLevel(mon.level + 1, rate) - newLo)));
  mon.expRate = rate;
  return mon;
}

export const evTotal = (mon) => STAT_KEYS.reduce((sum, k) => sum + mon.evs[k], 0);

// Hạ được Pokémon khác: cộng EV theo loài bị hạ (tối đa 252 mỗi chỉ số, 510 tổng). Trả về EV thực cộng thêm.
export function gainEvs(mon, yieldMap) {
  let total = evTotal(mon);
  const gained = {};
  for (const [k, n] of Object.entries(yieldMap)) {
    const add = Math.min(n, EV_MAX_STAT - mon.evs[k], EV_MAX_TOTAL - total);
    if (add <= 0) continue;
    mon.evs[k] += add;
    total += add;
    gained[k] = add;
  }
  recalcStats(mon);
  return gained;
}

// Giảm EV của một chỉ số (quả mọng giảm EV). Trả về số EV thực giảm.
export function reduceEv(mon, stat, amount) {
  const n = Math.min(amount, mon.evs[stat]);
  mon.evs[stat] -= n;
  recalcStats(mon);
  return n;
}

export const maxPp = (moveId) => MOVES[moveId].pp;

// Hồi PP cho một chiêu, trả về số PP thực hồi
export function restorePp(mon, moveId, amount = Infinity) {
  const before = mon.pp[moveId];
  mon.pp[moveId] = Math.min(maxPp(moveId), before + amount);
  return mon.pp[moveId] - before;
}

// Hồi phục hoàn toàn: đầy HP, hết trạng thái xấu, đầy PP (Pokémon Center, mẹ, sau trận cốt truyện)
export function healMonster(mon) {
  mon.hp = mon.maxHp;
  mon.status = null;
  mon.sleepTurns = 0;
  for (const m of mon.moves) mon.pp[m] = maxPp(m);
}

// Tỉ lệ thanh EXP (0..1) trong cấp hiện tại
export function expProgress(mon) {
  if (mon.level >= MAX_LEVEL) return 1;
  const lo = expToReach(mon, mon.level);
  const hi = expToReach(mon, mon.level + 1);
  return (mon.exp - lo) / (hi - lo);
}

// Học các chiêu mới (bỏ qua chiêu đã biết), đủ 4 chiêu thì không học được.
// Trả về sự kiện { type: 'learn' | 'cantLearn', move } để hiển thị.
export function learnMoves(mon, moves) {
  const events = [];
  for (const move of new Set(moves)) {
    if (mon.moves.includes(move)) continue;
    if (mon.moves.length < MAX_MOVES) {
      mon.moves.push(move);
      mon.pp[move] = maxPp(move);
      events.push({ type: 'learn', move });
    } else {
      events.push({ type: 'cantLearn', move });
    }
  }
  return events;
}

// Quên chiêu oldMove để học newMove vào đúng ô đó (chiêu mới đầy PP). Trả về false nếu không biết oldMove / đã biết newMove
export function replaceMove(mon, oldMove, newMove) {
  const slot = mon.moves.indexOf(oldMove);
  if (slot === -1 || mon.moves.includes(newMove)) return false;
  mon.moves[slot] = newMove;
  delete mon.pp[oldMove];
  mon.pp[newMove] = maxPp(newMove);
  return true;
}

// Chiêu loài này học đúng ở cấp level
export const movesAtLevel = (species, level) => species.learnset.filter(([lv]) => lv === level).map(([, move]) => move);

// Cộng EXP, tự lên cấp và học chiêu. Trả về danh sách sự kiện để hiển thị.
// levelUp kèm cấp, HP tối đa và HP ngay sau lần lên cấp đó ({ type: 'levelUp', level, maxHp, hp }) để hiện từng cấp một
export function gainExp(mon, amount) {
  const species = SPECIES[mon.speciesId];
  const events = [];
  syncExpCurve(mon);
  mon.exp += amount;
  while (mon.level < MAX_LEVEL && mon.exp >= expToReach(mon, mon.level + 1)) {
    mon.level++;
    recalcStats(mon);
    // Lên cấp: thân thiết hơn (càng thân càng tăng chậm, như game gốc)
    changeHappiness(mon, mon.happiness < 100 ? 5 : mon.happiness < 200 ? 3 : 2);
    events.push({ type: 'levelUp', level: mon.level, maxHp: mon.maxHp, hp: mon.hp });
    events.push(...learnMoves(mon, movesAtLevel(species, mon.level)));
  }
  return events;
}

// Hệ của Sức mạnh ẩn (Hidden Power) theo IV như game gốc (thế hệ 3): mỗi Pokémon một hệ "ngẫu nhiên" cố định, không có
// hệ Thường / Tiên. Bit thấp nhất của IV HP, Tấn công, Phòng thủ, Tốc độ, Tấn công ĐB, Phòng thủ ĐB
export const HIDDEN_POWER_TYPES = [
  'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark',
];
export function hiddenPowerType(mon) {
  const bits = ['hp', 'atk', 'def', 'speed', 'spAtk', 'spDef'].reduce((sum, k, i) => sum + ((mon.ivs?.[k] ?? 0) & 1) * 2 ** i, 0);
  return HIDDEN_POWER_TYPES[Math.floor((bits * 15) / 63)];
}
