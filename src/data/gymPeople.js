import { state } from '../game/state.js';
import { BADGES } from './badges.js';

// Người trong 8 gym: hướng dẫn viên (đứng gần lối vào, giải thích câu đố) và học trò (nhà huấn luyện của gym).
// Vị trí khớp bố cục trong data/mapsGyms.js (không đứng chắn lối duy nhất, đã kiểm tra bằng bộ giải trong test).

const GUIDE_TIPS = {
  gym1: [6, 18, [
    'Gym Đồi Gió dùng Pokémon hệ Bay: hệ Điện, Đá và Băng sẽ có lợi thế!',
    'Hàng gió thổi xuống sẽ hất cậu về tầng dưới. Chỉ ô gió thổi ngược lên mới đưa cậu lên trên.',
    'Luồng gió ngang cuốn người đi tới khi đụng vật cản. Nhìn kỹ xem luồng nào dẫn tới đâu nhé!',
  ]],
  gym2: [6, 17, [
    'Gym Lúa Vàng dùng Pokémon hệ Cỏ - Độc: hệ Lửa, Bay, Băng, Siêu linh sẽ có lợi thế!',
    'Cổng tre ở đây nối với nhau: dẫm công tắc thì cổng này mở nhưng cổng khác lại đóng.',
    'Thứ tự dẫm công tắc mới là bí quyết. Lỡ bị nhốt thì cứ dẫm lại công tắc vừa rồi.',
  ]],
  gym3: [6, 17, [
    'Gym Đèn Lồng dùng Pokémon hệ Điện: hệ Đất là khắc tinh!',
    'Thầy Quang tắt hết đèn rồi! Gặp cột đèn lồng thì bấm vào để thắp, cả vùng quanh đó sẽ sáng lên.',
    'Dẫm công tắc là hàng rào điện đổi chỗ. Bật điện, tắt điện đúng lúc mới qua được từng phòng.',
  ]],
  gym4: [6, 16, [
    'Gym Sông Nước dùng Pokémon hệ Nước: hệ Cỏ và Điện sẽ có lợi thế!',
    'Dòng nước cuốn người từ đảo này sang đảo khác. Xoáy nước thì cuốn về tận lối vào đấy!',
    'Hai cửa cống đang đóng: công tắc cống nằm trên hai hòn đảo khác nhau.',
  ]],
  gym5: [6, 16, [
    'Gym Lò Gốm dùng Pokémon hệ Lửa: hệ Nước, Đất và Đá sẽ có lợi thế!',
    'Miệng lò phụt lửa thay phiên nhau theo nhịp. Đợi lửa tắt rồi hãy bước qua!',
    'Than hồng hai bên thì lúc nào cũng nóng, đừng dẫm vào.',
  ]],
  gym6: [12, 15, [
    'Gym Núi Đá dùng Pokémon hệ Đá: hệ Nước, Cỏ, Giác đấu, Đất là khắc tinh!',
    'Đường lên bị hố sâu chặn ngang. Đẩy tảng đá lăn xuống hố là có đường đi.',
    'Đẩy đá vào góc là kẹt luôn đó. Lỡ tay thì cứ ra ngoài rồi vào lại, đá sẽ về chỗ cũ.',
  ]],
  gym7: [6, 17, [
    'Gym Chùa Cổ dùng Pokémon hệ Siêu linh: hệ Bọ, Ma, Bóng tối sẽ có lợi thế.',
    'Bảy phòng chỉ nối nhau bằng ô dịch chuyển. Có ô dẫn vào ngõ cụt, có ô đưa về đây.',
    'Nhớ ô nào dẫn tới phòng nào nhé. Thiền tâm sẽ thấy đường!',
  ]],
  gym8: [6, 18, [
    'Gym Sương Mù dùng Pokémon hệ Nước - Băng: hệ Điện, Giác đấu, Cỏ sẽ có lợi thế (riêng Jynx sợ Lửa, Thép, Đá)!',
    'Hai sân băng trơn lắm: bước lên là trượt tới khi đụng tảng băng.',
    'Tìm tảng băng làm điểm dừng ngay dưới khe hở rồi hãy trượt lên.',
  ]],
};

// Đã có huy hiệu của gym thì câu đố đã tắt (WorldScene.setupGymPuzzle): hướng dẫn viên chúc mừng thay vì giải thích câu đố
export const GYM_GUIDES = Object.entries(GUIDE_TIPS).map(([map, [x, y, lines]], i) => ({
  id: `${map}-guide`, sprite: 'npc-guide', name: 'Hướng dẫn viên', map, x, y, facing: 'right', fixed: true,
  lines: ['Chào mừng nhà vô địch tương lai!', ...lines],
  async onTalk(world) {
    const badge = BADGES[i];
    await world.say(this.name, state.badges.has(badge.id)
      ? [`${badge.name} hợp với cậu lắm!`, 'Câu đố trong gym đã tắt rồi, cậu cứ ra vào thoải mái nhé.']
      : this.lines);
  },
}));

const t = (id, sprite, name, map, x, y, facing, sight, team, intro, lose, after, prize = 24) => ({
  id, sprite, name, map, x, y, facing, sight, team, prize, intro, lose, after,
});

export const GYM_TRAINERS = [
  t('gym1-a', 'npc-birdkeeper', 'Học trò Gió', 'gym1', 4, 9, 'right', 3, [['pidgey', 12], ['zubat', 12]],
    'Muốn gặp thủ lĩnh thì phải vượt qua cơn gió của tôi!', 'Gió đổi chiều rồi...', 'Luồng gió bên phải đưa lên tầng trên đó.'),
  t('gym1-b', 'npc-birdkeeper', 'Học trò Mây', 'gym1', 13, 7, 'right', 2, [['pidgey', 13], ['pidgey', 13]],
    'Cậu đã lên được tới đây sao? Không dễ đâu!', 'Cậu bay cao hơn tôi rồi.', 'Đi men tầng trên sang lối giữa là tới thủ lĩnh Phong.'),
  t('gym2-a', 'npc-lass', 'Học trò Mạ', 'gym2', 11, 7, 'left', 2, [['bellsprout', 19], ['oddish', 19]],
    'Hạt giống nào cũng có lúc nảy mầm!', 'Mầm non bị dập rồi...', 'Hai cổng cuối cần một cổng mở, một cổng khép... ngược nhau đó!'),
  t('gym2-b', 'npc-camper', 'Học trò Rơm', 'gym2', 6, 12, 'down', 1, [['gloom', 21]],
    'Lạc vào khu phía tây rồi à? Đấu đã!', 'Rơm khô cháy nhanh thật...', 'Cổng phía trên chỉ mở khi đã dẫm công tắc góc trái phòng giữa.'),
  t('gym3-a', 'npc-boy', 'Học trò Tia', 'gym3', 6, 10, 'left', 3, [['voltorb', 23], ['magnemite', 23]],
    'Điện áp cao, cẩn thận đó!', 'Tôi bị giật ngược rồi!', 'Bật điện ở phòng tây thì cửa phòng đông mới mở.'),
  t('gym3-b', 'npc-youngster', 'Học trò Chớp', 'gym3', 5, 5, 'right', 3, [['pikachu', 24], ['voltorb', 24]],
    'Nhanh như chớp!', 'Chớp tắt rồi...', 'Cửa thầy Quang chỉ mở khi có điện.'),
  t('gym4-a', 'npc-lass', 'Học trò Sóng', 'gym4', 4, 11, 'left', 3, [['goldeen', 27, ['waterPulse', 'hornAttack', 'peck', 'supersonic']], ['staryu', 27]],
    'Dòng nước sẽ cuốn bay cậu!', 'Sóng lặng rồi...', 'Cống phía trên chỉ mở khi đã gạt công tắc ở đảo đông.'),
  t('gym4-b', 'npc-fisher', 'Học trò Lạch', 'gym4', 15, 7, 'left', 3, [['tentacool', 28], ['psyduck', 28, ['waterGun', 'confusion', 'scratch', 'tailWhip']]],
    'Tới được đây là giỏi lắm, nhưng phải qua tôi đã!', 'Cậu bơi giỏi thật.', 'Dòng nước sát cạnh xoáy kia là bẫy đó.'),
  t('gym4-c', 'npc-lass', 'Học trò Thác', 'gym4', 14, 9, 'left', 2, [['seel', 28], ['poliwhirl', 28]],
    'Đảo này là của tôi!', 'Thác đổ rồi...', 'Gạt công tắc xong thì theo dòng nước phía tây mà về.'),
  t('gym5-a', 'npc-camper', 'Học trò Than', 'gym5', 1, 11, 'right', 4, [['growlithe', 34], ['ponyta', 34]],
    'Than hồng nóng chưa? Pokémon của tôi còn nóng hơn!', 'Nguội rồi...', 'Đợi lửa tắt hẳn rồi chạy một mạch qua.'),
  t('gym5-b', 'npc-youngster', 'Học trò Lửa', 'gym5', 15, 8, 'left', 4, [['vulpix', 35], ['rapidash', 35]],
    'Qua được lửa là giỏi, nhưng còn tôi nữa!', 'Cháy rụi rồi...', 'Hàng lửa tiếp theo ở phía tây.'),
  t('gym5-c', 'npc-camper', 'Học trò Gốm', 'gym5', 2, 5, 'right', 3, [['ninetales', 35], ['charmeleon', 35]],
    'Lò nung sắp tới độ nóng nhất rồi!', 'Gốm nứt mất rồi...', 'Thầy Nung đang đợi ở trên.'),
  t('gym6-a', 'npc-hiker', 'Học trò Sỏi', 'gym6', 13, 9, 'left', 3, [['graveler', 37], ['onix', 37]],
    'Đá này nặng lắm, cậu đẩy nổi không?', 'Sỏi đá vụn rồi...', 'Tảng đá giữa đẩy thẳng lên là lấp được hố.', 30),
  t('gym6-b', 'npc-camper', 'Học trò Đá Vôi', 'gym6', 3, 13, 'right', 2, [['rhyhorn', 38], ['graveler', 38]],
    'Hố đầu tiên khó nhất đó!', 'Tôi lở rồi!', 'Đẩy tảng đá bên trái sang giữa rồi đẩy lên.'),
  t('gym7-a', 'npc-lass', 'Học trò Thiền', 'gym7', 4, 8, 'right', 3, [['hypno', 40], ['alakazam', 40]],
    'Tôi đã đoán trước cậu sẽ dịch chuyển tới đây.', 'Không đoán được kết quả này...', 'Ô góc dưới phòng này dẫn sang khu đông phòng bên.'),
  t('gym7-b', 'npc-boy', 'Học trò Định', 'gym7', 14, 7, 'left', 2, [['slowbro', 41], ['hypno', 41]],
    'Tâm bất biến giữa dòng đời vạn biến!', 'Tâm loạn rồi...', 'Ô phía trên kia dẫn tới chị Tâm.'),
  t('gym7-c', 'npc-lass', 'Học trò Tĩnh', 'gym7', 11, 12, 'down', 1, [['kadabra', 40], ['drowzee', 40]],
    'Phòng này yên tĩnh lắm, sao cậu lại tới?', 'Tĩnh tâm không nổi...', 'Ô bên trái phòng này dẫn lên phòng giữa phía tây.'),
  t('gym8-a', 'npc-lass', 'Học trò Sương', 'gym8', 15, 10, 'left', 3, [['dewgong', 44], ['cloyster', 44]],
    'Sàn băng này trơn lắm, cậu trượt nổi không?', 'Tôi trượt ngã rồi...', 'Sân trên: trượt lên trước, rồi sang phải, rồi lên tiếp.'),
  t('gym8-b', 'npc-girl', 'Học trò Giá', 'gym8', 1, 10, 'right', 3, [['jynx', 45], ['dewgong', 45]],
    'Lạnh giá mới là sức mạnh thật sự!', 'Băng tan mất rồi...', 'Chị Tuyết là người lạnh lùng nhất cao nguyên.'),
];
