import { createClient } from '@supabase/supabase-js';

// Kết nối Supabase (đăng nhập + bản lưu trên mạng). URL và khoá công khai lấy từ .env.local (xem .env.example)
const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Link trong email (xác nhận đăng ký, đặt lại mật khẩu) mở game kèm thông tin sau dấu # (hoặc ?). Đọc trước khi supabase-js
// xử lý và xoá khỏi thanh địa chỉ: biết là đang đặt lại mật khẩu, hoặc link đã hết hạn / dùng rồi
function readLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  for (const [k, v] of new URLSearchParams(location.search)) if (!params.has(k)) params.set(k, v);
  return {
    recovery: params.get('type') === 'recovery',
    errorCode: params.get('error_code') ?? (params.get('error') ? 'unknown' : null),
  };
}
export const emailLink = readLink();

// Bỏ thông tin lỗi của link khỏi thanh địa chỉ (đã đọc rồi), để tải lại trang không báo lại
export function clearLinkError() {
  if (!emailLink.errorCode) return;
  history.replaceState(null, '', location.pathname);
}

// "Ghi nhớ đăng nhập" (bảng đăng nhập, mặc định bật): phiên đăng nhập lưu trong localStorage, mở lại game là vào luôn.
// Tắt thì lưu trong sessionStorage: đóng tab / trình duyệt là phải đăng nhập lại
const REMEMBER_KEY = 'pokemon-demo-remember';
const EMAIL_KEY = 'pokemon-demo-last-email';
const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback; // trình duyệt chặn localStorage / sessionStorage
  }
};
export const rememberLogin = () => safe(() => localStorage.getItem(REMEMBER_KEY) !== '0', true);
export function setRememberLogin(on) {
  safe(() => localStorage.setItem(REMEMBER_KEY, on ? '1' : '0'));
}
// Email đăng nhập lần trước (điền sẵn khi Ghi nhớ đăng nhập đang bật)
export const lastEmail = () => (rememberLogin() ? safe(() => localStorage.getItem(EMAIL_KEY) ?? '', '') : '');
export function setLastEmail(email) {
  safe(() => (rememberLogin() && email ? localStorage.setItem(EMAIL_KEY, email) : localStorage.removeItem(EMAIL_KEY)));
}

// Chỗ supabase-js cất phiên đăng nhập: theo Ghi nhớ đăng nhập, xoá bản ở chỗ còn lại để không sót phiên cũ
const sessionStore = {
  getItem: (k) => safe(() => localStorage.getItem(k) ?? sessionStorage.getItem(k)),
  setItem: (k, v) => safe(() => {
    const [keep, drop] = rememberLogin() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    keep.setItem(k, v);
    drop.removeItem(k);
  }),
  removeItem: (k) => safe(() => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  }),
};

export const supabase = URL && KEY
  ? createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: sessionStore },
  })
  : null;
