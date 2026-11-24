import { MOVES } from './moves.js';
import { TYPES } from './types.js';

// kind: 'ball' (bonus = hệ số bắt) • 'heal' (hồi HP: heal điểm, hoặc healPct tỉ lệ HP tối đa) • 'revive' (hồi sinh, revivePct tỉ lệ HP)
//       'cure' (chữa trạng thái trong cure) • 'pp' (hồi pp điểm PP cho một chiêu) • 'ev' (giảm EV của chỉ số ev)
//       'evolution' (đá tiến hoá) • 'held' (chỉ để Pokémon cầm, xem held) • 'key' (vật phẩm quan trọng: không bán, không cầm)
//       'repel' (đuổi Pokémon hoang dã yếu hơn trong steps bước) • 'escape' (Escape Rope: về nơi hồi phục gần nhất)
//       'tm' (đĩa kỹ năng: dạy chiêu teaches, mất sau khi dùng; xem TMS)
// rod: cần câu ('oldRod' | 'goodRod' | 'superRod') • mount: thú cưỡi ('ride' trên cạn | 'waterRide' dưới nước), species: loài chở
// berry: quả mọng hái trên cây • fieldOnly: chỉ dùng được ngoài trận
// held: tác dụng khi Pokémon cầm: 'everstone' (không tiến hoá) • 'leftovers' (hồi 1/16 HP mỗi lượt)
//       'luckyEgg' (EXP x1.5) • 'boost' (chiêu hệ boostType mạnh hơn 20%). Quả mọng cầm thì tự ăn khi cần.
const ALL_STATUS = ['brn', 'psn', 'par', 'slp', 'frz'];

export const ITEMS = {
  ball: {
    name: 'Poké Ball', kind: 'ball', bonus: 1, price: 200, icon: 'ball',
    desc: 'Ném vào Pokémon hoang dã để bắt. Pokémon càng yếu càng dễ bắt.',
  },
  greatBall: {
    name: 'Great Ball', kind: 'ball', bonus: 1.5, price: 600, icon: 'ball-great',
    desc: 'Bóng chất lượng cao, dễ bắt Pokémon hơn Poké Ball.',
  },
  ultraBall: {
    name: 'Ultra Ball', kind: 'ball', bonus: 2, price: 1200, icon: 'ball-ultra',
    desc: 'Bóng hiệu suất cao, tỉ lệ bắt tốt hơn Great Ball.',
  },
  // Master Ball: Giáo sư Oak tặng sau khi trở thành Nhà vô địch (story/postgame.js). Hệ số bắt rất lớn nên catchChance
  // (battle/formulas.js) luôn là 1 kể cả Pokémon đầy máu có catchRate thấp nhất: bóng lắc đủ 3 lần, không bao giờ trượt
  masterBall: {
    name: 'Master Ball', kind: 'ball', bonus: 1000, master: true, price: 0, icon: 'ball-master',
    desc: 'Bóng tốt nhất thế giới: bắt chắc chắn mọi Pokémon hoang dã, không bao giờ trượt. Quà của Giáo sư Oak.',
  },
  potion: {
    name: 'Potion', kind: 'heal', heal: 20, price: 300, icon: 'item-potion',
    desc: 'Hồi 20 HP cho một Pokémon.',
  },
  superPotion: {
    name: 'Super Potion', kind: 'heal', heal: 50, price: 700, icon: 'item-super-potion',
    desc: 'Hồi 50 HP cho một Pokémon.',
  },
  hyperPotion: {
    name: 'Hyper Potion', kind: 'heal', heal: 200, price: 1500, icon: 'item-hyper-potion',
    desc: 'Hồi 200 HP cho một Pokémon.',
  },
  revive: {
    name: 'Revive', kind: 'revive', revivePct: 0.5, price: 2000, icon: 'item-revive',
    desc: 'Hồi sinh một Pokémon đã gục với một nửa HP tối đa.',
  },
  maxRevive: {
    name: 'Max Revive', kind: 'revive', revivePct: 1, price: 4000, icon: 'item-max-revive',
    desc: 'Hồi sinh một Pokémon đã gục với toàn bộ HP.',
  },
  antidote: {
    name: 'Antidote', kind: 'cure', cure: ['psn'], price: 200, icon: 'item-antidote',
    desc: 'Chữa trúng độc cho một Pokémon.',
  },
  burnHeal: {
    name: 'Burn Heal', kind: 'cure', cure: ['brn'], price: 300, icon: 'item-burn-heal',
    desc: 'Chữa bỏng cho một Pokémon.',
  },
  paralyzeHeal: {
    name: 'Paralyze Heal', kind: 'cure', cure: ['par'], price: 300, icon: 'item-paralyze-heal',
    desc: 'Chữa tê liệt cho một Pokémon.',
  },
  awakening: {
    name: 'Awakening', kind: 'cure', cure: ['slp'], price: 100, icon: 'item-awakening',
    desc: 'Đánh thức một Pokémon đang ngủ.',
  },
  iceHeal: {
    name: 'Ice Heal', kind: 'cure', cure: ['frz'], price: 100, icon: 'item-ice-heal',
    desc: 'Làm tan băng cho một Pokémon bị đóng băng.',
  },
  fullHeal: {
    name: 'Full Heal', kind: 'cure', cure: ALL_STATUS, confusion: true, price: 400, icon: 'item-full-heal',
    desc: 'Chữa mọi trạng thái xấu cho một Pokémon.',
  },
};

// Đá tiến hoá: [id, tên, màu, mô tả]
const STONES = [
  ['fireStone', 'Fire Stone', '#f06030', 'Viên đá đỏ rực. Tiến hoá: Growlithe, Vulpix, Eevee (thành Flareon).'],
  ['waterStone', 'Water Stone', '#3a8af0', 'Viên đá xanh trong. Tiến hoá: Poliwhirl, Shellder, Staryu, Eevee (thành Vaporeon).'],
  ['thunderStone', 'Thunder Stone', '#f0d030', 'Viên đá có tia sét. Tiến hoá: Pikachu, Eevee (thành Jolteon).'],
  ['leafStone', 'Leaf Stone', '#48b040', 'Viên đá hình lá. Tiến hoá: Gloom, Weepinbell, Exeggcute.'],
  ['moonStone', 'Moon Stone', '#6a6488', 'Viên đá đen ánh trăng. Tiến hoá: Nidorina, Nidorino, Clefairy, Jigglypuff.'],
];
for (const [id, name, color, desc] of STONES) {
  ITEMS[id] = { name, kind: 'evolution', color, price: 2100, icon: `item-${id}`, desc };
}

// Đồ cầm tăng sức mạnh chiêu theo hệ: [id, tên, hệ, màu]
const BOOSTERS = [
  ['charcoal', 'Charcoal', 'fire', '#4a4048'],
  ['mysticWater', 'Mystic Water', 'water', '#58a8f0'],
  ['miracleSeed', 'Miracle Seed', 'grass', '#68c048'],
  ['magnet', 'Magnet', 'electric', '#e04848'],
  ['sharpBeak', 'Sharp Beak', 'flying', '#e8b058'],
  ['poisonBarb', 'Poison Barb', 'poison', '#a058c0'],
  ['silkScarf', 'Silk Scarf', 'normal', '#f0ece0'],
  ['blackGlasses', 'Black Glasses', 'dark', '#383848'],
  ['hardStone', 'Hard Stone', 'rock', '#9a8a6a'],
  ['twistedSpoon', 'Twisted Spoon', 'psychic', '#e85898'],
  ['neverMeltIce', 'Never-Melt Ice', 'ice', '#98d8f0'],
];
for (const [id, name, boostType, color] of BOOSTERS) {
  ITEMS[id] = {
    name, kind: 'held', held: 'boost', boostType, color, price: 1000, icon: `item-${id}`,
    desc: `Cho Pokémon cầm: chiêu hệ ${TYPES[boostType].name} mạnh hơn 20%.`,
  };
}

Object.assign(ITEMS, {
  everstone: {
    name: 'Everstone', kind: 'held', held: 'everstone', color: '#a0a0a8', price: 300, icon: 'item-everstone',
    desc: 'Cho Pokémon cầm: Pokémon sẽ không tiến hoá khi lên cấp.',
  },
  leftovers: {
    name: 'Leftovers', kind: 'held', held: 'leftovers', color: '#e05040', price: 4000, icon: 'item-leftovers',
    desc: 'Cho Pokémon cầm: mỗi cuối lượt hồi 1/16 HP.',
  },
  luckyEgg: {
    name: 'Lucky Egg', kind: 'held', held: 'luckyEgg', color: '#f8f0e0', price: 4000, icon: 'item-luckyEgg',
    desc: 'Cho Pokémon cầm: nhận thêm 50% EXP.',
  },
  // Macho Brace (quà võ sư ở Khu Safari Effort, story/quests.js): EV nhận được gấp đôi, đổi lại Tốc độ trong trận giảm một nửa
  machoBrace: {
    name: 'Macho Brace', kind: 'held', held: 'machoBrace', color: '#d8a040', price: 3000, icon: 'item-machoBrace',
    desc: 'Cho Pokémon cầm: EV nhận được sau mỗi trận gấp đôi, nhưng Tốc độ trong trận giảm một nửa.',
  },
  // Exp. Share (quà trợ lý Giáo sư Oak ở Pokémon Center Lò Gốm, story/quests.js): con cầm không ra trận vẫn nhận 50% EXP
  // và đủ EV của Pokémon bị hạ (battle/formulas.js: expShares)
  expShare: {
    name: 'Exp. Share', kind: 'held', held: 'expShare', color: '#4a88e0', price: 3000, icon: 'item-expShare',
    desc: 'Cho Pokémon cầm: không cần ra trận vẫn nhận 50% EXP và đủ EV khi đồng đội hạ Pokémon.',
  },
  bicycle: {
    name: 'Xe đạp', kind: 'key', price: 0, icon: 'item-bicycle',
    desc: 'Đi nhanh hơn đi bộ. Bấm C để lên / xuống xe (chỉ đi được ngoài trời).',
  },
  // Mỗi viên lên 1 cấp. Chỉ bán ở trung tâm thương mại; nhặt được ở vài chỗ, 3 ngày sau lại có (respawn trên bản đồ)
  rareCandy: {
    name: 'Rare Candy', kind: 'level', fieldOnly: true, price: 15000, sell: 1000, icon: 'item-rareCandy', color: '#5a8ae8',
    desc: 'Viên kẹo kỳ diệu: Pokémon ăn vào lên ngay 1 cấp.',
  },
  // HM: đĩa dạy chiêu, dùng bao nhiêu lần cũng được. Surf (như FireRed/LeafGreen chỉ học qua HM): Pokémon hệ Nước
  // và vài loài khác; Pokémon biết Surf mới lướt nước được. Thủ lĩnh Gym Nước tặng
  hmSurf: {
    name: 'HM03 Surf', kind: 'key', teaches: 'surf', learners: ['snorlax', 'rhydon', 'dratini', 'dragonair', 'dragonite'],
    price: 0, icon: 'item-hmSurf', color: '#4a90e0',
    desc: 'Dạy chiêu Surf cho Pokémon hệ Nước (và vài loài khác). Pokémon biết Surf chở bạn lướt nước. Không mất khi dùng.',
  },
  // Quà của mẹ khi vừa nhận Pokémon đầu tiên. hidden: không hiện trong túi đồ (vẫn nằm trong state.bag để biết đã nhận):
  // Bản đồ vùng mở bằng nút bản đồ góc phải trên (ui/WorldHud.js), Hộp huy hiệu xem trong Thẻ HLV (ui/TrainerCard.js)
  townMap: {
    name: 'Bản đồ vùng', kind: 'key', price: 0, icon: 'item-townMap', color: '#e8d8a8', hidden: true,
    desc: 'Bản đồ vùng Sơn Thủy, đánh dấu chỗ bạn đang đứng. Bấm nút bản đồ góc phải trên để xem.',
  },
  badgeCase: {
    name: 'Hộp huy hiệu', kind: 'key', price: 0, icon: 'item-badgeCase', color: '#a83a3a', hidden: true,
    desc: 'Hộp đựng huy hiệu gym của mẹ tặng. Dùng để xem các huy hiệu đã có.',
  },
  // Gói hàng Team Rocket cướp của Poké Mart Lục Bình (chương 1)
  martParcel: { name: 'Gói hàng', kind: 'key', price: 0, icon: 'item-martParcel', color: '#c89858', desc: 'Gói hàng mới nhập của Poké Mart Lục Bình. Mang vào trả cho nhân viên cửa hàng.' },
  // Phụ tùng xe đạp rơi trên đường (nhiệm vụ của tiệm xe đạp Đèn Lồng)
  bikeChain: { name: 'Xích xe đạp', kind: 'key', price: 0, icon: 'item-bikeChain', color: '#707888', desc: 'Sợi xích của tiệm xe đạp Đèn Lồng. Mang trả cho ông chủ tiệm.' },
  bikeWheel: { name: 'Bánh xe đạp', kind: 'key', price: 0, icon: 'item-bikeWheel', color: '#303440', desc: 'Bánh xe của tiệm xe đạp Đèn Lồng. Mang trả cho ông chủ tiệm.' },
  bikeSeat: { name: 'Yên xe đạp', kind: 'key', price: 0, icon: 'item-bikeSeat', color: '#a83a2a', desc: 'Cái yên của tiệm xe đạp Đèn Lồng. Mang trả cho ông chủ tiệm.' },
  // Cầu chì rơi quanh Xóm Trạm Điện (nhiệm vụ cốt truyện của làng, story/villages.js)
  fuse: { name: 'Cầu chì', kind: 'key', price: 0, icon: 'item-fuse', color: '#d8b040', desc: 'Cầu chì của trạm biến áp Xóm Trạm Điện. Mang về cho kỹ sư trạm.' },
  // Hoá thạch: fossil = loài Pokémon cổ đại hồi sinh được ở Viện Hoá thạch Núi Đá (story/postgame.js).
  // Helix / Dome nằm trong hốc đá ở Mỏ Đá Vách Núi (chỉ lấy được một), Old Amber ở phòng kín Hang Sơn Động
  helixFossil: {
    name: 'Helix Fossil', kind: 'key', fossil: 'omanyte', price: 0, icon: 'item-helixFossil', color: '#c89a68',
    desc: 'Hoá thạch vỏ ốc xoắn của một Pokémon biển cổ đại. Viện Hoá thạch ở Thành phố Núi Đá hồi sinh được nó.',
  },
  domeFossil: {
    name: 'Dome Fossil', kind: 'key', fossil: 'kabuto', price: 0, icon: 'item-domeFossil', color: '#a88a60',
    desc: 'Hoá thạch mai vòm của một Pokémon biển cổ đại. Viện Hoá thạch ở Thành phố Núi Đá hồi sinh được nó.',
  },
  oldAmber: {
    name: 'Old Amber', kind: 'key', fossil: 'aerodactyl', price: 0, icon: 'item-oldAmber', color: '#e8a030',
    desc: 'Mảnh hổ phách cổ còn giữ gen của một Pokémon bay thời tiền sử. Viện Hoá thạch ở Thành phố Núi Đá hồi sinh được nó.',
  },
  // Thú cưỡi: không cần có Pokémon đó trong đội
  arcanineMount: {
    name: 'Thú cưỡi Arcanine', kind: 'key', mount: 'ride', species: 'arcanine', price: 0, icon: 'item-arcanineMount', color: '#f07a2a',
    desc: 'Arcanine của Lò Gốm chở bạn chạy thật nhanh trên cạn. Bấm R để cưỡi / xuống.',
  },
  laprasMount: {
    name: 'Thú cưỡi Lapras', kind: 'key', mount: 'waterRide', species: 'lapras', price: 0, icon: 'item-laprasMount', color: '#4aa0d8',
    desc: 'Lapras của Hồ Sương chở bạn lướt nhanh trên mặt nước. Đứng ở bờ nhìn ra mặt nước rồi bấm Enter (hoặc dùng trong túi đồ / ô phím tắt) để xuống nước. Dưới nước bấm R để đổi giữa Lapras và Surf.',
  },
  oldRod: {
    name: 'Cần câu cũ', kind: 'key', rod: 'oldRod', price: 0, icon: 'item-oldRod', color: '#a07848',
    desc: 'Cần câu cũ kỹ. Đứng quay mặt ra mặt nước rồi bấm vào cần câu trong túi (hoặc ô phím tắt) để câu. Chỉ câu được Pokémon yếu.',
  },
  goodRod: {
    name: 'Cần câu tốt', kind: 'key', rod: 'goodRod', price: 0, icon: 'item-goodRod', color: '#4a7ad8',
    desc: 'Cần câu khá tốt, câu được nhiều loại Pokémon hơn.',
  },
  superRod: {
    name: 'Cần câu siêu', kind: 'key', rod: 'superRod', price: 0, icon: 'item-superRod', color: '#e8b030',
    desc: 'Cần câu tốt nhất, câu được Pokémon mạnh và hiếm.',
  },
  repel: {
    name: 'Repel', kind: 'repel', steps: 100, price: 400, icon: 'item-repel',
    desc: 'Trong 100 bước, Pokémon hoang dã yếu hơn Pokémon đầu đội sẽ không xuất hiện.',
  },
  superRepel: {
    name: 'Super Repel', kind: 'repel', steps: 200, price: 700, icon: 'item-super-repel',
    desc: 'Trong 200 bước, Pokémon hoang dã yếu hơn Pokémon đầu đội sẽ không xuất hiện.',
  },
  maxRepel: {
    name: 'Max Repel', kind: 'repel', steps: 250, price: 900, icon: 'item-max-repel',
    desc: 'Trong 250 bước, Pokémon hoang dã yếu hơn Pokémon đầu đội sẽ không xuất hiện.',
  },
  escapeRope: {
    name: 'Escape Rope', kind: 'escape', price: 550, icon: 'item-escape-rope',
    desc: 'Đưa bạn về Pokémon Center đã vào gần nhất (chưa vào thì về nhà), cả đội được hồi phục hoàn toàn.',
  },
});

// Quả mọng: [id, tên, màu quả, công dụng, mô tả]
const BERRIES = [
  ['oranBerry', 'Oran Berry', '#4a7af0', { kind: 'heal', heal: 10 }, 'Hồi 10 HP cho một Pokémon.'],
  ['sitrusBerry', 'Sitrus Berry', '#f0d040', { kind: 'heal', healPct: 0.25 }, 'Hồi 1/4 HP tối đa cho một Pokémon.'],
  // Quả "lúc nguy": Pokémon cầm trong trận chỉ tự ăn khi còn 1/4 HP (Gluttony: còn 1/2)
  ['figyBerry', 'Figy Berry', '#e86868', { kind: 'heal', healPct: 1 / 3, pinch: true }, 'Hồi 1/3 HP tối đa. Cho cầm trong trận: chỉ tự ăn khi HP còn 1/4 trở xuống.'],
  ['cheriBerry', 'Cheri Berry', '#e83848', { kind: 'cure', cure: ['par'] }, 'Chữa tê liệt.'],
  ['chestoBerry', 'Chesto Berry', '#7858c8', { kind: 'cure', cure: ['slp'] }, 'Đánh thức Pokémon đang ngủ.'],
  ['pechaBerry', 'Pecha Berry', '#f8a0c0', { kind: 'cure', cure: ['psn'] }, 'Chữa trúng độc.'],
  ['rawstBerry', 'Rawst Berry', '#58c8a0', { kind: 'cure', cure: ['brn'] }, 'Chữa bỏng.'],
  ['aspearBerry', 'Aspear Berry', '#f0e878', { kind: 'cure', cure: ['frz'] }, 'Làm tan băng.'],
  ['lumBerry', 'Lum Berry', '#68c040', { kind: 'cure', cure: ALL_STATUS, confusion: true }, 'Chữa mọi trạng thái xấu, kể cả rối loạn.'],
  ['leppaBerry', 'Leppa Berry', '#e86030', { kind: 'pp', pp: 10 }, 'Hồi 10 PP cho một chiêu.'],
  ['pomegBerry', 'Pomeg Berry', '#e04060', { kind: 'ev', ev: 'hp' }, 'Giảm 10 EV HP.'],
  ['kelpsyBerry', 'Kelpsy Berry', '#58a0e0', { kind: 'ev', ev: 'atk' }, 'Giảm 10 EV Atk.'],
  ['qualotBerry', 'Qualot Berry', '#f0c050', { kind: 'ev', ev: 'def' }, 'Giảm 10 EV Def.'],
  ['hondewBerry', 'Hondew Berry', '#90d058', { kind: 'ev', ev: 'spAtk' }, 'Giảm 10 EV Sp.Atk.'],
  ['grepaBerry', 'Grepa Berry', '#f0e8a0', { kind: 'ev', ev: 'spDef' }, 'Giảm 10 EV SpD.'],
  ['tamatoBerry', 'Tamato Berry', '#e84838', { kind: 'ev', ev: 'speed' }, 'Giảm 10 EV Spe.'],
];

export const EV_BERRY_AMOUNT = 10;

for (const [id, name, color, effect, desc] of BERRIES) {
  ITEMS[id] = {
    name, ...effect, berry: true, color, price: 20, icon: `berry-${id}`, desc,
    fieldOnly: effect.kind === 'ev',
  };
}

export const BERRY_IDS = BERRIES.map(([id]) => id);

// Hàng của Poké Mart mở dần theo tiến độ (bậc 0: lúc mới bắt đầu, xem progressTier ở story/chapter1.js).
// Đĩa kỹ năng (TM): dạy chiêu teaches, mất sau khi dùng (như game gốc thế hệ đầu); HM thì dùng mãi. Pokémon học được
// đĩa khi (game/tms.js: canLearnDisc): chiêu cùng hệ với Pokémon, có trong bộ chiêu học theo cấp, loài nằm trong learners,
// Pokémon có hệ trong types, hoặc chiêu thông dụng (universal) — trừ vài loài không học được đĩa nào.
// Nguồn: quầy đĩa ở Trung tâm thương mại (STORE_STOCK.tms, như Celadon), thủ lĩnh gym tặng đĩa sở trường (GYM_TMS),
// vài đĩa hiếm nhặt trên đường (data/maps*), vài nhà dân tặng (story/residents.js)
const TMS = [
  // Quầy đĩa Trung tâm thương mại
  ['tmMegaPunch', 'megaPunch', 3000, { types: ['fighting', 'normal'], sold: true }],
  ['tmMegaKick', 'megaKick', 3000, { types: ['fighting', 'normal'], sold: true }],
  ['tmTakeDown', 'takeDown', 3000, { universal: true, sold: true }],
  ['tmBodySlam', 'bodySlam', 4000, { universal: true, sold: true }],
  ['tmSubmission', 'submission', 3000, { sold: true }],
  ['tmDoubleTeam', 'doubleTeam', 2000, { universal: true, sold: true }],
  ['tmReflect', 'reflect', 2000, { universal: true, sold: true }],
  ['tmLightScreen', 'lightScreen', 2000, { universal: true, sold: true }],
  ['tmSwift', 'swift', 2000, { universal: true, sold: true }],
  ['tmRest', 'rest', 2000, { universal: true, sold: true }],
  ['tmSunnyDay', 'sunnyDay', 3000, { universal: true, sold: true }],
  ['tmRainDance', 'rainDance', 3000, { universal: true, sold: true }],
  // Thủ lĩnh gym tặng (chiêu sở trường của gym)
  ['tmAirSlash', 'airSlash', 3000, {}],
  ['tmGigaDrain', 'gigaDrain', 3000, {}],
  ['tmThunderbolt', 'thunderbolt', 3000, {}],
  ['tmWaterPulse', 'waterPulse', 3000, {}],
  ['tmFlamethrower', 'flamethrower', 3000, {}],
  ['tmRockSlide', 'rockSlide', 3000, {}],
  ['tmPsychic', 'psychic', 3000, {}],
  ['tmIceBeam', 'iceBeam', 3000, {}],
  // Nhặt trên đường (hiếm) / nhà dân tặng (ít)
  ['tmEarthquake', 'earthquake', 3000, {}],
  ['tmShadowBall', 'shadowBall', 3000, {}],
  ['tmSludgeBomb', 'sludgeBomb', 3000, {}],
  ['tmBrickBreak', 'brickBreak', 3000, {}],
  ['tmThunderWave', 'thunderWave', 2000, { types: ['electric'] }],
  ['tmEnergyBall', 'energyBall', 3000, {}],
];
TMS.forEach(([id, move, price, opts], i) => {
  const m = MOVES[move];
  const no = String(i + 1).padStart(2, '0');
  ITEMS[id] = {
    name: `TM${no} ${m.name}`, kind: 'tm', teaches: move, price, icon: `item-${id}`, color: cssHex(TYPES[m.type].color),
    ...(opts.types ? { types: opts.types } : {}), ...(opts.universal ? { universal: true } : {}),
    desc: `Đĩa kỹ năng: dạy chiêu ${m.name} (hệ ${TYPES[m.type].name}${m.power ? `, sức mạnh ${m.power}` : ''}). Mất sau khi dùng.`,
  };
});
// Đĩa sở trường thủ lĩnh gym tặng khi thắng (story/chapter2.js)
export const GYM_TMS = {
  wind: 'tmAirSlash', grass: 'tmGigaDrain', electric: 'tmThunderbolt', water: 'tmWaterPulse',
  fire: 'tmFlamethrower', rock: 'tmRockSlide', psychic: 'tmPsychic', ice: 'tmIceBeam',
};
function cssHex(color) {
  return typeof color === 'number' ? `#${color.toString(16).padStart(6, '0')}` : color;
}

// Cửa hàng ở các thị trấn sau này dùng bậc cao hơn: đầu game chỉ có đồ cơ bản, càng về sau càng nhiều hàng tốt.
// Đá tiến hoá chỉ bán ở Trung tâm thương mại; đồ cầm tăng sức mạnh (Charcoal...), Leftovers, Lucky Egg không bán,
// chỉ nhận từ thủ lĩnh gym và nhiệm vụ phụ (cửa hàng vẫn mua lại).
export const MART_TIERS = [
  ['ball', 'potion', 'antidote', 'awakening', 'paralyzeHeal', 'repel', 'escapeRope'],
  ['greatBall', 'superPotion', 'burnHeal', 'iceHeal', 'revive', 'superRepel', 'everstone'],
  ['ultraBall', 'hyperPotion', 'fullHeal', 'maxRepel'],
  ['maxRevive'],
];

// Hàng bày bán ở bậc tier (gồm cả hàng các bậc trước), theo thứ tự
export const martStock = (tier) => MART_TIERS.slice(0, tier + 1).flat();

// Trung tâm thương mại (Thành phố Sông Nước): quầy tạp hoá đủ bóng / thuốc / Repel, quầy đá tiến hoá
export const STORE_STOCK = {
  general: [...martStock(2), 'rareCandy'],
  stones: [...STONES.map(([id]) => id), 'everstone'],
  tms: TMS.filter(([, , , opts]) => opts.sold).map(([id]) => id),
};

// Pokémon cầm được mọi vật phẩm trừ vật phẩm quan trọng và đĩa kỹ năng
export const canHold = (id) => ITEMS[id].kind !== 'key' && ITEMS[id].kind !== 'tm';

// Bán lại cho cửa hàng được một nửa giá
export const sellPrice = (id) => ITEMS[id].sell ?? Math.floor(ITEMS[id].price / 2);

export const formatMoney = (n) => `${n.toLocaleString('vi-VN')}₽`;

// Các ngăn túi đồ (tab), như túi đồ game gốc. item: vật phẩm lấy icon làm biểu tượng của ngăn
// Ngăn túi: Vật phẩm (thuốc, hồi sinh, chữa trạng thái, Repel, Escape Rope, đá tiến hoá, Rare Candy...), Bóng, Quả mọng,
// Kỹ năng (đĩa TM / HM), Phụ kiện (đồ cho Pokémon cầm + vật phẩm quan trọng; sau này thêm quần áo, nón, cánh...)
export const BAG_POCKETS = [
  { id: 'item', name: 'Vật phẩm', item: 'potion' },
  { id: 'ball', name: 'Bóng', item: 'ball' },
  { id: 'berry', name: 'Quả mọng', item: 'oranBerry' },
  { id: 'tm', name: 'Kỹ năng', item: 'hmSurf' },
  { id: 'held', name: 'Phụ kiện', item: 'leftovers' },
];

// Ngăn túi chứa vật phẩm id
export function pocketOf(id) {
  const item = ITEMS[id];
  if (item.teaches) return 'tm';
  if (item.kind === 'key') return 'held';
  if (item.kind === 'ball') return 'ball';
  if (item.berry) return 'berry';
  if (item.kind === 'held') return 'held';
  return 'item';
}
