import { WORLD_SCALE } from '../config.js';
import { PixelBuffer, addSheetTexture, shadeHex, upscaleCanvas } from './pixel.js';

// Thú cưỡi trên bản đồ (Arcanine trên cạn, Lapras dưới nước, khối nước khi lướt bằng chiêu Surf): sprite pixel riêng,
// to hơn hẳn người chơi (cao / rộng khoảng 1,5-2 lần), 3 hướng (down: quay mặt về phía màn hình, up: quay lưng,
// side: nhìn sang trái, sang phải thì lật) x 2 nhịp (phi nước đại / quạt vây / bơi). Mỗi hình tách 2 lớp để người chơi
// ngồi kẹp giữa:
//  under: cả con thú (nằm sau người chơi)
//  over : phần nằm trước người chơi (đầu + bờm + chân trước khi quay mặt xuống, mông + đuôi / mai khi quay lưng,
//         lớp lông / mép mai quanh hông người ngồi khi nhìn ngang), che phần dưới người ngồi
// Khung W x H pixel logic, mặt đất (chân / mặt nước) ở hàng dưới cùng; phóng to x WORLD_SCALE như nhân vật.

const W = 56;
const H = 44;
export const RIDE_VIEWS = ['down', 'up', 'side'];
export const RIDE_FRAMES = RIDE_VIEWS.flatMap((v) => [`${v}-0`, `${v}-1`]);
// Người ngồi trên lưng (nhân vật 16x24 pixel logic: đầu hàng 0-12, áo 13-17, quần 18-20, chân 21-23):
//  hide: giấu chừng ấy hàng pixel phía dưới hình nhân vật (chân) • seat: mép dưới phần còn lại đặt ở độ cao này (tính từ
//  mặt đất / mặt nước) • dx: lệch so với tâm thú cưỡi (side: số dương = lùi về phía lưng / đuôi).
// Nhìn ngang thì chỉ giấu cẳng chân (hide nhỏ): cả thân trên lộ ra trên lưng, hông lún vào lớp lông / mép mai phía gần
// Hình vẽ trên lưới 56x44 rồi thu nhỏ còn MOUNT_SCALE (~35x27 pixel logic, chừng 2 ô): thú cưỡi vẫn to hơn người nhưng
// không chiếm 3-4 ô. seat / dx dưới đây tính theo lưới gốc, tự thu theo cùng tỉ lệ
export const MOUNT_SCALE = 0.62;
const SEAT_ART = {
  arcanine: { down: { dx: 0, seat: 24, hide: 8 }, up: { dx: 0, seat: 22, hide: 8 }, side: { dx: 3, seat: 22, hide: 4 } },
  lapras: { down: { dx: 0, seat: 22, hide: 8 }, up: { dx: 0, seat: 21, hide: 8 }, side: { dx: 5, seat: 20, hide: 4 } },
  surf: { down: { dx: 0, seat: 17, hide: 8 }, up: { dx: 0, seat: 17, hide: 8 }, side: { dx: 2, seat: 16, hide: 6 } },
};
export const RIDE_SEAT = Object.fromEntries(Object.entries(SEAT_ART).map(([art, views]) => [art, Object.fromEntries(
  Object.entries(views).map(([v, { dx, seat, hide }]) => [v, { dx: Math.round(dx * MOUNT_SCALE), seat: Math.round(seat * MOUNT_SCALE), hide }]),
)]));

const INK = '#2c2230';
const WHITE = '#ffffff';
// Bóng dưới chân thú cưỡi trên cạn: không vẽ vào hình (nhảy gờ đất thì bóng phải nằm lại dưới đất), WorldScene dùng
// bóng tròn chung của nhân vật, kéo dài theo hướng nhìn: [bán kính ngang, bán kính dọc] (pixel logic)
export const MOUNT_SHADOW = { arcanine: { down: [16 * MOUNT_SCALE, 2], up: [16 * MOUNT_SCALE, 2], side: [20 * MOUNT_SCALE, 2] } };

// Bộ đệm 2 lớp: pixel vẽ khi front = true thuộc lớp over (vẫn nằm trong hình đầy đủ của lớp under)
class LayerBuffer extends PixelBuffer {
  constructor(w, h) {
    super(w, h);
    this.tag = new Array(w * h).fill(false);
    this.front = false;
  }

  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
    this.tag[y * this.w + x] = c ? this.front : false;
  }

  isFront(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.tag[y * this.w + x];
  }

  // Đánh dấu lại các pixel đã vẽ thoả filter vào lớp over (vd mép lưng quanh hông người ngồi)
  toFront(filter) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y) && filter(x, y)) this.tag[y * this.w + x] = true;
  }

  // Viền ngoài kiểu Gen 5 (màu kề bên làm tối), viền thuộc lớp của pixel kề bên
  outline(darken = -0.6) {
    const src = [...this.data];
    const tag = [...this.tag];
    const at = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[at(x, y)]) continue;
        const n = [at(x, y - 1), at(x - 1, y), at(x + 1, y), at(x, y + 1)].find((i) => i >= 0 && src[i]);
        if (n === undefined) continue;
        this.data[at(x, y)] = shadeHex(src[n], darken);
        this.tag[at(x, y)] = tag[n];
      }
    }
  }

  // Nét viền bên trong giữa lớp over và phần thân phía sau (đầu / bờm nổi lên trước thân)
  contourFront(darken = -0.5) {
    const src = [...this.data];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = src[y * this.w + x];
        if (!c || !this.isFront(x, y) || c.startsWith('rgba')) continue;
        const behind = [[0, -1], [-1, 0], [1, 0]].some(([dx, dy]) => this.get(x + dx, y + dy) && !this.isFront(x + dx, y + dy));
        if (behind) this.data[y * this.w + x] = shadeHex(c, darken);
      }
    }
  }

  split() {
    const under = new PixelBuffer(this.w, this.h);
    const over = new PixelBuffer(this.w, this.h);
    under.data = [...this.data];
    over.data = this.data.map((c, i) => (this.tag[i] ? c : null));
    return { under, over };
  }
}

// Nét dày: các hình tròn bán kính r dọc theo đường gấp khúc pts
function stroke(p, pts, r, c) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let k = 0; k <= n; k++) p.ellipse(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, r, r, c);
  }
}

// Khối tròn có bóng: màu gốc, sáng ở trên, tối ở dưới (theo hàng), chỉ tô lại pixel vừa vẽ
function blob(p, cx, cy, rx, ry, pal, { light = 0.45, dark = 0.6 } = {}) {
  p.ellipse(cx, cy, rx, ry, pal.base);
  const inside = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  p.recolor(pal.light, (x, y) => inside(x, y) && (y + 0.5 - cy) / ry < -light);
  p.recolor(pal.dark, (x, y) => inside(x, y) && (y + 0.5 - cy) / ry > dark);
}

// ---------- Arcanine: lông cam vằn đen, bờm / đuôi / túm lông chân màu kem ----------
const ORANGE = { base: '#f0883a', light: '#f8b46c', dark: '#c8642e' };
const FAR = { base: '#d06c30', light: '#e07c3a', dark: '#a84c22' };
const CREAM = { base: '#fbefc8', light: '#fffbea', dark: '#dcc48c' };
const PAW = '#a04a22';

// Chân: từ hông (hx, hy) xuống bàn chân (fx, fy); túm lông kem phía sau bắp chân (back: hướng phía sau, +1 / -1)
function leg(p, hx, hy, fx, fy, pal, back = 1) {
  stroke(p, [[hx, hy], [(hx + fx) / 2, (hy + fy) / 2 + 1], [fx, fy - 1.6]], 2.1, pal.base);
  p.ellipse(fx - 0.5, fy - 0.7, 2.7, 1.5, pal === FAR ? '#843a1a' : PAW);
  p.ellipse(hx + back * 1.6, hy + 3.2, 1.5, 2.6, pal === FAR ? CREAM.dark : CREAM.base);
}

// Vằn hổ: nét đen 2 pixel đầu, vuốt nhọn xuống dưới
function tiger(p, list) {
  for (const [x, y, d = 0] of list) {
    p.rect(x, y, 2, 1, INK);
    p.set(x + d, y + 1, INK);
    p.set(x + d, y + 2, INK);
  }
}

// Mép lông lởm chởm: các mũi nhọn 2 pixel nhô ra theo hướng (dx, dy)
function tufts(p, list, c) {
  for (const [x, y, dx, dy] of list) {
    p.set(x, y, c);
    p.set(x + dx, y + dy, c);
  }
}

function arcanineSide(f) {
  const p = new LayerBuffer(W, H);
  // Phi nước đại: nhịp 0 bốn chân chụm dưới thân, nhịp 1 chân trước vươn tới, chân sau đạp ra sau (một chân nhấc lên)
  const gait = f
    ? { far: [[23, 17, 41], [42, 48, 43]], near: [[20, 14, 42], [39, 44, 43]] }
    : { far: [[24, 23, 43], [42, 42, 43]], near: [[20, 19, 43], [38, 37, 42]] };
  // Đuôi bông xù màu kem cong vểnh lên phía sau
  for (const [x, y, r] of [[45.5, 25.5, 3], [48.5, 21.5, 3.6], [50.5, 16.5, 3.8], [51.5, 11.5, 3.3], [51, 7.6, 2.3]]) p.ellipse(x, y, r, r, CREAM.base);
  p.recolor(CREAM.dark, (x, y) => (x >= 52 || (x >= 50 && y >= 18)) && p.get(x, y) === CREAM.base);
  tufts(p, [[54, 14, 1, -1], [53, 19, 1, 0], [47, 9, -1, -1]], CREAM.base);
  for (const [x, y] of [[49, 13], [50, 18], [48, 22]]) p.rect(x, y, 2, 1, CREAM.dark);
  // Chân phía xa (cam sẫm)
  for (const [hx, fx, fy] of gait.far) leg(p, hx, 31, fx, fy, FAR);
  // Thân, mông, ngực
  blob(p, 31.5, 26.5, 13, 7.2, ORANGE, { light: 0.55, dark: 0.55 });
  blob(p, 41.5, 27, 6.5, 6.6, ORANGE, { light: 0.62, dark: 0.5 });
  blob(p, 23, 27, 6, 7, ORANGE, { light: 0.6, dark: 0.5 });
  tiger(p, [[29, 20, 1], [34, 20, 1], [39, 21, 1], [44, 23, 1], [36, 25, 0], [46, 28, 0], [31, 25, 0]]);
  // Chân phía gần, vằn trên chân
  for (const [hx, fx, fy] of gait.near) {
    leg(p, hx, 31, fx, fy, ORANGE);
    p.rect(Math.round((hx + fx) / 2) - 1, 37, 2, 1, INK);
  }
  // Cổ cam vươn lên, bờm kem ở mặt trước cổ / ngực (mép dưới lởm chởm) và chỏm lông kem chạy dọc gáy
  stroke(p, [[22, 23], [17, 17], [14, 14]], 4, ORANGE.base);
  p.recolor(ORANGE.light, (x, y) => y <= 18 && x >= 17 && x <= 21 && p.get(x, y) === ORANGE.base);
  blob(p, 18, 26, 5.4, 7.4, CREAM, { light: 0.75, dark: 0.45 });
  p.ellipse(14.5, 21, 3.4, 4, CREAM.base);
  tufts(p, [[14, 33, 0, 1], [17, 34, 0, 1], [20, 34, 0, 1], [12, 30, -1, 1]], CREAM.dark);
  for (const [x, y] of [[16, 25], [19, 28], [15, 29], [18, 22]]) p.rect(x, y, 1, 2, CREAM.dark);
  // Tai, đầu cam, mõm kem, mũi đen
  p.ellipse(16.5, 8, 2.1, 3.8, ORANGE.base);
  p.ellipse(16.8, 8.6, 0.9, 2.2, ORANGE.dark);
  blob(p, 11, 14, 6.6, 5.2, ORANGE, { light: 0.45, dark: 0.6 });
  p.ellipse(4.6, 16.8, 4.6, 2.8, ORANGE.base);
  p.ellipse(5.4, 18.4, 4.4, 1.9, CREAM.base);
  p.ellipse(9.5, 19, 3.6, 2.2, CREAM.base);
  p.rect(0, 15, 2, 2, INK);
  p.set(0, 15, '#6a5a70');
  p.rect(3, 18, 3, 1, '#b89a64');
  // Chỏm lông kem trên đỉnh đầu chạy ra sau gáy
  stroke(p, [[10, 9.4], [14.5, 9.4], [19, 12], [22, 16]], 1.9, CREAM.base);
  tufts(p, [[21, 11, 1, -1], [23, 14, 1, 0], [16, 8, 0, -1]], CREAM.base);
  p.recolor(CREAM.dark, (x, y) => y >= 13 && x >= 20 && x <= 24 && p.get(x, y) === CREAM.base);
  // Mắt (nhìn về trước) và vằn trên mắt
  p.rect(7, 12, 2, 2, INK);
  p.set(7, 12, WHITE);
  p.rect(6, 11, 4, 1, INK);
  p.rect(11, 12, 2, 1, INK);
  p.set(12, 13, INK);
  p.outline(-0.58);
  // Lông lưng phía gần ôm quanh hông người ngồi
  p.toFront((x, y) => x >= 25 && x <= 37 && y >= 20);
  return p.split();
}

function arcanineDown(f) {
  const p = new LayerBuffer(W, H);
  // Đuôi bông kem vểnh sau lưng (ló bên phải người ngồi)
  for (const [x, y, r] of [[37.5, 21, 3.4], [40.5, 16.5, 4.2], [42, 11.5, 3.8], [41.5, 7.5, 2.6]]) p.ellipse(x, y, r, r, CREAM.base);
  p.recolor(CREAM.dark, (x, y) => x >= 43 && p.get(x, y) === CREAM.base);
  tufts(p, [[46, 11, 1, 0], [45, 16, 1, 1], [38, 8, -1, -1], [37, 13, -1, 0]], CREAM.base);
  for (const [x, y] of [[41, 10], [42, 15], [39, 19]]) p.rect(x, y, 1, 2, CREAM.dark);
  // Bàn chân sau ló sau chân trước
  for (const [x, lift] of [[17, f ? 1 : 0], [39, f ? 0 : 1]]) {
    p.rect(x - 1, 37, 3, 5 - lift, FAR.base);
    p.ellipse(x + 0.5, 42.4 - lift, 2.2, 1.2, FAR.dark);
  }
  // Lưng, vai tròn
  blob(p, 28, 26.5, 12.5, 7.5, ORANGE, { light: 0.45, dark: 0.55 });
  tiger(p, [[17, 23, 0], [38, 23, 1], [20, 20, 0], [35, 20, 1]]);
  p.outline(-0.58);
  // ----- Phía trước người ngồi: chân trước, bờm ngực, đầu -----
  p.front = true;
  // Hai chân trước dài, thẳng (phi thì so le một chân nhấc lên), vằn và túm lông kem sau chân
  for (const [x, lift] of [[21, f ? 2 : 0], [35, f ? 0 : 2]]) {
    p.rect(x - 2, 31, 5, 11 - lift, ORANGE.base);
    p.rect(x + (x < 28 ? -2 : 2), 31, 1, 11 - lift, ORANGE.dark);
    p.ellipse(x + 0.5, 42.3 - lift, 3, 1.5, PAW);
    p.set(x - 1, 42 - lift, '#843a1a');
    p.set(x + 1, 42 - lift, '#843a1a');
    p.rect(x - 1, 36 - lift, 3, 1, INK);
    p.rect(x, 37 - lift, 1, 1, INK);
  }
  // Bờm ngực kem lớn, mép dưới lởm chởm
  blob(p, 28, 33, 8.4, 5.4, CREAM, { light: 0.8, dark: 0.4 });
  tufts(p, [[22, 37, -1, 1], [25, 38, 0, 1], [28, 38, 0, 1], [31, 38, 0, 1], [34, 37, 1, 1]], CREAM.dark);
  for (const x of [24, 28, 32]) p.rect(x, 35, 1, 2, CREAM.dark);
  // Tai, má bông, đầu
  for (const s of [-1, 1]) {
    p.ellipse(28 + s * 7, 20.8, 2.4, 3.8, ORANGE.base);
    p.ellipse(28 + s * 6.6, 21.6, 1.1, 2.3, ORANGE.dark);
    p.ellipse(28 + s * 7.4, 29, 2.8, 3.4, CREAM.base);
    tufts(p, [[28 + s * 10, 28, s, 0], [28 + s * 9, 31, s, 1]], CREAM.base);
  }
  blob(p, 28, 26.8, 7.2, 5.6, ORANGE, { light: 0.5, dark: 0.7 });
  // Chỏm lông kem trên trán, mõm, mũi, mắt có vằn
  p.ellipse(28, 21.4, 3.8, 2.2, CREAM.base);
  tufts(p, [[27, 19, 0, -1], [29, 19, 1, -1]], CREAM.base);
  p.ellipse(28, 29.6, 3.8, 2.6, CREAM.base);
  p.ellipse(28, 28.4, 2.2, 1.4, ORANGE.base);
  p.rect(27, 28, 2, 1, INK);
  p.rect(26, 31, 4, 1, '#b89a64');
  for (const s of [-1, 1]) {
    const x = s < 0 ? 24 : 31;
    p.rect(x, 25, 1, 2, INK);
    p.set(x + (s < 0 ? 1 : 0), 25, WHITE);
    p.set(x + (s < 0 ? 1 : -1), 26, INK);
    p.rect(x - (s < 0 ? 1 : 0), 24, 2, 1, INK);
  }
  p.contourFront();
  p.outline(-0.58);
  p.front = false;
  return p.split();
}

function arcanineUp(f) {
  const p = new LayerBuffer(W, H);
  // Đầu ở xa phía trên (nhìn từ sau gáy): hai tai nhô trên đầu người ngồi, bờm kem xoè quanh cổ
  for (const s of [-1, 1]) {
    p.ellipse(28 + s * 6, 6.6, 2.3, 3.8, ORANGE.base);
    p.ellipse(28 + s * 6, 7.4, 1, 2.2, ORANGE.dark);
  }
  blob(p, 28, 11.5, 6.6, 4.8, ORANGE, { light: 0.4, dark: 0.7 });
  p.ellipse(28, 8.6, 3.2, 1.8, CREAM.base);
  blob(p, 28, 17.5, 11.5, 4.6, CREAM, { light: 0.7, dark: 0.4 });
  tufts(p, [[16, 17, -1, 0], [17, 20, -1, 1], [39, 17, 1, 0], [38, 20, 1, 1]], CREAM.base);
  // Bàn chân trước ló ra hai bên phía xa
  for (const [x, lift] of [[18, f ? 0 : 1], [38, f ? 1 : 0]]) {
    p.rect(x - 1, 33, 3, 6 - lift, FAR.base);
    p.ellipse(x + 0.5, 39 - lift, 2.2, 1.2, FAR.dark);
  }
  // Lưng có vằn
  blob(p, 28, 25, 12, 7.2, ORANGE, { light: 0.5, dark: 0.6 });
  tiger(p, [[16, 22, 0], [39, 22, 1], [19, 19, 0], [36, 19, 1]]);
  p.outline(-0.58);
  // ----- Phía trước người ngồi: mông, chân sau có lông kem sau đùi, đuôi bông rủ xuống -----
  p.front = true;
  for (const [x, lift] of [[20.5, f ? 0 : 2], [35.5, f ? 2 : 0]]) {
    p.rect(x - 2, 35, 4, 7 - lift, ORANGE.base);
    p.rect(x - 2, 35, 1, 7 - lift, ORANGE.dark);
    p.ellipse(x, 42.4 - lift, 2.7, 1.4, PAW);
  }
  blob(p, 28, 30, 11.5, 7.2, ORANGE, { light: 0.5, dark: 0.5 });
  for (const s of [-1, 1]) p.ellipse(28 + s * 7.5, 35, 2.6, 2.6, CREAM.base);
  tiger(p, [[17, 28, 0], [38, 28, 1], [20, 32, 0], [35, 32, 1]]);
  // Đuôi bông to rủ giữa mông
  for (const [y, r] of [[29.5, 3.4], [33, 4.4], [37, 4.4], [40, 3]]) p.ellipse(28, y, r, r * 0.95, CREAM.base);
  tufts(p, [[23, 35, -1, 0], [32, 35, 1, 0], [24, 39, -1, 1], [31, 39, 1, 1]], CREAM.base);
  p.recolor(CREAM.dark, (x, y) => x >= 29 && y >= 31 && p.isFront(x, y) && p.get(x, y) === CREAM.base && Math.abs(x - 28) < 6);
  for (const [x, y] of [[27, 33], [28, 37], [26, 36]]) p.rect(x, y, 1, 2, CREAM.dark);
  p.contourFront();
  p.outline(-0.58);
  p.front = false;
  return p.split();
}

// ---------- Lapras: thân xanh, bụng / cổ trước màu kem, mai xám có gai tròn, sừng xoắn ----------
const BLUE = { base: '#4a8ae0', light: '#84bef6', dark: '#3262b4' };
const SHELL = { base: '#b4aec2', light: '#d8d4e2', dark: '#88829c' };
const LAP = { c: '#f4ecc8', cd: '#d8cc9c', knob: '#625c76', knobL: '#8a84a0', horn: '#d4d0de', hornD: '#a8a2b8' };
const FOAM = '#f0f8ff';
const SPRAY = '#bfe0ff';
const WATERLINE = 38; // dưới hàng này là dưới nước: không vẽ thân, chỉ có bọt sóng

// Xoá phần dưới mặt nước, vẽ viền bọt quanh thân ở mặt nước (từ x0 tới x1), nhấp nháy theo nhịp f
function waterline(p, x0, x1, f) {
  for (let y = WATERLINE + 1; y < H; y++) for (let x = 0; x < W; x++) p.set(x, y, null);
  for (let x = x0; x <= x1; x++) {
    p.set(x, WATERLINE + 1, (x + f) % 4 === 0 ? SPRAY : FOAM);
    if ((x + f * 2) % 3 !== 0) p.set(x, WATERLINE + 2, (x + f) % 2 ? FOAM : SPRAY);
  }
  for (const x of [x0 - 1, x1 + 1]) p.set(x, WATERLINE, FOAM);
}

// Vệt sóng tách ra sau đuôi / hai bên (các đường gạch bọt trắng), lệch theo nhịp f
function wake(p, lines, f) {
  for (const [x0, x1, y] of lines) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if ((x + f * 2 + y) % 5 !== 0) p.set(x, y, (x + y) % 3 ? FOAM : SPRAY);
  }
}

// Gai tròn trên mai: khối xám đậm, đốm sáng góc trên trái
function knobs(p, list) {
  for (const [x, y] of list) {
    const [px, py] = [Math.floor(x) - 1, Math.floor(y) - 1];
    p.set(px + 1, py + 3, SHELL.dark);
    p.set(px + 2, py + 3, SHELL.dark);
    p.set(px + 3, py + 2, SHELL.dark);
    p.rect(px, py, 3, 3, LAP.knob);
    p.set(px + 1, py - 1, LAP.knob);
    p.set(px, py, LAP.knobL);
    p.set(px + 1, py, LAP.knobL);
    p.set(px, py + 1, LAP.knobL);
  }
}

function shell(p, cx, cy, rx, ry, list) {
  blob(p, cx, cy, rx, ry, SHELL, { light: 0.4, dark: 0.45 });
  knobs(p, list);
  // Đốm bóng loáng trên mai
  p.rect(Math.round(cx - rx * 0.5), Math.round(cy - ry * 0.62), 3, 1, WHITE);
  p.set(Math.round(cx - rx * 0.5) - 1, Math.round(cy - ry * 0.62) + 1, WHITE);
}

function laprasSide(f) {
  const p = new LayerBuffer(W, H);
  // Vây sau phía xa, thân dưới mai (bụng kem sát mặt nước)
  p.ellipse(f ? 48 : 49, f ? 36.5 : 37.5, 4.4, 1.8, BLUE.dark);
  blob(p, 32, 34.5, 16, 6, BLUE, { light: 0.7, dark: 0.35 });
  p.recolor(LAP.c, (x, y) => y >= 37 && y <= WATERLINE && x <= 40 && p.get(x, y) === BLUE.dark);
  // Mai: gai tròn nhô trên mép mai
  shell(p, 34.5, 28.5, 14, 8, [[26, 22.5], [32, 20.8], [38.5, 21], [44.5, 24], [29, 28.5], [36, 28.8], [43, 30]]);
  // Cổ dày cong lên phía trước, mặt trước cổ màu kem
  stroke(p, [[23, 35], [19, 28], [16, 21], [14, 15]], 3.7, BLUE.base);
  stroke(p, [[20, 36], [16.2, 29], [13, 22], [11, 17]], 1.7, LAP.c);
  p.recolor(BLUE.light, (x, y) => p.get(x, y) === BLUE.base && x >= 19 && y >= 18 && y <= 30 && (x - 19) * 2 > (30 - y) * 0.9 + 4);
  // Sừng xoắn sau đầu, đầu to, tai, mắt, miệng
  p.ellipse(16.2, 5.6, 1.5, 2.8, LAP.horn);
  p.set(17, 3, LAP.hornD);
  p.set(16, 5, LAP.hornD);
  p.set(16, 7, LAP.hornD);
  blob(p, 9.5, 11, 7.2, 5, BLUE, { light: 0.35, dark: 0.55 });
  p.ellipse(3.5, 12.6, 3.6, 2.6, BLUE.base);
  p.ellipse(15.6, 10, 1.8, 2.6, BLUE.dark); // tai
  p.rect(6, 9, 2, 2, INK);
  p.set(7, 9, WHITE);
  p.rect(1, 14, 7, 1, BLUE.dark);
  p.rect(5, 7, 3, 1, WHITE);
  // Vây trước quạt nước
  p.ellipse(f ? 21 : 23, f ? 37 : 38, 5.2, 1.9, BLUE.dark);
  p.outline(-0.56);
  // Mép mai phía gần ôm quanh hông người ngồi
  p.toFront((x, y) => x >= 26 && x <= 42 && y >= 22);
  waterline(p, 14, 48, f);
  // Sóng mũi trước cổ và vệt sóng sau đuôi
  wake(p, [[11, 16, 38], [8, 13, 40], [49, 55, 40], [46, 54, 42], [51, 55, 38]], f);
  return p.split();
}

function laprasDown(f) {
  const p = new LayerBuffer(W, H);
  // Hai vây trước hai bên quạt nước, thân, mai sau lưng người ngồi
  p.ellipse(f ? 10.5 : 11.5, f ? 36 : 37, 5.4, 2, BLUE.dark);
  p.ellipse(f ? 45.5 : 44.5, f ? 36 : 37, 5.4, 2, BLUE.dark);
  blob(p, 28, 35, 15, 5, BLUE, { light: 0.6, dark: 0.4 });
  shell(p, 28, 27.5, 14.5, 8.8, [[17, 24.5], [23, 20.5], [33, 20.5], [39, 24.5], [16, 30.5], [40, 30.5]]);
  p.outline(-0.56);
  // ----- Phía trước người ngồi: cổ vươn lên và đầu -----
  p.front = true;
  stroke(p, [[28, 39], [28, 32]], 3.8, BLUE.base);
  stroke(p, [[28, 39], [28, 33]], 1.9, LAP.c);
  for (const s of [-1, 1]) p.ellipse(28 + s * 7.2, 25.8, 1.8, 2.6, BLUE.dark);
  p.ellipse(28, 21, 1.5, 2.4, LAP.horn);
  p.set(28, 19, LAP.hornD);
  p.set(28, 21, LAP.hornD);
  blob(p, 28, 27, 7, 5, BLUE, { light: 0.45, dark: 0.7 });
  p.ellipse(28, 29.8, 4.4, 2.2, BLUE.base);
  for (const s of [-1, 1]) {
    const x = s < 0 ? 24 : 31;
    p.rect(x, 25, 2, 2, INK);
    p.set(x + (s < 0 ? 1 : 0), 25, WHITE);
  }
  p.rect(25, 30, 6, 1, BLUE.dark);
  p.rect(25, 23, 2, 1, WHITE);
  p.contourFront();
  p.outline(-0.56);
  p.front = false;
  waterline(p, 8, 48, f);
  // Sóng mũi rẽ ra hai bên trước ngực (phía màn hình)
  wake(p, [[20, 24, 41], [32, 36, 41], [14, 19, 42], [37, 42, 42]], f);
  return p.split();
}

function laprasUp(f) {
  const p = new LayerBuffer(W, H);
  // Cổ và đầu phía trước (xa màn hình), nhìn từ sau gáy: đầu nhô lên trên đầu người ngồi
  stroke(p, [[28, 26], [28, 13]], 3.6, BLUE.base);
  for (const s of [-1, 1]) p.ellipse(28 + s * 6.8, 8.8, 1.8, 2.6, BLUE.dark);
  blob(p, 28, 9, 6.6, 4.8, BLUE, { light: 0.4, dark: 0.6 });
  p.ellipse(28, 3.4, 1.5, 2.4, LAP.horn);
  p.set(28, 2, LAP.hornD);
  p.set(28, 4, LAP.hornD);
  p.rect(25, 6, 3, 1, WHITE);
  p.outline(-0.56);
  // ----- Phía trước người ngồi: mai sau lưng, hai vây sau quạt nước -----
  p.front = true;
  p.ellipse(f ? 11 : 12, f ? 36 : 37, 5, 1.9, BLUE.dark);
  p.ellipse(f ? 45 : 44, f ? 36 : 37, 5, 1.9, BLUE.dark);
  blob(p, 28, 36, 15, 4.6, BLUE, { light: 0.6, dark: 0.5 });
  shell(p, 28, 31, 14.5, 8, [[17, 28.5], [23, 25], [33, 25], [39, 28.5], [22, 33.5], [34, 33.5]]);
  p.contourFront();
  p.outline(-0.56);
  p.front = false;
  waterline(p, 9, 47, f);
  // Vệt sóng hình chữ V loang ra phía sau (về phía màn hình)
  wake(p, [[17, 22, 41], [34, 39, 41], [10, 16, 43], [40, 46, 43]], f);
  return p.split();
}

// ---------- Khối nước khi lướt bằng chiêu Surf (như game gốc): thân tròn xanh nhạt nổi trên mặt nước, đầu nhỏ có mắt ----------
// Người chơi ngồi trên lưng (giấu chân), khối nước nhỏ hơn Lapras nhiều. Nhịp 0 / 1: hai vây quạt nước, bọt sóng đổi chỗ
const SURF = { base: '#64b4f4', light: '#b0e0ff', dark: '#3c80d4' };
const SURF_HEAD = { base: '#86c8fa', light: '#c8ecff', dark: '#5294e0' }; // đầu sáng hơn thân để nổi lên trước thân

// Hai vây hai bên quạt nước (so le theo nhịp f)
function surfFins(p, xs, f) {
  for (const [i, x] of xs.entries()) p.ellipse(x, (i + f) % 2 ? 36.2 : 37.2, 3.4, 1.5, SURF.dark);
}

function surfDown(f) {
  const p = new LayerBuffer(W, H);
  surfFins(p, [14.5, 41.5], f);
  blob(p, 28, 34, 13, 6.5, SURF, { light: 0.35, dark: 0.5 });
  p.rect(19, 29, 3, 1, WHITE);
  p.set(18, 30, WHITE);
  p.outline(-0.6);
  // ----- Phía trước người ngồi: cái đầu tròn nhô lên khỏi mặt nước, hai mắt nhìn về phía màn hình -----
  p.front = true;
  blob(p, 28, 35.6, 6.6, 4.6, SURF_HEAD, { light: 0.45, dark: 0.6 });
  for (const x of [24, 30]) {
    p.rect(x, 34, 2, 2, INK);
    p.set(x + (x < 28 ? 1 : 0), 34, WHITE);
  }
  p.rect(27, 37, 2, 1, SURF.dark);
  p.contourFront();
  p.outline(-0.6);
  p.front = false;
  waterline(p, 12, 44, f);
  wake(p, [[20, 24, 41], [32, 36, 41], [15, 19, 42], [37, 41, 42]], f);
  return p.split();
}

function surfUp(f) {
  const p = new LayerBuffer(W, H);
  // Đầu ở phía trước (xa màn hình), khuất sau lưng người ngồi: chỉ ló hai bên vai
  blob(p, 28, 27.6, 6.2, 4.2, SURF_HEAD, { light: 0.4, dark: 0.7 });
  surfFins(p, [14.5, 41.5], f);
  blob(p, 28, 34, 13, 6.5, SURF, { light: 0.35, dark: 0.5 });
  p.rect(19, 29, 3, 1, WHITE);
  p.set(18, 30, WHITE);
  p.outline(-0.6);
  // ----- Phía trước người ngồi: đuôi chẻ đôi ló khỏi mặt nước -----
  p.front = true;
  for (const s of [-1, 1]) p.ellipse(28 + s * (f ? 3.2 : 2.6), f ? 36.4 : 37, 2.6, 1.6, SURF.dark);
  p.ellipse(28, 37.4, 2, 1.6, SURF.base);
  p.outline(-0.6);
  p.front = false;
  waterline(p, 12, 44, f);
  wake(p, [[17, 22, 41], [34, 39, 41], [10, 16, 43], [40, 46, 43]], f);
  return p.split();
}

function surfSide(f) {
  const p = new LayerBuffer(W, H);
  // Vây phía xa, thân, đầu nhô về phía trước (bên trái), đuôi phía sau
  p.ellipse(f ? 21 : 22, f ? 36 : 37, 3.6, 1.4, SURF.dark);
  p.ellipse(f ? 46 : 47, f ? 34.5 : 35.5, 2.6, 2.2, SURF.dark);
  blob(p, 31, 34, 14, 6, SURF, { light: 0.35, dark: 0.5 });
  blob(p, 16, 33, 5.6, 4.6, SURF_HEAD, { light: 0.4, dark: 0.6 });
  p.rect(12, 31, 2, 2, INK);
  p.set(12, 31, WHITE);
  p.rect(10, 35, 3, 1, SURF.dark);
  p.rect(24, 29, 3, 1, WHITE);
  p.set(23, 30, WHITE);
  // Vây phía gần quạt nước
  p.ellipse(f ? 29 : 31, f ? 36.6 : 37.4, 4, 1.5, SURF.dark);
  p.outline(-0.6);
  // Mép lưng phía gần ôm quanh hông người ngồi
  p.toFront((x, y) => x >= 25 && x <= 39 && y >= 30);
  waterline(p, 10, 46, f);
  wake(p, [[6, 11, 38], [4, 9, 40], [47, 54, 40], [45, 53, 42]], f);
  return p.split();
}

const RIDE_ART = {
  arcanine: { down: arcanineDown, up: arcanineUp, side: arcanineSide },
  lapras: { down: laprasDown, up: laprasUp, side: laprasSide },
  surf: { down: surfDown, up: surfUp, side: surfSide },
};

export const hasRideArt = (speciesId) => Boolean(RIDE_ART[speciesId]);

// Thu nhỏ hình cưỡi giữ nét pixel: mỗi pixel mới lấy màu chiếm đa số trong vùng pixel gốc tương ứng (trong suốt nếu quá nửa
// vùng trong suốt). Lớp over lấy đúng màu của lớp under ở pixel đó nếu quá nửa vùng thuộc lớp over
const W2 = Math.round((W * MOUNT_SCALE) / 2) * 2; // bề ngang chẵn: tâm hình nằm đúng giữa hai pixel như hình gốc
const H2 = Math.round(H * MOUNT_SCALE);
function shrinkLayers({ under, over }) {
  const u = new PixelBuffer(W2, H2);
  const o = new PixelBuffer(W2, H2);
  const span = (t, n, k) => [Math.floor(t * k), Math.min(n, Math.max(Math.floor(t * k) + 1, Math.floor((t + 1) * k)))];
  for (let ty = 0; ty < H2; ty++) {
    const [y0, y1] = span(ty, H, H / H2);
    for (let tx = 0; tx < W2; tx++) {
      const [x0, x1] = span(tx, W, W / W2);
      const counts = new Map();
      let empty = 0;
      let front = 0;
      let total = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++;
          const c = under.get(x, y);
          if (!c) {
            empty++;
            continue;
          }
          counts.set(c, (counts.get(c) ?? 0) + 1);
          if (over.get(x, y)) front++;
        }
      }
      if (empty * 2 > total || !counts.size) continue;
      const c = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      u.set(tx, ty, c);
      if (front * 2 >= total - empty) o.set(tx, ty, c);
    }
  }
  return { under: u, over: o };
}

// Dựng 2 lớp (under / over) của một hình cưỡi đã thu nhỏ (dùng cho texture và kiểm thử)
export const rideLayers = (speciesId, view, f) => shrinkLayers(RIDE_ART[speciesId][view](f));
export const RIDE_SIZE = { w: W2, h: H2 };
// Dưới hàng này (của hình đã thu nhỏ) là dưới mặt nước: chỉ có bọt sóng
export const RIDE_WATERLINE = Math.ceil(((WATERLINE + 1) * H2) / H);

// Đám bụi nhỏ tung lên dưới chân thú cưỡi / khi đáp đất (fx-dust-puff) và bọt nước bắn lên khi xuống / rời nước
// (fx-splash): pixel art phóng to sẵn x WORLD_SCALE (hiện ở cỡ 1 như nhân vật), tạo một lần
export function puffTextures(scene) {
  if (scene.textures.exists('fx-dust-puff')) return;
  const dust = new PixelBuffer(10, 7);
  dust.ellipse(3.4, 4.4, 3, 2.4, '#e4d6b4');
  dust.ellipse(6.6, 3.8, 3, 3, '#e4d6b4');
  dust.ellipse(5, 5.2, 4.6, 1.8, '#e4d6b4');
  dust.recolor('#f6eedc', (x, y) => y <= 2 || (y === 3 && x >= 5 && x <= 7));
  dust.recolor('#cbb88e', (x, y) => y >= 6);
  scene.textures.addCanvas('fx-dust-puff', upscaleCanvas(dust.toCanvas(), WORLD_SCALE));
  const drop = new PixelBuffer(7, 8);
  drop.rect(3, 0, 1, 2, FOAM);
  drop.rect(1, 2, 1, 2, SPRAY);
  drop.rect(5, 2, 1, 2, SPRAY);
  drop.ellipse(3.5, 5.6, 3.2, 1.9, FOAM);
  drop.recolor(SPRAY, (x, y) => y >= 7);
  scene.textures.addCanvas('fx-splash', upscaleCanvas(drop.toCanvas(), WORLD_SCALE));
}

// Tạo (một lần) 2 sheet texture `ride-<loài>` (lớp dưới) và `ride-<loài>-over` (lớp trên), frame `<hướng>-<nhịp>`
export function rideTexture(scene, speciesId) {
  const key = `ride-${speciesId}`;
  if (!scene.textures.exists(key)) {
    const layers = { under: [], over: [] };
    for (const v of RIDE_VIEWS) {
      for (const f of [0, 1]) {
        const parts = rideLayers(speciesId, v, f);
        layers.under.push(upscaleCanvas(parts.under.toCanvas(), WORLD_SCALE));
        layers.over.push(upscaleCanvas(parts.over.toCanvas(), WORLD_SCALE));
      }
    }
    addSheetTexture(scene, key, layers.under, RIDE_FRAMES);
    addSheetTexture(scene, `${key}-over`, layers.over, RIDE_FRAMES);
  }
  return key;
}
