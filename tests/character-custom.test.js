import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOKS, PLAYER_BASE_LOOKS } from '../src/data/characterLooks.js';
import {
  CUSTOM_ROWS, DEFAULT_CUSTOM, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, LEGACY_CUSTOM, OUTFITS, SKIN_TONES,
  currentLook, normalizeCustom, switchGender, optionIds, optionInfo, randomCustom, resolveLook, stepOption,
} from '../src/data/playerCustom.js';
import { BIKE_H, BIKE_W, DIRS, HAIR_STYLE_IDS, LH, LW, PLAYER_FRAMES, bikerPixels, characterPixels } from '../src/gfx/playerArt.js';

const GENDERS = ['male', 'female'];
const HEX = /^#[0-9a-f]{6}$/;
const colorsOf = (p) => new Set(p.data.filter(Boolean));

// Vẽ đủ 9 frame đi bộ + 9 frame đạp xe; kiểm tra cỡ khung, màu hợp lệ, frame không rỗng
function drawAll(look) {
  const frames = {};
  for (const dir of DIRS) {
    for (const step of PLAYER_FRAMES) {
      const walk = characterPixels(look, dir, step);
      const bike = bikerPixels(look, dir, step, '#d83838');
      assert.equal(walk.w, LW);
      assert.equal(walk.h, LH);
      assert.equal(bike.w, BIKE_W);
      assert.equal(bike.h, BIKE_H);
      for (const p of [walk, bike]) {
        const filled = p.data.filter(Boolean);
        assert.ok(filled.length > 100, `${look.hairStyle} ${dir}-${step}: hình gần như trống`);
        for (const c of filled) assert.match(c, HEX);
      }
      frames[`${dir}-${step}`] = walk;
    }
  }
  return frames;
}

test('bảng tuỳ chỉnh: mỗi dòng đủ lựa chọn, có tên tiếng Việt, màu hợp lệ; kiểu tóc nào cũng vẽ được', () => {
  assert.deepEqual(CUSTOM_ROWS.map((r) => r.key), ['hairStyle', 'hair', 'skin', 'outfit', 'eyes']);
  assert.ok(Object.keys(HAIR_STYLES).length >= 6);
  for (const g of GENDERS) assert.ok(optionIds('hairStyle', g).length >= 3, `${g}: ít nhất 3 kiểu tóc`);
  assert.ok(Object.keys(HAIR_COLORS).length >= 8);
  assert.ok(Object.keys(SKIN_TONES).length >= 5);
  assert.ok(Object.keys(OUTFITS).length >= 6);
  assert.ok(Object.keys(EYE_COLORS).length >= 5);
  for (const id of Object.keys(HAIR_STYLES)) assert.ok(HAIR_STYLE_IDS.includes(id), `gfx chưa vẽ kiểu tóc ${id}`);
  for (const table of [HAIR_COLORS, SKIN_TONES, EYE_COLORS]) for (const o of Object.values(table)) assert.match(o.color, HEX);
  for (const o of Object.values(OUTFITS)) for (const k of ['hat', 'hatAccent', 'shirt', 'pants', 'shoes', 'pack']) if (o[k] !== null || k !== 'pack') assert.match(o[k], HEX);
  for (const g of GENDERS) {
    for (const { key } of CUSTOM_ROWS) {
      const ids = optionIds(key, g);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(ids.includes(DEFAULT_CUSTOM[g][key]), 'lựa chọn mặc định có trong danh sách');
      for (const id of ids) assert.ok(optionInfo(key, id)?.label, `${key}.${id} thiếu tên`);
    }
  }
});

test('diện mạo cũ (bản lưu chưa có diện mạo) vẽ ra đúng nhân vật nam / nữ có sẵn, không đội mũ', () => {
  for (const g of GENDERS) {
    const look = resolveLook(g, LEGACY_CUSTOM[g]);
    assert.deepEqual(resolveLook(g, currentLook({ gender: g })), look, 'chưa có look = diện mạo cũ');
    const { eyes, ...rest } = look;
    assert.deepEqual(rest, PLAYER_BASE_LOOKS[g]);
    assert.equal(eyes, EYE_COLORS.dark.color);
    assert.ok(!['cap', 'beanie', 'sunhat'].includes(look.hairStyle), 'không còn mũ lưỡi trai / mũ len / nón');
  }
  assert.deepEqual(LOOKS.player, PLAYER_BASE_LOOKS.male, 'LOOKS.player ban đầu là diện mạo mặc định');
  assert.notEqual(LOOKS.player, PLAYER_BASE_LOOKS.male, 'là bản sao, không phải chính bảng mặc định');
});

test('mặc định khi chơi mới: áo ba lỗ trắng, tay chân để trần, không mũ, không ba lô / túi; nam quần short, nữ váy ngắn', () => {
  for (const g of GENDERS) {
    assert.equal(optionIds('outfit', g)[0], 'tank', 'áo ba lỗ là bộ đồ đầu tiên');
    const look = resolveLook(g, DEFAULT_CUSTOM[g]);
    assert.equal(look.shirt, '#f4f4f0');
    assert.ok(look.tank);
    for (const k of ['backpack', 'bag', 'belt']) assert.equal(look[k], undefined, `${g}: còn ${k}`);
    const f = drawAll(look);
    // nhìn thẳng: cánh tay (cột 2, hàng 15) và cẳng chân (hàng 20) màu da
    assert.equal(f['down-stand'].get(2, 15), look.skin);
    assert.equal(f['down-stand'].get(5, 20), look.skin);
    assert.equal(f['up-stand'].get(5, 20), look.skin);
    if (g === 'male') {
      // quần short: đùi (hàng 19) màu quần
      assert.ok(look.shorts);
      for (const k of ['dress', 'skirt']) assert.equal(look[k], undefined, `nam: còn ${k}`);
      assert.equal(f['down-stand'].get(6, 19), look.pants);
      assert.ok(colorsOf(f['side-stand']).has(look.pants));
    } else {
      // váy ngắn (màu váy riêng của bộ áo ba lỗ), không phải quần short
      assert.equal(look.shorts, undefined);
      assert.ok(look.dress);
      assert.equal(look.skirt, OUTFITS.tank.skirt);
      assert.equal(f['down-stand'].get(6, 18), look.skirt);
      assert.ok(colorsOf(f['side-stand']).has(look.skirt));
    }
    for (const p of Object.values(f)) assert.ok(!colorsOf(p).has(OUTFITS.tank.hat), 'không có mũ');
    // đạp xe: cẳng chân để trần
    const bike = bikerPixels(look, 'down', 'stand', '#d83838');
    assert.ok(bike.data.filter((c) => c === look.skin).length > f['down-stand'].data.filter((c) => c === look.skin).length - 6);
  }
  // Bộ đồ khác vẫn là áo khoác + quần dài / váy
  assert.equal(resolveLook('male', { outfit: 'classic' }).tank, undefined);
  assert.equal(resolveLook('female', { outfit: 'classic' }).dress, true);
});

test('đổi giới tính trong bảng: lựa chọn mặc định đổi theo giới tính mới, lựa chọn đã tự chọn thì giữ (trừ kiểu tóc)', () => {
  assert.deepEqual(switchGender('male', 'female', DEFAULT_CUSTOM.male), { ...DEFAULT_CUSTOM.female });
  const mine = { hairStyle: 'spiky', hair: 'blue', skin: 'deep', outfit: 'night', eyes: 'green' };
  // kiểu tóc mỗi giới tính một danh sách riêng: sang nữ thì về kiểu mặc định của nữ
  assert.deepEqual(switchGender('male', 'female', mine), { ...mine, hairStyle: DEFAULT_CUSTOM.female.hairStyle });
  assert.deepEqual(switchGender('female', 'male', { ...DEFAULT_CUSTOM.female, skin: 'tan' }), { ...DEFAULT_CUSTOM.male, skin: 'tan' });
  assert.deepEqual(switchGender('female', 'male', { ...mine, hairStyle: 'bun' }), { ...mine, hairStyle: DEFAULT_CUSTOM.male.hairStyle });
  const hers = { ...mine, hairStyle: 'twintails' };
  assert.deepEqual(currentLook({ gender: 'female', look: hers }), { gender: 'female', ...hers });
  assert.deepEqual(currentLook({ gender: 'female', look: mine }), { gender: 'female', ...mine, hairStyle: DEFAULT_CUSTOM.female.hairStyle });
});

test('không chọn được kiểu tóc có mũ; bản lưu có mũ (mũ lưỡi trai / mũ len / nón) về kiểu tóc mặc định', () => {
  for (const g of GENDERS) {
    for (const hat of ['cap', 'beanie', 'sunhat']) {
      assert.ok(HAIR_STYLE_IDS.includes(hat), `${hat}: vẫn vẽ được (NPC, mũ đội sau này)`);
      assert.ok(!optionIds('hairStyle', g).includes(hat), `${g}: không chọn được ${hat}`);
      assert.equal(normalizeCustom(g, { hairStyle: hat }).hairStyle, DEFAULT_CUSTOM[g].hairStyle);
      assert.equal(currentLook({ gender: g, look: { ...DEFAULT_CUSTOM[g], hairStyle: hat } }).hairStyle, DEFAULT_CUSTOM[g].hairStyle);
    }
    for (let i = 0; i < 30; i++) assert.ok(!['cap', 'beanie', 'sunhat'].includes(randomCustom(g).hairStyle));
  }
  // NPC vẫn đội mũ như cũ
  const cap = characterPixels(LOOKS['npc-youngster'], 'down', 'stand');
  assert.ok(colorsOf(cap).has(LOOKS['npc-youngster'].hat));
});

test('nam và nữ trông khác nhau dù chọn giống nhau: kiểu tóc riêng, nữ có lông mi + má hồng + váy, nam không', () => {
  const male = new Set(optionIds('hairStyle', 'male'));
  for (const id of optionIds('hairStyle', 'female')) assert.ok(!male.has(id), `${id}: cả nam lẫn nữ đều có`);
  for (const outfit of optionIds('outfit', 'male')) {
    const same = { hair: 'black', skin: 'tan', outfit, eyes: 'blue' };
    const m = resolveLook('male', same);
    const f = resolveLook('female', same);
    assert.ok(f.lashes && !m.lashes);
    assert.ok(f.dress && !m.dress, `${outfit}: nữ mặc váy, nam không`);
    assert.equal(m.blush, m.skin, 'nam không má hồng');
    assert.notEqual(f.blush, f.skin);
    for (const [dir, step] of [['down', 'stand'], ['side', 'left'], ['up', 'right']]) {
      assert.notDeepEqual(characterPixels(m, dir, step).data, characterPixels(f, dir, step).data, `${outfit} ${dir}-${step}`);
    }
    // lông mi: vệt mực ở đuôi mắt (nhìn thẳng / nhìn ngang)
    const fd = characterPixels(f, 'down', 'stand');
    const md = characterPixels(m, 'down', 'stand');
    assert.notEqual(fd.get(4, 9), md.get(4, 9));
    assert.equal(fd.get(4, 9), fd.get(11, 9));
  }
});

test('mọi kiểu tóc x 3 hướng x 3 bước (đi bộ + đạp xe) cho cả nam lẫn nữ, đổi từng dòng một', () => {
  for (const g of GENDERS) {
    for (const hairStyle of optionIds('hairStyle', g)) {
      for (const { key } of CUSTOM_ROWS) {
        if (key === 'hairStyle') continue;
        for (const id of optionIds(key, g)) {
          const custom = { ...DEFAULT_CUSTOM[g], hairStyle, [key]: id };
          const look = resolveLook(g, custom);
          const frames = drawAll(look);
          // màu chọn phải thật sự hiện ra trên hình
          const down = colorsOf(frames['down-stand']);
          assert.ok(down.has(look.skin), `${g}/${hairStyle}: không thấy màu da`);
          assert.ok(down.has(look.eyes), `${g}/${hairStyle}: không thấy màu mắt`);
          assert.ok(down.has(look.shirt), `${g}/${hairStyle}: không thấy màu áo`);
          const all = new Set(Object.values(frames).flatMap((p) => [...colorsOf(p)]));
          assert.ok(all.has(look.hair), `${g}/${hairStyle}: không thấy màu tóc`);
          if (HAIR_STYLES[hairStyle].hat) assert.ok(all.has(look.hat), `${g}/${hairStyle}: không thấy màu mũ`);
          // nhìn ngang / sau không có mắt; ba hướng khác nhau, bước đi khác đứng yên
          assert.ok(!colorsOf(frames['up-stand']).has(look.eyes) || look.eyes === look.hair, `${g}/${hairStyle}: nhìn sau vẫn thấy mắt`);
          for (const dir of DIRS) assert.notDeepEqual(frames[`${dir}-left`].data, frames[`${dir}-stand`].data);
          assert.notDeepEqual(frames['down-stand'].data, frames['up-stand'].data);
          assert.notDeepEqual(frames['down-stand'].data, frames['side-stand'].data);
        }
      }
    }
  }
});

test('ngẫu nhiên vài chục tổ hợp: luôn hợp lệ và vẽ được', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60; i++) {
    const g = GENDERS[i % 2];
    const custom = randomCustom(g, rng);
    assert.deepEqual(normalizeCustom(g, custom), custom);
    drawAll(resolveLook(g, custom));
  }
});

test('đổi lựa chọn bằng ◀ ▶ vòng tròn; mã lạ / thiếu thì về mặc định', () => {
  for (const g of GENDERS) {
    for (const { key } of CUSTOM_ROWS) {
      const ids = optionIds(key, g);
      let c = DEFAULT_CUSTOM[g];
      for (let i = 0; i < ids.length; i++) c = stepOption(g, c, key, 1);
      assert.deepEqual(c, { ...DEFAULT_CUSTOM[g] }, 'đi hết một vòng thì về chỗ cũ');
      const i = ids.indexOf(DEFAULT_CUSTOM[g][key]);
      assert.equal(stepOption(g, DEFAULT_CUSTOM[g], key, -1)[key], ids.at(i - 1));
      assert.equal(stepOption(g, { ...DEFAULT_CUSTOM[g], [key]: ids.at(-1) }, key, 1)[key], ids[0]);
    }
    assert.deepEqual(normalizeCustom(g, undefined), DEFAULT_CUSTOM[g]);
    assert.deepEqual(normalizeCustom(g, { hairStyle: 'khongco', hair: 42, eyes: 'blue' }), { ...DEFAULT_CUSTOM[g], eyes: 'blue' });
  }
  assert.equal(resolveLook('female', { outfit: 'night' }).skirt, OUTFITS.night.pants, 'nữ mặc váy màu quần của bộ đồ');
  assert.equal(resolveLook('female', { outfit: 'night' }).bag, OUTFITS.night.pack);
  assert.equal(resolveLook('male', { outfit: 'forest' }).backpack, OUTFITS.forest.pack);
});

test('lưu / tải giữ nguyên diện mạo; bản lưu cũ chưa có diện mạo thì giữ diện mạo cũ', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame, saveSummary, deleteSave } = await import('../src/game/save.js');
  const { resetState, state } = await import('../src/game/state.js');
  try {
    deleteSave();
    resetState();
    assert.equal(state.player.look, null, 'chơi mới chưa chọn thì là null (mặc định)');
    const look = { hairStyle: 'ponytail', hair: 'blonde', skin: 'tan', outfit: 'ocean', eyes: 'green' };
    state.player = { name: 'Lan', gender: 'female', look };
    assert.ok(saveGame({ map: 'route1', x: 5, y: 10, facing: 'down' }));
    resetState();
    loadGame();
    assert.deepEqual(state.player, { name: 'Lan', gender: 'female', look });
    assert.deepEqual(saveSummary().look, look);

    // Bản lưu cũ: player chỉ có tên + giới tính
    const raw = JSON.parse(store.get('pokemon-demo-save-v1'));
    raw.player = { name: 'Khang', gender: 'male' };
    store.set('pokemon-demo-save-v1', JSON.stringify(raw));
    resetState();
    assert.doesNotThrow(() => loadGame());
    assert.deepEqual(state.player, { name: 'Khang', gender: 'male' });
    assert.deepEqual(resolveLook('male', currentLook(state.player)), resolveLook('male', LEGACY_CUSTOM.male), 'vẽ diện mạo cũ (áo khoác xanh, không mũ)');

    // Bản lưu rất cũ: chưa có cả player; mã diện mạo không còn trong game
    delete raw.player;
    store.set('pokemon-demo-save-v1', JSON.stringify(raw));
    resetState();
    loadGame();
    assert.equal(state.player.look, undefined);
    assert.deepEqual(currentLook(state.player), { gender: 'male', ...LEGACY_CUSTOM.male });
    raw.player = { name: 'Linh', gender: 'female', look: { hairStyle: 'mohawk', hair: 'blue' } };
    store.set('pokemon-demo-save-v1', JSON.stringify(raw));
    resetState();
    loadGame();
    assert.deepEqual(state.player.look, { ...DEFAULT_CUSTOM.female, hair: 'blue' });
  } finally {
    deleteSave();
    resetState();
    delete globalThis.localStorage;
  }
});
