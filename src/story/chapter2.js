import { BADGES } from '../data/badges.js';
import { MAPS } from '../data/map.js';
import { state } from '../game/state.js';
import { leagueObjective } from './league.js';
import { VILLAGES, villageDone, villageGate, villageObjective } from './villages.js';

// Hành trình qua các gym của vùng Sơn Thủy (sau khi xong chương 1): mỗi gym ở một thành phố, trước thành phố là một làng nhỏ.

export const hasBadge = (id) => state.badges.has(id);
const badge = (id) => BADGES.find((b) => b?.id === id);

// Các gym theo thứ tự: làng nhỏ ngay trước thành phố (village, story/villages.js), thành phố có gym (place),
// cách đi tới làng, tên thành phố, tên gym
export const GYMS = [
  { badge: 'wind', village: 'v1', place: 'town2', reach: 'Từ Thị trấn Lục Bình băng qua Hang Thạch Nhũ tới Làng Chân Đồi', city: 'Thành phố Đồi Gió', gym: 'Gym Đồi Gió' },
  { badge: 'grass', village: 'v2', place: 'town3', reach: 'Đi theo Tuyến đường 4 tới Xóm Cối Xay', city: 'Thành phố Lúa Vàng', gym: 'Gym Lúa Vàng' },
  { badge: 'electric', village: 'v3', place: 'town4', reach: 'Đi theo Tuyến đường 5 tới Xóm Trạm Điện', city: 'Thành phố Đèn Lồng', gym: 'Gym Đèn Lồng' },
  { badge: 'water', village: 'v4', place: 'town5', reach: 'Đi theo Tuyến đường 6 tới Làng Bến Đò', city: 'Thành phố Sông Nước', gym: 'Gym Sông Nước' },
  { badge: 'fire', village: 'v5', place: 'town6', reach: 'Từ Sông Nước đi Tuyến đường 7 về phía tây tới Làng Đất Sét', city: 'Thành phố Lò Gốm', gym: 'Gym Lò Gốm' },
  { badge: 'rock', village: 'v6', place: 'town7', reach: 'Đi theo Tuyến đường 8 tới Bản Vách Đá', city: 'Thành phố Núi Đá', gym: 'Gym Núi Đá' },
  { badge: 'psychic', village: 'v7', place: 'town8', reach: 'Đi Tuyến đường 9, xuyên Hang Sơn Động tới Xóm Hương Khói', city: 'Thành phố Chùa Cổ', gym: 'Gym Chùa Cổ' },
  { badge: 'ice', village: 'v8', place: 'town9', reach: 'Đi theo Tuyến đường 10 tới Làng Đèo Tuyết', city: 'Thành phố Sương Mù', gym: 'Gym Sương Mù' },
];

// Thủ lĩnh gym: nói chuyện để thách đấu; thắng thì nhận huy hiệu, quà và tiền thưởng
// gift: quà thêm (vd: HM) { item, line }
function leader({ badgeId, name, sprite, map, team, intro, lose, after, reward, rewardLine, gift }) {
  return {
    id: `leader-${badgeId}`, sprite, name, map, x: 8, y: 2, facing: 'down', fixed: true, sight: 0,
    team, prize: 100, noRematch: true, leader: true, intro, lose, after, gift,
    async onDefeat(world) {
      const b = badge(badgeId);
      state.badges.add(b.id);
      await world.say(name, [`Đây là bằng chứng cậu đã chiến thắng: ${b.name}!`]);
      await world.showBadge(b);
      await world.say(name, [rewardLine]);
      await world.giveItem(reward);
      if (gift) {
        await world.say(name, [gift.line]);
        await world.giveItem(gift.item);
      }
      const left = BADGES.length - state.badges.size;
      await world.say(name, [left > 0
        ? `Còn ${left} gym nữa trong vùng Sơn Thủy. Đủ 8 huy hiệu thì cậu có thể thách đấu Liên minh!`
        : 'Cậu đã đủ 8 huy hiệu! Liên minh đang chờ cậu.']);
      // Có huy hiệu rồi thì câu đố trong gym ngừng hoạt động (WorldScene.clearGym)
      await world.clearGym?.();
    },
  };
}

export const CHAPTER2_NPCS = [
  leader({
    badgeId: 'wind', name: 'Thủ lĩnh Phong', sprite: 'npc-leader-wind', map: 'gym1',
    team: [['pidgey', 13], ['zubat', 14], ['pidgeotto', 16]],
    intro: 'Chào mừng tới Gym Đồi Gió! Ta là Phong. Pokémon hệ Bay của ta lướt theo gió, không gì cản nổi! Thử xem cậu có theo kịp không!',
    lose: 'Cơn gió của cậu còn mạnh hơn của ta... Ta thua rồi.',
    after: 'Cậu đã có Huy hiệu Cánh Gió. Hãy tiếp tục bay xa hơn nữa!',
    reward: 'sharpBeak', rewardLine: 'Ta tặng cậu thêm cái mỏ chim sắc này. Cho Pokémon cầm thì chiêu hệ Bay mạnh hơn.',
  }),
  leader({
    badgeId: 'grass', name: 'Thủ lĩnh Thảo', sprite: 'npc-leader-grass', map: 'gym2',
    team: [
      ['gloom', 21, ['megaDrain', 'acid', 'sleepPowder', 'stunSpore']],
      ['weepinbell', 21, ['vineWhip', 'acid', 'wrap', 'sleepPowder']],
      ['ivysaur', 23, ['razorLeaf', 'vineWhip', 'poisonPowder', 'growl']],
    ],
    intro: 'Chị là Thảo. Cây lúa phải qua nắng mưa mới trổ bông vàng. Để xem Pokémon của em đã đủ chín chưa nhé!',
    lose: 'Một mùa gặt bội thu... của em. Chị thua rồi.',
    after: 'Hạt giống em gieo hôm nay sẽ thành cánh đồng ngày mai.',
    reward: 'miracleSeed', rewardLine: 'Tặng em hạt giống thần kỳ này. Cho Pokémon cầm thì chiêu hệ Cỏ mạnh hơn.',
  }),
  leader({
    badgeId: 'electric', name: 'Thủ lĩnh Quang', sprite: 'npc-leader-electric', map: 'gym3',
    team: [['voltorb', 25], ['magnemite', 26], ['raichu', 28]],
    intro: 'Anh là Quang, người thắp sáng cả phố đèn lồng! Để xem em có chịu nổi vài nghìn vôn không nào!',
    lose: 'Cầu chì của anh cháy mất rồi! Em giỏi lắm!',
    after: 'Mỗi khi đèn lồng sáng lên, nhớ tới trận đấu hôm nay nhé.',
    reward: 'magnet', rewardLine: 'Cầm lấy cục nam châm này. Cho Pokémon cầm thì chiêu hệ Điện mạnh hơn.',
  }),
  leader({
    badgeId: 'water', name: 'Thủ lĩnh Thủy', sprite: 'npc-leader-water', map: 'gym4',
    team: [
      ['tentacool', 29, ['bubbleBeam', 'acid', 'wrap', 'supersonic']],
      ['golduck', 31, ['waterPulse', 'confusion', 'furySwipes', 'screech']],
      ['starmie', 33, ['bubbleBeam', 'psybeam', 'swift', 'rapidSpin']],
    ],
    intro: 'Chị là Thủy. Nước tuy mềm mà mài mòn cả đá. Em có đủ kiên nhẫn để vượt qua dòng chảy của chị không?',
    lose: 'Dòng sông đã đổi hướng theo em rồi...',
    after: 'Hãy luôn mềm dẻo như nước, em sẽ đi được rất xa.',
    reward: 'mysticWater', rewardLine: 'Đây là giọt nước huyền bí. Cho Pokémon cầm thì chiêu hệ Nước mạnh hơn.',
    gift: { item: 'hmSurf', line: 'Còn đây là HM03 Surf. Dạy cho Pokémon hệ Nước là nó chở em lướt sóng khắp vùng Sơn Thủy!' },
  }),
  leader({
    badgeId: 'fire', name: 'Thủ lĩnh Nung', sprite: 'npc-leader-fire', map: 'gym5',
    team: [
      ['ninetales', 36, ['flamethrower', 'quickAttack', 'confuseRay', 'tailWhip']],
      ['rapidash', 37, ['flameWheel', 'stomp', 'takeDown', 'tailWhip']],
      ['arcanine', 39, ['flamethrower', 'extremeSpeed', 'bite', 'takeDown']],
    ],
    intro: 'Ta là Nung, giữ lửa lò gốm này đã ba mươi năm. Đất sét phải qua lửa mới thành gốm. Để xem cậu có chịu được sức nóng không!',
    lose: 'Lửa tắt rồi... Nhưng mẻ gốm này thành công: đó là cậu.',
    after: 'Lửa của cậu còn cháy mãi. Cứ thế mà tiến lên!',
    reward: 'charcoal', rewardLine: 'Cầm lấy cục than hồng này. Cho Pokémon cầm thì chiêu hệ Lửa mạnh hơn.',
  }),
  leader({
    badgeId: 'rock', name: 'Thủ lĩnh Sơn', sprite: 'npc-leader-rock', map: 'gym6',
    team: [
      ['graveler', 39, ['rockSlide', 'earthquake', 'defenseCurl', 'selfDestruct']],
      ['onix', 40, ['rockSlide', 'dragonBreath', 'sandstorm', 'slam']],
      ['rhydon', 42, ['earthquake', 'rockSlide', 'hornAttack', 'scaryFace']],
    ],
    intro: 'Ta là Sơn. Đi được trong bóng tối tới đây là có bản lĩnh. Nhưng núi đá thì không bao giờ lùi bước!',
    lose: 'Núi cũng có ngày lở... Cậu thắng rồi.',
    after: 'Hãy vững vàng như núi, dù đường phía trước tối tăm.',
    reward: 'hardStone', rewardLine: 'Đây là hòn đá cứng. Cho Pokémon cầm thì chiêu hệ Đá mạnh hơn.',
  }),
  leader({
    badgeId: 'psychic', name: 'Thủ lĩnh Tâm', sprite: 'npc-leader-psychic', map: 'gym7',
    team: [['hypno', 43], ['slowbro', 43], ['alakazam', 45]],
    intro: 'Chị là Tâm. Chị đã biết em sẽ tới, và biết cả chiêu em định dùng. Nhưng biết trước chưa chắc đã thắng... thử xem nào.',
    lose: 'Chị đã thấy trước kết cục này... nhưng không ngờ lại đẹp đến vậy.',
    after: 'Tâm có tĩnh thì mới thấy đường đi. Chúc em vững tâm.',
    reward: 'twistedSpoon', rewardLine: 'Tặng em chiếc thìa uốn cong này. Cho Pokémon cầm thì chiêu hệ Siêu linh mạnh hơn.',
  }),
  leader({
    badgeId: 'ice', name: 'Thủ lĩnh Tuyết', sprite: 'npc-leader-ice', map: 'gym8',
    team: [['dewgong', 47], ['cloyster', 47], ['jynx', 48], ['lapras', 50]],
    intro: 'Tôi là Tuyết. Trên cao nguyên này, chỉ ai bước vững trên băng mới đứng được trước mặt tôi. Đấu thôi.',
    lose: 'Băng đã tan... Cậu là người đầu tiên làm được điều đó.',
    after: 'Tám huy hiệu rồi. Đường đèo tới Liên minh đang chờ cậu.',
    reward: 'neverMeltIce', rewardLine: 'Cục băng không bao giờ tan này là của cậu. Cho Pokémon cầm thì chiêu hệ Băng mạnh hơn.',
  }),
];

// Mục tiêu sau chương 1: lần lượt tới làng trước thành phố, làm nhiệm vụ của làng, vào thành phố rồi thách đấu gym
export function objective2() {
  for (const g of GYMS) {
    if (hasBadge(g.badge)) continue;
    if (!state.visited.has(g.place)) {
      const village = VILLAGES.find((v) => v.id === g.village);
      if (!state.visited.has(MAPS[village.map].place)) return g.reach;
      if (!villageDone(g.village)) return villageObjective(g.village);
      return `Vào ${g.city}`;
    }
    return `Thách đấu ${g.gym}`;
  }
  return leagueObjective();
}

// Lối ra khỏi thành phố chỉ mở khi đã có huy hiệu gym ở đó (data/map.js: gates { badge }),
// đường tới Liên minh cần đủ số huy hiệu (gates { badges }), lối từ làng sang thành phố cần xong nhiệm vụ của làng (gates { village })
export function badgeGate(world, x, y) {
  const gate = world.map.gateAt(x, y);
  if (!gate) return null;
  if (gate.village) return villageGate(world, gate);
  if (gate.badges) {
    if (state.badges.size >= gate.badges) return null;
    return () => world.say('Lính gác', [
      `Chỉ nhà huấn luyện có đủ ${gate.badges} huy hiệu mới được lên Liên minh.`,
      `Cậu mới có ${state.badges.size} huy hiệu. Hãy quay lại khi đủ nhé!`,
    ]);
  }
  if (hasBadge(gate.badge)) return null;
  return () => world.say('Người gác', [`Đường phía trước rất nguy hiểm. Phải có ${badge(gate.badge).name} mới được đi qua!`]);
}
