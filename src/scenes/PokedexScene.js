import Phaser from 'phaser';
import { DEX, dexNo } from '../data/pokedex.js';
import { TYPES } from '../data/types.js';
import { dexStatus, state } from '../game/state.js';
import { fitScale } from '../gfx/textures.js';
import { drawPanel, gradientRect, textStyle } from '../ui/helpers.js';
import { InputRouter, directionOf, isCancel } from '../ui/input.js';
import { typeBadges } from '../ui/TypeBadge.js';

const VISIBLE_ROWS = 13;
const ROW_H = 44;
const LIST = { x: 606, y: 84, w: 334, h: 616 };

const STAT_ROWS = [
  ['hp', 'HP'],
  ['atk', 'Tấn công'],
  ['def', 'Phòng thủ'],
  ['spAtk', 'Đ.Công'],
  ['spDef', 'Đ.Thủ'],
  ['speed', 'Tốc độ'],
];

// Màu thanh chỉ số theo độ lớn, giống pokemondb
const statColor = (v) => (v < 30 ? 0xf34444 : v < 60 ? 0xff7f0f : v < 90 ? 0xffdd57 : v < 120 ? 0xa0e515 : v < 150 ? 0x23cd5e : 0x00c2b8);

const FX_LABEL = { 0: '×0', 0.25: '×¼', 0.5: '×½', 2: '×2', 4: '×4' };
const fxColor = (m) => (m === 0 ? '#555b6a' : m < 1 ? '#2f9a50' : '#d04040');

const metric = (s) => s.split(' (')[0];

// Pokédex 151 Pokémon. Chưa gặp: bóng đen. Đã gặp: ảnh, tên, hệ. Đã bắt: đầy đủ thông tin.
export default class PokedexScene extends Phaser.Scene {
  constructor() {
    super('Pokedex');
  }

  init(data) {
    const first = DEX.findIndex((p) => dexStatus(p.id) !== 'unknown');
    this.index = data?.focus ? DEX.findIndex((p) => p.id === data.focus) : Math.max(0, first);
  }

  create() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    gradientRect(bg, 0, 0, width, height, 0xd83a3a, 0x8e1a20);
    bg.fillStyle(0x000000, 0.25);
    bg.fillRect(0, 0, width, 70);
    bg.fillStyle(0xffffff, 0.08);
    bg.fillCircle(56, 35, 22);
    bg.lineStyle(4, 0xffffff, 0.9);
    bg.strokeCircle(56, 35, 20);
    bg.fillStyle(0x7ad0ff);
    bg.fillCircle(56, 35, 14);
    bg.fillStyle(0xffffff, 0.7);
    bg.fillCircle(51, 30, 5);

    this.add.text(92, 14, 'POKÉDEX', textStyle(36, '#ffffff', { fontStyle: 'bold', stroke: '#6a1014', strokeThickness: 6 }));
    this.add.text(width - 28, 16, `Đã gặp  ${state.dex.seen.size}     Đã bắt  ${state.dex.caught.size}`, textStyle(22, '#ffffff')).setOrigin(1, 0);
    this.add.text(width - 28, 44, '↑↓ chọn  •  ←→ nhảy 10  •  Esc / P: đóng', textStyle(15, '#ffd0d0')).setOrigin(1, 0);

    drawPanel(this, 20, 84, 570, 250, 16, true);
    drawPanel(this, 20, 346, 280, 224, 16, true);
    drawPanel(this, 310, 346, 280, 224, 16, true);
    drawPanel(this, 20, 582, 570, 118, 16, true);
    this.add.text(38, 362, 'Chỉ số gốc', textStyle(20, '#3a4660', { fontStyle: 'bold' }));
    this.add.text(328, 362, 'Khi bị tấn công', textStyle(20, '#3a4660', { fontStyle: 'bold' }));

    this.createList();
    this.detail = this.add.container(0, 0);

    this.router = new InputRouter(this);
    this.router.set((e) => this.handleKey(e));
    this.input.on('wheel', (_p, _o, _dx, dy) => this.select(this.index + Math.sign(dy) * 3));

    this.cameras.main.fadeIn(200);
    this.refresh();
  }

  createList() {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(LIST.x + 4, LIST.y + 6, LIST.w, LIST.h, 16);
    g.fillStyle(0x2c3142);
    g.fillRoundedRect(LIST.x, LIST.y, LIST.w, LIST.h, 16);
    this.scrollbar = this.add.graphics();

    this.rows = Array.from({ length: VISIBLE_ROWS }, (_, i) => {
      const y = LIST.y + 16 + i * ROW_H;
      const row = this.add.container(LIST.x + 12, y);
      const bg = this.add.graphics();
      const icon = this.add.image(22, ROW_H / 2, 'ball').setScale(0.24);
      const num = this.add.text(42, ROW_H / 2, '', textStyle(18, '#9aa4c0')).setOrigin(0, 0.5);
      const name = this.add.text(92, ROW_H / 2, '', textStyle(21, '#ffffff')).setOrigin(0, 0.5);
      const dot = this.add.circle(22, ROW_H / 2, 5, 0x9aa4c0);
      row.add([bg, icon, dot, num, name]);
      const hit = this.add.zone(LIST.x + 12 + 150, y + ROW_H / 2, 300, ROW_H).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.select(row.dexIndex));
      return Object.assign(row, { bg, icon, dot, num, name });
    });
  }

  handleKey(e) {
    const dir = directionOf(e);
    if (dir === 'up') this.select(this.index - 1);
    else if (dir === 'down') this.select(this.index + 1);
    else if (dir === 'left') this.select(this.index - 10);
    else if (dir === 'right') this.select(this.index + 10);
    else if ((isCancel(e) || e.code === 'KeyP') && !e.repeat) this.close();
  }

  select(i) {
    const next = Phaser.Math.Clamp(i, 0, DEX.length - 1);
    if (next === this.index) return;
    this.index = next;
    this.refresh();
  }

  close() {
    this.router.clear();
    this.scene.stop();
    this.scene.resume('World');
  }

  refresh() {
    this.renderList();
    this.renderDetail();
  }

  renderList() {
    const top = Phaser.Math.Clamp(this.index - Math.floor(VISIBLE_ROWS / 2), 0, DEX.length - VISIBLE_ROWS);
    this.rows.forEach((row, i) => {
      const p = DEX[top + i];
      const status = dexStatus(p.id);
      const selected = top + i === this.index;
      row.dexIndex = top + i;
      row.bg.clear();
      if (selected) {
        row.bg.fillStyle(0xf0f4ff);
        row.bg.fillRoundedRect(0, 2, 302, ROW_H - 4, 10);
      }
      row.icon.setVisible(status === 'caught');
      row.dot.setVisible(status === 'seen');
      row.num.setText(dexNo(p.id)).setColor(selected ? '#6a7286' : '#9aa4c0');
      row.name
        .setText(status === 'unknown' ? '----------' : p.name)
        .setColor(selected ? '#30343c' : status === 'unknown' ? '#6a7290' : '#ffffff');
    });

    const g = this.scrollbar;
    const trackY = LIST.y + 16;
    const trackH = VISIBLE_ROWS * ROW_H;
    const thumbH = Math.max(30, (trackH * VISIBLE_ROWS) / DEX.length);
    g.clear();
    g.fillStyle(0x1e2230);
    g.fillRoundedRect(LIST.x + LIST.w - 14, trackY, 6, trackH, 3);
    g.fillStyle(0x8a94b4);
    g.fillRoundedRect(LIST.x + LIST.w - 14, trackY + (trackH - thumbH) * (top / (DEX.length - VISIBLE_ROWS)), 6, thumbH, 3);
  }

  renderDetail() {
    this.detail.removeAll(true);
    const add = (obj) => {
      this.detail.add(obj);
      return obj;
    };
    const p = DEX[this.index];
    const status = dexStatus(p.id);
    const known = status !== 'unknown';
    const caught = status === 'caught';

    // Ảnh: chưa gặp thì là bóng đen
    const circle = add(this.add.graphics());
    circle.fillStyle(known ? TYPES[p.types[0]].color : 0x8890a0, 0.22);
    circle.fillCircle(130, 206, 98);
    circle.fillStyle(0x000000, 0.12);
    circle.fillEllipse(130, 298, 150, 24);
    const key = `mon-${p.slug}`;
    const img = add(this.add.image(130, 302, key).setOrigin(0.5, 1).setScale(fitScale(this, key, 196)));
    if (!known) img.setTintFill(0x14161c).setAlpha(0.9);

    const x = 252;
    add(this.add.text(x, 100, `No.${dexNo(p.id)}`, textStyle(20, '#8a92a6')));
    add(this.add.text(x, 124, known ? p.name : '???', textStyle(36, '#30343c', { fontStyle: 'bold' })));
    add(this.add.text(x, 170, known ? p.species : 'Chưa gặp', textStyle(20, '#6a7286')));
    if (known) typeBadges(this, x, 218, p.types).forEach(add);

    if (caught) {
      const abilities = p.abilities.map((a) => (a.hidden ? `${a.name} (ẩn)` : a.name)).join(', ');
      const lines = [['Chiều cao', metric(p.height)], ['Cân nặng', metric(p.weight)], ['Đặc tính', abilities]];
      lines.forEach(([label, value], i) => {
        add(this.add.text(x, 246 + i * 26, label, textStyle(18, '#8a92a6')));
        add(this.add.text(x + 96, 246 + i * 26, value, textStyle(18, '#30343c', { wordWrap: { width: 230 } })));
      });
      this.renderStats(add, p);
      this.renderDefenses(add, p);
      add(this.add.text(38, 598, p.entry.text, textStyle(19, '#30343c', { wordWrap: { width: 534 }, lineSpacing: 4 })));
      add(this.add.text(38, 672, `Tỉ lệ bắt ${p.catchRate}   •   EXP gốc ${p.baseExp}   •   ${p.growthRate}   •   EV: ${p.evYield}`, textStyle(15, '#8a92a6')));
    } else {
      const hint = known ? `Bắt ${p.name} để xem thông tin chi tiết.` : 'Chưa có dữ liệu.';
      add(this.add.text(160, 470, '???', textStyle(40, '#c0c6d4', { fontStyle: 'bold' })).setOrigin(0.5));
      add(this.add.text(450, 470, '???', textStyle(40, '#c0c6d4', { fontStyle: 'bold' })).setOrigin(0.5));
      add(this.add.text(305, 641, hint, textStyle(21, '#8a92a6')).setOrigin(0.5));
    }
  }

  renderStats(add, p) {
    const g = add(this.add.graphics());
    STAT_ROWS.forEach(([key, label], i) => {
      const y = 396 + i * 24;
      const v = p.stats[key];
      add(this.add.text(36, y, label, textStyle(16, '#6a7286')));
      add(this.add.text(168, y, String(v), textStyle(16, '#30343c', { fontStyle: 'bold' })).setOrigin(1, 0));
      g.fillStyle(0xe4e8f0);
      g.fillRoundedRect(178, y + 6, 106, 10, 5);
      g.fillStyle(statColor(v));
      g.fillRoundedRect(178, y + 6, Math.max(8, Math.min(1, v / 180) * 106), 10, 5);
    });
    add(this.add.text(36, 540, 'Tổng', textStyle(16, '#6a7286', { fontStyle: 'bold' })));
    add(this.add.text(168, 540, String(p.stats.total), textStyle(16, '#30343c', { fontStyle: 'bold' })).setOrigin(1, 0));
  }

  renderDefenses(add, p) {
    Object.entries(p.typeDefenses).forEach(([type, mult], i) => {
      const cx = 350 + (i % 6) * 42;
      const cy = 410 + Math.floor(i / 6) * 52;
      const g = add(this.add.graphics());
      g.fillStyle(TYPES[type].color);
      g.fillRoundedRect(cx - 19, cy - 11, 38, 22, 6);
      add(this.add.text(cx, cy, TYPES[type].short, textStyle(12, '#ffffff', { fontStyle: 'bold', stroke: '#00000066', strokeThickness: 3 })).setOrigin(0.5));
      if (FX_LABEL[mult]) add(this.add.text(cx, cy + 24, FX_LABEL[mult], textStyle(16, fxColor(mult), { fontStyle: 'bold' })).setOrigin(0.5));
    });
  }
}
