import DEX from './pokedex.json' with { type: 'json' };

// 151 Pokémon thế hệ 1, nhập từ pokemondb.net bằng scripts/import-pokedex.mjs
export { DEX };
export const DEX_BY_SLUG = Object.fromEntries(DEX.map((p) => [p.slug, p]));

export const dexNo = (id) => String(id).padStart(3, '0');
