import { DEX_BY_SLUG } from './pokedex.js';

// Các Pokémon đã chơi được trong game. Tên, hệ, chỉ số gốc, tỉ lệ bắt, EXP lấy từ Pokédex;
// ở đây chỉ khai báo phần riêng của game:
//  learnset: [cấp, chiêu học được] • desc: mô tả ở màn chọn khởi đầu
//  color/belly/features: để vẽ hình tạm khi thiếu ảnh (xem src/gfx/textures.js)
const PLAYABLE = {
  charmander: {
    color: 0xf08a3c, belly: 0xf8d68a, features: ['flameTail'],
    learnset: [[1, 'scratch'], [1, 'ember'], [13, 'fireFang']],
    desc: 'Ngọn lửa ở đuôi cho biết sức sống của nó. Tấn công mạnh, nhanh nhẹn.',
  },
  squirtle: {
    color: 0x7ac4e8, belly: 0xf2e2a6, features: ['shell', 'curlyTail'],
    learnset: [[1, 'tackle'], [1, 'waterGun'], [13, 'waterPulse']],
    desc: 'Rút vào mai khi gặp nguy hiểm. Phòng thủ rất tốt.',
  },
  bulbasaur: {
    color: 0x6cc4a1, belly: 0x9be0c4, features: ['bulb', 'spots'],
    learnset: [[1, 'tackle'], [1, 'vineWhip'], [13, 'razorLeaf']],
    desc: 'Mang hạt giống trên lưng từ lúc mới sinh. Bền bỉ và cân bằng.',
  },
  rattata: {
    color: 0x9a6fb0, belly: 0xe8dcc0, features: ['bigEars', 'teeth', 'whiskers'],
    learnset: [[1, 'tackle'], [4, 'quickAttack'], [10, 'hyperFang']],
  },
  pidgey: {
    color: 0xb98a58, belly: 0xf0dcb4, features: ['wings', 'beak', 'crest'],
    learnset: [[1, 'tackle'], [5, 'gust'], [9, 'quickAttack'], [13, 'wingAttack']],
  },
  oddish: {
    color: 0x4a68b8, belly: 0x5a7ac8, features: ['leaves', 'redEyes'],
    learnset: [[1, 'absorb'], [9, 'megaDrain']],
  },
  poliwag: {
    color: 0x5a7fd0, belly: 0xffffff, features: ['swirl', 'tadpoleTail'],
    learnset: [[1, 'waterGun'], [11, 'bubbleBeam']],
  },
  pikachu: {
    color: 0xf6d43a, belly: 0xf6d43a, features: ['longEars', 'cheeks', 'zigzagTail'],
    learnset: [[1, 'thunderShock'], [1, 'quickAttack'], [13, 'spark']],
  },
  growlithe: {
    color: 0xf0903a, belly: 0xf6e6b0, features: ['roundEars', 'stripes', 'fluff'],
    learnset: [[1, 'tackle'], [5, 'ember'], [15, 'flameWheel']],
  },
};

export const SPECIES = Object.fromEntries(
  Object.entries(PLAYABLE).map(([id, extra]) => {
    const dex = DEX_BY_SLUG[id];
    const { total, ...base } = dex.stats;
    return [id, {
      id,
      dexId: dex.id,
      name: dex.name,
      types: dex.types,
      base,
      catchRate: dex.catchRate,
      baseExp: dex.baseExp,
      ...extra,
    }];
  }),
);

export const STARTERS = ['bulbasaur', 'charmander', 'squirtle'];
