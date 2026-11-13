// Dữ liệu bổ sung khi mở rộng bản đồ (phần ch4b): nhà huấn luyện, NPC, bảng Pokémon hoang dã cho các khu mới.
// Định dạng giống TRAINERS / NPCS trong data/npcs.js và ENCOUNTERS trong data/encounters.js.
// Hang Sơn Động (tầng 1 + tầng hầm) và Tuyến đường 10 (đường lên núi tuyết).
export const TRAINERS = [
  // Hang Sơn Động - tầng 1
  {
    id: 'c2-hiker', sprite: 'npc-hiker', name: 'Thợ mỏ Tùng', map: 'cave2', x: 23, y: 20, facing: 'left', sight: 5,
    team: [['graveler', 38], ['onix', 39], ['golbat', 38]], prize: 30,
    intro: 'Hang Sơn Động sâu hun hút, đi lạc là khỏi về! Đấu với ta trước đã!',
    lose: 'Đá núi cũng phải nứt...',
    after: 'Nửa hang phía bắc bị vách dày chắn lại. Muốn sang thì tìm cái thang xuống tầng hầm ở phòng đông nam.',
  },
  {
    id: 'c2-channeler', sprite: 'npc-oldman', name: 'Thầy đồng Khải', map: 'cave2', x: 28, y: 1, facing: 'down', sight: 3,
    team: [['haunter', 40], ['hypno', 40]], prize: 26,
    intro: 'Khói hương từ xóm bên kia bay vào tận đây... Linh hồn trong hang muốn thử sức cậu!',
    lose: 'Các vong linh đã chịu lui rồi.',
    after: 'Ra khỏi cửa hang là tới Xóm Hương Khói. Nhớ thắp nén nhang ở miếu nhé.',
  },
  // Hang Sơn Động - tầng hầm
  {
    id: 'c2b-hiker', sprite: 'npc-hiker', name: 'Thợ mỏ Cường', map: 'cave2b', x: 16, y: 19, facing: 'down', sight: 4,
    team: [['machoke', 40], ['graveler', 41], ['onix', 41]], prize: 32,
    intro: 'Dưới này ta đào đá cả chục năm rồi! Đâu dễ để cậu đi qua!',
    lose: 'Sức trẻ ghê thật!',
    after: 'Thang lên nửa bắc ở góc tây bắc tầng hầm. Còn cái thang ở phòng đông bắc thì dẫn lên một phòng kín lắm.',
  },
  {
    id: 'c2b-camper', sprite: 'npc-camper', name: 'Trại viên Linh', map: 'cave2b', x: 12, y: 8, facing: 'down', sight: 3,
    team: [['golbat', 40], ['machoke', 41]], prize: 24,
    intro: 'Tớ nghe nói có Golem sống sâu trong hang này. Cậu cũng đi tìm à? Đấu đã!',
    lose: 'Golem chưa thấy đâu mà đã thua rồi...',
    after: 'Phòng kín trên tầng 1 có Pokémon lạ lắm, chỉ leo thang từ phòng đông bắc mới vào được.',
  },
  // Tuyến đường 10: dân leo núi đứng chặn lối dọc bờ tây Hồ Lạnh
  {
    id: 'r10-climber', sprite: 'npc-hiker', name: 'Dân leo núi Khang', map: 'route10', x: 28, y: 16, facing: 'right', sight: 3,
    team: [['graveler', 43], ['onix', 43], ['rhydon', 44]], prize: 30,
    intro: 'Leo tới đây là sắp tới đỉnh đèo rồi! Đấu một trận cho ấm người nào!',
    lose: 'Chân ta mỏi rã rời rồi...',
    after: 'Lên tới đỉnh đèo thì đi tiếp sang đông. Muốn về Chùa Cổ nhanh thì nhảy xuống gờ đá phía tây.',
  },
];

export const NPCS = [];

export const ENCOUNTERS = {
  // Tầng hầm Hang Sơn Động: mạnh hơn tầng 1
  'cave2-deep': [
    { species: 'golbat', min: 40, max: 44, weight: 30 },
    { species: 'graveler', min: 40, max: 44, weight: 25 },
    { species: 'onix', min: 41, max: 45, weight: 15 },
    { species: 'machoke', min: 40, max: 43, weight: 15 },
    { species: 'haunter', min: 41, max: 44, weight: 10 },
    { species: 'golem', min: 45, max: 46, weight: 5 },
    { species: 'marowak', min: 40, max: 43, weight: 8 },
  ],
  // Phòng kín trên tầng 1 (chỉ tới bằng thang từ tầng hầm): Pokémon hiếm
  'cave2-hidden': [
    { species: 'graveler', min: 42, max: 45, weight: 35 },
    { species: 'haunter', min: 42, max: 45, weight: 30 },
    { species: 'golem', min: 44, max: 46, weight: 20 },
    { species: 'ditto', min: 42, max: 45, weight: 15 },
  ],
};
