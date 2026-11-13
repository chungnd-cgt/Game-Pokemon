import { STAT_NAMES } from '../data/stats.js';
import { typeMultiplier } from '../data/types.js';
import { STATUS_INFO } from './status.js';

// Thông tin chiêu cho giao diện chọn chiêu: mô tả ngắn hiệu ứng phụ, mức khắc chế với đối thủ.

const WEATHER_NAMES = { sun: 'nắng gắt', rain: 'mưa', sand: 'bão cát', hail: 'mưa đá' };
const SCREEN_DESC = { reflect: 'Giảm sát thương vật lý phe mình 5 lượt', lightScreen: 'Giảm sát thương đặc biệt phe mình 5 lượt' };
const pct = (n) => `${Math.round(n * 100)}%`;

// Các dòng mô tả hiệu ứng phụ của chiêu (ngắn gọn, tiếng Việt). Không có gì đặc biệt thì trả về mảng rỗng.
export function moveNotes(move) {
  const notes = [];
  if (move.priority > 0) notes.push('Luôn ra đòn trước');
  if (move.priority < 0) notes.push('Luôn ra đòn sau');
  if (move.hits) notes.push(Array.isArray(move.hits) ? `Đánh ${move.hits[0]}-${move.hits[1]} lần` : `Đánh ${move.hits} lần`);
  if (move.status) {
    const [s, chance] = move.status;
    notes.push(chance >= 100 ? `Gây ${STATUS_INFO[s].name}` : `${chance}% gây ${STATUS_INFO[s].name}`);
  }
  if (move.confuse) notes.push(move.confuse >= 100 ? 'Gây rối loạn' : `${move.confuse}% gây rối loạn`);
  if (move.flinch) notes.push(`${move.flinch}% làm chùn bước`);
  if (move.stages) {
    const entries = Object.entries(move.stages);
    const same = entries.length >= 5 && entries.every(([, d]) => d === entries[0][1]);
    const sign = (d) => `${d > 0 ? '+' : ''}${d}`;
    const parts = same ? [`${sign(entries[0][1])} mọi chỉ số`] : entries.map(([stat, d]) => `${sign(d)} ${STAT_NAMES[stat]}`);
    notes.push(`${move.chance && move.chance < 100 ? `${move.chance}%: ` : ''}${parts.join(', ')} (${move.self ? 'bản thân' : 'đối thủ'})`);
  }
  if (move.drain) notes.push(`Hút ${pct(move.drain)} sát thương thành HP`);
  if (move.recoil) notes.push('Tự mất máu phản đòn');
  if (move.highCrit) notes.push('Dễ chí mạng');
  if (move.weather) notes.push(`Gọi ${WEATHER_NAMES[move.weather]} 5 lượt`);
  if (move.screen) notes.push(SCREEN_DESC[move.screen]);
  if (move.bind) notes.push('Trói đối thủ 4-5 lượt');
  if (move.freesBind) notes.push('Thoát khỏi bị trói');
  if (move.rampage) notes.push('Cuồng nộ 2-3 lượt rồi bị rối loạn');
  if (move.crash) notes.push('Trượt thì tự mất máu');
  if (move.explode) notes.push('Người dùng gục sau đòn');
  if (move.fixedDamage) notes.push(move.fixedDamage === 'level' ? 'Sát thương bằng cấp độ' : `Luôn gây ${move.fixedDamage} HP`);
  if (move.weightPower) notes.push('Đối thủ càng nặng càng mạnh');
  if (move.breaksScreens) notes.push('Phá lớp chắn của đối thủ');
  if (move.steal) notes.push('Cướp đồ đối thủ đang cầm');
  if (move.knockOff) notes.push('Hất văng đồ đối thủ đang cầm');
  if (move.attract) notes.push('Làm đối thủ say mê');
  if (move.taunt) notes.push('Khiêu khích 3 lượt');
  if (move.rest) notes.push('Hồi đầy HP, chữa trạng thái, ngủ 2 lượt');
  if (move.transform) notes.push('Biến hình thành đối thủ (chép chỉ số, chiêu, đặc tính)');
  if (move.weatherAccuracy) {
    const always = Object.entries(move.weatherAccuracy).filter(([, acc]) => acc === null).map(([w]) => WEATHER_NAMES[w]);
    if (always.length) notes.push(`Luôn trúng khi ${always.join(' / ')}`);
  }
  return notes;
}

// Mức khắc chế của chiêu với hệ của đối thủ (chỉ theo hệ, như gợi ý trong game; đặc tính không tính).
// Trả về null với chiêu trạng thái. { mult, label, color }
export function effectivenessHint(move, targetTypes) {
  if (move.category === 'status') return null;
  const mult = typeMultiplier(move.type, targetTypes);
  if (mult === 0) return { mult, label: '✕ Không có tác dụng', color: '#c83838' };
  if (mult > 1) return { mult, label: '▲ Rất hiệu quả', color: '#2a9a48' };
  if (mult < 1) return { mult, label: '▼ Không hiệu quả lắm', color: '#d07020' };
  return { mult, label: 'Hiệu quả bình thường', color: '#7a8296' };
}
