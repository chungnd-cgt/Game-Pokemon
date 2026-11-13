// Dữ liệu bổ sung khi mở rộng bản đồ (phần ch4a): nhà huấn luyện, NPC, bảng Pokémon hoang dã cho các khu mới.
// Định dạng giống TRAINERS / NPCS trong data/npcs.js và ENCOUNTERS trong data/encounters.js.
// Tuyến đường 7 (Đồi Đất Sét), 8 (Hẻm Núi Đá), 9 (Rừng Tre ven suối) trong data/mapsChapter4.js.
export const TRAINERS = [
  // Tuyến đường 7: chị thợ gốm đào đất trên đồi (ngách cụt phía bắc), bác đốt lò trên bậc ruộng thứ hai
  {
    id: 'r7-clay-digger', sprite: 'npc-woman', name: 'Chị Đất Sét', map: 'route7', x: 13, y: 2, facing: 'down', sight: 1,
    team: [['growlithe', 31], ['geodude', 31], ['ponyta', 32]], prize: 24,
    intro: 'Đất sét trên đồi này nặn gì cũng đẹp. Đấu xong chị cho em xem!', lose: 'Bình gốm vỡ mất rồi...',
    after: 'Dưới chân đồi phía tây có hố đất sét, cỏ mọc rậm lắm.',
  },
  {
    id: 'r7-kiln', sprite: 'npc-oldman', name: 'Bác Lò Gạch', map: 'route7', x: 27, y: 13, facing: 'down', sight: 1,
    team: [['vulpix', 31], ['machop', 31], ['rapidash', 32]], prize: 30,
    intro: 'Leo ruộng bậc thang mỏi chân chưa? Nghỉ tay đấu với bác một trận!', lose: 'Lửa lò của bác nguội mất rồi.',
    after: 'Lên bậc trên cùng rồi rẽ tây là ra Làng Đất Sét. Phía đông bậc trên có lối lên đồi.',
  },
  // Tuyến đường 8: thợ đá ở hành lang trên, chị leo núi chặn ngang đáy hẻm
  {
    id: 'r8-mason', sprite: 'npc-hiker', name: 'Thợ Đá Khoa', map: 'route8', x: 15, y: 4, facing: 'down', sight: 1,
    team: [['geodude', 34], ['onix', 35], ['graveler', 35]], prize: 30,
    intro: 'Đục đá cả ngày, giờ đục thử Pokémon của cậu xem!', lose: 'Đục trúng đá cứng rồi!',
    after: 'Từ khe giữa nhảy gờ sang cao nguyên đá là về Lò Gốm nhanh hơn.',
  },
  {
    id: 'r8-climber', sprite: 'npc-ace', name: 'Chị Leo Núi Vân', map: 'route8', x: 25, y: 26, facing: 'down', sight: 2,
    team: [['machoke', 35], ['rhyhorn', 35], ['golbat', 36]], prize: 36,
    intro: 'Đáy hẻm này là của chị. Muốn qua thì đấu đã!', lose: 'Trượt chân rồi...',
    after: 'Leo khe giữa lên phía bắc rồi đi sang tây là tới Bản Vách Đá.',
  },
  // Tuyến đường 9: chú câu cá ở bờ nam, cô hái măng trong rặng tre phía đông bắc
  {
    id: 'r9-fisher', sprite: 'npc-fisher', name: 'Chú Thả Lưới', map: 'route9', x: 25, y: 24, facing: 'up', sight: 1,
    team: [['slowpoke', 36], ['seaking', 37], ['golduck', 37]], prize: 24,
    intro: 'Cá suối này khôn lắm. Đấu với chú cho cá nó quên chú đi!', lose: 'Đứt dây câu rồi!',
    after: 'Giữa suối có cồn cát, lướt nước ra đó may ra nhặt được của quý.',
  },
  {
    id: 'r9-bamboo', sprite: 'npc-woman', name: 'Cô Hái Măng', map: 'route9', x: 31, y: 4, facing: 'left', sight: 2,
    team: [['weepinbell', 36], ['gloom', 36], ['hypno', 37]], prize: 24,
    intro: 'Rặng tre này cô trông đó, đừng giẫm hỏng măng non nhé!', lose: 'Thôi được, cho cháu đi qua.',
    after: 'Trong cỏ rậm sau rặng tre có đồ ai đánh rơi đấy.',
  },
];

export const NPCS = [];

export const ENCOUNTERS = {
  // Hố đất sét dưới chân đồi (Tuyến đường 7)
  'route7-clay': [
    { species: 'geodude', min: 31, max: 34, weight: 30 },
    { species: 'machop', min: 31, max: 34, weight: 25 },
    { species: 'ponyta', min: 32, max: 34, weight: 20 },
    { species: 'growlithe', min: 32, max: 34, weight: 15 },
    { species: 'graveler', min: 33, max: 34, weight: 10 },
    { species: 'cubone', min: 31, max: 33, weight: 10 },
    { species: 'magmar', min: 32, max: 34, weight: 5 },
  ],
  // Suối trong Rừng Tre (Tuyến đường 9): lướt nước và câu cá
  'route9-surf': [
    { species: 'psyduck', min: 34, max: 38, weight: 40 },
    { species: 'slowpoke', min: 34, max: 38, weight: 30, time: 'day' },
    { species: 'golduck', min: 37, max: 40, weight: 20, time: 'dusk' },
    { species: 'slowbro', min: 38, max: 40, weight: 10 },
  ],
  'route9-old': [{ species: 'magikarp', min: 15, max: 20, weight: 100 }],
  'route9-good': [
    { species: 'poliwag', min: 30, max: 35, weight: 40 },
    { species: 'goldeen', min: 30, max: 35, weight: 35 },
    { species: 'psyduck', min: 30, max: 35, weight: 25 },
  ],
  'route9-super': [
    { species: 'poliwhirl', min: 37, max: 42, weight: 35 },
    { species: 'seaking', min: 37, max: 42, weight: 30 },
    { species: 'golduck', min: 38, max: 42, weight: 20 },
    { species: 'gyarados', min: 40, max: 43, weight: 15 },
  ],
};
