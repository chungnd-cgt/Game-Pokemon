// Giờ máy chủ (Supabase, hàm public.server_now trong supabase/safari.sql): dùng cho vé Khu Safari, để chỉnh đồng hồ máy người
// chơi không kéo dài được vé. Hỏi máy chủ một lần rồi tự đếm tiếp bằng đồng hồ đơn điệu của trình duyệt (performance.now:
// không đổi theo giờ hệ thống), nên không cần hỏi máy chủ liên tục. Hỏi lại lúc mua vé, khi vừa mở lại tab / máy vừa ngủ
// dậy (đồng hồ đơn điệu có thể dừng lúc máy ngủ) và thưa thớt khi đang ở Khu Safari (story/safari.js).
// Chưa hỏi được thì tạm dùng giờ máy.
// supabase.js chỉ nạp lúc gọi máy chủ (nó đọc biến môi trường của Vite: nạp sẵn thì test chạy bằng Node bị lỗi)

let base = null; // { server: giờ máy chủ (ms), perf: performance.now() lúc đó }
let syncedAt = 0; // performance.now() lần hỏi được gần nhất

export const serverNow = () => (base ? base.server + (performance.now() - base.perf) : Date.now());
export const clockSynced = () => base !== null;
// Bao lâu (ms) từ lần hỏi được giờ máy chủ gần nhất (chưa hỏi được: Infinity)
export const sinceSync = () => (base ? performance.now() - syncedAt : Infinity);

// Hỏi giờ máy chủ: { now } (giờ máy chủ hiện tại) hoặc { error: câu báo }
export async function syncServerClock() {
  try {
    const { supabase } = await import('./supabase.js');
    if (!supabase) return { error: 'Chưa kết nối máy chủ.' };
    const p0 = performance.now();
    const { data, error } = await supabase.rpc('server_now');
    const p1 = performance.now();
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') {
        return { error: 'Máy chủ chưa cài giờ cho Khu Safari (người làm game chạy supabase/safari.sql).' };
      }
      return { error: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' };
    }
    const server = new Date(data).getTime();
    if (!Number.isFinite(server)) return { error: 'Máy chủ trả giờ không hợp lệ.' };
    base = { server, perf: (p0 + p1) / 2 }; // giờ máy chủ ứng với giữa lúc gửi và lúc nhận
    syncedAt = p1;
    return { now: serverNow() };
  } catch {
    return { error: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' };
  }
}
