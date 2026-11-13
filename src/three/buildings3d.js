import * as THREE from 'three';
import { makeCanvas } from './canvas.js';
import { hex, lambert, pixelTexture, shadowed, signTexture } from './outdoorKit.js';

// Nhà cửa ngoài trời: nhà dân, Pokémon Center, Poké Mart, phòng thí nghiệm, tiệm xe đạp, trung tâm thương mại,
// nhà thi đấu (gym) và toà nhà Liên minh. Mỗi nhà: { group, lamp, door: { setOpen(k) }, update?(t) }.
// Mặt trước nhà nằm ở mép dưới khối nhà; ô cửa (b.door) ở hàng dưới cùng, người chơi đi lên để vào.

const BUILDING_STYLE = {
  house: { wall: 0xf3e6cc, roof: 0xd0503c, trim: 0x8a5a3a, height: 1.55, chimney: true },
  center: { wall: 0xfaf4ee, roof: 0xe04848, trim: 0xb03030, height: 1.75, glassDoor: true, plaque: 'cross' },
  mart: { wall: 0xf2f2f6, roof: 0x3f74d0, trim: 0x2a4a90, height: 1.65, glassDoor: true, plaque: 'bag' },
  lab: { wall: 0xe8ecf0, roof: 0x6a7a8a, trim: 0x4a5868, height: 1.9, flatRoof: true },
  bikeShop: { wall: 0xf4f0e6, roof: 0x30a888, trim: 0x207a62, height: 1.6, glassDoor: true, sign: 'BIKE', bike: true },
};

// Màu mái theo biến thể b.roof (cùng bảng ROOFS của bản 2D, gfx/world.js)
const ROOF_VARIANT = {
  houseRed: 0xc83a2a,
  houseYellow: 0xd8a030,
  houseGreen: 0x3a8a58,
  gym: 0x3aa0b8,
  gymGrass: 0x5aa83a,
  gymElectric: 0xe8b820,
  gymWater: 0x3a7ae0,
  gymFire: 0xd85a28,
  gymRock: 0x8a7860,
  gymPsychic: 0xa858d8,
  gymIce: 0x98d0f0,
};
const shade = (c, f) => new THREE.Color(c).multiplyScalar(f).getHex();

// ---------- Texture ----------

// Vân ngói pixel: hàng ngói so le, mép dưới mỗi hàng tối hơn
function shingleTexture(color) {
  const { canvas, ctx } = makeCanvas(16, 16);
  const base = new THREE.Color(color);
  const tone = (f) => `#${base.clone().multiplyScalar(f).getHexString()}`;
  ctx.fillStyle = hex(color);
  ctx.fillRect(0, 0, 16, 16);
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    ctx.fillStyle = tone(1.12);
    ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = tone(0.72);
    ctx.fillRect(0, y + 3, 16, 1);
    const off = row % 2 ? 4 : 0;
    for (let x = off; x < 16; x += 8) ctx.fillRect(x, y, 1, 3);
  }
  const tex = pixelTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Mái tôn / mái vòm: các rãnh dọc song song
function panelTexture(color) {
  const { canvas, ctx } = makeCanvas(16, 16);
  const base = new THREE.Color(color);
  const tone = (f) => `#${base.clone().multiplyScalar(f).getHexString()}`;
  ctx.fillStyle = hex(color);
  ctx.fillRect(0, 0, 16, 16);
  for (let x = 0; x < 16; x += 4) {
    ctx.fillStyle = tone(1.15);
    ctx.fillRect(x, 0, 1, 16);
    ctx.fillStyle = tone(0.75);
    ctx.fillRect(x + 3, 0, 1, 16);
  }
  const tex = pixelTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function plaqueTexture(kind, color) {
  const { canvas, ctx } = makeCanvas(32, 32);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = hex(color);
  if (kind === 'cross') {
    ctx.fillRect(12, 5, 8, 22);
    ctx.fillRect(5, 12, 22, 8);
  } else {
    ctx.fillRect(7, 12, 18, 15);
    ctx.fillRect(11, 6, 3, 8);
    ctx.fillRect(18, 6, 3, 8);
    ctx.fillRect(11, 6, 10, 3);
  }
  return pixelTexture(canvas);
}

// Cánh cửa kính: khung sẫm, kính xanh nhạt có vệt sáng
let glassTex = null;
function glassTexture() {
  if (glassTex) return glassTex;
  const { canvas, ctx } = makeCanvas(8, 16);
  ctx.fillStyle = '#404a58';
  ctx.fillRect(0, 0, 8, 16);
  ctx.fillStyle = '#8ccaf0';
  ctx.fillRect(1, 1, 6, 14);
  ctx.fillStyle = '#d8f0ff';
  ctx.fillRect(2, 2, 1, 6);
  ctx.fillRect(3, 2, 1, 3);
  glassTex = pixelTexture(canvas);
  return glassTex;
}

// Cánh cửa gỗ: hai ô pa-nô, ván dọc
let woodTex = null;
function woodDoorTexture() {
  if (woodTex) return woodTex;
  const { canvas, ctx } = makeCanvas(12, 16);
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(0, 0, 12, 16);
  ctx.fillStyle = '#5e3820';
  for (const x of [0, 4, 8]) ctx.fillRect(x, 0, 1, 16);
  ctx.fillStyle = '#8e5a34';
  ctx.fillRect(2, 2, 8, 5);
  ctx.fillRect(2, 9, 8, 5);
  ctx.fillStyle = '#5e3820';
  ctx.fillRect(2, 6, 8, 1);
  ctx.fillRect(2, 13, 8, 1);
  woodTex = pixelTexture(canvas);
  return woodTex;
}

// Biểu tượng hệ trên biển hiệu gym
const GYM_ICON = {
  gym(ctx, x, y, r) {
    ctx.fillStyle = '#e04040';
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#202020';
    ctx.fillRect(x - r, y - r * 0.12, r * 2, r * 0.24);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  },
  gymGrass(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.55, r, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y + r * 0.6);
    ctx.lineTo(x + r * 0.5, y - r * 0.5);
    ctx.stroke();
  },
  gymElectric(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    for (const [dx, dy] of [[0.2, -1], [-0.6, 0.15], [-0.05, 0.15], [-0.25, 1], [0.6, -0.2], [0.05, -0.2]]) ctx.lineTo(x + dx * r, y + dy * r);
    ctx.fill();
  },
  gymWater(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * 0.8, y + r * 0.1, x, y + r);
    ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.1, x, y - r);
    ctx.fill();
  },
  gymFire(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r, y, x + r * 0.5, y + r);
    ctx.lineTo(x - r * 0.5, y + r);
    ctx.quadraticCurveTo(x - r, y, x, y - r);
    ctx.fill();
    ctx.fillStyle = '#ffd040';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.45, r * 0.3, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  gymRock(ctx, x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    for (const [dx, dy] of [[-0.9, 0.7], [-0.6, -0.4], [0, -0.9], [0.7, -0.5], [0.9, 0.7]]) ctx.lineTo(x + dx * r, y + dy * r);
    ctx.fill();
  },
  gymPsychic(ctx, x, y, r, c) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) ctx.lineTo(x + Math.cos(a) * r * (a / (Math.PI * 5)), y + Math.sin(a) * r * (a / (Math.PI * 5)));
    ctx.stroke();
  },
  gymIce(ctx, x, y, r, c) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.stroke();
  },
};

// ---------- Cửa ra vào ----------

// Cửa ở mặt trước (mặt tường z = wallZ), giữa ô x. Trả về { setOpen(k) }: k = 0 đóng .. 1 mở hẳn.
//  cửa kính: hai cánh trượt sang hai bên, thu vào hốc tường; cửa gỗ: một cánh xoay trên bản lề, mở vào trong.
// Sau cánh cửa là lòng nhà tối (ban đêm sáng đèn vàng) để lúc mở nhìn thấy khoảng trống bên trong.
function addDoor(g, { x, wallZ, glass, trimMat, nightMats, w = 0.7, h = 1.02, y0 = 0.09 }) {
  const frame = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.12, 0.08), trimMat));
  frame.position.set(x, y0 + h / 2 + 0.01, wallZ + 0.02);
  const insideMat = new THREE.MeshLambertMaterial({ color: glass ? 0x6a5e50 : 0x2e2218, emissive: 0x000000 });
  nightMats.push({ mat: insideMat, color: 0xffb860, strength: 0.75 });
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(w, h), insideMat);
  inside.position.set(x, y0 + h / 2, wallZ + 0.062);
  g.add(frame, inside);

  if (glass) {
    const mat = new THREE.MeshLambertMaterial({ map: glassTexture(), emissive: 0x000000 });
    nightMats.push({ mat, color: 0xffd890, strength: 0.9 });
    // mỗi cánh neo ở mép ngoài, co lại về phía mép đó khi mở
    const leaves = [-1, 1].map((side) => {
      const geo = new THREE.BoxGeometry(w / 2, h, 0.03).translate((-side * w) / 4, 0, 0);
      const leaf = new THREE.Mesh(geo, mat);
      leaf.position.set(x + (side * w) / 2, y0 + h / 2, wallZ + 0.08);
      g.add(leaf);
      return leaf;
    });
    return {
      setOpen(k) {
        const s = Math.max(0.02, 1 - Math.min(1, Math.max(0, k)));
        for (const leaf of leaves) {
          leaf.scale.x = s;
          leaf.visible = k < 0.98;
        }
      },
    };
  }
  const pivot = new THREE.Group();
  pivot.position.set(x - w / 2, y0 + h / 2, wallZ + 0.085);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05).translate(w / 2, 0, 0), [trimMat, trimMat, trimMat, trimMat, new THREE.MeshLambertMaterial({ map: woodDoorTexture() }), trimMat]);
  leaf.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), lambert(0xe8c050));
  knob.position.set(w - 0.1, -0.02, 0.04);
  pivot.add(leaf, knob);
  g.add(pivot);
  return {
    setOpen(k) {
      // góc dương: mép tự do quay vào trong nhà (bị lòng nhà tối che dần)
      pivot.rotation.y = Math.min(1, Math.max(0, k)) * 1.75;
    },
  };
}

function addLamp(g, x, y, z) {
  const lamp = new THREE.PointLight(0xffb860, 0, 4.5, 1.6);
  lamp.position.set(x, y, z);
  g.add(lamp);
  return lamp;
}

// Cửa sổ sáng đèn vàng khi trời tối (dùng chung một vật liệu cho mỗi nhà)
function windowMaterial(nightMats) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xa8d8f8, emissive: 0x000000 });
  nightMats.push({ mat, color: 0xffc860, strength: 1 });
  return mat;
}

// Bồn hoa dưới cửa sổ tầng trên: hộp gỗ, lá xanh và vài bông đỏ / vàng
const flowerGeo = new THREE.IcosahedronGeometry(0.06, 0);
function flowerBox(x, y, z) {
  const g = new THREE.Group();
  const pot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.14), lambert(0x8a5a3a)));
  const leaves = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.1), lambert(0x4a9a48)));
  leaves.position.y = 0.07;
  g.add(pot, leaves);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(flowerGeo, lambert([0xe84848, 0xf8d040][i % 2]));
    f.position.set(-0.19 + i * 0.13, 0.11, 0.01);
    g.add(f);
  }
  g.position.set(x, y, z);
  return g;
}

// Lớp tuyết phủ (bản đồ tuyết)
const snowMat = lambert(0xdde5ee);

// ---------- Nhà mái ngói (nhà dân, Center, Mart, phòng thí nghiệm, tiệm xe đạp) ----------

function buildHouse(b, { nightMats, snow }) {
  const st = { ...(BUILDING_STYLE[b.type] ?? BUILDING_STYLE.house) };
  if (ROOF_VARIANT[b.roof]) {
    st.roof = ROOF_VARIANT[b.roof];
    if (b.type !== 'house') st.trim = shade(st.roof, 0.6);
  }
  const g = new THREE.Group();
  const w = b.w - 0.15;
  const d = b.h - 0.35;
  const front = b.y + b.h - 0.05;
  const cx = b.x + b.w / 2;
  const cz = front - d / 2;
  // Nhà 2 tầng (nhà người chơi): tường cao hơn, đai gỗ ngăn hai tầng, hai hàng cửa sổ
  const two = b.floors === 2;
  const H = two ? st.height * 1.55 : st.height;
  const wallMat = lambert(st.wall);
  const roofMat = lambert(st.roof);
  const trimMat = lambert(st.trim);

  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.14, d + 0.12), lambert(0x8a8a92)));
  base.position.set(cx, 0.07, cz);
  const walls = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat));
  walls.position.set(cx, H / 2, cz);
  g.add(base, walls);

  if (st.flatRoof) {
    const slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2), roofMat));
    slab.position.set(cx, H + 0.09, cz);
    if (snow) {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.06, d + 0.1), snowMat);
      cover.position.set(cx, H + 0.2, cz);
      cover.receiveShadow = true;
      g.add(cover);
    }
    const top = new THREE.Group();
    const panelMat = new THREE.MeshLambertMaterial({ color: 0x2a3e78, emissive: 0x0a1430 });
    const frameMat = lambert(0xc8ccd4);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const panel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.55), [frameMat, frameMat, panelMat, frameMat, frameMat, frameMat]));
        panel.rotation.x = -0.35;
        panel.position.set(cx - w / 2 + 0.6 + i * 0.95, H + 0.32, cz - d / 2 + 0.55 + j * 0.8);
        top.add(panel);
      }
    }
    const dish = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), lambert(0xd8dce0, { side: THREE.DoubleSide })));
    dish.rotation.x = Math.PI * 0.75;
    dish.position.set(cx + w * 0.3, H + 0.55, cz);
    const mast = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), trimMat));
    mast.position.set(cx + w * 0.3, H + 0.3, cz);
    g.add(slab, top, dish, mast);
  } else {
    // Mái hai mặt: đầu hồi tam giác cùng màu tường, hai tấm mái lợp ngói nhô ra ngoài
    const rh = Math.min(1.15, d * 0.4);
    const half = d / 2;
    const shape = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rh)]);
    const gableGeo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(Math.PI / 2);
    const gable = shadowed(new THREE.Mesh(gableGeo, wallMat));
    gable.position.set(cx, H, cz);
    g.add(gable);
    const L = w + 0.4;
    const over = 0.32;
    const slope = Math.hypot(half, rh) + over;
    const angle = Math.atan2(rh, half);
    for (const side of [1, -1]) {
      const tex = shingleTexture(st.roof);
      tex.repeat.set(L * 1.2, slope * 2.2);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(L, 0.09, slope), [roofMat, roofMat, mat, roofMat, roofMat, roofMat]));
      slab.rotation.x = angle * side;
      // tâm tấm mái: giữa đỉnh mái và mép mái (đã nhô ra)
      const mid = slope / 2;
      slab.position.set(cx, H + rh - Math.sin(angle) * mid + 0.05, cz + side * Math.cos(angle) * mid);
      if (snow) {
        // tuyết đọng dày trên mái, chừa mép ngói
        const cover = new THREE.Mesh(new THREE.BoxGeometry(L - 0.06, 0.07, slope - 0.14), snowMat);
        cover.position.set(0, 0.075, (side > 0 ? -1 : 1) * 0.03);
        cover.receiveShadow = true;
        slab.add(cover);
      }
      g.add(slab);
    }
    const ridge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(L + 0.04, 0.12, 0.16), snow ? snowMat : trimMat));
    ridge.position.set(cx, H + rh + 0.08, cz);
    g.add(ridge);
    if (st.chimney) {
      const ch = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.32), lambert(0x9a5a4a)));
      ch.position.set(cx + w * 0.28, H + 0.65, cz - d * 0.15);
      g.add(ch);
    }
  }

  // Cửa ra vào ở ô cửa, mặt trước
  const doorX = b.door.x + 0.5;
  const door = addDoor(g, { x: doorX, wallZ: front, glass: st.glassDoor, trimMat, nightMats });
  const step = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.3), lambert(0xb0b0b8)));
  step.position.set(doorX, 0.04, front + 0.15);
  g.add(step);

  // Cửa sổ dọc mặt trước (tránh cột có cửa ra vào), sáng đèn vàng khi trời tối.
  // Nhà 2 tầng: tầng dưới như nhà thường, tầng trên thêm một hàng cửa sổ (cả phía trên cửa ra vào) có bồn hoa
  const winMat = windowMaterial(nightMats);
  const winGeo = new THREE.BoxGeometry(0.5, 0.42, 0.05);
  const sillGeo = new THREE.BoxGeometry(0.62, 0.07, 0.12);
  const rows = two ? [st.height * 0.58, st.height + (H - st.height) * 0.5] : [H * 0.58];
  rows.forEach((wy, floor) => {
    for (let x = b.x; x < b.x + b.w; x++) {
      if (floor === 0 && Math.abs(x - b.door.x) < 1) continue;
      if (st.bike && x === b.x + b.w - 1) continue; // chỗ dựng xe đạp
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(x + 0.5, wy, front + 0.02);
      const sill = new THREE.Mesh(sillGeo, trimMat);
      sill.position.set(x + 0.5, wy - 0.24, front + 0.05);
      g.add(win, sill);
      if (floor === 1) g.add(flowerBox(x + 0.5, wy - 0.3, front + 0.1));
    }
    // Cửa sổ hai bên hông
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.5), winMat);
      win.position.set(cx + side * (w / 2 + 0.01), wy, cz);
      g.add(win);
    }
  });
  if (two) {
    // Đai gỗ chạy quanh nhà ở ranh giới hai tầng
    const band = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.1, d + 0.08), trimMat));
    band.position.set(cx, st.height + 0.02, cz);
    g.add(band);
  }

  if (st.plaque) {
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), [trimMat, trimMat, trimMat, trimMat, new THREE.MeshLambertMaterial({ map: plaqueTexture(st.plaque, st.roof) }), trimMat]);
    plaque.position.set(doorX, 1.42, front + 0.04);
    g.add(plaque);
  }
  if (st.sign) {
    // Biển hiệu dựng trên mái trước (dưới mái hiên thì camera nhìn từ trên cao bị mái che mất)
    const rh = Math.min(1.15, d * 0.4);
    const zOff = d * 0.22;
    const roofY = H + rh * (1 - zOff / (d / 2)) + 0.08; // mặt mái trước tại chỗ dựng biển
    const tex = signTexture(st.sign, { fg: hex(st.trim), border: hex(st.trim) });
    const sign = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 0.06), [trimMat, trimMat, trimMat, trimMat, new THREE.MeshLambertMaterial({ map: tex }), trimMat]));
    sign.position.set(cx, roofY + 0.3, cz + zOff);
    const legGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, trimMat);
      leg.position.set(cx + side * 0.5, roofY + 0.05, cz + zOff - 0.03);
      g.add(leg);
    }
    g.add(sign);
  }
  if (st.bike) g.add(buildBike(b.x + b.w - 0.55, front + 0.16, st.roof));

  return { group: g, lamp: addLamp(g, doorX, 1.3, front + 0.6), door };
}

// Xe đạp dựng sát tường (tiệm xe đạp)
function buildBike(x, z, color) {
  const g = new THREE.Group();
  const tire = lambert(0x2a2a2e);
  const frame = lambert(color);
  for (const dx of [-0.2, 0.2]) {
    const wheel = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 5, 14), tire));
    wheel.position.set(dx, 0.15, 0);
    g.add(wheel);
  }
  const bar = (len, px, py, rz) => {
    const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.03), frame));
    m.position.set(px, py, 0);
    m.rotation.z = rz;
    g.add(m);
  };
  bar(0.36, 0, 0.3, 0);
  bar(0.24, -0.1, 0.22, 1.0);
  bar(0.24, 0.12, 0.22, -1.1);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.05), tire);
  seat.position.set(-0.08, 0.36, 0);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.18), tire);
  handle.position.set(0.17, 0.38, 0);
  g.add(seat, handle);
  g.position.set(x, 0, z);
  g.rotation.y = 0.1;
  return g;
}

// ---------- Gym: tường sáng, sảnh có mái hiên và hai cột, mái vòm màu theo hệ, biển GYM ----------

function buildGym(b, { nightMats, snow }) {
  const key = ROOF_VARIANT[b.roof] && b.roof.startsWith('gym') ? b.roof : 'gym';
  const accent = ROOF_VARIANT[key];
  const g = new THREE.Group();
  const w = b.w - 0.15;
  const d = b.h - 0.35;
  const front = b.y + b.h - 0.05;
  const porch = 0.45; // tường lùi vào, chừa sảnh trước cửa
  const wallZ = front - porch;
  const cx = b.x + b.w / 2;
  const cz = front - d / 2;
  const H = 1.95;
  const wallMat = lambert(0xf0ece4);
  const accentMat = lambert(accent);
  const darkMat = lambert(shade(accent, 0.55));
  const stoneMat = lambert(0xa8a8b0);

  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.12, d + 0.12), lambert(0x8a8a92)));
  base.position.set(cx, 0.06, cz);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, porch + 0.05), stoneMat);
  floor.position.set(cx, 0.13, front - porch / 2);
  floor.receiveShadow = true;
  const dw = d - porch;
  const walls = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, H, dw), wallMat));
  walls.position.set(cx, H / 2, wallZ - dw / 2);
  // chân tường sẫm, dải màu hệ chạy quanh đỉnh tường (cả xà ngang trước sảnh)
  const skirt = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.3, dw + 0.04), darkMat));
  skirt.position.set(cx, 0.15, wallZ - dw / 2);
  const band = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.3, d + 0.08), accentMat));
  band.position.set(cx, H - 0.1, cz);
  g.add(base, floor, walls, skirt, band);
  // cột góc sảnh
  for (const side of [-1, 1]) {
    const col = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.26, H, 0.26), darkMat));
    col.position.set(cx + side * (w / 2 - 0.1), H / 2, front - 0.1);
    const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.26, H, 0.26), darkMat));
    back.position.set(cx + side * (w / 2 - 0.1), H / 2, front - d + 0.1);
    g.add(col, back);
  }

  // Mái vòm: nửa ống trụ dẹt chạy dọc chiều ngang nhà, có gân
  const r = d / 2 + 0.22;
  const flat = 0.5;
  const tex = panelTexture(accent);
  tex.repeat.set(8, 4);
  const vaultGeo = new THREE.CylinderGeometry(r, r, w + 0.3, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
  const vault = shadowed(new THREE.Mesh(vaultGeo, [new THREE.MeshLambertMaterial({ map: tex }), wallMat, wallMat]));
  vault.scale.y = flat;
  vault.position.set(cx, H + 0.05, cz);
  g.add(vault);
  const ribGeo = new THREE.TorusGeometry(r + 0.015, 0.045, 4, 16, Math.PI).rotateY(Math.PI / 2);
  for (let i = -2; i <= 2; i++) {
    const rib = shadowed(new THREE.Mesh(ribGeo, darkMat));
    rib.scale.y = flat;
    rib.position.set(cx + (i * (w + 0.1)) / 4, H + 0.05, cz);
    g.add(rib);
  }
  if (snow) {
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.05, r + 0.05, w + 0.2, 16, 1, true, Math.PI * 0.18, Math.PI * 0.64).rotateZ(Math.PI / 2), snowMat);
    cover.scale.y = flat;
    cover.position.set(cx, H + 0.06, cz);
    cover.receiveShadow = true;
    g.add(cover);
  }
  // Quả cầu Poké Ball trên đỉnh đầu hồi trước
  const ball = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), [lambert(0xe04040)]));
  const ballGeo = ball.geometry;
  // nửa trên đỏ, nửa dưới trắng: tô theo đỉnh
  const colors = [];
  const pos = ballGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const c = Math.abs(y) < 0.025 ? [0.1, 0.1, 0.1] : y > 0 ? [0.9, 0.22, 0.22] : [0.95, 0.95, 0.95];
    colors.push(...c);
  }
  ballGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  ball.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  ball.position.set(cx, H + r * flat + 0.2, cz);
  g.add(ball);

  // Biển GYM có biểu tượng hệ, gắn trên xà trước sảnh
  const signTex = signTexture('GYM', { fg: hex(shade(accent, 0.5)), border: hex(shade(accent, 0.5)), w: 160, h: 48, font: 'bold 34px Nunito, Arial, sans-serif', icon: (ctx, x, y, rr) => GYM_ICON[key](ctx, x, y, rr, hex(shade(accent, 0.75))) });
  // treo ngay dưới xà (cao hơn thì vòm mái nhô ra che mất khi nhìn từ trên xuống)
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.46, 0.08), [darkMat, darkMat, darkMat, darkMat, new THREE.MeshLambertMaterial({ map: signTex }), darkMat]);
  sign.position.set(cx, H - 0.33, front + 0.09);
  g.add(sign);

  // Cửa kính đôi trên tường lùi, cửa sổ cao hai bên
  const doorX = b.door.x + 0.5;
  const trimMat = darkMat;
  const door = addDoor(g, { x: doorX, wallZ, glass: true, trimMat, nightMats, w: 0.86, h: 1.12, y0: 0.15 });
  const winMat = windowMaterial(nightMats);
  for (const x of [b.x + 0.75, b.x + b.w - 0.75]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.05), winMat);
    win.position.set(x, 0.95, wallZ + 0.02);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.95, 0.03), darkMat);
    frame.position.set(x, 0.95, wallZ + 0.005);
    g.add(frame, win);
  }
  for (const side of [-1, 1]) {
    for (const t of [-0.25, 0.25]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.5), winMat);
      win.position.set(cx + side * (w / 2 + 0.01), 1.0, wallZ - dw / 2 + t * dw);
      g.add(win);
    }
  }
  // Hai bệ tượng hai bên cửa: quả cầu màu hệ trên bệ đá
  const orbMat = new THREE.MeshLambertMaterial({ color: accent, emissive: 0x000000, flatShading: true });
  nightMats.push({ mat: orbMat, color: accent, strength: 0.35 });
  for (const side of [-1, 1]) {
    const ped = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.3), stoneMat));
    ped.position.set(doorX + side * 0.85, 0.21 + 0.13, front - 0.22);
    const cap = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.36), lambert(0xc8c8d0)));
    cap.position.set(doorX + side * 0.85, 0.58, front - 0.22);
    const orb = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), orbMat));
    orb.position.set(doorX + side * 0.85, 0.76, front - 0.22);
    g.add(ped, cap, orb);
  }
  return { group: g, lamp: addLamp(g, doorX, 1.35, front + 0.3), door };
}

// ---------- Trung tâm thương mại: nhà hai tầng mái bằng, biển SHOP lớn, mái hiên sọc cam ----------

function buildStore(b, { nightMats, snow }) {
  const g = new THREE.Group();
  const w = b.w - 0.15;
  const d = b.h - 0.35;
  const front = b.y + b.h - 0.05;
  const cx = b.x + b.w / 2;
  const cz = front - d / 2;
  const H = 2.75;
  const orange = 0xe07830;
  const wallMat = lambert(0xf4ece0);
  const orangeMat = lambert(orange);
  const darkMat = lambert(0xb05818);

  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.14, d + 0.12), lambert(0x8a8a92)));
  base.position.set(cx, 0.07, cz);
  const walls = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat));
  walls.position.set(cx, H / 2, cz);
  // gờ giữa hai tầng, mái bằng có lan can
  const floorBand = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.12, d + 0.06), orangeMat));
  floorBand.position.set(cx, 1.45, cz);
  const roof = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.14, d + 0.16), darkMat));
  roof.position.set(cx, H + 0.07, cz);
  g.add(base, walls, floorBand, roof);
  const parapetGeo = new THREE.BoxGeometry(w + 0.16, 0.22, 0.08);
  for (const side of [-1, 1]) {
    const p = shadowed(new THREE.Mesh(parapetGeo, darkMat));
    p.position.set(cx, H + 0.25, cz + side * (d / 2 + 0.04));
    const q = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, d + 0.16), darkMat));
    q.position.set(cx + side * (w / 2 + 0.04), H + 0.25, cz);
    g.add(p, q);
  }
  if (snow) {
    const cover = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), snowMat);
    cover.position.set(cx, H + 0.17, cz);
    g.add(cover);
  }
  // Trên sân thượng: bồn nước, máy lạnh
  const tank = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10), lambert(0xc8ccd0)));
  tank.position.set(cx - w * 0.28, H + 0.4, cz - d * 0.15);
  const ac = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), lambert(0xd8d8dc)));
  ac.position.set(cx + w * 0.25, H + 0.29, cz - d * 0.1);
  g.add(tank, ac);

  // Biển SHOP to trên tầng hai
  const signTex = signTexture('SHOP', { bg: '#ffffff', fg: '#c05818', border: '#c05818', w: 160, h: 48, font: 'bold 36px Nunito, Arial, sans-serif' });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.08), [darkMat, darkMat, darkMat, darkMat, new THREE.MeshLambertMaterial({ map: signTex }), darkMat]);
  sign.position.set(cx, H - 0.38, front + 0.05);
  g.add(sign);
  // Cửa sổ tầng hai (dải kính), tầng trệt
  const winMat = windowMaterial(nightMats);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.4, 0.05), winMat);
  upper.position.set(cx, 1.85, front + 0.02);
  g.add(upper);
  const doorX = b.door.x + 0.5;
  for (let x = b.x; x < b.x + b.w; x++) {
    if (Math.abs(x - b.door.x) < 1) continue;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.62, 0.05), winMat);
    win.position.set(x + 0.5, 0.72, front + 0.02);
    g.add(win);
  }
  for (const side of [-1, 1]) {
    for (const y of [0.8, 1.9]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, d * 0.6), winMat);
      win.position.set(cx + side * (w / 2 + 0.01), y, cz);
      g.add(win);
    }
  }
  // Mái hiên vải sọc cam trắng chạy dọc mặt trước tầng trệt
  const { canvas, ctx } = makeCanvas(16, 4);
  for (let i = 0; i < 16; i += 4) {
    ctx.fillStyle = '#e07830';
    ctx.fillRect(i, 0, 2, 4);
    ctx.fillStyle = '#fff4e8';
    ctx.fillRect(i + 2, 0, 2, 4);
  }
  const stripes = pixelTexture(canvas);
  stripes.wrapS = THREE.RepeatWrapping;
  stripes.repeat.set(w / 1.2, 1);
  const awnMat = new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide });
  const awning = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, 0.48), awnMat));
  awning.rotation.x = -Math.PI / 2 + 0.55;
  awning.position.set(cx, 1.26, front + 0.2);
  g.add(awning);

  const door = addDoor(g, { x: doorX, wallZ: front, glass: true, trimMat: darkMat, nightMats, w: 0.76, h: 1.0 });
  const step = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.3), lambert(0xb0b0b8)));
  step.position.set(doorX, 0.04, front + 0.15);
  g.add(step);
  return { group: g, lamp: addLamp(g, doorX, 1.2, front + 0.6), door };
}

// ---------- Toà nhà Liên minh: nền đá, hàng cột trắng, mái vàng bốn mái, vọm tím, cờ tím hai bên ----------

function buildLeague(b, { nightMats }) {
  const g = new THREE.Group();
  const w = b.w - 0.15;
  const d = b.h - 0.35;
  const front = b.y + b.h - 0.05;
  const porch = 0.55;
  const wallZ = front - porch;
  const cx = b.x + b.w / 2;
  const cz = front - d / 2;
  const H = 2.3;
  const stone = lambert(0xf2ead8);
  const stoneDark = lambert(0xc8bca8);
  const gold = lambert(0xd8a830);
  const purple = lambert(0x7a48b8);

  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.12, d + 0.24), stoneDark));
  base.position.set(cx, 0.06, cz - 0.06);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.04, porch), lambert(0xe0d8c8));
  floor.position.set(cx, 0.13, front - porch / 2);
  floor.receiveShadow = true;
  // thảm tím từ cửa ra tới mép sảnh
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, porch + 0.3), purple);
  carpet.position.set(b.door.x + 0.5, 0.15, front - porch / 2 + 0.15);
  carpet.receiveShadow = true;
  const dw = d - porch;
  const walls = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, H, dw), stone));
  walls.position.set(cx, H / 2, wallZ - dw / 2);
  g.add(base, floor, carpet, walls);
  // Hàng cột trắng có đế và đầu cột vàng
  const colGeo = new THREE.CylinderGeometry(0.11, 0.13, H - 0.25, 10);
  const capGeo = new THREE.BoxGeometry(0.3, 0.1, 0.3);
  const doorX = b.door.x + 0.5;
  for (const off of [-3.2, -2.15, -1.05, 1.05, 2.15, 3.2]) {
    const x = doorX + off * (w / 6.85);
    const col = shadowed(new THREE.Mesh(colGeo, stone));
    col.position.set(x, 0.15 + (H - 0.25) / 2, front - 0.18);
    const top = shadowed(new THREE.Mesh(capGeo, gold));
    top.position.set(x, H - 0.05, front - 0.18);
    const foot = shadowed(new THREE.Mesh(capGeo, stoneDark));
    foot.position.set(x, 0.2, front - 0.18);
    g.add(col, top, foot);
  }
  // Xà ngang (diềm mái) có biển LEAGUE
  const beam = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.36, d + 0.1), stone));
  beam.position.set(cx, H + 0.18, cz);
  const trim = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w + 0.26, 0.08, d + 0.16), gold));
  trim.position.set(cx, H + 0.38, cz);
  g.add(beam, trim);
  const signTex = signTexture('LEAGUE', { bg: '#fff8e0', fg: '#7a48b8', border: '#d8a830', w: 192, h: 40, font: 'bold 30px Nunito, Arial, sans-serif' });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.34, 0.06), [gold, gold, gold, gold, new THREE.MeshLambertMaterial({ map: signTex }), gold]);
  sign.position.set(cx, H + 0.18, front + 0.09);
  g.add(sign);
  // Mái vàng bốn mái lợp ngói
  const rh = 1.0;
  const roofTex = shingleTexture(0xd8a830);
  roofTex.repeat.set(6, 3);
  const roofGeo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const roof = shadowed(new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ map: roofTex, flatShading: true })));
  roof.scale.set(w + 0.45, rh, d + 0.4);
  roof.position.set(cx, H + 0.42, cz);
  g.add(roof);
  // Tháp nhỏ giữa mái: thân trụ, vòm tím, chóp vàng
  const drum = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 12), stone));
  drum.position.set(cx, H + rh + 0.3, cz);
  const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), purple));
  dome.position.set(cx, H + rh + 0.55, cz);
  const spire = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 6), gold));
  spire.position.set(cx, H + rh + 1.18, cz);
  g.add(drum, dome, spire);
  // Cờ tím hai góc nhà, bay phấp phới
  const flags = [];
  const flagGeo = new THREE.PlaneGeometry(0.5, 0.3, 6, 1).translate(0.25, 0, 0);
  const flagMat = lambert(0x7a48b8, { side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5), lambert(0x3a2a20)));
    const px = cx + side * (w / 2 - 0.1);
    pole.position.set(px, H + 0.42 + 0.65, cz + d / 2 - 0.25);
    const flag = shadowed(new THREE.Mesh(flagGeo.clone(), flagMat));
    flag.position.set(px, H + 0.42 + 1.12, cz + d / 2 - 0.25);
    g.add(pole, flag);
    flags.push({ flag, base: flag.geometry.attributes.position.array.slice() });
  }
  // Cửa kính đôi lớn, cửa sổ vòm cao trên tường
  const door = addDoor(g, { x: doorX, wallZ, glass: true, trimMat: gold, nightMats, w: 1.0, h: 1.3, y0: 0.15 });
  const winMat = windowMaterial(nightMats);
  for (const off of [-2.65, -1.6, 1.6, 2.65]) {
    const x = doorX + off * (w / 6.85);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.05), winMat);
    win.position.set(x, 1.05, wallZ + 0.02);
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), winMat);
    arch.position.set(x, 1.5, wallZ + 0.02);
    g.add(win, arch);
  }
  return {
    group: g,
    lamp: addLamp(g, doorX, 1.5, front + 0.4),
    door,
    update(t) {
      for (const { flag, base } of flags) {
        const p = flag.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = base[i * 3];
          p.setZ(i, Math.sin(t * 4 - x * 7) * 0.06 * x * 2);
        }
        p.needsUpdate = true;
      }
    },
  };
}

const BUILDERS = { gym: buildGym, store: buildStore, league: buildLeague };

// opts: { nightMats, snow }
export function buildBuilding(b, opts) {
  return (BUILDERS[b.type] ?? buildHouse)(b, opts);
}
