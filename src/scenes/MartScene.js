import Phaser from 'phaser';
import { ITEMS, MART_STOCK, formatMoney, sellPrice } from '../data/items.js';
import { buy, itemCount, sell, state } from '../game/state.js';
import { fitScale } from '../gfx/textures.js';
import { COLORS, drawPanel, textStyle } from '../ui/helpers.js';
import { InputRouter, directionOf, isCancel, isConfirm } from '../ui/input.js';
import { Menu } from '../ui/Menu.js';
import { MessageBox } from '../ui/MessageBox.js';

const MAX_QTY = 99;

// Quầy Poké Mart: Mua / Bán. Chạy chồng lên bản đồ (World đang tạm dừng).
export default class MartScene extends Phaser.Scene {
  constructor() {
    super('Mart');
  }

  create() {
    this.add.rectangle(480, 360, 960, 720, 0x000000, 0.45);
    this.router = new InputRouter(this);

    drawPanel(this, 600, 24, 336, 78);
    this.add.text(624, 48, 'Tiền', textStyle(20, '#8a92a6'));
    this.moneyText = this.add.text(912, 44, '', textStyle(28, COLORS.text, { fontStyle: 'bold' })).setOrigin(1, 0);

    this.infoPanel = drawPanel(this, 600, 114, 336, 300).setVisible(false);
    this.info = this.add.container(0, 0);
    this.msg = new MessageBox(this, this.router, 12, 548, 936, 164);

    this.updateMoney();
    this.run().catch((err) => console.error('Lỗi cửa hàng:', err));
  }

  updateMoney() {
    this.moneyText.setText(formatMoney(state.money));
  }

  // Khung thông tin món đang chọn. price: giá hiển thị (mua hoặc bán)
  showInfo(id, price) {
    this.info.removeAll(true);
    const item = ITEMS[id];
    this.infoPanel.setVisible(Boolean(item));
    if (!item) return;
    this.info.add([
      this.add.image(768, 180, item.icon).setScale(fitScale(this, item.icon, 84)),
      this.add.text(768, 236, item.name, textStyle(26, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5, 0),
      this.add.text(624, 280, item.desc, textStyle(19, '#4a5266', { wordWrap: { width: 290 }, lineSpacing: 4 })),
      this.add.text(624, 374, `Đang có: ${itemCount(id)}`, textStyle(19, '#8a92a6')),
      this.add.text(912, 374, formatMoney(price), textStyle(19, '#3a4660', { fontStyle: 'bold' })).setOrigin(1, 0),
    ]);
  }

  async run() {
    let mode = 0;
    for (;;) {
      this.showInfo(null);
      this.msg.setText('Quý khách cần gì ạ?');
      const items = [{ label: 'Mua', value: 'buy' }, { label: 'Bán', value: 'sell' }, { label: 'Thôi', value: 'quit' }];
      const choice = await new Menu(this, this.router, {
        x: 24, y: 24, width: 260, height: 230, title: 'POKé MART', items, index: mode,
      }).open();
      mode = Math.max(0, items.findIndex((i) => i.value === choice));
      if (choice === 'buy') await this.buyLoop();
      else if (choice === 'sell') await this.sellLoop();
      else break;
    }
    await this.msg.show('Cảm ơn quý khách! Hẹn gặp lại!');
    this.close();
  }

  async buyLoop() {
    let index = 0;
    for (;;) {
      this.msg.setText('Quý khách muốn mua gì ạ?');
      const items = MART_STOCK.map((id) => ({
        label: ITEMS[id].name, sub: formatMoney(ITEMS[id].price), value: id, icon: ITEMS[id].icon, fontSize: 24,
      }));
      items.push({ label: 'Quay lại', value: 'back', fontSize: 24 });
      const id = await new Menu(this, this.router, {
        x: 24, y: 24, width: 560, height: 510, title: 'Mua', items, rowHeight: 48, index,
        onChange: ({ value }) => this.showInfo(value, ITEMS[value]?.price),
      }).open();
      if (!id || id === 'back') return;
      index = MART_STOCK.indexOf(id);

      const { price, name } = ITEMS[id];
      if (state.money < price) {
        await this.msg.show('Xin lỗi, quý khách không đủ tiền ạ.');
        continue;
      }
      this.msg.setText(`${name}, vâng ạ. Quý khách lấy bao nhiêu?`);
      const qty = await this.chooseQuantity(price, Math.min(MAX_QTY, Math.floor(state.money / price)), 'mua');
      if (!qty) continue;
      buy(id, qty, price);
      this.updateMoney();
      this.showInfo(id, price);
      await this.msg.show(`Đây là ${qty} ${name}, tổng cộng ${formatMoney(qty * price)}. Cảm ơn quý khách!`);
    }
  }

  async sellLoop() {
    let index = 0;
    for (;;) {
      const owned = Object.keys(ITEMS).filter((id) => itemCount(id) > 0);
      if (!owned.length) {
        await this.msg.show('Quý khách không có gì để bán ạ.');
        return;
      }
      this.msg.setText('Quý khách muốn bán gì ạ?');
      const items = owned.map((id) => ({
        label: ITEMS[id].name, sub: `x${itemCount(id)}`, value: id, icon: ITEMS[id].icon, fontSize: 24,
      }));
      items.push({ label: 'Quay lại', value: 'back', fontSize: 24 });
      const id = await new Menu(this, this.router, {
        x: 24, y: 24, width: 560, height: Math.min(510, 90 + items.length * 54), title: 'Bán', items, rowHeight: 48,
        index: Math.min(index, items.length - 1),
        onChange: ({ value }) => this.showInfo(value, ITEMS[value] && sellPrice(value)),
      }).open();
      if (!id || id === 'back') return;
      index = owned.indexOf(id);

      const price = sellPrice(id);
      this.msg.setText(`${ITEMS[id].name} à? Quý khách muốn bán bao nhiêu?`);
      const qty = await this.chooseQuantity(price, itemCount(id), 'bán');
      if (!qty) continue;
      sell(id, qty, price);
      this.updateMoney();
      this.showInfo(id, price);
      await this.msg.show(`Đã mua lại ${qty} ${ITEMS[id].name} với giá ${formatMoney(qty * price)}. Cảm ơn quý khách!`);
    }
  }

  // ↑↓ tăng giảm 1, ←→ tăng giảm 10, Enter xác nhận, Esc huỷ (trả về 0)
  chooseQuantity(price, max, verb) {
    const box = this.add.container(0, 0).setDepth(30);
    box.add(drawPanel(this, 600, 426, 336, 110));
    const qtyText = this.add.text(630, 446, '', textStyle(30, COLORS.text, { fontStyle: 'bold' }));
    const totalText = this.add.text(906, 452, '', textStyle(24, '#3a4660')).setOrigin(1, 0);
    const hint = this.add.text(630, 494, `↑↓ ±1   ←→ ±10   Enter: ${verb}`, textStyle(16, '#8a92a6'));
    box.add([qtyText, totalText, hint]);

    let qty = 1;
    const render = () => {
      qtyText.setText(`◀ x${qty} ▶`);
      totalText.setText(formatMoney(qty * price));
    };
    render();

    return new Promise((resolve) => {
      const done = (value) => {
        this.router.clear();
        box.destroy();
        resolve(value);
      };
      this.router.set((e) => {
        const step = { up: 1, down: -1, right: 10, left: -10 }[directionOf(e)];
        if (step) {
          qty = Phaser.Math.Clamp(qty + step, 1, max);
          render();
        } else if (isConfirm(e)) {
          done(qty);
        } else if (isCancel(e)) {
          done(0);
        }
      });
    });
  }

  close() {
    this.router.clear();
    this.scene.stop();
    this.scene.resume('World');
  }
}
