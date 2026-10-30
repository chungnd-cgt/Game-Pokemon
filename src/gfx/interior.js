import { TILE } from '../config.js';
import { hash, px } from './pixel.js';

// Nội thất trong nhà, pixel art 16x16 mỗi ô

const THEMES = {
  center: {
    floor: '#f8f0e0', floorAlt: '#f0e4cc', grout: '#dccbb0',
    wall: '#f8f0e8', stripe: '#efdfd0', trim: '#d8b8a0', trimDark: '#b89880', base: '#a88868',
    counterTop: '#f8b8c8', counterLight: '#ffdce4', counterFront: '#e06880', counterDark: '#b04860', ink: '#4a2030',
  },
  mart: {
    floor: '#eef2f8', floorAlt: '#e2e8f2', grout: '#c8d2e2',
    wall: '#f2f6fb', stripe: '#e2eaf4', trim: '#a8b8d0', trimDark: '#8898b4', base: '#6a7a98',
    counterTop: '#c8daf8', counterLight: '#e4eeff', counterFront: '#4a7ad8', counterDark: '#2f5cb8', ink: '#1e2a4a',
  },
};

const isWall = (ch) => ch === '#' || ch === 'm';

function drawFloor(ctx, ox, oy, x, y, t) {
  px(ctx, (x + y) % 2 ? t.floorAlt : t.floor, ox, oy, TILE, TILE);
  px(ctx, t.grout, ox, oy + 15, TILE, 1);
  px(ctx, t.grout, ox + 15, oy, 1, TILE);
  if (hash(x, y, 70) < 0.3) px(ctx, t.grout, ox + 3 + Math.floor(hash(x, y, 71) * 9), oy + 3 + Math.floor(hash(x, y, 72) * 9));
}

// lower: hàng tường sát sàn (giấy dán tường + chân tường), còn lại là phần tường phía trên
function drawWall(ctx, ox, oy, lower, t) {
  if (!lower) {
    px(ctx, t.trim, ox, oy, TILE, TILE);
    px(ctx, t.trimDark, ox, oy + 4, TILE, 1);
    px(ctx, t.trimDark, ox, oy + 11, TILE, 1);
    return;
  }
  px(ctx, t.wall, ox, oy, TILE, TILE);
  for (let i = 0; i < TILE; i += 4) px(ctx, t.stripe, ox + i, oy, 2, 12);
  px(ctx, t.base, ox, oy + 12, TILE, 3);
  px(ctx, t.ink, ox, oy + 15, TILE, 1);
}

function drawCounter(ctx, ox, oy, joinLeft, joinRight, t) {
  const x0 = ox + (joinLeft ? 0 : 1);
  const w = TILE - (joinLeft ? 0 : 1) - (joinRight ? 0 : 1);
  px(ctx, t.ink, ox, oy + 1, TILE, 15);
  px(ctx, t.counterTop, x0, oy + 2, w, 7);
  px(ctx, t.counterLight, x0, oy + 2, w, 1);
  px(ctx, t.counterFront, x0, oy + 10, w, 5);
  px(ctx, t.counterDark, x0, oy + 13, w, 2);
}

// Máy hồi phục trên tường, rộng 2 ô, có 6 khe đặt Poké Ball
export const MACHINE_SLOTS = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 17 + (i % 3) * 5, y: 6 + Math.floor(i / 3) * 5 }));

function drawMachine(ctx, ox, oy) {
  px(ctx, '#3a3440', ox + 1, oy + 1, 30, 14);
  px(ctx, '#ece4d4', ox + 2, oy + 2, 28, 12);
  px(ctx, '#d4c8b4', ox + 2, oy + 11, 28, 3);
  px(ctx, '#3a3440', ox + 4, oy + 3, 9, 7);
  px(ctx, '#5ac8f0', ox + 5, oy + 4, 7, 5);
  px(ctx, '#c8f0ff', ox + 6, oy + 5, 2, 1);
  for (const s of MACHINE_SLOTS) {
    px(ctx, '#7a7068', ox + s.x - 2, oy + s.y - 2, 4, 4);
    px(ctx, '#5a5048', ox + s.x - 1, oy + s.y - 1, 2, 2);
  }
}

function drawPlant(ctx, ox, oy) {
  px(ctx, '#5a3a20', ox + 4, oy + 9, 8, 7);
  px(ctx, '#c07040', ox + 5, oy + 10, 6, 5);
  px(ctx, '#e09060', ox + 5, oy + 10, 6, 1);
  px(ctx, '#1f5a24', ox + 1, oy + 2, 14, 8);
  px(ctx, '#1f5a24', ox + 3, oy, 10, 2);
  px(ctx, '#2f7a30', ox + 2, oy + 2, 12, 7);
  px(ctx, '#45983a', ox + 4, oy + 1, 8, 6);
  px(ctx, '#68b84c', ox + 5, oy + 2, 3, 2);
}

function drawPC(ctx, ox, oy) {
  px(ctx, '#5a3a20', ox + 1, oy + 10, 14, 6);
  px(ctx, '#8a6040', ox + 2, oy + 11, 12, 4);
  px(ctx, '#3a3e48', ox + 2, oy, 12, 11);
  px(ctx, '#8a94a4', ox + 3, oy + 1, 10, 9);
  px(ctx, '#58a0e8', ox + 4, oy + 2, 8, 6);
  px(ctx, '#a8d8ff', ox + 5, oy + 3, 3, 2);
}

function drawBench(ctx, ox, oy) {
  px(ctx, '#5a3a20', ox + 2, oy + 11, 2, 5);
  px(ctx, '#5a3a20', ox + 12, oy + 11, 2, 5);
  px(ctx, '#6a2020', ox, oy + 4, TILE, 9);
  px(ctx, '#e05050', ox + 1, oy + 5, 14, 6);
  px(ctx, '#f08080', ox + 2, oy + 6, 12, 1);
  px(ctx, '#a03030', ox + 1, oy + 11, 14, 1);
}

const GOODS = ['#e05050', '#4a7ad8', '#f0c040', '#50b070', '#a050d0', '#f08030'];

function drawShelf(ctx, ox, oy, x, y) {
  px(ctx, '#5a3a20', ox, oy, TILE, TILE);
  px(ctx, '#a07040', ox + 1, oy + 1, 14, 14);
  px(ctx, '#7a5030', ox + 1, oy + 7, 14, 1);
  px(ctx, '#7a5030', ox + 1, oy + 14, 14, 1);
  for (const row of [1, 8]) {
    for (let i = 0; i < 4; i++) {
      const color = GOODS[Math.floor(hash(x * 4 + i, y * 2 + row, 80) * GOODS.length)];
      px(ctx, color, ox + 2 + i * 3, oy + row + 1, 2, 5);
      px(ctx, '#ffffff', ox + 2 + i * 3, oy + row + 1, 1, 1);
    }
  }
}

function drawMat(ctx, ox, oy) {
  px(ctx, '#7a2810', ox + 1, oy + 3, 14, 12);
  px(ctx, '#e06030', ox + 2, oy + 4, 12, 10);
  for (const dy of [6, 9, 12]) px(ctx, '#f08850', ox + 2, oy + dy, 12, 1);
}

export function drawInterior(map, ground, objects) {
  const t = THEMES[map.theme];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const ch = map.tileAt(x, y);
      const ox = x * TILE;
      const oy = y * TILE;
      if (isWall(ch)) drawWall(ground, ox, oy, !isWall(map.tileAt(x, y + 1)), t);
      else drawFloor(ground, ox, oy, x, y, t);

      if (ch === 'c') drawCounter(objects, ox, oy, map.tileAt(x - 1, y) === 'c', map.tileAt(x + 1, y) === 'c', t);
      else if (ch === 'm' && map.tileAt(x - 1, y) !== 'm') drawMachine(objects, ox, oy);
      else if (ch === 'p') drawPlant(objects, ox, oy);
      else if (ch === 'P') drawPC(objects, ox, oy);
      else if (ch === 'b') drawBench(objects, ox, oy);
      else if (ch === 'k') drawShelf(objects, ox, oy, x, y);
      else if (ch === 'E') drawMat(ground, ox, oy);
    }
  }
}
