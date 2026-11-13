import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { CELL, GAME_HEIGHT, GAME_WIDTH, WORLD_SCALE } from '../config.js';
import { LOOKS } from '../data/characterLooks.js';
import { MAPS } from '../data/map.js';
import { berryStage } from '../game/berries.js';
import { timeOfDay } from '../game/clock.js';
import { settings } from '../game/settings.js';
import { hasFlag } from '../game/state.js';
import { objectVisible } from '../story/chapter1.js';
import { Actor } from './actor.js';
import { Smoke, buildBalloon, buildFishingRig } from './effects.js';
import { buildCave } from './cave3d.js';
import { setBakeRenderer } from './groundBake.js';
import { MonSprite } from './monSprite.js';
import { TitleStage } from './title3d.js';
import { buildInterior } from './interior3d.js';
import { buildWorld } from './world3d.js';

// Cầu nối game 2D <-> cảnh 3D.
// Toàn bộ logic vẫn là game 2D (WorldScene: di chuyển, NPC, cốt truyện, trận đấu, menu, lưu game).
// Mỗi khung hình, trước khi Phaser vẽ, View3D đọc trạng thái WorldScene rồi dựng lại bằng 3D:
//  - bản đồ, người chơi, NPC, Pokémon đi theo, vật phẩm, cây quả, buổi trong ngày, mưa
//  - ẩn phần thế giới 2D (chỉ trong lúc vẽ), giữ nguyên giao diện 2D (hộp thoại, HUD, menu)
//  - hiệu ứng nằm trên bản đồ như dấu "!" hay icon nhận đồ được dời tới đúng chỗ trên cảnh 3D
// Khu vực chưa dựng 3D (supports3D = false) thì hiện bản 2D như cũ.

const FOOT = WORLD_SCALE; // chân nhân vật cách đáy ô bấy nhiêu px (WorldScene: cellCenter)
const WATER_LEVEL = -0.14; // mặt nước trong cảnh 3D (world3d.js)
const DOOR_SECONDS = 0.18; // cửa trượt mở / đóng (WorldScene: DOOR_MS)
const LEVEL_CACHE = 8; // giữ sẵn bấy nhiêu bản đồ đã dựng (vào nhà rồi ra lại không phải dựng lại)
const OVERLAY_DEPTH = 99; // vật thể trên bản đồ từ độ sâu này (HUD_DEPTH - 1) là hiệu ứng nổi: dời lên cảnh 3D
const HEIGHT_SCALE = 0.93; // chiều cao nhân vật 3D so với 2D (1,4 ô so với 1,5 ô)
const INDOOR_WALL = 0.25; // bề dày vách hai bên phòng (interior3d.js)
const INDOOR_FIT_MAX = 1.15; // trong nhà camera lùi ra tối đa chừng này lần để thấy trọn phòng
// NPC ngồi sofa: hông ngang mặt đệm (homeProps.js: sofa), lưng lùi về phía lưng tựa
const SEAT_Y = 0.03;
const SEAT_BACK = 0.03;
const FACE_DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Mọi bản đồ đều có 3D. Để tắt 3D cho một bản đồ (hiện bản 2D) thì trả về false ở đây.
export function supports3D(map) {
  return Boolean(map);
}

const toX = (px) => px / CELL;
const toZ = (py) => (py + FOOT) / CELL - 0.5;

const TIMES = {
  day: { sky: 0xa8d4f4, sun: 0xfff2dc, sunI: 2.9, sunDir: [-7, 14, 8], hemiSky: 0xd8ecff, hemiGround: 0x5a7a4a, hemiI: 1.1, night: 0 },
  dusk: { sky: 0xf0a878, sun: 0xffa860, sunI: 2.1, sunDir: [-14, 6, 5], hemiSky: 0xf8c0a0, hemiGround: 0x4a4050, hemiI: 1.0, night: 0.45 },
  night: { sky: 0x101830, sun: 0x8aa0ff, sunI: 0.6, sunDir: [6, 14, 6], hemiSky: 0x3a4a88, hemiGround: 0x1a2236, hemiI: 0.9, night: 1 },
};
const INDOOR = { sky: 0x000000, sun: 0xfff0dc, sunI: 1.5, sunDir: [-4, 12, 9], hemiSky: 0xfff4e8, hemiGround: 0x6a5a50, hemiI: 1.25, night: 0 };
// Thời tiết ngoài trời (gfx/ambience.js): màu trời và độ sáng nhân thêm; fog: tầm nhìn xa còn lại (bão cát, tuyết mù hơn)
const WEATHER_LIGHT = {
  rain: { sky: 0x7a8aa0, sunI: 0.4, hemiI: 0.75, fog: 1 },
  snow: { sky: 0xd0dae8, sunI: 0.7, hemiI: 1.05, fog: 0.7 },
  hail: { sky: 0x8a9ab8, sunI: 0.5, hemiI: 0.85, fog: 0.8 },
  sand: { sky: 0xc8a870, sunI: 0.55, hemiI: 0.9, fog: 0.55 },
};
// Trong hang: ánh sáng ấm dịu từ trên xuống, nền đen, không theo giờ trong ngày (đèn trong hang do cave3d.js đặt)
const CAVE = { sky: 0x000000, sun: 0xffe2c0, sunI: 1.9, sunDir: [-3, 12, 7], hemiSky: 0xd8c8b8, hemiGround: 0x3a3028, hemiI: 1.05, night: 0 };
const DARK_RADIUS = 2.6; // gym tối: ngoài bán kính này (ô) quanh người chơi là bóng tối (như vòng sáng của bản 2D)

export const VIEWS = [
  { label: 'Góc cổ điển', elev: 50, dist: 15, fov: 30 },
  { label: 'Góc điện ảnh', elev: 26, dist: 10.5, fov: 38 },
  { label: 'Nhìn từ trên cao', elev: 70, dist: 21, fov: 28 },
];

// Texture từ một frame của Phaser (Pokémon đi theo, NPC là Pokémon, thú cưỡi)
const frameCache = new Map();
function frameTexture(scene, key, frameName) {
  const id = `${key}:${frameName}`;
  if (frameCache.has(id)) return frameCache.get(id);
  const frame = scene.textures.getFrame(key, frameName);
  if (!frame) return null;
  const canvas = document.createElement('canvas');
  canvas.width = frame.cutWidth;
  canvas.height = frame.cutHeight;
  canvas.getContext('2d').drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  frameCache.set(id, tex);
  return tex;
}

// Pokémon trong cảnh 3D (đi theo, NPC là Pokémon, thú cưỡi): sprite kiểu GBA (monSprite.js), lấy đúng frame, cỡ,
// độ nghiêng, độ nhún / nhảy của hình bên bản 2D mỗi khung hình
class Billboard {
  constructor(parent) {
    this.mon = new MonSprite(parent);
    this.group = this.mon.group;
  }

  get height() {
    return this.mon.height;
  }

  dispose() {
    this.mon.dispose();
  }

  // ground: [x, y] điểm chạm đất (px của bản 2D); hình nhô cao hơn đó thì là đang nhảy / bay
  // fit: sprite luôn quay thẳng vào màn hình nên không bị camera nhìn chéo từ trên xuống làm ngắn lại như nhân vật 3D
  //      đứng thẳng: thu nhỏ theo cos(góc nhìn xuống) để Pokémon và người chơi giữ đúng tỉ lệ như bản 2D
  // shade: độ sáng màu (tối đi khi trời tối)
  sync(scene, phaserSprite, ground, baseY = 0, fit = 1, shade = 1) {
    const visible = phaserSprite.visible && phaserSprite.alpha > 0.05;
    this.group.visible = visible;
    if (!visible) return;
    const tex = frameTexture(scene, phaserSprite.texture.key, phaserSprite.frame.name);
    if (!tex) return;
    this.group.position.set(toX(ground[0]), baseY, toZ(ground[1]));
    if (this.mon.blob) this.mon.blob.visible = baseY >= 0;
    const k = HEIGHT_SCALE * fit;
    this.mon.update({
      tex,
      w: (phaserSprite.displayWidth / CELL) * k,
      h: (phaserSprite.displayHeight / CELL) * k,
      flip: phaserSprite.flipX,
      lift: Math.max(0, (ground[1] - phaserSprite.y) / CELL) * HEIGHT_SCALE,
      angle: THREE.MathUtils.degToRad(phaserSprite.angle),
      alpha: phaserSprite.alpha,
      shade,
    });
  }
}

// Giải phóng bộ nhớ GPU của một cảnh bị bỏ khỏi bộ nhớ đệm: hình, vật liệu, texture riêng của cảnh, mặt đất vẽ sẵn.
// Thứ dùng chung (userData.shared) thì giữ; thứ dùng chung chưa đánh dấu nếu còn được cảnh khác dùng thì three.js
// tự nạp lại lên GPU ở lần vẽ sau, không hỏng gì.
const TEXTURE_KEYS = ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'bumpMap', 'roughnessMap'];
function disposeLevel(level) {
  const done = new Set();
  const free = (res) => {
    if (!res || done.has(res) || res.userData?.shared) return false;
    done.add(res);
    res.dispose();
    return true;
  };
  level.root.traverse((o) => {
    free(o.geometry);
    for (const m of [].concat(o.material ?? [])) {
      if (done.has(m) || m.userData.shared) continue;
      for (const key of TEXTURE_KEYS) free(m[key]);
      free(m);
    }
    o.userData.bake?.dispose();
  });
}

export class View3D {
  // container: chỗ đặt canvas 3D (nằm dưới canvas Phaser); badge: dòng chữ báo khu vực chưa có 3D
  constructor(game, container, { badge, fps } = {}) {
    this.game = game;
    this.badge = badge;
    this.fpsEl = fps;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    setBakeRenderer(this.renderer);
    this.canvas = this.renderer.domElement;
    Object.assign(this.canvas.style, { position: 'fixed', display: 'none' });
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color();
    this.scene.fog = new THREE.Fog(0xa8d4f4, 20, 50);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.light = { sky: new THREE.Color(), sun: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sunDir: new THREE.Vector3(), sunI: 0, hemiI: 0, night: 0 };

    this.camera = new THREE.PerspectiveCamera(30, GAME_WIDTH / GAME_HEIGHT, 0.1, 200);
    this.viewIndex = 0;
    this.zoom = 1;
    this.cam = { yaw: 0, elev: THREE.MathUtils.degToRad(VIEWS[0].elev), dist: VIEWS[0].dist, fov: VIEWS[0].fov, target: new THREE.Vector3() };

    // Hậu kỳ: tilt-shift làm mờ trên dưới như máy ảnh thu nhỏ
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.tiltH = new ShaderPass(HorizontalTiltShiftShader);
    this.tiltV = new ShaderPass(VerticalTiltShiftShader);
    this.tiltH.uniforms.r.value = this.tiltV.uniforms.r.value = 0.52;
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);
    this.composer.addPass(new OutputPass());

    // Hiệu ứng theo cảnh của game 2D: khói, khí cầu, cần câu, đèn soi trong gym tối, cửa trượt
    this.smoke = new Smoke(this.scene);
    this.balloon = buildBalloon();
    this.balloon.visible = false;
    this.fishing = buildFishingRig();
    this.fishing.group.visible = false;
    this.torch = new THREE.PointLight(0xfff0d0, 0, 4.2, 1.2);
    this.scene.add(this.balloon, this.fishing.group, this.torch);
    this.doorStates = new Map(); // toà nhà -> { value, target }
    this.doorRects = new WeakMap(); // hình cửa tối của bản 2D -> toà nhà
    this.balloonGround = null;

    this.level = null;
    this.levelId = null;
    this.levels = new Map(); // id bản đồ -> cảnh đã dựng (thứ tự: cũ nhất trước)
    this.prefetch = []; // bản đồ kế bên chờ dựng sẵn lúc rảnh
    this.prefetching = false;
    this.actors = new Map(); // nhân vật 2D (npc / 'player') -> Actor
    this.boards = new Map(); // hình Pokémon -> Billboard
    this.restore = []; // việc cần hoàn tác sau khi Phaser vẽ xong
    this.lastTime = performance.now();
    this.time = 0;
    this.fps = { frames: 0, time: 0 };
    this.rect = null;
    this.lastTile = null;
    this.snap = true;

    // Màn hình chính: cảnh nền 3D và mô hình nhân vật ở màn chọn nhân vật (TitleScene lấy qua registry)
    this.title = new TitleStage();
    game.registry.set('title3d', this.title);

    game.events.on('prerender', () => this.preRender());
    game.events.on('postrender', () => this.postRender());
  }

  nextView() {
    this.viewIndex = (this.viewIndex + 1) % VIEWS.length;
    return VIEWS[this.viewIndex].label;
  }

  zoomBy(f) {
    this.zoom = THREE.MathUtils.clamp(this.zoom * f, 0.5, 1.8);
  }

  preRender() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.time += dt;

    if (this.title.active && this.game.scene.isActive('Title')) {
      this.renderTitle(dt);
      return;
    }

    const world = this.game.scene.getScene('World');
    const sys = world?.sys;
    const running = Boolean(sys && (sys.isActive() || sys.isPaused()) && !sys.isSleeping() && world.map);
    const on = running && supports3D(world.map);
    this.canvas.style.display = on ? 'block' : 'none';
    if (this.badge) this.badge.style.display = running && !on ? 'block' : 'none';
    if (!on) return;

    if (this.levelId !== world.map.id) this.loadLevel(world.map);
    this.patchWorld(world);
    const walkers = this.syncCharacters(world, dt);
    this.syncEffects(world, dt);
    this.syncObjects();
    this.syncLight(world, dt);
    this.syncCamera(world, dt);
    this.level.update(this.time, dt, walkers);
    this.fitCanvas();
    this.composer.render();
    this.hide2D(world);

    this.fps.frames += 1;
    this.fps.time += dt;
    if (this.fps.time > 0.5 && this.fpsEl) {
      this.fpsEl.textContent = `3D • ${Math.round(this.fps.frames / this.fps.time)} FPS`;
      this.fps.frames = 0;
      this.fps.time = 0;
    }
  }

  // Màn hình chính: ô hình nhân vật 3D (màn chọn nhân vật) rồi cảnh nền đồi cỏ, cùng hậu kỳ tilt-shift với thế giới
  renderTitle(dt) {
    this.canvas.style.display = 'block';
    if (this.badge) this.badge.style.display = 'none';
    this.fitCanvas();
    this.title.update(dt);
    this.title.renderPortraits(this.renderer, dt);
    this.renderPass.scene = this.title.scene;
    this.renderPass.camera = this.title.camera;
    this.composer.render();
    this.renderPass.scene = this.scene;
    this.renderPass.camera = this.camera;
  }

  // Phaser vẽ xong: trả lại trạng thái cũ cho các đối tượng 2D đã ẩn / dời chỗ
  postRender() {
    for (const undo of this.restore) undo();
    this.restore = [];
  }

  buildLevel(map) {
    return map.cave ? buildCave(map) : map.indoor ? buildInterior(map) : buildWorld(map);
  }

  // Lấy cảnh của bản đồ từ bộ nhớ đệm (đã dựng sẵn) hoặc dựng mới
  loadLevel(map) {
    this.level?.root.removeFromParent();
    for (const a of [...this.actors.values(), ...this.boards.values()]) a.dispose();
    this.actors.clear();
    this.boards.clear();
    const level = this.levels.get(map.id) ?? this.buildLevel(map);
    this.levels.delete(map.id);
    this.levels.set(map.id, level);
    this.level = level;
    this.scene.add(level.root);
    this.levelId = map.id;
    this.snap = true;
    this.lastTile = null;
    this.smoke.clear();
    // cửa đang mở của bản đồ cũ thì bỏ; cửa vừa mở ngay khi ra khỏi nhà (cùng khung hình) vẫn giữ
    for (const [b] of this.doorStates) if (!map.buildings?.includes(b)) this.doorStates.delete(b);
    // Cảnh lấy từ bộ nhớ đệm: cửa còn mở từ lần trước (vào nhà rồi về bằng Escape Rope / thua trận) thì đóng lại
    for (const [b, door] of level.doors ?? []) if (!this.doorStates.has(b)) door.setOpen(0);
    this.trimLevels();
    // Bản đồ kế bên (cửa nhà, lối ra, cửa hang): dựng sẵn lúc rảnh để bước qua là có ngay
    const next = [...(map.warps ?? []).map((w) => w.to), ...(map.buildings ?? []).map((b) => b.to), map.exit?.to];
    this.prefetch = [...new Set(next)].filter((id) => id && MAPS[id] && !this.levels.has(id));
    this.schedulePrefetch();
  }

  schedulePrefetch() {
    if (this.prefetching || !this.prefetch.length) return;
    this.prefetching = true;
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
    idle(() => {
      this.prefetching = false;
      const id = this.prefetch.shift();
      if (id && !this.levels.has(id)) {
        const level = this.buildLevel(MAPS[id]);
        // vào sau bản đồ hiện tại trong thứ tự cũ-mới, để không bị bỏ trước bản đồ đang đứng
        this.levels.set(id, level);
        this.levels.delete(this.levelId);
        this.levels.set(this.levelId, this.level);
        this.trimLevels();
        // Biên dịch shader ở nền: lần đầu bước vào không bị khựng vì biên dịch
        this.renderer.compileAsync?.(level.root, this.camera, this.scene).catch(() => {});
      }
      this.schedulePrefetch();
    }, { timeout: 3000 });
  }

  // Bỏ bớt bản đồ cũ nhất khi quá số lượng (giải phóng bộ nhớ GPU)
  trimLevels() {
    for (const [id, level] of this.levels) {
      if (this.levels.size <= LEVEL_CACHE) break;
      if (level === this.level) continue;
      this.levels.delete(id);
      disposeLevel(level);
    }
  }

  // Bắt các cảnh của game 2D để diễn song song trong 3D (không đổi logic: vẫn gọi hàm gốc)
  patchWorld(world) {
    if (world.__view3d) return;
    world.__view3d = true;
    // WorldScene chạy lại (về màn hình chính rồi Tiếp tục) trên cùng bản đồ: dựng lại cảnh như vừa vào bản đồ
    // (camera / ánh sáng đặt ngay, bỏ trạng thái cửa cũ)
    world.events.on('create', () => {
      this.levelId = null;
      this.doorStates.clear();
    });
    // Vòng tròn đóng / mở khi ra vào hang: tâm ở người chơi trên cảnh 3D (camera 3D không bị chặn ở mép bản đồ như 2D)
    const screenPoint = world.playerScreenPoint.bind(world);
    world.playerScreenPoint = () => {
      const p = this.actors.get('player')?.group.position;
      if (!p) return screenPoint();
      const v = p.clone().add(new THREE.Vector3(0, 0.7, 0)).project(this.camera);
      return { x: ((v.x + 1) / 2) * GAME_WIDTH, y: ((1 - v.y) / 2) * GAME_HEIGHT };
    };
    // Máy hồi phục ở Pokémon Center sáng lên khi y tá hồi phục
    const showHeal = world.showHealPanel.bind(world);
    world.showHealPanel = (...args) => {
      this.level?.heal?.();
      return showHeal(...args);
    };
    // Cửa trượt: mở / đóng cùng nhịp với ô cửa tối của bản 2D
    const openDoor = world.openDoor.bind(world);
    world.openDoor = async (building, instant = false) => {
      this.doorStates.set(building, { value: instant ? 1 : (this.doorStates.get(building)?.value ?? 0), target: 1 });
      const door = await openDoor(building, instant);
      this.doorRects.set(door, building);
      return door;
    };
    const closeDoor = world.closeDoor.bind(world);
    world.closeDoor = (door) => {
      const st = this.doorStates.get(this.doorRects.get(door));
      if (st) st.target = 0;
      return closeDoor(door);
    };
    // Team Rocket ném bom khói
    const smokeEscape = world.smokeEscape.bind(world);
    world.smokeEscape = (npcs) => {
      for (const npc of npcs) this.smoke.burst(toX(npc.sprite.x), toZ(npc.sprite.y));
      return smokeEscape(npcs);
    };
    // Team Rocket chuồn bằng khí cầu: ghi lại mặt đất để biết độ cao của khí cầu và người nhảy vào giỏ
    const balloonEscape = world.balloonEscape.bind(world);
    world.balloonEscape = async (npcs) => {
      const ground = Math.max(...npcs.map((n) => n.sprite.y));
      for (const npc of npcs) npc.air = ground;
      this.balloonGround = ground;
      try {
        return await balloonEscape(npcs);
      } finally {
        this.balloonGround = null;
      }
    };
  }

  actorFor(id, key) {
    let a = this.actors.get(id);
    if (!a || a.key !== key) {
      a?.dispose();
      a = new Actor(this.scene, LOOKS[key] ? key : 'npc-boy');
      a.key = key;
      this.actors.set(id, a);
    }
    return a;
  }

  boardFor(id) {
    if (!this.boards.has(id)) this.boards.set(id, new Billboard(this.scene));
    return this.boards.get(id);
  }

  syncCharacters(world, dt) {
    const walkers = [];
    // Sprite Pokémon: thu nhỏ theo góc nhìn xuống của camera (xem Billboard.sync), tối đi theo trời ngoài trời
    const fit = Math.cos(this.cam.elev);
    const shade = world.map.indoor || world.map.cave ? 1 : 1 - this.light.night * 0.35;
    const alive = new Set(['player', 'follower', 'mount']);
    // Người chơi: đi bộ, đạp xe, lướt nước (ngồi trên khối nước), cưỡi thú (ngồi trên lưng)
    const ps = world.player;
    const vehicle = world.vehicle;
    const ground = world.onWater?.() ? WATER_LEVEL : 0;
    const player = this.actorFor('player', ps.texture.key.replace('-bike', ''));
    const mount = this.boardFor('mount');
    const riding = (vehicle === 'ride' || vehicle === 'waterRide') && world.mountSprite?.visible;
    if (riding) mount.sync(world, world.mountSprite, [world.mountSprite.x, ps.y], ground, fit, shade);
    else mount.group.visible = false;
    // Ngồi ngang lưng thú cưỡi: nửa chiều cao sprite trên màn hình, đổi ra độ cao thật (độ cao bị camera làm ngắn theo fit)
    const seat = riding ? (mount.height * 0.5) / fit : 0;
    player.sync(toX(ps.x), toZ(ps.y), world.facing, ps.visible && ps.alpha > 0.35, dt, {
      y: ground + seat,
      mode: vehicle === 'bike' ? 'bike' : vehicle ? 'sit' : 'walk',
      ride: vehicle === 'bike' ? 'bike' : vehicle === 'surf' ? 'surf' : null,
    });
    walkers.push(player.group.position);

    for (const npc of world.npcs) {
      alive.add(npc);
      if (npc.def.mon) {
        const board = this.boardFor(npc);
        board.sync(world, npc.sprite, [npc.sprite.x, npc.sprite.y], 0, fit, shade);
        walkers.push(board.group.position);
      } else if (npc.def.seated) {
        // Ngồi trên sofa (mẹ): đặt theo ô (hình 2D đã bị hạ xuống / lùi lại cho giống ngồi), lùi sát lưng ghế
        const a = this.actorFor(npc, npc.def.sprite);
        const [dx, dz] = FACE_DIR[npc.facing];
        a.sync(npc.pos.x + 0.5 - dx * SEAT_BACK, npc.pos.y + 0.5 - dz * SEAT_BACK, npc.facing, npc.sprite.visible && npc.sprite.alpha > 0.35, dt, { y: SEAT_Y, mode: 'seat' });
        walkers.push(a.group.position);
      } else {
        const a = this.actorFor(npc, npc.def.sprite);
        // Đang nhảy vào giỏ khí cầu: hình 2D đi lên = bay lên cao, không phải đi về phía bắc
        const air = npc.air ?? null;
        const y = air === null ? 0 : Math.max(0, ((air - npc.sprite.y) / CELL) * HEIGHT_SCALE);
        a.sync(toX(npc.sprite.x), toZ(air ?? npc.sprite.y), npc.facing, npc.sprite.visible && npc.sprite.alpha > 0.35, dt, { y });
        walkers.push(a.group.position);
      }
    }
    if (world.map.dark) {
      const p = player.group.position;
      for (const [id, a] of this.actors) if (id !== 'player' && a.group.position.distanceTo(p) > DARK_RADIUS) a.group.visible = false;
      for (const b of this.boards.values()) if (b.group.position.distanceTo(p) > DARK_RADIUS) b.group.visible = false;
    }
    for (const [id, a] of this.actors) if (!alive.has(id)) (a.dispose(), this.actors.delete(id));
    for (const [id, b] of this.boards) if (!alive.has(id)) (b.dispose(), this.boards.delete(id));

    // Pokémon đi theo
    const f = world.follower;
    const follower = this.boardFor('follower');
    if (f?.ground && world.followerMon?.() && f.sprite.visible) {
      follower.sync(world, f.sprite, f.ground, 0, fit, shade);
      walkers.push(follower.group.position);
    } else follower.group.visible = false;
    // Bước vào bụi cỏ: lá bay
    const tile = `${world.pos.x},${world.pos.y}`;
    if (tile !== this.lastTile) {
      if (this.lastTile && world.map.info(world.pos.x, world.pos.y).encounter && !world.map.indoor) this.level.rustle(world.pos.x + 0.5, world.pos.y + 0.5);
      this.lastTile = tile;
    }
    return walkers;
  }

  // Cửa trượt, khói, khí cầu, cần câu: lấy theo các hình tương ứng của bản 2D đang có trên bản đồ
  syncEffects(world, dt) {
    for (const [building, st] of this.doorStates) {
      st.value += Math.sign(st.target - st.value) * Math.min(Math.abs(st.target - st.value), dt / DOOR_SECONDS);
      this.level.doors?.get(building)?.setOpen(st.value);
      if (st.value === 0 && st.target === 0) this.doorStates.delete(building);
    }
    this.smoke.update(dt);

    let balloon2d = null;
    let bobber2d = null;
    let alert = false;
    for (const o of world.children.list) {
      if (o.texture?.key === 'fx-balloon') balloon2d = o;
      else if (o.type === 'Arc' && o.fillColor === 0xe04040 && o.radius === 4) bobber2d = o; // phao câu
      else if (o.texture?.key === 'fx-alert' && o.visible) alert = true;
    }
    // Khí cầu: đáy giỏ của hình 2D cách mặt đất bao nhiêu thì khí cầu 3D bay cao bấy nhiêu
    this.balloon.visible = Boolean(balloon2d && this.balloonGround !== null);
    if (this.balloon.visible) {
      const g = this.balloonGround;
      this.balloon.position.set(toX(balloon2d.x), Math.max(0, ((g + CELL / 2 - balloon2d.y) / CELL) * 1.4), toZ(g));
      this.balloon.rotation.z = Math.sin(this.time * 3) * 0.05;
    }
    // Câu cá: cần trên tay người chơi, phao ở ô nước trước mặt; cá cắn (dấu "!") thì phao giật chìm
    this.fishing.group.visible = Boolean(bobber2d);
    if (bobber2d) {
      const p = this.actors.get('player').group.position;
      const dir = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[world.facing];
      const hand = new THREE.Vector3(p.x + dir[0] * 0.25, p.y + 0.75, p.z + dir[1] * 0.25);
      const float = new THREE.Vector3(world.pos.x + 0.5 + dir[0] * 1.2, WATER_LEVEL + 0.03, world.pos.y + 0.5 + dir[1] * 1.2);
      this.fishing.update(hand, dir, float, alert, this.time);
    }
  }

  // Vật phẩm, cây quả, bình Pokémon khởi đầu: ẩn / hiện theo trạng thái game (đã nhặt, cốt truyện, quả chín)
  syncObjects() {
    for (const [o, { node, fruits, setOn }] of this.level.objectNodes) {
      node.visible = objectVisible(o);
      setOn?.(Boolean(o.flag && hasFlag(o.flag))); // công tắc trong gym: sáng khi đã bật
      if (fruits) {
        const stage = berryStage(o.id);
        for (const fr of fruits) {
          fr.visible = stage !== 'bare';
          fr.scale.setScalar(stage === 'ripe' ? 1 : 0.6);
        }
      }
    }
  }

  syncLight(world, dt) {
    const outdoor = !world.map.indoor && !world.map.cave;
    const phase = this.forceTime ?? (settings.ambience === false ? 'day' : timeOfDay());
    const base = world.map.cave ? CAVE : outdoor ? TIMES[phase] : INDOOR;
    const wl = outdoor ? WEATHER_LIGHT[world.ambience?.state?.weather] : null;
    let target = wl ? { ...base, sky: wl.sky, sunI: base.sunI * wl.sunI, hemiI: base.hemiI * wl.hemiI } : base;
    this.weatherFog = wl?.fog ?? 1;
    // Gym tối: gần như tối đen, chỉ có quầng sáng quanh người chơi (như vòng sáng của bản 2D)
    if (world.map.dark) target = { ...target, sky: 0x000000, sunI: 0.04, hemiI: 0.05 };
    this.torch.intensity = world.map.dark ? 3.5 : 0;
    this.torch.position.copy(this.actors.get('player').group.position).add(new THREE.Vector3(0, 2.3, 0.6));
    const k = this.snap ? 1 : 1 - Math.exp(-dt * 2);
    const L = this.light;
    for (const key of ['sky', 'sun', 'hemiSky', 'hemiGround']) L[key].lerp(new THREE.Color(target[key]), k);
    L.sunDir.lerp(new THREE.Vector3(...target.sunDir), k);
    for (const key of ['sunI', 'hemiI', 'night']) L[key] += (target[key] - L[key]) * k;
    this.scene.background.copy(L.sky);
    this.scene.fog.color.copy(L.sky);
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiI;
    this.sun.color.copy(L.sun);
    this.sun.intensity = L.sunI;
    this.level.setNight(L.night);
  }

  syncCamera(world, dt) {
    const view = VIEWS[this.viewIndex];
    const { cam, camera } = this;
    const ease = this.snap ? 1 : 1 - Math.exp(-dt * 6);
    cam.elev += (THREE.MathUtils.degToRad(view.elev) - cam.elev) * ease;
    cam.fov += (view.fov - cam.fov) * ease;
    // Nửa bề ngang nhìn thấy trên mỗi đơn vị khoảng cách camera
    const spread = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * camera.aspect;
    const indoor = world.map.indoor;
    const roomW = world.map.width + INDOOR_WALL * 2; // cả hai vách bên
    let dist = view.dist * this.zoom * (indoor ? 0.95 : 1);
    // Trong nhà: lùi camera ra một chút (có giới hạn) để thấy trọn bề ngang căn phòng
    if (indoor) dist = Math.min(Math.max(dist, roomW / 2 / spread), dist * INDOOR_FIT_MAX);
    cam.dist += (dist - cam.dist) * ease;
    const focus = this.actors.get('player').group.position.clone();
    if (indoor) {
      // Chiều sâu: kéo về giữa phòng để thấy cả tường sau. Bề ngang: phòng vừa khung hình thì đặt giữa,
      // không vừa thì đi theo người chơi nhưng không để lộ khoảng tối ngoài vách hai bên
      focus.z += (world.map.height / 2 - focus.z) * 0.6;
      const half = cam.dist * spread;
      const minX = half - INDOOR_WALL;
      const maxX = world.map.width + INDOOR_WALL - half;
      focus.x = minX >= maxX ? world.map.width / 2 : THREE.MathUtils.clamp(focus.x, minX, maxX);
    }
    cam.target.lerp(focus, this.snap ? 1 : 1 - Math.exp(-dt * 8));
    this.snap = false;
    const look = cam.target.clone().add(new THREE.Vector3(0, 0.6, 0));
    camera.position.set(look.x, look.y + Math.sin(cam.elev) * cam.dist, look.z + Math.cos(cam.elev) * cam.dist);
    camera.lookAt(look);
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
    const enclosed = world.map.indoor || world.map.cave;
    const fog = this.weatherFog ?? 1;
    this.scene.fog.near = enclosed ? 500 : cam.dist * 1.4 * fog;
    this.scene.fog.far = enclosed ? 600 : cam.dist * 3.4 * fog;
    // Bóng đổ đi theo người chơi để luôn sắc nét
    this.sun.target.position.copy(cam.target);
    this.sun.position.copy(cam.target).add(this.light.sunDir);
  }

  // Canvas 3D trùng khít canvas Phaser (cùng tỉ lệ 4:3, cùng chỗ trên trang)
  fitCanvas() {
    const r = this.game.canvas.getBoundingClientRect();
    const key = `${r.left},${r.top},${r.width},${r.height}`;
    if (key === this.rect) return;
    this.rect = key;
    Object.assign(this.canvas.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    this.renderer.setSize(r.width, r.height, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(r.width, r.height);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    this.tiltH.uniforms.h.value = 1.4 / r.width;
    this.tiltV.uniforms.v.value = 1.4 / r.height;
  }

  // Ẩn phần thế giới 2D trong lúc Phaser vẽ; hiệu ứng nổi (dấu "!", icon nhận đồ) dời tới chỗ tương ứng trên cảnh 3D
  hide2D(world) {
    const hide = (obj) => {
      obj.visible = false;
      this.restore.push(() => (obj.visible = true));
    };
    // Điểm bám của hiệu ứng nổi: chân nhân vật (x, y px của bản 2D), k: độ phóng to của hình bên cảnh 3D
    const anchors = [
      { x: world.player.x, y: world.player.y, k: 1 },
      ...world.npcs.map((n) => ({ x: n.sprite.x, y: n.sprite.y, k: 1 })),
    ];
    const f = world.follower;
    if (f?.ground && f.sprite.visible) anchors.push({ x: f.ground[0], y: f.ground[1], k: 1 });
    const cam = world.cameras.main;
    const v = new THREE.Vector3();
    for (const obj of world.children.list) {
      if (!obj.visible) continue;
      if (obj === world.ambience?.overlay) hide(obj); // ánh sáng ngày đêm đã có trong cảnh 3D
      else if (obj.scrollFactorX === 0) continue; // giao diện cố định trên màn hình
      else if (obj.depth < OVERLAY_DEPTH) hide(obj);
      else {
        // Hiệu ứng nằm trên đầu một nhân vật: tính độ cao so với chân nhân vật đó
        // Gần nhất theo chiều ngang; cùng cột (Pokémon đứng trước / sau người chơi) thì lấy nhân vật ngay bên dưới hiệu ứng
        let best = null;
        for (const s of anchors) {
          const dx = Math.abs(s.x - obj.x);
          const up = s.y - obj.y;
          if (dx >= CELL * 0.8 || up <= -4 || up >= CELL * 3) continue;
          if (!best || dx < best.dx - 1 || (Math.abs(dx - best.dx) <= 1 && up < best.up)) best = { s, dx, up };
        }
        if (best) v.set(toX(best.s.x), (best.up / CELL) * HEIGHT_SCALE * best.s.k, toZ(best.s.y));
        else v.set(toX(obj.x), 0, toZ(obj.y));
        v.project(this.camera);
        const p = cam.getWorldPoint(((v.x + 1) / 2) * GAME_WIDTH, ((1 - v.y) / 2) * GAME_HEIGHT);
        const { x, y } = obj;
        obj.x = p.x;
        obj.y = p.y;
        this.restore.push(() => {
          obj.x = x;
          obj.y = y;
        });
      }
    }
  }
}
