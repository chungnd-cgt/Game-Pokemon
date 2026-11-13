// Dữ liệu bổ sung khi mở rộng bản đồ (phần ch5): nhà huấn luyện, NPC, bảng Pokémon hoang dã cho các khu mới.
// Định dạng giống TRAINERS / NPCS trong data/npcs.js và ENCOUNTERS trong data/encounters.js.

// Tinh anh mới trên Đường Chiến Thắng (bậc 2 sườn núi, cao nguyên trước cửa hang) và trong tầng hầm Hang Vân Sơn.
// Càng đi sâu càng mạnh: tinh anh cũ cấp 47-49, tinh anh mới cấp 49-52
export const TRAINERS = [
  {
    id: 'r11-ace3', sprite: 'npc-ace', name: 'Tinh anh Hùng', map: 'route11', x: 24, y: 17, facing: 'down', sight: 1,
    team: [['primeape', 49], ['hitmonlee', 49], ['hitmonchan', 49], ['machamp', 50]], prize: 40,
    intro: 'Muốn qua mỏm đá này thì phải thắng nắm đấm của tôi!', lose: 'Nắm đấm chưa đủ cứng...',
    after: 'Trong hốc đá sau lưng tôi có ai đó đánh rơi đồ đấy.',
  },
  {
    id: 'r11-ace4', sprite: 'npc-ace-f', name: 'Tinh anh Phương', map: 'route11', x: 28, y: 4, facing: 'down', sight: 3,
    team: [['rhydon', 51], ['gengar', 51], ['lapras', 51], ['dragonair', 52]], prize: 40,
    intro: 'Leo được tới đỉnh rồi à? Cửa hang ngay sau lưng tôi, nhưng cậu phải thắng đã!', lose: 'Cậu sẵn sàng cho Liên minh rồi.',
    after: 'Hang Vân Sơn lạnh buốt, nhớ mang theo Ice Heal phòng khi bị đóng băng.',
  },
  {
    id: 'c3b-ace', sprite: 'npc-ace-f', name: 'Tinh anh Tuyết', map: 'cave3b', x: 19, y: 20, facing: 'down', sight: 2,
    team: [['cloyster', 50], ['jynx', 50], ['dewgong', 51]], prize: 40,
    intro: 'Dưới này lạnh đến thấu xương. Cậu chịu nổi không?', lose: 'Băng của tôi tan mất rồi...',
    after: 'Thang lên nửa bắc tầng trên ở phòng phía tây bắc.',
  },
];

export const NPCS = [];

// Hang Vân Sơn càng xuống sâu Pokémon càng mạnh (tầng 1 dùng bảng cave3 trong data/encounters.js)
export const ENCOUNTERS = {
  // Tầng hầm: Pokémon băng, ma, rồng cấp 48-52
  'cave3-deep': [
    { species: 'golbat', min: 49, max: 52, weight: 25 },
    { species: 'dewgong', min: 48, max: 51, weight: 20 },
    { species: 'cloyster', min: 48, max: 51, weight: 15 },
    { species: 'jynx', min: 48, max: 51, weight: 15 },
    { species: 'haunter', min: 48, max: 51, weight: 10 },
    { species: 'golem', min: 50, max: 52, weight: 10 },
    { species: 'dragonair', min: 50, max: 52, weight: 5 },
  ],
  // Hầm băng sâu: mạnh nhất vùng, có Lapras và Dragonair
  'cave3-depths': [
    { species: 'cloyster', min: 51, max: 54, weight: 20 },
    { species: 'dewgong', min: 51, max: 54, weight: 20 },
    { species: 'golbat', min: 51, max: 54, weight: 20 },
    { species: 'lapras', min: 52, max: 55, weight: 15 },
    { species: 'dragonair', min: 52, max: 55, weight: 15 },
    { species: 'gengar', min: 52, max: 54, weight: 10 },
  ],
};
