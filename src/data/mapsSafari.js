import { roomy } from './indoorLayout.js';
import { berryRow } from './berryRows.js';
import { INDOOR_TILES, OUTDOOR_TILES } from './tiles.js';

// Khu Safari (vào từ nhà Safari ở Thành phố Lò Gốm, gym 5). Vé / gói: game/safari.js; nhân viên: story/safari.js.
//  safariGate   nhà Safari: quầy bán vé (trái), quầy bán gói 24 giờ (phải), bảo vệ đứng giữa hai cửa lớn phía bắc
//               (cửa trái vào khu Safari, cửa phải vào khu Safari Effort; chưa có vé thì bảo vệ chặn lại)
//  safariZone   khu Safari: 4 khu quanh một con đường giữa (Rừng Già tây bắc, Đồi Đá đông bắc, Đồng Cỏ tây nam, Hồ Ngọc
//               đông nam, lướt nước / câu cá được), nhiều loài hiếm, có loài không gặp ở nơi nào khác
//  safariEffort khu Safari Effort (luyện EV): 3 khu, mỗi khu 2 bãi cỏ, mỗi bãi đúng một loài cho +3 EV một chỉ số,
//               cạnh mỗi bãi có luống 2 cây quả giảm EV đúng chỉ số đó
// Hai bản đồ ngoài trời dựng bằng code (khối cây 2x2 ở toạ độ chẵn, bãi cỏ, hồ, đường) cho dễ chỉnh

// ---------- Dựng lưới ô ----------

function canvas(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const fill = (x1, y1, x2, y2, ch) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = ch;
  };
  return {
    fill,
    // Cây phủ kín [x1..x2] x [y1..y2]: góc trên trái chẵn, góc dưới phải lẻ (khối 2x2 thẳng hàng)
    trees(x1, y1, x2, y2) {
      if (x1 % 2 || y1 % 2 || x2 % 2 === 0 || y2 % 2 === 0) throw new Error(`Khối cây lệch: ${x1},${y1} - ${x2},${y2}`);
      fill(x1, y1, x2, y2, 'T');
    },
    set: (x, y, ch) => {
      g[y][x] = ch;
    },
    rows: () => g.map((r) => r.join('')),
  };
}

// ---------- Khu Safari: 56 x 44 ----------
// Đường giữa (x 28-29) từ cổng vào (đáy) chạy thẳng lên bắc; hai dải cây (x 26-27 và 30-31) chắn hai bên, chừa lối sang
// 4 khu. Dải cây ngang (y 20-21) chia bắc / nam, chừa lối nối hai khu cùng phía. Sân cổng (y 38-41) có nhân viên Safari
const ZONE_W = 56;
const ZONE_H = 44;

function safariZoneRows() {
  const c = canvas(ZONE_W, ZONE_H);
  // Viền rừng, chừa cổng vào ở đáy (x 28-29)
  c.trees(0, 0, ZONE_W - 1, 1);
  c.trees(0, ZONE_H - 2, ZONE_W - 1, ZONE_H - 1);
  c.trees(0, 0, 1, ZONE_H - 1);
  c.trees(ZONE_W - 2, 0, ZONE_W - 1, ZONE_H - 1);
  c.fill(28, ZONE_H - 2, 29, ZONE_H - 1, '=');

  // Tây bắc: Rừng Già (cỏ rậm giữa các khóm cây)
  c.fill(2, 2, 25, 19, 'G');
  for (const [x, y] of [[4, 4], [10, 2], [16, 6], [22, 2], [6, 10], [12, 12], [20, 14], [2, 16], [14, 18]]) c.trees(x, y, x + 1, y + 1);
  c.fill(18, 9, 25, 11, '.'); // khoảng trống trước lối vào khu
  c.fill(8, 7, 13, 8, '.');
  c.set(24, 12, 's');

  // Đông bắc: Đồi Đá (vách đá, cỏ cao)
  c.fill(34, 3, 43, 8, 'g');
  c.fill(46, 4, 53, 11, 'g');
  c.fill(34, 12, 41, 19, 'g');
  c.fill(45, 14, 52, 19, 'g');
  for (const [x, y] of [[44, 3], [45, 3], [36, 10], [40, 10], [41, 10], [48, 13], [49, 13], [43, 17], [53, 2], [32, 6]]) c.set(x, y, 'R');
  c.trees(38, 2, 39, 3);
  c.trees(50, 16, 51, 17);
  c.set(33, 12, 's');

  // Tây nam: Đồng Cỏ Lớn (bãi cỏ cao rộng)
  c.fill(3, 23, 12, 28, 'g');
  c.fill(15, 24, 24, 29, 'g');
  c.fill(3, 31, 11, 37, 'g');
  c.fill(14, 33, 23, 40, 'g');
  for (const [x, y] of [[12, 30], [20, 22], [6, 38]]) c.trees(x, y, x + 1, y + 1);
  c.set(24, 31, 's');

  // Đông nam: Hồ Ngọc (hồ lớn, bờ cỏ)
  c.fill(36, 24, 51, 35, 'w');
  c.fill(32, 24, 34, 33, 'g');
  c.fill(34, 37, 42, 40, 'g');
  c.fill(45, 37, 53, 40, 'g');
  c.trees(52, 22, 53, 23);
  c.set(33, 35, 's');

  // Dải cây ngang chia bắc / nam (chừa lối x 12-13 và x 42-43), hai dải cây dọc kẹp đường giữa (chừa lối sang 4 khu)
  c.trees(2, 20, 11, 21);
  c.trees(14, 20, 25, 21);
  c.trees(32, 20, 41, 21);
  c.trees(44, 20, 53, 21);
  for (const x of [26, 30]) {
    c.trees(x, 2, x + 1, 9);
    c.trees(x, 12, x + 1, 31);
    c.trees(x, 34, x + 1, 37);
  }
  // Đường giữa và sân cổng
  c.fill(28, 2, 29, ZONE_H - 3, '=');
  c.fill(26, 38, 31, 41, '.');
  c.fill(28, 38, 29, 41, '=');
  c.trees(24, 38, 25, 41);
  c.trees(32, 38, 33, 41);
  c.set(26, 39, 's');
  return c.rows();
}

// ---------- Khu Safari Effort: 40 x 30 ----------
// 3 khu dọc (tây / giữa / đông), mỗi khu 2 bãi cỏ (trên / dưới) và một hàng 4 cây quả (2 cây mỗi loại). Lối vào mỗi khu ở
// dải cây phía nam, sân chung dưới cùng có cổng ra và nhân viên
const EFFORT_W = 40;
const EFFORT_H = 30;
// Khu: x trái, x phải (trong khu), hai bảng (bãi trên / dưới), hai loại quả, lối vào (x chẵn của khe 2 ô)
export const EFFORT_ZONES = [
  { x1: 2, x2: 11, tables: ['effort-hp', 'effort-def'], berries: ['pomeg', 'qualot'], gap: 6 },
  { x1: 14, x2: 25, tables: ['effort-atk', 'effort-spatk'], berries: ['kelpsy', 'hondew'], gap: 18 },
  { x1: 28, x2: 37, tables: ['effort-spdef', 'effort-speed'], berries: ['grepa', 'tamato'], gap: 32 },
];
const PATCH_TOP = [3, 9]; // y1 bãi trên, y2 bãi trên
const PATCH_BOTTOM = [12, 18];
const BERRY_Y = 20;

function effortRows() {
  const c = canvas(EFFORT_W, EFFORT_H);
  c.trees(0, 0, EFFORT_W - 1, 1);
  c.trees(0, EFFORT_H - 2, EFFORT_W - 1, EFFORT_H - 1);
  c.trees(0, 0, 1, EFFORT_H - 1);
  c.trees(EFFORT_W - 2, 0, EFFORT_W - 1, EFFORT_H - 1);
  c.fill(20, EFFORT_H - 2, 21, EFFORT_H - 1, '=');
  // Dải cây ngăn giữa các khu, dải cây phía nam (chừa lối vào từng khu)
  c.trees(12, 2, 13, 23);
  c.trees(26, 2, 27, 23);
  c.trees(2, 22, 11, 23);
  c.trees(14, 22, 25, 23);
  c.trees(28, 22, 37, 23);
  for (const z of EFFORT_ZONES) {
    c.fill(z.x1 + 1, PATCH_TOP[0], z.x2 - 1, PATCH_TOP[1], 'g');
    c.fill(z.x1 + 1, PATCH_BOTTOM[0], z.x2 - 1, PATCH_BOTTOM[1], 'g');
    c.fill(z.gap, 22, z.gap + 1, 23, '.');
    c.set(z.x1, 10, 's'); // bảng tên hai bãi
  }
  // Sân chung, đường ra cổng
  c.fill(2, 25, EFFORT_W - 3, 25, '=');
  c.fill(20, 25, 21, EFFORT_H - 3, '=');
  return c.rows();
}

const ZONE_SIGN = {
  'effort-hp': 'Wigglytuff: +3 EV HP',
  'effort-def': 'Poliwrath: +3 EV Phòng thủ',
  'effort-atk': 'Victreebel: +3 EV Tấn công',
  'effort-spatk': 'Alakazam: +3 EV Tấn công đặc biệt',
  'effort-spdef': 'Blastoise: +3 EV Phòng thủ đặc biệt',
  'effort-speed': 'Pidgeot: +3 EV Tốc độ',
};

export const SAFARI_MAPS = {
  safariGate: roomy({
    name: 'Nhà Safari',
    indoor: true,
    theme: 'mart',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '##############',
      '###D######D###',
      'k............k',
      '..............',
      'ccc........ccc',
      '..............',
      'p............p',
      '..............',
      '......E.......',
    ],
    entry: { x: 6, y: 7 },
    rugs: [[2, 2, 4, 3, '#3a7a3a', '#e8d070'], [9, 2, 11, 3, '#8a5a2a', '#e8d070']],
    warps: [
      { x: 3, y: 1, to: 'safariZone', tx: 28, ty: ZONE_H - 2, facing: 'up' },
      { x: 10, y: 1, to: 'safariEffort', tx: 20, ty: EFFORT_H - 2, facing: 'up' },
    ],
    signs: {
      '0,2': ['BẢNG GIÁ KHU SAFARI', 'Vé Safari: ₽10.000 / 30 phút. Trong khu ném được mọi loại bóng bạn có.',
        'Vé Safari Effort (luyện EV): ₽10.000 / 20 phút. Pokémon ở khu này không bắt được.',
        'Vé còn hạn thì không mua thêm được. Thời gian tính cả khi bạn thoát game.'],
      '13,2': ['GÓI SAFARI 24 GIỜ: ₽55.000', 'Ra vào khu Safari tự do trong 24 giờ. Mỗi ngày chỉ mua được một lần.',
        'Vé Safari Effort chỉ còn ₽2.000 / 20 phút.'],
    },
  }, 'mart'),

  safariZone: {
    name: 'Khu Safari',
    place: 'town6',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    buildings: [],
    rows: safariZoneRows(),
    areas: [
      { name: 'Rừng Già', rect: [2, 2, 25, 19], table: 'safari-forest' },
      { name: 'Đồi Đá', rect: [32, 2, 53, 19], table: 'safari-hills' },
      { name: 'Đồng Cỏ Lớn', rect: [2, 22, 25, 41], table: 'safari-meadow' },
      { name: 'Bờ Hồ Ngọc', rect: [32, 22, 53, 41], table: 'safari-lake' },
    ],
    water: {
      name: 'Hồ Ngọc', surf: 'safari-lake-surf',
      oldRod: 'safari-lake-old', goodRod: 'safari-lake-good', superRod: 'safari-lake-super',
    },
    warps: [
      { x: 28, y: ZONE_H - 1, to: 'safariGate', tx: 3, ty: 2, facing: 'down' },
      { x: 29, y: ZONE_H - 1, to: 'safariGate', tx: 3, ty: 2, facing: 'down' },
    ],
    signs: {
      '24,12': ['RỪNG GIÀ', 'Cỏ rậm giữa rừng: Scyther, Pinsir... hiếm lắm mới gặp Bulbasaur, Vileplume, Victreebel.'],
      '33,12': ['ĐỒI ĐÁ', 'Rhyhorn, Cubone, Ponyta... nghe nói có cả Charmander, Arcanine và Ninetales.'],
      '24,31': ['ĐỒNG CỎ LỚN', 'Tauros, Kangaskhan chạy khắp đồng. Chansey và Eevee rất hiếm.'],
      '33,35': ['HỒ NGỌC', 'Lướt nước hoặc câu cá: có Dratini, Lapras, Starmie. Bờ cỏ có Squirtle.'],
      '26,39': ['KHU SAFARI', 'Gặp nhân viên ngay cổng để ra ngoài hoặc mua thêm bóng.'],
    },
  },

  safariEffort: {
    name: 'Khu Safari Effort',
    place: 'town6',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    buildings: [],
    rows: effortRows(),
    areas: EFFORT_ZONES.flatMap((z) => [
      { name: ZONE_SIGN[z.tables[0]], rect: [z.x1 + 1, PATCH_TOP[0], z.x2 - 1, PATCH_TOP[1]], table: z.tables[0] },
      { name: ZONE_SIGN[z.tables[1]], rect: [z.x1 + 1, PATCH_BOTTOM[0], z.x2 - 1, PATCH_BOTTOM[1]], table: z.tables[1] },
    ]),
    warps: [
      { x: 20, y: EFFORT_H - 1, to: 'safariGate', tx: 10, ty: 2, facing: 'down' },
      { x: 21, y: EFFORT_H - 1, to: 'safariGate', tx: 10, ty: 2, facing: 'down' },
    ],
    signs: Object.fromEntries(EFFORT_ZONES.map((z) => [`${z.x1},10`, [
      `Bãi trên: ${ZONE_SIGN[z.tables[0]]}.`, `Bãi dưới: ${ZONE_SIGN[z.tables[1]]}.`,
      'Pokémon ở đây không bắt được. Luống cây phía dưới có quả giảm EV đúng hai chỉ số này.',
    ]])),
    // Luống quả giảm EV: mỗi khu 2 luống (mỗi chỉ số một luống 2 cây) ở hàng dưới bãi cỏ, lối đi ở giữa
    objects: EFFORT_ZONES.flatMap((z) => [
      ...berryRow('se', z.x1 + 1, BERRY_Y, [z.berries[0], z.berries[0]]),
      ...berryRow('se', z.x2 - 2, BERRY_Y, [z.berries[1], z.berries[1]]),
    ]),
  },
};

// ---------- Bảng Pokémon hoang dã ----------
// Khu Safari: cấp 30-40, nhiều loài hiếm, có loài không gặp ở nơi nào khác ngoài tự nhiên: Bulbasaur, Charmander,
// Squirtle, Arcanine, Ninetales, Exeggutor, Vileplume, Victreebel, Starmie. Mỗi bảng tổng trọng số = 100 (trọng số là %):
// 1%: Bulbasaur, Charmander, Squirtle, Eevee • 5%: Kangaskhan, Scyther, Dratini, Lapras •
// 10%: Exeggutor, Arcanine, Ninetales, Vileplume, Victreebel, Starmie, Chansey. Khu Effort: mỗi bãi
// đúng một loài cho +3 EV một chỉ số, cấp thấp (10-12) để luyện nhanh
export const SAFARI_ENCOUNTERS = {
  'safari-forest': [
    { species: 'venonat', min: 30, max: 34, weight: 18 },
    { species: 'paras', min: 30, max: 34, weight: 15 },
    { species: 'oddish', min: 30, max: 34, weight: 14 },
    { species: 'bellsprout', min: 30, max: 34, weight: 12 },
    { species: 'tangela', min: 32, max: 36, weight: 8 },
    { species: 'pinsir', min: 33, max: 37, weight: 7 },
    { species: 'scyther', min: 33, max: 37, weight: 5 },
    { species: 'vileplume', min: 38, max: 40, weight: 10 },
    { species: 'victreebel', min: 38, max: 40, weight: 10 },
    { species: 'bulbasaur', min: 30, max: 32, weight: 1 },
  ],
  'safari-hills': [
    { species: 'rhyhorn', min: 31, max: 35, weight: 18 },
    { species: 'cubone', min: 30, max: 34, weight: 16 },
    { species: 'ponyta', min: 30, max: 34, weight: 15 },
    { species: 'growlithe', min: 30, max: 34, weight: 13 },
    { species: 'onix', min: 32, max: 36, weight: 10 },
    { species: 'magmar', min: 34, max: 38, weight: 4 },
    { species: 'electabuzz', min: 34, max: 38, weight: 3 },
    { species: 'arcanine', min: 38, max: 40, weight: 10 },
    { species: 'ninetales', min: 38, max: 40, weight: 10 },
    { species: 'charmander', min: 30, max: 32, weight: 1 },
  ],
  'safari-meadow': [
    { species: 'nidoran-f', min: 30, max: 34, weight: 16 },
    { species: 'nidoran-m', min: 30, max: 34, weight: 16 },
    { species: 'doduo', min: 30, max: 34, weight: 15 },
    { species: 'exeggcute', min: 30, max: 34, weight: 14 },
    { species: 'tauros', min: 33, max: 37, weight: 13 },
    { species: 'kangaskhan', min: 33, max: 37, weight: 5 },
    { species: 'exeggutor', min: 38, max: 40, weight: 10 },
    { species: 'chansey', min: 32, max: 36, weight: 10 },
    { species: 'eevee', min: 30, max: 32, weight: 1 },
  ],
  'safari-lake': [
    { species: 'psyduck', min: 30, max: 34, weight: 24 },
    { species: 'slowpoke', min: 30, max: 34, weight: 24 },
    { species: 'krabby', min: 30, max: 34, weight: 20 },
    { species: 'seel', min: 31, max: 35, weight: 16 },
    { species: 'lickitung', min: 33, max: 37, weight: 9 },
    { species: 'mr-mime', min: 33, max: 37, weight: 6 },
    { species: 'squirtle', min: 30, max: 32, weight: 1 },
  ],
  'safari-lake-surf': [
    { species: 'seel', min: 32, max: 36, weight: 32 },
    { species: 'horsea', min: 30, max: 34, weight: 28 },
    { species: 'staryu', min: 30, max: 34, weight: 15 },
    { species: 'dragonair', min: 36, max: 40, weight: 5 },
    { species: 'dratini', min: 30, max: 34, weight: 5 },
    { species: 'lapras', min: 35, max: 40, weight: 5 },
    { species: 'starmie', min: 36, max: 40, weight: 10 },
  ],
  'safari-lake-old': [
    { species: 'magikarp', min: 20, max: 25, weight: 70 },
    { species: 'goldeen', min: 20, max: 25, weight: 30 },
  ],
  'safari-lake-good': [
    { species: 'goldeen', min: 28, max: 32, weight: 55 },
    { species: 'horsea', min: 28, max: 32, weight: 40 },
    { species: 'dratini', min: 28, max: 32, weight: 5 },
  ],
  'safari-lake-super': [
    { species: 'seaking', min: 34, max: 38, weight: 55 },
    { species: 'dragonair', min: 36, max: 40, weight: 25 },
    { species: 'gyarados', min: 38, max: 40, weight: 15 },
    { species: 'dratini', min: 32, max: 36, weight: 5 },
  ],
  'effort-hp': [{ species: 'wigglytuff', min: 10, max: 12, weight: 100 }],
  'effort-def': [{ species: 'poliwrath', min: 10, max: 12, weight: 100 }],
  'effort-atk': [{ species: 'victreebel', min: 10, max: 12, weight: 100 }],
  'effort-spatk': [{ species: 'alakazam', min: 10, max: 12, weight: 100 }],
  'effort-spdef': [{ species: 'blastoise', min: 10, max: 12, weight: 100 }],
  'effort-speed': [{ species: 'pidgeot', min: 10, max: 12, weight: 100 }],
};
