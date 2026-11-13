// Dữ liệu bổ sung khi mở rộng bản đồ (phần ch3): nhà huấn luyện, NPC, bảng Pokémon hoang dã cho các khu mới.
// Định dạng giống TRAINERS / NPCS trong data/npcs.js và ENCOUNTERS trong data/encounters.js.
// Tuyến đường 4 (Đồng Gió Lúa), 5 (Bãi Đá Trạm Điện), 6 (Ven Hồ Gương): bố cục xem data/mapsChapter3.js.
export const TRAINERS = [
  // Tuyến đường 4: bác nông dân trông ruộng bậc thang (đứng trên bãi cỏ phía trên ruộng, nhìn xuống đường đất)
  {
    id: 'r4-farmer', sprite: 'npc-oldman', name: 'Bác Tám', map: 'route4', x: 34, y: 2, facing: 'down', sight: 2,
    team: [['growlithe', 18], ['gloom', 19]], prize: 22,
    intro: 'Đi hết bờ ruộng mà không giẫm lúa, cháu khá lắm! Đấu với bác một trận nào!',
    lose: 'Già rồi, chân yếu tay run...',
    after: 'Growlithe của bác canh ruộng giỏi lắm, chuột đồng không dám bén mảng.',
  },
  // Tuyến đường 4: chị đi dã ngoại cạnh bãi chăn ngựa, chặn đường đất trước lối ra
  {
    id: 'r4-picnicker', sprite: 'npc-girl', name: 'Chị Thu', map: 'route4', x: 40, y: 19, facing: 'left', sight: 2,
    team: [['pikachu', 18], ['pidgeotto', 19]], prize: 18,
    intro: 'Chị đang ngắm Ponyta gặm cỏ thì em tới. Đấu một trận cho vui nhé!',
    lose: 'Ôi, chị mải ngắm ngựa quá!',
    after: 'Qua Xóm Cối Xay phía đông là tới Thành phố Lúa Vàng đó.',
  },
  // Tuyến đường 5: dân leo núi ở vườn đá bậc 1
  {
    id: 'r5-hiker', sprite: 'npc-hiker', name: 'Anh Thạch', map: 'route5', x: 26, y: 26, facing: 'up', sight: 4,
    team: [['geodude', 21], ['onix', 22]], prize: 26,
    intro: 'Bãi đá này anh leo cả trăm lần rồi! Đá của anh cứng lắm đấy!',
    lose: 'Đá cũng phải vỡ...',
    after: 'Đường lên dốc ở phía đông. Từ trên cao nhảy gờ xuống là về nhanh lắm.',
  },
  // Tuyến đường 5: thợ điện đứng cạnh dốc lên bậc 2
  {
    id: 'r5-lineman', sprite: 'npc-guide', name: 'Thợ điện Hùng', map: 'route5', x: 33, y: 16, facing: 'right', sight: 4,
    team: [['pikachu', 21], ['voltorb', 22], ['magnemite', 22]], prize: 28,
    intro: 'Khu này điện cao thế, đi đâu mà vội! Đấu với anh đã!',
    lose: 'Mất điện rồi!',
    after: 'Trạm biến áp có cổng ở phía bắc, kỹ sư Minh trực trong đó.',
  },
  // Tuyến đường 6: anh cắm trại ở bờ tây Hồ Gương
  {
    id: 'r6-camper', sprite: 'npc-camper', name: 'Anh Khoa', map: 'route6', x: 7, y: 20, facing: 'right', sight: 2,
    team: [['pidgeotto', 25], ['weepinbell', 26]], prize: 22,
    intro: 'Cắm trại bên hồ mà gặp đối thủ thì còn gì bằng!',
    lose: 'Lửa trại tắt ngúm rồi...',
    after: 'Sáng sớm mặt hồ phẳng như gương, đẹp lắm.',
  },
];

export const NPCS = [
  // Ponyta gặm cỏ trong bãi chăn có rào ở Tuyến đường 4 (vào qua cổng phía tây)
  {
    id: 'r4-ponyta', mon: 'ponyta', name: 'Ponyta', map: 'route4', x: 42, y: 9, facing: 'left', wander: 1,
    lines: ['Hí hí!', '(Ponyta đang thong thả gặm cỏ, bờm lửa bập bùng.)'],
  },
  {
    id: 'r4-rancher', sprite: 'npc-oldman', name: 'Ông chủ bãi ngựa', map: 'route4', x: 41, y: 11, facing: 'up', wander: 0,
    lines: [
      'Bãi chăn này của ông. Ponyta ăn cỏ đồng Gió Lúa nên chạy nhanh như gió!',
      'Ruộng bậc thang ở phía tây chỉ đi được trên bờ ruộng thôi, ngoằn ngoèo nhưng đừng giẫm lúa nhé.',
    ],
  },
];

export const ENCOUNTERS = {
  // Bãi đá cao trên Tuyến đường 5: Pokémon hệ Đá trú giữa đá tảng, Pokémon hệ Điện kéo về từ trạm biến áp
  'route5-rocks': [
    { species: 'geodude', min: 21, max: 23, weight: 30 },
    { species: 'magnemite', min: 22, max: 24, weight: 25 },
    { species: 'voltorb', min: 22, max: 24, weight: 20 },
    { species: 'onix', min: 22, max: 24, weight: 10, time: 'dusk' },
    { species: 'pikachu', min: 22, max: 24, weight: 10, time: 'day' },
    { species: 'graveler', min: 25, max: 25, weight: 5, time: 'night' },
    { species: 'diglett', min: 21, max: 23, weight: 10 },
    { species: 'sandslash', min: 22, max: 24, weight: 5 },
  ],
};
