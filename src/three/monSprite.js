import * as THREE from 'three';

// Pokémon trong cảnh 3D theo kiểu sprite GBA:
//  - hình pixel art phẳng luôn quay thẳng vào màn hình (không nghiêng theo góc camera, không bị bóp dẹt như tấm bìa)
//  - giữ nguyên màu như sprite GBA (không đổ bóng sáng tối lên hình), chỉ hơi tối đi khi trời tối (shade)
//  - đổi hướng là đổi hình ngay như game GBA; nhún / nhảy / nghiêng lấy theo hình bên bản 2D
//  - bóng tròn mềm dưới chân, bay càng cao bóng càng nhỏ
// Dùng cho Pokémon đi theo, NPC là Pokémon, thú cưỡi (view3d.js) và Pokémon ở màn hình chính (title3d.js).

const blobGeo = new THREE.CircleGeometry(0.26, 20).rotateX(-Math.PI / 2);

export class MonSprite {
  constructor(parent, { blob = true } = {}) {
    this.material = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.5 });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.center.set(0.5, 0); // gốc ở giữa mép dưới (chân), như origin (0.5, 1) của Phaser
    this.group = new THREE.Group();
    this.group.add(this.sprite);
    if (blob) {
      this.blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
      this.blob = new THREE.Mesh(blobGeo, this.blobMat);
      this.blob.position.y = 0.014;
      this.group.add(this.blob);
    }
    parent.add(this.group);
  }

  // Chiều cao hình (đơn vị cảnh), để đặt người ngồi trên lưng thú cưỡi
  get height() {
    return this.sprite.scale.y;
  }

  dispose() {
    this.group.removeFromParent();
    this.material.dispose();
    this.blobMat?.dispose();
  }

  // tex: texture hình hiện tại • w, h: cỡ hình (đơn vị cảnh) • flip: lật ngang (hình nghiêng quay sang phải)
  // lift: độ cao chân so với mặt đất (nhảy / bay) • angle: nghiêng (radian, chiều kim đồng hồ như Phaser)
  // alpha: độ mờ • shade: độ sáng màu (1 = nguyên màu)
  update({ tex, w, h, flip = false, lift = 0, angle = 0, alpha = 1, shade = 1 }) {
    if (this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }
    this.sprite.scale.set(flip ? -w : w, h, 1);
    this.sprite.position.y = lift;
    this.material.rotation = -angle;
    this.material.opacity = alpha;
    this.material.color.setScalar(shade);
    if (this.blob) {
      const far = Math.min(1, lift / 1.2);
      this.blob.scale.setScalar(Math.max(1, w * 1.1) * (1 - far * 0.4));
      this.blobMat.opacity = 0.22 * alpha * (1 - far * 0.5);
    }
  }
}
