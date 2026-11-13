import Phaser from 'phaser';
import { CELL, TILE, WORLD_SCALE } from '../config.js';
import { clearBattleState } from '../battle/status.js';
import { rollEncounter } from '../data/encounters.js';
import { ITEMS, canHold, formatMoney } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { HEAL_RESPAWN, HOME_RESPAWN, MAPS, SPAWN } from '../data/map.js';
import { followStyle, followerCry } from '../data/followStyle.js';
import { SPECIES } from '../data/monsters.js';
import { NPCS, TRAINERS } from '../data/npcs.js';
import { placeOf } from '../data/region.js';
import { TYPES } from '../data/types.js';
import { createMonster, replaceMove } from '../game/monster.js';
import { berryStage, pickBerries, regrowLabel } from '../game/berries.js';
import { evolutionTarget, evolve } from '../game/evolution.js';
import { giveHeldItem } from '../game/heldItems.js';
import { assignHotbar, setHotbarSlot, swapHotbarSlots } from '../game/hotbar.js';
import { repelBlocks, startRepel, stepRepel } from '../game/repel.js';
import { applyItem, escapeProblem, itemProblem, needsMove } from '../game/itemUse.js';
import { saveBlocked, saveGame } from '../game/save.js';
import { forfeitable, rematchDef, trainerBeaten, trainerForfeit, trainerReady } from '../game/trainers.js';
import { setSetting, settings } from '../game/settings.js';
import { addItem, blackoutLoss, hasFlag, healParty, itemCount, setFlag, state, swapParty, useItem } from '../game/state.js';
import { Ambience } from '../gfx/ambience.js';
import { mapWeather } from '../game/weather.js';
import { MACHINE_SLOTS } from '../gfx/interior.js';
import { CHAR_HEIGHT, CHAR_SCALE, applyPlayerLook } from '../gfx/player.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { showTrainerCard } from '../ui/TrainerCard.js';
import { currentLook } from '../data/playerCustom.js';
import { addSheetTexture, spriteFromImage, upscaleCanvas } from '../gfx/pixel.js';
import { GBA_MON, fitScale, pixelMon, shinyImage } from '../gfx/textures.js';
import { ANIM_FRAMES, doorGlass } from '../gfx/world.js';
import { MOUNT_SHADOW, RIDE_SEAT, hasRideArt, puffTextures, rideTexture } from '../gfx/mounts.js';
import {
  STORY_NPCS, WALKABLE_OBJECTS, clerkTalk, hasPokedex, intro, objective, objectVisible, stepBlocker, stepTrigger, useObject,
} from '../story/chapter1.js';
import { resetLeague } from '../story/league.js';
import { houseKnock } from '../story/villages.js';
import { COLORS, cssColor, drawHpBar, drawPanel, fixToCamera, textStyle, tweenAsync, wait } from '../ui/helpers.js';
import { HeldKeys, InputRouter, directionOf, isCancel, isConfirm } from '../ui/input.js';
import { KeyBindings } from '../ui/KeyBindings.js';
import { actionsForCode, hotbarSlotOf } from '../game/keybinds.js';
import { Menu } from '../ui/Menu.js';
import { MessageBox } from '../ui/MessageBox.js';
import { typeBadges } from '../ui/TypeBadge.js';
import { AreaNav } from '../ui/AreaNav.js';
import { PartyPanel } from '../ui/PartyPanel.js';
import { Hotbar } from '../ui/Hotbar.js';
import { PcBox } from '../ui/PcBox.js';
import { BagPanel } from '../ui/BagPanel.js';
import { attachShinySparkle } from '../gfx/shinyFx.js';
import { WorldHud, drawRoundIcon } from '../ui/WorldHud.js';

const STEP_MS = 225; // đi bộ ~4.5 ô/giây
// Thời gian mỗi bước: xe đạp ~10 ô/giây, cưỡi Arcanine ~11 ô/giây, cưỡi Lapras ~10 ô/giây; dùng chiêu Surf bơi chậm như đi bộ
const VEHICLE_STEP_MS = { bike: 100, ride: 90, surf: 225, waterRide: 100 };
const WATER_VEHICLES = ['surf', 'waterRide'];
// Thú cưỡi (vật phẩm quan trọng): Arcanine trên cạn, Lapras dưới nước
const MOUNT_ITEMS = { ride: 'arcanineMount', waterRide: 'laprasMount' };
// Nhịp phi nước đại / quạt vây khi đang đi (ms mỗi nhịp): bơi bằng Surf chậm nên quạt vây chậm hơn
const MOUNT_BEAT_MS = { ride: 90, waterRide: 110, surf: 160 };
const MOUNT_HOP_MS = 300; // nhảy từ bờ lên lưng thú cưỡi dưới nước / nhảy xuống bờ
const TURN_MS = 90; // giữ phím lâu hơn thời gian này mới bắt đầu đi
const LEDGE_JUMP_MS = 420; // nhảy qua gờ đất: bay qua 2 ô
const LEDGE_HOP = CELL * 0.55; // độ cao cú nhảy
const FOLLOWER_LEDGE_MS = 340;
const VENT_MS = 1300; // miệng lò phụt lửa luân phiên (Gym Lò Gốm) // Pokémon đi theo nhảy qua gờ sau khi người chơi đã đáp
const NPC_STEP_MS = 260;
const DOOR_MS = 180; // cửa trượt mở / đóng
const DOOR_STEP_MS = 240; // bước qua cửa, chậm hơn đi thường một chút
const DOOR_FADE_MS = 260;
const ENCOUNTER_RATE = 0.12;
const WATER_ENCOUNTER_RATE = 0.08;
// Câu cá: tỉ lệ có Pokémon cắn câu và thời gian (ms) để bấm Enter kịp
const ROD_BITE = { oldRod: 0.75, goodRod: 0.85, superRod: 0.95 };
const BITE_WINDOW_MS = 1000;
const RODS = ['superRod', 'goodRod', 'oldRod'];
// Cây quả mọng nhấc lên chừng ấy pixel (pixel art) để gốc cây nằm giữa luống đất
const BERRY_LIFT = 4;
// Gym đã có huy hiệu và có bản vẽ nền "đã thắng" (gfx/world.js: buildWorldTextures)
const gymClearedArt = (scene, map) => Boolean(map.badge && state.badges.has(map.badge) && scene.textures.exists(`${map.id}-ground-cleared`));
// Vật phẩm bấm trong túi là dùng ngay (không hỏi Dùng / Cho cầm / Gán phím tắt)
const DIRECT_USE = (id) => Boolean(ITEMS[id].rod || ITEMS[id].mount || id === 'bicycle');
const AUTOSAVE_MS = 30000;
const HUD_DEPTH = 100;
const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
// Pokémon đi theo: sprite kiểu GBA 20x20 pixel, phóng to x3 như nhân vật và ô bản đồ (1 pixel sprite = 1 pixel bản đồ)
const FOLLOWER_LOGICAL = 20;
// Pokémon đứng cùng NPC (vd Meowth của Team Rocket): nhỏ hơn người đứng cạnh
const NPC_MON_LOGICAL = 16;
const ZOOM = WORLD_SCALE / 4; // các khoảng cách pixel trên bản đồ dưới đây được chỉnh ở cỡ x4
const FOLLOWER_HOP = 5 * CHAR_SCALE; // Pokémon không có chân nhảy cao chừng này mỗi bước
const FOLLOWER_FLY = 9 * CHAR_SCALE; // Pokémon có cánh bay cao hơn mặt đất
const FOLLOWER_FLOAT = 5 * CHAR_SCALE; // Pokémon lơ lửng (ma, khí độc, nam châm)
const ITEM_SCALE = 0.65; // vật phẩm rơi trên bản đồ nhỏ hơn một ô
const SHADOW = [0.18 * CHAR_SCALE, 0.2 * CHAR_SCALE]; // bóng dưới chân nhân vật (fx-shadow 128x32)
const FOLLOWER_SHADOW = [0.16 * CHAR_SCALE, 0.18 * CHAR_SCALE];
const SHADOW_ALPHA = 0.22;
// NPC ngồi sofa (tính bằng pixel logic của nhân vật 16x24): giấu phần chân, hạ người xuống đệm, lùi về phía lưng ghế
const SEAT_HIDE = 6;
const SEAT_DROP = 3;
const SEAT_BACK = 2;

const cellCenter = ({ x, y }) => [x * CELL + CELL / 2, (y + 1) * CELL - 4 * ZOOM];
const samePos = (a, b) => a.x === b.x && a.y === b.y;

// Các ô đi qua khi bước lần lượt theo các hướng dirs, bắt đầu từ start
// Quay hình Pokémon (đi theo người chơi, hoặc NPC là Pokémon) về hướng dir: hình nghiêng nhìn sang trái, lật lại khi sang phải
function faceMonSprite(sprite, dir) {
  if (!sprite.texture.has(dir === 'up' ? 'up' : 'down')) return;
  sprite.setFrame(dir === 'left' || dir === 'right' ? 'side' : dir);
  sprite.setFlipX(dir === 'right');
}

// Đang đi xe / cưỡi thì ô phím tắt của món đó sáng viền
const VEHICLE_ITEMS = { bike: 'bicycle', ride: 'arcanineMount', waterRide: 'laprasMount' };

function cellsAlong(start, dirs) {
  let p = start;
  return dirs.map((d) => (p = { x: p.x + DIRS[d].x, y: p.y + DIRS[d].y }));
}

function directionTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

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

  // data: { position: { map, x, y, facing }, newGame }
  create(data) {
    // Scene được khởi động lại (tải game, về màn hình chính) thì object cũ đã bị huỷ: tạo lại từ đầu
    this.vehicle = null;
    this.mount = null;
    this.mountSprite = null;
    this.mountOver = null;
    this.mountSparkle = null;
    this.mountAt = null;
    this.followerGrassImgs = null;
    this.facing = 'down';
    this.irisGfx = null;
    this.sliding = false;
    // Gym tối: phủ đen, chỉ chừa vòng sáng quanh người chơi (vẽ lại mỗi khung hình)
    this.darkGfx = this.add.graphics().setDepth(55).setVisible(false);
    this.busy = false;
    this.npcs = [];
    this.objectSprites = [];
    this.shadow = this.add.image(0, 0, 'fx-shadow').setScale(...SHADOW).setAlpha(SHADOW_ALPHA).setDepth(9);
    this.player = this.add.sprite(0, 0, this.playerTexture(false), 'down-stand').setOrigin(0.5, 1).setScale(CHAR_SCALE).setDepth(10);
    this.playerMover = {
      sprite: this.player,
      shadow: this.shadow,
      walk: null,
      foot: false,
      begin: (cell) => this.beginPlayerStep(cell),
      // Trượt trên băng: đứng yên mà trôi đi, không bước chân. Ngồi trên thú cưỡi / khối nước thì ngồi yên (thú cưỡi tự bước)
      setStep: (step) => this.setFrame(this.sliding || this.mount ? 'stand' : step),
      progress: (t) => {
        this.hopFollower(t);
        if (t >= 1) this.clearGrassTrail();
      },
    };
    // Lá cỏ cao che chân người chơi / thú cưỡi (updateGrassFront), dùng lại các ảnh trong bộ này
    this.grassFronts = [];
    this.follower = {
      pos: null,
      hop: null,
      ground: null, // điểm chạm đất (pixel) • stepT: đang bước (0 → 1) hay đứng yên (null)
      stepT: null,
      shadow: this.add.image(0, 0, 'fx-shadow').setScale(...FOLLOWER_SHADOW).setAlpha(SHADOW_ALPHA).setDepth(9),
      sprite: this.add.image(0, 0, 'fx-leaf').setOrigin(0.5, 1).setScale(CHAR_SCALE).setDepth(10),
    };
    // Pokémon đi theo là shiny: lấp lánh định kỳ (gfx/shinyFx.js), bật / tắt trong refreshFollower
    this.followerSparkle = attachShinySparkle(this, this.follower.sprite).setVisible(false);

    let animFrame = 0;
    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => {
        animFrame = (animFrame + 1) % ANIM_FRAMES;
        this.animLayer?.setFrame(String(animFrame));
      },
    });
    this.time.addEvent({
      delay: AUTOSAVE_MS,
      loop: true,
      callback: () => !this.busy && !this.moving && this.save(),
    });


    this.router = new InputRouter(this);
    this.msg = new MessageBox(this, this.router, 24, 578, 912, 130);
    fixToCamera(this.msg.container).setDepth(HUD_DEPTH + 5).setVisible(false);
    this.speakerTag = this.add
      .text(44, 548, '', textStyle(19, '#ffffff', { fontStyle: 'bold', backgroundColor: cssColor(COLORS.ink), padding: { x: 14, y: 6 } }))
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 6)
      .setVisible(false);
    this.hud = new WorldHud(this, {
      bag: () => this.openBag(),
      dex: () => this.openPokedex(),
      trainer: () => this.openTrainerCard(),
      settings: () => this.toggleSettings(),
    });
    this.ambience = new Ambience(this);
    // Cột đội hình góc trái trên; bảng Pokémon hoang dã ở góc phải dưới đồng hồ
    // Bấm vào ô: mở thẳng màn chi tiết Pokémon; kéo thả ô này lên ô khác: đổi chỗ trong đội
    this.partyPanel = new PartyPanel(this, 16, (index) => {
      if (this.busy || this.moving || this.partyMenu || this.overlay) return;
      this.openSummary(index);
    }, (a, b) => {
      if (this.busy || this.moving || this.partyMenu || this.overlay) return;
      swapParty(a, b);
      this.refreshFollower();
      this.save();
    });
    this.areaNav = new AreaNav(this, (speciesId) => this.openPokedex(SPECIES[speciesId].dexId));
    this.hotbar = new Hotbar(this, (slot) => this.useHotbar(slot), (a, b) => {
      swapHotbarSlots(a, b);
      if (!this.busy && !this.moving) this.save();
    });
    this.time.addEvent({
      delay: 20000,
      loop: true,
      callback: () => {
        this.ambience.refresh();
        this.refreshBerries();
        const shown = this.map.objects.filter((o) => o.respawnDays && objectVisible(o)).length;
        if (shown !== this.respawnShown) this.refreshObjects();
      },
    });

    // Phím đang giữ (đi liên tục), theo bảng phím trong Cài đặt → Phím tắt (game/keybinds.js). Chặn phím mũi tên cuộn trang
    this.held = new HeldKeys(this);
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT');
    this.input.keyboard.on('keydown', (e) => {
      const slot = hotbarSlotOf(e);
      if (slot !== null && !e.repeat) this.useHotbar(slot);
      else if (isConfirm(e)) this.interact();
      else this.tapTurn(directionOf(e), e.repeat);
    });
    // Câu cá không có phím riêng: dùng cần câu trong túi đồ (bấm vào là dùng) hoặc ô phím tắt.
    // Phím nhận theo vị trí phím (e.code) chứ không theo mã ký tự, để bật bộ gõ tiếng Việt (Telex / VNI) vẫn dùng được
    // (bộ gõ đổi mã phím của F, R, S, X, J... thành phím đang soạn). Giữ phím thì không bật / tắt liên tục.
    const shortcuts = {
      party: () => this.toggleParty(),
      dex: () => this.openPokedex(),
      bag: () => this.openBag(),
      bike: () => this.toggleBike(),
      ride: () => this.toggleRide(),
      map: () => this.openRegionMap(),
      trainer: () => this.openTrainerCard(),
      settings: () => this.toggleSettings(),
    };
    this.input.keyboard.on('keydown', (e) => {
      if (e.repeat) return;
      for (const id of actionsForCode(e.code)) shortcuts[id]?.();
    });
    const onWake = (_sys, wakeData) => this.onWake(wakeData);
    const onResume = () => this.onResume();
    this.events.on('wake', onWake);
    this.events.on('resume', onResume);
    // Đóng / ẩn tab: lưu ngay (đang trong cảnh cắt thì thôi, lần lưu trước đó vẫn còn)
    const onHide = () => document.visibilityState === 'hidden' && !this.busy && !this.moving && this.save();
    document.addEventListener('visibilitychange', onHide);
    // Sự kiện của scene không tự gỡ khi scene tắt (về màn hình chính rồi vào lại sẽ bị gọi hai lần)
    this.events.once('shutdown', () => {
      this.events.off('wake', onWake);
      this.events.off('resume', onResume);
      document.removeEventListener('visibilitychange', onHide);
    });

    const start = data?.position ?? SPAWN;
    this.loadMap(start.map, start, start.facing);
    // Thoát game rồi vào lại: đang đi xe đạp / cưỡi Arcanine thì vào lại là đi bộ (xuống xe / xuống thú).
    // Riêng đang ở dưới nước thì vào lại vẫn ở dưới nước (chỗ đứng là mặt nước thì luôn xuống nước, kể cả bản lưu ghi sai
    // cách đi: không bao giờ đứng trên mặt nước mà kẹt)
    if (this.isWater(start.x, start.y)) {
      const lapras = start.vehicle !== 'surf' ? this.mountOf('waterRide') : null;
      const surfer = state.party.find((m) => m.uid === start.mount) ?? state.party.find((m) => this.canSurf(m)) ?? state.party[0];
      if (lapras || !surfer) this.setVehicle('waterRide', lapras ?? this.mountOf('waterRide'));
      else this.setVehicle('surf', surfer);
    }
    this.cameras.main.fadeIn(500);
    if (state.pendingBattle) this.runEvent(() => this.resumeInterruptedBattle());
    if (data?.newGame) {
      this.runEvent(async () => {
        await wait(this, 600);
        await intro(this);
      });
    }
  }

  // Toạ độ y trên hình người chơi (part: 1 = đỉnh đầu, 0.6 = ngang ngực), tính cả lúc ngồi cao khi cưỡi / lướt nước
  playerTop(part = 1) {
    return this.player.y - CHAR_HEIGHT * part - (this.mount ? this.riderLift ?? 0 : 0);
  }

  // Hình nhân vật theo giới tính đã chọn khi chơi mới (đi bộ / đi xe đạp)
  playerTexture(bike) {
    const female = state.player?.gender === 'female';
    const key = `player${female ? '-f' : ''}${bike ? '-bike' : ''}`;
    return this.textures.exists(key) ? key : bike ? 'player-bike' : 'player';
  }

  // Người chơi đang bước giữa hai ô
  get moving() {
    return Boolean(this.playerMover?.walk);
  }

  update(time, delta) {
    const talking = this.msg.container.visible;
    const free = !talking && !this.partyMenu && !this.settingsMenu && !this.overlay && !this.busy;
    this.hud.setVisible(free);
    this.hotbar.setVisible(free || Boolean(this.bagOpen)); // mở túi đồ thì vẫn hiện để kéo vật phẩm vào
    this.hotbar.update(VEHICLE_ITEMS[this.vehicle] ?? null);
    this.hud.update(objective(this.map.id), `${this.ambience.label()}
${this.map.name}`, this.ambience.state.tod);
    this.partyPanel.setVisible(free);
    this.partyPanel.update();
    this.areaNav.setVisible(free);
    this.areaNav.update(this.areaInfo());
    this.advanceWalk(this.playerMover, delta);
    for (const npc of [...this.npcs]) this.advanceWalk(npc, delta);
    if (!this.moving && !this.busy && !this.partyMenu) this.tryMove();
    if (!this.busy) for (const npc of this.npcs) this.updateNpc(npc, time);
    // Đang nhảy lên / xuống thú cưỡi dưới nước: xếp lớp theo chỗ thú cưỡi (hopWater)
    this.player.setDepth(this.riderDepth ?? 10 + this.player.y / 10000);
    this.placeMount(time);
    this.updateVents(time);
    this.animateFollower(time);
    for (const npc of this.npcs) npc.sprite.setDepth(10 + npc.sprite.y / 10000);
    this.drawDarkness();
  }

  // Gym tối: phủ đen cả màn hình, khoét vòng sáng quanh người chơi và quanh các đèn lồng đã thắp (mép mờ dần)
  drawDarkness() {
    const dark = Boolean(this.map?.dark && !this.map.cleared);
    this.darkGfx.setVisible(false);
    if (!dark) {
      if (this.darkRT?.scene) this.darkRT.setVisible(false);
      return;
    }
    const { width, height } = this.scale;
    // Scene khởi động lại (vào trận / về bản đồ) thì lớp cũ đã bị huỷ: tạo lại
    if (!this.darkRT?.scene) this.darkRT = this.add.renderTexture(0, 0, width, height).setOrigin(0).setScrollFactor(0).setDepth(55);
    if (!this.lightBrush?.scene) this.lightBrush = this.make.image({ key: 'fx-light', add: false });
    const rt = this.darkRT.setVisible(true);
    rt.clear();
    rt.fill(0x000000, 1);
    const cam = this.cameras.main;
    const lights = [[this.player.x, this.player.y - CHAR_HEIGHT / 2, CELL * 3]];
    for (const o of this.map.objects) {
      if (o.kind === 'lantern' && this.litLanterns?.has(o.id)) lights.push([o.x * CELL + CELL / 2, o.y * CELL, CELL * 3.8]);
    }
    for (const [wx, wy, r] of lights) {
      this.lightBrush.setScale((r * 2) / 128);
      rt.erase(this.lightBrush, wx - cam.scrollX, wy - cam.scrollY);
    }
  }

  // Bị chặn đường (cửa khoá, lính gác...): báo một lần rồi bỏ phím đang giữ, không thì thông báo hiện lại liên tục
  runBlocked(fn) {
    this.runEvent(async () => {
      await fn();
      this.resetHeldKeys();
    });
  }

  // Chạy một sự kiện (hội thoại, cảnh cắt): khoá điều khiển trong lúc chạy, xong thì tự lưu
  async runEvent(fn) {
    this.busy = true;
    this.setFrame('stand');
    try {
      await fn();
    } catch (err) {
      console.error('Lỗi sự kiện:', err);
    }
    this.busy = false;
    this.refreshNpcs();
    this.save();
  }

  // Sau mỗi sự kiện: NPC cốt truyện nào vừa đủ điều kiện thì xuất hiện, hết điều kiện thì biến mất
  refreshNpcs() {
    for (const def of STORY_NPCS) {
      if (def.map !== this.map.id) continue;
      const npc = this.findNpc(def.id);
      const show = !def.show || def.show();
      if (show && !npc) this.npcs.push(this.createNpc(def));
      else if (!show && npc) this.removeNpc(npc);
    }
  }

  // ---------- Giao diện trên bản đồ ----------

  // Thẻ Huấn luyện viên: thời gian chơi, ngày bắt đầu, tổng Pokémon, huy hiệu, tiền (ui/TrainerCard.js)
  openTrainerCard() {
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    this.setFrame('stand');
    this.runEvent(() => showTrainerCard(this, this.router, this.playerTexture(false)));
  }

  // Game tự lưu nên không báo "Đã lưu game" mỗi lần; chỉ báo đỏ khi tab khác đang chơi (tab này thôi lưu)
  save() {
    if (!this.map) return false;
    const ok = saveGame({
      map: this.map.id, x: this.pos.x, y: this.pos.y, facing: this.facing, vehicle: this.vehicle, mount: this.mount?.uid ?? null,
    });
    if (!ok && saveBlocked() && !this.warnedStale) {
      this.warnedStale = true;
      this.hud.showSaveNote('Game đang chơi ở tab khác, tab này không lưu nữa', true);
    }
    return ok;
  }

  // ---------- Bản đồ ----------

  loadMap(id, { x, y }, facing) {
    this.setVehicle(null, null, false);
    // Vào Pokémon Center nào thì đó thành nơi tỉnh dậy khi thua trận / dùng Escape Rope
    if (MAPS[id].heal) state.lastCenter = { map: id, ...MAPS[id].heal, healer: HEAL_RESPAWN.healer };
    const place = placeOf(id);
    if (place) state.visited.add(place);
    this.mapLayers?.forEach((o) => o.destroy());
    for (const npc of this.npcs) {
      npc.sprite.destroy();
      npc.shadow.destroy();
    }

    const map = MAPS[id];
    this.map = map;
    const layer = (suffix, depth, frame) => this.add.image(0, 0, `${id}-${suffix}`, frame).setOrigin(0).setScale(WORLD_SCALE).setDepth(depth);
    this.animLayer = layer('anim', 0.5, '0');
    // Gym đã có huy hiệu: nền vẽ bản "đã thắng" (ô gió tắt, sàn băng / miệng lò thành sàn thường, gfx/world.js)
    const cleared = gymClearedArt(this, map) ? '-cleared' : '';
    this.groundLayer = layer(`ground${cleared}`, 0);
    this.objectsLayer = layer(`objects${cleared}`, 1);
    // Lớp over (ngọn cây) nằm trên nhân vật để nhân vật đứng sau cây bị che
    this.mapLayers = [this.groundLayer, this.animLayer, this.objectsLayer, layer('over', 30)];
    this.npcs = [...NPCS, ...TRAINERS, ...STORY_NPCS]
      .filter((d) => d.map === id && (!d.show || d.show()))
      .map((d) => this.createNpc(d));
    this.litLanterns = new Set(); // đèn lồng đã thắp (gym tối), tắt lại khi ra khỏi gym
    this.refreshObjects();
    this.setupGymPuzzle(map);

    this.pos = { x, y };
    this.facing = facing;
    this.placePlayer();
    this.setFrame('stand');
    this.placeFollower();

    // Bản đồ nhỏ hơn màn hình (trong nhà) thì đặt giữa màn hình, nền đen xung quanh
    const cam = this.cameras.main;
    const w = map.width * CELL;
    const h = map.height * CELL;
    if (w <= this.scale.width && h <= this.scale.height) {
      cam.stopFollow();
      cam.removeBounds();
      cam.centerOn(w / 2, h / 2 + 40);
    } else {
      // Hẹp hơn màn hình theo một chiều thì nới khung camera để bản đồ nằm giữa theo chiều đó
      const sw = this.scale.width;
      const sh = this.scale.height;
      const bx = w < sw ? (w - sw) / 2 : 0;
      const by = h < sh ? (h - sh) / 2 : 0;
      cam.setBounds(bx, by, Math.max(w, sw), Math.max(h, sh)).setRoundPixels(true);
      cam.startFollow(this.player, true);
    }
    this.hud.showMapName(map.name);
    this.ambience.apply(map);
  }

  // Câu đố gym dựng lại mỗi lần vào bản đồ: tảng đá đẩy được về chỗ cũ, hố chưa lấp; lửa ở miệng lò (Gym Lò Gốm)
  // Gym đã có huy hiệu (map.cleared): không dựng câu đố, hố hiện như đã lấp (map.js: calmTiles)
  setupGymPuzzle(map) {
    this.boulders = new Map();
    this.filledHoles = new Set();
    this.ventFires = [];
    this.ventPhase = null;
    this.gymProps = [];
    map.cleared = Boolean(map.badge && state.badges.has(map.badge));
    const prop = (sprite) => {
      this.mapLayers.push(sprite);
      this.gymProps.push(sprite);
      return sprite;
    };
    if (map.cleared) {
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.tiles[map.tileAt(x, y)].hole) prop(this.add.image(x * CELL + CELL / 2, y * CELL + CELL / 2, 'obj-hole-filled').setScale(WORLD_SCALE).setDepth(0.6));
        }
      }
      this.drawGlowEdges(map);
      return;
    }
    for (const [x, y] of map.boulders ?? []) {
      const sprite = prop(this.add.image(x * CELL + CELL / 2, y * CELL + CELL / 2, 'obj-pushrock').setScale(WORLD_SCALE).setDepth(10 + (y * CELL + CELL) / 10000));
      this.boulders.set(`${x},${y}`, { x, y, sprite });
    }
    this.drawGlowEdges(map);
    if (!map.vents) return;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const group = map.info(x, y).vent;
        if (group === undefined) continue;
        const fire = prop(this.add.image(x * CELL + CELL / 2, (y + 1) * CELL - 2, 'obj-ventfire-0').setOrigin(0.5, 1).setScale(WORLD_SCALE)
          .setDepth(10 + ((y + 1) * CELL) / 10000 + 0.0001).setVisible(false));
        this.ventFires.push({ x, y, group, fire });
      }
    }
  }

  // Gym tối: viền tường điện phát sáng mờ xuyên qua bóng tối (nằm trên lớp tối) để vẫn nhìn ra đâu là tường, đâu là lối đi
  drawGlowEdges(map) {
    if (!map.dark || map.cleared) return;
    const g = this.add.graphics().setDepth(56);
    this.mapLayers.push(g);
    this.gymProps.push(g);
    const wall = (x, y) => map.tileAt(x, y) === 'Z';
    const t = WORLD_SCALE;
    g.fillStyle(0x58d8ff, 0.55);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!wall(x, y)) continue;
        const ox = x * CELL;
        const oy = y * CELL;
        // viền phía giáp lối đi
        if (!wall(x, y - 1)) g.fillRect(ox, oy, CELL, t);
        if (!wall(x, y + 1)) g.fillRect(ox, oy + CELL - t, CELL, t);
        if (!wall(x - 1, y)) g.fillRect(ox, oy, t, CELL);
        if (!wall(x + 1, y)) g.fillRect(ox + CELL - t, oy, t, CELL);
      }
    }
  }

  // Vừa thắng thủ lĩnh: tắt câu đố ngay trong gym (cổng mở, đèn sáng, lửa tắt, hố lấp...)
  async clearGym() {
    if (!this.map.badge) return;
    this.gymProps.forEach((s) => s.destroy());
    this.setupGymPuzzle(this.map);
    this.refreshObjects();
    if (gymClearedArt(this, this.map)) {
      this.groundLayer.setTexture(`${this.map.id}-ground-cleared`);
      this.objectsLayer.setTexture(`${this.map.id}-objects-cleared`);
    }
    this.cameras.main.flash(260, 255, 250, 220);
    if (this.map.clearLine) await this.say(null, [this.map.clearLine]);
  }

  // Nhịp phụt lửa (Gym Lò Gốm): hai nhóm miệng lò thay phiên, mỗi nhóm phụt VENT_MS mili giây
  ventActive(group, time = this.time.now) {
    return Math.floor(time / VENT_MS) % 2 === group;
  }

  updateVents(time) {
    if (!this.ventFires?.length) return;
    const phase = Math.floor(time / VENT_MS) % 2;
    const frame = Math.floor(time / 120) % 2;
    for (const v of this.ventFires) v.fire.setVisible(v.group === phase).setTexture(`obj-ventfire-${frame}`);
    if (phase === this.ventPhase) return;
    this.ventPhase = phase;
    // Đang đứng trên miệng lò thì lửa phụt trúng
    const group = this.map.info(this.pos.x, this.pos.y).vent;
    if (group === phase && !this.busy && !this.moving && !this.partyMenu && !this.overlay) this.runEvent(() => this.burnTrap());
  }

  // Đẩy tảng đá (Gym Núi Đá): đá lăn một ô theo hướng đẩy; lăn xuống hố thì lấp hố thành đường đi. Người đứng yên.
  async pushBoulder(rock, dir) {
    const d = DIRS[dir];
    const to = { x: rock.x + d.x, y: rock.y + d.y };
    const info = this.map.info(to.x, to.y);
    const key = `${to.x},${to.y}`;
    const intoHole = info.hole && !this.filledHoles.has(key);
    const free = !intoHole && !this.isBlocked(to.x, to.y) && !samePos(to, this.pos) && !info.push && !info.ice && !info.hole;
    if (!intoHole && !free) {
      this.cameras.main.shake(80, 0.002);
      return;
    }
    this.busy = true;
    this.boulders.delete(`${rock.x},${rock.y}`);
    await tweenAsync(this, { targets: rock.sprite, x: to.x * CELL + CELL / 2, y: to.y * CELL + CELL / 2, duration: 180, ease: 'Quad.out' });
    if (intoHole) {
      // Đá rơi xuống hố: thu nhỏ rồi thành mặt đá phẳng lấp kín hố
      await tweenAsync(this, { targets: rock.sprite, scale: WORLD_SCALE * 0.6, alpha: 0.4, duration: 160 });
      rock.sprite.destroy();
      this.filledHoles.add(key);
      this.mapLayers.push(this.add.image(to.x * CELL + CELL / 2, to.y * CELL + CELL / 2, 'obj-hole-filled').setScale(WORLD_SCALE).setDepth(0.6));
      this.cameras.main.shake(140, 0.005);
    } else {
      rock.x = to.x;
      rock.y = to.y;
      rock.sprite.setDepth(10 + (to.y * CELL + CELL) / 10000);
      this.boulders.set(key, rock);
    }
    this.busy = false;
  }

  // Thắp đèn lồng (Gym Đèn Lồng tối om): cả vùng quanh đèn sáng lên
  async lightLantern(obj) {
    if (this.litLanterns.has(obj.id) || this.map.cleared) {
      await this.say(null, ['Đèn lồng đang cháy sáng, soi rõ cả vùng xung quanh.']);
      return;
    }
    this.litLanterns.add(obj.id);
    this.refreshObjects();
    this.cameras.main.flash(160, 255, 210, 120);
    await this.say(null, ['Bạn thắp đèn lồng. Ánh lửa đỏ soi sáng cả vùng xung quanh!']);
  }

  // Đồ vật đặt trên bản đồ (Poké Ball trên bàn phòng thí nghiệm, vật phẩm rơi, cây quả mọng)
  refreshObjects() {
    this.objectSprites.forEach((s) => {
      this.tweens.killTweensOf(s);
      s.destroy();
    });
    this.berryFruits = new Map();
    this.respawnShown = this.map.objects.filter((o) => o.respawnDays && objectVisible(o)).length;
    const visible = this.map.objects.filter(objectVisible);
    // Cây quả mọng đứng liền nhau trên một hàng thì chung một luống đất
    const treeAt = new Set(visible.filter((o) => o.kind === 'berry').map((o) => `${o.x},${o.y}`));
    this.objectSprites = visible.flatMap((o) => {
      const x = o.x * CELL + CELL / 2;
      if (o.kind === 'item' && o.icon) return [this.add.image(x, o.y * CELL + CELL / 2, ITEMS[o.item].icon).setScale(WORLD_SCALE * ITEM_SCALE).setDepth(2)];
      if (o.kind === 'item') {
        const ball = this.add.image(x, o.y * CELL + CELL / 2 + 3 * ZOOM, 'item-ball').setScale(WORLD_SCALE * ITEM_SCALE).setDepth(2);
        // Nằm trên mặt nước thì nhấp nhô theo sóng
        if (this.isWater(o.x, o.y)) this.tweens.add({ targets: ball, y: ball.y - 3 * ZOOM, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        return [ball];
      }
      // Đồ vật trong gym: cổng tre, hàng rào điện, công tắc (sáng lên khi đã bật)
      // Gym tối: hàng rào điện phát sáng, nhìn thấy cả trong bóng tối (nằm trên lớp tối)
      if (o.kind === 'gate' || o.kind === 'barrier') {
        const glow = o.kind === 'barrier' && this.map.dark && !this.map.cleared;
        return [this.add.image(x, o.y * CELL + CELL / 2, `obj-${o.look ?? o.kind}`).setScale(WORLD_SCALE).setDepth(glow ? 56 : 2)];
      }
      if (WALKABLE_OBJECTS.includes(o.kind)) {
        const on = hasFlag(o.flag);
        return [this.add.image(x, o.y * CELL + CELL / 2, `obj-switch${on ? '-on' : ''}`).setScale(WORLD_SCALE).setDepth(1.6)];
      }
      if (o.kind === 'lantern') {
        const lit = this.litLanterns?.has(o.id) || this.map.cleared;
        return [this.add.image(x, (o.y + 1) * CELL, `obj-lantern${lit ? '-lit' : ''}`).setOrigin(0.5, 1).setScale(WORLD_SCALE).setDepth(10 + ((o.y + 1) * CELL) / 10000)];
      }
      if (o.kind !== 'berry') return [this.add.image(x, o.y * CELL + CELL / 2, 'ball').setScale(0.3 * ZOOM).setDepth(2)];
      // Cây cao hơn 1 ô: xếp lớp theo hàng như nhân vật, đứng phía trên cây thì bị cây che
      const y = (o.y + 1) * CELL;
      const depth = 10 + y / 10000;
      // Ô đất trồng nằm sát mặt đất, cây và lớp hoa / quả xếp lớp theo hàng như nhân vật
      const left = treeAt.has(`${o.x - 1},${o.y}`);
      const right = treeAt.has(`${o.x + 1},${o.y}`);
      const soilKey = left && right ? 'berry-soil-m' : left ? 'berry-soil-r' : right ? 'berry-soil-l' : 'berry-soil';
      const soil = this.add.image(x, y - CELL / 2, soilKey).setScale(WORLD_SCALE).setDepth(1.5);
      // Gốc cây cắm giữa luống (luống chiếm hàng 1-14 của ô, gốc trong hình cây cách mép dưới 4 pixel): nhấc cây lên thêm
      // BERRY_LIFT pixel; thứ tự che vẫn tính theo ô của cây
      const ty = y - BERRY_LIFT * WORLD_SCALE;
      const tree = this.add.image(x, ty, `berry-tree-${o.berry}`).setOrigin(0.5, 1).setScale(WORLD_SCALE).setDepth(depth);
      const fruit = this.add.image(x, ty, `berry-ripe-${o.berry}`).setOrigin(0.5, 1).setScale(WORLD_SCALE).setDepth(depth + 1e-6);
      this.berryFruits.set(o.id, { fruit, berry: o.berry });
      return [soil, tree, fruit];
    });
    this.refreshBerries();
  }

  fadeOut(ms) {
    const cam = this.cameras.main;
    return new Promise((resolve) => {
      cam.once('camerafadeoutcomplete', resolve);
      cam.fadeOut(ms);
    });
  }

  // ---------- Chuyển bản đồ, hang động ----------

  // Bước lên ô chuyển bản đồ: lối đi sang tuyến đường / thị trấn bên cạnh (tối nhanh),
  // hoặc cửa hang (vòng tròn thu nhỏ quanh người chơi rồi mở ra ở bên kia)
  async warpTo(warp) {
    const target = MAPS[warp.to];
    // Bước vào phòng Thiên Vương đầu tiên: thử thách Liên minh bắt đầu lại từ đầu
    if (warp.resetLeague) resetLeague();
    // Đang đi xe / cưỡi thì sang bản đồ ngoài trời vẫn giữ nguyên
    const keep = !target.indoor && ['bike', 'ride'].includes(this.vehicle) ? [this.vehicle, this.mount] : null;
    // Đang lướt nước qua dòng sông nối hai bản đồ (Sông Lục Bình): sang bên kia vẫn ở dưới nước
    const swim = WATER_VEHICLES.includes(this.vehicle) ? [this.vehicle, this.mount] : null;
    if (warp.cave) await this.iris(true);
    else await this.fadeOut(160);
    this.loadMap(warp.to, { x: warp.tx, y: warp.ty }, warp.facing);
    if (keep) this.setVehicle(...keep);
    else if (swim && this.isWater(warp.tx, warp.ty)) this.setVehicle(...swim);
    if (warp.cave) {
      await this.iris(false);
    } else {
      this.cameras.main.fadeIn(160);
      await wait(this, 160);
    }
  }

  // Hiệu ứng vòng tròn: close = thu nhỏ quanh người chơi tới khi tối hẳn, ngược lại mở rộng ra
  // Giữa người chơi trên màn hình (toạ độ game 960x720). Bản 3D thay hàm này bằng vị trí trên cảnh 3D (view3d.js)
  playerScreenPoint() {
    const cam = this.cameras.main;
    return { x: this.player.x - cam.scrollX, y: this.player.y - CHAR_HEIGHT / 2 - cam.scrollY };
  }

  async iris(close, ms = 520) {
    const { width, height } = this.scale;
    this.irisGfx ??= this.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH + 40);
    const g = this.irisGfx;
    if (!close) await wait(this, 30); // đợi camera tới vị trí mới
    const { x: cx, y: cy } = this.playerScreenPoint();
    const max = Math.hypot(width, height);
    const o = { r: close ? max : 0 };
    const draw = () => {
      g.clear();
      g.fillStyle(0x000000);
      if (o.r <= 1) {
        g.fillRect(0, 0, width, height);
        return;
      }
      // Vành đen dày bao quanh lỗ tròn bán kính r
      g.lineStyle(max * 2, 0x000000);
      g.strokeCircle(cx, cy, o.r + max);
    };
    draw();
    await tweenAsync(this, { targets: o, r: close ? 0 : max, duration: ms, ease: close ? 'Quad.in' : 'Quad.out', onUpdate: draw });
    draw();
    if (!close) g.clear();
  }

  // Ô gió trong gym: bị thổi theo hướng mũi tên, qua liên tiếp các ô gió tới khi gặp sàn thường hoặc vật cản.
  // Sàn băng: trượt tiếp theo hướng đang đi tới khi đụng vật cản hoặc ra khỏi băng.
  async slide() {
    this.busy = true;
    const ice = Boolean(this.map.info(this.pos.x, this.pos.y).ice);
    let last = this.facing;
    const dirAt = ({ x, y }) => this.map.info(x, y).push ?? (this.map.info(x, y).ice ? last : null);
    const cells = [];
    let p = this.pos;
    for (let dir = dirAt(p); dir; dir = dirAt(p)) {
      last = dir;
      const next = { x: p.x + DIRS[dir].x, y: p.y + DIRS[dir].y };
      if (this.isBlocked(next.x, next.y) || cells.length > 30) break;
      cells.push(next);
      p = next;
    }
    this.sliding = ice;
    await this.walkPlayer(cells, ice ? 90 : 110);
    this.sliding = false;
    this.setFrame('stand');
    this.busy = false;
    if (cells.length) this.onStep();
  }

  // Bước xong: bỏ lớp cỏ của ô vừa rời
  clearGrassTrail() {
    this.updateGrassFront(this.pos);
  }

  // Dẫm phải than hồng (Gym Lò Gốm): bỏng chân, chạy ngược về lối vào gym
  async burnTrap() {
    const cam = this.cameras.main;
    cam.flash(220, 255, 110, 30);
    cam.shake(220, 0.006);
    await this.say(null, [this.map.trapLine ?? 'Á, nóng quá! Than hồng bỏng chân, phải chạy ngay ra lối vào!']);
    await this.fadeOut(220);
    this.pos = { ...this.map.entry };
    this.facing = 'up';
    this.placePlayer();
    this.setFrame('stand');
    this.placeFollower();
    cam.fadeIn(220);
    await wait(this, 220);
  }

  // Lớp phủ cố định theo camera (màn tiến hoá, huy hiệu, bảng hồi phục...): add(o) gắn vào lớp, destroy() xoá cả lớp
  overlayLayer(depth) {
    const objs = [];
    const add = (o) => {
      objs.push(fixToCamera(o).setDepth(depth));
      return o;
    };
    return { objs, add, destroy: () => objs.forEach((o) => o.destroy()) };
  }

  // Điện vinh danh: đội hình nhà vô địch lần lượt hiện lên rồi được ghi lại. first: lần đầu vô địch
  async hallOfFame(first) {
    this.overlay = true;
    const { width, height } = this.scale;
    const { objs, add, destroy } = this.overlayLayer(HUD_DEPTH + 3);
    const dim = add(this.add.rectangle(width / 2, height / 2, width, height, 0x140c28, 1)).setAlpha(0);
    await tweenAsync(this, { targets: dim, alpha: 0.97, duration: 500 });
    add(this.add.image(width / 2, 290, 'fx-glow').setScale(9).setTint(0xf8d878).setAlpha(0.25));
    add(this.add.text(width / 2, 70, 'ĐIỆN VINH DANH', textStyle(42, '#f8e088', { fontStyle: 'bold' })).setOrigin(0.5));
    add(this.add.text(width / 2, 116, `Lần vô địch thứ ${state.hallOfFame.length + 1}`, textStyle(20, '#c8b8f0')).setOrigin(0.5));
    const team = state.party;
    const gap = Math.min(150, (width - 80) / team.length);
    const x0 = width / 2 - (gap * (team.length - 1)) / 2;
    for (const [i, mon] of team.entries()) {
      const x = x0 + i * gap;
      const key = pixelMon(this, mon.speciesId, '', GBA_MON, mon.shiny);
      const sprite = add(this.add.image(x, 300, key).setScale(fitScale(this, key, GBA_MON * 2)).setAlpha(0));
      add(this.add.text(x, 372, mon.name, textStyle(20, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
      add(this.add.text(x, 398, `Lv ${mon.level}`, textStyle(18, '#c8b8f0')).setOrigin(0.5));
      await tweenAsync(this, { targets: sprite, alpha: 1, y: 290, duration: 320, ease: 'Back.out' });
    }
    this.cameras.main.flash(500, 255, 240, 200);
    state.hallOfFame.push({
      at: Date.now(),
      team: team.map(({ speciesId, name, level, shiny }) => ({ speciesId, name, level, shiny })),
    });
    await this.say(null, first
      ? ['Chúc mừng! Bạn đã trở thành Nhà vô địch vùng Sơn Thủy!', 'Tên bạn và đội Pokémon này được ghi vào Điện vinh danh mãi mãi.']
      : ['Chúc mừng! Bạn đã bảo vệ thành công ngôi vị Nhà vô địch!', 'Đội Pokémon này cũng được ghi vào Điện vinh danh.']);
    await tweenAsync(this, { targets: objs, alpha: 0, duration: 400 });
    destroy();
    this.overlay = false;
  }

  // Sau Điện vinh danh: ra lại cao nguyên trước cửa Liên minh, Pokémon được hồi phục
  async leaveLeague() {
    healParty();
    await this.warpTo({ to: 'league', tx: 14, ty: 8, facing: 'down' });
    await this.say(null, ['Pokémon của bạn đã được hồi phục hoàn toàn.', 'Muốn thách đấu lại thì cứ vào sảnh Liên minh, Tứ Thiên Vương luôn chờ bạn!']);
  }

  // Ô dịch chuyển (Gym Chùa Cổ): người chơi xoay tròn, loé sáng rồi hiện ra ở ô đích
  async teleport(pad) {
    const spin = async (turns) => {
      for (let i = 0; i < turns; i++) {
        this.facing = ['down', 'left', 'up', 'right'][i % 4];
        this.setFrame('stand');
        await wait(this, 45);
      }
    };
    this.setFrame('stand');
    await spin(8);
    this.cameras.main.flash(200, 220, 180, 255);
    this.pos = { x: pad.tx, y: pad.ty };
    this.placePlayer();
    await spin(5);
    this.facing = 'down';
    this.setFrame('stand');
    this.placeFollower();
  }

  // Dẫm lên công tắc trong gym: switch bật cờ (mở cổng, chỉ một lần), toggle đổi cờ bật / tắt (hàng rào điện đổi chỗ).
  // Trả về true nếu có sự kiện (dừng bước đi)
  pressSwitch(plate) {
    if (this.map.cleared) return false; // gym đã có huy hiệu: công tắc không còn tác dụng
    if (plate.kind === 'switch') {
      if (hasFlag(plate.flag)) return false;
      setFlag(plate.flag);
      this.refreshObjects();
      this.cameras.main.shake(150, 0.004);
      this.runEvent(() => this.say(null, [this.map.switchLine ?? 'Cạch! Có tiếng cổng tre mở ra ở đâu đó.']));
      return true;
    }
    if (hasFlag(plate.flag)) state.flags.delete(plate.flag);
    else setFlag(plate.flag);
    this.refreshObjects();
    this.cameras.main.flash(120, 255, 240, 160);
    this.runEvent(() => this.say(null, [this.map.toggleLine ?? 'Bzzzt! Các hàng rào điện đổi chỗ.']));
    return true;
  }

  // Nhận huy hiệu: huy hiệu xoay vào giữa màn hình, lấp lánh
  async showBadge(badge) {
    const { width } = this.scale;
    const { objs, add, destroy } = this.overlayLayer(HUD_DEPTH + 30);
    const glow = add(this.add.image(width / 2, 250, 'fx-glow').setScale(0).setTint(badge.color));
    const icon = add(this.add.image(width / 2, 250, `badge-${badge.id}`).setScale(0));
    this.tweens.add({ targets: glow, scale: 6, alpha: 0.7, duration: 500 });
    await tweenAsync(this, { targets: icon, scale: 3, angle: 360, duration: 700, ease: 'Back.out' });
    await this.say(null, [`Bạn nhận được ${badge.name}!`]);
    await tweenAsync(this, { targets: objs, alpha: 0, duration: 300 });
    destroy();
  }

  // Bản đồ vùng: các thị trấn, tuyến đường, hang đã tới và vị trí hiện tại
  openRegionMap() {
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    if (!itemCount('townMap')) {
      this.runEvent(() => this.say(null, ['Bạn chưa có bản đồ vùng.']));
      return;
    }
    this.setFrame('stand');
    this.scene.launch('RegionMap', { mapId: this.map.id });
    this.scene.pause();
  }

  // ---------- Ra vào cửa ----------

  // Người chơi tự đi qua cửa / thảm ra: khoá điều khiển trong lúc chuyển cảnh, xong thì tự lưu
  async travel(transition) {
    this.busy = true;
    try {
      await transition();
    } catch (err) {
      console.error('Lỗi chuyển cảnh:', err);
    }
    this.busy = false;
    this.save();
  }

  // Cửa kính trượt mở: phần tối bên trong lộ ra từ giữa. Trả về cửa để đóng lại bằng closeDoor
  async openDoor(building, instant = false) {
    const g = doorGlass(building);
    const door = this.add
      .rectangle((g.x + g.w / 2) * WORLD_SCALE, g.y * WORLD_SCALE, g.w * WORLD_SCALE, g.h * WORLD_SCALE, 0x1c2430)
      .setOrigin(0.5, 0)
      .setDepth(1.5)
      .setScale(instant ? 1 : 0, 1);
    this.mapLayers.push(door); // đổi bản đồ thì dọn luôn
    if (!instant) await tweenAsync(this, { targets: door, scaleX: 1, duration: DOOR_MS, ease: 'Quad.out' });
    return door;
  }

  async closeDoor(door) {
    await tweenAsync(this, { targets: door, scaleX: 0, duration: DOOR_MS, ease: 'Quad.in' });
    door.destroy();
  }

  // Nhân vật bước vào / ra khỏi bóng tối của cửa: mờ dần hoặc hiện dần trong lúc bước
  fadeMover(mover, show) {
    const targets = [mover.sprite, mover.shadow];
    this.tweens.killTweensOf(targets);
    mover.sprite.setAlpha(show ? 0 : 1);
    mover.shadow.setAlpha(show ? 0 : SHADOW_ALPHA);
    this.tweens.add({ targets: mover.sprite, alpha: show ? 1 : 0, duration: DOOR_STEP_MS });
    this.tweens.add({ targets: mover.shadow, alpha: show ? SHADOW_ALPHA : 0, duration: DOOR_STEP_MS });
  }

  // Đi vào nhà (đang đứng ngay dưới cửa): cửa mở, bước vào rồi tối màn hình,
  // bên trong hiện ra trên thảm cửa và bước lên một ô
  async enterDoor(building) {
    this.facing = 'up';
    this.setFrame('stand');
    await this.openDoor(building);
    this.fadeMover(this.playerMover, false);
    await Promise.all([this.walkPlayer([{ ...building.door }], DOOR_STEP_MS), this.fadeOut(DOOR_STEP_MS + 60)]);

    const inside = MAPS[building.to];
    for (const flag of inside.resetFlags ?? []) state.flags.delete(flag);
    const mat = { x: inside.entry.x, y: inside.entry.y + 1 };
    const onMat = Boolean(inside.info(mat.x, mat.y).exit);
    this.loadMap(building.to, onMat ? mat : inside.entry, 'up');
    this.tweens.killTweensOf([this.player, this.shadow]);
    this.player.setAlpha(1);
    this.shadow.setAlpha(SHADOW_ALPHA);
    this.cameras.main.fadeIn(DOOR_FADE_MS);
    if (onMat) await this.walkPlayer([inside.entry], DOOR_STEP_MS);
  }

  // Ra khỏi nhà (vừa bước lên thảm cửa): bước tiếp xuống rồi tối màn hình,
  // bên ngoài hiện ra ở cửa đang mở, bước xuống một ô rồi cửa đóng lại
  async exitDoor() {
    const { to, x, y } = this.map.exit;
    this.fadeMover(this.playerMover, false);
    await Promise.all([this.walkPlayer([{ x: this.pos.x, y: this.pos.y + 1 }], DOOR_STEP_MS), this.fadeOut(DOOR_STEP_MS + 60)]);

    const building = MAPS[to].doorAt(x, y - 1);
    this.loadMap(to, building ? building.door : { x, y }, 'down');
    this.cameras.main.fadeIn(DOOR_FADE_MS);
    if (!building) {
      this.fadeMover(this.playerMover, true);
      return;
    }
    this.follower.alpha = 0;
    const door = await this.openDoor(building, true);
    this.fadeMover(this.playerMover, true);
    await this.walkPlayer([{ x, y }], DOOR_STEP_MS);
    this.tweens.add({ targets: this.follower, alpha: 1, duration: DOOR_STEP_MS });
    await this.closeDoor(door);
  }

  // NPC đi vào nhà (đang đứng ngay dưới cửa) rồi biến mất
  async npcEntersDoor(npc, building) {
    this.face(npc, 'up');
    const door = await this.openDoor(building);
    this.fadeMover(npc, false);
    await this.walkCells(npc, [{ ...building.door }], DOOR_STEP_MS);
    this.removeNpc(npc);
    await this.closeDoor(door);
  }

  // ---------- Người chơi ----------

  placePlayer() {
    const [x, y] = cellCenter(this.pos);
    this.player.setPosition(x, y);
    this.shadow.setPosition(x, y - 2);
    this.updateGrassFront(this.pos);
  }

  // Cỏ cao che chân người chơi. Đang bước thì ô vừa rời vẫn che tới khi bước xong, để lá cỏ không nhảy lên cắt ngang
  // người. Cưỡi Arcanine thì cỏ che chân thú cưỡi: nhìn ngang thân dài hơn một ô nên che cả hai ô cỏ hai bên
  updateGrassFront({ x, y }, from = null) {
    if (!this.map) return;
    const wide = this.vehicle === 'ride' && (this.facing === 'left' || this.facing === 'right');
    const cells = [];
    for (const c of [{ x, y }, from]) {
      if (!c) continue;
      for (const dx of wide ? [-1, 0, 1] : [0]) {
        const cell = { x: c.x + dx, y: c.y };
        const ch = this.map.tileAt(cell.x, cell.y);
        if ((ch === 'g' || ch === 'G') && !cells.some((o) => samePos(o, cell))) cells.push({ ...cell, deep: ch === 'G' });
      }
    }
    if (this.map.indoor || this.onWater()) cells.length = 0;
    while (this.grassFronts.length < cells.length) {
      this.grassFronts.push(this.add.image(0, 0, 'grass-front').setOrigin(0).setScale(WORLD_SCALE));
    }
    // Ngay trên người chơi / thú cưỡi đứng trong ô cỏ, dưới nhân vật ở hàng ô phía dưới (nhân vật cao 1,5 ô không bị che đầu)
    this.grassFronts.forEach((img, i) => {
      const c = cells[i];
      img.setVisible(Boolean(c));
      if (c) img.setTexture(c.deep ? 'grass-front-deep' : 'grass-front').setPosition(c.x * CELL, c.y * CELL).setDepth(10 + cellCenter(c)[1] / 10000 + 2e-6);
    });
  }

  setFrame(step = 'stand') {
    setCharFrame(this.player, this.facing, step);
  }

  // Hướng đang giữ phím (phím hướng theo Cài đặt → Phím tắt)
  readDirection() {
    return ['left', 'right', 'up', 'down'].find((d) => this.held.isDown(d)) ?? null;
  }

  // Bỏ mọi phím đang giữ (vd quay lại từ màn khác: phím nhả lúc bản đồ tạm dừng không được báo)
  resetHeldKeys() {
    this.input.keyboard.resetKeys();
    this.held.reset();
  }

  npcAt(x, y, except = null) {
    return this.npcs.find((n) => n !== except && n.pos.x === x && n.pos.y === y) ?? null;
  }

  isBlocked(x, y, except = null) {
    const obj = this.map.objectAt(x, y);
    const solidObject = obj && objectVisible(obj) && !WALKABLE_OBJECTS.includes(obj.kind);
    const key = `${x},${y}`;
    // Hố đã lấp đá (Gym Núi Đá) thì đi được; tảng đá chưa lấp hố thì chặn
    const solid = this.map.isSolid(x, y) && !(this.map.info(x, y).hole && this.filledHoles?.has(key));
    return solid || Boolean(this.boulders?.has(key)) || Boolean(this.npcAt(x, y, except)) || Boolean(solidObject);
  }

  // Xoay người ngay khi nhấn phím (bắt cả những lần chạm rất nhanh)
  tapTurn(dir, repeat) {
    if (!dir || repeat || dir === this.facing || this.moving || this.busy || this.partyMenu) return;
    this.facing = dir;
    this.setFrame('stand');
    this.turnUntil = this.time.now + TURN_MS;
  }

  stepMs() {
    return VEHICLE_STEP_MS[this.vehicle] ?? STEP_MS;
  }

  tryMove() {
    const next = this.pickStep(false);
    if (next) this.startWalk(this.playerMover, next, this.stepMs(), () => this.continueWalk());
  }

  // Vừa tới ô mới khi đang tự đi: xử lý sự kiện của ô, vẫn giữ phím thì bước tiếp ngay
  continueWalk() {
    this.onStep();
    if (this.busy) return null;
    const next = this.pickStep(true);
    if (next && this.playerMover.walk) this.playerMover.walk.duration = this.stepMs();
    return next;
  }

  // Ô kế tiếp người chơi bước tới theo phím đang giữ, hoặc null nếu đứng yên (chỉ xoay người, bị chặn, vào cửa, sự kiện).
  // Như game GBA: đang đứng mà bấm nhẹ hướng khác thì chỉ xoay người, giữ phím mới đi.
  // chained = true khi đang đi liên tục (vừa bước xong một ô).
  pickStep(chained) {
    const dir = this.readDirection();
    if (!dir) return null;
    if (!chained && dir !== this.facing) {
      this.facing = dir;
      this.setFrame('stand');
      this.turnUntil = this.time.now + TURN_MS;
      return null;
    }
    if (this.time.now < (this.turnUntil ?? 0)) return null;
    this.facing = dir;
    const next = { x: this.pos.x + DIRS[dir].x, y: this.pos.y + DIRS[dir].y };
    const door = dir === 'up' && this.map.doorAt(next.x, next.y);
    if (door) {
      if (!door.to) {
        this.runBlocked(() => this.say(null, houseKnock(this.map.id, door.door) ?? ['Cửa đóng chặt. Hình như không có ai ở nhà.']));
        return null;
      }
      // Không đi xe / cưỡi vào nhà: xuống trước cửa
      if (this.vehicle === 'ride') this.rideArcanine(false);
      else this.setVehicle(null);
      this.travel(() => this.enterDoor(door));
      return null;
    }
    if (this.onWater()) {
      if (this.isWater(next.x, next.y)) return this.isOccupied(next.x, next.y) ? null : next;
      if (this.isBlocked(next.x, next.y)) {
        this.setFrame('stand');
        return null;
      }
      const blocker = stepBlocker(this, next.x, next.y);
      if (blocker) {
        this.runBlocked(blocker);
        return null;
      }
      // Vào tới bờ: nhảy từ lưng thú cưỡi / khối nước lên bờ
      this.hopOffWater(next);
      return null;
    }
    // Gờ đất: đi tới đúng chiều dốc thì nhảy qua (ô đáp phải trống), chiều khác thì gờ chặn như vách
    const ledge = this.map.info(next.x, next.y).ledge;
    if (ledge === dir) {
      const land = { x: next.x + DIRS[dir].x, y: next.y + DIRS[dir].y };
      if (!this.isBlocked(land.x, land.y) && !this.isWater(land.x, land.y) && !stepBlocker(this, land.x, land.y)) {
        this.jumpLedge(dir);
        return null;
      }
    }
    const rock = this.boulders?.get(`${next.x},${next.y}`);
    if (rock) {
      this.setFrame('stand');
      this.pushBoulder(rock, dir);
      return null;
    }
    if (this.isBlocked(next.x, next.y)) {
      this.setFrame('stand');
      return null;
    }
    const blocker = stepBlocker(this, next.x, next.y);
    if (blocker) {
      this.runBlocked(blocker);
      return null;
    }
    return next;
  }

  // Nhảy qua gờ đất như game gốc: bay vòng cung qua ô gờ, đáp xuống ô bên kia; bóng vẫn chạy dưới đất, đáp thì nhún nhẹ.
  // Người nhảy trước; Pokémon đi theo bước tới mép gờ (ô người chơi vừa rời) rồi mới nhảy theo sau, đáp xuống thì nấp
  // chung ô, bước kế tiếp mới hiện ra sau lưng. Đang cưỡi thì thú cưỡi nhảy cùng
  async jumpLedge(dir) {
    this.busy = true;
    const d = DIRS[dir];
    const land = { x: this.pos.x + d.x * 2, y: this.pos.y + d.y * 2 };
    const from = cellCenter(this.pos);
    const to = cellCenter(land);
    this.facing = dir;
    this.pos = { ...land };
    this.updateGrassFront(land);
    const f = this.follower;
    const fFrom = f.ground ? [...f.ground] : from;
    const followerShown = f.sprite.visible;
    f.hop = null;
    f.stepT = null;
    const o = { t: 0 };
    const shadowScale = [this.shadow.scaleX, this.shadow.scaleY];
    this.setFrame(this.mount ? 'stand' : 'left');
    await tweenAsync(this, {
      targets: o,
      t: 1,
      duration: LEDGE_JUMP_MS,
      onUpdate: () => {
        const { t } = o;
        const x = Phaser.Math.Linear(from[0], to[0], t);
        const y = Phaser.Math.Linear(from[1], to[1], t);
        const lift = Math.sin(t * Math.PI) * LEDGE_HOP;
        this.player.setPosition(x, y - lift);
        this.shadow.setPosition(x, y - 2).setScale(shadowScale[0] * (1 - 0.3 * lift / LEDGE_HOP), shadowScale[1]);
        if (t > 0.5) this.setFrame('stand');
        // Pokémon đi theo: trong lúc người đang bay thì bước tới mép gờ (ô người vừa rời)
        if (followerShown) {
          const ft = Phaser.Math.Clamp(t / 0.7, 0, 1);
          f.ground = [Phaser.Math.Linear(fFrom[0], from[0], ft), Phaser.Math.Linear(fFrom[1], from[1], ft)];
          f.stepT = ft < 1 ? ft : null;
        }
      },
    });
    this.shadow.setScale(...shadowScale);
    // Đáp đất: nhún người một chút, bụi tung lên hai bên chân
    this.dust(to[0], to[1], { count: 2, spread: (this.mount ? 9 : 5) * WORLD_SCALE });
    const squash = tweenAsync(this, { targets: this.player, scaleY: this.player.scaleY * 0.9, duration: 60, yoyo: true });
    if (followerShown) {
      // Rồi Pokémon mới nhảy qua gờ theo sau
      f.stepT = null;
      this.faceFollower(dir);
      const p = { t: 0 };
      await tweenAsync(this, {
        targets: p,
        t: 1,
        duration: FOLLOWER_LEDGE_MS,
        onUpdate: () => {
          f.ground = [Phaser.Math.Linear(from[0], to[0], p.t), Phaser.Math.Linear(from[1], to[1], p.t)];
          f.jumpLift = Math.sin(p.t * Math.PI) * LEDGE_HOP * 0.8;
        },
      });
    }
    await squash;
    f.jumpLift = 0;
    f.stepT = null;
    f.pos = { ...land };
    f.tucked = true;
    f.facing = dir;
    this.setFollowerPosition(land);
    this.refreshFollower();
    this.busy = false;
    this.onStep();
  }

  // Người chơi bắt đầu bước sang ô kề bên: Pokémon đi theo nhảy vào ô vừa rời
  beginPlayerStep(next) {
    const prev = this.pos;
    this.facing = directionTo(prev, next);
    this.pos = { ...next };
    // Đang đi xe / cưỡi thì Pokémon đi theo tạm ẩn
    if (!this.vehicle) this.moveFollower(prev);
    this.updateGrassFront(next, prev);
    // Arcanine phi nước đại: chân sau hất bụi lên ở ô vừa rời (cách một bước một lần)
    if (this.vehicle === 'ride' && this.playerMover.foot) this.dust(...cellCenter(prev));
  }

  // ---------- Xe đạp, cưỡi Pokémon, lướt nước ----------

  isWater(x, y) {
    return !this.map.indoor && this.map.tileAt(x, y) === 'w';
  }

  // Ô nước có NPC / đồ vật chắn
  isOccupied(x, y) {
    const obj = this.map.objectAt(x, y);
    return Boolean(this.npcAt(x, y) || (obj && objectVisible(obj)));
  }

  onWater() {
    return WATER_VEHICLES.includes(this.vehicle);
  }

  // Cách di chuyển có người chở:
  //  'ride'      cưỡi Arcanine trên cạn (cần vật phẩm Thú cưỡi Arcanine)
  //  'waterRide' cưỡi Lapras trên nước, nhanh (cần vật phẩm Thú cưỡi Lapras)
  //  'surf'      Pokémon trong đội dùng chiêu Surf, người chơi ngồi trên khối nước (chậm)
  mountOf(kind) {
    const id = MOUNT_ITEMS[kind];
    if (!id || !itemCount(id)) return null;
    return { uid: `mount-${ITEMS[id].species}`, speciesId: ITEMS[id].species, shiny: false };
  }

  canSurf(mon) {
    return mon.hp > 0 && mon.moves.includes('surf');
  }

  // Đang đứng trên bãi đất giữa nước không có lối đi bộ ra (cửa nhà, lối chuyển bản đồ), vd bãi bồi giữa Sông Lục Bình:
  // chỉ rời đi được bằng đường nước
  strandedOnLand() {
    const seen = new Set();
    const queue = [{ ...this.pos }];
    while (queue.length) {
      const { x, y } = queue.pop();
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (this.map.warpAt(x, y) && !this.isWater(x, y)) return false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx < 0 || ny < 0 || nx >= this.map.width || ny >= this.map.height) continue;
        if (this.map.doorAt(nx, ny)) return false;
        if (!this.map.isSolid(nx, ny) && !this.isWater(nx, ny)) queue.push({ x: nx, y: ny });
      }
    }
    return true;
  }

  // kind: null (đi bộ) | 'bike' | 'ride' | 'surf' | 'waterRide'; mon: Pokémon chở
  setVehicle(kind, mon = null, placeFollower = true) {
    const was = this.vehicle ?? null;
    this.vehicle = kind;
    this.mount = ['ride', 'surf', 'waterRide'].includes(kind) ? mon : null;
    if (!this.player) return;
    this.player.setTexture(this.playerTexture(kind === 'bike'));
    this.player.setOrigin(0.5, 1).setCrop();
    this.riderLift = null;
    this.riderView = null;
    this.setFrame('stand');
    this.mountSprite ??= this.add.sprite(0, 0, 'fx-leaf').setOrigin(0.5, 1);
    this.mountSparkle ??= attachShinySparkle(this, this.mountSprite);
    this.mountOver ??= this.add.sprite(0, 0, 'fx-leaf').setOrigin(0.5, 1);
    // Hình cưỡi riêng (gfx/mounts.js): người chơi ngồi kẹp giữa lớp thân (dưới) và lớp đầu / mông (trên), giấu chân.
    // Lướt bằng chiêu Surf: ngồi trên khối nước xanh như game gốc (Pokémon biết Surf là loài nào cũng vậy)
    this.rideArt = this.mount ? (kind !== 'surf' && hasRideArt(this.mount.speciesId) ? this.mount.speciesId : 'surf') : null;
    this.rideKey = this.rideArt ? rideTexture(this, this.rideArt) : null;
    for (const s of [this.mountSprite, this.mountOver]) s.setVisible(Boolean(this.rideKey)).setAlpha(1).setScale(CHAR_SCALE);
    if (this.rideKey) {
      this.mountSprite.setTexture(this.rideKey, 'down-0');
      this.mountOver.setTexture(`${this.rideKey}-over`, 'down-0');
    }
    // Thú cưỡi là Pokémon shiny (không tính khối nước khi lướt Surf): lấp lánh
    this.mountSparkle.setVisible(Boolean(this.mount?.shiny) && kind !== 'surf');
    // Dưới nước: hình cưỡi có bọt sóng quanh thân, không có bóng. Trên cạn: bóng tròn chung kéo dài dưới chân thú cưỡi
    // (đặt theo hướng nhìn trong placeMount)
    this.shadow.setVisible(!this.mount || !WATER_VEHICLES.includes(kind)).setScale(...SHADOW);
    if (was && !kind && placeFollower) this.placeFollower();
    else this.refreshFollower();
    this.placeMount(this.time.now);
    this.updateGrassFront(this.pos ?? { x: -1, y: -1 });
  }

  // Thú cưỡi / khối nước: to hơn người chơi, người ngồi trên lưng; quay theo hướng đi, lướt nước thì nhấp nhô theo sóng.
  // Đang đi thì phi nước đại / quạt vây (2 nhịp); dưới nước đứng yên vẫn quạt vây chậm, bọt sóng gợn quanh thân.
  // Người ngồi lệch về phía lưng (đặt thú cưỡi lệch ngược lại, người chơi vẫn ở giữa ô), mép dưới phần người còn lại
  // (đã giấu chân) đặt ở độ cao yên, nhấp nhô theo sóng cùng thú cưỡi
  placeMount(time) {
    if (!this.mount || !this.rideKey) return;
    const water = this.onWater();
    const bob = water ? Math.sin(time / 260) * 2 : 0;
    const view = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
    const beat = this.moving ? MOUNT_BEAT_MS[this.vehicle] ?? 90 : water ? 420 : 0;
    const frame = `${view}-${beat && Math.floor(time / beat) % 2 ? 1 : 0}`;
    const { dx, seat, hide } = RIDE_SEAT[this.rideArt][view];
    const flip = this.facing === 'right';
    const base = this.mountAt ?? [this.player.x, this.player.y];
    const x = base[0] - (flip ? -dx : dx) * WORLD_SCALE * CHAR_SCALE;
    const y = base[1] + bob;
    const depth = this.mountAt ? 10 + base[1] / 10000 : this.player.depth;
    this.mountSprite.setFrame(frame).setFlipX(flip).setPosition(x, y).setDepth(depth - 1e-6);
    this.mountOver.setFrame(frame).setFlipX(flip).setPosition(x, y).setDepth(depth + 1e-6);
    if (this.mountAt) return; // đang nhảy lên / xuống: người chơi tự bay theo đường vòng cung
    // Giấu chân người ngồi (crop giữ nguyên khi đổi khung hình nên chỉ đặt lại khi đổi hướng nhìn)
    if (this.riderView !== view) {
      this.riderView = view;
      this.player.setCrop(0, 0, this.player.frame.width, this.player.frame.height - hide * WORLD_SCALE);
      this.updateGrassFront(this.pos);
      const shadow = MOUNT_SHADOW[this.rideArt]?.[view];
      if (shadow) this.shadow.setScale((shadow[0] * 2 * WORLD_SCALE) / 128, (shadow[1] * 2 * WORLD_SCALE) / 32);
    }
    this.riderLift = (seat - hide) * WORLD_SCALE * CHAR_SCALE - bob;
    this.player.setOrigin(0.5, 1 + this.riderLift / CHAR_HEIGHT);
  }

  async toggleBike() {
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    if (this.vehicle === 'bike') {
      this.setVehicle(null);
      return;
    }
    let problem = null;
    if (!itemCount('bicycle')) problem = 'Bạn chưa có xe đạp.';
    else if (this.map.indoor) problem = 'Không đi xe đạp trong nhà được.';
    else if (this.onWater()) problem = 'Đang ở dưới nước, không đi xe đạp được.';
    if (problem) this.runEvent(() => this.say(null, [problem]));
    else this.setVehicle('bike');
  }

  async toggleRide() {
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    if (this.vehicle === 'ride') {
      this.rideArcanine(false);
      return;
    }
    // Dưới nước: đổi qua lại giữa bơi bằng Surf và cưỡi Lapras
    if (this.onWater()) {
      const other = this.vehicle === 'surf' ? 'waterRide' : 'surf';
      const mon = other === 'waterRide' ? this.mountOf('waterRide') : state.party.find((m) => this.canSurf(m));
      if (mon) {
        this.setVehicle(other, mon);
        this.splash(this.player.x, this.player.y);
      } else this.runEvent(() => this.say(null, [other === 'waterRide' ? 'Bạn chưa có thú cưỡi Lapras.' : 'Không có Pokémon nào biết chiêu Surf.']));
      return;
    }
    const mon = this.mountOf('ride');
    let problem = null;
    if (!mon) problem = 'Bạn chưa có thú cưỡi Arcanine. Nghe nói ở Thành phố Lò Gốm có người nuôi Arcanine.';
    else if (this.map.indoor) problem = 'Không cưỡi Arcanine trong nhà được.';
    if (problem) {
      this.runEvent(() => this.say(null, [problem]));
      return;
    }
    this.rideArcanine(true);
  }

  // Lên / xuống lưng Arcanine: thú cưỡi nhún xuống đón người, bụi tung lên hai bên chân
  rideArcanine(on) {
    if (on) {
      this.setVehicle('ride', this.mountOf('ride'));
      this.tweens.add({ targets: [this.mountSprite, this.mountOver], scaleY: CHAR_SCALE * 0.85, duration: 90, yoyo: true });
    } else {
      this.setVehicle(null);
    }
    this.dust(this.player.x, this.player.y, { count: 2, spread: 10 * WORLD_SCALE });
  }

  // Đứng trước mặt nước bấm Enter: chọn cưỡi Lapras (nhanh) hoặc dùng chiêu Surf (chậm)
  async trySurf(target) {
    const rider = this.mountOf('waterRide');
    // Pokémon biết Surf gục trong trận dưới nước rồi lên bãi đất giữa sông: vẫn cố đưa bạn rời bãi, không bị kẹt
    const surfer = state.party.find((m) => this.canSurf(m))
      ?? (this.strandedOnLand() ? state.party.find((m) => m.moves.includes('surf')) : null);
    // Trong hang: nước ngầm tối thẫm (hồ / suối ngầm, data/tiles.js: CAVE_TILES)
    const look = this.map.cave ? 'Dòng nước ngầm sâu thẳm, lạnh buốt.' : 'Mặt nước trong xanh.';
    if (!rider && !surfer) {
      await this.say(null, [look, 'Cần Pokémon biết chiêu Surf, hoặc thú cưỡi Lapras.']);
      return;
    }
    this.msg.container.setVisible(true);
    this.speakerTag.setVisible(false);
    this.msg.setText(`${look} Muốn xuống nước không?`);
    const items = [
      ...(rider ? [{ label: 'Cưỡi Lapras', value: ['waterRide', rider] }] : []),
      ...(surfer ? [{ label: `Surf (${surfer.name})`, value: ['surf', surfer] }] : []),
      { label: 'Thôi', value: null },
    ];
    const choice = await new Menu(this, this.router, {
      x: 600, y: 330, width: 340, height: 60 + items.length * 56, rowHeight: 50, items, fixed: true, depth: HUD_DEPTH + 20,
    }).open();
    this.msg.container.setVisible(false);
    if (!choice || this.isOccupied(target.x, target.y)) return;
    if (choice[0] === 'surf') {
      await this.say(null, [choice[1].hp > 0 ? `${choice[1].name} dùng Surf!` : `${choice[1].name} đã kiệt sức nhưng vẫn cố đưa bạn rời bãi!`]);
    }
    await this.hopOntoWater(choice[0], choice[1], target);
  }

  // Xuống nước: thú cưỡi / khối nước nổi lên ở ô nước trước mặt (bọt nước bắn lên), người chơi nhảy vòng cung từ bờ
  // lên lưng rồi ngồi xuống (giấu chân). Pokémon đi theo ẩn đi trong lúc cưỡi
  async hopOntoWater(kind, mon, target) {
    // Đang đạp xe / cưỡi Arcanine thì xuống trước (Pokémon đi theo vẫn nấp, không hiện ra rồi lại ẩn)
    if (this.vehicle) {
      if (this.vehicle === 'ride') this.dust(this.player.x, this.player.y, { count: 2, spread: 10 * WORLD_SCALE });
      this.follower.tucked = true;
      this.setVehicle(null, null, false);
      await wait(this, 120);
    }
    const from = cellCenter(this.pos);
    const to = cellCenter(target);
    this.facing = directionTo(this.pos, target);
    this.mountAt = to; // thú cưỡi đứng yên ở ô nước, người chơi tự nhảy tới
    this.setVehicle(kind, mon);
    this.splash(to[0], to[1]);
    const layers = [this.mountSprite, this.mountOver];
    layers.forEach((l) => l.setAlpha(0));
    this.tweens.add({ targets: layers, alpha: 1, duration: 160 });
    await wait(this, 120);
    const { seat, hide } = RIDE_SEAT[this.rideArt][this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing];
    await this.hopWater(from, to, 0, (seat - hide) * WORLD_SCALE * CHAR_SCALE, true);
    this.pos = { ...target };
    this.mountAt = null;
    this.riderDepth = null;
    this.placePlayer();
    this.placeMount(this.time.now);
  }

  // Vào tới bờ: người chơi nhảy từ lưng thú cưỡi / khối nước lên ô land, thú cưỡi lặn xuống (khối nước tan) rồi mới tính
  // sự kiện của ô vừa đáp (lối ra, nhà huấn luyện...)
  async hopOffWater(land) {
    this.busy = true;
    const from = cellCenter(this.pos);
    const to = cellCenter(land);
    this.facing = directionTo(this.pos, land);
    this.placeMount(this.time.now); // quay thú cưỡi theo hướng nhảy, tính lại độ cao chỗ ngồi
    const lift = this.riderLift ?? 0;
    this.mountAt = from;
    this.riderView = null;
    this.player.setCrop().setOrigin(0.5, 1);
    this.setFrame('stand');
    this.pos = { ...land };
    await this.hopWater(from, to, lift, 0, false);
    // Thú cưỡi lặn xuống / khối nước tan vào mặt nước
    const layers = [this.mountSprite, this.mountOver];
    this.splash(from[0], from[1]);
    await tweenAsync(this, { targets: layers, alpha: 0, y: from[1] + 4 * WORLD_SCALE, duration: 200 });
    this.mountAt = null;
    this.riderDepth = null;
    this.setVehicle(null);
    this.placePlayer();
    this.busy = false;
    this.onStep();
  }

  // Nhảy vòng cung giữa bờ và lưng thú cưỡi dưới nước: from / to là điểm chạm đất (pixel), liftFrom / liftTo là độ cao
  // chân người chơi ở hai đầu (ngồi trên lưng thì cao hơn mặt nước). onto: nhảy lên lưng (nửa sau đã ngồi giữa hai lớp
  // của thú cưỡi), ngược lại là nhảy xuống (nửa đầu còn ở giữa hai lớp)
  async hopWater(from, to, liftFrom, liftTo, onto) {
    const o = { t: 0 };
    const mountDepth = 10 + this.mountAt[1] / 10000;
    this.shadow.setVisible(!onto).setAlpha(0);
    await tweenAsync(this, {
      targets: o,
      t: 1,
      duration: MOUNT_HOP_MS,
      onUpdate: () => {
        const { t } = o;
        const gx = Phaser.Math.Linear(from[0], to[0], t);
        const gy = Phaser.Math.Linear(from[1], to[1], t);
        const lift = Phaser.Math.Linear(liftFrom, liftTo, t) + Math.sin(t * Math.PI) * LEDGE_HOP * 0.7;
        this.player.setPosition(gx, gy - lift);
        this.riderDepth = (onto ? t >= 0.5 : t < 0.5) ? mountDepth : 10 + gy / 10000;
        if (!onto) this.shadow.setPosition(gx, gy - 2).setAlpha(SHADOW_ALPHA * t);
      },
    });
  }

  // Bọt nước bắn lên quanh điểm (x, y) trên mặt nước
  splash(x, y) {
    puffTextures(this);
    for (const [dx, delay] of [[-1, 0], [1, 40], [0, 80]]) {
      const drop = this.add.image(x + dx * 9 * WORLD_SCALE, y - 2 * WORLD_SCALE, 'fx-splash').setOrigin(0.5, 1)
        .setDepth(10 + y / 10000 + 2e-6).setAlpha(0.95);
      this.tweens.add({
        targets: drop, y: drop.y - 5 * WORLD_SCALE, alpha: 0, delay, duration: 360, ease: 'Quad.out', onComplete: () => drop.destroy(),
      });
    }
  }

  // Bụi tung lên ở điểm (x, y) trên mặt đất (cưỡi Arcanine phi nước đại, lên / xuống thú cưỡi, nhảy gờ đất đáp xuống).
  // Trong bụi cỏ cao hay dưới nước thì không có bụi
  dust(x, y, { count = 1, spread = 0 } = {}) {
    const cell = { x: Math.floor(x / CELL), y: Math.floor((y - 1) / CELL) };
    const ch = this.map.tileAt(cell.x, cell.y);
    if (ch === 'g' || ch === 'G' || this.isWater(cell.x, cell.y)) return;
    puffTextures(this);
    for (let i = 0; i < count; i++) {
      const dx = count > 1 ? (i / (count - 1) - 0.5) * 2 * spread : 0;
      const puff = this.add.image(x + dx, y, 'fx-dust-puff').setOrigin(0.5, 1).setAlpha(0.85).setDepth(10 + y / 10000 + 1.5e-6);
      this.tweens.add({
        targets: puff, x: puff.x + dx * 0.6, y: y - 3 * WORLD_SCALE, alpha: 0, duration: 420, ease: 'Quad.out', onComplete: () => puff.destroy(),
      });
    }
  }

  // ---------- Câu cá ----------

  // Đứng (hoặc lướt) trước mặt nước: thả câu, đợi cắn câu rồi bấm Enter thật nhanh để kéo lên
  async fish(rod) {
    const d = DIRS[this.facing];
    const target = { x: this.pos.x + d.x, y: this.pos.y + d.y };
    if (!this.isWater(target.x, target.y)) {
      await this.say(null, ['Hãy đến nơi có hồ nước hoặc đứng quay mặt về phía mặt nước để sử dụng.']);
      return;
    }
    // Vũng nước / suối nhỏ không có bảng Pokémon dưới nước (data/encounters.js): báo rõ thay vì bảo đi tìm mặt nước
    if (!this.map.water) {
      await this.say(null, ['Chỗ nước này nông quá, chẳng có Pokémon nào để câu cả.', 'Hãy thử ở hồ hoặc sông lớn hơn.']);
      return;
    }
    // Câu được thì phải đánh: không có Pokémon nào còn sức thì không thả câu
    if (!state.party.some((m) => m.hp > 0)) {
      await this.say(null, ['Không có Pokémon nào còn sức chiến đấu, câu được cũng không đánh được.']);
      return;
    }
    this.setFrame('stand');
    const [tx, ty] = cellCenter(target);
    const line = this.add.graphics().setDepth(this.player.depth + 0.001);
    line.lineStyle(2, 0xe8e8f0, 0.9);
    line.lineBetween(this.player.x, this.playerTop(0.6), tx, ty - CELL * 0.3);
    const bobber = this.add.circle(tx, ty - CELL * 0.3, 4, 0xe04040).setDepth(this.player.depth + 0.002);
    this.tweens.add({ targets: bobber, y: bobber.y + 3, duration: 400, yoyo: true, repeat: -1 });
    this.msg.container.setVisible(true);
    this.speakerTag.setVisible(false);
    const waits = 2 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= waits; i++) {
      this.msg.setText(`Bạn thả câu${'.'.repeat(i)}`);
      await wait(this, 450);
    }
    const cleanup = () => {
      line.destroy();
      bobber.destroy();
    };
    if (Math.random() >= ROD_BITE[rod]) {
      this.msg.container.setVisible(false);
      cleanup();
      await this.say(null, ['Chẳng có gì cắn câu cả...']);
      return;
    }
    // Cắn câu: phao chìm, có dấu "!", phải bấm Enter trong 1 giây
    this.tweens.killTweensOf(bobber);
    bobber.setY(bobber.y + 6);
    const alert = this.add.image(this.player.x, this.playerTop() - 2, 'fx-alert').setOrigin(0.5, 1).setScale(0.8).setDepth(HUD_DEPTH - 1);
    this.msg.setText('Có gì đó cắn câu! Bấm {key:confirm} ngay!');
    const caught = await new Promise((resolve) => {
      const timer = this.time.delayedCall(BITE_WINDOW_MS, () => resolve(false));
      const reel = () => {
        timer.remove();
        resolve(true);
      };
      this.router.set((e) => isConfirm(e) && reel(), reel);
    });
    this.router.clear();
    alert.destroy();
    cleanup();
    this.msg.container.setVisible(false);
    if (!caught) {
      await this.say(null, ['Ôi, nó tuột mất rồi...']);
      return;
    }
    await this.say(null, ['Câu được rồi!']);
    const { speciesId, level } = rollEncounter(this.map.water[rod], Math.random, state.party[0]);
    await this.startBattle({ enemy: createMonster(speciesId, level), zone: this.waterZone(), persist: true });
  }

  // Nền trận đấu với Pokémon dưới nước: trong hang là mặt nước ngầm dưới trần đá (BattleScene: 'caveWater')
  waterZone() {
    return this.map.cave ? 'caveWater' : 'water';
  }

  // Khu vực đang đứng cho bảng góc phải: gần mặt nước thì bảng lướt nước / câu cá, không thì khu bụi cỏ gần nhất
  // Bảng Pokémon hoang dã góc phải (ui/AreaNav.js): mọi Pokémon của bản đồ đang đứng, chỉ chia hai nhóm "Trên cạn"
  // (mọi bãi cỏ; trong hang là Pokémon của chính hang đó) và "Dưới nước" (lướt nước + mọi loại cần câu), không phụ thuộc
  // đứng gần bãi nào. Pokémon trong hang chỉ hiện khi đã vào hang (mỗi hang là một bản đồ riêng)
  areaInfo() {
    if (this.map.indoor || (!this.map.areas.length && !this.map.water)) return null;
    const land = [...new Set(this.map.areas.map((a) => a.table))];
    const water = this.map.water;
    const sea = water ? [water.surf, ...RODS.slice().reverse().map((r) => water[r])].filter(Boolean) : [];
    const sections = [];
    if (land.length) sections.push({ label: 'Trên cạn', tables: land });
    if (sea.length) sections.push({ label: 'Dưới nước', tables: [...new Set(sea)] });
    return { title: this.map.name, sections };
  }

  // ---------- Đi bộ theo từng frame ----------
  // mover: người chơi (this.playerMover) hoặc NPC, có sprite, shadow, walk và các hàm begin / setStep / progress.
  // Vị trí được tính lại mỗi frame trong update(); thời gian dư khi tới một ô dùng luôn cho ô kế tiếp,
  // nên đi nhiều ô liền mạch, không đứng khựng giữa các ô như khi nối tween bằng await.

  // Bước tới ô first; mỗi khi tới nơi next() trả về ô kế tiếp (null = dừng). Promise xong khi dừng hẳn.
  startWalk(mover, first, duration, next = () => null) {
    return new Promise((resolve) => {
      mover.walk = { duration, elapsed: 0, next, resolve, to: null, step: null };
      this.beginStep(mover, first);
    });
  }

  // Người chơi đi lần lượt qua các ô (dùng trong cảnh cắt, không kích hoạt sự kiện của ô)
  walkPlayer(cells, duration = STEP_MS) {
    return this.walkCells(this.playerMover, cells, duration);
  }

  // Đi lần lượt qua các ô kề nhau
  walkCells(mover, cells, duration) {
    if (!cells.length) return Promise.resolve();
    const queue = [...cells];
    return this.startWalk(mover, queue.shift(), duration, () => queue.shift() ?? null);
  }

  beginStep(mover, cell) {
    const w = mover.walk;
    w.from = w.to ?? [mover.sprite.x, mover.sprite.y];
    w.to = cellCenter(cell);
    mover.foot = !mover.foot;
    mover.begin(cell);
  }

  advanceWalk(mover, delta) {
    const w = mover.walk;
    if (!w) return;
    // Giới hạn delta để quay lại tab sau khi ẩn lâu không nhảy cóc nhiều ô
    w.elapsed += Math.min(delta, w.duration);
    while (w.elapsed >= w.duration) {
      w.elapsed -= w.duration;
      this.placeMover(mover, w.to, 1);
      // next() có thể chạy sự kiện / chuyển bản đồ, nên phải đặt vào đúng ô trước khi gọi
      const cell = w.next();
      if (mover.walk !== w) return;
      if (!cell) {
        mover.walk = null;
        mover.setStep('stand');
        w.resolve();
        return;
      }
      this.beginStep(mover, cell);
    }
    const t = w.elapsed / w.duration;
    this.placeMover(mover, [Phaser.Math.Linear(w.from[0], w.to[0], t), Phaser.Math.Linear(w.from[1], w.to[1], t)], t);
    // Nửa đầu mỗi bước bước chân trái / phải, nửa sau đứng thẳng
    const step = t < 0.5 ? (mover.foot ? 'left' : 'right') : 'stand';
    if (step !== w.step) mover.setStep((w.step = step));
  }

  placeMover(mover, [x, y], t) {
    mover.sprite.setPosition(x, y);
    mover.shadow.setPosition(x, y - 2);
    mover.progress?.(t);
  }

  onStep() {
    const info = this.map.info(this.pos.x, this.pos.y);
    const warp = this.map.warpAt(this.pos.x, this.pos.y);
    if (warp) {
      this.travel(() => this.warpTo(warp));
      return;
    }
    const pad = this.map.padAt(this.pos.x, this.pos.y);
    if (pad) {
      this.travel(() => this.teleport(pad));
      return;
    }
    if (info.trap || (info.vent !== undefined && this.ventActive(info.vent))) {
      this.runEvent(() => this.burnTrap());
      return;
    }
    if (info.push || info.ice) {
      this.slide();
      return;
    }
    const plate = this.map.objectAt(this.pos.x, this.pos.y);
    if (plate && WALKABLE_OBJECTS.includes(plate.kind) && this.pressSwitch(plate)) return;
    if (info.exit) {
      this.travel(() => this.exitDoor());
      return;
    }
    const trigger = stepTrigger(this);
    if (trigger) {
      this.runEvent(trigger);
      return;
    }
    const trainer = this.spottingTrainer();
    const repelEnded = stepRepel();
    const wild = repelEnded ? null : this.rollWild(info);
    if (!trainer && !wild && !repelEnded) return;
    this.runEvent(async () => {
      if (repelEnded) await this.say(null, [`Hiệu lực của ${ITEMS[repelEnded].name} đã hết.`]);
      // Vừa gặp Pokémon hoang dã vừa bị trainer nhìn thấy: đánh Pokémon hoang dã trước, xong trainer mới tới
      if (wild && (await this.startBattle(wild)) === 'lose') return;
      const t = wild ? this.spottingTrainer() : trainer;
      if (t) await this.trainerBattle(t, true);
    });
  }

  // Bước vào bụi cỏ / hang / mặt nước: trả về trận gặp Pokémon hoang dã, hoặc null
  // (mỗi khu bụi cỏ có bảng Pokémon riêng, data/map.js: areas; Repel chặn Pokémon yếu)
  rollWild(info) {
    let table = null;
    let zone = info.encounter;
    if (info.encounter) {
      if (info.encounter !== 'cave') this.rustle();
      table = this.map.areaAt(this.pos.x, this.pos.y)?.table ?? this.map.areas[0]?.table;
      if (!table || Math.random() >= ENCOUNTER_RATE) return null;
    } else if (this.onWater() && this.map.water && Math.random() < WATER_ENCOUNTER_RATE) {
      table = this.map.water.surf;
      zone = this.waterZone();
    } else {
      return null;
    }
    const { speciesId, level } = rollEncounter(table, Math.random, state.party[0]);
    if (repelBlocks(level)) return null;
    return { enemy: createMonster(speciesId, level), zone, persist: true };
  }

  rustle() {
    const [x, y] = cellCenter(this.pos);
    for (let i = 0; i < 5; i++) {
      const leaf = this.add.image(x + Phaser.Math.Between(-22, 22) * ZOOM, y - 10 * ZOOM, 'fx-leaf').setTint(0x3f9b2f).setScale(1.5 * ZOOM).setDepth(12);
      this.tweens.add({
        targets: leaf,
        x: leaf.x + Phaser.Math.Between(-24, 24) * ZOOM,
        y: leaf.y - Phaser.Math.Between(16, 36) * ZOOM,
        angle: Phaser.Math.Between(-90, 90),
        alpha: 0,
        duration: 380,
        onComplete: () => leaf.destroy(),
      });
    }
  }

  facePlayerTo(npc) {
    this.facing = directionTo(this.pos, npc.pos);
    this.setFrame('stand');
  }

  // ---------- Pokémon đi theo ----------

  // Pokémon đầu đội (đã gục vẫn đi theo như bình thường)
  followerMon() {
    return state.party[0] ?? null;
  }

  followerAt(x, y) {
    const f = this.follower;
    return Boolean(f.pos && f.sprite.visible && f.pos.x === x && f.pos.y === y);
  }

  // Sprite kiểu GBA thu nhỏ từ hình Pokémon (size x size pixel, phóng to x3), 3 hướng: down (mặt trước), up (lưng),
  // side (nghiêng sang trái). Loài nào chưa có hình lưng / nghiêng thì dùng tạm mặt trước. Shiny thì đổi màu như trong trận.
  followerTexture(speciesId, shiny, size = FOLLOWER_LOGICAL) {
    const key = `follow${size}-${speciesId}${shiny ? '-shiny' : ''}`;
    if (!this.textures.exists(key)) {
      const view = (suffix) => {
        const k = `mon-${speciesId}${suffix}`;
        const key = this.textures.exists(k) ? k : `mon-${speciesId}`;
        const image = shiny ? shinyImage(this, key, speciesId) : this.textures.get(key).getSourceImage();
        // Lấy màu đa số khi thu nhỏ (crisp): mảng màu sạch, không đục / xám như trộn màu
        return upscaleCanvas(spriteFromImage(image, size, undefined, { crisp: true }), WORLD_SCALE);
      };
      addSheetTexture(this, key, [view(''), view('-back'), view('-side')], ['down', 'up', 'side']);
    }
    return key;
  }

  // Quay Pokémon đi theo về hướng dir
  faceFollower(dir) {
    this.follower.facing = dir;
    faceMonSprite(this.follower.sprite, dir);
  }

  refreshFollower() {
    const mon = this.followerMon();
    const { sprite, shadow, pos } = this.follower;
    const show = Boolean(mon && pos && !this.follower.tucked && !this.vehicle);
    if (mon) {
      sprite.setTexture(this.followerTexture(mon.speciesId, mon.shiny));
      this.faceFollower(this.follower.facing ?? 'down');
    }
    sprite.setVisible(show);
    shadow.setVisible(show);
    this.followerSparkle?.setVisible(show && Boolean(mon?.shiny));
  }

  // Đặt Pokémon đi theo đứng ở ô (x, y); dáng đứng / bay vẽ mỗi khung hình trong animateFollower
  setFollowerPosition({ x, y }) {
    this.follower.ground = cellCenter({ x, y });
  }

  // Vừa vào bản đồ: đứng sau lưng người chơi, nếu chỗ đó bị chặn thì "nấp" chung ô, bước đầu tiên mới hiện ra
  placeFollower() {
    const back = DIRS[OPPOSITE[this.facing]];
    const behind = { x: this.pos.x + back.x, y: this.pos.y + back.y };
    // Không đứng lên thảm cửa ra hay ô cầu thang / ô chuyển bản đồ (vừa xuống cầu thang thì Pokémon nép bên cạnh)
    const free = !this.isBlocked(behind.x, behind.y) && !this.map.info(behind.x, behind.y).exit && !this.map.warpAt(behind.x, behind.y);
    this.follower.pos = free ? behind : { ...this.pos };
    this.follower.tucked = !free;
    this.follower.hop = null;
    this.follower.stepT = null;
    this.follower.facing = this.facing;
    this.setFollowerPosition(this.follower.pos);
    this.refreshFollower();
  }

  // Người chơi bước đi: Pokémon nhảy vào ô người chơi vừa rời (vị trí cập nhật trong hopFollower)
  moveFollower(to) {
    const f = this.follower;
    const from = f.pos;
    f.pos = { ...to };
    f.tucked = false;
    f.hop = null;
    this.refreshFollower();
    if (!f.sprite.visible) {
      this.setFollowerPosition(to);
      return;
    }
    if (!samePos(from, to)) this.faceFollower(directionTo(from, to));
    f.hop = { from: cellCenter(from), to: cellCenter(to), cell: { ...from } };
  }

  // Pokémon đi theo bước cùng nhịp với bước của người chơi (t: 0 → 1)
  hopFollower(t) {
    const f = this.follower;
    if (!f.hop) return;
    f.ground = [Phaser.Math.Linear(f.hop.from[0], f.hop.to[0], t), Phaser.Math.Linear(f.hop.from[1], f.hop.to[1], t)];
    f.stepT = t;
    if (t >= 1) {
      f.hop = null;
      f.stepT = null;
    }
  }

  // Dáng Pokémon đi theo mỗi khung hình, theo kiểu di chuyển của loài (data/followStyle.js):
  // đi bộ thì trượt mượt và hơi lắc lư, không có chân thì nhảy, có cánh thì bay lơ lửng và vỗ cánh,
  // lơ lửng thì bồng bềnh. Đứng yên thì "thở" nhẹ. Vừa được nói chuyện thì nhảy cẫng lên
  animateFollower(time) {
    const f = this.follower;
    const mon = this.followerMon();
    const style = mon ? followStyle(mon.speciesId) : null;
    this.followerGrass(style);
    if (!f.ground || !mon || !f.sprite.visible) return;
    const [x, y] = f.ground;
    const t = f.stepT;
    let lift = 0;
    let sx = 1;
    let sy = 1;
    let angle = 0;
    if (style === 'fly') {
      lift = FOLLOWER_FLY + Math.sin(time / 300) * 2 * CHAR_SCALE;
      // Vỗ cánh: thân hơi co lại theo nhịp cánh, khi bay thì vỗ nhanh hơn
      const flap = Math.abs(Math.sin(time / (t === null ? 95 : 70)));
      sx = 1 - flap * 0.1;
      sy = 1 + flap * 0.04;
    } else if (style === 'float') {
      lift = FOLLOWER_FLOAT + Math.sin(time / 520) * 2.5 * CHAR_SCALE;
      angle = Math.sin(time / 700) * 3;
    } else if (t !== null && style === 'hop') {
      lift = Math.sin(t * Math.PI) * FOLLOWER_HOP;
    } else if (t !== null) {
      // Đi bộ: nhún rất nhẹ, nghiêng qua lại theo nhịp chân
      lift = Math.abs(Math.sin(t * Math.PI * 2)) * 0.6 * CHAR_SCALE;
      angle = Math.sin(t * Math.PI * 2) * 4;
    } else {
      sy = 1 - (0.5 + 0.5 * Math.sin(time / 330)) * 0.05;
    }
    if (f.cheerAt !== undefined && time - f.cheerAt < 480) lift += Math.abs(Math.sin(((time - f.cheerAt) / 240) * Math.PI)) * 7 * CHAR_SCALE;
    lift += f.jumpLift ?? 0; // đang nhảy theo qua gờ đất
    const alpha = f.alpha ?? 1; // mờ dần khi vừa ra khỏi nhà
    f.sprite.setPosition(x, y - 2 - lift).setScale(CHAR_SCALE * sx, CHAR_SCALE * sy).setAngle(angle).setAlpha(alpha)
      .setDepth(10 + y / 10000 - 0.00001);
    // Bóng nằm dưới đất: bay càng cao thì bóng càng nhỏ và mờ
    const far = Math.min(1, lift / (FOLLOWER_FLY * 1.5));
    f.shadow.setPosition(x, y - 4).setScale(FOLLOWER_SHADOW[0] * (1 - far * 0.35), FOLLOWER_SHADOW[1] * (1 - far * 0.35))
      .setAlpha(SHADOW_ALPHA * (1 - far * 0.45) * alpha);
  }

  // Cỏ cao che chân Pokémon đi theo như che chân người chơi (ô đang đứng, đang bước thì cả ô vừa rời).
  // Loài bay / lơ lửng ở trên ngọn cỏ thì không bị che
  followerGrass(style) {
    const f = this.follower;
    this.followerGrassImgs ??= [0, 1].map(() => this.add.image(0, 0, 'grass-front').setOrigin(0).setScale(WORLD_SCALE).setVisible(false));
    const show = f.sprite.visible && f.pos && style !== 'fly' && style !== 'float' && !this.map.indoor;
    const cells = show ? [f.pos, f.hop?.cell].filter(Boolean) : [];
    this.followerGrassImgs.forEach((img, i) => {
      const c = cells[i];
      const ch = c ? this.map.tileAt(c.x, c.y) : null;
      const grass = ch === 'g' || ch === 'G';
      img.setVisible(grass);
      if (grass) {
        img.setTexture(ch === 'G' ? 'grass-front-deep' : 'grass-front').setPosition(c.x * CELL, c.y * CELL)
          .setDepth(10 + cellCenter(c)[1] / 10000 - 0.5e-5).setAlpha(f.alpha ?? 1);
      }
    });
  }

  async talkToFollower() {
    const mon = this.followerMon();
    const { sprite } = this.follower;
    const heart = this.add.image(sprite.x, sprite.y - sprite.displayHeight - 6, 'fx-heart').setScale(0).setDepth(HUD_DEPTH - 1);
    this.follower.cheerAt = this.time.now;
    await tweenAsync(this, { targets: heart, scale: 1, duration: 180, ease: 'Back.out' });
    // Pokémon không biết nói: chỉ kêu tiếng của loài mình
    await this.say(mon.name, [followerCry(mon.speciesId, SPECIES[mon.speciesId].name)]);
    heart.destroy();
  }

  // ---------- NPC ----------

  createNpc(def) {
    const npc = {
      def, isTrainer: Boolean(def.team), pos: { x: def.x, y: def.y }, facing: def.facing, nextMove: 0, walk: null, foot: false,
      begin: (cell) => {
        npc.facing = directionTo(npc.pos, cell);
        npc.pos = { ...cell };
      },
      setStep: (step) => (def.mon ? faceMonSprite(npc.sprite, npc.facing) : setCharFrame(npc.sprite, npc.facing, step)),
    };
    const [x, y] = cellCenter(npc.pos);
    npc.shadow = this.add.image(x, y - 2, 'fx-shadow').setScale(...SHADOW).setAlpha(SHADOW_ALPHA).setDepth(9);
    npc.sprite = def.mon
      ? this.add.sprite(x, y, this.followerTexture(def.mon, false, NPC_MON_LOGICAL), 'down').setOrigin(0.5, 1).setScale(CHAR_SCALE).setDepth(10)
      : this.add.sprite(x, y, def.sprite, 'down-stand').setOrigin(0.5, 1).setScale(CHAR_SCALE).setDepth(10);
    npc.setStep('stand');
    if (def.seated) this.seatNpc(npc);
    if (def.swim) this.swimNpc(npc);
    return npc;
  }

  // NPC bơi dưới nước (kình ngư): chỉ nhô nửa người trên mặt nước, vòng sóng gợn quanh người thay cho bóng.
  // Cắt bằng crop (giữ nguyên khi đổi khung hình) và origin (đi theo khi NPC bơi tới)
  swimNpc(npc) {
    const { sprite, shadow } = npc;
    const keep = 0.6;
    sprite.setCrop(0, 0, sprite.frame.width, sprite.frame.height * keep).setOrigin(0.5, keep);
    shadow.setTexture('fx-ring').setScale(0.5, 0.16).setAlpha(0.75).setDepth(10.5);
    this.tweens.add({ targets: shadow, scaleX: 0.62, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  // NPC ngồi trên sofa (mẹ): người lún xuống đệm, chân khuất sau mép ghế, lưng tựa sát lưng ghế; không có bóng dưới chân
  seatNpc(npc) {
    const { sprite } = npc;
    sprite.setCrop(0, 0, sprite.frame.width, sprite.frame.height - SEAT_HIDE * WORLD_SCALE);
    sprite.y += SEAT_DROP * WORLD_SCALE;
    npc.seatX = sprite.x; // giữa ô ghế; lưng tựa sát lưng ghế theo hướng ngồi (seatFace)
    npc.seatFacing = npc.facing;
    sprite.x = npc.seatX - DIRS[npc.facing].x * SEAT_BACK * WORLD_SCALE;
    npc.shadow.setVisible(false);
  }

  // Người đang ngồi quay người (vẫn ngồi): đổi hướng nhìn, lưng chỉ tựa vào lưng ghế khi nhìn đúng hướng ngồi
  seatFace(npc, facing) {
    this.face(npc, facing);
    const lean = facing === npc.seatFacing ? DIRS[facing].x * SEAT_BACK * WORLD_SCALE : 0;
    npc.sprite.x = npc.seatX - lean;
  }

  // NPC xuất hiện giữa chừng (cảnh cắt)
  spawnNpc(def) {
    const npc = this.createNpc({ wander: 0, fixed: true, map: this.map.id, ...def });
    this.npcs.push(npc);
    return npc;
  }

  removeNpc(npc) {
    const i = this.npcs.indexOf(npc);
    if (i === -1) return;
    this.npcs.splice(i, 1);
    npc.sprite.destroy();
    npc.shadow.destroy();
  }

  findNpc(id) {
    return this.npcs.find((n) => n.def.id === id) ?? null;
  }

  face(npc, facing) {
    npc.facing = facing;
    npc.setStep('stand');
  }

  faceNpcToPlayer(npc) {
    this.face(npc, directionTo(npc.pos, this.pos));
  }

  faceNpcTo(npc, other) {
    this.face(npc, directionTo(npc.pos, other.pos));
  }

  // NPC đi theo các hướng dirs (không kiểm tra vật cản: đường đi đã được tính trước)
  walkNpc(npc, dirs) {
    return this.walkCells(npc, cellsAlong(npc.pos, dirs), NPC_STEP_MS);
  }

  // Tìm đường ngắn nhất (BFS) cho NPC tới ô thoả goal, tránh người chơi, Pokémon đi theo và NPC khác.
  // Người chơi tìm đường (npc = { pos: this.pos }) thì đi xuyên qua Pokémon đi theo
  findPath(npc, goal, avoidGrass) {
    const key = (p) => `${p.x},${p.y}`;
    const isPlayer = npc.pos === this.pos;
    const blocked = (x, y) => this.isBlocked(x, y, npc) || samePos({ x, y }, this.pos) || (!isPlayer && this.followerAt(x, y))
      || this.map.info(x, y).exit || (avoidGrass && this.map.info(x, y).encounter);
    const queue = [{ ...npc.pos, path: [] }];
    const seen = new Set([key(npc.pos)]);
    while (queue.length) {
      const cur = queue.shift();
      if (goal(cur)) return cur.path;
      for (const [dir, d] of Object.entries(DIRS)) {
        const next = { x: cur.x + d.x, y: cur.y + d.y };
        if (seen.has(key(next)) || blocked(next.x, next.y)) continue;
        seen.add(key(next));
        queue.push({ ...next, path: [...cur.path, dir] });
      }
    }
    return null;
  }

  // NPC đi tới target (adjacent: chỉ cần đứng cạnh target)
  async walkNpcTo(npc, target, { adjacent = false } = {}) {
    const goal = adjacent
      ? (p) => Math.abs(p.x - target.x) + Math.abs(p.y - target.y) === 1
      : (p) => samePos(p, target);
    const path = this.findPath(npc, goal, true) ?? this.findPath(npc, goal, false) ?? [];
    await this.walkNpc(npc, path);
  }

  // NPC dẫn đường, người chơi bước theo vào đúng ô NPC vừa rời.
  // Hai bên đi cùng tốc độ và cùng lúc nên không ai phải đứng chờ ai ở mỗi ô.
  async leadPlayer(npc, target) {
    const path = this.findPath(npc, (p) => samePos(p, target), true) ?? [];
    if (!path.length) return;
    const cells = cellsAlong(npc.pos, path);
    const playerCells = [{ ...npc.pos }, ...cells.slice(0, -1)];
    await Promise.all([this.walkCells(npc, cells, NPC_STEP_MS), this.walkPlayer(playerCells, NPC_STEP_MS)]);
  }

  // Cảnh cắt: người chơi tự đi tới ô target
  async walkPlayerTo(target) {
    const path = this.findPath({ pos: this.pos }, (p) => samePos(p, target), true) ?? [];
    await this.walkPlayer(cellsAlong(this.pos, path));
  }

  // Team Rocket chuồn trong hang: ném bom khói, khói xám bung ra che cả bọn, tan đi thì đã biến mất
  async smokeEscape(npcs) {
    this.cameras.main.flash(180, 230, 230, 235);
    const puffs = [];
    for (const npc of npcs) {
      for (let i = 0; i < 4; i++) {
        const puff = this.add.circle(npc.sprite.x + Phaser.Math.Between(-10, 10) * ZOOM, npc.sprite.y - CHAR_HEIGHT / 2 + Phaser.Math.Between(-12, 12) * ZOOM,
          CELL * 0.32, 0xd0d0d8, 0.95).setDepth(npc.sprite.depth + 0.001);
        puffs.push(puff);
        this.tweens.add({ targets: puff, scale: 2.6, alpha: 0, delay: i * 90, duration: 1100, ease: 'Quad.out' });
      }
    }
    await tweenAsync(this, { targets: npcs.flatMap((n) => [n.sprite, n.shadow]), alpha: 0, delay: 150, duration: 350 });
    npcs.forEach((n) => this.removeNpc(n));
    await wait(this, 900);
    puffs.forEach((p) => p.destroy());
  }

  // Team Rocket chuồn: khinh khí cầu Meowth hạ xuống, cả nhóm lần lượt nhảy vào giỏ, khinh khí cầu chao qua chao lại
  // bay vút lên khỏi màn hình rồi loé một tia sáng
  async balloonEscape(npcs) {
    const cx = npcs.reduce((sum, n) => sum + n.sprite.x, 0) / npcs.length;
    const ground = Math.max(...npcs.map((n) => n.sprite.y));
    const top = this.cameras.main.worldView.y;
    const shadow = this.add.image(cx, ground - 2, 'fx-shadow').setScale(SHADOW[0] * 2.4, SHADOW[1] * 1.6).setAlpha(0).setDepth(9);
    const balloon = this.add.image(cx, top - 10, 'fx-balloon').setOrigin(0.5, 1).setScale(WORLD_SCALE * 1.6).setDepth(10 + ground / 10000 + 0.001);
    this.tweens.add({ targets: shadow, alpha: SHADOW_ALPHA, duration: 1400 });
    await tweenAsync(this, { targets: balloon, y: ground + CELL / 2, duration: 1400, ease: 'Sine.out' });
    // Nhảy vào giỏ: bật lên rồi rơi vào trong giỏ, khuất sau thành giỏ
    const basketTop = balloon.y - 12 * WORLD_SCALE * 1.6;
    for (const npc of npcs) {
      npc.shadow.setVisible(false);
      await tweenAsync(this, { targets: npc.sprite, x: cx + (npc.sprite.x - cx) * 0.2, y: basketTop - CELL / 2, duration: 220, ease: 'Quad.out' });
      await tweenAsync(this, { targets: npc.sprite, y: basketTop + CELL / 2, alpha: 0, duration: 160, ease: 'Quad.in' });
      this.removeNpc(npc);
    }
    await wait(this, 300);
    this.tweens.add({ targets: shadow, alpha: 0, scale: 0.2, duration: 1200 });
    this.tweens.add({ targets: balloon, x: { from: cx - CELL * 0.4, to: cx + CELL * 0.4 }, duration: 500, yoyo: true, repeat: 3, ease: 'Sine.inOut' });
    await tweenAsync(this, { targets: balloon, y: top - 40, duration: 2200, ease: 'Sine.in' });
    this.tweens.killTweensOf(balloon);
    balloon.destroy();
    shadow.destroy();
    const star = this.add.image(cx, top + 24, 'fx-glow').setScale(0).setTint(0xfff0a0).setDepth(HUD_DEPTH - 1);
    await tweenAsync(this, { targets: star, scale: 1.2, angle: 90, duration: 220, yoyo: true });
    star.destroy();
  }

  // NPC bỏ đi rồi biến mất
  // NPC rời cảnh có điểm đến thật (không đi vài bước rồi biến mất giữa đường / vào bụi cây):
  //  building: tới trước cửa toà nhà rồi đi vào • toMap: đi tới ô chuyển sang bản đồ đó (lối ra thị trấn, cửa hang) rồi khuất
  //  • nearest: một trong hai, chọn nơi gần nhất. Không tìm được đường thì đứng tại chỗ mờ dần.
  async npcLeave(npc, { building = null, toMap = null } = {}) {
    if (building) {
      const doorstep = { x: building.door.x, y: building.door.y + 1 };
      await this.walkNpcTo(npc, doorstep);
      if (samePos(npc.pos, doorstep)) {
        await this.npcEntersDoor(npc, building);
        return;
      }
    } else if (toMap) {
      const exits = this.map.warps.filter((w) => w.to === toMap);
      const goal = (p) => exits.some((w) => w.x === p.x && w.y === p.y);
      const path = exits.length ? this.findPath(npc, goal, true) ?? this.findPath(npc, goal, false) : null;
      if (path) await this.walkNpc(npc, path);
    }
    await tweenAsync(this, { targets: [npc.sprite, npc.shadow], alpha: 0, duration: 300 });
    this.removeNpc(npc);
  }

  // Pokémon hoang dã (NPC là Pokémon) bay vụt lên trời rồi mất hút
  async npcFlyAway(npc) {
    await tweenAsync(this, { targets: npc.sprite, y: npc.sprite.y - CELL * 5, alpha: 0, duration: 650, ease: 'Quad.in' });
    this.removeNpc(npc);
  }

  async walkNpcAway(npc, dir, steps) {
    const cells = [];
    let p = npc.pos;
    for (let i = 0; i < steps; i++) {
      const next = { x: p.x + DIRS[dir].x, y: p.y + DIRS[dir].y };
      if (this.isBlocked(next.x, next.y, npc) || samePos(next, this.pos) || this.followerAt(next.x, next.y)) break;
      cells.push((p = next));
    }
    await this.walkCells(npc, cells, NPC_STEP_MS);
    await tweenAsync(this, { targets: [npc.sprite, npc.shadow], alpha: 0, duration: 300 });
    this.removeNpc(npc);
  }

  // Dân làng đi lang thang quanh chỗ cũ; trainer và người đứng quầy thì đứng yên
  updateNpc(npc, time) {
    if (npc.isTrainer || npc.def.fixed || npc.def.wander === undefined || npc.walk || time < npc.nextMove) return;
    npc.nextMove = time + Phaser.Math.Between(1400, 3600);
    const dir = Phaser.Utils.Array.GetRandom(Object.keys(DIRS));
    const next = { x: npc.pos.x + DIRS[dir].x, y: npc.pos.y + DIRS[dir].y };
    const far = Math.abs(next.x - npc.def.x) > npc.def.wander || Math.abs(next.y - npc.def.y) > npc.def.wander;
    const playerThere = samePos(next, this.pos) || this.moving;
    const info = this.map.info(next.x, next.y);
    if (far || playerThere || this.followerAt(next.x, next.y) || this.isBlocked(next.x, next.y, npc) || info.encounter || info.exit) {
      this.face(npc, dir);
      return;
    }
    this.walkNpc(npc, [dir]);
  }

  // Trainer chưa bị đánh bại nhìn thấy người chơi (chỉ khi người chơi đã có Pokémon)
  spottingTrainer() {
    if (!state.party.length) return null;
    return this.npcs.find((t) => {
      if (!t.isTrainer || !t.def.sight || !trainerReady(t.def) || state.defeatedTrainers.has(t.def.id)) return false;
      const d = DIRS[t.facing];
      for (let i = 1; i <= t.def.sight; i++) {
        const x = t.pos.x + d.x * i;
        const y = t.pos.y + d.y * i;
        if (x === this.pos.x && y === this.pos.y) return true;
        // Kình ngư nhìn qua mặt nước (nước là ô cản với người đi bộ)
        const blocked = t.def.swim && this.isWater(x, y) ? Boolean(this.npcAt(x, y, t)) : this.isBlocked(x, y, t);
        if (blocked) return false;
      }
      return false;
    }) ?? null;
  }

  // spotted: trainer nhìn thấy người chơi thì hiện dấu "!" rồi đi tới trước mặt
  async trainerBattle(trainer, spotted) {
    if (spotted) {
      const alert = this.add.image(trainer.sprite.x, trainer.sprite.y - CHAR_HEIGHT - 2, 'fx-alert').setOrigin(0.5, 1).setScale(0).setDepth(HUD_DEPTH - 1);
      await tweenAsync(this, { targets: alert, scale: 1, duration: 180, ease: 'Back.out' });
      await wait(this, 500);
      alert.destroy();
      // Trainer đi thẳng tới trước mặt người chơi
      const d = DIRS[trainer.facing];
      const cells = [];
      let p = trainer.pos;
      while (Math.abs(p.x - this.pos.x) + Math.abs(p.y - this.pos.y) > 1) {
        p = { x: p.x + d.x, y: p.y + d.y };
        if (this.followerAt(p.x, p.y)) break;
        cells.push(p);
      }
      await this.walkCells(trainer, cells, NPC_STEP_MS);
      this.facePlayerTo(trainer);
    }
    await this.say(trainer.def.name, [trainer.def.intro]);
    // Đấu lại (đã từng thua người chơi): đội hình mạnh lên theo người chơi
    const def = state.defeatedTrainers.has(trainer.def.id) ? rematchDef(trainer.def) : trainer.def;
    const result = await this.startBattle({ trainer: def, persist: true });
    if (result === 'win' && trainer.def.onDefeat) await trainer.def.onDefeat(this, trainer);
  }

  // ---------- Hội thoại ----------

  async say(speaker, lines) {
    this.msg.container.setVisible(true);
    this.speakerTag.setText(speaker ?? '').setVisible(Boolean(speaker));
    for (const line of lines) await this.msg.show(line);
    this.msg.container.setVisible(false);
    this.speakerTag.setVisible(false);
  }

  // Hỏi Có / Không. safe: hành động không hoàn tác được (thả Pokémon, rời game) thì con trỏ mặc định ở "Không"
  async ask(question, speaker = null, { safe = false } = {}) {
    this.msg.container.setVisible(true);
    this.speakerTag.setText(speaker ?? '').setVisible(Boolean(speaker));
    this.msg.setText(question);
    const answer = await new Menu(this, this.router, {
      x: 760, y: 392, width: 180, height: 140, fixed: true, depth: HUD_DEPTH + 20, index: safe ? 1 : 0,
      items: [{ label: 'Có', value: true }, { label: 'Không', value: false }],
    }).open();
    this.msg.container.setVisible(false);
    this.speakerTag.setVisible(false);
    return answer === true;
  }

  // Nhận vật phẩm: biểu tượng bay lên trên đầu + thông báo
  async giveItem(id, qty = 1, verb = 'nhận được') {
    addItem(id, qty);
    const icon = this.add.image(this.player.x, this.playerTop() - 10, ITEMS[id].icon).setScale(0).setDepth(HUD_DEPTH - 1);
    this.tweens.add({ targets: icon, scale: fitScale(this, ITEMS[id].icon, 40), y: icon.y - 30, duration: 300, ease: 'Back.out' });
    await this.say(null, [`Bạn ${verb} ${qty > 1 ? `${qty} ` : ''}${ITEMS[id].name}!`]);
    icon.destroy();
  }

  // Nhận vật phẩm quan trọng không nằm trong túi (Pokédex): biểu tượng tròn giống nút ở cột nút bên trái bay lên trên đầu
  async showKeyGift(type, text) {
    const g = this.add.graphics().setDepth(HUD_DEPTH - 1);
    drawRoundIcon(g, type, 0, 0);
    g.setPosition(this.player.x, this.playerTop() - 10).setScale(0);
    this.tweens.add({ targets: g, scale: 1, y: g.y - 34, duration: 300, ease: 'Back.out' });
    await this.say(null, [text]);
    g.destroy();
  }

  // Màn hình tối đi rồi sáng lại, cả đội được hồi phục
  async fadeHeal() {
    const cam = this.cameras.main;
    await new Promise((resolve) => {
      cam.once('camerafadeoutcomplete', resolve);
      cam.fadeOut(300);
    });
    healParty();
    this.refreshFollower();
    await wait(this, 300);
    cam.fadeIn(300);
    await wait(this, 300);
  }

  interact() {
    if (this.busy || this.moving || this.partyMenu) return;
    const d = DIRS[this.facing];
    const target = { x: this.pos.x + d.x, y: this.pos.y + d.y };
    if (this.followerAt(target.x, target.y)) {
      this.runEvent(() => this.talkToFollower());
      return;
    }
    const sign = this.map.signAt(target.x, target.y);
    if (sign) {
      this.runEvent(() => this.say(null, sign));
      return;
    }
    if (this.map.indoor && this.map.tileAt(target.x, target.y) === 'P') {
      this.runEvent(() => this.openPC());
      return;
    }
    const obj = this.map.objectAt(target.x, target.y);
    if (obj && objectVisible(obj) && !WALKABLE_OBJECTS.includes(obj.kind)) {
      if (obj.kind === 'gate' && obj.look === 'seal') this.runEvent(() => this.say(null, ['Màn phong ấn tím chắn ngang cửa. Phải thắng người giữ phòng này mới qua được.']));
      else if (obj.kind === 'gate') this.runEvent(() => this.say(null, [this.map.gateLine ?? 'Cổng tre đóng chặt. Hình như có công tắc ở đâu đó.']));
      else if (obj.kind === 'barrier') this.runEvent(() => this.say(null, [this.map.barrierLine ?? 'Hàng rào điện kêu rè rè... Không đi qua được.']));
      else if (obj.kind === 'lantern') this.runEvent(() => this.lightLantern(obj));
      // Cây quả mọng: hái luôn kể cả đang đi xe đạp / cưỡi thú (không phải xuống)
      else this.runEvent(() => (obj.kind === 'berry' ? this.pickBerryTree(obj) : useObject(this, obj)));
      return;
    }
    if (this.isWater(target.x, target.y) && !this.onWater()) {
      this.runEvent(() => this.trySurf(target));
      return;
    }
    // Nói chuyện được qua quầy / bàn: người đứng sau cách 2 ô
    const across = this.map.info(target.x, target.y).counter;
    const npc = this.npcAt(target.x, target.y) ?? (across ? this.npcAt(target.x + d.x, target.y + d.y) : null);
    if (npc) this.talkTo(npc);
  }

  // Bắt chuyện: NPC nào cũng quay về phía người chơi (đứng phía nào thì quay phía đó, kể cả nói qua quầy; người đang ngồi
  // thì quay người nhưng vẫn ngồi, nói xong quay lại tư thế cũ).
  // NPC đang đi dở bước thì đi nốt rồi mới quay; có xoay người thì khựng lại một nhịp rồi mới nói
  async turnToPlayer(npc) {
    if (npc.walk) {
      await new Promise((resolve) => {
        const done = npc.walk.resolve;
        npc.walk.resolve = () => {
          done();
          resolve();
        };
      });
    }
    const facing = directionTo(npc.pos, this.pos);
    if (facing === npc.facing) return;
    if (npc.def.seated) this.seatFace(npc, facing);
    else this.face(npc, facing);
    await wait(this, 110);
  }

  talkTo(npc) {
    const { def } = npc;
    if (npc.isTrainer && state.party.length && trainerReady(def) && !state.defeatedTrainers.has(def.id)) {
      this.runEvent(async () => {
        await this.turnToPlayer(npc);
        await this.trainerBattle(npc, false);
      });
      return;
    }
    if (def.role === 'clerk') {
      this.runEvent(async () => {
        await this.turnToPlayer(npc);
        if (await clerkTalk(this)) return;
        await this.say(def.name, [def.stock ? 'Xin chào! Chào mừng quý khách đến với Trung tâm thương mại!' : 'Xin chào! Chào mừng quý khách đến với Poké Mart!']);
        this.fromMart = true;
        this.scene.launch('Mart', { tier: MAPS[this.map.exit?.to]?.martTier ?? 0, stock: def.stock });
        this.scene.pause();
        await new Promise((resolve) => {
          this.martClosed = resolve;
        });
      });
      return;
    }
    this.runEvent(async () => {
      npc.nextMove = this.time.now + 3000;
      await this.turnToPlayer(npc);
      if (def.onTalk) {
        await def.onTalk(this, npc);
        // Người đang ngồi nói xong thì quay lại tư thế ngồi cũ (nhìn vào bàn)
        if (def.seated && npc.sprite.active) this.seatFace(npc, npc.seatFacing);
      } else if (def.role === 'nurse') {
        await this.nurseHeal(npc);
      } else if (npc.isTrainer && !state.party.length) {
        await this.say(def.name, ['Không có Pokémon thì đấu sao được!']);
      } else if (npc.isTrainer && !state.defeatedTrainers.has(def.id)) {
        // Trận trước bị gián đoạn (tính là bạn thua): nghỉ vài ngày mới đấu
        await this.say(def.name, ['Hôm nay mình không muốn đấu nữa đâu. Vài hôm nữa quay lại nhé!']);
      } else if (npc.isTrainer) {
        await this.say(def.name, [def.after]);
        // Nghỉ đủ 3-4 ngày: hỏi có muốn đấu lại không
        if (trainerReady(def) && (await this.ask(`Đấu lại với ${def.name}?`))) await this.trainerBattle(npc, false);
      } else {
        await this.say(def.name, def.lines);
      }
    });
  }

  // ---------- Máy tính lưu trữ Pokémon (PC) ----------

  // Bật máy là vào thẳng Hộp Pokémon (ui/PcBox.js): lưới hộp + cột đội hình, kéo thả để gửi / rút / đổi chỗ,
  // kéo vào thùng rác để thả (hỏi lại, mặc định "Không")
  async openPC() {
    await new PcBox(this, this.router, {
      depth: HUD_DEPTH + 2,
      ask: (question) => this.ask(question, null, { safe: true }),
      say: (lines) => this.say(null, lines),
      onChange: () => this.refreshFollower(),
    }).open();
    this.refreshFollower();
    this.save();
  }

  // Danh sách Pokémon dạng thẻ (cuộn được khi dài), trả về vị trí đã chọn hoặc null
  pickMon(title, list, index = 0) {
    const rows = Math.min(list.length, 6);
    return new Menu(this, this.router, {
      x: 130, y: 24, width: 700, height: 84 + rows * 76, title, rowHeight: 70, visibleRows: 6, index,
      items: list.map((mon, i) => ({ mon, value: i })),
      fixed: true, depth: HUD_DEPTH + 11,
    }).open();
  }

  // ---------- Pokémon Center ----------

  async nurseHeal(joy) {
    const name = joy.def.name;
    await this.say(name, ['Chào mừng đến Pokémon Center!', 'Chúng tôi sẽ hồi phục Pokémon của bạn về trạng thái khỏe mạnh nhất.']);
    if (!state.party.length) {
      await this.say(name, ['Ồ, bạn chưa có Pokémon nào cả. Hẹn gặp lại bạn sau nhé!']);
      return;
    }
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
      await tweenAsync(this, { targets: ball, scale: 0.17 * ZOOM, duration: 160, ease: 'Back.out' });
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
    this.refreshFollower();
    await wait(this, 300);
    screen.destroy();
    balls.forEach((b) => b.destroy());
    panel.destroy();

    this.face(joy, 'down');
    await this.say(name, ['Cảm ơn bạn đã chờ đợi!', 'Pokémon của bạn đã hồi phục hoàn toàn.']);
    await tweenAsync(this, { targets: joy.sprite, scaleY: CHAR_SCALE * 0.9, duration: 160, yoyo: true });
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

  // Bảng hồi phục (góc trái, không che máy hồi phục): thanh HP của cả đội đầy dần
  showHealPanel() {
    const party = state.party;
    const x = 20;
    const y = 30;
    const w = 400;
    const rowH = 58;
    const { add, destroy } = this.overlayLayer(HUD_DEPTH + 8);
    add(drawPanel(this, x, y, w, 76 + party.length * rowH));
    add(this.add.text(x + 28, y + 22, 'Đang hồi phục...', textStyle(22, '#3a4660', { fontStyle: 'bold' })));
    const bars = add(this.add.graphics());
    const start = party.map((m) => m.hp);
    const hpTexts = party.map((mon, i) => {
      const ry = y + 70 + i * rowH;
      const key = pixelMon(this, mon.speciesId, '', 22);
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
      destroy,
    };
  }

  // ---------- Cốt truyện ----------

  // Xem Pokémon khởi đầu trên bàn rồi hỏi có chọn không
  async previewStarter(speciesId) {
    const sp = SPECIES[speciesId];
    const { add, destroy } = this.overlayLayer(HUD_DEPTH + 8);
    add(drawPanel(this, 290, 40, 380, 440, 18, true));
    const glow = add(this.add.graphics());
    glow.fillStyle(TYPES[sp.types[0]].color, 0.2);
    glow.fillCircle(480, 190, 110);
    const key = pixelMon(this, speciesId);
    add(this.add.image(480, 300, key).setOrigin(0.5, 1).setScale(fitScale(this, key, 192)));
    add(this.add.text(480, 314, sp.name, textStyle(34, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5, 0));
    typeBadges(this, 480, 384, sp.types, { align: 'center' }).forEach(add);
    add(this.add.text(480, 412, sp.desc ?? '', textStyle(18, '#4a5266', { align: 'center', wordWrap: { width: 330 } })).setOrigin(0.5, 0));
    const types = sp.types.map((t) => TYPES[t].name).join('/');
    const ok = await this.ask(`Bạn chọn ${sp.name}, Pokémon hệ ${types}?`);
    destroy();
    return ok;
  }

  // ---------- Poké Mart ----------

  onResume() {
    this.resetHeldKeys();
    this.refreshFollower();
    if (this.returnToParty != null) {
      const index = this.returnToParty;
      this.returnToParty = null;
      this.time.delayedCall(0, () => this.toggleParty(index));
    }
    if (this.fromMart) {
      this.fromMart = false;
      this.martClosed?.();
      this.martClosed = null;
    }
  }

  // ---------- Trận đấu ----------

  // data: { trainer } hoặc { enemy, zone: nền trận đấu 'meadow' | 'deep' | 'water' | 'cave' | 'caveWater' }
  // Trả về kết quả trận đấu: 'win' | 'lose' | 'run' | 'catch'
  // persist: lưu game lúc vào trận và sau mỗi lượt (trận gặp Pokémon hoang dã, trainer bình thường). Trận nằm giữa
  // cảnh cắt cốt truyện thì không: tắt game giữa chừng thì tải lại từ trước cảnh cắt, xem lại từ đầu
  startBattle(data) {
    this.battleTrainer = data.trainer ?? null;
    if (data.persist) {
      state.pendingBattle = data.trainer
        ? { trainer: data.trainer.id, name: data.trainer.name, forfeit: forfeitable(data.trainer) }
        : { wild: true };
      this.save();
    }
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
        // Đánh ngoài trời thì trận đấu cũng tối / mưa theo bản đồ
        // weather: thời tiết đang có ở bản đồ (theo vùng khí hậu), mang vào trận đấu kể cả khi tắt hiệu ứng hình ảnh
        this.scene.launch('Battle', { ...data, ambience: this.ambience.state.outdoor, weather: mapWeather(this.map) });
        this.scene.sleep();
      },
    });
    return new Promise((resolve) => {
      this.battleDone = resolve;
    });
  }

  async onWake(data) {
    this.resetHeldKeys();
    this.transition?.destroy();
    this.transition = null;
    const persisted = Boolean(state.pendingBattle);
    state.pendingBattle = null;
    if (data?.result === 'win' && this.battleTrainer) trainerBeaten(this.battleTrainer);
    this.refreshFollower();
    if (data?.result === 'lose' && !data.noBlackout) {
      await this.blackout();
      if (persisted) this.save();
    } else {
      // Trận thường kết thúc thì lưu ngay, đóng tab lúc nhận thưởng / tiến hoá không mất kết quả.
      // Trainer có onDefeat (thủ lĩnh, Liên minh...) thì đợi onDefeat xong (cuối sự kiện) mới lưu, không thì có thể kẹt cốt truyện
      if (persisted && !this.battleTrainer?.onDefeat) this.save();
      this.cameras.main.fadeIn(350);
      await wait(this, 350);
      await this.checkEvolutions(data?.leveled ?? []);
      // Kết quả trận đã lưu trước khi tiến hoá: lưu lại để đóng tab ngay sau đó không mất lần tiến hoá
      if (data?.persist && data.leveled?.length && !this.battleTrainer?.onDefeat) this.save();
    }
    const done = this.battleDone;
    this.battleDone = null;
    done?.(data?.result);
  }

  // Cả đội gục: tỉnh dậy ở Pokémon Center đã vào gần nhất (chưa vào lần nào thì ở nhà, trước mặt mẹ).
  // Tiền bị mất và đội được hồi phục đã tính trong trận (BattleScene)
  async blackout() {
    if (this.map.place === 'league') resetLeague();
    const spot = state.lastCenter ?? HOME_RESPAWN;
    this.loadMap(spot.map, spot, spot.facing);
    this.cameras.main.fadeIn(500);
    await wait(this, 500);
    await this.say(spot.healer, spot.map === HOME_RESPAWN.map
      ? ['Con về rồi à? Trông con mệt lả rồi kìa.', 'Mẹ đã cho Pokémon của con nghỉ ngơi rồi. Lần sau cẩn thận nhé!']
      : ['Chúng tôi đã hồi phục Pokémon của bạn rồi.', 'Lần sau hãy cẩn thận hơn nhé!']);
  }

  // Tải game mà lần trước tắt giữa trận: Pokémon giữ nguyên máu / PP / trạng thái lúc đó, người chơi đứng tại chỗ.
  // Gặp Pokémon hoang dã thì coi như đã chạy thoát; trainer thường thì tính là thua (vài ngày sau mới đấu lại được);
  // thủ lĩnh gym, Liên minh, nhân vật cốt truyện thì đấu lại được ngay. Cả đội đã gục thì như thua trận
  async resumeInterruptedBattle() {
    const battle = state.pendingBattle;
    state.pendingBattle = null;
    for (const mon of state.party) clearBattleState(mon);
    this.refreshFollower();
    await wait(this, 500);
    if (!state.party.some((m) => m.hp > 0)) {
      const lost = blackoutLoss(state.money);
      state.money -= lost;
      healParty();
      await this.say(null, ['Trận đấu lần trước bị gián đoạn khi cả đội đã kiệt sức...', ...(lost ? [`Bạn đánh rơi ${formatMoney(lost)}.`] : [])]);
      await this.blackout();
      return;
    }
    if (battle.wild) {
      await this.say(null, ['Trận đấu lần trước bị gián đoạn.', 'Bạn đã chạy thoát an toàn!']);
    } else if (battle.forfeit) {
      trainerForfeit(battle.trainer);
      await this.say(null, [`Trận đấu với ${battle.name} bị gián đoạn nên tính là bạn thua.`, `Vài ngày nữa ${battle.name} mới đấu lại với bạn.`]);
    } else {
      await this.say(null, [`Trận đấu với ${battle.name} bị gián đoạn.`, 'Bạn có thể thách đấu lại bất cứ lúc nào.']);
    }
    // Lên cấp trong trận trước khi bị gián đoạn: đủ cấp thì tiến hoá luôn
    await this.checkEvolutions(battle.leveled ?? []);
  }

  // ---------- Tiến hoá ----------

  // Pokémon vừa lên cấp trong trận (còn chiến đấu được) đủ điều kiện thì tiến hoá
  async checkEvolutions(uids) {
    for (const mon of state.party) {
      if (!uids.includes(mon.uid) || mon.hp <= 0) continue;
      const to = evolutionTarget(mon);
      if (to) await this.evolutionScene(mon, to, true);
    }
  }

  // Màn tiến hoá: hình cũ và mới nhấp nháy xen kẽ, nhanh dần. cancelable: bấm Esc để ngừng (tiến hoá theo cấp)
  async evolutionScene(mon, to, cancelable) {
    this.overlay = true;
    const { width, height } = this.scale;
    const depth = HUD_DEPTH + 3;
    const { objs, add, destroy } = this.overlayLayer(depth);
    const dim = add(this.add.rectangle(width / 2, height / 2, width, height, 0x0a0e1a, 1)).setAlpha(0);
    await tweenAsync(this, { targets: dim, alpha: 0.94, duration: 400 });
    const glow = add(this.add.image(width / 2, 300, 'fx-glow').setScale(5).setAlpha(0.35));
    const oldKey = pixelMon(this, mon.speciesId, '', GBA_MON, mon.shiny);
    const newKey = pixelMon(this, to, '', GBA_MON, mon.shiny);
    const sprite = add(this.add.image(width / 2, 300, oldKey).setScale(fitScale(this, oldKey, GBA_MON * 3)));
    await this.say(null, [`Ồ? ${mon.name} đang tiến hoá!`]);

    // Hình trắng đổi qua lại giữa dạng cũ và dạng mới, mỗi lần nhanh hơn
    let cancelled = false;
    if (cancelable) this.router.set((e) => { if (isCancel(e)) cancelled = true; });
    sprite.setTintFill(0xffffff);
    this.tweens.add({ targets: glow, scale: 7, alpha: 0.6, duration: 600, yoyo: true, repeat: -1 });
    for (let i = 0; i < 14 && !cancelled; i++) {
      const key = i % 2 ? oldKey : newKey;
      sprite.setTexture(key);
      const s = fitScale(this, key, 200);
      await tweenAsync(this, { targets: sprite, scale: { from: s * 0.75, to: s }, duration: Math.max(90, 420 - i * 26) });
    }
    this.router.clear();
    this.tweens.killTweensOf(glow);

    if (cancelled) {
      sprite.setTexture(oldKey).setScale(fitScale(this, oldKey, 200)).clearTint();
      await this.say(null, [`${mon.name} đã ngừng tiến hoá.`]);
    } else {
      this.cameras.main.flash(400, 255, 255, 255);
      sprite.setTexture(newKey).setScale(fitScale(this, newKey, 200)).clearTint();
      const oldName = mon.name;
      const events = evolve(mon, to);
      await wait(this, 500);
      await this.say(null, [`Chúc mừng! ${oldName} đã tiến hoá thành ${SPECIES[to].name}!`]);
      for (const ev of events) {
        if (ev.type === 'learn') await this.say(null, [`${mon.name} đã học được chiêu ${MOVES[ev.move].name}!`]);
        else if (ev.type === 'cantLearn') await this.forgetToLearn(mon, ev.move);
      }
    }
    await tweenAsync(this, { targets: objs, alpha: 0, duration: 300 });
    destroy();
    this.overlay = false;
    this.refreshFollower();
    return !cancelled;
  }

  // ---------- Menu ----------

  // focus: số Pokédex của loài cần mở (bấm từ bảng khu vực)
  openPokedex(focus = null) {
    if (this.busy || this.moving || this.partyMenu) return;
    if (!hasPokedex()) {
      this.runEvent(() => this.say(null, ['Bạn chưa có Pokédex.']));
      return;
    }
    this.setFrame('stand');
    // Luôn truyền data: launch không data thì Phaser dùng lại data lần trước (mở lại đúng loài đã xem từ bảng khu vực)
    this.scene.launch('Pokedex', { focus: focus ?? null });
    this.scene.pause();
  }

  // Menu cài đặt: bản đồ vùng, phím tắt, ánh sáng... (game luôn tự động lưu). Đóng bằng ✕, phím quay lại / cài đặt,
  // hoặc bấm ra ngoài khung
  async toggleSettings() {
    if (this.settingsMenu) {
      this.settingsMenu.finish(null);
      return;
    }
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    this.busy = true;
    this.setFrame('stand');
    let index = 0;
    for (;;) {
      // Giá trị bật / tắt nằm riêng ở cột phải (sub) để chữ không tràn khung. Bản đồ vùng nằm trong Cài đặt
      const onOff = (on) => (on ? 'Bật' : 'Tắt');
      const items = [
        ...(itemCount('townMap') ? [{ label: 'Bản đồ vùng', value: 'map' }] : []),
        { label: 'Phím tắt', value: 'keys' },
        { label: 'Ánh sáng & thời tiết', sub: onOff(settings.ambience), value: 'ambience' },
        { label: 'Xem nhanh khi gửi vào PC', sub: onOff(settings.catchPreview), value: 'catchPreview' },
        { label: 'Đổi diện mạo', value: 'look' },
        // Bản 2D (index.html có nút sang bản 3D): chuyển sang bản 3D, chơi tiếp từ bản lưu
        ...(document.getElementById('link3d') ? [{ label: 'Chơi bản thử 3D', value: '3d' }] : []),
      ].map((item) => ({ ...item, fontSize: 22 }));
      // Khung cao theo số mục, căn giữa màn hình
      const rowHeight = 50;
      const height = 84 + items.length * (rowHeight + 6);
      const top = Math.max(16, Math.round((this.scale.height - height) / 2));
      this.settingsMenu = new Menu(this, this.router, {
        x: 220, y: top, width: 520, height, title: 'Cài đặt', items, index, rowHeight, fixed: true, depth: HUD_DEPTH + 10,
      });
      const choice = await this.settingsMenu.open();
      this.settingsMenu = null;
      index = Math.max(0, items.findIndex((i) => i.value === choice));

      if (choice === 'map') {
        // Đóng Cài đặt rồi mới mở (màn này cần lúc không bận)
        this.busy = false;
        this.openRegionMap();
        return;
      } else if (choice === 'keys') {
        // Đổi phím: đóng thì quay lại Cài đặt (nhãn phím trên ô phím tắt tự vẽ lại theo phím mới)
        await new KeyBindings(this, this.router, { depth: HUD_DEPTH + 20 }).open();
      } else if (choice === 'ambience') {
        setSetting('ambience', !settings.ambience);
        this.ambience.refresh(true);
      } else if (choice === 'catchPreview') {
        setSetting('catchPreview', !settings.catchPreview);
      } else if (choice === 'look') {
        // currentLook: bản lưu cũ chưa có diện mạo thì là diện mạo cũ (mũ lưỡi trai đỏ / nón rộng vành)
        const { gender, ...look } = currentLook(state.player);
        const picked = await new CharacterCreator(this, this.router, {
          gender, look, depth: HUD_DEPTH + 20, fixed: true, title: 'Đổi diện mạo', okLabel: 'Xong',
        }).open();
        if (picked) {
          const { gender: newGender, ...newLook } = picked;
          state.player.gender = newGender;
          state.player.look = newLook;
          applyPlayerLook(this, state.player); // vẽ lại texture tại chỗ
          // Đổi giới tính thì key texture đổi ('player' <-> 'player-f', kể cả '-bike'): gắn lại texture theo hướng đang nhìn
          this.player.setTexture(this.playerTexture(this.vehicle === 'bike'));
          this.setFrame('stand');
          this.save();
        }
      } else if (choice === '3d') {
        if (await this.ask('Lưu game và chuyển sang bản thử 3D?', null, { safe: true })) {
          this.save();
          window.location.href = document.getElementById('link3d').href;
          return;
        }
      } else {
        break;
      }
    }
    this.busy = false;
  }

  // Mở bảng Đội hình (index: dòng đặt con trỏ). Bấm / Enter vào một Pokémon là mở màn chi tiết (cho cầm đồ ở đó),
  // đóng màn chi tiết thì bảng mở lại ở đúng con đang xem. Kéo thả một Pokémon lên Pokémon khác (chuột / cảm ứng)
  // là đổi chỗ hai con, bảng mở lại ở chỗ mới
  async toggleParty(index = 0) {
    if (this.partyMenu) {
      this.partyMenu.finish(null);
      return;
    }
    if (this.busy || this.moving) return;
    if (!state.party.length) {
      this.runEvent(() => this.say(null, ['Bạn chưa có Pokémon nào.']));
      return;
    }
    this.setFrame('stand');
    const items = state.party.map((mon, i) => ({ mon, value: i }));
    this.partyMenu = new Menu(this, this.router, {
      x: 130, y: 30, width: 700, height: 86 + items.length * 76,
      title: 'Đội hình',
      titleRight: `Tiền: ${formatMoney(state.money)}`,
      rowHeight: 70,
      items,
      index,
      fixed: true,
      depth: HUD_DEPTH + 10,
      drag: state.party.length > 1 ? { reorder: true } : null,
    });
    const picked = await this.partyMenu.open();
    this.partyMenu = null;
    if (picked === null) return;
    if (picked.reorder) {
      const [from, to] = picked.reorder;
      swapParty(from, to);
      this.refreshFollower();
      this.save();
      this.toggleParty(to);
      return;
    }
    this.returnToParty = picked;
    this.openSummary(picked);
  }

  async giveHeld(mon, id) {
    const old = mon.heldItem;
    const problem = giveHeldItem(mon, id);
    if (problem) {
      await this.say(null, [problem]);
      return;
    }
    await this.say(null, [
      ...(old ? [`Đã cất ${ITEMS[old].name} vào túi.`] : []),
      `${mon.name} đang cầm ${ITEMS[id].name}.`,
    ]);
  }

  // Màn hình chi tiết Pokémon (IV, EV, tính cách, đặc tính, chiêu)
  openSummary(index) {
    this.setFrame('stand');
    this.scene.launch('Summary', { index });
    this.scene.pause();
  }

  // ---------- Túi đồ ----------

  openBag() {
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    this.runEvent(() => this.bagLoop());
  }

  // Túi đồ chia ngăn (tab: Hồi phục / Bóng / Quả mọng / Vật phẩm / Quan trọng), cuộn bằng con lăn chuột; đổi ngăn bằng
  // bấm tab hoặc ← →. Mô tả vật phẩm chỉ hiện khi rê chuột / di phím tới vật phẩm đó. Chọn vật phẩm -> bảng thao tác
  // (Dùng / Cho cầm / Gán phím tắt) -> dùng (chọn Pokémon, chọn chiêu...). Lặp tới khi đóng túi.
  // Thanh phím tắt dưới đáy vẫn hiện: kéo icon vật phẩm thả vào ô để gán (hoặc bấm phím 1-6).
  // assignSlot: mở từ ô phím tắt còn trống, chọn vật phẩm là gán luôn vào ô đó rồi đóng túi
  async bagLoop({ assignSlot = null } = {}) {
    this.bagOpen = true;
    try {
      await this.bagScreens(assignSlot);
    } finally {
      this.bagOpen = false;
      this.hotbar.highlight(-1);
    }
  }

  // Túi đồ dạng khung bên phải (ui/BagPanel.js): dải tab ngăn bên trái, ô tìm kiếm (gõ phím là tìm), lưới 2 cột, mô tả bên trái khung.
  // Chọn vật phẩm -> bảng thao tác (Dùng / Cho cầm / Gán phím tắt). Kéo icon thả vào thanh phím tắt hoặc bấm 1-6 để gán.
  // assignSlot: mở từ ô phím tắt còn trống, chọn vật phẩm là gán luôn vào ô đó rồi đóng túi
  async bagScreens(assignSlot) {
    // Nhớ ngăn / chữ tìm / vị trí con trỏ giữa các lần mở túi
    this.bagMemory ??= { pocket: this.bagPocket ?? 0 };
    for (;;) {
      if (!Object.keys(ITEMS).some((id) => itemCount(id) > 0)) {
        await this.say(null, ['Túi đồ trống trơn!']);
        return;
      }
      const id = await new BagPanel(this, this.router, {
        x: 436, y: 16, width: 508, height: 620, depth: HUD_DEPTH + 10, fixed: true, tipSide: 'left',
        memory: this.bagMemory,
        title: assignSlot === null ? null : `Chọn đồ cho ô ${assignSlot + 1}`,
        hotbar: this.hotbar,
        hotkey: hotbarSlotOf,
        onAssign: (slot, item) => {
          this.hud.showSaveNote(setHotbarSlot(slot, item));
          this.hotbar.flash(slot);
        },
      }).open();
      if (!id) return;
      if (assignSlot !== null) {
        await this.say(null, [setHotbarSlot(assignSlot, id)]);
        return;
      }
      // Cần câu, xe đạp, thú cưỡi: bấm vào là dùng luôn, không hiện bảng thao tác (gán phím tắt bằng kéo thả / phím 1-6)
      if (DIRECT_USE(id)) {
        const close = await this.useBagItem(id);
        this.save();
        if (close) return;
        continue;
      }
      const action = await this.itemAction(id);
      if (action === 'hotbar') await this.pickHotbarSlot(id);
      else if (action === 'give') await this.giveFromBag(id);
      else if (action === 'use') {
        const close = await this.useBagItem(id);
        this.save();
        if (close) return;
      }
    }
  }

  // Bảng thao tác với một vật phẩm trong túi (như game gốc: Dùng / Cho cầm / Đăng ký phím tắt)
  itemAction(id) {
    const item = ITEMS[id];
    // Đồ chỉ để cầm (Leftovers, đồ tăng sức mạnh theo hệ...) không có "Dùng"
    const items = [
      ...(item.kind === 'held' ? [] : [{ label: 'Dùng', value: 'use' }]),
      ...(canHold(id) && state.party.length ? [{ label: 'Cho cầm', value: 'give' }] : []),
      { label: state.hotbar.includes(id) ? `Phím tắt (ô ${state.hotbar.indexOf(id) + 1})` : 'Gán phím tắt', value: 'hotbar' },
      { label: 'Thôi', value: null },
    ];
    this.msg.container.setVisible(true);
    this.speakerTag.setVisible(false);
    this.msg.setText(`${item.name}: làm gì?`);
    return new Menu(this, this.router, {
      x: 640, y: 150, width: 300, height: 60 + items.length * 56, title: item.name, rowHeight: 50, items,
      fixed: true, depth: HUD_DEPTH + 12,
    }).open().then((v) => {
      this.msg.container.setVisible(false);
      return v;
    });
  }

  // Chọn ô phím tắt (1-6) cho vật phẩm: mỗi dòng là một ô, kèm món đang gán ở ô đó
  async pickHotbarSlot(id) {
    const items = state.hotbar.map((cur, i) => ({
      label: `Ô ${i + 1}`,
      sub: cur ? (cur === id ? 'đang gán' : ITEMS[cur].name) : '(trống)',
      icon: cur ? ITEMS[cur].icon : null,
      value: i,
      fontSize: 23,
    }));
    const empty = state.hotbar.indexOf(null);
    const slot = await new Menu(this, this.router, {
      x: 250, y: 24, width: 460, height: 82 + items.length * 56, title: `Gán ${ITEMS[id].name} vào ô nào?`, rowHeight: 50, items,
      index: Math.max(0, state.hotbar.indexOf(id) >= 0 ? state.hotbar.indexOf(id) : empty), fixed: true, depth: HUD_DEPTH + 12,
    }).open();
    if (slot === null) return;
    await this.say(null, [setHotbarSlot(slot, id)]);
  }

  // Cho Pokémon trong đội cầm vật phẩm đang chọn trong túi
  async giveFromBag(id) {
    const index = await this.pickMon(`Cho Pokémon nào cầm ${ITEMS[id].name}?`, state.party);
    if (index === null) return;
    await this.giveHeld(state.party[index], id);
  }

  // HM: chọn Pokémon học chiêu; đã đủ 4 chiêu thì chọn chiêu để quên
  async teachMove(item) {
    const move = MOVES[item.teaches];
    const canLearn = (mon) => SPECIES[mon.speciesId].types.includes(MOVES[item.teaches].type) || item.learners?.includes(mon.speciesId);
    const index = await this.pickMon(`Dạy ${move.name} cho Pokémon nào?`, state.party);
    if (index === null) return;
    const mon = state.party[index];
    if (mon.moves.includes(item.teaches)) {
      await this.say(null, [`${mon.name} đã biết ${move.name} rồi.`]);
      return;
    }
    if (!canLearn(mon)) {
      await this.say(null, [`${mon.name} không học được ${move.name}.`]);
      return;
    }
    if (mon.moves.length >= 4) {
      await this.forgetToLearn(mon, item.teaches, false);
      return;
    }
    mon.moves.push(item.teaches);
    mon.pp[item.teaches] = move.pp;
    await this.say(null, [`${mon.name} đã học được ${move.name}!`]);
  }

  // Pokémon đã đủ 4 chiêu muốn học chiêu mới (lên cấp bằng Rare Candy, tiến hoá, HM): hỏi có quên chiêu cũ không,
  // chọn chiêu để quên (X / ✕ / "Không học" là thôi). ask: hỏi Có / Không trước khi mở danh sách chiêu
  async forgetToLearn(mon, moveId, ask = true) {
    const move = MOVES[moveId];
    if (ask && !(await this.ask(`${mon.name} muốn học ${move.name} nhưng đã biết 4 chiêu. Quên một chiêu để học ${move.name}?`))) {
      await this.say(null, [`${mon.name} không học ${move.name}.`]);
      return false;
    }
    this.msg.container.setVisible(true);
    this.speakerTag.setVisible(false);
    this.msg.setText(`Quên chiêu nào để học ${move.name}?`);
    const forget = await new Menu(this, this.router, {
      x: 250, y: 60, width: 460, height: 82 + 5 * 56, title: 'Quên chiêu nào?', rowHeight: 50, fixed: true, depth: HUD_DEPTH + 12,
      items: [
        ...mon.moves.map((m) => ({ label: MOVES[m].name, sub: `PP ${mon.pp[m] ?? 0}/${MOVES[m].pp}`, value: m, fontSize: 24 })),
        { label: `Không học ${move.name}`, value: null, fontSize: 24 },
      ],
    }).open();
    this.msg.container.setVisible(false);
    if (!forget) {
      await this.say(null, [`${mon.name} không học ${move.name}.`]);
      return false;
    }
    replaceMove(mon, forget, moveId);
    await this.say(null, [`1, 2 và... Bốp! ${mon.name} đã quên ${MOVES[forget].name}.`, `${mon.name} đã học được ${move.name}!`]);
    return true;
  }

  // Gán vật phẩm vào ô phím tắt trống đầu tiên (game/hotbar.js; thanh phím tắt tự vẽ lại ở khung hình sau)
  assignHotbar(id) {
    return assignHotbar(id);
  }

  // Ô phím tắt slot (0-5): dùng vật phẩm đã gán như chọn trong túi đồ
  useHotbar(slot) {
    if (this.busy || this.moving || this.partyMenu || this.settingsMenu || this.overlay) return;
    const id = state.hotbar[slot];
    if (!id) return; // ô trống: không làm gì (gán đồ bằng cách kéo từ túi đồ)
    if (!itemCount(id)) {
      this.runEvent(() => this.say(null, [`Bạn đã hết ${ITEMS[id].name}.`]));
      return;
    }
    this.runEvent(() => this.useBagItem(id));
  }

  // Trả về true nếu cần đóng túi (vd: vừa lên xe đạp)
  async useBagItem(id) {
    const item = ITEMS[id];
    if (id === 'bicycle') {
      if (this.vehicle === 'bike') this.setVehicle(null);
      else if (this.map.indoor || this.onWater()) await this.say(null, ['Không đi xe đạp ở đây được.']);
      else this.setVehicle('bike');
      return true;
    }
    if (item.rod) {
      await this.fish(id);
      return true;
    }
    if (item.mount === 'ride') {
      if (this.map.indoor || this.onWater()) await this.say(null, ['Không cưỡi Arcanine ở đây được.']);
      else this.rideArcanine(this.vehicle !== 'ride');
      return true;
    }
    if (item.mount === 'waterRide') {
      const d = DIRS[this.facing];
      const target = { x: this.pos.x + d.x, y: this.pos.y + d.y };
      if (this.onWater()) {
        if (this.vehicle !== 'waterRide') {
          this.setVehicle('waterRide', this.mountOf('waterRide'));
          this.splash(this.player.x, this.player.y);
        }
      } else if (this.isWater(target.x, target.y) && !this.isOccupied(target.x, target.y)) {
        await this.hopOntoWater('waterRide', this.mountOf('waterRide'), target);
      } else {
        await this.say(null, ['Đứng ở bờ nước, nhìn ra mặt nước rồi dùng để cưỡi Lapras.']);
        return false;
      }
      return true;
    }
    if (item.teaches) {
      await this.teachMove(item);
      return false;
    }
    // Bản đồ vùng / Hộp huy hiệu: đóng túi rồi mở bản đồ vùng (có bảng huy hiệu)
    if (id === 'townMap' || id === 'badgeCase') {
      this.time.delayedCall(50, () => this.openRegionMap());
      return true;
    }
    if (item.kind === 'key') {
      await this.say(null, ['Đây là vật phẩm quan trọng, giữ lại để dùng vào việc khác.']);
      return false;
    }
    if (item.kind === 'repel') {
      const problem = startRepel(id);
      if (problem) {
        await this.say(null, [problem]);
        return false;
      }
      useItem(id);
      await this.say(null, [`Bạn dùng ${item.name}. Pokémon hoang dã yếu sẽ tránh xa bạn trong ${item.steps} bước.`]);
      return true;
    }
    if (item.kind === 'escape') {
      // Về nơi hồi phục gần nhất (Pokémon Center đã vào, chưa vào thì về nhà), cả đội được hồi phục.
      // Không dùng được ở chính nơi hồi phục và trong các phòng Tứ Thiên Vương (game/itemUse.js: escapeProblem)
      const spot = state.lastCenter ?? HOME_RESPAWN;
      const why = escapeProblem(this.map, spot, MAPS);
      if (why) {
        await this.say(null, [why]);
        return false;
      }
      useItem(id);
      await this.say(null, [`Bạn dùng ${item.name}!`]);
      await this.fadeOut(300);
      this.loadMap(spot.map, spot, spot.facing);
      healParty();
      this.refreshFollower();
      this.cameras.main.fadeIn(300);
      await wait(this, 300);
      await this.say(spot.healer, ['Bạn về rồi à? Pokémon của bạn đã được hồi phục hoàn toàn.']);
      return true;
    }
    const problem = itemProblem(id, null) ?? (state.party.length ? null : 'Bạn chưa có Pokémon nào.');
    if (problem) {
      await this.say(null, [problem]);
      return;
    }
    const index = await this.pickMon(`Dùng ${item.name} cho Pokémon nào?`, state.party);
    if (index === null) return;
    const mon = state.party[index];
    let moveId = null;
    if (needsMove(id)) {
      moveId = await new Menu(this, this.router, {
        x: 250, y: 120, width: 460, height: 82 + mon.moves.length * 56, title: 'Hồi PP cho chiêu nào?', rowHeight: 50,
        items: mon.moves.map((m) => ({ label: MOVES[m].name, sub: `${mon.pp[m]}/${MOVES[m].pp}`, value: m, fontSize: 24 })),
        fixed: true, depth: HUD_DEPTH + 12,
      }).open();
      if (!moveId) return;
    }
    const why = itemProblem(id, mon, { moveId });
    if (why) {
      await this.say(null, [why]);
      return;
    }
    useItem(id);
    if (item.kind === 'evolution') {
      await this.evolutionScene(mon, evolutionTarget(mon, id), false);
      return;
    }
    const lines = applyItem(id, mon, moveId);
    const intro = item.kind === 'ev' ? [] : [item.berry ? `${mon.name} ăn ${item.name}.` : `Bạn dùng ${item.name} cho ${mon.name}.`];
    await this.say(null, [...intro, ...lines]);
    // Rare Candy: đã đủ 4 chiêu mà tới cấp học chiêu mới thì hỏi quên chiêu cũ
    for (const m of lines.cantLearn ?? []) await this.forgetToLearn(mon, m);
    // Rare Candy: lên đủ cấp thì tiến hoá như lên cấp trong trận
    const to = item.kind === 'level' ? evolutionTarget(mon) : null;
    if (to) await this.evolutionScene(mon, to, true);
    this.refreshFollower();
  }

  // ---------- Cây quả mọng ----------

  // Hoa / quả trên cây theo giai đoạn (thời gian thật, gọi định kỳ và sau khi hái)
  refreshBerries() {
    const texture = { ripe: 'berry-ripe-', bloom: 'berry-bloom-', unripe: 'berry-unripe' };
    for (const [id, { fruit, berry }] of this.berryFruits ?? []) {
      const stage = berryStage(id);
      fruit.setVisible(stage !== 'bare');
      if (stage !== 'bare') fruit.setTexture(stage === 'unripe' ? texture.unripe : `${texture[stage]}${berry}`);
    }
  }

  async pickBerryTree(tree) {
    const item = ITEMS[tree.berry];
    const stage = berryStage(tree.id);
    if (stage !== 'ripe') {
      const now = {
        bare: `Cây ${item.name} vừa được hái, đang ra lá non.`,
        bloom: `Cây ${item.name} đang ra hoa.`,
        unripe: `Quả ${item.name} đang lớn dần, sắp chín rồi!`,
      }[stage];
      await this.say(null, [now, `Quả sẽ chín sau ${regrowLabel(tree.id)} nữa.`]);
      return;
    }
    if (!(await this.ask(`Cây ${item.name} đang có quả chín! Hái không?`))) return;
    const result = pickBerries(tree);
    if (result.full) {
      await this.say(null, [`Túi đồ đã có đủ 999 ${item.name}, không mang thêm được nữa!`]);
      return;
    }
    this.refreshBerries();
    // Quả bay từ cây lên đầu người chơi
    const [tx, ty] = [tree.x * CELL + CELL / 2, tree.y * CELL];
    for (let i = 0; i < result.qty; i++) {
      const icon = this.add.image(tx + (i - (result.qty - 1) / 2) * 18, ty, item.icon).setScale(WORLD_SCALE * 0.75).setDepth(HUD_DEPTH - 1);
      this.tweens.add({
        targets: icon,
        x: this.player.x + (i - (result.qty - 1) / 2) * 22,
        y: this.playerTop() - 16,
        delay: i * 90,
        duration: 380,
        ease: 'Quad.out',
        onComplete: () => this.time.delayedCall(500, () => icon.destroy()),
      });
    }
    await wait(this, 300);
    await this.say(null, [`Bạn hái được ${result.qty} ${item.name}!`, 'Cây sẽ ra quả lại sau 2-3 ngày.']);
  }
}
