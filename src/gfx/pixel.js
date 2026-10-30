import Phaser from 'phaser';

// Công cụ vẽ pixel art lên canvas

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
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
  const v = Phaser.Math.Clamp(value, 0, 0.999) * (colors.length - 1);
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
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return tex;
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
