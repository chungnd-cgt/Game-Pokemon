import Phaser from 'phaser';
import { DEX } from '../../data/pokedex.js';
import { dexStatus, state } from '../../game/state.js';
import { DexDetail } from './DexDetail.js';
import { DexGrid, GRID_COLS, GRID_H, GRID_ROWS } from './DexGrid.js';
import { filterDex } from './dexData.js';
import { closeButton, fixToCamera, textStyle, uiX } from '../helpers.js';
import { directionOf, isCancel, isConfirm, isTyping } from '../input.js';
import { FloatWindow } from '../Windows.js';
import { DEX_COLORS as C, DEX_TEXT as T } from './theme.js';

// Pokédex dạng cửa sổ nổi trên bản đồ (ui/Windows.js): khung xanh đậm hơi trong suốt (thấy mờ bản đồ phía sau), kéo dải
// trên cùng để dời, mở song song với túi đồ / thẻ HLV...; nút / phím Pokédex bấm lần nữa thì đóng (WorldScene.openPokedex).
// Cột trái: "Ẩn chưa gặp", lưới Pokémon (cuộn), ô tìm kiếm, số đã bắt / đã gặp / đã tiến hoá, góc đỏ "Pokédex". Đường xanh
// ngọc chia đôi. Bên phải là thông tin loài đang chọn (ui/dex/DexDetail.js), góc phải trên có nút đóng trên nền đỏ.
// Mở / đóng như Pokédex trong phim: lật mở từ bản lề giữa (đường chia đôi) ra hai bên, đóng thì gập vào (flip).
// Chưa gặp: bóng đen, không có thông tin.
// Các phần lưới / chi tiết (DexGrid, DexDetail) dựng bằng scene thường: windowScene() gom mọi thứ chúng tạo vào cửa sổ,
// hình mặt nạ của vùng cuộn (make.graphics) ghim theo màn hình và đi theo cửa sổ khi kéo

const WIN = { x: 130, y: 100, w: 700, h: 500 };
const DRAG_H = 30; // dải trên cùng kéo được
const LEFT = { x: WIN.x + 14, y: WIN.y + 14, w: 214, h: WIN.h - 28 };
const DIVIDER_X = LEFT.x + LEFT.w + 8;
const RIGHT = { x: DIVIDER_X + 14, y: WIN.y + 12, w: WIN.x + WIN.w - 14 - (DIVIDER_X + 14), h: WIN.h - 24 };
const GRID_Y = LEFT.y + 26;
const SEARCH = { x: LEFT.x, y: GRID_Y + GRID_H + 8, w: LEFT.w, h: 26 };
const COUNTS_Y = SEARCH.y + SEARCH.h + 12; // 3 dòng số đếm dưới ô tìm kiếm
const CORNER = { w: 92, h: 34 }; // góc đỏ "Pokédex" dưới trái
const FLIP_STEP = 34; // ms: bước thời gian tối đa mỗi khung hình của hiệu ứng lật (flip)
const QUERY_MAX = 12;
const PAGE = GRID_COLS * GRID_ROWS;

// Tuỳ chọn "Ẩn chưa gặp" giữ nguyên giữa các lần mở trong một lần chơi
let hideUnseen = false;

// Scene "bọc": mọi đối tượng tạo bằng add.* tự vào root của cửa sổ (thành phần nào tự gom vào container riêng thì Phaser
// chuyển sang container đó); graphics tạo bằng make.* (hình mặt nạ) ghi vào masks
function windowScene(scene, root, masks) {
  const add = new Proxy(scene.add, {
    get(target, key) {
      const f = target[key];
      if (typeof f !== 'function') return f;
      return (...args) => {
        const o = f.apply(target, args);
        if (o && o !== root && o.setScrollFactor && !o.parentContainer) root.add(o);
        return o;
      };
    },
  });
  const make = new Proxy(scene.make, {
    get(target, key) {
      const f = target[key];
      if (typeof f !== 'function') return f;
      return (...args) => {
        const o = f.apply(target, args);
        if (key === 'graphics') masks.push(o);
        return o;
      };
    },
  });
  return new Proxy(scene, {
    get(target, key) {
      if (key === 'add') return add;
      if (key === 'make') return make;
      const v = target[key];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

export class DexWindow {
  // focusId: số Pokédex mở sẵn (vd bấm Pokémon ở bảng khu vực) hoặc null
  constructor(manager, focusId = null) {
    this.manager = manager;
    this.scene = manager.scene;
    this.query = '';
    this.searching = false;
    this.win = new FloatWindow(manager, {
      id: 'dex', rect: { ...WIN }, dragRect: { x: WIN.x, y: WIN.y, w: WIN.w - 60, h: DRAG_H },
      onKey: (e) => this.handleKey(e), onClose: () => this.cleanup(),
    });
    // Đang gõ ô tìm kiếm: bản đồ bỏ qua phím tắt (chữ / số dành cho ô tìm)
    Object.defineProperty(this.win, 'typing', { get: () => this.searching });
    const masks = [];
    const ws = windowScene(this.scene, this.win.root, masks);
    this.drawWindow(ws);
    // Mở từ bảng khu vực vào loài chưa gặp: bỏ lọc để thấy được ô đó
    if (focusId && hideUnseen && dexStatus(focusId) === 'unknown') hideUnseen = false;
    this.grid = new DexGrid(ws, LEFT.x, GRID_Y, (i) => this.select(i));
    this.grid.toLocal = (p) => this.win.local(p);
    this.detail = new DexDetail(ws, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h);
    this.createToolbar(ws);
    this.createSearch(ws);
    // Hình mặt nạ vùng cuộn: ghim theo màn hình, đi theo cửa sổ
    for (const m of masks) {
      m.setScrollFactor(0).setPosition(uiX(this.scene) + this.win.ox, this.win.oy);
      this.win.followers.push(m);
    }
    this.masks = masks;
    this.list = [];
    this.selectedId = focusId ?? DEX.find((p) => dexStatus(p.id) !== 'unknown')?.id ?? DEX[0].id;
    this.applyFilter(true);
    this.onWheel = (p, _over, _dx, dy) => this.handleWheel(p, dy);
    this.onDown = (p) => this.handlePointer(p);
    // Rê chuột trên "Nơi xuất hiện": tên nơi bị cắt thì hiện tên đầy đủ
    this.onMove = (p) => {
      if (this.manager.router.active || !this.over(p)) return this.detail.areaHover(-1, -1);
      const { x, y } = this.win.local(p);
      return this.detail.areaHover(x, y);
    };
    this.scene.input.on('wheel', this.onWheel);
    this.scene.input.on('pointerdown', this.onDown);
    this.scene.input.on('pointermove', this.onMove);
    this.caret = this.scene.time.addEvent({ delay: 500, loop: true, callback: () => this.drawSearch(!this.caretOn) });
    // Đóng (✕, phím, nút Pokédex, đóng hết): gập vào rồi mới đóng thật
    const close = this.win.close.bind(this.win);
    this.win.close = () => {
      if (this.closing) return;
      this.closing = true;
      this.flip(false, close);
    };
    manager.open(this.win);
    this.flip(true);
  }

  // Mở: lật mở quanh bản lề là đường chia đôi (co giãn bề ngang, bản lề đứng yên). Đóng: hai nửa gom vào chính giữa cửa sổ
  // như gập hộp Pokédex, mờ dần rồi tắt.
  // Tự chạy theo từng khung hình với bước thời gian tối đa FLIP_STEP ms: khung hình ngay sau lúc dựng Pokédex rất dài
  // (dựng cả trăm đối tượng), tween thường sẽ nhảy thẳng tới cuối nên không thấy hiệu ứng.
  // Hai hộp cuộn (mặt nạ ghim theo màn hình) ẩn trong lúc lật
  flip(open, done = null) {
    const root = this.win.root;
    const { scene } = this;
    this.flipStop?.();
    const baseX = root.x - DIVIDER_X * (1 - root.scaleX);
    const lists = [this.detail.moveList, this.detail.areaList];
    for (const l of lists) l.setVisible(false);
    const duration = open ? 460 : 380;
    const ease = open ? Phaser.Math.Easing.Back.Out : Phaser.Math.Easing.Sine.InOut;
    const cx = WIN.x + WIN.w / 2;
    const cy = WIN.y + WIN.h / 2;
    let t = 0;
    const apply = () => {
      if (open) {
        const k = Math.max(0.01, ease(t));
        root.scaleX = k;
        root.scaleY = 0.92 + 0.08 * Math.min(1, k);
        root.x = baseX + DIVIDER_X * (1 - k);
        root.alpha = Math.min(1, 0.2 + k);
      } else {
        const e = ease(t);
        root.scaleX = Math.max(0.01, 1 - e);
        root.scaleY = 1 - 0.3 * e;
        root.x = baseX + cx * (1 - root.scaleX);
        root.alpha = 1 - t * t;
      }
      root.y = this.win.oy + cy * (1 - root.scaleY);
    };
    const stop = () => {
      scene.events.off('update', step);
      scene.events.off('shutdown', stop);
      this.flipStop = null;
    };
    const step = (_time, delta) => {
      t = Math.min(1, t + Math.min(delta, FLIP_STEP) / duration);
      apply();
      if (t < 1) return;
      stop();
      if (!open) return done?.();
      root.setScale(1).setAlpha(1);
      root.setPosition(baseX, this.win.oy);
      this.detail.areaList.setVisible(true);
      this.detail.drawTabs();
    };
    apply();
    this.flipStop = stop;
    scene.events.on('update', step);
    scene.events.once('shutdown', stop);
  }

  cleanup() {
    this.scene.input.off('wheel', this.onWheel);
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.off('pointermove', this.onMove);
    this.caret?.remove();
    for (const m of this.masks) m.destroy();
  }

  // Mở sẵn loài focusId (cửa sổ đang mở mà bấm Pokémon khác ở bảng khu vực)
  focus(focusId) {
    if (focusId && hideUnseen && dexStatus(focusId) === 'unknown') {
      hideUnseen = false;
      this.drawCheck();
    }
    this.selectedId = focusId;
    this.applyFilter(true);
  }

  drawWindow(ws) {
    const g = ws.add.graphics();
    const { x, y, w, h } = WIN;
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x + 4, y + 6, w, h, 14);
    g.fillStyle(C.bg, C.bgAlpha);
    g.fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(2, C.edge, 0.9);
    g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 13);
    // Đường chia đôi xanh ngọc
    g.fillStyle(C.accent, 0.85);
    g.fillRect(DIVIDER_X - 1, y + 12, 2, h - 24);
    // Góc đỏ phải trên (nền nút đóng) và dưới trái (chữ Pokédex)
    const xr = x + w;
    const yb = y + h;
    g.fillStyle(C.red);
    g.fillRoundedRect(xr - 64, y, 64, 42, { tl: 0, tr: 14, bl: 22, br: 0 });
    g.fillRoundedRect(x, yb - CORNER.h, CORNER.w, CORNER.h, { tl: 0, tr: 22, bl: 14, br: 0 });
    g.fillStyle(C.redLight);
    g.fillRoundedRect(xr - 60, y + 3, 57, 18, { tl: 0, tr: 11, bl: 9, br: 0 });
    ws.add.text(x + CORNER.w / 2 - 4, yb - CORNER.h / 2, 'Pokédex', textStyle(15, '#ffffff', { fontStyle: 'bold', stroke: '#6a1014', strokeThickness: 3 }))
      .setOrigin(0.5);
    closeButton(ws, xr - 24, y + 20, () => this.win.close(), 24);
  }

  createToolbar(ws) {
    const y = LEFT.y + 8;
    this.check = ws.add.graphics();
    const label = ws.add.text(LEFT.x + 22, y, 'Ẩn chưa gặp', textStyle(13, T.main, { fontStyle: 'bold' })).setOrigin(0, 0.5);
    const hit = ws.add.zone(LEFT.x - 2, y - 11, label.x + label.width - LEFT.x + 4, 22).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.toggleHide());
    // Số đã bắt / đã gặp / đã tiến hoá (số lần Pokémon của mình tiến hoá): dưới ô tìm kiếm
    [['Đã bắt', state.dex.caught.size], ['Đã gặp', state.dex.seen.size], ['Đã tiến hoá', state.evolved ?? 0]].forEach(([k, v], i) => {
      const ry = COUNTS_Y + i * 16;
      ws.add.text(LEFT.x + 4, ry, k, textStyle(11, T.muted, { fontStyle: 'bold' })).setOrigin(0, 0.5);
      ws.add.text(LEFT.x + LEFT.w - 4, ry, String(v), textStyle(11, T.main, { fontStyle: 'bold' })).setOrigin(1, 0.5);
    });
    this.drawCheck();
  }

  drawCheck() {
    const g = this.check;
    const x = LEFT.x + 1;
    const y = LEFT.y + 1;
    g.clear();
    g.fillStyle(hideUnseen ? C.accent : C.panel, hideUnseen ? 1 : C.panelAlpha);
    g.fillRoundedRect(x, y, 14, 14, 3);
    g.lineStyle(1.5, hideUnseen ? 0x2a88c0 : C.accent);
    g.strokeRoundedRect(x, y, 14, 14, 3);
    if (hideUnseen) {
      g.lineStyle(2.5, 0xffffff);
      g.beginPath();
      g.moveTo(x + 3, y + 7);
      g.lineTo(x + 6, y + 10);
      g.lineTo(x + 11, y + 4);
      g.strokePath();
    }
  }

  createSearch(ws) {
    const { x, y, w, h } = SEARCH;
    this.searchBg = ws.add.graphics();
    this.searchText = ws.add.text(x + 28, y + h / 2, '', textStyle(13, T.main, { fontStyle: 'bold' })).setOrigin(0, 0.5);
    this.searchHint = ws.add.text(x + 28, y + h / 2, 'Tên hoặc số', textStyle(12, T.muted)).setOrigin(0, 0.5);
    this.searchClear = ws.add.text(x + w - 12, y + h / 2, '✕', textStyle(13, T.muted, { fontStyle: 'bold' })).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.searchClear.on('pointerdown', (_p, _x, _y, e) => {
      e?.stopPropagation();
      this.setQuery('');
    });
    this.emptyText = ws.add.text(LEFT.x + LEFT.w / 2, LEFT.y + 200, 'Không tìm thấy Pokémon nào.', textStyle(13, T.muted, { fontStyle: 'bold' }))
      .setOrigin(0.5).setVisible(false);
    this.drawSearch(true);
  }

  drawSearch(caretOn = true) {
    const { x, y, w, h } = SEARCH;
    this.caretOn = caretOn;
    const g = this.searchBg;
    if (!g?.active) return;
    g.clear();
    g.fillStyle(C.panel, this.searching ? 0.9 : C.panelAlpha);
    g.fillRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(1.5, this.searching ? 0x8ad8ff : C.accent);
    g.strokeRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(2, C.accent);
    g.strokeCircle(x + 13, y + h / 2 - 1, 5);
    g.lineBetween(x + 16.5, y + h / 2 + 2.5, x + 20, y + h / 2 + 6);
    this.searchText.setText(this.query);
    this.searchHint.setVisible(!this.query && !this.searching);
    this.searchClear.setVisible(Boolean(this.query));
    if (this.searching && caretOn) {
      const cx = this.searchText.x + this.searchText.width + 2;
      g.lineStyle(2, 0xeef3fb);
      g.lineBetween(cx, y + 7, cx, y + h - 7);
    }
  }

  // Lọc lại danh sách, giữ loài đang chọn nếu còn trong danh sách
  applyFilter(center = false) {
    this.list = filterDex(DEX, { hideUnseen, query: this.query }, dexStatus);
    this.grid.setList(this.list);
    let i = this.list.findIndex((p) => p.id === this.selectedId);
    if (i < 0 && this.list.length) i = 0;
    this.select(i, { center, force: true });
  }

  select(i, { center = false, force = false } = {}) {
    if (!this.list.length) {
      this.index = -1;
      this.grid.setSelected(-1);
      this.grid.render();
      this.detail.show(DEX.find((p) => p.id === this.selectedId) ?? DEX[0], 'unknown');
      this.emptyText.setVisible(true);
      fixToCamera(this.win.root);
      return;
    }
    this.emptyText.setVisible(false);
    const next = Phaser.Math.Clamp(i, 0, this.list.length - 1);
    if (next === this.index && !force) return;
    this.index = next;
    const p = this.list[next];
    this.selectedId = p.id;
    this.grid.setSelected(next);
    this.grid.reveal(next, center);
    this.grid.render();
    this.detail.show(p, dexStatus(p.id));
    // Phần vừa vẽ lại (thẻ, chú thích...) ghim theo màn hình: vùng bấm tính đúng chỗ khi camera bản đồ trôi
    fixToCamera(this.win.root);
  }

  toggleHide() {
    hideUnseen = !hideUnseen;
    this.drawCheck();
    this.applyFilter();
  }

  setQuery(q) {
    this.query = q.slice(0, QUERY_MAX);
    this.drawSearch(true);
    this.applyFilter(true);
  }

  setSearching(on) {
    this.searching = on;
    this.drawSearch(true);
  }

  // Cửa sổ Pokédex nằm trên cùng chỗ con trỏ
  over(p) {
    return [...this.manager.list].reverse().find((w) => w.contains(p)) === this.win;
  }

  // Bấm vào ô tìm kiếm thì gõ được, bấm chỗ khác (trong Pokédex) thì thôi
  handlePointer(p) {
    if (this.manager.router.active || !this.over(p)) {
      if (this.searching) this.setSearching(false);
      return;
    }
    const { x, y } = this.win.local(p);
    this.detail.areaHover(x, y); // chạm (điện thoại): hiện tên nơi đầy đủ
    this.setSearching(x >= SEARCH.x && x <= SEARCH.x + SEARCH.w && y >= SEARCH.y && y <= SEARCH.y + SEARCH.h);
  }

  handleWheel(p, dy) {
    if (this.manager.router.active || !this.over(p)) return;
    const { x, y } = this.win.local(p);
    if (this.detail.wheel(x, y, dy)) return;
    if (this.grid.contains(x, y)) this.grid.scrollTo(this.grid.top + Math.sign(dy));
  }

  // Phím Pokédex do bản đồ bật / tắt (WorldScene.openPokedex); Esc / phím quay lại không đóng (nút ✕)
  handleKey(e) {
    if (this.searching && this.searchKey(e)) return;
    const dir = directionOf(e);
    if (dir && !(this.searching && isTyping(e))) {
      const step = { up: -GRID_COLS, down: GRID_COLS, left: -1, right: 1 }[dir];
      this.select(this.index + step);
      return;
    }
    if (e.code === 'PageUp') this.select(this.index - PAGE);
    else if (e.code === 'PageDown') this.select(this.index + PAGE);
    else if (e.code === 'Home') this.select(0);
    else if (e.code === 'End') this.select(this.list.length - 1);
    else if (e.code === 'Tab') {
      e.preventDefault?.();
      this.detail.toggleTab();
    } else if ((e.code === 'KeyF' || e.key === '/') && !e.repeat) {
      e.preventDefault?.();
      this.setSearching(true);
    } else if (e.code === 'KeyH' && !e.repeat) this.toggleHide();
    else if (/^\d$/.test(e.key ?? '')) {
      // Gõ số: bắt đầu tìm theo số thứ tự
      this.setSearching(true);
      this.setQuery(e.key);
    }
  }

  // Đang gõ vào ô tìm kiếm: trả về true nếu phím đã được dùng
  searchKey(e) {
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter' || (!isTyping(e) && (isCancel(e) || isConfirm(e)))) {
      this.setSearching(false);
      return true;
    }
    if (e.code === 'Backspace') {
      this.setQuery(this.query.slice(0, -1));
      return true;
    }
    if (!isTyping(e)) return false;
    if (/[\p{L}\p{N} .'-]/u.test(e.key)) {
      e.preventDefault?.();
      this.setQuery(this.query + e.key);
      return true;
    }
    return true;
  }
}
