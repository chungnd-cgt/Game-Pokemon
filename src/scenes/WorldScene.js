import Phaser from 'phaser';
import { CELL, TILE, WORLD_SCALE } from '../config.js';
import { rollEncounter } from '../data/encounters.js';
import { ITEMS, formatMoney } from '../data/items.js';
import { HEAL_RESPAWN, MAPS, SPAWN } from '../data/map.js';
import { NPCS, TRAINERS } from '../data/npcs.js';
import { createMonster } from '../game/monster.js';
import { healParty, state } from '../game/state.js';
import { MACHINE_SLOTS } from '../gfx/interior.js';
import { fitScale } from '../gfx/textures.js';
import { ANIM_FRAMES } from '../gfx/world.js';
import { COLORS, drawHpBar, drawPanel, fixToCamera, textStyle, tweenAsync, wait } from '../ui/helpers.js';
import { InputRouter, isConfirm } from '../ui/input.js';
import { Menu } from '../ui/Menu.js';
import { MessageBox } from '../ui/MessageBox.js';

const STEP_MS = 190;
const NPC_STEP_MS = 260;
const ENCOUNTER_RATE = 0.12;
const HUD_DEPTH = 100;
const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const cellCenter = ({ x, y }) => [x * CELL + CELL / 2, (y + 1) * CELL - 4];

// Đặt frame cho nhân vật (người chơi hoặc NPC) theo hướng nhìn
function setCharFrame(sprite, facing, step = 'stand') {
  const side = facing === 'left' || facing === 'right';
  sprite.setFrame(`${side ? 'side' : facing}-${step}`);
  sprite.setFlipX(facing === 'right');
}

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  create() {
    this.stepFoot = false;
    this.moving = false;
    this.busy = false;
    this.npcs = [];
    this.shadow = this.add.image(0, 0, 'fx-shadow').setScale(0.36, 0.4).setAlpha(0.22).setDepth(9);
    this.player = this.add.sprite(0, 0, 'player', 'down-stand').setOrigin(0.5, 1).setScale(WORLD_SCALE).setDepth(10);
    this.grassFront = this.add.image(0, 0, 'grass-front').setOrigin(0).setScale(WORLD_SCALE).setDepth(11).setVisible(false);

    let animFrame = 0;
    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => {
        animFrame = (animFrame + 1) % ANIM_FRAMES;
        this.animLayer?.setFrame(String(animFrame));
      },
    });

    this.router = new InputRouter(this);
    this.msg = new MessageBox(this, this.router, 12, 548, 936, 164);
    fixToCamera(this.msg.container).setDepth(HUD_DEPTH + 5).setVisible(false);
    this.speakerTag = this.add
      .text(36, 516, '', textStyle(20, '#ffffff', { fontStyle: 'bold', backgroundColor: `#${COLORS.ink.toString(16)}`, padding: { x: 14, y: 6 } }))
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 6)
      .setVisible(false);

    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D');
    this.input.keyboard.on('keydown', (e) => isConfirm(e) && this.interact());
    this.input.keyboard.on('keydown-M', () => this.toggleParty());
    this.input.keyboard.on('keydown-P', () => this.openPokedex());
    this.events.on('wake', (_sys, data) => this.onWake(data));
    this.events.on('resume', () => this.onResume());

    this.hint = this.add
      .text(this.scale.width / 2, this.scale.height - 14, 'Mũi tên: đi   •   Enter/Space: nói chuyện   •   M: đội hình   •   P: Pokédex', textStyle(19, '#ffffff', {
        backgroundColor: 'rgba(20,26,44,0.72)',
        padding: { x: 16, y: 8 },
      }))
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.loadMap(SPAWN.map, SPAWN, SPAWN.facing);
    this.cameras.main.fadeIn(500);
  }

  update(time) {
    this.hint.setVisible(!this.msg.container.visible);
    if (!this.moving && !this.busy && !this.partyMenu) this.tryMove();
    if (!this.busy) for (const npc of this.npcs) this.updateNpc(npc, time);
    this.player.setDepth(10 + this.player.y / 10000);
    for (const npc of this.npcs) npc.sprite.setDepth(10 + npc.sprite.y / 10000);
  }

  // ---------- Bản đồ ----------

  loadMap(id, { x, y }, facing) {
    this.mapLayers?.forEach((o) => o.destroy());
    for (const npc of this.npcs) {
      npc.sprite.destroy();
      npc.shadow.destroy();
    }

    const map = MAPS[id];
    this.map = map;
    const layer = (suffix, depth, frame) => this.add.image(0, 0, `${id}-${suffix}`, frame).setOrigin(0).setScale(WORLD_SCALE).setDepth(depth);
    this.animLayer = layer('anim', 0.5, '0');
    this.mapLayers = [layer('ground', 0), this.animLayer, layer('objects', 1)];
    this.npcs = [
      ...NPCS.filter((d) => d.map === id).map((d) => this.createNpc(d, false)),
      ...TRAINERS.filter((d) => d.map === id).map((d) => this.createNpc(d, true)),
    ];

    this.pos = { x, y };
    this.facing = facing;
    this.placePlayer();
    this.setFrame('stand');

    // Bản đồ nhỏ hơn màn hình (trong nhà) thì đặt giữa màn hình, nền đen xung quanh
    const cam = this.cameras.main;
    const w = map.width * CELL;
    const h = map.height * CELL;
    if (w <= this.scale.width && h <= this.scale.height) {
      cam.stopFollow();
      cam.removeBounds();
      cam.centerOn(w / 2, h / 2 + 40);
    } else {
      cam.setBounds(0, 0, w, h).setRoundPixels(true);
      cam.startFollow(this.player, true);
    }
  }

  // Chuyển bản đồ (vào/ra nhà) với hiệu ứng tối màn hình
  warp(id, pos, facing) {
    this.busy = true;
    this.setFrame('stand');
    const cam = this.cameras.main;
    cam.fadeOut(220);
    cam.once('camerafadeoutcomplete', () => {
      this.loadMap(id, pos, facing);
      cam.fadeIn(260);
      this.input.keyboard.resetKeys();
      this.time.delayedCall(260, () => {
        this.busy = false;
      });
    });
  }

  // ---------- Người chơi ----------

  placePlayer() {
    const [x, y] = cellCenter(this.pos);
    this.player.setPosition(x, y);
    this.shadow.setPosition(x, y - 2);
    this.updateGrassFront(this.pos);
  }

  updateGrassFront({ x, y }) {
    const ch = this.map.tileAt(x, y);
    const inGrass = !this.map.indoor && (ch === 'g' || ch === 'G');
    this.grassFront.setVisible(inGrass);
    if (inGrass) {
      this.grassFront.setTexture(ch === 'G' ? 'grass-front-deep' : 'grass-front').setPosition(x * CELL, y * CELL);
    }
  }

  setFrame(step = 'stand') {
    setCharFrame(this.player, this.facing, step);
  }

  readDirection() {
    const k = this.keys;
    if (k.LEFT.isDown || k.A.isDown) return 'left';
    if (k.RIGHT.isDown || k.D.isDown) return 'right';
    if (k.UP.isDown || k.W.isDown) return 'up';
    if (k.DOWN.isDown || k.S.isDown) return 'down';
    return null;
  }

  npcAt(x, y, except = null) {
    return this.npcs.find((n) => n !== except && n.pos.x === x && n.pos.y === y) ?? null;
  }

  isBlocked(x, y, except = null) {
    return this.map.isSolid(x, y) || Boolean(this.npcAt(x, y, except));
  }

  tryMove() {
    const dir = this.readDirection();
    if (!dir) {
      this.setFrame('stand');
      return;
    }
    this.facing = dir;
    const next = { x: this.pos.x + DIRS[dir].x, y: this.pos.y + DIRS[dir].y };
    const door = dir === 'up' && this.map.doorAt(next.x, next.y);
    if (door) {
      this.warp(door.to, MAPS[door.to].entry, 'up');
      return;
    }
    if (this.isBlocked(next.x, next.y)) {
      this.setFrame('stand');
      return;
    }

    this.pos = next;
    this.moving = true;
    this.stepFoot = !this.stepFoot;
    this.setFrame(this.stepFoot ? 'left' : 'right');
    this.time.delayedCall(STEP_MS / 2, () => this.setFrame('stand'));
    this.updateGrassFront(next);
    const [x, y] = cellCenter(next);
    this.tweens.add({ targets: this.shadow, x, y: y - 2, duration: STEP_MS });
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: STEP_MS,
      onComplete: () => {
        this.moving = false;
        this.onStep();
        // Đi liền mạch nếu vẫn giữ phím
        if (!this.busy) this.tryMove();
      },
    });
  }

  onStep() {
    const info = this.map.info(this.pos.x, this.pos.y);
    if (info.exit) {
      const { to, x, y } = this.map.exit;
      this.warp(to, { x, y }, 'down');
      return;
    }
    const trainer = this.spottingTrainer();
    if (trainer) {
      this.trainerEncounter(trainer, true);
      return;
    }
    if (info.encounter) {
      this.rustle();
      if (Math.random() < ENCOUNTER_RATE) this.startEncounter(info.encounter);
    }
  }

  rustle() {
    const [x, y] = cellCenter(this.pos);
    for (let i = 0; i < 5; i++) {
      const leaf = this.add.image(x + Phaser.Math.Between(-22, 22), y - 10, 'fx-leaf').setTint(0x3f9b2f).setScale(1.5).setDepth(12);
      this.tweens.add({
        targets: leaf,
        x: leaf.x + Phaser.Math.Between(-24, 24),
        y: leaf.y - Phaser.Math.Between(16, 36),
        angle: Phaser.Math.Between(-90, 90),
        alpha: 0,
        duration: 380,
        onComplete: () => leaf.destroy(),
      });
    }
  }

  // ---------- NPC ----------

  createNpc(def, isTrainer) {
    const npc = { def, isTrainer, pos: { x: def.x, y: def.y }, facing: def.facing, moving: false, nextMove: 0 };
    const [x, y] = cellCenter(npc.pos);
    npc.shadow = this.add.image(x, y - 2, 'fx-shadow').setScale(0.36, 0.4).setAlpha(0.22).setDepth(9);
    npc.sprite = this.add.sprite(x, y, def.sprite, 'down-stand').setOrigin(0.5, 1).setScale(WORLD_SCALE).setDepth(10);
    setCharFrame(npc.sprite, npc.facing);
    return npc;
  }

  face(npc, facing) {
    npc.facing = facing;
    setCharFrame(npc.sprite, facing);
  }

  stepNpc(npc, dir) {
    npc.facing = dir;
    npc.moving = true;
    npc.pos = { x: npc.pos.x + DIRS[dir].x, y: npc.pos.y + DIRS[dir].y };
    setCharFrame(npc.sprite, dir, (npc.foot = !npc.foot) ? 'left' : 'right');
    this.time.delayedCall(NPC_STEP_MS / 2, () => setCharFrame(npc.sprite, npc.facing));
    const [x, y] = cellCenter(npc.pos);
    this.tweens.add({ targets: npc.shadow, x, y: y - 2, duration: NPC_STEP_MS });
    return tweenAsync(this, { targets: npc.sprite, x, y, duration: NPC_STEP_MS }).then(() => {
      npc.moving = false;
    });
  }

  // Dân làng đi lang thang quanh chỗ cũ; trainer và người đứng quầy thì đứng yên
  updateNpc(npc, time) {
    if (npc.isTrainer || npc.def.fixed || npc.moving || time < npc.nextMove) return;
    npc.nextMove = time + Phaser.Math.Between(1400, 3600);
    const dir = Phaser.Utils.Array.GetRandom(Object.keys(DIRS));
    const next = { x: npc.pos.x + DIRS[dir].x, y: npc.pos.y + DIRS[dir].y };
    const far = Math.abs(next.x - npc.def.x) > npc.def.wander || Math.abs(next.y - npc.def.y) > npc.def.wander;
    const playerThere = (next.x === this.pos.x && next.y === this.pos.y) || this.moving;
    const info = this.map.info(next.x, next.y);
    if (far || playerThere || this.isBlocked(next.x, next.y, npc) || info.encounter || info.exit) {
      this.face(npc, dir);
      return;
    }
    this.stepNpc(npc, dir);
  }

  // Trainer chưa bị đánh bại nhìn thấy người chơi
  spottingTrainer() {
    return this.npcs.find((t) => {
      if (!t.isTrainer || state.defeatedTrainers.has(t.def.id)) return false;
      const d = DIRS[t.facing];
      for (let i = 1; i <= t.def.sight; i++) {
        const x = t.pos.x + d.x * i;
        const y = t.pos.y + d.y * i;
        if (x === this.pos.x && y === this.pos.y) return true;
        if (this.isBlocked(x, y, t)) return false;
      }
      return false;
    }) ?? null;
  }

  async trainerEncounter(trainer, spotted) {
    this.busy = true;
    this.setFrame('stand');
    if (spotted) {
      const alert = this.add.image(trainer.sprite.x, trainer.sprite.y - 104, 'fx-alert').setScale(0).setDepth(HUD_DEPTH - 1);
      await tweenAsync(this, { targets: alert, scale: 1, duration: 180, ease: 'Back.out' });
      await wait(this, 500);
      alert.destroy();
      while (Math.abs(trainer.pos.x - this.pos.x) + Math.abs(trainer.pos.y - this.pos.y) > 1) {
        await this.stepNpc(trainer, trainer.facing);
      }
      this.facing = OPPOSITE[trainer.facing];
      this.setFrame('stand');
    }
    await this.say(trainer.def.name, [trainer.def.intro]);
    this.startBattle({ trainer: trainer.def });
  }

  // ---------- Hội thoại ----------

  async say(speaker, lines) {
    this.msg.container.setVisible(true);
    this.speakerTag.setText(speaker ?? '').setVisible(Boolean(speaker));
    for (const line of lines) await this.msg.show(line);
    this.msg.container.setVisible(false);
    this.speakerTag.setVisible(false);
  }

  async ask(question, speaker = null) {
    this.msg.container.setVisible(true);
    this.speakerTag.setText(speaker ?? '').setVisible(Boolean(speaker));
    this.msg.setText(question);
    const answer = await new Menu(this, this.router, {
      x: 760, y: 392, width: 180, height: 140, fixed: true, depth: HUD_DEPTH + 20,
      items: [{ label: 'Có', value: true }, { label: 'Không', value: false }],
    }).open();
    this.msg.container.setVisible(false);
    this.speakerTag.setVisible(false);
    return answer === true;
  }

  async interact() {
    if (this.busy || this.moving || this.partyMenu) return;
    const d = DIRS[this.facing];
    const target = { x: this.pos.x + d.x, y: this.pos.y + d.y };
    const sign = this.map.signAt(target.x, target.y);
    // Nói chuyện được qua quầy: người đứng sau quầy cách 2 ô
    const npc = this.npcAt(target.x, target.y)
      ?? (this.map.info(target.x, target.y).counter ? this.npcAt(target.x + d.x, target.y + d.y) : null);
    if (!sign && !npc) return;

    this.busy = true;
    this.setFrame('stand');
    if (sign) {
      await this.say(null, sign);
    } else if (npc.isTrainer) {
      this.face(npc, OPPOSITE[this.facing]);
      if (!state.defeatedTrainers.has(npc.def.id)) {
        this.trainerEncounter(npc, false);
        return;
      }
      await this.say(npc.def.name, [npc.def.after]);
      if (await this.ask(`Đấu lại với ${npc.def.name}?`)) {
        this.startBattle({ trainer: npc.def });
        return;
      }
    } else if (npc.def.role === 'nurse') {
      await this.nurseHeal(npc);
    } else if (npc.def.role === 'clerk') {
      this.openShop(npc);
      return;
    } else {
      npc.nextMove = this.time.now + 3000;
      this.face(npc, OPPOSITE[this.facing]);
      await this.say(npc.def.name, npc.def.lines);
    }
    this.busy = false;
  }

  // ---------- Pokémon Center ----------

  async nurseHeal(joy) {
    const name = joy.def.name;
    await this.say(name, ['Chào mừng đến Pokémon Center!', 'Chúng tôi sẽ hồi phục Pokémon của bạn về trạng thái khỏe mạnh nhất.']);
    if (!(await this.ask('Bạn có muốn hồi phục Pokémon không?', name))) {
      await this.say(name, ['Hẹn gặp lại bạn!']);
      return;
    }
    await this.say(name, ['Vâng, cho tôi mượn Pokémon của bạn một lát nhé.']);

    // Joy quay ra sau, đặt từng Poké Ball lên máy hồi phục
    this.face(joy, 'up');
    const machine = this.machineOrigin();
    const balls = [];
    for (let i = 0; i < state.party.length; i++) {
      const slot = MACHINE_SLOTS[i];
      const ball = this.add
        .image((machine.x + slot.x) * WORLD_SCALE, (machine.y + slot.y) * WORLD_SCALE, 'ball')
        .setScale(0)
        .setDepth(5);
      balls.push(ball);
      await tweenAsync(this, { targets: ball, scale: 0.17, duration: 160, ease: 'Back.out' });
      await wait(this, 140);
    }

    const panel = this.showHealPanel();
    const screen = this.add
      .rectangle((machine.x + 5) * WORLD_SCALE, (machine.y + 4) * WORLD_SCALE, 7 * WORLD_SCALE, 5 * WORLD_SCALE, 0xffffff)
      .setOrigin(0)
      .setDepth(5)
      .setAlpha(0);
    this.tweens.add({ targets: screen, alpha: 0.9, duration: 140, yoyo: true, repeat: 5 });
    this.tweens.add({ targets: balls, alpha: 0.25, duration: 140, yoyo: true, repeat: 5 });
    await panel.animate(1700);
    healParty();
    await wait(this, 300);
    screen.destroy();
    balls.forEach((b) => b.destroy());
    panel.destroy();

    this.face(joy, 'down');
    await this.say(name, ['Cảm ơn bạn đã chờ đợi!', 'Pokémon của bạn đã hồi phục hoàn toàn.']);
    await tweenAsync(this, { targets: joy.sprite, scaleY: WORLD_SCALE * 0.9, duration: 160, yoyo: true });
    await this.say(name, ['Hẹn gặp lại bạn!']);
  }

  // Toạ độ pixel (16px/ô) góc trên trái của máy hồi phục trên bản đồ hiện tại
  machineOrigin() {
    for (let y = 0; y < this.map.height; y++) {
      const x = this.map.rows[y].indexOf('m');
      if (x !== -1) return { x: x * TILE, y: y * TILE };
    }
    return { x: 0, y: 0 };
  }

  // Bảng hồi phục: thanh HP của cả đội đầy dần
  showHealPanel() {
    const party = state.party;
    const x = 540;
    const y = 30;
    const w = 400;
    const rowH = 58;
    const objs = [];
    const add = (o) => {
      objs.push(fixToCamera(o).setDepth(HUD_DEPTH + 8));
      return o;
    };
    add(drawPanel(this, x, y, w, 76 + party.length * rowH));
    add(this.add.text(x + 28, y + 22, 'Đang hồi phục...', textStyle(22, '#3a4660', { fontStyle: 'bold' })));
    const bars = add(this.add.graphics());
    const start = party.map((m) => m.hp);
    const hpTexts = party.map((mon, i) => {
      const ry = y + 70 + i * rowH;
      const key = `mon-${mon.speciesId}`;
      add(this.add.image(x + 50, ry + 20, key).setScale(fitScale(this, key, 44)));
      add(this.add.text(x + 82, ry + 2, mon.name, textStyle(20)));
      return add(this.add.text(x + w - 26, ry + 2, '', textStyle(18, '#4a5266')).setOrigin(1, 0));
    });
    const draw = (t) => {
      bars.clear();
      party.forEach((mon, i) => {
        const hp = Math.round(start[i] + (mon.maxHp - start[i]) * t);
        drawHpBar(bars, x + 82, y + 70 + i * rowH + 28, w - 112, hp / mon.maxHp);
        hpTexts[i].setText(`${hp}/${mon.maxHp}`);
      });
    };
    draw(0);
    const p = { t: 0 };
    return {
      animate: (duration) => tweenAsync(this, { targets: p, t: 1, duration, ease: 'Sine.inOut', onUpdate: () => draw(p.t) }),
      destroy: () => objs.forEach((o) => o.destroy()),
    };
  }

  // ---------- Poké Mart ----------

  async openShop(clerk) {
    await this.say(clerk.def.name, ['Xin chào! Chào mừng quý khách đến với Poké Mart!']);
    this.fromMart = true;
    this.scene.launch('Mart');
    this.scene.pause();
  }

  onResume() {
    this.input.keyboard.resetKeys();
    if (this.fromMart) {
      this.fromMart = false;
      this.busy = false;
    }
  }

  // ---------- Trận đấu ----------

  startEncounter(zone) {
    const { speciesId, level } = rollEncounter(zone);
    this.startBattle({ enemy: createMonster(speciesId, level), zone });
  }

  startBattle(data) {
    this.busy = true;
    this.setFrame('stand');
    const cam = this.cameras.main;
    cam.flash(140, 255, 255, 255);
    this.time.delayedCall(260, () => cam.flash(140, 255, 255, 255));

    // Các dải đen trượt vào từ hai bên như game gốc
    const { width, height } = this.scale;
    const bars = this.add.graphics().setScrollFactor(0).setDepth(200);
    const p = { t: 0 };
    this.transition = bars;
    this.tweens.add({
      targets: p,
      t: 1,
      delay: 520,
      duration: 520,
      ease: 'Quad.in',
      onUpdate: () => {
        bars.clear();
        bars.fillStyle(0x000000);
        const n = 8;
        const h = height / n;
        for (let i = 0; i < n; i++) {
          const w = width * p.t;
          bars.fillRect(i % 2 ? 0 : width - w, i * h, w, h + 1);
        }
      },
      onComplete: () => {
        this.scene.launch('Battle', data);
        this.scene.sleep();
      },
    });
  }

  async onWake(data) {
    this.input.keyboard.resetKeys();
    this.transition?.destroy();
    this.transition = null;
    if (data?.result === 'win' && data.trainerId) state.defeatedTrainers.add(data.trainerId);
    if (data?.result === 'lose') {
      // Tỉnh dậy trong Pokémon Center, trước mặt Y tá Joy
      this.loadMap(HEAL_RESPAWN.map, HEAL_RESPAWN, HEAL_RESPAWN.facing);
      this.cameras.main.fadeIn(500);
      await wait(this, 500);
      await this.say('Y tá Joy', ['Chúng tôi đã hồi phục Pokémon của bạn rồi.', 'Lần sau hãy cẩn thận hơn nhé!']);
      this.busy = false;
      return;
    }
    this.cameras.main.fadeIn(350);
    this.busy = false;
  }

  // ---------- Menu ----------

  openPokedex() {
    if (this.busy || this.moving || this.partyMenu) return;
    this.setFrame('stand');
    this.scene.launch('Pokedex');
    this.scene.pause();
  }

  async toggleParty() {
    if (this.partyMenu) {
      this.partyMenu.finish(null);
      return;
    }
    if (this.busy || this.moving) return;
    this.setFrame('stand');
    const bag = Object.keys(state.bag).map((id) => `${ITEMS[id].name} x${state.bag[id]}`).join('  •  ') || 'Trống';
    const items = state.party.map((mon) => ({ mon, value: mon.uid }));
    const height = 150 + items.length * 76;
    this.partyMenu = new Menu(this, this.router, {
      x: 130, y: 30, width: 700, height,
      title: `Đội hình            Tiền: ${formatMoney(state.money)}`,
      rowHeight: 70,
      items,
      fixed: true,
      depth: HUD_DEPTH + 10,
    });
    const footer = fixToCamera(
      this.add.text(160, 30 + height - 72, `Túi đồ:  ${bag}`, textStyle(18, '#6a7286', { wordWrap: { width: 640 } })).setDepth(HUD_DEPTH + 11),
    );
    await this.partyMenu.open();
    footer.destroy();
    this.partyMenu = null;
  }
}
