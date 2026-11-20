import { CELL, WORLD_SCALE } from '../config.js';
import { currentLook, resolveLook } from '../data/playerCustom.js';
import { planSteps, stepFacing, trimQueue } from '../game/movePath.js';
import { playerName, state } from '../game/state.js';
import { RIDE_SEAT, rideTexture } from '../gfx/mounts.js';
import { CHAR_HEIGHT, CHAR_SCALE, makeBikeTexture, makeCharacterTexture } from '../gfx/player.js';
import { MapPresence } from '../online/presence.js';
import { supabase } from '../online/supabase.js';
import { textStyle, uiX } from '../ui/helpers.js';
import { Menu } from '../ui/Menu.js';
import { showTrainerCard } from '../ui/TrainerCard.js';
import { onTradeRequest, requestTrade } from './worldTrade.js';

// Người chơi khác trên bản đồ (online/presence.js): hình nhân vật theo diện mạo của họ, tên trên đầu, đi lại mượt theo từng
// bước (tin bước đi đến ~2 lần/giây kèm các ô đã đi qua: xếp hàng rồi đi lại đúng đường đó từng ô, sắp hết hàng thì đi
// chậm lại một chút cho khỏi đứng chờ tin sau, dồn nhiều thì đi nhanh lên). Chọn một người: chuột phải (máy tính) hoặc chạm đúp (điện thoại, chuột trái nhấn đúp cũng được) -> menu nhỏ
// "Xem chi tiết" (thẻ HLV rút gọn: không có huy hiệu, tiền, Pokédex) / "Giao dịch" (scenes/worldTrade.js).
// Người chơi khác không chặn đường (đi xuyên qua nhau được). Đi xe đạp / cưỡi Arcanine / cưỡi Lapras / lướt Surf thì
// vẽ đúng như vậy (xe đạp; người ngồi trên thú cưỡi hoặc khối nước, nhấp nhô theo sóng).

const ZOOM = WORLD_SCALE / 4;
const STEP_MS = 230;
// Thời gian một bước theo cách di chuyển (giống WorldScene), nhịp chân thú cưỡi
const VEHICLE_STEP_MS = { bike: 100, ride: 90, surf: 225, waterRide: 100 };
const MOUNT_BEAT_MS = { ride: 90, waterRide: 110, surf: 160 };
const WATER = ['surf', 'waterRide'];
const DOUBLE_TAP_MS = 350;
const DEPTH = 10;

const cellCenter = ({ x, y }) => [x * CELL + CELL / 2, (y + 1) * CELL - 4 * ZOOM];

// Thông tin của mình gửi cho người khác
function myMeta(world) {
  const user = world.registry.get('user');
  const look = currentLook(state.player);
  return {
    id: user.id, name: playerName(), gender: look.gender, look, badges: state.badges.size,
    playTime: Math.floor(state.playTime ?? 0), startedAt: state.startedAt ?? null,
  };
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
    return;
  }
  const key = rideTexture(world, art);
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
      onMove: (id, pos) => moveOther(world, id, pos),
      onRequest: (req) => onTradeRequest(world, req),
    });
  }
  world.lastSent = null;
  world.events.once('shutdown', () => {
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
  for (const o of world.others.values()) placeMount(o, now);
  if (!world.presence) return;
  const pos = myPos(world);
  const key = posKey(world, pos);
  if (key === world.lastSent) return;
  world.lastSent = key;
  world.presence.move(pos);
}

function syncPlayers(world, list) {
  if (!world.others) return;
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
      // Chỗ đứng trong presence (cập nhật khi đứng yên): sửa lại nếu lỡ mất tin bước đi
      if (!o.walking && Number.isFinite(meta.x) && (meta.x !== o.pos.x || meta.y !== o.pos.y)) moveOther(world, meta.id, meta);
    }
  }
  for (const id of [...world.others.keys()]) if (!seen.has(id)) removeOther(world, id);
}

function addOther(world, meta) {
  if (!Number.isFinite(meta.x) || !Number.isFinite(meta.y)) return;
  const pos = { x: meta.x, y: meta.y };
  const facing = meta.facing ?? 'down';
  const [x, y] = cellCenter(pos);
  const shadow = world.add.image(x, y - 2, 'fx-shadow').setScale(0.9, 0.7).setAlpha(0.25).setDepth(DEPTH - 1);
  const sprite = world.add.sprite(x, y, lookTexture(world, meta), 'down-stand').setOrigin(0.5, 1).setScale(CHAR_SCALE).setDepth(DEPTH);
  setFrame(sprite, facing);
  const label = world.add.text(x, y - CHAR_HEIGHT - 4, meta.name || 'Người chơi', textStyle(13, '#ffffff', {
    fontStyle: 'bold', backgroundColor: 'rgba(20,26,44,0.75)', padding: { x: 6, y: 2 },
  })).setOrigin(0.5, 1).setDepth(DEPTH + 2);
  // pos: ô cuối cùng đã biết (đích của hàng đợi); mover: chỗ đang vẽ (px); queue: các bước chưa đi (game/movePath.js)
  const o = {
    meta, pos, facing, endFacing: facing, sprite, shadow, label, lastTap: 0, moving: false, walking: false,
    mover: { x, y }, queue: [], at: pos,
  };
  applyVehicle(world, o);
  sprite.setInteractive({ useHandCursor: true });
  sprite.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation();
    const now = performance.now();
    const double = now - o.lastTap < DOUBLE_TAP_MS;
    o.lastTap = now;
    if (p.rightButtonDown() || double) {
      o.lastTap = 0;
      openPlayerMenu(world, o, p);
    }
  });
  world.others.set(meta.id, o);
}

function removeOther(world, id) {
  const o = world.others.get(id);
  if (!o) return;
  world.tweens.killTweensOf(o.mover);
  o.queue = [];
  for (const part of [o.sprite, o.shadow, o.label, o.mount, o.mountOver]) part?.destroy();
  world.others.delete(id);
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
  const steps = planSteps(o.pos, pos);
  if (steps.length) o.pos = { x: steps.at(-1).x, y: steps.at(-1).y };
  o.queue = trimQueue([...o.queue, ...steps]);
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
    placeOther(world, o);
    walkNext(world, o);
    return;
  }
  o.facing = stepFacing(o.at ?? step, step, o.facing);
  o.at = step;
  o.walking = true;
  o.moving = true;
  o.foot = o.foot === 'left' ? 'right' : 'left';
  setFrame(o.sprite, o.facing, o.art ? 'stand' : o.foot);
  // Sắp hết hàng (tin sau chưa tới): đi chậm lại chút; dồn nhiều bước: đi nhanh lên cho kịp
  const left = o.queue.length;
  const ms = (VEHICLE_STEP_MS[o.vehicle] ?? STEP_MS) * (left === 0 ? 1.15 : left > 4 ? 0.7 : 1);
  world.tweens.add({
    targets: o.mover, x, y, duration: ms,
    onUpdate: () => placeOther(world, o),
    onComplete: () => walkNext(world, o),
  });
}

// Menu nhỏ cạnh người chơi được chọn: Xem chi tiết / Giao dịch
function openPlayerMenu(world, o, p) {
  if (!world.freeForInput() || world.moving) return;
  world.runEvent(async () => {
    const w = 200;
    const h = 30 + 2 * 56;
    const x = Math.max(8, Math.min(960 - w - 8, p.x - uiX(world) + 12));
    const y = Math.max(8, Math.min(720 - h - 8, p.y - h / 2));
    const choice = await new Menu(world, world.router, {
      x, y, width: w, height: h, fixed: true, depth: 140, title: null,
      items: [{ label: 'Xem chi tiết', value: 'info' }, { label: 'Giao dịch', value: 'trade' }],
    }).open();
    if (!world.others?.has(o.meta.id)) return; // người đó vừa rời bản đồ
    if (choice === 'info') await showTrainerCard(world, world.router, o.sprite.texture.key, { other: o.meta });
    else if (choice === 'trade') await requestTrade(world, o.meta);
  });
}
