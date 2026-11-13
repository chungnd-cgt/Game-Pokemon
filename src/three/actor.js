import * as THREE from 'three';
import { buildCharacter, disposeModel, shared } from './character.js';
import { buildBicycle, buildSurfBlob } from './effects.js';

// Nhân vật 3D đi theo một nhân vật của game 2D (người chơi hoặc NPC): mỗi khung hình nhận vị trí, hướng nhìn,
// ẩn / hiện từ WorldScene rồi tự tính nhịp bước chân từ quãng đường đã đi.

const YAW = { down: 0, right: Math.PI / 2, up: Math.PI, left: -Math.PI / 2 };
const blobGeo = shared(new THREE.CircleGeometry(0.28, 20).rotateX(-Math.PI / 2));
const blobMat = shared(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
const SCALE = 1.22;
// Khung xe đạp theo màu của bản 2D (gfx/player.js: BIKE_FRAME)
const BIKE_COLOR = { player: 0xd83838, 'player-f': 0x38a8d8 };

export class Actor {
  constructor(parent, key) {
    this.key = key;
    this.walkPhase = 0;
    this.moving = 0;
    this.time = Math.random() * 10;
    this.last = null;
    this.model = buildCharacter(key);
    this.model.root.scale.setScalar(SCALE);
    this.group = new THREE.Group();
    this.blob = new THREE.Mesh(blobGeo, blobMat);
    this.blob.position.y = 0.012;
    this.group.add(this.model.root, this.blob);
    this.vehicles = {};
    parent.add(this.group);
  }

  // Gỡ khỏi cảnh và giải phóng mô hình (mỗi lần đổi bản đồ nhân vật được dựng lại)
  dispose() {
    this.group.removeFromParent();
    disposeModel(this.group);
  }

  // Xe đạp / khối nước gắn vào mô hình (quay theo hướng nhìn); chỉ tạo khi cần
  vehicle(kind) {
    if (!this.vehicles[kind]) {
      const v = kind === 'bike' ? buildBicycle(BIKE_COLOR[this.key]) : buildSurfBlob();
      this.vehicles[kind] = v;
      this.model.root.add(v.group);
    }
    return this.vehicles[kind];
  }

  // x, z: vị trí chân (đơn vị ô); facing: 'up' | 'down' | 'left' | 'right'
  // opts.y: độ cao chân so với mặt đất • opts.mode: 'walk' | 'bike' | 'sit' • opts.ride: 'bike' | 'surf' | null
  sync(x, z, facing, visible, dt, { y = 0, mode = 'walk', ride = null } = {}) {
    this.time += dt;
    this.group.visible = visible;
    const dist = this.last ? Math.hypot(x - this.last.x, z - this.last.z) : 0;
    this.last = { x, z };
    // Dịch chuyển xa (đổi bản đồ, cảnh cắt) thì không tính là bước đi
    const step = dist < 0.5 ? dist : 0;
    this.group.position.set(x, y, z);
    if (step > 0.0005) {
      this.walkPhase += step * Math.PI;
      this.moving = Math.min(1, this.moving + dt * 12);
    } else {
      this.moving = Math.max(0, this.moving - dt * 8);
      if (mode === 'walk') {
        const rest = Math.round(this.walkPhase / Math.PI) * Math.PI;
        this.walkPhase += (rest - this.walkPhase) * Math.min(1, dt * 10);
      }
    }
    const root = this.model.root;
    let d = (YAW[facing] ?? 0) - root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    root.rotation.y += d * Math.min(1, dt * 18);

    // Ngồi trên xe đạp: nâng người lên yên • lướt nước: ngồi trên khối nước
    for (const [kind, v] of Object.entries(this.vehicles)) v.group.visible = kind === ride;
    if (ride === 'bike') {
      this.vehicle('bike').spin(this.walkPhase);
      root.position.y = 0.06 * SCALE;
      this.vehicle('bike').group.position.y = -0.06;
    } else if (ride === 'surf') {
      const blob = this.vehicle('surf');
      blob.bob(this.time);
      root.position.y = 0.22 * SCALE;
      blob.group.position.y = -0.22;
    } else root.position.y = 0;
    this.blob.visible = ride !== 'surf' && y <= 0.01;
    this.model.pose(this.walkPhase, this.moving, this.time, mode);
  }
}
