import { SPECIES } from '../data/monsters.js';
import { placeOf } from '../data/region.js';
import { hasFlag, setFlag, state } from '../game/state.js';

// Team Rocket: Hùng, Mai và Meowth (biểu tượng của cả bọn, không bao giờ tiến hoá) gây chuyện ở nhiều nơi trong hành trình.
// Cả bọn đứng hàng ngang chặn đường; bước tới trước mặt hoặc nói chuyện là bị gây sự. Hùng và Mai mỗi người một trận:
// thắng người này thì người kia ra đấu tiếp; thua thì về chỗ hồi phục, người đã thua vẫn đứng đó, quay lại đấu tiếp người còn lại.
// Thắng cả hai thì cả bọn chuồn (khinh khí cầu Meowth, trong hang thì bom khói) và đánh rơi đồ.
// Đội hình mạnh dần và tiến hoá theo khu vực, cấp ngang nhà huấn luyện ở khu đó.
//  x, y: chỗ Hùng đứng (Pokémon đi cùng bên phải, Mai bên phải nữa), cả bọn quay mặt xuống
//  show: điều kiện xuất hiện • done: cờ khi đã đuổi được • intro: [người nói, câu] • escape: 'balloon' | 'smoke'
const EVENTS = [
  {
    // Thị trấn Lục Bình: chặn cửa Poké Mart (id 'pallet' giữ như cũ để bản lưu cũ vẫn dùng được)
    id: 'pallet', map: 'town1', x: 18, y: 16, pet: 'meowth', escape: 'balloon',
    show: () => hasFlag('questDone'), done: 'gruntsDefeated',
    hung: [['koffing', 7]], mai: [['ekans', 7]],
    intro: [
      ['hung', 'Hửm? Nhóc con kia nhìn gì hả?'],
      ['motto'],
      ['mai', 'Gói hàng của Poké Mart giờ là của bọn ta. Muốn lấy lại thì đấu đi!'],
    ],
    // Gói hàng hiện ở trước cửa (đồ vật r1-parcel, xem data/mapsChapter2.js)
    async after(world) {
      world.refreshObjects();
      await world.say(null, ['Team Rocket bay mất, bỏ lại gói hàng của Poké Mart trước cửa.']);
    },
  },
  {
    id: 'cave1', map: 'cave1', x: 34, y: 2, pet: 'meowth', escape: 'smoke', objective: 'Đuổi Team Rocket ra khỏi Hang Thạch Nhũ',
    show: () => hasFlag('chapter1Done') && !state.badges.has('wind'),
    hung: [['koffing', 12], ['bellsprout', 13]], mai: [['ekans', 12], ['zubat', 13]],
    intro: [
      ['hung', 'Lại là nhóc con ở Lục Bình à?!'],
      ['mai', 'Bọn ta đang đào đá quý trong hang này. Đừng có phá đám!'],
      ['pet', 'Đá quý bán được bộn tiền đó, meo!'],
      ['motto'],
      ['mai', 'Lần trước chỉ là bọn ta sơ ý thôi. Lần này đừng hòng!'],
    ],
    reward: ['thunderStone', 1],
  },
  {
    id: 'town4', map: 'town4', x: 25, y: 9, pet: 'meowth', escape: 'balloon', objective: 'Đánh đuổi Team Rocket trước Gym Đèn Lồng',
    show: () => state.badges.has('grass') && !state.badges.has('electric'),
    hung: [['koffing', 24], ['weepinbell', 25]], mai: [['arbok', 25], ['golbat', 24]],
    intro: [
      ['hung', 'Đứng lại! Gym Đèn Lồng đang được Team Rocket... ờ... kiểm tra đường điện!'],
      ['mai', 'Điện của cả thành phố này sẽ là của bọn ta!'],
      ['pet', 'Có điện rồi thì khinh khí cầu bay xa hơn, meo!'],
      ['motto'],
      ['mai', 'Pokémon của bọn ta đã tiến hoá rồi. Đừng mơ thắng dễ như lần trước!'],
    ],
    reward: ['ultraBall', 3],
  },
  {
    id: 'town6', map: 'town6', x: 10, y: 8, pet: 'meowth', escape: 'balloon', objective: 'Đánh đuổi Team Rocket trước Poké Mart Lò Gốm',
    show: () => state.badges.has('water') && !state.badges.has('fire'),
    hung: [['weezing', 35], ['victreebel', 36]], mai: [['arbok', 35], ['golbat', 36]],
    intro: [
      ['mai', 'Gốm quý của Lò Gốm bán được giá lắm đây!'],
      ['hung', 'Cửa hàng này tạm thời thuộc về Team Rocket!'],
      ['pet', 'Đồ gốm ở đây sáng bóng như đồng xu trên trán ta vậy, meo!'],
      ['motto'],
      ['hung', 'Lần này cả bọn ta đều đã luyện tập khổ cực. Lên đi!'],
    ],
    reward: ['fireStone', 1],
  },
  {
    id: 'town9', map: 'town9', x: 23, y: 7, pet: 'meowth', escape: 'balloon', objective: 'Đánh đuổi Team Rocket trước Gym Sương Mù',
    show: () => state.badges.has('psychic') && !state.badges.has('ice'),
    hung: [['weezing', 46], ['victreebel', 47], ['arcanine', 46, ['flamethrower', 'extremeSpeed', 'bite', 'takeDown']]], mai: [['arbok', 47], ['golbat', 46], ['lickitung', 47]],
    intro: [
      ['hung', 'Gym Sương Mù có toàn Pokémon băng quý hiếm...'],
      ['mai', 'Bắt hết về bán, đủ tiền mua khinh khí cầu mới!'],
      ['pet', 'Lần này bọn ta mạnh hơn hẳn rồi, meo!'],
      ['motto'],
      ['hung', 'Đây là trận quyết định đấy nhóc! Team Rocket không thua mãi được đâu!'],
    ],
    reward: ['maxRevive', 1],
  },
];

const ROLES = ['hung', 'pet', 'mai'];
const NAMES = { hung: 'Rocket Hùng', mai: 'Rocket Mai' };
const SPRITES = { hung: 'npc-rocket', mai: 'npc-rocket-f' };
// lose: câu khi thua • next: người kia đã thua, tới lượt người này ra đấu
const LINES = {
  hung: { lose: 'Hừ! Nhóc này mạnh thật...', next: 'Mai thua rồi à? Tránh ra, để anh xử nó!' },
  mai: { lose: 'Không thể nào! Thua một đứa nhóc sao?!', next: 'Anh Hùng thua rồi à? Đúng là vô dụng! Để chị xử nó!' },
};
const MOTTO = [
  ['mai', 'Nghe cho rõ đây! Gió đen thổi qua, hàng hoá bay mất!'],
  ['hung', 'Bóng tối phủ xuống, chẳng ai ngăn được!'],
  ['mai', 'Mai!'],
  ['hung', 'Hùng!'],
  ['pet', 'Và PET nữa! Team Rocket đây, meo!'],
];

const npcId = (ev, role) => `rocket-${ev.id}-${role}`;
const beatenFlag = (ev, role) => `rocket:${ev.id}:${role}`;
const petName = (ev) => SPECIES[ev.pet].name;
const nameOf = (ev, role) => NAMES[role] ?? petName(ev);
const active = (ev) => ev.show() && !hasFlag(ev.done ?? `rocket:${ev.id}`);

export const ROCKET_NPCS = EVENTS.flatMap((ev) => ROLES.map((role, i) => ({
  id: npcId(ev, role), sprite: SPRITES[role], mon: role === 'pet' ? ev.pet : undefined, name: nameOf(ev, role),
  map: ev.map, x: ev.x + i, y: ev.y, facing: 'down', fixed: true,
  show: () => active(ev),
  onTalk: (world) => rocketAmbush(world, ev, role),
})));

// Nhiệm vụ hiện tại khi Team Rocket đang chặn đường ở khu đã tới
export function rocketObjective() {
  const ev = EVENTS.find((e) => e.objective && active(e) && state.visited.has(placeOf(e.map)));
  return ev?.objective ?? null;
}

// Bước tới ô ngay trước mặt cả bọn: bị gây sự
export function rocketTrigger(world) {
  const { x, y } = world.pos;
  const ev = EVENTS.find((e) => e.map === world.map.id && y === e.y + 1 && x >= e.x && x < e.x + ROLES.length && active(e));
  return ev ? () => rocketAmbush(world, ev, ROLES[x - ev.x]) : null;
}

const trainer = (ev, role) => ({
  id: npcId(ev, role), sprite: SPRITES[role], name: NAMES[role], team: ev[role], prize: 60,
  lose: LINES[role].lose, noRematch: true,
});

// start: người được bắt chuyện / đứng trước mặt ra đấu trước (bắt chuyện với Meowth thì Hùng ra trước)
async function rocketAmbush(world, ev, start) {
  const say = (role, line) => world.say(nameOf(ev, role), [line.replace('PET', petName(ev))]);
  const fighters = ['hung', 'mai'].filter((r) => !hasFlag(beatenFlag(ev, r)));
  fighters.sort((a, b) => (b === start) - (a === start));
  if (world.pos.y === ev.y + 1 && !world.isBlocked(world.pos.x, ev.y + 2)) await world.walkPlayer([{ x: world.pos.x, y: ev.y + 2 }]);
  const nearest = Math.min(Math.max(world.pos.x, ev.x), ev.x + ROLES.length - 1);
  world.facePlayerTo({ pos: { x: nearest, y: ev.y } });
  if (fighters.length === 2) {
    for (const [role, line] of ev.intro) {
      if (role === 'motto') for (const [r, l] of MOTTO) await say(r, l);
      else await say(role, line);
    }
  }
  for (const [i, role] of fighters.entries()) {
    if (['hung', 'mai'].some((r) => hasFlag(beatenFlag(ev, r)))) await say(role, LINES[role].next);
    if (i > 0 && !(await world.ask(`Đấu tiếp với ${nameOf(ev, role)} ngay bây giờ?`))) {
      await say(role, 'Đi hồi phục cho kỹ đi! Ta chờ ở đây!');
      return;
    }
    const result = await world.startBattle({ trainer: trainer(ev, role) });
    if (result !== 'win') return;
    setFlag(beatenFlag(ev, role));
    await say(role, LINES[role].lose);
  }
  const npcs = ROLES.map((r) => world.findNpc(npcId(ev, r))).filter(Boolean);
  if (ev.escape === 'smoke') {
    await say('mai', 'Hết cách rồi! Bom khói!');
    await world.smokeEscape(npcs);
  } else {
    await say('mai', 'Ối, thua nữa rồi! Chuồn thôi!');
    await say('pet', 'Lên khinh khí cầu mau, meo!');
    await world.balloonEscape(npcs);
  }
  await world.say('Team Rocket', ['Team Rocket lại thất bại rồiiii...!']);
  setFlag(ev.done ?? `rocket:${ev.id}`);
  if (ev.reward) {
    await world.say(null, ['Team Rocket đánh rơi thứ gì đó.']);
    await world.giveItem(ev.reward[0], ev.reward[1], 'nhặt được');
  }
  await ev.after?.(world);
}
