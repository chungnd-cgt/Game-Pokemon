import { addSheetTexture, drawGrid, makeCanvas } from './pixel.js';

// Nhân vật 16x24 pixel, phong cách GBA. Mỗi hướng có 3 frame: đứng, bước chân trái, bước chân phải.
const PALETTE = {
  o: '#282030', // viền
  r: '#e04040', // mũ, giày
  R: '#a82828',
  W: '#f8f8f8',
  k: '#3a2a28', // tóc
  p: '#f8c8a0', // da
  q: '#e0a078',
  B: '#3870d8', // áo
  C: '#2850a8',
  n: '#404860', // quần
  N: '#2c3244',
  Y: '#f0c040', // balo
  Z: '#c09020',
};

const DOWN = [
  '................',
  '.....oooooo.....',
  '....orrrrrro....',
  '...orrrrrrrro...',
  '...orrWWWWrro...',
  '..orrrrrrrrrro..',
  '..oRRRRRRRRRRo..',
  '..okkkkkkkkkko..',
  '..okkppppppkko..',
  '..okpoppppopko..',
  '..okpoppppopko..',
  '...oppppppppo...',
  '....oqppppqo....',
  '...oWWBBBBWWo...',
  '..oBBBBBBBBBBo..',
  '.opBBBBBBBBBBpo.',
  '.opCBBBBBBBBCpo.',
  '..ooCCCCCCCCoo..',
  '...onnnnnnnno...',
  '...onnnoonnno...',
];

const UP = [
  '................',
  '.....oooooo.....',
  '....orrrrrro....',
  '...orrrrrrrro...',
  '...orrrrrrrro...',
  '..orrrrrrrrrro..',
  '..oRRRRRRRRRRo..',
  '..okkkkkkkkkko..',
  '..okkkkkkkkkko..',
  '..okkkkkkkkkko..',
  '..okkkkkkkkkko..',
  '...okkkkkkkko...',
  '....oqppppqo....',
  '...oBYYYYYYBo...',
  '..oBYYYYYYYYBo..',
  '.opBYYYYYYYYBpo.',
  '.opCYZZZZZZYCpo.',
  '..ooCCCCCCCCoo..',
  '...onnnnnnnno...',
  '...onnnoonnno...',
];

// Nhìn sang trái (lật ngang để nhìn sang phải)
const SIDE = [
  '................',
  '.....oooooo.....',
  '....orrrrrro....',
  '...orrrrrrrro...',
  '...oWWrrrrrro...',
  '.oorrrrrrrrrro..',
  '.oRRRRRRRRkkko..',
  '...okkkkkkkkko..',
  '...oppppkkkkko..',
  '..oppoppkkkko...',
  '..opppppkkkko...',
  '...oppppppko....',
  '....oqqppppo....',
  '....oBBBBBYo....',
  '...oBBBBBBYYo...',
  '...opBBBBBYYo...',
  '...oCCBBBBYZo...',
  '....oCCCCCCo....',
  '....onnnnnno....',
  '....onnnnnno....',
];

const LEGS = {
  front: {
    stand: ['...onno..onno...', '...onno..onno...', '...orro..orro...', '....oo....oo....'],
    left: ['...onno..onno...', '...onno..oRRo...', '...orro...oo....', '....oo..........'],
    right: ['...onno..onno...', '...oRRo..onno...', '....oo...orro...', '..........oo....'],
  },
  side: {
    stand: ['....onnnnno.....', '.....onnnno.....', '.....orrrro.....', '......oooo......'],
    left: ['...onnno.onnno..', '..onno....onno..', '..orro....orro..', '...oo......oo...'],
    right: ['....onnnnno.....', '....onnoonno....', '....orro.orro...', '.....oo...oo....'],
  },
};

export const PLAYER_FRAMES = ['stand', 'left', 'right'];

// Biến thể nhân vật: hat=false thì mũ thành tóc, backpack=false thì bỏ balo (thành áo)
function variant(rows, { hat, backpack }) {
  return rows.map((row, y) => {
    let r = row;
    if (!hat && y <= 6) r = r.replace(/[rRW]/g, 'k');
    if (!backpack) r = r.replace(/Y/g, 'B').replace(/Z/g, 'C');
    return r;
  });
}

// Texture nhân vật với các frame: down-stand, down-left, ..., side-right
export function makeCharacterTexture(scene, key, colors = {}, { hat = true, backpack = true } = {}) {
  const palette = { ...PALETTE, ...colors };
  const canvases = [];
  const names = [];
  for (const [dir, body, legs] of [['down', DOWN, LEGS.front], ['up', UP, LEGS.front], ['side', SIDE, LEGS.side]]) {
    for (const step of PLAYER_FRAMES) {
      const { canvas, ctx } = makeCanvas(16, 24);
      drawGrid(ctx, [...variant(body, { hat, backpack }), ...legs[step]], palette);
      canvases.push(canvas);
      names.push(`${dir}-${step}`);
    }
  }
  addSheetTexture(scene, key, canvases, names);
}

// Bảng màu cho từng kiểu NPC
const NPC_LOOKS = {
  'npc-youngster': [{ r: '#3a70d8', R: '#2850a8', B: '#f0c040', C: '#c09020', n: '#4a5878' }, { backpack: false }],
  'npc-lass': [{ k: '#c06030', B: '#f080a8', C: '#c85080', n: '#f080a8', N: '#c85080' }, { hat: false, backpack: false }],
  'npc-camper': [{ r: '#3a9a4a', R: '#2a7038', B: '#c8a860', C: '#9a8040', n: '#6a5a3a' }, {}],
  'npc-oldman': [{ k: '#d0d0d0', B: '#8a6040', C: '#6a4830', n: '#505868' }, { hat: false, backpack: false }],
  'npc-girl': [{ k: '#4a2a20', B: '#50b070', C: '#3a8a50', n: '#3a4a7a' }, { hat: false, backpack: false }],
  'npc-boy': [{ r: '#f08030', R: '#c06020', B: '#e04848', C: '#a83030', n: '#3a4a7a' }, { backpack: false }],
  'npc-fisher': [{ r: '#e8e8e8', R: '#b8b8b8', W: '#3a70d8', B: '#5a7a90', C: '#3a5a70', n: '#3a4050' }, { backpack: false }],
  'npc-joy': [{ r: '#f8f8f8', R: '#e8dce4', W: '#f04060', k: '#f890b0', B: '#f8c0d0', C: '#e890b0', n: '#f8f0f4', N: '#d8c8d0' }, { backpack: false }],
  'npc-clerk': [{ k: '#3a2a20', B: '#4a7ad8', C: '#2f5cb8', W: '#f8f8f8', n: '#404860' }, { hat: false, backpack: false }],
  'npc-woman': [{ k: '#8a4a2a', B: '#9a60c8', C: '#7040a0', n: '#9a60c8', N: '#7040a0' }, { hat: false, backpack: false }],
};

export function makePlayerTexture(scene) {
  makeCharacterTexture(scene, 'player');
  for (const [key, [colors, opts]] of Object.entries(NPC_LOOKS)) makeCharacterTexture(scene, key, colors, opts);
}
