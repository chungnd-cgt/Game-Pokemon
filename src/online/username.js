// Tên đăng nhập (giống public.normalize_username trong supabase/usernames.sql): bỏ khoảng trắng 2 đầu; 1-18 ký tự; chỉ chữ
// cái không dấu và số (không khoảng trắng, ký tự đặc biệt, biểu tượng); chữ cái đầu tự viết hoa. Không trùng (không phân
// biệt hoa thường, máy chủ kiểm tra)

export const USERNAME_MAX = 18;

// Viết hoa chữ cái đầu (gõ tới đâu sửa tới đó, không đụng các chữ sau)
export const capitalizeFirst = (s) => s.replace(/^(\s*)([a-z])/, (_, sp, c) => sp + c.toUpperCase());

// { name } tên đã chuẩn hoá, hoặc { error } câu báo vì sao sai
export function checkUsername(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { error: 'Hãy nhập tên đăng nhập.' };
  if (/\s/.test(s)) return { error: 'Tên đăng nhập không được có khoảng trắng.' };
  if (!/^[A-Za-z0-9]+$/.test(s)) {
    return { error: 'Tên đăng nhập chỉ gồm chữ cái không dấu và số (không ký tự đặc biệt, biểu tượng).' };
  }
  if (s.length > USERNAME_MAX) return { error: `Tên đăng nhập tối đa ${USERNAME_MAX} ký tự.` };
  return { name: s[0].toUpperCase() + s.slice(1) };
}
