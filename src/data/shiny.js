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
  bulbasaur: { rules: [['#62b49a', '#9ccc6a', { hue: 20 }], ['#6cbc48', '#46b03c', { hue: 22 }]] },
  charmander: { rules: [['#ea7a36', '#f8c43a', { hue: 7 }]] },
  squirtle: { rules: [['#6ebee2', '#5ccfc6', { hue: 18 }], ['#c88848', '#e8963a', { hue: 12, light: 0.2 }]] },
  rattata: { rules: [['#9a72b8', '#a8bc5a', { hue: 20 }]] },
  pidgey: { rules: [['#a87444', '#c8a03c', { hue: 12, light: 0.25 }]] },
  oddish: { rules: [['#4b68b8', '#4aa4a0', { hue: 18 }], ['#4fb050', '#a8c844', { hue: 22 }]] },
  poliwag: { rules: [['#3f64b0', '#5aa2e8', { hue: 15 }]] },
  pikachu: { rules: [['#f0bc20', '#f09c22', { hue: 12 }]] },
  ekans: { rules: [['#a070c8', '#a8c050', { hue: 20 }]] },
  koffing: { rules: [['#8a6aa8', '#58a8b0', { hue: 20, light: 0.3 }], ['#e4dc98', '#e8a8d4', { hue: 14, light: 0.2 }]] },
  growlithe: { rules: [['#e88a3a', '#f0c040', { hue: 10, light: 0.25 }]] },
  // Meowth: lông kem ngả màu đào; đồng xu vàng trên trán giữ nguyên (khác độ sáng nên không bị đổi)
  meowth: { rules: [['#f2dca0', '#f0c890', { hue: 7, light: 0.15 }]] },
  // Magikarp vàng kim: chỉ thân đổi màu, râu / vây / môi giữ nguyên
  magikarp: { rules: [['#f06a3a', '#f0b830', { hue: 14 }]] },

  // Dạng tiến hoá / thú cưỡi có hình SVG
  charmeleon: { rules: [['#d84a32', '#f0b838', { hue: 9 }]] },
  charizard: { rules: [['#f08a3a', '#4a4a54', { hue: 9 }], ['#2e8aa0', '#b83040', { hue: 16 }]] },
  wartortle: { rules: [['#7ea8e6', '#a090e0', { hue: 14, light: 0.11 }]] },
  blastoise: { rules: [['#5c88d4', '#8070c8', { hue: 14, light: 0.2 }]] },
  ivysaur: { rules: [['#62b49a', '#8cc884', { hue: 20 }], ['#e86a8a', '#eca838', { hue: 7 }]] },
  vileplume: { rules: [['#d83838', '#e0509c', { hue: 18, light: 0.15 }]] },
  poliwhirl: { rules: [['#5f8ad8', '#78b8f0', { hue: 15 }]] },
  poliwrath: { rules: [['#3a5aa8', '#3f9a5a', { hue: 15 }]] },
  raichu: { rules: [['#e88a28', '#c8683a', { hue: 12, light: 0.15 }]] },
  arbok: { rules: [['#9884c8', '#c0b448', { hue: 20 }]] },
  weezing: { rules: [['#8a6aa8', '#58a8b0', { hue: 20, light: 0.3 }], ['#e4dc98', '#e8a8d4', { hue: 14, light: 0.2 }]] },
  persian: { rules: [['#f2dca0', '#f4c8b0', { hue: 8, light: 0.15 }]] },
  arcanine: { rules: [['#e88a3a', '#f0c040', { hue: 10, light: 0.25 }]] },
  gyarados: { rules: [['#3a7ac8', '#d83a3a', { hue: 25, light: 0.22 }]] },
  lapras: { rules: [['#58a0d8', '#9a78c8', { hue: 20 }]] },
  venusaur: { rules: [['#62b49a', '#78c08c', { hue: 18 }], ['#ec7092', '#f0a848', { hue: 6 }]] },
  raticate: { rules: [['#b88250', '#c8683c', { hue: 10, light: 0.25 }]] },
  pidgeotto: { rules: [['#a87444', '#c8a03c', { hue: 12, light: 0.25 }], ['#e8502e', '#f0b830', { hue: 10 }]] },
  pidgeot: { rules: [['#a87444', '#c8a03c', { hue: 12, light: 0.25 }], ['#e8502e', '#f0c040', { hue: 10 }]] },
  gloom: { rules: [['#4b5cb0', '#5aa060', { hue: 18 }], ['#e06a3a', '#eca838', { hue: 9, light: 0.3 }]] },

  magnemite: { rules: [['#bcd2de', '#e0d49c', { hue: 12, light: 0.3 }]] },
  magneton: { rules: [['#bcd2de', '#e0d49c', { hue: 12, light: 0.3 }]] },
  voltorb: { rules: [['#e03a30', '#4a78d8', { hue: 16, light: 0.3 }]] },
  electrode: { rules: [['#e03a30', '#4a78d8', { hue: 16, light: 0.3 }]] },
  staryu: { rules: [['#c88a4a', '#a4a88a', { hue: 10, light: 0.3 }], ['#e42c3c', '#3c78e0', { hue: 14, light: 0.35 }]] },
  starmie: { rules: [['#8a5cb8', '#5a7ed4', { hue: 20, light: 0.3 }], ['#e42c3c', '#3c78e0', { hue: 14, light: 0.35 }]] },

  mankey: { rules: [['#f3e3c6', '#e2e6ae', { hue: 10, light: 0.25 }]] },
  primeape: { rules: [['#f3e3c6', '#e2e6ae', { hue: 10, light: 0.25 }]] },
  hitmonlee: { rules: [['#b08a74', '#8ea04c', { hue: 10, light: 0.2 }]] },
  hitmonchan: { rules: [['#c4a47a', '#b4c454', { hue: 10, light: 0.25 }], ['#e05a4a', '#4a78d8', { hue: 14, light: 0.3 }]] },
  lickitung: { rules: [['#f0a0b4', '#e4dc6c', { hue: 12, light: 0.2 }]] },
  snorlax: { rules: [['#3a7686', '#284880', { hue: 20 }]] },

  slowpoke: { rules: [['#f0a0b8', '#dcb0e8', { hue: 25, light: 0.2 }]] },
  slowbro: { rules: [['#f0a0b8', '#c8a0e8', { hue: 25, light: 0.2 }]] },
  seel: { rules: [['#e6eef8', '#f2e2c8', { hue: 25, light: 0.15 }]] },
  dewgong: { rules: [['#e6eef8', '#f4ecd0', { hue: 25, light: 0.15 }]] },
  shellder: { rules: [['#9a7ad0', '#f08848', { hue: 25, light: 0.3 }]] },
  cloyster: { rules: [['#a8a0cc', '#6c90e0', { hue: 16, light: 0.18 }]] },

  zubat: { rules: [['#4a86d0', '#5cb04a', { hue: 18 }], ['#a868c0', '#e890b8', { hue: 16 }]] },
  golbat: { rules: [['#4a86d0', '#5cb04a', { hue: 18 }], ['#a868c0', '#e07898', { hue: 16 }]] },
  geodude: { rules: [['#a8a090', '#d8a040', { hue: 14 }]] },
  graveler: { rules: [['#a8a088', '#b87838', { hue: 14 }]] },
  golem: { rules: [['#868e72', '#9c8452', { light: 0.16 }], ['#b8a4ac', '#c8a07c', { light: 0.16 }]] },
  onix: { rules: [['#a8a2ae', '#a8b058', { light: 0.3 }]] },
  bellsprout: { rules: [['#78c050', '#d8c840', { hue: 14 }]] },
  weepinbell: { rules: [['#f2d83c', '#d8e048', { hue: 10 }]] },
  victreebel: { rules: [['#e2d23e', '#c8e050', { hue: 10 }], ['#78c050', '#b8a060', { hue: 14 }], ['#eca0a8', '#5878d8', { hue: 12 }]] },
  tentacool: { rules: [['#58aee6', '#b8a0e8', { hue: 14, light: 0.22 }], ['#d83040', '#40b868', { hue: 14 }]] },
  tentacruel: { rules: [['#58aee6', '#9890e0', { hue: 14, light: 0.22 }], ['#d83040', '#48a860', { hue: 14 }], ['#a8a89c', '#d8c898', { light: 0.2 }]] },
  grimer: { rules: [['#bc9ad6', '#88cc68', { hue: 20, light: 0.5 }]] },
  muk: { rules: [['#ae8ccc', '#78b858', { hue: 20, light: 0.5 }]] },

  gastly: { rules: [['#9a6ad0', '#6a9ce8', { hue: 25 }]] },
  haunter: { rules: [['#6a58a0', '#5060a8', { hue: 22, light: 0.3 }]] },
  gengar: { rules: [['#7058a8', '#9890b8', { hue: 22, light: 0.3 }]] },
  machop: { rules: [['#9cc4c4', '#c4bc84', { hue: 20 }]] },
  machoke: { rules: [['#a0a0d4', '#a8c088', { hue: 20 }]] },
  machamp: { rules: [['#98a8cc', '#a0b880', { hue: 20 }]] },

  eevee: { rules: [['#b8804a', '#c8c8d0', { hue: 14, light: 0.2 }]] },
  vaporeon: { rules: [['#58b0e0', '#a888d0', { hue: 12, light: 0.2 }], ['#2c5c9c', '#6a3c9c', { hue: 10, light: 0.2 }]] },
  jolteon: { rules: [['#ecbc30', '#c4dc4c', { hue: 14, light: 0.25 }]] },
  flareon: { rules: [['#ea6c30', '#f0b848', { hue: 12, light: 0.2 }]] },
  aerodactyl: { rules: [['#9888ac', '#b473b4', { light: 0.2 }], ['#b0acd4', '#dea4d5', { hue: 12, light: 0.2 }], ['#765498', '#1c30c8', { hue: 14, light: 0.3 }]] },

  abra: { rules: [['#f6d03c', '#f6dc7c', { hue: 12, light: 0.24 }], ['#5a4236', '#8a3a5a', { hue: 12, light: 0.2 }]] },
  kadabra: { rules: [['#f6d03c', '#f6dc7c', { hue: 12, light: 0.24 }], ['#5a4236', '#8a3a5a', { hue: 12, light: 0.2 }]] },
  alakazam: { rules: [['#f6d03c', '#f6dc7c', { hue: 12, light: 0.24 }], ['#5a4236', '#8a3a5a', { hue: 12, light: 0.2 }]] },
  drowzee: { rules: [['#f8d84a', '#f2aab8', { hue: 12, light: 0.3 }]] },
  hypno: { rules: [['#fae050', '#f4a6c4', { hue: 12, light: 0.3 }]] },
  jynx: { rules: [['#d8344a', '#f07cb4', { hue: 10, light: 0.2 }], ['#f4e08a', '#f4f0dc', { hue: 15, light: 0.3 }]] },

  dratini: { rules: [['#6aa8ee', '#e8a0c8', { hue: 16 }]] },
  dragonair: { rules: [['#6aa8ee', '#e090c0', { hue: 14 }]] },
  dragonite: { rules: [['#f09a3a', '#80b060', { hue: 9, light: 0.2 }], ['#f8e8b8', '#d8e8b0', { hue: 6, light: 0.15 }], ['#5cc4b0', '#c878b0', { hue: 15 }]] },
  goldeen: { rules: [['#f06a30', '#f4b830', { hue: 14, light: 0.25 }]] },
  seaking: { rules: [['#e8603c', '#f0b040', { hue: 12, light: 0.3 }]] },
  psyduck: { rules: [['#f8d048', '#88c8e8', { hue: 10, light: 0.16 }]] },
  golduck: { rules: [['#4c8ed8', '#70c0e0', { hue: 20 }]] },

  vulpix: { rules: [['#c0563a', '#e8b448', { hue: 9, light: 0.15 }]] },
  ninetales: { rules: [['#ecd08a', '#c8d4ec', { hue: 14, light: 0.2 }]] },
  ponyta: { rules: [['#ffc63a', '#5a8cf0', { hue: 20, light: 0.14 }], ['#e2481c', '#3a5ad0', { hue: 14, light: 0.2 }]] },
  rapidash: { rules: [['#ffc63a', '#9a9aae', { hue: 20, light: 0.14 }], ['#e2481c', '#4a4a60', { hue: 14, light: 0.2 }]] },
  rhyhorn: { rules: [['#9ca4b8', '#c89078', { hue: 20, light: 0.3 }]] },
  rhydon: { rules: [['#9ca4b8', '#d4c0a0', { hue: 20, light: 0.3 }]] },

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
  doduo: { rules: [['#bd8650', '#a8b050', { hue: 3 }]] },
  dodrio: { rules: [['#bd8650', '#a8b050', { hue: 3 }]] },
  farfetchd: { rules: [['#b08a6a', '#c88a88', { hue: 8, light: 0.3 }]] },
  // Đất: Sandshrew xanh ô liu, Sandslash da đỏ gạch; Diglett / Dugtrio màu hồng tím; Cubone / Marowak da xanh ô liu
  sandshrew: { rules: [['#d8a430', '#8cb848', { hue: 14, light: 0.3 }]] },
  sandslash: { rules: [['#9a6630', '#b83434', { hue: 7 }], ['#d8a430', '#dccc8c', { hue: 8 }]] },
  diglett: { rules: [['#8a5634', '#b8864e', { hue: 12 }], ['#e45c7c', '#7088e0', { hue: 12 }]] },
  dugtrio: { rules: [['#84502e', '#b8864e', { hue: 12 }], ['#e45c7c', '#7088e0', { hue: 12 }]] },
  cubone: { rules: [['#c08a52', '#a0a850', { hue: 10 }]] },
  marowak: { rules: [['#c08a52', '#8aa050', { hue: 10 }]] },
  // Họ Nidoran: cái xanh -> hồng tím, đực tím -> xanh dương; Nidoqueen xanh lá xám, Nidoking xanh dương
  'nidoran-f': { rules: [['#a4b0e6', '#d4a2d8', { hue: 20 }], ['#22707e', '#4c9a48', { hue: 12, light: 0.25 }]] },
  nidorina: { rules: [['#80b4d4', '#dca8d4', { hue: 16, light: 0.5 }], ['#2a4cb0', '#3c7a3c', { hue: 6, light: 0.25 }]] },
  nidoqueen: { rules: [['#4c84b8', '#7aa060', { hue: 15 }], ['#dccf94', '#f0b0b8', { hue: 10 }]] },
  'nidoran-m': { rules: [['#b46cc4', '#7aa0e0', { hue: 20 }], ['#1c9a84', '#a07040', { hue: 14 }]] },
  nidorino: { rules: [['#a462b8', '#6a8ad8', { hue: 20 }], ['#1c9a84', '#a07040', { hue: 14 }]] },
  nidoking: { rules: [['#9a5cae', '#4a80c8', { hue: 15 }], ['#22606e', '#a07040', { hue: 14 }]] },
  // Hồng: Clefairy hồng đào, Clefable hồng tím, Jigglypuff / Wigglytuff hồng cam nhạt, Chansey hồng kem
  clefairy: { rules: [['#f4a6ba', '#f6dce2', { hue: 15 }], ['#704020', '#58b040', { hue: 15 }]] },
  clefable: { rules: [['#ec98b2', '#f6e0e0', { hue: 15 }], ['#5a3420', '#58b040', { hue: 15 }]] },
  jigglypuff: { rules: [['#f0a4c2', '#eeb2dc', { hue: 15 }], ['#3a9cc4', '#3cb040', { hue: 15 }]] },
  wigglytuff: { rules: [['#ee9cbe', '#e6b0e0', { hue: 15 }], ['#2e9cb0', '#3cb040', { hue: 15 }]] },
  chansey: { rules: [['#f8c0d4', '#f4e6c8', { hue: 12, light: 0.25 }], ['#f08c8c', '#98cc60', { hue: 10, light: 0.25 }]] },
  // Nấm / cỏ: nấm Paras / Parasect vàng cam, Venonat / Venomoth xanh dương, Exeggcute trứng vàng, Exeggutor lá vàng,
  // Tangela dây leo xanh lá
  paras: { rules: [['#dc6c2a', '#e65a3a', { hue: 8 }]] },
  parasect: { rules: [['#e2502e', '#ec943a', { hue: 8 }], ['#d8662a', '#e2c040', { hue: 10 }]] },
  venonat: { rules: [['#8a5cb6', '#6a7ad8', { hue: 15 }], ['#e83a50', '#3a8ae8', { hue: 12 }]] },
  venomoth: { rules: [['#8a64b8', '#5a80d0', { hue: 15, light: 0.2 }], ['#c8aee2', '#a8cce8', { hue: 15, light: 0.2 }]] },
  exeggcute: { rules: [['#f8bcc6', '#f0b858', { hue: 15 }]] },
  exeggutor: { rules: [['#8ad460', '#c8704a', { hue: 18 }], ['#7e5c3e', '#a8a050', { hue: 12 }]] },
  tangela: { rules: [['#5a92cc', '#58b050', { hue: 18, light: 0.3 }]] },
  // Nước: Krabby xanh vàng, Kingler xanh lá; Horsea / Seadra tím; Omanyte / Omastar tím
  krabby: { rules: [['#ea6a3a', '#e8c448', { hue: 12, light: 0.3 }]] },
  kingler: { rules: [['#ea6a3a', '#78b048', { hue: 12, light: 0.3 }]] },
  horsea: { rules: [['#6cb6ec', '#4cc0a8', { hue: 15, light: 0.3 }], ['#ecd88c', '#f4a0b0', { hue: 12, light: 0.1 }]] },
  seadra: { rules: [['#4a8ad8', '#8a6ad0', { hue: 15, light: 0.3 }], ['#e8d48c', '#f08a9a', { hue: 12, light: 0.1 }]] },
  omanyte: { rules: [['#3c90d2', '#9a70d0', { hue: 15 }]] },
  omastar: { rules: [['#3c90d2', '#9a70d0', { hue: 15 }]] },
  // Kabuto / Kabutops mai xanh lá
  kabuto: { rules: [['#d89a58', '#88b048', { hue: 10 }]] },
  kabutops: { rules: [['#d89a58', '#b4dc3c', { hue: 10 }]] },
  // Kangaskhan / Tauros / Pinsir: nâu ngả ô liu / vàng / tím xám
  kangaskhan: { rules: [['#a8866a', '#9c9a7a', { hue: 10, light: 0.25 }], ['#5a5048', '#5a6848', { hue: 15, light: 0.15 }]] },
  tauros: { rules: [['#dca468', '#e8c450', { hue: 10 }], ['#7c6c62', '#7cb040', { hue: 20, light: 0.15 }]] },
  pinsir: { rules: [['#9a7250', '#8a78b0', { hue: 10 }]] },
  // Mr. Mime: các bóng tròn hồng -> xanh nhạt; Scyther xanh chanh; Electabuzz vàng cam; Magmar thân hồng (lửa giữ nguyên)
  'mr-mime': { rules: [['#f27c96', '#80c860', { hue: 10 }]] },
  scyther: { rules: [['#6ab84c', '#b8cc44', { hue: 18, light: 0.3 }]] },
  electabuzz: { rules: [['#f6cc34', '#f49a36', { hue: 12, light: 0.3 }]] },
  magmar: { rules: [['#d43626', '#e0608a', { hue: 8 }], ['#f0b81e', '#f8c4cc', { hue: 14 }]] },
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
