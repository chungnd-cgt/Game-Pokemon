import { berryRow } from './berryRows.js';
import { INDOOR_TILES, OUTDOOR_TILES } from './tiles.js';

// Gym 2-4: Đồi Gió -> Tuyến đường 4 -> Lúa Vàng (gym Cỏ) -> Tuyến đường 5 -> Đèn Lồng (gym Điện)
// -> Tuyến đường 6 -> Sông Nước (gym Nước). Ký tự ô: xem data/tiles.js.
// gates: lối ra khỏi thị trấn chỉ mở khi đã có huy hiệu gym của thị trấn đó (xem story/chapter2.js)
// Đồ vật trong gym: gate (cổng, mở khi có cờ flag) • switch (công tắc bật cờ flag) •
//   barrier (hàng rào điện nhóm A hiện khi cờ tắt, nhóm B hiện khi cờ bật) • toggle (công tắc đổi cờ bật / tắt)


export const CHAPTER3_MAPS = {
  // Tuyến đường 4 - Đồng Gió Lúa (48x28): đồng cỏ chia bốn dải bởi hàng cây và hàng rào, đường đi ngoằn ngoèo như chữ S.
  //  Dải 1 (tây): vào từ Đồi Gió, đường đất rẽ lên bắc; ruộng có rào phía nam, lối hẹp men rào xuống bãi cỏ cuối ngách.
  //  Dải 2: qua khe trên hàng cây, đi xuống qua dải cỏ cao vắt ngang và ao nhỏ.
  //  Dải 3: ruộng bậc thang có rào bao quanh, đi trên bờ ruộng ngoằn ngoèo từ khe dưới lên khe trên (đừng giẫm lúa);
  //         bãi cỏ rậm dưới chân ruộng là ngách cụt có vật phẩm.
  //  Dải 4 (đông): bãi chăn ngựa có rào (Ponyta gặm cỏ), cỏ cao, lối ra Xóm Cối Xay; ngách đông nam sau hàng cây.
  route4: {
    name: 'Tuyến đường 4',
    place: 'route4',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT......................H.....................TT',
      'TTggg.============......H........=======...OO.TT',
      'TTggg.============TTTTTTH........=======...OO.TT',
      'TTggg.==........==TTTTTTHHHHHHHHH=HH..==......TT',
      'TTggg.==....TTTT==TTTTTTHpppppppp=pHTT==HHHHHHTT',
      'TTggg.==....TTTT==TTTTTTHpppppppp=pHTT==H....HTT',
      'TTggg.==....TT..==TTTTTTHpppppppp=pHTT==H....HTT',
      'TT...s==....TT..==TTTTTTHpp=======pHTT==H....HTT',
      '========....TTggggggggggHpp=pppppppHTT==.....HTT',
      '========....TTggggggggggHpp=pppppppHTT==H....HTT',
      'TT.k........TTggggggggggHpp=pppppppHTT==H....HTT',
      'TT..HHHHHHHHTTggggggggggHpp======ppHTT==HHHHHHTT',
      'TT..HpppHppHTTggggggggggHppppppp=ppHTT==......TT',
      'TT..HpppHppHTT==...EEu..Hppppppp=ppHTTggggggggTT',
      'TT..HpppHppHTT==...wwwwwHppppppp=ppHTTggggggggTT',
      'TT..HpppHppHTT==...wwwwwHp=======ppHTTggggggggTT',
      'TT..HpppHppHTT==...wwwwwHp=ppppppppHTTggggggggTT',
      'TT..HpppHppHTT==...wwwwwHp=ppppppppHTT==......TT',
      'TT..HpppHppHTT==...wwwwwHp=ppppppppHTT==========',
      'TT..HHHHHHHHTT==.k......HH=HHHHHHHHHTT==========',
      'TT.gggggggg.TT==.........s...GGGGGGGTT..TTTTTTTT',
      'TT.gggggggg.TT==============.GGGGGGGTT..TTTTTTTT',
      'TT.gggggggg.TT==============.GGGGGGGTT...k....TT',
      'TT.gggggggg.TT...............GGGGGGGTT........TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Bãi cỏ rậm chân ruộng', rect: [29, 22, 35, 25], table: 'route4-deep' },
      { name: 'Bụi cỏ đầu đường', rect: [2, 3, 4, 8], table: 'route4-grass' },
      { name: 'Bãi cỏ sau ruộng', rect: [3, 22, 10, 25], table: 'route4-grass' },
      { name: 'Dải cỏ cao', rect: [14, 10, 23, 14], table: 'route4-grass' },
      { name: 'Bụi cỏ bãi ngựa', rect: [38, 15, 45, 18], table: 'route4-grass' },
    ],
    warps: [
      { x: 0, y: 10, to: 'town2', tx: 30, ty: 10, facing: 'left' },
      { x: 0, y: 11, to: 'town2', tx: 30, ty: 11, facing: 'left' },
      { x: 47, y: 20, to: 'village2', tx: 1, ty: 10, facing: 'right' },
      { x: 47, y: 21, to: 'village2', tx: 1, ty: 11, facing: 'right' },
    ],
    signs: {
      '5,9': ['TUYẾN ĐƯỜNG 4', '← Thành phố Đồi Gió   → Xóm Cối Xay'],
      '25,22': ['RUỘNG BẬC THANG', 'Lối lên phía bắc đi theo bờ ruộng.', 'Xin đừng giẫm lên lúa!'],
    },
    objects: [
      ...berryRow('r4', 8, 6, ['pomeg', 'kelpsy', 'qualot']),
      { x: 45, y: 24, kind: 'item', id: 'r4-bike-chain', item: 'bikeChain', qty: 1, quest: 'bike' },
      { x: 23, y: 10, kind: 'item', id: 'r4-super-potion', item: 'superPotion', qty: 2 },
      { x: 11, y: 24, kind: 'item', id: 'r4-super-repel', item: 'superRepel', qty: 1 },
      { x: 35, y: 24, kind: 'item', id: 'r4-leaf-stone', item: 'leafStone', qty: 1 },
      { x: 25, y: 2, kind: 'item', id: 'r4-great-ball', item: 'greatBall', qty: 2 },
      { x: 44, y: 7, kind: 'item', id: 'r4-paralyze-heal', item: 'paralyzeHeal', qty: 2 },
    ],
  },

  // Lúa Vàng: làng ở góc tây bắc, ruộng bậc thang phía đông và phía nam (đi trên bờ ruộng)
  town3: {
    name: 'Thành phố Lúa Vàng',
    place: 'town3',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    martTier: 1,
    rows: [
      'TTTTTTTTTTTTTTTT=.TTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTT=.TTTTTTTTTTTTTT',
      'TT......f...TT..=.............TT',
      'TT.f........TT..=...........f.TT',
      'TT..............=.........TT..TT',
      'TT..............=.f.......TT..TT',
      'TT..............=.............TT',
      'TT............f.=..PP=PPs.....TT',
      'TTQaa=aaaa=aaQ..=....=........TT',
      'TTaaa=aaaa=aaa..======......Y.TT',
      '=================.Hppppp=pppppTT',
      '.......EE....s..=.Hppppp=pppppTT',
      'TTf.............=.Hppppp=pppppTT',
      'TT...........f..=.Hppppp=pppppTT',
      'TT..............==============TT',
      'TT..............=.Hppppp=pppppTT',
      'TT..=============.Hppppp=pppppTT',
      'TTHHHHHH.HHHHH....Hppppp=pppppTT',
      'TTpppppp=ppppp....Hppppp=pppppTT',
      'TTpppppp=ppppp................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    gates: [{ rect: [16, 0, 17, 1], badge: 'grass' }],
    warps: [
      { x: 0, y: 10, to: 'village2', tx: 24, ty: 10, facing: 'left' },
      { x: 0, y: 11, to: 'village2', tx: 24, ty: 11, facing: 'left' },
      { x: 16, y: 0, to: 'route5', tx: 16, ty: 28, facing: 'up' },
      { x: 17, y: 0, to: 'route5', tx: 17, ty: 28, facing: 'up' },
    ],
    buildings: [
      { type: 'center', x: 3, y: 4, w: 5, h: 4, door: { x: 5, y: 7 }, to: 'center3' },
      { type: 'mart', x: 9, y: 4, w: 4, h: 4, door: { x: 10, y: 7 }, to: 'mart3' },
      { type: 'gym', x: 19, y: 3, w: 5, h: 4, door: { x: 21, y: 6 }, to: 'gym2', roof: 'gymGrass' },
      { type: 'house', x: 3, y: 12, w: 4, h: 4, door: { x: 4, y: 15 }, to: null, roof: 'houseGreen' },
      { type: 'house', x: 9, y: 12, w: 4, h: 4, door: { x: 10, y: 15 }, to: null },
    ],
    signs: {
      '13,11': ['THÀNH PHỐ LÚA VÀNG', 'Ruộng lúa bậc thang trải dài, mùa nào cũng thơm mùi lúa mới.'],
      '24,7': ['GYM LÚA VÀNG', 'Thủ lĩnh: Thảo, người gieo hạt giữa đồng xanh.', 'Chuyên dùng Pokémon hệ Cỏ.'],
    },
    objects: [
      ...berryRow('t3', 15, 17, ['lum', 'oran', 'sitrus']),
    ],
  },

  // Tuyến đường 5 - Bãi Đá Trạm Điện (40x30): ba bậc đá xếp từ nam lên bắc, viền gờ đá (nhảy xuống được, không leo lên được).
  //  Bậc 1: vào từ Lúa Vàng ở phía nam, đi sang đông tới dốc lên; cỏ cao phía tây, vườn đá đông nam là ngách cụt.
  //  Bậc 2: trạm biến áp có rào ở giữa (vào qua cổng phía bắc, kỹ sư canh), băng qua cỏ cao rồi đi ngược sang tây tới
  //         dốc thứ hai; ngách tây nam sau dãy đá có cây quả mọng.
  //  Bậc 3: lên dốc tây là tới lối ra Xóm Trạm Điện; khe giữa vách đá dẫn lên bãi đá cao (cỏ rậm, đá tảng) là khu khám phá,
  //         nhảy gờ xuống là về nhanh bậc 2, rồi bậc 1.
  route5: {
    name: 'Tuyến đường 5',
    place: 'route5',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT....RR........................TTTTTTTT',
      'TT....RR......GGGGGGGGGGGG....RRTTTTTTTT',
      '======RR......GGGGGGGGGGGG....RRTTTTTTTT',
      '======RR......GGGGGGGGGGGG....RRTTTTTTTT',
      'TT====........GGGGGGGGGGGG....RR......TT',
      'TT====....RR..............RR......OO..TT',
      'TT====RR..RR....RR...XX...RR......OO..TT',
      'TT====RR..RR....RR...........k........TT',
      'TT====RR........RR....................TT',
      'TT====JvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvTT',
      'TT....==============gggggggggggg====..TT',
      'TT....==============gggggggggggg====..TT',
      'TT................s.gggggggggggg..==..TT',
      'TT.kRRRRRRRRHHHHHHH..HHHHHHH......==..TT',
      'TT..........H..............H......==..TT',
      'TT..........H.RR.......RR..H..RRRR==..TT',
      'TT.......OO.H.RR.......RR..H..RRRR==..TT',
      'TT.......OO.H..............H..RRRR==..TT',
      'TT..........HHHHHHHHHHHHHHHH..RRRR==..TT',
      'TTvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvJ==..TT',
      'TT................................==..TT',
      'TTgggggggggg........k........XX...==..TT',
      'TTgggggggggg...s====================..TT',
      'TTGGGGGGgggg....====================..TT',
      'TTGGGGGGggggTTTT==TTTT..RR............TT',
      'TTGGGGGGggggTTTT==TTTT..RR....RRRR....TT',
      'TTTTTTTTTTTTTTTT==TTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTT==TTTTTTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Bãi đá cao', rect: [14, 3, 25, 6], table: 'route5-rocks' },
      { name: 'Bụi cỏ rậm', rect: [2, 25, 7, 27], table: 'route5-deep' },
      { name: 'Bụi cỏ phía tây', rect: [2, 23, 11, 27], table: 'route5-grass' },
      { name: 'Bụi cỏ trước trạm điện', rect: [20, 12, 31, 14], table: 'route5-grass' },
    ],
    warps: [
      { x: 16, y: 29, to: 'town3', tx: 16, ty: 1, facing: 'down' },
      { x: 17, y: 29, to: 'town3', tx: 17, ty: 1, facing: 'down' },
      { x: 0, y: 4, to: 'village3', tx: 24, ty: 4, facing: 'left' },
      { x: 0, y: 5, to: 'village3', tx: 24, ty: 5, facing: 'left' },
    ],
    signs: {
      '15,24': ['TUYẾN ĐƯỜNG 5', '↓ Thành phố Lúa Vàng   ← Xóm Trạm Điện', 'Đường lên dốc ở phía đông.'],
      '18,14': ['TRẠM BIẾN ÁP SỐ 5', 'Điện cao thế! Pokémon hệ Điện hay tụ tập quanh đây.'],
    },
    objects: [
      ...berryRow('r5', 5, 17, ['hondew', 'grepa', 'tamato']),
      { x: 8, y: 2, kind: 'item', id: 'route5-rare-candy', item: 'rareCandy', qty: 1, respawnDays: 3 },
      { x: 2, y: 26, kind: 'item', id: 'r5-full-heal', item: 'fullHeal', qty: 1 },
      { x: 37, y: 6, kind: 'item', id: 'r5-tm-brick-break', item: 'tmBrickBreak', qty: 1 }, // đĩa kỹ năng hiếm
      { x: 37, y: 26, kind: 'item', id: 'r5-bike-wheel', item: 'bikeWheel', qty: 1, quest: 'bike' },
      { x: 2, y: 20, kind: 'item', id: 'r5-revive', item: 'revive', qty: 1 },
      { x: 26, y: 16, kind: 'item', id: 'r5-magnet', item: 'magnet', qty: 1 },
      { x: 25, y: 3, kind: 'item', id: 'r5-thunder-stone', item: 'thunderStone', qty: 1 },
    ],
  },

  // Đèn Lồng: phố cổ ô bàn cờ, nhà phố san sát, cột đèn lồng dọc phố (sáng lên ban đêm), quảng trường ở giữa
  town4: {
    name: 'Thành phố Đèn Lồng',
    // Phố đèn lồng: các cột đèn lồng cùng hàng nối nhau bằng dây đèn lồng nhỏ (gfx/decor.js)
    lanternGarlands: true,
    place: 'town4',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    martTier: 2,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT.....l....l....l....l....l....',
      'TT==============================',
      'TT......=..............=......TT',
      'TT......=..............=......TT',
      'TT......=..............=......TT',
      'TT......=..............=......TT',
      'TT......=..............=......TT',
      'TT..=...=..=....=...=..=..=..sTT',
      '==============================TT',
      '......sl=.....l..l.....=l.....TT',
      'TT......=l.....EEuEE..l=......TT',
      'TT......=..f========f..=......TT',
      'TT......=...========...=......TT',
      'TT......=..f========f..=......TT',
      'TT......=l............l=......TT',
      'TT..=...=..=...=...=...=..=...TT',
      'TT============================TT',
      'TT............................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    gates: [{ rect: [0, 10, 1, 11], badge: 'electric' }],
    warps: [
      { x: 31, y: 2, to: 'village3', tx: 1, ty: 2, facing: 'right' },
      { x: 31, y: 3, to: 'village3', tx: 1, ty: 3, facing: 'right' },
      { x: 0, y: 10, to: 'route6', tx: 46, ty: 4, facing: 'left' },
      { x: 0, y: 11, to: 'route6', tx: 46, ty: 5, facing: 'left' },
    ],
    buildings: [
      { type: 'center', x: 2, y: 5, w: 5, h: 4, door: { x: 4, y: 8 }, to: 'center4' },
      { type: 'mart', x: 10, y: 5, w: 4, h: 4, door: { x: 11, y: 8 }, to: 'mart4' },
      { type: 'bikeShop', x: 15, y: 5, w: 4, h: 4, door: { x: 16, y: 8 }, to: 'bikeShop', roof: 'houseRed' },
      { type: 'house', x: 19, y: 5, w: 4, h: 4, door: { x: 20, y: 8 }, to: null, roof: 'houseYellow' },
      { type: 'gym', x: 24, y: 5, w: 5, h: 4, door: { x: 26, y: 8 }, to: 'gym3', roof: 'gymElectric' },
      { type: 'house', x: 2, y: 13, w: 4, h: 4, door: { x: 4, y: 16 }, to: null, roof: 'houseYellow' },
      { type: 'house', x: 24, y: 13, w: 4, h: 4, door: { x: 26, y: 16 }, to: null, roof: 'houseRed' },
    ],
    signs: {
      '6,11': ['THÀNH PHỐ ĐÈN LỒNG', 'Phố cổ rực rỡ đèn lồng mỗi khi đêm xuống.'],
      '29,9': ['GYM ĐÈN LỒNG', 'Thủ lĩnh: Quang, người thắp sáng cả phố cổ.', 'Chuyên dùng Pokémon hệ Điện.'],
    },
    objects: [
      ...berryRow('t4', 28, 17, ['sitrus', 'figy']),
    ],
  },

  // Tuyến đường 6 - Ven Hồ Gương (48x28): hồ lớn chiếm nửa bắc, suối chảy về nam chia đôi tuyến, đi vòng quanh hồ.
  //  Vào từ Đèn Lồng ở góc đông bắc, men bờ đông xuống nam (bến câu nhô ra hồ là ngách cụt), qua cỏ cao, vòng dưới
  //  vịnh nhỏ, ngược lên dải đất giữa vịnh và suối, qua cầu gỗ; rừng thưa bờ tây chặn lối tắt nên phải băng bụi cỏ
  //  chân cầu xuống đường đất phía nam, rồi theo đường đất lên lối ra Làng Bến Đò.
  //  Cồn cát giữa hồ chỉ lướt nước mới tới được (có vật phẩm, kình ngư bơi quanh). Ngách: bãi cỏ tây bắc,
  //  bụi cỏ rậm tây nam, bãi đất đông nam sau hàng cây.
  route6: {
    name: 'Tuyến đường 6',
    place: 'route6',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTgggggggg..TTwwwwwwwwwwwwwwwwwwwwwwTT..OO....TT',
      'TTgggggggg..TTwwwwwwwwwwwwwwwwwwwwwwTT..OO..s.TT',
      'TTgggggggg..wwwwwwdddwwwwwwwwwwwwwwwww..========',
      'TTgggggggg..wwwwwdddddwwwwwwwwwwwwwwww..========',
      'TTgggggggg..wwwwwdddddwwwwwwwwwwwwwwww..==TTTTTT',
      'TTgggggggg..wwwwwwdddwwwwwwwwwwwwwwwww..==TTTTTT',
      'TT...k......wwwwwwwwwwwwwwwwwwwwbbbbbb..==TTTTTT',
      'TT..........wwwwwwwwwwwwwwwwwwwwbbbbbb..==TTTTTT',
      '==========..wwwwwwwwwwwwwwwwwwwwwwwwwws.==TTTTTT',
      '==========..wwwwwwwwwwwwwwwwwwwwwwwwww..==TTTTTT',
      'TTTTTTTT==..wwwwwwwwwwwwwwwwwwwwww......==....TT',
      'TTTTTTTT==..wwwwwwwwwwwwwwwwwwwwww......==....TT',
      'TTTTTTTT==TTTTTTggggggwwww..wwwwwwww..ggggggggTT',
      'TTTTTTTT==TTTTTTggggggwwww..wwwwwwww..ggggggggTT',
      'TTTTTTTT==TTTTTTggggggbbbb==wwwwwwww..ggggggggTT',
      'TTTTTTTT==TTTTTTggggggbbbb==wwwwwwww..ggggggggTT',
      'TTTTTTTT==TTTTTTggggggwwww==wwwwwwww..ggggggggTT',
      'TTTTTTTT==TTTTTTggggggwwww==wwwwwwww....==....TT',
      'TT......==============wwww==wwwwwwww....==..OOTT',
      'TT......==============wwww==wwwwwwww....==..OOTT',
      'TTGGGGGGGG....TTTTTTTTwwww================....TT',
      'TTGGGGGGGG....TTTTTTTTwwww================....TT',
      'TTGGGGGGGG....TTTTTTTTwwww...........k..XX....TT',
      'TTGGGGGGGG....TTTTTTTTwwww....................TT',
      'TTTTTTTTTTTTTTTTTTTTTTwwwwTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTwwwwTTTTTTTTTTTTTTTTTTTTTT',
    ],
    areas: [
      { name: 'Bụi cỏ rậm tây nam', rect: [2, 22, 9, 25], table: 'route6-deep' },
      { name: 'Bãi cỏ tây bắc', rect: [2, 2, 9, 7], table: 'route6-grass' },
      { name: 'Bụi cỏ chân cầu', rect: [16, 14, 21, 19], table: 'route6-grass' },
      { name: 'Bụi cỏ bờ đông', rect: [38, 14, 45, 18], table: 'route6-grass' },
    ],
    water: { name: 'Hồ Gương', surf: 'route6-surf', oldRod: 'route6-old', goodRod: 'route6-good', superRod: 'route6-super' },
    warps: [
      { x: 47, y: 4, to: 'town4', tx: 1, ty: 10, facing: 'right' },
      { x: 47, y: 5, to: 'town4', tx: 1, ty: 11, facing: 'right' },
      { x: 0, y: 10, to: 'village4', tx: 24, ty: 10, facing: 'left' },
      { x: 0, y: 11, to: 'village4', tx: 24, ty: 11, facing: 'left' },
    ],
    signs: {
      '44,3': ['TUYẾN ĐƯỜNG 6', '→ Thành phố Đèn Lồng   ← Làng Bến Đò', 'Đường men theo bờ Hồ Gương, qua cầu gỗ phía nam.'],
      '38,10': ['BẾN CÂU HỒ GƯƠNG', 'Thả câu ở cuối bến. Cồn cát giữa hồ chỉ lướt nước mới tới được.'],
    },
    objects: [
      ...berryRow('r6', 42, 12, ['oran', 'sitrus', 'leppa']),
      ...berryRow('r6', 10, 23, ['pecha', 'chesto']),
      { x: 13, y: 24, kind: 'item', id: 'route6-rare-candy', item: 'rareCandy', qty: 1, respawnDays: 3 },
      { x: 2, y: 24, kind: 'item', id: 'r6-full-heal', item: 'fullHeal', qty: 1 },
      { x: 32, y: 8, kind: 'item', id: 'r6-max-repel', item: 'maxRepel', qty: 1 },
      { x: 27, y: 24, kind: 'item', id: 'r6-bike-seat', item: 'bikeSeat', qty: 1, quest: 'bike' },
      { x: 19, y: 6, kind: 'item', id: 'r6-tm-sludge-bomb', item: 'tmSludgeBomb', qty: 1 }, // đĩa kỹ năng hiếm
      { x: 18, y: 5, kind: 'item', id: 'r6-mystic-water', item: 'mysticWater', qty: 1 },
      { x: 2, y: 2, kind: 'item', id: 'r6-water-stone', item: 'waterStone', qty: 1 },
    ],
  },

  // Sông Nước: sông chảy ngang thị trấn, hai cầu gỗ; bờ bắc có Center / Mart / Gym, bờ nam là nhà ven sông; lối tây nam sang Tuyến đường 7
  town5: {
    name: 'Thành phố Sông Nước',
    place: 'town5',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    martTier: 2,
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT.................OO.........TT',
      'TT.f.........f.....OO.......f.TT',
      'TT.................f..........TT',
      'TT............................TT',
      'TT............................TT',
      'TT....................PP=PP...TT',
      'TTaa=aaQa=aaa..=........=..f..TT',
      'TTaa=aaaa=aas..=........=..s..TT',
      'TT==============================',
      'TTfQEEu..==.EEQ......==QEEu.f...',
      'wwwwwwwwwbbwwwwwwwwwwbbwwwwwwwww',
      'wwwwwwwwwbbwwwwwwwwwwbbwwwwwwwww',
      'TTwwwwwwwbbwwwwwwwwwwbbwwwwwwwTT',
      'TT.......==..........==.......TT',
      'TT.......==..........==.......TT',
      'TT.......==..........==.......TT',
      '.........==..........==.......TT',
      '==============================TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    water: { name: 'Sông', surf: 'route6-surf', oldRod: 'route6-old', goodRod: 'route6-good', superRod: 'route6-super' },
    warps: [
      { x: 31, y: 10, to: 'village4', tx: 1, ty: 10, facing: 'right' },
      { x: 31, y: 11, to: 'village4', tx: 1, ty: 11, facing: 'right' },
      { x: 0, y: 18, to: 'route7', tx: 42, ty: 10, facing: 'left' },
      { x: 0, y: 19, to: 'route7', tx: 42, ty: 11, facing: 'left' },
    ],
    gates: [{ rect: [0, 18, 1, 19], badge: 'water' }],
    buildings: [
      { type: 'center', x: 2, y: 4, w: 5, h: 4, door: { x: 4, y: 7 }, to: 'center5' },
      { type: 'store', x: 8, y: 4, w: 4, h: 4, door: { x: 9, y: 7 }, to: 'store5' },
      { type: 'house', x: 14, y: 4, w: 4, h: 4, door: { x: 15, y: 7 }, to: null, roof: 'houseGreen' },
      { type: 'gym', x: 22, y: 3, w: 5, h: 4, door: { x: 24, y: 6 }, to: 'gym4', roof: 'gymWater' },
      { type: 'house', x: 3, y: 15, w: 4, h: 4, door: { x: 4, y: 18 }, to: null },
      { type: 'house', x: 13, y: 15, w: 4, h: 4, door: { x: 14, y: 18 }, to: null, roof: 'houseYellow' },
      { type: 'house', x: 24, y: 15, w: 4, h: 4, door: { x: 25, y: 18 }, to: null, roof: 'houseGreen' },
    ],
    signs: {
      '12,9': ['THÀNH PHỐ SÔNG NƯỚC', 'Kênh rạch chằng chịt, ghe xuồng tấp nập.'],
      '27,9': ['GYM SÔNG NƯỚC', 'Thủ lĩnh: Thủy, dịu dàng như dòng sông.', 'Chuyên dùng Pokémon hệ Nước.'],
    },
  },

  // Tiệm xe đạp Đèn Lồng: xe bày trên kệ, ông chủ đứng sau quầy
  bikeShop: {
    name: 'Tiệm xe đạp',
    indoor: true,
    theme: 'mart',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###########',
      '###########',
      '..kk...kk..',
      'cc.........',
      '...........',
      '.kk.....kk.',
      '...........',
      'p..EE.....p',
    ],
    shelfGoods: 'bikes', // kệ 'k' trưng bày xe đạp (gfx/interior.js)
    entry: { x: 3, y: 6 },
  },

  // Trung tâm thương mại Sông Nước: quầy tạp hoá (trái), quầy đá tiến hoá (phải), bán và mua lại mọi thứ
  store5: {
    name: 'Trung tâm thương mại',
    indoor: true,
    theme: 'mart',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###############',
      '###############',
      '...........kk.k',
      'cccc...cccc....',
      '...............',
      '.kk.kk...kk.kk.',
      '.kk.kk...kk.kk.',
      '...............',
      '.....p...p.....',
      '.......E.......',
    ],
    entry: { x: 7, y: 8 },
  },



};
