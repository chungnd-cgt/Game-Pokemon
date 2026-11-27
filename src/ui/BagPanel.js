import Phaser from 'phaser';
import { BAG_POCKETS, ITEMS } from '../data/items.js';
import { itemCount } from '../game/state.js';
import { fitScale } from '../gfx/textures.js';
import { ItemTip } from './BagParts.js';
import { bagItems, pocketCounts, searchKey } from './bagSearch.js';
import { closeButton, fitText, fixToCamera, followCenter, localX, localY, textStyle, uiX } from './helpers.js';
import { FloatWindow } from './Windows.js';
import { directionOf, isCancel, isConfirm } from './input.js';

// Màu khung túi đồ: than chì tối, viền xám mảnh, ô vật phẩm xám nổi trên nền lõm
const C = {
  frame: 0x2a2c32, // khung ngoài (đầu khung + dải tab)
  head: 0x33363d, // dải đầu khung (biểu tượng túi, tên ngăn, ô tìm kiếm)
  edge: 0x55585f,
  shine: 0x6c7078, // viền sáng mép trên
  body: 0x1d1f24, // nền lõm chứa lưới vật phẩm
  bodyEdge: 0x3a3d44,
  tabHover: 0x34373e,
  tabOn: 0x3e4149,
  cell: 0x34373e,
  cellEdge: 0x4b4e56,
  cellHover: 0x3e414a,
  cellOn: 0x484c56,
  iconBox: 0x24262b,
  gold: 0xffd860,
  field: 0x1a1c20,
  fieldEdge: 0x5a5e68,
};
const OUT = 6; // lề khung ngoài
const HEAD_H = 50; // dải đầu khung
const RAIL_W = 46; // dải tab dọc bên trái (chỉ icon)
const TAB_H = 42;
const TAB_GAP = 4;
const SEARCH_W = 176;
const SEARCH_H = 26;
const CELL_H = 46;
const CELL_MIN_W = 128; // ô vật phẩm hẹp nhất: lưới chia nhiều cột theo bề rộng khung
const GAP = 6;
const PAD = 8;
const DRAG_START = 10;
const MAX_QUERY = 20;
const DESC_H = 84; // ô mô tả trong khung (tipSide 'inside')
const TIP_MIN_W = 230; // mô tả nhỏ dưới ô: rộng ít nhất chừng này (ô hẹp thì tràn sang hai bên, vẫn trong lưới)

// Biểu tượng túi đồ vẽ bằng hình khối (ba lô vàng cam, nắp sẫm, túi nhỏ phía trước, hai quai), tâm (x, y), cao ~size
function drawBagIcon(g, x, y, size = 34) {
  const k = size / 34;
  const r = (dx, dy, w, h, rad, color) => {
    g.fillStyle(color);
    g.fillRoundedRect(x + dx * k, y + dy * k, w * k, h * k, rad * k);
  };
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(x + 1 * k, y + 16 * k, 30 * k, 6 * k);
  g.lineStyle(3 * k, 0x8a5410);
  g.strokeRoundedRect(x - 7 * k, y - 17 * k, 14 * k, 10 * k, 4 * k); // quai xách
  r(-15, -11, 30, 27, 8, 0x8a5410);
  r(-14, -10, 28, 25, 7, 0xf0b030);
  r(-14, -10, 28, 4, 3, 0xffd870);
  r(-15, -11, 30, 11, 6, 0xc87818); // nắp
  r(-14, -10, 28, 3, 3, 0xe8a030);
  r(-8, 3, 16, 10, 3, 0xc87818); // túi trước
  r(-7, 4, 14, 3, 2, 0xe09a28);
  r(-2, -2, 4, 5, 1, 0x6a3a08); // khoá
}

// Ô mô tả vật phẩm nằm trong khung túi, dưới lưới (dùng khi bên cạnh túi không còn chỗ, vd trong trận).
// Cùng cách gọi với BagParts.ItemTip: show(id) / hide() / destroy()
class InlineTip {
  constructor(scene, parent, x, y, w) {
    this.container = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(C.field);
    g.fillRoundedRect(x, y, w, DESC_H - 8, 8);
    g.fillStyle(C.gold);
    g.fillRect(x, y + 12, 3, 20);
    this.name = scene.add.text(x + 14, y + 8, '', textStyle(16, '#ffd860', { fontStyle: 'bold' }));
    this.desc = scene.add.text(x + 14, y + 31, '', textStyle(14, '#e8ecf6', { wordWrap: { width: w - 28 }, maxLines: 2, lineSpacing: 2 }));
    this.container.add([g, this.name, this.desc]).setVisible(false);
    parent.add(this.container);
  }

  show(id) {
    const item = ITEMS[id];
    if (!item) return this.hide();
    this.name.setText(item.name);
    this.desc.setText(item.desc ?? '');
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  destroy() {
    this.container.destroy();
  }
}

// Túi đồ dạng khung than chì: đầu khung có biểu tượng túi + tên ngăn + ô tìm kiếm nhỏ bên phải, dải tab dọc bên TRÁI chỉ có icon
// (rê chuột hiện tên ngăn). Ô tìm kiếm: không phân biệt dấu; Esc / phím quay lại xoá chữ; túi chỉ đóng bằng ✕. Vật phẩm
// xếp lưới nhiều cột theo bề rộng khung (ô nhỏ: icon trong ô vuông tối, tên, x số lượng) cuộn bằng con lăn chuột / phím hướng. Phím hướng / xác nhận / quay lại theo Cài đặt → Điều khiển, trừ
// phím gõ ra chữ (dành cho ô tìm kiếm). Rê chuột / di phím tới vật phẩm thì hiện mô tả nhỏ (BagParts.ItemTip) ngay dưới ô.
// open() trả về id vật phẩm được chọn, hoặc null nếu đóng túi.
// opts:
//  x, y, width, height  khung ngoài (bao cả dải tab lẫn khung vật phẩm)        depth, fixed (ghim vào màn hình khi camera trôi)
//  allow(id)            chỉ hiện vật phẩm qua bộ lọc (vd trong trận: đồ dùng được khi đấu)
//  pockets              các ngăn hiện trên dải tab (mặc định BAG_POCKETS)
//  memory               object nhớ ngăn / chữ tìm / vị trí con trỏ giữa các lần mở: { pocket, query, index }
//  title                tiêu đề thay cho tên ngăn (vd "Chọn đồ cho ô 3")
//  hotbar               thanh phím tắt (ui/Hotbar.js): kéo icon vật phẩm thả vào ô để gán, bấm phím của ô để gán
//  onAssign(slot, id)   gán vật phẩm id vào ô phím tắt slot       hotkey(e): phím -> ô (0-5) hoặc null
//  tipSide              'inside': ô mô tả trong khung, dưới lưới; null: không mô tả; mặc định: mô tả nhỏ ngay dưới ô vật phẩm
//  count(id)            số lượng (mặc định game/state.js itemCount)
//  windows              cửa sổ nổi trên bản đồ (ui/Windows.js: WindowManager): túi là một cửa sổ kéo được, mở song song
//                       với cửa sổ khác; không dùng open() / router mà gọi lại: onPick(id) khi chọn vật phẩm,
//                       onGive(monIndex, id) khi kéo vật phẩm thả vào Pokémon ở cột đội hình, dropItem(p, id) cho cửa sổ
//                       khác nhận vật phẩm thả vào (vd ô đồ cầm của bảng chi tiết Pokémon: trả về true nếu đã nhận).
//                       dragOver(p | null): đang kéo vật phẩm tới p (để cửa sổ khác sáng chỗ thả); ghostDepth: depth icon đang kéo
export class BagPanel {
  constructor(scene, router, opts) {
    this.scene = scene;
    this.router = router;
    this.opts = opts;
    this.pockets = opts.pockets ?? BAG_POCKETS;
    this.count = opts.count ?? itemCount;
    this.memory = opts.memory ?? {};
    this.memory.index ??= {};
    this.pocket = Phaser.Math.Clamp(this.memory.pocket ?? 0, 0, this.pockets.length - 1);
    this.query = this.memory.query ?? '';
    this.depth = opts.depth ?? 20;
    const { x, y, width, height } = opts;
    this.rect = new Phaser.Geom.Rectangle(x, y, width, height);
    // Dải đầu khung chạy hết bề ngang; bên dưới: dải tab dọc bên trái, nền lõm chứa lưới vật phẩm bên phải
    this.rail = { x: x + OUT, y: y + HEAD_H, w: RAIL_W, h: height - HEAD_H - OUT };
    const bx = this.rail.x + RAIL_W + 2;
    this.body = { x: bx, y: y + HEAD_H, w: x + width - OUT - bx, h: height - HEAD_H - OUT };
    this.search = { x: x + width - 46 - SEARCH_W, y: y + (HEAD_H - SEARCH_H) / 2 + 1, w: SEARCH_W, h: SEARCH_H };
    this.grid = {
      x: this.body.x + PAD,
      y: this.body.y + PAD,
      w: this.body.w - PAD * 2 - 10, // chừa thanh cuộn bên phải
      h: this.body.h - PAD * 2 - (opts.tipSide === 'inside' ? DESC_H : 0),
    };
    // Số cột theo bề rộng lưới (khung 508px: 3 cột)
    this.cols = Math.max(1, Math.floor((this.grid.w + GAP) / (CELL_MIN_W + GAP)));
    this.cellW = (this.grid.w - GAP * (this.cols - 1)) / this.cols;
    this.visibleRows = Math.max(1, Math.floor((this.grid.h + GAP) / (CELL_H + GAP)));
    if (opts.windows) {
      // Cửa sổ nổi: kéo bằng dải đầu khung (trừ ô tìm kiếm và nút ✕)
      this.win = new FloatWindow(opts.windows, {
        id: 'bag', rect: { x, y, w: width, h: height }, dragRect: { x, y, w: this.search.x - x - 6, h: HEAD_H },
        onKey: (e) => this.handleKey(e), onClose: () => this.cleanup(),
      });
      this.container = this.win.root;
      opts.fixed = true;
    } else this.container = scene.add.container(0, 0).setDepth(this.depth);
    this.tabLayer = scene.add.container(0, 0);
    this.headLayer = scene.add.container(0, 0);
    this.gridLayer = scene.add.container(0, 0);
    this.labelLayer = scene.add.container(0, 0); // tên ngăn khi rê chuột lên tab (nổi trên lưới)
    this.drawFrame();
    this.container.add([this.tabLayer, this.headLayer, this.gridLayer, this.labelLayer]);
    if (opts.tipSide === 'inside') {
      this.tip = new InlineTip(scene, this.container, this.body.x + PAD, this.body.y + this.body.h - PAD - DESC_H + 8, this.body.w - PAD * 2);
      this.inlineTip = true;
    } else if (this.win) {
      // Mô tả nằm trong cửa sổ (đi theo khi kéo cửa sổ), trên lưới vật phẩm
      this.tip = new ItemTip(scene, 0, { inside: true, limitY: () => scene.scale.height - this.win.oy });
      this.container.add(this.tip.container);
    } else this.tip = opts.tipSide === null ? null : new ItemTip(scene, this.depth + 2);
    this.rebuild();
    if (this.win) {
      this.container.bringToTop(this.tip.container);
      opts.windows.open(this.win);
      this.listen();
    } else if (opts.fixed) {
      // Trên bản đồ (cố định theo màn hình): dời vào giữa màn hình rộng
      fixToCamera(this.container).setX(uiX(scene));
      followCenter(scene, [this.container]);
    }
  }

  // ---------- Vẽ ----------

  drawFrame() {
    const { scene, body, rect } = this;
    const g = scene.add.graphics();
    // khung ngoài: bóng đổ, nền than chì, viền xám mảnh, dải đầu khung sáng hơn, viền sáng mép trên
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(rect.x + 4, rect.y + 6, rect.width, rect.height, 14);
    g.fillStyle(C.frame);
    g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 14);
    g.fillStyle(C.head);
    g.fillRoundedRect(rect.x, rect.y, rect.width, HEAD_H, { tl: 14, tr: 14, bl: 0, br: 0 });
    g.fillStyle(0x000000, 0.22);
    g.fillRect(rect.x + 2, rect.y + HEAD_H - 2, rect.width - 4, 2);
    g.lineStyle(2, 0x15161a);
    g.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 14);
    g.lineStyle(1, C.edge);
    g.strokeRoundedRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3, 13);
    g.lineStyle(1, C.shine, 0.7);
    g.lineBetween(rect.x + 14, rect.y + 2.5, rect.x + rect.width - 14, rect.y + 2.5);
    // nền lõm chứa lưới vật phẩm
    g.fillStyle(C.body);
    g.fillRoundedRect(body.x, body.y, body.w, body.h, 8);
    g.lineStyle(1, C.bodyEdge);
    g.strokeRoundedRect(body.x + 0.5, body.y + 0.5, body.w - 1, body.h - 1, 8);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(body.x + 6, body.y + 1, body.w - 12, 2);
    // biểu tượng túi ở góc trái đầu khung
    drawBagIcon(g, rect.x + OUT + RAIL_W / 2, rect.y + HEAD_H / 2 + 1, 34);
    this.container.add(g);
    // Nút ✕ đóng túi
    this.container.add(closeButton(scene, rect.x + rect.width - 24, rect.y + HEAD_H / 2 + 1, () => this.close(), 26));
  }

  // Dải tab dọc bên trái, chỉ icon: ngăn đang mở có nền sáng + vạch vàng, ngăn trống mờ đi. Rê chuột thì hiện tên ngăn
  drawTabs() {
    const { scene, rail } = this;
    this.tabLayer.removeAll(true);
    this.labelLayer.removeAll(true);
    const counts = pocketCounts({ count: this.count, allow: this.opts.allow, pockets: this.pockets });
    const searching = Boolean(searchKey(this.query));
    const label = scene.add.container(0, 0).setVisible(false);
    const labelBg = scene.add.graphics();
    const labelText = scene.add.text(0, 0, '', textStyle(13, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5);
    label.add([labelBg, labelText]);
    const showLabel = (i, ty) => {
      const lx = rail.x + RAIL_W + 4;
      const cy = ty + TAB_H / 2;
      labelText.setText(this.pockets[i].name).setPosition(lx + 9, cy);
      const lw = labelText.width + 18;
      labelBg.clear();
      labelBg.fillStyle(0x000000, 0.3);
      labelBg.fillRoundedRect(lx + 2, cy - 11, lw, 26, 6);
      labelBg.fillStyle(0x15161a, 0.96);
      labelBg.fillRoundedRect(lx, cy - 13, lw, 26, 6);
      labelBg.lineStyle(1, C.edge);
      labelBg.strokeRoundedRect(lx + 0.5, cy - 12.5, lw - 1, 25, 6);
      label.setVisible(true);
    };
    this.pockets.forEach((pocket, i) => {
      const on = i === this.pocket && !searching;
      const tx = rail.x + 3;
      const tw = RAIL_W - 6;
      const ty = rail.y + 8 + i * (TAB_H + TAB_GAP);
      const g = scene.add.graphics();
      const draw = (hover) => {
        g.clear();
        if (on || hover) {
          g.fillStyle(on ? C.tabOn : C.tabHover);
          g.fillRoundedRect(tx, ty, tw, TAB_H, 8);
          g.lineStyle(1, on ? C.edge : C.bodyEdge);
          g.strokeRoundedRect(tx + 0.5, ty + 0.5, tw - 1, TAB_H - 1, 8);
        }
        if (on) {
          g.fillStyle(C.gold);
          g.fillRoundedRect(tx + 2, ty + 9, 3, TAB_H - 18, 1.5);
        }
      };
      draw(false);
      const icon = ITEMS[pocket.item].icon;
      const dim = counts[i] === 0 ? 0.35 : 1;
      const img = scene.add.image(tx + tw / 2 + 1, ty + TAB_H / 2, icon).setScale(fitScale(scene, icon, on ? 30 : 26))
        .setAlpha((on ? 1 : 0.75) * dim);
      const zone = scene.add.zone(tx + tw / 2, ty + TAB_H / 2, tw, TAB_H).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (!on) draw(true);
        showLabel(i, ty);
      });
      zone.on('pointerout', () => {
        draw(false);
        label.setVisible(false);
      });
      // đổi ngăn ở khung hình sau: không xoá tab đang nhận sự kiện chuột
      zone.on('pointerdown', () => scene.time.delayedCall(0, () => !this.done && this.setPocket(i)));
      this.tabLayer.add([g, img, zone]);
    });
    this.labelLayer.add(label);
    if (this.opts.fixed) fixToCamera(this.labelLayer);
    if (this.opts.fixed) fixToCamera(this.tabLayer);
  }

  // Đầu khung: tên ngăn / "Tìm kiếm" cạnh biểu tượng túi, ô tìm kiếm nhỏ bên phải (nút ✕ xoá chữ), con trỏ nhấp nháy
  drawHead() {
    const { scene, rect } = this;
    this.headLayer.removeAll(true);
    this.caretTween?.remove();
    const searching = Boolean(searchKey(this.query));
    const name = this.opts.title ?? (searching ? 'Tìm kiếm' : this.pockets[this.pocket].name);
    const title = scene.add.text(rect.x + OUT + RAIL_W + 8, rect.y + HEAD_H / 2 + 1, name, textStyle(21, '#ffffff', {
      fontStyle: 'bold', shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, fill: true },
    })).setOrigin(0, 0.5);
    fitText(title, this.search.x - title.x - 10, 0.7);
    this.headLayer.add(title);

    const { x: fx, y: fy, w: fw, h: fh } = this.search;
    const g = scene.add.graphics();
    g.fillStyle(C.field);
    g.fillRoundedRect(fx, fy, fw, fh, 5);
    g.lineStyle(1, this.query || this.searchInput ? C.gold : C.fieldEdge);
    g.strokeRoundedRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1, 5);
    g.fillStyle(0x000000, 0.35);
    g.fillRect(fx + 3, fy + 1, fw - 6, 2);
    // nút ✕ xoá chữ: ô vuông nhỏ ở mép phải ô tìm kiếm (mờ khi chưa có chữ)
    const bs = fh - 8;
    const bx = fx + fw - bs - 4;
    const by = fy + 4;
    g.fillStyle(this.query ? 0xe8e8ec : 0x80848e);
    g.fillRoundedRect(bx, by, bs, bs, 3);
    g.lineStyle(2, 0x2a2c32);
    const d = bs * 0.24;
    g.lineBetween(bx + bs / 2 - d, by + bs / 2 - d, bx + bs / 2 + d, by + bs / 2 + d);
    g.lineBetween(bx + bs / 2 - d, by + bs / 2 + d, bx + bs / 2 + d, by + bs / 2 - d);
    this.headLayer.add(g);
    const shown = this.query || 'Tìm kiếm..';
    const text = scene.add.text(fx + 9, fy + fh / 2, shown, textStyle(14, this.query ? '#ffffff' : '#4aaee0', { fontStyle: 'bold' })).setOrigin(0, 0.5);
    this.headLayer.add(text);
    // Mở túi không tự vào ô tìm kiếm: bấm / chạm vào ô mới gõ được (ô nhập HTML để điện thoại hiện bàn phím)
    const field = scene.add.zone(fx, fy, bx - fx - 2, fh).setOrigin(0).setInteractive({ useHandCursor: true });
    field.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      scene.time.delayedCall(0, () => !this.done && this.focusSearch(this.search));
    });
    this.headLayer.add(field);
    if (this.searchInput) {
      const caret = scene.add.rectangle(this.query ? text.x + text.width + 2 : text.x - 2, fy + fh / 2, 2, 16, C.gold);
      this.headLayer.add(caret);
      this.caretTween = scene.tweens.add({ targets: caret, alpha: 0, duration: 450, yoyo: true, repeat: -1, ease: 'Stepped' });
    }
    const clear = scene.add.zone(bx + bs / 2, by + bs / 2, bs + 6, fh).setInteractive({ useHandCursor: true });
    clear.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      if (this.query) scene.time.delayedCall(0, () => !this.done && this.setQuery(''));
    });
    this.headLayer.add(clear);

    if (this.opts.fixed) fixToCamera(this.headLayer);
  }

  // Lưới vật phẩm nhiều cột (this.cols); chỉ các hàng trong khung được hiện (cuộn)
  drawGrid() {
    const { scene } = this;
    this.gridLayer.removeAll(true);
    this.cells = [];
    if (!this.list.length) {
      const msg = searchKey(this.query) ? `Không tìm thấy "${this.query}"` : 'Ngăn này chưa có gì';
      this.gridLayer.add(scene.add.text(this.grid.x + this.grid.w / 2, this.grid.y + 50, msg, textStyle(16, '#8a8e98')).setOrigin(0.5));
      this.scrollBar = null;
      if (this.opts.fixed) fixToCamera(this.gridLayer);
      return;
    }
    const w = this.cellW;
    this.list.forEach((id, i) => {
      const item = ITEMS[id];
      const cell = scene.add.container(0, 0);
      const bg = scene.add.graphics();
      const icon = scene.add.image(-w / 2 + 22, 0, item.icon).setScale(fitScale(scene, item.icon, 28));
      // Vật phẩm quan trọng không có dòng số lượng: tên nằm giữa ô
      const name = scene.add.text(-w / 2 + 43, item.kind === 'key' ? 0 : -8, item.name, textStyle(14, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5);
      // Tên dài quá ô thì thu nhỏ chữ (vẫn dài thì cắt bớt kèm "…")
      fitText(name, w - 43 - 6, 0.75);
      cell.add([bg, icon, name]);
      if (item.kind !== 'key') {
        cell.add(scene.add.text(-w / 2 + 43, 9, `x${this.count(id)}`, textStyle(12, '#c4c8d0', { fontStyle: 'bold' })).setOrigin(0, 0.5));
      }
      const zone = scene.add.zone(0, 0, w, CELL_H).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (this.drag) return;
        this.hover = i;
        this.select(i, true);
      });
      zone.on('pointerout', () => {
        if (this.hover === i) this.hover = -1;
        // Chuột rời khỏi vật phẩm đang chọn (không sang vật phẩm khác): bỏ sáng ô, ẩn mô tả.
        // Con trỏ vẫn nhớ vị trí: bấm phím mũi tên / Enter là hiện lại
        if (this.index === i && !this.drag) this.blur();
        else this.drawCell(i);
      });
      zone.on('pointerdown', (p) => {
        if (p.rightButtonDown()) return;
        this.select(i, true);
        this.press = { i, x: p.x, y: p.y };
      });
      cell.add(zone);
      this.gridLayer.add(cell);
      this.cells.push({ cell, bg, zone, icon, row: Math.floor(i / this.cols), col: i % this.cols });
    });
    this.scrollBar = scene.add.graphics();
    this.gridLayer.add(this.scrollBar);
    if (this.opts.fixed) fixToCamera(this.gridLayer);
  }

  drawCell(i) {
    const c = this.cells?.[i];
    if (!c) return;
    const w = this.cellW;
    const h = CELL_H;
    const on = i === this.index && this.focused;
    const g = c.bg;
    g.clear();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-w / 2, -h / 2 + 2, w, h, 6);
    g.fillStyle(on ? C.cellOn : i === this.hover ? C.cellHover : C.cell);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(1, on ? C.gold : C.cellEdge);
    g.strokeRoundedRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, 6);
    g.lineStyle(1, 0xffffff, on ? 0.18 : 0.08);
    g.lineBetween(-w / 2 + 6, -h / 2 + 1.5, w / 2 - 6, -h / 2 + 1.5);
    // ô vuông tối sau icon
    g.fillStyle(C.iconBox);
    g.fillRoundedRect(-w / 2 + 5, -17, 34, 34, 5);
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeRoundedRect(-w / 2 + 5.5, -16.5, 33, 33, 5);
  }

  // Đặt vị trí các ô theo hàng đang cuộn, ẩn hàng ngoài khung, vẽ thanh cuộn
  layout() {
    if (!this.cells) return;
    const rows = Math.ceil(this.list.length / this.cols);
    this.cells.forEach((c, i) => {
      const r = c.row - this.scroll;
      const show = r >= 0 && r < this.visibleRows;
      c.cell.setVisible(show).setPosition(
        this.grid.x + c.col * (this.cellW + GAP) + this.cellW / 2,
        this.grid.y + r * (CELL_H + GAP) + CELL_H / 2,
      );
      if (c.zone.input) c.zone.input.enabled = show;
      this.drawCell(i);
    });
    const g = this.scrollBar;
    if (!g) return;
    g.clear();
    if (rows <= this.visibleRows) return;
    const tx = this.grid.x + this.grid.w + 4;
    const th = this.visibleRows * (CELL_H + GAP) - GAP;
    g.fillStyle(0x121317);
    g.fillRoundedRect(tx, this.grid.y, 5, th, 2.5);
    const h = Math.max(24, (th * this.visibleRows) / rows);
    const top = this.grid.y + ((th - h) * this.scroll) / (rows - this.visibleRows);
    g.fillStyle(0x7a7e88);
    g.fillRoundedRect(tx, top, 5, h, 2.5);
  }

  // Dựng lại danh sách (mở túi / đổi ngăn / đổi chữ tìm). Không tự sáng ô nào: con trỏ chỉ nhớ vị trí của ngăn đó, rê chuột
  // hoặc bấm phím hướng / xác nhận mới sáng ô
  rebuild() {
    this.list = bagItems({ count: this.count, pocket: this.pocket, query: this.query, allow: this.opts.allow, pockets: this.pockets });
    this.hover = -1;
    this.scroll = 0;
    this.index = -1;
    this.focused = false;
    this.drawTabs();
    this.drawHead();
    this.drawGrid();
    const remembered = this.memory.index[this.memoryKey()] ?? 0;
    const at = this.list.length ? Phaser.Math.Clamp(remembered, 0, this.list.length - 1) : -1;
    this.index = at;
    if (at >= 0) {
      const row = Math.floor(at / this.cols);
      if (row >= this.visibleRows) this.scroll = row - this.visibleRows + 1;
    }
    this.layout();
    this.tip?.hide();
  }

  memoryKey() {
    return searchKey(this.query) ? 'search' : this.pockets[this.pocket].id;
  }

  // ---------- Điều khiển ----------

  // showTip: hiện mô tả (lúc mới mở túi thì chưa hiện, di phím / rê chuột mới hiện)
  select(i, showTip = true) {
    if (i < 0 || i >= this.list.length) return;
    this.index = i;
    this.focused = true;
    this.memory.index[this.memoryKey()] = i;
    const row = Math.floor(i / this.cols);
    if (row < this.scroll) this.scroll = row;
    else if (row >= this.scroll + this.visibleRows) this.scroll = row - this.visibleRows + 1;
    this.layout();
    // ô mô tả trong khung luôn hiện; khung mô tả bên cạnh chỉ hiện khi di phím / rê chuột
    if (showTip || this.inlineTip) this.showTip();
    else this.tip?.hide();
  }

  // Bỏ sáng ô đang chọn và ẩn mô tả (chuột rời khỏi vật phẩm)
  blur() {
    this.focused = false;
    this.drawCell(this.index);
    this.tip?.hide();
  }

  showTip() {
    if (!this.tip || !this.focused) return;
    const id = this.list[this.index];
    const c = this.cells?.[this.index];
    if (!id || !c?.cell.visible) {
      this.tip.hide();
      return;
    }
    if (this.inlineTip) return this.tip.show(id);
    // Mô tả nhỏ ngay dưới ô vật phẩm (không vừa đáy màn hình thì lật lên trên ô)
    // ô hẹp: khung mô tả rộng hơn ô, dời vào trong lưới cho khỏi tràn ra ngoài túi
    const w = Math.min(this.grid.w + 10, Math.max(this.cellW, TIP_MIN_W));
    const x = Phaser.Math.Clamp(c.cell.x - this.cellW / 2, this.grid.x, this.grid.x + this.grid.w + 10 - w);
    this.tip.showBelow(id, x, c.cell.y + CELL_H / 2 + 4, w, c.cell.y - CELL_H / 2 - 4);
  }

  scrollBy(rows) {
    const max = Math.max(0, Math.ceil(this.list.length / this.cols) - this.visibleRows);
    const next = Phaser.Math.Clamp(this.scroll + rows, 0, max);
    if (next === this.scroll) return;
    this.scroll = next;
    this.layout();
    this.showTip();
  }

  setPocket(i) {
    const n = this.pockets.length;
    const next = ((i % n) + n) % n;
    const searching = Boolean(searchKey(this.query));
    if (next === this.pocket && !searching) return;
    this.pocket = next;
    this.memory.pocket = next;
    // bấm sang ngăn khác thì thôi tìm kiếm
    this.query = '';
    this.memory.query = '';
    this.rebuild();
  }

  // Bấm vào ô tìm kiếm: đặt ô nhập HTML trong suốt đè đúng chỗ ô (gõ được tiếng Việt, điện thoại hiện bàn phím).
  // Enter / Esc / bấm ra chỗ khác thì thôi gõ (chữ đã gõ vẫn giữ)
  focusSearch(field) {
    if (this.searchInput) return this.searchInput.focus();
    const { scene } = this;
    const input = document.createElement('input');
    // 'text' chứ không 'search' (trình duyệt tự vẽ thêm nút ✕ riêng), không placeholder (chữ gợi ý vẽ trong game rồi:
    // placeholder HTML vẫn hiện dù chữ trong suốt, đè lên thành 2 dòng chữ)
    input.type = 'text';
    input.enterKeyHint = 'search';
    input.value = this.query;
    input.maxLength = MAX_QUERY;
    input.autocomplete = 'off';
    const place = () => {
      const r = scene.game.canvas.getBoundingClientRect();
      const k = r.width / scene.scale.width;
      Object.assign(input.style, {
        position: 'fixed', left: `${r.left + (uiX(scene) + (this.win?.ox ?? 0) + field.x + 8) * k}px`, top: `${r.top + ((this.win?.oy ?? 0) + field.y) * k}px`,
        width: `${(field.w - field.h - 12) * k}px`, height: `${field.h * k}px`, fontSize: `${14 * k}px`, zIndex: 30, boxSizing: 'border-box',
        border: '0', outline: 'none', background: 'transparent', color: 'transparent', caretColor: 'transparent', padding: '0',
      });
    };
    place();
    input.addEventListener('input', () => this.setQuery(input.value));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === 'Enter' || e.key === 'Escape') input.blur();
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('blur', () => this.blurSearch());
    this.searchInput = input;
    document.body.appendChild(input);
    input.focus();
    this.drawHead();
  }

  blurSearch() {
    const input = this.searchInput;
    if (!input) return;
    this.searchInput = null;
    input.remove();
    if (!this.done) this.drawHead();
  }

  setQuery(q) {
    const next = q.slice(0, MAX_QUERY);
    if (next === this.query) return;
    this.query = next;
    this.memory.query = next;
    this.rebuild();
  }

  // Toạ độ con trỏ trong khung thiết kế (cửa sổ nổi: trừ phần đã kéo dời)
  pt(p) {
    return this.win ? this.win.local(p) : { x: localX(this.scene, p), y: localY(this.scene, p) };
  }

  // Con lăn chuột / kéo thả vật phẩm
  listen() {
    const { scene } = this;
    this.onWheel = (p, objs, dx, dy) => {
      if (this.win && this.opts.windows.router.active) return;
      const at = this.pt(p);
      // Cửa sổ nổi: chỉ cuộn túi khi túi đang ở trên cùng chỗ con trỏ
      if (this.win && [...this.opts.windows.list].reverse().find((w) => w.contains(p)) !== this.win) return;
      if (dy && this.rect.contains(at.x, at.y)) this.scrollBy(Math.sign(dy));
    };
    this.onMove = (p) => this.dragMove(p);
    this.onUp = (p) => this.dragEnd(p);
    scene.input.on('wheel', this.onWheel);
    scene.input.on('pointermove', this.onMove);
    scene.input.on('pointerup', this.onUp);
    scene.input.keyboard?.addCapture('TAB');
  }

  // Sau khi dùng vật phẩm (cửa sổ nổi): vẽ lại danh sách theo số lượng mới, giữ ngăn đang xem
  refresh() {
    if (this.done) return;
    this.rebuild();
  }

  open() {
    const openedAt = performance.now();
    this.listen();
    return new Promise((resolve) => {
      this.resolve = resolve;
      // Chuột phải / bấm ra ngoài không đóng túi: chỉ nút ✕
      this.router.set((e) => e.timeStamp >= openedAt && this.handleKey(e));
    });
  }

  handleKey(e) {
    const n = this.list.length;
    const i = this.index;
    const searching = Boolean(searchKey(this.query));
    if (e.code === 'Tab') {
      e.preventDefault?.();
      if (!e.repeat) this.setPocket(this.pocket + (e.shiftKey ? -1 : 1));
      return;
    }
    if (e.code === 'PageUp' || e.code === 'PageDown') {
      this.setPocket(this.pocket + (e.code === 'PageUp' ? -1 : 1));
      return;
    }

    // Phím gõ ra chữ dành cho ô tìm kiếm (Space khi chưa gõ gì vẫn là phím xác nhận nếu đã gán) — trừ phím của ô phím tắt
    const slot = this.opts.hotkey?.(e) ?? null;
    const typing = false; // gõ chữ: chỉ khi đã bấm vào ô tìm kiếm (ô nhập HTML nhận phím, xem focusSearch)
    const dir = typing ? null : directionOf(e);
    const confirm = !typing && isConfirm(e);
    // Ô đang chọn bị bỏ sáng (chuột vừa rời đi): phím hướng / xác nhận đầu tiên chỉ hiện lại con trỏ ở đó
    if (!this.focused && i >= 0 && (dir || confirm)) {
      if (!e.repeat) this.select(i);
      return;
    }
    const { cols } = this;
    switch (dir) {
      case 'up':
        if (i - cols >= 0) this.select(i - cols);
        return;
      case 'down':
        if (i + cols < n) this.select(i + cols);
        else if (Math.floor(i / cols) < Math.floor((n - 1) / cols)) this.select(n - 1);
        return;
      case 'left':
        if (i % cols > 0) this.select(i - 1);
        else if (!searching) this.setPocket(this.pocket - 1);
        return;
      case 'right':
        if (i % cols < cols - 1 && i + 1 < n) this.select(i + 1);
        else if (!searching) this.setPocket(this.pocket + 1);
        return;
    }
    if (confirm) {
      this.confirm();
      return;
    }
    // Esc / phím quay lại chỉ xoá chữ đang tìm, không đóng túi. Túi chỉ đóng bằng nút ✕
    if ((e.code === 'Escape' || (!typing && isCancel(e))) && !e.repeat) {
      if (this.query) this.setQuery('');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Phím của ô phím tắt (mặc định 1-6, khi có thanh phím tắt): gán vật phẩm đang chọn vào ô đó
    if (slot !== null && this.opts.onAssign) {
      if (!e.repeat && this.list[i]) {
        this.opts.onAssign(slot, this.list[i]);
        this.drawGrid();
        this.layout();
      }
      return;
    }
    if (typing && /[\p{L}\p{N}\-' .]/u.test(e.key)) this.setQuery(this.query + e.key);
  }

  confirm() {
    const id = this.list[this.index];
    if (!id) return;
    if (this.win) this.opts.onPick?.(id);
    else this.finish(id);
  }

  // Đóng túi (nút ✕): cửa sổ nổi thì đóng cửa sổ, không thì kết thúc open() với null
  close() {
    if (this.win) this.win.close();
    else this.finish(null);
  }

  // ---------- Kéo thả vào thanh phím tắt ----------

  dragMove(p) {
    const press = this.press;
    if (!press || !p.isDown || this.done) return;
    if (!this.drag) {
      if (!(this.opts.hotbar || this.opts.party) || Math.hypot(p.x - press.x, p.y - press.y) < DRAG_START) return;
      const id = this.list[press.i];
      const icon = ITEMS[id].icon;
      const ghost = this.scene.add.container(p.x, p.y).setDepth(this.opts.ghostDepth ?? this.depth + 6);
      ghost.add([this.scene.add.ellipse(2, 20, 34, 10, 0x000000, 0.25), this.scene.add.image(0, 0, icon).setScale(fitScale(this.scene, icon, 44))]);
      this.drag = { id, ghost: fixToCamera(ghost) };
      this.cells[press.i].cell.setAlpha(0.4);
      this.tip?.hide();
    }
    this.drag.ghost.setPosition(p.x, p.y);
    this.opts.hotbar?.highlight(this.opts.hotbar.slotAt(p.x, p.y));
    this.opts.party?.highlight(this.opts.party.slotAt(p.x, p.y));
    this.opts.dragOver?.(p);
  }

  dragEnd(p) {
    const press = this.press;
    this.press = null;
    if (!press || this.done) return;
    if (!this.drag) {
      // Nhấn rồi thả trên đúng vật phẩm đó: chọn
      const c = this.cells?.[press.i];
      const at = this.pt(p);
      if (c && Math.abs(at.x - c.cell.x) <= this.cellW / 2 && Math.abs(at.y - c.cell.y) <= CELL_H / 2) this.confirm();
      return;
    }
    const { id, ghost } = this.drag;
    this.drag = null;
    ghost.destroy();
    this.cells[press.i]?.cell.setAlpha(1);
    const hotbar = this.opts.hotbar;
    const slot = hotbar ? hotbar.slotAt(p.x, p.y) : -1;
    hotbar?.highlight(-1);
    const mon = this.opts.party ? this.opts.party.slotAt(p.x, p.y) : -1;
    this.opts.party?.highlight(-1);
    this.opts.dragOver?.(null);
    if (slot >= 0) {
      this.opts.onAssign?.(slot, id);
      this.drawGrid();
      this.layout();
    } else if (mon >= 0) {
      // Thả vào Pokémon ở cột đội hình: cho cầm (cửa sổ nổi: gọi onGive; không thì đóng túi, màn hình gọi lo)
      if (this.win) this.opts.onGive?.(mon, id);
      else this.finish({ give: mon, id });
    } else if (this.win) {
      // Thả vào cửa sổ khác nhận vật phẩm (vd ô đồ cầm của bảng chi tiết Pokémon)
      this.opts.dropItem?.(p, id);
    }
  }

  finish(value) {
    if (this.done) return;
    this.router.clear();
    this.cleanup();
    this.container.destroy();
    this.resolve?.(value);
  }

  // Gỡ các bộ nghe sự kiện, ô nhập, icon đang kéo (cửa sổ nổi: gọi khi cửa sổ đóng, root do WindowManager huỷ)
  cleanup() {
    if (this.done) return;
    this.done = true;
    const { scene } = this;
    scene.input.off('wheel', this.onWheel);
    scene.input.off('pointermove', this.onMove);
    scene.input.off('pointerup', this.onUp);
    scene.input.keyboard?.removeCapture('TAB');
    // Gỡ ô nhập đang gõ: bỏ tham chiếu TRƯỚC khi remove (remove ô đang focus gây blur ngay lập tức -> blurSearch remove lần
    // nữa -> lỗi "node no longer a child", đóng túi dở dang và bản đồ kẹt không đi được: bấm ✕ lúc đang gõ tìm kiếm)
    const input = this.searchInput;
    this.searchInput = null;
    input?.remove();
    this.drag?.ghost.destroy();
    this.opts.hotbar?.highlight(-1);
    this.caretTween?.remove();
    this.tip?.destroy();
  }
}
