import { STATUS_INFO } from '../battle/status.js';
import { ITEMS } from '../data/items.js';
import { expProgress } from '../game/monster.js';
import { state } from '../game/state.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { GENDER, cssColor, fitText, fixToCamera, hpColor, hudScale, textStyle } from './helpers.js';
import { withShinyMark } from './shinyMark.js';

const DEPTH = 100;
const R = 19; // bán kính vòng HP quanh chân dung
const STEP = 54; // khoảng cách giữa hai hàng theo chiều dọc
const RING = 3; // độ dày vòng HP
const ICON = 28;
const ROW_W = 180; // bề ngang hàng (viên thuốc)
const ROW_H = 46;
const DARK = 0x141a2c;
const DRAG_START = 8; // kéo quá chừng này px mới tính là kéo thả (ít hơn là bấm)

// Cột đội hình góc trái trên (kiểu game MMO): mỗi Pokémon một hàng dạng viên thuốc tối: chân dung tròn bên trái có **vòng HP
// bọc quanh** (xanh / vàng / đỏ, tụt dần theo máu), ký hiệu giới tính + cấp dưới chân dung; bên phải là tên (chữ S vàng nếu
// shiny), thanh HP và thanh EXP mảnh; đồ đang cầm hiện icon nhỏ góc phải, trạng thái xấu là viên màu cạnh tên; kiệt sức thì
// cả hàng xám đi. Rê chuột: sáng viền, hiện % HP. Bấm: mở thẳng màn chi tiết Pokémon. Kéo thả hàng này lên hàng khác: đổi chỗ.
// Cỡ giao diện (helpers.js hudScale): vẽ theo toạ độ ảo, container phóng to theo hệ số
export class PartyPanel {
  // top: mép trên • onPick(index): bấm vào Pokémon thứ index • onSwap(a, b): kéo ô a thả lên ô b
  constructor(scene, top, onPick, onSwap) {
    this.scene = scene;
    this.top = top;
    this.onPick = onPick;
    this.onSwap = onSwap;
    this.container = null;
    this.key = null;
    this.visible = true;
    this.slots = [];
    this.press = null; // đang nhấn giữ một ô: { i, x, y, ghost }
    this.hover = -1;
    this.onPointerMove = (p) => this.dragMove(p);
    this.onPointerUp = (p) => this.dragEnd(p);
    scene.input.on('pointermove', this.onPointerMove);
    scene.input.on('pointerup', this.onPointerUp);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', this.onPointerMove);
      scene.input.off('pointerup', this.onPointerUp);
    });
  }

  update() {
    const key = state.party.map((m) => `${m.uid}:${m.speciesId}:${m.hp}/${m.maxHp}:${m.level}:${m.exp}:${m.status}:${m.shiny}:${m.name}:${m.heldItem}`).join("|") + `|${hudScale(this.scene)}`;
    if (key === this.key) return;
    this.key = key;
    this.render();
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    this.container?.setVisible(visible);
    if (!visible) {
      this.cancelDrag();
      this.setHover(-1);
    }
  }

  // Tâm chân dung của hàng thứ i (toạ độ ảo, xem helpers.js hudSize); hàng bắt đầu từ x = 16
  center(i) {
    return { x: 16 + ROW_H / 2, y: this.top + ROW_H / 2 + i * STEP };
  }

  // Hàng dưới điểm (px, py) trên màn hình, hoặc -1
  slotAt(px, py) {
    const s = hudScale(this.scene);
    px /= s;
    py /= s;
    for (let i = 0; i < state.party.length; i++) {
      const { y } = this.center(i);
      if (px >= 12 && px <= 16 + ROW_W + 4 && Math.abs(py - y) <= ROW_H / 2 + 3) return i;
    }
    return -1;
  }

  render() {
    this.container?.destroy();
    this.container = null;
    this.slots = [];
    this.hover = -1;
    if (!state.party.length) return;
    const { scene } = this;
    const c = scene.add.container(0, 0).setDepth(DEPTH).setVisible(this.visible);
    this.container = c;
    state.party.forEach((mon, i) => this.slot(c, mon, i));
    // Ô thông tin khi rê chuột (tên, cấp, % HP)
    this.tip = scene.add.text(0, 0, '', textStyle(14, '#ffffff', {
      fontStyle: 'bold', backgroundColor: 'rgba(20,26,44,0.92)', padding: { x: 10, y: 5 }, lineSpacing: 2,
    })).setOrigin(0, 0.5).setVisible(false);
    c.add(this.tip);
    fixToCamera(c).setScale(hudScale(scene));
  }

  slot(c, mon, i) {
    const { scene } = this;
    const { x, y } = this.center(i);
    const left = 16;
    const top = y - ROW_H / 2;
    const fainted = mon.hp <= 0;
    const ratio = Math.max(0, Math.min(1, mon.hp / mon.maxHp));
    const exp = Math.max(0, Math.min(1, expProgress(mon)));
    const bx = x + R + 10; // mép trái tên / thanh HP / thanh EXP
    const bw = left + ROW_W - 14 - bx;
    const g = scene.add.graphics();
    const draw = (hover, target = false) => {
      g.clear();
      // viên thuốc nền (bo tròn hai đầu)
      g.fillStyle(0x000000, 0.28);
      g.fillRoundedRect(left + 2, top + 4, ROW_W, ROW_H, ROW_H / 2);
      g.fillStyle(fainted ? 0x3a3e4a : DARK, hover ? 0.95 : 0.84);
      g.fillRoundedRect(left, top, ROW_W, ROW_H, ROW_H / 2);
      if (hover || target) {
        g.lineStyle(2, target ? 0x58d8ff : 0xffd860, 0.95);
        g.strokeRoundedRect(left + 1, top + 1, ROW_W - 2, ROW_H - 2, ROW_H / 2 - 1);
      }
      // chân dung tròn + vòng HP (bắt đầu từ đỉnh, theo chiều kim đồng hồ, dài theo % HP)
      g.fillStyle(0x0a0e1a, 0.9);
      g.fillCircle(x, y, R + RING / 2);
      g.lineStyle(RING, 0x2a3044, 1);
      g.strokeCircle(x, y, R);
      if (ratio > 0) {
        g.lineStyle(RING, hpColor(ratio), 1);
        g.beginPath();
        g.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
        g.strokePath();
      }
      // thanh HP và thanh EXP mảnh bên dưới
      g.fillStyle(0x0a0e1a, 0.95);
      g.fillRoundedRect(bx, top + 25, bw, 7, 3);
      if (ratio > 0) {
        g.fillStyle(hpColor(ratio));
        g.fillRoundedRect(bx + 1, top + 26, Math.max(3, (bw - 2) * ratio), 5, 2);
      }
      g.fillStyle(0x0a0e1a, 0.95);
      g.fillRect(bx, top + 35, bw, 3);
      if (exp > 0) {
        g.fillStyle(0x58b8f0);
        g.fillRect(bx, top + 35, Math.max(1, Math.round(bw * exp)), 3);
      }
    };
    draw(false);
    c.add(g);
    const key = pixelMon(scene, mon.speciesId, '', 28, mon.shiny);
    const icon = scene.add.image(x, y - 2, key).setScale(fitScale(scene, key, ICON));
    if (fainted) icon.setTint(0x8a8a90).setAlpha(0.55);
    c.add(icon);
    // giới tính + cấp dưới chân dung
    const sym = mon.gender ? GENDER[mon.gender].symbol : '';
    c.add(scene.add.text(x, y + R - 1, `${sym}Lv${mon.level}`, textStyle(10, fainted ? '#a0a4b0' : '#ffffff', {
      fontStyle: 'bold', backgroundColor: cssColor(fainted ? 0x3a3e4a : DARK), padding: { x: 3, y: 0 },
    })).setOrigin(0.5));
    // tên (chữ S vàng nếu shiny); đồ cầm góc phải; trạng thái xấu cạnh đó
    const nx = withShinyMark(scene, (o) => c.add(o), mon, bx, top + 5, 13);
    const name = scene.add.text(nx, top + 5, mon.name, textStyle(14, fainted ? '#9aa0ae' : '#ffffff', { fontStyle: 'bold' }));
    c.add(name);
    let right = left + ROW_W - 14;
    if (mon.heldItem && ITEMS[mon.heldItem]) {
      const ic = ITEMS[mon.heldItem].icon;
      c.add(scene.add.image(right - 6, top + 12, ic).setScale(fitScale(scene, ic, 14)));
      right -= 16;
    }
    const info = fainted ? null : STATUS_INFO[mon.status];
    if (info) {
      const tag = scene.add.text(right, top + 12, info.label, textStyle(9, '#ffffff', {
        fontStyle: 'bold', backgroundColor: cssColor(info.color), padding: { x: 3, y: 1 },
      })).setOrigin(1, 0.5);
      c.add(tag);
      right -= tag.width + 4;
    }
    fitText(name, right - nx, 0.8);
    const zone = scene.add.zone(left + ROW_W / 2, y, ROW_W, ROW_H).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => !this.press?.ghost && this.setHover(i));
    zone.on('pointerout', () => this.hover === i && !this.press?.ghost && this.setHover(-1));
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.press = { i, x: p.x, y: p.y, ghost: null };
    });
    c.add(zone);
    this.slots.push({ draw, icon, mon, ratio, fainted });
  }

  // Sáng ô i và hiện ô thông tin bên phải (-1: bỏ)
  setHover(i) {
    if (this.hover >= 0) this.slots[this.hover]?.draw(false);
    this.hover = i;
    if (!this.tip) return;
    if (i < 0 || !this.slots[i]) {
      this.tip.setVisible(false);
      return;
    }
    const { mon, ratio, fainted } = this.slots[i];
    this.slots[i].draw(true);
    const status = fainted ? 'Kiệt sức' : STATUS_INFO[mon.status]?.name ?? null;
    const held = mon.heldItem && ITEMS[mon.heldItem] ? `\nĐang cầm: ${ITEMS[mon.heldItem].name}` : '';
    this.tip.setText(`HP ${Math.ceil(ratio * 100)}%${status ? `  •  ${status}` : ''}${held}`);
    const { y } = this.center(i);
    this.tip.setPosition(16 + ROW_W + 8, y).setVisible(true);
  }

  dragMove(p) {
    const press = this.press;
    if (!press) return;
    if (!press.ghost) {
      if (state.party.length < 2 || Math.hypot(p.x - press.x, p.y - press.y) < DRAG_START) return;
      const mon = state.party[press.i];
      const key = pixelMon(this.scene, mon.speciesId, '', 28, mon.shiny);
      press.ghost = this.scene.add.image(p.x, p.y, key).setScrollFactor(0).setDepth(DEPTH + 20).setScale(fitScale(this.scene, key, ICON + 6) * hudScale(this.scene)).setAlpha(0.9);
      this.slots[press.i]?.icon.setAlpha(0.25);
      this.tip?.setVisible(false);
    }
    press.ghost.setPosition(p.x, p.y);
    const over = this.slotAt(p.x, p.y);
    this.slots.forEach((s, j) => s.draw(j === press.i, j === over && j !== press.i));
  }

  dragEnd(p) {
    const press = this.press;
    if (!press) return;
    this.press = null;
    if (!press.ghost) {
      // Bấm (không kéo): mở màn chi tiết nếu vẫn thả chuột trên ô đó
      if (this.slotAt(p.x, p.y) === press.i) this.onPick(press.i);
      return;
    }
    press.ghost.destroy();
    const target = this.slotAt(p.x, p.y);
    if (target >= 0 && target !== press.i) {
      this.onSwap?.(press.i, target);
      return; // đội đổi chỗ: update() vẽ lại cả cột
    }
    this.key = null; // vẽ lại để bỏ mờ / sáng viền
  }

  cancelDrag() {
    if (!this.press) return;
    this.press.ghost?.destroy();
    this.press = null;
    this.key = null;
  }
}
