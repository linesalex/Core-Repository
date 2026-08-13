/**
 * Resolves a POP's city/country (as entered in Manage Locations) to an
 * approximate lat/long, so the Network Map export can lay locations out
 * geographically instead of with pure force-directed physics.
 *
 * `location_reference.latitude`/`longitude` exist in the schema for a future
 * manual-entry UI, but are not currently populated for any real location -
 * so the primary path here is an offline city lookup (`all-the-cities`,
 * already a backend dependency used for KMZ transit-city detection) keyed on
 * city + country. Manual lat/long is still honored first when present, so
 * populating it later automatically takes priority with no code changes.
 */

// ISO 3166-1 alpha-2 codes, keyed by every lower-cased spelling of a country
// name we're likely to see typed into Manage Locations. `all-the-cities`
// tags every entry with an alpha-2 code, so country matching disambiguates
// same-named cities (e.g. London, GB vs London, ON, Canada).
const COUNTRY_TO_ALPHA2 = {
  afghanistan: 'AF', albania: 'AL', algeria: 'DZ', angola: 'AO', argentina: 'AR',
  armenia: 'AM', australia: 'AU', austria: 'AT', azerbaijan: 'AZ', bahrain: 'BH',
  bangladesh: 'BD', belarus: 'BY', belgium: 'BE', 'bosnia and herzegovina': 'BA',
  brazil: 'BR', brunei: 'BN', bulgaria: 'BG', cambodia: 'KH', cameroon: 'CM',
  canada: 'CA', chile: 'CL', china: 'CN', colombia: 'CO', 'dr congo': 'CD',
  'democratic republic of the congo': 'CD', croatia: 'HR', cuba: 'CU', cyprus: 'CY',
  'czech republic': 'CZ', czechia: 'CZ', denmark: 'DK', djibouti: 'DJ', ecuador: 'EC',
  egypt: 'EG', estonia: 'EE', ethiopia: 'ET', finland: 'FI', france: 'FR', gabon: 'GA',
  georgia: 'GE', germany: 'DE', ghana: 'GH', greece: 'GR', guatemala: 'GT', guinea: 'GN',
  'hong kong': 'HK', hungary: 'HU', iceland: 'IS', india: 'IN', indonesia: 'ID',
  iran: 'IR', iraq: 'IQ', ireland: 'IE', israel: 'IL', italy: 'IT', japan: 'JP',
  jordan: 'JO', kazakhstan: 'KZ', kenya: 'KE', kuwait: 'KW', kyrgyzstan: 'KG',
  laos: 'LA', latvia: 'LV', lebanon: 'LB', libya: 'LY', lithuania: 'LT',
  luxembourg: 'LU', malaysia: 'MY', mali: 'ML', malta: 'MT', mauritania: 'MR',
  mexico: 'MX', moldova: 'MD', mongolia: 'MN', montenegro: 'ME', morocco: 'MA',
  mozambique: 'MZ', myanmar: 'MM', namibia: 'NA', nepal: 'NP', netherlands: 'NL',
  'new zealand': 'NZ', nigeria: 'NG', norway: 'NO', oman: 'OM', pakistan: 'PK',
  panama: 'PA', paraguay: 'PY', peru: 'PE', philippines: 'PH', poland: 'PL',
  portugal: 'PT', qatar: 'QA', romania: 'RO', russia: 'RU', 'saudi arabia': 'SA',
  senegal: 'SN', serbia: 'RS', singapore: 'SG', slovakia: 'SK', slovenia: 'SI',
  somalia: 'SO', 'south africa': 'ZA', 'south korea': 'KR', korea: 'KR', spain: 'ES',
  'sri lanka': 'LK', sudan: 'SD', sweden: 'SE', switzerland: 'CH', syria: 'SY',
  taiwan: 'TW', tajikistan: 'TJ', tanzania: 'TZ', thailand: 'TH', tunisia: 'TN',
  turkey: 'TR', turkmenistan: 'TM', uganda: 'UG', ukraine: 'UA',
  uae: 'AE', 'united arab emirates': 'AE',
  'united kingdom': 'GB', uk: 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  'northern ireland': 'GB', 'great britain': 'GB', britain: 'GB',
  'united states': 'US', 'united states of america': 'US', usa: 'US', us: 'US',
  uruguay: 'UY', uzbekistan: 'UZ', venezuela: 'VE', vietnam: 'VN', yemen: 'YE',
  zambia: 'ZM', zimbabwe: 'ZW', 'south sudan': 'SS', palestine: 'PS',
  'north macedonia': 'MK', kosovo: 'XK', eswatini: 'SZ', 'timor-leste': 'TL',
  'costa rica': 'CR', 'dominican republic': 'DO', 'el salvador': 'SV',
  honduras: 'HN', nicaragua: 'NI', bolivia: 'BO', guyana: 'GY', suriname: 'SR',
  'ivory coast': 'CI', jamaica: 'JM', haiti: 'HT', 'trinidad and tobago': 'TT',
  macau: 'MO', 'puerto rico': 'PR',
};

// Common shorthand/alternate/English-exonym city spellings that don't
// exactly match `all-the-cities`' canonical (often local-language) name,
// even after accent stripping.
const CITY_NAME_ALIASES = {
  nyc: 'new york city',
  'new york': 'new york city',
  'washington dc': 'washington',
  'washington, d.c.': 'washington',
  'washington d.c.': 'washington',
  frankfurt: 'frankfurt am main',
  cologne: 'koln',
  seville: 'sevilla',
  hague: 'the hague',
  bangalore: 'bengaluru',
};

// Strips accents/diacritics and lower-cases so "Sao Paulo" (as typed into
// Manage Locations) matches the accented canonical "São Paulo" entry in
// `all-the-cities` without needing an explicit alias for every accented city.
function normalizeCityKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

let cityIndex = null;

function buildIndex() {
  if (cityIndex) return cityIndex;
  const allCities = require('all-the-cities');
  const byName = new Map();
  allCities.forEach((c) => {
    const key = normalizeCityKey(c.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push({
      name: c.name,
      country: c.country,
      lat: c.loc.coordinates[1],
      lon: c.loc.coordinates[0],
      population: c.population || 0,
    });
  });
  cityIndex = byName;
  return cityIndex;
}

function normalizeCountryToAlpha2(country) {
  if (!country) return null;
  const trimmed = String(country).trim();
  if (!trimmed) return null;
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return COUNTRY_TO_ALPHA2[trimmed.toLowerCase()] || null;
}

const resolutionCache = new Map();

/**
 * Looks up a city (optionally disambiguated by country) in the offline
 * world-cities database. Falls back to the highest-population same-named
 * city worldwide if the supplied country doesn't match any candidate -
 * handles cases like a POP's country being recorded as "China" for a
 * "Hong Kong" city entry that `all-the-cities` files under its own HK code.
 */
function resolveCityCoordinates(city, country) {
  if (!city || !String(city).trim()) return null;

  const cacheKey = `${city}|${country || ''}`.toLowerCase();
  if (resolutionCache.has(cacheKey)) return resolutionCache.get(cacheKey);

  const index = buildIndex();
  const rawKey = normalizeCityKey(city);
  const normalizedCity = CITY_NAME_ALIASES[rawKey] || rawKey;
  const candidates = index.get(normalizedCity) || [];

  let result = null;
  if (candidates.length > 0) {
    const alpha2 = normalizeCountryToAlpha2(country);
    const countryMatches = alpha2 ? candidates.filter((c) => c.country === alpha2) : [];
    const pool = countryMatches.length > 0 ? countryMatches : candidates;
    result = pool.reduce((best, c) => (!best || c.population > best.population ? c : best), null);
  }

  resolutionCache.set(cacheKey, result);
  return result;
}

/**
 * Resolves a single export node (as built in the `/network_routes_export_map`
 * endpoint) to {lat, lon, resolved, source}. Never throws - callers should
 * treat `resolved: false` as "place this node with a sensible geographic
 * fallback" rather than as an error.
 */
function resolveNodeCoordinate(node) {
  const explicitLat = Number(node.latitude);
  const explicitLon = Number(node.longitude);
  if (
    Number.isFinite(explicitLat) && Number.isFinite(explicitLon)
    && (explicitLat !== 0 || explicitLon !== 0)
  ) {
    return { lat: explicitLat, lon: explicitLon, resolved: true, source: 'manual' };
  }

  const match = resolveCityCoordinates(node.city, node.country);
  if (match) {
    return { lat: match.lat, lon: match.lon, resolved: true, source: 'city-lookup' };
  }

  return { lat: null, lon: null, resolved: false, source: 'none' };
}

module.exports = {
  resolveNodeCoordinate,
  resolveCityCoordinates,
};
