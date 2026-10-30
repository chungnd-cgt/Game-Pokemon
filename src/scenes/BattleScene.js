import Phaser from 'phaser';
import { calcDamage, escapeChance, expGain, isSpecial, moveHits, playerGoesFirst, rollCatch } from '../battle/formulas.js';
import { ITEMS, formatMoney } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { TYPES } from '../data/types.js';
import { createMonster, expProgress, gainExp } from '../game/monster.js';
import { addCaught, healParty, itemCount, markSeen, state, useItem } from '../game/state.js';
import { hash } from '../gfx/pixel.js';
import { fitScale } from '../gfx/textures.js';
import { drawPanel, gradientRect, shade, textStyle, tweenAsync, wait } from '../ui/helpers.js';
import { InputRouter } from '../ui/input.js';
import { Menu } from '../ui/Menu.js';
import { MessageBox } from '../ui/MessageBox.js';
import { MonsterInfo } from '../ui/MonsterInfo.js';

// Vị trí chân Pokémon trên bệ và chiều cao hiển thị (px)
const ENEMY_POS = { x: 690, y: 276 };
const PLAYER_POS = { x: 250, y: 516 };
const ENEMY_SIZE = 190;
const PLAYER_SIZE = 250;
const BALL_SCALE = 0.45;

const PALETTES = {
  meadow: {
    skyTop: 0x6cc0f8, skyBottom: 0xd8f0ff, hill: 0x9ccfa0, tree: 0x5aa860, treeDark: 0x3f8a48,
    groundTop: 0xc4ec94, groundBottom: 0x88c860, blade: 0x6aae48, pad: 0x8ccf68,
  },
  deep: {
    skyTop: 0x4a84c8, skyBottom: 0xb8d8f0, hill: 0x7aae84, tree: 0x3f8a48, treeDark: 0x2a6a34,
    groundTop: 0x96d070, groundBottom: 0x5a9a44, blade: 0x4a8a38, pad: 0x6eb452,
  },
};

const ACTIONS = [
  { label: 'Chiến đấu', value: 'fight', color: 0xe05050 },
  { label: 'Túi đồ', value: 'bag', color: 0xe8a020 },
  { label: 'Pokémon', value: 'party', color: 0x40b060 },
  { label: 'Chạy', value: 'run', color: 0x4a88e0 },
];

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  // data: { enemy, zone } cho Pokémon hoang dã, hoặc { trainer } cho trận với nhà huấn luyện
  init(data) {
    this.trainer = data.trainer ?? null;
    this.enemyTeam = this.trainer ? this.trainer.team.map(([id, level]) => createMonster(id, level)) : [data.enemy];
    this.enemy = this.enemyTeam[0];
    markSeen(this.enemy.speciesId);
    this.zone = data.zone ?? 'meadow';
    this.activeIndex = state.party.findIndex((m) => m.hp > 0);
    this.runAttempts = 0;
    this.lastAction = 0;
    this.finished = false;
  }

  get active() {
    return state.party[this.activeIndex];
  }

  create() {
    this.input.mouse?.disableContextMenu();
    this.router = new InputRouter(this);
    this.drawBackground();

    const enemyKey = `mon-${this.enemy.speciesId}`;
    this.enemyScale = fitScale(this, enemyKey, ENEMY_SIZE);
    this.enemyShadow = this.add.image(ENEMY_POS.x + 600, ENEMY_POS.y - 4, 'fx-shadow').setScale(1.4, 1).setAlpha(0.28);
    this.enemySprite = this.add
      .image(ENEMY_POS.x + 600, ENEMY_POS.y, enemyKey)
      .setOrigin(0.5, 1)
      .setScale(this.enemyScale);
    this.playerShadow = this.add.image(PLAYER_POS.x, PLAYER_POS.y - 4, 'fx-shadow').setScale(1.8, 1.2).setAlpha(0.28).setVisible(false);
    this.playerSprite = this.add.image(PLAYER_POS.x, PLAYER_POS.y, enemyKey).setOrigin(0.5, 1).setVisible(false);

    if (this.trainer) {
      this.enemySprite.setVisible(false);
      this.enemyShadow.setX(ENEMY_POS.x).setVisible(false);
      this.trainerSprite = this.add
        .sprite(ENEMY_POS.x + 600, ENEMY_POS.y, this.trainer.sprite, 'down-stand')
        .setOrigin(0.5, 1)
        .setScale(8);
      this.teamBalls = this.enemyTeam.map((_, i) => this.add.image(70 + i * 34, 166, 'ball').setScale(0.3).setDepth(5).setVisible(false));
    }

    this.enemyInfo = new MonsterInfo(this, 40, 48, false);
    this.enemyInfo.setMonster(this.enemy);
    this.enemyInfo.setVisible(false);
    this.playerInfo = new MonsterInfo(this, 520, 356, true);
    this.playerInfo.setVisible(false);
    this.msg = new MessageBox(this, this.router, 12, 548, 936, 164);

    this.cameras.main.fadeIn(350);
    this.runBattle().catch((err) => console.error('Lỗi trận đấu:', err));
  }

  drawBackground() {
    const p = PALETTES[this.zone] ?? PALETTES.meadow;
    const g = this.add.graphics();
    gradientRect(g, 0, 0, 960, 330, p.skyTop, p.skyBottom);

    g.fillStyle(0xffffff, 0.85);
    for (const [cx, cy, s] of [[140, 70, 1], [480, 42, 0.75], [820, 96, 1.15]]) {
      g.fillEllipse(cx, cy, 130 * s, 38 * s);
      g.fillEllipse(cx - 38 * s, cy + 6 * s, 76 * s, 30 * s);
      g.fillEllipse(cx + 40 * s, cy + 4 * s, 86 * s, 32 * s);
      g.fillEllipse(cx + 6 * s, cy - 16 * s, 70 * s, 38 * s);
    }

    g.fillStyle(p.hill);
    g.fillEllipse(120, 330, 580, 180);
    g.fillEllipse(560, 345, 660, 150);
    g.fillEllipse(940, 330, 540, 190);
    for (const [color, dy, k] of [[p.treeDark, 0, 1], [p.tree, -6, 0.75]]) {
      g.fillStyle(color);
      for (let x = -20; x < 1000; x += 28) {
        const r = (20 + hash(x, 1) * 14) * k;
        g.fillCircle(x - (1 - k) * 8, 322 - r * 0.5 + dy, r);
      }
    }

    gradientRect(g, 0, 318, 960, 230, p.groundTop, p.groundBottom);
    g.lineStyle(3, p.blade, 0.5);
    for (let i = 0; i < 80; i++) {
      const x = hash(i, 3) * 960;
      const y = 335 + hash(i, 4) * 200;
      g.lineBetween(x, y, x - 4, y - 10);
      g.lineBetween(x + 5, y, x + 8, y - 9);
    }
    this.drawPlatform(g, ENEMY_POS.x, ENEMY_POS.y - 10, 340, 84, p);
    this.drawPlatform(g, PLAYER_POS.x, PLAYER_POS.y - 12, 430, 104, p);
  }

  drawPlatform(g, x, y, w, h, p) {
    g.fillStyle(shade(p.pad, -38));
    g.fillEllipse(x, y + 10, w, h);
    g.fillStyle(p.pad);
    g.fillEllipse(x, y, w, h);
    g.fillStyle(shade(p.pad, 14));
    g.fillEllipse(x - w * 0.05, y - h * 0.1, w * 0.82, h * 0.62);
    g.fillStyle(shade(p.pad, -12));
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (0.1 + 0.8 * (i / 13));
      const bx = x - Math.cos(a) * w * 0.47;
      const by = y + Math.sin(a) * h * 0.47;
      g.fillTriangle(bx - 5, by + 4, bx, by - 8, bx + 5, by + 4);
    }
  }

  // ---------- Luồng chính ----------

  async runBattle() {
    if (this.trainer) {
      const name = this.trainer.name;
      await tweenAsync(this, { targets: this.trainerSprite, x: ENEMY_POS.x, duration: 750, ease: 'Cubic.out' });
      this.teamBalls.forEach((b) => b.setVisible(true));
      await this.msg.show(`${name} muốn thách đấu!`);
      await tweenAsync(this, { targets: this.trainerSprite, x: ENEMY_POS.x + 600, duration: 450, ease: 'Cubic.in' });
      await this.sendOutEnemy(this.enemy);
    } else {
      await tweenAsync(this, { targets: [this.enemySprite, this.enemyShadow], x: ENEMY_POS.x, duration: 750, ease: 'Cubic.out' });
      await this.slideIn(this.enemyInfo, -60);
      await this.msg.show(`Một ${this.enemy.name} hoang dã xuất hiện!`);
    }
    await this.sendOut(this.activeIndex);

    while (!this.finished) {
      const action = await this.chooseAction();
      await this.executeTurn(action);
    }
  }

  async slideIn(info, dx) {
    const c = info.container;
    const x = c.x;
    c.setPosition(x + dx, c.y).setAlpha(0);
    info.setVisible(true);
    await tweenAsync(this, { targets: c, x, alpha: 1, duration: 250, ease: 'Cubic.out' });
  }

  async chooseAction() {
    for (;;) {
      this.msg.setText(`${this.active.name} sẽ làm gì?`, true);
      const choice = await new Menu(this, this.router, {
        x: 548, y: 548, width: 400, height: 164, columns: 2, variant: 'buttons',
        items: ACTIONS, index: this.lastAction, cancelable: false,
      }).open();
      this.lastAction = ACTIONS.findIndex((a) => a.value === choice);

      if (choice === 'fight') {
        const move = await this.chooseMove();
        if (move) return { type: 'move', move };
      } else if (choice === 'bag') {
        const action = await this.chooseItem();
        if (action) return action;
      } else if (choice === 'party') {
        const index = await this.chooseMonster(false);
        if (index === null) continue;
        const mon = state.party[index];
        if (index === this.activeIndex) await this.msg.show(`${mon.name} đang chiến đấu rồi!`);
        else if (mon.hp <= 0) await this.msg.show(`${mon.name} đã gục, không thể chiến đấu!`);
        else return { type: 'switch', index };
      } else if (this.trainer) {
        await this.msg.show('Không thể bỏ chạy khỏi trận đấu với nhà huấn luyện!');
      } else {
        return { type: 'run' };
      }
    }
  }

  async chooseMove() {
    const info = this.add.container(0, 0).setDepth(20);
    info.add(drawPanel(this, 644, 548, 304, 164));
    const infoText = this.add.text(674, 576, '', textStyle(22, '#3a4256', { lineSpacing: 10 }));
    info.add(infoText);

    // Luôn hiện đủ 4 ô chiêu, ô trống ghi "—" như game gốc
    const items = this.active.moves.map((id) => {
      const m = MOVES[id];
      return { label: m.name, sub: `${TYPES[m.type].name}  •  ${m.power}`, value: m, color: TYPES[m.type].color };
    });
    while (items.length < 4) items.push({ label: '—', disabled: true, color: 0x8a90a0 });

    const move = await new Menu(this, this.router, {
      x: 12, y: 548, width: 620, height: 164, columns: 2, variant: 'buttons', items,
      onChange: ({ value: m }) => infoText.setText(m
        ? `Hệ: ${TYPES[m.type].name} (${isSpecial(m) ? 'Đặc biệt' : 'Vật lý'})\nSức mạnh: ${m.power}\nChính xác: ${m.accuracy}%`
        : ''),
    }).open();
    info.destroy();
    return move;
  }

  // Trả về hành động dùng đồ, hoặc null nếu huỷ / không dùng được
  async chooseItem() {
    const owned = Object.keys(ITEMS).filter((id) => itemCount(id) > 0);
    if (!owned.length) {
      await this.msg.show('Túi đồ trống trơn!');
      return null;
    }
    const id = await new Menu(this, this.router, {
      x: 520, y: 24, width: 428, height: 82 + owned.length * 56,
      title: 'Túi đồ',
      rowHeight: 50,
      items: owned.map((key) => ({ label: ITEMS[key].name, sub: `x${itemCount(key)}`, value: key, icon: ITEMS[key].icon, fontSize: 24 })),
      onChange: ({ value }) => this.msg.setText(ITEMS[value].desc, true),
    }).open();
    if (!id) return null;

    const item = ITEMS[id];
    if (item.kind === 'ball') {
      if (this.trainer) {
        await this.msg.show('Không thể bắt Pokémon của người khác!');
        return null;
      }
      return { type: 'ball', id };
    }

    const index = await this.chooseMonster(false, `Dùng ${item.name} cho Pokémon nào?`);
    if (index === null) return null;
    const mon = state.party[index];
    if (item.kind === 'revive' && mon.hp > 0) {
      await this.msg.show(`${mon.name} vẫn còn chiến đấu được, không cần hồi sinh.`);
      return null;
    }
    if (item.kind === 'heal' && mon.hp <= 0) {
      await this.msg.show(`${mon.name} đã gục, cần dùng Revive.`);
      return null;
    }
    if (item.kind === 'heal' && mon.hp >= mon.maxHp) {
      await this.msg.show(`HP của ${mon.name} đang đầy.`);
      return null;
    }
    return { type: item.kind, id, index };
  }

  // forced = true khi Pokémon đang đánh bị gục: bắt buộc chọn, không huỷ được
  async chooseMonster(forced, title = null) {
    for (;;) {
      const index = await new Menu(this, this.router, {
        x: 110, y: 24, width: 740, height: 84 + state.party.length * 76,
        title: title ?? (forced ? 'Chọn Pokémon tiếp theo' : 'Pokémon'),
        rowHeight: 70,
        cancelable: !forced,
        items: state.party.map((mon, i) => ({
          mon,
          value: i,
          tag: i === this.activeIndex ? 'Đang chiến đấu' : mon.hp <= 0 ? 'Đã gục' : '',
          tagColor: mon.hp <= 0 ? '#d04040' : '#3a8a50',
        })),
      }).open();
      if (!forced || state.party[index].hp > 0) return index;
      await this.msg.show(`${state.party[index].name} đã gục, không thể chiến đấu!`);
    }
  }

  async executeTurn(action) {
    switch (action.type) {
      case 'move':
        return this.fightRound(action.move);
      case 'run':
        this.runAttempts++;
        if (Math.random() < escapeChance(this.active, this.enemy, this.runAttempts)) {
          await this.msg.show('Bạn đã chạy thoát an toàn!');
          return this.endBattle('run');
        }
        await this.msg.show('Không chạy thoát được!');
        break;
      case 'ball':
        useItem(action.id);
        if (await this.throwBall(action.id)) return;
        break;
      case 'heal':
      case 'revive': {
        useItem(action.id);
        const mon = state.party[action.index];
        const before = mon.hp;
        mon.hp = action.type === 'revive' ? Math.floor(mon.maxHp / 2) : Math.min(mon.maxHp, mon.hp + ITEMS[action.id].heal);
        await this.msg.show(`Bạn dùng ${ITEMS[action.id].name}.`);
        if (action.index === this.activeIndex) {
          this.sparkle(this.playerSprite, 0x88f0a0);
          await this.playerInfo.animateHp();
        }
        await this.msg.show(action.type === 'revive'
          ? `${mon.name} đã hồi sinh!`
          : `${mon.name} hồi phục ${mon.hp - before} HP!`);
        break;
      }
      case 'switch':
        await this.msg.show(`${this.active.name}, quay về!`);
        this.playerSprite.setTintFill(0xffffff);
        await tweenAsync(this, { targets: this.playerSprite, scale: 0, duration: 260 });
        this.playerShadow.setVisible(false);
        this.playerInfo.setVisible(false);
        await this.sendOut(action.index);
        break;
    }
    // Dùng đồ / đổi Pokémon / chạy thất bại thì đối thủ được đánh
    await this.attack(this.enemy, this.active, this.pickEnemyMove(), false);
    await this.checkFaint();
  }

  async fightRound(playerMove) {
    const player = this.active;
    const enemy = this.enemy;
    const enemyMove = this.pickEnemyMove();
    const turns = [
      () => this.attack(player, enemy, playerMove, true),
      () => this.attack(enemy, player, enemyMove, false),
    ];
    if (!playerGoesFirst(player, playerMove, enemy, enemyMove)) turns.reverse();

    for (const turn of turns) {
      await turn();
      if (await this.checkFaint()) return;
    }
  }

  pickEnemyMove() {
    return MOVES[Phaser.Utils.Array.GetRandom(this.enemy.moves)];
  }

  async attack(attacker, defender, move, isPlayer) {
    const name = isPlayer ? attacker.name : this.enemyLabel();
    await this.msg.show(`${name} dùng ${move.name}!`);
    if (!moveHits(move)) {
      await this.msg.show('Nhưng đòn đánh đã trượt!');
      return;
    }

    const atkSprite = isPlayer ? this.playerSprite : this.enemySprite;
    const defSprite = isPlayer ? this.enemySprite : this.playerSprite;
    const defInfo = isPlayer ? this.enemyInfo : this.playerInfo;
    const color = TYPES[move.type].color;
    await tweenAsync(this, { targets: atkSprite, x: atkSprite.x + (isPlayer ? 46 : -46), duration: 110, yoyo: true, ease: 'Quad.out' });
    if (move.type !== 'normal') await this.projectile(atkSprite, defSprite, color);

    const { damage, effectiveness, crit } = calcDamage(attacker, defender, move);
    defender.hp = Math.max(0, defender.hp - damage);
    this.impact(defSprite, color);
    this.cameras.main.shake(isPlayer ? 120 : 200, isPlayer ? 0.004 : 0.008);
    await Promise.all([
      tweenAsync(this, { targets: defSprite, alpha: 0.15, duration: 70, yoyo: true, repeat: 2 }),
      defInfo.animateHp(),
    ]);

    if (crit) await this.msg.show('Đòn chí mạng!');
    if (effectiveness > 1) await this.msg.show('Rất hiệu quả!');
    else if (effectiveness < 1) await this.msg.show('Không hiệu quả lắm...');
  }

  // ---------- Hiệu ứng ----------

  centerOf(sprite) {
    return { x: sprite.x, y: sprite.y - sprite.displayHeight / 2 };
  }

  async projectile(from, to, color) {
    const a = this.centerOf(from);
    const b = this.centerOf(to);
    const orb = this.add.image(a.x, a.y, 'fx-circle').setTint(color).setScale(0.45).setDepth(8);
    const core = this.add.image(a.x, a.y, 'fx-circle').setScale(0.22).setDepth(9);
    const trail = this.time.addEvent({
      delay: 25,
      loop: true,
      callback: () => {
        const t = this.add.image(orb.x, orb.y, 'fx-circle').setTint(color).setScale(0.3).setAlpha(0.6).setDepth(7);
        this.tweens.add({ targets: t, scale: 0.05, alpha: 0, duration: 260, onComplete: () => t.destroy() });
      },
    });
    await tweenAsync(this, { targets: [orb, core], x: b.x, y: b.y, duration: 320, ease: 'Quad.in' });
    trail.remove();
    orb.destroy();
    core.destroy();
  }

  impact(sprite, color) {
    const { x, y } = this.centerOf(sprite);
    const flash = this.add.image(x, y, 'fx-circle').setTint(color).setScale(0.3).setDepth(8);
    this.tweens.add({ targets: flash, scale: 2.6, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
    this.burstSparks(x, y, color, 8, 90);
  }

  burstSparks(x, y, color, count, dist) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const s = this.add.image(x, y, 'fx-spark').setTint(color).setScale(1.6).setDepth(9);
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * dist,
        y: y + Math.sin(a) * dist,
        angle: 180,
        scale: 0.3,
        alpha: 0,
        duration: 420,
        ease: 'Quad.out',
        onComplete: () => s.destroy(),
      });
    }
  }

  // Poké Ball bung ra: chớp trắng + vòng sáng + tia
  ballBurst(x, y) {
    const flash = this.add.image(x, y, 'fx-circle').setScale(0.2).setDepth(8);
    const ring = this.add.image(x, y, 'fx-ring').setScale(0.3).setDepth(8);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 350, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    this.burstSparks(x, y, 0xffffff, 10, 110);
  }

  sparkle(sprite, color) {
    const { x, y } = this.centerOf(sprite);
    for (let i = 0; i < 10; i++) {
      const s = this.add.image(x + Phaser.Math.Between(-70, 70), y + Phaser.Math.Between(-20, 70), 'fx-spark').setTint(color).setScale(0).setDepth(9);
      this.tweens.add({
        targets: s,
        y: s.y - 70,
        scale: { from: 1.8, to: 0 },
        delay: i * 50,
        duration: 600,
        onComplete: () => s.destroy(),
      });
    }
  }

  async throwArc(ball, from, to, height, duration) {
    const p = { t: 0 };
    await tweenAsync(this, {
      targets: p,
      t: 1,
      duration,
      onUpdate: () => {
        ball.x = Phaser.Math.Linear(from.x, to.x, p.t);
        ball.y = Phaser.Math.Linear(from.y, to.y, p.t) - Math.sin(p.t * Math.PI) * height;
        ball.rotation = p.t * 14;
      },
    });
  }

  // ---------- Kết quả lượt ----------

  // Trả về true nếu có Pokémon gục (lượt kết thúc ngay)
  async checkFaint() {
    if (this.enemy.hp <= 0) {
      await this.faint(this.enemySprite, this.enemyShadow);
      this.enemyInfo.setVisible(false);
      this.teamBalls?.[this.enemyTeam.indexOf(this.enemy)].setTint(0x555555).setAlpha(0.6);
      await this.msg.show(`${this.enemyLabel()} đã gục!`);
      await this.awardExp();
      const next = this.enemyTeam.find((m) => m.hp > 0);
      if (next) {
        await this.msg.show(`${this.trainer.name} sắp gửi ra ${next.name}.`);
        await this.sendOutEnemy(next);
      } else if (this.trainer) {
        await this.winTrainer();
      } else {
        await this.endBattle('win');
      }
      return true;
    }
    if (this.active.hp <= 0) {
      await this.faint(this.playerSprite, this.playerShadow);
      this.playerInfo.setVisible(false);
      await this.msg.show(`${this.active.name} đã gục!`);
      if (state.party.some((m) => m.hp > 0)) {
        await this.sendOut(await this.chooseMonster(true));
      } else {
        // Như game gốc: thua thì mất một nửa số tiền
        const lost = Math.floor(state.money / 2);
        state.money -= lost;
        await this.msg.show('Bạn không còn Pokémon nào có thể chiến đấu...');
        if (lost > 0) await this.msg.show(`Bạn đã đánh rơi ${formatMoney(lost)} trong lúc hoảng loạn...`);
        await this.msg.show('Bạn vội vàng đưa đội hình về Pokémon Center.');
        healParty();
        await this.endBattle('lose');
      }
      return true;
    }
    return false;
  }

  enemyLabel() {
    return this.trainer ? `${this.enemy.name} của đối thủ` : `${this.enemy.name} hoang dã`;
  }

  // Nhà huấn luyện ném Poké Ball gọi Pokémon ra
  async sendOutEnemy(mon) {
    this.enemy = mon;
    markSeen(mon.speciesId);
    const key = `mon-${mon.speciesId}`;
    this.enemyScale = fitScale(this, key, ENEMY_SIZE);
    this.enemySprite.setTexture(key).setPosition(ENEMY_POS.x, ENEMY_POS.y).setScale(0).setAlpha(1).setVisible(true);
    this.enemyInfo.setMonster(mon);
    await this.msg.show(`${this.trainer.name} gửi ra ${mon.name}!`);

    const open = { x: ENEMY_POS.x, y: ENEMY_POS.y - 90 };
    const ball = this.add.image(1000, 120, 'ball').setScale(BALL_SCALE).setDepth(6);
    await this.throwArc(ball, { x: 1000, y: 120 }, open, 90, 420);
    ball.destroy();
    this.ballBurst(open.x, open.y);
    this.enemySprite.setTintFill(0xffffff);
    this.enemyShadow.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.enemyShadow, alpha: 0.28, duration: 300 });
    await tweenAsync(this, { targets: this.enemySprite, scale: this.enemyScale, duration: 380, ease: 'Back.out' });
    this.enemySprite.clearTint();
    await this.slideIn(this.enemyInfo, -60);
  }

  async winTrainer() {
    const { name, lose, prize, id } = this.trainer;
    const reward = prize * this.enemyTeam[this.enemyTeam.length - 1].level;
    state.money += reward;
    await this.msg.show(`Bạn đã đánh bại ${name}!`);
    this.teamBalls.forEach((b) => b.setVisible(false));
    await tweenAsync(this, { targets: this.trainerSprite, x: ENEMY_POS.x, duration: 500, ease: 'Cubic.out' });
    await this.msg.show(`${name}: "${lose}"`);
    await this.msg.show(`Bạn nhận được ${formatMoney(reward)} tiền thưởng!`);
    await this.endBattle('win', { trainerId: id });
  }

  async faint(sprite, shadow) {
    this.tweens.add({ targets: shadow, alpha: 0, duration: 400 });
    await tweenAsync(this, { targets: sprite, y: sprite.y + 70, alpha: 0, duration: 450, ease: 'Quad.in' });
  }

  async sendOut(index) {
    this.activeIndex = index;
    const mon = this.active;
    // Có ảnh mặt sau thì dùng, không thì lật ngang ảnh mặt trước
    const backKey = `mon-${mon.speciesId}-back`;
    const hasBack = this.textures.exists(backKey);
    const key = hasBack ? backKey : `mon-${mon.speciesId}`;
    this.playerSprite
      .setTexture(key)
      .setFlipX(!hasBack)
      .setPosition(PLAYER_POS.x, PLAYER_POS.y)
      .setScale(0)
      .setAlpha(1)
      .setVisible(true);
    this.playerInfo.setMonster(mon);
    await this.msg.show(`Lên nào, ${mon.name}!`);

    const open = { x: PLAYER_POS.x, y: PLAYER_POS.y - 100 };
    const ball = this.add.image(-40, 420, 'ball').setScale(BALL_SCALE).setDepth(6);
    await this.throwArc(ball, { x: -40, y: 420 }, open, 150, 480);
    ball.destroy();
    this.ballBurst(open.x, open.y);
    this.playerSprite.setTintFill(0xffffff);
    this.playerShadow.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.playerShadow, alpha: 0.28, duration: 300 });
    await tweenAsync(this, { targets: this.playerSprite, scale: fitScale(this, key, PLAYER_SIZE), duration: 380, ease: 'Back.out' });
    this.playerSprite.clearTint();
    await this.slideIn(this.playerInfo, 60);
  }

  async awardExp() {
    const mon = this.active;
    // Pokémon của nhà huấn luyện cho thêm 50% EXP như game gốc
    const amount = Math.floor(expGain(this.enemy) * (this.trainer ? 1.5 : 1));
    await this.msg.show(`${mon.name} nhận được ${amount} EXP!`);
    const events = gainExp(mon, amount);

    for (const ev of events) {
      if (ev.type === 'levelUp') {
        await this.playerInfo.animateExp(1);
        this.playerInfo.refresh();
        this.playerInfo.setExp(0);
        this.sparkle(this.playerSprite, 0xffe066);
        await this.msg.show(`${mon.name} đã lên cấp ${ev.level}!`);
      } else if (ev.type === 'learn') {
        await this.msg.show(`${mon.name} đã học được chiêu ${MOVES[ev.move].name}!`);
      } else if (ev.type === 'cantLearn') {
        await this.msg.show(`${mon.name} muốn học ${MOVES[ev.move].name} nhưng đã biết đủ 4 chiêu.`);
      }
    }
    await this.playerInfo.animateExp(expProgress(mon));
  }

  // Trả về true nếu bắt thành công (trận đấu kết thúc)
  async throwBall(itemId) {
    const item = ITEMS[itemId];
    await this.msg.show(`Bạn ném ${item.name}!`);
    const from = { x: PLAYER_POS.x + 40, y: PLAYER_POS.y - 180 };
    const target = { x: ENEMY_POS.x, y: ENEMY_POS.y - 110 };
    const ball = this.add.image(from.x, from.y, item.icon).setScale(BALL_SCALE).setDepth(6);
    await this.throwArc(ball, from, target, 170, 560);

    this.ballBurst(target.x, target.y);
    this.enemySprite.setTintFill(0xff6060);
    await tweenAsync(this, { targets: this.enemySprite, scale: 0, y: target.y + 40, duration: 260, ease: 'Quad.in' });
    this.tweens.add({ targets: this.enemyShadow, alpha: 0.12, duration: 200 });
    ball.rotation = 0;
    await tweenAsync(this, { targets: ball, y: ENEMY_POS.y - 22, duration: 500, ease: 'Bounce.out' });

    const { caught, shakes } = rollCatch(this.enemy, item.bonus);
    for (let i = 0; i < shakes; i++) {
      await wait(this, 380);
      await tweenAsync(this, { targets: ball, angle: i % 2 ? 22 : -22, x: ball.x + (i % 2 ? 6 : -6), duration: 120, yoyo: true });
    }
    await wait(this, 380);

    if (caught) {
      ball.setTint(0xb0b0b0);
      this.burstSparks(ball.x, ball.y - 10, 0xffe066, 6, 70);
      this.enemyInfo.setVisible(false);
      await this.msg.show(`Tuyệt vời! Bạn đã bắt được ${this.enemy.name}!`);
      const where = addCaught(this.enemy);
      await this.msg.show(where === 'party'
        ? `${this.enemy.name} đã gia nhập đội hình của bạn.`
        : `Đội hình đã đủ 6, ${this.enemy.name} được gửi vào kho.`);
      await this.endBattle('catch');
      return true;
    }

    this.ballBurst(ball.x, ball.y);
    ball.destroy();
    this.enemyShadow.setAlpha(0.28);
    this.enemySprite.setPosition(ENEMY_POS.x, ENEMY_POS.y).setTintFill(0xffffff);
    await tweenAsync(this, { targets: this.enemySprite, scale: this.enemyScale, duration: 260, ease: 'Back.out' });
    this.enemySprite.clearTint();
    await this.msg.show(['Ôi không! Nó đã thoát ra!', 'Tiếc quá! Suýt nữa thì được!', 'Chỉ thiếu một chút nữa thôi!'][shakes]);
    return false;
  }

  async endBattle(result, extra = {}) {
    this.finished = true;
    this.router.clear();
    const cam = this.cameras.main;
    await new Promise((resolve) => {
      cam.once('camerafadeoutcomplete', resolve);
      cam.fadeOut(450);
    });
    this.scene.wake('World', { result, ...extra });
    this.scene.stop();
  }
}
