import { INDOOR_TILES } from './tiles.js';

// 8 gym của vùng Sơn Thủy, mỗi gym một kiểu câu đố riêng (bố cục và lời giải đã kiểm tra bằng bộ giải trong test).
// Ký tự ô: xem data/tiles.js. Đồ vật: gate (cổng, mở khi có cờ flag; look: hình) • switch (công tắc bật cờ) •
//   barrier (nhóm A hiện khi cờ tắt, nhóm B hiện khi cờ bật; look: hình) • toggle (công tắc đổi cờ bật / tắt) •
//   lantern (cột đèn lồng, nói chuyện để thắp, gym tối)
// pads: ô dịch chuyển Q { x, y, tx, ty } • boulders: tảng đá đẩy được [x, y] (lấp hố O) • dark: gym tối
// toggleLine / switchLine / barrierLine / gateLine / trapLine: câu báo riêng của gym

// Thủ lĩnh đứng ở (8, 2), lối vào giữa phía dưới (thảm E)
const gym = (name, theme, rows, entry, extra = {}) => ({ name, indoor: true, theme, tiles: INDOOR_TILES, fallback: '#', rows, entry, objects: [], ...extra });

export const GYM_MAPS = {
  // Gym Đồi Gió: sân thượng lộng gió nhiều tầng. Hàng gió (v) thổi người chơi rơi xuống tầng dưới, chỉ vài ô gió ngược (^)
  // đưa lên tầng trên; luồng gió ngang (< >) cuốn đi tới khi gặp vật cản. Phải chọn đúng luồng gió mới lên tới thủ lĩnh.
  gym1: {
    ...gym('Gym Đồi Gió', 'gym', [
      '#################',
      '#################',
      '.................',
      '.o.....o.o.....o.',
      'vvvvvvvv.vvvvvvvv',
      '..o..............',
      '.<<<<<<<<.>>>>>>.',
      '...........o.....',
      'vvvvvvvvvvv^vvv^v',
      '.o.o.............',
      '.......>>>>>>>v..',
      '..o...^.......v..',
      '......^..o....v..',
      'vv^vvv^vvvvvvvvvv',
      '..o......<<<<<<..',
      '.................',
      '.....>>>>v....o..',
      '.........v.......',
      '.o.......v.....o.',
      '........E........',
    ], { x: 8, y: 18 }),
  },
  // Gym Lúa Vàng: mê cung hàng rào tre 3 phòng. Cổng tre liên kết: mỗi công tắc mở một số cổng nhưng đóng cổng khác
  // (cổng nhóm A / B theo cờ). Phải dẫm công tắc đúng thứ tự: phòng 1 -> phòng 2 bên phải -> phòng 2 bên trái.
  gym2: {
    ...gym('Gym Lúa Vàng', 'gymGrass', [
      '#################',
      '#################',
      '.................',
      '..H...........H..',
      'HHHHHHHH.HHHHHHHH',
      'HHHHHHHH.HHHHHHHH',
      'H...............H',
      'H.......H.......H',
      'H...HH..H..HH...H',
      'H.......H.......H',
      'HHHHH.HHHHHH.HHHH',
      '........H.......H',
      '.HHHH...H.......H',
      '.....H..H.......H',
      'HHH.HHHHHH.HHHHHH',
      '.................',
      '..H...........H..',
      '.................',
      '........E........',
    ], { x: 8, y: 17 }),
    objects: [
      { x: 8, y: 4, kind: 'barrier', group: 'A', flag: 'gym2:q', id: 'gym2-barrier1', look: 'gate' },
      { x: 8, y: 5, kind: 'barrier', group: 'B', flag: 'gym2:p', id: 'gym2-barrier2', look: 'gate' },
      { x: 12, y: 10, kind: 'barrier', group: 'A', flag: 'gym2:p', id: 'gym2-barrier3', look: 'gate' },
      { x: 10, y: 14, kind: 'barrier', group: 'B', flag: 'gym2:p', id: 'gym2-barrier4', look: 'gate' },
      { x: 14, y: 12, kind: 'toggle', flag: 'gym2:p', id: 'gym2-toggle5' },
      { x: 2, y: 7, kind: 'toggle', flag: 'gym2:q', id: 'gym2-toggle6' },
      { x: 14, y: 7, kind: 'toggle', flag: 'gym2:p', id: 'gym2-toggle7' },
      { x: 5, y: 10, kind: 'barrier', group: 'A', flag: 'gym2:q', id: 'gym2-barrier8', look: 'gate' },
    ],
    resetFlags: ['gym2:p', 'gym2:q'],
    toggleLine: 'Cạch! Các cổng tre đóng mở đổi chỗ.',
    barrierLine: 'Cổng tre đóng chặt. Phải tìm công tắc.',
  },
  // Gym Đèn Lồng: gym tối om, chỉ thấy quanh người; thắp đèn lồng (nói chuyện với cột đèn) để soi sáng cả vùng.
  // Hàng rào điện nhóm A / B đổi chỗ mỗi khi dẫm công tắc: phải bật / tắt điện đúng lúc ở phòng tây, phòng đông
  // rồi tầng trên. resetFlags: vào lại gym thì về trạng thái ban đầu (không bị kẹt).
  gym3: {
    ...gym('Gym Đèn Lồng', 'gymElectric', [
      '#################',
      '#################',
      '.................',
      '.................',
      'ZZZZZZZZ.ZZZZZZZZ',
      'Z...............Z',
      'Z.ZZZZZ...ZZZZZ.Z',
      'Z.Z...Z...Z...Z.Z',
      'Z...Z.....Z.....Z',
      'ZZZZZZZZZZZZ.ZZZZ',
      'Z.......Z.......Z',
      'Z.ZZZZ..Z..ZZZZ.Z',
      'Z.Z.....Z.....Z.Z',
      'Z...ZZZ.Z.ZZZ...Z',
      'ZZZ.ZZZZZZZZZ.ZZZ',
      '.................',
      '..Z...........Z..',
      '.................',
      '........E........',
    ], { x: 8, y: 17 }),
    objects: [
      { x: 13, y: 14, kind: 'barrier', group: 'A', flag: 'gym3:power', id: 'gym3-barrier1' },
      { x: 3, y: 12, kind: 'toggle', flag: 'gym3:power', id: 'gym3-toggle2' },
      { x: 13, y: 12, kind: 'toggle', flag: 'gym3:power', id: 'gym3-toggle3' },
      { x: 12, y: 9, kind: 'barrier', group: 'B', flag: 'gym3:power', id: 'gym3-barrier4' },
      { x: 12, y: 7, kind: 'toggle', flag: 'gym3:power', id: 'gym3-toggle5' },
      { x: 4, y: 7, kind: 'toggle', flag: 'gym3:power', id: 'gym3-toggle6' },
      { x: 8, y: 4, kind: 'barrier', group: 'A', flag: 'gym3:power', id: 'gym3-barrier7' },
      { x: 1, y: 16, kind: 'lantern', id: 'gym3-lantern1' },
      { x: 15, y: 16, kind: 'lantern', id: 'gym3-lantern2' },
      { x: 1, y: 10, kind: 'lantern', id: 'gym3-lantern3' },
      { x: 15, y: 12, kind: 'lantern', id: 'gym3-lantern4' },
      { x: 3, y: 3, kind: 'lantern', id: 'gym3-lantern5' },
      { x: 13, y: 3, kind: 'lantern', id: 'gym3-lantern6' },
    ],
    resetFlags: ['gym3:power'],
    dark: true,
    toggleLine: 'Bzzzt! Các hàng rào điện đổi chỗ.',
  },
  // Gym Sông Nước: các đảo đá giữa hồ sâu (~). Dòng nước (mũi tên) cuốn người chơi giữa các đảo; xoáy nước (x) cuốn
  // về lối vào. Hai cửa cống đóng các dòng chảy chính: công tắc cống 1 ở đảo đông, công tắc cống 2 ở đảo tây.
  // Dòng nước sát mép tây chảy thẳng từ chỗ thủ lĩnh xuống lối vào (đường về, không giúp đi lên).
  gym4: {
    ...gym('Gym Sông Nước', 'gymWater', [
      '#################',
      '#################',
      '.................',
      'v........<<<<~~~~',
      'v~~~~~~~~~~~^~~~~',
      'v~~>>>>>>>>.....~',
      'v~~^~~~~~~~.....~',
      'v~~^~~~~~x<.....~',
      'v~~^~~~~~~~~~~~~~',
      'v....~~~~~~.....~',
      'v....~~~~~~.....~',
      'v.....~~~x<<~v~^~',
      'v~^~~~~~~~~^~v~^~',
      'v~^~~~~~~~~^~v~^~',
      '.................',
      '..~...........~..',
      '.................',
      '........E........',
    ], { x: 8, y: 16 }),
    objects: [
      { x: 12, y: 9, kind: 'switch', flag: 'gym4:gate1', id: 'gym4-switch1' },
      { x: 3, y: 8, kind: 'gate', flag: 'gym4:gate1', id: 'gym4-gate2', look: 'sluice' },
      { x: 1, y: 10, kind: 'switch', flag: 'gym4:gate2', id: 'gym4-switch3' },
      { x: 12, y: 4, kind: 'gate', flag: 'gym4:gate2', id: 'gym4-gate4', look: 'sluice' },
    ],
    switchLine: 'Rầm! Cửa cống mở ra, dòng nước chảy thông.',
    gateLine: 'Cửa cống đóng chặt, nước không chảy qua được.',
    trapLine: 'Ối! Xoáy nước cuốn bạn trôi về lối vào!',
  },
  // Gym Lò Gốm: 4 hàng miệng phun lửa (X / Y) thay phiên phụt lửa theo nhịp, hai bên là than hồng (x). Mỗi hàng chỉ
  // có miệng lửa ở một phía nên phải đi zíc zắc và canh lúc lửa tắt; dẫm than hay đứng ở miệng đang phụt lửa là về lối vào.
  gym5: {
    ...gym('Gym Lò Gốm', 'gymFire', [
      '#################',
      '#################',
      '.................',
      '.K.............K.',
      'xxxxxxxxxxxXYXYXY',
      '.................',
      '..K...K...K...K..',
      'YXYXYxxxxxxxxxxxx',
      '.................',
      '.K.............K.',
      'xxxxxxxxxxxYXYXYX',
      '.................',
      '..K...K...K...K..',
      'xxxxXYXYXYXYXxxxx',
      '.................',
      '..K...........K..',
      '.................',
      '........E........',
    ], { x: 8, y: 16 }),
    vents: true,
    trapLine: 'Á, nóng quá! Bị lửa táp, phải chạy ngay ra lối vào!',
  },
  // Gym Núi Đá: đẩy tảng đá (boulders) lấp hố (O) để làm đường như chiêu Strength. Đẩy đá vào góc thì kẹt:
  // ra ngoài vào lại là đá về chỗ cũ.
  gym6: {
    ...gym('Gym Núi Đá', 'gymRock', [
      '#################',
      '#################',
      '.................',
      '.o.............o.',
      'oooooooo.oooooooo',
      'oo.....o.o.....oo',
      'oo.............oo',
      'oo..o.......o..oo',
      'oooooo.OOO.oooooo',
      'oo.............oo',
      'oo.oo.......oo.oo',
      'oo.............oo',
      'ooooooooOoooooooo',
      '.................',
      '..o...........o..',
      '.................',
      '........E........',
    ], { x: 8, y: 15 }),
    boulders: [[6, 14], [8, 6], [8, 10], [10, 9]],
  },
  // Gym Chùa Cổ: 7 phòng ngăn bằng tường, chỉ nối nhau bằng ô dịch chuyển. Có ô dẫn vào ngõ cụt hoặc về phòng đầu;
  // đường đúng: phòng đầu (phải) -> dưới phải -> giữa trái -> giữa phải (khu đông) -> phòng thủ lĩnh.
  // Phòng thủ lĩnh có một ô đưa về phòng đầu.
  gym7: {
    ...gym('Gym Chùa Cổ', 'gymPsychic', [
      '#################',
      '#################',
      '.................',
      '..............Q..',
      '.................',
      '#################',
      '......Q.#Q..#..Q.',
      '........#...#....',
      '........#...#....',
      '..Q.....#..Q#....',
      '#################',
      '......Q.#......Q.',
      '........#........',
      '.Q......#.Q......',
      '#################',
      '.................',
      '...Q.........Q...',
      '.................',
      '........E........',
    ], { x: 8, y: 17 }),
    pads: [
      { x: 3, y: 16, tx: 2, ty: 12 },
      { x: 13, y: 16, tx: 14, ty: 12 },
      { x: 6, y: 11, tx: 10, ty: 7 },
      { x: 1, y: 13, tx: 4, ty: 16 },
      { x: 10, y: 13, tx: 1, ty: 7 },
      { x: 15, y: 11, tx: 12, ty: 16 },
      { x: 6, y: 6, tx: 12, ty: 12 },
      { x: 2, y: 9, tx: 14, ty: 9 },
      { x: 15, y: 6, tx: 8, ty: 4 },
      { x: 11, y: 9, tx: 8, ty: 16 },
      { x: 9, y: 6, tx: 6, ty: 12 },
      { x: 14, y: 3, tx: 8, ty: 16 },
    ],
    // Đã có huy hiệu: hai ô ở phòng đầu đưa thẳng lên phòng thủ lĩnh
    clearedPads: [
      { x: 3, y: 16, tx: 8, ty: 4 },
      { x: 13, y: 16, tx: 8, ty: 4 },
    ],
    clearLine: 'Các ô dịch chuyển ở phòng đầu giờ đưa thẳng lên phòng thủ lĩnh.',
  },
  // Gym Sương Mù: hai sân băng. Bước lên băng là trượt tới khi đụng tảng băng; phải tìm đúng các điểm dừng để vào
  // khe lên bục giữa, rồi qua sân băng trên lên tới thủ lĩnh. Tảng băng (4, 8) là điểm dừng cho đường về.
  gym8: {
    ...gym('Gym Sương Mù', 'gymIce', [
      '#################',
      '#################',
      '.................',
      'oooooooo.oooooooo',
      'iiiiiiioiiiiiiiii',
      'iiiiiiiiiiiiiiiio',
      'iiiiioiiiiiiiiiii',
      'iiiiiiiiiiiioiiii',
      'iiiioiiiiiiiiiiii',
      'ooooo.ooooooooooo',
      '.................',
      'ooooooooooo.ooooo',
      'iiiiiiiiiiiioiiii',
      'iioiiiiiiiiiiiiii',
      'iiiiiiiioiiiiiiii',
      'iiiiiiiiiiioiiiii',
      'iiiiiiiiiiiiiiioi',
      'iiiiiiiiiiiiiiiii',
      '.................',
      '........E........',
    ], { x: 8, y: 18 }),
  },
};

// Đã thắng thủ lĩnh (có huy hiệu): câu đố ngừng hoạt động để đi lại thoải mái (GameMap.cleared, data/map.js).
// Cổng / hàng rào biến mất, gym tối sáng đèn, miệng lò tắt, hố đã lấp, băng hết trơn, than hồng / xoáy nước thành ô cản;
// windy: luồng gió (ô mũi tên) cũng tắt (Gym Sông Nước giữ dòng nước vì đó là đường duy nhất giữa các đảo).
const AFTER_BADGE = {
  gym1: ['wind', 'Quạt gió trong gym đã tắt, giờ đi lại thoải mái giữa các tầng.', { windy: true }],
  gym2: ['grass', 'Các cổng tre đều đã mở.'],
  gym3: ['electric', 'Đèn trong gym bật sáng trở lại, hàng rào điện đã ngắt.'],
  gym4: ['water', 'Cửa cống đã mở hết, xoáy nước không còn cuốn người về lối vào nữa.'],
  gym5: ['fire', 'Các miệng lò đã ngừng phụt lửa.'],
  gym6: ['rock', 'Các hố trong gym đã được lấp phẳng.'],
  gym7: ['psychic', null],
  gym8: ['ice', 'Sân băng đã được rắc cát, đi không còn trơn trượt.'],
};
for (const [id, [badge, clearLine, extra]] of Object.entries(AFTER_BADGE)) {
  const g = GYM_MAPS[id];
  Object.assign(g, { badge, clearLine: g.clearLine ?? clearLine }, extra);
  for (const o of g.objects) o.badge = badge;
}
