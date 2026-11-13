import { berryRow } from './berryRows.js';
import { CAVE_TILES, OUTDOOR_TILES } from './tiles.js';

// Chương 1-2: Pallet -> Tuyến đường 2 -> Thị trấn Lục Bình -> Hang Thạch Nhũ -> Tuyến đường 3 -> Làng Chân Đồi
// -> Thành phố Đồi Gió (Gym hệ Bay). Sông Lục Bình nối hồ Pallet với ao Lục Bình (lướt nước).
// Ký tự ô: xem data/tiles.js. warps / areas / water: xem data/map.js

export const CHAPTER2_MAPS = {
  // Tuyến đường đầu tiên (40x32): vào từ lối phía bắc Pallet ở mép nam (góc tây nam), đường chính vòng qua bụi cỏ phía nam,
  // men bờ tây ao nhỏ lên hành lang giữa (Bé Mai chặn), rẽ tây tới ngã ba có ông lão chỉ đường, leo dốc phía tây lên hành
  // lang phía bắc (băng bụi cỏ, Nhóc Tùng chặn) rồi sang đông ra Thị trấn Lục Bình. Nhánh cụt: ngách phía tây bãi đầu tuyến,
  // lùm cỏ phía nam hành lang giữa, bãi trống có cây quả mọng (lối rẽ từ hành lang bắc). Ao nhỏ có cồn cát (phải lướt nước).
  // Ngay trước lối ra có gờ đất v: nhảy xuống dải cỏ rậm phía đông là đường tắt một chiều về bờ ao, không leo ngược lên được.
  route2: {
    name: 'Tuyến đường 2',
    place: 'route2',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT..........gggggggg............TTTTTTTT',
      'TT.k....OO..gggggggg............TTTTTTTT',
      'TT......OO..gggggggg......XX....TTTTTTTT',
      'TT..........gggggggg............TTTTTTTT',
      'TTTT..TTTTTTTTTT..TTTTTTTTTTTT..========',
      'TTTT..TTTTTTTTTT..TTTTTTTTTTTT..========',
      'TTTT..TTTT..................TTTTTTvvvvTT',
      'TTTT..TTTT..................TTTTTT....TT',
      'TTTT..TTTTk.......ggggggTTTTTTTTTT....TT',
      'TTTT..TTTT........ggggggTTTTTTTTTT....TT',
      'TTTT..TTTTTTTTTTTTTTTTTTTTTTTTTTTTGGGGTT',
      'TTTT..TTTTTTTTTTTTTTTTTTTTTTTTTTTTGGGGTT',
      'TT......................TTTTTTTTTTGGGGTT',
      'TT......................TTTTTTTTTTGGGGTT',
      'TTTTTTTTTT..TTTTTTTTTT....wwwwww..GGGGTT',
      'TTTTTTTTTT..TTTTTTTTTT...wwwwwwww.GGGGTT',
      'TT....TTggggggggTTTTTT..wwwwwwwwwwGGGGTT',
      'TT....TTggggggggTTTTTT..wwwwwwwwwwGGGGTT',
      'TT....TTggggggggTTTTTT..wwwwddwwww....TT',
      'TT....TTggggggggTTTTTT..wwwwddwwww....TT',
      'TT....TTTTTTTTTTTTTTTT..wwwwwwwwww....TT',
      'TT....TTTTTTTTTTTTTTTT..wwwwwwwwww....TT',
      'TT............gggggggg...wwwwwwww.....TT',
      'TT.Y..........gggggggg..............k.TT',
      'TT....========gggggggg................TT',
      'TT....========gggggggg..OO............TT',
      'TT....==s.....gggggggg..OO..XX........TT',
      'TT....==......gggggggg................TT',
      'TTTTTT==TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTT==TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Bụi cỏ rậm phía đông', rect: [34, 12, 37, 19], table: 'route2-deep' },
      { name: 'Bụi cỏ phía bắc', rect: [12, 2, 19, 5], table: 'route2-grass' },
      { name: 'Bụi cỏ bãi trống', rect: [18, 10, 23, 11], table: 'route2-grass' },
      { name: 'Lùm cỏ', rect: [8, 18, 15, 21], table: 'route2-grass' },
      { name: 'Bụi cỏ phía nam', rect: [14, 24, 21, 29], table: 'route2-grass' },
    ],
    // Ao nhỏ thông mạch nước với hồ Pallet: cùng bảng Pokémon khi lướt nước / câu cá
    water: { name: 'Ao nhỏ', surf: 'pallet-lake-surf', oldRod: 'pallet-lake-old', goodRod: 'pallet-lake-good', superRod: 'pallet-lake-super' },
    warps: [
      { x: 6, y: 31, to: 'route1', tx: 12, ty: 1, facing: 'down' },
      { x: 7, y: 31, to: 'route1', tx: 13, ty: 1, facing: 'down' },
      { x: 39, y: 6, to: 'town1', tx: 1, ty: 8, facing: 'right' },
      { x: 39, y: 7, to: 'town1', tx: 1, ty: 9, facing: 'right' },
    ],
    signs: {
      '8,28': ['TUYẾN ĐƯỜNG 2', '↓ Thị trấn Pallet', '→ Thị trấn Lục Bình: vòng qua bờ ao, lên dốc phía tây rồi theo lối phía bắc sang đông.'],
    },
    objects: [
      { x: 27, y: 8, kind: 'item', id: 'r2-great-ball', item: 'greatBall', qty: 2 }, // ngách cuối bãi trống
      { x: 2, y: 18, kind: 'item', id: 'r2-super-potion', item: 'superPotion', qty: 1 }, // ngách phía tây bãi đầu tuyến
      { x: 15, y: 20, kind: 'item', id: 'r2-antidote', item: 'antidote', qty: 2 }, // góc lùm cỏ
      { x: 37, y: 12, kind: 'item', id: 'r2-paralyze-heal', item: 'paralyzeHeal', qty: 2 }, // giữa cỏ rậm (Pikachu)
      { x: 28, y: 20, kind: 'item', id: 'r2-hyper-potion', item: 'hyperPotion', qty: 1 }, // cồn cát giữa ao, phải lướt nước
      // Cây quả mọng: hái được 1-3 quả, 2-3 ngày sau ra quả lại (xem game/berries.js)
      ...berryRow('r2', 12, 9, ['chesto', 'oran']),
    ],
  },

  // Thị trấn đầu tiên trên hành trình: hai nhà dân góc tây bắc ngay lối vào; Pokémon Center và Poké Mart phía nam đường
  // chính, cạnh ao (Team Rocket chặn cửa Poké Mart cướp gói hàng, xem story/rocket.js),
  // cửa Hang Thạch Nhũ dưới vách đá phía đông bắc (Gary đợi đấu lại trước khi lên đường, mở khi xong chương 1).
  // Trước cửa hang là gò đất 2 tầng viền gờ đá (J góc, < > cạnh tây / đông, v cạnh nam): tầng dưới viền gờ chữ L,
  // tầng trên viền gờ chữ L ngược (lên qua khe phía tây). Nhảy gờ xuống là về nhanh Pokémon Center, không leo ngược lên được.
  // Ao phía tây nam nối với Sông Lục Bình.
  town1: {
    name: 'Thị trấn Lục Bình',
    place: 'town1',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTRRRRRRRR',
      'TTTTTTTTTTTTTTTTTTTTTTTTRRRRRRRR',
      'TT..............<.....>.RRRRRRRR',
      'TT..............<.....>.RRRRRRRR',
      'TT..............<.....>.RRRRRRRR',
      'TT..............<..vvvJ.RRRCRRRR',
      'TT..............<..........=..TT',
      'TTaaa...aaa..Q..JvvvvvvvOO.=..TT',
      '..aaas..aaa.............OO.=..TT',
      '==============================TT',
      'TT.PPP...............QEE......TT',
      'TT............................TT',
      'wwwwwwwwww..............TTTT..TT',
      'wwwwwwwwww..............TTTT..TT',
      'wwwwwwwwww..............TTTT..TT',
      'wwwwwwwwww......s.....s.TTTT..TT',
      'TTwwwwwwww.aaaaaaQaaaa.XX.k...TT',
      'TTwwwwwwww.aaaaaa.aaaa........TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    hyacinth: 0.4, // ao đầy lục bình tím (tên thị trấn)
    water: { name: 'Ao Lục Bình', surf: 'river1-surf', oldRod: 'river1-old', goodRod: 'river1-good', superRod: 'river1-super' },
    warps: [
      { x: 0, y: 8, to: 'route2', tx: 38, ty: 6, facing: 'left' },
      { x: 0, y: 9, to: 'route2', tx: 38, ty: 7, facing: 'left' },
      { x: 27, y: 5, to: 'cave1', tx: 4, ty: 28, facing: 'up', cave: true },
      ...[12, 13, 14, 15].map((y) => ({ x: 0, y, to: 'river1', tx: 32, ty: y - 4, facing: 'left' })),
    ],
    buildings: [
      { type: 'house', x: 2, y: 3, w: 4, h: 4, door: { x: 3, y: 6 }, to: null },
      { type: 'house', x: 8, y: 3, w: 4, h: 4, door: { x: 9, y: 6 }, to: null, roof: 'houseYellow' },
      { type: 'center', x: 11, y: 12, w: 5, h: 4, door: { x: 13, y: 15 }, to: 'center' },
      { type: 'mart', x: 18, y: 12, w: 4, h: 4, door: { x: 19, y: 15 }, to: 'mart' },
    ],
    signs: {
      '16,15': ['POKéMON CENTER', 'Hồi phục Pokémon của bạn miễn phí!'],
      '22,15': ['POKé MART', 'Bán Poké Ball, thuốc hồi phục và nhiều thứ khác!'],
      '5,8': ['THỊ TRẤN LỤC BÌNH', 'Thị trấn bên ao lục bình tím.', '↗ Hang Thạch Nhũ   ← Tuyến đường 2'],
    },
    objects: [
      { x: 29, y: 16, kind: 'item', id: 't1-super-potion', item: 'superPotion', qty: 1 },
      // Gò đất 2 tầng trước cửa hang: lên tầng dưới từ phía đông (cạnh lối vào hang), đi men gờ sang tây rồi qua khe
      // lên tầng trên (dãy 3 cây quả mọng + Repel); nhảy gờ xuống là về thẳng Pokémon Center
      { x: 17, y: 2, kind: 'item', id: 't1-repel', item: 'repel', qty: 2 },
      ...berryRow('t1', 18, 3, ['oran', 'pecha', 'cheri']),
      // Gói hàng Team Rocket đánh rơi trước cửa Poké Mart (hiện từ khi đuổi được chúng tới khi nhặt lên)
      { x: 19, y: 16, kind: 'item', id: 'r1-parcel', item: 'martParcel', qty: 1, icon: true, after: 'gruntsDefeated', until: 'rocketDefeated' },
    ],
  },

  // Sông Lục Bình: dòng sông từ hồ nước phía nam Pallet chảy tới ao Thị trấn Lục Bình. Chỉ lướt nước (Surf / cưỡi Lapras)
  // mới vào được; các bãi bồi giữa sông có vật phẩm hiếm, ông câu cá trên bãi phía nam
  river1: {
    name: 'Sông Lục Bình',
    place: 'river1',
    hyacinth: 0.14, // lục bình trôi dọc sông
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTwwwwTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTwwwwTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTwwwwwwTTTTdddhddwwwwwwddddTTTT',
      'TTTTwwwwwwTTTTddddddwwwwwwddddTTTT',
      'TTdhddwwwwddddhdTTTTwwwwwwddhdTTTT',
      'TTddddwwwwddddddTTTTwwwwwwddddTTTT',
      'TTwwwwwwwwdhddTTTTwwwwwwwwwwTTTTTT',
      'TTwwwwwwwwddddTTTTwwwwwwwwwwTTTTTT',
      'TTwwwwwwwwddwwwwwwwwwwddwwwwwwwwww',
      'TTwwwwwwwwddwwwwwwwwwwddwwwwwwwwww',
      'TTwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'TTwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'TTTTddddTTTTddddTTTTTTddddddTTTTTT',
      'TTTTddhhTTTTddddTTTTTTdhddddTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    water: { name: 'Sông Lục Bình', surf: 'river1-surf', oldRod: 'river1-old', goodRod: 'river1-good', superRod: 'river1-super' },
    warps: [
      ...[4, 5, 6, 7].map((x) => ({ x, y: 0, to: 'route1', tx: x + 10, ty: 22, facing: 'up' })),
      ...[8, 9, 10, 11].map((y) => ({ x: 33, y, to: 'town1', tx: 1, ty: y + 4, facing: 'right' })),
    ],
    signs: {},
    objects: [
      { x: 12, y: 12, kind: 'item', id: 'rv-rare-candy', item: 'rareCandy', qty: 1, respawnDays: 3 },
      { x: 10, y: 9, kind: 'item', id: 'rv-ultra-ball', item: 'ultraBall', qty: 3 },
      { x: 16, y: 2, kind: 'item', id: 'rv-mystic-water', item: 'mysticWater', qty: 1 },
      { x: 28, y: 3, kind: 'item', id: 'rv-revive', item: 'revive', qty: 2 },
      { x: 4, y: 5, kind: 'item', id: 'rv-water-stone', item: 'waterStone', qty: 1 },
    ],
  },

  // Hang Thạch Nhũ 2 tầng: tầng 1 bị vách đá chia đôi (nửa nam có cửa vào từ Lục Bình, nửa bắc có cửa ra Tuyến đường 3).
  // Muốn ra phải xuống tầng hầm bằng thang phía đông nam (L), băng qua tầng hầm rồi leo thang phía tây bắc (U) lên nửa bắc.
  // Ngách cụt có vật phẩm, nhà huấn luyện chặn ở các phòng; Team Rocket đứng chắn hành lang ngay trước cửa ra
  cave1: {
    name: 'Hang Thạch Nhũ',
    place: 'cave1',
    cave: true,
    tiles: CAVE_TILES,
    fallback: '#',
    rows: [
      '###################################C####',
      '##################################...###',
      '###..........#####################...###',
      '###...L....o.#############...#####...###',
      '###......o...#############...#####...###',
      '###..........#############...#####...###',
      '###..........#########................##',
      '###.o...........o.......o.............##',
      '###...........................o.......##',
      '######################................##',
      '########################################',
      '########################################',
      '##.............#####...........#####..##',
      '##...........o.#########..##########..##',
      '######..################..##########..##',
      '######..##########..........########..##',
      '##..........######........o.###........#',
      '##..........######..o.......###........#',
      '##......o...######..........###..o.....#',
      '##..........................###....L...#',
      '##.o........................###........#',
      '##..........######......o...###........#',
      '##..........######..........###......o.#',
      '##........o.######.o...................#',
      '##..........######....o................#',
      '###...############..........###........#',
      '###...#########################.o......#',
      '###...#########################........#',
      '###...##################################',
      '####C###################################',
    ],
    areas: [{ name: 'Hang Thạch Nhũ', rect: [0, 0, 39, 29], table: 'cave1' }],
    warps: [
      { x: 4, y: 29, to: 'town1', tx: 27, ty: 6, facing: 'down', cave: true },
      { x: 35, y: 0, to: 'route3', tx: 5, ty: 5, facing: 'down', cave: true },
      { x: 35, y: 19, to: 'cave1b', tx: 32, ty: 4, facing: 'down', cave: true },
      { x: 6, y: 3, to: 'cave1b', tx: 3, ty: 4, facing: 'down', cave: true },
    ],
    objects: [
      { x: 2, y: 12, kind: 'item', id: 'c1-escape-rope', item: 'escapeRope', qty: 1 },
      { x: 30, y: 12, kind: 'item', id: 'c1-super-potion', item: 'superPotion', qty: 1 },
      { x: 37, y: 12, kind: 'item', id: 'c1-great-ball', item: 'greatBall', qty: 2 },
      { x: 38, y: 27, kind: 'item', id: 'c1-revive', item: 'revive', qty: 1 },
      { x: 12, y: 2, kind: 'item', id: 'c1-repel', item: 'superRepel', qty: 1 },
      { x: 27, y: 3, kind: 'item', id: 'c1-hard-stone', item: 'hardStone', qty: 1 },
    ],
  },

  // Tầng hầm Hang Thạch Nhũ: tối hơn, nhiều tảng đá chắn lối, Pokémon mạnh hơn (có Onix, Machop).
  // Giữa hai hành lang dọc là hồ ngầm (w): đi bộ vòng quanh bờ hồ như cũ, lướt nước (sau Gym Sông Nước) ra cồn đá
  // giữa hồ nhặt Leftovers; câu cá được từ hành lang, phòng giữa và sảnh phía nam
  cave1b: {
    name: 'Hang Thạch Nhũ – Tầng hầm',
    place: 'cave1',
    cave: true,
    tiles: CAVE_TILES,
    fallback: '#',
    rows: [
      '####################################',
      '####################################',
      '##.......##################........#',
      '##.U.....##################.....U..#',
      '##....o..##################........#',
      '##.......####.............#..o.....#',
      '##.......####..........o..#........#',
      '####..#######..o..........#......o.#',
      '####..#######.............#........#',
      '####..#######.............####..####',
      '####..##############..#wwwwww#..####',
      '####..##############..wwwwwwww..####',
      '####..##############..www..www..####',
      '##.........#########..wwwo.www..####',
      '##.........#########..wwwwwwww..####',
      '##......o..#########..wwwwwwww..####',
      '##..o......######..................#',
      '##.........######.........o........#',
      '##.........######..oo..............#',
      '##.........######..............o...#',
      '##....................oo...........#',
      '##.o...............................#',
      '##.........######..........oo......#',
      '##.....o...######...............o..#',
      '##.........######........o.........#',
      '##.........#########################',
      '####################################',
      '####################################',
    ],
    areas: [{ name: 'Tầng hầm', rect: [0, 0, 35, 27], table: 'cave1-deep' }],
    water: { name: 'Hồ ngầm', surf: 'cave1-surf', oldRod: 'cave1-old', goodRod: 'cave1-good', superRod: 'cave1-super' },
    warps: [
      { x: 32, y: 3, to: 'cave1', tx: 35, ty: 20, facing: 'down', cave: true },
      { x: 3, y: 3, to: 'cave1', tx: 6, ty: 4, facing: 'down', cave: true },
    ],
    objects: [
      { x: 14, y: 5, kind: 'item', id: 'c1b-everstone', item: 'everstone', qty: 1 },
      { x: 25, y: 8, kind: 'item', id: 'c1b-moon-stone', item: 'moonStone', qty: 1 }, // hang có Clefairy
      { x: 2, y: 25, kind: 'item', id: 'c1b-super-potion', item: 'superPotion', qty: 2 },
      { x: 34, y: 24, kind: 'item', id: 'c1b-full-heal', item: 'fullHeal', qty: 1 },
      { x: 8, y: 2, kind: 'item', id: 'c1b-revive', item: 'revive', qty: 1 },
      // Cồn đá giữa hồ ngầm: chỉ lướt nước mới tới (surf: vật phẩm cần lướt nước, tests/cave-water.test.js)
      { x: 26, y: 12, kind: 'item', id: 'c1b-lake-leftovers', item: 'leftovers', qty: 1, surf: true },
    ],
  },

  // Tuyến núi (44x32) từ cửa ra Hang Thạch Nhũ (vách đá góc tây bắc) xuống Làng Chân Đồi (mép đông, phía nam):
  // xuống thung lũng phía tây (băng bụi cỏ, Anh Tú), sang đông qua thung lũng phía nam (bụi cỏ, góc tây nam là cỏ rậm có
  // Revive), leo đường mòn vòng giữa các mỏm đá (Thợ leo núi Dũng) lên cao nguyên quanh hồ trên núi (lướt nước + câu cá,
  // cồn cát giữa hồ có Water Stone, Chị Mai chặn bờ nam), rồi xuống sườn đông: dốc vòng phía tây hoặc nhảy gờ đất v tắt xuống,
  // ra lối sang làng. Nhánh cụt: ngách phía đông thung lũng (Rare Candy), góc đông bắc hồ (Great Ball), bãi dưới sườn đông.
  // Bờ tây cao nguyên có gờ đất < nhảy xuống thung lũng gần cửa hang: đường tắt một chiều khi quay về hang.
  route3: {
    name: 'Tuyến đường 3',
    place: 'route3',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTRRRRRRRRRRRRTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTRRRRRRRRRRRRTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTRRRRRRRRRRRR............................TT',
      'TTRRRRRRRRRRRR............................TT',
      'TTRRRCRRRRRRRR..gggggg...wwwwwwwwww.......TT',
      'TT...=......RR..gggggg..wwwwwwwwwwww...Y..TT',
      'TT...=.s.....<..gggggg..wwwwwwwwwwww......TT',
      'TT...=.......<..gggggg..wwwwwddwwwww......TT',
      'TT...=.......<..gggggg..wwwwwddwwwww......TT',
      'TT...=.......<..gggggg..wwwwwwwwwwww......TT',
      'TTggggggggggTT..........wwwwwwwwwwww......TT',
      'TTggggggggggTT...........wwwwwwwwww.......TT',
      'TTggggggggggTT............................TT',
      'TTggggggggggTT............................TT',
      'TT...=..TTTTTTTTTTTTTTTTRR..TT............TT',
      'TT...=..TTTTTTTTTTTTTTTTRR..TT.........OO.TT',
      'TT...=..........TTTTTTTT....TT.........OO.TT',
      'TT...=..........TTTTTTTT....TT............TT',
      'TT...=..TTTT....TTTTTTTT..RRTT..TTTTTTvvvvTT',
      'TT...=..TTTT....TTTTTTTT..RRTT..TTTTTT....TT',
      'TT...=..TTTTTTTTTTTTTTTT....TT..TTTTTT....TT',
      'TT...=..TTTTTTTTTTTTTTTT....TT..TTTTTT....TT',
      'TT...=======gggggg========..TT..TTTTTT....TT',
      'TT...=======gggggg========..TT..TTTTTT....TT',
      'TT..........gggggg..........TT............TT',
      'TT......XX..gggggg..OO......TT............TT',
      'TTGGGGGG....gggggg..OO......TT........======',
      'TTGGGGGG....gggggg..........TT........======',
      'TTGGGGGG....gggggg.......k..TT....XX......TT',
      'TTGGGGGG....gggggg..........TT............TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Bụi cỏ rậm', rect: [2, 26, 7, 29], table: 'route3-deep' },
      { name: 'Bụi cỏ thung lũng tây', rect: [2, 10, 11, 13], table: 'route3-grass' },
      { name: 'Bụi cỏ thung lũng nam', rect: [12, 22, 17, 29], table: 'route3-grass' },
      { name: 'Bụi cỏ trên núi', rect: [16, 4, 21, 9], table: 'route3-grass' },
    ],
    water: { name: 'Hồ trên núi', surf: 'route3-surf', oldRod: 'route3-old', goodRod: 'route3-good', superRod: 'route3-super' },
    warps: [
      { x: 5, y: 4, to: 'cave1', tx: 35, ty: 1, facing: 'down', cave: true },
      { x: 43, y: 26, to: 'village1', tx: 1, ty: 10, facing: 'right' },
      { x: 43, y: 27, to: 'village1', tx: 1, ty: 11, facing: 'right' },
    ],
    signs: {
      '7,6': ['TUYẾN ĐƯỜNG 3', '↑ Hang Thạch Nhũ', '→ Làng Chân Đồi: xuống thung lũng, leo lên hồ trên núi rồi xuống sườn đông.'],
    },
    objects: [
      ...berryRow('r3', 18, 11, ['pecha', 'cheri']),
      { x: 15, y: 18, kind: 'item', id: 'route3-rare-candy', item: 'rareCandy', qty: 1, respawnDays: 3 }, // ngách phía đông thung lũng
      { x: 41, y: 2, kind: 'item', id: 'r3-great-ball', item: 'greatBall', qty: 2 }, // góc đông bắc hồ
      { x: 29, y: 7, kind: 'item', id: 'r3-water-stone', item: 'waterStone', qty: 1 }, // cồn cát giữa hồ, phải lướt nước
      { x: 2, y: 28, kind: 'item', id: 'r3-revive', item: 'revive', qty: 1 }, // góc cỏ rậm
      { x: 30, y: 28, kind: 'item', id: 'r3-full-heal', item: 'fullHeal', qty: 1 }, // bãi dưới sườn đông
    ],
  },

  town2: {
    name: 'Thành phố Đồi Gió',
    place: 'town2',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    martTier: 1,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT....OO.........OO...........TT',
      'TT....OO.f.......OO...........TT',
      'TT.f............=.............TT',
      'TT..............=........OOf..TT',
      'TT..............=........OO...TT',
      'TT..............=.............TT',
      'TTaQ.....Qa....Q=aaPP=PPs.....TT',
      'TTaaaa=aaaaa=as.=aaaa=aa...s..TT',
      '================================',
      '................=...............',
      'TT......TT......=.............TT',
      'TT......TT...f..=.........f...TT',
      'TT..............=.............TT',
      'TT..............=.............TT',
      'TT...===================..TT..TT',
      'TTOO............=.........TTOOTT',
      'TTOO......fuEEQaaaQfEEu.....OOTT',
      'TT.............aaa............TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 0, y: 10, to: 'village1', tx: 24, ty: 10, facing: 'left' },
      { x: 0, y: 11, to: 'village1', tx: 24, ty: 11, facing: 'left' },
      { x: 31, y: 10, to: 'route4', tx: 1, ty: 10, facing: 'right' },
      { x: 31, y: 11, to: 'route4', tx: 1, ty: 11, facing: 'right' },
    ],
    gates: [{ rect: [30, 10, 31, 11], badge: 'wind' }],
    // Nhà dân (to: null) chỉ để trang trí, cửa khoá
    buildings: [
      { type: 'center', x: 4, y: 5, w: 5, h: 4, door: { x: 6, y: 8 }, to: 'center2' },
      { type: 'mart', x: 11, y: 5, w: 4, h: 4, door: { x: 12, y: 8 }, to: 'mart2' },
      { type: 'gym', x: 19, y: 4, w: 5, h: 4, door: { x: 21, y: 7 }, to: 'gym1' },
      { type: 'house', x: 4, y: 12, w: 4, h: 4, door: { x: 5, y: 15 }, to: null },
      { type: 'house', x: 22, y: 12, w: 4, h: 4, door: { x: 23, y: 15 }, to: null },
    ],
    signs: {
      '14,9': ['THÀNH PHỐ ĐỒI GIÓ', 'Nơi gió lộng quanh năm trên những ngọn đồi.'],
      '24,8': ['GYM ĐỒI GIÓ', 'Thủ lĩnh: Phong, cánh chim không bao giờ mỏi!', 'Chuyên dùng Pokémon hệ Bay.'],
      '27,9': ['TUYẾN ĐƯỜNG 4 →', 'Đi về phía đông tới Thành phố Lúa Vàng.'],
    },
    objects: [
      ...berryRow('t2', 28, 15, ['sitrus', 'leppa']),
    ],
  },

};
