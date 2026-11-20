import { expect, test } from '@playwright/test';

// Chụp các màn hình chính ở nhiều cỡ màn hình; trang có lỗi JavaScript thì test hỏng.
// Ảnh: test-results/screens/<cỡ>-<màn>.png

const SIZES = [
  { name: 'pc', viewport: { width: 1600, height: 900 } },
  { name: 'phone-land', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  { name: 'phone-port', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const shot = (page, size, name) => page.screenshot({ path: `test-results/screens/${size}-${name}.png` });

// Gọi vào WorldScene đang chạy
const world = (page, fn, arg) => page.evaluate(([src, a]) => {
  const w = window.__game.scene.getScene('World');
  // eslint-disable-next-line no-new-func
  return new Function('w', 'dev', 'a', src)(w, window.__dev, a);
}, [fn, arg]);

async function enterWorld(page, map = 'town1') {
  await page.goto(`/?e2e=${map}`);
  await page.waitForFunction(() => window.__game?.scene.isActive('World') && window.__game.scene.getScene('World').map, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
}

// Bấm qua lời thoại tới khi bản đồ rảnh (hết hội thoại / sự kiện) rồi mới mở màn khác
async function idle(page) {
  for (let i = 0; i < 20; i++) {
    const free = await page.evaluate(() => {
      const w = window.__game.scene.getScene('World');
      return !w.busy && !w.msg.container.visible;
    });
    if (free) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
  }
  throw new Error('Bản đồ không rảnh lại được');
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({ viewport: size.viewport, isMobile: size.isMobile ?? false, hasTouch: size.hasTouch ?? false });

    test(`${size.name}: đăng nhập`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/');
      await page.locator('#auth').waitFor({ timeout: 90000 });
      await page.waitForTimeout(500);
      await shot(page, size.name, '01-login');
      expect(errors).toEqual([]);
    });

    test(`${size.name}: bản đồ và các bảng`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await enterWorld(page);
      await shot(page, size.name, '02-world');

      // Túi đồ
      await world(page, 'w.openBag()');
      await page.waitForTimeout(700);
      await shot(page, size.name, '03-bag');
      await page.keyboard.press('Escape');
      await idle(page);

      // Thanh chọn Pokémon nằm ngang (dùng vật phẩm)
      world(page, 'w.runEvent(() => w.pickMonBar("Dùng Potion cho Pokémon nào?"))');
      await page.waitForTimeout(600);
      await shot(page, size.name, '04-pickbar');
      await page.keyboard.press('Escape');
      await idle(page);

      // Cài đặt + danh sách độ phân giải
      await world(page, 'w.toggleSettings()');
      await page.waitForTimeout(600);
      await shot(page, size.name, '05-settings');
      await world(page, `const p = w.settingsMenu; p.area = 'main'; p.openDropdown(p.rows.find((r) => r.type === 'select'));`);
      await page.waitForTimeout(400);
      await shot(page, size.name, '06-resolution');
      await world(page, 'const p = w.settingsMenu; p.closeDropdown(); p.selectTab(1);');
      await page.waitForTimeout(300);
      await shot(page, size.name, '06b-general');
      await world(page, 'w.settingsMenu.finish(null)');
      await idle(page);

      // Thẻ HLV
      await world(page, 'w.openTrainerCard()');
      await page.waitForTimeout(600);
      await shot(page, size.name, '07-trainer-card');
      await page.keyboard.press('Escape');
      await idle(page);

      // Popup tiến hoá
      world(page, 'w.runEvent(() => w.evolutionScene(dev.state.party[0], "charmeleon", true))');
      await page.waitForTimeout(1500);
      await shot(page, size.name, '08-evolution');
      await page.keyboard.press('Escape'); // Không tiến hoá
      await page.waitForTimeout(400);
      await idle(page);

      // Nhà dân có người ở
      await world(page, `w.loadMap('nh-town1-13-15', { x: 3, y: 6 }, 'up'); w.refreshFollower();`);
      await page.waitForTimeout(800);
      await shot(page, size.name, '09-house');
      expect(errors).toEqual([]);
    });

    test(`${size.name}: trận đấu`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await enterWorld(page);
      world(page, `w.runEvent(() => w.startBattle({ enemy: dev.createMonster('rattata', 5), zone: 'meadow' }))`);
      await page.waitForFunction(() => window.__game.scene.isActive('Battle'), null, { timeout: 15000 });
      await page.waitForTimeout(4500);
      await shot(page, size.name, '10-battle');
      expect(errors).toEqual([]);
    });
  });
}

test.describe('pc: cần gạt', () => {
  test.use({ viewport: { width: 1600, height: 900 } });
  test('kéo trên bản đồ thì hiện cần gạt và nhân vật đi', async ({ page }) => {
    await enterWorld(page);
    const before = await world(page, 'return { ...w.pos }');
    await page.mouse.move(1100, 450);
    await page.mouse.down();
    await page.mouse.move(1180, 450, { steps: 6 });
    await page.waitForTimeout(700);
    await shot(page, 'pc', '11-joystick');
    await page.mouse.up();
    const after = await world(page, 'return { ...w.pos }');
    expect(after.x).toBeGreaterThan(before.x);
  });
});

// Cỡ giao diện (Cài đặt → Chung): đội đủ 6, đổi 100% / 150%; bấm đúng ô đội hình / ô phím tắt đã phóng to
test.describe('phone-land: cỡ giao diện', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test('phóng to giao diện, bấm đúng chỗ', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await enterWorld(page);
    await idle(page);
    await world(page, `
      while (dev.state.party.length < 6) dev.state.party.push(dev.createMonster('pidgey', 10 + dev.state.party.length));
      dev.state.hotbar[2] = 'potion';
    `);
    for (const scale of [1, 1.5]) {
      // Như chọn trong Cài đặt (chạy dev: Vite cho import thẳng module của game)
      await page.evaluate(async (v) => {
        const { setSetting } = await import('/src/game/settings.js');
        setSetting('uiScale', v);
        window.__game.scene.getScene('World').refreshHudScale();
      }, scale);
      await page.waitForTimeout(500);
      await shot(page, 'phone-land', `12-ui-scale-${Math.round(scale * 100)}`);
      // Ô đội hình thứ 5 và ô phím tắt thứ 3 tính theo toạ độ trên màn hình (đã nhân hệ số)
      const hit = await world(page, `
        const s = w.hudScale;
        const c = w.partyPanel.center(4);
        const party = w.partyPanel.slotAt(c.x * s, c.y * s);
        const top = (w.scale.height / s - 16 - 46) * s;
        const left = (16 + 46 + 8 + 118 + 8 + 2 * 52 + 23) * s;
        return { party, hotbar: w.hotbar.slotAt(left, top + 23 * s), s };
      `);
      expect(hit.s).toBe(scale);
      expect(hit.party).toBe(4);
      expect(hit.hotbar).toBe(2);
    }
    expect(errors).toEqual([]);
  });
});
