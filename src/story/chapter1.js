import { ITEMS } from '../data/items.js';
import { MAPS } from '../data/map.js';
import { SPECIES } from '../data/monsters.js';
import { DEX_BY_SLUG } from '../data/pokedex.js';
import { createMonster } from '../game/monster.js';
import { hasFlag, itemCount, markCaught, playerName, setFlag, state, useItem } from '../game/state.js';
import { CHAPTER2_NPCS, badgeGate, objective2 } from './chapter2.js';
import { F_CHAMPION, LEAGUE_NPCS, leagueBlocker } from './league.js';
import { POSTGAME_NPCS, confirmChoice, fossilFound, momPostgame, oakPostgame, postgameObjective, postgameStep } from './postgame.js';
import { SAFARI_NPCS, safariBlocker } from './safari.js';
import { QUEST_NPCS, questTaken } from './quests.js';
import { RIVAL_NPCS, RIVAL_PICK, rivalStarter, rivalTrainer, rivalTrigger } from './rival.js';
import { ROCKET_NPCS, rocketObjective, rocketTrigger } from './rocket.js';
import { VILLAGE_NPCS } from './villages.js';

// Chương 1: Khởi hành. Các mốc cốt truyện lưu bằng cờ trong state.flags.
export const F = {
  MOM: 'talkedMom',
  MET_OAK: 'metOak',
  STARTER: 'gotStarter',
  RIVAL1: 'rival1',
  DEX: 'gotPokedex',
  QUEST_DONE: 'questDone',
  GRUNTS: 'gruntsDefeated', // đã đánh đuổi bộ đôi Team Rocket
  BOSS: 'rocketDefeated', // đã nhặt lại gói hàng của Poké Mart (tên cờ giữ như cũ để bản lưu cũ vẫn dùng được)
  MART_REWARD: 'martReward',
  RIVAL2: 'rival2', // thắng Gary ở Thị trấn Lục Bình lúc lên đường tới Hang Thạch Nhũ
  CLERK_BACK: 'martClerkBack', // nhân viên Poké Mart đứng chặn cửa hang đã cảm ơn và về lại cửa hàng
  DONE: 'chapter1Done',
  BIKE: 'gotBicycle',
  MOM_GIFT: 'momGift', // mẹ tặng Bản đồ vùng và Hộp huy hiệu
};

// Nhiệm vụ của Giáo sư Oak: bắt Pokémon đầu tiên (không tính Pokémon khởi đầu)
const QUEST_TARGET = 1;
// Phòng thí nghiệm: chỗ hai đứa đứng trước bàn Giáo sư Oak sau khi chọn Pokémon
const PLAYER_SPOT = { x: 5, y: 6 };
const GARY_SPOT = { x: 7, y: 6 };
// Thị trấn Lục Bình: vùng trước cửa Hang Thạch Nhũ [x1, y1, x2, y2]; bước vào lúc chuẩn bị lên đường là Gary ra đấu lại
const CAVE_APPROACH = [24, 6, 29, 7];
// Ba Pokémon khởi đầu thường; Pikachu là bóng bí mật, phải từ chối cả ba con này mới chọn được
const REGULAR_STARTERS = ['bulbasaur', 'charmander', 'squirtle'];
const SECRET_STARTER = 'pikachu';
export const declinedAllStarters = () => REGULAR_STARTERS.every((s) => hasFlag(`declined:${s}`));

const flagValue = (prefix) => [...state.flags].find((f) => f.startsWith(prefix))?.slice(prefix.length) ?? null;
export const playerStarter = () => flagValue('starter:');
const starterTaken = (species) => playerStarter() === species || rivalStarter() === species;

// Số loài đã bắt được (tối đa bằng mục tiêu nhiệm vụ), không tính Pokémon khởi đầu
export function questProgress() {
  const starter = playerStarter();
  const starterId = starter ? DEX_BY_SLUG[starter].id : null;
  return Math.min(QUEST_TARGET, [...state.dex.caught].filter((id) => id !== starterId).length);
}

// Nhiệm vụ bắt Pokémon đầu tiên: người chơi cứ ném bóng mà không đánh yếu Pokémon hoang dã thì có thể hết sạch bóng và
// kẹt (chưa có tiền mua thêm, lối sang Tuyến đường 2 bị chặn). Nên quả bóng ĐẦU TIÊN ném ra (chưa bắt được con nào) chắc
// chắn bắt được; các lần sau tính tỉ lệ như thường. Gọi mỗi lần ném bóng; trả về true nếu lần ném này chắc chắn bắt được
const FIRST_BALL = 'firstBallThrown';
export function firstCatchThrow() {
  if (hasFlag(FIRST_BALL)) return false;
  setFlag(FIRST_BALL);
  return Boolean(playerStarter()) && questProgress() < QUEST_TARGET;
}

// Lời nhắc tìm mẹ theo chỗ đang đứng (mẹ ngồi ở phòng khách tầng 1)
const MOM_HINT = { home2f: 'Xuống tầng 1 nói chuyện với mẹ', home: 'Nói chuyện với mẹ' };

// Mục tiêu hiện tại, hiện ở góc màn hình. mapId: bản đồ đang đứng (mặc định: phòng ngủ lúc mới chơi)
export function objective(mapId = 'home2f') {
  if (!hasFlag(F.MET_OAK)) return hasFlag(F.MOM) ? 'Đi về phía bắc thị trấn tìm giáo sư' : MOM_HINT[mapId] ?? 'Về nhà nói chuyện với mẹ';
  if (!hasFlag(F.STARTER)) return 'Chọn Pokémon ở phòng thí nghiệm';
  if (!hasFlag(F.QUEST_DONE)) {
    const n = questProgress();
    return n >= QUEST_TARGET ? 'Quay lại báo cho Giáo sư Oak' : 'Bắt Pokémon hoang dã đầu tiên';
  }
  if (!hasFlag(F.DONE)) {
    if (!state.visited.has('town1')) return 'Đi theo Tuyến đường 2 tới Thị trấn Lục Bình';
    if (!hasFlag(F.GRUNTS)) return 'Đến Poké Mart Lục Bình xem có chuyện gì';
    if (!hasFlag(F.BOSS)) return 'Nhặt gói hàng Team Rocket đánh rơi trước Poké Mart';
    if (!hasFlag(F.MART_REWARD)) return 'Mang gói hàng vào trả cho Poké Mart Lục Bình';
    if (!hasFlag(F.RIVAL2)) return 'Lên đường tới Hang Thạch Nhũ phía bắc Lục Bình';
  }
  // Vô địch rồi: mẹ → Giáo sư Oak (Master Ball) → Pokémon huyền thoại (story/postgame.js)
  return postgameObjective() ?? rocketObjective() ?? objective2();
}

// Bậc tiến độ, dùng để mở dần hàng ở Poké Mart và cây quả tốt (Sitrus, Lum):
// 0 lúc đầu • 1 khi đã lấy lại hàng cho Poké Mart (cửa hàng nhập thêm hàng) • 2 khi xong chương 1
export function progressTier() {
  if (hasFlag(F.DONE)) return 2;
  if (hasFlag(F.MART_REWARD)) return 1;
  return 0;
}

// Pokédex chỉ mở được sau khi Giáo sư Oak tặng
export const hasPokedex = () => hasFlag(F.DEX);

// ---------- Nhân vật cốt truyện ----------

// Gary (đội hình các lần gặp: story/rival.js)
const rival1 = () => rivalTrainer('lab', { lose: 'Cái gì?! Mình chọn nhầm Pokémon rồi sao?', noBlackout: true });
const rival2 = () => rivalTrainer('town1', { lose: 'Hừ! Cậu chỉ gặp may thôi!' });

// Hỏi rõ trước khi đưa cần câu, nhận xong báo cách câu và ô phím tắt vừa được gán
async function giveRod(world, name, rod, lines) {
  await world.say(name, lines.slice(0, -1));
  if (!(await world.ask(lines[lines.length - 1], name))) {
    await world.say(name, ['Vậy à? Khi nào muốn câu cá thì cứ quay lại tìm ta nhé!']);
    return;
  }
  await world.giveItem(rod);
  const slot = world.assignHotbar(rod);
  await world.say(null, [
    'Muốn câu thì đứng quay mặt ra mặt nước, bấm vào cần câu trong túi đồ hoặc dùng ô phím tắt.',
    ...(slot === null ? [] : [`${ITEMS[rod].name} đã được gán vào ô phím tắt ${slot + 1} ở góc dưới màn hình.`]),
  ]);
}

// Các NPC chỉ xuất hiện ở một giai đoạn cốt truyện (show), có lời thoại riêng (onTalk)
export const STORY_NPCS = [
  {
    // Nhân viên Poké Mart Lục Bình đứng chặn trước cửa Hang Thạch Nhũ (không cho Team Rocket trốn vào hang) tới khi bạn đuổi
    // được Team Rocket và trả gói hàng; đi lên chỗ anh ấy thì anh cảm ơn rồi về lại cửa hàng (xem clerkThanks)
    id: 't1-clerk', sprite: 'npc-boy', name: 'Nhân viên Poké Mart', map: 'town1', x: 27, y: 6, facing: 'down', fixed: true,
    show: () => !hasFlag(F.CLERK_BACK) && !hasFlag(F.DONE),
    async onTalk(world) {
      if (hasFlag(F.MART_REWARD)) {
        await clerkThanks(world);
        return;
      }
      if (!hasFlag(F.GRUNTS)) {
        await world.say(this.name, [
          'Khoan đã! Không vào hang được đâu!',
          'Bọn Team Rocket vừa cướp gói hàng của Poké Mart chỗ tôi làm. Tôi đứng chặn ở đây để chúng không trốn vào hang!',
          'Cháu xuống Poké Mart ở khu phía đông thị trấn xem giúp tôi với!',
        ]);
      } else if (!hasFlag(F.BOSS)) {
        await world.say(this.name, ['Cháu đuổi được bọn chúng rồi à? Giỏi quá!', 'Gói hàng chúng đánh rơi trước cửa Poké Mart đó, nhặt giúp tôi nhé.']);
      } else {
        await world.say(this.name, ['Cháu nhặt được gói hàng rồi! Mang vào trả cho Poké Mart giúp tôi nhé.']);
      }
    },
  },
  {
    // Mẹ ngồi trên sofa bên phải bàn nước ở tầng 1 (seated: ngồi yên, quay mặt vào bàn, không đứng dậy quay theo người chơi)
    id: 'mom', sprite: 'npc-mom', name: 'Mẹ', map: 'home', x: 7, y: 4, facing: 'left', fixed: true, seated: true,
    async onTalk(world) {
      if (!hasFlag(F.MOM)) {
        // Chưa gặp mẹ mà đã đi gặp Giáo sư (bỏ qua mẹ, hoặc thua trận về nhà): đưa thuốc rồi nói tiếp như bình thường
        if (hasFlag(F.MET_OAK)) {
          await world.say('Mẹ', ['Con đi đâu từ sáng thế? Mẹ để dành mấy lọ thuốc cho con đây.']);
          await world.giveItem('potion', 2);
          setFlag(F.MOM);
        } else {
          await world.say('Mẹ', [
            'Con dậy rồi à?',
            'Hôm nay Giáo sư Oak hẹn con tới nhận Pokémon đầu tiên đó!',
            'Phòng thí nghiệm của ông ấy ở ngay cạnh nhà mình.',
            'Mang theo mấy lọ thuốc này đi đường nhé.',
          ]);
          await world.giveItem('potion', 2);
          setFlag(F.MOM);
          return;
        }
      }
      if (!state.party.length) {
        await world.say('Mẹ', ['Giáo sư Oak đang đợi con đó!']);
        return;
      }
      if (hasFlag(F.DEX) && !hasFlag(F.BIKE) && !itemCount('bicycle')) {
        await world.say('Mẹ', ['Giáo sư Oak giao việc cho con rồi à? Đường xa lắm đấy.', 'Nghe nói ở Thành phố Đèn Lồng có tiệm xe đạp, tới đó xem thử nhé!']);
        setFlag(F.BIKE);
      }
      // Vô địch rồi về nhà: mẹ chúc mừng, dặn sang gặp Giáo sư Oak (story/postgame.js)
      await momPostgame(world);
      await world.say('Mẹ', ['Trông con mệt quá. Nghỉ một chút đi!']);
      await world.fadeHeal();
      await world.say('Mẹ', ['Pokémon của con khỏe lại rồi đó. Đi cẩn thận nhé!']);
    },
  },
  {
    id: 'aide', sprite: 'npc-aide', name: 'Trợ lý', map: 'lab', x: 8, y: 9, facing: 'left', wander: 1,
    async onTalk(world) {
      await world.say('Trợ lý', hasFlag(F.MET_OAK)
        ? ['Giáo sư Oak là chuyên gia hàng đầu về Pokémon đấy!', 'Ông ấy đang nghiên cứu để hoàn thiện Pokédex.']
        : ['Giáo sư Oak đang ra ngoài rồi.', 'Ông ấy hay đi dạo quanh bụi cỏ phía bắc thị trấn lắm.']);
    },
  },
  {
    // Gary ở trên phòng mình (tầng 2 nhà Gary) cho tới khi bạn nhận Pokémon; lúc đó mới chạy sang phòng thí nghiệm (rivalPicksAndBattles)
    id: 'gary-home', sprite: 'npc-gary', name: 'Gary', map: 'garyHome2f', x: 5, y: 4, facing: 'down', wander: 1,
    show: () => !hasFlag(F.STARTER),
    async onTalk(world) {
      await world.say('Gary', hasFlag(F.MET_OAK)
        ? ['Gì? Ông nội về phòng thí nghiệm rồi à?', 'Cậu cứ chọn trước đi. Tớ chuẩn bị xong sẽ qua ngay, Pokémon mạnh nhất kiểu gì cũng là của tớ!']
        : ['Hôm nay ông nội hứa cho tớ một con Pokémon đó!', 'Ông đang đi dạo quanh bụi cỏ phía bắc. Tớ đợi ông về rồi mới qua phòng thí nghiệm.']);
    },
  },
  {
    id: 'oak', sprite: 'npc-oak', name: 'Giáo sư Oak', map: 'lab', x: 6, y: 3, facing: 'down', fixed: true,
    show: () => hasFlag(F.MET_OAK),
    onTalk: (world) => talkToOak(world),
  },
  // Ngư dân bên hồ Pallet: chỉ trò chuyện, chỉ đường tới người tặng cần câu
  {
    id: 'fisher', sprite: 'npc-fisher', name: 'Ngư dân', map: 'route1', x: 4, y: 19, facing: 'right', wander: 0,
    async onTalk(world) {
      await world.say('Ngư dân', itemCount('oldRod') || itemCount('goodRod') || itemCount('superRod')
        ? ['Cháu có cần câu rồi à? Hồ này toàn Magikarp với Poliwag thôi, nhưng câu cũng vui lắm.', 'Cần càng tốt thì càng câu được Pokémon hiếm.']
        : [
          'Hồ này có nhiều Pokémon lắm, nhưng cái cần của ta cũ quá rồi, không cho ai được.',
          'Ông lão ở bến câu Hồ Gương, Tuyến đường 6, hay tặng cần câu cho nhà huấn luyện trẻ. Đi tới đó thì ghé thăm ông ấy nhé!',
          'Nước hồ chảy ra con sông phía nam, xuôi tới tận ao Thị trấn Lục Bình. Khi nào có Pokémon biết Surf thì lướt theo dòng sông mà khám phá!',
        ]);
    },
  },
  // Cần câu tặng theo tiến độ, để Pokémon câu được không mạnh vượt đội của người chơi:
  // cần cũ ở bến câu Hồ Gương - Tuyến đường 6 (sau gym 3, đội khoảng Lv 25, cá Lv 10-15), cần tốt ở bờ suối Tuyến đường 9
  // (sau gym 6, đội khoảng Lv 40, cá Lv 30-35), cần siêu là phần thưởng của Lão Ngư Hồ Lạnh - Tuyến đường 10 sau khi
  // giúp ông hạ Gyarados chúa (cần có cần câu tốt, cá Lv 42-48)
  {
    id: 'r6-rod-giver', sprite: 'npc-oldman', name: 'Ông lão bến câu', map: 'route6', x: 38, y: 7, facing: 'left', fixed: true,
    async onTalk(world) {
      if (itemCount('oldRod')) {
        await world.say('Ông lão bến câu', ['Cá ở Hồ Gương có cả Tentacool, Goldeen. Cứ thả câu ở cuối bến mà thử.', 'Lên Tuyến đường 9 có ông bạn ta giữ cái cần tốt hơn nhiều.']);
        return;
      }
      await giveRod(world, 'Ông lão bến câu', 'oldRod', [
        'Cháu là nhà huấn luyện à? Đi đường xa mà không biết câu cá thì phí lắm!',
        'Ta có cái cần câu cũ này, câu được Pokémon dưới nước. Cháu nhận chứ?',
      ]);
    },
  },
  {
    id: 'r9-rod-giver', sprite: 'npc-fisher', name: 'Ông Câu Suối', map: 'route9', x: 22, y: 24, facing: 'up', fixed: true,
    async onTalk(world) {
      if (itemCount('goodRod')) {
        await world.say('Ông Câu Suối', ['Cần tốt câu được nhiều loại Pokémon hơn, toàn con to.', 'Nghe nói ở Hồ Lạnh, Tuyến đường 10, có một lão ngư còn giữ cái cần câu siêu đấy.']);
        return;
      }
      await giveRod(world, 'Ông Câu Suối', 'goodRod', [
        'Cháu đã đi tới tận rừng tre này rồi à? Pokémon của cháu chắc mạnh lắm.',
        'Đây là cần câu tốt của ta, câu được nhiều loại Pokémon hơn. Cháu nhận chứ?',
      ]);
    },
  },
  // Lão Ngư Hồ Lạnh: ngày xưa câu giỏi nhất vùng, tới khi Gyarados chúa trong hồ giật đứt dây, cuốn mất mồi và làm lão ngã
  // xuống hồ băng. Cần câu siêu của lão bỏ xó từ đó. Có cần câu tốt (chứng tỏ là người câu cá) thì lão nhờ hạ Gyarados chúa:
  // thắng hoặc bắt được nó thì lão tặng cần câu siêu. Thua / bỏ chạy thì lần sau thử lại.
  {
    id: 'r10-rod-giver', sprite: 'npc-oldman', name: 'Lão Ngư Hồ Lạnh', map: 'route10', x: 31, y: 12, facing: 'right', fixed: true,
    async onTalk(world) {
      const name = 'Lão Ngư Hồ Lạnh';
      if (itemCount('superRod')) {
        await world.say(name, ['Từ hôm cháu hạ Gyarados chúa, hồ yên hẳn.', 'Cần câu siêu câu được cả Pokémon hiếm ở hồ lạnh này đấy. Nhớ mang đội thật mạnh!']);
        return;
      }
      if (!itemCount('goodRod')) {
        await world.say(name, [
          'Hồ Lạnh này sâu lắm, cá ở đây không dành cho người mới cầm cần đâu.',
          'Cháu tìm được cái cần câu tốt rồi hẵng quay lại nói chuyện với lão.',
        ]);
        return;
      }
      if (!hasFlag('r10RodStory')) {
        await world.say(name, [
          'Cái cần câu tốt kia... của lão Câu Suối phải không? Vậy cháu cũng là dân câu cá rồi.',
          'Ngày trước lão câu giỏi nhất vùng này. Cho tới một sáng mùa đông...',
          'Một con Gyarados to gấp đôi thuyền đớp mồi, giật đứt dây rồi kéo lão ngã xuống hồ băng.',
          'Từ đó nó làm chúa cả Hồ Lạnh. Cái cần câu siêu của lão nằm xó nhà mấy năm nay rồi.',
        ]);
        setFlag('r10RodStory');
      } else {
        await world.say(name, ['Gyarados chúa vẫn còn quẫy dưới hồ kia...']);
      }
      if (!(await world.ask('Cháu giúp lão hạ con Gyarados chúa đó chứ? Nó mạnh lắm đấy (Lv 46).', name))) {
        await world.say(name, ['Ừ, cứ chuẩn bị cho kỹ. Hồi phục Pokémon xong thì quay lại đây.']);
        return;
      }
      await world.say(name, ['Được! Lão thả mồi đây... Nó tới rồi kìa!']);
      world.cameras?.main.shake(400, 0.008);
      const result = await world.startBattle({ enemy: createMonster('gyarados', 46), zone: 'water' });
      if (result !== 'win' && result !== 'catch') {
        // Thua thì đã tỉnh dậy ở chỗ hồi phục (lão không đứng đó): chỉ nói khi bỏ chạy, vẫn đứng cạnh lão
        if (result === 'run') await world.say(name, ['Nó lặn mất rồi... Không sao, khi nào sẵn sàng thì lại tới đây.']);
        return;
      }
      await world.say(name, [
        result === 'catch' ? 'Cháu... cháu bắt được cả Gyarados chúa! Lão sống ngần này tuổi chưa thấy ai làm được!' : 'Cháu hạ được Gyarados chúa rồi! Hồ Lạnh yên rồi!',
        'Lão già rồi, không câu nổi cá ở hồ này nữa. Cái cần câu siêu này giờ là của cháu.',
      ]);
      await world.giveItem('superRod');
      const slot = world.assignHotbar('superRod');
      await world.say(null, [
        'Cần câu siêu câu được cả Pokémon hiếm. Đứng quay mặt ra mặt nước rồi dùng cần câu trong túi đồ hoặc ô phím tắt.',
        ...(slot === null ? [] : [`${ITEMS.superRod.name} đã được gán vào ô phím tắt ${slot + 1} ở góc dưới màn hình.`]),
      ]);
    },
  },
];

STORY_NPCS.push(
  {
    // Chị gái Gary ở nhà, kể Gary đang ở đâu; lần đầu gặp sau khi Gary rời Pallet thì tặng Repel
    id: 'daisy', sprite: 'npc-woman', name: 'Chị Đào', map: 'garyHome', x: 5, y: 3, facing: 'down', wander: 1,
    async onTalk(world) {
      const name = 'Chị Đào';
      if (!hasFlag(F.STARTER)) {
        await world.say(name, ['Hôm nay ông hứa cho Gary Pokémon đầu tiên, nó háo hức cả đêm không ngủ!', 'Nó vẫn ở trên phòng lục tục chuẩn bị đồ, chắc lát nữa mới sang phòng thí nghiệm.']);
      } else if (!hasFlag(F.RIVAL2)) {
        await world.say(name, ['Gary về khoe với chị là hai đứa đã hẹn đấu lại.', 'Nó đi trước tới Thị trấn Lục Bình rồi, bảo sẽ đợi em ở đó trước khi lên đường!']);
      } else if (hasFlag(F_CHAMPION)) {
        await world.say(name, ['Em thành Nhà vô địch rồi sao? Chúc mừng em!', 'Gary về nhà buồn mất mấy hôm, giờ lại đi luyện tập rồi. Nó bảo lần sau nhất định thắng em.']);
      } else {
        await world.say(name, ['Gary gọi điện về, khoe vừa có thêm huy hiệu.', 'Nó bảo sẽ đợi em ở mấy thành phố phía trước để đấu tiếp. Hai đứa đúng là kỳ phùng địch thủ!']);
      }
      if (hasFlag(F.RIVAL2) && !hasFlag('daisyGift')) {
        await world.say(name, ['À, chị có cái này cho em. Đi qua bụi cỏ dài mà không muốn bị làm phiền thì dùng nhé.']);
        await world.giveItem('repel', 3);
        setFlag('daisyGift');
      }
    },
  },
  ...RIVAL_NPCS, ...ROCKET_NPCS, ...CHAPTER2_NPCS, ...LEAGUE_NPCS, ...QUEST_NPCS, ...VILLAGE_NPCS, ...POSTGAME_NPCS, ...SAFARI_NPCS,
);

// ---------- Hội thoại theo giai đoạn ----------

async function talkToOak(world) {
  if (!hasFlag(F.STARTER)) {
    await world.say('Giáo sư Oak', ['Trên bàn có ba Poké Ball, mỗi quả chứa một Pokémon.', 'Cháu hãy chọn một con đi!']);
    return;
  }
  if (!hasFlag(F.QUEST_DONE)) {
    const n = questProgress();
    if (n < QUEST_TARGET) {
      await world.say('Giáo sư Oak', ['Cháu chưa bắt được Pokémon nào à?', 'Bụi cỏ phía bắc có nhiều Pokémon lắm. Đánh cho nó yếu đi rồi hãy ném Poké Ball nhé!']);
      return;
    }
    await world.say('Giáo sư Oak', [
      'Ồ! Cháu đã bắt được Pokémon đầu tiên rồi sao?',
      'Giỏi lắm! Trang đầu tiên của Pokédex đã có thông tin rồi đấy.',
      'Đây là phần thưởng của ta. Đường xa, cứ mang theo mà dùng.',
    ]);
    await world.giveItem('potion', 3);
    await world.say('Giáo sư Oak', [
      'Giờ cháu đã sẵn sàng đi xa rồi. Băng qua bụi cỏ phía bắc, đi hết Tuyến đường 2 là tới Thị trấn Lục Bình.',
      'Ở đó có Pokémon Center và Poké Mart. Pallet mình nhỏ quá, chỉ có mẹ cháu chăm Pokémon cho thôi!',
      'À mà... ta vừa nghe nói có mấy kẻ lạ mặc đồ đen lảng vảng quanh Poké Mart Lục Bình.',
      'Hình như là bọn Team Rocket chuyên cướp Pokémon và đồ đạc! Cháu tới xem thử giúp ta, nhưng phải cẩn thận đấy!',
    ]);
    setFlag(F.QUEST_DONE);
    return;
  }
  if (!hasFlag(F.GRUNTS)) {
    await world.say('Giáo sư Oak', ['Bọn Team Rocket đang gây rối ở Poké Mart Lục Bình. Cẩn thận nhé!']);
  } else if (!hasFlag(F.MART_REWARD)) {
    await world.say('Giáo sư Oak', ['Cháu đuổi được Team Rocket rồi sao? Giỏi lắm!', 'Mau mang gói hàng trả lại cho Poké Mart Lục Bình đi.']);
  } else if (!hasFlag(F.RIVAL2)) {
    await world.say('Giáo sư Oak', ['Gary gọi về bảo đang đợi cháu ở Lục Bình. Hai đứa hẹn đấu lại trước khi lên đường à? Cố lên nhé!']);
  } else if (hasFlag(F_CHAMPION)) {
    // Vô địch: xem Pokédex, tặng Pokémon khởi đầu còn lại và Master Ball, kể chuyện Pokémon huyền thoại (story/postgame.js)
    await oakPostgame(world);
  } else {
    await world.say('Giáo sư Oak', [
      'Cháu đã sẵn sàng cho một chuyến hành trình dài rồi.',
      'Từ Thị trấn Lục Bình băng qua Hang Thạch Nhũ là tới Làng Chân Đồi, rồi Thành phố Đồi Gió. Ở đó có gym đầu tiên của vùng Sơn Thủy!',
    ]);
  }
}

// Nhân viên Poké Mart: trả về true nếu cốt truyện đã xử lý lời thoại
export async function clerkTalk(world) {
  if (hasFlag(F.QUEST_DONE) && !hasFlag(F.BOSS)) {
    await world.say('Nhân viên', ['Bọn Team Rocket vừa cướp gói hàng mới nhập của cửa hàng...', 'Cửa hàng đành tạm đóng cửa thôi.']);
    return true;
  }
  if (hasFlag(F.BOSS) && !hasFlag(F.MART_REWARD)) {
    while (itemCount('martParcel')) useItem('martParcel');
    await world.say(null, ['Bạn trao gói hàng cho nhân viên.']);
    await world.say('Nhân viên', ['Ôi! Gói hàng của cửa hàng đây rồi!', 'Cảm ơn bạn nhiều lắm! Đây là chút quà cảm ơn.']);
    await world.giveItem('superPotion', 3);
    await world.giveItem('revive', 1);
    setFlag(F.MART_REWARD);
    await world.say('Nhân viên', ['Cửa hàng mở cửa lại rồi. Mời bạn mua sắm nhé!']);
    finishChapter1();
    return true;
  }
  return false;
}

// Đồ vật trên bản đồ (Poké Ball trên bàn phòng thí nghiệm, vật phẩm rơi, cây quả mọng)
// Đồ vật trong gym: cổng (đóng tới khi bật công tắc), hàng rào điện (nhóm A khi tắt điện, nhóm B khi bật), công tắc
export const WALKABLE_OBJECTS = ['switch', 'toggle'];

export function objectVisible(obj) {
  if (obj.quest && !questTaken(obj.quest)) return false;
  // Đồ vật chỉ có trong một giai đoạn cốt truyện: từ khi có cờ after tới khi có cờ until
  if ((obj.after && !hasFlag(obj.after)) || (obj.until && hasFlag(obj.until))) return false;
  if (obj.kind === 'berry') return progressTier() >= (obj.tier ?? 0); // cây đã mọc thì luôn còn, chỉ hết quả
  // Gym đã có huy hiệu: cổng / hàng rào trong gym không còn
  if (obj.badge && state.badges.has(obj.badge) && (obj.kind === 'gate' || obj.kind === 'barrier')) return false;
  if (obj.kind === 'decor') return true;
  if (obj.kind === 'gate') return !hasFlag(obj.flag);
  if (obj.respawnDays) return (state.itemRespawn[obj.id] ?? 0) <= Date.now(); // nhặt rồi thì vài ngày sau lại có
  if (obj.kind === 'barrier') return hasFlag(obj.flag) ? obj.group === 'B' : obj.group === 'A';
  if (WALKABLE_OBJECTS.includes(obj.kind)) return true;
  return obj.kind === 'item' ? !hasFlag(`item:${obj.id}`) : !starterTaken(obj.species);
}

export async function useObject(world, obj) {
  if (obj.kind === 'decor') {
    if (obj.lines) await world.say(null, obj.lines);
    return;
  }
  if (obj.kind === 'item') {
    // Hoá thạch ở Mỏ Đá Vách Núi: chỉ lấy được một trong hai (story/postgame.js)
    if (obj.choice && !(await confirmChoice(world, obj))) return;
    if (obj.respawnDays) state.itemRespawn[obj.id] = Date.now() + obj.respawnDays * 24 * 3600 * 1000;
    else setFlag(`item:${obj.id}`);
    if (obj.item === 'martParcel') setFlag(F.BOSS);
    world.refreshObjects();
    await world.giveItem(obj.item, obj.qty, 'nhặt được');
    if (ITEMS[obj.item].fossil) await fossilFound(world, obj);
    return;
  }
  if (!hasFlag(F.MET_OAK)) {
    await world.say(null, ['Có ba Poké Ball trên bàn.', 'Phải đợi Giáo sư Oak về đã.']);
    return;
  }
  if (hasFlag(F.STARTER)) {
    await world.say(null, ['Đây là Pokémon của Giáo sư Oak.']);
    return;
  }
  const name = SPECIES[obj.species].name;
  const secret = obj.species === SECRET_STARTER;
  if (secret && !declinedAllStarters()) {
    await world.say('Giáo sư Oak', [
      'Khoan đã! Quả bóng đó thì chưa được đâu.',
      'Pokémon bên trong ta vừa bắt được sáng nay, nó còn bướng lắm.',
      'Cháu hãy xem ba Pokémon trên bàn trước đã nhé!',
    ]);
    return;
  }
  if (secret) {
    await world.say('Giáo sư Oak', [
      'Cháu không ưng con nào trong ba con kia sao? Kén chọn thật đấy!',
      'Thôi được, Pokémon trong quả bóng này ta vừa bắt sáng nay.',
      'Nó hơi khó bảo, nhưng nếu cháu thích thì ta giao cho cháu.',
    ]);
  }
  if (!(await world.previewStarter(obj.species))) {
    if (secret) {
      await world.say('Giáo sư Oak', ['Cứ từ từ suy nghĩ nhé. Ta không vội đâu.']);
      return;
    }
    const first = !declinedAllStarters();
    setFlag(`declined:${obj.species}`);
    // Vừa từ chối con thứ ba: Giáo sư Oak gợi ý quả bóng bí mật
    if (first && declinedAllStarters()) {
      await world.say('Giáo sư Oak', [
        'Hửm? Cháu chưa ưng con nào trong ba con này sao?',
        'À... trên cái bàn nhỏ sau lưng ta còn một quả Poké Ball nữa. Cháu thử xem nó đi!',
      ]);
    }
    return;
  }

  const starter = createMonster(obj.species, 5);
  starter.ot = playerName();
  state.party = [starter];
  markCaught(obj.species);
  setFlag(F.STARTER);
  setFlag(`starter:${obj.species}`);
  world.refreshObjects();
  await world.say(null, [`Bạn đã nhận được ${name} từ Giáo sư Oak!`]);
  if (secret) await world.say(null, [`${name} nhìn bạn một lúc... rồi khẽ gật đầu!`]);
  // Quay lại đứng trước bàn Giáo sư Oak (đi vòng lên từ phía dưới để Pokémon đi theo đứng sau lưng, không chắn lối Gary)
  await world.walkPlayerTo({ x: PLAYER_SPOT.x, y: PLAYER_SPOT.y + 1 });
  await world.walkPlayerTo(PLAYER_SPOT);
  world.facePlayerTo(world.findNpc('oak'));
  await rivalPicksAndBattles(world);
}

// Tới lượt Gary chọn, rồi Gary cũng về đứng trước bàn; Giáo sư Oak dặn dò cả hai, xong Gary thách đấu
async function rivalPicksAndBattles(world) {
  const oak = world.findNpc('oak');
  const species = RIVAL_PICK[playerStarter()];
  const mine = SPECIES[playerStarter()].name;
  const ball = MAPS.lab.objects.find((o) => o.species === species);
  // Gary chạy vào từ cửa, thấy bạn đã chọn xong thì chọn con khắc hệ
  await world.say('Gary', ['Ông nội! Cháu tới rồi đây!']);
  const mat = { x: MAPS.lab.entry.x, y: MAPS.lab.entry.y + 1 };
  const gary = world.spawnNpc({ id: 'gary', sprite: 'npc-gary', name: 'Gary', x: mat.x, y: mat.y, facing: 'up' });
  await world.walkNpcTo(gary, world.pos, { adjacent: true });
  world.faceNpcToPlayer(gary);
  world.facePlayerTo(gary);
  await world.say('Gary', [`Hả? ${playerName()} chọn ${mine} rồi à? Nhanh chân ghê!`]);
  await world.say('Giáo sư Oak', ['Gary, cháu tới muộn đấy. Tới lượt cháu chọn đi.']);
  await world.say('Gary', [`Hừ, được thôi. ${mine} à... Vậy cháu lấy con này, khắc hệ với nó!`]);
  await world.walkNpcTo(gary, { x: ball.x, y: ball.y + 1 });
  world.face(gary, 'up');
  setFlag(`rivalStarter:${species}`);
  world.refreshObjects();
  await world.say('Gary', [`Ông ơi, cháu chọn ${SPECIES[species].name}!`]);
  await world.walkNpcTo(gary, GARY_SPOT);
  world.faceNpcTo(gary, oak);
  await world.say('Giáo sư Oak', [
    'Tốt lắm, cả hai đứa đều đã có Pokémon rồi.',
    'Pokémon đầu tiên sẽ là người bạn đồng hành suốt chặng đường dài của các cháu. Hãy đối xử thật tốt với nó nhé!',
  ]);
  world.faceNpcToPlayer(gary);
  world.facePlayerTo(gary);
  await world.say('Gary', [`Này ${playerName()}! Pokémon của tụi mình đấu thử một trận đi!`]);

  const result = await world.startBattle({ trainer: rival1() });
  setFlag(F.RIVAL1);
  await world.say('Gary', result === 'win' ? ['Cái gì?! Mình chọn nhầm Pokémon rồi sao?'] : ['Ha! Thấy chưa? Tớ giỏi hơn cậu mà!']);
  await world.say('Giáo sư Oak', ['Trận đấu hay lắm! Để ta hồi phục Pokémon cho cả hai đứa.']);
  await world.fadeHeal();
  await world.say('Gary', [
    'Tớ sẽ huấn luyện cho Pokémon của tớ mạnh hơn nữa!',
    `Hứa nhé ${playerName()}: tớ đi trước tới Thị trấn Lục Bình. Trước khi lên đường rời Lục Bình, tụi mình đấu lại một trận!`,
    'Lần đó thì cậu đừng hòng thắng. Gặp lại sau nhé, đồ chậm chạp!',
  ]);
  await world.walkNpcTo(gary, MAPS.lab.entry);
  await world.walkNpcAway(gary, 'down', 1);

  await world.say('Giáo sư Oak', [
    'Còn đây là quà của ta: Pokédex!',
    'Nó tự ghi lại thông tin về mọi Pokémon cháu gặp và bắt được.',
  ]);
  setFlag(F.DEX);
  await (world.showKeyGift ? world.showKeyGift('dex', 'Bạn đã nhận được Pokédex! (Bấm {key:dex} để mở)') : world.say(null, ['Bạn đã nhận được Pokédex! (Bấm {key:dex} để mở)']));
  await world.say('Giáo sư Oak', ['Ta cho cháu thêm mấy quả Poké Ball để bắt Pokémon.']);
  await world.giveItem('ball', 5);
  await world.say('Giáo sư Oak', [
    'Ta muốn nhờ cháu một việc: hãy bắt Pokémon hoang dã đầu tiên của cháu rồi quay lại báo cho ta.',
    'Nhớ đánh cho Pokémon hoang dã yếu đi rồi hãy ném Poké Ball nhé!',
  ]);
}

// ---------- Sự kiện khi di chuyển ----------

// Người chơi sắp bước vào ô (x, y): trả về sự kiện (hàm async) để chặn bước đi, hoặc null
export function stepBlocker(world, x, y) {
  // Nhà Safari: chưa có vé thì bảo vệ chặn ở cửa lớn (story/safari.js)
  const safari = safariBlocker(world, x, y);
  if (safari) return safari;
  // Đã vô địch: không vào lại thử thách Liên minh được nữa (story/league.js)
  const league = leagueBlocker(world, x, y);
  if (league) return league;
  // Lối phía bắc sang Tuyến đường 2 chỉ mở khi xong nhiệm vụ của Giáo sư Oak
  if (world.map.id === 'route1' && world.map.warpAt(x, y)?.to === 'route2' && !hasFlag(F.QUEST_DONE)) {
    return () => world.say(null, ['Bạn nhớ lời Giáo sư Oak dặn: bắt Pokémon đầu tiên rồi quay lại báo cho ông đã.']);
  }
  // Sắp bước sang tuyến đường đầu tiên: tiếng mẹ gọi với theo, mẹ chạy ra tặng quà rồi mới đi tiếp. Chặn từ ô ngay dưới lối ra
  // (người chơi đứng lùi lại 1 ô so với mép bản đồ, cảnh mẹ chạy tới không bị khuất ở mép trên màn hình)
  const exitAhead = (dy) => world.map.warpAt(x, y + dy)?.to === 'route2';
  if (world.map.id === 'route1' && (exitAhead(0) || exitAhead(-1)) && hasFlag(F.QUEST_DONE) && !hasFlag(F.MOM_GIFT)) {
    return () => momGift(world);
  }
  // Cửa Hang Thạch Nhũ ở Lục Bình chỉ mở khi xong chương 1 (đuổi Team Rocket, trả gói hàng cho Poké Mart)
  if (world.map.id === 'town1' && world.map.warpAt(x, y)?.to === 'cave1' && !hasFlag(F.DONE)) {
    return () => world.say('Bác thợ mỏ', [
      'Khoan đã cháu! Trong hang vừa sạt đá, bác đang dọn dẹp.',
      'Nghe nói bọn trộm vừa phá Poké Mart dưới kia. Cháu xem có giúp gì được không, xong việc bác cũng dọn xong đường.',
    ]);
  }
  const gate = badgeGate(world, x, y);
  if (gate) return gate;
  if (world.map.id !== 'route1' || hasFlag(F.STARTER) || !world.map.info(x, y).encounter) return null;
  if (!hasFlag(F.MET_OAK)) return () => oakStopsPlayer(world);
  return () => world.say('Giáo sư Oak', ['(Giọng từ xa) Khoan đã! Vào phòng thí nghiệm chọn Pokémon trước đã nào!']);
}

// Người chơi vừa bước tới ô mới: trả về sự kiện cần chạy, hoặc null
export function stepTrigger(world) {
  const { x, y } = world.pos;
  // Pokémon huyền thoại bị hạ gục: sang bản đồ khác rồi thì nó về lại chỗ cũ
  postgameStep(world);
  const rocket = rocketTrigger(world);
  if (rocket) return rocket;
  const rival = rivalTrigger(world);
  if (rival) return rival;
  // Lên đường rời Lục Bình (đã trả gói hàng): nhân viên Poké Mart chặn cửa hang cảm ơn rồi về cửa hàng; đi tiếp tới cửa hang
  // thì Gary ra đấu lại như đã hẹn ở phòng thí nghiệm
  const [x1, y1, x2, y2] = CAVE_APPROACH;
  const nearCave = world.map.id === 'town1' && x >= x1 && x <= x2 && y >= y1 && y <= y2;
  if (nearCave && hasFlag(F.MART_REWARD) && !hasFlag(F.CLERK_BACK) && !hasFlag(F.DONE)) return () => clerkThanks(world);
  if (nearCave && hasFlag(F.MART_REWARD) && !hasFlag(F.RIVAL2)) {
    return () => rivalRematch(world);
  }
  return null;
}

async function momGift(world) {
  await world.say('Mẹ', ['(Tiếng mẹ gọi vọng lại từ xa) Con ơi! Khoan đi đã, đợi mẹ với!']);
  const home = world.map.buildings.find((b) => b.to === 'home');
  const doorstep = { x: home.door.x, y: home.door.y + 1 };
  const door = await world.openDoor(home);
  const mom = world.spawnNpc({ id: 'mom-walk', sprite: 'npc-mom', name: 'Mẹ', x: home.door.x, y: home.door.y, facing: 'down' });
  await world.walkNpc(mom, ['down']);
  await world.closeDoor(door);
  await world.walkNpcTo(mom, world.pos, { adjacent: true });
  world.faceNpcToPlayer(mom);
  world.facePlayerTo(mom);
  await world.say('Mẹ', ['Phù... may mà kịp! Giáo sư Oak gọi điện bảo con sắp lên đường rồi.', 'Đường đi xa lắm, mẹ có mấy thứ cho con đây.']);
  await world.giveItem('townMap');
  await world.say('Mẹ', ['Bản đồ vùng Sơn Thủy đó. Lạc đường thì bấm vào nút bản đồ ở góc trên bên phải mà xem nhé.']);
  await world.giveItem('badgeCase');
  await world.say('Mẹ', ['Còn đây là hộp đựng huy hiệu. Thắng gym nào thì cất huy hiệu vào đây cho cẩn thận, mở Thẻ HLV là xem được!', 'Đi đường cẩn thận nha con!']);
  setFlag(F.MOM_GIFT);
  await world.walkNpcTo(mom, doorstep);
  await world.npcEntersDoor(mom, home);
}

// Mở đầu khi chơi mới
export async function intro(world) {
  await world.say(null, [
    `Chào mừng ${playerName()} đến với thế giới Pokémon!`,
    'Hôm nay là một ngày đặc biệt: bạn sẽ nhận Pokémon đầu tiên của mình.',
  ]);
  await world.say('Mẹ', ['Con dậy rồi à? Xuống nhà đi, mẹ bảo chuyện này!']);
}

async function oakStopsPlayer(world) {
  await world.say('???', ['Khoan đã! Đừng đi vào đó!']);
  const lab = world.map.buildings.find((b) => b.to === 'lab');
  const oak = world.spawnNpc({ id: 'oak-walk', sprite: 'npc-oak', name: 'Giáo sư Oak', x: lab.door.x, y: lab.door.y + 1, facing: 'up' });
  await world.walkNpcTo(oak, world.pos, { adjacent: true });
  world.faceNpcToPlayer(oak);
  world.facePlayerTo(oak);
  await world.say('Giáo sư Oak', [
    'Phù... may mà kịp!',
    'Bụi cỏ cao là nơi Pokémon hoang dã ẩn nấp. Không có Pokémon mà đi vào thì nguy hiểm lắm!',
    'Ta là Oak, người nghiên cứu về Pokémon. Mọi người gọi ta là Giáo sư Pokémon.',
    'Hôm nay ta đã hẹn cháu tới nhận Pokémon đầu tiên. Đi theo ta về phòng thí nghiệm nào!',
  ]);
  // Giáo sư dẫn tới trước cửa phòng thí nghiệm, vào trước; bạn bước lên rồi vào theo
  const doorstep = { x: lab.door.x, y: lab.door.y + 1 };
  await world.leadPlayer(oak, doorstep);
  await world.npcEntersDoor(oak, lab);
  setFlag(F.MET_OAK);
  await world.walkPlayer([doorstep]);
  await world.enterDoor(lab);
  await world.say('Giáo sư Oak', [
    'Trên bàn có ba Poké Ball, mỗi quả chứa một Pokémon.',
    'Cháu hãy chọn một con đi!',
    'Ta cũng hẹn thằng cháu Gary hôm nay, chắc nó sắp sang rồi. Ai đến trước được chọn trước!',
  ]);
}

// Nhân viên Poké Mart chặn cửa hang: cảm ơn vì đã lấy lại gói hàng rồi về lại cửa hàng (vào cửa Poké Mart)
export async function clerkThanks(world) {
  const clerk = world.findNpc('t1-clerk');
  if (clerk) {
    world.faceNpcToPlayer(clerk);
    world.facePlayerTo(clerk);
  }
  await world.say('Nhân viên Poké Mart', [
    'Cháu trả gói hàng cho cửa hàng rồi à? Cảm ơn cháu nhiều lắm!',
    'Bọn Team Rocket bay mất rồi, tôi không phải canh ở đây nữa. Tôi về cửa hàng làm việc tiếp đây!',
    'Lúc nào cần mua gì thì ghé Poké Mart nhé!',
  ]);
  setFlag(F.CLERK_BACK);
  if (!clerk) return;
  const mart = world.map.buildings.find((b) => b.to === 'mart');
  await world.walkNpcTo(clerk, { x: mart.door.x, y: mart.door.y + 1 });
  await world.npcEntersDoor(clerk, mart);
}

// Lên đường rời Thị trấn Lục Bình: Gary bước ra từ Pokémon Center, đấu lại như đã hẹn ở phòng thí nghiệm (Lv 8).
// Thua thì về Pokémon Center, lần sau đi tới cửa hang lại gặp; thắng thì Gary vào hang trước, hết chương 1.
async function rivalRematch(world) {
  await world.say('Gary', [`${playerName()}! Đợi đã!`]);
  const center = world.map.buildings.find((b) => b.to === 'center');
  const door = await world.openDoor(center);
  const gary = world.spawnNpc({ id: 'gary-2', sprite: 'npc-gary', name: 'Gary', x: center.door.x, y: center.door.y, facing: 'down' });
  await world.walkNpc(gary, ['down']);
  await world.closeDoor(door);
  await world.walkNpcTo(gary, world.pos, { adjacent: true });
  world.faceNpcToPlayer(gary);
  world.facePlayerTo(gary);
  await world.say('Gary', [
    'Định lên đường mà không chào tớ à? Tụi mình đã hẹn rồi còn gì!',
    'Nghe nói cậu vừa đánh đuổi Team Rocket? Hừ, tớ mà ở đó thì xong từ lâu rồi.',
    'Tớ luyện suốt dọc Tuyến đường 2, còn bắt được cả Pidgey nữa. Đấu lại một trận xem ai hơn ai!',
  ]);
  const result = await world.startBattle({ trainer: rival2() });
  if (result !== 'win') {
    world.removeNpc(gary);
    return;
  }
  await world.say('Gary', [
    'Hừ... được rồi, lần này cậu thắng.',
    'Tớ vào Hang Thạch Nhũ trước đây. Tớ sẽ là nhà vô địch Pokémon, cậu cứ đợi đấy!',
  ]);
  const cave = world.map.warps.find((w) => w.to === 'cave1');
  await world.walkNpcTo(gary, { x: cave.x, y: cave.y + 1 });
  await world.walkNpcAway(gary, 'up', 1);
  setFlag(F.RIVAL2);
  finishChapter1();
}

// Xong chương 1 khi đã trả gói hàng cho Poké Mart Lục Bình và thắng Gary ở Lục Bình
// (bản lưu cũ đã đấu Gary ở Pallet thì xong chương ngay khi trả gói hàng). Không có màn tổng kết chương: chơi tiếp luôn,
// cửa Hang Thạch Nhũ mở và mục tiêu chuyển sang chặng tiếp theo
function finishChapter1() {
  if (hasFlag(F.DONE) || !hasFlag(F.RIVAL2) || !hasFlag(F.MART_REWARD)) return;
  setFlag(F.DONE);
}
