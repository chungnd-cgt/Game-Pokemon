import Phaser from 'phaser';
import { DEX } from '../data/pokedex.js';
import { dexStatus, state } from '../game/state.js';
import { DexDetail } from '../ui/dex/DexDetail.js';
import { DexGrid, GRID_COLS, GRID_ROWS } from '../ui/dex/DexGrid.js';
import { filterDex } from '../ui/dex/dexData.js';
import { BLEED, COLORS, backToWorld, centerStage, closeButton, gradientRect, hideWorldHud, textStyle } from '../ui/helpers.js';
import { InputRouter, directionOf, isCancel, isConfirm, isTyping } from '../ui/input.js';
import { matches } from '../game/keybinds.js';

// Khung cửa sổ (thế giới vẫn hiện mờ phía sau)
const WIN = { x: 28, y: 18, w: 904, h: 684 };
const HEADER_H = 48;
const LEFT = { x: WIN.x + 14, y: WIN.y + 60, w: 406, h: WIN.h - 74 };
const RIGHT = { x: LEFT.x + LEFT.w + 12, y: LEFT.y, w: WIN.w - 28 - LEFT.w - 12, h: LEFT.h };
const SEARCH = { x: LEFT.x + 12, y: LEFT.y + LEFT.h - 44, w: LEFT.w - 24, h: 34 };
const QUERY_MAX = 12;
const PAGE = GRID_COLS * GRID_ROWS;

// Tuỳ chọn "Ẩn chưa gặp" giữ nguyên giữa các lần mở trong một lần chơi
let hideUnseen = false;

// Pokédex dạng cửa sổ: trái là lưới Pokémon (cuộn, lọc, tìm), phải là thông tin loài đang chọn
// (hình, chiều cao / cân nặng, hệ, biểu đồ lục giác chỉ số gốc, mô tả, đặc tính, chiêu thức, khắc hệ, nơi xuất hiện).
// Chưa gặp: bóng đen, không có thông tin. Mở bằng scene.launch('Pokedex', { focus: số Pokédex | null }).
export default class PokedexScene extends Phaser.Scene {
  constructor() {
    super('Pokedex');
  }

  init(data) {
    this.focusId = data?.focus ?? null;
    this.query = '';
    this.searching = false;
  }

  create() {
    hideWorldHud(this); // bản đồ phía sau chỉ còn làm nền
    centerStage(this); // màn hình rộng: khung 960x720 nằm giữa (toạ độ chuột: p.worldX)
    this.add.rectangle(-BLEED, 0, 960 + BLEED * 2, 720, 0x05070d, 0.55).setOrigin(0).setInteractive();
    this.drawWindow();

    // Mở từ bảng khu vực vào loài chưa gặp: bỏ lọc để thấy được ô đó
    if (this.focusId && hideUnseen && dexStatus(this.focusId) === 'unknown') hideUnseen = false;

    this.grid = new DexGrid(this, LEFT.x + 12, LEFT.y + 48, (i) => this.select(i));
    this.detail = new DexDetail(this, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h);
    this.createToolbar();
    this.createSearch();

    this.list = [];
    this.selectedId = this.focusId
      ?? DEX.find((p) => dexStatus(p.id) !== 'unknown')?.id
      ?? DEX[0].id;
    this.applyFilter(true);

    this.router = new InputRouter(this);
    this.router.set((e) => this.handleKey(e), (p) => this.handlePointer(p));
    this.input.on('wheel', (p, _over, _dx, dy) => this.handleWheel(p, dy));
    this.caret = this.time.addEvent({ delay: 500, loop: true, callback: () => this.drawSearch(!this.caretOn) });

  }

  drawWindow() {
    const g = this.add.graphics();
    const { x, y, w, h } = WIN;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x + 5, y + 8, w, h, 20);
    g.fillStyle(COLORS.ink);
    g.fillRoundedRect(x, y, w, h, 20);
    // Đầu cửa sổ màu đỏ Pokédex
    const header = this.add.graphics();
    gradientRect(header, x + 4, y + 4, w - 8, HEADER_H, 0xe04444, 0xa82028, 12);
    const mask = this.make.graphics({ x: 0, y: 0 }, false);
    mask.fillStyle(0xffffff);
    mask.fillRoundedRect(x + 4, y + 4, w - 8, HEADER_H, { tl: 16, tr: 16, bl: 0, br: 0 });
    header.setMask(mask.createGeometryMask());
    this.events.once('shutdown', () => mask.destroy());
    const body = this.add.graphics();
    body.fillStyle(0xdfe5ef);
    body.fillRoundedRect(x + 4, y + 4 + HEADER_H, w - 8, h - 8 - HEADER_H, { tl: 0, tr: 0, bl: 16, br: 16 });
    for (const pane of [LEFT, RIGHT]) {
      body.fillStyle(0x000000, 0.08);
      body.fillRoundedRect(pane.x + 2, pane.y + 3, pane.w, pane.h, 14);
      body.fillStyle(0xffffff);
      body.fillRoundedRect(pane.x, pane.y, pane.w, pane.h, 14);
    }

    // Biểu tượng ống kính + chữ
    const cy = y + 4 + HEADER_H / 2;
    const icon = this.add.graphics();
    icon.fillStyle(0xffffff);
    icon.fillCircle(x + 32, cy, 15);
    icon.fillStyle(0x3aa0e8);
    icon.fillCircle(x + 32, cy, 11);
    icon.fillStyle(0xffffff, 0.75);
    icon.fillCircle(x + 28, cy - 4, 4);
    this.add.text(x + 56, cy + 1, 'POKÉDEX', textStyle(24, '#ffffff', { fontStyle: 'bold', stroke: '#6a1014', strokeThickness: 5 })).setOrigin(0, 0.5);
    closeButton(this, x + w - 26, cy, () => this.close(), 30);
  }

  createToolbar() {
    const y = LEFT.y + 24;
    this.check = this.add.graphics();
    const label = this.add.text(LEFT.x + 42, y, 'Ẩn chưa gặp', textStyle(15, COLORS.text, { fontStyle: 'bold' })).setOrigin(0, 0.5);
    const hit = this.add.zone(LEFT.x + 14, y - 14, label.x + label.width - LEFT.x - 10, 28).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.toggleHide());
    this.counts = this.add.text(LEFT.x + LEFT.w - 16, y, '', textStyle(14, '#6a7286', { fontStyle: 'bold' })).setOrigin(1, 0.5);
    this.counts.setText(`Đã bắt: ${state.dex.caught.size}   Đã gặp: ${state.dex.seen.size}`);
    this.drawCheck();
  }

  drawCheck() {
    const g = this.check;
    const x = LEFT.x + 16;
    const y = LEFT.y + 15;
    g.clear();
    g.fillStyle(hideUnseen ? 0xe04848 : 0xffffff);
    g.fillRoundedRect(x, y, 18, 18, 4);
    g.lineStyle(2, hideUnseen ? 0xb02830 : 0x9aa4c0);
    g.strokeRoundedRect(x, y, 18, 18, 4);
    if (hideUnseen) {
      g.lineStyle(3, 0xffffff);
      g.beginPath();
      g.moveTo(x + 4, y + 9);
      g.lineTo(x + 8, y + 13);
      g.lineTo(x + 14, y + 5);
      g.strokePath();
    }
  }

  createSearch() {
    const { x, y, w, h } = SEARCH;
    this.searchBg = this.add.graphics();
    this.searchText = this.add.text(x + 36, y + h / 2, '', textStyle(16, COLORS.text, { fontStyle: 'bold' })).setOrigin(0, 0.5);
    this.searchHint = this.add.text(x + 36, y + h / 2, 'Tên hoặc số', textStyle(15, '#a0a8bc')).setOrigin(0, 0.5);
    this.searchClear = this.add.text(x + w - 14, y + h / 2, '✕', textStyle(16, '#8a92a6', { fontStyle: 'bold' })).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.searchClear.on('pointerdown', (_p, _x, _y, e) => {
      e?.stopPropagation();
      this.setQuery('');
    });
    this.drawSearch(true);
  }

  drawSearch(caretOn = true) {
    const { x, y, w, h } = SEARCH;
    this.caretOn = caretOn;
    const g = this.searchBg;
    g.clear();
    g.fillStyle(this.searching ? 0xffffff : 0xf3f6fb);
    g.fillRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(2, this.searching ? 0x3a7ae0 : 0xc8d4e8);
    g.strokeRoundedRect(x, y, w, h, h / 2);
    // kính lúp
    g.lineStyle(2.5, 0x8a92a6);
    g.strokeCircle(x + 18, y + h / 2 - 2, 6);
    g.lineBetween(x + 22, y + h / 2 + 2, x + 27, y + h / 2 + 7);
    this.searchText.setText(this.query);
    this.searchHint.setVisible(!this.query && !this.searching);
    this.searchClear.setVisible(Boolean(this.query));
    if (this.searching && caretOn) {
      const cx = this.searchText.x + this.searchText.width + 2;
      g.lineStyle(2, COLORS.text);
      g.lineBetween(cx, y + 9, cx, y + h - 9);
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
      this.showEmpty(true);
      return;
    }
    this.showEmpty(false);
    const next = Phaser.Math.Clamp(i, 0, this.list.length - 1);
    if (next === this.index && !force) return;
    this.index = next;
    const p = this.list[next];
    this.selectedId = p.id;
    this.grid.setSelected(next);
    this.grid.reveal(next, center);
    this.grid.render();
    this.detail.show(p, dexStatus(p.id));
  }

  showEmpty(empty) {
    if (!this.emptyText) {
      this.emptyText = this.add.text(LEFT.x + LEFT.w / 2, LEFT.y + 260, 'Không tìm thấy Pokémon nào.', textStyle(16, '#8a92a6', { fontStyle: 'bold' })).setOrigin(0.5);
    }
    this.emptyText.setVisible(empty);
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

  handlePointer(p) {
    const { x, y, w, h } = SEARCH;
    const inSearch = p.worldX >= x && p.worldX <= x + w && p.y >= y && p.y <= y + h;
    this.setSearching(inSearch);
  }

  handleWheel(p, dy) {
    if (this.detail.wheel(p.worldX, p.y, dy)) return;
    if (this.grid.contains(p.worldX, p.y)) this.grid.scrollTo(this.grid.top + Math.sign(dy));
  }

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
    } else if ((isCancel(e) || matches(e, 'dex')) && !e.repeat) this.close();
    else if ((e.code === 'KeyF' || e.key === '/') && !e.repeat) {
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
    // Esc / Enter luôn thoát ô tìm; phím xác nhận / quay lại đã gán (nếu không phải phím gõ chữ) cũng vậy
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter' || (!isTyping(e) && (isCancel(e) || isConfirm(e)))) {
      this.setSearching(false);
      return true;
    }
    if (e.code === 'Backspace') {
      this.setQuery(this.query.slice(0, -1));
      return true;
    }
    // Phím không gõ ra chữ (phím hướng, PgUp / PgDn, Tab...) vẫn dùng như bình thường
    if (!isTyping(e)) return false;
    if (/[\p{L}\p{N} .'-]/u.test(e.key)) {
      e.preventDefault?.();
      this.setQuery(this.query + e.key);
      return true;
    }
    return true;
  }

  close() {
    backToWorld(this);
  }
}
