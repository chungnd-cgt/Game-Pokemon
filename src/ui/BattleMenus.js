import Phaser from 'phaser';
import { fitScale } from '../gfx/textures.js';
import { cssColor, shade, textStyle } from './helpers.js';
import { directionOf, isCancel, isConfirm } from './input.js';

// Giao diện trong trận kiểu MMO: khay nút lớn (ButtonGrid: bảng lệnh 2x2 có icon, bảng chiêu theo màu hệ).
// Icon lệnh vẽ bằng code (commandIcons)

const OUTLINE = 0x1e2a44;
const TRAY = 0x1b2338;
const TRAY_EDGE = 0x3d4c72;
const GOLD = 0xffd860;

// ---------- Icon lệnh (vẽ một lần, 64x64) ----------

function starPoints(cx, cy, outer, inner, n, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

const ICONS = {
  // Chiến đấu: tia nổ cam, lõi vàng
  'cmd-fight': (g) => {
    g.fillStyle(OUTLINE);
    g.fillPoints(starPoints(32, 32, 31, 15, 10, -Math.PI / 2 + 0.15), true);
    g.fillStyle(0xff7a2a);
    g.fillPoints(starPoints(32, 32, 27, 12.5, 10, -Math.PI / 2 + 0.15), true);
    g.fillStyle(0xffe066);
    g.fillPoints(starPoints(32, 32, 16, 8, 8, -Math.PI / 2), true);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(29, 29, 4);
  },
  // Pokémon: Poké Ball
  'cmd-ball': (g) => {
    g.fillStyle(OUTLINE);
    g.fillCircle(32, 32, 28);
    g.fillStyle(0xf4f6fa);
    g.fillCircle(32, 32, 24.5);
    g.fillStyle(0xe8443a);
    g.slice(32, 32, 24.5, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(23, 18, 12, 6);
    g.fillStyle(OUTLINE);
    g.fillRect(6, 29, 52, 6);
    g.fillCircle(32, 32, 10);
    g.fillStyle(0xffffff);
    g.fillCircle(32, 32, 6);
  },
  // Túi: ba lô có nắp, khoá và túi trước
  'cmd-bag': (g) => {
    g.lineStyle(5, OUTLINE);
    g.strokeEllipse(32, 13, 20, 16);
    g.lineStyle(2.5, 0xb87020);
    g.strokeEllipse(32, 13, 18, 14);
    g.fillStyle(OUTLINE);
    g.fillRoundedRect(9, 15, 46, 45, 12);
    g.fillStyle(0xe89a30);
    g.fillRoundedRect(12, 18, 40, 39, 10);
    g.fillStyle(0xc07818);
    g.fillRoundedRect(12, 18, 40, 18, { tl: 10, tr: 10, bl: 6, br: 6 });
    g.fillStyle(OUTLINE);
    g.fillRect(12, 35, 40, 2.5);
    g.fillStyle(0xd88a28);
    g.fillRoundedRect(19, 41, 26, 13, 4);
    g.lineStyle(2, OUTLINE);
    g.strokeRoundedRect(19, 41, 26, 13, 4);
    g.fillStyle(0xffe066);
    g.fillRoundedRect(28, 31, 8, 8, 2);
    g.lineStyle(1.5, OUTLINE);
    g.strokeRoundedRect(28, 31, 8, 8, 2);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(15, 21, 12, 4, 2);
  },
  // Chạy: mũi tên lao về phải với vệt gió
  'cmd-run': (g) => {
    const arrow = [
      { x: 22, y: 24 }, { x: 36, y: 24 }, { x: 36, y: 13 }, { x: 58, y: 32 },
      { x: 36, y: 51 }, { x: 36, y: 40 }, { x: 22, y: 40 },
    ];
    g.lineStyle(7, OUTLINE);
    g.strokePoints(arrow, true);
    g.fillStyle(0x4aa0f0);
    g.fillPoints(arrow, true);
    g.fillStyle(0xa8dcff);
    g.fillPoints([{ x: 24, y: 26 }, { x: 38, y: 26 }, { x: 38, y: 18 }, { x: 50, y: 28 }, { x: 24, y: 31 }], true);
    for (const [x1, x2, y] of [[4, 16, 20], [8, 18, 32], [4, 16, 44]]) {
      g.lineStyle(6, OUTLINE);
      g.lineBetween(x1, y, x2, y);
      g.lineStyle(3, 0xd8f0ff);
      g.lineBetween(x1, y, x2, y);
    }
  },
};

export function commandIcons(scene) {
  for (const [key, draw] of Object.entries(ICONS)) {
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    draw(g);
    g.generateTexture(key, 64, 64);
    g.destroy();
  }
}

// ---------- Khay nút ----------

// Khay nút lớn chọn bằng phím mũi tên + Enter hoặc chuột (rê để chọn, bấm để xác nhận). open() trả về value của nút,
// { blocked } nếu bấm vào nút bị khoá có lời nhắn (vd chiêu hết PP), hoặc null nếu huỷ (X / Esc / bấm ra ngoài).
//  items: [{ value, disabled, blocked, ... }]   render(cell, item, w, h): vẽ nội dung nút (một lần)
//  paint(g, item, w, h, selected): vẽ nền nút (mỗi lần đổi chọn)   onChange(item, i): con trỏ đổi nút
export class ButtonGrid {
  constructor(scene, router, opts) {
    const { x, y, width, height, items } = opts;
    this.scene = scene;
    this.router = router;
    this.items = items;
    this.columns = opts.columns ?? 2;
    this.cancelable = opts.cancelable ?? true;
    this.paint = opts.paint;
    this.onChange = opts.onChange;
    this.bounds = new Phaser.Geom.Rectangle(x, y, width, height);
    this.container = scene.add.container(0, 0).setDepth(opts.depth ?? 20);
    const pad = opts.pad ?? 10;
    const gap = opts.gap ?? 8;
    const tray = scene.add.graphics();
    tray.fillStyle(0x000000, 0.3);
    tray.fillRoundedRect(x + 3, y + 6, width, height, 18);
    tray.fillStyle(TRAY, 0.97);
    tray.fillRoundedRect(x, y, width, height, 18);
    tray.lineStyle(2, TRAY_EDGE);
    tray.strokeRoundedRect(x + 1, y + 1, width - 2, height - 2, 17);
    this.container.add(tray);
    const rows = Math.ceil(items.length / this.columns);
    const w = (width - pad * 2 - gap * (this.columns - 1)) / this.columns;
    const h = (height - pad * 2 - gap * (rows - 1)) / rows;
    this.cells = items.map((item, i) => {
      const col = i % this.columns;
      const row = Math.floor(i / this.columns);
      const cell = scene.add.container(x + pad + col * (w + gap) + w / 2, y + pad + row * (h + gap) + h / 2);
      const bg = scene.add.graphics();
      cell.add(bg);
      opts.render(cell, item, w, h);
      const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(i));
      zone.on('pointerdown', (p) => {
        if (p.rightButtonDown()) return;
        this.select(i);
        this.confirm();
      });
      cell.add(zone);
      this.container.add(cell);
      return { cell, bg, w, h };
    });
    this.index = -1;
    this.cells.forEach((_, i) => this.draw(i, false));
    this.select(Phaser.Math.Clamp(opts.index ?? 0, 0, items.length - 1));
  }

  draw(i, selected) {
    const { cell, bg, w, h } = this.cells[i];
    bg.clear();
    this.paint(bg, this.items[i], w, h, selected);
    cell.setScale(selected ? 1.04 : 1);
    cell.each?.((child) => child.onSelect?.(selected));
  }

  select(i) {
    if (i === this.index || this.done) return;
    if (this.index >= 0) this.draw(this.index, false);
    this.index = i;
    this.draw(i, true);
    this.onChange?.(this.items[i], i);
  }

  open() {
    const openedAt = performance.now();
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set(
        (e) => e.timeStamp >= openedAt && this.handleKey(e),
        (p) => {
          if (p.downTime < openedAt || !this.cancelable) return;
          if (p.rightButtonDown() || !this.bounds.contains(p.x, p.y)) this.finish(null);
        },
      );
    });
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
    if (item.blocked) this.finish({ blocked: item.blocked });
    else if (!item.disabled) this.finish(item.value);
  }

  finish(value) {
    if (this.done) return;
    this.done = true;
    this.router.clear();
    this.cells.forEach(({ cell }) => cell.each((child) => child.onSelect?.(false)));
    this.container.destroy();
    this.resolve?.(value);
  }
}

// Nút lệnh: nền tối có vạch màu dưới đáy; đang chọn thì phủ màu lệnh, viền vàng, icon nhún nhẹ
export function paintCommand(g, item, w, h, selected) {
  const base = item.color;
  g.fillStyle(0x000000, 0.3);
  g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 14);
  g.fillStyle(selected ? base : 0x283352);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.fillStyle(selected ? shade(base, -35) : 0x1f2843);
  g.fillRoundedRect(-w / 2, h / 2 - 22, w, 22, { tl: 0, tr: 0, bl: 14, br: 14 });
  g.fillStyle(0xffffff, selected ? 0.22 : 0.06);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, h * 0.34, 10);
  if (!selected) {
    g.fillStyle(base);
    g.fillRoundedRect(-w / 2 + 14, h / 2 - 5, w - 28, 3, 2);
  }
  g.lineStyle(selected ? 3 : 2, selected ? GOLD : 0x3d4c72);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
}

export function renderCommand(scene, cell, item, w, h) {
  const icon = scene.add.image(0, -12, item.icon).setScale(fitScale(scene, item.icon, 42));
  const label = scene.add.text(0, h / 2 - 12, item.label, textStyle(17, '#ffffff', { fontStyle: 'bold', stroke: '#141a2c', strokeThickness: 4 })).setOrigin(0.5);
  const base = icon.scale;
  // Đang chọn: icon to hơn và nhún lên xuống
  icon.onSelect = (on) => {
    icon.bob?.remove();
    icon.setScale(on ? base * 1.12 : base).setY(-12);
    if (on) icon.bob = scene.tweens.add({ targets: icon, y: -15, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  };
  cell.add([icon, label]);
}

// Nút chiêu: nền màu hệ, tên chiêu, hệ + PP (PP còn ít thì vàng / đỏ); ô không dùng được thì xám
export function paintMove(g, item, w, h, selected) {
  const base = item.disabled ? 0x6a7080 : item.color;
  g.fillStyle(0x000000, 0.3);
  g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 14);
  g.fillStyle(shade(base, -30));
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.fillStyle(base);
  g.fillRoundedRect(-w / 2, -h / 2, w, h - 24, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.fillStyle(0xffffff, 0.22);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, (h - 24) * 0.4, 10);
  if (item.value) {
    // dải tối dưới đáy chứa hệ + PP
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(-w / 2, h / 2 - 24, w, 24, { tl: 0, tr: 0, bl: 14, br: 14 });
  }
  g.lineStyle(selected ? 4 : 2, selected ? 0xffffff : shade(base, -50));
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  if (selected) {
    g.lineStyle(2, GOLD);
    g.strokeRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 17);
  }
}

export function renderMove(scene, cell, item, w, h) {
  const stroke = { stroke: cssColor(shade(item.disabled ? 0x6a7080 : item.color, -60)), strokeThickness: 5 };
  const name = scene.add.text(0, -12, item.label, textStyle(24, item.disabled && item.value ? '#d8dce4' : '#ffffff', { fontStyle: 'bold', ...stroke })).setOrigin(0.5);
  if (name.width > w - 20) name.setScale((w - 20) / name.width);
  cell.add(name);
  if (!item.value) return;
  cell.add(scene.add.text(-w / 2 + 14, h / 2 - 12, item.tag, textStyle(14, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5));
  const ratio = item.pp / item.maxPp;
  const color = item.pp === 0 ? '#ff8a8a' : ratio <= 0.25 ? '#ffb070' : ratio <= 0.5 ? '#ffe066' : '#ffffff';
  cell.add(scene.add.text(w / 2 - 14, h / 2 - 12, `PP ${item.pp}/${item.maxPp}`, textStyle(15, color, { fontStyle: 'bold' })).setOrigin(1, 0.5));
}
