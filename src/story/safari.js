import { ITEMS, formatMoney, martStock } from '../data/items.js';
import { SAFARI_DX } from '../data/indoorLayout.js';
import { HOME_RESPAWN, MAPS } from '../data/map.js';
import {
  PASS_MARKS, SAFARI, TICKET_MARKS, buyEffortTicket, buyPass, buyZoneTicket, crossedMark, effortLeft, effortOpen, effortPrice,
  formatLeft, markLabel, passActive, passLeft, ticketActive, zoneLeft, zoneOpen,
} from '../game/safari.js';
import { state } from '../game/state.js';
import { logSystem } from '../game/systemLog.js';
import { serverNow, sinceSync, syncServerClock } from '../online/serverClock.js';

// Nhân viên và quy tắc của Khu Safari (bản đồ: data/mapsSafari.js, vé / gói: game/safari.js, giờ máy chủ: online/serverClock.js).
//  Nhà Safari: nhân viên bán vé (quầy trái: vé Safari / vé Safari Effort), nhân viên bán gói 24 giờ (quầy phải), bảo vệ
//  đứng giữa hai cửa lớn: chưa có vé thì chặn lại (stepBlocker), có vé thì cho qua. Trong mỗi khu có nhân viên ngay cổng:
//  nói chuyện để ra ngoài (khu Safari: mua bóng, cùng hàng với Poké Mart của thành phố). Hết giờ thì loa thông báo và đưa
//  ra nhà Safari. Mua vé luôn hỏi giờ máy chủ trước (không kết nối được thì không bán)
//  Tab Hệ thống (game/systemLog.js): mua vé / gói, vào khu (còn bao lâu), nhắc thời gian còn theo mốc (game/safari.js:
//  TICKET_MARKS / PASS_MARKS: vé mỗi 5 phút → 2 phút → 30 giây; gói 24 giờ mỗi 15 phút), hết giờ

const TICKET = 'Nhân viên bán vé';
const PASS = 'Nhân viên gói Safari';
const GUARD = 'Bảo vệ';
const WARDEN = 'Nhân viên Safari';
const price = (n) => formatMoney(n);
export const SAFARI_TOWN = 'town6'; // thành phố có nhà Safari (Lò Gốm, gym 5)
const SAFARI_MAPS = ['safariGate', 'safariZone', 'safariEffort'];
// Đang ở nhà / khu Safari: hỏi lại giờ máy chủ mỗi RESYNC_MS (giữa các lần tự đếm bằng đồng hồ đơn điệu, online/serverClock.js),
// hoặc ngay khi hai lần kiểm tra cách nhau quá GAP_MS (vừa mở lại tab, máy vừa ngủ dậy)
const RESYNC_MS = 10 * 60 * 1000;
const GAP_MS = 5000;
// Chỗ đứng trong nhà Safari khi ra khỏi từng khu (trước cửa lớn tương ứng)
const GATE_SPOT = { safariZone: { x: 3 + SAFARI_DX, y: 2 }, safariEffort: { x: 10 + SAFARI_DX, y: 2 } };

// Giờ máy chủ để mua vé: { now } hoặc báo lỗi rồi trả về null
async function serverTime(world, speaker) {
  const res = await syncServerClock();
  if (res.error) {
    await world.say(speaker, [res.error]);
    return null;
  }
  return res.now;
}

async function ticketTalk(world) {
  const now = serverNow();
  await world.say(TICKET, ['Chào mừng tới Khu Safari!', 'Khu Safari có nhiều Pokémon hiếm, khu Safari Effort để luyện EV.']);
  const choice = await world.choose('Bạn muốn mua vé nào?', [
    { label: `Vé Safari (${price(SAFARI.zonePrice)} / ${SAFARI.zoneMinutes} phút)`, value: 'zone' },
    { label: `Vé Safari Effort (${price(effortPrice(now))} / ${SAFARI.effortMinutes} phút)`, value: 'effort' },
    { label: 'Thôi', value: null },
  ], TICKET);
  // Vé / gói còn hạn: báo luôn, không giải thích rồi mới từ chối
  if (choice === 'zone' && passActive(now)) return world.say(TICKET, ['Bạn đang có gói 24 giờ, vào khu Safari không cần vé.']);
  if (choice === 'zone' && ticketActive(now)) {
    return world.say(TICKET, [`Vé Safari của bạn vẫn còn ${formatLeft(zoneLeft(now))}. Hết hạn mới mua được vé mới.`]);
  }
  if (choice === 'effort' && effortOpen(now)) {
    return world.say(TICKET, [`Vé Safari Effort của bạn vẫn còn ${formatLeft(effortLeft(now))}. Hết hạn mới mua được vé mới.`]);
  }
  if (choice === 'zone') {
    await world.say(TICKET, [
      `Vé Safari: ${SAFARI.zoneMinutes} phút trong khu Safari, ra vào thoải mái khi còn giờ.`,
      'Trong khu ném được mọi loại bóng bạn có. Hết bóng thì mua ở nhân viên ngay cổng trong khu.',
      'Thời gian tính cả khi bạn thoát game, nên tranh thủ nhé!',
    ]);
    if (!(await world.ask(`Mua vé Safari với giá ${price(SAFARI.zonePrice)}?`, TICKET))) return;
    const t = await serverTime(world, TICKET);
    if (t === null) return;
    const res = buyZoneTicket(t);
    if (res.error) return world.say(TICKET, [res.error]);
    logSystem(`Đã mua vé Safari: ${SAFARI.zoneMinutes} phút.`, 'good');
    await world.say(TICKET, [`Đây là vé của bạn! Thời gian còn ${formatLeft(zoneLeft(t))}.`, 'Cửa lớn bên trái dẫn vào khu Safari. Chúc bạn bắt được nhiều Pokémon!']);
  } else if (choice === 'effort') {
    await world.say(TICKET, [
      'Khu Safari Effort có 3 khu, mỗi bãi cỏ chỉ có một loài cho +3 EV một chỉ số.',
      'Pokémon ở đây để luyện tập, không bắt được. Mỗi khu còn có luống quả giảm EV.',
      ...(passActive(now) ? [`Bạn có gói 24 giờ nên vé chỉ còn ${price(effortPrice(now))}.`] : []),
    ]);
    if (!(await world.ask(`Mua vé Safari Effort với giá ${price(effortPrice(now))}?`, TICKET))) return;
    const t = await serverTime(world, TICKET);
    if (t === null) return;
    const res = buyEffortTicket(t);
    if (res.error) return world.say(TICKET, [res.error]);
    logSystem(`Đã mua vé Safari Effort: ${SAFARI.effortMinutes} phút.`, 'good');
    await world.say(TICKET, [`Đây là vé của bạn! Thời gian còn ${formatLeft(effortLeft(t))}.`, 'Cửa lớn bên phải dẫn vào khu Safari Effort.']);
  }
}

async function passTalk(world) {
  const now = serverNow();
  if (passActive(now)) {
    await world.say(PASS, [`Gói Safari 24 giờ của bạn còn ${formatLeft(passLeft(now))}.`, 'Hết hạn rồi quay lại mua gói mới nhé (mỗi ngày một lần).']);
    return;
  }
  await world.say(PASS, [
    `Gói Safari ${SAFARI.passHours} giờ: ${price(SAFARI.passPrice)}.`,
    `Trong ${SAFARI.passHours} giờ bạn ra vào khu Safari tự do, không cần mua vé.`,
    `Vé Safari Effort cũng chỉ còn ${price(SAFARI.effortPassPrice)} / ${SAFARI.effortMinutes} phút.`,
    'Mỗi ngày chỉ bán một gói cho mỗi người, thời gian tính cả khi bạn thoát game.',
  ]);
  if (!(await world.ask(`Mua gói ${SAFARI.passHours} giờ với giá ${price(SAFARI.passPrice)}?`, PASS))) return;
  const t = await serverTime(world, PASS);
  if (t === null) return;
  const res = buyPass(t);
  if (res.error) return world.say(PASS, [res.error]);
  logSystem(`Đã mua gói Safari ${SAFARI.passHours} giờ.`, 'good');
  await world.say(PASS, [`Cảm ơn bạn! Gói Safari còn ${formatLeft(passLeft(t))}.`, 'Cứ đi thẳng cửa lớn bên trái vào khu Safari nhé.']);
}

async function guardTalk(world) {
  const now = serverNow();
  const lines = [];
  if (zoneOpen(now)) lines.push(`Bạn vào được khu Safari (còn ${formatLeft(zoneLeft(now))}): cửa lớn bên trái.`);
  if (effortOpen(now)) lines.push(`Vé Safari Effort còn ${formatLeft(effortLeft(now))}: cửa lớn bên phải.`);
  if (!lines.length) lines.push('Muốn vào khu thì mua vé ở quầy bên trái, hoặc gói 24 giờ ở quầy bên phải nhé.');
  await world.say(GUARD, lines);
}

// Ra khỏi khu về nhà Safari (đứng trước cửa lớn của khu đó)
async function leaveZone(world, mapId) {
  await world.warpTo({ to: 'safariGate', tx: GATE_SPOT[mapId].x, ty: GATE_SPOT[mapId].y, facing: 'down' });
}

// Bóng bán trong khu Safari: đúng các loại bóng Poké Mart của thành phố có nhà Safari đang bán
export const safariBallStock = () => martStock(MAPS[SAFARI_TOWN].martTier ?? 0).filter((id) => ITEMS[id].kind === 'ball');

async function wardenTalk(world) {
  const now = serverNow();
  const choice = await world.choose(
    `${passActive(now) ? 'Gói 24 giờ' : 'Vé Safari'} còn ${formatLeft(zoneLeft(now))}. Bạn cần gì?`,
    [
      { label: 'Mua bóng', value: 'shop' },
      { label: 'Ra ngoài', value: 'leave' },
      { label: 'Thôi', value: null },
    ],
    WARDEN,
  );
  if (choice === 'leave') return leaveZone(world, 'safariZone');
  if (choice === 'shop') await world.openMart({ items: safariBallStock() });
}

async function effortWardenTalk(world) {
  const choice = await world.choose(
    `Vé Safari Effort còn ${formatLeft(effortLeft(serverNow()))}. Bạn muốn ra ngoài không?`,
    [{ label: 'Ra ngoài', value: 'leave' }, { label: 'Thôi', value: null }],
    WARDEN,
  );
  if (choice === 'leave') await leaveZone(world, 'safariEffort');
}

export const SAFARI_NPCS = [
  { id: 'safari-ticket', sprite: 'npc-clerk', name: TICKET, map: 'safariGate', x: 1 + SAFARI_DX, y: 3, facing: 'down', fixed: true, onTalk: ticketTalk },
  { id: 'safari-pass', sprite: 'npc-aide', name: PASS, map: 'safariGate', x: 12 + SAFARI_DX, y: 3, facing: 'down', fixed: true, onTalk: passTalk },
  { id: 'safari-guard', sprite: 'npc-ace', name: GUARD, map: 'safariGate', x: 6 + SAFARI_DX, y: 2, facing: 'down', fixed: true, onTalk: guardTalk },
  { id: 'safari-warden', sprite: 'npc-guide', name: WARDEN, map: 'safariZone', x: 31, y: 39, facing: 'left', fixed: true, onTalk: wardenTalk },
  { id: 'effort-warden', sprite: 'npc-guide', name: WARDEN, map: 'safariEffort', x: 22, y: 27, facing: 'left', fixed: true, onTalk: effortWardenTalk },
];

// Sắp bước vào cửa lớn trong nhà Safari mà chưa có vé: bảo vệ chặn lại (trả về sự kiện), có vé thì cho qua (null)
export function safariBlocker(world, x, y) {
  if (world.map.id !== 'safariGate') return null;
  const to = world.map.warpAt(x, y)?.to;
  const now = serverNow();
  if (to === 'safariZone' && !zoneOpen(now)) {
    return () => world.say(GUARD, ['Khoan đã! Muốn vào khu Safari phải có vé.', 'Mua vé ở quầy bên trái, hoặc gói 24 giờ ở quầy bên phải nhé.']);
  }
  if (to === 'safariEffort' && !effortOpen(now)) {
    return () => world.say(GUARD, ['Khoan đã! Muốn vào khu Safari Effort phải có vé.', 'Mua vé ở quầy bên trái nhé.']);
  }
  return null;
}

// Mỗi giây (WorldScene): đang ở nhà / khu Safari thì thỉnh thoảng đồng bộ giờ máy chủ; trong khu mà hết giờ thì loa báo
// rồi đưa ra nhà Safari. Trả về sự kiện cần chạy (hết giờ), hoặc null
// (thử lại tối đa mỗi RESYNC_MS kể cả khi lần trước lỗi, không gọi máy chủ liên tục)
let lastTick = 0; // performance.now() lần kiểm tra trước (0: vừa mở game)
let lastMap = null; // bản đồ ở lần kiểm tra trước (vừa vào khu thì báo thời gian còn)
let prevLeft = 0; // thời gian còn ở lần kiểm tra trước (để biết vừa qua mốc báo nào)
let syncing = null; // đang hỏi giờ máy chủ (Promise)
let lastTry = -Infinity;
// Đang chờ giờ máy chủ rồi mới báo / mới xét hết giờ: { back: vừa quay lại (mở game, mở lại tab, máy ngủ dậy), at }
let pending = null;
const PENDING_MAX = 8000; // hỏi máy chủ không được (mất mạng) quá chừng này thì báo theo giờ tự đếm
// Tab bị ẩn (chuyển tab, thu nhỏ trình duyệt, khoá máy / máy ngủ) quá 5 giây rồi hiện lại: coi như vừa quay lại game.
// Không đoán theo khoảng cách giữa hai lần kiểm tra: máy chậm thì giờ trong game trôi chậm hơn giờ thật, dễ đoán nhầm
let hiddenAt = null;
let woke = false;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = performance.now();
    else if (hiddenAt !== null && performance.now() - hiddenAt > GAP_MS) woke = true;
  });
}
const ZONE_NAME = { safariZone: 'Khu Safari', safariEffort: 'Khu Safari Effort' };

function resync() {
  if (syncing || performance.now() - lastTry < GAP_MS) return;
  lastTry = performance.now();
  syncing = syncServerClock().finally(() => {
    syncing = null;
  });
}

// Lúc thoát game / mất mạng / tab ẩn thì không báo gì (game không chạy). Quay lại (mở game, mở lại tab, máy ngủ dậy) thì hỏi
// giờ máy chủ trước, có giờ rồi mới báo thời gian còn đúng; hết giờ trong lúc vắng mặt thì loa báo và đưa ra nhà Safari
export function safariTick(world) {
  const id = world.map?.id;
  const entered = id !== lastMap;
  const back = !lastTick || woke;
  woke = false;
  lastMap = id;
  lastTick = performance.now();
  if (!SAFARI_MAPS.includes(id)) return null;
  const zone = Boolean(ZONE_NAME[id]);
  // Vừa quay lại: luôn hỏi lại giờ máy chủ. Vừa từ nhà Safari bước vào khu: chỉ hỏi nếu lần hỏi trước đã lâu
  const stale = sinceSync() > RESYNC_MS;
  if (back || stale) resync();
  if (zone && (back || (entered && stale))) pending = { back, at: performance.now() };
  if (pending) {
    if (!zone) pending = null;
    else if (syncing && performance.now() - pending.at < PENDING_MAX) return null;
  }
  const now = serverNow();
  const expired = (id === 'safariZone' && !zoneOpen(now)) || (id === 'safariEffort' && !effortOpen(now));
  if (zone && !expired) {
    const pass = id === 'safariZone' && passActive(now);
    const left = id === 'safariZone' ? zoneLeft(now) : effortLeft(now);
    const what = `${pass ? 'gói 24 giờ ' : ''}còn ${formatLeft(left)}`;
    if (pending) logSystem(`${pending.back ? 'Quay lại' : 'Vào'} ${ZONE_NAME[id]}: ${what}.`);
    else if (entered) logSystem(`Vào ${ZONE_NAME[id]}: ${what}.`);
    else {
      const mark = crossedMark(prevLeft, left, pass ? PASS_MARKS : TICKET_MARKS);
      if (mark) logSystem(`${ZONE_NAME[id]}: ${pass ? 'gói 24 giờ ' : ''}còn ${markLabel(mark)}.`, mark <= 5 * 60 * 1000 ? 'warn' : 'info');
    }
    prevLeft = left;
  }
  const away = Boolean(pending?.back) && zone;
  pending = null;
  if (!expired) return null;
  // Hết giờ trong lúc vắng mặt (thoát game / game văng / tab ẩn rồi vào lại): đưa thẳng về Pokémon Center đã vào gần nhất
  // (chưa vào Center nào thì về nhà), chỉ báo ở tab Hệ thống
  if (away) {
    return async () => {
      if (world.map.id !== id) return;
      const spot = state.lastCenter ?? HOME_RESPAWN;
      await world.warpTo({ to: spot.map, tx: spot.x, ty: spot.y, facing: spot.facing ?? 'up' });
      // Tên nơi về: Pokémon Center nào cũng cùng tên, ghi thêm thành phố có Center đó
      const place = MAPS[spot.map];
      const town = place?.indoor && place.exit ? MAPS[place.exit.to]?.name : null;
      const where = place ? `${place.name}${town ? ` (${town})` : ''}` : 'nơi hồi phục';
      logSystem(`Hết thời gian ở ${ZONE_NAME[id]} khi bạn vắng mặt: đã đưa bạn về ${where}.`, 'warn');
    };
  }
  // Hết giờ khi đang chơi trong khu: loa báo rồi đưa ra nhà Safari
  return async () => {
    await world.say(null, ['Loa: "Ding-dong! Hết giờ rồi! Cảm ơn quý khách đã ghé Khu Safari."']);
    if (world.map.id === id) await leaveZone(world, id);
    logSystem(`Hết giờ ở ${ZONE_NAME[id]}, bạn đã được đưa ra nhà Safari.`, 'warn');
  };
}

