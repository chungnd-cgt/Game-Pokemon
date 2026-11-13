import * as THREE from 'three';
import { PX } from './nature.js';

// Vẽ texture mặt đất trên GPU (một lần khi dựng bản đồ, ~1 ms) thay cho vòng lặp từng điểm ảnh bằng JS (~300-500 ms).
// Shader là bản dịch 1:1 của paintGround trong nature.js, kể cả hàm nhiễu (cùng phép băm số nguyên),
// để mép đường / bụi cỏ trên texture khớp đúng chỗ lá cỏ được rải bằng JS.

let renderer = null;
// Gọi một lần khi có renderer (three/view3d.js). Chưa có renderer thì world3d dùng bản JS.
export function setBakeRenderer(r) {
  renderer = r;
}
export const canBake = () => Boolean(renderer);

const LAYERS = ['path', 'tall', 'deep', 'water', 'forest', 'rock', 'paddy', 'pond'];

const FRAG = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D uMaskA; // path, tall, deep, water
uniform sampler2D uMaskB; // forest, rock, paddy, pond
uniform vec2 uGrid;       // số ô (cols, rows) kể cả lề
uniform float uMargin;
uniform float uPX;
uniform float uSnow;
out vec4 fragColor;

float hash2(int ix, int iy) {
  uint n = uint(ix) * 374761393u + uint(iy) * 668265263u;
  n = (n ^ (n >> 13u)) * 1274126177u;
  return float(n ^ (n >> 16u)) / 4294967296.0;
}
float vnoise(float x, float y) {
  float fx0 = floor(x), fy0 = floor(y);
  int ix = int(fx0), iy = int(fy0);
  float fx = x - fx0, fy = y - fy0;
  float sx = fx * fx * (3.0 - 2.0 * fx);
  float sy = fy * fy * (3.0 - 2.0 * fy);
  float a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
float fbm(float x, float y) {
  return vnoise(x, y) * 0.5 + vnoise(x * 2.03 + 17.0, y * 2.03 + 9.0) * 0.3 + vnoise(x * 4.1 + 3.0, y * 4.1 + 31.0) * 0.2;
}
float sm(float a, float b, float x) { return smoothstep(a, b, x); }
// Render target sRGB tự mã hoá khi ghi: xuất màu tuyến tính để byte lưu lại đúng bằng màu của bản JS
vec4 outColor(vec3 c255) {
  vec3 c = clamp(c255 / 255.0, 0.0, 1.0);
  vec3 lin = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  return vec4(lin, 1.0);
}

// mặt nạ lấy mẫu song tuyến: tâm ô ở +0.5 (giống makeMasks)
vec4 maskA(float x, float y) { return texture(uMaskA, vec2(x + uMargin, y + uMargin) / uGrid); }
vec4 maskB(float x, float y) { return texture(uMaskB, vec2(x + uMargin, y + uMargin) / uGrid); }
float pathAlpha(float x, float y) { return sm(0.4, 0.58, maskA(x, y).r + (fbm(x * 1.7, y * 1.7) - 0.5) * 0.32); }
float tallAlpha(float x, float y) { return sm(0.36, 0.6, maskA(x, y).g + (fbm(x * 1.3 + 50.0, y * 1.3) - 0.5) * 0.4); }

const vec3 GRASS_A = vec3(95.0, 158.0, 66.0);
const vec3 GRASS_B = vec3(134.0, 187.0, 82.0);
const vec3 GRASS_DRY = vec3(168.0, 184.0, 90.0);
const vec3 TALL_GROUND = vec3(58.0, 110.0, 44.0);
const vec3 FOREST = vec3(62.0, 94.0, 44.0);
const vec3 NEEDLES = vec3(94.0, 74.0, 46.0);
const vec3 DIRT_A = vec3(200.0, 162.0, 106.0);
const vec3 DIRT_B = vec3(169.0, 132.0, 84.0);
const vec3 DIRT_EDGE = vec3(138.0, 106.0, 64.0);
const vec3 SAND = vec3(200.0, 176.0, 128.0);
const vec3 MUD = vec3(94.0, 106.0, 76.0);
const vec3 SCREE_A = vec3(168.0, 146.0, 122.0);
const vec3 SCREE_B = vec3(126.0, 108.0, 90.0);
const vec3 PADDY_MUD = vec3(106.0, 100.0, 64.0);
const vec3 PADDY_MUD_B = vec3(80.0, 80.0, 46.0);
const vec3 POND_BED = vec3(52.0, 72.0, 58.0);
const vec3 SNOW_A = vec3(226.0, 233.0, 242.0);
const vec3 SNOW_B = vec3(210.0, 220.0, 234.0);
const vec3 SNOW_SHADE = vec3(174.0, 191.0, 216.0);
const vec3 SLUSH_A = vec3(180.0, 172.0, 160.0);
const vec3 SLUSH_B = vec3(142.0, 132.0, 120.0);
const vec3 ICE_SAND = vec3(154.0, 164.0, 174.0);
const vec3 ICE_BED = vec3(78.0, 94.0, 112.0);

vec3 baseColor(bool snow, float x, float y) {
  float n1 = fbm(x * 0.35, y * 0.35);
  float forest = maskB(x, y).r;
  if (snow) {
    vec3 c = mix(SNOW_A, SNOW_B, n1);
    c = mix(c, SNOW_SHADE, sm(0.58, 0.82, fbm(x * 0.6 + 20.0, y * 0.6)) * 0.55);
    float f = sm(0.5, 0.9, forest);
    if (f > 0.0) c = mix(c, mix(SNOW_SHADE, vec3(96.0, 104.0, 108.0), sm(0.55, 0.8, fbm(x * 1.5, y * 1.5)) * 0.8), f * 0.8);
    return c;
  }
  vec3 c = mix(GRASS_A, GRASS_B, n1);
  c = mix(c, GRASS_DRY, sm(0.62, 0.8, fbm(x * 0.12 + 40.0, y * 0.12)) * 0.5);
  float f = sm(0.5, 0.9, forest);
  if (f > 0.0) c = mix(c, mix(FOREST, NEEDLES, fbm(x * 1.5, y * 1.5) * 0.7), f);
  float t = tallAlpha(x, y);
  if (t > 0.0) c = mix(c, TALL_GROUND, t * 0.9);
  return c;
}

void main() {
  bool snow = uSnow > 0.5;
  float px = floor(gl_FragCoord.x);
  // hàng 0 của canvas (bản JS) nằm trên cùng = v lớn nhất của texture
  float H = (uGrid.y + 1.0) * uPX;
  float py = H - 1.0 - floor(gl_FragCoord.y);
  vec3 c;
  if (py >= uGrid.y * uPX) {
    // vân đất vách hồ (chỉ dùng ô đầu tiên của hàng cuối)
    float j = py - uGrid.y * uPX;
    float n = vnoise(px * 0.5, j * 0.8);
    vec3 top = snow ? mix(SNOW_A, SNOW_B, n) : mix(GRASS_A, GRASS_B, n);
    c = j < 4.0 ? top : mix(vec3(128.0, 96.0, 62.0), vec3(98.0, 72.0, 46.0), n + (mod(j, 7.0) == 0.0 ? 0.3 : 0.0));
    fragColor = outColor(c);
    return;
  }
  float x = px / uPX - uMargin;
  float y = py / uPX - uMargin;
  float grain = vnoise(px * 0.9, py * 0.9) - 0.5;
  c = baseColor(snow, x, y);
  vec4 a = maskA(x, y);
  vec4 b = maskB(x, y);
  float r = b.g;
  if (r > 0.02) {
    vec3 scree = mix(SCREE_A, SCREE_B, fbm(x * 2.2 + 5.0, y * 2.2));
    c = mix(c, snow ? mix(scree, SNOW_B, 0.5) : scree, sm(0.05, 0.5, r + (fbm(x * 1.4, y * 1.4 + 9.0) - 0.5) * 0.3) * 0.9);
  }
  float p = pathAlpha(x, y);
  if (p > 0.0) {
    vec3 dirt;
    if (snow) {
      dirt = mix(SLUSH_A, SLUSH_B, fbm(x * 0.8 + 11.0, y * 0.8));
      dirt = mix(dirt, SNOW_B, sm(0.55, 0.75, fbm(x * 1.6 + 3.0, y * 0.5)) * 0.7);
      dirt = mix(SNOW_SHADE, dirt, sm(0.5, 0.95, p));
    } else {
      dirt = mix(DIRT_A, DIRT_B, fbm(x * 0.8 + 11.0, y * 0.8));
      dirt = mix(DIRT_EDGE, dirt, sm(0.5, 0.95, p));
    }
    float pebble = vnoise(px * 0.45 + 7.0, py * 0.45);
    if (pebble > 0.86) dirt = mix(dirt, vec3(228.0, 214.0, 186.0), (pebble - 0.86) * 5.0);
    else if (pebble < 0.1) dirt = mix(dirt, vec3(120.0, 92.0, 60.0), (0.1 - pebble) * 5.0);
    c = mix(c, dirt, p);
  }
  float w = a.a;
  if (w > 0.5) c = snow ? mix(ICE_SAND, ICE_BED, sm(0.6, 1.0, w) * 0.9) : mix(SAND, MUD, sm(0.6, 1.0, w) * 0.8);
  if (b.b > 0.5) c = mix(PADDY_MUD, PADDY_MUD_B, fbm(x * 3.0, y * 3.0) * 0.6 + (sin(y * 3.14159265 * 8.0) > 0.6 ? 0.3 : 0.0));
  if (b.a > 0.5) c = mix(POND_BED, MUD, fbm(x * 2.0, y * 2.0) * 0.5);
  float k = snow ? 1.0 + grain * 0.08 + (grain > 0.42 ? 0.06 : 0.0) : 1.0 + grain * 0.16;
  fragColor = outColor(min(c * k, vec3(255.0)));
}
`;

let quad = null;
function maskTexture(masks, names, cols, rows) {
  const data = new Uint8Array(cols * rows * 4);
  names.forEach((name, ch) => {
    const src = masks[name].data;
    for (let i = 0; i < cols * rows; i++) data[i * 4 + ch] = src[i] * 255;
  });
  const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
  // hàng 0 của mảng = hàng ô trên cùng; v = (y + lề) / rows nên không lật
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// Trả về texture mặt đất (cùng kích thước, cùng cách đặt toạ độ như canvas của paintGround)
export function bakeGround(map, masks, margin) {
  const cols = map.width + margin * 2;
  const rows = map.height + margin * 2;
  const W = cols * PX;
  const H = (rows + 1) * PX;
  const maskA = maskTexture(masks, LAYERS.slice(0, 4), cols, rows);
  const maskB = maskTexture(masks, LAYERS.slice(4), cols, rows);
  quad ??= new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: 'in vec3 position; void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAG,
    uniforms: { uMaskA: { value: null }, uMaskB: { value: null }, uGrid: { value: new THREE.Vector2() }, uMargin: { value: 0 }, uPX: { value: PX }, uSnow: { value: 0 } },
    depthTest: false,
    depthWrite: false,
  }));
  quad.frustumCulled = false;
  const u = quad.material.uniforms;
  u.uMaskA.value = maskA;
  u.uMaskB.value = maskB;
  u.uGrid.value.set(cols, rows);
  u.uMargin.value = margin;
  u.uSnow.value = map.snow ? 1 : 0;

  const target = new THREE.WebGLRenderTarget(W, H, {
    depthBuffer: false,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.SRGBColorSpace,
  });
  target.texture.anisotropy = 8;
  const prev = renderer.getRenderTarget();
  const camera = new THREE.Camera();
  renderer.setRenderTarget(target);
  renderer.render(quad, camera);
  renderer.setRenderTarget(prev);
  maskA.dispose();
  maskB.dispose();
  return target;
}
