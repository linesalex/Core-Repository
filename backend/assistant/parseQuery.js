/**
 * Rules-based parser for the "Ask" chat assistant (route finding + promo pricing).
 *
 * No LLM/NLP model is used - the questions this app gets are structured
 * (city/PoP names, a bandwidth, an intent), so a regex/keyword parser is
 * sufficient and keeps behaviour fully deterministic and testable.
 *
 * This module only extracts raw text slots (source/destination tokens,
 * a bandwidth in Mbps, and an intent). Resolving the raw location text
 * against `location_reference` happens separately in `locationIndex.js`.
 */

// Longest-alternative-first so "gbps"/"mbps" aren't partially matched by "g"/"m".
const BANDWIDTH_RE = /(\d+(?:\.\d+)?)\s*(gbps|gbit\/s|gbit|gb|g|mbps|mbit\/s|mbit|mb|m)\b/i;
const DARK_FIBER_RE = /\bdark\s*fiber\b/i;

const BETWEEN_AND_RE = /\bbetween\s+(.+?)\s+and\s+(.+?)(?:[.?!]|$)/i;
const FROM_TO_RE = /\bfrom\s+(.+?)\s+to\s+(.+?)(?:[.?!]|$)/i;
const GENERIC_TO_RE = /^\s*(.+?)\s+(?:to|->|-->)\s+(.+?)\s*(?:[.?!]|$)/i;

// A route-pair signal (to/between/from/arrow) anywhere in the message takes
// priority over a "PoPs in <city>" style reading - e.g. "PoPs from Singapore
// to London" is a route question that happens to mention PoPs, not a lookup.
const ROUTE_SIGNAL_RE = /\b(?:to|between|from)\b|->|-->/i;

// "PoPs"/"locations" is treated as a keyword rather than a fixed phrase, so
// word order doesn't matter - "PoPs in London", "London PoPs", "what POPs
// are in London" and "show me the locations for Singapore" all match.
const LIST_POPS_KEYWORD_RE = /\b(?:pops?|locations?)\b/i;

// Stripped out of a list_pops message to find the leftover city/PoP text.
const LIST_POPS_STOPWORDS = new Set([
  'pop', 'pops', 'location', 'locations',
  'in', 'for', 'at', 'of', 'on',
  'the', 'a', 'an',
  'what', 'which', 'who',
  'is', 'are', 'do', 'does', 'can', 'could', 'would',
  'show', 'list', 'tell', 'give', 'please',
  'me', 'us', 'you',
  'available', 'located', 'active'
]);

const LOWEST_LATENCY_RE = /\b(lowest|fastest|min(?:imum)?)\b[\s\S]*\blatency\b|\blatency\b[\s\S]*\b(lowest|fastest|min(?:imum)?)\b/i;

// A one-off "tell me about the protected/diverse option" signal - not
// persisted as a slot, just changes what this single turn's reply focuses on.
const PROTECTED_RE = /\b(protect(?:ed|ion)?|diverse|diversity|secondary|redundan(?:t|cy)|backup)\b/i;

// Trailing connector words that can end up dangling on a captured location
// token once the bandwidth phrase elsewhere in the sentence is stripped out
// (e.g. "IPCSNG1 to IPCLON7 at 1Gb" -> "...IPCLON7 at" once "1Gb" is removed).
const TRAILING_FILLER_RE = /\s+(?:at|for|of|please|now|today)$/i;

function trimFillerWords(value) {
  let cleaned = value.trim();
  let previous;
  do {
    previous = cleaned;
    cleaned = cleaned.replace(TRAILING_FILLER_RE, '').trim();
  } while (cleaned !== previous);
  return cleaned;
}

/**
 * Extracts a bandwidth in Mbps from free text, if present.
 * Returns { bandwidthMbps, matchedText } or null.
 */
function extractBandwidth(text) {
  if (DARK_FIBER_RE.test(text)) {
    const match = text.match(DARK_FIBER_RE);
    return { bandwidthMbps: 200000, matchedText: match[0] };
  }

  const match = text.match(BANDWIDTH_RE);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const isGigabit = unit.startsWith('g');
  const bandwidthMbps = isGigabit ? value * 1000 : value;

  return { bandwidthMbps, matchedText: match[0] };
}

/**
 * Extracts a source/destination location pair from free text.
 * Tried in order of explicitness so "between X and Y" (most common in
 * natural phrasing) wins over the more permissive generic "X to Y".
 * Returns { source, destination } (raw text, untrimmed of case) or null.
 */
function extractEndpointPair(text) {
  let match = text.match(BETWEEN_AND_RE);
  if (match) return { source: trimFillerWords(match[1]), destination: trimFillerWords(match[2]) };

  match = text.match(FROM_TO_RE);
  if (match) return { source: trimFillerWords(match[1]), destination: trimFillerWords(match[2]) };

  match = text.match(GENERIC_TO_RE);
  if (match) return { source: trimFillerWords(match[1]), destination: trimFillerWords(match[2]) };

  return null;
}

/**
 * Extracts a single location mention for "PoPs in <city>" style questions,
 * in any word order. Returns:
 *   null - this isn't a list_pops-style question at all
 *   ''   - it is (a pop/location keyword is present), but no location text
 *          was left over after removing the keyword/filler words, so the
 *          caller should ask which city/PoP was meant
 *   '<location text>' - the leftover words, e.g. "London"
 */
function extractSingleLocation(text) {
  if (!LIST_POPS_KEYWORD_RE.test(text)) return null;
  if (ROUTE_SIGNAL_RE.test(text)) return null;

  const words = text.replace(/[.?!]/g, ' ').split(/\s+/).filter(Boolean);
  const remaining = words.filter(w => !LIST_POPS_STOPWORDS.has(w.toLowerCase()));
  return remaining.join(' ');
}

/**
 * Parses a chat message into slots.
 *
 * @param {string} message - the raw user message
 * @returns {{
 *   intent: 'list_pops' | 'lowest_latency' | 'find_route',
 *   source: string|null,
 *   destination: string|null,
 *   singleLocation: string|null,
 *   bandwidthMbps: number|null,
 *   wantsProtected: boolean
 * }}
 */
function parseQuery(message) {
  const text = String(message || '').trim();
  const wantsProtected = PROTECTED_RE.test(text);

  const bandwidthResult = extractBandwidth(text);
  const bandwidthMbps = bandwidthResult ? bandwidthResult.bandwidthMbps : null;

  // Strip the matched bandwidth phrase before endpoint extraction so
  // "10Gb Frankfurt to New York" doesn't capture "10Gb Frankfurt" as one token.
  const textWithoutBandwidth = bandwidthResult
    ? text.replace(bandwidthResult.matchedText, ' ').trim()
    : text;

  const singleLocation = extractSingleLocation(text);
  if (singleLocation !== null) {
    return {
      intent: 'list_pops',
      source: null,
      destination: null,
      singleLocation: singleLocation || null,
      bandwidthMbps,
      wantsProtected
    };
  }

  const pair = extractEndpointPair(textWithoutBandwidth);
  const intent = LOWEST_LATENCY_RE.test(text) ? 'lowest_latency' : 'find_route';

  return {
    intent,
    source: pair ? pair.source : null,
    destination: pair ? pair.destination : null,
    singleLocation: null,
    bandwidthMbps,
    wantsProtected
  };
}

/** Whether the message contains a route-pair signal word ("to"/"between"/"from"/arrow). */
function hasRouteSignal(text) {
  return ROUTE_SIGNAL_RE.test(String(text || ''));
}

module.exports = {
  parseQuery,
  extractBandwidth,
  extractEndpointPair,
  extractSingleLocation,
  hasRouteSignal
};
