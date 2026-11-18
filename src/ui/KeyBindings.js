import Phaser from 'phaser';
import { KEY_ACTIONS, canBind, clearBinding, getBindings, keyName, resetBindings, setBinding } from '../game/keybinds.js';
import { COLORS, closeButton, drawPanel, fixToCamera, localX, textStyle, uiX } from './helpers.js';
import { directionOf, isCancel, isConfirm } from './input.js';

// Màn Cài đặt → Phím tắt: mỗi hành động một dòng, hai ô phím (chính / phụ).
//  Bấm vào ô (hoặc chọn bằng phím hướng rồi bấm phím xác nhận): ô nhấp nháy "…", phím bấm tiếp theo được gán cho ô đó
//  (kể cả Esc / Enter). Bấm lại đúng phím cũ hoặc bấm chuột ra chỗ khác là thôi. Delete: bỏ phím của ô.
//  Phím đã thuộc hành động khác thì hai bên đổi phím cho nhau, dòng bị đổi sáng vàng một lúc; không đổi được (một hành
//  động bắt buộc sẽ mất hết phím) thì dòng đó sáng đỏ. Ô đang chọn có nút ✕ nhỏ để bỏ phím.
//  Đóng: nút ✕, phím quay lại (theo bảng phím hiện tại), bấm ra ngoài khung hoặc chuột phải.
const W = 700;
const H = 664;
const ROW_H = 40;
const LIST_TOP = 104; // tính từ mép trên khung
const FOOT = 76; // chừa đáy khung cho nút Khôi phục mặc định
const SLOT_W = 150;
const SLOT_H = 32;
const SLOT_X = [342, 508]; // mép trái hai ô phím, tính từ mép trái khung
const VISIBLE = Math.floor((H - LIST_TOP - FOOT) / ROW_H);
const BLUE = 0x2f7de1;
const GOLD = 0xffd860;

export class KeyBindings {
  // opts: { depth, fixed (mặc định true: ghim vào màn hình, không trôi theo camera) }
  constructor(scene, router, opts = {}) {
    this.scene = scene;
    this.router = router;
    this.depth = opts.depth ?? 60;
    this.fixed = opts.fixed ?? true;
    const { width, height } = scene.scale;
    this.x = Math.round((width - W) / 2);
    this.y = Math.round((height - H) / 2);
    this.row = 0; // dòng đang chọn (KEY_ACTIONS.length = nút Khôi phục mặc định)
    this.col = 0; // ô đang chọn: 0 = phím chính, 1 = phím phụ
    this.scroll = 0;
    this.capturing = null; // { row, col } đang chờ phím mới
    this.flashes = new Map(); // dòng đang sáng: id hành động -> 'swap' | 'error'
    this.bounds = new Phaser.Geom.Rectangle(this.x, this.y, W, H);

    const { x, y } = this;
    this.container = scene.add.container(0, 0).setDepth(this.depth);
    this.container.add(drawPanel(scene, x, y, W, H, 18, true));
    this.container.add(scene.add.text(x + 30, y + 20, 'Phím tắt', textStyle(26, '#3a4660', { fontStyle: 'bold' })));
    this.container.add(closeButton(scene, x + W - 34, y + 38, () => this.finish()));
    const head = textStyle(15, '#6a7286', { fontStyle: 'bold' });
    this.container.add(scene.add.text(x + SLOT_X[0] + SLOT_W / 2, y + LIST_TOP - 18, 'Phím chính', head).setOrigin(0.5));
    this.container.add(scene.add.text(x + SLOT_X[1] + SLOT_W / 2, y + LIST_TOP - 18, 'Phím phụ', head).setOrigin(0.5));
    this.list = scene.add.container(0, 0);
    this.container.add(this.list);
    this.foot = scene.add.container(0, 0);
    this.container.add(this.foot);
    this.render();
    if (this.fixed) fixToCamera(this.container).setX(uiX(this.scene));
  }

  open() {
    const openedAt = performance.now();
    this.onWheel = (p, objs, dx, dy) => {
      if (dy && this.bounds.contains(localX(this.scene, p), p.y)) this.scrollBy(Math.sign(dy));
    };
    this.scene.input.on('wheel', this.onWheel);
    // Ô đang chờ phím nhấp nháy
    this.blink = this.scene.time.addEvent({ delay: 380, loop: true, callback: () => {
      if (!this.capturing) return;
      this.blinkOn = !this.blinkOn;
      this.render();
    } });
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set(
        (e) => e.timeStamp >= openedAt && this.handleKey(e),
        (p) => {
          if (p.downTime < openedAt) return;
          // Bấm ra chỗ khác (không phải ô phím) khi đang chờ phím: thôi
          if (this.capturing) return this.stopCapture();
          if (p.rightButtonDown() || !this.bounds.contains(localX(this.scene, p), p.y)) this.finish();
        },
      );
    });
  }

  get resetRow() {
    return KEY_ACTIONS.length;
  }

  handleKey(e) {
    if (this.capturing) {
      if (e.repeat) return;
      e.preventDefault?.();
      this.capture(e.code);
      return;
    }
    const dir = directionOf(e);
    if (dir === 'up' || dir === 'down') {
      this.select(Phaser.Math.Clamp(this.row + (dir === 'up' ? -1 : 1), 0, this.resetRow), this.col);
    } else if (dir === 'left' || dir === 'right') {
      if (this.row < this.resetRow) this.select(this.row, dir === 'left' ? 0 : 1);
    } else if (isConfirm(e)) {
      if (this.row === this.resetRow) this.reset();
      else this.startCapture(this.row, this.col);
    } else if (isCancel(e)) {
      this.finish();
    } else if (e.code === 'Delete' && !e.repeat && this.row < this.resetRow) {
      this.clear(this.row, this.col);
    }
  }

  select(row, col = this.col) {
    this.row = row;
    this.col = col;
    // Giữ dòng đang chọn nằm trong khung
    if (row < this.resetRow) {
      if (row < this.scroll) this.scroll = row;
      else if (row >= this.scroll + VISIBLE) this.scroll = row - VISIBLE + 1;
    }
    this.render();
  }

  scrollBy(n) {
    const next = Phaser.Math.Clamp(this.scroll + n, 0, Math.max(0, KEY_ACTIONS.length - VISIBLE));
    if (next === this.scroll) return;
    this.scroll = next;
    this.render();
  }

  startCapture(row, col) {
    this.row = row;
    this.col = col;
    this.capturing = { row, col };
    this.blinkOn = true;
    this.render();
  }

  stopCapture() {
    this.capturing = null;
    this.render();
  }

  // Phím vừa bấm khi ô đang chờ: Delete bỏ phím của ô, phím không gán được thì báo đỏ, còn lại gán (đổi chỗ nếu trùng)
  capture(code) {
    const { row, col } = this.capturing;
    this.capturing = null;
    const id = KEY_ACTIONS[row].id;
    if (code === 'Delete') {
      this.clear(row, col);
      return;
    }
    if (!canBind(code)) {
      this.flash(id, 'error');
      return;
    }
    const result = setBinding(id, col, code);
    if (!result.ok) {
      if (result.blocked) this.flash(result.blocked, 'error');
      this.flash(id, 'error');
      return;
    }
    for (const other of result.changed) this.flash(other, 'swap');
    this.render();
  }

  clear(row, col) {
    const id = KEY_ACTIONS[row].id;
    if (!getBindings()[id][col]) return this.render();
    if (!clearBinding(id, col)) this.flash(id, 'error');
    else this.render();
  }

  reset() {
    resetBindings();
    for (const a of KEY_ACTIONS) this.flash(a.id, 'swap');
  }

  // Dòng của hành động id sáng lên (vàng: vừa bị đổi phím, đỏ: không đổi được) rồi tắt dần
  flash(id, kind) {
    const token = {};
    this.flashes.set(id, { kind, token });
    this.render();
    this.scene.time.delayedCall(900, () => {
      if (this.done || this.flashes.get(id)?.token !== token) return;
      this.flashes.delete(id);
      this.render();
    });
  }

  render() {
    if (this.done) return;
    const { scene, x, y } = this;
    this.list.removeAll(true);
    this.foot.removeAll(true);
    const bindings = getBindings();
    const g = scene.add.graphics();
    this.list.add(g);
    for (let i = this.scroll; i < Math.min(KEY_ACTIONS.length, this.scroll + VISIBLE); i++) {
      const action = KEY_ACTIONS[i];
      const top = y + LIST_TOP + (i - this.scroll) * ROW_H;
      const cy = top + ROW_H / 2;
      const selected = i === this.row;
      const flash = this.flashes.get(action.id)?.kind;
      // Nền dòng: đang chọn xanh nhạt; vừa đổi phím vàng; không đổi được đỏ
      const bg = flash === 'error' ? 0xffd4d4 : flash === 'swap' ? 0xfff0b8 : selected ? 0xdbe8ff : i % 2 ? 0xf4f6fa : null;
      if (bg !== null) {
        g.fillStyle(bg);
        g.fillRoundedRect(x + 22, top + 2, W - 58, ROW_H - 4, 9);
      }
      this.list.add(scene.add.text(x + 40, cy, action.label, textStyle(19, COLORS.text)).setOrigin(0, 0.5));
      for (const col of [0, 1]) this.renderSlot(g, i, col, bindings[action.id][col], cy, selected && col === this.col);
    }
    // Thanh cuộn mảnh bên phải
    if (KEY_ACTIONS.length > VISIBLE) {
      const trackTop = y + LIST_TOP + 4;
      const trackH = VISIBLE * ROW_H - 8;
      const thumbH = Math.max(30, (trackH * VISIBLE) / KEY_ACTIONS.length);
      const thumbY = trackTop + ((trackH - thumbH) * this.scroll) / (KEY_ACTIONS.length - VISIBLE);
      g.fillStyle(0xe2e8f2);
      g.fillRoundedRect(x + W - 30, trackTop, 6, trackH, 3);
      g.fillStyle(0x9aa8c4);
      g.fillRoundedRect(x + W - 30, thumbY, 6, thumbH, 3);
    }
    this.renderReset();
    if (this.fixed) fixToCamera(this.container).setX(uiX(this.scene));
  }

  renderSlot(g, row, col, code, cy, selected) {
    const { scene } = this;
    const sx = this.x + SLOT_X[col];
    const top = cy - SLOT_H / 2;
    const capturing = this.capturing && this.capturing.row === row && this.capturing.col === col;
    if (capturing) {
      g.fillStyle(this.blinkOn ? GOLD : 0xfff4c8);
      g.fillRoundedRect(sx, top, SLOT_W, SLOT_H, 8);
      g.lineStyle(3, 0xe0a020);
      g.strokeRoundedRect(sx, top, SLOT_W, SLOT_H, 8);
    } else {
      g.fillStyle(code ? 0x2c3550 : 0xffffff);
      g.fillRoundedRect(sx, top, SLOT_W, SLOT_H, 8);
      g.lineStyle(selected ? 3 : 2, selected ? BLUE : code ? 0x2c3550 : 0xc8d0e0);
      g.strokeRoundedRect(sx, top, SLOT_W, SLOT_H, 8);
    }
    const label = capturing ? '…' : code ? keyName(code) : '—';
    const color = capturing ? '#5a3a00' : code ? '#ffffff' : '#a8b0c0';
    this.list.add(scene.add.text(sx + SLOT_W / 2, cy, label, textStyle(capturing ? 22 : 17, color, { fontStyle: 'bold' })).setOrigin(0.5));
    const zone = scene.add.zone(sx + SLOT_W / 2, cy, SLOT_W, SLOT_H).setInteractive({ useHandCursor: true });
    // Vẽ lại là tạo ô mới, nên đổi chọn / bắt đầu chờ phím làm sau khi Phaser xử lý xong sự kiện chuột
    zone.on('pointerover', () => this.later(() => !this.capturing && (this.row !== row || this.col !== col) && this.select(row, col)));
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      // Bấm lại ô đang chờ hoặc chuột phải: thôi chờ phím
      const stop = p.rightButtonDown() || capturing;
      this.later(() => (stop ? this.stopCapture() : this.startCapture(row, col)));
    });
    this.list.add(zone);
    // Nút ✕ nhỏ trong ô đang chọn: bỏ phím
    if (selected && code && !capturing) {
      const bx = sx + SLOT_W - 15;
      g.fillStyle(0x5a6684);
      g.fillCircle(bx, cy, 9);
      g.lineStyle(2, 0xffffff);
      g.lineBetween(bx - 3.5, cy - 3.5, bx + 3.5, cy + 3.5);
      g.lineBetween(bx - 3.5, cy + 3.5, bx + 3.5, cy - 3.5);
      const clear = scene.add.zone(bx, cy, 24, 24).setInteractive({ useHandCursor: true });
      clear.on('pointerdown', (p, lx, ly, e) => {
        e?.stopPropagation();
        this.later(() => this.clear(row, col));
      });
      this.list.add(clear);
    }
  }

  renderReset() {
    const { scene, x, y } = this;
    const selected = this.row === this.resetRow;
    const bw = 260;
    const bh = 42;
    const bx = x + W / 2 - bw / 2;
    const by = y + H - FOOT + 14;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.18);
    g.fillRoundedRect(bx + 2, by + 4, bw, bh, 12);
    g.fillStyle(selected ? 0x5a7fd0 : 0x6a7aa0);
    g.fillRoundedRect(bx, by, bw, bh, 12);
    if (selected) {
      g.lineStyle(3, GOLD);
      g.strokeRoundedRect(bx - 2, by - 2, bw + 4, bh + 4, 13);
    }
    this.foot.add(g);
    this.foot.add(scene.add.text(bx + bw / 2, by + bh / 2, 'Khôi phục mặc định', textStyle(19, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
    const zone = scene.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => this.later(() => !this.capturing && this.row !== this.resetRow && this.select(this.resetRow)));
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.later(() => {
        if (this.capturing) return this.stopCapture();
        this.row = this.resetRow;
        this.reset();
      });
    });
    this.foot.add(zone);
  }

  // Chạy fn ở khung hình sau (màn này còn mở)
  later(fn) {
    this.scene.time.delayedCall(0, () => !this.done && fn());
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.router.clear();
    this.scene.input.off('wheel', this.onWheel);
    this.blink?.remove();
    this.container.destroy();
    this.resolve?.();
  }
}
