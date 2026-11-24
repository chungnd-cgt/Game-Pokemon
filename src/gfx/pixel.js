// Công cụ vẽ pixel art lên canvas. Không phụ thuộc Phaser để test (node --test) dựng được hình pixel (thú cưỡi, nhân vật)

// Phaser.Textures.FilterMode.NEAREST: lấy màu điểm gần nhất khi phóng to (pixel sắc nét)
const FILTER_NEAREST = 1;
const FILTER_LINEAR = 0;
// Canvas đã làm mịn (smoothUpscale, scale2x...): texture tạo từ nó lọc tuyến tính thay vì lấy điểm gần nhất
const SMOOTH = new WeakSet();
export const markSmooth = (canvas) => {
  SMOOTH.add(canvas);
  return canvas;
};

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
  tex.setFilter(SMOOTH.has(canvas) ? FILTER_LINEAR : FILTER_NEAREST);
  return tex;
}

// Khung chứa mọi điểm không trong suốt (alpha > threshold) của ảnh RGBA w x h: { x, y, w, h }, hoặc null (ảnh trống)
export function alphaBounds(data, w, h, threshold = 8) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] <= threshold) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Xoá các chấm lạc (cụm điểm không trong suốt rời rạc, nhỏ hơn 1% số điểm có hình và tối đa 64 điểm) trong dữ liệu RGBA
// w x h: ảnh xuất ra còn sót chấm bẩn ở xa con Pokémon thì khung cắt viền bị kéo rộng (con Pokémon hiện nhỏ đi) và chấm
// lộ ra trên màn hình. Trả về số cụm đã xoá
export function removeSpecks(data, w, h, threshold = 8) {
  const seen = new Uint8Array(w * h);
  const solid = (i) => data[i * 4 + 3] > threshold;
  let total = 0;
  for (let i = 0; i < w * h; i++) if (solid(i)) total++;
  const limit = Math.min(64, Math.floor(total * 0.01));
  let removed = 0;
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !solid(start)) continue;
    const group = [start];
    seen[start] = 1;
    for (let k = 0; k < group.length; k++) {
      const i = group[k];
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (!seen[j] && solid(j)) {
            seen[j] = 1;
            group.push(j);
          }
        }
      }
    }
    if (group.length > limit) continue;
    removed++;
    for (const i of group) data[i * 4 + 3] = 0;
  }
  return removed;
}

// Ảnh PNG Pokémon người dùng thêm (src/assets/pokemon) thường có viền trong suốt rất rộng (vd 120x112 mà con Pokémon chỉ
// ~44x48 ở đáy ảnh): game co cả khung cho vừa ô nên trông bé tí. Bỏ chấm lạc (removeSpecks) rồi cắt sát phần có hình
// (chừa pad px), trả về canvas mới; ảnh trống hoặc không có viền thừa / chấm lạc thì trả về null
export function trimTransparent(image, pad = 1) {
  const { width: w, height: h } = image;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  if (removeSpecks(img.data, w, h)) ctx.putImageData(img, 0, 0);
  const box = alphaBounds(img.data, w, h);
  if (!box) return null;
  if (box.w >= w - 2 * pad && box.h >= h - 2 * pad) return c;
  const out = document.createElement('canvas');
  out.width = box.w + pad * 2;
  out.height = box.h + pad * 2;
  out.getContext('2d').drawImage(c, box.x, box.y, box.w, box.h, pad, pad, box.w, box.h);
  return out;
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

// Phóng to x2 kiểu Scale2x (EPX): giữ nguyên mảng màu nhưng bo tròn các bậc thang ở cạnh chéo, nên hình pixel art phóng
// to trông mịn như vẽ tay thay vì ô vuông thô (dùng cho icon vật phẩm / huy hiệu: smoothPixelArt)
export function scale2x(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const src = new Uint32Array(canvas.getContext('2d').getImageData(0, 0, w, h).data.buffer);
  const { canvas: out, ctx } = makeCanvas(w * 2, h * 2);
  const img = ctx.createImageData(w * 2, h * 2);
  const dst = new Uint32Array(img.data.buffer);
  const at = (x, y) => src[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y);
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      const i = 2 * y * 2 * w + 2 * x;
      dst[i] = c === a && c !== d && a !== b ? a : p;
      dst[i + 1] = a === b && a !== c && b !== d ? b : p;
      dst[i + 2 * w] = d === c && d !== b && c !== a ? c : p;
      dst[i + 2 * w + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  ctx.putImageData(img, 0, 0);
  return markSmooth(out);
}

// Pixel art mịn: Scale2x hai lần (x4)
export const smoothPixelArt = (canvas) => scale2x(scale2x(canvas));

// Phóng to pixel art k lần cho MỊN (thay cho upscaleCanvas): Scale2x hai lần (x4, bo tròn bậc thang) rồi thu về đúng
// k lần có làm mịn. Cỡ y như upscaleCanvas nên mọi chỗ dùng giữ nguyên toạ độ; texture tự lọc tuyến tính (markSmooth)
export function smoothUpscale(canvas, k) {
  const big = smoothPixelArt(canvas);
  const { canvas: out, ctx } = makeCanvas(canvas.width * k, canvas.height * k);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(big, 0, 0, out.width, out.height);
  return markSmooth(out);
}

// Phóng to canvas theo bội số nguyên, giữ pixel vuông sắc nét
// Vẽ ảnh vừa khung size x size (giữ tỉ lệ, canh giữa, sát đáy), thu nhỏ mịn giữ nét: dùng cho ảnh PNG Pokémon người dùng
// thêm (không chuyển sang pixel art, như trong trận / Pokédex)
export function fitCanvas(image, size) {
  const { canvas, ctx } = makeCanvas(size, size);
  const k = Math.min(size / image.width, size / image.height);
  const w = Math.round(image.width * k);
  const h = Math.round(image.height * k);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, Math.round((size - w) / 2), size - h, w, h);
  return canvas;
}

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
  if (SMOOTH.has(canvases[0])) markSmooth(canvas);
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
// adapt: ảnh PNG người dùng thêm, dò lại màu gốc của luật theo màu thật của ảnh (adaptRules)
export function recolorHues(image, rules, adapt = false) {
  const { canvas, ctx } = makeCanvas(image.width, image.height);
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  if (adapt) rules = adaptRules(d, rules);
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

// Luật đổi màu shiny khai báo theo màu hình vẽ sẵn của game. Ảnh PNG người dùng thêm có thể dùng tông khác hẳn (vd thân
// Charmander cam sắc độ 32° trong khi luật tìm quanh 23° ± 7°) nên chỉ đổi được vài điểm, bản shiny bị loang. Dò cụm màu
// đậm thật của ảnh nằm gần màu gốc của từng luật (lệch tối đa 30° sắc độ), lấy làm màu gốc mới và nới sai số sắc độ theo
// độ rộng của cụm. Luật màu xám (độ bão hoà thấp) giữ nguyên. data: RGBA của ảnh
export function adaptRules(data, rules) {
  const bins = new Map(); // sắc độ (làm tròn) -> { n, s, l }
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.35 || l < 0.2 || l > 0.85) continue;
    const k = Math.round(h) % 360;
    const b = bins.get(k) ?? { n: 0, s: 0, l: 0 };
    b.n++;
    b.s += s;
    b.l += l;
    bins.set(k, b);
  }
  return rules.map((rule) => {
    const [fh, fs] = rule.from;
    if (fs < 0.2) return rule;
    // Cụm: các sắc độ trong ±30° quanh màu gốc, đỉnh là sắc độ nhiều điểm nhất (gộp ±3° cho mượt)
    let peak = null;
    let peakN = 0;
    for (let d = -30; d <= 30; d++) {
      const k = (Math.round(fh + d) + 360) % 360;
      let n = 0;
      for (let e = -3; e <= 3; e++) n += bins.get((k + e + 360) % 360)?.n ?? 0;
      if (n > peakN) [peak, peakN] = [k, n];
    }
    if (peak === null || peakN < 20) return rule;
    // Độ rộng cụm: sắc độ hai bên đỉnh còn ít nhất 5% số điểm của đỉnh
    let spread = 3;
    const base = bins.get(peak)?.n ?? 0;
    for (let d = 1; d <= 20; d++) {
      const lo = bins.get((peak - d + 360) % 360)?.n ?? 0;
      const hi = bins.get((peak + d) % 360)?.n ?? 0;
      if (Math.max(lo, hi) < base * 0.05) break;
      spread = d;
    }
    let n = 0;
    let s = 0;
    let l = 0;
    for (let d = -spread; d <= spread; d++) {
      const b = bins.get((peak + d + 360) % 360);
      if (!b) continue;
      n += b.n;
      s += b.s;
      l += b.l;
    }
    return { ...rule, from: [peak, s / n, l / n], hue: Math.max(rule.hue, spread + 4) };
  });
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

// Hình LƯNG tự tạo từ ảnh mặt trước (loài chỉ có ảnh PNG mặt trước, BootScene): nhìn từ phía sau thì không thấy mắt,
// miệng, bụng... Cách làm:
//  1. Tìm màu thân: màu có sắc độ chiếm nhiều điểm nhất (bỏ điểm quá tối / quá nhạt / ít màu); khối thân = các vùng màu
//     thân liền nhau đủ lớn (thân, đầu, tay chân, đuôi)
//  2. Mọi điểm nằm trong thân (đi theo ít nhất 3 trong 4 hướng đều gặp khối thân trước khi ra khỏi hình), trừ dải viền
//     ngoài: tô lại bằng màu thân, sẫm dần về phía mép và phía dưới (như nhìn khối tròn từ sau lưng). Mắt, miệng, bụng, nét
//     vẽ bên trong biến mất; phần chìa ra ngoài thân khác màu (lửa đuôi, cánh, sừng...) và viền ngoài giữ nguyên
//  3. Lật ngang: nhìn từ sau lưng thì hướng ngược với mặt trước (mặt trước quay trái -> lưng quay phải, về phía đối thủ)
export function autoBackView(image) {
  const w = image.width;
  const h = image.height;
  const { canvas: src, ctx } = makeCanvas(w, h);
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const opaque = new Uint8Array(n);
  const hsl = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    opaque[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    const [hh, ss, ll] = rgbToHsl(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    hsl[i * 3] = hh;
    hsl[i * 3 + 1] = ss;
    hsl[i * 3 + 2] = ll;
  }
  const colorful = (i) => opaque[i] && hsl[i * 3 + 1] > 0.3 && hsl[i * 3 + 2] > 0.22 && hsl[i * 3 + 2] < 0.82;
  // 1. Màu thân: nhóm sắc độ đông nhất, rồi màu hay gặp nhất trong nhóm đó (làm tròn theo bậc 8)
  const buckets = new Array(36).fill(0);
  for (let i = 0; i < n; i++) if (colorful(i)) buckets[Math.floor(hsl[i * 3] / 10) % 36]++;
  let best = 0;
  for (let b = 1; b < 36; b++) if (buckets[b] > buckets[best]) best = b;
  if (!buckets[best]) return flipCanvas(src);
  const counts = new Map();
  let fill = null;
  let fillN = 0;
  for (let i = 0; i < n; i++) {
    if (!colorful(i) || hueDistance(hsl[i * 3], best * 10 + 5) > 12) continue;
    const key = ((d[i * 4] >> 3) << 10) | ((d[i * 4 + 1] >> 3) << 5) | (d[i * 4 + 2] >> 3);
    const c = (counts.get(key) ?? 0) + 1;
    counts.set(key, c);
    if (c > fillN) {
      fillN = c;
      fill = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
    }
  }
  const [bodyH, , bodyL] = rgbToHsl(...fill);
  const isBody = (i) => opaque[i] && hsl[i * 3 + 1] > 0.3 && hueDistance(hsl[i * 3], bodyH) <= 16 && Math.abs(hsl[i * 3 + 2] - bodyL) < 0.2;
  const comp = new Int32Array(n).fill(-1);
  const sizes = [];
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0 || !isBody(i)) continue;
    const id = sizes.length;
    const stack = [i];
    comp[i] = id;
    let size = 0;
    while (stack.length) {
      const j = stack.pop();
      size++;
      const x = j % w;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) {
        if (k >= 0 && k < n && comp[k] < 0 && isBody(k)) {
          comp[k] = id;
          stack.push(k);
        }
      }
    }
    sizes.push(size);
  }
  const minSize = Math.max(20, Math.max(...sizes) * 0.04);
  const inBody = (i) => comp[i] >= 0 && sizes[comp[i]] >= minSize;
  // Khoảng cách tới chỗ trong suốt (bước 4 hướng), đo tới `far`
  const band = Math.max(2, Math.round(Math.max(w, h) / 45));
  const far = band * 6;
  const dist = new Int16Array(n).fill(far + 1);
  let queue = [];
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let step = 1; step <= far && queue.length; step++) {
    const next = [];
    for (const i of queue) {
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < n && dist[j] > step) {
          dist[j] = step;
          next.push(j);
        }
      }
    }
    queue = next;
  }
  // 2. Tô lại phần trong thân
  const reach = Math.max(6, Math.round(Math.max(w, h) * 0.25));
  const hits = (i, dx, dy) => {
    let x = i % w;
    let y = Math.floor(i / w);
    for (let k = 0; k < reach; k++) {
      x += dx;
      y += dy;
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const j = y * w + x;
      if (!opaque[j]) return false;
      if (inBody(j)) return true;
    }
    return false;
  };
  let top = h;
  let bottom = 0;
  for (let i = 0; i < n; i++) {
    if (!opaque[i]) continue;
    const y = Math.floor(i / w);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const painted = new Uint8Array(n);
  const inner = (i) => opaque[i] && dist[i] > band;
  for (let i = 0; i < n; i++) {
    if (!inner(i)) continue;
    painted[i] = inBody(i) || [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => hits(i, dx, dy)).length >= 3 ? 1 : 0;
  }
  // Lấp chỗ sót: vùng chưa tô (liền nhau) mà phần lớn xung quanh là chỗ đã tô thì tô luôn (vd mảng bụng sát hai chân);
  // phần chìa ra ngoài (lửa đuôi) giáp viền / nền trong suốt nhiều nên giữ nguyên
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (seen[i] || painted[i] || !inner(i)) continue;
    const group = [i];
    seen[i] = 1;
    let byPaint = 0;
    let byOther = 0;
    for (let g = 0; g < group.length; g++) {
      const j = group[g];
      const x = j % w;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) {
        if (k < 0 || k >= n) continue;
        if (painted[k]) byPaint++;
        else if (!inner(k)) byOther++;
        else if (!seen[k]) {
          seen[k] = 1;
          group.push(k);
        }
      }
    }
    if (byPaint > byOther * 2) for (const j of group) painted[j] = 1;
  }
  const out = new Uint8ClampedArray(d);
  for (let i = 0; i < n; i++) {
    if (!painted[i]) continue;
    const rim = Math.min(1, (dist[i] - band) / (far - band)); // 0 sát viền -> 1 sâu bên trong
    const down = (Math.floor(i / w) - top) / Math.max(1, bottom - top);
    const k = (0.8 + 0.2 * Math.sqrt(rim)) * (1.04 - 0.12 * down);
    for (let c = 0; c < 3; c++) out[i * 4 + c] = fill[c] * k;
  }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
  return flipCanvas(src);
}

function flipCanvas(source) {
  const { canvas, ctx } = makeCanvas(source.width, source.height);
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}
