import { fixToCamera, followCenter, localX, uiX } from './helpers.js';
import { directionOf, isConfirm } from './input.js';

// Cửa sổ nổi trên bản đồ (túi đồ, thẻ HLV, hộp PC, chi tiết Pokémon...): mở được nhiều cái cùng lúc, đè lên nhau.
//  - Bấm vào cửa sổ nào thì cửa sổ đó nổi lên trên cùng và nhận phím (phím đi tới cửa sổ trên cùng)
//  - Cửa sổ thao tác bằng chuột: phím hướng / xác nhận KHÔNG tới cửa sổ mà để người chơi vẫn đi lại / nói chuyện trên bản
//    đồ khi đang mở cửa sổ (trừ lúc đang gõ ô tìm kiếm: win.typing)
//  - Kéo thanh trên cùng (dragRect) để dời cửa sổ, thả ra là dừng ở đó; mở lại vẫn ở chỗ cũ (nhớ trong lúc chơi)
//  - Nút mở cửa sổ bấm lần nữa thì đóng (WindowManager.toggle)
//  - Đang có hộp thoại / câu hỏi / bảng chọn (InputRouter đang bị giữ): các cửa sổ bị khoá (lớp chắn trong suốt phủ lên)
// Mỗi cửa sổ vẽ theo toạ độ khung thiết kế 960x720 trong một container gốc (root); dời cửa sổ là dời root.
// Đổi toạ độ con trỏ sang toạ độ trong cửa sổ: win.local(p)

const OFFSETS = new Map(); // id -> { x, y }: chỗ đã kéo tới (trong lúc chơi)
const DRAG_START = 4;

export class FloatWindow {
  // rect: khung cửa sổ { x, y, w, h } theo toạ độ thiết kế • dragRect: vùng kéo (mặc định dải cao 40px trên cùng)
  // onKey(e): phím khi cửa sổ ở trên cùng • onClose(): dọn dẹp khi đóng
  // scale: thu nhỏ cả cửa sổ (vẽ theo bố cục gốc rồi co lại, góc trên trái giữ nguyên chỗ)
  constructor(manager, { id, rect, dragRect, onKey, onClose, scale = 1 }) {
    this.manager = manager;
    this.scene = manager.scene;
    this.id = id;
    this.rect = rect;
    this.dragRect = dragRect ?? { x: rect.x, y: rect.y, w: rect.w, h: 40 };
    this.onKey = onKey;
    this.onClose = onClose;
    // Đối tượng nằm ngoài root mà phải đi theo cửa sổ (toạ độ màn hình, vd hình mặt nạ của vùng cuộn): dời cùng root
    this.followers = [];
    const off = OFFSETS.get(id) ?? { x: 0, y: 0 };
    this.ox = off.x;
    this.oy = off.y;
    this.scale = scale;
    this.root = this.scene.add.container(0, 0).setScale(scale);
    this.place();
    // Nền bắt chuột: bấm vào chỗ trống trong cửa sổ không lọt xuống cửa sổ / bản đồ bên dưới
    this.root.add(this.scene.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setInteractive());
  }

  // Thêm vào cửa sổ (ghim theo màn hình cả các phần con: vùng bấm tính đúng chỗ khi camera bản đồ trôi)
  add(obj) {
    this.root.add(fixToCamera(obj));
    return obj;
  }

  // Chỗ đặt root: dời (ox, oy), co quanh góc trên trái của khung
  place() {
    const s = this.scale;
    this.root.setPosition(uiX(this.scene) + this.ox + this.rect.x * (1 - s), this.oy + this.rect.y * (1 - s));
  }

  // Toạ độ con trỏ trong cửa sổ (toạ độ thiết kế theo bố cục gốc, đã trừ phần dời và phần co)
  local(p) {
    const s = this.scale;
    return {
      x: (localX(this.scene, p) - this.ox - this.rect.x * (1 - s)) / s,
      y: (p.y - this.oy - this.rect.y * (1 - s)) / s,
    };
  }

  contains(p, r = this.rect) {
    const { x, y } = this.local(p);
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  // Dời cửa sổ, giữ thanh kéo còn nằm trong màn hình
  moveBy(dx, dy) {
    const { width, height } = this.scene.scale;
    const ux = uiX(this.scene);
    const r = this.dragRect;
    this.ox = Math.max(60 - ux - r.x - r.w, Math.min(width - ux - 60 - r.x, this.ox + dx));
    this.oy = Math.max(-r.y, Math.min(height - r.y - r.h, this.oy + dy));
    OFFSETS.set(this.id, { x: this.ox, y: this.oy });
    const [x0, y0] = [this.root.x, this.root.y];
    this.place();
    const [dxs, dys] = [this.root.x - x0, this.root.y - y0];
    for (const o of this.followers) if (o?.active !== false) o.setPosition(o.x + dxs, o.y + dys);
  }

  close() {
    this.manager.remove(this);
  }
}

export class WindowManager {
  // base: depth của cửa sổ dưới cùng; mỗi cửa sổ phía trên cao hơn step (các phần trong cửa sổ xếp theo thứ tự thêm
  // vào root nên không cần depth riêng). Cửa sổ nằm dưới khung lời thoại / bảng chọn của bản đồ
  constructor(scene, router, { base, step = 0.5 }) {
    this.scene = scene;
    this.router = router;
    this.base = base;
    this.step = step;
    this.list = []; // dưới -> trên
    this.drag = null;
    router.fallback = { key: (e) => this.onKey(e), pointer: (p) => this.onPointer(p) };
    // Lớp chắn: hộp thoại đang mở thì không bấm được vào cửa sổ
    this.blocker = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0).setOrigin(0).setScrollFactor(0).setInteractive().setVisible(false);
    const move = (p) => this.onMove(p);
    const up = () => {
      this.drag = null;
    };
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', up);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', move);
      scene.input.off('pointerup', up);
      router.fallback = null;
    });
  }

  get count() {
    return this.list.length;
  }

  // Cửa sổ trên cùng đang nhận chữ gõ (ô tìm kiếm Pokédex): bản đồ không nhận phím đi lại
  get typing() {
    return Boolean(this.top()?.typing);
  }

  get(id) {
    return this.list.find((w) => w.id === id) ?? null;
  }

  top() {
    return this.list[this.list.length - 1] ?? null;
  }

  // Đưa cửa sổ vừa dựng xong vào màn hình (trên cùng)
  open(win) {
    fixToCamera(win.root);
    followCenter(this.scene, [win.root, ...win.followers]);
    this.list.push(win);
    this.restack();
    return win;
  }

  // Đang mở thì đóng (trả về null), chưa mở thì create() dựng cửa sổ mới
  toggle(id, create) {
    const win = this.get(id);
    if (win) {
      win.close();
      return null;
    }
    return create();
  }

  front(win) {
    if (this.top() === win) return;
    this.list = [...this.list.filter((w) => w !== win), win];
    this.restack();
  }

  remove(win) {
    if (!this.list.includes(win)) return;
    this.list = this.list.filter((w) => w !== win);
    if (this.drag?.win === win) this.drag = null;
    win.onClose?.();
    win.root.destroy();
    this.restack();
  }

  closeAll() {
    for (const win of [...this.list].reverse()) win.close();
  }

  restack() {
    this.list.forEach((w, i) => w.root.setDepth(this.base + i * this.step));
  }

  // Phím tới cửa sổ trên cùng. lastKey: phím vừa giao cho cửa sổ (bản đồ bỏ qua phím tắt trùng phím đó, vd Esc vừa đóng
  // cửa sổ cuối cùng thì không mở Cài đặt)
  onKey(e) {
    const win = this.top();
    if (!win) return;
    if (!win.typing && (directionOf(e) || isConfirm(e))) return;
    this.lastKey = e;
    win.onKey?.(e);
  }

  // Bấm: cửa sổ trên cùng dưới con trỏ nổi lên trên; bấm vào thanh kéo thì bắt đầu kéo
  onPointer(p) {
    const win = [...this.list].reverse().find((w) => w.contains(p));
    if (!win) return;
    this.front(win);
    if (!p.rightButtonDown() && win.contains(p, win.dragRect)) this.drag = { win, x: p.x, y: p.y, moving: false };
  }

  onMove(p) {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.moving && Math.hypot(p.x - d.x, p.y - d.y) < DRAG_START) return;
    d.moving = true;
    d.win.moveBy(p.x - d.x, p.y - d.y);
    d.x = p.x;
    d.y = p.y;
  }

  // Mỗi khung hình: hộp thoại đang mở thì phủ lớp chắn lên trên các cửa sổ
  update() {
    const lock = this.router.active && this.list.length > 0;
    const { blocker } = this;
    blocker.setVisible(lock);
    if (lock) {
      blocker.setSize(this.scene.scale.width, this.scene.scale.height).setDepth(this.base + this.list.length * this.step);
      blocker.input.hitArea.setSize(this.scene.scale.width, this.scene.scale.height);
    }
    if (blocker.input) blocker.input.enabled = lock;
  }
}
