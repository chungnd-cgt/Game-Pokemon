// Cần gạt tròn kiểu game điện thoại trên bản đồ (thay phím chữ thập + nút A / B cảm ứng trước kia).
// Chạm (hoặc nhấn chuột) vào chỗ trống trên bản đồ rồi kéo: cần gạt hiện ngay dưới ngón tay, kéo về hướng nào thì đi hướng đó
// (4 hướng, theo trục kéo nhiều hơn), thả tay thì dừng. Chạm nhanh rồi thả (không kéo) là "chạm vào bản đồ" (onTap).
// Không nhận chạm bắt đầu trên nút / ô của giao diện (Phaser báo có vật bấm được dưới con trỏ).
// Cố định theo màn hình, vẽ trên mọi thứ của bản đồ nhưng dưới hộp thoại / menu.

const BASE_R = 64; // bán kính vòng nền
const KNOB_R = 28; // bán kính núm
const DRAG_START = 12; // kéo quá chừng này px mới tính là cần gạt (ít hơn là chạm)
const DEAD_ZONE = 18; // trong vùng này chưa đi
const DEPTH = 95;

export class Joystick {
  // opts: { canStart(): được bắt đầu không (đang rảnh), onDir(dir | null), onTap(pointer) }
  constructor(scene, { canStart, onDir, onTap }) {
    this.scene = scene;
    this.canStart = canStart;
    this.onDir = onDir;
    this.onTap = onTap;
    this.pointerId = null;
    this.dir = null;

    this.base = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH).setVisible(false);
    this.base.fillStyle(0x0c1428, 0.35);
    this.base.fillCircle(0, 0, BASE_R);
    this.base.lineStyle(3, 0xffffff, 0.45);
    this.base.strokeCircle(0, 0, BASE_R);
    // Vạch nhỏ chỉ 4 hướng đi được
    this.base.fillStyle(0xffffff, 0.4);
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const cx = dx * (BASE_R - 14);
      const cy = dy * (BASE_R - 14);
      this.base.fillTriangle(cx + dx * 6, cy + dy * 6, cx - dy * 6 - dx * 3, cy - dx * 6 - dy * 3, cx + dy * 6 - dx * 3, cy + dx * 6 - dy * 3);
    }
    this.knob = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 0.1).setVisible(false);
    this.knob.fillStyle(0x000000, 0.25);
    this.knob.fillCircle(2, 4, KNOB_R);
    this.knob.fillStyle(0xf2f4fa, 0.85);
    this.knob.fillCircle(0, 0, KNOB_R);
    this.knob.lineStyle(3, 0x4a88e0, 0.9);
    this.knob.strokeCircle(0, 0, KNOB_R);

    const input = scene.input;
    // Chạm nhiều ngón: thêm con trỏ cho ngón thứ hai (vd một ngón giữ cần gạt, ngón kia bấm ô phím tắt)
    if (input.manager.pointersTotal < 3) input.addPointer(2);
    this.onDown = (p, over) => this.down(p, over);
    this.onMove = (p) => this.move(p);
    this.onUp = (p) => this.up(p);
    input.on('pointerdown', this.onDown);
    input.on('pointermove', this.onMove);
    input.on('pointerup', this.onUp);
    input.on('pointerupoutside', this.onUp);
    scene.events.once('shutdown', () => {
      input.off('pointerdown', this.onDown);
      input.off('pointermove', this.onMove);
      input.off('pointerup', this.onUp);
      input.off('pointerupoutside', this.onUp);
    });
  }

  down(p, over) {
    if (this.pointerId !== null || p.rightButtonDown() || over.length || !this.canStart()) return;
    this.pointerId = p.id;
    this.start = { x: p.x, y: p.y };
    this.dragging = false;
  }

  move(p) {
    if (p.id !== this.pointerId) return;
    const dx = p.x - this.start.x;
    const dy = p.y - this.start.y;
    const dist = Math.hypot(dx, dy);
    if (!this.dragging) {
      if (dist < DRAG_START) return;
      this.dragging = true;
      this.base.setPosition(this.start.x, this.start.y).setVisible(true);
      this.knob.setVisible(true);
    }
    const k = Math.min(1, BASE_R / Math.max(dist, 1));
    this.knob.setPosition(this.start.x + dx * k, this.start.y + dy * k);
    const dir = dist < DEAD_ZONE ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (dir !== this.dir) {
      this.dir = dir;
      this.onDir(dir);
    }
  }

  up(p) {
    if (p.id !== this.pointerId) return;
    const tap = !this.dragging;
    this.release();
    if (tap) this.onTap(p);
  }

  // Thả cần gạt (thả tay, hoặc bản đồ bắt đầu một sự kiện / mở menu)
  release() {
    this.pointerId = null;
    this.dragging = false;
    this.base.setVisible(false);
    this.knob.setVisible(false);
    if (this.dir) {
      this.dir = null;
      this.onDir(null);
    }
  }
}
