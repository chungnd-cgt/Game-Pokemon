import { formatMoney } from '../data/items.js';
import { gameClock } from '../game/clock.js';
import { setSetting, settings } from '../game/settings.js';
import { itemCount, state } from '../game/state.js';
import { HUD_PHASE_ICON } from '../gfx/textures.js';
import { hudSize, textStyle } from './helpers.js';
import { CORNER, HOTBAR_RIGHT, MONEY_W, cornerSize } from './Hotbar.js';
import { InfoPanel } from './InfoPanel.js';
import { drawCardIcon } from './TrainerCard.js';

const DEPTH = 100;
const BTN = 46; // nút ≡ vuông cạnh thanh phím tắt (cùng cỡ ô phím tắt)
const ROUND = 22; // bán kính nút tròn trong cột menu
const STEP = 52; // khoảng cách giữa hai nút tròn
const DARK = 0x141a2c;
// Khung giờ góc phải trên: giờ máy (trên), giờ trong game (dưới), icon buổi trong ngày trong vòng tròn bên phải;
// tên bản đồ in ngay dưới khung
const CLOCK_W = 172;
const CLOCK_H = 50;
const CLOCK_TOP = 14;
const PHASE_R = 18; // bán kính vòng tròn đựng icon buổi
const CLOCK_ICON = 24;
const PHASE_RING = { day: 0xffd860, dusk: 0xff9a50, night: 0x9ab8ff };
// Khung nền góc trái dưới (bao cột nút tròn và hàng nút ≡ / tiền / phím tắt), chỗ nối uốn cong
const FRAME_FILL = 0x0b0e16; // nền đen đặc (không trong suốt) của khung góc trái dưới và khung giờ
const BLACK = 0x0b0e16;
const ARC = 34; // cột nút menu cong: nút dưới cùng lệch sang phải chừng này px so với nút trên cùng
const FRAME_EDGE = 0x3d4c72;
const NOTE_WRAP = 540; // dòng báo dài (vd gán phím tắt) xuống dòng ở chừng này px

// Biểu tượng vẽ bằng code cho các nút
function drawIcon(g, type, cx, cy) {
  if (type === 'menu') {
    // ≡ ba gạch
    g.fillStyle(0xffffff);
    for (const dy of [-8, 0, 8]) g.fillRoundedRect(cx - 11, cy + dy - 2, 22, 4, 2);
  } else if (type === 'party') {
    g.fillStyle(0xffffff);
    g.fillCircle(cx, cy, 12);
    g.fillStyle(0xe83838);
    g.slice(cx, cy, 12, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(DARK);
    g.fillRect(cx - 12, cy - 1.5, 24, 3);
    g.fillCircle(cx, cy, 4.5);
    g.fillStyle(0xffffff);
    g.fillCircle(cx, cy, 2.5);
  } else if (type === 'dex') {
    g.fillStyle(0xe03c3c);
    g.fillRoundedRect(cx - 10, cy - 13, 20, 26, 4);
    g.fillStyle(0xffffff);
    g.fillCircle(cx - 3, cy - 6, 5);
    g.fillStyle(0x58b8f8);
    g.fillCircle(cx - 3, cy - 6, 3.5);
    g.fillStyle(0xffe060);
    g.fillCircle(cx + 5, cy - 8, 2);
    g.fillStyle(0xa82828);
    g.fillRect(cx - 7, cy + 3, 14, 6);
  } else if (type === 'map') {
    g.fillStyle(0xf0e0b0);
    g.fillRect(cx - 12, cy - 10, 24, 20);
    g.fillStyle(0x6ab060);
    g.fillRect(cx - 10, cy - 8, 9, 7);
    g.fillRect(cx + 2, cy + 1, 8, 7);
    g.lineStyle(2, 0xe04848);
    g.lineBetween(cx - 8, cy + 6, cx + 6, cy - 6);
    g.fillStyle(0xe04848);
    g.fillCircle(cx + 6, cy - 6, 3);
  } else if (type === 'bag') {
    g.fillStyle(0xe8a030);
    g.fillRoundedRect(cx - 12, cy - 6, 24, 18, 5);
    g.fillStyle(0xc07818);
    g.fillRoundedRect(cx - 12, cy - 6, 24, 7, { tl: 5, tr: 5, bl: 0, br: 0 });
    g.lineStyle(3, 0xe8a030);
    g.strokeRoundedRect(cx - 6, cy - 13, 12, 9, 4);
    g.fillStyle(0xffffff);
    g.fillRect(cx - 2, cy - 1, 4, 4);
  } else if (type === 'trainer') {
    drawCardIcon(g, cx, cy, 0.85);
  } else if (type === 'settings') {
    g.fillStyle(0xffffff);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      g.fillCircle(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 4);
    }
    g.fillCircle(cx, cy, 11);
    g.fillStyle(DARK);
    g.fillCircle(cx, cy, 4.5);
  }
}

// Màu viền nút tròn theo chức năng
const RINGS = { party: 0xe85050, bag: 0xe8a030, dex: 0xd84848, trainer: 0x48b878, settings: 0x9aa4bc, map: 0x58b8f0 };
// Cột nút tròn bên trái (Đội hình mở bằng cột Pokémon góc trái trên nên không có nút riêng)
const MENU_ITEMS = [
  { id: 'bag', label: 'Túi đồ' },
  { id: 'dex', label: 'Pokédex' },
  { id: 'trainer', label: 'Thẻ HLV' },
  { id: 'settings', label: 'Cài đặt' },
].map((item) => ({ ...item, ring: RINGS[item.id] }));

// Biểu tượng tròn giống nút ở cột nút bên trái (nền tối, viền màu theo chức năng), vd khi nhận Pokédex hiện trên đầu
export function drawRoundIcon(g, type, cx, cy) {
  const ring = RINGS[type] ?? 0xffd860;
  g.fillStyle(0x000000, 0.3);
  g.fillCircle(cx + 1, cy + 3, ROUND);
  g.fillStyle(DARK, 0.95);
  g.fillCircle(cx, cy, ROUND);
  g.lineStyle(3, ring, 0.9);
  g.strokeCircle(cx, cy, ROUND - 1.5);
  g.lineStyle(1, 0xffffff, 0.25);
  g.strokeCircle(cx, cy, ROUND - 5);
  drawIcon(g, type, cx, cy);
}

// Giao diện trên bản đồ: giờ & tên bản đồ (trên phải; bảng Pokémon trong khu ngay dưới, ui/AreaNav.js), cột đội hình
// (trên trái, ui/PartyPanel.js), cột nút tròn có nhãn bên trái ngay trên thanh phím tắt (Túi đồ / Pokédex / Thẻ HLV /
// Cài đặt; Phím tắt nằm trong Cài đặt), nút ≡ cạnh thanh phím tắt ẩn / hiện cột nút, nút Bản đồ vùng tròn ngay bên trái
// khung giờ (chỉ hiện khi đã nhận Bản đồ vùng từ mẹ), khung góc phải dưới
// có 2 tab Hệ thống / Nhiệm vụ (ui/InfoPanel.js; bấm tab đang chọn để thu gọn / mở ra).
// Cỡ giao diện (helpers.js hudScale): mọi phần nằm trong một container root, xếp theo cỡ ảo (hudSize) rồi phóng to theo
// hệ số. Hệ số đổi thì WorldScene huỷ (destroy) và tạo lại. Riêng cột nút tròn (menuRoot) giữ cỡ 100% (phóng to thì đè lên
// cột đội hình), chỉ dời theo hàng nút ≡ / thanh phím tắt đã phóng to
// actions: { bag, dex, trainer, settings, map } – hàm gọi khi bấm nút
export class WorldHud {
  constructor(scene, actions) {
    this.scene = scene;
    this.actions = actions;
    const { width, height, s } = hudSize(scene);
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH).setScale(s);
    const fixed = (o) => {
      o.setScrollFactor(0);
      this.root.add(o);
      return o;
    };
    this.fixed = fixed;
    // Cụm góc trái dưới nhỏ hơn (Hotbar.js: CORNER), neo góc trái dưới: nút ≡ và ô tiền trong cornerRoot (toạ độ ảo
    // cornerSize); cột nút tròn và khung nền co CORNER lần (toạ độ = toạ độ màn hình / CORNER)
    const cs = cornerSize(scene);
    this.cornerRoot = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH).setScale(cs.s);
    this.cornerFixed = (o) => {
      o.setScrollFactor(0);
      this.cornerRoot.add(o);
      return o;
    };
    this.menuRoot = scene.add.container(0, 0).setScrollFactor(0).setDepth(DEPTH).setScale(CORNER);
    this.menuFixed = (o) => {
      o.setScrollFactor(0);
      this.menuRoot.add(o);
      return o;
    };

    // Khung góc phải dưới: tab Hệ thống (nhật ký thông báo) / Nhiệm vụ (ui/InfoPanel.js)
    this.info = new InfoPanel(scene, fixed);

    // Khung giờ góc phải trên: "Giờ máy" / "Giờ game" (nhãn mờ bên trái, giờ bên phải), icon buổi (mặt trời vàng / mặt trời
    // lặn cam / trăng khuyết) trong vòng tròn viền theo màu buổi; tên bản đồ ngay dưới khung
    this.clockBg = fixed(scene.add.graphics());
    const label = (text) => fixed(scene.add.text(0, 0, text, textStyle(12, '#9aa6c4', { fontStyle: 'bold' })).setOrigin(0, 0.5));
    const value = () => fixed(scene.add.text(0, 0, '', textStyle(16, '#ffffff', { fontStyle: 'bold' })).setOrigin(1, 0.5));
    this.localLabel = label('Giờ máy');
    this.gameLabel = label('Giờ game');
    this.localTime = value();
    this.gameTime = value();
    this.clockIcon = fixed(scene.add.image(0, 0, HUD_PHASE_ICON.day).setDisplaySize(CLOCK_ICON, CLOCK_ICON));
    this.mapName = fixed(scene.add.text(0, 0, '', textStyle(15, '#ffffff', {
      fontStyle: 'bold', stroke: '#0c1020', strokeThickness: 4,
    })).setOrigin(1, 0));
    this.clockParts = [this.clockBg, this.localLabel, this.gameLabel, this.localTime, this.gameTime, this.clockIcon, this.mapName];
    this.phase = 'day';
    // Nút Bản đồ vùng (tròn, bên trái khung giờ): ẩn tới khi nhận Bản đồ vùng
    this.mapBtn = { g: fixed(scene.add.graphics()), zone: fixed(scene.add.zone(0, 0, ROUND * 2 + 4, ROUND * 2 + 4)), hover: false };
    this.mapBtn.zone.on('pointerover', () => this.drawMapButton(true));
    this.mapBtn.zone.on('pointerout', () => this.drawMapButton(false));
    this.mapBtn.zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.actions.map?.();
    });
    this.hasMap = null;
    this.layoutClock();
    this.applyMapButton();

    // Khung nền góc trái dưới (dưới cột nút và hàng nút ≡ / tiền / phím tắt): toạ độ màn hình, vẽ lại khi bố trí lại
    this.frame = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH - 1).setScale(CORNER);

    // Báo đã lưu / đã gán phím tắt: chỗ trống giữa thanh phím tắt và khung nhiệm vụ (xem showSaveNote).
    // Nằm trên các menu, túi đồ (đang kéo đồ vào ô phím tắt vẫn thấy): ngoài root, toạ độ màn hình
    this.saveNote = scene.add.text((width / 2 + 60) * s, (height - 16) * s, 'Đã lưu game', textStyle(16, '#ffffff', {
      backgroundColor: 'rgba(30,110,70,0.85)', padding: { x: 12, y: 5 }, align: 'center',
    })).setOrigin(0.5, 1).setScale(s).setScrollFactor(0).setAlpha(0).setDepth(DEPTH + 15);

    // Nút ≡ cạnh thanh phím tắt: ẩn / hiện cột nút tròn
    this.expanded = settings.hudMenuOpen !== false;
    this.toggleBtn = this.makeSquareButton(16, cs.height - 16 - BTN, () => this.toggleMenu());
    // Ô tiền giữa nút ≡ và thanh phím tắt (như game MMO): icon đồng ₽ + số tiền, cập nhật mỗi khi tiền đổi
    const mx = 16 + BTN + 8;
    const my = cs.height - 16 - BTN;
    this.moneyBg = this.cornerFixed(scene.add.graphics());
    this.moneyBg.fillStyle(DARK, 0.8);
    this.moneyBg.fillRoundedRect(mx, my + 8, MONEY_W, BTN - 16, 10);
    this.moneyBg.lineStyle(2, 0xffffff, 0.18);
    this.moneyBg.strokeRoundedRect(mx + 1, my + 9, MONEY_W - 2, BTN - 18, 9);
    this.moneyBg.fillStyle(0xe8b830);
    this.moneyBg.fillCircle(mx + 18, my + BTN / 2, 9);
    this.moneyBg.fillStyle(0xf8e080);
    this.moneyBg.fillCircle(mx + 17, my + BTN / 2 - 1, 6);
    this.moneyCoin = this.cornerFixed(scene.add.text(mx + 18, my + BTN / 2, '₽', textStyle(11, '#7a5010', { fontStyle: 'bold' })).setOrigin(0.5));
    this.moneyText = this.cornerFixed(scene.add.text(mx + 32, my + BTN / 2, '', textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5));
    this.moneyShown = null;
    this.buttons = MENU_ITEMS.map((item) => this.makeRoundButton(item, () => this.actions[item.id]?.()));
    this.layoutMenu();
    this.toggleMenu(this.expanded, false);
  }

  makeSquareButton(x, y, onClick) {
    const { scene } = this;
    const g = this.cornerFixed(scene.add.graphics());
    const draw = (hover) => {
      g.clear();
      g.fillStyle(DARK, hover ? 0.95 : 0.8);
      g.fillRoundedRect(x, y, BTN, BTN, 10);
      g.lineStyle(2, this.expanded ? 0xffd860 : 0xffffff, hover || this.expanded ? 0.7 : 0.22);
      g.strokeRoundedRect(x + 1, y + 1, BTN - 2, BTN - 2, 9);
      drawIcon(g, 'menu', x + BTN / 2, y + BTN / 2);
    };
    const zone = this.cornerFixed(scene.add.zone(x + BTN / 2, y + BTN / 2, BTN, BTN)).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      onClick();
    });
    draw(false);
    return { g, zone, draw };
  }

  // Nút tròn có biểu tượng, nhãn tên dạng viên thuốc chìa sang phải
  makeRoundButton(item, onClick) {
    const { scene } = this;
    const g = this.menuFixed(scene.add.graphics());
    const label = this.menuFixed(scene.add.text(0, 0, item.label, textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5));
    const btn = { item, g, label, zone: null, cx: 0, cy: 0, hover: false };
    btn.draw = (hover = btn.hover) => {
      btn.hover = hover;
      const { cx, cy } = btn;
      const pillW = ROUND + 10 + label.width + 14;
      g.clear();
      // Viên nhãn phía sau nút tròn (đen đặc, thò ra ngoài khung cột)
      g.fillStyle(hover ? 0x1c2338 : BLACK, 1);
      g.fillRoundedRect(cx, cy - 13, pillW, 26, 13);
      g.lineStyle(1.5, FRAME_EDGE, 0.85);
      g.strokeRoundedRect(cx + 0.5, cy - 12.5, pillW - 1, 25, 12.5);
      // Nút tròn: bóng đổ, nền tối, viền màu theo chức năng
      g.fillStyle(0x000000, 0.3);
      g.fillCircle(cx + 1, cy + 3, ROUND);
      g.fillStyle(hover ? 0x26304c : DARK, 0.95);
      g.fillCircle(cx, cy, ROUND);
      g.lineStyle(3, item.ring, hover ? 1 : 0.85);
      g.strokeCircle(cx, cy, ROUND - 1.5);
      g.lineStyle(1, 0xffffff, 0.25);
      g.strokeCircle(cx, cy, ROUND - 5);
      drawIcon(g, item.id, cx, cy);
      label.setPosition(cx + ROUND + 10, cy);
      const w = pillW + ROUND;
      if (!btn.zone) {
        btn.zone = this.menuFixed(scene.add.zone(cx - ROUND + w / 2, cy, w, ROUND * 2)).setInteractive({ useHandCursor: true });
        btn.zone.on('pointerover', () => btn.draw(true));
        btn.zone.on('pointerout', () => btn.draw(false));
        btn.zone.on('pointerdown', (p, lx, ly, e) => {
          e?.stopPropagation();
          onClick();
        });
      } else {
        btn.zone.setPosition(cx - ROUND + w / 2, cy);
      }
    };
    return btn;
  }

  // Màn hình đổi cỡ (chỉ đổi chiều ngang, game luôn cao 720): dời các phần bám mép phải
  relayout() {
    const { width, height, s } = hudSize(this.scene);
    this.layoutClock();
    this.saveNote.setPosition((width / 2 + 60) * s, (height - 16) * s);
    this.drawQuest();
    this.drawFrame();
  }

  // Khung giờ góc phải trên (toạ độ ảo)
  layoutClock() {
    const { width } = hudSize(this.scene);
    const x = width - 16 - CLOCK_W;
    const y = CLOCK_TOP;
    const cx = x + CLOCK_W - 8 - PHASE_R; // tâm vòng tròn buổi
    const cy = y + CLOCK_H / 2;
    const g = this.clockBg.clear();
    g.fillStyle(BLACK, 1);
    g.fillRoundedRect(x, y, CLOCK_W, CLOCK_H, 10);
    g.lineStyle(2, FRAME_EDGE, 0.9);
    g.strokeRoundedRect(x + 1, y + 1, CLOCK_W - 2, CLOCK_H - 2, 9);
    g.fillStyle(0x0c1020, 0.9);
    g.fillCircle(cx, cy, PHASE_R);
    g.lineStyle(3, PHASE_RING[this.phase] ?? PHASE_RING.day);
    g.strokeCircle(cx, cy, PHASE_R);
    const right = cx - PHASE_R - 8;
    this.localLabel.setPosition(x + 12, y + 15);
    this.gameLabel.setPosition(x + 12, y + 35);
    this.localTime.setPosition(right, y + 15);
    this.gameTime.setPosition(right, y + 35);
    this.clockIcon.setPosition(cx, cy);
    this.mapName.setPosition(width - 18, y + CLOCK_H + 4);
    this.mapBtn.cx = x - 10 - ROUND;
    this.mapBtn.cy = cy;
    this.mapBtn.zone.setPosition(this.mapBtn.cx, cy);
    this.drawMapButton();
  }

  drawMapButton(hover = this.mapBtn.hover) {
    const b = this.mapBtn;
    b.hover = hover;
    b.g.clear();
    drawRoundIcon(b.g, 'map', b.cx, b.cy);
    if (hover) {
      b.g.lineStyle(2, 0xffffff, 0.6);
      b.g.strokeCircle(b.cx, b.cy, ROUND + 1);
    }
  }

  // Hiện nút Bản đồ vùng khi đã có Bản đồ vùng và giao diện đang hiện
  applyMapButton() {
    const show = Boolean(this.hasMap) && this.visible !== false;
    this.mapBtn.g.setVisible(show);
    this.mapBtn.zone.setVisible(show);
    if (show) this.mapBtn.zone.setInteractive({ useHandCursor: true });
    else {
      this.mapBtn.zone.disableInteractive();
      if (this.mapBtn.hover) this.drawMapButton(false);
    }
  }

  // Khung nền góc trái dưới (toạ độ màn hình): hàng dưới bao nút ≡, ô tiền, thanh phím tắt; cột nút đang hiện thì nối thêm
  // phần đứng bao cột nút, chỗ nối với hàng dưới uốn cong mềm (bo lõm)
  drawFrame() {
    const g = this.frame.clear();
    if (this.visible === false) return;
    const { scene } = this;
    const { s } = hudSize(scene);
    const H = scene.scale.height / CORNER; // khung co CORNER lần quanh góc trên trái: toạ độ trong khung
    const L = 6 * s;
    const B = H - 5 * s;
    const barTop = H - (16 + BTN + 9) * s;
    const barRight = (HOTBAR_RIGHT + 9) * s;
    const r = 12 * s;
    g.fillStyle(FRAME_FILL, 1);
    g.lineStyle(2, FRAME_EDGE, 0.85);
    g.beginPath();
    if (this.expanded && this.buttons?.length) {
      // Khung cột hẹp, chỉ ôm các nút tròn (nhãn chữ thò ra ngoài khung), mép phải cong theo cột nút
      const f = 16 * s; // bán kính chỗ uốn cong giữa cột và hàng dưới
      const top = Math.min(...this.buttons.map((b) => b.cy)) - ROUND - 10;
      const edge = (y) => this.columnX(y) + ROUND + 9;
      const right0 = edge(top);
      g.moveTo(L + r, top);
      g.lineTo(right0 - r, top);
      g.arc(right0 - r, top + r, r, -Math.PI / 2, 0);
      const yEnd = barTop - f;
      for (let i = 1; i <= 16; i++) {
        const y = top + r + ((yEnd - top - r) * i) / 16;
        g.lineTo(edge(y), y);
      }
      const colRight = edge(yEnd);
      g.arc(colRight + f, barTop - f, f, Math.PI, Math.PI / 2, true);
      g.lineTo(barRight - r, barTop);
      g.arc(barRight - r, barTop + r, r, -Math.PI / 2, 0);
      g.lineTo(barRight, B - r);
      g.arc(barRight - r, B - r, r, 0, Math.PI / 2);
      g.lineTo(L + r, B);
      g.arc(L + r, B - r, r, Math.PI / 2, Math.PI);
      g.lineTo(L, top + r);
      g.arc(L + r, top + r, r, Math.PI, Math.PI * 1.5);
    } else {
      g.moveTo(L + r, barTop);
      g.lineTo(barRight - r, barTop);
      g.arc(barRight - r, barTop + r, r, -Math.PI / 2, 0);
      g.lineTo(barRight, B - r);
      g.arc(barRight - r, B - r, r, 0, Math.PI / 2);
      g.lineTo(L + r, B);
      g.arc(L + r, B - r, r, Math.PI / 2, Math.PI);
      g.lineTo(L, barTop + r);
      g.arc(L + r, barTop + r, r, Math.PI, Math.PI * 1.5);
    }
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  // Tâm x của cột nút tại độ cao y: cột cong (nút càng xuống dưới càng lệch phải, như cung tròn quanh góc trái dưới)
  columnX(y) {
    const ys = this.buttons.map((b) => b.cy);
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    const t = y1 > y0 ? Math.max(0, Math.min(1.25, (y - y0) / (y1 - y0))) : 0;
    return 16 + ROUND + ARC * t * t;
  }

  // Xếp cột nút tròn ngay trên nút ≡ / thanh phím tắt theo đường cong (toạ độ màn hình: cột không phóng to, hàng nút ≡ thì
  // có)
  layoutMenu() {
    const { s } = hudSize(this.scene);
    const bottom = this.scene.scale.height / CORNER - (16 + BTN + 12) * s - ROUND;
    this.buttons.forEach((b, i) => {
      b.cy = bottom - (this.buttons.length - 1 - i) * STEP;
    });
    for (const b of this.buttons) {
      b.cx = this.columnX(b.cy);
      b.draw();
    }
  }

  // Huỷ hết (đổi cỡ giao diện: WorldScene tạo lại)
  destroy() {
    this.info.destroy();
    this.frame.destroy();
    this.root.destroy();
    this.cornerRoot.destroy();
    this.menuRoot.destroy();
    this.saveNote.destroy();
    this.mapBanner?.destroy();
  }

  toggleMenu(open = !this.expanded, remember = true) {
    this.expanded = open;
    if (remember) setSetting('hudMenuOpen', open);
    this.toggleBtn.draw(false);
    this.applyMenuVisibility();
    this.drawFrame();
  }

  applyMenuVisibility() {
    const show = this.expanded && this.visible !== false;
    for (const b of this.buttons) {
      for (const o of [b.g, b.label, b.zone]) o.setVisible(show);
      if (show) b.zone.setInteractive();
      else {
        b.zone.disableInteractive();
        // Bấm nút mở menu: nút bị ẩn khi chuột vẫn nằm trên nó, hiện lại thì không còn sáng
        if (b.hover) b.draw(false);
      }
    }
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    if (!visible) this.toggleBtn.draw(false);
    for (const o of [...this.clockParts, this.toggleBtn.g, this.moneyBg, this.moneyCoin, this.moneyText]) o.setVisible(visible);
    if (visible) this.toggleBtn.zone.setInteractive();
    else this.toggleBtn.zone.disableInteractive();
    this.info.setVisible(visible);
    this.applyMapButton();
    this.applyMenuVisibility();
    this.drawFrame();
  }

  // mapName: tên bản đồ • phase: 'day' | 'dusk' | 'night' (icon và màu vòng tròn buổi)
  update(objective, mapName, phase = 'day') {
    this.info.setQuest(objective);
    const hasMap = itemCount('townMap') > 0;
    if (hasMap !== this.hasMap) {
      this.hasMap = hasMap;
      this.applyMapButton();
    }
    const now = new Date();
    const local = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (local !== this.localTime.text) this.localTime.setText(local);
    const game = gameClock(now).time;
    if (game !== this.gameTime.text) this.gameTime.setText(game);
    if (mapName !== this.mapName.text) this.mapName.setText(mapName);
    if (phase !== this.phase) {
      this.phase = phase;
      this.layoutClock();
    }
    if (state.money !== this.moneyShown) {
      this.moneyShown = state.money;
      this.moneyText.setText(formatMoney(state.money).replace('₽', ''));
      // Số lớn thì thu nhỏ chữ cho vừa ô
      this.moneyText.setScale(1);
      const room = MONEY_W - 32 - 8;
      if (this.moneyText.width > room) this.moneyText.setScale(room / this.moneyText.width);
    }
    const icon = HUD_PHASE_ICON[phase] ?? HUD_PHASE_ICON.day;
    if (this.clockIcon.texture.key !== icon) this.clockIcon.setTexture(icon).setDisplaySize(CLOCK_ICON, CLOCK_ICON);
  }

  // Vẽ lại khung góc phải dưới (đổi cỡ màn hình)
  drawQuest() {
    this.info.layout();
  }

  // Chỗ khung góc phải dưới (toạ độ ảo): dòng báo đã lưu, khung xem nhanh Pokémon gửi PC đặt tránh / ngay trên khung này
  get questRect() {
    return this.info.rect;
  }

  // Tên địa điểm trượt xuống ở giữa phía trên khi vừa tới nơi mới
  showMapName(name) {
    const { scene } = this;
    this.mapBanner?.destroy();
    const { s } = hudSize(scene);
    const t = scene.add
      .text(scene.scale.width / 2, -50 * s, name, textStyle(22, '#ffffff', { fontStyle: 'bold', backgroundColor: 'rgba(20,26,44,0.85)', padding: { x: 20, y: 9 } }))
      .setOrigin(0.5, 0)
      .setScale(s)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    this.mapBanner = t;
    scene.tweens.add({ targets: t, y: 24 * s, duration: 300, ease: 'Back.out' });
    scene.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => t.destroy() });
  }

  // warn: báo lỗi lưu (nền đỏ, hiện lâu hơn). Chữ ngắn: nằm giữa chỗ trống giữa thanh phím tắt và khung nhiệm vụ (khung
  // nhiệm vụ ẩn khi đang mở túi đồ thì chỗ trống rộng tới mép phải), dài thì xuống dòng; vẫn không vừa (quá 2 dòng) thì
  // nằm giữa màn hình, ngay trên hàng phím tắt / khung nhiệm vụ
  showSaveNote(text = 'Đã lưu game', warn = false) {
    const { scene } = this;
    const { width, height, s } = hudSize(scene); // tính theo toạ độ ảo, đặt chỗ thì nhân hệ số
    const note = this.saveNote;
    scene.tweens.killTweensOf(note);
    note.setText(text).setBackgroundColor(warn ? 'rgba(170,50,50,0.9)' : 'rgba(30,110,70,0.85)').setAlpha(1);
    const quest = this.visible !== false ? this.questRect : null;
    const left = HOTBAR_RIGHT + 12;
    const right = (quest ? quest.x : width - 16) - 12;
    note.setWordWrapWidth(Math.max(120, right - left - 24), true);
    const lines = note.getWrappedText(text).length;
    if (lines <= 2) {
      note.setPosition(((left + right) / 2) * s, (height - 16) * s);
    } else {
      note.setWordWrapWidth(NOTE_WRAP, true);
      const top = Math.min(height - 16 - 46, quest ? quest.y : height);
      note.setPosition((width / 2) * s, (top - 10) * s);
    }
    scene.tweens.add({ targets: note, alpha: 0, delay: warn ? 6000 : Math.max(1200, text.length * 45), duration: 400 });
  }
}
