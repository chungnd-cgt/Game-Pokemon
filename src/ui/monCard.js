import { textStyle } from './helpers.js';

// Phần dùng chung của bảng chi tiết Pokémon (ui/MonDetail.js) và bảng xem nhanh khi gửi PC (ui/CatchPreview.js):
//  - Nền cửa sổ xám xanh, các mục (Kinh nghiệm, Đặc tính, Tính cách, OT, Chiêu thức, chỉ số...) là ô nền đen
//  - Dải tiêu đề mục: ngắn, đuôi cắt xéo, phía trước có một lát mỏng xéo theo

export const CARD = {
  frame: 0x323d5e, // nền cửa sổ
  head: 0x1b2338, // dải tiêu đề cửa sổ
  edge: 0x4a5a86,
  section: 0x10151f, // ô mục
  sectionEdge: 0x2a3454,
  strip: 0x2c3758,
  text: '#e8ecf6',
  label: '#8a96b8',
  gold: '#ffd860',
  up: '#58d878',
  down: '#f07060',
};
export const STRIP_H = 17;

// Ô mục nền đen
export function section(g, x, y, w, h) {
  g.fillStyle(CARD.section);
  g.fillRoundedRect(x, y, w, h, 6);
  g.lineStyle(1, CARD.sectionEdge);
  g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 6);
}

// Dải tiêu đề mục: dài vừa chữ (tối đa maxW), đuôi phải cắt xéo + một lát mỏng xéo phía trước. add(o): thêm vào bảng
export function strip(scene, add, x, y, maxW, label) {
  const t = scene.add.text(x + 7, y + STRIP_H / 2, label, textStyle(11, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5);
  const len = Math.min(maxW - 16, Math.max(t.width + 26, maxW * 0.55));
  const g = scene.add.graphics();
  const k = 8; // độ xéo
  g.fillStyle(CARD.strip);
  g.fillPoints([{ x, y }, { x: x + len, y }, { x: x + len - k, y: y + STRIP_H }, { x, y: y + STRIP_H }], true);
  g.fillPoints([{ x: x + len + 4, y }, { x: x + len + 9, y }, { x: x + len + 9 - k, y: y + STRIP_H }, { x: x + len + 4 - k, y: y + STRIP_H }], true);
  add(g);
  add(t);
  return len;
}
