// Dữ liệu bổ sung khi mở rộng bản đồ (phần villagesA): nhà huấn luyện, NPC, bảng Pokémon hoang dã cho các khu mới.
// Định dạng giống TRAINERS / NPCS trong data/npcs.js và ENCOUNTERS trong data/encounters.js.
// Khu mới: Đồng Cối Xay (field2), Đồi Cột Điện (hill3), Đầm Lau (marsh4), Mỏ Đất Sét (pit5): data/mapsVillageAreasA.js

export const TRAINERS = [
  // Đồng Cối Xay: cấp ngang Tuyến đường 4, trước Gym Lúa Vàng
  {
    id: 'f2-lass', sprite: 'npc-lass', name: 'Chị Cấy', map: 'field2', x: 19, y: 10, facing: 'right', sight: 4,
    team: [['bellsprout', 18], ['oddish', 19]], prize: 18,
    intro: 'Đang cấy dở thì có người lội qua bờ ruộng! Đấu một trận rồi hẵng đi!',
    lose: 'Ruộng chưa cấy xong mà thua mất rồi...',
    after: 'Bầy Pokémon cỏ tha thóc chạy về kho thóc cũ góc tây bắc. Phải vòng lên bờ bắc mới tới.',
  },
  {
    id: 'f2-youngster', sprite: 'npc-youngster', name: 'Nhóc chăn trâu Bin', map: 'field2', x: 26, y: 21, facing: 'left', sight: 4,
    team: [['rattata', 18], ['ekans', 18], ['pidgeotto', 19]], prize: 16,
    intro: 'Trâu nhà em đang gặm cỏ, em rảnh nè. Đấu đi!',
    lose: 'Thua rồi... về lại bị mẹ mắng vì mải chơi.',
    after: 'Cuối bờ ruộng này có ai đánh rơi túi bóng đó.',
  },
  // Đồi Cột Điện: cấp ngang Tuyến đường 5, trước Gym Đèn Lồng
  {
    id: 'h3-lineman', sprite: 'npc-guide', name: 'Thợ điện Hùng', map: 'hill3', x: 25, y: 2, facing: 'down', sight: 5,
    team: [['magnemite', 22], ['voltorb', 23]], prize: 30,
    intro: 'Đồi này toàn dây điện hở, ai cho cậu lên đây? Đấu đã!',
    lose: 'Bị giật ngược rồi!',
    after: 'Vách đá chỉ có một khe xuống bậc dưới, ở tận đầu bên kia. Đi từ từ thôi.',
  },
  {
    id: 'h3-camper', sprite: 'npc-camper', name: 'Trại viên Sơn', map: 'hill3', x: 20, y: 17, facing: 'down', sight: 5,
    team: [['pikachu', 22], ['growlithe', 23]], prize: 22,
    intro: 'Tối qua đồi sáng rực tia lửa điện, tớ ở lại xem có gì hay. Đấu thôi!',
    lose: 'Pokémon của tớ tê rần cả rồi...',
    after: 'Có con Magneton cứ lởn vởn ở trạm phát cũ dưới chân đồi, phía tây ấy.',
  },
  // Đầm Lau: cấp ngang Tuyến đường 6, trước Gym Sông Nước
  {
    id: 'm4-fisher', sprite: 'npc-fisher', name: 'Ngư dân Lưới', map: 'marsh4', x: 28, y: 6, facing: 'right', sight: 5,
    team: [['goldeen', 26], ['poliwhirl', 27]], prize: 24,
    intro: 'Đầm này dạo này cá chẳng cắn câu, toàn vì con Gyarados kia! Đấu cho đỡ cáu đã!',
    lose: 'Lưới rách rồi...',
    after: 'Anh thả bè mắc kẹt trên cồn cát giữa đầm. Cầu ván sang đó ở bờ tây, mà Gyarados nằm chắn mất.',
  },
  {
    id: 'm4-youngster', sprite: 'npc-youngster', name: 'Nhóc bắt bọ Tèo', map: 'marsh4', x: 2, y: 24, facing: 'right', sight: 3,
    team: [['weepinbell', 26], ['psyduck', 26]], prize: 16,
    intro: 'Lau sậy rậm thế này kiểu gì cũng có Pokémon hiếm! Mà gặp anh chị trước, đấu đã!',
    lose: 'Ơ, thua nhanh thế...',
    after: 'Đi dọc mé tây lên tới bờ đầm là thấy cầu ván ra cồn cát.',
  },
  // Mỏ Đất Sét: cấp ngang Tuyến đường 7, trước Gym Lò Gốm
  {
    id: 'p5-hiker', sprite: 'npc-hiker', name: 'Thợ mỏ Đá', map: 'pit5', x: 20, y: 2, facing: 'down', sight: 2,
    team: [['geodude', 31], ['onix', 32]], prize: 30,
    intro: 'Mỏ này của làng, tôi canh ở đây không cho bọn buôn lậu đào thêm! Mà cậu là ai?',
    lose: 'Thì ra cậu tới giúp làng. Xin lỗi nhé!',
    after: 'Lối xuống hầm chính ở phía tây kia. Tên Tài giữ chú Sét dưới đó.',
  },
  {
    id: 'p5-lass', sprite: 'npc-lass', name: 'Cô thợ gốm Nhàn', map: 'pit5', x: 3, y: 12, facing: 'down', sight: 3,
    team: [['ponyta', 30], ['vulpix', 31]], prize: 20,
    intro: 'Tôi vào lấy ít đất nặn bình thì lạc đường. Đấu một trận cho đỡ sợ đã!',
    lose: 'Lò gốm nhà tôi còn nóng hơn thế này...',
    after: 'Hầm này cụt rồi. Đường vào hầm chính phải đi vòng sang phía đông.',
  },
];

export const NPCS = [
  {
    id: 'f2-farmer', sprite: 'npc-woman', name: 'Bà Ba', map: 'field2', x: 21, y: 28, facing: 'left', fixed: true,
    lines: [
      'Sáng nay thằng Cốm nhà bác thợ xay vác chĩa lên đồng đuổi bầy Pokémon cỏ, mãi chưa thấy về.',
      'Bầy đó tha thóc về kho thóc cũ góc tây bắc. Cầu phía tây chỉ sang bãi cỏ dại thôi, muốn lên kho phải qua cầu phía đông.',
    ],
  },
  {
    id: 'h3-oldman', sprite: 'npc-oldman', name: 'Bác gác trạm', map: 'hill3', x: 13, y: 2, facing: 'down', fixed: true,
    lines: [
      'Đêm qua trạm biến áp nổ đánh đùng, bọn Pokémon hệ Điện hoảng loạn chạy hết lên đồi này.',
      'Cầu chì dự phòng cất ở trạm phát cũ dưới chân đồi, chắc bị chúng làm văng tung toé rồi.',
      'Mỗi vách đá chỉ có một khe xuống, cứ men theo mà đi.',
    ],
  },
  {
    id: 'm4-washer', sprite: 'npc-woman', name: 'Cô giặt đồ', map: 'marsh4', x: 22, y: 26, facing: 'left', fixed: true,
    lines: [
      'Bè gỗ làng đặt về sửa cầu mắc cạn trên cồn cát giữa đầm rồi.',
      'Con Gyarados hung dữ nằm chắn cầu ván ra cồn, anh thả bè kẹt ngoài đó từ hôm qua.',
      'Cầu ván sang bờ tây ở mãi phía bắc, men theo lau sậy mà đi.',
    ],
  },
  {
    id: 'p5-miner', sprite: 'npc-hiker', name: 'Bác thợ đào Mão', map: 'pit5', x: 10, y: 24, facing: 'left', fixed: true,
    lines: [
      'Hai tên buôn đất lậu chiếm mỏ, trói chú Sét thợ cả nhốt trong hầm chính giữa mỏ.',
      'Đường xuống hầm chính phải đi vòng: sang đông, lên bắc rồi quay về tây. Hầm phía tây kia là đường cụt đấy.',
    ],
  },
];

// Bảng Pokémon hoang dã (time: chỉ gặp vào buổi đó, xem data/encounters.js). Buổi nào mỗi khu cũng có ít nhất 2 loài
export const ENCOUNTERS = {
  field2: [
    { species: 'oddish', min: 17, max: 19, weight: 25, time: 'night' },
    { species: 'bellsprout', min: 17, max: 19, weight: 25 },
    { species: 'pidgeotto', min: 18, max: 20, weight: 15, time: 'day' },
    { species: 'meowth', min: 17, max: 19, weight: 15, time: 'dusk' },
    { species: 'ekans', min: 17, max: 19, weight: 10 },
    { species: 'raticate', min: 18, max: 19, weight: 10, time: 'night' },
    { species: 'farfetchd', min: 17, max: 19, weight: 10, time: 'day' },
    { species: 'doduo', min: 17, max: 19, weight: 8 },
  ],
  'field2-deep': [
    { species: 'oddish', min: 19, max: 20, weight: 20 },
    { species: 'weepinbell', min: 20, max: 21, weight: 20 },
    { species: 'pidgeotto', min: 20, max: 21, weight: 20, time: 'day' },
    { species: 'growlithe', min: 19, max: 20, weight: 20, time: 'dusk' },
    { species: 'gloom', min: 20, max: 21, weight: 15, time: 'night' },
    { species: 'eevee', min: 19, max: 19, weight: 5 },
    { species: 'farfetchd', min: 19, max: 20, weight: 8 },
    { species: 'exeggcute', min: 19, max: 20, weight: 8, time: 'night' },
  ],
  hill3: [
    { species: 'magnemite', min: 21, max: 23, weight: 25 },
    { species: 'voltorb', min: 21, max: 23, weight: 25 },
    { species: 'pikachu', min: 21, max: 23, weight: 20, time: 'day' },
    { species: 'pidgeotto', min: 22, max: 24, weight: 15, time: 'dusk' },
    { species: 'raticate', min: 22, max: 24, weight: 15, time: 'night' },
    { species: 'electabuzz', min: 22, max: 24, weight: 5 },
  ],
  'hill3-deep': [
    { species: 'magnemite', min: 23, max: 24, weight: 25 },
    { species: 'pikachu', min: 23, max: 24, weight: 20, time: 'day' },
    { species: 'voltorb', min: 23, max: 24, weight: 20 },
    { species: 'growlithe', min: 23, max: 24, weight: 15, time: 'dusk' },
    { species: 'raticate', min: 23, max: 24, weight: 15, time: 'night' },
    { species: 'eevee', min: 22, max: 22, weight: 5 },
    { species: 'electabuzz', min: 23, max: 24, weight: 6 },
    { species: 'porygon', min: 23, max: 24, weight: 4, time: 'dusk' },
  ],
  marsh4: [
    { species: 'psyduck', min: 24, max: 26, weight: 25 },
    { species: 'slowpoke', min: 24, max: 26, weight: 20, time: 'day' },
    { species: 'poliwhirl', min: 25, max: 27, weight: 20, time: 'dusk' },
    { species: 'weepinbell', min: 25, max: 27, weight: 15, time: 'night' },
    { species: 'pidgeotto', min: 25, max: 27, weight: 10, time: 'day' },
    { species: 'gloom', min: 25, max: 27, weight: 10, time: 'night' },
    { species: 'tangela', min: 24, max: 26, weight: 8 },
    { species: 'parasect', min: 25, max: 27, weight: 6, time: 'night' },
  ],
  'marsh4-deep': [
    { species: 'poliwhirl', min: 27, max: 28, weight: 25 },
    { species: 'slowpoke', min: 26, max: 28, weight: 25 },
    { species: 'arbok', min: 26, max: 28, weight: 20 },
    { species: 'gloom', min: 27, max: 28, weight: 15, time: 'night' },
    { species: 'golduck', min: 28, max: 29, weight: 10, time: 'dusk' },
    { species: 'eevee', min: 25, max: 25, weight: 5 },
    { species: 'tangela', min: 26, max: 28, weight: 8 },
    { species: 'parasect', min: 26, max: 28, weight: 6, time: 'night' },
  ],
  // Hang: loài nào cũng có cả ngày
  pit5: [
    { species: 'geodude', min: 30, max: 32, weight: 25 },
    { species: 'graveler', min: 31, max: 33, weight: 20 },
    { species: 'onix', min: 30, max: 33, weight: 15 },
    { species: 'rhyhorn', min: 30, max: 32, weight: 15 },
    { species: 'golbat', min: 31, max: 33, weight: 15 },
    { species: 'machop', min: 30, max: 31, weight: 10 },
    { species: 'cubone', min: 30, max: 32, weight: 10 },
    { species: 'diglett', min: 30, max: 32, weight: 8 },
    { species: 'dugtrio', min: 31, max: 33, weight: 5 },
  ],
};
