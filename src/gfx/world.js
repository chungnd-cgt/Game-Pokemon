import { TILE } from '../config.js';
import { MAPS } from '../data/map.js';
import { drawInterior } from './interior.js';
import { addCanvasTexture, addSheetTexture, dither, hash, makeCanvas, px } from './pixel.js';

// Vẽ mỗi bản đồ thành 3 lớp ảnh pixel (mỗi ô 16x16):
//  <map>-ground  : nền (cỏ, đường, sàn, tường)
//  <map>-anim    : nước và hoa, có ANIM_FRAMES frame chuyển động
//  <map>-objects : cây, nhà, đồ đạc
// và 2 ảnh 'grass-front*' để che chân nhân vật khi đứng trong cỏ cao.

export const ANIM_FRAMES = 3;

const GRASS = { light: '#a8e070', base: '#88c858', mid: '#70b048', dark: '#4f9038', outline: '#2f6828' };
const DEEP = { light: '#7cc058', base: '#64a844', mid: '#4f9038', dark: '#3a7430', outline: '#1f4a1c' };
const SAND = { light: '#f0dca8', base: '#e0c488', dark: '#c8a868', edge: '#a88850' };
const WATER = { light: '#88c4f8', base: '#5898e8', dark: '#3c78d0', foam: '#e0f4ff', edge: '#2f5a2f' };

function drawGrass(ctx, ox, oy, x, y) {
  px(ctx, GRASS.base, ox, oy, TILE, TILE);
  for (let i = 0; i < 3; i++) {
    if (hash(x, y, i) < 0.4) continue;
    const tx = ox + 1 + Math.floor(hash(x, y, i + 10) * 12);
    const ty = oy + 2 + Math.floor(hash(x, y, i + 20) * 11);
    px(ctx, GRASS.mid, tx, ty);
    px(ctx, GRASS.mid, tx + 2, ty);
    px(ctx, GRASS.mid, tx + 1, ty + 1);
    px(ctx, GRASS.light, tx + 1, ty - 1);
  }
  if (hash(x, y, 5) > 0.7) px(ctx, GRASS.light, ox + Math.floor(hash(x, y, 6) * 15), oy + Math.floor(hash(x, y, 7) * 15));
}

// Cỏ cao: 2 hàng ngọn cỏ hình răng cưa, hàng dưới lệch 4px
function drawTallGrass(ctx, ox, oy, pal, halves = [0, 1], withBase = true) {
  if (withBase) px(ctx, pal.base, ox, oy, TILE, TILE);
  for (const half of halves) {
    const top = half * 8;
    const offset = half ? 4 : 0;
    for (let x = 0; x < TILE; x++) {
      const k = (x + offset) % 8;
      const peak = top + Math.abs(k - 4);
      for (let y = peak; y < top + 8; y++) {
        let color;
        if (y === peak) color = pal.outline;
        else if (y === top + 7) color = pal.dark;
        else if (y === peak + 1) color = k < 4 ? pal.light : pal.mid;
        else color = k < 4 ? pal.mid : pal.dark;
        px(ctx, color, ox + x, oy + y);
      }
    }
  }
}

function drawPath(ctx, ox, oy, x, y, map) {
  px(ctx, SAND.base, ox, oy, TILE, TILE);
  for (let i = 0; i < 6; i++) {
    px(ctx, i % 2 ? SAND.light : SAND.dark, ox + Math.floor(hash(x, y, 40 + i) * 15), oy + Math.floor(hash(x, y, 50 + i) * 15));
  }
  const isPath = (nx, ny) => map.tileAt(nx, ny) === '=' || map.doorAt(nx, ny);
  // Viền cỏ lấn vào mép đường cho tự nhiên
  const edge = (side, i) => 1 + (hash(x * 16 + i, y * 16 + side, 7) < 0.35 ? 1 : 0);
  for (let i = 0; i < TILE; i++) {
    if (!isPath(x, y - 1)) { const d = edge(0, i); px(ctx, GRASS.base, ox + i, oy, 1, d); px(ctx, SAND.edge, ox + i, oy + d); }
    if (!isPath(x, y + 1)) { const d = edge(1, i); px(ctx, GRASS.base, ox + i, oy + TILE - d, 1, d); px(ctx, SAND.edge, ox + i, oy + TILE - d - 1); }
    if (!isPath(x - 1, y)) { const d = edge(2, i); px(ctx, GRASS.base, ox, oy + i, d, 1); px(ctx, SAND.edge, ox + d, oy + i); }
    if (!isPath(x + 1, y)) { const d = edge(3, i); px(ctx, GRASS.base, ox + TILE - d, oy + i, d, 1); px(ctx, SAND.edge, ox + TILE - d - 1, oy + i); }
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

  const water = (nx, ny) => map.tileAt(nx, ny) === 'w';
  const n = !water(x, y - 1);
  const s = !water(x, y + 1);
  const w = !water(x - 1, y);
  const e = !water(x + 1, y);
  if (n) { px(ctx, WATER.edge, ox, oy, TILE, 1); px(ctx, WATER.foam, ox, oy + 1, TILE, 1); }
  if (s) { px(ctx, WATER.foam, ox, oy + 14, TILE, 1); px(ctx, WATER.edge, ox, oy + 15, TILE, 1); }
  if (w) { px(ctx, WATER.edge, ox, oy, 1, TILE); px(ctx, WATER.foam, ox + 1, oy, 1, TILE); }
  if (e) { px(ctx, WATER.foam, ox + 14, oy, 1, TILE); px(ctx, WATER.edge, ox + 15, oy, 1, TILE); }

  // Bo tròn góc lồi: (sx, sy) là hướng của góc
  const corner = (sx, sy) => {
    const X = (i) => (sx > 0 ? ox + TILE - 1 - i : ox + i);
    const Y = (j) => (sy > 0 ? oy + TILE - 1 - j : oy + j);
    for (const [i, j] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]]) px(ctx, GRASS.base, X(i), Y(j));
    for (const [i, j] of [[3, 0], [2, 1], [1, 2], [0, 3]]) px(ctx, WATER.edge, X(i), Y(j));
    for (const [i, j] of [[3, 1], [2, 2], [1, 3]]) px(ctx, WATER.foam, X(i), Y(j));
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
    px(ctx, color, hx - 1, cy - 1, 3, 1);
    px(ctx, color, hx - 1, cy + 1, 3, 1);
    px(ctx, color, hx - 2, cy, 1, 1);
    px(ctx, color, hx + 2, cy, 1, 1);
    px(ctx, '#f8e060', hx - 1, cy, 3, 1);
    px(ctx, '#e08020', hx, cy, 1, 1);
  }
}

// Cây 32x32 (chiếm 2x2 ô): tán lá ghép từ nhiều cụm tròn, đổ bóng dither
const TREE_CLUSTERS = [[16, 10, 10], [8, 14, 7], [24, 14, 7], [11, 6, 6], [21, 6, 6], [16, 17, 8]];
const TREE_GREENS = ['#1f5a24', '#2f7a30', '#45983a', '#68b84c', '#90d068'];

function drawTree(ctx, ox, oy) {
  for (let y = 24; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (((x - 16) / 13) ** 2 + ((y - 28.5) / 3.5) ** 2 <= 1) px(ctx, '#4a8a36', ox + x, oy + y);
    }
  }
  px(ctx, '#3a2410', ox + 12, oy + 19, 8, 11);
  px(ctx, '#8a5a30', ox + 13, oy + 19, 6, 10);
  px(ctx, '#b07848', ox + 13, oy + 19, 2, 10);
  px(ctx, '#603c20', ox + 17, oy + 19, 2, 10);

  const owner = new Int8Array(32 * 32).fill(-1);
  TREE_CLUSTERS.forEach(([cx, cy, r], i) => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if ((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2 <= r * r) owner[y * 32 + x] = i;
      }
    }
  });
  const at = (x, y) => (x < 0 || y < 0 || x > 31 || y > 31 ? -1 : owner[y * 32 + x]);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const i = at(x, y);
      if (i < 0) continue;
      let color;
      if (at(x - 1, y) < 0 || at(x + 1, y) < 0 || at(x, y - 1) < 0 || at(x, y + 1) < 0) {
        color = '#163a18';
      } else if (at(x, y - 1) !== i && at(x, y - 1) < i) {
        color = TREE_GREENS[0]; // mép trên của cụm lá phía trước
      } else {
        const [cx, cy, r] = TREE_CLUSTERS[i];
        const light = 0.62 - ((x - cx) * 0.55 + (y - cy) * 0.9) / (r * 2.4);
        color = dither(light, x, y, TREE_GREENS);
      }
      px(ctx, color, ox + x, oy + y);
    }
  }
}

// Pokémon Center 80x64 (5x4 ô), cửa ở giữa hàng dưới
function drawCenter(ctx, ox, oy) {
  const O = '#3a2020';
  // tường
  px(ctx, '#504038', ox + 3, oy + 26, 74, 34);
  px(ctx, '#f8f0d8', ox + 4, oy + 27, 72, 32);
  px(ctx, '#e4d8b8', ox + 62, oy + 27, 14, 32);
  px(ctx, '#504038', ox + 2, oy + 58, 76, 6);
  px(ctx, '#a0a8b0', ox + 3, oy + 59, 74, 4);
  px(ctx, '#c8d0d8', ox + 3, oy + 59, 74, 1);
  // mái
  for (let r = 0; r <= 27; r++) {
    const inset = r < 4 ? 4 - r : 0;
    px(ctx, O, ox + inset, oy + r, 80 - 2 * inset, 1);
    if (r >= 1 && r <= 25) {
      const color = r <= 2 ? '#f88878' : r % 5 === 0 ? '#c03c34' : '#e85448';
      px(ctx, color, ox + inset + 1, oy + r, 78 - 2 * inset, 1);
    }
  }
  px(ctx, '#b8a888', ox + 4, oy + 28, 72, 2);
  // biển hiệu Poké Ball
  px(ctx, O, ox + 27, oy + 5, 26, 18);
  px(ctx, '#fff8f0', ox + 28, oy + 6, 24, 16);
  for (let dy = -7; dy <= 7; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      const d = dx * dx + dy * dy;
      if (d > 50) continue;
      let color = dy < -1 ? '#f04040' : dy > 1 ? '#ffffff' : O;
      if (d >= 37) color = O;
      if (d <= 8) color = d <= 3 ? '#ffffff' : O;
      px(ctx, color, ox + 40 + dx, oy + 14 + dy);
    }
  }
  // cửa sổ
  for (const wx of [9, 55]) {
    px(ctx, '#506070', ox + wx, oy + 33, 16, 14);
    px(ctx, '#9ad4f8', ox + wx + 1, oy + 34, 14, 12);
    px(ctx, '#d8f0ff', ox + wx + 2, oy + 35, 4, 2);
    px(ctx, '#d8f0ff', ox + wx + 2, oy + 37, 2, 2);
    px(ctx, '#506070', ox + wx + 7, oy + 34, 2, 12);
    px(ctx, '#506070', ox + wx + 1, oy + 39, 14, 1);
  }
  // mái hiên + cửa kính
  px(ctx, O, ox + 28, oy + 36, 24, 5);
  px(ctx, '#e85448', ox + 29, oy + 37, 22, 3);
  px(ctx, '#404a58', ox + 31, oy + 41, 18, 18);
  px(ctx, '#7ac0f0', ox + 32, oy + 42, 16, 17);
  px(ctx, '#404a58', ox + 39, oy + 42, 2, 17);
  px(ctx, '#c8ecff', ox + 33, oy + 43, 3, 7);
  px(ctx, '#c8ecff', ox + 42, oy + 43, 3, 7);
  px(ctx, '#d04040', ox + 31, oy + 59, 18, 4);
}

// Chữ pixel 5 dòng cho biển hiệu
const GLYPHS = {
  M: ['10001', '11011', '10101', '10001', '10001'],
  A: ['010', '101', '111', '101', '101'],
  R: ['110', '101', '110', '101', '101'],
  T: ['111', '010', '010', '010', '010'],
};

function drawWord(ctx, word, x, y, color) {
  let cx = x;
  for (const ch of word) {
    GLYPHS[ch].forEach((row, j) => [...row].forEach((bit, i) => bit === '1' && px(ctx, color, cx + i, y + j)));
    cx += GLYPHS[ch][0].length + 1;
  }
}

// Poké Mart 64x64 (4x4 ô), mái xanh, cửa ở ô thứ 2 hàng dưới
function drawMart(ctx, ox, oy) {
  const O = '#1e2a4a';
  px(ctx, '#504038', ox + 2, oy + 26, 60, 34);
  px(ctx, '#f8f0d8', ox + 3, oy + 27, 58, 32);
  px(ctx, '#e4d8b8', ox + 50, oy + 27, 11, 32);
  px(ctx, '#504038', ox + 1, oy + 58, 62, 6);
  px(ctx, '#a0a8b0', ox + 2, oy + 59, 60, 4);
  px(ctx, '#c8d0d8', ox + 2, oy + 59, 60, 1);
  for (let r = 0; r <= 27; r++) {
    const inset = r < 4 ? 4 - r : 0;
    px(ctx, O, ox + inset, oy + r, 64 - 2 * inset, 1);
    if (r >= 1 && r <= 25) {
      const color = r <= 2 ? '#80b0f8' : r % 5 === 0 ? '#2f5cb8' : '#4a7ad8';
      px(ctx, color, ox + inset + 1, oy + r, 62 - 2 * inset, 1);
    }
  }
  px(ctx, '#b8a888', ox + 3, oy + 28, 58, 2);
  px(ctx, O, ox + 17, oy + 6, 30, 15);
  px(ctx, '#ffffff', ox + 18, oy + 7, 28, 13);
  drawWord(ctx, 'MART', ox + 23, oy + 11, '#2f5cb8');
  px(ctx, '#506070', ox + 38, oy + 33, 16, 14);
  px(ctx, '#9ad4f8', ox + 39, oy + 34, 14, 12);
  px(ctx, '#d8f0ff', ox + 40, oy + 35, 4, 2);
  px(ctx, '#506070', ox + 45, oy + 34, 2, 12);
  px(ctx, '#506070', ox + 39, oy + 39, 14, 1);
  px(ctx, O, ox + 13, oy + 36, 22, 5);
  px(ctx, '#4a7ad8', ox + 14, oy + 37, 20, 3);
  px(ctx, '#404a58', ox + 15, oy + 41, 18, 18);
  px(ctx, '#7ac0f0', ox + 16, oy + 42, 16, 17);
  px(ctx, '#404a58', ox + 23, oy + 42, 2, 17);
  px(ctx, '#c8ecff', ox + 17, oy + 43, 3, 7);
  px(ctx, '#c8ecff', ox + 26, oy + 43, 3, 7);
  px(ctx, '#3a6ad0', ox + 15, oy + 59, 18, 4);
}

// Biển báo gỗ 16x16
function drawSign(ctx, ox, oy) {
  px(ctx, '#4a8a36', ox + 4, oy + 14, 8, 2);
  px(ctx, '#3a2410', ox + 6, oy + 9, 4, 6);
  px(ctx, '#7a5030', ox + 7, oy + 9, 2, 6);
  px(ctx, '#3a2410', ox + 1, oy + 1, 14, 10);
  px(ctx, '#c89058', ox + 2, oy + 2, 12, 8);
  px(ctx, '#e0b078', ox + 2, oy + 2, 12, 1);
  px(ctx, '#a06a38', ox + 2, oy + 9, 12, 1);
  px(ctx, '#7a5030', ox + 4, oy + 4, 8, 1);
  px(ctx, '#7a5030', ox + 4, oy + 6, 6, 1);
}

function drawOutdoor(map, ground, objects, anim) {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const ch = map.tileAt(x, y);
      const ox = x * TILE;
      const oy = y * TILE;
      if (ch === '=') drawPath(ground, ox, oy, x, y, map);
      else if (ch === 'g') drawTallGrass(ground, ox, oy, GRASS);
      else if (ch === 'G') drawTallGrass(ground, ox, oy, DEEP);
      else drawGrass(ground, ox, oy, x, y);

      if (ch === 'w') anim.forEach((a, f) => drawWater(a, ox, oy, x, y, f, map));
      if (ch === 'f') anim.forEach((a, f) => drawFlowers(a, ox, oy, x, y, f));
      if (ch === 'T' && x % 2 === 0 && y % 2 === 0) drawTree(objects, ox, oy);
      if (ch === 's') drawSign(objects, ox, oy);
    }
  }
  for (const b of map.buildings) (b.type === 'mart' ? drawMart : drawCenter)(objects, b.x * TILE, b.y * TILE);
}

export function buildWorldTextures(scene) {
  for (const map of Object.values(MAPS)) {
    const W = map.width * TILE;
    const H = map.height * TILE;
    const ground = makeCanvas(W, H);
    const objects = makeCanvas(W, H);
    const anim = Array.from({ length: ANIM_FRAMES }, () => makeCanvas(W, H));
    if (map.indoor) drawInterior(map, ground.ctx, objects.ctx);
    else drawOutdoor(map, ground.ctx, objects.ctx, anim.map((a) => a.ctx));

    addCanvasTexture(scene, `${map.id}-ground`, ground.canvas);
    addCanvasTexture(scene, `${map.id}-objects`, objects.canvas);
    addSheetTexture(scene, `${map.id}-anim`, anim.map((a) => a.canvas), anim.map((_, i) => String(i)));
  }

  for (const [key, pal] of [['grass-front', GRASS], ['grass-front-deep', DEEP]]) {
    const front = makeCanvas(TILE, TILE);
    drawTallGrass(front.ctx, 0, 0, pal, [1], false);
    addCanvasTexture(scene, key, front.canvas);
  }
}
