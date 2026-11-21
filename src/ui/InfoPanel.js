import Phaser from 'phaser';
import { setSetting, settings } from '../game/settings.js';
import { onSystemLog, systemLog, timeLabel } from '../game/systemLog.js';
import { hudSize, textStyle } from './helpers.js';

// Khung góc phải dưới (WorldHud): hai tab "Hệ thống" / "Nhiệm vụ" nằm trên đầu khung, tab đang chọn tô xanh.
//  Nhiệm vụ: mục tiêu hiện tại như trước
// Hai tab cùng chiều cao (nhiệm vụ dài hơn khung thì khung nới lên) để đổi tab hàng tab không nhảy
//  Hệ thống: nhật ký thông báo (game/systemLog.js) mỗi dòng có giờ [HH:MM:SS], màu theo loại; dòng mới nhất ở dưới cùng,
//            con lăn chuột trên khung để xem dòng cũ. Có dòng mới khi đang xem tab khác / khung đang thu gọn thì tab Hệ
//            thống hiện số dòng chưa đọc
// Bấm tab đang chọn (hoặc mũi tên ▼ / ▲) để thu gọn chỉ còn hàng tab. Tab đang chọn và trạng thái thu gọn nhớ trong cài đặt.
// Toạ độ theo cỡ ảo (hudSize), nằm trong root đã phóng to của WorldHud (fixed)
const W = 300;
const TAB_H = 24;
const BODY_H = 112; // chiều cao thân khung (cả hai tab)
const PAD = 10;
const DARK = 0x141a2c;
const BLUE = 0x3a74d8;
const TABS = [{ id: 'system', label: 'Hệ thống' }, { id: 'quest', label: 'Nhiệm vụ' }];
// Chữ thông báo màu xanh lá (giờ màu xám xanh)
const KIND_COLOR = { info: '#7ee88a', good: '#7ee88a', warn: '#7ee88a', trade: '#7ee88a', player: '#7ee88a' };
const TIME_COLOR = '#8a96b4';

export class InfoPanel {
  constructor(scene, fixed) {
    this.scene = scene;
    this.fixed = fixed;
    this.open = settings.questOpen !== false;
    this.tab = settings.hudTab === 'system' ? 'system' : 'quest';
    this.unread = 0;
    this.scroll = 0; // số dòng mới nhất đang bỏ qua (cuộn lên xem dòng cũ)
    this.shown = true;
    this.bg = fixed(scene.add.graphics());
    this.tabs = TABS.map((t) => {
      const label = fixed(scene.add.text(0, 0, t.label, textStyle(12, '#c8d0e8', { fontStyle: 'bold' })).setOrigin(0.5));
      const zone = fixed(scene.add.zone(0, 0, 10, 10).setOrigin(0)).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', (p, lx, ly, e) => {
        e?.stopPropagation();
        this.select(t.id);
      });
      return { id: t.id, name: t.label, label, zone };
    });
    this.arrow = fixed(scene.add.text(0, 0, '▼', textStyle(12, '#c8d0e8', { fontStyle: 'bold' })).setOrigin(0, 0.5));
    this.arrowZone = fixed(scene.add.zone(0, 0, 24, TAB_H).setOrigin(0)).setInteractive({ useHandCursor: true });
    this.arrowZone.on('pointerdown', (p, lx, ly, e) => {
      e?.stopPropagation();
      this.select(this.tab, true);
    });
    this.arrowZone.on('pointerover', () => this.arrow.setColor('#ffd860'));
    this.arrowZone.on('pointerout', () => this.arrow.setColor('#c8d0e8'));
    this.questText = fixed(scene.add.text(0, 0, '', textStyle(15, '#ffffff', {
      wordWrap: { width: W - PAD * 2 - 4, useAdvancedWrap: true }, lineSpacing: 1,
    })));
    this.lines = []; // chữ của các dòng nhật ký đang hiện (tạo lại mỗi lần vẽ)
    this.unsubscribe = onSystemLog(() => {
      if (this.tab !== 'system' || !this.open) this.unread++;
      this.scroll = 0;
      this.layout();
    });
    // Con lăn chuột trên khung (tab Hệ thống): xem dòng cũ
    this.onWheel = (p, objs, dx, dy) => {
      if (!dy || !this.shown || !this.open || this.tab !== 'system' || !this.rect) return;
      const { s } = hudSize(scene);
      const { x, y, w, h } = this.rect;
      if (p.x / s < x || p.x / s > x + w || p.y / s < y || p.y / s > y + h) return;
      this.scroll = Phaser.Math.Clamp(this.scroll + (dy > 0 ? -1 : 1), 0, Math.max(0, systemLog().length - 1));
      this.layout();
    };
    scene.input.on('wheel', this.onWheel);
    this.layout();
  }

  // Bấm tab: tab khác thì chuyển sang (và mở khung); tab đang chọn thì thu gọn / mở ra
  select(id, toggle = id === this.tab) {
    if (toggle) this.open = !this.open;
    else {
      this.tab = id;
      this.open = true;
      setSetting('hudTab', id);
    }
    setSetting('questOpen', this.open);
    this.scroll = 0;
    this.layout();
  }

  setQuest(text) {
    if (text === this.questText.text) return;
    this.questText.setText(text);
    this.layout();
  }

  setVisible(visible) {
    this.shown = visible;
    for (const o of [this.bg, this.arrow, ...this.tabs.map((t) => t.label)]) o.setVisible(visible);
    for (const z of [this.arrowZone, ...this.tabs.map((t) => t.zone)]) {
      if (visible) z.setInteractive();
      else z.disableInteractive();
    }
    if (!visible) this.arrow.setColor('#c8d0e8');
    this.layout();
  }

  layout() {
    const { scene } = this;
    const { width, height } = hudSize(scene);
    if (this.tab === 'system' && this.open) this.unread = 0;
    const quest = this.tab === 'quest';
    const bodyH = !this.open ? 0 : Math.max(BODY_H, this.questText.height + 16);
    const x = width - 16 - W;
    const top = height - 16 - bodyH - TAB_H; // đỉnh hàng tab
    const bodyY = top + TAB_H;
    const g = this.bg.clear();
    // Hàng tab: các tab xếp sát mép phải, mũi tên thu gọn bên trái
    let tx = x + W;
    for (const t of [...this.tabs].reverse()) {
      const active = t.id === this.tab;
      const unread = t.id === 'system' && this.unread > 0;
      t.label.setText(unread ? `${t.name} •${Math.min(this.unread, 99)}` : t.name);
      t.label.setColor(active ? '#ffffff' : unread ? '#ffd860' : '#c8d0e8');
      const tw = t.label.width + 20;
      tx -= tw;
      g.fillStyle(active ? BLUE : DARK, active ? 0.95 : 0.82);
      g.fillRoundedRect(tx, top, tw, TAB_H, { tl: 7, tr: 7, bl: this.open ? 0 : 7, br: this.open ? 0 : 7 });
      t.label.setPosition(tx + tw / 2, top + TAB_H / 2);
      t.zone.setPosition(tx, top).setSize(tw, TAB_H);
      t.zone.input?.hitArea.setTo(0, 0, tw, TAB_H);
      tx -= 3;
    }
    this.arrow.setText(this.open ? '▼' : '▲').setPosition(tx - 18, top + TAB_H / 2);
    this.arrowZone.setPosition(tx - 22, top);
    // Thân khung
    this.questText.setVisible(this.shown && this.open && quest);
    for (const o of this.lines) o.destroy();
    this.lines = [];
    if (this.open) {
      g.fillStyle(DARK, 0.8);
      g.fillRoundedRect(x, bodyY, W, bodyH, { tl: 9, tr: 0, bl: 9, br: 9 });
      g.fillStyle(0xffd860);
      g.fillRect(x, bodyY + 7, 3, bodyH - 14);
      if (quest) this.questText.setPosition(x + PAD + 4, bodyY + 8);
      else this.drawLog(x + PAD + 4, bodyY + 6, bodyY + bodyH - 6);
    }
    this.rect = { x: Math.min(x, tx - 22), y: top, w: W + Math.max(0, x - (tx - 22)), h: TAB_H + bodyH };
  }

  // Dòng nhật ký từ dưới lên (mới nhất ở dưới), hết chỗ thì thôi
  drawLog(left, top, bottom) {
    const { scene, fixed } = this;
    const list = systemLog();
    if (!list.length) {
      this.lines.push(fixed(scene.add.text(left, top + 2, 'Chưa có thông báo.', textStyle(13, TIME_COLOR))).setVisible(this.shown));
      return;
    }
    let y = bottom;
    for (let i = list.length - 1 - this.scroll; i >= 0; i--) {
      const e = list[i];
      const time = scene.add.text(left, 0, `[${timeLabel(e.at)}]`, textStyle(12, TIME_COLOR, { fontStyle: 'bold' }));
      const msg = scene.add.text(left + time.width + 5, 0, e.text, textStyle(13, KIND_COLOR[e.kind] ?? KIND_COLOR.info, {
        wordWrap: { width: W - PAD * 2 - 4 - time.width - 5, useAdvancedWrap: true },
      }));
      if (y - msg.height < top && this.lines.length) {
        time.destroy();
        msg.destroy();
        break;
      }
      y -= msg.height;
      time.setY(y + 1);
      msg.setY(y);
      y -= 3;
      for (const o of [time, msg]) this.lines.push(fixed(o).setVisible(this.shown));
    }
  }

  destroy() {
    this.unsubscribe();
    this.scene.input.off('wheel', this.onWheel);
  }
}
