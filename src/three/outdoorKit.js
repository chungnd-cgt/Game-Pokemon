import * as THREE from 'three';
import { makeCanvas } from './canvas.js';

// Đồ nghề dùng chung cho cảnh ngoài trời (world3d.js, outdoorProps.js, buildings3d.js)

// Độ cao (trục y) của đáy và mặt nước: hồ / sông (cả dưới cầu), ao sen, ruộng lúa.
// WATER_LEVEL phải khớp với three/view3d.js (người chơi lướt nước ngồi ở độ cao này).
export const WATER_BED = -0.42;
export const WATER_LEVEL = -0.14;
export const POND_BED = -0.3;
export const POND_LEVEL = -0.08;
export const PADDY_BED = -0.1;
export const PADDY_LEVEL = -0.045;

// Hash cố định theo toạ độ, để mỗi lần dựng ra cùng một cảnh
export function rand(x, y, s = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

export function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function pixelTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export const hex = (c) => `#${new THREE.Color(c).getHexString()}`;

// Nhiều bản sao một hình bằng một lần vẽ. items: [{ x, y, z, ry, rx, rz, sx, sy, sz, s, color }]
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
export function instanced(geo, mat, items, { cast = true, receive = true } = {}) {
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, i) => {
    tmpQ.setFromEuler(tmpE.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0));
    const s = it.s ?? 1;
    tmpS.set(it.sx ?? s, it.sy ?? s, it.sz ?? s);
    mesh.setMatrixAt(i, tmpM.compose(tmpP.set(it.x, it.y ?? 0, it.z), tmpQ, tmpS));
    if (it.color !== undefined) mesh.setColorAt(i, tmpC.set(it.color));
  });
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.computeBoundingSphere();
  return mesh;
}

// Vầng sáng tròn mờ dần ra mép (quầng đèn trên mặt đất, quầng quanh đèn lồng)
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const { canvas, ctx } = makeCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(canvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

// Bầu trời giả để mặt nước phản chiếu (rẻ hơn nhiều so với vẽ cảnh lần hai): trời xanh, mây trắng, chân trời nhạt
let skyTex = null;
export function skyTexture() {
  if (skyTex) return skyTex;
  const { canvas, ctx } = makeCanvas(128, 64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#5a9ae0');
  g.addColorStop(0.45, '#a8d0f4');
  g.addColorStop(0.5, '#e4f0fa');
  g.addColorStop(1, '#6a8a70');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 14; i++) {
    const x = rand(i, 1, 3) * 128;
    const y = 8 + rand(i, 2, 3) * 20;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(x + k * 4 - 6, y + rand(i, k, 4) * 3, 7 + rand(i, k, 5) * 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  skyTex = new THREE.CanvasTexture(canvas);
  skyTex.mapping = THREE.EquirectangularReflectionMapping;
  skyTex.colorSpace = THREE.SRGBColorSpace;
  return skyTex;
}

// Biển hiệu chữ: nền + chữ đậm căn giữa (chữ to nên dùng lọc mịn, không pixel)
export function signTexture(text, { bg = '#ffffff', fg = '#202020', border = null, w = 128, h = 40, font = 'bold 28px Nunito, Arial, sans-serif', icon = null } = {}) {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  }
  let x = w / 2;
  if (icon) {
    icon(ctx, h * 0.62, h / 2, h * 0.34);
    x += h * 0.45;
  }
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, h / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
