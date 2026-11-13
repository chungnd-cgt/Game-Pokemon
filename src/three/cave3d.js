import * as THREE from 'three';
import { rockGeo } from './gymProps.js';
import { rand } from './nature.js';
import { WATER_BED, WATER_LEVEL } from './outdoorKit.js';
import { waterSurface } from './outdoorProps.js';
import { Instancer, buildGem, canvasTex, fakeEnv, glowMat, makeDarkness, std } from './roomKit.js';

// Hang động 3D (Hang Thạch Nhũ, Hang Sơn Động, Hang Vân Sơn băng). Giao diện giống buildWorld / buildInterior, xem three/view3d.js.
//  # vách hang: một khối đá liền (lưới độ cao) dựng quanh nền hang, đỉnh tối cho cảm giác bị bao kín;
//    vách phía camera (phía nam nền hang) thấp dần để không che người chơi
//  . nền đá gồ ghề (texture vẽ tay) • o tảng đá • C cửa hang: khe sáng, cột nắng rọi xuống
//  w nước ngầm: khoét nền hang, đáy tối, bờ đá dựng đứng, mặt nước gợn nhẹ ở WATER_LEVEL (người lướt nước ngồi đúng
//    độ cao này, xem view3d.js); hang băng là nước xanh lạnh
// Không có trời: sương mù / ngày đêm của view3d không áp vào vật liệu trong hang (fog: false).

const MARGIN = 10; // phủ đá ra ngoài bản đồ để không thấy nền trời
const STEP = 1 / 3; // độ mịn lưới đá
const P = 48; // px mỗi ô trên texture nền

const ROCK = {
  floor: '#5a4c44', floorAlt: '#52463e', dot: '#6a5a50', crack: '#3a302a', edge: '#2a221e',
  base: '#5a4a40', face: '#4a3e38', faceAlt: '#3e3430', lip: '#7a685a', top: '#1e1816',
  boulder: ['#7a6a5c', '#5e5046'], crystal: [0xb07aff, 0x4ae0d0], spike: '#4e423a',
  light: 0xffe4b8, crystalLight: 0x9a7aff,
};
const ICE = {
  floor: '#d6e0ee', floorAlt: '#c6d2e6', dot: '#a8b8d4', crack: '#9ab0d0', edge: '#7a90b8',
  base: '#e4eefa', face: '#5a7cc4', faceAlt: '#4a68b0', lip: '#94bcec', top: '#16223e',
  boulder: ['#a8d8f8', '#78b0d8'], crystal: [0x9ae4ff, 0xe0f6ff], spike: '#a8d0f0',
  light: 0xe8f4ff, crystalLight: 0x6ac8ff,
};

// Nhiễu giá trị (value noise) 2 chiều, mượt, cố định theo toạ độ
function noise(x, y, s) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = rand(ix, iy, s);
  const b = rand(ix + 1, iy, s);
  const c = rand(ix, iy + 1, s);
  const d = rand(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Hướng mở ra ngoài của cửa hang (cửa nằm sát mép bản đồ)
function exitDir(map, x, y) {
  if (y <= 1) return [0, -1];
  if (y >= map.height - 2) return [0, 1];
  return x <= 1 ? [-1, 0] : [1, 0];
}

export function buildCave(map) {
  const ice = map.caveTheme === 'ice';
  const C = ice ? ICE : ROCK;
  const root = new THREE.Group();
  const W = map.width;
  const H = map.height;
  const tileAt = (x, y) => map.tileAt(x, y);
  const updaters = [];

  // Ô trống (đi được) và đường hầm khoét ra ngoài ở cửa hang
  const exits = [];
  const carved = new Set();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (tileAt(x, y) !== 'C') continue;
      const [dx, dy] = exitDir(map, x, y);
      exits.push({ x, y, dx, dy });
      for (let k = 1; k <= 3; k++) carved.add(`${x + dx * k},${y + dy * k}`);
    }
  }
  const open = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? tileAt(x, y) !== '#' : false) || carved.has(`${x},${y}`);

  // ---------- Vách đá: lưới độ cao ----------
  // Độ cao tại một điểm: 0 trên nền hang, dựng đứng ngay mép rồi cao dần khi càng xa nền;
  // phía nam nền hang (gần camera) bị giới hạn độ cao để không che khuất.
  const heightAt = (px, pz) => {
    let d = 5;
    let dN = Infinity;
    const x0 = Math.floor(px);
    const z0 = Math.floor(pz);
    for (let ty = z0 - 5; ty <= z0 + 4; ty++) {
      for (let tx = x0 - 4; tx <= x0 + 4; tx++) {
        if (!open(tx, ty)) continue;
        const ddx = Math.max(tx - px, 0, px - (tx + 1));
        const ddz = Math.max(ty - pz, 0, pz - (ty + 1));
        d = Math.min(d, Math.hypot(ddx, ddz));
        if (px >= tx - 0.35 && px <= tx + 1.35 && pz >= ty + 1 - 1e-6) dN = Math.min(dN, pz - (ty + 1));
      }
    }
    if (d < 0.01) return { h: 0, d };
    const rough = noise(px * 1.3, pz * 1.3, 11) * 0.5 + noise(px * 3.1, pz * 3.1, 12) * 0.25;
    let h = THREE.MathUtils.smoothstep(d, 0, 0.32) * (1.15 + rough) + Math.min(d, 4) * 0.55 * (0.7 + rough);
    h = Math.min(h, 0.5 + dN * 1.0 + rough * 0.3);
    return { h: Math.max(h, 0.04), d };
  };

  const gx0 = -MARGIN;
  const gz0 = -MARGIN;
  const nx = Math.round((W + MARGIN * 2) / STEP);
  const nz = Math.round((H + MARGIN * 2) / STEP);
  const verts = new Float32Array((nx + 1) * (nz + 1) * 3);
  const flat = new Uint8Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      let px = gx0 + i * STEP;
      let pz = gz0 + j * STEP;
      const { h, d } = heightAt(px, pz);
      const k = j * (nx + 1) + i;
      if (h === 0) flat[k] = 1;
      else {
        // xô lệch đỉnh cho khối đá trông thô ráp (không lấn vào nền hang)
        const amp = Math.min(1, d / 0.3) * 0.13;
        px += (rand(i, j, 21) - 0.5) * 2 * amp;
        pz += (rand(i, j, 22) - 0.5) * 2 * amp;
      }
      verts.set([px, h, pz], k * 3);
    }
  }
  const pos = [];
  const v = (i, j) => (j * (nx + 1) + i) * 3;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = v(i, j);
      const b = v(i + 1, j);
      const c = v(i, j + 1);
      const d = v(i + 1, j + 1);
      if (flat[a / 3] && flat[b / 3] && flat[c / 3] && flat[d / 3]) continue;
      // chéo xen kẽ cho mặt đá đỡ đều đặn
      const tris = (i + j) % 2 ? [[a, c, b], [b, c, d]] : [[a, c, d], [a, d, b]];
      for (const tri of tris) for (const idx of tri) pos.push(verts[idx], verts[idx + 1], verts[idx + 2]);
    }
  }
  const rockGeom = new THREE.BufferGeometry();
  rockGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  rockGeom.computeVertexNormals();
  // Tô màu theo từng tam giác: chân vách sáng, mặt vách nâu / xanh băng, đỉnh tối dần theo độ cao
  const nrm = rockGeom.attributes.normal;
  const colors = new Float32Array(pos.length);
  const cBase = new THREE.Color(C.base);
  const cFace = new THREE.Color(C.face);
  const cAlt = new THREE.Color(C.faceAlt);
  const cLip = new THREE.Color(C.lip);
  const cTop = new THREE.Color(C.top);
  const col = new THREE.Color();
  for (let t = 0; t < pos.length / 9; t++) {
    const y = (pos[t * 9 + 1] + pos[t * 9 + 4] + pos[t * 9 + 7]) / 3;
    const ny = nrm.getY(t * 3);
    const r = rand(t, 3, 31);
    if (ny > 0.75) {
      // mặt phẳng trên đỉnh: mép thấp sáng (gờ đá), lên cao tối hẳn
      col.copy(cLip).lerp(cTop, THREE.MathUtils.smoothstep(y, 0.5, 1.9));
    } else {
      col.copy(r > 0.5 ? cFace : cAlt);
      if (y < 0.35) col.lerp(cBase, ice ? 0.75 : 0.4);
      else col.lerp(cTop, THREE.MathUtils.smoothstep(y, 1.6, 3.2) * 0.85);
      if (ice && rand(t, 4, 32) > 0.82) col.lerp(cLip, 0.6); // mảnh băng sáng loé
    }
    col.multiplyScalar(0.9 + r * 0.2);
    for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], t * 9 + k * 3);
  }
  rockGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const rockMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: ice ? 0.3 : 0.95,
    metalness: ice ? 0.1 : 0,
    fog: false,
    ...(ice ? { envMap: fakeEnv(), envMapIntensity: 0.45 } : {}),
  });
  const rock = new THREE.Mesh(rockGeom, rockMat);
  rock.castShadow = true;
  rock.receiveShadow = true;
  root.add(rock);

  // ---------- Nền hang ----------
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture(map, C, ice, open),
    roughness: ice ? 0.22 : 0.92,
    metalness: ice ? 0.05 : 0,
    fog: false,
    ...(ice ? { envMap: fakeEnv(), envMapIntensity: 0.35 } : {}),
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(W / 2, 0, H / 2);
  floor.receiveShadow = true;
  root.add(floor);
  const waterCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tileAt(x, y) === 'w') waterCells.push([x, y]);
  if (waterCells.length) {
    // nền hang bị khoét đúng các ô nước (texture trong suốt ở đó, xem floorTexture)
    floorMat.alphaTest = 0.5;
    root.add(caveWater(waterCells, tileAt, W, H, C, ice, updaters));
  }
  // nền đường hầm ra ngoài: sáng dần về phía cửa
  const tunnelMat = new THREE.MeshStandardMaterial({
    map: canvasTex(32, 96, (c) => {
      const g = c.createLinearGradient(0, 96, 0, 0);
      g.addColorStop(0, C.floor);
      g.addColorStop(1, ice ? '#ffffff' : '#f4e8c8');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 96);
    }),
    emissive: 0xffffff,
    emissiveIntensity: 0,
    fog: false,
  });
  tunnelMat.emissiveMap = tunnelMat.map;
  tunnelMat.emissiveIntensity = 0.55;

  // ---------- Đá, măng đá, tinh thể ----------
  const inst = new Instancer();
  const rocks = [0, 1, 2].map((s) => rockGeo(s * 17 + 3, 1, 0.24));
  const pebbleGeo = rockGeo(77, 0, 0.3);
  const boulderMat = ice
    ? std(0x9ad4f8, { roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.9, envMap: fakeEnv(), envMapIntensity: 1.0, flatShading: true, emissive: 0x1a4a7a, emissiveIntensity: 0.3, fog: false })
    : std(0xffffff, { roughness: 0.95, flatShading: true, fog: false });
  const spikeGeo = new THREE.ConeGeometry(1, 1, 6, 1).translate(0, 0.5, 0);
  const spikeMat = std(C.spike, { flatShading: true, roughness: ice ? 0.2 : 0.9, fog: false, ...(ice ? { transparent: true, opacity: 0.92, envMap: fakeEnv(), envMapIntensity: 0.8 } : {}) });
  const shardGeo = new THREE.OctahedronGeometry(1, 0).translate(0, 1, 0);
  const crystalMats = C.crystal.map((c) => std(c, { emissive: c, emissiveIntensity: 0.7, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.92, fog: false }));
  const pebbleMat = std(0xffffff, { roughness: 0.95, flatShading: true, fog: false });

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = tileAt(x, y);
      // Tảng đá chặn đường
      if (ch === 'o') {
        const k = Math.floor(rand(x, y, 1) * 3);
        const c = C.boulder[rand(x, y, 2) > 0.5 ? 0 : 1];
        inst.add(rocks[k], boulderMat, x + 0.5, 0.36, y + 0.5, { sx: 0.48, sy: 0.42, sz: 0.44, ry: rand(x, y, 3) * 6, color: ice ? null : c });
        inst.add(rocks[(k + 1) % 3], boulderMat, x + 0.2 + rand(x, y, 4) * 0.6, 0.12, y + 0.85, { s: 0.16, ry: rand(x, y, 5) * 6, color: ice ? null : C.boulder[1] });
        continue;
      }
      if (ch === '.' && rand(x, y, 40) > 0.72) {
        // sỏi nhỏ lác đác trên nền (sát mép ô để không vướng chân)
        inst.add(pebbleGeo, pebbleMat, x + 0.1 + rand(x, y, 41) * 0.8, 0.02, y + 0.12 + rand(x, y, 42) * 0.2, { s: 0.05 + rand(x, y, 43) * 0.04, color: C.boulder[1] });
      }
    }
  }

  // Măng đá và cụm tinh thể mọc ở chân vách (ô vách giáp nền hang)
  const crystalSpots = [];
  for (let y = -1; y <= H; y++) {
    for (let x = -1; x <= W; x++) {
      if (open(x, y)) continue;
      const sides = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => open(x + dx, y + dy) && x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H);
      if (!sides.length) continue;
      const [dx, dy] = sides[Math.floor(rand(x, y, 50) * sides.length)];
      // điểm chân vách: lùi vào trong ô vách một chút tính từ mép nền
      const foot = (k, depth) => [x + 0.5 + dx * (0.5 - depth) + (dy !== 0 ? (rand(x, y, k) - 0.5) * 0.8 : 0), y + 0.5 + dy * (0.5 - depth) + (dx !== 0 ? (rand(x, y, k + 1) - 0.5) * 0.8 : 0)];
      const r = rand(x, y, 51);
      if (r < 0.1 && dy !== -1) {
        // cụm tinh thể phát sáng (không đặt ở vách phía nam nền hang: quay lưng về camera, lại chắn tầm nhìn)
        const [fx, fz] = foot(52, 0.18);
        const mat = crystalMats[Math.floor(rand(x, y, 53) * crystalMats.length)];
        const n = 3 + Math.floor(rand(x, y, 54) * 3);
        for (let i = 0; i < n; i++) {
          const s = 0.06 + rand(x, y, 60 + i) * 0.05;
          inst.add(shardGeo, mat, fx + (rand(x, y, 70 + i) - 0.5) * 0.3, 0, fz + (rand(x, y, 80 + i) - 0.5) * 0.2, {
            sx: s,
            sz: s,
            sy: (0.14 + rand(x, y, 90 + i) * 0.2) * (ice ? 1.5 : 1),
            rx: (rand(x, y, 100 + i) - 0.5) * 0.9,
            rz: (rand(x, y, 110 + i) - 0.5) * 0.9,
          });
        }
        crystalSpots.push([fx, fz, mat.color.getHex()]);
      } else if (r < 0.45 && dy !== -1) {
        // măng đá: chóp nhọn mọc từ chân vách
        const n = 1 + Math.floor(rand(x, y, 55) * 2);
        for (let i = 0; i < n; i++) {
          const [fx, fz] = foot(56 + i * 2, 0.14 + rand(x, y, 57 + i) * 0.15);
          const h = 0.35 + rand(x, y, 58 + i) * 0.6;
          inst.add(spikeGeo, spikeMat, fx, 0, fz, { sx: 0.09 + h * 0.12, sz: 0.09 + h * 0.12, sy: h, ry: rand(x, y, 59 + i) * 6 });
        }
      }
    }
  }
  // Vài măng đá / tảng đá lớn trên đỉnh khối vách cho đỡ trống trải
  for (let i = 0; i < 70; i++) {
    const px = -4 + rand(i, 1, 120) * (W + 8);
    const pz = -4 + rand(i, 1, 121) * (H + 8);
    const { h, d } = heightAt(px, pz);
    if (d < 0.8 || h < 0.6) continue;
    if (rand(i, 1, 122) > 0.5) inst.add(spikeGeo, spikeMat, px, h - 0.1, pz, { sx: 0.18, sz: 0.18, sy: 0.5 + rand(i, 1, 123) * 0.7, ry: rand(i, 1, 124) * 6 });
    else inst.add(rocks[i % 3], boulderMat, px, h, pz, { s: 0.3 + rand(i, 1, 125) * 0.3, ry: rand(i, 1, 126) * 6, color: ice ? null : C.boulder[1] });
  }
  inst.build(root);

  // ---------- Cửa hang: khe sáng, cột nắng, bụi lơ lửng ----------
  const shaftMat = glowMat(C.light, 0.28, { map: shaftTex(), side: THREE.DoubleSide });
  const poolMat = glowMat(C.light, 0.55, { map: radialTex(), fog: false });
  const exitLights = [];
  const motes = [];
  for (const e of exits) {
    const cx = e.x + 0.5 + e.dx * 0.5;
    const cz = e.y + 0.5 + e.dy * 0.5;
    // nền đường hầm (ngoài bản đồ / trong hàng vách)
    const tunnel = new THREE.Mesh(new THREE.PlaneGeometry(1, 3).rotateX(-Math.PI / 2), tunnelMat);
    tunnel.rotation.y = Math.atan2(-e.dx, -e.dy);
    tunnel.position.set(e.x + 0.5 + e.dx * 2, 0.001, e.y + 0.5 + e.dy * 2);
    tunnel.receiveShadow = true;
    root.add(tunnel);
    // vũng sáng trên nền ngay cửa
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2), poolMat);
    pool.position.set(cx, 0.012, cz);
    root.add(pool);
    // cột nắng nghiêng rọi từ ngoài cửa vào
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 4, 16, 1, true), shaftMat);
    shaft.position.set(cx + e.dx * 0.6, 2, cz + e.dy * 0.6);
    shaft.rotation.set(e.dy * 0.35, 0, -e.dx * 0.35);
    root.add(shaft);
    const l = new THREE.PointLight(C.light, 7, 7, 1.4);
    l.position.set(cx, 1.6, cz);
    root.add(l);
    exitLights.push(l);
    motes.push([cx, cz]);
  }
  root.add(dustMotes(motes, updaters, ice));

  // Ánh sáng lạnh ở vài cụm tinh thể (tổng số đèn trong hang tối đa 6, kể cả đèn bù ban đêm)
  const crystalLights = [];
  const spread = crystalSpots.filter((_, i) => i % Math.max(1, Math.floor(crystalSpots.length / 4)) === 0);
  for (const [fx, fz] of spread.slice(0, 5 - exitLights.length)) {
    const l = new THREE.PointLight(C.crystalLight, 2.5, 4.5, 1.6);
    l.position.set(fx, 0.7, fz);
    root.add(l);
    crystalLights.push(l);
  }

  // ---------- Thang giữa các tầng: L hố có thang xuống, U thang dựng lên lỗ sáng trên trần ----------
  const woodMat = std(0xa8844c, { roughness: 0.85, fog: false });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050406, fog: false });
  const railGeo = new THREE.BoxGeometry(0.06, 1, 0.06);
  const rungGeo = new THREE.BoxGeometry(0.34, 0.04, 0.05);
  const ladder = (x, z, height, lean) => {
    const g = new THREE.Group();
    for (const dx of [-0.17, 0.17]) {
      const rail = new THREE.Mesh(railGeo, woodMat);
      rail.scale.y = height;
      rail.position.set(dx, height / 2, 0);
      g.add(rail);
    }
    for (let h = 0.18; h < height; h += 0.26) {
      const rung = new THREE.Mesh(rungGeo, woodMat);
      rung.position.set(0, h, 0);
      g.add(rung);
    }
    g.rotation.x = lean;
    g.position.set(x, 0, z);
    return g;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = tileAt(x, y);
      if (ch === 'L') {
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20).rotateX(-Math.PI / 2), holeMat);
        hole.position.set(x + 0.5, 0.006, y + 0.5);
        root.add(hole);
        const top = ladder(x + 0.5, y + 0.42, 0.9, 0.12);
        top.position.y = -0.55;
        root.add(top);
      } else if (ch === 'U') {
        root.add(ladder(x + 0.5, y + 0.35, 2.6, -0.18));
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2), poolMat);
        pool.position.set(x + 0.5, 0.012, y + 0.5);
        root.add(pool);
      }
    }
  }

  // ---------- Vật phẩm ----------
  const objectNodes = new Map();
  for (const o of map.objects ?? []) {
    if (o.kind !== 'item') continue;
    const item = buildGem(o);
    root.add(item.group);
    updaters.push(item.update);
    objectNodes.set(o, { node: item.group });
  }
  root.traverse((o) => {
    if (o.material && 'fog' in o.material) o.material.fog = false;
  });

  // Càng xa người chơi càng tối: hang như được soi bằng đèn, xa dần chìm vào bóng tối
  const dark = makeDarkness({ inner: 3.5, outer: 9, floor: 0.35 });
  // Trong hang không có ngày đêm: ban đêm view3d giảm nắng, đèn này bù lại cho hang sáng như ban ngày
  const fill = new THREE.HemisphereLight(ice ? 0xe0f0ff : 0xfff0e0, ice ? 0x304060 : 0x403028, 0);
  root.add(fill);
  dark.apply(root);
  const dust = new DustPuffs(root, ice);
  let shaftBase = 0.28;

  return {
    root,
    tileAt,
    objectNodes,
    outdoor: false,
    update(time, dt = 0.016, walkers = []) {
      for (const u of updaters) u(time);
      crystalMats.forEach((m, i) => (m.emissiveIntensity = 0.6 + Math.sin(time * 1.6 + i * 2.1) * 0.25));
      crystalLights.forEach((l, i) => (l.intensity = 2.5 + Math.sin(time * 1.6 + i * 2.1) * 0.6));
      shaftMat.opacity = shaftBase * (0.9 + Math.sin(time * 0.7) * 0.1);
      dark.follow(walkers[0]);
      dust.update(dt);
    },
    // Đêm: ánh trăng xanh nhạt và yếu hơn lọt qua cửa hang
    setNight(night) {
      fill.intensity = night * 1.6;
      shaftBase = 0.28 - night * 0.16;
      for (const l of exitLights) {
        l.intensity = 7 - night * 4.5;
        l.color.setHex(C.light).lerp(new THREE.Color(0x7a90ff), night);
      }
      poolMat.opacity = 0.55 - night * 0.3;
    },
    // Bước trên nền hang có Pokémon hoang dã: bụi đất / bụi băng bay lên
    rustle(x, z) {
      dust.burst(x, z);
    },
  };
}
// Nền hang: đá loang lổ hai tông, sỏi, vết nứt; sát chân vách tối hơn; cửa hang sáng
function floorTexture(map, C, ice, open) {
  const W = map.width;
  const H = map.height;
  return canvasTex(W * P, H * P, (c) => {
    c.fillStyle = C.floor;
    c.fillRect(0, 0, W * P, H * P);
    // mảng loang tông sẫm / sáng
    for (let i = 0; i < W * H * 1.2; i++) {
      const x = rand(i, 7, 1) * W * P;
      const y = rand(i, 7, 2) * H * P;
      const r = P * (0.3 + rand(i, 7, 3) * 0.7);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const tone = rand(i, 7, 4) > 0.5 ? C.floorAlt : C.dot;
      g.addColorStop(0, tone);
      g.addColorStop(1, `${tone}00`);
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ox = x * P;
        const oy = y * P;
        // ô nước ngầm: khoét trống (mặt nước / đáy / bờ đá do caveWater dựng)
        if (map.tileAt(x, y) === 'w') {
          c.clearRect(ox, oy, P, P);
          continue;
        }
        // sỏi nhỏ
        for (let i = 0; i < 5; i++) {
          c.fillStyle = i % 2 ? C.dot : C.crack;
          const s = 2 + rand(x, y, 30 + i) * 3;
          c.fillRect(ox + rand(x, y, 20 + i) * P, oy + rand(x, y, 25 + i) * P, s, s * 0.7);
        }
        // vết nứt / vệt băng
        if (rand(x, y, 40) > 0.6) {
          c.strokeStyle = ice ? 'rgba(255,255,255,0.7)' : C.crack;
          c.lineWidth = ice ? 1.5 : 1.2;
          c.beginPath();
          let px = ox + rand(x, y, 41) * P;
          let py = oy + rand(x, y, 42) * P;
          c.moveTo(px, py);
          for (let k = 0; k < 3; k++) {
            px += (rand(x, y, 43 + k) - 0.5) * P * 0.6;
            py += (rand(x, y, 46 + k) - 0.5) * P * 0.6;
            c.lineTo(px, py);
          }
          c.stroke();
        }
        if (!open(x, y)) continue;
        // bóng tối sát chân vách (giả lập ánh sáng bị che)
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          if (open(x + dx, y + dy)) continue;
          const g = c.createLinearGradient(ox + (dx > 0 ? P : 0), oy + (dy > 0 ? P : 0), ox + (dx > 0 ? P * 0.6 : dx < 0 ? P * 0.4 : 0), oy + (dy > 0 ? P * 0.6 : dy < 0 ? P * 0.4 : 0));
          g.addColorStop(0, `${C.edge}cc`);
          g.addColorStop(1, `${C.edge}00`);
          c.fillStyle = g;
          if (dx) c.fillRect(ox + (dx > 0 ? P * 0.6 : 0), oy, P * 0.4, P);
          else c.fillRect(ox, oy + (dy > 0 ? P * 0.6 : 0), P, P * 0.4);
        }
      }
    }
  });
}

// Nước ngầm: đáy tối phẳng, bờ đá dựng đứng quanh mọi cạnh giáp ô không phải nước (từ đáy lên tới nền hang),
// mặt nước gợn nhẹ (dùng chung waterSurface với hồ ngoài trời) không sương mù / ngày đêm như mọi thứ trong hang
function caveWater(cells, tileAt, W, H, C, ice, updaters) {
  const group = new THREE.Group();
  const isWater = (x, y) => x >= 0 && y >= 0 && x < W && y < H && tileAt(x, y) === 'w';
  const bed = [];
  const bank = [];
  const quad = (out, a, b, c, d) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (const [x, y] of cells) {
    quad(bed, [x, WATER_BED, y], [x, WATER_BED, y + 1], [x + 1, WATER_BED, y + 1], [x + 1, WATER_BED, y]);
    // cạnh: [ô bên cạnh, hai đầu cạnh]
    for (const [dx, dy, x0, z0, x1, z1] of [[0, -1, x, y, x + 1, y], [0, 1, x, y + 1, x + 1, y + 1], [-1, 0, x, y, x, y + 1], [1, 0, x + 1, y, x + 1, y + 1]]) {
      if (isWater(x + dx, y + dy)) continue;
      quad(bank, [x0, WATER_BED, z0], [x0, 0, z0], [x1, 0, z1], [x1, WATER_BED, z1]);
    }
  }
  const mesh = (pos, mat) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  };
  group.add(mesh(bed, std(ice ? 0x1e3c66 : 0x0e1e24, { roughness: 1, side: THREE.DoubleSide, fog: false })));
  group.add(mesh(bank, std(ice ? 0xc8dcf0 : C.face, { roughness: ice ? 0.3 : 0.95, flatShading: true, side: THREE.DoubleSide, fog: false })));
  const surface = waterSurface(cells, ice
    ? { level: WATER_LEVEL, day: 0x4a86c0, night: 0x4a86c0, opacity: 0.82, waves: 0.35, shininess: 140 }
    : { level: WATER_LEVEL, day: 0x1f5866, night: 0x1f5866, opacity: 0.86, waves: 0.3, shininess: 90 });
  surface.mesh.material.fog = false;
  group.add(surface.mesh);
  if (surface.update) updaters.push(surface.update);
  return group;
}

function shaftTex() {
  const tex = canvasTex(64, 128, (c) => {
    for (let y = 0; y < 128; y++) {
      const a = Math.min(1, (y / 128) * 1.2) * (1 - (y / 128) ** 6);
      c.fillStyle = `rgba(255,255,255,${a * 0.8})`;
      c.fillRect(0, y, 64, 1);
    }
    for (let i = 0; i < 6; i++) {
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(rand(i, 2, 1) * 64, 0, 3 + rand(i, 2, 2) * 6, 128);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function radialTex() {
  return canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

// Bụi lơ lửng trong cột nắng ở cửa hang
function dustMotes(spots, updaters, ice) {
  const n = spots.length * 24;
  const pos = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: ice ? 0xeaf6ff : 0xfff0d0, size: 0.04, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pts.frustumCulled = false;
  updaters.push((time) => {
    for (let i = 0; i < n; i++) {
      const [cx, cz] = spots[Math.floor(i / 24)];
      const k = (time * (0.04 + rand(i, 5, 1) * 0.05) + rand(i, 5, 2)) % 1;
      pos.set([cx + (rand(i, 5, 3) - 0.5) * 1.4 + Math.sin(time * 0.5 + i) * 0.1, 2.4 - k * 2.3, cz + (rand(i, 5, 4) - 0.5) * 1.4], i * 3);
    }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}

// Bụi tung lên dưới chân khi bước trên nền hang
class DustPuffs {
  constructor(root, ice) {
    this.n = 48;
    this.pos = new Float32Array(this.n * 3).fill(-99);
    this.vel = new Float32Array(this.n * 3);
    this.life = new Float32Array(this.n);
    this.next = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color: ice ? 0xf4faff : 0xa89480, size: 0.07, transparent: true, opacity: 0.7, depthWrite: false, fog: false });
    const pts = new THREE.Points(this.geo, this.mat);
    pts.frustumCulled = false;
    root.add(pts);
  }

  burst(x, z) {
    for (let k = 0; k < 10; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      const a = Math.random() * Math.PI * 2;
      this.pos.set([x + Math.cos(a) * 0.15, 0.05, z + Math.sin(a) * 0.15], i * 3);
      this.vel.set([Math.cos(a) * 0.5, 0.5 + Math.random() * 0.5, Math.sin(a) * 0.5], i * 3);
      this.life[i] = 0.6;
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
      this.vel[i * 3 + 1] -= dt * 1.2;
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -99;
    }
    if (any) this.geo.attributes.position.needsUpdate = true;
  }
}
