import { SPECIES } from '../data/monsters.js';
import { PHASE_ICONS, timeOfDay } from '../game/clock.js';
import { setSetting, settings } from '../game/settings.js';
import { dexStatus, state } from '../game/state.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { areaLabel, areaSpecies } from './areaSpecies.js';
import { fixToCamera, textStyle } from './helpers.js';

const DEPTH = 100;
const WIDTH = 256; // 5 ô Pokémon + cột nút thu gọn ▶ bên phải
const TOP = 82; // ngay dưới khung đồng hồ 2 dòng (ui/WorldHud.js)
const TAB_W = 30;
const TAB_H = 64;
const ICON = 40;
const GAP = 4;
const PER_ROW = 5;
const DARK = 0x141a2c;
const SLIDE_MS = 220;

// Bảng nhỏ góc phải: bản đồ đang đứng có những Pokémon hoang dã nào, chỉ chia hai nhóm "Trên cạn" (mọi bãi cỏ; trong hang
// là Pokémon của hang đó) và "Dưới nước" (lướt nước + mọi loại cần câu), không phụ thuộc đang đứng gần bãi nào.
// Chỉ có hình Pokémon (tên bản đồ hiện dưới đồng hồ); rê chuột vào hình thì hiện tên loài (chưa gặp: "???"), cấp gặp và buổi.
// Chưa gặp: bóng đen "?"; đã gặp: hiện hình; đã bắt: hiện hình + Poké Ball nhỏ góc dưới phải. Bấm vào Pokémon để mở đúng trang Pokédex.
// Loài chỉ xuất hiện vào một buổi có biểu tượng buổi đó ở góc (☀ ngày, ◐ chạng vạng, ☾ đêm), ngoài buổi đó thì mờ đi.
// Thu gọn thì trượt vào mép phải, chỉ chừa một tab nhỏ; bấm tab để mở lại.
// info: { title, sections: [{ label, tables: [id bảng gặp], dim }] } hoặc null (không có Pokémon hoang dã)

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
    const key = info ? `${this.open}|${caught}|${timeOfDay()}|${info.title}|${info.sections.map((s) => `${s.tables.join('+')}${s.dim}`).join()}` : 'none';
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
    const { width } = scene.scale;
    const c = scene.add.container(0, TOP).setDepth(DEPTH).setVisible(this.visible);
    this.container = c;
    if (this.open) this.renderPanel(c);
    else this.renderTab(c);
    c.x = this.open ? width - 16 - WIDTH : width - TAB_W;
    fixToCamera(c);
  }

  // Tab thu gọn nằm sát mép phải: mũi tên + hình Poké Ball nhỏ
  renderTab(c) {
    const { scene } = this;
    const g = scene.add.graphics();
    g.fillStyle(DARK, 0.82);
    g.fillRoundedRect(0, 0, TAB_W + 12, TAB_H, { tl: 10, bl: 10, tr: 0, br: 0 });
    g.fillStyle(0xffd860);
    g.fillRect(0, 10, 3, TAB_H - 20);
    g.fillStyle(0xffffff);
    g.fillCircle(TAB_W / 2 + 2, 22, 8);
    g.fillStyle(0xe83838);
    g.slice(TAB_W / 2 + 2, 22, 8, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(DARK);
    g.fillRect(TAB_W / 2 - 6, 21, 16, 2);
    c.add(g);
    const arrow = scene.add.text(TAB_W / 2 + 2, 46, '◀', textStyle(14, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
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
    let y = 8;
    const phase = timeOfDay();
    for (const section of this.info.sections) {
      const species = [...areaSpecies(section.tables).entries()];
      if (!species.length) continue;
      c.add(scene.add.text(12, y, section.label, textStyle(12, section.dim ? '#7a84a0' : '#ffd860', { fontStyle: 'bold' })));
      y += 17;
      species.forEach(([id, found], i) => {
        const cx = 12 + (i % PER_ROW) * (ICON + GAP) + ICON / 2;
        const cy = y + Math.floor(i / PER_ROW) * (ICON + GAP) + ICON / 2;
        this.icon(c, id, cx, cy, found, !found.time || found.time === phase);
      });
      y += Math.ceil(species.length / PER_ROW) * (ICON + GAP) + 4;
    }
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
  icon(c, speciesId, cx, cy, found, now = true) {
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
    const key = pixelMon(scene, speciesId, '', 28);
    const img = scene.add.image(cx, cy, key).setScale(fitScale(scene, key, ICON - 6));
    c.add(img);
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
    // Rê chuột: tên loài (chưa gặp thì "???"), cấp gặp, buổi xuất hiện
    const label = areaLabel(seen ? SPECIES[speciesId].name : '???', found);
    const hover = (on) => {
      drawSlot(on);
      if (on) this.showTip(c, label, cx, cy + ICON / 2 + 4);
      else this.hideTip();
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

  // Nhãn tên loài ngay dưới hình đang rê chuột (không tràn ra ngoài mép màn hình)
  showTip(c, label, cx, y) {
    this.hideTip();
    const { scene } = this;
    const t = scene.add.text(0, y, label, textStyle(13, '#ffffff', {
      fontStyle: 'bold', backgroundColor: 'rgba(10,14,26,0.94)', padding: { x: 8, y: 4 },
    })).setOrigin(0.5, 0).setScrollFactor(0);
    const left = 8 - c.x + t.width / 2;
    const right = scene.scale.width - 8 - c.x - t.width / 2;
    t.setX(Math.max(left, Math.min(right, cx)));
    c.add(t);
    this.tip = t;
  }

  hideTip() {
    this.tip?.destroy();
    this.tip = null;
  }
}
