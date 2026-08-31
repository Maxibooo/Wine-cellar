window.WC = window.WC || {};
WC.history = (function () {
  'use strict';

  // Copies with slice() before sorting -- Array.prototype.sort mutates in
  // place, and callers (render's cache, the test's own fixture) must keep
  // seeing their original array afterward.
  function sortNewestFirst(entries) {
    return (entries || []).slice().sort(function (a, b) {
      return a.drunkOn < b.drunkOn ? 1 : (a.drunkOn > b.drunkOn ? -1 : 0);
    });
  }

  // The one place that decides which scale a stored value means. /20 and
  // /100 are the only two scales the app offers, and an entry with no
  // ratingScale is a v1 entry, which recorded on /100 -- so anything that is
  // not exactly the number 20 reads as /100. This used to be written out as
  // `x === 20 ? 20 : 100` at five call sites across history.js and bottle.js:
  // all five were correct, but each one restated the contract, and the next
  // scale (or the next reader) had five places to keep in agreement.
  //
  // Deliberately NOT `value || 100`: a `||` on a numeric field is the exact
  // idiom this project has already shipped a bug over, and the v2 plan's own
  // constraints forbid it.
  function scaleOf(value) {
    return value === 20 ? 20 : 100;
  }

  // Returns entry's rating as a 0-100 percentage, or null when unrated. A
  // rating of 0 is a real score the owner recorded -- it must normalise to
  // 0, not null, so this checks the type/finiteness of entry.rating rather
  // than its truthiness. An entry with no ratingScale is a v1 entry, and v1
  // recorded on /100.
  function normaliseRating(entry) {
    if (!entry || typeof entry.rating !== 'number' || !isFinite(entry.rating)) { return null; }
    var scale = scaleOf(entry.ratingScale);
    return (entry.rating / scale) * 100;
  }

  // Ratings are stored on whichever scale they were recorded on, so a
  // history spanning both /20 and /100 entries has to normalise each one to
  // a percentage before averaging, then convert the mean back onto the
  // requested display `scale`. Rounded to one decimal place.
  function summarise(entries, scale) {
    var list = entries || [];
    var targetScale = scaleOf(scale);
    var pctSum = 0, ratedCount = 0;
    list.forEach(function (e) {
      var pct = normaliseRating(e);
      if (pct !== null) {
        pctSum += pct;
        ratedCount += 1;
      }
    });
    var averageRating = ratedCount === 0
      ? null
      : Math.round((pctSum / ratedCount) * (targetScale / 100) * 10) / 10;
    return {
      count: list.length,
      rated: ratedCount,
      averageRating: averageRating
    };
  }

  // 'Buy again' / 'Would not rebuy' / '' -- unanswered must render as
  // nothing, never as though the owner said no.
  function buyAgainLabel(entry) {
    if (!entry || entry.buyAgain === undefined) { return ''; }
    return entry.buyAgain ? 'Buy again' : 'Would not rebuy';
  }

  // Case-insensitive match against the wine name and the notes. An empty
  // (or whitespace-only) query matches everything.
  function filter(entries, query) {
    var list = entries || [];
    var q = (query || '').trim().toLowerCase();
    if (!q) { return list; }
    return list.filter(function (e) {
      var haystack = [e.wineName, e.notes].filter(function (v) { return v; }).join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
  }

  // --- render --------------------------------------------------------------

  var state = { query: '' };
  var cache = [];
  // The scale the summary average is displayed on -- from settings, not
  // per-entry. Each entry still renders on the scale it was recorded on.
  var displayScale = 100;

  function textRow(parent, text, className) {
    var p = document.createElement('p');
    if (className) { p.className = className; }
    p.textContent = text;
    parent.appendChild(p);
    return p;
  }

  function buildSummary(entries) {
    var s = summarise(entries, displayScale);
    var line = WC.format.plural(s.count, 'drink', 'drinks') + ' logged';
    if (s.rated > 0) {
      line += ' · average rating ' + s.averageRating + '/' + displayScale +
        ' (' + WC.format.plural(s.rated, 'rated wine', 'rated wines') + ')';
    }
    var p = document.createElement('p');
    p.className = 'history-summary';
    p.textContent = line;
    return p;
  }

  function buildRow(entry) {
    var row = document.createElement('div');
    row.className = 'history-row';

    var top = document.createElement('div');
    top.className = 'history-row-top';
    var name = document.createElement('span');
    name.className = 'history-wine';
    name.textContent = entry.wineName + ' · ' + WC.format.vintageLabel(entry.vintage);
    top.appendChild(name);
    // Rendered on the scale the entry was actually recorded on -- a v1
    // entry (no ratingScale) is /100, matching what normaliseRating treats
    // it as.
    if (typeof entry.rating === 'number' && isFinite(entry.rating)) {
      var rating = document.createElement('span');
      rating.className = 'history-rating';
      rating.textContent = entry.rating + '/' + scaleOf(entry.ratingScale);
      top.appendChild(rating);
    }
    var buyLabel = buyAgainLabel(entry);
    if (buyLabel) {
      var buyAgainEl = document.createElement('span');
      buyAgainEl.className = 'history-buy-again';
      buyAgainEl.textContent = buyLabel;
      top.appendChild(buyAgainEl);
    }
    row.appendChild(top);

    textRow(row, entry.drunkOn, 'history-date');

    if (entry.notes) {
      textRow(row, entry.notes, 'history-notes');
    }

    return row;
  }

  function renderList(listEl) {
    listEl.textContent = '';
    var sorted = sortNewestFirst(cache);
    var rows = filter(sorted, state.query);
    if (rows.length === 0) {
      var none = document.createElement('p');
      none.className = 'history-empty';
      none.textContent = 'No drinks match your search.';
      listEl.appendChild(none);
      return;
    }
    rows.forEach(function (entry) { listEl.appendChild(buildRow(entry)); });
  }

  function draw(container) {
    container.textContent = '';

    if (cache.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = 'No drinks logged yet — history appears once you drink a bottle.';
      container.appendChild(empty);
      return;
    }

    container.appendChild(buildSummary(cache));

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'history-search';
    search.placeholder = 'Search wine or notes…';
    search.value = state.query;
    search.setAttribute('aria-label', 'Search the drink history');
    container.appendChild(search);

    var list = document.createElement('div');
    list.className = 'history-list';
    container.appendChild(list);

    search.addEventListener('input', function () {
      state.query = search.value;
      renderList(list);
    });

    renderList(list);
  }

  function render(container) {
    return Promise.all([WC.store.allDrinks(), WC.settings.load()]).then(function (results) {
      cache = results[0] || [];
      displayScale = scaleOf(results[1].ratingScale);
      draw(container);
    });
  }

  return {
    sortNewestFirst: sortNewestFirst,
    scaleOf: scaleOf,
    normaliseRating: normaliseRating,
    summarise: summarise,
    buyAgainLabel: buyAgainLabel,
    filter: filter,
    render: render
  };
})();
