/**
 * Promo pricing integration for the "Ask" chat assistant.
 *
 * Rather than re-implementing the margin/currency-conversion logic behind
 * `/route_finder/check-promo-match` and `/route_finder/calculate-protected-promo`
 * (backend/routes.js, ~19466 and ~19745 - allocated cost, per-tier margin
 * validation, exchange rate conversion), this calls those endpoints directly
 * over an in-process HTTP loopback. That guarantees the chat's promo answer
 * is always identical to what Route Finder itself would show for the same
 * route, and keeps `routes.js` completely untouched.
 */

const axios = require('axios');

const PORT = process.env.PORT || 4000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Mirrors the tier selection in check-promo-match (routes.js ~19636).
function tierKeyForBandwidth(bandwidthMbps) {
  const mbps = parseFloat(bandwidthMbps) || 10;
  if (mbps < 100) return 'price_10mb';
  if (mbps < 1000) return 'price_100mb';
  if (mbps < 3000) return 'price_1000mb';
  return 'price_10gb';
}

const TIER_LABELS = {
  price_10mb: 'under 100 Mbps',
  price_100mb: '100-999 Mbps',
  price_1000mb: '1000-2999 Mbps',
  price_10gb: '3000 Mbps and above'
};

// Friendly text for check-promo-match's `reason` field when valid: false.
const PROMO_REASON_MESSAGES = {
  route_mismatch: "a promo rule exists for this pair, but this specific path doesn't include the circuits the rule requires (or includes one it excludes)",
  no_price_configured: 'a promo rule matches, but no price is configured for this bandwidth tier',
  margin_not_met: "a promo rule matches, but the price for this bandwidth tier doesn't meet the minimum margin requirement"
};

function formatUsd(amount) {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(amount));
}

/**
 * Calls check-promo-match for one path (primary or secondary) and reduces
 * the response down to a single summary for the requested bandwidth tier.
 */
async function checkPromoForPath({ token, source, destination, bandwidthMbps, circuitIds }) {
  try {
    const res = await axios.post(
      `${BASE_URL}/route_finder/check-promo-match`,
      {
        source,
        destination,
        bandwidth: bandwidthMbps,
        primary_circuit_ids: circuitIds,
        secondary_circuit_ids: []
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );

    const data = res.data;
    const tierKey = tierKeyForBandwidth(bandwidthMbps);

    if (!data.hasPromo) {
      return { status: 'no_rule', tierKey, priceUsd: null, message: 'No promo pricing rule exists for this route pair.' };
    }

    if (!data.valid) {
      const reasonText = PROMO_REASON_MESSAGES[data.reason] || 'a promo rule was found, but pricing could not be validated for this route';
      return { status: 'declined', tierKey, priceUsd: null, reason: data.reason || null, message: `Promo pricing does not apply here — ${reasonText}.` };
    }

    const tierPrice = data.prices ? data.prices[tierKey] : null;
    if (tierPrice === null || tierPrice === undefined) {
      return {
        status: 'declined',
        tierKey,
        priceUsd: null,
        reason: 'margin_not_met',
        message: `A promo rule matches this route, but the ${TIER_LABELS[tierKey]} tier doesn't meet the minimum margin requirement.`
      };
    }

    return {
      status: 'matched',
      tierKey,
      priceUsd: tierPrice,
      prices: data.prices,
      protectionPricingPercent: data.protectionPricingPercent || null,
      message: `Promo pricing applies: ${formatUsd(tierPrice)}/month (USD) for ${TIER_LABELS[tierKey]}.`
    };
  } catch (err) {
    return { status: 'error', tierKey: tierKeyForBandwidth(bandwidthMbps), priceUsd: null, message: 'Could not check promo pricing for this route right now.' };
  }
}

/**
 * Calls calculate-protected-promo. Only meaningful when the primary path's
 * matched promo rule has an optional "Protection Pricing %" configured - the
 * secondary/diverse path doesn't need its own promo match, it's only used as
 * the protection route for the margin check on the increment. Reduces the
 * response to a single summary for the requested bandwidth tier.
 */
async function checkProtectedPromo({ token, source, destination, bandwidthMbps, secondaryCircuitIds, primaryPrices, protectionPricingPercent }) {
  try {
    const res = await axios.post(
      `${BASE_URL}/route_finder/calculate-protected-promo`,
      {
        source,
        destination,
        bandwidth: bandwidthMbps,
        secondary_circuit_ids: secondaryCircuitIds,
        primary_promo_prices: primaryPrices,
        protection_pricing_percent: protectionPricingPercent
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
    );

    const data = res.data;
    const tierKey = tierKeyForBandwidth(bandwidthMbps);
    const tierPrice = data.prices ? data.prices[tierKey] : null;

    if (!data.valid || tierPrice === null || tierPrice === undefined) {
      return { status: 'declined', tierKey, priceUsd: null, message: 'Protected promo pricing is not available for this bandwidth tier.' };
    }

    return {
      status: 'matched',
      tierKey,
      priceUsd: tierPrice,
      method: data.method || null,
      message: `Protected (diverse) promo pricing: ${formatUsd(tierPrice)}/month (USD) for ${TIER_LABELS[tierKey]}.`
    };
  } catch (err) {
    return { status: 'error', tierKey: tierKeyForBandwidth(bandwidthMbps), priceUsd: null, message: 'Could not check protected promo pricing right now.' };
  }
}

module.exports = {
  checkPromoForPath,
  checkProtectedPromo,
  tierKeyForBandwidth,
  TIER_LABELS,
  formatUsd
};
