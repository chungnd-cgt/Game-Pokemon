import { BERRY_IDS, ITEMS } from '../data/items.js';
import { PixelBuffer, addCanvasTexture, hash, hexToHsl, shadeHex } from './pixel.js';

// Hình quả mọng (biểu tượng trong túi) và cây quả mọng trên bản đồ, pixel art kiểu Gen 5.
// Cây là bụi lá trồng trên luống đất xới (kiểu Gen 3), quả to rõ màu; sau khi hái cây đi qua các giai đoạn
// lá non -> ra hoa -> quả xanh -> quả chín (xem berryStage ở game/berries.js).

// Bảng màu lá: mỗi loại cây lấy một bảng theo tên để cây trong vườn trông khác nhau (đều là xanh lá đậm vừa,
// để quả màu vàng / hồng / tím nổi rõ trên tán)
const LEAVES = [
  { light: '#82cc62', base: '#44a040', dark: '#28702c' },
  { light: '#8cc472', base: '#4c9046', dark: '#2f6230' },
  { light: '#70c07a', base: '#35924e', dark: '#206436' },
];
const DEEP_LEAVES = { light: '#579a70', base: '#2e6a4a', dark: '#1b4632' };
const TRUNK = { base: '#8a5a32', dark: '#5a3820' };
const SOIL = {
  rim: '#341e0e', rimTop: '#4a2e18', lip: '#7a5232', front: '#462a16',
  base: '#5c3a20', ridge: '#704a2a', groove: '#462a16', clod: '#82603e',
};

const shapeOf = (id) => Math.floor(hash(id.length, id.charCodeAt(0)) * 3);
const leavesOf = (id) => LEAVES[Math.floor(hash(id.charCodeAt(1), id.length, 3) * LEAVES.length)];

// Quả 16x16: thân tròn / dài / dẹt tuỳ loại, có cuống lá và đốm sáng
function drawBerryIcon(color, shape) {
  const p = new PixelBuffer(16, 16);
  const [rx, ry, cy] = [[5.5, 5.5, 9.5], [4.5, 6, 9.5], [6.5, 4.5, 10]][shape];
  p.ellipse(8, cy, rx, ry, color);
  p.recolor(shadeHex(color, -0.28), (x, y) => (x - 8) * 0.6 + (y - cy) > 2.5);
  p.set(5, Math.round(cy - ry + 2), shadeHex(color, 0.6));
  p.set(6, Math.round(cy - ry + 2), shadeHex(color, 0.45));
  p.set(5, Math.round(cy - ry + 3), shadeHex(color, 0.45));
  p.rect(7, 2, 2, 3, '#6a4a2a');
  p.rect(9, 2, 3, 2, '#4aa83a');
  p.set(11, 1, '#7ad058');
  p.outline();
  return p.toCanvas();
}

// Luống đất 16x16 kiểu Gen 3: đất xới màu nâu sẫm, bo tròn hai đầu, viền tối, mép trên sáng (đất vun cao),
// đất xới tơi thành các hòn nhỏ xếp so le, lác đác cục đất sáng; đổ bóng nhẹ xuống cỏ phía dưới.
// Cây đứng liền nhau trên một hàng thì chung một luống: left / right nối sang ô bên trái / phải (không bo đầu phía đó)
const BED_TOP = 1;
const BED_BOTTOM = 14;
const BED_R = 4;

function bedMask(left, right) {
  // Nối sang ô bên cạnh thì kéo dài luống ra ngoài khung để mép nối liền, không lộ góc bo
  const x0 = left ? -8 : 0;
  const x1 = right ? 23 : 15;
  return (x, y) => {
    if (y < BED_TOP || y > BED_BOTTOM || x < x0 || x > x1) return false;
    const cx = Math.min(Math.max(x, x0 + BED_R - 0.5), x1 - BED_R + 0.5);
    const cy = Math.min(Math.max(y, BED_TOP + BED_R - 0.5), BED_BOTTOM - BED_R + 0.5);
    return (x - cx) ** 2 + (y - cy) ** 2 <= BED_R * BED_R;
  };
}

function drawSoil(left = false, right = false) {
  const p = new PixelBuffer(16, 16);
  const inBed = bedMask(left, right);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inBed(x, y)) {
        // Bóng luống đổ xuống cỏ
        if (inBed(x, y - 1) && y === BED_BOTTOM + 1) p.set(x, y, 'rgba(24,40,16,0.28)');
        continue;
      }
      const edge = !inBed(x - 1, y) || !inBed(x + 1, y) || !inBed(x, y - 1) || !inBed(x, y + 1);
      let c;
      if (edge) c = !inBed(x, y + 1) || !inBed(x + 1, y + 1) || !inBed(x - 1, y + 1) ? SOIL.rim : SOIL.rimTop;
      else if (!inBed(x, y - 2)) c = SOIL.lip;
      else if (!inBed(x, y + 2)) c = SOIL.front;
      else {
        // Đất xới tơi: các hòn đất nhỏ xếp so le (đỉnh sáng, chân tối) trên nền nâu sẫm
        const row = Math.floor((y - BED_TOP - 2) / 3);
        const dy = (y - BED_TOP - 2) % 3;
        const dx = (((x + (row % 2) * 2) % 4) + 4) % 4;
        c = SOIL.base;
        if (dy === 0 && dx < 2) c = SOIL.ridge;
        if (dy === 1 && dx === 2) c = SOIL.groove;
        if (dy === 1 && dx === 1) c = SOIL.groove;
        if (hash(x, y, 11) < 0.07) c = SOIL.clod;
      }
      p.set(x, y, c);
    }
  }
  return p.toCanvas();
}

// Cây quả mọng 16x28: bụi lá tròn gồm nhiều chùm lá xếp chồng (chùm dưới gần người xem nên đè lên chùm trên),
// thân gỗ ngắn cắm giữa luống (gốc ở hàng FOOT, tức cách mép dưới ô 4 pixel), bóng tròn trên mặt đất
const TW = 16;
const TH = 28;
const FOOT = 24;
const CLUMPS = [[8, 5.6, 3.8, 3.1], [4.9, 9, 3, 2.9], [11.1, 9, 3, 2.9], [8, 10.4, 3.4, 3], [4.9, 13.2, 2.8, 2.6], [11.1, 13.2, 2.8, 2.6], [8, 14.6, 3.2, 2.5]];

function drawTree(leaves) {
  const p = new PixelBuffer(TW, TH);
  // Thân và hai nhánh chẽ
  p.rect(7, 16, 2, FOOT - 16, TRUNK.base);
  p.rect(8, 16, 1, FOOT - 16, TRUNK.dark);
  p.rect(6, FOOT - 1, 4, 1, TRUNK.base);
  p.set(9, FOOT - 1, TRUNK.dark);
  p.set(6, 17, TRUNK.base);
  p.set(9, 17, TRUNK.dark);
  for (const [cx, cy, rx, ry] of CLUMPS) {
    p.ellipse(cx, cy, rx, ry, leaves.dark);
    p.ellipse(cx - 0.5, cy - 0.7, rx - 0.7, ry - 0.8, leaves.base);
    p.ellipse(cx - 1.2, cy - 1.4, rx * 0.42, ry * 0.36, leaves.light);
  }
  // Gân lá lấm tấm cho bụi lá có chất
  p.recolor(leaves.light, (x, y) => p.get(x, y) === leaves.base && hash(x, y, 3) < 0.08);
  p.outline(-0.62);
  // Bóng gốc cây trên đất
  p.ellipse(8, FOOT + 0.3, 4.6, 1.4, 'rgba(26,12,4,0.5)', (x, y) => !p.get(x, y) && y >= FOOT - 1);
  return p.toCanvas();
}

// Vị trí quả / hoa trên bụi (tâm, khung 16x28): hai bên hông, giữa thấp (lủng lẳng dưới tán) và hai quả phía trên
const SPOTS = [[4.5, 12.5], [11.5, 11.5], [8, 16.5], [5.5, 7.5], [10.5, 5.5]];

// Hoa: 4 cánh nhạt theo màu quả quanh nhuỵ vàng, viền mảnh cho nổi trên nền lá
function drawBlooms(color) {
  const p = new PixelBuffer(TW, TH);
  const petal = shadeHex(color, 0.62);
  for (const [fx, fy] of SPOTS) {
    const [x, y] = [Math.floor(fx), Math.floor(fy)];
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) p.set(x + dx, y + dy, petal);
    p.set(x, y, '#f8d040');
  }
  p.outline(-0.5);
  return p.toCanvas();
}

// Quả xanh: quả nhỏ 3x3 xanh vàng nhạt, có viền
function drawUnripe() {
  const p = new PixelBuffer(TW, TH);
  for (const [fx, fy] of SPOTS) {
    const [x, y] = [Math.floor(fx) - 1, Math.floor(fy) - 1];
    p.rect(x, y, 3, 3, '#b4d86a');
    p.set(x, y, '#e2f4a8');
    p.set(x + 2, y + 2, '#86b04a');
  }
  p.outline(-0.6);
  return p.toCanvas();
}

// Quả chín: rõ màu theo hình quả (tròn 3x3 / dài 3x5 / dẹt 5x3), đốm sáng góc trên, bóng góc dưới, cuống nâu, viền tối
function drawRipe(color, shape) {
  const p = new PixelBuffer(TW, TH);
  const [rx, ry] = [[1.6, 1.6], [1.4, 2.2], [2.2, 1.4]][shape];
  const dark = shadeHex(color, -0.3);
  for (const [cx, cy] of SPOTS) {
    p.ellipse(cx, cy, rx, ry, color);
    p.recolor(dark, (x, y) => p.get(x, y) === color && (x + 0.5 - cx) * 0.7 + (y + 0.5 - cy) > ry * 0.55);
    const top = Math.floor(cy - ry + 0.5);
    const left = Math.floor(cx - rx + 0.5);
    p.set(left + (rx > 2 ? 1 : 0), top + (ry > 2 ? 1 : 0), shadeHex(color, 0.6));
    p.set(Math.floor(cx), top - 1, TRUNK.dark);
  }
  p.outline(-0.6);
  return p.toCanvas();
}

// Bảng lá theo loại cây; quả màu xanh lá (Lum, Rawst, Hondew) thì lá xanh sẫm hơn để quả không chìm vào tán
function leavesFor(id) {
  const [h, s] = hexToHsl(ITEMS[id].color);
  if (h >= 70 && h <= 175 && s > 0.3) return DEEP_LEAVES;
  return leavesOf(id);
}

export function makeBerryTextures(scene) {
  addCanvasTexture(scene, 'berry-soil', drawSoil());
  addCanvasTexture(scene, 'berry-soil-l', drawSoil(false, true));
  addCanvasTexture(scene, 'berry-soil-m', drawSoil(true, true));
  addCanvasTexture(scene, 'berry-soil-r', drawSoil(true, false));
  addCanvasTexture(scene, 'berry-unripe', drawUnripe());
  for (const id of BERRY_IDS) {
    const { color, icon } = ITEMS[id];
    addCanvasTexture(scene, icon, drawBerryIcon(color, shapeOf(id)));
    addCanvasTexture(scene, `berry-tree-${id}`, drawTree(leavesFor(id)));
    addCanvasTexture(scene, `berry-bloom-${id}`, drawBlooms(color));
    addCanvasTexture(scene, `berry-ripe-${id}`, drawRipe(color, shapeOf(id)));
  }
}
