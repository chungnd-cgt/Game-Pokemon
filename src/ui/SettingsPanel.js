import Phaser from 'phaser';
import { FPS_STOPS, SCREEN_SIZES, applyFpsLimit, applyScreenSize, fullscreen } from '../game/display.js';
import { setSetting, settings } from '../game/settings.js';
import { fixToCamera, textStyle } from './helpers.js';
import { directionOf, isCancel, isConfirm } from './input.js';
import { isTouchDevice, refreshTouchControls } from './TouchControls.js';

// Bảng Cài đặt kiểu game PC: cột thẻ bên trái (Đồ hoạ / Chung / Điều khiển), nội dung bên phải (nút chọn, ô tích, thanh
// trượt), đáy là Huỷ / Áp dụng / OK. Đổi gì cũng chỉ là nháp, bấm Áp dụng / OK mới có tác dụng; Huỷ, phím quay lại hoặc
// bấm ra ngoài khung là bỏ nháp.
//  Chuột / cảm ứng: bấm thẻ, bấm nút, kéo thanh trượt (hoặc bấm thẳng vào rãnh). Nút kích hoạt lúc THẢ tay (trình duyệt
//  chỉ cho bật toàn màn hình trong lúc người chơi vừa thả tay / bấm phím).
//  Bàn phím: ↑ / ↓ chọn dòng, ← / → đổi giá trị (dòng không có giá trị: sang cột thẻ), xác nhận để bật / tắt / bấm,
//  Tab đổi thẻ.
//  Nút mở màn hình khác (Bản đồ vùng, Đổi diện mạo, Phím tắt...) đóng bảng và trả về { action, state }: màn hình gọi lo
//  mở màn đó rồi mở lại bảng với state (giữ thẻ, dòng đang chọn và nháp chưa áp dụng).

const PX = 40;
const PY = 28;
const PW = 880;
const PH = 664;
const HEAD = 70;
const FOOT = 86;
const BODY_Y = PY + HEAD + 4;
const BODY_H = PH - HEAD - 4 - FOOT;
const SIDE_X = PX + 18;
const SIDE_W = 214;
const MAIN_X = SIDE_X + SIDE_W + 14;
const MAIN_W = PX + PW - 18 - MAIN_X;
const PAD = 26;
const FOOT_BTN = { w: 150, h: 58, gap: 12 };

const C = {
  frame: 0x17181c,
  panel: 0x2b2c31,
  headTop: 0x3c3e46,
  inset: 0x1b1c20,
  insetLine: 0x46484f,
  btn: 0x3b3d45,
  btnHi: 0x4a4c55,
  btnLine: 0x62656e,
  blue: 0x3a74d8,
  blueHi: 0x5a90ee,
  blueLine: 0x9cc0ff,
  focus: 0xffd860,
  text: '#e6e7eb',
  dim: '#8d909a',
  title: '#c3c6d0',
};

const ROW_H = { segment: 100, slider: 96, check: 60, button: 68, info: 34 };
const bold = (size, color = C.text, extra = {}) => textStyle(size, color, { fontStyle: 'bold', stroke: '#0c0d10', strokeThickness: 3, ...extra });
const pct = (v) => `${v}%`;

// Giá trị hiện tại của mọi mục (để so với nháp)
function currentValues() {
  return {
    display: fullscreen.active ? 'full' : 'window',
    screenSize: SCREEN_SIZES.includes(settings.screenSize) ? settings.screenSize : 'fit',
    fpsLimit: FPS_STOPS.includes(settings.fpsLimit) ? settings.fpsLimit : 0,
    lighting: settings.lighting !== false,
    weather: settings.weather !== false,
    catchPreview: settings.catchPreview !== false,
    touchControls: settings.touchControls ?? 'auto',
    touchSize: settings.touchSize ?? 100,
    touchOpacity: settings.touchOpacity ?? 70,
    vibrate: settings.vibrate !== false,
  };
}

// Các thẻ và dòng trong thẻ. opts: { hasMap, game }
function buildTabs(opts) {
  const fsNote = fullscreen.available ? null
    : isTouchDevice() ? 'Máy này không hỗ trợ. Mẹo: "Thêm vào Màn hình chính" để chơi toàn màn hình.' : 'Trình duyệt không hỗ trợ.';
  return [
    {
      id: 'graphics',
      label: 'Đồ hoạ',
      rows: [
        { type: 'segment', key: 'display', label: 'Chế độ hiển thị', note: fsNote, disabled: !fullscreen.available,
          options: [{ value: 'window', label: 'Cửa sổ' }, { value: 'full', label: 'Toàn màn hình' }] },
        { type: 'segment', key: 'screenSize', label: 'Kích thước khung hình',
          options: [{ value: 'fit', label: 'Vừa màn hình' }, { value: 'fill', label: 'Kéo giãn' }, { value: 'original', label: 'Gốc 960×720' }] },
        { type: 'slider', key: 'fpsLimit', label: 'Giới hạn FPS', stops: FPS_STOPS, format: (v) => (v ? `${v} FPS` : 'Theo màn hình') },
        { type: 'info', text: () => `Đang chạy: ${Math.round(opts.game?.loop?.actualFps ?? 0)} FPS  ·  30 FPS giúp đỡ tốn pin trên điện thoại` },
        { type: 'check', key: 'lighting', label: 'Ánh sáng ngày đêm' },
        { type: 'check', key: 'weather', label: 'Hiệu ứng thời tiết' },
      ],
    },
    {
      id: 'general',
      label: 'Chung',
      rows: [
        { type: 'check', key: 'catchPreview', label: 'Xem nhanh Pokémon gửi vào PC' },
        ...(opts.hasMap ? [{ type: 'button', label: 'Bản đồ vùng', action: 'map' }] : []),
        { type: 'button', label: 'Đổi diện mạo', action: 'look' },
      ],
    },
    {
      id: 'controls',
      label: 'Điều khiển',
      rows: [
        { type: 'segment', key: 'touchControls', label: 'Nút cảm ứng (phím hướng + A / B)',
          options: [{ value: 'auto', label: 'Tự động' }, { value: 'on', label: 'Bật' }, { value: 'off', label: 'Tắt' }] },
        { type: 'slider', key: 'touchSize', label: 'Cỡ nút cảm ứng', stops: [70, 80, 90, 100, 115, 130, 150], format: pct },
        { type: 'slider', key: 'touchOpacity', label: 'Độ đậm nút cảm ứng', stops: [30, 40, 50, 60, 70, 80, 90, 100], format: pct },
        { type: 'check', key: 'vibrate', label: 'Rung khi bấm nút cảm ứng' },
        { type: 'button', label: 'Phím tắt bàn phím', action: 'keys' },
      ],
    },
  ];
}

const focusable = (row) => row.type !== 'info' && !row.disabled;

export class SettingsPanel {
  // opts: { depth, hasMap, state (từ lần mở trước), onApplied(keys) }
  constructor(scene, router, opts = {}) {
    this.scene = scene;
    this.router = router;
    this.depth = opts.depth ?? 60;
    this.onApplied = opts.onApplied ?? (() => {});
    this.tabs = buildTabs({ ...opts, game: scene.game });
    const st = opts.state ?? {};
    this.tab = Phaser.Math.Clamp(st.tab ?? 0, 0, this.tabs.length - 1);
    this.area = st.area ?? 'side'; // 'side' (cột thẻ) | 'main' (nội dung + hàng nút đáy)
    this.row = st.row ?? 0;
    this.footCol = 2; // 0 Huỷ, 1 Áp dụng, 2 OK
    this.baseline = currentValues();
    this.draft = { ...this.baseline, ...(st.draft ?? {}) };
    this.bounds = new Phaser.Geom.Rectangle(PX, PY, PW, PH);
    this.pressed = null; // nút đang nhấn (kích hoạt lúc thả tay đúng trên nút đó)
    this.sliding = null; // thanh trượt đang kéo { row, x0, w }

    this.container = scene.add.container(0, 0).setDepth(this.depth);
    // Nền tối phủ cả màn hình (bấm vào = Huỷ, xử lý ở open)
    this.container.add(scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.45).setOrigin(0));
    this.container.add(this.drawFrame());
    this.dyn = scene.add.container(0, 0);
    this.container.add(this.dyn);
    this.render();
  }

  get rows() {
    return this.tabs[this.tab].rows;
  }

  get focusRows() {
    return this.rows.filter(focusable);
  }

  changedKeys() {
    return Object.keys(this.draft).filter((k) => this.draft[k] !== this.baseline[k]);
  }

  open() {
    const openedAt = performance.now();
    // Thoát toàn màn hình bằng nút của máy (vuốt / phím Esc): cập nhật lại mục Chế độ hiển thị
    this.onFullscreen = () => {
      const actual = fullscreen.active ? 'full' : 'window';
      if (this.draft.display === this.baseline.display) this.draft.display = actual;
      this.baseline.display = actual;
      this.dirty();
    };
    document.addEventListener('fullscreenchange', this.onFullscreen);
    document.addEventListener('webkitfullscreenchange', this.onFullscreen);
    // Kéo thanh trượt: theo dõi trên cả màn hình (ngón tay trượt ra khỏi rãnh vẫn kéo tiếp)
    this.onMove = (p) => this.sliding && p.isDown && this.slideTo(p.x);
    this.onUp = () => {
      this.sliding = null;
      // Thả tay ra ngoài nút đang nhấn: thôi
      if (this.pressed) {
        this.pressed = null;
        this.dirty();
      }
    };
    this.scene.input.on('pointermove', this.onMove);
    this.scene.input.on('pointerup', this.onUp);
    this.scene.input.on('pointerupoutside', this.onUp);
    this.ticker = this.scene.time.addEvent({ delay: 500, loop: true, callback: () => this.updateInfo() });
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set(
        (e) => e.timeStamp >= openedAt && this.handleKey(e),
        (p) => {
          if (p.downTime < openedAt) return;
          if (p.rightButtonDown() || !this.bounds.contains(p.x, p.y)) this.finish(null);
        },
      );
    });
  }

  // ---------- Bàn phím ----------

  handleKey(e) {
    if (e.code === 'Tab') {
      e.preventDefault?.();
      if (!e.repeat) this.selectTab((this.tab + (e.shiftKey ? -1 : 1) + this.tabs.length) % this.tabs.length);
      return;
    }
    if (isCancel(e)) return this.finish(null);
    const dir = directionOf(e);
    const confirm = isConfirm(e);
    if (this.area === 'side') {
      if (dir === 'up' || dir === 'down') this.selectTab(Phaser.Math.Clamp(this.tab + (dir === 'up' ? -1 : 1), 0, this.tabs.length - 1));
      else if (dir === 'right' || confirm) this.focusMain(0);
      return;
    }
    const rows = this.focusRows;
    const onFoot = this.row >= rows.length;
    if (dir === 'up' || dir === 'down') {
      this.focusMain(Phaser.Math.Clamp(this.row + (dir === 'up' ? -1 : 1), 0, rows.length));
      return;
    }
    if (onFoot) {
      if (dir === 'left' && this.footCol === 0) return this.focusSide();
      if (dir === 'left' || dir === 'right') {
        this.footCol = Phaser.Math.Clamp(this.footCol + (dir === 'left' ? -1 : 1), 0, 2);
        this.dirty();
      } else if (confirm) {
        this.footAction(this.footCol);
      }
      return;
    }
    const row = rows[this.row];
    if (dir === 'left' || dir === 'right') {
      const step = dir === 'left' ? -1 : 1;
      if (row.type === 'slider') this.stepSlider(row, step);
      else if (row.type === 'segment') this.stepSegment(row, step, false);
      else if (dir === 'left') this.focusSide();
    } else if (confirm) {
      this.activate(row);
    }
  }

  selectTab(i) {
    if (i === this.tab && this.area === 'side') return;
    this.tab = i;
    this.area = 'side';
    this.row = 0;
    this.dirty();
  }

  focusSide() {
    this.area = 'side';
    this.dirty();
  }

  focusMain(row) {
    this.area = 'main';
    this.row = row;
    this.dirty();
  }

  // ---------- Đổi giá trị ----------

  set(key, value) {
    if (this.draft[key] === value) return;
    this.draft[key] = value;
    this.dirty();
  }

  stepSlider(row, step) {
    const i = row.stops.indexOf(this.draft[row.key]);
    const next = Phaser.Math.Clamp((i < 0 ? 0 : i) + step, 0, row.stops.length - 1);
    this.set(row.key, row.stops[next]);
  }

  // wrap: bấm xác nhận trên dòng chọn thì vòng lại từ đầu; ← / → thì dừng ở hai đầu
  stepSegment(row, step, wrap) {
    if (row.disabled) return;
    const n = row.options.length;
    const i = row.options.findIndex((o) => o.value === this.draft[row.key]);
    const next = wrap ? (i + step + n) % n : Phaser.Math.Clamp(i + step, 0, n - 1);
    this.set(row.key, row.options[next].value);
  }

  slideTo(x) {
    const { row, x0, w } = this.sliding;
    const t = Phaser.Math.Clamp((x - x0) / w, 0, 1);
    this.set(row.key, row.stops[Math.round(t * (row.stops.length - 1))]);
  }

  activate(row) {
    if (row.type === 'check') this.set(row.key, !this.draft[row.key]);
    else if (row.type === 'segment') this.stepSegment(row, 1, true);
    else if (row.type === 'button') this.finish({ action: row.action });
  }

  footAction(col) {
    if (col === 0) return this.finish(null);
    if (col === 1) {
      this.commit();
      this.dirty();
      return;
    }
    this.commit();
    this.finish(null);
  }

  // Áp dụng nháp. Gọi ngay trong lúc người chơi vừa bấm (bật toàn màn hình cần vậy)
  commit() {
    const keys = this.changedKeys();
    if (!keys.length) return;
    for (const key of keys) {
      if (key === 'display') fullscreen.set(this.draft.display === 'full');
      else setSetting(key, this.draft[key]);
    }
    if (keys.includes('fpsLimit')) applyFpsLimit(this.scene.game);
    if (keys.includes('screenSize')) applyScreenSize(this.scene.game);
    if (keys.some((k) => k.startsWith('touch'))) refreshTouchControls();
    this.baseline = { ...this.draft };
    this.onApplied(keys);
  }

  // ---------- Vẽ ----------

  drawFrame() {
    const { scene } = this;
    const c = scene.add.container(0, 0);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(PX + 5, PY + 8, PW, PH, 16);
    g.fillStyle(C.frame);
    g.fillRoundedRect(PX, PY, PW, PH, 16);
    g.fillStyle(C.panel);
    g.fillRoundedRect(PX + 4, PY + 4, PW - 8, PH - 8, 13);
    // Dải tiêu đề sáng hơn phía trên
    g.fillStyle(C.headTop);
    g.fillRoundedRect(PX + 4, PY + 4, PW - 8, HEAD - 6, { tl: 13, tr: 13, bl: 0, br: 0 });
    g.fillStyle(0xffffff, 0.06);
    g.fillRect(PX + 18, PY + 8, PW - 36, 3);
    g.lineStyle(2, 0x55575f);
    g.strokeRoundedRect(PX + 4, PY + 4, PW - 8, PH - 8, 13);
    // Hai khung lõm: cột thẻ và nội dung
    for (const [x, w] of [[SIDE_X, SIDE_W], [MAIN_X, MAIN_W]]) {
      g.fillStyle(C.inset);
      g.fillRoundedRect(x, BODY_Y, w, BODY_H, 8);
      g.lineStyle(2, C.insetLine);
      g.strokeRoundedRect(x, BODY_Y, w, BODY_H, 8);
    }
    drawGear(g, PX + 46, PY + HEAD / 2 + 2, 22);
    c.add(g);
    c.add(scene.add.text(PX + 82, PY + HEAD / 2 + 2, 'Cài đặt', bold(32, C.title)).setOrigin(0, 0.5));
    return c;
  }

  // Vẽ lại ở khung hình sau (gom nhiều thay đổi một lần; không xoá nút đang nhận sự kiện chuột)
  dirty() {
    if (this.pending || this.done) return;
    this.pending = true;
    this.scene.time.delayedCall(0, () => {
      this.pending = false;
      this.render();
    });
  }

  render() {
    if (this.done) return;
    this.dyn.removeAll(true);
    this.infoTexts = [];
    const g = this.scene.add.graphics();
    this.dyn.add(g);
    this.renderTabs(g);
    this.renderRows(g);
    this.renderFoot(g);
    fixToCamera(this.container);
  }

  renderTabs(g) {
    const { scene } = this;
    this.tabs.forEach((tab, i) => {
      const x = SIDE_X + 14;
      const y = BODY_Y + 14 + i * 68;
      const w = SIDE_W - 28;
      const h = 56;
      const active = i === this.tab;
      drawButton(g, x, y, w, h, active ? 'blue' : 'gray', this.pressed === `tab${i}`);
      if (active && this.area === 'side') focusRing(g, x, y, w, h);
      this.dyn.add(scene.add.text(x + w / 2, y + h / 2, tab.label, bold(24)).setOrigin(0.5));
      this.hit(x, y, w, h, `tab${i}`, () => {
        this.tab = i;
        this.area = 'side';
        this.row = 0;
      });
    });
  }

  renderRows(g) {
    let y = BODY_Y + 18;
    let fi = 0;
    for (const row of this.rows) {
      const index = focusable(row) ? fi++ : -1;
      const focused = this.area === 'main' && index === this.row;
      this[`row_${row.type}`](g, row, y, focused, index);
      y += ROW_H[row.type] + (row.note ? 26 : 0);
    }
  }

  row_info(g, row, y) {
    const t = this.scene.add.text(MAIN_X + PAD, y + 4, row.text(), textStyle(17, C.dim));
    this.dyn.add(t);
    this.infoTexts.push([t, row]);
  }

  updateInfo() {
    for (const [t, row] of this.infoTexts ?? []) if (t.active) t.setText(row.text());
  }

  row_segment(g, row, y, focused, index) {
    const { scene } = this;
    const x = MAIN_X + PAD;
    const w = MAIN_W - PAD * 2;
    this.dyn.add(scene.add.text(x, y, row.label, bold(22, row.disabled ? C.dim : C.text)));
    const n = row.options.length;
    const gap = 12;
    const bw = Math.min(210, (w - gap * (n - 1)) / n);
    const by = y + 36;
    const bh = 54;
    row.options.forEach((opt, i) => {
      const bx = x + i * (bw + gap);
      const on = this.draft[row.key] === opt.value;
      const id = `${row.key}:${opt.value}`;
      drawButton(g, bx, by, bw, bh, on ? 'blue' : 'gray', this.pressed === id, row.disabled);
      this.dyn.add(scene.add.text(bx + bw / 2, by + bh / 2, opt.label, bold(21, row.disabled ? C.dim : C.text)).setOrigin(0.5));
      if (!row.disabled) {
        this.hit(bx, by, bw, bh, id, () => {
          this.area = 'main';
          this.row = index;
          this.draft[row.key] = opt.value;
        });
      }
    });
    if (focused) focusRing(g, x, by, n * bw + (n - 1) * gap, bh);
    if (row.note) this.dyn.add(scene.add.text(x, by + bh + 8, row.note, textStyle(16, C.dim)));
  }

  row_slider(g, row, y, focused, index) {
    const { scene } = this;
    const x = MAIN_X + PAD;
    const w = MAIN_W - PAD * 2;
    const value = this.draft[row.key];
    this.dyn.add(scene.add.text(x, y, row.label, bold(22)));
    this.dyn.add(scene.add.text(x + w, y, row.format(value), bold(22)).setOrigin(1, 0));
    // Rãnh
    const ty = y + 50;
    const th = 22;
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x, ty + 2, w, th, th / 2);
    g.fillStyle(0x101114);
    g.fillRoundedRect(x, ty, w, th, th / 2);
    g.fillStyle(0x3a3c43);
    g.fillRoundedRect(x + 3, ty + th / 2, w - 6, th / 2 - 3, { tl: 0, tr: 0, bl: 8, br: 8 });
    g.lineStyle(2, 0x55575f);
    g.strokeRoundedRect(x, ty, w, th, th / 2);
    // Vạch mỗi nấc
    const inner = w - 30;
    const x0 = x + 15;
    const at = (i) => x0 + (inner * i) / (row.stops.length - 1);
    g.fillStyle(0x6a6d76);
    row.stops.forEach((_, i) => g.fillRect(at(i) - 1, ty + th + 6, 2, 6));
    // Núm kéo
    const i = Math.max(0, row.stops.indexOf(value));
    const hx = at(i);
    const hw = 24;
    const hh = 40;
    const grabbed = this.sliding?.row === row;
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(hx - hw / 2 + 2, ty + th / 2 - hh / 2 + 3, hw, hh, 5);
    g.fillStyle(grabbed ? 0xffffff : 0xd6d8de);
    g.fillRoundedRect(hx - hw / 2, ty + th / 2 - hh / 2, hw, hh, 5);
    g.fillStyle(0xa9acb5);
    g.fillRect(hx - hw / 2 + 3, ty + th / 2 + 2, hw - 6, hh / 2 - 6);
    g.lineStyle(2, 0x5a5d66);
    g.strokeRoundedRect(hx - hw / 2, ty + th / 2 - hh / 2, hw, hh, 5);
    g.lineStyle(2, 0x8a8d96);
    for (const dx of [-4, 0, 4]) g.lineBetween(hx + dx, ty + th / 2 - 8, hx + dx, ty + th / 2 + 8);
    if (focused) focusRing(g, x - 6, ty - 14, w + 12, th + 28);
    // Vùng bấm cao cho dễ chạm bằng ngón tay; bấm vào đâu núm nhảy tới đó rồi kéo tiếp
    const zone = this.scene.add.zone(x - 10, ty - 22, w + 20, th + 44).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.area = 'main';
      this.row = index;
      this.sliding = { row, x0, w: inner };
      this.slideTo(p.x);
      this.dirty();
    });
    this.dyn.add(zone);
  }

  row_check(g, row, y, focused, index) {
    const { scene } = this;
    const x = MAIN_X + PAD;
    const s = 38;
    const by = y + 6;
    const on = this.draft[row.key];
    const pressed = this.pressed === row.key;
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x + 1, by + 3, s, s, 7);
    g.fillStyle(pressed ? 0x3a3c43 : 0x24252a);
    g.fillRoundedRect(x, by, s, s, 7);
    g.lineStyle(2, 0x6a6d76);
    g.strokeRoundedRect(x, by, s, s, 7);
    if (on) {
      // Dấu tích trắng viền đen như hình mẫu
      const pts = [[x + 8, by + 19], [x + 16, by + 28], [x + 32, by + 6]];
      g.lineStyle(10, 0x0c0d10);
      g.strokePoints(pts.map(([px, py]) => ({ x: px, y: py })));
      g.lineStyle(6, 0xf2f3f5);
      g.strokePoints(pts.map(([px, py]) => ({ x: px, y: py })));
    }
    const label = scene.add.text(x + s + 16, by + s / 2, row.label, bold(22)).setOrigin(0, 0.5);
    this.dyn.add(label);
    const w = s + 16 + label.width + 12;
    if (focused) focusRing(g, x - 6, by - 6, w + 6, s + 12);
    this.hit(x - 6, by - 8, Math.max(w, 260), s + 16, row.key, () => {
      this.area = 'main';
      this.row = index;
      this.draft[row.key] = !this.draft[row.key];
    });
  }

  row_button(g, row, y, focused) {
    const { scene } = this;
    const x = MAIN_X + PAD;
    const w = Math.min(360, MAIN_W - PAD * 2);
    const h = 54;
    const id = `act:${row.action}`;
    drawButton(g, x, y + 4, w, h, 'gray', this.pressed === id);
    this.dyn.add(scene.add.text(x + w / 2, y + 4 + h / 2, row.label, bold(22)).setOrigin(0.5));
    if (focused) focusRing(g, x, y + 4, w, h);
    this.hit(x, y + 4, w, h, id, () => this.finish({ action: row.action }));
  }

  renderFoot(g) {
    const { scene } = this;
    const by = PY + PH - FOOT + 14;
    const canApply = this.changedKeys().length > 0;
    const labels = [['Huỷ', 'red'], ['Áp dụng', 'green'], ['OK', 'green']];
    const onFoot = this.area === 'main' && this.row >= this.focusRows.length;
    labels.forEach(([label, color], i) => {
      const bx = PX + PW - 22 - (3 - i) * FOOT_BTN.w - (2 - i) * FOOT_BTN.gap;
      const disabled = i === 1 && !canApply;
      drawButton(g, bx, by, FOOT_BTN.w, FOOT_BTN.h, color, this.pressed === `foot${i}`, disabled);
      if (onFoot && this.footCol === i) focusRing(g, bx, by, FOOT_BTN.w, FOOT_BTN.h);
      const t = scene.add.text(bx + FOOT_BTN.w / 2, by + FOOT_BTN.h / 2, label, bold(26, '#ffffff', { strokeThickness: 4 })).setOrigin(0.5);
      if (disabled) t.setAlpha(0.5);
      this.dyn.add(t);
      if (!disabled) this.hit(bx, by, FOOT_BTN.w, FOOT_BTN.h, `foot${i}`, () => this.footAction(i));
    });
  }

  // Vùng bấm: nhấn thì nút lún xuống, THẢ tay đúng trên nút mới chạy fn (chạy ngay trong sự kiện thả tay của trình duyệt,
  // vì bật toàn màn hình chỉ được phép lúc đó)
  hit(x, y, w, h, id, fn) {
    const zone = this.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      if (p.rightButtonDown()) return;
      this.pressed = id;
      this.dirty();
    });
    zone.on('pointerup', () => {
      if (this.pressed !== id || this.done) return;
      this.pressed = null;
      fn();
      this.dirty();
    });
    this.dyn.add(zone);
  }

  // result: null (đóng, bỏ nháp chưa áp dụng) | { action } (mở màn hình khác, kèm state để mở lại bảng)
  finish(result) {
    if (this.done) return;
    this.done = true;
    this.router.clear();
    const { scene } = this;
    scene.input.off('pointermove', this.onMove);
    scene.input.off('pointerup', this.onUp);
    scene.input.off('pointerupoutside', this.onUp);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreen);
    this.ticker?.remove();
    // Huỷ vùng bấm ở khung hình sau: finish có thể chạy ngay trong sự kiện chuột của chính vùng bấm đó
    this.container.setVisible(false);
    scene.time.delayedCall(0, () => this.container.destroy());
    const state = { tab: this.tab, area: this.area, row: this.row, draft: this.draft };
    this.resolve?.(result ? { ...result, state } : null);
  }
}

// Nút bo góc kiểu nổi: xám (thường), xanh dương (đang chọn), đỏ / xanh lá (nút đáy)
const SKINS = {
  gray: [C.btn, C.btnHi, C.btnLine],
  blue: [C.blue, C.blueHi, C.blueLine],
  red: [0x9c1f1f, 0xc83a3a, 0xe87a7a],
  green: [0x23862e, 0x3cae48, 0x8be094],
};
function drawButton(g, x, y, w, h, skin, pressed = false, disabled = false) {
  const [base, hi, line] = SKINS[skin];
  const dy = pressed ? 2 : 0;
  const a = disabled ? 0.45 : 1;
  g.fillStyle(0x000000, 0.55 * a);
  g.fillRoundedRect(x, y + 3, w, h, 9);
  g.fillStyle(0x0c0d10, a);
  g.fillRoundedRect(x - 2, y - 2 + dy, w + 4, h + 4, 10);
  g.fillStyle(pressed ? base : hi, a);
  g.fillRoundedRect(x, y + dy, w, h, 8);
  g.fillStyle(base, a);
  g.fillRoundedRect(x, y + dy + h / 2, w, h / 2, { tl: 0, tr: 0, bl: 8, br: 8 });
  g.lineStyle(2, line, 0.55 * a);
  g.strokeRoundedRect(x + 2, y + 2 + dy, w - 4, h - 4, 7);
}

function focusRing(g, x, y, w, h) {
  g.lineStyle(3, C.focus);
  g.strokeRoundedRect(x - 5, y - 5, w + 10, h + 10, 12);
}

// Biểu tượng bánh răng ở góc tiêu đề
function drawGear(g, cx, cy, r) {
  g.fillStyle(0x000000, 0.4);
  g.fillCircle(cx + 2, cy + 3, r);
  const teeth = 8;
  g.fillStyle(0xa9acb8);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const pts = [[-0.22, 0.6], [0.22, 0.6], [0.18, 1.08], [-0.18, 1.08]].map(([u, v]) => ({
      x: cx + (Math.cos(a) * v - Math.sin(a) * u) * r,
      y: cy + (Math.sin(a) * v + Math.cos(a) * u) * r,
    }));
    g.fillPoints(pts, true);
  }
  g.fillCircle(cx, cy, r * 0.78);
  g.fillStyle(0xd4d6de);
  g.fillCircle(cx - r * 0.12, cy - r * 0.12, r * 0.5);
  g.fillStyle(C.headTop);
  g.fillCircle(cx, cy, r * 0.3);
}
