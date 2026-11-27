import { messageOf, verifyEmailCode } from './account.js';
import { supabase } from './supabase.js';

// Thiết bị tin cậy (máy chủ: supabase/schema.sql device_check). Lần đầu đăng nhập trên một trình duyệt: gửi mã 6 số tới
// email của tài khoản, nhập đúng thì trình duyệt này được nhớ (mã thiết bị ngẫu nhiên trong localStorage, máy chủ chỉ giữ
// SHA-256). Chưa xác nhận thì máy chủ không cho đọc / ghi bản lưu, giao dịch... (kể cả khi biết mật khẩu).
// Công tắc trên máy chủ đang tắt thì device_check luôn trả 'ok': không hỏi gì.

const KEY = (uid) => `pokemon-demo-device:${uid}`;
const TOKEN = /^[0-9a-f]{64}$/;

// Mã thiết bị của tài khoản uid trên trình duyệt này (tạo mới nếu chưa có), hoặc null nếu trình duyệt chặn localStorage
export function deviceToken(uid) {
  try {
    let token = localStorage.getItem(KEY(uid));
    if (!TOKEN.test(token ?? '')) {
      token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY(uid), token);
    }
    return token;
  } catch {
    return null;
  }
}

// Che bớt email khi hiện trên màn hình (người biết mật khẩu mà không phải chủ tài khoản không đọc được email):
// "chungnd@gmail.com" -> "c•••d@gmail.com"
export function maskEmail(email) {
  const [name, domain] = String(email ?? '').split('@');
  if (!domain) return '•••';
  const shown = name.length <= 2 ? `${name[0] ?? ''}•••` : `${name[0]}•••${name.at(-1)}`;
  return `${shown}@${domain}`;
}

// Phiên đăng nhập hiện tại được dùng chưa: 'ok' | 'verify' (thiết bị lạ: cần nhập mã gửi qua email) | 'error' (lỗi mạng)
export async function checkDevice(user) {
  try {
    const { data, error } = await supabase.rpc('device_check', {
      p_device_token: deviceToken(user.id), p_device: navigator.userAgent.slice(0, 120),
    });
    if (!error) return data === 'verify' ? 'verify' : 'ok';
    // Máy chủ chưa chạy bản schema.sql có device_check: chưa có tính năng này
    if (error.code === 'PGRST202' || error.code === '42883') return 'ok';
    return 'error';
  } catch {
    return 'error';
  }
}

// Gửi mã xác nhận tới email (mẫu email Magic Link có {{ .Token }}: supabase/email-templates/device-code.html).
// Không tạo tài khoản mới. Trả về {} hoặc { error }
export async function sendDeviceCode(email) {
  try {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    return error ? { error: messageOf(error) } : {};
  } catch (err) {
    return { error: messageOf(err) };
  }
}

// Nhập mã: đúng thì Supabase đổi sang phiên mới đã xác nhận email (máy chủ thấy trong JWT, device_check nhớ thiết bị).
// Trả về { user } hoặc { error }
export const verifyDeviceCode = (email, code) => verifyEmailCode(email, code, 'device');
