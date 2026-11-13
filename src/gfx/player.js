import { WORLD_SCALE } from '../config.js';
import { LOOKS, PLAYER_BASE_LOOKS } from '../data/characterLooks.js';
import { currentLook, resolveLook } from '../data/playerCustom.js';
import { addSheetTexture, makeCanvas } from './pixel.js';
import { DIRS, LH, PLAYER_FRAMES, bikerPixels, characterPixels } from './playerArt.js';

// Texture nhân vật pixel art: hình vẽ trên lưới logic 16x24 (gfx/playerArt.js), phóng to x3 (nearest) thành frame 48x72 để
// 1 pixel nhân vật = 1 pixel ô bản đồ (ô 16px hiển thị x3). Mỗi nhân vật có 3 hướng (down/up/side, side = nhìn sang trái) x 3 frame.

export { PLAYER_FRAMES };
const PIX = WORLD_SCALE; // mỗi pixel logic = PIX pixel trên texture
// Texture đã phóng to sẵn nên trên bản đồ hiển thị x1 (nhiều chỗ nhân với hằng số này)
export const CHAR_SCALE = 1;
export const CHAR_HEIGHT = LH * PIX * CHAR_SCALE;
// Trong trận đấu: frame 48x72 x 8/3 = 128x192 (mỗi pixel logic thành đúng 8px)
export const BATTLE_CHAR_SCALE = 2; // 1 điểm ảnh nhân vật = 6 điểm ảnh màn hình trong trận

// Phóng to lưới logic thành canvas (mỗi pixel thành ô PIX x PIX)
function toScaledCanvas(p) {
  const { canvas, ctx } = makeCanvas(p.w * PIX, p.h * PIX);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const c = p.data[y * p.w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * PIX, y * PIX, PIX, PIX);
    }
  }
  return canvas;
}

// Ghép các frame thành spritesheet. Texture đã có (cùng cỡ) thì vẽ lại ngay trên canvas cũ: sprite đang dùng texture đó
// (người chơi trên bản đồ, hình xem trước) tự cập nhật, không bị trỏ vào texture đã xoá
function setSheetTexture(scene, key, canvases, names) {
  const old = scene.textures.exists(key) ? scene.textures.get(key) : null;
  const { width: w, height: h } = canvases[0];
  const ctx = old?.context;
  if (ctx && old.width === w * canvases.length && old.height === h && names.every((n) => old.has(n))) {
    ctx.clearRect(0, 0, old.width, old.height);
    canvases.forEach((c, i) => ctx.drawImage(c, i * w, 0));
    old.refresh();
    return old;
  }
  return addSheetTexture(scene, key, canvases, names);
}

// Spritesheet 9 frame (`${dir}-${step}`) từ một hàm vẽ frame
function makeSheet(scene, key, draw) {
  const canvases = [];
  const names = [];
  for (const dir of DIRS) {
    for (const step of PLAYER_FRAMES) {
      canvases.push(toScaledCanvas(draw(dir, step)));
      names.push(`${dir}-${step}`);
    }
  }
  return setSheetTexture(scene, key, canvases, names);
}

export function makeCharacterTexture(scene, key, look) {
  return makeSheet(scene, key, (dir, step) => characterPixels(look, dir, step));
}

// ---------- Xe đạp ----------

const BIKE_FRAME = { player: '#d83838', 'player-f': '#38a8d8' };

export function makeBikeTexture(scene, key, look, frameColor = BIKE_FRAME.player) {
  return makeSheet(scene, key, (dir, step) => bikerPixels(look, dir, step, frameColor));
}

// Texture người chơi theo giới tính ('male' | 'female') và có đang đạp xe không
export function playerTextureKey(gender, bike = false) {
  const base = gender === 'female' ? 'player-f' : 'player';
  return bike ? `${base}-bike` : base;
}

export function makePlayerTexture(scene) {
  for (const [key, look] of Object.entries(LOOKS)) makeCharacterTexture(scene, key, look);
  for (const key of ['player', 'player-f']) makeBikeTexture(scene, `${key}-bike`, LOOKS[key], BIKE_FRAME[key]);
}

// Áp diện mạo người chơi tự chọn (data/playerCustom.js) vào nhân vật: vẽ lại texture đi bộ + đạp xe của giới tính đó
// và cập nhật LOOKS (bản 3D dựng mô hình theo LOOKS). Giới tính còn lại trở về diện mạo có sẵn (PLAYER_BASE_LOOKS).
// Gọi khi bắt đầu chơi mới, khi tải bản lưu và khi đổi diện mạo / giới tính trong game. player = { gender, look } (state.player);
// chưa có look (bản lưu cũ) thì vẽ diện mạo cũ (data/playerCustom.js: LEGACY_CUSTOM)
export function applyPlayerLook(scene, player) {
  const female = player?.gender === 'female';
  for (const [key, gender] of [['player', 'male'], ['player-f', 'female']]) {
    const mine = Boolean(player) && (gender === 'female') === female;
    const look = mine ? resolveLook(gender, currentLook(player)) : { ...PLAYER_BASE_LOOKS[gender] };
    for (const k of Object.keys(LOOKS[key])) delete LOOKS[key][k];
    Object.assign(LOOKS[key], look);
    makeCharacterTexture(scene, key, look);
    makeBikeTexture(scene, `${key}-bike`, look, BIKE_FRAME[key]);
  }
}
