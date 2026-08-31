window.WC = window.WC || {};
WC.windows = (function () {
  'use strict';
  var TIERS = ['everyday', 'good', 'serious', 'benchmark'];
  var TIER_FACTOR = { everyday: 0.45, good: 0.7, serious: 1, benchmark: 1.45 };
  var VINTAGE_FACTOR = { 1: 0.6, 2: 0.8, 3: 1, 4: 1.1, 5: 1.25 };
  var PHASE_LABEL = {
    'too-young': 'Too young', 'approaching': 'Approaching', 'at-peak': 'At peak',
    'drink-up': 'Drink up', 'past-best': 'Past best'
  };

  function phaseFor(win, year) {
    if (year < win.readyFrom) { return 'too-young'; }
    if (year < win.peakFrom) { return 'approaching'; }
    if (year <= win.peakTo) { return 'at-peak'; }
    if (year < win.declineFrom) { return 'drink-up'; }
    return 'past-best';
  }

  function messageFor(phase, win, year, confidence, profile) {
    var hedge = '';
    if (confidence === 'fallback') {
      hedge = profile.basis === 'country'
        ? ' (estimated from typical ' + profile.styleLabel + ' wines from ' + profile.country + ')'
        : ' (rough estimate — region not in the reference data)';
    }
    if (phase === 'too-young') {
      return 'Hold — ready from ' + win.readyFrom + ', ' + (win.readyFrom - year) + ' years away.' + hedge;
    }
    if (phase === 'approaching') {
      return 'Drinkable now, but the peak starts in ' + win.peakFrom + '.' + hedge;
    }
    if (phase === 'at-peak') {
      return 'At its peak now, through ' + win.peakTo + '.' + hedge;
    }
    if (phase === 'drink-up') {
      return 'Past the peak — drink before it fades around ' + win.declineFrom + '.' + hedge;
    }
    return 'Likely past its best (declining since ' + win.declineFrom + ').' + hedge;
  }

  function evaluate(bottle, currentYear) {
    var profile = WC.knowledge.get(bottle.region, bottle.style, bottle.country);
    var confidence = profile.fallback ? 'fallback' : 'profile';

    if (bottle.windowOverride && bottle.windowOverride.start && bottle.windowOverride.end) {
      var o = bottle.windowOverride;
      var ow = { readyFrom: o.start, peakFrom: o.start, peakTo: o.end, declineFrom: o.end };
      var op = phaseFor(ow, currentYear);
      return {
        phase: op, window: ow, confidence: 'override', profile: profile, vintage: bottle.vintage,
        message: 'Your own window: ' + o.start + '–' + o.end + '.'
      };
    }

    var tier = TIER_FACTOR[bottle.tier] || 1;

    if (bottle.vintage === 'NV') {
      var nvEnd = currentYear + Math.max(2, Math.round(profile.curve[2] * tier * 0.25));
      return {
        phase: 'at-peak', confidence: confidence, profile: profile, vintage: bottle.vintage,
        window: { readyFrom: currentYear, peakFrom: currentYear, peakTo: nvEnd, declineFrom: nvEnd + 2 },
        message: 'Non-vintage — drink within a few years, ideally by ' + nvEnd + '.'
      };
    }

    var vintage = parseInt(bottle.vintage, 10);
    var late = VINTAGE_FACTOR[WC.vintages.rating(bottle.region, vintage)] || 1;
    var c = profile.curve;
    var win = {
      readyFrom: vintage + Math.round(c[0] * tier),
      peakFrom: vintage + Math.round(c[1] * tier),
      peakTo: vintage + Math.round(c[2] * tier * late),
      declineFrom: vintage + Math.round(c[3] * tier * late)
    };
    // Keep the bounds monotonic after rounding. phaseFor treats peakTo as
    // inclusive of at-peak and declineFrom as exclusive of drink-up, so the
    // drink-up band (peakTo, declineFrom) needs declineFrom >= peakTo + 2
    // for it to contain at least one integer year.
    win.peakFrom = Math.max(win.peakFrom, win.readyFrom);
    win.peakTo = Math.max(win.peakTo, win.peakFrom);
    win.declineFrom = Math.max(win.declineFrom, win.peakTo + 2);

    var phase = phaseFor(win, currentYear);
    return {
      phase: phase, window: win, confidence: confidence, profile: profile, vintage: vintage,
      message: messageFor(phase, win, currentYear, confidence, profile)
    };
  }

  return {
    TIERS: TIERS, TIER_FACTOR: TIER_FACTOR, PHASE_LABEL: PHASE_LABEL, evaluate: evaluate
  };
})();
