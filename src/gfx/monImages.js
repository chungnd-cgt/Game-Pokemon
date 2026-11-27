import MON_KEYS from 'virtual:mon-svg-keys';

// Hình Pokémon dạng SVG (src/assets/pokemon-svg/<loài>[-back|-side].svg), nạp ngầm sau khi game đã hiện màn hình chính.
// Ảnh chỉ giữ ở dạng <img> trong bộ nhớ, KHÔNG đưa lên GPU: game không bao giờ vẽ thẳng ảnh gốc 256px mà luôn thu nhỏ
// thành sprite kiểu GBA (gfx/textures.js: pixelMon), lúc đó mới vẽ ảnh ra pixel. Trước kia nạp cả 453 ảnh bằng loader của
// Phaser lúc khởi động (giải mã + vẽ + đẩy 453 texture 256x256 lên GPU) làm màn hình đen hàng chục giây trên điện thoại.
//  - BootScene nạp trước vài hình màn hình chính cần (loadMonImages), rồi nạp hết phần còn lại ở nền (loadAllMonImages).
//  - Vào game (TitleScene.go) thì chờ nạp xong hết (monImagesReady), có hiện % trên màn hình.

export const SVG_SIZE = 256;
const CONCURRENT = 24; // số ảnh nạp cùng lúc (nạp ồ ạt cả trăm ảnh một lúc làm điện thoại giật / tốn bộ nhớ)

// Tên mọi hình có SVG (MON_KEYS, nạp ngay); chữ SVG của cả 453 hình gộp trong MỘT file tải ngầm một lần (vite.config.js: monSvgPack)

const URLS = Object.fromEntries(MON_KEYS.map((k) => [k, true]));
let packPromise = null;
const svgPack = () => (packPromise ??= import('virtual:mon-svgs').then((m) => m.default));

const images = new Map(); // 'mon-pikachu-back' -> <img> đã nạp xong
const loading = new Map(); // key -> Promise đang nạp

// Có file SVG cho key này không (biết ngay từ lúc build, không cần chờ nạp)
export const hasMonSvg = (key) => key in URLS;
// Ảnh đã nạp xong (hoặc null)
export const monImage = (key) => images.get(key) ?? null;

// Đặt cỡ vẽ cho SVG giống loader của Phaser (load.svg với width / height) để sprite thu nhỏ ra y hệt trước kia
function sized(text) {
  const xml = new DOMParser().parseFromString(text, 'text/xml');
  const svg = xml.getElementsByTagName('svg')[0];
  if (!svg) return text;
  const w = parseFloat(svg.getAttribute('width'));
  const h = parseFloat(svg.getAttribute('height'));
  if (!svg.hasAttribute('viewBox') && w && h) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', `${SVG_SIZE}px`);
  svg.setAttribute('height', `${SVG_SIZE}px`);
  return new XMLSerializer().serializeToString(xml);
}

// Chữ SVG thành <img> dùng được (null nếu hỏng). Dùng img.decode() chứ không chờ sự kiện onload: onload bị xếp hàng sau
// từng khung hình của game đang chạy, nạp 453 ảnh mất 4-60 giây (màn "Đang tải hình Pokémon…" rất lâu); decode() xong cả
// 453 ảnh trong chưa tới nửa giây. Trình duyệt không decode được SVG thì quay về chờ onload như cũ
async function svgImage(svg) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await img.decode();
    return img;
  } catch {
    if (img.complete) return img.naturalWidth ? img : null;
    return new Promise((resolve) => {
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });
  }
}

function loadOne(key) {
  if (images.has(key) || !URLS[key]) return Promise.resolve();
  if (loading.has(key)) return loading.get(key);
  const job = svgPack()
    .then((pack) => svgImage(sized(pack[key])))
    .then((img) => {
      if (img) images.set(key, img);
    })
    .catch((err) => console.warn('Không nạp được hình', key, err))
    .finally(() => loading.delete(key));
  loading.set(key, job);
  return job;
}

// Nạp các key (bỏ qua key không có file / đã nạp), tối đa CONCURRENT ảnh cùng lúc. onProgress(đã xong, tổng)
export async function loadMonImages(keys, onProgress) {
  const queue = keys.filter((k) => URLS[k] && !images.has(k));
  const total = queue.length;
  let done = 0;
  const worker = async () => {
    while (queue.length) {
      await loadOne(queue.shift());
      onProgress?.(++done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENT, total) }, worker));
}

// Nạp hết hình (mặt trước trước: Pokédex, đội hình, trận đấu cần nhiều nhất; rồi lưng, rồi nghiêng). skip: key đã có
// hình PNG thật (BootScene). Gọi nhiều lần vẫn chỉ nạp một lượt
let all = null;
const listeners = new Set();
const progress = { done: 0, total: 0 };
export function loadAllMonImages(skip = []) {
  if (all) return all;
  const rank = (k) => (k.endsWith('-back') ? 1 : k.endsWith('-side') ? 2 : 0);
  const keys = Object.keys(URLS).filter((k) => !skip.includes(k)).sort((a, b) => rank(a) - rank(b));
  progress.total = keys.filter((k) => !images.has(k)).length;
  all = loadMonImages(keys, (done, total) => {
    Object.assign(progress, { done, total });
    for (const fn of listeners) fn(done, total);
  });
  return all;
}

// Chờ nạp xong hết. onProgress(tỉ lệ 0..1) được gọi ngay một lần rồi mỗi khi nạp thêm một ảnh
export async function monImagesReady(onProgress) {
  const p = loadAllMonImages();
  const report = (done, total) => onProgress?.(total ? done / total : 1);
  report(progress.done, progress.total);
  listeners.add(report);
  try {
    await p;
  } finally {
    listeners.delete(report);
  }
}
