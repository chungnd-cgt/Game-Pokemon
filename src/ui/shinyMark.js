import { textStyle } from './helpers.js';

// Dấu Pokémon shiny: chữ "S" vàng đậm viền nâu (như "S Charizard" trong game MMO), đặt ngay trước tên.
// Đọc rõ trên cả nền sáng (khung trắng) lẫn nền tối / nền trận.
export const SHINY_MARK = { text: 'S', color: '#ffd23a', stroke: '#6a4300' };

// Tạo chữ "S" ở (x, y), gốc trên-trái (giống chữ tên). size: cỡ chữ (nên bằng cỡ chữ tên).
// Trả về Text; đặt tên lùi sang phải mark.width + gap (shinyGap(size))
export function shinyMark(scene, x, y, size = 16) {
  return scene.add.text(x, y, SHINY_MARK.text, textStyle(size, SHINY_MARK.color, {
    fontStyle: 'bold', stroke: SHINY_MARK.stroke, strokeThickness: Math.max(2, Math.round(size / 6)),
  }));
}

// Khoảng cách giữa chữ "S" và tên
export const shinyGap = (size = 16) => Math.max(3, Math.round(size / 5));

// Tiện dụng: Pokémon shiny thì thêm chữ "S" ở (x, y) vào add(obj) và trả về x mới cho tên; không shiny thì trả về x
export function withShinyMark(scene, add, mon, x, y, size = 16) {
  if (!mon?.shiny) return x;
  const mark = shinyMark(scene, x, y, size);
  add(mark);
  return x + mark.width + shinyGap(size);
}
