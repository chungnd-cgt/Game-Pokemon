// Canvas 2D để vẽ texture cho bản 3D (không dùng gfx/pixel.js để trang 3D khỏi phải tải Phaser)
export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}
