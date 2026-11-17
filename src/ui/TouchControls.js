import { getBindings } from '../game/keybinds.js';
import { settings } from '../game/settings.js';

// Nút cảm ứng cho điện thoại / máy tính bảng: phím hướng (góc trái dưới) và hai nút A (xác nhận) / B (quay lại, trên bản
// đồ là mở Cài đặt) ở góc phải dưới. Là phần tử HTML đặt đè lên trang (không vẽ trong Phaser) nên dùng chung cho mọi màn
// hình (bản đồ, trận đấu, menu...) và nằm gọn trong dải đen hai bên khung game khi xoay ngang điện thoại.
// Bấm nút = giả lập phím bàn phím đang gán cho hành động đó (Cài đặt → Phím tắt), nên game xử lý y như bấm phím thật:
// giữ phím hướng là đi liên tục, giữ lâu trong menu thì con trỏ tự chạy.
// Cài đặt → Điều khiển: hiện (tự động / luôn bật / tắt), cỡ nút, độ đậm, rung khi bấm.

const REPEAT_DELAY = 380; // giữ phím hướng lâu chừng này ms thì bắt đầu lặp (menu tự chạy con trỏ)
const REPEAT_EVERY = 110;

const CSS = `
#touch-controls { position: fixed; inset: 0; pointer-events: none; z-index: 20; --s: 1; --o: .7;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
#touch-controls[hidden] { display: none; }
#touch-controls .tc { position: absolute; pointer-events: auto; touch-action: none; opacity: var(--o); }
#touch-controls .dpad { left: calc(env(safe-area-inset-left, 0px) + 18px); bottom: calc(env(safe-area-inset-bottom, 0px) + 18px);
  width: calc(150px * var(--s)); height: calc(150px * var(--s)); }
#touch-controls .dpad .arm { position: absolute; background: #2e3036; border: 2px solid #5a5d66; box-shadow: 0 3px 8px rgba(0,0,0,.45); }
#touch-controls .dpad .h { left: 0; right: 0; top: 33.3%; height: 33.3%; border-radius: 12px; }
#touch-controls .dpad .v { top: 0; bottom: 0; left: 33.3%; width: 33.3%; border-radius: 12px; }
#touch-controls .dpad .hub { position: absolute; left: 33.3%; top: 33.3%; width: 33.3%; height: 33.3%; background: #2e3036; }
#touch-controls .dpad .arrow { position: absolute; width: 0; height: 0; border: calc(9px * var(--s)) solid transparent; }
#touch-controls .dpad .arrow.up { left: 50%; top: 8%; transform: translateX(-50%); border-bottom: calc(13px * var(--s)) solid #c9ccd6; border-top: 0; }
#touch-controls .dpad .arrow.down { left: 50%; bottom: 8%; transform: translateX(-50%); border-top: calc(13px * var(--s)) solid #c9ccd6; border-bottom: 0; }
#touch-controls .dpad .arrow.left { top: 50%; left: 8%; transform: translateY(-50%); border-right: calc(13px * var(--s)) solid #c9ccd6; border-left: 0; }
#touch-controls .dpad .arrow.right { top: 50%; right: 8%; transform: translateY(-50%); border-left: calc(13px * var(--s)) solid #c9ccd6; border-right: 0; }
#touch-controls .dpad .arrow.on { filter: brightness(1.5) drop-shadow(0 0 4px #8fb4ff); }
#touch-controls .dpad .arrow.up.on { border-bottom-color: #8fb4ff; }
#touch-controls .dpad .arrow.down.on { border-top-color: #8fb4ff; }
#touch-controls .dpad .arrow.left.on { border-right-color: #8fb4ff; }
#touch-controls .dpad .arrow.right.on { border-left-color: #8fb4ff; }
#touch-controls .btn { width: calc(66px * var(--s)); height: calc(66px * var(--s)); border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font: 800 calc(26px * var(--s)) Nunito, sans-serif; color: #fff;
  text-shadow: 0 2px 0 rgba(0,0,0,.45); border: 3px solid rgba(255,255,255,.35); box-shadow: 0 4px 10px rgba(0,0,0,.5); }
#touch-controls .btn.on { transform: scale(.92); filter: brightness(1.25); }
#touch-controls .btn.a { background: radial-gradient(circle at 35% 30%, #5fd068, #23862e);
  right: calc(env(safe-area-inset-right, 0px) + 18px); bottom: calc(env(safe-area-inset-bottom, 0px) + 18px + 46px * var(--s)); }
#touch-controls .btn.b { background: radial-gradient(circle at 35% 30%, #e86060, #9a2020);
  right: calc(env(safe-area-inset-right, 0px) + 18px + 78px * var(--s)); bottom: calc(env(safe-area-inset-bottom, 0px) + 18px); }
`;

// Phím đang gán cho hành động (phím chính, không có thì phím phụ)
const codeOf = (action) => getBindings()[action]?.find(Boolean) ?? null;

// Gửi phím giả lên trang: Phaser nghe phím trên window, ô chữ HTML nghe trên document, nên phát từ body cho lan lên cả hai
function sendKey(type, code, repeat = false) {
  if (!code) return;
  document.body.dispatchEvent(new KeyboardEvent(type, { code, key: code, repeat, bubbles: true, cancelable: true }));
}

const buzz = () => settings.vibrate && navigator.vibrate?.(8);

// Máy có màn hình cảm ứng làm cách nhập chính (điện thoại, máy tính bảng)
export const isTouchDevice = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

let root = null;

// Giữ ngón tay cho nút kể cả khi trượt ra ngoài (máy / trình duyệt không cho thì thôi, nút vẫn chạy)
function capture(el, e) {
  try {
    el.setPointerCapture?.(e.pointerId);
  } catch {
    // không có con trỏ đang hoạt động với id này
  }
}

// Một nút giữ được: bấm = keydown, thả = keyup (code lấy lúc bấm để đổi phím giữa chừng không bị kẹt phím)
function holdButton(el, action) {
  let code = null;
  const release = () => {
    if (!code) return;
    sendKey('keyup', code);
    code = null;
    el.classList.remove('on');
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capture(el, e);
    release();
    code = codeOf(action);
    el.classList.add('on');
    buzz();
    sendKey('keydown', code);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, release);
}

// Phím hướng: một vùng chung, hướng tính theo chỗ ngón tay so với tâm (trục lệch nhiều hơn thắng), trượt ngón tay sang
// hướng khác là đổi hướng ngay không cần nhấc tay
function dpad(el) {
  let dir = null;
  let code = null;
  let timer = null;
  const arrows = Object.fromEntries(['up', 'down', 'left', 'right'].map((d) => [d, el.querySelector(`.arrow.${d}`)]));
  const stopRepeat = () => {
    clearTimeout(timer);
    clearInterval(timer);
    timer = null;
  };
  const set = (next) => {
    if (next === dir) return;
    stopRepeat();
    if (code) sendKey('keyup', code);
    if (dir) arrows[dir].classList.remove('on');
    dir = next;
    code = next ? codeOf(next) : null;
    if (!next) return;
    arrows[next].classList.add('on');
    buzz();
    sendKey('keydown', code);
    timer = setTimeout(() => {
      timer = setInterval(() => sendKey('keydown', code, true), REPEAT_EVERY);
    }, REPEAT_DELAY);
  };
  const dirAt = (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return dir; // giữa tâm: giữ hướng cũ
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capture(el, e);
    set(dirAt(e) ?? null);
  });
  el.addEventListener('pointermove', (e) => {
    if (dir || e.buttons) set(dirAt(e));
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, () => set(null));
}

// Tạo nút cảm ứng (gọi một lần lúc khởi động game)
export function initTouchControls() {
  if (root) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.id = 'touch-controls';
  root.innerHTML = `
    <div class="tc dpad"><div class="arm h"></div><div class="arm v"></div><div class="hub"></div>
      <div class="arrow up"></div><div class="arrow down"></div><div class="arrow left"></div><div class="arrow right"></div></div>
    <div class="tc btn b">B</div>
    <div class="tc btn a">A</div>`;
  document.body.appendChild(root);
  dpad(root.querySelector('.dpad'));
  holdButton(root.querySelector('.btn.a'), 'confirm');
  holdButton(root.querySelector('.btn.b'), 'cancel');
  // Không hiện menu nhấn giữ / chọn chữ của trình duyệt khi giữ nút
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', () => refreshTouchControls());
  refreshTouchControls();
}

// Hiện / ẩn và đổi cỡ, độ đậm theo cài đặt (gọi lại sau khi đổi Cài đặt → Điều khiển)
export function refreshTouchControls() {
  if (!root) return;
  const mode = settings.touchControls;
  root.hidden = mode === 'off' || (mode !== 'on' && !isTouchDevice());
  root.style.setProperty('--s', String((settings.touchSize ?? 100) / 100));
  root.style.setProperty('--o', String((settings.touchOpacity ?? 70) / 100));
}
