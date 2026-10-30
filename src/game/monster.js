import { SPECIES } from '../data/monsters.js';

export const MAX_LEVEL = 100;
export const MAX_MOVES = 4;

export const expForLevel = (level) => level ** 3;

export function calcStats(species, level) {
  const { hp, atk, def, spAtk, spDef, speed } = species.base;
  const stat = (b) => Math.floor((2 * b * level) / 100) + 5;
  return {
    maxHp: Math.floor((2 * hp * level) / 100) + level + 10,
    atk: stat(atk),
    def: stat(def),
    spAtk: stat(spAtk),
    spDef: stat(spDef),
    speed: stat(speed),
  };
}

let nextUid = 1;

export function createMonster(speciesId, level) {
  const species = SPECIES[speciesId];
  const stats = calcStats(species, level);
  const moves = species.learnset
    .filter(([lv]) => lv <= level)
    .map(([, move]) => move)
    .slice(-MAX_MOVES);
  return {
    uid: nextUid++,
    speciesId,
    name: species.name,
    level,
    exp: expForLevel(level),
    hp: stats.maxHp,
    ...stats,
    moves,
  };
}

// Tỉ lệ thanh EXP (0..1) trong cấp hiện tại
export function expProgress(mon) {
  if (mon.level >= MAX_LEVEL) return 1;
  const lo = expForLevel(mon.level);
  const hi = expForLevel(mon.level + 1);
  return (mon.exp - lo) / (hi - lo);
}

// Cộng EXP, tự lên cấp và học chiêu. Trả về danh sách sự kiện để hiển thị.
export function gainExp(mon, amount) {
  const species = SPECIES[mon.speciesId];
  const events = [];
  mon.exp += amount;
  while (mon.level < MAX_LEVEL && mon.exp >= expForLevel(mon.level + 1)) {
    mon.level++;
    const oldMax = mon.maxHp;
    Object.assign(mon, calcStats(species, mon.level));
    mon.hp += mon.maxHp - oldMax;
    events.push({ type: 'levelUp', level: mon.level });

    for (const [lv, move] of species.learnset) {
      if (lv !== mon.level || mon.moves.includes(move)) continue;
      if (mon.moves.length < MAX_MOVES) {
        mon.moves.push(move);
        events.push({ type: 'learn', move });
      } else {
        events.push({ type: 'cantLearn', move });
      }
    }
  }
  return events;
}
