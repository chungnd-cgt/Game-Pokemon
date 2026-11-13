import { timeOfDay } from '../game/clock.js';
import { SPECIES } from './monsters.js';
import { EXTRA_ENCOUNTERS } from './extra/index.js';

// Bảng Pokémon hoang dã theo từng khu. Cấp tăng dần theo khu (khu đầu dễ, khu sau mạnh hơn) và
// dạng tiến hoá chỉ xuất hiện ở khu sau, hiếm hơn. Khu nào dùng bảng nào khai báo ở bản đồ (data/map.js: areas, water).
// Mỗi bảng: { species, min, max (cấp), weight (tỉ lệ) }
export const ENCOUNTERS = {
  // Thị trấn Pallet: bụi cỏ duy nhất ở lối ra phía bắc (khu dễ nhất): chỉ Rattata, Pidgey, thỉnh thoảng mới có Poliwag (hiếm)
  'pallet-grass': [
    { species: 'rattata', min: 2, max: 4, weight: 45 },
    { species: 'pidgey', min: 2, max: 4, weight: 45 },
    { species: 'poliwag', min: 3, max: 5, weight: 10 },
  ],
  // Hồ nước: lướt nước (cần Pokémon biết Surf hoặc cưỡi Pokémon dưới nước)
  'pallet-lake-surf': [
    { species: 'poliwag', min: 26, max: 30, weight: 55 },
    { species: 'psyduck', min: 26, max: 30, weight: 35 },
    { species: 'poliwhirl', min: 28, max: 32, weight: 10 },
  ],
  // Câu cá ở hồ: cần càng tốt thì càng câu được Pokémon mạnh / hiếm
  'pallet-lake-old': [
    { species: 'magikarp', min: 5, max: 10, weight: 100 },
  ],
  'pallet-lake-good': [
    { species: 'magikarp', min: 10, max: 15, weight: 55 },
    { species: 'goldeen', min: 10, max: 15, weight: 30 },
    { species: 'poliwag', min: 10, max: 15, weight: 15 },
  ],
  'pallet-lake-super': [
    { species: 'goldeen', min: 15, max: 20, weight: 35 },
    { species: 'psyduck', min: 15, max: 20, weight: 25 },
    { species: 'poliwhirl', min: 15, max: 20, weight: 20 },
    { species: 'gyarados', min: 15, max: 20, weight: 10 },
    { species: 'seaking', min: 20, max: 22, weight: 10 },
  ],
};

// ---------- Chương 2: Tuyến đường 2 -> Hang Thạch Nhũ -> Tuyến đường 3 ----------
// Tuyến đường 2: tuyến làm quen ngay sau Pallet, tối đa Lv 7 (trước Team Rocket Lv 7 và Gary Lv 8 ở Lục Bình)
// Tuyến đầu tiên chủ yếu là sâu bọ: dòng Caterpie (Butterfree), dòng Weedle (Beedrill), Oddish; Pikachu hiếm (ít hơn hẳn)
ENCOUNTERS['route2-grass'] = [
  { species: 'caterpie', min: 3, max: 5, weight: 30 },
  { species: 'weedle', min: 3, max: 5, weight: 30 },
  { species: 'oddish', min: 4, max: 6, weight: 20 },
  { species: 'metapod', min: 4, max: 6, weight: 8 },
  { species: 'kakuna', min: 4, max: 6, weight: 8 },
  { species: 'pikachu', min: 4, max: 6, weight: 4 },
];
ENCOUNTERS['route2-deep'] = [
  { species: 'caterpie', min: 5, max: 7, weight: 22 },
  { species: 'weedle', min: 5, max: 7, weight: 22 },
  { species: 'oddish', min: 5, max: 7, weight: 22 },
  { species: 'metapod', min: 6, max: 7, weight: 14 },
  { species: 'kakuna', min: 6, max: 7, weight: 14 },
  { species: 'pikachu', min: 5, max: 7, weight: 6 },
];
// Trong hang: đi đâu cũng có thể gặp Pokémon (không cần bụi cỏ)
ENCOUNTERS.cave1 = [
  { species: 'zubat', min: 11, max: 14, weight: 45 },
  { species: 'geodude', min: 11, max: 14, weight: 35 },
  { species: 'ekans', min: 12, max: 14, weight: 10 },
  { species: 'koffing', min: 12, max: 14, weight: 10 },
  { species: 'paras', min: 11, max: 13, weight: 8 },
  { species: 'clefairy', min: 12, max: 14, weight: 4 },
];
// Tầng hầm Hang Thạch Nhũ: Pokémon mạnh hơn, có Onix và Machop
ENCOUNTERS['cave1-deep'] = [
  { species: 'zubat', min: 13, max: 16, weight: 35 },
  { species: 'geodude', min: 13, max: 16, weight: 30 },
  { species: 'machop', min: 13, max: 15, weight: 20 },
  { species: 'onix', min: 14, max: 16, weight: 10 },
  { species: 'golbat', min: 16, max: 17, weight: 5 },
  { species: 'diglett', min: 13, max: 15, weight: 8 },
  { species: 'clefairy', min: 14, max: 16, weight: 5 },
];
// Rừng Thông sau làng Chân Đồi: Pokémon cỏ và chim; cỏ rậm có Eevee hiếm
ENCOUNTERS.forest1 = [
  { species: 'oddish', min: 13, max: 15, weight: 25 },
  { species: 'bellsprout', min: 13, max: 15, weight: 25 },
  { species: 'pidgey', min: 13, max: 15, weight: 20 },
  { species: 'pidgeotto', min: 15, max: 16, weight: 10 },
  { species: 'rattata', min: 13, max: 15, weight: 10 },
  { species: 'pikachu', min: 13, max: 15, weight: 10 },
  { species: 'caterpie', min: 13, max: 14, weight: 8 },
  { species: 'weedle', min: 13, max: 14, weight: 8 },
  { species: 'metapod', min: 13, max: 15, weight: 6 },
  { species: 'kakuna', min: 13, max: 15, weight: 6 },
];
ENCOUNTERS['forest1-deep'] = [
  { species: 'gloom', min: 16, max: 17, weight: 25 },
  { species: 'weepinbell', min: 16, max: 17, weight: 25 },
  { species: 'pidgeotto', min: 16, max: 17, weight: 25 },
  { species: 'pikachu', min: 15, max: 16, weight: 15 },
  { species: 'eevee', min: 15, max: 15, weight: 10 },
  { species: 'butterfree', min: 15, max: 16, weight: 5 },
  { species: 'beedrill', min: 15, max: 16, weight: 5 },
  { species: 'venonat', min: 15, max: 16, weight: 8 },
  { species: 'paras', min: 15, max: 16, weight: 5 },
];
ENCOUNTERS['route3-grass'] = [
  { species: 'pidgey', min: 12, max: 14, weight: 25 },
  { species: 'oddish', min: 12, max: 14, weight: 20 },
  { species: 'poliwag', min: 12, max: 14, weight: 15 },
  { species: 'pikachu', min: 12, max: 14, weight: 15 },
  { species: 'pidgeotto', min: 14, max: 16, weight: 15 },
  { species: 'raticate', min: 14, max: 16, weight: 10 },
  { species: 'spearow', min: 12, max: 14, weight: 10 },
  { species: 'jigglypuff', min: 12, max: 14, weight: 8 },
  { species: 'sandshrew', min: 12, max: 14, weight: 8 },
  { species: 'nidoran-f', min: 12, max: 14, weight: 8 },
  { species: 'nidoran-m', min: 12, max: 14, weight: 8 },
];
ENCOUNTERS['route3-deep'] = [
  { species: 'growlithe', min: 14, max: 16, weight: 25 },
  { species: 'geodude', min: 14, max: 16, weight: 20 },
  { species: 'raticate', min: 14, max: 16, weight: 20 },
  { species: 'pidgeotto', min: 15, max: 17, weight: 20 },
  { species: 'pikachu', min: 14, max: 16, weight: 15 },
  { species: 'sandshrew', min: 14, max: 16, weight: 8 },
  { species: 'nidorina', min: 16, max: 17, weight: 6 },
  { species: 'nidorino', min: 16, max: 17, weight: 6 },
];
// Sông Lục Bình và ao Thị trấn Lục Bình: chỉ tới được khi lướt nước (sau Gym Sông Nước), cấp ngang các tuyến giữa hành trình
ENCOUNTERS['river1-surf'] = [
  { species: 'psyduck', min: 30, max: 34, weight: 35 },
  { species: 'poliwhirl', min: 30, max: 34, weight: 30 },
  { species: 'slowpoke', min: 30, max: 34, weight: 20 },
  { species: 'golduck', min: 33, max: 36, weight: 10 },
  { species: 'slowbro', min: 34, max: 37, weight: 5 },
];
ENCOUNTERS['river1-old'] = [{ species: 'magikarp', min: 8, max: 12, weight: 100 }];
ENCOUNTERS['river1-good'] = [
  { species: 'magikarp', min: 14, max: 18, weight: 45 },
  { species: 'goldeen', min: 14, max: 18, weight: 40 },
  { species: 'poliwag', min: 14, max: 18, weight: 15 },
];
ENCOUNTERS['river1-super'] = [
  { species: 'goldeen', min: 25, max: 30, weight: 30 },
  { species: 'seaking', min: 28, max: 32, weight: 20 },
  { species: 'poliwhirl', min: 25, max: 30, weight: 20 },
  { species: 'gyarados', min: 25, max: 30, weight: 15 },
  { species: 'dratini', min: 20, max: 25, weight: 15 },
];
ENCOUNTERS['route3-surf'] = [
  { species: 'poliwag', min: 28, max: 32, weight: 50 },
  { species: 'psyduck', min: 28, max: 32, weight: 35 },
  { species: 'poliwhirl', min: 30, max: 34, weight: 15 },
];
ENCOUNTERS['route3-old'] = [{ species: 'magikarp', min: 8, max: 12, weight: 100 }];
ENCOUNTERS['route3-good'] = [
  { species: 'magikarp', min: 12, max: 16, weight: 50 },
  { species: 'goldeen', min: 12, max: 16, weight: 35 },
  { species: 'poliwag', min: 12, max: 16, weight: 15 },
];
ENCOUNTERS['route3-super'] = [
  { species: 'goldeen', min: 18, max: 22, weight: 30 },
  { species: 'psyduck', min: 18, max: 22, weight: 25 },
  { species: 'poliwhirl', min: 20, max: 24, weight: 20 },
  { species: 'seaking', min: 22, max: 25, weight: 15 },
  { species: 'gyarados', min: 20, max: 24, weight: 10 },
];

// ---------- Gym 2-4: Tuyến đường 4 -> 5 -> 6 ----------
ENCOUNTERS['route4-grass'] = [
  { species: 'bellsprout', min: 16, max: 18, weight: 25 },
  { species: 'pidgeotto', min: 17, max: 19, weight: 15 },
  { species: 'oddish', min: 16, max: 18, weight: 20 },
  { species: 'ekans', min: 16, max: 18, weight: 15 },
  { species: 'meowth', min: 16, max: 18, weight: 15 },
  { species: 'raticate', min: 18, max: 19, weight: 10 },
  { species: 'doduo', min: 16, max: 18, weight: 10 },
  { species: 'spearow', min: 16, max: 18, weight: 8 },
];
ENCOUNTERS['route4-deep'] = [
  { species: 'bellsprout', min: 17, max: 19, weight: 25 },
  { species: 'growlithe', min: 17, max: 19, weight: 25 },
  { species: 'voltorb', min: 17, max: 19, weight: 20 },
  { species: 'pikachu', min: 17, max: 19, weight: 20 },
  { species: 'gloom', min: 21, max: 21, weight: 10 },
  { species: 'exeggcute', min: 17, max: 19, weight: 8 },
];
ENCOUNTERS['route5-grass'] = [
  { species: 'magnemite', min: 20, max: 22, weight: 25 },
  { species: 'voltorb', min: 20, max: 22, weight: 25 },
  { species: 'pikachu', min: 20, max: 22, weight: 20 },
  { species: 'pidgeotto', min: 21, max: 23, weight: 20 },
  { species: 'weepinbell', min: 22, max: 24, weight: 10 },
  { species: 'sandshrew', min: 20, max: 22, weight: 8 },
];
ENCOUNTERS['route5-deep'] = [
  { species: 'magnemite', min: 22, max: 24, weight: 25 },
  { species: 'voltorb', min: 22, max: 24, weight: 20 },
  { species: 'raticate', min: 22, max: 24, weight: 20 },
  { species: 'arbok', min: 22, max: 24, weight: 20 },
  { species: 'growlithe', min: 22, max: 24, weight: 15 },
];
ENCOUNTERS['route6-grass'] = [
  { species: 'psyduck', min: 24, max: 26, weight: 25 },
  { species: 'poliwhirl', min: 25, max: 27, weight: 20 },
  { species: 'weepinbell', min: 25, max: 27, weight: 20 },
  { species: 'pidgeotto', min: 25, max: 27, weight: 20 },
  { species: 'arbok', min: 24, max: 26, weight: 15 },
  { species: 'eevee', min: 24, max: 26, weight: 4 },
  { species: 'venonat', min: 24, max: 26, weight: 10 },
  { species: 'fearow', min: 25, max: 27, weight: 8 },
];
ENCOUNTERS['route6-deep'] = [
  { species: 'poliwhirl', min: 26, max: 28, weight: 25 },
  { species: 'raticate', min: 26, max: 28, weight: 25 },
  { species: 'magneton', min: 30, max: 30, weight: 10 },
  { species: 'gloom', min: 26, max: 28, weight: 20 },
  { species: 'arbok', min: 26, max: 28, weight: 20 },
  { species: 'tangela', min: 26, max: 28, weight: 8 },
  { species: 'exeggcute', min: 26, max: 28, weight: 6 },
];
ENCOUNTERS['route6-surf'] = [
  { species: 'tentacool', min: 24, max: 29, weight: 50 },
  { species: 'staryu', min: 25, max: 29, weight: 25 },
  { species: 'psyduck', min: 25, max: 29, weight: 15 },
  { species: 'tentacruel', min: 30, max: 32, weight: 10 },
  { species: 'krabby', min: 25, max: 29, weight: 10 },
  { species: 'horsea', min: 25, max: 29, weight: 10 },
];
ENCOUNTERS['route6-old'] = [{ species: 'magikarp', min: 10, max: 15, weight: 100 }];
ENCOUNTERS['route6-good'] = [
  { species: 'magikarp', min: 20, max: 25, weight: 40 },
  { species: 'goldeen', min: 20, max: 25, weight: 35 },
  { species: 'staryu', min: 20, max: 25, weight: 25 },
  { species: 'krabby', min: 20, max: 25, weight: 20 },
];
ENCOUNTERS['route6-super'] = [
  { species: 'seaking', min: 28, max: 33, weight: 30 },
  { species: 'staryu', min: 28, max: 33, weight: 25 },
  { species: 'tentacool', min: 28, max: 33, weight: 25 },
  { species: 'gyarados', min: 28, max: 33, weight: 20 },
  { species: 'horsea', min: 28, max: 33, weight: 15 },
  { species: 'kingler', min: 30, max: 33, weight: 8 },
  { species: 'seadra', min: 32, max: 33, weight: 5 },
];

// ---------- Gym 5-8: Tuyến đường 7 -> 8 -> 9 (Hang Sơn Động) -> 10 ----------
ENCOUNTERS['route7-grass'] = [
  { species: 'vulpix', min: 28, max: 31, weight: 25 },
  { species: 'ponyta', min: 28, max: 31, weight: 25 },
  { species: 'drowzee', min: 28, max: 30, weight: 20 },
  { species: 'growlithe', min: 29, max: 31, weight: 10 },
  { species: 'raticate', min: 30, max: 32, weight: 10 },
  { species: 'persian', min: 29, max: 31, weight: 10 },
  { species: 'tauros', min: 29, max: 31, weight: 6 },
  { species: 'dodrio', min: 31, max: 32, weight: 6 },
];
ENCOUNTERS['route7-deep'] = [
  { species: 'ponyta', min: 31, max: 34, weight: 30 },
  { species: 'vulpix', min: 31, max: 33, weight: 25 },
  { species: 'arbok', min: 31, max: 34, weight: 20 },
  { species: 'weepinbell', min: 31, max: 33, weight: 15 },
  { species: 'hypno', min: 32, max: 34, weight: 10 },
  { species: 'kangaskhan', min: 31, max: 33, weight: 5 },
  { species: 'chansey', min: 31, max: 33, weight: 3 },
];
ENCOUNTERS['route8-grass'] = [
  { species: 'graveler', min: 32, max: 35, weight: 30 },
  { species: 'onix', min: 32, max: 35, weight: 25 },
  { species: 'rhyhorn', min: 32, max: 35, weight: 25 },
  { species: 'arbok', min: 33, max: 35, weight: 20 },
  { species: 'sandslash', min: 32, max: 35, weight: 12 },
  { species: 'fearow', min: 33, max: 35, weight: 10 },
  { species: 'dugtrio', min: 32, max: 35, weight: 8 },
];
ENCOUNTERS['route8-deep'] = [
  { species: 'onix', min: 34, max: 37, weight: 30 },
  { species: 'rhyhorn', min: 34, max: 37, weight: 30 },
  { species: 'graveler', min: 34, max: 37, weight: 25 },
  { species: 'golbat', min: 34, max: 37, weight: 15 },
  { species: 'sandslash', min: 34, max: 37, weight: 10 },
  { species: 'marowak', min: 34, max: 37, weight: 6 },
];
ENCOUNTERS['route9-grass'] = [
  { species: 'lickitung', min: 35, max: 37, weight: 10 },
  { species: 'drowzee', min: 35, max: 38, weight: 25 },
  { species: 'slowpoke', min: 35, max: 38, weight: 25 },
  { species: 'abra', min: 35, max: 37, weight: 15 },
  { species: 'kadabra', min: 36, max: 38, weight: 15 },
  { species: 'hypno', min: 36, max: 38, weight: 20 },
  { species: 'mr-mime', min: 35, max: 37, weight: 5 },
  { species: 'scyther', min: 36, max: 38, weight: 5 },
  { species: 'venomoth', min: 35, max: 37, weight: 8 },
];
ENCOUNTERS['route9-deep'] = [
  { species: 'hypno', min: 37, max: 40, weight: 30 },
  { species: 'kadabra', min: 37, max: 40, weight: 25 },
  { species: 'slowpoke', min: 37, max: 40, weight: 25 },
  { species: 'rapidash', min: 40, max: 40, weight: 20 },
  { species: 'scyther', min: 37, max: 40, weight: 6 },
  { species: 'pinsir', min: 37, max: 40, weight: 6 },
];
ENCOUNTERS.cave2 = [
  { species: 'golbat', min: 37, max: 42, weight: 35 },
  { species: 'graveler', min: 37, max: 42, weight: 25 },
  { species: 'onix', min: 38, max: 42, weight: 20 },
  { species: 'rhyhorn', min: 38, max: 41, weight: 15 },
  { species: 'rhydon', min: 42, max: 43, weight: 5 },
  { species: 'parasect', min: 37, max: 40, weight: 8 },
  { species: 'clefairy', min: 38, max: 40, weight: 4 },
];
ENCOUNTERS['route10-grass'] = [
  { species: 'jynx', min: 40, max: 44, weight: 30 },
  { species: 'seel', min: 40, max: 43, weight: 25 },
  { species: 'slowpoke', min: 40, max: 43, weight: 20 },
  { species: 'hypno', min: 41, max: 44, weight: 15 },
  { species: 'dewgong', min: 43, max: 45, weight: 10 },
  { species: 'dodrio', min: 41, max: 44, weight: 8 },
];
ENCOUNTERS['route10-deep'] = [
  { species: 'jynx', min: 42, max: 46, weight: 30 },
  { species: 'dewgong', min: 42, max: 46, weight: 25 },
  { species: 'rapidash', min: 42, max: 45, weight: 20 },
  { species: 'rhydon', min: 42, max: 46, weight: 15 },
  { species: 'alakazam', min: 44, max: 46, weight: 10 },
  { species: 'tauros', min: 42, max: 45, weight: 6 },
  { species: 'kangaskhan', min: 42, max: 45, weight: 5 },
];
ENCOUNTERS['route10-surf'] = [
  { species: 'seel', min: 40, max: 45, weight: 40 },
  { species: 'shellder', min: 40, max: 45, weight: 30 },
  { species: 'dewgong', min: 43, max: 47, weight: 20 },
  { species: 'lapras', min: 45, max: 48, weight: 10 },
];
ENCOUNTERS['route10-old'] = [{ species: 'magikarp', min: 15, max: 20, weight: 100 }];
ENCOUNTERS['route10-good'] = [
  { species: 'shellder', min: 30, max: 35, weight: 40 },
  { species: 'seel', min: 30, max: 35, weight: 35 },
  { species: 'goldeen', min: 30, max: 35, weight: 25 },
];
ENCOUNTERS['route10-super'] = [
  { species: 'cloyster', min: 42, max: 47, weight: 25 },
  { species: 'gyarados', min: 42, max: 47, weight: 30 },
  { species: 'seaking', min: 42, max: 47, weight: 25 },
  { species: 'lapras', min: 45, max: 48, weight: 20 },
  { species: 'seadra', min: 42, max: 47, weight: 10 },
  { species: 'kingler', min: 42, max: 47, weight: 10 },
];

// ---------- Liên minh: Đường Chiến Thắng -> Hang Vân Sơn ----------
ENCOUNTERS['route11-grass'] = [
  { species: 'machoke', min: 45, max: 48, weight: 25 },
  { species: 'primeape', min: 45, max: 48, weight: 25 },
  { species: 'graveler', min: 45, max: 48, weight: 20 },
  { species: 'grimer', min: 44, max: 47, weight: 15 },
  { species: 'hitmonlee', min: 47, max: 47, weight: 5 },
  { species: 'hitmonchan', min: 47, max: 47, weight: 5 },
  { species: 'machop', min: 42, max: 45, weight: 5 },
];
ENCOUNTERS['route11-deep'] = [
  { species: 'machoke', min: 47, max: 50, weight: 25 },
  { species: 'muk', min: 47, max: 50, weight: 20 },
  { species: 'primeape', min: 47, max: 50, weight: 20 },
  { species: 'golbat', min: 47, max: 50, weight: 20 },
  { species: 'snorlax', min: 48, max: 50, weight: 5 },
  { species: 'mankey', min: 44, max: 47, weight: 10 },
  { species: 'ditto', min: 46, max: 48, weight: 5 },
];
ENCOUNTERS.cave3 = [
  { species: 'golbat', min: 46, max: 50, weight: 25 },
  { species: 'haunter', min: 46, max: 50, weight: 20 },
  { species: 'graveler', min: 46, max: 50, weight: 20 },
  { species: 'onix', min: 46, max: 50, weight: 10 },
  { species: 'gastly', min: 42, max: 45, weight: 10 },
  { species: 'dratini', min: 40, max: 44, weight: 8 },
  { species: 'dragonair', min: 48, max: 50, weight: 2 },
  { species: 'ditto', min: 46, max: 48, weight: 5 },
];

// ---------- Nước ngầm trong hang (lướt nước / câu cá, data/map.js: water của bản đồ hang) ----------
// Chỉ tới được khi lướt nước (sau Gym Sông Nước) nên cấp cao hơn Pokémon trên cạn của hang cùng chặng một chút.
// Trong hang không chia theo buổi (tên bảng có "cave"). Golbat bay là là trên mặt nước tối; hang băng có Seel / Dewgong
// Hồ ngầm tầng hầm Hang Thạch Nhũ: ngang các hồ ngoài trời đầu hành trình (hồ Pallet, hồ Tuyến 3)
ENCOUNTERS['cave1-surf'] = [
  { species: 'psyduck', min: 26, max: 30, weight: 35 },
  { species: 'slowpoke', min: 26, max: 30, weight: 25 },
  { species: 'golbat', min: 28, max: 31, weight: 20 },
  { species: 'krabby', min: 26, max: 29, weight: 15 },
  { species: 'golduck', min: 30, max: 32, weight: 5 },
];
ENCOUNTERS['cave1-old'] = [{ species: 'magikarp', min: 8, max: 12, weight: 100 }];
ENCOUNTERS['cave1-good'] = [
  { species: 'magikarp', min: 12, max: 16, weight: 40 },
  { species: 'goldeen', min: 12, max: 16, weight: 30 },
  { species: 'krabby', min: 12, max: 16, weight: 20 },
  { species: 'poliwag', min: 12, max: 16, weight: 10 },
];
ENCOUNTERS['cave1-super'] = [
  { species: 'goldeen', min: 20, max: 24, weight: 25 },
  { species: 'krabby', min: 20, max: 24, weight: 25 },
  { species: 'seaking', min: 23, max: 26, weight: 15 },
  { species: 'kingler', min: 25, max: 27, weight: 10 },
  { species: 'gyarados', min: 20, max: 24, weight: 15 },
  { species: 'horsea', min: 20, max: 24, weight: 10 },
];
// Suối ngầm tầng hầm Hang Sơn Động: cấp ngang Pokémon tầng hầm
ENCOUNTERS['cave2-surf'] = [
  { species: 'golbat', min: 38, max: 42, weight: 25 },
  { species: 'psyduck', min: 36, max: 40, weight: 20 },
  { species: 'slowpoke', min: 36, max: 40, weight: 20 },
  { species: 'krabby', min: 36, max: 40, weight: 15 },
  { species: 'golduck', min: 40, max: 43, weight: 10 },
  { species: 'kingler', min: 40, max: 43, weight: 5 },
  { species: 'slowbro', min: 41, max: 43, weight: 5 },
];
ENCOUNTERS['cave2-old'] = [{ species: 'magikarp', min: 10, max: 15, weight: 100 }];
ENCOUNTERS['cave2-good'] = [
  { species: 'magikarp', min: 25, max: 30, weight: 35 },
  { species: 'goldeen', min: 25, max: 30, weight: 30 },
  { species: 'poliwag', min: 25, max: 30, weight: 20 },
  { species: 'krabby', min: 25, max: 30, weight: 15 },
];
ENCOUNTERS['cave2-super'] = [
  { species: 'kingler', min: 38, max: 42, weight: 25 },
  { species: 'seaking', min: 38, max: 42, weight: 25 },
  { species: 'poliwhirl', min: 38, max: 42, weight: 20 },
  { species: 'gyarados', min: 38, max: 42, weight: 15 },
  { species: 'seadra', min: 39, max: 42, weight: 10 },
  { species: 'horsea', min: 36, max: 40, weight: 5 },
];
// Hồ băng ngầm tầng hầm Hang Vân Sơn: nước lạnh, Pokémon băng; cấp ngang tầng hầm
ENCOUNTERS['cave3-surf'] = [
  { species: 'seel', min: 46, max: 50, weight: 30 },
  { species: 'golbat', min: 48, max: 51, weight: 20 },
  { species: 'dewgong', min: 48, max: 52, weight: 20 },
  { species: 'golduck', min: 47, max: 50, weight: 15 },
  { species: 'slowbro', min: 48, max: 51, weight: 10 },
  { species: 'lapras', min: 50, max: 52, weight: 5 },
];
ENCOUNTERS['cave3-old'] = [{ species: 'magikarp', min: 15, max: 20, weight: 100 }];
ENCOUNTERS['cave3-good'] = [
  { species: 'shellder', min: 32, max: 37, weight: 35 },
  { species: 'krabby', min: 32, max: 37, weight: 25 },
  { species: 'goldeen', min: 32, max: 37, weight: 25 },
  { species: 'horsea', min: 32, max: 37, weight: 15 },
];
ENCOUNTERS['cave3-super'] = [
  { species: 'cloyster', min: 46, max: 50, weight: 20 },
  { species: 'dewgong', min: 46, max: 50, weight: 20 },
  { species: 'kingler', min: 46, max: 50, weight: 15 },
  { species: 'seadra', min: 46, max: 50, weight: 15 },
  { species: 'gyarados', min: 46, max: 50, weight: 20 },
  { species: 'seaking', min: 46, max: 50, weight: 10 },
];
// Vũng nước băng trong hầm băng sâu nhất: mạnh nhất trong các hang
ENCOUNTERS['cave3c-surf'] = [
  { species: 'dewgong', min: 51, max: 54, weight: 30 },
  { species: 'seel', min: 50, max: 53, weight: 20 },
  { species: 'cloyster', min: 51, max: 54, weight: 20 },
  { species: 'golbat', min: 51, max: 54, weight: 15 },
  { species: 'lapras', min: 52, max: 55, weight: 15 },
];
ENCOUNTERS['cave3c-old'] = [{ species: 'magikarp', min: 15, max: 20, weight: 100 }];
ENCOUNTERS['cave3c-good'] = [
  { species: 'shellder', min: 35, max: 40, weight: 40 },
  { species: 'seel', min: 35, max: 40, weight: 35 },
  { species: 'horsea', min: 35, max: 40, weight: 25 },
];
ENCOUNTERS['cave3c-super'] = [
  { species: 'dewgong', min: 50, max: 54, weight: 25 },
  { species: 'cloyster', min: 50, max: 54, weight: 25 },
  { species: 'gyarados', min: 50, max: 54, weight: 20 },
  { species: 'seadra', min: 50, max: 54, weight: 15 },
  { species: 'kingler', min: 50, max: 54, weight: 15 },
];
// Hố ngập nước trong Mỏ Đất Sét (khu phụ Làng Đất Sét, sau Gym Sông Nước): nước bùn, Pokémon cua / cá
ENCOUNTERS['pit5-surf'] = [
  { species: 'psyduck', min: 28, max: 32, weight: 30 },
  { species: 'poliwhirl', min: 28, max: 32, weight: 25 },
  { species: 'krabby', min: 28, max: 31, weight: 25 },
  { species: 'golbat', min: 30, max: 33, weight: 15 },
  { species: 'golduck', min: 31, max: 33, weight: 5 },
];
ENCOUNTERS['pit5-old'] = [{ species: 'magikarp', min: 10, max: 15, weight: 100 }];
ENCOUNTERS['pit5-good'] = [
  { species: 'magikarp', min: 20, max: 25, weight: 35 },
  { species: 'poliwag', min: 20, max: 25, weight: 30 },
  { species: 'krabby', min: 20, max: 25, weight: 20 },
  { species: 'goldeen', min: 20, max: 25, weight: 15 },
];
ENCOUNTERS['pit5-super'] = [
  { species: 'poliwhirl', min: 28, max: 32, weight: 30 },
  { species: 'kingler', min: 29, max: 32, weight: 20 },
  { species: 'seaking', min: 28, max: 32, weight: 20 },
  { species: 'gyarados', min: 28, max: 32, weight: 20 },
  { species: 'slowpoke', min: 28, max: 32, weight: 10 },
];

// ---------- Pokémon theo buổi trong ngày ----------
// Loài ghi ở đây chỉ xuất hiện vào một buổi ('day' ban ngày | 'dusk' chạng vạng | 'night' ban đêm, xem game/clock.js);
// loài không ghi thì xuất hiện cả ngày. Bụi cỏ và lướt nước chia theo buổi; hang và câu cá thì loài nào cũng có cả ngày.
// Buổi nào mỗi khu cũng còn ít nhất 2 loài.
const TIME_ONLY = {
  forest1: { caterpie: 'day', weedle: 'night' },
  'forest1-deep': { butterfree: 'day', beedrill: 'dusk', venonat: 'night', paras: 'night' },
  'route3-grass': { pidgey: 'day', pikachu: 'day', oddish: 'night', raticate: 'night', spearow: 'day', jigglypuff: 'dusk' },
  'route3-deep': { pidgeotto: 'day', growlithe: 'dusk', raticate: 'night' },
  'route4-grass': { pidgeotto: 'day', ekans: 'dusk', oddish: 'night', meowth: 'night', doduo: 'day' },
  'route4-deep': { pikachu: 'day', growlithe: 'dusk', gloom: 'night' },
  'route5-grass': { pikachu: 'day', pidgeotto: 'day', weepinbell: 'dusk' },
  'route5-deep': { voltorb: 'dusk', growlithe: 'dusk', raticate: 'night' },
  'route6-grass': { pidgeotto: 'day', poliwhirl: 'dusk', arbok: 'night', venonat: 'night', fearow: 'day' },
  'route6-deep': { magneton: 'day', raticate: 'night', gloom: 'night' },
  'route7-grass': { ponyta: 'day', growlithe: 'dusk', vulpix: 'night', drowzee: 'night', persian: 'night', tauros: 'day', dodrio: 'dusk' },
  'route7-deep': { ponyta: 'day', vulpix: 'dusk', hypno: 'night', kangaskhan: 'day' },
  'route8-grass': { rhyhorn: 'day', arbok: 'dusk', fearow: 'day' },
  'route8-deep': { rhyhorn: 'day', golbat: 'night' },
  'route9-grass': { slowpoke: 'day', kadabra: 'dusk', drowzee: 'night', hypno: 'night', 'mr-mime': 'day', venomoth: 'night' },
  'route9-deep': { slowpoke: 'day', rapidash: 'dusk', hypno: 'night' },
  'route10-grass': { slowpoke: 'day', dewgong: 'dusk', jynx: 'night', hypno: 'night', dodrio: 'day' },
  'route10-deep': { rapidash: 'day', alakazam: 'dusk', jynx: 'night', tauros: 'day' },
  'route11-grass': { primeape: 'day', hitmonlee: 'day', hitmonchan: 'dusk', grimer: 'night' },
  'route11-deep': { primeape: 'day', mankey: 'dusk', muk: 'night', golbat: 'night' },
  // Lướt nước
  'pallet-lake-surf': { poliwhirl: 'night' },
  'river1-surf': { slowpoke: 'day', golduck: 'dusk' },
  'route3-surf': { poliwhirl: 'dusk' },
  'route6-surf': { tentacruel: 'dusk', staryu: 'night', krabby: 'day', horsea: 'night' },
  'route10-surf': { dewgong: 'dusk', lapras: 'night' },
};
for (const [zone, times] of Object.entries(TIME_ONLY)) {
  for (const [species, time] of Object.entries(times)) {
    const entry = ENCOUNTERS[zone].find((e) => e.species === species);
    if (!entry) throw new Error(`${zone} không có ${species}`);
    entry.time = time;
  }
}

// Các loài gặp được ở khu này vào buổi phase
export const encountersAt = (zone, phase = timeOfDay()) => ENCOUNTERS[zone].filter((e) => !e.time || e.time === phase);

// lead: Pokémon đầu đội (tuỳ chọn). Có Magnet Pull thì 50% chắc chắn gặp Pokémon hệ Thép, nếu khu có loài hệ Thép
// phase: buổi trong ngày (mặc định theo đồng hồ trong game)
export function rollEncounter(zone, rng = Math.random, lead = null, phase = timeOfDay()) {
  let table = encountersAt(zone, phase);
  if (lead?.ability === 'magnetPull') {
    const steel = table.filter((e) => SPECIES[e.species].types.includes('steel'));
    if (steel.length && rng() < 0.5) table = steel;
  }
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  const entry = table.find((e) => (roll -= e.weight) < 0) ?? table[table.length - 1];
  const level = entry.min + Math.floor(rng() * (entry.max - entry.min + 1));
  return { speciesId: entry.species, level };
}

// "Lv 2-4": cấp thấp nhất - cao nhất của một bảng
export function levelRange(zone) {
  const t = ENCOUNTERS[zone];
  const lo = Math.min(...t.map((e) => e.min));
  const hi = Math.max(...t.map((e) => e.max));
  return lo === hi ? `Lv ${lo}` : `Lv ${lo}-${hi}`;
}

// Bảng Pokémon hoang dã ở các khu mở rộng (data/extra/)
Object.assign(ENCOUNTERS, EXTRA_ENCOUNTERS);
