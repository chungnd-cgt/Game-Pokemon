import { hasFlag, playerName, setFlag, state } from '../game/state.js';

// Gary, đối thủ của bạn: chọn Pokémon khởi đầu khắc hệ ở phòng thí nghiệm rồi gặp lại nhiều lần trên hành trình.
// Đội hình mạnh dần và tiến hoá theo khu vực (như Team Rocket, story/rocket.js), cấp ngang gym sắp tới:
//  1. Phòng thí nghiệm, Lv 5 (story/chapter1.js)
//  2. Thị trấn Lục Bình lúc lên đường tới Hang Thạch Nhũ, Lv 8: lời hẹn đấu lại lúc chia tay ở phòng thí nghiệm (story/chapter1.js)
//  3. Thành phố Đồi Gió, lối ra phía đông sau khi thắng Gym Đồi Gió (RIVAL_EVENTS)
//  4. Xóm Trạm Điện, chặn cổng sang Thành phố Đèn Lồng (story/villages.js)
//  5. Thành phố Sông Nước, lối ra phía tây sau khi thắng Gym Sông Nước (RIVAL_EVENTS)
//  6. Xóm Hương Khói, chặn cổng sang Thành phố Chùa Cổ (story/villages.js)
//  7. Thành phố Sương Mù, lối ra Đường Chiến Thắng sau khi thắng Gym Sương Mù (RIVAL_EVENTS)

// Gary luôn chọn Pokémon khắc hệ với bạn (bạn chọn Pikachu thì Gary lấy Bulbasaur hệ Cỏ, chịu được hệ Điện)
export const RIVAL_PICK = { bulbasaur: 'charmander', charmander: 'squirtle', squirtle: 'bulbasaur', pikachu: 'bulbasaur' };
const RIVAL_LINE = { bulbasaur: ['bulbasaur', 'ivysaur', 'venusaur'], charmander: ['charmander', 'charmeleon', 'charizard'], squirtle: ['squirtle', 'wartortle', 'blastoise'] };

export const rivalStarter = () => [...state.flags].find((f) => f.startsWith('rivalStarter:'))?.slice('rivalStarter:'.length) ?? null;
// Pokémon khởi đầu của Gary theo giai đoạn tiến hoá: 0 dạng đầu, 1 dạng giữa, 2 dạng cuối
export const rivalAce = (stage) => (RIVAL_LINE[rivalStarter()] ?? RIVAL_LINE.squirtle)[stage];

const ARCANINE = (level) => ['arcanine', level, ['flamethrower', 'extremeSpeed', 'bite', 'takeDown']];

// Đội hình từng lần gặp (gọi lúc vào trận để lấy đúng Pokémon khởi đầu của Gary)
export const RIVAL_TEAMS = {
  lab: () => [[rivalAce(0), 5]],
  town1: () => [['pidgey', 8], [rivalAce(0), 8]],
  town2: () => [['pidgeotto', 17], ['rattata', 15], ['abra', 15], [rivalAce(1), 18]],
  v3: () => [['pidgeotto', 25], ['raticate', 24], ['kadabra', 25], [rivalAce(1), 27]],
  town5: () => [['pidgeotto', 34], ['raticate', 33], ['kadabra', 34], ['growlithe', 33], [rivalAce(2), 36]],
  v7: () => [['pidgeot', 42], ['alakazam', 42], ['rhydon', 41], ARCANINE(42), [rivalAce(2), 45]],
  town9: () => [['pidgeot', 50], ['alakazam', 51], ['rhydon', 50], ARCANINE(51), ['gyarados', 50], [rivalAce(2), 53]],
};
// Thứ tự các lần gặp trên hành trình
export const RIVAL_ORDER = ['lab', 'town1', 'town2', 'v3', 'town5', 'v7', 'town9'];

export const rivalTrainer = (id, { prize = 35, lose, noBlackout = false } = {}) => ({
  id: `rival-${id}`, sprite: 'npc-gary', name: 'Gary', team: RIVAL_TEAMS[id](), prize, lose, noBlackout, noRematch: true,
});

// ---------- Gary đợi ở lối ra thành phố sau khi bạn thắng gym ----------
//  x, y, facing: chỗ Gary đứng • zone: [x1, y1, x2, y2] bước vào là Gary chạy tới thách đấu; thắng thì Gary ra lối ra gần đó (sang bản đồ kế tiếp)
//  show: giai đoạn xuất hiện (từ khi có huy hiệu thành phố này tới khi có huy hiệu tiếp theo)
//  Thua thì Gary vẫn đứng đợi ở đó, quay lại đấu tiếp; thắng thì Gary đi trước.
const badge = (id) => state.badges.has(id);
export const RIVAL_EVENTS = [
  {
    id: 'town2', map: 'town2', x: 28, y: 12, facing: 'up', zone: [26, 10, 29, 11], prize: 40,
    show: () => badge('wind') && !badge('grass'),
    intro: () => [
      `${playerName()}! Cậu cũng thắng Gym Đồi Gió rồi à?`,
      'Tớ thắng từ hôm qua cơ! Pidgey của tớ tiến hoá rồi, còn bắt thêm cả Abra nữa.',
      'Để xem lần này cậu theo kịp tớ không!',
    ],
    again: ['Lại đây! Lần này tớ không để cậu chạy đâu!'],
    lose: 'Cái gì?! Lại thua nữa sao?',
    win: ['Hừ... Huy hiệu thứ hai tớ sẽ lấy trước cậu!', 'Gym Lúa Vàng toàn Pokémon hệ Cỏ đấy. Đừng có thua dọc đường nhé!'],
  },
  {
    id: 'town5', map: 'town5', x: 2, y: 17, facing: 'down', zone: [2, 19, 5, 19], prize: 45,
    show: () => badge('water') && !badge('fire'),
    intro: () => [
      `Ồ, ${playerName()}. Tớ đợi cậu ở đây mãi.`,
      `${rivalAce(2) === 'charizard' ? 'Charizard' : rivalAce(2) === 'blastoise' ? 'Blastoise' : 'Venusaur'} của tớ vừa tiến hoá xong. Cậu tới đúng lúc để làm bao cát đấy!`,
    ],
    again: ['Pokémon của cậu hồi phục chưa? Đấu tiếp nào!'],
    lose: 'Không thể nào... Pokémon tiến hoá rồi mà vẫn thua sao?',
    win: ['Được rồi, cậu mạnh thật.', 'Phía tây là Thành phố Lò Gốm. Ông nội bảo gym ở đó nóng như lò nung, mang theo thuốc trị bỏng đi.'],
  },
  {
    id: 'town9', map: 'town9', x: 29, y: 12, facing: 'up', zone: [26, 10, 29, 11], prize: 50,
    show: () => badge('ice') && !hasFlag('champion'),
    intro: () => [
      `${playerName()}... Vậy là cậu cũng có đủ 8 huy hiệu rồi.`,
      'Đường Chiến Thắng phía trước dẫn lên Cao nguyên Liên Minh. Chỉ một người trong hai đứa mình được lên đó trước thôi!',
      'Trận này tớ dốc hết sức. Lên đi!',
    ],
    again: ['Chưa xong đâu. Tớ vẫn đứng đây chờ cậu!'],
    lose: 'Tớ thua... thật rồi.',
    win: [
      'Hừ... Hôm nay cậu mạnh hơn tớ.',
      'Nhưng đừng có thua Tứ Thiên Vương đấy! Người duy nhất được đánh bại cậu là tớ!',
    ],
  },
];

const npcId = (ev) => `gary-${ev.id}`;
const doneFlag = (ev) => `rival:${ev.id}`;
const active = (ev) => ev.show() && !hasFlag(doneFlag(ev));
const inZone = (ev, { x, y }) => x >= ev.zone[0] && x <= ev.zone[2] && y >= ev.zone[1] && y <= ev.zone[3];

export const RIVAL_NPCS = RIVAL_EVENTS.map((ev) => ({
  id: npcId(ev), sprite: 'npc-gary', name: 'Gary', map: ev.map, x: ev.x, y: ev.y, facing: ev.facing, fixed: true,
  show: () => active(ev),
  onTalk: (world) => rivalCityBattle(world, ev),
}));

// Bước vào lối ra thành phố khi Gary đang đợi: Gary chạy tới thách đấu
export function rivalTrigger(world) {
  const ev = RIVAL_EVENTS.find((e) => e.map === world.map.id && active(e) && inZone(e, world.pos));
  return ev ? () => rivalCityBattle(world, ev) : null;
}

async function rivalCityBattle(world, ev) {
  const gary = world.findNpc(npcId(ev));
  if (gary) {
    await world.walkNpcTo(gary, world.pos, { adjacent: true });
    world.faceNpcToPlayer(gary);
    world.facePlayerTo(gary);
  }
  const met = `${doneFlag(ev)}:met`;
  await world.say('Gary', hasFlag(met) ? ev.again : ev.intro());
  setFlag(met);
  const result = await world.startBattle({ trainer: rivalTrainer(ev.id, { prize: ev.prize, lose: ev.lose }) });
  if (result !== 'win') return;
  await world.say('Gary', ev.win);
  setFlag(doneFlag(ev));
  // Gary đi trước: ra đúng lối ra thành phố mà bạn sắp đi (lối gần chỗ Gary đứng chờ nhất)
  const still = world.findNpc(npcId(ev));
  if (still) await world.npcLeave(still, { toMap: exitOf(world, ev) });
}

// Bản đồ phía bên kia lối ra gần vùng Gary chờ nhất
function exitOf(world, ev) {
  const cx = (ev.zone[0] + ev.zone[2]) / 2;
  const cy = (ev.zone[1] + ev.zone[3]) / 2;
  const dist = (w) => Math.abs(w.x - cx) + Math.abs(w.y - cy);
  return [...world.map.warps].sort((a, b) => dist(a) - dist(b))[0]?.to ?? null;
}
