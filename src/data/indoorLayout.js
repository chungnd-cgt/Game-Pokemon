import { widen } from './widen.js';

// Phòng trong nhà kín màn hình: game cao 15 ô, rộng tới 35 ô (màn 21:9). Mỗi phòng giữ nguyên bố cục cũ (quầy, đồ đạc,
// chỗ đứng của người trong phòng) làm khu giữa, lúc nạp được xây thêm hai cánh trái / phải và phần phía dưới cho thành
// phòng 35 x 15 (data/widen.js). Thảm cửa ra dời xuống tường dưới cùng.
// Người / đồ vật trong phòng khai báo toạ độ theo bố cục cũ rồi cộng phần dịch của loại phòng (HOME_DX, CENTER_DX...).
//
// Cánh phòng vẽ sẵn rộng 12 ô, từ hàng 2 (sát tường sau) tới hàng 14 (tường dưới). Phòng cần cánh hẹp hơn thì bỏ bớt cột
// phía ngoài cùng. Ký tự ô: xem data/tiles.js (B giường 2 ô dọc đầu sát tường, [ ] sofa, w bàn học sát tường, k kệ,
// t bàn, b ghế băng, P máy tính, d bàn thí nghiệm, M máy thí nghiệm, p chậu cây)

export const ROOM_W = 35;
export const ROOM_H = 15;

const MIRROR = { '[': ']', ']': '[', '<': '>', '>': '<' };
const mirror = (row) => [...row].reverse().map((c) => MIRROR[c] ?? c).join('');

// Nhà ở: mỗi cánh chia hai phòng bằng vách ngăn ngang có lối đi giữa. Cánh trái: phòng ngủ trên (2 giường, kệ sách, vách
// dọc ngăn với phòng khách), phòng ngủ dưới (giường sát vách, kệ, bàn học). Cánh phải: phòng học trên (bàn học, kệ,
// giường), góc bếp dưới (tủ lạnh, quầy bếp, kệ). Không có TV / bàn / sofa (TV, bàn nước, thảm chỉ ở phòng khách giữa)
const HOME_LEFT = [
  'p.B.kkk.B..#',
  '..B.....B..#',
  '...........#',
  '............',
  '.k.......p..',
  '#####..#####',
  '#####..#####',
  'B.kk...w...B',
  'B..........B',
  '............',
  '.p........p.',
  '............',
  'p...........',
];
const HOME_RIGHT = [
  '#..w.kk..B.p',
  '#........B..',
  '#...........',
  '............',
  '..p.......k.',
  '#####..#####',
  '#####..#####',
  'k.Fcc...kk.p',
  '............',
  '............',
  '.p........p.',
  '............',
  '...........p',
];

// Pokémon Center: cánh trái là góc nghỉ (kệ sách, bàn trà có ghế, dãy ghế chờ), cánh phải là góc máy tính lưu trữ
// (thêm máy tính sát tường) và kệ sách, dãy ghế chờ
const CENTER_LEFT = [
  '.p.kk.kk.kk.',
  '............',
  '..bb....bb..',
  '..tt....tt..',
  '..bb....bb..',
  '............',
  '.p........p.',
  '............',
  '..bbb..bbb..',
  '............',
  '..bbb..bbb..',
  '............',
  '.p..........',
];
const CENTER_RIGHT = [
  '.P.P.P..kkp.',
  '............',
  '..kk....kk..',
  '............',
  '..kk....kk..',
  '............',
  '.p........p.',
  '............',
  '..bbb..bbb..',
  '............',
  '..bbb..bbb..',
  '............',
  '..........p.',
];

// Cửa hàng: các dãy kệ hàng có lối đi giữa, chậu cây
const MART_LEFT = [
  'kk.kkk.kkk..',
  '............',
  '.kk.kk.kk...',
  '.kk.kk.kk...',
  '............',
  '.kk.kk.kk...',
  '.kk.kk.kk...',
  '............',
  '.p.......p..',
  '............',
  '.kk.kk.kk...',
  '............',
  'p...........',
];

// Phòng thí nghiệm: kệ tài liệu, máy thí nghiệm, các dãy bàn thí nghiệm
const LAB_LEFT = [
  '.p.kkk.MM.kk',
  '............',
  '..ddd...ddd.',
  '............',
  '..MM....MM..',
  '............',
  '..ddd...ddd.',
  '............',
  '.p........p.',
  '............',
  '..kk....kk..',
  '............',
  '.p..........',
];

const WINGS = {
  home: [HOME_LEFT, HOME_RIGHT],
  center: [CENTER_LEFT, CENTER_RIGHT],
  mart: [MART_LEFT, MART_LEFT.map(mirror)],
  lab: [LAB_LEFT, LAB_LEFT.map(mirror)],
};

// Phần dưới khu giữa (rộng bằng phòng cũ): sàn trống, chậu cây hai đầu hàng cuối (thảm cửa ra đặt sau, widen exitDown);
// cửa hàng thêm một dãy kệ, phòng thí nghiệm thêm chậu cây
function middleRow(kind, y, w) {
  if (y === ROOM_H - 1) return `p${'.'.repeat(w - 2)}p`;
  if (kind === 'mart' && y === 11 && w >= 11) return `.${'.'.repeat(w - 11)}....kk.kk.`;
  if ((kind === 'lab' || kind === 'center') && y === 12) return `.p${'.'.repeat(w - 4)}p.`;
  return '.'.repeat(w);
}

// Nới phòng def (bố cục cũ rộng w, cao h) thành phòng ROOM_W x ROOM_H theo kiểu phòng kind ('home' | 'center' | 'mart' |
// 'lab'): left / right là số cột thêm mỗi bên (mặc định chia đều), thảm cửa ra dời xuống hàng cuối
export function roomy(def, kind, left = Math.floor((ROOM_W - def.rows[0].length) / 2)) {
  const w = def.rows[0].length;
  const right = ROOM_W - w - left;
  const [L, R] = WINGS[kind];
  const side = (x, y, edge) => (edge === 'left' ? L[y - 2].slice(12 - left)[x] : R[y - 2].slice(0, right)[x]);
  const bottomRow = (y) => L[y - 2].slice(12 - left) + middleRow(kind, y, w) + R[y - 2].slice(0, right);
  // Nhà ở: thêm tấm thảm thứ hai (cùng màu) cho khoảng sàn phía dưới, thẳng hàng với TV như thảm phòng khách
  const tv = def.rows.flatMap((r) => [...r].flatMap((ch, x) => (ch === 'V' ? [x] : [])));
  let { rugs } = def;
  if (kind === 'home' && tv.length && rugs?.length && def.rows.length <= 9) {
    const mid = (Math.min(...tv) + Math.max(...tv)) / 2;
    rugs = [...rugs, [mid - 2, 9, mid + 2, 12, ...rugs[0].slice(4)]];
  }
  return widen({ ...def, rugs }, { left, right, bottom: ROOM_H - def.rows.length, side, bottomRow, exitDown: true });
}

// Phần dịch sang phải của từng loại phòng (toạ độ người / vật khai báo theo bố cục cũ cộng thêm)
export const HOME_DX = 12; // nhà ở 11 ô
export const CENTER_DX = 11; // Pokémon Center 13 ô
export const MART_DX = 12; // Poké Mart, tiệm xe đạp 11 ô
export const LAB_DX = 11; // phòng thí nghiệm Oak 13 ô
export const FOSSIL_DX = 12; // viện hoá thạch 11 ô
export const STORE_DX = 10; // trung tâm thương mại 15 ô
export const SAFARI_DX = 10; // nhà Safari 14 ô (bên phải thêm 11)
