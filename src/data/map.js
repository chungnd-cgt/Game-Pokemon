import { CHAPTER2_MAPS } from './mapsChapter2.js';
import { CHAPTER3_MAPS } from './mapsChapter3.js';
import { CHAPTER4_MAPS } from './mapsChapter4.js';
import { GYM_MAPS } from './mapsGyms.js';
import { VILLAGE_AREAS_A } from './mapsVillageAreasA.js';
import { VILLAGE_AREAS_B } from './mapsVillageAreasB.js';
import { CHAPTER5_MAPS } from './mapsChapter5.js';
import { VILLAGE_MAPS } from './mapsVillages.js';
import { INDOOR_TILES, OUTDOOR_TILES, garlandLights, lanternPoleLights, streetLampLights } from './tiles.js';

// Các bản đồ trong game (ký tự ô: xem data/tiles.js).
// warps: ô chuyển sang bản đồ khác khi bước lên { x, y, to, tx, ty, facing, cave } (cave: hiệu ứng ra vào hang)
// heal: chỗ đứng trước Y tá Joy (Pokémon Center), thua trận / dùng Escape Rope thì về đây
// place: khu vực trên bản đồ vùng (data/region.js); trong nhà thì lấy theo bản đồ ngoài cửa

const MAP_DEFS = {
  // Thị trấn Pallet: thị trấn nhỏ chỉ có 4 ngôi nhà (nhà bạn, nhà Gary, nhà hàng xóm, phòng thí nghiệm).
  // Không có Pokémon Center / Poké Mart (ở Thị trấn Lục Bình): chỗ hồi phục duy nhất là nhà bạn (mẹ).
  // Lối ra phía bắc sang Tuyến đường 2 phải băng qua bụi cỏ duy nhất của thị trấn.
  // Hồ nước phía nam chảy ra Sông Lục Bình (lướt nước mới đi được, xem river1).
  route1: {
    name: 'Thị trấn Pallet',
    place: 'pallet',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTT==TTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTT==TTTTTTTTTTTTTTTT',
      'TTTTTTTTggggggggggTTTTTTTTTTTT',
      'TTTTTTTTggggggggggTTTTTTTTTTTT',
      'TTTTTTTTggggggggggTTTTTTTTTTTT',
      'TTTTTTTTggggggggggTTTTTTTTTTTT',
      'TTHHHHHHHHHs.=.HHHHHHHHHHHHHTT',
      'TT...........=..............TT',
      'TT.......f...=...f..........TT',
      'TT...........=..............TT',
      'TT.....s.....=.....s......Y.TT',
      'TT.========================.TT',
      'TT......eeee.=Q.............TT',
      'TT......ffff.=...........OO.TT',
      'TT......ffff.=...........OO.TT',
      'TT......h..h.=....s.........TT',
      'TT.a=aEEu....=.....aa=aa.f.kTT',
      'TT.========================.TT',
      'TT....wwwwwwwwwwwwwwwwww....TT',
      'TT...wwwwwwwwwwwwwwwwwwww...TT',
      'TT...wwwwwwwwwwwwwwwwwwww...TT',
      'TT....wwwwwwwwwwwwwwwwww....TT',
      'TTTTTTTTTTTTTTwwwwTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTwwwwTTTTTTTTTTTT',
    ],
    // Bụi cỏ: mỗi khu một bảng Pokémon hoang dã (data/encounters.js). rect: [x1, y1, x2, y2] (tính cả hai đầu)
    areas: [{ name: 'Bụi cỏ phía bắc', rect: [8, 2, 17, 5], table: 'pallet-grass' }],
    // Mặt nước: bảng khi lướt nước và khi câu bằng từng loại cần
    water: { name: 'Hồ nước', surf: 'pallet-lake-surf', oldRod: 'pallet-lake-old', goodRod: 'pallet-lake-good', superRod: 'pallet-lake-super' },
    // Lối phía bắc sang Tuyến đường 2 (mở khi xong nhiệm vụ của Giáo sư Oak, xem stepBlocker);
    // dòng sông phía nam hồ sang Sông Lục Bình (phải lướt nước)
    warps: [
      { x: 12, y: 0, to: 'route2', tx: 6, ty: 30, facing: 'up' },
      { x: 13, y: 0, to: 'route2', tx: 7, ty: 30, facing: 'up' },
      ...[14, 15, 16, 17].map((x) => ({ x, y: 23, to: 'river1', tx: x - 10, ty: 1, facing: 'down' })),
    ],
    // Đi vào cửa (đi lên) thì sang bản đồ `to`
    buildings: [
      // Bên trái đường: nhà bạn, nhà bà Tư • bên phải đường: nhà Gary, phòng thí nghiệm
      { type: 'house', x: 3, y: 7, w: 4, h: 4, door: { x: 4, y: 10 }, to: 'home', floors: 2 },
      { type: 'house', x: 20, y: 7, w: 4, h: 4, door: { x: 21, y: 10 }, to: 'garyHome', roof: 'houseRed', floors: 2 },
      { type: 'house', x: 3, y: 12, w: 4, h: 4, door: { x: 4, y: 15 }, to: 'palletHouse', roof: 'houseGreen' },
      { type: 'lab', x: 19, y: 12, w: 5, h: 4, door: { x: 21, y: 15 }, to: 'lab' },
    ],
    // Vật phẩm rơi trên đường: đi tới bấm Enter để nhặt (mỗi món chỉ nhặt được một lần)
    objects: [
      // Vật phẩm ở hai góc dưới thị trấn (bãi cỏ phía bắc không có đồ): góc trái 2 thuốc giải độc, góc phải 2 thuốc giải tê liệt
      { x: 26, y: 20, kind: 'item', id: 'r1-paralyze-heal', item: 'paralyzeHeal', qty: 2 },
      { x: 3, y: 20, kind: 'item', id: 'r1-antidote', item: 'antidote', qty: 2 },
    ],
    signs: {
      '7,10': ['NHÀ CỦA BẠN', 'Về nhà nghỉ một lát là mẹ chăm Pokémon cho khoẻ lại.'],
      '19,10': ['NHÀ GARY'],
      '11,6': ['THỊ TRẤN PALLET', '↑ Bụi cỏ phía bắc, Tuyến đường 2 và Thị trấn Lục Bình', '↓ Hồ nước chảy ra Sông Lục Bình'],
      '18,15': ['PHÒNG THÍ NGHIỆM POKéMON', 'Giáo sư Oak, chuyên gia hàng đầu về Pokémon.'],
    },
  },

  // Nhà của bạn, tầng 1: phòng khách (bộ sofa đối xứng hai bên bàn nước, mẹ ngồi sofa bên phải) và góc bếp.
  // Cầu thang lên tầng 2 ở góc trên bên phải.
  home: {
    name: 'Nhà của bạn – Tầng 1',
    indoor: true,
    theme: 'home',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###########',
      '###########',
      'FcckVVV..pS',
      '...........',
      '...[ttt]...',
      '...[ttt]...',
      '...........',
      '...........',
      'p..E......p',
    ],
    // Thảm trải sàn dưới bộ sofa: [x1, y1, x2, y2, màu nền, màu viền] (tính cả hai đầu)
    rugs: [[2, 3, 8, 6, '#c8604a', '#f0d8a8']],
    // Đồ treo tường sau (bản 3D): { cột x: loại }
    wallDecor: { 5: 'photo', 8: 'clock' },
    warps: [{ x: 10, y: 2, to: 'home2f', tx: 10, ty: 3, facing: 'down' }],
    // Đứng trước đồ đạc bấm Enter: lời mô tả (cùng cơ chế với biển báo)
    signs: {
      '0,2': ['Tủ lạnh đầy ắp đồ ăn mẹ vừa đi chợ về.'],
      '1,2': ['Bồn rửa bát sạch bong, cửa sổ nhìn ra vườn.'],
      '2,2': ['Nồi canh trên bếp đang sôi lăn tăn, thơm phức.'],
      '3,2': ['Kệ sách của mẹ: sách dạy nấu ăn và mấy cuốn tạp chí về Pokémon.'],
      ...Object.fromEntries([4, 5, 6].map((x) => [`${x},2`, ['TV đang chiếu bản tin thời tiết vùng Sơn Thủy.', 'Hôm nay trời đẹp, rất hợp để lên đường!']])),
    },
    entry: { x: 3, y: 7 }, // chỗ đứng khi vừa vào nhà
    exit: { to: 'route1', x: 3, y: 15 }, // bước lên thảm E thì ra chỗ này
  },

  // Tầng 2: phòng ngủ của bạn (chơi mới thì thức dậy ở đây). Cầu thang xuống ở góc trên bên phải.
  home2f: {
    name: 'Nhà của bạn – Phòng ngủ',
    place: 'pallet',
    indoor: true,
    theme: 'home',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###########',
      '###########',
      'Bkw.VVV..ps',
      'B..........',
      '...........',
      '...........',
      '...........',
      'p.........p',
    ],
    rugs: [[3, 3, 7, 5, '#4a78c8', '#f0e0b0']],
    tvConsole: true, // TV phòng ngủ có máy chơi game (bản 3D)
    wallDecor: { 3: 'poster', 7: 'calendar' },
    warps: [{ x: 10, y: 2, to: 'home', tx: 10, ty: 3, facing: 'down' }],
    signs: {
      '0,2': ['Giường của bạn. Chăn gối vẫn còn ấm.'],
      '0,3': ['Giường của bạn. Chăn gối vẫn còn ấm.'],
      '1,2': ['Kệ sách đầy truyện tranh và sách về Pokémon.'],
      '2,2': ['Bàn học của bạn. Vở bài tập vẫn còn mở dở...'],
      ...Object.fromEntries([4, 5, 6].map((x) => [`${x},2`, ['Máy chơi game đang cắm vào TV.', 'Hôm nay là ngày quan trọng, chơi sau nhé!']])),
    },
  },

  // Nhà Gary 2 tầng: tầng 1 có chị Đào (chị gái Gary, biết tin Gary đang ở đâu), tầng 2 là phòng của Gary
  garyHome: {
    name: 'Nhà Gary – Tầng 1',
    indoor: true,
    theme: 'home',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###########',
      '###########',
      'Fck.VVV..pS',
      '...........',
      '...[ttt]...',
      '...[ttt]...',
      '...........',
      'p..E......p',
    ],
    rugs: [[2, 3, 8, 6, '#6a8ac8', '#f0e0b0']],
    wallDecor: { 7: 'photo' },
    warps: [{ x: 10, y: 2, to: 'garyHome2f', tx: 10, ty: 3, facing: 'down' }],
    signs: {
      '0,2': ['Tủ lạnh dán đầy ảnh Gary chụp với Pokémon.'],
      '2,2': ['Kệ sách: "Cẩm nang trở thành Nhà vô địch", "Bí kíp luyện Pokémon"... đều của Gary.'],
      ...Object.fromEntries([4, 5, 6].map((x) => [`${x},2`, ['TV đang chiếu trận đấu Liên minh Pokémon.']])),
    },
    entry: { x: 3, y: 6 },
  },

  // Tầng 2 nhà Gary: phòng riêng của Gary (Gary ở đây cho tới khi bạn nhận Pokémon). Cầu thang xuống ở góc trên bên phải
  garyHome2f: {
    name: 'Nhà Gary – Phòng của Gary',
    place: 'pallet',
    indoor: true,
    theme: 'home',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###########',
      '###########',
      'Bkw.VVV..ps',
      'B..........',
      '...........',
      '...........',
      '...........',
      'p.........p',
    ],
    rugs: [[3, 3, 7, 5, '#c84848', '#f0e0b0']],
    bedColor: '#d04848', // chăn đỏ của Gary
    tvConsole: true,
    wallDecor: { 3: 'poster', 7: 'photo' },
    warps: [{ x: 10, y: 2, to: 'garyHome', tx: 10, ty: 3, facing: 'down' }],
    signs: {
      '0,2': ['Giường của Gary. Chăn gối vứt bừa bộn, chắc sáng nay dậy vội.'],
      '0,3': ['Giường của Gary. Chăn gối vứt bừa bộn, chắc sáng nay dậy vội.'],
      '1,2': ['Kệ đầy sách chiến thuật đấu Pokémon. Cuốn nào cũng gạch chân chi chít.'],
      '2,2': ['Bàn học của Gary. Trên bàn có tờ giấy ghi: "Mục tiêu: Nhà vô địch vùng Sơn Thủy!"'],
      ...Object.fromEntries([4, 5, 6].map((x) => [`${x},2`, ['TV đang chiếu lại trận chung kết Liên minh Pokémon.', 'Gary xem đi xem lại cả chục lần rồi.']])),
    },
  },

  // Nhà hàng xóm: bà Tư và bé Na
  palletHouse: {
    name: 'Nhà bà Tư',
    indoor: true,
    theme: 'home',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###########',
      '###########',
      'kk..VVVpFcc',
      '...........',
      '....ttt....',
      '....ttt....',
      '...........',
      'p..E......p',
    ],
    rugs: [[3, 3, 7, 6, '#c8a04a', '#f8e8c0']],
    wallDecor: { 2: 'clock' },
    signs: {
      '0,2': ['Kệ đầy hũ mứt quả mọng bà Tư tự làm.'],
      '1,2': ['Kệ đầy hũ mứt quả mọng bà Tư tự làm.'],
      ...Object.fromEntries([4, 5, 6].map((x) => [`${x},2`, ['TV đang chiếu phim hoạt hình Pokémon. Bé Na xem say sưa.']])),
    },
    entry: { x: 3, y: 6 },
  },

  lab: {
    name: 'Phòng thí nghiệm Pokémon',
    indoor: true,
    theme: 'lab',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '#############',
      '#############',
      'kkkk...d.kkkk',
      '.............',
      '....ddddd....',
      '.............',
      'MM.........MM',
      '.............',
      'kk.........kk',
      '.............',
      'p.....E.....p',
    ],
    // Ba Poké Ball đựng Pokémon khởi đầu trên bàn. Quả thứ tư đựng Pikachu nằm trên bàn nhỏ
    // sau lưng Giáo sư Oak, bên phải (chỉ chọn được sau khi đã xem và từ chối cả ba con kia)
    objects: [
      { x: 5, y: 4, kind: 'starter', species: 'bulbasaur' },
      { x: 6, y: 4, kind: 'starter', species: 'charmander' },
      { x: 7, y: 4, kind: 'starter', species: 'squirtle' },
      { x: 7, y: 2, kind: 'starter', species: 'pikachu' },
    ],
    entry: { x: 6, y: 9 },
    exit: { to: 'route1', x: 9, y: 15 },
  },

  center: {
    name: 'Pokémon Center',
    indoor: true,
    theme: 'center',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '#############',
      '#######mm####',
      '.............',
      'pcccccccccccp',
      '............P',
      '.bb.......bb.',
      '.............',
      '.............',
      '......E......',
    ],
    entry: { x: 6, y: 7 },
    exit: { to: 'route1', x: 6, y: 7 },
    heal: { x: 6, y: 4, facing: 'up' },
  },

  mart: {
    name: 'Poké Mart',
    indoor: true,
    theme: 'mart',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###########',
      '###########',
      '..kkk.kk.kk',
      'cck........',
      '...........',
      '.....kk.kk.',
      '.....kk.kk.',
      '...........',
      '.....kk.kk.',
      '...E......p',
    ],
    entry: { x: 3, y: 8 },
    exit: { to: 'route1', x: 12, y: 7 },
  },
};

// Pokémon Center / Poké Mart ở thị trấn khác: cùng nội thất, cửa ra dẫn về thị trấn đó
// (Thành phố Sông Nước có Trung tâm thương mại thay cho Poké Mart)
for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) {
  MAP_DEFS[`center${n}`] = { ...MAP_DEFS.center };
  if (n !== 5) MAP_DEFS[`mart${n}`] = { ...MAP_DEFS.mart };
}
// Pokémon Center / Poké Mart trong 8 làng nhỏ trước các thành phố có gym (data/mapsVillages.js)
for (let n = 1; n <= 8; n++) {
  MAP_DEFS[`vcenter${n}`] = { ...MAP_DEFS.center };
  MAP_DEFS[`vmart${n}`] = { ...MAP_DEFS.mart };
}
Object.assign(MAP_DEFS, CHAPTER2_MAPS, CHAPTER3_MAPS, CHAPTER4_MAPS, CHAPTER5_MAPS, VILLAGE_MAPS, VILLAGE_AREAS_A, VILLAGE_AREAS_B, GYM_MAPS);

// Cửa ra của mọi toà nhà: thảm trong nhà dẫn về ô ngay trước cửa ngoài thị trấn
for (const [id, def] of Object.entries(MAP_DEFS)) {
  for (const b of def.buildings ?? []) {
    if (b.to) MAP_DEFS[b.to].exit = { to: id, x: b.door.x, y: b.door.y + 1 };
  }
}

// Hoa lá trang trí: rải lác đác hoa (f) và bụi lá (h) trên ô cỏ thường của bản đồ ngoài trời, cố định theo toạ độ
// (lần nào chơi cũng như nhau). Chừa lối chuyển bản đồ, trước cửa nhà, quanh biển báo và đồ vật; bản đồ tuyết chỉ có bụi lá
// thưa. Bản đồ nào không muốn thì khai báo noDecor: true.
const decoHash = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function decorate(id, def) {
  if (def.indoor || def.cave || def.noDecor) return;
  const seed = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  const keep = new Set();
  const around = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) keep.add(`${x + dx},${y + dy}`);
  };
  for (const w of def.warps ?? []) around(w.x, w.y, 2);
  for (const b of def.buildings ?? []) around(b.door.x, b.door.y + 1, 1);
  for (const o of def.objects ?? []) around(o.x, o.y, 1);
  for (const key of Object.keys(def.signs ?? {})) around(...key.split(',').map(Number), 1);
  const [flowers, shrubs] = def.snow ? [0, 0.02] : [0.035, 0.06];
  def.rows = def.rows.map((row, y) => [...row].map((ch, x) => {
    if (ch !== '.' || keep.has(`${x},${y}`)) return ch;
    const h = decoHash(x, y, seed);
    return h < flowers ? 'f' : h < shrubs ? 'h' : ch;
  }).join(''));
}
for (const [id, def] of Object.entries(MAP_DEFS)) decorate(id, def);

class GameMap {
  constructor(id, def) {
    // areas / water: khu có Pokémon hoang dã
    Object.assign(this, { buildings: [], signs: {}, objects: [], areas: [], water: null, indoor: false }, def);
    // Vùng khí hậu quyết định thời tiết (gfx/ambience.js: CLIMATES): bản đồ tuyết là vùng tuyết, mặc định bình thường
    this.climate = def.climate ?? (def.snow ? 'snow' : 'normal');
    this.id = id;
    this.width = Math.max(...def.rows.map((r) => r.length));
    this.height = def.rows.length;
    // Cột đèn lồng và đèn đường đôi (Q): thắp sáng ban đêm (gfx/ambience.js)
    // Cột đèn lồng (l): hai đèn treo trên xà; trong nhà / hang thì chỉ là một ô đèn
    this.lanterns = def.indoor || def.cave
      ? def.rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === 'l' ? [{ x, y }] : [])))
      : lanternPoleLights(def.rows);
    if (def.lanternGarlands) this.lanterns.push(...garlandLights(def.rows, def.buildings ?? []));
    if (!def.indoor && !def.cave) this.lanterns.push(...streetLampLights(def.rows));
  }

  // Ngoài bản đồ hoặc ký tự lạ thì coi như ô cản (cây / tường)
  tileAt(x, y) {
    const ch = this.rows[y]?.[x];
    return ch && this.tiles[ch] ? ch : this.fallback;
  }

  info(x, y) {
    const ch = this.tileAt(x, y);
    return this.cleared ? this.calmTiles()[ch] : this.tiles[ch];
  }

  // Gym đã có huy hiệu (cleared, WorldScene đặt khi vào gym / thắng thủ lĩnh): câu đố ngừng hoạt động.
  // Than hồng / xoáy nước thành ô cản, miệng lò tắt, hố coi như đã lấp, băng hết trơn, gió tắt (windy)
  calmTiles() {
    this.calm ??= Object.fromEntries(Object.entries(this.tiles).map(([ch, t]) => {
      const { trap, vent, hole, ice, push, ...rest } = t;
      if (trap) return [ch, { ...rest, solid: true }];
      if (hole) return [ch, { ...rest, solid: false }];
      if (push && !this.windy) return [ch, t];
      return [ch, rest];
    }));
    return this.calm;
  }

  buildingAt(x, y) {
    return this.buildings.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
  }

  warpAt(x, y) {
    return this.warps?.find((w) => w.x === x && w.y === y) ?? null;
  }

  doorAt(x, y) {
    return this.buildings.find((b) => b.door.x === x && b.door.y === y) ?? null;
  }

  isSolid(x, y) {
    return Boolean(this.info(x, y).solid || this.buildingAt(x, y));
  }

  signAt(x, y) {
    return this.signs[`${x},${y}`] ?? null;
  }

  // Khu bụi cỏ chứa ô (x, y), hoặc null
  areaAt(x, y) {
    return this.areas.find(({ rect: [x1, y1, x2, y2] }) => x >= x1 && x <= x2 && y >= y1 && y <= y2) ?? null;
  }

  // Lối ra bị chặn khi chưa có huy hiệu (gates: [{ rect, badge }])
  gateAt(x, y) {
    return this.gates?.find(({ rect: [x1, y1, x2, y2] }) => x >= x1 && x <= x2 && y >= y1 && y <= y2) ?? null;
  }

  objectAt(x, y) {
    return this.objects.find((o) => o.x === x && o.y === y) ?? null;
  }

  // Ô dịch chuyển trong gym (pads: [{ x, y, tx, ty }])
  // clearedPads: ô dịch chuyển đổi đích khi gym đã có huy hiệu
  padAt(x, y) {
    const at = (p) => p.x === x && p.y === y;
    return (this.cleared && this.clearedPads?.find(at)) || this.pads?.find(at) || null;
  }
}

export const MAPS = Object.fromEntries(Object.entries(MAP_DEFS).map(([id, def]) => [id, new GameMap(id, def)]));

// Chơi mới: thức dậy cạnh giường trong phòng ngủ trên tầng 2
export const SPAWN = { map: 'home2f', x: 1, y: 3, facing: 'down' };
// Chỗ đứng khi tải bản lưu (Tiếp tục). Bản đồ trong bản lưu không còn (bản cũ): về điểm bắt đầu.
// Bản đồ trong nhà đã sửa (nhà cũ 1 tầng thành 2 tầng) mà chỗ đứng giờ là đồ đạc: về chỗ đứng ở cửa vào.
// Chỉ xét trong nhà: ngoài trời ô "cản" có thể là mặt nước khi đang lướt nước (WorldScene tự đặt lại khối nước / thú cưỡi)
export function resumePosition(position) {
  const map = MAPS[position.map];
  if (!map) return SPAWN;
  if (map.indoor && map.isSolid(position.x, position.y)) return map.entry ? { ...position, ...map.entry } : SPAWN;
  // Ngoài trời: bản đồ đã vẽ lại (vd Pallet thu nhỏ) mà chỗ đứng cũ giờ là cây / ngoài bản đồ thì về ô đi được gần nhất.
  // Đang lướt nước trên ô nước thì giữ nguyên.
  const swimming = ['surf', 'waterRide'].includes(position.vehicle) && map.tileAt(position.x, position.y) === 'w';
  if (!map.indoor && !swimming && map.isSolid(position.x, position.y)) {
    return { ...position, ...nearestOpen(map, position), vehicle: null, mount: null };
  }
  return position;
}

// Ô đi được (không cản, không phải lối chuyển bản đồ / bụi cỏ) gần (x, y) nhất
function nearestOpen(map, { x, y }) {
  let best = null;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (map.isSolid(tx, ty) || map.warpAt(tx, ty) || map.info(tx, ty).encounter) continue;
      const d = Math.abs(tx - x) + Math.abs(ty - y);
      if (!best || d < best.d) best = { x: tx, y: ty, d };
    }
  }
  return { x: best.x, y: best.y };
}

// Thua trận thì tỉnh dậy trong Pokémon Center, trước mặt Y tá Joy
export const HEAL_RESPAWN = { map: 'center', ...MAP_DEFS.center.heal, healer: 'Y tá Joy' };
// Chưa ghé Pokémon Center nào thì thua trận tỉnh dậy ở nhà, đứng trước sofa mẹ đang ngồi (story/chapter1.js: mom)
export const HOME_RESPAWN = { map: 'home', x: 7, y: 3, facing: 'down', healer: 'Mẹ' };
