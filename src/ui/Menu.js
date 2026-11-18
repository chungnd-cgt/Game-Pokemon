import Phaser from 'phaser';
import { ITEMS } from '../data/items.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { COLORS, GENDER, closeButton, cssColor, drawHpBar, drawPanel, fitText, fixToCamera, hpLabel, localX, monTag, shade, textStyle, uiX } from './helpers.js';
import { directionOf, isCancel, isConfirm } from './input.js';
import { withShinyMark } from './shinyMark.js';

function drawButtonTray(scene, x, y, w, h) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(x + 3, y + 6, w, h, 18);
  g.fillStyle(0x27304a);
  g.fillRoundedRect(x, y, w, h, 18);
  g.lineStyle(3, 0x4a5878);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 14);
  return g;
}

// Menu chọn bằng phím mũi tên + Enter, hoặc bằng chuột. open() trả về value của mục
// được chọn, hoặc null nếu huỷ.
//  variant 'list'    : danh sách trong khung trắng (mục có `mon` hiển thị như thẻ Pokémon)
//  variant 'buttons' : nút màu kiểu Gen 5 (mục cần `color`, có thể có `sub`)
//  titleRight        : chữ phụ canh phải trên dòng tiêu đề (vd số tiền)
//  visibleRows       : danh sách dài thì chỉ hiện từng ấy hàng và cuộn theo mục đang chọn (cần rowHeight)
//  onKey(e, item)    : phím riêng cho mục đang chọn (vd: túi đồ bấm 1-6 để gán phím tắt), trả về true nếu đã xử lý
//  inside(pointer)   : bấm chuột ở vùng này (ngoài khung) không đóng menu
//  onHover(item, i)  : chuột rê vào một mục (item = null khi rê ra ngoài), vd hiện mô tả vật phẩm
//  Danh sách dài (visibleRows) cuộn được bằng con lăn chuột
//  drag              : kéo thả bằng chuột / cảm ứng (nhấn giữ một mục rồi kéo đi; nhấn rồi thả tại chỗ vẫn là chọn)
//    reorder: true          thả lên mục khác trong danh sách: open() trả về { reorder: [từ, tới] } (vd: đổi chỗ Pokémon);
//                           bàn phím: Shift + ↑ / ↓ đổi chỗ với mục kề bên
//    ghost: 'icon'          lúc kéo chỉ hiện icon của mục (vd: vật phẩm trong túi), không phải cả dòng
//    onMove(item, pointer)  đang kéo (vd: sáng ô phím tắt dưới con trỏ) • onDrop(item, pointer): thả ngoài danh sách,
//                           trả về true nếu đã xử lý (menu vẫn mở)
const DRAG_START = 10; // kéo xa hơn chừng này px mới tính là kéo thả
export class Menu {
  constructor(scene, router, opts) {
    const { x, y, width, height, title, onChange } = opts;
    // Danh sách rỗng thì hiện một dòng "Trống" (chọn = huỷ) thay vì lỗi
    const items = opts.items.length ? opts.items : [{ label: '(Trống)', value: null }];
    this.scene = scene;
    this.router = router;
    this.items = items;
    this.columns = opts.columns ?? 1;
    this.cancelable = opts.cancelable ?? true;
    this.onChange = onChange;
    this.onKey = opts.onKey ?? null;
    this.variant = opts.variant ?? 'list';
    this.bounds = new Phaser.Geom.Rectangle(x, y, width, height);
    this.container = scene.add.container(0, 0).setDepth(opts.depth ?? 20);

    const buttons = this.variant === 'buttons';
    const pad = buttons ? 14 : 18;
    const gap = buttons ? 12 : 6;
    this.container.add(buttons ? drawButtonTray(scene, x, y, width, height) : drawPanel(scene, x, y, width, height));

    let top = y + pad;
    if (title) {
      this.container.add(scene.add.text(x + 30, top + 2, title, textStyle(26, '#3a4660', { fontStyle: 'bold' })));
      // Menu đóng được thì có nút ✕ ở góc tiêu đề
      const closable = this.cancelable && !buttons;
      if (closable) this.container.add(closeButton(scene, x + width - 32, top + 18, () => this.finish(null)));
      // Chữ phụ canh phải trên dòng tiêu đề (vd "Tiền: 1.000₽" ở bảng Đội hình)
      if (opts.titleRight) {
        this.container.add(scene.add.text(x + width - (closable ? 64 : 30), top + 18, opts.titleRight, textStyle(20, '#6a7286', { fontStyle: 'bold' })).setOrigin(1, 0.5));
      }
      top += 46;
    }
    const rows = Math.ceil(items.length / this.columns);
    const cellW = (width - pad * 2 - gap * (this.columns - 1)) / this.columns;
    const cellH = opts.rowHeight ?? (y + height - pad - top - gap * (rows - 1)) / rows;
    this.visibleRows = opts.visibleRows && rows > opts.visibleRows ? opts.visibleRows : rows;
    this.scroll = 0;
    this.rowY = (row) => top + (row - this.scroll) * (cellH + gap) + cellH / 2;

    this.cells = items.map((item, i) => {
      const col = i % this.columns;
      const row = Math.floor(i / this.columns);
      const cell = scene.add.container(x + pad + col * (cellW + gap) + cellW / 2, this.rowY(row));
      const bg = scene.add.graphics();
      cell.add(bg);
      this.renderContent(cell, item, cellW, cellH);
      const hit = scene.add.zone(0, 0, cellW, cellH).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        if (this.dragging) return;
        this.select(i);
        this.onHover?.(item, i);
      });
      hit.on('pointerout', () => !this.dragging && this.onHover?.(null, i));
      hit.on('pointerdown', (p) => {
        this.select(i);
        // Kéo được: đợi thả tay mới biết là chọn hay kéo
        if (this.drag) this.press = { i, x: p.x, y: p.y };
        else this.confirm();
      });
      cell.add(hit);
      this.container.add(cell);
      return { cell, bg, hit, row, w: cellW, h: cellH };
    });

    // Mũi tên cuộn (bấm vào để cuộn) khi danh sách dài hơn khung
    if (this.visibleRows < rows) {
      const arrow = (label, ay, dir) => {
        const t = scene.add.text(x + width - 64, ay, label, textStyle(18, '#7a88a8')).setOrigin(0.5).setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => this.select(Phaser.Math.Clamp(this.index + dir * this.columns, 0, items.length - 1)));
        this.container.add(t);
        return t;
      };
      this.arrowUp = arrow('▲', top - 12, -1);
      this.arrowDown = arrow('▼', this.rowY(this.visibleRows) - cellH / 2 + 4, 1);
    }

    this.onHover = opts.onHover ?? null;
    this.lastRow = rows - 1;
    if (this.visibleRows < rows) {
      this.onWheel = (p, objs, dx, dy) => {
        if (this.bounds.contains(localX(this.scene, p), p.y) && dy) this.scrollBy(Math.sign(dy));
      };
      scene.input.on('wheel', this.onWheel);
    }
    this.drag = opts.drag ?? null;
    this.inside = opts.inside ?? null; // vùng ngoài khung vẫn tính là bấm trong menu (vd: cột phím tắt cạnh túi đồ)
    if (this.drag) {
      this.onPointerMove = (p) => this.dragMove(p);
      this.onPointerUp = (p) => this.dragEnd(p);
      scene.input.on('pointermove', this.onPointerMove);
      scene.input.on('pointerup', this.onPointerUp);
    }
    this.cells.forEach((_, i) => this.drawCell(i, false));
    this.index = -1;
    this.select(Phaser.Math.Clamp(opts.index ?? 0, 0, items.length - 1));
    // Trên bản đồ (cố định theo màn hình): dời vào giữa màn hình rộng
    if (opts.fixed) fixToCamera(this.container).setX(uiX(scene));
  }

  renderContent(cell, item, w, h) {
    const { scene } = this;
    if (this.variant === 'buttons') {
      const stroke = { stroke: item.disabled ? '#6a7078' : cssColor(shade(item.color, -55)), strokeThickness: 6 };
      cell.add(scene.add.text(0, item.sub ? -10 : 0, item.label, textStyle(28, '#ffffff', { fontStyle: 'bold', ...stroke })).setOrigin(0.5));
      if (item.sub) cell.add(scene.add.text(0, 20, item.sub, textStyle(17, '#ffffff', { ...stroke, strokeThickness: 4 })).setOrigin(0.5));
      return;
    }

    const left = -w / 2;
    if (item.mon) {
      const mon = item.mon;
      const key = pixelMon(scene, mon.speciesId, '', 28, mon.shiny);
      cell.add(scene.add.image(left + 44, 0, key).setScale(fitScale(scene, key, 56)).setAlpha(mon.hp > 0 ? 1 : 0.45));
      if (mon.heldItem) cell.add(scene.add.image(left + 64, h / 2 - 14, ITEMS[mon.heldItem].icon).setScale(fitScale(scene, ITEMS[mon.heldItem].icon, 22)));
      // Pokémon shiny: chữ "S" vàng trước tên
      const sx = withShinyMark(scene, (o) => cell.add(o), mon, left + 86, -h / 2 + 8, 24);
      const barX = w / 2 - 250;
      const name = scene.add.text(sx, -h / 2 + 8, mon.name, textStyle(24, COLORS.text, { fontStyle: 'bold' }));
      cell.add(name);
      const gender = mon.gender ? scene.add.text(0, name.y + 2, GENDER[mon.gender].symbol, textStyle(20, GENDER[mon.gender].color, { fontStyle: 'bold' })) : null;
      // Biệt danh dài: thu nhỏ / cắt bớt để tên + giới tính không đè lên thanh HP
      fitText(name, barX - 14 - sx - (gender ? gender.width + 6 : 0), 0.8);
      if (gender) cell.add(gender.setX(name.x + name.displayWidth + 6));
      const tag = item.tag ? `   ${item.tag}` : '';
      const lv = scene.add.text(left + 86, h / 2 - 28, `Lv${mon.level}${tag}`, textStyle(18, item.tagColor ?? '#6a7286'));
      cell.add(lv);
      // Nhãn trạng thái xấu (Pokémon đã gục không có nhãn, chỉ mờ đi)
      const badge = monTag(scene, lv.x + lv.width + 10, lv.y + 1, mon, 13);
      if (badge) cell.add(badge);
      const g = scene.add.graphics();
      drawHpBar(g, barX, -16, 230, mon.hp / mon.maxHp);
      cell.add([g, hpLabel(scene, barX, -16)]);
      cell.add(scene.add.text(w / 2 - 22, 9, `${mon.hp}/${mon.maxHp}`, textStyle(18, '#4a5266')).setOrigin(1, 0));
      return;
    }
    let textX = left + 44;
    if (item.icon) {
      cell.add(scene.add.image(left + 58, 0, item.icon).setScale(fitScale(scene, item.icon, Math.min(40, h - 8))).setAlpha(item.disabled ? 0.5 : 1));
      textX = left + 88;
    }
    cell.add(scene.add.text(textX, 0, item.label, textStyle(item.fontSize ?? 26, item.disabled ? '#a0a6b0' : COLORS.text)).setOrigin(0, 0.5));
    if (item.sub) cell.add(scene.add.text(w / 2 - 18, 0, item.sub, textStyle(22, '#6a7286')).setOrigin(1, 0.5));
  }

  drawCell(i, selected) {
    const { bg, cell, w, h } = this.cells[i];
    const item = this.items[i];
    bg.clear();
    if (this.variant === 'buttons') {
      const base = item.disabled ? 0x9aa0a8 : item.color;
      bg.fillStyle(shade(base, -40));
      bg.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 16);
      bg.fillStyle(base);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
      bg.fillStyle(0xffffff, 0.25);
      bg.fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, h * 0.4, 10);
      if (selected) {
        bg.lineStyle(4, 0xffffff);
        bg.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 9, 17);
      }
      cell.setScale(selected ? 1.05 : 1);
      return;
    }
    if (selected) {
      bg.fillStyle(0xdbe8ff);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(2, 0x7aa0e0);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.fillStyle(0xe04848);
      bg.fillTriangle(-w / 2 + 12, -9, -w / 2 + 12, 9, -w / 2 + 26, 0);
    }
  }

  open() {
    // Bỏ qua lần bấm phím / chuột đã mở ra menu này, chỉ xét các lần bấm sau
    const openedAt = performance.now();
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set(
        (e) => e.timeStamp >= openedAt && this.handleKey(e),
        (p) => {
          if (p.downTime < openedAt) return;
          const inside = this.bounds.contains(localX(this.scene, p), p.y) || this.inside?.(p);
          if (this.cancelable && (p.rightButtonDown() || !inside)) this.finish(null);
        },
      );
    });
  }

  select(i) {
    if (i === this.index) return;
    if (this.index >= 0) this.drawCell(this.index, false);
    this.index = i;
    this.scrollTo(Math.floor(i / this.columns));
    this.drawCell(i, true);
    this.onChange?.(this.items[i], i);
  }

  // Cuộn để hàng row nằm trong khung, chỉ hiện các hàng trong khung
  scrollTo(row) {
    const n = this.visibleRows;
    if (row < this.scroll) this.scroll = row;
    else if (row >= this.scroll + n) this.scroll = row - n + 1;
    this.applyScroll();
  }

  // Con lăn chuột: cuộn khung nhìn rows hàng (không đổi mục đang chọn)
  scrollBy(rows) {
    const max = Math.max(0, this.lastRow - this.visibleRows + 1);
    const next = Phaser.Math.Clamp(this.scroll + rows, 0, max);
    if (next === this.scroll) return;
    this.scroll = next;
    this.applyScroll();
  }

  applyScroll() {
    const n = this.visibleRows;
    for (const c of this.cells) {
      const show = c.row >= this.scroll && c.row < this.scroll + n;
      c.cell.setVisible(show).setY(this.rowY(c.row));
      if (c.hit.input) c.hit.input.enabled = show;
    }
    const lastRow = this.cells[this.cells.length - 1]?.row ?? 0;
    this.arrowUp?.setAlpha(this.scroll > 0 ? 1 : 0.25);
    this.arrowDown?.setAlpha(this.scroll + n <= lastRow ? 1 : 0.25);
  }

  handleKey(e) {
    if (this.onKey?.(e, this.items[this.index])) return;
    const i = this.index;
    const c = this.columns;
    const n = this.items.length;
    const dir = directionOf(e);
    // Đổi chỗ bằng bàn phím (như kéo thả): Shift + ↑ / ↓ đổi mục đang chọn với mục kề trên / dưới
    if (this.drag?.reorder && e.shiftKey && (dir === 'up' || dir === 'down') && !this.dragging) {
      const j = i + (dir === 'up' ? -c : c);
      if (j >= 0 && j < n) this.finish({ reorder: [i, j] });
      return;
    }
    switch (dir) {
      case 'left': if (i % c > 0) this.select(i - 1); return;
      case 'right': if (i % c < c - 1 && i + 1 < n) this.select(i + 1); return;
      case 'up': if (i - c >= 0) this.select(i - c); return;
      case 'down': if (i + c < n) this.select(i + c); return;
    }
    if (isConfirm(e)) this.confirm();
    else if (isCancel(e) && this.cancelable) this.finish(null);
  }

  // Ô bị khoá có lời nhắn (blocked, vd chiêu hết PP): vẫn bấm được, menu trả về { blocked } để báo lý do rồi mở lại
  confirm() {
    const item = this.items[this.index];
    if (item.blocked) this.finish({ blocked: item.blocked });
    else if (!item.disabled) this.finish(item.value);
  }

  // Mục (trong số đang hiện) nằm dưới điểm (x, y) trên màn hình, hoặc -1
  cellAt(x, y) {
    return this.cells.findIndex((c) => c.cell.visible && Math.abs(x - c.cell.x) <= c.w / 2 && Math.abs(y - c.cell.y) <= c.h / 2);
  }

  dragMove(p) {
    if (!this.press || !p.isDown) return;
    const { i } = this.press;
    if (!this.dragging) {
      if (Math.hypot(p.x - this.press.x, p.y - this.press.y) < DRAG_START) return;
      // Bắt đầu kéo: mục được kéo mờ đi, một bản sao nổi theo con trỏ
      this.dragging = true;
      this.onHover?.(null, i);
      const { w, h } = this.cells[i];
      const iconOnly = this.drag.ghost === 'icon' && this.items[i].icon;
      if (iconOnly) {
        const icon = this.items[i].icon;
        const ghost = this.scene.add.container(p.x, p.y).setDepth(this.container.depth + 5);
        const shadow = this.scene.add.ellipse(2, 20, 34, 10, 0x000000, 0.25);
        ghost.add([shadow, this.scene.add.image(0, 0, icon).setScale(fitScale(this.scene, icon, 44))]);
        this.ghost = fixToCamera(ghost);
        this.cells[i].cell.setAlpha(0.35);
        this.ghost.setPosition(p.x, p.y);
        this.drag.onMove?.(this.items[i], p);
        return;
      }
      const ghost = this.scene.add.container(p.x, p.y).setDepth(this.container.depth + 5).setAlpha(0.92);
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x000000, 0.2);
      bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 10);
      bg.fillStyle(0xffffff);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(3, 0x2f7de1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      ghost.add(bg);
      this.renderContent(ghost, this.items[i], w, h);
      this.ghost = fixToCamera(ghost);
      this.cells[i].cell.setAlpha(0.35);
    }
    this.ghost.setPosition(p.x, p.y);
    // Thả lên mục khác trong danh sách: mục đó sáng lên báo chỗ đổi
    const target = this.drag.reorder ? this.cellAt(localX(this.scene, p), p.y) : -1;
    if (target !== this.dropTarget) {
      if (this.dropTarget >= 0) this.drawCell(this.dropTarget, this.dropTarget === this.index);
      this.dropTarget = target;
      if (target >= 0 && target !== i) this.drawDropTarget(target);
    }
    this.drag.onMove?.(this.items[i], p);
  }

  dragEnd(p) {
    const press = this.press;
    this.press = null;
    if (!press || this.done) return;
    if (!this.dragging) {
      // Nhấn rồi thả trên đúng mục đó: chọn như bấm Enter
      if (this.cellAt(localX(this.scene, p), p.y) === press.i) this.confirm();
      return;
    }
    this.dragging = false;
    this.ghost?.destroy();
    this.ghost = null;
    this.cells[press.i].cell.setAlpha(1);
    const target = this.dropTarget ?? -1;
    this.dropTarget = -1;
    if (target >= 0) this.drawCell(target, target === this.index);
    if (this.drag.reorder && target >= 0) {
      if (target !== press.i) this.finish({ reorder: [press.i, target] });
      return;
    }
    if (target < 0) this.drag.onDrop?.(this.items[press.i], p);
  }

  // Mục sắp bị đổi chỗ khi thả: viền xanh nét đậm
  drawDropTarget(i) {
    const { bg, w, h } = this.cells[i];
    bg.clear();
    bg.fillStyle(0xe4f0ff);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.lineStyle(3, 0x2f7de1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  }

  finish(value) {
    if (this.done) return;
    this.done = true;
    this.router.clear();
    if (this.onWheel) this.scene.input.off('wheel', this.onWheel);
    if (this.drag) {
      this.scene.input.off('pointermove', this.onPointerMove);
      this.scene.input.off('pointerup', this.onPointerUp);
      this.ghost?.destroy();
    }
    this.container.destroy();
    this.resolve?.(value);
  }
}
