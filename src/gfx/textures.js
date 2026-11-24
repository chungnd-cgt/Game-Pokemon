import Phaser from 'phaser';
import { BADGES } from '../data/badges.js';
import { ITEMS } from '../data/items.js';
import { SPECIES } from '../data/monsters.js';
import { DEX } from '../data/pokedex.js';
import { SHINY } from '../data/shiny.js';
import { TYPES } from '../data/types.js';
import { shade } from '../ui/helpers.js';
import { makeBerryTextures } from './berries.js';
import { makeFieldTextures } from './fieldObjects.js';
import { makeGymObjects } from './gymObjects.js';
import { makeItemIcons } from './itemIcons.js';
import { hasMonSvg, monImage } from './monImages.js';
import { makeMoveTextures } from './moveFx.js';
import { PixelBuffer, addCanvasTexture, fitCanvas, hexToHsl, recolorHues, shiftHue, smoothPixelArt, spriteFromImage } from './pixel.js';
import { makePlayerTexture } from './player.js';
import { buildWorldTextures } from './world.js';

// Tạo mọi texture vẽ bằng code. Texture nào đã được nạp từ file (PNG/SVG, xem BootScene)
// thì giữ nguyên, không vẽ đè. Hình Pokémon vẽ ở đây chỉ là dự phòng khi thiếu file.

// Shiny: mỗi loài có bảng màu shiny riêng (data/shiny.js, xem shinyImage). Loài chưa khai báo thì xoay sắc độ cả hình.
const SHINY_HUE = 150;

// Hình Pokémon dùng trong game (trận đấu, Pokédex, đội hình, túi đồ...), tạo một lần rồi dùng lại.
// Mặc định vẽ MỊN từ hình SVG gốc (thu nhỏ có làm mịn, lọc tuyến tính khi phóng to) để cùng kiểu với ảnh PNG Pokémon
// người dùng thêm và giao diện, không còn pixel GBA thô. opts.pixel: sprite kiểu GBA (Gen 3) size x size pixel, tối đa 15
// màu (gfx/pixel.js: spriteFromImage), dùng cho icon pixel nhỏ (vd icon thú cưỡi trong túi đồ).
// size: cỡ gốc (64 như sprite trận đấu GBA); hình mịn vẽ ở độ phân giải gấp 3 (tối thiểu 96 px) cho nét khi phóng to.
// Mọi chỗ dùng đều co bằng fitScale nên độ phân giải texture không đổi kích thước hiển thị.
// view: '' mặt trước, '-back' lưng, '-side' nghiêng. Ảnh PNG thật do người dùng thêm vào thì giữ nguyên.
export const GBA_MON = 64;
export function pixelMon(scene, speciesId, view = '', size = GBA_MON, shiny = false, { pixel = false } = {}) {
  const base = monViewKey(scene, speciesId, view);
  const png = scene.registry.get('pngSprites')?.includes(base);
  if (png && !shiny) return base;
  const res = Math.max(96, size * 3);
  const key = png ? `${base}-shiny` : pixel ? `px${size}-${base}${shiny ? '-shiny' : ''}` : `hd${res}-${base}${shiny ? '-shiny' : ''}`;
  if (!scene.textures.exists(key)) {
    // Hình SVG chưa nạp xong (không xảy ra trong game: TitleScene chờ nạp hết mới vào): hình trống, không lưu lại
    if (!monSourceReady(scene, base)) return '__DEFAULT';
    const image = shiny ? shinyImage(scene, base, speciesId, png) : monSource(scene, base);
    if (png) addCanvasTexture(scene, key, image);
    else if (pixel) addCanvasTexture(scene, key, spriteFromImage(image, size));
    else addCanvasTexture(scene, key, fitCanvas(image, res)).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return key;
}

// Key ảnh gốc dùng cho hướng view của loài. Loài có ảnh PNG người dùng thêm: chỉ dùng PNG (chỉ cần 1 ảnh mặt trước;
// hướng khác không có PNG riêng thì dùng mặt trước, chỗ dùng tự lật ngang), không trộn với hình SVG khác kiểu.
// Loài khác: hình SVG hướng đó nếu có, không thì mặt trước
export function monViewKey(scene, speciesId, view = '') {
  const front = `mon-${speciesId}`;
  const wanted = `${front}${view}`;
  const pngs = scene.registry.get('pngSprites') ?? [];
  if (pngs.includes(front)) return pngs.includes(wanted) ? wanted : front;
  return monSourceExists(scene, wanted) ? wanted : front;
}

// Ảnh gốc hình Pokémon theo key 'mon-<loài>[-back|-side]': SVG (gfx/monImages.js, không nằm trong bộ texture của Phaser),
// PNG thật do người dùng thêm (BootScene) hoặc hình vẽ dự phòng bằng code (makeMonsters)
export const monSourceExists = (scene, key) => hasMonSvg(key) || scene.textures.exists(key);
const monSourceReady = (scene, key) => Boolean(monImage(key)) || scene.textures.exists(key);
export const monSource = (scene, key) => monImage(key) ?? scene.textures.get(key).getSourceImage();

// Hệ số phóng to để cạnh dài nhất của texture bằng `size` px
export function fitScale(scene, key, size) {
  const img = scene.textures.get(key).getSourceImage();
  return size / Math.max(img.width, img.height);
}

function make(scene, key, w, h, draw, filter = Phaser.Textures.FilterMode.LINEAR) {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
  scene.textures.get(key).setFilter(filter);
}

// Đặc điểm nhận dạng vẽ phía sau thân (tai, đuôi, mai, cánh...)
const BEHIND = {
  flameTail(g, sp) {
    const [outer, inner] = sp.flame ?? [0xff5a1f, 0xffd34d];
    g.fillStyle(sp.color);
    g.fillTriangle(46, 50, 60, 46, 57, 36);
    g.fillStyle(outer);
    g.fillTriangle(52, 34, 57, 14, 63, 34);
    g.fillCircle(57, 33, 6);
    g.fillStyle(inner);
    g.fillTriangle(55, 34, 57, 24, 60, 34);
  },
  shell(g, sp) {
    g.fillStyle(sp.shell ? shade(sp.shell, -50) : 0x5a3a1a);
    g.fillEllipse(32, 44, 56, 42);
    g.fillStyle(sp.shell ?? 0xb07a3e);
    g.fillEllipse(32, 44, 52, 38);
  },
  curlyTail(g, sp) {
    g.fillStyle(sp.color);
    g.fillCircle(57, 52, 6);
    g.fillStyle(shade(sp.color, -25));
    g.fillCircle(57, 52, 3);
  },
  bulb(g, sp) {
    const [dark, mid, light] = sp.bulb ?? [0x1f6a3a, 0x2f9a52, 0x5cc47a];
    g.fillStyle(dark);
    g.fillEllipse(34, 24, 34, 28);
    g.fillStyle(mid);
    g.fillEllipse(34, 24, 30, 24);
    g.fillStyle(light);
    g.fillEllipse(28, 19, 10, 7);
    g.fillStyle(dark);
    g.fillRect(33, 13, 2, 20);
  },
  wings(g, sp) {
    g.fillStyle(sp.wing ?? shade(sp.color, -25));
    g.fillEllipse(10, 40, 18, 26);
    g.fillEllipse(54, 40, 18, 26);
  },
  crest(g, sp) {
    g.fillStyle(shade(sp.color, -30));
    g.fillTriangle(25, 27, 20, 9, 33, 24);
    g.fillTriangle(30, 26, 31, 6, 38, 24);
  },
  tadpoleTail(g) {
    g.fillStyle(0xd8e2ff);
    g.fillTriangle(46, 46, 63, 32, 63, 60);
  },
  zigzagTail(g, sp) {
    g.fillStyle(0x8a5a2b);
    g.fillTriangle(42, 44, 48, 46, 47, 38);
    g.fillStyle(shade(sp.color, -10));
    g.fillPoints([
      { x: 44, y: 44 }, { x: 56, y: 34 }, { x: 50, y: 32 }, { x: 62, y: 12 },
      { x: 44, y: 28 }, { x: 51, y: 30 }, { x: 41, y: 40 },
    ], true);
  },
  longEars(g, sp) {
    g.fillStyle(sp.color);
    g.fillTriangle(17, 32, 8, 1, 28, 25);
    g.fillTriangle(47, 32, 56, 1, 36, 25);
    g.fillStyle(0x222222);
    g.fillTriangle(8, 1, 11, 10, 15, 8);
    g.fillTriangle(56, 1, 53, 10, 49, 8);
  },
  bigEars(g, sp) {
    g.fillStyle(sp.color);
    g.fillCircle(15, 22, 10);
    g.fillCircle(49, 22, 10);
    g.fillStyle(0xe8b0c8);
    g.fillCircle(15, 22, 6);
    g.fillCircle(49, 22, 6);
  },
  roundEars(g, sp) {
    g.fillStyle(shade(sp.color, -15));
    g.fillTriangle(13, 33, 15, 13, 28, 26);
    g.fillTriangle(51, 33, 49, 13, 36, 26);
  },
  fluff(g, sp) {
    g.fillStyle(sp.belly);
    g.fillTriangle(25, 28, 32, 13, 39, 28);
  },
  leaves(g, sp) {
    g.fillStyle(sp.leaf ?? 0x2f8a3a);
    for (const [x1, y1, x2, y2, x3, y3] of [
      [29, 27, 4, 20, 9, 11], [35, 27, 60, 20, 55, 11],
      [30, 25, 11, 6, 20, 2], [34, 25, 53, 6, 44, 2], [31, 25, 27, 0, 37, 0],
    ]) g.fillTriangle(x1, y1, x2, y2, x3, y3);
    g.fillStyle(sp.leaf ? shade(sp.leaf, 20) : 0x4fb05a);
    g.fillTriangle(30, 25, 29, 6, 35, 6);
  },
};

// Đặc điểm vẽ đè lên thân (đốm, răng, má, sọc...)
const FRONT = {
  spots(g, sp) {
    g.fillStyle(shade(sp.color, -30));
    g.fillCircle(19, 44, 3);
    g.fillCircle(45, 46, 3);
    g.fillCircle(24, 31, 2);
  },
  teeth(g) {
    g.fillStyle(0xffffff);
    g.fillRect(29, 47, 3, 5);
    g.fillRect(32, 47, 3, 5);
  },
  whiskers(g) {
    g.fillStyle(0x333333);
    g.fillRect(6, 44, 11, 1);
    g.fillRect(6, 47, 11, 1);
    g.fillRect(47, 44, 11, 1);
    g.fillRect(47, 47, 11, 1);
  },
  beak(g) {
    g.fillStyle(0x6a4a2a);
    g.fillTriangle(28, 42, 36, 42, 32, 50);
    g.fillStyle(0xe8b060);
    g.fillTriangle(29, 42, 35, 42, 32, 48);
  },
  cheeks(g) {
    g.fillStyle(0xe03a3a);
    g.fillCircle(17, 45, 4);
    g.fillCircle(47, 45, 4);
  },
  swirl(g) {
    g.lineStyle(2, 0x222222);
    g.beginPath();
    g.arc(32, 50, 8, 0, Math.PI * 1.5);
    g.strokePath();
    g.beginPath();
    g.arc(32, 50, 4, Math.PI * 1.5, Math.PI * 3);
    g.strokePath();
  },
  stripes(g) {
    g.fillStyle(0x222222);
    g.fillTriangle(12, 39, 21, 37, 19, 42);
    g.fillTriangle(52, 39, 43, 37, 45, 42);
    g.fillTriangle(13, 48, 22, 46, 20, 51);
    g.fillTriangle(51, 48, 42, 46, 44, 51);
  },
};

const NO_MOUTH = ['beak', 'swirl', 'teeth'];

function drawMonster(g, sp) {
  const features = sp.features ?? [];
  for (const f of features) BEHIND[f]?.(g, sp);

  g.fillStyle(0x2a2a2a);
  g.fillEllipse(32, 42, 46, 38);
  g.fillStyle(sp.color);
  g.fillEllipse(32, 42, 42, 34);
  g.fillStyle(sp.belly ?? shade(sp.color, 25));
  g.fillEllipse(32, 49, 26, 17);
  g.fillStyle(shade(sp.color, -25));
  g.fillEllipse(21, 59, 13, 6);
  g.fillEllipse(43, 59, 13, 6);

  for (const f of features) FRONT[f]?.(g, sp);

  g.fillStyle(0xffffff);
  g.fillCircle(25, 37, 5);
  g.fillCircle(39, 37, 5);
  g.fillStyle(features.includes('redEyes') ? 0xc02020 : 0x111111);
  g.fillCircle(26, 38, 3);
  g.fillCircle(40, 38, 3);
  g.fillStyle(0xffffff);
  g.fillCircle(27, 37, 1);
  g.fillCircle(41, 37, 1);
  if (!features.some((f) => NO_MOUTH.includes(f))) {
    g.fillStyle(0x7a2a2a);
    g.fillRect(30, 45, 4, 2);
  }
}

// Hình Pokémon vẽ bằng code (loài chưa có file PNG / SVG)
const DRAWN = new Set();

function makeMonsters(scene) {
  for (const p of DEX) {
    const sp = SPECIES[p.slug] ?? { color: TYPES[p.types[0]].color, features: [] };
    const key = `mon-${p.slug}`;
    // Loài đã có hình SVG (nạp ngầm sau, gfx/monImages.js) hoặc PNG thì không cần hình vẽ dự phòng
    if (monSourceExists(scene, key)) continue;
    DRAWN.add(key);
    make(scene, key, 64, 64, (g) => drawMonster(g, sp), Phaser.Textures.FilterMode.NEAREST);
  }
}

// Ảnh gốc bản shiny của texture key (vd 'mon-pikachu', 'mon-pikachu-back'), theo bảng màu shiny trong data/shiny.js:
// hình vẽ bằng code thì vẽ lại với màu shiny; hình từ file thì đổi màu theo vùng sắc độ (luật rules, hoặc suy ra từ
// màu thân / bụng của loài). Loài chưa khai báo màu shiny thì xoay sắc độ cả hình.
// png: ảnh PNG người dùng thêm (src/assets/pokemon), luật đổi màu dò lại theo màu thật của ảnh (gfx/pixel.js: adaptRules)
export function shinyImage(scene, key, speciesId, png = false) {
  const sp = SPECIES[speciesId];
  const shiny = SHINY[speciesId];
  if (DRAWN.has(key) && sp && shiny && !shiny.rules) {
    const drawnKey = `${key}-shiny-src`;
    make(scene, drawnKey, 64, 64, (g) => drawMonster(g, { ...sp, ...shiny }), Phaser.Textures.FilterMode.NEAREST);
    return scene.textures.get(drawnKey).getSourceImage();
  }
  const image = monSource(scene, key);
  const rules = shinyRules(speciesId);
  return rules.length ? recolorHues(image, rules, png) : shiftHue(image, SHINY_HUE);
}

export function shinyRules(speciesId) {
  const sp = SPECIES[speciesId];
  const shiny = SHINY[speciesId];
  if (!shiny) return [];
  const pairs = shiny.rules ?? [[sp.color, shiny.color], [sp.belly, shiny.belly]].filter(([from, to]) => from != null && to != null);
  return pairs.map(([from, to, opts = {}]) => ({
    from: hexToHsl(from), to: hexToHsl(to), hue: opts.hue ?? 22, light: opts.light ?? 0.3,
  }));
}

function makeEffects(scene) {
  make(scene, 'ball', 64, 64, (g) => {
    g.fillStyle(0x222222);
    g.fillCircle(32, 32, 31);
    g.fillStyle(0xffffff);
    g.fillCircle(32, 32, 27);
    g.fillStyle(0xe53935);
    g.slice(32, 32, 27, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0x222222);
    g.fillRect(2, 29, 60, 6);
    g.fillCircle(32, 32, 10);
    g.fillStyle(0xffffff);
    g.fillCircle(32, 32, 6);
  });
  make(scene, 'fx-circle', 64, 64, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(32, 32, 32);
  });
  make(scene, 'fx-ring', 64, 64, (g) => {
    g.lineStyle(5, 0xffffff);
    g.strokeCircle(32, 32, 29);
  });
  make(scene, 'fx-spark', 16, 16, (g) => {
    g.fillStyle(0xffffff);
    g.fillPoints([{ x: 8, y: 0 }, { x: 10, y: 6 }, { x: 16, y: 8 }, { x: 10, y: 10 }, { x: 8, y: 16 }, { x: 6, y: 10 }, { x: 0, y: 8 }, { x: 6, y: 6 }], true);
  });
  // Mũi tên tăng / giảm chỉ số trong trận (tô màu khi dùng, lật dọc khi giảm)
  make(scene, 'fx-arrow', 20, 24, (g) => {
    g.fillStyle(0xffffff);
    g.fillTriangle(10, 0, 20, 11, 0, 11);
    g.fillRect(6, 11, 8, 13);
  });
  make(scene, 'fx-shadow', 128, 32, (g) => {
    g.fillStyle(0x000000);
    g.fillEllipse(64, 16, 128, 32);
  });
  // Bình thuốc xịt, màu theo loại
  const sprays = [
    ['item-potion', 0xa050d0], ['item-super-potion', 0xf0a020], ['item-hyper-potion', 0xf05890],
    ['item-antidote', 0x58b858], ['item-burn-heal', 0xe8703a], ['item-paralyze-heal', 0xe8c830],
    ['item-awakening', 0x5878d8], ['item-ice-heal', 0x68c8e8], ['item-full-heal', 0xf0d860],
    ['item-repel', 0x8a58c8], ['item-super-repel', 0xe0a030], ['item-max-repel', 0x48a8d8],
  ];
  for (const [key, color] of sprays) {
    make(scene, key, 64, 64, (g) => {
      g.fillStyle(0x2b2433);
      g.fillRect(23, 4, 18, 18);
      g.fillRect(38, 7, 12, 6);
      g.fillStyle(0xd8dce4);
      g.fillRect(26, 7, 12, 14);
      g.fillRect(40, 9, 8, 2);
      g.fillStyle(0x2b2433);
      g.fillRoundedRect(12, 18, 40, 44, 12);
      g.fillStyle(color);
      g.fillRoundedRect(15, 21, 34, 38, 9);
      g.fillStyle(0xffffff);
      g.fillRoundedRect(20, 32, 24, 14, 3);
      g.fillStyle(color);
      g.fillRect(30, 35, 4, 8);
      g.fillRect(28, 37, 8, 4);
      g.fillStyle(0xffffff, 0.45);
      g.fillRoundedRect(18, 24, 6, 30, 3);
    });
  }
  make(scene, 'item-revive', 64, 64, (g) => {
    const diamond = (cx, cy, rx, ry) => [{ x: cx, y: cy - ry }, { x: cx + rx, y: cy }, { x: cx, y: cy + ry }, { x: cx - rx, y: cy }];
    g.fillStyle(0x2b2433);
    g.fillPoints(diamond(32, 32, 26, 30), true);
    g.fillStyle(0xf8c830);
    g.fillPoints(diamond(32, 32, 21, 25), true);
    g.fillStyle(0xfff0a0);
    g.fillPoints(diamond(32, 26, 10, 12), true);
    g.fillStyle(0xffffff, 0.7);
    g.fillPoints(diamond(26, 20, 4, 6), true);
  });
  // Max Revive: viên kim cương vàng lớn có vành cam, lấp lánh
  make(scene, 'item-max-revive', 64, 64, (g) => {
    const diamond = (cx, cy, rx, ry) => [{ x: cx, y: cy - ry }, { x: cx + rx, y: cy }, { x: cx, y: cy + ry }, { x: cx - rx, y: cy }];
    g.fillStyle(0x2b2433);
    g.fillPoints(diamond(32, 32, 29, 31), true);
    g.fillStyle(0xf08020);
    g.fillPoints(diamond(32, 32, 25, 27), true);
    g.fillStyle(0xf8d030);
    g.fillPoints(diamond(32, 32, 19, 21), true);
    g.fillStyle(0xfff4b0);
    g.fillPoints(diamond(32, 26, 9, 11), true);
    g.fillStyle(0xffffff, 0.8);
    g.fillPoints(diamond(26, 20, 4, 6), true);
    g.fillPoints(diamond(48, 12, 3, 5), true);
  });
  make(scene, 'fx-alert', 48, 56, (g) => {
    g.fillStyle(0x2b2433);
    g.fillRoundedRect(0, 0, 48, 46, 12);
    g.fillTriangle(16, 42, 32, 42, 24, 56);
    g.fillStyle(0xffffff);
    g.fillRoundedRect(3, 3, 42, 40, 10);
    g.fillTriangle(19, 40, 29, 40, 24, 51);
    g.fillStyle(0xe04040);
    g.fillRoundedRect(20, 8, 8, 20, 3);
    g.fillCircle(24, 35, 4.5);
  });
  make(scene, 'fx-rain', 3, 18, (g) => {
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(1, 0, 1, 6);
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(0, 6, 3, 12);
  });
  make(scene, 'fx-glow', 64, 64, (g) => {
    for (let r = 32; r > 0; r -= 2) {
      g.fillStyle(0xffffff, 0.06);
      g.fillCircle(32, 32, r);
    }
  });
  make(scene, 'fx-heart', 48, 56, (g) => {
    g.fillStyle(0x2b2433);
    g.fillRoundedRect(0, 0, 48, 46, 12);
    g.fillTriangle(16, 42, 32, 42, 24, 56);
    g.fillStyle(0xffffff);
    g.fillRoundedRect(3, 3, 42, 40, 10);
    g.fillTriangle(19, 40, 29, 40, 24, 51);
    g.fillStyle(0xf04868);
    g.fillCircle(17, 19, 8);
    g.fillCircle(31, 19, 8);
    g.fillTriangle(9.5, 22, 38.5, 22, 24, 36);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(15, 16, 2.5);
  });
  make(scene, 'fx-leaf', 4, 4, (g) => {
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 4, 4);
  }, Phaser.Textures.FilterMode.NEAREST);
}

// Poké Ball rơi trên bản đồ (vật phẩm nhặt được), pixel 12x12 kiểu Gen 5
function makeItemBall(scene) {
  const p = new PixelBuffer(12, 12);
  p.ellipse(6, 6, 5, 5, '#f4f4f4');
  p.ellipse(6, 6, 5, 5, '#e8403a', (x, y) => y < 6);
  p.recolor('#b02828', (x, y) => y < 6 && (x >= 8 || y >= 4) && p.get(x, y) === '#e8403a');
  p.recolor('#c8c8d0', (x, y) => y > 6 && x >= 8);
  p.rect(1, 6, 10, 1, '#383838');
  p.rect(5, 5, 2, 3, '#383838');
  p.set(5, 6, '#ffffff');
  p.set(6, 6, '#ffffff');
  p.set(3, 3, '#ffb0a0');
  p.set(4, 2, '#ffb0a0');
  p.outline(-0.75);
  addCanvasTexture(scene, 'item-ball', p.toCanvas());
}

// Icon buổi trong ngày cạnh đồng hồ trên HUD (vẽ 48x48, hiển thị thu nhỏ cho nét mịn):
// hud-day mặt trời vàng • hud-dusk mặt trời lặn màu cam trên đường chân trời • hud-night trăng khuyết và sao
export const HUD_PHASE_ICON = { day: 'hud-day', dusk: 'hud-dusk', night: 'hud-night' };
function makeHudIcons(scene) {
  const icon = (key, draw) => {
    if (scene.textures.exists(key)) return;
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    draw(ctx);
    scene.textures.addCanvas(key, canvas).setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  const disc = (ctx, x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const rays = (ctx, cx, cy, r0, r1, color, from, to, n) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    for (let i = 0; i < n; i++) {
      const a = from + ((to - from) * (i + 0.5)) / n;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  };
  icon('hud-day', (ctx) => {
    rays(ctx, 24, 24, 15, 21, '#ffc828', 0, Math.PI * 2, 8);
    disc(ctx, 24, 24, 11.5, '#f0a020');
    disc(ctx, 24, 24, 9.5, '#ffd84a');
    disc(ctx, 21, 21, 3, '#fff2a8');
  });
  icon('hud-dusk', (ctx) => {
    // nửa mặt trời đang lặn, tia nắng toả lên trên, đường chân trời và vệt nắng chiều
    rays(ctx, 24, 30, 15, 22, '#ff9a3a', Math.PI, Math.PI * 2, 5);
    ctx.fillStyle = '#e8601c';
    ctx.beginPath();
    ctx.arc(24, 30, 12.5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ff8a30';
    ctx.beginPath();
    ctx.arc(24, 30, 10.5, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffb860';
    ctx.fillRect(6, 31, 36, 4);
    ctx.fillStyle = '#d8682a';
    ctx.fillRect(13, 38, 22, 3);
  });
  icon('hud-night', (ctx) => {
    // trăng khuyết: đĩa trăng bị khoét một đĩa lệch lên trên bên phải, vài ngôi sao
    disc(ctx, 22, 25, 14, '#f8e8a0');
    ctx.globalCompositeOperation = 'destination-out';
    disc(ctx, 30, 19, 12, '#000');
    ctx.globalCompositeOperation = 'source-over';
    for (const [x, y, r] of [[38, 11, 2.4], [42, 25, 1.7], [34, 37, 1.5]]) disc(ctx, x, y, r, '#fff6d0');
  });
}

export function generateTextures(scene) {
  makeHudIcons(scene);
  makeMoveTextures(scene);
  buildWorldTextures(scene);
  makeItemBall(scene);
  makePlayerTexture(scene);
  makeMonsters(scene);
  makeEffects(scene);
  makeBerryTextures(scene);
  // Icon thú cưỡi dùng hình nhỏ của chính Pokémon đó: BootScene nạp trước hình các loài này (MOUNT_SPECIES)
  makeItemIcons(scene, (speciesId) => scene.textures.get(pixelMon(scene, speciesId, '', 28, false, { pixel: true })).getSourceImage());
  makeGymObjects(scene);
  makeFieldTextures(scene);
  smoothIcons(scene);
}

// Icon vật phẩm / huy hiệu vẽ pixel (cạnh dài < SMOOTH_MAX): phóng x4 kiểu Scale2x (bo mịn cạnh chéo) và lọc tuyến tính,
// cho hợp giao diện mịn (túi đồ, cửa hàng...) thay vì ô vuông GBA thô. Bóng (Poké Ball...) giữ nguyên vì cảnh ném bóng
// dùng đúng cỡ texture. Chỗ nào phóng icon theo hệ số cố định (không qua fitScale) thì nhân thêm iconUnit()
const SMOOTH_MAX = 48;
const SMOOTH_K = 4;
// Đồ vật vẽ pixel cỡ gốc trên bản đồ (WORLD_SMOOTH: cây quả mọng, đèn lồng, đá đẩy, cỏ cao...) cũng làm mịn như vậy,
// mọi cỡ; WorldScene hiển thị chúng x WORLD_SCALE * SMOOTH_UNIT
const WORLD_SMOOTH = /^(obj-|berry-|grass-front|item-ball$|fx-balloon$)/;
export const SMOOTH_UNIT = 1 / SMOOTH_K;
function smoothIcons(scene) {
  const keys = new Set([
    ...Object.values(ITEMS).filter((it) => it.kind !== 'ball').map((it) => it.icon),
    ...BADGES.filter(Boolean).map((b) => `badge-${b.id}`),
    ...scene.textures.getTextureKeys().filter((k) => WORLD_SMOOTH.test(k)),
  ]);
  for (const key of keys) {
    if (!key || !scene.textures.exists(key)) continue;
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage();
    if (tex.customData.iconUnit || !(src instanceof HTMLCanvasElement)) continue;
    if (!WORLD_SMOOTH.test(key) && Math.max(src.width, src.height) >= SMOOTH_MAX) continue;
    const smooth = addCanvasTexture(scene, key, smoothPixelArt(src));
    smooth.setFilter(Phaser.Textures.FilterMode.LINEAR);
    smooth.customData.iconUnit = 1 / SMOOTH_K;
  }
}

// Hệ số bù cho icon đã làm mịn (texture to gấp SMOOTH_K): setScale(k * iconUnit(scene, key)) hiện đúng cỡ như trước
export const iconUnit = (scene, key) => scene.textures.get(key)?.customData?.iconUnit ?? 1;
