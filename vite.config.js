import { defineConfig } from 'vite';

// base './' để bản build chạy được ở bất kỳ đường dẫn nào (GitHub Pages, Netlify...)
export default defineConfig({
  base: './',
  // Riêng Phaser đã ~1.2MB, không cần cảnh báo
  // assetsInlineLimit 0: luôn xuất ảnh SVG thành file riêng để Phaser nạp được
  build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
});
