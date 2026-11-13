import * as THREE from 'three';
import { makeCanvas } from './canvas.js';

// Đồ dùng chung cho cảnh trong nhà (interior3d.js, gymProps.js) và hang động (cave3d.js)

export const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });
// Vật phát sáng (tia điện, lửa, vòng dịch chuyển): không chịu ánh sáng, cộng màu cho rực
export const glowMat = (color, opacity = 1, extra = {}) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, ...extra });

export function shadowed(m, cast = true) {
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

export function box(w, h, d, mat, x, y, z) {
  const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  m.position.set(x, y, z);
  return m;
}

export function cyl(rt, rb, h, mat, x, y, z, seg = 16) {
  const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat));
  m.position.set(x, y, z);
  return m;
}

export function canvasTex(w, h, draw, repeat = null) {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.imageSmoothingEnabled = true;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  return tex;
}

// Gom các vật giống nhau (cùng hình, cùng vật liệu) thành InstancedMesh: vài chục cột / cọc tre chỉ tốn một lần vẽ
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
export class Instancer {
  constructor() {
    this.groups = new Map();
  }

  add(geo, mat, x, y, z, { rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s, color = null } = {}) {
    const key = `${geo.uuid}|${mat.uuid}`;
    if (!this.groups.has(key)) this.groups.set(key, { geo, mat, items: [] });
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.groups.get(key).items.push({ matrix: _m.clone(), color });
  }

  build(parent, { cast = true } = {}) {
    for (const { geo, mat, items } of this.groups.values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => {
        mesh.setMatrixAt(i, it.matrix);
        if (it.color !== null) mesh.setColorAt(i, new THREE.Color(it.color));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      shadowed(mesh, cast);
      parent.add(mesh);
    }
    this.groups.clear();
  }
}

// Phòng tối (Gym Núi Đá, phòng Thiên Vương Huyền) và hang động: tối dần theo khoảng cách tới người chơi.
// Gắn vào shader của mọi vật liệu có ánh sáng; phần tự phát sáng (đèn, tinh thể, lửa) vẫn sáng trong bóng tối.
export function makeDarkness({ inner, outer, floor }) {
  const uniforms = {
    uDarkCenter: { value: new THREE.Vector2(-999, -999) },
    uDarkRange: { value: new THREE.Vector3(inner, outer, floor) },
  };
  const patch = (mat) => {
    if (mat.userData.dark || !(mat.isMeshStandardMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return;
    mat.userData.dark = true;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDarkXZ;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 darkW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            darkW = instanceMatrix * darkW;
          #endif
          vDarkXZ = (modelMatrix * darkW).xz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vDarkXZ;\nuniform vec2 uDarkCenter;\nuniform vec3 uDarkRange;')
        .replace(
          '#include <opaque_fragment>',
          `float darkK = 1.0 - smoothstep(uDarkRange.x, uDarkRange.y, distance(vDarkXZ, uDarkCenter));
          outgoingLight = (outgoingLight - totalEmissiveRadiance) * mix(uDarkRange.z, 1.0, darkK) + totalEmissiveRadiance;
          #include <opaque_fragment>`,
        );
    };
    mat.customProgramCacheKey = () => 'room-darkness';
    mat.needsUpdate = true;
  };
  return {
    uniforms,
    apply(root) {
      root.traverse((o) => {
        if (!o.material) return;
        for (const m of [].concat(o.material)) patch(m);
      });
    },
    follow(pos) {
      if (pos) uniforms.uDarkCenter.value.set(pos.x, pos.z);
    },
  };
}

// Ảnh môi trường giả (hộp 6 mặt vẽ bằng canvas) cho mặt băng, mặt nước, sàn đá bóng phản chiếu ánh đèn
let envCache = null;
export function fakeEnv() {
  if (envCache) return envCache;
  const face = (top, bottom, bands) => {
    const { canvas, ctx } = makeCanvas(64, 64);
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    if (bands) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(10, 14, 14, 22);
      ctx.fillRect(38, 14, 14, 22);
    }
    return canvas;
  };
  const side = face('#f4f8ff', '#8a96a8', true);
  envCache = new THREE.CubeTexture([side, side, face('#ffffff', '#ffffff'), face('#606870', '#606870'), side, side]);
  envCache.colorSpace = THREE.SRGBColorSpace;
  envCache.needsUpdate = true;
  return envCache;
}

// Vật phẩm rơi trên đất: viên ngọc vàng xoay, quầng sáng dưới chân (giống world3d.js buildItem)
const gemGeo = new THREE.OctahedronGeometry(0.16);
const gemGlowGeo = new THREE.CircleGeometry(0.28, 16).rotateX(-Math.PI / 2);
export function buildGem(o) {
  const g = new THREE.Group();
  const gem = shadowed(new THREE.Mesh(gemGeo, new THREE.MeshLambertMaterial({ color: 0xffd040, emissive: 0x6a4a00, flatShading: true })));
  gem.scale.set(1, 1.4, 1);
  const glow = new THREE.Mesh(gemGlowGeo, new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.35, depthWrite: false }));
  glow.position.y = 0.02;
  g.add(gem, glow);
  g.position.set(o.x + 0.5, 0, o.y + 0.5);
  return {
    group: g,
    update(t) {
      gem.rotation.y = t * 1.8;
      gem.position.y = 0.35 + Math.sin(t * 2.4 + o.x) * 0.06;
    },
  };
}

// Poké Ball 3D: nửa trên đỏ bóng, nửa dưới trắng, đai đen ở giữa, nút tròn quay về phía camera (+z).
// Đặt trên đế tròn nhỏ; thỉnh thoảng lắc nhẹ như có Pokémon cựa quậy bên trong (update(t)).
const BALL_R = 0.155;
const halfGeo = (bottom) => new THREE.SphereGeometry(BALL_R, 32, 16, 0, Math.PI * 2, bottom ? Math.PI / 2 : 0, Math.PI / 2);
const ballGeo = {
  top: halfGeo(false),
  bottom: halfGeo(true),
  band: new THREE.CylinderGeometry(BALL_R * 1.015, BALL_R * 1.015, BALL_R * 0.17, 32, 1, true),
  ring: new THREE.CylinderGeometry(BALL_R * 0.38, BALL_R * 0.38, BALL_R * 0.12, 28).rotateX(Math.PI / 2),
  button: new THREE.CylinderGeometry(BALL_R * 0.25, BALL_R * 0.25, BALL_R * 0.12, 28).rotateX(Math.PI / 2),
  stand: new THREE.TorusGeometry(BALL_R * 0.62, BALL_R * 0.16, 8, 24).rotateX(Math.PI / 2),
  halo: new THREE.CircleGeometry(BALL_R * 2.1, 24).rotateX(-Math.PI / 2),
};
export function buildBall({ seed = 0, top = 0xe23a3a } = {}) {
  const env = fakeEnv();
  const shiny = (color, roughness) => std(color, { roughness, metalness: 0.05, envMap: env, envMapIntensity: 0.55 });
  const black = std(0x1c1c22, { roughness: 0.45 });
  const white = shiny(0xf6f6f8, 0.3);
  const g = new THREE.Group();
  const ball = new THREE.Group();
  ball.add(
    shadowed(new THREE.Mesh(ballGeo.top, shiny(top, 0.22))),
    shadowed(new THREE.Mesh(ballGeo.bottom, white)),
    new THREE.Mesh(ballGeo.band, black),
  );
  const ring = new THREE.Mesh(ballGeo.ring, black);
  ring.position.z = BALL_R * 0.97;
  const button = new THREE.Mesh(ballGeo.button, std(0xffffff, { roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.15 }));
  button.position.z = BALL_R * 1.04;
  ball.add(ring, button);
  ball.position.y = BALL_R * 1.02;
  // Nghiêng ra sau một chút để camera nhìn từ trên vẫn thấy cả nửa đỏ lẫn nút giữa
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.3;
  tilt.add(ball);
  const stand = new THREE.Mesh(ballGeo.stand, std(0x3a4250, { roughness: 0.4, metalness: 0.4 }));
  stand.position.y = BALL_R * 0.12;
  const halo = new THREE.Mesh(ballGeo.halo, new THREE.MeshBasicMaterial({ color: 0xfff4c0, transparent: true, opacity: 0.22, depthWrite: false }));
  halo.position.y = 0.004;
  g.add(halo, stand, tilt);
  return {
    group: g,
    update(t) {
      // Mỗi ~4 giây lắc qua lại 3 nhịp rồi nằm yên
      const k = (t + seed * 1.37) % 4;
      ball.rotation.z = k < 0.6 ? Math.sin(k * Math.PI * 5) * 0.22 * (1 - k / 0.6) : 0;
      halo.material.opacity = 0.16 + Math.sin(t * 2.2 + seed) * 0.06;
    },
  };
}

// Tia điện ngoằn ngoèo giữa hai điểm, vẽ lại liên tục cho có cảm giác lách tách
export class Sparks {
  constructor(color = 0xfff27a, segs = 7) {
    this.segs = segs;
    this.arcs = [];
    this.geo = new THREE.BufferGeometry();
    this.mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(this.geo, this.mat);
    this.lines.frustumCulled = false;
  }

  arc(a, b, jitter = 0.08) {
    this.arcs.push({ a: new THREE.Vector3(...a), b: new THREE.Vector3(...b), jitter });
  }

  finish() {
    this.pos = new Float32Array(this.arcs.length * this.segs * 6);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.reshape();
    return this.lines;
  }

  reshape() {
    const { segs, pos } = this;
    let i = 0;
    const p = new THREE.Vector3();
    const prev = new THREE.Vector3();
    for (const { a, b, jitter } of this.arcs) {
      prev.copy(a);
      for (let s = 1; s <= segs; s++) {
        p.lerpVectors(a, b, s / segs);
        if (s < segs) p.set(p.x + (Math.random() - 0.5) * jitter, p.y + (Math.random() - 0.5) * jitter * 2, p.z + (Math.random() - 0.5) * jitter);
        pos.set([prev.x, prev.y, prev.z, p.x, p.y, p.z], i);
        i += 6;
        prev.copy(p);
      }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
