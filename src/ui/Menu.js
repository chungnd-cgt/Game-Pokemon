import Phaser from 'phaser';
import { fitScale } from '../gfx/textures.js';
import { COLORS, drawHpBar, drawPanel, fixToCamera, shade, textStyle } from './helpers.js';
import { directionOf, isCancel, isConfirm } from './input.js';

function drawButtonTray(scene, x, y, w, h) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(x + 3, y + 6, w, h, 18);
  g.fillStyle(0x27304a);
  g.fillRoundedRect(x, y, w, h, 18);
  g.lineStyle(3, 0x4a5878);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 14);
  return g;
}

// Menu chọn bằng phím mũi tên + Enter, hoặc bằng chuột. open() trả về value của mục
// được chọn, hoặc null nếu huỷ.
//  variant 'list'    : danh sách trong khung trắng (mục có `mon` hiển thị như thẻ Pokémon)
//  variant 'buttons' : nút màu kiểu Gen 5 (mục cần `color`, có thể có `sub`)
export class Menu {
  constructor(scene, router, opts) {
    const { x, y, width, height, items, title, onChange } = opts;
    this.scene = scene;
    this.router = router;
    this.items = items;
    this.columns = opts.columns ?? 1;
    this.cancelable = opts.cancelable ?? true;
    this.onChange = onChange;
    this.variant = opts.variant ?? 'list';
    this.bounds = new Phaser.Geom.Rectangle(x, y, width, height);
    this.container = scene.add.container(0, 0).setDepth(opts.depth ?? 20);

    const buttons = this.variant === 'buttons';
    const pad = buttons ? 14 : 18;
    const gap = buttons ? 12 : 6;
    this.container.add(buttons ? drawButtonTray(scene, x, y, width, height) : drawPanel(scene, x, y, width, height));

    let top = y + pad;
    if (title) {
      this.container.add(scene.add.text(x + 30, top + 2, title, textStyle(26, '#3a4660', { fontStyle: 'bold' })));
      top += 46;
    }
    const rows = Math.ceil(items.length / this.columns);
    const cellW = (width - pad * 2 - gap * (this.columns - 1)) / this.columns;
    const cellH = opts.rowHeight ?? (y + height - pad - top - gap * (rows - 1)) / rows;

    this.cells = items.map((item, i) => {
      const col = i % this.columns;
      const row = Math.floor(i / this.columns);
      const cell = scene.add.container(
        x + pad + col * (cellW + gap) + cellW / 2,
        top + row * (cellH + gap) + cellH / 2,
      );
      const bg = scene.add.graphics();
      cell.add(bg);
      this.renderContent(cell, item, cellW, cellH);
      const hit = scene.add.zone(0, 0, cellW, cellH).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.select(i));
      hit.on('pointerdown', () => {
        this.select(i);
        this.confirm();
      });
      cell.add(hit);
      this.container.add(cell);
      return { cell, bg, w: cellW, h: cellH };
    });

    this.cells.forEach((_, i) => this.drawCell(i, false));
    this.index = -1;
    this.select(Phaser.Math.Clamp(opts.index ?? 0, 0, items.length - 1));
    if (opts.fixed) fixToCamera(this.container);
  }

  renderContent(cell, item, w, h) {
    const { scene } = this;
    if (this.variant === 'buttons') {
      const stroke = { stroke: item.disabled ? '#6a7078' : `#${shade(item.color, -55).toString(16).padStart(6, '0')}`, strokeThickness: 6 };
      cell.add(scene.add.text(0, item.sub ? -10 : 0, item.label, textStyle(28, '#ffffff', { fontStyle: 'bold', ...stroke })).setOrigin(0.5));
      if (item.sub) cell.add(scene.add.text(0, 20, item.sub, textStyle(17, '#ffffff', { ...stroke, strokeThickness: 4 })).setOrigin(0.5));
      return;
    }

    const left = -w / 2;
    if (item.mon) {
      const mon = item.mon;
      const key = `mon-${mon.speciesId}`;
      cell.add(scene.add.image(left + 44, 0, key).setScale(fitScale(scene, key, 56)).setAlpha(mon.hp > 0 ? 1 : 0.45));
      cell.add(scene.add.text(left + 86, -h / 2 + 8, mon.name, textStyle(24, COLORS.text, { fontStyle: 'bold' })));
      const tag = item.tag ? `   ${item.tag}` : '';
      cell.add(scene.add.text(left + 86, h / 2 - 28, `Lv${mon.level}${tag}`, textStyle(18, item.tagColor ?? '#6a7286')));
      const g = scene.add.graphics();
      drawHpBar(g, w / 2 - 250, -16, 230, mon.hp / mon.maxHp);
      cell.add(g);
      cell.add(scene.add.text(w / 2 - 22, 9, `${mon.hp}/${mon.maxHp}`, textStyle(18, '#4a5266')).setOrigin(1, 0));
      return;
    }
    let textX = left + 44;
    if (item.icon) {
      cell.add(scene.add.image(left + 58, 0, item.icon).setScale(fitScale(scene, item.icon, Math.min(40, h - 8))).setAlpha(item.disabled ? 0.5 : 1));
      textX = left + 88;
    }
    cell.add(scene.add.text(textX, 0, item.label, textStyle(item.fontSize ?? 26, item.disabled ? '#a0a6b0' : COLORS.text)).setOrigin(0, 0.5));
    if (item.sub) cell.add(scene.add.text(w / 2 - 18, 0, item.sub, textStyle(22, '#6a7286')).setOrigin(1, 0.5));
  }

  drawCell(i, selected) {
    const { bg, cell, w, h } = this.cells[i];
    const item = this.items[i];
    bg.clear();
    if (this.variant === 'buttons') {
      const base = item.disabled ? 0x9aa0a8 : item.color;
      bg.fillStyle(shade(base, -40));
      bg.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 16);
      bg.fillStyle(base);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
      bg.fillStyle(0xffffff, 0.25);
      bg.fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, h * 0.4, 10);
      if (selected) {
        bg.lineStyle(4, 0xffffff);
        bg.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 9, 17);
      }
      cell.setScale(selected ? 1.05 : 1);
      return;
    }
    if (selected) {
      bg.fillStyle(0xdbe8ff);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(2, 0x7aa0e0);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.fillStyle(0xe04848);
      bg.fillTriangle(-w / 2 + 12, -9, -w / 2 + 12, 9, -w / 2 + 26, 0);
    }
  }

  open() {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set(
        (e) => this.handleKey(e),
        (p) => {
          if (this.cancelable && (p.rightButtonDown() || !this.bounds.contains(p.x, p.y))) this.finish(null);
        },
      );
    });
  }

  select(i) {
    if (i === this.index) return;
    if (this.index >= 0) this.drawCell(this.index, false);
    this.index = i;
    this.drawCell(i, true);
    this.onChange?.(this.items[i], i);
  }

  handleKey(e) {
    const i = this.index;
    const c = this.columns;
    const n = this.items.length;
    switch (directionOf(e)) {
      case 'left': if (i % c > 0) this.select(i - 1); return;
      case 'right': if (i % c < c - 1 && i + 1 < n) this.select(i + 1); return;
      case 'up': if (i - c >= 0) this.select(i - c); return;
      case 'down': if (i + c < n) this.select(i + c); return;
    }
    if (isConfirm(e)) this.confirm();
    else if (isCancel(e) && this.cancelable) this.finish(null);
  }

  confirm() {
    const item = this.items[this.index];
    if (!item.disabled) this.finish(item.value);
  }

  finish(value) {
    if (this.done) return;
    this.done = true;
    this.router.clear();
    this.container.destroy();
    this.resolve?.(value);
  }
}
