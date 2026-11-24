import { ABILITIES } from '../data/abilities.js';
import { ITEMS } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { SPECIES } from '../data/monsters.js';
import { NATURES } from '../data/natures.js';
import { regionName } from '../data/regions.js';
import { STAT_NAMES } from '../data/stats.js';
import { TYPES } from '../data/types.js';
import { HAPPINESS_MAX, expProgress, expToReach } from '../game/monster.js';
import { takeHeldItem } from '../game/heldItems.js';
import { playerName, state } from '../game/state.js';
import { GBA_MON, fitScale, pixelMon } from '../gfx/textures.js';
import { GENDER, closeButton, fitText, fixToCamera, hpColor, monTag, textStyle } from './helpers.js';
import { isCancel } from './input.js';
import { shinyGap, shinyMark } from './shinyMark.js';
import { typeBadges } from './TypeBadge.js';
import { CARD, STRIP_H, section, strip } from './monCard.js';
import { FloatWindow } from './Windows.js';

// Bảng chi tiết một Pokémon trong đội: cửa sổ nổi gọn (ui/Windows.js), bấm vào Pokémon ở cột đội hình là mở.
//  - Dải tiêu đề: tên (chữ S vàng nếu shiny), giới tính, cấp, ✕. Kéo dải này để dời cửa sổ
//  - Mỗi mục có dải tiêu đề tối, đuôi sọc chéo (strip)
//  - Trái: mặt cười + thanh thân thiết (cam, ngắn), số máu, thanh HP, thanh EXP (ngắn hơn HP, dài hơn thân thiết), mục
//    Kinh nghiệm: hiện có (đã tích được trong cấp hiện tại) / còn thiếu (để lên cấp sau); mục Chiêu thức và PP
//  - Giữa: Đặc tính, Tính cách, OT (huấn luyện viên gốc, đi theo Pokémon cả khi đổi cho người khác)
//  - Phải: ô đồ cầm (chỉ icon), hình Pokémon trên bệ, loại bóng đã bắt (mon.ball) bên cạnh, hệ; bảng chỉ số: giá trị,
//    IV (vàng), EV (xanh dương); chỉ số tính cách tăng tô xanh lá, giảm tô đỏ
//  - Ô đồ cầm: kéo vật phẩm từ túi đồ thả vào là cho cầm (WorldScene); kéo món đang cầm ra ngoài ô là cất vào túi
//  - Thao tác bằng chuột (đổi Pokémon: bấm con khác ở cột đội hình); phím quay lại đóng
// Toạ độ theo khung thiết kế 960x720

// Bố cục vẽ ở cỡ 500 x 296 rồi co cả cửa sổ lại SCALE lần (khoảng 415 x 245 trên khung thiết kế)
const W = 500;
const H = 296;
const SCALE = 0.83;
const X0 = 480 - W / 2;
const Y0 = 150;
const HEAD = 32;
// Nền cửa sổ xám xanh, các mục nền đen, dải tiêu đề cắt xéo (ui/monCard.js)
const C = { ...CARD, box: CARD.section, boxEdge: CARD.sectionEdge };
const HELD = { x: X0 + W - 48, y: Y0 + HEAD + 8, size: 38 };
const STAT_ORDER = ['atk', 'def', 'speed', 'spAtk', 'spDef', 'hp'];
const DRAG_START = 6;

export class MonDetail {
  // index: Pokémon thứ mấy trong đội • opts.ghostDepth: depth của icon đồ cầm đang kéo
  constructor(manager, index, opts = {}) {
    this.manager = manager;
    this.scene = manager.scene;
    this.opts = opts;
    this.index = index;
    this.win = new FloatWindow(manager, {
      id: 'mon', rect: { x: X0, y: Y0, w: W, h: H }, dragRect: { x: X0, y: Y0, w: W - 40, h: HEAD },
      onKey: (e) => this.onKey(e), onClose: () => this.cleanup(), scale: SCALE,
    });
    this.page = this.win.add(this.scene.add.container(0, 0));
    this.onMove = (p) => this.dragMove(p);
    this.onUp = (p) => this.dragEnd(p);
    this.scene.input.on('pointermove', this.onMove);
    this.scene.input.on('pointerup', this.onUp);
    this.render();
    manager.open(this.win);
  }

  get mon() {
    return state.party[this.index] ?? null;
  }

  // Xem Pokémon khác (bấm vào con khác ở cột đội hình khi bảng đang mở)
  show(index) {
    this.index = index;
    this.render();
  }

  // Mỗi khung hình: máu / cấp / đồ cầm / đội hình đổi thì vẽ lại
  update() {
    if (!state.party.length) return this.win.close();
    if (this.index >= state.party.length) this.index = state.party.length - 1;
    const m = this.mon;
    if (detailKey(m) !== this.key) this.render();
  }

  // Phím quay lại: đóng (cửa sổ dùng chuột, phím hướng để đi lại trên bản đồ)
  onKey(e) {
    if (isCancel(e)) this.win.close();
  }

  cleanup() {
    this.scene.input.off('pointermove', this.onMove);
    this.scene.input.off('pointerup', this.onUp);
    this.press?.ghost?.destroy();
    this.noteTimer?.remove();
  }

  // Điểm p (con trỏ) nằm trên ô đồ cầm không
  overHeld(p) {
    const { x, y } = this.win.local(p);
    return x >= HELD.x - 6 && x <= HELD.x + HELD.size + 6 && y >= HELD.y - 6 && y <= HELD.y + HELD.size + 6;
  }

  // Sáng ô đồ cầm khi đang kéo vật phẩm từ túi tới
  highlightHeld(on) {
    if (this.heldOn === on) return;
    this.heldOn = on;
    this.drawHeldBox();
  }

  // Báo ngắn dưới đáy cửa sổ
  note(text) {
    this.noteText?.destroy();
    this.noteTimer?.remove();
    this.noteText = this.win.add(this.scene.add.text(X0 + W / 2, Y0 + H - 10, text, textStyle(13, '#ffffff', {
      fontStyle: 'bold', backgroundColor: 'rgba(30,110,70,0.95)', padding: { x: 10, y: 4 },
    })).setOrigin(0.5, 1));
    this.noteTimer = this.scene.time.delayedCall(1800, () => this.noteText?.destroy());
  }

  // ---------- Kéo món đang cầm ra ngoài: cất vào túi ----------

  dragMove(p) {
    const press = this.press;
    if (!press || !p.isDown) return;
    if (!press.ghost) {
      if (Math.hypot(p.x - press.x, p.y - press.y) < DRAG_START) return;
      const icon = ITEMS[press.id].icon;
      press.ghost = this.scene.add.image(p.x, p.y, icon).setScale(fitScale(this.scene, icon, 40)).setScrollFactor(0)
        .setDepth(this.opts.ghostDepth ?? 120);
      this.heldIcon?.setAlpha(0.3);
    }
    press.ghost.setPosition(p.x, p.y);
  }

  dragEnd(p) {
    const press = this.press;
    this.press = null;
    if (!press?.ghost) return;
    press.ghost.destroy();
    const mon = this.mon;
    if (!this.overHeld(p) && mon?.heldItem === press.id) {
      const id = takeHeldItem(mon);
      this.note(id ? `Đã cất ${ITEMS[id].name} vào túi` : 'Túi đã đầy món này, không cất được');
    }
    this.render();
  }

  // ---------- Vẽ ----------

  add(o) {
    this.page.add(o);
    return o;
  }

  text(x, y, str, size, color = C.text, extra = {}) {
    return this.add(this.scene.add.text(x, y, str, textStyle(size, color, extra)));
  }

  // Dải tiêu đề mục (ngắn, đuôi cắt xéo + lát mỏng phía trước) nằm trong ô mục nền đen (x, y: góc ô; w, h: cỡ ô)
  strip(x, y, w, label, h = 0) {
    if (h) section(this.add(this.scene.add.graphics()), x - 4, y - 4, w + 8, h);
    strip(this.scene, (o) => this.add(o), x, y, w, label);
  }

  drawHeldBox() {
    const g = this.heldG;
    if (!g?.active) return;
    const { x, y, size } = HELD;
    g.clear();
    g.fillStyle(this.heldOn ? 0x2e3b60 : 0x0e1322);
    g.fillRoundedRect(x, y, size, size, 8);
    g.lineStyle(2, this.heldOn ? 0xffd860 : C.boxEdge);
    g.strokeRoundedRect(x + 1, y + 1, size - 2, size - 2, 8);
  }

  render() {
    const mon = this.mon;
    if (!mon) return;
    const { scene } = this;
    this.page.removeAll(true);
    this.key = detailKey(mon);
    const species = SPECIES[mon.speciesId];
    const nature = NATURES[mon.nature];

    // Khung + dải tiêu đề
    const g = this.add(scene.add.graphics());
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(X0 + 4, Y0 + 6, W, H, 12);
    g.fillStyle(C.frame);
    g.fillRoundedRect(X0, Y0, W, H, 12);
    g.fillStyle(C.head);
    g.fillRoundedRect(X0, Y0, W, HEAD, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.lineStyle(2, C.edge);
    g.strokeRoundedRect(X0 + 1, Y0 + 1, W - 2, H - 2, 11);
    g.lineBetween(X0 + 2, Y0 + HEAD, X0 + W - 2, Y0 + HEAD);
    const cy = Y0 + HEAD / 2;
    this.add(scene.add.image(X0 + 18, cy, 'ball').setScale(fitScale(scene, 'ball', 16)));
    let nx = X0 + 32;
    if (mon.shiny) {
      const mark = this.add(shinyMark(scene, nx, cy, 16).setOrigin(0, 0.5));
      nx += mark.width + shinyGap(16);
    }
    const name = this.text(nx, cy, mon.name, 16, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    fitText(name, 200, 0.75);
    let hx = name.x + name.displayWidth + 6;
    const gender = GENDER[mon.gender];
    if (gender) {
      const gt = this.text(hx, cy, gender.symbol, 15, gender.color, { fontStyle: 'bold' }).setOrigin(0, 0.5);
      hx += gt.width + 5;
    }
    const lv = this.text(hx, cy + 1, `Lv. ${mon.level}`, 13, '#c8d2ea', { fontStyle: 'bold' }).setOrigin(0, 0.5);
    // Vùng (nơi bắt, data/regions.js) trên dải tiêu đề: ghi thẳng tên vùng, không nền
    const regionW = 120;
    const rgx = Math.max(lv.x + lv.width + 14, X0 + W / 2 - 10);
    fitText(this.text(rgx + regionW / 2, cy, regionName(mon.region), 13, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5), regionW - 12, 0.7);
    closeButton(scene, X0 + W - 20, cy, () => this.win.close(), 22).forEach((o) => this.add(o));

    const top = Y0 + HEAD + 8;
    // Trái trên: mặt cười + thanh thân thiết (ngắn) + số máu, thanh HP, thanh EXP (đều mảnh)
    const lx = X0 + 10;
    const lw = 180;
    const bars = this.add(scene.add.graphics());
    const happy = Math.max(0, Math.min(1, (mon.happiness ?? 0) / HAPPINESS_MAX));
    drawFace(bars, lx + 7, top + 7, happy);
    const fw = 70;
    bars.fillStyle(0x0a0e1a);
    bars.fillRoundedRect(lx + 18, top + 5, fw, 4, 2);
    if (happy > 0) {
      bars.fillStyle(0xf09030);
      bars.fillRoundedRect(lx + 18, top + 5, Math.max(4, fw * happy), 4, 2);
    }
    const ratio = Math.max(0, Math.min(1, mon.hp / mon.maxHp));
    this.text(lx + lw, top + 7, `${Math.max(0, mon.hp)}/${mon.maxHp}`, 11, ratio > 0.5 ? '#78e098' : '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    bars.fillStyle(0x0a0e1a);
    bars.fillRoundedRect(lx, top + 17, lw, 5, 2.5);
    if (ratio > 0) {
      bars.fillStyle(hpColor(ratio));
      bars.fillRoundedRect(lx, top + 17, Math.max(4, lw * ratio), 5, 2.5);
    }
    // Thanh EXP: ngắn hơn thanh HP, dài hơn thanh thân thiết
    const exp = Math.max(0, Math.min(1, expProgress(mon)));
    const ew = Math.round((fw + lw) / 2);
    bars.fillStyle(0x0a0e1a);
    bars.fillRoundedRect(lx, top + 26, ew, 3, 1.5);
    if (exp > 0) {
      bars.fillStyle(0x48a8f0);
      bars.fillRoundedRect(lx, top + 26, Math.max(3, ew * exp), 3, 1.5);
    }
    const tag = monTag(scene, lx + lw, top + 28, mon, 9);
    if (tag) this.add(tag.setOrigin(1, 0.5));

    // Kinh nghiệm — Hiện có: EXP đã tích được trong cấp hiện tại • Còn thiếu: EXP cần thêm để lên cấp sau
    this.strip(lx, top + 38, lw, 'Kinh nghiệm', 64);
    const maxed = mon.level >= 100;
    const have = maxed ? 0 : Math.max(0, mon.exp - expToReach(mon, mon.level));
    const toNext = maxed ? 0 : Math.max(0, expToReach(mon, mon.level + 1) - mon.exp);
    for (const [i, [label, value]] of [['Hiện có', have], ['Còn thiếu', toNext]].entries()) {
      const y = top + 60 + i * 17;
      this.text(lx + 4, y, label, 11, C.text);
      this.text(lx + lw - 16, y, String(value), 11, '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0);
      this.text(lx + lw, y + 1, 'XP', 9, '#58b8f0', { fontStyle: 'bold' }).setOrigin(1, 0);
    }

    // Giữa: Đặc tính, Tính cách, OT (dải tiêu đề + giá trị)
    const mx = lx + lw + 10;
    const mw = 120;
    const info = [
      ['Đặc tính', ABILITIES[mon.ability]?.name ?? '—'],
      ['Tính cách', nature?.name ?? '—'],
      ['OT', mon.ot ?? playerName()],
    ];
    info.forEach(([label, value], i) => {
      const y = top + i * 38 + 3;
      section(this.add(this.scene.add.graphics()), mx - 4, y - 3, mw + 8, 36);
      this.strip(mx, y, mw, label);
      fitText(this.text(mx + 4, y + STRIP_H + 1, value, 12, '#ffffff', { fontStyle: 'bold' }), mw - 8, 0.7);
    });

    // Phải: ô đồ cầm, hình Pokémon trên bệ, loại bóng đã bắt bên cạnh, hệ
    const rx = mx + mw + 6;
    const rw = X0 + W - 10 - rx;
    const pcx = rx + (rw - HELD.size) / 2 + 4;
    const plat = this.add(scene.add.graphics());
    plat.fillStyle(0x58a8e8, 0.35);
    plat.fillEllipse(pcx, top + 80, 96, 22);
    plat.fillStyle(0xbfe0ff, 0.6);
    plat.fillEllipse(pcx, top + 77, 80, 14);
    const key = pixelMon(scene, mon.speciesId, '', GBA_MON, mon.shiny);
    this.add(scene.add.image(pcx, top + 82, key).setOrigin(0.5, 1).setScale(fitScale(scene, key, 66)).setAlpha(mon.hp > 0 ? 1 : 0.5));
    for (const b of typeBadges(scene, pcx, top + 99, species.types, { size: 10, align: 'center' })) this.add(b);
    const ball = ITEMS[mon.ball ?? 'ball'] ?? ITEMS.ball;
    if (ball?.icon && scene.textures.exists(ball.icon)) {
      this.add(scene.add.image(HELD.x + HELD.size / 2, top + 64, ball.icon).setScale(fitScale(scene, ball.icon, 24)).setAlpha(0.55));
    }
    this.heldG = this.add(scene.add.graphics());
    this.drawHeldBox();
    this.heldIcon = null;
    const held = ITEMS[mon.heldItem];
    const { x: hx0, y: hy0, size } = HELD;
    if (held) {
      this.heldIcon = this.add(scene.add.image(hx0 + size / 2, hy0 + size / 2, held.icon).setScale(fitScale(scene, held.icon, 26)));
      this.heldIcon.setInteractive({ useHandCursor: true });
      this.heldIcon.on('pointerdown', (p) => {
        if (!p.rightButtonDown()) this.press = { id: mon.heldItem, x: p.x, y: p.y, ghost: null };
      });
    }

    // Dưới trái: chiêu thức (rộng)
    // Ô Chiêu thức và ô chỉ số cùng đỉnh (by - 4), cùng đáy (Y0 + H - 8)
    const by = top + 118;
    const mw2 = 306;
    const boxBottom = Y0 + H - 8;
    this.strip(lx, by, mw2, 'Chiêu thức', boxBottom - (by - 4));
    mon.moves.forEach((id, i) => {
      const m = MOVES[id];
      if (!m) return;
      const y = by + STRIP_H + 5 + i * 25;
      const mg = this.add(scene.add.graphics());
      mg.fillStyle(TYPES[m.type].color, 0.16);
      mg.fillRoundedRect(lx, y, mw2, 22, 5);
      mg.fillStyle(TYPES[m.type].color);
      mg.fillRoundedRect(lx, y, 4, 22, { tl: 5, bl: 5, tr: 0, br: 0 });
      fitText(this.text(lx + 11, y + 11, m.name, 12, '#ffffff', { fontStyle: 'bold' }).setOrigin(0, 0.5), mw2 - 80, 0.75);
      const pp = mon.pp?.[id] ?? 0;
      this.text(lx + mw2 - 8, y + 11, `${pp}/${m.pp}`, 11, pp === 0 ? C.down : '#c8d2ea', { fontStyle: 'bold' }).setOrigin(1, 0.5);
    });

    // Dưới phải: chỉ số — giá trị, IV (vàng), EV (xanh dương); tên chỉ số tô theo tính cách
    const sx = lx + mw2 + 10;
    const sw = X0 + W - 10 - sx;
    section(this.add(scene.add.graphics()), sx, by - 4, sw, boxBottom - (by - 4));
    const cols = [sx + sw - 70, sx + sw - 40, sx + sw - 8];
    STAT_ORDER.forEach((k, i) => {
      const y = by + 3 + i * 18.5;
      const color = nature?.up === k ? C.up : nature?.down === k ? C.down : C.text;
      this.text(sx + 8, y, STAT_NAMES[k], 12, color, { fontStyle: 'bold' });
      this.text(cols[0], y, String(k === 'hp' ? mon.maxHp : mon[k]), 12, '#ffffff', { fontStyle: 'bold' }).setOrigin(1, 0);
      this.text(cols[1], y, String(mon.ivs[k]).padStart(2, '0'), 12, mon.ivs[k] === 31 ? C.up : C.gold, { fontStyle: 'bold' }).setOrigin(1, 0);
      this.text(cols[2], y, String(mon.evs[k]).padStart(3, '0'), 12, '#58b8f0', { fontStyle: 'bold' }).setOrigin(1, 0);
    });
    fixToCamera(this.page);
  }
}

// Đổi khi máu / cấp / EXP / đồ cầm / trạng thái / tên / chiêu / PP / thân thiết đổi: vẽ lại bảng
const detailKey = (m) => [m.uid, m.hp, m.maxHp, m.level, m.exp, m.heldItem, m.status, m.name, m.happiness, m.ball, m.moves.join(),
  m.moves.map((id) => m.pp[id]).join()].join(':');

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
