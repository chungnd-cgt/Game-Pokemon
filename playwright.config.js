import { defineConfig } from '@playwright/test';

// Test giao diện bằng trình duyệt thật (Chromium): npm run e2e
// Mở game ở chế độ dev, vào bản đồ bằng ?e2e=<bản đồ> (TitleScene.e2eStart: không đăng nhập, không mạng), bấm / mở các
// màn hình chính rồi chụp ảnh vào test-results/screens/ để xem bằng mắt; báo lỗi nếu trang có lỗi JavaScript.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5199' },
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
