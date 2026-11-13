import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeCanvas } from './canvas.js';
import { vnoise } from './nature.js';
import { PADDY_BED, POND_LEVEL, WATER_BED, WATER_LEVEL, glowTexture, instanced, lambert, pixelTexture, rand } from './outdoorKit.js';

// Đồ vật / địa hình đặc biệt ngoài trời, mỗi loại ô một hàm dựng (đối chiếu bản 2D: gfx/world.js):
//  R vách đá • C cửa hang • p ruộng lúa (bờ ruộng) • l cột đèn lồng • b cầu gỗ • K lò gốm • j chum gốm • L ao sen
// Mỗi hàm trả về { nodes: Object3D[], update?(t), setNight?(n), lights?: PointLight[] }.
// Vật lặp lại nhiều dùng InstancedMesh để cả bản đồ chỉ tốn vài lần vẽ.

const cells = (map, tileAt, ch) => {
  const out = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (tileAt(x, y) === ch) out.push([x, y]);
  return out;
};

// ---------- Đá: khối hộp chia ô, đỉnh xô lệch, vuốt thon lên trên; tô màu theo mặt (đỉnh sáng, vách sẫm có vân lớp) ----------

const ROCK = { top: [0.66, 0.56, 0.44], top2: [0.76, 0.66, 0.52], face: [0.56, 0.42, 0.32], dark: [0.34, 0.25, 0.2] };
const SNOWY = [0.9, 0.93, 0.97];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Tô màu từng tam giác (hình phẳng, không chỉ số): mặt hướng lên là đỉnh đá (tuyết), mặt đứng là vách
function paintRock(geo, seed, snow) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const ny = (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3;
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const r = rand(i, seed, 7);
    let c;
    if (ny > 0.55) c = snow ? lerp3(SNOWY, [1, 1, 1], r * 0.5) : lerp3(ROCK.top, ROCK.top2, r);
    else {
      c = lerp3(ROCK.dark, ROCK.face, Math.min(1, Math.max(0, y * 1.3 + 0.1)));
      // vân lớp đá nằm ngang
      if (Math.floor(y * 7 + seed) % 3 === 0) c = lerp3(c, ROCK.dark, 0.25);
      c = lerp3(c, ROCK.top, r * 0.18);
      if (snow && ny > 0.25) c = lerp3(c, SNOWY, 0.6);
    }
    for (let k = 0; k < 3; k++) col.set(c, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Khối đá cao 1, đáy 1x1 (gốc ở đáy), dùng làm một ô vách
function rockBlockGeometry(seed, snow) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 2, 3, 2).translate(0, 0.5, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // băm theo toạ độ gốc: đỉnh chung của các mặt dịch cùng nhau nên khối kín
    const h = (s) => rand(Math.round(x * 6) + seed * 13, Math.round(z * 6) + Math.round(y * 6) * 17, s);
    const taper = 1 - 0.16 * y * y;
    p.setXYZ(i, x * taper + (h(1) - 0.5) * 0.2, y <= 0 ? -0.04 : y + (h(3) - 0.5) * 0.2 * y, z * taper + (h(2) - 0.5) * 0.2);
  }
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return paintRock(flat, seed, snow);
}

// Tảng đá tròn nhỏ (đỉnh vách, chân vách, bờ ao)
function boulderGeometry(seed, snow) {
  const geo = new THREE.DodecahedronGeometry(0.5, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = (s) => rand(Math.round(x * 20) + seed, Math.round(z * 20) + Math.round(y * 20) * 7, s) - 0.5;
    p.setXYZ(i, x * (1 + h(1) * 0.3), y * (1 + h(2) * 0.3), z * (1 + h(3) * 0.3));
  }
  // Dodecahedron của three đã không chỉ số; gộp đỉnh trùng bằng cách băm ở trên nên vẫn kín
  geo.computeVertexNormals();
  return paintRock(geo, seed, snow);
}

const rockMats = new Map();
function rockMaterial() {
  if (!rockMats.has('rock')) rockMats.set('rock', new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  return rockMats.get('rock');
}

// Chiều cao từng ô vách: nhấp nhô theo nhiễu nên cả khối núi liền mạch.
// Vách đứng ngay phía nam chỗ người đi được thì hạ thấp, để camera (nhìn từ phía nam) không bị che mất nhân vật.
export function rockHeights(map, tileAt) {
  const low = (x, y) => !'TRn'.includes(tileAt(x, y)) && !map.buildingAt?.(x, y);
  const cache = new Map();
  return (x, y) => {
    const key = `${x},${y}`;
    if (cache.has(key)) return cache.get(key);
    let h = 1.1 + vnoise(x * 0.45 + 3.3, y * 0.45 + 1.7) * 0.42 + rand(x, y, 31) * 0.08;
    if (low(x, y - 1)) h = Math.min(h, 0.55 + rand(x, y, 32) * 0.1);
    else if (low(x, y - 2)) h = Math.min(h, 0.95 + rand(x, y, 33) * 0.1);
    cache.set(key, h);
    return h;
  };
}

// Cửa hang mở về phía nào: phía có ô đi được (ưu tiên nam vì camera nhìn từ nam)
function caveFacing(tileAt, x, y) {
  const open = (ch) => !'TRnwLps'.includes(ch);
  if (open(tileAt(x, y + 1))) return 'south';
  if (open(tileAt(x, y - 1))) return 'north';
  if (open(tileAt(x + 1, y))) return 'east';
  return 'west';
}

export function buildRocks(map, tileAt, margin) {
  const snow = Boolean(map.snow);
  const heightAt = rockHeights(map, tileAt);
  const VARIANTS = 4;
  const blockGeos = Array.from({ length: VARIANTS }, (_, i) => rockBlockGeometry(i + 1, snow));
  const boulderGeos = [boulderGeometry(11, snow), boulderGeometry(23, snow)];
  const blocks = blockGeos.map(() => []);
  const boulders = boulderGeos.map(() => []);
  const tint = (x, y, s) => new THREE.Color().setHSL(0.07 + (rand(x, y, s) - 0.5) * 0.04, 0.22, 0.8 + rand(x, y, s + 1) * 0.2);
  const grassy = (ch) => '.gGf'.includes(ch);
  const nodes = [];
  const darkness = [];

  for (let y = -margin; y < map.height + margin; y++) {
    for (let x = -margin; x < map.width + margin; x++) {
      const ch = tileAt(x, y);
      if (ch === 'R') {
        const h = heightAt(x, y);
        const v = Math.floor(rand(x, y, 40) * VARIANTS);
        blocks[v].push({ x: x + 0.5, z: y + 0.5, ry: Math.floor(rand(x, y, 41) * 4) * (Math.PI / 2), sx: 1.14, sy: h, sz: 1.14, color: tint(x, y, 42) });
        // tảng đá nhỏ trên đỉnh cho bóng núi bớt phẳng
        if (rand(x, y, 43) < 0.32 && h > 0.8) {
          const s = 0.32 + rand(x, y, 44) * 0.2;
          boulders[Math.floor(rand(x, y, 45) * 2)].push({ x: x + 0.3 + rand(x, y, 46) * 0.4, y: h - 0.04, z: y + 0.3 + rand(x, y, 47) * 0.4, ry: rand(x, y, 48) * 6.28, sx: s, sy: s * 0.65, sz: s * 1.1, color: tint(x, y, 49) });
        }
        // đá vụn lăn xuống chân vách
        for (const [dx, dy, n] of [[0, 1, 2], [1, 0, 1], [-1, 0, 1]]) {
          if (!grassy(tileAt(x + dx, y + dy))) continue;
          for (let k = 0; k < n; k++) {
            if (rand(x, y, 50 + k + dx * 3) < 0.35) continue;
            const s = 0.09 + rand(x, y, 52 + k + dx) * 0.1;
            const along = 0.15 + rand(x, y, 54 + k + dx) * 0.7;
            const out = 0.62 + rand(x, y, 56 + k) * 0.15;
            boulders[k % 2].push({ x: x + 0.5 + (dx ? dx * out : along - 0.5), y: s * 0.2, z: y + 0.5 + (dy ? dy * out : along - 0.5), ry: rand(x, y, 58 + k) * 6.28, sx: s, sy: s * 0.7, sz: s, color: tint(x, y, 60 + k) });
          }
        }
      } else if (ch === 'C') {
        const facing = caveFacing(tileAt, x, y);
        const cx = x + 0.5;
        const cz = y + 0.5;
        const v = Math.floor(rand(x, y, 40) * VARIANTS);
        if (facing === 'north') {
          // Cửa hang mở lên phía bắc (đi xuống mới vào): miệng hố có bậc đá dẫn xuống bóng tối, hai bên gờ đá thấp
          for (const side of [-1, 1]) blocks[v].push({ x: cx + side * 0.4, z: cz, sx: 0.3, sy: 0.38, sz: 1.08, color: tint(x, y, 70 + side) });
          blocks[(v + 1) % VARIANTS].push({ x: cx, z: cz + 0.42, sx: 1.1, sy: 0.3, sz: 0.24, color: tint(x, y, 73) });
          darkness.push(caveStairs(cx, cz));
        } else {
          // Vòm cửa hang: hai trụ đá + một khối đá vắt ngang, lòng hang tối sâu hun hút
          const H = Math.max(1.25, heightAt(x, y));
          const ry = facing === 'south' ? 0 : facing === 'east' ? Math.PI / 2 : -Math.PI / 2;
          const local = (lx, lz) => [cx + lx * Math.cos(ry) + lz * Math.sin(ry), cz - lx * Math.sin(ry) + lz * Math.cos(ry)];
          for (const side of [-1, 1]) {
            const [px, pz] = local(side * 0.4, 0);
            blocks[(v + (side > 0 ? 1 : 0)) % VARIANTS].push({ x: px, z: pz, ry, sx: 0.36, sy: H - 0.05, sz: 1.14, color: tint(x, y, 70 + side) });
          }
          blocks[(v + 2) % VARIANTS].push({ x: cx, y: 0.92, z: cz, ry, sx: 1.16, sy: H - 0.92, sz: 1.14, color: tint(x, y, 73) });
          // hai tảng đá bo tròn góc trên miệng hang
          for (const side of [-1, 1]) {
            const [px, pz] = local(side * 0.24, 0.5);
            boulders[0].push({ x: px, y: 0.86, z: pz, ry: rand(x, y, 74 + side), s: 0.24, color: tint(x, y, 76 + side) });
          }
          darkness.push(caveTunnel(cx, cz, ry));
        }
      }
    }
  }
  const mat = rockMaterial();
  blocks.forEach((items, i) => {
    const m = instanced(blockGeos[i], mat, items);
    if (m) nodes.push(m);
  });
  boulders.forEach((items, i) => {
    const m = instanced(boulderGeos[i], mat, items);
    if (m) nodes.push(m);
  });
  nodes.push(...darkness);
  return { nodes };
}

// Lòng hang: hộp chỉ vẽ mặt trong (thấy vách sau, hai bên, nền), càng sâu càng tối
function caveTunnel(cx, cz, ry) {
  const geo = new THREE.BoxGeometry(0.58, 0.96, 1.1, 1, 1, 2);
  const p = geo.attributes.position;
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const t = (p.getZ(i) + 0.55) / 1.1; // 0 sâu trong .. 1 ở miệng hang
    const v = 0.01 + t * t * t * 0.09;
    col.push(v * 1.1, v * 0.95, v);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  mesh.position.set(cx, 0.49, cz); // đáy hộp nhỉnh hơn mặt đất để nền hang tối không bị đất che
  mesh.rotation.y = ry;
  return mesh;
}

// Bậc đá dẫn xuống hang (cửa hang mở về phía bắc): các bậc tối dần về phía nam
function caveStairs(cx, cz) {
  const { canvas, ctx } = makeCanvas(16, 32);
  for (let i = 0; i < 8; i++) {
    const v = Math.max(0, 120 - i * 17);
    ctx.fillStyle = `rgb(${v},${v * 0.9},${v * 0.8})`;
    ctx.fillRect(0, i * 4, 16, 4);
    ctx.fillStyle = `rgb(${v * 0.5},${v * 0.45},${v * 0.4})`;
    ctx.fillRect(0, i * 4 + 3, 16, 1);
  }
  const g = ctx.createLinearGradient(0, 0, 16, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.25, 'rgba(0,0,0,0)');
  g.addColorStop(0.75, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 32);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: pixelTexture(canvas) }));
  mesh.position.set(cx, 0.012, cz);
  return mesh;
}

// ---------- Ruộng lúa: bờ đất đắp quanh mép ruộng (nước + lúa: world3d / nature.js) ----------

export function buildPaddyBunds(map, tileAt) {
  const items = [];
  const field = (x, y) => tileAt(x, y) === 'p';
  for (const [x, y] of cells(map, tileAt, 'p')) {
    const edges = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of edges) {
      if (field(x + dx, y + dy)) continue;
      const color = new THREE.Color().setHSL(0.09 + rand(x, y, dx + dy * 3) * 0.03, 0.38, 0.24 + rand(x, y, 5 + dx) * 0.05);
      const horizontal = dy !== 0;
      items.push({
        x: x + 0.5 + dx * 0.43, y: PADDY_BED, z: y + 0.5 + dy * 0.43,
        sx: horizontal ? 1.14 : 0.16, sy: 0.15 - PADDY_BED, sz: horizontal ? 0.16 : 1.14, color,
      });
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  // vai bờ tròn: thu nhỏ mặt trên
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setXYZ(i, p.getX(i) * 0.7, p.getY(i), p.getZ(i) * 0.7);
  geo.computeVertexNormals();
  const mesh = instanced(geo, lambert(0xffffff), items, { cast: false });
  return { nodes: mesh ? [mesh] : [] };
}

// ---------- Mặt nước chung: lưới phủ đúng các ô nước, gợn sóng (tuỳ chọn), phản chiếu bầu trời ----------

// cellsList: [[x, y]]; opts: { level, day, night, opacity, waves (0 = phẳng lặng), shininess, env, reflect }
export function waterSurface(cellsList, opts) {
  if (!cellsList.length) return null;
  const SUB = 4;
  const index = new Map();
  const pos = [];
  const idx = [];
  const vert = (gx, gz) => {
    const key = `${gx},${gz}`;
    if (!index.has(key)) {
      index.set(key, pos.length / 3);
      pos.push(gx / SUB, 0, gz / SUB);
    }
    return index.get(key);
  };
  for (const [x, y] of cellsList) {
    for (let j = 0; j < SUB; j++) {
      for (let i = 0; i < SUB; i++) {
        const gx = x * SUB + i;
        const gz = y * SUB + j;
        const a = vert(gx, gz);
        const b = vert(gx + 1, gz);
        const c = vert(gx, gz + 1);
        const d = vert(gx + 1, gz + 1);
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhongMaterial({
    color: opts.day, specular: 0xffffff, shininess: opts.shininess ?? 120, transparent: true, opacity: opts.opacity, flatShading: true,
  });
  if (opts.env) {
    mat.envMap = opts.env;
    mat.combine = THREE.MixOperation;
    mat.reflectivity = opts.reflect ?? 0.3;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = opts.level;
  mesh.receiveShadow = true;
  const day = new THREE.Color(opts.day);
  const night = new THREE.Color(opts.night);
  const waves = opts.waves ?? 0;
  return {
    mesh,
    setNight(n) {
      mat.color.copy(day).lerp(night, n);
      mat.specular.setScalar(1 - n * 0.6);
      if (opts.env) mat.reflectivity = (opts.reflect ?? 0.3) * (1 - n * 0.85);
    },
    update: waves
      ? (t) => {
        const p = geo.attributes.position.array;
        for (let i = 0; i < p.length; i += 3) {
          const x = p[i];
          const z = p[i + 2];
          p[i + 1] = (Math.sin(x * 2.1 + t * 1.6) * 0.025 + Math.cos(z * 2.7 - t * 1.3) * 0.025) * waves;
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
      }
      : null,
  };
}

// ---------- Cột đèn lồng: cột gỗ, mái chóp nhỏ, đèn lồng giấy đỏ treo phía trước có tua vàng ----------

function lanternGeometry() {
  const pts = [[0.03, -0.17], [0.1, -0.15], [0.15, -0.08], [0.165, 0], [0.15, 0.08], [0.1, 0.15], [0.03, 0.17]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 10);
}

// maxLights: số đèn lồng có đèn thật (PointLight); các đèn còn lại chỉ tự sáng + quầng sáng
export function buildLanterns(map, tileAt, maxLights) {
  const spots = cells(map, tileAt, 'l').map(([x, y]) => ({ x: x + 0.5, z: y + 0.5, ry: (rand(x, y, 1) - 0.5) * 0.3 }));
  if (!spots.length) return null;
  const nodes = [];
  const wood = lambert(0x4a2e18);
  const dark = lambert(0x2a1a10);
  const stone = lambert(0x9a948a);
  const lanternMat = new THREE.MeshLambertMaterial({ color: 0xd83030, emissive: 0x000000 });
  const goldMat = lambert(0xf0c030);
  // lồng đèn treo cách cột về phía nam
  const hang = (s, dy, dz = 0.27) => ({ x: s.x + Math.sin(s.ry) * dz, y: dy, z: s.z + Math.cos(s.ry) * dz, ry: s.ry });
  const add = (geo, mat, items, cast = true) => {
    const m = instanced(geo, mat, items, { cast });
    if (m) nodes.push(m);
  };
  add(new THREE.BoxGeometry(0.24, 0.12, 0.24).translate(0, 0.06, 0), stone, spots.map((s) => ({ ...s })));
  add(new THREE.BoxGeometry(0.09, 1.55, 0.09).translate(0, 0.775, 0), wood, spots.map((s) => ({ ...s })));
  add(new THREE.ConeGeometry(0.17, 0.14, 4).rotateY(Math.PI / 4).translate(0, 1.62, 0), dark, spots.map((s) => ({ ...s })));
  add(new THREE.BoxGeometry(0.05, 0.05, 0.36).translate(0, 1.47, 0.14), wood, spots.map((s) => ({ ...s })));
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.1).translate(0, 1.4, 0), dark, spots.map((s) => hang(s, 0, 0.27)), false);
  add(lanternGeometry(), lanternMat, spots.map((s) => hang(s, 1.18)));
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.035, 8), dark, spots.flatMap((s) => [hang(s, 1.35), hang(s, 1.01)]));
  add(new THREE.ConeGeometry(0.03, 0.12, 5).rotateX(Math.PI), goldMat, spots.map((s) => hang(s, 0.93)), false);

  // Ban đêm: quầng sáng quanh đèn + vệt sáng tròn trên mặt đất
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9a50, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const s of spots) {
    const halo = new THREE.Sprite(haloMat);
    const p = hang(s, 1.18);
    halo.position.set(p.x, p.y, p.z);
    halo.scale.setScalar(0.95);
    nodes.push(halo);
  }
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff8a40, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = instanced(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), poolMat, spots.map((s) => ({ x: s.x, y: 0.025, z: s.z + 0.2 })), { cast: false, receive: false });
  pool.renderOrder = 1;
  nodes.push(pool);

  // Chọn vài đèn có đèn thật, rải đều nhất có thể (chọn lần lượt đèn xa các đèn đã chọn nhất)
  const lights = [];
  const chosen = [];
  while (chosen.length < Math.min(maxLights, spots.length)) {
    let best = null;
    let bestD = -Infinity;
    for (const s of spots) {
      if (chosen.includes(s)) continue;
      const dist = chosen.length ? Math.min(...chosen.map((c) => Math.hypot(c.x - s.x, c.z - s.z))) : -s.z;
      if (dist > bestD) {
        bestD = dist;
        best = s;
      }
    }
    chosen.push(best);
  }
  for (const s of chosen) {
    const light = new THREE.PointLight(0xff9a50, 0, 4.2, 1.6);
    const p = hang(s, 1.1);
    light.position.set(p.x, p.y, p.z + 0.1);
    lights.push(light);
    nodes.push(light);
  }
  let night = 0;
  return {
    nodes,
    lights,
    setNight(n) {
      night = n;
      lanternMat.emissive.setHex(0xff5a20).multiplyScalar(n * 1.1);
      haloMat.opacity = n * 0.85;
      poolMat.opacity = n * 0.45;
    },
    update(t) {
      // ngọn nến trong đèn lồng chập chờn
      const f = 1 + Math.sin(t * 9.3) * 0.05 + Math.sin(t * 13.7) * 0.04;
      for (const l of lights) l.intensity = night * 4 * f;
    },
  };
}

// ---------- Cầu gỗ: ván ngang trên hai dầm dọc, cọc chân cầu cắm xuống lòng hồ, lan can hai bên ----------

export function buildBridges(map, tileAt) {
  const list = cells(map, tileAt, 'b');
  if (!list.length) return null;
  const isB = (x, y) => tileAt(x, y) === 'b';
  const wet = (ch) => ch === 'w' || ch === 'b';
  const planks = [];
  const beams = [];
  const posts = [];
  const rails = [];
  for (const [tx, ty] of list) {
    // cầu chạy theo hướng mà hai đầu dẫn lên bờ (hoặc sang ô cầu kế tiếp)
    const ns = !wet(tileAt(tx, ty - 1)) || !wet(tileAt(tx, ty + 1)) || (isB(tx, ty - 1) && isB(tx, ty + 1));
    // toạ độ cục bộ: a dọc cầu, c ngang cầu (0..1 trong ô)
    const at = (a, c) => (ns ? [tx + c, ty + a] : [tx + a, ty + c]);
    const box = (a, c, y, la, lc, ly, color, list2, ry = 0) => {
      const [x, z] = at(a, c);
      list2.push({ x, y, z, sx: ns ? lc : la, sy: ly, sz: ns ? la : lc, color, ry });
    };
    const sideOpen = (s) => (ns ? !isB(tx + s, ty) : !isB(tx, ty + s));
    const prevOpen = ns ? !isB(tx, ty - 1) : !isB(tx - 1, ty);
    const nextOpen = ns ? !isB(tx, ty + 1) : !isB(tx + 1, ty);
    const c0 = sideOpen(-1) ? 0.04 : 0;
    const c1 = sideOpen(1) ? 0.96 : 1;
    for (let i = 0; i < 5; i++) {
      const tone = new THREE.Color().setHSL(0.075 + rand(tx, ty, i) * 0.02, 0.45, 0.36 + rand(tx, ty, i + 9) * 0.1);
      // ván hơi lệch, chiều dài khác nhau chút ít
      const jitter = (rand(tx, ty, i + 20) - 0.5) * 0.04;
      box(0.1 + i * 0.2, (c0 + c1) / 2 + jitter, -0.03, 0.18, c1 - c0 - Math.abs(jitter), 0.06, tone, planks, (rand(tx, ty, i + 30) - 0.5) * 0.04);
    }
    // hai đầu cầu chồm lên bờ một chút
    for (const [open, a] of [[prevOpen, -0.08], [nextOpen, 1.08]]) {
      if (open) box(a, (c0 + c1) / 2, -0.035, 0.16, c1 - c0, 0.06, new THREE.Color(0x7a5232), planks);
    }
    for (const c of [0.2, 0.8]) box(0.5, c, -0.1, 1.0, 0.1, 0.08, new THREE.Color(0x5a3a22), beams);
    // cọc chân cầu giữa ô
    box(0.5, 0.5, WATER_BED - 0.05, 0.1, 0.1, -WATER_BED - 0.05, new THREE.Color(0x4a3020), posts);
    // lan can phía ngoài
    for (const s of [-1, 1]) {
      if (!sideOpen(s)) continue;
      const c = s < 0 ? 0.05 : 0.95;
      for (const a of nextOpen ? [0.04, 0.96] : [0.04]) box(a, c, WATER_BED, 0.08, 0.08, 0.55 - WATER_BED, new THREE.Color(0x5a3a22), posts);
      box(0.5, c, 0.5, 1.0, 0.06, 0.06, new THREE.Color(0x8a5a32), rails);
      box(0.5, c, 0.27, 1.0, 0.04, 0.04, new THREE.Color(0x7a4e2c), rails);
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = lambert(0xffffff);
  const nodes = [planks, beams, posts, rails].map((items) => instanced(geo, mat, items)).filter(Boolean);
  return { nodes };
}

// ---------- Lò gốm: lò gạch vòm, miệng lò đỏ lửa bập bùng, ống khói nhả khói ----------

function brickTexture() {
  const { canvas, ctx } = makeCanvas(16, 16);
  ctx.fillStyle = '#a84a2a';
  ctx.fillRect(0, 0, 16, 16);
  for (let r = 0; r < 4; r++) {
    ctx.fillStyle = '#7a3018';
    ctx.fillRect(0, r * 4 + 3, 16, 1);
    for (let x = (r % 2) * 4; x < 16; x += 8) ctx.fillRect(x, r * 4, 1, 3);
    ctx.fillStyle = '#c0603a';
    ctx.fillRect(((r * 5) % 12) + 1, r * 4, 3, 1);
  }
  const tex = pixelTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1.5);
  return tex;
}

export function buildKilns(map, tileAt) {
  const spots = cells(map, tileAt, 'K').map(([x, y]) => ({ x: x + 0.5, z: y + 0.5 }));
  if (!spots.length) return null;
  const nodes = [];
  const brick = new THREE.MeshLambertMaterial({ map: brickTexture(), flatShading: true });
  const add = (geo, mat, items = spots, cast = true) => {
    const m = instanced(geo, mat, items.map((s) => ({ ...s })), { cast });
    if (m) nodes.push(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.3, 12).translate(0, 0.15, 0), brick);
  add(new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1).translate(0, 0.3, 0), brick);
  add(new THREE.CylinderGeometry(0.06, 0.075, 0.32, 6).translate(0.17, 0.62, -0.14), lambert(0x6a2a14));
  // miệng lò hình vòm: viền gạch sẫm, bên trong lửa đỏ cam (không bị ánh sáng làm tối)
  const arch = (w, h) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h - w / 2);
    s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
    s.lineTo(-w / 2, 0);
    return new THREE.ShapeGeometry(s, 6);
  };
  add(arch(0.3, 0.32).translate(0, 0.02, 0.462), lambert(0x3a1408), spots, false);
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a });
  add(arch(0.22, 0.24).translate(0, 0.03, 0.468), fireMat, spots, false);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd860 });
  add(arch(0.12, 0.12).translate(0, 0.03, 0.472), coreMat, spots, false);
  // vệt lửa hắt ra nền đất trước miệng lò
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xff7a30, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = add(new THREE.PlaneGeometry(1.1, 0.9).rotateX(-Math.PI / 2), glowMat, spots.map((s) => ({ x: s.x, y: 0.02, z: s.z + 0.62 })), false);
  glow.receiveShadow = false;
  glow.renderOrder = 1;
  // Khói: vài cụm khói bay lên từ mỗi ống khói, mờ dần rồi quay lại từ đầu
  const puffs = [];
  for (const s of spots) {
    for (let k = 0; k < 3; k++) {
      const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xd8d0c8, transparent: true, opacity: 0, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      nodes.push(sp);
      puffs.push({ sp, s, phase: k / 3 + rand(s.x, s.z, k) * 0.2 });
    }
  }
  // Một đèn thật cho cả xưởng gốm (đặt giữa các lò)
  const light = new THREE.PointLight(0xff7a30, 0, 6, 1.6);
  light.position.set(spots.reduce((a, s) => a + s.x, 0) / spots.length, 0.7, spots.reduce((a, s) => a + s.z, 0) / spots.length + 0.6);
  nodes.push(light);
  let night = 0;
  return {
    nodes,
    lights: [light],
    setNight(n) {
      night = n;
    },
    update(t) {
      const f = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 17.3 + 1) * 0.07;
      fireMat.color.setRGB(1, 0.5 * f, 0.15 * f);
      glowMat.opacity = (0.22 + night * 0.45) * f;
      light.intensity = (0.6 + night * 3.4) * f;
      for (const p of puffs) {
        const u = (t * 0.22 + p.phase) % 1;
        p.sp.position.set(p.s.x + 0.17 + Math.sin(u * 4 + p.phase * 9) * 0.08 + u * 0.25, 0.85 + u * 1.3, p.s.z - 0.14 - u * 0.1);
        p.sp.scale.setScalar(0.18 + u * 0.5);
        p.sp.material.opacity = Math.sin(u * Math.PI) * 0.45 * (1 - night * 0.5);
      }
    },
  };
}

// ---------- Chum gốm: thân phình, miệng loe, men nâu bóng; mỗi ô một chum lớn + một chum nhỏ ----------

// ---------- Hàng rào gỗ: cọc ở giữa ô, hai thanh ngang nối sang ô hàng rào kề bên ----------

export function buildFences(map, tileAt) {
  const list = cells(map, tileAt, 'H');
  if (!list.length) return null;
  const isFence = (x, y) => tileAt(x, y) === 'H';
  const wood = lambert(0xffffff);
  const posts = [];
  const rails = [];
  for (const [x, y] of list) {
    posts.push({ x: x + 0.5, y: 0.25, z: y + 0.5, sx: 0.11, sy: 0.5, sz: 0.11, color: 0x9a6834 });
    const single = !isFence(x - 1, y) && !isFence(x + 1, y) && !isFence(x, y - 1) && !isFence(x, y + 1);
    for (const h of [0.2, 0.36]) {
      if (isFence(x + 1, y)) rails.push({ x: x + 1, y: h, z: y + 0.5, sx: 1, sy: 0.06, sz: 0.05, color: 0xb88048 });
      if (isFence(x, y + 1)) rails.push({ x: x + 0.5, y: h, z: y + 1, sx: 0.05, sy: 0.06, sz: 1, color: 0xb88048 });
      if (single) rails.push({ x: x + 0.5, y: h, z: y + 0.5, sx: 0.5, sy: 0.06, sz: 0.05, color: 0xb88048 });
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  return { nodes: [instanced(box, wood, posts), instanced(box, wood, rails)].filter(Boolean) };
}

export function buildJars(map, tileAt) {
  const list = cells(map, tileAt, 'j');
  if (!list.length) return null;
  const pts = [[0, 0], [0.1, 0], [0.17, 0.04], [0.21, 0.13], [0.22, 0.22], [0.19, 0.31], [0.12, 0.37], [0.09, 0.4], [0.11, 0.43], [0.1, 0.445], [0.07, 0.42]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 10);
  // hai mặt: nhìn qua miệng chum thấy lòng chum chứ không xuyên xuống đất
  const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, shininess: 50, specular: 0x554433, side: THREE.DoubleSide });
  const GLAZE = [0x8a5a30, 0x6a4020, 0x7a6a3a, 0x4e5a68, 0x9a6438];
  const items = [];
  const lids = [];
  for (const [x, y] of list) {
    const big = 1.0 + rand(x, y, 1) * 0.25;
    const small = 0.55 + rand(x, y, 2) * 0.2;
    const flip = rand(x, y, 3) < 0.5 ? 1 : -1;
    const jar = (px, pz, s, k) => {
      items.push({ x: px, z: pz, s, ry: rand(x, y, k) * 6.28, color: GLAZE[Math.floor(rand(x, y, k + 1) * GLAZE.length)] });
      if (rand(x, y, k + 2) < 0.4) lids.push({ x: px, y: 0.44 * s, z: pz, s, color: 0x5a3a20 });
    };
    jar(x + 0.5 - flip * 0.13, y + 0.42, big, 10);
    jar(x + 0.5 + flip * 0.26, y + 0.72, small, 20);
  }
  const nodes = [instanced(geo, mat, items)];
  const lidMesh = instanced(new THREE.CylinderGeometry(0.12, 0.13, 0.04, 10), lambert(0xffffff), lids);
  if (lidMesh) nodes.push(lidMesh);
  return { nodes };
}

// ---------- Ao sen: bờ đá quanh ao, lá sen nổi và vươn cao, hoa sen hồng nhiều cánh ----------

function lotusFlowerGeometry() {
  const parts = [];
  const petal = (count, tilt, len, color, yaw0) => {
    for (let i = 0; i < count; i++) {
      const g = new THREE.SphereGeometry(1, 6, 4).scale(0.04, len, 0.018).translate(0, len, 0);
      g.rotateX(tilt);
      g.rotateY(yaw0 + (i / count) * Math.PI * 2);
      const c = new THREE.Color(color);
      const col = [];
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        // ngọn cánh nhạt, gốc cánh hồng đậm
        const t = Math.min(1, Math.max(0, p.getY(k) / (len * 1.6)));
        const cc = c.clone().lerp(new THREE.Color(0xfff0f6), t * 0.7);
        col.push(cc.r, cc.g, cc.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      parts.push(g.toNonIndexed());
    }
  };
  petal(8, 1.0, 0.07, 0xe85a98, 0);
  petal(6, 0.5, 0.065, 0xf07ab0, 0.4);
  petal(4, 0.2, 0.05, 0xf898c4, 0.9);
  const center = new THREE.CylinderGeometry(0.03, 0.025, 0.04, 8).translate(0, 0.03, 0);
  const cc = [];
  for (let k = 0; k < center.attributes.position.count; k++) cc.push(0.98, 0.82, 0.3);
  center.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  parts.push(center.toNonIndexed());
  for (const p of parts) {
    p.deleteAttribute('uv');
    p.deleteAttribute('normal');
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals();
  return geo;
}

export function buildLotus(map, tileAt) {
  const list = cells(map, tileAt, 'L');
  if (!list.length) return null;
  const pond = (x, y) => tileAt(x, y) === 'L';
  const pads = [];
  const raised = [];
  const stems = [];
  const flowers = [];
  const buds = [];
  const stones = [];
  for (const [x, y] of list) {
    const n = 3 + Math.floor(rand(x, y, 1) * 2);
    for (let k = 0; k < n; k++) {
      const s = 0.12 + rand(x, y, k + 10) * 0.1;
      pads.push({
        x: x + 0.18 + rand(x, y, k + 20) * 0.64, y: POND_LEVEL + 0.012 + k * 0.002, z: y + 0.18 + rand(x, y, k + 30) * 0.64,
        ry: rand(x, y, k + 40) * 6.28, s, color: new THREE.Color().setHSL(0.27 + rand(x, y, k + 50) * 0.06, 0.5, 0.3 + rand(x, y, k + 60) * 0.1),
      });
    }
    // lá sen vươn cao trên cuống
    if (rand(x, y, 2) < 0.5) {
      const px = x + 0.25 + rand(x, y, 3) * 0.5;
      const pz = y + 0.25 + rand(x, y, 4) * 0.5;
      const h = 0.18 + rand(x, y, 5) * 0.14;
      raised.push({ x: px, y: POND_LEVEL + h, z: pz, ry: rand(x, y, 6) * 6.28, s: 0.17 + rand(x, y, 7) * 0.05, rx: (rand(x, y, 8) - 0.5) * 0.4, color: new THREE.Color().setHSL(0.3, 0.45, 0.34) });
      stems.push({ x: px, y: POND_LEVEL - 0.05, z: pz, sy: h + 0.05 });
    }
    // hoa sen (như bản 2D: khoảng nửa số ô có hoa), thêm vài nụ
    if (rand(x, y, 162) > 0.4) {
      const px = x + 0.2 + rand(x, y, 163) * 0.6;
      const pz = y + 0.25 + rand(x, y, 164) * 0.5;
      const h = 0.06 + rand(x, y, 165) * 0.1;
      flowers.push({ x: px, y: POND_LEVEL + h, z: pz, ry: rand(x, y, 166) * 6.28, s: 1 + rand(x, y, 167) * 0.35 });
      stems.push({ x: px, y: POND_LEVEL - 0.05, z: pz, sy: h + 0.05 });
    } else if (rand(x, y, 170) > 0.5) {
      const px = x + 0.3 + rand(x, y, 171) * 0.4;
      const pz = y + 0.3 + rand(x, y, 172) * 0.4;
      buds.push({ x: px, y: POND_LEVEL + 0.2, z: pz, s: 1 });
      stems.push({ x: px, y: POND_LEVEL - 0.05, z: pz, sy: 0.25 });
    }
    // bờ đá quanh ao
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (pond(x + dx, y + dy)) continue;
      for (let k = 0; k < 3; k++) {
        const along = (k + 0.2 + rand(x, y, 200 + k + dx * 7 + dy * 13) * 0.6) / 3;
        const s = 0.13 + rand(x, y, 210 + k + dx + dy * 5) * 0.08;
        stones.push({
          x: x + 0.5 + (dx ? dx * 0.5 : along - 0.5), y: -0.02, z: y + 0.5 + (dy ? dy * 0.5 : along - 0.5),
          ry: rand(x, y, 220 + k) * 6.28, sx: s * 1.3, sy: s * 0.55, sz: s, color: new THREE.Color().setHSL(0.08, 0.06, 0.55 + rand(x, y, 230 + k) * 0.15),
        });
      }
    }
  }
  const padGeo = new THREE.CircleGeometry(1, 14, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2);
  const padMat = lambert(0xffffff, { side: THREE.DoubleSide });
  const stoneGeo = new THREE.DodecahedronGeometry(0.5, 0);
  const nodes = [
    instanced(padGeo, padMat, pads, { cast: false }),
    instanced(padGeo, padMat, raised),
    instanced(new THREE.CylinderGeometry(0.008, 0.01, 1, 4).translate(0, 0.5, 0), lambert(0x4a7a32), stems),
    instanced(lotusFlowerGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), flowers),
    instanced(new THREE.ConeGeometry(0.035, 0.12, 6).translate(0, 0.06, 0), lambert(0xe86aa0), buds),
    instanced(stoneGeo, lambert(0xffffff), stones),
  ].filter(Boolean);
  return { nodes };
}

// ---------- Băng trôi ven hồ (bản đồ tuyết) ----------

export function buildIceFloes(map, tileAt) {
  const items = [];
  for (const [x, y] of cells(map, tileAt, 'w')) {
    const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => tileAt(x + dx, y + dy) !== 'w');
    if (!shore.length || rand(x, y, 300) < 0.45) continue;
    const [dx, dy] = shore[Math.floor(rand(x, y, 301) * shore.length)];
    const s = 0.08 + rand(x, y, 310) * 0.1;
    items.push({
      x: x + 0.5 + dx * 0.32 + (rand(x, y, 320) - 0.5) * 0.3, y: WATER_LEVEL + 0.005, z: y + 0.5 + dy * 0.32 + (rand(x, y, 330) - 0.5) * 0.3,
      ry: rand(x, y, 340) * 6.28, sx: s * (1 + rand(x, y, 341) * 0.6), sy: 1, sz: s, color: new THREE.Color().setHSL(0.57, 0.35, 0.86 + rand(x, y, 350) * 0.08),
    });
  }
  // mảng băng méo mó, không đều
  const geo = new THREE.CylinderGeometry(1, 0.85, 0.04, 7);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const k = 0.75 + rand(Math.round(a * 10), 3, 9) * 0.45;
    p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mesh = instanced(geo, new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, shininess: 80, transparent: true, opacity: 0.85 }), items, { cast: false });
  return mesh ? { nodes: [mesh] } : null;
}
