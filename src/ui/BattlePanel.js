import { effectivenessHint, moveNotes } from '../battle/moveInfo.js';
import { ITEMS } from '../data/items.js';
import { CATEGORY_NAMES } from '../data/moves.js';
import { itemCount } from '../game/state.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { BATTLE_FRAME, fitText, localX, localY, moveBattle, textStyle } from './helpers.js';
import { directionOf, isConfirm } from './input.js';
import { typeBadge } from './TypeBadge.js';

// Khung cửa sổ trận đấu (toạ độ trong trận, xem ui/helpers.js: BATTLE_FRAME) kiểu game MMO, 3 khối:
//  - Trái: sân đấu + hộp thoại (x 0..960)
//  - Phải trên (CONTENT): danh sách của lệnh đang chọn: 4 chiêu kèm PP (rê vào chiêu nào thì ô chi tiết hiện bên cạnh),
//    đội hình (lưới hình 2 cột x 3, gục thì xám, không có ô chi tiết), túi đồ (một cột, thanh cuộn, rê vào không hiện chữ)
//  - Phải dưới (COMMANDS): 4 nút lệnh, mặc định xám; nút đang trỏ / đang chọn sáng màu riêng
//  Thanh tiêu đề "Người chơi VS. Đối thủ" kéo để dời cửa sổ.
// Đang mở danh sách mà bấm nút lệnh khác thì chuyển sang danh sách đó; bấm lại nút đang mở thì đóng danh sách.
// Bấm ra ngoài, Esc, chuột phải đều không đóng danh sách: chỉ đóng bằng cách bấm lại nút lệnh đó.

export const CONTENT = { x: 972, y: 0, w: 300, h: 476 };
export const COMMANDS = { x: 972, y: 488, width: 300, height: 224 };
const FIELD_BOX = { x: 0, y: 0, w: 960, h: 712 };
const FRAME_DEPTH = 15; // trên sân đấu (che phần nền vẽ tràn ra hai bên), dưới hộp thoại / bảng chọn
const TIP_DEPTH = 32;
const TITLE_H = 44;
const C = {
  frame: 0x10151f, bar: 0x161c2c, edge: 0x3d4c72, box: 0x0b0e16, card: 0x161d2e, cardHi: 0x222c46, gold: 0xffd860,
  tipEdge: 0x58c8f0,
};
const DIM = '#9aa6c4';
const TEXT = '#e8ecf6';

// Khối có nền tối + viền bo góc
function box(g, r, fill = C.box) {
  g.fillStyle(fill);
  g.fillRoundedRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 12);
  g.lineStyle(2, C.edge);
  g.strokeRoundedRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 11);
}

// Hai quả cầu va vào nhau, tia lửa nằm dưới hai quả cầu (biểu tượng góc trái, nổi lên trên thanh tiêu đề)
function clashIcon(scene, x, y, depth) {
  const g = scene.add.graphics().setDepth(depth);
  const star = (r1, r2, n, rot) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = rot + (i / (n * 2)) * Math.PI * 2;
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    return pts;
  };
  g.fillStyle(0x1e2a44);
  g.fillPoints(star(27, 12, 9, -0.3), true);
  g.fillStyle(0xff7a2a);
  g.fillPoints(star(24, 10.5, 9, -0.3), true);
  g.fillStyle(0xffe066);
  g.fillPoints(star(13, 6.5, 7, 0), true);
  for (const [dx, dy, rot] of [[-17, 6, -0.35], [17, -6, 0.35]]) {
    scene.add.image(x + dx, y + dy, 'ball').setScale(fitScale(scene, 'ball', 36)).setRotation(rot).setDepth(depth + 0.1);
  }
}

// Khung, thanh tiêu đề (kéo được), 3 khối. left / right: tên hai bên trên thanh tiêu đề
export function drawBattleFrame(scene, left, right) {
  const F = BATTLE_FRAME;
  // Nền cả khung (camera trận đấu trong suốt, xem ui/helpers.js: battleStage)
  scene.add.graphics().setDepth(-10).fillStyle(C.frame).fillRect(F.x, F.y, F.w, F.h);
  const g = scene.add.graphics().setDepth(FRAME_DEPTH);
  // Nền cửa sổ (che phần nền sân vẽ tràn ra ngoài: trái, phải, trên)
  g.fillStyle(C.frame);
  g.fillRect(F.x, F.y, F.w, -F.y);
  g.fillRect(F.x, 0, -F.x, F.y + F.h);
  g.fillRect(960, 0, F.x + F.w - 960, F.y + F.h);
  g.fillStyle(C.bar);
  g.fillRect(F.x, F.y, F.w, TITLE_H);
  g.lineStyle(1, C.edge, 0.9);
  g.lineBetween(F.x, F.y + TITLE_H, F.x + F.w, F.y + TITLE_H);
  g.lineStyle(2, C.edge);
  g.strokeRect(F.x + 1, F.y + 1, F.w - 2, F.h - 2);
  // Khối phải trên / phải dưới
  box(g, { x: CONTENT.x + 4, y: CONTENT.y + 4, w: CONTENT.w - 8, h: CONTENT.h - 8 });
  box(g, { x: COMMANDS.x + 4, y: COMMANDS.y + 4, w: COMMANDS.width - 8, h: COMMANDS.height - 8 });
  // Khối trái (sân + hộp thoại): khung dưới sân (sân vẽ đè lên), viền vẽ sau cùng trên sân
  const back = scene.add.graphics().setDepth(-1);
  box(back, { x: FIELD_BOX.x + 4, y: FIELD_BOX.y + 4, w: FIELD_BOX.w - 8, h: FIELD_BOX.h - 8 });
  g.lineStyle(2, C.edge);
  g.strokeRoundedRect(FIELD_BOX.x - 1, FIELD_BOX.y - 1, FIELD_BOX.w + 2, FIELD_BOX.h + 2, 11);

  const cy = F.y + TITLE_H / 2;
  clashIcon(scene, F.x + 44, cy - 8, FRAME_DEPTH + 3);
  const style = (color) => textStyle(19, color, { fontStyle: 'bold', stroke: '#0b0e16', strokeThickness: 4 });
  const parts = [
    scene.add.text(0, cy, left, style('#ffffff')),
    scene.add.text(0, cy, '  VS.  ', style('#ffd860')),
    scene.add.text(0, cy, right, style('#ffffff')),
  ];
  const total = parts.reduce((sum, t) => sum + t.width, 0);
  let x = 480 - total / 2;
  for (const t of parts) {
    t.setOrigin(0, 0.5).setX(x).setDepth(FRAME_DEPTH + 1);
    x += t.width;
  }

  // Kéo thanh tiêu đề để dời cửa sổ (con trỏ chuột giữ bình thường; không lọt xuống hộp thoại / bảng chọn)
  const zone = scene.add.zone(F.x, F.y, F.w, TITLE_H).setOrigin(0).setDepth(FRAME_DEPTH + 2).setInteractive();
  let drag = null;
  zone.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation();
    if (!p.rightButtonDown()) drag = { x: p.x, y: p.y };
  });
  const move = (p) => {
    if (!drag || !p.isDown) return;
    moveBattle(scene, p.x - drag.x, p.y - drag.y);
    drag = { x: p.x, y: p.y };
    scene.placeStage?.();
  };
  const up = () => {
    drag = null;
  };
  scene.input.on('pointermove', move);
  scene.input.on('pointerup', up);
  scene.events.once('shutdown', () => {
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', up);
  });
}

// ---------- Ô chi tiết chiêu bên phải cột nội dung (rê vào chiêu) ----------

const TIP_W = 300;

// build(c, w): vẽ nội dung, trả về chiều cao. y: tâm dòng đang rê.
// Nằm bên phải cột nội dung, tràn ra ngoài cửa sổ trận đấu (vẽ bằng camera phụ, ui/helpers.js: battleStage); sát mép phải
// màn hình không đủ chỗ thì nằm bên trái cột
export function showTip(scene, old, y, build) {
  old?.destroy();
  const c = scene.add.container(0, 0).setDepth(TIP_DEPTH);
  const g = scene.add.graphics();
  c.add(g);
  const h = build(c, TIP_W);
  let x = CONTENT.x + CONTENT.w + 18;
  const edge = scene.stageToScreen?.(x + TIP_W + 6, 0).x ?? Infinity;
  if (!scene.overlayCam || edge > scene.scale.width) x = CONTENT.x - 14 - TIP_W;
  // Chỉ camera phụ vẽ ô này (camera chính bị cắt theo khung cửa sổ)
  if (scene.overlayCam) {
    const only = (o) => {
      o.cameraFilter = 0;
      o.list?.forEach(only);
    };
    only(c);
    c.cameraFilter = scene.cameras.main.id;
  }
  const top = Math.max(CONTENT.y + 6, Math.min(CONTENT.y + CONTENT.h - h, y - h / 2));
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(3, 5, TIP_W, h, 8);
  g.fillStyle(0x0b0e16, 0.96);
  g.fillRoundedRect(0, 0, TIP_W, h, 8);
  g.lineStyle(2, C.tipEdge);
  g.strokeRoundedRect(1, 1, TIP_W - 2, h - 2, 8);
  c.setPosition(x, top);
  return c;
}

// Chi tiết chiêu: mô tả, loại chiêu, độ chính xác / sức mạnh, mức khắc chế đối thủ
export function moveTipBuilder(scene, m, enemyTypes) {
  return (c, w) => {
    const notes = moveNotes(m);
    const desc = notes.length ? notes.join(' • ') : m.category === 'status' ? 'Chiêu hỗ trợ.' : 'Không có hiệu ứng phụ.';
    const t = scene.add.text(w / 2, 14, desc, textStyle(14, TEXT, { align: 'center', wordWrap: { width: w - 28 }, lineSpacing: 2 })).setOrigin(0.5, 0);
    c.add(t);
    let y = t.y + t.height + 12;
    const cols = [
      ['LOẠI', CATEGORY_NAMES[m.category]],
      ['CX', m.accuracy ? `${m.accuracy}` : '—'],
      ['SM', m.power || (m.fixedDamage || m.weightPower ? '?' : '—')],
    ];
    cols.forEach(([label, value], i) => {
      const x = w * ((i + 0.5) / cols.length);
      c.add(scene.add.text(x, y, label, textStyle(12, DIM, { fontStyle: 'bold' })).setOrigin(0.5, 0));
      c.add(scene.add.text(x, y + 16, String(value), textStyle(15, TEXT, { fontStyle: 'bold' })).setOrigin(0.5, 0));
    });
    y += 42;
    const hint = enemyTypes && effectivenessHint(m, enemyTypes);
    if (hint) {
      const color = { '#c83838': '#ff8a8a', '#2a9a48': '#6ee08a', '#d07020': '#ffb070', '#7a8296': DIM }[hint.color] ?? hint.color;
      c.add(scene.add.text(w / 2, y, hint.label, textStyle(13, color, { fontStyle: 'bold' })).setOrigin(0.5, 0));
      y += 22;
    }
    return y + 8;
  };
}

// ---------- 4 nút lệnh ----------

// mode: 'idle' (chưa tới lượt chọn) | 'choose' (đang chọn lệnh) | 'sub' (đã chọn, đang mở danh sách của lệnh đó).
// Nút mặc định xám (icon xám, chữ xám); nút đang trỏ chuột / đang chọn bằng phím / đang mở danh sách thì sáng màu riêng.
// Lúc đang chọn lệnh mà chưa trỏ nút nào thì cả 4 nút xám; Enter / Space là Chiến đấu.
// Icon to, tên lệnh đè lên phần dưới icon (như nút lệnh game gốc)
const ICON_SIZE = 84;
const GREY_TEXT = '#a4a9b4';

export class CommandTray {
  constructor(scene, router, items) {
    const { x, y, width, height } = COMMANDS;
    this.scene = scene;
    this.router = router;
    this.items = items;
    this.mode = 'idle';
    this.index = -1;
    this.hover = -1;
    this.pending = null;
    // Đóng danh sách đang mở ở ô nội dung (bấm nút lệnh lúc đang mở danh sách); BattleScene gán khi mở danh sách
    this.cancelSub = null;
    this.container = scene.add.container(0, 0).setDepth(20);
    const pad = 10;
    const w = (width - pad * 2) / 2;
    const h = (height - pad * 2) / 2;
    this.cells = items.map((item, i) => {
      const cx = x + pad + (i % 2) * w + w / 2;
      const cy = y + pad + Math.floor(i / 2) * h + h / 2;
      const icon = scene.add.image(cx, cy - 8, `${item.icon}-grey`);
      icon.base = fitScale(scene, item.icon, ICON_SIZE);
      icon.setScale(icon.base);
      const label = scene.add.text(cx, cy + 26, item.label, textStyle(18, GREY_TEXT, { fontStyle: 'bold', stroke: '#0b0e16', strokeThickness: 5 })).setOrigin(0.5);
      const zone = scene.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.hover = i;
        if (this.mode === 'choose') this.select(i);
        else this.draw(i);
      });
      zone.on('pointerout', () => this.unhover(i));
      zone.on('pointerdown', (p) => {
        if (p.rightButtonDown()) return;
        if (this.mode === 'choose') {
          this.select(i);
          this.confirm();
        } else if (this.mode === 'sub') {
          // Đang mở danh sách: đóng nó rồi mở lệnh vừa bấm (bấm lại chính nút đó thì chỉ đóng)
          this.pending = item.value;
          this.cancelSub?.();
        }
      });
      this.container.add([icon, label, zone]);
      return { icon, label, cy };
    });
    // Chuột ra khỏi khung game (không có pointerout của nút): tắt sáng nút đang trỏ
    this.onGameOut = () => this.hover >= 0 && this.unhover(this.hover);
    scene.input.on('gameout', this.onGameOut);
    scene.events.once('shutdown', () => scene.input.off('gameout', this.onGameOut));
    this.setMode('idle');
  }

  unhover(i) {
    if (this.hover === i) this.hover = -1;
    // Đang chọn lệnh: rời nút thì về xám (không giữ sáng nút vừa rê qua)
    if (this.mode === 'choose' && this.index === i) this.select(-1);
    else this.draw(i);
  }

  draw(i) {
    const { icon, label, cy } = this.cells[i];
    const item = this.items[i];
    const chosen = i === this.index && this.mode !== 'idle';
    const on = chosen || (i === this.hover && this.mode !== 'idle');
    icon.setTexture(on ? item.icon : `${item.icon}-grey`).setScale(icon.base * (on ? 1.06 : 1));
    label.setColor(on ? '#ffffff' : GREY_TEXT);
    icon.bob?.remove();
    icon.setY(cy - 8);
    if (chosen && this.mode === 'choose') icon.bob = this.scene.tweens.add({ targets: icon, y: cy - 11, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  setMode(mode) {
    this.mode = mode;
    this.container.setAlpha(mode === 'idle' ? 0.6 : 1);
    this.cells.forEach((_, i) => this.draw(i));
  }

  select(i) {
    if (i === this.index) return;
    const old = this.index;
    this.index = i;
    if (old >= 0) this.draw(old);
    if (i >= 0) this.draw(i);
  }

  // Chờ chọn lệnh (chuột hoặc phím mũi tên + xác nhận). Trả về value của lệnh. Mỗi lượt bắt đầu với 4 nút xám
  // (chuột đang nằm trên nút nào thì nút đó sáng)
  open() {
    this.pending = null;
    this.cancelSub = null;
    this.index = -1;
    this.setMode('choose');
    if (this.hover >= 0) this.select(this.hover);
    const openedAt = performance.now();
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set((e) => e.timeStamp >= openedAt && this.handleKey(e), () => {});
    });
  }

  // Lệnh value đang mở danh sách (khi chọn bằng cách bấm nút lúc danh sách khác đang mở)
  mark(value) {
    this.index = this.items.findIndex((it) => it.value === value);
    this.setMode('sub');
  }

  handleKey(e) {
    const dir = directionOf(e);
    const i = this.index;
    if (dir && i < 0) {
      this.select(0); // chưa trỏ nút nào: phím mũi tên bắt đầu từ Chiến đấu
      return;
    }
    switch (dir) {
      case 'left': if (i % 2) this.select(i - 1); return;
      case 'right': if (!(i % 2) && i + 1 < this.items.length) this.select(i + 1); return;
      case 'up': if (i >= 2) this.select(i - 2); return;
      case 'down': if (i + 2 < this.items.length) this.select(i + 2); return;
    }
    if (isConfirm(e)) this.confirm();
  }

  confirm() {
    if (this.mode !== 'choose') return;
    if (this.index < 0) this.index = 0; // Enter / Space khi chưa trỏ nút nào: Chiến đấu
    this.router.clear();
    this.setMode('sub');
    const resolve = this.resolve;
    this.resolve = null;
    resolve?.(this.items[this.index].value);
  }

  idle() {
    this.pending = null;
    this.cancelSub = null;
    this.setMode('idle');
  }

  takePending() {
    const v = this.pending;
    this.pending = null;
    return v;
  }
}

// ---------- Chiêu: 4 dòng (ButtonGrid) ----------

// 4 dòng giãn đều cả cột, dòng chữ "Chọn kỹ năng" ở đáy cột
const MOVE_HINT_H = 40;
export const MOVE_GRID = { x: CONTENT.x + 6, y: CONTENT.y + 6, width: CONTENT.w - 12, height: CONTENT.h - 12 - MOVE_HINT_H, columns: 1, pad: 6, gap: 14, rows: 4 };

export function moveHint(scene) {
  return scene.add.text(CONTENT.x + CONTENT.w / 2, CONTENT.y + CONTENT.h - 6 - MOVE_HINT_H / 2, 'Chọn kỹ năng', textStyle(19, DIM, { fontStyle: 'bold' }))
    .setOrigin(0.5).setDepth(20);
}

export function paintMoveRow(g, item, w, h, selected) {
  const color = item.value ? item.color : 0x6a7080;
  g.fillStyle(selected ? C.cardHi : C.card);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
  g.fillStyle(item.disabled ? 0x6a7080 : color);
  g.fillRoundedRect(-w / 2, -h / 2, 5, h, { tl: 8, bl: 8, tr: 0, br: 0 });
  g.lineStyle(selected ? 2 : 1, selected ? C.tipEdge : C.edge, selected ? 1 : 0.8);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
}

// Tên chiêu (trên), loại chiêu + hệ (dưới), PP (phải). Chiêu không dùng được thì chữ xám
export function renderMoveRow(scene, cell, item, w, h) {
  const grey = item.disabled;
  const name = scene.add.text(-w / 2 + 16, -h / 2 + 14, item.label, textStyle(19, grey ? '#8a90a0' : '#ffffff', { fontStyle: 'bold' }));
  cell.add(fitText(name, w - 30, 0.7));
  if (!item.value) return;
  const m = item.value;
  const cat = scene.add.text(-w / 2 + 16, h / 2 - 18, CATEGORY_NAMES[m.category], textStyle(11, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5);
  const pill = scene.add.graphics();
  pill.fillStyle({ physical: 0xe06030, special: 0x4a78d8, status: 0x8a90a0 }[m.category]);
  pill.fillRoundedRect(cat.x - 6, cat.y - 9, cat.width + 12, 18, 9);
  cell.add([pill, cat]);
  const badge = typeBadge(scene, 0, h / 2 - 18, m.type, { size: 11 });
  badge.x = cat.x + cat.width + 14 + badge.badgeWidth / 2;
  cell.add(badge);
  const ratio = item.pp / item.maxPp;
  const color = item.pp === 0 ? '#ff8a8a' : ratio <= 0.25 ? '#ffb070' : ratio <= 0.5 ? '#ffe066' : '#ffffff';
  cell.add(scene.add.text(w / 2 - 12, h / 2 - 18, item.tag ?? `${item.pp}/${item.maxPp}`, textStyle(16, color, { fontStyle: 'bold' })).setOrigin(1, 0.5));
}

// ---------- Đội hình: lưới hình 2 cột x 3 ----------

export const PARTY_GRID = { x: CONTENT.x + 6, y: CONTENT.y + 6, width: CONTENT.w - 12, height: CONTENT.h - 12, columns: 2, pad: 8, gap: 8, rows: 3 };

export function paintPartyCell(g, item, w, h, selected) {
  if (!selected && !item.active) return;
  g.fillStyle(selected ? C.cardHi : C.card, selected ? 1 : 0.6);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  g.lineStyle(selected ? 2 : 1.5, selected ? C.tipEdge : 0x48b878, selected ? 1 : 0.8);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
}

export function renderPartyCell(scene, cell, item) {
  const { mon } = item;
  const key = pixelMon(scene, mon.speciesId, '', 64, mon.shiny);
  const img = scene.add.image(0, 0, key).setScale(fitScale(scene, key, 78));
  if (mon.hp <= 0) img.setTint(0x55585f).setAlpha(0.7);
  cell.add(img);
}

// ---------- Túi đồ: một cột vật phẩm dùng được trong trận, thanh cuộn bên phải ----------

const ROW_H = 44;
const ROW_GAP = 5;
const LIST_TOP = CONTENT.y + 8;
const BAR_W = 6;

// open() trả về id vật phẩm hoặc null (chỉ huỷ bằng finish(null): bấm lại nút Túi đồ). onHover(id): rê vào dòng nào.
// Cuộn: lăn chuột, kéo thanh cuộn, phím lên xuống
export class ItemList {
  constructor(scene, router, { ids, onHover, index = 0 }) {
    this.scene = scene;
    this.router = router;
    this.ids = ids;
    this.onHover = onHover;
    this.rows = Math.floor((CONTENT.y + CONTENT.h - 8 - LIST_TOP + ROW_GAP) / (ROW_H + ROW_GAP));
    this.index = Math.max(0, Math.min(ids.length - 1, index));
    this.offset = Math.max(0, Math.min(this.index - this.rows + 1, ids.length - this.rows));
    this.container = scene.add.container(0, 0).setDepth(20);
    this.bar = scene.add.graphics().setDepth(20);
    this.track = { x: CONTENT.x + CONTENT.w - 8 - BAR_W, y: LIST_TOP, h: this.rows * (ROW_H + ROW_GAP) - ROW_GAP };
    const inside = (p) => {
      const x = localX(scene, p);
      const y = localY(scene, p);
      return x >= CONTENT.x && x <= CONTENT.x + CONTENT.w && y >= CONTENT.y && y <= CONTENT.y + CONTENT.h;
    };
    this.onWheel = (p, over, dx, dy) => inside(p) && this.scroll(Math.sign(dy));
    this.onMove = (p) => this.dragBar && p.isDown && this.scrollTo(localY(scene, p));
    this.onUp = () => {
      this.dragBar = false;
    };
    scene.input.on('wheel', this.onWheel);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    if (ids.length > this.rows) {
      const t = this.track;
      const zone = scene.add.zone(t.x - 6, t.y, BAR_W + 12, t.h).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(21);
      zone.on('pointerdown', (p, lx, ly, e) => {
        e?.stopPropagation();
        this.dragBar = true;
        this.scrollTo(localY(scene, p));
      });
      this.barZone = zone;
    }
    this.render();
  }

  get max() {
    return Math.max(0, this.ids.length - this.rows);
  }

  scroll(step) {
    const next = Math.max(0, Math.min(this.max, this.offset + step));
    if (next === this.offset) return;
    this.offset = next;
    this.render();
  }

  // Kéo / bấm thanh cuộn: con trỏ ở độ cao y thì cuộn tới chỗ tương ứng
  scrollTo(y) {
    const t = this.track;
    const k = Math.max(0, Math.min(1, (y - t.y) / t.h));
    const next = Math.round(k * this.max);
    if (next === this.offset) return;
    this.offset = next;
    this.render();
  }

  render() {
    const { scene } = this;
    this.container.removeAll(true);
    const scrollable = this.ids.length > this.rows;
    const x = CONTENT.x + 8;
    const w = CONTENT.w - 16 - (scrollable ? BAR_W + 8 : 0);
    this.ids.slice(this.offset, this.offset + this.rows).forEach((id, k) => {
      const i = this.offset + k;
      const y = LIST_TOP + k * (ROW_H + ROW_GAP);
      const on = i === this.index;
      const g = scene.add.graphics();
      g.fillStyle(on ? C.cardHi : C.card);
      g.fillRoundedRect(x, y, w, ROW_H, 8);
      g.lineStyle(on ? 2 : 1, on ? C.tipEdge : C.edge, on ? 1 : 0.7);
      g.strokeRoundedRect(x, y, w, ROW_H, 8);
      const item = ITEMS[id];
      const icon = scene.add.image(x + 22, y + ROW_H / 2, item.icon).setScale(fitScale(scene, item.icon, 28));
      const name = fitText(scene.add.text(x + 44, y + ROW_H / 2, item.name, textStyle(15, TEXT, { fontStyle: 'bold' })).setOrigin(0, 0.5), w - 96, 0.75);
      const count = scene.add.text(x + w - 10, y + ROW_H / 2, `x${itemCount(id)}`, textStyle(14, DIM, { fontStyle: 'bold' })).setOrigin(1, 0.5);
      const zone = scene.add.zone(x, y, w, ROW_H).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.hover(i));
      zone.on('pointerdown', (p) => {
        if (p.rightButtonDown()) return;
        this.finish(id);
      });
      this.container.add([g, icon, name, count, zone]);
    });
    // Thanh cuộn: rãnh mờ + con trượt dài theo tỉ lệ số dòng hiện / tổng số dòng
    const b = this.bar.clear();
    if (!scrollable) return;
    const t = this.track;
    b.fillStyle(0x1b2338);
    b.fillRoundedRect(t.x, t.y, BAR_W, t.h, BAR_W / 2);
    const thumb = Math.max(28, (t.h * this.rows) / this.ids.length);
    const ty = t.y + ((t.h - thumb) * this.offset) / this.max;
    b.fillStyle(0x5a6a94);
    b.fillRoundedRect(t.x, ty, BAR_W, thumb, BAR_W / 2);
  }

  hover(i) {
    if (i === this.index) return;
    this.index = i;
    this.render();
    this.onHover?.(this.ids[i]);
  }

  open() {
    const openedAt = performance.now();
    this.onHover?.(this.ids[this.index]);
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set((e) => e.timeStamp >= openedAt && this.handleKey(e), () => {});
    });
  }

  handleKey(e) {
    const dir = directionOf(e);
    if (dir === 'up' || dir === 'down') {
      const i = Math.max(0, Math.min(this.ids.length - 1, this.index + (dir === 'up' ? -1 : 1)));
      if (i < this.offset) this.offset = i;
      if (i >= this.offset + this.rows) this.offset = i - this.rows + 1;
      this.index = -1;
      this.hover(i);
    } else if (isConfirm(e)) this.finish(this.ids[this.index]);
  }

  finish(value) {
    if (this.done) return;
    this.done = true;
    this.router.clear();
    const { scene } = this;
    scene.input.off('wheel', this.onWheel);
    scene.input.off('pointermove', this.onMove);
    scene.input.off('pointerup', this.onUp);
    // Huỷ ở khung hình sau: có thể đang trong sự kiện chuột của chính dòng vừa bấm
    this.container.setVisible(false);
    this.bar.destroy();
    this.barZone?.destroy();
    scene.time.delayedCall(0, () => this.container.destroy());
    this.resolve?.(value);
  }
}
