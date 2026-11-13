import { BADGES } from '../data/badges.js';
import { ITEMS } from '../data/items.js';
import { drawBadgeShape } from './badges.js';
import { PixelBuffer, addCanvasTexture, makeCanvas, shadeHex } from './pixel.js';

const FILTER_LINEAR = 0; // Phaser.Textures.FilterMode.LINEAR

// Biểu tượng 16x16 cho đá tiến hoá, đồ cầm và xe đạp (pixel art kiểu Gen 5)

// Đá tiến hoá: viên đá góc cạnh, có hoạ tiết riêng ở giữa
function drawStone(color, mark) {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 8.5, 6.5, 6, color);
  p.recolor(shadeHex(color, -0.3), (x, y) => x + y > 17);
  p.recolor(shadeHex(color, 0.35), (x, y) => x + y < 9);
  const ink = shadeHex(color, -0.55);
  if (mark === 'fire') {
    p.rect(7, 5, 2, 6, '#fff0a0');
    p.rect(6, 8, 4, 3, '#fff0a0');
  } else if (mark === 'water') {
    p.rect(7, 5, 2, 2, '#e8f8ff');
    p.rect(6, 7, 4, 4, '#e8f8ff');
  } else if (mark === 'moon') {
    // trăng khuyết sáng trên nền đá sẫm
    for (const [x, y, w] of [[7, 4, 3], [6, 5, 2], [5, 6, 2], [5, 7, 2], [5, 8, 2], [5, 9, 2], [6, 10, 2], [7, 11, 3]]) p.rect(x, y, w, 1, '#f0ecc0');
  } else if (mark === 'thunder') {
    for (const [x, y] of [[9, 4], [8, 5], [7, 6], [6, 7], [7, 8], [8, 8], [9, 9], [8, 10], [7, 11]]) p.set(x, y, ink);
  } else {
    p.rect(7, 4, 2, 8, '#e8ffd8');
    p.rect(5, 7, 6, 2, '#e8ffd8');
  }
  p.outline();
  return p.toCanvas();
}

function drawEverstone() {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 9, 6.5, 5, '#a8a8b0');
  p.recolor('#80808a', (x, y) => y > 10);
  p.rect(3, 8, 10, 1, '#f0f0f4');
  p.outline();
  return p.toCanvas();
}

function drawLeftovers() {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 9, 6, 6, '#e04838');
  p.ellipse(11, 9, 3, 4.5, '#f8e8b0');
  p.rect(7, 2, 2, 3, '#6a4a2a');
  p.set(5, 6, '#ff9a8a');
  p.outline();
  return p.toCanvas();
}

function drawLuckyEgg() {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 8.5, 5, 6.5, '#f8f4e8');
  p.recolor('#d8d0c0', (x, y) => x > 9 && y > 9);
  for (const [x, y] of [[6, 6], [9, 9], [6, 11], [10, 5]]) p.rect(x, y, 2, 2, '#e04858');
  p.outline();
  return p.toCanvas();
}

// Đồ tăng sức mạnh theo hệ: túi nhỏ buộc dây, màu theo hệ
function drawBooster(color) {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 10, 6, 5, color);
  p.rect(6, 3, 4, 3, color);
  p.rect(5, 5, 6, 1, '#e8c860');
  p.recolor(shadeHex(color, -0.3), (x, y) => x > 9 && y > 9);
  p.set(5, 8, shadeHex(color, 0.5));
  p.outline(-0.7);
  return p.toCanvas();
}

function drawBicycle() {
  const p = new PixelBuffer(16, 16);
  for (const cx of [4, 12]) {
    p.ellipse(cx, 11, 3.5, 3.5, '#303440');
    p.ellipse(cx, 11, 2, 2, null);
    p.set(cx, 11, '#a0a8b8');
  }
  for (const [x, y] of [[5, 10], [6, 9], [7, 8], [8, 8], [9, 9], [10, 10], [8, 9], [8, 10], [11, 7], [11, 6], [7, 7], [6, 6]]) p.set(x, y, '#e03838');
  p.rect(5, 5, 3, 1, '#303440');
  p.rect(10, 5, 3, 1, '#303440');
  return p.toCanvas();
}

// Rare Candy: viên kẹo xanh gói giấy, hai đầu xoắn
function drawRareCandy() {
  const p = new PixelBuffer(16, 16);
  for (const [x, flip] of [[1, 1], [12, -1]]) {
    p.rect(x, 6, 3, 4, '#d8e4ff');
    p.set(x + (flip > 0 ? 0 : 2), 5, '#d8e4ff');
    p.set(x + (flip > 0 ? 0 : 2), 10, '#d8e4ff');
  }
  p.ellipse(8, 8, 4.5, 4, '#5a8ae8');
  p.recolor('#3a62c0', (x, y) => x + y > 17);
  p.set(6, 6, '#ffffff');
  p.set(7, 6, '#c8dcff');
  p.outline(-0.5);
  return p.toCanvas();
}

// Đĩa HM: đĩa tròn màu theo hệ chiêu, lỗ giữa, vệt sáng
function drawDisc(color) {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 8, 6.5, 6.5, color);
  p.recolor(shadeHex(color, -0.3), (x, y) => x + y > 17);
  p.ellipse(8, 8, 1.6, 1.6, '#e8eef8');
  p.set(5, 4, '#ffffff');
  p.set(4, 5, '#ffffff');
  p.outline(-0.5);
  return p.toCanvas();
}

// Bản đồ vùng: tờ giấy gấp, có biển, đất liền và đường đi
function drawTownMap() {
  const p = new PixelBuffer(16, 16);
  p.rect(1, 3, 14, 10, '#e8d8a8');
  p.rect(1, 3, 4, 10, '#d8c490');
  p.rect(10, 3, 5, 10, '#d8c490');
  p.ellipse(8, 8, 3, 2.5, '#68b058');
  p.rect(11, 5, 3, 3, '#58a0e0');
  p.rect(3, 9, 9, 1, '#c04040');
  p.outline(-0.5);
  return p.toCanvas();
}

// Hộp huy hiệu: hộp đỏ có khoá vàng
function drawBadgeCase() {
  const p = new PixelBuffer(16, 16);
  p.rect(1, 4, 14, 9, '#a83a3a');
  p.rect(1, 4, 14, 2, '#c85050');
  p.rect(1, 8, 14, 1, '#7a2626');
  p.rect(7, 7, 2, 3, '#f0c030');
  p.outline(-0.5);
  return p.toCanvas();
}

// Gói hàng: hộp giấy buộc dây
function drawParcel() {
  const p = new PixelBuffer(16, 16);
  p.rect(2, 5, 12, 9, '#c89858');
  p.rect(2, 5, 12, 2, '#e0b878');
  p.rect(7, 5, 2, 9, '#8a5a30');
  p.rect(2, 9, 12, 1, '#8a5a30');
  p.rect(6, 3, 4, 2, '#8a5a30');
  p.outline(-0.5);
  return p.toCanvas();
}

// Phụ tùng xe đạp: xích, bánh xe, yên
function drawBikePart(part) {
  const p = new PixelBuffer(16, 16);
  if (part === 'bikeChain') {
    for (let i = 0; i < 6; i++) p.ellipse(3 + i * 2, 8 + (i % 2 ? 1 : -1), 1.6, 1.6, i % 2 ? '#8a90a0' : '#c8d0dc');
  } else if (part === 'bikeWheel') {
    p.ellipse(8, 8, 6.5, 6.5, '#303440');
    p.ellipse(8, 8, 5, 5, null);
    for (const [x, y] of [[8, 4], [8, 12], [4, 8], [12, 8], [8, 8], [6, 6], [10, 10], [10, 6], [6, 10]]) p.set(x, y, '#a0a8b8');
  } else {
    p.ellipse(8, 7, 6, 3, '#a83a2a');
    p.ellipse(7, 6, 3, 1.4, '#d86050');
    p.rect(7, 9, 2, 6, '#505868');
  }
  p.outline(-0.5);
  return p.toCanvas();
}

// Cầu chì: ống thuỷ tinh có dây chì, hai đầu kim loại
function drawFuse() {
  const p = new PixelBuffer(16, 16);
  p.rect(4, 5, 8, 6, '#c8e8f0');
  p.rect(5, 6, 6, 1, '#f0fcff');
  p.rect(4, 8, 8, 1, '#a07838');
  p.rect(1, 4, 3, 8, '#d8b040');
  p.rect(12, 4, 3, 8, '#d8b040');
  p.rect(1, 4, 3, 2, '#f0d878');
  p.rect(12, 4, 3, 2, '#f0d878');
  p.outline(-0.55);
  return p.toCanvas();
}

// Thú cưỡi: hình nhỏ của chính Pokémon chở (Arcanine / Lapras) kèm chiếc yên da nhỏ ở góc dưới phải, nhìn là biết thú nào.
// sprite: ảnh pixel 28x28 của loài (gfx/textures.js: pixelMon); thiếu thì chỉ vẽ yên
function drawMount(sprite) {
  const S = 32;
  const c = makeCanvas(S, S);
  const ctx = c.canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (sprite) ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height, 0, 0, 28, 28);
  // yên da: đệm nâu, viền tối, quai vàng
  const p = new PixelBuffer(12, 9);
  p.ellipse(6, 4, 5.5, 3.2, '#9a5a2a');
  p.ellipse(6, 3, 4, 1.8, '#c8844a');
  p.rect(2, 2, 2, 2, '#6a3a18');
  p.rect(5, 6, 2, 3, '#f0c040');
  p.outline(-0.55);
  p.drawTo(ctx, S - 13, S - 10);
  return c.canvas;
}

// Escape Rope: cuộn dây thừng
function drawRope() {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 9, 6.5, 5.5, '#c89858');
  p.ellipse(8, 9, 4, 3, '#a87838');
  p.ellipse(8, 9, 1.8, 1.4, null);
  for (const [x, y] of [[3, 7], [5, 5], [11, 5], [13, 8], [10, 13], [5, 12]]) p.set(x, y, '#e8c088');
  p.rect(12, 12, 3, 2, '#c89858');
  p.outline();
  return p.toCanvas();
}

// Cần câu: cán chéo, cuộn dây ở chuôi, dây và lưỡi câu thả xuống; màu cán theo loại cần
function drawRod(color) {
  const p = new PixelBuffer(16, 16);
  for (let i = 0; i < 12; i++) p.set(2 + i, 14 - i, i < 4 ? '#4a3a30' : color);
  for (let i = 0; i < 12; i++) p.set(3 + i, 14 - i, i < 4 ? '#2a2020' : shadeHex(color, -0.35));
  p.rect(4, 10, 3, 3, '#a0a8b8');
  for (let y = 3; y < 12; y++) p.set(14, y, '#d8e0f0');
  p.set(13, 12, '#c0c8d8');
  p.set(14, 12, '#c0c8d8');
  return p.toCanvas();
}

// Hoá thạch: Helix (vỏ ốc xoắn), Dome (mai vòm có gờ), Old Amber (hổ phách trong, có bóng côn trùng bên trong)
function drawFossil(id, color) {
  const p = new PixelBuffer(16, 16);
  const dark = shadeHex(color, -0.35);
  const light = shadeHex(color, 0.35);
  if (id === 'helixFossil') {
    p.ellipse(8, 8.5, 6.5, 6, color);
    p.recolor(dark, (x, y) => x + y > 18);
    // Đường xoắn ốc từ ngoài vào tâm
    for (const [x, y] of [[4, 6], [5, 5], [6, 4], [8, 4], [10, 5], [11, 7], [11, 9], [10, 11], [8, 12], [6, 11], [5, 9], [6, 7], [8, 7], [9, 8], [9, 9], [8, 10], [7, 9]]) p.set(x, y, dark);
    p.set(5, 4, light);
    p.set(4, 5, light);
  } else if (id === 'domeFossil') {
    p.ellipse(8, 11, 7, 7.5, color, (x, y) => y <= 12);
    p.rect(2, 12, 12, 2, dark);
    p.recolor(dark, (x, y) => x > 10 && y > 7);
    // Gờ dọc giữa mai và hai rãnh cong hai bên
    for (let y = 5; y <= 11; y++) p.set(8, y, dark);
    for (const [x, y] of [[5, 7], [5, 8], [4, 10], [11, 7], [11, 8], [12, 10]]) p.set(x, y, dark);
    p.set(6, 5, light);
    p.set(5, 6, light);
  } else {
    // Khối hổ phách góc cạnh, trong suốt, nhìn thấy cánh côn trùng nhỏ bên trong
    p.ellipse(8, 8.5, 6, 6.5, color);
    p.recolor(dark, (x, y) => x + y > 18);
    p.recolor(light, (x, y) => x + y < 10);
    p.rect(7, 7, 2, 4, '#6a3a10');
    p.set(6, 8, '#8a5020');
    p.set(9, 8, '#8a5020');
    p.set(5, 7, '#8a5020');
    p.set(10, 7, '#8a5020');
    p.set(5, 4, '#fff4d0');
    p.set(4, 5, '#fff4d0');
  }
  p.outline();
  return p.toCanvas();
}

// Master Ball 96x96 (cùng cỡ với ảnh SVG của Poké Ball / Great Ball / Ultra Ball để BattleScene cắt đôi nắp bóng khi ném):
// nửa trên tím có hai chấm hồng và chữ M trắng, đai đen, nửa dưới trắng, nút giữa trắng. Vẽ theo khung 64x64 như file SVG
function drawMasterBall() {
  const S = 96;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  ctx.scale(S / 64, S / 64);
  const ink = '#222';
  const fill = (path, style) => {
    ctx.fillStyle = style;
    ctx.fill(path);
  };
  const grad = (stops) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  };
  const ball = new Path2D();
  ball.arc(32, 32, 29, 0, Math.PI * 2);
  fill(ball, grad([[0, '#ffffff'], [1, '#cfd2dc']]));
  ctx.lineWidth = 4;
  ctx.strokeStyle = ink;
  ctx.stroke(ball);
  const top = new Path2D();
  top.moveTo(3, 32);
  top.arc(32, 32, 29, Math.PI, 0);
  top.closePath();
  fill(top, grad([[0, '#9a5ad8'], [0.5, '#6a2ab0']]));
  ctx.lineJoin = 'round';
  ctx.stroke(top);
  // Hai chấm hồng hai bên và chữ M trắng giữa nửa trên (cắt trong lòng bóng)
  ctx.save();
  const inner = new Path2D();
  inner.arc(32, 32, 27, Math.PI, 0);
  inner.closePath();
  ctx.clip(inner);
  for (const x of [14, 50]) {
    const dot = new Path2D();
    dot.ellipse(x, 18, 6.5, 7.5, 0, 0, Math.PI * 2);
    fill(dot, '#f070b8');
    const shine = new Path2D();
    shine.ellipse(x - 1.5, 15.5, 2.2, 2.6, 0, 0, Math.PI * 2);
    fill(shine, '#ffc8e8');
  }
  const m = new Path2D('M24 22 L24 9 L28 9 L32 15 L36 9 L40 9 L40 22 L36.5 22 L36.5 15 L32 21 L27.5 15 L27.5 22 Z');
  fill(m, '#ffffff');
  ctx.restore();
  ctx.fillStyle = ink;
  ctx.fillRect(3, 29, 58, 6);
  const button = new Path2D();
  button.arc(32, 32, 10, 0, Math.PI * 2);
  fill(button, '#ffffff');
  ctx.stroke(button);
  const knob = new Path2D();
  knob.arc(32, 32, 4.5, 0, Math.PI * 2);
  fill(knob, '#eceef4');
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#9a9aa8';
  ctx.stroke(knob);
  return c;
}

// Huy hiệu gym 16x16: hình thoi có đôi cánh, màu theo huy hiệu
export function makeItemIcons(scene, monSprite = () => null) {
  for (const badge of BADGES.filter(Boolean)) addCanvasTexture(scene, `badge-${badge.id}`, drawBadgeShape(badge.id, badge.color));
  addCanvasTexture(scene, ITEMS.escapeRope.icon, drawRope());
  for (const rod of ['oldRod', 'goodRod', 'superRod']) addCanvasTexture(scene, ITEMS[rod].icon, drawRod(ITEMS[rod].color));
  for (const [id, item] of Object.entries(ITEMS)) {
    let canvas = null;
    if (item.kind === 'evolution') canvas = drawStone(item.color, id.replace('Stone', ''));
    else if (item.held === 'boost') canvas = drawBooster(item.color);
    if (canvas) addCanvasTexture(scene, item.icon, canvas);
  }
  addCanvasTexture(scene, ITEMS.everstone.icon, drawEverstone());
  addCanvasTexture(scene, ITEMS.leftovers.icon, drawLeftovers());
  addCanvasTexture(scene, ITEMS.luckyEgg.icon, drawLuckyEgg());
  addCanvasTexture(scene, ITEMS.bicycle.icon, drawBicycle());
  addCanvasTexture(scene, ITEMS.martParcel.icon, drawParcel());
  addCanvasTexture(scene, ITEMS.townMap.icon, drawTownMap());
  addCanvasTexture(scene, ITEMS.hmSurf.icon, drawDisc(ITEMS.hmSurf.color));
  addCanvasTexture(scene, ITEMS.badgeCase.icon, drawBadgeCase());
  addCanvasTexture(scene, ITEMS.rareCandy.icon, drawRareCandy());
  for (const part of ['bikeChain', 'bikeWheel', 'bikeSeat']) addCanvasTexture(scene, ITEMS[part].icon, drawBikePart(part));
  addCanvasTexture(scene, ITEMS.fuse.icon, drawFuse());
  for (const id of ['arcanineMount', 'laprasMount']) addCanvasTexture(scene, ITEMS[id].icon, drawMount(monSprite(ITEMS[id].species)));
  for (const id of ['helixFossil', 'domeFossil', 'oldAmber']) addCanvasTexture(scene, ITEMS[id].icon, drawFossil(id, ITEMS[id].color));
  // Bóng vẽ mịn như ảnh SVG của các loại bóng khác: lọc tuyến tính khi thu nhỏ (không để răng cưa như pixel art)
  addCanvasTexture(scene, ITEMS.masterBall.icon, drawMasterBall()).setFilter(FILTER_LINEAR);
}
