import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

// Gộp 453 hình SVG Pokémon (src/assets/pokemon-svg) thành MỘT file lúc build: game tải một lần thay cho 453 lượt
// (gfx/monImages.js). Hình là vector nên gộp nguyên chữ SVG (~227 KB khi nén) nhẹ hơn nhiều so với atlas ảnh điểm (~4 MB).
//  virtual:mon-svg-keys  danh sách tên hình (nhỏ, nạp ngay: biết hình nào có mà không cần tải)
//  virtual:mon-svgs      { 'mon-<loài>[-back|-side]': chữ SVG } (tải ngầm một lần, tách thành file riêng)
function monSvgPack() {
  const dir = fileURLToPath(new URL('./src/assets/pokemon-svg', import.meta.url));
  const files = () => readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
  const key = (f) => `mon-${f.slice(0, -4)}`;
  const ids = { 'virtual:mon-svg-keys': '\0mon-svg-keys', 'virtual:mon-svgs': '\0mon-svgs' };
  return {
    name: 'mon-svg-pack',
    resolveId: (source) => ids[source],
    load(id) {
      if (id === ids['virtual:mon-svg-keys']) return `export default ${JSON.stringify(files().map(key))};`;
      if (id !== ids['virtual:mon-svgs']) return null;
      const pack = {};
      for (const f of files()) {
        this.addWatchFile(join(dir, f)); // chạy dev: sửa hình là tải lại
        pack[key(f)] = readFileSync(join(dir, f), 'utf8');
      }
      return `export default ${JSON.stringify(pack)};`;
    },
  };
}

// Content-Security-Policy cho bản build (thẻ meta: GitHub Pages không đặt được header). Lỡ có chỗ chèn được HTML / script lạ
// thì trình duyệt cũng không chạy script ngoài game và không gửi dữ liệu (kể cả phiên đăng nhập) đi đâu khác ngoài Supabase.
//  script: chỉ file của game • style: thêm 'unsafe-inline' (bảng HTML của game đặt style trực tiếp)
//  img: data: / blob: (Phaser, hình Pokémon SVG tạo bằng createObjectURL, icon vật phẩm toDataURL)
//  connect: Supabase của dự án (https + wss cho Realtime).
// Bản dev mặc định không gắn; thử CSP khi chạy dev: CSP_DEV=1 npm run dev (cho thêm websocket HMR của Vite)
function cspMeta(supabaseUrl) {
  const dev = process.env.CSP_DEV === '1';
  let supabase = '';
  try {
    const { host } = new URL(supabaseUrl);
    supabase = ` https://${host} wss://${host}`;
  } catch {
    // chưa có VITE_SUPABASE_URL: game chạy không mạng
  }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' data: blob:",
    `connect-src 'self' data: blob:${supabase}${dev ? ' ws: http://localhost:*' : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'csp-meta',
    apply: (_, { command }) => command === 'build' || dev,
    transformIndexHtml: (html) => html.replace(
      /<meta charset="UTF-8" \/>/,
      (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
    ),
  };
}

// base './' để bản build chạy được ở bất kỳ đường dẫn nào (GitHub Pages, Netlify...)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [monSvgPack(), cspMeta(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL)],
  // Riêng Phaser đã ~1.2MB (cộng logic game ~1.8MB), không cần cảnh báo
  // assetsInlineLimit 0: luôn xuất ảnh thành file riêng
  build: {
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    rollupOptions: { input: { main: 'index.html' } },
  },
}));
