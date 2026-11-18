import Phaser from 'phaser';
import { STATUS_INFO } from '../battle/status.js';
import { ABILITIES } from '../data/abilities.js';
import { ITEMS, canHold } from '../data/items.js';
import { CATEGORY_NAMES, MOVES } from '../data/moves.js';
import { SPECIES } from '../data/monsters.js';
import { NATURES } from '../data/natures.js';
import { EV_MAX_TOTAL, STAT_KEYS, STAT_NAMES, STAT_SHORT } from '../data/stats.js';
import { TYPES } from '../data/types.js';
import { evTotal, expProgress, expToReach } from '../game/monster.js';
import { giveHeldItem, takeHeldItem } from '../game/heldItems.js';
import { itemCount, state } from '../game/state.js';
import { GBA_MON, fitScale, pixelMon } from '../gfx/textures.js';
import { BLEED, COLORS, GENDER, backToWorld, centerStage, closeButton, cssColor, drawHpBar, drawPanel, fitText, gradientRect, hpLabel, monTag, textStyle } from '../ui/helpers.js';
import { ItemTip } from '../ui/BagParts.js';
import { InputRouter, directionOf, isCancel, isConfirm } from '../ui/input.js';
import { matches } from '../game/keybinds.js';
import { withShinyMark } from '../ui/shinyMark.js';
import { typeBadges } from '../ui/TypeBadge.js';

const MUTED = '#6a7286';
const UP = '#d04040'; // chỉ số được tính cách tăng
const DOWN = '#3a70d8'; // chỉ số bị tính cách giảm
// Ô đồ cầm (góc trên trái thẻ Pokémon) và túi đồ mở đè lên cột phải
const SLOT = { x: 40, y: 64, size: 58 };
const BAG = { x: 416, y: 20, w: 524, h: 660, cols: 6, cell: 80, top: 92 };
const BAG_ROWS = 7;

// Thông tin chi tiết một Pokémon trong đội: tính cách, đặc tính, IV / EV / chỉ số, chiêu và PP.
// Chạy chồng lên bản đồ (World đang tạm dừng). Trái / phải để xem Pokémon khác, Esc để đóng.
// Ô "Đồ cầm" góc trên trái: bấm vào ô (hoặc phím B) mở túi đồ đè lên cột phải, chỉ có đồ cầm được.
// Kéo icon vật phẩm trong túi thả vào ô là cho cầm (món đang cầm tự cất vào túi); kéo món đang cầm thả vào túi là cất đi.
// Túi vẫn mở khi chuyển sang Pokémon khác, tiện cho cả đội cầm đồ.
export default class SummaryScene extends Phaser.Scene {
  constructor() {
    super('Summary');
  }

  init(data) {
    this.index = data?.index ?? 0;
  }

  create() {
    centerStage(this); // màn hình rộng: khung 960x720 nằm giữa (toạ độ chuột: p.worldX)
    const g = this.add.graphics();
    gradientRect(g, -BLEED, 0, 960 + BLEED * 2, 720, 0x2c3a64, 0x18203a);
    this.page = this.add.container(0, 0);
    this.router = new InputRouter(this);
    this.router.set((e) => this.handleKey(e), (p) => p.rightButtonDown() && this.close());
    closeButton(this, 940, 22, () => this.close(), 34).forEach((o) => o.setDepth(10));
    this.bagOpen = false;
    this.bagScroll = 0;
    this.dragging = null;
    this.bagLayer = this.add.container(0, 0).setDepth(20);
    this.dragLayer = this.add.container(0, 0).setDepth(40);
    this.tip = new ItemTip(this, 45);
    this.toast = this.add.text(480, 664, '', textStyle(17, '#ffffff', {
      backgroundColor: 'rgba(20,26,44,0.92)', padding: { x: 14, y: 8 },
    })).setOrigin(0.5, 1).setDepth(50).setVisible(false);
    this.setupDrag();
    this.render();
  }

  handleKey(e) {
    const dir = directionOf(e);
    const n = state.party.length;
    if (dir === 'left' || dir === 'up') this.show((this.index - 1 + n) % n);
    else if (dir === 'right' || dir === 'down') this.show((this.index + 1) % n);
    else if (matches(e, 'bag') && !e.repeat) this.toggleBag();
    else if (isCancel(e) && this.bagOpen) this.toggleBag(false);
    else if (isCancel(e) || isConfirm(e)) this.close();
  }

  show(index) {
    if (index === this.index) return;
    this.index = index;
    this.render();
  }

  close() {
    // Bảng Đội hình mở lại ở đúng Pokémon đang xem
    const world = this.scene.get('World');
    if (world?.returnToParty != null) world.returnToParty = this.index;
    backToWorld(this);
  }

  // Báo ngắn ở đáy màn hình (cho cầm / cất đồ)
  note(text) {
    this.toast.setText(text).setVisible(true);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }

  // ---------- Đồ cầm và túi đồ ----------

  toggleBag(open = !this.bagOpen) {
    this.bagOpen = open;
    this.tip.hide();
    this.renderBag();
  }

  // Đồ cầm được đang có trong túi
  holdable() {
    return Object.keys(ITEMS).filter((id) => canHold(id) && itemCount(id) > 0);
  }

  drawSlot(hover = false) {
    const { x, y, size } = SLOT;
    const g = this.slotGfx;
    g.clear();
    g.fillStyle(hover ? 0xdbe8ff : 0xeef2f8);
    g.fillRoundedRect(x, y, size, size, 12);
    g.lineStyle(hover ? 3 : 2, hover ? 0x2f7de1 : 0xb8c2d8);
    g.strokeRoundedRect(x, y, size, size, 12);
  }

  // Ô Đồ cầm trên thẻ Pokémon: icon món đang cầm (kéo ra túi để cất); bấm vào ô là mở túi đồ
  renderHeldSlot(mon) {
    const { x, y, size } = SLOT;
    this.slotGfx = this.add2(this.add.graphics());
    this.drawSlot();
    const held = ITEMS[mon.heldItem];
    const zone = this.add2(this.add.zone(x + size / 2, y + size / 2, size, size).setInteractive({ useHandCursor: true }));
    zone.on('pointerup', () => !this.dragging && this.toggleBag(true));
    if (held) {
      const icon = this.add2(this.add.image(x + size / 2, y + size / 2, held.icon).setScale(fitScale(this, held.icon, 38)));
      icon.setInteractive({ draggable: true, useHandCursor: true });
      icon.setData('drag', { from: 'held', id: mon.heldItem });
      icon.on('pointerover', () => !this.dragging && this.tip.show(mon.heldItem, x + size + 8, y + size / 2));
      icon.on('pointerout', () => this.tip.hide());
      icon.on('pointerup', () => !this.dragging && this.toggleBag(true));
    } else {
      this.text(x + size / 2, y + size / 2, '+', 26, '#a8b2c8', { fontStyle: 'bold' }).setOrigin(0.5);
    }
    this.text(x + size / 2, y + size + 4, 'Đồ cầm', 13, MUTED, { fontStyle: 'bold' }).setOrigin(0.5, 0);
  }

  // Túi đồ đè lên cột phải: lưới icon đồ cầm được, cuộn bằng con lăn chuột, rê chuột xem mô tả
  renderBag() {
    this.bagLayer.removeAll(true);
    if (!this.bagOpen) return;
    const { x, y, w, h, cols, cell, top } = BAG;
    const add = (o) => {
      this.bagLayer.add(o);
      return o;
    };
    add(drawPanel(this, x, y, w, h, 18, true));
    add(this.add.text(x + 24, y + 18, 'Túi đồ', textStyle(22, '#3a4660', { fontStyle: 'bold' })));
    closeButton(this, x + w - 30, y + 30, () => this.toggleBag(false), 28).forEach(add);
    const ids = this.holdable();
    if (!ids.length) {
      add(this.add.text(x + w / 2, y + 200, 'Không có vật phẩm nào cầm được.', textStyle(18, MUTED)).setOrigin(0.5));
      return;
    }
    const maxScroll = Math.max(0, Math.ceil(ids.length / cols) - BAG_ROWS);
    this.bagScroll = Math.min(this.bagScroll, maxScroll);
    const left = x + (w - cols * cell) / 2;
    ids.forEach((id, i) => {
      const row = Math.floor(i / cols) - this.bagScroll;
      if (row < 0 || row >= BAG_ROWS) return;
      const cx = left + (i % cols) * cell + cell / 2;
      const cy = y + top + row * cell + cell / 2;
      const g = add(this.add.graphics());
      g.fillStyle(0xeef2f8);
      g.fillRoundedRect(cx - cell / 2 + 5, cy - cell / 2 + 5, cell - 10, cell - 10, 12);
      const icon = add(this.add.image(cx, cy - 6, ITEMS[id].icon).setScale(fitScale(this, ITEMS[id].icon, 40)));
      add(this.add.text(cx + cell / 2 - 10, cy + cell / 2 - 8, `x${itemCount(id)}`, textStyle(13, '#4a5266', { fontStyle: 'bold' })).setOrigin(1, 1));
      icon.setInteractive({ draggable: true, useHandCursor: true });
      icon.setData('drag', { from: 'bag', id });
      const tipX = cx + cell / 2 + 236 > 956 ? cx - cell / 2 - 236 : cx + cell / 2;
      icon.on('pointerover', () => !this.dragging && this.tip.show(id, tipX, cy));
      icon.on('pointerout', () => this.tip.hide());
    });
    if (maxScroll > 0) {
      add(this.add.text(x + w - 24, y + h - 20, `${this.bagScroll + 1}/${maxScroll + 1}  (cuộn chuột)`, textStyle(13, MUTED)).setOrigin(1, 1));
    }
  }

  // Kéo thả icon vật phẩm: túi -> ô Đồ cầm (cho cầm), ô Đồ cầm -> túi (cất đi)
  setupDrag() {
    this.input.dragDistanceThreshold = 6;
    this.input.on('wheel', (p, objs, dx, dy) => {
      const { x, y, w, h } = BAG;
      if (!this.bagOpen || !dy || p.worldX < x || p.worldX > x + w || p.y < y || p.y > y + h) return;
      this.bagScroll = Math.max(0, this.bagScroll + Math.sign(dy));
      this.renderBag();
    });
    const overSlot = (p) => p.worldX >= SLOT.x - 10 && p.worldX <= SLOT.x + SLOT.size + 10 && p.y >= SLOT.y - 10 && p.y <= SLOT.y + SLOT.size + 10;
    const overBag = (p) => this.bagOpen && p.worldX >= BAG.x && p.worldX <= BAG.x + BAG.w && p.y >= BAG.y && p.y <= BAG.y + BAG.h;
    this.input.on('dragstart', (p, obj) => {
      const data = obj.getData('drag');
      if (!data) return;
      this.dragging = data;
      this.tip.hide();
      obj.setAlpha(0.3);
      this.ghost = this.add.image(p.worldX, p.y, ITEMS[data.id].icon).setScale(fitScale(this, ITEMS[data.id].icon, 46));
      this.dragLayer.add(this.ghost);
    });
    this.input.on('drag', (p) => {
      if (!this.dragging) return;
      this.ghost.setPosition(p.worldX, p.y);
      this.drawSlot(this.dragging.from === 'bag' && overSlot(p));
    });
    this.input.on('dragend', (p, obj) => {
      const data = this.dragging;
      if (!data) return;
      this.ghost?.destroy();
      if (obj.active) obj.setAlpha(1);
      const mon = state.party[this.index];
      if (data.from === 'bag' && overSlot(p)) {
        const old = mon.heldItem;
        const problem = giveHeldItem(mon, data.id);
        this.note(problem ?? `${mon.name} cầm ${ITEMS[data.id].name}${old ? ` (đã cất ${ITEMS[old].name} vào túi)` : ''}.`);
      } else if (data.from === 'held' && overBag(p)) {
        const id = takeHeldItem(mon);
        this.note(id ? `Đã cất ${ITEMS[id].name} vào túi.` : 'Túi đã đầy món này, không cất được.');
      }
      // Phaser gửi pointerup ngay sau dragend: để cờ kéo tới hết khung hình này để không bị tính là bấm
      this.time.delayedCall(0, () => {
        this.dragging = null;
        this.render();
      });
    });
  }

  add2(obj) {
    this.page.add(obj);
    return obj;
  }

  text(x, y, str, size, color = COLORS.text, extra = {}) {
    return this.add2(this.add.text(x, y, str, textStyle(size, color, extra)));
  }

  render() {
    this.page.removeAll(true);
    const mon = state.party[this.index];
    const species = SPECIES[mon.speciesId];
    this.renderProfile(mon, species);
    this.renderStats(mon, species);
    this.renderMoves(mon);
    this.renderHeldSlot(mon);
    this.renderBag();
  }

  // Nút ◀ / ▶ tròn nhỏ (xem Pokémon trước / sau bằng chuột)
  navButton(x, y, dir) {
    const g = this.add2(this.add.graphics());
    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x2f7de1 : 0x3a4660);
      g.fillCircle(x, y, 13);
      g.fillStyle(0xffffff);
      g.fillTriangle(x + dir * 5, y, x - dir * 4, y - 6, x - dir * 4, y + 6);
    };
    draw(false);
    const zone = this.add2(this.add.zone(x, y, 32, 32).setInteractive({ useHandCursor: true }));
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', (p) => {
      if (p.rightButtonDown()) return;
      const n = state.party.length;
      this.show((this.index + dir + n) % n);
    });
  }

  // Cột trái: hình, tên, giới tính, shiny, cấp, hệ, trạng thái, HP, EXP, tính cách, đặc tính
  renderProfile(mon, species) {
    this.add2(drawPanel(this, 20, 20, 380, 660, 18, true));
    // Số thứ tự trong đội, có nút ◀ ▶ để xem con khác bằng chuột (phím ← →)
    if (state.party.length > 1) {
      this.navButton(318, 48, -1);
      this.navButton(378, 48, 1);
      this.text(348, 48, `${this.index + 1}/${state.party.length}`, 15, MUTED, { fontStyle: 'bold' }).setOrigin(0.5);
    }
    const key = pixelMon(this, mon.speciesId, '', GBA_MON, mon.shiny);
    const glow = this.add2(this.add.graphics());
    glow.fillStyle(TYPES[species.types[0]].color, 0.18);
    glow.fillCircle(210, 150, 92);
    this.add2(this.add.image(210, 236, key).setOrigin(0.5, 1).setScale(fitScale(this, key, GBA_MON * 3)).setAlpha(mon.hp > 0 ? 1 : 0.5));

    // Pokémon shiny: chữ "S" vàng trước tên
    const nameX = withShinyMark(this, (o) => this.add2(o), mon, 44, 256, 32);
    const name = this.text(nameX, 256, mon.name, 32, COLORS.text, { fontStyle: 'bold' });
    const lv = this.text(376, 262, `Lv${mon.level}`, 26, '#4a5266').setOrigin(1, 0);
    const gender = GENDER[mon.gender];
    // Biệt danh dài: thu nhỏ / cắt bớt để không đè lên giới tính và cấp
    fitText(name, lv.x - lv.width - 12 - nameX - (gender ? 30 : 0), 0.7);
    if (gender) this.text(name.x + name.displayWidth + 8, 260, gender.symbol, 28, gender.color, { fontStyle: 'bold' });
    typeBadges(this, 44, 322, species.types).forEach((b) => this.add2(b));
    const tag = monTag(this, 376, 312, mon, 16);
    if (tag) this.add2(tag.setOrigin(1, 0));

    const bars = this.add2(this.add.graphics());
    drawHpBar(bars, 44, 352, 332, mon.hp / mon.maxHp);
    this.add2(hpLabel(this, 44, 352));
    this.text(376, 378, `${mon.hp} / ${mon.maxHp}`, 18, '#4a5266').setOrigin(1, 0);
    const toNext = mon.level >= 100 ? 0 : expToReach(mon, mon.level + 1) - mon.exp;
    this.text(44, 404, `EXP còn ${toNext} để lên cấp`, 16, MUTED);
    bars.fillStyle(0x3a4250);
    bars.fillRoundedRect(44, 428, 332, 8, 4);
    bars.fillStyle(0x48b0f8);
    bars.fillRoundedRect(46, 429, Math.max(4, 328 * expProgress(mon)), 6, 3);

    const nature = NATURES[mon.nature];
    this.text(44, 456, 'TÍNH CÁCH', 14, MUTED, { fontStyle: 'bold' });
    this.text(44, 474, nature.name, 22, COLORS.text, { fontStyle: 'bold' });
    const effect = nature.up ? `+${STAT_NAMES[nature.up]}   −${STAT_NAMES[nature.down]}` : 'Trung tính, không đổi chỉ số';
    this.text(44, 502, effect, 16, nature.up ? '#4a5266' : MUTED);

    const ability = ABILITIES[mon.ability];
    this.text(44, 540, 'ĐẶC TÍNH', 14, MUTED, { fontStyle: 'bold' });
    const an = this.text(44, 558, ability?.name ?? '—', 22, COLORS.text, { fontStyle: 'bold' });
    if (mon.hiddenAbility) {
      this.text(an.x + an.width + 10, 562, 'ẨN', 14, '#ffffff', { fontStyle: 'bold', backgroundColor: '#8a58d0', padding: { x: 7, y: 2 } });
    }
    const desc = this.text(44, 588, ability?.desc ?? '', 15, '#4a5266', { wordWrap: { width: 332 }, lineSpacing: 2, maxLines: 3 });
    if (mon.status) {
      this.text(44, Math.max(640, desc.y + desc.height + 4), `Đang bị ${STATUS_INFO[mon.status].name}`, 16, cssColor(STATUS_INFO[mon.status].color));
    }
  }

  // Bảng chỉ số: gốc / IV / EV / thực tế, màu theo tính cách
  renderStats(mon, species) {
    this.add2(drawPanel(this, 416, 20, 524, 330, 18, true));
    this.text(440, 38, 'CHỈ SỐ', 18, '#3a4660', { fontStyle: 'bold' });
    const cols = [{ x: 640, label: 'Gốc' }, { x: 712, label: 'IV' }, { x: 790, label: 'EV' }, { x: 900, label: 'Thực tế' }];
    for (const c of cols) this.text(c.x, 40, c.label, 15, MUTED, { fontStyle: 'bold' }).setOrigin(1, 0);
    const nature = NATURES[mon.nature];
    const g = this.add2(this.add.graphics());
    STAT_KEYS.forEach((k, i) => {
      const y = 72 + i * 38;
      if (i % 2 === 0) {
        g.fillStyle(0xeef2f8);
        g.fillRoundedRect(434, y - 4, 488, 34, 8);
      }
      const color = nature.up === k ? UP : nature.down === k ? DOWN : COLORS.text;
      const arrow = nature.up === k ? ' ▲' : nature.down === k ? ' ▼' : '';
      this.text(450, y, `${STAT_NAMES[k]}${arrow}`, 18, color);
      this.text(640, y, String(species.base[k]), 18, '#4a5266').setOrigin(1, 0);
      this.text(712, y, String(mon.ivs[k]), 18, mon.ivs[k] === 31 ? '#2f9a50' : '#4a5266').setOrigin(1, 0);
      this.text(790, y, String(mon.evs[k]), 18, '#4a5266').setOrigin(1, 0);
      this.text(900, y, String(k === 'hp' ? mon.maxHp : mon[k]), 20, color, { fontStyle: 'bold' }).setOrigin(1, 0);
    });
    const total = evTotal(mon);
    this.text(450, 304, `Tổng EV: ${total} / ${EV_MAX_TOTAL}`, 16, MUTED);
    const yields = Object.entries(species.evYield).map(([k, n]) => `+${n} ${STAT_SHORT[k]}`).join(', ');
    this.text(900, 304, `Hạ nó được: ${yields}`, 16, MUTED).setOrigin(1, 0);
  }

  renderMoves(mon) {
    this.add2(drawPanel(this, 416, 364, 524, 316, 18, true));
    this.text(440, 382, 'CHIÊU THỨC', 18, '#3a4660', { fontStyle: 'bold' });
    mon.moves.forEach((id, i) => {
      const m = MOVES[id];
      const y = 418 + i * 64;
      const g = this.add2(this.add.graphics());
      g.fillStyle(TYPES[m.type].color, 0.18);
      g.fillRoundedRect(434, y, 488, 56, 10);
      g.fillStyle(TYPES[m.type].color);
      g.fillRoundedRect(434, y, 8, 56, { tl: 10, bl: 10, tr: 0, br: 0 });
      this.text(456, y + 6, m.name, 22, COLORS.text, { fontStyle: 'bold' });
      const detail = `${TYPES[m.type].name} • ${CATEGORY_NAMES[m.category]}${m.power ? ` • Sức mạnh ${m.power}` : ''}`;
      this.text(456, y + 34, detail, 15, MUTED);
      const pp = mon.pp[id];
      this.text(906, y + 14, `PP ${pp}/${m.pp}`, 20, pp === 0 ? '#d04040' : '#3a4660', { fontStyle: 'bold' }).setOrigin(1, 0);
    });
  }
}
