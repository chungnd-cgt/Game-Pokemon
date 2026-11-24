import Phaser from 'phaser';
import { BAG_POCKETS, ITEMS } from '../data/items.js';
import { itemCount } from '../game/state.js';
import { fitScale } from '../gfx/textures.js';
import { ItemTip } from './BagParts.js';
import { bagItems, pocketCounts, searchKey } from './bagSearch.js';
import { closeButton, fitText, fixToCamera, followCenter, localX, localY, textStyle, uiX } from './helpers.js';
import { FloatWindow } from './Windows.js';
import { directionOf, isCancel, isConfirm } from './input.js';

// Màu khung túi đồ (tối, cùng tông thanh phím tắt / khung mô tả vật phẩm)
const C = {
  outer: 0x10151f, // khung ngoài bao cả dải tab lẫn khung vật phẩm
  body: 0x1b2338,
  edge: 0x3d4c72,
  tab: 0x1a2135,
  tabHover: 0x26304a,
  cell: 0x253050,
  cellHover: 0x2e3b60,
  cellOn: 0x36518c,
  gold: 0xffd860,
  field: 0x0e1322,
};
const TAB_W = 66; // dải tab dọc bên trái
const OUT = 8; // lề khung ngoài
const TAB_H = 66;
const HEAD_H = 96; // tiêu đề + ô tìm kiếm
const FOOT_H = 12; // lề dưới lưới vật phẩm
const CELL_H = 58;
const GAP = 6;
const PAD = 14;
const DRAG_START = 10;
const MAX_QUERY = 20;
const DESC_H = 84; // ô mô tả trong khung (tipSide 'inside')

// Ô mô tả vật phẩm nằm trong khung túi, dưới lưới (dùng khi bên cạnh túi không còn chỗ, vd trong trận).
// Cùng cách gọi với BagParts.ItemTip: show(id) / hide() / destroy()
class InlineTip {
  constructor(scene, parent, x, y, w) {
    this.container = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(C.field);
    g.fillRoundedRect(x, y, w, DESC_H - 8, 12);
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

// Túi đồ dạng khung bên phải màn hình: dải tab ngăn túi dọc bên TRÁI, đầu khung có tên ngăn + ô tìm kiếm (phím gõ ra chữ
// là tìm, không phân biệt dấu; Backspace xoá, Esc / phím quay lại xoá chữ rồi đóng túi), vật phẩm xếp lưới 2 cột (icon,
// tên, ×số lượng) cuộn bằng con lăn chuột / phím hướng. Phím hướng / xác nhận / quay lại theo Cài đặt → Điều khiển, trừ
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
    // Khung vật phẩm nằm trong khung ngoài, bên phải dải tab
    this.body = { x: x + OUT + TAB_W - 2, y: y + OUT, w: width - OUT * 2 - TAB_W + 2, h: height - OUT * 2 };
    this.grid = {
      x: this.body.x + PAD,
      y: this.body.y + HEAD_H,
      w: this.body.w - PAD * 2 - 10, // chừa thanh cuộn bên phải
      h: this.body.h - HEAD_H - FOOT_H - (opts.tipSide === 'inside' ? DESC_H : 0),
    };
    this.cellW = (this.grid.w - GAP) / 2;
    this.visibleRows = Math.max(1, Math.floor((this.grid.h + GAP) / (CELL_H + GAP)));
    if (opts.windows) {
      // Cửa sổ nổi: kéo bằng dải tiêu đề của khung vật phẩm (trừ nút ✕)
      this.win = new FloatWindow(opts.windows, {
        id: 'bag', rect: { x, y, w: width, h: height }, dragRect: { x: this.body.x, y, w: this.body.w - 56, h: OUT + 46 },
        onKey: (e) => this.handleKey(e), onClose: () => this.cleanup(),
      });
      this.container = this.win.root;
      opts.fixed = true;
    } else this.container = scene.add.container(0, 0).setDepth(this.depth);
    this.tabLayer = scene.add.container(0, 0);
    this.headLayer = scene.add.container(0, 0);
    this.gridLayer = scene.add.container(0, 0);
    this.drawFrame();
    this.container.add([this.tabLayer, this.headLayer, this.gridLayer]);
    if (opts.tipSide === 'inside') {
      this.tip = new InlineTip(scene, this.container, this.body.x + PAD, this.body.y + this.body.h - FOOT_H - DESC_H + 4, this.body.w - PAD * 2);
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
    // khung ngoài: bóng đổ, nền tối, viền
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(rect.x + 4, rect.y + 6, rect.width, rect.height, 20);
    g.fillStyle(C.outer);
    g.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 20);
    g.lineStyle(2, C.edge);
    g.strokeRoundedRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2, 19);
    g.fillStyle(C.body);
    g.fillRoundedRect(body.x, body.y, body.w, body.h, 18);
    g.lineStyle(2, C.edge);
    g.strokeRoundedRect(body.x + 1, body.y + 1, body.w - 2, body.h - 2, 17);
    this.container.add(g);
    // Nút ✕ đóng túi
    this.container.add(closeButton(scene, body.x + body.w - 28, body.y + 26, () => this.close(), 28));
  }

  // Dải tab dọc bên trái: icon + tên ngăn, ngăn đang mở nối liền với khung, có vạch vàng; ngăn trống mờ đi
  drawTabs() {
    const { scene } = this;
    this.tabLayer.removeAll(true);
    const counts = pocketCounts({ count: this.count, allow: this.opts.allow, pockets: this.pockets });
    const searching = Boolean(searchKey(this.query));
    this.pockets.forEach((pocket, i) => {
      const on = i === this.pocket && !searching;
      const tx = this.rect.x + OUT;
      const ty = this.body.y + 12 + i * (TAB_H + 4);
      const g = scene.add.graphics();
      const draw = (hover) => {
        g.clear();
        g.fillStyle(on ? C.body : hover ? C.tabHover : C.tab);
        g.fillRoundedRect(tx, ty, TAB_W, TAB_H, { tl: 14, bl: 14, tr: 0, br: 0 });
        g.lineStyle(2, on ? C.edge : 0x2a3552);
        g.strokeRoundedRect(tx + 1, ty + 1, TAB_W, TAB_H - 2, { tl: 13, bl: 13, tr: 0, br: 0 });
        if (on) {
          // che viền khung chỗ tab nối vào, vạch vàng đánh dấu
          g.fillStyle(C.body);
          g.fillRect(tx + TAB_W - 8, ty + 3, 12, TAB_H - 6);
          g.fillStyle(C.gold);
          g.fillRoundedRect(tx + 5, ty + 12, 4, TAB_H - 24, 2);
        }
      };
      draw(false);
      const icon = ITEMS[pocket.item].icon;
      const dim = counts[i] === 0 ? 0.4 : 1;
      const img = scene.add.image(tx + TAB_W / 2 + 2, ty + 25, icon).setScale(fitScale(scene, icon, on ? 32 : 28)).setAlpha((on ? 1 : 0.8) * dim);
      const label = scene.add.text(tx + TAB_W / 2 + 2, ty + 46, pocket.name, textStyle(11, on ? '#ffd860' : '#aab4d0', { fontStyle: 'bold' }))
        .setOrigin(0.5, 0).setAlpha(dim);
      if (label.width > TAB_W - 8) label.setScale((TAB_W - 8) / label.width);
      const zone = scene.add.zone(tx + TAB_W / 2, ty + TAB_H / 2, TAB_W, TAB_H).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => !on && draw(true));
      zone.on('pointerout', () => draw(false));
      // đổi ngăn ở khung hình sau: không xoá tab đang nhận sự kiện chuột
      zone.on('pointerdown', () => scene.time.delayedCall(0, () => !this.done && this.setPocket(i)));
      this.tabLayer.add([g, img, label, zone]);
    });
    if (this.opts.fixed) fixToCamera(this.tabLayer);
  }

  // Tiêu đề (tên ngăn / "Tìm kiếm"), ô tìm kiếm có kính lúp và con trỏ nhấp nháy
  drawHead() {
    const { scene, body } = this;
    this.headLayer.removeAll(true);
    this.caretTween?.remove();
    const searching = Boolean(searchKey(this.query));
    const name = this.opts.title ?? (searching ? 'Tìm kiếm' : this.pockets[this.pocket].name);
    this.headLayer.add(scene.add.text(body.x + PAD + 4, body.y + 12, name, textStyle(23, '#ffffff', { fontStyle: 'bold' })));

    const fx = body.x + PAD;
    const fy = body.y + 50;
    const fw = body.w - PAD * 2;
    const g = scene.add.graphics();
    g.fillStyle(C.field);
    g.fillRoundedRect(fx, fy, fw, 34, 17);
    g.lineStyle(2, this.query ? C.gold : 0x34405e);
    g.strokeRoundedRect(fx, fy, fw, 34, 17);
    // kính lúp
    g.lineStyle(2.5, this.query ? C.gold : 0x8a96b8);
    g.strokeCircle(fx + 20, fy + 15, 6.5);
    g.lineBetween(fx + 25, fy + 20, fx + 30, fy + 25);
    this.headLayer.add(g);
    const shown = this.query || 'Tìm vật phẩm';
    const text = scene.add.text(fx + 40, fy + 17, shown, textStyle(16, this.query ? '#ffffff' : '#6a7698')).setOrigin(0, 0.5);
    this.headLayer.add(text);
    // Mở túi không tự vào ô tìm kiếm: bấm / chạm vào ô mới gõ được (ô nhập HTML để điện thoại hiện bàn phím)
    const field = scene.add.zone(fx, fy, fw - 36, 34).setOrigin(0).setInteractive({ useHandCursor: true });
    field.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      scene.time.delayedCall(0, () => !this.done && this.focusSearch({ x: fx, y: fy, w: fw }));
    });
    this.headLayer.add(field);
    if (this.searchInput) {
      const caret = scene.add.rectangle(this.query ? text.x + text.width + 2 : text.x - 3, fy + 17, 2, 18, C.gold);
      this.headLayer.add(caret);
      this.caretTween = scene.tweens.add({ targets: caret, alpha: 0, duration: 450, yoyo: true, repeat: -1, ease: 'Stepped' });
    }
    if (this.query) {
      // nút xoá chữ tìm
      const clear = scene.add.text(fx + fw - 18, fy + 17, '✕', textStyle(15, '#8a96b8', { fontStyle: 'bold' })).setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      clear.on('pointerdown', () => scene.time.delayedCall(0, () => !this.done && this.setQuery('')));
      this.headLayer.add(clear);
    }

    if (this.opts.fixed) fixToCamera(this.headLayer);
  }

  // Lưới vật phẩm 2 cột; chỉ các hàng trong khung được hiện (cuộn)
  drawGrid() {
    const { scene } = this;
    this.gridLayer.removeAll(true);
    this.cells = [];
    if (!this.list.length) {
      const msg = searchKey(this.query) ? `Không tìm thấy "${this.query}"` : 'Ngăn này chưa có gì';
      this.gridLayer.add(scene.add.text(this.grid.x + this.grid.w / 2, this.grid.y + 60, msg, textStyle(17, '#8a96b8')).setOrigin(0.5));
      this.scrollBar = null;
      if (this.opts.fixed) fixToCamera(this.gridLayer);
      return;
    }
    this.list.forEach((id, i) => {
      const item = ITEMS[id];
      const cell = scene.add.container(0, 0);
      const bg = scene.add.graphics();
      const w = this.cellW;
      const icon = scene.add.image(-w / 2 + 26, 0, item.icon).setScale(fitScale(scene, item.icon, 36));
      // Vật phẩm quan trọng không có dòng số lượng: tên nằm giữa ô
      const name = scene.add.text(-w / 2 + 52, item.kind === 'key' ? 0 : -10, item.name, textStyle(16, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5);
      // Tên dài quá ô thì thu nhỏ chữ (vẫn dài thì cắt bớt kèm "…")
      fitText(name, w - 52 - 10, 0.72);
      cell.add([bg, icon, name]);
      if (item.kind !== 'key') {
        cell.add(scene.add.text(-w / 2 + 52, 12, `×${this.count(id)}`, textStyle(14, '#a8b4d0', { fontStyle: 'bold' })).setOrigin(0, 0.5));
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
      this.cells.push({ cell, bg, zone, icon, row: Math.floor(i / 2), col: i % 2 });
    });
    this.scrollBar = scene.add.graphics();
    this.gridLayer.add(this.scrollBar);
    if (this.opts.fixed) fixToCamera(this.gridLayer);
  }

  drawCell(i) {
    const c = this.cells?.[i];
    if (!c) return;
    const w = this.cellW;
    const on = i === this.index && this.focused;
    const g = c.bg;
    g.clear();
    g.fillStyle(on ? C.cellOn : i === this.hover ? C.cellHover : C.cell);
    g.fillRoundedRect(-w / 2, -CELL_H / 2, w, CELL_H, 12);
    if (on) {
      g.lineStyle(2.5, C.gold);
      g.strokeRoundedRect(-w / 2 + 1, -CELL_H / 2 + 1, w - 2, CELL_H - 2, 11);
    }
    // ô tròn mờ sau icon
    g.fillStyle(0xffffff, on ? 0.16 : 0.08);
    g.fillCircle(-w / 2 + 26, 0, 21);
  }

  // Đặt vị trí các ô theo hàng đang cuộn, ẩn hàng ngoài khung, vẽ thanh cuộn
  layout() {
    if (!this.cells) return;
    const rows = Math.ceil(this.list.length / 2);
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
    const tx = this.grid.x + this.grid.w + 6;
    const th = this.visibleRows * (CELL_H + GAP) - GAP;
    g.fillStyle(0x0e1322);
    g.fillRoundedRect(tx, this.grid.y, 6, th, 3);
    const h = Math.max(24, (th * this.visibleRows) / rows);
    const top = this.grid.y + ((th - h) * this.scroll) / (rows - this.visibleRows);
    g.fillStyle(0x6a7aa8);
    g.fillRoundedRect(tx, top, 6, h, 3);
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
      const row = Math.floor(at / 2);
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
    const row = Math.floor(i / 2);
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
    this.tip.showBelow(id, c.cell.x - this.cellW / 2, c.cell.y + CELL_H / 2 + 4, this.cellW, c.cell.y - CELL_H / 2 - 4);
  }

  scrollBy(rows) {
    const max = Math.max(0, Math.ceil(this.list.length / 2) - this.visibleRows);
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
    input.type = 'search';
    input.value = this.query;
    input.maxLength = MAX_QUERY;
    input.placeholder = 'Tìm vật phẩm';
    input.autocomplete = 'off';
    const place = () => {
      const r = scene.game.canvas.getBoundingClientRect();
      const k = r.width / scene.scale.width;
      Object.assign(input.style, {
        position: 'fixed', left: `${r.left + (uiX(scene) + (this.win?.ox ?? 0) + field.x + 36) * k}px`, top: `${r.top + ((this.win?.oy ?? 0) + field.y) * k}px`,
        width: `${(field.w - 72) * k}px`, height: `${34 * k}px`, fontSize: `${16 * k}px`, zIndex: 30, boxSizing: 'border-box',
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
    const { scene } = this;
    this.listen();
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set(
        (e) => e.timeStamp >= openedAt && this.handleKey(e),
        (p) => {
          if (p.downTime < openedAt) return;
          if (p.rightButtonDown()) return this.finish(null);
          const at = this.pt(p);
          const inside = this.rect.contains(at.x, at.y) || this.opts.hotbar?.contains(p.x, p.y);
          if (!inside) this.finish(null);
        },
      );
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
    switch (dir) {
      case 'up':
        if (i - 2 >= 0) this.select(i - 2);
        return;
      case 'down':
        if (i + 2 < n) this.select(i + 2);
        else if (i % 2 === 0 && Math.floor(i / 2) < Math.floor((n - 1) / 2)) this.select(n - 1);
        return;
      case 'left':
        if (i % 2 === 1) this.select(i - 1);
        else if (!searching) this.setPocket(this.pocket - 1);
        return;
      case 'right':
        if (i % 2 === 0 && i + 1 < n) this.select(i + 1);
        else if (!searching) this.setPocket(this.pocket + 1);
        return;
    }
    if (confirm) {
      this.confirm();
      return;
    }
    // Esc luôn là nút thoát của ô tìm kiếm; phím quay lại (không phải phím gõ chữ) cũng vậy: có chữ thì xoá, không thì đóng
    if ((e.code === 'Escape' || (!typing && isCancel(e))) && !e.repeat) {
      if (this.query) this.setQuery('');
      else this.close();
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

  // Đóng túi (nút ✕, phím quay lại): cửa sổ nổi thì đóng cửa sổ, không thì kết thúc open() với null
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
    this.searchInput?.remove();
    this.searchInput = null;
    this.drag?.ghost.destroy();
    this.opts.hotbar?.highlight(-1);
    this.caretTween?.remove();
    this.tip?.destroy();
  }
}
