import { ITEMS } from '../data/items.js';
import { FOSSIL_DX } from '../data/indoorLayout.js';
import { SPECIES } from '../data/monsters.js';
import { DEX_BY_SLUG } from '../data/pokedex.js';
import { createMonster } from '../game/monster.js';
import { addCaught, hasFlag, itemCount, playerName, setFlag, state, useItem } from '../game/state.js';
import { forceWeather } from '../game/weather.js';
import { F_CHAMPION, F_STARTER_GIFT, regionalDex } from './league.js';

// Sau khi thành Nhà vô địch (hậu truyện):
//  1. Về nhà nói chuyện với mẹ: mẹ chúc mừng, dặn sang phòng thí nghiệm vì Giáo sư Oak muốn xem Pokédex (PG.MOM).
//  2. Giáo sư Oak xem Pokédex (số loài đã gặp / đã bắt, nhận xét), tặng các Pokémon khởi đầu còn lại (nếu chưa nhận),
//     tặng Master Ball rồi kể tin đồn về Pokémon huyền thoại (PG.OAK): mở các nhiệm vụ huyền thoại.
//  3. Năm Pokémon huyền thoại / bí ẩn, mỗi con một nơi, có người kể chuyện gần đó (chỉ hiện sau bước 2):
//     Zapdos (trạm phát cũ, Đồi Cột Điện) • Articuno (hốc đá đỉnh Đèo Tuyết) • Moltres (sân lò gốm bỏ hoang, Tuyến đường 7)
//     • Mewtwo (cuối Hầm băng, Hang Vân Sơn: chỉ hiện khi Pokédex đã gặp cả ba chim huyền thoại)
//     • Mew (bãi hoa góc tây bắc Rừng Thông: phải nghe cô bé hái hoa kể chuyện và mang theo quả Pecha).
//     Đứng trên bản đồ như Pokémon nhiệm vụ (NPC mon:), nói chuyện là vào trận với createMonster (vẫn có tỉ lệ shiny như
//     thường). Bắt được thì biến mất hẳn (cờ legend:<id>, hoặc Pokédex đã ghi bắt được loài đó). Hạ gục thì nó bay đi
//     (cờ legendFled:<id>), ra khỏi bản đồ rồi quay lại là nó lại ở chỗ cũ (postgameStep xoá cờ). Thua / bỏ chạy: vẫn ở đó.
//  4. Hoá thạch (không cần vô địch): Helix / Dome Fossil (chọn một) ở Mỏ Đá Vách Núi, Old Amber ở phòng kín Hang Sơn Động.
//     Tiến sĩ Thạch ở Viện Hoá thạch Núi Đá hồi sinh thành Omanyte / Kabuto / Aerodactyl Lv 30 (vẫn có tỉ lệ shiny).

export const PG = {
  MOM: 'postgame:mom', // mẹ đã chúc mừng, dặn sang gặp Giáo sư Oak
  OAK: 'postgame:oak', // Giáo sư Oak đã xem Pokédex, tặng Master Ball, kể chuyện Pokémon huyền thoại
  MEW_HINT: 'legendHint:mew', // cô bé hái hoa ở Rừng Thông đã kể chuyện Pokémon màu hồng
};

export const postgameStarted = () => hasFlag(F_CHAMPION) && hasFlag(PG.OAK);

// ---------- Pokémon huyền thoại ----------

const BIRDS = ['zapdos', 'articuno', 'moltres'];
const dexId = (species) => DEX_BY_SLUG[species].id;
// Pokédex đã gặp cả ba chim huyền thoại (điều kiện để Mewtwo lộ diện)
export const birdsSeen = () => BIRDS.every((s) => state.dex.seen.has(dexId(s)));

const OAK = 'Giáo sư Oak';

export const LEGENDS = [
  {
    id: 'zapdos', name: 'Zapdos', map: 'hill3', x: 4, y: 26, facing: 'right', level: 50,
    where: 'trạm phát cũ dưới chân Đồi Cột Điện (Xóm Trạm Điện)',
    intro: ['Một con chim lớn vàng rực đậu trên cột điện cũ của trạm phát.', 'Tia điện xẹt lách tách quanh đôi cánh nhọn như răng cưa...'],
    // Zapdos gọi giông: trời đổ mưa, trận đấu diễn ra dưới mưa (thời tiết ngoài bản đồ mang vào trận)
    async before(world) {
      forceWeather('normal', 'rain', 6);
      world.ambience?.refresh?.(true);
      world.cameras?.main?.flash(300, 255, 250, 200);
      await world.say(null, ['Mây đen kéo tới vần vũ, sấm nổ đùng đoàng!', 'Zapdos giương cánh lao xuống!']);
    },
    caught: ['Mưa giông tạnh dần. Trạm phát cũ im lìm trở lại.'],
    fled: ['Zapdos rạch một tia chớp ngang trời rồi mất hút sau dãy cột điện.', 'Có lẽ nó sẽ còn quay về trạm phát cũ này...'],
  },
  {
    id: 'articuno', name: 'Articuno', map: 'pass8', x: 32, y: 3, facing: 'down', level: 50,
    where: 'hốc đá trên đỉnh Đèo Tuyết (Làng Đèo Tuyết)',
    intro: ['Một con chim lớn xanh như băng đậu giữa hốc đá phủ sương giá.', 'Mỗi lần nó vỗ cánh, tuyết lại rơi dày hơn...'],
    async before(world) {
      await world.say(null, ['Articuno cất tiếng kêu trong vắt, gió buốt thổi tung tuyết trắng xoá!']);
    },
    caught: ['Gió tuyết lặng dần. Hốc đá chỉ còn lớp băng lấp lánh.'],
    fled: ['Articuno vút lên giữa trời tuyết rồi khuất sau đỉnh đèo.', 'Có lẽ nó sẽ còn quay về hốc đá này...'],
  },
  {
    id: 'moltres', name: 'Moltres', map: 'route7', x: 35, y: 7, facing: 'right', level: 50,
    where: 'sân lò gốm bỏ hoang trên Tuyến đường 7 (gần Thành phố Lò Gốm)',
    intro: ['Một con chim lửa đậu cạnh lò nung bỏ hoang, đôi cánh rực cháy.', 'Miệng lò tắt lửa đã lâu bỗng đỏ rực trở lại...'],
    async before(world) {
      world.cameras?.main?.flash(300, 255, 160, 80);
      await world.say(null, ['Moltres tung cánh, lửa bùng lên khắp sân lò!']);
    },
    caught: ['Lửa trong miệng lò lụi dần, chỉ còn hơi ấm.'],
    fled: ['Moltres vút lên như một ngọn đuốc rồi bay mất về phía núi.', 'Có lẽ nó sẽ còn quay về sân lò này...'],
  },
  {
    id: 'mewtwo', name: 'Mewtwo', map: 'cave3c', x: 11, y: 12, facing: 'up', level: 70, zone: 'cave',
    where: 'cuối Hầm băng, Hang Vân Sơn',
    requires: birdsSeen,
    intro: ['Một Pokémon dáng người, đuôi dài, đứng bất động giữa hầm băng.', 'Một giọng nói vang thẳng vào đầu bạn: "...Ngươi cũng tới để bắt ta sao?"'],
    async before(world) {
      world.cameras?.main?.shake(400, 0.006);
      await world.say(null, ['Băng trên vách nứt toác. Mewtwo giải phóng sức mạnh tâm linh!']);
    },
    caught: ['Hầm băng lặng ngắt. Luồng năng lượng kỳ lạ đã biến mất.'],
    fled: ['Mewtwo dịch chuyển tức thời rồi biến mất vào sâu trong núi.', '"...Chưa xong đâu." Có lẽ nó sẽ quay về hầm băng này.'],
  },
  {
    id: 'mew', name: 'Mew', map: 'forest1', x: 5, y: 3, facing: 'down', level: 40,
    where: 'bãi hoa góc tây bắc Rừng Thông (Làng Chân Đồi)',
    // Cô bé hái hoa kể chuyện rồi mới thấy; Mew chỉ ló ra khi bạn mang theo quả Pecha thơm
    requires: () => hasFlag(PG.MEW_HINT) && itemCount('pechaBerry') > 0,
    intro: ['Một Pokémon nhỏ xíu màu hồng lơ lửng giữa bãi hoa, tò mò nhìn túi đồ của bạn.'],
    async before(world) {
      useItem('pechaBerry');
      await world.say(null, ['Bạn đặt một quả Pecha xuống bãi hoa.', 'Mew sà xuống ăn ngon lành, rồi cười khúc khích bay vòng quanh bạn: nó muốn chơi!']);
    },
    caught: ['Bãi hoa rung rinh trong gió như vừa có ai cười khúc khích.'],
    fled: ['Mew lộn một vòng trên không rồi biến mất.', 'Mang theo quả Pecha quay lại đây, biết đâu nó lại ló ra...'],
  },
];

const legendById = (id) => LEGENDS.find((l) => l.id === id);
const caughtFlag = (id) => `legend:${id}`;
const fledFlag = (id) => `legendFled:${id}`;

// Đã bắt được: cờ riêng, hoặc Pokédex đã ghi bắt được loài đó (phòng khi tắt game ngay sau khi bắt: Pokémon đã vào đội
// nhưng cờ chưa kịp lưu, không để nó hiện lại cho bắt lần nữa). Huyền thoại không có ở bụi cỏ nào khác.
export const legendCaught = (id) => hasFlag(caughtFlag(id)) || state.dex.caught.has(dexId(id));

// Pokémon huyền thoại đang đứng ở chỗ của nó trên bản đồ
export function legendAvailable(id) {
  const legend = legendById(id);
  if (!postgameStarted() || legendCaught(id) || hasFlag(fledFlag(id))) return false;
  return legend.requires ? legend.requires() : true;
}

export const legendsCaught = () => LEGENDS.filter((l) => legendCaught(l.id)).length;

async function meetLegend(world, legend) {
  const npcId = `legend-${legend.id}`;
  await world.say(null, legend.intro);
  if (!(await world.ask(`Đấu với ${legend.name}? (Lv ${legend.level})`))) {
    await world.say(null, [`${legend.name} vẫn lặng lẽ dõi theo bạn.`]);
    return;
  }
  await legend.before?.(world);
  // Không persist: như Pokémon nhiệm vụ của làng, tắt game giữa trận thì nó vẫn ở chỗ cũ
  const result = await world.startBattle({ enemy: createMonster(legend.id, legend.level), zone: legend.zone ?? 'meadow' });
  const npc = world.findNpc(npcId);
  if (result === 'catch') {
    setFlag(caughtFlag(legend.id));
    if (npc) world.removeNpc(npc);
    await world.say(null, legend.caught);
  } else if (result === 'win') {
    setFlag(fledFlag(legend.id));
    if (npc) await world.npcFlyAway(npc);
    await world.say(null, legend.fled);
  } else if (result === 'run') {
    await world.say(null, [`${legend.name} không đuổi theo, chỉ đứng yên nhìn bạn rời đi.`]);
  }
  // Thua: đã tỉnh dậy ở chỗ hồi phục, nó vẫn ở chỗ cũ chờ bạn quay lại
}

const legendNpc = (legend) => ({
  id: `legend-${legend.id}`, mon: legend.id, name: legend.name, map: legend.map, x: legend.x, y: legend.y,
  facing: legend.facing, fixed: true,
  show: () => legendAvailable(legend.id),
  onTalk: (world) => meetLegend(world, legend),
});

// Mỗi bước đi: Pokémon huyền thoại đã bị hạ gục (bay đi) thì khi người chơi đã sang bản đồ khác, nó lại về chỗ cũ
export function postgameStep(world) {
  for (const legend of LEGENDS) {
    if (world.map.id !== legend.map && hasFlag(fledFlag(legend.id))) state.flags.delete(fledFlag(legend.id));
  }
  return null;
}

// ---------- Mẹ và Giáo sư Oak ----------

// Mẹ chúc mừng Nhà vô địch, dặn sang gặp Giáo sư Oak. Trả về true nếu vừa nói (mẹ vẫn hồi phục Pokémon như thường sau đó)
export async function momPostgame(world) {
  if (!hasFlag(F_CHAMPION) || hasFlag(PG.MOM)) return false;
  await world.say('Mẹ', [
    'Con về rồi! Cả Pallet xem TV thấy con thắng Nhà vô địch Khôi, mẹ khóc mất mấy lần đấy!',
    `${playerName()} của mẹ giờ là Nhà vô địch vùng Sơn Thủy rồi. Mẹ tự hào về con lắm.`,
    'À, sáng nay Giáo sư Oak ghé qua. Ông dặn khi nào con về thì sang phòng thí nghiệm báo cho ông một tiếng.',
    'Ông muốn xem Pokédex của con, hình như còn có quà nữa. Nghỉ ngơi một chút rồi sang ngay nhé!',
  ]);
  setFlag(PG.MOM);
  return true;
}

// Giáo sư Oak sau khi vô địch: chưa gặp mẹ thì giục về nhà; gặp rồi thì xem Pokédex, tặng quà; sau đó trò chuyện về huyền thoại
export async function oakPostgame(world) {
  if (!hasFlag(PG.MOM)) {
    await world.say(OAK, [
      'Ồ! Nhà vô địch của vùng Sơn Thủy đây rồi! Ta xem trận chung kết trên TV mà hồi hộp quá.',
      'Mà khoan... cháu đã về nhà chào mẹ chưa? Mẹ cháu ngóng cháu từng ngày đấy.',
      'Về chào mẹ trước đi rồi quay lại đây. Ta có chuyện quan trọng muốn nói.',
    ]);
    return;
  }
  if (!hasFlag(PG.OAK)) {
    await dexCheck(world);
    return;
  }
  await oakChat(world);
}

// Nhận xét của Giáo sư Oak theo tỉ lệ loài đã bắt trong Pokédex vùng Sơn Thủy
function dexComment(caught, total) {
  const ratio = total ? caught / total : 0;
  if (ratio >= 1) return ['Không thể tin được! Cháu đã bắt đủ mọi loài Pokémon của vùng Sơn Thủy!', 'Ta nghiên cứu cả đời cũng chưa làm được như vậy!'];
  if (ratio >= 0.75) return ['Tuyệt vời! Pokédex của cháu gần như hoàn chỉnh rồi.', 'Chỉ còn vài trang trống nữa thôi!'];
  if (ratio >= 0.4) return ['Khá lắm! Cháu vừa đánh gym vừa ghi chép được nhiều đấy.', 'Nhưng vẫn còn nhiều trang trống lắm.'];
  return ['Hừm... Cháu mải luyện cho đội mạnh nên Pokédex còn nhiều trang trống quá.', 'Pokémon không chỉ để chiến đấu đâu. Hãy làm quen với tất cả chúng!'];
}

async function dexCheck(world) {
  await world.say(OAK, [
    `${playerName()}! Mẹ cháu gọi điện báo cháu về rồi. Chúc mừng Nhà vô địch mới của vùng Sơn Thủy!`,
    'Nào, đưa Pokédex cho ta xem cháu đã gặp những Pokémon nào trên đường đi.',
  ]);
  await world.say(null, ['Bạn đưa Pokédex cho Giáo sư Oak.']);
  const { caught, total } = regionalDex();
  await world.say(OAK, [
    'Để xem nào...',
    `Cháu đã gặp ${state.dex.seen.size} loài và bắt được ${state.dex.caught.size} loài Pokémon.`,
    `Riêng Pokémon vùng Sơn Thủy: đã bắt ${caught}/${total} loài.`,
    ...dexComment(caught, total),
  ]);
  if (!hasFlag(F_STARTER_GIFT)) await starterGift(world);
  await world.say(OAK, [
    'Còn đây là món quà quý nhất của phòng thí nghiệm. Ta giữ nó bao năm nay chờ một nhà huấn luyện xứng đáng.',
  ]);
  await world.giveItem('masterBall');
  await world.say(OAK, [
    'Master Ball bắt chắc chắn bất kỳ Pokémon hoang dã nào, không bao giờ trượt. Ta chỉ có đúng một quả thôi đấy!',
    'Hãy để dành cho Pokémon thật đặc biệt...',
    'Mà nói tới đặc biệt: từ hôm cháu vô địch, khắp Sơn Thủy rộ lên tin đồn về Pokémon huyền thoại.',
    'Dân Xóm Trạm Điện thấy chim sấm Zapdos đậu ở trạm phát cũ trên Đồi Cột Điện.',
    'Người leo núi kể chim băng Articuno làm tổ trong hốc đá trên đỉnh Đèo Tuyết.',
    'Còn chim lửa Moltres thì đốt rực sân lò gốm bỏ hoang trên Tuyến đường 7, gần Lò Gốm.',
    'Một học trò cũ của ta đang đo luồng năng lượng lạ trong Hầm băng, Hang Vân Sơn. Nghe đâu nó mạnh lên mỗi khi chim huyền thoại thức giấc.',
    'À, cả cô bé hái hoa ở Rừng Thông sau Làng Chân Đồi nữa, cứ khăng khăng là thấy một Pokémon màu hồng tí hon.',
    'Pokémon huyền thoại mạnh lắm (Lv 50 trở lên). Chuẩn bị thật kỹ rồi hãy đi, Nhà vô địch!',
  ]);
  setFlag(PG.OAK);
}

// Vô địch rồi về gặp Giáo sư Oak: tặng các Pokémon khởi đầu chưa có (Gary và cháu đã chọn thì không còn trên bàn),
// để hoàn thành được Pokédex vùng Sơn Thủy
const GIFT_STARTERS = ['bulbasaur', 'charmander', 'squirtle', 'pikachu'];
async function starterGift(world) {
  await world.say(OAK, ['Để giúp cháu hoàn thành Pokédex, ta tặng cháu những Pokémon khởi đầu mà phòng thí nghiệm vẫn còn giữ.']);
  for (const species of GIFT_STARTERS) {
    if (state.dex.caught.has(dexId(species))) continue;
    const where = addCaught(createMonster(species, 5));
    await world.say(null, [`Bạn nhận được ${SPECIES[species].name}!${where === 'storage' ? ' (đã gửi vào hộp PC)' : ''}`]);
  }
  setFlag(F_STARTER_GIFT);
  world.refreshFollower();
}

async function oakChat(world) {
  const n = legendsCaught();
  const next = nextLegend();
  const lines = [`Cháu đã thu phục ${n}/${LEGENDS.length} Pokémon huyền thoại rồi à?`];
  if (next) lines.push(`Ta nghe nói còn ${next.name} ở ${next.where}.`);
  else lines.push('Cả năm Pokémon huyền thoại của Sơn Thủy đều đã gặp được người xứng đáng. Ta ghen tị với cháu đấy!');
  const { caught, total } = regionalDex();
  lines.push(caught < total ? `Pokédex vùng Sơn Thủy: ${caught}/${total}. Đi khắp nơi vào mọi buổi trong ngày nhé!` : 'Pokédex vùng Sơn Thủy đã hoàn chỉnh. Cháu là niềm tự hào của Pallet!');
  await world.say(OAK, lines);
}

// Pokémon huyền thoại tiếp theo nên đi tìm (theo thứ tự ba chim → Mewtwo → Mew), null nếu đã bắt đủ
export function nextLegend() {
  return LEGENDS.find((l) => !legendCaught(l.id)) ?? null;
}

// ---------- Mục tiêu ----------

// Mục tiêu sau khi vô địch (null nếu chưa vô địch)
export function postgameObjective() {
  if (!hasFlag(F_CHAMPION)) return null;
  if (!hasFlag(PG.MOM)) return 'Về nhà ở Pallet báo tin cho mẹ';
  if (!hasFlag(PG.OAK)) return 'Sang phòng thí nghiệm cho Giáo sư Oak xem Pokédex';
  const next = nextLegend();
  if (next) {
    const n = `Huyền thoại (${legendsCaught()}/${LEGENDS.length})`;
    if (next.id === 'mewtwo' && !birdsSeen()) return `${n}: tìm cả ba chim huyền thoại rồi vào Hầm băng, Hang Vân Sơn`;
    if (next.id === 'mew' && !hasFlag(PG.MEW_HINT)) return `${n}: hỏi cô bé hái hoa ở Rừng Thông về Pokémon màu hồng`;
    if (next.id === 'mew' && !itemCount('pechaBerry')) return `${n}: mang theo quả Pecha tới bãi hoa trong Rừng Thông`;
    return `${n}: tìm ${next.name} ở ${next.where}`;
  }
  const { caught, total } = regionalDex();
  return caught < total ? `Hoàn thành Pokédex vùng Sơn Thủy (${caught}/${total})` : 'Đã hoàn thành Pokédex vùng Sơn Thủy!';
}

// ---------- Hoá thạch ----------

const FOSSILS = ['helixFossil', 'domeFossil', 'oldAmber'];
const DOCTOR = 'Tiến sĩ Thạch';
const monName = (species) => SPECIES[species]?.name ?? species[0].toUpperCase() + species.slice(1);

// Nhặt hoá thạch có lựa chọn (obj.choice: chỉ lấy được một trong nhóm): hỏi lại trước khi nhặt. Trả về false nếu thôi
export async function confirmChoice(world, obj) {
  const others = world.map.objects.filter((o) => o !== obj && o.choice === obj.choice).map((o) => ITEMS[o.item].name);
  await world.say(null, [`Trong hốc đá có ${[ITEMS[obj.item].name, ...others].join(' và ')}. Đá vụn lở lả tả, chỉ kịp mang theo một thứ.`]);
  if (!(await world.ask(`Lấy ${ITEMS[obj.item].name}?`))) return false;
  setFlag(`choice:${obj.choice}`);
  return true;
}

// Vừa nhặt được hoá thạch: gợi ý chỗ hồi sinh (và báo hoá thạch còn lại đã vùi mất nếu là lựa chọn)
export async function fossilFound(world, obj) {
  const lines = [];
  if (obj.choice) lines.push('Đá vụn đổ sập xuống, vùi mất hoá thạch còn lại.');
  lines.push('Hình như đây là hoá thạch của Pokémon cổ đại.', 'Nghe nói Viện Hoá thạch ở Thành phố Núi Đá hồi sinh được Pokémon từ hoá thạch.');
  await world.say(null, lines);
}

// Tiến sĩ Thạch: hồi sinh từng hoá thạch đang có thành Pokémon Lv 30, vào đội (đầy thì vào hộp PC), ghi vào Pokédex
export async function reviveFossils(world) {
  const owned = FOSSILS.filter((id) => itemCount(id) > 0);
  if (!owned.length) {
    await world.say(DOCTOR, [
      'Chào cháu! Ta là Thạch, nghiên cứu Pokémon cổ đại sống từ thời núi đá này còn nằm dưới đáy biển.',
      'Máy của ta hồi sinh được Pokémon từ hoá thạch của chúng.',
      'Thợ đá kể trong Mỏ Đá Vách Núi phía bắc Bản Vách Đá hay đào được hoá thạch. Hang Sơn Động thì có cả hổ phách cổ.',
      'Tìm được thì mang tới đây nhé!',
    ]);
    return;
  }
  for (const id of owned) {
    const species = ITEMS[id].fossil;
    await world.say(DOCTOR, [`Ồ! Cháu có ${ITEMS[id].name}! Đây là hoá thạch của ${monName(species)}, Pokémon sống từ thời cổ đại.`]);
    if (!(await world.ask(`Nhờ Tiến sĩ Thạch hồi sinh ${ITEMS[id].name}?`, DOCTOR))) {
      await world.say(DOCTOR, ['Tiếc thật... Khi nào đổi ý thì cứ mang tới.']);
      continue;
    }
    useItem(id);
    await world.say(null, [`Bạn đưa ${ITEMS[id].name} cho Tiến sĩ Thạch.`]);
    await world.say(DOCTOR, ['Được! Đặt nó vào máy hồi sinh nào...']);
    world.cameras?.main?.flash(400, 200, 240, 255);
    await world.say(null, ['Máy hồi sinh kêu ù ù, đèn báo nhấp nháy liên hồi... Ting!']);
    const mon = createMonster(species, 30);
    const where = addCaught(mon);
    await world.say(DOCTOR, [
      `Thành công rồi! ${ITEMS[id].name} đã hồi sinh thành ${mon.name}!`,
      ...(mon.shiny ? ['Ơ... màu của nó khác hẳn hình vẽ trong sách! Đúng là hiếm có khó tìm!'] : []),
    ]);
    await world.say(null, [`Bạn nhận được ${mon.name}!${where === 'storage' ? ' (đã gửi vào hộp PC)' : ''}`]);
    world.refreshFollower();
  }
}

// ---------- Nhân vật ----------

export const POSTGAME_NPCS = [
  ...LEGENDS.map(legendNpc),
  {
    // Viện Hoá thạch Núi Đá: đứng sau bàn thí nghiệm, nói chuyện qua bàn
    id: 'pg-fossil-doctor', sprite: 'npc-aide', name: DOCTOR, map: 'fossilLab', x: 5 + FOSSIL_DX, y: 3, facing: 'down', fixed: true,
    onTalk: (world) => reviveFossils(world),
  },
  {
    id: 'pg-fossil-aide', sprite: 'npc-aide', name: 'Trợ lý', map: 'fossilLab', x: 8 + FOSSIL_DX, y: 6, facing: 'left', wander: 1,
    lines: [
      'Hoá thạch vỏ ốc là Omanyte, hoá thạch mai vòm là Kabuto. Cả hai đều là Pokémon biển cổ đại.',
      'Hổ phách cổ thì giữ được gen của Aerodactyl, chúa tể bầu trời thời tiền sử!',
    ],
  },
  {
    // Đồi Cột Điện: thợ điện kể chuyện trạm phát cũ (gần lối vào từ Xóm Trạm Điện)
    id: 'pg-lineman', sprite: 'npc-camper', name: 'Thợ điện', map: 'hill3', x: 20, y: 3, facing: 'down', wander: 1,
    show: postgameStarted,
    async onTalk(world) {
      await world.say('Thợ điện', legendCaught('zapdos')
        ? ['Từ hôm cậu thu phục con chim sấm, đồi yên ắng hẳn. Đồng hồ điện ở xóm cũng hết quay loạn xạ.']
        : [
          'Lạ lắm! Trạm phát cũ dưới chân đồi cắt điện mấy năm rồi mà đêm nào cũng sáng rực.',
          'Trời quang mà sét cứ đánh xuống cột điện cũ ở góc tây nam đồi. Có con chim vàng rực đậu trên đó!',
          'Người ta bảo đó là Zapdos, chim sấm huyền thoại. Cậu có dám xuống xem không?',
        ]);
    },
  },
  {
    // Đèo Tuyết: người leo núi kể chuyện hốc đá trên đỉnh đèo (gần lối vào từ Làng Đèo Tuyết)
    id: 'pg-climber', sprite: 'npc-hiker', name: 'Người leo núi', map: 'pass8', x: 23, y: 29, facing: 'up', wander: 1,
    show: postgameStarted,
    async onTalk(world) {
      await world.say('Người leo núi', legendCaught('articuno')
        ? ['Đèo bớt bão tuyết hẳn từ khi cậu đưa con chim băng đi. Anh Đông giờ dẫn khách qua đèo nhàn lắm.']
        : [
          'Hốc đá trên đỉnh đèo, chỗ anh Đông trú bão hôm trước, giờ đóng băng kín mít.',
          'Tôi thấy một con chim lớn xanh như băng đậu trong đó. Nó vỗ cánh một cái là tuyết rơi trắng trời!',
          'Chắc là Articuno, chim băng huyền thoại. Leo lên đỉnh đèo nhớ mặc ấm vào.',
        ]);
    },
  },
  {
    // Tuyến đường 7: cụ thợ lò canh sân lò gốm bỏ hoang
    id: 'pg-kiln-elder', sprite: 'npc-oldman', name: 'Cụ thợ lò', map: 'route7', x: 36, y: 9, facing: 'up', fixed: true,
    show: postgameStarted,
    async onTalk(world) {
      await world.say('Cụ thợ lò', legendCaught('moltres')
        ? ['Lò tắt rồi, nhưng đất quanh đây vẫn ấm. Giờ ta lại nặn được chum, nung bằng hơi ấm còn sót của con chim lửa đấy.']
        : [
          'Sân lò này bỏ hoang từ đời ông cố ta, lửa tắt cả trăm năm nay.',
          'Thế mà mấy đêm nay lò nung tự cháy rực. Có con chim lửa đậu ngay cạnh miệng lò!',
          'Các cụ ngày xưa gọi nó là Moltres, chim lửa canh giữ nghề gốm của vùng này.',
        ]);
    },
  },
  {
    // Hầm băng, Hang Vân Sơn: học trò cũ của Giáo sư Oak đo luồng năng lượng lạ (cạnh chân thang xuống)
    id: 'pg-researcher', sprite: 'npc-aide', name: 'Nhà nghiên cứu', map: 'cave3c', x: 13, y: 3, facing: 'down', fixed: true,
    show: postgameStarted,
    async onTalk(world) {
      const name = 'Nhà nghiên cứu';
      if (legendCaught('mewtwo')) {
        await world.say(name, ['Máy đo đã lặng rồi. Pokémon nhân tạo đó... cậu thu phục được nó thật sao?', 'Hãy đối xử tốt với nó. Nó chưa từng có ai làm bạn cả.']);
      } else if (birdsSeen()) {
        await world.say(name, [
          'Kim máy đo vọt lên tận cùng rồi! Từ khi cả ba chim huyền thoại lộ diện, luồng năng lượng này mạnh khủng khiếp.',
          'Ngày trước có một nhóm nhà khoa học tạo ra Pokémon mạnh nhất từ gen của Mew. Nó phá phòng thí nghiệm rồi trốn mất...',
          'Nó đang ở cuối hầm băng kia. Mewtwo. Cậu cẩn thận đấy!',
        ]);
      } else {
        await world.say(name, [
          'Tôi là học trò cũ của Giáo sư Oak. Máy đo năng lượng tâm linh ở hầm băng này cứ dao động mãi.',
          'Mỗi lần có tin chim huyền thoại xuất hiện ở đâu đó, kim lại vọt lên một nấc.',
          'Có lẽ khi cả Zapdos, Articuno và Moltres đều lộ diện, thứ đang ẩn trong hầm băng này cũng sẽ hiện ra.',
        ]);
      }
    },
  },
  {
    // Rừng Thông: cô bé hái hoa ở bãi đầu rừng kể chuyện Pokémon màu hồng
    id: 'pg-flower-girl', sprite: 'npc-girl', name: 'Cô bé hái hoa', map: 'forest1', x: 19, y: 23, facing: 'down', wander: 1,
    show: postgameStarted,
    async onTalk(world) {
      const name = 'Cô bé hái hoa';
      if (legendCaught('mew')) {
        await world.say(name, ['Anh chị gặp được nó rồi à? Em biết mà, nó có thật! Nó dễ thương lắm phải không?']);
        return;
      }
      await world.say(name, [
        'Không ai tin em hết! Ở bãi hoa góc tây bắc rừng, chỗ bé Tí đi lạc hôm trước, có một Pokémon màu hồng tí xíu.',
        'Nó bay lơ lửng, cười khúc khích, rồi biến mất như chưa từng có ở đó.',
        'Nó chỉ ló ra khi em mang theo quả Pecha thơm thơm thôi. Chắc nó thích quả màu hồng giống nó!',
      ]);
      setFlag(PG.MEW_HINT);
      if (!itemCount('pechaBerry')) {
        await world.say(name, ['Cây Pecha có ở gò đất Lục Bình với mấy làng phía trước đó. Anh chị hái một quả rồi vào bãi hoa thử xem!']);
      }
    },
  },
];
