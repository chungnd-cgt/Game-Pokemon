import { PixelBuffer, addCanvasTexture } from './pixel.js';

// Hình đặc biệt trên bản đồ: khinh khí cầu Meowth của Team Rocket

function line(p, x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) p.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
}

// Khinh khí cầu hình đầu Meowth (40x56): bóng tròn có tai, đồng xu trên trán, ria mép, giỏ mây bên dưới
function drawBalloon() {
  const p = new PixelBuffer(40, 56);
  // Tai: tam giác, trong tai màu nâu sẫm
  for (let y = 1; y <= 9; y++) {
    const half = Math.round((y - 1) * 0.55);
    p.rect(8 - half, y, half * 2 + 1, 1, '#f4e4b8');
    p.rect(31 - half, y, half * 2 + 1, 1, '#f4e4b8');
    if (y > 3 && y < 9) {
      p.rect(8 - half + 2, y, Math.max(1, half * 2 - 3), 1, '#5a3a28');
      p.rect(31 - half + 2, y, Math.max(1, half * 2 - 3), 1, '#5a3a28');
    }
  }
  // Bóng: đầu tròn màu kem, nửa dưới phải tối hơn
  p.ellipse(20, 20, 17, 15, '#f4e4b8');
  p.recolor('#d8c48e', (x, y) => (x - 20) * 0.5 + (y - 20) > 9);
  p.set(9, 12, '#fff8e0');
  p.set(10, 11, '#fff8e0');
  p.set(9, 13, '#fff8e0');
  // Đồng xu vàng trên trán
  p.ellipse(20, 10, 3.5, 3.5, '#f0c030');
  p.ellipse(20, 10, 1.6, 1.6, '#fff0a0');
  // Mắt và đồng tử dọc
  for (const ex of [13, 27]) {
    p.ellipse(ex, 19, 2.6, 3.2, '#ffffff');
    p.rect(ex, 17, 1, 5, '#202028');
  }
  // Miệng và ria mép
  for (const [x, y] of [[18, 25], [19, 26], [20, 25], [21, 26], [22, 25]]) p.set(x, y, '#5a3a28');
  for (const [y0, y1] of [[22, 21], [24, 25]]) {
    line(p, 9, y0, 3, y1, '#5a3a28');
    line(p, 30, y0, 36, y1, '#5a3a28');
  }
  // Dây treo giỏ
  line(p, 10, 33, 13, 44, '#6a4a2a');
  line(p, 29, 33, 26, 44, '#6a4a2a');
  line(p, 17, 35, 17, 44, '#6a4a2a');
  line(p, 22, 35, 22, 44, '#6a4a2a');
  // Giỏ mây
  p.rect(11, 44, 18, 10, '#a06a38');
  p.rect(10, 44, 20, 2, '#c08a50');
  for (let x = 12; x < 29; x += 3) p.rect(x, 47, 1, 7, '#80522a');
  p.rect(11, 50, 18, 1, '#80522a');
  p.outline(-0.55);
  return p.toCanvas();
}

export function makeFieldTextures(scene) {
  addCanvasTexture(scene, 'fx-balloon', drawBalloon());
  // Khối nước khi lướt bằng chiêu Surf: vẽ cùng các thú cưỡi (gfx/mounts.js, rideTexture(scene, 'surf'))
}
