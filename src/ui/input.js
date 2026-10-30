const CONFIRM = ['Enter', 'NumpadEnter', 'Space', 'KeyZ'];
const CANCEL = ['Escape', 'KeyX', 'Backspace'];
const DIRECTIONS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export const isConfirm = (e) => CONFIRM.includes(e.code) && !e.repeat;
export const isCancel = (e) => CANCEL.includes(e.code) && !e.repeat;
export const directionOf = (e) => DIRECTIONS[e.code] ?? null;

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
