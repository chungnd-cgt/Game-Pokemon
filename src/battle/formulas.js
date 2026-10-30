import { SPECIES } from '../data/monsters.js';
import { SPECIAL_TYPES, typeMultiplier } from '../data/types.js';

export const CRIT_CHANCE = 1 / 16;

export const isSpecial = (move) => SPECIAL_TYPES.includes(move.type);

export function calcDamage(attacker, defender, move, rng = Math.random) {
  const atkTypes = SPECIES[attacker.speciesId].types;
  const defTypes = SPECIES[defender.speciesId].types;
  const effectiveness = typeMultiplier(move.type, defTypes);
  if (effectiveness === 0) return { damage: 0, effectiveness, crit: false };

  const special = isSpecial(move);
  const atk = special ? attacker.spAtk : attacker.atk;
  const def = special ? defender.spDef : defender.def;
  const stab = atkTypes.includes(move.type) ? 1.5 : 1;
  const crit = rng() < CRIT_CHANCE;
  const levelFactor = Math.floor((2 * attacker.level) / 5) + 2;
  const base = Math.floor(Math.floor((levelFactor * move.power * atk) / def) / 50) + 2;
  const random = 0.85 + rng() * 0.15;
  const damage = Math.max(1, Math.floor(base * stab * effectiveness * (crit ? 1.5 : 1) * random));
  return { damage, effectiveness, crit };
}

export function moveHits(move, rng = Math.random) {
  return rng() * 100 < move.accuracy;
}

// Xác suất bắt thành công: máu càng thấp càng dễ bắt
export function catchChance(mon, ballBonus = 1) {
  const rate = SPECIES[mon.speciesId].catchRate;
  const a = ((3 * mon.maxHp - 2 * mon.hp) * rate * ballBonus) / (3 * mon.maxHp);
  return Math.min(1, a / 255);
}

// Bóng lắc tối đa 3 lần, qua đủ 3 lần là bắt được
export function rollCatch(mon, ballBonus = 1, rng = Math.random) {
  const perShake = Math.cbrt(catchChance(mon, ballBonus));
  let shakes = 0;
  while (shakes < 3 && rng() < perShake) shakes++;
  return { caught: shakes === 3, shakes };
}

export function expGain(defeated) {
  return Math.floor((SPECIES[defeated.speciesId].baseExp * defeated.level) / 5);
}

export function escapeChance(runner, enemy, attempts) {
  if (runner.speed >= enemy.speed) return 1;
  return Math.min(1, ((runner.speed * 128) / enemy.speed + 30 * attempts) / 256);
}

// Ai ra đòn trước: độ ưu tiên chiêu > tốc độ > ngẫu nhiên
export function playerGoesFirst(player, playerMove, enemy, enemyMove, rng = Math.random) {
  if (playerMove.priority !== enemyMove.priority) return playerMove.priority > enemyMove.priority;
  if (player.speed !== enemy.speed) return player.speed > enemy.speed;
  return rng() < 0.5;
}
