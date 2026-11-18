import { ITEMS } from '../data/items.js';
import { fixToCamera, textStyle, uiX } from './helpers.js';

const TIP_W = 230;
const DARK = 0x141a2c;

// Khung mô tả vật phẩm nhỏ, hiện cạnh vật phẩm đang rê chuột / đang chọn (thay cho khung lời thoại ở đáy màn hình)
export class ItemTip {
  constructor(scene, depth) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(depth).setVisible(false);
    this.bg = scene.add.graphics();
    this.name = scene.add.text(14, 10, '', textStyle(17, '#ffd860', { fontStyle: 'bold' }));
    this.desc = scene.add.text(14, 36, '', textStyle(15, '#ffffff', { wordWrap: { width: TIP_W - 28 }, lineSpacing: 3 }));
    this.container.add([this.bg, this.name, this.desc]);
    fixToCamera(this.container);
  }

  // Hiện mô tả vật phẩm id, mép trái ở x (alignRight: mép phải ở x), giữa theo chiều dọc ở y (không tràn khỏi màn hình)
  show(id, x, y, alignRight = false) {
    const item = ITEMS[id];
    if (!item) return this.hide();
    this.name.setText(item.name);
    this.desc.setText(item.desc ?? '');
    const h = 46 + this.desc.height;
    const top = Math.max(8, Math.min(this.scene.scale.height - h - 8, y - h / 2));
    this.container.setX(uiX(this.scene)); // x theo khung thiết kế, khung nằm giữa màn hình rộng
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.25);
    this.bg.fillRoundedRect(3, 5, TIP_W, h, 12);
    this.bg.fillStyle(DARK, 0.94);
    this.bg.fillRoundedRect(0, 0, TIP_W, h, 12);
    this.bg.fillStyle(0xffd860);
    this.bg.fillRect(0, 12, 3, 20);
    this.container.setPosition(alignRight ? x - TIP_W : x, top).setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  destroy() {
    this.container.destroy();
  }
}
