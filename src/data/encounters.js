// Bảng Pokémon hoang dã theo từng loại bụi cỏ
export const ENCOUNTERS = {
  meadow: [
    { species: 'rattata', min: 2, max: 4, weight: 40 },
    { species: 'pidgey', min: 2, max: 4, weight: 35 },
    { species: 'oddish', min: 3, max: 5, weight: 15 },
    { species: 'poliwag', min: 3, max: 5, weight: 10 },
  ],
  deep: [
    { species: 'pidgey', min: 4, max: 7, weight: 25 },
    { species: 'pikachu', min: 5, max: 7, weight: 15 },
    { species: 'oddish', min: 5, max: 7, weight: 20 },
    { species: 'poliwag', min: 5, max: 7, weight: 25 },
    { species: 'growlithe', min: 6, max: 8, weight: 15 },
  ],
};

export function rollEncounter(zone, rng = Math.random) {
  const table = ENCOUNTERS[zone];
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  const entry = table.find((e) => (roll -= e.weight) < 0) ?? table[table.length - 1];
  const level = entry.min + Math.floor(rng() * (entry.max - entry.min + 1));
  return { speciesId: entry.species, level };
}
