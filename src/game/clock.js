// Đồng hồ trong game: 1 ngày thật = 3 ngày trong game (mỗi ngày game dài 8 tiếng thật, 1 giờ game = 20 phút thật).
// Mỗi ngày game chia đều 3 buổi, mỗi buổi 8 giờ game (2 giờ 40 phút thật): ban ngày 06:00-14:00, chạng vạng 14:00-22:00,
// ban đêm 22:00-06:00. 0 giờ thật là 06:00 giờ game, nên buổi nào cũng gặp được vào nhiều khung giờ thật khác nhau trong ngày.
export const PHASES = ['day', 'dusk', 'night'];
export const GAME_DAY_MS = 8 * 3600 * 1000;
const PHASE_MS = GAME_DAY_MS / PHASES.length;

const DAY_START = 6 * 60; // buổi ban ngày bắt đầu lúc 06:00 giờ game

// { phase, next, left: số ms còn lại tới buổi sau, time: giờ game 'HH:MM' }
export function gameClock(date = new Date()) {
  const sinceMidnight = ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
  const inDay = sinceMidnight % GAME_DAY_MS;
  const i = Math.floor(inDay / PHASE_MS);
  const minutes = (Math.floor((inDay / GAME_DAY_MS) * 24 * 60) + DAY_START) % (24 * 60);
  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return { phase: PHASES[i], next: PHASES[(i + 1) % PHASES.length], left: PHASE_MS - (inDay % PHASE_MS), time };
}

// Buổi hiện tại (không chỉnh được trong Cài đặt: có Pokémon chỉ xuất hiện vào một buổi)
export const timeOfDay = (date = new Date()) => gameClock(date).phase;

export const PHASE_NAMES = { day: 'Ban ngày', dusk: 'Chiều', night: 'Ban đêm' };
export const PHASE_ICONS = { day: '☀', dusk: '◐', night: '☾' };
