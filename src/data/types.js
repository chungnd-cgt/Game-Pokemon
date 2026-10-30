// 18 hệ, tên tiếng Việt, màu theo bảng màu chuẩn của game
export const TYPES = {
  normal: { name: 'Thường', short: 'Thg', color: 0xa8a77a },
  fire: { name: 'Lửa', short: 'Lửa', color: 0xee8130 },
  water: { name: 'Nước', short: 'Nước', color: 0x6390f0 },
  electric: { name: 'Điện', short: 'Điện', color: 0xf7d02c },
  grass: { name: 'Cỏ', short: 'Cỏ', color: 0x7ac74c },
  ice: { name: 'Băng', short: 'Băng', color: 0x96d9d6 },
  fighting: { name: 'Giác đấu', short: 'G.đấu', color: 0xc22e28 },
  poison: { name: 'Độc', short: 'Độc', color: 0xa33ea1 },
  ground: { name: 'Đất', short: 'Đất', color: 0xe2bf65 },
  flying: { name: 'Bay', short: 'Bay', color: 0xa98ff3 },
  psychic: { name: 'Siêu linh', short: 'S.linh', color: 0xf95587 },
  bug: { name: 'Bọ', short: 'Bọ', color: 0xa6b91a },
  rock: { name: 'Đá', short: 'Đá', color: 0xb6a136 },
  ghost: { name: 'Ma', short: 'Ma', color: 0x735797 },
  dragon: { name: 'Rồng', short: 'Rồng', color: 0x6f35fc },
  dark: { name: 'Bóng tối', short: 'B.tối', color: 0x705746 },
  steel: { name: 'Thép', short: 'Thép', color: 0xb7b7ce },
  fairy: { name: 'Tiên', short: 'Tiên', color: 0xd685ad },
};

// CHART[hệ của chiêu][hệ bị đánh] = hệ số (không có = 1). Bảng chuẩn từ Gen 6.
const CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

// Hệ số khi chiêu hệ moveType đánh vào Pokémon có các hệ targetTypes (1 hoặc 2 hệ)
export function typeMultiplier(moveType, targetTypes) {
  return [targetTypes].flat().reduce((m, t) => m * (CHART[moveType]?.[t] ?? 1), 1);
}

// Gen 1-3: chiêu thuộc các hệ này là chiêu đặc biệt (dùng Sp. Atk / Sp. Def)
export const SPECIAL_TYPES = ['fire', 'water', 'grass', 'electric', 'ice', 'psychic', 'dragon', 'dark'];
