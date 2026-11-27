import { CELL, WORLD_SCALE } from '../config.js';
import { followStyle } from '../data/followStyle.js';
import { currentLook, resolveLook } from '../data/playerCustom.js';
import { batchSteps, planSteps, stepFacing, trimQueue } from '../game/movePath.js';
import { cleanMeta, cleanMove } from '../game/remotePlayer.js';
import { settings } from '../game/settings.js';
import { playerName, state } from '../game/state.js';
import { RIDE_SEAT, rideTexture } from '../gfx/mounts.js';
import { CHAR_HEIGHT, CHAR_SCALE, FOLLOWER_SCALE, makeBikeTexture, makeCharacterTexture } from '../gfx/player.js';
import { displayName, loadNames } from '../online/playerNames.js';
import { MapPresence } from '../online/presence.js';
import { supabase } from '../online/supabase.js';
import { textStyle, uiX } from '../ui/helpers.js';
import { Menu } from '../ui/Menu.js';
import { showTrainerCard } from '../ui/TrainerCard.js';
import { onTradeRequest, requestTrade } from './worldTrade.js';

// Người chơi khác trên bản đồ (online/presence.js): hình nhân vật theo diện mạo của họ, tên trên đầu, đi lại mượt theo từng
// bước (tin bước đi đến 1–2 lần/giây tuỳ bản đồ đông hay vắng, kèm các ô đã đi qua: xếp hàng rồi đi lại đúng đường đó từng
// ô, sắp hết hàng thì đi chậm lại một chút cho khỏi đứng chờ tin sau, dồn nhiều hơn một tin thì đi nhanh lên). Chọn một người: chuột phải (máy tính) hoặc chạm đúp (điện thoại, chuột trái nhấn đúp cũng được) -> menu nhỏ
// "Xem chi tiết" (thẻ HLV rút gọn: không có huy hiệu, tiền, Pokédex) / "Giao dịch" (scenes/worldTrade.js).
// Người chơi khác không chặn đường (đi xuyên qua nhau được). Đi xe đạp / cưỡi Arcanine / cưỡi Lapras / lướt Surf thì
// vẽ đúng như vậy (xe đạp; người ngồi trên thú cưỡi hoặc khối nước, nhấp nhô theo sóng).
// Trên đầu: tag "⚔ Đang đấu" khi người đó đang trong trận, "z z Z" khi AFK (không bấm gì AFK_MS, hoặc đang ở tab khác).
// Pokémon đầu đội của người đó đi theo sau lưng (bước vào ô người đó vừa rời; loài bay / lơ lửng thì bay), như của mình.

const ZOOM = WORLD_SCALE / 4;
const STEP_MS = 230;
// Thời gian một bước theo cách di chuyển (giống WorldScene), nhịp chân thú cưỡi
const VEHICLE_STEP_MS = { bike: 100, ride: 90, surf: 225, waterRide: 100 };
const MOUNT_BEAT_MS = { ride: 90, waterRide: 110, surf: 160 };
const MOVE_GAP = 500; // nhịp gửi tin bước đi khi tin không ghi (bản cũ), online/presence.js
const stepMs = (o) => VEHICLE_STEP_MS[o.vehicle] ?? STEP_MS;
// Số bước một tin của người đó chở (theo nhịp họ đang gửi và cách di chuyển)
const batchOf = (o) => batchSteps(o.gap ?? MOVE_GAP, stepMs(o));
const WATER = ['surf', 'waterRide'];
const DOUBLE_TAP_MS = 350;
const DEPTH = 10;
// Bóng dưới chân (giống WorldScene: fx-shadow 128x32)
const SHADOW = [0.18 * CHAR_SCALE, 0.2 * CHAR_SCALE];
const SHADOW_ALPHA = 0.22;
// Pokémon đi theo người chơi khác (giống WorldScene.animateFollower, rút gọn)
const FOLLOWER_SHADOW = [0.16 * CHAR_SCALE * FOLLOWER_SCALE, 0.18 * CHAR_SCALE * FOLLOWER_SCALE];
const FOLLOWER_FLY = 9 * CHAR_SCALE;
const FOLLOWER_FLOAT = 5 * CHAR_SCALE;
const BACK = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }; // ô sau lưng theo hướng nhìn
// AFK: không bấm phím / chạm gì chừng này thì báo AFK cho người khác (kiểm tra mỗi AFK_CHECK ms)
const AFK_MS = 60 * 1000;
const AFK_CHECK = 5000;

const cellCenter = ({ x, y }) => [x * CELL + CELL / 2, (y + 1) * CELL - 4 * ZOOM];

// Pokémon đi theo của mình (con đầu đội) gửi cho người khác: { s: loài, sh: shiny } hoặc null
function myFollower() {
  const mon = state.party[0];
  return mon ? { s: mon.speciesId, sh: Boolean(mon.shiny) } : null;
}

// Thông tin của mình gửi cho người khác. status: 'battle' (đang trong trận) | 'afk' | null
function myMeta(world) {
  const user = world.registry.get('user');
  const look = currentLook(state.player);
  return {
    id: user.id, name: playerName(), gender: look.gender, look, badges: state.badges.size,
    playTime: Math.floor(state.playTime ?? 0), startedAt: state.startedAt ?? null,
    status: world.presenceStatus ?? null, follower: myFollower(),
  };
}

// Tính lại trạng thái của mình (đang đấu / AFK / bình thường), đổi thì báo cho người khác
function refreshStatus(world) {
  if (!world.presence) return;
  const idle = document.hidden || Date.now() - (world.lastActive ?? 0) > AFK_MS;
  const status = world.inBattle ? 'battle' : idle ? 'afk' : null;
  if (status === world.presenceStatus) return;
  world.presenceStatus = status;
  world.presence.update({ status });
}

// Vào / ra trận đấu (WorldScene.startBattle / onWake): người khác thấy tag "Đang đấu"
export function setBattleStatus(world, on) {
  world.inBattle = on;
  if (!on) world.lastActive = Date.now();
  refreshStatus(world);
}

function setFrame(sprite, facing, step = 'stand') {
  const side = facing === 'left' || facing === 'right';
  sprite.setFrame(`${side ? 'side' : facing}-${step}`);
  sprite.setFlipX(facing === 'right');
}

// Texture nhân vật theo diện mạo (nhiều người cùng diện mạo dùng chung một texture); bike: đang đạp xe
function lookTexture(scene, meta, bike = false) {
  const look = resolveLook(meta.gender, meta.look ?? {});
  const key = `op-${meta.gender}-${JSON.stringify(look).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0}`;
  if (!scene.textures.exists(key)) makeCharacterTexture(scene, key, look);
  if (!bike) return key;
  if (!scene.textures.exists(`${key}-bike`)) makeBikeTexture(scene, `${key}-bike`, look);
  return `${key}-bike`;
}

// Đổi hình theo cách di chuyển: xe đạp (texture riêng), thú cưỡi / lướt nước (hai lớp hình thú cưỡi kẹp người ngồi)
function applyVehicle(world, o) {
  const vehicle = o.meta.vehicle ?? null;
  const art = vehicle && vehicle !== 'bike' && RIDE_SEAT[o.meta.rideArt] ? o.meta.rideArt : null;
  o.vehicle = vehicle;
  o.art = art;
  o.sprite.setTexture(lookTexture(world, o.meta, vehicle === 'bike')).setCrop().setOrigin(0.5, 1);
  setFrame(o.sprite, o.facing);
  o.riderView = null;
  if (!art) {
    o.mount?.setVisible(false);
    o.mountOver?.setVisible(false);
    o.shadow.setVisible(true);
    applyFollower(world, o);
    return;
  }
  const key = rideTexture(world, art);
  applyFollower(world, o);
  o.mount ??= world.add.sprite(0, 0, key, 'down-0').setOrigin(0.5, 1).setScale(CHAR_SCALE);
  o.mountOver ??= world.add.sprite(0, 0, `${key}-over`, 'down-0').setOrigin(0.5, 1).setScale(CHAR_SCALE);
  o.mount.setTexture(key, 'down-0').setVisible(true);
  o.mountOver.setTexture(`${key}-over`, 'down-0').setVisible(true);
  o.shadow.setVisible(!WATER.includes(vehicle));
  placeMount(o, world.time.now);
}

// Người ngồi trên thú cưỡi / khối nước (giống WorldScene.placeMount): giấu chân, nâng lên yên, nhấp nhô theo sóng
function placeMount(o, time) {
  if (!o.art) return;
  const water = WATER.includes(o.vehicle);
  const bob = water ? Math.sin(time / 260) * 2 : 0;
  const view = o.facing === 'left' || o.facing === 'right' ? 'side' : o.facing;
  const beat = o.moving ? MOUNT_BEAT_MS[o.vehicle] ?? 90 : water ? 420 : 0;
  const frame = `${view}-${beat && Math.floor(time / beat) % 2 ? 1 : 0}`;
  const { dx, seat, hide } = RIDE_SEAT[o.art][view];
  const flip = o.facing === 'right';
  const x = o.sprite.x - (flip ? -dx : dx) * WORLD_SCALE * CHAR_SCALE;
  const y = o.sprite.y + bob;
  o.mount.setFrame(frame).setFlipX(flip).setPosition(x, y).setDepth(DEPTH - 0.01);
  o.mountOver.setFrame(frame).setFlipX(flip).setPosition(x, y).setDepth(DEPTH + 0.01);
  if (o.riderView !== view) {
    o.riderView = view;
    o.sprite.setCrop(0, 0, o.sprite.frame.width, o.sprite.frame.height - hide * WORLD_SCALE);
  }
  const lift = (seat - hide) * WORLD_SCALE * CHAR_SCALE - bob;
  o.sprite.setOrigin(0.5, 1 + lift / CHAR_HEIGHT);
  o.label.setPosition(o.sprite.x, o.sprite.y - CHAR_HEIGHT - 4 - lift);
}

export function setupPlayers(world) {
  world.others = new Map(); // id -> { meta, pos, facing, sprite, shadow, label }
  world.presence = null;
  const user = world.registry.get('user');
  if (supabase && user?.id) {
    world.presence = new MapPresence(myMeta(world), {
      onPlayers: (list) => syncPlayers(world, list),
      onMove: (id, pos) => {
        // Tin bước đi tự gửi (giả / sai được): bỏ tin sai, cắt path quá dài, giới hạn nhịp (game/remotePlayer.js)
        const clean = cleanMove(pos);
        if (clean) moveOther(world, id, clean);
      },
      onRequest: (req) => onTradeRequest(world, req),
    });
  }
  world.lastSent = null;
  world.lastFollower = JSON.stringify(myFollower());
  // AFK: bấm phím / chạm là đang chơi; chuyển tab khác hoặc lâu không bấm gì là AFK
  world.lastActive = Date.now();
  world.inBattle = false;
  world.presenceStatus = null;
  const onActive = () => {
    world.lastActive = Date.now();
    if (world.presenceStatus === 'afk') refreshStatus(world);
  };
  const onVisible = () => {
    if (!document.hidden) world.lastActive = Date.now();
    refreshStatus(world);
  };
  window.addEventListener('keydown', onActive);
  window.addEventListener('pointerdown', onActive);
  document.addEventListener('visibilitychange', onVisible);
  const afkTimer = setInterval(() => refreshStatus(world), AFK_CHECK);
  world.events.once('shutdown', () => {
    window.removeEventListener('keydown', onActive);
    window.removeEventListener('pointerdown', onActive);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(afkTimer);
    // Scene tắt thì hình đã bị huỷ cùng scene: bỏ danh sách trước khi rời kênh (rời kênh báo danh sách rỗng)
    const presence = world.presence;
    world.presence = null;
    world.others = null;
    presence?.leave();
  });
}

// Vào bản đồ mới (WorldScene.loadMap): xoá người chơi của bản đồ cũ, vào kênh bản đồ mới
// Chỗ đứng và cách di chuyển của mình (gửi cho người khác)
const myPos = (world) => ({
  ...world.pos, facing: world.facing, vehicle: world.vehicle ?? null, rideArt: world.vehicle ? world.rideArt ?? null : null,
});
const posKey = (world, p) => `${world.map.id}:${p.x},${p.y},${p.facing},${p.vehicle},${p.rideArt}`;

export function enterMapPlayers(world) {
  if (!world.others) return;
  for (const id of [...world.others.keys()]) removeOther(world, id);
  if (!world.presence) return;
  world.presence.update({ ...myMeta(world) });
  const pos = myPos(world);
  world.presence.enter(world.map.id, pos);
  world.lastSent = posKey(world, pos);
}

// Mỗi khung hình: mình vừa bước / quay mặt / lên xuống xe thì báo cho người khác; người khác đang cưỡi thì nhấp nhô theo sóng
export function updatePlayers(world) {
  if (!world.map || !world.others) return;
  const now = world.time.now;
  // Tên trên đầu người chơi khác: Cài đặt → Chung → Tên người chơi
  const names = settings.playerNames !== false;
  for (const o of world.others.values()) {
    placeMount(o, now);
    if (o.label.visible !== names) o.label.setVisible(names);
    placeTag(o, now);
    placeFollower(o, now);
  }
  if (!world.presence) return;
  // Đổi Pokémon đầu đội: người khác thấy Pokémon đi theo mới
  const follower = JSON.stringify(myFollower());
  if (follower !== world.lastFollower) {
    world.lastFollower = follower;
    world.presence.update({ follower: myFollower() });
  }
  const pos = myPos(world);
  const key = posKey(world, pos);
  if (key === world.lastSent) return;
  world.lastSent = key;
  world.presence.move(pos);
}

// Vừa biết thêm tên thật: đổi tên trong thông tin và nhãn trên đầu
function refreshNames(world) {
  for (const o of world.others?.values() ?? []) {
    const name = displayName(o.meta.id, o.meta.claimedName);
    if (name === o.meta.name) continue;
    o.meta = { ...o.meta, name };
    o.label.setText(name);
  }
}

function syncPlayers(world, raw) {
  if (!world.others) return;
  // Thông tin người khác tự gửi (giả được): tên thật lấy từ máy chủ, giá trị lạ bị bỏ (game/remotePlayer.js)
  const list = raw.map((meta) => cleanMeta(meta, displayName));
  loadNames(list.map((m) => m.id)).then((got) => got && refreshNames(world));
  const seen = new Set();
  for (const meta of list) {
    seen.add(meta.id);
    const o = world.others.get(meta.id);
    if (!o) addOther(world, meta);
    else {
      const changedLook = JSON.stringify(meta.look) !== JSON.stringify(o.meta.look) || meta.gender !== o.meta.gender;
      o.meta = meta;
      o.label.setText(meta.name || 'Người chơi');
      if (changedLook || (meta.vehicle ?? null) !== o.vehicle || (meta.rideArt ?? null) !== (o.meta.rideArt ?? null)) applyVehicle(world, o);
      applyStatus(world, o);
      applyFollower(world, o);
      // Chỗ đứng trong presence (cập nhật khi đứng yên): sửa lại nếu lỡ mất tin bước đi. Presence cũ hơn tin bước đi đã
      // nhận (người đó vẫn đang đi, chưa cập nhật presence) thì bỏ qua, không kéo về chỗ cũ
      const fresh = (meta.moveAt ?? 0) >= (o.moveAt ?? 0);
      if (fresh && !o.walking && Number.isFinite(meta.x) && (meta.x !== o.pos.x || meta.y !== o.pos.y)) moveOther(world, meta.id, meta);
    }
  }
  for (const id of [...world.others.keys()]) if (!seen.has(id)) removeOther(world, id);
}

function addOther(world, meta) {
  if (!Number.isFinite(meta.x) || !Number.isFinite(meta.y)) return;
  const pos = { x: meta.x, y: meta.y };
  const facing = meta.facing ?? 'down';
  const [x, y] = cellCenter(pos);
  const shadow = world.add.image(x, y - 2, 'fx-shadow').setScale(...SHADOW).setAlpha(SHADOW_ALPHA).setDepth(DEPTH - 1);
  const sprite = world.add.sprite(x, y, lookTexture(world, meta), 'down-stand').setOrigin(0.5, 1).setScale(CHAR_SCALE).setDepth(DEPTH);
  setFrame(sprite, facing);
  const label = world.add.text(x, y - CHAR_HEIGHT - 4, meta.name || 'Người chơi', textStyle(13, '#ffffff', {
    fontStyle: 'bold', backgroundColor: 'rgba(20,26,44,0.75)', padding: { x: 6, y: 2 },
  })).setOrigin(0.5, 1).setDepth(DEPTH + 2);
  // pos: ô cuối cùng đã biết (đích của hàng đợi); mover: chỗ đang vẽ (px); queue: các bước chưa đi (game/movePath.js)
  const o = {
    meta, pos, facing, endFacing: facing, sprite, shadow, label, lastTap: 0, moving: false, walking: false,
    mover: { x, y }, queue: [], at: pos, moveAt: meta.moveAt ?? 0, gap: MOVE_GAP,
  };
  applyVehicle(world, o);
  applyStatus(world, o);
  sprite.setInteractive({ useHandCursor: true });
  sprite.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation();
    const now = performance.now();
    const double = now - o.lastTap < DOUBLE_TAP_MS;
    o.lastTap = now;
    if (p.rightButtonDown() || double) {
      o.lastTap = 0;
      openPlayerMenu(world, o);
    }
  });
  world.others.set(meta.id, o);
}

function removeOther(world, id) {
  const o = world.others.get(id);
  if (!o) return;
  world.tweens.killTweensOf(o.mover);
  if (o.fol) world.tweens.killTweensOf(o.fol.ground);
  o.queue = [];
  for (const part of [o.sprite, o.shadow, o.label, o.mount, o.mountOver, o.tag, o.fol?.sprite, o.fol?.shadow]) part?.destroy();
  world.others.delete(id);
}

// ---------- Tag trên đầu: đang đấu / AFK ----------

function applyStatus(world, o) {
  const status = o.meta.status ?? null;
  if (status === o.status) return;
  o.status = status;
  if (!status) {
    o.tag?.setVisible(false);
    return;
  }
  o.tag ??= world.add.text(0, 0, '', textStyle(12, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5, 1).setDepth(DEPTH + 2.1);
  if (status === 'battle') {
    o.tag.setText('⚔ Đang đấu').setStyle({ backgroundColor: 'rgba(170,40,40,0.9)', color: '#ffffff', fontStyle: 'bold', fontSize: '12px' })
      .setStroke('#000000', 0).setPadding(6, 2, 6, 2);
  } else {
    o.tag.setText('z z Z').setStyle({ backgroundColor: null, color: '#dfe6ff', fontStyle: 'bold italic', fontSize: '16px' })
      .setStroke('#1a2238', 4).setPadding(0, 0, 0, 0);
  }
  o.tag.setVisible(true);
}

// Đặt tag ngay trên tên (tên đang ẩn thì vẫn đặt ở chỗ đó). AFK: chữ z nhấp nhô lên xuống như đang ngủ
function placeTag(o, now) {
  if (!o.tag?.visible) return;
  const top = o.label.y - o.label.height - 3;
  if (o.status === 'afk') {
    o.tag.setPosition(o.label.x + 14, top - 2 + Math.sin(now / 420) * 3).setAlpha(0.65 + 0.35 * Math.sin(now / 420));
  } else {
    o.tag.setPosition(o.label.x, top).setAlpha(1);
  }
}

// ---------- Pokémon đi theo người chơi khác ----------

function faceMon(sprite, dir) {
  if (!sprite.texture.has(dir === 'up' ? 'up' : 'down')) return;
  sprite.setFrame(dir === 'left' || dir === 'right' ? 'side' : dir);
  sprite.setFlipX(dir === 'right');
}

// Theo thông tin của người đó (meta.follower) và cách di chuyển (đi xe / cưỡi / lướt nước thì không có Pokémon đi theo)
function applyFollower(world, o) {
  const info = o.meta.follower;
  const want = Boolean(info?.s) && !o.vehicle && typeof world.followerTexture === 'function';
  if (!want) {
    if (o.fol) o.fol.want = false;
    return;
  }
  const key = `${info.s}|${info.sh ? 1 : 0}`;
  if (!o.fol) {
    // Lần đầu: đứng sau lưng người đó (ô đó bị chặn thì nấp chung ô, bước đầu tiên mới hiện ra)
    const [bx, by] = BACK[o.facing] ?? [0, -1];
    const behind = { x: o.at.x + bx, y: o.at.y + by };
    const tucked = Boolean(world.isBlocked?.(behind.x, behind.y));
    const cell = tucked ? { ...o.at } : behind;
    const [gx, gy] = cellCenter(cell);
    o.fol = {
      cell, tucked, facing: o.facing, ground: { x: gx, y: gy }, key: null,
      shadow: world.add.image(gx, gy - 4, 'fx-shadow').setScale(...FOLLOWER_SHADOW).setAlpha(SHADOW_ALPHA).setDepth(DEPTH - 1),
      sprite: world.add.sprite(gx, gy, 'fx-shadow').setOrigin(0.5, 1).setScale(CHAR_SCALE * FOLLOWER_SCALE).setDepth(DEPTH),
    };
  }
  o.fol.want = true;
  if (o.fol.key !== key) {
    o.fol.key = key;
    o.fol.style = followStyle(info.s);
    o.fol.sprite.setTexture(world.followerTexture(info.s, Boolean(info.sh)));
    faceMon(o.fol.sprite, o.fol.facing);
  }
}

// Người đó vừa bước từ ô prev: Pokémon bước vào ô prev cùng nhịp (ms)
function followerStep(world, o, prev, ms) {
  const f = o.fol;
  if (!f) return;
  const from = f.cell;
  f.cell = { ...prev };
  f.tucked = false;
  if (from.x !== prev.x || from.y !== prev.y) {
    f.facing = stepFacing(from, prev, f.facing);
    faceMon(f.sprite, f.facing);
  }
  const [x, y] = cellCenter(prev);
  world.tweens.killTweensOf(f.ground);
  world.tweens.add({ targets: f.ground, x, y, duration: ms });
}

// Người đó vào cửa / dịch chuyển: Pokémon nấp chung ô, bước tiếp theo mới hiện ra
function followerJump(world, o, cell) {
  const f = o.fol;
  if (!f) return;
  world.tweens.killTweensOf(f.ground);
  f.cell = { ...cell };
  f.tucked = true;
  [f.ground.x, f.ground.y] = cellCenter(cell);
}

// Mỗi khung hình: loài bay / lơ lửng thì bay cao hơn mặt đất và bồng bềnh, bóng dưới đất nhỏ lại
function placeFollower(o, now) {
  const f = o.fol;
  if (!f) return;
  const show = f.want && !f.tucked;
  f.sprite.setVisible(show);
  f.shadow.setVisible(show);
  if (!show) return;
  const { x, y } = f.ground;
  const lift = f.style === 'fly' ? FOLLOWER_FLY + Math.sin(now / 300) * 2 * CHAR_SCALE
    : f.style === 'float' ? FOLLOWER_FLOAT + Math.sin(now / 520) * 2.5 * CHAR_SCALE : 0;
  f.sprite.setPosition(x, y - 2 - lift).setDepth(DEPTH - 0.001);
  const far = Math.min(1, lift / (FOLLOWER_FLY * 1.5));
  f.shadow.setPosition(x, y - 4).setScale(FOLLOWER_SHADOW[0] * (1 - far * 0.35), FOLLOWER_SHADOW[1] * (1 - far * 0.35));
}

// Đặt hình, bóng, tên theo chỗ đang vẽ (o.mover); đang cưỡi thì placeMount đặt cả người ngồi và tên
function placeOther(world, o) {
  const { x, y } = o.mover;
  o.sprite.setPosition(x, y);
  o.shadow.setPosition(x, y - 2);
  if (o.art) placeMount(o, world.time.now);
  else o.label.setPosition(x, y - CHAR_HEIGHT - 4);
}

// Tin bước đi của người kia: xếp các bước vào hàng đợi rồi đi lần lượt (bước sang ô kề bên thì đi mượt, chân trái / phải;
// vào cửa / dịch chuyển thì hiện luôn ở chỗ mới). Chỉ quay mặt: quay ngay nếu đang đứng, đang đi thì quay khi đi xong
function moveOther(world, id, pos) {
  const o = world.others?.get(id);
  if (!o) return;
  if ((pos.vehicle ?? null) !== o.vehicle || (pos.rideArt ?? null) !== (o.meta.rideArt ?? null)) {
    o.meta = { ...o.meta, vehicle: pos.vehicle ?? null, rideArt: pos.rideArt ?? null };
    applyVehicle(world, o);
  }
  if (pos.facing) o.endFacing = pos.facing;
  if (Number.isFinite(pos.moveAt)) o.moveAt = Math.max(o.moveAt ?? 0, pos.moveAt);
  if (Number.isFinite(pos.gap)) o.gap = pos.gap;
  const steps = planSteps(o.pos, pos);
  if (steps.length) o.pos = { x: steps.at(-1).x, y: steps.at(-1).y };
  // Giữ tối đa chừng 2 tin + vài bước (gửi thưa / đi nhanh thì mỗi tin chở nhiều bước hơn)
  o.queue = trimQueue([...o.queue, ...steps], batchOf(o) * 2 + 4);
  if (!o.walking) walkNext(world, o);
}

function walkNext(world, o) {
  if (world.others?.get(o.meta.id) !== o) return; // người đó đã rời bản đồ
  const step = o.queue.shift();
  if (!step) {
    o.walking = false;
    o.moving = false;
    o.facing = o.endFacing ?? o.facing;
    setFrame(o.sprite, o.facing);
    placeOther(world, o);
    return;
  }
  const [x, y] = cellCenter(step);
  if (step.jump) {
    o.at = step;
    o.mover.x = x;
    o.mover.y = y;
    followerJump(world, o, step);
    placeOther(world, o);
    walkNext(world, o);
    return;
  }
  o.facing = stepFacing(o.at ?? step, step, o.facing);
  const prev = o.at ?? step;
  o.at = step;
  o.walking = true;
  o.moving = true;
  o.foot = o.foot === 'left' ? 'right' : 'left';
  setFrame(o.sprite, o.facing, o.art ? 'stand' : o.foot);
  // Sắp hết hàng (tin sau chưa tới): đi chậm lại chút; dồn hơn một tin: đi nhanh lên cho kịp
  const left = o.queue.length;
  const ms = stepMs(o) * (left === 0 ? 1.15 : left > batchOf(o) + 1 ? 0.7 : 1);
  followerStep(world, o, prev, ms);
  world.tweens.add({
    targets: o.mover, x, y, duration: ms,
    onUpdate: () => placeOther(world, o),
    onComplete: () => walkNext(world, o),
  });
}

// Menu nhỏ cạnh người chơi được chọn: Xem chi tiết / Giao dịch. Đặt sát bên phải nhân vật (hết chỗ thì bên trái), không che
// nhân vật / tên, luôn nằm trọn trong màn hình
function openPlayerMenu(world, o) {
  if (!world.freeForInput() || world.moving) return;
  world.runEvent(async () => {
    const w = 220;
    const h = 30 + 2 * 56;
    const cam = world.cameras.main;
    const zoom = cam.zoom || 1;
    const sx = (o.sprite.x - cam.worldView.x) * zoom; // chân nhân vật trên màn hình (px game)
    const sy = (o.sprite.y - cam.worldView.y) * zoom;
    const half = (o.sprite.displayWidth / 2) * zoom;
    const ox = uiX(world); // menu ghim theo khung 960x720 nằm giữa
    const minX = 8 - ox;
    const maxX = world.scale.width - ox - w - 8;
    let x = sx + half + 10 - ox;
    if (x > maxX) x = sx - half - 10 - w - ox;
    x = Math.max(minX, Math.min(maxX, x));
    const y = Math.max(8, Math.min(720 - h - 8, sy - (CHAR_HEIGHT * zoom) / 2 - h / 2));
    const choice = await new Menu(world, world.router, {
      x, y, width: w, height: h, fixed: true, depth: 140, title: null,
      items: [{ label: 'Xem chi tiết', value: 'info' }, { label: 'Giao dịch', value: 'trade' }],
    }).open();
    if (!world.others?.has(o.meta.id)) return; // người đó vừa rời bản đồ
    if (choice === 'info') await showTrainerCard(world, world.router, o.sprite.texture.key, { other: o.meta });
    else if (choice === 'trade') await requestTrade(world, o.meta);
  });
}
