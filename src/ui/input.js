import { DIRECTION_ACTIONS, matches } from '../game/keybinds.js';

// Phím xác nhận / quay lại / hướng đi theo bảng phím người chơi đặt (game/keybinds.js, Cài đặt → Điều khiển)
export const isConfirm = (e) => !e.repeat && matches(e, 'confirm');
export const isCancel = (e) => !e.repeat && matches(e, 'cancel');
export const directionOf = (e) => DIRECTION_ACTIONS.find((d) => matches(e, d)) ?? null;
// Phím gõ ra chữ (ô tìm kiếm trong túi đồ / Pokédex nhận phím này làm chữ)
export const isTyping = (e) => typeof e.key === 'string' && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

// Các phím đang giữ (theo e.code), để đi liên tục khi giữ phím hướng. Không dùng đối tượng phím của Phaser (gắn theo
// keyCode) vì bộ gõ tiếng Việt đổi keyCode của vài chữ cái (S, W...) và vì phím hướng đổi được trong Cài đặt
// Máy có màn hình cảm ứng làm cách nhập chính (điện thoại, máy tính bảng)
export const isTouchDevice = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

// Phím hướng / hành động đang giữ. virtual: hướng đang giữ trên cần gạt (ui/Joystick.js), tính như đang giữ phím hướng đó
export class HeldKeys {
  constructor(scene) {
    this.down = new Set();
    this.virtual = null;
    const kb = scene.input.keyboard;
    const press = (e) => e.code && this.down.add(e.code);
    const release = (e) => this.down.delete(e.code);
    const blur = () => this.reset();
    kb.on('keydown', press);
    kb.on('keyup', release);
    scene.game.events.on('blur', blur);
    scene.events.once('shutdown', () => {
      kb.off('keydown', press);
      kb.off('keyup', release);
      scene.game.events.off('blur', blur);
    });
  }

  // Đang giữ phím nào của hành động id
  isDown(id) {
    if (this.virtual === id) return true;
    for (const code of this.down) if (matches({ code }, id)) return true;
    return false;
  }

  reset() {
    this.down.clear();
    this.virtual = null;
  }
}

// Mỗi lúc chỉ một thành phần (hộp thoại, menu...) được nhận phím/chuột
export class InputRouter {
  constructor(scene) {
    this.onKey = null;
    this.onPointer = null;
    const key = (e) => this.onKey?.(e);
    const pointer = (p) => this.onPointer?.(p);
    scene.input.keyboard.on('keydown', key);
    scene.input.on('pointerdown', pointer);
    scene.events.once('shutdown', () => {
      scene.input.keyboard.off('keydown', key);
      scene.input.off('pointerdown', pointer);
    });
  }

  set(onKey, onPointer = null) {
    this.onKey = onKey;
    this.onPointer = onPointer;
  }

  clear() {
    this.set(null, null);
  }
}
