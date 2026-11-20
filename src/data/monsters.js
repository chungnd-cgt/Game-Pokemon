import { speciesAbilities } from './abilities.js';
import LEARNSETS from './learnsets.json' with { type: 'json' };
import { MOVES } from './moves.js';
import { DEX_BY_SLUG } from './pokedex.js';
import { parseEvYield, parseFemaleRatio } from './stats.js';

// Các Pokémon đã chơi được trong game. Tên, hệ, chỉ số gốc, tỉ lệ bắt, EXP lấy từ Pokédex,
// chiêu học được lấy từ bộ chiêu gốc (learnsets.json, xem learnsetOf bên dưới); ở đây chỉ khai báo phần riêng của game:
//  desc: mô tả ở màn chọn khởi đầu
//  color/belly/features: để vẽ hình tạm khi thiếu ảnh (xem src/gfx/textures.js)
//  evolution: [{ to, level }] tiến hoá khi lên cấp, [{ to, item }] khi dùng đá tiến hoá, hoặc [{ to, trade: true }] khi được
//  trao đổi với người chơi khác (game/trade.js); npcLevel: cấp mà đội hình nhà huấn luyện (đấu lại) đã tiến hoá sẵn
const PLAYABLE = {
  charmander: {
    color: 0xf08a3c, belly: 0xf8d68a, features: ['flameTail'],
    desc: 'Ngọn lửa ở đuôi cho biết sức sống của nó. Atk cao, Spe nhanh nhẹn.',
    evolution: [{ to: 'charmeleon', level: 16 }],
  },
  squirtle: {
    color: 0x7ac4e8, belly: 0xf2e2a6, features: ['shell', 'curlyTail'],
    desc: 'Rút vào mai khi gặp nguy hiểm. Def rất tốt.',
    evolution: [{ to: 'wartortle', level: 16 }],
  },
  bulbasaur: {
    color: 0x6cc4a1, belly: 0x9be0c4, features: ['bulb', 'spots'],
    desc: 'Mang hạt giống trên lưng từ lúc mới sinh. Bền bỉ và cân bằng.',
    evolution: [{ to: 'ivysaur', level: 16 }],
  },
  rattata: {
    color: 0x9a6fb0, belly: 0xe8dcc0, features: ['bigEars', 'teeth', 'whiskers'],
    evolution: [{ to: 'raticate', level: 20 }],
  },
  pidgey: {
    color: 0xb98a58, belly: 0xf0dcb4, features: ['wings', 'beak', 'crest'],
    evolution: [{ to: 'pidgeotto', level: 18 }],
  },
  oddish: {
    color: 0x4a68b8, belly: 0x5a7ac8, features: ['leaves', 'redEyes'],
    evolution: [{ to: 'gloom', level: 21 }],
  },
  poliwag: {
    color: 0x5a7fd0, belly: 0xffffff, features: ['swirl', 'tadpoleTail'],
    evolution: [{ to: 'poliwhirl', level: 25 }],
  },
  pikachu: {
    color: 0xf6d43a, belly: 0xf6d43a, features: ['longEars', 'cheeks', 'zigzagTail'],
    desc: 'Pokémon chuột điện. Hơi bướng bỉnh nhưng rất trung thành.',
    evolution: [{ to: 'raichu', item: 'thunderStone' }],
  },
  // Pokémon của Team Rocket (không xuất hiện ngoài bụi cỏ)
  ekans: {
    color: 0xa060c0, belly: 0xe8d070, features: [],
    evolution: [{ to: 'arbok', level: 22 }],
  },
  koffing: {
    color: 0x8a6aa8, belly: 0x8a6aa8, features: [],
    evolution: [{ to: 'weezing', level: 35 }],
  },
  // Pokémon dưới nước: gặp khi lướt nước hoặc câu cá
  magikarp: {
    color: 0xf06a3a, belly: 0xf8d8a0, features: ['whiskers', 'tadpoleTail'],
    evolution: [{ to: 'gyarados', level: 20 }],
  },
  goldeen: {
    color: 0xf4f0f0, belly: 0xf08a50, features: ['crest', 'tadpoleTail'],
    evolution: [{ to: 'seaking', level: 33 }],
  },
  psyduck: {
    color: 0xf0d050, belly: 0xf8e8a0, features: ['beak'],
    evolution: [{ to: 'golduck', level: 33 }],
  },
  // Pokémon trong hang
  zubat: {
    color: 0x5a78d0, belly: 0x9a68c8, features: ['wings', 'bigEars'],
    evolution: [{ to: 'golbat', level: 22 }],
  },
  geodude: {
    color: 0x9a968a, belly: 0x8a8678, features: [],
    evolution: [{ to: 'graveler', level: 25 }],
  },
  // Pokémon ở các gym 2-4
  bellsprout: {
    color: 0xe8e060, belly: 0x88c858, features: ['leaves'],
    evolution: [{ to: 'weepinbell', level: 21 }],
  },
  magnemite: {
    color: 0xb8c0cc, belly: 0xd8dde4, features: [],
    evolution: [{ to: 'magneton', level: 30 }],
  },
  voltorb: {
    color: 0xe04848, belly: 0xf4f4f4, features: [],
    evolution: [{ to: 'electrode', level: 30 }],
  },
  tentacool: {
    color: 0x58a8e0, belly: 0xe05868, features: [],
    evolution: [{ to: 'tentacruel', level: 30 }],
  },
  staryu: {
    color: 0xc89858, belly: 0xe84858, features: [],
    evolution: [{ to: 'starmie', item: 'waterStone' }],
  },
  // Gym 5-8
  vulpix: {
    color: 0xc86a3a, belly: 0xf0c890, features: ['bigEars', 'fluff'],
    evolution: [{ to: 'ninetales', item: 'fireStone' }],
  },
  ponyta: {
    color: 0xf8e8c8, belly: 0xf8f0e0, features: ['flameTail', 'fluff'],
    evolution: [{ to: 'rapidash', level: 40 }],
  },
  onix: {
    color: 0x9a9a8a, belly: 0x8a8a7a, features: [],
  },
  rhyhorn: {
    color: 0x9a9ab0, belly: 0xc8c8d8, features: ['teeth'],
    evolution: [{ to: 'rhydon', level: 42 }],
  },
  abra: {
    color: 0xe8c040, belly: 0x8a5a2a, features: ['bigEars'],
    evolution: [{ to: 'kadabra', level: 16 }],
  },
  drowzee: {
    color: 0xe8c858, belly: 0x8a5a3a, features: [],
    evolution: [{ to: 'hypno', level: 26 }],
  },
  slowpoke: {
    color: 0xf08aa8, belly: 0xf8e0c8, features: ['curlyTail'],
    evolution: [{ to: 'slowbro', level: 37 }],
  },
  seel: {
    color: 0xe8eef8, belly: 0xf8f8ff, features: ['whiskers'],
    evolution: [{ to: 'dewgong', level: 34 }],
  },
  shellder: {
    color: 0x9a68c8, belly: 0xc8a8e8, features: ['shell'],
    evolution: [{ to: 'cloyster', item: 'waterStone' }],
  },
  jynx: {
    color: 0xc84868, belly: 0xf0d8e8, features: ['longEars'],
  },
  lapras: {
    color: 0x4aa0d8, belly: 0xf0e8c8, features: ['shell'],
  },
  // Liên minh: Ma, Giác đấu, Rồng, Độc
  gastly: {
    color: 0x3a2a58, belly: 0x8a68c8, features: ['fluff'],
    evolution: [{ to: 'haunter', level: 25 }],
  },
  machop: {
    color: 0x8aa8c0, belly: 0xb8c8d8, features: ['crest'],
    evolution: [{ to: 'machoke', level: 28 }],
  },
  mankey: {
    color: 0xe8d8b8, belly: 0xc8a888, features: ['roundEars', 'fluff'],
    evolution: [{ to: 'primeape', level: 28 }],
  },
  hitmonlee: {
    color: 0xb08a5a, belly: 0xd8b888, features: [],
  },
  hitmonchan: {
    color: 0xb87a5a, belly: 0xd8a888, features: [],
  },
  grimer: {
    color: 0x9a6ab8, belly: 0xb88ad0, features: [],
    evolution: [{ to: 'muk', level: 38 }],
  },
  dratini: {
    color: 0x7a9ae8, belly: 0xf0f0f8, features: ['longEars'],
    evolution: [{ to: 'dragonair', level: 30 }],
  },
  aerodactyl: {
    color: 0xa898b8, belly: 0xc8b8d8, features: ['wings', 'teeth'],
  },
  snorlax: {
    color: 0x2a5a68, belly: 0xf0e0c0, features: ['roundEars'],
  },
  lickitung: {
    color: 0xe890a0, belly: 0xf0d8b0, features: [],
  },
  // Eevee: tiến hoá bằng đá thành Vaporeon (Water), Jolteon (Thunder), Flareon (Fire)
  eevee: {
    color: 0xb88a50, belly: 0xf0e0c0, features: ['bigEars', 'fluff'],
    evolution: [{ to: 'vaporeon', item: 'waterStone' }, { to: 'jolteon', item: 'thunderStone' }, { to: 'flareon', item: 'fireStone' }],
  },
  // Mèo của Team Rocket, cũng gặp ở bụi cỏ tuyến đường 4 (Persian hiếm hơn, ở tuyến đường 7)
  meowth: {
    color: 0xf0e2b0, belly: 0xf8f0d8, features: ['roundEars', 'whiskers', 'curlyTail'],
    evolution: [{ to: 'persian', level: 28 }],
  },
  growlithe: {
    color: 0xf0903a, belly: 0xf6e6b0, features: ['roundEars', 'stripes', 'fluff'],
    evolution: [{ to: 'arcanine', item: 'fireStone' }],
  },
};

// Dạng tiến hoá: chưa có ảnh riêng thì vẽ tạm từ màu / đặc điểm của dạng trước (thêm ảnh vào src/assets/pokemon để thay)
const evolved = (from, { color, features = [], ...rest } = {}) => ({
  color: color ?? PLAYABLE[from].color,
  belly: PLAYABLE[from].belly,
  features: [...new Set([...PLAYABLE[from].features, ...features])],
  ...rest,
});
Object.assign(PLAYABLE, {
  charmeleon: evolved('charmander', {
    color: 0xe0603a, evolution: [{ to: 'charizard', level: 36 }],
  }),
  wartortle: evolved('squirtle', {
    color: 0x6aa8e0, evolution: [{ to: 'blastoise', level: 36 }],
  }),
  ivysaur: evolved('bulbasaur', { color: 0x58b08c, evolution: [{ to: 'venusaur', level: 32 }] }),
  raticate: evolved('rattata', { color: 0xb08a5a }),
  pidgeotto: evolved('pidgey', { evolution: [{ to: 'pidgeot', level: 36 }] }),
  gloom: evolved('oddish', { color: 0x4a58a0, evolution: [{ to: 'vileplume', item: 'leafStone' }] }),
  poliwhirl: evolved('poliwag', { evolution: [{ to: 'poliwrath', item: 'waterStone' }] }),
  raichu: evolved('pikachu', { color: 0xf0a030 }),
  arbok: evolved('ekans', { color: 0x8a48a8 }),
  weezing: evolved('koffing', { color: 0x7a5a98 }),
  persian: evolved('meowth', { color: 0xe8d098, belly: 0xf4ead0 }),
  arcanine: evolved('growlithe', { color: 0xf07a2a }),
});
Object.assign(PLAYABLE, {
  gyarados: evolved('magikarp', {
    color: 0x3a70c8, belly: 0xf0e0a0, features: ['crest', 'teeth'],
  }),
  ninetales: evolved('vulpix', { color: 0xf0e0a0 }),
  rapidash: evolved('ponyta'),
  rhydon: evolved('rhyhorn', { color: 0x8a8aa0 }),
  kadabra: evolved('abra', { evolution: [{ to: 'alakazam', trade: true, npcLevel: 40 }] }),
  hypno: evolved('drowzee'),
  slowbro: evolved('slowpoke', { color: 0xe87898 }),
  dewgong: evolved('seel'),
  cloyster: evolved('shellder', { color: 0x6a4898 }),
  weepinbell: evolved('bellsprout', { color: 0xd8d050, evolution: [{ to: 'victreebel', item: 'leafStone' }] }),
  magneton: evolved('magnemite'),
  electrode: evolved('voltorb', { color: 0xe83838 }),
  tentacruel: evolved('tentacool', { color: 0x4a90d0 }),
  starmie: evolved('staryu', { color: 0x9a68c8 }),
  golbat: evolved('zubat', { color: 0x4a5ac0 }),
  graveler: evolved('geodude', { color: 0x8a867a, evolution: [{ to: 'golem', trade: true, npcLevel: 45 }] }),
  seaking: evolved('goldeen', { color: 0xf0e8e0 }),
  golduck: evolved('psyduck', { color: 0x4a88d0 }),
  charizard: evolved('charmeleon', { color: 0xf07838, features: ['wings'] }),
  blastoise: evolved('wartortle', { color: 0x5a90d0 }),
  venusaur: evolved('ivysaur', { color: 0x4aa078 }),
  pidgeot: evolved('pidgeotto'),
  vileplume: evolved('gloom', { color: 0xc04848 }),
  poliwrath: evolved('poliwhirl', { color: 0x3a5ab8 }),
});

// Dạng tiến hoá thứ ba của Abra (Kadabra phải có trước)
PLAYABLE.alakazam = evolved('kadabra');
PLAYABLE.victreebel = evolved('weepinbell', { color: 0xc8c040 });
PLAYABLE.vaporeon = evolved('eevee', { color: 0x58a8e8, belly: 0xe8f0f8 });
PLAYABLE.jolteon = evolved('eevee', { color: 0xf0d040, belly: 0xf8f0d0 });
PLAYABLE.flareon = evolved('eevee', { color: 0xe8703a, belly: 0xf8e0a0 });
// Liên minh. Kadabra / Haunter / Machoke / Graveler tiến hoá khi được trao đổi với người chơi khác (như bản gốc)
PLAYABLE.haunter = evolved('gastly', { color: 0x5a3a88, features: ['bigEars'], evolution: [{ to: 'gengar', trade: true, npcLevel: 38 }] });
PLAYABLE.gengar = evolved('haunter', { color: 0x4a3478, features: ['teeth', 'redEyes'] });
PLAYABLE.machoke = evolved('machop', { color: 0x7a8ab0, evolution: [{ to: 'machamp', trade: true, npcLevel: 40 }] });
PLAYABLE.machamp = evolved('machoke', { color: 0x6a7aa0 });
PLAYABLE.primeape = evolved('mankey');
PLAYABLE.muk = evolved('grimer', { color: 0x8a58a8 });
PLAYABLE.dragonair = evolved('dratini', { color: 0x5a8ae0, evolution: [{ to: 'dragonite', level: 55 }] });
PLAYABLE.dragonite = evolved('dragonair', { color: 0xe8a848, belly: 0xf0e0b0, features: ['wings'] });
PLAYABLE.golem = evolved('graveler', { color: 0x8a7a68 });

// ---------- Đủ 151 loài: các loài còn lại của Kanto ----------
// Nidorina / Nidorino / Clefairy / Jigglypuff tiến hoá bằng Moon Stone (Đá Mặt Trăng) như game gốc
Object.assign(PLAYABLE, {
  caterpie: {
    color: 0x8ccc5a, belly: 0xf0e0a0, features: ['tadpoleTail'],
    desc: 'Sâu xanh ăn lá, mùi hôi từ chiếc râu đỏ đuổi được kẻ thù to xác.',
    evolution: [{ to: 'metapod', level: 7 }],
  },
  weedle: {
    color: 0xd89a4a, belly: 0xec8a92, features: [],
    desc: 'Sâu kim độc sống trong rừng, gai trên đầu chích rất đau.',
    evolution: [{ to: 'kakuna', level: 7 }],
  },
  spearow: {
    color: 0xa86a3a, belly: 0xf6e2b8, features: ['wings', 'beak', 'crest'],
    desc: 'Chim nhỏ hung dữ, kêu inh ỏi để giữ lãnh thổ của mình.',
    evolution: [{ to: 'fearow', level: 20 }],
  },
  sandshrew: {
    color: 0xdcae50, belly: 0xf4e6c0, features: ['roundEars'],
    desc: 'Đào hang trong đất khô, cuộn tròn thành quả bóng khi gặp nguy.',
    evolution: [{ to: 'sandslash', level: 22 }],
  },
  'nidoran-f': {
    color: 0x9cc4ec, belly: 0xeef4fc, features: ['bigEars', 'spots'],
    desc: 'Gai nhỏ trên người tiết ra chất độc, tính tình hiền lành.',
    evolution: [{ to: 'nidorina', level: 16 }],
  },
  'nidoran-m': {
    color: 0xc890d8, belly: 0xf6eefa, features: ['bigEars', 'spots'],
    desc: 'Đôi tai lớn dỏng lên nghe ngóng, sừng trên trán có độc.',
    evolution: [{ to: 'nidorino', level: 16 }],
  },
  clefairy: {
    color: 0xf4a6ba, belly: 0xfde6ea, features: ['longEars', 'curlyTail'],
    desc: 'Pokémon tiên hiếm gặp, nghe đồn đêm trăng tròn hay nhảy múa trong hang.',
    evolution: [{ to: 'clefable', item: 'moonStone' }],
  },
  jigglypuff: {
    color: 0xf0a4c2, belly: 0xfbc8da, features: ['bigEars', 'crest'],
    desc: 'Hát ru bằng đôi mắt to tròn, ai nghe cũng buồn ngủ.',
    evolution: [{ to: 'wigglytuff', item: 'moonStone' }],
  },
  paras: {
    color: 0xf0a050, belly: 0xf4dcaa, features: ['spots'],
    desc: 'Hai cây nấm trên lưng hút chất dinh dưỡng từ chính nó.',
    evolution: [{ to: 'parasect', level: 24 }],
  },
  venonat: {
    color: 0x8a5cb6, belly: 0xd8b8e2, features: ['fluff', 'redEyes'],
    desc: 'Đôi mắt kép to như ra-đa, ban đêm bay quanh ánh đèn bắt sâu bọ.',
    evolution: [{ to: 'venomoth', level: 31 }],
  },
  diglett: {
    color: 0xb07c50, belly: 0xb07c50, features: [],
    desc: 'Sống dưới lòng đất, đất nó đào qua trở nên tơi xốp cho cây trồng.',
    evolution: [{ to: 'dugtrio', level: 26 }],
  },
  farfetchd: {
    color: 0xb88a5a, belly: 0xf4e8d0, features: ['wings', 'beak'],
    desc: 'Lúc nào cũng cắp theo một cọng hành, dùng nó làm kiếm để chiến đấu.',
  },
  doduo: {
    color: 0xbd8650, belly: 0xf0d8a8, features: ['beak'],
    desc: 'Chim hai đầu không biết bay nhưng chạy rất nhanh trên đồng cỏ.',
    evolution: [{ to: 'dodrio', level: 31 }],
  },
  krabby: {
    color: 0xe8552e, belly: 0xf8e2b6, features: ['shell'],
    desc: 'Cua sống ven bờ nước, đôi càng kẹp khoẻ tới mức bẻ gãy cả cành cây.',
    evolution: [{ to: 'kingler', level: 28 }],
  },
  exeggcute: {
    color: 0xf8bcc6, belly: 0xfde6e8, features: ['spots'],
    desc: 'Sáu quả trứng luôn đi cùng nhau, giao tiếp bằng thần giao cách cảm.',
    evolution: [{ to: 'exeggutor', item: 'leafStone' }],
  },
  cubone: {
    color: 0xc08a52, belly: 0xece6d6, features: ['crest'],
    desc: 'Đội hộp sọ của mẹ trên đầu, đêm trăng thường khóc thút thít.',
    evolution: [{ to: 'marowak', level: 28 }],
  },
  tangela: {
    color: 0x5a86d8, belly: 0x5a86d8, features: ['fluff'],
    desc: 'Toàn thân phủ dây leo xanh rối như búi chỉ, không ai thấy được mặt thật.',
  },
  kangaskhan: {
    color: 0xac8458, belly: 0xf6e8bc, features: ['roundEars'],
    desc: 'Pokémon mẹ hiền mà dữ, luôn che chở đứa con nhỏ trong túi bụng.',
  },
  horsea: {
    color: 0x6cb6ec, belly: 0xfdf2c4, features: ['curlyTail'],
    desc: 'Cá ngựa nhỏ phun mực để trốn kẻ thù, giữ thăng bằng bằng chiếc đuôi cuộn.',
    evolution: [{ to: 'seadra', level: 32 }],
  },
  'mr-mime': {
    color: 0xf0ecf2, belly: 0xf27c96, features: ['bigEars'],
    desc: 'Bậc thầy kịch câm, dựng được bức tường vô hình chỉ bằng cử động tay.',
  },
  scyther: {
    color: 0x7cc24e, belly: 0xe6e6a8, features: ['wings'],
    desc: 'Đôi lưỡi hái sắc bén, lướt nhanh như gió trong bụi cỏ cao.',
  },
  electabuzz: {
    color: 0xf0bc26, belly: 0xffec7a, features: ['stripes'],
    desc: 'Hay lảng vảng quanh trạm điện để hút điện, làm cả xóm mất điện.',
  },
  magmar: {
    color: 0xd43626, belly: 0xf0a62a, features: ['flameTail'],
    desc: 'Sinh ra trong miệng núi lửa, thân nóng rực như lò gốm đang nung.',
  },
  pinsir: {
    color: 0xb08a64, belly: 0xc49c76, features: ['teeth'],
    desc: 'Cặp sừng kìm kẹp chặt con mồi, càng giãy càng siết chặt.',
  },
  tauros: {
    color: 0xc08448, belly: 0xdca468, features: ['crest'],
    desc: 'Bò tót hung hăng, quất đuôi vào mình trước khi lao tới.',
  },
  chansey: {
    color: 0xf4b0c4, belly: 0xffffff, features: ['curlyTail'],
    desc: 'Pokémon hiền hậu hay giúp người bị thương, quả trứng trong túi rất bổ dưỡng.',
  },
  ditto: {
    color: 0xc4a0ec, belly: 0xc4a0ec, features: [],
    desc: 'Biến thành bất cứ thứ gì nó nhìn thấy, nhưng biến xong thì vẫn giữ khuôn mặt cũ.',
  },
  porygon: {
    color: 0xff9cb4, belly: 0x3c96dc, features: ['beak'],
    desc: 'Pokémon nhân tạo đầu tiên, đi lại được cả trong không gian máy tính.',
  },
  // Hoá thạch (hồi sinh trong cốt truyện, không có ngoài tự nhiên)
  omanyte: {
    color: 0x5aa8e6, belly: 0xfff4cc, features: ['shell'],
    desc: 'Pokémon cổ đại hồi sinh từ hoá thạch, bơi bằng các xúc tu.',
    evolution: [{ to: 'omastar', level: 40 }],
  },
  kabuto: {
    color: 0xb87a40, belly: 0x5e3416, features: ['shell', 'redEyes'],
    desc: 'Pokémon cổ đại hồi sinh từ hoá thạch, ẩn mình dưới chiếc mai cứng.',
    evolution: [{ to: 'kabutops', level: 40 }],
  },
  // Huyền thoại (gặp trong nhiệm vụ sau khi vô địch)
  articuno: {
    color: 0x6ab0e8, belly: 0xe2f4ff, features: ['wings', 'beak', 'crest'],
    desc: 'Chim huyền thoại của băng giá, đôi cánh làm không khí đông thành tuyết.',
  },
  zapdos: {
    color: 0xf4c42e, belly: 0xfff07a, features: ['wings', 'beak'],
    desc: 'Chim huyền thoại của sấm sét, vỗ cánh là trời nổi giông.',
  },
  moltres: {
    color: 0xf4a632, belly: 0xffd86a, features: ['wings', 'beak', 'flameTail'],
    desc: 'Chim huyền thoại của lửa, mỗi lần vỗ cánh rắc xuống những tàn lửa đỏ.',
  },
  mewtwo: {
    color: 0xc8b6d4, belly: 0x8a3ab8, features: ['bigEars'],
    desc: 'Được tạo ra từ gen của Mew, sức mạnh siêu linh đáng sợ nhất.',
  },
  mew: {
    color: 0xf4a0c2, belly: 0xffd2e2, features: ['bigEars', 'longEars'],
    desc: 'Pokémon bí ẩn, nghe đồn mang gen của mọi loài Pokémon.',
  },
});
Object.assign(PLAYABLE, {
  metapod: evolved('caterpie', {
    color: 0x76b850, features: ['shell'],
    desc: 'Vỏ kén cứng như thép, nằm yên chờ ngày tiến hoá.',
    evolution: [{ to: 'butterfree', level: 10 }],
  }),
  kakuna: evolved('weedle', {
    color: 0xe0b038,
    desc: 'Treo mình trên cành cây, gần như bất động trong lớp kén.',
    evolution: [{ to: 'beedrill', level: 10 }],
  }),
  fearow: evolved('spearow', { color: 0x9a6438, desc: 'Đôi cánh lớn bay cả ngày không nghỉ, mỏ dài mổ con mồi dưới nước.' }),
  sandslash: evolved('sandshrew', { color: 0xd29e3e, features: ['spots'], desc: 'Lưng phủ gai nhọn, cuộn tròn lăn vào kẻ thù.' }),
  nidorina: evolved('nidoran-f', {
    color: 0x80b2dc, desc: 'Hiền lành, thu gai lại khi ở cạnh bạn bè.',
    evolution: [{ to: 'nidoqueen', item: 'moonStone' }],
  }),
  nidorino: evolved('nidoran-m', {
    color: 0xa866c0, desc: 'Nóng tính, sừng kim cương cứng hơn cả kim cương.',
    evolution: [{ to: 'nidoking', item: 'moonStone' }],
  }),
  clefable: evolved('clefairy', { color: 0xec98b2, features: ['wings'], desc: 'Tai thính nghe được tiếng kim rơi cách cả cây số, rất hiếm gặp.' }),
  wigglytuff: evolved('jigglypuff', { color: 0xee9cbe, desc: 'Lông mềm mịn như nhung, hít hơi vào là phồng to mãi.' }),
  parasect: evolved('paras', { color: 0xe2502e, desc: 'Cây nấm đã chiếm cả thân, thích chỗ ẩm tối trong hang.' }),
  venomoth: evolved('venonat', { color: 0x8a64b8, features: ['wings'], desc: 'Vảy phấn trên cánh có độc, rắc xuống làm đối thủ tê liệt.' }),
  dugtrio: evolved('diglett', { color: 0xa87048, desc: 'Ba đầu cùng đào, chui xuống đất sâu cả chục mét trong chớp mắt.' }),
  dodrio: evolved('doduo', { desc: 'Ba cái đầu tượng trưng cho vui, buồn và giận, chạy nhanh như ngựa.' }),
  kingler: evolved('krabby', { color: 0xd84a2a, desc: 'Một càng to quá khổ kẹp với sức mạnh mười tấn.' }),
  exeggutor: evolved('exeggcute', { color: 0x8ad460, belly: 0xf2dca2, features: ['leaves'], desc: 'Gọi là quả dừa biết đi, ba cái đầu mỗi cái nghĩ một kiểu.' }),
  marowak: evolved('cubone', { color: 0xa8703e, desc: 'Đã vượt qua nỗi buồn mất mẹ, chiếc xương trong tay thành vũ khí.' }),
  seadra: evolved('horsea', { color: 0x4a8ad8, desc: 'Gai trên vây có độc, xoáy nước bằng chiếc đuôi để bắt mồi.' }),
  omastar: evolved('omanyte', { color: 0x3c90d2, features: ['teeth'], desc: 'Chiếc vỏ quá nặng khiến nó bị tuyệt chủng thời cổ đại.' }),
  kabutops: evolved('kabuto', { color: 0xa46632, features: ['teeth'], desc: 'Hai lưỡi liềm sắc bén, săn mồi trong nước thời cổ đại.' }),
});
PLAYABLE.butterfree = evolved('metapod', {
  color: 0x5656b0, belly: 0xd6dcee, features: ['wings', 'redEyes'],
  desc: 'Phấn trên cánh có thể làm đối thủ buồn ngủ, tê liệt hoặc trúng độc.',
});
PLAYABLE.beedrill = evolved('kakuna', { color: 0xe2a826, features: ['wings'], desc: 'Ba kim độc lớn, cả bầy tấn công kẻ phá tổ.' });
PLAYABLE.nidoqueen = evolved('nidorina', { color: 0x3c74b8, belly: 0xf6e8bc, desc: 'Lớp vảy cứng như áo giáp, liều mình bảo vệ con.' });
PLAYABLE.nidoking = evolved('nidorino', { color: 0x7a4ca6, belly: 0xf6e8bc, desc: 'Đuôi khoẻ quật đổ cả cột điện, sừng có độc rất mạnh.' });

// Bộ chiêu gốc mỗi loài, tạo bằng scripts/import-learnsets.mjs (game là bản làm lại Kanto kiểu GBA):
//  learnset: [cấp, chiêu] học khi lên cấp, theo FireRed/LeafGreen
//  evolutionMoves: chiêu học ngay khi tiến hoá thành loài này. Gen 3 chưa có cơ chế này nên lấy từ Scarlet/Violet
//  (loài không có ở đó thì Brilliant Diamond/Shining Pearl)
// Chỉ giữ chiêu đã có trong moves.js: chiêu cần cơ chế game chưa có (Protect, Rest, Leech Seed...) tạm bỏ qua,
// thêm chiêu vào moves.js là loài đó tự học được.
const known = ([, move]) => Boolean(MOVES[move]);
// Ngoại lệ riêng của game: Abra gốc chỉ biết Teleport mà game chưa có cơ chế Teleport (bỏ chạy / rút về),
// không có chiêu nào thì không đánh được nên tạm cho học Confusion (Kadabra học khi tiến hoá) từ cấp 1
// Tương tự: Metapod / Kakuna gốc chỉ biết Harden: giữ chiêu đánh của dạng trước (Tackle / Poison Sting) như khi tiến hoá trong game gốc
const EXTRA_LEARNSET = {
  abra: [[1, 'confusion']],
  metapod: [[1, 'tackle']],
  kakuna: [[1, 'poisonSting']],
};

// Đặc tính thường / ẩn của loài theo Pokédex (Gen 5). Game đã có đủ mọi đặc tính của 151 loài; phòng khi thêm loài mới
// mà chưa có đặc tính thường nào thì dùng đặc tính ẩn làm đặc tính thường
function abilitiesOf(id) {
  const { normal, hidden } = speciesAbilities(id);
  if (normal.length) return { normal, hidden };
  return { normal: hidden ? [hidden] : [], hidden: null };
}

// pokemondb xếp các chiêu cùng cấp theo ABC (không phải thứ tự trong game). Cùng cấp thì xếp chiêu trạng thái trước
// để Pokémon mới tạo (lấy 4 chiêu học sau cùng) luôn có chiêu gây sát thương, vd Vileplume / Raichu học nhiều chiêu ở cấp 1
const isStatus = ([, move]) => (MOVES[move].category === 'status' ? 0 : 1);
const byLevel = (a, b) => a[0] - b[0] || isStatus(a) - isStatus(b);

function learnsetOf(id) {
  const { levelUp, evolution } = LEARNSETS[id];
  return {
    learnset: [...levelUp, ...(EXTRA_LEARNSET[id] ?? [])].filter(known).sort(byLevel),
    evolutionMoves: evolution.filter((move) => MOVES[move]),
  };
}

export const SPECIES = Object.fromEntries(
  Object.entries(PLAYABLE).map(([id, extra]) => {
    const dex = DEX_BY_SLUG[id];
    const { total, ...base } = dex.stats;
    return [id, {
      ...learnsetOf(id),
      id,
      dexId: dex.id,
      name: dex.name,
      types: dex.types,
      base,
      catchRate: dex.catchRate,
      baseExp: dex.baseExp,
      growthRate: dex.growthRate, // nhóm tăng trưởng: Fast / Medium Fast / Medium Slow / Slow (EXP cần để lên cấp)
      evYield: parseEvYield(dex.evYield),
      femaleRatio: parseFemaleRatio(dex.gender),
      abilities: abilitiesOf(id),
      ...extra,
    }];
  }),
);

export const STARTERS = ['bulbasaur', 'charmander', 'squirtle'];
