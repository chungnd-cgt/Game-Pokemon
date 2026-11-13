import { TILE } from '../config.js';
import { decorBlocks, garlandLanterns, GARLAND_SAG, lanternGarlands } from '../data/tiles.js';
import { PixelBuffer, dither, hash, px, shadeHex } from './pixel.js';

// Đồ trang trí ngoài trời (ký tự ô: xem data/tiles.js): sân đất nện, ghế công viên, thùng rác, đèn đường đôi,
// gốc cây, khúc gỗ đổ, cây tán tròn, cây hoa anh đào lớn, bồn hoa, bờ cây xén.
// Vẽ kiểu GBA như phần còn lại của world.js: mỗi chất liệu 2-3 tông màu, viền tối 1px (PixelBuffer.outline).
// Phần nhô lên trên ô gốc (lưng ghế, đầu đèn, tán cây) vẽ vào lớp over để nhân vật đứng phía sau bị che.

// ---------- Sân đất nện (a) ----------

const DIRT = { base: '#d8b886', patch: '#d0ae7c', light: '#e2c496', dark: '#b8925e', rim: '#a27c4e', pebble: '#f0dcb4' };
// Đồ vật đặt được trên sân đất: ô của chúng vẽ nền đất nếu xung quanh phần lớn là đất
const ON_GROUND = 'ukQPEXYOkslKj';

const dirtCache = new WeakMap();
// Lưới ô có nền đất nện của bản đồ: ô 'a' và đồ vật đứng giữa sân (>= 2 ô kề cạnh hoặc >= 3 ô xung quanh là 'a')
export function dirtGrid(map) {
  if (dirtCache.has(map)) return dirtCache.get(map);
  const isA = (x, y) => map.rows[y]?.[x] === 'a';
  const grid = map.rows.map((row, y) => [...row].map((ch, x) => {
    if (ch === 'a') return true;
    if (!ON_GROUND.includes(ch)) return false;
    const orth = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isA(x + dx, y + dy)).length;
    const diag = [[1, 1], [-1, 1], [1, -1], [-1, -1]].filter(([dx, dy]) => isA(x + dx, y + dy)).length;
    return orth >= 2 || orth + diag >= 3;
  }));
  const at = (x, y) => Boolean(grid[y]?.[x]);
  dirtCache.set(map, at);
  return at;
}

// Nhiễu mượt theo toạ độ điểm ảnh toàn bản đồ (để mép sân nối liền qua các ô)
function smoothNoise(gx, gy, scale, seed) {
  const fx = gx / scale;
  const fy = gy / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const u = fx - x0;
  const v = fy - y0;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * s(u) + (c - a) * s(v) + (a - b - c + d) * s(u) * s(v);
}

// Sân đất nện: nền nâu vàng loang lổ, sỏi nhỏ; giáp cỏ thì mép lượn sóng mềm có viền đất sẫm, góc bo tròn.
// Giáp đường / cửa / nhà thì liền mạch (không viền)
export function drawDirt(ctx, ox, oy, x, y, map, grassColor) {
  const dirt = dirtGrid(map);
  const open = (nx, ny) => dirt(nx, ny) || map.tileAt(nx, ny) === '=' || map.tileAt(nx, ny) === 'C'
    || Boolean(map.doorAt(nx, ny)) || Boolean(map.buildingAt(nx, ny));
  const [n, s, w, e] = [!open(x, y - 1), !open(x, y + 1), !open(x - 1, y), !open(x + 1, y)];
  const R = 6;
  for (let j = 0; j < TILE; j++) {
    for (let i = 0; i < TILE; i++) {
      const gx = ox + i;
      const gy = oy + j;
      // khoảng cách tới cỏ gần nhất (tính theo cạnh / góc giáp cỏ)
      let d = 99;
      if (n) d = Math.min(d, j);
      if (s) d = Math.min(d, TILE - 1 - j);
      if (w) d = Math.min(d, i);
      if (e) d = Math.min(d, TILE - 1 - i);
      for (const [cx, cy, on] of [[0, 0, n && w], [1, 0, n && e], [0, 1, s && w], [1, 1, s && e]]) {
        if (!on) continue;
        const li = cx ? TILE - 1 - i : i;
        const lj = cy ? TILE - 1 - j : j;
        if (li < R && lj < R) d = Math.min(d, R - Math.hypot(R - li - 0.5, R - lj - 0.5));
      }
      // góc lõm: hai cạnh là đất nhưng ô chéo là cỏ thì khoét một vệt cỏ nhỏ ở góc
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (!open(x + sx, y) || !open(x, y + sy) || open(x + sx, y + sy)) continue;
        const li = sx > 0 ? TILE - 1 - i : i;
        const lj = sy > 0 ? TILE - 1 - j : j;
        d = Math.min(d, Math.hypot(li + 0.5, lj + 0.5) - 2.5);
      }
      const edge = 0.6 + smoothNoise(gx, gy, 3, 11) * 2.6;
      let c;
      if (d < edge) c = grassColor;
      else if (d < edge + 1) c = DIRT.rim;
      else {
        // loang nhẹ: vùng sẫm hơn một chút, chuyển tiếp bằng điểm lẻ cho mềm
        const v = smoothNoise(gx, gy, 9, 23);
        c = v > 0.68 || (v > 0.6 && (gx + gy) % 2 === 0) ? DIRT.patch : DIRT.base;
      }
      px(ctx, c, gx, gy);
    }
  }
  // sỏi nhỏ và vết đất (tránh mép cỏ)
  for (let k = 0; k < 4; k++) {
    const sx = 3 + Math.floor(hash(x, y, 310 + k) * 10);
    const sy = 3 + Math.floor(hash(x, y, 320 + k) * 10);
    if ((n && sy < 5) || (s && sy > 10) || (w && sx < 5) || (e && sx > 10)) continue;
    const r = hash(x, y, 330 + k);
    if (r < 0.35) {
      px(ctx, DIRT.pebble, ox + sx, oy + sy);
      px(ctx, DIRT.dark, ox + sx, oy + sy + 1);
    } else if (r < 0.6) {
      px(ctx, DIRT.dark, ox + sx, oy + sy, 2, 1);
    } else if (r < 0.75) {
      px(ctx, DIRT.light, ox + sx, oy + sy, 2, 1);
    }
  }
}

// ---------- Tiện ích vẽ ----------

// Vẽ PixelBuffer tại (ix, iy): các hàng nằm trên footTop (đỉnh ô gốc, toạ độ điểm ảnh) vào lớp over, phần còn lại vào objects
function drawSplit(p, objects, over, ix, iy, footTop) {
  const cut = Math.max(0, Math.min(p.h, footTop - iy));
  if (cut > 0) p.drawTo(over, ix, iy, 0, cut);
  p.drawTo(objects, ix, iy, cut, p.h);
}

// Bóng bầu dục mờ trên nền (vẽ theo hàng điểm ảnh cho sắc nét)
function shadow(ctx, cx, cy, rx, ry, alpha = 0.26) {
  ctx.fillStyle = `rgba(16,40,24,${alpha})`;
  for (let j = -ry; j <= ry; j++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + 0.5)) ** 2)));
    if (hw > 0) ctx.fillRect(cx - hw, cy + j, hw * 2, 1);
  }
}

const WOOD = { dark: '#7a4a24', base: '#b67a44', light: '#dca066', hi: '#f2c48a' };
const IRON = { dark: '#262c38', base: '#3e4656', light: '#6c788c' };
const BARK = { dark: '#5a3418', base: '#80522a', light: '#a8743e' };
const CUT = { base: '#e6c48a', ring: '#c09458', core: '#a87a44' };

// ---------- Ghế công viên (EE): ván gỗ, khung sắt, lưng tựa phía sau (nhô lên ô trên 4px) ----------

const benchCache = {};
function benchSprite() {
  if (benchCache.p) return benchCache.p;
  const p = new PixelBuffer(32, 21);
  // chân và tay vịn sắt hai đầu
  for (const x of [2, 27]) {
    p.rect(x, 2, 3, 16, IRON.base);
    p.rect(x, 2, 1, 16, IRON.light);
    p.rect(x, 18, 3, 2, IRON.dark);
  }
  // lưng tựa: hai thanh ván ngang
  for (const y of [2, 6]) {
    p.rect(5, y, 22, 3, WOOD.base);
    p.rect(5, y, 22, 1, WOOD.light);
    p.rect(5, y + 2, 22, 1, WOOD.dark);
  }
  // thanh sắt đỡ lưng
  for (const x of [10, 21]) p.rect(x, 5, 1, 6, IRON.base);
  // mặt ghế nhìn từ trên: ba thanh ván, mép trước sẫm
  for (const [y, c] of [[10, WOOD.light], [11, WOOD.base], [12, WOOD.hi], [13, WOOD.base], [14, WOOD.light], [15, WOOD.base]]) p.rect(5, y, 22, 1, c);
  p.rect(5, 16, 22, 1, WOOD.dark);
  p.rect(5, 17, 22, 1, shadeHex(WOOD.dark, -0.2));
  // chân giữa
  for (const x of [9, 22]) p.rect(x, 17, 2, 3, IRON.dark);
  // vân gỗ
  for (const [x, y] of [[8, 3], [17, 7], [13, 11], [20, 13], [24, 3], [7, 15]]) p.set(x, y, WOOD.dark);
  p.outline(-0.55);
  benchCache.p = p;
  return p;
}
function drawBench(ground, objects, over, ox, oy) {
  shadow(ground, ox + 16, oy + 15, 14, 2);
  drawSplit(benchSprite(), objects, over, ox, oy - 5, oy);
}

// ---------- Thùng rác (u): thùng sắt xanh có nắp, gân dọc ----------

function drawBin(ground, objects, ox, oy, x, y) {
  shadow(ground, ox + 8, oy + 14, 6, 2);
  const p = new PixelBuffer(TILE, TILE);
  const G = { dark: '#2a6046', base: '#3c8a5e', light: '#66b07e', hi: '#a6dcb4' };
  p.rect(4, 5, 8, 10, G.base);
  p.rect(4, 5, 2, 10, G.light);
  p.rect(10, 5, 2, 10, G.dark);
  for (const gx of [7, 9]) p.rect(gx, 6, 1, 8, G.dark);
  p.rect(5, 6, 1, 7, G.hi);
  p.rect(4, 12, 8, 1, G.dark);
  // vành và nắp
  p.rect(3, 4, 10, 2, IRON.base);
  p.rect(3, 4, 10, 1, IRON.light);
  p.rect(4, 2, 8, 2, IRON.base);
  p.rect(5, 2, 4, 1, IRON.light);
  p.rect(7, 1, 2, 1, IRON.dark);
  // mẩu giấy thò ra dưới nắp (thay đổi theo vị trí)
  if (hash(x, y, 340) > 0.5) p.rect(9, 3, 2, 1, '#f0ece0');
  p.outline(-0.55);
  p.drawTo(objects, ox, oy);
}

// ---------- Gốc cây (k): mặt cắt có vòng tuổi, vỏ sần, rễ toả ----------

function drawStump(ground, objects, ox, oy, x, y) {
  shadow(ground, ox + 8, oy + 13, 7, 2);
  const p = new PixelBuffer(TILE, TILE);
  p.rect(3, 7, 10, 6, BARK.base);
  p.rect(3, 7, 2, 6, BARK.light);
  p.rect(11, 7, 2, 6, BARK.dark);
  for (const bx of [6, 9]) p.rect(bx, 8, 1, 4, BARK.dark);
  // rễ
  p.rect(1, 11, 3, 2, BARK.base);
  p.rect(12, 11, 3, 2, BARK.dark);
  p.rect(7, 12, 3, 2, BARK.base);
  // mặt cắt
  p.ellipse(8, 7, 5.6, 3.1, CUT.base);
  p.ellipse(8, 7, 3.6, 1.9, CUT.ring, (px_, py) => px_ <= 4 || px_ >= 11 || py <= 5 || py >= 8);
  p.ellipse(8, 7, 3.6, 1.9, CUT.ring, (px_, py) => py === 5 || py === 8);
  p.set(8, 7, CUT.core);
  p.set(7, 7, CUT.core);
  // rêu
  if (hash(x, y, 350) > 0.4) {
    p.set(3, 10, '#5a9a3a');
    p.set(4, 11, '#7cbc4a');
    p.set(3, 11, '#5a9a3a');
  }
  p.outline(-0.6);
  p.drawTo(objects, ox, oy);
}

// ---------- Khúc gỗ đổ (XX): thân nằm ngang, đầu phải là mặt cắt, rêu và nấm nhỏ ----------

const logCache = {};
function logSprite(v) {
  if (logCache[v]) return logCache[v];
  const p = new PixelBuffer(32, TILE);
  p.rect(2, 5, 26, 9, BARK.base);
  p.rect(2, 5, 26, 2, BARK.light);
  p.rect(2, 12, 26, 2, BARK.dark);
  for (const [bx, by, l] of [[5, 8, 3], [11, 9, 4], [17, 7, 3], [22, 9, 3], [8, 11, 2], [19, 11, 3]]) p.rect(bx, by, l, 1, BARK.dark);
  // đầu trái gãy lởm chởm
  for (const [bx, by] of [[2, 5], [2, 6], [2, 12], [2, 13], [3, 5]]) p.set(bx, by, null);
  p.rect(1, 8, 1, 3, BARK.base);
  // mặt cắt đầu phải
  p.ellipse(28, 9.5, 2.8, 4.6, CUT.base);
  p.ellipse(28, 9.5, 1.5, 2.6, CUT.ring);
  p.set(28, 9, CUT.core);
  // rêu trên lưng
  for (const [mx, my] of [[6, 5], [7, 5], [8, 4], [7, 6], [14, 5], [15, 5], [15, 4]]) p.set(mx, my, my === 4 ? '#8ccc5a' : '#5a9a3a');
  if (v) {
    // nấm nhỏ mũ đỏ chấm trắng
    p.rect(20, 2, 4, 2, '#d84434');
    p.set(21, 2, '#f8f0e0');
    p.rect(21, 4, 2, 1, '#f0e0c0');
  }
  p.outline(-0.6);
  logCache[v] = p;
  return p;
}
function drawLog(ground, objects, ox, oy, x, y) {
  shadow(ground, ox + 16, oy + 14, 14, 2);
  logSprite(hash(x, y, 360) > 0.45 ? 1 : 0).drawTo(objects, ox, oy);
}

// ---------- Đèn đường đôi (Q): cột sắt, xà ngang, hai bóng đèn kính vàng (cao ~2.5 ô) ----------

const lampCache = {};
function lampSprite() {
  if (lampCache.p) return lampCache.p;
  const p = new PixelBuffer(TILE, 42);
  // đế cột
  p.rect(5, 36, 6, 5, IRON.base);
  p.rect(5, 36, 2, 5, IRON.light);
  p.rect(4, 40, 8, 1, IRON.dark);
  // thân cột
  p.rect(7, 8, 2, 29, IRON.base);
  p.rect(7, 8, 1, 29, IRON.light);
  p.rect(6, 22, 4, 2, IRON.base);
  p.rect(6, 22, 4, 1, IRON.light);
  // xà ngang và hai móc cong
  p.rect(2, 10, 12, 2, IRON.base);
  p.rect(2, 10, 12, 1, IRON.light);
  p.set(3, 12, IRON.base);
  p.set(12, 12, IRON.base);
  // đỉnh cột
  p.rect(7, 4, 2, 4, IRON.base);
  p.rect(7, 2, 2, 2, IRON.light);
  // hai bóng đèn: mũ sắt, kính vàng, đáy sắt
  for (const lx of [1, 10]) {
    p.rect(lx + 1, 1, 3, 1, IRON.dark);
    p.rect(lx, 2, 5, 1, IRON.base);
    p.rect(lx + 1, 3, 3, 5, '#fff2b8');
    p.rect(lx + 1, 6, 3, 2, '#f8cc58');
    p.set(lx + 1, 3, '#ffffff');
    p.rect(lx, 3, 1, 5, IRON.base);
    p.rect(lx + 4, 3, 1, 5, IRON.base);
    p.rect(lx, 8, 5, 2, IRON.base);
  }
  p.outline(-0.5);
  lampCache.p = p;
  return p;
}
function drawLamp(ground, objects, over, ox, oy) {
  shadow(ground, ox + 8, oy + 14, 5, 2);
  drawSplit(lampSprite(), objects, over, ox, oy + TILE - 42, oy);
}

// ---------- Cột đèn lồng (l): cột gỗ sơn son cao ~2.5 ô trên đế đá, xà mái cong vểnh hai đầu, chóp vàng; hai đèn lồng đỏ treo
// hai bên xà (chóp và đáy vàng, gân sẫm, tua đỏ vàng). Phần trên ô gốc vẽ vào lớp over để người đi phía sau bị che ----------

const LACQUER = { dark: '#4a120c', base: '#7a2018', light: '#a83a28' };
const GOLD = { dark: '#a87818', base: '#e8b830', light: '#f8e080' };
const LANTERN = { dark: '#8a1414', base: '#c8282a', light: '#f04a3a', glow: '#ffb860' };
const poleCache = {};
function lanternPoleSprite() {
  if (poleCache.p) return poleCache.p;
  const p = new PixelBuffer(TILE, 40);
  // đế đá
  p.rect(4, 35, 8, 5, '#8a8a92');
  p.rect(4, 35, 8, 1, '#b8b8c0');
  p.rect(10, 36, 2, 4, '#6a6a72');
  // thân cột sơn son
  p.rect(7, 6, 2, 29, LACQUER.base);
  p.rect(7, 6, 1, 29, LACQUER.light);
  p.rect(6, 30, 4, 2, GOLD.base); // đai vàng
  // xà mái cong, vểnh hai đầu, chóp vàng giữa
  p.rect(1, 5, 14, 2, '#3a2414');
  p.rect(2, 5, 12, 1, '#5a3a20');
  p.set(0, 4, '#3a2414');
  p.set(15, 4, '#3a2414');
  p.rect(7, 2, 2, 3, GOLD.base);
  p.set(7, 2, GOLD.light);
  p.set(7, 1, GOLD.dark);
  // hai đèn lồng treo hai bên
  for (const lx of [1, 10]) {
    p.set(lx + 2, 7, '#3a2414'); // dây treo
    p.rect(lx + 1, 8, 4, 1, GOLD.base); // chóp
    p.rect(lx, 9, 6, 8, LANTERN.base); // thân đèn
    p.rect(lx, 9, 1, 8, LANTERN.dark);
    p.rect(lx + 5, 9, 1, 8, LANTERN.dark);
    p.set(lx, 9, null);
    p.set(lx + 5, 9, null);
    p.set(lx, 16, null);
    p.set(lx + 5, 16, null);
    p.rect(lx + 2, 10, 2, 6, LANTERN.glow); // ánh nến xuyên giấy
    p.rect(lx + 1, 10, 1, 6, LANTERN.light);
    for (const gy of [11, 14]) p.rect(lx + 1, gy, 4, 1, LANTERN.dark); // gân đèn
    p.rect(lx + 1, 17, 4, 1, GOLD.base); // đáy
    p.rect(lx + 2, 18, 2, 1, GOLD.dark); // tua
    p.set(lx + 2, 19, LANTERN.base);
    p.set(lx + 3, 20, LANTERN.base);
  }
  p.outline(-0.5);
  poleCache.p = p;
  return p;
}
function drawLanternPole(ground, objects, over, ox, oy) {
  shadow(ground, ox + 8, oy + 14, 5, 2);
  drawSplit(lanternPoleSprite(), objects, over, ox, oy + TILE - 40, oy);
}

// Dây đèn lồng giăng giữa hai cột liền nhau (bản đồ có lanternGarlands): dây võng xuống, đèn lồng nhỏ đỏ / vàng xen kẽ.
// Vẽ cả vào lớp over (dây cao hơn người)
function drawGarlands(map, over) {
  for (const g of lanternGarlands(map.rows, map.buildings ?? [])) {
    const x0 = g.x1 * TILE + 8 + 7;
    const x1 = g.x2 * TILE + 8 - 7;
    const base = g.y * TILE - 17;
    for (let x = x0; x <= x1; x++) {
      const t = (x - (g.x1 * TILE + 8)) / ((g.x2 - g.x1) * TILE);
      px(over, '#3a2414', x, Math.round(base + Math.sin(t * Math.PI) * GARLAND_SAG * TILE), 1, 1);
    }
    for (const { cx, cy, sy, i } of garlandLanterns(g)) {
      const x = Math.round(cx * TILE) - 1;
      const y = Math.round(cy * TILE) - 2;
      const red = i % 2 === 0;
      const body = red ? LANTERN.base : GOLD.base;
      const dark = red ? LANTERN.dark : GOLD.dark;
      const cord = y - Math.round(sy * TILE) - 1;
      if (cord > 0) px(over, '#3a2414', x + 1, Math.round(sy * TILE) + 1, 1, cord);
      px(over, dark, x, y, 3, 1);
      px(over, body, x - 1, y + 1, 5, 3);
      px(over, red ? LANTERN.glow : GOLD.light, x + 1, y + 1, 1, 3);
      px(over, dark, x - 1, y + 1, 1, 3);
      px(over, dark, x + 3, y + 1, 1, 3);
      px(over, dark, x, y + 4, 3, 1);
    }
  }
}

// ---------- Cây tán tròn (OO/OO): cây lá rộng tán tròn nhiều chùm lá, có biến thể lá thu cam ----------

const LEAF_GREEN = ['#1c4420', '#2c6a2c', '#468e3a', '#68b24a', '#96d266', '#c6ee92'];
const LEAF_AUTUMN = ['#5a2410', '#8a3a16', '#c25a1e', '#e48a2c', '#f2b84a', '#fae08c'];
const roundCache = {};
function roundTree(autumn) {
  if (roundCache[autumn]) return roundCache[autumn];
  const pal = autumn ? LEAF_AUTUMN : LEAF_GREEN;
  const p = new PixelBuffer(32, 48);
  // thân và rễ
  p.rect(13, 30, 6, 16, BARK.base);
  p.rect(13, 30, 2, 16, BARK.light);
  p.rect(17, 30, 2, 16, BARK.dark);
  p.rect(11, 44, 10, 2, BARK.base);
  p.rect(18, 44, 3, 2, BARK.dark);
  // tán: nhiều chùm lá tròn chồng lên nhau, sáng phía trên trái
  const lumps = [[16, 9, 7], [9, 14, 7], [23, 14, 7], [16, 17, 9], [7, 23, 6.5], [25, 23, 6.5], [12, 27, 7], [20, 27, 7], [16, 24, 8]];
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 32; x++) {
      let best = null;
      for (const [cx, cy, r] of lumps) {
        const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (dd <= 1 && (!best || cy > best[1] || (cy === best[1] && dd < best[3]))) best = [cx, cy, r, dd];
      }
      if (!best) continue;
      const [cx, cy, r] = best;
      const local = ((x + 0.5 - cx) + (y + 0.5 - cy)) / (r * 2);
      const v = 0.78 - (x - 16) / 70 - y / 46 - local * 0.55;
      p.set(x, y, dither(v, x, y, pal));
    }
  }
  // điểm sáng lấp lánh trên các chùm lá
  for (const [hx, hy] of [[12, 6], [6, 11], [19, 10], [13, 15], [4, 20], [21, 19], [9, 24]]) p.set(hx, hy, pal[5]);
  p.outline(-0.45);
  roundCache[autumn] = p;
  return p;
}
function drawRoundTree(ground, objects, over, ox, oy, x, y, map) {
  shadow(ground, ox + 16, oy + 29, 13, 3, 0.28);
  // bản đồ khai báo autumn: tỉ lệ cây lá thu (mặc định 0.3)
  const autumn = hash(x, y, 370) < (map.autumn ?? 0.3);
  drawSplit(roundTree(autumn), objects, over, ox, oy - 16, oy);
}

// ---------- Cây hoa anh đào lớn (Y ở gốc): tán hồng rộng ~3.5 ô, thân nâu sẫm có cành, cánh hoa rơi dưới gốc ----------

const PINK = ['#8a2c58', '#b84a7a', '#dc6e98', '#f096b8', '#f8bcd2', '#fde6ef'];
const blossomCache = {};
function blossomSprite() {
  if (blossomCache.p) return blossomCache.p;
  const W = 60;
  const H = 62;
  const p = new PixelBuffer(W, H);
  const trunk = { dark: '#3e2418', base: '#5e3a28', light: '#86583c' };
  // thân, rễ, cành chìa ra dưới tán
  p.rect(27, 34, 7, 26, trunk.base);
  p.rect(27, 34, 2, 26, trunk.light);
  p.rect(32, 34, 2, 26, trunk.dark);
  p.rect(23, 57, 15, 3, trunk.base);
  p.rect(33, 57, 5, 3, trunk.dark);
  for (let i = 0; i < 12; i++) {
    p.rect(26 - i, 38 - Math.floor(i * 0.7), 2, 2, i > 8 ? trunk.light : trunk.base);
    p.rect(33 + i, 38 - Math.floor(i * 0.7), 2, 2, trunk.dark);
  }
  // tán: khung các khối lớn, phủ thêm nhiều chùm hoa nhỏ (mỗi chùm sáng trên trái, tối dưới phải; chùm thấp hơn đè lên
  // chùm cao hơn) để tán có khối rõ như cây hoa vẽ tay
  const big = [[30, 11, 11], [17, 15, 10], [43, 15, 10], [10, 26, 7.5], [50, 26, 7.5], [30, 23, 13],
    [20, 30, 10], [40, 30, 10], [30, 34, 8], [24, 5, 7], [37, 6, 7]];
  const inside = (x, y) => big.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r);
  const lumps = [];
  for (let gy = 3; gy < 42; gy += 6) {
    for (let gx = 3 + ((gy / 6) % 2) * 3; gx < W - 2; gx += 7) {
      const cx = gx + (hash(gx, gy, 390) - 0.5) * 3;
      const cy = gy + (hash(gx, gy, 391) - 0.5) * 3;
      if (inside(cx, cy)) lumps.push([cx, cy, 5 + hash(gx, gy, 392) * 2]);
    }
  }
  for (let y = 0; y < 44; y++) {
    for (let x = 0; x < W; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      let best = null;
      for (const [cx, cy, r] of lumps) {
        const dd = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        if (dd <= 1 && (!best || cy > best[1])) best = [cx, cy, r, dd];
      }
      // giữa các chùm: khe tối
      if (!best) {
        p.set(x, y, dither(0.22 - y / 200, x, y, PINK));
        continue;
      }
      const [cx, cy, r] = best;
      const local = ((x + 0.5 - cx) * 0.7 + (y + 0.5 - cy)) / r;
      const v = 0.9 - (x - 30) / 160 - y / 95 - local * 0.32 - (best[3] > 0.82 && local > 0 ? 0.2 : 0);
      p.set(x, y, dither(v, x, y, PINK));
    }
  }
  // chấm hoa trắng lốm đốm trên tán
  for (let k = 0; k < 40; k++) {
    const fx = Math.floor(hash(k, 1, 380) * W);
    const fy = Math.floor(hash(k, 2, 380) * 36);
    if (p.get(fx, fy) && p.get(fx, fy) !== PINK[0] && p.get(fx, fy) !== PINK[1]) p.set(fx, fy, PINK[5]);
  }
  p.outline(-0.42);
  blossomCache.p = p;
  return p;
}
function drawBlossom(ground, objects, over, ox, oy, x, y, map) {
  // bóng tán lớn phủ quanh gốc
  shadow(ground, ox + 8, oy + 6, 24, 7, 0.2);
  shadow(ground, ox + 8, oy + 13, 9, 2, 0.24);
  // cánh hoa rơi trên nền quanh gốc (chỉ trên ô cỏ / đất)
  const soft = (cx, cy) => '.afh'.includes(map.tileAt(cx, cy));
  for (let k = 0; k < 26; k++) {
    const dx = Math.floor(hash(x, y, 400 + k) * 48) - 16;
    const dy = Math.floor(hash(x, y, 430 + k) * 30) - 8;
    const gx = ox + dx;
    const gy = oy + dy;
    const cx = Math.floor(gx / TILE);
    const cy = Math.floor(gy / TILE);
    if ((cx === x && cy === y) || !soft(cx, cy)) continue;
    px(ground, k % 4 === 0 ? PINK[2] : PINK[4], gx, gy, k % 3 === 0 ? 2 : 1, 1);
  }
  drawSplit(blossomSprite(), objects, over, ox + 8 - 30, oy + TILE - 62, oy);
}

// ---------- Bồn hoa (P): bồn xây gạch đá, đất nâu, hoa nhiều màu; các ô bồn hoa cạnh nhau nối thành một bồn dài ----------

const FLOWER_COLORS = ['#f05858', '#f8c040', '#f080b8', '#f8f8f8', '#a070e0', '#f89040'];
const STONE = { top: '#ece0cc', base: '#c8b298', dark: '#9c8468', mortar: '#ae967a' };
function drawPlanter(ground, objects, ox, oy, x, y, map) {
  const left = map.tileAt(x - 1, y) === 'P';
  const right = map.tileAt(x + 1, y) === 'P';
  const x0 = left ? 0 : 1;
  const x1 = right ? TILE : 15;
  px(ground, 'rgba(16,40,24,0.24)', ox + x0 + 1, oy + 15, x1 - x0, 1);
  const p = new PixelBuffer(TILE, TILE);
  // miệng bồn (đá sáng) và đất
  p.rect(x0, 5, x1 - x0, 5, STONE.top);
  p.rect(left ? 0 : 2, 6, (right ? TILE : 14) - (left ? 0 : 2), 3, '#6a4428');
  p.rect(left ? 0 : 2, 6, (right ? TILE : 14) - (left ? 0 : 2), 1, '#4a2e18');
  // thành bồn: gạch đá có mạch vữa
  p.rect(x0, 10, x1 - x0, 5, STONE.base);
  p.rect(x0, 14, x1 - x0, 1, STONE.dark);
  p.rect(x0, 12, x1 - x0, 1, STONE.mortar);
  for (let i = x0; i < x1; i++) {
    const gx = ox + i;
    if (gx % 6 === 0) p.rect(i, 10, 1, 2, STONE.mortar);
    if ((gx + 3) % 6 === 0) p.set(i, 13, STONE.mortar);
  }
  // lá và hoa
  for (let k = 0; k < 3; k++) {
    const fx = (left ? 2 : 3) + k * 4 + Math.floor(hash(x, y, 450 + k) * 2);
    if (fx > (right ? 15 : 12)) continue;
    const fy = 3 + Math.floor(hash(x, y, 460 + k) * 2);
    const color = FLOWER_COLORS[Math.floor(hash(x, y, 470 + k) * FLOWER_COLORS.length)];
    p.rect(fx - 1, fy + 2, 4, 3, '#3e8a3a');
    p.set(fx - 1, fy + 2, '#62b04a');
    p.rect(fx, fy - 1, 2, 1, color);
    p.rect(fx - 1, fy, 4, 2, color);
    p.rect(fx, fy + 2, 2, 1, color);
    p.set(fx, fy, '#f8e070');
    p.set(fx + 1, fy + 1, shadeHex(color, -0.3));
  }
  p.outline(-0.55);
  p.drawTo(objects, ox, oy);
}

// ---------- Bờ cây xén thấp (e): khối lá xanh cắt vuông, mặt trên sáng, mặt trước sẫm; tự nối với ô bên cạnh ----------

const HEDGE = ['#1e5228', '#2c6e32', '#3e8a3c', '#5aa84a', '#86c862', '#b4e286'];
function drawHedge(ground, objects, ox, oy, x, y, map) {
  const at = (dx, dy) => map.tileAt(x + dx, y + dy) === 'e';
  const [L, R, U, D] = [at(-1, 0), at(1, 0), at(0, -1), at(0, 1)];
  const x0 = L ? 0 : 1;
  const x1 = R ? TILE : 15;
  const y0 = U ? 0 : 3;
  const front = D ? TILE : 11; // mặt trên tới hàng này, dưới là mặt trước
  const y1 = D ? TILE : 15;
  if (!D) px(ground, 'rgba(16,40,24,0.26)', ox + x0, oy + 15, x1 - x0 + (R ? 0 : 1), 1);
  const p = new PixelBuffer(TILE, TILE);
  for (let j = y0; j < y1; j++) {
    for (let i = x0; i < x1; i++) {
      const gx = ox + i;
      const gy = oy + j;
      const top = j < front;
      // vân lá: nhiễu theo toạ độ toàn bản đồ cho liền mạch giữa các ô
      const n = hash(gx >> 1, gy >> 1, 480);
      let v = top ? 0.72 - (j - y0) * 0.012 + (n - 0.5) * 0.35 : 0.36 - (j - front) * 0.05 + (n - 0.5) * 0.3;
      if (top && j === y0 && !U) v += 0.18;
      if (!L && i === x0) v -= 0.08;
      if (!R && i === x1 - 1) v -= 0.14;
      p.set(i, j, dither(v, gx, gy, HEDGE));
    }
  }
  // bo góc trên
  if (!U && !L) p.set(x0, y0, null);
  if (!U && !R) p.set(x1 - 1, y0, null);
  if (!D && !L) p.set(x0, y1 - 1, null);
  if (!D && !R) p.set(x1 - 1, y1 - 1, null);
  p.outline(-0.5);
  p.drawTo(objects, ox, oy);
}

// ---------- Vẽ toàn bộ đồ trang trí của bản đồ ----------

// Đồ 1 ô thấp (vẽ trong vòng lặp từng ô của drawOutdoor)
export function drawDecorTile(ch, ground, objects, ox, oy, x, y, map) {
  if (ch === 'u') drawBin(ground, objects, ox, oy, x, y);
  else if (ch === 'k') drawStump(ground, objects, ox, oy, x, y);
  else if (ch === 'P') drawPlanter(ground, objects, ox, oy, x, y, map);
  else if (ch === 'e') drawHedge(ground, objects, ox, oy, x, y, map);
}

// Đồ nhiều ô / cao (ghế, khúc gỗ, cây tán tròn, cây hoa, đèn đường): vẽ sau cây thông, theo hàng đáy từ trên xuống
// để món phía dưới đè lên món phía trên
export function drawDecorTall(map, ground, objects, over) {
  const items = decorBlocks(map.rows).map((b) => ({ ...b, bottom: b.y + b.h }));
  map.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 'Y' || ch === 'Q' || ch === 'l') items.push({ ch, x, y, w: 1, h: 1, bottom: y + 1 });
  }));
  items.sort((a, b) => a.bottom - b.bottom || a.x - b.x);
  for (const it of items) {
    const ox = it.x * TILE;
    const oy = it.y * TILE;
    if (it.ch === 'E') drawBench(ground, objects, over, ox, oy);
    else if (it.ch === 'X') drawLog(ground, objects, ox, oy, it.x, it.y);
    else if (it.ch === 'O') drawRoundTree(ground, objects, over, ox, oy, it.x, it.y, map);
    else if (it.ch === 'Y') drawBlossom(ground, objects, over, ox, oy, it.x, it.y, map);
    else if (it.ch === 'Q') drawLamp(ground, objects, over, ox, oy);
    else if (it.ch === 'l') drawLanternPole(ground, objects, over, ox, oy);
  }
  if (map.lanternGarlands) drawGarlands(map, over);
}
