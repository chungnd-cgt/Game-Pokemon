import { defineConfig } from 'vite';

// base './' để bản build chạy được ở bất kỳ đường dẫn nào (GitHub Pages, Netlify...)
export default defineConfig({
  base: './',
  // Riêng Phaser đã ~1.2MB (cộng logic game ~1.8MB), không cần cảnh báo
  // assetsInlineLimit 0: luôn xuất ảnh SVG thành file riêng để Phaser nạp được
  build: {
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    rollupOptions: { input: { main: 'index.html' } },
  },
});
