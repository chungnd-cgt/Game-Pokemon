import Phaser from 'phaser';
import { dexNo } from '../../data/pokedex.js';
import { dexStatus } from '../../game/state.js';
import { fitScale, pixelMon } from '../../gfx/textures.js';
import { textStyle } from '../helpers.js';
import { DEX_COLORS as C } from './theme.js';

export const GRID_COLS = 4;
export const GRID_ROWS = 7; // số hàng hiện cùng lúc
const CELL = 44;
const PITCH = 48;
const MON_SIZE = 28; // cạnh dài nhất của hình Pokémon trong ô
export const GRID_H = GRID_ROWS * PITCH - (PITCH - CELL); // chiều cao lưới

// Lưới ô Pokémon của Pokédex (cột trái). Chỉ có GRID_ROWS x GRID_COLS ô dựng sẵn, cuộn thì đổi nội dung ô
// (danh sách dài bao nhiêu cũng mở ngay). Ô: số thứ tự (góc trên trái), hình nhỏ (chưa gặp: bóng đen), Poké Ball nhỏ ở góc
// dưới phải nếu đã bắt. onPick(index trong list) khi bấm vào ô.
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
        const num = scene.add.text(cx + 4, cy + 3, '', textStyle(9, '#9fb2d6', { fontStyle: 'bold' }));
        const ball = scene.add.image(cx + CELL - 7, cy + CELL - 7, 'ball').setDisplaySize(10, 10);
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
    this.barX = x + this.w + 5;
    this.bar = scene.add.graphics();
    const track = scene.add.zone(this.barX + 2, y + this.h / 2, 14, this.h).setInteractive({ useHandCursor: true });
    // toLocal(p): toạ độ con trỏ trong khung thiết kế (cửa sổ nổi đã kéo dời: ui/dex/DexWindow.js)
    const dragTo = (p) => {
      const rows = this.maxTop();
      const py = this.toLocal ? this.toLocal(p).y : p.y;
      if (rows > 0) this.scrollTo(Math.round(((py - y) / this.h) * rows));
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
    return px >= this.x && px < this.barX + 10 && py >= this.y && py < this.y + this.h;
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
    g.fillStyle(C.track);
    g.fillRoundedRect(this.barX, this.y, 5, this.h, 2.5);
    const rows = this.rowCount;
    if (rows > GRID_ROWS) {
      const thumbH = Math.max(24, (this.h * GRID_ROWS) / rows);
      g.fillStyle(C.thumb);
      g.fillRoundedRect(this.barX, this.y + (this.h - thumbH) * (this.top / this.maxTop()), 5, thumbH, 2.5);
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
    bg.fillStyle(selected ? 0x2c5482 : known ? 0x22355a : 0x162440, selected ? 0.9 : 0.75);
    bg.fillRoundedRect(cx, cy, CELL, CELL, 7);
    bg.lineStyle(selected ? 2 : 1.5, selected ? C.accent : cell.hover ? 0x6a8ac0 : C.line);
    bg.strokeRoundedRect(cx + 1, cy + 1, CELL - 2, CELL - 2, 6);
    const key = pixelMon(this.scene, p.slug);
    img.setTexture(key).setScale(fitScale(this.scene, key, MON_SIZE)).setVisible(true);
    if (known) img.clearTint().setAlpha(1);
    else img.setTintFill(0x070b16).setAlpha(0.8);
    num.setText(dexNo(p.id)).setColor(selected ? '#ffffff' : known ? '#9fb2d6' : '#5e7096');
    ball.setVisible(status === 'caught');
  }
}
