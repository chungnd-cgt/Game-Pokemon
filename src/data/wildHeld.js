import { ITEMS } from './items.js';

// Pokémon hoang dã cầm sẵn vật phẩm (như game gốc): loài -> [[vật phẩm, tỉ lệ], ...]. Mỗi lần gặp tung một lần: tỉ lệ các món
// cộng dồn (vd [[a, 0.5], [b, 0.05]]: 50% cầm a, 5% cầm b, 45% không cầm gì). Loài không có trong bảng thì không cầm gì.
// Bắt được thì Pokémon giữ luôn món đang cầm (cất vào túi bằng nút Cất trong bảng chi tiết); Thief / Covet lấy được.
export const COMMON = 0.5;
export const UNCOMMON = 0.2;
export const RARE = 0.05;

export const WILD_HELD = {
  // Hệ Bay: Sharp Beak
  pidgey: [['sharpBeak', RARE]],
  pidgeotto: [['sharpBeak', RARE]],
  pidgeot: [['sharpBeak', RARE]],
  spearow: [['sharpBeak', RARE]],
  fearow: [['sharpBeak', RARE]],
  doduo: [['sharpBeak', RARE]],
  dodrio: [['sharpBeak', RARE]],
  farfetchd: [['sharpBeak', UNCOMMON]],
  // Hệ Cỏ: Miracle Seed
  oddish: [['miracleSeed', RARE]],
  gloom: [['miracleSeed', RARE]],
  bellsprout: [['miracleSeed', RARE]],
  weepinbell: [['miracleSeed', RARE]],
  tangela: [['miracleSeed', RARE]],
  exeggcute: [['miracleSeed', RARE]],
  // Bọ ăn lá / nấm: quả mọng
  caterpie: [['oranBerry', RARE]],
  paras: [['pechaBerry', UNCOMMON], ['lumBerry', RARE]],
  parasect: [['pechaBerry', UNCOMMON], ['lumBerry', RARE]],
  venonat: [['pechaBerry', RARE]],
  // Hệ Độc: Poison Barb
  weedle: [['poisonBarb', RARE]],
  beedrill: [['poisonBarb', RARE]],
  'nidoran-f': [['poisonBarb', RARE]],
  'nidoran-m': [['poisonBarb', RARE]],
  ekans: [['poisonBarb', RARE]],
  koffing: [['poisonBarb', RARE]],
  grimer: [['poisonBarb', RARE]],
  tentacool: [['poisonBarb', RARE]],
  tentacruel: [['poisonBarb', RARE]],
  // Hệ Đá / Đất: Everstone, Hard Stone
  geodude: [['everstone', RARE]],
  graveler: [['everstone', RARE]],
  onix: [['hardStone', RARE]],
  rhyhorn: [['hardStone', RARE]],
  sandshrew: [['hardStone', RARE]],
  diglett: [['hardStone', RARE]],
  // Hệ Điện: Magnet
  magnemite: [['magnet', RARE]],
  magneton: [['magnet', RARE]],
  pikachu: [['oranBerry', RARE]],
  electabuzz: [['magnet', RARE]],
  // Hệ Lửa: Charcoal, Rawst Berry
  vulpix: [['rawstBerry', RARE]],
  growlithe: [['charcoal', RARE]],
  ponyta: [['charcoal', RARE]],
  magmar: [['charcoal', RARE]],
  // Hệ Nước: Mystic Water
  psyduck: [['mysticWater', RARE]],
  poliwag: [['mysticWater', RARE]],
  goldeen: [['mysticWater', RARE]],
  horsea: [['mysticWater', RARE]],
  staryu: [['mysticWater', RARE]],
  shellder: [['mysticWater', RARE]],
  krabby: [['mysticWater', RARE]],
  // Hệ Băng: Never-Melt Ice, Aspear Berry
  seel: [['aspearBerry', UNCOMMON]],
  dewgong: [['neverMeltIce', RARE]],
  jynx: [['neverMeltIce', RARE], ['aspearBerry', RARE]],
  // Hệ Siêu linh: Twisted Spoon
  abra: [['twistedSpoon', RARE]],
  kadabra: [['twistedSpoon', RARE]],
  drowzee: [['twistedSpoon', RARE]],
  slowpoke: [['twistedSpoon', RARE]],
  // Hệ Thường: quả mọng, Silk Scarf
  rattata: [['oranBerry', RARE]],
  meowth: [['silkScarf', RARE]],
  jigglypuff: [['oranBerry', UNCOMMON]],
  clefairy: [['moonStone', RARE], ['leppaBerry', RARE]],
  tauros: [['silkScarf', RARE]],
  kangaskhan: [['silkScarf', RARE]],
  chansey: [['luckyEgg', RARE]],
  snorlax: [['leftovers', COMMON]],
  // Hệ Giác đấu: Macho Brace
  machop: [['machoBrace', RARE]],
  mankey: [['chestoBerry', RARE]],
  // Hệ Bóng ma / Bóng tối
  gastly: [['blackGlasses', RARE]],
  haunter: [['blackGlasses', RARE]],
};

for (const [species, list] of Object.entries(WILD_HELD)) {
  for (const [id] of list) if (!ITEMS[id]) throw new Error(`WILD_HELD: ${species} cầm vật phẩm lạ ${id}`);
}

// Tung xem Pokémon hoang dã loài này có cầm gì không: id vật phẩm hoặc null
export function rollWildHeld(speciesId, rng = Math.random) {
  const list = WILD_HELD[speciesId];
  if (!list) return null;
  let roll = rng();
  for (const [id, chance] of list) {
    if ((roll -= chance) < 0) return id;
  }
  return null;
}

// Loài này có thể cầm vật phẩm khi gặp ngoài tự nhiên không (bảng Pokémon khu vực đánh dấu)
export const canHoldWild = (speciesId) => Boolean(WILD_HELD[speciesId]);
