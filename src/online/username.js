// Tên đăng nhập (giống public.normalize_username trong supabase/usernames.sql): bỏ khoảng trắng 2 đầu; 1-18 ký tự; chỉ chữ
// cái không dấu và số (khoảng trắng, chữ có dấu, biểu tượng... đều tính là ký tự đặc biệt); chữ cái đầu tự viết hoa. Không
// trùng (không phân biệt hoa thường, máy chủ kiểm tra)

export const USERNAME_MAX = 18;
// Câu báo chung cho mọi trường hợp sai quy tắc
export const USERNAME_RULE = `Tên đăng nhập chứa 1-${USERNAME_MAX} ký tự (không ký tự đặc biệt).`;

// Viết hoa chữ cái đầu (gõ tới đâu sửa tới đó, không đụng các chữ sau)
export const capitalizeFirst = (s) => s.replace(/^(\s*)([a-z])/, (_, sp, c) => sp + c.toUpperCase());

// Biểu tượng (emoji, ký hiệu hình): không cho hiện trong ô nhập (gõ / dán vào là bị bỏ)
const PICTO = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u200D\uFE0E\uFE0F\u20E3]/gu;
export const stripPictographs = (s) => s.replace(PICTO, '');

// { name } tên đã chuẩn hoá, hoặc { error } câu báo
export function checkUsername(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { error: 'Hãy nhập tên đăng nhập.' };
  if (!/^[A-Za-z0-9]+$/.test(s) || s.length > USERNAME_MAX) return { error: USERNAME_RULE };
  return { name: s[0].toUpperCase() + s.slice(1) };
}
