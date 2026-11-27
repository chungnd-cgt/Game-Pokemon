import { SPECIES } from '../data/monsters.js';
import { canHoldWild } from '../data/wildHeld.js';
import { timeOfDay } from '../game/clock.js';
import { setSetting, settings } from '../game/settings.js';
import { dexStatus, state } from '../game/state.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { areaSpecies } from './areaSpecies.js';
import { drawHeldMark } from './heldMark.js';
import { fitText, fixToCamera, hudScale, hudSize, textStyle } from './helpers.js';

const DEPTH = 100;
const PER_ROW = 5;
const CELL_W = 54; // mỗi ô: bệ cỏ hình bầu dục + Pokémon đứng trên
const CELL_H = 52;
const PAD = 12;
const WIDTH = PAD * 2 + PER_ROW * CELL_W;
const TITLE_H = 28;
const TOP = 92; // ngay dưới khung giờ + tên bản đồ (ui/WorldHud.js)
const TAB_W = 20; // tab thu gọn mảnh sát mép phải (chỉ có mũi tên ◀)
const TAB_H = 44;
const HANDLE_W = 16; // tai nhỏ thò ra mép trái bảng (▶ thu gọn)
const DARK = 0x141a2c;
const EDGE = 0x3d4c72;
const ACCENT = 0x48b8e8;
const SLIDE_MS = 220;
// Bệ dưới chân theo nơi gặp: [viền, mặt bệ, vệt sáng]
const PLATFORM = {
  grass: [0x4f9a3a, 0x9ad86a, 0xc8f0a0],
  cave: [0x8a6a40, 0xd2b07a, 0xeed8aa],
  surf: [0x2f78c0, 0x7ab8ec, 0xbfe2ff],
  fish: [0x2f78c0, 0x7ab8ec, 0xbfe2ff],
};

// Bảng nhỏ góc phải "Pokémon ở <bản đồ>": mọi Pokémon hoang dã của bản đồ đang đứng, lưới 5 ô; mỗi Pokémon đứng trên một bệ
// hình bầu dục, màu bệ theo nơi gặp (cỏ: xanh lá, hang / đá: nâu, nước: xanh dương; câu cá: xanh dương + icon cần câu ở
// góc). Loài có ở nhiều nhóm thì chỉ hiện ở nhóm đầu.
// Chưa gặp: chỉ có tấm biển pixel trắng dấu "?" cắm trên bệ, không lộ gì thêm (không có icon cần câu / vật phẩm cầm).
// Đã gặp: hiện hình, cùng icon cần câu (câu cá) và dấu vật phẩm cầm (loài có thể cầm sẵn vật phẩm khi gặp ngoài tự nhiên,
// data/wildHeld.js: thẻ vàng vạch đỏ góc dưới phải, ui/heldMark.js); đã bắt: thêm Poké Ball nhỏ góc dưới trái.
// Loài chỉ xuất hiện vào một buổi: ngoài buổi đó thì mờ đi (không có icon buổi).
// Bấm vào Pokémon để mở đúng trang Pokédex. Rê chuột: sáng viền ô.
// Thu gọn (tai ▶ mép trái) thì trượt vào mép phải, chỉ chừa một tab nhỏ; bấm tab để mở lại.
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

  // Vẽ lại khi khu vực / số loài đã bắt / buổi trong ngày thay đổi
  update(info) {
    this.info = info;
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
    g.lineStyle(2, EDGE, 0.9);
    g.strokeRoundedRect(1, 1, TAB_W + 10, TAB_H - 2, { tl: 8, bl: 8, tr: 0, br: 0 });
    g.fillStyle(ACCENT);
    g.fillRect(0, 10, 3, TAB_H - 20);
    c.add(g);
    const arrow = scene.add.text(TAB_W / 2 + 2, TAB_H / 2, '◀', textStyle(14, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    c.add(arrow);
    this.button(c, TAB_W / 2, TAB_H / 2, TAB_W, TAB_H, arrow, '#ffffff', () => this.toggle());
  }

  // Vùng bấm có chữ đổi màu khi rê chuột
  button(c, x, y, w, h, label, color, onClick) {
    const hit = this.scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => label?.setColor('#ffd860'));
    hit.on('pointerout', () => label?.setColor(color));
    hit.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      onClick();
    });
    c.add(hit);
    return hit;
  }

  renderPanel(c) {
    const { scene } = this;
    const info = this.info;
    const bg = scene.add.graphics();
    c.add(bg);
    const phase = timeOfDay();
    const shown = new Set();
    const all = [];
    for (const section of info.sections) {
      for (const [id, found] of areaSpecies(section.tables)) {
        if (shown.has(id)) continue;
        shown.add(id);
        all.push([id, found, section.kind]);
      }
    }
    // Tiêu đề "Pokémon ở <bản đồ>"
    const title = scene.add.text(PAD, 8, `Pokémon ở ${info.title}`, textStyle(13, '#7fd4ff', { fontStyle: 'bold' }));
    fitText(title, WIDTH - PAD * 2, 0.75);
    c.add(title);
    const gridTop = TITLE_H;
    all.forEach(([id, found, kind], i) => {
      const x0 = PAD + (i % PER_ROW) * CELL_W;
      const y0 = gridTop + Math.floor(i / PER_ROW) * CELL_H;
      this.icon(c, id, x0, y0, !found.time || found.time === phase, kind);
    });
    const rows = Math.max(1, Math.ceil(all.length / PER_ROW));
    const height = gridTop + rows * CELL_H + 8;
    // Nền bảng + tai ▶ thu gọn thò ra mép trái
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(2, 3, WIDTH, height, 10);
    bg.fillStyle(DARK, 0.86);
    bg.fillRoundedRect(0, 0, WIDTH, height, 10);
    bg.lineStyle(2, EDGE, 0.9);
    bg.strokeRoundedRect(1, 1, WIDTH - 2, height - 2, 9);
    bg.fillStyle(DARK, 0.92);
    bg.fillRoundedRect(-HANDLE_W, 8, HANDLE_W + 4, 34, { tl: 7, bl: 7, tr: 0, br: 0 });
    bg.lineStyle(2, EDGE, 0.9);
    bg.strokeRoundedRect(-HANDLE_W + 1, 9, HANDLE_W + 2, 32, { tl: 6, bl: 6, tr: 0, br: 0 });
    const arrow = scene.add.text(-HANDLE_W / 2 + 1, 25, '▶', textStyle(11, '#c8d0e8', { fontStyle: 'bold' })).setOrigin(0.5);
    c.add(arrow);
    this.button(c, -HANDLE_W / 2 + 1, 25, HANDLE_W + 4, 36, arrow, '#c8d0e8', () => this.toggle());
    // Chặn bấm xuyên bảng xuống bản đồ (bấm vào chỗ trống của bảng không làm nhân vật đi)
    const block = scene.add.zone(WIDTH / 2, height / 2, WIDTH, height).setInteractive();
    block.on('pointerdown', (p, lx, ly, e) => e?.stopPropagation());
    c.addAt(block, 1);
  }

  // Một ô: bệ bầu dục + Pokémon (chưa gặp: biển "?"). (x0, y0): góc trái trên ô • now: đang xuất hiện vào buổi hiện tại (ngoài buổi thì mờ)
  icon(c, speciesId, x0, y0, now = true, kind = 'grass') {
    const { scene } = this;
    const dexId = SPECIES[speciesId].dexId;
    const status = dexStatus(dexId);
    const caught = status === 'caught';
    const seen = status !== 'unknown';
    const cx = x0 + CELL_W / 2;
    const py = y0 + CELL_H - 12; // tâm bệ
    const slot = scene.add.graphics();
    const drawSlot = (hover) => {
      slot.clear();
      if (!hover) return;
      slot.fillStyle(0xffffff, 0.12);
      slot.fillRoundedRect(x0 + 2, y0 + 1, CELL_W - 4, CELL_H - 2, 8);
      slot.lineStyle(2, 0xffd860, 0.9);
      slot.strokeRoundedRect(x0 + 2, y0 + 1, CELL_W - 4, CELL_H - 2, 8);
    };
    drawSlot(false);
    c.add(slot);
    // Bệ bầu dục: viền đậm, mặt bệ, vệt sáng phía trên
    const [edge, face, light] = PLATFORM[kind] ?? PLATFORM.grass;
    const plat = scene.add.graphics();
    plat.fillStyle(0x000000, 0.3);
    plat.fillEllipse(cx, py + 2, 44, 15);
    plat.fillStyle(edge, 1);
    plat.fillEllipse(cx, py, 44, 15);
    plat.fillStyle(face, 1);
    plat.fillEllipse(cx, py - 1, 40, 11);
    plat.fillStyle(light, 0.9);
    plat.fillEllipse(cx - 3, py - 3, 24, 4);
    c.add(plat);
    let img = null;
    if (seen) {
      const key = pixelMon(scene, speciesId, '', 28);
      img = scene.add.image(cx, py + 2, key).setOrigin(0.5, 1).setScale(fitScale(scene, key, 36));
      c.add(img);
    } else {
      // Chưa gặp: tấm biển "?" lơ lửng ngay trên bệ (không cọc)
      img = scene.add.image(cx, py - 4, unknownSign(scene)).setOrigin(0.5, 1).setScale(SIGN_SCALE);
      c.add(img);
    }
    // Câu cá: huy hiệu tròn nhỏ có cần câu ở góc trái trên (chỉ khi đã biết loài này)
    if (kind === 'fish' && seen) {
      const rod = scene.add.graphics();
      const bx = x0 + 9;
      const by = y0 + 9;
      rod.fillStyle(DARK, 0.92);
      rod.fillCircle(bx, by, 8);
      rod.lineStyle(1, 0x3a88e0, 0.9);
      rod.strokeCircle(bx, by, 8);
      drawRod(rod, bx - 5, by - 5);
      c.add(rod);
    }
    let ball = null;
    if (caught && scene.textures.exists('ball')) {
      ball = scene.add.image(cx - 19, py + 1, 'ball').setScale(fitScale(scene, 'ball', 11));
      c.add(ball);
    }
    // Có thể cầm sẵn vật phẩm khi gặp ngoài tự nhiên (chỉ khi đã biết loài này)
    let held = null;
    if (seen && canHoldWild(speciesId)) {
      held = drawHeldMark(scene.add.graphics(), cx + 19, py + 1, 8);
      c.add(held);
    }
    if (!now) {
      plat.setAlpha(0.45);
      img.setAlpha(0.35);
      ball?.setAlpha(0.5);
      held?.setAlpha(0.5);
    }
    const zone = scene.add.zone(cx, y0 + CELL_H / 2, CELL_W - 2, CELL_H).setInteractive({ useHandCursor: true });
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

// Tấm biển pixel (loài chưa gặp): mặt biển trắng viền sẫm, dấu "?" xanh than. Vẽ một lần thành
// texture, mỗi điểm ảnh SIGN_PX px rồi thu nhỏ (SIGN_SCALE): nét, không nhoè khi phóng to giao diện / màn hình lớn
const SIGN = [
  '..KKKKKKKKK..',
  '.KWWWWWWWWWK.',
  'KWWWWDDDWWWWK',
  'KWWWDDWDDWWWK',
  'KWWWWWWDDWWWK',
  'KWWWWWDDWWWWK',
  'KWWWWDDWWWWWK',
  'KWWWWDDWWWWWK',
  'KWWWWWWWWWWWK',
  'KWWWWDDWWWWWK',
  'KLLLLLLLLLLLK',
  '.KKKKKKKKKKK.',
];
const SIGN_COLORS = { K: '#3a4258', W: '#f6f8fc', L: '#c4cad8', D: '#2a3450' };
const SIGN_PX = 4;
const SIGN_SCALE = 2 / SIGN_PX; // 2 px giao diện mỗi điểm ảnh: biển 26 x 24
const SIGN_KEY = 'area-unknown-sign';

function unknownSign(scene) {
  if (scene.textures.exists(SIGN_KEY)) return SIGN_KEY;
  const tex = scene.textures.createCanvas(SIGN_KEY, SIGN[0].length * SIGN_PX, SIGN.length * SIGN_PX);
  const ctx = tex.getContext();
  SIGN.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!SIGN_COLORS[ch]) return;
      ctx.fillStyle = SIGN_COLORS[ch];
      ctx.fillRect(x * SIGN_PX, y * SIGN_PX, SIGN_PX, SIGN_PX);
    });
  });
  tex.refresh();
  return SIGN_KEY;
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
