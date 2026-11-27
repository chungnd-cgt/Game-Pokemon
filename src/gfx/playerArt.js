// Hình pixel art của nhân vật (người chơi, NPC) vẽ trên lưới logic, không phụ thuộc Phaser / canvas
// (gfx/player.js phóng to lưới này thành texture; tests/character-custom.test.js vẽ thử mọi kiểu tuỳ chỉnh).
// Kiểu GBA (Gen 3): lưới 16x24 (chân chạm hàng dưới cùng), đầu to thân ngắn, viền tối 1px,
// mỗi chất liệu 2-3 tông (sáng trên-trái, tối phải-dưới). Mỗi nhân vật có 3 hướng (down/up/side, side = nhìn sang trái) x 3 frame.

export const LW = 16; // lưới logic
export const LH = 24;
export const PLAYER_FRAMES = ['stand', 'left', 'right'];
export const DIRS = ['down', 'up', 'side'];

// Lưới pixel logic: mỗi ô là màu '#rrggbb' hoặc null (giống PixelBuffer của gfx/pixel.js, nhưng không cần Phaser)
export class PixelGrid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Array(w * h).fill(null);
  }

  set(x, y, c) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : null;
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
}

// Làm sáng (f > 0) hoặc tối (f < 0) một màu dạng '#rrggbb' (giống shadeHex của gfx/pixel.js)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const INK = '#282030';
const EYE = '#202030';

// Vẽ lưới ký tự lên buffer: '.' bỏ qua, '_' xoá pixel, ký tự khác lấy màu trong bảng pal (không có thì bỏ qua)
function stamp(p, rows, pal, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      if (ch === '_') p.set(ox + x, oy + y, null);
      else if (pal[ch]) p.set(ox + x, oy + y, pal[ch]);
    }
  });
}

// Lật ngang một mẫu (dùng cho các bước chân đối xứng)
const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

// Bảng màu theo vai trò: mỗi chữ cái trong mẫu là một vai trò (da, tóc, mũ, áo...)
function palette(look) {
  const hat = look.hat ?? '#e04040';
  // Áo ba lỗ (tank): không có tay áo, hai cánh tay để trần màu da
  const sleeve = look.tank ? look.skin : look.coat ?? look.shirt;
  const hand = look.gloves ?? look.skin;
  const skirt = look.skirt ?? look.shirt;
  const pack = look.backpack ?? look.bag ?? '#a06030';
  const coat = look.coat ?? look.shirt;
  const accent = look.hatAccent ?? shade(hat, 0.6);
  return {
    k: INK,
    S: look.skin, s: shade(look.skin, -0.14), z: shade(look.skin, -0.3), r: look.blush ?? '#f08880',
    E: look.eyes ? shade(look.eyes, -0.45) : EYE, I: look.eyes ?? EYE, W: '#ffffff',
    H: look.hair, h: shade(look.hair, -0.32), L: shade(look.hair, 0.3),
    T: hat, t: shade(hat, -0.2), U: shade(hat, 0.4), R: shade(hat, -0.4), V: accent, v: shade(accent, -0.22),
    C: look.shirt, c: shade(look.shirt, -0.24), l: shade(look.shirt, 0.25),
    A: sleeve, a: shade(sleeve, -0.24), Q: shade(sleeve, 0.25),
    O: coat, o: shade(coat, -0.2), q: shade(coat, -0.4),
    G: hand, g: shade(hand, -0.2),
    D: skirt, d: shade(skirt, -0.25), e: shade(skirt, 0.22),
    P: look.pants, p: shade(look.pants, -0.3), n: shade(look.pants, 0.2),
    F: look.shoes, f: shade(look.shoes, -0.32),
    B: look.belt ?? INK, b: shade(look.belt ?? INK, 0.35),
    K: pack, J: shade(pack, 0.3), j: shade(pack, -0.28),
    X: '#e83850', w: '#d8d0dc',
  };
}

// ---------- Chân (quần / váy / giày) ----------

const LEGS = {
  // Nhìn thẳng / nhìn sau: hai chân tách nhau, bước đi thì nhấc một bàn chân lên 1px
  front: {
    stand: [
      '....nPPPPPPp....', // 18 hông
      '....nPP..PPp....',
      '....PPP..PPp....',
      '...FFFF..FFFf...',
      '...ffff..ffff...',
    ],
    left: [ // nhấc chân phải
      '....nPPPPPPp....',
      '....nPP..PPp....',
      '....PPP..FFFf...',
      '...FFFF..ffff...',
      '...ffff.........',
    ],
    right: [ // nhấc chân trái
      '....nPPPPPPp....',
      '....nPP..PPp....',
      '...FFFF..PPp....',
      '...ffff..FFFf...',
      '.........ffff...',
    ],
  },
  frontSkirt: {
    stand: [
      '...eDDDDDDDd....', // 18 (váy bắt đầu từ hàng 17, xem SKIRT)
      '...dddddddddd...',
      '.....SS..Ss.....',
      '....FFF..FFf....',
      '....fff..fff....',
    ],
    left: [
      '...eDDDDDDDd....',
      '...dddddddddd...',
      '.....SS..FFf....',
      '....FFF..fff....',
      '....fff.........',
    ],
    right: [
      '...eDDDDDDDd....',
      '...dddddddddd...',
      '....FFF..Ss.....',
      '....fff..FFf....',
      '.........fff....',
    ],
  },
  // Nhìn ngang (sang trái): đứng thì hai chân chồng nhau, bước thì chân trước vươn ra trái, chân sau ra phải
  side: {
    stand: [
      '.....nPPPPp.....',
      '......PPPp......',
      '......PPPp......',
      '.....FFFFf......',
      '.....ffffff.....',
    ],
    near: [ // chân gần (sáng) bước lên trước
      '.....nPPPPp.....',
      '.....PPPppp.....',
      '....PPP..ppp....',
      '...FFFF...ff....',
      '...ffff...fff...',
    ],
    far: [ // chân xa (tối) bước lên trước
      '.....nPPPPp.....',
      '.....pppPPP.....',
      '....ppp..PPP....',
      '...ffff...FFF...',
      '...fff....FFFf..',
    ],
  },
  sideSkirt: {
    stand: [
      '....eDDDDDDd....',
      '....dddddddd....',
      '......SSs.......',
      '.....FFFf.......',
      '.....fffff......',
    ],
    near: [
      '....eDDDDDDd....',
      '....dddddddd....',
      '.....SS..ss.....',
      '...FFFF...ff....',
      '...ffff...fff...',
    ],
    far: [
      '....eDDDDDDd....',
      '....dddddddd....',
      '.....ss..SS.....',
      '...ffff...FFF...',
      '...fff....FFFf..',
    ],
  },
};

// Quần short: chỉ 2 hàng trên (hông, đùi) là vải, từ trên gối trở xuống là chân trần màu da
const BARE = { P: 'S', n: 'S', p: 's' };
const toShorts = (rows) => rows.map((r, i) => (i < 2 ? r : r.replace(/[Pnp]/g, (c) => BARE[c])));

function drawLegs(p, pal, look, dir, step) {
  const skirt = Boolean(look.dress);
  const fit = (rows) => (look.shorts && !skirt ? toShorts(rows) : rows);
  if (dir === 'side') {
    const set = skirt ? LEGS.sideSkirt : LEGS.side;
    const rows = step === 'stand' ? set.stand : step === 'left' ? set.near : set.far;
    if (skirt) stamp(p, ['....eDDDDDDd....'], pal, 0, 17);
    stamp(p, fit(rows), pal, 0, 18);
    return;
  }
  const set = skirt ? LEGS.frontSkirt : LEGS.front;
  const rows = set[step];
  if (skirt) stamp(p, ['....eDDDDDDd....'], pal, 0, 17);
  stamp(p, fit(rows), pal, 0, 18);
}

// ---------- Thân (áo, tay, áo khoác, ba lô, túi, thắt lưng) ----------

const TORSO = {
  front: [
    '....lCCCCCCc....', // 13 vai
    '....lCCCCCCc....',
    '....lCCCCCcc....',
    '....lCCCCCcc....',
    '....cCCCCCcc....', // 17
  ],
  side: [
    '.....lCCCCc.....',
    '.....lCCCCc.....',
    '.....lCCCcc.....',
    '.....lCCCcc.....',
    '.....cCCCcc.....',
  ],
};

// Áo ba lỗ: hai dây vai mảnh, cổ áo khoét sâu và nách để lộ da (S / s)
const TANK = {
  down: [
    '....SlSSSSCs....', // 13 dây vai
    '....slCSSCcs....', // 14 cổ khoét
    '....lCCCCCcc....',
    '....lCCCCCcc....',
    '....cCCCCCcc....', // 17
  ],
  up: [
    '....SlSSSSCs....',
    '....slCCCCcs....',
    '....lCCCCCcc....',
    '....lCCCCCcc....',
    '....cCCCCCcc....',
  ],
  side: [
    '.....SSlCCs.....', // 13 vai trần, dây áo
    '.....slCCCc.....',
    '.....lCCCcc.....',
    '.....lCCCcc.....',
    '.....cCCCcc.....',
  ],
};

const COAT = {
  down: [
    '...QOOCCOOoo....', // 13 vạt áo khoác mở, lộ áo bên trong
    '...QOOCCOOoo....',
    '...QOOOCOOoo....',
    '...QOOOOOOoo....',
    '...QOOOOOOoo....',
    '...QOOOkOOoo....', // 18 vạt dưới che hông
    '...OOOO.OOoo....',
  ],
  up: [
    '...QOOOOOOoo....',
    '...QOOOOOOoo....',
    '...QOOOOOOoo....',
    '...QOOOOOOoo....',
    '...QOOOOOOoo....',
    '...QOOOkOOoo....',
    '...OOOO.OOoo....',
  ],
  side: [
    '.....QOOOOo.....',
    '.....QOOOOoo....',
    '.....QOOOOoo....',
    '.....QOOOOoo....',
    '.....QOOOOoo....',
    '.....OOOOOoo....',
    '......OOOooo....',
  ],
};

// Tay nhìn thẳng: tay trái (màn hình) sáng, tay phải tối; d = độ vung (-1 tay ngắn lại, +1 dài ra)
function drawArmsFront(p, pal, d) {
  const [dl, dr] = d;
  const arm = (x0, dd, sleeve, sleeveDark, hand) => {
    p.set(x0 === 2 ? 3 : 12, 13, sleeve);
    p.rect(x0, 14, 2, 1 + dd + 1, sleeve);
    p.set(x0 === 2 ? 2 : 13, 14, x0 === 2 ? sleeve : sleeveDark);
    p.rect(x0, 16 + dd, 2, 1, hand);
  };
  arm(2, dl, pal.A, pal.A, pal.G);
  arm(12, dr, pal.a, pal.a, pal.g);
  // vạch tối ngăn tay với thân cho dễ nhìn
  p.set(4, 15 + Math.max(0, dl), shade(pal.C, -0.18));
}

function drawArmSide(p, pal, step) {
  // tay gần người xem (viền tối phía sau tay để tách khỏi thân); bước đi thì vung ra trước / sau
  const rows = {
    stand: [
      '.......AA.......',
      '.......AAk......',
      '.......Aak......',
      '.......GG.......',
    ],
    left: [
      '......AAk.......',
      '.....AAk........',
      '....AAk.........',
      '...GG...........',
    ],
    right: [
      '.......AA.......',
      '.......kAA......',
      '........kAA.....',
      '.........kGG....',
    ],
  }[step];
  stamp(p, rows, pal, 0, 13);
}

const PACK = {
  up: [
    '....JJJJJJJK....',
    '....JKKKKKKj....',
    '....KKKbbKKj....',
    '....KKKKKKKj....',
    '.....jjjjjj.....',
  ],
  side: [
    '..........JJ....',
    '..........KKj...',
    '..........KKj...',
    '..........KKj...',
    '...........jj...',
  ],
};

function drawTorso(p, pal, look, dir, step) {
  const swing = { stand: [0, 0], left: [1, -1], right: [-1, 1] }[step];
  if (dir === 'side') {
    stamp(p, look.tank ? TANK.side : TORSO.side, pal, 0, 13);
    if (look.coat) stamp(p, COAT.side, pal, 0, 13);
    if (look.belt && !look.coat) stamp(p, ['.....BBBBBB.....'], pal, 0, 17);
    if (look.backpack) stamp(p, PACK.side, pal, 0, 13);
    if (look.bag) stamp(p, ['.........KJ.....', '.........K......', '........jKKK....', '........KKKj....', '.........jj.....'], pal, 0, 13);
    drawArmSide(p, pal, step);
    return;
  }
  stamp(p, look.tank ? TANK[dir] : TORSO.front, pal, 0, 13);
  if (look.coat) stamp(p, dir === 'down' ? COAT.down : COAT.up, pal, 0, 13);
  if (look.belt && !look.coat) stamp(p, [dir === 'down' ? '....BBBbbBBB....' : '....BBBBBBBB....'], pal, 0, 17);
  if (look.backpack) {
    if (dir === 'down') {
      p.set(5, 13, pal.j);
      p.set(5, 14, pal.j);
      p.set(10, 13, pal.j);
      p.set(10, 14, pal.j);
    } else stamp(p, PACK.up, pal, 0, 13);
  }
  if (look.bag) {
    // túi đeo chéo: dây từ vai xuống hông, túi nhỏ bên hông
    const strap = dir === 'down' ? [[10, 13], [9, 14], [8, 15], [7, 16], [6, 17]] : [[5, 13], [6, 14], [7, 15], [8, 16], [9, 17]];
    for (const [x, y] of strap) p.set(x, y, pal.j);
    stamp(p, ['JKK', 'KKj', 'jjj'], pal, dir === 'down' ? 3 : 10, 17);
  }
  drawArmsFront(p, pal, swing);
}

// ---------- Đầu và tóc ----------

const FACE = {
  down: [
    '....SSSSSSSS....', // 4
    '...SSSSSSSSSS...',
    '..SSSSSSSSSSSS..',
    '..SSSSSSSSSSSs..',
    '..SSSSSSSSSSSs..',
    '..SSSESSSSESSs..', // 9 mắt
    '..SSSISSSSISss..',
    '...rSSSSSSrss...',
    '....sSSSSSss....', // 12 cằm
  ],
  up: [
    '....SSSSSSSS....',
    '...SSSSSSSSSS...',
    '..SSSSSSSSSSSS..',
    '..SSSSSSSSSSSs..',
    '..SSSSSSSSSSSs..',
    '..SSSSSSSSSSSs..',
    '..SSSSSSSSSSss..',
    '...SSSSSSSSss...',
    '....ssssssss....',
  ],
  side: [
    '....SSSSSSSS....',
    '...SSSSSSSSSS...',
    '..SSSSSSSSSSSs..',
    '..SSSSSSSSSSSs..',
    '.SSSSSSSSSSSss..',
    '.SSESSSSSSSSss..',
    '..SISSSSSSSSs...',
    '..SrSSSSSSSss...',
    '...SSSSSSss.....',
  ],
};

// Mỗi kiểu tóc: back = phần nằm sau thân (vẽ trước thân), front = phần trên đầu (vẽ sau mặt). Mẫu bắt đầu từ hàng y0.
const HAIR = {
  short: {
    down: { y: 2, front: [
      '................',
      '.....HHHHHH.....',
      '...HHLLLHHHHh...',
      '..HLLHHHHHHHHh..',
      '..HLHHHHHHHHHh..',
      '..HHHHHHHHHHHh..',
      '..HHHhHHHHhHhh..',
      '..HHH......Hhh..',
      '..H..........h..',
    ] },
    up: { y: 2, front: [
      '................',
      '.....HHHHHH.....',
      '...HHLLLHHHHh...',
      '..HLLHHHHHHHHh..',
      '..HLHHHHHHHHHh..',
      '..HHHHHHHHHHHh..',
      '..HHHHHHHHHHhh..',
      '..HHHHHHHHHHhh..',
      '..hHHHHHHHHhhh..',
      '...hhHHHHHhhh...',
    ] },
    side: { y: 2, front: [
      '................',
      '.....HHHHHH.....',
      '...HHLLLHHHHh...',
      '..HLLHHHHHHHHh..',
      '..HLHHHHHHHHHh..',
      '.HHHHHHHHHHHHh..',
      '.HH.HHHHHHHHhh..',
      '......zHHHHHhh..',
      '......zHHHHhh...',
      '........hHhh....',
    ] },
  },
};

// Các kiểu tóc khác dựa trên tóc ngắn rồi thêm/bớt
HAIR.spiky = {
  down: { y: 0, front: [
    '...H...HH...H...',
    '...HH.HHHH.HH...',
    '...HHHHHHHHHHh..',
    ...HAIR.short.down.front.slice(1),
  ] },
  up: { y: 0, front: [
    '...H...HH...H...',
    '...HH.HHHH.HH...',
    '...HHHHHHHHHHh..',
    ...HAIR.short.up.front.slice(1),
  ] },
  side: { y: 0, front: [
    '.......H..H.....',
    '......HH.HH..H..',
    '.....HHHHHHHHh..',
    ...HAIR.short.side.front.slice(1, 6),
    '.HH.HHHHHHHHhhh.',
    '......zHHHHHhhh.',
    '......zHHHHhh...',
    '........hHhh....',
  ] },
};

HAIR.long = {
  down: {
    y: 2,
    front: HAIR.short.down.front,
    back: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '.HH..........hh.',
      '.HH..........hh.',
      '.HH..........hh.',
      '.HH..........hh.',
      '.HH..........hh.',
      '.HH..........hh.',
      '.HHH........hhh.',
      '.hHH........hhh.',
      '..hh........hh..',
    ],
  },
  up: {
    y: 2,
    front: [
      ...HAIR.short.up.front.slice(0, 8),
      '..HHHHHHHHHHhh..',
      '..HHHHHHHHHHhh..',
      '..HHHHHhHHHHhh..',
      '..HHHHHhHHhHhh..',
      '..HHHhHHHHhHhh..',
      '...HHHHHHHHhh...',
      '...hHHHHHHHhh...',
      '....hhhhhhhh....',
    ],
  },
  side: {
    y: 2,
    front: [
      ...HAIR.short.side.front.slice(0, 7),
      '......zHHHHHhh..',
      '......zHHHHHhh..',
      '........HHHHhh..',
      '.........HHHhh..',
      '.........HHHhh..',
      '.........HHHhh..',
      '.........hHHhh..',
      '..........hhh...',
    ],
  },
};

HAIR.bun = {
  down: { y: 0, front: [
    '......HHHH......',
    '.....HLHHHh.....',
    '......hhhh......',
    ...HAIR.short.down.front.slice(1),
  ] },
  up: { y: 0, front: [
    '......HHHH......',
    '.....HLHHHh.....',
    '......hhhh......',
    ...HAIR.short.up.front.slice(1),
  ] },
  side: { y: 0, front: [
    '................',
    '..........HHH...',
    '.........HLHHh..',
    '.....HHHHHhhh...',
    ...HAIR.short.side.front.slice(2),
  ] },
};

// Ông lão: đỉnh đầu hói (để lộ da), tóc bạc hai bên, lông mày rậm
HAIR.old = {
  down: { y: 7, front: [
    '..H..........h..',
    '..HHHHH..HHHhh..',
    '..HH........hh..',
    '..H..........h..',
  ] },
  up: { y: 7, front: [
    '..H..........h..',
    '..HHHHHHHHHHhh..',
    '..HHHHHHHHHHhh..',
    '..hHHHHHHHHHhh..',
    '...hhHHHHHhhh...',
  ] },
  side: { y: 7, front: [
    '.......HHHHHh...',
    '...H..HHHHHHhh..',
    '......zHHHHHhh..',
    '......zHHHHhh...',
    '........hHhh....',
  ] },
};

// Chồng mẫu top lên mẫu base (ký tự '.' của top giữ nguyên base), top lệch xuống dy hàng
const overlay = (base, top, dy = 0) =>
  base.map((row, y) => [...row].map((ch, x) => (top[y - dy]?.[x] && top[y - dy][x] !== '.' ? top[y - dy][x] : ch)).join(''));

// Tóc đuôi ngựa: tóc ngắn phía trước, buộc dây đỏ (X) sau gáy, đuôi tóc thả xuống lưng
HAIR.ponytail = {
  down: {
    y: 2,
    front: HAIR.short.down.front,
    // nhìn thẳng: đuôi tóc ló ra sau vai phải
    back: [
      '................', // 2
      '................',
      '................',
      '................',
      '................',
      '................',
      '..............Hh', // 8
      '..............Hh',
      '..............Hh',
      '.............HHh',
      '.............Hh.',
      '.............Hh.',
      '.............h..', // 14
    ],
  },
  up: {
    y: 2,
    front: overlay([...HAIR.short.up.front, '................', '................', '................', '................'], [
      '................', // 4
      '.......XX.......', // 5 dây buộc
      '................',
      '................',
      '................',
      '................',
      '................', // 10
      '......hHHh......',
      '......hHLh......',
      '.......HLh......',
      '.......hHh......',
      '........h.......', // 15
    ], 2),
  },
  side: {
    y: 2,
    front: overlay([...HAIR.short.side.front, '................', '................', '................'], [
      '................', // 4
      '.............H..', // 5 gốc đuôi tóc
      '.............XLh', // 6 dây buộc
      '..............Hh',
      '..............Hh',
      '..............Hh',
      '.............Hh.', // 10
      '.............Hh.',
      '............Hh..',
      '............h...', // 13
    ], 2),
  },
};

// Đầu đinh (nam): tóc cắt sát ôm đầu, lộ trán và gáy, mái chỉ lởm chởm vài sợi
HAIR.buzz = {
  down: { y: 2, front: [
    '................',
    '.....hHHHHh.....',
    '...hHLLHHHHHh...',
    '..hHLHHHHHHHHh..',
    '..HHHHHHHHHHHh..',
    '..hHhHHhHHhHhh..',
    '..h..........h..',
  ] },
  up: { y: 2, front: [
    '................',
    '.....hHHHHh.....',
    '...hHLLHHHHHh...',
    '..hHLHHHHHHHHh..',
    '..HHHHHHHHHHHh..',
    '..HHHHHHHHHHHh..',
    '..HHHHHHHHHHhh..',
    '..hHHHHHHHHhhh..',
    '..zhhhhhhhhhhz..',
  ] },
  side: { y: 2, front: [
    '................',
    '.....hHHHHh.....',
    '...hHLLHHHHHh...',
    '..hHLHHHHHHHHh..',
    '.hHHHHHHHHHHHh..',
    '.h..hHHHHHHHhh..',
    '.......HHHHHhh..',
    '......z.hHHhh...',
    '.........hh.....',
  ] },
};

// Tóc hai bên (nữ): tóc ngắn phía trước, hai túm buộc dây đỏ (X) hai bên đầu thả xuống vai
const TWIN_TAILS = [
  '................', // 2
  '................',
  '................',
  '................',
  '................',
  '.X............X.', // 7 dây buộc
  'HHh..........HHh',
  'HLh..........HLh',
  'HHh..........HHh',
  'HHh..........HHh',
  '.Hh..........Hh.',
  '.Hh..........Hh.',
  '.h............h.', // 14
];
HAIR.twintails = {
  down: { y: 2, front: HAIR.short.down.front, back: TWIN_TAILS },
  up: { y: 2, front: HAIR.short.up.front, back: TWIN_TAILS },
  // nhìn ngang: một túm sau tai thả xuống vai
  side: {
    y: 2,
    front: overlay([...HAIR.short.side.front, '................', '................', '................'], [
      '................', // 4
      '................',
      '................',
      '............X...', // 7 dây buộc
      '...........HHh..',
      '...........HLHh.',
      '............HHh.', // 10
      '............HHh.',
      '............Hh..',
      '............h...', // 13
    ], 2),
  },
};

// Tóc dưới mũ lưỡi trai (chỉ lộ tóc mai và gáy)
const UNDER_CAP = {
  down: { y: 9, front: ['..HH........hh..', '..H..........h..'] },
  up: { y: 9, front: ['..HHHHHHHHHHhh..', '..hHHHHHHHHhhh..', '...hhHHHHHhhh...'] },
  side: { y: 9, front: ['......zHHHHHhh..', '......zHHHHhh...', '........hHhh....'] },
};

// Mũ: T màu mũ, U sáng, t tối, R lưỡi trai, V logo / dải màu
const HATS = {
  cap: {
    down: { y: 2, rows: [
      '......UUTt......',
      '....UUTTTTTt....',
      '...UTTTVVTTTt...',
      '..UTTTTVVTTTTt..',
      '..TTTTTTTTTTTt..',
      '..TTTTTTTTTTtt..',
      '.RRRRRRRRRRRRRR.',
    ] },
    up: { y: 2, rows: [
      '......UUTt......',
      '....UUTTTTTt....',
      '...UTTTTTTTTt...',
      '..UTTTTTTTTTTt..',
      '..TTTTTTTTTTTt..',
      '..TTTTTWWTTTtt..',
      '..tttttttttttt..',
    ] },
    side: { y: 2, rows: [
      '......UUTt......',
      '....UUTTTTTt....',
      '...UTTTTTTTTt...',
      '..UTVVTTTTTTTt..',
      '..TTVVTTTTTTTt..',
      '..TTTTTTTTTTtt..',
      'RRRRRRTTTTTtt...',
    ] },
  },
  // Mũ len có quả bông (V) và gấu mũ gấp lên (V / v sọc len)
  beanie: {
    down: { y: 1, rows: [
      '.......VVv......',
      '.....UUTTTt.....',
      '....UTTTTTTt....',
      '...UTTTTTTTTt...',
      '..UTTTTTTTTTTt..',
      '..TTTTTTTTTTTt..',
      '..VVVVVVVVVVVv..',
      '..VvVvVvVvVvvv..',
    ] },
    up: { y: 1, rows: [
      '.......VVv......',
      '.....UUTTTt.....',
      '....UTTTTTTt....',
      '...UTTTTTTTTt...',
      '..UTTTTTTTTTTt..',
      '..TTTTTTTTTTTt..',
      '..VVVVVVVVVVVv..',
      '..VvVvVvVvVvvv..',
    ] },
    side: { y: 1, rows: [
      '........VVv.....',
      '.....UUTTTt.....',
      '....UTTTTTTt....',
      '...UTTTTTTTTt...',
      '..UTTTTTTTTTTt..',
      '.UTTTTTTTTTTTt..',
      '.VVVVVVVVVVVVv..',
      '.VvVvVvVvVvVvv..',
    ] },
  },
  // Mũ rộng vành (nón đi nắng) có dải màu
  sunhat: {
    down: { y: 1, rows: [
      '.....UUTTTt.....',
      '....UTTTTTTt....',
      '....TTTTTTTt....',
      '....VVVVVVVV....',
      '.UUTTTTTTTTTTtt.',
      '.tttttttttttttt.',
    ] },
    up: { y: 1, rows: [
      '.....UUTTTt.....',
      '....UTTTTTTt....',
      '....TTTTTTTt....',
      '....VVVVVVVV....',
      '.UUTTTTTTTTTTtt.',
      '.tttttttttttttt.',
    ] },
    side: { y: 1, rows: [
      '.....UUTTTt.....',
      '....UTTTTTTt....',
      '....TTTTTTTt....',
      '....VVVVVVVV....',
      '.UUTTTTTTTTTTtt.',
      '..tttttttttttt..',
    ] },
  },
};

// Tóc dài dưới nón rộng vành
const UNDER_SUNHAT = {
  down: { y: 7, front: ['..HHHHHHHHHHhh..', '..HH.HHHHHH.hh..', '..H..........h..', '..H..........h..'], back: HAIR.long.down.back.slice(5) },
  up: { y: 7, front: [
    '..HHHHHHHHHHhh..',
    '..HHHHHHHHHHhh..',
    '..HHHHHHHHHHhh..',
    '..HHHHHhHHHHhh..',
    '..HHHHHhHHHHhh..',
    '..HHHHHHHHhHhh..',
    '..HHHhHHHHhHhh..',
    '...HHhHHHHHhh...',
    '...hHHHHHHHhh...',
    '....hhhhhhhh....',
  ] },
  side: { y: 7, front: [
    '..HHHHHHHHHHhh..',
    '..H.HHHHHHHHhh..',
    '......zHHHHHhh..',
    '......zHHHHHhh..',
    '........HHHHhh..',
    '.........HHHhh..',
    '.........HHHhh..',
    '.........HHHhh..',
    '.........hHHhh..',
    '..........hhh...',
  ] },
};

// Y tá: tóc hồng hai búi tròn hai bên, mũ trắng có chữ thập đỏ
const NURSE = {
  down: { y: 0, front: [
    '.....WWWWWW.....',
    '.....WWXXWW.....',
    '.....WXXXXW.....',
    '.....wWXXWw.....',
    ...HAIR.short.down.front.slice(3, 8),
    '.HHH........hhh.',
    'HHLH........hHHh',
    'HHHh........hhhh',
    '.hh..........hh.',
  ] },
  up: { y: 0, front: [
    '.....WWWWWW.....',
    '.....WWWWWW.....',
    '.....WWWWWW.....',
    '.....wwwwww.....',
    ...HAIR.short.up.front.slice(3, 8),
    '.HHHHHHHHHHHhhh.',
    'HHLHHHHHHHHHhHHh',
    'HHHhHHHHHHhhhhhh',
    '.hh.hhHHHhhh.hh.',
  ] },
  side: { y: 0, front: [
    '................',
    '....WWWWWW......',
    '....WXXWWW......',
    '....wwwwww......',
    ...HAIR.short.side.front.slice(3, 9),
    '........hHhHHh..',
    '..........HLHHh.',
    '..........hHHh..',
  ] },
};

function drawHead(p, pal, look, dir, layer) {
  const style = look.hairStyle;
  const hairPart = (spec) => {
    if (!spec) return;
    const rows = layer === 'back' ? spec.back : spec.front;
    if (rows) stamp(p, rows, pal, 0, spec.y);
  };
  if (layer === 'back') {
    if (style === 'long' || style === 'ponytail' || style === 'twintails') hairPart(HAIR[style][dir]);
    if (style === 'sunhat') hairPart(UNDER_SUNHAT[dir]);
    return;
  }
  stamp(p, FACE[dir], pal, 0, 4);
  if (style === 'cap') {
    hairPart(UNDER_CAP[dir]);
    stamp(p, HATS.cap[dir].rows, pal, 0, HATS.cap[dir].y);
  } else if (style === 'beanie') {
    hairPart(UNDER_CAP[dir]);
    stamp(p, HATS.beanie[dir].rows, pal, 0, HATS.beanie[dir].y);
  } else if (style === 'sunhat') {
    hairPart(UNDER_SUNHAT[dir]);
    stamp(p, HATS.sunhat[dir].rows, pal, 0, HATS.sunhat[dir].y);
  } else if (style === 'nurse') {
    hairPart(NURSE[dir]);
  } else {
    hairPart((HAIR[style] ?? HAIR.short)[dir]);
  }
  // Lông mi (người chơi nữ): vệt mực ở đuôi mắt, vẽ đè lên tóc mai
  if (look.lashes) {
    if (dir === 'down') {
      p.set(4, 9, INK);
      p.set(11, 9, INK);
    } else if (dir === 'side') p.set(2, 9, INK);
  }
}

// ---------- Ghép nhân vật ----------

function drawCharacter(look, dir, step, pal = palette(look)) {
  const p = new PixelGrid(LW, LH);
  drawHead(p, pal, look, dir, 'back');
  drawLegs(p, pal, look, dir, step);
  drawTorso(p, pal, look, dir, step);
  drawHead(p, pal, look, dir, 'front');
  return p;
}

// Viền tối kiểu GBA: pixel trống sát hình tô bằng màu kề bên làm tối đi nhiều, ngả về mực tím than
function inkOutline(p) {
  const src = [...p.data];
  const at = (x, y) => (x >= 0 && y >= 0 && x < p.w && y < p.h ? src[y * p.w + x] : null);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (at(x, y)) continue;
      const n = at(x, y - 1) ?? at(x - 1, y) ?? at(x + 1, y) ?? at(x, y + 1);
      if (n) p.set(x, y, mixHex(shade(n, -0.6), INK, 0.45));
    }
  }
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (n, s) => (n >> s) & 255;
  const c = [16, 8, 0].map((s) => Math.round(ch(pa, s) * (1 - t) + ch(pb, s) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function blit(dst, src, ox, oy = 0) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = src.data[y * src.w + x];
      if (c) dst.set(ox + x, oy + y, c);
    }
  }
}

// ---------- Xe đạp ----------

// Xe đạp to hơn người: frame 20x27 logic (60x81), người ngồi cao hơn mặt đất 3px, đặt lệch vào giữa
const BW = 20;
const BH = 27;
const BIKE_OX = 2;

// Bánh xe nhìn ngang: lốp tối, nan hoa xám, trục giữa
const WHEEL = [
  '..yyy..',
  '.yMMMy.',
  'yMmMmMy',
  'yMMkMMy',
  'yMmMmMy',
  '.yMMMy.',
  '..yyy..',
];
// Khung xe nhìn ngang (đầu xe bên trái): càng trước, ống trên, ống chéo, ống yên, gióng sau
const BIKE_TUBES = [
  [6, 17], [5, 18], [5, 19], [4, 20], [4, 21],
  [7, 17], [8, 17], [9, 17], [10, 18], [11, 18], [12, 18],
  [6, 18], [7, 19], [8, 20], [9, 21],
  [12, 19], [11, 20], [11, 21],
  [12, 22], [13, 22], [14, 22],
  [13, 19], [14, 20], [14, 21],
];

function bikePalette(frame) {
  return { k: '#30303a', M: '#b8c0d0', m: '#7880a0', N: frame, n: shade(frame, -0.3), Y: '#40424c', y: '#26272f', W: '#e0e4f0' };
}

// Chân khi đạp xe (toạ độ người): nhìn thẳng / sau hai đầu gối nhấp nhô; nhìn ngang một chân trên bàn đạp trước, một chân sau
const BIKE_LEGS = {
  front: [
    '....nPPPPPPp....',
    '...nPPp..PPPp...',
    '...PPp....PPp...',
    '...FFf....FFf...',
  ],
  left: [
    '....nPPPPPPp....',
    '...nPPp..PPPp...',
    '...PPp....FFf...',
    '...FFf..........',
  ],
  right: [
    '....nPPPPPPp....',
    '...nPPp..PPPp...',
    '...FFf....PPp...',
    '..........FFf...',
  ],
  side: [
    '.....nPPPPp.....',
    '....PPPPPpp.....',
    '....PPp..pp.....',
    '...FFf...ff.....',
  ],
  sideStep: [
    '.....nPPPPp.....',
    '....pppPPPPP....',
    '....pp....PP....',
    '...ff....FFf....',
  ],
};

function drawBiker(look, dir, step, frameColor) {
  const pal = palette(look);
  const bp = bikePalette(frameColor);
  // Người trên xe: bỏ chân đi bộ, thay bằng chân đạp xe
  const rider = new PixelGrid(LW, LH);
  drawHead(rider, pal, look, dir, 'back');
  const legs = BIKE_LEGS[dir === 'side' ? (step === 'stand' ? 'side' : 'sideStep') : step === 'stand' ? 'front' : step];
  if (look.dress) {
    stamp(rider, dir === 'side' ? ['....eDDDDDDd....', '....dddddddd....'] : ['...eDDDDDDDd....', '...dddddddddd...'], pal, 0, 17);
    const bare = { P: 'S', n: 'S', p: 's' };
    stamp(rider, legs.slice(2).map((r) => r.replace(/[Pnp]/g, (c) => bare[c])), pal, 0, 20);
  } else stamp(rider, look.shorts ? toShorts(legs) : legs, pal, 0, 18);
  // Nhìn ngang thì tay vươn ra trước nắm ghi đông
  drawTorso(rider, pal, look, dir, dir === 'side' ? 'left' : 'stand');
  drawHead(rider, pal, look, dir, 'front');

  const p = new PixelGrid(BW, BH);
  const tube = (x, y, c = bp.N) => p.set(x, y, c);
  if (dir === 'side') {
    stamp(p, WHEEL, bp, 12, 19);
    stamp(p, WHEEL, bp, 1, 19);
    for (const [x, y] of BIKE_TUBES) tube(x, y);
    p.rect(12, 17, 3, 1, bp.k); // yên
    blit(p, rider, BIKE_OX);
    // ghi đông + tay nắm, đùi đĩa ở giữa
    tube(5, 16, bp.m);
    tube(6, 16, bp.m);
    tube(4, 15, bp.k);
    tube(5, 15, pal.G);
    tube(10, 22, bp.m);
    tube(9, 22, bp.k);
  } else {
    blit(p, rider, BIKE_OX);
    if (dir === 'down') {
      // ghi đông ngang trước bụng, càng + chắn bùn đỏ, bánh trước dựng đứng
      p.rect(6, 16, 8, 1, bp.M);
      p.rect(10, 16, 4, 1, bp.m);
      p.rect(4, 16, 2, 1, pal.G);
      p.rect(14, 16, 2, 1, pal.g);
      p.rect(9, 17, 2, 1, bp.m);
      p.rect(8, 18, 4, 1, bp.N);
      p.rect(10, 18, 2, 1, bp.n);
    } else {
      // nhìn sau: đầu ghi đông thò ra hai bên, yên + chắn bùn sau
      p.set(3, 16, bp.k);
      p.set(16, 16, bp.k);
      p.rect(8, 18, 4, 1, bp.N);
      p.rect(10, 18, 2, 1, bp.n);
    }
    p.rect(9, 19, 2, 6, bp.Y);
    p.rect(10, 19, 1, 6, bp.y);
    p.set(9, 20, bp.W);
    p.rect(9, 25, 2, 1, bp.y);
  }
  inkOutline(p);
  return p;
}

// ---------- Xuất ra ngoài ----------

// Một frame nhân vật đi bộ đã có viền: dir 'down' | 'up' | 'side', step 'stand' | 'left' | 'right'. Trả về PixelGrid LW x LH
export function characterPixels(look, dir, step) {
  const p = drawCharacter(look, dir, step);
  inkOutline(p);
  return p;
}

// Một frame người đạp xe (frameColor: màu khung xe). Trả về PixelGrid BIKE_W x BIKE_H
export const bikerPixels = drawBiker;
export { BW as BIKE_W, BH as BIKE_H };

// Các kiểu tóc vẽ được (dùng cho bảng tuỳ chỉnh nhân vật và kiểm thử)
export const HAIR_STYLE_IDS = ['cap', 'beanie', 'sunhat', 'nurse', ...Object.keys(HAIR)];
