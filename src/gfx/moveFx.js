import Phaser from 'phaser';
import { TYPES } from '../data/types.js';
import { tweenAsync, wait } from '../ui/helpers.js';

// Hiệu ứng chiêu thức trong trận đấu, kiểu pixel GBA:
//  - texture pixel art nhỏ (nắm đấm, lá, giọt nước, ngọn lửa, đá, bông tuyết...) phóng to x3 như sprite Pokémon
//  - các "kiểu" hiệu ứng (cào, cắn, đấm, roi mây, tia nước, sét, tia sáng...) ghép từ vài thao tác cơ bản
//  - MOVE_FX gán kiểu cho từng chiêu; chiêu chưa gán thì chọn theo hệ và loại chiêu (fxOf)
// playMoveFx chạy xong đúng lúc đòn trúng (BattleScene tính sát thương, chớp sáng, rung ngay sau đó).

const PX = 3; // 1 pixel texture = 3 pixel màn hình (như sprite Pokémon GBA 64px x3)
const DEPTH = 8.5;

// ---------- Texture ----------

// Vẽ pixel art nhỏ bằng canvas rồi cắt alpha cho mép sắc (không nhoè), lọc NEAREST khi phóng to
function pixTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] < 110 ? 0 : 255;
  ctx.putImageData(img, 0, 0);
  scene.textures.addCanvas(key, canvas).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

const fill = (ctx, color, ...rects) => {
  ctx.fillStyle = color;
  for (const [x, y, w, h] of rects) ctx.fillRect(x, y, w, h);
};
const blob = (ctx, color, x, y, rx, ry = rx) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
};
const poly = (ctx, color, pts) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
};

// Vẽ theo lưới ký tự: mỗi ký tự một pixel, màu lấy trong bảng pal ('.' bỏ trống)
const rowsTex = (scene, key, rows, pal) => pixTex(scene, key, rows[0].length, rows.length, (c) => {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (pal[ch]) fill(c, pal[ch], [x, y, 1, 1]);
  }));
});
const HAND = { K: '#202028', W: '#ffffff', G: '#c8ccd8', S: '#9aa0b4' };

export function makeMoveTextures(scene) {
  const INK = '#202028';
  // nắm đấm (nhìn chính diện: bốn ngón co lại, ngón cái vắt ngang), bàn chân (giày nhìn nghiêng), bàn tay xoè
  pixTex(scene, 'mfx-fist', 26, 24, (c) => {
    // viền: vẽ mọi khối to hơn 1.5px bằng màu viền, rồi tô trắng đè lên
    const rr = (x, y, w, h, r, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.roundRect(x, y, w, h, r);
      c.fill();
    };
    const shapes = (grow, color) => {
      for (let i = 0; i < 4; i++) rr(3 + i * 5 - grow, 3 - grow, 5 + grow * 2, 11 + grow * 2, 2.6 + grow, color); // bốn ngón co
      rr(2 - grow, 9 - grow, 22 + grow * 2, 12 + grow * 2, 5 + grow, color); // lòng bàn tay
    };
    shapes(1.5, INK);
    shapes(0, '#ffffff');
    // bóng phía dưới và bên phải
    rr(3, 17, 20, 3, 2, '#c8ccd8');
    fill(c, '#c8ccd8', [21, 10, 2, 9]);
    // khe giữa các ngón, ngón cái vắt ngang
    fill(c, INK, [8, 4, 1, 8], [13, 4, 1, 8], [18, 4, 1, 8]);
    rr(3, 12, 14, 5, 2.4, INK);
    rr(4, 13, 12, 3, 1.5, '#ffffff');
    fill(c, '#e0e4ec', [5, 15, 10, 1]);
  });
  rowsTex(scene, 'mfx-foot', [
    '..KKKKK.......',
    '..KWWWK.......',
    '..KWWWK.......',
    '..KWWWK.......',
    '..KWWWKKKKK...',
    '.KWWWWWWWWWKK.',
    '.KWWWWWWWWWWWK',
    '.KGGGGGGGGGGGK',
    '.KSSSSSSSSSSSK',
    '..KKKKKKKKKKK.',
  ], HAND);
  rowsTex(scene, 'mfx-palm', [
    '..K..K..K....',
    '.KWKKWKKWK...',
    '.KWKKWKKWK.K.',
    '.KWKKWKKWKKWK',
    '.KWWWWWWWKWWK',
    'KKWWWWWWWWWK.',
    'KWKWWWWWWWWK.',
    'KWWWWWWWWWK..',
    '.KGWWWWWWGK..',
    '..KKKKKKKK...',
  ], HAND);
  pixTex(scene, 'mfx-hit', 16, 16, (c) => {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 3.2 : 7.8;
      const a = (i / 16) * Math.PI * 2;
      pts.push([8 + Math.cos(a) * r, 8 + Math.sin(a) * r]);
    }
    poly(c, '#f8e070', pts);
    blob(c, '#ffffff', 8, 8, 3);
  });
  // hàm răng: lợi đỏ sẫm, năm chiếc răng nhọn có viền
  rowsTex(scene, 'mfx-fang', [
    'RRRRRRRRRRRRRRRRRRRRRRRRR',
    'rrrrrrrrrrrrrrrrrrrrrrrrr',
    'KKKKKKKKKKKKKKKKKKKKKKKKK',
    'KWWWKKWWWKKWWWKKWWWKKWWWK',
    'KWWWKKWWWKKWWWKKWWWKKWWWK',
    'KWWWKKWWWKKWWWKKWWWKKWWWK',
    '.KWK..KWK..KWK..KWK..KWK.',
    '.KWK..KWK..KWK..KWK..KWK.',
    '..K....K....K....K....K..',
  ], { R: '#8a2030', r: '#c84050', K: '#202028', W: '#ffffff' });
  pixTex(scene, 'mfx-leaf', 9, 5, (c) => {
    blob(c, '#2f7a30', 4.5, 2.5, 4.5, 2.5);
    blob(c, '#68c050', 4.5, 2, 3.5, 1.5);
    fill(c, '#2f7a30', [1, 2, 7, 1]);
  });
  pixTex(scene, 'mfx-petal', 6, 5, (c) => {
    blob(c, '#e86aa0', 3, 2.5, 3, 2.5);
    blob(c, '#ffc0d8', 2.5, 2, 1.5, 1);
  });
  pixTex(scene, 'mfx-drop', 6, 8, (c) => {
    poly(c, '#2a68d0', [[3, 0], [6, 5], [3, 8], [0, 5]]);
    blob(c, '#2a68d0', 3, 5, 3, 3);
    blob(c, '#58a8f8', 3, 5, 2, 2);
    fill(c, '#e0f4ff', [2, 4, 1, 1]);
  });
  pixTex(scene, 'mfx-bubble', 9, 9, (c) => {
    blob(c, '#4a98e8', 4.5, 4.5, 4.5);
    blob(c, '#c8ecff', 4.5, 4.5, 3.4);
    blob(c, '#7ac0f8', 4.5, 4.5, 2.6);
    fill(c, '#ffffff', [2, 2, 2, 2]);
  });
  pixTex(scene, 'mfx-flame', 9, 11, (c) => {
    poly(c, '#d83010', [[4.5, 0], [9, 6], [8, 10], [1, 10], [0, 6], [2.5, 3]]);
    poly(c, '#f88020', [[4.5, 3], [7.5, 7], [6.5, 10], [2.5, 10], [1.5, 7]]);
    poly(c, '#f8e060', [[4.5, 6], [6, 9], [3, 9]]);
  });
  pixTex(scene, 'mfx-wisp', 9, 11, (c) => {
    poly(c, '#3048c8', [[4.5, 0], [9, 6], [8, 10], [1, 10], [0, 6], [2.5, 3]]);
    poly(c, '#58a0f8', [[4.5, 3], [7.5, 7], [6.5, 10], [2.5, 10], [1.5, 7]]);
    poly(c, '#d8f0ff', [[4.5, 6], [6, 9], [3, 9]]);
  });
  pixTex(scene, 'mfx-star', 11, 11, (c) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.4 : 5.5;
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      pts.push([5.5 + Math.cos(a) * r, 5.8 + Math.sin(a) * r]);
    }
    poly(c, '#f8c828', pts);
    blob(c, '#fff4b0', 5.5, 5.5, 1.5);
  });
  pixTex(scene, 'mfx-rock', 11, 9, (c) => {
    poly(c, '#4a3e34', [[2, 0], [8, 0], [11, 4], [9, 9], [1, 9], [0, 4]]);
    poly(c, '#8a7a68', [[3, 1], [8, 1], [10, 4], [8, 8], [2, 8], [1, 4]]);
    fill(c, '#b8a890', [3, 2, 3, 2]);
  });
  pixTex(scene, 'mfx-gem', 7, 8, (c) => {
    poly(c, '#d02868', [[3.5, 0], [7, 3], [3.5, 8], [0, 3]]);
    poly(c, '#f878b0', [[3.5, 1], [5.5, 3], [3.5, 5], [1.5, 3]]);
  });
  pixTex(scene, 'mfx-flake', 9, 9, (c) => {
    fill(c, '#a8dcf8', [4, 0, 1, 9], [0, 4, 9, 1], [1, 1, 1, 1], [7, 1, 1, 1], [1, 7, 1, 1], [7, 7, 1, 1], [2, 2, 1, 1], [6, 2, 1, 1], [2, 6, 1, 1], [6, 6, 1, 1]);
    fill(c, '#ffffff', [3, 3, 3, 3]);
  });
  pixTex(scene, 'mfx-icicle', 5, 12, (c) => {
    poly(c, '#4a90c8', [[0, 0], [5, 0], [2.5, 12]]);
    poly(c, '#c8ecff', [[1, 0], [3, 0], [2, 7]]);
  });
  pixTex(scene, 'mfx-needle', 11, 3, (c) => {
    fill(c, '#d8d8e0', [0, 1, 8, 1]);
    poly(c, '#ffffff', [[7, 0], [11, 1.5], [7, 3]]);
  });
  pixTex(scene, 'mfx-bone', 13, 6, (c) => {
    fill(c, '#e8e0c8', [2, 2, 9, 2]);
    for (const [x, y] of [[1.5, 1.5], [1.5, 4.5], [11.5, 1.5], [11.5, 4.5]]) blob(c, '#e8e0c8', x, y, 1.5);
  });
  pixTex(scene, 'mfx-note', 8, 10, (c) => {
    blob(c, '#202028', 2.5, 8, 2.5, 2);
    fill(c, '#202028', [4, 0, 1, 8], [4, 0, 4, 2]);
  });
  pixTex(scene, 'mfx-heart', 9, 8, (c) => {
    blob(c, '#e84870', 2.5, 2.5, 2.5);
    blob(c, '#e84870', 6.5, 2.5, 2.5);
    poly(c, '#e84870', [[0, 3], [9, 3], [4.5, 8]]);
    fill(c, '#ffc0d0', [2, 1, 1, 1]);
  });
  pixTex(scene, 'mfx-feather', 9, 4, (c) => {
    blob(c, '#f0f0f8', 4.5, 2, 4.5, 2);
    fill(c, '#a0a8c0', [0, 2, 9, 1]);
  });
  // hình trắng để tô màu (tint): giọt bùn / acid, quả cầu năng lượng, bào tử, cục khói
  pixTex(scene, 'mfx-blob', 8, 7, (c) => {
    blob(c, '#ffffff', 4, 4, 4, 3);
    fill(c, '#ffffff', [3, 0, 2, 2]);
  });
  pixTex(scene, 'mfx-orb', 12, 12, (c) => {
    blob(c, '#ffffff', 6, 6, 6);
  });
  pixTex(scene, 'mfx-spore', 3, 3, (c) => fill(c, '#ffffff', [1, 0, 1, 3], [0, 1, 3, 1]));
  pixTex(scene, 'mfx-puff', 14, 12, (c) => {
    blob(c, '#ffffff', 5, 7, 5);
    blob(c, '#ffffff', 9, 6, 5);
    blob(c, '#ffffff', 7, 4, 4);
  });
}

// ---------- Kiểu hiệu ứng theo từng chiêu ----------

// [kiểu, tuỳ chọn]. color: màu chính (mặc định màu hệ của chiêu)
const T = (type) => TYPES[type].color;
const MOVE_FX = {
  // va chạm
  tackle: ['tackle'], bodySlam: ['tackle', { big: true }], takeDown: ['tackle', { big: true }], doubleEdge: ['tackle', { big: true }],
  headbutt: ['tackle'], slam: ['tackle', { big: true }], ironTail: ['tackle', { big: true, color: T('steel') }],
  quickAttack: ['dash'], extremeSpeed: ['dash', { big: true }],
  rapidSpin: ['spin'], flameWheel: ['spin', { flame: true }], rollingKick: ['spin', { icon: 'mfx-foot' }],
  spark: ['tackle', { bolts: true }], outrage: ['rage'],
  // cào, cắn, đâm
  scratch: ['claw'], slash: ['claw', { big: true }], furySwipes: ['claw'], metalClaw: ['claw', { color: 0xb8c0d0 }],
  dragonClaw: ['claw', { big: true }], crossChop: ['chop', { cross: true }], karateChop: ['chop'], brickBreak: ['chop'],
  bite: ['bite'], crunch: ['bite', { big: true }], hyperFang: ['bite', { big: true }], fireFang: ['bite', { flame: true }],
  hornAttack: ['horn'], furyAttack: ['horn'], megahorn: ['horn', { big: true }], peck: ['horn'], poisonJab: ['horn'],
  smartStrike: ['horn', { big: true }],
  // tay, chân
  pound: ['strike', { icon: 'mfx-palm' }], doubleSlap: ['strike', { icon: 'mfx-palm' }],
  megaPunch: ['strike', { icon: 'mfx-fist', big: true }], cometPunch: ['strike', { icon: 'mfx-fist' }],
  machPunch: ['strike', { icon: 'mfx-fist', fast: true }], dynamicPunch: ['strike', { icon: 'mfx-fist', big: true }],
  skyUppercut: ['strike', { icon: 'mfx-fist', up: true }], drainPunch: ['strike', { icon: 'mfx-fist', drain: true }],
  shadowPunch: ['strike', { icon: 'mfx-fist', tint: 0x7a58b8 }],
  firePunch: ['strike', { icon: 'mfx-fist', element: 'mfx-flame' }], icePunch: ['strike', { icon: 'mfx-fist', element: 'mfx-flake' }],
  thunderPunch: ['strike', { icon: 'mfx-fist', bolts: true }],
  megaKick: ['strike', { icon: 'mfx-foot', big: true }], doubleKick: ['strike', { icon: 'mfx-foot' }],
  lowKick: ['strike', { icon: 'mfx-foot', low: true }], highJumpKick: ['strike', { icon: 'mfx-foot', up: true, big: true }],
  stomp: ['strike', { icon: 'mfx-foot', down: true }],
  wrap: ['bind'], constrict: ['bind'],
  seismicToss: ['throw'], vitalThrow: ['throw'], submission: ['throw'],
  selfDestruct: ['explode'], explosion: ['explode', { big: true }],
  thief: ['darkSlash'], covet: ['darkSlash', { color: 0xf080b0 }], knockOff: ['darkSlash'], feintAttack: ['darkSlash'],
  astonish: ['ghost'], lick: ['lick'], nightShade: ['shade'],
  // cỏ
  vineWhip: ['whip'], razorLeaf: ['leaves'], petalBlizzard: ['leaves', { petal: true, big: true }],
  absorb: ['drain'], megaDrain: ['drain', { big: true }], gigaDrain: ['drain', { big: true }], leechLife: ['drain', { color: T('bug') }],
  energyBall: ['orb', { color: 0x78d050 }],
  // lửa
  ember: ['flame', { small: true }], flamethrower: ['flame'], fireBlast: ['fireBlast'], heatWave: ['heatWave'],
  // nước
  waterGun: ['water'], hydroPump: ['water', { big: true }], bubble: ['bubbles'], bubbleBeam: ['bubbles', { big: true }],
  waterPulse: ['orb', { color: 0x58a8f8, rings: true }], surf: ['wave'], waterfall: ['waterfall'],
  // điện
  thunderShock: ['bolt'], thunderbolt: ['bolt', { big: true }], thunder: ['skyBolt'], zapCannon: ['orb', { color: 0xf8d830, bolts: true }],
  // băng
  powderSnow: ['snow'], icyWind: ['snow', { wind: true }], blizzard: ['snow', { big: true, wind: true }],
  iceBeam: ['beam', { color: 0x98d8f8, flakes: true }], auroraBeam: ['beam', { rainbow: true }],
  iceShard: ['needles', { key: 'mfx-icicle', count: 3 }], icicleSpear: ['needles', { key: 'mfx-icicle', count: 2 }],
  // siêu linh, tia
  confusion: ['psywave'], psychic: ['psywave', { big: true }], psybeam: ['beam', { color: 0xf070c8, rings: true }],
  signalBeam: ['beam', { alternate: [0xe84848, 0x58c858] }], flashCannon: ['beam', { color: 0xe8ecf8 }],
  dragonPulse: ['beam', { color: 0x7a58e8, rings: true }],
  // độc
  poisonSting: ['needles', { count: 1, tint: 0xb860d8 }], acid: ['blobs', { color: 0xa848c8 }], sludge: ['blobs', { color: 0x9040b0, big: true }],
  sludgeBomb: ['orb', { color: 0x9040b0, splash: true }], smog: ['cloud', { color: 0x9060a8 }],
  // bay, gió, rồng
  gust: ['wind'], airCutter: ['wind', { blades: true }], airSlash: ['wind', { blades: true, big: true }],
  hurricane: ['tornado', { big: true }], twister: ['tornado', { color: 0x7a68d8 }], wingAttack: ['wing'],
  dragonBreath: ['flame', { color: 0x7a58e8 }], dragonRage: ['flame', { color: 0x7a58e8, big: true }],
  // đá, đất
  rockThrow: ['rocks', { count: 1 }], rockBlast: ['rocks', { count: 1 }], rockSlide: ['rockfall'], stoneEdge: ['spikes'],
  ancientPower: ['ancient'], powerGem: ['beam', { color: 0xf070a8, gems: true }],
  earthquake: ['quake'], mudSlap: ['blobs', { color: 0x8a6038 }], bonemerang: ['bone'],
  // bọ, khác
  pinMissile: ['needles', { count: 3 }], spikeCannon: ['needles', { count: 3 }], barrage: ['orb', { color: 0xe0e0e8, small: true }],
  swift: ['stars'], sonicBoom: ['sonic'], shadowBall: ['orb', { color: 0x5a3a88 }],
  // chiêu trạng thái
  growl: ['sound'], screech: ['sound', { big: true }], metalSound: ['sound', { color: 0xb8c0d0 }], supersonic: ['sound', { rings: true }],
  sing: ['sound', { notes: true }],
  leer: ['glare'], scaryFace: ['glare', { big: true }], glare: ['glare', { big: true, color: 0xf8e040 }],
  sleepPowder: ['powder', { color: 0x58c8a8 }], stunSpore: ['powder', { color: 0xf8d840 }], poisonPowder: ['powder', { color: 0xb060d8 }],
  sweetScent: ['powder', { color: 0xf8a0c8 }], poisonGas: ['cloud', { color: 0x9060a8 }], smokescreen: ['cloud', { color: 0x484858 }],
  sandAttack: ['blobs', { color: 0xc8a868, small: true }],
  attract: ['hearts'], lovelyKiss: ['hearts'], swagger: ['hearts', { color: 0xe84848 }],
  confuseRay: ['ray'], hypnosis: ['ray', { rings: true }], kinesis: ['psywave'],
  willOWisp: ['wisp'], thunderWave: ['twave'],
  tailWhip: ['wiggle'], splash: ['hop'], featherDance: ['feathers'], fakeTears: ['tears'], doubleTeam: ['afterimage'],
};

// Kiểu mặc định theo hệ khi chiêu chưa có trong bảng
const TYPE_FX = {
  fire: ['flame', { small: true }], water: ['water'], grass: ['leaves'], electric: ['bolt'], ice: ['snow'], psychic: ['psywave'],
  poison: ['blobs'], rock: ['rocks', { count: 1 }], ground: ['blobs', { color: 0x8a6038 }], flying: ['wind'], bug: ['needles'],
  ghost: ['orb', { color: 0x5a3a88 }], dragon: ['flame', { color: 0x7a58e8 }], dark: ['darkSlash'], steel: ['beam', { color: 0xd0d8e8 }],
  fighting: ['strike', { icon: 'mfx-fist' }], fairy: ['stars'],
};

export function fxOf(move) {
  if (MOVE_FX[move.id]) return MOVE_FX[move.id];
  if (move.category === 'status') return null;
  if (move.contact || move.type === 'normal') return ['tackle'];
  return TYPE_FX[move.type] ?? ['orb'];
}

// ---------- Công cụ dựng hiệu ứng ----------

const center = (sprite) => ({ x: sprite.x, y: sprite.y - sprite.displayHeight / 2 });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const rnd = (a, b) => a + Math.random() * (b - a);

class Fx {
  constructor(scene, atk, def, isPlayer, move, opt) {
    this.scene = scene;
    this.atk = atk;
    this.def = def;
    this.dir = isPlayer ? 1 : -1; // hướng từ người ra đòn tới mục tiêu theo trục x
    this.move = move;
    this.opt = opt;
    this.color = opt.color ?? TYPES[move.type]?.color ?? 0xffffff;
    this.A = center(atk);
    this.B = center(def);
    this.size = Math.max(60, def.displayHeight * 0.5); // nửa chiều cao mục tiêu: cỡ chung của hiệu ứng
    this.objs = new Set();
  }

  img(key, x, y, { scale = PX, tint = null, angle = 0, alpha = 1, depth = DEPTH, flipX = false } = {}) {
    const o = this.scene.add.image(x, y, key).setScale(scale).setAngle(angle).setAlpha(alpha).setDepth(depth).setFlipX(flipX);
    if (tint !== null) o.setTint(tint);
    this.objs.add(o);
    return o;
  }

  gfx(depth = DEPTH) {
    const g = this.scene.add.graphics().setDepth(depth);
    this.objs.add(g);
    return g;
  }

  kill(o) {
    this.objs.delete(o);
    o.destroy();
  }

  tween(cfg) {
    return tweenAsync(this.scene, cfg);
  }

  wait(ms) {
    return wait(this.scene, ms);
  }

  // Chạy một hàm vẽ theo t: 0 -> 1 trong ms mili giây
  async animate(ms, draw, ease = 'Linear') {
    const o = { t: 0 };
    draw(0);
    await this.tween({ targets: o, t: 1, duration: ms, ease, onUpdate: () => draw(o.t) });
    draw(1);
  }

  // Bay một hình từ a tới b rồi xoá (trả về promise khi tới nơi)
  fly(key, a, b, { ms = 300, scale = PX, toScale = scale, tint = null, spin = 0, arc = 0, ease = 'Quad.in', alpha = 1, keep = false, flipX = false } = {}) {
    const o = this.img(key, a.x, a.y, { scale, tint, alpha, flipX });
    const p = { t: 0 };
    return this.tween({
      targets: p, t: 1, duration: ms, ease,
      onUpdate: () => {
        const q = lerp(a, b, p.t);
        o.setPosition(q.x, q.y - Math.sin(p.t * Math.PI) * arc).setScale(scale + (toScale - scale) * p.t).setAngle(spin * p.t);
      },
    }).then(() => {
      if (!keep) this.kill(o);
      return o;
    });
  }

  // Phun nhiều hình lần lượt từ a tới b (lửa, nước, lá, sao...)
  async stream(key, a, b, { count = 8, every = 40, spread = 10, ...rest } = {}) {
    const all = [];
    for (let i = 0; i < count; i++) {
      const j = { x: rnd(-spread, spread), y: rnd(-spread, spread) };
      all.push(this.fly(key, { x: a.x + j.x * 0.3, y: a.y + j.y * 0.3 }, { x: b.x + j.x, y: b.y + j.y }, rest));
      if (i < count - 1) await this.wait(every);
    }
    await Promise.all(all);
  }

  // Bắn toả ra quanh một điểm
  burst(key, at, { count = 8, dist = 70, ms = 360, scale = PX, tint = null, spin = 180 } = {}) {
    const all = [];
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + rnd(-0.3, 0.3);
      const o = this.img(key, at.x, at.y, { scale, tint });
      all.push(this.tween({
        targets: o, x: at.x + Math.cos(a) * dist, y: at.y + Math.sin(a) * dist, angle: spin, alpha: 0, scale: scale * 0.5,
        duration: ms, ease: 'Quad.out', onComplete: () => this.kill(o),
      }));
    }
    return Promise.all(all);
  }

  // Ngôi sao va chạm kiểu truyện tranh ở chỗ trúng đòn
  hitStar(at = this.B, big = false) {
    const o = this.img('mfx-hit', at.x + rnd(-12, 12), at.y + rnd(-12, 12), { scale: PX * (big ? 1.4 : 0.9) });
    return this.tween({ targets: o, scale: PX * (big ? 2.4 : 1.7), alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => this.kill(o) });
  }

  // Người ra đòn lao tới rồi lùi lại
  lunge(dist = 46, ms = 110) {
    return this.tween({ targets: this.atk, x: this.atk.x + this.dir * dist, duration: ms, yoyo: true, ease: 'Quad.out' });
  }

  // Người ra đòn tụ lực (chiêu đặc biệt): sáng lên theo màu hệ, phồng nhẹ
  async charge(color = this.color) {
    const ring = this.img('fx-ring', this.A.x, this.A.y, { scale: 2.2, tint: color, alpha: 0.9 });
    this.atk.setTintFill(color);
    this.scene.time.delayedCall(90, () => this.atk.clearTint());
    await this.tween({ targets: ring, scale: 0.4, alpha: 0.2, duration: 220, ease: 'Quad.in' });
    this.kill(ring);
  }

  // Mục tiêu rung lắc (bị trói, bị siêu linh)
  shake(target = this.def, times = 4, dx = 8) {
    const x = target.x;
    return this.tween({ targets: target, x: x + dx, duration: 50, yoyo: true, repeat: times, onComplete: () => (target.x = x) });
  }

  // Tia sét gấp khúc giữa hai điểm, vẽ lại vài lần cho lấp loé
  async bolt(a, b, { width = 6, color = 0xf8d830, times = 4, segs = 7, jitter = 22 } = {}) {
    const g = this.gfx(DEPTH + 0.5);
    for (let k = 0; k < times; k++) {
      g.clear();
      const pts = [a];
      for (let i = 1; i < segs; i++) {
        const p = lerp(a, b, i / segs);
        pts.push({ x: p.x + rnd(-jitter, jitter), y: p.y + rnd(-jitter, jitter) });
      }
      pts.push(b);
      for (const [w, c] of [[width + 4, 0x6a4a00], [width, color], [Math.max(2, width / 3), 0xffffff]]) {
        g.lineStyle(w, c);
        g.strokePoints(pts);
      }
      await this.wait(55);
    }
    this.kill(g);
  }

  cleanup() {
    for (const o of this.objs) o.destroy();
    this.objs.clear();
  }
}

// ---------- Các kiểu hiệu ứng ----------
// Mỗi kiểu: async (fx, opt). Kết thúc đúng lúc trúng đòn.

const KINDS = {
  async tackle(fx, o) {
    await fx.lunge(o.big ? 90 : 60, o.big ? 150 : 120);
    if (o.bolts) fx.bolt({ x: fx.B.x - 40, y: fx.B.y - 30 }, { x: fx.B.x + 40, y: fx.B.y + 30 }, { width: 4, times: 3 });
    fx.hitStar(fx.B, o.big);
  },

  // Lao vút tới để lại bóng mờ phía sau
  async dash(fx, o) {
    const ghosts = [];
    for (let i = 1; i <= 3; i++) {
      const g = fx.img(fx.atk.texture.key, fx.atk.x, fx.atk.y, { scale: fx.atk.scaleX, alpha: 0.5 - i * 0.12, depth: DEPTH - 0.5, flipX: fx.atk.flipX });
      g.setOrigin(0.5, 1).setScale(fx.atk.scaleX, fx.atk.scaleY).setTint(0xc8d8ff);
      ghosts.push(g);
    }
    const dist = o.big ? 120 : 90;
    ghosts.forEach((g, i) => fx.tween({ targets: g, x: g.x + fx.dir * dist * (1 - i * 0.25), duration: 90, yoyo: true, delay: i * 20, onComplete: () => fx.kill(g) }));
    await fx.lunge(dist, 90);
    fx.hitStar(fx.B, o.big);
  },

  // Xoay tròn lao tới (Rapid Spin, Flame Wheel, Rolling Kick)
  async spin(fx, o) {
    const ring = o.flame ? fx.img('fx-ring', fx.A.x, fx.A.y, { scale: 2, tint: 0xf87820, alpha: 0.9 }) : null;
    const flames = [];
    if (o.flame) for (let i = 0; i < 6; i++) flames.push(fx.img('mfx-flame', fx.A.x, fx.A.y));
    const spinning = fx.tween({ targets: fx.atk, angle: fx.dir * 360, duration: 320, onComplete: () => fx.atk.setAngle(0) });
    const orbit = { a: 0 };
    const follow = fx.tween({
      targets: orbit, a: Math.PI * 4, duration: 320,
      onUpdate: () => {
        const c = center(fx.atk);
        ring?.setPosition(c.x, c.y);
        flames.forEach((f, i) => f.setPosition(c.x + Math.cos(orbit.a + i) * 55, c.y + Math.sin(orbit.a + i) * 55));
      },
    });
    await fx.lunge(70, 160);
    await Promise.all([spinning, follow]);
    if (o.icon) {
      const ic = fx.img(o.icon, fx.B.x, fx.B.y, { scale: PX * 1.6 });
      fx.tween({ targets: ic, scale: PX * 2.2, alpha: 0, duration: 220, onComplete: () => fx.kill(ic) });
    }
    if (ring) fx.kill(ring);
    flames.forEach((f) => fx.kill(f));
    fx.hitStar(fx.B);
  },

  // Cuồng nộ: người ra đòn chớp đỏ liên tục rồi lao tới
  async rage(fx) {
    for (let i = 0; i < 3; i++) {
      fx.atk.setTintFill(0xe83838);
      await fx.wait(70);
      fx.atk.clearTint();
      await fx.wait(50);
    }
    await fx.lunge(90, 130);
    fx.burst('mfx-flame', fx.B, { count: 6, dist: 60, tint: 0xd060f8 });
    fx.hitStar(fx.B, true);
  },

  // Ba vết cào chéo xé ngang mục tiêu
  async claw(fx, o) {
    await fx.lunge(40, 90);
    const g = fx.gfx(DEPTH + 0.5);
    const s = fx.size * (o.big ? 1.25 : 1);
    const lines = [-1, 0, 1].map((k) => ({
      a: { x: fx.B.x - s * 0.55 + k * s * 0.32, y: fx.B.y - s * 0.75 },
      b: { x: fx.B.x - s * 0.05 + k * s * 0.32, y: fx.B.y + s * 0.75 },
    }));
    await fx.animate(150, (t) => {
      g.clear();
      lines.forEach(({ a, b }, i) => {
        const p = Math.min(1, Math.max(0, t * 1.6 - i * 0.3));
        if (!p) return;
        const e = lerp(a, b, p);
        for (const [w, c] of [[13, fx.color === TYPES.normal.color ? 0xd03030 : fx.color], [6, 0xffffff]]) {
          g.lineStyle(w, c);
          g.lineBetween(a.x, a.y, e.x, e.y);
        }
      });
    });
    fx.tween({ targets: g, alpha: 0, duration: 260, onComplete: () => fx.kill(g) });
  },

  // Chặt: vạch trắng chém dọc (hoặc chữ X)
  async chop(fx, o) {
    await fx.lunge(50, 100);
    const g = fx.gfx(DEPTH + 0.5);
    const s = fx.size;
    const cuts = o.cross
      ? [[{ x: fx.B.x - s * 0.6, y: fx.B.y - s * 0.7 }, { x: fx.B.x + s * 0.6, y: fx.B.y + s * 0.7 }], [{ x: fx.B.x + s * 0.6, y: fx.B.y - s * 0.7 }, { x: fx.B.x - s * 0.6, y: fx.B.y + s * 0.7 }]]
      : [[{ x: fx.B.x + s * 0.2, y: fx.B.y - s * 0.8 }, { x: fx.B.x - s * 0.2, y: fx.B.y + s * 0.8 }]];
    await fx.animate(130, (t) => {
      g.clear();
      for (const [a, b] of cuts) {
        const e = lerp(a, b, t);
        g.lineStyle(12, 0xd88030);
        g.lineBetween(a.x, a.y, e.x, e.y);
        g.lineStyle(5, 0xffffff);
        g.lineBetween(a.x, a.y, e.x, e.y);
      }
    });
    fx.hitStar(fx.B, true);
    fx.tween({ targets: g, alpha: 0, duration: 220, onComplete: () => fx.kill(g) });
  },

  // Hai hàm răng sập lại trên mục tiêu
  async bite(fx, o) {
    await fx.lunge(40, 90);
    const sc = PX * (o.big ? 1.6 : 1.3);
    const gap = fx.size * 0.9;
    const top = fx.img('mfx-fang', fx.B.x, fx.B.y - gap, { scale: sc });
    const bottom = fx.img('mfx-fang', fx.B.x, fx.B.y + gap, { scale: sc }).setFlipY(true);
    await Promise.all([
      fx.tween({ targets: top, y: fx.B.y - 9, duration: 140, ease: 'Quad.in' }),
      fx.tween({ targets: bottom, y: fx.B.y + 9, duration: 140, ease: 'Quad.in' }),
    ]);
    if (o.flame) fx.burst('mfx-flame', fx.B, { count: 7, dist: 70 });
    fx.hitStar(fx.B, o.big);
    fx.tween({ targets: [top, bottom], alpha: 0, duration: 260, delay: 80, onComplete: () => { fx.kill(top); fx.kill(bottom); } });
  },

  // Đâm (sừng, mỏ, kim độc): mũi nhọn lao vào mục tiêu
  async horn(fx, o) {
    await fx.lunge(40, 90);
    const from = { x: fx.B.x - fx.dir * fx.size * 1.6, y: fx.B.y - fx.dir * fx.size * 0.4 };
    const angle = Phaser.Math.RadToDeg(Math.atan2(fx.B.y - from.y, fx.B.x - from.x));
    const sc = PX * (o.big ? 2.4 : 1.8);
    const n = o.big ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const s = fx.img('mfx-needle', from.x, from.y, { scale: sc, angle, tint: fx.move.type === 'poison' ? 0xd078f0 : null });
      await fx.tween({ targets: s, x: fx.B.x, y: fx.B.y, duration: 110, ease: 'Quad.in' });
      fx.kill(s);
      fx.hitStar(fx.B, o.big);
    }
  },

  // Nắm đấm / bàn chân / bàn tay đánh vào mục tiêu (kèm lửa, băng, điện nếu có)
  async strike(fx, o) {
    await fx.lunge(40, o.fast ? 60 : 90);
    const sc = PX * (o.icon === 'mfx-fist' ? (o.big ? 1.5 : 1.15) : o.big ? 2.2 : 1.7);
    const off = o.up ? { x: 0, y: fx.size * 1.2 } : o.down ? { x: 0, y: -fx.size * 1.4 } : o.low ? { x: -fx.dir * fx.size, y: fx.size * 0.6 } : { x: -fx.dir * fx.size * 1.1, y: 0 };
    const icon = fx.img(o.icon, fx.B.x + off.x, fx.B.y + off.y, { scale: sc * 0.6, tint: o.tint ?? null, alpha: 0.4, flipX: fx.dir < 0 });
    await fx.tween({ targets: icon, x: fx.B.x, y: fx.B.y, scale: sc, alpha: 1, duration: o.fast ? 80 : 140, ease: 'Quad.in' });
    if (o.element) fx.burst(o.element, fx.B, { count: 8, dist: 75 });
    if (o.bolts) fx.bolt({ x: fx.B.x - 45, y: fx.B.y - 40 }, { x: fx.B.x + 45, y: fx.B.y + 40 }, { width: 5, times: 3 });
    fx.hitStar(fx.B, o.big);
    fx.tween({ targets: icon, scale: sc * 1.3, alpha: 0, duration: 200, onComplete: () => fx.kill(icon) });
  },

  // Quấn / siết: các vòng thắt quanh mục tiêu
  async bind(fx) {
    const g = fx.gfx(DEPTH + 0.5);
    const s = fx.size;
    await fx.animate(520, (t) => {
      g.clear();
      const squeeze = 1 - Math.abs(Math.sin(t * Math.PI * 2)) * 0.25;
      for (let i = 0; i < 3; i++) {
        const y = fx.B.y - s * 0.5 + i * s * 0.5;
        g.lineStyle(8, 0x8a6a40);
        g.strokeEllipse(fx.B.x, y, s * 1.6 * squeeze, s * 0.35);
        g.lineStyle(4, 0xd8b878);
        g.strokeEllipse(fx.B.x, y, s * 1.6 * squeeze, s * 0.35);
      }
    });
    fx.kill(g);
  },

  // Nhấc bổng mục tiêu rồi quật xuống đất
  async throw(fx) {
    await fx.lunge(50, 100);
    const y = fx.def.y;
    await fx.tween({ targets: fx.def, y: y - 90, angle: fx.dir * 30, duration: 220, ease: 'Quad.out' });
    await fx.tween({ targets: fx.def, y, angle: 0, duration: 140, ease: 'Quad.in' });
    fx.scene.cameras.main.shake(180, 0.012);
    fx.burst('mfx-puff', { x: fx.B.x, y: y - 10 }, { count: 6, dist: 70, tint: 0xd8c8a8 });
    fx.hitStar(fx.B, true);
  },

  // Tự nổ: chớp trắng cả màn hình, quả cầu lửa toả ra
  async explode(fx, o) {
    const flash = fx.scene.add.rectangle(0, 0, 960, 548, 0xffffff, 0).setOrigin(0).setDepth(DEPTH + 1);
    fx.objs.add(flash);
    await fx.tween({ targets: flash, fillAlpha: 0.9, duration: 120, yoyo: true });
    fx.scene.cameras.main.shake(400, o.big ? 0.02 : 0.012);
    await Promise.all([
      fx.burst('mfx-flame', fx.A, { count: 10, dist: 140, ms: 420 }),
      fx.burst('mfx-flame', fx.B, { count: 10, dist: 110, ms: 420 }),
      fx.burst('mfx-puff', fx.B, { count: 6, dist: 90, tint: 0x8a8a90 }),
    ]);
  },

  // Đòn bóng tối: lướt mờ tới rồi chém chữ X tím sẫm
  async darkSlash(fx, o) {
    fx.atk.setAlpha(0.3);
    await fx.lunge(70, 100);
    fx.atk.setAlpha(1);
    const g = fx.gfx(DEPTH + 0.5);
    const s = fx.size * 0.8;
    await fx.animate(140, (t) => {
      g.clear();
      for (const [ax, ay, bx, by] of [[-1, -1, 1, 1], [1, -1, -1, 1]]) {
        const a = { x: fx.B.x + ax * s, y: fx.B.y + ay * s };
        const e = lerp(a, { x: fx.B.x + bx * s, y: fx.B.y + by * s }, t);
        g.lineStyle(11, o.color ?? 0x3a2848);
        g.lineBetween(a.x, a.y, e.x, e.y);
        g.lineStyle(3, 0xd8c8f0);
        g.lineBetween(a.x, a.y, e.x, e.y);
      }
    });
    fx.hitStar(fx.B);
    fx.tween({ targets: g, alpha: 0, duration: 240, onComplete: () => fx.kill(g) });
  },

  // Ma: bóng tối bao lấy mục tiêu, mục tiêu giật mình
  async ghost(fx) {
    await fx.charge(0x5a3a88);
    const rings = [0, 1, 2].map((i) => fx.img('fx-ring', fx.B.x, fx.B.y, { scale: 0.3, tint: 0x7a58b8, alpha: 0 }));
    await Promise.all(rings.map((r, i) => fx.tween({ targets: r, scale: 2.4, alpha: { from: 0.9, to: 0 }, duration: 380, delay: i * 90 })));
    rings.forEach((r) => fx.kill(r));
    await fx.shake(fx.def, 3, 10);
  },

  // Liếm: lưỡi hồng dài vươn tới mục tiêu
  async lick(fx) {
    const g = fx.gfx(DEPTH + 0.5);
    const a = { x: fx.A.x + fx.dir * 30, y: fx.A.y };
    await fx.animate(200, (t) => {
      const e = lerp(a, fx.B, t);
      g.clear();
      g.lineStyle(16, 0xb0405a);
      g.lineBetween(a.x, a.y, e.x, e.y);
      g.lineStyle(10, 0xf07890);
      g.lineBetween(a.x, a.y, e.x, e.y);
    }, 'Quad.out');
    fx.hitStar(fx.B);
    await fx.animate(140, (t) => {
      const e = lerp(a, fx.B, 1 - t);
      g.clear();
      g.lineStyle(10, 0xf07890);
      g.lineBetween(a.x, a.y, e.x, e.y);
    });
    fx.kill(g);
  },

  // Night Shade: màn hình tối sầm, mục tiêu nhuốm bóng đen
  async shade(fx) {
    const dark = fx.scene.add.rectangle(0, 0, 960, 548, 0x100818, 0).setOrigin(0).setDepth(DEPTH - 1);
    fx.objs.add(dark);
    await fx.tween({ targets: dark, fillAlpha: 0.6, duration: 200 });
    fx.def.setTintFill(0x3a2050);
    await fx.shake(fx.def, 3, 8);
    fx.def.clearTint();
    await fx.tween({ targets: dark, fillAlpha: 0, duration: 200 });
  },

  // Roi mây: hai sợi dây leo vươn theo đường cong quất vào mục tiêu
  async whip(fx) {
    for (const side of [-1, 1]) {
      const g = fx.gfx(DEPTH + 0.5);
      const a = { x: fx.A.x + fx.dir * 20, y: fx.A.y + side * 12 };
      const c = { x: (fx.A.x + fx.B.x) / 2, y: Math.min(fx.A.y, fx.B.y) - 120 * (side < 0 ? 1 : 0.4) };
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2(c.x, c.y), new Phaser.Math.Vector2(fx.B.x, fx.B.y));
      const pts = curve.getPoints(28);
      const draw = (t) => {
        g.clear();
        const n = Math.max(2, Math.round(pts.length * t));
        const seg = pts.slice(0, n);
        g.lineStyle(14, 0x1f5a24);
        g.strokePoints(seg);
        g.lineStyle(8, 0x58b040);
        g.strokePoints(seg);
        g.lineStyle(3, 0x9ae070);
        g.strokePoints(seg);
        // lá dọc dây
        for (let i = 5; i < n; i += 6) {
          g.fillStyle(0x1f5a24);
          g.fillEllipse(seg[i].x + 9, seg[i].y - 8, 18, 9);
          g.fillStyle(0x88d860);
          g.fillEllipse(seg[i].x + 9, seg[i].y - 8, 13, 5);
        }
      };
      await fx.animate(190, draw, 'Quad.out');
      fx.hitStar(fx.B);
      fx.scene.cameras.main.shake(80, 0.004);
      fx.animate(140, (t) => draw(1 - t)).then(() => fx.kill(g));
      await fx.wait(90);
    }
  },

  // Lá dao / cánh hoa bay xoáy tới mục tiêu
  async leaves(fx, o) {
    await fx.charge(o.petal ? 0xf080b0 : 0x58b040);
    await fx.stream(o.petal ? 'mfx-petal' : 'mfx-leaf', fx.A, fx.B, {
      count: o.big ? 12 : 6, every: o.big ? 35 : 55, spread: 30, ms: 320, spin: 720, arc: 40, ease: 'Sine.in', scale: PX * (o.petal ? 1.4 : 1.6),
    });
    fx.hitStar(fx.B);
  },

  // Hút máu: các quả cầu xanh bay từ mục tiêu về người ra đòn
  async drain(fx, o) {
    fx.hitStar(fx.B);
    const color = o.color ?? 0x78e060;
    const n = o.big ? 10 : 6;
    const all = [];
    for (let i = 0; i < n; i++) {
      all.push(fx.fly('mfx-orb', { x: fx.B.x + rnd(-30, 30), y: fx.B.y + rnd(-30, 30) }, fx.A, {
        ms: 420, scale: PX * 0.9, toScale: PX * 0.4, tint: color, arc: rnd(-60, 60), ease: 'Sine.inOut',
      }));
      await fx.wait(45);
    }
    await Promise.all(all);
    fx.burst('mfx-spore', fx.A, { count: 8, dist: 50, tint: color, scale: PX * 1.5 });
  },

  // Quả cầu năng lượng bay tới (Shadow Ball, Energy Ball, Sludge Bomb, Water Pulse, Zap Cannon...)
  async orb(fx, o) {
    await fx.charge();
    const sc = PX * (o.small ? 1.2 : 2.2);
    const n = o.small ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const orb = fx.img('mfx-orb', fx.A.x, fx.A.y, { scale: sc * 0.5, tint: fx.color });
      const core = fx.img('mfx-orb', fx.A.x, fx.A.y, { scale: sc * 0.25 });
      const trail = fx.scene.time.addEvent({
        delay: 30, loop: true,
        callback: () => {
          const t = fx.img('mfx-orb', orb.x, orb.y, { scale: sc * 0.4, tint: fx.color, alpha: 0.5, depth: DEPTH - 0.2 });
          fx.tween({ targets: t, scale: 0, alpha: 0, duration: 240, onComplete: () => fx.kill(t) });
        },
      });
      await fx.tween({ targets: [orb, core], x: fx.B.x, y: fx.B.y, scale: sc, duration: o.small ? 200 : 320, ease: 'Quad.in' });
      trail.remove();
      fx.kill(orb);
      fx.kill(core);
      fx.hitStar(fx.B, !o.small);
    }
    if (o.rings) {
      const r = fx.img('fx-ring', fx.B.x, fx.B.y, { scale: 0.5, tint: fx.color });
      fx.tween({ targets: r, scale: 2.6, alpha: 0, duration: 320, onComplete: () => fx.kill(r) });
    }
    if (o.splash) fx.burst('mfx-blob', fx.B, { count: 8, dist: 80, tint: fx.color });
    if (o.bolts) fx.bolt({ x: fx.B.x - 50, y: fx.B.y - 50 }, { x: fx.B.x + 50, y: fx.B.y + 50 }, { width: 5, times: 3 });
    if (!o.small && !o.splash && !o.bolts) fx.burst('mfx-spore', fx.B, { count: 10, dist: 80, tint: fx.color, scale: PX * 2 });
  },

  // Lửa phun thành luồng (Ember chỉ vài đốm), cuối luồng bùng lên ở mục tiêu
  async flame(fx, o) {
    // lửa rồng: ngọn lửa xanh tím (mfx-wisp tô thêm sắc tím)
    const tint = o.color ? 0xc0a0ff : null;
    const key = tint ? 'mfx-wisp' : 'mfx-flame';
    await fx.stream(key, { x: fx.A.x + fx.dir * 30, y: fx.A.y }, fx.B, {
      count: o.small ? 4 : o.big ? 18 : 14, every: o.small ? 70 : 28, spread: o.small ? 6 : 16, ms: 280,
      scale: PX * (o.small ? 1.4 : 1.1), toScale: PX * (o.small ? 1.6 : 2.2), ease: 'Linear', tint,
    });
    fx.burst(key, fx.B, { count: o.small ? 4 : 8, dist: 60, tint, scale: PX * 1.5, spin: 0 });
  },

  // Fire Blast: quả cầu lửa lao tới rồi nổ thành hình ngôi sao năm cánh bằng lửa
  async fireBlast(fx) {
    await fx.charge(0xf87820);
    await fx.fly('mfx-flame', fx.A, fx.B, { ms: 300, scale: PX * 1.5, toScale: PX * 3 });
    const arms = 5;
    const all = [];
    for (let i = 0; i < arms; i++) {
      const a = -Math.PI / 2 + (i / arms) * Math.PI * 2;
      for (let k = 1; k <= 3; k++) {
        const f = fx.img('mfx-flame', fx.B.x, fx.B.y, { scale: PX * 1.6 });
        all.push(fx.tween({ targets: f, x: fx.B.x + Math.cos(a) * k * 26, y: fx.B.y + Math.sin(a) * k * 26, duration: 160 + k * 40, ease: 'Quad.out' }).then(() => fx.wait(160)).then(() => fx.kill(f)));
      }
    }
    fx.hitStar(fx.B, true);
    await Promise.all(all);
  },

  // Heat Wave: các hàng lửa quét ngang sân về phía đối thủ
  async heatWave(fx) {
    await fx.charge(0xf87820);
    const rows = [-50, 0, 50];
    await Promise.all(rows.map((dy, r) => fx.stream('mfx-flame', { x: fx.A.x, y: fx.B.y + dy - 40 }, { x: fx.B.x + fx.dir * 60, y: fx.B.y + dy }, {
      count: 6, every: 50, spread: 12, ms: 360, scale: PX * 1.3, toScale: PX * 1.8, ease: 'Linear',
    }).then(() => r)));
  },

  // Tia nước: dòng nước dày phun thẳng tới, mép gợn sóng, giọt nước bắn dọc theo, té nước ở mục tiêu
  async water(fx, o) {
    const g = fx.gfx(DEPTH);
    const a = { x: fx.A.x + fx.dir * 34, y: fx.A.y - 10 };
    const w = o.big ? 50 : 34;
    const drops = fx.stream('mfx-drop', a, fx.B, { count: o.big ? 14 : 9, every: 28, spread: w * 0.7, ms: 220, ease: 'Linear', scale: PX * 1.5 });
    let frame = 0;
    await fx.animate(o.big ? 420 : 320, (t) => {
      const reach = Math.min(1, t * 1.6);
      const len = Math.hypot(fx.B.x - a.x, fx.B.y - a.y) * reach;
      const steps = Math.max(2, Math.round(len / 7));
      frame++;
      g.clear();
      // ba lớp: viền xanh sẫm, thân nước, lõi trắng; mỗi đốt tròn to nhỏ theo sóng cho mép gợn
      for (const [k, color] of [[1, 0x1a4aa8], [0.72, 0x58a8f8], [0.3, 0xd8f0ff]]) {
        g.fillStyle(color);
        for (let i = 0; i <= steps; i++) {
          const p = lerp(a, fx.B, (reach * i) / steps);
          const r = (w / 2) * k * (0.85 + 0.2 * Math.sin(i * 0.9 - frame * 0.8)) * (0.75 + 0.25 * (i / steps));
          g.fillCircle(p.x, p.y - (k < 0.5 ? w * 0.12 : 0), r);
        }
      }
    });
    await drops;
    fx.burst('mfx-drop', fx.B, { count: o.big ? 14 : 10, dist: o.big ? 100 : 80, spin: 0, scale: PX * 1.4 });
    fx.tween({ targets: g, alpha: 0, duration: 180, onComplete: () => fx.kill(g) });
  },

  // Bong bóng trôi lắc lư tới mục tiêu rồi vỡ
  async bubbles(fx, o) {
    const n = o.big ? 8 : 5;
    const all = [];
    for (let i = 0; i < n; i++) {
      all.push(fx.fly('mfx-bubble', { x: fx.A.x + fx.dir * 30, y: fx.A.y + rnd(-20, 20) }, { x: fx.B.x + rnd(-35, 35), y: fx.B.y + rnd(-35, 35) }, {
        ms: 480, scale: PX * 0.8, toScale: PX * 1.4, arc: rnd(-40, 40), ease: 'Sine.inOut',
      }).then(() => fx.burst('mfx-spore', fx.B, { count: 4, dist: 26, tint: 0xc8ecff, scale: PX })));
      await fx.wait(70);
    }
    await Promise.all(all);
  },

  // Lướt sóng: con sóng lớn dâng lên từ phía người ra đòn quét qua đối thủ
  async wave(fx) {
    const g = fx.gfx(DEPTH + 0.5);
    const baseY = 548;
    const startX = fx.dir > 0 ? -200 : 1160;
    const endX = fx.dir > 0 ? 1160 : -200;
    await fx.animate(700, (t) => {
      const x = startX + (endX - startX) * t;
      g.clear();
      const crest = 260;
      g.fillStyle(0x1a4aa8, 0.85);
      g.fillRect(Math.min(x, startX), baseY - crest * 0.7, Math.abs(x - startX), crest * 0.7);
      g.fillStyle(0x58a8f8, 0.9);
      g.fillEllipse(x, baseY - crest * 0.55, 220, crest);
      g.fillStyle(0xd8f0ff);
      g.fillEllipse(x + fx.dir * 40, baseY - crest * 0.95, 120, 40);
    });
    fx.kill(g);
    fx.hitStar(fx.B, true);
  },

  // Thác nước: cột nước đổ ập từ trên xuống mục tiêu
  async waterfall(fx) {
    await fx.lunge(50, 100);
    const g = fx.gfx(DEPTH + 0.5);
    await fx.animate(260, (t) => {
      g.clear();
      const top = 0;
      const bottom = top + (fx.B.y + 40 - top) * t;
      g.fillStyle(0x1a4aa8, 0.85);
      g.fillRect(fx.B.x - 50, top, 100, bottom);
      g.fillStyle(0x58a8f8);
      g.fillRect(fx.B.x - 38, top, 76, bottom);
      g.fillStyle(0xd8f0ff);
      for (let i = 0; i < 4; i++) g.fillRect(fx.B.x - 30 + i * 18, top, 4, bottom);
    }, 'Quad.in');
    fx.burst('mfx-drop', { x: fx.B.x, y: fx.B.y + 30 }, { count: 10, dist: 90, spin: 0 });
    fx.tween({ targets: g, alpha: 0, duration: 200, onComplete: () => fx.kill(g) });
  },

  // Sét đánh thẳng từ người ra đòn
  async bolt(fx, o) {
    await fx.charge(0xf8d830);
    await fx.bolt({ x: fx.A.x + fx.dir * 30, y: fx.A.y }, fx.B, { width: o.big ? 9 : 5, times: o.big ? 6 : 4 });
    fx.burst('mfx-spore', fx.B, { count: 10, dist: 80, tint: 0xf8e060, scale: PX * 2 });
  },

  // Thunder: sét giáng từ trời xuống mục tiêu
  async skyBolt(fx) {
    const flash = fx.scene.add.rectangle(0, 0, 960, 548, 0xffffff, 0).setOrigin(0).setDepth(DEPTH - 1);
    fx.objs.add(flash);
    fx.tween({ targets: flash, fillAlpha: 0.6, duration: 60, yoyo: true, repeat: 1 });
    await fx.bolt({ x: fx.B.x + rnd(-30, 30), y: 0 }, fx.B, { width: 12, times: 6, segs: 9, jitter: 30 });
    fx.scene.cameras.main.shake(160, 0.01);
    fx.burst('mfx-spore', fx.B, { count: 12, dist: 90, tint: 0xf8e060, scale: PX * 2 });
  },

  // Thunder Wave: tia điện nhỏ chạy vòng quanh mục tiêu
  async twave(fx) {
    await fx.bolt({ x: fx.A.x + fx.dir * 30, y: fx.A.y }, fx.B, { width: 4, times: 3 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      await fx.bolt({ x: fx.B.x + Math.cos(a) * 60, y: fx.B.y + Math.sin(a) * 60 }, { x: fx.B.x + Math.cos(a + 1.6) * 60, y: fx.B.y + Math.sin(a + 1.6) * 60 }, { width: 3, times: 1, segs: 4, jitter: 10 });
    }
  },

  // Tuyết / băng giá: bông tuyết bay tới (gió tuyết thì quét ngang thành dải)
  async snow(fx, o) {
    await fx.stream('mfx-flake', { x: fx.A.x + fx.dir * 30, y: fx.A.y - 20 }, fx.B, {
      count: o.big ? 18 : 9, every: o.big ? 25 : 40, spread: o.wind ? 50 : 25, ms: o.wind ? 300 : 420, spin: 360,
      arc: o.wind ? 0 : 30, ease: 'Linear', scale: PX * 1.2,
    });
    fx.burst('mfx-flake', fx.B, { count: 6, dist: 60 });
  },

  // Tia sáng thẳng (Ice Beam, Psybeam, Aurora Beam, Signal Beam, Flash Cannon, Dragon Pulse, Power Gem)
  async beam(fx, o) {
    await fx.charge(o.rainbow ? 0xf8a0f8 : fx.color);
    const g = fx.gfx(DEPTH);
    const a = { x: fx.A.x + fx.dir * 30, y: fx.A.y };
    const rainbow = [0xf86060, 0xf8c040, 0x68d868, 0x58a8f8, 0xb070f0];
    const colorAt = (k) => (o.rainbow ? rainbow[k % rainbow.length] : o.alternate ? o.alternate[k % 2] : fx.color);
    let frame = 0;
    const extras = [];
    await fx.animate(420, (t) => {
      const e = lerp(a, fx.B, Math.min(1, t * 2));
      frame++;
      g.clear();
      const w = 14 + Math.sin(frame) * 3;
      g.lineStyle(w + 8, colorAt(frame), 0.45);
      g.lineBetween(a.x, a.y, e.x, e.y);
      g.lineStyle(w, colorAt(frame + 1));
      g.lineBetween(a.x, a.y, e.x, e.y);
      g.lineStyle(w * 0.35, 0xffffff);
      g.lineBetween(a.x, a.y, e.x, e.y);
      // vòng sáng / bông tuyết / đá quý chạy dọc tia
      if (frame % 3 === 0 && (o.rings || o.flakes || o.gems)) {
        const key = o.flakes ? 'mfx-flake' : o.gems ? 'mfx-gem' : 'fx-ring';
        const isRing = key === 'fx-ring';
        extras.push(fx.fly(key, a, fx.B, { ms: 220, ease: 'Linear', scale: isRing ? 0.5 : PX * 1.3, toScale: isRing ? 0.9 : PX * 1.3, tint: isRing ? colorAt(frame) : null, spin: isRing ? 0 : 360 }));
      }
    });
    await Promise.all(extras);
    fx.burst('mfx-spore', fx.B, { count: 10, dist: 80, tint: colorAt(0), scale: PX * 2 });
    fx.tween({ targets: g, alpha: 0, duration: 160, onComplete: () => fx.kill(g) });
  },

  // Siêu linh: các vòng sóng hồng thu vào mục tiêu, mục tiêu méo mó lắc lư
  async psywave(fx, o) {
    await fx.charge(0xf070c8);
    const n = o.big ? 4 : 3;
    const rings = [];
    for (let i = 0; i < n; i++) {
      const r = fx.img('fx-ring', fx.B.x, fx.B.y, { scale: 3, tint: i % 2 ? 0xf8a0e0 : 0xd048b0, alpha: 0 });
      rings.push(fx.tween({ targets: r, scale: 0.3, alpha: { from: 0.9, to: 0.2 }, duration: 320, delay: i * 90, ease: 'Quad.in', onComplete: () => fx.kill(r) }));
    }
    const sx = fx.def.scaleX;
    const wobble = fx.tween({ targets: fx.def, scaleX: sx * 1.12, duration: 90, yoyo: true, repeat: n, onComplete: () => fx.def.setScale(sx, fx.def.scaleY) });
    await Promise.all([...rings, wobble]);
  },

  // Độc: các cục độc / bùn bay vòng cung rồi bắn tung toé
  async blobs(fx, o) {
    const n = o.big ? 6 : o.small ? 6 : 4;
    const all = [];
    for (let i = 0; i < n; i++) {
      all.push(fx.fly('mfx-blob', { x: fx.A.x + fx.dir * 30, y: fx.A.y }, { x: fx.B.x + rnd(-25, 25), y: fx.B.y + rnd(-25, 25) }, {
        ms: 340, arc: rnd(40, 80), ease: 'Linear', tint: fx.color, scale: PX * (o.small ? 0.9 : 1.6), spin: 180,
      }));
      await fx.wait(o.small ? 30 : 60);
    }
    await Promise.all(all);
    fx.burst('mfx-blob', fx.B, { count: 8, dist: 70, tint: fx.color, scale: PX });
  },

  // Khói / khí độc: các cụm khói phồng lên bao lấy mục tiêu
  async cloud(fx) {
    const puffs = [];
    for (let i = 0; i < 6; i++) {
      const p = fx.img('mfx-puff', fx.B.x + rnd(-50, 50), fx.B.y + rnd(-40, 40), { scale: PX * 0.8, tint: fx.color, alpha: 0 });
      puffs.push(fx.tween({ targets: p, scale: PX * 2.4, alpha: { from: 0.85, to: 0 }, x: p.x + rnd(-30, 30), duration: 600, delay: i * 70, ease: 'Sine.out', onComplete: () => fx.kill(p) }));
    }
    await fx.wait(300);
    await Promise.all(puffs.slice(0, 2));
  },

  // Gió: các vệt gió cong lướt tới; dao gió thì nhanh và sắc hơn
  async wind(fx, o) {
    const n = o.big ? 4 : 3;
    const all = [];
    for (let i = 0; i < n; i++) {
      const g = fx.gfx(DEPTH + 0.5);
      const p = { t: 0 };
      const dy = (i - (n - 1) / 2) * 30;
      all.push(fx.tween({
        targets: p, t: 1, duration: o.blades ? 220 : 360, delay: i * 80, ease: 'Linear',
        onUpdate: () => {
          const c = lerp({ x: fx.A.x + fx.dir * 30, y: fx.A.y + dy }, { x: fx.B.x, y: fx.B.y + dy * 0.5 }, p.t);
          g.clear();
          g.lineStyle(o.blades ? 5 : 7, o.blades ? 0xa8d8f8 : 0xffffff, 0.9);
          g.beginPath();
          g.arc(c.x, c.y, 34, fx.dir > 0 ? -1.1 : Math.PI - 1.1, fx.dir > 0 ? 1.1 : Math.PI + 1.1);
          g.strokePath();
        },
        onComplete: () => fx.kill(g),
      }));
    }
    await Promise.all(all);
    fx.hitStar(fx.B, o.big);
  },

  // Lốc xoáy: vòng xoắn quay quanh mục tiêu cuộn dần lên cao
  async tornado(fx, o) {
    const g = fx.gfx(DEPTH + 0.5);
    const color = o.color ?? 0xd8e8f8;
    await fx.animate(o.big ? 800 : 600, (t) => {
      g.clear();
      for (let i = 0; i < 7; i++) {
        const y = fx.B.y + fx.size * 0.9 - i * fx.size * 0.32;
        const w = 40 + i * 18;
        const phase = t * Math.PI * 8 + i;
        g.lineStyle(6, color, 0.85);
        g.strokeEllipse(fx.B.x + Math.sin(phase) * 10, y, w, 16);
      }
    });
    fx.kill(g);
    fx.hitStar(fx.B, o.big);
  },

  // Đòn cánh: hai vệt cánh cong quét qua mục tiêu
  async wing(fx) {
    await fx.lunge(60, 110);
    const g = fx.gfx(DEPTH + 0.5);
    await fx.animate(180, (t) => {
      g.clear();
      for (const side of [-1, 1]) {
        g.lineStyle(10, 0xffffff, 0.9);
        g.beginPath();
        g.arc(fx.B.x + side * 20, fx.B.y, 55, side > 0 ? -2.4 : -0.7, (side > 0 ? -2.4 : -0.7) + t * 1.6 * side);
        g.strokePath();
      }
    });
    fx.hitStar(fx.B);
    fx.tween({ targets: g, alpha: 0, duration: 200, onComplete: () => fx.kill(g) });
  },

  // Đá: ném một (vài) tảng đá theo đường vòng cung
  async rocks(fx, o) {
    for (let i = 0; i < (o.count ?? 1); i++) {
      await fx.fly('mfx-rock', { x: fx.A.x + fx.dir * 20, y: fx.A.y - 20 }, fx.B, { ms: 340, arc: 90, scale: PX * 2, spin: 360, ease: 'Linear' });
      fx.burst('mfx-rock', fx.B, { count: 5, dist: 55, scale: PX * 0.8 });
      fx.hitStar(fx.B);
    }
  },

  // Rock Slide: đá lở rơi từ trên xuống mục tiêu
  async rockfall(fx) {
    const all = [];
    for (let i = 0; i < 6; i++) {
      const x = fx.B.x + rnd(-70, 70);
      all.push(fx.fly('mfx-rock', { x, y: -30 }, { x: x * 0.8 + fx.B.x * 0.2, y: fx.B.y + rnd(-10, 40) }, { ms: 320, scale: PX * rnd(1.6, 2.6), spin: 200 }).then(() => {
        fx.scene.cameras.main.shake(60, 0.005);
        fx.burst('mfx-puff', { x, y: fx.B.y + 30 }, { count: 3, dist: 40, tint: 0xb8a890, scale: PX * 0.8 });
      }));
      await fx.wait(70);
    }
    await Promise.all(all);
  },

  // Stone Edge: các mũi đá nhọn đâm lên từ mặt đất quanh mục tiêu
  async spikes(fx) {
    const g = fx.gfx(DEPTH + 0.5);
    const ground = fx.def.y;
    const spikes = [-60, -25, 10, 45, 75].map((dx, i) => ({ x: fx.B.x + dx, h: 60 + (i % 2) * 40 + rnd(0, 20) }));
    await fx.animate(220, (t) => {
      g.clear();
      for (const s of spikes) {
        const h = s.h * t;
        g.fillStyle(0x5a4a3a);
        g.fillTriangle(s.x - 18, ground, s.x + 18, ground, s.x, ground - h);
        g.fillStyle(0xa89880);
        g.fillTriangle(s.x - 10, ground, s.x + 4, ground, s.x - 2, ground - h * 0.85);
      }
    }, 'Back.out');
    fx.hitStar(fx.B, true);
    fx.scene.cameras.main.shake(120, 0.008);
    fx.tween({ targets: g, alpha: 0, duration: 260, delay: 120, onComplete: () => fx.kill(g) });
  },

  // Ancient Power: đá bay lên quanh người ra đòn rồi đồng loạt lao tới
  async ancient(fx) {
    const rocks = [0, 1, 2, 3, 4].map((i) => fx.img('mfx-rock', fx.A.x + (i - 2) * 30, fx.atk.y, { scale: PX * 1.4 }));
    await Promise.all(rocks.map((r, i) => fx.tween({ targets: r, y: fx.A.y - 70 - (i % 2) * 20, duration: 260, ease: 'Quad.out' })));
    await Promise.all(rocks.map((r, i) => fx.tween({ targets: r, x: fx.B.x + (i - 2) * 12, y: fx.B.y, angle: 360, duration: 280, delay: i * 40, ease: 'Quad.in', onComplete: () => fx.kill(r) })));
    fx.hitStar(fx.B, true);
  },

  // Động đất: rung mạnh cả màn hình, mặt đất nứt dưới chân đối thủ, bụi tung lên
  async quake(fx) {
    fx.scene.cameras.main.shake(520, 0.018);
    const g = fx.gfx(DEPTH - 0.5);
    const y = fx.def.y + 4;
    const cracks = [-1, 1].map((s) => {
      const pts = [{ x: fx.B.x, y }];
      for (let i = 1; i <= 5; i++) pts.push({ x: fx.B.x + s * i * 26, y: y + rnd(-10, 10) });
      return pts;
    });
    await fx.animate(320, (t) => {
      g.clear();
      g.lineStyle(6, 0x3a2a1a);
      for (const pts of cracks) g.strokePoints(pts.slice(0, Math.max(2, Math.round(pts.length * t))));
    });
    fx.burst('mfx-puff', { x: fx.B.x, y }, { count: 8, dist: 90, tint: 0xc8b088 });
    fx.tween({ targets: g, alpha: 0, duration: 300, delay: 120, onComplete: () => fx.kill(g) });
  },

  // Bonemerang: khúc xương xoay bay tới rồi quay về
  async bone(fx) {
    await fx.fly('mfx-bone', fx.A, fx.B, { ms: 260, scale: PX * 2, spin: 720, arc: 60 });
    fx.hitStar(fx.B);
    fx.fly('mfx-bone', fx.B, fx.A, { ms: 260, scale: PX * 2, spin: 720, arc: -60 });
  },

  // Kim / gai / băng nhọn bắn liên tiếp
  async needles(fx, o) {
    const key = o.key ?? 'mfx-needle';
    const n = o.count ?? 3;
    const angle = Phaser.Math.RadToDeg(Math.atan2(fx.B.y - fx.A.y, fx.B.x - fx.A.x)) - (key === 'mfx-icicle' ? 90 : 0);
    const all = [];
    for (let i = 0; i < n; i++) {
      const s = fx.img(key, fx.A.x + fx.dir * 30, fx.A.y + rnd(-15, 15), { scale: PX * 1.8, angle, tint: o.tint ?? null });
      all.push(fx.tween({ targets: s, x: fx.B.x + rnd(-15, 15), y: fx.B.y + rnd(-15, 15), duration: 200, ease: 'Linear', onComplete: () => { fx.kill(s); fx.hitStar(fx.B); } }));
      await fx.wait(70);
    }
    await Promise.all(all);
  },

  // Swift: những ngôi sao vàng xoay tròn bay tới
  async stars(fx) {
    await fx.stream('mfx-star', { x: fx.A.x + fx.dir * 30, y: fx.A.y }, fx.B, { count: 6, every: 60, spread: 25, ms: 320, spin: 540, arc: 50, ease: 'Sine.in', scale: PX * 1.8 });
    fx.burst('mfx-star', fx.B, { count: 6, dist: 60, scale: PX });
  },

  // Sonic Boom: sóng âm hình lưỡi liềm lao tới
  async sonic(fx) {
    await KINDS.wind(fx, { blades: true });
  },

  // ---------- chiêu trạng thái ----------

  // Âm thanh: sóng ")))" (hoặc nốt nhạc khi hát) toả từ người ra đòn về phía đối thủ
  async sound(fx, o) {
    if (o.notes) {
      await fx.stream('mfx-note', { x: fx.A.x + fx.dir * 30, y: fx.A.y - 30 }, fx.B, { count: 5, every: 90, spread: 30, ms: 520, arc: 40, ease: 'Sine.inOut', scale: PX * 1.6 });
      return;
    }
    const color = o.color ?? 0xffffff;
    const all = [];
    for (let i = 0; i < (o.big ? 5 : 3); i++) {
      const g = fx.gfx(DEPTH + 0.5);
      const p = { t: 0 };
      all.push(fx.tween({
        targets: p, t: 1, duration: 420, delay: i * 110,
        onUpdate: () => {
          const c = lerp({ x: fx.A.x + fx.dir * 30, y: fx.A.y }, fx.B, p.t);
          g.clear();
          const r = 18 + p.t * 30;
          g.lineStyle(6, color, 1 - p.t * 0.6);
          g.beginPath();
          g.arc(c.x - fx.dir * r, c.y, r, fx.dir > 0 ? -0.9 : Math.PI - 0.9, fx.dir > 0 ? 0.9 : Math.PI + 0.9);
          g.strokePath();
          if (o.rings) {
            g.lineStyle(3, 0xf8e060);
            g.strokeCircle(c.x, c.y, r * 0.4);
          }
        },
        onComplete: () => fx.kill(g),
      }));
    }
    await Promise.all(all);
    await fx.shake(fx.def, 2, 5);
  },

  // Lườm / mặt đáng sợ: mắt loé sáng ở người ra đòn, đối thủ rùng mình
  async glare(fx, o) {
    const eye = { x: fx.A.x + fx.dir * 10, y: fx.atk.y - fx.atk.displayHeight * 0.7 };
    const glints = [-1, 1].map((s) => fx.img('mfx-star', eye.x + s * 18, eye.y, { scale: 0, tint: o.color ?? 0xe83838 }));
    await Promise.all(glints.map((g) => fx.tween({ targets: g, scale: PX * (o.big ? 2 : 1.5), angle: 90, duration: 160, yoyo: true })));
    glints.forEach((g) => fx.kill(g));
    await fx.shake(fx.def, 3, 6);
  },

  // Phấn: bột phấn rắc xuống phủ lên đối thủ
  async powder(fx) {
    const all = [];
    for (let i = 0; i < 18; i++) {
      const x = fx.B.x + rnd(-70, 70);
      all.push(fx.fly('mfx-spore', { x, y: fx.B.y - 110 }, { x: x + rnd(-15, 15), y: fx.B.y + rnd(0, 60) }, { ms: 520, scale: PX * 1.6, tint: fx.color, ease: 'Sine.in' }));
      await fx.wait(18);
    }
    await Promise.all(all);
  },

  // Tim bay từ người ra đòn tới đối thủ
  async hearts(fx, o) {
    await fx.stream('mfx-heart', { x: fx.A.x + fx.dir * 30, y: fx.A.y - 20 }, fx.B, { count: 5, every: 90, spread: 30, ms: 520, arc: 40, ease: 'Sine.inOut', scale: PX * 1.8, tint: o.color ?? null });
    fx.burst('mfx-heart', fx.B, { count: 5, dist: 50, scale: PX, tint: o.color ?? null, spin: 0 });
  },

  // Confuse Ray / Hypnosis: quả cầu lập loè hoặc vòng thôi miên bay tới
  async ray(fx, o) {
    if (o.rings) {
      for (let i = 0; i < 4; i++) {
        fx.fly('fx-ring', fx.A, fx.B, { ms: 420, scale: 0.4, toScale: 1.6, tint: i % 2 ? 0xd070f0 : 0xf8a0f8, ease: 'Linear' });
        await fx.wait(100);
      }
      await fx.wait(320);
    } else {
      await fx.fly('mfx-orb', fx.A, fx.B, { ms: 560, scale: PX * 1.6, tint: 0xd8f860, arc: 60, ease: 'Sine.inOut' });
    }
    await fx.shake(fx.def, 3, 6);
  },

  // Will-O-Wisp: ba ngọn lửa ma xanh lượn quanh rồi lao tới
  async wisp(fx) {
    const flames = [0, 1, 2].map(() => fx.img('mfx-wisp', fx.A.x, fx.A.y, { scale: PX * 1.6 }));
    const o = { a: 0 };
    await fx.tween({ targets: o, a: Math.PI * 2, duration: 420, onUpdate: () => flames.forEach((f, i) => f.setPosition(fx.A.x + Math.cos(o.a + i * 2.1) * 60, fx.A.y + Math.sin(o.a + i * 2.1) * 30)) });
    await Promise.all(flames.map((f, i) => fx.tween({ targets: f, x: fx.B.x, y: fx.B.y, duration: 280, delay: i * 60, ease: 'Quad.in', onComplete: () => fx.kill(f) })));
  },

  // Vẫy đuôi: người ra đòn lắc qua lắc lại
  async wiggle(fx) {
    await fx.tween({ targets: fx.atk, angle: 12, duration: 90, yoyo: true, repeat: 3, onComplete: () => fx.atk.setAngle(0) });
  },

  // Splash: nhảy tưng tưng tại chỗ
  async hop(fx) {
    const y = fx.atk.y;
    await fx.tween({ targets: fx.atk, y: y - 50, duration: 160, yoyo: true, repeat: 1, ease: 'Quad.out', onComplete: () => (fx.atk.y = y) });
    fx.burst('mfx-drop', { x: fx.A.x, y }, { count: 6, dist: 50, spin: 0 });
  },

  // Feather Dance: lông vũ rơi lả tả lên đối thủ
  async feathers(fx) {
    const all = [];
    for (let i = 0; i < 8; i++) {
      const x = fx.B.x + rnd(-70, 70);
      all.push(fx.fly('mfx-feather', { x, y: fx.B.y - 120 }, { x: x + rnd(-30, 30), y: fx.B.y + rnd(0, 50) }, { ms: 700, scale: PX * 1.8, spin: rnd(-180, 180), arc: -20, ease: 'Sine.inOut' }));
      await fx.wait(50);
    }
    await Promise.all(all);
  },

  // Fake Tears: nước mắt giả rơi lã chã
  async tears(fx) {
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1;
      fx.fly('mfx-drop', { x: fx.A.x + s * 16, y: fx.atk.y - fx.atk.displayHeight * 0.65 }, { x: fx.A.x + s * 40, y: fx.atk.y }, { ms: 360, arc: 20, scale: PX * 1.2 });
      await fx.wait(70);
    }
    await fx.wait(300);
  },

  // Double Team: phân thân sang hai bên rồi nhập lại
  async afterimage(fx) {
    const copies = [-1, 1].map(() => {
      const c = fx.img(fx.atk.texture.key, fx.atk.x, fx.atk.y, { alpha: 0.5, flipX: fx.atk.flipX });
      return c.setOrigin(0.5, 1).setScale(fx.atk.scaleX, fx.atk.scaleY);
    });
    await Promise.all(copies.map((c, i) => fx.tween({ targets: c, x: c.x + (i ? 70 : -70), duration: 160, yoyo: true, repeat: 1 })));
    copies.forEach((c) => fx.kill(c));
  },
};

// Chạy hiệu ứng của chiêu. atk / def: sprite người ra đòn / mục tiêu; isPlayer: người chơi ra đòn.
// Trả về true nếu có hiệu ứng riêng (chiêu trạng thái không có trong bảng thì trả về false, BattleScene dùng lấp lánh chung).
export async function playMoveFx(scene, move, { atk, def, isPlayer }) {
  const spec = fxOf(move);
  if (!spec || !KINDS[spec[0]]) return false;
  const [kind, opt = {}] = spec;
  const fx = new Fx(scene, atk, def, isPlayer, move, opt);
  try {
    await KINDS[kind](fx, opt);
  } finally {
    // dọn hình còn sót nhưng để hiệu ứng mờ dần kịp chạy nốt
    scene.time.delayedCall(700, () => fx.cleanup());
  }
  return true;
}

export const FX_KINDS = Object.keys(KINDS);
export { MOVE_FX };
