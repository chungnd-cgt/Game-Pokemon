import { supabase } from './supabase.js';

// Tên thật của người chơi khác (bảng profiles trên máy chủ, supabase/usernames.sql: player_names). Tên đi kèm Realtime
// (presence, lời mời giao dịch) do máy người đó tự gửi nên giả được: game chỉ hiện tên lấy từ đây.
//  - Hỏi theo lô các id chưa biết; đã biết thì nhớ suốt phiên chơi (tên đăng nhập không đổi được)
//  - Máy chủ chưa chạy usernames.sql (chưa có hàm player_names): dùng tạm tên trong Realtime như cũ
//  - Lỗi mạng: lần sau hỏi lại

const FALLBACK = 'Người chơi';
const cache = new Map(); // id -> tên ('' = tài khoản không có tên đăng nhập)
const asking = new Set();
let unsupported = false;

// Tên hiện cho người chơi id. claimed: tên người đó tự gửi (chỉ dùng khi máy chủ chưa có player_names)
export function displayName(id, claimed) {
  if (cache.has(id)) return cache.get(id) || FALLBACK;
  if (unsupported) return String(claimed ?? '').slice(0, 24) || FALLBACK;
  return FALLBACK; // chưa hỏi xong: chưa hiện tên tự gửi (có thể là tên giả)
}

// Hỏi tên thật của các id chưa biết. Trả về true nếu vừa biết thêm tên (để vẽ lại nhãn)
export async function loadNames(ids) {
  if (!supabase || unsupported) return false;
  const want = [...new Set(ids)].filter((id) => id && !cache.has(id) && !asking.has(id)).slice(0, 50);
  if (!want.length) return false;
  for (const id of want) asking.add(id);
  try {
    const { data, error } = await supabase.rpc('player_names', { p_ids: want });
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') unsupported = true;
      return unsupported;
    }
    for (const id of want) cache.set(id, '');
    for (const row of data ?? []) cache.set(row.user_id, row.username ?? '');
    return true;
  } catch {
    return false;
  } finally {
    for (const id of want) asking.delete(id);
  }
}

// Test: quên hết
export function resetNames() {
  cache.clear();
  asking.clear();
  unsupported = false;
}
