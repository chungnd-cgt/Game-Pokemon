import { createMonster } from '../game/monster.js';
import { hasFlag, itemCount, playerName, setFlag, state, useItem } from '../game/state.js';
import { rivalTrainer } from './rival.js';

// Nhiệm vụ cốt truyện ở 8 làng nhỏ nằm ngay trước các thành phố có gym (bản đồ: data/mapsVillages.js).
// Lối từ làng sang thành phố có cổng { village: id }: chỉ mở khi xong nhiệm vụ của làng (villageGate).
// Cờ: quest:<id> (đã nhận lời, vật phẩm nhiệm vụ trên bản đồ có quest: '<id>' mới hiện) •
//     village:<id>:<bước> (tiến độ) • village:<id> (xong, đường sang thành phố đã mở).
// Bản lưu cũ đã từng tới thành phố đó (đi qua trước khi có làng) thì coi như đã xong nhiệm vụ.

export const VILLAGES = [
  { id: 'v1', map: 'village1', name: 'Làng Chân Đồi', city: 'town2' },
  { id: 'v2', map: 'village2', name: 'Xóm Cối Xay', city: 'town3' },
  { id: 'v3', map: 'village3', name: 'Xóm Trạm Điện', city: 'town4' },
  { id: 'v4', map: 'village4', name: 'Làng Bến Đò', city: 'town5' },
  { id: 'v5', map: 'village5', name: 'Làng Đất Sét', city: 'town6' },
  { id: 'v6', map: 'village6', name: 'Bản Vách Đá', city: 'town7' },
  { id: 'v7', map: 'village7', name: 'Xóm Hương Khói', city: 'town8' },
  { id: 'v8', map: 'village8', name: 'Làng Đèo Tuyết', city: 'town9' },
];
const byId = (id) => VILLAGES.find((v) => v.id === id);

export const villageDone = (id) => hasFlag(`village:${id}`) || state.visited.has(byId(id).city);
const taken = (id) => hasFlag(`quest:${id}`);
const did = (id, step) => hasFlag(`village:${id}:${step}`);
const mark = (id, step) => setFlag(`village:${id}:${step}`);
const finish = (id) => setFlag(`village:${id}`);
const count = (id, steps) => steps.filter((s) => did(id, s)).length;

// Nhờ giúp: đồng ý thì nhận nhiệm vụ
async function offer(world, name, lines, id) {
  await world.say(name, lines);
  if (!(await world.ask('Nhận lời giúp đỡ chứ?', name))) {
    await world.say(name, ['Vậy à... Khi nào cháu đổi ý thì quay lại nhé.']);
    return false;
  }
  setFlag(`quest:${id}`);
  return true;
}

// Trận với Pokémon hoang dã trong nhiệm vụ: hạ gục hoặc bắt được đều tính là xong
async function wildFight(world, species, level, zone = 'meadow') {
  // Không persist: trận nằm giữa cảnh cắt, cờ nhiệm vụ ghi sau trận. Lưu ngay lúc bắt được (persist) mà đóng tab thì
  // Pokémon đã vào đội nhưng nhiệm vụ chưa xong, tải lại đánh tiếp được: nhân bản Pokémon nhiệm vụ
  const result = await world.startBattle({ enemy: createMonster(species, level), zone });
  return result === 'win' || result === 'catch' ? result : null;
}

// ---------- Gary ----------

// Gary dùng dạng tiến hoá của Pokémon khởi đầu đã chọn ở phòng thí nghiệm (đội hình: story/rival.js)
export const rival3 = () => rivalTrainer('v3', { prize: 35, lose: 'Hừ! Tớ chưa khởi động xong thôi!' });
export const rival4 = () => rivalTrainer('v7', { prize: 40, lose: 'Không thể nào... Tớ đã luyện tập khắp nơi cơ mà!' });

// Gary chặn ở cổng làng: thắng thì Gary đi trước vào thành phố, nhiệm vụ của làng xong
function garyAtGate(id, { x, y, facing, team, intro, again, win, opened }) {
  const npcId = `gary-${id}`;
  const fight = async (world) => {
    const npc = world.findNpc(npcId);
    if (npc) {
      world.faceNpcToPlayer(npc);
      world.facePlayerTo(npc);
    }
    await world.say('Gary', did(id, 'garyMet') ? again : intro());
    mark(id, 'garyMet');
    const result = await world.startBattle({ trainer: team() });
    if (result !== 'win') return;
    await world.say('Gary', win);
    finish(id);
    // Gary đi trước sang thành phố: ra đúng lối sang thành phố
    const gary = world.findNpc(npcId);
    if (gary) await world.npcLeave(gary, { toMap: byId(id).city });
    await world.say(null, [opened]);
  };
  return {
    fight,
    npc: { id: npcId, sprite: 'npc-gary', name: 'Gary', map: byId(id).map, x, y, facing, fixed: true, onTalk: fight },
  };
}

// ---------- 1. Làng Chân Đồi: bé Tí đi lạc trong Rừng Thông sau làng ----------
// Mẹ bé Tí nhờ tìm con → lối mòn phía bắc làng vào Rừng Thông (data/mapsVillages.js: forest1). Bố bé Tí ở bãi đầu rừng
// chỉ hướng; bé Tí ở bãi hoa góc tây bắc, bị Pidgeotto dồn vào gốc cây. Đuổi Pidgeotto xong thì dắt bé về làng:
// bé chạy ùa tới mẹ, mẹ cảm ơn rồi hai mẹ con dắt nhau vào nhà (cửa nhà mái đỏ phía nam làng).

const CHIEF1 = 'Trưởng làng';
const V1_HOME = { x: 19, y: 15 }; // cửa nhà mẹ con bé Tí (nhà mái đỏ)
const v1Blocked = () => [
  'Bé Tí trong làng đi lạc từ sáng. Bố nó là người dẫn đường lên dốc gió, giờ cũng vào rừng tìm con rồi.',
  'Không có người dẫn, ta không cho ai lên dốc đâu. Gió trên đó dữ lắm!',
  taken('v1') ? 'Rừng Thông ở ngay sau lối mòn phía bắc làng. Cháu tìm được bé Tí thì đưa nó về với mẹ nhé.' : 'Mẹ bé Tí đang đứng trước nhà phía nam, cháu hỏi thử xem.',
];

// Dắt bé Tí về làng: tối màn hình, hiện ra trước nhà; bé chạy tới mẹ, mẹ cảm ơn, hai mẹ con vào nhà
async function bringTiHome(world) {
  await world.say(null, ['Bạn dắt tay bé Tí, men theo lối mòn ra khỏi rừng...']);
  await world.warpTo({ to: 'village1', tx: 16, ty: 17, facing: 'right' });
  const ti = world.spawnNpc({ id: 'v1-ti-walk', sprite: 'npc-boy', name: 'Bé Tí', x: 17, y: 17, facing: 'right' });
  const mom = world.findNpc('v1-mom');
  await world.say('Bé Tí', ['Mẹ ơiiii!']);
  if (mom) {
    await world.walkNpcTo(ti, mom.pos, { adjacent: true });
    world.faceNpcTo(mom, ti);
    world.faceNpcTo(ti, mom);
    await world.say('Mẹ bé Tí', ['Tí! Con đi đâu cả buổi làm mẹ lo muốn chết!', 'Lần sau không được chạy vào rừng một mình nữa, nghe chưa?']);
    await world.say('Bé Tí', ['Dạ... con hứa ạ. Nhờ anh chị kia đuổi con Pidgeotto đi đó mẹ!']);
    await world.walkNpcTo(mom, world.pos, { adjacent: true });
    world.faceNpcToPlayer(mom);
    world.facePlayerTo(mom);
  }
  await world.say('Mẹ bé Tí', ['Cô cảm ơn cháu nhiều lắm!', 'Cô chẳng có gì nhiều, cháu cầm mấy lọ thuốc này mà lên gym.']);
  await world.giveItem('superPotion', 3);
  await world.say('Mẹ bé Tí', ['Bố bé Tí cũng sắp về rồi, đường lên dốc gió sẽ mở lại thôi.', 'Thôi hai mẹ con vào nhà đây. Chào cháu nhé!']);
  finish('v1');
  // Hai mẹ con dắt nhau vào nhà
  const home = world.map.buildings.find((b) => b.door.x === V1_HOME.x && b.door.y === V1_HOME.y);
  const doorstep = { x: V1_HOME.x, y: V1_HOME.y + 1 };
  for (const npc of [mom, ti]) {
    if (!npc || !home) continue;
    await world.walkNpcTo(npc, doorstep);
    await world.npcEntersDoor(npc, home);
  }
}

const V1 = [
  {
    id: 'v1-chief', sprite: 'npc-oldman', name: CHIEF1, map: 'village1', x: 23, y: 9, facing: 'down', fixed: true,
    async onTalk(world) {
      await world.say(CHIEF1, villageDone('v1')
        ? ['Bố bé Tí về rồi, đường lên dốc gió mở lại rồi.', 'Thành phố Đồi Gió ở ngay phía đông. Chúc cháu thắng gym!']
        : v1Blocked());
    },
  },
  {
    // Xong nhiệm vụ thì hai mẹ con đã vào nhà
    id: 'v1-mom', sprite: 'npc-woman', name: 'Mẹ bé Tí', map: 'village1', x: 21, y: 16, facing: 'down', fixed: true,
    show: () => !villageDone('v1'),
    async onTalk(world) {
      const name = this.name;
      if (!taken('v1')) {
        const ok = await offer(world, name, [
          'Cháu ơi, cháu có thấy bé Tí nhà cô đâu không?',
          'Sáng nay nó đuổi theo một con Pidgeotto theo lối mòn phía bắc, chạy tuốt vào Rừng Thông sau làng rồi mất hút.',
          'Bố nó vào rừng tìm từ trưa mà chưa thấy ra. Cháu có Pokémon, giúp cô tìm bé Tí với!',
        ], 'v1');
        if (ok) await world.say(name, ['Lối mòn vào rừng ở phía bắc làng, sau mấy khóm hoa.', 'Rừng sâu, đường ngoằn ngoèo lắm. Cháu cẩn thận nhé!']);
        return;
      }
      await world.say(name, ['Bé Tí đội mũ lưỡi trai màu cam, nhỏ xíu à. Nó thích nhất là mấy bãi hoa trong rừng...']);
    },
  },
  {
    id: 'v1-dad', sprite: 'npc-hiker', name: 'Bố bé Tí', map: 'forest1', x: 15, y: 23, facing: 'down', fixed: true,
    show: () => !did('v1', 'found') && !villageDone('v1'),
    async onTalk(world) {
      await world.say(this.name, taken('v1')
        ? [
          'Cháu là người mẹ thằng Tí nhờ đi tìm à? Cảm ơn cháu!',
          'Bác tìm khắp phía đông rồi, ra tới tận hồ nước mà không thấy nó đâu.',
          'Thằng bé mê hoa lắm. Trong rừng có bãi hoa ở tít góc tây bắc, nhưng lối vào phải vòng qua phía đông bắc...',
          'Bác chân yếu, đi không nổi nữa rồi. Cháu thử lên đó xem giúp bác!',
        ]
        : ['Thằng Tí nhà bác đi lạc trong rừng này từ sáng...', 'Cháu ra làng hỏi mẹ nó xem, bác phải tìm tiếp đây.']);
    },
  },
  {
    id: 'v1-pidgeotto', mon: 'pidgeotto', name: 'Pidgeotto', map: 'forest1', x: 4, y: 3, facing: 'left', fixed: true,
    show: () => !did('v1', 'found') && !villageDone('v1'),
    lines: ['Pidgeotto xù lông, đập cánh phành phạch chắn trước mặt bé Tí!'],
  },
  {
    id: 'v1-ti-lost', sprite: 'npc-boy', name: 'Bé Tí', map: 'forest1', x: 3, y: 3, facing: 'right', fixed: true,
    show: () => !did('v1', 'found') && !villageDone('v1'),
    async onTalk(world) {
      await world.say(this.name, ['Hu hu... Cứu em với! Con Pidgeotto này cứ đuổi theo em mãi!']);
      await world.say(null, ['Pidgeotto rít lên rồi lao về phía bạn!']);
      if (!(await wildFight(world, 'pidgeotto', 16))) return;
      const bird = world.findNpc('v1-pidgeotto');
      if (bird) await world.npcFlyAway(bird);
      await world.say(this.name, ['Nó bay đi rồi! Cảm ơn anh chị nhiều nha!', 'Em đi lạc cả buổi, mỏi chân quá... Anh chị dẫn em về với mẹ được không?']);
      setFlag('quest:v1');
      mark('v1', 'found');
      await bringTiHome(world);
    },
  },
  {
    id: 'v1-teacher', sprite: 'npc-lass', name: 'Cô giáo', map: 'village1', x: 12, y: 7, facing: 'down', wander: 1,
    lines: [
      'Gym Đồi Gió dùng Pokémon hệ Bay.',
      'Hệ Điện, Đá và Băng đánh hệ Bay rất đau. Còn hệ Cỏ, Giác đấu và Bọ thì dễ bị thiệt.',
      'Pikachu bắt ở Tuyến đường 3 hay Rừng Thông, Geodude trong Hang Thạch Nhũ đều là lựa chọn tốt!',
    ],
  },
];

// Gõ cửa nhà không vào được: nhà mẹ con bé Tí sau khi bé đã về
export function houseKnock(mapId, door) {
  if (mapId === 'village1' && door.x === V1_HOME.x && door.y === V1_HOME.y && villageDone('v1')) {
    return ['Trong nhà vọng ra tiếng bé Tí kể chuyện đi lạc trong rừng, cười khúc khích.', 'Đừng làm phiền hai mẹ con nữa.'];
  }
  const at = (spot) => door.x === spot.x && door.y === spot.y;
  // Nhà bác thợ xay sau khi anh Cốm đã về; kho thóc cũ trên Đồng Cối Xay
  if (mapId === 'village2' && at(V2_HOME) && villageDone('v2')) {
    return ['Trong nhà vọng ra tiếng anh Cốm ngáy khò khò.', 'Phấn ngủ của Gloom vẫn còn ngấm, để anh ấy ngủ bù.'];
  }
  if (mapId === 'field2' && at(V2_BARN)) {
    return villageDone('v2')
      ? ['Trong kho thóc cũ, bầy Pokémon cỏ đang rúc rích chia nhau thóc lép anh Cốm mang lên.', 'Đừng làm chúng giật mình.']
      : ['Cửa kho thóc cũ khép hờ. Bên trong chất đầy bao thóc bầy Pokémon cỏ tha về...'];
  }
  // Nhà chú thợ mộc Làng Bến Đò, nhà chú Sét Làng Đất Sét sau khi xong nhiệm vụ
  if (mapId === 'village4' && at(V4_CARPENTER_HOME) && villageDone('v4')) {
    return ['Trong nhà vọng ra tiếng bào gỗ xoèn xoẹt. Chú thợ mộc đang làm thêm ván dự phòng cho cây cầu.'];
  }
  if (mapId === 'village5' && at(V5_SET_HOME) && villageDone('v5')) {
    return ['Trong nhà vọng ra tiếng chú Sét vừa tắm vừa hát nghêu ngao.', 'Đừng làm phiền.'];
  }
  // Miếu Xóm Hương Khói sau khi chú tiểu Minh đã về
  if (mapId === 'village7' && door.x === V7_TEMPLE.x && door.y === V7_TEMPLE.y && (did('v7', 'bell') || villageDone('v7'))) {
    return ['Trong miếu thoang thoảng mùi trầm hương, chú tiểu Minh đang tụng kinh đều đều.', 'Không nên làm phiền.'];
  }
  return null;
}

// ---------- 2. Xóm Cối Xay: bầy Pokémon cỏ phá kho thóc, anh Cốm ngủ mê trên Đồng Cối Xay ----------
// Bác thợ xay nhờ đuổi bầy Pokémon cỏ (anh Cốm, con bác, lên đồng đuổi chúng từ sáng chưa về) → lối mòn phía bắc xóm lên
// Đồng Cối Xay (data/mapsVillageAreasA.js: field2). Oddish chắn cầu đông, Bellsprout chắn lối xuống sân kho thóc cũ,
// Gloom canh cửa kho cạnh anh Cốm đang ngủ mê vì phấn ngủ; thua thì Oddish, Bellsprout nép sang bên nhường đường.
// Đuổi xong Gloom, anh Cốm tỉnh dậy: bầy này đói vì bãi cỏ dại ven suối khô héo, anh để chúng ở kho thóc cũ (Gloom,
// Bellsprout chui vào kho). Anh Cốm dẫn bạn về xóm: chạy tới cha, bác thợ xay tặng quà, dỡ rào; anh Cốm vào nhà ngủ bù.
// Về sau bầy Pokémon cỏ sống yên ổn quanh kho thóc cũ trên đồng.

const V2_HOME = { x: 11, y: 7 }; // cửa nhà bác thợ xay (nhà mái đỏ)
const V2_MILLER = { x: 14, y: 8 };
const V2_BARN = { x: 4, y: 5 }; // cửa kho thóc cũ trên Đồng Cối Xay
// Bầy Pokémon cỏ: chỗ chắn đường, chỗ nép sang bên sau khi thua, chỗ ở quanh kho thóc cũ khi xong nhiệm vụ
const PESTS = [
  {
    step: 'oddish', species: 'oddish', name: 'Oddish', level: 19, at: [30, 16, 'down'], aside: [32, 16], home: [8, 7],
    line: 'Oddish ôm một bông lúa đứng chắn đầu cầu, quay lại lườm bạn!',
    beaten: 'Oddish rúm ró nép sang bờ ruộng, không dám chắn cầu nữa.',
    homeLine: 'Oddish lim dim phơi nắng trước kho thóc cũ, bụng tròn xoe.',
  },
  {
    step: 'bellsprout', species: 'bellsprout', name: 'Bellsprout', level: 19, at: [7, 4, 'up'], aside: [9, 5], home: [10, 6],
    line: 'Bellsprout quất dây leo vun vút, chắn lối xuống sân kho thóc!',
    beaten: 'Bellsprout cụp lá, lủi vào góc rào nhường lối.',
    homeLine: 'Bellsprout đung đưa theo gió, chẳng còn hung hăng nữa.',
  },
  {
    step: 'gloom', species: 'gloom', name: 'Gloom', level: 21, at: [4, 6, 'down'], home: [6, 7],
    line: 'Gloom đứng canh cửa kho thóc cũ, toả mùi hôi nồng nặc!',
    homeLine: 'Gloom gật gù canh kho thóc cũ. Ngày nào anh Cốm cũng mang thóc lép lên cho cả bầy.',
  },
];
const pestsLeft = () => PESTS.filter((p) => !did('v2', p.step)).length;
const pestCaught = (p) => did('v2', `${p.step}Caught`);

async function fightPest(world, p) {
  await world.say(null, [p.line]);
  const result = await wildFight(world, p.species, p.level);
  if (!result) return;
  setFlag('quest:v2');
  mark('v2', p.step);
  const npc = world.findNpc(`v2-${p.step}`);
  if (result === 'catch') {
    mark('v2', `${p.step}Caught`);
    if (npc) world.removeNpc(npc);
  } else if (p.aside) {
    if (npc) await world.walkNpcTo(npc, { x: p.aside[0], y: p.aside[1] });
    await world.say(null, [p.beaten]);
  }
  if (p.step === 'gloom') {
    await wakeCom(world);
    return;
  }
  await world.say(null, [pestsLeft() ? `Còn ${pestsLeft()} con trong bầy Pokémon cỏ.` : 'Cả bầy Pokémon cỏ đã chịu thua!']);
}

// Anh Cốm tỉnh dậy: để bầy Pokémon cỏ ở kho thóc cũ rồi dẫn bạn về xóm
async function wakeCom(world) {
  const com = world.findNpc('v2-com');
  await world.say(null, ['Anh Cốm nằm dưới mái kho thóc cũ cựa mình, dụi mắt ngồi dậy.']);
  if (com) {
    await world.walkNpcTo(com, world.pos, { adjacent: true });
    world.faceNpcToPlayer(com);
    world.facePlayerTo(com);
  }
  const woke = 'Ối, anh ngủ quên mất! Con Gloom rắc phấn ngủ một cái là anh lăn quay ra...';
  if (pestsLeft()) {
    await world.say('Anh Cốm', [woke, `Bầy này còn ${pestsLeft()} con nữa ngoài đồng, em đuổi nốt giúp anh nhé!`]);
    return;
  }
  await world.say('Anh Cốm', [
    woke,
    'Cảm ơn em nhé! Mà anh hiểu rồi: suối cạn, bãi cỏ dại ven suối héo rũ cả, bầy này đói quá mới xuống phá kho thóc của xóm.',
    'Kho thóc cũ này bỏ không lâu rồi. Anh để chúng ở đây, ngày ngày mang thóc lép lên cho ăn là chúng chẳng phá ai nữa.',
  ]);
  // Gloom và Bellsprout chui vào kho thóc cũ, nhà mới của cả bầy
  const barn = world.map.buildings.find((b) => b.door.x === V2_BARN.x && b.door.y === V2_BARN.y) ?? null;
  for (const id of ['v2-gloom', 'v2-bellsprout-aside']) {
    const mon = world.findNpc(id);
    if (mon) await world.npcLeave(mon, { building: barn });
  }
  await world.say(null, ['Bầy Pokémon cỏ lục tục chui vào kho thóc cũ, ríu rít chia nhau mấy bao thóc.']);
  await world.say('Anh Cốm', ['Giờ về báo cha anh thôi! Anh biết lối tắt qua bờ ruộng, đi theo anh.']);
  await bringComHome(world);
}

// Về xóm: tối màn hình, hiện ra ở lối mòn phía bắc; anh Cốm chạy tới cha, bác thợ xay tặng quà rồi dỡ rào, anh Cốm vào nhà
async function bringComHome(world) {
  await world.say(null, ['Bạn theo anh Cốm men bờ ruộng tắt về xóm...']);
  await world.warpTo({ to: 'village2', tx: 18, ty: 2, facing: 'down' });
  const com = world.spawnNpc({ id: 'v2-com-walk', sprite: 'npc-camper', name: 'Anh Cốm', x: 19, y: 2, facing: 'down' });
  const miller = world.findNpc('v2-miller');
  await world.say('Anh Cốm', ['Cha ơi! Con về rồi!']);
  if (miller) {
    await world.walkNpcTo(com, miller.pos, { adjacent: true });
    world.faceNpcTo(miller, com);
    world.faceNpcTo(com, miller);
    await world.say('Bác thợ xay', ['Cốm! Mày đi đâu cả buổi làm cha lo sốt vó!']);
    await world.say('Anh Cốm', [
      'Con bị Gloom rắc phấn ngủ, nằm lăn ra ở kho thóc cũ. Nhờ bạn này đuổi cả bầy con mới tỉnh được đấy cha!',
      'Bầy đó đói vì suối cạn thôi. Con cho chúng ở kho thóc cũ trên đồng rồi, chẳng phá kho mình nữa đâu.',
    ]);
    await world.walkNpcTo(miller, world.pos, { adjacent: true });
    world.faceNpcToPlayer(miller);
    world.facePlayerTo(miller);
  }
  await world.say('Bác thợ xay', [
    'Bác cảm ơn cháu nhiều lắm! Kho thóc của xóm được cứu rồi.',
    'Bọn Pokémon cỏ hay rắc phấn ngủ, phấn độc lắm. Cháu cầm mấy thứ này mà phòng thân.',
  ]);
  await world.giveItem('awakening', 3);
  await world.giveItem('antidote', 3);
  finish('v2');
  await world.say('Bác thợ xay', ['Bác bảo dân xóm dỡ rào ngay. Đường sang Lúa Vàng thông rồi!', 'Cốm, vào nhà ngủ bù đi con, mặt mày còn ngái ngủ kìa.']);
  // Anh Cốm vào nhà, bác thợ xay về chỗ cũ trước nhà
  const home = world.map.buildings.find((b) => b.door.x === V2_HOME.x && b.door.y === V2_HOME.y) ?? null;
  await world.npcLeave(com, { building: home });
  if (miller) {
    await world.walkNpcTo(miller, V2_MILLER);
    world.face(miller, 'down');
  }
}

const V2 = [
  {
    id: 'v2-miller', sprite: 'npc-oldman', name: 'Bác thợ xay', map: 'village2', x: V2_MILLER.x, y: V2_MILLER.y, facing: 'down', fixed: true,
    async onTalk(world) {
      const name = this.name;
      if (villageDone('v2')) {
        await world.say(name, ['Kho thóc yên ổn rồi. Thằng Cốm ngày nào cũng mang thóc lép lên đồng cho bầy Pokémon cỏ.', 'Lên Lúa Vàng nhớ chào cô Thảo giùm bác nhé!']);
        return;
      }
      if (!taken('v2')) {
        const ok = await offer(world, name, [
          'Khổ quá cháu ơi! Một bầy Pokémon cỏ đêm nào cũng kéo về phá kho thóc của xóm, tha thóc lên đồng.',
          'Dân xóm sợ chúng lan sang ruộng Lúa Vàng nên đã rào đường lại rồi.',
          'Thằng Cốm con bác vác chĩa lên Đồng Cối Xay đuổi chúng từ sáng mà chưa thấy về. Cháu lên đó giúp bác với!',
        ], 'v2');
        if (ok) await world.say(name, ['Lối lên đồng ở phía bắc xóm.', 'Bọn chúng hay rắc phấn ngủ, cẩn thận đấy!']);
        return;
      }
      await world.say(name, pestsLeft()
        ? [`Bầy Pokémon cỏ còn ${pestsLeft()} con trên Đồng Cối Xay.`, 'Thằng Cốm chắc ở quanh kho thóc cũ góc tây bắc đồng.']
        : ['Thằng Cốm vẫn chưa về... Cháu lên kho thóc cũ góc tây bắc đồng xem nó thế nào giúp bác.']);
    },
  },
  {
    // Ngủ mê vì phấn ngủ của Gloom, nằm dưới mái kho thóc cũ
    id: 'v2-com', sprite: 'npc-camper', name: 'Anh Cốm', map: 'field2', x: 2, y: 7, facing: 'right', fixed: true,
    show: () => !villageDone('v2'),
    async onTalk(world) {
      if (!did('v2', 'gloom')) {
        await world.say(null, ['Anh Cốm nằm co dưới mái kho thóc cũ, ngáy khò khò. Người phủ đầy phấn ngủ.', 'Con Gloom canh bên cạnh, hễ ai lại gần là nó rắc phấn...']);
        return;
      }
      await wakeCom(world);
    },
  },
  ...PESTS.flatMap((p) => [
    {
      id: `v2-${p.step}`, mon: p.species, name: p.name, map: 'field2', x: p.at[0], y: p.at[1], facing: p.at[2], fixed: true,
      show: () => !did('v2', p.step) && !villageDone('v2'),
      onTalk: (world) => fightPest(world, p),
    },
    // Thua thì nép sang bên nhường đường (Gloom thì chui vào kho thóc cũ ngay trong cảnh cắt)
    ...(p.aside ? [{
      id: `v2-${p.step}-aside`, mon: p.species, name: p.name, map: 'field2', x: p.aside[0], y: p.aside[1], facing: 'down', fixed: true,
      show: () => did('v2', p.step) && !pestCaught(p) && !villageDone('v2'),
      lines: [`${p.name} nép một góc, run run nhìn bạn.`],
    }] : []),
    // Xong nhiệm vụ: sống yên ổn quanh kho thóc cũ
    {
      id: `v2-${p.step}-home`, mon: p.species, name: p.name, map: 'field2', x: p.home[0], y: p.home[1], facing: 'down', wander: 1,
      show: () => villageDone('v2') && !pestCaught(p),
      lines: [p.homeLine],
    },
  ]),
  {
    id: 'v2-guard', sprite: 'npc-camper', name: 'Dân xóm', map: 'village2', x: 23, y: 9, facing: 'down', fixed: true,
    async onTalk(world) {
      await world.say(this.name, villageDone('v2') ? ['Rào dỡ rồi. Lúa Vàng ở ngay phía đông!'] : v2Blocked());
    },
  },
  {
    id: 'v2-girl', sprite: 'npc-girl', name: 'Cô gái', map: 'village2', x: 6, y: 12, facing: 'down', wander: 1,
    lines: [
      'Gym Lúa Vàng của cô Thảo dùng Pokémon hệ Cỏ.',
      'Hệ Lửa, Bay, Băng, Độc và Bọ đánh hệ Cỏ đau lắm!',
      'Nhớ mang theo Awakening, bọn hệ Cỏ hay rắc phấn ngủ.',
    ],
  },
];
function v2Blocked() {
  return taken('v2')
    ? ['Bác thợ xay chưa báo đuổi xong bầy Pokémon cỏ, tôi chưa dỡ rào được.', 'Chúng ở trên Đồng Cối Xay, lối lên ở phía bắc xóm.']
    : ['Đường sang Lúa Vàng đang rào lại vì bầy Pokémon cỏ phá kho thóc.', 'Cháu hỏi bác thợ xay đứng trước nhà giữa xóm xem sao.'];
}

// ---------- 3. Xóm Trạm Điện: lên Đồi Cột Điện tìm cầu chì và cậu Tín, rồi Gary chặn đường ----------
// Kỹ sư nhờ lấy cầu chì dự phòng (cậu Tín học việc lên lấy từ sáng chưa về) → lối mòn góc tây nam xóm xuống Đồi Cột Điện
// (data/mapsVillageAreasA.js: hill3). Hai cầu chì văng ở góc đồi, cái cuối ở trạm phát cũ, Magneton bám cột điện chắn
// lối; đánh xong nó bay vút đi. Đủ ba cầu chì thì Tín (trốn ở bậc đồi cuối) dẫn bạn về xóm: chạy tới kỹ sư, lắp cầu chì,
// điện sáng lại, Tín về đứng phụ việc cạnh kỹ sư. Có điện thì cổng mở, nhưng Gary chờ ở lối ra phía tây.

const FUSES = 3;
const V3_ENGINEER = { x: 15, y: 10 };
const gary3 = garyAtGate('v3', {
  x: 2, y: 3, facing: 'right', team: rival3,
  intro: () => [
    `Ê, ${playerName()}! Lại gặp nhau rồi!`,
    'Tớ đứng chờ ở đây cả buổi vì cổng điện không mở. Hoá ra cậu là người sửa trạm điện à?',
    'Tiện thể, để tớ xem cậu tiến bộ tới đâu rồi!',
  ],
  again: ['Quay lại rồi à? Đấu tiếp nào!'],
  win: ['Hừ... cậu mạnh lên thật đấy.', 'Tớ đi trước tới Đèn Lồng đây. Đừng có mà đuổi theo!'],
  opened: 'Lối sang Thành phố Đèn Lồng đã mở!',
});

// Cậu Tín phụ việc cạnh kỹ sư (sau khi về xóm)
const V3_TIN = {
  id: 'v3-tin', sprite: 'npc-youngster', name: 'Cậu Tín', map: 'village3', x: 14, y: 11, facing: 'down', fixed: true,
  show: () => did('v3', 'power') || villageDone('v3'),
  lines: ['Em là Tín, học việc ở trạm điện. Cảm ơn anh chị hôm trước nhé!', 'Lần sau em không dám chạy lung tung trên đồi nữa đâu.'],
};

// Lắp cầu chì: trạm biến áp chạy lại, kỹ sư tặng quà (Gary xuất hiện ở lối ra phía tây sau cảnh này)
async function installPower(world) {
  for (let i = 0; i < FUSES; i++) useItem('fuse');
  await world.say('Kỹ sư trạm điện', ['Đủ ba cầu chì rồi! Lắp vào... xong!']);
  await world.say(null, ['Ù ù ù... Trạm biến áp chạy trở lại, đèn trong xóm bật sáng!']);
  await world.say('Kỹ sư trạm điện', ['Pokémon hệ Điện hay làm tê liệt lắm. Cậu cầm mấy lọ này mà lên gym.']);
  await world.giveItem('paralyzeHeal', 3);
  mark('v3', 'power');
}

// Về xóm cùng Tín: tối màn hình, hiện ra ở lối mòn góc tây nam; Tín chạy tới kỹ sư, lắp cầu chì, Tín về chỗ phụ việc
async function bringTinHome(world) {
  await world.say('Cậu Tín', ['Đủ ba cầu chì rồi! Về xóm thôi anh chị, em biết lối mòn tắt.']);
  await world.say(null, ['Bạn theo cậu Tín men đường dây điện về xóm...']);
  await world.warpTo({ to: 'village3', tx: 6, ty: 17, facing: 'up' });
  const tin = world.spawnNpc({ ...V3_TIN, x: 7, y: 17, facing: 'up' });
  const eng = world.findNpc('v3-engineer');
  await world.say('Cậu Tín', ['Anh ơi! Cầu chì đây ạ!']);
  if (eng) {
    await world.walkNpcTo(tin, eng.pos, { adjacent: true });
    world.faceNpcTo(eng, tin);
    world.faceNpcTo(tin, eng);
    await world.say('Kỹ sư trạm điện', ['Tín! Cả buổi không thấy mày đâu, tưởng bị điện giật rồi chứ!']);
    await world.say('Cậu Tín', ['Em bị con Magneton đuổi, trốn sau vách đá cả buổi. Nhờ anh chị này đấy ạ!']);
    await world.walkNpcTo(eng, world.pos, { adjacent: true });
    world.faceNpcToPlayer(eng);
    world.facePlayerTo(eng);
  }
  await installPower(world);
  await world.say('Kỹ sư trạm điện', ['Tín, ra trông trạm biến áp đi. Lần này đừng có chạy lung tung nữa.']);
  // Tín về chỗ phụ việc, kỹ sư về chỗ cũ
  await world.walkNpcTo(tin, { x: V3_TIN.x, y: V3_TIN.y });
  world.face(tin, 'down');
  if (eng) {
    await world.walkNpcTo(eng, V3_ENGINEER);
    world.face(eng, 'down');
  }
  await world.say(null, ['Có tiếng ai đó gọi ở lối ra phía tây...']);
}

const V3 = [
  {
    id: 'v3-engineer', sprite: 'npc-aide', name: 'Kỹ sư trạm điện', map: 'village3', x: V3_ENGINEER.x, y: V3_ENGINEER.y, facing: 'down', fixed: true,
    async onTalk(world) {
      const name = this.name;
      if (villageDone('v3')) {
        await world.say(name, ['Điện sáng khắp phố rồi. Gym của anh Quang chắc đang chạy hết công suất đấy!']);
        return;
      }
      if (did('v3', 'power')) {
        await world.say(name, ['Cậu bạn tóc nâu kia đứng chắn lối ra phía tây cả buổi rồi, hình như đang đợi cậu.']);
        return;
      }
      if (!taken('v3')) {
        const ok = await offer(world, name, [
          'Gay go rồi! Trạm biến áp cháy mất ba cầu chì, cả xóm lẫn phố Đèn Lồng mất điện.',
          'Không có điện thì cổng điện tử sang thành phố không mở được.',
          'Cầu chì dự phòng cất ở trạm phát cũ trên Đồi Cột Điện. Tôi sai cậu Tín học việc lên lấy từ sáng mà chưa thấy về... Cậu lên xem giúp tôi nhé?',
        ], 'v3');
        if (ok) await world.say(name, ['Lối xuống đồi ở góc tây nam xóm.', 'Đêm qua bọn Pokémon hệ Điện hoảng loạn chạy cả lên đó, có khi cầu chì văng tung toé rồi.']);
        return;
      }
      const have = itemCount('fuse');
      if (have < FUSES) {
        await world.say(name, [`Mới có ${have}/${FUSES} cầu chì. Trên Đồi Cột Điện còn nữa đấy!`, 'Tiện tìm xem thằng Tín đâu giúp tôi.']);
        return;
      }
      // Mang đủ cầu chì về một mình: lắp luôn, Tín từ trên đồi chạy về sau
      await installPower(world);
      const tin = world.spawnNpc({ ...V3_TIN, x: 6, y: 18, facing: 'up' });
      await world.say('Cậu Tín', ['Anh ơi! Em về rồi đây! Đèn sáng rồi kìa!']);
      await world.walkNpcTo(tin, { x: V3_TIN.x, y: V3_TIN.y });
      world.face(tin, 'down');
      await world.say(null, ['Có tiếng ai đó gọi ở lối ra phía tây...']);
    },
  },
  {
    // Trốn sau vách đá ở bậc đồi cuối, gần trạm phát cũ
    id: 'v3-tin-lost', sprite: 'npc-youngster', name: 'Cậu Tín', map: 'hill3', x: 32, y: 26, facing: 'left', fixed: true,
    show: () => !did('v3', 'power') && !villageDone('v3'),
    async onTalk(world) {
      const name = this.name;
      if (!taken('v3')) {
        await world.say(name, [
          'Em là Tín, học việc ở trạm điện. Anh kỹ sư sai em lên lấy cầu chì dự phòng...',
          'Nhưng con Magneton ở trạm phát cũ dữ quá, em không dám lại gần. Anh chị về xóm nói với anh kỹ sư giúp em nhé?',
        ]);
        return;
      }
      if (itemCount('fuse') >= FUSES) {
        await bringTinHome(world);
        return;
      }
      const lines = ['Anh chị là người anh kỹ sư nhờ lên tìm em à? May quá!'];
      if (!did('v3', 'magneton')) lines.push('Cầu chì cuối cùng ở trạm phát cũ góc tây nam, mà con Magneton cứ bám cột điện chắn lối. Em bị nó đuổi chạy tới đây.');
      lines.push(`Mấy cái cầu chì khác văng ra các góc đồi phía trên. Mới có ${itemCount('fuse')}/${FUSES} thôi, nhặt đủ thì quay lại em dẫn về xóm.`);
      await world.say(name, lines);
    },
  },
  {
    // Bám cột điện ở trạm phát cũ, chắn hõm có cầu chì cuối cùng
    id: 'v3-magneton', mon: 'magneton', name: 'Magneton', map: 'hill3', x: 6, y: 27, facing: 'right', fixed: true,
    show: () => !did('v3', 'magneton') && !did('v3', 'power') && !villageDone('v3'),
    async onTalk(world) {
      await world.say(null, ['Magneton bám chặt lấy cột điện cũ, tia lửa điện xẹt lách tách...', 'Nó rít lên rồi phóng điện về phía bạn!']);
      const result = await wildFight(world, 'magneton', 24);
      if (!result) return;
      mark('v3', 'magneton');
      const mag = world.findNpc('v3-magneton');
      if (result === 'win') {
        if (mag) await world.npcFlyAway(mag);
        await world.say(null, ['Magneton kêu rè rè rồi lơ lửng bay vút qua đỉnh đồi.']);
      } else if (mag) {
        world.removeNpc(mag);
      }
      await world.say(null, [taken('v3') ? 'Lối vào trạm phát cũ đã thông. Cầu chì nằm ngay trong đó!' : 'Lối vào trạm phát cũ đã thông.']);
    },
  },
  V3_TIN,
  { ...gary3.npc, show: () => did('v3', 'power') && !villageDone('v3') },
  {
    id: 'v3-boy', sprite: 'npc-boy', name: 'Cậu bé', map: 'village3', x: 20, y: 14, facing: 'down', wander: 1,
    lines: [
      'Gym Đèn Lồng của anh Quang dùng Pokémon hệ Điện.',
      'Pokémon hệ Đất miễn nhiễm chiêu hệ Điện luôn! Geodude, Rhyhorn đều tốt cả.',
    ],
  },
];

// ---------- 4. Làng Bến Đò: bè gỗ sửa cầu mắc cạn ở Đầm Lau, Gyarados chắn cầu ván ----------
// Đêm qua Gyarados từ thượng nguồn trôi về quẫy gãy cầu gỗ; chú thợ mộc đứng sửa cầu nhưng hết gỗ: bè gỗ của anh thả bè
// mắc cạn trên cồn cát giữa Đầm Lau phía bắc làng (data/mapsVillageAreasA.js: marsh4), Gyarados nằm chắn cầu ván ra cồn.
// Đánh (hoặc bắt) Gyarados: nó lặn xuống đầm bơi ngược về thượng nguồn. Anh thả bè đưa bạn theo bè xuôi về làng: hai người
// thay ván xong cầu, chú thợ mộc về nhà, anh thả bè vào Pokémon Center nghỉ chân, ông lái đò tặng quà.

const V4_CARPENTER_HOME = { x: 4, y: 16 }; // cửa nhà chú thợ mộc (nhà mái xanh bờ tây)
const V4_BLOCKED = ['Cầu gãy mất mấy tấm ván, chưa qua được đâu!', 'Gỗ sửa cầu mắc cạn ở Đầm Lau phía bắc làng. Ông lái đò biết chuyện đấy.'];

async function rewardFerry(world) {
  await world.say('Ông lái đò', ['Cầu thông rồi! Cả làng mang ơn cháu.', 'Ông tặng cháu mấy lọ thuốc này. Gym Sông Nước khó lắm đấy.']);
  await world.giveItem('hyperPotion', 2);
  mark('v4', 'reward');
}

// Theo bè gỗ về làng: tối màn hình, hiện ra cạnh cầu; anh thả bè cùng chú thợ mộc thay ván, chú về nhà, anh vào Pokémon
// Center nghỉ chân, ông lái đò tặng quà
async function bringRaftHome(world) {
  const rafter = world.findNpc('v4-rafter');
  if (rafter) {
    await world.walkNpcTo(rafter, world.pos, { adjacent: true });
    world.faceNpcToPlayer(rafter);
    world.facePlayerTo(rafter);
  }
  await world.say('Anh thả bè', [
    'Cảm ơn cậu! Tôi kẹt trên cồn này từ hôm qua, con Gyarados cứ nằm chắn cầu ván.',
    'Bè gỗ này làng đặt về sửa cầu đấy. Cậu lên bè, tôi chống bè xuôi về làng luôn!',
  ]);
  await world.say(null, ['Bè gỗ trôi xuôi dòng sông, len qua lau sậy về Làng Bến Đò...']);
  await world.warpTo({ to: 'village4', tx: 13, ty: 11, facing: 'left' });
  const raft = world.spawnNpc({ id: 'v4-rafter-walk', sprite: 'npc-hiker', name: 'Anh thả bè', x: 13, y: 12, facing: 'left' });
  const carpenter = world.findNpc('v4-carpenter');
  if (carpenter) {
    await world.walkNpcTo(raft, carpenter.pos, { adjacent: true });
    world.faceNpcTo(carpenter, raft);
    world.faceNpcTo(raft, carpenter);
    await world.say('Chú thợ mộc', ['Gỗ về rồi! Anh em mình thay ván thôi!']);
  }
  await world.say(null, ['Cộc cộc cộc... Hai người thoăn thoắt thay mấy tấm ván gãy.', 'Cây cầu gỗ sang Thành phố Sông Nước đã lành lặn!']);
  setFlag('quest:v4');
  finish('v4');
  const home = world.map.buildings.find((b) => b.door.x === V4_CARPENTER_HOME.x && b.door.y === V4_CARPENTER_HOME.y) ?? null;
  if (carpenter) {
    await world.say('Chú thợ mộc', ['Xong! Tôi về nhà cất đồ nghề đây.']);
    await world.npcLeave(carpenter, { building: home });
  }
  await world.say('Anh thả bè', ['Tôi vào Pokémon Center nghỉ chân đã. Cảm ơn cậu nhé!']);
  await world.npcLeave(raft, { building: world.map.buildings.find((b) => b.type === 'center') ?? null });
  const ferry = world.findNpc('v4-ferryman');
  if (ferry) {
    world.faceNpcToPlayer(ferry);
    world.facePlayerTo(ferry);
  }
  await rewardFerry(world);
}

const V4 = [
  {
    id: 'v4-ferryman', sprite: 'npc-fisher', name: 'Ông lái đò', map: 'village4', x: 12, y: 9, facing: 'left', fixed: true,
    async onTalk(world) {
      const name = this.name;
      if (villageDone('v4') && !did('v4', 'reward')) {
        await rewardFerry(world);
        return;
      }
      if (villageDone('v4')) {
        await world.say(name, ['Qua cầu là Thành phố Sông Nước. Chị Thủy dùng Pokémon hệ Nước: hệ Điện và Cỏ sẽ có lợi.']);
        return;
      }
      if (!taken('v4')) {
        const ok = await offer(world, name, [
          'Đêm qua một con Gyarados hung dữ từ thượng nguồn trôi về, quẫy gãy mấy nhịp cầu gỗ, lật luôn cả đò của ông!',
          'Chú thợ mộc đang sửa cầu mà hết gỗ. Bè gỗ làng đặt về lại mắc cạn trên cồn cát giữa Đầm Lau phía bắc làng.',
          'Nghe nói con Gyarados ấy giờ nằm chắn cầu ván ra cồn, anh thả bè kẹt luôn ngoài đó. Cháu giúp làng được không?',
        ], 'v4');
        if (ok) await world.say(name, ['Lối lên Đầm Lau ở sau Pokémon Center, phía bắc làng.', 'Gyarados là hệ Nước và Bay, chiêu hệ Điện đánh nó đau lắm!']);
        return;
      }
      await world.say(name, ['Đầm Lau ở cuối lối mòn sau Pokémon Center.', 'Cầu ván ra cồn cát ở bờ tây đầm, phải vòng qua lau sậy mới tới.']);
    },
  },
  {
    // Nằm chắn cầu ván ra cồn cát giữa đầm
    id: 'v4-gyarados', mon: 'gyarados', name: 'Gyarados', map: 'marsh4', x: 16, y: 5, facing: 'left', fixed: true,
    show: () => !did('v4', 'gyarados') && !villageDone('v4'),
    async onTalk(world) {
      await world.say(null, ['Gyarados nằm chắn ngang cầu ván, gầm lên dữ tợn!']);
      if (!(await world.ask('Đấu với Gyarados?'))) return;
      const result = await wildFight(world, 'gyarados', 30, 'water');
      if (!result) return;
      setFlag('quest:v4');
      mark('v4', 'gyarados');
      const gya = world.findNpc('v4-gyarados');
      if (result === 'win') {
        if (gya) await world.npcFlyAway(gya);
        await world.say(null, ['Gyarados trườn khỏi cầu ván, lặn xuống đầm rồi bơi ngược về thượng nguồn.']);
      } else if (gya) {
        world.removeNpc(gya);
      }
      await bringRaftHome(world);
    },
  },
  {
    // Kẹt trên cồn cát cùng bè gỗ
    id: 'v4-rafter', sprite: 'npc-hiker', name: 'Anh thả bè', map: 'marsh4', x: 19, y: 5, facing: 'left', fixed: true,
    show: () => !villageDone('v4'),
    async onTalk(world) {
      if (did('v4', 'gyarados')) {
        await bringRaftHome(world);
        return;
      }
      await world.say(this.name, ['Ê! Cậu kia! Tôi kẹt trên cồn cát này từ hôm qua!', 'Con Gyarados nằm chắn cầu ván, tôi không đưa bè gỗ về làng được...']);
    },
  },
  {
    // Đứng trên cầu gãy chờ gỗ (chắn cầu tới khi sửa xong)
    id: 'v4-carpenter', sprite: 'npc-camper', name: 'Chú thợ mộc', map: 'village4', x: 9, y: 10, facing: 'right', fixed: true,
    show: () => !villageDone('v4'),
    async onTalk(world) {
      await world.say(this.name, V4_BLOCKED);
    },
  },
  {
    id: 'v4-kid', sprite: 'npc-youngster', name: 'Nhóc chài lưới', map: 'village4', x: 17, y: 9, facing: 'down', wander: 1,
    lines: ['Gyarados là hệ Nước và Bay, chiêu hệ Điện đánh nó đau gấp bốn lần đó!', 'Đánh cho nó yếu rồi ném bóng, biết đâu bắt được!'],
  },
];

// ---------- 5. Làng Đất Sét: tay buôn đất lậu chiếm Mỏ Đất Sét, giữ chú Sét thợ cả ----------
// Trưởng làng nhờ đuổi hai tay buôn đất lậu → cửa mỏ ở vách đá góc tây bắc làng vào Mỏ Đất Sét (data/mapsVillageAreasA.js:
// pit5). Tay buôn Lực canh hầm phía đông, tay buôn Tài giữ chú Sét trong hầm chính. Thua cả hai, chúng chuồn theo đường
// hầm tự đào lên bãi đất sau làng rồi chạy mất. Chú Sét dẫn bạn theo đường hầm về làng: trưởng làng tặng quà, xe đất lăn
// bánh sang Thành phố Lò Gốm (cổng mở), chú Sét về nhà tắm rửa.

const THIEVES = ['v5-thief-a', 'v5-thief-b'];
const thievesLeft = () => THIEVES.filter((t) => !state.defeatedTrainers.has(t)).length;
const V5_CHIEF = { x: 12, y: 8 };
const V5_SET_HOME = { x: 4, y: 16 }; // cửa nhà chú Sét (nhà mái đỏ phía tây nam)

// Thắng tay buôn: còn tên kia thì thôi; thua cả hai thì tên vừa thua chuồn theo đường hầm, chú Sét được cứu
async function thiefBeaten(world, npc) {
  if (thievesLeft()) return;
  setFlag('quest:v5');
  if (npc) {
    await world.say(npc.def.name, ['Thua cả rồi! Chuồn thôi!']);
    await world.npcLeave(npc, { toMap: 'village5' });
  }
  await world.say(null, ['Bọn buôn đất lậu chui vào đường hầm tự đào rồi mất hút.']);
  await freeSet(world);
}

// Cứu chú Sét: theo đường hầm về làng, trưởng làng tặng quà, xe đất sang thành phố, chú Sét về nhà
async function freeSet(world) {
  const set = world.findNpc('v5-set');
  if (set) {
    await world.walkNpcTo(set, world.pos, { adjacent: true });
    world.faceNpcToPlayer(set);
    world.facePlayerTo(set);
  }
  await world.say('Chú Sét', [
    'Cảm ơn cháu! Bọn chúng trói chú ở đây từ hôm kia, bắt chú chỉ chỗ đất sét tốt nhất mỏ.',
    'Đường hầm bọn chúng đào thông lên bãi đất sau làng. Mình theo lối đó về cho nhanh!',
  ]);
  await world.say(null, ['Bạn theo chú Sét leo lên đường hầm...']);
  await world.warpTo({ to: 'village5', tx: 8, ty: 4, facing: 'down' });
  const uncle = world.spawnNpc({ id: 'v5-set-walk', sprite: 'npc-hiker', name: 'Chú Sét', x: 7, y: 4, facing: 'down' });
  const chief = world.findNpc('v5-chief');
  await world.say('Chú Sét', ['Trưởng làng ơi! Tôi về rồi đây!']);
  if (chief) {
    await world.walkNpcTo(uncle, chief.pos, { adjacent: true });
    world.faceNpcTo(chief, uncle);
    world.faceNpcTo(uncle, chief);
    await world.say('Trưởng làng', ['Sét! Cả làng tưởng chú bị bọn chúng bắt đi đâu mất rồi!']);
    await world.say('Chú Sét', ['Nhờ cháu này đánh đuổi hai tên buôn lậu đấy. Chúng chuồn theo đường hầm, chạy mất dép rồi!']);
    await world.walkNpcTo(chief, world.pos, { adjacent: true });
    world.faceNpcToPlayer(chief);
    world.facePlayerTo(chief);
  }
  await world.say('Trưởng làng', ['Đất sét lại về tay làng rồi! Cảm ơn cháu.', 'Lò gốm hay làm bỏng lắm, cháu cầm mấy lọ Burn Heal này.']);
  await world.giveItem('burnHeal', 3);
  finish('v5');
  await world.say('Trưởng làng', ['Chất đất lên xe cho bác đánh xe đi! Đường sang Thành phố Lò Gốm thông rồi!']);
  // Xe đất lăn bánh sang thành phố, chú Sét về nhà, trưởng làng về chỗ cũ
  const carter = world.findNpc('v5-carter');
  if (carter) {
    await world.say('Người đánh xe', ['Xe đầy đất rồi! Ta lên Lò Gốm đây, đường thông rồi đấy!']);
    await world.npcLeave(carter, { toMap: 'town6' });
  }
  await world.say('Chú Sét', ['Chú về nhà tắm cái đã, người toàn bùn đất!']);
  const home = world.map.buildings.find((b) => b.door.x === V5_SET_HOME.x && b.door.y === V5_SET_HOME.y) ?? null;
  await world.npcLeave(uncle, { building: home });
  if (chief) {
    await world.walkNpcTo(chief, V5_CHIEF);
    world.face(chief, 'down');
  }
}

const V5 = [
  {
    id: 'v5-chief', sprite: 'npc-oldman', name: 'Trưởng làng', map: 'village5', x: V5_CHIEF.x, y: V5_CHIEF.y, facing: 'down', fixed: true,
    async onTalk(world) {
      const name = this.name;
      if (villageDone('v5')) {
        await world.say(name, ['Đất sét đã lên xe về thành phố.', 'Thầy Nung dùng Pokémon hệ Lửa: mang theo Pokémon hệ Nước, Đất hoặc Đá nhé.']);
        return;
      }
      if (!taken('v5') && !(await offer(world, name, [
        'Hai tay buôn đất lậu chiếm Mỏ Đất Sét của làng, đào trộm đem bán.',
        'Chúng còn bắt chú Sét, thợ cả của làng, giữ trong mỏ. Xe chở đất cho lò gốm thành phố đành nằm chắn ở cổng làng.',
        'Cháu đánh đuổi chúng giúp làng nhé? Cửa mỏ ở vách đá góc tây bắc làng.',
      ], 'v5'))) return;
      await world.say(name, thievesLeft()
        ? [`Còn ${thievesLeft()} tên trong Mỏ Đất Sét. Cửa mỏ ở vách đá góc tây bắc làng.`, 'Nhớ tìm cả chú Sét nữa nhé!']
        : ['Bọn buôn lậu chạy mất rồi à? Thế chú Sét đâu? Cháu vào mỏ đưa chú ấy về giúp ta nhé.']);
    },
  },
  {
    // Canh trong hốc đá cạnh hầm phía đông: đi ngang là bị phát hiện
    id: 'v5-thief-a', sprite: 'npc-hiker', name: 'Tay buôn đất Lực', map: 'pit5', x: 25, y: 18, facing: 'right', sight: 3,
    team: [['graveler', 33], ['arbok', 33]], prize: 30, noRematch: true, show: () => !villageDone('v5'),
    intro: 'Mỏ này giờ là của bọn tao! Biến đi trước khi tao nổi nóng!', lose: 'Ối giời... đau quá!',
    after: 'Đại ca Tài ở hầm chính giữa mỏ. Mày thắng được đại ca thì bọn tao mới cuốn gói!',
    onDefeat: thiefBeaten,
  },
  {
    // Giữ chú Sét trong hầm chính, cạnh lỗ thang đường hầm tự đào
    id: 'v5-thief-b', sprite: 'npc-camper', name: 'Tay buôn đất Tài', map: 'pit5', x: 14, y: 13, facing: 'up', sight: 3,
    team: [['rhyhorn', 33], ['weezing', 34]], prize: 30, noRematch: true, show: () => !villageDone('v5'),
    intro: 'Đứa nào dám mò xuống tận đây? Đất sét mỏ này bán được giá lắm, đừng hòng lấy lại!', lose: 'Không ngờ một đứa nhóc lại mạnh thế...',
    after: 'Được rồi, bọn tao cuốn gói ngay đây.',
    onDefeat: thiefBeaten,
  },
  {
    id: 'v5-set', sprite: 'npc-hiker', name: 'Chú Sét', map: 'pit5', x: 10, y: 15, facing: 'right', fixed: true,
    show: () => !villageDone('v5'),
    async onTalk(world) {
      if (thievesLeft()) {
        await world.say(this.name, ['Suỵt! Chú là Sét, thợ cả của làng. Bọn buôn lậu trói chú ở đây bắt chỉ chỗ đất tốt.', 'Tên Tài cầm đầu đứng ngay đằng kia. Cháu cẩn thận!']);
        return;
      }
      await freeSet(world);
    },
  },
  {
    id: 'v5-carter', sprite: 'npc-hiker', name: 'Người đánh xe', map: 'village5', x: 2, y: 9, facing: 'down', fixed: true,
    show: () => !villageDone('v5'),
    async onTalk(world) {
      await world.say(this.name, V5_BLOCKED);
    },
  },
];
const V5_BLOCKED = ['Xe chở đất chắn kín cổng làng. Không có đất sét thì xe chẳng đi đâu cả.', 'Trưởng làng đứng ở giữa làng đó, cháu hỏi ông xem.'];

// ---------- 6. Bản Vách Đá: đá lở, võ sư Hổ lên Mỏ Đá Vách Núi tìm Machoke ----------
// Trưởng bản nhờ: đá lở chắn đường sang Núi Đá, chỉ đội Machoke của võ sư Hổ dọn nổi, mà con Machoke khoẻ nhất hoảng sợ
// chạy lên Mỏ Đá Vách Núi phía bắc bản (data/mapsVillageAreasB.js: quarry6), võ sư lên tìm từ sáng chưa về. Ở hố mỏ cũ
// góc tây bắc, Machoke bị Golbat đầu đàn (hang bị đá lở vùi mất) dồn vào hốc đá: đuổi Golbat bay đi, Machoke chạy về với
// thầy. Võ sư giữ lệ của bản, chỉ giúp ai thắng mình: thắng thì thầy trò cùng xuống bản, Machoke dọn đá ở cổng tây rồi
// hai thầy trò về chỗ tập giữa bản. (Trước đây kẻ dồn Machoke là Aerodactyl; Pokémon hoá thạch giờ chỉ có được bằng cách
// hồi sinh từ hoá thạch ở Viện Hoá thạch Núi Đá, story/postgame.js, nên đổi thành Golbat. Id NPC giữ như cũ cho bản lưu cũ.)

const master6 = () => ({
  id: 'v6-master', sprite: 'npc-hiker', name: 'Võ sư Hổ', prize: 30, noRematch: true, lose: 'Hay lắm! Ta chịu thua.',
  team: [['machop', 37], ['machoke', 38], ['hitmonchan', 39]],
});

// Võ sư Hổ và Machoke ở chỗ tập giữa bản (sau khi dọn đá xong)
const V6_MASTER_HOME = {
  id: 'v6-master', sprite: 'npc-hiker', name: 'Võ sư Hổ', map: 'village6', x: 12, y: 7, facing: 'down', fixed: true,
  show: () => villageDone('v6'),
  lines: ['Đội Machoke của ta dọn sạch đá rồi. Đi đường cẩn thận!', 'Hệ Giác đấu đánh hệ Đá đau lắm. Gặp thầy Sơn ở Núi Đá thì nhớ lấy!'],
};
const V6_MACHOKE_HOME = {
  id: 'v6-machoke', mon: 'machoke', name: 'Machoke', map: 'village6', x: 13, y: 7, facing: 'down', fixed: true,
  show: () => villageDone('v6'),
  lines: ['Machoke gồng cơ bắp khoe vừa khuân xong cả đống đá lở!'],
};
const V6_RESCUED = { x: 6, y: 4 }; // chỗ Machoke đứng cạnh thầy trong hố mỏ sau khi được cứu

// Thách đấu võ sư Hổ trong hố mỏ: thắng thì xuống bản dọn đá
async function challengeMaster6(world) {
  const name = 'Võ sư Hổ';
  if (!(await world.ask('Thách đấu võ sư Hổ?', name))) {
    await world.say(name, ['Chưa sẵn sàng à? Ta đợi ở đây, khi nào muốn đấu thì quay lại.']);
    return;
  }
  if ((await world.startBattle({ trainer: master6() })) !== 'win') return;
  setFlag('quest:v6');
  await world.say(name, ['Đúng là cao thủ! Lời hứa là lời hứa.', 'Machoke, theo ta xuống bản dọn đá nào!']);
  await clearRockslide(world);
}

// Thầy trò võ sư Hổ xuống bản: Machoke dọn đá lở ở cổng tây, võ sư tặng quà rồi hai thầy trò về chỗ tập giữa bản
async function clearRockslide(world) {
  await world.say(null, ['Bạn theo võ sư Hổ và Machoke men theo khe núi xuống bản...']);
  await world.warpTo({ to: 'village6', tx: 4, ty: 11, facing: 'left' });
  const master = world.spawnNpc({ ...V6_MASTER_HOME, x: 3, y: 10, facing: 'left' });
  const machoke = world.spawnNpc({ ...V6_MACHOKE_HOME, x: 2, y: 11, facing: 'left' });
  await world.say('Võ sư Hổ', ['Machoke, dọn đá!']);
  await world.say(null, [
    'Machoke gồng mình nhấc bổng từng tảng đá lớn, võ sư Hổ hô từng nhịp...',
    'Rầm! Rầm! Đống đá lở chắn cổng tây được dọn sạch.',
    'Đường sang Thành phố Núi Đá đã thông!',
  ]);
  world.faceNpcToPlayer(master);
  world.facePlayerTo(master);
  await world.say('Võ sư Hổ', ['Xong! Cháu cầm lấy, qua Núi Đá sẽ cần đến đấy.']);
  await world.giveItem('revive', 2);
  finish('v6');
  await world.say('Võ sư Hổ', ['Thầy trò ta về chỗ tập đây. Rảnh thì ghé đấu với ta một trận cho vui!']);
  await Promise.all([
    world.walkNpcTo(master, { x: V6_MASTER_HOME.x, y: V6_MASTER_HOME.y }),
    world.walkNpcTo(machoke, { x: V6_MACHOKE_HOME.x, y: V6_MACHOKE_HOME.y }),
  ]);
  world.face(master, 'down');
  world.face(machoke, 'down');
}

const V6 = [
  {
    id: 'v6-elder', sprite: 'npc-oldman', name: 'Trưởng bản', map: 'village6', x: 21, y: 16, facing: 'up', fixed: true,
    async onTalk(world) {
      const name = this.name;
      if (villageDone('v6')) {
        await world.say(name, ['Đường sang Núi Đá thông rồi.', 'Thầy Sơn dùng Pokémon hệ Đá: hệ Nước, Cỏ, Giác đấu và Đất đều có lợi.']);
        return;
      }
      if (!taken('v6')) {
        const ok = await offer(world, name, [
          'Đêm qua đá lở chắn mất đường sang Thành phố Núi Đá.',
          'Chỉ có đội Machoke của võ sư Hổ mới dọn nổi. Nhưng con Machoke khoẻ nhất của ông ấy hoảng sợ chạy lên Mỏ Đá Vách Núi từ đêm qua.',
          'Võ sư lên mỏ tìm từ sáng mà chưa thấy về. Cháu lên đó xem giúp bản nhé?',
        ], 'v6');
        if (ok) await world.say(name, ['Lối lên mỏ ở giữa hai vách đá phía bắc bản.', 'Mỏ vừa lở, lối giữa bị chặn rồi. Cháu phải đi vòng, cẩn thận đá rơi!']);
        return;
      }
      await world.say(name, did('v6', 'rescued')
        ? ['Võ sư Hổ tìm được Machoke rồi à? Tốt quá!', 'Có điều ông ấy vẫn giữ lệ cũ: phải thắng ông ấy thì ông mới chịu giúp.']
        : ['Lối lên Mỏ Đá Vách Núi ở giữa hai vách đá phía bắc bản.']);
    },
  },
  {
    // Trong hố mỏ cũ: đứng nhìn Machoke bị dồn vào hốc đá. Thắng võ sư thì thầy trò xuống bản (V6_MASTER_HOME)
    id: 'v6-master-quarry', sprite: 'npc-hiker', name: 'Võ sư Hổ', map: 'quarry6', x: 7, y: 4, facing: 'left', fixed: true,
    show: () => !villageDone('v6'),
    async onTalk(world) {
      const name = this.name;
      if (!did('v6', 'rescued')) {
        await world.say(name, [
          'Ta là Hổ, võ sư của Bản Vách Đá.',
          'Machoke của ta bị con Golbat đầu đàn kia dồn vào hốc đá! Hang của nó bị đá lở vùi mất nên nó hung dữ lắm.',
          'Pokémon của ta đánh với nó cả buổi, kiệt sức hết rồi. Cháu đuổi nó đi giúp ta với!',
        ]);
        return;
      }
      await world.say(name, ['Muốn ta xuống bản dọn đá thì thắng ta trước đã!']);
      await challengeMaster6(world);
    },
  },
  {
    id: 'v6-aerodactyl', mon: 'golbat', name: 'Golbat', map: 'quarry6', x: 3, y: 5, facing: 'down', fixed: true,
    show: () => !did('v6', 'rescued') && !villageDone('v6'),
    async onTalk(world) {
      await world.say(null, ['Golbat đầu đàn xoè cánh chắn trước hốc đá, rít lên chói tai!', 'Nó lao bổ xuống tấn công!']);
      const result = await wildFight(world, 'golbat', 40);
      if (!result) return;
      const bird = world.findNpc('v6-aerodactyl');
      if (result === 'win') {
        if (bird) await world.npcFlyAway(bird);
        await world.say(null, ['Golbat bay vút lên khỏi vách núi rồi mất hút vào một hang đá xa.']);
      } else if (bird) {
        world.removeNpc(bird);
      }
      setFlag('quest:v6');
      mark('v6', 'rescued');
      // Machoke chạy ra khỏi hốc đá về với thầy (đứng đúng chỗ của Machoke sau khi được cứu)
      const machoke = world.findNpc('v6-machoke-lost');
      const master = world.findNpc('v6-master-quarry');
      if (machoke) await world.walkNpcTo(machoke, V6_RESCUED);
      if (machoke && master) {
        world.faceNpcTo(machoke, master);
        world.faceNpcTo(master, machoke);
      }
      await world.say('Võ sư Hổ', ['Machoke! Con không sao chứ?']);
      await world.say(null, ['Machoke ôm chầm lấy võ sư Hổ, mừng rỡ kêu ầm lên.']);
      if (master) {
        world.faceNpcToPlayer(master);
        world.facePlayerTo(master);
      }
      await world.say('Võ sư Hổ', [
        'Cảm ơn cháu! Đủ đội Machoke rồi, xuống bản dọn đá được rồi.',
        'Nhưng lệ của Bản Vách Đá: võ sư chỉ giúp ai thắng được mình. Cháu dám đấu với ta không?',
      ]);
      await challengeMaster6(world);
    },
  },
  {
    id: 'v6-machoke-lost', mon: 'machoke', name: 'Machoke', map: 'quarry6', x: 3, y: 3, facing: 'down', fixed: true,
    show: () => !did('v6', 'rescued') && !villageDone('v6'),
    lines: ['Machoke co ro trong hốc đá, run lẩy bẩy...'],
  },
  {
    id: 'v6-machoke-quarry', mon: 'machoke', name: 'Machoke', map: 'quarry6', x: V6_RESCUED.x, y: V6_RESCUED.y, facing: 'right', fixed: true,
    show: () => did('v6', 'rescued') && !villageDone('v6'),
    lines: ['Machoke đứng cạnh thầy, vươn vai khởi động.'],
  },
  V6_MASTER_HOME,
  V6_MACHOKE_HOME,
  {
    id: 'v6-worker', sprite: 'npc-camper', name: 'Thợ đá', map: 'village6', x: 3, y: 9, facing: 'down', fixed: true,
    async onTalk(world) {
      await world.say(this.name, villageDone('v6') ? ['Đá dọn sạch rồi, đi được rồi đấy!'] : V6_BLOCKED);
    },
  },
  {
    id: 'v6-girl', sprite: 'npc-girl', name: 'Cô gái', map: 'village6', x: 9, y: 12, facing: 'down', wander: 1,
    lines: ['Núi Đá hay có bão cát. Pokémon hệ Đá, Đất, Thép thì không sao, còn lại bị cát quất đau lắm.'],
  },
];
const V6_BLOCKED = ['Đá lở chắn kín lối sang Thành phố Núi Đá. Không ai qua được!', 'Trưởng bản đang lo chuyện này, nhà ông ấy ở phía đông nam.'];

// ---------- 7. Xóm Hương Khói: Haunter cuỗm chuông đồng trốn vào Nghĩa Trang Rừng Trúc, rồi Gary chặn đường ----------
// Sư thầy nhờ lấy lại chuông (chú tiểu Minh lén đuổi theo Haunter từ sáng chưa về) → lối mòn góc đông nam xóm xuống
// Nghĩa Trang Rừng Trúc (data/mapsVillageAreasB.js: grave7). Haunter hiện ở nghĩa trang cổ, trêu bạn rồi bay mất về miếu
// hoang góc tây nam; ở đó nó chặn cửa miếu, chú tiểu trốn bên trong. Đánh Haunter xong, chú tiểu ôm chuông cùng bạn về
// xóm: chạy tới sư thầy, sư thầy gióng chuông rồi chú tiểu vào miếu. Chuông ngân thì cổng Chùa Cổ mở, Gary chờ ở lối ra.

const V7_TEMPLE = { x: 13, y: 5 }; // cửa miếu (nhà mái đỏ cạnh sư thầy)

const gary7 = garyAtGate('v7', {
  x: 23, y: 11, facing: 'left', team: rival4,
  intro: () => [
    `Hừ, lại là cậu à, ${playerName()}!`,
    'Tiếng chuông vừa rồi là do cậu hả? Cổng Chùa Cổ mở rồi đấy.',
    'Nhưng muốn vào thì phải qua tớ trước! Đội của tớ giờ mạnh nhất vùng này!',
  ],
  again: ['Lại muốn thua nữa à? Lên đi!'],
  win: ['...Được rồi, cậu thắng.', 'Nhưng ở Liên minh, tớ sẽ không thua nữa đâu! Nhớ đấy!'],
  opened: 'Cổng sang Thành phố Chùa Cổ đã mở!',
});

// Sư thầy gióng chuông: cổng Chùa Cổ mở, tặng quà (Gary xuất hiện ở lối ra phía đông sau cảnh này)
async function ringBell(world, monk) {
  if (monk) {
    world.faceNpcToPlayer(monk);
    world.facePlayerTo(monk);
  }
  await world.say('Sư thầy', ['Chiếc chuông đồng! Đa tạ con. Để ta gióng chuông.']);
  await world.say(null, ['Boong... boong... Tiếng chuông đồng ngân vang khắp xóm.']);
  await world.say('Sư thầy', ['Cổng Chùa Cổ mở rồi. Con cầm mấy lọ Full Heal này, gym Siêu linh hay làm rối trí lắm.']);
  await world.giveItem('fullHeal', 2);
  mark('v7', 'bell');
}

// Đưa chú tiểu về xóm: tối màn hình, hiện ra trước miếu; chú tiểu chạy tới sư thầy, sư thầy gióng chuông, chú tiểu vào miếu
async function bringBellHome(world) {
  const novice = world.findNpc('v7-novice');
  if (novice) {
    await world.walkNpcTo(novice, world.pos, { adjacent: true });
    world.faceNpcToPlayer(novice);
    world.facePlayerTo(novice);
  }
  await world.say('Chú tiểu Minh', [
    'Anh chị đuổi được con Haunter rồi! Em trốn trong miếu hoang cả buổi, sợ muốn khóc...',
    'Em lén đi tìm chuông một mình, về thế nào cũng bị thầy mắng. Anh chị về cùng em nhé?',
  ]);
  await world.say(null, ['Chú tiểu ôm chiếc chuông đồng, theo bạn ra khỏi rừng trúc...']);
  await world.warpTo({ to: 'village7', tx: 15, ty: 8, facing: 'up' });
  const kid = world.spawnNpc({ id: 'v7-novice-walk', sprite: 'npc-boy', name: 'Chú tiểu Minh', x: 14, y: 8, facing: 'up' });
  const monk = world.findNpc('v7-monk');
  await world.say('Chú tiểu Minh', ['Thầy ơi! Con mang chuông về rồi!']);
  if (monk) {
    await world.walkNpcTo(kid, monk.pos, { adjacent: true });
    world.faceNpcTo(monk, kid);
    world.faceNpcTo(kid, monk);
    await world.say('Sư thầy', ['Minh! Con đi đâu từ sáng làm thầy lo quá.', 'Lần sau không được vào nghĩa trang một mình nữa, nghe chưa?']);
    await world.say('Chú tiểu Minh', ['Dạ... con biết lỗi rồi ạ. Nhờ anh chị này đuổi con Haunter đi đấy thầy!']);
  }
  await ringBell(world, monk);
  await world.say('Sư thầy', ['Minh, vào miếu thắp nén hương tạ lỗi đi con.']);
  // Chú tiểu vào miếu
  const temple = world.map.buildings.find((b) => b.door.x === V7_TEMPLE.x && b.door.y === V7_TEMPLE.y);
  await world.npcLeave(kid, { building: temple ?? null });
  await world.say(null, ['Có ai đó đang đứng chờ ở lối ra phía đông...']);
}

const V7 = [
  {
    id: 'v7-monk', sprite: 'npc-oldman', name: 'Sư thầy', map: 'village7', x: 14, y: 6, facing: 'down', fixed: true,
    async onTalk(world, npc) {
      const name = this.name;
      if (villageDone('v7')) {
        await world.say(name, ['Chuông đã ngân trở lại.', 'Chị Tâm ở gym Chùa Cổ dùng Pokémon hệ Siêu linh: hệ Bọ và Ma đánh rất đau.']);
        return;
      }
      if (did('v7', 'bell')) {
        await world.say(name, ['Có cậu bạn tóc nâu đứng chờ ở lối ra phía đông, hình như đang đợi con đấy.']);
        return;
      }
      if (did('v7', 'haunter')) {
        // Lấy được chuông nhưng chưa xem cảnh đưa chú tiểu về (bản lưu giữa chừng): gióng chuông luôn
        await ringBell(world, npc);
        await world.say(null, ['Có ai đó đang đứng chờ ở lối ra phía đông...']);
        return;
      }
      if (!taken('v7')) {
        const ok = await offer(world, name, [
          'Nam mô... Chiếc chuông đồng của miếu bị một con Haunter tinh nghịch cuỗm mất rồi.',
          'Mỗi sáng chuông miếu ngân lên thì cổng Thành phố Chùa Cổ mới mở. Không có chuông, cổng cứ đóng mãi.',
          'Chú tiểu Minh nhà ta lén đuổi theo nó vào Nghĩa Trang Rừng Trúc từ sáng, giờ chưa thấy về. Con giúp ta nhé?',
        ], 'v7');
        if (ok) await world.say(name, ['Lối xuống nghĩa trang ở góc đông nam xóm.', 'Haunter hay làm người ta ngủ mê, cẩn thận đấy.']);
        return;
      }
      await world.say(name, ['Nghĩa Trang Rừng Trúc ở cuối lối mòn góc đông nam xóm.', 'Tìm giúp ta cả chú tiểu Minh nữa nhé.']);
    },
  },
  {
    // Lần đầu gặp ở nghĩa trang cổ: trêu bạn rồi bay về miếu hoang góc tây nam
    id: 'v7-haunter-trail', mon: 'haunter', name: 'Haunter', map: 'grave7', x: 22, y: 14, facing: 'down', fixed: true,
    show: () => taken('v7') && !did('v7', 'chase') && !did('v7', 'haunter') && !villageDone('v7'),
    async onTalk(world) {
      await world.say(null, ['Haunter đang ôm chiếc chuông đồng, lè lưỡi trêu bạn...', 'Nó cười khúc khích rồi vụt bay về phía tây nam nghĩa trang!']);
      const ghost = world.findNpc('v7-haunter-trail');
      if (ghost) await world.npcFlyAway(ghost);
      mark('v7', 'chase');
      await world.say(null, ['Tiếng chuông leng keng nhỏ dần về phía miếu hoang góc tây nam...']);
    },
  },
  {
    // Bị dồn tới miếu hoang: chặn cửa miếu, hết đường chạy thì đánh
    id: 'v7-haunter', mon: 'haunter', name: 'Haunter', map: 'grave7', x: 6, y: 24, facing: 'down', fixed: true,
    show: () => taken('v7') && did('v7', 'chase') && !did('v7', 'haunter') && !villageDone('v7'),
    async onTalk(world) {
      await world.say(null, ['Haunter chặn trước cửa miếu hoang, ôm khư khư chiếc chuông đồng...', 'Hết đường chạy, nó lao vào tấn công!']);
      const result = await wildFight(world, 'haunter', 41);
      if (!result) return;
      mark('v7', 'haunter');
      const ghost = world.findNpc('v7-haunter');
      if (result === 'win') {
        await world.say(null, ['Haunter đánh rơi chiếc chuông đồng.']);
        if (ghost) await world.npcFlyAway(ghost);
        await world.say(null, ['Nó bay vút qua ngọn trúc rồi mất hút. Bạn nhặt chiếc chuông lên.']);
      } else {
        if (ghost) world.removeNpc(ghost);
        await world.say(null, ['Bạn nhặt lại chiếc chuông đồng Haunter đang ôm.']);
      }
      await bringBellHome(world);
    },
  },
  {
    id: 'v7-novice', sprite: 'npc-boy', name: 'Chú tiểu Minh', map: 'grave7', x: 5, y: 22, facing: 'down', fixed: true,
    show: () => !did('v7', 'haunter') && !villageDone('v7'),
    async onTalk(world) {
      await world.say(this.name, [
        'Anh chị ơi! Em là chú tiểu ở miếu Xóm Hương Khói.',
        'Em đuổi theo con Haunter cuỗm chuông tới tận đây thì lạc, trốn trong miếu hoang không dám ra...',
        taken('v7') ? 'Con Haunter cứ lượn lờ quanh nghĩa trang cổ phía đông bắc, thỉnh thoảng lại bay về đây.' : 'Anh chị về xóm nói với thầy giúp em được không?',
      ]);
    },
  },
  { ...gary7.npc, show: () => did('v7', 'bell') && !villageDone('v7') },
  {
    id: 'v7-pilgrim', sprite: 'npc-woman', name: 'Người hành hương', map: 'village7', x: 10, y: 9, facing: 'down', wander: 1,
    lines: ['Pokémon hệ Siêu linh không sợ đòn đánh thường đâu.', 'Chiêu hệ Bọ và Ma mới làm chúng run sợ. Gengar, Haunter... nếu bắt được thì tốt lắm.'],
  },
];

// ---------- 8. Làng Đèo Tuyết: anh Đông, người dẫn đường, mắc kẹt trên Đèo Tuyết ----------
// Bà cụ nhờ tìm con trai là anh Đông → lối tuyết góc đông bắc làng lên Đèo Tuyết (data/mapsVillageAreasB.js: pass8):
// đường đèo bốn tầng, anh Đông trú bão trong hốc đá trên đỉnh, bị Jynx chặn cửa. Đuổi Jynx (nó lướt đi mất vào bão tuyết),
// dìu anh Đông xuống làng: anh chạy tới mẹ, bà cụ cảm ơn rồi về chỗ cũ, anh ra cổng đèo chờ dẫn đường sang Sương Mù.

// Anh Đông đứng chờ dẫn đường ở cổng đèo (sau khi về làng)
const V8_GUIDE = {
  id: 'v8-guide', sprite: 'npc-camper', name: 'Anh Đông', map: 'village8', x: 22, y: 9, facing: 'down', fixed: true,
  show: () => villageDone('v8'),
  lines: ['Đường đèo sang Sương Mù tôi thuộc như lòng bàn tay. Cứ đi thẳng về phía đông!'],
};
const V8_GRANNY_SPOT = { x: 19, y: 16 };

// Dìu anh Đông về làng: tối màn hình, hiện ra ở lối lên đèo; anh chạy tới mẹ, bà cụ cảm ơn rồi về chỗ cũ, anh ra cổng đèo
async function bringDongHome(world) {
  await world.say(null, ['Bạn dìu anh Đông men theo đường đèo xuống núi...']);
  await world.warpTo({ to: 'village8', tx: 20, ty: 2, facing: 'down' });
  const dong = world.spawnNpc({ ...V8_GUIDE, x: 21, y: 2, facing: 'down' });
  const granny = world.findNpc('v8-granny');
  await world.say('Anh Đông', ['Mẹ ơi! Con về rồi đây!']);
  if (granny) {
    await world.walkNpcTo(dong, granny.pos, { adjacent: true });
    world.faceNpcTo(granny, dong);
    world.faceNpcTo(dong, granny);
    await world.say('Bà cụ', ['Đông! Con làm mẹ lo đứng lo ngồi cả ngày!', 'Bão tuyết thế này mà còn lên đèo một mình...']);
    await world.say('Anh Đông', ['Con xin lỗi mẹ. Nhờ có bạn này đuổi con Jynx đi, con mới về được đấy.']);
    await world.walkNpcTo(granny, world.pos, { adjacent: true });
    world.faceNpcToPlayer(granny);
    world.facePlayerTo(granny);
  }
  await world.say('Bà cụ', ['Bà cảm ơn cháu nhiều lắm!', 'Bà có mấy lọ thuốc chữa đông cứng, cháu mang theo mà lên gym.']);
  await world.giveItem('iceHeal', 3);
  finish('v8');
  await world.say('Anh Đông', ['Chân tôi ấm lại rồi. Tôi ra cổng đèo chờ cậu, sẵn sàng thì tôi dẫn cậu sang Sương Mù!']);
  // Anh ra cổng đèo, bà cụ về chỗ trước nhà
  await Promise.all([
    world.walkNpcTo(dong, { x: V8_GUIDE.x, y: V8_GUIDE.y }),
    granny ? world.walkNpcTo(granny, V8_GRANNY_SPOT) : null,
  ]);
  world.face(dong, 'down');
  if (granny) world.face(granny, 'down');
}

const V8 = [
  {
    id: 'v8-granny', sprite: 'npc-woman', name: 'Bà cụ', map: 'village8', x: V8_GRANNY_SPOT.x, y: V8_GRANNY_SPOT.y, facing: 'down', fixed: true,
    async onTalk(world) {
      const name = this.name;
      if (villageDone('v8')) {
        await world.say(name, ['Thằng Đông nhà bà dẫn đường giỏi nhất làng đấy. Lên thành phố nhớ mặc ấm nhé!']);
        return;
      }
      if (did('v8', 'found')) {
        // Tìm được anh Đông nhưng chưa xem cảnh về làng (bản lưu giữa chừng)
        await world.say(name, ['Đông về rồi! Bà cảm ơn cháu!', 'Bà có mấy lọ thuốc chữa đông cứng, cháu mang theo mà lên gym.']);
        await world.giveItem('iceHeal', 3);
        await world.say(name, ['Đông ra cổng đèo rồi, nó sẽ dẫn cháu qua.']);
        finish('v8');
        return;
      }
      if (!taken('v8')) {
        const ok = await offer(world, name, [
          'Cháu ơi, thằng Đông con bà là người dẫn đường qua đèo. Sáng nay nó lên Đèo Tuyết đón khách mà chưa thấy về.',
          'Bão tuyết thế này... Không có nó thì chẳng ai dám dẫn khách sang Sương Mù.',
          'Cháu tìm nó giúp bà với!',
        ], 'v8');
        if (ok) await world.say(name, ['Lối lên đèo ở góc đông bắc làng.', 'Đường đèo quanh co lắm. Gặp bão, nó hay trú trong hốc đá trên đỉnh.']);
        return;
      }
      await world.say(name, ['Lối lên Đèo Tuyết ở góc đông bắc làng đó cháu.']);
    },
  },
  {
    // Trú bão trong hốc đá trên đỉnh đèo, Jynx chặn cửa
    id: 'v8-guide-lost', sprite: 'npc-camper', name: 'Anh Đông', map: 'pass8', x: 31, y: 3, facing: 'down', fixed: true,
    show: () => !did('v8', 'found') && !villageDone('v8'),
    lines: ['Cứu với! Con Jynx này cứ chặn cửa hốc đá, chân tôi tê cóng hết rồi!'],
  },
  {
    id: 'v8-jynx', mon: 'jynx', name: 'Jynx', map: 'pass8', x: 32, y: 5, facing: 'down', fixed: true,
    show: () => !did('v8', 'found') && !villageDone('v8'),
    async onTalk(world) {
      await world.say('Anh Đông', ['Cứu với! Con Jynx này chặn cửa hốc đá cả buổi, tôi không ra được! Chân tôi tê cóng hết rồi!']);
      await world.say(null, ['Jynx quay lại, cất tiếng hát rợn người rồi lao về phía bạn!']);
      const result = await wildFight(world, 'jynx', 44);
      if (!result) return;
      const jynx = world.findNpc('v8-jynx');
      if (result === 'win') {
        if (jynx) await world.npcFlyAway(jynx);
        await world.say(null, ['Jynx lướt vút lên sườn núi rồi khuất trong bão tuyết.']);
      } else if (jynx) {
        world.removeNpc(jynx);
      }
      setFlag('quest:v8');
      mark('v8', 'found');
      // Anh Đông tập tễnh bước ra khỏi hốc đá
      const dong = world.findNpc('v8-guide-lost');
      if (dong) {
        await world.walkNpcTo(dong, world.pos, { adjacent: true });
        world.faceNpcToPlayer(dong);
        world.facePlayerTo(dong);
      }
      await world.say('Anh Đông', [
        'Cảm ơn cậu! Tôi lên đón khách thì gặp bão, chui vào hốc đá trú thì con Jynx kia chặn luôn cửa.',
        'Chân tôi cóng quá, đi không vững... Cậu dìu tôi xuống làng được không? Mẹ tôi chắc lo lắm.',
      ]);
      await bringDongHome(world);
    },
  },
  {
    id: 'v8-keeper', sprite: 'npc-hiker', name: 'Người gác đèo', map: 'village8', x: 23, y: 9, facing: 'down', fixed: true,
    async onTalk(world) {
      await world.say(this.name, villageDone('v8') ? ['Có anh Đông dẫn đường rồi thì yên tâm. Qua đèo cẩn thận nhé!'] : V8_BLOCKED);
    },
  },
  V8_GUIDE,
  {
    id: 'v8-boy', sprite: 'npc-youngster', name: 'Cậu bé', map: 'village8', x: 10, y: 8, facing: 'down', wander: 1,
    lines: ['Gym Sương Mù dùng Pokémon hệ Băng.', 'Hệ Lửa, Giác đấu, Đá và Thép đánh hệ Băng đau lắm!', 'Mang Ice Heal theo kẻo Pokémon bị đóng băng nhé.'],
  },
];
const V8_BLOCKED = ['Bão tuyết trên đèo dữ lắm. Không có người dẫn đường thì không ai được qua!', 'Người dẫn đường của làng là anh Đông, con bà cụ ở nhà phía nam.'];

export const VILLAGE_NPCS = [...V1, ...V2, ...V3, ...V4, ...V5, ...V6, ...V7, ...V8];

// Bước vào cổng làng khi chưa xong nhiệm vụ: nghe lý do đường bị chặn (Gary đang chờ thì đấu luôn)
export function villageGate(world, gate) {
  if (villageDone(gate.village)) return null;
  const say = (name, lines) => () => world.say(name, lines);
  switch (gate.village) {
    case 'v1': return say(CHIEF1, v1Blocked());
    case 'v2': return say('Dân xóm', v2Blocked());
    case 'v3': return did('v3', 'power')
      ? () => gary3.fight(world)
      : say(null, ['Cổng điện tử sang Thành phố Đèn Lồng tắt ngấm, không mở được.', taken('v3') ? 'Phải sửa trạm biến áp đã.' : 'Hỏi kỹ sư trạm điện xem sao.']);
    case 'v4': return say('Chú thợ mộc', V4_BLOCKED);
    case 'v5': return say('Người đánh xe', V5_BLOCKED);
    case 'v6': return say('Thợ đá', V6_BLOCKED);
    case 'v7': return did('v7', 'bell')
      ? () => gary7.fight(world)
      : say(null, ['Cổng đá sang Thành phố Chùa Cổ đóng im ỉm. Phải đợi chuông miếu ngân mới mở.']);
    case 'v8': return say('Người gác đèo', V8_BLOCKED);
    default: return null;
  }
}

// Mục tiêu hiện tại khi đang ở chặng làng `id` (chưa xong nhiệm vụ)
export function villageObjective(id) {
  const v = byId(id);
  switch (id) {
    case 'v1':
      if (!taken(id)) return `${v.name}: tìm hiểu vì sao đường lên dốc bị đóng`;
      return did(id, 'found') ? 'Đưa bé Tí về với mẹ ở Làng Chân Đồi' : 'Tìm bé Tí trong Rừng Thông sau Làng Chân Đồi';
    case 'v2':
      if (!taken(id)) return `${v.name}: hỏi bác thợ xay vì sao đường bị rào`;
      return pestsLeft()
        ? `Đuổi bầy Pokémon cỏ trên Đồng Cối Xay, tìm anh Cốm (${PESTS.length - pestsLeft()}/${PESTS.length})`
        : 'Gặp anh Cốm ở kho thóc cũ trên Đồng Cối Xay';
    case 'v3':
      if (!taken(id)) return `${v.name}: hỏi kỹ sư vì sao mất điện`;
      if (did(id, 'power')) return 'Đấu với Gary ở lối ra phía tây Xóm Trạm Điện';
      return itemCount('fuse') < FUSES
        ? `Tìm cầu chì trên Đồi Cột Điện phía nam Xóm Trạm Điện (${itemCount('fuse')}/${FUSES})`
        : 'Mang cầu chì về cho kỹ sư Xóm Trạm Điện (cậu Tín trên đồi biết lối tắt)';
    case 'v4':
      if (!taken(id)) return `${v.name}: hỏi ông lái đò chuyện cây cầu`;
      return did(id, 'gyarados') ? 'Cùng anh thả bè đưa gỗ về sửa cầu Làng Bến Đò' : 'Đuổi Gyarados chắn cầu ván ở Đầm Lau phía bắc Làng Bến Đò';
    case 'v5':
      if (!taken(id)) return `${v.name}: hỏi trưởng làng vì sao xe đất chắn đường`;
      return thievesLeft()
        ? `Đánh đuổi tay buôn đất lậu trong Mỏ Đất Sét (${THIEVES.length - thievesLeft()}/${THIEVES.length})`
        : 'Đưa chú Sét từ Mỏ Đất Sét về gặp trưởng làng';
    case 'v6':
      if (!taken(id)) return `${v.name}: hỏi trưởng bản về vụ đá lở`;
      return did(id, 'rescued') ? 'Thách đấu võ sư Hổ ở hố mỏ cũ trong Mỏ Đá Vách Núi' : 'Tìm võ sư Hổ ở Mỏ Đá Vách Núi phía bắc Bản Vách Đá';
    case 'v7':
      if (!taken(id)) return `${v.name}: hỏi sư thầy vì sao cổng thành phố đóng`;
      if (did(id, 'bell')) return 'Đấu với Gary ở lối ra phía đông Xóm Hương Khói';
      if (did(id, 'haunter')) return 'Mang chuông đồng về cho sư thầy';
      return did(id, 'chase')
        ? 'Đuổi theo Haunter tới miếu hoang góc tây nam Nghĩa Trang Rừng Trúc'
        : 'Tìm Haunter trong Nghĩa Trang Rừng Trúc phía đông nam Xóm Hương Khói';
    case 'v8':
      if (!taken(id)) return `${v.name}: hỏi vì sao không ai được qua đèo`;
      return did(id, 'found') ? 'Báo tin cho bà cụ ở Làng Đèo Tuyết' : 'Tìm anh Đông trên Đèo Tuyết phía bắc Làng Đèo Tuyết';
    default:
      return null;
  }
}
