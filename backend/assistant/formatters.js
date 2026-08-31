/** Small display helpers shared by the assistant's reply text. */

function formatBandwidthLabel(mbps) {
  if (mbps === null || mbps === undefined) return 'unspecified bandwidth';
  if (mbps >= 200000) return 'Dark Fiber';
  if (mbps >= 1000) {
    const gb = mbps / 1000;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} Gb`;
  }
  return `${mbps} Mb`;
}

function formatLatency(ms) {
  return Math.round(ms * 100) / 100;
}

function popLabel(option) {
  if (!option) return 'unknown location';
  return option.datacenterName ? `${option.code} (${option.datacenterName})` : option.code;
}

module.exports = { formatBandwidthLabel, formatLatency, popLabel };
