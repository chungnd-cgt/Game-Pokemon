import { fitText, textStyle } from './helpers.js';

// Bảng tên đặc tính bật ra khi đặc tính có tác dụng trong trận (Sturdy, Magic Guard, Intimidate...).
// Phe người chơi: trượt vào từ cạnh trái, phía trên Pokémon của mình • phe đối thủ: trượt vào từ cạnh phải, góc trên.
// Không chặn trận đấu: hiện một lúc rồi tự trượt ra; cùng phe kích hoạt tiếp thì đổi chữ và tính lại thời gian
const W = 300;
const H = 64;
const HOLD_MS = 1700;
const SLIDE_MS = 200;
const SIDES = {
  player: { x: 12, y: 196, from: -W - 20, accent: 0x4a88e0 },
  enemy: { x: 960 - W - 12, y: 14, from: 960 + 20, accent: 0xe05a5a },
};

export class AbilityBanner {
  constructor(scene) {
    this.scene = scene;
    this.panels = Object.fromEntries(Object.entries(SIDES).map(([side, cfg]) => [side, this.build(cfg)]));
  }

  build(cfg) {
    const { scene } = this;
    const c = scene.add.container(cfg.from, cfg.y).setDepth(9).setVisible(false);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(3, 5, W, H, 12);
    g.fillStyle(0x1e2a44, 0.94);
    g.fillRoundedRect(0, 0, W, H, 12);
    g.fillStyle(cfg.accent);
    g.fillRoundedRect(0, 0, 10, H, { tl: 12, bl: 12, tr: 0, br: 0 });
    g.lineStyle(2, cfg.accent, 0.9);
    g.strokeRoundedRect(0, 0, W, H, 12);
    const owner = scene.add.text(24, 8, '', textStyle(15, '#b8c6e0', { fontStyle: 'bold' }));
    const name = scene.add.text(24, 26, '', textStyle(24, '#ffe070', { fontStyle: 'bold' }));
    c.add([g, owner, name]);
    return { cfg, c, owner, name, timer: null, tween: null };
  }

  // side: 'player' | 'enemy' • owner: tên Pokémon • ability: tên đặc tính
  show(side, owner, ability) {
    const p = this.panels[side];
    if (!p) return;
    p.owner.setText(owner).setY(8);
    p.name.setText(ability).setY(26);
    fitText(p.owner, W - 36);
    fitText(p.name, W - 36);
    p.timer?.remove();
    p.tween?.stop();
    p.c.setVisible(true);
    p.tween = this.scene.tweens.add({ targets: p.c, x: p.cfg.x, duration: SLIDE_MS, ease: 'Back.out' });
    p.timer = this.scene.time.delayedCall(HOLD_MS, () => this.hide(side));
  }

  hide(side) {
    const p = this.panels[side];
    p.timer?.remove();
    p.timer = null;
    p.tween?.stop();
    p.tween = this.scene.tweens.add({
      targets: p.c, x: p.cfg.from, duration: SLIDE_MS, ease: 'Quad.in', onComplete: () => p.c.setVisible(false),
    });
  }
}
