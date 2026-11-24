import { SPECIES } from '../data/monsters.js';
import { PHASE_ICONS, timeOfDay } from '../game/clock.js';
import { setSetting, settings } from '../game/settings.js';
import { dexStatus, state } from '../game/state.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { areaSpecies } from './areaSpecies.js';
import { fixToCamera, hudScale, hudSize, textStyle } from './helpers.js';

const DEPTH = 100;
const WIDTH = 286; // 5 ô Pokémon + cột nút thu gọn ▶ bên phải
const TOP = 92; // ngay dưới khung giờ + tên bản đồ (ui/WorldHud.js)
const TAB_W = 20; // tab thu gọn mảnh sát mép phải (chỉ có mũi tên ◀)
const TAB_H = 44;
const ICON = 46;
const GAP = 4;
const PER_ROW = 5;
const DARK = 0x141a2c;
const SLIDE_MS = 220;
// Màu bóng dưới chân theo nơi gặp
const GROUND = { grass: 0x58b040, cave: 0x9a7048, surf: 0x3a88e0, fish: 0x3a88e0 };

// Bảng nhỏ góc phải: bản đồ đang đứng có những Pokémon hoang dã nào, một lưới chung không chia nhóm bằng chữ: nơi gặp
// phân biệt bằng màu bóng dưới chân (cỏ: xanh lá, hang / đá: nâu, nước: xanh dương; câu cá: xanh dương + icon cần câu ở
// góc), không phụ thuộc đang đứng gần bãi nào. Loài có ở nhiều nhóm thì chỉ hiện ở nhóm đầu.
// Chỉ có hình Pokémon (tên bản đồ hiện dưới đồng hồ); rê chuột vào hình thì hiện tên loài (chưa gặp: "???"), cấp gặp và buổi.
// Chưa gặp: bóng đen "?"; đã gặp: hiện hình; đã bắt: hiện hình + Poké Ball nhỏ góc dưới phải. Bấm vào Pokémon để mở đúng trang Pokédex.
// Loài chỉ xuất hiện vào một buổi có biểu tượng buổi đó ở góc (☀ ngày, ◐ chạng vạng, ☾ đêm), ngoài buổi đó thì mờ đi.
// Thu gọn thì trượt vào mép phải, chỉ chừa một tab nhỏ; bấm tab để mở lại.
// Cỡ giao diện (helpers.js hudScale): vẽ theo toạ độ ảo, container phóng to theo hệ số
// info: { title, sections: [{ kind: 'grass' | 'cave' | 'surf' | 'fish', tables: [id bảng gặp] }] } hoặc null

export class AreaNav {
  constructor(scene, onPick) {
    this.scene = scene;
    this.onPick = onPick;
    this.container = null;
    this.key = null;
    this.info = null;
    this.visible = true;
  }

  get open() {
    return settings.areaNavOpen !== false;
  }

  // Vẽ lại khi khu vực / số loài đã bắt / cần câu đang có / buổi trong ngày thay đổi
  update(info) {
    this.info = info;
    // Vẽ lại khi Pokédex có thêm loài đã gặp / đã bắt
    const caught = `${state.dex.seen.size}/${state.dex.caught.size}`;
    const key = info ? `${this.open}|${caught}|${timeOfDay()}|${info.title}|${info.sections.map((s) => `${s.kind}:${s.tables.join('+')}`).join()}|${hudScale(this.scene)}` : 'none';
    if (key === this.key || this.sliding) return;
    this.key = key;
    this.render();
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    this.container?.setVisible(visible);
    if (!visible) this.unhover?.();
  }

  // Trượt ra / vào mép phải
  toggle() {
    if (this.sliding) return;
    const { width } = this.scene.scale;
    this.sliding = true;
    const out = this.open;
    this.scene.tweens.add({
      targets: this.container,
      x: width,
      duration: SLIDE_MS,
      ease: 'Quad.in',
      onComplete: () => {
        setSetting('areaNavOpen', !out);
        this.render();
        // Vừa sang bản đồ không có Pokémon hoang dã: không còn bảng để trượt vào
        if (!this.container) {
          this.sliding = false;
          return;
        }
        const target = this.container.x;
        this.container.x = width;
        this.scene.tweens.add({
          targets: this.container,
          x: target,
          duration: SLIDE_MS,
          ease: 'Quad.out',
          onComplete: () => {
            this.sliding = false;
          },
        });
      },
    });
  }

  render() {
    this.container?.destroy();
    this.container = null;
    this.tip = null;
    this.unhover = null;
    if (!this.info) return;
    const { scene } = this;
    const { width, s } = hudSize(scene);
    const c = scene.add.container(0, TOP * s).setDepth(DEPTH).setVisible(this.visible).setScale(s);
    this.container = c;
    if (this.open) this.renderPanel(c);
    else this.renderTab(c);
    c.x = (this.open ? width - 16 - WIDTH : width - TAB_W) * s;
    fixToCamera(c);
  }

  // Tab thu gọn mảnh nằm sát mép phải, chỉ có mũi tên ◀ (gọn, dễ nhìn)
  renderTab(c) {
    const { scene } = this;
    const g = scene.add.graphics();
    g.fillStyle(DARK, 0.85);
    g.fillRoundedRect(0, 0, TAB_W + 10, TAB_H, { tl: 9, bl: 9, tr: 0, br: 0 });
    g.lineStyle(2, 0x3d4c72, 0.9);
    g.strokeRoundedRect(1, 1, TAB_W + 10, TAB_H - 2, { tl: 8, bl: 8, tr: 0, br: 0 });
    g.fillStyle(0xffd860);
    g.fillRect(0, 10, 3, TAB_H - 20);
    c.add(g);
    const arrow = scene.add.text(TAB_W / 2 + 2, TAB_H / 2, '◀', textStyle(14, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    c.add(arrow);
    const hit = scene.add.zone(TAB_W / 2, TAB_H / 2, TAB_W, TAB_H).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => arrow.setColor('#ffd860'));
    hit.on('pointerout', () => arrow.setColor('#ffffff'));
    hit.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.toggle();
    });
    c.add(hit);
  }

  renderPanel(c) {
    const { scene } = this;
    const bg = scene.add.graphics();
    c.add(bg);
    let y = 10;
    const phase = timeOfDay();
    const shown = new Set();
    const all = [];
    for (const section of this.info.sections) {
      for (const [id, found] of areaSpecies(section.tables)) {
        if (shown.has(id)) continue;
        shown.add(id);
        all.push([id, found, section.kind]);
      }
    }
    all.forEach(([id, found, kind], i) => {
      const cx = 12 + (i % PER_ROW) * (ICON + GAP) + ICON / 2;
      const cy = y + Math.floor(i / PER_ROW) * (ICON + GAP) + ICON / 2;
      this.icon(c, id, cx, cy, found, !found.time || found.time === phase, kind);
    });
    y += Math.ceil(all.length / PER_ROW) * (ICON + GAP) + 4;
    // Nút thu gọn: cột bên phải
    const arrow = scene.add.text(WIDTH - 11, 8 + ICON / 2, '▶', textStyle(13, '#c8d0e8', { fontStyle: 'bold' })).setOrigin(0.5);
    c.add(arrow);
    const hit = scene.add.zone(WIDTH - 11, (y + 2) / 2, 22, y + 2).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => arrow.setColor('#ffd860'));
    hit.on('pointerout', () => arrow.setColor('#c8d0e8'));
    hit.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.toggle();
    });
    c.add(hit);
    bg.fillStyle(DARK, 0.82);
    bg.fillRoundedRect(0, 0, WIDTH, y + 2, 10);
    bg.fillStyle(0xffd860);
    bg.fillRect(0, 8, 3, 18);
  }

  // found: { time: buổi loài này xuất hiện (null = cả ngày), min, max } • now: đang xuất hiện vào buổi hiện tại
  icon(c, speciesId, cx, cy, found, now = true, kind = 'grass') {
    const { scene } = this;
    const { time } = found;
    const dexId = SPECIES[speciesId].dexId;
    // Chưa gặp: bóng đen "?" • đã gặp: hiện hình • đã bắt: hiện hình + Poké Ball nhỏ góc dưới phải
    const status = dexStatus(dexId);
    const caught = status === 'caught';
    const seen = status !== 'unknown';
    const slot = scene.add.graphics();
    const drawSlot = (hover) => {
      slot.clear();
      slot.fillStyle(0xffffff, hover ? 0.28 : caught ? 0.16 : 0.07);
      slot.fillRoundedRect(cx - ICON / 2, cy - ICON / 2, ICON, ICON, 8);
      if (hover) {
        slot.lineStyle(2, 0xffd860, 0.9);
        slot.strokeRoundedRect(cx - ICON / 2 + 1, cy - ICON / 2 + 1, ICON - 2, ICON - 2, 7);
      }
    };
    drawSlot(false);
    c.add(slot);
    // Bóng dưới chân theo nơi gặp
    const ground = scene.add.graphics();
    ground.fillStyle(GROUND[kind] ?? GROUND.grass, 0.85);
    ground.fillEllipse(cx, cy + ICON / 2 - 8, ICON - 14, 9);
    c.add(ground);
    const key = pixelMon(scene, speciesId, '', 28);
    const img = scene.add.image(cx, cy - 1, key).setScale(fitScale(scene, key, ICON - 14));
    c.add(img);
    // Câu cá: huy hiệu tròn nhỏ có cần câu ở góc trái trên (nằm trên hình, không đè lên thân Pokémon)
    if (kind === 'fish') {
      const rod = scene.add.graphics();
      const bx = cx - ICON / 2 + 8;
      const by = cy - ICON / 2 + 8;
      rod.fillStyle(DARK, 0.92);
      rod.fillCircle(bx, by, 8);
      rod.lineStyle(1, 0x3a88e0, 0.9);
      rod.strokeCircle(bx, by, 8);
      drawRod(rod, bx - 5, by - 5);
      c.add(rod);
    }
    if (!seen) {
      img.setTintFill(0x070a12);
      c.add(scene.add.text(cx, cy, '?', textStyle(16, '#c8d0e8', { fontStyle: 'bold' })).setOrigin(0.5));
    }
    let ball = null;
    if (caught && scene.textures.exists('ball')) {
      ball = scene.add.image(cx + ICON / 2 - 7, cy + ICON / 2 - 7, 'ball').setScale(fitScale(scene, 'ball', 11));
      c.add(ball);
    }
    if (!now) {
      slot.setAlpha(0.45);
      img.setAlpha(0.35);
      ball?.setAlpha(0.5);
    }
    if (time) {
      c.add(scene.add.text(cx + ICON / 2 - 2, cy - ICON / 2 + 1, PHASE_ICONS[time], textStyle(12, now ? '#ffd860' : '#8a94b0', { fontStyle: 'bold' })).setOrigin(1, 0));
    }
    const zone = scene.add.zone(cx, cy, ICON, ICON).setInteractive({ useHandCursor: true });
    // Rê chuột: chỉ sáng viền ô (không hiện nhãn tên / cấp)
    const hover = (on) => {
      drawSlot(on);
      this.unhover = on ? () => hover(false) : null;
    };
    zone.on('pointerover', () => hover(true));
    zone.on('pointerout', () => hover(false));
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      hover(false);
      this.onPick(speciesId);
    });
    c.add(zone);
  }
}

// Cần câu nhỏ (cán nâu chéo, dây trắng, phao đỏ): góc (x, y) là đầu cán
function drawRod(g, x, y) {
  g.lineStyle(2, 0xc08040);
  g.lineBetween(x, y + 9, x + 7, y);
  g.lineStyle(1, 0xe8ecf6, 0.9);
  g.lineBetween(x + 7, y, x + 9, y + 7);
  g.fillStyle(0xe04848);
  g.fillCircle(x + 9, y + 8, 1.8);
}
