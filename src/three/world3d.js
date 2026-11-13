import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ITEMS } from '../data/items.js';
import { decorBlocks } from '../data/tiles.js';
import { buildBuilding } from './buildings3d.js';
import { bakeGround, canBake } from './groundBake.js';
import { LeafBurst, PX, buildFlowers, grassUniforms, makeMasks, paintGround, scatterGrass, scatterRice } from './nature.js';
import {
  PADDY_BED, PADDY_LEVEL, POND_BED, POND_LEVEL, WATER_BED, WATER_LEVEL,
  lambert, rand, shadowed, skyTexture,
} from './outdoorKit.js';
import {
  buildBridges, buildFences, buildIceFloes, buildJars, buildKilns, buildLanterns, buildLotus, buildPaddyBunds, buildRocks, waterSurface,
} from './outdoorProps.js';

// Dựng một bản đồ ngoài trời thành cảnh 3D. 1 ô = 1 đơn vị; ô (x, y) có tâm ở (x + 0.5, 0, y + 0.5).
// Ngoài mép bản đồ thêm MARGIN ô rừng cho camera không nhìn thấy khoảng trống.
export const MARGIN = 8;

// Ngoài mép bản đồ: nối dài đường đi (lối sang tuyến đường kế bên) và vách đá (núi chạy ra ngoài mép), còn lại là rừng
export function extendedTileAt(map, x, y) {
  if (x >= 0 && y >= 0 && x < map.width && y < map.height) return map.tileAt(x, y);
  const edge = map.tileAt(Math.min(Math.max(x, 0), map.width - 1), Math.min(Math.max(y, 0), map.height - 1));
  return edge === '=' || edge === 'R' ? edge : 'T';
}

// Độ cao nền từng loại ô: lòng hồ (cả dưới cầu), đáy ao sen, mặt ruộng trũng
const GROUND_H = { w: WATER_BED, b: WATER_BED, L: POND_BED, p: PADDY_BED };

// ---------- Mặt đất: mỗi ô một mặt phẳng, hồ / ao / ruộng lõm xuống, vách đất ở chỗ chênh nhau ----------

function buildGround(map, tileAt, masks) {
  const cols = map.width + MARGIN * 2;
  const rows = map.height + MARGIN * 2;
  // Mặt đất vẽ mềm (nature.js); hàng ô cuối canvas là vân đất cho vách hồ
  // Có renderer thì vẽ mặt đất trên GPU (~1 ms), không thì bằng JS (chậm hơn nhiều, dùng khi chạy thử ngoài game)
  const baked = canBake() ? bakeGround(map, masks, MARGIN) : null;
  const canvas = baked ? null : paintGround(map, masks, MARGIN);
  const soilY = rows * PX;
  const TILE = PX;
  const W = cols * TILE;
  const H = (rows + 1) * TILE;
  const uv = (px, py) => [px / W, 1 - py / H];
  const pos = [];
  const nor = [];
  const uvs = [];
  const idx = [];
  const quad = (a, b, c, d, n, ua, ub, uc, ud) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) nor.push(...n);
    uvs.push(...ua, ...ub, ...uc, ...ud);
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  };
  const height = (x, y) => GROUND_H[tileAt(x, y)] ?? 0;
  // vân đất: lấy phần trên của dải đất tương ứng chiều cao vách (vách thấp vẫn có mép cỏ)
  const soil = (top, bottom) => {
    const v = Math.min(1, (bottom - top) / WATER_BED);
    return [uv(0, soilY), uv(TILE, soilY), uv(0, soilY + TILE * v), uv(TILE, soilY + TILE * v)];
  };

  for (let y = -MARGIN; y < map.height + MARGIN; y++) {
    for (let x = -MARGIN; x < map.width + MARGIN; x++) {
      const h = height(x, y);
      const px = (x + MARGIN) * TILE;
      const py = (y + MARGIN) * TILE;
      // Mặt trên: a (tây bắc), b (đông bắc), c (tây nam), d (đông nam)
      quad([x, h, y], [x + 1, h, y], [x, h, y + 1], [x + 1, h, y + 1], [0, 1, 0],
        uv(px, py), uv(px + TILE, py), uv(px, py + TILE), uv(px + TILE, py + TILE));
      // Vách đất ở cạnh tiếp giáp chỗ trũng hơn
      let n = height(x, y + 1);
      if (n < h) quad([x, h, y + 1], [x + 1, h, y + 1], [x, n, y + 1], [x + 1, n, y + 1], [0, 0, 1], ...soil(h, n));
      n = height(x, y - 1);
      if (n < h) quad([x + 1, h, y], [x, h, y], [x + 1, n, y], [x, n, y], [0, 0, -1], ...soil(h, n));
      n = height(x + 1, y);
      if (n < h) quad([x + 1, h, y + 1], [x + 1, h, y], [x + 1, n, y + 1], [x + 1, n, y], [1, 0, 0], ...soil(h, n));
      n = height(x - 1, y);
      if (n < h) quad([x, h, y], [x, h, y + 1], [x, n, y], [x, n, y + 1], [-1, 0, 0], ...soil(h, n));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  let tex = baked?.texture;
  if (!tex) {
    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
  if (baked) mesh.userData.bake = baked; // giải phóng render target khi bỏ bản đồ khỏi bộ nhớ đệm
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- Mặt nước: hồ / sông (gợn sóng), ao sen và ruộng lúa (phẳng lặng, soi bóng trời) ----------

function tileCells(map, tileAt, chars) {
  const out = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (chars.includes(tileAt(x, y))) out.push([x, y]);
  return out;
}

function buildWaters(map, tileAt) {
  const snow = Boolean(map.snow);
  return [
    // hồ / sông, chảy cả dưới gầm cầu; bản đồ tuyết: nước lạnh xanh lơ, gợn ít
    waterSurface(tileCells(map, tileAt, 'wb'), snow
      ? { level: WATER_LEVEL, day: 0x5a9cc8, night: 0x162c4a, opacity: 0.8, waves: 0.5, env: skyTexture(), reflect: 0.2 }
      : { level: WATER_LEVEL, day: 0x3f8fdc, night: 0x14284e, opacity: 0.78, waves: 1 }),
    waterSurface(tileCells(map, tileAt, 'L'), { level: POND_LEVEL, day: 0x2f8478, night: 0x0e2a30, opacity: 0.86, shininess: 90, env: skyTexture(), reflect: 0.28 }),
    waterSurface(tileCells(map, tileAt, 'p'), { level: PADDY_LEVEL, day: 0x5e7a48, night: 0x1a2830, opacity: 0.66, shininess: 150, env: skyTexture(), reflect: 0.2 }),
  ].filter(Boolean);
}

// ---------- Cây thông: 3 tầng lá nón, thân gỗ (InstancedMesh, mỗi cây khác nhau chút ít) ----------
// T: cây lớn 2x2 ô • n: cây thông nhỏ 1 ô. Bản đồ tuyết: lá thẫm hơn, đầu mỗi tầng lá phủ tuyết.

const TIERS = [[0.95, 1.0, 0.45], [0.75, 0.9, 1.0], [0.52, 0.8, 1.5]];

// Cây đứng giữa camera và người chơi (phía nam, gần người chơi) mờ dần kiểu lưới chấm để luôn thấy nhân vật.
// Camera luôn nhìn từ phía nam nên chỉ cần xét cây nằm ngay phía dưới người chơi.
const treeFade = { uPlayer: { value: new THREE.Vector2(-999, -999) } };
function fadeNearPlayer(mat) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, treeFade);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec2 uPlayer;
        varying float vFade;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 treeRoot = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float ahead = treeRoot.z - uPlayer.y; // > 0: cây ở phía camera
        vFade = smoothstep(3.6, 1.2, ahead) * step(0.2, ahead) * smoothstep(1.9, 1.1, abs(treeRoot.x - uPlayer.x));`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vFade;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
        float bayer = mod(cell.x * 4.0 + cell.y * 9.0 + cell.x * cell.y * 3.0, 16.0) / 16.0;
        if (bayer < vFade * 0.8) discard;`);
  };
  mat.customProgramCacheKey = () => 'tree-fade';
  return mat;
}

function buildTrees(map, tileAt) {
  const snow = Boolean(map.snow);
  const spots = [];
  for (let y = -MARGIN; y < map.height + MARGIN; y += 2) {
    for (let x = -MARGIN; x < map.width + MARGIN; x += 2) if (tileAt(x, y) === 'T') spots.push([x + 1, y + 1, 1]);
  }
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (tileAt(x, y) === 'n') spots.push([x + 0.5, y + 0.5, 0.5]);
  // Đồ trang trí 2D (data/tiles.js): cây tán tròn (khối 2x2) và cây hoa anh đào (gốc Y) dựng tạm bằng cây cùng dáng, đổi màu lá
  for (const b of decorBlocks(map.rows)) if (b.ch === 'O') spots.push([b.x + 1, b.y + 1, 0.9, 'round']);
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (tileAt(x, y) === 'Y') spots.push([x + 0.5, y - 0.5, 1.1, 'blossom']);
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.16, 0.6, 6).translate(0, 0.3, 0);
  const leafGeo = mergeGeometries(TIERS.map(([r, h, y]) => new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0)));
  const trunks = new THREE.InstancedMesh(trunkGeo, fadeNearPlayer(lambert(0x6a4428)), spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, fadeNearPlayer(lambert(0xffffff)), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();
  spots.forEach(([x, z, size, kind], i) => {
    const s = (0.9 + rand(x, z, 1) * 0.3) * size;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(x, z, 2) * Math.PI * 2);
    // cây nhỏ thon và cao hơn tỉ lệ một chút
    const tall = size < 1 ? 1.35 : 1;
    const jitter = size < 1 ? 0.06 : 0.25;
    m.compose(new THREE.Vector3(x + (rand(x, z, 3) - 0.5) * jitter, 0, z + (rand(x, z, 4) - 0.5) * jitter), q, new THREE.Vector3(s, s * (0.95 + rand(x, z, 5) * 0.25) * tall, s));
    trunks.setMatrixAt(i, m);
    leaves.setMatrixAt(i, m);
    if (kind === 'blossom') leaves.setColorAt(i, color.setHSL(0.93, 0.6, 0.7 + rand(x, z, 7) * 0.06));
    else if (kind === 'round') leaves.setColorAt(i, color.setHSL(0.27 + rand(x, z, 6) * 0.05, 0.55, 0.32));
    else if (snow) leaves.setColorAt(i, color.setHSL(0.43 + rand(x, z, 6) * 0.04, 0.32, 0.13 + rand(x, z, 7) * 0.06));
    else leaves.setColorAt(i, color.setHSL(0.36 + rand(x, z, 6) * 0.06, 0.5, 0.26 + rand(x, z, 7) * 0.1));
  });
  const out = [shadowed(trunks), shadowed(leaves)];
  if (snow) {
    // Mũ tuyết: nón trắng ôm phần trên mỗi tầng lá (nhỉnh hơn tầng lá một chút), chừa viền lá xanh ở mép dưới
    const COVER = 0.74;
    const capGeo = mergeGeometries(TIERS.map(([r, h, y]) => new THREE.ConeGeometry(r * COVER * 1.06, h * COVER, 7).translate(0, y + h - (h * COVER) / 2 + 0.025, 0)));
    const caps = new THREE.InstancedMesh(capGeo, fadeNearPlayer(lambert(0xe4ebf4)), spots.length);
    for (let i = 0; i < spots.length; i++) {
      leaves.getMatrixAt(i, m);
      caps.setMatrixAt(i, m);
    }
    out.push(shadowed(caps));
  }
  return out;
}

// ---------- Biển báo, vườn quả, vật phẩm ----------

function buildSign(x, y) {
  const g = new THREE.Group();
  const wood = lambert(0x9a6a3a);
  const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.09), lambert(0x6a4428)));
  post.position.y = 0.27;
  const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.07), wood));
  board.position.y = 0.6;
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.3, 0.02), lambert(0xe8d4a0));
  face.position.set(0, 0.6, 0.045);
  g.add(post, board, face);
  g.position.set(x + 0.5, 0, y + 0.5);
  return g;
}

function buildBerryTree(o, row = false) {
  const g = new THREE.Group();
  // Cây đứng liền nhau trên một hàng: luống đất là khối hộp rộng đúng 1 ô để nối liền với ô bên cạnh
  const soilGeo = row ? new THREE.BoxGeometry(1, 0.06, 0.84) : new THREE.CylinderGeometry(0.42, 0.46, 0.06, 10);
  const soil = new THREE.Mesh(soilGeo, lambert(0x6a4a2a));
  soil.position.y = 0.03;
  soil.receiveShadow = true;
  const stem = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 5), lambert(0x6a4428)));
  stem.position.y = 0.2;
  const bush = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), lambert(0x3e8e4a)));
  bush.position.y = 0.5;
  bush.scale.set(1, 0.85, 1);
  g.add(soil, stem, bush);
  const color = ITEMS[o.berry]?.color ?? '#e04848';
  const fruitMat = lambert(color);
  const fruits = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand(o.x, o.y, i);
    const f = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), fruitMat));
    f.position.set(Math.cos(a) * 0.29, 0.45 + (i % 2) * 0.15, Math.sin(a) * 0.29);
    fruits.push(f);
    g.add(f);
  }
  g.position.set(o.x + 0.5, 0, o.y + 0.5);
  return { group: g, fruits };
}

// Vật phẩm nằm trên đường: viên pha lê vàng xoay tròn, lấp lánh
function buildItem(o, onWater) {
  const g = new THREE.Group();
  const gem = shadowed(new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshLambertMaterial({ color: 0xffd040, emissive: 0x6a4a00, flatShading: true })));
  gem.scale.set(1, 1.4, 1);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.35, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = onWater ? WATER_LEVEL + 0.04 : 0.02;
  g.add(gem, glow);
  g.position.set(o.x + 0.5, 0, o.y + 0.5);
  const baseY = onWater ? WATER_LEVEL + 0.35 : 0.35;
  return {
    group: g,
    update(t) {
      gem.rotation.y = t * 1.8;
      gem.position.y = baseY + Math.sin(t * 2.4 + o.x) * 0.06;
    },
  };
}

// ---------- Ghép tất cả ----------

// Số đèn thật (PointLight) tối đa trên một bản đồ: đèn cửa mỗi nhà + một phần đèn lồng + lò gốm
const MAX_LIGHTS = 9;

// Trả về một "cảnh" dùng chung giao diện với nội thất (interior3d.js):
// { root, tileAt, objectNodes, outdoor, update(t, dt, walkers), setNight(n), rustle(x, z), doors }
// doors: Map<toà nhà trong map.buildings, { setOpen(k) }> (k: 0 đóng .. 1 mở) cho hiệu ứng mở cửa khi ra vào
export function buildWorld(map) {
  const root = new THREE.Group();
  const tileAt = (x, y) => extendedTileAt(map, x, y);
  const masks = makeMasks(map, tileAt, MARGIN);
  const snow = Boolean(map.snow);
  const nightMats = [];
  const lamps = [];
  const updaters = [];
  const nightHooks = [];
  const doors = new Map();

  root.add(buildGround(map, tileAt, masks));
  for (const water of buildWaters(map, tileAt)) {
    root.add(water.mesh);
    if (water.update) updaters.push(water.update);
    nightHooks.push(water.setNight);
  }
  root.add(...buildTrees(map, tileAt));
  root.add(scatterGrass(map, tileAt, masks, MARGIN));
  const rice = scatterRice(map, tileAt, PADDY_BED);
  if (rice) root.add(rice);
  root.add(...buildFlowers(map, tileAt));
  const leaves = new LeafBurst(root);

  for (const b of map.buildings) {
    const { group, lamp, door, update } = buildBuilding(b, { nightMats, snow });
    root.add(group);
    lamps.push(lamp);
    doors.set(b, door);
    if (update) updaters.push(update);
  }

  // Địa hình và đồ vật theo loại ô
  const kilns = buildKilns(map, tileAt);
  const lanternLights = Math.max(2, MAX_LIGHTS - lamps.length - (kilns ? 1 : 0));
  const props = [
    buildRocks(map, tileAt, MARGIN),
    buildPaddyBunds(map, tileAt),
    buildBridges(map, tileAt),
    buildLanterns(map, tileAt, lanternLights),
    kilns,
    buildJars(map, tileAt),
    buildFences(map, tileAt),
    buildLotus(map, tileAt),
    snow ? buildIceFloes(map, tileAt) : null,
  ].filter(Boolean);
  for (const p of props) {
    if (p.nodes.length) root.add(...p.nodes);
    if (p.update) updaters.push(p.update);
    if (p.setNight) nightHooks.push(p.setNight);
  }

  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (tileAt(x, y) === 's') root.add(buildSign(x, y));

  // Vật thể trên bản đồ: map object -> { node, fruits }. Ẩn / hiện theo trạng thái game (three/view3d.js)
  const objectNodes = new Map();
  for (const o of map.objects) {
    if (o.kind === 'berry') {
      const row = map.objects.some((b) => b.kind === 'berry' && b.y === o.y && Math.abs(b.x - o.x) === 1);
      const tree = buildBerryTree(o, row);
      root.add(tree.group);
      objectNodes.set(o, { node: tree.group, fruits: tree.fruits });
    } else if (o.kind === 'item') {
      const item = buildItem(o, tileAt(o.x, o.y) === 'w');
      root.add(item.group);
      updaters.push(item.update);
      objectNodes.set(o, { node: item.group });
    }
  }

  return {
    root,
    tileAt,
    objectNodes,
    doors,
    outdoor: true,
    update(t, dt, walkers) {
      updaters.forEach((u) => u(t));
      if (walkers[0]) treeFade.uPlayer.value.set(walkers[0].x, walkers[0].z); // walkers[0] là người chơi
      leaves.update(dt);
      grassUniforms.uTime.value = t;
      grassUniforms.uWalkers.value.forEach((v, i) => {
        const w = walkers[i];
        if (w) v.set(w.x, w.z, 1, 0);
        else v.set(0, 0, 0, 0);
      });
    },
    rustle(x, z) {
      leaves.burst(x, z);
    },
    // night: 0 (ngày) .. 1 (đêm)
    setNight(night) {
      for (const { mat, color, strength } of nightMats) mat.emissive.setHex(color).multiplyScalar(night * strength);
      for (const lamp of lamps) lamp.intensity = night * 6;
      for (const hook of nightHooks) hook(night);
    },
  };
}
