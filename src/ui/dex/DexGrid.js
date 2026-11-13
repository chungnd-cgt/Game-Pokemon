import Phaser from 'phaser';
import { dexNo } from '../../data/pokedex.js';
import { dexStatus } from '../../game/state.js';
import { fitScale, pixelMon } from '../../gfx/textures.js';
import { textStyle } from '../helpers.js';

export const GRID_COLS = 5;
export const GRID_ROWS = 7; // số hàng hiện cùng lúc
const CELL = 70;
const PITCH = 74;

// Lưới ô Pokémon của Pokédex (nửa trái). Chỉ có GRID_ROWS x GRID_COLS ô dựng sẵn, cuộn thì đổi nội dung ô
// (danh sách dài bao nhiêu cũng mở ngay). Ô: số thứ tự, hình nhỏ (chưa gặp: bóng đen), dấu Poké Ball nếu đã bắt.
// onPick(index trong list) khi bấm vào ô.
export class DexGrid {
  constructor(scene, x, y, onPick) {
    Object.assign(this, { scene, x, y, onPick, list: [], selected: -1, top: 0 });
    this.w = GRID_COLS * PITCH - (PITCH - CELL);
    this.h = GRID_ROWS * PITCH - (PITCH - CELL);
    this.cells = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cx = x + c * PITCH;
        const cy = y + r * PITCH;
        const bg = scene.add.graphics();
        const img = scene.add.image(cx + CELL / 2, cy + CELL / 2 + 5, '__DEFAULT').setVisible(false);
        const num = scene.add.text(cx + 6, cy + 4, '', textStyle(12, '#8a92a6', { fontStyle: 'bold' }));
        const ball = scene.add.image(cx + CELL - 11, cy + 11, 'ball').setDisplaySize(14, 14);
        const hit = scene.add.zone(cx + CELL / 2, cy + CELL / 2, CELL, CELL).setInteractive({ useHandCursor: true });
        const cell = { cx, cy, bg, img, num, ball, hit, slot: r * GRID_COLS + c, hover: false };
        hit.on('pointerdown', () => {
          const i = this.top * GRID_COLS + cell.slot;
          if (i < this.list.length) this.onPick(i);
        });
        hit.on('pointerover', () => {
          cell.hover = true;
          this.drawCell(cell);
        });
        hit.on('pointerout', () => {
          cell.hover = false;
          this.drawCell(cell);
        });
        this.cells.push(cell);
      }
    }
    // Thanh cuộn: bấm / kéo trên rãnh để cuộn nhanh
    this.barX = x + this.w + 8;
    this.bar = scene.add.graphics();
    const track = scene.add.zone(this.barX + 3, y + this.h / 2, 18, this.h).setInteractive({ useHandCursor: true });
    const dragTo = (p) => {
      const rows = this.maxTop();
      if (rows > 0) this.scrollTo(Math.round(((p.y - y) / this.h) * rows));
    };
    track.on('pointerdown', dragTo);
    track.on('pointermove', (p) => p.isDown && dragTo(p));
  }

  get rowCount() {
    return Math.ceil(this.list.length / GRID_COLS);
  }

  maxTop() {
    return Math.max(0, this.rowCount - GRID_ROWS);
  }

  contains(px, py) {
    return px >= this.x && px < this.barX + 12 && py >= this.y && py < this.y + this.h;
  }

  setList(list) {
    this.list = list;
    this.top = Phaser.Math.Clamp(this.top, 0, this.maxTop());
  }

  setSelected(i) {
    this.selected = i;
  }

  // Cuộn tới khi ô i nằm trong khung; center: đặt hàng của ô ở giữa
  reveal(i, center = false) {
    const row = Math.floor(i / GRID_COLS);
    if (center) this.top = row - Math.floor(GRID_ROWS / 2);
    else if (row < this.top) this.top = row;
    else if (row >= this.top + GRID_ROWS) this.top = row - GRID_ROWS + 1;
    this.top = Phaser.Math.Clamp(this.top, 0, this.maxTop());
  }

  scrollTo(top) {
    const next = Phaser.Math.Clamp(top, 0, this.maxTop());
    if (next === this.top) return;
    this.top = next;
    this.render();
  }

  render() {
    for (const cell of this.cells) this.drawCell(cell);
    const g = this.bar;
    g.clear();
    g.fillStyle(0xdde3ee);
    g.fillRoundedRect(this.barX, this.y, 6, this.h, 3);
    const rows = this.rowCount;
    if (rows > GRID_ROWS) {
      const thumbH = Math.max(28, (this.h * GRID_ROWS) / rows);
      g.fillStyle(0x8a94b4);
      g.fillRoundedRect(this.barX, this.y + (this.h - thumbH) * (this.top / this.maxTop()), 6, thumbH, 3);
    }
  }

  drawCell(cell) {
    const i = this.top * GRID_COLS + cell.slot;
    const p = this.list[i];
    const { bg, img, num, ball, cx, cy } = cell;
    bg.clear();
    cell.hit.input.enabled = Boolean(p);
    if (!p) {
      img.setVisible(false);
      num.setText('');
      ball.setVisible(false);
      return;
    }
    const status = dexStatus(p.id);
    const known = status !== 'unknown';
    const selected = i === this.selected;
    bg.fillStyle(selected ? 0xfff3cf : known ? 0xf3f6fb : 0xe4e8f0);
    bg.fillRoundedRect(cx, cy, CELL, CELL, 10);
    if (selected) {
      bg.lineStyle(3, 0xf0a020);
      bg.strokeRoundedRect(cx + 1.5, cy + 1.5, CELL - 3, CELL - 3, 9);
    } else {
      bg.lineStyle(2, cell.hover ? 0x8aa0d0 : 0xd2dbea);
      bg.strokeRoundedRect(cx + 1, cy + 1, CELL - 2, CELL - 2, 9);
    }
    const key = pixelMon(this.scene, p.slug);
    img.setTexture(key).setScale(fitScale(this.scene, key, 52)).setVisible(true);
    if (known) img.clearTint().setAlpha(1);
    else img.setTintFill(0x232836).setAlpha(0.75);
    num.setText(dexNo(p.id)).setColor(selected ? '#b07010' : known ? '#6a7286' : '#9aa2b4');
    ball.setVisible(status === 'caught');
  }
}
