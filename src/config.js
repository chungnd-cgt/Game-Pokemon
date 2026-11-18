// Khung thiết kế: mọi bảng / màn hình (trận đấu, menu, Pokédex...) vẽ trong khung 960x720 này.
// Game thật cao 720, rộng theo tỉ lệ màn hình (960 ở 4:3 tới MAX_WIDTH ở 21:9, game/display.js): bản đồ thấy rộng hơn,
// nút trên bản đồ bám mép màn hình, còn khung thiết kế nằm giữa (lệch sang phải uiX(scene) px, ui/helpers.js)
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 720;
export const MAX_WIDTH = 1680;

// Ô bản đồ vẽ 16px như GBA, hiển thị phóng to x3 (màn hình thấy 20x15 ô)
export const TILE = 16;
export const WORLD_SCALE = 3;
export const CELL = TILE * WORLD_SCALE;

export const FONT = '"Nunito", "Segoe UI", Tahoma, Arial, sans-serif';
