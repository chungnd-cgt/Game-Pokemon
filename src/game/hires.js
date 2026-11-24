import Phaser from 'phaser';
import { settings } from './settings.js';

// Vẽ sắc nét (Cài đặt → Đồ hoạ → Hiển thị sắc nét): game có toạ độ cao 720 rồi phóng lên cỡ cửa sổ, nên trên màn hình
// lớn mọi thứ bị kéo giãn, chữ nhoè. Ở đây canvas có nhiều điểm ảnh hơn (bằng số điểm ảnh thật đang hiện, tối đa
// MAX_RES lần) mà toạ độ game giữ nguyên: renderer WebGL vẽ cùng phép chiếu 720 lên bộ đệm lớn hơn (projection chia lại,
// vùng cắt camera nhân lên). Hình vẽ (Graphics) và hình đã làm mịn sắc theo, chữ vẽ ở độ phân giải TEXT_RES.
// Toạ độ chuột không đổi (Phaser tính theo cỡ game chứ không theo cỡ bộ đệm canvas). Renderer Canvas (máy không có WebGL)
// thì giữ như cũ.

const MAX_RES = 2;
let textRes = 1;

// Hệ số điểm ảnh: cỡ hiện trên màn hình (px CSS x mật độ điểm ảnh) chia cỡ game
function resolutionFor(game) {
  if (settings.sharp === false) return 1;
  const shown = game.scale.displaySize?.height || game.scale.height;
  const r = (shown * (window.devicePixelRatio || 1)) / game.scale.height;
  // Làm tròn 1/8 cho đỡ đổi bộ đệm liên tục khi kéo cửa sổ
  return Math.min(MAX_RES, Math.max(1, Math.ceil(r * 8) / 8));
}

// Chữ (Text) mới tạo vẽ ở độ phân giải này (mặc định Phaser là 1). Gọi trước khi dựng màn hình
export function setTextResolution(r) {
  textRes = r;
}

// Độ phân giải chữ theo cửa sổ lúc mở game (tính trước khi có game)
export function initialTextResolution() {
  if (settings.sharp === false) return 1;
  const r = ((window.innerHeight || 720) * (window.devicePixelRatio || 1)) / 720;
  return Math.min(MAX_RES, Math.max(1, Math.ceil(r * 2) / 2));
}

// Chữ chưa đặt resolution thì lấy textRes
const setStyle = Phaser.GameObjects.TextStyle.prototype.setStyle;
Phaser.GameObjects.TextStyle.prototype.setStyle = function patched(...args) {
  const out = setStyle.apply(this, args);
  if (!this.resolution) this.resolution = textRes;
  return out;
};

export function installHiRes(game) {
  const r = game.renderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  const resize = r.resize.bind(r);
  const setProjection = r.setProjectionMatrix.bind(r);
  const pushScissor = r.pushScissor.bind(r);
  let rx = 1;
  let ry = 1;

  // w, h: cỡ game. Bộ đệm canvas = cỡ game x hệ số
  r.resize = (w, h) => {
    const k = resolutionFor(game);
    const bw = Math.round(w * k);
    const bh = Math.round(h * k);
    rx = bw / w;
    ry = bh / h;
    if (game.canvas.width !== bw) game.canvas.width = bw;
    if (game.canvas.height !== bh) game.canvas.height = bh;
    r.gameWidth = w;
    r.gameHeight = h;
    return resize(bw, bh);
  };
  // Vẽ lên canvas (cỡ bộ đệm) thì chiếu theo cỡ game; vẽ vào RenderTexture (cỡ khác) thì giữ nguyên
  r.setProjectionMatrix = (w, h) => (w === r.width && h === r.height && (rx !== 1 || ry !== 1) ? setProjection(w / rx, h / ry) : setProjection(w, h));
  // Vùng cắt của camera (toạ độ game) khi vẽ lên canvas: đổi sang điểm ảnh bộ đệm
  r.pushScissor = (x, y, w, h, dbh) => {
    const onCanvas = (dbh ?? r.drawingBufferHeight) === r.height && (rx !== 1 || ry !== 1);
    if (!onCanvas) return pushScissor(x, y, w, h, dbh);
    const x0 = Math.round(x * rx);
    const y0 = Math.round(y * ry);
    return pushScissor(x0, y0, Math.round((x + w) * rx) - x0, Math.round((y + h) * ry) - y0, dbh);
  };
  // Cửa sổ đổi cỡ (cỡ game có thể giữ nguyên mà cỡ hiện thì đổi): tính lại hệ số
  game.scale.on(Phaser.Scale.Events.RESIZE, () => {
    const k = resolutionFor(game);
    if (Math.round(game.scale.width * k) !== r.width || Math.round(game.scale.height * k) !== r.height) r.resize(game.scale.width, game.scale.height);
  });
  // Áp ngay (renderer đã dựng ở cỡ game)
  r.projectionWidth = 0;
  r.resize(game.scale.width, game.scale.height);
}

// Đổi tuỳ chọn trong Cài đặt: dựng lại bộ đệm (chữ đã vẽ giữ độ phân giải cũ tới khi dựng lại)
export function applyHiRes(game) {
  const r = game?.renderer;
  if (!r?.gameWidth) return;
  r.resize(game.scale.width, game.scale.height);
}
