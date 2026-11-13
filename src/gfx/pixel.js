// Công cụ vẽ pixel art lên canvas. Không phụ thuộc Phaser để test (node --test) dựng được hình pixel (thú cưỡi, nhân vật)

// Phaser.Textures.FilterMode.NEAREST: lấy màu điểm gần nhất khi phóng to (pixel sắc nét)
const FILTER_NEAREST = 1;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

// Làm sáng (f > 0) hoặc tối (f < 0) một màu dạng '#rrggbb'
export function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Bộ đệm pixel để dựng hình từ các khối rồi tự thêm viền kiểu Gen 5 (viền = màu kề bên làm tối đi)
export class PixelBuffer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Array(w * h).fill(null);
  }

  set(x, y, c) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : null;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  ellipse(cx, cy, rx, ry, c, filter = () => true) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && filter(x, y)) this.set(x, y, c);
      }
    }
  }

  // Tô lại màu c cho những pixel đã có màu thoả filter (dùng để đổ bóng)
  recolor(c, filter) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y) && filter(x, y)) this.set(x, y, c);
  }

  outline(darken = -0.62) {
    const src = [...this.data];
    const at = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : null);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        const n = at(x, y - 1) ?? at(x - 1, y) ?? at(x + 1, y) ?? at(x, y + 1);
        if (n) this.set(x, y, shadeHex(n, darken));
      }
    }
  }

  // Vẽ lên ctx tại (ox, oy); rows: chỉ vẽ các hàng trong khoảng [from, to)
  drawTo(ctx, ox, oy, from = 0, to = this.h) {
    for (let y = from; y < to; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.data[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  toCanvas() {
    const { canvas, ctx } = makeCanvas(this.w, this.h);
    this.drawTo(ctx, 0, 0);
    return canvas;
  }
}

// Vẽ lưới ký tự: mỗi ký tự là một màu trong palette, ký tự không có trong palette là trong suốt
export function drawGrid(ctx, rows, palette, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  });
}

export function px(ctx, color, x, y, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

// Ma trận Bayer 4x4 để chuyển màu kiểu dithering như game GBA
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function dither(value, x, y, colors) {
  const v = Math.min(Math.max(value, 0), 0.999) * (colors.length - 1);
  const i = Math.floor(v);
  const threshold = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  return colors[Math.min(colors.length - 1, i + (v - i > threshold ? 1 : 0))];
}

// Số giả ngẫu nhiên ổn định theo toạ độ (để mỗi ô trông khác nhau nhưng không đổi mỗi lần chạy)
export function hash(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function addCanvasTexture(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas);
  tex.setFilter(FILTER_NEAREST);
  return tex;
}

// Thu nhỏ một ảnh (vd: hình SVG Pokémon) thành pixel art size x size, viền trong suốt sắc nét
export function pixelate(image, size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size);
  for (let i = 3; i < data.data.length; i += 4) data.data[i] = data.data[i] < 110 ? 0 : 255;
  ctx.putImageData(data, 0, 0);
  return c;
}

// Thu nhỏ kiểu pixel art vẽ tay: vẽ ảnh to gấp k lần, mỗi pixel nhỏ lấy MÀU CHIẾM ĐA SỐ trong ô k x k nó đại diện
// (không pha trộn), nên mép giữa hai vùng màu không sinh pixel lai lấm tấm. Ô có ít điểm đặc thì để trong suốt.
export function pixelateCrisp(image, size, k = 4) {
  const big = document.createElement('canvas');
  big.width = big.height = size * k;
  const bctx = big.getContext('2d');
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(image, 0, 0, size * k, size * k);
  const src = bctx.getImageData(0, 0, size * k, size * k).data;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(size, size);
  const W = size * k;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const buckets = new Map();
      let solid = 0;
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const i = ((y * k + dy) * W + (x * k + dx)) * 4;
          if (src[i + 3] < 128) continue;
          solid++;
          const key = ((src[i] >> 3) << 10) | ((src[i + 1] >> 3) << 5) | (src[i + 2] >> 3);
          const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
          b.n++;
          b.r += src[i];
          b.g += src[i + 1];
          b.b += src[i + 2];
          buckets.set(key, b);
        }
      }
      if (solid < k * k * 0.4) continue;
      let best = null;
      for (const b of buckets.values()) if (!best || b.n > best.n) best = b;
      const o = (y * size + x) * 4;
      out.data[o] = best.r / best.n;
      out.data[o + 1] = best.g / best.n;
      out.data[o + 2] = best.b / best.n;
      out.data[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

// Bảng màu kiểu GBA: chia nhỏ dần "hộp màu" của các pixel (median cut) tới khi đủ n màu, mỗi hộp lấy màu trung bình.
// pixels: mảng [r, g, b]. Trả về mảng màu [r, g, b].
function medianCut(pixels, n) {
  const range = (box, k) => {
    let lo = 255;
    let hi = 0;
    for (const p of box) {
      if (p[k] < lo) lo = p[k];
      if (p[k] > hi) hi = p[k];
    }
    return hi - lo;
  };
  const boxes = [pixels];
  while (boxes.length < n) {
    // tách hộp có dải màu rộng nhất (tính theo số pixel để vùng lớn được nhiều sắc độ hơn)
    let best = -1;
    let bestScore = 0;
    let bestK = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let k = 0; k < 3; k++) {
        const score = range(box, k) * Math.sqrt(box.length);
        if (score > bestScore) [best, bestScore, bestK] = [i, score, k];
      }
    });
    if (best < 0) break;
    const box = boxes[best].sort((a, b) => a[bestK] - b[bestK]);
    const mid = box.length >> 1;
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.filter((b) => b.length).map((box) => [0, 1, 2].map((k) => box.reduce((sum, p) => sum + p[k], 0) / box.length));
}

// GBA hiển thị màu 15-bit: mỗi kênh 32 mức (bội số của 8)
const gbaChannel = (v) => Math.min(248, Math.round(v / 8) * 8);
export const GBA_COLORS = 15; // bảng 16 ô của GBA, một ô dành cho trong suốt

// Sprite kiểu GBA (Gen 3) từ một ảnh bất kỳ (hình SVG Pokémon): thu về size x size, gom về tối đa 15 màu
// (median cut) như bảng màu 16 ô của GBA, làm tròn về màu 15-bit, thêm viền tối theo màu kề bên.
// Hiển thị nên phóng to theo bội số nguyên (x2, x3) để pixel vuông đều như sprite GBA.
// crisp: thu nhỏ kiểu lấy màu đa số (pixelateCrisp) cho mảng màu sạch như vẽ tay
export function spriteFromImage(image, size, colors = GBA_COLORS, { crisp = false } = {}) {
  const c = crisp ? pixelateCrisp(image, size) : pixelate(image, size);
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < size && y < size && d[(y * size + x) * 4 + 3] > 0;
  const solid = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) solid.push([d[i], d[i + 1], d[i + 2]]);
  const palette = medianCut(solid, colors).map((col) => col.map(gbaChannel));
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let best = palette[0];
    let bestD = Infinity;
    for (const col of palette) {
      // khoảng cách màu có trọng số theo độ nhạy của mắt
      const dist = 2 * (d[i] - col[0]) ** 2 + 4 * (d[i + 1] - col[1]) ** 2 + 3 * (d[i + 2] - col[2]) ** 2;
      if (dist < bestD) [best, bestD] = [col, dist];
    }
    d[i] = best[0];
    d[i + 1] = best[1];
    d[i + 2] = best[2];
  }
  // Viền ngoài: pixel trong suốt sát hình thì tô bằng màu kề bên nhưng tối hơn nhiều
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (opaque(x, y)) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => opaque(x + dx, y + dy));
      if (!n) continue;
      const j = ((y + n[1]) * size + (x + n[0])) * 4;
      const o = (y * size + x) * 4;
      out[o] = gbaChannel(d[j] * 0.3);
      out[o + 1] = gbaChannel(d[j + 1] * 0.28);
      out[o + 2] = gbaChannel(d[j + 2] * 0.35);
      out[o + 3] = 255;
    }
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
  return c;
}

// Phóng to canvas theo bội số nguyên, giữ pixel vuông sắc nét
export function upscaleCanvas(canvas, k) {
  const { canvas: big, ctx } = makeCanvas(canvas.width * k, canvas.height * k);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, big.width, big.height);
  return big;
}

// Ghép nhiều canvas cùng cỡ thành một spritesheet, frame đặt tên theo names
export function addSheetTexture(scene, key, canvases, names) {
  const { width: w, height: h } = canvases[0];
  const { canvas, ctx } = makeCanvas(w * canvases.length, h);
  canvases.forEach((c, i) => ctx.drawImage(c, i * w, 0));
  const tex = addCanvasTexture(scene, key, canvas);
  names.forEach((name, i) => tex.add(name, 0, i * w, 0, w, h));
  return tex;
}

// RGB (0-255) <-> HSL (sắc độ 0-360, độ bão hoà / độ sáng 0-1)
export function rgbToHsl(r, g, b) {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  const h = max === r ? (g - b) / (max - min) + (g < b ? 6 : 0) : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t) => {
    const u = (((t % 1) + 1) % 1);
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  const t = h / 360;
  return [ch(t + 1 / 3), ch(t), ch(t - 1 / 3)].map((v) => Math.round(v * 255));
}

export const hexToHsl = (hex) => {
  const n = typeof hex === 'number' ? hex : parseInt(hex.slice(1), 16);
  return rgbToHsl(n >> 16, (n >> 8) & 255, n & 255);
};

const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Đổi bảng màu theo vùng sắc độ, như Pokémon shiny của game gốc chỉ thay một số ô trong bảng màu.
// rules: [{ from: [h, s, l], to: [h, s, l], hue: độ lệch sắc độ tối đa, light: độ lệch độ sáng tối đa }]
// Pixel có màu (độ bão hoà >= 0.2) thuộc vùng của luật gần nhất thì đổi sang màu mới (luật lấy màu xám làm gốc thì nhận
// pixel ít màu theo độ sáng), giữ nguyên độ đậm nhạt tương đối
// (vùng sáng / bóng đổ / viền tối). Viền đen xám, mắt, màu không thuộc luật nào (vd lửa đuôi) giữ nguyên.
export function recolorHues(image, rules) {
  const { canvas, ctx } = makeCanvas(image.width, image.height);
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const cache = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let out = cache.get(key);
    if (out === undefined) {
      out = recolorPixel(rgbToHsl(d[i], d[i + 1], d[i + 2]), rules);
      cache.set(key, out);
    }
    if (out) [d[i], d[i + 1], d[i + 2]] = out;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function recolorPixel([h, s, l], rules) {
  let best = null;
  let bestScore = Infinity;
  for (const rule of rules) {
    const dl = Math.abs(l - rule.from[2]);
    let score;
    if (rule.from[1] < 0.2) {
      // Luật cho màu xám / ít màu (thân đá của Onix, Geodude, Rhyhorn...): nhận pixel ít màu theo độ sáng,
      // bỏ qua viền tối và chỗ trắng sáng (mắt, điểm sáng)
      if (s >= 0.25 || l < 0.25 || dl > rule.light) continue;
      score = 100 * dl + 50 * s;
    } else {
      if (s < 0.2) continue;
      const dh = hueDistance(h, rule.from[0]);
      // pixel rất tối (viền, bóng) theo màu kề bên nên chỉ xét sắc độ
      if (dh > rule.hue || (l >= 0.25 && dl > rule.light)) continue;
      score = dh + 100 * dl;
    }
    if (score < bestScore) [best, bestScore] = [rule, score];
  }
  if (!best) return null;
  const [fh, fs, fl] = best.from;
  const [th, ts, tl] = best.to;
  const grey = fs < 0.2;
  const nh = grey ? th : th + (h - fh);
  const ns = grey ? ts : clamp01(fs > 0 ? (s * ts) / fs : ts);
  const nl = clamp01(tl <= fl ? (l * tl) / fl : 1 - ((1 - l) * (1 - tl)) / (1 - fl));
  return hslToRgb((nh + 360) % 360, ns, nl);
}

// Xoay sắc độ cả hình (màu xám / đen / trắng giữ nguyên). Trả về canvas mới.
export function shiftHue(image, degrees) {
  const { canvas, ctx } = makeCanvas(image.width, image.height);
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    if (!s) continue;
    [d[i], d[i + 1], d[i + 2]] = hslToRgb((h + degrees) % 360, s, l);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
