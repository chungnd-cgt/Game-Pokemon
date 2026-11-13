import * as THREE from 'three';
import { makeCanvas } from './canvas.js';

// Thiên nhiên "chân thật" cho bản 3D: mặt đất vẽ mềm bằng nhiễu (không còn ô pixel),
// hàng chục nghìn lá cỏ đung đưa theo gió trong shader, rạp xuống khi có người đi qua, hoa, lá bay.

export const PX = 24; // số điểm ảnh mặt đất cho mỗi ô

// ---------- Nhiễu ----------

function hash2(ix, iy) {
  let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export const fbm = (x, y) => vnoise(x, y) * 0.5 + vnoise(x * 2.03 + 17, y * 2.03 + 9) * 0.3 + vnoise(x * 4.1 + 3, y * 4.1 + 31) * 0.2;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rand = (x, y, s = 0) => hash2(Math.floor(x * 9973 + s * 7919), Math.floor(y * 6007 - s * 3089));

// ---------- Mặt nạ theo ô (đường, cỏ cao, nước, rừng), lấy mẫu song tuyến để mép mềm ----------

export function makeMasks(map, tileAt, margin) {
  const cols = map.width + margin * 2;
  const rows = map.height + margin * 2;
  const layer = (test) => {
    const a = new Float32Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) a[y * cols + x] = test(tileAt(x - margin, y - margin), x - margin, y - margin) ? 1 : 0;
    // tx, ty: toạ độ ô thực (có phần lẻ); tâm ô ở +0.5
    const sample = (tx, ty) => {
      const fx = tx + margin - 0.5;
      const fy = ty + margin - 0.5;
      const x0 = Math.max(0, Math.min(cols - 1, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(rows - 1, Math.floor(fy)));
      const x1 = Math.min(cols - 1, x0 + 1);
      const y1 = Math.min(rows - 1, y0 + 1);
      const u = Math.min(1, Math.max(0, fx - x0));
      const v = Math.min(1, Math.max(0, fy - y0));
      const top = a[y0 * cols + x0] * (1 - u) + a[y0 * cols + x1] * u;
      const bot = a[y1 * cols + x0] * (1 - u) + a[y1 * cols + x1] * u;
      return top * (1 - v) + bot * v;
    };
    sample.data = a; // dữ liệu thô (cols x rows) cho bản vẽ mặt đất trên GPU (groundBake.js)
    return sample;
  };
  return {
    // sân lò gốm, chỗ để chum, cửa hang, sân đất (a) cũng là nền đất nện như đường
    path: layer((ch, x, y) => '=KjCda'.includes(ch) || Boolean(map.doorAt?.(x, y))),
    tall: layer((ch) => ch === 'g' || ch === 'G'),
    deep: layer((ch) => ch === 'G'),
    // dưới cầu gỗ vẫn là lòng hồ
    water: layer((ch) => ch === 'w' || ch === 'b'),
    forest: layer((ch) => ch === 'T' || ch === 'n'),
    rock: layer((ch) => ch === 'R' || ch === 'C'),
    paddy: layer((ch) => ch === 'p'),
    pond: layer((ch) => ch === 'L'),
  };
}

// Độ phủ đường đất / cỏ cao tại một điểm (0..1), mép lượn theo nhiễu
export const pathAlpha = (m, x, y) => smooth(0.4, 0.58, m.path(x, y) + (fbm(x * 1.7, y * 1.7) - 0.5) * 0.32);
export const tallAlpha = (m, x, y) => smooth(0.36, 0.6, m.tall(x, y) + (fbm(x * 1.3 + 50, y * 1.3) - 0.5) * 0.4);

// ---------- Vẽ mặt đất ----------

const GRASS_A = rgb(0x5f9e42);
const GRASS_B = rgb(0x86bb52);
const GRASS_DRY = rgb(0xa8b85a);
const TALL_GROUND = rgb(0x3a6e2c);
const FOREST = rgb(0x3e5e2c);
const NEEDLES = rgb(0x5e4a2e);
const DIRT_A = rgb(0xc8a26a);
const DIRT_B = rgb(0xa98454);
const DIRT_EDGE = rgb(0x8a6a40);
const SAND = rgb(0xc8b080);
const MUD = rgb(0x5e6a4c);
// chân vách đá: sỏi đá vụn
const SCREE_A = rgb(0xa8927a);
const SCREE_B = rgb(0x7e6c5a);
// đáy ruộng lúa và ao sen: bùn
const PADDY_MUD = rgb(0x6a6440);
const PADDY_MUD_B = rgb(0x50502e);
const POND_BED = rgb(0x34483a);
// bản đồ tuyết: tuyết trắng ngả xanh (không trắng tinh để khỏi cháy sáng dưới nắng), hõm tuyết xanh lam,
// đường tuyết bị giẫm lẫn bùn xám nâu, đáy hồ đá xám lạnh
const SNOW_A = rgb(0xe2e9f2);
const SNOW_B = rgb(0xd2dcea);
const SNOW_SHADE = rgb(0xaebfd8);
const SLUSH_A = rgb(0xb4aca0);
const SLUSH_B = rgb(0x8e8478);
const ICE_SAND = rgb(0x9aa4ae);
const ICE_BED = rgb(0x4e5e70);

// Màu nền cỏ / tuyết tại (x, y) (toạ độ ô), chưa tính đường, hồ...
function baseColor(snow, masks, x, y) {
  const n1 = fbm(x * 0.35, y * 0.35);
  if (snow) {
    let c = mix(SNOW_A, SNOW_B, n1);
    c = mix(c, SNOW_SHADE, smooth(0.58, 0.82, fbm(x * 0.6 + 20, y * 0.6)) * 0.55);
    // dưới tán rừng: tuyết lốm đốm lá kim sẫm
    const f = smooth(0.5, 0.9, masks.forest(x, y));
    if (f > 0) c = mix(c, mix(SNOW_SHADE, [96, 104, 108], smooth(0.55, 0.8, fbm(x * 1.5, y * 1.5)) * 0.8), f * 0.8);
    return c;
  }
  // cỏ: hai sắc xanh loang lổ + vài mảng ngả vàng
  let c = mix(GRASS_A, GRASS_B, n1);
  c = mix(c, GRASS_DRY, smooth(0.62, 0.8, fbm(x * 0.12 + 40, y * 0.12)) * 0.5);
  // nền rừng: tối, lẫn lá thông khô
  const f = smooth(0.5, 0.9, masks.forest(x, y));
  if (f > 0) c = mix(c, mix(FOREST, NEEDLES, fbm(x * 1.5, y * 1.5) * 0.7), f);
  // nền dưới bụi cỏ cao
  const t = tallAlpha(masks, x, y);
  if (t > 0) c = mix(c, TALL_GROUND, t * 0.9);
  return c;
}

// Trả về canvas: (cols x (rows + 1)) ô, hàng cuối là vân đất cho vách hồ
export function paintGround(map, masks, margin) {
  const snow = Boolean(map.snow);
  const cols = map.width + margin * 2;
  const rows = map.height + margin * 2;
  const W = cols * PX;
  const H = (rows + 1) * PX;
  const { canvas, ctx } = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let py = 0; py < rows * PX; py++) {
    for (let px = 0; px < W; px++) {
      const x = px / PX - margin;
      const y = py / PX - margin;
      const grain = vnoise(px * 0.9, py * 0.9) - 0.5;
      let c = baseColor(snow, masks, x, y);
      // chân vách đá: dải sỏi vụn quanh khối đá
      const r = masks.rock(x, y);
      if (r > 0.02) {
        const scree = mix(SCREE_A, SCREE_B, fbm(x * 2.2 + 5, y * 2.2));
        c = mix(c, snow ? mix(scree, SNOW_B, 0.5) : scree, smooth(0.05, 0.5, r + (fbm(x * 1.4, y * 1.4 + 9) - 0.5) * 0.3) * 0.9);
      }
      // đường đất (bản đồ tuyết: tuyết bị giẫm lẫn bùn): mép tối hơn, rải sỏi
      const p = pathAlpha(masks, x, y);
      if (p > 0) {
        let dirt;
        if (snow) {
          dirt = mix(SLUSH_A, SLUSH_B, fbm(x * 0.8 + 11, y * 0.8));
          // vệt tuyết sót lại giữa đường
          dirt = mix(dirt, SNOW_B, smooth(0.55, 0.75, fbm(x * 1.6 + 3, y * 0.5)) * 0.7);
          dirt = mix(SNOW_SHADE, dirt, smooth(0.5, 0.95, p));
        } else {
          dirt = mix(DIRT_A, DIRT_B, fbm(x * 0.8 + 11, y * 0.8));
          dirt = mix(DIRT_EDGE, dirt, smooth(0.5, 0.95, p));
        }
        const pebble = vnoise(px * 0.45 + 7, py * 0.45);
        if (pebble > 0.86) dirt = mix(dirt, [228, 214, 186], (pebble - 0.86) * 5);
        else if (pebble < 0.1) dirt = mix(dirt, [120, 92, 60], (0.1 - pebble) * 5);
        c = mix(c, dirt, p);
      }
      // đáy hồ: cát ở mép, bùn sẫm ở giữa
      const w = masks.water(x, y);
      if (w > 0.5) c = snow ? mix(ICE_SAND, ICE_BED, smooth(0.6, 1, w) * 0.9) : mix(SAND, MUD, smooth(0.6, 1, w) * 0.8);
      // đáy ruộng: bùn có vệt luống; đáy ao sen: bùn xanh sẫm
      if (masks.paddy(x, y) > 0.5) c = mix(PADDY_MUD, PADDY_MUD_B, fbm(x * 3, y * 3) * 0.6 + (Math.sin(y * Math.PI * 8) > 0.6 ? 0.3 : 0));
      if (masks.pond(x, y) > 0.5) c = mix(POND_BED, MUD, fbm(x * 2, y * 2) * 0.5);
      // tuyết lấp lánh: vài hạt sáng
      const k = snow ? 1 + grain * 0.08 + (grain > 0.42 ? 0.06 : 0) : 1 + grain * 0.16;
      const i = (py * W + px) * 4;
      d[i] = Math.min(255, c[0] * k);
      d[i + 1] = Math.min(255, c[1] * k);
      d[i + 2] = Math.min(255, c[2] * k);
      d[i + 3] = 255;
    }
  }
  // Vân đất vách hồ: mép cỏ (tuyết) phía trên, các lớp đất
  for (let py = rows * PX; py < H; py++) {
    for (let px = 0; px < PX; px++) {
      const j = py - rows * PX;
      const n = vnoise(px * 0.5, j * 0.8);
      const top = snow ? mix(SNOW_A, SNOW_B, n) : mix(GRASS_A, GRASS_B, n);
      const c = j < 4 ? top : mix([128, 96, 62], [98, 72, 46], n + (j % 7 === 0 ? 0.3 : 0));
      const i = (py * W + px) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ---------- Lá cỏ chạy bằng shader ----------

// Uniform dùng chung: thời gian, vị trí những người đang đi (x, z, độ mạnh)
export const grassUniforms = {
  uTime: { value: 0 },
  uWalkers: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
};

function bladeGeometry() {
  const pos = [];
  const seg = 4;
  for (let i = 0; i < seg; i++) {
    const y = i / seg;
    const w = 0.5 * Math.pow(1 - y, 0.8);
    const z = y * y * 0.18;
    pos.push(-w, y, z, w, y, z);
  }
  pos.push(0, 1, 0.18);
  const idx = [];
  for (let i = 0; i < seg - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  idx.push((seg - 1) * 2, (seg - 1) * 2 + 1, seg * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // pháp tuyến hướng lên: lá cỏ sáng như mặt đất, không bị tối mặt sau
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(idx);
  return geo;
}

function grassMaterial() {
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, grassUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform vec4 uWalkers[8];
        varying float vH;`)
      .replace('#include <project_vertex>', `
        vH = position.y;
        vec4 root = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        float bladeH = length(instanceMatrix[1].xyz);
        float h2 = position.y * position.y;
        // gió: một cơn gió lớn lướt qua cánh đồng + rung nhẹ từng lá
        float gust = sin(uTime * 1.3 - root.x * 0.35 - root.z * 0.2) * 0.5 + 0.5;
        vec2 wind = vec2(gust * gust * 0.22 + sin(uTime * 3.1 + root.x * 3.7 + root.z * 2.3) * 0.04,
                         sin(uTime * 2.4 + root.z * 3.1) * 0.035);
        vec2 push = vec2(0.0);
        float flatten = 0.0;
        for (int i = 0; i < 8; i++) {
          vec2 dv = root.xz - uWalkers[i].xy;
          float dist = length(dv);
          float f = clamp(1.0 - dist / 0.62, 0.0, 1.0) * uWalkers[i].z;
          push += dv / max(dist, 0.001) * f * 0.6;
          flatten = max(flatten, f);
        }
        wp.xz += (wind + push) * h2 * bladeH;
        wp.y -= flatten * (wp.y - root.y) * 0.45;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vH;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.62, 1.12, vH);`)
      // mặt sau lá cỏ cũng nhận sáng như mặt trước (pháp tuyến luôn hướng lên trời)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`);
  };
  return mat;
}

// blades: [{ x, z, h, w, rot, color: THREE.Color }]
export function buildBlades(blades) {
  const mesh = new THREE.InstancedMesh(bladeGeometry(), grassMaterial(), blades.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  blades.forEach((b, i) => {
    q.setFromAxisAngle(up, b.rot);
    m.compose(new THREE.Vector3(b.x, b.y ?? 0, b.z), q, new THREE.Vector3(b.w, b.h, b.h));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, b.color);
  });
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// Ô không mọc cỏ: nước, cầu, vách đá, cửa hang, ruộng lúa (lúa riêng), ao sen, lò gốm, chum
const BARE = new Set(['w', 'b', 'R', 'C', 'p', 'L', 'K', 'j', 'd', 'a']);

// Rải lá cỏ cho cả bản đồ: bụi cỏ cao (mép thưa dần), thảm cỏ thấp, cỏ dưới tán rừng, lau sậy ven hồ
export function scatterGrass(map, tileAt, masks, margin) {
  const blades = [];
  const color = (h, s, l) => new THREE.Color().setHSL(h, s, l);
  const solidHere = (x, y) => map.buildingAt?.(Math.floor(x), Math.floor(y));
  for (let ty = -margin; ty < map.height + margin; ty++) {
    for (let tx = -margin; tx < map.width + margin; tx++) {
      const ch = tileAt(tx, ty);
      const inMap = tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;
      const nearTall = masks.tall(tx + 0.5, ty + 0.5) > 0.05;
      // Bụi cỏ cao: rậm, cao tới gối
      if (nearTall) {
        const deep = masks.deep(tx + 0.5, ty + 0.5) > 0.4;
        for (let k = 0; k < 110; k++) {
          const x = tx + rand(tx, ty, k);
          const z = ty + rand(tx, ty, k + 300);
          const a = tallAlpha(masks, x, z);
          if (a < 0.12 || masks.path(x, z) > 0.45) continue;
          const n = rand(x, z, 5);
          blades.push({
            x, z, rot: rand(x, z, 6) * Math.PI * 2,
            h: (deep ? 0.62 : 0.48) * (0.65 + n * 0.6) * (0.35 + a * 0.65),
            w: 0.06 + rand(x, z, 7) * 0.035,
            color: deep ? color(0.29 + n * 0.04, 0.55, 0.3 + n * 0.1) : color(0.25 + n * 0.05, 0.55, 0.36 + n * 0.12),
          });
        }
      }
      if (BARE.has(ch) || solidHere(tx, ty)) continue;
      // Bản đồ tuyết: chỉ lác đác vài nhúm cỏ khô đóng sương nhô lên khỏi tuyết
      if (map.snow) {
        if (!inMap || ch === 'T' || ch === '=' || rand(tx, ty, 1300) > 0.45) continue;
        const cx = tx + 0.2 + rand(tx, ty, 1301) * 0.6;
        const cz = ty + 0.2 + rand(tx, ty, 1302) * 0.6;
        if (pathAlpha(masks, cx, cz) > 0.2) continue;
        for (let k = 0; k < 9; k++) {
          const n = rand(tx, ty, k + 1310);
          blades.push({ x: cx + (rand(tx, ty, k + 1320) - 0.5) * 0.16, z: cz + (rand(tx, ty, k + 1330) - 0.5) * 0.16, rot: n * 6.28, h: 0.1 + n * 0.14, w: 0.03, color: color(0.15 + n * 0.08, 0.18, 0.55 + n * 0.15) });
        }
        continue;
      }
      // Thảm cỏ thấp trên bãi cỏ (tránh đường đất)
      if (inMap && ch !== 'T' && ch !== '=') {
        for (let k = 0; k < 48; k++) {
          const x = tx + rand(tx, ty, k + 600);
          const z = ty + rand(tx, ty, k + 700);
          const edge = pathAlpha(masks, x, z);
          if (edge > 0.35 || tallAlpha(masks, x, z) > 0.3) continue;
          const n = rand(x, z, 8);
          // cùng tông với mặt cỏ bên dưới, chỉ sáng hơn ở ngọn; thưa và thấp dần về phía mép đường
          blades.push({ x, z, rot: rand(x, z, 9) * Math.PI * 2, h: (0.08 + n * 0.11) * (1 - edge * 1.6), w: 0.035 + n * 0.015, color: color(0.25 + n * 0.04, 0.42, 0.42 + n * 0.1) });
        }
      }
      // Dưới tán rừng: lưa thưa, sẫm màu
      if (ch === 'T') {
        for (let k = 0; k < 7; k++) {
          const x = tx + rand(tx, ty, k + 900);
          const z = ty + rand(tx, ty, k + 950);
          const n = rand(x, z, 10);
          blades.push({ x, z, rot: n * 6.28, h: 0.15 + n * 0.2, w: 0.05, color: color(0.28, 0.45, 0.22 + n * 0.08) });
        }
      }
      // Lau sậy ven hồ
      const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(tx + dx, ty + dy) === 'w');
      if (inMap && shore) {
        for (let k = 0; k < 12; k++) {
          const x = tx + rand(tx, ty, k + 1100);
          const z = ty + rand(tx, ty, k + 1200);
          if (masks.water(x, z) < 0.3 || pathAlpha(masks, x, z) > 0.2) continue;
          const n = rand(x, z, 11);
          blades.push({ x, z, rot: n * 6.28, h: 0.5 + n * 0.45, w: 0.05, color: color(0.22 + n * 0.04, 0.45, 0.3 + n * 0.1) });
        }
      }
    }
  }
  return buildBlades(blades);
}

// Ruộng lúa: mỗi ô 4 hàng x 4 khóm (như bản 2D), mỗi khóm một nhúm lá lúa xanh ngả vàng, gốc ngập dưới nước.
// Dùng chung shader lá cỏ nên lúa cũng đung đưa theo gió.
export function scatterRice(map, tileAt, bedY) {
  const blades = [];
  const color = new THREE.Color();
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (tileAt(tx, ty) !== 'p') continue;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const cx = tx + 0.14 + c * 0.24 + (r % 2 ? 0.05 : -0.02) + (rand(tx, ty, r * 4 + c + 2000) - 0.5) * 0.04;
          const cz = ty + 0.14 + r * 0.24 + (rand(tx, ty, r * 4 + c + 2100) - 0.5) * 0.04;
          // cả ruộng chín không đều: có mảng vàng hơn
          const ripe = fbm(cx * 0.4 + 70, cz * 0.4);
          for (let k = 0; k < 13; k++) {
            const n = rand(cx, cz, k + 2200);
            const a = (k / 13) * Math.PI * 2 + n;
            const r = 0.012 + rand(cx, cz, k + 2300) * 0.03;
            blades.push({
              x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, y: bedY, rot: Math.PI / 2 - a, // ngọn cong ra ngoài khóm
              h: 0.4 + n * 0.16, w: 0.05 + n * 0.02,
              // lá xanh, ngọn ngả vàng (bông lúa) ở mảng ruộng chín
              color: color.setHSL(0.25 - ripe * 0.09 - n * 0.025, 0.5 + ripe * 0.15, 0.3 + ripe * 0.12 + n * 0.08).clone(),
            });
          }
        }
      }
    }
  }
  return blades.length ? buildBlades(blades) : null;
}

// Hoa dại trên các ô hoa: cuống mảnh + bông nhỏ
export function buildFlowers(map, tileAt) {
  const spots = [];
  const COLORS = [0xf05858, 0xfaf4f0, 0xf8c840, 0xe878c0];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (tileAt(x, y) !== 'f' && tileAt(x, y) !== 'h') continue;
      for (let k = 0; k < 7; k++) spots.push({ x: x + 0.15 + rand(x, y, k + 40) * 0.7, z: y + 0.15 + rand(x, y, k + 50) * 0.7, c: COLORS[Math.floor(rand(x, y, k + 60) * COLORS.length)], h: 0.16 + rand(x, y, k + 70) * 0.1 });
    }
  }
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.01, 1, 4).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x3e7a32 }), spots.length);
  const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.045, 0), new THREE.MeshLambertMaterial({ flatShading: true }), spots.length);
  const centers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 4), new THREE.MeshLambertMaterial({ color: 0xf8d040 }), spots.length);
  const m = new THREE.Matrix4();
  spots.forEach((s, i) => {
    stems.setMatrixAt(i, m.makeScale(1, s.h, 1).setPosition(s.x, 0, s.z));
    heads.setMatrixAt(i, m.makeScale(1, 0.55, 1).setPosition(s.x, s.h, s.z));
    centers.setMatrixAt(i, m.makeTranslation(s.x, s.h + 0.025, s.z));
    heads.setColorAt(i, new THREE.Color(s.c));
  });
  for (const mesh of [stems, heads, centers]) mesh.castShadow = true;
  return [stems, heads, centers];
}

// ---------- Lá bay khi bước vào bụi cỏ ----------

const leafGeo = new THREE.PlaneGeometry(0.07, 0.035);
const leafMat = new THREE.MeshLambertMaterial({ color: 0x5aa040, side: THREE.DoubleSide, transparent: true });
export class LeafBurst {
  constructor(parent) {
    this.parent = parent;
    this.leaves = [];
  }

  burst(x, z, count = 9) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(leafGeo, leafMat.clone());
      mesh.position.set(x + (Math.random() - 0.5) * 0.5, 0.3, z + (Math.random() - 0.5) * 0.5);
      mesh.material.color.offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.15);
      this.parent.add(mesh);
      this.leaves.push({ mesh, v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6), spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), life: 0.8 + Math.random() * 0.4, t: 0 });
    }
  }

  update(dt) {
    this.leaves = this.leaves.filter((l) => {
      l.t += dt;
      l.v.y -= 4.5 * dt;
      l.v.multiplyScalar(1 - dt * 1.8);
      l.mesh.position.addScaledVector(l.v, dt);
      l.mesh.rotation.x += l.spin.x * dt;
      l.mesh.rotation.y += l.spin.y * dt;
      l.mesh.rotation.z += l.spin.z * dt;
      l.mesh.material.opacity = 1 - Math.max(0, (l.t - l.life * 0.6) / (l.life * 0.4));
      if (l.t < l.life && l.mesh.position.y > 0) return true;
      l.mesh.removeFromParent();
      return false;
    });
  }
}
