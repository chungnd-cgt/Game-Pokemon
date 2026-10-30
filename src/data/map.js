// Các bản đồ trong game. Ký tự trong ROWS:
//  Ngoài trời: T cây (khối 2x2, toạ độ chẵn) • . cỏ • f hoa • g cỏ cao • G cỏ rậm • w nước • = đường • s biển báo
//  Trong nhà:  # tường • . sàn • c quầy • m máy hồi phục • p chậu cây • P máy tính • b ghế • k kệ hàng • E thảm cửa ra

const OUTDOOR_TILES = {
  T: { solid: true },
  '.': {},
  f: {},
  g: { encounter: 'meadow' },
  G: { encounter: 'deep' },
  w: { solid: true },
  '=': {},
  s: { solid: true },
};

const INDOOR_TILES = {
  '#': { solid: true },
  '.': {},
  c: { solid: true, counter: true },
  m: { solid: true },
  p: { solid: true },
  P: { solid: true },
  b: { solid: true },
  k: { solid: true },
  E: { exit: true },
};

const MAP_DEFS = {
  route1: {
    name: 'Tuyến đường 1',
    tiles: OUTDOOR_TILES,
    fallback: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT..................ggggggggTTGGGGGGGGTT',
      'TT..................ggggggggTTGGGGGGGGTT',
      'TT..................ggggggggTTGGGGGGGGTT',
      'TT..................ggggggggTTGGGGGGGGTT',
      'TT..................gggggggg..GGGGGGGGTT',
      'TT....=.s...=.s.....gggggggg..GGGGGGGGTT',
      'TT.f..=.....=....s................=...TT',
      'TT....=============================...TT',
      'TT..................=.................TT',
      'TT.......f..........=.................TT',
      'TT..................=.................TT',
      'TT..................=.................TT',
      'TT..........TT......=.................TT',
      'TT..........TT......=...f.............TT',
      'TT.gggggggg............wwwwww.........TT',
      'TT.gggggggg...........wwwwwwww........TT',
      'TT.gggggggg...........wwwwwwww....f...TT',
      'TT.gggggggg...........wwwwwwww........TT',
      'TT.gggggggg.....TTTT...wwwwww.........TT',
      'TT.gggggggg.....TTTT..................TT',
      'TT..............TTTT........GGGGGGGG..TT',
      'TT...f..........TTTT........GGGGGGGG..TT',
      'TT..........................GGGGGGGG..TT',
      'TT....................................TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    // Đi vào cửa (đi lên) thì sang bản đồ `to`
    buildings: [
      { type: 'center', x: 4, y: 3, w: 5, h: 4, door: { x: 6, y: 6 }, to: 'center' },
      { type: 'mart', x: 11, y: 3, w: 4, h: 4, door: { x: 12, y: 6 }, to: 'mart' },
    ],
    signs: {
      '8,7': ['POKéMON CENTER', 'Hồi phục Pokémon của bạn miễn phí!'],
      '14,7': ['POKé MART', 'Bán Poké Ball, thuốc hồi phục và nhiều thứ khác!'],
      '17,8': ['TUYẾN ĐƯỜNG 1', '↑ Bụi cỏ phía bắc   → Bụi cỏ rậm phía đông   ↓ Hồ nước'],
    },
  },

  center: {
    name: 'Pokémon Center',
    indoor: true,
    theme: 'center',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '#############',
      '#######mm####',
      '.............',
      'pcccccccccccp',
      '............P',
      '.bb.......bb.',
      '.............',
      '.............',
      '......E......',
    ],
    entry: { x: 6, y: 7 }, // chỗ đứng khi vừa vào nhà
    exit: { to: 'route1', x: 6, y: 7 }, // bước lên thảm E thì ra chỗ này
  },

  mart: {
    name: 'Poké Mart',
    indoor: true,
    theme: 'mart',
    tiles: INDOOR_TILES,
    fallback: '#',
    rows: [
      '###########',
      '###########',
      '..kkk.kk.kk',
      'cck........',
      '...........',
      '.....kk.kk.',
      '.....kk.kk.',
      '...........',
      '.....kk.kk.',
      '...E......p',
    ],
    entry: { x: 3, y: 8 },
    exit: { to: 'route1', x: 12, y: 7 },
  },
};

class GameMap {
  constructor(id, def) {
    Object.assign(this, { buildings: [], signs: {}, indoor: false }, def);
    this.id = id;
    this.width = Math.max(...def.rows.map((r) => r.length));
    this.height = def.rows.length;
  }

  // Ngoài bản đồ hoặc ký tự lạ thì coi như ô cản (cây / tường)
  tileAt(x, y) {
    const ch = this.rows[y]?.[x];
    return ch && this.tiles[ch] ? ch : this.fallback;
  }

  info(x, y) {
    return this.tiles[this.tileAt(x, y)];
  }

  buildingAt(x, y) {
    return this.buildings.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) ?? null;
  }

  doorAt(x, y) {
    return this.buildings.find((b) => b.door.x === x && b.door.y === y) ?? null;
  }

  isSolid(x, y) {
    return Boolean(this.info(x, y).solid || this.buildingAt(x, y));
  }

  signAt(x, y) {
    return this.signs[`${x},${y}`] ?? null;
  }
}

export const MAPS = Object.fromEntries(Object.entries(MAP_DEFS).map(([id, def]) => [id, new GameMap(id, def)]));

// Bắt đầu trước cửa Pokémon Center. Thua trận thì tỉnh dậy trong Pokémon Center, trước mặt Y tá Joy.
export const SPAWN = { map: 'route1', x: 6, y: 7, facing: 'down' };
export const HEAL_RESPAWN = { map: 'center', x: 6, y: 4, facing: 'up' };
