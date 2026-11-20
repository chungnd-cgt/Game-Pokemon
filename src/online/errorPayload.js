// Nội dung lỗi gửi lên Supabase (online/errorLog.js). Tách riêng (không cần Supabase) để test được

const text = (v) => {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

// Bỏ thông tin riêng có thể lẫn trong nội dung lỗi: email, token (JWT), đường dẫn có tham số (link email chứa token)
export function scrub(s) {
  return String(s ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<token>')
    .replace(/([?#])[^\s)'"]*/g, '$1…');
}

// Nội dung gửi lên cho một lỗi (tách riêng để test)
export function errorPayload(kind, args, context = {}) {
  const list = Array.isArray(args) ? args : [args];
  const err = list.find((a) => a instanceof Error) ?? (list[0] && typeof list[0] === 'object' && 'stack' in list[0] ? list[0] : null);
  return {
    p_kind: kind,
    p_message: scrub(list.map(text).join(' ')).slice(0, 500),
    p_stack: err?.stack ? scrub(err.stack).slice(0, 4000) : null,
    p_context: {
      ...context,
      path: location.pathname,
      ua: navigator.userAgent.slice(0, 200),
      screen: `${innerWidth}x${innerHeight}@${devicePixelRatio || 1}`,
      at: new Date().toISOString(),
    },
  };
}
