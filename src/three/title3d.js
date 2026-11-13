import * as THREE from 'three';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { buildCharacter, disposeModel } from './character.js';
import { MonSprite } from './monSprite.js';

// Màn hình chính của bản 3D (View3D vẽ khi màn hình chính đang mở, TitleScene gọi qua game.registry 'title3d'):
//  - cảnh nền 3D phía sau logo và menu: đồi cỏ dưới trời xanh, cây, hoa, mây trôi, camera lắc nhẹ;
//    3 Pokémon là sprite kiểu GBA (monSprite.js): nhún nhảy, thỉnh thoảng quay qua quay lại
//  - màn chọn nhân vật: mô hình 3D nhân vật nam / nữ đứng trên bệ tròn trong thẻ chọn. Nhân vật đang chọn
//    quay ra vẫy tay, nhân vật kia xoay chậm. Mỗi khung hình vẽ vào một canvas 2D làm texture cho thẻ bên Phaser.

const MON_HEIGHT = 1.35; // chiều cao hình Pokémon (đơn vị cảnh)
const PORTRAIT = { w: 196, h: 206 }; // cỡ ô hình nhân vật trong thẻ chọn (px của game 960x720)
const PORTRAIT_BG = { on: 0xdde8ff, off: 0xf2f4f8 }; // trùng màu thẻ chọn của TitleScene
const PEDESTAL = { on: 0x4a88e0, off: 0xc8ccd8 };
const CHAR_SCALE = 1.22; // như Actor (actor.js)
// Đồi cỏ: chỏm cầu bán kính r, dẹt theo chiều đứng, phủ tới góc arc (radian); edge: bán kính chân đồi
const HILL = { r: 10, flat: 0.35, arc: 0.9 };
HILL.edge = HILL.r * Math.sin(HILL.arc);
// Độ cao mặt đồi ở khoảng cách d tính từ đỉnh (ngoài chân đồi là đồng cỏ phẳng)
const hillY = (d) => HILL.flat * (Math.sqrt(HILL.r ** 2 - Math.min(d, HILL.edge) ** 2) - HILL.r);

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3a78d0');
  g.addColorStop(0.55, '#8cc4f0');
  g.addColorStop(1, '#e8f4fc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const shade = (m) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

function buildTree(x, y, z, s) {
  const g = new THREE.Group();
  const trunk = shade(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 8), lambert(0x7a4e2c)));
  trunk.position.y = 0.55;
  g.add(trunk);
  for (const [dx, dy, r, c] of [[0, 1.45, 0.8, 0x3e9a3a], [0.35, 1.95, 0.55, 0x52b048], [-0.3, 1.85, 0.5, 0x48a640]]) {
    const leaf = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), lambert(c, { flatShading: true })));
    leaf.position.set(dx, dy, 0);
    g.add(leaf);
  }
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  return g;
}

function buildCloud(seed) {
  const g = new THREE.Group();
  const mat = lambert(0xffffff, { emissive: 0x8a9ab0 });
  for (let i = 0; i < 5; i++) {
    const r = 0.6 + ((seed * 7 + i * 3) % 5) * 0.12;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
    puff.position.set((i - 2) * 0.7, Math.sin(i * 1.7 + seed) * 0.2, (i % 2) * 0.3);
    puff.scale.y = 0.7;
    g.add(puff);
  }
  return g;
}

// Ô hình nhân vật 3D trong thẻ chọn: cảnh nhỏ riêng (bệ tròn, mô hình, đèn), vẽ ra canvas 2D
class Portrait {
  constructor(key, scale) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(PORTRAIT.w * scale);
    this.canvas.height = Math.round(PORTRAIT.h * scale);
    this.ctx = this.canvas.getContext('2d');
    this.selected = false;
    this.onDraw = null;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PORTRAIT_BG.off);
    const sun = new THREE.DirectionalLight(0xfff4e4, 2.4);
    this.sun = sun;
    sun.position.set(-1.5, 3, 2.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    Object.assign(sun.shadow.camera, { left: -1.2, right: 1.2, top: 1.8, bottom: -0.4, near: 0.5, far: 8 });
    sun.shadow.bias = -0.0005;
    const rim = new THREE.DirectionalLight(0xc8e0ff, 1.4);
    rim.position.set(2, 2, -2);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8aa0, 1.3), sun, rim);
    this.pedestalMat = new THREE.MeshLambertMaterial({ color: PEDESTAL.off });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.12, 40), this.pedestalMat);
    pedestal.position.y = -0.06;
    pedestal.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.46, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    top.position.y = 0.002;
    top.receiveShadow = true;
    this.scene.add(pedestal, top);
    this.model = buildCharacter(key);
    this.model.root.scale.setScalar(CHAR_SCALE);
    this.scene.add(this.model.root);
    this.camera = new THREE.PerspectiveCamera(30, PORTRAIT.w / PORTRAIT.h, 0.1, 20);
    this.camera.position.set(0, 1.15, 3.6);
    this.camera.lookAt(0, 0.72, 0);
    this.yaw = 0;
    this.time = Math.random() * 3;
  }

  update(dt) {
    this.time += dt;
    const root = this.model.root;
    // Đang chọn: quay ra phía trước, vẫy tay • không chọn: xoay chậm như trên bàn xoay
    const target = this.selected ? 0 : this.yaw + dt * 0.9;
    let d = target - root.rotation.y;
    if (this.selected) d = Math.atan2(Math.sin(d), Math.cos(d));
    root.rotation.y += this.selected ? d * Math.min(1, dt * 8) : d;
    this.yaw = root.rotation.y;
    this.model.pose(0, 0, this.time, this.selected ? 'cheer' : 'walk');
    this.scene.background.setHex(this.selected ? PORTRAIT_BG.on : PORTRAIT_BG.off);
    this.pedestalMat.color.setHex(this.selected ? PEDESTAL.on : PEDESTAL.off);
  }

  dispose() {
    this.sun.dispose(); // bản đồ bóng của đèn
    disposeModel(this.scene);
  }
}

export class TitleStage {
  constructor() {
    this.active = false;
    this.scene = new THREE.Scene();
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(0xcfe6f7, 16, 46);
    this.camera = new THREE.PerspectiveCamera(32, GAME_WIDTH / GAME_HEIGHT, 0.1, 120);
    this.time = 0;
    this.mons = [];
    this.portraits = [];

    const hemi = new THREE.HemisphereLight(0xdcecff, 0x5a7a40, 1.15);
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
    sun.position.set(-4, 9, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 30 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(hemi, sun);

    // Đồi cỏ: chỏm cầu dẹt, đỉnh ở y = 0 giữa cảnh; quanh chân đồi là đồng cỏ phẳng
    const hill = new THREE.Mesh(new THREE.SphereGeometry(HILL.r, 64, 24, 0, Math.PI * 2, 0, HILL.arc), lambert(0x6cc04a));
    hill.scale.y = HILL.flat;
    hill.position.y = -HILL.r * HILL.flat;
    hill.receiveShadow = true;
    const field = new THREE.Mesh(new THREE.CircleGeometry(80, 48).rotateX(-Math.PI / 2), lambert(0x5aa840));
    field.position.y = hillY(HILL.edge) - 0.01;
    field.receiveShadow = true;
    this.scene.add(hill, field);
    // Đồi xa phía sau (sương làm nhạt dần)
    for (const [x, z, r, c] of [[-14, -22, 9, 0x4a9a50], [6, -28, 12, 0x3e8a58], [20, -20, 8, 0x58a850], [-30, -30, 13, 0x4a8a68]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), lambert(c));
      m.scale.y = 0.45;
      m.position.set(x, -1.2, z);
      this.scene.add(m);
    }
    // Cây hai bên và phía sau
    for (const [x, z, s] of [[-5.2, -2.5, 1.1], [-4.1, -4.4, 0.9], [4.9, -2.8, 1.15], [6.2, -1.2, 0.85], [3.8, -5.2, 0.95], [-6.5, -0.6, 0.8]]) {
      this.scene.add(buildTree(x, hillY(Math.hypot(x, z)), z, s));
    }
    // Hoa và bụi cỏ rải trên đồi
    const flowerGeo = new THREE.IcosahedronGeometry(0.07, 0);
    const tuftGeo = new THREE.ConeGeometry(0.08, 0.22, 5);
    const flowers = new THREE.InstancedMesh(flowerGeo, lambert(0xffffff, { flatShading: true }), 90);
    const tufts = new THREE.InstancedMesh(tuftGeo, lambert(0x4a9a38, { flatShading: true }), 140);
    const m = new THREE.Matrix4();
    const colors = [0xf06a8a, 0xf8d040, 0xffffff, 0x8ab8f0];
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const onHill = (x, z) => hillY(Math.hypot(x, z));
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 1.2 + rnd() * 5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.8;
      m.makeTranslation(x, onHill(x, z) + 0.06, z);
      flowers.setMatrixAt(i, m);
      flowers.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    for (let i = 0; i < 140; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.8 + rnd() * 6;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.8;
      m.makeTranslation(x, onHill(x, z) + 0.1, z);
      tufts.setMatrixAt(i, m);
    }
    flowers.receiveShadow = tufts.receiveShadow = true;
    this.scene.add(flowers, tufts);
    // Mây trôi
    this.clouds = [0, 1, 2, 3].map((i) => {
      const c = buildCloud(i);
      c.position.set(-12 + i * 8, 6 + (i % 2) * 1.5, -14 - (i % 3) * 3);
      this.scene.add(c);
      return c;
    });
  }

  // TitleScene (bản 3D) vào màn hình chính: mons = [{ key, flip }] là texture Pokémon của Phaser, trái sang phải
  enter(phaserScene, mons) {
    this.leave();
    this.active = true;
    this.mons = mons.map(({ key, flip }, i) => {
      const img = phaserScene.textures.get(key).getSourceImage();
      const tex = new THREE.CanvasTexture(img);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new MonSprite(this.scene);
      sprite.group.position.set((i - (mons.length - 1) / 2) * 2.15, 0, i === 1 ? 0.35 : 0);
      return { sprite, tex, flip, w: MON_HEIGHT * (img.width / img.height), phase: i * 1.3 };
    });
  }

  leave() {
    this.active = false;
    for (const m of this.mons) {
      m.sprite.dispose();
      m.tex.dispose();
    }
    this.mons = [];
    this.closePortraits();
  }

  // Màn chọn nhân vật: keys = kiểu nhân vật ('player', 'player-f'). Trả về các ô hình { canvas, selected, onDraw }
  openPortraits(keys, scale = 2) {
    this.closePortraits();
    this.portraits = keys.map((key) => new Portrait(key, scale));
    return this.portraits;
  }

  closePortraits() {
    for (const p of this.portraits) p.dispose();
    this.portraits = [];
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    // Camera lắc qua lại nhẹ quanh ngọn đồi
    const yaw = Math.sin(t * 0.18) * 0.2;
    const R = 9.2;
    this.camera.position.set(Math.sin(yaw) * R, 2.5, Math.cos(yaw) * R);
    this.camera.lookAt(0, 0.35, 0);
    for (const c of this.clouds) {
      c.position.x += dt * 0.35;
      if (c.position.x > 18) c.position.x = -18;
    }
    // Pokémon: nhảy nhẹ lệch nhịp nhau như sprite GBA (không co giãn), mỗi ~6 giây quay sang hướng kia một lúc
    for (const m of this.mons) {
      const hop = Math.max(0, Math.sin(t * 2.2 + m.phase));
      const turned = Math.floor((t + m.phase * 2) / 6) % 2 === 1;
      m.sprite.update({ tex: m.tex, w: m.w, h: MON_HEIGHT, flip: m.flip !== turned, lift: hop * hop * 0.28 });
    }
  }

  // Vẽ các ô hình nhân vật (nếu đang mở màn chọn): mỗi ô vẽ vào góc dưới trái canvas 3D rồi chép sang canvas 2D.
  // Phải gọi trước khi vẽ cảnh nền (cảnh nền vẽ đè lên toàn bộ canvas).
  renderPortraits(renderer, dt) {
    if (!this.portraits.length) return;
    const canvas = renderer.domElement;
    const pr = renderer.getPixelRatio();
    const size = renderer.getSize(new THREE.Vector2());
    renderer.setScissorTest(true);
    for (const p of this.portraits) {
      const w = Math.min(p.canvas.width, canvas.width);
      const h = Math.min(p.canvas.height, canvas.height);
      renderer.setViewport(0, 0, w / pr, h / pr);
      renderer.setScissor(0, 0, w / pr, h / pr);
      p.update(dt);
      renderer.render(p.scene, p.camera);
      p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
      p.ctx.drawImage(canvas, 0, canvas.height - h, w, h, 0, 0, p.canvas.width, p.canvas.height);
      p.onDraw?.();
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
  }
}
