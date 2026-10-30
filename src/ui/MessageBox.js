import { COLORS, drawPanel, textStyle } from './helpers.js';
import { isCancel, isConfirm } from './input.js';

const CHAR_DELAY = 18;

// Hộp thoại chữ chạy. show() chờ người chơi bấm Enter/Space/click mới đi tiếp.
export class MessageBox {
  constructor(scene, router, x, y, w, h) {
    this.scene = scene;
    this.router = router;
    this.container = scene.add.container(0, 0).setDepth(10);
    this.container.add(drawPanel(scene, x, y, w, h, 20));
    this.text = scene.add
      .text(x + 36, y + 30, '', textStyle(30, COLORS.text, { lineSpacing: 10 }))
      .setShadow(2, 2, COLORS.textShadow, 0);
    this.arrow = scene.add.text(x + w - 50, y + h - 52, '▼', textStyle(22, '#e04848')).setVisible(false);
    this.container.add([this.text, this.arrow]);
    this.wideWrap = w - 96;
    scene.tweens.add({ targets: this.arrow, y: this.arrow.y + 6, duration: 400, yoyo: true, repeat: -1 });
  }

  // Hiện chữ ngay, không chờ (dùng khi đang mở menu bên cạnh)
  setText(text, narrow = false) {
    this.stopTyping();
    this.text.setWordWrapWidth(narrow ? 470 : this.wideWrap);
    this.text.setText(text);
    this.arrow.setVisible(false);
  }

  show(text) {
    this.stopTyping();
    this.text.setWordWrapWidth(this.wideWrap);
    this.text.setText('');
    this.arrow.setVisible(false);

    return new Promise((resolve) => {
      let shown = 0;
      const finishTyping = () => {
        this.stopTyping();
        this.text.setText(text);
        this.arrow.setVisible(true);
      };
      this.timer = this.scene.time.addEvent({
        delay: CHAR_DELAY,
        repeat: text.length - 1,
        callback: () => {
          shown++;
          this.text.setText(text.slice(0, shown));
          if (shown >= text.length) finishTyping();
        },
      });

      // Bấm lần đầu khi chữ đang chạy: hiện hết chữ. Bấm lần nữa: đi tiếp.
      const advance = () => {
        if (this.timer) return finishTyping();
        this.arrow.setVisible(false);
        this.router.clear();
        resolve();
      };
      this.router.set((e) => (isConfirm(e) || isCancel(e)) && advance(), advance);
    });
  }

  stopTyping() {
    this.timer?.remove();
    this.timer = null;
  }
}
