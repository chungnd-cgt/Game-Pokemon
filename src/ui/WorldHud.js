import { formatMoney } from '../data/items.js';
import { setSetting, settings } from '../game/settings.js';
import { state } from '../game/state.js';
import { HUD_PHASE_ICON } from '../gfx/textures.js';
import { COLORS, closeButton, drawPanel, textStyle } from './helpers.js';
import { HOTBAR_RIGHT, MONEY_W } from './Hotbar.js';
import { drawCardIcon } from './TrainerCard.js';
import { isCancel, isConfirm } from './input.js';

const DEPTH = 100;
const BTN = 46; // nút ≡ vuông cạnh thanh phím tắt (cùng cỡ ô phím tắt)
const ROUND = 22; // bán kính nút tròn trong cột menu
const STEP = 52; // khoảng cách giữa hai nút tròn
const DARK = 0x141a2c;
const CLOCK_ICON = 22; // cỡ icon buổi trong ngày cạnh đồng hồ
const QUEST_WIDTH = 250; // chữ nhiệm vụ dài hơn thì xuống dòng
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

// ring: màu viền nút tròn
const MENU_ITEMS = [
  { id: 'party', label: 'Đội hình', key: 'M', ring: 0xe85050 },
  { id: 'bag', label: 'Túi đồ', key: 'B', ring: 0xe8a030 },
  { id: 'dex', label: 'Pokédex', key: 'P', ring: 0xd84848 },
  { id: 'trainer', label: 'Thẻ HLV', key: 'T', ring: 0x48b878 },
  { id: 'settings', label: 'Cài đặt', key: 'X', ring: 0x9aa4bc },
];

// Biểu tượng tròn giống nút ở cột nút bên trái (nền tối, viền màu theo chức năng), vd khi nhận Pokédex hiện trên đầu
export function drawRoundIcon(g, type, cx, cy) {
  const ring = MENU_ITEMS.find((i) => i.id === type)?.ring ?? 0xffd860;
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
// (trên trái, ui/PartyPanel.js), cột nút tròn có nhãn bên trái ngay trên thanh phím tắt (Đội hình / Túi đồ / Pokédex /
// Cài đặt; Bản đồ vùng và Trợ giúp nằm trong Cài đặt), nút ≡ cạnh thanh phím tắt ẩn / hiện cột nút, khung nhiệm vụ ở góc
// phải dưới (bấm tiêu đề để thu gọn / mở ra). Trạng thái thu gọn nhớ trong cài đặt.
// actions: { party, bag, dex, settings } – hàm gọi khi bấm nút
export class WorldHud {
  constructor(scene, actions) {
    this.scene = scene;
    this.actions = actions;
    const { width, height } = scene.scale;
    const fixed = (o) => o.setScrollFactor(0).setDepth(DEPTH);

    // Khung nhiệm vụ góc phải dưới: mép phải / dưới cố định, nhiệm vụ dài thì xuống dòng (khung nới lên trên).
    // Bấm vào khung (hoặc mũi tên ▼ / ▲) để thu gọn chỉ còn tiêu đề
    this.questOpen = settings.questOpen !== false;
    this.questBg = fixed(scene.add.graphics());
    this.questLabel = fixed(scene.add.text(0, 0, 'NHIỆM VỤ', textStyle(12, '#ffd860', { fontStyle: 'bold' })));
    this.questArrow = fixed(scene.add.text(0, 0, '▼', textStyle(12, '#c8d0e8', { fontStyle: 'bold' })).setOrigin(1, 0));
    this.questText = fixed(scene.add.text(0, 0, '', textStyle(15, '#ffffff', { wordWrap: { width: QUEST_WIDTH, useAdvancedWrap: true }, lineSpacing: 1 })));
    this.questZone = fixed(scene.add.zone(0, 0, 10, 10).setOrigin(0)).setInteractive({ useHandCursor: true });
    this.questZone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.questOpen = !this.questOpen;
      setSetting('questOpen', this.questOpen);
      this.drawQuest();
    });
    this.questZone.on('pointerover', () => this.questArrow.setColor('#ffd860'));
    this.questZone.on('pointerout', () => this.questArrow.setColor('#c8d0e8'));
    this.drawQuest();

    // Đồng hồ: chừa chỗ bên trái cho icon buổi trong ngày (mặt trời vàng / mặt trời lặn cam / trăng khuyết)
    // Hai dòng: buổi + giờ, rồi tên bản đồ đang đứng (căn phải)
    this.clock = fixed(scene.add.text(width - 16, 14, '', textStyle(17, '#ffffff', {
      backgroundColor: 'rgba(20,26,44,0.72)', padding: { left: 12 + CLOCK_ICON + 6, right: 12, top: 6, bottom: 6 }, align: 'right', lineSpacing: 2,
    })).setOrigin(1, 0));
    this.clockIcon = fixed(scene.add.image(0, 0, HUD_PHASE_ICON.day).setDisplaySize(CLOCK_ICON, CLOCK_ICON));
    this.clockIcon.setDepth(DEPTH + 0.01);

    // Báo đã lưu / đã gán phím tắt: chỗ trống giữa thanh phím tắt và khung nhiệm vụ (xem showSaveNote).
    // Nằm trên các menu, túi đồ (đang kéo đồ vào ô phím tắt vẫn thấy)
    this.saveNote = fixed(scene.add.text(width / 2 + 60, height - 16, 'Đã lưu game', textStyle(16, '#ffffff', {
      backgroundColor: 'rgba(30,110,70,0.85)', padding: { x: 12, y: 5 }, align: 'center',
    })).setOrigin(0.5, 1)).setAlpha(0).setDepth(DEPTH + 15);

    // Nút ≡ cạnh thanh phím tắt: ẩn / hiện cột nút tròn
    this.expanded = settings.hudMenuOpen !== false;
    this.toggleBtn = this.makeSquareButton(16, height - 16 - BTN, () => this.toggleMenu());
    // Ô tiền giữa nút ≡ và thanh phím tắt (như game MMO): icon đồng ₽ + số tiền, cập nhật mỗi khi tiền đổi
    const mx = 16 + BTN + 8;
    const my = height - 16 - BTN;
    this.moneyBg = fixed(scene.add.graphics());
    this.moneyBg.fillStyle(DARK, 0.8);
    this.moneyBg.fillRoundedRect(mx, my + 8, MONEY_W, BTN - 16, 10);
    this.moneyBg.lineStyle(2, 0xffffff, 0.18);
    this.moneyBg.strokeRoundedRect(mx + 1, my + 9, MONEY_W - 2, BTN - 18, 9);
    this.moneyBg.fillStyle(0xe8b830);
    this.moneyBg.fillCircle(mx + 18, my + BTN / 2, 9);
    this.moneyBg.fillStyle(0xf8e080);
    this.moneyBg.fillCircle(mx + 17, my + BTN / 2 - 1, 6);
    this.moneyCoin = fixed(scene.add.text(mx + 18, my + BTN / 2, '₽', textStyle(11, '#7a5010', { fontStyle: 'bold' })).setOrigin(0.5));
    this.moneyText = fixed(scene.add.text(mx + 32, my + BTN / 2, '', textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5));
    this.moneyShown = null;
    this.buttons = MENU_ITEMS.map((item) => this.makeRoundButton(item, () => this.actions[item.id]?.()));
    this.layoutMenu();
    this.toggleMenu(this.expanded, false);
  }

  makeSquareButton(x, y, onClick) {
    const { scene } = this;
    const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    const draw = (hover) => {
      g.clear();
      g.fillStyle(DARK, hover ? 0.95 : 0.8);
      g.fillRoundedRect(x, y, BTN, BTN, 10);
      g.lineStyle(2, this.expanded ? 0xffd860 : 0xffffff, hover || this.expanded ? 0.7 : 0.22);
      g.strokeRoundedRect(x + 1, y + 1, BTN - 2, BTN - 2, 9);
      drawIcon(g, 'menu', x + BTN / 2, y + BTN / 2);
    };
    const zone = scene.add.zone(x + BTN / 2, y + BTN / 2, BTN, BTN).setScrollFactor(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      onClick();
    });
    draw(false);
    return { g, zone, draw };
  }

  // Nút tròn có biểu tượng, nhãn dạng viên thuốc chìa sang phải (tên + phím tắt)
  makeRoundButton(item, onClick) {
    const { scene } = this;
    const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    const label = scene.add.text(0, 0, item.label, textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);
    const key = scene.add.text(0, 0, item.key, textStyle(11, '#ffd860', { fontStyle: 'bold' })).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);
    const btn = { item, g, label, key, zone: null, cx: 0, cy: 0, hover: false };
    btn.draw = (hover = btn.hover) => {
      btn.hover = hover;
      const { cx, cy } = btn;
      const pillW = ROUND + 10 + label.width + 8 + key.width + 12;
      g.clear();
      // Viên nhãn phía sau nút tròn
      g.fillStyle(DARK, hover ? 0.92 : 0.72);
      g.fillRoundedRect(cx, cy - 13, pillW, 26, 13);
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
      key.setPosition(cx + ROUND + 10 + label.width + 8, cy);
      const w = pillW + ROUND;
      if (!btn.zone) {
        btn.zone = scene.add.zone(cx - ROUND + w / 2, cy, w, ROUND * 2).setScrollFactor(0).setInteractive({ useHandCursor: true });
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

  // Xếp cột nút tròn ngay trên nút ≡ / thanh phím tắt
  layoutMenu() {
    const bottom = this.scene.scale.height - 16 - BTN - 12 - ROUND;
    this.buttons.forEach((b, i) => {
      b.cx = 16 + ROUND;
      b.cy = bottom - (this.buttons.length - 1 - i) * STEP;
      b.draw();
    });
  }

  toggleMenu(open = !this.expanded, remember = true) {
    this.expanded = open;
    if (remember) setSetting('hudMenuOpen', open);
    this.toggleBtn.draw(false);
    this.applyMenuVisibility();
  }

  applyMenuVisibility() {
    const show = this.expanded && this.visible !== false;
    for (const b of this.buttons) {
      for (const o of [b.g, b.label, b.key, b.zone]) o.setVisible(show);
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
    if (!visible) {
      this.toggleBtn.draw(false);
      this.questArrow.setColor('#c8d0e8');
    }
    for (const o of [this.questBg, this.questLabel, this.questArrow, this.clock, this.clockIcon, this.toggleBtn.g, this.moneyBg, this.moneyCoin, this.moneyText]) o.setVisible(visible);
    this.questText.setVisible(visible && this.questOpen);
    for (const z of [this.toggleBtn.zone, this.questZone]) {
      if (visible) z.setInteractive();
      else z.disableInteractive();
    }
    this.applyMenuVisibility();
  }

  // clock: chữ giờ (ambience.label) • phase: 'day' | 'dusk' | 'night' để chọn icon
  update(objective, clock, phase = 'day') {
    if (objective !== this.questText.text) {
      this.questText.setText(objective);
      this.drawQuest();
    }
    if (clock !== this.clock.text) this.clock.setText(clock);
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
    // Icon buổi ngang dòng đầu (buổi + giờ); dòng thứ hai là tên bản đồ
    this.clockIcon.setPosition(this.clock.x - this.clock.width + 12 + CLOCK_ICON / 2, this.clock.y + 6 + 11);
  }

  // Vẽ khung nhiệm vụ góc phải dưới (thu gọn: chỉ dòng tiêu đề "NHIỆM VỤ ▲")
  drawQuest() {
    const { width, height } = this.scene.scale;
    const open = this.questOpen;
    const w = (open ? Math.max(this.questText.width, this.questLabel.width + 30) : this.questLabel.width + 30) + 28;
    const h = open ? 21 + this.questText.height + 9 : 26;
    const x = width - 16 - w;
    const y = height - 16 - h;
    this.questLabel.setPosition(x + 14, y + 6);
    this.questArrow.setText(open ? '▼' : '▲').setPosition(x + w - 10, y + 5);
    this.questText.setPosition(x + 14, y + 21).setVisible(open && this.visible !== false);
    this.questBg.clear();
    this.questBg.fillStyle(DARK, 0.78);
    this.questBg.fillRoundedRect(x, y, w, h, 9);
    this.questBg.fillStyle(0xffd860);
    this.questBg.fillRect(x, y + 7, 3, h - 14);
    this.questZone.setPosition(x, y).setSize(w, h);
    this.questZone.input?.hitArea.setTo(0, 0, w, h);
    this.questRect = { x, y, w, h };
  }

  // Tên địa điểm trượt xuống ở giữa phía trên khi vừa tới nơi mới
  showMapName(name) {
    const { scene } = this;
    this.mapBanner?.destroy();
    const t = scene.add
      .text(scene.scale.width / 2, -50, name, textStyle(22, '#ffffff', { fontStyle: 'bold', backgroundColor: 'rgba(20,26,44,0.85)', padding: { x: 20, y: 9 } }))
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    this.mapBanner = t;
    scene.tweens.add({ targets: t, y: 24, duration: 300, ease: 'Back.out' });
    scene.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 400, onComplete: () => t.destroy() });
  }

  // warn: báo lỗi lưu (nền đỏ, hiện lâu hơn). Chữ ngắn: nằm giữa chỗ trống giữa thanh phím tắt và khung nhiệm vụ (khung
  // nhiệm vụ ẩn khi đang mở túi đồ thì chỗ trống rộng tới mép phải), dài thì xuống dòng; vẫn không vừa (quá 2 dòng) thì
  // nằm giữa màn hình, ngay trên hàng phím tắt / khung nhiệm vụ
  showSaveNote(text = 'Đã lưu game', warn = false) {
    const { scene } = this;
    const { width, height } = scene.scale;
    const note = this.saveNote;
    scene.tweens.killTweensOf(note);
    note.setText(text).setBackgroundColor(warn ? 'rgba(170,50,50,0.9)' : 'rgba(30,110,70,0.85)').setAlpha(1);
    const quest = this.visible !== false ? this.questRect : null;
    const left = HOTBAR_RIGHT + 12;
    const right = (quest ? quest.x : width - 16) - 12;
    note.setWordWrapWidth(Math.max(120, right - left - 24), true);
    const lines = note.getWrappedText(text).length;
    if (lines <= 2) {
      note.setPosition((left + right) / 2, height - 16);
    } else {
      note.setWordWrapWidth(NOTE_WRAP, true);
      const top = Math.min(height - 16 - 46, quest ? quest.y : height);
      note.setPosition(width / 2, top - 10);
    }
    scene.tweens.add({ targets: note, alpha: 0, delay: warn ? 6000 : Math.max(1200, text.length * 45), duration: 400 });
  }

  // Bảng phím điều khiển, đóng khi bấm phím bất kỳ, bấm chuột hoặc nút ✕
  showHelp(router) {
    const { scene } = this;
    const { width } = scene.scale;
    const c = scene.add.container(0, 0).setDepth(DEPTH + 20);
    const top = 56;
    const rows = [
      [['Mũi tên', 'WASD'], 'Đi (chạm nhẹ để xoay người)'],
      [['Enter', 'Space'], 'Nói chuyện, đọc biển, xác nhận'],
      [['Enter'], 'Ở bờ nước: xuống nước (cưỡi Lapras / Surf)'],
      [['X', 'Esc'], 'Quay lại, mở Cài đặt'],
      [['M'], 'Đội hình (kéo thả hoặc Shift + ↑↓ để đổi chỗ)'],
      [['B'], 'Túi đồ (gõ chữ để tìm vật phẩm)'],
      [['P'], 'Pokédex'],
      [['N'], 'Bản đồ vùng'],
      [['T'], 'Thẻ Huấn luyện viên: thời gian chơi, huy hiệu, tiền'],
      [['C'], 'Lên / xuống xe đạp'],
      [['R'], 'Cưỡi Arcanine / đổi cách bơi (cần thú cưỡi)'],
      [['1 - 6'], 'Dùng đồ ở ô phím tắt (kéo đồ trong túi thả vào ô)'],
      [['H'], 'Bảng trợ giúp này'],
      [['Chuột'], 'Bấm Pokémon ở cột trái: xem đội hình • bấm Pokémon hoang dã ở góc phải: mở Pokédex'],
    ];
    const pitch = 36;
    const h = 112 + rows.length * pitch + 30;
    c.add(drawPanel(scene, width / 2 - 350, top, 700, h, 18, true));
    c.add(scene.add.text(width / 2, top + 24, 'Phím điều khiển', textStyle(28, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5, 0));
    const chips = scene.add.graphics();
    c.add(chips);
    rows.forEach(([keys, desc], i) => {
      const y = top + 92 + i * pitch;
      // Phím dạng viên tối, các phím thay thế cách nhau bằng "/"
      let x = width / 2 - 320;
      keys.forEach((k, j) => {
        if (j) {
          c.add(scene.add.text(x + 2, y, '/', textStyle(16, '#8a92a6', { fontStyle: 'bold' })).setOrigin(0, 0.5));
          x += 16;
        }
        const t = scene.add.text(x + 9, y, k, textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5);
        chips.fillStyle(0x000000, 0.18);
        chips.fillRoundedRect(x, y - 13 + 3, t.width + 18, 26, 7);
        chips.fillStyle(DARK);
        chips.fillRoundedRect(x, y - 13, t.width + 18, 26, 7);
        c.add(t);
        x += t.width + 18 + 6;
      });
      c.add(scene.add.text(width / 2 - 120, y, desc, textStyle(17, '#4a5266', { wordWrap: { width: 450, useAdvancedWrap: true }, lineSpacing: -2 })).setOrigin(0, 0.5));
    });
    c.add(scene.add.text(width / 2, top + h - 30, 'Bấm phím bất kỳ hoặc bấm chuột để đóng', textStyle(15, '#8a92a6')).setOrigin(0.5, 0));
    const openedAt = performance.now();
    return new Promise((resolve) => {
      const close = () => {
        if (!c.active) return;
        router.clear();
        c.destroy();
        resolve();
      };
      c.add(closeButton(scene, width / 2 + 350 - 34, top + 38, close));
      c.setScrollFactor(0);
      c.list.forEach((o) => o.setScrollFactor(0));
      router.set((e) => e.timeStamp >= openedAt && (isConfirm(e) || isCancel(e) || !e.repeat) && close(), (p) => p.downTime >= openedAt && close());
    });
  }
}
