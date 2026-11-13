import * as ch2 from './ch2.js';
import * as ch3 from './ch3.js';
import * as ch4a from './ch4a.js';
import * as ch4b from './ch4b.js';
import * as ch5 from './ch5.js';
import * as villagesA from './villagesA.js';
import * as villagesB from './villagesB.js';

// Gom dữ liệu bổ sung của các phần mở rộng bản đồ
const PARTS = [ch2, ch3, ch4a, ch4b, ch5, villagesA, villagesB];
export const EXTRA_TRAINERS = PARTS.flatMap((p) => p.TRAINERS);
export const EXTRA_NPCS = PARTS.flatMap((p) => p.NPCS);
export const EXTRA_ENCOUNTERS = Object.assign({}, ...PARTS.map((p) => p.ENCOUNTERS));
