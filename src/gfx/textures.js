import Phaser from 'phaser';
import { SPECIES } from '../data/monsters.js';
import { DEX } from '../data/pokedex.js';
import { TYPES } from '../data/types.js';
import { shade } from '../ui/helpers.js';
import { makePlayerTexture } from './player.js';
import { buildWorldTextures } from './world.js';

// Tạo mọi texture vẽ bằng code. Texture nào đã được nạp từ file (PNG/SVG, xem BootScene)
// thì giữ nguyên, không vẽ đè. Hình Pokémon vẽ ở đây chỉ là dự phòng khi thiếu file.

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
    g.fillStyle(sp.color);
    g.fillTriangle(46, 50, 60, 46, 57, 36);
    g.fillStyle(0xff5a1f);
    g.fillTriangle(52, 34, 57, 14, 63, 34);
    g.fillCircle(57, 33, 6);
    g.fillStyle(0xffd34d);
    g.fillTriangle(55, 34, 57, 24, 60, 34);
  },
  shell(g) {
    g.fillStyle(0x5a3a1a);
    g.fillEllipse(32, 44, 56, 42);
    g.fillStyle(0xb07a3e);
    g.fillEllipse(32, 44, 52, 38);
  },
  curlyTail(g, sp) {
    g.fillStyle(sp.color);
    g.fillCircle(57, 52, 6);
    g.fillStyle(shade(sp.color, -25));
    g.fillCircle(57, 52, 3);
  },
  bulb(g) {
    g.fillStyle(0x1f6a3a);
    g.fillEllipse(34, 24, 34, 28);
    g.fillStyle(0x2f9a52);
    g.fillEllipse(34, 24, 30, 24);
    g.fillStyle(0x5cc47a);
    g.fillEllipse(28, 19, 10, 7);
    g.fillStyle(0x1f6a3a);
    g.fillRect(33, 13, 2, 20);
  },
  wings(g, sp) {
    g.fillStyle(shade(sp.color, -25));
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
  leaves(g) {
    g.fillStyle(0x2f8a3a);
    for (const [x1, y1, x2, y2, x3, y3] of [
      [29, 27, 4, 20, 9, 11], [35, 27, 60, 20, 55, 11],
      [30, 25, 11, 6, 20, 2], [34, 25, 53, 6, 44, 2], [31, 25, 27, 0, 37, 0],
    ]) g.fillTriangle(x1, y1, x2, y2, x3, y3);
    g.fillStyle(0x4fb05a);
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

function makeMonsters(scene) {
  for (const p of DEX) {
    const sp = SPECIES[p.slug] ?? { color: TYPES[p.types[0]].color, features: [] };
    make(scene, `mon-${p.slug}`, 64, 64, (g) => drawMonster(g, sp), Phaser.Textures.FilterMode.NEAREST);
  }
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
  make(scene, 'fx-shadow', 128, 32, (g) => {
    g.fillStyle(0x000000);
    g.fillEllipse(64, 16, 128, 32);
  });
  // Bình thuốc xịt, màu theo loại
  for (const [key, color] of [['item-potion', 0xa050d0], ['item-super-potion', 0xf0a020], ['item-hyper-potion', 0xf05890]]) {
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
  make(scene, 'fx-leaf', 4, 4, (g) => {
    g.fillStyle(0xffffff);
    g.fillRect(0, 0, 4, 4);
  }, Phaser.Textures.FilterMode.NEAREST);
}

export function generateTextures(scene) {
  buildWorldTextures(scene);
  makePlayerTexture(scene);
  makeMonsters(scene);
  makeEffects(scene);
}
