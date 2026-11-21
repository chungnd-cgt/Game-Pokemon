import { ABILITIES } from '../data/abilities.js';
import { SPECIES } from '../data/monsters.js';
import { NATURES } from '../data/natures.js';
import { IV_MAX, STAT_KEYS, STAT_NAMES, STAT_SHORT } from '../data/stats.js';
import { TYPES } from '../data/types.js';
import { GBA_MON, fitScale, pixelMon } from '../gfx/textures.js';
import { GENDER, fitText, hudSize, textStyle } from './helpers.js';
import { isCancel, isConfirm } from './input.js';
import { withShinyMark } from './shinyMark.js';

// Bảng xem nhanh Pokémon vừa gửi vào PC (đội đã đủ 6; bật / tắt: Cài đặt → Chung → Xem nhanh khi gửi PC). Hiện trên bản đồ
// sau trận, khung nhỏ nổi lên bên phải ngay trên khung nhiệm vụ, cùng tông màu túi đồ: hình, tên, cấp, hệ, tính cách,
// đặc tính, IV từng chỉ số. Đóng: nút ✕, phím xác nhận / quay lại, hoặc bấm ra ngoài khung.
// Vẽ theo toạ độ giao diện, nhân hệ số cỡ giao diện như các khung HUD khác.

const W = 304;
const H = 268;
const C = { outer: 0x10151f, body: 0x1b2338, edge: 0x3d4c72, field: 0x0e1322, gold: 0xffd860 };
const DIM = '#9aa6c4';
const TEXT = '#e8ecf6';

export class CatchPreview {
  // opts: { depth }
  constructor(scene, router, mon, opts = {}) {
    this.scene = scene;
    this.router = router;
    this.mon = mon;
    const { width, height, s } = hudSize(scene);
    const quest = scene.hud?.questRect;
    // Góc phải, đáy khung cách đỉnh khung nhiệm vụ một chút (không có khung nhiệm vụ thì sát đáy màn hình)
    this.x = width - 16 - W;
    this.y = Math.max(16, (quest ? quest.y : height - 16) - 12 - H);
    this.s = s;
    this.container = scene.add.container(this.x * s, this.y * s).setScale(s).setScrollFactor(0).setDepth(opts.depth ?? 120);
    this.build();
    this.container.list.forEach((o) => o.setScrollFactor?.(0));
  }

  build() {
    const { scene, mon } = this;
    const c = this.container;
    const species = SPECIES[mon.speciesId];
    const nature = NATURES[mon.nature];
    const ability = ABILITIES[mon.ability];
    const g = scene.add.graphics();
    c.add(g);
    // Khung ngoài + thân (như túi đồ)
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(3, 5, W, H, 14);
    g.fillStyle(C.outer);
    g.fillRoundedRect(0, 0, W, H, 14);
    g.fillStyle(C.body);
    g.fillRoundedRect(5, 5, W - 10, H - 10, 11);
    g.lineStyle(2, C.edge);
    g.strokeRoundedRect(5, 5, W - 10, H - 10, 11);
    const text = (x, y, str, size, color = TEXT, extra = {}) => {
      const t = scene.add.text(x, y, str, textStyle(size, color, extra));
      c.add(t);
      return t;
    };
    text(18, 14, 'ĐÃ GỬI VÀO HỘP PC', 12, '#ffd860', { fontStyle: 'bold' });
    // Nút ✕
    const bx = W - 22;
    const by = 22;
    g.fillStyle(0x2a3554);
    g.fillCircle(bx, by, 11);
    g.lineStyle(2, 0xc8d0e8);
    g.lineBetween(bx - 4, by - 4, bx + 4, by + 4);
    g.lineBetween(bx - 4, by + 4, bx + 4, by - 4);
    const close = scene.add.zone(bx, by, 30, 30).setInteractive({ useHandCursor: true });
    close.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.finish();
    });
    c.add(close);

    // Hình + tên, cấp, hệ
    g.fillStyle(C.field);
    g.fillRoundedRect(14, 36, 84, 84, 10);
    const key = pixelMon(scene, mon.speciesId, '', GBA_MON, mon.shiny);
    c.add(scene.add.image(56, 114, key).setOrigin(0.5, 1).setScale(fitScale(scene, key, 76)));
    const nameX = withShinyMark(scene, (o) => c.add(o), mon, 110, 42, 20);
    const name = fitText(text(nameX, 42, mon.name, 20, '#ffffff', { fontStyle: 'bold' }), W - 18 - nameX - 22, 0.75);
    const gender = GENDER[mon.gender];
    if (gender) text(name.x + name.displayWidth + 4, 44, gender.symbol, 17, gender.color, { fontStyle: 'bold' });
    fitText(text(110, 68, `Lv${mon.level}  •  ${species.types.map((t) => TYPES[t].name).join(' / ')}`, 13, DIM), W - 128, 0.8);
    // Tính cách, đặc tính
    text(110, 88, nature.name, 14, '#ffffff', { fontStyle: 'bold' });
    text(W - 18, 89, nature.up ? `+${STAT_NAMES[nature.up]} −${STAT_NAMES[nature.down]}` : 'Trung tính', 12, DIM).setOrigin(1, 0);
    fitText(text(110, 106, `${ability?.name ?? '—'}${mon.hiddenAbility ? ' (ẩn)' : ''}`, 14, mon.hiddenAbility ? '#c8a0ff' : '#ffffff', { fontStyle: 'bold' }), W - 128, 0.8);

    // IV: 3 cột x 2 hàng, thanh theo 0-31 (31 tô xanh lá); tính cách tăng / giảm chỉ số nào thì tên chỉ số đỏ / xanh
    g.fillStyle(C.field);
    g.fillRoundedRect(14, 132, W - 28, H - 146, 10);
    text(24, 140, 'IV', 12, '#ffd860', { fontStyle: 'bold' });
    const total = STAT_KEYS.reduce((sum, st) => sum + mon.ivs[st], 0);
    text(W - 24, 140, `Tổng ${total}/${IV_MAX * 6}`, 12, DIM, { fontStyle: 'bold' }).setOrigin(1, 0);
    const colW = (W - 48) / 3;
    STAT_KEYS.forEach((stat, i) => {
      const bx0 = 24 + (i % 3) * colW;
      const by0 = 162 + Math.floor(i / 3) * 46;
      const iv = mon.ivs[stat];
      const color = nature.up && stat === nature.up ? '#ff7a7a' : nature.up && stat === nature.down ? '#7aa8ff' : DIM;
      text(bx0, by0, STAT_SHORT[stat], 13, color, { fontStyle: 'bold' });
      text(bx0 + colW - 10, by0, String(iv), 14, iv === IV_MAX ? '#6ee08a' : '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0);
      const bw = colW - 10;
      g.fillStyle(0x2a3554);
      g.fillRoundedRect(bx0, by0 + 22, bw, 7, 3.5);
      g.fillStyle(iv === IV_MAX ? 0x3ab060 : iv >= 20 ? 0x48b0f8 : 0x7a86a4);
      g.fillRoundedRect(bx0, by0 + 22, Math.max(6, bw * (iv / IV_MAX)), 7, 3.5);
    });
  }

  // Hiện (trượt nhẹ từ phải vào) rồi chờ đóng
  open() {
    const { scene, container: c } = this;
    const openedAt = performance.now();
    c.setAlpha(0).setX((this.x + 24) * this.s);
    scene.tweens.add({ targets: c, alpha: 1, x: this.x * this.s, duration: 180, ease: 'Quad.out' });
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set(
        (e) => e.timeStamp >= openedAt && (isConfirm(e) || isCancel(e)) && this.finish(),
        (p) => p.downTime >= openedAt && this.finish(),
      );
    });
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.router.clear();
    // Huỷ ở khung hình sau: có thể đang trong sự kiện chuột của chính nút ✕
    this.container.setVisible(false);
    this.scene.time.delayedCall(0, () => this.container.destroy());
    this.resolve?.();
  }
}
