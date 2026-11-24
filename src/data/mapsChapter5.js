import { CAVE_TILES, INDOOR_TILES, OUTDOOR_TILES } from './tiles.js';
import { widen } from './widen.js';

// Liên minh vùng Sơn Thủy: Sương Mù -> Đường Chiến Thắng (lính gác kiểm tra đủ 8 huy hiệu) -> Hang Vân Sơn
// -> Cao nguyên Liên Minh -> sảnh Liên minh -> 4 phòng Tứ Thiên Vương -> phòng Nhà vô địch.
// Ký tự ô: xem data/tiles.js (D: cửa lớn giữa các phòng). oneWay: cửa một chiều, đã vào là không quay lại.
// resetLeague: bước vào phòng đầu tiên thì Tứ Thiên Vương bắt đầu lại từ đầu (xem story/league.js)

// Phòng đấu: lối vào phía dưới, Thiên Vương đứng giữa phía trên, cửa lớn sau lưng
const hall = (name, theme) => ({
  name,
  place: 'league',
  indoor: true,
  theme,
  tiles: INDOOR_TILES,
  fallback: '#',
  entry: { x: 6, y: 10 },
});

// Phòng 13 x 12 ô ở giữa, lúc nạp nới thêm LEAGUE_DX ô mỗi bên và 3 hàng phía dưới thành đại sảnh 35 x 15 kín màn hình
// (data/widen.js): hai cánh sảnh có hàng cột đá thẳng hàng với cột trong phòng, chậu cây sát tường sau. Thiên Vương / Nhà
// vô địch (story/league.js) khai báo toạ độ theo phòng 13 ô rồi cộng LEAGUE_DX
export const LEAGUE_DX = 11;
const hallWing = (x, y, edge) => {
  const d = edge === 'left' ? LEAGUE_DX - 1 - x : x; // 0: sát phòng
  if (y === 2) return d % 4 === 2 ? 'p' : '.';
  return y % 2 === 1 && d % 4 === 3 ? 'o' : '.';
};
const hallBottom = (y, width) => [...Array(width)].map((_, x) => (y === 13 && (x % 4 === 1) ? 'o' : '.')).join('');
// Hai cánh sảnh Liên minh (hàng 2-8, cánh phải là ảnh gương cánh trái) và 6 hàng phía dưới
const LOBBY_WING = [
  'kk.kk.kk...',
  '...........',
  '.bb.....bb.',
  '...........',
  '.p..ttt..p.',
  '...........',
  '...........',
];
const lobbyWing = (x, y, edge) => {
  const row = LOBBY_WING[y - 2];
  return edge === 'left' ? row[x] : row[row.length - 1 - x];
};
const LOBBY_BOTTOM = [
  '...................................',
  '....o......bb.........bb......o....',
  '...................................',
  '....o......bb.........bb......o....',
  '...................................',
  'p.................................p',
];
const bigHall = (def) => widen(def, { left: LEAGUE_DX, bottom: 3, side: hallWing, bottomRow: hallBottom });

const ROOM = [
      '#############',
      '######D######',
      '.............',
      'o...........o',
      '.............',
      'o...........o',
      '.............',
      'o...........o',
      '.............',
      'o...........o',
      '.............',
      '.............',
];

export const CHAPTER5_MAPS = {
  // Đường Chiến Thắng: đèo núi phía đông Sương Mù, con đường thử thách cuối cùng trước Liên minh.
  // Lối vào phía tây có lính gác kiểm tra 8 huy hiệu. Sau cổng là bãi trống dưới chân cao nguyên, hẻm cỏ đi xuống thung lũng
  // phía nam (sau ngách cỏ rậm phía tây có Rare Candy). Thung lũng dẫn sang đông tới chân sườn núi 3 bậc: mỗi bậc viền gờ đất,
  // lối lên đổi bên so le nên phải đi hết chiều ngang từng bậc (bậc 2 có mỏm đá hình móng ngựa, bậc 3 phải lội cỏ rậm).
  // Lên tới cao nguyên thì cửa Hang Vân Sơn nằm trong vách đá phía đông; góc tây cao nguyên là ngách cụt có Leftovers,
  // từ đó nhảy gờ xuống là về thẳng bãi trống sau cổng (đường tắt một chiều). Mỗi chặng có một tinh anh chặn đường.
  route11: {
    name: 'Đường Chiến Thắng',
    place: 'route11',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTRRRRRRRRRRRRRRRRRRRRRRRRRRRRTT',
      'TTTTTTRRRRRRRRRRRRRRRRRRRRRRRRCRRRTT',
      'TTTTTT..............h.f.......=..hTT',
      'TTTTTT..GGGGG.k...............=...TT',
      'TTTTTT..GGGGG...===============...TT',
      'TTTTTT..................h.........TT',
      'TTTTTTvvvvvvvvRR..vvvvvvvvvvvvvvvvTT',
      'TTTTTT........RR....GGGGGGGG......TT',
      '==========....RR....GGGGGGGG..R...TT',
      '.........=s...RR....GGGGGGGG......TT',
      'TTTTTT...=....RR....GGGGGGGG......TT',
      'TTTTTT...=....RRvvvvvvRRRRRRvvvv..TT',
      'TTTTTT...=....RR......RR..RR......TT',
      'TTTTTT...=....RR..h...RR..RR....R.TT',
      'TTTTTTTT.=..TTRR......RR..RR......TT',
      'TTTTTTTT.=..TTRR..............h...TT',
      'TTTTTTTT.=ggTTRR..................TT',
      'TTTTTTTT.=ggTTRR..vvvvvvvvvvvvvvvvTT',
      'TTTTTTTT.=ggTTRR..................TT',
      'TTTTTTTT.=ggTTRR.h.............h..TT',
      'TTTTTTTT.=ggTTRR...gggggggggg.....TT',
      'TTTTTTTT.=ggTTRR...gggggggggg.XX..TT',
      'TTTTTTTT.=..TTRR...gggggggggg.....TT',
      'TTTTTTTT.=..TTRRvvvvvvvvvvvvvvvv..TT',
      'TTTTTTTT..........................TT',
      'TTTTTTTT.=========================TT',
      'TTTTTTGG......f...................TT',
      'TTTTTTGG....gggggggggggggggg....f.TT',
      'TTTTTTGG....gggggggggggggggg..f...TT',
      'TTTTTT......gggggggggggggggg.f....TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Cỏ rậm cao nguyên', rect: [8, 5, 12, 6], table: 'route11-deep' },
      { name: 'Cỏ rậm sườn núi', rect: [20, 9, 27, 12], table: 'route11-deep' },
      { name: 'Ngách cỏ rậm thung lũng', rect: [6, 28, 7, 30], table: 'route11-deep' },
      { name: 'Bụi cỏ trong hẻm', rect: [10, 18, 11, 23], table: 'route11-grass' },
      { name: 'Bụi cỏ sườn núi', rect: [19, 22, 28, 24], table: 'route11-grass' },
      { name: 'Bụi cỏ thung lũng', rect: [12, 29, 27, 31], table: 'route11-grass' },
    ],
    // Lính gác chỉ cho người có đủ 8 huy hiệu đi qua (cổng chặn kín lối vào phía tây)
    gates: [{ rect: [4, 10, 5, 11], badges: 8 }],
    warps: [
      { x: 0, y: 10, to: 'town9', tx: 30, ty: 10, facing: 'left' },
      { x: 0, y: 11, to: 'town9', tx: 30, ty: 11, facing: 'left' },
      { x: 30, y: 3, to: 'cave3', tx: 6, ty: 28, facing: 'up', cave: true },
    ],
    signs: {
      '10,11': ['ĐƯỜNG CHIẾN THẮNG', 'Chỉ nhà huấn luyện có đủ 8 huy hiệu mới được đi tiếp.', '↓ Thung lũng  →  Sườn núi  ↑ Hang Vân Sơn'],
    },
    objects: [
      { x: 6, y: 31, kind: 'item', id: 'r11-rare-candy', item: 'rareCandy', qty: 1, respawnDays: 3 }, // sau ngách cỏ rậm thung lũng
      { x: 33, y: 30, kind: 'item', id: 'r11-full-heal', item: 'fullHeal', qty: 2 },
      { x: 24, y: 14, kind: 'item', id: 'r11-revive', item: 'revive', qty: 2 }, // trong mỏm đá móng ngựa bậc 2
      { x: 6, y: 4, kind: 'item', id: 'r11-leftovers', item: 'leftovers', qty: 1 }, // ngách tây cao nguyên
    ],
  },

  // Hang Vân Sơn (hang băng) 3 tầng. Tầng 1 bị vách băng chia đôi: nửa nam có cửa vào từ Đường Chiến Thắng, nửa bắc có
  // cửa ra Cao nguyên Liên Minh. Từ nửa nam đi qua hành lang (Tinh anh Thạch đứng trong hốc tường) sang phòng đông,
  // xuống thang (L) xuống tầng hầm, băng qua tầng hầm rồi leo thang phía tây bắc (U) lên nửa bắc. Nửa bắc: hành lang dưới
  // dẫn sang phòng đông bắc, Tinh anh Tuệ canh ngay trước cửa ra. Ngách cụt có vật phẩm ở cả hai nửa
  cave3: {
    name: 'Hang Vân Sơn',
    caveTheme: 'ice', // hang băng trên đèo tuyết
    place: 'cave3',
    cave: true,
    tiles: CAVE_TILES,
    fallback: '#',
    rows: [
      '###############################C####',
      '##############################...###',
      '##.................##########.....##',
      '##..L.........o....###............##',
      '##......o..###########............##',
      '##.........###########...o........##',
      '##.........###########............##',
      '##.o.......###########..........o.##',
      '##.........###########.....o......##',
      '####..################............##',
      '####..#################..###########',
      '####...............o.....###########',
      '####.....o...............###########',
      '####################################',
      '####################################',
      '####################################',
      '####################################',
      '#######################...........##',
      '##............####.####...........##',
      '##........o...............oo......##',
      '##...o............................##',
      '##.o..........#########.......o...##',
      '##.........o..#########..........o##',
      '##............#########...........##',
      '##............#########..o........##',
      '##..#...###############......o....##',
      '##..#...#######....o...........L..##',
      '##..#...#######...................##',
      '#####...############################',
      '######C#############################',
    ],
    areas: [{ name: 'Hang Vân Sơn', rect: [0, 0, 35, 29], table: 'cave3' }],
    warps: [
      { x: 6, y: 29, to: 'route11', tx: 30, ty: 4, facing: 'down', cave: true },
      { x: 31, y: 0, to: 'league', tx: 14, ty: 14, facing: 'up', cave: true },
      { x: 31, y: 26, to: 'cave3b', tx: 33, ty: 23, facing: 'up', cave: true },
      { x: 4, y: 3, to: 'cave3b', tx: 3, ty: 4, facing: 'down', cave: true },
    ],
    objects: [
      { x: 2, y: 27, kind: 'item', id: 'c3-ultra-ball', item: 'ultraBall', qty: 3 }, // ngách tây nam
      { x: 15, y: 26, kind: 'item', id: 'c3-max-repel', item: 'maxRepel', qty: 1 }, // ngách cụt phía nam
      { x: 33, y: 17, kind: 'item', id: 'c3-hyper-potion', item: 'hyperPotion', qty: 2 },
      { x: 18, y: 2, kind: 'item', id: 'c3-max-revive', item: 'maxRevive', qty: 1 }, // ngách cụt phía bắc
    ],
  },

  // Tầng hầm Hang Vân Sơn: lạnh hơn, Pokémon mạnh hơn. Thang lên nửa nam tầng 1 ở phòng đông nam, hành lang phía tây
  // (Tinh anh Tuyết đứng trong hốc tường) sang phòng tây nam, rồi lên phòng tây bắc có thang lên nửa bắc tầng 1.
  // Phòng giữa là ngách cụt có Max Revive; nhánh bắc phòng đông nam (Tinh anh Vân chặn) dẫn tới thang xuống hầm băng sâu.
  // Hồ băng ngầm (w) dưới phòng giữa: bờ phía nam (cạnh hốc Tinh anh Tuyết) và mép phòng giữa ra được mặt hồ; cồn băng
  // giữa hồ và hốc đá góc đông bắc hồ chỉ lướt nước mới tới
  cave3b: {
    name: 'Hang Vân Sơn – Tầng hầm',
    caveTheme: 'ice',
    place: 'cave3',
    cave: true,
    tiles: CAVE_TILES,
    fallback: '#',
    rows: [
      '######################################',
      '######################################',
      '##...........###########............##',
      '##.U.........###########..........L.##',
      '##.....o.....###########...o........##',
      '##...........###########............##',
      '##........o..#.........#......o..o..##',
      '##...........#.o.......#............##',
      '###..#########.........#............##',
      '###..#########...oo....#######..######',
      '###..#########.........#######..######',
      '###..#########.........#######..######',
      '###.................o..#######..######',
      '###....................#######..######',
      '###..#########.........#######..######',
      '##..........##wwwwwwwwww..####..######',
      '##..........##wwwwww..ww##..........##',
      '##..........##wwwwwwo.ww##..........##',
      '##...o......##wwwwwwwwww##..oo......##',
      '##..........###wwwwwwwww##..........##',
      '##..........#.....#.######......o...##',
      '##.............o....................##',
      '##......o.............o.............##',
      '##..o.......##############.o........##',
      '##..........##############.......U..##',
      '##..........##############..........##',
      '######################################',
      '######################################',
    ],
    areas: [{ name: 'Tầng hầm', rect: [0, 0, 37, 27], table: 'cave3-deep' }],
    water: { name: 'Hồ băng ngầm', surf: 'cave3-surf', oldRod: 'cave3-old', goodRod: 'cave3-good', superRod: 'cave3-super' },
    warps: [
      { x: 33, y: 24, to: 'cave3', tx: 31, ty: 25, facing: 'down', cave: true },
      { x: 3, y: 3, to: 'cave3', tx: 4, ty: 4, facing: 'down', cave: true },
      { x: 34, y: 3, to: 'cave3c', tx: 11, ty: 3, facing: 'down', cave: true },
    ],
    objects: [
      { x: 22, y: 6, kind: 'item', id: 'c3b-max-revive', item: 'maxRevive', qty: 1 }, // phòng giữa (ngách cụt)
      { x: 35, y: 8, kind: 'item', id: 'c3b-full-heal', item: 'fullHeal', qty: 2 },
      { x: 2, y: 25, kind: 'item', id: 'c3b-ice-heal', item: 'iceHeal', qty: 3 },
      // Hồ băng ngầm: cồn băng giữa hồ và hốc đá góc đông bắc, chỉ lướt nước mới tới
      { x: 21, y: 16, kind: 'item', id: 'c3b-lake-max-revive', item: 'maxRevive', qty: 2, surf: true },
      { x: 25, y: 15, kind: 'item', id: 'c3b-lake-ultra-ball', item: 'ultraBall', qty: 5, surf: true },
    ],
  },

  // Hầm băng sâu: hang cụt dưới cùng, Pokémon mạnh nhất vùng (Lapras, Dragonair). Hai hốc băng hai bên có báu vật.
  // Góc đông nam là vũng nước băng (w): lướt nước / câu cá (Seel, Dewgong, Cloyster). Chỗ Mewtwo (sau khi xong
  // Liên minh) vẫn đi bộ tới được
  cave3c: {
    name: 'Hang Vân Sơn – Hầm băng',
    caveTheme: 'ice',
    place: 'cave3',
    cave: true,
    tiles: CAVE_TILES,
    fallback: '#',
    rows: [
      '########################',
      '########################',
      '##...####..U...####...##',
      '##...####......####...##',
      '##...####......####...##',
      '##...####......####...##',
      '##....................##',
      '##........oooo...o....##',
      '##....oo..............##',
      '##..........o.........##',
      '##..............wwwww.##',
      '##..o..........wwwwwww##',
      '##.......o....wwwwwwww##',
      '##............wwwwwwww##',
      '########################',
      '########################',
    ],
    areas: [{ name: 'Hầm băng', rect: [0, 0, 23, 15], table: 'cave3-depths' }],
    water: { name: 'Vũng nước băng', surf: 'cave3c-surf', oldRod: 'cave3c-old', goodRod: 'cave3c-good', superRod: 'cave3c-super' },
    warps: [{ x: 11, y: 2, to: 'cave3b', tx: 34, ty: 4, facing: 'down', cave: true }],
    objects: [
      { x: 2, y: 2, kind: 'item', id: 'c3c-never-melt-ice', item: 'neverMeltIce', qty: 1 },
      { x: 21, y: 2, kind: 'item', id: 'c3c-lucky-egg', item: 'luckyEgg', qty: 1 },
    ],
  },

  // Cao nguyên Liên Minh: toà nhà Liên minh trên đỉnh núi
  league: {
    name: 'Cao nguyên Liên Minh',
    place: 'league',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    martTier: 3,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTOO..................OOTTTT',
      'TTTTOO..................OOTTTT',
      'TT..f...................f...TT',
      'TT..........................TT',
      'TT..........................TT',
      'TT.....Y.............Y......TT',
      'TT.........PP.=.PP..........TT',
      'TT....f.....l.=.l.....f.....TT',
      'TT..EEu.......=.......uEE...TT',
      'TT......=============.......TT',
      'TT..f.........=..s.......f..TT',
      'TT.eee......l.=.l......eee..TT',
      'TTRRRRRRRRRRRR=RRRRRRRRRRRRRTT',
      'TTRRRRRRRRRRRRCRRRRRRRRRRRRRTT',
      'TTTTTTTTTTTTTTRRTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTRRTTTTTTTTTTTTTT',
    ],
    warps: [{ x: 14, y: 15, to: 'cave3', tx: 31, ty: 1, facing: 'down', cave: true }],
    buildings: [{ type: 'league', x: 11, y: 4, w: 7, h: 4, door: { x: 14, y: 7 }, to: 'leagueLobby' }],
    signs: {
      '17,12': ['CAO NGUYÊN LIÊN MINH', 'Nơi Tứ Thiên Vương và Nhà vô địch vùng Sơn Thủy chờ đợi.'],
    },
  },

  // Sảnh Liên minh: hồi phục, mua đồ, cửa lớn phía sau dẫn vào phòng Tứ Thiên Vương. Quầy 13 ô ở giữa, lúc nạp nới
  // thành sảnh 35 x 15 (lobbyWing / LOBBY_BOTTOM): tủ cúp sát tường, ghế chờ, bàn nước hai bên, hàng cột và chậu cây ở
  // nửa dưới, cửa ra ở tường dưới
  leagueLobby: widen({
    name: 'Sảnh Liên minh',
    indoor: true,
    theme: 'league',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '#############',
      '######D######',
      '.............',
      'pccc.....cccp',
      '.............',
      '.b.........b.',
      '.............',
      '.............',
      '......E......',
    ],
    entry: { x: 6, y: 7 },
    rugs: [[5, 4, 7, 13, '#5a3a88', '#e8c050']], // thảm tím viền vàng từ cửa ra dẫn tới cửa lớn
    heal: { x: 2, y: 4, facing: 'up' },
    warps: [{ x: 6, y: 1, to: 'elite1', tx: 6, ty: 10, facing: 'up', oneWay: true, resetLeague: true }],
  }, { left: LEAGUE_DX, bottom: 6, side: lobbyWing, bottomRow: (y) => LOBBY_BOTTOM[y - 9], exitDown: true }),

  elite1: bigHall({
    ...hall('Phòng Thiên Vương Lan', 'elitePoison'),
    rows: ROOM,
    rugs: [[5, 3, 7, 11, '#5a2e78', '#7ad060']], // thảm dẫn từ cửa vào tới chỗ Thiên Vương
    // Thắng Thiên Vương thì cửa phong ấn mở, đi qua cửa lớn sang phòng kế tiếp (không quay lại được)
    objects: [{ x: 6, y: 2, kind: 'gate', look: 'seal', id: 'elite1-seal', flag: 'league:e1' }],
    warps: [{ x: 6, y: 1, to: 'elite2', tx: 6, ty: 10, facing: 'up', oneWay: true }],
  }),
  elite2: bigHall({
    ...hall('Phòng Thiên Vương Võ', 'eliteFighting'),
    rows: ROOM,
    rugs: [[5, 3, 7, 11, '#8a2a20', '#f0c860']], // thảm dẫn từ cửa vào tới chỗ Thiên Vương
    // Thắng Thiên Vương thì cửa phong ấn mở, đi qua cửa lớn sang phòng kế tiếp (không quay lại được)
    objects: [{ x: 6, y: 2, kind: 'gate', look: 'seal', id: 'elite2-seal', flag: 'league:e2' }],
    warps: [{ x: 6, y: 1, to: 'elite3', tx: 6, ty: 10, facing: 'up', oneWay: true }],
  }),
  elite3: bigHall({
    ...hall('Phòng Thiên Vương Huyền', 'eliteGhost'),
    dark: true,
    rows: ROOM,
    rugs: [[5, 3, 7, 11, '#2c2240', '#9a78d8']], // thảm dẫn từ cửa vào tới chỗ Thiên Vương
    // Thắng Thiên Vương thì cửa phong ấn mở, đi qua cửa lớn sang phòng kế tiếp (không quay lại được)
    objects: [{ x: 6, y: 2, kind: 'gate', look: 'seal', id: 'elite3-seal', flag: 'league:e3' }],
    warps: [{ x: 6, y: 1, to: 'elite4', tx: 6, ty: 10, facing: 'up', oneWay: true }],
  }),
  elite4: bigHall({
    ...hall('Phòng Thiên Vương Long', 'eliteDragon'),
    rows: ROOM,
    rugs: [[5, 3, 7, 11, '#22408a', '#e8c060']], // thảm dẫn từ cửa vào tới chỗ Thiên Vương
    // Thắng Thiên Vương thì cửa phong ấn mở, đi qua cửa lớn sang phòng kế tiếp (không quay lại được)
    objects: [{ x: 6, y: 2, kind: 'gate', look: 'seal', id: 'elite4-seal', flag: 'league:e4' }],
    warps: [{ x: 6, y: 1, to: 'champion', tx: 6, ty: 10, facing: 'up', oneWay: true }],
  }),

  champion: bigHall({
    ...hall('Phòng Nhà vô địch', 'champion'),
    rugs: [[5, 3, 7, 11, '#b02828', '#f0c838']], // thảm đỏ viền vàng tới chỗ Nhà vô địch
    rows: [
      '#############',
      '#############',
      '.............',
      'o...........o',
      '.............',
      'o...........o',
      '.............',
      'o...........o',
      '.............',
      'o...........o',
      '.............',
      '.............',
    ],
  }),
};
