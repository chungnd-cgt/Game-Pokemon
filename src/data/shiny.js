// Màu shiny của từng loài, theo màu shiny trong game gốc (Gen 2 trở đi): shiny không phải xoay màu ngẫu nhiên
// mà là một bảng màu khác của chính loài đó (Charizard đen, Gyarados đỏ, Pikachu vàng cam...). Chỉ một số phần đổi màu,
// phần còn lại (mắt, lửa đuôi, viền) giữ nguyên.
//
// Loài vẽ bằng code (gfx/textures.js): vẽ lại với các màu dưới đây thay cho màu trong monsters.js
//   color / belly: thân / bụng • wing: cánh • shell: mai • bulb: củ / hoa trên lưng • leaf: lá • flame: [lửa ngoài, lửa trong]
// Loài có hình SVG / PNG: đổi màu theo vùng sắc độ (gfx/pixel.js: recolorHues)
//   rules: [[màu gốc trong hình, màu shiny, { hue: độ lệch sắc độ (mặc định 22°), light: độ lệch độ sáng (mặc định 0.3) }]]

export const SHINY = {
  // ---------- Có hình SVG ----------
  bulbasaur: { rules: [['#62b49a', '#9ccc6a', { hue: 20 }], ['#52a852', '#b4b838', { hue: 24 }]] },
  charmander: { rules: [['#ea7a36', '#f8c43a', { hue: 7 }]] },
  squirtle: { rules: [['#6ebee2', '#5ccfc6', { hue: 18 }], ['#c88848', '#e8963a', { hue: 12, light: 0.2 }]] },
  rattata: { rules: [['#9a72b8', '#a8bc5a', { hue: 20 }]] },
  pidgey: { rules: [['#a87444', '#c8a03c', { hue: 12, light: 0.25 }]] },
  oddish: { rules: [['#4b68b8', '#4aa4a0', { hue: 18 }], ['#4fb050', '#a8c844', { hue: 22 }]] },
  poliwag: { rules: [['#3f64b0', '#5aa2e8', { hue: 15 }]] },
  pikachu: { rules: [['#f0bc20', '#f09c22', { hue: 12 }]] },
  ekans: { rules: [['#a070c8', '#a8c050', { hue: 20 }]] },
  koffing: { rules: [['#8a6aa8', '#58a8b0', { hue: 20 }]] },
  growlithe: { rules: [['#e88a3a', '#f0c040', { hue: 10, light: 0.25 }]] },
  // Meowth: lông kem ngả màu đào; đồng xu vàng trên trán giữ nguyên (khác độ sáng nên không bị đổi)
  meowth: { rules: [['#f6e6b8', '#f0c890', { hue: 14, light: 0.12 }]] },
  // Magikarp vàng kim: chỉ thân đổi màu, râu / vây / môi giữ nguyên
  magikarp: { rules: [['#f06a3a', '#f0b830', { hue: 14 }]] },

  // Dạng tiến hoá / thú cưỡi có hình SVG
  charmeleon: { rules: [['#d84a32', '#f0b838', { hue: 9 }]] },
  charizard: { rules: [['#f08a3a', '#4a4a54', { hue: 9 }], ['#2e8aa0', '#b83040', { hue: 16 }]] },
  wartortle: { rules: [['#7ea8e6', '#a090e0', { hue: 14, light: 0.11 }]] },
  blastoise: { rules: [['#5c88d4', '#8070c8', { hue: 14, light: 0.2 }]] },
  ivysaur: { rules: [['#62b49a', '#8cc884', { hue: 20 }], ['#e87ca0', '#e8a838', { hue: 10 }]] },
  vileplume: { rules: [['#d83838', '#e0509c', { hue: 18, light: 0.15 }]] },
  poliwhirl: { rules: [['#5f8ad8', '#78b8f0', { hue: 15 }]] },
  poliwrath: { rules: [['#3a5aa8', '#3f9a5a', { hue: 15 }]] },
  raichu: { rules: [['#e88a28', '#c8683a', { hue: 12, light: 0.15 }]] },
  arbok: { rules: [['#a070c8', '#b8bc48', { hue: 20 }]] },
  weezing: { rules: [['#8a6aa8', '#58a8b0', { hue: 20 }]] },
  persian: { rules: [['#f6e6b8', '#f4c8b0', { hue: 14, light: 0.12 }]] },
  arcanine: { rules: [['#e88a3a', '#f0c040', { hue: 10, light: 0.25 }]] },
  gyarados: { rules: [['#3a7ac8', '#d83a3a', { hue: 25, light: 0.22 }]] },
  lapras: { rules: [['#58a0d8', '#9a78c8', { hue: 20 }]] },
  venusaur: { rules: [['#62b49a', '#78c08c', { hue: 18 }], ['#ec7290', '#f0a848', { hue: 6, light: 0.3 }]] },
  raticate: { rules: [['#b88250', '#c8683c', { hue: 10, light: 0.25 }]] },
  pidgeotto: { rules: [['#a87444', '#c8a03c', { hue: 12, light: 0.25 }]] },
  pidgeot: { rules: [['#a87444', '#c8a03c', { hue: 12, light: 0.25 }]] },
  gloom: { rules: [['#4b68b8', '#4aa4a0', { hue: 18 }], ['#dc5e38', '#eca038', { hue: 10, light: 0.3 }]] },

  magnemite: { rules: [['#94a4bc', '#c4b07c', { hue: 10, light: 0.3 }]] },
  magneton: { rules: [['#94a4bc', '#c4b07c', { hue: 10, light: 0.3 }]] },
  voltorb: { rules: [['#e03a30', '#4a78d8', { hue: 16, light: 0.3 }]] },
  electrode: { rules: [['#e03a30', '#4a78d8', { hue: 16, light: 0.3 }]] },
  staryu: { rules: [['#c88a4a', '#e0c048', { hue: 10, light: 0.3 }]] },
  starmie: { rules: [['#8a5cb8', '#5a7ed4', { hue: 20, light: 0.3 }]] },

  mankey: { rules: [['#f3e3c6', '#e2e6ae', { hue: 10, light: 0.25 }]] },
  primeape: { rules: [['#f3e3c6', '#e2e6ae', { hue: 10, light: 0.25 }]] },
  hitmonlee: { rules: [['#ac7848', '#a8a052', { hue: 8, light: 0.22 }]] },
  hitmonchan: { rules: [['#a8764a', '#a89a58', { hue: 8, light: 0.22 }]] },
  lickitung: { rules: [['#f0a0b4', '#e8d890', { hue: 12, light: 0.14 }]] },
  snorlax: { rules: [['#3a7686', '#284880', { hue: 20 }]] },

  slowpoke: { rules: [['#f0a0b8', '#dcb0e8', { hue: 25, light: 0.2 }]] },
  slowbro: { rules: [['#f0a0b8', '#dcb0e8', { hue: 25, light: 0.2 }]] },
  seel: { rules: [['#e6eef8', '#f2e2c8', { hue: 25, light: 0.15 }]] },
  dewgong: { rules: [['#e6eef8', '#f4ecd0', { hue: 25, light: 0.15 }]] },
  shellder: { rules: [['#9a7ad0', '#f08848', { hue: 25, light: 0.3 }]] },
  cloyster: { rules: [['#6a5898', '#4a6cc0', { hue: 25, light: 0.25 }]] },

  zubat: { rules: [['#4a86d0', '#5cb04a', { hue: 18 }], ['#a868c0', '#e890b8', { hue: 16 }]] },
  golbat: { rules: [['#4a86d0', '#5cb04a', { hue: 18 }], ['#a868c0', '#e07898', { hue: 16 }]] },
  geodude: { rules: [['#a49478', '#c8a258', { hue: 14 }]] },
  graveler: { rules: [['#a49478', '#c88a50', { hue: 14 }]] },
  golem: { rules: [['#9a987a', '#b49a5c', { hue: 12 }], ['#c8885a', '#d86a48', { hue: 12, light: 0.25 }]] },
  onix: { rules: [['#9496a0', '#b8b468', { hue: 20, light: 0.25 }]] },
  bellsprout: { rules: [['#6cb84a', '#bcd440', { hue: 22 }]] },
  weepinbell: { rules: [['#f2d03c', '#d8e048', { hue: 14 }]] },
  victreebel: { rules: [['#e2d23e', '#f4c430', { hue: 18 }]] },
  tentacool: { rules: [['#7cc8f0', '#c0a0f0', { hue: 14, light: 0.22 }]] },
  tentacruel: { rules: [['#7cc8f0', '#c0a0f0', { hue: 12, light: 0.22 }], ['#4a78c8', '#8a5ac8', { hue: 10 }]] },
  grimer: { rules: [['#a476c6', '#7cc060', { hue: 20, light: 0.25 }]] },
  muk: { rules: [['#9468b8', '#6aa848', { hue: 20, light: 0.25 }]] },

  gastly: { rules: [['#9a6ad0', '#c87ac8', { hue: 25 }]] },
  haunter: { rules: [['#7450b0', '#5a4880', { hue: 22 }]] },
  gengar: { rules: [['#7450b0', '#9c94c0', { hue: 22 }]] },
  machop: { rules: [['#7d97b8', '#c0c890', { hue: 20 }]] },
  machoke: { rules: [['#9a9cc0', '#b0c088', { hue: 20 }]] },
  machamp: { rules: [['#8898bc', '#a8b888', { hue: 20 }]] },

  eevee: { rules: [['#b8804a', '#c8c8d0', { hue: 14, light: 0.2 }]] },
  vaporeon: { rules: [['#58b0e0', '#a888d0', { hue: 12, light: 0.2 }]] },
  jolteon: { rules: [['#ecbc30', '#c4dc4c', { hue: 14, light: 0.25 }]] },
  flareon: { rules: [['#ea6c30', '#f0b848', { hue: 12, light: 0.2 }]] },
  aerodactyl: { rules: [['#a898b8', '#c890c8', { hue: 25, light: 0.25 }]] },

  abra: { rules: [['#f4c840', '#f2b8a0', { hue: 12, light: 0.24 }]] },
  kadabra: { rules: [['#f4c840', '#f2b8a0', { hue: 12, light: 0.24 }]] },
  alakazam: { rules: [['#f4c840', '#f2b8a0', { hue: 12, light: 0.24 }]] },
  drowzee: { rules: [['#e8b23a', '#f2aab8', { hue: 9, light: 0.24 }]] },
  hypno: { rules: [['#f2c450', '#f4a6c4', { hue: 9, light: 0.24 }]] },
  jynx: { rules: [['#7a50b4', '#c070c0', { hue: 15, light: 0.25 }]] },

  dratini: { rules: [['#6aa8ee', '#e8a0c8', { hue: 16 }]] },
  dragonair: { rules: [['#6aa8ee', '#e090c0', { hue: 14 }]] },
  dragonite: { rules: [['#f09a3a', '#80b060', { hue: 9, light: 0.2 }], ['#f8e8b8', '#d8e8b0', { hue: 6, light: 0.15 }]] },
  goldeen: { rules: [['#eceef8', '#f0c858', { hue: 25 }]] },
  seaking: { rules: [['#f07838', '#f0c058', { hue: 10, light: 0.25 }]] },
  psyduck: { rules: [['#f8d048', '#88c8e8', { hue: 10, light: 0.16 }]] },
  golduck: { rules: [['#4c8ed8', '#70c0e0', { hue: 20 }]] },

  vulpix: { rules: [['#c0563a', '#e8b448', { hue: 9, light: 0.15 }]] },
  ninetales: { rules: [['#ecd08a', '#c8d4ec', { hue: 14, light: 0.2 }]] },
  ponyta: { rules: [['#ffc63a', '#5a8cf0', { hue: 24, light: 0.13 }]] },
  rapidash: { rules: [['#ffc63a', '#4a4a64', { hue: 24, light: 0.13 }]] },
  rhyhorn: { rules: [['#9ca4b8', '#dcb8a8', { hue: 20, light: 0.25 }]] },
  rhydon: { rules: [['#9ca4b8', '#d8bca0', { hue: 20, light: 0.25 }]] },

  // ---------- Các loài còn lại của Kanto (đủ 151) ----------
  // Sâu bọ: Caterpie / Metapod vàng cam, Butterfree thân và cánh hồng, Weedle vàng, Kakuna xanh lá, Beedrill vàng chanh
  caterpie: { rules: [['#a8de72', '#f4c840', { hue: 24 }]] },
  metapod: { rules: [['#76b850', '#e8703a', { hue: 20 }]] },
  butterfree: { rules: [['#5656b0', '#9a6a9c', { hue: 20 }], ['#d6dcee', '#f8d4e4', { hue: 15, light: 0.12 }], ['#e83448', '#4cc050', { hue: 14 }], ['#6ab4de', '#f0a0b4', { hue: 15 }]] },
  weedle: { rules: [['#e8bc84', '#ecdc62', { hue: 14 }]] },
  kakuna: { rules: [['#efc444', '#9cc848', { hue: 15 }]] },
  beedrill: { rules: [['#e2a826', '#b8d040', { hue: 14 }], ['#ea3a3a', '#3a8ae8', { hue: 12 }]] },
  // Chim: lông nâu ngả vàng, cánh / mào đỏ giữ nguyên; Doduo / Dodrio xanh ô liu; Farfetch'd lông hồng nhạt
  spearow: { rules: [['#cc8e56', '#c8b050', { hue: 10 }], ['#b0302a', '#f0c838', { hue: 8, light: 0.22 }]] },
  fearow: { rules: [['#c4854a', '#c8b050', { hue: 10 }]] },
  doduo: { rules: [['#bd8650', '#a8b050', { hue: 7 }]] },
  dodrio: { rules: [['#bd8650', '#a8b050', { hue: 7 }]] },
  farfetchd: { rules: [['#cfa274', '#d8a0a8', { hue: 6 }]] },
  // Đất: Sandshrew xanh ô liu, Sandslash da đỏ gạch; Diglett / Dugtrio màu hồng tím; Cubone / Marowak da xanh ô liu
  sandshrew: { rules: [['#e6b858', '#94b858', { hue: 12, light: 0.15 }]] }, // bụng kem sáng hơn nên giữ nguyên
  sandslash: { rules: [['#c88a48', '#c83838', { hue: 7 }], ['#d29e3e', '#e8d478', { hue: 5 }]] },
  diglett: { rules: [['#8a5634', '#b8864e', { hue: 12 }], ['#e45c7c', '#7088e0', { hue: 12 }]] },
  dugtrio: { rules: [['#84502e', '#b8864e', { hue: 12 }], ['#e45c7c', '#7088e0', { hue: 12 }]] },
  cubone: { rules: [['#c08a52', '#a8a050', { hue: 10 }]] },
  marowak: { rules: [['#c08a52', '#8aa050', { hue: 10 }]] },
  // Họ Nidoran: cái xanh -> hồng tím, đực tím -> xanh dương; Nidoqueen xanh lá xám, Nidoking xanh dương
  'nidoran-f': { rules: [['#8a9ee0', '#c898d8', { hue: 15 }], ['#3a5cc0', '#4c9a48', { hue: 6, light: 0.1 }]] },
  nidorina: { rules: [['#80b2dc', '#d0a0d8', { hue: 15 }], ['#3456b4', '#3c7a3c', { hue: 6, light: 0.1 }]] },
  nidoqueen: { rules: [['#3c74b8', '#7aa060', { hue: 15 }], ['#dcc690', '#f0a8b8', { hue: 10 }]] },
  'nidoran-m': { rules: [['#b47cc8', '#7aa0e0', { hue: 20 }], ['#4ab0a2', '#a07040', { hue: 12 }]] },
  nidorino: { rules: [['#a866c0', '#6a8ad8', { hue: 20 }], ['#3aa498', '#a07040', { hue: 12 }]] },
  nidoking: { rules: [['#7a4ca6', '#4a78c8', { hue: 15 }], ['#3aa498', '#a07040', { hue: 12 }]] },
  // Hồng: Clefairy hồng đào, Clefable hồng tím, Jigglypuff / Wigglytuff hồng cam nhạt, Chansey hồng kem
  clefairy: { rules: [['#f4a6ba', '#f6dce2', { hue: 15 }], ['#704020', '#58b040', { hue: 15 }]] },
  clefable: { rules: [['#ec98b2', '#f6e0e0', { hue: 15 }], ['#704020', '#58b040', { hue: 15 }]] },
  jigglypuff: { rules: [['#f0a4c2', '#eeb2dc', { hue: 15 }], ['#3a9cc4', '#3cb040', { hue: 15 }]] },
  wigglytuff: { rules: [['#ee9cbe', '#e6b0e0', { hue: 15 }], ['#2e9cb0', '#3cb040', { hue: 15 }]] },
  chansey: { rules: [['#ec98b0', '#f0d0b8', { hue: 15 }]] },
  // Nấm / cỏ: nấm Paras / Parasect vàng cam, Venonat / Venomoth xanh dương, Exeggcute trứng vàng, Exeggutor lá vàng,
  // Tangela dây leo xanh lá
  paras: { rules: [['#dc6c2a', '#e65a3a', { hue: 8 }]] },
  parasect: { rules: [['#e2502e', '#ec943a', { hue: 8 }], ['#d8662a', '#e2c040', { hue: 10 }]] },
  venonat: { rules: [['#8a5cb6', '#6a7ad8', { hue: 15 }], ['#e83a50', '#3a8ae8', { hue: 12 }]] },
  venomoth: { rules: [['#8a64b8', '#5a80d0', { hue: 15, light: 0.2 }], ['#c8aee2', '#a8cce8', { hue: 15, light: 0.2 }]] },
  exeggcute: { rules: [['#f8bcc6', '#f0b858', { hue: 15 }]] },
  exeggutor: { rules: [['#8ad460', '#c8704a', { hue: 18 }], ['#7e5c3e', '#a8a050', { hue: 12 }]] },
  tangela: { rules: [['#5a86d8', '#5aa860', { hue: 15 }]] },
  // Nước: Krabby xanh vàng, Kingler xanh lá; Horsea / Seadra tím; Omanyte / Omastar tím
  krabby: { rules: [['#e8552e', '#e8c448', { hue: 10 }]] },
  kingler: { rules: [['#e8552e', '#78b048', { hue: 10 }]] },
  horsea: { rules: [['#6cb6ec', '#4cbab0', { hue: 15 }]] },
  seadra: { rules: [['#4a8ad8', '#9068c8', { hue: 15 }], ['#e8d48c', '#e87a6a', { hue: 12 }]] },
  omanyte: { rules: [['#3c90d2', '#9a70d0', { hue: 15 }]] },
  omastar: { rules: [['#3c90d2', '#9a70d0', { hue: 15 }]] },
  // Kabuto / Kabutops mai xanh lá
  kabuto: { rules: [['#d89a58', '#88b048', { hue: 10 }]] },
  kabutops: { rules: [['#d89a58', '#b4dc3c', { hue: 10 }]] },
  // Kangaskhan / Tauros / Pinsir: nâu ngả ô liu / vàng / tím xám
  kangaskhan: { rules: [['#ac8458', '#9a9a60', { hue: 8 }]] },
  tauros: { rules: [['#dca468', '#d8c060', { hue: 10 }]] },
  pinsir: { rules: [['#9a7250', '#8a78b0', { hue: 10 }]] },
  // Mr. Mime: các bóng tròn hồng -> xanh nhạt; Scyther xanh chanh; Electabuzz vàng cam; Magmar thân hồng (lửa giữ nguyên)
  'mr-mime': { rules: [['#f27c96', '#80c860', { hue: 10 }]] },
  scyther: { rules: [['#5aa43c', '#b0c840', { hue: 18 }]] },
  electabuzz: { rules: [['#f0bc26', '#f09a30', { hue: 12 }]] },
  magmar: { rules: [['#d43626', '#e0608a', { hue: 5 }]] },
  // Ditto xanh dương; Porygon tím và xanh nhạt
  ditto: { rules: [['#c4a0ec', '#80b8f0', { hue: 18 }]] },
  porygon: { rules: [['#4cb4cc', '#d8a0d4', { hue: 15 }], ['#ff9cb4', '#7070d8', { hue: 15 }]] },
  // Huyền thoại: Articuno xanh ngọc nhạt, Zapdos cam, Moltres hồng, Mewtwo đuôi xanh lá, Mew xanh dương
  articuno: { rules: [['#4a92dc', '#70c8d8', { hue: 20 }]] },
  zapdos: { rules: [['#f8d040', '#f8a038', { hue: 9 }]] },
  moltres: { rules: [['#f09a28', '#f0a0a8', { hue: 10, light: 0.2 }]] },
  mewtwo: { rules: [['#8a3ab8', '#58b048', { hue: 15, light: 0.25 }]] },
  mew: { rules: [['#f08ab2', '#80b8f0', { hue: 15 }]] },

  // ---------- Vẽ bằng code ----------
};
