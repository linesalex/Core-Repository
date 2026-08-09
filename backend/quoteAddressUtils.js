/**
 * Address normalization and fuzzy matching for Carrier Quote locations.
 * Used by match/verify APIs and unit tests.
 */

const crypto = require('crypto');
const axios = require('axios');

const ABBREVIATIONS = [
  [/\bstreet\b/g, 'st'],
  [/\bstr\b/g, 'st'],
  [/\broad\b/g, 'rd'],
  [/\bavenue\b/g, 'ave'],
  [/\bboulevard\b/g, 'blvd'],
  [/\bdrive\b/g, 'dr'],
  [/\blane\b/g, 'ln'],
  [/\bcourt\b/g, 'ct'],
  [/\bplace\b/g, 'pl'],
  [/\bbuilding\b/g, 'bldg'],
  [/\bsuite\b/g, 'ste'],
  [/\bapartment\b/g, 'apt'],
  [/\bfloor\b/g, 'fl'],
  [/\bnumber\b/g, 'no'],
];

function normalizeText(text) {
  if (text === null || text === undefined) return '';
  let s = String(text).toLowerCase().trim();
  s = s.replace(/[^\w\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  for (const [pattern, repl] of ABBREVIATIONS) {
    s = s.replace(pattern, repl);
  }
  return s.replace(/\s+/g, ' ').trim();
}

function buildCompositeAddress({ street_number, street_name, address, city, postal_code, country }) {
  const parts = [];
  if (street_number || street_name) {
    parts.push([street_number, street_name].filter(Boolean).join(' '));
  } else if (address) {
    parts.push(address);
  }
  if (city) parts.push(city);
  if (postal_code) parts.push(postal_code);
  if (country) parts.push(country);
  return parts.filter(Boolean).join(', ');
}

function normalizeComposite(fields) {
  return normalizeText(buildCompositeAddress(fields || {}));
}

function tokenize(normalized) {
  return (normalized || '').split(/\s+/).filter(Boolean);
}

function levenshtein(a, b) {
  const s = a || '';
  const t = b || '';
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const prev = new Array(t.length + 1);
  const curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j];
  }
  return prev[t.length];
}

function jaccardSimilarity(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter++;
  }
  return inter / (a.size + b.size - inter);
}

/**
 * Score 0..1 how similar two address field sets are.
 */
function scoreAddressMatch(input, candidate) {
  const inputComp = normalizeComposite(input);
  const candComp = normalizeComposite(candidate);
  if (!inputComp && !candComp) return 0;

  const nameA = normalizeText(input.location_name || input.name || '');
  const nameB = normalizeText(candidate.location_name || candidate.name || candidate.datacenter_name || '');

  const tokenScore = jaccardSimilarity(tokenize(inputComp), tokenize(candComp));
  const maxLen = Math.max(inputComp.length, candComp.length, 1);
  const levScore = 1 - Math.min(1, levenshtein(inputComp, candComp) / maxLen);

  let nameScore = 0;
  if (nameA && nameB) {
    if (nameA === nameB) nameScore = 1;
    else if (nameA.includes(nameB) || nameB.includes(nameA)) nameScore = 0.85;
    else nameScore = jaccardSimilarity(tokenize(nameA), tokenize(nameB));
  }

  const cityA = normalizeText(input.city || '');
  const cityB = normalizeText(candidate.city || '');
  const cityBonus = cityA && cityB && cityA === cityB ? 0.1 : 0;

  const countryA = normalizeText(input.country || '');
  const countryB = normalizeText(candidate.country || '');
  const countryBonus = countryA && countryB && countryA === countryB ? 0.05 : 0;

  const base = 0.45 * tokenScore + 0.35 * levScore + 0.2 * nameScore;
  return Math.min(1, base + cityBonus + countryBonus);
}

function hashQuery(type, payload) {
  const raw = JSON.stringify({ type, payload });
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function parseNominatimResult(item) {
  const addr = (item && item.address) || {};
  const street_name = addr.road || addr.pedestrian || addr.footway || addr.path || addr.residential || '';
  const street_number = addr.house_number || '';
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '';
  const postal_code = addr.postcode || '';
  const country = addr.country_code ? String(addr.country_code).toUpperCase() : (addr.country || '');
  const address = buildCompositeAddress({
    street_number,
    street_name,
    city,
    postal_code,
    country
  }) || item.display_name || '';

  return {
    display_name: item.display_name || address,
    street_name,
    street_number,
    city,
    postal_code,
    country,
    address,
    latitude: item.lat != null ? parseFloat(item.lat) : null,
    longitude: item.lon != null ? parseFloat(item.lon) : null
  };
}

const NOMINATIM_USER_AGENT = 'Core-Repository-CarrierQuotes/3.5.0 (internal address verification)';
let lastNominatimAt = 0;

async function throttleNominatim() {
  const now = Date.now();
  const wait = 1100 - (now - lastNominatimAt);
  if (wait > 0) {
    await new Promise(r => setTimeout(r, wait));
  }
  lastNominatimAt = Date.now();
}

/**
 * Forward geocode via Nominatim. Caller supplies cache get/set callbacks.
 * getCache(hash) -> Promise<parsed|null>, setCache(hash, type, request, response) -> Promise
 */
async function nominatimForward(fields, { getCache, setCache } = {}) {
  const street = [fields.street_number, fields.street_name].filter(Boolean).join(' ')
    || fields.address
    || '';
  const payload = {
    street: street || undefined,
    city: fields.city || undefined,
    postalcode: fields.postal_code || undefined,
    country: fields.country || undefined,
    q: (!street && !fields.city) ? (fields.location_name || fields.address || '') : undefined
  };
  const queryHash = hashQuery('forward', payload);

  if (getCache) {
    const cached = await getCache(queryHash);
    if (cached) return { ...cached, from_cache: true };
  }

  await throttleNominatim();

  const params = {
    format: 'json',
    addressdetails: 1,
    limit: 5
  };
  if (payload.street) params.street = payload.street;
  if (payload.city) params.city = payload.city;
  if (payload.postalcode) params.postalcode = payload.postalcode;
  if (payload.country) params.country = payload.country;
  if (payload.q && !payload.street) params.q = payload.q;

  let response;
  try {
    response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params,
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept-Language': 'en'
      },
      timeout: 15000
    });
  } catch (err) {
    return { error: err.message || 'Nominatim request failed', results: [] };
  }

  const results = (response.data || []).map(parseNominatimResult);
  const out = { results, from_cache: false };
  if (setCache && results.length > 0) {
    await setCache(queryHash, 'forward', payload, out);
  }
  return out;
}

async function nominatimReverse(lat, lon, { getCache, setCache } = {}) {
  const payload = { lat: Number(lat), lon: Number(lon) };
  const queryHash = hashQuery('reverse', payload);

  if (getCache) {
    const cached = await getCache(queryHash);
    if (cached) return { ...cached, from_cache: true };
  }

  await throttleNominatim();

  let response;
  try {
    response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'json',
        addressdetails: 1,
        lat: payload.lat,
        lon: payload.lon
      },
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept-Language': 'en'
      },
      timeout: 15000
    });
  } catch (err) {
    return { error: err.message || 'Nominatim reverse failed', result: null };
  }

  const result = response.data && !response.data.error
    ? parseNominatimResult(response.data)
    : null;
  const out = { result, from_cache: false };
  if (setCache && result) {
    await setCache(queryHash, 'reverse', payload, out);
  }
  return out;
}

function rankMatches(input, candidates, { minScore = 0.45, limit = 10 } = {}) {
  return (candidates || [])
    .map(c => ({
      ...c,
      match_score: scoreAddressMatch(input, c)
    }))
    .filter(c => c.match_score >= minScore)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);
}

module.exports = {
  normalizeText,
  buildCompositeAddress,
  normalizeComposite,
  tokenize,
  levenshtein,
  jaccardSimilarity,
  scoreAddressMatch,
  rankMatches,
  hashQuery,
  parseNominatimResult,
  nominatimForward,
  nominatimReverse,
  NOMINATIM_USER_AGENT
};
