import { PixelBuffer, addCanvasTexture } from './pixel.js';

// Đồ vật câu đố trong gym, pixel art 16x16: cổng tre (Gym Lúa Vàng), hàng rào điện (Gym Đèn Lồng), công tắc

// Cổng tre: các thanh tre dọc buộc dây ngang
function drawGate() {
  const p = new PixelBuffer(16, 16);
  for (const x of [1, 5, 9, 13]) {
    p.rect(x, 1, 3, 15, '#c8b050');
    p.rect(x + 2, 1, 1, 15, '#988030');
    p.rect(x, 5, 3, 1, '#988030');
    p.rect(x, 11, 3, 1, '#988030');
  }
  p.rect(0, 3, 16, 2, '#7a5a30');
  p.rect(0, 12, 16, 2, '#7a5a30');
  p.outline(-0.6);
  return p.toCanvas();
}

// Hàng rào điện: hai cột kim loại, tia điện vàng chạy ngang
function drawBarrier() {
  const p = new PixelBuffer(16, 16);
  p.rect(0, 2, 3, 14, '#5a6070');
  p.rect(13, 2, 3, 14, '#5a6070');
  p.rect(1, 2, 1, 14, '#9aa0b0');
  p.rect(14, 2, 1, 14, '#9aa0b0');
  for (const y of [4, 8, 12]) {
    for (let x = 3; x < 13; x++) p.set(x, y + ((x + y) % 3 === 0 ? -1 : (x + y) % 3 === 1 ? 1 : 0), '#fff070');
  }
  return p.toCanvas();
}

// Công tắc nền: tấm đá tròn, bật thì nút giữa sáng lên
function drawSwitch(on) {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 9, 6.5, 5, '#7a8090');
  p.ellipse(8, 8.5, 5, 3.8, '#a8b0c0');
  p.ellipse(8, 8.5, 2.6, 2, on ? '#f8e048' : '#d04848');
  p.set(7, 7, on ? '#fffbd0' : '#f08888');
  p.outline(-0.5);
  return p.toCanvas();
}

// Cửa phong ấn (Liên minh): màn năng lượng tím chắn cửa, mở khi thắng Thiên Vương trong phòng
function drawSeal() {
  const p = new PixelBuffer(16, 16);
  p.rect(0, 0, 2, 16, '#5a3088');
  p.rect(14, 0, 2, 16, '#5a3088');
  for (let y = 1; y < 15; y++) {
    for (let x = 2; x < 14; x++) if ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) p.set(x, y, y % 3 ? '#c898f8' : '#f0d8ff');
  }
  return p.toCanvas();
}

// Cửa cống (Gym Sông Nước): khung gỗ, tấm ván chắn dòng nước
function drawSluice() {
  const p = new PixelBuffer(16, 16);
  p.rect(0, 0, 3, 16, '#6a4a28');
  p.rect(13, 0, 3, 16, '#6a4a28');
  p.rect(3, 2, 10, 13, '#a87a48');
  for (const y of [5, 9, 13]) p.rect(3, y, 10, 1, '#7a5430');
  p.rect(5, 0, 6, 2, '#8a8a98');
  p.outline(-0.6);
  return p.toCanvas();
}

// Cột đèn lồng (Gym Đèn Lồng): cột gỗ, lồng đèn đỏ; thắp thì sáng vàng
function drawLantern(lit) {
  const p = new PixelBuffer(16, 24);
  p.rect(7, 10, 2, 13, '#5a3a20');
  p.rect(5, 21, 6, 2, '#3a2414');
  p.rect(6, 1, 4, 1, '#3a2414');
  p.ellipse(8, 6, 4.5, 4.5, lit ? '#f84838' : '#7a2420');
  p.rect(5, 2, 6, 1, '#d8a840');
  p.rect(5, 10, 6, 1, '#d8a840');
  if (lit) {
    p.ellipse(8, 6, 2.5, 3, '#ffd860');
    p.ellipse(8, 6, 1, 1.5, '#ffffff');
  } else {
    p.rect(7, 4, 2, 4, '#4a1818');
  }
  p.outline(-0.6);
  return p.toCanvas();
}

// Tảng đá đẩy được (Gym Núi Đá); lấp hố thì thành mặt đá phẳng lún xuống
function drawPushRock() {
  // Khối đá vuông màu cát (khác hẳn đá tròn xám cố định), cạnh bo, vết nứt và mặt trên sáng: nhìn là biết đẩy được
  const p = new PixelBuffer(16, 16);
  p.rect(1, 3, 14, 12, '#b08858');
  p.rect(2, 2, 12, 14, '#b08858');
  p.rect(2, 3, 12, 5, '#d8b07a');
  p.rect(3, 2, 10, 1, '#e8c890');
  p.recolor('#8a6a40', (x, y) => y >= 12);
  for (const [x, y] of [[5, 8], [6, 9], [6, 10], [7, 11], [11, 6], [10, 7], [10, 8]]) p.set(x, y, '#6a4a28');
  p.outline(-0.6);
  return p.toCanvas();
}
function drawFilledHole() {
  const p = new PixelBuffer(16, 16);
  p.ellipse(8, 8.5, 7.5, 7, '#5a4a3c');
  p.ellipse(8, 9, 6, 5.5, '#8a7460');
  p.ellipse(6.5, 7.5, 2, 1.5, '#a8927a');
  return p.toCanvas();
}

// Lửa phụt từ miệng lò (Gym Lò Gốm), 2 khung lửa nhảy
function drawVentFire(frame) {
  const p = new PixelBuffer(16, 24);
  const sway = frame ? 1 : -1;
  p.ellipse(8, 18, 6, 5, '#e84a20');
  p.ellipse(8 + sway, 12, 4.5, 7, '#f87828');
  p.ellipse(8 - sway, 7, 2.5, 5, '#f8b040');
  p.ellipse(8, 15, 3, 4, '#ffd860');
  p.ellipse(8, 17, 1.5, 2, '#fff8d0');
  return p.toCanvas();
}

export function makeGymObjects(scene) {
  addCanvasTexture(scene, 'obj-sluice', drawSluice());
  addCanvasTexture(scene, 'obj-lantern', drawLantern(false));
  addCanvasTexture(scene, 'obj-lantern-lit', drawLantern(true));
  addCanvasTexture(scene, 'obj-pushrock', drawPushRock());
  addCanvasTexture(scene, 'obj-hole-filled', drawFilledHole());
  addCanvasTexture(scene, 'obj-ventfire-0', drawVentFire(0));
  addCanvasTexture(scene, 'obj-ventfire-1', drawVentFire(1));
  // vệt sáng tròn (xoá bóng tối quanh đèn lồng / người chơi trong gym tối)
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  if (!scene.textures.exists('fx-light')) scene.textures.addCanvas('fx-light', c);
  addCanvasTexture(scene, 'obj-seal', drawSeal());
  addCanvasTexture(scene, 'obj-gate', drawGate());
  addCanvasTexture(scene, 'obj-barrier', drawBarrier());
  addCanvasTexture(scene, 'obj-switch', drawSwitch(false));
  addCanvasTexture(scene, 'obj-switch-on', drawSwitch(true));
}
