import { TILE } from '../config.js';
import { MAPS } from '../data/map.js';
import { dirtGrid, drawDecorTall, drawDecorTile, drawDirt } from './decor.js';
import { drawInterior } from './interior.js';
import { PixelBuffer, addCanvasTexture, dither, hash, makeCanvas, px, scale2x, shadeHex } from './pixel.js';

// Vẽ mỗi bản đồ thành 4 lớp ảnh pixel (mỗi ô 16x16):
//  <map>-ground  : nền (cỏ, đường, sàn, tường)
//  <map>-anim    : nước và hoa (cả nước ngầm trong hang), có ANIM_FRAMES frame chuyển động
//  <map>-objects : cây, nhà, đồ đạc
//  <map>-over    : phần ngọn cây nhô lên, vẽ đè lên nhân vật đứng phía sau cây
// và 2 ảnh 'grass-front*' để che chân nhân vật khi đứng trong cỏ cao.

export const ANIM_FRAMES = 3;

// Bảng màu kiểu GBA: nền cỏ xanh bạc hà, cỏ cao lá đậm có gân sáng
const GRASS = { light: '#a4e2b4', base: '#7cca96', mid: '#62b47e', dark: '#4a9a68', outline: '#2c6a44' };
const FOREST_FLOOR = '#4e9a68';
const TALL = { tip: '#a8e488', light: '#6cc060', mid: '#3e9a4a', dark: '#2a7a3c', base: '#5aae74' };
const TALL_DEEP = { tip: '#88cc74', light: '#4ea44e', mid: '#2e7e3e', dark: '#1e5e30', base: '#3e8e5a' };
const SAND = { light: '#ecd6a8', base: '#dcc08c', dark: '#c0a070', edge: '#9c7c50' };
const WATER = { light: '#9cd4fc', base: '#4c98e0', dark: '#2f6cc0', foam: '#e8f6ff', edge: '#2c5e2c' };

// Nền cỏ phẳng màu bạc hà, rải vài nhúm cỏ nhỏ hình chữ "v" (hai nét xiên) như GBA
function drawGrass(ctx, ox, oy, x, y) {
  px(ctx, GRASS.base, ox, oy, TILE, TILE);
  for (let i = 0; i < 2; i++) {
    if (hash(x, y, i) < 0.45) continue;
    const tx = ox + 2 + Math.floor(hash(x, y, i + 10) * 10);
    const ty = oy + 3 + Math.floor(hash(x, y, i + 20) * 9);
    for (const dx of [0, 4]) {
      px(ctx, GRASS.dark, tx + dx, ty);
      px(ctx, GRASS.dark, tx + dx + 1, ty + 1);
      px(ctx, GRASS.dark, tx + dx + 2, ty);
      px(ctx, GRASS.light, tx + dx + 1, ty + 2);
    }
  }
  if (hash(x, y, 7) > 0.8) px(ctx, GRASS.light, ox + Math.floor(hash(x, y, 8) * 14) + 1, oy + Math.floor(hash(x, y, 9) * 14) + 1);
}

// Một bụi cỏ cao kiểu GBA: các lá nhọn xoè ra từ gốc (lá trên dài nhất), mỗi lá có gân sáng ở giữa
function drawLeafPlant(p, cx, cy, pal, onlyLow = false) {
  const leaves = [[-90, 10], [-62, 10], [-118, 10], [-36, 9], [-144, 9], [-12, 8], [-168, 8], [14, 7], [166, 7], [40, 5], [140, 5]];
  for (const [deg, len] of leaves) {
    const a = (deg * Math.PI) / 180;
    if (onlyLow && Math.sin(a) < -0.6) continue;
    for (let r = 0; r <= len; r++) {
      const t = r / len;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      const width = t < 0.8 ? 1 : 0;
      for (let w = -width; w <= width; w++) {
        const nx = Math.round(x - Math.sin(a) * w);
        const ny = Math.round(y + Math.cos(a) * w);
        if (onlyLow && ny < cy - 1) continue;
        p.set(nx, ny, w === 0 && t > 0.15 ? (t > 0.75 ? pal.tip : pal.light) : t < 0.35 ? pal.dark : pal.mid);
      }
    }
  }
  p.set(cx, cy, pal.dark);
}

// Ô cỏ cao 16x16: một bụi lá lớn giữa ô. part 'front': chỉ nửa dưới bụi (che chân nhân vật đứng trong cỏ)
const tallGrassCache = new Map();
function tallGrassTile(pal, part) {
  const key = `${pal.base}-${part}`;
  if (!tallGrassCache.has(key)) {
    const p = new PixelBuffer(TILE, TILE);
    drawLeafPlant(p, 8, 12, pal, part === 'front');
    p.outline(-0.55);
    tallGrassCache.set(key, p);
  }
  return tallGrassCache.get(key);
}

function drawTallGrass(ctx, ox, oy, pal, part = 'all') {
  if (part === 'all') px(ctx, pal.base, ox, oy, TILE, TILE);
  tallGrassTile(pal, part).drawTo(ctx, ox, oy);
}

// Màu nền quanh đường đất / bờ nước: cỏ, hoặc tuyết ở bản đồ tuyết
const groundColor = (map) => (map.snow ? SNOW_GROUND : GRASS.base);
const SNOW_GROUND = '#e8f0f8';

function drawPath(ctx, ox, oy, x, y, map) {
  const ground = groundColor(map);
  px(ctx, SAND.base, ox, oy, TILE, TILE);
  for (let i = 0; i < 8; i++) {
    const tx = ox + Math.floor(hash(x, y, 40 + i) * 15);
    const ty = oy + Math.floor(hash(x, y, 50 + i) * 15);
    px(ctx, i % 3 === 0 ? SAND.light : SAND.dark, tx, ty);
    if (i % 4 === 1) px(ctx, SAND.edge, tx + 1, ty + 1);
  }
  // Cửa nhà, cửa hang cũng tính là đường (không có viền cỏ chắn trước cửa)
  // Sân đất nện (gfx/decor.js) cũng liền với đường
  const dirt = dirtGrid(map);
  const isPath = (nx, ny) => map.tileAt(nx, ny) === '=' || map.tileAt(nx, ny) === 'C' || map.doorAt(nx, ny) || dirt(nx, ny);
  // Viền cỏ lấn vào mép đường cho tự nhiên
  const edge = (side, i) => 1 + (hash(x * 16 + i, y * 16 + side, 7) < 0.35 ? 1 : 0);
  for (let i = 0; i < TILE; i++) {
    if (!isPath(x, y - 1)) { const d = edge(0, i); px(ctx, ground, ox + i, oy, 1, d); px(ctx, SAND.edge, ox + i, oy + d); }
    if (!isPath(x, y + 1)) { const d = edge(1, i); px(ctx, ground, ox + i, oy + TILE - d, 1, d); px(ctx, SAND.edge, ox + i, oy + TILE - d - 1); }
    if (!isPath(x - 1, y)) { const d = edge(2, i); px(ctx, ground, ox, oy + i, d, 1); px(ctx, SAND.edge, ox + d, oy + i); }
    if (!isPath(x + 1, y)) { const d = edge(3, i); px(ctx, ground, ox + TILE - d, oy + i, d, 1); px(ctx, SAND.edge, ox + TILE - d - 1, oy + i); }
  }
}

function drawWater(ctx, ox, oy, x, y, frame, map) {
  px(ctx, WATER.base, ox, oy, TILE, TILE);
  for (let i = 0; i < 3; i++) {
    const wx = Math.floor(hash(x, y, 30 + i) * 10) + 1;
    const wy = 3 + i * 5;
    const shift = ((frame + i) % ANIM_FRAMES) - 1;
    px(ctx, WATER.light, ox + wx + shift, oy + wy, 4, 1);
    px(ctx, WATER.dark, ox + ((wx + 6) % 11) + 1 - shift, oy + wy + 2, 3, 1);
  }
  // lấp lánh
  if (hash(x, y, 70 + frame) > 0.7) px(ctx, '#ffffff', ox + Math.floor(hash(x, y, 80 + frame) * 14) + 1, oy + Math.floor(hash(x, y, 85 + frame) * 14) + 1);

  // Ngoài mép bản đồ coi như nước (sông chảy tiếp ra khỏi bản đồ, không có bờ ở mép);
  // cầu gỗ cũng coi như nước (sông chảy dưới gầm cầu, không vẽ bờ hai bên cầu)
  const water = (nx, ny) => nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || 'wb'.includes(map.tileAt(nx, ny));
  // Giáp bãi cát thì ô cát tự vẽ mép bờ (bo tròn theo hình cồn cát), ô nước không kẻ bờ thẳng
  const shore = (nx, ny) => !water(nx, ny) && !sandy(map, nx, ny);
  const n = shore(x, y - 1);
  const s = shore(x, y + 1);
  const w = shore(x - 1, y);
  const e = shore(x + 1, y);
  if (n) { px(ctx, WATER.edge, ox, oy, TILE, 1); px(ctx, WATER.dark, ox, oy + 1, TILE, 2); px(ctx, WATER.foam, ox, oy + 3, TILE, 1); }
  if (s) { px(ctx, WATER.foam, ox, oy + 14, TILE, 1); px(ctx, WATER.edge, ox, oy + 15, TILE, 1); }
  if (w) { px(ctx, WATER.edge, ox, oy, 1, TILE); px(ctx, WATER.foam, ox + 1, oy, 1, TILE); }
  if (e) { px(ctx, WATER.foam, ox + 14, oy, 1, TILE); px(ctx, WATER.edge, ox + 15, oy, 1, TILE); }

  // Bo tròn góc lồi theo cung tròn bán kính 6px (ao nhỏ không thành ô vuông): (sx, sy) là hướng của góc
  const corner = (sx, sy) => {
    const X = (i) => (sx > 0 ? ox + TILE - 1 - i : ox + i);
    const Y = (j) => (sy > 0 ? oy + TILE - 1 - j : oy + j);
    const r = 6;
    for (let j = 0; j < r; j++) {
      for (let i = 0; i < r; i++) {
        const d = Math.hypot(r - i - 0.5, r - j - 0.5);
        const c = d > r ? groundColor(map) : d > r - 1 ? WATER.edge : d > r - 2 ? WATER.foam : sy < 0 && d > r - 4 ? WATER.dark : null;
        if (c) px(ctx, c, X(i), Y(j));
      }
    }
  };
  if (n && w) corner(-1, -1);
  if (n && e) corner(1, -1);
  if (s && w) corner(-1, 1);
  if (s && e) corner(1, 1);
}

function drawFlowers(ctx, ox, oy, x, y, frame) {
  const sway = frame === 1 ? 1 : 0;
  const flowers = [
    [4, 4, '#f05858'],
    [11, 10, '#f8f8f8'],
    [3 + Math.floor(hash(x, y, 60) * 2), 12, '#f8c040'],
  ];
  for (const [fx, fy, color] of flowers) {
    const cx = ox + fx;
    const cy = oy + fy;
    px(ctx, GRASS.dark, cx, cy + 1, 1, 2);
    const hx = cx + sway;
    px(ctx, shadeHex(color, -0.35), hx - 1, cy + 2, 3, 1);
    px(ctx, color, hx - 1, cy - 1, 3, 1);
    px(ctx, color, hx - 1, cy + 1, 3, 1);
    px(ctx, color, hx - 2, cy, 1, 1);
    px(ctx, color, hx + 2, cy, 1, 1);
    px(ctx, '#f8e060', hx - 1, cy, 3, 1);
    px(ctx, '#e08020', hx, cy, 1, 1);
  }
}

// Cồn cát: cát vàng nhạt lốm đốm, mép giáp nước có viền cát ướt sẫm hơn
const SANDBAR = { base: '#e8d49a', dark: '#d2b878', light: '#f6e8bc', wet: '#c8a868' };
function drawSand(ctx, ox, oy, x, y, map) {
  px(ctx, SANDBAR.base, ox, oy, TILE, TILE);
  for (let i = 0; i < 6; i++) {
    const sx = ox + Math.floor(hash(x, y, i + 80) * 15);
    const sy = oy + Math.floor(hash(x, y, i + 90) * 15);
    px(ctx, hash(x, y, i + 100) > 0.5 ? SANDBAR.dark : SANDBAR.light, sx, sy);
  }
  // Mép bờ do ô cát tự vẽ (ô nước bên cạnh không kẻ bờ): từ ngoài vào là bọt sóng -> mép bờ sẫm -> cát ướt -> cát khô
  const wet = (dx, dy) => map.tileAt(x + dx, y + dy) === 'w';
  const band = (t) => (t < 1 ? WATER.foam : t < 2 ? WATER.edge : t < 4 ? SANDBAR.wet : null);
  for (let t = 0; t < 4; t++) {
    const c = band(t);
    if (wet(0, -1)) px(ctx, c, ox, oy + t, TILE, 1);
    if (wet(0, 1)) px(ctx, c, ox, oy + TILE - 1 - t, TILE, 1);
    if (wet(-1, 0)) px(ctx, c, ox + t, oy, 1, TILE);
    if (wet(1, 0)) px(ctx, c, ox + TILE - 1 - t, oy, 1, TILE);
  }
  const at = (sx, sy, i, j) => [sx > 0 ? ox + TILE - 1 - i : ox + i, sy > 0 ? oy + TILE - 1 - j : oy + j];
  // Góc lồi giáp nước hai phía thì bo tròn (cồn cát nhỏ trông như đảo, không thành ô vuông).
  // Bán kính lớn gần cả ô: cồn cát 2x2 thành hình bầu dục, mũi cát nhô ra thành đầu tròn
  const R = 12;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    if (wet(sx, 0) && wet(0, sy)) {
      for (let j = 0; j < R; j++) {
        for (let i = 0; i < R; i++) {
          const u = R - Math.hypot(R - i - 0.5, R - j - 0.5); // khoảng cách vào trong tính từ mép cồn cát
          const c = u < 0.5 ? WATER.base : band(u - 0.5);
          if (c) px(ctx, c, ...at(sx, sy, i, j));
        }
      }
    } else if (!wet(sx, 0) && !wet(0, sy) && wet(sx, sy)) {
      // Góc lõm (nước chỉ ở ô chéo): mép bờ của hai ô cát bên cạnh vòng qua góc thành cung tròn
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const c = band(Math.hypot(i + 0.5, j + 0.5) - 0.5);
          if (c) px(ctx, c, ...at(sx, sy, i, j));
        }
      }
    }
  }
}

// Ô cát (cồn cát / bãi cát, gồm cả bụi lá mọc trên bãi cát): mép giáp nước do ô cát vẽ
function sandy(map, x, y) {
  const ch = map.tileAt(x, y);
  return ch === 'd' || (ch === 'h' && onSand(map, x, y));
}

// Hàng rào gỗ: cọc giữa ô, hai thanh ngang nối sang ô hàng rào bên trái / phải, thanh dọc nối lên / xuống
const FENCE = { post: '#b07840', dark: '#5a3a1c', light: '#e0aa68', rail: '#c08850', railDark: '#7a5028' };
function drawFence(ctx, ox, oy, x, y, map) {
  const at = (dx, dy) => map.tileAt(x + dx, y + dy) === 'H';
  const [left, right, up, down] = [at(-1, 0), at(1, 0), at(0, -1), at(0, 1)];
  // bóng đổ dưới chân hàng rào
  px(ctx, 'rgba(20,40,20,0.22)', ox + (left ? 0 : 5), oy + 14, (left ? 8 : 3) + (right ? 8 : 3), 2);
  if (left || right || (!up && !down)) {
    const x0 = left ? ox : ox + 5;
    const x1 = right ? ox + TILE : ox + 11;
    for (const ry of [5, 10]) {
      px(ctx, FENCE.rail, x0, oy + ry, x1 - x0, 2);
      px(ctx, FENCE.railDark, x0, oy + ry + 2, x1 - x0, 1);
    }
  }
  if (up) {
    px(ctx, FENCE.rail, ox + 7, oy, 2, 4);
    px(ctx, FENCE.railDark, ox + 9, oy, 1, 4);
  }
  if (down) {
    px(ctx, FENCE.rail, ox + 7, oy + 14, 2, 2);
    px(ctx, FENCE.railDark, ox + 9, oy + 14, 1, 2);
  }
  // cọc gỗ đầu vát, sáng mép trái
  px(ctx, FENCE.dark, ox + 6, oy + 2, 4, 13);
  px(ctx, FENCE.post, ox + 6, oy + 3, 3, 11);
  px(ctx, FENCE.light, ox + 6, oy + 3, 1, 10);
  px(ctx, FENCE.light, ox + 7, oy + 2, 2, 1);
}

// Bụi lá nhỏ trang trí (đi qua được): vài tầng lá xanh, sáng phía trên
function drawShrub(ctx, ox, oy, x, y) {
  const cx = ox + 5 + Math.floor(hash(x, y, 70) * 6);
  const cy = oy + 8 + Math.floor(hash(x, y, 71) * 4);
  px(ctx, '#1e5a28', cx - 4, cy + 2, 9, 1);
  px(ctx, '#2f7a34', cx - 4, cy - 1, 9, 3);
  px(ctx, '#2f7a34', cx - 3, cy - 3, 7, 2);
  px(ctx, '#4fa848', cx - 3, cy - 2, 6, 2);
  px(ctx, '#4fa848', cx - 1, cy - 4, 3, 1);
  px(ctx, '#86d060', cx - 2, cy - 3, 1, 1);
  px(ctx, '#86d060', cx + 1, cy - 4, 1, 1);
  px(ctx, '#86d060', cx + 2, cy - 2, 1, 1);
}

// Cây thông kiểu Gen 5: 32x48 (2 ô rộng, cao 3 ô: 16px trên cùng nhô lên ô phía trên),
// 4 tầng lá xếp chồng, sáng bên trái tối bên phải, mép răng cưa, viền xanh đậm
const PINE_GREENS = ['#163e26', '#235e32', '#33803c', '#4ea24a', '#7cc85a', '#b4e886'];
const SNOW = ['#a8c0d8', '#c8dcf0', '#e8f2fc', '#ffffff'];
const pineCache = {};
function pineTree(snow = false) {
  if (pineCache[snow]) return pineCache[snow];
  const p = new PixelBuffer(32, 48);
  p.rect(14, 39, 4, 7, '#5a3820');
  p.rect(14, 39, 1, 7, '#7a5030');
  const tiers = [[1, 13, 2, 8], [8, 23, 4, 12], [16, 33, 6, 14.5], [25, 42, 8, 15.5]];
  for (const [y0, y1, w0, w1] of tiers) {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / (y1 - y0);
      const hw = w0 + (w1 - w0) * t;
      for (let x = 0; x < 32; x++) {
        const dx = x + 0.5 - 16;
        // mép tầng lá lượn sóng tròn (vỏ sò) thay vì răng cưa
        const jag = (1 - Math.cos(((Math.abs(dx) + y * 0.5) / 3) * Math.PI)) * 0.6;
        if (Math.abs(dx) > hw - jag) continue;
        let v = 0.62 - dx / (hw * 2.4) - t * 0.32;
        if (y >= y1 - 1) v -= 0.28;
        const capped = snow && t < 0.45 - Math.abs(dx) / (hw * 4) + hash(x, y0, 7) * 0.1;
        p.set(x, y, capped ? dither(v + 0.3, x, y, SNOW) : dither(v, x, y, PINE_GREENS));
      }
    }
  }
  p.outline(-0.45);
  pineCache[snow] = p;
  return p;
}

// Vẽ cây cho khối 2x2 tại (ox, oy): thân và tán dưới vào lớp objects, phần nhô lên ô trên vào lớp over
function drawTree(objects, over, ox, oy, snow) {
  const p = pineTree(snow);
  p.drawTo(objects, ox, oy - 16, 16, 48);
  p.drawTo(over, ox, oy - 16, 0, 16);
}

// Bóng đổ mờ xuống nền phía dưới (cây, nhà)
function dropShadow(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(16,40,24,0.22)';
  ctx.fillRect(x, y, w, h);
}

// Bóng bầu dục dưới gốc cây (vẽ theo từng hàng pixel cho sắc nét)
function ovalShadow(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(16,40,24,0.28)';
  for (let j = -ry; j <= ry; j++) {
    const hw = Math.round(rx * Math.sqrt(1 - (j / (ry + 0.5)) ** 2));
    ctx.fillRect(cx - hw, cy + j, hw * 2, 1);
  }
}

// Màu mái nhà
const ROOFS = {
  house: { ink: '#3a2414', light: '#d8a070', base: '#b8703c', dark: '#8a4c24', mat: '#a85a30' },
  lab: { ink: '#2a3040', light: '#d8e0ea', base: '#a8b4c4', dark: '#7a8698', mat: '#5a6a80' },
  gym: { ink: '#1a3040', light: '#88d8e8', base: '#3aa0b8', dark: '#287890', mat: '#3a8aa0' },
  gymGrass: { ink: '#1e3a14', light: '#a8e078', base: '#5aa83a', dark: '#3a7a28', mat: '#4a8a30' },
  gymElectric: { ink: '#3a2a08', light: '#ffe880', base: '#e8b820', dark: '#b88a10', mat: '#c89818' },
  gymWater: { ink: '#0e2a50', light: '#88c0f8', base: '#3a7ae0', dark: '#2a58b0', mat: '#2a6ad0' },
  gymFire: { ink: '#3a1408', light: '#f8a060', base: '#d85a28', dark: '#a83a18', mat: '#c04a20' },
  gymRock: { ink: '#2a2420', light: '#c8b8a0', base: '#8a7860', dark: '#5e5040', mat: '#6a5a48' },
  gymPsychic: { ink: '#2a1040', light: '#e0a8f8', base: '#a858d8', dark: '#7a38a8', mat: '#8a48b8' },
  gymIce: { ink: '#14304a', light: '#e8f8ff', base: '#98d0f0', dark: '#68a8d0', mat: '#78b8e0' },
  store: { ink: '#3a1a08', light: '#f8b070', base: '#e07830', dark: '#b05818', mat: '#c86020' },
  bikeShop: { ink: '#0e3a34', light: '#88e0c8', base: '#30a888', dark: '#207a62', mat: '#2a9078' },
  league: { ink: '#2a1840', light: '#f8e088', base: '#d8a830', dark: '#a87818', mat: '#7a48b8' },
  houseRed: { ink: '#3a1010', light: '#f08868', base: '#c83a2a', dark: '#982818', mat: '#b03020' },
  houseYellow: { ink: '#3a2a08', light: '#f8d878', base: '#d8a030', dark: '#a87818', mat: '#b88820' },
  houseGreen: { ink: '#14301c', light: '#88c8a0', base: '#3a8a58', dark: '#286a40', mat: '#2a7a48' },
};

// Chữ pixel 5 dòng cho biển hiệu
const GLYPHS = {
  M: ['10001', '11011', '10101', '10001', '10001'],
  A: ['010', '101', '111', '101', '101'],
  R: ['110', '101', '110', '101', '101'],
  T: ['111', '010', '010', '010', '010'],
  L: ['100', '100', '100', '100', '111'],
  B: ['110', '101', '110', '101', '110'],
  G: ['011', '100', '101', '101', '011'],
  Y: ['101', '101', '010', '010', '010'],
  E: ['111', '100', '110', '100', '111'],
  U: ['101', '101', '101', '101', '111'],
  S: ['011', '100', '010', '001', '110'],
  H: ['101', '101', '111', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'],
};

function drawWord(ctx, word, x, y, color) {
  let cx = x;
  for (const ch of word) {
    GLYPHS[ch].forEach((row, j) => [...row].forEach((bit, i) => bit === '1' && px(ctx, color, cx + i, y + j)));
    cx += GLYPHS[ch][0].length + 1;
  }
}

const wordWidth = (word) => [...word].reduce((w, ch) => w + GLYPHS[ch][0].length + 1, -1);

// Khung nhà kiểu Gen 5: tường ốp ván, mái ngói xếp lớp có mạch so le, viền mái sáng. w: chiều rộng px (64 hoặc 80)
function drawShell(ctx, ox, oy, w, roof) {
  px(ctx, '#504038', ox + 2, oy + 26, w - 4, 34);
  px(ctx, '#f8f0d8', ox + 3, oy + 27, w - 6, 32);
  for (let r = 31; r < 58; r += 5) px(ctx, '#e6dabe', ox + 3, oy + r, w - 6, 1);
  px(ctx, '#e4d8b8', ox + w - 14, oy + 27, 11, 32);
  px(ctx, '#504038', ox + 1, oy + 58, w - 2, 6);
  px(ctx, '#a0a8b0', ox + 2, oy + 59, w - 4, 4);
  px(ctx, '#c8d0d8', ox + 2, oy + 59, w - 4, 1);
  for (let r = 0; r <= 27; r++) {
    const inset = r < 4 ? 4 - r : 0;
    px(ctx, roof.ink, ox + inset, oy + r, w - 2 * inset, 1);
    if (r < 1 || r > 25) continue;
    const row = Math.floor((r - 3) / 5);
    const color = r <= 2 ? roof.light : (r - 3) % 5 === 4 ? roof.dark : (r - 3) % 5 === 0 ? shadeHex(roof.base, 0.15) : roof.base;
    px(ctx, color, ox + inset + 1, oy + r, w - 2 - 2 * inset, 1);
    // mạch ngói dọc, so le giữa các hàng
    if (r > 3 && (r - 3) % 5 !== 4) {
      for (let x = (row % 2) * 4 + 4; x < w - 4; x += 8) px(ctx, shadeHex(roof.base, -0.18), ox + x, oy + r, 1, 1);
    }
  }
  // mép mái đổ bóng xuống tường
  px(ctx, '#b8a888', ox + 3, oy + 28, w - 6, 2);
  px(ctx, '#d0c4a4', ox + 3, oy + 30, w - 6, 1);
}

// Cửa sổ khung trắng, kính xanh có rèm và bậu cửa
function drawWindow(ctx, x, y) {
  px(ctx, '#506070', x, y, 16, 14);
  px(ctx, '#f8f8f8', x + 1, y + 1, 14, 12);
  px(ctx, '#88c4f0', x + 2, y + 2, 12, 10);
  px(ctx, '#d8f0ff', x + 3, y + 3, 3, 2);
  px(ctx, '#d8f0ff', x + 3, y + 5, 1, 2);
  px(ctx, '#f8f8f8', x + 7, y + 2, 2, 10);
  px(ctx, '#f8f8f8', x + 2, y + 6, 12, 1);
  px(ctx, '#e88888', x + 2, y + 2, 2, 4);
  px(ctx, '#e88888', x + 12, y + 2, 2, 4);
  px(ctx, '#504038', x - 1, y + 13, 18, 2);
  px(ctx, '#d8ccb0', x - 1, y + 13, 18, 1);
}
// Mép trái cửa (pixel, tính từ góc nhà): nhà lớn 5 ô cửa ở giữa, nhà nhỏ 4 ô cửa ở ô thứ 2
const DOOR_X = { center: 31, lab: 47, gym: 31, mart: 15, house: 15, store: 15, bikeShop: 15, league: 47 };

// Ô kính của cửa trên bản đồ (pixel 16px/ô), để làm hiệu ứng cửa trượt mở khi ra vào (phòng thí nghiệm: cửa gỗ ô kính)
export function doorGlass(building) {
  if (building.type === 'lab') return { x: building.x * TILE + DOOR_X.lab + 2, y: building.y * TILE + LAB_SIZE.roof + 6, w: 14, h: 15 };
  return { x: building.x * TILE + DOOR_X[building.type] + 1, y: building.y * TILE + 42, w: 16, h: 17 };
}

// Cửa kính có mái hiên, dx: mép trái cửa (rộng 18px)
function drawDoor(ctx, ox, oy, dx, roof) {
  px(ctx, roof.ink, ox + dx - 3, oy + 36, 24, 5);
  px(ctx, roof.base, ox + dx - 2, oy + 37, 22, 3);
  px(ctx, '#404a58', ox + dx, oy + 41, 18, 18);
  px(ctx, '#7ac0f0', ox + dx + 1, oy + 42, 16, 17);
  px(ctx, '#404a58', ox + dx + 8, oy + 42, 2, 17);
  px(ctx, '#c8ecff', ox + dx + 2, oy + 43, 3, 7);
  px(ctx, '#c8ecff', ox + dx + 11, oy + 43, 3, 7);
  px(ctx, roof.mat, ox + dx, oy + 59, 18, 4);
}

// Nhà lớn 80x64 (5x4 ô), cửa ở giữa: gym (biển GYM). Pokémon Center vẽ riêng (drawPokeCenter)
// roofKey: màu mái riêng (mặc định theo loại nhà)
function drawBigBuilding(ctx, ox, oy, type, roofKey) {
  const roof = ROOFS[roofKey ?? type];
  drawShell(ctx, ox, oy, 80, roof);
  px(ctx, roof.ink, ox + 27, oy + 5, 26, 18);
  px(ctx, '#fff8f0', ox + 28, oy + 6, 24, 16);
  drawWord(ctx, 'GYM', ox + 40 - Math.floor(wordWidth('GYM') / 2), oy + 12, roof.ink);
  drawWindow(ctx, ox + 9, oy + 33);
  drawWindow(ctx, ox + 55, oy + 33);
  drawDoor(ctx, ox, oy, DOOR_X[type], roof);
}

// Pokémon Center 80x64 (5x4 ô): mái bằng đỏ lợp ô vuông viền khung xám bo góc, mép mái trước đỏ sẫm, gờ mái xám;
// tường xám nhạt ốp ván ngang, dải kính xanh hai bên phía trên; giữa mặt tiền là tháp xám bo tròn nhô lên mái mang biểu tượng
// Poké Ball, mái hiên đỏ ngay dưới, cửa kính trượt hai cánh (ô kính khớp doorGlass), hai cột tối hai bên cửa
const PC = {
  frameHi: '#f2f4f8', frame: '#d4d8e0', frameMid: '#b4bac6', frameDark: '#868c9a',
  red: '#d8402a', redTile: '#ee6248', redHi: '#f8907a', redDark: '#a82c1c', redDeep: '#7e2014',
  wall: '#dfe3ea', wallLine: '#aeb4c0', wallDark: '#9aa0ac', pillar: '#4a505c', pillarLit: '#6a7280',
  glass: '#3a7ec8', glassLit: '#8ccaf4', glassDark: '#285c9c', glassFrame: '#2c3444',
};
let pokeCenterSprite = null;
function pokeCenterArt() {
  if (pokeCenterSprite) return pokeCenterSprite;
  const c = PC;
  const p = new PixelBuffer(80, 64);
  // Mái: khung xám bo góc bao quanh mặt mái đỏ
  const roundRect = (x, y, w, h, r, color) => {
    for (let j = 0; j < h; j++) {
      const dy = j < r ? r - j : j >= h - r ? j - (h - r - 1) : 0;
      const cut = dy ? Math.round(r - Math.sqrt(Math.max(0, r * r - dy * dy))) : 0;
      p.rect(x + cut, y + j, w - cut * 2, 1, color);
    }
  };
  roundRect(2, 1, 76, 30, 5, c.frameMid);
  roundRect(2, 1, 76, 28, 5, c.frame);
  roundRect(3, 1, 74, 3, 4, c.frameHi);
  // mặt mái đỏ (phần bằng phía trên) lợp ô vuông sáng, mép mái phía trước nghiêng đỏ sẫm
  roundRect(6, 4, 68, 19, 3, c.red);
  for (let y = 6; y < 21; y += 4) {
    for (let x = 8; x < 72; x += 5) {
      p.rect(x, y, 4, 3, c.redTile);
      p.rect(x, y, 4, 1, c.redHi);
      p.rect(x, y + 2, 4, 1, c.red);
    }
  }
  for (let j = 0; j < 5; j++) p.rect(6 + j, 22 + j, 68 - j * 2, 1, j === 0 ? c.redDark : c.redDeep);
  p.rect(6, 22, 68, 1, c.redDark);
  // gờ mái xám chạy ngang dưới mép mái
  p.rect(3, 27, 74, 3, c.frame);
  p.rect(3, 27, 74, 1, c.frameHi);
  p.rect(3, 30, 74, 1, c.frameDark);
  // Tường: ốp ván ngang xám nhạt, dải kính xanh phía trên hai bên, cột tối ở hai góc
  p.rect(4, 31, 72, 27, c.wall);
  for (let y = 43; y < 57; y += 3) p.rect(4, y, 72, 1, c.wallLine);
  p.rect(4, 31, 72, 2, c.wallDark);
  for (const [x0, x1] of [[7, 27], [53, 73]]) {
    p.rect(x0, 33, x1 - x0, 9, c.glassFrame);
    p.rect(x0 + 1, 34, x1 - x0 - 2, 7, c.glass);
    p.rect(x0 + 1, 34, x1 - x0 - 2, 1, c.glassDark);
    for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) p.set(x0 + 3 + k * 6 + i, 40 - i, c.glassLit);
    p.rect(Math.round((x0 + x1) / 2), 34, 1, 7, c.glassFrame);
    p.rect(x0 - 1, 42, x1 - x0 + 2, 1, c.wallDark); // bậu kính
  }
  for (const x of [4, 73]) {
    p.rect(x, 31, 3, 27, c.pillar);
    p.rect(x + 1, 31, 1, 27, c.pillarLit);
  }
  // Chân tường và bậc thềm
  p.rect(3, 57, 74, 2, c.pillar);
  p.rect(3, 59, 74, 4, '#a0a6b0');
  p.rect(3, 59, 74, 1, '#c8ccd4');
  // Hai cột tối hai bên cửa
  for (const x of [25, 51]) {
    p.rect(x, 40, 4, 19, c.pillar);
    p.rect(x + 1, 40, 1, 19, c.pillarLit);
  }
  // Cửa kính trượt (ô kính x 32-47, y 42-58 khớp doorGlass)
  p.rect(29, 41, 22, 18, c.glassFrame);
  p.rect(32, 42, 16, 17, c.glass);
  p.rect(32, 42, 16, 2, c.glassDark);
  p.rect(39, 42, 2, 17, c.glassFrame);
  for (const gx of [33, 42]) {
    for (let i = 0; i < 4; i++) p.set(gx + i, 48 - i, c.glassLit);
    for (let i = 0; i < 2; i++) p.set(gx + i, 51 - i, c.glassLit);
  }
  // Mái hiên đỏ trên cửa
  p.rect(24, 36, 32, 5, c.redDark);
  p.rect(25, 36, 30, 3, c.red);
  p.rect(25, 36, 30, 1, c.redHi);
  p.rect(26, 41, 28, 1, c.redDeep);
  // Tháp xám bo tròn nhô lên mái, ôm biểu tượng Poké Ball
  const cx = 40;
  const cy = 27;
  p.ellipse(cx, cy, 11, 11, c.frameMid, (x, y) => y <= cy + 4);
  p.ellipse(cx, cy, 10.2, 10.2, c.frame, (x, y) => y <= cy + 4);
  p.ellipse(cx, cy - 1, 9, 9, c.frameHi, (x, y) => y < cy - 7);
  p.rect(29, cy + 4, 22, 5, c.frame);
  p.rect(29, cy + 8, 22, 1, c.frameDark);
  // biểu tượng: vòng viền tối, nửa trên đỏ, nửa dưới trắng, nút tròn giữa
  p.ellipse(cx, cy, 7.6, 7.6, '#3a2020');
  p.ellipse(cx, cy, 6.6, 6.6, c.red, (x, y) => y < cy - 1);
  p.ellipse(cx, cy, 6.6, 6.6, '#f8f8f8', (x, y) => y > cy);
  p.ellipse(cx - 2, cy - 4, 2, 1.2, c.redHi);
  p.ellipse(cx, cy, 2.8, 2.8, '#3a2020');
  p.ellipse(cx, cy, 1.8, 1.8, '#ffffff');
  p.outline(-0.62);
  pokeCenterSprite = p;
  return p;
}
function drawPokeCenter(ctx, ox, oy) {
  pokeCenterArt().drawTo(ctx, ox, oy);
}

// Poké Mart 64x64 (4x4 ô): mái bằng xanh dương vát góc, lòng mái trũng tối, biển hiệu MART dựng đứng trên nóc đổ bóng
// xuống lòng mái, viền vàng dưới mép mái; mặt tiền là dãy kính xanh lớn (cửa kính ở ô thứ 2 khớp doorGlass), cột tối xen giữa
const MART = {
  blue: '#3e68c4', blueHi: '#7aa2ec', blueDark: '#2a4a96', blueDeep: '#1e3672',
  tray: '#2c3448', trayLit: '#3e485e', gold: '#d8a838', goldDark: '#a87a20',
  wall: '#e4e8ee', wallLine: '#c4cad4', pillar: '#3a404c', pillarLit: '#5a6270',
  glass: '#3a86c8', glassLit: '#a0d8f8', glassDark: '#2a62a0', glassFrame: '#2a3240',
};
let martSprite = null;
function martArt() {
  if (martSprite) return martSprite;
  const c = MART;
  const p = new PixelBuffer(64, 64);
  // Mái: khối bát giác xanh, lòng mái tối trũng xuống, mép trước dày có viền vàng
  const octo = (x, y, w, h, cut, color) => {
    for (let j = 0; j < h; j++) {
      const k = Math.max(0, cut - j, j - (h - 1 - cut));
      p.rect(x + k, y + j, w - k * 2, 1, color);
    }
  };
  octo(2, 4, 60, 26, 4, c.blue);
  octo(3, 4, 58, 2, 3, c.blueHi);
  octo(6, 8, 52, 14, 3, c.blueDeep);
  octo(7, 9, 50, 12, 3, c.tray);
  octo(11, 11, 42, 8, 2, c.trayLit);
  p.rect(4, 23, 56, 5, c.blueDark);
  p.rect(4, 23, 56, 1, c.blue);
  p.rect(3, 28, 58, 2, c.gold);
  p.rect(3, 29, 58, 1, c.goldDark);
  // Biển hiệu dựng trên nóc: mặt trên sáng, mặt trước xanh có khung trắng (chữ MART vẽ sau), bóng đổ xuống lòng mái
  p.rect(20, 15, 24, 3, '#20283a');
  p.rect(18, 1, 26, 14, c.blueDark);
  p.rect(19, 1, 24, 2, c.blueHi);
  p.rect(19, 3, 24, 11, c.blue);
  p.rect(20, 4, 22, 9, '#f4f8ff');
  p.rect(21, 5, 20, 7, c.blue);
  for (const lx of [22, 39]) p.rect(lx, 15, 1, 3, c.blueDeep); // chân biển
  // Tường và mặt tiền kính
  p.rect(3, 30, 58, 28, c.wall);
  for (let y = 33; y < 57; y += 3) p.rect(3, y, 58, 1, c.wallLine);
  p.rect(3, 30, 58, 2, '#9aa0ac');
  p.rect(5, 34, 54, 24, c.glassFrame);
  const pane = (x, y, w, h) => {
    p.rect(x, y, w, h, c.glass);
    p.rect(x, y, w, 1, c.glassDark);
    for (let i = 0; i < Math.min(w, h) - 2; i++) {
      p.set(x + 2 + i, y + h - 2 - i, c.glassLit);
      if (i < Math.min(w, h) - 5) p.set(x + 5 + i, y + h - 2 - i, c.glassLit);
    }
  };
  pane(7, 36, 7, 22);
  pane(16, 36, 16, 5); // ô kính trên cửa
  pane(35, 36, 22, 22);
  // cửa kính hai cánh (ô kính x 16-31, y 42-58)
  p.rect(16, 42, 16, 17, c.glass);
  p.rect(16, 42, 16, 1, c.glassDark);
  p.rect(23, 42, 2, 17, c.glassFrame);
  for (const gx of [17, 26]) {
    for (let i = 0; i < 4; i++) p.set(gx + i, 48 - i, c.glassLit);
    for (let i = 0; i < 2; i++) p.set(gx + i, 51 - i, c.glassLit);
  }
  for (const x of [3, 33, 59]) {
    p.rect(x, 32, 2, 26, c.pillar);
    p.set(x, 32, c.pillarLit);
    p.rect(x, 33, 1, 25, c.pillarLit);
  }
  // Chân tường và vỉa hè trước cửa
  p.rect(2, 57, 60, 2, c.pillar);
  p.rect(2, 59, 60, 4, '#a0a6b0');
  p.rect(2, 59, 60, 1, '#c8ccd4');
  p.outline(-0.62);
  martSprite = p;
  return p;
}
function drawPokeMart(ctx, ox, oy) {
  martArt().drawTo(ctx, ox, oy);
  drawWord(ctx, 'MART', ox + 31 - Math.floor(wordWidth('MART') / 2), oy + 6, '#ffffff');
}

// Phòng thí nghiệm 112x80 (7x5 ô), to hơn hẳn nhà dân: mái ngói vàng đất lợp ô vuông có mảng rêu cũ, khung kim loại
// xám sẫm bao quanh mái, hộp cửa sổ trời trên mái, ống thông gió; tường đá xám dưới mái với hai cặp cửa sổ kính xanh,
// cửa gỗ có ô kính (giữa ô thứ 4), đèn tường cạnh cửa và biển LAB trên mái hiên
const LAB = {
  frame: '#3e4048', frameLit: '#6a6e78', frameDark: '#26282e',
  tile: ['#d2a850', '#c89c44', '#dab45c'], tileDark: '#a8803a', tileLine: '#b48a3e', moss: '#a08848', mossDark: '#8a7440',
  stone: '#8e8a84', stoneLit: '#aaa69e', stoneDark: '#6a6660', mortar: '#5a5650',
  glassFrame: '#2e3446', glass: '#4a6ad0', glassLit: '#9ab8f8',
  wood: '#9a6634', woodLit: '#c08850', woodDark: '#5e3a1c',
};
export const LAB_SIZE = { w: 112, h: 80, roof: 52 };
function drawLab(ctx, ox, oy) {
  const c = LAB;
  const { w, h, roof } = LAB_SIZE;
  // Mái: các hàng ngói ô vuông 8x6, so le nửa viên giữa các hàng, màu lệch nhẹ theo viên; vài mảng ngói cũ sẫm màu
  px(ctx, c.frameDark, ox, oy, w, roof + 1);
  for (let r = 0; r * 6 < roof - 6; r++) {
    const y = oy + 4 + r * 6;
    const rowH = Math.min(6, oy + roof - 1 - y);
    for (let i = -1; i * 8 < w; i++) {
      const x = ox + 4 + i * 8 + (r % 2) * 4;
      const x0 = Math.max(ox + 4, x);
      const x1 = Math.min(ox + w - 4, x + 8);
      if (x1 <= x0) continue;
      const n = hash(i + 20, r, 401);
      const patch = hash(Math.floor((i + (r % 2) * 0.5) / 3), Math.floor(r / 2), 402) < 0.22;
      const base = patch ? (n < 0.5 ? c.moss : c.mossDark) : c.tile[Math.floor(n * 3)];
      px(ctx, base, x0, y, x1 - x0, rowH);
      px(ctx, shadeHex(base, 0.12), x0, y, x1 - x0, 1);
      if (rowH >= 6) px(ctx, c.tileDark, x0, y + 5, x1 - x0, 1);
      if (x >= ox + 4) px(ctx, c.tileLine, x, y + 1, 1, rowH - 2);
    }
  }
  // Khung kim loại: thanh nóc trên cùng, hai cột hai bên mái, xà mái hiên phía dưới
  px(ctx, c.frame, ox, oy, w, 4);
  px(ctx, c.frameLit, ox + 1, oy + 1, w - 2, 1);
  for (const fx of [0, w - 4]) {
    px(ctx, c.frame, ox + fx, oy, 4, roof);
    px(ctx, c.frameLit, ox + fx + 1, oy + 1, 1, roof - 2);
    px(ctx, c.frameDark, ox + fx + 3, oy + 4, 1, roof - 4);
    for (let y = 10; y < roof - 4; y += 12) px(ctx, '#9aa0aa', ox + fx + 1, oy + y, 2, 2); // đinh tán
  }
  px(ctx, c.frame, ox, oy + roof - 4, w, 5);
  px(ctx, c.frameLit, ox + 1, oy + roof - 4, w - 2, 1);
  px(ctx, c.frameDark, ox, oy + roof, w, 1);
  // Hộp cửa sổ trời trên mái (góc trên trái): mặt trên sáng, mặt trước có ô kính tối phản chiếu trời
  const sx = ox + 12;
  const sy = oy + 7;
  px(ctx, c.frameDark, sx - 1, sy - 1, 30, 25);
  px(ctx, '#e6dece', sx, sy, 28, 6);
  px(ctx, '#f6f0e4', sx, sy, 28, 1);
  px(ctx, '#c8bca6', sx, sy + 6, 28, 17);
  px(ctx, '#aa9e88', sx + 22, sy + 6, 6, 17);
  px(ctx, c.glassFrame, sx + 4, sy + 9, 17, 9);
  px(ctx, '#3a4a6a', sx + 5, sy + 10, 15, 7);
  px(ctx, '#8aa8d8', sx + 6, sy + 11, 4, 1);
  px(ctx, '#6a88c0', sx + 6, sy + 12, 2, 1);
  px(ctx, 'rgba(40,24,10,0.3)', sx, sy + 23, 30, 2); // bóng đổ xuống mái
  // Ống thông gió nhỏ bên phải mái
  px(ctx, c.frameDark, ox + 86, oy + 10, 10, 12);
  px(ctx, '#9aa0aa', ox + 87, oy + 11, 8, 10);
  px(ctx, '#c8ced8', ox + 87, oy + 11, 8, 2);
  px(ctx, '#6a707a', ox + 87, oy + 15, 8, 1);
  px(ctx, 'rgba(40,24,10,0.3)', ox + 86, oy + 22, 11, 2);
  // Biển LAB trên mái hiên, ngay trên cửa
  px(ctx, c.frameDark, ox + 42, oy + roof - 13, 28, 11);
  px(ctx, '#f6f8fa', ox + 43, oy + roof - 12, 26, 9);
  drawWord(ctx, 'LAB', ox + 56 - Math.floor(wordWidth('LAB') / 2), oy + roof - 10, '#3a5ab8');

  // Tường đá dưới mái: các viên đá xây so le, mạch vữa sẫm, mép trên khuất bóng mái
  const wy = oy + roof + 1;
  const wh = h - roof - 3;
  px(ctx, c.mortar, ox + 2, wy, w - 4, wh);
  for (let r = 0; r * 5 < wh; r++) {
    const y = wy + r * 5;
    const rh = Math.min(4, wy + wh - y);
    for (let i = -1; i * 10 < w; i++) {
      const x0 = Math.max(ox + 2, ox + 2 + i * 10 + (r % 2) * 5);
      const x1 = Math.min(ox + w - 2, ox + 2 + i * 10 + (r % 2) * 5 + 9);
      if (x1 <= x0) continue;
      const n = hash(i + 40, r, 403);
      const base = n < 0.3 ? c.stoneDark : n < 0.8 ? c.stone : c.stoneLit;
      px(ctx, base, x0, y, x1 - x0, rh);
      px(ctx, shadeHex(base, 0.15), x0, y, x1 - x0, 1);
    }
  }
  px(ctx, 'rgba(20,16,10,0.35)', ox + 2, wy, w - 4, 3);
  // Chân tường
  px(ctx, c.frameDark, ox + 1, oy + h - 3, w - 2, 3);
  px(ctx, '#7a7670', ox + 2, oy + h - 3, w - 4, 1);
  // Hai cặp cửa sổ kính xanh hai bên cửa
  for (const wx of [8, 26, 72, 90]) {
    const x = ox + wx;
    const y = wy + 4;
    px(ctx, c.glassFrame, x, y, 14, 13);
    px(ctx, c.glass, x + 1, y + 1, 12, 11);
    px(ctx, c.glassLit, x + 2, y + 2, 3, 1);
    px(ctx, c.glassLit, x + 2, y + 3, 1, 3);
    px(ctx, c.glassFrame, x + 7, y + 1, 1, 11);
    px(ctx, '#d8d4cc', x - 1, y + 13, 16, 2); // bậu cửa
    px(ctx, '#f0ece4', x - 1, y + 13, 16, 1);
  }
  // Cửa gỗ có ô kính (giữa ô thứ 4): khung gỗ sẫm, cánh cửa, kính xanh (WorldScene.openDoor vẽ khe tối đè lên ô kính)
  const dx = ox + DOOR_X.lab;
  const dy = wy + 1;
  px(ctx, c.woodDark, dx - 1, dy, 20, h - roof - 3);
  px(ctx, c.wood, dx, dy + 1, 18, h - roof - 4);
  px(ctx, c.woodLit, dx, dy + 1, 18, 1);
  px(ctx, c.glassFrame, dx + 1, dy + 3, 16, 17);
  px(ctx, c.glass, dx + 2, dy + 4, 14, 15);
  px(ctx, c.glassLit, dx + 3, dy + 5, 3, 1);
  px(ctx, c.glassLit, dx + 3, dy + 6, 1, 4);
  px(ctx, c.glassFrame, dx + 8, dy + 4, 2, 15);
  px(ctx, '#f0d070', dx + 14, dy + 12, 2, 2); // tay nắm
  px(ctx, '#7a6a5a', dx - 3, oy + h - 2, 24, 2); // bậc thềm
  // Đèn tường cạnh cửa
  px(ctx, c.frameDark, dx + 22, dy + 3, 5, 6);
  px(ctx, '#ffe890', dx + 23, dy + 4, 3, 4);
}

// Cửa sổ áp mái của nhà 2 tầng (phòng ngủ tầng trên): mái nhỏ hình tam giác, cửa sổ kính, bậu cửa
function drawDormer(ctx, ox, oy, roof) {
  for (let r = 0; r < 6; r++) {
    px(ctx, roof.ink, ox + 6 - r - 1, oy + r, (r + 1) * 2 + 2, 1);
    px(ctx, r < 2 ? roof.light : roof.base, ox + 6 - r, oy + r, (r + 1) * 2, 1);
  }
  px(ctx, roof.ink, ox, oy + 6, 14, 1);
  px(ctx, '#504038', ox + 1, oy + 7, 12, 10);
  px(ctx, '#f8f0d8', ox + 2, oy + 7, 10, 9);
  px(ctx, '#506070', ox + 3, oy + 8, 8, 7);
  px(ctx, '#88c4f0', ox + 4, oy + 9, 6, 5);
  px(ctx, '#d8f0ff', ox + 4, oy + 9, 2, 2);
  px(ctx, '#f8f8f8', ox + 6, oy + 9, 1, 5);
  px(ctx, '#504038', ox, oy + 16, 14, 2);
  px(ctx, '#d8ccb0', ox, oy + 16, 14, 1);
}

// Biển hiệu nhà nhỏ: Trung tâm thương mại, tiệm xe đạp (Poké Mart vẽ riêng: drawPokeMart)
const SMALL_SIGNS = { store: 'SHOP', bikeShop: 'BIKE' };

// Nhà nhỏ 64x64 (4x4 ô), cửa ở ô thứ 2: cửa hàng (có biển hiệu), nhà dân
function drawSmallBuilding(ctx, ox, oy, type, roofKey, floors = 1) {
  const roof = ROOFS[roofKey ?? type];
  drawShell(ctx, ox, oy, 64, roof);
  if (floors === 2) drawDormer(ctx, ox + 14, oy + 6, roof);
  const word = SMALL_SIGNS[type];
  if (word) {
    px(ctx, roof.ink, ox + 17, oy + 6, 30, 15);
    px(ctx, '#ffffff', ox + 18, oy + 7, 28, 13);
    drawWord(ctx, word, ox + 32 - Math.floor(wordWidth(word) / 2), oy + 11, roof.dark);
  } else {
    // ống khói
    px(ctx, roof.ink, ox + 44, oy - 0, 10, 12);
    px(ctx, '#a05a3a', ox + 45, oy + 1, 8, 10);
  }
  drawWindow(ctx, ox + 38, oy + 33);
  drawDoor(ctx, ox, oy, DOOR_X[type], roof);
}

// Toà nhà Liên minh 112x64 (7x4 ô): mái vàng, biển LEAGUE, hai cột đá hai bên cửa, cờ tím trên nóc
function drawLeague(ctx, ox, oy) {
  const roof = ROOFS.league;
  drawShell(ctx, ox, oy, 112, roof);
  px(ctx, roof.ink, ox + 40, oy + 5, 32, 17);
  px(ctx, '#fff8e0', ox + 41, oy + 6, 30, 15);
  drawWord(ctx, 'LEAGUE', ox + 56 - Math.floor(wordWidth('LEAGUE') / 2), oy + 11, '#7a48b8');
  for (const fx of [6, 102]) {
    px(ctx, '#3a2a20', ox + fx + 1, oy - 6, 1, 12);
    px(ctx, '#7a48b8', ox + fx + 2, oy - 6, 6, 4);
    px(ctx, '#f8e088', ox + fx + 3, oy - 5, 2, 2);
  }
  for (const cx of [36, 70]) {
    px(ctx, '#504038', ox + cx, oy + 30, 6, 29);
    px(ctx, '#e8e0d0', ox + cx + 1, oy + 30, 4, 29);
    px(ctx, '#c8bca8', ox + cx + 4, oy + 30, 1, 29);
    px(ctx, '#d8a830', ox + cx, oy + 30, 6, 2);
  }
  drawWindow(ctx, ox + 10, oy + 33);
  drawWindow(ctx, ox + 86, oy + 33);
  drawDoor(ctx, ox, oy, DOOR_X.league, roof);
}

const BUILDING_DRAW = {
  league: (ctx, ox, oy) => drawLeague(ctx, ox, oy),
  center: (ctx, ox, oy) => drawPokeCenter(ctx, ox, oy),
  lab: (ctx, ox, oy) => drawLab(ctx, ox, oy),
  gym: (ctx, ox, oy, roof) => drawBigBuilding(ctx, ox, oy, 'gym', roof),
  mart: (ctx, ox, oy) => drawPokeMart(ctx, ox, oy),
  house: (ctx, ox, oy, roof, floors) => drawSmallBuilding(ctx, ox, oy, 'house', roof, floors),
  store: (ctx, ox, oy, roof) => drawSmallBuilding(ctx, ox, oy, 'store', roof),
  bikeShop: (ctx, ox, oy, roof) => drawSmallBuilding(ctx, ox, oy, 'bikeShop', roof),
};

// Biển báo gỗ kiểu Gen 5: tấm ván có viền sáng, hai chân cọc
function drawSign(ctx, ox, oy) {
  px(ctx, 'rgba(16,40,24,0.25)', ox + 3, oy + 14, 11, 2);
  for (const lx of [4, 10]) {
    px(ctx, '#3a2410', lx + ox, oy + 9, 3, 6);
    px(ctx, '#8a5a30', lx + ox + 1, oy + 9, 1, 5);
  }
  px(ctx, '#3a2410', ox + 1, oy + 1, 14, 10);
  px(ctx, '#b07840', ox + 2, oy + 2, 12, 8);
  px(ctx, '#d8a060', ox + 2, oy + 2, 12, 1);
  px(ctx, '#d8a060', ox + 2, oy + 2, 1, 8);
  px(ctx, '#8a5a30', ox + 2, oy + 9, 12, 1);
  px(ctx, '#f0e0c0', ox + 4, oy + 4, 8, 1);
  px(ctx, '#f0e0c0', ox + 4, oy + 6, 6, 1);
}
// Vách núi: mặt núi nền đá nâu lổn nhổn những tảng đá tròn (sáng phía trên trái, tối phía dưới phải),
// mép viền đậm bo góc; hàng cuối khối núi là mặt vách cao gần cả ô, có gờ sáng, các lớp đá ngang và vết nứt dọc
const ROCK = {
  top: '#e6d4ae', light: '#d4bc94', base: '#b89c78', dark: '#8c7054', face: '#9a7a5a', faceDark: '#765a40', ink: '#4a3626',
};
// Tảng đá tròn tâm (cx, cy) bán kính r, chỉ vẽ trong khung (ox, oy, size)
function drawBoulder(ctx, ox, oy, cx, cy, r, size = TILE) {
  for (let j = -r; j <= r; j++) {
    for (let i = -r - 1; i <= r + 1; i++) {
      const d = (i / (r + 1)) ** 2 + (j / r) ** 2;
      if (d > 1) continue;
      const X = cx + i;
      const Y = cy + j;
      if (X < ox || X >= ox + size || Y < oy || Y >= oy + size) continue;
      const edge = d > 0.62 && i + j > 0;
      const lit = i + j < -r * 0.6;
      px(ctx, edge ? ROCK.ink : lit ? ROCK.top : i + j > r * 0.4 ? ROCK.dark : ROCK.light, X, Y);
    }
  }
}
// Mặt vách đá từ hàng y0 tới y1 (toạ độ trong ô): lớp đá ngang so le, vết nứt dọc, gờ sáng phía trên
function drawCliffFace(ctx, ox, oy, x, y, y0, y1) {
  px(ctx, ROCK.face, ox, oy + y0, TILE, y1 - y0);
  for (let ly = y0 + 4; ly < y1 - 1; ly += 5) {
    for (let i = 0; i < TILE; i++) if (hash(x * 16 + i, y * 16 + ly, 260) > 0.2) px(ctx, ROCK.faceDark, ox + i, oy + ly, 1, 1);
    px(ctx, ROCK.light, ox + Math.floor(hash(x, y * 16 + ly, 270) * 11) + 2, oy + ly - 1, 3, 1);
  }
  for (let k = 0; k < 2; k++) {
    const cx = ox + 2 + Math.floor(hash(x, y, 280 + k) * 12);
    const cy = oy + y0 + 1 + Math.floor(hash(x, y, 290 + k) * Math.max(1, y1 - y0 - 6));
    px(ctx, ROCK.faceDark, cx, cy, 1, 5);
    px(ctx, ROCK.ink, cx, cy + 1, 1, 3);
  }
}
function drawRock(ctx, ox, oy, x, y, map) {
  const rock = (nx, ny) => ['R', 'C'].includes(map.tileAt(nx, ny));
  // Vách cao 2 ô: hàng cuối khối núi là mặt vách cả ô, hàng trên nó là gờ núi + nửa trên mặt vách
  const lower = !rock(x, y + 1);
  const upper = !lower && !rock(x, y + 2);
  const thin = lower && !rock(x, y - 1); // dải núi chỉ dày 1 ô: gờ trên + mặt vách trong cùng ô
  const lip = upper || thin ? 5 : lower ? -1 : TILE; // hàng gờ (mép trên của mặt vách) trong ô
  px(ctx, ROCK.base, ox, oy, TILE, TILE);
  if (lip > 0) {
    // Mặt núi: sạn đá lấm tấm và tảng đá tròn
    for (let i = 0; i < 4; i++) {
      const dx = Math.floor(hash(x, y, 200 + i) * 15);
      const dy = Math.floor(hash(x, y, 210 + i) * (lip - 1));
      px(ctx, i % 2 ? ROCK.dark : ROCK.light, ox + dx, oy + dy, 2, 1);
    }
    // Thỉnh thoảng một bụi cỏ nhỏ mọc trên núi
    if (lip === TILE && hash(x, y, 215) < 0.22) {
      const gx = ox + 3 + Math.floor(hash(x, y, 216) * 9);
      const gy = oy + 4 + Math.floor(hash(x, y, 217) * 8);
      px(ctx, GRASS.dark, gx, gy + 2, 5, 1);
      for (const [dx, h] of [[0, 2], [2, 3], [4, 2]]) px(ctx, GRASS.mid, gx + dx, gy + 2 - h, 1, h);
      px(ctx, GRASS.light, gx + 2, gy - 1, 1, 1);
    }
    const room = lip - 6;
    for (let k = 0; k < 2; k++) {
      if (room < 0 || hash(x, y, 220 + k) < (k ? 0.5 : 0.15)) continue;
      const r = 2 + Math.floor(hash(x, y, 230 + k) * (lip === TILE ? 2 : 1));
      drawBoulder(ctx, ox, oy, ox + 3 + Math.floor(hash(x, y, 240 + k) * 10), oy + 3 + Math.floor(hash(x, y, 250 + k) * (room + 1)), r);
    }
  }
  if (lip < TILE) {
    if (lip > 0) {
      px(ctx, ROCK.ink, ox, oy + lip, TILE, 1);
      px(ctx, ROCK.top, ox, oy + lip - 1, TILE, 1);
    }
    drawCliffFace(ctx, ox, oy, x, y, Math.max(lip + 1, 0), lower ? 14 : TILE);
    if (lower) {
      px(ctx, ROCK.faceDark, ox, oy + 14, TILE, 1);
      px(ctx, ROCK.ink, ox, oy + 15, TILE, 1);
    }
  }
  // Viền khối núi: mép ngoài đậm, ngay trong là gờ sáng; góc ngoài bo tròn
  const n = !rock(x, y - 1);
  const w = !rock(x - 1, y);
  const e = !rock(x + 1, y);
  const top = Math.max(0, Math.min(lip, TILE)); // phần mặt núi trong ô
  if (n) {
    px(ctx, ROCK.ink, ox, oy, TILE, 1);
    px(ctx, ROCK.top, ox, oy + 1, TILE, 2);
  }
  if (w) {
    px(ctx, ROCK.ink, ox, oy, 1, TILE);
    if (top) px(ctx, ROCK.top, ox + 1, oy + (n ? 1 : 0), 2, top);
    if (top < TILE) px(ctx, ROCK.light, ox + 1, oy + top + 1, 1, TILE - top - (lower ? 2 : 1));
  }
  if (e) {
    if (top) px(ctx, ROCK.dark, ox + 13, oy + (n ? 1 : 0), 2, top);
    if (top < TILE) px(ctx, ROCK.faceDark, ox + 13, oy + top + 1, 2, TILE - top - (lower ? 2 : 1));
    px(ctx, ROCK.ink, ox + 15, oy, 1, TILE);
  }
  const corner = (sx, sy) => {
    const X = (i) => (sx > 0 ? ox + TILE - 1 - i : ox + i);
    const Y = (j) => (sy > 0 ? oy + TILE - 1 - j : oy + j);
    for (const [i, j] of [[0, 0], [1, 0], [0, 1]]) px(ctx, groundColor(map), X(i), Y(j));
    px(ctx, ROCK.ink, X(2), Y(0));
    px(ctx, ROCK.ink, X(1), Y(1));
    px(ctx, ROCK.ink, X(0), Y(2));
  };
  if (n && w) corner(-1, -1);
  if (n && e) corner(1, -1);
  if (lower && w) corner(-1, 1);
  if (lower && e) corner(1, 1);
}

// Mỏm đá nhỏ (cụm vách đá R chỉ 1-3 ô, đứng riêng giữa bãi cỏ): vẽ thành tảng đá tròn nằm trên nền thay vì khối vách
// vuông như cái hộp. Bản đồ graves (nghĩa trang) giữ kiểu khối vuông nhỏ làm bia mộ
const pileCache = new WeakMap();
function rockPiles(map) {
  if (pileCache.has(map)) return pileCache.get(map);
  const piles = new Set();
  const seen = new Set();
  if (!map.graves) {
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tileAt(x, y) !== 'R' || seen.has(`${x},${y}`)) continue;
        const group = [];
        const queue = [[x, y]];
        let touchesCave = false;
        while (queue.length) {
          const [cx, cy] = queue.pop();
          const key = `${cx},${cy}`;
          if (seen.has(key)) continue;
          seen.add(key);
          group.push(key);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ch = map.tileAt(cx + dx, cy + dy);
            if (ch === 'C') touchesCave = true;
            if (ch === 'R' && cx + dx >= 0 && cy + dy >= 0 && cx + dx < map.width && cy + dy < map.height) queue.push([cx + dx, cy + dy]);
          }
        }
        if (group.length <= 3 && !touchesCave) group.forEach((k) => piles.add(k));
      }
    }
  }
  pileCache.set(map, piles);
  return piles;
}
function drawRockPile(ground, objects, ox, oy, x, y, map) {
  const big = hash(x, y, 620) < 0.6;
  const cx = 8 + Math.round((hash(x, y, 621) - 0.5) * 2);
  const rx = big ? 7 : 6.2;
  const ry = big ? 6 : 5.4;
  const cy = 15 - ry;
  // bóng đổ dưới chân đá
  ground.fillStyle = 'rgba(16,40,24,0.26)';
  for (let j = -2; j <= 2; j++) {
    const hw = Math.round((rx + 1) * Math.sqrt(1 - (j / 2.5) ** 2));
    ground.fillRect(ox + cx - hw, oy + 14 + j, hw * 2, 1);
  }
  const p = new PixelBuffer(TILE, TILE);
  p.ellipse(cx, cy, rx, ry, ROCK.base);
  // sáng phía trên trái, tối phía dưới phải, mặt đáy sẫm
  p.recolor(ROCK.light, (bx, by) => (bx - cx) + (by - cy) * 1.3 < -3);
  p.recolor(ROCK.top, (bx, by) => (bx - cx) + (by - cy) * 1.3 < -7);
  p.recolor(ROCK.dark, (bx, by) => (bx - cx) + (by - cy) * 1.2 > 4);
  p.recolor(ROCK.faceDark, (bx, by) => by > cy + ry - 2.2);
  // vết nứt và đốm sạn
  const kx = Math.round(cx - 1 + hash(x, y, 622) * 3);
  for (let k = 0; k < 3; k++) p.set(kx + (k === 2 ? 1 : 0), Math.round(cy - 2 + k), ROCK.ink);
  p.set(Math.round(cx + 3), Math.round(cy + 1), ROCK.face);
  p.set(Math.round(cx - 3), Math.round(cy + 2), ROCK.dark);
  // bản đồ tuyết: chỏm tuyết trên đỉnh đá
  if (map.snow) p.recolor('#f4f8fc', (bx, by) => by < cy - ry * 0.35 && (bx - cx) < rx * 0.6);
  // hòn sỏi nhỏ cạnh tảng đá
  if (hash(x, y, 623) < 0.5) {
    const sx = hash(x, y, 624) < 0.5 ? 1 : 13;
    p.rect(sx, 12, 2, 2, ROCK.light);
    p.set(sx + 1, 13, ROCK.dark);
  }
  p.outline(-0.6);
  p.drawTo(objects, ox, oy);
}

// Gờ đất (ledge) kiểu GBA: dải dốc dày ~8px màu đá như vách núi, mép trên bo tròn sáng, mặt dốc có gân, mép dưới lượn sóng,
// viền tối và bóng đổ xuống phía thấp. v: gờ ngang (phía bắc cao, nhảy xuống nam) • < / >: gờ dọc (phía đông / tây cao,
// nhảy sang trái / phải) • J: góc gờ chữ L nối gờ dọc phía trên với gờ ngang bên cạnh
// Màu đá như vách núi (ROCK), bóng đổ xuống nền cỏ
const LEDGE = { lip: ROCK.top, top: ROCK.light, face: ROCK.face, faceLight: ROCK.base, vein: ROCK.faceDark, ink: ROCK.ink, shade: '#5a9e72' };
const LEDGE_TOP = 5; // gờ ngang chiếm hàng 5-14 trong ô
const isLedge = (ch) => ch === 'v' || ch === '<' || ch === '>' || ch === 'J';

// Một cột pixel của gờ ngang tại X (toạ độ tuyệt đối trong ảnh), u: toạ độ dọc gờ để vân lặp đều
function ledgeSliceH(ctx, X, oy, u) {
  const t = LEDGE_TOP;
  const wave = u % 4 === 0 || u % 4 === 3 ? 1 : 0; // mép dưới lượn sóng: cứ 4px một khối tròn
  px(ctx, LEDGE.lip, X, oy + t, 1, 1);
  px(ctx, LEDGE.top, X, oy + t + 1, 1, 1);
  px(ctx, LEDGE.faceLight, X, oy + t + 2, 1, 2);
  px(ctx, u % 4 === 1 ? LEDGE.vein : LEDGE.face, X, oy + t + 4, 1, 3 + wave);
  px(ctx, LEDGE.ink, X, oy + t + 7 + wave, 1, 1);
  px(ctx, LEDGE.shade, X, oy + t + 8 + wave, 1, 1 - wave + 1);
}

// Một hàng pixel của gờ dọc tại Y; side 'left': mặt dốc quay sang trái (phía tây thấp), 'right' ngược lại
function ledgeSliceV(ctx, ox, Y, u, side) {
  const wave = u % 4 === 0 || u % 4 === 3 ? 1 : 0;
  const at = (k, w = 1) => (side === 'left' ? ox + 11 - k - (w - 1) : ox + 4 + k);
  px(ctx, LEDGE.lip, at(0), Y, 1, 1);
  px(ctx, LEDGE.top, at(1), Y, 1, 1);
  px(ctx, LEDGE.faceLight, at(2, 2), Y, 2, 1);
  px(ctx, u % 4 === 1 ? LEDGE.vein : LEDGE.face, at(4, 3 + wave), Y, 3 + wave, 1);
  px(ctx, LEDGE.ink, at(7 + wave), Y, 1, 1);
  px(ctx, LEDGE.shade, at(8 + wave), Y, 1, 1);
}

function drawLedge(ctx, ox, oy, x, y, map) {
  const ch = map.tileAt(x, y);
  const at = (dx, dy) => map.tileAt(x + dx, y + dy);
  if (ch === 'v') {
    const capL = !isLedge(at(-1, 0));
    const capR = !isLedge(at(1, 0));
    for (let i = 0; i < TILE; i++) ledgeSliceH(ctx, ox + i, oy, x * TILE + i);
    // Đầu gờ không nối tiếp: bo tròn bằng viền tối chéo xuống
    for (const [cap, X, s] of [[capL, ox, 1], [capR, ox + TILE - 1, -1]]) {
      if (!cap) continue;
      px(ctx, LEDGE.ink, X, oy + LEDGE_TOP + 1, 1, 7);
      px(ctx, LEDGE.ink, X + s, oy + LEDGE_TOP, 1, 1);
      px(ctx, LEDGE.top, X, oy + LEDGE_TOP, 1, 1);
    }
    return;
  }
  const side = ch === '>' || (ch === 'J' && at(0, -1) === '>') ? 'right' : 'left';
  if (ch === '<' || ch === '>') {
    for (let j = 0; j < TILE; j++) ledgeSliceV(ctx, ox, oy + j, y * TILE + j, side);
    return;
  }
  // Góc chữ L: gờ ngang chạy từ mép ngoài của gờ dọc sang ô gờ bên cạnh, gờ dọc phía trên chạy xuống gặp gờ ngang
  const toRight = at(1, 0) === 'v';
  const outer = side === 'left' ? 3 : 12; // cột viền ngoài của gờ dọc
  const [x0, x1] = toRight ? [outer, TILE] : [0, outer + 1];
  for (let i = x0; i < x1; i++) ledgeSliceH(ctx, ox + i, oy, x * TILE + i);
  for (let j = 0; j < LEDGE_TOP + 1; j++) ledgeSliceV(ctx, ox, oy + j, y * TILE + j, side);
  // Viền ngoài vòng qua góc: nối viền tối của gờ dọc xuống viền tối gờ ngang
  const ix = ox + outer;
  px(ctx, LEDGE.ink, ix, oy, 1, LEDGE_TOP + 9);
  px(ctx, LEDGE.shade, ix + (side === 'left' ? -1 : 1), oy, 1, LEDGE_TOP + 10);
  px(ctx, LEDGE.face, ix + (side === 'left' ? 1 : -1), oy + LEDGE_TOP + 1, 1, 6);
}

// Cửa hang: vòm tối cao gần 2 ô khoét vào mặt vách (từ ô C lên ô phía trên), viền đá tảng quanh miệng hang,
// trong hang tối dần vào sâu. Vẽ sau cả khối núi vì vòm và đá viền tràn sang ô bên cạnh / phía trên
function drawCaveMouth(ctx, ox, oy, x, y, map) {
  drawRock(ctx, ox, oy, x, y, { tileAt: (nx, ny) => (nx === x && ny === y ? 'R' : map.tileAt(nx, ny)) });
  const cx = ox + 8;
  const top = oy - 10; // đỉnh vòm nằm trong nửa dưới ô phía trên
  const bottom = oy + 16;
  for (let Y = top; Y < bottom; Y++) {
    const t = Math.min(1, (Y - top) / 9);
    const half = Math.round(3 + 6 * Math.sqrt(t));
    px(ctx, ROCK.ink, cx - half - 1, Y, half * 2 + 2, 1);
    const depth = (Y - top) / (bottom - top);
    px(ctx, depth < 0.15 ? '#2c2430' : '#120e16', cx - half, Y, half * 2, 1);
  }
  // Nền đất trong hang hắt sáng nhẹ ở cửa
  px(ctx, '#2a2230', cx - 7, bottom - 5, 14, 2);
  px(ctx, '#3a3040', cx - 8, bottom - 3, 16, 3);
  // Đá viền quanh vòm (hai bên và trên đỉnh)
  for (const [dx, dy, r] of [[-10, -2, 2], [-11, 5, 3], [-10, 12, 2], [10, -2, 2], [11, 5, 3], [10, 12, 2], [-6, -10, 2], [6, -10, 2], [0, -13, 2]]) {
    drawBoulder(ctx, cx + dx - 6, oy + dy - 6, cx + dx, oy + dy, r, 12);
  }
}

// Lục bình trôi trên mặt nước: cụm lá tròn bóng xanh, có cụm trổ chùm hoa tím nhạt (bản đồ có hyacinth: mật độ 0-1)
function drawHyacinth(ctx, ox, oy, x, y, frame) {
  const bob = frame % 2;
  const bx = ox + 2 + Math.floor(hash(x, y, 300) * 4);
  const by = oy + 5 + Math.floor(hash(x, y, 301) * 4) + bob;
  // Lá: 5 lá tròn xếp thành vòng
  for (const [dx, dy] of [[0, 2], [3, 0], [6, 1], [8, 3], [3, 4]]) {
    px(ctx, '#1e5a2a', dx + bx, dy + by + 2, 4, 1);
    px(ctx, '#3a9a3e', dx + bx, dy + by, 4, 2);
    px(ctx, '#7cd068', dx + bx + 1, dy + by, 2, 1);
  }
  px(ctx, '#2e7a34', bx + 4, by + 3, 3, 2);
  // Chùm hoa tím
  if (hash(x, y, 302) > 0.35) {
    // Chùm hoa 5x4 cánh tím nhạt, giữa có đốm vàng, cuống xanh
    const fx = bx + 3 + Math.floor(hash(x, y, 303) * 2);
    const fy = by - 6;
    px(ctx, '#3a7a3a', fx + 2, fy + 4, 1, 3);
    const rows = [' LLL ', 'LlLlL', 'LLYLL', ' lLl '];
    const color = { L: '#b48ae8', l: '#7e52c0', Y: '#f8e070' };
    rows.forEach((row, j) => [...row].forEach((c, i) => c !== ' ' && px(ctx, color[c], fx + i, fy + j, 1, 1)));
    px(ctx, '#e8d8ff', fx + 1, fy, 1, 1);
  }
}

// Ruộng lúa: nước ruộng nâu xanh, các khóm lúa vàng xếp hàng, bờ ruộng đất viền quanh
function drawPaddy(ctx, ox, oy, x, y, map) {
  px(ctx, '#6a8a58', ox, oy, TILE, TILE);
  px(ctx, '#7a9a68', ox + 1, oy + 1, 14, 14);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const tx = ox + 2 + c * 4 + (r % 2);
      const ty = oy + 2 + r * 4;
      px(ctx, '#e8c848', tx, ty, 1, 2);
      px(ctx, '#c8a030', tx + 1, ty + 1, 1, 2);
      px(ctx, '#88a838', tx, ty + 2, 2, 1);
    }
  }
  const field = (nx, ny) => map.tileAt(nx, ny) === 'p';
  if (!field(x, y - 1)) px(ctx, '#8a6a40', ox, oy, TILE, 1);
  if (!field(x, y + 1)) px(ctx, '#6a4a28', ox, oy + 15, TILE, 1);
  if (!field(x - 1, y)) px(ctx, '#8a6a40', ox, oy, 1, TILE);
  if (!field(x + 1, y)) px(ctx, '#6a4a28', ox + 15, oy, 1, TILE);
}

// Cầu gỗ bắc qua sông: ván gỗ xếp vuông góc với chiều đi, thành cầu sẫm dọc hai bên mép nước.
// Chiều cầu theo khúc cầu: đầu trên / dưới của cột cầu giáp nước thì cầu đi ngang (đông - tây, vd cầu qua suối chảy dọc,
// bến câu nhô ra hồ), còn lại cầu đi dọc (bắc - nam, qua sông chảy ngang)
function bridgeAcross(map, x, y) {
  const end = (dy) => {
    let ny = y;
    while (map.tileAt(x, ny) === 'b') ny += dy;
    return map.tileAt(x, ny);
  };
  return end(-1) === 'w' || end(1) === 'w';
}
function drawBridge(ctx, ox, oy, x, y, map) {
  const across = bridgeAcross(map, x, y);
  const bridge = (dx, dy) => map.tileAt(x + dx, y + dy) === 'b';
  px(ctx, '#2a5ab0', ox, oy, TILE, TILE);
  if (across) {
    // Cầu đi ngang: ván dọc, thành cầu ở mép trên và mép dưới (phía nước)
    const y0 = bridge(0, -1) ? 0 : 1;
    const y1 = bridge(0, 1) ? TILE : 15;
    for (let i = 0; i < 4; i++) {
      px(ctx, '#a07040', ox + i * 4, oy + y0, 3, y1 - y0);
      px(ctx, '#7a5030', ox + i * 4 + 3, oy + y0, 1, y1 - y0);
      if (hash(x * 4 + i, y, 610) < 0.3) px(ctx, '#b88450', ox + i * 4 + 1, oy + y0 + 2 + Math.floor(hash(x * 4 + i, y, 611) * 9), 1, 3);
    }
    if (!bridge(0, -1)) { px(ctx, '#5a3820', ox, oy, TILE, 2); px(ctx, '#8a6038', ox, oy, TILE, 1); }
    if (!bridge(0, 1)) { px(ctx, '#5a3820', ox, oy + 14, TILE, 2); px(ctx, 'rgba(10,30,70,0.35)', ox, oy + 15, TILE, 1); }
    return;
  }
  // Cầu đi dọc: ván ngang, thành cầu hai bên trái / phải
  const x0 = bridge(-1, 0) ? 0 : 1;
  const x1 = bridge(1, 0) ? TILE : 15;
  for (let i = 0; i < 4; i++) {
    px(ctx, '#a07040', ox + x0, oy + i * 4, x1 - x0, 3);
    px(ctx, '#7a5030', ox + x0, oy + i * 4 + 3, x1 - x0, 1);
  }
  if (!bridge(-1, 0)) { px(ctx, '#5a3820', ox, oy, 2, TILE); px(ctx, '#8a6038', ox, oy, 1, TILE); }
  if (!bridge(1, 0)) px(ctx, '#5a3820', ox + 14, oy, 2, TILE);
}

// Nền tuyết (Thành phố Sương Mù): trắng xanh, vệt tuyết đọng
function drawSnow(ctx, ox, oy, x, y) {
  px(ctx, '#e8f0f8', ox, oy, TILE, TILE);
  for (let i = 0; i < 5; i++) {
    const tx = ox + Math.floor(hash(x, y, 140 + i) * 13);
    const ty = oy + Math.floor(hash(x, y, 150 + i) * 15);
    px(ctx, i % 2 ? '#c8d8ec' : '#ffffff', tx, ty, 3, 1);
  }
}

// Lò gốm: lò gạch đỏ hình vòm, miệng lò đỏ lửa, ống khói nhỏ
function drawKiln(ctx, ox, oy) {
  const p = new PixelBuffer(TILE, TILE);
  p.ellipse(8, 10, 7, 6, '#a84a2a');
  p.rect(1, 10, 14, 6, '#a84a2a');
  p.recolor('#7a3018', (x, y) => x + y > 18);
  for (const [bx, by] of [[3, 7], [8, 5], [11, 9], [4, 12], [10, 13]]) p.rect(bx, by, 3, 1, '#c86a40');
  p.ellipse(8, 13, 3, 3, '#3a1408', (x, y) => y >= 11);
  p.rect(6, 13, 5, 3, '#f08020');
  p.rect(7, 14, 3, 2, '#ffd040');
  p.rect(11, 1, 2, 4, '#6a2a14');
  p.outline(-0.6);
  p.drawTo(ctx, ox, oy);
}

// Chum gốm: thân tròn men nâu, miệng loe
function drawJar(ctx, ox, oy) {
  const p = new PixelBuffer(TILE, TILE);
  p.ellipse(8, 10, 5, 5, '#8a5a30');
  p.rect(5, 3, 6, 3, '#8a5a30');
  p.rect(4, 3, 8, 1, '#a87040');
  p.recolor('#6a4020', (x, y) => x > 9);
  p.rect(5, 9, 6, 1, '#c89058');
  p.set(6, 7, '#c89058');
  p.outline(-0.6);
  p.drawTo(ctx, ox, oy);
}

// Ao sen: nước xanh lục, lá sen tròn, hoa sen hồng
function drawLotus(ctx, ox, oy, x, y, map) {
  const pond = (nx, ny) => map.tileAt(nx, ny) === 'L';
  px(ctx, '#3a8a90', ox, oy, TILE, TILE);
  if (!pond(x, y - 1)) px(ctx, '#7a6040', ox, oy, TILE, 2);
  if (!pond(x - 1, y)) px(ctx, '#7a6040', ox, oy, 2, TILE);
  if (!pond(x + 1, y)) px(ctx, '#5a4428', ox + 14, oy, 2, TILE);
  if (!pond(x, y + 1)) px(ctx, '#5a4428', ox, oy + 14, TILE, 2);
  const lx = ox + 3 + Math.floor(hash(x, y, 160) * 6);
  const ly = oy + 3 + Math.floor(hash(x, y, 161) * 6);
  px(ctx, '#3a8a3a', lx, ly, 6, 4);
  px(ctx, '#5aaa48', lx + 1, ly, 4, 1);
  px(ctx, '#3a8a90', lx + 2, ly + 2, 1, 2);
  if (hash(x, y, 162) > 0.45) {
    const fx = ox + 2 + Math.floor(hash(x, y, 163) * 10);
    const fy = oy + 9 + Math.floor(hash(x, y, 164) * 3);
    px(ctx, '#f8a0c0', fx, fy, 3, 2);
    px(ctx, '#ffe0ec', fx + 1, fy - 1, 1, 1);
    px(ctx, '#d86090', fx + 1, fy + 1, 1, 1);
  }
}

// Cây thông nhỏ 1 ô: cùng bảng màu, kiểu tô sáng trái tối phải với cây thông lớn; bản đồ tuyết thì đầu tầng lá phủ tuyết
function drawSnowPine(ctx, ox, oy, snow) {
  const p = new PixelBuffer(TILE, TILE);
  p.rect(7, 12, 2, 4, '#5a3820');
  p.set(7, 12, '#7a5030');
  for (const [y0, y1, w0, w1] of [[0, 5, 1, 3.5], [3, 9, 2, 5.5], [7, 13, 3, 7.5]]) {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / (y1 - y0);
      const hw = w0 + (w1 - w0) * t;
      for (let x = 0; x < TILE; x++) {
        const dx = x + 0.5 - 8;
        if (Math.abs(dx) > hw) continue;
        let v = 0.62 - dx / (hw * 2.4) - t * 0.32;
        if (y >= y1) v -= 0.28;
        const capped = snow && t < 0.4 - Math.abs(dx) / (hw * 4);
        p.set(x, y, capped ? dither(v + 0.3, x, y, SNOW) : dither(v, x, y, PINE_GREENS));
      }
    }
  }
  p.outline(-0.45);
  p.drawTo(ctx, ox, oy);
}

// Bụi lá (h) mọc trên bãi cát: giáp cát và không giáp ô cỏ / đường nào thì nền dưới bụi là cát (không thành ô cỏ vuông giữa bãi)
function onSand(map, x, y) {
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => map.tileAt(x + dx, y + dy));
  return around.includes('d') && !around.some((c) => '.fgG=ae'.includes(c));
}

function drawOutdoor(map, ground, objects, over, anim) {
  const dirt = dirtGrid(map);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const ch = map.tileAt(x, y);
      const ox = x * TILE;
      const oy = y * TILE;
      if (ch === '=') drawPath(ground, ox, oy, x, y, map);
      else if (ch === 'g') drawTallGrass(ground, ox, oy, TALL);
      else if (ch === 'G') drawTallGrass(ground, ox, oy, TALL_DEEP);
      // nền rừng tối chỉ dưới những cây nằm sâu trong rừng; cây đứng lẻ thì vẫn là cỏ
      else if (ch === 'T' && [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => map.tileAt(x + dx, y + dy) === 'T')) px(ground, map.snow ? '#c8d8e8' : FOREST_FLOOR, ox, oy, TILE, TILE);
      else if (ch === 'd' || (ch === 'h' && onSand(map, x, y))) drawSand(ground, ox, oy, x, y, map);
      else if (dirt(x, y)) drawDirt(ground, ox, oy, x, y, map, groundColor(map));
      else if (map.snow) drawSnow(ground, ox, oy, x, y);
      else drawGrass(ground, ox, oy, x, y);

      if (ch === 'K') drawKiln(objects, ox, oy);
      if (ch === 'j') drawJar(objects, ox, oy);
      if (ch === 'L') drawLotus(ground, ox, oy, x, y, map);
      if (ch === 'n') drawSnowPine(objects, ox, oy, map.snow);
      if (ch === 'w') anim.forEach((a, f) => drawWater(a, ox, oy, x, y, f, map));
      if (ch === 'w' && map.hyacinth && hash(x, y, 299) < map.hyacinth) anim.forEach((a, f) => drawHyacinth(a, ox, oy, x, y, f));
      if (ch === 'f') anim.forEach((a, f) => drawFlowers(a, ox, oy, x, y, f));
      if (ch === 'h') drawShrub(ground, ox, oy, x, y);
      if (ch === 'H') drawFence(objects, ox, oy, x, y, map);
      if (ch === 's') drawSign(objects, ox, oy);
      if (ch === 'R') {
        if (rockPiles(map).has(`${x},${y}`)) drawRockPile(ground, objects, ox, oy, x, y, map);
        else drawRock(objects, ox, oy, x, y, map);
      }
      if (ch === 'p') drawPaddy(ground, ox, oy, x, y, map);
      if (ch === 'b') drawBridge(ground, ox, oy, x, y, map);
      if (isLedge(ch)) drawLedge(ground, ox, oy, x, y, map);
      drawDecorTile(ch, ground, objects, ox, oy, x, y, map);
    }
  }
  // Cửa hang vẽ sau khối núi (vòm và đá viền tràn sang ô bên cạnh)
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (map.tileAt(x, y) === 'C') drawCaveMouth(objects, x * TILE, y * TILE, x, y, map);
  // Bóng đổ trước, rồi cây (từ trên xuống để cây phía dưới đè lên cây phía trên), rồi nhà
  for (let y = 0; y < map.height; y += 2) {
    for (let x = 0; x < map.width; x += 2) {
      if (map.tileAt(x, y) === 'T') ovalShadow(ground, x * TILE + TILE, (y + 2) * TILE - 2, 11, 2);
    }
  }
  for (const b of map.buildings) {
    dropShadow(ground, b.x * TILE + 2, (b.y + b.h) * TILE, b.w * TILE, 4);
    dropShadow(ground, (b.x + b.w) * TILE, b.y * TILE + 10, 3, b.h * TILE - 6);
  }
  for (let y = 0; y < map.height; y += 2) {
    for (let x = 0; x < map.width; x += 2) {
      if (map.tileAt(x, y) === 'T') drawTree(objects, over, x * TILE, y * TILE, map.snow);
    }
  }
  // Đồ trang trí nhiều ô / cao: ghế, khúc gỗ, cây tán tròn, cây hoa anh đào, đèn đường (gfx/decor.js)
  drawDecorTall(map, ground, objects, over);
  for (const b of map.buildings) BUILDING_DRAW[b.type](objects, b.x * TILE, b.y * TILE, b.roof, b.floors);
}

// Trong hang: nền đá tối lốm đốm, vách hang có mép sáng phía dưới, tảng đá tròn, cửa hang sáng.
// Hang băng (caveTheme 'ice'): vách tinh thể băng xanh vân chéo, sàn băng trắng xanh, tảng băng
const CAVE = {
  floor: '#5a4c44', floorAlt: '#52463e', dot: '#6a5a50', pebble: '#8a7868', wall: '#3a302c', wallTop: '#7a685a', wallLit: '#8e7a6a',
  rim: '#54463e', ink: '#201a18',
};
const ICE_CAVE = { floor: '#d6e0ee', floorAlt: '#bccae0', dot: '#a8b8d4', wall: '#5a7cc4', wallLight: '#94bcec', wallDark: '#3c5494', wallTop: '#e4eefa', ink: '#26345e' };

// Nước ngầm trong hang (ô w): mặt nước xanh lục thẫm, gợn sóng mảnh trôi theo ANIM_FRAMES nhịp, thỉnh thoảng lấp lánh.
// Mép giáp nền hang là bờ đá lởm chởm (đá sáng viền mực, chân bờ đổ bóng xuống nước); giáp vách thì vách tự vẽ mặt đá,
// mặt nước sát chân vách tối hẳn. Hang băng: nước xanh lạnh, bờ là viền băng trắng có mảnh băng vỡ trôi sát bờ
const CAVE_WATER = {
  deep: '#132e3a', base: '#1c4554', mid: '#245868', light: '#3e7e8c', glint: '#8cc8d0',
  rock: '#7a685a', rockLit: '#8e7a6a', rockDark: '#3a302c', ink: '#201a18',
};
const ICE_WATER = {
  deep: '#2a5c96', base: '#3670ac', mid: '#4886c0', light: '#7ab4e0', glint: '#eaf8ff',
  rock: '#e4eefa', rockLit: '#ffffff', rockDark: '#a8c0dc', ink: '#26345e',
};

function drawCaveWater(ctx, ox, oy, x, y, frame, map, W) {
  const water = (nx, ny) => nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || map.tileAt(nx, ny) === 'w';
  const wall = (nx, ny) => map.tileAt(nx, ny) === '#';
  // Nền nước: mảng sâu tối hơn loang lổ, cố định theo ô
  px(ctx, W.base, ox, oy, TILE, TILE);
  for (let k = 0; k < 2; k++) {
    if (hash(x, y, 300 + k) < 0.45) continue;
    const bx = ox + 1 + Math.floor(hash(x, y, 302 + k) * 8);
    const by = oy + 2 + Math.floor(hash(x, y, 304 + k) * 9);
    const w = 5 + Math.floor(hash(x, y, 306 + k) * 4);
    px(ctx, W.deep, bx + 1, by, w - 2, 1);
    px(ctx, W.deep, bx, by + 1, w, 2);
    px(ctx, W.deep, bx + 1, by + 3, w - 2, 1);
  }
  // Gợn sóng: vệt sáng ngắn trôi sang phải, vệt tối trôi ngược lại (lặng hơn nước ngoài trời)
  for (let i = 0; i < 2; i++) {
    const wx = Math.floor(hash(x, y, 310 + i) * 9) + 2;
    const wy = 4 + i * 6 + Math.floor(hash(x, y, 312 + i) * 2);
    const shift = ((frame + i + x) % ANIM_FRAMES) - 1;
    px(ctx, W.light, ox + wx + shift, oy + wy, 3, 1);
    px(ctx, W.mid, ox + ((wx + 5) % 10) + 2 - shift, oy + wy + 2, 3, 1);
  }
  if (hash(x, y, 320 + frame) > 0.82) px(ctx, W.glint, ox + 2 + Math.floor(hash(x, y, 321 + frame) * 12), oy + 2 + Math.floor(hash(x, y, 322 + frame) * 12));

  const n = !water(x, y - 1);
  const s = !water(x, y + 1);
  const w = !water(x - 1, y);
  const e = !water(x + 1, y);
  // Chân vách: mặt nước trong bóng vách
  if (n && wall(x, y - 1)) {
    px(ctx, W.deep, ox, oy, TILE, 3);
    px(ctx, 'rgba(8,10,14,0.35)', ox, oy + 3, TILE, 2);
  }
  if (w && wall(x - 1, y)) px(ctx, W.deep, ox, oy, 1, TILE);
  if (e && wall(x + 1, y)) px(ctx, W.deep, ox + 15, oy, 1, TILE);
  if (s && wall(x, y + 1)) px(ctx, W.deep, ox, oy + 15, TILE, 1);
  // Bờ giáp nền hang: mép đá lồi lõm 1-3px (đá viền mực), bóng bờ đổ xuống nước; bờ nam có gờ nước sáng ở chân bờ
  const lip = (i, seed) => 2 + (hash(x * 3 + i, y, seed) > 0.6 ? 1 : 0) - (hash(x, y * 3 + i, seed + 1) > 0.85 ? 1 : 0);
  for (let i = 0; i < TILE; i++) {
    if (n && !wall(x, y - 1)) {
      const d = lip(i, 330);
      px(ctx, W.rock, ox + i, oy, 1, d - 1);
      px(ctx, W.rockDark, ox + i, oy + d - 1);
      px(ctx, W.ink, ox + i, oy + d);
      px(ctx, W.deep, ox + i, oy + d + 1);
    }
    if (s && !wall(x, y + 1)) {
      const d = lip(i, 340);
      px(ctx, W.light, ox + i, oy + TILE - d - 1);
      px(ctx, W.ink, ox + i, oy + TILE - d);
      px(ctx, W.rockLit, ox + i, oy + TILE - d + 1, 1, d - 1);
    }
    if (w && !wall(x - 1, y)) {
      const d = lip(i, 350);
      px(ctx, W.rock, ox, oy + i, d - 1, 1);
      px(ctx, W.ink, ox + d - 1, oy + i);
      px(ctx, W.deep, ox + d, oy + i);
    }
    if (e && !wall(x + 1, y)) {
      const d = lip(i, 360);
      px(ctx, W.deep, ox + TILE - d - 1, oy + i);
      px(ctx, W.ink, ox + TILE - d, oy + i);
      px(ctx, W.rock, ox + TILE - d + 1, oy + i, d - 1, 1);
    }
  }
  // Góc lồi giữa hai bờ đất: lấp đá cho bờ tròn, không thành góc vuông
  const corner = (sx, sy) => {
    const X = (i) => (sx > 0 ? ox + TILE - 1 - i : ox + i);
    const Y = (j) => (sy > 0 ? oy + TILE - 1 - j : oy + j);
    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < 5; i++) {
        const d = Math.hypot(5 - i - 0.5, 5 - j - 0.5);
        if (d > 5) px(ctx, W.rock, X(i), Y(j));
        else if (d > 4) px(ctx, W.ink, X(i), Y(j));
      }
    }
  };
  const shore = (dx, dy) => !water(x + dx, y + dy) && !wall(x + dx, y + dy);
  if (shore(0, -1) && shore(-1, 0)) corner(-1, -1);
  if (shore(0, -1) && shore(1, 0)) corner(1, -1);
  if (shore(0, 1) && shore(-1, 0)) corner(-1, 1);
  if (shore(0, 1) && shore(1, 0)) corner(1, 1);
  // Hang băng: mảnh băng vỡ trôi sát bờ
  if (W === ICE_WATER && (n || s || w || e) && hash(x, y, 370) > 0.5) {
    const fx = ox + 3 + Math.floor(hash(x, y, 371) * 9);
    const fy = oy + 5 + Math.floor(hash(x, y, 372) * 6);
    px(ctx, W.rock, fx, fy, 3, 1);
    px(ctx, W.rockDark, fx, fy + 1, 3, 1);
  }
}

function drawIceCave(map, ground, objects, anim = []) {
  const C = ICE_CAVE;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const ch = map.tileAt(x, y);
      const ox = x * TILE;
      const oy = y * TILE;
      if (ch === 'w') {
        drawCaveWater(ground, ox, oy, x, y, 0, map, ICE_WATER);
        anim.forEach((a, f) => drawCaveWater(a, ox, oy, x, y, f, map, ICE_WATER));
        continue;
      }
      if (ch === '#') {
        // Tinh thể băng: các mảnh chéo so le nhau (lệch nửa mảnh mỗi dải), mép sáng, đáy tối
        for (let j = 0; j < TILE; j++) {
          for (let i = 0; i < TILE; i++) {
            const gx = ox + i;
            const gy = oy + j;
            const band = Math.floor((gx - gy + 512) / 12) % 2;
            const d = Math.floor((gx + gy + band * 6) / 2) % 6;
            px(ground, d === 0 ? C.wallLight : d < 4 ? C.wall : C.wallDark, gx, gy);
          }
        }
        // Viền tuyết trắng nơi vách gặp sàn
        const floor = (nx, ny) => map.tileAt(nx, ny) !== '#' && nx >= 0 && ny >= 0 && nx < map.width && ny < map.height;
        if (floor(x, y - 1)) {
          px(ground, C.ink, ox, oy, TILE, 1);
          px(ground, C.wallTop, ox, oy + 1, TILE, 2);
        }
        if (floor(x - 1, y)) {
          px(ground, C.ink, ox, oy, 1, TILE);
          px(ground, C.wallTop, ox + 1, oy, 2, TILE);
        }
        if (floor(x + 1, y)) {
          px(ground, C.wallTop, ox + 13, oy, 2, TILE);
          px(ground, C.ink, ox + 15, oy, 1, TILE);
        }
        if (floor(x, y + 1)) {
          px(ground, C.wallTop, ox, oy + 11, TILE, 3);
          px(ground, C.ink, ox, oy + 14, TILE, 2);
        }
        continue;
      }
      // Sàn băng phẳng, chấm đá nhỏ và vệt gợn băng mờ
      px(ground, C.floor, ox, oy, TILE, TILE);
      for (let i = 0; i < 4; i++) px(ground, C.dot, ox + Math.floor(hash(x, y, 20 + i) * 15), oy + Math.floor(hash(x, y, 30 + i) * 15));
      if (hash(x, y, 50) > 0.5) px(ground, C.floorAlt, ox + Math.floor(hash(x, y, 51) * 8) + 2, oy + Math.floor(hash(x, y, 52) * 12) + 2, 5, 1);
      if (hash(x, y, 40) > 0.75) px(ground, '#ffffff', ox + Math.floor(hash(x, y, 41) * 12) + 2, oy + Math.floor(hash(x, y, 42) * 12) + 2, 2, 1);
      if (ch === 'o') {
        const p = new PixelBuffer(TILE, TILE);
        p.ellipse(8, 9, 7, 6, '#a8c8f0');
        p.recolor('#7898d0', (bx, by) => bx + by > 17);
        p.set(5, 6, '#ffffff');
        p.set(6, 5, '#ffffff');
        p.outline(-0.6);
        p.drawTo(objects, ox, oy);
      } else if (ch === 'C') {
        px(ground, '#f0f6ff', ox + 3, oy, 10, TILE);
        px(ground, '#ffffff', ox + 5, oy, 6, TILE);
      } else if (ch === 'L') {
        drawLadderDown(ground, ox, oy);
      } else if (ch === 'U') {
        drawLadderUp(ground, ox, oy);
      }
    }
  }
}

// anim: các frame của lớp <map>-anim (nước ngầm gợn sóng)
function drawCave(map, ground, objects, anim = []) {
  if (map.caveTheme === 'ice') {
    drawIceCave(map, ground, objects, anim);
    return;
  }
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const ch = map.tileAt(x, y);
      const ox = x * TILE;
      const oy = y * TILE;
      if (ch === 'w') {
        drawCaveWater(ground, ox, oy, x, y, 0, map, CAVE_WATER);
        anim.forEach((a, f) => drawCaveWater(a, ox, oy, x, y, f, map, CAVE_WATER));
        continue;
      }
      if (ch === '#') {
        px(ground, CAVE.wall, ox, oy, TILE, TILE);
        for (let i = 0; i < 4; i++) px(ground, CAVE.ink, ox + Math.floor(hash(x, y, i) * 14), oy + Math.floor(hash(x, y, i + 9) * 14), 2, 2);
        // Viền vách giáp nền hang: mép dưới là mặt vách sáng (nhìn từ trên xuống chéo), mép trên / hai bên là gờ đá mảnh
        const open = (dx, dy) => {
          const nx = x + dx;
          const ny = y + dy;
          return nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && map.tileAt(nx, ny) !== '#';
        };
        if (open(0, -1)) {
          px(ground, CAVE.ink, ox, oy, TILE, 1);
          px(ground, CAVE.rim, ox, oy + 1, TILE, 1);
        }
        if (open(-1, 0)) {
          px(ground, CAVE.ink, ox, oy, 1, TILE);
          px(ground, CAVE.rim, ox + 1, oy + (open(0, -1) ? 1 : 0), 1, TILE);
        }
        if (open(1, 0)) {
          px(ground, CAVE.rim, ox + 14, oy + (open(0, -1) ? 1 : 0), 1, TILE);
          px(ground, CAVE.ink, ox + 15, oy, 1, TILE);
        }
        // mép vách sát nền hang
        if (open(0, 1)) {
          px(ground, CAVE.wallTop, ox, oy + 11, TILE, 3);
          px(ground, CAVE.wallLit, ox, oy + 11, TILE, 1);
          for (let i = 0; i < 3; i++) px(ground, CAVE.wall, ox + 2 + Math.floor(hash(x, y, 40 + i) * 12), oy + 12, 1, 2);
          px(ground, CAVE.ink, ox, oy + 14, TILE, 2);
        }
        continue;
      }
      // Nền hang: đất đá loang lổ từng mảng (không kẻ ô bàn cờ), sạn nhỏ, thỉnh thoảng hòn sỏi
      px(ground, CAVE.floor, ox, oy, TILE, TILE);
      for (let k = 0; k < 2; k++) {
        if (hash(x, y, 60 + k) < 0.35) continue;
        const bx = ox + 1 + Math.floor(hash(x, y, 62 + k) * 9);
        const by = oy + 1 + Math.floor(hash(x, y, 64 + k) * 10);
        const w = 4 + Math.floor(hash(x, y, 66 + k) * 4);
        px(ground, CAVE.floorAlt, bx + 1, by, w - 2, 1);
        px(ground, CAVE.floorAlt, bx, by + 1, w, 2);
        px(ground, CAVE.floorAlt, bx + 1, by + 3, w - 2, 1);
      }
      for (let i = 0; i < 5; i++) px(ground, CAVE.dot, ox + Math.floor(hash(x, y, 20 + i) * 15), oy + Math.floor(hash(x, y, 30 + i) * 15));
      if (hash(x, y, 68) > 0.82) {
        const sx = ox + 2 + Math.floor(hash(x, y, 69) * 11);
        const sy = oy + 2 + Math.floor(hash(x, y, 70) * 11);
        px(ground, CAVE.pebble, sx, sy, 2, 1);
        px(ground, CAVE.ink, sx, sy + 1, 2, 1);
      }
      // bóng vách đổ xuống nền ngay dưới mặt vách
      if (map.tileAt(x, y - 1) === '#' && y > 0) px(ground, 'rgba(20,14,12,0.28)', ox, oy, TILE, 2);
      if (ch === 'o') {
        const p = new PixelBuffer(TILE, TILE);
        p.ellipse(8, 9, 7, 6, '#8a7868');
        p.recolor('#6a5a4c', (bx, by) => bx + by > 17);
        p.set(5, 6, '#b0a090');
        p.set(6, 5, '#b0a090');
        p.outline(-0.6);
        p.drawTo(objects, ox, oy);
      } else if (ch === 'C') {
        px(ground, '#e8d8b0', ox + 3, oy, 10, TILE);
        px(ground, '#fff4d0', ox + 5, oy, 6, TILE);
      } else if (ch === 'L') {
        drawLadderDown(ground, ox, oy);
      } else if (ch === 'U') {
        drawLadderUp(ground, ox, oy);
      }
    }
  }
}

// Hố có thang dẫn xuống tầng dưới: miệng hố tối viền đá, đầu thang gỗ thò lên khỏi miệng hố
const LADDER = { wood: '#a8844c', woodDark: '#6a4e2a', woodLight: '#d0aa6a' };
function drawLadderDown(ctx, ox, oy) {
  px(ctx, CAVE.wallTop, ox + 2, oy + 2, 12, 1);
  px(ctx, CAVE.ink, ox + 1, oy + 3, 14, 11);
  px(ctx, '#0c0a0e', ox + 2, oy + 4, 12, 9);
  px(ctx, '#18141a', ox + 3, oy + 10, 10, 3);
  px(ctx, CAVE.dot, ox + 2, oy + 14, 12, 1);
  // hai thanh dọc và các bậc, càng sâu càng tối
  for (const x of [4, 10]) {
    px(ctx, LADDER.woodDark, ox + x, oy + 1, 2, 11);
    px(ctx, LADDER.wood, ox + x, oy + 1, 1, 7);
  }
  for (const [r, c] of [[3, LADDER.woodLight], [6, LADDER.wood], [9, LADDER.woodDark]]) px(ctx, c, ox + 5, oy + r, 5, 1);
}

// Thang gỗ dựng lên lỗ sáng trên trần: vệt sáng hắt xuống nền, thang có bóng đổ
function drawLadderUp(ctx, ox, oy) {
  px(ctx, '#7a6a58', ox + 1, oy + 1, 14, 14);
  px(ctx, '#8e7c66', ox + 3, oy + 2, 10, 11);
  px(ctx, CAVE.ink, ox + 5, oy + 14, 7, 1);
  for (const x of [4, 10]) {
    px(ctx, LADDER.woodDark, ox + x, oy, 2, 15);
    px(ctx, LADDER.woodLight, ox + x, oy, 1, 15);
  }
  for (let r = 1; r < 15; r += 3) {
    px(ctx, LADDER.wood, ox + 5, oy + r, 5, 1);
    px(ctx, LADDER.woodDark, ox + 5, oy + r + 1, 5, 1);
  }
}

// Ô của gym sau khi có huy hiệu, chỉ để vẽ: gió tắt (gym có windy), băng hết trơn, miệng lò tắt lửa -> sàn thường
const WIND_CHARS = ['^', 'v', '<', '>'];
function clearedTile(map, ch) {
  if (map.windy && WIND_CHARS.includes(ch)) return '.';
  if (ch === 'i' || ch === 'X' || ch === 'Y') return '.';
  return ch;
}

// Texture của một bản đồ: nền, vật thể, lớp trên (ngọn cây), 3 khung động (nước, hoa) và bản "đã thắng" của gym.
// Vẽ khi người chơi bước vào bản đồ (ensureMapTextures), không vẽ sẵn cả trăm bản đồ lúc khởi động (trước kia mất
// hàng chục giây và ~300MB bộ nhớ trên điện thoại)
const MAP_LAYERS = ['ground', 'objects', 'over', 'anim-0', 'anim-1', 'anim-2', 'ground-cleared', 'objects-cleared'];
const KEEP_MAPS = 4; // giữ texture của chừng này bản đồ đi qua gần nhất (đi ra vào nhà / tuyến đường không phải vẽ lại)
// Lớp bản đồ vẽ ở 16px/ô rồi phóng x2 kiểu Scale2x (bo tròn bậc thang, lọc tuyến tính): mịn hơn ô vuông GBA. Texture to
// gấp MAP_RES lần nên WorldScene hiển thị x WORLD_SCALE / MAP_RES. Khung động (nước, hoa) là texture riêng `${id}-anim-${i}`
// (ghép thành một dải thì bản đồ rộng nhất vượt cỡ texture tối đa 4096 của điện thoại)
export const MAP_RES = 2;
const addMapTexture = (scene, key, canvas) => addCanvasTexture(scene, key, scale2x(canvas));
const recentMaps = [];

function buildMapTextures(scene, map) {
  const W = map.width * TILE;
  const H = map.height * TILE;
  const ground = makeCanvas(W, H);
  const objects = makeCanvas(W, H);
  const over = makeCanvas(W, H);
  const anim = Array.from({ length: ANIM_FRAMES }, () => makeCanvas(W, H));
  if (map.indoor) drawInterior(map, ground.ctx, objects.ctx, over.ctx);
  else if (map.cave) drawCave(map, ground.ctx, objects.ctx, anim.map((a) => a.ctx));
  else drawOutdoor(map, ground.ctx, objects.ctx, over.ctx, anim.map((a) => a.ctx));

  addMapTexture(scene, `${map.id}-ground`, ground.canvas);
  addMapTexture(scene, `${map.id}-objects`, objects.canvas);
  addMapTexture(scene, `${map.id}-over`, over.canvas);
  anim.forEach((a, i) => addMapTexture(scene, `${map.id}-anim-${i}`, a.canvas));

  // Gym đã có huy hiệu (GameMap.cleared): bản vẽ riêng, ô gió (gym gió tắt quạt), sàn băng, miệng lò thành sàn thường.
  // WorldScene dùng `${id}-ground-cleared` / `${id}-objects-cleared` khi gym đã thắng
  if (map.badge && map.indoor) {
    const calm = Object.create(map, { tileAt: { value: (x, y) => clearedTile(map, map.tileAt(x, y)) } });
    const g2 = makeCanvas(W, H);
    const o2 = makeCanvas(W, H);
    drawInterior(calm, g2.ctx, o2.ctx);
    addMapTexture(scene, `${map.id}-ground-cleared`, g2.canvas);
    addMapTexture(scene, `${map.id}-objects-cleared`, o2.canvas);
  }
}

// Gọi trước khi dùng texture `${id}-ground`... (WorldScene.loadMap, sau khi đã gỡ hình của bản đồ cũ).
// Bản đồ đi qua lâu nhất bị xoá texture khi đã giữ quá KEEP_MAPS bản đồ
export function ensureMapTextures(scene, id) {
  const map = MAPS[id];
  if (!scene.textures.exists(`${id}-ground`)) buildMapTextures(scene, map);
  const i = recentMaps.indexOf(id);
  if (i >= 0) recentMaps.splice(i, 1);
  recentMaps.push(id);
  while (recentMaps.length > KEEP_MAPS) {
    const old = recentMaps.shift();
    for (const layer of MAP_LAYERS) if (scene.textures.exists(`${old}-${layer}`)) scene.textures.remove(`${old}-${layer}`);
  }
}

// Texture dùng chung cho mọi bản đồ (vẽ lúc khởi động)
export function buildWorldTextures(scene) {
  for (const [key, pal] of [['grass-front', TALL], ['grass-front-deep', TALL_DEEP]]) {
    const front = makeCanvas(TILE, TILE);
    drawTallGrass(front.ctx, 0, 0, pal, 'front');
    addCanvasTexture(scene, key, front.canvas);
  }
}
