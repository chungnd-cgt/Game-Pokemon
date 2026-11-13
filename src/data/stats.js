// Các chỉ số của Pokémon và giới hạn IV / EV
export const STAT_KEYS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];
// Chỉ số đổi được bậc trong trận (không có HP)
export const STAGE_KEYS = ['atk', 'def', 'spAtk', 'spDef', 'speed', 'accuracy', 'evasion'];

// Tên chỉ số: giữ tiếng Anh viết tắt cho gọn (giống game gốc bản tiếng Anh), dùng chung mọi nơi
// (trận đấu, thẻ bậc chỉ số, màn chi tiết, Pokédex, tính cách, EV, mô tả đặc tính / vật phẩm)
export const STAT_NAMES = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spAtk: 'SpA',
  spDef: 'SpD',
  speed: 'Spe',
  accuracy: 'Accuracy',
  evasion: 'Evasion',
};
export const STAT_SHORT = STAT_NAMES;
export const STAGE_SHORT = STAT_NAMES;
// Bậc chỉ số hiện thành thẻ dưới thanh HP (độ chính xác / né tránh không hiện thẻ, chỉ báo bằng lời)
export const CHIP_STAGE_KEYS = ['atk', 'def', 'spAtk', 'spDef', 'speed'];

export const IV_MAX = 31;
export const EV_MAX_STAT = 252;
export const EV_MAX_TOTAL = 510;
export const STAGE_MAX = 6;

const YIELD_NAMES = { HP: 'hp', Attack: 'atk', Defense: 'def', 'Sp. Atk': 'spAtk', 'Sp. Def': 'spDef', Speed: 'speed' };

// "1 Sp. Atk" / "2 Speed, 1 Attack" (dữ liệu Pokédex) -> { spAtk: 1 }
export function parseEvYield(text) {
  const out = {};
  for (const part of text.split(',')) {
    const m = part.trim().match(/^(\d+)\s+(.+)$/);
    if (m && YIELD_NAMES[m[2]]) out[YIELD_NAMES[m[2]]] = Number(m[1]);
  }
  return out;
}

// "87.5% male, 12.5% female" -> 0.125 (tỉ lệ cái); "Genderless" -> null
export function parseFemaleRatio(text) {
  const m = text.match(/([\d.]+)% female/);
  return m ? Number(m[1]) / 100 : null;
}

export const emptyStats = (v = 0) => Object.fromEntries(STAT_KEYS.map((k) => [k, v]));
