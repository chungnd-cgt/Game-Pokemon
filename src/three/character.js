import * as THREE from 'three';
import { LOOKS } from '../data/characterLooks.js';

// Nhân vật 3D kiểu chibi, tô màu cel-shading (toon) + viền đen mảnh.
// Màu da, tóc, mũ, áo, quần, giày... lấy đúng bảng màu nhân vật của bản 2D (gfx/player.js: LOOKS),
// nên mỗi NPC trong game tự có mô hình 3D tương ứng.

const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([105, 160, 215, 255]), 4, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

// Vật liệu / hình dùng chung giữa nhiều mô hình: đánh dấu để disposeModel không giải phóng
export function shared(resource) {
  resource.userData.shared = true;
  return resource;
}

// Giải phóng bộ nhớ GPU của một mô hình đã gỡ khỏi cảnh (hình và vật liệu riêng; texture mặt dùng chung thì giữ)
export function disposeModel(root) {
  const done = new Set();
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared && !done.has(o.geometry)) {
      done.add(o.geometry);
      o.geometry.dispose();
    }
    for (const m of [].concat(o.material ?? [])) {
      if (m.userData.shared || done.has(m)) continue;
      done.add(m);
      m.dispose();
    }
  });
}

const matCache = new Map();
function toon(color) {
  const key = String(color);
  if (!matCache.has(key)) matCache.set(key, shared(new THREE.MeshToonMaterial({ color, gradientMap })));
  return matCache.get(key);
}
const OUTLINE = shared(new THREE.MeshBasicMaterial({ color: 0x1e1828, side: THREE.BackSide }));

// Mặt kiểu anime vẽ lên texture của quả cầu đầu: mắt to có tròng và đốm sáng, lông mày, miệng cười, má hồng.
// Quả cầu: u = 0.25 là chính diện (+z), v = 0.5 là xích đạo -> trên canvas 512x256 mặt nằm quanh (128, 136).
const faceCache = new Map();
function faceTexture(look) {
  const key = `${look.skin}|${look.hair}|${look.hairStyle}|${look.eyes ?? ''}`;
  if (faceCache.has(key)) return faceCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = look.skin;
  ctx.fillRect(0, 0, 512, 256);
  const cx = 128;
  const eyeY = 138;
  const brow = new THREE.Color(look.hair).multiplyScalar(0.7).getStyle();
  // má hồng
  ctx.fillStyle = 'rgba(244, 140, 150, 0.45)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * 44, 166, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  if (look.hairStyle === 'old') {
    // ông lão: mắt híp cười
    ctx.strokeStyle = '#2a2030';
    ctx.lineWidth = 4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * 27, eyeY + 4, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      const ex = cx + s * 27;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 11, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // tròng mắt: nâu sẫm (hoặc màu mắt người chơi tự chọn), nửa dưới sáng hơn
      const iris = ctx.createLinearGradient(0, eyeY - 14, 0, eyeY + 14);
      iris.addColorStop(0, look.eyes ? new THREE.Color(look.eyes).multiplyScalar(0.45).getStyle() : '#2a1a20');
      iris.addColorStop(1, look.eyes ? new THREE.Color(look.eyes).lerp(new THREE.Color(0xffffff), 0.15).getStyle() : '#7a4a38');
      ctx.fillStyle = iris;
      ctx.beginPath();
      ctx.ellipse(ex + s * 1, eyeY + 1, 8.5, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#140c14';
      ctx.beginPath();
      ctx.ellipse(ex + s * 1, eyeY + 2, 4.5, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 3, eyeY - 6, 3.6, 0, Math.PI * 2);
      ctx.arc(ex + 3.5, eyeY + 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // mi trên dày
      ctx.strokeStyle = '#1e1420';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY + 1, 12, 17, 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      // lông mày
      ctx.strokeStyle = brow;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(ex, eyeY - 6, 16, Math.PI * 1.3, Math.PI * 1.7);
      ctx.stroke();
    }
  }
  // miệng cười
  ctx.strokeStyle = '#8a3040';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, 166, 7, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  faceCache.set(key, tex);
  return tex;
}

// Khối có viền: thêm một bản sao phóng to, chỉ vẽ mặt sau, màu đen (inverted hull)
function part(geo, color, { outline = 0.018, shadow = true } = {}) {
  const mesh = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : toon(color));
  mesh.castShadow = shadow;
  if (outline) {
    const hull = new THREE.Mesh(geo, OUTLINE);
    geo.computeBoundingSphere();
    const r = geo.boundingSphere.radius || 0.1;
    hull.scale.setScalar(1 + outline / r);
    hull.position.copy(geo.boundingSphere.center).multiplyScalar(-(outline / r));
    mesh.add(hull);
  }
  return mesh;
}

function at(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

const sphere = (r, ws = 18, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);

function buildHair(head, look) {
  const hair = look.hair;
  const R = 0.25;
  // Tóc mai ôm hai bên má (trừ ông lão hói)
  if (look.hairStyle !== 'old') {
    for (const s of [-1, 1]) {
      const lock = part(capsule(0.05, 0.12), hair, { outline: 0.008 });
      lock.rotation.z = s * 0.12;
      head.add(at(lock, s * 0.205, -0.04, 0.07));
    }
  }
  // Mái tóc trùm đỉnh và sau đầu, chừa trán phía trước
  const cap = (color, theta = 0.55, tilt = -0.42, r = R) => {
    const m = part(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI * theta), color, { outline: 0.012 });
    m.rotation.x = tilt;
    return m;
  };
  const fringe = (color) => {
    const g = new THREE.Group();
    for (const [x, rot] of [[-0.11, 0.35], [0, 0], [0.11, -0.35]]) {
      const lock = part(new THREE.ConeGeometry(0.06, 0.12, 5), color, { outline: 0 });
      lock.rotation.set(Math.PI + 0.5, 0, rot);
      g.add(at(lock, x, 0.15, 0.17));
    }
    return g;
  };
  switch (look.hairStyle) {
    case 'cap': {
      head.add(cap(hair, 0.62, -0.75, R + 0.005));
      // mũ đội lệch ra sau, lưỡi trai ngắn hếch lên để nhìn từ trên vẫn thấy mặt
      const hat = cap(look.hat, 0.38, -0.5, R + 0.02);
      const brim = part(new THREE.CylinderGeometry(0.13, 0.13, 0.022, 20), look.hat, { outline: 0.01 });
      brim.scale.set(1.1, 1, 0.9);
      brim.rotation.x = -0.35;
      const logo = part(new THREE.SphereGeometry(0.045, 10, 8), look.hatAccent ?? 0xffffff, { outline: 0 });
      logo.scale.set(1, 1, 0.4);
      head.add(hat, at(brim, 0, 0.2, 0.2), at(logo, 0, 0.22, 0.13));
      break;
    }
    case 'sunhat': {
      head.add(cap(hair, 0.6, -0.6));
      const back = part(capsule(0.17, 0.2), hair, { outline: 0.012 });
      back.scale.set(1.25, 1, 0.6);
      head.add(at(back, 0, -0.14, -0.13));
      const brim = part(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 28), look.hat, { outline: 0.008 });
      brim.rotation.x = 0.12;
      const crown = part(new THREE.CylinderGeometry(0.2, 0.23, 0.17, 20), look.hat, { outline: 0.01 });
      const band = part(new THREE.CylinderGeometry(0.232, 0.232, 0.05, 20), look.hatAccent, { outline: 0 });
      head.add(at(brim, 0, 0.16, 0.02), at(crown, 0, 0.25, 0), at(band, 0, 0.2, 0));
      head.add(fringe(hair));
      break;
    }
    case 'long':
    case 'nurse': {
      head.add(cap(hair), fringe(hair));
      const back = part(capsule(0.18, 0.22), hair, { outline: 0.012 });
      back.scale.set(1.3, 1, 0.6);
      head.add(at(back, 0, -0.16, -0.13));
      if (look.hairStyle === 'nurse') {
        for (const s of [-1, 1]) head.add(at(part(sphere(0.09), hair, { outline: 0.01 }), s * 0.25, -0.1, -0.05));
        const hat = part(new THREE.BoxGeometry(0.26, 0.11, 0.12), 0xffffff, { outline: 0.008 });
        const cross = part(new THREE.BoxGeometry(0.07, 0.07, 0.01), 0xe04860, { outline: 0 });
        hat.add(at(cross, 0, 0, 0.065));
        hat.rotation.x = -0.3;
        head.add(at(hat, 0, 0.25, 0.06));
      }
      break;
    }
    case 'beanie': {
      // mũ len trùm đầu, gấu mũ màu nhấn, quả bông trên đỉnh
      head.add(cap(hair, 0.62, -0.75, R + 0.005));
      head.add(cap(look.hat, 0.42, -0.3, R + 0.025));
      const cuff = part(new THREE.TorusGeometry(R * 0.86, 0.035, 6, 24), look.hatAccent ?? 0xffffff, { outline: 0.008 });
      cuff.rotation.x = Math.PI / 2 - 0.3;
      head.add(at(cuff, 0, 0.12, -0.03));
      head.add(at(part(sphere(0.07), look.hatAccent ?? 0xffffff, { outline: 0.008 }), 0, 0.29, -0.06));
      break;
    }
    case 'ponytail': {
      head.add(cap(hair), fringe(hair));
      const tie = part(sphere(0.045), 0xe83850, { outline: 0 });
      const tail = part(capsule(0.065, 0.22), hair, { outline: 0.01 });
      tail.rotation.x = 0.35;
      head.add(at(tie, 0, 0.12, -0.24), at(tail, 0, -0.06, -0.29));
      break;
    }
    case 'bun':
      head.add(cap(hair), fringe(hair), at(part(sphere(0.11), hair, { outline: 0.01 }), 0, 0.2, -0.17));
      break;
    case 'old':
      // Hói đỉnh, tóc bạc hai bên và sau gáy, ria mép
      for (const s of [-1, 1]) {
        const side = part(sphere(0.11), hair, { outline: 0.01 });
        side.scale.set(0.8, 1, 1.2);
        head.add(at(side, s * 0.2, -0.02, -0.06));
      }
      head.add(at(part(sphere(0.14), hair, { outline: 0.01 }), 0, -0.02, -0.17));
      head.add(at(part(new THREE.BoxGeometry(0.16, 0.035, 0.04), hair, { outline: 0 }), 0, -0.1, 0.225));
      break;
    case 'spiky': {
      head.add(cap(hair, 0.58, -0.5));
      for (let i = 0; i < 7; i++) {
        const a = -1.2 + (i / 6) * 2.4;
        const spike = part(new THREE.ConeGeometry(0.075, 0.22, 5), hair, { outline: 0.008 });
        spike.position.set(Math.sin(a) * 0.17, 0.17 + Math.cos(a) * 0.05, -Math.cos(a) * 0.08 - 0.02);
        spike.rotation.set(-0.9, 0, -a * 0.9);
        head.add(spike);
      }
      head.add(fringe(hair));
      break;
    }
    default:
      head.add(cap(hair), fringe(hair));
  }
}

// Tạo mô hình cho một kiểu nhân vật ('player', 'npc-oldman'...). Trả về { root, pose(walk, idle) }.
export function buildCharacter(key) {
  const look = LOOKS[key] ?? LOOKS['npc-boy'];
  const root = new THREE.Group();
  const body = new THREE.Group(); // nhún lên xuống khi đi
  root.add(body);

  const top = look.coat ?? look.shirt;
  // váy / quần short: chân để trần (quần short vẽ thêm ống ngắn trên đùi)
  const legColor = look.dress || look.shorts ? look.skin : look.pants;

  // Chân: khớp ở hông, quay quanh trục x khi bước
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.075, 0.36, 0);
    pivot.add(at(part(capsule(0.052, 0.18), legColor), 0, -0.14, 0));
    if (look.shorts && !look.dress) pivot.add(at(part(new THREE.CylinderGeometry(0.068, 0.064, 0.12, 12), look.pants, { outline: 0.01 }), 0, -0.04, 0));
    const shoe = part(new THREE.BoxGeometry(0.11, 0.07, 0.17), look.shoes, { outline: 0.012 });
    pivot.add(at(shoe, 0, -0.32, 0.025));
    body.add(pivot);
    return pivot;
  });

  // Thân, thắt lưng, váy
  const torso = part(capsule(0.14, 0.12), top);
  torso.scale.set(1, 1, 0.82);
  body.add(at(torso, 0, 0.55, 0));
  if (look.coat) {
    const shirt = part(new THREE.BoxGeometry(0.1, 0.2, 0.05), look.shirt, { outline: 0 });
    body.add(at(shirt, 0, 0.57, 0.11));
  }
  if (look.belt) {
    const belt = part(new THREE.CylinderGeometry(0.145, 0.145, 0.035, 18), look.belt, { outline: 0 });
    belt.scale.z = 0.85;
    body.add(at(belt, 0, 0.44, 0));
  }
  if (look.dress) {
    const skirt = part(new THREE.CylinderGeometry(0.13, 0.23, 0.2, 18), look.skirt ?? look.pants, { outline: 0.012 });
    body.add(at(skirt, 0, 0.38, 0));
  }
  if (look.backpack) {
    const pack = part(new THREE.BoxGeometry(0.22, 0.24, 0.12), look.backpack, { outline: 0.012 });
    body.add(at(pack, 0, 0.56, -0.15));
  }
  if (look.bag) {
    const bag = part(new THREE.BoxGeometry(0.06, 0.13, 0.15), look.bag, { outline: 0.01 });
    body.add(at(bag, 0.17, 0.42, 0.02));
    const strap = part(new THREE.TorusGeometry(0.17, 0.012, 4, 20), look.bag, { outline: 0 });
    strap.rotation.set(0, Math.PI / 2, 0.75);
    body.add(at(strap, 0.01, 0.57, 0));
  }

  // Tay: khớp ở vai
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.18, 0.65, 0);
    pivot.rotation.z = s * 0.12;
    // áo ba lỗ (tank): cánh tay để trần
    pivot.add(at(part(capsule(0.042, 0.15), look.tank ? look.skin : top), 0, -0.11, 0));
    pivot.add(at(part(sphere(0.05, 10, 8), look.gloves ?? look.skin, { outline: 0.01 }), 0, -0.23, 0));
    body.add(pivot);
    return pivot;
  });

  // Đầu to kiểu chibi: mắt to có đốm sáng, má hồng
  const head = new THREE.Group();
  head.position.set(0, 0.9, 0);
  const skull = part(sphere(0.245, 32, 24), new THREE.MeshToonMaterial({ map: faceTexture(look), gradientMap }), { outline: 0.016 });
  skull.scale.set(1, 0.95, 0.95);
  head.add(skull);
  // tai nhỏ hai bên
  for (const s of [-1, 1]) head.add(at(part(sphere(0.045, 10, 8), look.skin, { outline: 0.008 }), s * 0.235, -0.03, 0));
  buildHair(head, look);
  body.add(head);

  root.traverse((o) => {
    if (o.isMesh && o.material !== OUTLINE) o.castShadow = true;
  });

  // walk: pha bước (radian, mỗi bước = nửa vòng), moving: 0..1 độ mạnh, time: giây (thở khi đứng yên)
  return {
    root,
    head,
    // mode: 'walk' đi bộ • 'bike' đạp xe (chân đạp vòng tròn, tay vịn ghi đông) • 'sit' ngồi trên lưng thú / khối nước
    //       'seat' ngồi trên ghế sofa • 'cheer' vẫy tay chào (màn chọn nhân vật)
    pose(walk, moving, time, mode = 'walk') {
      const breathe = Math.sin(time * 2.2) * 0.012 * (mode === 'walk' ? 1 - moving : 1);
      torso.scale.y = 1 + breathe;
      head.position.y = 0.9 + breathe * 0.6;
      if (mode === 'bike') {
        const pedal = Math.sin(walk * 1.5);
        legs[0].rotation.set(-0.55 + pedal * 0.45, 0, 0.06);
        legs[1].rotation.set(-0.55 - pedal * 0.45, 0, -0.06);
        arms[0].rotation.set(-1.05, 0, -0.18);
        arms[1].rotation.set(-1.05, 0, 0.18);
        body.position.y = 0;
        body.rotation.x = 0.18; // ngả người về trước
        head.rotation.z = 0;
        return;
      }
      if (mode === 'seat') {
        // Ngồi trên ghế: chân duỗi ra trước trên đệm, tay đặt lên đùi, ngả lưng nhẹ, thỉnh thoảng nghiêng đầu
        legs[0].rotation.set(-1.42, 0, -0.06);
        legs[1].rotation.set(-1.42, 0, 0.06);
        arms[0].rotation.set(-0.75, 0, -0.15);
        arms[1].rotation.set(-0.75, 0, 0.15);
        body.position.y = 0;
        body.rotation.x = -0.04;
        head.rotation.z = Math.sin(time * 0.7) * 0.05;
        return;
      }
      if (mode === 'cheer') {
        // Vẫy tay chào (màn chọn nhân vật): nhún nhẹ, tay phải giơ cao vẫy qua lại
        const bob = Math.abs(Math.sin(time * 5));
        legs[0].rotation.set(0, 0, 0);
        legs[1].rotation.set(0, 0, 0);
        arms[0].rotation.set(0, 0, -0.15);
        arms[1].rotation.set(0, 0, 2.5 + Math.sin(time * 9) * 0.35);
        body.position.y = bob * 0.04;
        body.rotation.x = 0;
        head.rotation.z = Math.sin(time * 4.5) * 0.08;
        return;
      }
      if (mode === 'sit') {
        legs[0].rotation.set(-1.35, 0, -0.35);
        legs[1].rotation.set(-1.35, 0, 0.35);
        arms[0].rotation.set(-0.6, 0, -0.25);
        arms[1].rotation.set(-0.6, 0, 0.25);
        body.position.y = Math.sin(time * 3) * 0.01;
        body.rotation.x = 0.05;
        head.rotation.z = 0;
        return;
      }
      const swing = Math.sin(walk) * 0.75 * moving;
      legs[0].rotation.set(swing, 0, 0);
      legs[1].rotation.set(-swing, 0, 0);
      arms[0].rotation.set(-swing * 0.8, 0, -0.12);
      arms[1].rotation.set(swing * 0.8, 0, 0.12);
      body.position.y = Math.abs(Math.sin(walk)) * 0.035 * moving;
      body.rotation.x = 0;
      head.rotation.z = Math.sin(walk) * 0.04 * moving;
    },
  };
}
