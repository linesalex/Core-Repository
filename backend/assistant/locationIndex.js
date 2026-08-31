/**
 * Location/PoP resolver for the "Ask" chat assistant.
 *
 * Resolves free-text location mentions (a PoP code, a city name, a
 * shorthand alias, or a 3-letter city code embedded in a PoP code) against
 * `location_reference`, the same table every other module (Route Finder,
 * Cross Connects, Carrier Quotes, Colocation) keys off.
 *
 * Only Active locations are considered - a decommissioned/under-construction
 * PoP should never be offered as a search endpoint.
 */

const db = require('../db');

// Small shorthand/alias map for the handful of cities reps are most likely
// to abbreviate. Not exhaustive by design - anything not listed here still
// resolves via exact city name or the embedded 3-letter PoP city code.
const CITY_ALIASES = {
  sg: 'singapore',
  sng: 'singapore',
  sin: 'singapore',
  lon: 'london',
  ldn: 'london',
  nyc: 'new york',
  ny: 'new york',
  hk: 'hong kong',
  ffm: 'frankfurt',
  fra: 'frankfurt'
};

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Mirrors the `extractCityCode` helper already used in routes.js
// (e.g. "IPCSNG1" -> "SNG") so "SNG to LON" style shorthand also resolves.
function extractCityCode(locationCode) {
  if (!locationCode || locationCode.length < 6) return null;
  return locationCode.substring(3, 6).toUpperCase();
}

function loadActiveLocations() {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT location_code, city, country, datacenter_name, status, region FROM location_reference WHERE status = 'Active' ORDER BY location_code",
      [],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

function buildIndex(locations) {
  const byCode = new Map();
  const byCity = new Map();
  const byCityCode = new Map();

  locations.forEach(loc => {
    byCode.set(loc.location_code.toUpperCase(), loc);

    const cityKey = normalizeKey(loc.city);
    if (!byCity.has(cityKey)) byCity.set(cityKey, []);
    byCity.get(cityKey).push(loc);

    const cityCode = extractCityCode(loc.location_code);
    if (cityCode) {
      if (!byCityCode.has(cityCode)) byCityCode.set(cityCode, []);
      byCityCode.get(cityCode).push(loc);
    }
  });

  return { byCode, byCity, byCityCode };
}

function toPopOption(loc) {
  return {
    code: loc.location_code,
    label: `${loc.location_code} — ${loc.datacenter_name || loc.city}`,
    city: loc.city,
    datacenterName: loc.datacenter_name || null
  };
}

/**
 * Resolves a single raw text token (as typed by the user) to a location
 * match. Match order: exact PoP code, exact city name, alias, then the
 * 3-letter city code embedded in PoP codes.
 *
 * @returns one of:
 *   { matched: false, token }
 *   { matched: true, kind: 'pop', code, label, city, datacenterName }
 *   { matched: true, kind: 'city', city, pops: [{ code, label, city, datacenterName }] }
 *
 * A city resolving to exactly one Active PoP collapses to kind: 'pop' so
 * callers never have to special-case a "city of one" - only a genuinely
 * ambiguous city (2+ PoPs) is reported as kind: 'city'.
 */
function resolveToken(token, index) {
  const raw = String(token || '').trim();
  if (!raw) return { matched: false, token: raw };

  const upper = raw.toUpperCase();
  if (index.byCode.has(upper)) {
    return { matched: true, kind: 'pop', ...toPopOption(index.byCode.get(upper)) };
  }

  const cityKey = normalizeKey(raw);
  let cityMatches = index.byCity.get(cityKey);

  if (!cityMatches) {
    const aliasCity = CITY_ALIASES[cityKey];
    if (aliasCity) cityMatches = index.byCity.get(normalizeKey(aliasCity));
  }

  if (!cityMatches && raw.length === 3) {
    cityMatches = index.byCityCode.get(upper);
  }

  if (cityMatches && cityMatches.length > 0) {
    if (cityMatches.length === 1) {
      return { matched: true, kind: 'pop', ...toPopOption(cityMatches[0]) };
    }
    return {
      matched: true,
      kind: 'city',
      city: cityMatches[0].city,
      pops: cityMatches.map(toPopOption)
    };
  }

  return { matched: false, token: raw };
}

async function buildResolver() {
  const locations = await loadActiveLocations();
  const index = buildIndex(locations);
  return {
    resolve: (token) => resolveToken(token, index),
    /** Resolve a PoP code directly, bypassing city/alias matching. */
    resolvePopCode: (code) => {
      const loc = index.byCode.get(String(code || '').toUpperCase());
      return loc ? toPopOption(loc) : null;
    }
  };
}

module.exports = {
  buildResolver,
  loadActiveLocations,
  buildIndex,
  resolveToken,
  extractCityCode,
  normalizeKey,
  CITY_ALIASES
};
