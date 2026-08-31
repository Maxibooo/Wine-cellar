window.WC = window.WC || {};
WC.format = (function () {
  'use strict';

  function toFahrenheit(c) {
    return Math.round(c * 9 / 5 + 32);
  }

  // tempC is a [low, high] pair of Celsius values (as stored on knowledge
  // profiles). unit is 'C' or 'F'; 'F' converts and rounds each bound.
  function tempRange(tempC, unit) {
    var lo = tempC[0], hi = tempC[1];
    if (unit === 'F') {
      lo = toFahrenheit(lo);
      hi = toFahrenheit(hi);
    }
    return lo + '–' + hi + ' °' + unit;
  }

  function decant(minutes) {
    if (!minutes) { return 'No decanting'; }
    return 'Decant ' + minutes + ' min';
  }

  function vintageLabel(vintage) {
    return vintage === 'NV' ? 'NV' : String(vintage);
  }

  function money(amount, currency) {
    if (typeof amount !== 'number' || !isFinite(amount)) { return ''; }
    return currency + amount;
  }

  function plural(n, singular, pluralWord) {
    return n + ' ' + (n === 1 ? singular : pluralWord);
  }

  return {
    tempRange: tempRange,
    decant: decant,
    vintageLabel: vintageLabel,
    money: money,
    plural: plural
  };
})();
