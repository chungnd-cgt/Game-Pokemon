import { ABILITIES } from '../data/abilities.js';
import { ITEMS, formatMoney } from '../data/items.js';
import { SPECIES } from '../data/monsters.js';
import { NATURES } from '../data/natures.js';
import { regionName } from '../data/regions.js';
import { STAT_NAMES } from '../data/stats.js';
import { TYPES } from '../data/types.js';
import { HAPPINESS_MAX, expProgress, hiddenPowerType } from '../game/monster.js';
import { state } from '../game/state.js';
import { releaseMon, releaseProblem } from '../game/storage.js';
import { logSystem } from '../game/systemLog.js';
import { GBA_MON, fitScale, pixelMon } from '../gfx/textures.js';
import { GENDER, closeButton, cssColor, fitText, fixToCamera, hpColor, hudSize, shade, textStyle, uiX } from './helpers.js';
import { CARD, STRIP_H, section, strip } from './monCard.js';
import { shinyGap, shinyMark } from './shinyMark.js';
import { typeBadges } from './TypeBadge.js';
import { FloatWindow } from './Windows.js';

// Bảng xem nhanh Pokémon vừa gửi vào PC (đội đã đủ 6; bật / tắt: Cài đặt → Chung → Xem nhanh khi gửi PC). Cửa sổ nổi
// (ui/Windows.js) như các bảng khác: kéo dải tiêu đề để dời, chỉ đóng bằng nút ✕ (Esc không đóng), vẫn đi lại được.
// Mở ở góc phải, ngay trên khung Hệ thống / Nhiệm vụ. Nền cửa sổ xám, mục nền đen (ui/monCard.js):
//  - Trên: mặt cười + thanh thân thiết, số máu, thanh HP, thanh EXP (tới ngang chỗ số máu); ô đồ cầm góc phải (luôn có,
//    Pokémon hoang dã có thể cầm đồ)
//  - Hai cột rộng bằng nhau, cùng đỉnh cùng đáy: trái Đặc tính / Tính cách / Vùng (nơi bắt, data/regions.js) / Sức mạnh ẩn
//    (tên hệ theo IV); phải hình trên bệ, hệ, bảng chỉ số: giá trị, IV (vàng), EV (xanh)
//  - Đáy: nút thùng rác → hộp hỏi giữa màn hình "Thả ... với giá 200₽?" → thả, báo ở tab Hệ thống, đóng bảng ngay

export const RELEASE_FEE = 200;
const COL = 150;
const PAD = 10;
const W = COL * 2 + PAD * 3;
const HEAD = 30;
const BARS = 40; // hàng thanh thân thiết + số máu, thanh HP, thanh EXP, chừa khoảng trống trước hai cột
const SEC_H = 46; // ô mục cột trái
const SEC_GAP = 5;
const BODY = 4 * SEC_H + 3 * SEC_GAP; // chiều cao phần hai cột (bằng nhau)
const TRASH = 22; // nút thùng rác
const H = HEAD + 8 + BARS + BODY + TRASH + 18;
const SCALE = 0.85;
const STAT_ORDER = ['atk', 'def', 'speed', 'spAtk', 'spDef', 'hp'];
const HELD = 30;
const HAPPY_W = 94; // thanh thân thiết (từ sau mặt cười)
const EXP_W = 144; // thanh EXP (thanh HP dài COL + 20)

export class CatchPreview {
  constructor(manager, mon) {
    this.manager = manager;
    this.scene = manager.scene;
    this.mon = mon;
    manager.get('catch')?.close();
    // Góc phải màn hình, đáy cửa sổ cách đỉnh khung nhiệm vụ một chút (toạ độ khung thiết kế: trừ uiX)
    const { scene } = this;
    const { s } = hudSize(scene);
    const quest = scene.hud?.questRect;
    const bottom = quest ? quest.y * s - 10 : scene.scale.height - 16;
    const x = scene.scale.width - 16 - W * SCALE - uiX(scene);
    const y = Math.max(8, bottom - H * SCALE);
    this.win = new FloatWindow(manager, {
      id: 'catch', rect: { x, y, w: W, h: H }, dragRect: { x, y, w: W - 40, h: HEAD },
      scale: SCALE, // không nhận phím: chỉ đóng bằng nút ✕
      onClose: () => this.closePopup(),
    });
    this.page = this.win.add(scene.add.container(x, y));
    this.render();
    fixToCamera(this.page);
    manager.open(this.win);
    this.win.root.setAlpha(0);
    scene.tweens.add({ targets: this.win.root, alpha: 1, duration: 180, ease: 'Quad.out' });
  }

  add(o) {
    this.page.add(o);
    return o;
  }

  text(x, y, str, size, color = CARD.text, extra = {}) {
    return this.add(this.scene.add.text(x, y, str, textStyle(size, color, extra)));
  }

  // Ô trong hộp PC đang chứa Pokémon này (có thể đã bị dời / thả trong lúc bảng đang mở)
  slot() {
    const i = state.storage.indexOf(this.mon);
    return i >= 0 ? { area: 'box', i } : null;
  }

  render() {
    const { scene, mon } = this;
    const species = SPECIES[mon.speciesId];
    const nature = NATURES[mon.nature];

    // Khung + dải tiêu đề
    const g = this.add(scene.add.graphics());
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(4, 6, W, H, 12);
    g.fillStyle(CARD.frame);
    g.fillRoundedRect(0, 0, W, H, 12);
    g.fillStyle(CARD.head);
    g.fillRoundedRect(0, 0, W, HEAD, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.lineStyle(2, CARD.edge);
    g.strokeRoundedRect(1, 1, W - 2, H - 2, 11);
    const cy = HEAD / 2;
    const ball = ITEMS[mon.ball ?? 'ball'] ?? ITEMS.ball;
    this.add(scene.add.image(17, cy, ball.icon).setScale(fitScale(scene, ball.icon, 18)));
    let nx = 31;
    if (mon.shiny) {
      const mark = this.add(shinyMark(scene, nx, cy, 15).setOrigin(0, 0.5));
      nx += mark.width + shinyGap(15);
    }
    const name = fitText(this.text(nx, cy, mon.name, 15, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5), 110, 0.7);
    let hx = name.x + name.displayWidth + 5;
    const gender = GENDER[mon.gender];
    if (gender) hx += this.text(hx, cy, gender.symbol, 14, gender.color, { fontStyle: 'bold' }).setOrigin(0, 0.5).width + 4;
    this.text(hx, cy + 1, `Lv. ${mon.level}`, 12, '#c8d2ea', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.text(W - 36, cy + 1, 'XEM NHANH', 11, CARD.label, { fontStyle: 'bold' }).setOrigin(1, 0.5);
    closeButton(scene, W - 18, cy, () => this.win.close(), 20).forEach((o) => this.add(o));

    const top = HEAD + 8;
    // ----- Hàng trên: thân thiết + số máu, thanh HP, thanh EXP; ô đồ cầm (góc phải) -----
    // Thanh thân thiết dài HAPPY_W (dừng trước số máu một khoảng), thanh EXP dài EXP_W (tới ngang chỗ số máu bắt đầu,
    // ngắn hơn thanh HP)
    const lx = PAD;
    const rx = PAD * 2 + COL;
    const bw = COL + 20;
    const bars = this.add(scene.add.graphics());
    const happy = Math.max(0, Math.min(1, (mon.happiness ?? 0) / HAPPINESS_MAX));
    drawFace(bars, lx + 7, top + 7, happy);
    const ratio = Math.max(0, Math.min(1, mon.hp / mon.maxHp));
    this.text(lx + bw, top + 7, `${Math.max(0, mon.hp)}/${mon.maxHp}`, 11, ratio > 0.5 ? '#78e098' : '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    const fx = lx + 18;
    const fw = HAPPY_W;
    bars.fillStyle(0x0a0e1a);
    bars.fillRoundedRect(fx, top + 5, fw, 4, 2);
    if (happy > 0) {
      bars.fillStyle(0xf09030);
      bars.fillRoundedRect(fx, top + 5, Math.max(4, fw * happy), 4, 2);
    }
    bars.fillStyle(0x0a0e1a);
    bars.fillRoundedRect(lx, top + 16, bw, 5, 2.5);
    if (ratio > 0) {
      bars.fillStyle(hpColor(ratio));
      bars.fillRoundedRect(lx, top + 16, Math.max(4, bw * ratio), 5, 2.5);
    }
    const exp = Math.max(0, Math.min(1, expProgress(mon)));
    const ew = EXP_W;
    bars.fillStyle(0x0a0e1a);
    bars.fillRoundedRect(lx, top + 25, ew, 3, 1.5);
    if (exp > 0) {
      bars.fillStyle(0x48a8f0);
      bars.fillRoundedRect(lx, top + 25, Math.max(3, ew * exp), 3, 1.5);
    }
    const hg = this.add(scene.add.graphics());
    hg.fillStyle(CARD.section);
    hg.fillRoundedRect(rx + COL - HELD, top, HELD, HELD, 6);
    hg.lineStyle(1.5, CARD.sectionEdge);
    hg.strokeRoundedRect(rx + COL - HELD + 0.5, top + 0.5, HELD - 1, HELD - 1, 6);
    const held = ITEMS[mon.heldItem];
    if (held) this.add(scene.add.image(rx + COL - HELD / 2, top + HELD / 2, held.icon).setScale(fitScale(scene, held.icon, 22)));

    // ----- Hai cột bằng nhau: y0..y1 -----
    const y0 = top + BARS;
    const y1 = y0 + BODY;
    const hp = hiddenPowerType(mon);
    const info = [
      // Đặc tính ẩn: chữ tím (không ghi thêm "(ẩn)")
      ['Đặc tính', ABILITIES[mon.ability]?.name ?? '—', mon.hiddenAbility ? '#c8a0ff' : '#ffffff'],
      ['Tính cách', nature?.name ?? '—'],
      ['Vùng', regionName(mon.region)],
      // Sức mạnh ẩn: chỉ tên hệ (chữ màu hệ, không nền)
      ['Sức mạnh ẩn', TYPES[hp]?.name ?? '—', TYPES[hp] ? cssColor(shade(TYPES[hp].color, 25)) : '#ffffff'],
    ];
    info.forEach(([label, value, color], i) => {
      const y = y0 + i * (SEC_H + SEC_GAP);
      section(this.add(scene.add.graphics()), lx, y, COL, SEC_H);
      strip(scene, (o) => this.add(o), lx + 4, y + 4, COL - 8, label);
      fitText(this.text(lx + 8, y + STRIP_H + 7, value, 13, color ?? '#ffffff', { fontStyle: 'bold' }), COL - 16, 0.7);
    });

    const pcx = rx + COL / 2;
    const plat = this.add(scene.add.graphics());
    plat.fillStyle(0x58a8e8, 0.35);
    plat.fillEllipse(pcx, y0 + 50, 100, 20);
    plat.fillStyle(0xbfe0ff, 0.6);
    plat.fillEllipse(pcx, y0 + 47, 82, 13);
    const key = pixelMon(scene, mon.speciesId, '', GBA_MON, mon.shiny);
    this.add(scene.add.image(pcx, y0 + 52, key).setOrigin(0.5, 1).setScale(fitScale(scene, key, 58)));
    for (const b of typeBadges(scene, pcx, y0 + 70, species.types, { size: 10, align: 'center' })) this.add(b);

    // Ô chỉ số (cách hàng hệ một khoảng): 6 dòng nằm giữa ô (cách đều mép trên / dưới)
    const sy = y0 + 86;
    section(this.add(scene.add.graphics()), rx, sy, COL, y1 - sy);
    const cols = [rx + COL - 62, rx + COL - 34, rx + COL - 8];
    const pitch = 16;
    const rowsTop = sy + (y1 - sy - (5 * pitch + 13)) / 2;
    STAT_ORDER.forEach((k, i) => {
      const y = rowsTop + i * pitch;
      const color = nature?.up === k ? CARD.up : nature?.down === k ? CARD.down : CARD.text;
      this.text(rx + 8, y, `${STAT_NAMES[k]}:`, 11, color, { fontStyle: 'bold' });
      this.text(cols[0], y, String(k === 'hp' ? mon.maxHp : mon[k]), 11, '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0);
      this.text(cols[1], y, String(mon.ivs[k]).padStart(2, '0'), 11, mon.ivs[k] === 31 ? CARD.up : CARD.gold, { fontStyle: 'bold' }).setOrigin(1, 0);
      this.text(cols[2], y, String(mon.evs[k]).padStart(3, '0'), 11, '#58b8f0', { fontStyle: 'bold' }).setOrigin(1, 0);
    });

    // ----- Đáy: nút thùng rác + dòng báo -----
    this.trashButton(PAD, H - 10 - TRASH);
    this.note = this.text(PAD + TRASH + 10, H - 10 - TRASH / 2, '', 11, CARD.label, { fontStyle: 'bold' }).setOrigin(0, 0.5);
  }

  trashButton(x, y) {
    const { scene } = this;
    const s = TRASH;
    const g = this.add(scene.add.graphics());
    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0x5a2a34 : 0x3a1e28);
      g.fillRoundedRect(x, y, s, s, 6);
      g.lineStyle(1.2, 0xa04050);
      g.strokeRoundedRect(x + 0.5, y + 0.5, s - 1, s - 1, 6);
      drawTrash(g, x + s / 2, y + s / 2 + 1, hover ? 0xffffff : 0xff8a8a, 0.75);
    };
    draw(false);
    const zone = this.add(scene.add.zone(x, y, s, s).setOrigin(0).setInteractive({ useHandCursor: true }));
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      if (!p.rightButtonDown()) this.askRelease();
    });
  }

  // Hộp hỏi lại giữa bảng: "Thả X với giá 200₽?" Thả / Huỷ
  askRelease() {
    const { scene, mon } = this;
    const slot = this.slot();
    const problem = slot ? releaseProblem(slot) : 'Pokémon này không còn trong hộp PC.';
    if (problem) return this.note.setText(problem);
    if (state.money < RELEASE_FEE) return this.note.setText(`Cần ${formatMoney(RELEASE_FEE)} để thả.`);
    this.closePopup();
    // Giữa màn hình, trên mọi cửa sổ; lớp mờ phủ cả màn hình chặn bấm xuống dưới (bấm ra ngoài không huỷ: nút Huỷ)
    const { width, height } = scene.scale;
    const m = this.manager;
    const c = scene.add.container(width / 2, height / 2).setDepth(m.base + (m.list.length + 1) * m.step);
    this.popup = c;
    const dim = scene.add.rectangle(-width / 2, -height / 2, width, height, 0x000000, 0.45).setOrigin(0).setInteractive();
    dim.on('pointerdown', (p, lx, ly, e) => e?.stopPropagation());
    const pw = 300;
    const ph = 132;
    const px = -pw / 2;
    const py = -ph / 2;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(px + 4, py + 6, pw, ph, 12);
    g.fillStyle(CARD.section);
    g.fillRoundedRect(px, py, pw, ph, 12);
    g.lineStyle(2, 0xa04050);
    g.strokeRoundedRect(px + 1, py + 1, pw - 2, ph - 2, 12);
    // Chặn bấm trong hộp (không lọt xuống lớp mờ)
    const body = scene.add.zone(px, py, pw, ph).setOrigin(0).setInteractive();
    body.on('pointerdown', (p, lx, ly, e) => e?.stopPropagation());
    const ask = scene.add.text(0, py + 34, `Thả ${mon.name} với giá ${formatMoney(RELEASE_FEE)}?`, textStyle(17, '#ffffff', {
      fontStyle: 'bold', align: 'center', wordWrap: { width: pw - 24 },
    })).setOrigin(0.5);
    const warn = scene.add.text(0, py + 62, 'Pokémon được thả sẽ mất vĩnh viễn', textStyle(12, CARD.label, { fontStyle: 'bold' })).setOrigin(0.5);
    c.add([dim, g, body, ask, warn]);
    const bw = 110;
    const bh = 32;
    const by = py + ph - bh - 12;
    const button = (bx, label, fill, onClick) => {
      const bg = scene.add.graphics();
      const draw = (hover) => {
        bg.clear();
        bg.fillStyle(hover ? lighten(fill) : fill);
        bg.fillRoundedRect(bx, by, bw, bh, 8);
      };
      draw(false);
      const t = scene.add.text(bx + bw / 2, by + bh / 2, label, textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
      const z = scene.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerover', () => draw(true));
      z.on('pointerout', () => draw(false));
      z.on('pointerdown', (p, lx, ly, e) => {
        e?.stopPropagation();
        if (!p.rightButtonDown()) onClick();
      });
      c.add([bg, t, z]);
    };
    button(-bw - 6, 'Thả', 0xc83838, () => this.release());
    button(6, 'Huỷ', 0x3a4668, () => this.closePopup());
    fixToCamera(c);
  }

  closePopup() {
    const c = this.popup;
    this.popup = null;
    if (!c) return;
    // Huỷ ở khung hình sau: có thể đang trong sự kiện chuột của chính nút trong hộp
    c.setVisible(false);
    this.scene.time.delayedCall(0, () => c.destroy());
  }

  // Trừ phí, thả, báo ở tab Hệ thống, đóng bảng
  release() {
    const { mon } = this;
    const slot = this.slot();
    if (!slot || releaseProblem(slot) || state.money < RELEASE_FEE) return this.closePopup();
    state.money -= RELEASE_FEE;
    const { held } = releaseMon(slot);
    const heldNote = held ? ` ${ITEMS[held]?.name ?? 'Đồ cầm'} được cất vào túi.` : '';
    logSystem(`${mon.name} (Lv${mon.level}) đã được thả về tự nhiên (−${formatMoney(RELEASE_FEE)}).${heldNote}`);
    this.closePopup();
    this.win.close();
  }
}

// Sáng hơn một chút (nút đang rê chuột)
function lighten(c) {
  const ch = (v) => Math.min(255, v + 28);
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

// Mặt cười nhỏ cạnh thanh thân thiết (cười tươi khi thân, mếu khi chưa thân)
function drawFace(g, x, y, ratio) {
  g.fillStyle(0xffd860);
  g.fillCircle(x, y, 6);
  g.lineStyle(1.2, 0x5a4010);
  g.strokeCircle(x, y, 6);
  g.fillStyle(0x3a2a10);
  g.fillCircle(x - 2, y - 1.6, 1);
  g.fillCircle(x + 2, y - 1.6, 1);
  g.beginPath();
  if (ratio >= 0.4) g.arc(x, y + 0.4, 3, 0.15 * Math.PI, 0.85 * Math.PI, false);
  else g.arc(x, y + 4.2, 2.6, 1.2 * Math.PI, 1.8 * Math.PI, false);
  g.strokePath();
}

// Thùng rác nhỏ (k: hệ số cỡ)
function drawTrash(g, x, y, color, k = 1) {
  g.fillStyle(color);
  g.fillRoundedRect(x - 7 * k, y - 8 * k, 14 * k, 2.5 * k, 1);
  g.fillRect(x - 2.5 * k, y - 10 * k, 5 * k, 2 * k);
  g.fillRoundedRect(x - 5.5 * k, y - 4 * k, 11 * k, 12 * k, 2 * k);
}
