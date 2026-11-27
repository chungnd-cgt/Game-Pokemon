import { TILE } from '../config.js';
import { PixelBuffer, hash, px, shadeHex } from './pixel.js';

// Đồ đạc lớn nhiều ô trong nhà (phòng thí nghiệm, Pokémon Center): map.props = [{ kind, x, y }] (x, y: ô góc trên trái
// của phần chân đồ đạc). Ô chân đồ đạc trong rows là ô cản (thường là 'g', ô cản không vẽ gì), props chỉ để vẽ.
// Mỗi loại: w x h ô chân đồ, up px nhô lên phía trên (máy cao, tủ sát tường). Phần nhô lên vẽ vào lớp over (đè lên nhân vật
// đứng ở ô phía trên) khi ô phía trên đi được; sát tường thì vẽ luôn vào lớp objects.

const STEEL = { ink: '#262a32', dark: '#5a6270', base: '#8a94a4', light: '#b8c0cc', hi: '#e2e6ee' };

// Đa giác lục giác dẹt (nhìn chéo từ trên): rộng w ở giữa, vát hai đầu trên / dưới
function hexBand(p, cx, y0, h, w, color, inset = 0) {
  for (let y = 0; y < h; y++) {
    const cut = Math.round(Math.max(0, Math.abs(y - (h - 1) / 2) - (h / 2 - 3)) * 2.2) + inset;
    p.rect(Math.round(cx - w / 2 + cut), y0 + y, Math.max(0, w - cut * 2), 1, color);
  }
}

const PROPS = {
  // Máy hồi phục lục giác lớn (phòng thí nghiệm): đế thép có chân, buồng kính xanh phát sáng, nắp lục giác có lõi xanh
  healPod: {
    w: 3, h: 3, up: 8,
    draw(p) {
      const cx = 24;
      // chân đế
      for (const fx of [5, 39]) p.rect(fx, 44, 5, 8, STEEL.ink);
      for (const fx of [5, 39]) p.rect(fx + 1, 45, 3, 6, STEEL.dark);
      // đế lục giác
      hexBand(p, cx, 34, 18, 44, STEEL.dark);
      hexBand(p, cx, 34, 12, 44, STEEL.base);
      hexBand(p, cx, 34, 4, 40, STEEL.light);
      // bảng điều khiển ô vuông phía trước đế
      p.rect(18, 44, 12, 6, '#d8dce4');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.rect(19 + i * 4, 45 + j * 3, 2, 2, (i + j) % 2 ? '#7a8494' : '#a8b0bc');
      // buồng kính
      p.rect(11, 18, 26, 20, '#2a90b8');
      p.rect(12, 18, 24, 19, '#3ab8d8');
      p.rect(15, 19, 18, 17, '#62d0ea');
      p.rect(19, 20, 10, 15, '#a8ecf8');
      p.rect(22, 21, 4, 13, '#e0faff');
      for (const lx of [13, 34]) p.rect(lx, 18, 1, 19, '#1c6a8a');
      // nắp lục giác: viền xám đậm, mặt sáng, lõi xanh thẫm có vòng sáng
      hexBand(p, cx, 4, 16, 44, STEEL.dark);
      hexBand(p, cx, 4, 14, 44, STEEL.light);
      hexBand(p, cx, 4, 3, 40, STEEL.hi);
      hexBand(p, cx, 7, 9, 22, STEEL.dark);
      hexBand(p, cx, 8, 7, 18, '#1a4a78');
      hexBand(p, cx, 9, 4, 12, '#48c8f0');
      p.rect(21, 10, 6, 1, '#c8f6ff');
      p.outline(-0.6);
    },
    shadow: [24, 50, 24, 5],
  },
  // Giường quét / buồng chăm sóc (phòng thí nghiệm, 4 chiếc ở cuối phòng): khung xám, nóc có khe, kính xanh, chân xanh lá
  scanBed: {
    w: 2, h: 2, up: 6,
    draw(p) {
      p.rect(1, 0, 30, 37, STEEL.base);
      p.rect(2, 1, 28, 9, STEEL.light);
      p.rect(2, 1, 28, 1, STEEL.hi);
      for (let x = 5; x < 28; x += 5) p.rect(x, 3, 2, 6, STEEL.base);
      p.rect(2, 10, 28, 1, STEEL.dark);
      p.rect(3, 12, 26, 15, '#5aa8d0');
      p.rect(4, 13, 24, 13, '#8ac8e8');
      for (let i = 0; i < 9; i++) p.rect(6 + i, 13 + i, 3, 1, '#d0f0ff');
      p.rect(4, 13, 24, 1, '#c8ecff');
      p.rect(2, 28, 28, 8, '#2e8a5a');
      p.rect(3, 29, 26, 6, '#46b07a');
      p.rect(3, 29, 26, 1, '#7ad8a4');
      p.rect(6, 31, 4, 2, '#e8f8f0');
      p.outline(-0.6);
    },
  },
  // Máy tính lớn sát tường: màn hình sóng xanh, bảng phím, thân thép
  bigComputer: {
    w: 2, h: 1, up: 22,
    draw(p) {
      p.rect(1, 0, 30, 37, STEEL.base);
      p.rect(1, 0, 30, 1, STEEL.hi);
      p.rect(2, 1, 28, 2, STEEL.light);
      p.rect(4, 4, 24, 15, '#1a2238');
      p.rect(5, 5, 22, 13, '#1e3a8a');
      for (let x = 0; x < 22; x++) {
        const y = Math.round(11 + Math.sin(x * 0.9) * 3 * Math.sin(x * 0.27 + 1));
        p.set(5 + x, y, '#7ab8ff');
        p.set(5 + x, y + 1, '#3a70d8');
      }
      p.rect(6, 6, 5, 1, '#5a8ae0');
      p.rect(3, 21, 26, 7, STEEL.light);
      for (let i = 0; i < 6; i++) p.rect(5 + i * 4, 23, 3, 2, i % 3 === 0 ? '#e85050' : '#4a5262');
      p.rect(3, 28, 26, 1, STEEL.dark);
      p.rect(5, 30, 22, 6, STEEL.dark);
      p.rect(6, 31, 20, 1, '#6a7484');
      p.outline(-0.6);
    },
  },
  // Tủ kính trưng bày sát tường (3 ô): tủ xám bên dưới, hộp kính trống. Chiếc Pokédex đỏ bên trong là vật thể riêng trên bản đồ
  // (obj-pokedex, map.objects kind 'decor'), hết hiện khi Giáo sư Oak đã trao Pokédex cho người chơi
  displayCase: {
    w: 3, h: 1, up: 8,
    draw(p) {
      p.rect(1, 12, 46, 12, '#9aa4b4');
      p.rect(2, 13, 44, 10, '#d8dce4');
      p.rect(2, 13, 44, 1, '#f4f6fa');
      for (const dx of [16, 31]) p.rect(dx, 14, 1, 9, '#9aa4b4');
      p.rect(2, 0, 44, 13, '#5a7a8a');
      p.rect(3, 1, 42, 11, '#c8e4f0');
      for (const gx of [6, 33]) for (let i = 0; i < 9; i++) p.set(gx + i, 10 - i, '#f4fcff');
      p.rect(16, 10, 16, 2, '#a8c4d0'); // giá đỡ nhỏ giữa tủ
      p.outline(-0.6);
    },
  },
  // Bàn làm việc sát tường có màn hình máy tính xanh và bàn phím
  desk: {
    w: 2, h: 1, up: 10,
    draw(p) {
      p.rect(8, 0, 16, 12, '#222838');
      p.rect(9, 1, 14, 9, '#2a4a98');
      p.rect(10, 2, 6, 1, '#7ab0f0');
      p.rect(10, 4, 10, 1, '#5a88d8');
      p.rect(10, 6, 8, 1, '#5a88d8');
      p.rect(15, 12, 2, 2, '#222838');
      p.rect(0, 13, 32, 6, '#e6dcc4');
      p.rect(0, 13, 32, 1, '#fff8e8');
      p.rect(9, 14, 14, 3, '#c8ccd4');
      p.rect(0, 19, 32, 7, '#b8a888');
      p.rect(2, 20, 12, 5, '#cfc0a0');
      p.rect(7, 22, 3, 1, '#7a6a50');
      p.rect(24, 20, 6, 6, '#3a5ab8');
      p.outline(-0.6);
    },
  },
  // Tủ máy chủ cao: thân xám, đèn xanh lá nhấp nháy
  server: {
    w: 1, h: 1, up: 14,
    draw(p) {
      p.rect(2, 0, 12, 30, STEEL.base);
      p.rect(2, 0, 12, 1, STEEL.hi);
      p.rect(3, 2, 10, 26, '#5a6270');
      for (let y = 4; y < 26; y += 5) {
        p.rect(4, y, 8, 3, '#3a404c');
        p.set(5, y + 1, hash(y, 3, 7) < 0.6 ? '#58f088' : '#2a8a4a');
        p.set(7, y + 1, '#58f088');
      }
      p.outline(-0.6);
    },
  },
  // Tủ thấp có máy in nắp cam
  cabinet: {
    w: 1, h: 1, up: 10,
    draw(p) {
      p.rect(1, 2, 14, 7, '#e88a2a');
      p.rect(1, 2, 14, 2, '#f8b050');
      p.rect(3, 6, 10, 2, '#5a3010');
      p.rect(1, 9, 14, 17, '#4a4e5a');
      p.rect(2, 10, 12, 15, '#6a707e');
      p.rect(2, 10, 12, 1, '#8a909e');
      p.rect(2, 17, 12, 1, '#3a3e48');
      p.rect(10, 13, 2, 2, '#58f088');
      p.outline(-0.6);
    },
  },
  // Tủ đồ / tủ lạnh mẫu vật cao sát tường
  locker: {
    w: 1, h: 1, up: 16,
    draw(p, { alt }) {
      const body = alt ? '#e4e8ee' : '#4a505c';
      const lit = alt ? '#ffffff' : '#6a7280';
      p.rect(1, 0, 14, 32, body);
      p.rect(1, 0, 14, 1, lit);
      p.rect(2, 2, 11, 28, shadeHex(body, alt ? -0.06 : 0.12));
      p.rect(11, 8, 1, 6, alt ? '#8a94a4' : '#c8ced8');
      p.rect(4, 4, 6, 1, shadeHex(body, -0.25));
      p.rect(4, 6, 6, 1, shadeHex(body, -0.25));
      p.rect(2, 20, 11, 1, shadeHex(body, -0.3));
      p.outline(-0.6);
    },
  },

  // ---------- Pokémon Center ----------

  // Máy hồi phục đứng sau quầy (ô 'mm'): tủ thép cao, ô kính trên nóc, 6 khe Poké Ball có đèn xanh, chữ thập đỏ
  healer: {
    w: 2, h: 1, up: 14,
    draw(p) {
      p.rect(1, 0, 30, 30, STEEL.base);
      p.rect(2, 1, 28, 2, STEEL.hi);
      p.rect(3, 3, 26, 5, '#2a3446');
      p.rect(4, 4, 24, 3, '#58c8f0');
      p.rect(5, 4, 6, 1, '#c8f0ff');
      p.rect(3, 9, 26, 12, '#e8ecf2');
      for (const s of MACHINE_SLOTS) {
        p.rect(s.x - 2, s.y + 14 - 2, 5, 5, '#4a5262');
        p.rect(s.x - 1, s.y + 14 - 1, 3, 3, '#58e090');
      }
      p.rect(3, 22, 26, 8, '#d0d4dc');
      p.rect(14, 23, 4, 6, '#e04040');
      p.rect(12, 25, 8, 2, '#e04040');
      p.outline(-0.6);
    },
  },
  // Tủ phụ sau quầy: hộp hồ sơ xanh và ngăn kéo
  sideDesk: {
    w: 2, h: 1, up: 6,
    draw(p) {
      p.rect(0, 6, 32, 16, '#c8a060');
      p.rect(0, 6, 32, 2, '#e8c888');
      p.rect(1, 9, 30, 12, '#a8804a');
      p.rect(4, 0, 10, 9, '#2a5ac8');
      p.rect(5, 1, 8, 6, '#4a7ae8');
      p.rect(20, 2, 8, 6, '#f0e070');
      p.rect(21, 3, 6, 1, '#ffffff');
      p.rect(6, 14, 6, 1, '#6a4a20');
      p.rect(20, 14, 6, 1, '#6a4a20');
      p.outline(-0.6);
    },
  },
  // TV lớn treo trên tường sau quầy
  tv: {
    w: 2, h: 1, up: 0,
    draw(p) {
      p.rect(2, 1, 28, 13, '#181c24');
      p.rect(4, 3, 24, 9, '#2a4a9a');
      p.rect(5, 4, 22, 3, '#3a68c8');
      p.rect(6, 4, 7, 1, '#9ac0ff');
      p.rect(14, 14, 4, 2, '#181c24');
    },
  },
  // Bản đồ vùng treo tường
  mapPoster: {
    w: 2, h: 1, up: 0,
    draw(p) {
      p.rect(1, 1, 30, 13, '#8a5a30');
      p.rect(2, 2, 28, 11, '#88c4f0');
      p.rect(5, 4, 9, 6, '#6ab060');
      p.rect(15, 6, 8, 5, '#7ac070');
      p.rect(24, 3, 4, 4, '#e8d088');
      p.rect(8, 6, 2, 2, '#e04848');
      p.rect(19, 8, 2, 2, '#e04848');
    },
  },
  // Bàn tròn mặt kính
  roundTable: {
    w: 2, h: 1, up: 6,
    draw(p) {
      p.rect(13, 12, 6, 9, '#7a8494');
      p.ellipse(16, 8, 15, 7, '#9aa4b4');
      p.ellipse(16, 7.5, 14, 6, '#d8ecf8');
      p.ellipse(13, 6, 6, 2, '#ffffff');
      p.outline(-0.6);
    },
    shadow: [16, 21, 12, 2],
  },

  // ---------- Poké Mart ----------

  // Thùng hàng các-tông chất trong góc: hai thùng to dưới đất, một thùng nhỏ chồng lên trên, băng dính dọc giữa nắp
  crates: {
    w: 2, h: 1, up: 12,
    draw(p) {
      const box = (x, y, w, h) => {
        p.rect(x, y, w, h, '#c89a58');
        p.rect(x, y, w, 4, '#e0b874');
        p.rect(x, y + 4, w, 1, '#a87c40');
        p.rect(x + Math.floor(w / 2) - 1, y, 2, 4, '#f0dca8');
        p.rect(x + Math.floor(w / 2) - 1, y + 5, 2, 3, '#e0c890');
        p.rect(x + w - 3, y + 5, 2, h - 6, '#b48448');
      };
      box(1, 10, 16, 17);
      box(18, 14, 13, 13);
      box(4, 1, 11, 10);
      p.outline(-0.6);
    },
    shadow: [16, 27, 15, 1],
  },
  // Kệ hàng sát tường: tủ thấp xám trắng, mặt trên bày hàng (Poké Ball, chai thuốc, hộp), cửa kính xanh phía dưới có hàng bên trong.
  // alt: kiểu bày hàng thứ hai cho kệ bên cạnh khỏi giống hệt
  goodsShelf: {
    w: 2, h: 1, up: 14,
    draw(p, { alt }) {
      p.rect(1, 9, 30, 21, '#a8b0bc');
      p.rect(2, 9, 28, 2, '#f4f6fa');
      p.rect(2, 11, 28, 1, '#c8ced8');
      p.rect(2, 12, 28, 17, '#e2e6ec');
      p.rect(4, 14, 11, 13, '#5a8ac8');
      p.rect(17, 14, 11, 13, '#5a8ac8');
      for (const gx of [4, 17]) {
        p.rect(gx, 20, 11, 1, '#9ab8e0');
        for (let i = 0; i < 4; i++) p.rect(gx + 1 + i * 3 - (alt ? 0 : 0), 16 + (i % 2), 2, 3, ['#e85050', '#f0c040', '#50b070', '#f4f4f4'][(i + (alt ? 2 : 0)) % 4]);
        for (let i = 0; i < 5; i++) p.set(gx + 2 + i, 26 - i, '#c8e4ff');
      }
      p.rect(1, 29, 30, 1, '#7a8494');
      // hàng bày trên mặt tủ
      const ball = (x, y) => {
        p.ellipse(x, y, 3, 3, '#f4f4f4');
        p.ellipse(x, y, 3, 3, '#e04040', (_, yy) => yy < y - 0.5);
        p.rect(x - 3, Math.floor(y - 0.5), 6, 1, '#2a2a34');
        p.set(Math.floor(x - 0.5), Math.floor(y - 0.5), '#ffffff');
      };
      const bottle = (x, color) => {
        p.rect(x, 3, 5, 7, color);
        p.rect(x + 1, 1, 3, 2, '#e8ecf0');
        p.rect(x + 1, 4, 1, 4, shadeHex(color, 0.45));
      };
      const boxItem = (x, w, color) => {
        p.rect(x, 4, w, 6, color);
        p.rect(x, 4, w, 1, shadeHex(color, 0.35));
        p.rect(x + 1, 6, w - 2, 2, '#f4f4f4');
      };
      if (alt) {
        boxItem(2, 8, '#f0b030');
        ball(15, 6.5);
        bottle(20, '#50b070');
        bottle(25, '#50b070');
      } else {
        ball(6, 6.5);
        ball(12, 6.5);
        bottle(17, '#a060d0');
        boxItem(23, 7, '#4a7ad8');
      }
      p.outline(-0.6);
    },
  },
  // Tủ mát cửa kính cao sát tường: khung xám đậm, đèn trên nóc, hai cánh kính, trong có các tầng chai nước nhiều màu
  cooler: {
    w: 2, h: 1, up: 20,
    draw(p, { alt }) {
      p.rect(1, 0, 30, 36, '#3e4654');
      p.rect(2, 1, 28, 4, '#6a7484');
      p.rect(3, 2, 26, 1, '#e8f4ff');
      const colors = alt ? ['#f0c040', '#e85050', '#50b070'] : ['#4a7ad8', '#50b070', '#f08030'];
      for (const dx of [3, 16]) {
        p.rect(dx, 6, 13, 28, '#2a3240');
        p.rect(dx + 1, 7, 11, 26, '#7ab0e0');
        for (let r = 0; r < 3; r++) {
          const sy = 9 + r * 8;
          for (let i = 0; i < 4; i++) {
            const c = colors[(r + i + (dx > 10 ? 1 : 0)) % 3];
            p.rect(dx + 2 + i * 3 - (i > 2 ? 1 : 0), sy, 2, 5, c);
            p.set(dx + 2 + i * 3 - (i > 2 ? 1 : 0), sy, '#f4f4f4');
          }
          p.rect(dx + 1, sy + 5, 11, 1, '#4a6a90');
        }
        for (let i = 0; i < 7; i++) p.set(dx + 3 + i, 30 - i * 2, '#e0f2ff');
        p.rect(dx + (dx > 10 ? 1 : 10), 16, 1, 6, '#c8ced8'); // tay nắm
      }
      p.rect(1, 34, 30, 2, '#2a303c');
      p.outline(-0.6);
    },
  },
  // Máy tính tiền trên quầy thu ngân: thân xám, màn hình số xanh lá dựng phía sau, bàn phím sáng
  register: {
    w: 1, h: 1, up: 6,
    draw(p) {
      p.rect(3, 0, 9, 7, '#3a4252');
      p.rect(4, 1, 7, 4, '#2a3a30');
      p.rect(5, 2, 5, 2, '#68e098');
      p.rect(1, 7, 14, 8, '#5e6878');
      p.rect(1, 7, 14, 1, '#8a94a4');
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.rect(3 + i * 3, 9 + j * 3, 2, 2, '#d8dce4');
      p.rect(12, 9, 2, 5, '#e85050');
      p.outline(-0.6);
    },
  },
  // Quầy kệ trưng bày giữa phòng: đế xám, khung kính bo đầu, bên trong hai tầng hàng (alt: màu khác)
  displayRack: {
    w: 2, h: 1, up: 10,
    draw(p, { alt }) {
      p.rect(1, 17, 30, 9, '#a8b0bc');
      p.rect(1, 17, 30, 2, '#e2e6ec');
      p.rect(3, 21, 26, 1, '#7a8494');
      p.rect(2, 1, 28, 16, '#8a94a4');
      p.rect(3, 2, 26, 14, '#cfe6f6');
      p.rect(15, 2, 2, 14, '#8a94a4');
      p.rect(3, 9, 26, 1, '#8a94a4');
      const colors = alt ? ['#f0c040', '#4a7ad8'] : ['#e85050', '#50b070'];
      for (const [sy, c] of [[3, colors[0]], [10, colors[1]]]) {
        for (let i = 0; i < 6; i++) {
          const x = 4 + i * 4 + (i > 2 ? 2 : 0);
          p.rect(x, sy + 1, 3, 5, c);
          p.rect(x, sy + 1, 3, 1, shadeHex(c, 0.4));
        }
      }
      for (const gx of [4, 18]) for (let i = 0; i < 4; i++) p.set(gx + i, 7 - i, '#ffffff');
      p.outline(-0.6);
    },
    shadow: [16, 26, 15, 1],
  },
  // Bàn kính vuông cho khách ngồi (2x2 ô): khung trắng bo góc, mặt kính xanh nhạt có vệt phản chiếu, chân thép
  glassTable: {
    w: 2, h: 2, up: 2,
    draw(p) {
      for (const lx of [4, 26]) p.rect(lx, 22, 2, 11, '#6a7484');
      p.rect(2, 2, 28, 22, '#c8ced8');
      p.rect(3, 2, 26, 1, '#ffffff');
      p.rect(4, 4, 24, 17, '#e8eef4');
      p.rect(6, 6, 20, 13, '#b8d8ee');
      for (let i = 0; i < 8; i++) p.rect(9 + i, 16 - i, 2, 1, '#e8f6ff');
      p.rect(2, 22, 28, 3, '#9aa4b4');
      p.outline(-0.6);
    },
    shadow: [16, 32, 13, 2],
  },
};

// Khe đặt Poké Ball trên máy hồi phục (px, tính từ góc trên trái ô 'm' đầu tiên; y âm là phần máy nhô lên trên ô)
export const MACHINE_SLOTS = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 9 + (i % 3) * 7, y: -9 + Math.floor(i / 3) * 6 }));
// Ô kính trên nóc máy hồi phục (nháy sáng khi đang hồi phục), cùng hệ toạ độ
export const MACHINE_SCREEN = { x: 4, y: -10, w: 24, h: 3 };

const cache = {};
function propSprite(prop) {
  const def = PROPS[prop.kind];
  const h = prop.h ?? def.h;
  const key = `${prop.kind}:${h}:${prop.alt ? 1 : 0}`;
  if (!cache[key]) {
    const p = new PixelBuffer((prop.w ?? def.w) * TILE, h * TILE + def.up);
    def.draw(p, { h, alt: prop.alt });
    cache[key] = p;
  }
  return cache[key];
}

export function propFootprint(prop) {
  const def = PROPS[prop.kind];
  return { w: prop.w ?? def.w, h: prop.h ?? def.h };
}

// Vẽ map.props: bóng xuống nền, thân vào objects, phần nhô lên vào over nếu ô phía trên đi được
export function drawProps(map, ground, objects, over) {
  for (const prop of map.props ?? []) {
    const def = PROPS[prop.kind];
    const { w } = propFootprint(prop);
    const p = propSprite(prop);
    const ox = prop.x * TILE;
    const oy = prop.y * TILE - def.up;
    if (def.shadow) {
      const [cx, cy, rx, ry] = def.shadow;
      for (let y = -ry; y <= ry; y++) {
        const half = Math.round(rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2));
        px(ground, 'rgba(30,20,10,0.22)', ox + cx - half, oy + cy + y, half * 2, 1);
      }
    }
    let free = false;
    for (let x = prop.x; x < prop.x + w; x++) if (!map.info(x, prop.y - 1)?.solid) free = true;
    p.drawTo(free ? over : objects, ox, oy, 0, def.up);
    p.drawTo(objects, ox, oy, def.up);
  }
}

// ---------- Ô đồ đạc nhỏ ----------

// Bục nhỏ đặt Poké Ball (ô 'j'): mặt tròn phẳng rộng, tâm mặt bục ở giữa ô (Poké Ball vẽ ở tâm ô nên nằm giữa mặt bục),
// chân trụ và đế phía dưới
export function drawPedestal(ctx, ox, oy) {
  const p = new PixelBuffer(TILE, TILE);
  p.rect(5, 10, 6, 4, STEEL.base);
  p.rect(6, 10, 2, 4, STEEL.light);
  p.ellipse(8, 14.5, 6, 1.5, STEEL.dark);
  p.ellipse(8, 8.5, 7.5, 4, STEEL.dark);
  p.ellipse(8, 8, 7, 3.5, STEEL.light);
  p.ellipse(8, 7.5, 5, 2.2, STEEL.hi);
  p.outline(-0.6);
  px(ctx, 'rgba(30,20,10,0.2)', ox + 3, oy + 15, 10, 1);
  p.drawTo(ctx, ox, oy);
}

// Ghế đẩu tròn (ô 'q'): mặc định đệm cam, colors = [viền, đệm, sáng] theo bảng màu nội thất (theme.stool)
export function drawStool(ctx, ox, oy, colors = ['#a83a20', '#e8603a', '#f8a070']) {
  const p = new PixelBuffer(TILE, TILE);
  p.rect(4, 9, 2, 6, '#5a3a20');
  p.rect(10, 9, 2, 6, '#5a3a20');
  p.rect(2, 3, 12, 7, colors[0]);
  p.rect(3, 4, 10, 4, colors[1]);
  p.rect(4, 4, 6, 1, colors[2]);
  p.outline(-0.6);
  px(ctx, 'rgba(30,20,10,0.2)', ox + 2, oy + 15, 12, 1);
  p.drawTo(ctx, ox, oy);
}

// Bàn gỗ mặt vàng nhiều ô (ô 'n', ghép theo ô bên cạnh như bàn thường): bàn đặt Poké Ball khởi đầu
export function drawYellowTable(ctx, ox, oy, map, x, y) {
  const same = (dx, dy) => map.tileAt(x + dx, y + dy) === 'n';
  const [l, r, u, d] = [same(-1, 0), same(1, 0), same(0, -1), same(0, 1)];
  if (!u && !d) {
    drawLowYellowTable(ctx, ox, oy, l, r);
    return;
  }
  const x0 = ox + (l ? 0 : 1);
  const x1 = ox + TILE - (r ? 0 : 1);
  const y0 = oy + (u ? 0 : 2);
  const y1 = oy + TILE - (d ? 0 : 1);
  px(ctx, '#5a3a18', x0, y0, x1 - x0, y1 - y0);
  px(ctx, '#a06a30', x0 + (l ? 0 : 1), y0 + (u ? 0 : 1), x1 - x0 - (l ? 0 : 1) - (r ? 0 : 1), y1 - y0 - (u ? 0 : 1));
  // mặt bàn vàng có viền gỗ
  const ix0 = x0 + (l ? 0 : 3);
  const ix1 = x1 - (r ? 0 : 3);
  const iy0 = y0 + (u ? 0 : 3);
  const iy1 = y1 - (d ? 0 : 6);
  if (iy1 > iy0) {
    px(ctx, '#e8d040', ix0, iy0, ix1 - ix0, iy1 - iy0);
    if (!u) px(ctx, '#f8e880', ix0, iy0, ix1 - ix0, 1);
  }
  if (!d) {
    px(ctx, '#7a4a20', x0 + (l ? 0 : 1), y1 - 5, x1 - x0 - (l ? 0 : 1) - (r ? 0 : 1), 4);
    if (!l) px(ctx, '#4a2a10', x0 + 1, y1 - 1, 2, 2);
    if (!r) px(ctx, '#4a2a10', x1 - 3, y1 - 1, 2, 2);
  }
}

// Bàn mặt vàng một hàng ô (bàn đặt Poké Ball khởi đầu): mặt bàn vàng giữa ô (y 3-12, Poké Ball vẽ ở tâm ô nằm giữa mặt
// bàn), viền gỗ, mặt trước gỗ sẫm và chân bàn ở hai đầu
function drawLowYellowTable(ctx, ox, oy, l, r) {
  const x0 = ox + (l ? 0 : 1);
  const x1 = ox + TILE - (r ? 0 : 1);
  px(ctx, '#5a3a18', x0, oy + 1, x1 - x0, 14);
  px(ctx, '#a06a30', x0 + (l ? 0 : 1), oy + 2, x1 - x0 - (l ? 0 : 1) - (r ? 0 : 1), 11);
  px(ctx, '#e8d040', x0 + (l ? 0 : 3), oy + 4, x1 - x0 - (l ? 0 : 3) - (r ? 0 : 3), 8);
  px(ctx, '#f8e880', x0 + (l ? 0 : 3), oy + 4, x1 - x0 - (l ? 0 : 3) - (r ? 0 : 3), 1);
  px(ctx, '#7a4a20', x0 + (l ? 0 : 1), oy + 13, x1 - x0 - (l ? 0 : 1) - (r ? 0 : 1), 2);
  if (!l) px(ctx, '#4a2a10', x0 + 1, oy + 15, 2, 1);
  if (!r) px(ctx, '#4a2a10', x1 - 3, oy + 15, 2, 1);
}

// Quầy chữ U / chữ L (Pokémon Center, Poké Mart): mặt quầy nối liền theo cả 4 hướng, mặt trước ốp sáng ở những ô không có quầy
// phía dưới. Màu theo bảng màu nội thất t (counterTop / counterLight / counterFront / counterDark / counterInk)
export function drawCenterCounter(ctx, ox, oy, map, x, y, t) {
  const same = (dx, dy) => map.tileAt(x + dx, y + dy) === 'c';
  const [l, r, u, d] = [same(-1, 0), same(1, 0), same(0, -1), same(0, 1)];
  const x0 = ox + (l ? 0 : 3);
  const x1 = ox + TILE - (r ? 0 : 3);
  const y0 = oy + (u ? 0 : 2);
  const y1 = oy + (d ? TILE : 10);
  px(ctx, t.counterInk, x0 - (l ? 0 : 1), y0 - (u ? 0 : 1), x1 - x0 + (l ? 0 : 1) + (r ? 0 : 1), y1 - y0 + (u ? 0 : 1));
  px(ctx, t.counterTop, x0, y0, x1 - x0, y1 - y0);
  px(ctx, t.counterLight, x0 + (l ? 0 : 1), y0 + (u ? 0 : 1), x1 - x0 - (l ? 0 : 1) - (r ? 0 : 1), 2);
  if (!d) {
    px(ctx, t.counterInk, x0 - (l ? 0 : 1), oy + 10, x1 - x0 + (l ? 0 : 1) + (r ? 0 : 1), 6);
    px(ctx, t.counterFront, x0, oy + 10, x1 - x0, 5);
    px(ctx, t.counterDark, x0, oy + 13, x1 - x0, 2);
  }
}

// Logo trên sàn trước quầy (Pokémon Center): đĩa tối, vòng xanh ngọc, dải ngang và nút tròn giữa. cx, cy: tâm (px)
export function drawFloorEmblem(ctx, cx, cy) {
  const R = 30;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = Math.sqrt((x + 0.5) ** 2 + ((y + 0.5) * 1.25) ** 2);
      if (d > R) continue;
      let c = '#4e6e64';
      if (d > 17 && d < 25) c = '#2cc890';
      if (Math.abs(y + 0.5) < 3 && d > 6) c = d > 17 && d < 25 ? '#1e9a6c' : '#3e5c54';
      if (d <= 7) c = d <= 4 ? '#2cc890' : '#3e5c54';
      px(ctx, c, cx + x, cy + y);
    }
  }
}

// Góc vát cuối phòng (map.chamfer = số ô): tam giác đen ở hai góc dưới
export function drawChamfer(ctx, map, n) {
  const size = n * TILE;
  const bottom = map.height * TILE;
  const right = map.width * TILE;
  for (let i = 0; i < size; i++) {
    px(ctx, '#000000', 0, bottom - size + i, size - i, 1);
    px(ctx, '#000000', right - size + i, bottom - size + i, size - i, 1);
  }
}
