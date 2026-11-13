// Ký tự ô trên bản đồ và tính chất của từng loại ô
//  Ngoài trời: T cây (khối 2x2, toạ độ chẵn) • . cỏ • f hoa • g cỏ cao • G cỏ rậm • w nước • = đường • s biển báo
//              R vách đá • C cửa hang • p ruộng lúa • l cột đèn lồng • b cầu gỗ
//              K lò gốm • j chum gốm • L ao sen • n cây thông phủ tuyết • d cát (cồn cát giữa sông / hồ) • h bụi lá
//              H hàng rào gỗ (cản đường, tự nối với ô hàng rào bên cạnh)
//              v < > gờ đất (ledge) như game gốc: đi tới đúng chiều dốc (v xuống, < sang trái, > sang phải) thì nhảy qua
//                    đáp xuống ô bên kia; chiều ngược lại / đi dọc gờ thì bị chặn • J góc gờ chữ L (cản đường)
//              Đồ trang trí (gfx/decor.js): a sân đất nện (đi được, mép lượn mềm vào cỏ) • u thùng rác • k gốc cây
//              Q đèn đường đôi (sáng ban đêm) • P bồn hoa (nối liền theo hàng ngang) • e bờ cây xén thấp (tự nối ô bên cạnh)
//              E ghế công viên (2 ô ngang: EE) • X khúc gỗ đổ (2 ô ngang: XX) • O cây tán tròn (khối 2x2 như cây T)
//              Y cây hoa anh đào lớn: ký tự đặt ở gốc (chỉ gốc là ô cản), tán hồng rộng 3x3 phủ các ô phía trên gốc
//              (đi được bên dưới tán, tán vẽ đè lên nhân vật) • ô dưới tán phải là ô cỏ thường
//  Trong nhà:  # tường • . sàn • c quầy • m máy hồi phục • p chậu cây • P máy tính • b ghế • k kệ
//              E thảm cửa ra • B giường • V TV • t bàn • d bàn thí nghiệm • M máy thí nghiệm
//              o cột đá • v ^ < > ô gió / dòng nước đẩy người chơi theo hướng mũi tên (gym)
//              H hàng rào tre • Z tường điện • x than hồng / xoáy nước (bị đưa về lối vào) • Q ô dịch chuyển • i sàn băng (trượt)
//              K lò gốm • ~ nước sâu • O hố (lấp bằng tảng đá) • X Y miệng phun lửa thay phiên (gym)
//              D cửa lớn giữa các phòng Liên minh
//              S cầu thang lên • s cầu thang xuống (nhà 2 tầng: bước lên là sang tầng kia, xem warps của bản đồ)
//              [ ] ghế sofa (lưng tựa bên trái / bên phải, ngồi quay mặt vào giữa) • F tủ lạnh • w bàn học
//  Trong hang: # vách hang • . nền hang (có Pokémon hoang dã) • o tảng đá • C cửa hang
//              w nước ngầm (hồ / suối trong hang): đi bộ thì cản, lướt nước (Surf / Lapras) và câu cá được như ngoài trời
//              (bảng Pokémon dưới nước: `water` của bản đồ hang)

export const OUTDOOR_TILES = {
  T: { solid: true },
  '.': {},
  f: {},
  g: { encounter: 'meadow' },
  G: { encounter: 'deep' },
  w: { solid: true },
  '=': {},
  s: { solid: true },
  R: { solid: true },
  C: {},
  p: { solid: true },
  l: { solid: true },
  b: {},
  K: { solid: true },
  j: { solid: true },
  L: { solid: true },
  n: { solid: true },
  d: {},
  h: {},
  H: { solid: true },
  v: { solid: true, ledge: 'down' },
  '<': { solid: true, ledge: 'left' },
  '>': { solid: true, ledge: 'right' },
  J: { solid: true, ledgeCorner: true },
  a: {},
  u: { solid: true },
  k: { solid: true },
  Q: { solid: true },
  P: { solid: true },
  e: { solid: true },
  E: { solid: true },
  X: { solid: true },
  O: { solid: true },
  Y: { solid: true },
};

// Đồ trang trí nhiều ô cùng một ký tự: [rộng, cao]. Ghép khối theo thứ tự đọc (trái sang phải, trên xuống dưới):
// ô chưa thuộc khối nào là góc trên bên trái của một khối mới (vd 'EEEE' là hai ghế đặt sát nhau)
export const DECOR_BLOCKS = { E: [2, 1], X: [2, 1], O: [2, 2] };
// Tán cây hoa anh đào (Y) so với gốc: các cột x-1..x+1, các hàng y-3..y-1
export const BLOSSOM_CANOPY = { x0: -1, x1: 1, y0: -3, y1: -1 };
// Ký tự đồ trang trí (để kiểm tra / vẽ nền đất bên dưới)
export const DECOR_CHARS = 'aukQPeEXOY';

// Tìm các khối đồ trang trí nhiều ô trên bản đồ (rows: mảng chuỗi): [{ ch, x, y, w, h }]
export function decorBlocks(rows) {
  const taken = new Set();
  const out = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const size = DECOR_BLOCKS[ch];
      if (!size || taken.has(`${x},${y}`)) return;
      const [w, h] = size;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) taken.add(`${x + i},${y + j}`);
      out.push({ ch, x, y, w, h });
    });
  });
  return out;
}

// Cột đèn lồng (l): cột gỗ cao ~2.5 ô, hai đèn lồng treo hai bên xà ngang (gfx/decor.js: lanternPoleSprite).
// Quầng sáng ban đêm đặt đúng hai chiếc đèn (toạ độ ô, có phần lẻ)
export const LANTERN_HANG = { dx: 0.28, dy: 1.06 };
export function lanternPoleLights(rows) {
  return rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === 'l'
    ? [{ x: x - LANTERN_HANG.dx, y: y - LANTERN_HANG.dy }, { x: x + LANTERN_HANG.dx, y: y - LANTERN_HANG.dy }]
    : [])));
}

// Dây đèn lồng giăng giữa hai cột đèn lồng liền nhau trên cùng một hàng (bản đồ khai báo lanternGarlands: true, vd Thành phố
// Đèn Lồng): cách nhau 2-8 ô, giữa hai cột không có nhà. Trả về [{ x1, x2, y }] (toạ độ ô của hai cột)
export const GARLAND_MAX = 8;
export function lanternGarlands(rows, buildings = []) {
  const blocked = (x, y) => buildings.some((b) => x >= b.x && x < b.x + b.w && y - 2 >= b.y && y - 2 < b.y + b.h);
  const out = [];
  rows.forEach((r, y) => {
    const posts = [...r].flatMap((ch, x) => (ch === 'l' ? [x] : []));
    for (let i = 1; i < posts.length; i++) {
      const [x1, x2] = [posts[i - 1], posts[i]];
      if (x2 - x1 < 2 || x2 - x1 > GARLAND_MAX) continue;
      let clear = true;
      for (let x = x1; x <= x2 && clear; x++) clear = !blocked(x, y);
      if (clear) out.push({ x1, x2, y });
    }
  });
  return out;
}
// Dây và các đèn lồng nhỏ trên dây, toạ độ điểm ảnh / 16 (cx, cy: tâm đèn; sy: điểm dây ngay trên đèn). Dây nối hai đầu xà
// của hai cột (cao hơn gốc cột 17px), võng xuống giữa; đèn treo dưới dây 5px, cách nhau ~0.8 ô
export const GARLAND_SAG = 0.4;
export function garlandLanterns({ x1, x2, y }) {
  const n = Math.max(1, Math.round((x2 - x1) / 0.8) - 1);
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / (n + 1);
    const sy = y - 17 / 16 + Math.sin(t * Math.PI) * GARLAND_SAG;
    return { cx: x1 + 0.5 + (x2 - x1) * t, cy: sy + 5 / 16, sy, i };
  });
}
// Quầng sáng ban đêm của đèn trên dây (ambience: tâm quầng ở (x * 16 + 8, y * 16 + 7)), nhỏ hơn đèn cột
export function garlandLights(rows, buildings) {
  return lanternGarlands(rows, buildings).flatMap((g) => garlandLanterns(g).map(({ cx, cy }) => ({ x: cx - 0.5, y: cy - 7 / 16, small: true })));
}

// Vị trí quầng sáng ban đêm của đèn đường đôi Q (hai bóng đèn trên đỉnh cột, cao hơn ô gốc ~1.5 ô): toạ độ ô, có phần lẻ
export function streetLampLights(rows) {
  return rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === 'Q' ? [{ x: x - 0.3, y: y - 1.55 }, { x: x + 0.3, y: y - 1.55 }] : [])));
}

export const INDOOR_TILES = {
  '#': { solid: true },
  '.': {},
  c: { solid: true, counter: true },
  m: { solid: true },
  p: { solid: true },
  P: { solid: true },
  b: { solid: true },
  k: { solid: true },
  E: { exit: true },
  B: { solid: true },
  V: { solid: true },
  t: { solid: true, counter: true },
  d: { solid: true, counter: true },
  M: { solid: true },
  o: { solid: true },
  H: { solid: true },
  Z: { solid: true },
  v: { push: 'down' },
  '^': { push: 'up' },
  '<': { push: 'left' },
  '>': { push: 'right' },
  x: { trap: true },
  '~': { solid: true }, // nước sâu (gym Sông Nước)
  O: { solid: true, hole: true }, // hố (gym Núi Đá): đẩy tảng đá xuống lấp thì đi được
  X: { vent: 0 }, // miệng phun lửa nhóm 0 / 1 (gym Lò Gốm): thay phiên phụt lửa theo nhịp
  Y: { vent: 1 },
  Q: {},
  i: { ice: true },
  K: { solid: true },
  D: {},
  S: { stairs: 'up' },
  s: { stairs: 'down' },
  '[': { solid: true, sofa: 'right' },
  ']': { solid: true, sofa: 'left' },
  F: { solid: true },
  w: { solid: true },
};

export const CAVE_TILES = {
  '#': { solid: true },
  '.': { encounter: 'cave' },
  o: { solid: true },
  C: {},
  L: {}, // hố có thang xuống tầng dưới (ô chuyển bản đồ)
  U: {}, // thang lên tầng trên (ô chuyển bản đồ)
  w: { solid: true }, // nước ngầm: không có Pokémon khi đi bộ, lướt nước thì gặp theo bảng water.surf
};
