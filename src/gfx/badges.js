import { PixelBuffer, shadeHex } from './pixel.js';

// 8 huy hiệu gym, mỗi cái một hình riêng theo tên (32x32 pixel, viền tối tự thêm):
//  Cánh Gió: đôi cánh chim xoè quanh vòng xoáy gió • Lá Mạ: chồi lúa hai lá trên giọt sương
//  Đèn Lồng: đèn lồng tròn có tua, tia sét giữa thân • Sóng Bạc: ngọn sóng cuộn trong vòng bạc
//  Lò Gốm: chum gốm với ngọn lửa trên miệng • Thạch Sơn: núi đá hai đỉnh khảm trong viên đá bát giác
//  Liên Hoa: hoa sen nhiều lớp cánh • Băng Tuyết: bông tuyết sáu cánh
const S = 32;

// Tô đa giác pts (toạ độ pixel), lấy tâm pixel nằm trong đa giác
function poly(p, pts, c) {
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) p.set(x, y, c);
    }
  }
}

// Nét thẳng dày w từ (x0, y0) tới (x1, y1)
function line(p, x0, y0, x1, y1, w, c) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let k = 0; k <= n; k++) p.ellipse(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, w / 2, w / 2, c);
}

// Hình tròn đổ bóng nửa dưới phải, chấm sáng góc trên trái
function shadeLowerRight(p, base, f = -0.28, k = 33) {
  p.recolor(shadeHex(base, f), (x, y) => p.get(x, y) === base && x + y > k);
}

const DRAW = {
  wind(p) {
    const c = '#5ac8e8';
    // hai cánh: các lông vũ xếp tầng, chĩa lên ra ngoài
    for (const s of [-1, 1]) {
      const X = (dx) => 16 + s * dx;
      poly(p, [[X(4), 18], [X(15), 6], [X(15), 10], [X(13), 11], [X(15), 13], [X(12), 15], [X(14), 17], [X(10), 19], [X(11), 21], [X(5), 22]], c);
      for (const [a, b] of [[8, 10], [10, 13], [9, 16]]) line(p, X(5), 18, X(a + 3), b, 1, shadeHex(c, 0.45));
    }
    // vòng xoáy gió ở giữa
    p.ellipse(16, 18, 6, 6, '#e8f8ff');
    p.ellipse(16, 18, 4, 4, c);
    p.ellipse(17, 17, 2.2, 2.2, '#e8f8ff');
    p.ellipse(17.5, 17.5, 1, 1, c);
    shadeLowerRight(p, c, -0.25, 36);
    p.rect(8, 8, 1, 1, '#ffffff');
  },
  grass(p) {
    const c = '#68c040';
    // giọt sương làm đế, hai lá mạ cong từ thân
    p.ellipse(16, 24, 6, 5, '#a8e8f8');
    p.ellipse(14.5, 22.5, 1.5, 1.5, '#ffffff');
    line(p, 16, 22, 16, 12, 2, '#3a8a2a');
    poly(p, [[16, 14], [6, 6], [4, 4], [8, 4], [13, 7], [17, 12]], c);
    poly(p, [[16, 12], [24, 2], [28, 1], [27, 5], [22, 10], [17, 15]], c);
    line(p, 6, 5, 15, 12, 1, shadeHex(c, 0.4));
    line(p, 26, 3, 17, 13, 1, shadeHex(c, 0.4));
    shadeLowerRight(p, c, -0.3, 22);
  },
  electric(p) {
    const c = '#f0c030';
    const red = '#e04848';
    // nắp trên, thân đèn tròn, đáy và tua rua
    p.rect(13, 3, 6, 2, '#a8783a');
    p.rect(15, 1, 2, 2, '#a8783a');
    p.ellipse(16, 15, 10, 9, red);
    for (const x of [10, 16, 22]) p.rect(x, 8, 1, 14, shadeHex(red, -0.25));
    p.rect(12, 5, 8, 2, '#d8a840');
    p.rect(12, 23, 8, 2, '#d8a840');
    for (const x of [13, 16, 19]) p.rect(x, 25, 1, 5, c);
    // tia sét vàng giữa thân đèn
    poly(p, [[17, 8], [12, 16], [15.5, 16], [14, 22], [20, 13], [16.5, 13], [18.5, 8]], c);
    p.ellipse(11, 11, 1.5, 2, shadeHex(red, 0.4));
  },
  water(p) {
    const c = '#3a8ae8';
    // vòng bạc, ngọn sóng cuộn bên trong
    p.ellipse(16, 16, 14, 14, '#d8e0ec');
    p.ellipse(16, 16, 11.5, 11.5, '#eef6ff');
    p.ellipse(16, 16, 11.5, 11.5, c, (x, y) => y > 15);
    poly(p, [[5, 18], [9, 12], [14, 8], [20, 8], [24, 12], [23, 16], [19, 14], [16, 15], [18, 19], [12, 20]], c);
    p.ellipse(19, 12, 3, 2.5, '#eef6ff');
    p.ellipse(20, 12.5, 1.5, 1.2, c);
    for (const [x, y] of [[8, 22], [14, 23], [20, 22], [24, 20]]) p.rect(x, y, 3, 1, shadeHex(c, 0.5));
    shadeLowerRight(p, c, -0.25, 38);
    p.recolor('#a8b4c8', (x, y) => p.get(x, y) === '#d8e0ec' && x + y > 34);
  },
  fire(p) {
    const clay = '#c8784a';
    // ngọn lửa ba lưỡi trên miệng chum
    poly(p, [[16, 1], [20, 7], [22, 4], [23, 10], [20, 13], [12, 13], [9, 10], [10, 5], [12, 8]], '#e8603a');
    poly(p, [[16, 5], [19, 10], [16, 13], [13, 10]], '#f8c040');
    // chum gốm: miệng, cổ, bụng phình, đáy
    p.rect(11, 12, 10, 2, shadeHex(clay, -0.2));
    p.rect(12, 14, 8, 2, clay);
    p.ellipse(16, 22, 10, 8, clay);
    p.rect(12, 28, 8, 2, shadeHex(clay, -0.3));
    // hoa văn men lam quanh bụng chum
    p.rect(7, 20, 18, 1, '#3a6ab8');
    for (const x of [9, 13, 17, 21]) p.ellipse(x + 1, 23, 1.2, 1.2, '#3a6ab8');
    shadeLowerRight(p, clay, -0.3, 40);
    p.rect(10, 18, 2, 2, shadeHex(clay, 0.35));
  },
  rock(p) {
    const c = '#a08860';
    // viên đá bát giác, khảm núi hai đỉnh
    poly(p, [[10, 2], [22, 2], [30, 10], [30, 22], [22, 30], [10, 30], [2, 22], [2, 10]], c);
    poly(p, [[11, 5], [21, 5], [27, 11], [27, 21], [21, 27], [11, 27], [5, 21], [5, 11]], shadeHex(c, 0.3));
    poly(p, [[5, 24], [12, 11], [15, 15], [20, 7], [27, 24]], '#6a5a48');
    poly(p, [[12, 11], [14, 14], [10, 15]], '#ffffff');
    poly(p, [[20, 7], [23, 12], [18, 11]], '#ffffff');
    shadeLowerRight(p, c, -0.3, 32);
  },
  psychic(p) {
    const c = '#e868b0';
    const light = shadeHex(c, 0.45);
    // ba lớp cánh sen: ngoài cùng nằm ngang, giữa xiên, trong cùng dựng đứng
    for (const s of [-1, 1]) {
      poly(p, [[16, 24], [16 + s * 14, 18], [16 + s * 9, 25]], shadeHex(c, -0.15));
      poly(p, [[16, 24], [16 + s * 11, 11], [16 + s * 12, 18], [16 + s * 4, 25]], c);
    }
    poly(p, [[16, 3], [21, 12], [19, 24], [13, 24], [11, 12]], light);
    line(p, 16, 7, 16, 21, 1, c);
    // lá sen bên dưới
    p.ellipse(16, 27, 11, 3, '#4aa860');
    p.rect(15, 26, 2, 1, '#2e7a3a');
  },
  ice(p) {
    const c = '#98d8f0';
    // bông tuyết sáu cánh, mỗi cánh có hai nhánh nhỏ
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      const ex = 16 + Math.cos(a) * 13;
      const ey = 16 + Math.sin(a) * 13;
      line(p, 16, 16, ex, ey, 2.2, c);
      const mx = 16 + Math.cos(a) * 8;
      const my = 16 + Math.sin(a) * 8;
      for (const t of [-0.6, 0.6]) line(p, mx, my, mx + Math.cos(a + t) * 4, my + Math.sin(a + t) * 4, 1.4, c);
    }
    p.ellipse(16, 16, 4, 4, '#e8f8ff');
    p.ellipse(16, 16, 2, 2, c);
    shadeLowerRight(p, c, -0.3, 34);
  },
};

export function drawBadgeShape(id, color) {
  const p = new PixelBuffer(S, S);
  if (DRAW[id]) DRAW[id](p);
  else p.ellipse(16, 16, 12, 12, `#${color.toString(16).padStart(6, '0')}`);
  p.outline(-0.7);
  return p.toCanvas();
}

export const BADGE_PIXELS = S;
