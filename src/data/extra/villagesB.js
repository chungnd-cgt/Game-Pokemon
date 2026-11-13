// Dữ liệu bổ sung khi mở rộng bản đồ (phần villagesB): nhà huấn luyện, NPC, bảng Pokémon hoang dã cho các khu mới.
// Định dạng giống TRAINERS / NPCS trong data/npcs.js và ENCOUNTERS trong data/encounters.js.
// Khu mới (data/mapsVillageAreasB.js): quarry6 Mỏ Đá Vách Núi • grave7 Nghĩa Trang Rừng Trúc • pass8 Đèo Tuyết.
// Nhân vật nhiệm vụ (võ sư Hổ, Haunter, chú tiểu, anh Đông, Jynx...) nằm trong story/villages.js.

export const TRAINERS = [
  // Mỏ Đá Vách Núi: thợ mỏ chắn hành lang vách núi phía đông, võ sinh của võ sư Hổ chắn rìa mỏ phía bắc
  {
    id: 'q6-miner', sprite: 'npc-hiker', name: 'Thợ mỏ Khang', map: 'quarry6', x: 33, y: 15, facing: 'left', sight: 3,
    team: [['graveler', 36], ['onix', 37]], prize: 30,
    intro: 'Đá lở cả đêm, mỏ đang nguy hiểm lắm! Muốn đi tiếp thì đấu với chú đã!', lose: 'Rắn như đá mà vẫn vỡ...',
    after: 'Lối lên rìa mỏ ở tít phía bắc. Đi chậm thôi kẻo trượt chân.',
  },
  {
    id: 'q6-blackbelt', sprite: 'npc-camper', name: 'Võ sinh Tùng', map: 'quarry6', x: 16, y: 2, facing: 'down', sight: 1,
    team: [['machop', 36], ['machoke', 37]], prize: 28,
    intro: 'Thầy Hổ đang ở hố mỏ cũ phía tây. Muốn gặp thầy thì phải qua tôi!', lose: 'Ối... Tôi phải tập thêm trăm cái chống đẩy!',
    after: 'Thầy cấm bọn tôi vào hố mỏ: con Golbat đầu đàn trong đó dữ lắm.',
  },
  // Nghĩa Trang Rừng Trúc: bà đồng ở góc tây nam nghĩa trang, cậu bé săn ma chặn lối trúc phía nam
  {
    id: 'g7-channeler', sprite: 'npc-woman', name: 'Bà đồng Lan', map: 'grave7', x: 18, y: 19, facing: 'left', sight: 3,
    team: [['gastly', 38], ['gastly', 38], ['haunter', 39]], prize: 24,
    intro: 'Hồn ma đang thì thầm với ta... chúng bảo ta giữ chân cháu lại!', lose: 'Hồn ma bỏ ta đi cả rồi...',
    after: 'Con Haunter ôm chuông hay bay về miếu hoang góc tây nam. Phải đi vòng lối trúc phía nam mới tới.',
  },
  {
    id: 'g7-ghosthunter', sprite: 'npc-boy', name: 'Cậu Bảo săn ma', map: 'grave7', x: 28, y: 22, facing: 'down', sight: 1,
    team: [['golbat', 39], ['hypno', 39]], prize: 20,
    intro: 'Suỵt! Tớ đang rình bắt ma. Cậu làm nó chạy mất rồi, đấu đền đi!', lose: 'Ma không thấy đâu, thua thì thấy rồi...',
    after: 'Qua cầu xuống phía nam rồi quay về tây là tới miếu hoang. Tớ không dám vào đó đâu!',
  },
  // Đèo Tuyết: dân leo núi đứng chỗ hở duy nhất của dãy đá tầng hai, nhóc trượt tuyết chặn khe đá tầng ba
  {
    id: 'p8-climber', sprite: 'npc-hiker', name: 'Dân leo núi Sơn', map: 'pass8', x: 20, y: 18, facing: 'left', sight: 5,
    team: [['graveler', 42], ['golbat', 42], ['onix', 43]], prize: 30,
    intro: 'Leo đèo giữa bão tuyết à? Gan đấy! Để xem đội của cậu có chịu lạnh nổi không!', lose: 'Tuyết lở rồi...',
    after: 'Lối lên tầng trên ở mé đông. Thấy gờ tuyết thì nhảy xuống là về nhanh lắm.',
  },
  {
    id: 'p8-skier', sprite: 'npc-youngster', name: 'Nhóc trượt tuyết Khôi', map: 'pass8', x: 22, y: 15, facing: 'up', sight: 1,
    team: [['seel', 42], ['cloyster', 43]], prize: 20,
    intro: 'Khe đá này là đường trượt của em! Muốn qua thì đấu đã!', lose: 'Trượt ngã sấp mặt rồi...',
    after: 'Sáng nay anh Đông dẫn đường đi ngang đây, lên đỉnh đèo mà chưa thấy xuống.',
  },
];

export const NPCS = [
  {
    id: 'q6-student', sprite: 'npc-boy', name: 'Học trò võ đường', map: 'quarry6', x: 20, y: 25, facing: 'down', wander: 1,
    lines: [
      'Thầy Hổ lên hố mỏ cũ góc tây bắc tìm con Machoke bị lạc sau trận đá lở đêm qua.',
      'Đá lở chắn mất lối giữa rồi. Phải đi vòng hành lang vách núi phía đông, lên rìa mỏ phía bắc rồi sang tây.',
    ],
  },
  {
    id: 'g7-keeper', sprite: 'npc-oldman', name: 'Ông giữ mộ', map: 'grave7', x: 19, y: 4, facing: 'down', wander: 1,
    lines: [
      'Đêm nào cũng có tiếng cười khúc khích ngoài nghĩa trang cổ phía đông nam. Con Haunter đó tinh quái lắm.',
      'Rừng trúc phía tây rậm như mê cung, đừng lạc vào đó. Muốn xuống miếu hoang góc tây nam thì đi qua nghĩa trang.',
    ],
  },
  {
    id: 'p8-rescuer', sprite: 'npc-camper', name: 'Đội cứu hộ', map: 'pass8', x: 24, y: 27, facing: 'down', wander: 1,
    lines: [
      'Đường đèo bốn tầng, lối lên mỗi tầng nằm so le hai đầu. Cứ men theo vách núi mà đi.',
      'Trên đỉnh đèo có hốc đá trú bão ở mé đông. Người dẫn đường hay nghỉ ở đó.',
    ],
  },
];

// Pokémon hoang dã ở các khu mới: cấp theo tuyến đường gần đó (Tuyến 8 ~ 32-37, Hang Sơn Động ~ 37-42, Tuyến 10 ~ 40-46).
// time: chỉ xuất hiện vào buổi đó (xem data/encounters.js: TIME_ONLY); buổi nào cũng còn ít nhất 2 loài
export const ENCOUNTERS = {
  // Mỏ Đá Vách Núi: Pokémon hệ Đá và Giác đấu; hốc cỏ rậm có Machoke, Primeape
  quarry6: [
    { species: 'geodude', min: 33, max: 35, weight: 20, time: 'day' },
    { species: 'graveler', min: 34, max: 36, weight: 25 },
    { species: 'machop', min: 33, max: 35, weight: 25 },
    { species: 'onix', min: 34, max: 36, weight: 15 },
    { species: 'machoke', min: 35, max: 37, weight: 10, time: 'dusk' },
    { species: 'golbat', min: 34, max: 36, weight: 5, time: 'night' },
    { species: 'dugtrio', min: 33, max: 35, weight: 8 },
  ],
  'quarry6-deep': [
    { species: 'machoke', min: 36, max: 38, weight: 35 },
    { species: 'graveler', min: 36, max: 38, weight: 30 },
    { species: 'onix', min: 36, max: 38, weight: 20 },
    { species: 'primeape', min: 36, max: 38, weight: 15, time: 'dusk' },
  ],
  // Nghĩa Trang Rừng Trúc: Pokémon hệ Ma và Siêu linh; Haunter chỉ ra ban đêm, cỏ rậm thì lúc nào cũng có
  grave7: [
    { species: 'gastly', min: 36, max: 39, weight: 35 },
    { species: 'golbat', min: 37, max: 39, weight: 20 },
    { species: 'drowzee', min: 36, max: 38, weight: 20, time: 'day' },
    { species: 'hypno', min: 38, max: 40, weight: 15, time: 'dusk' },
    { species: 'haunter', min: 38, max: 40, weight: 10, time: 'night' },
    { species: 'cubone', min: 36, max: 38, weight: 10 },
    { species: 'venomoth', min: 37, max: 39, weight: 10, time: 'night' },
  ],
  'grave7-deep': [
    { species: 'haunter', min: 39, max: 41, weight: 30 },
    { species: 'gastly', min: 38, max: 40, weight: 30 },
    { species: 'hypno', min: 39, max: 41, weight: 25 },
    { species: 'golbat', min: 39, max: 41, weight: 15, time: 'night' },
    { species: 'marowak', min: 38, max: 40, weight: 8 },
  ],
  // Đèo Tuyết: Pokémon hệ Băng và vùng núi
  pass8: [
    { species: 'jynx', min: 41, max: 44, weight: 30 },
    { species: 'seel', min: 40, max: 43, weight: 25, time: 'day' },
    { species: 'graveler', min: 41, max: 43, weight: 20 },
    { species: 'golbat', min: 41, max: 44, weight: 15, time: 'night' },
    { species: 'dewgong', min: 43, max: 45, weight: 10, time: 'dusk' },
  ],
};
