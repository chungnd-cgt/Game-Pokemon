import { errorPayload } from './errorPayload.js';
import { supabase } from './supabase.js';

// Gửi lỗi JavaScript của người chơi lên Supabase (bảng client_errors, supabase/errors.sql) để biết game lỗi ở đâu trên máy
// người khác. Bắt: lỗi không ai bắt (window 'error'), promise bị từ chối không ai xử lý ('unhandledrejection') và
// console.error (game bắt lỗi trong sự kiện / trận đấu rồi console.error để không văng game).
// Chỉ chạy ở bản build (không chạy khi dev / test), mỗi phiên tối đa MAX_PER_SESSION lỗi khác nhau; máy chủ chống spam thêm.

const MAX_PER_SESSION = 10;
const sent = new Set();
let getContext = () => ({});
let installed = false;

export function reportError(kind, args) {
  if (!supabase || sent.size >= MAX_PER_SESSION) return;
  let payload;
  try {
    payload = errorPayload(kind, args, getContext());
  } catch {
    return;
  }
  if (sent.has(payload.p_message)) return;
  sent.add(payload.p_message);
  // Gửi không được (mất mạng, chưa chạy errors.sql...) thì thôi, không báo lỗi tiếp (tránh vòng lặp console.error)
  supabase.rpc('log_client_error', payload).then(() => {}, () => {});
}

// contextFn: () => object thêm vào mỗi lỗi (bản đồ, cảnh đang chạy...)
export function installErrorLog(contextFn) {
  if (installed || !supabase || import.meta.env.DEV) return;
  installed = true;
  if (contextFn) getContext = contextFn;
  window.addEventListener('error', (e) => reportError('error', e.error ?? `${e.message} (${e.filename}:${e.lineno}:${e.colno})`));
  window.addEventListener('unhandledrejection', (e) => reportError('rejection', e.reason ?? 'Promise bị từ chối'));
  const original = console.error.bind(console);
  console.error = (...args) => {
    original(...args);
    reportError('console', args);
  };
}
