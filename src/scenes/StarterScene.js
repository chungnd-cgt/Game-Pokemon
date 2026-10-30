import Phaser from 'phaser';
import { SPECIES, STARTERS } from '../data/monsters.js';
import { TYPES } from '../data/types.js';
import { createMonster } from '../game/monster.js';
import { fitScale } from '../gfx/textures.js';
import { markCaught, state } from '../game/state.js';
import { drawPanel, gradientRect, textStyle } from '../ui/helpers.js';
import { InputRouter, directionOf, isConfirm } from '../ui/input.js';
import { typeBadges } from '../ui/TypeBadge.js';

const STARTER_LEVEL = 5;

export default class StarterScene extends Phaser.Scene {
  constructor() {
    super('Starter');
  }

  create() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    gradientRect(bg, 0, 0, width, height, 0x1d2b53, 0x3b6ea5);
    // Hoạ tiết Poké Ball mờ phía sau
    bg.lineStyle(14, 0xffffff, 0.05);
    for (const [cx, cy, r] of [[110, 600, 170], [870, 140, 130]]) {
      bg.strokeCircle(cx, cy, r);
      bg.lineBetween(cx - r, cy, cx + r, cy);
      bg.strokeCircle(cx, cy, r * 0.28);
    }

    this.add.text(width / 2, 60, 'Pokémon Demo', textStyle(64, '#ffe066', { fontStyle: 'bold', stroke: '#1d2b53', strokeThickness: 8 })).setOrigin(0.5);
    this.add.text(width / 2, 130, 'Chọn Pokémon khởi đầu của bạn', textStyle(30, '#ffffff')).setOrigin(0.5);

    this.cards = STARTERS.map((id, i) => {
      const sp = SPECIES[id];
      const x = width / 2 + (i - 1) * 290;
      const y = 370;
      const panel = drawPanel(this, x - 125, y - 170, 250, 320, 16, true);
      const glow = this.add.graphics();
      glow.fillStyle(TYPES[sp.types[0]].color, 0.18);
      glow.fillCircle(x, y - 50, 92);
      glow.fillStyle(0x000000, 0.12);
      glow.fillEllipse(x, y + 36, 130, 22);
      const sprite = this.add.image(x, y + 40, `mon-${id}`).setOrigin(0.5, 1).setScale(fitScale(this, `mon-${id}`, 192));
      this.add.text(x, y + 60, sp.name, textStyle(32, '#222222', { fontStyle: 'bold' })).setOrigin(0.5, 0);
      typeBadges(this, x, y + 120, sp.types, { align: 'center' });

      const hit = this.add.zone(x, y - 10, 250, 320).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.select(i));
      hit.on('pointerdown', () => {
        this.select(i);
        this.choose();
      });
      return { panel, sprite, baseY: y + 40 };
    });

    this.highlight = this.add.graphics();
    this.desc = this.add.text(width / 2, 560, '', textStyle(26, '#ffffff', { align: 'center', wordWrap: { width: 760 } })).setOrigin(0.5, 0);
    this.add.text(width / 2, height - 40, '← → để chọn  •  Enter để xác nhận  •  hoặc bấm chuột', textStyle(20, '#c8d6f0')).setOrigin(0.5);

    this.router = new InputRouter(this);
    this.router.set((e) => {
      const dir = directionOf(e);
      if (dir === 'left') this.select((this.index + 2) % 3);
      else if (dir === 'right') this.select((this.index + 1) % 3);
      else if (isConfirm(e)) this.choose();
    });
    this.select(0);
  }

  select(i) {
    if (this.index === i) return;
    this.index = i;
    const { width } = this.scale;
    const x = width / 2 + (i - 1) * 290;
    this.highlight.clear();
    this.highlight.lineStyle(6, 0xffe066);
    this.highlight.strokeRoundedRect(x - 131, 194, 262, 332, 18);
    this.desc.setText(SPECIES[STARTERS[i]].desc);

    this.bob?.stop();
    this.cards.forEach((c) => (c.sprite.y = c.baseY));
    const sprite = this.cards[i].sprite;
    this.bob = this.tweens.add({ targets: sprite, y: sprite.y - 12, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  choose() {
    if (this.chosen) return;
    this.chosen = true;
    this.router.clear();
    state.party = [createMonster(STARTERS[this.index], STARTER_LEVEL)];
    markCaught(STARTERS[this.index]);
    this.cameras.main.fadeOut(500);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World'));
  }
}
