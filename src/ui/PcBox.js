import Phaser from 'phaser';
import { ABILITIES } from '../data/abilities.js';
import { ITEMS } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { SPECIES } from '../data/monsters.js';
import { NATURES } from '../data/natures.js';
import { STAT_NAMES } from '../data/stats.js';
import { TYPES } from '../data/types.js';
import { BOX_SLOTS, boxCount, monAt, moveMon, releaseMon, releaseProblem } from '../game/storage.js';
import { PARTY_SIZE, state } from '../game/state.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { GENDER, closeButton, cssColor, drawHpBar, drawPanel, fitText, fixToCamera, hpColor, hpLabel, monTag, textStyle } from './helpers.js';
import { isCancel, isConfirm } from './input.js';
import { typeBadges } from './TypeBadge.js';
import { shinyGap, shinyMark } from './shinyMark.js';

// Hộp Pokémon trong PC kiểu game gốc: bên trái là thông tin con đang chọn, giữa là lưới hộp 6 x 5 ô (nhiều hộp, đổi bằng
// ◀ ▶ / con lăn chuột / Q E), bên phải là cột đội hình 6 ô và thùng rác.
//  - Kéo thả Pokémon giữa hộp và đội hình: thả lên con khác là đổi chỗ, thả vào ô trống là chuyển sang
//  - Kéo vào thùng rác là thả Pokémon (hỏi lại, mặc định "Không")
//  - Bàn phím: mũi tên di con trỏ, Enter nhấc / đặt Pokémon, Esc huỷ nhấc / đóng máy
// Logic đổi chỗ / thả nằm trong game/storage.js

const PANEL = { x: 16, y: 12, w: 928, h: 556 };
const INFO = { x: 34, y: 30, w: 202, h: 520 };
const GRID = { x: 252, y: 96, cols: 6, rows: 5, cell: 72 };
const PARTY = { x: 702, y: 62, w: 222, h: 62, gap: 6 };
const TRASH = { x: 702, y: 482, w: 222, h: 64 };
const DRAG_START = 8;
const ACCENT = 0xf0b030;
const DROP = 0x38c068;
const DANGER = 0xe04848;

const slotRect = ({ area, k }) => {
  if (area === 'box') {
    const col = k % GRID.cols;
    const row = Math.floor(k / GRID.cols);
    return { x: GRID.x + col * GRID.cell + 3, y: GRID.y + row * GRID.cell + 3, w: GRID.cell - 6, h: GRID.cell - 6 };
  }
  if (area === 'party') return { x: PARTY.x, y: PARTY.y + k * (PARTY.h + PARTY.gap), w: PARTY.w, h: PARTY.h };
  return { ...TRASH };
};

export class PcBox {
  // opts.ask(câu hỏi) → Promise<boolean>, opts.say(lines) → Promise, opts.onChange(): đội hình vừa đổi
  constructor(scene, router, opts) {
    this.scene = scene;
    this.router = router;
    this.opts = opts;
    this.depth = opts.depth ?? 102;
    this.page = 0;
    this.cursor = { area: state.storage.length ? 'box' : 'party', k: 0 };
    this.held = null; // đang nhấc bằng bàn phím: { area, k }
    this.press = null; // đang nhấn chuột: { slot, x, y, ghost }
    this.locked = false; // đang hỏi / thông báo: bỏ qua chuột
    this.container = scene.add.container(0, 0).setDepth(this.depth);
    this.content = scene.add.container(0, 0).setDepth(this.depth + 0.1);
    this.cursorG = scene.add.graphics().setDepth(this.depth + 0.2);
    this.info = scene.add.container(0, 0).setDepth(this.depth + 0.1);
    this.buildBase();
    for (const o of [this.container, this.content, this.cursorG, this.info]) fixToCamera(o);
    this.render();
  }

  open() {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.bindKeys();
      this.onPointerMove = (p) => this.dragMove(p);
      this.onPointerUp = (p) => this.dragEnd(p);
      this.onWheel = (p, objs, dx, dy) => {
        if (!this.locked && dy && p.x >= GRID.x && p.x <= GRID.x + GRID.cols * GRID.cell && p.y >= GRID.y - 60 && p.y <= GRID.y + GRID.rows * GRID.cell) this.turnPage(Math.sign(dy));
      };
      this.scene.input.on('pointermove', this.onPointerMove);
      this.scene.input.on('pointerup', this.onPointerUp);
      this.scene.input.on('wheel', this.onWheel);
    });
  }

  bindKeys() {
    this.router.set((e) => this.onKey(e));
  }

  close() {
    if (this.press?.ghost) return;
    this.scene.input.off('pointermove', this.onPointerMove);
    this.scene.input.off('pointerup', this.onPointerUp);
    this.scene.input.off('wheel', this.onWheel);
    this.router.clear();
    this.noteTimer?.remove();
    for (const o of [this.container, this.content, this.cursorG, this.info]) o.destroy();
    this.resolve?.();
  }

  // ---------- Khung cố định: nền, tiêu đề, ô bấm ----------

  buildBase() {
    const { scene } = this;
    const add = (o) => this.container.add(o);
    add(drawPanel(scene, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 18, true));
    const g = scene.add.graphics();
    add(g);
    // Khung thông tin bên trái
    g.fillStyle(0xeef2f8);
    g.fillRoundedRect(INFO.x, INFO.y, INFO.w, INFO.h, 12);
    // Nền lưới hộp
    g.fillStyle(0x9cc8e8);
    g.fillRoundedRect(GRID.x - 10, GRID.y - 60, GRID.cols * GRID.cell + 20, GRID.rows * GRID.cell + 70, 14);
    g.fillStyle(0xc6e2f4);
    g.fillRoundedRect(GRID.x - 4, GRID.y - 4, GRID.cols * GRID.cell + 8, GRID.rows * GRID.cell + 8, 10);
    // Thùng rác
    g.fillStyle(0xfbe9e9);
    g.fillRoundedRect(TRASH.x, TRASH.y, TRASH.w, TRASH.h, 12);
    g.lineStyle(2, 0xe8a0a0);
    g.strokeRoundedRect(TRASH.x, TRASH.y, TRASH.w, TRASH.h, 12);
    drawTrashCan(g, TRASH.x + 34, TRASH.y + TRASH.h / 2);
    add(scene.add.text(TRASH.x + 64, TRASH.y + TRASH.h / 2, 'Thả Pokémon', textStyle(18, '#c04040', { fontStyle: 'bold' })).setOrigin(0, 0.5));
    add(scene.add.text(PARTY.x + 4, PANEL.y + 22, 'Đội hình', textStyle(22, '#3a4660', { fontStyle: 'bold' })));
    add(scene.add.text(GRID.x + (GRID.cols * GRID.cell) / 2, TRASH.y + TRASH.h - 4, 'Kéo thả để đổi chỗ  ·  Enter: nhấc / đặt  ·  Q E: đổi hộp',
      textStyle(13, '#9aa4b8')).setOrigin(0.5, 1));
    add(closeButton(scene, PANEL.x + PANEL.w - 34, PANEL.y + 34, () => !this.locked && !this.press && this.close()));
    // Mũi tên đổi hộp
    for (const [dx, label, dir] of [[26, '◀', -1], [GRID.cols * GRID.cell - 26, '▶', 1]]) {
      const t = scene.add.text(GRID.x + dx, GRID.y - 32, label, textStyle(24, '#ffffff', { stroke: '#4a7aa8', strokeThickness: 5 }))
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => !this.locked && this.turnPage(dir));
      t.flip = dir;
      add(t);
    }
    // Ô bấm cho từng ô hộp / đội hình / thùng rác
    const slots = [
      ...Array.from({ length: BOX_SLOTS }, (_, k) => ({ area: 'box', k })),
      ...Array.from({ length: PARTY_SIZE }, (_, k) => ({ area: 'party', k })),
      { area: 'trash', k: 0 },
    ];
    for (const slot of slots) {
      const r = slotRect(slot);
      const zone = scene.add.zone(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h).setInteractive({ useHandCursor: slot.area !== 'trash' });
      zone.on('pointerover', () => !this.locked && !this.press && slot.area !== 'trash' && this.setCursor(slot));
      zone.on('pointerdown', (p) => {
        if (this.locked) return;
        if (slot.area !== 'trash') this.setCursor(slot);
        if (this.held) {
          this.dropHeld(slot);
          return;
        }
        if (this.monOf(slot)) this.press = { slot: { ...slot }, x: p.x, y: p.y, ghost: null };
      });
      add(zone);
    }
  }

  // ---------- Vẽ nội dung ----------

  // Chỉ số trong state.storage / state.party của ô slot (hộp đang xem)
  posOf(slot) {
    return { area: slot.area, i: slot.area === 'box' ? this.page * BOX_SLOTS + slot.k : slot.k };
  }

  monOf(slot) {
    return slot.area === 'trash' ? null : monAt(this.posOf(slot));
  }

  render() {
    const { scene } = this;
    this.content.removeAll(true);
    const add = (o) => this.content.add(o);
    this.page = Phaser.Math.Clamp(this.page, 0, boxCount() - 1);
    const lifted = this.press?.ghost ? this.press.slot : this.held;
    const isLifted = (slot) => lifted && lifted.area === slot.area && lifted.k === slot.k && (slot.area !== 'box' || lifted.page === this.page);
    const boxes = boxCount();
    add(scene.add.text(GRID.x + (GRID.cols * GRID.cell) / 2, GRID.y - 32, boxes > 1 ? `Hộp ${this.page + 1} / ${boxes}` : 'Hộp 1', textStyle(24, '#ffffff', {
      fontStyle: 'bold', stroke: '#4a7aa8', strokeThickness: 5,
    })).setOrigin(0.5));
    const g = scene.add.graphics();
    add(g);
    for (let k = 0; k < BOX_SLOTS; k++) {
      const slot = { area: 'box', k };
      const r = slotRect(slot);
      g.fillStyle(0xffffff, 0.55);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      const mon = this.monOf(slot);
      if (mon) this.drawMonIcon(mon, r.x + r.w / 2, r.y + r.h / 2 + 2, 52, isLifted(slot), [r.x + r.w - 10, r.y + 10]);
    }
    for (let k = 0; k < PARTY_SIZE; k++) {
      const slot = { area: 'party', k };
      const r = slotRect(slot);
      const mon = this.monOf(slot);
      g.fillStyle(mon ? 0xe4f0fa : 0xf2f4f8);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 12);
      if (!mon) {
        g.lineStyle(2, 0xd0d6e2);
        g.strokeRoundedRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 12);
        add(scene.add.text(r.x + r.w / 2, r.y + r.h / 2, 'Trống', textStyle(15, '#a8b0c0')).setOrigin(0.5));
        continue;
      }
      const dim = isLifted(slot);
      this.drawMonIcon(mon, r.x + 32, r.y + r.h / 2, 48, dim, [r.x + 52, r.y + 12]);
      const alpha = dim ? 0.35 : 1;
      // Pokémon shiny: chữ "S" vàng trước tên
      const mark = mon.shiny ? shinyMark(scene, r.x + 62, r.y + 8, 17).setAlpha(alpha) : null;
      if (mark) add(mark);
      const nx = r.x + 62 + (mark ? mark.width + shinyGap(17) : 0);
      const lv = scene.add.text(r.x + r.w - 10, r.y + 10, `Lv${mon.level}`, textStyle(14, '#6a7286')).setOrigin(1, 0).setAlpha(alpha);
      add(lv);
      // Biệt danh dài: thu nhỏ / cắt bớt để không đè lên cấp
      add(fitText(scene.add.text(nx, r.y + 8, mon.name, textStyle(17, '#30343c', { fontStyle: 'bold' })), lv.x - lv.width - 6 - nx, 0.8).setAlpha(alpha));
      // Thanh HP; trạng thái xấu / kiệt sức thì nhãn ở cuối thanh
      const tag = monTag(scene, r.x + r.w - 10, r.y + 45, mon, 10);
      if (tag) add(tag.setOrigin(1, 0.5).setPadding(4, 1).setAlpha(alpha));
      const barW = r.w - 74 - (tag ? tag.width + 6 : 0);
      const ratio = Math.max(0, mon.hp / mon.maxHp);
      g.fillStyle(0x3a4250, alpha);
      g.fillRoundedRect(r.x + 62, r.y + 40, barW, 10, 5);
      g.fillStyle(hpColor(ratio), alpha);
      if (ratio > 0) g.fillRoundedRect(r.x + 64, r.y + 42, Math.max(6, (barW - 4) * ratio), 6, 3);
    }
    this.drawCursor();
    this.renderInfo();
  }

  // held: [x, y] chỗ đặt icon nhỏ của đồ đang cầm (góc trên phải ô)
  drawMonIcon(mon, x, y, size, dim, held) {
    const key = pixelMon(this.scene, mon.speciesId, '', 28, mon.shiny);
    this.content.add(this.scene.add.image(x, y, key).setScale(fitScale(this.scene, key, size)).setAlpha(dim ? 0.25 : mon.hp > 0 ? 1 : 0.5));
    if (mon.heldItem && !dim) {
      const icon = ITEMS[mon.heldItem].icon;
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(held[0], held[1], 9);
      g.lineStyle(1.5, 0xc8d0de);
      g.strokeCircle(held[0], held[1], 9);
      this.content.add(g);
      this.content.add(this.scene.add.image(held[0], held[1], icon).setScale(fitScale(this.scene, icon, 14)));
    }
  }

  // Viền con trỏ (vàng), ô sắp thả (xanh) hoặc thùng rác (đỏ) khi đang kéo
  drawCursor() {
    const g = this.cursorG;
    g.clear();
    const ring = (slot, color, width = 4) => {
      const r = slotRect(slot);
      g.lineStyle(width, color);
      g.strokeRoundedRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 12);
    };
    const target = this.press?.ghost ? this.press.target : null;
    if (target) ring(target, target.area === 'trash' ? DANGER : DROP);
    else if (this.cursor) ring(this.cursor, this.held ? DROP : ACCENT);
  }

  // Thông tin Pokémon đang trỏ / đang kéo ở khung bên trái
  renderInfo() {
    const { scene } = this;
    this.info.removeAll(true);
    const add = (o) => this.info.add(o);
    const dragged = this.press?.ghost ? this.press.mon : null;
    const mon = dragged ?? this.heldMon ?? (this.cursor ? this.monOf(this.cursor) : null);
    const cx = INFO.x + INFO.w / 2;
    if (!mon) {
      add(scene.add.text(cx, INFO.y + 200, 'Chọn một\nPokémon', textStyle(18, '#a0a8b8', { align: 'center' })).setOrigin(0.5));
      return;
    }
    const top = INFO.y;
    const left = INFO.x + 14;
    const right = INFO.x + INFO.w - 14;
    const muted = '#8a92a6';
    const key = pixelMon(scene, mon.speciesId, '', 64, mon.shiny);
    add(scene.add.image(cx, top + 66, key).setScale(fitScale(scene, key, 100)).setAlpha(mon.hp > 0 ? 1 : 0.55));
    // Tên ở giữa; Pokémon shiny có chữ "S" vàng trước tên (cả cụm canh giữa); biệt danh dài thì thu nhỏ / cắt bớt cho vừa khung
    const nameText = scene.add.text(cx, top + 118, mon.name, textStyle(21, '#30343c', { fontStyle: 'bold' })).setOrigin(0.5, 0);
    if (mon.shiny) {
      const mark = shinyMark(scene, 0, top + 118, 21);
      fitText(nameText, right - left - mark.width - shinyGap(21), 0.75);
      const total = mark.width + shinyGap(21) + nameText.displayWidth;
      mark.setX(cx - total / 2);
      nameText.setOrigin(0, 0).setX(mark.x + mark.width + shinyGap(21));
      add(mark);
    } else {
      fitText(nameText, right - left, 0.75);
    }
    add(nameText);
    const line = scene.add.text(cx, top + 146, `Lv${mon.level}`, textStyle(15, '#6a7286')).setOrigin(0.5, 0);
    add(line);
    if (mon.gender) {
      add(scene.add.text(line.x + line.width / 2 + 5, line.y, GENDER[mon.gender].symbol, textStyle(15, GENDER[mon.gender].color, { fontStyle: 'bold' })));
    }
    for (const b of typeBadges(scene, cx, top + 184, SPECIES[mon.speciesId].types, { size: 13, align: 'center' })) add(b);
    const g = scene.add.graphics();
    add(g);
    drawHpBar(g, left, top + 202, right - left, mon.hp / mon.maxHp);
    add(hpLabel(scene, left, top + 202));
    add(scene.add.text(right, top + 226, `${mon.hp}/${mon.maxHp}`, textStyle(14, '#4a5266')).setOrigin(1, 0));
    const tag = monTag(scene, left, top + 226, mon, 11);
    if (tag) add(tag);
    // Đồ cầm (một dòng)
    if (mon.heldItem) {
      const icon = ITEMS[mon.heldItem].icon;
      add(scene.add.image(left + 9, top + 258, icon).setScale(fitScale(scene, icon, 18)));
      add(scene.add.text(left + 24, top + 258, ITEMS[mon.heldItem].name, textStyle(14, '#30343c', { fixedWidth: right - left - 24 })).setOrigin(0, 0.5));
    } else {
      add(scene.add.text(left, top + 258, 'Không cầm đồ', textStyle(14, '#a8b0c0')).setOrigin(0, 0.5));
    }
    g.lineStyle(1, 0xd4dae6);
    g.lineBetween(left, top + 276, right, top + 276);
    // Tính cách, đặc tính, chiêu thức
    const label = (y, text) => add(scene.add.text(left, top + y, text, textStyle(11, muted, { fontStyle: 'bold' })));
    const nature = NATURES[mon.nature];
    label(284, 'TÍNH CÁCH');
    add(scene.add.text(left, top + 298, nature?.name ?? '—', textStyle(16, '#30343c', { fontStyle: 'bold' })));
    if (nature?.up) {
      add(scene.add.text(right, top + 300, `+${STAT_NAMES[nature.up]} −${STAT_NAMES[nature.down]}`, textStyle(11, '#6a7286', {
        align: 'right', wordWrap: { width: 96 },
      })).setOrigin(1, 0));
    }
    label(326, 'ĐẶC TÍNH');
    add(scene.add.text(left, top + 340, ABILITIES[mon.ability]?.name ?? '—', textStyle(16, '#30343c', { fontStyle: 'bold' })));
    label(370, 'CHIÊU THỨC');
    (mon.moves ?? []).forEach((id, i) => {
      const m = MOVES[id];
      if (!m) return;
      const y = top + 386 + i * 32;
      const color = TYPES[m.type].color;
      g.fillStyle(color, 0.16);
      g.fillRoundedRect(left, y, right - left, 28, 7);
      g.fillStyle(color);
      g.fillRoundedRect(left, y, 6, 28, { tl: 7, bl: 7, tr: 0, br: 0 });
      add(scene.add.text(left + 13, y + 14, m.name, textStyle(14, '#30343c', { fontStyle: 'bold' })).setOrigin(0, 0.5));
      const pp = mon.pp?.[id];
      if (pp !== undefined) add(scene.add.text(right - 6, y + 14, `${pp}/${m.pp}`, textStyle(12, pp === 0 ? '#d04040' : cssColor(0x6a7286))).setOrigin(1, 0.5));
    });
  }

  get heldMon() {
    if (!this.held) return null;
    return monAt({ area: this.held.area, i: this.held.area === 'box' ? this.held.page * BOX_SLOTS + this.held.k : this.held.k });
  }

  setCursor(slot) {
    if (this.cursor && this.cursor.area === slot.area && this.cursor.k === slot.k) return;
    this.cursor = { area: slot.area, k: slot.k };
    this.drawCursor();
    this.renderInfo();
  }

  turnPage(dir) {
    const next = Phaser.Math.Clamp(this.page + dir, 0, boxCount() - 1);
    if (next === this.page) return;
    this.page = next;
    this.render();
  }

  // Báo lỗi nhỏ dưới lưới hộp (không mở hộp thoại)
  note(text) {
    this.noteText?.destroy();
    this.noteTimer?.remove();
    this.noteText = this.scene.add.text(GRID.x + (GRID.cols * GRID.cell) / 2, GRID.y + GRID.rows * GRID.cell + 34, text, textStyle(15, '#ffffff', {
      fontStyle: 'bold', backgroundColor: 'rgba(200,64,64,0.92)', padding: { x: 12, y: 6 }, align: 'center',
      wordWrap: { width: GRID.cols * GRID.cell, useAdvancedWrap: true },
    })).setOrigin(0.5).setScrollFactor(0).setDepth(this.depth + 0.5);
    this.container.add(this.noteText);
    this.noteTimer = this.scene.time.delayedCall(2200, () => this.noteText?.destroy());
  }

  // ---------- Kéo thả ----------

  slotAt(px, py) {
    if (px >= GRID.x && px < GRID.x + GRID.cols * GRID.cell && py >= GRID.y && py < GRID.y + GRID.rows * GRID.cell) {
      return { area: 'box', k: Math.floor((py - GRID.y) / GRID.cell) * GRID.cols + Math.floor((px - GRID.x) / GRID.cell) };
    }
    for (let k = 0; k < PARTY_SIZE; k++) {
      const r = slotRect({ area: 'party', k });
      if (px >= r.x && px <= r.x + r.w && py >= r.y - PARTY.gap / 2 && py <= r.y + r.h + PARTY.gap / 2) return { area: 'party', k };
    }
    if (px >= TRASH.x && px <= TRASH.x + TRASH.w && py >= TRASH.y && py <= TRASH.y + TRASH.h) return { area: 'trash', k: 0 };
    return null;
  }

  dragMove(p) {
    const press = this.press;
    if (!press || this.locked) return;
    if (!press.ghost) {
      if (Math.hypot(p.x - press.x, p.y - press.y) < DRAG_START) return;
      press.mon = this.monOf(press.slot);
      press.slot.page = this.page;
      const key = pixelMon(this.scene, press.mon.speciesId, '', 28, press.mon.shiny);
      press.ghost = this.scene.add.image(p.x, p.y, key).setScale(fitScale(this.scene, key, 64)).setScrollFactor(0).setDepth(this.depth + 1);
      this.render();
    }
    press.ghost.setPosition(p.x, p.y - 6);
    // Giữ trên mũi tên ◀ ▶ một lúc thì lật hộp (mang Pokémon sang hộp khác)
    const arrow = Math.abs(p.y - (GRID.y - 32)) < 24 && (Math.abs(p.x - (GRID.x + 26)) < 26 ? -1 : Math.abs(p.x - (GRID.x + GRID.cols * GRID.cell - 26)) < 26 ? 1 : 0);
    if (arrow && !this.flipTimer) {
      this.flipTimer = this.scene.time.delayedCall(450, () => {
        this.flipTimer = null;
        if (this.press?.ghost) this.turnPage(arrow);
      });
    } else if (!arrow && this.flipTimer) {
      this.flipTimer.remove();
      this.flipTimer = null;
    }
    const target = this.slotAt(p.x, p.y);
    const same = target && press.target && target.area === press.target.area && target.k === press.target.k;
    if (!same) {
      press.target = target;
      this.drawCursor();
    }
  }

  async dragEnd(p) {
    const press = this.press;
    if (!press) return;
    this.press = null;
    this.flipTimer?.remove();
    this.flipTimer = null;
    if (!press.ghost) return; // chỉ bấm: con trỏ đã chuyển tới ô đó
    press.ghost.destroy();
    const target = this.slotAt(p.x, p.y);
    const from = { area: press.slot.area, i: press.slot.area === 'box' ? press.slot.page * BOX_SLOTS + press.slot.k : press.slot.k };
    if (target) this.cursor = target.area === 'trash' ? this.cursor : target;
    this.render();
    if (target) await this.drop(from, target);
  }

  // Bàn phím: Enter nhấc Pokémon ở con trỏ, Enter lần nữa đặt xuống ô con trỏ
  async dropHeld(slot) {
    const held = this.held;
    this.held = null;
    const from = { area: held.area, i: held.area === 'box' ? held.page * BOX_SLOTS + held.k : held.k };
    await this.drop(from, slot);
  }

  async drop(from, slot) {
    if (slot.area === 'trash') {
      await this.release(from);
      return;
    }
    const error = moveMon(from, this.posOf(slot));
    if (error) this.note(error);
    else this.opts.onChange?.();
    this.render();
  }

  async release(from) {
    const mon = monAt(from);
    const problem = releaseProblem(from);
    if (problem) {
      this.note(problem);
      this.render();
      return;
    }
    this.locked = true;
    const yes = await this.opts.ask(`Thả ${mon.name}? Pokémon được thả sẽ mất vĩnh viễn!`);
    if (yes) {
      const { held, kept } = releaseMon(from);
      this.opts.onChange?.();
      this.render();
      await this.opts.say([
        `${mon.name} đã được thả về tự nhiên. Tạm biệt, ${mon.name}!`,
        ...(held && kept ? [`Đã cất ${ITEMS[held].name} ${mon.name} đang cầm vào túi.`] : []),
        ...(held && !kept ? [`Túi đã đầy ${ITEMS[held].name}, không cất thêm được.`] : []),
      ]);
    }
    this.locked = false;
    this.bindKeys();
    this.render();
  }

  // ---------- Bàn phím ----------

  onKey(e) {
    if (this.locked || this.press) return;
    if (isCancel(e)) {
      if (this.held) {
        this.held = null;
        this.render();
      } else {
        this.close();
      }
      return;
    }
    if (e.code === 'KeyQ' || e.code === 'PageUp') return this.turnPage(-1);
    if (e.code === 'KeyE' || e.code === 'PageDown') return this.turnPage(1);
    if (isConfirm(e)) {
      const slot = this.cursor;
      if (this.held) this.dropHeld(slot);
      else if (slot.area !== 'trash' && this.monOf(slot)) {
        this.held = { ...slot, page: this.page };
        this.render();
      }
      return;
    }
    const dir = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] }[e.code];
    if (!dir) return;
    this.cursor = this.stepCursor(this.cursor, dir);
    this.drawCursor();
    this.renderInfo();
  }

  stepCursor(cur, [dx, dy]) {
    const { area, k } = cur;
    if (area === 'box') {
      const col = k % GRID.cols;
      const row = Math.floor(k / GRID.cols);
      if (dx > 0 && col === GRID.cols - 1) return { area: 'party', k: Math.min(PARTY_SIZE - 1, row) };
      const c = Phaser.Math.Clamp(col + dx, 0, GRID.cols - 1);
      const r = Phaser.Math.Clamp(row + dy, 0, GRID.rows - 1);
      return { area, k: r * GRID.cols + c };
    }
    if (area === 'party') {
      if (dx < 0) return { area: 'box', k: Math.min(GRID.rows - 1, k) * GRID.cols + GRID.cols - 1 };
      if (dy > 0 && k === PARTY_SIZE - 1) return { area: 'trash', k: 0 };
      return { area, k: Phaser.Math.Clamp(k + dy, 0, PARTY_SIZE - 1) };
    }
    if (dy < 0) return { area: 'party', k: PARTY_SIZE - 1 };
    if (dx < 0) return { area: 'box', k: BOX_SLOTS - 1 };
    return cur;
  }
}

// Thùng rác nhỏ vẽ bằng code (tâm cx, cy)
function drawTrashCan(g, cx, cy) {
  g.fillStyle(0xd05050);
  g.fillRoundedRect(cx - 12, cy - 10, 24, 26, 4);
  g.fillStyle(0xb03c3c);
  g.fillRoundedRect(cx - 15, cy - 16, 30, 6, 3);
  g.fillRect(cx - 5, cy - 20, 10, 5);
  g.fillStyle(0xf0b0b0);
  for (const dx of [-6, 0, 6]) g.fillRect(cx + dx - 1, cy - 5, 2, 16);
}
