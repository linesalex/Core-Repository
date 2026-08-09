/**
 * Format a network_routes.bandwidth value for display on the network map export.
 *
 * Bandwidth is stored as a plain Mbps number in text form (e.g. "100000", "10000",
 * "2222"), but can also hold non-numeric values such as "Dark Fiber". Numeric
 * values >= 1000 Mbps are shown in Gb, otherwise in Mb. Non-numeric values are
 * passed through unchanged.
 *
 * @param {string|number|null|undefined} rawBandwidth
 * @returns {string}
 */
function formatBandwidth(rawBandwidth) {
  if (rawBandwidth === null || rawBandwidth === undefined) {
    return '';
  }

  const trimmed = String(rawBandwidth).trim();
  if (trimmed === '') {
    return '';
  }

  const numeric = Number(trimmed);
  if (Number.isNaN(numeric)) {
    // Non-numeric value (e.g. "Dark Fiber") - show as-is
    return trimmed;
  }

  if (numeric >= 1000) {
    const gb = numeric / 1000;
    const gbRounded = Math.round(gb * 100) / 100; // up to 2 decimal places
    return `${trimNumber(gbRounded)} Gb`;
  }

  return `${trimNumber(numeric)} Mb`;
}

// Trim trailing zeros produced by rounding (e.g. 10.00 -> 10, 2.20 -> 2.2)
function trimNumber(value) {
  return String(Number(value.toFixed(2)));
}

module.exports = { formatBandwidth };
