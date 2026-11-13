// 25 tính cách: mỗi tính cách tăng 10% một chỉ số, giảm 10% một chỉ số khác (HP không bị ảnh hưởng).
// Tính cách có up = down là trung tính, không đổi gì.
const LIST = [
  ['hardy', 'Hardy', 'atk', 'atk'],
  ['lonely', 'Lonely', 'atk', 'def'],
  ['brave', 'Brave', 'atk', 'speed'],
  ['adamant', 'Adamant', 'atk', 'spAtk'],
  ['naughty', 'Naughty', 'atk', 'spDef'],
  ['bold', 'Bold', 'def', 'atk'],
  ['docile', 'Docile', 'def', 'def'],
  ['relaxed', 'Relaxed', 'def', 'speed'],
  ['impish', 'Impish', 'def', 'spAtk'],
  ['lax', 'Lax', 'def', 'spDef'],
  ['timid', 'Timid', 'speed', 'atk'],
  ['hasty', 'Hasty', 'speed', 'def'],
  ['serious', 'Serious', 'speed', 'speed'],
  ['jolly', 'Jolly', 'speed', 'spAtk'],
  ['naive', 'Naive', 'speed', 'spDef'],
  ['modest', 'Modest', 'spAtk', 'atk'],
  ['mild', 'Mild', 'spAtk', 'def'],
  ['quiet', 'Quiet', 'spAtk', 'speed'],
  ['bashful', 'Bashful', 'spAtk', 'spAtk'],
  ['rash', 'Rash', 'spAtk', 'spDef'],
  ['calm', 'Calm', 'spDef', 'atk'],
  ['gentle', 'Gentle', 'spDef', 'def'],
  ['sassy', 'Sassy', 'spDef', 'speed'],
  ['careful', 'Careful', 'spDef', 'spAtk'],
  ['quirky', 'Quirky', 'spDef', 'spDef'],
];

export const NATURES = Object.fromEntries(
  LIST.map(([id, name, up, down]) => [id, { id, name, up: up === down ? null : up, down: up === down ? null : down }]),
);
export const NATURE_IDS = LIST.map(([id]) => id);

// Hệ số tính cách cho một chỉ số: 1.1 (tăng), 0.9 (giảm) hoặc 1
export function natureMultiplier(natureId, stat) {
  const n = NATURES[natureId];
  if (!n?.up) return 1;
  if (n.up === stat) return 1.1;
  if (n.down === stat) return 0.9;
  return 1;
}
