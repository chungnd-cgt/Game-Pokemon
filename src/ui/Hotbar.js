import { ITEMS } from '../data/items.js';
import { itemCount, state } from '../game/state.js';
import { fitScale } from '../gfx/textures.js';
import { HOTBAR_ACTIONS, bindingsVersion, keysFor, shortKeyName } from '../game/keybinds.js';
import { textStyle } from './helpers.js';

const DEPTH = 100;
const SLOT = 46;
const GAP = 6;
// Ô tiền nằm giữa nút menu ≡ và thanh phím tắt (ui/WorldHud.js)
export const MONEY_W = 118;
const LEFT = 16 + 46 + 8 + MONEY_W + 8; // bên phải nút menu ≡ và ô tiền
const DARK = 0x141a2c;
export const HOTBAR_SIZE = 6;
// Mép phải thanh phím tắt (ui/WorldHud.js đặt dòng báo "Đã lưu" bên phải chỗ này)
export const HOTBAR_RIGHT = LEFT + HOTBAR_SIZE * SLOT + (HOTBAR_SIZE - 1) * GAP;

const DRAG_START = 8; // nhấn giữ rồi kéo quá chừng này px mới tính là kéo (ít hơn là bấm để dùng)

// Thanh phím tắt góc dưới màn hình: 6 ô, góc mỗi ô ghi phím của ô đó (mặc định 1-6, đổi trong Cài đặt → Phím tắt).
// Mở túi đồ thì thanh vẫn hiện: kéo icon vật phẩm thả vào ô để gán (hoặc chọn vật phẩm -> "Gán phím tắt", hoặc bấm phím
// của ô). Bấm phím của ô hoặc bấm chuột vào ô để dùng (cưỡi thú, câu cá,
// dùng thuốc...); ô còn trống thì không làm gì. Kéo icon từ ô này thả sang ô khác là đổi chỗ hai ô.
// Rê chuột vào ô có đồ: viền sáng và hiện tên vật phẩm phía trên ô.
// Chỉ hiện trên bản đồ, khi không có hội thoại / menu (và khi mở túi đồ).
export class Hotbar {
  // onSwap(a, b): kéo ô a thả vào ô b
  constructor(scene, onUse, onSwap) {
    this.scene = scene;
    this.onUse = onUse;
    this.onSwap = onSwap;
    this.visible = true;
    this.key = null;
    this.hover = -1; // ô đang có vật phẩm kéo lướt qua
    this.pointed = -1; // ô đang rê chuột (không kéo)
    this.active = null;
    this.press = null; // đang nhấn giữ một ô: { slot, id, x, y, ghost }
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH);
    this.onPointerMove = (p) => this.dragMove(p);
    this.onPointerUp = (p) => this.dragEnd(p);
    scene.input.on('pointermove', this.onPointerMove);
    scene.input.on('pointerup', this.onPointerUp);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', this.onPointerMove);
      scene.input.off('pointerup', this.onPointerUp);
    });
  }

  // Vẽ lại khi vật phẩm gán / số lượng / món đang dùng (xe, thú cưỡi) thay đổi
  update(active = null) {
    const ids = state.hotbar ?? [];
    const key = `${ids.map((id) => `${id}:${id ? itemCount(id) : ''}`).join('|')}|${active}|${this.hover}|${this.pointed}|${bindingsVersion()}`;
    if (key === this.key) return;
    this.key = key;
    this.active = active;
    this.render(ids, active);
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    if (!visible) {
      this.cancelDrag();
      this.point(-1);
    }
    this.visible = visible;
    this.container.setVisible(visible);
    for (const z of this.zones ?? []) {
      if (visible) z.setInteractive();
      else z.disableInteractive();
    }
  }

  render(ids, active) {
    const { scene } = this;
    this.container.removeAll(true);
    this.zones?.forEach((z) => z.destroy());
    this.zones = [];
    this.tip?.destroy();
    this.tip = null;
    const top = scene.scale.height - 16 - SLOT;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = LEFT + i * (SLOT + GAP);
      const id = ids[i] ?? null;
      const count = id ? itemCount(id) : 0;
      const lifted = this.press?.ghost && this.press.slot === i; // ô đang bị kéo icon đi
      const on = Boolean(id && active === id) || i === this.hover;
      const pointed = Boolean(id) && i === this.pointed && !this.press?.ghost;
      const g = scene.add.graphics();
      g.fillStyle(pointed ? 0x26304c : DARK, pointed ? 0.92 : 0.78);
      g.fillRoundedRect(x, top, SLOT, SLOT, 10);
      g.lineStyle(i === this.hover ? 3 : 2, on ? 0xffd860 : 0xffffff, on ? 0.9 : pointed ? 0.6 : 0.22);
      g.strokeRoundedRect(x + 1, top + 1, SLOT - 2, SLOT - 2, 9);
      this.container.add(g);
      if (id) {
        const icon = scene.add.image(x + SLOT / 2, top + SLOT / 2 + 1, ITEMS[id].icon);
        icon.setScale(fitScale(scene, ITEMS[id].icon, 30)).setAlpha(lifted ? 0.25 : count > 0 ? 1 : 0.3);
        this.container.add(icon);
        // Vật phẩm quan trọng (xe, cần câu, thú cưỡi) chỉ có 1 cái: không hiện số lượng
        if (ITEMS[id].kind !== 'key') {
          this.container.add(scene.add.text(x + SLOT - 4, top + SLOT - 2, `${count}`, textStyle(12, count > 0 ? '#ffffff' : '#ff9a9a', {
            fontStyle: 'bold', stroke: '#141a2c', strokeThickness: 3,
          })).setOrigin(1, 1));
        }
      }
      // Phím của ô (phím chính, chưa có thì phím phụ; không gán phím nào thì để trống)
      const keyText = shortKeyName(keysFor(HOTBAR_ACTIONS[i])[0]);
      if (keyText) this.container.add(scene.add.text(x + 5, top + 3, keyText, textStyle(12, '#ffd860', { fontStyle: 'bold', stroke: '#141a2c', strokeThickness: 3 })));
      const zone = scene.add.zone(x + SLOT / 2, top + SLOT / 2, SLOT, SLOT).setScrollFactor(0).setDepth(DEPTH + 1)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (p, lx, ly, e) => {
        e?.stopPropagation();
        // Ô trống: không làm gì. Ô có đồ: thả chuột tại chỗ là dùng, kéo đi là đổi chỗ
        if (id) this.press = { slot: i, id, x: p.x, y: p.y, ghost: null };
      });
      if (!this.visible) zone.disableInteractive();
      this.zones.push(zone);
      // Tên vật phẩm phía trên ô đang rê chuột
      if (pointed) {
        this.tip = scene.add.text(x + SLOT / 2, top - 3, ITEMS[id].name, textStyle(12, '#ffffff', {
          fontStyle: 'bold', backgroundColor: 'rgba(10,14,26,0.92)', padding: { x: 7, y: 3 },
        })).setOrigin(0.5, 1).setScrollFactor(0).setDepth(DEPTH + 11); // trên khung túi đồ (đang mở túi vẫn đọc được)
        this.tip.setX(Math.max(8 + this.tip.width / 2, this.tip.x)).setVisible(this.visible);
      }
    }
  }

  // Ô đang rê chuột (-1: không ô nào), vẽ lại ngay
  point(i) {
    if (i === this.pointed) return;
    this.pointed = i;
    this.update(this.active);
  }

  dragMove(p) {
    const press = this.press;
    if (!press) {
      // Rê chuột (không kéo): ô có đồ dưới con trỏ sáng lên kèm tên. Tính theo toạ độ chứ không theo pointerover của ô,
      // vì vẽ lại thanh là tạo ô bấm mới (ô cũ bị huỷ thì không bao giờ nhận pointerout)
      const slot = this.visible ? this.slotAt(p.x, p.y) : -1;
      this.point(slot >= 0 && state.hotbar?.[slot] ? slot : -1);
      return;
    }
    if (!press.ghost) {
      if (Math.hypot(p.x - press.x, p.y - press.y) < DRAG_START) return;
      this.pointed = -1;
      const icon = ITEMS[press.id].icon;
      press.ghost = this.scene.add.image(p.x, p.y, icon).setScrollFactor(0).setDepth(DEPTH + 20)
        .setScale(fitScale(this.scene, icon, 34));
      this.key = null; // vẽ lại để làm mờ ô gốc
    }
    press.ghost.setPosition(p.x, p.y);
    const over = this.slotAt(p.x, p.y);
    this.highlight(over === press.slot ? -1 : over);
  }

  dragEnd(p) {
    const press = this.press;
    if (!press) return;
    this.press = null;
    if (!press.ghost) {
      // Bấm (không kéo): dùng vật phẩm của ô nếu vẫn thả chuột trên ô đó
      this.key = null;
      if (this.slotAt(p.x, p.y) === press.slot) this.onUse(press.slot);
      return;
    }
    press.ghost.destroy();
    const target = this.slotAt(p.x, p.y);
    this.hover = -1;
    this.key = null;
    if (target >= 0 && target !== press.slot) {
      this.onSwap?.(press.slot, target);
      this.flash(target);
    }
    this.update(this.active);
  }

  cancelDrag() {
    this.press?.ghost?.destroy();
    this.press = null;
    this.hover = -1;
    this.key = null;
  }

  // Ô nằm dưới điểm (px, py) trên màn hình, hoặc -1 (thả vật phẩm kéo từ túi đồ)
  slotAt(px, py) {
    const top = this.scene.scale.height - 16 - SLOT;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const x = LEFT + i * (SLOT + GAP);
      if (px >= x - GAP / 2 && px <= x + SLOT + GAP / 2 && py >= top - 10 && py <= top + SLOT + 10) return i;
    }
    return -1;
  }

  // Vùng thanh phím tắt (bấm chuột ở đây không đóng túi đồ)
  contains(px, py) {
    const top = this.scene.scale.height - 16 - SLOT;
    return px >= LEFT - GAP && px <= LEFT + HOTBAR_SIZE * (SLOT + GAP) && py >= top - 10 && py <= top + SLOT + 10;
  }

  // Sáng viền ô i (-1: bỏ sáng), vẽ lại ngay
  highlight(i) {
    if (i === this.hover) return;
    this.hover = i;
    this.update(this.active);
  }

  // flash: ô vừa được gán nháy sáng một lúc
  flash(i) {
    this.highlight(i);
    this.scene.time.delayedCall(400, () => this.hover === i && this.highlight(-1));
  }
}
