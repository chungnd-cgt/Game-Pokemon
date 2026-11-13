import { EXTRA_NPCS, EXTRA_TRAINERS } from './extra/index.js';
import { GYM_GUIDES, GYM_TRAINERS } from './gymPeople.js';
// Dân làng: đứng trước mặt và bấm Enter/Space để nói chuyện (nói được qua quầy).
// map: bản đồ NPC đứng • wander: số ô tối đa đi lang thang (0 = đứng yên, chỉ xoay người)
// role: 'nurse' (hồi phục) / 'clerk' (mở cửa hàng); fixed: đứng yên, không xoay
export const NPCS = [
  { id: 'joy', sprite: 'npc-joy', name: 'Y tá Joy', map: 'center', x: 6, y: 2, facing: 'down', fixed: true, role: 'nurse' },
  {
    id: 'visitor', sprite: 'npc-boy', name: 'Cậu bé', map: 'center', x: 4, y: 6, facing: 'up', wander: 1,
    lines: ['Pokémon Center hồi phục Pokémon miễn phí đó!', 'Máy tính trong góc kia dùng để gửi, rút và thả Pokémon đó.'],
  },
  { id: 'clerk', sprite: 'npc-clerk', name: 'Nhân viên', map: 'mart', x: 1, y: 2, facing: 'down', fixed: true, role: 'clerk' },
  {
    id: 'shopper', sprite: 'npc-woman', name: 'Khách hàng', map: 'mart', x: 7, y: 4, facing: 'left', wander: 1,
    lines: ['Great Ball đắt hơn nhưng bắt Pokémon dễ hơn nhiều.', 'Đồ không dùng tới thì bán lại cho cửa hàng được nửa giá đấy.'],
  },
  {
    id: 'oldman', sprite: 'npc-oldman', name: 'Ông lão', map: 'route1', x: 14, y: 9, facing: 'down', wander: 1,
    lines: [
      'Hồi trẻ ta cũng từng là một nhà huấn luyện Pokémon đấy...',
      'Mẹo nhỏ: đánh cho Pokémon hoang dã yếu đi rồi hãy ném Poké Ball, dễ bắt hơn nhiều!',
    ],
  },
  {
    id: 'girl', sprite: 'npc-girl', name: 'Cô gái', map: 'route2', x: 33, y: 27, facing: 'up', wander: 1,
    lines: ['Nghe nói ban ngày ở bụi cỏ rậm phía đông có cả Pikachu đó!', 'Mình mãi chưa bắt được con nào...'],
  },
  // Tuyến đường 2 là tuyến làm quen: chỉ 2 nhà huấn luyện (Nhóc Tùng, Bé Mai), còn lại là người đi đường chỉ dẫn
  {
    id: 'r2-camper-guide', sprite: 'npc-camper', name: 'Anh Hùng', map: 'route2', x: 35, y: 21, facing: 'up',
    lines: [
      'Bụi cỏ rậm này có Pikachu ban ngày, Growlithe lúc chạng vạng và Meowth về đêm đấy.',
      'Cỏ rậm thì Pokémon khoẻ hơn một chút, nhớ mang theo Potion nhé!',
    ],
  },
  {
    id: 'r2-hiker-guide', sprite: 'npc-camper', name: 'Anh Hải', map: 'route2', x: 11, y: 29, facing: 'up', wander: 1,
    lines: [
      'Nhà huấn luyện mà nhìn thấy em là sẽ tới thách đấu. Thắng thì được tiền thưởng!',
      'Phía trước là Thị trấn Lục Bình, có Pokémon Center để hồi phục miễn phí.',
    ],
  },
  {
    id: 'r2-lass-guide', sprite: 'npc-lass', name: 'Chị Lan', map: 'route2', x: 16, y: 9, facing: 'left', wander: 1,
    lines: [
      'Hái quả mọng ở luống đất gần đây đi em, Oran Berry hồi máu cho Pokémon đấy.',
      'Hang Thạch Nhũ ở sau Lục Bình. Trong hang có Zubat bay khắp nơi, mang theo Repel cho đỡ phiền nhé.',
    ],
  },
  {
    id: 'boy', sprite: 'npc-boy', name: 'Cậu bé', map: 'route1', x: 12, y: 17, facing: 'down', wander: 2,
    lines: ['Bấm P để mở Pokédex nha!', 'Gặp Pokémon nào là Pokédex ghi lại, bắt được thì xem được hết thông tin luôn!'],
  },
  {
    id: 'woman', sprite: 'npc-woman', name: 'Cô hàng xóm', map: 'route1', x: 8, y: 7, facing: 'down', wander: 1,
    lines: [
      'Pallet nhỏ lắm, không có Pokémon Center đâu. Pokémon mệt thì cứ về nhà, mẹ cháu chăm cho.',
      'Đi hết Tuyến đường 2 là tới Thị trấn Lục Bình, ở đó có Pokémon Center và Poké Mart.',
    ],
  },
  // Pidgey của bà Tư lang thang quanh luống hoa giữa Pallet
  {
    id: 'pallet-pidgey', mon: 'pidgey', name: 'Pidgey', map: 'route1', x: 10, y: 15, facing: 'down', wander: 1,
    lines: ['Pi-pi! Pi-pi!', '(Pidgey của bà Tư đang mổ hạt quanh luống hoa.)'],
  },
  // Nhà bà Tư ở Pallet
  {
    id: 'pallet-granny', sprite: 'npc-woman', name: 'Bà Tư', map: 'palletHouse', x: 2, y: 4, facing: 'right', wander: 0,
    lines: [
      'Cháu nhà bên được Giáo sư Oak cho Pokémon rồi à? Lớn nhanh quá!',
      'Bà làm mứt từ quả mọng hái dọc đường đấy. Quả mọng cho Pokémon cầm, lúc nguy nó tự ăn mà hồi sức.',
      'Nghe nói ở Thành phố Lò Gốm có cả một vườn quả mọng to lắm!',
      'Con Pidgey ngoài luống hoa là của bà đấy. Sáng nào nó cũng ra mổ hạt, chẳng chịu ở trong nhà.',
    ],
  },
  {
    id: 'pallet-kid', sprite: 'npc-girl', name: 'Bé Na', map: 'palletHouse', x: 8, y: 5, facing: 'down', wander: 1,
    lines: ['Bụi cỏ phía bắc có Pidgey với Rattata đó!', 'Tối đến còn có Oddish nữa. Ban ngày thì không thấy đâu!'],
  },
  // Thị trấn Lục Bình
  {
    id: 't1-woman', sprite: 'npc-woman', name: 'Cô bán hoa', map: 'town1', x: 10, y: 11, facing: 'down', wander: 1,
    lines: [
      'Ao lục bình này thông với con sông chảy từ hồ nước Pallet đấy.',
      'Có Pokémon biết lướt nước thì đi ngược dòng sông được. Nghe nói giữa sông có bãi bồi lắm đồ hay!',
    ],
  },
  {
    id: 't1-boy', sprite: 'npc-boy', name: 'Cậu bé', map: 'town1', x: 25, y: 11, facing: 'left', wander: 1,
    lines: ['Hang Thạch Nhũ ở dưới vách đá phía đông bắc đó.', 'Trong hang tối lắm, Zubat bay khắp nơi. Nhớ mang theo Repel nha!'],
  },
  // Sông Lục Bình: ông câu cá trên bãi bồi phía bắc
  {
    id: 'rv-fisher', sprite: 'npc-fisher', name: 'Ông câu cá', map: 'river1', x: 25, y: 12, facing: 'up', wander: 0,
    lines: [
      'Ta chèo thuyền ra bãi này câu cá đã ba hôm rồi...',
      'Sông Lục Bình có cả Dratini đấy! Nhưng phải dùng cần câu siêu mới câu được.',
    ],
  },
];

// Chương 2: Thành phố Đồi Gió và các nơi trên đường đi
NPCS.push(
  { id: 'joy2', sprite: 'npc-joy', name: 'Y tá Joy', map: 'center2', x: 6, y: 2, facing: 'down', fixed: true, role: 'nurse' },
  { id: 'clerk2', sprite: 'npc-clerk', name: 'Nhân viên', map: 'mart2', x: 1, y: 2, facing: 'down', fixed: true, role: 'clerk' },
  {
    id: 't2-granny', sprite: 'npc-woman', name: 'Bà cụ', map: 'town2', x: 10, y: 14, facing: 'down', wander: 1,
    lines: ['Gió ở Đồi Gió thổi quanh năm, phơi đồ khô nhanh lắm cháu ạ.', 'Pokémon hệ Bay ở đây khoẻ lắm đấy.'],
  },
  {
    id: 't2-boy', sprite: 'npc-boy', name: 'Cậu bé', map: 'town2', x: 26, y: 9, facing: 'left', wander: 1,
    lines: ['Thủ lĩnh Phong mạnh lắm! Pokémon hệ Bay của cô ấy bay nhanh như gió.', 'Nghe nói Pokémon hệ Điện và hệ Đá đánh hệ Bay rất đau đó!'],
  },
);

// Gym 2-8: y tá, nhân viên cửa hàng, dân thị trấn, hướng dẫn viên gym
for (const n of [3, 4, 5, 6, 7, 8, 9]) {
  NPCS.push({ id: `joy${n}`, sprite: 'npc-joy', name: 'Y tá Joy', map: `center${n}`, x: 6, y: 2, facing: 'down', fixed: true, role: 'nurse' });
  if (n !== 5) NPCS.push({ id: `clerk${n}`, sprite: 'npc-clerk', name: 'Nhân viên', map: `mart${n}`, x: 1, y: 2, facing: 'down', fixed: true, role: 'clerk' });
}
// 8 làng nhỏ trước các thành phố có gym: mỗi làng một Pokémon Center và một Poké Mart (data/mapsVillages.js)
for (let n = 1; n <= 8; n++) {
  NPCS.push({ id: `vjoy${n}`, sprite: 'npc-joy', name: 'Y tá Joy', map: `vcenter${n}`, x: 6, y: 2, facing: 'down', fixed: true, role: 'nurse' });
  NPCS.push({ id: `vclerk${n}`, sprite: 'npc-clerk', name: 'Nhân viên', map: `vmart${n}`, x: 1, y: 2, facing: 'down', fixed: true, role: 'clerk' });
}
// Trung tâm thương mại Sông Nước: mỗi quầy bán một loại hàng (stock), quầy nào cũng mua lại mọi thứ.
// Cô gái tặng Eevee để thử đá tiến hoá (chỉ một lần).
NPCS.push(
  { id: 'store-clerk', sprite: 'npc-clerk', name: 'Quầy tạp hoá', map: 'store5', x: 1, y: 2, facing: 'down', fixed: true, role: 'clerk', stock: 'general' },
  { id: 'store-stones', sprite: 'npc-woman', name: 'Quầy đá tiến hoá', map: 'store5', x: 8, y: 2, facing: 'down', fixed: true, role: 'clerk', stock: 'stones' },
  {
    id: 'store-shopper', sprite: 'npc-boy', name: 'Khách hàng', map: 'store5', x: 3, y: 7, facing: 'right', wander: 1,
    lines: ['Đá tiến hoá chỉ bán ở quầy bên phải thôi.', 'Pikachu dùng Thunder Stone là thành Raichu ngay!'],
  },
);
NPCS.push(
  {
    id: 't3-girl', sprite: 'npc-girl', name: 'Cô gái', map: 'town3', x: 14, y: 4, facing: 'left', wander: 1,
    lines: ['Gym Lúa Vàng có cổng tre khoá kín, phải tìm công tắc mới mở được.'],
  },
  {
    id: 't4-boy', sprite: 'npc-boy', name: 'Cậu bé', map: 'town4', x: 18, y: 16, facing: 'left', wander: 1,
    lines: ['Trong Gym Đèn Lồng, hàng rào điện cứ đổi chỗ mỗi khi dẫm lên công tắc!'],
  },
  {
    id: 't5-boatwoman', sprite: 'npc-woman', name: 'Cô lái đò', map: 'town5', x: 17, y: 11, facing: 'down', wander: 1,
    lines: ['Có cần câu thì thả câu ngay kênh rạch trong thị trấn cũng được đó.', 'Pokémon hệ Nước sợ hệ Cỏ và hệ Điện.'],
  },
  {
    id: 't5-kid', sprite: 'npc-boy', name: 'Cậu bé', map: 'town5', x: 19, y: 17, facing: 'left', wander: 1,
    lines: ['Trong Gym Sông Nước có dòng chảy cuốn người ta đi, phải đi vòng mới tới được thủ lĩnh.'],
  },
);

// Liên minh: y tá, nhân viên trong sảnh, lính gác Đường Chiến Thắng
NPCS.push(
  { id: 'joy-league', sprite: 'npc-joy', name: 'Y tá Joy', map: 'leagueLobby', x: 2, y: 2, facing: 'down', fixed: true, role: 'nurse' },
  { id: 'clerk-league', sprite: 'npc-clerk', name: 'Nhân viên', map: 'leagueLobby', x: 10, y: 2, facing: 'down', fixed: true, role: 'clerk' },
  {
    id: 'r11-guard', sprite: 'npc-guide', name: 'Lính gác', map: 'route11', x: 6, y: 9, facing: 'left', fixed: true,
    lines: ['Đây là Đường Chiến Thắng, lối lên Liên minh.', 'Chỉ nhà huấn luyện có đủ 8 huy hiệu mới được đi qua.'],
  },
);

// Gym 5-8: dân các thị trấn trên đường
NPCS.push(
  {
    id: 't6-potter', sprite: 'npc-oldman', name: 'Nghệ nhân gốm', map: 'town6', x: 14, y: 11, facing: 'down', wander: 1,
    lines: ['Mẻ gốm này phải nung đủ ba ngày ba đêm đấy cháu.', 'Pokémon hệ Lửa của Nung giữ lửa lò cho cả thành phố.'],
  },
  {
    id: 't6-girl', sprite: 'npc-girl', name: 'Cô gái', map: 'town6', x: 19, y: 17, facing: 'left', wander: 1,
    lines: ['Pokémon hệ Lửa sợ hệ Nước, Đất và Đá.', 'Bị bỏng thì ăn quả Rawst là khỏi ngay.'],
  },
  {
    id: 't7-hiker', sprite: 'npc-hiker', name: 'Dân leo núi', map: 'town7', x: 19, y: 12, facing: 'down', wander: 1,
    lines: ['Gym Núi Đá tối om như trong hang vậy.', 'Chiêu hệ Nước và Cỏ đánh Pokémon hệ Đá đau lắm đó!'],
  },
  {
    id: 't7-boy', sprite: 'npc-boy', name: 'Cậu bé', map: 'town7', x: 7, y: 12, facing: 'right', wander: 1,
    lines: ['Đường xuống phía nam dẫn tới Hang Sơn Động.', 'Trong hang có cả Rhydon đấy, to lắm!'],
  },
  {
    id: 't8-monk', sprite: 'npc-oldman', name: 'Sư thầy', map: 'town8', x: 25, y: 12, facing: 'down', wander: 1,
    lines: ['Tâm tĩnh thì vạn vật đều sáng tỏ.', 'Pokémon hệ Siêu linh không ngại chiêu hệ Giác đấu, nhưng sợ hệ Bọ.'],
  },
  {
    id: 't8-woman', sprite: 'npc-woman', name: 'Cô bán hoa sen', map: 'town8', x: 14, y: 11, facing: 'down', wander: 1,
    lines: ['Sen trong ao này nở quanh năm đó.', 'Trong gym toàn ô dịch chuyển, chị đi một lần là chóng mặt luôn.'],
  },
  {
    id: 't9-girl', sprite: 'npc-girl', name: 'Cô gái', map: 'town9', x: 12, y: 11, facing: 'down', wander: 1,
    lines: ['Brrr... lạnh quá! Nhớ mang theo Ice Heal hoặc quả Aspear nhé.', 'Pokémon bị đóng băng sẽ không cử động được đâu.'],
  },
  {
    id: 't9-oldman', sprite: 'npc-oldman', name: 'Ông lão', map: 'town9', x: 20, y: 17, facing: 'left', wander: 1,
    lines: ['Đường đèo phía đông dẫn lên Liên minh.', 'Phải thắng gym Sương Mù và có đủ 8 huy hiệu thì lính gác mới cho qua.'],
  },
);

// Chansey phụ y tá Joy ở mọi Pokémon Center: đứng ngay bên phải Joy sau quầy
const CHANSEY_LINES = [
  ['Chansey! Chan-sey! ♪', 'Chansey ôm quả trứng tròn, cúi chào bạn thật lễ phép.'],
  ['Chaaan-sey! ♪', 'Chansey đang giúp Y tá Joy đẩy khay Poké Ball ra máy hồi phục.'],
];
for (const joy of NPCS.filter((n) => n.role === 'nurse')) {
  NPCS.push({
    id: `chansey-${joy.map}`, mon: 'chansey', name: 'Chansey', map: joy.map, x: joy.x + 1, y: joy.y, facing: 'down', fixed: true,
    lines: CHANSEY_LINES[NPCS.length % CHANSEY_LINES.length],
  });
}

// Nhà huấn luyện: thấy bạn trong tầm nhìn (sight ô theo hướng đang nhìn) thì tới thách đấu.
// Thắng rồi thì nói chuyện lại để đấu lại (nói câu after rồi hỏi). prize: tiền thưởng = prize x cấp Pokémon cuối.
export const TRAINERS = [
  {
    id: 'youngster', sprite: 'npc-youngster', name: 'Nhóc Tùng', map: 'route2', x: 24, y: 2, facing: 'down', sight: 3,
    team: [['rattata', 6], ['pidgey', 7]], prize: 16,
    intro: 'Ê! Mắt chạm mắt là phải đấu Pokémon!',
    lose: 'Á á! Thua rồi...',
    after: 'Tớ sẽ luyện Rattata với Pidgey mạnh hơn nữa!',
  },
  {
    id: 'lass', sprite: 'npc-lass', name: 'Bé Mai', map: 'route2', x: 17, y: 14, facing: 'down', sight: 1,
    team: [['pidgey', 5], ['oddish', 6]], prize: 16,
    intro: 'Bạn cũng có Pokémon à? Đấu thử với mình nhé!',
    lose: 'Ơ... mình thua rồi sao?',
    after: 'Pidgey của mình dễ thương mà, đúng không?',
  },
  {
    id: 'c1-hiker', sprite: 'npc-hiker', name: 'Thợ mỏ Hùng', map: 'cave1', x: 22, y: 16, facing: 'down', sight: 3,
    team: [['geodude', 12], ['geodude', 12], ['zubat', 13]], prize: 36,
    intro: 'Hô hô! Hang này là nhà của anh em Geodude chúng ta!',
    lose: 'Đá cứng mấy cũng có lúc vỡ...',
    after: 'Vách đá chắn ngang giữa hang. Muốn tới lối ra thì xuống tầng hầm bằng cái thang ở phòng phía đông.',
  },
  {
    id: 'c1-camper', sprite: 'npc-camper', name: 'Trại viên Long', map: 'cave1', x: 34, y: 25, facing: 'left', sight: 3,
    team: [['zubat', 12], ['ekans', 13]], prize: 24,
    intro: 'Cậu cũng đi tìm thang xuống tầng hầm à? Đấu đã rồi tính!',
    lose: 'Tối quá, Pokémon của tớ không nhìn rõ...',
    after: 'Dưới tầng hầm có Onix to lắm. Cẩn thận kẻo lạc nhé!',
  },
  {
    id: 'c1b-hiker', sprite: 'npc-hiker', name: 'Thợ mỏ Sơn', map: 'cave1b', x: 24, y: 19, facing: 'left', sight: 4,
    team: [['geodude', 13], ['onix', 15]], prize: 36,
    intro: 'Tầng hầm này là chỗ đào đá của ta. Muốn đi qua thì đấu!',
    lose: 'Onix của ta... thua rồi sao?',
    after: 'Thang lên lối ra ở tít góc tây bắc. Đi men theo hành lang phía tây ấy.',
  },
  {
    id: 'c1b-youngster', sprite: 'npc-youngster', name: 'Nhóc Bảo', map: 'cave1b', x: 4, y: 9, facing: 'down', sight: 3,
    team: [['machop', 14], ['zubat', 13]], prize: 20,
    intro: 'Em lạc trong hang cả buổi rồi! Đấu với em cho đỡ sợ đi!',
    lose: 'Hết sợ rồi, cảm ơn anh chị!',
    after: 'Cái thang phía trên kia dẫn lên gần lối ra Tuyến đường 3 đó.',
  },
  {
    id: 'f1-lass', sprite: 'npc-lass', name: 'Bé Hoa', map: 'forest1', x: 29, y: 6, facing: 'down', sight: 3,
    team: [['oddish', 14], ['bellsprout', 15]], prize: 18,
    intro: 'Rừng này nhiều Pokémon cỏ dễ thương lắm! Đấu với mình nhé!',
    lose: 'Ôi, Pokémon của mình héo cả rồi...',
    after: 'Lối mòn phía bắc dẫn sang tây tới một bãi hoa đẹp lắm đó.',
  },
  {
    id: 'f1-camper', sprite: 'npc-camper', name: 'Trại viên Khoa', map: 'forest1', x: 16, y: 2, facing: 'down', sight: 1,
    team: [['pidgey', 14], ['rattata', 14], ['pikachu', 15]], prize: 22,
    intro: 'Ê! Cắm trại giữa rừng mà gặp được đối thủ, sướng quá!',
    lose: 'Thua rồi... tối nay phải luyện thêm quanh đống lửa.',
    after: 'Lúc nãy tớ nghe có tiếng trẻ con khóc ở bãi hoa phía tây đó.',
  },
  {
    id: 'r3-birdkeeper', sprite: 'npc-birdkeeper', name: 'Anh Tú', map: 'route3', x: 7, y: 15, facing: 'left', sight: 3,
    team: [['pidgey', 13], ['pidgeotto', 15]], prize: 24,
    intro: 'Anh đang luyện Pokémon hệ Bay để thách đấu Gym Đồi Gió!',
    lose: 'Cánh chim của anh còn non quá...',
    after: 'Thủ lĩnh Phong mạnh lắm, em chuẩn bị kỹ vào.',
  },
  {
    id: 'r3-swimmer', sprite: 'npc-lass', name: 'Chị Mai', map: 'route3', x: 31, y: 12, facing: 'down', sight: 1,
    team: [['poliwag', 14], ['psyduck', 14]], prize: 16,
    intro: 'Hồ trên núi này là của chị! Đấu thử nào!',
    lose: 'Hụt hơi mất rồi...',
    after: 'Có cần câu thì thử câu ở hồ này xem, nhiều cá lắm.',
  },
  // Gym 2-4: tuyến đường
  {
    id: 'r4-camper', sprite: 'npc-camper', name: 'Anh Dũng', map: 'route4', x: 15, y: 9, facing: 'right', sight: 2,
    team: [['ekans', 17], ['raticate', 18]], prize: 20,
    intro: 'Đứng lại! Đấu một trận rồi hẵng đi tiếp!', lose: 'Thua tâm phục khẩu phục!', after: 'Lúa Vàng ở ngay phía trước thôi.',
  },
  {
    id: 'r4-lass', sprite: 'npc-lass', name: 'Bé Hoa', map: 'route4', x: 24, y: 22, facing: 'down', sight: 2,
    team: [['bellsprout', 17], ['oddish', 18]], prize: 16,
    intro: 'Pokémon hệ Cỏ của em dễ thương lắm, đấu thử nhé!', lose: 'Hu hu, thua rồi...', after: 'Chị Thảo ở Gym Lúa Vàng là thần tượng của em!',
  },
  {
    id: 'r5-engineer', sprite: 'npc-guide', name: 'Kỹ sư Minh', map: 'route5', x: 21, y: 16, facing: 'left', sight: 2,
    team: [['magnemite', 21], ['voltorb', 21]], prize: 30,
    intro: 'Tôi đang kiểm tra đường dây điện. Đấu thử một trận cho vui!', lose: 'Chập mạch rồi!', after: 'Qua Xóm Trạm Điện phía tây là tới Thành phố Đèn Lồng.',
  },
  {
    id: 'r5-birdkeeper', sprite: 'npc-birdkeeper', name: 'Anh Long', map: 'route5', x: 12, y: 10, facing: 'up', sight: 3,
    team: [['pidgeotto', 22], ['pidgeotto', 22]], prize: 24,
    intro: 'Đôi cánh của anh sẽ thổi bay em!', lose: 'Gió ngược rồi...', after: 'Luyện cho Pokémon thật mạnh vào nhé.',
  },
  {
    id: 'r6-fisher', sprite: 'npc-fisher', name: 'Chú Tư', map: 'route6', x: 36, y: 9, facing: 'right', sight: 3,
    team: [['goldeen', 25], ['tentacool', 26]], prize: 24,
    intro: 'Cá không cắn câu, đấu Pokémon cho đỡ buồn vậy!', lose: 'Hôm nay xui thật...', after: 'Hồ Gương có nhiều Tentacool lắm.',
  },
  {
    id: 'r6-swimmer', sprite: 'npc-lass', name: 'Chị Ngân', map: 'route6', x: 31, y: 24, facing: 'up', sight: 2,
    team: [['staryu', 26], ['psyduck', 26]], prize: 16,
    intro: 'Chị vừa bơi qua hồ đó, giờ đấu một trận nhé!', lose: 'Chị đuối sức rồi...', after: 'Qua Làng Bến Đò phía tây là tới Thành phố Sông Nước.',
  },
  // Kình ngư bơi dưới nước (swim: đứng trên ô nước, tầm nhìn đi qua mặt nước) và ngư dân trên cồn cát.
  // Chỉ gặp khi lướt nước (sau Gym Sông Nước), nên cấp cao hơn nhà huấn luyện trên bờ cùng khu
  {
    id: 'r3-swim-water', sprite: 'npc-boy', name: 'Kình ngư Tuấn', map: 'route3', x: 27, y: 6, facing: 'down', sight: 3, swim: true,
    team: [['psyduck', 30], ['poliwhirl', 31]], prize: 16,
    intro: 'Hồ trên núi lạnh mà khoẻ người lắm! Đấu dưới nước nhé!', lose: 'Uống phải nước rồi...', after: 'Cồn cát giữa hồ có đồ hay đấy.',
  },
  {
    id: 'r6-swim-water', sprite: 'npc-lass', name: 'Kình ngư Vy', map: 'route6', x: 26, y: 8, facing: 'left', sight: 3, swim: true,
    team: [['tentacool', 28], ['staryu', 29]], prize: 16,
    intro: 'Hồ Gương phẳng lặng thế này mà có người lướt tới à? Đấu thôi!', lose: 'Sóng to quá, chị chịu thua!', after: 'Lướt quanh cồn cát giữa hồ thử xem.',
  },
  {
    id: 'r10-swim-water', sprite: 'npc-boy', name: 'Kình ngư Bảo', map: 'route10', x: 34, y: 11, facing: 'left', sight: 3, swim: true,
    team: [['seaking', 44], ['dewgong', 45]], prize: 18,
    intro: 'Bơi ở Hồ Lạnh mới là dân chuyên! Cậu chịu lạnh giỏi không?', lose: 'Lạnh cóng cả người rồi...', after: 'Dewgong của anh bơi trong nước đá cả ngày đấy.',
  },
  {
    id: 'rv-swimmer-a', sprite: 'npc-lass', name: 'Kình ngư Hà', map: 'river1', x: 16, y: 10, facing: 'left', sight: 4, swim: true,
    team: [['goldeen', 32], ['poliwhirl', 32]], prize: 16,
    intro: 'Bơi xuôi Sông Lục Bình là thú vui của chị! Đấu một trận nhé!', lose: 'Ôi, chị bị dòng nước cuốn mất rồi!', after: 'Các cồn cát giữa sông có nhiều đồ hay lắm.',
  },
  {
    id: 'rv-swimmer-b', sprite: 'npc-boy', name: 'Kình ngư Dũng', map: 'river1', x: 27, y: 8, facing: 'down', sight: 3, swim: true,
    team: [['psyduck', 33], ['psyduck', 33]], prize: 16,
    intro: 'Hai con Psyduck của anh bơi nhanh hơn cả anh!', lose: 'Psyduck ôm đầu rồi...', after: 'Xuôi dòng về phía đông là ao Thị trấn Lục Bình.',
  },
  {
    id: 'rv-fisher-trainer', sprite: 'npc-fisher', name: 'Ngư dân Lực', map: 'river1', x: 23, y: 12, facing: 'up', sight: 2,
    team: [['magikarp', 30], ['goldeen', 33], ['seaking', 34]], prize: 20,
    intro: 'Đừng làm cá của ta sợ chạy mất! Đấu xong rồi hẵng đi!', lose: 'Hôm nay đen thật, chẳng câu được gì...', after: 'Kiên nhẫn là bí quyết của người câu cá.',
  },
  // Gym 5-8: nhà huấn luyện trên đường
  {
    id: 'r7-camper', sprite: 'npc-camper', name: 'Anh Lửa', map: 'route7', x: 36, y: 17, facing: 'right', sight: 1,
    team: [['ponyta', 30], ['vulpix', 30]], prize: 24,
    intro: 'Lửa trại đang cháy, đấu một trận cho ấm người nào!', lose: 'Lửa tàn rồi...', after: 'Xuống hết dốc rồi leo ruộng bậc thang là tới Làng Đất Sét.',
  },
  {
    id: 'r7-lass', sprite: 'npc-lass', name: 'Bé Linh', map: 'route7', x: 24, y: 16, facing: 'down', sight: 1,
    team: [['hypno', 30], ['slowpoke', 31]], prize: 16,
    intro: 'Em đoán được bạn định đi đâu đó!', lose: 'Ơ, đoán sai rồi...', after: 'Pokémon hệ Siêu linh khó đoán lắm.',
  },
  {
    id: 'r8-hiker', sprite: 'npc-hiker', name: 'Chú Thạch', map: 'route8', x: 19, y: 17, facing: 'right', sight: 1,
    team: [['graveler', 33], ['graveler', 34]], prize: 30,
    intro: 'Leo núi mỏi chân, đấu một trận giãn gân nào!', lose: 'Đá lở rồi!', after: 'Qua Bản Vách Đá phía tây là tới Núi Đá, đường hơi dốc đấy.',
  },
  {
    id: 'r8-camper', sprite: 'npc-camper', name: 'Anh Cường', map: 'route8', x: 30, y: 18, facing: 'right', sight: 1,
    team: [['rhyhorn', 34], ['arbok', 34]], prize: 24,
    intro: 'Đường núi không dành cho kẻ yếu!', lose: 'Em mạnh thật.', after: 'Có hòn đá cứng thì chiêu hệ Đá mạnh hơn.',
  },
  {
    id: 'r9-psychic', sprite: 'npc-lass', name: 'Chị Huyền', map: 'route9', x: 12, y: 5, facing: 'down', sight: 1,
    team: [['kadabra', 37], ['hypno', 37]], prize: 24,
    intro: 'Chị đã thấy em trong giấc mơ đêm qua...', lose: 'Giấc mơ không như chị thấy.', after: 'Hang Sơn Động ở bên kia suối, qua hai cầu gỗ là tới.',
  },
  {
    id: 'r9-hiker', sprite: 'npc-hiker', name: 'Bác Đá', map: 'route9', x: 31, y: 16, facing: 'right', sight: 1,
    team: [['onix', 37], ['graveler', 37], ['golbat', 37]], prize: 30,
    intro: 'Muốn vào hang thì phải qua bác!', lose: 'Ha ha, khá lắm!', after: 'Trong hang tối, nhớ mang thuốc đầy đủ.',
  },
  {
    id: 'r10-skier', sprite: 'npc-youngster', name: 'Nhóc Băng', map: 'route10', x: 13, y: 2, facing: 'down', sight: 3,
    team: [['dewgong', 41], ['jynx', 42]], prize: 20,
    intro: 'Trên này lạnh lắm, đấu cho nóng người nào!', lose: 'Lạnh cóng rồi...', after: 'Qua Làng Đèo Tuyết phía đông là tới Thành phố Sương Mù.',
  },
  {
    id: 'r10-swimmer', sprite: 'npc-lass', name: 'Chị Băng Tâm', map: 'route10', x: 25, y: 22, facing: 'down', sight: 3,
    team: [['shellder', 42], ['dewgong', 43]], prize: 16,
    intro: 'Chị vừa bơi trong hồ lạnh xong, khoẻ lắm!', lose: 'Nước lạnh quá...', after: 'Hồ Lạnh phía đông có cả Lapras đó.',
  },
  // Liên minh: tinh anh trên Đường Chiến Thắng và trong Hang Vân Sơn
  {
    id: 'r11-ace1', sprite: 'npc-ace', name: 'Tinh anh Bảo', map: 'route11', x: 21, y: 26, facing: 'down', sight: 5,
    team: [['machamp', 47], ['arcanine', 47, ['flamethrower', 'extremeSpeed', 'bite', 'takeDown']], ['starmie', 48]], prize: 40,
    intro: 'Đủ 8 huy hiệu rồi à? Để xem cậu có xứng lên Liên minh không!', lose: 'Cậu xứng đáng thật.', after: 'Leo hết ba bậc sườn núi phía đông là tới cửa Hang Vân Sơn.',
  },
  {
    id: 'r11-ace2', sprite: 'npc-ace-f', name: 'Tinh anh Ngọc', map: 'route11', x: 24, y: 20, facing: 'down', sight: 4,
    team: [['vileplume', 47], ['dewgong', 48], ['alakazam', 48]], prize: 40,
    intro: 'Tôi luyện ở đây cả năm trời chờ người như cậu!', lose: 'Phải luyện thêm năm nữa rồi...', after: 'Tứ Thiên Vương mạnh hơn tôi nhiều lắm.',
  },
  {
    id: 'c3-ace1', sprite: 'npc-ace', name: 'Tinh anh Thạch', map: 'cave3', x: 18, y: 18, facing: 'down', sight: 2,
    team: [['golem', 49], ['rhydon', 49]], prize: 40,
    intro: 'Hang Vân Sơn là thử thách cuối trước Liên minh!', lose: 'Đá cũng phải vỡ...', after: 'Vách băng chắn lối ra rồi. Xuống thang ở phòng phía đông, qua tầng hầm rồi leo lên phía tây bắc.',
  },
  {
    id: 'c3-ace2', sprite: 'npc-ace-f', name: 'Tinh anh Vân', map: 'cave3b', x: 31, y: 12, facing: 'left', sight: 1,
    team: [['dragonair', 48], ['gyarados', 49]], prize: 40,
    intro: 'Rồng của tôi đã đợi cậu từ lâu!', lose: 'Rồng cũng biết mỏi cánh...', after: 'Dưới hầm băng sâu có báu vật, nhưng Pokémon ở đó mạnh lắm.',
  },
  {
    id: 'c3-psychic', sprite: 'npc-lass', name: 'Tinh anh Tuệ', map: 'cave3', x: 29, y: 3, facing: 'right', sight: 4,
    team: [['hypno', 49], ['gengar', 49], ['slowbro', 49]], prize: 40,
    intro: 'Tôi thấy trước cậu sẽ đi qua đây.', lose: 'Tương lai đã thay đổi...', after: 'Cao nguyên Liên Minh ngay phía trên kia.',
  },
];

// Nhà huấn luyện / NPC ở các khu mở rộng (data/extra/), học trò và hướng dẫn viên trong gym (data/gymPeople.js)
TRAINERS.push(...EXTRA_TRAINERS, ...GYM_TRAINERS);
NPCS.push(...EXTRA_NPCS, ...GYM_GUIDES);
