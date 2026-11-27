import Phaser from 'phaser';
import { FPS_STOPS, RESOLUTIONS, UI_SCALES, applyFpsLimit, applyResolution, fullscreen, resolutionLabel, uiScaleLabel } from '../game/display.js';
import { KEY_ACTIONS, canBind, clearBinding, getBindings, keyName, setBinding } from '../game/keybinds.js';
import { applyHiRes } from '../game/hires.js';
import { setSetting, settings } from '../game/settings.js';
import { BLEED, fixToCamera, localX, textStyle, uiX } from './helpers.js';
import { directionOf, isCancel, isConfirm, isTouchDevice } from './input.js';

// Bảng Cài đặt kiểu game PC: cột thẻ bên trái (Đồ hoạ / Chung / Điều khiển), nội dung bên phải (nút chọn, ô tích, thanh
// trượt), đáy là Huỷ / Áp dụng / OK. Đổi gì cũng chỉ là nháp, bấm Áp dụng / OK mới có tác dụng; chỉ Huỷ là bỏ nháp
// (Esc / phím quay lại / chuột phải / bấm ra ngoài khung không đóng bảng).
//  Chuột / cảm ứng: bấm thẻ, bấm nút, kéo thanh trượt (hoặc bấm thẳng vào rãnh). Nút kích hoạt lúc THẢ tay (trình duyệt
//  chỉ cho bật toàn màn hình trong lúc người chơi vừa thả tay / bấm phím).
//  Bàn phím: ↑ / ↓ chọn dòng, ← / → đổi giá trị (dòng không có giá trị: sang cột thẻ), xác nhận để bật / tắt / bấm,
//  Tab đổi thẻ.
//  Nút mở màn hình khác (Đổi diện mạo...) đóng bảng và trả về { action, state }: màn hình gọi lo
//  mở màn đó rồi mở lại bảng với state (giữ thẻ, dòng đang chọn và nháp chưa áp dụng).
//  Dòng half: xếp 2 cột (thẻ Chung: các ô tích, các nút). ← / → đổi cột, ↑ / ↓ lên xuống theo hàng.
//  Thẻ Điều khiển: bảng phím (Hành động | Phím chính | Phím phụ) ngay trong thẻ, cuộn bằng con lăn / phím hướng. Bấm vào ô
//  (hoặc chọn rồi bấm xác nhận): ô nhấp nháy "…", phím bấm tiếp theo được gán (kể cả Esc / Enter); bấm lại ô đó hoặc bấm
//  ra chỗ khác là thôi; Delete bỏ phím của ô. Đổi phím có tác dụng ngay (không chờ Áp dụng), trùng phím hành động khác thì
//  hai bên đổi cho nhau (dòng bị đổi sáng vàng), không đổi được (hành động bắt buộc mất hết phím) thì sáng đỏ.

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

const ROW_H = { segment: 100, select: 100, slider: 96, check: 60, button: 68, info: 34, keys: 0 };
const HALF_H = { check: 50, button: 68 }; // dòng 2 cột
// Bảng phím trong thẻ Điều khiển
const KEY = { rowH: 36, slotW: 150, slotH: 30, head: 34, foot: 6 };
const KEY_TOP = BODY_Y + 18 + KEY.head; // dòng đầu bảng
const KEY_VISIBLE = Math.floor((BODY_Y + BODY_H - KEY.foot - KEY_TOP) / KEY.rowH);
const KEY_GOLD = '#ffc94a';
// Danh sách xổ xuống: số cột, cỡ mỗi ô
const DROP = { cols: 2, h: 34, gap: 4, pad: 8 }; // gọn để không đè hàng nút đáy bảng
const bold = (size, color = C.text, extra = {}) => textStyle(size, color, { fontStyle: 'bold', stroke: '#0c0d10', strokeThickness: 3, ...extra });

// Giá trị hiện tại của mọi mục (để so với nháp)
function currentValues() {
  return {
    display: fullscreen.active ? 'full' : 'window',
    resolution: RESOLUTIONS.includes(settings.resolution) ? settings.resolution : 'screen',
    fpsLimit: FPS_STOPS.includes(settings.fpsLimit) ? settings.fpsLimit : 0,
    sharp: settings.sharp !== false,
    lighting: settings.lighting !== false,
    weather: settings.weather !== false,
    catchPreview: settings.catchPreview !== false,
    repelAuto: settings.repelAuto !== false,
    repelAsk: settings.repelAsk === true,
    npcNames: settings.npcNames !== false,
    playerNames: settings.playerNames !== false,
    showDpad: settings.showDpad === true,
    touchRelative: settings.touchRelative === true,
    uiScale: UI_SCALES.includes(settings.uiScale) ? settings.uiScale : 0,
  };
}

// Các thẻ và dòng trong thẻ. opts: { account (tên đăng nhập, tài khoản chưa có tên thì email), game,
// lobby (mở từ màn đăng nhập: bỏ các nút cần đang ở trong game) }
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
        { type: 'select', key: 'resolution', label: 'Độ phân giải',
          options: RESOLUTIONS.map((value) => ({ value, label: resolutionLabel(value) })) },
        { type: 'slider', key: 'fpsLimit', label: 'Giới hạn FPS', stops: FPS_STOPS, format: (v) => (v ? `${v} FPS` : 'Theo màn hình') },
        { type: 'check', half: true, key: 'sharp', label: 'Hiển thị sắc nét' },
        { type: 'check', half: true, key: 'lighting', label: 'Ánh sáng ngày đêm' },
        { type: 'check', half: true, key: 'weather', label: 'Hiệu ứng thời tiết' },
      ],
    },
    {
      id: 'general',
      label: 'Chung',
      rows: [
        // Phóng to cột đội hình, cột nút, thanh phím tắt... trên bản đồ (game/display.js: hudScaleFor)
        { type: 'slider', key: 'uiScale', label: 'Cỡ giao diện', stops: UI_SCALES, format: uiScaleLabel },
        // Repel hết hiệu lực: tự dùng thêm cái cùng loại / dừng lại hỏi (bật cả hai thì hỏi)
        { type: 'check', half: true, key: 'repelAuto', label: 'Tự dùng lại Repel' },
        { type: 'check', half: true, key: 'repelAsk', label: 'Hỏi khi Repel hết' },
        { type: 'check', half: true, key: 'catchPreview', label: 'Xem nhanh khi gửi PC' },
        { type: 'check', half: true, key: 'npcNames', label: 'Tên NPC' },
        { type: 'check', half: true, key: 'playerNames', label: 'Tên người chơi' },
        { type: 'check', half: true, key: 'showDpad', label: 'Hiện D-Pad' },
        { type: 'check', half: true, key: 'touchRelative', label: 'Cần gạt tương đối' },
        // Màn đăng nhập (lobby): chưa có nhân vật nên không đổi diện mạo được
        ...(opts.lobby ? [] : [{ type: 'button', half: true, label: 'Đổi diện mạo', action: 'look' }]),
        ...(opts.account ? [
          { type: 'info', text: () => `Tài khoản: ${opts.account}` },
          { type: 'button', half: true, label: 'Đăng xuất', action: 'logout' },
        ] : []),
      ],
    },
    {
      id: 'controls',
      label: 'Điều khiển',
      rows: [{ type: 'keys' }],
    },
  ];
}

const focusable = (row) => row.type !== 'info' && !row.disabled;

export class SettingsPanel {
  // opts: { depth, account, lobby, state (từ lần mở trước), onApplied(keys) }
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
    // Bảng phím: dòng / ô (0 chính, 1 phụ) đang chọn, cuộn, ô đang chờ phím
    this.krow = 0;
    this.kcol = 0;
    this.kscroll = 0;
    this.capturing = null;
    this.kflash = new Map(); // id hành động -> { kind: 'swap' | 'error', token }

    // Bảng vẽ theo khung 960x720, dời vào giữa màn hình rộng
    this.container = scene.add.container(uiX(scene), 0).setDepth(this.depth);
    // Nền tối phủ cả màn hình (bấm vào = Huỷ, xử lý ở open)
    this.container.add(scene.add.rectangle(-BLEED, 0, 960 + BLEED * 2, scene.scale.height, 0x000000, 0.45).setOrigin(0));
    this.container.add(this.drawFrame());
    this.dyn = scene.add.container(0, 0);
    this.container.add(this.dyn);
    // Đổi độ phân giải (Áp dụng) / xoay máy lúc bảng đang mở: dời bảng vào giữa màn hình mới
    this.onResize = () => this.container.setX(uiX(scene));
    scene.scale.on('resize', this.onResize);
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
    this.onMove = (p) => this.sliding && p.isDown && this.slideTo(localX(this.scene, p));
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
    // Con lăn chuột: cuộn bảng phím
    this.onWheel = (p, objs, dx, dy) => {
      if (dy && this.keysTab && !this.dropdown) this.kscrollBy(Math.sign(dy));
    };
    this.scene.input.on('wheel', this.onWheel);
    this.ticker = this.scene.time.addEvent({ delay: 500, loop: true, callback: () => {
      this.updateInfo();
      // Ô đang chờ phím nhấp nháy
      if (this.capturing) {
        this.blinkOn = !this.blinkOn;
        this.dirty();
      }
    } });
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.router.set(
        (e) => e.timeStamp >= openedAt && this.handleKey(e),
        (p) => {
          if (p.downTime < openedAt) return;
          // Đang chờ phím mà bấm ra chỗ khác: thôi chờ. Chuột phải / bấm ra ngoài không đóng bảng (chỉ Huỷ / OK)
          if (this.capturing) this.stopCapture();
        },
      );
    });
  }

  // ---------- Bàn phím ----------

  get keysTab() {
    return this.rows.some((r) => r.type === 'keys');
  }

  handleKey(e) {
    // Ô bảng phím đang chờ: phím nào cũng là phím mới (kể cả Esc, Tab)
    if (this.capturing) {
      if (e.repeat) return;
      e.preventDefault?.();
      return this.capture(e.code);
    }
    if (this.dropdown) return this.dropKey(e);
    if (e.code === 'Tab') {
      e.preventDefault?.();
      if (!e.repeat) this.selectTab((this.tab + (e.shiftKey ? -1 : 1) + this.tabs.length) % this.tabs.length);
      return;
    }
    const dir = directionOf(e);
    const confirm = isConfirm(e);
    if (this.area === 'side') {
      if (dir === 'up' || dir === 'down') this.selectTab(Phaser.Math.Clamp(this.tab + (dir === 'up' ? -1 : 1), 0, this.tabs.length - 1));
      else if (dir === 'right' || confirm) this.focusMain(0);
      return;
    }
    const rows = this.focusRows;
    const onFoot = this.row >= rows.length;
    if (!onFoot && rows[this.row]?.type === 'keys') return this.keysKey(e, dir, confirm);
    if (dir === 'up' || dir === 'down') {
      this.focusMain(this.lineStep(dir === 'up' ? -1 : 1));
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
      const at = this.focusAt?.[this.row];
      if (row.type === 'slider') this.stepSlider(row, step);
      else if (row.type === 'segment' || row.type === 'select') this.stepSegment(row, step, false);
      // Dòng 2 cột: sang ô cùng hàng
      else if (at && dir === 'right' && at.col === 0 && this.focusAt[this.row + 1]?.line === at.line) this.focusMain(this.row + 1);
      else if (at && dir === 'left' && at.col === 1) this.focusMain(this.row - 1);
      else if (dir === 'left') this.focusSide();
    } else if (confirm) {
      this.activate(row);
    }
  }

  // ↑ / ↓ trong nội dung: lên / xuống một hàng (dòng 2 cột: giữ cột nếu hàng kia có); hết hàng thì xuống hàng nút đáy
  lineStep(step) {
    const n = this.focusRows.length;
    const at = this.focusAt?.[this.row];
    if (!at || this.row >= n) return Phaser.Math.Clamp(this.row + step, 0, n);
    const lines = this.focusAt.slice(0, n);
    const target = at.line + step;
    const same = lines.findIndex((a) => a.line === target && a.col === at.col);
    if (same >= 0) return same;
    const any = step > 0 ? lines.findIndex((a) => a.line >= target) : lines.findLastIndex((a) => a.line <= target);
    if (any >= 0) return any;
    return step > 0 ? n : this.row;
  }

  selectTab(i) {
    if (i === this.tab && this.area === 'side') return;
    this.capturing = null;
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
    else if (row.type === 'select') this.openDropdown(row);
    else if (row.type === 'button') this.finish({ action: row.action });
  }

  // ---------- Danh sách xổ xuống (Độ phân giải) ----------

  openDropdown(row) {
    this.dropdown = row;
    this.dropIndex = Math.max(0, row.options.findIndex((o) => o.value === this.draft[row.key]));
    this.dirty();
  }

  closeDropdown() {
    this.dropdown = null;
    this.dirty();
  }

  // Đang mở danh sách: ← → ↑ ↓ chọn ô (2 cột), xác nhận để chọn, quay lại để đóng danh sách
  dropKey(e) {
    const row = this.dropdown;
    if (isCancel(e)) return this.closeDropdown();
    if (isConfirm(e)) {
      this.set(row.key, row.options[this.dropIndex].value);
      return this.closeDropdown();
    }
    const step = { left: -1, right: 1, up: -DROP.cols, down: DROP.cols }[directionOf(e)];
    if (!step) return;
    const next = this.dropIndex + step;
    if (next < 0 || next >= row.options.length) return;
    this.dropIndex = next;
    this.dirty();
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
    if (keys.includes('resolution')) applyResolution(this.scene.game, this.draft.resolution);
    if (keys.includes('sharp')) applyHiRes(this.scene.game);
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
    this.dropAt = null;
    const g = this.scene.add.graphics();
    this.dyn.add(g);
    this.renderTabs(g);
    this.renderRows(g);
    this.renderFoot(g);
    if (this.dropdown && this.dropAt) this.renderDropdown();
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

  // Dòng half xếp 2 cột (trái rồi phải, hết hàng mới xuống). focusAt[chỉ số dòng chọn được] = { line, col } cho ↑ ↓ ← →
  renderRows(g) {
    let y = BODY_Y + 18;
    let fi = 0;
    let line = 0;
    let col = 0; // cột của dòng half kế tiếp; 1 = hàng hiện tại đã có ô bên trái
    let lineH = 0;
    this.focusAt = [];
    const endLine = () => {
      if (!col) return;
      y += lineH;
      line++;
      col = 0;
    };
    for (const row of this.rows) {
      const index = focusable(row) ? fi++ : -1;
      const focused = this.area === 'main' && index === this.row;
      if (row.half) {
        const half = (MAIN_W - PAD * 2) / 2;
        if (index >= 0) this.focusAt[index] = { line, col };
        this[`row_${row.type}`](g, row, y, focused, index, { x: MAIN_X + PAD + col * half, w: half - 12 });
        lineH = HALF_H[row.type] ?? ROW_H[row.type];
        if (col) endLine();
        else col = 1;
        continue;
      }
      endLine();
      if (index >= 0) this.focusAt[index] = { line, col: 0 };
      this[`row_${row.type}`](g, row, y, focused, index);
      y += ROW_H[row.type] + (row.note ? 26 : 0);
      line++;
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

  // Dòng danh sách xổ xuống: nút to hiện giá trị đang chọn và ▾, bấm vào thì mở danh sách bên dưới
  row_select(g, row, y, focused, index) {
    const { scene } = this;
    const x = MAIN_X + PAD;
    const w = MAIN_W - PAD * 2;
    const by = y + 36;
    const bh = 54;
    const open = this.dropdown === row;
    const id = `sel:${row.key}`;
    this.dyn.add(scene.add.text(x, y, row.label, bold(22)));
    drawButton(g, x, by, w, bh, open ? 'blue' : 'gray', this.pressed === id);
    const current = row.options.find((o) => o.value === this.draft[row.key]) ?? row.options[0];
    this.dyn.add(scene.add.text(x + 18, by + bh / 2, current.label, bold(21)).setOrigin(0, 0.5));
    this.dyn.add(scene.add.text(x + w - 20, by + bh / 2, open ? '▴' : '▾', bold(24)).setOrigin(1, 0.5));
    if (focused) focusRing(g, x, by, w, bh);
    this.hit(x, by, w, bh, id, () => {
      this.area = 'main';
      this.row = index;
      if (open) this.dropdown = null;
      else this.openDropdown(row);
    });
    if (open) this.dropAt = { x, y: by + bh + 6, w };
  }

  // Danh sách các lựa chọn, vẽ đè lên các dòng bên dưới. Bấm ra ngoài danh sách (trong bảng) thì đóng danh sách
  renderDropdown() {
    const { scene } = this;
    const row = this.dropdown;
    const { x, y, w } = this.dropAt;
    const rows = Math.ceil(row.options.length / DROP.cols);
    const h = DROP.pad * 2 + rows * DROP.h + (rows - 1) * DROP.gap;
    this.hit(PX, PY, PW, PH, 'dropClose', () => {
      this.dropdown = null;
    });
    const g = scene.add.graphics();
    this.dyn.add(g);
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(x + 3, y + 6, w, h, 12);
    g.fillStyle(C.frame);
    g.fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(2, C.blueLine, 0.8);
    g.strokeRoundedRect(x, y, w, h, 12);
    const cw = (w - DROP.pad * 2 - (DROP.cols - 1) * DROP.gap) / DROP.cols;
    row.options.forEach((opt, i) => {
      const cx = x + DROP.pad + (i % DROP.cols) * (cw + DROP.gap);
      const cy = y + DROP.pad + Math.floor(i / DROP.cols) * (DROP.h + DROP.gap);
      const on = this.draft[row.key] === opt.value;
      const id = `opt:${opt.value}`;
      drawButton(g, cx, cy, cw, DROP.h, on ? 'blue' : 'gray', this.pressed === id);
      if (i === this.dropIndex) focusRing(g, cx + 3, cy + 3, cw - 6, DROP.h - 6);
      this.dyn.add(scene.add.text(cx + cw / 2, cy + DROP.h / 2, opt.label, bold(17)).setOrigin(0.5));
      this.hit(cx, cy, cw, DROP.h, id, () => {
        this.draft[row.key] = opt.value;
        this.dropdown = null;
      });
    });
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
      this.slideTo(localX(this.scene, p));
      this.dirty();
    });
    this.dyn.add(zone);
  }

  // cell: { x, w } khi xếp 2 cột (ô nhỏ hơn, chữ nhỏ hơn)
  row_check(g, row, y, focused, index, cell = null) {
    const { scene } = this;
    const x = cell?.x ?? MAIN_X + PAD;
    const s = cell ? 34 : 38;
    const by = y + (cell ? 4 : 6);
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
      const k = s / 38;
      const pts = [[x + 8 * k, by + 19 * k], [x + 16 * k, by + 28 * k], [x + 32 * k, by + 6 * k]];
      g.lineStyle(10, 0x0c0d10);
      g.strokePoints(pts.map(([px, py]) => ({ x: px, y: py })));
      g.lineStyle(6, 0xf2f3f5);
      g.strokePoints(pts.map(([px, py]) => ({ x: px, y: py })));
    }
    const label = scene.add.text(x + s + (cell ? 12 : 16), by + s / 2, row.label, bold(cell ? 19 : 22)).setOrigin(0, 0.5);
    this.dyn.add(label);
    if (cell && label.width > cell.w - s - 12) label.setScale((cell.w - s - 12) / label.width);
    const w = s + (cell ? 12 : 16) + label.displayWidth + 12;
    if (focused) focusRing(g, x - 6, by - 6, w + 6, s + 12);
    this.hit(x - 6, by - 8, cell ? cell.w + 6 : Math.max(w, 260), s + 16, row.key, () => {
      this.area = 'main';
      this.row = index;
      this.draft[row.key] = !this.draft[row.key];
    });
  }

  row_button(g, row, y, focused, index, cell = null) {
    const { scene } = this;
    const x = cell?.x ?? MAIN_X + PAD;
    const w = cell?.w ?? Math.min(360, MAIN_W - PAD * 2);
    const h = 54;
    const id = `act:${row.action}`;
    drawButton(g, x, y + 4, w, h, 'gray', this.pressed === id);
    this.dyn.add(scene.add.text(x + w / 2, y + 4 + h / 2, row.label, bold(22)).setOrigin(0.5));
    if (focused) focusRing(g, x, y + 4, w, h);
    this.hit(x, y + 4, w, h, id, () => this.finish({ action: row.action }));
  }

  // ---------- Bảng phím (thẻ Điều khiển) ----------

  row_keys(g, row, y, focused, index) {
    const { scene } = this;
    const x = MAIN_X + PAD;
    const w = MAIN_W - PAD * 2;
    const s1 = x + w - 16 - KEY.slotW;
    const s0 = s1 - 10 - KEY.slotW;
    const head = bold(18, KEY_GOLD);
    this.dyn.add(scene.add.text(x + 8, y, 'Hành động', head));
    this.dyn.add(scene.add.text(s0 + KEY.slotW / 2, y, 'Phím chính', head).setOrigin(0.5, 0));
    this.dyn.add(scene.add.text(s1 + KEY.slotW / 2, y, 'Phím phụ', head).setOrigin(0.5, 0));
    const n = KEY_ACTIONS.length;
    const bindings = getBindings();
    const active = focused; // đang chọn trong bảng (bàn phím)
    for (let i = this.kscroll; i < Math.min(n, this.kscroll + KEY_VISIBLE); i++) {
      const action = KEY_ACTIONS[i];
      const top = KEY_TOP + (i - this.kscroll) * KEY.rowH;
      const cy = top + KEY.rowH / 2;
      const flash = this.kflash.get(action.id)?.kind;
      const selected = active && i === this.krow;
      const bg = flash === 'error' ? [0x7a2a2a, 0.9] : flash === 'swap' ? [0x7a6420, 0.9] : selected ? [0x2c4a86, 0.75] : i % 2 ? [0xffffff, 0.04] : null;
      if (bg) {
        g.fillStyle(bg[0], bg[1]);
        g.fillRoundedRect(x, top + 2, w - 12, KEY.rowH - 4, 7);
      }
      const label = scene.add.text(x + 8, cy, action.label, bold(18, KEY_GOLD)).setOrigin(0, 0.5);
      if (label.width > s0 - x - 16) label.setScale((s0 - x - 16) / label.width);
      this.dyn.add(label);
      [s0, s1].forEach((sx, col) => this.keySlot(g, i, col, bindings[action.id][col], sx, cy, index, selected && col === this.kcol));
    }
    // Thanh cuộn mảnh bên phải
    if (n > KEY_VISIBLE) {
      const trackH = KEY_VISIBLE * KEY.rowH - 6;
      const thumbH = Math.max(30, (trackH * KEY_VISIBLE) / n);
      const thumbY = KEY_TOP + 3 + ((trackH - thumbH) * this.kscroll) / (n - KEY_VISIBLE);
      g.fillStyle(0x101114);
      g.fillRoundedRect(x + w - 6, KEY_TOP + 3, 6, trackH, 3);
      g.fillStyle(0x7a7d86);
      g.fillRoundedRect(x + w - 6, thumbY, 6, thumbH, 3);
    }
  }

  keySlot(g, row, col, code, sx, cy, index, selected) {
    const { scene } = this;
    const top = cy - KEY.slotH / 2;
    const capturing = this.capturing?.row === row && this.capturing?.col === col;
    const id = `key:${row}:${col}`;
    if (capturing) {
      g.fillStyle(this.blinkOn ? 0xffd860 : 0x8a6a20);
      g.fillRoundedRect(sx, top, KEY.slotW, KEY.slotH, 7);
    } else {
      drawButton(g, sx, top, KEY.slotW, KEY.slotH, selected ? 'blue' : 'gray', this.pressed === id);
    }
    const label = capturing ? '…' : code ? keyName(code) : '—';
    const color = capturing ? '#2a1a00' : code ? C.text : C.dim;
    this.dyn.add(scene.add.text(sx + KEY.slotW / 2, cy, label, bold(capturing ? 22 : 17, color, capturing ? { strokeThickness: 0 } : {})).setOrigin(0.5));
    this.hit(sx, top, KEY.slotW, KEY.slotH, id, () => {
      this.area = 'main';
      this.row = index;
      this.krow = row;
      this.kcol = col;
      // Bấm lại đúng ô đang chờ: thôi chờ
      this.capturing = capturing ? null : { row, col };
      this.blinkOn = true;
    });
  }

  // Phím hướng / xác nhận / Delete khi đang ở bảng phím
  keysKey(e, dir, confirm) {
    const last = KEY_ACTIONS.length - 1;
    if (dir === 'up') {
      if (this.krow > 0) this.kselect(this.krow - 1);
    } else if (dir === 'down') {
      if (this.krow < last) this.kselect(this.krow + 1);
      else this.focusMain(this.row + 1); // xuống hàng nút đáy
    } else if (dir === 'left') {
      if (this.kcol === 1) this.kselect(this.krow, 0);
      else this.focusSide();
    } else if (dir === 'right') {
      this.kselect(this.krow, 1);
    } else if (confirm) {
      this.capturing = { row: this.krow, col: this.kcol };
      this.blinkOn = true;
      this.dirty();
    } else if (e.code === 'Delete' && !e.repeat) {
      this.clearKey(this.krow, this.kcol);
    }
  }

  kselect(row, col = this.kcol) {
    this.krow = row;
    this.kcol = col;
    // Giữ dòng đang chọn nằm trong khung
    if (row < this.kscroll) this.kscroll = row;
    else if (row >= this.kscroll + KEY_VISIBLE) this.kscroll = row - KEY_VISIBLE + 1;
    this.dirty();
  }

  kscrollBy(n) {
    const next = Phaser.Math.Clamp(this.kscroll + n, 0, Math.max(0, KEY_ACTIONS.length - KEY_VISIBLE));
    if (next === this.kscroll) return;
    this.kscroll = next;
    this.dirty();
  }

  stopCapture() {
    this.capturing = null;
    this.dirty();
  }

  // Phím vừa bấm khi ô đang chờ: Delete bỏ phím của ô, phím không gán được thì báo đỏ, còn lại gán (đổi chỗ nếu trùng)
  capture(code) {
    const { row, col } = this.capturing;
    this.capturing = null;
    const id = KEY_ACTIONS[row].id;
    if (code === 'Delete') return this.clearKey(row, col);
    if (!canBind(code)) return this.keyFlash(id, 'error');
    const result = setBinding(id, col, code);
    if (!result.ok) {
      if (result.blocked) this.keyFlash(result.blocked, 'error');
      return this.keyFlash(id, 'error');
    }
    for (const other of result.changed) this.keyFlash(other, 'swap');
    this.dirty();
  }

  clearKey(row, col) {
    const id = KEY_ACTIONS[row].id;
    if (!getBindings()[id][col]) return this.dirty();
    if (!clearBinding(id, col)) this.keyFlash(id, 'error');
    else this.dirty();
  }

  // Dòng của hành động id sáng lên (vàng: vừa bị đổi phím, đỏ: không đổi được) rồi tắt
  keyFlash(id, kind) {
    const token = {};
    this.kflash.set(id, { kind, token });
    this.dirty();
    this.scene.time.delayedCall(900, () => {
      if (this.done || this.kflash.get(id)?.token !== token) return;
      this.kflash.delete(id);
      this.dirty();
    });
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
      if (this.capturing && !id.startsWith('key:')) this.capturing = null;
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
    scene.input.off('wheel', this.onWheel);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreen);
    this.ticker?.remove();
    scene.scale.off('resize', this.onResize);
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
