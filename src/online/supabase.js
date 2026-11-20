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

// Phiên đăng nhập chỉ cất trong sessionStorage: đóng tab / trình duyệt rồi mở lại game là phải đăng nhập lại (tải lại trang
// trong cùng tab thì vẫn còn, văng game bấm F5 không phải đăng nhập). Chỉ nhớ tên đăng nhập lần trước để điền sẵn
const LOGIN_KEY = 'pokemon-demo-last-login';
const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback; // trình duyệt chặn localStorage / sessionStorage
  }
};
export const lastLogin = () => safe(() => localStorage.getItem(LOGIN_KEY) ?? '', '');
export function setLastLogin(name) {
  safe(() => (name ? localStorage.setItem(LOGIN_KEY, name) : localStorage.removeItem(LOGIN_KEY)));
}

// Bản cũ có "Ghi nhớ đăng nhập" cất phiên trong localStorage: xoá đi để lần mở này cũng phải đăng nhập lại
safe(() => {
  localStorage.removeItem('pokemon-demo-remember');
  localStorage.removeItem('pokemon-demo-last-email'); // bản cũ nhớ email (giờ nhớ tên đăng nhập)
  for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token/.test(k)) localStorage.removeItem(k);
});

const sessionStore = {
  getItem: (k) => safe(() => sessionStorage.getItem(k)),
  setItem: (k, v) => safe(() => sessionStorage.setItem(k, v)),
  removeItem: (k) => safe(() => sessionStorage.removeItem(k)),
};

export const supabase = URL && KEY
  ? createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: sessionStore },
  })
  : null;
