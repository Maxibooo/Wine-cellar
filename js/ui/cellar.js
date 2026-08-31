window.WC = window.WC || {};
WC.cellar = (function () {
  'use strict';

  var URGENCY_RANK = { 'drink-up': 0, 'at-peak': 1, 'past-best': 2, 'approaching': 3, 'too-young': 4 };
  var STYLE_COLOR = {
    red: '#7a2331', white: '#c9b458', rose: '#d98a9c',
    sparkling: '#bfae7a', sweet: '#caa14a', fortified: '#5a3a1e'
  };

  function quantityOf(bottle) {
    return typeof bottle.quantity === 'number' ? bottle.quantity : 0;
  }

  // 'NV' sorts after every numbered vintage.
  function vintageSortValue(vintage) {
    if (vintage === 'NV') { return Infinity; }
    var n = parseInt(vintage, 10);
    return isNaN(n) ? Infinity : n;
  }

  // An unrated wine sorts last regardless of direction, so it gets a
  // sentinel below the scale (0 is a real rating and must outrank this).
  // typeof + isFinite, matching what the two render paths now use: a NaN out
  // of a hand-edited backup is not a rating, and letting it through would
  // make every comparison against it false.
  function ratingSortValue(bottle) {
    return typeof bottle.wineRating === 'number' && isFinite(bottle.wineRating)
      ? bottle.wineRating
      : -1;
  }

  function matchesQuery(row, query) {
    if (!query) { return true; }
    var haystack = [
      row.bottle.name, row.bottle.producer, row.evaluation.profile.region,
      row.bottle.appellation, row.bottle.country, WC.form.formatSlots(row.bottle.location)
    ].filter(function (v) { return v; }).join(' ').toLowerCase();
    return haystack.indexOf(String(query).toLowerCase()) !== -1;
  }

  // An absent or empty list means "no filter" — everything matches.
  function matchesMembership(value, list) {
    return !list || list.length === 0 || list.indexOf(value) !== -1;
  }

  function comparatorFor(sort) {
    if (sort === 'name') {
      return function (a, b) { return a.bottle.name.localeCompare(b.bottle.name); };
    }
    if (sort === 'vintage') {
      return function (a, b) {
        var d = vintageSortValue(a.bottle.vintage) - vintageSortValue(b.bottle.vintage);
        return d !== 0 ? d : a.bottle.name.localeCompare(b.bottle.name);
      };
    }
    if (sort === 'rating') {
      return function (a, b) {
        var d = ratingSortValue(b.bottle) - ratingSortValue(a.bottle);
        return d !== 0 ? d : a.bottle.name.localeCompare(b.bottle.name);
      };
    }
    return function (a, b) {
      var d = URGENCY_RANK[a.evaluation.phase] - URGENCY_RANK[b.evaluation.phase];
      return d !== 0 ? d : a.bottle.name.localeCompare(b.bottle.name);
    };
  }

  // Pure and clock-free: currentYear is always supplied by the caller so
  // this can be exercised with fixed years in tests. Never reads Date().
  function filterAndSort(bottles, options, currentYear) {
    var opts = options || {};
    var rows = (bottles || []).map(function (bottle) {
      return { bottle: bottle, evaluation: WC.windows.evaluate(bottle, currentYear) };
    });

    rows = rows.filter(function (row) {
      return matchesQuery(row, opts.query) &&
        matchesMembership(row.evaluation.phase, opts.phases) &&
        matchesMembership(row.bottle.style, opts.styles) &&
        matchesMembership(row.bottle.country, opts.countries);
    });

    var compare = comparatorFor(opts.sort);
    rows.sort(function (a, b) {
      var aEmpty = quantityOf(a.bottle) === 0;
      var bEmpty = quantityOf(b.bottle) === 0;
      if (aEmpty !== bEmpty) { return aEmpty ? 1 : -1; }
      return compare(a, b);
    });

    return rows;
  }

  function counts(rows) {
    var bottles = 0, readyNow = 0;
    (rows || []).forEach(function (row) {
      var q = quantityOf(row.bottle);
      bottles += q;
      if (row.evaluation.phase === 'at-peak' || row.evaluation.phase === 'drink-up') {
        readyNow += q;
      }
    });
    return { bottles: bottles, entries: (rows || []).length, readyNow: readyNow };
  }

  // --- rendering ---------------------------------------------------------

  var state = { query: '', phases: [], styles: [], countries: [], sort: 'urgency' };
  var cache = [];
  var activeUrls = [];

  function revokeThumbnails() {
    activeUrls.forEach(function (url) { WC.photos.revoke(url); });
    activeUrls = [];
  }

  function toggleMembership(list, value) {
    var i = list.indexOf(value);
    if (i === -1) { list.push(value); } else { list.splice(i, 1); }
  }

  function distinctValues(bottles, field) {
    var seen = {};
    bottles.forEach(function (b) { if (b[field]) { seen[b[field]] = true; } });
    return Object.keys(seen).sort();
  }

  function buildChipGroup(container, label, values, listKey, redraw, display) {
    if (values.length === 0) { return; }
    var group = document.createElement('div');
    group.className = 'chip-group';
    var groupLabel = document.createElement('span');
    groupLabel.className = 'chip-group-label';
    groupLabel.textContent = label;
    group.appendChild(groupLabel);
    values.forEach(function (value) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = display ? display(value) : value;
      var pressed = state[listKey].indexOf(value) !== -1;
      chip.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      if (pressed) { chip.classList.add('active'); }
      chip.addEventListener('click', function () {
        toggleMembership(state[listKey], value);
        redraw();
      });
      group.appendChild(chip);
    });
    container.appendChild(group);
  }

  function buildCard(row) {
    var bottle = row.bottle, evaluation = row.evaluation;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wine-card' + (quantityOf(bottle) === 0 ? ' dimmed' : '');
    btn.dataset.id = bottle.id;

    var thumb = document.createElement('div');
    thumb.className = 'wine-thumb';
    thumb.style.background = STYLE_COLOR[bottle.style] || STYLE_COLOR.red;
    btn.appendChild(thumb);

    WC.store.getPhoto(bottle.id).then(function (blob) {
      if (!blob) { return; }
      var url = WC.photos.toObjectUrl(blob);
      activeUrls.push(url);
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      thumb.textContent = '';
      thumb.appendChild(img);
    }).catch(function () { /* no photo available — keep the placeholder */ });

    var info = document.createElement('div');
    info.className = 'wine-info';

    var name = document.createElement('div');
    name.className = 'wine-name';
    name.textContent = bottle.name;
    info.appendChild(name);

    var sub = document.createElement('div');
    sub.className = 'wine-sub';
    sub.textContent = WC.format.vintageLabel(bottle.vintage) + ' · ' + evaluation.profile.region;
    info.appendChild(sub);

    var meta = document.createElement('div');
    meta.className = 'wine-meta';
    var slotText = WC.form.formatSlots(bottle.location);
    meta.textContent = WC.format.plural(quantityOf(bottle), 'bottle', 'bottles') +
      (slotText ? ' · ' + slotText : '');
    info.appendChild(meta);

    var peak = document.createElement('div');
    peak.className = 'wine-peak';
    peak.textContent = 'Peak ' + evaluation.window.peakFrom + '–' + evaluation.window.peakTo;
    info.appendChild(peak);

    // A rating of 0 is a real value, so this cannot be a truthiness check —
    // bottle.wineRating || '' would render nothing for it. It also has to
    // agree with ratingSortValue above: with `!== undefined` here, a null or
    // "4.5" from a hand-edited backup rendered as text while sorting as
    // unrated, so the card and the sort disagreed about the same field.
    if (typeof bottle.wineRating === 'number' && isFinite(bottle.wineRating)) {
      var rating = document.createElement('div');
      rating.className = 'wine-rating';
      rating.textContent = 'Rating ' + bottle.wineRating;
      info.appendChild(rating);
    }

    btn.appendChild(info);

    var pill = document.createElement('span');
    pill.className = 'phase-pill phase-' + evaluation.phase;
    pill.textContent = WC.windows.PHASE_LABEL[evaluation.phase];
    btn.appendChild(pill);

    btn.addEventListener('click', function () {
      WC.router.render('bottle', { id: bottle.id });
    });

    return btn;
  }

  function renderList(listEl) {
    revokeThumbnails();
    listEl.textContent = '';
    var rows = filterAndSort(cache, state, new Date().getFullYear());
    if (rows.length === 0) {
      var none = document.createElement('p');
      none.className = 'cellar-empty';
      none.textContent = 'No wines match your search or filters.';
      listEl.appendChild(none);
      return;
    }
    rows.forEach(function (row) { listEl.appendChild(buildCard(row)); });
  }

  function draw(container) {
    container.textContent = '';

    if (cache.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'cellar-empty';
      empty.textContent = 'No wines yet — tap + to add your first bottle.';
      container.appendChild(empty);
      revokeThumbnails();
      return;
    }

    var controls = document.createElement('div');
    controls.className = 'cellar-controls';

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'cellar-search';
    // The haystack also covers appellation and each individual slot, which
    // are the two the owner is most likely to reach for; the placeholder used
    // to advertise only three of the six fields it actually searches.
    search.placeholder = 'Search name, producer, appellation, region or slot…';
    search.value = state.query;
    search.setAttribute('aria-label', 'Search the cellar');
    controls.appendChild(search);

    var chips = document.createElement('div');
    chips.className = 'cellar-chips';
    controls.appendChild(chips);

    var list = document.createElement('div');
    list.className = 'cellar-list';

    var redraw = function () { draw(container); };

    buildChipGroup(chips, 'Phase', Object.keys(WC.windows.PHASE_LABEL), 'phases', redraw, function (p) {
      return WC.windows.PHASE_LABEL[p];
    });
    buildChipGroup(chips, 'Style', distinctValues(cache, 'style'), 'styles', redraw);
    buildChipGroup(chips, 'Country', distinctValues(cache, 'country'), 'countries', redraw);

    var sortRow = document.createElement('div');
    sortRow.className = 'cellar-sort';
    var sortLabel = document.createElement('label');
    sortLabel.textContent = 'Sort';
    var sortSelect = document.createElement('select');
    sortSelect.setAttribute('aria-label', 'Sort order');
    [['urgency', 'Urgency'], ['name', 'Name'], ['vintage', 'Vintage'], ['rating', 'Rating']].forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      if (state.sort === pair[0]) { opt.selected = true; }
      sortSelect.appendChild(opt);
    });
    sortLabel.appendChild(sortSelect);
    sortRow.appendChild(sortLabel);
    controls.appendChild(sortRow);

    container.appendChild(controls);
    container.appendChild(list);

    search.addEventListener('input', function () {
      state.query = search.value;
      renderList(list);
    });
    sortSelect.addEventListener('change', function () {
      state.sort = sortSelect.value;
      renderList(list);
    });

    renderList(list);
  }

  function render(container) {
    return WC.store.allBottles().then(function (bottles) {
      cache = bottles;
      draw(container);
    });
  }

  return {
    filterAndSort: filterAndSort,
    counts: counts,
    render: render
  };
})();
