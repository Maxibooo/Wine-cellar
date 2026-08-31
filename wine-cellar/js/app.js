window.WC = window.WC || {};
WC.app = (function () {
  'use strict';
  var current = 'cellar';

  function show(name) {
    ['cellar', 'bottle', 'form', 'history', 'settings'].forEach(function (s) {
      document.getElementById('screen-' + s).hidden = (s !== name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      if (b.dataset.screen === name) { b.setAttribute('aria-current', 'true'); }
      else { b.removeAttribute('aria-current'); }
    });
    current = name;
    document.getElementById('add-bottle').hidden = (name !== 'cellar');
  }

  function toast(message) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    window.setTimeout(function () { el.hidden = true; }, 3200);
  }

  // Shows #storage-warning when the store could not open (private browsing
  // with storage disabled, quota exhausted at open time, etc). Must run on
  // both the resolve and the reject path of the first WC.store.open() call --
  // the rejection path is exactly when the warning matters, since a store
  // that never opened would otherwise fail silently underneath every screen.
  function warnIfStorageUnavailable() {
    var el = document.getElementById('storage-warning');
    if (el) { el.hidden = WC.store.available(); }
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.addEventListener('click', function () { WC.app.render(b.dataset.screen); });
    });
    document.getElementById('add-bottle').addEventListener('click', function () {
      WC.app.render('form');
    });
    WC.store.open().then(warnIfStorageUnavailable, warnIfStorageUnavailable);
    // The first render's read path can fail (a store that would not open is
    // the normal way it does). WC.router.render owns that rejection now --
    // it toasts and re-checks the storage warning -- so this call is safe to
    // leave un-chained, and adding a second handler here would only produce
    // a duplicate message.
    WC.app.render('cellar');
  }

  function render(name, params) { return WC.router.render(name, params); }

  document.addEventListener('DOMContentLoaded', start);

  // Defensive: the single-file bundle has no sw.js beside it, and this may
  // run from a file:// origin where registration is impossible outright.
  // A failed or impossible registration must be a silent no-op, never an
  // error the owner sees.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* fine without it */ });
  }

  return {
    show: show,
    toast: toast,
    render: render,
    currentScreen: function () { return current; },
    warnIfStorageUnavailable: warnIfStorageUnavailable
  };
})();
