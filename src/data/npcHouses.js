import { SPECIES } from './monsters.js';
import { INDOOR_TILES } from './tiles.js';

// Nhà dân vào được: mọi nhà trên bản đồ ngoài trời chưa có nội thất (type 'house', to: null) được dựng sẵn một căn phòng
// (3 kiểu, chọn cố định theo vị trí nhà) và người ở. Lác đác vài nhà vẫn khoá cửa (gõ cửa: không có ai ở nhà).
// Nhà gắn với nhiệm vụ làng (story/villages.js: houseKnock) giữ nguyên, không dựng phòng.
// Mỗi nhà một chủ nhà (HOUSE_RESIDENTS, WorldScene gộp vào danh sách NPC; nói chuyện: story/residents.js), theo tỉ lệ:
//  nói chuyện (nhiều) • tặng quà (vừa, một lần) • thách đấu (ít) • muốn đổi Pokémon (ít, một lần)
// Có nhà thêm 1-2 người nhà (chỉ nói chuyện), hoặc có một Pokémon nuôi đi lại trong nhà (OCCUPANCY)
// Mọi thứ chọn theo vị trí nhà (băm), lần nào chơi cũng như nhau.

export const HOUSE_RESIDENTS = [];

const LOCKED_RATE = 0.08;
const KINDS = [['chat', 0.55], ['gift', 0.8], ['battle', 0.9], ['trade', 1]];
// Số người trong nhà: chỉ chủ nhà • thêm 1 người nhà • thêm 2 người nhà • chủ nhà và một Pokémon nuôi đi lại trong nhà
const OCCUPANCY = [['alone', 0.45], ['two', 0.68], ['three', 0.8], ['pet', 1]];

// Cửa nhà gắn với nhiệm vụ làng: không dựng phòng (story/villages.js)
const STORY_DOORS = new Set([
  'village1:19,15', 'village2:11,7', 'field2:4,5', 'village4:4,16', 'village5:4,16', 'village7:13,5',
]);

// Ba kiểu phòng một tầng (theme 'home', gfx/interior.js): cửa ra (E) ở hàng dưới cùng, chỗ đứng của người ở
const TEMPLATES = [
  {
    rows: ['###########', '###########', 'kk..VVVpFcc', '...........', '....ttt....', '....ttt....', '...........', 'p..E......p'],
    rug: [3, 3, 7, 6], wallDecor: { 2: 'clock' }, tv: [4, 5, 6], spot: { x: 8, y: 4, facing: 'left' },
    extras: [{ x: 2, y: 4, facing: 'right' }, { x: 7, y: 6, facing: 'up' }], pet: { x: 7, y: 3 },
  },
  {
    rows: ['###########', '###########', 'FcckVVV..pp', '...........', '...[ttt]...', '...[ttt]...', '...........', 'p..E......p'],
    rug: [2, 3, 8, 6], wallDecor: { 5: 'photo', 8: 'clock' }, tv: [4, 5, 6], spot: { x: 8, y: 3, facing: 'down' },
    extras: [{ x: 2, y: 4, facing: 'right' }, { x: 8, y: 5, facing: 'left' }], pet: { x: 6, y: 6 },
  },
  {
    rows: ['###########', '###########', 'Bkw.VVV..pk', 'B..........', '...........', '...........', '...........', 'p..E......p'],
    rug: [3, 3, 7, 5], wallDecor: { 3: 'poster', 7: 'calendar' }, tv: [4, 5, 6], spot: { x: 6, y: 4, facing: 'down' },
    extras: [{ x: 8, y: 3, facing: 'down' }, { x: 2, y: 5, facing: 'right' }], pet: { x: 8, y: 6 },
  },
];
const RUG_COLORS = [['#c8604a', '#f0d8a8'], ['#4a78c8', '#f0e0b0'], ['#6aa860', '#f0e8c0'], ['#a060b0', '#f0e0f0'], ['#c8a04a', '#f8e8c0']];
const BED_COLORS = ['#d04848', '#4a78c8', '#58a858', '#e8a030'];
const TV_LINES = [
  'TV đang chiếu phim hoạt hình Pokémon.', 'TV đang chiếu trận đấu Liên minh Pokémon.', 'TV đang chiếu dự báo thời tiết vùng Sơn Thủy.',
  'TV đang chiếu chương trình nấu ăn với quả mọng.', 'TV đang chiếu phim tài liệu về Pokémon hoang dã.',
];

// Người ở: hình, tên theo hình
// Tên theo hình; mỗi tên chỉ dùng cho một người trong cả vùng (furnishHouses chọn tên chưa ai dùng)
const PEOPLE = {
  'npc-oldman': ['Ông Ba', 'Ông Tư', 'Ông Sáu', 'Ông Bảy', 'Ông Khải', 'Ông Lộc', 'Ông Thọ', 'Ông Phúc', 'Ông Đức', 'Ông Hiền'],
  'npc-woman': ['Cô Lan', 'Cô Hoa', 'Dì Năm', 'Cô Mận', 'Cô Huệ', 'Dì Út', 'Cô Thắm', 'Cô Liên', 'Dì Sáu', 'Cô Nhung'],
  'npc-hiker': ['Bác Tám', 'Chú Hùng', 'Bác Sơn', 'Chú Mạnh', 'Bác Cường', 'Chú Thạch', 'Bác Kiên', 'Chú Lực'],
  'npc-lass': ['Chị Thảo', 'Chị My', 'Chị Vy', 'Chị Trang', 'Chị Hằng', 'Chị Quyên', 'Chị Ngân', 'Chị Diễm'],
  'npc-girl': ['Bé Bông', 'Bé Mít', 'Bé Ngọc', 'Bé Na', 'Bé Su', 'Bé Thỏ', 'Bé Mây', 'Bé Chíp'],
  'npc-boy': ['Bé Bin', 'Cu Tý', 'Bé Khoa', 'Cu Tèo', 'Bé Bo', 'Cu Bi', 'Bé Đức', 'Cu Mập'],
  'npc-youngster': ['Anh Tuấn', 'Anh Phát', 'Anh Khang', 'Anh Hiếu', 'Anh Nam', 'Anh Toàn', 'Anh Vũ'],
  'npc-camper': ['Anh Lộc', 'Anh Dũng', 'Anh Quân', 'Anh Thịnh', 'Anh Sang', 'Anh Hải', 'Anh Đạt'],
  'npc-fisher': ['Chú Tư', 'Bác Năm', 'Chú Bảy Cá', 'Bác Lưới', 'Chú Câu', 'Bác Sông'],
};
const usedNames = new Set();
// Tên chưa ai dùng trong bộ tên của hình đó (bắt đầu từ vị trí r), hết tên thì thêm số
function freshName(sprite, r) {
  const list = PEOPLE[sprite];
  const start = Math.floor(r * list.length);
  for (let i = 0; i < list.length; i++) {
    const n = list[(start + i) % list.length];
    if (!usedNames.has(n)) {
      usedNames.add(n);
      return n;
    }
  }
  const n = `${list[start]} ${usedNames.size}`;
  usedNames.add(n);
  return n;
}

// Nhà đặc biệt: người ở và việc của họ đặt sẵn (không băm). Lão Ma Mãnh ở Bản Vách Đá (nơi có Machoke) muốn đổi
// Machoke của bạn lấy Haunter... đang cầm Everstone: Machoke về tay lão là tiến hoá thành Machamp ngay, còn Haunter của bạn
// thì không tiến hoá được. Một màn "lừa" kinh điển (story/residents.js: troll)
const SPECIAL_HOUSES = {
  'village6:20,15': {
    sprite: 'npc-oldman', name: 'Lão Ma Mãnh', occupancy: 'alone',
    resident: { kind: 'trade', trade: { want: 'machoke', give: 'haunter', nickname: 'Bóng Ma', item: 'everstone', troll: true } },
  },
};
// Người thách đấu là người đi phiêu lưu; còn lại ai cũng được
const BATTLERS = ['npc-youngster', 'npc-camper', 'npc-lass', 'npc-hiker'];
// Người nhà nói chuyện
const FAMILY_LINES = [
  ['Khách nhà mình đấy à? Ngồi chơi đã!'],
  ['Ở nhà buồn quá, em chỉ mong lớn nhanh để được đi phiêu lưu như anh chị.'],
  ['Cả nhà đang xem TV. Trận đấu hôm nay hấp dẫn lắm!'],
  ['Nhà tôi ai cũng mê Pokémon, cứ tối đến là kể chuyện Pokémon cho nhau nghe.'],
  ['Hôm qua tôi thấy một con Pokémon lạ chạy ngang qua sân, chưa kịp nhìn rõ.'],
  ['Mẹ em nấu canh quả mọng ngon lắm, anh chị ở lại ăn cơm không?'],
  ['Đi đường cẩn thận nhé, ngoài kia nhiều bụi cỏ cao lắm.'],
  ['Tôi đang tập nuôi Pokémon, khó hơn tôi tưởng nhiều!'],
];
// Pokémon nuôi trong nhà và câu tả khi nói chuyện với nó
const PETS = ['meowth', 'growlithe', 'pikachu', 'clefairy', 'jigglypuff', 'eevee', 'psyduck', 'slowpoke', 'vulpix', 'poliwag', 'oddish', 'pidgey'];
const PET_LINES = [
  (n) => [`${n} chạy lại dụi đầu vào chân bạn.`],
  (n) => [`${n} kêu lên vui vẻ rồi chạy một vòng quanh phòng!`],
  (n) => [`${n} nhìn bạn tò mò.`],
  (n) => [`${n} đang ngáp dài, có vẻ buồn ngủ.`],
];

// Băm chuỗi -> [0, 1)
export function houseHash(text, salt = 0) {
  let h = 2166136261 ^ salt;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

// Dựng phòng + người ở cho các nhà chưa có nội thất. Gọi một lần lúc nạp bản đồ (data/map.js), trước khi nối cửa ra
export function furnishHouses(MAP_DEFS) {
  for (const [mapId, def] of Object.entries(MAP_DEFS)) {
    if (def.indoor) continue;
    for (const b of def.buildings ?? []) {
      if (b.type !== 'house' || b.to || b.locked) continue;
      const key = `${mapId}:${b.door.x},${b.door.y}`;
      const special = SPECIAL_HOUSES[key];
      if (STORY_DOORS.has(key) || (!special && houseHash(key, 1) < LOCKED_RATE)) continue;
      const id = `nh-${mapId}-${b.door.x}-${b.door.y}`;
      const tpl = pick(TEMPLATES, houseHash(key, 2));
      const kindRoll = houseHash(key, 3);
      const kind = KINDS.find(([, upTo]) => kindRoll < upTo)[0];
      const sprite = special?.sprite ?? (kind === 'battle' ? pick(BATTLERS, houseHash(key, 4)) : pick(Object.keys(PEOPLE), houseHash(key, 4)));
      const name = special?.name ?? freshName(sprite, houseHash(key, 5));
      if (special) usedNames.add(name);
      const [rug, edge] = pick(RUG_COLORS, houseHash(key, 6));
      MAP_DEFS[id] = {
        name: `Nhà ${name}`,
        indoor: true,
        theme: 'home',
        tiles: INDOOR_TILES,
        fallback: '#',
        rows: tpl.rows,
        rugs: [[...tpl.rug, rug, edge]],
        wallDecor: tpl.wallDecor,
        bedColor: pick(BED_COLORS, houseHash(key, 7)),
        signs: Object.fromEntries(tpl.tv.map((x) => [`${x},2`, [pick(TV_LINES, houseHash(key, 8))]])),
        entry: { x: 3, y: tpl.rows.length - 2 },
      };
      b.to = id;
      HOUSE_RESIDENTS.push({
        id: `res-${id}`, sprite, name, map: id, ...tpl.spot, fixed: true,
        resident: special?.resident ?? { kind, seed: houseHash(key, 9), seed2: houseHash(key, 10) },
      });
      // Người nhà / Pokémon nuôi
      const occRoll = houseHash(key, 11);
      const occupancy = special?.occupancy ?? OCCUPANCY.find(([, upTo]) => occRoll < upTo)[0];
      const extras = { alone: 0, two: 1, three: 2, pet: 0 }[occupancy];
      const used = new Set([name]);
      for (let i = 0; i < extras; i++) {
        const s = pick(Object.keys(PEOPLE), houseHash(key, 20 + i));
        const n = freshName(s, houseHash(key, 25 + i));
        used.add(n);
        HOUSE_RESIDENTS.push({
          id: `res-${id}-${i + 2}`, sprite: s, name: n, map: id, ...tpl.extras[i], fixed: true,
          lines: pick(FAMILY_LINES, houseHash(key, 30 + i)),
        });
      }
      if (occupancy === 'pet') {
        const mon = pick(PETS.filter((p) => SPECIES[p]), houseHash(key, 40));
        const petName = SPECIES[mon].name;
        HOUSE_RESIDENTS.push({
          id: `res-${id}-pet`, mon, name: petName, map: id, ...tpl.pet, facing: 'down', wander: 2,
          lines: pick(PET_LINES, houseHash(key, 41))(petName),
        });
      }
    }
  }
}
