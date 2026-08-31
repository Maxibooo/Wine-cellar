window.WC = window.WC || {};
// Shared failure-message wording. Every screen that writes to (or reads
// from) IndexedDB has to be able to say something true to the owner when
// that fails, and it has to say the same thing everywhere: the convention
// started in settings.js, and these two helpers used to live there as
// private functions while form.js, bottle.js and router.js had no rejection
// handlers at all. They live here so all four call sites share one wording
// instead of growing three copies of it.
WC.errors = (function () {
  'use strict';

  // Storage-full is its own case, not a generic write failure. The spec's
  // error table requires that the message prompt an export and suggest
  // removing photos -- advice that is actively wrong for any other failure,
  // and that the owner cannot act on if a quota abort reads as "storage is
  // unavailable".
  //
  // Detected from the error rather than guessed. IndexedDB aborts a
  // quota-exceeded transaction with a DOMException whose name is
  // 'QuotaExceededError' in Chrome/Safari; Firefox has historically used
  // 'NS_ERROR_DOM_QUOTA_REACHED', and older engines only set the legacy
  // numeric DOMException code (22). The message check is last and is only a
  // safety net for an engine that reports the condition some fourth way --
  // a false positive there costs the owner one extra sentence of advice,
  // while a false negative costs them the advice they actually needed.
  var QUOTA_NAMES = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED', 'QUOTA_EXCEEDED_ERR'];

  function isQuotaExceeded(err) {
    if (!err) { return false; }
    if (typeof err.name === 'string' && QUOTA_NAMES.indexOf(err.name) !== -1) { return true; }
    if (err.code === 22) { return true; }
    return typeof err.message === 'string' && /quota/i.test(err.message);
  }

  // The error's own text when it has one, the caller's fallback otherwise --
  // never the string "undefined" or an empty tail after an em dash.
  function errorMessage(err, fallback) {
    return (err && typeof err.message === 'string' && err.message) ? err.message : fallback;
  }

  function saveFailureMessage(err, label) {
    if (isQuotaExceeded(err)) {
      return 'Storage is full — could not save ' + label + '. Export a backup now, ' +
        'then free space by removing some label photos.';
    }
    return 'Could not save ' + label + ' — ' + errorMessage(err, 'storage is unavailable.');
  }

  function readFailureMessage(err, label) {
    return 'Could not read ' + label + ' — ' + errorMessage(err, 'storage is unavailable.');
  }

  return {
    isQuotaExceeded: isQuotaExceeded,
    errorMessage: errorMessage,
    saveFailureMessage: saveFailureMessage,
    readFailureMessage: readFailureMessage
  };
})();
