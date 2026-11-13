import * as THREE from 'three';

// Hiệu ứng 3D cho các cảnh của game 2D: xe đạp, khối nước khi lướt, bom khói, khí cầu, cần câu.
// Đơn vị: 1 ô = 1. Xe đạp và khối nước gắn vào mô hình nhân vật (đơn vị theo kích thước nhân vật, cao ~1.15).

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Ống nối hai điểm (khung xe)
function tube(a, b, r, mat) {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const len = from.distanceTo(to);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(from).add(to).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return m;
}

// ---------- Xe đạp: hai bánh quay theo quãng đường, khung màu theo nhân vật ----------

export function buildBicycle(frameColor = 0xd83838) {
  const g = new THREE.Group();
  const frame = lambert(frameColor);
  const dark = lambert(0x24242c);
  const metal = new THREE.MeshLambertMaterial({ color: 0xc8ccd4 });
  const R = 0.17;
  const wheels = [];
  for (const z of [-0.3, 0.3]) {
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(R, 0.028, 6, 20), dark));
    for (let i = 0; i < 4; i++) {
      const spoke = mesh(new THREE.CylinderGeometry(0.006, 0.006, R * 2, 4), metal);
      spoke.rotation.z = (i / 4) * Math.PI;
      wheel.add(spoke);
    }
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, R, z);
    g.add(wheel);
    wheels.push(wheel);
  }
  // Khung: tam giác giữa yên, trục giữa và ghi đông
  const seat = [0, 0.4, -0.12];
  const crank = [0, 0.16, 0];
  const head = [0, 0.46, 0.22];
  g.add(tube([0, R, -0.3], seat, 0.02, frame), tube(seat, crank, 0.022, frame), tube(crank, head, 0.022, frame), tube(seat, head, 0.02, frame));
  g.add(tube(head, [0, R, 0.3], 0.02, frame), tube(crank, [0, R, -0.3], 0.018, frame));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.03, 0.14), dark, 0, 0.42, -0.13));
  g.add(tube([-0.14, 0.56, 0.24], [0.14, 0.56, 0.24], 0.016, metal), tube(head, [0, 0.56, 0.24], 0.018, metal));
  return {
    group: g,
    spin(phase) {
      for (const w of wheels) w.rotation.z = -phase * 1.8; // quay quanh trục bánh
    },
  };
}

// ---------- Khối nước cuộn dưới thân khi lướt (chiêu Surf) ----------

export function buildSurfBlob() {
  const g = new THREE.Group();
  const water = new THREE.MeshPhongMaterial({ color: 0x4aa0e8, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.85, flatShading: true });
  const body = mesh(new THREE.SphereGeometry(0.42, 14, 10), water);
  body.scale.set(0.95, 0.45, 1.25);
  body.position.y = 0.08;
  const foam = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 6, 24), new THREE.MeshLambertMaterial({ color: 0xf0f8ff }));
  foam.rotation.x = Math.PI / 2;
  foam.scale.set(1, 1.3, 1);
  foam.position.y = 0.02;
  g.add(body, foam);
  return {
    group: g,
    bob(time) {
      body.position.y = 0.08 + Math.sin(time * 4) * 0.02;
      foam.scale.set(1 + Math.sin(time * 3) * 0.05, 1.3 + Math.sin(time * 3) * 0.05, 1);
    },
  };
}

// ---------- Bom khói: các cụm khói phồng to rồi tan ----------

const puffGeo = new THREE.IcosahedronGeometry(0.3, 1);
export class Smoke {
  constructor(parent) {
    this.parent = parent;
    this.puffs = [];
  }

  burst(x, z) {
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshLambertMaterial({ color: 0xe0e0e8, transparent: true, opacity: 0.95, flatShading: true });
      const m = new THREE.Mesh(puffGeo, mat);
      m.position.set(x + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.6);
      m.scale.setScalar(0.4);
      this.parent.add(m);
      this.puffs.push({ m, t: -i * 0.06, rise: 0.3 + Math.random() * 0.4, drift: new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5) });
    }
  }

  update(dt) {
    this.puffs = this.puffs.filter((p) => {
      p.t += dt;
      if (p.t < 0) return true;
      const k = p.t / 1.3;
      p.m.scale.setScalar(0.4 + k * 2.2);
      p.m.position.y += p.rise * dt;
      p.m.position.addScaledVector(p.drift, dt);
      p.m.material.opacity = Math.max(0, 0.95 * (1 - k));
      if (k < 1) return true;
      p.m.removeFromParent();
      p.m.material.dispose();
      return false;
    });
  }

  clear() {
    this.puffs.forEach((p) => p.m.removeFromParent());
    this.puffs = [];
  }
}

// ---------- Khí cầu: bóng sọc đỏ trắng, dây và giỏ mây; gốc toạ độ ở đáy giỏ ----------

export function buildBalloon() {
  const g = new THREE.Group();
  const stripes = document.createElement('canvas');
  stripes.width = 256;
  stripes.height = 16;
  const ctx = stripes.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#f4f0f0' : '#d83840';
    ctx.fillRect(i * 32, 0, 32, 16);
  }
  const tex = new THREE.CanvasTexture(stripes);
  tex.colorSpace = THREE.SRGBColorSpace;
  const envelope = mesh(new THREE.SphereGeometry(1.1, 24, 18), new THREE.MeshLambertMaterial({ map: tex }), 0, 2.6, 0);
  envelope.scale.set(1, 1.15, 1);
  const neck = mesh(new THREE.CylinderGeometry(0.35, 0.18, 0.5, 16), new THREE.MeshLambertMaterial({ map: tex }), 0, 1.35, 0);
  const basket = mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.42, 10), lambert(0x9a6a3a), 0, 0.21, 0);
  const rim = mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 16), lambert(0x6a4428), 0, 0.42, 0);
  rim.rotation.x = Math.PI / 2;
  const rope = lambert(0x5a4430);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(tube([Math.cos(a) * 0.36, 0.42, Math.sin(a) * 0.36], [Math.cos(a) * 0.2, 1.15, Math.sin(a) * 0.2], 0.012, rope));
  }
  g.add(envelope, neck, basket, rim);
  return g;
}

// ---------- Cần câu: cần trên tay, dây và phao nhấp nhô trên mặt nước ----------

export function buildFishingRig() {
  const g = new THREE.Group();
  const rod = mesh(new THREE.CylinderGeometry(0.012, 0.022, 1.3, 6), lambert(0x6a4428));
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf0f0f8 }));
  const bobber = new THREE.Group();
  bobber.add(mesh(new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xe04040)));
  const bottom = mesh(new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lambert(0xf8f8f8));
  bobber.add(bottom);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.11, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
  g.add(rod, line, bobber, ring);
  const tip = new THREE.Vector3();
  return {
    group: g,
    // hand: vị trí tay người chơi, dir: hướng nhìn [dx, dz], float: điểm phao trên mặt nước, bite: cá đang cắn
    update(hand, dir, float, bite, time) {
      tip.set(hand.x + dir[0] * 0.9, hand.y + 0.75, hand.z + dir[1] * 0.9);
      rod.position.copy(hand).lerp(tip, 0.5);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(hand).normalize());
      const dip = bite ? -0.07 + Math.sin(time * 30) * 0.02 : Math.sin(time * 3) * 0.015;
      bobber.position.set(float.x, float.y + dip, float.z);
      ring.position.set(float.x, float.y + 0.005, float.z);
      const k = (time * 0.8) % 1;
      ring.scale.setScalar(1 + k * (bite ? 3 : 1.5));
      ring.material.opacity = 0.6 * (1 - k);
      const p = lineGeo.attributes.position.array;
      p.set([tip.x, tip.y, tip.z, float.x, float.y + dip + 0.05, float.z]);
      lineGeo.attributes.position.needsUpdate = true;
    },
  };
}
