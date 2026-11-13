import {
  CUSTOM_ROWS, GENDERS, normalizeCustom, optionIds, optionInfo, randomCustom, resolveLook, stepOption, switchGender,
} from '../data/playerCustom.js';
import { makeCharacterTexture } from '../gfx/player.js';
import { COLORS, closeButton, drawPanel, fixToCamera, shade, textStyle } from './helpers.js';
import { directionOf, isCancel, isConfirm } from './input.js';

// Bảng "Bạn trông thế nào?": chọn giới tính, tuỳ chỉnh kiểu tóc, màu tóc, màu da, trang phục, màu mắt của người chơi.
// Bên trái là nhân vật xem trước (phóng to, vừa đi vừa xoay các hướng) đứng trên bục cạnh Giáo sư Oak.
// Chuột: bấm ◀ ▶ ở mỗi dòng • Phím: ↑/↓ chọn dòng, ←/→ đổi, R ngẫu nhiên, Enter xong, X / Esc quay lại.
// Dùng ở màn hình chính (chơi mới) và trong game (Cài đặt > Đổi diện mạo, opts.fixed = true để ghim vào màn hình).
// open() trả về { gender, hairStyle, hair, skin, outfit, eyes }, hoặc null nếu quay lại (lựa chọn dở dang: creator.value).

// Dòng đầu là giới tính, sau đó là các dòng diện mạo
const ROWS = [{ key: 'gender', label: 'Giới tính' }, ...CUSTOM_ROWS];
const GENDER_IDS = Object.keys(GENDERS);
const GENDER_COLOR = { male: '#2a6ad0', female: '#d84880' };

const PREVIEW_KEY = 'player-custom-preview';
const ROW_Y = 160; // tâm dòng đầu tiên
const ROW_H = 60;
const COL_LABEL = 486;
const ARROW_L = 618;
const ARROW_R = 846;
const VALUE_X = (ARROW_L + ARROW_R) / 2;
// Nhân vật xem trước đi vòng các hướng: xuống, sang trái, lên, sang phải (side lật ngang)
const TURNS = [['down', false], ['side', false], ['up', false], ['side', true]];
const WALK = ['left', 'stand', 'right', 'stand'];

export class CharacterCreator {
  // opts: { gender, look (diện mạo ban đầu; không có thì mặc định của giới tính), depth, fixed (ghim vào màn hình khi camera trôi),
  //         title, okLabel }
  constructor(scene, router, opts = {}) {
    this.scene = scene;
    this.router = router;
    this.gender = opts.gender === 'female' ? 'female' : 'male';
    this.custom = normalizeCustom(this.gender, opts.look);
    this.row = 0;
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

  build() {
    const { scene } = this;
    const c = scene.add.container(0, 0).setDepth(this.opts.depth ?? 30);
    this.container = c;
    c.add(scene.add.rectangle(480, 360, 960, 720, 0x0a1430, 0.75).setInteractive()); // chặn bấm xuyên xuống dưới
    c.add(drawPanel(scene, 70, 60, 820, 600, 18, true));
    c.add(scene.add.text(480, 86, this.opts.title ?? 'Bạn trông thế nào?', textStyle(28, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5, 0));
    c.add(closeButton(scene, 856, 98, () => this.finish(null)));

    this.buildStage(c);

    // Các dòng tuỳ chỉnh
    this.rowBg = scene.add.graphics();
    c.add(this.rowBg);
    this.rows = ROWS.map(({ key, label }, i) => {
      const y = ROW_Y + i * ROW_H;
      const labelText = scene.add.text(COL_LABEL, y, label, textStyle(20, COLORS.text, { fontStyle: 'bold' })).setOrigin(0, 0.5);
      const swatch = scene.add.graphics();
      // Tên lựa chọn hơi nhích lên, dòng "1/8" bên dưới nằm gọn trong khung dòng đang chọn (không đè lên viền)
      const value = scene.add.text(VALUE_X, y - 5, '', textStyle(19, COLORS.text)).setOrigin(0.5);
      const count = scene.add.text(VALUE_X, y + 15, '', textStyle(12, '#8a92a6')).setOrigin(0.5);
      const rowZone = scene.add.zone(660, y, 380, ROW_H - 6).setInteractive();
      rowZone.on('pointerover', () => this.selectRow(i));
      c.add([labelText, swatch, value, count, rowZone]);
      c.add(this.arrow(ARROW_L, y, -1, () => this.change(i, -1)));
      c.add(this.arrow(ARROW_R, y, 1, () => this.change(i, 1)));
      return { key, y, labelText, swatch, value, count };
    });

    // Nút Ngẫu nhiên và OK
    const by = ROW_Y + ROWS.length * ROW_H + 6;
    c.add(this.button(580, by, 190, 'Ngẫu nhiên', 0x7a62c8, () => this.randomize()));
    c.add(this.button(782, by, 150, this.opts.okLabel ?? 'OK', 0x40b060, () => this.finish(this.value)));

    this.refresh();
    this.selectRow(0);
    if (this.opts.fixed) fixToCamera(c);

    this.router.set((e) => {
      const dir = directionOf(e);
      if (dir === 'up' || dir === 'down') this.selectRow((this.row + (dir === 'up' ? -1 : 1) + this.rows.length) % this.rows.length);
      else if (dir === 'left' || dir === 'right') this.change(this.row, dir === 'left' ? -1 : 1);
      else if (e.code === 'KeyR' && !e.repeat) this.randomize();
      else if (isConfirm(e)) this.finish(this.value);
      else if (isCancel(e)) this.finish(null);
    });
  }

  // Sân khấu bên trái: nền trời, Giáo sư Oak đứng cạnh, nhân vật trên bục tròn
  buildStage(c) {
    const { scene } = this;
    const g = scene.add.graphics();
    g.fillStyle(0xc8dcf8);
    g.fillRoundedRect(98, 132, 352, 470, 16);
    g.fillStyle(0xa8d088);
    g.fillRoundedRect(98, 452, 352, 150, { tl: 0, tr: 0, bl: 16, br: 16 });
    g.fillStyle(0x90bc72);
    g.fillRect(98, 452, 352, 6);
    // bục tròn dưới chân nhân vật
    g.fillStyle(0x6a7a96);
    g.fillEllipse(330, 548, 150, 44);
    g.fillStyle(0xe8ecf4);
    g.fillEllipse(330, 540, 150, 40);
    g.fillStyle(0xf8fafe);
    g.fillEllipse(326, 537, 116, 26);
    g.lineStyle(2, 0xb8c2d6);
    g.strokeEllipse(330, 540, 150, 40);
    c.add(g);

    // Giáo sư Oak đứng bên trái, tách hẳn khỏi nhân vật (không bị che)
    if (scene.textures.exists('npc-oak')) {
      c.add(scene.add.ellipse(178, 512, 76, 16, 0x000000, 0.18));
      c.add(scene.add.image(178, 514, 'npc-oak', 'side-stand').setOrigin(0.5, 1).setScale(2.2).setFlipX(true));
    }
    makeCharacterTexture(scene, PREVIEW_KEY, resolveLook(this.gender, this.custom));
    c.add(scene.add.ellipse(330, 540, 84, 16, 0x000000, 0.18));
    this.preview = scene.add.image(330, 544, PREVIEW_KEY, 'down-stand').setOrigin(0.5, 1).setScale(2.8);
    c.add(this.preview);
    // Bấm vào nhân vật: xoay sang hướng tiếp theo
    const zone = scene.add.zone(330, 440, 150, 220).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.turn(1));
    c.add(zone);

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

  turn(delta, reset = true) {
    this.facing = (this.facing + delta + TURNS.length) % TURNS.length;
    if (reset) this.tick = 0;
    this.showFrame();
  }

  showFrame() {
    const [dir, flip] = TURNS[this.facing];
    this.preview.setFrame(`${dir}-${WALK[this.tick % WALK.length]}`).setFlipX(flip);
  }

  arrow(x, y, d, onClick) {
    const { scene } = this;
    const g = scene.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(0x000000, 0.2);
      g.fillCircle(x + 1, y + 3, 17);
      g.fillStyle(hover ? 0x4a88e0 : 0x3a4660);
      g.fillCircle(x, y, 17);
      g.fillStyle(0xffffff);
      g.fillTriangle(x + d * 7, y, x - d * 5, y - 8, x - d * 5, y + 8);
    };
    draw(false);
    const zone = scene.add.zone(x, y, 42, 42).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);
    return [g, zone];
  }

  button(x, y, w, label, color, onClick) {
    const { scene } = this;
    const g = scene.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(0x000000, 0.22);
      g.fillRoundedRect(x - w / 2 + 2, y - 25 + 4, w, 50, 14);
      g.fillStyle(hover ? shade(color, 10) : color);
      g.fillRoundedRect(x - w / 2, y - 25, w, 50, 14);
    };
    draw(false);
    const t = scene.add.text(x, y, label, textStyle(22, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    const zone = scene.add.zone(x, y, w, 50).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);
    return [g, t, zone];
  }

  selectRow(i) {
    this.row = i;
    const g = this.rowBg;
    g.clear();
    const { y } = this.rows[i];
    g.fillStyle(0xdde8ff);
    g.fillRoundedRect(470, y - ROW_H / 2 + 4, 400, ROW_H - 8, 14);
    g.lineStyle(3, 0x4a88e0);
    g.strokeRoundedRect(470, y - ROW_H / 2 + 4, 400, ROW_H - 8, 14);
    this.rows.forEach((r, j) => r.labelText.setColor(j === i ? '#2a5ab0' : COLORS.text));
  }

  change(i, delta) {
    this.selectRow(i);
    const { key } = this.rows[i];
    if (key === 'gender') {
      // Đổi giới tính: lựa chọn đang là mặc định thì theo mặc định của giới tính mới, đã tự chọn thì giữ
      const to = GENDER_IDS[(GENDER_IDS.indexOf(this.gender) + delta + GENDER_IDS.length) % GENDER_IDS.length];
      this.custom = switchGender(this.gender, to, this.custom);
      this.gender = to;
    } else {
      this.custom = stepOption(this.gender, this.custom, key, delta);
    }
    this.refresh(true);
  }

  randomize() {
    this.custom = randomCustom(this.gender);
    this.refresh(true);
  }

  // Cập nhật chữ, ô màu từng dòng và vẽ lại nhân vật xem trước
  refresh(bounce = false) {
    for (const r of this.rows) {
      const gender = r.key === 'gender';
      const id = gender ? this.gender : this.custom[r.key];
      const info = gender ? GENDERS[id] : optionInfo(r.key, id);
      const ids = gender ? GENDER_IDS : optionIds(r.key, this.gender);
      r.value.setText(gender ? `${info.label} ${id === 'male' ? '♂' : '♀'}` : info.label);
      r.value.setColor(gender ? GENDER_COLOR[id] : COLORS.text);
      r.count.setText(`${ids.indexOf(id) + 1}/${ids.length}`);
      // Ô màu trước tên lựa chọn (trang phục: 3 sọc mũ / áo / quần)
      // (áo ba lỗ: áo / quần short)
      const outfit = r.key === 'outfit' ? (info.style === 'tank' ? [info.shirt, info.pants] : [info.hat, info.shirt, info.pants]) : null;
      const colors = outfit ?? (info.color ? [info.color] : []);
      r.swatch.clear();
      if (colors.length) {
        const w = 24;
        const total = w + 8 + r.value.width;
        const sx = VALUE_X - total / 2;
        r.value.setX(sx + w + 8 + r.value.width / 2);
        r.count.setX(r.value.x);
        r.swatch.fillStyle(0x3a4660);
        r.swatch.fillRoundedRect(sx - 2, r.y - 18, w + 4, 26, 7);
        const sw = w / colors.length;
        colors.forEach((col, k) => {
          r.swatch.fillStyle(parseInt(col.slice(1), 16));
          r.swatch.fillRect(sx + k * sw, r.y - 16, sw, 22);
        });
      } else {
        r.value.setX(VALUE_X);
        r.count.setX(VALUE_X);
      }
    }
    makeCharacterTexture(this.scene, PREVIEW_KEY, resolveLook(this.gender, this.custom));
    if (bounce && this.preview) {
      this.scene.tweens.killTweensOf(this.preview);
      this.preview.y = 544;
      this.scene.tweens.add({ targets: this.preview, y: 532, duration: 90, yoyo: true, ease: 'Quad.out' });
    }
  }

  finish(result) {
    if (!this.resolve) return;
    const resolve = this.resolve;
    this.resolve = null;
    this.router.clear();
    this.timer?.remove();
    this.scene.tweens.killTweensOf(this.preview);
    this.container.destroy();
    if (this.scene.textures.exists(PREVIEW_KEY)) this.scene.textures.remove(PREVIEW_KEY);
    resolve(result ? { ...result } : null);
  }
}
