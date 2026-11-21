import { state } from './state.js';

// Khu Safari (nhà Safari ở Thành phố Lò Gốm, bản đồ: data/mapsSafari.js, nhân viên: story/safari.js). Logic vé / gói,
// không đụng tới màn hình để test chạy bằng Node được. Mọi mốc thời gian (now) là GIỜ MÁY CHỦ (online/serverClock.js), không
// dùng đồng hồ máy người chơi: chỉnh giờ máy không kéo dài được vé. Thời gian vẫn trôi khi thoát game.
//  Vé Safari: ZONE_PRICE / ZONE_MINUTES phút • Vé Safari Effort (khu luyện EV, không bắt được): EFFORT_PRICE / EFFORT_MINUTES
//  phút (có gói 24 giờ: EFFORT_PASS_PRICE) • Gói Safari 24 giờ: PASS_PRICE, ra vào khu Safari tự do
//  Vé / gói còn hạn thì không mua thêm được (không cộng dồn). Gói 24 giờ mỗi ngày (theo giờ Việt Nam) chỉ mua được 1 lần.
//  Trong khu Safari ném được mọi loại bóng người chơi có (như ngoài đường)
export const SAFARI = {
  zonePrice: 10000,
  zoneMinutes: 30,
  effortPrice: 10000,
  effortPassPrice: 2000,
  effortMinutes: 20,
  passPrice: 55000,
  passHours: 24,
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const VN_OFFSET = 7 * HOUR;

// Ngày (theo giờ Việt Nam) của mốc thời gian now: số ngày kể từ 1/1/1970
export const vnDay = (now) => Math.floor((now + VN_OFFSET) / (24 * HOUR));

export const freshSafari = () => ({ zoneUntil: 0, effortUntil: 0, passUntil: 0, passDay: -1 });

// Đọc từ bản lưu: thiếu / sai thì về mặc định (không có vé)
export function normalizeSafari(raw) {
  const s = freshSafari();
  for (const k of ['zoneUntil', 'effortUntil', 'passUntil']) if (Number.isFinite(raw?.[k]) && raw[k] > 0) s[k] = raw[k];
  if (Number.isInteger(raw?.passDay) && raw.passDay >= 0) s.passDay = raw.passDay;
  return s;
}

const safari = () => {
  state.safari = { ...freshSafari(), ...state.safari };
  return state.safari;
};

export const passActive = (now) => safari().passUntil > now;
export const ticketActive = (now) => safari().zoneUntil > now;
// Được vào khu Safari: còn vé hoặc còn gói 24 giờ
export const zoneOpen = (now) => ticketActive(now) || passActive(now);
export const effortOpen = (now) => safari().effortUntil > now;
export const effortPrice = (now) => (passActive(now) ? SAFARI.effortPassPrice : SAFARI.effortPrice);
// Thời gian còn lại (ms) ở khu Safari (vé hoặc gói, lấy cái lâu hơn) / khu Safari Effort / gói
export const zoneLeft = (now) => Math.max(0, Math.max(safari().zoneUntil, safari().passUntil) - now);
export const effortLeft = (now) => Math.max(0, safari().effortUntil - now);
export const passLeft = (now) => Math.max(0, safari().passUntil - now);
// Hôm nay đã mua gói 24 giờ chưa
export const passBoughtToday = (now) => safari().passDay === vnDay(now);

function pay(price) {
  if (state.money < price) return false;
  state.money -= price;
  return true;
}

// Mua vé Safari: { ok } hoặc { error }
export function buyZoneTicket(now) {
  if (passActive(now)) return { error: 'Bạn đang có gói 24 giờ, vào khu Safari không cần vé.' };
  if (ticketActive(now)) return { error: `Vé Safari của bạn vẫn còn ${formatLeft(zoneLeft(now))}. Hết hạn mới mua được vé mới.` };
  if (!pay(SAFARI.zonePrice)) return { error: 'Bạn không đủ tiền mua vé.' };
  safari().zoneUntil = now + SAFARI.zoneMinutes * MINUTE;
  return { ok: true };
}

export function buyEffortTicket(now) {
  if (effortOpen(now)) return { error: `Vé Safari Effort của bạn vẫn còn ${formatLeft(effortLeft(now))}. Hết hạn mới mua được vé mới.` };
  if (!pay(effortPrice(now))) return { error: 'Bạn không đủ tiền mua vé.' };
  safari().effortUntil = now + SAFARI.effortMinutes * MINUTE;
  return { ok: true };
}

export function buyPass(now) {
  if (passActive(now)) return { error: `Gói 24 giờ của bạn vẫn còn ${formatLeft(passLeft(now))}.` };
  if (passBoughtToday(now)) return { error: 'Mỗi ngày chỉ mua được gói 24 giờ một lần. Ngày mai bạn quay lại nhé.' };
  if (!pay(SAFARI.passPrice)) return { error: 'Bạn không đủ tiền mua gói.' };
  const s = safari();
  s.passUntil = now + SAFARI.passHours * HOUR;
  s.passDay = vnDay(now);
  return { ok: true };
}

// Loại bóng ném được trong trận gặp Pokémon hoang dã ở bản đồ mapId: 'none' (khu Safari Effort: không bắt) | 'normal'
export const ballRule = (mapId) => (mapId === 'safariEffort' ? 'none' : 'normal');

// Vật phẩm id có dùng được trong trận theo luật rule không (rule 'none': không ném bóng; đồ khác luôn được)
export const ballAllowed = (id, item, rule) => item?.kind !== 'ball' || rule !== 'none';

// Mốc báo thời gian còn lại ở tab Hệ thống (ms, giảm dần):
//  vé (Safari 30 phút / Safari Effort 20 phút): mỗi 5 phút; còn 5 phút thì mỗi 2 phút (5, 3, 1); còn 1 phút thì mỗi 30 giây
//  gói 24 giờ: mỗi 15 phút; 15 phút cuối như vé (10, 5, 3, 1 phút, 30 giây)
const FINAL_MARKS = [5 * MINUTE, 3 * MINUTE, MINUTE, 30 * 1000];
const marksEvery = (step, from, until) => {
  const marks = [];
  for (let t = from; t > until; t -= step) marks.push(t);
  return marks;
};
export const TICKET_MARKS = [...marksEvery(5 * MINUTE, 30 * MINUTE, 5 * MINUTE), ...FINAL_MARKS];
export const PASS_MARKS = [...marksEvery(15 * MINUTE, 24 * HOUR, 15 * MINUTE), 15 * MINUTE, 10 * MINUTE, ...FINAL_MARKS];

// Thời gian còn lại vừa giảm từ prev xuống left: trả về mốc vừa qua (mốc nhỏ nhất nếu qua nhiều mốc một lúc, vd vừa mở lại
// tab), hoặc null
export function crossedMark(prev, left, marks) {
  let hit = null;
  for (const m of marks) if (prev > m && left <= m) hit = m;
  return hit;
}

// "5 phút", "30 giây", "1 giờ 15 phút" (mốc báo)
export function markLabel(ms) {
  if (ms < MINUTE) return `${Math.round(ms / 1000)} giây`;
  const minutes = Math.round(ms / MINUTE);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60} phút` : ''}` : `${minutes} phút`;
}

// "12:05" (dưới 1 giờ) hoặc "23 giờ 10 phút"
export function formatLeft(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total >= 3600) return `${Math.floor(total / 3600)} giờ ${Math.floor((total % 3600) / 60)} phút`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
