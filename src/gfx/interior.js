import { TILE } from '../config.js';
import { THEMES } from '../data/interiorThemes.js';
import { PixelBuffer, hash, px, shadeHex } from './pixel.js';

// Nội thất trong nhà, pixel art 16x16 mỗi ô

const isWall = (ch) => ch === '#' || ch === 'm';
// Cửa lớn nằm trong hàng tường sát sàn: ô tường phía trên nó vẫn là phần tường trên
const wallAbove = (ch) => isWall(ch) || ch === 'D';

// Sàn gỗ: các tấm ván ngang, mối nối lệch nhau
function drawWoodFloor(ctx, ox, oy, x, y, t) {
  px(ctx, t.floor, ox, oy, TILE, TILE);
  for (let row = 0; row < 4; row++) {
    const ry = oy + row * 4;
    px(ctx, row % 2 ? t.floorAlt : t.floor, ox, ry, TILE, 3);
    px(ctx, t.grout, ox, ry + 3, TILE, 1);
    px(ctx, t.grout, ox + ((x * 7 + y * 3 + row * 5) % 16), ry, 1, 3);
  }
}

function drawFloor(ctx, ox, oy, x, y, t) {
  if (t.wood) {
    drawWoodFloor(ctx, ox, oy, x, y, t);
    return;
  }
  px(ctx, (x + y) % 2 ? t.floorAlt : t.floor, ox, oy, TILE, TILE);
  px(ctx, t.grout, ox, oy + 15, TILE, 1);
  px(ctx, t.grout, ox + 15, oy, 1, TILE);
  if (hash(x, y, 70) < 0.3) px(ctx, t.grout, ox + 3 + Math.floor(hash(x, y, 71) * 9), oy + 3 + Math.floor(hash(x, y, 72) * 9));
}

// lower: hàng tường sát sàn (giấy dán tường + chân tường), còn lại là phần tường phía trên
function drawWall(ctx, ox, oy, lower, t) {
  if (!lower) {
    px(ctx, t.trim, ox, oy, TILE, TILE);
    px(ctx, t.trimDark, ox, oy + 4, TILE, 1);
    px(ctx, t.trimDark, ox, oy + 11, TILE, 1);
    return;
  }
  px(ctx, t.wall, ox, oy, TILE, TILE);
  for (let i = 0; i < TILE; i += 4) px(ctx, t.stripe, ox + i, oy, 2, 12);
  px(ctx, t.base, ox, oy + 12, TILE, 3);
  px(ctx, t.ink, ox, oy + 15, TILE, 1);
}

function drawCounter(ctx, ox, oy, joinLeft, joinRight, t) {
  const x0 = ox + (joinLeft ? 0 : 1);
  const w = TILE - (joinLeft ? 0 : 1) - (joinRight ? 0 : 1);
  px(ctx, t.ink, ox, oy + 1, TILE, 15);
  px(ctx, t.counterTop, x0, oy + 2, w, 7);
  px(ctx, t.counterLight, x0, oy + 2, w, 1);
  px(ctx, t.counterFront, x0, oy + 10, w, 5);
  px(ctx, t.counterDark, x0, oy + 13, w, 2);
}

// Máy hồi phục trên tường, rộng 2 ô, có 6 khe đặt Poké Ball
export const MACHINE_SLOTS = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 17 + (i % 3) * 5, y: 6 + Math.floor(i / 3) * 5 }));

function drawMachine(ctx, ox, oy) {
  px(ctx, '#3a3440', ox + 1, oy + 1, 30, 14);
  px(ctx, '#ece4d4', ox + 2, oy + 2, 28, 12);
  px(ctx, '#d4c8b4', ox + 2, oy + 11, 28, 3);
  px(ctx, '#3a3440', ox + 4, oy + 3, 9, 7);
  px(ctx, '#5ac8f0', ox + 5, oy + 4, 7, 5);
  px(ctx, '#c8f0ff', ox + 6, oy + 5, 2, 1);
  for (const s of MACHINE_SLOTS) {
    px(ctx, '#7a7068', ox + s.x - 2, oy + s.y - 2, 4, 4);
    px(ctx, '#5a5048', ox + s.x - 1, oy + s.y - 1, 2, 2);
  }
}

// Chậu cây cảnh trong nhà: chậu có miệng loe, lá xoè từ gốc (không có thân cây).
// Hai loại theo vị trí: cây lá rộng xoè tròn trong chậu đất nung, cây lưỡi hổ lá thẳng đứng viền vàng trong chậu sứ.
// tall: phía trên là tường thì lá được vươn cao lên mép tường
const LEAF = { dark: '#235e2c', base: '#3e9444', light: '#68c058', hi: '#a4e07c' };
const plantCache = {};
function leafShape(p, x0, y0, angle, len, width, pal) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let t = 0; t <= len; t += 0.5) {
    const w = Math.sin((Math.PI * t) / len) * width;
    for (let k = -w; k <= w; k += 0.5) {
      const x = Math.round(x0 + dx * t - dy * k);
      const y = Math.round(y0 + dy * t + dx * k);
      // nửa lá phía dưới tối hơn, gân giữa sáng
      p.set(x, y, Math.abs(k) < 0.6 && t > 1 ? pal.light : k * dx > 0 ? pal.dark : pal.base);
    }
  }
}
function plantSprite(kind, tall) {
  const key = `${kind}${tall}`;
  if (plantCache[key]) return plantCache[key];
  // cây lưỡi hổ luôn cao hơn ô một chút (lá nhô lên sau lưng ô phía trên, nhân vật đứng đó vẫn vẽ đè lên)
  const top = tall ? 6 : kind === 'snake' ? 4 : 0; // hàng đầu của ô gốc trong ảnh
  const H = 16 + top;
  const p = new PixelBuffer(TILE, H);
  if (kind === 'snake') {
    // cây lưỡi hổ: các lá thẳng nhọn đứng sát nhau, vằn ngang, mép vàng
    const blades = [[5, 6, -0.18], [7, 10, -0.05], [9, 9, 0.08], [11, 6, 0.22], [6, 8, 0.0], [10, 7, 0.12]];
    for (const [bx, len, lean] of blades) {
      const h = len + top - 1;
      for (let i = 0; i < h; i++) {
        const y = top + 9 - i;
        const x = Math.round(bx + lean * i);
        const narrow = i > h - 3;
        p.set(x, y, i % 3 === 1 ? '#5aa850' : '#3a8a40');
        if (!narrow) p.set(x + 1, y, i % 3 === 1 ? '#2e7034' : '#24602c');
        if (!narrow && i % 4 === 0) p.set(x, y, '#d8d070');
      }
    }
    // chậu sứ trắng viền xanh
    p.rect(3, top + 9, 10, 2, '#f4f4f0');
    p.rect(3, top + 9, 10, 1, '#ffffff');
    p.rect(4, top + 11, 8, 4, '#e8e8e4');
    p.rect(9, top + 11, 3, 4, '#c8ccd4');
    p.rect(4, top + 12, 8, 1, '#4a7ad8');
    p.rect(5, top + 15, 6, 1, '#a8acb8');
  } else {
    // cây lá rộng: lá bầu dục xoè ra mọi phía từ miệng chậu, lá sau tối hơn lá trước
    const back = { dark: '#1c4e24', base: '#2f7a36', light: '#4fa04a' };
    const cx = 8;
    const cy = top + 9;
    const reach = tall ? 1.2 : 1;
    for (const [deg, len, w] of [[-90, 8, 2.4], [-130, 8, 2.4], [-50, 8, 2.4]]) leafShape(p, cx, cy, (deg * Math.PI) / 180, len * reach, w, back);
    for (const [deg, len, w] of [[-165, 7, 2.2], [-15, 7, 2.2], [-110, 7, 2.3], [-70, 7, 2.3], [-150, 5, 1.8], [-30, 5, 1.8]]) {
      leafShape(p, cx, cy, (deg * Math.PI) / 180, len * reach, w, LEAF);
    }
    for (const [hx, hy] of [[5, cy - 5], [10, cy - 5], [8, cy - 7]]) p.set(hx, hy, LEAF.hi);
    // chậu đất nung: miệng loe sáng, thân thon dần, bóng bên phải
    p.rect(3, top + 9, 10, 2, '#d8804a');
    p.rect(3, top + 9, 10, 1, '#f0a870');
    p.rect(4, top + 9, 8, 1, '#4a2c18'); // đất trong chậu
    p.rect(4, top + 11, 8, 3, '#c06a38');
    p.rect(5, top + 14, 6, 2, '#c06a38');
    p.rect(9, top + 11, 3, 3, '#9a4e26');
    p.rect(9, top + 14, 2, 2, '#9a4e26');
    p.rect(5, top + 11, 1, 3, '#e08a52');
  }
  p.outline(-0.55);
  plantCache[key] = { p, top };
  return plantCache[key];
}
function drawPlant(ctx, ox, oy, x, y, tall) {
  const { p, top } = plantSprite(hash(x, y, 90) < 0.5 ? 'fern' : 'snake', tall);
  px(ctx, 'rgba(40,24,10,0.25)', ox + 4, oy + 15, 9, 1);
  p.drawTo(ctx, ox, oy - top);
}

function drawPC(ctx, ox, oy) {
  px(ctx, '#5a3a20', ox + 1, oy + 10, 14, 6);
  px(ctx, '#8a6040', ox + 2, oy + 11, 12, 4);
  px(ctx, '#3a3e48', ox + 2, oy, 12, 11);
  px(ctx, '#8a94a4', ox + 3, oy + 1, 10, 9);
  px(ctx, '#58a0e8', ox + 4, oy + 2, 8, 6);
  px(ctx, '#a8d8ff', ox + 5, oy + 3, 3, 2);
}

function drawBench(ctx, ox, oy) {
  px(ctx, '#5a3a20', ox + 2, oy + 11, 2, 5);
  px(ctx, '#5a3a20', ox + 12, oy + 11, 2, 5);
  px(ctx, '#6a2020', ox, oy + 4, TILE, 9);
  px(ctx, '#e05050', ox + 1, oy + 5, 14, 6);
  px(ctx, '#f08080', ox + 2, oy + 6, 12, 1);
  px(ctx, '#a03030', ox + 1, oy + 11, 14, 1);
}

const GOODS = ['#e05050', '#4a7ad8', '#f0c040', '#50b070', '#a050d0', '#f08030'];

function drawShelf(ctx, ox, oy, x, y, tall) {
  if (tall) {
    drawBookcase(ctx, ox, oy, x, y);
    return;
  }
  px(ctx, '#5a3a20', ox, oy, TILE, TILE);
  px(ctx, '#a07040', ox + 1, oy + 1, 14, 14);
  px(ctx, '#7a5030', ox + 1, oy + 7, 14, 1);
  px(ctx, '#7a5030', ox + 1, oy + 14, 14, 1);
  for (const row of [1, 8]) {
    for (let i = 0; i < 4; i++) {
      const color = GOODS[Math.floor(hash(x * 4 + i, y * 2 + row, 80) * GOODS.length)];
      px(ctx, color, ox + 2 + i * 3, oy + row + 1, 2, 5);
      px(ctx, '#ffffff', ox + 2 + i * 3, oy + row + 1, 1, 1);
    }
  }
}

// Xe đạp trưng bày (tiệm xe đạp, map.shelfGoods = 'bikes'): xe nhìn ngang dựng trên giá đỡ, mỗi ô một màu khung.
// Sát tường thì xe treo trên giá gắn tường (vươn lên nửa dưới bức tường), giữa phòng thì xe dựng trên bục thấp
const BIKE_COLORS = ['#e04848', '#3a78d8', '#40a860', '#f0b030', '#a058d0'];
function drawBikeStand(ctx, ox, oy, x, y, onWall) {
  // màu khung đổi lần lượt theo cột để hai xe cạnh nhau không trùng màu
  const frame = BIKE_COLORS[(x + y * 2) % BIKE_COLORS.length];
  const p = new PixelBuffer(TILE, 22);
  const top = onWall ? 4 : 7; // hàng yên xe
  if (onWall) {
    // giá treo gắn tường: thanh gỗ ngang và hai móc
    p.rect(1, 1, 14, 2, '#8a5a30');
    p.rect(1, 1, 14, 1, '#b07a44');
    p.set(5, 3, '#5a5a68');
    p.set(11, 3, '#5a5a68');
  } else {
    // bục trưng bày thấp
    p.rect(0, 18, TILE, 3, '#8a5a30');
    p.rect(0, 18, TILE, 1, '#c08850');
    p.rect(0, 20, TILE, 1, '#5a3a20');
  }
  const wy = top + 7; // tâm bánh xe
  for (const wx of [4, 12]) {
    p.ellipse(wx, wy, 3.5, 3.5, '#26262e');
    p.ellipse(wx, wy, 2.5, 2.5, '#b8c2d0');
    p.ellipse(wx, wy, 1.5, 1.5, '#e8eef6');
    p.set(wx - 1, wy - 1, '#7a8494');
  }
  // khung xe hai pixel: ống yên, ống ngang, ống chéo xuống trục giữa, càng sau, phuộc trước
  const tube = (x0, y0, x1, y1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const tx = Math.round(x0 + ((x1 - x0) * i) / n);
      const ty = Math.round(y0 + ((y1 - y0) * i) / n);
      p.set(tx, ty, frame);
      p.set(tx, ty + 1, shadeHex(frame, -0.28));
    }
  };
  const bb = [8, wy - 1]; // trục giữa
  tube(6, top + 1, bb[0], bb[1]); // ống yên
  tube(6, top + 2, 11, top + 2); // ống ngang
  tube(11, top + 2, bb[0], bb[1]); // ống chéo
  tube(bb[0], bb[1], 4, wy - 1); // càng sau
  tube(6, top + 2, 4, wy - 1); // gióng sau
  tube(11, top + 2, 12, wy - 1); // phuộc trước
  // yên, ghi đông, đĩa xích
  p.rect(4, top, 4, 1, '#3a2a20');
  p.rect(11, top - 1, 1, 3, '#5a5a68');
  p.rect(10, top - 1, 3, 1, '#26262e');
  p.rect(7, wy - 1, 3, 2, '#5a5a68');
  p.set(7, top + 2, shadeHex(frame, 0.4));
  p.outline(-0.6);
  p.drawTo(ctx, ox, oy + TILE - 22 + (onWall ? -2 : 0));
}

// Tủ sách / kệ hàng sát tường: cao vươn lên nửa dưới bức tường (26px), 3 ngăn đồ nhiều màu, có sách nằm ngang
function drawBookcase(ctx, ox, oy, x, y) {
  const p = new PixelBuffer(TILE, 26);
  p.rect(1, 0, 14, 25, '#8a5a30');
  p.rect(1, 0, 14, 2, '#b07a44');
  p.rect(1, 0, 1, 25, '#a8703c');
  p.rect(2, 2, 12, 22, '#4a2e18');
  for (const sy of [9, 16, 23]) {
    p.rect(2, sy, 12, 1, '#b07a44');
    p.rect(2, sy + 1, 12, 1, '#6a4426');
  }
  for (const [row, y0] of [[0, 3], [1, 10], [2, 17]]) {
    let bx = 2;
    while (bx < 14) {
      const r = hash(x * 7 + bx, y * 3 + row, 81);
      if (r < 0.12 && bx < 11) {
        // sách nằm ngang
        p.rect(bx, y0 + 4, 3, 2, GOODS[Math.floor(r * 50) % GOODS.length]);
        bx += 3;
        continue;
      }
      const h = 5 + Math.floor(hash(x * 7 + bx, y, 82) * 2);
      const c = GOODS[Math.floor(hash(bx, y * 5 + row + x, 83) * GOODS.length)];
      p.rect(bx, y0 + 6 - h, Math.min(2, 14 - bx), h, c);
      p.set(bx, y0 + 6 - h, shadeHex(c, 0.4));
      if (bx + 1 < 14) p.rect(bx + 1, y0 + 7 - h, 1, h - 1, shadeHex(c, -0.25));
      bx += 2 + (hash(bx, y0, 84) < 0.2 ? 1 : 0);
    }
  }
  p.rect(1, 25, 14, 1, '#3a2414');
  p.outline(-0.55);
  p.drawTo(ctx, ox, oy + TILE - 26);
}

// Giường đơn 1x2 ô nhìn chéo từ trên: đầu giường gỗ sát tường (nhô lên tường 6px), gối, chăn bông lật gập
// một mép để lộ mặt trong sáng màu, chăn có hoạ tiết ô và rủ xuống hai bên mép đệm, cuối giường có thành gỗ thấp và chân.
// Vẽ cả giường ở ô trên (ô dưới để trống); color: màu chăn (map.bedColor)
const bedCache = {};
function bedSprite(color) {
  if (bedCache[color]) return bedCache[color];
  const W = { dark: '#7a4a24', base: '#a86c38', light: '#d09458' };
  const Q = { base: color, light: shadeHex(color, 0.3), dark: shadeHex(color, -0.25), deep: shadeHex(color, -0.45) };
  const p = new PixelBuffer(TILE, 38);
  // đầu giường: tấm ván có khung, hai cột tròn đầu
  p.rect(1, 2, 14, 9, W.base);
  p.rect(1, 2, 14, 1, W.light);
  p.rect(3, 4, 10, 5, W.dark);
  p.rect(4, 5, 8, 3, W.base);
  p.rect(4, 5, 8, 1, W.light);
  for (const cx of [1, 13]) {
    p.rect(cx, 1, 2, 12, W.dark);
    p.rect(cx, 1, 1, 12, W.light);
    p.rect(cx, 0, 2, 1, W.light);
  }
  // đệm + ga trắng
  p.rect(2, 10, 12, 24, '#e8e8f0');
  p.rect(2, 10, 12, 1, '#ffffff');
  // gối: phồng ở giữa, bóng dưới
  p.rect(3, 11, 10, 6, '#ffffff');
  p.rect(3, 15, 10, 2, '#d8dce8');
  p.rect(4, 12, 3, 1, '#f4f6ff');
  p.set(3, 11, '#e8e8f0');
  p.set(12, 11, '#e8e8f0');
  // mép chăn lật gập (mặt trong sáng màu), thân chăn có hoạ tiết ô, rủ xuống hai bên (rộng hơn đệm 1px)
  p.rect(2, 19, 12, 1, '#c8ccd8');
  p.rect(1, 20, 14, 3, '#f4f0e4');
  p.rect(1, 22, 14, 1, '#d8d0c0');
  p.rect(1, 23, 14, 10, Q.base);
  for (let y = 23; y < 33; y++) {
    for (let x = 1; x < 15; x++) {
      if ((x + 1) % 4 === 0 || (y - 23) % 4 === 3) p.set(x, y, Q.light);
      if ((x + 1) % 4 === 0 && (y - 23) % 4 === 3) p.set(x, y, '#ffffff');
    }
  }
  p.rect(1, 23, 1, 11, Q.dark); // rủ mép trái
  p.rect(14, 23, 1, 11, Q.deep); // rủ mép phải (khuất sáng)
  p.rect(1, 33, 14, 1, Q.deep);
  // nếp chăn
  p.rect(5, 26, 1, 4, Q.dark);
  p.rect(10, 25, 1, 3, Q.dark);
  // thành cuối giường và chân
  p.rect(1, 34, 14, 2, W.base);
  p.rect(1, 34, 14, 1, W.light);
  p.rect(1, 36, 2, 2, W.dark);
  p.rect(13, 36, 2, 2, W.dark);
  p.outline(-0.6);
  bedCache[color] = p;
  return p;
}
function drawBed(ctx, ox, oy, top, color = '#4a7ad8') {
  if (!top) return;
  px(ctx, 'rgba(40,24,10,0.22)', ox + 2, oy + 2 * TILE - 1, 14, 2);
  bedSprite(color).drawTo(ctx, ox, oy - 6);
}

// TV lớn: các ô 'V' liền nhau ghép thành một kệ gỗ dài, màn hình phẳng rộng trải qua các ô (left / right: ô ở hai đầu)
function drawTV(ctx, ox, oy, left, right) {
  const x0 = ox + (left ? 1 : 0);
  const w = TILE - (left ? 1 : 0) - (right ? 1 : 0);
  // kệ gỗ dài
  px(ctx, '#4a3020', x0, oy + 10, w, 6);
  px(ctx, '#a06a38', x0 + (left ? 1 : 0), oy + 11, w - (left ? 1 : 0) - (right ? 1 : 0), 4);
  px(ctx, '#c08850', x0 + (left ? 1 : 0), oy + 11, w - (left ? 1 : 0) - (right ? 1 : 0), 1);
  if (!left && !right) px(ctx, '#2a2a30', ox + 6, oy + 9, 4, 2); // chân đế TV ở ô giữa
  px(ctx, '#e0c080', ox + 7, oy + 13, 2, 1);
  // màn hình: viền đen, mặt kính xanh, vệt sáng ở ô trái, hình đồi xanh ở ô phải
  const s0 = ox + (left ? 3 : 0);
  const sw = TILE - (left ? 3 : 0) - (right ? 3 : 0);
  px(ctx, '#1e1e24', s0, oy, sw, 9);
  px(ctx, '#4aa8e8', s0 + (left ? 1 : 0), oy + 1, sw - (left ? 1 : 0) - (right ? 1 : 0), 7);
  if (left) px(ctx, '#a8e0ff', s0 + 1, oy + 1, 5, 1);
  if (left) px(ctx, '#a8e0ff', s0 + 1, oy + 2, 2, 1);
  if (right) px(ctx, '#7ad0a0', s0, oy + 5, sw - 1, 3);
  if (!left && !right) px(ctx, '#f8d040', ox + 9, oy + 2, 3, 3);
}

// Bàn nhiều ô ghép lại: mặt bàn ở trên, mặt trước ở hàng dưới cùng
function drawTable(ctx, ox, oy, map, x, y, colors) {
  const ch = map.tileAt(x, y);
  const left = map.tileAt(x - 1, y) === ch;
  const right = map.tileAt(x + 1, y) === ch;
  const up = map.tileAt(x, y - 1) === ch;
  const down = map.tileAt(x, y + 1) === ch;
  const x0 = ox + (left ? 0 : 1);
  const x1 = ox + TILE - (right ? 0 : 1);
  const y0 = oy + (up ? 0 : 3);
  const y1 = oy + TILE - (down ? 0 : 1);
  px(ctx, colors.ink, x0, y0, x1 - x0, y1 - y0);
  px(ctx, colors.top, x0 + (left ? 0 : 1), y0 + (up ? 0 : 1), x1 - x0 - (left ? 0 : 1) - (right ? 0 : 1), y1 - y0 - (up ? 0 : 1) - (down ? 0 : 5));
  if (!up) px(ctx, colors.light, x0 + (left ? 0 : 1), y0 + 1, x1 - x0 - (left ? 0 : 1) - (right ? 0 : 1), 1);
  if (!down) px(ctx, colors.front, x0 + (left ? 0 : 1), y1 - 5, x1 - x0 - (left ? 0 : 1) - (right ? 0 : 1), 4);
}

const WOOD_TABLE = { ink: '#4a3020', top: '#c08850', light: '#d8a868', front: '#8a5a30' };
const LAB_DESK = { ink: '#2a3040', top: '#e8ecf0', light: '#ffffff', front: '#9aa4b4' };

function drawLabMachine(ctx, ox, oy) {
  px(ctx, '#3a4050', ox, oy + 1, TILE, 15);
  px(ctx, '#c8d0dc', ox + 1, oy + 2, 14, 13);
  px(ctx, '#2a3040', ox + 3, oy + 4, 10, 5);
  px(ctx, '#58e0a0', ox + 4, oy + 5, 8, 3);
  px(ctx, '#a8f0c8', ox + 4, oy + 5, 3, 1);
  px(ctx, '#f05050', ox + 3, oy + 11, 2, 2);
  px(ctx, '#f0d040', ox + 7, oy + 11, 2, 2);
  px(ctx, '#50b0f0', ox + 11, oy + 11, 2, 2);
}

// Ô gió: nền xanh nhạt có vệt gió và mũi tên theo hướng thổi
const WIND_DIRS = { v: [0, 1], '^': [0, -1], '<': [-1, 0], '>': [1, 0] };
function drawWind(ctx, ox, oy, ch, x, y) {
  const [dx, dy] = WIND_DIRS[ch];
  px(ctx, '#b8e4f4', ox + 1, oy + 1, 14, 14);
  for (let i = 0; i < 3; i++) {
    const a = Math.floor(hash(x, y, i) * 10) + 2;
    if (dx === 0) px(ctx, '#ffffff', ox + a, oy + 2 + i * 4, 1, 3);
    else px(ctx, '#ffffff', ox + 2 + i * 4, oy + a, 3, 1);
  }
  // mũi tên ở giữa ô: các vạch ngắn dần theo hướng thổi
  const cx = ox + 8;
  const cy = oy + 8;
  for (let i = 0; i < 4; i++) {
    const t = 4 - i;
    if (dx === 0) px(ctx, '#2a88b8', cx - t, cy + dy * (i - 1), t * 2, 1);
    else px(ctx, '#2a88b8', cx + dx * (i - 1), cy - t, 1, t * 2);
  }
}

// Dòng nước chảy (Gym Sông Nước): mặt nước xanh có vệt sóng chạy theo hướng mũi tên
function drawCurrent(ctx, ox, oy, ch, x, y) {
  const [dx, dy] = WIND_DIRS[ch];
  px(ctx, '#3a8ae8', ox, oy, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const a = Math.floor(hash(x, y, i + 4) * 11) + 2;
    if (dx === 0) px(ctx, '#8ac8f8', ox + a, oy + 1 + i * 4, 1, 3);
    else px(ctx, '#8ac8f8', ox + 1 + i * 4, oy + a, 3, 1);
  }
  const cx = ox + 8;
  const cy = oy + 8;
  for (let i = 0; i < 4; i++) {
    const t = 4 - i;
    if (dx === 0) px(ctx, '#e8f6ff', cx - t, cy + dy * (i - 1), t * 2, 1);
    else px(ctx, '#e8f6ff', cx + dx * (i - 1), cy - t, 1, t * 2);
  }
}

// Hàng rào tre (Gym Lúa Vàng)
function drawHedge(ctx, ox, oy) {
  px(ctx, '#3a5a20', ox, oy + 2, TILE, 14);
  for (const x of [0, 4, 8, 12]) {
    px(ctx, '#8ab848', ox + x, oy + 1, 3, 14);
    px(ctx, '#5a8a30', ox + x + 2, oy + 1, 1, 14);
  }
  px(ctx, '#6a4a28', ox, oy + 6, TILE, 2);
  px(ctx, '#2a3a18', ox, oy + 15, TILE, 1);
}

// Tường điện (Gym Đèn Lồng): khối kim loại sẫm có vạch vàng cảnh báo và đèn lồng nhỏ
function drawPylon(ctx, ox, oy, x, y, map) {
  // Tường điện (Gym Đèn Lồng): khối thép đen nhô cao, mặt trên xám xanh, viền xanh điện sáng ở mép giáp lối đi;
  // mặt trước (khi ô dưới là lối đi) có vạch cảnh báo vàng đen. Khác hẳn sàn lát sáng màu để nhìn ra đâu là lối đi.
  const z = (dx, dy) => map.tileAt(x + dx, y + dy) === 'Z';
  const front = !z(0, 1);
  const top = front ? 9 : TILE;
  px(ctx, '#0a0b12', ox, oy, TILE, TILE);
  px(ctx, '#262b40', ox, oy, TILE, top);
  px(ctx, '#323854', ox + 2, oy + 2, TILE - 4, Math.max(1, top - 4));
  if (front) {
    // mặt trước: vạch vàng đen chéo, mép dưới đen
    px(ctx, '#15172a', ox, oy + 9, TILE, 7);
    for (let i = 0; i < TILE; i++) if ((i + y * 2) % 6 < 3) px(ctx, '#e8b820', ox + i, oy + 10, 1, 4);
    px(ctx, '#05060a', ox, oy + 14, TILE, 2);
  }
  const rim = '#58d8ff';
  if (!z(0, -1)) px(ctx, rim, ox, oy, TILE, 1);
  if (!z(-1, 0)) px(ctx, rim, ox, oy, 1, top);
  if (!z(1, 0)) px(ctx, rim, ox + TILE - 1, oy, 1, top);
  if (front) px(ctx, '#3aa8d8', ox, oy + 8, TILE, 1);
  // đèn tín hiệu nhỏ trên nóc
  if ((x + y) % 3 === 0) {
    px(ctx, '#a0f0ff', ox + 7, oy + 3, 2, 2);
    px(ctx, '#ffffff', ox + 7, oy + 3, 1, 1);
  }
}

// Cột đá trang trí trong gym
function drawPillar(ctx, ox, oy) {
  px(ctx, '#1a3a50', ox + 3, oy, 10, TILE);
  px(ctx, '#e8f4fa', ox + 4, oy + 1, 8, 14);
  px(ctx, '#b8d8e8', ox + 9, oy + 1, 3, 14);
  px(ctx, '#58a8c8', ox + 3, oy + 13, 10, 3);
}

// Than hồng (Gym Lò Gốm): nền than đen, các cục than đỏ rực
function drawCoal(ctx, ox, oy, x, y) {
  px(ctx, '#2a1810', ox, oy, TILE, TILE);
  for (let i = 0; i < 7; i++) {
    const cx = ox + 1 + Math.floor(hash(x, y, 170 + i) * 12);
    const cy = oy + 1 + Math.floor(hash(x, y, 180 + i) * 12);
    px(ctx, '#a82810', cx, cy, 3, 3);
    px(ctx, i % 2 ? '#f86020' : '#ffb030', cx + 1, cy + 1, 1, 1);
  }
}

// Nước sâu (Gym Sông Nước): xanh thẫm, gợn sóng nhạt; mép giáp đảo đá có bọt trắng
function drawDeepWater(ctx, ox, oy, x, y, map) {
  px(ctx, '#1a5aa8', ox, oy, TILE, TILE);
  for (let i = 0; i < 3; i++) {
    const a = Math.floor(hash(x, y, 200 + i) * 10) + 2;
    px(ctx, '#3a7ac8', ox + a, oy + 2 + i * 5, 4, 1);
  }
  const land = (dx, dy) => !['~', 'x', 'v', '^', '<', '>'].includes(map.tileAt(x + dx, y + dy));
  if (land(0, -1)) px(ctx, '#c8e8ff', ox, oy, TILE, 1);
  if (land(-1, 0)) px(ctx, '#c8e8ff', ox, oy, 1, TILE);
  if (land(1, 0)) px(ctx, '#c8e8ff', ox + 15, oy, 1, TILE);
}

// Xoáy nước (Gym Sông Nước): vòng xoắn trắng trên nền nước thẫm
function drawWhirlpool(ctx, ox, oy) {
  px(ctx, '#1a5aa8', ox, oy, TILE, TILE);
  const p = new PixelBuffer(TILE, TILE);
  p.ellipse(8, 8, 7, 6, '#2a6ab8');
  for (let k = 0; k < 26; k++) {
    const a = k * 0.55;
    const r = 1 + k * 0.24;
    p.set(Math.round(8 + Math.cos(a) * r), Math.round(8 + Math.sin(a) * r * 0.85), k % 3 ? '#e8f6ff' : '#8ac8f8');
  }
  p.drawTo(ctx, ox, oy);
}

// Hố sâu (Gym Núi Đá): miệng hố tối, viền đá vỡ
function drawHole(ctx, ox, oy) {
  const p = new PixelBuffer(TILE, TILE);
  p.ellipse(8, 8.5, 7.5, 7, '#5a4a3c');
  p.ellipse(8, 9, 6, 5.5, '#120c08');
  p.ellipse(8, 11, 4, 3, '#060402');
  p.drawTo(ctx, ox, oy);
}

// Miệng phun lửa (Gym Lò Gốm): tấm gang có khe, nhóm 0 viền cam, nhóm 1 viền đỏ (lửa phụt lên vẽ bằng sprite riêng)
function drawVent(ctx, ox, oy, group) {
  px(ctx, '#2a1810', ox, oy, TILE, TILE);
  px(ctx, group ? '#c83020' : '#e88020', ox + 1, oy + 1, 14, 14);
  px(ctx, '#3a2a24', ox + 2, oy + 2, 12, 12);
  for (const dy of [4, 7, 10]) px(ctx, '#120a06', ox + 3, oy + dy, 10, 1);
  px(ctx, group ? '#f05a3a' : '#f8b040', ox + 7, oy + 7, 2, 2);
}

// Ô dịch chuyển (Gym Chùa Cổ): đĩa tròn tím, vòng sáng ở giữa
function drawPad(ctx, ox, oy) {
  const p = new PixelBuffer(TILE, TILE);
  p.ellipse(8, 8, 7, 7, '#5a2a88');
  p.ellipse(8, 8, 5, 5, '#a858d8');
  p.ellipse(8, 8, 3, 3, '#f0c8ff');
  p.ellipse(8, 8, 1, 1, '#ffffff');
  p.drawTo(ctx, ox, oy);
}

// Sàn băng (Gym Sương Mù): xanh nhạt bóng, vệt phản chiếu chéo
function drawIce(ctx, ox, oy, x, y) {
  px(ctx, '#b8e0f8', ox, oy, TILE, TILE);
  px(ctx, '#98c8e8', ox, oy + 15, TILE, 1);
  px(ctx, '#98c8e8', ox + 15, oy, 1, TILE);
  if ((x + y) % 3 === 0) for (let i = 0; i < 5; i++) px(ctx, '#ffffff', ox + 3 + i, oy + 9 - i, 1, 1);
  if (hash(x, y, 190) > 0.6) px(ctx, '#e8f8ff', ox + 9, oy + 4, 3, 1);
}

// Lò gốm trong gym
function drawKilnInside(ctx, ox, oy) {
  px(ctx, '#3a1408', ox + 1, oy + 2, 14, 14);
  px(ctx, '#a84a2a', ox + 2, oy + 3, 12, 12);
  px(ctx, '#c86a40', ox + 3, oy + 4, 4, 1);
  px(ctx, '#3a1408', ox + 5, oy + 9, 6, 6);
  px(ctx, '#f08020', ox + 6, oy + 11, 4, 4);
  px(ctx, '#ffd040', ox + 7, oy + 12, 2, 3);
}

// Tảng đá trong gym (Gym Núi Đá) và tảng băng (Gym Sương Mù)
function drawBoulder(ctx, ox, oy, colors) {
  const p = new PixelBuffer(TILE, TILE);
  p.ellipse(8, 9, 7, 6, colors[0]);
  p.recolor(colors[1], (bx, by) => bx + by > 17);
  p.set(5, 6, colors[2]);
  p.set(6, 5, colors[2]);
  p.set(4, 7, colors[2]);
  p.outline(-0.6);
  p.drawTo(ctx, ox, oy);
}
const BOULDERS = { gymRock: ['#8a7868', '#6a5a4c', '#b0a090'], gymIce: ['#a8d8f8', '#78b0d8', '#ffffff'] };

// Cửa lớn hai cánh trên tường (Liên minh): khung theo màu phòng, núm cửa vàng
function drawBigDoor(ctx, ox, oy, t) {
  px(ctx, t.ink, ox + 1, oy, 14, TILE);
  px(ctx, t.trim, ox + 2, oy + 1, 12, 15);
  px(ctx, t.trimDark, ox + 7, oy + 1, 2, 15);
  for (const dx of [3, 9]) px(ctx, shadeHex(t.trim, -0.18), ox + dx, oy + 3, 4, 10);
  px(ctx, '#f8e088', ox + 5, oy + 8, 1, 2);
  px(ctx, '#f8e088', ox + 10, oy + 8, 1, 2);
}

// ---------- Nhà 2 tầng của người chơi ----------

const STAIR_WOOD = { ink: '#3a2414', tread: '#c89058', treadLight: '#e0b078', riser: '#8a5a30', rail: '#6a4020' };

// Cầu thang lên: các bậc gỗ cao dần về phía tường sau (bậc trên tối hơn vì khuất trong hốc tường), tay vịn hai bên
function drawStairsUp(ctx, ox, oy) {
  const s = STAIR_WOOD;
  px(ctx, s.ink, ox, oy, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const y = oy + 12 - i * 4;
    const dark = i * 0.1;
    px(ctx, shadeHex(s.tread, -dark), ox + 2, y, 12, 3);
    px(ctx, shadeHex(s.treadLight, -dark), ox + 2, y, 12, 1);
    px(ctx, shadeHex(s.riser, -dark), ox + 2, y + 3, 12, 1);
  }
  px(ctx, '#1a1008', ox + 2, oy, 12, 1); // khoảng tối phía trên bậc cao nhất
  for (const x of [0, 14]) {
    px(ctx, s.rail, ox + x, oy, 2, TILE);
    px(ctx, shadeHex(s.rail, 0.25), ox + x, oy, 1, TILE);
  }
}

// Cầu thang xuống: lỗ cầu thang trên sàn, các bậc thấp và tối dần về phía tường sau, lan can gỗ bên trái
function drawStairsDown(ctx, ox, oy) {
  const s = STAIR_WOOD;
  px(ctx, '#140c08', ox, oy, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const y = oy + 12 - i * 4;
    const dark = 0.12 + i * 0.16;
    px(ctx, shadeHex(s.tread, -dark), ox + 3, y, 12, 3);
    px(ctx, shadeHex(s.treadLight, -dark), ox + 3, y, 12, 1);
  }
  px(ctx, s.ink, ox, oy, 3, TILE);
  px(ctx, s.rail, ox, oy, 2, TILE);
  px(ctx, shadeHex(s.rail, 0.3), ox, oy, 1, TILE);
  for (const y of [1, 7, 13]) px(ctx, '#e0b078', ox, oy + y, 2, 1);
  px(ctx, s.ink, ox, oy + TILE - 1, TILE, 1);
}

// Ghế sofa nhìn từ trên xuống: lưng tựa sát một bên, đệm ngồi, tay vịn ở hai đầu bộ ghế.
// side: hướng người ngồi nhìn ('right' = lưng tựa bên trái). Hai ô sofa liền nhau dọc thì nối thành một ghế dài.
const SOFA = { ink: '#1a2a40', base: '#4a7ab0', light: '#7aa8d8', dark: '#2f5888', cushion: '#5a8cc4' };
function drawSofa(ctx, ox, oy, side, top, bottom) {
  const c = SOFA;
  // x tính theo sofa lưng tựa bên trái; lật ngang khi lưng tựa bên phải
  const at = (x, y, w, h, color) => px(ctx, color, side === 'right' ? ox + x : ox + TILE - x - w, oy + y, w, h);
  const y0 = top ? 1 : 0;
  const y1 = bottom ? 15 : 16;
  at(1, y0, 14, y1 - y0, c.ink);
  at(2, y0 + (top ? 1 : 0), 4, y1 - y0 - (top ? 1 : 0) - (bottom ? 1 : 0), c.dark); // lưng tựa
  at(2, y0 + (top ? 1 : 0), 1, y1 - y0 - (top ? 1 : 0) - (bottom ? 1 : 0), c.base);
  at(6, y0 + (top ? 1 : 0), 8, y1 - y0 - (top ? 1 : 0) - (bottom ? 1 : 0), c.cushion); // đệm
  at(6, y0 + (top ? 1 : 0), 8, 1, c.light);
  if (top) at(2, 1, 12, 3, c.base);
  if (top) at(3, 1, 10, 1, c.light);
  if (bottom) at(2, 12, 12, 3, c.base);
  if (bottom) at(2, 14, 12, 1, c.dark);
  if (!top) at(6, 0, 8, 1, c.dark); // đường may giữa hai đệm
}

// Tủ lạnh cao (sát tường thì vươn lên tường 8px): ngăn đá phía trên, tay nắm bạc, nam châm và tờ giấy dán
function drawFridge(ctx, ox, oy, tall) {
  const up = tall ? 8 : 0;
  const p = new PixelBuffer(TILE, TILE + up);
  p.rect(1, 0, 14, TILE + up, '#e8ecf4');
  p.rect(1, 0, 14, 1, '#ffffff');
  p.rect(11, 1, 4, TILE + up - 1, '#c8d0dc');
  p.rect(1, 6 + up / 2, 14, 1, '#7a8494');
  p.rect(3, 2, 1, 3 + up / 2, '#8a94a4');
  p.rect(3, 8 + up / 2, 1, 5, '#8a94a4');
  p.rect(6, 9 + up / 2, 2, 2, '#f0c040');
  p.rect(8, 11 + up / 2, 3, 3, '#ffffff');
  p.rect(8, 11 + up / 2, 3, 1, '#e86060');
  p.rect(1, TILE + up - 1, 14, 1, '#9aa4b4');
  p.outline(-0.6);
  p.drawTo(ctx, ox, oy - up);
}

// Bàn học sát tường: máy tính nhỏ và đèn bàn (nhô lên tường), mặt bàn gỗ có vở mở, ngăn kéo, ghế đẩu phía trước
function drawDesk(ctx, ox, oy) {
  const p = new PixelBuffer(TILE, 22);
  // màn hình máy tính trên bàn
  p.rect(7, 0, 8, 7, '#3a3e48');
  p.rect(8, 1, 6, 5, '#58a0e8');
  p.rect(8, 1, 3, 1, '#a8d8ff');
  p.rect(10, 7, 2, 1, '#3a3e48');
  // đèn bàn
  p.rect(1, 1, 4, 2, '#f0c040');
  p.rect(2, 3, 1, 4, '#5a5a68');
  // mặt bàn
  p.rect(0, 7, TILE, 6, '#c08850');
  p.rect(0, 7, TILE, 1, '#e0b078');
  p.rect(2, 8, 5, 3, '#f8f8f0'); // vở mở
  p.rect(4, 8, 1, 3, '#c8c8d0');
  p.rect(0, 13, TILE, 3, '#8a5a30');
  p.rect(9, 14, 4, 1, '#d8a868'); // tay nắm ngăn kéo
  p.rect(1, 16, 2, 4, '#6a4020');
  p.rect(13, 16, 2, 4, '#6a4020');
  // ghế đẩu kéo ra trước bàn
  p.rect(5, 17, 6, 3, '#a06a38');
  p.rect(5, 17, 6, 1, '#c89058');
  p.rect(6, 20, 1, 2, '#6a4020');
  p.rect(9, 20, 1, 2, '#6a4020');
  p.outline(-0.6);
  p.drawTo(ctx, ox, oy - 6);
}

// Tủ bếp treo tường phía trên quầy bếp (vẽ lên nửa dưới bức tường) và gạch ốp giữa tủ và mặt bếp
function drawWallCabinet(ctx, ox, oy, left, right) {
  const x0 = ox + (left ? 1 : 0);
  const w = TILE - (left ? 1 : 0) - (right ? 1 : 0);
  const inner = w - (left ? 1 : 0) - (right ? 1 : 0);
  px(ctx, '#4a3020', x0, oy - 14, w, 9);
  px(ctx, '#c08850', x0 + (left ? 1 : 0), oy - 13, inner, 7);
  px(ctx, '#d8a868', x0 + (left ? 1 : 0), oy - 13, inner, 1);
  px(ctx, '#8a5a30', ox + 8, oy - 13, 1, 7);
  px(ctx, '#f0d8a0', ox + 6, oy - 10, 1, 2);
  px(ctx, '#f0d8a0', ox + 10, oy - 10, 1, 2);
  px(ctx, '#e8e4dc', x0, oy - 5, w, 5);
  for (let i = 0; i < w; i += 4) px(ctx, '#c8c0b4', x0 + i, oy - 5, 1, 5);
  px(ctx, '#c8c0b4', x0, oy - 3, w, 1);
}

// Bếp: quầy nối liền, ô đầu là bồn rửa, các ô sau là bếp nấu
function drawKitchenTop(ctx, ox, oy, sink) {
  if (sink) {
    px(ctx, '#7a8494', ox + 4, oy + 3, 8, 5);
    px(ctx, '#b8c4d4', ox + 5, oy + 4, 6, 3);
    px(ctx, '#e8eef6', ox + 5, oy + 4, 2, 1);
    px(ctx, '#9aa4b4', ox + 7, oy + 2, 2, 1);
    return;
  }
  for (const x of [3, 9]) {
    px(ctx, '#2a2a30', ox + x, oy + 3, 4, 4);
    px(ctx, '#e06030', ox + x + 1, oy + 4, 2, 2);
  }
}

// Thảm trải sàn hình chữ nhật: nền, viền hoa văn, hoạ tiết hình thoi ở giữa
function drawRug(ctx, [x1, y1, x2, y2, base, edge]) {
  const ox = x1 * TILE + 3;
  const oy = y1 * TILE + 3;
  const w = (x2 - x1 + 1) * TILE - 6;
  const h = (y2 - y1 + 1) * TILE - 6;
  px(ctx, shadeHex(base, -0.35), ox - 1, oy - 1, w + 2, h + 2);
  px(ctx, base, ox, oy, w, h);
  px(ctx, edge, ox + 2, oy + 2, w - 4, 1);
  px(ctx, edge, ox + 2, oy + h - 3, w - 4, 1);
  px(ctx, edge, ox + 2, oy + 2, 1, h - 4);
  px(ctx, edge, ox + w - 3, oy + 2, 1, h - 4);
  for (let x = ox + 6; x < ox + w - 6; x += 6) {
    px(ctx, edge, x, oy + 4, 2, 1);
    px(ctx, edge, x, oy + h - 5, 2, 1);
  }
  const cx = ox + Math.floor(w / 2);
  const cy = oy + Math.floor(h / 2);
  for (let i = 0; i <= 6; i++) {
    px(ctx, shadeHex(base, 0.22), cx - (6 - i) * 2, cy - i, (6 - i) * 4, 1);
    px(ctx, shadeHex(base, 0.22), cx - (6 - i) * 2, cy + i, (6 - i) * 4, 1);
  }
}

function drawMat(ctx, ox, oy) {
  px(ctx, '#7a2810', ox + 1, oy + 3, 14, 12);
  px(ctx, '#e06030', ox + 2, oy + 4, 12, 10);
  for (const dy of [6, 9, 12]) px(ctx, '#f08850', ox + 2, oy + dy, 12, 1);
}

// Đồ treo trên tường sau (map.wallDecor: { cột x: 'photo' | 'poster' | 'calendar' | 'clock' }, dùng chung với bản 3D):
// vẽ trên hàng tường sát sàn, nằm dưới đồ đạc cao (tủ sách, tủ lạnh) nếu chồng lên nhau
function drawWallDecor(ctx, map) {
  let row = 0;
  while (row < map.height && isWall(map.tileAt(0, row))) row++;
  const oy = (row - 1) * TILE;
  for (const [col, kind] of Object.entries(map.wallDecor ?? {})) {
    const ox = Number(col) * TILE;
    const p = new PixelBuffer(TILE, TILE);
    if (kind === 'clock') {
      p.ellipse(8, 5, 5, 5, '#8a5a30');
      p.ellipse(8, 5, 4, 4, '#fffaf0');
      p.rect(8, 2, 1, 3, '#2a2030');
      p.rect(8, 5, 3, 1, '#2a2030');
      p.set(8, 5, '#c84040');
    } else if (kind === 'poster') {
      // áp phích Pokémon: nền trời, quả bóng, chữ
      p.rect(3, 0, 10, 12, '#f8f0d8');
      p.rect(4, 1, 8, 7, '#7ac0f0');
      p.ellipse(8, 5, 3, 3, '#f0f0f0');
      p.ellipse(8, 5, 3, 3, '#e04848', (x, y) => y < 5);
      p.rect(5, 5, 7, 1, '#2a2030');
      p.set(8, 5, '#ffffff');
      p.rect(5, 9, 6, 1, '#4a5a90');
      p.rect(5, 10, 4, 1, '#4a5a90');
    } else if (kind === 'calendar') {
      p.rect(4, 1, 8, 10, '#ffffff');
      p.rect(4, 1, 8, 3, '#e05050');
      for (let y = 5; y < 10; y += 2) for (let x = 5; x < 11; x += 2) p.set(x, y, '#8a94a4');
      p.set(9, 7, '#e05050');
      p.rect(7, 0, 2, 1, '#5a5a68');
    } else {
      // ảnh gia đình trong khung gỗ
      p.rect(4, 1, 8, 9, '#8a5a30');
      p.rect(5, 2, 6, 7, '#a8d0f0');
      p.rect(5, 6, 6, 3, '#7ab860');
      p.rect(6, 4, 2, 3, '#f0c8a0');
      p.rect(9, 5, 2, 2, '#f0c8a0');
    }
    p.outline(-0.5);
    p.drawTo(ctx, ox, oy + 1);
  }
}

export function drawInterior(map, ground, objects) {
  const t = THEMES[map.theme];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const ch = map.tileAt(x, y);
      const ox = x * TILE;
      const oy = y * TILE;
      // Tảng băng giữa sàn băng thì nền dưới nó cũng là băng
      const onIce = ch === 'o' && [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => map.tileAt(x + dx, y + dy) === 'i');
      if (isWall(ch)) drawWall(ground, ox, oy, !wallAbove(map.tileAt(x, y + 1)), t);
      else if (onIce) drawIce(ground, ox, oy, x, y);
      else if (ch === 'D') {
        drawWall(ground, ox, oy, true, t);
        drawBigDoor(ground, ox, oy, t);
      }
      else drawFloor(ground, ox, oy, x, y, t);
      if (ch !== 'Z' && map.tileAt(x, y - 1) === 'Z') px(ground, 'rgba(8,10,20,0.45)', ox, oy, TILE, 3);

      if (ch === 'c') drawCounter(objects, ox, oy, map.tileAt(x - 1, y) === 'c', map.tileAt(x + 1, y) === 'c', t);
      else if (ch === 'm' && map.tileAt(x - 1, y) !== 'm') drawMachine(objects, ox, oy);
      else if (ch === 'p') drawPlant(objects, ox, oy, x, y, isWall(map.tileAt(x, y - 1)));
      else if (ch === 'P') drawPC(objects, ox, oy);
      else if (ch === 'b') drawBench(objects, ox, oy);
      else if (ch === 'k' && map.shelfGoods === 'bikes') drawBikeStand(objects, ox, oy, x, y, isWall(map.tileAt(x, y - 1)));
      else if (ch === 'k') drawShelf(objects, ox, oy, x, y, isWall(map.tileAt(x, y - 1)));
      else if (ch === 'E') drawMat(ground, ox, oy);
      else if (ch === 'B') drawBed(objects, ox, oy, map.tileAt(x, y - 1) !== 'B', map.bedColor);
      else if (ch === 'V') drawTV(objects, ox, oy, map.tileAt(x - 1, y) !== 'V', map.tileAt(x + 1, y) !== 'V');
      else if (ch === 't') drawTable(objects, ox, oy, map, x, y, WOOD_TABLE);
      else if (ch === 'd') drawTable(objects, ox, oy, map, x, y, LAB_DESK);
      else if (ch === 'M') drawLabMachine(objects, ox, oy);
      else if (WIND_DIRS[ch]) (map.theme === 'gymWater' ? drawCurrent : drawWind)(ground, ox, oy, ch, x, y);
      else if (ch === 'H') drawHedge(objects, ox, oy);
      else if (ch === 'Z') drawPylon(objects, ox, oy, x, y, map);
      else if (ch === 'o' && BOULDERS[map.theme]) drawBoulder(objects, ox, oy, BOULDERS[map.theme]);
      else if (ch === 'o') drawPillar(objects, ox, oy);
      else if (ch === 'x') (map.theme === 'gymWater' ? drawWhirlpool : drawCoal)(ground, ox, oy, x, y);
      else if (ch === '~') drawDeepWater(ground, ox, oy, x, y, map);
      else if (ch === 'O') drawHole(ground, ox, oy);
      else if (ch === 'X' || ch === 'Y') drawVent(ground, ox, oy, ch === 'Y' ? 1 : 0);
      else if (ch === 'Q') drawPad(ground, ox, oy);
      else if (ch === 'i') drawIce(ground, ox, oy, x, y);
      else if (ch === 'K') drawKilnInside(objects, ox, oy);
      else if (ch === 'S') drawStairsUp(ground, ox, oy);
      else if (ch === 's') drawStairsDown(ground, ox, oy);
      else if (ch === '[' || ch === ']') drawSofa(objects, ox, oy, ch === '[' ? 'right' : 'left', map.tileAt(x, y - 1) !== ch, map.tileAt(x, y + 1) !== ch);
      else if (ch === 'F') drawFridge(objects, ox, oy, isWall(map.tileAt(x, y - 1)));
      else if (ch === 'w') drawDesk(objects, ox, oy);
      if (ch === 'c' && map.theme === 'home') {
        drawKitchenTop(objects, ox, oy, map.tileAt(x - 1, y) !== 'c');
        if (isWall(map.tileAt(x, y - 1))) drawWallCabinet(objects, ox, oy, map.tileAt(x - 1, y) !== 'c', map.tileAt(x + 1, y) !== 'c');
      }
    }
  }
  // Thảm vẽ trên sàn, dưới đồ đạc (đồ đạc nằm ở lớp objects phía trên)
  for (const rug of map.rugs ?? []) drawRug(ground, rug);
  drawWallDecor(ground, map);
}
