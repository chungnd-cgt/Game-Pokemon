// Dân làng: đứng trước mặt và bấm Enter/Space để nói chuyện (nói được qua quầy).
// map: bản đồ NPC đứng • wander: số ô tối đa đi lang thang (0 = đứng yên, chỉ xoay người)
// role: 'nurse' (hồi phục) / 'clerk' (mở cửa hàng); fixed: đứng yên, không xoay
export const NPCS = [
  { id: 'joy', sprite: 'npc-joy', name: 'Y tá Joy', map: 'center', x: 6, y: 2, facing: 'down', fixed: true, role: 'nurse' },
  {
    id: 'visitor', sprite: 'npc-boy', name: 'Cậu bé', map: 'center', x: 4, y: 6, facing: 'up', wander: 1,
    lines: ['Pokémon Center hồi phục Pokémon miễn phí đó!', 'Máy tính trong góc kia sau này sẽ dùng để gửi Pokémon.'],
  },
  { id: 'clerk', sprite: 'npc-clerk', name: 'Nhân viên', map: 'mart', x: 1, y: 2, facing: 'down', fixed: true, role: 'clerk' },
  {
    id: 'shopper', sprite: 'npc-woman', name: 'Khách hàng', map: 'mart', x: 7, y: 4, facing: 'left', wander: 1,
    lines: ['Great Ball đắt hơn nhưng bắt Pokémon dễ hơn nhiều.', 'Đồ không dùng tới thì bán lại cho cửa hàng được nửa giá đấy.'],
  },
  {
    id: 'oldman', sprite: 'npc-oldman', name: 'Ông lão', map: 'route1', x: 9, y: 11, facing: 'down', wander: 2,
    lines: [
      'Hồi trẻ ta cũng từng là một nhà huấn luyện Pokémon đấy...',
      'Mẹo nhỏ: đánh cho Pokémon hoang dã yếu đi rồi hãy ném Poké Ball, dễ bắt hơn nhiều!',
    ],
  },
  {
    id: 'girl', sprite: 'npc-girl', name: 'Cô gái', map: 'route1', x: 16, y: 12, facing: 'left', wander: 2,
    lines: ['Nghe nói ở bụi cỏ rậm phía đông có cả Pikachu đó!', 'Mình mãi chưa bắt được con nào...'],
  },
  {
    id: 'boy', sprite: 'npc-boy', name: 'Cậu bé', map: 'route1', x: 26, y: 13, facing: 'down', wander: 3,
    lines: ['Bấm P để mở Pokédex nha!', 'Gặp Pokémon nào là Pokédex ghi lại, bắt được thì xem được hết thông tin luôn!'],
  },
  {
    id: 'fisher', sprite: 'npc-fisher', name: 'Ngư dân', map: 'route1', x: 31, y: 17, facing: 'left', wander: 0,
    lines: ['Hồ này đẹp nhỉ? Tiếc là chưa có cần câu...', 'Muốn gặp Poliwag thì vào bụi cỏ quanh đây mà tìm.'],
  },
  {
    id: 'woman', sprite: 'npc-woman', name: 'Cô hàng xóm', map: 'route1', x: 10, y: 8, facing: 'down', wander: 1,
    lines: ['Poké Mart bên cạnh có bán Great Ball đấy.', 'Đánh thắng các nhà huấn luyện là có tiền mua sắm!'],
  },
];

// Nhà huấn luyện: thấy bạn trong tầm nhìn (sight ô theo hướng đang nhìn) thì tới thách đấu.
// Thắng rồi thì nói chuyện lại để đấu lại (nói câu after rồi hỏi). prize: tiền thưởng = prize x cấp Pokémon cuối.
export const TRAINERS = [
  {
    id: 'youngster', sprite: 'npc-youngster', name: 'Nhóc Tùng', map: 'route1', x: 24, y: 11, facing: 'up', sight: 3,
    team: [['rattata', 3], ['pidgey', 3]], prize: 16,
    intro: 'Ê! Mắt chạm mắt là phải đấu Pokémon!',
    lose: 'Á á! Thua rồi...',
    after: 'Tớ sẽ luyện Rattata với Pidgey mạnh hơn nữa!',
  },
  {
    id: 'lass', sprite: 'npc-lass', name: 'Bé Mai', map: 'route1', x: 17, y: 14, facing: 'right', sight: 3,
    team: [['pidgey', 5], ['oddish', 5]], prize: 20,
    intro: 'Bạn cũng có Pokémon à? Đấu thử với mình nhé!',
    lose: 'Ơ... mình thua rồi sao?',
    after: 'Pidgey của mình dễ thương mà, đúng không?',
  },
  {
    id: 'camper', sprite: 'npc-camper', name: 'Anh Hùng', map: 'route1', x: 36, y: 21, facing: 'down', sight: 3,
    team: [['poliwag', 7], ['growlithe', 7], ['pikachu', 8]], prize: 24,
    intro: 'Muốn vào bụi cỏ rậm à? Phải qua được anh đã!',
    lose: 'Khá lắm! Em mạnh hơn anh tưởng đấy.',
    after: 'Bụi cỏ rậm có Pokémon mạnh, nhớ mang theo nhiều thuốc nhé.',
  },
];

