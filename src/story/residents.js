import { ENCOUNTERS } from '../data/encounters.js';
import { ITEMS } from '../data/items.js';
import { MAPS } from '../data/map.js';
import { SPECIES } from '../data/monsters.js';
import { tradeEvolutionTarget } from '../game/evolution.js';
import { createMonster } from '../game/monster.js';
import { hasFlag, markCaught, markSeen, setFlag, state } from '../game/state.js';

// Người ở trong nhà dân (data/npcHouses.js): nói chuyện, tặng quà (một lần), thách đấu, muốn đổi Pokémon (một lần).
// Đổi Pokémon ở đây là đổi với người trong game (khác giao dịch giữa người chơi), kiểu đổi Pokémon trong game gốc:
// họ muốn một loài phổ biến bắt được ngay quanh khu đó, đưa lại một loài hiếm khu đó không có (Farfetch'd, Mr. Mime,
// Scyther...) cùng cấp, có biệt danh và cầm sẵn một món đồ có ích. Chọn đúng loài họ muốn trong đội là nhận ngay
// Pokémon của họ vào đúng chỗ đó trong đội.

const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

const CHAT = [
  'Nhà tôi nhỏ thôi, cháu cứ tự nhiên nhé!',
  'Hồi trẻ tôi cũng mơ làm nhà vô địch Pokémon đấy.',
  'Pokémon mệt thì nhớ ghé Pokémon Center, y tá Joy chữa miễn phí mà.',
  'Nghe nói Pokémon cầm Everstone thì không tiến hoá được đâu.',
  'Bắt Pokémon thì nhớ đánh cho yếu bớt rồi hãy ném bóng nhé.',
  'Ban đêm có những Pokémon chỉ xuất hiện lúc tối thôi đấy.',
  'Quả mọng hái rồi, vài hôm sau cây lại ra quả.',
  'Cháu có muốn uống chén trà không? À mà thôi, nhìn cháu là biết đang vội rồi.',
  'Kéo vật phẩm thả vào Pokémon trong đội là cho nó cầm luôn đấy, tiện lắm!',
  'Hệ Nước khắc hệ Lửa, hệ Lửa khắc hệ Cỏ, hệ Cỏ khắc hệ Nước. Nhớ lấy nhé!',
  'Có những Pokémon chỉ tiến hoá khi được trao đổi với người khác đó.',
  'Đi đường dài thì mang theo Repel cho đỡ bị Pokémon hoang dã quấy rầy.',
  'Con tôi cũng đang đi khắp vùng Sơn Thủy thu phục Pokémon.',
  'Cháu đã thử câu cá chưa? Cần câu xịn thì câu được Pokémon hiếm lắm.',
  'Hôm nay trời đẹp ghê, hợp đi dạo với Pokémon.',
  'Pokémon đi theo sau lưng cháu dễ thương quá!',
];
const GIFTS = [
  ['potion', 3], ['superPotion', 2], ['pokeBall', 5], ['greatBall', 3], ['oranBerry', 3], ['pechaBerry', 2], ['cheriBerry', 2],
  ['repel', 3], ['antidote', 3], ['fullHeal', 1], ['revive', 1], ['ether', 1],
  // Đĩa kỹ năng: vài nhà mới tặng
  ['tmThunderWave', 1], ['tmEnergyBall', 1],
];
// Đổi Pokémon: loài hiếm họ đưa (chỉ chọn loài khu đó không có), biệt danh, đồ cầm sẵn
const RARE = [
  'farfetchd', 'mrMime', 'jynx', 'lickitung', 'tangela', 'seel', 'kangaskhan', 'scyther', 'pinsir', 'chansey', 'eevee',
  'electabuzz', 'magmar', 'porygon', 'onix', 'hitmonlee', 'hitmonchan', 'tauros', 'ditto',
];
const NICKNAMES = ['Mũm Mĩm', 'Lá Hành', 'Bông', 'Sấm', 'Tí Hon', 'Ú Nu', 'Mây', 'Cốm', 'Bột', 'Kem', 'Bánh Bao', 'Sữa'];
const TRADE_ITEMS = ['sitrusBerry', 'lumBerry', 'luckyEgg', 'leftovers', 'oranBerry', 'pechaBerry'];
// Loài dự phòng khi khu đó không có Pokémon hoang dã nào
const COMMON = ['rattata', 'pidgey', 'caterpie', 'weedle', 'spearow', 'oddish'];
const NO_WANT = new Set(['articuno', 'zapdos', 'moltres', 'mewtwo', 'mew', 'kadabra', 'machoke', 'graveler', 'haunter']);
const TEAMS = [
  ['rattata', 'pidgey'], ['spearow', 'ekans'], ['nidoranM', 'nidoranF'], ['oddish', 'bellsprout'], ['geodude', 'machop'],
  ['psyduck', 'poliwag'], ['meowth', 'growlithe'], ['venonat', 'paras'], ['zubat', 'koffing'],
];

const flag = (def, what) => `resident:${def.id}:${what}`;
const validGifts = () => GIFTS.filter(([id]) => ITEMS[id]);
const validTeams = () => TEAMS.map((t) => t.filter((id) => SPECIES[id])).filter((t) => t.length);

// Món quà / cuộc đổi / đội hình của người ở này (cố định theo nhà)
export const residentGift = (def) => pick(validGifts(), def.resident.seed);
// Pokémon hoang dã quanh nhà: bản đồ ngoài cửa và các bản đồ ngoài trời nối với nó (bụi cỏ, hang, lướt nước).
// common: loài hay gặp (tỉ lệ từ 15 trở lên), all: mọi loài
function localSpecies(def) {
  const outer = MAPS[def.map]?.exit?.to;
  const maps = new Set([outer]);
  for (const w of MAPS[outer]?.warps ?? []) if (MAPS[w.to] && !MAPS[w.to].indoor) maps.add(w.to);
  const common = new Set();
  const all = new Set();
  for (const id of maps) {
    const m = MAPS[id];
    if (!m) continue;
    for (const table of [...(m.areas ?? []).map((a) => a.table), m.water?.surf]) {
      for (const e of ENCOUNTERS[table] ?? []) {
        all.add(e.species);
        if (e.weight >= 15 && SPECIES[e.species] && !NO_WANT.has(e.species)) common.add(e.species);
      }
    }
  }
  return { common: [...common].sort(), all };
}

// Cuộc đổi của người ở này (cố định theo nhà): { want, give, nickname, item, troll }
export function residentTrade(def) {
  if (def.resident.trade) return def.resident.trade; // nhà đặc biệt (data/npcHouses.js: SPECIAL_HOUSES)
  const { seed, seed2 } = def.resident;
  const { common, all } = localSpecies(def);
  const want = pick(common.length ? common : COMMON.filter((s) => SPECIES[s]), seed);
  const rare = RARE.filter((s) => SPECIES[s] && !all.has(s) && s !== want);
  const give = pick(rare.length ? rare : RARE.filter((s) => SPECIES[s] && s !== want), seed2);
  const items = TRADE_ITEMS.filter((id) => ITEMS[id] && ITEMS[id].kind !== 'key');
  return { want, give, nickname: pick(NICKNAMES, (seed + seed2) % 1), item: items.length ? pick(items, seed2 * 7 % 1) : null };
}
// Cấp đội của người ở thách đấu: theo KHU (không theo đội người chơi, trước kia đội có con Lv50 thì người ở thị trấn đầu
// game cũng Lv47). Mỗi bản đồ ngoài trời quanh nhà (bản đồ ngoài cửa và các bản đồ nối với nó) lấy cấp cao nhất của
// Pokémon hoang dã trên cạn (bụi cỏ, hang); lấy bản đồ DỄ nhất trong số đó (đường đã đi tới khu này, không phải hang / tuyến
// phía trước), cộng 1. Không tính lướt nước / câu cá (hồ ở thị trấn đầu game có Pokémon cấp giữa hành trình)
export function residentLevel(def) {
  const outer = MAPS[def.map]?.exit?.to;
  const maps = new Set([outer]);
  for (const w of MAPS[outer]?.warps ?? []) if (MAPS[w.to] && !MAPS[w.to].indoor) maps.add(w.to);
  const tops = [];
  for (const id of maps) {
    const levels = (MAPS[id]?.areas ?? []).flatMap((a) => (ENCOUNTERS[a.table] ?? []).map((e) => e.max));
    if (levels.length) tops.push(Math.max(...levels));
  }
  const level = tops.length ? Math.min(...tops) : 5;
  return Math.max(5, Math.min(70, level + 1));
}

export function residentTeam(def) {
  const level = residentLevel(def);
  return pick(validTeams(), def.resident.seed).map((id, i) => [id, level + i]);
}

// Hai câu nói chuyện (cố định theo nhà)
function chatLines(def) {
  const a = Math.floor(def.resident.seed2 * CHAT.length);
  return [CHAT[a], CHAT[(a + 5) % CHAT.length]];
}

// Nói chuyện với người ở (đã ở trong runEvent của WorldScene)
export async function residentTalk(world, def) {
  const { kind } = def.resident;
  if (kind === 'gift') return giftTalk(world, def);
  if (kind === 'battle') return battleTalk(world, def);
  if (kind === 'trade') return tradeTalk(world, def);
  await world.say(def.name, chatLines(def));
}

async function giftTalk(world, def) {
  if (hasFlag(flag(def, 'gift'))) {
    await world.say(def.name, ['Món quà hôm trước dùng được chứ cháu?', chatLines(def)[0]]);
    return;
  }
  const [id, qty] = residentGift(def);
  await world.say(def.name, ['Ồ, có khách! Cháu đi đường xa vất vả rồi.', 'Bác có cái này, cầm lấy mà dùng nhé!']);
  await world.giveItem(id, qty);
  setFlag(flag(def, 'gift'));
}

async function battleTalk(world, def) {
  if (state.defeatedTrainers.has(def.id)) {
    await world.say(def.name, ['Cậu mạnh thật đấy! Tớ phải luyện thêm mới dám đấu lại.']);
    return;
  }
  if (!state.party.some((m) => m.hp > 0)) {
    await world.say(def.name, ['Pokémon của cậu mệt hết rồi kìa. Ghé Pokémon Center đã rồi đấu với tớ nhé!']);
    return;
  }
  await world.say(def.name, ['Cậu cũng là huấn luyện viên à? Ở nhà mãi chán quá...']);
  if (!(await world.ask('Đấu một trận Pokémon không?', def.name))) {
    await world.say(def.name, ['Tiếc ghê. Lúc nào rảnh thì quay lại nhé!']);
    return;
  }
  const trainer = {
    id: def.id, sprite: def.sprite, name: def.name, team: residentTeam(def), prize: 20,
    intro: 'Lên nào!', lose: 'Thua rồi... Cậu giỏi thật!', after: 'Cậu mạnh thật đấy!',
  };
  const result = await world.startBattle({ trainer, persist: true });
  if (result === 'win') await world.say(def.name, ['Phục cậu luôn! Lần sau tớ sẽ mạnh hơn.']);
}

async function tradeTalk(world, def) {
  const { want, give, nickname, item, troll } = residentTrade(def);
  const wantName = SPECIES[want].name;
  const giveName = SPECIES[give].name;
  if (hasFlag(flag(def, 'trade'))) {
    await world.say(def.name, troll
      ? ['Khà khà! Machamp của ta khoẻ lắm, bê cả tảng đá to như cái nhà!', `${nickname} vẫn cầm Everstone đấy chứ? Đừng giận lão nhé, khà khà!`]
      : [`${nickname} ở với cháu có ngoan không? ${wantName} cháu đổi cho tôi vui lắm!`]);
    return;
  }
  await world.say(def.name, troll ? [
    `Ồ, cháu có biết ${wantName} không? Lão mê ${wantName} lắm, cơ bắp cuồn cuộn!`,
    `Lão có ${giveName} tên là "${nickname}". Haunter đem đi trao đổi là tiến hoá thành Gengar đấy, cháu lời to!`,
  ] : [
    `Tôi đang tìm một con ${wantName}. Quanh đây nhiều lắm mà tôi bắt mãi không được...`,
    `Tôi có ${giveName} tên là "${nickname}"${item ? `, đang cầm ${ITEMS[item].name}` : ''}. Ở vùng này hiếm ai có ${giveName} lắm đấy!`,
  ]);
  if (!(await world.ask(`Đổi ${wantName} của bạn lấy ${giveName} "${nickname}" không?`, def.name))) {
    await world.say(def.name, ['Vậy à... Có thì quay lại đổi với tôi nhé!']);
    return;
  }
  if (!state.party.some((m) => m.speciesId === want)) {
    await world.say(def.name, [`Cháu không mang ${wantName} theo rồi. Bắt được thì quay lại nhé!`]);
    return;
  }
  // Chọn trong đội (danh sách dọc), chọn đúng loài họ muốn thì xác nhận rồi đổi
  const index = await world.pickMon(`Chọn ${wantName} để đổi lấy ${giveName}`, state.party);
  if (index === null) return;
  const mine = state.party[index];
  if (mine.speciesId !== want) {
    await world.say(def.name, [`Đó đâu phải ${wantName}! Tôi chỉ muốn ${wantName} thôi.`]);
    return;
  }
  if (!(await world.ask(`Đổi ${mine.name} Lv${mine.level} lấy ${giveName} "${nickname}"?`, def.name))) return;
  const got = createMonster(give, mine.level);
  got.name = nickname;
  got.ot = def.name; // Pokémon của người ở: OT là họ
  if (item) got.heldItem = item;
  markSeen(give);
  markCaught(give);
  state.party[index] = got;
  setFlag(flag(def, 'trade'));
  world.refreshFollower?.();
  await world.say(null, [`Bạn đã đổi ${mine.name} lấy ${giveName} "${nickname}" của ${def.name}!`]);
  if (troll) {
    // Machoke về tay lão: tiến hoá ngay (được trao đổi). Haunter của bạn cầm Everstone: không tiến hoá
    await world.say(null, [`Ồ? ${mine.name} trong tay ${def.name} phát sáng... và tiến hoá thành Machamp!`]);
    await world.say(def.name, [
      'Khà khà khà! Machoke đem trao đổi là tiến hoá thành Machamp ngay. Lão lời to rồi!',
      `Còn ${nickname} đang cầm Everstone, nên không tiến hoá được đâu. Ai bảo cháu không xem kỹ, khà khà!`,
    ]);
    return;
  }
  await world.say(def.name, [`Cảm ơn cháu! Chăm sóc ${nickname} giúp tôi nhé.`]);
  // Pokémon tiến hoá khi trao đổi (vd Kadabra): hỏi có cho tiến hoá không
  const to = tradeEvolutionTarget(got);
  if (to && SPECIES[to]) await world.evolutionScene(got, to, true);
}
