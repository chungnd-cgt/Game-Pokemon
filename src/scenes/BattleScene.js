import Phaser from 'phaser';
import {
  abilityOf, calcDamage, canLoseItem, confusionDamage, entryOrder, escapeChance, evYieldFor, expShares, hitCount, moveEffect, moveHits,
  playerGoesFirst, rollCatch, secondaryFactor, trappedBy, weatherHpChange,
} from '../battle/formulas.js';
import {
  STATUS_INFO, attractBlocked, bindDamage, canUseMove, changeStage, checkCanMove, checkConfusion, clearBattleState,
  clearVolatile, confuseBlocked, cureStatus, inflictConfusion, inflictStatus, stageDropReaction, stageGuarded, stageMessage,
  stageMoveUseless, startBind, startRampage, statusBlocked, statusDamage, tauntBlocked,
} from '../battle/status.js';
import {
  anticipates, contactAbility, downloadStat, harvestBerry, imposterTransform, pickupItem, rememberBerry, traceable,
} from '../battle/abilityEffects.js';
import {
  baseSpeciesId, lookShiny, movePpMax, resumeBattleForm, revertBattleForm, setBattleAbility, suspendBattleForm, transform,
  transformBlocked,
} from '../battle/transform.js';
import { ABILITIES } from '../data/abilities.js';
import { BAG_POCKETS, ITEMS, formatMoney, pocketOf } from '../data/items.js';
import { MOVES, STRUGGLE } from '../data/moves.js';
import { SPECIES } from '../data/monsters.js';
import { STAGE_SHORT, STAT_KEYS, STAT_NAMES } from '../data/stats.js';
import { TYPES } from '../data/types.js';
import { heldBerryTrigger, heldEffect } from '../game/heldItems.js';
import { applyItem, itemProblem, needsMove } from '../game/itemUse.js';
import { saveGame } from '../game/save.js';
import { ballAllowed } from '../game/safari.js';
import { settings } from '../game/settings.js';
import { trainerBeaten } from '../game/trainers.js';
import {
  HAPPINESS_FAINT, HAPPINESS_KO, MAX_LEVEL, calcStats, changeHappiness, createMonster, expProgress, gainEvs, gainExp, replaceMove,
} from '../game/monster.js';
import { addCaught, blackoutLoss, healParty, itemCount, markSeen, state, useItem, wildPrize } from '../game/state.js';
import { MONEY_MAX } from '../game/trade.js';
import { Ambience } from '../gfx/ambience.js';
import { playMoveFx } from '../gfx/moveFx.js';
import { shinyBurst } from '../gfx/shinyFx.js';
import { hash } from '../gfx/pixel.js';
import { BATTLE_CHAR_SCALE } from '../gfx/player.js';
import { GBA_MON, fitScale, monViewKey, pixelMon } from '../gfx/textures.js';
import { firstCatchThrow } from '../story/chapter1.js';
import { AbilityBanner } from '../ui/AbilityBanner.js';
import { ButtonGrid, commandIcons } from '../ui/BattleMenus.js';
import {
  CONTENT, CommandTray, ItemList, MOVE_GRID, PARTY_GRID, drawBattleFrame, moveHint, moveTipBuilder, paintMoveRow, paintPartyCell,
  renderMoveRow, renderPartyCell, showTip,
} from '../ui/BattlePanel.js';
import { BATTLE_FRAME, BLEED, battleStage, drawPanel, fitText, gradientRect, shade, textStyle, tweenAsync, wait } from '../ui/helpers.js';
import { InputRouter } from '../ui/input.js';
import { Menu } from '../ui/Menu.js';
import { MessageBox } from '../ui/MessageBox.js';
import { CHIP_ROW, MonsterInfo } from '../ui/MonsterInfo.js';

// Vị trí chân Pokémon trên bệ và chiều cao hiển thị (px)
const ENEMY_POS = { x: 690, y: 276 };
const PLAYER_POS = { x: 250, y: 516 };
const ENEMY_SIZE = 150;
const PLAYER_SIZE = 185;
const BALL_SCALE = 0.45;
// Màn hình rộng: khung trận 960x720 nằm giữa, nền vẽ tràn ra hai bên (ui/helpers.js: centerStage)
const LEFT = -BLEED;
const SPAN = 960 + BLEED * 2;
// Ngoài mép phải màn hình rộng nhất: đối thủ / nhà huấn luyện trượt vào từ đây
const OFF_RIGHT = ENEMY_POS.x + BLEED + 600;

const PALETTES = {
  meadow: {
    skyTop: 0x6cc0f8, skyBottom: 0xd8f0ff, hill: 0x9ccfa0, tree: 0x5aa860, treeDark: 0x3f8a48,
    groundTop: 0xc4ec94, groundBottom: 0x88c860, blade: 0x6aae48, pad: 0x8ccf68,
  },
  cave: {
    skyTop: 0x2a2230, skyBottom: 0x4a3e48, hill: 0x3a3038, tree: 0x4a3e3a, treeDark: 0x342a28,
    groundTop: 0x7a6a5a, groundBottom: 0x564a40, blade: 0x8a7a68, pad: 0x8a7a68,
  },
  water: {
    skyTop: 0x5aa8f0, skyBottom: 0xd0ecff, hill: 0x8cc8a0, tree: 0x4a9a58, treeDark: 0x357a44,
    groundTop: 0x6cb8f0, groundBottom: 0x3a80d0, blade: 0xb8e0ff, pad: 0x8ad0f8,
  },
  // Mặt nước ngầm trong hang (lướt nước / câu cá trong hang): trần đá như 'cave', mặt nước xanh lục thẫm, bệ là đá ướt
  caveWater: {
    skyTop: 0x241e2c, skyBottom: 0x3a3442, hill: 0x2e2a36, tree: 0x3c3640, treeDark: 0x2a2430,
    groundTop: 0x2f6a78, groundBottom: 0x163a4a, blade: 0x6ab8c8, pad: 0x5a6e74,
  },
  deep: {
    skyTop: 0x4a84c8, skyBottom: 0xb8d8f0, hill: 0x7aae84, tree: 0x3f8a48, treeDark: 0x2a6a34,
    groundTop: 0x96d070, groundBottom: 0x5a9a44, blade: 0x4a8a38, pad: 0x6eb452,
  },
};

// Loại vật phẩm dùng được từ túi trong trận; danh sách túi trong trận xếp theo thứ tự ngăn túi (bóng, thuốc, quả mọng...)
const BATTLE_KINDS = ['ball', 'heal', 'revive', 'cure', 'pp'];
const POCKET_ORDER = BAG_POCKETS.map((p) => p.id);

// 4 nút lệnh có icon ở cột phải (ui/BattlePanel.js: CommandTray): Chiến đấu, Pokémon / Túi, Chạy
const ACTIONS = [
  { label: 'Chiến đấu', value: 'fight', color: 0xe05050, icon: 'cmd-fight' },
  { label: 'Pokémon', value: 'party', color: 0x40b060, icon: 'cmd-ball' },
  { label: 'Túi đồ', value: 'bag', color: 0xe8a020, icon: 'cmd-bag' },
  { label: 'Bỏ chạy', value: 'run', color: 0x4a88e0, icon: 'cmd-run' },
];

// Thời tiết: câu báo khi bắt đầu / kết thúc, tên lớp chắn
const WEATHER_START = {
  sun: 'Nắng trở nên gay gắt!', rain: 'Trời bắt đầu đổ mưa!', sand: 'Bão cát nổi lên dữ dội!', hail: 'Mưa đá bắt đầu rơi!',
};
const WEATHER_END = { sun: 'Nắng đã dịu đi.', rain: 'Mưa đã tạnh.', sand: 'Bão cát đã lặng.', hail: 'Mưa đá đã ngừng rơi.' };
// Thời tiết ngoài bản đồ có tác dụng suốt trận (tuyết rơi chỉ là cảnh) và câu báo lúc vào trận
const FIELD_WEATHER = ['rain', 'hail', 'sand'];
const FIELD_WEATHER_TEXT = { rain: 'Trời đang mưa.', hail: 'Mưa đá đang rơi.', sand: 'Bão cát đang thổi.', snow: 'Tuyết đang rơi.' };
const WEATHER_HURT = { sand: 'bị bão cát quất trúng', hail: 'bị mưa đá đập trúng' };
const SCREENS = {
  reflect: { name: 'Reflect', guards: 'đòn vật lý' },
  lightScreen: { name: 'Light Screen', guards: 'đòn đặc biệt' },
};
// Đặc tính gọi thời tiết khi vừa ra sân
const ENTRY_WEATHER = { drought: 'sun', drizzle: 'rain', sandStream: 'sand', snowWarning: 'hail' };

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  // data: { enemy, zone } cho Pokémon hoang dã, hoặc { trainer } cho trận với nhà huấn luyện
  init(data) {
    this.outdoor = Boolean(data.ambience);
    this.trainer = data.trainer ?? null;
    // Lưu game sau mỗi lượt (tắt game giữa trận thì tải lại giữ đúng máu / PP / trạng thái, xem WorldScene.resumeInterruptedBattle)
    this.persist = Boolean(data.persist);
    this.enemyTeam = this.trainer ? this.trainer.team.map(([id, level, moves]) => createMonster(id, level, { trainer: true, moves })) : [data.enemy];
    this.enemy = this.enemyTeam[0];
    markSeen(this.enemy.speciesId);
    this.zone = data.zone ?? 'meadow';
    // Loại bóng ném được (game/safari.js: ballRule): 'normal' | 'safari' | 'any' | 'none'
    this.ballRule = data.balls ?? 'normal';
    this.activeIndex = state.party.findIndex((m) => m.hp > 0);
    this.runAttempts = 0;
    // Túi đồ nhớ dòng vừa chọn giữa các lượt trong trận này (trận mới thì về dòng đầu)
    this.bagMemory = null;
    this.finished = false;
    this.leveled = new Set();
    // Pokémon của người chơi đã ra sân đấu với Pokémon đối thủ hiện tại (chia EXP khi hạ nó), đặt lại khi đối thủ đổi con
    this.participants = new Set();
    // Thời tiết trận đấu lấy theo thời tiết ngoài bản đồ (data.weather, gfx/ambience.js): mưa, mưa đá, bão cát kéo dài
    // suốt trận; tuyết rơi chỉ là cảnh. Chiêu (Sunny Day, Rain Dance...) hoặc đặc tính (Drought, Drizzle...) đổi thời tiết
    // trong 5 lượt. weatherTurns: số lượt còn lại
    this.fieldWeather = data.weather ?? null;
    const lasting = FIELD_WEATHER.includes(this.fieldWeather) ? this.fieldWeather : null;
    this.ctx = { weather: lasting, weatherTurns: lasting ? Infinity : 0, gas: false };
    // Pokémon vừa vào thay con bị gục trong lượt: như game gốc, nó ra sân sau hiệu ứng cuối lượt nên không bị tính lượt này
    this.freshIn = new Set();
    // Lớp chắn của mỗi phe (Reflect / Light Screen): số lượt còn lại, giữ nguyên khi đổi Pokémon
    this.screens = { player: {}, enemy: {} };
    for (const mon of [...state.party, ...this.enemyTeam]) mon.stages = {};
  }

  get active() {
    return state.party[this.activeIndex];
  }

  create() {
    this.input.mouse?.disableContextMenu();
    battleStage(this); // cửa sổ nổi giữa màn hình (ui/helpers.js)
    this.router = new InputRouter(this);
    this.drawBackground();
    // Ngoài trời: ánh sáng theo giờ và mưa giống bản đồ (phủ lên nền và Pokémon, không phủ giao diện)
    this.ambience = new Ambience(this, { area: { y: 0, h: 548 }, depth: 1, rainDepth: 4.5 });
    // Trận đấu là cửa sổ nổi có camera thu nhỏ (ui/helpers.js: battleStage): lớp tối / mưa / tuyết vẽ theo khung trận
    // (không ghim theo màn hình), nếu không sẽ lệch khỏi khung. Lớp phủ bắt đầu ở x = 0, rộng bằng màn hình (>= 960)
    const amb = this.ambience;
    for (const o of [amb.overlay, amb.rain, amb.splash, amb.snow, amb.hail, amb.sand, amb.dust]) o?.setScrollFactor(1);
    this.ambience.apply({ indoor: !this.outdoor, weather: this.fieldWeather });
    // Lớp nắng vàng khi trời nắng gắt
    this.sunLight = this.add.rectangle(LEFT, 0, SPAN, 548, 0xffd070, 0.22).setOrigin(0).setDepth(1.5)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    // Lớp màu khi có bão cát (vàng đất) hoặc mưa đá (trắng xanh), phủ lên cả Pokémon
    this.weatherShade = this.add.rectangle(LEFT, 0, SPAN, 548, 0xffffff, 0).setOrigin(0).setDepth(4.6).setVisible(false);
    this.showWeather();

    const enemyKey = pixelMon(this, this.enemy.speciesId, '', GBA_MON, this.enemy.shiny);
    this.enemyScale = fitScale(this, enemyKey, ENEMY_SIZE);
    this.enemyShadow = this.add.image(OFF_RIGHT, ENEMY_POS.y - 4, 'fx-shadow').setScale(1.4, 1).setAlpha(0.28);
    this.enemySprite = this.add
      .image(OFF_RIGHT, ENEMY_POS.y, enemyKey)
      .setOrigin(0.5, 1)
      .setScale(this.enemyScale);
    this.playerShadow = this.add.image(PLAYER_POS.x, PLAYER_POS.y - 4, 'fx-shadow').setScale(1.8, 1.2).setAlpha(0.28).setVisible(false);
    this.playerSprite = this.add.image(PLAYER_POS.x, PLAYER_POS.y, enemyKey).setOrigin(0.5, 1).setVisible(false);

    if (this.trainer) {
      this.enemySprite.setVisible(false);
      this.enemyShadow.setX(ENEMY_POS.x).setVisible(false);
      this.trainerSprite = this.add
        .sprite(OFF_RIGHT, ENEMY_POS.y, this.trainer.sprite, 'down-stand')
        .setOrigin(0.5, 1)
        .setScale(BATTLE_CHAR_SCALE);
      this.teamBalls = this.enemyTeam.map((_, i) => this.add.image(70 + i * 34, 166, 'ball').setScale(0.3).setDepth(5).setVisible(false));
    }

    this.enemyInfo = new MonsterInfo(this, 40, 48, false);
    // Thẻ chỉ số đối thủ nằm dưới thanh HP: từ hàng thứ hai trở đi thì đẩy hàng bóng đội hình xuống theo
    this.enemyInfo.onStageRows = (rows) => this.teamBalls?.forEach((b) => b.setY(166 + Math.max(0, rows - 1) * CHIP_ROW));
    this.enemyInfo.setMonster(this.enemy);
    this.enemyInfo.setVisible(false);
    this.playerInfo = new MonsterInfo(this, 520, 356, true);
    this.playerInfo.setVisible(false);
    // Hộp thoại rộng hết khối trái, sát đáy khung
    this.msg = new MessageBox(this, this.router, 0, 548, 960, 164, { radius: 12, shadow: false });
    // Tên đặc tính bật lên khi đặc tính có tác dụng (Sturdy, Magic Guard, Intimidate...)
    this.abilityBanner = new AbilityBanner(this);
    commandIcons(this);
    // Khung cửa sổ: thanh tiêu đề (kéo được), ô nội dung và 4 nút lệnh bên phải (ui/BattlePanel.js)
    drawBattleFrame(this, state.player?.name || 'Bạn', this.trainer ? this.trainer.name : `${this.enemy.name} hoang dã`);
    this.commands = new CommandTray(this, this.router, ACTIONS);

    this.shareWithWorld();

    // Hiện dần cả cửa sổ (không dùng fadeIn của camera: phủ đen cả khoảng trống trong suốt phía trên khung)
    const cam = this.cameras.main.setAlpha(0);
    this.tweens.add({ targets: cam, alpha: 1, duration: 350 });
    this.runBattle().catch((err) => console.error('Lỗi trận đấu:', err));
  }

  // Trận đấu nằm chung màn hình với các cửa sổ nổi của bản đồ (túi đồ, chi tiết Pokémon, Pokédex, thẻ HLV, xem nhanh...):
  //  - Vẫn mở / dùng được các cửa sổ đó trong lúc đấu; chúng vẽ đè lên cửa sổ trận (WorldScene.renderOverBattle)
  //  - Con trỏ đang ở trên cửa sổ của bản đồ (hoặc đang kéo cửa sổ / kéo đồ) thì trận đấu nhường chuột cho bản đồ
  //    (WorldScene.pointerOverBattle); bấm vào chỗ trống trong khung trận thì không lọt xuống bản đồ phía sau
  //  - Bàn phím theo chỗ vừa bấm: cửa sổ của bản đồ (gõ tìm kiếm Pokédex...) hoặc trận đấu
  //    (WorldScene.setKeyFocus)
  shareWithWorld() {
    const world = this.scene.get('World');
    // Trận trước có thể kết thúc lúc bàn phím đang ở cửa sổ của bản đồ (đã tắt bàn phím trận): trận mới nhận phím lại
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    const F = BATTLE_FRAME;
    this.add.zone(F.x, F.y, F.w, F.h).setOrigin(0).setDepth(-20).setInteractive();
    const input = this.input;
    const update = input.update;
    const DOWN = [Phaser.Input.MOUSE_DOWN, Phaser.Input.TOUCH_START];
    input.update = (type, pointers) => {
      const over = Boolean(world?.pointerOverBattle?.(pointers[0]));
      // Bấm vào cửa sổ của bản đồ: bàn phím về cửa sổ (gõ tìm kiếm...); bấm vào khung trận: bàn phím về trận
      if (DOWN.includes(type) && world?.setKeyFocus) {
        if (over) world.setKeyFocus('windows');
        else if (this.insideFrame(pointers[0])) world.setKeyFocus('battle');
      }
      return over ? false : update.call(input, type, pointers);
    };
    const draw = (renderer) => world?.renderOverBattle?.(renderer);
    this.events.on('render', draw);
    this.events.once('shutdown', () => {
      this.events.off('render', draw);
      input.update = update;
    });
  }

  // Con trỏ nằm trong khung cửa sổ trận đấu (trên màn hình)
  insideFrame(p) {
    const cam = this.cameras.main;
    return Boolean(p) && p.x >= cam.x && p.x <= cam.x + cam.width && p.y >= cam.y && p.y <= cam.y + cam.height;
  }

  drawBackground() {
    const p = PALETTES[this.zone] ?? PALETTES.meadow;
    const g = this.add.graphics();
    gradientRect(g, LEFT, 0, SPAN, 330, p.skyTop, p.skyBottom);

    if (this.zone === 'cave' || this.zone === 'caveWater') this.drawCaveCeiling(g);
    else {
      g.fillStyle(0xffffff, 0.85);
      for (const [cx, cy, s] of [[-220, 58, 0.9], [140, 70, 1], [480, 42, 0.75], [820, 96, 1.15], [1170, 50, 0.85]]) {
        g.fillEllipse(cx, cy, 130 * s, 38 * s);
        g.fillEllipse(cx - 38 * s, cy + 6 * s, 76 * s, 30 * s);
        g.fillEllipse(cx + 40 * s, cy + 4 * s, 86 * s, 32 * s);
        g.fillEllipse(cx + 6 * s, cy - 16 * s, 70 * s, 38 * s);
      }
    }

    g.fillStyle(p.hill);
    g.fillEllipse(-300, 340, 560, 160);
    g.fillEllipse(120, 330, 580, 180);
    g.fillEllipse(560, 345, 660, 150);
    g.fillEllipse(940, 330, 540, 190);
    g.fillEllipse(1300, 340, 600, 170);
    for (const [color, dy, k] of [[p.treeDark, 0, 1], [p.tree, -6, 0.75]]) {
      g.fillStyle(color);
      for (let x = LEFT - 20; x < LEFT + SPAN + 40; x += 28) {
        const r = (20 + hash(x, 1) * 14) * k;
        g.fillCircle(x - (1 - k) * 8, 322 - r * 0.5 + dy, r);
      }
    }

    gradientRect(g, LEFT, 318, SPAN, 230, p.groundTop, p.groundBottom);
    if (this.zone === 'water' || this.zone === 'caveWater') {
      // Mặt nước: vệt gợn sóng nằm ngang (gần thì dài và rõ hơn), không phải khóm cỏ
      for (let i = 0; i < 125; i++) {
        const y = 330 + hash(i, 4) * 210;
        const near = (y - 330) / 210;
        const x = LEFT + hash(i, 3) * SPAN;
        const w = 14 + near * 26 + hash(i, 5) * 12;
        g.lineStyle(2 + Math.round(near), p.blade, 0.35 + near * 0.25);
        g.lineBetween(x - w / 2, y, x + w / 2, y);
        g.lineBetween(x - w / 4, y + 5, x + w / 3, y + 5);
      }
    } else {
      g.lineStyle(3, p.blade, 0.5);
      for (let i = 0; i < 140; i++) {
        const x = LEFT + hash(i, 3) * SPAN;
        const y = 335 + hash(i, 4) * 200;
        g.lineBetween(x, y, x - 4, y - 10);
        g.lineBetween(x + 5, y, x + 8, y - 9);
      }
    }
    this.drawPlatform(g, ENEMY_POS.x, ENEMY_POS.y - 10, 340, 84, p);
    this.drawPlatform(g, PLAYER_POS.x, PLAYER_POS.y - 12, 430, 104, p);
  }

  // Trần hang: vòm đá gồ ghề, nhũ đá thô (thân phình, thắt khúc, đầu tù) như đá vôi nhỏ giọt, có mặt sáng / tối
  drawCaveCeiling(g) {
    const ROCK = { dark: 0x241c24, base: 0x3c3038, mid: 0x4e4048, light: 0x6a5a5e, tip: 0x7c6c6a };
    // Vòm trần: dải đá dày, mép dưới lượn sóng bằng các khối tròn chồng nhau
    g.fillStyle(ROCK.dark);
    g.fillRect(LEFT, 0, SPAN, 22);
    for (let x = LEFT - 20; x < LEFT + SPAN + 40; x += 26) {
      const r = 16 + hash(x, 11) * 14;
      g.fillStyle(ROCK.dark);
      g.fillEllipse(x, 18, r * 2.4, r * 1.3);
      g.fillStyle(ROCK.base, 0.8);
      g.fillEllipse(x - r * 0.3, 12, r * 1.4, r * 0.6);
    }
    // Nhũ đá: thân là chồng các elip nhỏ dần (thắt khúc), mặt trái sáng, mặt phải tối, đầu tù có giọt nước
    for (let i = 0; i < 30; i++) {
      const x = LEFT + 20 + i * 57 + (hash(i, 12) - 0.5) * 30;
      const len = 40 + hash(i, 13) * 90;
      const w = 18 + hash(i, 14) * 18;
      const top = 18;
      const steps = 7;
      for (let k = 0; k < steps; k++) {
        const t = k / (steps - 1);
        const cy = top + t * len;
        // hẹp dần xuống đầu nhũ, thỉnh thoảng phình ra một khúc
        const bulge = Math.sin((t + hash(i, 15)) * Math.PI * 2.2) * 0.12;
        const ww = Math.max(4, w * (1 - t * 0.8 + bulge));
        const hh = len / steps + 8;
        g.fillStyle(ROCK.base);
        g.fillEllipse(x, cy, ww, hh);
        g.fillStyle(ROCK.light, 0.85);
        g.fillEllipse(x - ww * 0.2, cy - 2, ww * 0.35, hh * 0.8);
        g.fillStyle(ROCK.dark, 0.5);
        g.fillEllipse(x + ww * 0.28, cy + 2, ww * 0.3, hh * 0.75);
      }
      // đầu nhũ tù và giọt nước
      g.fillStyle(ROCK.tip);
      g.fillEllipse(x - 1, top + len + 4, 6, 7);
      if (hash(i, 16) > 0.55) {
        g.fillStyle(0x9ac8e0, 0.85);
        g.fillEllipse(x - 1, top + len + 14, 4, 6);
      }
      // nhũ con bên cạnh
      if (hash(i, 17) > 0.4) {
        const sx = x + (hash(i, 18) > 0.5 ? 1 : -1) * (w * 0.7 + 6);
        const sl = 18 + hash(i, 19) * 28;
        for (let k = 0; k < 4; k++) {
          const t = k / 3;
          g.fillStyle(ROCK.mid);
          g.fillEllipse(sx, top + t * sl, Math.max(3, 11 * (1 - t * 0.75)), sl / 4 + 6);
        }
      }
    }
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
      await this.msg.show(`${name} muốn thách đấu!`);
      await tweenAsync(this, { targets: this.trainerSprite, x: OFF_RIGHT, duration: 450, ease: 'Cubic.in' });
      await this.sendOutEnemy(this.enemy, false);
    } else {
      await tweenAsync(this, { targets: [this.enemySprite, this.enemyShadow], x: ENEMY_POS.x, duration: 750, ease: 'Cubic.out' });
      await this.shinySparkle(this.enemy, this.enemySprite);
      await this.slideIn(this.enemyInfo, -60);
      await this.msg.show(`Một ${this.enemy.name} hoang dã xuất hiện!`);
    }
    if (FIELD_WEATHER_TEXT[this.fieldWeather]) await this.msg.show(FIELD_WEATHER_TEXT[this.fieldWeather]);
    await this.sendOut(this.activeIndex, false);
    // Hai bên đã ra sân: kích hoạt đặc tính khi vào sân theo tốc độ, con nhanh trước.
    // Hai bên cùng gọi thời tiết (Drought vs Drizzle) thì con chậm hơn kích hoạt sau nên thời tiết của nó được giữ.
    for (const mon of entryOrder(this.active, this.enemy, Math.random, this.ctx)) await this.entryAbility(mon);

    while (!this.finished) {
      const action = await this.chooseAction();
      await this.executeTurn(action);
      if (this.persist && !this.finished) {
        // Nhớ Pokémon đã lên cấp: tắt game giữa trận thì tải lại vẫn xét tiến hoá cho đúng những con này
        if (state.pendingBattle) state.pendingBattle.leveled = [...this.leveled];
        saveGame();
      }
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
    // Đang cuồng nộ (Outrage): bị khoá vào chiêu, không chọn được hành động khác
    const locked = this.lockedMove(this.active);
    if (locked) return { type: 'move', move: locked };
    const action = await this.pickAction();
    this.commands.idle();
    return action;
  }

  // Chọn lệnh ở 4 nút cột phải; lệnh có danh sách (chiêu / Pokémon / túi) mở trong ô nội dung phía trên. Đang mở danh sách
  // mà bấm nút lệnh khác thì chuyển sang lệnh đó; bấm lại nút đang mở thì không làm gì (ui/BattlePanel.js CommandTray)
  async pickAction() {
    this.choosing = true;
    try {
      for (;;) {
        this.msg.setText(`${this.active.name} sẽ làm gì?`);
        const pending = this.commands.takePending();
        // Mỗi lượt bắt đầu lại từ đầu: 4 nút xám, Enter / Space là Chiến đấu (không nhớ lệnh lượt trước)
        const choice = pending ?? (await this.commands.open());
        if (pending) this.commands.mark(pending.bagItem ? 'bag' : pending);
        const action = await this.runCommand(choice);
        if (action) return action;
        // Phòng hờ: lệnh chờ trùng đúng lệnh vừa đóng thì bỏ (không mở lại chính nó)
        if (this.commands.pending === choice) this.commands.pending = null;
      }
    } finally {
      this.choosing = false;
    }
  }

  // Bấm vật phẩm trong cửa sổ túi đồ của bản đồ (hoặc ô phím tắt) lúc đang đấu (WorldScene.useFromBag): đang tới lượt chọn
  // lệnh thì tính như chọn vật phẩm đó ở lệnh Túi đồ của trận (đóng danh sách đang mở; dùng được thì mất lượt như thường).
  // Trả về câu báo nếu chưa tới lượt, null nếu đã nhận
  pickFromBag(id) {
    if (!this.choosing || this.finished) return 'Chưa tới lượt của bạn, đợi chọn lệnh rồi hãy dùng vật phẩm.';
    this.commands.inject({ bagItem: id });
    return null;
  }

  // Lệnh đã chọn: trả về hành động của lượt, hoặc null (huỷ / không làm được, chọn lại)
  async runCommand(choice) {
    if (choice === 'fight') {
      if (!this.active.moves.some((m) => canUseMove(this.active, m))) {
        await this.msg.show(`${this.active.name} không còn chiêu nào dùng được!`);
        return { type: 'move', move: STRUGGLE };
      }
      const move = await this.chooseMove();
      if (move) return { type: 'move', move };
    } else if (choice === 'bag') {
      const action = await this.chooseItem();
      if (action) return action;
    } else if (choice?.bagItem) {
      const action = await this.itemAction(choice.bagItem);
      if (action) return action;
    } else if (choice === 'party') {
      const index = await this.chooseMonster(false);
      if (index === null) return null;
      const mon = state.party[index];
      if (index === this.activeIndex) await this.msg.show(`${mon.name} đang chiến đấu rồi!`);
      else if (mon.hp <= 0) await this.msg.show(`${mon.name} đã gục, không thể chiến đấu!`);
      else if (!(await this.trapped('rút về'))) return { type: 'switch', index };
    } else if (this.trainer) {
      await this.msg.show('Không thể bỏ chạy khỏi trận đấu với nhà huấn luyện!');
    } else if (this.abilityActive(this.active, 'runAway') || !(await this.trapped('chạy trốn'))) {
      // Run Away: luôn chạy thoát khỏi Pokémon hoang dã, kể cả khi bị giữ chân
      return { type: 'run' };
    }
    return null;
  }

  // Chiêu đang bị khoá vào (Outrage), hoặc null. Đã quên chiêu đó (học chiêu mới giữa trận) thì hết cuồng nộ
  lockedMove(mon) {
    if (!mon.rampage) return null;
    if (mon.moves.includes(mon.rampage.move)) return MOVES[mon.rampage.move];
    delete mon.rampage;
    return null;
  }

  // Bị giữ chân (Magnet Pull của đối thủ với hệ Thép, bị Wrap trói): báo rồi chọn lại (không mất lượt). Trả về true nếu bị giữ chân
  async trapped(action) {
    const by = trappedBy(this.active, this.enemy, this.ctx);
    if (!by) return false;
    if (ABILITIES[by]) this.showAbility(this.enemy, by);
    if (by === 'arenaTrap') await this.msg.show(`${this.enemyLabel()} có Arena Trap! ${this.active.name} bị sa vào hố cát, không thể ${action}!`);
    else if (ABILITIES[by]) await this.msg.show(`${this.enemyLabel()} có ${ABILITIES[by].name}! ${this.active.name} bị hút chặt, không thể ${action}!`);
    else await this.msg.show(`${this.active.name} đang bị ${MOVES[by].name} trói chặt, không thể ${action}!`);
    return true;
  }

  async chooseMove() {
    // Ô nội dung cột phải: 4 dòng chiêu (tên, loại chiêu + hệ, PP); rê vào chiêu nào thì ô chi tiết hiện bên trái

    // Luôn hiện đủ 4 ô chiêu, ô trống ghi "—" như game gốc. Chiêu không dùng được (hết PP, bị phong ấn, bị khiêu khích)
    // hiện xám nhưng vẫn bấm được: báo lý do rồi chọn lại
    const mon = this.active;
    const items = mon.moves.map((id) => {
      const m = MOVES[id];
      const pp = mon.pp[id];
      const sealed = mon.disabled?.move === id;
      const taunted = mon.taunted && m.category === 'status';
      const tag = sealed ? 'BỊ PHONG ẤN' : taunted ? 'BỊ KHIÊU KHÍCH' : null;
      const usable = canUseMove(mon, id);
      return {
        label: m.name, tag, pp, maxPp: movePpMax(mon, id), value: m, color: TYPES[m.type].color,
        disabled: !usable, blocked: usable ? null : this.moveBlockedReason(mon, id),
      };
    });
    while (items.length < 4) items.push({ label: '—', disabled: true, color: 0x8a90a0 });

    // Mở ra chưa chọn chiêu nào: rê chuột vào chiêu nào thì sáng chiêu đó và hiện ô chi tiết bên cạnh (phím mũi tên bắt đầu
    // từ chiêu đầu)
    let tip = null;
    let grid = null;
    const hint = moveHint(this);
    grid = new ButtonGrid(this, this.router, {
      ...MOVE_GRID, items, bounds: CONTENT, tray: false, cancelable: false, hoverOnly: true,
      paint: paintMoveRow, render: (cell, item, w, h) => renderMoveRow(this, cell, item, w, h),
      onChange: (item, i) => {
        tip?.destroy();
        const m = item?.value;
        tip = m ? showTip(this, null, grid?.cells?.[i]?.cell.y ?? MOVE_GRID.y + 40 + i * 80, moveTipBuilder(this, m, SPECIES[this.enemy.speciesId].types)) : null;
      },
    });
    this.commands.cancelSub = () => grid.finish(null);
    const choice = await grid.open();
    tip?.destroy();
    hint.destroy();
    if (choice?.blocked) {
      // Bấm vào chiêu không dùng được: báo lý do rồi mở lại bảng chiêu
      await this.msg.show(choice.blocked);
      return this.chooseMove();
    }
    return choice;
  }

  // Lý do chiêu không dùng được (bị phong ấn > bị khiêu khích > hết PP)
  moveBlockedReason(mon, id) {
    const name = MOVES[id].name;
    if (mon.disabled?.move === id) return `${name} của ${mon.name} đang bị phong ấn, không dùng được!`;
    if (mon.taunted && MOVES[id].category === 'status') return `${mon.name} đang bị khiêu khích, không thể dùng ${name}!`;
    return `Chiêu ${name} đã hết PP!`;
  }

  // Trả về hành động dùng đồ, hoặc null nếu huỷ / không dùng được
  async chooseItem() {
    const allow = (id) => !this.itemBlocked(id);
    if (!Object.keys(ITEMS).some((id) => itemCount(id) > 0 && allow(id))) {
      await this.msg.show('Không có vật phẩm nào dùng được trong trận!');
      return null;
    }
    // Một cột vật phẩm dùng được trong ô nội dung cột phải; rê vào dòng nào thì hộp thoại hiện mô tả
    const ids = Object.keys(ITEMS)
      .filter((k) => itemCount(k) > 0 && allow(k))
      .map((k, i) => ({ k, i, p: POCKET_ORDER.indexOf(pocketOf(k)) }))
      .sort((a, b) => a.p - b.p || a.i - b.i)
      .map((e) => e.k);
    // Rê vào vật phẩm không hiện chữ / ô chi tiết gì; chỉ báo khi dùng không được (vd thuốc chữa tê liệt cho Pokémon
    // không bị tê liệt: báo rồi chọn lại, không mất lượt)
    const list = new ItemList(this, this.router, { ids, index: Math.max(0, ids.indexOf(this.bagMemory)) });
    this.commands.cancelSub = () => list.finish(null);
    const id = await list.open();
    if (!id) return null;
    return this.itemAction(id);
  }

  // Lý do vật phẩm id không dùng được trong trận này (không phải đồ dùng trong trận, loại bóng không được ném ở đây), hoặc null
  itemBlocked(id) {
    const item = ITEMS[id];
    if (!BATTLE_KINDS.includes(item.kind) || item.fieldOnly) return `Không thể dùng ${item.name} trong trận đấu!`;
    if (!ballAllowed(id, item, this.ballRule)) return `Không thể dùng ${item.name} ở đây!`;
    return null;
  }

  // Đã chọn vật phẩm id (danh sách túi của trận hoặc cửa sổ túi đồ của bản đồ): chọn Pokémon / chiêu nếu cần. Trả về hành
  // động dùng đồ, hoặc null nếu không dùng được / huỷ (đã báo lý do)
  async itemAction(id) {
    const item = ITEMS[id];
    if (!item || itemCount(id) <= 0) return null;
    const blocked = this.itemBlocked(id);
    if (blocked) {
      await this.msg.show(blocked);
      return null;
    }
    this.bagMemory = id;

    if (item.kind === 'ball') {
      if (this.trainer) {
        await this.msg.show('Không thể bắt Pokémon của người khác!');
        return null;
      }
      return { type: 'ball', id };
    }
    const problem = itemProblem(id, null, { inBattle: true });
    if (problem) {
      await this.msg.show(problem);
      return null;
    }

    const index = await this.chooseMonster(false, `Dùng ${item.name} cho Pokémon nào?`);
    if (index === null) return null;
    const mon = state.party[index];
    let moveId = null;
    if (needsMove(id)) {
      moveId = await this.choosePpMove(mon);
      if (!moveId) return null;
    }
    const why = itemProblem(id, mon, { inBattle: true, moveId });
    if (why) {
      await this.msg.show(why);
      return null;
    }
    return { type: 'item', id, index, moveId };
  }

  // Chọn chiêu để hồi PP (Leppa Berry)
  choosePpMove(mon) {
    return new Menu(this, this.router, {
      x: 250, y: 120, width: 460, height: 82 + mon.moves.length * 56, title: 'Hồi PP cho chiêu nào?', rowHeight: 50,
      items: mon.moves.map((m) => ({ label: MOVES[m].name, sub: `${mon.pp[m]}/${MOVES[m].pp}`, value: m, fontSize: 24 })),
      depth: 30,
    }).open();
  }

  // forced = true khi Pokémon đang đánh bị gục: bắt buộc chọn, không huỷ được
  async chooseMonster(forced, title = null) {
    for (;;) {
      // Ô nội dung cột phải: 2 cột x 3 (đủ 6 con); Pokémon đã gục thì mờ (ui/BattlePanel.js)
      // Lưới hình đơn giản (gục thì xám), không có ô chi tiết khi rê chuột
      this.msg.setText(title ?? (forced ? 'Chọn Pokémon tiếp theo.' : `${this.active.name} sẽ làm gì?`));
      const grid = new ButtonGrid(this, this.router, {
        ...PARTY_GRID, bounds: CONTENT, cancelable: false, tray: false,
        items: state.party.map((mon, i) => ({ mon, value: i, active: i === this.activeIndex })),
        // Bắt buộc chọn thì con trỏ đứng sẵn ở Pokémon đầu tiên còn chiến đấu được
        index: forced ? state.party.findIndex((m) => m.hp > 0) : this.activeIndex,
        paint: paintPartyCell, render: (cell, item) => renderPartyCell(this, cell, item),
      });
      // Bắt buộc chọn (Pokémon vừa gục) thì bấm nút lệnh không đóng được bảng
      this.commands.cancelSub = forced ? null : () => grid.finish(null);
      const index = await grid.open();
      if (index === null) return null;
      if (!forced || state.party[index].hp > 0) return index;
      await this.msg.show(`${state.party[index].name} đã gục, không thể chiến đấu!`);
    }
  }

  async executeTurn(action) {
    this.freshIn.clear();
    if (action.type === 'move') return this.fightRound(action.move);
    // Đối thủ chọn chiêu cùng lúc với bạn (trước khi thấy bạn đổi Pokémon / dùng đồ), như game gốc:
    // đổi sang Pokémon miễn nhiễm để đỡ đòn mới có tác dụng
    const enemyMove = this.pickEnemyMove();
    switch (action.type) {
      case 'run':
        this.runAttempts++;
        if (Math.random() < escapeChance(this.active, this.enemy, this.runAttempts, this.ctx)) {
          if (this.abilityActive(this.active, 'runAway')) {
            this.showAbility(this.active, 'runAway');
            await this.msg.show(`${this.active.name} có Run Away!`);
          }
          await this.msg.show('Bạn đã chạy thoát an toàn!');
          return this.endBattle('run');
        }
        await this.msg.show('Không chạy thoát được!');
        break;
      case 'ball':
        useItem(action.id);
        this.scene.get('World')?.refreshBag?.();
        if (await this.throwBall(action.id)) return;
        break;
      case 'item': {
        useItem(action.id);
        this.scene.get('World')?.refreshBag?.();
        const mon = state.party[action.index];
        const item = ITEMS[action.id];
        await this.msg.show(item.berry ? `${mon.name} ăn ${item.name}.` : `Bạn dùng ${item.name}.`);
        const lines = applyItem(action.id, mon, action.moveId);
        this.clampPp(mon);
        if (action.index === this.activeIndex) {
          this.sparkle(this.playerSprite, 0x88f0a0);
          await this.playerInfo.animateHp();
          this.playerInfo.refresh();
        }
        for (const line of lines) await this.msg.show(line);
        break;
      }
      case 'switch':
        await this.msg.show(`${this.active.name}, quay về!`);
        this.naturalCure(this.active);
        clearVolatile(this.active);
        // Regenerator: rút về thì hồi 1/3 HP
        if (this.abilityActive(this.active, 'regenerator') && this.active.hp < this.active.maxHp) {
          this.showAbility(this.active, 'regenerator');
          this.active.hp = Math.min(this.active.maxHp, this.active.hp + Math.floor(this.active.maxHp / 3));
        }
        this.playerSprite.setTintFill(0xffffff);
        await tweenAsync(this, { targets: this.playerSprite, scale: 0, duration: 260 });
        this.playerShadow.setVisible(false);
        this.playerInfo.setVisible(false);
        await this.sendOut(action.index);
        break;
    }
    // Dùng đồ / đổi Pokémon / chạy thất bại thì đối thủ được đánh (ra đòn sau)
    this.active.flinched = false;
    this.enemy.flinched = false;
    this.ctx.lastMover = this.enemy;
    await this.useMove(this.enemy, this.active, enemyMove);
    await this.resolveFaints();
    await this.endOfTurn();
  }

  async fightRound(playerMove) {
    const player = this.active;
    const enemy = this.enemy;
    const enemyMove = this.pickEnemyMove();
    player.flinched = false;
    enemy.flinched = false;
    const turns = [[player, enemy, playerMove], [enemy, player, enemyMove]];
    if (!playerGoesFirst(player, playerMove, enemy, enemyMove, Math.random, this.ctx)) turns.reverse();

    // Có Pokémon gục thì bên còn lại không ra đòn nữa (đối thủ đã đổi), nhưng hiệu ứng cuối lượt vẫn tính
    for (const [i, [attacker, defender, move]] of turns.entries()) {
      this.ctx.lastMover = i === 1 ? attacker : null;
      await this.useMove(attacker, defender, move);
      if (await this.resolveFaints()) break;
    }
    await this.endOfTurn();
  }

  // Đối thủ chọn ngẫu nhiên một chiêu dùng được, bỏ qua chiêu chắc chắn thất bại (không lặp mãi chiêu vô ích);
  // chiêu nào cũng vô ích thì vẫn chọn trong số đó. Hết sạch PP / bị khiêu khích hết chiêu thì dùng Struggle
  pickEnemyMove() {
    const locked = this.lockedMove(this.enemy);
    if (locked) return locked;
    const usable = this.enemy.moves.filter((m) => canUseMove(this.enemy, m)).map((m) => MOVES[m]);
    if (!usable.length) return STRUGGLE;
    const sensible = usable.filter((m) => !this.moveWouldFail(this.enemy, this.active, m));
    return Phaser.Utils.Array.GetRandom(sensible.length ? sensible : usable);
  }

  // Chiêu chắc chắn không có tác dụng lúc này (để đối thủ không chọn). Chiêu tự nổ: tránh dùng khi còn trên nửa HP
  // hoặc khi đối thủ miễn nhiễm (hệ Ma). Chiêu đổi chỉ số mà mọi chỉ số đã chạm giới hạn / bị đặc tính chặn cũng tính là vô ích
  moveWouldFail(user, target, move) {
    if (move.explode) return Boolean(this.dampOnField()) || user.hp > user.maxHp / 2 || moveEffect(move, target, this.ctx).effectiveness === 0;
    if (move.category !== 'status') {
      const effect = moveEffect(move, target, this.ctx, user);
      return effect.effectiveness === 0 || Boolean(effect.absorbedBy);
    }
    if (move.transform) return Boolean(transformBlocked(user, target));
    if (move.weather) return this.ctx.weather === move.weather;
    if (move.screen) return Boolean(this.sideOf(user)[move.screen]);
    if (move.rest) return Boolean(this.restFails(user));
    if (move.self) return stageMoveUseless(move, user, abilityOf(user, this.ctx));
    const ability = abilityOf(target, this.ctx);
    if (moveEffect(move, target, this.ctx).absorbedBy || (move.sound && ability === 'soundproof')) return true;
    if (move.confuse) return Boolean(confuseBlocked(target, ability));
    if (move.attract) return Boolean(attractBlocked(target, user, ability));
    if (move.taunt) return Boolean(tauntBlocked(target, ability));
    if (move.status) return Boolean(this.statusBlocked(target, move.status[0], move));
    return stageMoveUseless(move, target, ability);
  }

  // ---------- Ra đòn ----------

  label(mon) {
    return mon === this.enemy ? this.enemyLabel() : mon.name;
  }

  spriteOf(mon) {
    return mon === this.enemy ? this.enemySprite : this.playerSprite;
  }

  infoOf(mon) {
    return mon === this.enemy ? this.enemyInfo : this.playerInfo;
  }

  abilityActive(mon, ability) {
    return mon.hp > 0 && abilityOf(mon, this.ctx) === ability;
  }

  // Hiện bảng tên đặc tính của mon lên màn hình (không chặn trận đấu). ability: id đặc tính, mặc định đặc tính đang có tác dụng
  showAbility(mon, ability = abilityOf(mon, this.ctx) ?? mon?.ability) {
    const info = ABILITIES[ability];
    if (!mon || !info) return;
    this.abilityBanner.show(mon === this.enemy ? 'enemy' : 'player', this.label(mon), info.name);
  }

  // Pokémon có Damp trên sân (chặn chiêu tự nổ và Aftermath), hoặc undefined
  dampOnField() {
    return [this.active, this.enemy].find((m) => m && this.abilityActive(m, 'damp'));
  }

  // Lớp chắn của phe có Pokémon này, và tên phe để báo
  sideOf(mon) {
    return mon === this.enemy ? this.screens.enemy : this.screens.player;
  }

  sideName(mon) {
    return mon === this.enemy ? 'phe đối thủ' : 'phe bạn';
  }

  // Tình hình trận đấu khi đánh vào defender: kèm lớp chắn phía bên đỡ
  hitCtx(defender) {
    return { ...this.ctx, screens: this.sideOf(defender) };
  }

  // Lý do không gây được trạng thái, tính cả thời tiết và đặc tính đang có tác dụng
  statusBlocked(mon, status, move = null) {
    return statusBlocked(mon, status, move, this.weather, abilityOf(mon, this.ctx));
  }

  async useMove(attacker, defender, move) {
    const name = this.label(attacker);
    // Lượt tiếp theo của cuồng nộ (Outrage): không tốn PP
    const rampaging = Boolean(attacker.rampage);
    // Không ra đòn được (ngủ, tê liệt, chùn bước, tự đánh mình...) thì cuồng nộ bị cắt ngang, hết mà không bị rối loạn
    const disrupted = () => delete attacker.rampage;
    const { canMove, message } = checkCanMove(attacker, Math.random, abilityOf(attacker, this.ctx));
    if (message) {
      await this.msg.show(`${name} ${message}`);
      this.infoOf(attacker).refresh();
    }
    if (!canMove) {
      attacker.flinched = false;
      disrupted();
      return;
    }
    if (attacker.flinched) {
      attacker.flinched = false;
      disrupted();
      await this.msg.show(`${name} chùn bước, không ra đòn được!`);
      if (this.abilityActive(attacker, 'steadfast')) {
        this.showAbility(attacker, 'steadfast');
        await this.msg.show(`${name} có Steadfast!`);
        await this.applyStage(attacker, 'speed', 1, false);
      }
      return;
    }
    // Bị khiêu khích giữa lượt sau khi đã chọn chiêu trạng thái
    if (attacker.taunted && move.category === 'status') {
      await this.msg.show(`${name} đang bị khiêu khích nên không thể dùng ${move.name}!`);
      return;
    }
    // Rối loạn: 1/3 tự đánh vào mình thay vì ra đòn
    const confusion = checkConfusion(attacker);
    if (confusion === 'snapped') {
      await this.msg.show(`${name} đã hết rối loạn!`);
    } else if (confusion) {
      await this.msg.show(`${name} đang bị rối loạn!`);
      if (confusion === 'hitSelf') {
        disrupted();
        await this.hurtItself(attacker);
        return;
      }
    }
    // Say mê: hết khi đối tượng say mê rời sân, còn thì 50% không ra đòn được
    if (attacker.infatuated && (attacker.infatuated !== defender || defender.hp <= 0)) delete attacker.infatuated;
    if (attacker.infatuated) {
      await this.msg.show(`${name} đang say mê ${this.label(defender)}!`);
      if (Math.random() < 0.5) {
        disrupted();
        await this.msg.show(`${name} mê mẩn quá, không ra đòn được!`);
        return;
      }
    }

    // Pressure: chiêu nhắm vào nó tốn thêm 1 PP (chiêu tự dùng lên mình, đổi thời tiết thì không)
    const ppCost = this.abilityActive(defender, 'pressure') && !move.self && !move.weather ? 2 : 1;
    if (move !== STRUGGLE && !rampaging) attacker.pp[move.id] = Math.max(0, attacker.pp[move.id] - ppCost);
    if (ppCost > 1 && move !== STRUGGLE && !rampaging) this.showAbility(defender, 'pressure');
    if (move.rampage && !rampaging) startRampage(attacker, move.id);
    await this.msg.show(`${name} dùng ${move.name}!`);
    await this.checkHeldBerry(attacker);
    // Mold Breaker: trong lúc nó ra đòn, đặc tính phòng thủ của bên kia mất tác dụng (formulas.js: BREAKABLE)
    if (this.abilityActive(attacker, 'moldBreaker')) this.ctx.breaker = attacker;
    try {
      await this.moveBody(attacker, defender, move);
    } finally {
      delete this.ctx.breaker;
    }
  }

  // Phần chính của lượt ra đòn (sau khi đã báo tên chiêu)
  async moveBody(attacker, defender, move) {
    const name = this.label(attacker);
    if (move.explode) {
      // Damp: không ai tự nổ được khi nó còn trên sân (người dùng không bị gục)
      const damp = this.dampOnField();
      if (damp) {
        this.showAbility(damp, 'damp');
        await this.msg.show(`${this.label(damp)} có Damp! ${name} không thể dùng ${move.name}!`);
        return;
      }
    }
    const result = await this.performMove(attacker, defender, move);
    // Chiêu tự nổ: người dùng gục dù đánh trúng, trượt hay không có tác dụng
    if (move.explode && attacker.hp > 0) {
      attacker.hp = 0;
      await this.infoOf(attacker).animateHp();
    }
    await this.continueRampage(attacker, result);
  }

  // Sau mỗi lượt cuồng nộ: hết lượt thì bị rối loạn vì mệt (Own Tempo thì không). Trượt / không có tác dụng thì cuồng nộ
  // dừng luôn; như từ Gen 5, nếu đó là lượt cuối thì vẫn bị rối loạn
  async continueRampage(mon, result) {
    const rampage = mon.rampage;
    if (!rampage || mon.hp <= 0) return;
    rampage.turns--;
    if (result === 'hit' && rampage.turns > 0) return;
    delete mon.rampage;
    if (rampage.turns > 0 || confuseBlocked(mon, abilityOf(mon, this.ctx))) return;
    inflictConfusion(mon);
    const sprite = this.spriteOf(mon);
    this.tweens.add({ targets: sprite, angle: { from: -10, to: 10 }, duration: 90, yoyo: true, repeat: 3, onComplete: () => sprite.setAngle(0) });
    await this.msg.show(`${this.label(mon)} kiệt sức nên bị rối loạn!`);
    await this.checkHeldBerry(mon);
  }

  // High Jump Kick trượt / không có tác dụng: người dùng ngã, mất 1/2 HP tối đa (Magic Guard thì không)
  async crash(mon, move) {
    if (!move.crash || mon.hp <= 0) return;
    if (this.abilityActive(mon, 'magicGuard')) {
      this.showAbility(mon, 'magicGuard');
      return;
    }
    mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(mon.maxHp * move.crash)));
    this.impact(this.spriteOf(mon), 0xffffff);
    await Promise.all([
      tweenAsync(this, { targets: this.spriteOf(mon), alpha: 0.15, duration: 70, yoyo: true, repeat: 2 }),
      this.infoOf(mon).animateHp(),
    ]);
    await this.msg.show(`${this.label(mon)} lao quá đà và ngã đau!`);
  }

  // Rối loạn: tự đánh vào mình
  async hurtItself(mon) {
    const sprite = this.spriteOf(mon);
    mon.hp = Math.max(0, mon.hp - confusionDamage(mon));
    this.impact(sprite, 0xffffff);
    await Promise.all([
      tweenAsync(this, { targets: sprite, alpha: 0.15, duration: 70, yoyo: true, repeat: 2 }),
      this.infoOf(mon).animateHp(),
    ]);
    await this.msg.show('Nó tự đánh vào chính mình trong lúc rối loạn!');
    await this.checkHeldBerry(mon);
  }

  // Trả về 'hit' (đánh trúng), 'miss' (trượt) hoặc 'immune' (không có tác dụng / bị đặc tính chặn); chiêu trạng thái: 'status'
  async performMove(attacker, defender, move) {
    const name = this.label(attacker);
    const isPlayer = attacker !== this.enemy;
    if (move.category === 'status') {
      await this.statusMove(attacker, defender, move);
      return 'status';
    }
    if (!moveHits(move, attacker, defender, Math.random, this.ctx)) {
      await this.msg.show('Nhưng đòn đánh đã trượt!');
      await this.crash(attacker, move);
      return 'miss';
    }

    const atkSprite = this.spriteOf(attacker);
    const defSprite = this.spriteOf(defender);
    const color = TYPES[move.type]?.color ?? 0xffffff;
    // Hiệu ứng riêng của chiêu (gfx/moveFx.js): cào, cắn, tia nước, sét, roi mây... chạy xong đúng lúc trúng đòn.
    // Chiêu đánh nhiều lần thì mỗi đòn chạy lại một lần
    const lunge = () => playMoveFx(this, move, { atk: atkSprite, def: defSprite, isPlayer });
    await lunge();

    // Brick Break phá Reflect / Light Screen của đối thủ trước khi gây sát thương
    const side = this.sideOf(defender);
    if (move.breaksScreens && (side.reflect || side.lightScreen) && moveEffect(move, defender, this.ctx, attacker).effectiveness > 0) {
      delete side.reflect;
      delete side.lightScreen;
      await this.msg.show(`Lớp chắn của ${this.sideName(defender)} đã bị phá vỡ!`);
    }

    // Chiêu đánh nhiều lần: mỗi đòn tính sát thương riêng, dừng khi một bên gục
    const hits = hitCount(move, abilityOf(attacker, this.ctx));
    const multi = hits > 1;
    if (Array.isArray(move.hits) && abilityOf(attacker, this.ctx) === 'skillLink') this.showAbility(attacker, 'skillLink');
    let damage = 0;
    let landed = 0;
    let effectiveness = 1;
    for (let i = 0; i < hits && defender.hp > 0 && attacker.hp > 0; i++) {
      if (i > 0) await lunge();
      const hit = calcDamage(attacker, defender, move, Math.random, this.hitCtx(defender));
      if (hit.absorbedBy) {
        await this.absorbMove(defender, hit.absorbedBy);
        await this.crash(attacker, move);
        return 'immune';
      }
      if (hit.effectiveness === 0) {
        await this.msg.show(`Không có tác dụng với ${this.label(defender)}...`);
        await this.crash(attacker, move);
        return 'immune';
      }
      ({ effectiveness } = hit);
      landed++;
      // Đặc tính làm thay đổi sát thương đòn này (Thick Fat, Technician, Blaze...): chỉ hiện bảng tên, không báo thành lời
      if (hit.atkAbility) this.showAbility(attacker, hit.atkAbility);
      if (hit.defAbility) this.showAbility(defender, hit.defAbility);
      // Sturdy: đang đầy HP thì trụ lại với 1 HP
      const endured = this.abilityActive(defender, 'sturdy') && defender.hp === defender.maxHp && hit.damage >= defender.hp;
      const before = defender.hp;
      defender.hp = endured ? 1 : Math.max(0, defender.hp - hit.damage);
      damage += before - defender.hp;
      if (defender.hp <= 0) this.knockout = { by: attacker, target: defender };
      this.impact(defSprite, color);
      this.cameras.main.shake(isPlayer ? 120 : 200, isPlayer ? 0.004 : 0.008);
      await Promise.all([
        tweenAsync(this, { targets: defSprite, alpha: 0.15, duration: 70, yoyo: true, repeat: 2 }),
        this.infoOf(defender).animateHp(),
      ]);
      if (endured) {
        this.showAbility(defender, 'sturdy');
        await this.msg.show(`${this.label(defender)} trụ vững nhờ Sturdy!`);
      }
      if (hit.crit) await this.msg.show('Đòn chí mạng!');
      if (hit.crit && this.abilityActive(defender, 'angerPoint')) {
        this.showAbility(defender, 'angerPoint');
        await this.msg.show(`${this.label(defender)} có Anger Point! Nó nổi giận đùng đùng!`);
        await this.applyStage(defender, 'atk', 12, false);
      }
      // Chiêu đánh nhiều lần: hiệu ứng phụ và đặc tính tiếp xúc (Static...) tính theo từng đòn
      if (multi) await this.afterHit(attacker, defender, move);
    }
    if (effectiveness > 1) await this.msg.show('Rất hiệu quả!');
    else if (effectiveness < 1) await this.msg.show('Không hiệu quả lắm...');
    if (multi) await this.msg.show(`Trúng ${landed} lần!`);

    const drained = Math.max(1, Math.floor(damage * (move.drain ?? 0)));
    const guarded = this.abilityActive(attacker, 'magicGuard');
    // Magic Guard đỡ được sát thương gián tiếp (Liquid Ooze, Aftermath, phản đòn): hiện bảng tên đặc tính
    const guard = () => this.showAbility(attacker, 'magicGuard');
    if (move.drain && attacker.hp > 0 && abilityOf(defender, this.ctx) === 'liquidOoze' && guarded) {
      this.showAbility(defender, 'liquidOoze');
      guard();
    } else if (move.drain && attacker.hp > 0 && abilityOf(defender, this.ctx) === 'liquidOoze') {
      // Liquid Ooze: hút phải chất nhờn, kẻ hút mất máu thay vì được hồi
      this.showAbility(defender, 'liquidOoze');
      attacker.hp = Math.max(0, attacker.hp - drained);
      await this.infoOf(attacker).animateHp();
      await this.msg.show(`${name} hút phải chất nhờn độc của Liquid Ooze!`);
    } else if (move.drain && attacker.hp > 0 && attacker.hp < attacker.maxHp && abilityOf(defender, this.ctx) !== 'liquidOoze') {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + drained);
      await this.infoOf(attacker).animateHp();
      await this.msg.show(`${this.label(defender)} bị hút mất HP!`);
    }
    // Aftermath: Damp trên sân thì không nổ được
    const aftermath = abilityOf(defender, this.ctx) === 'aftermath' && !this.dampOnField();
    const exploded = defender.hp <= 0 && move.contact && attacker.hp > 0 && aftermath;
    if (exploded) this.showAbility(defender, 'aftermath');
    if (exploded && guarded) guard();
    if (exploded && !guarded) {
      attacker.hp = Math.max(0, attacker.hp - Math.max(1, Math.floor(attacker.maxHp / 4)));
      await this.infoOf(attacker).animateHp();
      await this.msg.show(`${this.label(defender)} có Aftermath! ${name} bị vụ nổ làm mất HP!`);
    }
    const rockHead = this.abilityActive(attacker, 'rockHead') && move !== STRUGGLE;
    if (move.recoil && attacker.hp > 0 && guarded) guard();
    else if (move.recoil && attacker.hp > 0 && rockHead) this.showAbility(attacker, 'rockHead');
    if (move.recoil && attacker.hp > 0 && !guarded && !rockHead) {
      // Struggle mất 1/4 HP tối đa; chiêu khác (Double-Edge) mất theo tỉ lệ sát thương gây ra
      const recoil = move === STRUGGLE ? attacker.maxHp * move.recoil : damage * move.recoil;
      attacker.hp = Math.max(0, attacker.hp - Math.max(1, Math.floor(recoil)));
      await this.infoOf(attacker).animateHp();
      await this.msg.show(`${name} bị phản đòn!`);
    }
    if (!multi) await this.afterHit(attacker, defender, move);
    if (move.bind && attacker.hp > 0 && startBind(defender, attacker, move.id)) {
      await this.msg.show(`${this.label(defender)} bị ${name} quấn chặt!`);
    }
    // Rapid Spin: thoát khỏi bị trói
    if (move.freesBind && attacker.hp > 0 && attacker.bound) {
      await this.msg.show(`${name} đã thoát khỏi ${MOVES[attacker.bound.move].name}!`);
      delete attacker.bound;
    }
    await this.takeItem(attacker, defender, move);
    await this.checkHeldBerry(defender);
    await this.checkHeldBerry(attacker);
    return 'hit';
  }

  // Thief / Covet: lấy đồ đối thủ đang cầm (mình phải đang không cầm gì) • Knock Off: hất văng đồ của đối thủ.
  // Sticky Hold giữ được đồ. Như game gốc từ Gen 5: đồ người chơi bị mất trong trận được trả lại khi hết trận,
  // đồ lấy của Pokémon nhà huấn luyện phải trả lại, chỉ giữ được đồ lấy của Pokémon hoang dã (xem clearBattleState).
  async takeItem(attacker, defender, move) {
    if (!(move.steal || move.knockOff) || !canLoseItem(defender)) return;
    if (move.steal && (attacker.heldItem || attacker.hp <= 0)) return;
    const id = defender.heldItem;
    const item = ITEMS[id].name;
    if (this.abilityActive(defender, 'stickyHold')) {
      this.showAbility(defender, 'stickyHold');
      await this.msg.show(`${this.label(defender)} có Sticky Hold! ${item} dính chặt, không lấy đi được!`);
      return;
    }
    // Ghi nhớ món đang cầm trước khi đổi, hết trận clearBattleState trả về đúng món này
    const remember = (mon) => {
      if (!('itemBeforeBattle' in mon)) mon.itemBeforeBattle = mon.heldItem;
    };
    if (defender !== this.enemy) remember(defender);
    defender.heldItem = null;
    this.lostItem(defender);
    if (move.steal) {
      // Đối thủ lấy đồ của người chơi (bắt được nó cũng không giữ món đó), hoặc người chơi lấy đồ của nhà huấn luyện
      // Lấy lại món mà chính đối thủ vừa cướp trong trận này: cũng ghi nhớ, hết trận món đồ về đúng chủ cũ (không nhân đôi)
      if (attacker === this.enemy || this.trainer || 'itemBeforeBattle' in defender) remember(attacker);
      attacker.heldItem = id;
      await this.msg.show(`${this.label(attacker)} đã lấy ${item} của ${this.label(defender)}!`);
    } else {
      await this.msg.show(`${this.label(attacker)} hất văng ${item} của ${this.label(defender)}!`);
    }
  }

  // Unburden: vừa mất / dùng hết đồ đang cầm thì nhanh gấp đôi (tới khi rời sân hoặc cầm lại đồ)
  lostItem(mon) {
    mon.unburdened = true;
  }

  // Đang biến hình: PP mỗi chiêu tối đa 5 (Leppa Berry / thuốc hồi PP không vượt quá)
  clampPp(mon) {
    if (!mon.transformed) return;
    for (const m of mon.moves) mon.pp[m] = Math.min(mon.pp[m], movePpMax(mon, m));
  }

  // Quả mọng đang cầm tự ăn khi cần (đối thủ có Unnerve thì không dám ăn)
  async checkHeldBerry(mon) {
    const trigger = heldBerryTrigger(mon, abilityOf(mon, this.ctx));
    if (!trigger) return;
    const foe = mon === this.enemy ? this.active : this.enemy;
    if (this.abilityActive(foe, 'unnerve')) {
      this.showAbility(foe, 'unnerve');
      return;
    }
    const id = mon.heldItem;
    mon.heldItem = null;
    rememberBerry(mon, id);
    this.lostItem(mon);
    await this.msg.show(`${this.label(mon)} ăn ${ITEMS[id].name} đang cầm!`);
    const lines = applyItem(id, mon, trigger.moveId);
    this.clampPp(mon);
    this.sparkle(this.spriteOf(mon), 0x88f0a0);
    await this.infoOf(mon).animateHp();
    this.infoOf(mon).refresh();
    for (const line of lines) await this.msg.show(line);
  }

  // Hiệu ứng phụ khi đánh trúng: gây trạng thái, đổi chỉ số, chùn bước, đặc tính của bên bị đánh
  // Hiệu ứng phụ chỉ tính khi bên trúng đòn còn đứng; đặc tính khi bị chạm (Static...) thì tính cả ở đòn hạ gục
  async afterHit(attacker, defender, move) {
    const roll = (pct) => Math.random() * 100 < pct;
    const alive = defender.hp > 0;
    const holds = (ability) => abilityOf(defender, this.ctx) === ability;
    // Xác suất hiệu ứng phụ: Shield Dust / Sheer Force bỏ hẳn (x0), Serene Grace gấp đôi (x2)
    const foeOdds = secondaryFactor(attacker, defender, move, this.ctx);
    const chance = (pct, odds = foeOdds) => odds > 0 && roll(pct * odds);
    if (alive && defender.status === 'frz' && move.type === 'fire') {
      cureStatus(defender);
      this.infoOf(defender).refresh();
      await this.msg.show(`${this.label(defender)} ${STATUS_INFO.frz.cured}`);
    }
    if (alive && move.status && chance(move.status[1])) await this.tryInflict(defender, move.status[0], move, true);
    if (alive && move.confuse && chance(move.confuse)) await this.tryConfuse(defender, true);
    // Đổi chỉ số sau đòn đánh: của đối thủ (Acid...) hoặc của chính mình (self: Metal Claw, Ancient Power, Rapid Spin).
    // Tự đổi chỉ số chắc chắn (Rapid Spin) không phải hiệu ứng phụ nên không bị các đặc tính trên ảnh hưởng
    const staged = move.self ? attacker : defender;
    const stageOdds = move.self && (move.chance ?? 100) >= 100 ? 1 : secondaryFactor(attacker, defender, move, this.ctx, Boolean(move.self));
    if (move.stages && staged.hp > 0 && chance(move.chance ?? 100, stageOdds)) {
      for (const [stat, delta] of Object.entries(move.stages)) await this.applyStage(staged, stat, delta, !move.self, true);
    }
    const stench = !move.flinch && this.abilityActive(attacker, 'stench') && chance(10);
    const flinch = (move.flinch && chance(move.flinch)) || stench;
    if (alive && flinch && this.abilityActive(defender, 'innerFocus')) {
      this.showAbility(defender, 'innerFocus');
    } else if (alive && flinch) {
      if (stench) this.showAbility(attacker, 'stench');
      defender.flinched = true;
    }
    // Bị đánh bằng đòn tiếp xúc: Static, Flame Body, Poison Point, Effect Spore (gây trạng thái), Cute Charm (say mê)
    const contact = contactAbility(attacker, defender, move, this.ctx);
    if (contact?.status && !this.statusBlocked(attacker, contact.status, contact.ability === 'effectSpore' ? { powder: true } : null)) {
      this.showAbility(defender, contact.ability);
      await this.msg.show(`${this.label(defender)} có ${ABILITIES[contact.ability].name}!`);
      await this.tryInflict(attacker, contact.status, null, true);
    } else if (contact?.attract && !attractBlocked(attacker, defender, abilityOf(attacker, this.ctx))) {
      this.showAbility(defender, 'cuteCharm');
      await this.msg.show(`${this.label(defender)} có Cute Charm!`);
      await this.infatuate(attacker, defender);
    }
    if (alive && move.category === 'physical' && this.abilityActive(defender, 'weakArmor')) {
      this.showAbility(defender, 'weakArmor');
      await this.msg.show(`${this.label(defender)} có Weak Armor!`);
      await this.applyStage(defender, 'def', -1, false);
      await this.applyStage(defender, 'speed', 2, false);
    }
    if (alive && move.contact && this.abilityActive(attacker, 'poisonTouch') && roll(30) && !this.statusBlocked(defender, 'psn')) {
      this.showAbility(attacker, 'poisonTouch');
      await this.msg.show(`${this.label(attacker)} có Poison Touch!`);
      await this.tryInflict(defender, 'psn', null, true);
    }
    if (move !== STRUGGLE && attacker.hp > 0 && !attacker.disabled && holds('cursedBody') && roll(30)) {
      attacker.disabled = { move: move.id, turns: 5 };
      this.showAbility(defender, 'cursedBody');
      await this.msg.show(`${this.label(defender)} có Cursed Body! ${move.name} của ${this.label(attacker)} bị phong ấn!`);
    }
    if (alive && ['bug', 'ghost', 'dark'].includes(move.type) && this.abilityActive(defender, 'rattled')) {
      this.showAbility(defender, 'rattled');
      await this.msg.show(`${this.label(defender)} có Rattled!`);
      await this.applyStage(defender, 'speed', 1, false);
    }
    if (alive && move.type === 'dark' && this.abilityActive(defender, 'justified')) {
      this.showAbility(defender, 'justified');
      await this.msg.show(`${this.label(defender)} có Justified!`);
      await this.applyStage(defender, 'atk', 1, false);
    }
  }

  // Đặc tính chặn chiêu (Water Absorb, Lightning Rod, Flash Fire, Levitate)
  async absorbMove(mon, ability) {
    const name = this.label(mon);
    this.showAbility(mon, ability);
    await this.msg.show(`${name} có ${ABILITIES[ability].name}!`);
    if (['waterAbsorb', 'drySkin', 'voltAbsorb'].includes(ability)) {
      if (mon.hp >= mon.maxHp) {
        await this.msg.show(`Không có tác dụng với ${name}...`);
        return;
      }
      mon.hp = Math.min(mon.maxHp, mon.hp + Math.floor(mon.maxHp / 4));
      this.sparkle(this.spriteOf(mon), 0x60b8f0);
      await this.infoOf(mon).animateHp();
      await this.msg.show(`${name} hồi phục HP!`);
    } else if (ability === 'lightningRod') {
      await this.applyStage(mon, 'spAtk', 1, false);
    } else if (ability === 'flashFire') {
      mon.flashFire = true;
      await this.msg.show(`Chiêu hệ Lửa của ${name} mạnh lên!`);
    } else {
      await this.msg.show(`Không có tác dụng với ${name}...`);
    }
  }

  async statusMove(attacker, defender, move) {
    const target = move.self ? attacker : defender;
    if (!move.self) {
      const { absorbedBy } = moveEffect(move, defender, this.ctx);
      if (absorbedBy) {
        await this.absorbMove(defender, absorbedBy);
        return;
      }
      if (move.sound && this.abilityActive(defender, 'soundproof')) {
        this.showAbility(defender, 'soundproof');
        await this.msg.show(`${this.label(defender)} có Soundproof, không nghe thấy gì cả!`);
        return;
      }
      if (!moveHits(move, attacker, defender, Math.random, this.ctx)) {
        await this.msg.show('Nhưng đòn đánh đã trượt!');
        return;
      }
    }
    // Hiệu ứng riêng của chiêu (âm thanh, phấn, tim, lửa ma...); chiêu không có hiệu ứng riêng thì: đổi chỉ số có mũi tên
    // riêng (stageAnim), còn lại lấp lánh theo màu hệ
    if (move.transform) {
      await this.useTransform(attacker, defender);
      return;
    }
    const isPlayer = attacker !== this.enemy;
    const played = await playMoveFx(this, move, { atk: this.spriteOf(attacker), def: this.spriteOf(defender), isPlayer });
    if (!played && !move.stages) this.sparkle(this.spriteOf(target), TYPES[move.type].color);
    if (move.rest) {
      await this.useRest(attacker);
      return;
    }
    if (!['weather', 'status', 'stages', 'confuse', 'attract', 'taunt', 'screen'].some((k) => move[k])) {
      await this.msg.show('Nhưng chẳng có gì xảy ra!');
      return;
    }
    if (move.weather) await this.setWeather(move.weather);
    if (move.screen) await this.raiseScreen(attacker, move.screen);
    if (move.confuse) await this.tryConfuse(target, false);
    if (move.attract) await this.tryAttract(attacker, target);
    if (move.taunt) await this.tryTaunt(target);
    if (move.status) await this.tryInflict(target, move.status[0], move, false);
    if (move.stages) {
      for (const [stat, delta] of Object.entries(move.stages)) await this.applyStage(target, stat, delta, !move.self);
    }
  }

  // Rest: hồi đầy HP, chữa trạng thái xấu rồi ngủ đúng 2 lượt (lượt thứ 3 tỉnh dậy và ra đòn, như từ Gen 5)
  async useRest(mon) {
    const reason = this.restFails(mon);
    if (reason) {
      await this.msg.show(reason);
      return;
    }
    mon.hp = mon.maxHp;
    cureStatus(mon);
    mon.status = 'slp';
    mon.sleepTurns = 2;
    await this.msg.show(`${this.label(mon)} ngủ một giấc thật say và hồi phục sức khoẻ!`);
    await this.infoOf(mon).animateHp();
    this.infoOf(mon).refresh();
  }

  // Lý do Rest thất bại, hoặc null
  restFails(mon) {
    const ability = abilityOf(mon, this.ctx);
    if (['insomnia', 'vitalSpirit'].includes(ability) || (ability === 'leafGuard' && this.weather === 'sun')) this.showAbility(mon, ability);
    if (['insomnia', 'vitalSpirit'].includes(ability)) return `${this.label(mon)} có ${ABILITIES[ability].name}, không ngủ được!`;
    if (ability === 'leafGuard' && this.weather === 'sun') return `${this.label(mon)} có Leaf Guard, không ngủ được dưới nắng!`;
    if (mon.hp >= mon.maxHp) return 'Nhưng không có tác dụng!';
    return null;
  }

  // Dựng Reflect / Light Screen cho phe mình trong 5 lượt
  async raiseScreen(mon, screen) {
    const side = this.sideOf(mon);
    if (side[screen]) {
      await this.msg.show('Nhưng không có tác dụng!');
      return;
    }
    side[screen] = 5;
    await this.msg.show(`${SCREENS[screen].name} bảo vệ ${this.sideName(mon)} khỏi ${SCREENS[screen].guards}!`);
  }

  // Gây rối loạn. quiet: hiệu ứng phụ của chiêu gây sát thương (không báo khi không gây được)
  async tryConfuse(mon, quiet) {
    const blocked = confuseBlocked(mon, abilityOf(mon, this.ctx));
    if (blocked) {
      if (quiet || blocked === 'fainted') return;
      if (blocked === 'immune') this.showAbility(mon, 'ownTempo');
      await this.msg.show(blocked === 'already' ? `${this.label(mon)} đang bị rối loạn rồi!` : `${this.label(mon)} có Own Tempo, không bị rối loạn!`);
      return;
    }
    inflictConfusion(mon);
    const sprite = this.spriteOf(mon);
    this.tweens.add({ targets: sprite, angle: { from: -10, to: 10 }, duration: 90, yoyo: true, repeat: 3, onComplete: () => sprite.setAngle(0) });
    await this.msg.show(`${this.label(mon)} bị rối loạn!`);
    await this.checkHeldBerry(mon); // cầm Lum Berry thì chữa ngay, không đợi cuối lượt
  }

  // Attract: đối thủ khác giới say mê người dùng
  async tryAttract(source, mon) {
    const blocked = attractBlocked(mon, source, abilityOf(mon, this.ctx));
    if (blocked === 'immune') this.showAbility(mon, 'oblivious');
    if (blocked === 'immune') await this.msg.show(`${this.label(mon)} có Oblivious, chẳng để ý gì cả!`);
    else if (blocked) await this.msg.show('Nhưng không có tác dụng!');
    if (blocked) return;
    await this.infatuate(mon, source);
  }

  // Say mê source (Attract, Cute Charm): 50% không ra đòn được, hết khi source rời sân
  async infatuate(mon, source) {
    // Không đếm khi lưu (JSON): hai bên mê nhau thì sẽ thành vòng tham chiếu
    Object.defineProperty(mon, 'infatuated', { value: source, enumerable: false, configurable: true, writable: true });
    const { x, y } = this.centerOf(this.spriteOf(mon));
    this.burstSparks(x, y, 0xf878b0, 8, 70);
    await this.msg.show(`${this.label(mon)} đã phải lòng ${this.label(source)}!`);
  }

  // Taunt: 3 lượt không dùng được chiêu trạng thái (đối thủ đã ra đòn trong lượt này thì tính thêm lượt này)
  async tryTaunt(mon) {
    const blocked = tauntBlocked(mon, abilityOf(mon, this.ctx));
    if (blocked === 'immune') this.showAbility(mon, 'oblivious');
    if (blocked === 'immune') await this.msg.show(`${this.label(mon)} có Oblivious, chẳng để ý gì cả!`);
    else if (blocked) await this.msg.show('Nhưng không có tác dụng!');
    if (blocked) return;
    mon.taunted = this.ctx.lastMover && this.ctx.lastMover !== mon ? 4 : 3;
    await this.msg.show(`${this.label(mon)} bị khiêu khích!`);
  }

  // Gây trạng thái xấu. quiet: hiệu ứng phụ của chiêu gây sát thương (không báo khi không gây được)
  async tryInflict(mon, status, move, quiet) {
    const blocked = this.statusBlocked(mon, status, move);
    if (blocked) {
      if (quiet) return;
      let text = 'Nhưng không có tác dụng!';
      if (blocked === 'already' && mon.status === status) text = `${this.label(mon)} đang bị ${STATUS_INFO[status].name} rồi!`;
      else if (blocked === 'immune') text = `Không có tác dụng với ${this.label(mon)}...`;
      // Bị chặn nhờ đặc tính (Limber, Immunity, Insomnia, Water Veil, Leaf Guard, Overcoat) chứ không phải nhờ hệ
      const ability = abilityOf(mon, this.ctx);
      if (blocked === 'immune' && ability && !statusBlocked(mon, status, move, this.weather, null)) {
        this.showAbility(mon, ability);
        text = `${this.label(mon)} có ${ABILITIES[ability].name}! Không có tác dụng với ${this.label(mon)}...`;
      }
      await this.msg.show(text);
      return;
    }
    inflictStatus(mon, status);
    this.infoOf(mon).refresh();
    const sprite = this.spriteOf(mon);
    this.tweens.add({ targets: sprite, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => sprite.setAngle(0) });
    await this.msg.show(`${this.label(mon)} ${STATUS_INFO[status].inflicted}`);
    // Synchronize: bị gây bỏng / độc / tê liệt thì đối thủ cũng bị y như vậy
    const foe = mon === this.enemy ? this.active : this.enemy;
    if (['brn', 'psn', 'par'].includes(status) && this.abilityActive(mon, 'synchronize') && foe?.hp > 0 && !this.statusBlocked(foe, status)) {
      this.showAbility(mon, 'synchronize');
      await this.msg.show(`${this.label(mon)} có Synchronize!`);
      await this.tryInflict(foe, status, null, true);
    }
    await this.checkHeldBerry(mon);
  }

  // Đổi bậc chỉ số. byFoe: do đối thủ gây ra (Keen Eye, Big Pecks chặn được). quiet: không báo khi đã chạm giới hạn
  async applyStage(mon, stat, delta, byFoe, quiet = false) {
    const guard = stageGuarded(stat, delta, abilityOf(mon, this.ctx), byFoe);
    if (guard) {
      this.showAbility(mon, guard);
      if (!quiet) await this.msg.show(`${this.label(mon)} có ${ABILITIES[guard].name}, ${STAGE_SHORT[stat]} không bị giảm!`);
      return;
    }
    const changed = changeStage(mon, stat, delta);
    if (changed === 0 && quiet) return;
    if (changed !== 0) {
      await this.stageAnim(mon, changed);
      this.infoOf(mon).refresh();
    }
    await this.msg.show(stageMessage(this.label(mon), stat, changed, delta));
    // Defiant / Competitive: bị đối thủ giảm chỉ số thì nổi máu
    const reaction = mon.hp > 0 && stageDropReaction(abilityOf(mon, this.ctx), changed, byFoe);
    if (reaction) {
      this.showAbility(mon);
      await this.msg.show(`${this.label(mon)} có ${ABILITIES[mon.ability].name}!`);
      await this.applyStage(mon, reaction.stat, reaction.delta, false);
    }
  }

  // Đặc tính kích hoạt khi vừa ra sân
  async entryAbility(mon) {
    const foe = mon === this.enemy ? this.active : this.enemy;
    this.updateGas();
    if (this.abilityActive(mon, 'cloudNine')) {
      this.showAbility(mon, 'cloudNine');
      await this.msg.show(`${this.label(mon)} có Cloud Nine! Thời tiết mất tác dụng.`);
      return;
    }
    if (mon.ability === 'neutralizingGas' && this.ctx.gas) {
      this.showAbility(mon, 'neutralizingGas');
      await this.msg.show(`${this.label(mon)} có Neutralizing Gas!`);
      await this.msg.show('Khí trung hoà bao trùm chiến trường!');
      return;
    }
    const weather = ENTRY_WEATHER[abilityOf(mon, this.ctx)];
    if (weather && mon.hp > 0) {
      this.showAbility(mon);
      await this.msg.show(`${this.label(mon)} có ${ABILITIES[mon.ability].name}!`);
      await this.setWeather(weather);
    } else if (this.abilityActive(mon, 'intimidate') && foe?.hp > 0) {
      this.showAbility(mon, 'intimidate');
      await this.msg.show(`${this.label(mon)} có Intimidate!`);
      await this.applyStage(foe, 'atk', -1, true);
    } else if (this.abilityActive(mon, 'forewarn') && foe?.hp > 0) {
      this.showAbility(mon, 'forewarn');
      const strongest = foe.moves.map((m) => MOVES[m]).reduce((a, b) => ((b.power ?? 0) > (a.power ?? 0) ? b : a));
      await this.msg.show(`${this.label(mon)} có Forewarn! Nó đoán được chiêu ${strongest.name} của ${this.label(foe)}.`);
    } else if (this.abilityActive(mon, 'unnerve')) {
      this.showAbility(mon, 'unnerve');
      await this.msg.show(`${this.label(mon)} có Unnerve! Phe đối thủ quá căng thẳng, không dám ăn quả mọng!`);
    } else if (this.abilityActive(mon, 'imposter') && foe?.hp > 0) {
      // Imposter: biến hình ngay thành đối thủ (đối thủ đang biến hình thì không được)
      if (imposterTransform(mon, foe, this.ctx)) await this.showTransform(mon, foe, 'imposter');
    } else if (this.abilityActive(mon, 'trace') && foe?.hp > 0 && traceable(abilityOf(foe, this.ctx))) {
      // Trace: sao chép đặc tính của đối thủ tới khi rời sân; đặc tính chép được mà có tác dụng khi vào sân thì kích hoạt luôn
      const copied = foe.ability;
      setBattleAbility(mon, copied);
      this.showAbility(mon, 'trace');
      await this.msg.show(`${this.label(mon)} có Trace! Nó sao chép ${ABILITIES[copied].name} của ${this.label(foe)}!`);
      await this.entryAbility(mon);
    } else if (this.abilityActive(mon, 'download') && foe?.hp > 0) {
      this.showAbility(mon, 'download');
      await this.msg.show(`${this.label(mon)} có Download!`);
      await this.applyStage(mon, downloadStat(foe), 1, false);
    } else if (this.abilityActive(mon, 'frisk') && foe?.hp > 0 && foe.heldItem && ITEMS[foe.heldItem]) {
      this.showAbility(mon, 'frisk');
      await this.msg.show(`${this.label(mon)} có Frisk! Nó phát hiện ${this.label(foe)} đang cầm ${ITEMS[foe.heldItem].name}.`);
    } else if (this.abilityActive(mon, 'anticipation') && foe?.hp > 0 && anticipates(mon, foe)) {
      this.showAbility(mon, 'anticipation');
      await this.msg.show(`${this.label(mon)} có Anticipation! Nó rùng mình vì linh cảm thấy nguy hiểm!`);
    } else if (this.abilityActive(mon, 'pressure') && foe?.hp > 0) {
      this.showAbility(mon, 'pressure');
      await this.msg.show(`${this.label(mon)} đang gây áp lực!`);
    } else if (this.abilityActive(mon, 'moldBreaker')) {
      this.showAbility(mon, 'moldBreaker');
      await this.msg.show(`${this.label(mon)} có Mold Breaker! Nó phá vỡ mọi khuôn phép!`);
    }
  }

  // ---------- Biến hình ----------

  // Chiêu Transform
  async useTransform(user, target) {
    if (!transform(user, target)) {
      await this.msg.show('Nhưng không có tác dụng!');
      return;
    }
    await this.showTransform(user, target);
  }

  // Hiệu ứng biến hình: sáng trắng, bóp dẹt rồi bung ra thành hình của đối thủ (mặt trước / mặt sau tuỳ phe), kèm thông báo
  async showTransform(user, target, ability = null) {
    if (ability) {
      this.showAbility(user, ability);
      await this.msg.show(`${this.label(user)} có ${ABILITIES[ability].name}!`);
    }
    const sprite = this.spriteOf(user);
    const { x, y } = this.centerOf(sprite);
    this.burstSparks(x, y, 0xc4a0ec, 10, 90);
    sprite.setTintFill(0xffffff);
    const tall = sprite.scaleY;
    await tweenAsync(this, { targets: sprite, scaleX: 0, scaleY: tall * 1.2, duration: 220, ease: 'Quad.in' });
    const scale = this.applyLook(user);
    sprite.setScale(0, scale * 1.2);
    await tweenAsync(this, { targets: sprite, scaleX: scale, scaleY: scale, duration: 300, ease: 'Back.out' });
    sprite.clearTint();
    this.infoOf(user).refresh();
    await this.msg.show(`${this.label(user)} biến hình thành ${SPECIES[target.speciesId].name}!`);
  }

  // Đổi hình trên sân theo loài / màu shiny đang mang (biến hình hoặc dạng gốc). Trả về tỉ lệ phóng to đúng cỡ
  applyLook(mon) {
    const shiny = lookShiny(mon);
    if (mon === this.enemy) {
      const key = pixelMon(this, mon.speciesId, '', GBA_MON, shiny);
      this.enemyScale = fitScale(this, key, ENEMY_SIZE);
      this.enemySprite.setTexture(key);
      return this.enemyScale;
    }
    const hasBack = monViewKey(this, mon.speciesId, '-back') !== `mon-${mon.speciesId}`;
    const key = pixelMon(this, mon.speciesId, hasBack ? '-back' : '', 80, shiny);
    this.playerSprite.setTexture(key).setFlipX(!hasBack);
    return fitScale(this, key, PLAYER_SIZE);
  }

  // Đổi thời tiết trận đấu trong 5 lượt (đang có đúng thời tiết đó thì không có tác dụng)
  async setWeather(weather) {
    if (this.ctx.weather === weather) {
      await this.msg.show('Nhưng không có tác dụng!');
      return;
    }
    this.ctx.weather = weather;
    this.ctx.weatherTurns = 5;
    this.showWeather();
    await this.msg.show(WEATHER_START[weather]);
    if (this.ctx.cloudNine) {
      const nine = [this.active, this.enemy].find((m) => m && this.abilityActive(m, 'cloudNine'));
      if (nine) this.showAbility(nine, 'cloudNine');
      await this.msg.show('Nhưng Cloud Nine làm thời tiết mất tác dụng.');
    }
  }

  showWeather() {
    const { weather } = this.ctx;
    this.sunLight.setVisible(weather === 'sun');
    const shade = { sand: [0xc8a060, 0.32], hail: [0xe0f2ff, 0.3] }[weather];
    this.weatherShade.setVisible(Boolean(shade));
    if (shade) this.weatherShade.setFillStyle(...shade);
    // Hạt thời tiết: theo thời tiết trận đấu; trời quang mà ngoài bản đồ đang tuyết rơi thì vẫn thấy tuyết
    this.ambience.setPrecip(weather ?? (this.fieldWeather === 'snow' ? 'snow' : null));
  }

  // Natural Cure: rút về hoặc hết trận thì khỏi trạng thái xấu
  naturalCure(mon) {
    if (mon?.status && mon.hp > 0 && abilityOf(mon, this.ctx) === 'naturalCure') cureStatus(mon);
  }

  updateGas() {
    const field = [this.active, this.enemy].filter((m) => m && m.hp > 0);
    this.ctx.gas = field.some((m) => m.ability === 'neutralizingGas');
    // Cloud Nine: thời tiết vẫn còn nhưng mất tác dụng khi nó trên sân
    this.ctx.cloudNine = field.some((m) => abilityOf(m, this.ctx) === 'cloudNine');
  }

  // Thời tiết đang có tác dụng (Cloud Nine trên sân thì không có)
  get weather() {
    return this.ctx.cloudNine ? null : this.ctx.weather;
  }

  // Cuối lượt: bão cát / mưa đá làm mất máu (Ice Body thì hồi máu), mưa hồi máu (Rain Dish), nắng đốt máu (Solar Power),
  // tự khỏi trạng thái (Shed Skin, Hydration), mất máu vì bỏng / độc (Magic Guard thì không), hết khiêu khích,
  // rồi thời tiết và lớp chắn bớt một lượt
  async endOfTurn() {
    if (this.finished) return;
    for (const mon of [this.active, this.enemy]) {
      if (mon.hp <= 0 || this.freshIn.has(mon)) continue;
      const name = this.label(mon);
      const change = weatherHpChange(mon, this.ctx);
      if (change !== 0) {
        mon.hp += change;
        if (change < 0) await tweenAsync(this, { targets: this.spriteOf(mon), alpha: 0.4, duration: 90, yoyo: true, repeat: 1 });
        else this.sparkle(this.spriteOf(mon), 0xc0e8ff);
        if (change > 0) this.showAbility(mon, 'iceBody');
        await this.infoOf(mon).animateHp();
        await this.msg.show(change > 0 ? `${name} có Ice Body, hồi phục HP!` : `${name} ${WEATHER_HURT[this.weather]}!`);
        if (mon.hp <= 0) continue;
      }
      if (this.weather === 'rain' && this.abilityActive(mon, 'rainDish') && mon.hp < mon.maxHp) {
        this.showAbility(mon, 'rainDish');
        mon.hp = Math.min(mon.maxHp, mon.hp + Math.max(1, Math.floor(mon.maxHp / 16)));
        await this.infoOf(mon).animateHp();
        await this.msg.show(`${name} hứng nước mưa, hồi phục HP!`);
      }
      const guarded = this.abilityActive(mon, 'magicGuard');
      if (this.weather === 'sun' && this.abilityActive(mon, 'solarPower') && !guarded) {
        this.showAbility(mon, 'solarPower');
        mon.hp = Math.max(0, mon.hp - Math.max(1, Math.floor(mon.maxHp / 8)));
        await this.infoOf(mon).animateHp();
        await this.msg.show(`${name} bị nắng gắt đốt mất HP!`);
        if (mon.hp <= 0) continue;
      }
      const shed = this.abilityActive(mon, 'shedSkin') && Math.random() < 1 / 3;
      const hydrated = this.abilityActive(mon, 'hydration') && this.weather === 'rain';
      if (mon.status && (shed || hydrated)) {
        const { cured } = STATUS_INFO[mon.status];
        this.showAbility(mon, shed ? 'shedSkin' : 'hydration');
        cureStatus(mon);
        this.infoOf(mon).refresh();
        await this.msg.show(`${name} có ${shed ? 'Shed Skin' : 'Hydration'}! ${name} ${cured}`);
      }
      const status = mon.status;
      // Magic Guard: không mất máu vì bỏng / độc
      if (guarded && ['brn', 'psn'].includes(status)) this.showAbility(mon, 'magicGuard');
      if (!guarded && statusDamage(mon) > 0) {
        await tweenAsync(this, { targets: this.spriteOf(mon), alpha: 0.4, duration: 90, yoyo: true, repeat: 1 });
        await this.infoOf(mon).animateHp();
        await this.msg.show(`${name} bị ${status === 'brn' ? 'bỏng' : 'độc'} hành, mất HP!`);
      }
      if (mon.hp > 0 && mon.hp < mon.maxHp && heldEffect(mon) === 'leftovers') {
        mon.hp = Math.min(mon.maxHp, mon.hp + Math.max(1, Math.floor(mon.maxHp / 16)));
        await this.infoOf(mon).animateHp();
        await this.msg.show(`${name} hồi phục chút HP nhờ Leftovers!`);
      }
      if (mon.bound && mon.hp > 0) await this.bindTick(mon, guarded);
      // Harvest: mọc lại quả mọng đã ăn (50%, trời nắng thì chắc chắn)
      const harvested = harvestBerry(mon, this.weather, abilityOf(mon, this.ctx));
      if (harvested) {
        mon.heldItem = harvested;
        delete mon.lastBerry;
        this.sparkle(this.spriteOf(mon), 0x88e070);
        this.showAbility(mon, 'harvest');
        await this.msg.show(`${name} có Harvest! ${name} thu hoạch được ${ITEMS[harvested].name}!`);
      }
      await this.checkHeldBerry(mon);
      if (mon.disabled && --mon.disabled.turns <= 0) {
        const { move } = mon.disabled;
        delete mon.disabled;
        if (mon.hp > 0) await this.msg.show(`${MOVES[move].name} của ${name} đã hết bị phong ấn.`);
      }
      if (mon.taunted && --mon.taunted <= 0) {
        delete mon.taunted;
        if (mon.hp > 0) await this.msg.show(`${name} đã hết bị khiêu khích.`);
      }
    }
    if (this.ctx.weather && --this.ctx.weatherTurns <= 0) {
      const ended = this.ctx.weather;
      this.ctx.weather = null;
      this.showWeather();
      await this.msg.show(WEATHER_END[ended]);
    }
    for (const [key, side] of Object.entries(this.screens)) {
      for (const screen of Object.keys(SCREENS)) {
        if (side[screen] && --side[screen] <= 0) {
          delete side[screen];
          await this.msg.show(`${SCREENS[screen].name} của ${key === 'enemy' ? this.sideName(this.enemy) : this.sideName(this.active)} đã hết tác dụng.`);
        }
      }
    }
    this.freshIn.clear();
    await this.resolveFaints();
  }

  // Cuối lượt khi đang bị trói (Wrap): bên trói đã rời sân / gục thì thoát ngay (không báo), hết số lượt thì thoát,
  // còn thì mất 1/8 HP tối đa (Magic Guard không mất máu nhưng vẫn bị giữ chân)
  async bindTick(mon, guarded) {
    const { source, move } = mon.bound;
    const name = this.label(mon);
    if (source.hp <= 0 || (source !== this.active && source !== this.enemy)) {
      delete mon.bound;
      return;
    }
    if (mon.bound.turns <= 0) {
      delete mon.bound;
      await this.msg.show(`${name} đã thoát khỏi ${MOVES[move].name}!`);
      return;
    }
    mon.bound.turns--;
    if (guarded) {
      this.showAbility(mon, 'magicGuard');
      return;
    }
    mon.hp -= bindDamage(mon);
    await Promise.all([
      tweenAsync(this, { targets: this.spriteOf(mon), alpha: 0.4, duration: 90, yoyo: true, repeat: 1 }),
      this.infoOf(mon).animateHp(),
    ]);
    await this.msg.show(`${name} bị ${MOVES[move].name} siết chặt!`);
  }

  // Xử lý lần lượt mọi Pokémon vừa gục. Trả về true nếu có Pokémon gục (hoặc trận đã kết thúc).
  async resolveFaints() {
    let any = false;
    while (!this.finished && (await this.checkFaint())) any = true;
    return any || this.finished;
  }

  // ---------- Hiệu ứng ----------

  centerOf(sprite) {
    return { x: sprite.x, y: sprite.y - sprite.displayHeight / 2 };
  }

  impact(sprite, color) {
    const { x, y } = this.centerOf(sprite);
    // chớp sáng nhẹ theo màu hệ (hình đòn đánh đã có trong hiệu ứng riêng của chiêu)
    const flash = this.add.image(x, y, 'fx-circle').setTint(color).setScale(0.3).setAlpha(0.7).setDepth(8);
    this.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
    this.burstSparks(x, y, color, 6, 70);
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

  // Hiệu ứng đổi chỉ số như game gốc. Tăng: Pokémon sáng đỏ cam, phổng lên, mũi tên đỏ cam bay vút lên.
  // Giảm: Pokémon sẫm xanh, co lại, mũi tên xanh rơi xuống. Tăng / giảm mạnh (2 bậc trở lên) thì nhiều mũi tên hơn
  async stageAnim(mon, changed) {
    const up = changed > 0;
    const sprite = this.spriteOf(mon);
    const { x, y } = this.centerOf(sprite);
    const w = sprite.displayWidth;
    const h = sprite.displayHeight;
    const count = Math.abs(changed) >= 2 ? 14 : 8;
    for (let i = 0; i < count; i++) {
      const startY = up ? y + h * 0.4 : y - h * 0.55;
      const arrow = this.add.image(x + Phaser.Math.Between(-w * 0.42, w * 0.42), startY, 'fx-arrow')
        .setTint(up ? 0xff7a3a : 0x3a7aff).setFlipY(!up).setScale(Phaser.Math.FloatBetween(1, 1.6)).setAlpha(0).setDepth(9);
      this.tweens.add({
        targets: arrow,
        y: startY + (up ? -h : h),
        alpha: { from: 0.95, to: 0 },
        delay: i * 45,
        duration: 560,
        ease: up ? 'Quad.out' : 'Quad.in',
        onComplete: () => arrow.destroy(),
      });
    }
    sprite.setTint(up ? 0xffa070 : 0x7090ff);
    const scaleY = sprite.scaleY;
    await tweenAsync(this, { targets: sprite, scaleY: scaleY * (up ? 1.07 : 0.93), duration: 160, yoyo: true, repeat: 1, ease: 'Sine.inOut' });
    sprite.setScale(sprite.scaleX, scaleY);
    await wait(this, 150);
    sprite.clearTint();
  }

  // Pokémon shiny được tung ra sân (vào trận, đổi ra, rút về rồi ra lại; của mình hay của đối thủ): chớp sáng, vòng sao
  // 4 cánh bung ra, sao chớp trên thân (gfx/shinyFx.js). Chỉ lúc ra sân, đứng trên sân thì không lấp lánh định kỳ
  async shinySparkle(mon, sprite) {
    if (!mon.shiny) return;
    await shinyBurst(this, sprite, { depth: 9 });
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
  // Moxie: tự tay hạ gục đối thủ (bằng đòn đánh) thì Tấn công tăng 1 bậc
  async moxie(winner, fainted) {
    const ko = this.knockout;
    if (fainted === ko?.target) this.knockout = null;
    if (ko?.by !== winner || ko.target !== fainted || !this.abilityActive(winner, 'moxie')) return;
    this.showAbility(winner, 'moxie');
    await this.msg.show(`${this.label(winner)} có Moxie!`);
    await this.applyStage(winner, 'atk', 1, false);
  }

  async checkFaint() {
    this.updateGas(); // Pokémon có Neutralizing Gas / Cloud Nine vừa gục thì hết tác dụng ngay
    if (this.enemy.hp <= 0) {
      // Hai bên cùng gục (vd: độc, phản đòn) mà đội người chơi không còn ai: tính là thua
      const wiped = !state.party.some((m) => m.hp > 0);
      const bothDown = this.active.hp <= 0;
      if (!wiped) await this.moxie(this.active, this.enemy);
      // Độ thân thiết: Pokémon đang trên sân hạ gục được đối thủ (hoang dã hoặc của nhà huấn luyện)
      changeHappiness(this.active, HAPPINESS_KO);
      await this.faint(this.enemySprite, this.enemyShadow);
      revertBattleForm(this.enemy); // gục là hết biến hình (EXP, EV tính theo loài gốc)
      this.enemyInfo.setVisible(false);
      // Hàng bóng đội hình ẩn cùng khung máu; đối thủ gửi Pokémon tiếp theo thì hiện lại (con đã gục tô xám)
      this.teamBalls?.[this.enemyTeam.indexOf(this.enemy)].setTint(0x555555).setAlpha(0.6);
      this.teamBalls?.forEach((b) => b.setVisible(false));
      await this.msg.show(`${this.enemyLabel()} đã gục!`);
      if (wiped) {
        await this.playerDown();
        return true;
      }
      // Hai bên cùng gục mà người chơi còn Pokémon: Pokémon của người chơi gục trước mắt, EXP chia cho các con còn đứng,
      // người chơi chọn Pokémon thay rồi đối thủ mới gửi Pokémon tiếp theo
      if (bothDown) await this.playerFaint();
      await this.awardExp();
      const next = this.enemyTeam.find((m) => m.hp > 0);
      if (next) {
        if (bothDown) await this.sendOut(await this.chooseMonster(true), false);
        await this.msg.show(`${this.trainer.name} sắp gửi ra ${next.name}.`);
        await this.sendOutEnemy(next, !bothDown);
        this.freshIn.add(next);
        if (bothDown) {
          this.freshIn.add(this.active);
          for (const mon of entryOrder(this.active, this.enemy, Math.random, this.ctx)) await this.entryAbility(mon);
        }
      } else if (this.trainer) {
        await this.winTrainer();
      } else {
        // Hạ Pokémon hoang dã: vẫn nhặt được ít tiền (game/state.js wildPrize)
        const reward = wildPrize(this.enemy.level);
        state.money = Math.min(MONEY_MAX, state.money + reward);
        this.saveResult('win');
        await this.msg.show(`Bạn nhặt được ${formatMoney(reward)}.`);
        await this.endBattle('win');
      }
      return true;
    }
    if (this.active.hp <= 0) {
      await this.playerDown();
      return true;
    }
    return false;
  }

  // Pokémon của người chơi gục (hiệu ứng + thông báo); con đã gục không còn được chia EXP
  async playerFaint() {
    this.updateGas();
    // Gục là hết trạng thái (độc, bỏng, ngủ...): hồi sinh bằng Revive không còn bị độc / ngủ tiếp
    cureStatus(this.active);
    changeHappiness(this.active, HAPPINESS_FAINT); // độ thân thiết: bị gục
    await this.moxie(this.enemy, this.active);
    await this.faint(this.playerSprite, this.playerShadow);
    revertBattleForm(this.active);
    this.playerInfo.setVisible(false);
    this.participants.delete(this.active);
    await this.msg.show(`${this.active.name} đã gục!`);
  }

  // Pokémon của người chơi gục: chọn con khác, hết thì thua trận
  async playerDown() {
    await this.playerFaint();
    if (state.party.some((m) => m.hp > 0)) {
      await this.sendOut(await this.chooseMonster(true));
      this.freshIn.add(this.active);
    } else if (this.trainer?.noBlackout) {
      // Trận cốt truyện (vd: trận đầu với Gary): thua vẫn đi tiếp, không mất tiền
      await this.msg.show(`Bạn đã thua ${this.trainer.name}...`);
      healParty();
      await this.endBattle('lose', { noBlackout: true });
    } else {
      // Thua thì mất 5% số tiền đang có (tối đa 25.000), về nơi hồi phục gần nhất.
      // Lưu lúc cả đội vừa gục: đóng tab lúc này thì tải lại vẫn tính thua (WorldScene.resumeInterruptedBattle)
      if (this.persist) saveGame();
      const lost = blackoutLoss(state.money);
      state.money -= lost;
      await this.msg.show('Bạn không còn Pokémon nào có thể chiến đấu...');
      if (lost > 0) await this.msg.show(`Bạn đã đánh rơi ${formatMoney(lost)} trong lúc hoảng loạn...`);
      await this.msg.show(state.lastCenter ? 'Bạn vội vàng đưa đội hình về Pokémon Center.' : 'Bạn vội vàng chạy về nhà.');
      healParty();
      await this.endBattle('lose');
    }
  }

  enemyLabel() {
    return this.trainer ? `${this.enemy.name} của đối thủ` : `${this.enemy.name} hoang dã`;
  }

  // Nhà huấn luyện ném Poké Ball gọi Pokémon ra
  // entry: kích hoạt đặc tính vào sân ngay (đầu trận thì đợi cả hai bên ra sân rồi mới kích hoạt)
  async sendOutEnemy(mon, entry = true) {
    this.enemy = mon;
    clearVolatile(mon);
    // Đối thủ mới: chỉ Pokémon đang trên sân được tính là đã đấu với nó
    this.participants = new Set(this.active?.hp > 0 ? [this.active] : []);
    markSeen(mon.speciesId);
    const key = pixelMon(this, mon.speciesId, '', GBA_MON, mon.shiny);
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
    await this.shinySparkle(mon, this.enemySprite);
    await this.slideIn(this.enemyInfo, -60);
    this.teamBalls?.forEach((b) => b.setVisible(true));
    if (entry) await this.entryAbility(mon);
  }

  async winTrainer() {
    const { name, lose, prize, id } = this.trainer;
    const reward = prize * this.enemyTeam[this.enemyTeam.length - 1].level;
    state.money += reward;
    this.saveResult('win');
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

  async sendOut(index, entry = true) {
    this.activeIndex = index;
    const mon = this.active;
    clearVolatile(mon);
    this.participants.add(mon);
    // Có ảnh mặt sau thì dùng, không thì lật ngang ảnh mặt trước
    const hasBack = monViewKey(this, mon.speciesId, '-back') !== `mon-${mon.speciesId}`;
    const key = pixelMon(this, mon.speciesId, hasBack ? '-back' : '', 80, mon.shiny);
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
    await this.throwArc(ball, { x: LEFT - 40, y: 420 }, open, 150, 480);
    ball.destroy();
    this.ballBurst(open.x, open.y);
    this.playerSprite.setTintFill(0xffffff);
    this.playerShadow.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.playerShadow, alpha: 0.28, duration: 300 });
    await tweenAsync(this, { targets: this.playerSprite, scale: fitScale(this, key, PLAYER_SIZE), duration: 380, ease: 'Back.out' });
    this.playerSprite.clearTint();
    await this.shinySparkle(mon, this.playerSprite);
    await this.slideIn(this.playerInfo, 60);
    if (entry) await this.entryAbility(mon);
  }

  // Hạ hoặc bắt được Pokémon đối thủ: EXP chia đều cho các Pokémon đã đấu với nó và còn đứng (như FireRed/LeafGreen), mỗi con nhận đủ EV.
  // Con đang trên sân chạy thanh EXP và hiện từng cấp một; con khác chỉ báo bằng lời
  async awardExp() {
    const fighters = state.party.filter((m) => this.participants.has(m) && m.hp > 0);
    // Cầm Exp. Share mà không ra trận: vẫn nhận 50% EXP và đủ EV (battle/formulas.js: expShares)
    const sharers = state.party.filter((m) => !this.participants.has(m) && m.hp > 0 && ITEMS[m.heldItem]?.held === 'expShare');
    const evYield = SPECIES[baseSpeciesId(this.enemy)].evYield;
    for (const { mon, amount } of expShares(this.enemy, fighters, { trainer: Boolean(this.trainer), sharers })) {
      // Đang biến hình: tạm về dạng gốc để tính chỉ số / học chiêu theo loài gốc, xong thì khoác lại dạng biến hình
      const form = suspendBattleForm(mon);
      try {
        await this.gainExpOf(mon, amount, evYield);
      } finally {
        resumeBattleForm(mon, form);
      }
    }
  }

  // Một Pokémon nhận EV và EXP: con đang trên sân chạy thanh EXP và hiện từng cấp một; con khác chỉ báo bằng lời
  async gainExpOf(mon, amount, evYield) {
    gainEvs(mon, evYieldFor(mon, evYield)); // cầm Macho Brace: EV gấp đôi
    if (mon.level >= MAX_LEVEL) return;
    const onField = mon === this.active;
    await this.msg.show(`${mon.name} nhận được ${amount} EXP!`);
    for (const ev of gainExp(mon, amount)) {
      if (ev.type === 'levelUp') {
        this.leveled.add(mon.uid);
        if (onField) {
          await this.playerInfo.animateExp(1);
          this.playerInfo.refresh(ev);
          this.playerInfo.setExp(0);
          this.sparkle(this.playerSprite, 0xffe066);
        }
        // Bảng chỉ số tăng thêm khi lên cấp (như game gốc), đóng cùng câu thông báo
        const panel = this.levelUpPanel(mon, ev.level);
        await this.msg.show(`${mon.name} đã lên cấp ${ev.level}!`);
        panel.destroy();
      } else if (ev.type === 'learn') {
        await this.msg.show(`${mon.name} đã học được chiêu ${MOVES[ev.move].name}!`);
      } else if (ev.type === 'cantLearn') {
        await this.forgetToLearn(mon, ev.move);
      }
    }
    if (onField) {
      this.playerInfo.refresh();
      await this.playerInfo.animateExp(expProgress(mon));
    }
  }

  // Bảng nhỏ góc phải trên: chỉ số của Pokémon ở cấp mới và số tăng thêm so với cấp trước (+2 Atk...)
  levelUpPanel(mon, level) {
    const species = SPECIES[mon.speciesId];
    const before = calcStats(species, level - 1, mon.ivs, mon.evs, mon.nature);
    const after = calcStats(species, level, mon.ivs, mon.evs, mon.nature);
    const [x, y, w, h] = [712, 40, 236, 236];
    const c = this.add.container(0, 0).setDepth(25);
    c.add(drawPanel(this, x, y, w, h, 16, true));
    c.add(fitText(this.add.text(x + 22, y + 18, mon.name, textStyle(17, '#30343c', { fontStyle: 'bold' })), w - 100, 0.8));
    c.add(this.add.text(x + w - 22, y + 18, `Lv${level}`, textStyle(17, '#2f7de1', { fontStyle: 'bold' })).setOrigin(1, 0));
    STAT_KEYS.forEach((k, i) => {
      const key = k === 'hp' ? 'maxHp' : k;
      const ry = y + 52 + i * 28;
      const up = after[key] - before[key];
      c.add(this.add.text(x + 22, ry, STAT_NAMES[k], textStyle(16, '#4a5266', { fontStyle: 'bold' })));
      c.add(this.add.text(x + w - 70, ry, String(after[key]), textStyle(16, '#30343c', { fontStyle: 'bold' })).setOrigin(1, 0));
      c.add(this.add.text(x + w - 22, ry, up > 0 ? `+${up}` : '—', textStyle(16, up > 0 ? '#2a9a48' : '#a0a8b8', { fontStyle: 'bold' })).setOrigin(1, 0));
    });
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 160 });
    return c;
  }

  // Đã đủ 4 chiêu mà muốn học chiêu mới: hỏi có quên chiêu cũ không, rồi chọn chiêu để quên.
  // X / ✕ / "Không học" là thôi không học. Trả về true nếu đã học
  async forgetToLearn(mon, moveId) {
    const move = MOVES[moveId];
    this.msg.setText(`${mon.name} muốn học ${move.name}. Quên một chiêu để học ${move.name}?`);
    const yes = await new Menu(this, this.router, {
      x: 760, y: 384, width: 180, height: 140, depth: 30,
      items: [{ label: 'Có', value: true }, { label: 'Không', value: false }],
    }).open();
    if (yes) {
      const detail = (m) => `${m.name} (${TYPES[m.type].name}) • Sức mạnh ${m.power || '—'} • Chính xác ${m.accuracy ? `${m.accuracy}%` : '—'}`;
      const forget = await new Menu(this, this.router, {
        x: 180, y: 12, width: 600, height: 76 + (mon.moves.length + 1) * 52, title: 'Quên chiêu nào?', rowHeight: 46, depth: 30,
        items: [
          ...mon.moves.map((m) => ({ label: MOVES[m].name, sub: `${TYPES[MOVES[m].type].name}  •  PP ${mon.pp[m] ?? 0}/${MOVES[m].pp}`, value: m, fontSize: 24 })),
          { label: `Không học ${move.name}`, value: null, fontSize: 24 },
        ],
        onChange: ({ value }) => this.msg.setText(`Học: ${detail(move)}${value ? `
Quên: ${detail(MOVES[value])}` : ''}`),
      }).open();
      if (forget) {
        const old = MOVES[forget].name;
        replaceMove(mon, forget, moveId);
        await this.msg.show(`1, 2 và... Bốp! ${mon.name} đã quên ${old}.`);
        await this.msg.show(`${mon.name} đã học được ${move.name}!`);
        return true;
      }
    }
    await this.msg.show(`${mon.name} không học ${move.name}.`);
    return false;
  }

  // Quả bóng hai nửa trong một container: thân dưới (bottom) và nắp trên (top) gắn bản lề ở mép sau (bên trái),
  // nên nắp bật lên như vỏ sò, vẫn dính vào thân (không tách rời). pivot: 'center' khi bay (xoay quanh tâm),
  // 'bottom' khi nằm trên đất (lắc quanh đáy như game gốc)
  makeBall(icon, x, y) {
    const frame = this.textures.get(icon).getSourceImage();
    const [w, h] = [frame.width, frame.height];
    const half = (top) => this.add.image(0, 0, icon).setScale(BALL_SCALE).setCrop(0, top ? 0 : h / 2, w, h / 2);
    const r = (w * BALL_SCALE) / 2 * 0.94; // bán kính hình tròn (trừ phần lề trong hình)
    const bottom = half(false);
    const top = half(true).setPosition(r, 0);
    const lid = this.add.container(-r, 0, [top]); // gốc container = bản lề trên đường xích đạo của bóng
    const ball = this.add.container(x, y, [bottom, lid]).setDepth(6);
    Object.assign(ball, { top, bottom, lid, size: h * BALL_SCALE });
    return ball;
  }

  // Đổi điểm xoay của bóng sang đáy (vị trí trên màn hình giữ nguyên)
  pivotBallBottom(ball) {
    const d = ball.size / 2;
    ball.rotation = 0;
    for (const part of [ball.lid, ball.bottom]) part.y -= d;
    ball.y += d;
  }

  // Mở / đóng nắp bóng: nắp xoay quanh bản lề, mép trước hé lên (không bay ra khỏi thân)
  ballLid(ball, open, duration = 160) {
    return tweenAsync(this, {
      targets: ball.lid,
      angle: open ? -62 : 0,
      duration,
      ease: open ? 'Back.out' : 'Quad.in',
    });
  }

  // Luồng sáng đỏ từ miệng bóng tới Pokémon (lúc hút vào)
  catchBeam(from, to, duration) {
    const g = this.add.graphics().setDepth(5.5); // trên Pokémon, dưới quả bóng
    const p = { a: 1 };
    const draw = () => {
      g.clear();
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const [nx, ny] = [-dy / len, dx / len];
      for (const [width, color, alpha] of [[70, 0xff5050, 0.35], [36, 0xffb0b0, 0.55], [12, 0xffffff, 0.9]]) {
        g.fillStyle(color, alpha * p.a);
        g.fillTriangle(from.x, from.y, to.x + nx * width, to.y + ny * width, to.x - nx * width, to.y - ny * width);
      }
    };
    draw();
    return tweenAsync(this, { targets: p, a: 0, duration, ease: 'Quad.in', onUpdate: draw, onComplete: () => g.destroy() });
  }

  // Trả về true nếu bắt thành công (trận đấu kết thúc)
  async throwBall(itemId) {
    const item = ITEMS[itemId];
    await this.msg.show(`Bạn ném ${item.name}!`);
    const from = { x: PLAYER_POS.x + 40, y: PLAYER_POS.y - 180 };
    const target = { x: ENEMY_POS.x, y: ENEMY_POS.y - 110 };
    const ball = this.makeBall(item.icon, from.x, from.y);
    await this.throwArc(ball, from, target, 170, 560);
    ball.rotation = 0;

    // Bóng bật nắp, luồng sáng đỏ hút Pokémon (đỏ rực, thu nhỏ dần) vào miệng bóng rồi đóng nắp
    await this.ballLid(ball, true);
    this.ballBurst(target.x, target.y - 6);
    const mouth = { x: target.x, y: target.y - 4 };
    const body = this.centerOf(this.enemySprite);
    this.enemySprite.setTintFill(0xff6060);
    await Promise.all([
      this.catchBeam(mouth, body, 420),
      tweenAsync(this, { targets: this.enemySprite, scale: 0, x: mouth.x, y: mouth.y + 20, duration: 420, ease: 'Quad.in' }),
    ]);
    this.tweens.add({ targets: this.enemyShadow, alpha: 0.12, duration: 200 });
    await this.ballLid(ball, false, 120);
    this.burstSparks(target.x, target.y, 0xffffff, 6, 40);
    await wait(this, 120);

    // Rơi xuống đất, nảy vài lần
    this.pivotBallBottom(ball);
    await tweenAsync(this, { targets: ball, y: ENEMY_POS.y - 22 + ball.size / 2, duration: 520, ease: 'Bounce.out' });

    // Mỗi lần lắc: nghiêng trái, nghiêng phải rồi đứng lại, xoay quanh đáy bóng
    // Nhiệm vụ bắt Pokémon đầu tiên: quả bóng đầu tiên ném ra chắc chắn bắt được (không kẹt vì hết bóng)
    const sure = firstCatchThrow();
    const { caught, shakes } = sure ? { caught: true, shakes: 3 } : rollCatch(this.enemy, item.bonus);
    const baseX = ball.x;
    for (let i = 0; i < shakes; i++) {
      await wait(this, 420);
      // Nhún nhẹ lên rồi nghiêng mạnh trái, phải, đứng lại
      const ground = ball.y;
      await tweenAsync(this, { targets: ball, y: ground - 6, duration: 70, yoyo: true, ease: 'Quad.out' });
      for (const [angle, dx, ms] of [[-30, -8, 110], [26, 7, 160], [-10, -3, 90], [0, 0, 80]]) {
        await tweenAsync(this, { targets: ball, angle, x: baseX + dx, duration: ms, ease: 'Sine.inOut' });
      }
    }
    await wait(this, 420);

    if (caught) {
      // "Cạch": nút bóng loé sáng, sao bay ra, bóng sẫm lại
      this.burstSparks(ball.x, ball.y - ball.size / 2, 0xffffff, 4, 24);
      await wait(this, 120);
      for (const part of [ball.top, ball.bottom]) part.setTint(0xb0b0b0);
      this.burstSparks(ball.x, ball.y - ball.size, 0xffe066, 8, 80);
      this.enemyInfo.setVisible(false);
      revertBattleForm(this.enemy); // Ditto bắt được khi đang biến hình vẫn là Ditto
      await this.msg.show(`Tuyệt vời! Bạn đã bắt được ${this.enemy.name}!`);
      // Bắt được cũng nhận EXP và EV như khi hạ gục (như từ Gen 5), chia cho các Pokémon đã ra sân và còn đứng
      await this.awardExp();
      this.enemy.ball = itemId; // loại bóng đã bắt (hiện trong bảng chi tiết Pokémon)
      const where = addCaught(this.enemy);
      this.saveResult('catch');
      await this.msg.show(where === 'party'
        ? `${this.enemy.name} đã gia nhập đội hình của bạn.`
        : `Đội hình đã đủ 6, ${this.enemy.name} được gửi vào hộp PC.`);
      // Gửi vào PC: về bản đồ hiện bảng xem nhanh (ui/CatchPreview.js, WorldScene.onWake)
      await this.endBattle('catch', where === 'storage' && settings.catchPreview !== false ? { preview: this.enemy } : {});
      return true;
    }

    // Thoát ra: nắp bật tung, chớp sáng, Pokémon hiện lại
    await this.ballLid(ball, true, 120);
    this.ballBurst(ball.x, ball.y - ball.size / 2);
    ball.destroy();
    this.enemyShadow.setAlpha(0.28);
    this.enemySprite.setPosition(ENEMY_POS.x, ENEMY_POS.y).setTintFill(0xffffff);
    await tweenAsync(this, { targets: this.enemySprite, scale: this.enemyScale, duration: 260, ease: 'Back.out' });
    this.enemySprite.clearTint();
    await this.msg.show(['Ôi không! Nó đã thoát ra!', 'Tiếc quá! Suýt nữa thì được!', 'Chỉ thiếu một chút nữa thôi!'][shakes]);
    return false;
  }

  // Pickup: hết trận, Pokémon trong đội có Pickup đang không cầm gì thì 10% nhặt được một món (cầm luôn trên tay).
  // Pokémon vừa bắt được trong trận này thì không tính
  async pickup() {
    for (const mon of state.party) {
      if (this.enemyTeam.includes(mon)) continue;
      const id = pickupItem(mon);
      if (!id) continue;
      mon.heldItem = id;
      await this.msg.show(`${mon.name} đã nhặt được ${ITEMS[id].name}!`);
    }
  }

  // Trận lưu sau mỗi lượt: vừa có kết quả (thắng, bắt được) là lưu ngay, đóng tab lúc đang đọc thông báo cuối trận
  // không mất kết quả. Trainer có onDefeat (thủ lĩnh, Liên minh, cốt truyện) thì không: bản đồ lưu sau khi onDefeat chạy xong
  saveResult(result) {
    if (!this.persist || this.trainer?.onDefeat) return;
    for (const mon of [...state.party, ...this.enemyTeam]) clearBattleState(mon);
    this.naturalCure(this.active);
    state.pendingBattle = null;
    if (result === 'win' && this.trainer) trainerBeaten(this.trainer);
    saveGame();
  }

  async endBattle(result, extra = {}) {
    this.finished = true;
    // Xoá hiệu ứng tạm thời (hết biến hình), trả lại đồ cầm bị lấy / hất mất trong trận (Pokémon vừa bắt cũng không giữ đồ lấy
    // của người chơi)
    for (const mon of [...state.party, ...this.enemyTeam]) clearBattleState(mon);
    this.naturalCure(this.active);
    if (result !== 'lose') await this.pickup();
    this.router.clear();
    await tweenAsync(this, { targets: this.cameras.main, alpha: 0, duration: 450 });
    // Pokémon nào lên cấp trong trận thì về bản đồ mới xét tiến hoá (như game gốc)
    // Bản đồ vẫn chạy phía sau cửa sổ trận đấu (chỉ bị khoá thao tác): báo kết quả trận
    const world = this.scene.get('World');
    this.scene.stop();
    world.endBattleWindow({ result, leveled: [...this.leveled], persist: this.persist, ...extra });
  }
}
