// Vùng (bản đồ lớn) của game. Pokémon nhớ vùng nơi được bắt (mon.region, ghi lúc bắt: game/state.js addCaught); sau này
// mở thêm vùng mới thì thêm vào đây và đổi CURRENT_REGION theo nơi người chơi đang đứng
export const REGIONS = {
  sonthuy: { name: 'Sơn Thủy' },
};
export const CURRENT_REGION = 'sonthuy';
export const regionName = (id) => REGIONS[id ?? CURRENT_REGION]?.name ?? REGIONS[CURRENT_REGION].name;
