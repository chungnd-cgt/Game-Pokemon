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

export const supabase = URL && KEY
  ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
