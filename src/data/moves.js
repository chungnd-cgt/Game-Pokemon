// [id, tên, hệ, sức mạnh, độ chính xác %, độ ưu tiên]
const LIST = [
  ['tackle', 'Tackle', 'normal', 40, 100],
  ['scratch', 'Scratch', 'normal', 40, 100],
  ['quickAttack', 'Quick Attack', 'normal', 40, 100, 1],
  ['hyperFang', 'Hyper Fang', 'normal', 80, 90],
  ['ember', 'Ember', 'fire', 40, 100],
  ['fireFang', 'Fire Fang', 'fire', 65, 95],
  ['flameWheel', 'Flame Wheel', 'fire', 60, 100],
  ['waterGun', 'Water Gun', 'water', 40, 100],
  ['waterPulse', 'Water Pulse', 'water', 60, 100],
  ['bubbleBeam', 'Bubble Beam', 'water', 65, 100],
  ['absorb', 'Absorb', 'grass', 20, 100],
  ['megaDrain', 'Mega Drain', 'grass', 40, 100],
  ['vineWhip', 'Vine Whip', 'grass', 45, 100],
  ['razorLeaf', 'Razor Leaf', 'grass', 55, 95],
  ['thunderShock', 'Thunder Shock', 'electric', 40, 100],
  ['spark', 'Spark', 'electric', 65, 100],
  ['gust', 'Gust', 'flying', 40, 100],
  ['wingAttack', 'Wing Attack', 'flying', 60, 100],
];

export const MOVES = Object.fromEntries(
  LIST.map(([id, name, type, power, accuracy, priority = 0]) => [
    id,
    { id, name, type, power, accuracy, priority },
  ]),
);
