window.WC = window.WC || {};
WC.router = (function () {
  'use strict';

  var TITLES = {
    cellar: 'Cellar',
    bottle: 'Bottle',
    form: 'Add bottle',
    history: 'History',
    settings: 'Settings'
  };

  var RENDERERS = {
    cellar: WC.cellar.render,
    bottle: renderBottle,
    form: renderForm,
    history: WC.history.render,
    settings: WC.settings.render
  };

  function renderBottle(container, params) {
    var id = params && params.id;
    return WC.bottle.render(container, id);
  }

  // The form screen renders both "add" (no id) and "edit" (id present) —
  // load the existing bottle first when editing, so WC.form.render always
  // gets a real bottle or null, never a params object.
  function renderForm(container, params) {
    var id = params && params.id;
    if (!id) { return WC.form.render(container, null); }
    return WC.store.getBottle(id).then(function (bottle) {
      return WC.form.render(container, bottle || null);
    });
  }

  function placeholder(container) {
    container.textContent = '';
    var p = document.createElement('p');
    p.className = 'screen-placeholder';
    p.textContent = 'Not built yet.';
    container.appendChild(p);
    return Promise.resolve();
  }

  function updateCounts() {
    var el = document.getElementById('cellar-counts');
    if (!el) { return Promise.resolve(); }
    return WC.store.allBottles().then(function (bottles) {
      var rows = WC.cellar.filterAndSort(bottles, {}, new Date().getFullYear());
      var c = WC.cellar.counts(rows);
      if (c.entries === 0) {
        el.textContent = '';
        return;
      }
      el.textContent = WC.format.plural(c.bottles, 'bottle', 'bottles') +
        (c.readyNow > 0 ? ' · ' + c.readyNow + ' ready now' : '');
    });
  }

  function render(name, params) {
    var container = document.getElementById('screen-' + name);
    var titleEl = document.getElementById('screen-title');
    if (titleEl) {
      var title = name === 'form' && params && params.id ? 'Edit bottle' : TITLES[name];
      titleEl.textContent = title || '';
    }
    WC.app.show(name);
    var screenPromise = container
      ? (RENDERERS[name] ? RENDERERS[name](container, params) : placeholder(container))
      : Promise.resolve();
    // One rejection handler for every screen's read path. A failed
    // allBottles() (or getBottle, or getSetting) used to leave a blank
    // screen and a console-only unhandled rejection: from the owner's side
    // the app had simply lost their cellar with no explanation. Handled
    // here rather than in five renderers because they all reach the store
    // through this one call.
    //
    // warnIfStorageUnavailable() runs again because a store that failed
    // mid-session is exactly the state the persistent #storage-warning
    // banner exists to show, and it is only otherwise evaluated once at
    // startup. Deliberately swallowing: every caller that chains a success
    // toast after render() is reporting a write that already committed, and
    // must not be turned into a failure by a display problem after it.
    return Promise.all([updateCounts(), screenPromise]).then(null, function (err) {
      WC.app.toast(WC.errors.readFailureMessage(err, 'your cellar'));
      WC.app.warnIfStorageUnavailable();
    });
  }

  return { render: render };
})();
