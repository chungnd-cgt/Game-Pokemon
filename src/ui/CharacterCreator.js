import {
  CUSTOM_ROWS, GENDERS, normalizeCustom, optionIds, optionInfo, randomCustom, resolveLook, stepOption, switchGender,
} from '../data/playerCustom.js';
import { addSheetTexture, makeCanvas, scale2x, upscaleCanvas } from '../gfx/pixel.js';
import { DIRS, PLAYER_FRAMES, characterPixels } from '../gfx/playerArt.js';
import { BLEED, fixToCamera, followCenter, textStyle, uiX } from './helpers.js';
import { directionOf, isCancel, isConfirm } from './input.js';

// Bảng "Bạn trông thế nào?": bảng nhỏ nền tối giữa màn hình. Bên trái 5 dòng "nhãn ◀ lựa chọn ▶" (kiểu tóc, màu tóc,
// màu da, trang phục, mắt); bên phải hai nút tròn chọn giới tính (♀ hồng / ♂ xanh), nhân vật xem trước đứng trên bục tròn
// (vừa đi vừa xoay các hướng, bấm vào để xoay), nút xúc xắc (ngẫu nhiên) và nút OK.
// Chuột / chạm: bấm ◀ ▶ (hoặc bấm vào ô lựa chọn để sang lựa chọn kế) • Phím: ↑/↓ chọn dòng (dòng đầu là giới tính),
// ←/→ đổi, G đổi giới tính, R ngẫu nhiên, Enter xong.
// Dùng ở màn hình chính (chơi mới: không có nút ✕, bắt buộc chọn xong) và trong game (Cài đặt > Đổi diện mạo:
// opts.cancelable = true có nút ✕ / Esc để thôi; opts.fixed = true để ghim vào màn hình).
// Bảng vẽ theo cỡ gốc W x H rồi phóng to cả bảng (scale) để chữ đủ to trên điện thoại (game thu nhỏ theo màn hình);
// màn hình lớn giữ cỡ gốc. Hình nhân vật vẽ đúng số điểm ảnh hiện ra (pixel nguyên, không nhoè).
// open() trả về { gender, hairStyle, hair, skin, outfit, eyes }, hoặc null nếu thôi (lựa chọn dở dang: creator.value).

const GENDER_IDS = Object.keys(GENDERS);
const GENDER_COLOR = { female: 0xe0508c, male: 0x3a8ae8 };

const PREVIEW_KEY = 'player-custom-preview';
// Cỡ gốc của bảng (trước khi phóng to)
const W = 452;
const H = 238;
const TITLE_H = 34;
const FONT = 14; // cỡ chữ các dòng
// Chữ trên màn hình (px CSS) ít nhất chừng này: điện thoại thu nhỏ game thì phóng bảng to lên
const MIN_CSS_FONT = 12.5;
// Các dòng tuỳ chỉnh
const ROW_Y0 = 64;
const ROW_H = 34;
const LABEL_X = 22;
const ARROW_L = 120;
const BOX_X = 134;
const BOX_W = 130;
const ARROW_R = BOX_X + BOX_W + 14;
// Cột bên phải: sân khấu nhân vật
const STAGE = { x: 300, y: 46, w: 138, h: 140 };
const STAGE_CX = STAGE.x + STAGE.w / 2;
const FEET_Y = STAGE.y + STAGE.h - 14;
const PX = 5; // mỗi pixel logic của nhân vật ~ 5 đơn vị bảng (16x24 -> 80x120)
const BTN_Y = 208; // tâm hàng nút Ngẫu nhiên / OK
// Nhân vật xem trước đi vòng các hướng: xuống, sang trái, lên, sang phải (side lật ngang)
const TURNS = [['down', false], ['side', false], ['up', false], ['side', true]];
const WALK = ['left', 'stand', 'right', 'stand'];

// Màu giao diện tối
const UI = {
  frame: 0x0e0e14, body: 0x2a2a34, bar: 0x3a3a48, barTop: 0x444456, inset: 0x1e1e26, insetLine: 0x14141a,
  box: 0x15151c, boxLine: 0x3c3c4c, focus: 0x4a8ae8, arrow: 0x40404e, arrowHover: 0x4a8ae8,
};
const TEXT = { title: '#c8ccda', label: '#dde0ea', focus: '#ffd866', value: '#ffffff' };

export class CharacterCreator {
  // opts: { gender, look (diện mạo ban đầu; không có thì mặc định của giới tính), depth, fixed (ghim vào màn hình khi camera
  //         trôi), cancelable (có nút ✕ / Esc để thôi), dim (độ tối nền phía sau), title, okLabel }
  constructor(scene, router, opts = {}) {
    this.scene = scene;
    this.router = router;
    this.gender = opts.gender === 'female' ? 'female' : 'male';
    this.custom = normalizeCustom(this.gender, opts.look);
    this.row = 0; // 0 = giới tính, 1.. = các dòng CUSTOM_ROWS
    this.opts = opts;
  }

  // Lựa chọn hiện tại { gender, ...diện mạo }
  get value() {
    return { gender: this.gender, ...this.custom };
  }

  open() {
    this.build();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  // Hệ số phóng to cả bảng: chữ cỡ FONT hiện ra ít nhất MIN_CSS_FONT px CSS, nhưng bảng vẫn nằm gọn trong khung 960x720
  fitScale() {
    const { scale } = this.scene;
    const cssPerUnit = (scale.displaySize?.height || scale.height) / scale.height;
    const want = MIN_CSS_FONT / (FONT * cssPerUnit);
    return Math.min(Math.max(1, want), (960 - 20) / W, (720 - 20) / H);
  }

  build() {
    const { scene } = this;
    const c = scene.add.container(0, 0).setDepth(this.opts.depth ?? 30);
    this.container = c;
    // Nền tối phía sau, chặn bấm xuyên xuống dưới
    c.add(scene.add.rectangle(480, 360, 960 + BLEED * 2, 720, 0x05070f, this.opts.dim ?? 0.55).setInteractive());
    this.panel = scene.add.container(480, 360);
    this.body = scene.add.container(-W / 2, -H / 2);
    this.panel.add(this.body);
    c.add(this.panel);
    this.k = this.fitScale();

    this.buildFrame();
    this.buildRows();
    this.buildStage();
    this.buildButtons();

    this.refresh();
    this.selectRow(0);
    this.applyScale();
    if (this.opts.fixed) {
      fixToCamera(c).setX(uiX(scene)); // trên bản đồ: dời vào giữa màn hình rộng
      followCenter(scene, [c]);
    }
    // Xoay máy / đổi cỡ cửa sổ: tính lại cỡ bảng và vẽ lại nhân vật cho nét
    this.onResize = () => this.applyScale();
    scene.scale.on('resize', this.onResize);

    this.router.set((e) => {
      const dir = directionOf(e);
      const n = CUSTOM_ROWS.length + 1;
      if (dir === 'up' || dir === 'down') this.selectRow((this.row + (dir === 'up' ? -1 : 1) + n) % n);
      else if (dir === 'left' || dir === 'right') this.change(this.row, dir === 'left' ? -1 : 1);
      else if (e.code === 'KeyR' && !e.repeat) this.randomize();
      else if (e.code === 'KeyG' && !e.repeat) this.setGender(this.gender === 'male' ? 'female' : 'male');
      else if (isConfirm(e)) this.finish(this.value);
      else if (this.opts.cancelable && isCancel(e)) this.finish(null);
    });
  }

  applyScale() {
    if (!this.panel?.active) return;
    this.k = this.fitScale();
    this.panel.setScale(this.k);
    this.drawPreview();
  }

  // Khung bảng: viền tối, thanh tiêu đề, vùng trong lõm xuống
  buildFrame() {
    const { scene, body } = this;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(3, 6, W, H, 10);
    g.fillStyle(UI.frame);
    g.fillRoundedRect(0, 0, W, H, 10);
    g.fillStyle(UI.body);
    g.fillRoundedRect(2, 2, W - 4, H - 4, 8);
    // thanh tiêu đề: nửa trên sáng hơn
    g.fillStyle(UI.bar);
    g.fillRoundedRect(2, 2, W - 4, TITLE_H, { tl: 8, tr: 8, bl: 0, br: 0 });
    g.fillStyle(UI.barTop);
    g.fillRoundedRect(2, 2, W - 4, TITLE_H / 2, { tl: 8, tr: 8, bl: 0, br: 0 });
    g.fillStyle(UI.frame);
    g.fillRect(2, TITLE_H + 2, W - 4, 2);
    // vùng trong
    g.fillStyle(UI.inset);
    g.fillRoundedRect(8, TITLE_H + 10, W - 16, H - TITLE_H - 18, 6);
    g.lineStyle(1, UI.insetLine);
    g.strokeRoundedRect(8.5, TITLE_H + 10.5, W - 17, H - TITLE_H - 19, 6);
    body.add(g);
    body.add(scene.add.text(14, 2 + TITLE_H / 2, this.opts.title ?? 'Bạn trông thế nào?',
      textStyle(17, TEXT.title, { fontStyle: 'bold' })).setOrigin(0, 0.5));
    if (this.opts.cancelable) body.add(this.closeButton(W - 20, 2 + TITLE_H / 2));
  }

  // Nút ✕ nhỏ trên thanh tiêu đề (chỉ khi đổi diện mạo trong game)
  closeButton(x, y) {
    const { scene } = this;
    const g = scene.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(hover ? 0xd04848 : 0x2a2a36);
      g.fillCircle(x, y, 11);
      g.lineStyle(2, hover ? 0xffffff : 0xb8bccb);
      g.lineBetween(x - 4, y - 4, x + 4, y + 4);
      g.lineBetween(x - 4, y + 4, x + 4, y - 4);
    };
    draw(false);
    const zone = scene.add.zone(x, y, 30, 30).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => this.finish(null));
    return [g, zone];
  }

  buildRows() {
    const { scene, body } = this;
    this.rowBg = scene.add.graphics();
    body.add(this.rowBg);
    this.rows = CUSTOM_ROWS.map(({ key, label }, i) => {
      const y = ROW_Y0 + i * ROW_H;
      const labelText = scene.add.text(LABEL_X, y, label, textStyle(FONT, TEXT.label, { fontStyle: 'bold' })).setOrigin(0, 0.5);
      const swatch = scene.add.graphics();
      const value = scene.add.text(BOX_X + BOX_W / 2, y, '', textStyle(FONT, TEXT.value)).setOrigin(0.5);
      // Rê chuột vào dòng thì chọn dòng đó; bấm vào ô lựa chọn thì sang lựa chọn kế
      const rowZone = scene.add.zone(LABEL_X - 6, y, ARROW_R + 12 - (LABEL_X - 6), ROW_H).setOrigin(0, 0.5).setInteractive();
      rowZone.on('pointerover', () => this.selectRow(i + 1));
      const boxZone = scene.add.zone(BOX_X + BOX_W / 2, y, BOX_W, ROW_H - 4).setInteractive({ useHandCursor: true });
      boxZone.on('pointerdown', () => this.change(i + 1, 1));
      body.add([labelText, swatch, value, rowZone, boxZone]);
      body.add(this.arrow(ARROW_L, y, -1, () => this.change(i + 1, -1)));
      body.add(this.arrow(ARROW_R, y, 1, () => this.change(i + 1, 1)));
      return { key, y, labelText, swatch, value };
    });
  }

  // Sân khấu bên phải: hai nút giới tính ở hai góc trên, nhân vật đứng trên bục tròn phát sáng
  buildStage() {
    const { scene, body } = this;
    const g = scene.add.graphics();
    g.fillStyle(0x262632);
    g.fillRoundedRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h, 6);
    // ánh sáng hắt lên từ bục
    g.fillStyle(0x5ab8e0, 0.07);
    g.fillEllipse(STAGE_CX, FEET_Y - 20, 120, 110);
    g.fillStyle(0x5ab8e0, 0.08);
    g.fillEllipse(STAGE_CX, FEET_Y - 6, 96, 56);
    // bục tròn: viền tối, mặt sáng xanh, vệt sáng
    g.fillStyle(0x1a3a50);
    g.fillEllipse(STAGE_CX, FEET_Y + 4, 98, 26);
    g.fillStyle(0x3a88b0);
    g.fillEllipse(STAGE_CX, FEET_Y + 1, 96, 22);
    g.fillStyle(0x8ad0ee);
    g.fillEllipse(STAGE_CX, FEET_Y - 1, 88, 16);
    g.fillStyle(0xc8ecfa);
    g.fillEllipse(STAGE_CX - 6, FEET_Y - 2, 56, 7);
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(STAGE_CX, FEET_Y, 42, 8); // bóng dưới chân
    body.add(g);

    this.preview = scene.add.image(STAGE_CX, FEET_Y + 1, '__DEFAULT').setOrigin(0.5, 1);
    body.add(this.preview);
    // Bấm vào nhân vật: xoay sang hướng tiếp theo
    const zone = scene.add.zone(STAGE_CX, FEET_Y - 60, 76, 120).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.turn(1));
    body.add(zone);

    // Nút giới tính: ♀ góc trái, ♂ góc phải
    this.genderBtns = {
      female: this.genderButton(STAGE.x + 17, STAGE.y + 17, 'female'),
      male: this.genderButton(STAGE.x + STAGE.w - 17, STAGE.y + 17, 'male'),
    };
    this.genderRing = scene.add.graphics();
    body.add(this.genderRing);

    this.facing = 0;
    this.tick = 0;
    this.timer = scene.time.addEvent({
      delay: 170,
      loop: true,
      callback: () => {
        this.tick++;
        if (this.tick % 12 === 0) this.turn(1, false);
        this.showFrame();
      },
    });
  }

  genderButton(x, y, id) {
    const { scene, body } = this;
    const g = scene.add.graphics();
    const color = GENDER_COLOR[id];
    const btn = { g, x, y, hover: false };
    btn.draw = () => {
      const on = this.gender === id;
      g.clear();
      g.fillStyle(0x000000, 0.3);
      g.fillCircle(x, y + 2, 13);
      g.fillStyle(on ? color : btn.hover ? 0x4a4a5a : 0x383844);
      g.fillCircle(x, y, 13);
      g.lineStyle(2, on ? 0xffffff : 0x55556a);
      g.strokeCircle(x, y, 13);
      // ký hiệu ♀ / ♂ vẽ bằng nét (không phụ thuộc phông chữ)
      g.lineStyle(2, on ? 0xffffff : color);
      if (id === 'female') {
        g.strokeCircle(x, y - 3, 4.5);
        g.lineBetween(x, y + 1.5, x, y + 8.5);
        g.lineBetween(x - 3.5, y + 5, x + 3.5, y + 5);
      } else {
        g.strokeCircle(x - 2, y + 2, 4.5);
        g.lineBetween(x + 1.2, y - 1.2, x + 6, y - 6);
        g.lineBetween(x + 1.5, y - 6, x + 6.5, y - 6);
        g.lineBetween(x + 6, y - 6.5, x + 6, y - 1.5);
      }
    };
    const zone = scene.add.zone(x, y, 34, 34).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      btn.hover = true;
      btn.draw();
      this.selectRow(0);
    });
    zone.on('pointerout', () => {
      btn.hover = false;
      btn.draw();
    });
    zone.on('pointerdown', () => this.setGender(id));
    body.add([g, zone]);
    return btn;
  }

  // Nút xúc xắc (ngẫu nhiên) và nút OK dưới sân khấu
  buildButtons() {
    const { scene, body } = this;
    const rx = STAGE.x + 16;
    body.add(this.flatButton(rx, BTN_Y, 32, 0x40404e, 0x52526a, () => this.randomize(), (g, hover) => {
      // xúc xắc trắng 3 chấm
      g.fillStyle(hover ? 0xffffff : 0xe8eaf2);
      g.fillRoundedRect(rx - 8, BTN_Y - 8, 16, 16, 4);
      g.fillStyle(0x2a2a36);
      for (const d of [-4, 0, 4]) g.fillCircle(rx + d, BTN_Y + d, 1.8);
    }));
    const okW = STAGE.w - 38;
    const ox = STAGE.x + 38 + okW / 2;
    body.add(this.flatButton(ox, BTN_Y, okW, 0x3aa058, 0x48b868, () => this.finish(this.value)));
    body.add(scene.add.text(ox, BTN_Y, this.opts.okLabel ?? 'OK', textStyle(16, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
  }

  flatButton(x, y, w, color, hoverColor, onClick, icon) {
    const { scene } = this;
    const h = 28;
    const g = scene.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(UI.frame);
      g.fillRoundedRect(x - w / 2, y - h / 2 + 2, w, h, 6);
      g.fillStyle(hover ? hoverColor : color);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 6);
      g.fillStyle(0xffffff, 0.12);
      g.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 1, w - 4, h / 2 - 2, { tl: 5, tr: 5, bl: 0, br: 0 });
      icon?.(g, hover);
    };
    draw(false);
    const zone = scene.add.zone(x, y, w + 4, h + 6).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);
    return [g, zone];
  }

  arrow(x, y, d, onClick) {
    const { scene } = this;
    const g = scene.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(0x000000, 0.3);
      g.fillCircle(x, y + 1.5, 10);
      g.fillStyle(hover ? UI.arrowHover : UI.arrow);
      g.fillCircle(x, y, 10);
      g.fillStyle(0xffffff);
      g.fillTriangle(x + d * 4.5, y, x - d * 3, y - 5, x - d * 3, y + 5);
    };
    draw(false);
    // Vùng bấm rộng hơn hình (dễ chạm trên điện thoại)
    const zone = scene.add.zone(x, y, 28, ROW_H).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);
    return [g, zone];
  }

  // Hình nhân vật xem trước: pixel art bo bậc thang (Scale2x) rồi phóng to nguyên lần (không lọc mịn) cho mỗi điểm ảnh
  // texture đúng 1 điểm ảnh trên màn hình (bảng phóng to k lần, canvas vẽ dày hơn res lần: game/hires.js) -> nét, không nhoè.
  // Cỡ nhân vật vì thế xê dịch chút ít quanh PX đơn vị bảng / pixel logic
  drawPreview() {
    if (!this.preview?.active) return;
    const { scene } = this;
    const res = scene.game.canvas.height / scene.scale.height || 1;
    const m = Math.max(1, Math.round((PX * this.k * res) / 2));
    const canvases = [];
    const names = [];
    for (const dir of DIRS) {
      for (const step of PLAYER_FRAMES) {
        const p = characterPixels(resolveLook(this.gender, this.custom), dir, step);
        const { canvas, ctx } = makeCanvas(p.w, p.h);
        p.data.forEach((col, i) => {
          if (!col) return;
          ctx.fillStyle = col;
          ctx.fillRect(i % p.w, Math.floor(i / p.w), 1, 1);
        });
        canvases.push(upscaleCanvas(scale2x(canvas), m));
        names.push(`${dir}-${step}`);
      }
    }
    addSheetTexture(scene, PREVIEW_KEY, canvases, names);
    // 1 điểm ảnh texture = 1 điểm ảnh màn hình: cao 24 pixel logic x 2m điểm ảnh, chia lại cho k x res
    this.preview.setTexture(PREVIEW_KEY).setScale(1 / (this.k * res));
    this.showFrame();
  }

  turn(delta, reset = true) {
    this.facing = (this.facing + delta + TURNS.length) % TURNS.length;
    if (reset) this.tick = 0;
    this.showFrame();
  }

  showFrame() {
    if (!this.preview?.active || !this.scene.textures.exists(PREVIEW_KEY)) return;
    const [dir, flip] = TURNS[this.facing];
    this.preview.setFrame(`${dir}-${WALK[this.tick % WALK.length]}`).setFlipX(flip);
  }

  selectRow(i) {
    this.row = i;
    const g = this.rowBg;
    g.clear();
    this.rows.forEach((r, j) => {
      const on = j + 1 === i;
      r.labelText.setColor(on ? TEXT.focus : TEXT.label);
      g.fillStyle(UI.box);
      g.fillRoundedRect(BOX_X, r.y - 12, BOX_W, 24, 5);
      g.lineStyle(on ? 2 : 1, on ? UI.focus : UI.boxLine);
      g.strokeRoundedRect(BOX_X, r.y - 12, BOX_W, 24, 5);
    });
    // Dòng giới tính đang chọn (bàn phím): vòng sáng quanh nút giới tính đang bật
    this.genderRing.clear();
    if (i === 0) {
      const b = this.genderBtns[this.gender];
      this.genderRing.lineStyle(2, 0xffd866);
      this.genderRing.strokeCircle(b.x, b.y, 17);
    }
  }

  change(i, delta) {
    if (i === 0) {
      const to = GENDER_IDS[(GENDER_IDS.indexOf(this.gender) + delta + GENDER_IDS.length) % GENDER_IDS.length];
      this.setGender(to);
      return;
    }
    this.selectRow(i);
    this.custom = stepOption(this.gender, this.custom, this.rows[i - 1].key, delta);
    this.refresh(true);
  }

  // Đổi giới tính: lựa chọn đang là mặc định thì theo mặc định của giới tính mới, đã tự chọn thì giữ (kiểu tóc mỗi giới
  // tính một danh sách riêng)
  setGender(to) {
    if (to === this.gender) return;
    this.custom = switchGender(this.gender, to, this.custom);
    this.gender = to;
    this.refresh(true);
    this.selectRow(this.row);
  }

  randomize() {
    this.custom = randomCustom(this.gender);
    this.refresh(true);
  }

  // Cập nhật chữ, ô màu từng dòng, nút giới tính và vẽ lại nhân vật xem trước
  refresh(bounce = false) {
    const cx = BOX_X + BOX_W / 2;
    for (const r of this.rows) {
      const info = optionInfo(r.key, this.custom[r.key]);
      r.value.setText(info.label).setScale(1);
      // Ô màu trước tên lựa chọn (trang phục: 2 nửa áo / quần, nữ thì áo / váy)
      const colors = r.key === 'outfit'
        ? [info.shirt, this.gender === 'female' ? info.skirt ?? info.pants : info.pants]
        : info.color ? [info.color] : [];
      const sw = colors.length ? 12 : 0;
      const gap = colors.length ? 6 : 0;
      const maxText = BOX_W - 12 - sw - gap;
      if (r.value.width > maxText) r.value.setScale(maxText / r.value.width);
      const total = sw + gap + r.value.displayWidth;
      const sx = cx - total / 2;
      r.value.setX(sx + sw + gap + r.value.displayWidth / 2);
      r.swatch.clear();
      if (colors.length) {
        r.swatch.fillStyle(0x8a8c9c);
        r.swatch.fillRoundedRect(sx - 1, r.y - 7, sw + 2, 14, 3);
        colors.forEach((col, k) => {
          r.swatch.fillStyle(parseInt(col.slice(1), 16));
          r.swatch.fillRect(sx + (k * sw) / colors.length, r.y - 6, sw / colors.length, 12);
        });
      }
    }
    for (const b of Object.values(this.genderBtns)) b.draw();
    this.drawPreview();
    if (bounce && this.preview) {
      this.scene.tweens.killTweensOf(this.preview);
      this.preview.y = FEET_Y + 1;
      this.scene.tweens.add({ targets: this.preview, y: FEET_Y - 5, duration: 90, yoyo: true, ease: 'Quad.out' });
    }
  }

  finish(result) {
    if (!this.resolve) return;
    const resolve = this.resolve;
    this.resolve = null;
    this.router.clear();
    this.timer?.remove();
    this.scene.scale.off('resize', this.onResize);
    this.scene.tweens.killTweensOf(this.preview);
    this.container.destroy();
    if (this.scene.textures.exists(PREVIEW_KEY)) this.scene.textures.remove(PREVIEW_KEY);
    resolve(result ? { ...result } : null);
  }
}
