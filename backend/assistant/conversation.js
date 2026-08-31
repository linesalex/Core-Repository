/**
 * Conversation orchestrator for the "Ask" chat assistant.
 *
 * Ties together the parser (parseQuery.js), the location/PoP resolver
 * (locationIndex.js), pathfinding (routeSearch.js) and promo pricing
 * (promoClient.js) into the single `POST /assistant/query` request/response
 * cycle, including the multi-turn PoP-clarification flow.
 *
 * Slot shapes carried in `conversation.slots`:
 *   source / destination: null | "<PoP code>" | { any: true, city, pops: string[] } | { pendingCity: true, city, pops: [{code,label,...}] }
 *   bandwidthMbps: null | number
 *   routeMode: 'fastest' | 'standard'
 */

const { parseQuery, extractBandwidth, hasRouteSignal } = require('./parseQuery');
const { buildResolver } = require('./locationIndex');
const { findRoute } = require('./routeSearch');
const { checkPromoForPath, checkProtectedPromo, formatUsd } = require('./promoClient');
const { formatBandwidthLabel, formatLatency, popLabel } = require('./formatters');

const EXAMPLES = [
  'Lowest latency 1Gb Singapore to London',
  'PoPs in London',
  '10Gb Frankfurt to New York',
  'IPCSNG1 to IPCLON7 at 1Gb'
];

function emptySlots() {
  return { source: null, destination: null, bandwidthMbps: null, routeMode: 'standard' };
}

function isAnyAnswer(message) {
  const t = message.trim().toLowerCase();
  return t === 'any' || t.includes('any pop') || t.includes('best latency') || t.includes('not sure') || t === 'any pop';
}

function matchPopAnswer(message, pops) {
  const trimmed = message.trim();
  const upper = trimmed.toUpperCase();
  const direct = pops.find(p => p.code.toUpperCase() === upper);
  if (direct) return direct.code;
  const byLabel = pops.find(p => trimmed.toLowerCase().includes(p.code.toLowerCase()));
  return byLabel ? byLabel.code : null;
}

/** Resolves a raw location token into a slot value, or null if unmatched. */
function tokenToSlot(token, resolver) {
  const resolution = resolver.resolve(token);
  if (!resolution.matched) return null;
  if (resolution.kind === 'pop') return resolution.code;
  return { pendingCity: true, city: resolution.city, pops: resolution.pops };
}

function candidatesFromSlot(slot) {
  if (typeof slot === 'string') return [slot];
  if (slot && slot.any) return slot.pops;
  return [];
}

function buildClarificationResponse(field, pendingSlot, slots) {
  const options = pendingSlot.pops.map(p => ({ value: p.code, label: p.label }));
  options.push({ value: 'any', label: `Not sure — use best latency across all ${pendingSlot.city} PoPs` });
  return {
    status: 'need_clarification',
    reply: `${pendingSlot.city} has multiple PoPs — which one, or should I use the best latency across all of them?`,
    clarify: field,
    options,
    conversation: { slots, pendingField: field }
  };
}

function needSlotResponse(field, reply, slots) {
  return { status: 'need_slot', clarify: field, reply, conversation: { slots, pendingField: field } };
}

function unparsedResponse() {
  return {
    status: 'unparsed',
    reply: "I'm not sure what you're asking yet. I can find the lowest-latency route (with promo pricing) between two locations, or list the PoPs in a city. Try something like:",
    examples: EXAMPLES,
    conversation: { slots: emptySlots(), pendingField: null }
  };
}

/**
 * Given fully-merged slots, decides the next step: ask for a missing/
 * ambiguous piece, or run the search.
 */
async function evaluateSlots(slots, resolver, token, wantsProtected = false) {
  if (slots.source && slots.source.pendingCity) {
    return buildClarificationResponse('source', slots.source, slots);
  }
  if (slots.source === null) {
    return needSlotResponse('source', 'Which source location did you mean? You can give a city name (e.g. Singapore) or a PoP code (e.g. IPCSNG1).', slots);
  }

  if (slots.destination && slots.destination.pendingCity) {
    return buildClarificationResponse('destination', slots.destination, slots);
  }
  if (slots.destination === null) {
    return needSlotResponse('destination', 'Which destination location did you mean? You can give a city name (e.g. London) or a PoP code (e.g. IPCLON7).', slots);
  }

  if (slots.bandwidthMbps === null) {
    return needSlotResponse('bandwidth', 'What bandwidth do you need (e.g. 1Gb, 10Gb, 100Mb)?', slots);
  }

  return finalizeSearch(slots, resolver, token, wantsProtected);
}

async function finalizeSearch(slots, resolver, token, wantsProtected = false) {
  const sourceCandidates = candidatesFromSlot(slots.source);
  const destCandidates = candidatesFromSlot(slots.destination);

  const result = await findRoute({
    sourceCandidates,
    destCandidates,
    bandwidthMbps: slots.bandwidthMbps,
    routeMode: slots.routeMode,
    wantDiverse: true
  });

  if (!result) {
    return {
      status: 'no_route',
      reply: `No connected route was found for a ${formatBandwidthLabel(slots.bandwidthMbps)} service between the selected locations.`,
      conversation: { slots, pendingField: null }
    };
  }

  const { sourcePop, destPop, primaryPath, diversePath, provisioningNotes } = result;
  const sourceOption = resolver.resolvePopCode(sourcePop);
  const destOption = resolver.resolvePopCode(destPop);

  const primaryCircuitIds = primaryPath.route.map(r => r.circuit_id).filter(Boolean);
  const secondaryCircuitIds = diversePath ? diversePath.route.map(r => r.circuit_id).filter(Boolean) : [];

  const primaryPromo = await checkPromoForPath({
    token, source: sourcePop, destination: destPop, bandwidthMbps: slots.bandwidthMbps, circuitIds: primaryCircuitIds
  });

  let secondaryPromo = null;
  let protectedPromo = null;
  if (diversePath) {
    secondaryPromo = await checkPromoForPath({
      token, source: sourcePop, destination: destPop, bandwidthMbps: slots.bandwidthMbps, circuitIds: secondaryCircuitIds
    });

    if (primaryPromo.status === 'matched' && primaryPromo.protectionPricingPercent > 0 && slots.routeMode !== 'fastest') {
      protectedPromo = await checkProtectedPromo({
        token, source: sourcePop, destination: destPop, bandwidthMbps: slots.bandwidthMbps,
        secondaryCircuitIds,
        primaryPrices: primaryPromo.prices, protectionPricingPercent: primaryPromo.protectionPricingPercent
      });
    }
  }

  const latency = formatLatency(primaryPath.totalLatency);
  const bwLabel = formatBandwidthLabel(slots.bandwidthMbps);
  const modeLabel = slots.routeMode === 'fastest' ? 'Lowest latency' : 'Latency';
  const sourceLabel = popLabel(sourceOption) || sourcePop;
  const destLabel = popLabel(destOption) || destPop;

  // Kept minimal on purpose: end users get the answer plus promo pricing
  // if it applies, not the backend's reasoning for why/why not. Circuit
  // provisioning status is an operational caveat rather than "reasoning",
  // so that's still surfaced.
  const notes = [];
  provisioningNotes.forEach(p => {
    notes.push(`Note: circuit ${p.circuit_id} used in this path is in Provisioning status${p.expected_go_live_date ? ` (expected go-live ${new Date(p.expected_go_live_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})` : ''}.`);
  });

  let reply;
  if (wantsProtected) {
    if (diversePath) {
      const diverseLatency = formatLatency(diversePath.totalLatency);
      reply = `The protected (diverse) path for a ${bwLabel} service ${sourceLabel} → ${destLabel} is ${diverseLatency} ms (${diversePath.hops} hop${diversePath.hops === 1 ? '' : 's'}).`;
      const bestSecondary = (protectedPromo && protectedPromo.status === 'matched') ? protectedPromo : (secondaryPromo && secondaryPromo.status === 'matched' ? secondaryPromo : null);
      if (bestSecondary) reply += ` Promo pricing applies: ${formatUsd(bestSecondary.priceUsd)}/month (USD).`;
    } else {
      reply = `No protected (diverse) path is available for a ${bwLabel} service between ${sourceLabel} and ${destLabel}.`;
    }
  } else {
    reply = `${modeLabel} for a ${bwLabel} service ${sourceLabel} → ${destLabel} is ${latency} ms (${primaryPath.hops} hop${primaryPath.hops === 1 ? '' : 's'}).`;
    if (primaryPromo.status === 'matched') reply += ` Promo pricing applies: ${formatUsd(primaryPromo.priceUsd)}/month (USD).`;
  }

  return {
    status: 'answered',
    reply,
    notes,
    slots: { source: sourcePop, destination: destPop, bandwidthMbps: slots.bandwidthMbps, routeMode: slots.routeMode },
    result: {
      sourcePop,
      destPop,
      sourceLabel: sourceOption ? sourceOption.label : sourcePop,
      destLabel: destOption ? destOption.label : destPop,
      totalLatency: latency,
      hops: primaryPath.hops,
      route: primaryPath.route,
      diversePath: diversePath ? { totalLatency: formatLatency(diversePath.totalLatency), hops: diversePath.hops, route: diversePath.route } : null
    },
    promo: {
      primary: primaryPromo,
      secondary: secondaryPromo,
      protected: protectedPromo
    },
    actions: [{
      type: 'open_route_finder',
      source: sourcePop,
      destination: destPop,
      bandwidth: slots.bandwidthMbps,
      routeMode: slots.routeMode
    }],
    conversation: { slots: { source: sourcePop, destination: destPop, bandwidthMbps: slots.bandwidthMbps, routeMode: slots.routeMode }, pendingField: null }
  };
}

/**
 * A message that names a real location but gives the parser no other signal
 * (no route word, no bandwidth, no PoPs/locations keyword) is genuinely
 * ambiguous - e.g. "London" alone could mean "list London's PoPs" or the
 * start of a route question. Rather than silently guessing (or asking for
 * an unrelated slot), offer the most likely reading as a one-tap chip.
 */
function buildDidYouMeanResponse(resolution, priorSlots) {
  const city = resolution.city;
  return {
    status: 'need_clarification',
    clarify: 'intent',
    reply: `Did you mean PoPs in ${city}? I can list them, or find a route if you give me both endpoints (e.g. "${city} to Frankfurt").`,
    options: [{ value: `PoPs in ${city}`, label: `Show PoPs in ${city}` }],
    conversation: { slots: priorSlots, pendingField: null }
  };
}

async function buildListPopsResponse(rawLocation, resolver) {
  const slots = emptySlots();

  if (!rawLocation) {
    return {
      status: 'need_slot',
      clarify: 'location',
      reply: 'Which city or PoP code would you like to see PoPs for?',
      conversation: { slots, pendingField: 'location' }
    };
  }

  const resolution = resolver.resolve(rawLocation);

  if (!resolution.matched) {
    return {
      status: 'need_slot',
      clarify: 'location',
      reply: `I couldn't find a city or PoP called "${rawLocation}". Try a city name (e.g. Singapore) or a PoP code (e.g. IPCSNG1).`,
      conversation: { slots, pendingField: 'location' }
    };
  }

  if (resolution.kind === 'pop') {
    return {
      status: 'answered',
      reply: `${rawLocation} resolves to one active PoP: ${resolution.label}.`,
      result: { pops: [resolution] },
      conversation: { slots, pendingField: null }
    };
  }

  const list = resolution.pops.map(p => p.label).join(', ');
  return {
    status: 'answered',
    reply: `${resolution.city} has ${resolution.pops.length} active PoPs: ${list}.`,
    result: { city: resolution.city, pops: resolution.pops },
    conversation: { slots, pendingField: null }
  };
}

/**
 * Handles one turn of the conversation.
 *
 * @param {object} params
 * @param {string} params.message
 * @param {object|null|undefined} params.conversation - as previously returned by this function
 * @param {string} params.token - the caller's JWT, forwarded to the internal promo-pricing calls
 */
async function handleQuery({ message, conversation, token }) {
  const text = String(message || '').trim();
  if (!text) return unparsedResponse();

  const resolver = await buildResolver();
  const priorSlots = conversation && conversation.slots ? conversation.slots : emptySlots();
  const pendingField = conversation && conversation.pendingField ? conversation.pendingField : null;

  // Try to interpret this message as the direct answer to a pending
  // clarification/need_slot question before falling back to a fresh parse.
  if (pendingField === 'source' || pendingField === 'destination') {
    const pendingSlot = priorSlots[pendingField];

    if (pendingSlot && pendingSlot.pendingCity) {
      if (isAnyAnswer(text)) {
        const slots = { ...priorSlots, [pendingField]: { any: true, city: pendingSlot.city, pops: pendingSlot.pops.map(p => p.code) } };
        return evaluateSlots(slots, resolver, token);
      }
      const matchedCode = matchPopAnswer(text, pendingSlot.pops);
      if (matchedCode) {
        const slots = { ...priorSlots, [pendingField]: matchedCode };
        return evaluateSlots(slots, resolver, token);
      }
      // Didn't look like an answer to the chip question - fall through to a fresh parse below.
    } else {
      // Simple missing-slot request (no chips yet) - treat the whole message as a location token.
      const slotValue = tokenToSlot(text, resolver);
      if (slotValue !== null) {
        const slots = { ...priorSlots, [pendingField]: slotValue };
        return evaluateSlots(slots, resolver, token);
      }
      return needSlotResponse(
        pendingField,
        `I still couldn't find a location called "${text}". Try a city name or a PoP code (e.g. ${pendingField === 'source' ? 'IPCSNG1' : 'IPCLON7'}).`,
        priorSlots
      );
    }
  }

  if (pendingField === 'bandwidth') {
    const bw = extractBandwidth(text);
    if (bw) {
      const slots = { ...priorSlots, bandwidthMbps: bw.bandwidthMbps };
      return evaluateSlots(slots, resolver, token);
    }
    return needSlotResponse('bandwidth', `I didn't catch a bandwidth in "${text}". Try something like 1Gb, 10Gb, or 100Mb.`, priorSlots);
  }

  if (pendingField === 'location') {
    return buildListPopsResponse(text, resolver);
  }

  // Fresh parse (either no pending question, or the message didn't answer it).
  const parsed = parseQuery(text);

  if (parsed.intent === 'list_pops') {
    return buildListPopsResponse(parsed.singleLocation, resolver);
  }

  // A bare location mention with no route/bandwidth/list_pops signal at all
  // is ambiguous - offer the most likely reading instead of guessing wrong.
  if (parsed.intent === 'find_route' && parsed.source === null && parsed.destination === null && parsed.bandwidthMbps === null && !hasRouteSignal(text)) {
    const bareResolution = resolver.resolve(text);
    if (bareResolution.matched) {
      return buildDidYouMeanResponse(bareResolution, priorSlots);
    }
  }

  const sourceSlot = parsed.source ? tokenToSlot(parsed.source, resolver) : priorSlots.source;
  if (parsed.source && sourceSlot === null) {
    return needSlotResponse('source', `I couldn't find a location called "${parsed.source}". Try a city name or a PoP code (e.g. IPCSNG1).`, priorSlots);
  }

  const destinationSlot = parsed.destination ? tokenToSlot(parsed.destination, resolver) : priorSlots.destination;
  if (parsed.destination && destinationSlot === null) {
    return needSlotResponse('destination', `I couldn't find a location called "${parsed.destination}". Try a city name or a PoP code (e.g. IPCLON7).`, priorSlots);
  }

  const bandwidthMbps = parsed.bandwidthMbps !== null ? parsed.bandwidthMbps : priorSlots.bandwidthMbps;
  const routeMode = parsed.intent === 'lowest_latency' ? 'fastest' : (priorSlots.routeMode || 'standard');

  const slots = { source: sourceSlot, destination: destinationSlot, bandwidthMbps, routeMode };

  const isFreshConversation = !conversation;
  if (isFreshConversation && !slots.source && !slots.destination && slots.bandwidthMbps === null) {
    return unparsedResponse();
  }

  return evaluateSlots(slots, resolver, token, parsed.wantsProtected);
}

module.exports = { handleQuery, emptySlots };
