import * as THREE from 'three';
import { THEMES } from '../data/interiorThemes.js';
import { buildGymObject, buildGymTiles, PUSH_ANGLE } from './gymProps.js';
import { rand } from './nature.js';
import { Instancer, box, buildBall, buildGem, canvasTex, cyl, fakeEnv, makeDarkness, std } from './roomKit.js';
import { buildHomeTile, coffeeTable, homeWallDecor, rugMesh, stairwellFloor } from './homeProps.js';

// Nội thất 3D dựng từ bản đồ trong nhà (data/map.js) và bảng màu nội thất của bản 2D (gfx/interior.js).
// Kiểu "nhà búp bê": tường sau và hai bên, phía trước để trống cho camera nhìn vào.
// Gym / phòng Liên minh: sàn kẻ vạch sân đấu, cờ hiệu và huy hiệu trên tường, đồ vật câu đố ở gymProps.js.

const WALL_H = 2.3;
const PART_H = 1.1; // vách ngăn giữa phòng (Gym Chùa Cổ) thấp hơn để camera nhìn qua được
const P = 64; // px mỗi ô trên texture sàn
const LAB_DESK_TOP = 0.835; // mặt bàn thí nghiệm 'd' (cao 0.8, mặt bàn dày 0.07)

// Thảm đỏ chạy từ cửa vào tới chỗ Thiên Vương: [nền, viền]
const CARPET = {
  league: ['#6a3aa8', '#e8c050'],
  elitePoison: ['#3a2a60', '#58b048'],
  eliteFighting: ['#8a2418', '#e8b040'],
  eliteGhost: ['#2a1a40', '#8a68c8'],
  eliteDragon: ['#1a2a68', '#d8b040'],
  champion: ['#a8242a', '#f0c840'],
};

// Sàn: ván gỗ (nhà) hoặc gạch men hai màu xen kẽ; gym có vạch sân đấu; ô than / kênh nước / băng tô nền riêng
function floorTexture(map, t, arena) {
  const W = map.width;
  const H = map.height;
  const at = (x, y) => map.tileAt(x, y);
  return canvasTex(W * P, H * P, (ctx) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (t.wood) {
          for (let k = 0; k < 4; k++) {
            const shade = rand(x, y * 4 + k, 3);
            ctx.fillStyle = shade > 0.5 ? t.floor : t.floorAlt;
            ctx.fillRect(x * P, y * P + k * 16, P, 16);
            ctx.fillStyle = t.grout;
            ctx.fillRect(x * P, y * P + k * 16 + 15, P, 1);
            const seam = Math.floor(rand(x, y * 4 + k, 4) * P);
            ctx.fillRect(x * P + seam, y * P + k * 16, 1, 15);
            ctx.globalAlpha = 0.12;
            for (let g = 0; g < 3; g++) ctx.fillRect(x * P, y * P + k * 16 + 3 + g * 4, P, 1);
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.fillStyle = (x + y) % 2 ? t.floorAlt : t.floor;
          ctx.fillRect(x * P, y * P, P, P);
          ctx.fillStyle = t.grout;
          ctx.fillRect(x * P, y * P, P, 2);
          ctx.fillRect(x * P, y * P, 2, P);
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x * P + 6, y * P + 6, 14, 3);
          ctx.globalAlpha = 1;
        }
      }
    }
    if (arena && map.theme !== 'league') courtLines(ctx, map, t);
    // Nền riêng của ô đặc biệt (vẽ sau vạch sân để che vạch)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = at(x, y);
        const ox = x * P;
        const oy = y * P;
        if (ch === 'x') {
          ctx.fillStyle = '#2a1810';
          ctx.fillRect(ox, oy, P, P);
          ctx.strokeStyle = '#a83010';
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(ox + rand(x, y, i) * P, oy + rand(x, y, i + 3) * P);
            ctx.lineTo(ox + rand(x, y, i + 6) * P, oy + rand(x, y, i + 9) * P);
            ctx.stroke();
          }
        } else if (ch in PUSH_ANGLE && map.theme === 'gymWater') {
          ctx.fillStyle = '#1a4a98';
          ctx.fillRect(ox, oy, P, P);
        } else if (ch === 'i' || (ch === 'o' && map.theme === 'gymIce')) {
          ctx.fillStyle = '#b8e0f8';
          ctx.fillRect(ox, oy, P, P);
        }
      }
    }
  });
}

// Vạch sân đấu Pokémon: khung sân, vạch giữa, vòng tròn Poké Ball ở giữa, vòng tròn chỗ thủ lĩnh đứng
function courtLines(ctx, map, t) {
  const W = map.width;
  const H = map.height;
  let top = 0;
  while (top < H && [...Array(W).keys()].every((x) => '#D'.includes(map.tileAt(x, top)))) top++;
  const x0 = 0.4 * P;
  const x1 = (W - 0.4) * P;
  const y0 = (top + 0.4) * P;
  const y1 = (H - 1.4) * P;
  const cx = (W / 2) * P;
  const cy = (y0 + y1) / 2;
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = t.trim;
  ctx.lineWidth = 6;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.beginPath();
  ctx.moveTo(x0, cy);
  ctx.lineTo(x1, cy);
  ctx.stroke();
  // Poké Ball giữa sân
  ctx.beginPath();
  ctx.arc(cx, cy, 1.6 * P, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = t.trim;
  ctx.beginPath();
  ctx.arc(cx, cy, 1.6 * P, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(cx, cy, 0.45 * P, 0, Math.PI * 2);
  ctx.stroke();
  // vòng chỗ đứng của thủ lĩnh / Thiên Vương
  ctx.beginPath();
  ctx.arc(cx, (top + 0.5) * P + (map.theme.startsWith('gym') ? 0 : P), 0.62 * P, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Giấy dán tường: sọc dọc ở trên, ốp gỗ phía dưới, chân tường sẫm
function wallTexture(t) {
  return canvasTex(64, 128, (ctx) => {
    ctx.fillStyle = t.wall;
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = t.stripe;
    for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 8, 80);
    ctx.fillStyle = t.trim;
    ctx.fillRect(0, 80, 64, 40);
    ctx.fillStyle = t.trimDark;
    ctx.fillRect(0, 80, 64, 4);
    for (let x = 0; x < 64; x += 32) ctx.fillRect(x, 84, 2, 36);
    ctx.fillStyle = t.base;
    ctx.fillRect(0, 120, 64, 8);
  });
}

// Cờ hiệu treo tường: thân màu chủ đạo, viền sẫm, huy hiệu tròn ở giữa, đuôi xẻ chữ V
function bannerTexture(t) {
  return canvasTex(64, 128, (c) => {
    c.clearRect(0, 0, 64, 128);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(64, 0);
    c.lineTo(64, 128);
    c.lineTo(32, 104);
    c.lineTo(0, 128);
    c.closePath();
    c.fillStyle = t.trimDark;
    c.fill();
    c.beginPath();
    c.moveTo(5, 5);
    c.lineTo(59, 5);
    c.lineTo(59, 118);
    c.lineTo(32, 98);
    c.lineTo(5, 118);
    c.closePath();
    c.fillStyle = t.trim;
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(32, 46, 17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = t.trimDark;
    c.fillRect(15, 44, 34, 4);
    c.beginPath();
    c.arc(32, 46, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(32, 46, 3, 0, Math.PI * 2);
    c.fill();
  });
}

function carpetTexture([base, edge], len) {
  return canvasTex(80, 64 * len, (c) => {
    c.fillStyle = base;
    c.fillRect(0, 0, 80, 64 * len);
    c.fillStyle = edge;
    c.fillRect(4, 0, 5, 64 * len);
    c.fillRect(71, 0, 5, 64 * len);
    c.globalAlpha = 0.45;
    for (let i = 0; i < len; i++) {
      const y = i * 64 + 32;
      c.beginPath();
      c.moveTo(40, y - 14);
      c.lineTo(52, y);
      c.lineTo(40, y + 14);
      c.lineTo(28, y);
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;
  });
}

const BOOK_COLORS = [0xd04848, 0x4870c8, 0x48a060, 0xe8b040, 0x8858b8, 0xe07838, 0x3a9aa8];
const GOODS = [0xe05050, 0x4a7ad8, 0xf0c040, 0x50b070, 0xa050d0, 0xf08030, 0xf0f0f0];
const unitBox = new THREE.BoxGeometry(1, 1, 1);

export function buildInterior(map) {
  const t = THEMES[map.theme] ?? THEMES.center;
  const theme = map.theme ?? 'center';
  const arena = /^(gym|elite|champion|league)/.test(theme);
  const grand = /^(elite|champion|league)/.test(theme);
  const root = new THREE.Group();
  const W = map.width;
  const H = map.height;
  const tileAt = (x, y) => map.tileAt(x, y);
  const blinkers = [];
  const screens = [];
  const updaters = [];
  let healGlow = null;

  // Sàn (gym / Liên minh: đá bóng phản chiếu nhẹ)
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture(map, t, arena),
    roughness: arena && !t.wood ? 0.35 : 0.55,
    ...(arena && !t.wood ? { envMap: fakeEnv(), envMapIntensity: 0.22 } : {}),
  });
  // Có cầu thang xuống thì sàn chừa lỗ ở ô đó để nhìn xuống giếng cầu thang
  const floor = new THREE.Mesh(stairwellFloor(map) ?? new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2).translate(W / 2, 0, H / 2), floorMat);
  floor.receiveShadow = true;
  root.add(floor);

  // Tường: ô '#' thành khối cao, mặt trước dán giấy; hai bên là vách mỏng; mép trước là gờ thấp.
  // Ô tường nằm giữa phòng (phía trên còn sàn) là vách ngăn thấp.
  const wallTex = wallTexture(t);
  const wallFront = std(0xffffff, { map: wallTex });
  const wallPlain = std(t.wall);
  const wallTop = std(0x2e2838);
  const partTop = std(t.trim);
  const wallMats = [wallPlain, wallPlain, wallTop, wallPlain, wallFront, wallPlain];
  const partMats = [wallPlain, wallPlain, partTop, wallPlain, std(t.stripe), wallPlain];
  const fullWall = (x, y) => {
    for (let k = y; k >= 0; k--) if (!'#Dm'.includes(tileAt(x, k))) return false;
    return true;
  };
  // Mặt tường hướng vào phòng (tường sau): nơi treo cửa sổ / cờ hiệu
  const faces = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = tileAt(x, y);
      if (ch === 'D') {
        root.add(bigDoor(x, y, t, grand, wallMats));
        continue;
      }
      if (ch !== '#') continue;
      if (!fullWall(x, y)) {
        root.add(box(1, PART_H, 1, partMats, x + 0.5, PART_H / 2, y + 0.5));
        continue;
      }
      root.add(box(1, WALL_H, 1, wallMats, x + 0.5, WALL_H / 2, y + 0.5));
      if (y + 1 < H && !'#D'.includes(tileAt(x, y + 1))) faces.push([x, y]);
    }
  }
  const banner = arena ? std(0xffffff, { map: bannerTexture(t), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }) : null;
  const mid = Math.floor(W / 2);
  for (const [x, y] of faces) {
    const z = y + 1;
    if (!arena) {
      // cửa sổ trên tường nhìn ra ngoài
      if (x % 4 === 1 && !'kMV'.includes(tileAt(x, y + 1))) {
        const glass = std(0xbfe4ff, { emissive: 0x6aa8e0, emissiveIntensity: 0.6 });
        const frame = box(0.72, 0.62, 0.06, std(t.trimDark), x + 0.5, 1.45, z + 0.02);
        frame.add(box(0.6, 0.5, 0.02, glass, 0, 0, 0.025));
        frame.add(box(0.04, 0.5, 0.03, std(t.trimDark), 0, 0, 0.03));
        root.add(frame);
      }
      continue;
    }
    // Huy hiệu lớn sau lưng thủ lĩnh / Nhà vô địch; cờ hiệu hai bên
    if (x === mid) root.add(crest(x + 0.5, 1.45, z, t, theme.startsWith('gym') ? 0.42 : 0.5));
    else if (x % 2 === 0 && Math.abs(x - mid) > 1 && x > 0 && x < W - 1) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.12), banner);
      b.position.set(x + 0.5, 1.5, z + 0.03);
      b.castShadow = true;
      root.add(b, box(0.7, 0.05, 0.05, std(0xe8c050, { metalness: 0.6, roughness: 0.35 }), x + 0.5, 2.08, z + 0.04));
    }
    // Phòng Liên minh: cột ốp tường viền vàng
    if (grand && x % 2 === 1 && Math.abs(x + 0.5 - (mid + 0.5)) > 1.2) {
      root.add(box(0.22, WALL_H, 0.12, std(t.trim, { roughness: 0.45, metalness: 0.2 }), x + 0.5, WALL_H / 2, z + 0.06));
      root.add(box(0.3, 0.14, 0.18, std(0xe8c050, { metalness: 0.6, roughness: 0.35 }), x + 0.5, WALL_H - 0.07, z + 0.09));
    }
  }
  const sideMat = [wallPlain, wallPlain, wallTop, wallPlain, wallPlain, wallPlain];
  const sideL = box(0.25, WALL_H, H, sideMat, -0.125, WALL_H / 2, H / 2);
  const sideR = box(0.25, WALL_H, H, sideMat, W + 0.125, WALL_H / 2, H / 2);
  sideL.material = [wallPlain, wallFront, wallTop, wallPlain, wallPlain, wallPlain];
  sideR.material = [wallFront, wallPlain, wallTop, wallPlain, wallPlain, wallPlain];
  root.add(sideL, sideR, box(W + 0.5, 0.22, 0.2, std(t.base), W / 2, 0.11, H + 0.1));

  // Thảm dài từ lối vào tới chỗ Thiên Vương / cửa lớn
  if (CARPET[theme]) {
    let top = 0;
    while (top < H && '#D'.includes(tileAt(mid, top))) top++;
    const len = H - top;
    const mat = std(0xffffff, { map: carpetTexture(CARPET[theme], len), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.25, len).rotateX(-Math.PI / 2), mat);
    carpet.position.set(mid + 0.5, 0.004, top + len / 2);
    carpet.receiveShadow = true;
    root.add(carpet);
  }

  // Nhà người chơi: thảm trải sàn, tranh ảnh / đồng hồ / lịch treo tường
  for (const rug of map.rugs ?? []) root.add(rugMesh(rug));
  if (theme === 'home') root.add(homeWallDecor(map));

  // Đồ đạc theo ký tự ô
  const wood = std(t.counterFront);
  const woodDark = std(t.counterDark);
  const top = std(t.counterTop);
  const shop = theme === 'mart';
  const furn = new Instancer(); // sách / hàng hoá trên kệ: gộp thành InstancedMesh
  const itemMat = std(0xffffff, { roughness: 0.6 });
  const labelMat = std(0xffffff, { roughness: 0.5 });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = tileAt(x, y);
      const cx = x + 0.5;
      const cz = y + 0.5;
      const g = new THREE.Group();
      // Đồ trong nhà người chơi: cầu thang, sofa, tủ lạnh, bàn học, quầy bếp (bàn nước dựng riêng cả khối bên dưới)
      if (theme === 'home') {
        const piece = ch === 't' ? null : buildHomeTile(map, x, y, t);
        if (piece) root.add(piece);
        if (piece || ch === 't') continue;
      }
      switch (ch) {
        case 'k': { // kệ sách / kệ hàng sát tường: tủ mở mặt trước (vách sau, hai vách bên, nóc), sách / hàng hoá trên từng tầng
          g.add(box(0.94, 1.75, 0.06, woodDark, cx, 0.875, y + 0.05));
          for (const sx of [-0.445, 0.445]) g.add(box(0.05, 1.75, 0.5, woodDark, cx + sx, 0.875, y + 0.27));
          g.add(box(0.94, 0.05, 0.5, woodDark, cx, 1.75, y + 0.27));
          for (let s = 0; s < 3; s++) {
            g.add(box(0.86, 0.04, 0.46, wood, cx, 0.3 + s * 0.5, y + 0.28));
            let bx = x + 0.1;
            for (let b = 0; b < 7; b++) {
              // Poké Mart: hộp / chai hàng thấp nhiều màu; nhà và phòng thí nghiệm: sách gáy đứng
              const bw = shop ? 0.13 + rand(x, y, s * 10 + b) * 0.06 : 0.08 + rand(x, y, s * 10 + b) * 0.06;
              const bh = shop ? 0.14 + rand(x, y, s * 10 + b + 5) * 0.1 : 0.24 + rand(x, y, s * 10 + b + 5) * 0.14;
              if (bx + bw > x + 0.9) break;
              const pal = shop ? GOODS : BOOK_COLORS;
              const c = pal[Math.floor(rand(x, y, s * 7 + b) * pal.length)];
              furn.add(unitBox, itemMat, bx + bw / 2, 0.32 + s * 0.5 + bh / 2, y + 0.3, { sx: bw, sy: bh, sz: shop ? 0.22 : 0.32, color: c });
              if (shop && rand(x, y, s * 5 + b + 40) > 0.5) furn.add(unitBox, labelMat, bx + bw / 2, 0.32 + s * 0.5 + bh * 0.55, y + 0.412, { sx: bw * 0.8, sy: bh * 0.35, sz: 0.004 });
              bx += bw + (shop ? 0.025 : 0.015);
            }
          }
          break;
        }
        case 'B': { // giường 2 ô: ô trên có gối, ô dưới chân giường
          const head = tileAt(x, y - 1) !== 'B';
          const quilt = map.bedColor ? parseInt(map.bedColor.slice(1), 16) : 0x4a78c8; // màu chăn (map.bedColor)
          g.add(box(0.9, 0.3, 1.0, woodDark, cx, 0.15, cz));
          g.add(box(0.84, 0.16, 0.98, std(0xf8f8f8), cx, 0.38, cz));
          if (head) {
            g.add(box(0.94, 0.75, 0.08, woodDark, cx, 0.37, y + 0.04));
            const pillow = box(0.6, 0.12, 0.3, std(0xffffff), cx, 0.52, y + 0.28);
            g.add(pillow);
            g.add(box(0.86, 0.06, 0.5, std(quilt), cx, 0.48, y + 0.75));
          } else g.add(box(0.86, 0.07, 0.98, std(quilt), cx, 0.48, cz));
          break;
        }
        case 'V': { // kệ TV, màn hình nhấp nháy
          g.add(box(0.95, 0.45, 0.45, wood, cx, 0.225, y + 0.3));
          g.add(box(0.8, 0.52, 0.1, std(0x24242c), cx, 0.74, y + 0.25));
          const screen = std(0x203050, { emissive: 0x4a8ad8, emissiveIntensity: 0.8 });
          g.add(box(0.7, 0.42, 0.02, screen, cx, 0.74, y + 0.31));
          screens.push(screen);
          break;
        }
        case 't': // bàn: mặt bàn ghép liền giữa các ô
        case 'd': { // bàn thí nghiệm có bình hoá chất, giấy tờ
          const h = ch === 't' ? 0.62 : 0.8;
          g.add(box(1.0, 0.07, 1.0, ch === 't' ? wood : top, cx, h, cz));
          g.add(box(0.9, h - 0.04, 0.9, ch === 't' ? woodDark : std(t.counterFront), cx, (h - 0.04) / 2, cz));
          if (ch === 'd' && !map.objects?.some((o) => o.x === x && o.y === y)) {
            const flask = std(0x88e0c8, { transparent: true, opacity: 0.7, emissive: 0x2a8a70, emissiveIntensity: 0.4 });
            g.add(cyl(0.05, 0.08, 0.18, flask, cx - 0.2, h + 0.12, cz));
            g.add(cyl(0.035, 0.035, 0.22, std(0xe8a0d0, { transparent: true, opacity: 0.75 }), cx + 0.05, h + 0.14, cz - 0.1));
            g.add(box(0.3, 0.01, 0.22, std(0xffffff), cx + 0.15, h + 0.04, cz + 0.15));
          }
          break;
        }
        case 'p': { // chậu cây
          g.add(cyl(0.2, 0.15, 0.32, std(0xc0704a), cx, 0.16, cz));
          for (let k = 0; k < 5; k++) {
            const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), std(0x4a9a48, { flatShading: true }));
            leaf.position.set(cx + (rand(x, y, k) - 0.5) * 0.3, 0.55 + rand(x, y, k + 3) * 0.35, cz + (rand(x, y, k + 6) - 0.5) * 0.3);
            leaf.castShadow = true;
            g.add(leaf);
          }
          break;
        }
        case 'E': { // thảm chùi chân ở cửa ra
          const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7).rotateX(-Math.PI / 2), std(0xc04848));
          mat.position.set(cx, 0.012, cz + 0.1);
          mat.receiveShadow = true;
          g.add(mat);
          break;
        }
        case 'c': { // quầy
          g.add(box(1.0, 0.92, 0.8, wood, cx, 0.46, cz));
          g.add(box(1.04, 0.08, 0.9, top, cx, 0.96, cz));
          break;
        }
        case 'm': { // máy hồi phục trong hốc tường
          g.add(box(1.0, 0.9, 0.8, std(0xe8e8f0), cx, 0.45, cz + 0.1));
          const glow = std(0xa8f0ff, { emissive: 0x58c8f0, emissiveIntensity: 0.3, transparent: true, opacity: 0.85 });
          const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glow);
          dome.position.set(cx, 0.9, cz + 0.1);
          g.add(dome);
          healGlow ??= [];
          healGlow.push(glow);
          break;
        }
        case 'P': { // máy tính
          g.add(box(0.9, 0.72, 0.6, wood, cx, 0.36, cz));
          g.add(box(0.6, 0.45, 0.08, std(0x30343c), cx, 1.0, cz - 0.1));
          const screen = std(0x203860, { emissive: 0x3a7ad8, emissiveIntensity: 0.9 });
          g.add(box(0.5, 0.36, 0.02, screen, cx, 1.0, cz - 0.05));
          screens.push(screen);
          break;
        }
        case 'b': { // ghế sofa chờ
          g.add(box(0.98, 0.38, 0.7, std(t.counterFront), cx, 0.19, cz));
          g.add(box(0.98, 0.45, 0.18, std(t.counterDark), cx, 0.5, cz - 0.28));
          break;
        }
        case 'M': { // máy móc phòng thí nghiệm, đèn báo nhấp nháy
          g.add(box(0.92, 1.55, 0.7, std(0xb8c0cc, { metalness: 0.3, roughness: 0.5 }), cx, 0.775, cz));
          g.add(box(0.6, 0.4, 0.02, std(0x182030, { emissive: 0x40c890, emissiveIntensity: 0.7 }), cx, 1.15, cz + 0.36));
          for (let k = 0; k < 3; k++) {
            const led = std(0x202020, { emissive: [0xff4040, 0x40ff60, 0xffd040][k], emissiveIntensity: 1 });
            g.add(box(0.07, 0.07, 0.02, led, cx - 0.2 + k * 0.2, 0.7, cz + 0.36));
            blinkers.push({ mat: led, phase: rand(x, y, k) * 6, speed: 2 + k });
          }
          break;
        }
        default:
          break;
      }
      if (g.children.length) root.add(g);
    }
  }

  furn.build(root);
  if (theme === 'home') {
    const table = coffeeTable(map, t);
    if (table) root.add(table);
  }

  // Ô câu đố trong gym (cột, ô gió, dòng nước, rào tre, tường điện, than, lò, ô dịch chuyển, băng)
  const gym = buildGymTiles(map, t, root);

  const objectNodes = new Map();
  for (const o of map.objects ?? []) {
    // Poké Ball đựng Pokémon khởi đầu trên bàn phòng thí nghiệm (ẩn khi đã được chọn, theo trạng thái game)
    if (o.kind === 'starter') {
      const ball = buildBall({ seed: o.x * 3 + o.y });
      ball.group.position.set(o.x + 0.5, tileAt(o.x, o.y) === 'd' ? LAB_DESK_TOP : 0, o.y + 0.5);
      root.add(ball.group);
      updaters.push(ball.update);
      objectNodes.set(o, { node: ball.group });
      continue;
    }
    if (o.kind === 'item') {
      const item = buildGem(o);
      root.add(item.group);
      updaters.push(item.update);
      objectNodes.set(o, { node: item.group });
      continue;
    }
    // Cổng tre, cửa phong ấn, hàng rào điện, công tắc
    const obj = buildGymObject(o, t);
    if (!obj) continue;
    root.add(obj.node);
    if (obj.update) updaters.push(obj.update);
    objectNodes.set(o, { node: obj.node, setOn: obj.setOn });
  }

  // Đèn trần ấm; gym có thêm đèn màu ở chỗ có lửa / điện
  for (const [lx, lz] of [[W * 0.3, H * 0.45], [W * 0.7, H * 0.45]]) {
    const lamp = new THREE.PointLight(0xffe0b0, arena ? 4 : 5, arena ? 11 : 9, 1.5);
    lamp.position.set(lx, arena ? 2.6 : 2.2, lz);
    root.add(lamp);
  }
  const flicker = [];
  const spots = gym.lightSpots;
  const colored = [
    ...pickSpread(spots.fire, 2).map((p) => [p, 0xff8030, 3]),
    ...pickSpread(spots.spark, 2).map((p) => [p, 0xffe070, 2.5]),
    ...pickSpread(spots.flame, 2).map((p) => [p, gymFlameColor(theme), 3]),
  ].slice(0, 2);
  for (const [[lx, ly, lz], color, power] of colored) {
    const l = new THREE.PointLight(color, power, 6, 1.6);
    l.position.set(lx, ly, lz);
    root.add(l);
    flicker.push({ l, power, phase: lx * 1.7 });
  }
  // Gym Lửa: than hồng hắt ánh cam lên khắp phòng
  if (theme === 'gymFire') {
    const l = new THREE.PointLight(0xff6a20, 4, 10, 1.4);
    l.position.set(W / 2, 1.2, H * 0.5);
    root.add(l);
    flicker.push({ l, power: 4, phase: 0 });
  }

  // Phòng tối: chỉ thấy quanh người chơi (giống vòng sáng của bản 2D)
  const dark = map.dark ? makeDarkness({ inner: 1.6, outer: 2.7, floor: 0.025 }) : null;
  dark?.apply(root);

  return {
    root,
    tileAt,
    objectNodes,
    outdoor: false,
    update(time, dt, walkers) {
      for (const b of blinkers) b.mat.emissiveIntensity = Math.sin(time * b.speed + b.phase) > 0 ? 1.2 : 0.1;
      screens.forEach((s, i) => (s.emissiveIntensity = 0.7 + Math.sin(time * 7 + i) * 0.12 + Math.sin(time * 13.7) * 0.08));
      gym.update(time);
      for (const u of updaters) u(time);
      for (const f of flicker) f.l.intensity = f.power * (0.85 + Math.sin(time * 9 + f.phase) * 0.08 + Math.sin(time * 23.1 + f.phase) * 0.07);
      dark?.follow(walkers?.[0]);
    },
    rustle() {},
    setNight() {},
    // Hiệu ứng máy hồi phục sáng lên nhịp nhàng
    async heal() {
      if (!healGlow) return;
      const start = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          const k = (performance.now() - start) / 1600;
          for (const m of healGlow) m.emissiveIntensity = k < 1 ? 0.3 + Math.abs(Math.sin(k * Math.PI * 4)) * 2.2 : 0.3;
          if (k < 1) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
    },
  };
}

const FLAME_LIGHT = { elitePoison: 0x80ff70, eliteFighting: 0xff9040, eliteGhost: 0xb070ff, eliteDragon: 0x70a8ff };
const gymFlameColor = (theme) => FLAME_LIGHT[theme] ?? 0xffc060;

// Chọn vài điểm cách xa nhau (đầu, cuối danh sách) để đặt đèn
function pickSpread(list, n) {
  if (list.length <= n) return list;
  return [list[0], list[list.length - 1]].slice(0, n);
}

// Huy hiệu tròn treo tường: viền vàng, nền màu chủ đạo, Poké Ball trắng ở giữa
function crest(x, y, z, t, r) {
  const g = new THREE.Group();
  const disc = (rad, depth, mat, dz) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, depth, 32).rotateX(Math.PI / 2), mat);
    m.position.z = dz;
    m.castShadow = true;
    g.add(m);
  };
  disc(r, 0.06, std(0xe8c050, { metalness: 0.6, roughness: 0.35 }), 0.03);
  disc(r * 0.84, 0.07, std(t.trim, { roughness: 0.5 }), 0.04);
  disc(r * 0.45, 0.08, std(0xffffff, { roughness: 0.4 }), 0.05);
  g.add(box(r * 0.9, r * 0.1, 0.09, std(t.trimDark), 0, 0, 0.05));
  disc(r * 0.16, 0.1, std(t.trimDark), 0.06);
  g.position.set(x, y, z);
  return g;
}

// Cửa lớn hai cánh trong hàng tường (Liên minh): hốc cửa lùi vào tường, khung cửa và huy hiệu phía trên
function bigDoor(x, y, t, grand, wallMats) {
  const g = new THREE.Group();
  const cx = x + 0.5;
  const front = y + 1;
  const doorH = 1.75;
  const frameMat = std(grand ? 0xe8c050 : t.trimDark, { metalness: grand ? 0.6 : 0, roughness: 0.4 });
  // phần tường phía trên cửa
  g.add(box(1, WALL_H - doorH, 1, wallMats, cx, doorH + (WALL_H - doorH) / 2, y + 0.5));
  // hai cánh cửa lùi vào trong hốc
  const leaf = std(t.trim, { roughness: 0.5 });
  const panel = std(new THREE.Color(t.trim).multiplyScalar(0.78), { roughness: 0.5 });
  const knob = std(0xf8e088, { metalness: 0.7, roughness: 0.3, emissive: 0x4a3a00 });
  for (const s of [-1, 1]) {
    const d = box(0.46, doorH, 0.08, leaf, cx + s * 0.235, doorH / 2, y + 0.22);
    d.add(box(0.32, 0.6, 0.02, panel, 0, 0.4, 0.05), box(0.32, 0.6, 0.02, panel, 0, -0.38, 0.05));
    d.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), knob).translateX(-s * 0.16).translateZ(0.06));
    g.add(d);
  }
  g.add(box(0.03, doorH, 0.09, std(t.trimDark), cx, doorH / 2, y + 0.22));
  // khung cửa trên mặt tường
  for (const s of [-1, 1]) g.add(box(0.16, doorH + 0.15, 0.14, frameMat, cx + s * 0.55, (doorH + 0.15) / 2, front + 0.05));
  g.add(box(1.34, 0.2, 0.16, frameMat, cx, doorH + 0.2, front + 0.06));
  // vách hai bên trong hốc cửa (tường bên cạnh là ô '#' nên đã có mặt bên)
  g.add(crest(cx, doorH + 0.48, front + 0.02, t, 0.2));
  return g;
}
