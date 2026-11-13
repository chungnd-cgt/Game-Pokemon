// Dữ liệu bổ sung khi mở rộng bản đồ (phần ch2): nhà huấn luyện, NPC, bảng Pokémon hoang dã cho các khu mới.
// Định dạng giống TRAINERS / NPCS trong data/npcs.js và ENCOUNTERS trong data/encounters.js.

// Tuyến đường 2 giữ đúng 2 nhà huấn luyện (tuyến làm quen); Tuyến đường 3 thêm thợ leo núi chặn đường mòn lên hồ
export const TRAINERS = [
  {
    id: 'r3-hiker', sprite: 'npc-hiker', name: 'Thợ leo núi Dũng', map: 'route3', x: 27, y: 16, facing: 'left', sight: 3,
    team: [['machop', 14], ['geodude', 15]], prize: 36,
    intro: 'Đường mòn này dốc lắm! Muốn lên hồ trên núi thì qua được anh đã!',
    lose: 'Chân anh mỏi nhừ rồi...',
    after: 'Từ hồ đi xuống sườn đông là tới Làng Chân Đồi. Có gờ đất nhảy xuống cho nhanh đấy.',
  },
];

export const NPCS = [
  // Ngã ba giữa Tuyến đường 2: chỉ đường lên dốc phía tây
  {
    id: 'r2-fork-oldman', sprite: 'npc-oldman', name: 'Ông Sáu', map: 'route2', x: 3, y: 14, facing: 'right',
    lines: [
      'Đi Thị trấn Lục Bình hả cháu? Leo con dốc ngay đây lên phía bắc, qua bụi cỏ rồi rẽ sang đông là tới.',
      'Lối nhỏ phía nam hành lang dẫn vào một lùm cỏ cụt, thỉnh thoảng có người đánh rơi đồ trong đó.',
      'Gần lối ra Lục Bình có gờ đất. Nhảy xuống là về bờ ao nhanh lắm, nhưng không leo ngược lên được đâu.',
    ],
  },
  // Hồ trên núi Tuyến đường 3
  {
    id: 'r3-fisher', sprite: 'npc-fisher', name: 'Bác Câu', map: 'route3', x: 37, y: 8, facing: 'left',
    lines: [
      'Hồ trên núi nước trong vắt, cá cắn câu suốt ngày.',
      'Có cần câu thì đứng sát mép nước mà thả. Cần càng tốt thì cá càng to!',
      'Cồn cát giữa hồ có viên đá lấp lánh. Phải lướt nước mới ra tới được.',
    ],
  },
  // Chân sườn đông, gần lối sang Làng Chân Đồi
  {
    id: 'r3-exit-guide', sprite: 'npc-guide', name: 'Anh Kiểm lâm', map: 'route3', x: 36, y: 25, facing: 'down', wander: 1,
    lines: [
      'Làng Chân Đồi ở ngay phía đông kia. Vào làng nghỉ chân, hồi phục Pokémon đã.',
      'Muốn quay lên hồ thì phải đi vòng dốc phía tây, gờ đất chỉ nhảy xuống được thôi.',
    ],
  },
];

export const ENCOUNTERS = {};
