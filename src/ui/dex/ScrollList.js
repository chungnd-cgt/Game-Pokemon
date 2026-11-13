import Phaser from 'phaser';

// Vùng cuộn có mặt nạ (Pokédex: danh sách chiêu thức, nơi xuất hiện): nội dung dài hơn khung thì cuộn bằng con lăn,
// thanh cuộn mảnh ở mép phải (chừa 10px bên phải cho thanh cuộn khi đặt nội dung).
export class ScrollList {
  constructor(scene, x, y, w, h) {
    Object.assign(this, { scene, x, y, w, h, offset: 0, contentH: 0 });
    this.content = scene.add.container(x, y);
    this.shape = scene.make.graphics({ x: 0, y: 0 }, false);
    this.shape.fillStyle(0xffffff);
    this.shape.fillRect(x, y, w, h);
    this.content.setMask(this.shape.createGeometryMask());
    this.bar = scene.add.graphics();
    scene.events.once('shutdown', () => this.shape.destroy());
  }

  contains(px, py) {
    return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h;
  }

  clear() {
    this.content.removeAll(true);
    this.contentH = 0;
    this.scrollTo(0);
  }

  add(obj) {
    this.content.add(obj);
    return obj;
  }

  setContentHeight(h) {
    this.contentH = h;
    this.scrollTo(0);
  }

  scrollBy(dy) {
    this.scrollTo(this.offset + dy);
  }

  scrollTo(offset) {
    this.offset = Phaser.Math.Clamp(offset, 0, Math.max(0, this.contentH - this.h));
    this.content.y = this.y - this.offset;
    this.drawBar();
  }

  setVisible(visible) {
    this.content.setVisible(visible);
    this.bar.setVisible(visible);
  }

  drawBar() {
    const g = this.bar;
    g.clear();
    if (this.contentH <= this.h) return;
    const x = this.x + this.w - 5;
    const thumbH = Math.max(20, (this.h * this.h) / this.contentH);
    const thumbY = this.y + (this.h - thumbH) * (this.offset / (this.contentH - this.h));
    g.fillStyle(0xdde3ee);
    g.fillRoundedRect(x, this.y, 5, this.h, 2.5);
    g.fillStyle(0x8a94b4);
    g.fillRoundedRect(x, thumbY, 5, thumbH, 2.5);
  }
}

// Rút ngắn chữ bằng "…" cho vừa độ rộng maxW (dùng chung ui/helpers.js)
export { fitText } from '../helpers.js';
