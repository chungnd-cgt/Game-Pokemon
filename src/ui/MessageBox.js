import { COLORS, drawPanel, textStyle } from './helpers.js';
import { isCancel, isConfirm } from './input.js';
import { fillKeyNames } from '../game/keybinds.js';

const CHAR_DELAY = 18;

// Hộp thoại chữ chạy. show() chờ người chơi bấm phím xác nhận / quay lại hoặc bấm chuột mới đi tiếp.
export class MessageBox {
  // opts.radius: bo góc khung; opts.shadow: false thì không đổ bóng (vd nằm sát đáy khung trận đấu)
  constructor(scene, router, x, y, w, h, opts = {}) {
    this.scene = scene;
    this.router = router;
    this.container = scene.add.container(0, 0).setDepth(10);
    this.container.add(drawPanel(scene, x, y, w, h, opts.radius ?? 20, false, opts.shadow ?? true));
    this.text = scene.add
      .text(x + 36, y + 30, '', textStyle(30, COLORS.text, { lineSpacing: 10 }))
      .setShadow(2, 2, COLORS.textShadow, 0);
    this.arrow = scene.add.text(x + w - 50, y + h - 52, '▼', textStyle(22, '#e04848')).setVisible(false);
    this.container.add([this.text, this.arrow]);
    this.wideWrap = w - 96;
    // Chiều cao dành cho chữ (từ dòng đầu tới sát viền dưới): câu dài hơn số dòng vừa khung thì chia thành nhiều trang
    this.textRoom = h - 34;
    scene.tweens.add({ targets: this.arrow, y: this.arrow.y + 6, duration: 400, yoyo: true, repeat: -1 });
  }

  // Số dòng vừa khung, đo một lần bằng chính kiểu chữ của hộp thoại (gọi khi đã nạp font)
  linesPerPage() {
    if (!this.maxLines) {
      const t = this.text;
      t.setText('Ág');
      const one = t.height;
      t.setText('Ág\nÁg');
      const pitch = t.height - one;
      t.setText('');
      this.maxLines = Math.max(1, 1 + Math.floor((this.textRoom - one) / pitch));
    }
    return this.maxLines;
  }

  // Chia câu thành các trang vừa khung (giữ nguyên chỗ xuống dòng như khi hiện cả câu)
  pages(text) {
    const per = this.linesPerPage();
    this.text.setWordWrapWidth(this.wideWrap);
    const lines = this.text.getWrappedText(text).map((l) => l.trimEnd());
    if (lines.length <= per) return [text];
    const out = [];
    for (let i = 0; i < lines.length; i += per) out.push(lines.slice(i, i + per).join('\n'));
    return out;
  }

  // Hiện chữ ngay, không chờ (dùng khi đang mở menu bên cạnh)
  setText(text, narrow = false) {
    this.stopTyping();
    this.text.setWordWrapWidth(narrow ? 470 : this.wideWrap);
    this.text.setText(fillKeyNames(text));
    this.arrow.setVisible(false);
  }

  // Hiện câu (chữ chạy), câu dài thì lần lượt từng trang; xong khi người chơi bấm qua trang cuối
  // Lời nhắc phím dạng {key:dex} đổi thành tên phím người chơi đang dùng (game/keybinds.js)
  async show(text) {
    for (const page of this.pages(fillKeyNames(text))) await this.showPage(page);
  }

  showPage(text) {
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
