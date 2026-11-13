import { OUTDOOR_TILES } from './tiles.js';

// Khu vực phụ quanh các làng (nơi diễn ra nhiệm vụ của làng), phần B: làng 6-8. Ký tự ô: xem data/tiles.js
// Nhiệm vụ trong các khu này: story/villages.js (phần 6, 7, 8). Nhà huấn luyện, NPC, bảng Pokémon: data/extra/villagesB.js

const area = (def) => ({ tiles: OUTDOOR_TILES, fallback: 'T', buildings: [], ...def });

export const VILLAGE_AREAS_B = {
  // Mỏ Đá Vách Núi phía bắc Bản Vách Đá: lối lên ở giữa sân mỏ phía nam. Đá lở chắn thẳng lối giữa sân lên lòng mỏ,
  // phải vòng sang hành lang vách núi phía đông (đá chắn ngang buộc đi zíc zắc, bụi cỏ chắn cả lối), lên rìa mỏ phía bắc
  // rồi vòng sang hố mỏ cũ góc tây bắc (võ sư Hổ, Machoke bị Golbat đầu đàn dồn vào hốc đá;
  // xong nhiệm vụ, trong hốc lộ ra hai hoá thạch Helix / Dome, chỉ mang theo được một). Nhánh cụt: góc cỏ phía tây sân,
  // hốc cỏ rậm dưới rìa bắc, lòng mỏ dưới (vào từ hành lang đông, nhìn thấy đống đá lở từ phía trên). Từ hố mỏ nhảy gờ
  // đá xuống là đường tắt một chiều theo khe núi phía tây về sân mỏ
  quarry6: area({
    name: 'Mỏ Đá Vách Núi',
    place: 'village6',
    climate: 'sand',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT..R.................gggggg......TT',
      'TT..R.................gggggg......TT',
      'TTR.R.......TTTTTTTT..TTTTTTTT....TT',
      'TT..........TTTTTTTT..TTTTTTTT....TT',
      'TT..........TTTTTT........TTTT.k..TT',
      'TT...RR.....TTTTTT..GGGG..TTTT....TT',
      'TT..w.......TTTTTTGGGGGGGGTTTTRRR.TT',
      'TT.www......TTTTTTGGGGGGGGTTTTggggTT',
      'TT.www..RR..TTTTTT........TTTTggggTT',
      'TT..w.......TTTTTT........TTTTggggTT',
      'TTTTvvvvvvTTTTTTTTTTTTTTTTTTTT....TT',
      'TTTT......TTTTTTTTTTTTTTTTTTTT.RRRTT',
      'TTTT......TT................TT....TT',
      'TTTT......TT.....gggggg.....TT....TT',
      'TTTTgggg..TT....gggggggg..........TT',
      'TTTTgggg..TT....gggggggg..........TT',
      'TTTTgggg..TT..RR..gggg......TT....TT',
      'TTTTgggg..TT..RR............TTRRR.TT',
      'TTTT......TT................TT....TT',
      'TTTT......TT................TT....TT',
      'TTTT......TTTTRRRRRRRRTTTTTTTT....TT',
      'TTTT......TTTTRRRRRRRRTTTTTTTT....TT',
      'TT....XX..........................TT',
      'TT................................TT',
      'TTgggg.R....................TTTTTTTT',
      'TTgggg.R....................TTTTTTTT',
      'TTgggg.R.....s..............TTTTTTTT',
      'TTgggg.R....................TTTTTTTT',
      'TTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Cỏ rậm hốc mỏ', rect: [18, 6, 25, 9], table: 'quarry6-deep' },
      { name: 'Mỏ Đá Vách Núi', rect: [0, 0, 35, 31], table: 'quarry6' },
    ],
    warps: [
      { x: 16, y: 31, to: 'village6', tx: 10, ty: 1, facing: 'down' },
      { x: 17, y: 31, to: 'village6', tx: 11, ty: 1, facing: 'down' },
    ],
    signs: {
      '13,28': ['MỎ ĐÁ VÁCH NÚI', 'Đá lở! Lối giữa bị chặn, lên rìa mỏ đi vòng vách núi phía đông.', '↓ Bản Vách Đá'],
    },
    objects: [
      { x: 2, y: 28, kind: 'item', id: 'q6-hard-stone', item: 'hardStone', qty: 1 },
      { x: 24, y: 10, kind: 'item', id: 'q6-hyper-potion', item: 'hyperPotion', qty: 2 },
      { x: 13, y: 20, kind: 'item', id: 'q6-ultra-ball', item: 'ultraBall', qty: 3 },
      { x: 33, y: 2, kind: 'item', id: 'q6-full-heal', item: 'fullHeal', qty: 2 },
      { x: 2, y: 10, kind: 'item', id: 'q6-escape-rope', item: 'escapeRope', qty: 1 },
      // Hai hoá thạch trong hốc đá Machoke từng trốn (Golbat chắn lối tới khi xong nhiệm vụ làng): nhặt một thì cái kia
      // vùi mất trong đá vụn (choice / until, story/chapter1.js: useObject). Hồi sinh ở Viện Hoá thạch Núi Đá
      { x: 2, y: 2, kind: 'item', id: 'q6-helix-fossil', item: 'helixFossil', qty: 1, choice: 'q6Fossil', until: 'choice:q6Fossil' },
      { x: 3, y: 2, kind: 'item', id: 'q6-dome-fossil', item: 'domeFossil', qty: 1, choice: 'q6Fossil', until: 'choice:q6Fossil' },
    ],
  }),

  // Nghĩa Trang Rừng Trúc phía đông nam Xóm Hương Khói: lối vào phía bắc ra bãi trống có ông giữ mộ. Nhánh tây là rừng trúc
  // rậm như mê cung, cuối ngõ cụt có vật phẩm. Nhánh đông vòng xuống nghĩa trang cổ (hàng bia đá, đèn lồng, Haunter ôm chuông
  // lần đầu hiện ở đây rồi bay mất), ra góc tây nam nghĩa trang qua bà đồng, xuống lối trúc phía nam (cầu gỗ qua suối),
  // vòng sang đông rồi quay ngược về tây theo lối dưới cùng (hốc cỏ rậm có vật phẩm) mới tới miếu hoang góc tây nam:
  // Haunter chặn cửa miếu, chú tiểu trốn bên trong
  grave7: area({
    name: 'Nghĩa Trang Rừng Trúc',
    graves: true, // hàng bia đá (R) vẽ kiểu bia mộ vuông, không thành tảng đá tròn (gfx/world.js: rockPiles)
    place: 'village7',
    rows: [
      'TTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTT..TTTTTTTTTTTTTTTTTT',
      'TTTT......TT.l........l...........TT',
      'TTTT......TT..s...................TT',
      'TTTT..TT................TTTTTT....TT',
      'TTTT..TT................TTTTTT....TT',
      'TT....TTTTTT.l........l.TTTTTT....TT',
      'TT....TTTTTT............TTTTTT....TT',
      'TTggTT....TTTTTTTTTTTTTTTTTTTT....TT',
      'TTggTT....TTTTTTTTTTTTTTTTTTTT....TT',
      'TTggTT..TTTTTTl..................lTT',
      'TTggTT..TTTTTT.R.R.R.R.R.R.R.R.R.RTT',
      'TT......TTTTTTgggggggggg..........TT',
      'TT......TTTTTT.R.R.R.R.R.R.R.R.R.RTT',
      'TTTTTTTTTTTTTT..........ggggggggggTT',
      'TTTTTTTTTTTTTT.R.R.R.R.R.R.R.R.R.RTT',
      'TTTTTTTTTTTTTTgggggggggg..........TT',
      'TTTTTTTTTTTTTT.R.R.R.R.R.R.R.R.R.RTT',
      'TTTTTTTTTTTTTT....................TT',
      'TTTTTTTTTTTTTTl...................TT',
      'TT..........TT..TTTTTTTTTTTTTTTTTTTT',
      'TT.RRRRRR...TT..TTTTTTTTTTTTTTTTTTTT',
      'TT.R....R...TT..........bb........TT',
      'TT.R....R...TT..........bb........TT',
      'TT.RRR.RR...TTTTTTTTTTTTwwTTTT....TT',
      'TT..........TTTTTTTTTTTTwwTTTT..k.TT',
      'TT..........TTTTGGGGTTTTwwTTTT....TT',
      'TT.l......l.TTTTGGGGTTTTwwTTTT....TT',
      'TT..XX..................bb........TT',
      'TT......................bb........TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Cỏ rậm rừng trúc', rect: [16, 26, 19, 27], table: 'grave7-deep' },
      { name: 'Nghĩa Trang Rừng Trúc', rect: [0, 0, 35, 31], table: 'grave7' },
    ],
    warps: [
      { x: 16, y: 0, to: 'village7', tx: 20, ty: 18, facing: 'up' },
      { x: 17, y: 0, to: 'village7', tx: 21, ty: 18, facing: 'up' },
    ],
    signs: {
      '14,3': ['NGHĨA TRANG RỪNG TRÚC', 'Nơi yên nghỉ của người Xóm Hương Khói. Xin giữ yên lặng.', '↑ Xóm Hương Khói   ↘ Nghĩa trang cổ   ← Rừng trúc'],
    },
    objects: [
      { x: 9, y: 8, kind: 'item', id: 'g7-twisted-spoon', item: 'twistedSpoon', qty: 1 },
      { x: 19, y: 26, kind: 'item', id: 'g7-max-revive', item: 'maxRevive', qty: 1 },
      { x: 2, y: 28, kind: 'item', id: 'g7-full-heal', item: 'fullHeal', qty: 2 },
      { x: 33, y: 2, kind: 'item', id: 'g7-great-ball', item: 'greatBall', qty: 3 },
    ],
  }),

  // Đèo Tuyết phía bắc Làng Đèo Tuyết: đường đèo ngoằn ngoèo bốn tầng. Chân đèo (lối vào phía nam, tuyết dày chắn ngang)
  // → lên tầng hai ở mé tây, dãy đá chắn giữa buộc vòng qua phía bắc chỗ dân leo núi đứng → lên tầng ba ở mé đông, hồ băng
  // và dãy đá chắn giữa, chỉ lách qua chỗ nhóc trượt tuyết → lên đỉnh đèo ở mé tây rồi đi hết đỉnh sang đông: anh Đông
  // trú trong hốc đá, Jynx chặn cửa. Gờ tuyết là đường tắt một chiều xuống tầng dưới. Nhánh cụt: hốc đá tầng hai, góc
  // tây bắc đỉnh đèo, bụi tuyết tầng ba, góc đông chân đèo
  pass8: area({
    name: 'Đèo Tuyết',
    place: 'village8',
    snow: true,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT..n......gggggg............R....TT',
      'TT......n..gggggg...n........R....TT',
      'TT...............nn..........R....TT',
      'TT...........................RRR.RTT',
      'TT..........n.....................TT',
      'TT....................n...........TT',
      'TT....TTTTTTTTTTTTTTTTTTTTTTvvvvTTTT',
      'TT....TTTTTTTTTTTTTTTTTTTTTT....TTTT',
      'TT....................R...........TT',
      'TT......gggg....wwwwwwR...........TT',
      'TT......gggg....wwwwwwR....nn.....TT',
      'TT......gggg....wwwwwwR...........TT',
      'TT..n......................gggg...TT',
      'TT................................TT',
      'TTTTTTvvvvTTTTTTTTTTTTTTTTTTTT....TT',
      'TTTTTT....TTTTTTTTTTTTTTTTTTTT....TT',
      'TT................................TT',
      'TT............R....gggggg.........TT',
      'TT....nn......R....gggggg.........TT',
      'TT............R....gggggg....RRRR.TT',
      'TT............R...........XX.R....TT',
      'TT............R..............R....TT',
      'TT....TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT....TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT........gggggggg................TT',
      'TT........gggggggg.......n........TT',
      'TT...n....gggggggg...........s....TT',
      'TT........gggggggg................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT..TTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT..TTTTTTTT',
    ],
    areas: [
      { name: 'Đèo Tuyết', rect: [0, 0, 35, 31], table: 'pass8' },
    ],
    warps: [
      { x: 26, y: 31, to: 'village8', tx: 20, ty: 1, facing: 'down' },
      { x: 27, y: 31, to: 'village8', tx: 21, ty: 1, facing: 'down' },
    ],
    signs: {
      '29,28': ['ĐÈO TUYẾT', 'Đường đèo quanh co, bão tuyết bất chợt. Đi theo người dẫn đường!', '↓ Làng Đèo Tuyết'],
    },
    objects: [
      { x: 2, y: 2, kind: 'item', id: 'p8-never-melt-ice', item: 'neverMeltIce', qty: 1 },
      { x: 30, y: 22, kind: 'item', id: 'p8-hyper-potion', item: 'hyperPotion', qty: 2 },
      { x: 28, y: 14, kind: 'item', id: 'p8-ultra-ball', item: 'ultraBall', qty: 2 },
      { x: 33, y: 28, kind: 'item', id: 'p8-max-repel', item: 'maxRepel', qty: 1 },
    ],
  }),
};
