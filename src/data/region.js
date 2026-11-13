import { MAPS } from './map.js';

// Bản đồ vùng Sơn Thủy (toạ độ trên màn hình 960x720). kind: 'town' | 'village' | 'route' | 'cave' | 'league'
// village: làng nhỏ nằm trên tuyến đường, ngay trước thành phố có gym; label: tên hiện phía trên ('above') hoặc bên phải ('right')
// path: đường đi của tuyến đường • future: nơi chưa mở (hiện mờ, "???")
export const REGION_NAME = 'Vùng Sơn Thủy';

export const PLACES = [
  { id: 'pallet', name: 'Thị trấn Pallet', kind: 'town', x: 190, y: 520, label: 'right' },
  // Tuyến đường 2: từ lối phía bắc Pallet đi lên rồi sang đông tới Lục Bình, qua Lục Bình tới Hang Thạch Nhũ
  { id: 'route2', name: 'Tuyến đường 2', kind: 'route', path: [[190, 520], [192, 490], [240, 482], [295, 484], [365, 470], [405, 452]] },
  { id: 'town1', name: 'Thị trấn Lục Bình', kind: 'town', x: 295, y: 484, label: 'above' },
  // Sông Lục Bình: từ hồ phía nam Pallet vòng xuống dưới rồi lên ao phía tây nam Lục Bình (chỉ lướt nước)
  { id: 'river1', name: 'Sông Lục Bình', kind: 'route', water: true, path: [[190, 520], [200, 552], [285, 556], [330, 525], [295, 484]] },
  { id: 'cave1', name: 'Hang Thạch Nhũ', kind: 'cave', x: 420, y: 440 },
  { id: 'route3', name: 'Tuyến đường 3', kind: 'route', path: [[420, 440], [470, 390], [590, 390]] },
  { id: 'village1', name: 'Làng Chân Đồi', kind: 'village', x: 550, y: 390, label: 'above' },
  { id: 'town2', name: 'Thành phố Đồi Gió', kind: 'town', x: 610, y: 390, gym: 'wind' },
  { id: 'route4', name: 'Tuyến đường 4', kind: 'route', path: [[610, 390], [760, 390], [790, 290]] },
  { id: 'village2', name: 'Xóm Cối Xay', kind: 'village', x: 778, y: 335, label: 'right' },
  { id: 'town3', name: 'Thành phố Lúa Vàng', kind: 'town', x: 790, y: 280, gym: 'grass' },
  { id: 'route5', name: 'Tuyến đường 5', kind: 'route', path: [[790, 280], [790, 170], [650, 150]] },
  { id: 'village3', name: 'Xóm Trạm Điện', kind: 'village', x: 705, y: 158, label: 'above' },
  { id: 'town4', name: 'Thành phố Đèn Lồng', kind: 'town', x: 640, y: 150, gym: 'electric' },
  { id: 'route6', name: 'Tuyến đường 6', kind: 'route', path: [[640, 150], [470, 150]] },
  { id: 'village4', name: 'Làng Bến Đò', kind: 'village', x: 525, y: 150, label: 'above' },
  { id: 'town5', name: 'Thành phố Sông Nước', kind: 'town', x: 460, y: 160, gym: 'water' },
  { id: 'route7', name: 'Tuyến đường 7', kind: 'route', path: [[460, 160], [460, 270], [330, 300]] },
  { id: 'village5', name: 'Làng Đất Sét', kind: 'village', x: 380, y: 288, label: 'above' },
  { id: 'town6', name: 'Thành phố Lò Gốm', kind: 'town', x: 320, y: 300, gym: 'fire' },
  { id: 'route8', name: 'Tuyến đường 8', kind: 'route', path: [[320, 300], [230, 320], [150, 330]] },
  { id: 'village6', name: 'Bản Vách Đá', kind: 'village', x: 205, y: 324, label: 'above' },
  { id: 'town7', name: 'Thành phố Núi Đá', kind: 'town', x: 150, y: 330, gym: 'rock' },
  { id: 'route9', name: 'Tuyến đường 9', kind: 'route', path: [[150, 330], [105, 430], [115, 560], [230, 590], [318, 572]] },
  { id: 'cave2', name: 'Hang Sơn Động', kind: 'cave', x: 330, y: 562 },
  { id: 'village7', name: 'Xóm Hương Khói', kind: 'village', x: 405, y: 564, label: 'above' },
  { id: 'town8', name: 'Thành phố Chùa Cổ', kind: 'town', x: 480, y: 565, gym: 'psychic' },
  // Vẽ nối từ cửa Hang Sơn Động: lối ra của hang mở thẳng ra Xóm Hương Khói (không có tuyến đường riêng), rồi Chùa Cổ
  { id: 'route10', name: 'Tuyến đường 10', kind: 'route', path: [[330, 562], [480, 565], [620, 565], [750, 548]] },
  { id: 'village8', name: 'Làng Đèo Tuyết', kind: 'village', x: 695, y: 555, label: 'above' },
  { id: 'town9', name: 'Thành phố Sương Mù', kind: 'town', x: 760, y: 545, gym: 'ice' },
  { id: 'route11', name: 'Đường Chiến Thắng', kind: 'route', path: [[760, 545], [835, 518]] },
  { id: 'cave3', name: 'Hang Vân Sơn', kind: 'cave', x: 845, y: 510 },
  { id: 'league', name: 'Cao nguyên Liên Minh', kind: 'league', x: 880, y: 430 },
];


// Khu vực của một bản đồ (trong nhà thì theo bản đồ ngoài cửa)
export function placeOf(mapId) {
  const map = MAPS[mapId];
  if (!map) return null;
  return map.place ?? (map.exit ? MAPS[map.exit.to]?.place ?? null : null);
}

// Điểm đánh dấu vị trí trên bản đồ vùng: giữa tuyến đường hoặc ngay thị trấn / hang
export function placePoint(place) {
  if (!place.path) return [place.x, place.y];
  const [a, b] = [place.path[Math.floor((place.path.length - 1) / 2)], place.path[Math.ceil((place.path.length - 1) / 2)]];
  return place.path.length % 2 ? place.path[(place.path.length - 1) / 2] : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
