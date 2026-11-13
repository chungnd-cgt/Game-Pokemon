import * as THREE from 'three';
import { rand } from './nature.js';
import { Instancer, Sparks, box, canvasTex, cyl, fakeEnv, glowMat, shadowed, std } from './roomKit.js';

// Đồ vật câu đố trong gym và phòng Liên minh (bản 3D của gfx/interior.js + gfx/gymObjects.js):
//  o cột đá / tảng đá / tảng băng • v ^ < > ô gió (Gym Đồi Gió) hoặc dòng nước (Gym Sông Nước)
//  H hàng rào tre • Z tường điện • x than hồng • K lò gốm • Q ô dịch chuyển • i sàn băng • D cửa lớn

// Hướng đẩy -> góc quay quanh trục Y (mặt phẳng gốc chảy về phía +z, tức hướng 'v')
export const PUSH_ANGLE = { v: 0, '>': Math.PI / 2, '^': Math.PI, '<': -Math.PI / 2 };
const isPush = (ch) => ch in PUSH_ANGLE;

const FLAME = { elitePoison: 0x7cf070, eliteFighting: 0xff8a30, eliteGhost: 0xb070ff, eliteDragon: 0x5aa0ff, champion: 0xffc040, league: 0xffc040 };
const BOULDER = { gymRock: ['#8a7868', '#6a5a4c'], gymIce: ['#a8d8f8', '#78b0d8'] };

const decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const decal = (mat) => {
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
  return mat;
};

// Đá lởm chởm low-poly: khối cầu đa diện, đỉnh xô lệch ngẫu nhiên nhưng cố định theo seed
export function rockGeo(seed, detail = 1, amp = 0.22) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 1 + (rand(seen.size, seed, 7) - 0.5) * 2 * amp);
    v.multiplyScalar(seen.get(key));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- Texture vẽ bằng canvas ----------

function windTex(t) {
  return canvasTex(128, 128, (c) => {
    c.fillStyle = '#9fd6ee';
    c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#8ac8e4';
    for (let y = 14; y < 120; y += 12) c.fillRect(12, y, 104, 4); // khe gió
    c.strokeStyle = t.trim;
    c.lineWidth = 8;
    c.strokeRect(4, 4, 120, 120);
    // mũi tên chỉ hướng gió (chỉ xuống = hướng 'v')
    c.fillStyle = '#ffffff';
    c.strokeStyle = t.trimDark;
    c.lineWidth = 5;
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(64, 104);
    c.lineTo(100, 62);
    c.lineTo(76, 62);
    c.lineTo(76, 26);
    c.lineTo(52, 26);
    c.lineTo(52, 62);
    c.lineTo(28, 62);
    c.closePath();
    c.fill();
    c.stroke();
  });
}

// Vệt gió / sóng nước trong suốt, lặp theo chiều dọc để trượt texture tạo dòng chảy
function streakTex(color, count, len, width, seed) {
  const tex = canvasTex(128, 256, (c) => {
    c.clearRect(0, 0, 128, 256);
    c.strokeStyle = color;
    c.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = 8 + rand(i, seed, 1) * 112;
      const y = rand(i, seed, 2) * 256;
      const l = len * (0.6 + rand(i, seed, 3) * 0.8);
      c.lineWidth = width;
      const g = c.createLinearGradient(0, y, 0, y + l);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, color);
      c.strokeStyle = g;
      for (const dy of [0, -256]) {
        c.beginPath();
        c.moveTo(x, y + dy);
        c.quadraticCurveTo(x + (rand(i, seed, 4) - 0.5) * 16, y + dy + l / 2, x, y + dy + l);
        c.stroke();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function waterTex() {
  const tex = canvasTex(128, 128, (c) => {
    c.fillStyle = '#2f80e0';
    c.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 18; i++) {
      c.fillStyle = i % 3 ? 'rgba(138,200,248,0.7)' : 'rgba(220,240,255,0.8)';
      const x = rand(i, 3, 1) * 128;
      const y = rand(i, 3, 2) * 128;
      for (const dy of [0, -128, 128]) c.fillRect(x, y + dy, 3, 10 + rand(i, 3, 3) * 14);
    }
    // bọt sóng hình mũi tên chỉ hướng chảy
    c.strokeStyle = 'rgba(240,250,255,0.95)';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const y of [30, 94]) {
      c.beginPath();
      c.moveTo(40, y - 14);
      c.lineTo(64, y + 10);
      c.lineTo(88, y - 14);
      c.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function radialTex(inner, outer) {
  return canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

// Cột sáng dịch chuyển: đậm ở chân, nhạt dần lên trên, có các vạch ngang trôi lên
function beamTex() {
  const tex = canvasTex(32, 128, (c) => {
    for (let y = 0; y < 128; y++) {
      const a = (y / 128) ** 1.6 * (0.55 + 0.45 * (Math.sin(y * 0.6) > 0.6 ? 1 : 0));
      c.fillStyle = `rgba(255,255,255,${a})`;
      c.fillRect(0, y, 32, 1);
    }
  });
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Mặt băng: texture phủ 4x4 ô (toạ độ theo thế giới nên liền mạch giữa các ô), vết nứt trắng, vệt sáng chéo
function iceTex() {
  const S = 256;
  const tex = canvasTex(S, S, (c) => {
    const g = c.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#b8e2fa');
    g.addColorStop(0.5, '#94cdf0');
    g.addColorStop(1, '#b0dcf6');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    // mạch ghép các tấm băng
    c.strokeStyle = 'rgba(90,150,200,0.45)';
    c.lineWidth = 2;
    for (let k = 0; k <= S; k += 64) {
      c.beginPath();
      c.moveTo(k, 0);
      c.lineTo(k, S);
      c.moveTo(0, k);
      c.lineTo(S, k);
      c.stroke();
    }
    // vệt sáng chéo
    for (let i = 0; i < 7; i++) {
      const x = rand(i, 4, 1) * S;
      const y = rand(i, 4, 2) * S;
      const l = 20 + rand(i, 4, 3) * 50;
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 2 + rand(i, 4, 4) * 3;
      for (const [dx, dy] of [[0, 0], [S, 0], [0, S], [-S, 0], [0, -S]]) {
        c.beginPath();
        c.moveTo(x + dx, y + dy);
        c.lineTo(x + dx + l, y + dy - l);
        c.stroke();
      }
    }
    // vết nứt mảnh
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      let x = rand(i, 9, 1) * S;
      let y = rand(i, 9, 2) * S;
      c.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rand(i, k, 3) - 0.5) * 40;
        y += (rand(i, k, 4) - 0.5) * 40;
        c.lineTo(x, y);
      }
      c.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Gộp các ô thành một lưới phẳng, UV theo toạ độ thế giới (scale ô / texture)
function tileSheet(tiles, y, scale) {
  const pos = [];
  const uv = [];
  for (const [x, z] of tiles) {
    const q = [[x, z], [x, z + 1], [x + 1, z + 1], [x, z], [x + 1, z + 1], [x + 1, z]];
    for (const [qx, qz] of q) {
      pos.push(qx, y, qz);
      uv.push(qx * scale, -qz * scale);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function hazardTex() {
  const tex = canvasTex(64, 16, (c) => {
    c.fillStyle = '#1a1c28';
    c.fillRect(0, 0, 64, 16);
    c.fillStyle = '#f0c030';
    for (let x = -16; x < 64; x += 16) {
      c.beginPath();
      c.moveTo(x, 16);
      c.lineTo(x + 8, 16);
      c.lineTo(x + 16, 0);
      c.lineTo(x + 8, 0);
      c.fill();
    }
  });
  return tex;
}

function sealTex() {
  const tex = canvasTex(64, 128, (c) => {
    c.clearRect(0, 0, 64, 128);
    c.strokeStyle = 'rgba(220,170,255,0.9)';
    c.lineWidth = 2.5;
    for (let k = -128; k < 128; k += 16) {
      c.beginPath();
      c.moveTo(k, 0);
      c.lineTo(k + 128, 128);
      c.moveTo(k + 128, 0);
      c.lineTo(k, 128);
      c.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---------- Ô đặc biệt trong gym ----------

export function buildGymTiles(map, t, root) {
  const W = map.width;
  const H = map.height;
  const at = (x, y) => map.tileAt(x, y);
  const inst = new Instancer();
  const updaters = [];
  const lightSpots = { fire: [], spark: [], flame: [] };
  const water = map.theme === 'gymWater';
  const grand = /^(elite|champion|league)/.test(map.theme);

  // Vật liệu dùng chung
  const shaftMat = std(t.wall, { roughness: 0.55, flatShading: true });
  const trimMat = std(t.trim, { roughness: 0.6 });
  const trimDarkMat = std(t.trimDark, { roughness: 0.6 });
  const goldMat = std(0xe8c050, { roughness: 0.35, metalness: 0.6 });
  const g = {
    plinth: new THREE.BoxGeometry(0.78, 0.2, 0.78),
    shaft: new THREE.CylinderGeometry(0.25, 0.28, 1, 12),
    cap: new THREE.BoxGeometry(0.7, 0.16, 0.7),
    ring: new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12),
    bowl: new THREE.CylinderGeometry(0.3, 0.16, 0.2, 12),
  };
  const rocks = [0, 1, 2].map((s) => rockGeo(s * 13 + 1, 1, 0.2));
  const pebble = rockGeo(99, 0, 0.3);
  const flames = [];
  const flameGeo = new THREE.ConeGeometry(0.2, 0.62, 8, 1, true);
  const flameMat = glowMat(FLAME[map.theme] ?? 0xffa040, 0.95);
  const flameCore = glowMat(0xffffff, 0.55);
  const haloMat = new THREE.SpriteMaterial({ map: radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: FLAME[map.theme] ?? 0xffa040, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });

  // Cột đá có chân, thân khía rãnh, đầu cột; phòng Liên minh thêm vòng vàng và chậu lửa trên đỉnh
  const pillar = (x, y) => {
    const cx = x + 0.5;
    const cz = y + 0.5;
    const h = grand ? 2.0 : 1.75;
    inst.add(g.plinth, trimMat, cx, 0.1, cz);
    inst.add(g.shaft, shaftMat, cx, 0.2 + h / 2, cz, { sy: h });
    inst.add(g.cap, trimMat, cx, 0.28 + h, cz);
    inst.add(g.ring, trimDarkMat, cx, 0.24, cz, { s: 1.05, sy: 1 });
    if (grand) {
      for (const ry of [0.6, h - 0.1]) inst.add(g.ring, goldMat, cx, 0.2 + ry, cz, { s: 1.02 });
      inst.add(g.bowl, goldMat, cx, 0.46 + h, cz);
      const f = new THREE.Mesh(flameGeo, flameMat);
      f.position.set(cx, 0.86 + h, cz);
      const core = new THREE.Mesh(flameGeo, flameCore);
      core.scale.setScalar(0.5);
      core.position.y = -0.12;
      const halo = new THREE.Sprite(haloMat);
      halo.scale.setScalar(1.1);
      halo.position.y = -0.05;
      f.add(core);
      root.add(f, halo.translateX(cx).translateY(0.86 + h).translateZ(cz));
      flames.push({ f, phase: rand(x, y, 5) * 6 });
      lightSpots.flame.push([cx, 0.9 + h, cz]);
    }
  };

  // Tảng đá (Gym Núi Đá) hoặc tảng băng (Gym Sương Mù)
  const iceMat = std(0x7cc4f0, { roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.92, envMap: fakeEnv(), envMapIntensity: 0.7, flatShading: true, emissive: 0x1a4a80, emissiveIntensity: 0.35 });
  const rockMat = std(0xffffff, { roughness: 0.95, flatShading: true });
  const boulder = (x, y) => {
    const cx = x + 0.5;
    const cz = y + 0.5;
    const k = Math.floor(rand(x, y, 1) * 3);
    if (map.theme === 'gymIce') {
      inst.add(rocks[k], iceMat, cx, 0.36, cz, { sx: 0.44, sy: 0.4, sz: 0.42, ry: rand(x, y, 2) * 6 });
      inst.add(pebble, iceMat, cx + 0.12, 0.62, cz - 0.05, { sx: 0.16, sy: 0.32, sz: 0.16, rz: 0.3 });
      return;
    }
    const [c1, c2] = BOULDER.gymRock;
    inst.add(rocks[k], rockMat, cx, 0.38, cz, { sx: 0.46, sy: 0.42, sz: 0.44, ry: rand(x, y, 2) * 6, color: rand(x, y, 3) > 0.5 ? c1 : c2 });
    inst.add(pebble, rockMat, cx + (rand(x, y, 4) - 0.5) * 0.7, 0.05, cz + 0.38, { s: 0.09, color: c2 });
  };

  // Ô gió / dòng nước: tấm nền có mũi tên, lớp vệt trôi theo hướng đẩy
  const pushTiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isPush(at(x, y))) pushTiles.push([x, y, at(x, y)]);
  if (pushTiles.length) {
    const flows = [];
    if (water) {
      const tex = waterTex();
      const surf = decal(std(0xffffff, { map: tex, transparent: true, opacity: 0.88, roughness: 0.12, metalness: 0.1, envMap: fakeEnv(), envMapIntensity: 0.7 }));
      const foamTex = streakTex('rgba(255,255,255,0.85)', 14, 40, 3, 5);
      const foam = decal(new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.55, depthWrite: false }));
      const rimMat = std(t.counterTop, { roughness: 0.5 });
      const rimGeo = new THREE.BoxGeometry(1, 0.08, 0.1);
      for (const [x, y, ch] of pushTiles) {
        inst.add(decalGeo, surf, x + 0.5, 0.03, y + 0.5, { ry: PUSH_ANGLE[ch] });
        inst.add(decalGeo, foam, x + 0.5, 0.04, y + 0.5, { ry: PUSH_ANGLE[ch] });
        // bờ kênh nơi dòng nước giáp sàn khô
        for (const [dx, dy, ry] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) {
          if (isPush(at(x + dx, y + dy))) continue;
          inst.add(rimGeo, rimMat, x + 0.5 + dx * 0.47, 0.04, y + 0.5 + dy * 0.47, { ry });
        }
      }
      flows.push({ tex, speed: 0.9 }, { tex: foamTex, speed: 1.3 });
    } else {
      const base = decal(std(0xffffff, { map: windTex(t), roughness: 0.5 }));
      const flowTex = streakTex('rgba(255,255,255,0.95)', 16, 46, 3, 1);
      const airTex = streakTex('rgba(255,255,255,0.9)', 5, 80, 2.5, 2);
      const flow = decal(new THREE.MeshBasicMaterial({ map: flowTex, transparent: true, opacity: 0.85, depthWrite: false }));
      const air = new THREE.MeshBasicMaterial({ map: airTex, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
      const tileGeo = new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2);
      for (const [x, y, ch] of pushTiles) {
        inst.add(tileGeo, base, x + 0.5, 0.01, y + 0.5, { ry: PUSH_ANGLE[ch] });
        inst.add(decalGeo, flow, x + 0.5, 0.02, y + 0.5, { ry: PUSH_ANGLE[ch] });
        inst.add(decalGeo, air, x + 0.5, 0.45 + rand(x, y, 1) * 0.3, y + 0.5, { ry: PUSH_ANGLE[ch] });
      }
      flows.push({ tex: flowTex, speed: 1.6 }, { tex: airTex, speed: 2.6 });
    }
    updaters.push((time) => flows.forEach((f) => (f.tex.offset.y = (time * f.speed) % 1)));
  }

  // Hàng rào tre: các cây tre xanh có đốt, buộc hai thanh ngang, chân là bụi cỏ thấp
  const bamboo = new THREE.CylinderGeometry(0.065, 0.07, 1, 7);
  const bambooNode = new THREE.CylinderGeometry(0.078, 0.078, 0.03, 7);
  const bambooMat = std(0xffffff, { roughness: 0.6 });
  const railGeo = new THREE.BoxGeometry(1.0, 0.06, 0.05);
  const railMat = std(0x6a4a28);
  const shrubGeo = new THREE.BoxGeometry(1, 0.16, 0.36);
  const shrubMat = std(0x3a5a20);
  const leafGeo = new THREE.IcosahedronGeometry(0.13, 0);
  const leafMat = std(0x5a9a38, { flatShading: true });
  const fence = (x, y) => {
    const cz = y + 0.5;
    inst.add(shrubGeo, shrubMat, x + 0.5, 0.08, cz);
    for (let i = 0; i < 4; i++) {
      const bx = x + 0.125 + i * 0.25;
      const h = 1.0 + rand(x, y, i) * 0.22;
      const c = ['#8ab848', '#7aa840', '#9ac458'][Math.floor(rand(x, y, i + 4) * 3)];
      inst.add(bamboo, bambooMat, bx, h / 2, cz, { sy: h, color: c });
      for (const ny of [0.32, 0.7]) inst.add(bambooNode, bambooMat, bx, ny + rand(x, y, i + 9) * 0.06, cz, { color: '#5a8a30' });
      if (rand(x, y, i + 20) > 0.6) inst.add(leafGeo, leafMat, bx + 0.05, h + 0.04, cz, { sx: 1.4, sy: 0.6, sz: 1 });
    }
    for (const ry of [0.42, 0.85]) for (const dz of [-0.09, 0.09]) inst.add(railGeo, railMat, x + 0.5, ry, cz + dz);
  };

  // Tường điện: cột kim loại, chân sơn sọc cảnh báo, ba thanh điện vàng nối sang ô bên cạnh, tia điện lách tách
  const sparks = new Sparks(0xfff4a0, 6);
  const metalMat = std(0x4a4e60, { roughness: 0.4, metalness: 0.6 });
  const postGeo = new THREE.BoxGeometry(0.26, 1.35, 0.26);
  const hazardMat = std(0xffffff, { map: hazardTex(), roughness: 0.6 });
  const footGeo = new THREE.BoxGeometry(1, 0.22, 0.4);
  const insGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.14, 8);
  const insMat = std(0xe8e0d0, { roughness: 0.3 });
  const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6).rotateZ(Math.PI / 2);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffe860 });
  const lampGeo = new THREE.SphereGeometry(0.1, 10, 8);
  const lampMat = std(0xc02828, { emissive: 0xff4020, emissiveIntensity: 1.2 });
  const zwall = (x, y) => {
    const cx = x + 0.5;
    const cz = y + 0.5;
    inst.add(footGeo, hazardMat, cx, 0.11, cz);
    inst.add(postGeo, metalMat, cx, 0.9, cz);
    inst.add(insGeo, insMat, cx, 1.64, cz);
    if (x % 3 === 0) inst.add(lampGeo, lampMat, cx, 1.8, cz);
    const right = at(x + 1, y) === 'Z';
    for (const by of [0.45, 0.8, 1.15]) {
      if (right) inst.add(barGeo, barMat, x + 1, by, cz, { sx: 0.74 });
      if (right && rand(x, by * 10, 3) > 0.35) sparks.arc([cx + 0.13, by, cz], [cx + 0.87, by, cz], 0.07);
    }
    if (right && x % 4 === 1) lightSpots.spark.push([x + 1, 1.0, cz + 0.6]);
  };

  // Than hồng: các cục than đỏ rực, quầng sáng nhấp nháy, tàn lửa bay lên
  const coalGeo = new THREE.DodecahedronGeometry(0.09, 0);
  const coalMats = [0, 1, 2].map(() => std(0x3a2018, { emissive: 0xff5010, emissiveIntensity: 1, flatShading: true, roughness: 0.9 }));
  const heatMat = decal(glowMat(0xff6a20, 0.5, { map: radialTex('rgba(255,200,120,1)', 'rgba(255,80,0,0)') }));
  const coalTiles = [];
  const coal = (x, y) => {
    coalTiles.push([x, y]);
    inst.add(decalGeo, heatMat, x + 0.5, 0.015, y + 0.5, { s: 1.15 });
    for (let i = 0; i < 7; i++) {
      inst.add(coalGeo, coalMats[i % 3], x + 0.12 + rand(x, y, i) * 0.76, 0.04, y + 0.12 + rand(x, y, i + 10) * 0.76, {
        s: 0.7 + rand(x, y, i + 20) * 0.8,
        sy: 0.6,
        ry: rand(x, y, i + 30) * 6,
      });
    }
  };

  // Lò gốm: thân trụ gạch nung, mái vòm, cửa lò lửa cháy, ống khói nhỏ
  const kilnMat = std(0xa84a2a, { roughness: 0.9, flatShading: true });
  const kilnDark = std(0x3a1408);
  const fireMat = glowMat(0xff8a20, 0.9);
  const fires = [];
  const kiln = (x, y) => {
    const cx = x + 0.5;
    const cz = y + 0.5;
    const k = new THREE.Group();
    k.add(cyl(0.42, 0.45, 0.55, kilnMat, 0, 0.275, 0, 10));
    const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), kilnMat));
    dome.position.y = 0.55;
    dome.scale.y = 0.8;
    k.add(dome, cyl(0.08, 0.1, 0.35, kilnMat, 0.12, 1.0, -0.12, 8), box(0.34, 0.36, 0.1, kilnDark, 0, 0.22, 0.4));
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.28), fireMat);
    fire.position.set(0, 0.18, 0.46);
    k.add(fire);
    fires.push(fire);
    k.position.set(cx, 0, cz);
    root.add(k);
    lightSpots.fire.push([cx, 0.5, cz + 0.7]);
  };

  // Ô dịch chuyển: đĩa tím, vòng sáng xoay, cột sáng mờ bốc lên
  const padBase = std(0x5a2a88, { roughness: 0.4 });
  const padInner = std(0xa858d8, { emissive: 0xa858d8, emissiveIntensity: 0.6, roughness: 0.3 });
  const ringMat = glowMat(0xf0c8ff, 0.9);
  const beam = beamTex();
  const beamMat = glowMat(0xd8a0ff, 0.35, { map: beam, side: THREE.DoubleSide });
  const ringGeo = new THREE.TorusGeometry(0.36, 0.025, 6, 32).rotateX(Math.PI / 2);
  const rings = [];
  const pad = (x, y) => {
    const p = new THREE.Group();
    p.add(cyl(0.45, 0.47, 0.05, padBase, 0, 0.025, 0, 24), cyl(0.33, 0.33, 0.055, padInner, 0, 0.03, 0, 24));
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.08;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 1.3, 20, 1, true), beamMat);
    col.position.y = 0.7;
    p.add(ring, col);
    p.position.set(x + 0.5, 0, y + 0.5);
    root.add(p);
    rings.push({ ring, phase: rand(x, y, 1) * 6 });
  };

  // Sàn băng bóng loáng phản chiếu ánh đèn
  const iceFloor = decal(std(0xffffff, { map: iceTex(), roughness: 0.08, metalness: 0.05, envMap: fakeEnv(), envMapIntensity: 0.55 }));
  const iceTiles = [];

  // Nước sâu (Gym Sông Nước), hố (Gym Núi Đá), miệng phun lửa (Gym Lò Gốm)
  const deepMat = std(0x1a5aa8, { roughness: 0.12, metalness: 0.1, envMap: fakeEnv(), envMapIntensity: 0.6 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050302 });
  const ventMat = std(0x3a2a24, { roughness: 0.6, metalness: 0.4 });
  const ventGlow = [0xf8b040, 0xf05a3a].map((c) => std(c, { emissive: c, emissiveIntensity: 0.9 }));
  const deep = (x, y) => root.add(box(1, 0.03, 1, deepMat, x + 0.5, 0.012, y + 0.5));
  const hole = (x, y) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.44, 20).rotateX(-Math.PI / 2), holeMat);
    m.position.set(x + 0.5, 0.012, y + 0.5);
    root.add(m);
  };
  const vent = (x, y, group) => root.add(box(0.86, 0.05, 0.86, ventMat, x + 0.5, 0.03, y + 0.5), box(0.26, 0.06, 0.26, ventGlow[group], x + 0.5, 0.05, y + 0.5));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = at(x, y);
      if (ch === '~') deep(x, y);
      else if (ch === 'O') hole(x, y);
      else if (ch === 'X' || ch === 'Y') vent(x, y, ch === 'Y' ? 1 : 0);
      if (ch === 'o') (BOULDER[map.theme] ? boulder : pillar)(x, y);
      else if (ch === 'H') fence(x, y);
      else if (ch === 'Z') zwall(x, y);
      else if (ch === 'x') coal(x, y);
      else if (ch === 'K') kiln(x, y);
      else if (ch === 'Q') pad(x, y);
      if (ch === 'i' || (ch === 'o' && map.theme === 'gymIce' && [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => at(x + dx, y + dy) === 'i'))) {
        iceTiles.push([x, y]);
      }
    }
  }
  inst.build(root);
  if (iceTiles.length) {
    const sheet = new THREE.Mesh(tileSheet(iceTiles, 0.006, 0.25), iceFloor);
    sheet.receiveShadow = true;
    root.add(sheet);
  }
  // Lớp trong suốt / tự sáng không đổ bóng
  root.traverse((o) => {
    if (o.isInstancedMesh && (o.material.transparent || o.material.isMeshBasicMaterial)) o.castShadow = false;
  });

  if (sparks.arcs.length) {
    root.add(sparks.finish());
    let next = 0;
    updaters.push((time) => {
      if (time < next) return;
      next = time + 0.06 + Math.random() * 0.05;
      sparks.reshape();
      sparks.mat.opacity = 0.5 + Math.random() * 0.5;
      barMat.color.setHex(Math.random() > 0.25 ? 0xffe050 : 0xfff4a0);
    });
  }
  if (coalTiles.length) {
    root.add(emberParticles(coalTiles, updaters));
    updaters.push((time) => {
      coalMats.forEach((m, i) => (m.emissiveIntensity = 0.8 + Math.sin(time * (3 + i) + i * 2) * 0.35 + Math.sin(time * 11.3 + i) * 0.15));
      heatMat.opacity = 0.4 + Math.sin(time * 2.3) * 0.1;
    });
  }
  if (fires.length) updaters.push((time) => fires.forEach((f, i) => f.scale.set(1, 0.85 + Math.abs(Math.sin(time * 9 + i * 1.7)) * 0.25, 1)));
  if (flames.length) {
    updaters.push((time) =>
      flames.forEach(({ f, phase }) => {
        const k = Math.sin(time * 10 + phase) * 0.08 + Math.sin(time * 17.3 + phase * 2) * 0.05;
        f.scale.set(1 - k, 1 + k * 2.5, 1 - k);
      }),
    );
  }
  if (rings.length) {
    updaters.push((time) => {
      rings.forEach(({ ring, phase }) => {
        const k = (time * 0.6 + phase) % 1;
        ring.position.y = 0.06 + k * 1.1;
        ring.scale.setScalar(1 - k * 0.25);
      });
      ringMat.opacity = 0.9;
      beam.offset.y = -time * 0.5;
      padInner.emissiveIntensity = 0.6 + Math.sin(time * 3) * 0.3;
    });
  }

  return {
    lightSpots,
    update(time) {
      for (const u of updaters) u(time);
    },
  };
}

// Tàn lửa: các chấm sáng bay lên từ ô than rồi tắt dần (màu tối dần = mờ đi vì cộng màu)
function emberParticles(tiles, updaters) {
  const n = Math.min(160, tiles.length * 2);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const seeds = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = tiles[i % tiles.length];
    seeds.push({ x: x + rand(i, 1, 1), z: y + rand(i, 1, 2), phase: rand(i, 1, 3), speed: 0.25 + rand(i, 1, 4) * 0.3 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false;
  updaters.push((time) => {
    seeds.forEach((s, i) => {
      const k = (time * s.speed + s.phase) % 1;
      pos.set([s.x + Math.sin(time * 2 + i) * 0.08, k * 1.3, s.z], i * 3);
      const f = 1 - k;
      col.set([1 * f, 0.55 * f * f, 0.15 * f * f], i * 3);
    });
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });
  return pts;
}

// ---------- Đồ vật câu đố (map.objects) ----------

// Trả về { node, setOn?, update? }: view3d ẩn / hiện node theo objectVisible, gọi setOn(cờ đã bật)
export function buildGymObject(o, t) {
  const node = new THREE.Group();
  node.position.set(o.x + 0.5, 0, o.y + 0.5);
  if (o.kind === 'gate' && o.look === 'seal') return sealGate(node, t);
  if (o.kind === 'gate' && o.look === 'sluice') return sluiceGate(node);
  if (o.kind === 'gate') return bambooGate(node);
  if (o.kind === 'barrier' && o.look === 'gate') return bambooGate(node);
  if (o.kind === 'barrier') return barrier(node);
  if (o.kind === 'lantern') return lanternPost(node);
  if (o.kind === 'switch') return floorSwitch(node);
  if (o.kind === 'toggle') return lever(node);
  return null;
}

// Cửa cống gỗ chắn dòng nước (Gym Sông Nước)
function sluiceGate(node) {
  const wood = std(0xa87a48, { roughness: 0.7 });
  const frame = std(0x6a4a28);
  for (const sx of [-0.44, 0.44]) node.add(box(0.12, 1.1, 0.16, frame, sx, 0.55, 0));
  node.add(box(0.8, 0.8, 0.1, wood, 0, 0.42, 0), box(0.96, 0.1, 0.18, frame, 0, 1.05, 0));
  return { node };
}

// Cột đèn lồng (Gym Đèn Lồng tối): cột gỗ, lồng đèn đỏ
function lanternPost(node) {
  node.add(cyl(0.05, 0.06, 1.2, std(0x5a3a20), 0, 0.6, 0, 8));
  node.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), std(0xe84838, { emissive: 0x802010, emissiveIntensity: 0.6 })).translateY(1.3));
  return { node };
}

// Cổng tre vàng giữa hàng rào: cao hơn rào, hai cột đầu tròn, dây buộc đỏ để nhận ra là cổng
function bambooGate(node) {
  const pole = std(0xc8b050, { roughness: 0.55 });
  const poleDark = std(0x988030);
  const rope = std(0xc83a30);
  for (let i = 0; i < 4; i++) {
    const bx = -0.375 + i * 0.25;
    node.add(cyl(0.075, 0.08, 1.1, pole, bx, 0.55, 0, 8));
    for (const ny of [0.35, 0.78]) node.add(cyl(0.085, 0.085, 0.03, poleDark, bx, ny, 0, 8));
  }
  for (const sx of [-0.52, 0.52]) {
    node.add(cyl(0.09, 0.1, 1.45, poleDark, sx, 0.725, 0, 8));
    node.add(cyl(0.12, 0.12, 0.08, rope, sx, 1.47, 0, 10));
  }
  for (const ry of [0.3, 0.92]) node.add(box(1.12, 0.07, 0.2, std(0x7a5a30), 0, ry, 0));
  node.add(box(0.2, 0.22, 0.22, rope, 0, 0.92, 0));
  return { node };
}

// Cửa phong ấn (Liên minh): hai trụ tím, màn lưới năng lượng trôi chậm
function sealGate(node, t) {
  const tex = sealTex();
  const curtain = glowMat(0xc898f8, 0.75, { map: tex, side: THREE.DoubleSide });
  const postMat = std(0x5a3088, { emissive: 0x3a1068, emissiveIntensity: 0.5, roughness: 0.4 });
  for (const sx of [-0.47, 0.47]) {
    node.add(box(0.14, 1.9, 0.22, postMat, sx, 0.95, 0));
    node.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glowMat(0xf0d8ff, 0.9)).translateX(sx).translateY(2.0));
  }
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), curtain);
  plane.position.y = 0.92;
  const plane2 = plane.clone();
  plane2.material = curtain.clone();
  plane2.material.map = tex.clone();
  plane2.material.map.wrapS = plane2.material.map.wrapT = THREE.RepeatWrapping;
  plane2.position.z = -0.05;
  node.add(plane, plane2);
  return {
    node,
    update(time) {
      tex.offset.y = time * 0.15;
      plane2.material.map.offset.y = -time * 0.1;
      curtain.opacity = 0.6 + Math.sin(time * 3) * 0.15;
    },
  };
}

// Hàng rào điện (Gym Đèn Lồng): hai cột kim loại, ba tia điện vàng chạy ngang, quầng sáng mờ
function barrier(node) {
  const post = std(0x5a6070, { roughness: 0.4, metalness: 0.5 });
  const stripe = std(0x9aa0b0, { roughness: 0.4, metalness: 0.5 });
  for (const sx of [-0.42, 0.42]) {
    node.add(box(0.16, 1.3, 0.2, post, sx, 0.65, 0), box(0.05, 1.2, 0.21, stripe, sx, 0.65, 0));
    node.add(cyl(0.07, 0.09, 0.12, std(0xf0c030, { emissive: 0xf0c030, emissiveIntensity: 0.6 }), sx, 1.36, 0, 8));
  }
  const sparks = new Sparks(0xfff27a, 8);
  for (const y of [0.35, 0.7, 1.05]) {
    sparks.arc([-0.34, y, 0], [0.34, y, 0], 0.12);
    sparks.arc([-0.34, y, 0], [0.34, y, 0], 0.06);
  }
  node.add(sparks.finish());
  const haze = glowMat(0xfff080, 0.16, { side: THREE.DoubleSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), haze);
  plane.position.y = 0.7;
  node.add(plane);
  let next = 0;
  return {
    node,
    update(time) {
      if (time < next) return;
      next = time + 0.05 + Math.random() * 0.05;
      sparks.reshape();
      haze.opacity = 0.1 + Math.random() * 0.12;
    },
  };
}

// Công tắc nền: tấm đá tròn, nút giữa đỏ; bật thì nút lún xuống và sáng vàng
function floorSwitch(node) {
  node.add(cyl(0.4, 0.43, 0.06, std(0x7a8090, { roughness: 0.7 }), 0, 0.03, 0, 20));
  node.add(cyl(0.3, 0.32, 0.04, std(0xa8b0c0, { roughness: 0.6 }), 0, 0.075, 0, 20));
  const btnMat = std(0xd04848, { emissive: 0x000000, roughness: 0.4 });
  const btn = cyl(0.15, 0.17, 0.08, btnMat, 0, 0.13, 0, 16);
  const glow = new THREE.Mesh(decalGeo, glowMat(0xffe060, 0, { map: radialTex('rgba(255,240,160,1)', 'rgba(255,200,0,0)') }));
  glow.scale.setScalar(1.3);
  glow.position.y = 0.11;
  node.add(btn, glow);
  let state = null;
  return {
    node,
    setOn(on) {
      if (on === state) return;
      state = on;
      btnMat.color.setHex(on ? 0xf8e048 : 0xd04848);
      btnMat.emissive.setHex(on ? 0xf0c020 : 0x000000);
      btnMat.emissiveIntensity = on ? 1 : 0;
      btn.position.y = on ? 0.1 : 0.13;
      glow.material.opacity = on ? 0.6 : 0;
    },
  };
}

// Công tắc gạt (Gym Đèn Lồng): bệ kim loại, cần gạt nghiêng trái / phải, đèn đổi màu xanh <-> vàng theo nguồn điện
function lever(node) {
  node.add(cyl(0.4, 0.43, 0.06, std(0x3a3e4c, { roughness: 0.5, metalness: 0.4 }), 0, 0.03, 0, 20));
  node.add(box(0.36, 0.14, 0.2, std(0x5a5e70, { metalness: 0.5, roughness: 0.4 }), 0, 0.12, 0));
  const lampMat = std(0x4ab0ff, { emissive: 0x2a80ff, emissiveIntensity: 1 });
  const arm = new THREE.Group();
  arm.position.set(0, 0.18, 0);
  arm.add(cyl(0.025, 0.025, 0.42, std(0xb8c0cc, { metalness: 0.7, roughness: 0.3 }), 0, 0.21, 0, 8));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), lampMat);
  knob.position.y = 0.44;
  arm.add(knob);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 32).rotateX(Math.PI / 2), glowMat(0x4ab0ff, 0.8));
  ring.position.y = 0.065;
  node.add(arm, ring);
  let state = null;
  return {
    node,
    setOn(on) {
      if (on === state) return;
      state = on;
      arm.rotation.z = on ? -0.55 : 0.55;
      const c = on ? 0xffd040 : 0x4ab0ff;
      lampMat.color.setHex(c);
      lampMat.emissive.setHex(c);
      ring.material.color.setHex(c);
    },
  };
}
