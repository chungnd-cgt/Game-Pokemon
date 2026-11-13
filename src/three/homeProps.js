import * as THREE from 'three';
import { rand } from './nature.js';
import { shared } from './character.js';
import { box, canvasTex, cyl, shadowed, std } from './roomKit.js';

// Đồ đạc 3D trong nhà người chơi (nhà 2 tầng, data/map.js: home, home2f):
// cầu thang lên / xuống, bộ sofa, bàn nước, tủ lạnh, quầy bếp, bàn học, thảm, tranh ảnh treo tường.
// Ký tự ô xem data/tiles.js; bản 2D tương ứng ở gfx/interior.js.

const WALL_H = 2.3; // cao bằng tường trong interior3d.js
const TREAD = 0xc89058;
const RISER = 0x8a5a30;
const RAIL = 0x6a4020;
const SOFA = { fabric: 0x4a7ab0, cushion: 0x5a8cc4, pillow: 0xf0d8a8, leg: 0x4a3020 };

const matCache = new Map();
const mat = (color, extra = {}) => {
  const key = `${color}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) matCache.set(key, shared(std(color, extra)));
  return matCache.get(key);
};

// Thanh tròn nối hai điểm (tay vịn cầu thang)
function rod(a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 10), material));
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// ---------- Sàn có lỗ cầu thang ----------

// Sàn ghép từ từng ô, chừa trống ô cầu thang xuống 's'. Không có cầu thang xuống thì trả về null (dùng mặt phẳng thường).
// UV giống PlaneGeometry phủ cả phòng nên texture sàn (vẽ theo ô) vẫn khớp.
export function stairwellFloor(map) {
  const W = map.width;
  const H = map.height;
  let holes = 0;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (map.tileAt(x, y) === 's') {
        holes++;
        continue;
      }
      const b = pos.length / 3;
      pos.push(x, 0, y, x + 1, 0, y, x, 0, y + 1, x + 1, 0, y + 1);
      uv.push(x / W, 1 - y / H, (x + 1) / W, 1 - y / H, x / W, 1 - (y + 1) / H, (x + 1) / W, 1 - (y + 1) / H);
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  if (!holes) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// ---------- Cầu thang ----------

// Lối lên tầng trên trong hốc tường: bóng tối, vài bậc mờ dần lên cao
function stairOpeningTexture() {
  return canvasTex(64, 96, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, '#3a2818');
    g.addColorStop(1, '#0a0604');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const y = h - 8 - i * 16;
      c.fillStyle = `rgba(200, 144, 88, ${0.45 - i * 0.08})`;
      c.fillRect(4, y, w - 8, 3);
    }
  });
}

// Cầu thang lên: 5 bậc cao dần về phía tường sau rồi chui vào hốc tối trên tường; tay vịn bên trái
function stairsUp(map, x, y) {
  const g = new THREE.Group();
  const STEPS = 5;
  const run = 1 / STEPS;
  const rise = 0.2;
  const tread = mat(TREAD, { roughness: 0.6 });
  const riser = mat(RISER, { roughness: 0.7 });
  for (let i = 0; i < STEPS; i++) {
    const h = rise * (i + 1);
    const front = y + 1 - run * i;
    g.add(box(0.9, h, run, [riser, riser, tread, riser, riser, riser], x + 0.53, h / 2, front - run / 2));
  }
  const top = rise * STEPS;
  // Hốc cầu thang trên mặt tường sau, viền gỗ
  const openH = WALL_H - top - 0.18;
  const opening = new THREE.Mesh(new THREE.PlaneGeometry(0.84, openH), new THREE.MeshBasicMaterial({ map: stairOpeningTexture() }));
  opening.position.set(x + 0.53, top + openH / 2, y + 0.004);
  g.add(opening);
  const trim = mat(RAIL, { roughness: 0.6 });
  for (const sx of [0.08, 0.98]) g.add(box(0.07, openH + 0.06, 0.05, trim, x + sx, top + openH / 2, y + 0.02));
  g.add(box(0.97, 0.08, 0.05, trim, x + 0.53, top + openH + 0.03, y + 0.02));
  // Ván cạnh bậc (dầm thang) và tay vịn chạy dọc theo độ dốc ở mép trái (mép phải sát tường bên)
  const stringer = box(0.07, 0.24, Math.hypot(1, top) + 0.06, riser, x + 0.06, top / 2 + 0.06, y + 0.5);
  stringer.rotation.x = Math.atan2(top, 1);
  g.add(stringer);
  const railMat = mat(RAIL, { roughness: 0.45 });
  const lo = new THREE.Vector3(x + 0.06, rise + 0.82, y + 0.92);
  const hi = new THREE.Vector3(x + 0.06, top + 0.82, y + 0.1);
  g.add(rod(lo, hi, 0.035, railMat));
  g.add(box(0.1, rise + 0.9, 0.1, railMat, x + 0.06, (rise + 0.9) / 2, y + 0.92)); // trụ chân cầu thang
  g.add(cyl(0.07, 0.07, 0.06, mat(0xe0b078), x + 0.06, rise + 0.93, y + 0.92));
  for (let i = 1; i < STEPS; i++) {
    const z = y + 1 - run * (i + 0.5);
    const k = (y + 0.92 - z) / 0.82;
    const railY = lo.y + (hi.y - lo.y) * k;
    g.add(cyl(0.018, 0.018, railY - rise * (i + 1), railMat, x + 0.06, (railY + rise * (i + 1)) / 2, z, 6));
  }
  return g;
}

// Cầu thang xuống: giếng cầu thang dưới sàn (sàn đã chừa lỗ), các bậc thấp và tối dần về phía tường sau,
// lan can gỗ bên trái, nẹp gỗ quanh miệng giếng
function stairsDown(map, x, y) {
  const g = new THREE.Group();
  const DEPTH = 1.3;
  const STEPS = 6;
  const run = 1 / STEPS;
  const rise = DEPTH / (STEPS + 1);
  const wall = mat(0x5a4230, { roughness: 0.9 });
  const side = (w, h, px, pz, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wall);
    m.position.set(px, -h / 2, pz);
    m.rotation.y = ry;
    m.receiveShadow = true;
    return m;
  };
  g.add(side(1, DEPTH, x + 0.5, y, 0), side(1, DEPTH, x, y + 0.5, Math.PI / 2), side(1, DEPTH, x + 1, y + 0.5, -Math.PI / 2));
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat(0x1a120c));
  bottom.position.set(x + 0.5, -DEPTH, y + 0.5);
  g.add(bottom);
  const base = new THREE.Color(TREAD);
  for (let i = 0; i < STEPS; i++) {
    const topY = -rise * (i + 1);
    const color = base.clone().multiplyScalar(1 - (i / STEPS) * 0.8);
    const tread = std(color, { roughness: 0.7 });
    const front = y + 1 - run * i;
    g.add(box(0.88, DEPTH + topY, run, tread, x + 0.53, (topY - DEPTH) / 2, front - run / 2));
  }
  // Nẹp gỗ quanh miệng giếng (mép trái và mép trước)
  const trim = mat(RAIL, { roughness: 0.6 });
  g.add(box(0.06, 0.04, 1, trim, x + 0.03, 0.02, y + 0.5));
  g.add(box(1, 0.03, 0.05, trim, x + 0.5, 0.015, y + 0.975));
  // Lan can bên trái: hai trụ, tay vịn, song gỗ
  const railMat = mat(RAIL, { roughness: 0.45 });
  for (const z of [y + 0.08, y + 0.92]) {
    g.add(box(0.09, 0.9, 0.09, railMat, x + 0.05, 0.45, z));
    g.add(cyl(0.065, 0.065, 0.05, mat(0xe0b078), x + 0.05, 0.92, z));
  }
  g.add(box(0.07, 0.06, 0.92, railMat, x + 0.05, 0.86, y + 0.5));
  for (let i = 1; i < 5; i++) g.add(cyl(0.018, 0.018, 0.84, railMat, x + 0.05, 0.42, y + 0.08 + i * 0.168, 6));
  return g;
}

// ---------- Phòng khách ----------

// Sofa: đế, đệm ngồi từng ô, lưng tựa liền khối, tay vịn ở hai đầu ghế dài, gối tựa, chân gỗ.
// ch '[' lưng tựa bên trái (ngồi quay sang phải), ']' ngược lại
function sofa(map, x, y, ch) {
  const g = new THREE.Group();
  const s = ch === '[' ? -1 : 1; // phía lưng tựa
  const head = map.tileAt(x, y - 1) !== ch;
  const foot = map.tileAt(x, y + 1) !== ch;
  const cx = x + 0.5;
  const z0 = y + (head ? 0.06 : 0);
  const z1 = y + 1 - (foot ? 0.06 : 0);
  const len = z1 - z0;
  const zc = (z0 + z1) / 2;
  const fabric = mat(SOFA.fabric, { roughness: 0.92 });
  const cushion = mat(SOFA.cushion, { roughness: 0.95 });
  g.add(box(0.82, 0.22, len, fabric, cx, 0.17, zc));
  g.add(box(0.2, 0.64, len, fabric, cx + s * 0.31, 0.38, zc)); // lưng tựa
  const c0 = y + (head ? 0.2 : 0.015);
  const c1 = y + 1 - (foot ? 0.2 : 0.015);
  g.add(box(0.6, 0.12, c1 - c0, cushion, cx - s * 0.1, 0.33, (c0 + c1) / 2));
  // Gối tựa dựa nghiêng vào lưng ghế
  const pillow = box(0.12, 0.3, 0.34, mat(SOFA.pillow, { roughness: 0.95 }), cx + s * 0.16, 0.53, y + 0.5);
  pillow.rotation.z = -s * 0.28;
  g.add(pillow);
  for (const [end, z] of [[head, y + 0.13], [foot, y + 0.87]]) {
    if (!end) continue;
    g.add(box(0.82, 0.5, 0.14, fabric, cx, 0.31, z)); // tay vịn
    for (const dx of [-0.34, 0.34]) g.add(cyl(0.035, 0.03, 0.08, mat(SOFA.leg), cx + dx, 0.04, z));
  }
  return g;
}

// Bàn nước giữa bộ sofa: dựng một khối theo cả vùng ô 't' (mặt bàn, kệ dưới, 4 chân),
// trên bàn có lọ hoa, đĩa trái cây và hai tách trà đặt đối xứng về phía hai ghế
export function coffeeTable(map, t) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -1;
  let y2 = -1;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.tileAt(x, y) !== 't') continue;
      x1 = Math.min(x1, x);
      y1 = Math.min(y1, y);
      x2 = Math.max(x2, x);
      y2 = Math.max(y2, y);
    }
  }
  if (x2 < 0) return null;
  const g = new THREE.Group();
  const w = x2 - x1 + 1 - 0.2;
  const d = y2 - y1 + 1 - 0.2;
  const cx = (x1 + x2 + 1) / 2;
  const cz = (y1 + y2 + 1) / 2;
  const H = 0.46;
  const top = mat(new THREE.Color(t.counterTop).getHex(), { roughness: 0.45 });
  const dark = mat(new THREE.Color(t.counterDark).getHex(), { roughness: 0.6 });
  g.add(box(w, 0.06, d, top, cx, H, cz));
  g.add(box(w + 0.02, 0.025, d + 0.02, dark, cx, H - 0.04, cz));
  g.add(box(w - 0.24, 0.04, d - 0.24, dark, cx, 0.13, cz));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.08, H - 0.03, 0.08, dark, cx + sx * (w / 2 - 0.08), (H - 0.03) / 2, cz + sz * (d / 2 - 0.08)));
  const y0 = H + 0.03;
  // Lọ hoa sứ trắng ở giữa
  g.add(cyl(0.05, 0.07, 0.2, mat(0xf4f4fa, { roughness: 0.3 }), cx, y0 + 0.1, cz - 0.25));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), mat([0xf06a8a, 0xf8d040, 0xffffff][i % 3], { flatShading: true }));
    f.position.set(cx + Math.cos(a) * 0.06, y0 + 0.27 + (i % 2) * 0.04, cz - 0.25 + Math.sin(a) * 0.06);
    f.castShadow = true;
    g.add(f);
  }
  // Đĩa trái cây
  g.add(cyl(0.16, 0.12, 0.03, mat(0xf8f4ec, { roughness: 0.35 }), cx, y0 + 0.015, cz + 0.28));
  for (const [dx, dz, c] of [[-0.05, 0, 0xe84a3a], [0.06, 0.03, 0xf0a030], [0, -0.06, 0xd8c840]]) {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mat(c, { roughness: 0.5 }));
    fruit.position.set(cx + dx, y0 + 0.07, cz + 0.28 + dz);
    fruit.castShadow = true;
    g.add(fruit);
  }
  // Tách trà đối xứng hai bên, quay về phía hai sofa
  for (const s of [-1, 1]) {
    const tx = cx + s * (w / 2 - 0.28);
    const tz = y1 + 0.55;
    g.add(cyl(0.075, 0.075, 0.012, mat(0xf8f4ec), tx, y0 + 0.006, tz));
    g.add(cyl(0.045, 0.038, 0.07, mat(0xffffff, { roughness: 0.3 }), tx, y0 + 0.045, tz));
    const tea = new THREE.Mesh(new THREE.CircleGeometry(0.038, 12).rotateX(-Math.PI / 2), mat(0xa0582a));
    tea.position.set(tx, y0 + 0.076, tz);
    g.add(tea);
  }
  return g;
}

// ---------- Bếp, phòng ngủ ----------

function fridge(x, y) {
  const g = new THREE.Group();
  const body = mat(0xf2f4f8, { roughness: 0.32 });
  const cx = x + 0.5;
  const front = y + 0.72;
  g.add(box(0.84, 1.9, 0.66, body, cx, 0.95, y + 0.39));
  g.add(box(0.8, 0.02, 0.02, mat(0x8a94a4), cx, 1.3, front + 0.01)); // khe ngăn đá
  const metal = mat(0xb8c0cc, { roughness: 0.25, metalness: 0.6 });
  g.add(box(0.03, 0.26, 0.04, metal, cx + 0.32, 1.55, front + 0.03));
  g.add(box(0.03, 0.42, 0.04, metal, cx + 0.32, 0.95, front + 0.03));
  for (const [dx, dy, c] of [[-0.18, 1.0, 0xf0c040], [-0.05, 1.12, 0xe84a5a], [-0.2, 0.75, 0x4a9ad8]]) {
    g.add(box(0.07, 0.07, 0.02, mat(c), cx + dx, dy, front + 0.01));
  }
  g.add(box(0.22, 0.28, 0.005, mat(0xffffff), cx - 0.05, 0.95, front + 0.004)); // tờ giấy dán tủ
  return g;
}

// Quầy bếp sát tường: ô đầu (bên trái) là bồn rửa dưới cửa sổ, các ô sau là bếp nấu có máy hút mùi phía trên
function kitchenCounter(map, x, y, t) {
  const g = new THREE.Group();
  const cx = x + 0.5;
  const cz = y + 0.38;
  const cabinet = mat(new THREE.Color(t.counterFront).getHex(), { roughness: 0.6 });
  const stone = mat(0xe8e4dc, { roughness: 0.35 });
  g.add(box(1.0, 0.86, 0.7, cabinet, cx, 0.43, cz));
  g.add(box(1.0, 0.06, 0.74, stone, cx, 0.89, cz + 0.01));
  // cửa tủ và tay nắm
  const line = mat(new THREE.Color(t.counterDark).getHex());
  g.add(box(0.02, 0.6, 0.01, line, cx, 0.43, cz + 0.355));
  for (const dx of [-0.08, 0.08]) g.add(box(0.03, 0.12, 0.03, mat(0xd8d8e0, { metalness: 0.5, roughness: 0.3 }), cx + dx, 0.62, cz + 0.37));
  const topY = 0.92;
  if (map.tileAt(x - 1, y) !== 'c') {
    g.add(box(0.5, 0.012, 0.36, mat(0x8a94a4, { metalness: 0.6, roughness: 0.25 }), cx, topY + 0.006, cz + 0.02));
    const metal = mat(0xc8d0d8, { metalness: 0.7, roughness: 0.2 });
    g.add(cyl(0.02, 0.025, 0.24, metal, cx, topY + 0.12, cz - 0.24));
    const spout = box(0.03, 0.03, 0.16, metal, cx, topY + 0.235, cz - 0.17);
    g.add(spout);
  } else {
    g.add(box(0.72, 0.012, 0.52, mat(0x1e1e24, { roughness: 0.15 }), cx, topY + 0.006, cz));
    for (const dx of [-0.17, 0.17]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 20).rotateX(Math.PI / 2), std(0x3a1a10, { emissive: 0xe04020, emissiveIntensity: 0.35 }));
      ring.position.set(cx + dx, topY + 0.014, cz);
      g.add(ring);
    }
    // nồi trên bếp
    g.add(cyl(0.12, 0.11, 0.14, mat(0xd04a3a, { roughness: 0.4 }), cx - 0.17, topY + 0.085, cz));
    g.add(cyl(0.125, 0.125, 0.02, mat(0xb03a2a), cx - 0.17, topY + 0.16, cz));
    // máy hút mùi
    g.add(box(0.82, 0.22, 0.46, mat(0xc8ccd4, { metalness: 0.5, roughness: 0.3 }), cx, 1.72, y + 0.25));
    g.add(box(0.3, 0.45, 0.24, mat(0xc8ccd4, { metalness: 0.5, roughness: 0.3 }), cx, 2.05, y + 0.14));
  }
  return g;
}

// Bàn học sát tường: hộc tủ một bên, đèn bàn, vở mở, hộp bút, ghế đẩu
function desk(x, y, t) {
  const g = new THREE.Group();
  const wood = mat(new THREE.Color(t.counterTop).getHex(), { roughness: 0.5 });
  const dark = mat(new THREE.Color(t.counterFront).getHex(), { roughness: 0.6 });
  const cz = y + 0.34;
  g.add(box(0.94, 0.05, 0.58, wood, x + 0.5, 0.72, cz));
  g.add(box(0.32, 0.7, 0.54, dark, x + 0.2, 0.35, cz));
  for (const dy of [0.2, 0.45]) g.add(box(0.03, 0.03, 0.02, mat(0xe0c080), x + 0.2, dy, cz + 0.28));
  g.add(box(0.05, 0.7, 0.54, dark, x + 0.93, 0.35, cz));
  // đèn bàn
  const lampMat = mat(0x3a7ad8, { roughness: 0.4 });
  g.add(cyl(0.07, 0.08, 0.03, lampMat, x + 0.78, 0.76, y + 0.18));
  g.add(cyl(0.012, 0.012, 0.32, lampMat, x + 0.78, 0.92, y + 0.18, 6));
  const shade = cyl(0.03, 0.09, 0.1, lampMat, x + 0.72, 1.06, y + 0.22);
  shade.rotation.z = 0.5;
  g.add(shade);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0xfff4c0, { emissive: 0xffe090, emissiveIntensity: 1.2 })).translateX(x + 0.7).translateY(1.02).translateZ(y + 0.23));
  // vở mở và bút
  for (const s of [-1, 1]) {
    const page = box(0.13, 0.012, 0.19, mat(0xfaf8f0), x + 0.48 + s * 0.065, 0.752, cz + 0.06);
    page.rotation.z = -s * 0.06;
    g.add(page);
  }
  g.add(cyl(0.04, 0.04, 0.1, mat(0xe8a040), x + 0.2, 0.8, y + 0.16));
  for (let i = 0; i < 3; i++) g.add(cyl(0.006, 0.006, 0.14, mat([0xe04040, 0x40a060, 0x3a6ad8][i]), x + 0.19 + i * 0.012, 0.86, y + 0.16, 4));
  // ghế đẩu
  g.add(cyl(0.16, 0.16, 0.06, mat(0xe86a50, { roughness: 0.8 }), x + 0.5, 0.44, y + 0.84));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(cyl(0.018, 0.018, 0.42, dark, x + 0.5 + Math.cos(a) * 0.1, 0.21, y + 0.84 + Math.sin(a) * 0.1, 5));
  }
  return g;
}

// Hình trên màn hình TV: bản tin thời tiết (phòng khách) hoặc màn hình trò chơi (phòng ngủ, có máy chơi game)
function tvPicture(game) {
  return canvasTex(128, 72, (c, w, h) => {
    if (game) {
      c.fillStyle = '#5ab0f0';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#58b848';
      c.fillRect(0, 52, w, 20);
      c.fillStyle = '#8a5a30';
      for (let x = 0; x < w; x += 16) c.fillRect(x, 60, 14, 12);
      c.fillStyle = '#f0c040';
      for (const [x, y] of [[40, 30], [56, 30], [72, 30]]) c.fillRect(x, y, 10, 10);
      c.fillStyle = '#e04040';
      c.fillRect(20, 40, 8, 12); // nhân vật trong game
      c.fillStyle = '#ffffff';
      c.fillRect(6, 4, 30, 5);
      return;
    }
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#3a78d0');
    sky.addColorStop(1, '#a8d8f8');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#f8d040';
    c.beginPath();
    c.arc(34, 30, 12, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    for (const [x, y, r] of [[78, 28, 10], [90, 24, 12], [102, 30, 9]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(20, 40, 90, 0.75)';
    c.fillRect(0, 54, w, 18);
    c.fillStyle = '#ffffff';
    c.fillRect(6, 59, 50, 3);
    c.fillRect(6, 65, 32, 3);
  });
}

// TV lớn trên kệ gỗ dài: các ô 'V' liền nhau (n ô, x là ô trái cùng) dựng thành một khối, màn hình 16:9 rộng gần
// trọn kệ, đặt giữa tường đối diện bộ sofa. Hai bên kệ: loa (phòng khách) hoặc máy chơi game và tay cầm (game)
function tv(x, y, n, t, game) {
  const g = new THREE.Group();
  const cx = x + n / 2;
  const W = n - 0.1;
  const wood = mat(new THREE.Color(t.counterFront).getHex(), { roughness: 0.6 });
  const top = mat(new THREE.Color(t.counterTop).getHex(), { roughness: 0.45 });
  const dark = mat(new THREE.Color(t.counterDark).getHex(), { roughness: 0.6 });
  const black = mat(0x1e1e24, { roughness: 0.35 });
  const knob = mat(0xe0c080, { metalness: 0.4, roughness: 0.4 });
  // kệ dài: thân, mặt kệ, các cánh tủ, núm
  const shelfH = 0.42;
  g.add(box(W, shelfH, 0.42, wood, cx, shelfH / 2, y + 0.26));
  g.add(box(W + 0.04, 0.04, 0.46, top, cx, shelfH + 0.02, y + 0.26));
  const doors = n * 2;
  const dw = (W - 0.08) / doors;
  for (let i = 0; i < doors; i++) {
    const dx = cx - W / 2 + 0.04 + dw * (i + 0.5);
    g.add(box(dw - 0.03, shelfH - 0.12, 0.01, dark, dx, shelfH / 2, y + 0.475));
    g.add(box(0.03, 0.04, 0.02, knob, dx + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), shelfH / 2, y + 0.485));
  }
  // TV: đế, cổ, viền, màn hình có hình
  const base = shelfH + 0.04;
  const sw = Math.min(1.7, W * 0.62);
  const sh = sw * 9 / 16;
  const sy = base + 0.12 + sh / 2;
  g.add(box(0.42, 0.02, 0.16, black, cx, base + 0.01, y + 0.22));
  g.add(box(0.06, 0.12, 0.04, black, cx, base + 0.07, y + 0.2));
  g.add(box(sw + 0.06, sh + 0.06, 0.05, black, cx, sy, y + 0.17));
  const pic = tvPicture(game);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(sw, sh),
    std(0xffffff, { map: pic, emissive: 0xffffff, emissiveMap: pic, emissiveIntensity: 0.75, roughness: 0.2 }),
  );
  screen.position.set(cx, sy, y + 0.196);
  g.add(screen);
  const side = W / 2 - 0.22;
  if (game) {
    // máy chơi game bên trái, hai tay cầm bên phải
    g.add(box(0.26, 0.07, 0.2, mat(0xe8e8f0, { roughness: 0.4 }), cx - side, base + 0.035, y + 0.27));
    g.add(box(0.08, 0.008, 0.01, mat(0x58c8f0, { emissive: 0x58c8f0, emissiveIntensity: 0.8 }), cx - side, base + 0.07, y + 0.37));
    for (const dz of [0.2, 0.34]) g.add(box(0.14, 0.035, 0.08, mat(0x3a3a48), cx + side, base + 0.018, y + dz));
  } else {
    // hai loa đứng đối xứng hai bên TV
    for (const s of [-1, 1]) {
      g.add(box(0.16, 0.42, 0.16, black, cx + s * side, base + 0.21, y + 0.24));
      for (const [dy, r] of [[0.3, 0.035], [0.13, 0.055]]) {
        const cone = new THREE.Mesh(new THREE.CircleGeometry(r, 16), mat(0x4a4a58, { roughness: 0.5 }));
        cone.position.set(cx + s * side, base + dy, y + 0.322);
        g.add(cone);
      }
    }
  }
  return g;
}

// Đồ đạc theo ô của nhà người chơi; trả về null nếu ô đó dựng theo kiểu chung (interior3d.js)
export function buildHomeTile(map, x, y, t) {
  const ch = map.tileAt(x, y);
  switch (ch) {
    case 'S': return stairsUp(map, x, y);
    case 's': return stairsDown(map, x, y);
    case '[':
    case ']': return sofa(map, x, y, ch);
    case 'F': return fridge(x, y);
    case 'c': return kitchenCounter(map, x, y, t);
    case 'w': return desk(x, y, t);
    case 'V': {
      // cả dãy ô TV dựng một lần ở ô trái cùng, các ô còn lại để trống
      if (map.tileAt(x - 1, y) === 'V') return new THREE.Group();
      let n = 1;
      while (map.tileAt(x + n, y) === 'V') n++;
      return tv(x, y, n, t, Boolean(map.tvConsole));
    }
    default: return null;
  }
}

// ---------- Thảm, đồ treo tường ----------

// rug: [x1, y1, x2, y2, màu nền, màu viền] (tính cả hai đầu, data/map.js)
export function rugMesh([x1, y1, x2, y2, base, edge]) {
  const w = x2 - x1 + 1 - 0.2;
  const d = y2 - y1 + 1 - 0.2;
  const tex = canvasTex(Math.round(w * 64), Math.round(d * 64), (c, W, H) => {
    c.fillStyle = base;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = edge;
    c.lineWidth = 5;
    c.strokeRect(10, 10, W - 20, H - 20);
    c.lineWidth = 2;
    c.strokeRect(20, 20, W - 40, H - 40);
    // hoạ tiết hình thoi ở giữa và chấm dọc viền
    c.fillStyle = edge;
    c.globalAlpha = 0.55;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) * 0.28;
    c.beginPath();
    c.moveTo(cx, cy - r);
    c.lineTo(cx + r * 1.4, cy);
    c.lineTo(cx, cy + r);
    c.lineTo(cx - r * 1.4, cy);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = base;
    c.beginPath();
    c.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = edge;
    for (let x = 32; x < W - 28; x += 18) {
      c.fillRect(x, 28, 5, 5);
      c.fillRect(x, H - 33, 5, 5);
    }
    // tua rua hai đầu
    for (let x = 4; x < W - 4; x += 6) {
      c.fillRect(x, 0, 2, 6);
      c.fillRect(x, H - 6, 2, 6);
    }
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    std(0xffffff, { map: tex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  m.position.set((x1 + x2 + 1) / 2, 0.006, (y1 + y2 + 1) / 2);
  m.receiveShadow = true;
  return m;
}

// Tranh treo trên tường sau, vẽ bằng canvas
function wallPicture(kind) {
  return canvasTex(96, 128, (c, w, h) => {
    if (kind === 'poster') {
      // tranh phong cảnh: trời, núi, đồi cỏ, mặt trời
      const sky = c.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#7ab8f0');
      sky.addColorStop(1, '#d8f0ff');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#f8d040';
      c.beginPath();
      c.arc(70, 30, 12, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#6a7aa8';
      c.beginPath();
      c.moveTo(0, 90);
      c.lineTo(34, 44);
      c.lineTo(62, 80);
      c.lineTo(80, 58);
      c.lineTo(96, 76);
      c.lineTo(96, 128);
      c.lineTo(0, 128);
      c.fill();
      c.fillStyle = '#5aa848';
      c.fillRect(0, 96, w, h - 96);
      c.fillStyle = '#ffffff';
      c.fillRect(30, 44, 8, 6);
    } else if (kind === 'calendar') {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#e04848';
      c.fillRect(0, 0, w, 30);
      c.fillStyle = '#c8ccd8';
      for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) c.fillRect(8 + k * 14, 40 + r * 16, 10, 10);
      c.fillStyle = '#e04848';
      c.fillRect(36, 72, 10, 10);
    } else {
      // ảnh gia đình: nền ấm, hai người đứng cạnh nhau
      c.fillStyle = '#f0e0c0';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#a8d088';
      c.fillRect(0, 90, w, h - 90);
      for (const [x, s, shirt, hair] of [[34, 1, '#e07050', '#6a3a20'], [64, 0.75, '#3870d8', '#3a2420']]) {
        c.fillStyle = shirt;
        c.fillRect(x - 12 * s, 112 - 50 * s, 24 * s, 36 * s);
        c.fillStyle = '#f8c8a0';
        c.beginPath();
        c.arc(x, 112 - 62 * s, 12 * s, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = hair;
        c.fillRect(x - 12 * s, 112 - 76 * s, 24 * s, 8 * s);
      }
    }
  });
}

// Đồ treo trên tường sau (map.wallDecor: { cột x: 'photo' | 'poster' | 'calendar' | 'clock' })
export function homeWallDecor(map) {
  const g = new THREE.Group();
  let wallZ = 0;
  while (wallZ < map.height && map.tileAt(0, wallZ) === '#') wallZ++;
  const frame = mat(RAIL, { roughness: 0.5 });
  for (const [col, kind] of Object.entries(map.wallDecor ?? {})) {
    const x = Number(col) + 0.5;
    if (kind === 'clock') {
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), std(0xfffaf0, { roughness: 0.4 }));
      face.position.set(x, 1.98, wallZ + 0.035);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.025, 8, 24), frame);
      rim.position.set(x, 1.98, wallZ + 0.035);
      const hand = (len, rot) => {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.014, len, 0.006).translate(0, len / 2, 0), mat(0x2a2030));
        h.position.set(x, 1.98, wallZ + 0.04);
        h.rotation.z = rot;
        return h;
      };
      g.add(face, rim, hand(0.1, -0.9), hand(0.07, 2.2));
      continue;
    }
    const [w, h, y] = kind === 'poster' ? [0.56, 0.74, 1.42] : kind === 'calendar' ? [0.36, 0.48, 1.45] : [0.44, 0.56, 1.5];
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(0xffffff, { map: wallPicture(kind), roughness: 0.7 }));
    pic.position.set(x, y, wallZ + 0.03);
    g.add(pic);
    if (kind !== 'calendar') {
      g.add(box(w + 0.08, h + 0.08, 0.03, frame, x, y, wallZ + 0.012));
    } else g.add(cyl(0.015, 0.015, 0.02, mat(0x8a94a4), x, y + h / 2 + 0.03, wallZ + 0.03, 6));
    // hơi lệch một chút cho tự nhiên
    if (kind === 'photo') g.children.slice(-2).forEach((m) => (m.rotation.z = (rand(Number(col), 1, 2) - 0.5) * 0.06));
  }
  return g;
}
