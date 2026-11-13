import { CAVE_TILES, OUTDOOR_TILES } from './tiles.js';

// Khu vực phụ quanh các làng (nơi diễn ra nhiệm vụ của làng), phần A: Xóm Cối Xay, Xóm Trạm Điện, Làng Bến Đò, Làng Đất Sét.
// Mỗi khu nối với làng bằng một lối riêng, thuộc cùng khu vực với làng trên bản đồ vùng (place). Nhiệm vụ: story/villages.js.
// Ký tự ô: xem data/tiles.js

export const VILLAGE_AREAS_A = {
  // Đồng Cối Xay sau Xóm Cối Xay: ruộng lúa bậc thềm, bờ ruộng ngoằn ngoèo, con suối cắt ngang đồng.
  // Vào từ phía nam (lối mòn sau xóm). Bờ ruộng phía nam chia nhánh: tây là bãi cỏ rậm cụt, đông có nhóc chăn trâu.
  // Cầu tây chỉ sang bãi cỏ dại ven suối (cụt); muốn lên kho thóc cũ góc tây bắc phải qua cầu đông (Oddish chắn),
  // ngoằn ngoèo lên bờ đông rồi theo bờ bắc về tây qua bụi cỏ, Bellsprout chắn lối xuống sân kho, Gloom canh cửa kho.
  // Từ sân kho nhảy gờ đất xuống bãi cỏ dại là đường tắt một chiều về cầu tây
  field2: {
    name: 'Đồng Cối Xay',
    place: 'village2',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT..........gggggggg........k.....TT',
      'TT..........gggggggg..........f...TT',
      'TT......HHTTTTTTTTTTTTTTTTTT......TT',
      'TT........TTTTTTTTTTTTTTTTTT......TT',
      'TT..........ppppppppppppppTT......TT',
      'TT..........ppppppppppppppTTHHHH..TT',
      'TTvvvvHHHHHHppppppppppppppTT......TT',
      'TT..........ppppppppppppppTT......TT',
      'TT..hh.hhh..p.ggggg...........HHHHTT',
      'TT.hhh.h.h..pppppppppppppp........TT',
      'TT..h.hh.h..ppppppppppppppTT......TT',
      'TTs.........ppppppppppppppTT......TT',
      'TTwwwwbwwwwwwwwwwwwwwwwwwwwwwwbwwwTT',
      'TTwwwwbwwwwwwwwwwwwwwwwwwwwwwwbwwwTT',
      'TT................................TT',
      'TTpppppppppppppp....ppppppppppppppTT',
      'TT..pppppppppppppgggpppppppppppp..TT',
      'TT..pppppppppppppgggpppppppppppp..TT',
      'TT..pppppppppppp....pppppppppppp..TT',
      'TT..gggg..............ggggg.....f.TT',
      'TTGGGGGGpppppppp....pppppppppppp..TT',
      'TTGGGGGGpppppppp....pppppppppppp..TT',
      'TTGGGGGGppppppppggggpppppppppppp..TT',
      'TTGGGGGGpppppppp....pppppppppppp..TT',
      'TTTTTTTTTTTT............TTTTTTTTTTTT',
      'TTTTTTTTTTTT....s.......TTTTTTTTTTTT',
      'TTTTTTTTTTTT.XX.........TTTTTTTTTTTT',
      'TTTTTTTTTTTT............TTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTT',
    ],
    // Kho thóc cũ (bầy Pokémon cỏ tha thóc về đây): nhà không vào được, gõ cửa xem story/villages.js: houseKnock
    buildings: [{ type: 'house', x: 3, y: 2, w: 4, h: 4, door: { x: 4, y: 5 }, to: null, roof: 'houseYellow' }],
    areas: [
      { name: 'Cỏ rậm ven đồng', rect: [2, 22, 7, 25], table: 'field2-deep' },
      { name: 'Đồng Cối Xay', rect: [0, 0, 35, 31], table: 'field2' },
    ],
    warps: [
      { x: 18, y: 31, to: 'village2', tx: 18, ty: 1, facing: 'down' },
      { x: 19, y: 31, to: 'village2', tx: 19, ty: 1, facing: 'down' },
    ],
    signs: {
      '16,27': ['ĐỒNG CỐI XAY', 'Ruộng lúa của xóm. Kho thóc cũ ở góc tây bắc, qua cầu phía đông.', '↓ Xóm Cối Xay'],
      '2,13': ['BÃI CỎ DẠI VEN SUỐI', 'Mùa khô, suối cạn, cỏ dại héo rũ cả.'],
    },
    objects: [
      { x: 2, y: 2, kind: 'item', id: 'f2-awakening', item: 'awakening', qty: 2 }, // ngách sau kho thóc cũ
      { x: 13, y: 10, kind: 'item', id: 'f2-leaf-stone', item: 'leafStone', qty: 1 }, // cuối bờ ruộng giữa đồng
      { x: 2, y: 24, kind: 'item', id: 'f2-super-potion', item: 'superPotion', qty: 2 }, // góc bãi cỏ rậm
      { x: 33, y: 18, kind: 'item', id: 'f2-great-ball', item: 'greatBall', qty: 3 }, // cuối bờ đông
      { x: 11, y: 9, kind: 'item', id: 'f2-silk-scarf', item: 'silkScarf', qty: 1 }, // bãi cỏ dại ven suối
    ],
  },

  // Đồi Cột Điện sau Xóm Trạm Điện: bốn bậc đồi ngăn bởi vách đá, mỗi vách chỉ có một khe xuống bậc dưới ở đầu
  // bên kia, nên đường xuống đi ngoằn ngoèo hết bề ngang đồi. Bậc 1 có góc tây cụt trong bụi cỏ, bậc 2 có hõm đá
  // phía đông, bậc 3 có bụi cỏ rậm, bậc cuối là trạm phát cũ: Magneton bám cột điện chắn hõm có cầu chì cuối cùng
  hill3: {
    name: 'Đồi Cột Điện',
    place: 'village3',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    buildings: [],
    rows: [
      'TTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTT',
      'TT.............s....l......l......TT',
      'TT....gggggggg....................TT',
      'TT....gggggggg....................TT',
      'TT....gggggggg..OO..RR............TT',
      'TT....gggggggg..OO................TT',
      'TT................................TT',
      'TTRRRRRRRRRRRRRRRRRRRRRRRRRRRRR..RTT',
      'TT................................TT',
      'TT........gggggggggggg............TT',
      'TT........gggggggggggg............TT',
      'TT.........................R......TT',
      'TT.....l...................R..XX..TT',
      'TT.........................R......TT',
      'TT.........................R......TT',
      'TT..RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRTT',
      'TT................................TT',
      'TT.....gggggg.....................TT',
      'TT.....gggggg.........RR..........TT',
      'TT..........GGGGGG................TT',
      'TT..........GGGGGG................TT',
      'TT..........GGGGGG................TT',
      'TTRRRRRRRRRRRRRRRRRRRRRRRRRRRR..RRTT',
      'TTs...R...........................TT',
      'TT.l..R.k.........................TT',
      'TT....R...........................TT',
      'TT.......gggggggggggggggg.........TT',
      'TT....R...gggggggggggggggg........TT',
      'TT....R...........................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Cỏ rậm trên đồi', rect: [12, 20, 17, 22], table: 'hill3-deep' },
      { name: 'Đồi Cột Điện', rect: [0, 0, 35, 31], table: 'hill3' },
    ],
    warps: [
      { x: 16, y: 0, to: 'village3', tx: 6, ty: 18, facing: 'up' },
      { x: 17, y: 0, to: 'village3', tx: 7, ty: 18, facing: 'up' },
    ],
    signs: {
      '15,2': ['ĐỒI CỘT ĐIỆN', 'Bốn bậc đồi, mỗi vách đá chỉ có một khe xuống bậc dưới ở đầu bên kia.', '↑ Xóm Trạm Điện'],
      '2,24': ['TRẠM PHÁT CŨ', 'Cột điện cao thế đã ngừng hoạt động. Cầu chì dự phòng của xóm cất ở đây.'],
    },
    objects: [
      // Cầu chì: chỉ hiện khi đã nhận lời kỹ sư (quest: 'v3')
      { x: 2, y: 3, kind: 'item', id: 'v3-fuse-a', item: 'fuse', qty: 1, quest: 'v3' }, // góc tây bậc 1
      { x: 33, y: 15, kind: 'item', id: 'v3-fuse-b', item: 'fuse', qty: 1, quest: 'v3' }, // hõm đá bậc 2
      { x: 3, y: 27, kind: 'item', id: 'v3-fuse-c', item: 'fuse', qty: 1, quest: 'v3' }, // trạm phát cũ, sau lưng Magneton
      { x: 33, y: 2, kind: 'item', id: 'h3-super-potion', item: 'superPotion', qty: 2 },
      { x: 12, y: 22, kind: 'item', id: 'h3-magnet', item: 'magnet', qty: 1 }, // giữa bụi cỏ rậm
      { x: 33, y: 17, kind: 'item', id: 'h3-paralyze-heal', item: 'paralyzeHeal', qty: 2 },
      { x: 2, y: 28, kind: 'item', id: 'h3-thunder-stone', item: 'thunderStone', qty: 1 },
    ],
  },

  // Đầm Lau thượng nguồn Làng Bến Đò: sông chảy từ đầm xuống làng chia đôi khu. Vào từ phía nam bên bờ đông,
  // lối lau sậy ngoằn ngoèo lên bắc tới cầu ván duy nhất sang bờ tây; bờ tây phải vòng xuống nam rồi theo mé tây
  // (lau sậy rậm) lên bờ đầm. Cầu ván giữa đầm dẫn ra cồn cát nơi bè gỗ mắc cạn (Gyarados nằm chắn cầu ván).
  // Bờ đông đầm là ngách cụt có ngư dân, bờ tây có hõm cụt giữa rặng cây
  marsh4: {
    name: 'Đầm Lau',
    place: 'village4',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    buildings: [],
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT..........wwwwwwwwwwwwwwww......TT',
      'TT..........wwwwwwwwwwwwwwww......TT',
      'TT..........wwwwwwddddwwwwww......TT',
      'TT..........bbbbbbddddwwwwww......TT',
      'TT..........wwwwwwddddwwwwww......TT',
      'TT..........wwwwwwwwwwwwwwww......TT',
      'TT..........wwwwwwwwwwwwwwww..gg..TT',
      'TT..........wwwwwwwwwwwwwwww..gg..TT',
      'TT....TTTTTTTTTTwwww..............TT',
      'TT....TTTTTTTTTTwwww.....XX.......TT',
      'TT.k..TTTTTTTT..bbbb..............TT',
      'TT....TTTTTTTT..wwww..............TT',
      'TTGG..TTTTTTTT..wwww..gggg........TT',
      'TTGG..TTTTTTTT..wwww..gggg........TT',
      'TTGG..TTTTTTTT..wwwwTTTTTTTTTT....TT',
      'TTGG..TTTTTTTT..wwwwTTTTTTTTTT....TT',
      'TTGG..TT........wwww....gggggg....TT',
      'TTGG..TT........wwww....gggggg....TT',
      'TTGG..TTTTTTTT..wwww....TTTTTTTTTTTT',
      'TTGG..TTTTTTTT..wwww....TTTTTTTTTTTT',
      'TTGG..TTTTTTTT..wwww...........k..TT',
      'TTGG..TTTTTTTT..wwww..............TT',
      'TT....TTTTTTTT..wwwwTTTTTTTTTT....TT',
      'TT....TTTTTTTT..wwwwTTTTTTTTTT....TT',
      'TT....gggggggg..wwww......s.......TT',
      'TT....gggggggg..wwww..............TT',
      'TTTTTTTTTTTTTTTTwwwwTTTT..TTTTTTTTTT',
      'TTTTTTTTTTTTTTTTwwwwTTTT..TTTTTTTTTT',
    ],
    areas: [
      { name: 'Lau sậy rậm', rect: [2, 14, 3, 23], table: 'marsh4-deep' },
      { name: 'Đầm Lau', rect: [0, 0, 35, 29], table: 'marsh4' },
    ],
    water: { name: 'Đầm Lau', surf: 'route6-surf', oldRod: 'route6-old', goodRod: 'route6-good', superRod: 'route6-super' },
    warps: [
      { x: 24, y: 29, to: 'village4', tx: 12, ty: 1, facing: 'down' },
      { x: 25, y: 29, to: 'village4', tx: 13, ty: 1, facing: 'down' },
    ],
    signs: {
      '26,26': ['ĐẦM LAU', 'Lau sậy mọc kín bờ. Cầu ván duy nhất sang bờ tây nằm ở phía bắc.', '↓ Làng Bến Đò'],
    },
    objects: [
      { x: 2, y: 2, kind: 'item', id: 'm4-water-stone', item: 'waterStone', qty: 1 }, // góc tây bắc bờ đầm
      { x: 33, y: 2, kind: 'item', id: 'm4-great-ball', item: 'greatBall', qty: 3 }, // cuối bờ đông đầm
      { x: 8, y: 18, kind: 'item', id: 'm4-mystic-water', item: 'mysticWater', qty: 1 }, // hõm cụt giữa rặng cây
      { x: 2, y: 23, kind: 'item', id: 'm4-hyper-potion', item: 'hyperPotion', qty: 1 }, // giữa lau sậy rậm
      { x: 21, y: 6, kind: 'item', id: 'm4-revive', item: 'revive', qty: 1 }, // trên cồn cát, cạnh bè gỗ
    ],
  },

  // Mỏ Đất Sét sau Làng Đất Sét (hang nhỏ): cửa mỏ ở vách đá góc tây bắc làng. Sảnh vào phía nam, đường hầm dưới
  // chạy sang đông, hầm đông lên bắc (tay buôn Lực đứng trong hốc canh chừng), hầm trên quay về tây rồi rẽ xuống hầm
  // chính giữa mỏ, nơi tay buôn Tài giữ chú Sét. Hầm phía tây là ngách cụt dài; hốc đá phía đông và cuối hầm trên có
  // vật phẩm. Trong hầm chính có lỗ thang (U) bọn buôn lậu đào thông lên bãi đất sau làng: chỉ leo ra được (một chiều).
  // Dưới hầm dưới là hố khai thác cũ ngập nước (w): lướt nước tới mỏm đá cuối hố có Water Stone, câu cá được từ bờ hố
  pit5: {
    name: 'Mỏ Đất Sét',
    place: 'village5',
    cave: true,
    tiles: CAVE_TILES,
    fallback: '#',
    rows: [
      '################################',
      '################################',
      '###..........................###',
      '###.o........................###',
      '###..........................###',
      '##############..##########...###',
      '##...#########..##########...###',
      '##...#########..##########...###',
      '##...#########..##########...###',
      '##...####............#####...###',
      '##...####..........U.#####...###',
      '##...####..o.........#####...###',
      '##...####............#####.....#',
      '##...####............#####.....#',
      '##...####.........o..#####...###',
      '##...####............#####...###',
      '##...####............#####...###',
      '##...#####################...###',
      '##...####################....###',
      '##...#####################...###',
      '##...#####################...###',
      '##...#####################...###',
      '##...........................###',
      '##....o......................###',
      '##...........................###',
      '##...........#wwwwwwwww#########',
      '##...........#wwwwwwww.#########',
      '######C#########################',
    ],
    areas: [{ name: 'Mỏ Đất Sét', rect: [0, 0, 31, 27], table: 'pit5' }],
    water: { name: 'Hố ngập nước', surf: 'pit5-surf', oldRod: 'pit5-old', goodRod: 'pit5-good', superRod: 'pit5-super' },
    warps: [
      { x: 6, y: 27, to: 'village5', tx: 5, ty: 4, facing: 'down', cave: true },
      // Đường hầm bọn buôn lậu đào: leo lên ra bãi đất sau làng (không có lối xuống)
      { x: 19, y: 10, to: 'village5', tx: 8, ty: 4, facing: 'down', cave: true, oneWay: true },
    ],
    objects: [
      { x: 3, y: 2, kind: 'item', id: 'p5-revive', item: 'revive', qty: 1 }, // cuối hầm trên
      { x: 2, y: 6, kind: 'item', id: 'p5-hard-stone', item: 'hardStone', qty: 1 }, // cuối hầm phía tây
      { x: 30, y: 12, kind: 'item', id: 'p5-escape-rope', item: 'escapeRope', qty: 1 }, // hốc đá hầm đông
      { x: 20, y: 16, kind: 'item', id: 'p5-full-heal', item: 'fullHeal', qty: 1 }, // góc hầm chính
      { x: 22, y: 26, kind: 'item', id: 'p5-pit-water-stone', item: 'waterStone', qty: 1, surf: true }, // mỏm đá cuối hố ngập nước
    ],
  },
};
