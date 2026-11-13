// Pokémon đi theo người chơi: kiểu di chuyển và tiếng kêu.
// Kiểu di chuyển (WorldScene.animateFollower):
//  'walk'  (mặc định) bước mượt, hơi lắc lư theo nhịp bước
//  'hop'   không có chân (cá, nòng nọc, sao biển, vỏ sò, đá...): nhảy từng bước
//  'fly'   có cánh: bay cao hơn mặt đất, vỗ cánh liên tục, bóng dưới đất nhỏ và mờ
//  'float' lơ lửng không cánh (ma, khí độc, nam châm): bồng bềnh chậm
const STYLES = {
  fly: [
    'pidgey', 'pidgeotto', 'pidgeot', 'zubat', 'golbat', 'charizard', 'aerodactyl', 'dragonite',
    'butterfree', 'beedrill', 'venomoth', 'spearow', 'fearow', 'farfetchd', 'scyther', 'articuno', 'zapdos', 'moltres',
  ],
  float: ['gastly', 'haunter', 'koffing', 'weezing', 'magnemite', 'magneton', 'mew', 'mewtwo', 'porygon'],
  hop: [
    'magikarp', 'goldeen', 'seaking', 'poliwag', 'shellder', 'cloyster', 'staryu', 'starmie', 'tentacool', 'tentacruel',
    'geodude', 'graveler', 'voltorb', 'electrode', 'seel', 'dewgong', 'lapras',
    'metapod', 'kakuna', 'horsea', 'seadra', 'krabby', 'kingler', 'omanyte', 'omastar', 'kabuto', 'ditto', 'exeggcute',
    'diglett', 'dugtrio', 'jigglypuff',
  ],
};

const BY_SPECIES = Object.fromEntries(Object.entries(STYLES).flatMap(([style, ids]) => ids.map((id) => [id, style])));

export const followStyle = (speciesId) => BY_SPECIES[speciesId] ?? 'walk';
export const FOLLOW_STYLE_SPECIES = BY_SPECIES;

// Tiếng kêu khi nói chuyện với Pokémon đi theo. Loài không ghi ở đây thì kêu theo tên: âm đầu lặp lại hoặc cả tên
export const CRIES = {
  pikachu: ['Pika pika!', 'Pikachu!', 'Pi-ka!'],
  raichu: ['Rai rai!', 'Raichu!'],
  charmander: ['Char char!', 'Charmander!'],
  squirtle: ['Squirtle squirtle!', 'Squirt!'],
  bulbasaur: ['Bulba!', 'Bulbasaur!'],
  meowth: ['Meo meo!', 'Meowth!'],
  psyduck: ['Psy...?', 'Psyyy...'],
  eevee: ['Vee!', 'Ee-vee!'],
  snorlax: ['Khò... khò...', 'Snorlaaax...'],
  magikarp: ['Karp! Karp!', '*Đớp đớp*'],
  gastly: ['Gaaas...', 'Hehehe...'],
  haunter: ['Haunter...', 'Hehehe...'],
  gengar: ['Gengar!', 'Hehehe!'],
  voltorb: ['Bzzt!', 'Volt!'],
  electrode: ['Bzzzt!', 'Electrode!'],
  magnemite: ['Bzzz... bíp!', 'Magne!'],
  magneton: ['Bzzz... bíp bíp!', 'Magneton!'],
  koffing: ['Koff... koff...', 'Koffing!'],
  weezing: ['Weeez...', 'Weezing!'],
  slowpoke: ['Slooow...?', '...Poke?'],
  lapras: ['Laaa~', 'Lapras!'],
};

const syllable = (name) => /^[^aeiouy]*[aeiouy]+[^aeiouy]?/i.exec(name)?.[0] ?? name;

export function followerCry(speciesId, name, rng = Math.random) {
  const syl = syllable(name);
  const cries = CRIES[speciesId] ?? [`${syl} ${syl.toLowerCase()}!`, `${name}!`, `${syl}-${syl.toLowerCase()}!`];
  return cries[Math.floor(rng() * cries.length)];
}
