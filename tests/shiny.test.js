import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { SPECIES } from '../src/data/monsters.js';
import { SHINY } from '../src/data/shiny.js';

const svgOf = (id) => new URL(`../src/assets/pokemon-svg/${id}.svg`, import.meta.url);
const isColor = (v) => Number.isInteger(v) && v >= 0 && v <= 0xffffff;
const HEX = /^#[0-9a-f]{6}$/;

test('shiny: loài nào cũng có bảng màu shiny riêng, khác màu thường', () => {
  for (const id of Object.keys(SPECIES)) assert.ok(SHINY[id], `${id}: thiếu màu shiny`);
  for (const id of Object.keys(SHINY)) assert.ok(SPECIES[id], `${id}: không phải loài trong game`);
});

test('shiny: loài có hình SVG đổi màu theo luật lấy đúng màu có trong hình', () => {
  for (const [id, shiny] of Object.entries(SHINY)) {
    const hasSvg = existsSync(svgOf(id));
    assert.equal(Boolean(shiny.rules), hasSvg, `${id}: ${hasSvg ? 'có hình SVG thì dùng rules' : 'vẽ bằng code thì dùng color / belly...'}`);
    if (!hasSvg) continue;
    const svg = readFileSync(svgOf(id), 'utf8').toLowerCase();
    for (const [from, to, opts = {}] of shiny.rules) {
      assert.match(from, HEX);
      assert.match(to, HEX);
      assert.notEqual(from, to);
      assert.ok(svg.includes(from), `${id}: màu ${from} không có trong hình SVG`);
      for (const k of Object.keys(opts)) assert.ok(['hue', 'light'].includes(k), `${id}: tuỳ chọn lạ ${k}`);
    }
  }
});

test('shiny: loài vẽ bằng code đổi ít nhất một màu, đúng định dạng', () => {
  for (const [id, shiny] of Object.entries(SHINY)) {
    if (shiny.rules) continue;
    const sp = SPECIES[id];
    const parts = Object.keys(shiny);
    assert.ok(parts.length, `${id}: không đổi màu nào`);
    for (const k of parts) assert.ok(['color', 'belly', 'wing', 'shell', 'bulb', 'leaf', 'flame'].includes(k), `${id}: phần lạ ${k}`);
    for (const k of ['color', 'belly', 'wing', 'shell', 'leaf']) if (k in shiny) assert.ok(isColor(shiny[k]), `${id}.${k}`);
    for (const k of ['bulb', 'flame']) if (k in shiny) assert.ok(shiny[k].every(isColor), `${id}.${k}`);
    if ('color' in shiny) assert.notEqual(shiny.color, sp.color, `${id}: màu thân shiny trùng màu thường`);
    if ('belly' in shiny) assert.notEqual(shiny.belly, sp.belly, `${id}: màu bụng shiny trùng màu thường`);
    // phần cánh / mai / củ / lá / lửa chỉ có tác dụng khi loài có đặc điểm đó
    const needs = { wing: 'wings', shell: 'shell', bulb: 'bulb', leaf: 'leaves', flame: 'flameTail' };
    for (const [k, f] of Object.entries(needs)) if (k in shiny) assert.ok(sp.features?.includes(f), `${id}: có ${k} nhưng hình không có ${f}`);
  }
});
