import Phaser from 'phaser';
import { expProgress } from '../game/monster.js';
import { COLORS, drawHpBar, textStyle, tweenAsync } from './helpers.js';

const WIDTH = 410;

// Khung tên + cấp + thanh HP (và số HP, thanh EXP cho Pokémon của người chơi)
export class MonsterInfo {
  constructor(scene, x, y, isPlayer) {
    this.scene = scene;
    this.isPlayer = isPlayer;
    const h = isPlayer ? 128 : 96;
    this.container = scene.add.container(x, y).setDepth(5);

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(4, 6, WIDTH, h, 18);
    bg.fillStyle(COLORS.ink);
    bg.fillRoundedRect(0, 0, WIDTH, h, 18);
    bg.fillStyle(0xfdfdf8);
    bg.fillRoundedRect(4, 4, WIDTH - 8, h - 8, 15);
    bg.fillStyle(0xeceee2);
    bg.fillRoundedRect(4, h / 2, WIDTH - 8, h / 2 - 4, { tl: 0, tr: 0, bl: 15, br: 15 });
    bg.fillStyle(isPlayer ? 0x4a8ae0 : 0xe05050);
    bg.fillRoundedRect(4, 4, 12, h - 8, { tl: 15, bl: 15, tr: 0, br: 0 });

    this.nameText = scene.add.text(30, 10, '', textStyle(28, COLORS.text, { fontStyle: 'bold' }));
    this.levelText = scene.add.text(WIDTH - 22, 14, '', textStyle(24, '#4a5266')).setOrigin(1, 0);
    this.bars = scene.add.graphics();
    this.container.add([bg, this.nameText, this.levelText, this.bars]);
    this.hpLabel = scene.add.text(42, 54, 'HP', textStyle(16, '#ffcc33', { fontStyle: 'bold' }));
    this.container.add(this.hpLabel);
    if (isPlayer) {
      this.hpText = scene.add.text(WIDTH - 22, 80, '', textStyle(22, '#3a4256')).setOrigin(1, 0);
      this.container.add(this.hpText);
    }
  }

  setMonster(mon) {
    this.mon = mon;
    this.displayHp = mon.hp;
    this.displayExp = expProgress(mon);
    this.refresh();
  }

  // Cập nhật tên, cấp, HP theo dữ liệu hiện tại (giữ nguyên thanh EXP)
  refresh() {
    this.displayHp = this.mon.hp;
    this.nameText.setText(this.mon.name);
    this.levelText.setText(`Lv${this.mon.level}`);
    this.draw();
  }

  draw() {
    const g = this.bars;
    const { mon } = this;
    g.clear();
    drawHpBar(g, 30, 52, WIDTH - 52, this.displayHp / mon.maxHp);
    this.container.bringToTop(this.hpLabel);

    if (this.isPlayer) {
      this.hpText.setText(`${Math.ceil(this.displayHp)} / ${mon.maxHp}`);
      g.fillStyle(0x3a4250);
      g.fillRoundedRect(30, 110, WIDTH - 52, 8, 4);
      const w = Math.round((WIDTH - 56) * Phaser.Math.Clamp(this.displayExp, 0, 1));
      if (w > 0) {
        g.fillStyle(0x48b0f8);
        g.fillRoundedRect(32, 111, Math.max(6, w), 6, 3);
      }
    }
  }

  animateHp() {
    const diff = Math.abs(this.mon.hp - this.displayHp);
    if (diff === 0) return Promise.resolve();
    const duration = Phaser.Math.Clamp((diff / this.mon.maxHp) * 1200, 250, 900);
    return tweenAsync(this.scene, {
      targets: this,
      displayHp: this.mon.hp,
      duration,
      onUpdate: () => this.draw(),
    });
  }

  animateExp(target) {
    return tweenAsync(this.scene, {
      targets: this,
      displayExp: target,
      duration: 600,
      onUpdate: () => this.draw(),
    });
  }

  setExp(ratio) {
    this.displayExp = ratio;
    this.draw();
  }

  setVisible(visible) {
    this.container.setVisible(visible);
  }
}
