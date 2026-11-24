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
import { HOUSE_RESIDENTS } from '../data/npcHouses.js';
import { residentTalk } from '../story/residents.js';
import { placeOf } from '../data/region.js';
import { TYPES } from '../data/types.js';
import { changeHappiness, createMonster, replaceMove } from '../game/monster.js';
import { RELEARN_PRICE, canLearnDisc, relearnableMoves } from '../game/tms.js';
import { berryStage, pickBerries, regrowLabel } from '../game/berries.js';
import { evolutionTarget, evolve } from '../game/evolution.js';
import { giveHeldItem } from '../game/heldItems.js';
import { assignHotbar, setHotbarSlot, swapHotbarSlots } from '../game/hotbar.js';
import { repelBlocks, startRepel, stepRepel } from '../game/repel.js';
import { applyItem, escapeProblem, itemProblem, needsMove } from '../game/itemUse.js';
import { saveBlockMessage, saveBlocked, saveGame } from '../game/save.js';
import { signOut } from '../online/account.js';
import { stopCloudSave } from '../online/cloudSave.js';
import { forfeitable, rematchDef, trainerBeaten, trainerForfeit, trainerReady } from '../game/trainers.js';
import { addItem, blackoutLoss, hasFlag, healParty, itemCount, setFlag, state, swapParty, useItem } from '../game/state.js';
import { settings } from '../game/settings.js';
import { Ambience } from '../gfx/ambience.js';
import { mapWeather } from '../game/weather.js';
import { MACHINE_SLOTS } from '../gfx/interior.js';
import { CHAR_HEIGHT, CHAR_SCALE, applyPlayerLook } from '../gfx/player.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { openTrainerCardWindow } from '../ui/TrainerCard.js';
import { WindowManager } from '../ui/Windows.js';
import { MonDetail } from '../ui/MonDetail.js';
import { DexWindow } from '../ui/dex/DexWindow.js';
import { currentLook } from '../data/playerCustom.js';
import { addSheetTexture, fitCanvas, makeCanvas } from '../gfx/pixel.js';
import { GBA_MON, SMOOTH_UNIT, fitScale, iconUnit, monSource, monSourceExists, pixelMon, shinyImage } from '../gfx/textures.js';
import { ANIM_FRAMES, MAP_RES, doorGlass, ensureMapTextures } from '../gfx/world.js';
import { MOUNT_SHADOW, RIDE_SEAT, hasRideArt, puffTextures, rideTexture } from '../gfx/mounts.js';
import {
  STORY_NPCS, WALKABLE_OBJECTS, clerkTalk, hasPokedex, intro, objective, objectVisible, stepBlocker, stepTrigger, useObject,
} from '../story/chapter1.js';
import { resetLeague } from '../story/league.js';
import { houseKnock } from '../story/villages.js';
import { hudScaleFor } from '../game/display.js';
import { COLORS, battleRect, closeButton, cssColor, drawHpBar, drawPanel, fitText, fixToCamera, followCenter, hpColor, hudSize, textStyle, tweenAsync, uiX, wait } from '../ui/helpers.js';
import { HeldKeys, InputRouter, directionOf, isCancel, isConfirm } from '../ui/input.js';
import { actionsForCode, hotbarSlotOf } from '../game/keybinds.js';
import { Menu } from '../ui/Menu.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { MessageBox } from '../ui/MessageBox.js';
import { typeBadges } from '../ui/TypeBadge.js';
import { AreaNav } from '../ui/AreaNav.js';
import { PartyPanel } from '../ui/PartyPanel.js';
import { Hotbar } from '../ui/Hotbar.js';
import { PcBox } from '../ui/PcBox.js';
import { BagPanel } from '../ui/BagPanel.js';
import { attachShinySparkle } from '../gfx/shinyFx.js';
import { WorldHud, drawRoundIcon } from '../ui/WorldHud.js';
import { resumePendingTrades, setupTrade } from './worldTrade.js';
import { enterMapPlayers, setBattleStatus, setupPlayers, updatePlayers } from './worldPlayers.js';
import { Joystick } from '../ui/Joystick.js';
import { DPAD_R, DPad } from '../ui/DPad.js';
import { ballRule } from '../game/safari.js';
import { safariTick } from '../story/safari.js';
import { logSystem } from '../game/systemLog.js';
import { CatchPreview } from '../ui/CatchPreview.js';

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
const FOLLOWER_PNG_FILL = 0.74; // ảnh PNG Pokémon đi theo chiếm chừng này khung (xem followerTexture)
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
const HOTBAR_SLOT = 46; // cỡ ô thanh phím tắt (ui/Hotbar.js), để đặt D-Pad ngay trên
const PASS_TWINKLE_MS = 650; // mỗi chừng này ms, mỗi chỗ đi qua được (đang thấy trên màn hình) có thể lóe một ngôi sao
const PASS_TWINKLE_CHANCE = 0.45;
// NPC ngồi sofa (tính bằng pixel logic của nhân vật 16x24): giấu phần chân, hạ người xuống đệm, lùi về phía lưng ghế
const SEAT_HIDE = 6;
const SEAT_DROP = 3;
const SEAT_BACK = 2;

const cellCenter = ({ x, y }) => [x * CELL + CELL / 2, (y + 1) * CELL - 4 * ZOOM];
const samePos = (a, b) => a.x === b.x && a.y === b.y;

// Các ô đi qua khi bước lần lượt theo các hướng dirs, bắt đầu từ start
// Quay hình Pokémon (đi theo người chơi, hoặc NPC là Pokémon) về hướng dir: hình nghiêng nhìn sang trái, lật lại khi sang phải
// Xuống: mặt trước • lên: lưng • trái: hình nghiêng (hoặc mặt trước, mặt hơi quay trái) • phải: lật ngang hình nghiêng
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
        if (this.animLayer?.active) this.animLayer.setTexture(`${this.map.id}-anim-${animFrame}`);
      },
    });
    this.time.addEvent({
      delay: AUTOSAVE_MS,
      loop: true,
      callback: () => !this.busy && !this.moving && this.save(),
    });


    this.router = new InputRouter(this);
    // Cửa sổ nổi (túi đồ, thẻ HLV, hộp PC, chi tiết Pokémon): mở song song, đè lên nhau, kéo dời được (ui/Windows.js).
    // Nằm trên cột đội hình / thanh phím tắt, dưới khung lời thoại và các bảng chọn
    this.windows = new WindowManager(this, this.router, { base: HUD_DEPTH + 0.5, step: 0.5 });
    this.msg = new MessageBox(this, this.router, 24, 578, 912, 130);
    // Khung lời thoại vẽ theo khung 960x720: dời vào giữa màn hình rộng (đổi cỡ màn hình: onScreenResize)
    fixToCamera(this.msg.container).setDepth(HUD_DEPTH + 5).setVisible(false).setX(uiX(this));
    this.speakerTag = this.add
      .text(44 + uiX(this), 548, '', textStyle(19, '#ffffff', { fontStyle: 'bold', backgroundColor: cssColor(COLORS.ink), padding: { x: 14, y: 6 } }))
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 6)
      .setVisible(false);
    // Cỡ giao diện (Cài đặt → Chung; helpers.js hudScale): đặt trước khi tạo các phần giao diện
    this.hudScale = this.currentHudScale();
    this.hud = this.makeHud();
    this.ambience = new Ambience(this);
    // Cột đội hình góc trái trên; bảng Pokémon hoang dã ở góc phải dưới đồng hồ
    // Bấm vào ô: mở / đóng cửa sổ chi tiết Pokémon; kéo thả ô này lên ô khác: đổi chỗ trong đội
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
    // Màn hình đổi cỡ (đổi độ phân giải, bật toàn màn hình, xoay máy, kéo cửa sổ): bố trí lại camera và giao diện
    this.scale.on('resize', this.onScreenResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onScreenResize, this));
    // Chỗ đi qua được (cửa nhà, cửa hang, cầu thang, cửa lớn) lấp lánh định kỳ (twinklePassSpots)
    this.passSpots = [];
    this.time.addEvent({ delay: PASS_TWINKLE_MS, loop: true, callback: () => this.twinklePassSpots() });
    // Khu Safari (story/safari.js): mỗi giây kiểm tra hết giờ theo giờ máy chủ (loa báo rồi đưa ra nhà Safari, đợi lúc rảnh)
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        const event = safariTick(this);
        if (event && this.freeForInput() && !this.moving) this.runEvent(event);
      },
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

    // Phím đang giữ (đi liên tục), theo bảng phím trong Cài đặt → Điều khiển (game/keybinds.js). Chặn phím mũi tên cuộn trang
    this.held = new HeldKeys(this);
    // Cần gạt tròn (chạm / nhấn chuột vào chỗ trống trên bản đồ rồi kéo) và chạm để thao tác (ui/Joystick.js)
    this.joystick = new Joystick(this, {
      canStart: () => this.freeForInput(),
      onDir: (dir) => {
        this.held.virtual = dir;
      },
      onTap: (p) => this.tapMap(p),
    });
    // Nút điều hướng tròn cố định (Cài đặt → Chung → Hiện D-Pad), bên trái cạnh cột nút menu (ui/DPad.js)
    this.dpad = new DPad(this, {
      canUse: () => this.freeForInput(),
      onDir: (dir) => {
        this.held.virtual = dir;
      },
    });
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
      // Đang mở cửa sổ nổi: phím quay lại dùng để đóng cửa sổ trên cùng (ui/Windows.js), không mở Cài đặt
      if (this.windows.lastKey === e && (isCancel(e) || this.windows.top()?.typing)) return;
      for (const id of actionsForCode(e.code)) shortcuts[id]?.();
    });
    const onWake = (_sys, wakeData) => this.onWake(wakeData);
    // Chạy tiếp sau trận đấu (BattleScene.endBattle gửi kết quả) hoặc sau cửa hàng
    const onResume = (_sys, data) => (data?.result ? this.onWake(data) : this.onResume());
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

    // Người chơi khác trên bản đồ (scenes/worldPlayers.js) và giao dịch với họ (scenes/worldTrade.js)
    setupTrade(this);
    setupPlayers(this);
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
    // Giao dịch đã chốt mà chưa nhận (văng game giữa chừng): nhận nốt
    resumePendingTrades(this);
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

  // Cửa sổ đang mở không cho đi lại: gõ ô tìm kiếm (Pokédex), hộp PC (dùng tại máy, đóng hộp mới đi tiếp)
  get moveLocked() {
    return this.windows.typing || Boolean(this.windows.get('pc'));
  }

  // Người chơi đang bước giữa hai ô
  get moving() {
    return Boolean(this.playerMover?.walk);
  }

  update(time, delta) {
    updatePlayers(this); // vừa bước / quay mặt thì báo cho người chơi khác cùng bản đồ
    if (this.pendingFit && !this.busy) {
      this.pendingFit = false;
      this.fitCamera();
    }
    const talking = this.msg.container.visible;
    const free = !talking && !this.partyMenu && !this.settingsMenu && !this.overlay && !this.busy;
    // Cửa sổ nổi (túi đồ, hộp PC, thẻ HLV, chi tiết Pokémon) không ẩn cột nút / đội hình / đồng hồ (kéo đồ thả vào Pokémon /
    // ô phím tắt, kéo Pokémon giữa hộp và cột đội hình) (cả lúc giao dịch với người chơi khác: bảng giao dịch nổi lên trên)
    const floating = this.windows.count > 0 || Boolean(this.trade?.active) || Boolean(this.inBattleWindow);
    const shown = free || (floating && !talking && !this.partyMenu && !this.settingsMenu && !this.overlay);
    this.hud.setVisible(shown);
    this.hotbar.setVisible(shown);
    this.hotbar.update(VEHICLE_ITEMS[this.vehicle] ?? null);
    this.hud.update(objective(this.map.id), this.map.name, this.ambience.state.tod);
    this.partyPanel.setVisible(shown);
    this.partyPanel.update();
    this.areaNav.setVisible(shown);
    this.areaNav.update(this.areaInfo());
    this.placeDpad(free && !this.moveLocked);
    this.windows.update();
    if (this.windows.get('mon')) this.monDetail?.update();
    this.advanceWalk(this.playerMover, delta);
    for (const npc of [...this.npcs]) this.advanceWalk(npc, delta);
    // Đang mở cửa sổ nổi vẫn đi lại bình thường (cửa sổ dùng chuột), trừ lúc đang gõ ô tìm kiếm hoặc mở hộp PC (đứng ở máy)
    if (!this.moving && !this.busy && !this.partyMenu && !this.moveLocked) this.tryMove();
    if (!this.busy) for (const npc of this.npcs) this.updateNpc(npc, time);
    // Đang nhảy lên / xuống thú cưỡi dưới nước: xếp lớp theo chỗ thú cưỡi (hopWater)
    this.player.setDepth(this.riderDepth ?? 10 + this.player.y / 10000);
    this.placeMount(time);
    this.updateVents(time);
    this.animateFollower(time);
    for (const npc of this.npcs) npc.sprite.setDepth(10 + npc.sprite.y / 10000);
    this.updateNpcNames();
    this.drawDarkness();
  }

  // Tên trên đầu NPC (Cài đặt → Chung → Tên NPC). Đặt theo hình NPC mỗi khung hình nên đi theo cả khi NPC đi bộ, bơi, ngồi,
  // nhảy trong cảnh cắt; NPC bị ẩn / mờ dần thì tên cũng vậy. NPC không có tên và Pokémon (vd Pidgey ngoài đường) thì thôi
  updateNpcNames() {
    const show = settings.npcNames !== false;
    for (const npc of this.npcs) {
      const { sprite } = npc;
      if (!show || !npc.def.name || npc.def.mon || !sprite.active) {
        npc.label?.setVisible(false);
        continue;
      }
      npc.label ??= this.add.text(0, 0, npc.def.name, textStyle(12, '#ffffff', {
        fontStyle: 'bold', backgroundColor: 'rgba(20,26,44,0.7)', padding: { x: 5, y: 1 },
      })).setOrigin(0.5, 1).setDepth(12);
      // Đỉnh hình (kể cả khi bị cắt bớt: bơi, ngồi)
      const top = sprite.y - sprite.displayHeight * sprite.originY;
      npc.label.setPosition(sprite.x, top + 2).setVisible(sprite.visible).setAlpha(sprite.alpha);
    }
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
  // Cửa sổ nổi: bấm nút / phím Thẻ HLV lần nữa thì đóng
  openTrainerCard() {
    const open = this.windows.get('trainer');
    if (open) return open.close();
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    this.setFrame('stand');
    openTrainerCardWindow(this.windows, this.playerTexture(false));
  }

  // Game tự lưu nên không báo "Đã lưu game" mỗi lần; chỉ báo đỏ khi tab khác đang chơi (tab này thôi lưu)
  save() {
    if (!this.map) return false;
    const ok = saveGame({
      map: this.map.id, x: this.pos.x, y: this.pos.y, facing: this.facing, vehicle: this.vehicle, mount: this.mount?.uid ?? null,
    });
    if (!ok && saveBlocked() && !this.warnedStale) {
      this.warnedStale = true;
      const why = saveBlockMessage() ?? 'Game đang chơi ở tab khác, tab này không lưu nữa';
      this.hud.showSaveNote(why, true);
      logSystem(why, 'warn');
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
      npc.label?.destroy();
    }

    const map = MAPS[id];
    this.map = map;
    ensureMapTextures(this, id); // vẽ bản đồ lúc bước vào (gfx/world.js)
    // Texture bản đồ to gấp MAP_RES lần (làm mịn, gfx/world.js)
    const layer = (suffix, depth) => this.add.image(0, 0, `${id}-${suffix}`).setOrigin(0).setScale(WORLD_SCALE / MAP_RES).setDepth(depth);
    this.animLayer = layer('anim-0', 0.5);
    // Gym đã có huy hiệu: nền vẽ bản "đã thắng" (ô gió tắt, sàn băng / miệng lò thành sàn thường, gfx/world.js)
    const cleared = gymClearedArt(this, map) ? '-cleared' : '';
    this.groundLayer = layer(`ground${cleared}`, 0);
    this.objectsLayer = layer(`objects${cleared}`, 1);
    // Lớp over (ngọn cây) nằm trên nhân vật để nhân vật đứng sau cây bị che
    this.mapLayers = [this.groundLayer, this.animLayer, this.objectsLayer, layer('over', 30)];
    this.npcs = [...NPCS, ...TRAINERS, ...STORY_NPCS, ...HOUSE_RESIDENTS] // + người ở trong nhà dân (data/npcHouses.js)
      .filter((d) => d.map === id && (!d.show || d.show()))
      .map((d) => this.createNpc(d));
    this.litLanterns = new Set(); // đèn lồng đã thắp (gym tối), tắt lại khi ra khỏi gym
    this.passSpots = this.findPassSpots(map);
    this.refreshObjects();
    this.setupGymPuzzle(map);

    this.pos = { x, y };
    this.facing = facing;
    this.placePlayer();
    this.setFrame('stand');
    this.placeFollower();

    this.fitCamera();
    this.hud.showMapName(map.name);
    this.ambience.apply(map);
    enterMapPlayers(this);
  }

  // Chỗ đi qua được trên bản đồ (pixel), để biết đi được sang chỗ mới:
  //  kính cửa các toà nhà vào được • mọi ô chuyển bản đồ (lối ra ở mép bản đồ, khúc sông nối hai bản đồ, cửa hang, cầu
  //  thang, cửa lớn trong nhà) • ô dịch chuyển trong gym • thảm cửa ra trong nhà
  // Các ô liền nhau cùng dẫn tới một nơi (lối ra rộng 2 ô, khúc sông) gộp thành một vùng để không lóe dày gấp đôi
  findPassSpots(map) {
    const spots = [];
    for (const b of map.buildings ?? []) {
      if (!b.to) continue;
      const g = doorGlass(b);
      spots.push({ x: g.x * WORLD_SCALE, y: g.y * WORLD_SCALE, w: g.w * WORLD_SCALE, h: g.h * WORLD_SCALE });
    }
    const cells = new Map(); // 'x,y' -> nơi dẫn tới
    for (const w of map.warps ?? []) cells.set(`${w.x},${w.y}`, `warp:${w.to}`);
    for (const p of map.pads ?? []) cells.set(`${p.x},${p.y}`, `pad:${p.x},${p.y}`);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) if (map.info(x, y)?.exit && !cells.has(`${x},${y}`)) cells.set(`${x},${y}`, 'exit');
    }
    const seen = new Set();
    for (const [key, to] of cells) {
      if (seen.has(key)) continue;
      // Gom các ô liền nhau cùng dẫn tới một nơi
      let [x1, y1] = key.split(',').map(Number);
      let [x2, y2] = [x1, y1];
      const stack = [key];
      seen.add(key);
      while (stack.length) {
        const [cx, cy] = stack.pop().split(',').map(Number);
        x1 = Math.min(x1, cx); y1 = Math.min(y1, cy); x2 = Math.max(x2, cx); y2 = Math.max(y2, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${cx + dx},${cy + dy}`;
          if (!seen.has(k) && cells.get(k) === to) {
            seen.add(k);
            stack.push(k);
          }
        }
      }
      spots.push({
        x: x1 * CELL + CELL * 0.15, y: y1 * CELL + CELL * 0.1,
        w: (x2 - x1 + 1) * CELL - CELL * 0.3, h: (y2 - y1 + 1) * CELL - CELL * 0.2,
      });
    }
    return spots;
  }

  // Ngôi sao nhỏ lóe lên rồi tắt ở chỗ đi qua được đang thấy trên màn hình (như ánh nắng phản chiếu trên kính cửa)
  twinklePassSpots() {
    if (!this.map || !this.passSpots.length) return;
    const view = this.cameras.main.worldView;
    for (const s of this.passSpots) {
      if (Math.random() > PASS_TWINKLE_CHANCE) continue;
      if (s.x > view.right || s.x + s.w < view.x || s.y > view.bottom || s.y + s.h < view.y) continue;
      // Thỉnh thoảng hai ngôi sao lóe gần như cùng lúc. Sao vàng ấm có quầng sáng mờ phía sau (nổi trên kính cửa xanh nhạt)
      for (let i = Math.random() < 0.3 ? 2 : 1; i > 0; i--) {
        const size = (CELL * (0.38 + Math.random() * 0.17)) / 16; // fx-spark 16px: sao rộng 38-55% ô
        const x = s.x + Math.random() * s.w;
        const y = s.y + Math.random() * s.h;
        const angle = Math.random() * 45;
        const glow = this.add.image(x, y, 'fx-spark').setScale(0).setTint(0xffd040).setAlpha(0.45).setAngle(angle + 45).setDepth(9.49);
        const star = this.add.image(x, y, 'fx-spark').setScale(0).setTint(Math.random() < 0.6 ? 0xfff0a0 : 0xffffff).setAngle(angle).setDepth(9.5);
        const delay = i > 1 ? 180 : 0;
        this.tweens.add({ targets: glow, scale: size * 1.7, duration: 450, delay, yoyo: true, ease: 'Sine.out', onComplete: () => glow.destroy() });
        this.tweens.add({
          targets: star, scale: size, angle: angle + 70, duration: 450, delay, yoyo: true, ease: 'Sine.out',
          onComplete: () => star.destroy(),
        });
      }
    }
  }

  // Camera theo bản đồ đang đứng và cỡ màn hình
  fitCamera() {
    const { map } = this;
    const cam = this.cameras.main;
    const w = map.width * CELL;
    const h = map.height * CELL;
    const sw = this.scale.width;
    const sh = this.scale.height;
    // Bản đồ nhỏ hơn màn hình (trong nhà) thì đặt giữa màn hình, nền đen xung quanh
    if (w <= sw && h <= sh) {
      cam.stopFollow();
      cam.removeBounds();
      // Bản đồ thấp hơn màn hình: nhích lên trên một chút (tối đa 40px); vừa khít chiều cao thì không lệch
      cam.centerOn(w / 2, h / 2 + Math.min(40, (sh - h) / 2));
    } else {
      // Hẹp hơn màn hình theo một chiều thì nới khung camera để bản đồ nằm giữa theo chiều đó
      const bx = w < sw ? (w - sw) / 2 : 0;
      const by = h < sh ? (h - sh) / 2 : 0;
      cam.setBounds(bx, by, Math.max(w, sw), Math.max(h, sh)).setRoundPixels(true);
      cam.startFollow(this.player, true);
    }
  }

  makeHud() {
    return new WorldHud(this, {
      bag: () => this.openBag(),
      dex: () => this.openPokedex(),
      trainer: () => this.openTrainerCard(),
      settings: () => this.toggleSettings(),
      map: () => this.openRegionMap(),
    });
  }

  // Hệ số cỡ giao diện theo cài đặt và cỡ game đang hiện trên màn hình (game/display.js)
  currentHudScale() {
    return hudScaleFor(this.scale.width, this.scale.displaySize?.height ?? this.scale.height);
  }

  // Cỡ giao diện đổi (Cài đặt, hoặc Tự động mà màn hình đổi cỡ): tạo lại khung giao diện, các phần còn lại vẽ lại ở khung
  // hình sau (update). Không đổi thì chỉ dời các phần bám mép phải
  refreshHudScale() {
    const s = this.currentHudScale();
    if (s !== this.hudScale) {
      this.hudScale = s;
      this.hud.destroy();
      this.hud = this.makeHud();
      this.hotbar.key = null;
      this.partyPanel.key = null;
      this.areaNav.key = null;
    } else {
      this.hud.relayout();
    }
    if (!this.areaNav.sliding) this.areaNav.render();
  }

  // Màn hình đổi cỡ: camera tính lại theo bản đồ, nút bám mép phải dời theo, khung lời thoại về giữa màn hình.
  // Bảng đang mở (túi đồ, PC...) giữ chỗ cũ tới khi đóng; Cài đặt tự dời theo
  onScreenResize() {
    if (!this.map) return;
    if (this.transition?.active) this.battleBackdrop?.(); // đang đánh: vẽ lại nền mờ / khung cửa sổ trận đấu cho cỡ mới
    // Đang bận (cốt truyện có thể đang lia camera): chờ xong rồi mới đặt lại camera (update)
    if (this.busy) this.pendingFit = true;
    else this.fitCamera();
    this.refreshHudScale();
    this.msg.container.setX(uiX(this));
    this.speakerTag.setX(44 + uiX(this));
    // Lớp tối trong hang vẽ đúng cỡ màn hình: huỷ để khung hình sau tạo lại theo cỡ mới
    this.darkRT?.destroy();
    this.darkRT = null;
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
          if (map.tiles[map.tileAt(x, y)].hole) prop(this.add.image(x * CELL + CELL / 2, y * CELL + CELL / 2, 'obj-hole-filled').setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(0.6));
        }
      }
      this.drawGlowEdges(map);
      return;
    }
    for (const [x, y] of map.boulders ?? []) {
      const sprite = prop(this.add.image(x * CELL + CELL / 2, y * CELL + CELL / 2, 'obj-pushrock').setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(10 + (y * CELL + CELL) / 10000));
      this.boulders.set(`${x},${y}`, { x, y, sprite });
    }
    this.drawGlowEdges(map);
    if (!map.vents) return;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const group = map.info(x, y).vent;
        if (group === undefined) continue;
        const fire = prop(this.add.image(x * CELL + CELL / 2, (y + 1) * CELL - 2, 'obj-ventfire-0').setOrigin(0.5, 1).setScale(WORLD_SCALE * SMOOTH_UNIT)
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
      this.mapLayers.push(this.add.image(to.x * CELL + CELL / 2, to.y * CELL + CELL / 2, 'obj-hole-filled').setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(0.6));
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
      if (o.kind === 'item' && o.icon) {
        const key = ITEMS[o.item].icon;
        return [this.add.image(x, o.y * CELL + CELL / 2, key).setScale(WORLD_SCALE * ITEM_SCALE * iconUnit(this, key)).setDepth(2)];
      }
      if (o.kind === 'item') {
        const ball = this.add.image(x, o.y * CELL + CELL / 2 + 3 * ZOOM, 'item-ball').setScale(WORLD_SCALE * SMOOTH_UNIT * ITEM_SCALE).setDepth(2);
        // Nằm trên mặt nước thì nhấp nhô theo sóng
        if (this.isWater(o.x, o.y)) this.tweens.add({ targets: ball, y: ball.y - 3 * ZOOM, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        return [ball];
      }
      // Đồ vật trong gym: cổng tre, hàng rào điện, công tắc (sáng lên khi đã bật)
      // Gym tối: hàng rào điện phát sáng, nhìn thấy cả trong bóng tối (nằm trên lớp tối)
      if (o.kind === 'gate' || o.kind === 'barrier') {
        const glow = o.kind === 'barrier' && this.map.dark && !this.map.cleared;
        return [this.add.image(x, o.y * CELL + CELL / 2, `obj-${o.look ?? o.kind}`).setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(glow ? 56 : 2)];
      }
      if (WALKABLE_OBJECTS.includes(o.kind)) {
        const on = hasFlag(o.flag);
        return [this.add.image(x, o.y * CELL + CELL / 2, `obj-switch${on ? '-on' : ''}`).setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(1.6)];
      }
      if (o.kind === 'lantern') {
        const lit = this.litLanterns?.has(o.id) || this.map.cleared;
        return [this.add.image(x, (o.y + 1) * CELL, `obj-lantern${lit ? '-lit' : ''}`).setOrigin(0.5, 1).setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(10 + ((o.y + 1) * CELL) / 10000)];
      }
      if (o.kind !== 'berry') return [this.add.image(x, o.y * CELL + CELL / 2, 'ball').setScale(0.3 * ZOOM).setDepth(2)];
      // Cây cao hơn 1 ô: xếp lớp theo hàng như nhân vật, đứng phía trên cây thì bị cây che
      const y = (o.y + 1) * CELL;
      const depth = 10 + y / 10000;
      // Ô đất trồng nằm sát mặt đất, cây và lớp hoa / quả xếp lớp theo hàng như nhân vật
      const left = treeAt.has(`${o.x - 1},${o.y}`);
      const right = treeAt.has(`${o.x + 1},${o.y}`);
      const soilKey = left && right ? 'berry-soil-m' : left ? 'berry-soil-r' : right ? 'berry-soil-l' : 'berry-soil';
      const soil = this.add.image(x, y - CELL / 2, soilKey).setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(1.5);
      // Gốc cây cắm giữa luống (luống chiếm hàng 1-14 của ô, gốc trong hình cây cách mép dưới 4 pixel): nhấc cây lên thêm
      // BERRY_LIFT pixel; thứ tự che vẫn tính theo ô của cây
      const ty = y - BERRY_LIFT * WORLD_SCALE;
      const tree = this.add.image(x, ty, `berry-tree-${o.berry}`).setOrigin(0.5, 1).setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(depth);
      const fruit = this.add.image(x, ty, `berry-ripe-${o.berry}`).setOrigin(0.5, 1).setScale(WORLD_SCALE * SMOOTH_UNIT).setDepth(depth + 1e-6);
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
  // Giữa người chơi trên màn hình (toạ độ game 960x720)
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
    // Màn hình đổi cỡ lúc đang mở: dời cả lớp theo giữa màn hình
    const off = followCenter(this, objs);
    return {
      objs,
      add,
      destroy: () => {
        off();
        objs.forEach((o) => o.destroy());
      },
    };
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
    await tweenAsync(this, { targets: icon, scale: 3 * iconUnit(this, `badge-${badge.id}`), angle: 360, duration: 700, ease: 'Back.out' });
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
      this.grassFronts.push(this.add.image(0, 0, 'grass-front').setOrigin(0).setScale(WORLD_SCALE * SMOOTH_UNIT));
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

  // Hướng đang giữ phím (phím hướng theo Cài đặt → Điều khiển)
  readDirection() {
    return ['left', 'right', 'up', 'down'].find((d) => this.held.isDown(d)) ?? null;
  }

  // Bỏ mọi phím đang giữ (vd quay lại từ màn khác: phím nhả lúc bản đồ tạm dừng không được báo)
  resetHeldKeys() {
    this.input.keyboard.resetKeys();
    this.held.reset();
    this.joystick?.release();
    this.dpad?.release();
  }

  // D-Pad: hiện khi bật trong Cài đặt và bản đồ đang rảnh. Luôn cố định một chỗ bên trái: ngay bên phải cột nút menu (kể cả
  // khi cột đang thu lại), đáy cách thanh phím tắt một chút (theo cỡ giao diện)
  placeDpad(free) {
    if (!this.dpad) return;
    const { s } = hudSize(this);
    const r = DPAD_R * s;
    const menuRight = Math.max(0, ...this.hud.buttons.map((b) => b.label.getBounds().right));
    const cx = Math.max(16 * s + r, menuRight + 34 * s + r); // chừa cả nền viên thuốc quanh chữ nút menu
    const cy = this.scale.height - (16 + HOTBAR_SLOT + 16) * s - r;
    this.dpad.update(settings.showDpad === true && free, cx, cy, s);
  }

  // Đang đứng tự do trên bản đồ (không hội thoại, menu, cảnh cắt): cần gạt / chạm bản đồ mới có tác dụng
  freeForInput() {
    return !this.busy && !this.partyMenu && !this.settingsMenu && !this.overlay && !this.moveLocked
      && !this.msg.container.visible && !this.trade?.active;
  }

  // Chạm vào bản đồ (không kéo): chạm vào nhân vật thì thao tác với ô phía trước; chạm vào NPC / đồ vật / bảng hiệu ngay
  // cạnh (hoặc cách 2 ô thẳng hàng, vd y tá sau quầy) thì quay về phía đó rồi thao tác như bấm phím xác nhận
  tapMap(p) {
    if (!this.freeForInput() || this.moving) return;
    const wx = p.worldX;
    const wy = p.worldY;
    if (this.player.getBounds().contains(wx, wy)) {
      this.interact();
      return;
    }
    // Hình NPC cao hơn một ô: chạm vào đầu cũng tính là chạm vào NPC đó
    const npc = this.npcs.find((n) => n.sprite.visible && n.sprite.getBounds().contains(wx, wy));
    const target = npc ? npc.pos : { x: Math.floor(wx / CELL), y: Math.floor(wy / CELL) };
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    if (!dx && !dy) {
      this.interact();
      return;
    }
    if ((dx && dy) || Math.abs(dx) + Math.abs(dy) > 2) return;
    const dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up';
    if (dir !== this.facing) {
      this.facing = dir;
      this.setFrame('stand');
    }
    this.interact();
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
    if (!dir || repeat || dir === this.facing || this.moving || this.busy || this.partyMenu || this.moveLocked) return;
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
  // Bảng Pokémon hoang dã góc phải (ui/AreaNav.js): mọi Pokémon của bản đồ đang đứng, theo nhóm (không có chữ, phân biệt
  // bằng màu bóng dưới chân): 'grass' bãi cỏ, 'cave' trong hang, 'surf' lướt nước, 'fish' cần câu. Không phụ thuộc đứng
  // gần bãi nào. Pokémon trong hang chỉ hiện khi đã vào hang (mỗi hang là một bản đồ riêng)
  areaInfo() {
    if (this.map.indoor || (!this.map.areas.length && !this.map.water)) return null;
    const land = [...new Set(this.map.areas.map((a) => a.table))];
    const water = this.map.water;
    const rods = water ? RODS.slice().reverse().map((r) => water[r]).filter(Boolean) : [];
    const sections = [];
    if (land.length) sections.push({ kind: this.map.cave ? 'cave' : 'grass', tables: land });
    if (water?.surf) sections.push({ kind: 'surf', tables: [water.surf] });
    if (rods.length) sections.push({ kind: 'fish', tables: [...new Set(rods)] });
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
    // Đi bộ cùng nhau: cứ 128 bước, Pokémon còn chiến đấu được trong đội thân thiết thêm 1 (game/monster.js: happiness)
    this.walkSteps = (this.walkSteps ?? 0) + 1;
    if (this.walkSteps % 128 === 0) for (const m of state.party) if (m.hp > 0) changeHappiness(m, 1);
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
    let repelEnded = stepRepel();
    // Cài đặt "Tự dùng lại Repel": dùng thêm cái cùng loại ngay, không dừng lại (chỉ hiện dòng báo nhỏ)
    if (repelEnded && this.autoRepel(repelEnded)) repelEnded = null;
    const wild = repelEnded ? null : this.rollWild(info);
    if (!trainer && !wild && !repelEnded) return;
    this.runEvent(async () => {
      if (repelEnded) await this.repelEndedPrompt(repelEnded);
      // Vừa gặp Pokémon hoang dã vừa bị trainer nhìn thấy: đánh Pokémon hoang dã trước, xong trainer mới tới
      if (wild && (await this.startBattle(wild)) === 'lose') return;
      const t = wild ? this.spottingTrainer() : trainer;
      if (t) await this.trainerBattle(t, true);
    });
  }

  // Repel id vừa hết hiệu lực, Cài đặt "Tự dùng lại Repel" bật (và không bật "Hỏi khi Repel hết"), túi còn cái cùng loại:
  // dùng luôn. Trả về true nếu đã dùng
  autoRepel(id) {
    if (settings.repelAsk === true || settings.repelAuto === false || itemCount(id) <= 0) return false;
    if (startRepel(id)) return false;
    useItem(id);
    logSystem(`Repel hết hiệu lực: đã tự dùng thêm ${ITEMS[id].name} (còn ${itemCount(id)}).`);
    return true;
  }

  // Repel id vừa hết hiệu lực: Cài đặt "Hỏi khi Repel hết" bật và túi còn cái cùng loại thì hỏi có dùng tiếp không;
  // còn lại chỉ báo hết
  async repelEndedPrompt(id) {
    const item = ITEMS[id];
    const left = itemCount(id);
    if (settings.repelAsk !== true || left <= 0) {
      await this.say(null, [`Hiệu lực của ${item.name} đã hết.`]);
      return;
    }
    if (!(await this.ask(`Hiệu lực của ${item.name} đã hết. Dùng thêm 1 ${item.name}? (còn ${left})`))) return;
    if (startRepel(id)) return;
    useItem(id);
    await this.say(null, [`Bạn dùng ${item.name}. Pokémon hoang dã yếu sẽ tránh xa bạn trong ${item.steps} bước.`]);
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

  // Hình Pokémon đi theo, vẽ mịn từ hình gốc (cùng kiểu hình Pokémon trong giao diện, không pixel GBA), khung
  // size x size ô bản đồ (x WORLD_SCALE), 3 hướng: down (mặt trước), up (lưng), side (nghiêng sang trái). Loài nào chưa có
  // hình lưng / nghiêng thì dùng tạm mặt trước. Shiny thì đổi màu như trong trận.
  // Loài có ảnh PNG người dùng thêm (src/assets/pokemon): mọi hướng đều dùng PNG, không trộn với hình vẽ khác kiểu. Chỉ cần
  // ảnh mặt trước: đi lên dùng hình lưng tự tạo (BootScene), đi ngang dùng mặt trước (đi phải thì lật ngang, faceMonSprite);
  // có <loài>-back.png / -side.png thật thì dùng ảnh đó. Ảnh PNG đã cắt sát viền nên co nhỏ hơn
  // (FOLLOWER_PNG_FILL) cho to ngang hình SVG (SVG có sẵn khoảng trống quanh hình)
  followerTexture(speciesId, shiny, size = FOLLOWER_LOGICAL) {
    const key = `follow${size}-${speciesId}${shiny ? '-shiny' : ''}`;
    if (!this.textures.exists(key)) {
      const pngs = this.registry.get('pngSprites') ?? [];
      const front = `mon-${speciesId}`;
      const view = (suffix) => {
        const k = `mon-${speciesId}${suffix}`;
        const usePng = pngs.includes(front);
        const key = usePng ? (pngs.includes(k) ? k : front) : monSourceExists(this, k) ? k : front;
        const image = shiny ? shinyImage(this, key, speciesId, usePng) : monSource(this, key);
        const full = size * WORLD_SCALE;
        if (!usePng) return fitCanvas(image, full);
        const { canvas, ctx } = makeCanvas(full, full);
        const inner = Math.round(full * FOLLOWER_PNG_FILL);
        ctx.drawImage(fitCanvas(image, inner), Math.round((full - inner) / 2), full - inner);
        return canvas;
      };
      addSheetTexture(this, key, [view(''), view('-back'), view('-side')], ['down', 'up', 'side']);
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
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
    const moving = t !== null;
    const side = f.facing === 'left' ? -1 : f.facing === 'right' ? 1 : 0;
    if (style === 'fly') {
      // Vỗ cánh: mỗi nhịp cánh thân nảy lên một chút và co lại (đập cánh xuống), bay thì vỗ nhanh hơn, chúi về hướng bay
      const flap = Math.sin(time / (moving ? 52 : 78));
      lift = FOLLOWER_FLY + Math.sin(time / 300) * 2 * CHAR_SCALE + flap * 1.3 * CHAR_SCALE;
      sx = 1 - Math.abs(flap) * 0.12;
      sy = 1 + Math.abs(flap) * 0.05;
      angle = moving ? side * 7 : Math.sin(time / 600) * 2;
    } else if (style === 'float') {
      // Bồng bềnh: lên xuống chậm, nghiêng nhẹ, "thở" phình ra co vào
      lift = FOLLOWER_FLOAT + Math.sin(time / 520) * 2.5 * CHAR_SCALE;
      angle = Math.sin(time / 700) * 4 + (moving ? side * 4 : 0);
      sx = 1 + Math.sin(time / 520) * 0.025;
      sy = 1 - Math.sin(time / 520) * 0.02;
    } else if (style === 'hop') {
      if (moving) {
        // Nhảy từng bước: duỗi dài khi bay lên, bẹp xuống lúc bật đi và lúc chạm đất
        const air = Math.sin(t * Math.PI);
        const ground = (1 - air) ** 4;
        lift = air * FOLLOWER_HOP;
        sx = 1 - air * 0.07 + ground * 0.1;
        sy = 1 + air * 0.1 - ground * 0.1;
        angle = side * air * 6;
      } else {
        // Đứng yên: thỉnh thoảng nảy nhẹ tại chỗ
        const k = (time % 1600) / 1600;
        const air = k < 0.22 ? Math.sin((k / 0.22) * Math.PI) : 0;
        lift = air * FOLLOWER_HOP * 0.35;
        sy = 1 + air * 0.06 - (k > 0.22 && k < 0.3 ? 0.05 : 0);
        sx = 2 - sy;
      }
    } else if (moving) {
      // Đi bộ: mỗi bước hai nhịp chân, nhún lên rồi đặt chân xuống (thân hơi bẹp), lắc lư qua lại
      const step = Math.sin(t * Math.PI * 2);
      const foot = 1 - Math.abs(step);
      lift = Math.abs(step) * 1.6 * CHAR_SCALE;
      sx = 1 + foot * 0.05;
      sy = 1 - foot * 0.06;
      angle = step * 5;
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
    this.followerGrassImgs ??= [0, 1].map(() => this.add.image(0, 0, 'grass-front').setOrigin(0).setScale(WORLD_SCALE * SMOOTH_UNIT).setVisible(false));
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
    npc.label?.destroy();
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
    const balloon = this.add.image(cx, top - 10, 'fx-balloon').setOrigin(0.5, 1).setScale(WORLD_SCALE * SMOOTH_UNIT * 1.6).setDepth(10 + ground / 10000 + 0.001);
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

  // Mở cửa hàng (scenes/MartScene.js), chờ tới khi đóng. opts: { tier (bậc hàng), stock (quầy riêng: STORE_STOCK),
  // items (danh sách vật phẩm bán, vd nhân viên Khu Safari chỉ bán bóng) }
  async openMart(opts) {
    this.fromMart = true;
    this.scene.launch('Mart', opts);
    this.scene.pause();
    await new Promise((resolve) => {
      this.martClosed = resolve;
    });
  }

  // Hỏi kèm nhiều lựa chọn (menu bên phải, ngay trên hộp thoại): items [{ label, value }]. Trả về value đã chọn, hoặc null
  // nếu bấm quay lại
  async choose(question, items, speaker = null) {
    this.msg.container.setVisible(true);
    this.speakerTag.setText(speaker ?? '').setVisible(Boolean(speaker));
    this.msg.setText(question);
    const width = 440;
    const height = 30 + items.length * 56;
    const answer = await new Menu(this, this.router, {
      x: 940 - width, y: 532 - height, width, height, fixed: true, depth: HUD_DEPTH + 20, items,
    }).open();
    this.msg.container.setVisible(false);
    this.speakerTag.setVisible(false);
    return answer ?? null;
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
    if (this.busy || this.moving || this.partyMenu || this.windows.typing) return;
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
      this.openPC();
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
        await this.openMart({ tier: MAPS[this.map.exit?.to]?.martTier ?? 0, stock: def.stock });
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
      } else if (def.resident) {
        await residentTalk(this, def);
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

  // Bật máy là vào thẳng Hộp Pokémon (ui/PcBox.js): cửa sổ nổi như túi đồ (giao diện bản đồ vẫn hiện), kéo thả giữa lưới hộp
  // và cột đội hình góc trái để gửi / rút / đổi chỗ, kéo vào thùng rác để thả (hỏi lại, mặc định "Không")
  openPC() {
    const open = this.windows.get('pc');
    if (open) return this.windows.front(open);
    this.setFrame('stand');
    new PcBox(this, {
      windows: this.windows,
      ghostDepth: HUD_DEPTH + 11,
      party: this.partyPanel,
      ask: (question) => this.ask(question, null, { safe: true }),
      onChange: () => this.refreshFollower(),
      onClose: () => {
        this.refreshFollower();
        this.save();
      },
    }).open();
  }

  // Thanh chọn Pokémon nằm ngang giữa màn hình (dùng / cho cầm vật phẩm, dạy HM): chỉ có các thẻ Pokémon trong đội (hình,
  // tên, cấp, thanh máu + số máu), không có tiêu đề. Bấm / chạm thẻ là chọn; ← → và phím xác nhận; phím quay lại, ✕ (góc
  // trên phải khung) hoặc bấm ra ngoài là thôi. Trả về vị trí trong đội hoặc null
  pickMonBar() {
    const party = state.party;
    if (!party.length) return Promise.resolve(null);
    const { width, height } = this.scale;
    const CW = 124;
    const CH = 166;
    const GAP = 10;
    const PAD = 14;
    const w = party.length * CW + (party.length - 1) * GAP + PAD * 2;
    const h = CH + PAD * 2;
    const x0 = Math.round(width / 2 - w / 2);
    const y0 = Math.round(height / 2 - h / 2) - 30;
    const { add, destroy } = this.overlayLayer(HUD_DEPTH + 12);
    add(this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0).setInteractive());
    const g = add(this.add.graphics());
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(x0 + 4, y0 + 6, w, h, 16);
    g.fillStyle(0x1e2a44, 0.97);
    g.fillRoundedRect(x0, y0, w, h, 16);
    g.lineStyle(3, 0x4a88e0);
    g.strokeRoundedRect(x0, y0, w, h, 16);
    const cards = party.map((mon, i) => {
      const cx = x0 + PAD + i * (CW + GAP);
      const cy = y0 + PAD;
      const fainted = mon.hp <= 0;
      const cg = add(this.add.graphics());
      const key = pixelMon(this, mon.speciesId, '', GBA_MON, mon.shiny);
      add(this.add.image(cx + CW / 2, cy + 76, key).setOrigin(0.5, 1).setScale(fitScale(this, key, 64)).setAlpha(fainted ? 0.5 : 1));
      const name = add(this.add.text(cx + CW / 2, cy + 92, mon.name, textStyle(15, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
      fitText(name, CW - 16, 0.7);
      add(this.add.text(cx + CW / 2, cy + 112, `Lv ${mon.level}${fainted ? ' • Kiệt sức' : ''}`, textStyle(13, fainted ? '#f08080' : '#a8b4d0', { fontStyle: 'bold' })).setOrigin(0.5));
      add(this.add.text(cx + CW / 2, cy + CH - 16, `${Math.max(0, mon.hp)}/${mon.maxHp}`, textStyle(12, '#c8d2ea', { fontStyle: 'bold' })).setOrigin(0.5));
      const zone = add(this.add.zone(cx, cy, CW, CH).setOrigin(0).setInteractive({ useHandCursor: true }));
      return { mon, cx, cy, cg, zone };
    });
    let index = 0;
    // Thanh máu mảnh nằm trọn trong thẻ (drawHpBar chừa chỗ cho nhãn "HP" nên không dùng ở đây)
    const hpBar = (cg, x, y, bw, ratio) => {
      const r = Phaser.Math.Clamp(ratio, 0, 1);
      cg.fillStyle(0x0e1322);
      cg.fillRoundedRect(x, y, bw, 8, 4);
      if (r > 0) {
        cg.fillStyle(hpColor(r));
        cg.fillRoundedRect(x, y, Math.max(8, bw * r), 8, 4);
      }
    };
    const draw = () => cards.forEach((c, i) => {
      const { cg, cx, cy, mon } = c;
      const on = i === index;
      cg.clear();
      cg.fillStyle(on ? 0x2f4a7a : 0x22304e);
      cg.fillRoundedRect(cx, cy, CW, CH, 12);
      cg.lineStyle(on ? 3 : 2, on ? 0xffd860 : 0x3a4a6c);
      cg.strokeRoundedRect(cx, cy, CW, CH, 12);
      hpBar(cg, cx + 14, cy + CH - 36, CW - 28, mon.hp / mon.maxHp);
    });
    draw();
    return new Promise((resolve) => {
      const done = (value) => {
        this.router.clear();
        destroy();
        resolve(value);
      };
      // ✕ nằm đè lên góc khung, không che thẻ
      closeButton(this, x0 + w - 2, y0 + 2, () => done(null), 28).forEach(add);
      cards.forEach((c, i) => {
        c.zone.on('pointerover', () => {
          index = i;
          draw();
        });
        c.zone.on('pointerdown', (p, lx, ly, e) => {
          e?.stopPropagation();
          done(i);
        });
      });
      const openedAt = performance.now();
      this.router.set((e) => {
        if (e.timeStamp < openedAt) return;
        const dir = directionOf(e);
        if (dir === 'left' || dir === 'right') {
          index = (index + (dir === 'left' ? -1 : 1) + cards.length) % cards.length;
          draw();
        } else if (isConfirm(e)) done(index);
        else if (isCancel(e)) done(null);
      }, (p) => {
        if (p.downTime < openedAt) return;
        if (p.rightButtonDown() || p.x < x0 || p.x > x0 + w || p.y < y0 || p.y > y0 + h) done(null);
      });
    });
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
    const { objs, add, destroy } = this.overlayLayer(HUD_DEPTH + 8);
    add(drawPanel(this, 290, 40, 380, 440, 18, true));
    const glow = add(this.add.graphics());
    glow.fillStyle(TYPES[sp.types[0]].color, 0.2);
    glow.fillCircle(480, 190, 110);
    const key = pixelMon(this, speciesId);
    add(this.add.image(480, 300, key).setOrigin(0.5, 1).setScale(fitScale(this, key, 192)));
    add(this.add.text(480, 314, sp.name, textStyle(34, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5, 0));
    typeBadges(this, 480, 384, sp.types, { align: 'center' }).forEach(add);
    add(this.add.text(480, 412, sp.desc ?? '', textStyle(18, '#4a5266', { align: 'center', wordWrap: { width: 330 } })).setOrigin(0.5, 0));
    for (const o of objs) o.x += uiX(this); // vẽ theo khung 960x720, dời vào giữa màn hình rộng
    const types = sp.types.map((t) => TYPES[t].name).join('/');
    const ok = await this.ask(`Bạn chọn ${sp.name}, Pokémon hệ ${types}?`);
    destroy();
    return ok;
  }

  // ---------- Poké Mart ----------

  onResume() {
    this.resetHeldKeys();
    this.refreshFollower();
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
    this.windows.closeAll();
    this.battleTrainer = data.trainer ?? null;
    setBattleStatus(this, true); // người chơi khác thấy tag "Đang đấu" trên đầu mình
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

    // Trận đấu là cửa sổ nổi giữa màn hình (ui/helpers.js: battleRect): khung cửa sổ (viền, bóng) mở rộng từ giữa ra, rồi
    // trận đấu vẽ bên trong khung. Như các cửa sổ nổi khác: bản đồ vẫn chạy phía sau (người chơi khác đi lại, NPC, giao
    // diện đội hình / nhiệm vụ / đồng hồ vẫn hiện), chỉ khoá thao tác trên bản đồ cho tới khi đánh xong (endBattleWindow)
    const backdrop = this.add.graphics().setScrollFactor(0).setDepth(200);
    const p = { t: 0 };
    this.transition = backdrop;
    const drawBackdrop = () => {
      const { width, height } = this.scale;
      const full = battleRect(this);
      const r = { ...full, y: full.y + full.top, h: full.h - full.top };
      const k = 0.6 + 0.4 * p.t;
      const w = r.w * k;
      const h = r.h * k;
      const x = r.x + (r.w - w) / 2;
      const y = r.y + (r.h - h) / 2;
      backdrop.clear();
      backdrop.fillStyle(0x060a16, 0.55 * p.t);
      backdrop.fillRect(0, 0, width, height);
      // Trận đã mở: cửa sổ trận tự vẽ khung (kéo dời được), bản đồ không phủ tối
      if (p.dimOnly) {
        backdrop.clear();
        return;
      }
      backdrop.fillStyle(0x000000, 0.4 * p.t);
      backdrop.fillRoundedRect(x - 4, y + 2, w + 14, h + 14, 16);
      backdrop.fillStyle(0x10151f, p.t);
      backdrop.fillRoundedRect(x - 8, y - 8, w + 16, h + 16, 14);
      backdrop.lineStyle(2, 0x3d4c72, p.t);
      backdrop.strokeRoundedRect(x - 7, y - 7, w + 14, h + 14, 13);
    };
    this.battleBackdrop = drawBackdrop;
    this.tweens.add({
      targets: p,
      t: 1,
      delay: 520,
      duration: 420,
      ease: 'Cubic.out',
      onUpdate: drawBackdrop,
      onComplete: () => {
        this.windows.closeAll();
        // Đánh ngoài trời thì trận đấu cũng tối / mưa theo bản đồ
        // weather: thời tiết đang có ở bản đồ (theo vùng khí hậu), mang vào trận đấu kể cả khi tắt hiệu ứng hình ảnh
        // balls: khu Safari Effort không bắt được Pokémon (game/safari.js: ballRule)
        this.scene.launch('Battle', {
          ...data, ambience: this.ambience.state.outdoor, weather: mapWeather(this.map),
          balls: data.trainer ? 'normal' : ballRule(this.map.id),
        });
        // Bản đồ vẫn chạy nhưng không nhận chuột / phím (cửa sổ trận đấu nhận); trận xong BattleScene gọi endBattleWindow
        this.inBattleWindow = true;
        this.input.enabled = false;
        if (this.input.keyboard) this.input.keyboard.enabled = false;
        p.dimOnly = true;
        drawBackdrop();
      },
    });
    return new Promise((resolve) => {
      this.battleDone = resolve;
    });
  }

  // Trận đấu (cửa sổ nổi) vừa kết thúc: bản đồ nhận lại chuột / phím, xử lý kết quả
  endBattleWindow(data) {
    this.inBattleWindow = false;
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    return this.onWake(data);
  }

  async onWake(data) {
    this.resetHeldKeys();
    setBattleStatus(this, false);
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
      await wait(this, 200);
      await this.checkEvolutions(data?.leveled ?? []);
      // Kết quả trận đã lưu trước khi tiến hoá: lưu lại để đóng tab ngay sau đó không mất lần tiến hoá
      if (data?.persist && data.leveled?.length && !this.battleTrainer?.onDefeat) this.save();
      // Bắt được mà đội đã đủ 6 (gửi vào PC): cửa sổ xem nhanh bên phải, trên khung nhiệm vụ (không chặn: vẫn đi lại được,
      // đóng bằng ✕ / Esc)
      if (data?.preview) new CatchPreview(this.windows, data.preview);
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

  // Màn tiến hoá dạng bảng nổi giữa màn hình: Pokémon đứng trên bệ sáng, nhấp nháy phát sáng.
  // ask: hỏi "Có muốn cho tiến hoá?" (lên cấp, Rare Candy, được trao đổi) — Không thì giữ nguyên, lần lên cấp sau hỏi lại;
  // dùng đá tiến hoá thì không hỏi (người chơi đã chọn dùng đá). Có: hình trắng đổi qua lại giữa dạng cũ / mới, nhanh dần,
  // rồi hiện dạng mới. Trả về true nếu đã tiến hoá
  async evolutionScene(mon, to, ask = true) {
    this.overlay = true;
    const ox = uiX(this);
    const { width, height } = this.scale;
    const depth = HUD_DEPTH + 3;
    const { objs, add, destroy } = this.overlayLayer(depth);
    const dim = add(this.add.rectangle(width / 2, height / 2, width, height, 0x0a0e1a, 1)).setAlpha(0);
    await tweenAsync(this, { targets: dim, alpha: 0.8, duration: 300 });

    // Bảng gọn: tiêu đề, khung trong có bệ sáng, dòng hỏi, hai nút
    const P = { x: ox + 310, y: 130, w: 340, h: 400 };
    const cx = P.x + P.w / 2;
    const g = add(this.add.graphics());
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(P.x + 4, P.y + 6, P.w, P.h, 12);
    g.fillStyle(0x262c3e, 0.98);
    g.fillRoundedRect(P.x, P.y, P.w, P.h, 12);
    g.fillStyle(0x1a1f2e);
    g.fillRoundedRect(P.x, P.y, P.w, 40, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.fillStyle(0x161a26);
    g.fillRoundedRect(P.x + 14, P.y + 52, P.w - 28, 206, 10);
    g.lineStyle(2, 0x3e4660);
    g.strokeRoundedRect(P.x + 1, P.y + 1, P.w - 2, P.h - 2, 11);
    add(this.add.text(cx, P.y + 20, 'Pokémon của bạn đang tiến hoá', textStyle(16, '#c8d0e8', { fontStyle: 'bold' })).setOrigin(0.5));
    const floorY = P.y + 222;
    g.fillStyle(0x3a6ab0, 0.45);
    g.fillEllipse(cx, floorY + 4, 210, 44);
    g.fillStyle(0xd8eeff, 0.9);
    g.fillEllipse(cx, floorY, 186, 30);
    const glow = add(this.add.image(cx, floorY - 60, 'fx-glow').setScale(2.8).setAlpha(0.45));
    const oldKey = pixelMon(this, mon.speciesId, '', GBA_MON, mon.shiny);
    const newKey = pixelMon(this, to, '', GBA_MON, mon.shiny);
    const size = 120;
    // Bốn lớp chồng nhau: hình màu dạng cũ / dạng mới và hình bóng trắng của từng dạng. Đổi dạng bằng cách hoà dần hai
    // hình bóng trắng (co / giãn nhẹ như đang biến hình) thay vì đổi texture đột ngột, nên chuyển rất mượt
    const layer = (key, alpha, white = false) => {
      const img = add(this.add.image(cx, floorY + 8, key).setOrigin(0.5, 1).setScale(fitScale(this, key, size)).setAlpha(alpha));
      img.base = img.scale;
      return white ? img.setTintFill(0xffffff) : img;
    };
    const sprite = layer(oldKey, 1);
    const newSprite = layer(newKey, 0);
    const shine = layer(oldKey, 0, true);
    const newShine = layer(newKey, 0, true);
    const layers = [sprite, newSprite, shine, newShine];
    const fade = (target, alpha, duration, ease = 'Sine.inOut', scale = target.base) =>
      tweenAsync(this, { targets: target, alpha, scale, duration, ease });
    // Hoà từ hình bóng trắng này sang hình bóng trắng kia: cái cũ co lại mờ đi, cái mới giãn ra hiện lên cùng lúc
    const blend = (from, to, duration) => {
      to.setScale(to.base * 0.9);
      fade(from, 0, duration, 'Sine.inOut', from.base * 0.9);
      return fade(to, 1, duration);
    };
    this.tweens.add({ targets: glow, scale: 3.6, alpha: 0.7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const toName = SPECIES[to].name;
    // Dòng chữ nằm giữa khung hình và hai nút (không bị nút che)
    const line = add(this.add.text(cx, P.y + 272, '', textStyle(14, '#ffffff', {
      fontStyle: 'bold', align: 'center', wordWrap: { width: P.w - 40 }, lineSpacing: 4,
    })).setOrigin(0.5, 0));

    let yes = true;
    if (ask) {
      line.setText(`${mon.name} đang muốn tiến hoá thành ${toName}!
Cho ${mon.name} tiến hoá không?`);
      // Trong lúc hỏi: đổi qua lại chậm giữa dạng hiện tại và dạng tiến hoá. Mỗi lần: hình đang hiện sáng trắng dần lên,
      // hoà sang hình bóng trắng của dạng kia, rồi màu hiện dần trở lại; nghỉ một lúc rồi đổi lại
      let asking = true;
      const morph = async (toNew) => {
        const [fromColor, fromWhite, toColor, toWhite] = toNew ? [sprite, shine, newSprite, newShine] : [newSprite, newShine, sprite, shine];
        await fade(fromWhite, 1, 520);
        if (!asking) return;
        fromColor.setAlpha(0);
        await blend(fromWhite, toWhite, 560);
        if (!asking) return;
        toColor.setAlpha(1);
        await fade(toWhite, 0, 620);
      };
      (async () => {
        for (let toNew = true; asking; toNew = !toNew) {
          await wait(this, 700);
          if (asking) await morph(toNew);
        }
      })();
      yes = await this.evolutionChoice(add, { x: cx, y: P.y + P.h - 36 });
      asking = false;
      this.tweens.killTweensOf(layers);
      for (const l of layers) l.setScale(l.base).setAlpha(l === sprite ? 1 : 0);
    }
    this.tweens.killTweensOf([shine, glow]);
    shine.setAlpha(0);

    if (!yes) {
      line.setText(`${mon.name} không tiến hoá.`);
      await this.say(null, [`${mon.name} không tiến hoá.`]);
    } else {
      line.setText(`Ồ? ${mon.name} đang tiến hoá!`);
      // Hình sáng trắng dần lên, rồi hình bóng trắng hoà qua lại giữa dạng cũ và dạng mới, mỗi lần nhanh hơn
      this.tweens.add({ targets: glow, scale: 4, alpha: 0.8, duration: 700, yoyo: true, repeat: -1 });
      await fade(shine, 1, 600);
      sprite.setAlpha(0);
      for (let i = 0; i < 13; i++) {
        const toNew = i % 2 === 0;
        await blend(toNew ? shine : newShine, toNew ? newShine : shine, Math.max(140, 640 - i * 42));
      }
      this.tweens.killTweensOf(glow);
      this.cameras.main.flash(400, 255, 255, 255);
      // Lóe sáng xong: màu của dạng mới hiện dần ra dưới hình bóng trắng
      newSprite.setAlpha(1);
      fade(newShine, 0, 520);
      const oldName = mon.name;
      const events = evolve(mon, to);
      line.setText(`${oldName} đã tiến hoá thành ${toName}!`);
      await wait(this, 500);
      await this.say(null, [`Chúc mừng! ${oldName} đã tiến hoá thành ${toName}!`]);
      for (const ev of events) {
        if (ev.type === 'learn') await this.say(null, [`${mon.name} đã học được chiêu ${MOVES[ev.move].name}!`]);
        else if (ev.type === 'cantLearn') await this.forgetToLearn(mon, ev.move);
      }
    }
    await tweenAsync(this, { targets: objs, alpha: 0, duration: 300 });
    destroy();
    this.overlay = false;
    this.refreshFollower();
    return yes;
  }

  // Hai nút Không (đỏ) / Có (xanh) dưới bảng tiến hoá: bấm chuột / chạm, hoặc ← → chọn và phím xác nhận; phím quay lại = Không
  evolutionChoice(add, { x, y }) {
    const W = 116;
    const H = 40;
    const buttons = [
      { label: 'Không', value: false, color: 0xc84848, dark: 0x8a2a2a, x: x - W / 2 - 14 },
      { label: 'Có', value: true, color: 0x40b060, dark: 0x2a7a40, x: x + W / 2 + 14 },
    ];
    let index = 1;
    return new Promise((resolve) => {
      const parts = [];
      const finish = (value) => {
        this.router.clear();
        // Ẩn (cả bảng mờ dần rồi huỷ một lượt ở evolutionScene)
        for (const o of parts) o.setVisible(false).disableInteractive?.();
        resolve(value);
      };
      const draw = () => buttons.forEach((b, i) => {
        b.g.clear();
        b.g.fillStyle(b.dark);
        b.g.fillRoundedRect(b.x - W / 2, y - H / 2 + 4, W, H, 12);
        b.g.fillStyle(b.color);
        b.g.fillRoundedRect(b.x - W / 2, y - H / 2, W, H, 12);
        if (i === index) {
          b.g.lineStyle(3, 0xffd860);
          b.g.strokeRoundedRect(b.x - W / 2 - 4, y - H / 2 - 4, W + 8, H + 12, 14);
        }
      });
      for (const b of buttons) {
        b.g = add(this.add.graphics());
        const t = add(this.add.text(b.x, y + 2, b.label, textStyle(17, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
        const zone = add(this.add.zone(b.x, y + 2, W, H + 4).setInteractive({ useHandCursor: true }));
        zone.on('pointerdown', (p, lx, ly, e) => {
          e?.stopPropagation();
          finish(b.value);
        });
        parts.push(b.g, t, zone);
      }
      draw();
      this.router.set((e) => {
        const dir = directionOf(e);
        if (dir === 'left' || dir === 'right') {
          index = dir === 'left' ? 0 : 1;
          draw();
        } else if (isConfirm(e)) finish(buttons[index].value);
        else if (isCancel(e)) finish(false);
      });
    });
  }

  // ---------- Menu ----------

  // focus: số Pokédex của loài cần mở (bấm từ bảng khu vực)
  // Pokédex là cửa sổ nổi (ui/dex/DexWindow.js): nút / phím Pokédex bấm lần nữa thì đóng. focus: số Pokédex mở sẵn (bấm
  // Pokémon ở bảng khu vực); cửa sổ đang mở thì chuyển sang loài đó và nổi lên trên
  openPokedex(focus = null) {
    const open = this.windows.get('dex');
    if (open && this.dexWindow) {
      if (focus == null) return open.close();
      this.dexWindow.focus(focus);
      this.windows.front(open);
      return;
    }
    if (this.busy || this.moving || this.partyMenu) return;
    if (!hasPokedex()) {
      this.runEvent(() => this.say(null, ['Bạn chưa có Pokédex.']));
      return;
    }
    this.setFrame('stand');
    this.dexWindow = new DexWindow(this.windows, focus);
  }

  // Bảng Cài đặt (ui/SettingsPanel.js): Đồ hoạ (toàn màn hình, giới hạn FPS, ánh sáng, thời tiết), Chung (xem nhanh khi
  // gửi vào PC, đổi diện mạo), Điều khiển (cách điều khiển, phím tắt). Game luôn tự động lưu.
  // Đóng bằng Huỷ / OK, phím quay lại / cài đặt hoặc bấm ra ngoài khung. Nút mở màn hình khác (phím tắt, đổi diện mạo)
  // thì đóng bảng, mở màn đó, xong mở lại bảng đúng thẻ cũ (giữ cả phần chưa áp dụng)
  async toggleSettings() {
    if (this.settingsMenu) {
      this.settingsMenu.finish(null);
      return;
    }
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    this.busy = true;
    this.setFrame('stand');
    let panelState = null;
    for (;;) {
      this.settingsMenu = new SettingsPanel(this, this.router, {
        depth: HUD_DEPTH + 10,
        state: panelState,
        account: this.registry.get('user')?.username ?? this.registry.get('user')?.email ?? null,
        onApplied: (keys) => {
          if (keys.includes('lighting') || keys.includes('weather')) this.ambience.refresh(true);
          if (keys.includes('uiScale')) this.refreshHudScale();
        },
      });
      const result = await this.settingsMenu.open();
      this.settingsMenu = null;
      if (!result) break;
      panelState = result.state;
      const { action } = result;

      if (action === 'look') {
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
      } else if (action === 'logout') {
        // Không hỏi lại: tự lưu và gửi nốt bản lưu lên mạng rồi mới đăng xuất; tải lại trang để về màn đăng nhập sạch
        this.save();
        await stopCloudSave();
        await signOut();
        window.location.reload();
        return;
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
    if (this.busy || this.moving || this.windows.count) return;
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
    this.openSummary(picked);
  }

  // Cho cầm (kể cả đổi đồ đang cầm A lấy B: A tự về túi): không có lời thoại, chỉ báo khi không cho cầm được
  async giveHeld(mon, id) {
    const problem = giveHeldItem(mon, id);
    if (problem) await this.say(null, [problem]);
  }

  // Cửa sổ chi tiết Pokémon (ui/MonDetail.js): bấm Pokémon khác thì đổi sang con đó, bấm lại đúng con đang xem thì đóng
  openSummary(index) {
    const open = this.windows.get('mon');
    if (open && this.monDetail) {
      if (this.monDetail.index === index) return open.close();
      this.monDetail.show(index);
      this.windows.front(open);
      return;
    }
    this.setFrame('stand');
    this.monDetail = new MonDetail(this.windows, index, { ghostDepth: HUD_DEPTH + 11 });
  }

  // ---------- Túi đồ ----------

  // Túi đồ (ui/BagPanel.js) là cửa sổ nổi: bấm nút / phím Túi đồ lần nữa thì đóng. Chia ngăn (tab: Vật phẩm / Bóng /
  // Quả mọng / Kỹ năng / Phụ kiện), ô tìm kiếm, lưới 2 cột, mô tả nhỏ ngay dưới ô khi rê chuột.
  // Bấm vật phẩm là dùng luôn (chọn Pokémon, chọn chiêu...; đồ chỉ để cầm thì chọn Pokémon cho cầm), túi vẫn mở và cập nhật
  // số lượng; dùng đồ khiến rời chỗ (xe đạp, cần câu, thú cưỡi, Escape Rope...) thì đóng hết cửa sổ.
  // Kéo icon vật phẩm thả vào ô phím tắt để gán (hoặc bấm phím 1-6), thả vào Pokémon ở cột đội hình hoặc vào ô đồ cầm của
  // cửa sổ chi tiết Pokémon để cho cầm
  openBag() {
    const open = this.windows.get('bag');
    if (open) return open.close();
    if (this.busy || this.moving || this.partyMenu || this.overlay) return;
    if (!Object.keys(ITEMS).some((id) => itemCount(id) > 0 && !ITEMS[id].hidden)) {
      this.runEvent(() => this.say(null, ['Túi đồ trống trơn!']));
      return;
    }
    this.setFrame('stand');
    // Nhớ ngăn / chữ tìm / vị trí con trỏ giữa các lần mở túi
    this.bagMemory ??= { pocket: this.bagPocket ?? 0 };
    this.bag = new BagPanel(this, this.router, {
      x: 436, y: 16, width: 508, height: 460, windows: this.windows, ghostDepth: HUD_DEPTH + 11,
      memory: this.bagMemory,
      hotbar: this.hotbar,
      // Kéo vật phẩm thả vào Pokémon ở cột đội hình (góc trái trên): cho cầm
      party: { slotAt: (px, py) => this.partyPanel.slotAt(px, py), highlight: (i) => this.partyPanel.setHover(i) },
      hotkey: hotbarSlotOf,
      onAssign: (slot, item) => {
        this.hud.showSaveNote(setHotbarSlot(slot, item));
        this.hotbar.flash(slot);
      },
      onPick: (id) => this.useFromBag(id),
      onGive: (index, id) => state.party[index] && this.runEvent(async () => {
        await this.giveHeld(state.party[index], id);
        this.bag?.refresh();
      }),
      dragOver: (p) => this.monDetail?.highlightHeld(Boolean(p && this.heldDropAt(p))),
      dropItem: (p, id) => {
        const index = this.heldDropAt(p);
        if (index === null) return false;
        this.runEvent(async () => {
          await this.giveHeld(state.party[index], id);
          this.bag?.refresh();
        });
        return true;
      },
    });
  }

  // Ô đồ cầm của cửa sổ chi tiết Pokémon dưới con trỏ p (cửa sổ đó nằm trên cùng chỗ con trỏ): vị trí Pokémon trong đội
  heldDropAt(p) {
    const win = this.windows.get('mon');
    if (!win || !this.monDetail || [...this.windows.list].reverse().find((w) => w.contains(p)) !== win) return null;
    return this.monDetail.overHeld(p) && state.party[this.monDetail.index] ? this.monDetail.index : null;
  }

  // Bấm vật phẩm trong túi: dùng (túi vẫn mở, cập nhật số lượng); dùng xong phải rời chỗ thì đóng hết cửa sổ
  useFromBag(id) {
    if (this.busy || this.moving) return;
    this.runEvent(async () => {
      let close = false;
      if (ITEMS[id].kind === 'held' && !DIRECT_USE(id)) await this.giveFromBag(id);
      else close = await this.useBagItem(id);
      this.save();
      if (close) this.windows.closeAll();
      else this.bag?.refresh();
    });
  }

  // Cho Pokémon trong đội cầm vật phẩm đang chọn trong túi
  async giveFromBag(id) {
    const index = await this.pickMonBar();
    if (index === null) return;
    await this.giveHeld(state.party[index], id);
  }

  // HM: chọn Pokémon học chiêu; đã đủ 4 chiêu thì chọn chiêu để quên
  // Đĩa kỹ năng id (TM / HM): chọn Pokémon học chiêu (game/tms.js: canLearnDisc); đã đủ 4 chiêu thì chọn chiêu để quên.
  // Đĩa TM mất sau khi học xong, HM thì giữ lại
  async teachMove(id) {
    const item = ITEMS[id];
    const move = MOVES[item.teaches];
    const index = await this.pickMonBar();
    if (index === null) return;
    const mon = state.party[index];
    if (mon.moves.includes(item.teaches)) {
      await this.say(null, [`${mon.name} đã biết ${move.name} rồi.`]);
      return;
    }
    if (!canLearnDisc(mon.speciesId, id)) {
      await this.say(null, [`${mon.name} không học được ${move.name}.`]);
      return;
    }
    if (mon.moves.length >= 4) {
      if (!(await this.forgetToLearn(mon, item.teaches, false))) return;
    } else {
      mon.moves.push(item.teaches);
      mon.pp[item.teaches] = move.pp;
      await this.say(null, [`${mon.name} đã học được ${move.name}!`]);
    }
    if (item.kind === 'tm') useItem(id);
  }

  // Người dạy lại chiêu (data/gymPeople.js: GYM_RELEARNERS): chọn Pokémon, chọn chiêu từng học được mà đã quên
  // (game/tms.js: relearnableMoves), đủ 4 chiêu thì chọn chiêu để quên. Học xong mới trả tiền (RELEARN_PRICE mỗi chiêu)
  async relearnTalk(def) {
    await this.say(def.name, [
      'Ta nhớ hết mọi chiêu Pokémon từng học được. Lỡ quên chiêu nào, ta dạy lại cho.',
      `Mỗi chiêu ${formatMoney(RELEARN_PRICE)}.`,
    ]);
    if (state.money < RELEARN_PRICE) {
      await this.say(def.name, ['Cháu chưa đủ tiền rồi. Lúc nào đủ thì quay lại nhé.']);
      return;
    }
    const index = await this.pickMonBar();
    if (index === null) return;
    const mon = state.party[index];
    const moves = relearnableMoves(mon);
    if (!moves.length) {
      await this.say(def.name, [`${mon.name} chưa quên chiêu nào để học lại cả.`]);
      return;
    }
    this.msg.container.setVisible(true);
    this.speakerTag.setVisible(false);
    this.msg.setText(`Dạy lại chiêu nào cho ${mon.name}? (${formatMoney(RELEARN_PRICE)})`);
    const rows = Math.min(moves.length + 1, 6);
    const pick = await new Menu(this, this.router, {
      x: 250, y: 40, width: 460, height: 82 + rows * 56, title: 'Dạy lại chiêu', rowHeight: 50, visibleRows: rows,
      fixed: true, depth: HUD_DEPTH + 12,
      items: [
        ...moves.map((m) => ({ label: MOVES[m].name, sub: `PP ${MOVES[m].pp}`, value: m, fontSize: 24 })),
        { label: 'Thôi', value: null, fontSize: 24 },
      ],
    }).open();
    this.msg.container.setVisible(false);
    if (!pick) return;
    let learned = true;
    if (mon.moves.length >= 4) learned = await this.forgetToLearn(mon, pick, false);
    else {
      mon.moves.push(pick);
      mon.pp[pick] = MOVES[pick].pp;
      await this.say(null, [`${mon.name} đã học lại được ${MOVES[pick].name}!`]);
    }
    if (!learned) return;
    state.money -= RELEARN_PRICE;
    await this.say(def.name, ['Nhớ luyện tập chăm chỉ nhé!']);
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
    // Túi ở trên cùng: phím 1-6 gán vật phẩm đang chọn vào ô; Pokédex ở trên cùng: gõ số để tìm theo số thứ tự
    if (['bag', 'dex'].includes(this.windows.top()?.id)) return;
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
      await this.teachMove(id);
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
    const index = await this.pickMonBar();
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
      const icon = this.add.image(tx + (i - (result.qty - 1) / 2) * 18, ty, item.icon).setScale(WORLD_SCALE * 0.75 * iconUnit(this, item.icon)).setDepth(HUD_DEPTH - 1);
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
