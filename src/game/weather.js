// Thời tiết ngoài trời theo vùng khí hậu (không phụ thuộc Phaser: dùng cho bản đồ, trận đấu và test).
// Hình ảnh (hạt mưa / tuyết / cát, màu trời) ở gfx/ambience.js.

export const WEATHER_NAMES = { rain: 'Mưa', snow: 'Tuyết rơi', hail: 'Mưa đá', sand: 'Bão cát' };

// Thời tiết theo vùng khí hậu của bản đồ (data/map.js: climate). Mỗi vùng: [[thời tiết, xác suất], ...], phần còn lại là trời quang.
//  normal: 15% mưa • snow (vùng tuyết): 80% tuyết rơi, 20% mưa đá • sand (vùng núi đá): 80% bão cát
// Mưa, mưa đá, bão cát có tác dụng trong trận đấu (như chiêu Rain Dance, Hail, Sandstorm nhưng kéo dài suốt trận);
// tuyết rơi chỉ là cảnh, không ảnh hưởng trận đấu.
export const CLIMATES = {
  normal: [['rain', 0.15]],
  snow: [['snow', 0.8], ['hail', 0.2]],
  sand: [['sand', 0.8]],
};

// Thời tiết ứng với số ngẫu nhiên r (0..1) của một vùng: 'rain' | 'snow' | 'hail' | 'sand' | null
export function rollWeather(climate, r) {
  let acc = 0;
  for (const [kind, p] of CLIMATES[climate] ?? CLIMATES.normal) {
    acc += p;
    if (r < acc) return kind;
  }
  return null;
}

// Mỗi vùng khí hậu một đợt thời tiết riêng, 3-7 phút đổi một lần
const periods = {};
export function weatherOf(climate = 'normal', now = Date.now()) {
  const key = CLIMATES[climate] ? climate : 'normal';
  const w = (periods[key] ??= { kind: null, until: 0 });
  if (now >= w.until) {
    w.kind = rollWeather(key, Math.random());
    w.until = now + (3 + Math.random() * 4) * 60000;
  }
  return w.kind;
}

// Thời tiết đang có ở một bản đồ (trong nhà, trong hang thì không có)
export const mapWeather = (map) => (map.indoor || map.cave ? null : weatherOf(map.climate));


// Ép thời tiết của một vùng trong vài phút (thử nghiệm / sự kiện cốt truyện). kind: null là trời quang
export function forceWeather(climate, kind, minutes = 5, now = Date.now()) {
  periods[CLIMATES[climate] ? climate : 'normal'] = { kind, until: now + minutes * 60000 };
}
