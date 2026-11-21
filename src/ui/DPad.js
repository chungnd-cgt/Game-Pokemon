import Phaser from 'phaser';

// Nút điều hướng cảm ứng cố định trên màn hình (Cài đặt → Chung → Hiện D-Pad): cục tròn kiểu cần gạt (vòng nền + núm),
// đặt bên trái (cạnh cột nút menu, trên thanh phím tắt). Chạm / kéo trong vòng về hướng nào thì đi hướng đó (4 hướng, theo
// trục lệch nhiều hơn), núm chạy theo ngón tay; thả tay thì núm về giữa và dừng. Ngón tay trượt ra ngoài vòng vẫn điều
// khiển tiếp. Chạm bắt đầu trên nút này không làm hiện cần gạt kéo-thả (ui/Joystick.js bỏ qua chạm trên vật bấm được).
// Vẽ theo toạ độ giao diện (nhân hệ số cỡ giao diện như các khung HUD khác), vị trí đặt lại mỗi khung hình (WorldScene).

export const DPAD_R = 62; // bán kính vòng nền
const KNOB_R = 27;
const DEAD = 14; // chạm sát tâm: chưa đi
const DEPTH = 99; // trên cần gạt, dưới hộp thoại / menu
const ARROWS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export class DPad {
  // opts: { canUse(): đang được đi không (bản đồ rảnh), onDir(dir | null) }
  constructor(scene, { canUse, onDir }) {
    this.scene = scene;
    this.canUse = canUse;
    this.onDir = onDir;
    this.dir = null;
    this.pointerId = null;
    this.knob = { x: 0, y: 0 }; // lệch khỏi tâm
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH).setVisible(false);
    this.g = scene.add.graphics().setScrollFactor(0);
    // Vùng chạm tròn (toạ độ trong container: tâm ở 0, 0)
    this.zone = scene.add.zone(-DPAD_R, -DPAD_R, DPAD_R * 2, DPAD_R * 2).setOrigin(0).setScrollFactor(0)
      .setInteractive(new Phaser.Geom.Circle(DPAD_R, DPAD_R, DPAD_R + 6), Phaser.Geom.Circle.Contains);
    this.container.add([this.g, this.zone]);
    this.zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      if (this.pointerId !== null || !this.canUse()) return;
      this.pointerId = p.id;
      this.track(lx - DPAD_R, ly - DPAD_R);
    });
    const input = scene.input;
    this.onMove = (p) => {
      if (p.id !== this.pointerId) return;
      const c = this.container;
      this.track((p.x - c.x) / c.scaleX, (p.y - c.y) / c.scaleY);
    };
    this.onUp = (p) => p.id === this.pointerId && this.release();
    input.on('pointermove', this.onMove);
    input.on('pointerup', this.onUp);
    input.on('pointerupoutside', this.onUp);
    scene.events.once('shutdown', () => {
      input.off('pointermove', this.onMove);
      input.off('pointerup', this.onUp);
      input.off('pointerupoutside', this.onUp);
    });
    this.draw();
  }

  // Ngón tay ở (dx, dy) so với tâm: núm chạy theo (không quá vòng), đổi hướng đi
  track(dx, dy) {
    const dist = Math.hypot(dx, dy);
    const k = Math.min(1, (DPAD_R - KNOB_R / 2) / Math.max(dist, 1));
    this.knob = { x: dx * k, y: dy * k };
    const dir = dist < DEAD ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (dir !== this.dir) {
      this.dir = dir;
      this.onDir(dir);
    }
    this.draw();
  }

  // Thả (thả tay, ẩn nút, hoặc bản đồ bắt đầu một sự kiện / mở menu)
  release() {
    this.pointerId = null;
    this.knob = { x: 0, y: 0 };
    if (this.dir) {
      this.dir = null;
      this.onDir(null);
    }
    this.draw();
  }

  // Mỗi khung hình: hiện / ẩn, tâm (px trên màn hình) và hệ số cỡ giao diện
  update(visible, cx, cy, s) {
    if (!visible && this.pointerId !== null) this.release();
    if (visible !== this.container.visible) {
      this.container.setVisible(visible);
      if (visible) this.zone.setInteractive();
      else this.zone.disableInteractive();
    }
    if (visible) this.container.setPosition(cx, cy).setScale(s);
  }

  draw() {
    const { g } = this;
    g.clear();
    // Vòng nền (như cần gạt kéo-thả)
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(2, 4, DPAD_R);
    g.fillStyle(0x0c1428, 0.45);
    g.fillCircle(0, 0, DPAD_R);
    g.lineStyle(3, 0xffffff, 0.45);
    g.strokeCircle(0, 0, DPAD_R);
    // Vạch chỉ 4 hướng; hướng đang đi sáng hơn
    for (const [dir, [ux, uy]] of Object.entries(ARROWS)) {
      const cx = ux * (DPAD_R - 14);
      const cy = uy * (DPAD_R - 14);
      g.fillStyle(this.dir === dir ? 0xffd860 : 0xffffff, this.dir === dir ? 0.95 : 0.45);
      g.fillTriangle(cx + ux * 7, cy + uy * 7, cx - uy * 7 - ux * 3, cy - ux * 7 - uy * 3, cx + uy * 7 - ux * 3, cy + ux * 7 - uy * 3);
    }
    // Núm
    const { x, y } = this.knob;
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(x + 2, y + 4, KNOB_R);
    g.fillStyle(0xf2f4fa, this.dir ? 0.95 : 0.8);
    g.fillCircle(x, y, KNOB_R);
    g.lineStyle(3, 0x4a88e0, 0.9);
    g.strokeCircle(x, y, KNOB_R);
  }
}
