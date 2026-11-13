import { SPECIES } from '../data/monsters.js';
import { DEX_BY_SLUG } from '../data/pokedex.js';
import { hasFlag, playerName, setFlag, state } from '../game/state.js';

// Liên minh vùng Sơn Thủy: Tứ Thiên Vương (Lan hệ Độc, Võ hệ Giác đấu, Huyền hệ Ma, Long hệ Rồng) và Nhà vô địch Khôi.
// Đánh lần lượt từng phòng, thắng thì cửa phong ấn mở sang phòng sau (cờ league:e1..e4).
// Mỗi lần bước vào phòng đầu tiên là bắt đầu lại từ đầu (resetLeague).

export const F_CHAMPION = 'champion';
export const F_STARTER_GIFT = 'postgameStarters'; // đã nhận các Pokémon khởi đầu còn lại từ Giáo sư Oak (story/postgame.js)

// Pokédex vùng Sơn Thủy: các loài có trong game (Pokédex hiện đủ 151 nhưng chỉ chừng này loài bắt được)
export function regionalDex() {
  const ids = Object.keys(SPECIES).map((id) => DEX_BY_SLUG[id].id);
  return { caught: ids.filter((id) => state.dex.caught.has(id)).length, total: ids.length };
}

const ELITES = [
  {
    n: 1, id: 'elite-lan', name: 'Thiên Vương Lan', sprite: 'npc-elite-poison', map: 'elite1',
    team: [
      ['arbok', 52, ['sludgeBomb', 'crunch', 'glare', 'screech']],
      ['weezing', 53, ['sludgeBomb', 'smog', 'explosion', 'smokescreen']],
      ['tentacruel', 53, ['sludgeBomb', 'surf', 'barrier', 'wrap']],
      ['vileplume', 54, ['sludgeBomb', 'petalBlizzard', 'stunSpore', 'gigaDrain']],
      ['muk', 55, ['sludgeBomb', 'poisonJab', 'bodySlam', 'screech']],
    ],
    intro: 'Chào mừng tới Liên minh Sơn Thủy. Ta là Lan, Thiên Vương đầu tiên. Hoa đẹp nhất thường mang độc mạnh nhất... cậu có dám hái không?',
    lose: 'Chất độc của ta không ngấm được vào cậu... Đi tiếp đi.',
    after: 'Cửa phía sau đã mở. Thiên Vương Võ đang chờ cậu.',
  },
  {
    n: 2, id: 'elite-vo', name: 'Thiên Vương Võ', sprite: 'npc-elite-fighting', map: 'elite2',
    team: [['primeape', 54], ['hitmonlee', 55], ['hitmonchan', 55], ['poliwrath', 56], ['machamp', 57]],
    intro: 'Ta là Võ, theo nghiệp võ từ thuở lên năm. Quyền cước của ta và Pokémon là một. Vào thế đi!',
    lose: 'Hay lắm! Đã lâu lắm rồi ta mới thua tâm phục khẩu phục như vậy.',
    after: 'Phòng tiếp theo tối lắm. Giữ vững tinh thần nhé.',
  },
  {
    n: 3, id: 'elite-huyen', name: 'Thiên Vương Huyền', sprite: 'npc-elite-ghost', map: 'elite3',
    team: [['golbat', 55], ['gengar', 56], ['hypno', 56], ['weezing', 57], ['gengar', 59]],
    intro: 'Hi hi... Em lạc vào đây rồi à? Ta là Huyền. Trong bóng tối này, Pokémon Ma của ta thấy em rõ lắm...',
    lose: 'Ồ... em mang ánh sáng vào tận đây. Thú vị thật.',
    after: 'Còn một Thiên Vương nữa thôi. Long không dễ dãi như ta đâu.',
  },
  {
    n: 4, id: 'elite-long', name: 'Thiên Vương Long', sprite: 'npc-elite-dragon', map: 'elite4',
    team: [['dragonair', 56], ['gyarados', 57], ['aerodactyl', 57], ['dragonair', 57], ['dragonite', 60]],
    intro: 'Ta là Long, Thiên Vương cuối cùng. Rồng là loài Pokémon kiêu hãnh nhất. Muốn qua cửa này, hãy khiến chúng cúi đầu!',
    lose: 'Rồng của ta đã cúi đầu trước cậu... Cậu xứng đáng gặp Nhà vô địch.',
    after: 'Nhà vô địch đang ở phòng cuối cùng. Đi đi, đừng để ngài ấy phải đợi.',
  },
];

const CHAMPION = {
  id: 'champion-khoi', name: 'Nhà vô địch Khôi', sprite: 'npc-champion', map: 'champion',
  team: [
    ['pidgeot', 58, ['wingAttack', 'airSlash', 'quickAttack', 'featherDance']],
    ['alakazam', 59],
    ['golem', 59],
    ['arcanine', 60, ['flamethrower', 'extremeSpeed', 'crunch', 'takeDown']],
    ['gyarados', 60],
    ['snorlax', 61],
  ],
};

const LEAGUE_IDS = [...ELITES.map((e) => e.id), CHAMPION.id];

// Bắt đầu thử thách: Tứ Thiên Vương và Nhà vô địch về lại như chưa đấu
export function resetLeague() {
  for (const f of [...state.flags]) if (f.startsWith('league:')) state.flags.delete(f);
  for (const id of LEAGUE_IDS) {
    state.defeatedTrainers.delete(id);
    delete state.trainerRest[id]; // bản lưu cũ có thể đã gắn lịch nghỉ cho Tứ Thiên Vương: bỏ đi, không thì họ không chịu đấu
  }
}

const eliteNpc = ({ n, id, name, sprite, map, team, intro, lose, after }) => ({
  id, sprite, name, map, x: 6, y: 3, facing: 'down', fixed: true, sight: 0,
  team, prize: 120, noRematch: true, elite: true, intro, lose, after,
  async onDefeat(world) {
    setFlag(`league:e${n}`);
    world.refreshObjects();
    world.cameras.main.flash(300, 200, 160, 255);
    await world.say(null, ['Ầm... Cửa phong ấn phía sau đã mở ra!']);
  },
});

export const LEAGUE_NPCS = [
  ...ELITES.map(eliteNpc),
  {
    ...CHAMPION, x: 6, y: 3, facing: 'down', fixed: true, sight: 0, prize: 200, noRematch: true, elite: true,
    intro: 'Cuối cùng cũng có người tới được đây. Tôi là Khôi, Nhà vô địch vùng Sơn Thủy. Tôi đã đi khắp vùng này, từ ruộng lúa tới đỉnh tuyết. Cho tôi xem hành trình của cậu đã tạo nên điều gì!',
    lose: 'Thì ra là vậy... Cậu mạnh thật. Từ hôm nay, cậu là Nhà vô địch mới!',
    after: 'Hãy luôn giữ trái tim của một nhà huấn luyện, Nhà vô địch ạ.',
    async onDefeat(world) {
      await world.say(CHAMPION.name, [
        `${playerName()}, tám huy hiệu, Tứ Thiên Vương, và giờ là tôi. Cậu đã đi hết con đường của vùng Sơn Thủy.`,
        'Đi theo tôi. Đội Pokémon của cậu xứng đáng được ghi tên vào Điện vinh danh.',
      ]);
      const first = !hasFlag(F_CHAMPION);
      setFlag(F_CHAMPION);
      await world.hallOfFame(first);
      await world.leaveLeague();
    },
  },
  {
    id: 'league-guard', sprite: 'npc-guide', name: 'Người gác cửa', map: 'leagueLobby', x: 8, y: 2, facing: 'down', fixed: true,
    lines: [
      'Sau cánh cửa này là Tứ Thiên Vương và Nhà vô địch.',
      'Một khi đã bước vào thì không quay lại được, phải thắng liền cả năm trận. Thua là phải bắt đầu lại từ đầu!',
      'Hãy hồi phục Pokémon và chuẩn bị thật kỹ.',
    ],
  },
];

// Mục tiêu sau khi đủ 8 huy hiệu
export function leagueObjective() {
  // Vô địch rồi: mục tiêu hậu truyện (mẹ, Giáo sư Oak, Pokémon huyền thoại, Pokédex) ở story/postgame.js
  if (hasFlag(F_CHAMPION)) return null;
  if (!state.visited.has('league')) return 'Vượt Đường Chiến Thắng, lên Cao nguyên Liên Minh';
  const beaten = ELITES.filter((e) => hasFlag(`league:e${e.n}`)).length;
  return beaten < ELITES.length ? `Thách đấu Tứ Thiên Vương (${beaten}/4)` : 'Thách đấu Nhà vô địch';
}
