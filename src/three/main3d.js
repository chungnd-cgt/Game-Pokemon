import { startGame } from '../startGame.js';
import { View3D } from './view3d.js';

// Bản 3D: chạy nguyên game 2D (cốt truyện, trận đấu, menu, lưu game) với nền trong suốt,
// còn thế giới (bản đồ, nhân vật, vật phẩm) được View3D dựng lại bằng 3D phía sau.

const game = await startGame({ transparent: true });
const view = new View3D(game, document.getElementById('view3d'), {
  badge: document.getElementById('badge'),
  fps: document.getElementById('fps'),
});

// Phím riêng của bản 3D (không trùng phím của game): V đổi góc nhìn, lăn chuột phóng to / thu nhỏ
const toast = document.getElementById('toast');
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyV' || e.repeat) return;
  toast.textContent = view.nextView();
  toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toast.classList.remove('show'), 1500);
});
window.addEventListener('wheel', (e) => view.zoomBy(e.deltaY > 0 ? 1.1 : 0.9), { passive: true });

// Chỉ khi chạy dev: mở thẳng một bản đồ để xem nhanh, bỏ qua màn hình chính
//   3d.html?map=route2&x=5&y=8&facing=down&time=day|dusk|night
const params = new URLSearchParams(location.search);
if (import.meta.env.DEV && params.get('map')) {
  const jump = () => {
    if (!game.scene.isActive('Title')) return;
    game.events.off('poststep', jump);
    const map = params.get('map');
    game.scene.stop('Title');
    game.scene.start('World', {
      position: { map, x: Number(params.get('x') ?? 5), y: Number(params.get('y') ?? 5), facing: params.get('facing') ?? 'down' },
    });
  };
  game.events.on('poststep', jump);
}
if (import.meta.env.DEV && params.get('time')) view.forceTime = params.get('time');

if (import.meta.env.DEV) window.__view3d = view;
