import { ITEMS } from '../data/items.js';
import { fixToCamera, textStyle, uiX } from './helpers.js';

const TIP_W = 230;
const DARK = 0x16171b; // than chì, cùng tông khung túi đồ
const DESC_STYLE = textStyle(15, '#ffffff', { wordWrap: { width: TIP_W - 28 }, lineSpacing: 3 });

// Khung mô tả vật phẩm nhỏ, hiện cạnh vật phẩm đang rê chuột / đang chọn (thay cho khung lời thoại ở đáy màn hình)
export class ItemTip {
  // inside: nằm trong container của cửa sổ nổi (toạ độ trong khung, không cộng uiX); limitY(): mép dưới được phép (mặc định
  // đáy màn hình) để lật mô tả lên trên ô khi không vừa
  constructor(scene, depth, { inside = false, limitY = null } = {}) {
    this.scene = scene;
    this.inside = inside;
    this.limitY = limitY;
    this.container = scene.add.container(0, 0).setDepth(depth).setVisible(false);
    this.bg = scene.add.graphics();
    this.name = scene.add.text(14, 10, '', textStyle(17, '#ffd860', { fontStyle: 'bold' }));
    this.desc = scene.add.text(14, 36, '', DESC_STYLE);
    this.container.add([this.bg, this.name, this.desc]);
    fixToCamera(this.container);
  }

  // Hiện mô tả vật phẩm id, mép trái ở x (alignRight: mép phải ở x), giữa theo chiều dọc ở y (không tràn khỏi màn hình)
  show(id, x, y, alignRight = false) {
    const item = ITEMS[id];
    if (!item) return this.hide();
    this.name.setText(item.name);
    this.desc.setStyle(DESC_STYLE).setPosition(14, 36).setText(item.desc ?? '');
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

  // Mô tả nhỏ ngay dưới ô vật phẩm (túi đồ): chỉ dòng mô tả (tên đã có trên ô), rộng w, mép trái x (toạ độ trong khung
  // thiết kế), mép trên ở y. Tràn khỏi đáy màn hình thì lật lên trên ô: mép dưới ở aboveY
  showBelow(id, x, y, w, aboveY) {
    const item = ITEMS[id];
    if (!item?.desc) return this.hide();
    this.name.setText('');
    this.desc.setStyle(textStyle(13, '#e8ecf6', { wordWrap: { width: w - 20 }, lineSpacing: 2 }));
    this.desc.setText(item.desc).setPosition(10, 7);
    const h = this.desc.height + 14;
    const top = y + h + 4 > (this.limitY?.() ?? this.scene.scale.height) ? aboveY - h : y;
    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.3);
    this.bg.fillRoundedRect(2, 3, w, h, 8);
    this.bg.fillStyle(DARK, 0.96);
    this.bg.fillRoundedRect(0, 0, w, h, 8);
    this.bg.lineStyle(1, 0xffd860, 0.6);
    this.bg.strokeRoundedRect(0.5, 0.5, w - 1, h - 1, 8);
    this.container.setPosition((this.inside ? 0 : uiX(this.scene)) + x, top).setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  destroy() {
    this.container.destroy();
  }
}
