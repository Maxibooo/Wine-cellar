window.WC = window.WC || {};
WC.bottle = (function () {
  'use strict';

  var STYLE_COLOR = {
    red: '#7a2331', white: '#c9b458', rose: '#d98a9c',
    sparkling: '#bfae7a', sweet: '#caa14a', fortified: '#5a3a1e'
  };

  var PHASE_ORDER = ['too-young', 'approaching', 'at-peak', 'drink-up', 'past-best'];

  function pctOf(year, spanFrom, spanTo) {
    var span = spanTo - spanFrom;
    if (span <= 0) { return 0; }
    var p = (year - spanFrom) / span * 100;
    return Math.max(0, Math.min(100, p));
  }

  // Pure and clock-free: currentYear always comes from the caller, never
  // Date(). Turns the evaluation's four window bounds (readyFrom, peakFrom,
  // peakTo, declineFrom) into a run of contiguous percentage-width segments
  // spanning [spanFrom, spanTo], plus a "today" marker clamped into 0-100.
  //
  // spanFrom anchors on the vintage year, not readyFrom, so a wine that is
  // not yet ready still shows its whole life on the bar (readyFrom is always
  // >= vintage, so anchoring on readyFrom alone would clip the young end).
  // A non-vintage wine has no vintage year to anchor on, so readyFrom (which
  // windows.js sets to the evaluation year for NV) stands in for it.
  function spanFromYear(evaluation) {
    var vintage = evaluation.vintage;
    if (vintage === 'NV' || vintage === undefined || vintage === null) {
      return evaluation.window.readyFrom;
    }
    var parsed = parseInt(vintage, 10);
    return isNaN(parsed) ? evaluation.window.readyFrom : parsed;
  }

  function timelineGeometry(evaluation, currentYear) {
    var win = evaluation.window;
    var vintageYear = spanFromYear(evaluation);

    var spanFrom = Math.min(vintageYear, win.readyFrom) - 1;
    var spanTo = win.declineFrom + Math.max(2, Math.round((win.declineFrom - spanFrom) * 0.1));

    // Boundary years for the five phases, in chronological order. peakTo is
    // inclusive of at-peak and declineFrom is exclusive of drink-up (matching
    // windows.js's phaseFor), so the drink-up band starts the year after
    // peakTo and ends the year before declineFrom.
    var bounds = [spanFrom, win.readyFrom, win.peakFrom, win.peakTo + 1, win.declineFrom, spanTo];

    // Force the boundary sequence to be monotonically non-decreasing before
    // pairing it up into segments. The normal evaluation path keeps
    // declineFrom >= peakTo + 2 (windows.js's own clamp), so peakTo + 1 is
    // always <= declineFrom there and this is a no-op. A manual window
    // override collapses peakTo and declineFrom to the same year, so
    // peakTo + 1 > declineFrom -- without this clamp the at-peak segment
    // (ending at the un-clamped peakTo + 1) would run past where past-best
    // starts (at declineFrom) and the two would overlap on screen. Clamping
    // every bound up to at least the previous one makes every consecutive
    // pair non-overlapping for any window shape, present or future, not
    // just this one override case.
    for (var b = 1; b < bounds.length; b++) {
      bounds[b] = Math.max(bounds[b], bounds[b - 1]);
    }

    var segments = [];
    for (var i = 0; i < PHASE_ORDER.length; i++) {
      var startYear = bounds[i], endYear = bounds[i + 1];
      if (endYear <= startYear) { continue; }
      var startPct = pctOf(startYear, spanFrom, spanTo);
      var endPct = pctOf(endYear, spanFrom, spanTo);
      var widthPct = endPct - startPct;
      if (widthPct <= 0) { continue; }
      // fromYear/toYear are the inclusive first and last year this segment
      // actually covers on the bar, carried here so the legend can print the
      // bar's own bounds instead of re-deriving them from the window. The
      // boundary pairs above are half-open ([startYear, endYear)), which is
      // why the last year is endYear - 1: the legend used to read the raw
      // peakTo/declineFrom instead, and printed the same year under both
      // "At peak" and "Drink up".
      segments.push({
        phase: PHASE_ORDER[i],
        startPct: startPct,
        widthPct: widthPct,
        fromYear: startYear,
        toYear: endYear - 1
      });
    }

    return {
      spanFrom: spanFrom,
      spanTo: spanTo,
      segments: segments,
      nowPct: pctOf(currentYear, spanFrom, spanTo)
    };
  }

  // Decrements the bottle's quantity (never below zero) and writes a drink
  // log entry carrying the wine's name and vintage copied at this moment, so
  // the history entry stays meaningful even after the bottle record is later
  // edited or deleted. Starts from the full stored record (not a freshly
  // built object) so fields this module doesn't know about -- windowOverride,
  // aiNotes, photoId, whatever a later task adds -- survive the write.
  function drinkOne(bottleId, entry) {
    return WC.store.getBottle(bottleId).then(function (bottle) {
      if (!bottle) { throw new Error('Bottle not found: ' + bottleId); }
      var updated = {};
      Object.keys(bottle).forEach(function (k) { updated[k] = bottle[k]; });
      var current = typeof bottle.quantity === 'number' ? bottle.quantity : 0;
      updated.quantity = Math.max(0, current - 1);

      // Slots and quantity are allowed to disagree -- the slot list can run
      // out while quantity remains (a bottle moved or unshelved), and that
      // must not block drinking. An unknown slot name is simply not found
      // and leaves the list untouched, never throws.
      if (entry && entry.slot) {
        var slots = WC.form.parseSlots(bottle.location);
        var idx = slots.indexOf(entry.slot);
        if (idx !== -1) { slots.splice(idx, 1); }
        // One stored representation of "no slots", not two: form.js deletes
        // the key when the owner clears the field, so an emptied list here
        // must delete it too rather than leaving [] behind as a second
        // spelling of the same state for every consumer to handle.
        if (slots.length > 0) { updated.location = slots; }
        else { delete updated.location; }
      }

      var drinkEntry = {};
      Object.keys(entry || {}).forEach(function (k) { drinkEntry[k] = entry[k]; });
      // The slot says where the bottle sat, not how it tasted -- it has no
      // place in the drink history.
      delete drinkEntry.slot;
      drinkEntry.bottleId = bottleId;
      drinkEntry.wineName = bottle.name;
      drinkEntry.vintage = bottle.vintage;

      // Two sequential transactions, and IndexedDB gives us no way to make
      // them one. If the second fails the first has already committed: the
      // quantity is down by one and no history entry exists for it. That
      // partial state cannot be prevented here, so it is at least reported
      // accurately -- the rejection is tagged so the caller can tell the
      // owner what did happen, rather than a message implying nothing did.
      return WC.store.putBottle(updated).then(function () {
        return WC.store.putDrink(drinkEntry).then(null, function (err) {
          var failure = new Error(WC.errors.errorMessage(err, 'storage is unavailable.'));
          if (err && typeof err.name === 'string') { failure.name = err.name; }
          if (err && err.code !== undefined) { failure.code = err.code; }
          failure.quantityAlreadyReduced = true;
          throw failure;
        });
      });
    });
  }

  // --- render ----------------------------------------------------------------

  // Tracks the one photo object URL the detail screen ever has open at a
  // time, so a re-render (drink logged, window saved, navigating back in)
  // always revokes the previous URL before creating the next one.
  var photoUrl = null;
  function revokePhoto() {
    if (photoUrl) { WC.photos.revoke(photoUrl); photoUrl = null; }
  }

  function todayIso() {
    var d = new Date();
    var mm = String(d.getMonth() + 1);
    if (mm.length < 2) { mm = '0' + mm; }
    var dd = String(d.getDate());
    if (dd.length < 2) { dd = '0' + dd; }
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function textRow(parent, text, className) {
    var p = document.createElement('p');
    if (className) { p.className = className; }
    p.textContent = text;
    parent.appendChild(p);
    return p;
  }

  function buildTimeline(evaluation, geometry, currentYear) {
    var section = document.createElement('div');
    section.className = 'timeline';

    if (evaluation.confidence === 'fallback') {
      textRow(section, 'Estimated window — this region is not in the reference data.', 'timeline-caveat');
    } else if (evaluation.confidence === 'override') {
      textRow(section, 'This is your own drinking window, not an estimate.', 'timeline-caveat');
    }

    var bar = document.createElement('div');
    bar.className = 'timeline-bar';
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label',
      'Drinking window from ' + geometry.spanFrom + ' to ' + geometry.spanTo + '. Today is ' + currentYear + '.');

    geometry.segments.forEach(function (seg) {
      var segEl = document.createElement('div');
      segEl.className = 'timeline-segment phase-' + seg.phase;
      segEl.style.left = seg.startPct + '%';
      segEl.style.width = seg.widthPct + '%';
      bar.appendChild(segEl);
    });

    var marker = document.createElement('div');
    marker.className = 'timeline-now';
    marker.style.left = geometry.nowPct + '%';
    var markerLabel = document.createElement('span');
    markerLabel.className = 'timeline-now-label';
    markerLabel.textContent = 'Today · ' + currentYear;
    marker.appendChild(markerLabel);
    bar.appendChild(marker);

    section.appendChild(bar);

    var bounds = document.createElement('div');
    bounds.className = 'timeline-bounds';
    var left = document.createElement('span');
    left.textContent = String(geometry.spanFrom);
    var right = document.createElement('span');
    right.textContent = String(geometry.spanTo);
    bounds.appendChild(left);
    bounds.appendChild(right);
    section.appendChild(bounds);

    // A text legend so the phases read without relying on segment colour --
    // each entry names the phase and the actual year range it covers.
    //
    // The years come from the segment the bar was drawn from, never from the
    // window bounds directly: reading raw peakTo/declineFrom here while the
    // bar's own boundary used peakTo + 1 is what made a normal window print
    // "At peak: 2030-2040" and "Drink up: 2040-2042", claiming 2040 twice.
    // Deriving both from one source means text and bar cannot disagree.
    var legend = document.createElement('ul');
    legend.className = 'timeline-legend';
    geometry.segments.forEach(function (seg) {
      var item = document.createElement('li');
      var years = seg.fromYear === seg.toYear
        ? String(seg.fromYear)
        : seg.fromYear + '–' + seg.toYear;
      item.textContent = WC.windows.PHASE_LABEL[seg.phase] + ': ' + years;
      legend.appendChild(item);
    });
    section.appendChild(legend);

    return section;
  }

  function buildServingPanel(bottle, profile, unit, currency) {
    var panel = document.createElement('div');
    panel.className = 'serving-panel';

    var heading = document.createElement('h3');
    heading.textContent = 'Serving';
    panel.appendChild(heading);

    textRow(panel, 'Temperature: ' + WC.format.tempRange(profile.tempC, unit));
    textRow(panel, WC.format.decant(profile.decantMin));
    textRow(panel, 'Glass: ' + profile.glass);
    if (profile.pairings && profile.pairings.length) {
      textRow(panel, 'Pairs with: ' + profile.pairings.join(', '));
    }
    if (typeof bottle.price === 'number') {
      textRow(panel, 'Price: ' + WC.format.money(bottle.price, currency));
    }
    if (bottle.purchasedOn) {
      textRow(panel, 'Purchased: ' + bottle.purchasedOn);
    }

    return panel;
  }

  function buildAiNotes(aiNotes) {
    var section = document.createElement('div');
    section.className = 'ai-notes';
    var heading = document.createElement('h3');
    heading.textContent = 'AI notes';
    section.appendChild(heading);

    if (aiNotes.character) { textRow(section, aiNotes.character); }
    if (aiNotes.drinkingWindow) { textRow(section, 'Window: ' + aiNotes.drinkingWindow); }
    if (aiNotes.serving) { textRow(section, 'Serving: ' + aiNotes.serving); }
    if (aiNotes.pairings) {
      var pairingsText = Array.isArray(aiNotes.pairings) ? aiNotes.pairings.join(', ') : aiNotes.pairings;
      textRow(section, 'Pairings: ' + pairingsText);
    }
    if (aiNotes.fetchedAt) { textRow(section, 'Fetched ' + aiNotes.fetchedAt, 'ai-notes-meta'); }

    return section;
  }

  // Pure and clock-free: validates one typed drink score against the scale
  // in force and REPORTS, rather than transforming. v1 clamped this value,
  // and v2 dropped the default ceiling from 100 to 20 -- so a score typed
  // from /100 muscle memory (the scale the owner's entire prior history was
  // recorded on) was silently rewritten to 20 and then rendered "20/20",
  // indistinguishable from a genuine perfect score. A non-numeric entry was
  // dropped just as quietly: no rating written, no message, drink logged.
  //
  // That mattered more than an ordinary validation gap because the drink log
  // is append-only -- store.js exports no deleteDrink and history.js has no
  // edit path, so a misrecorded score can only be corrected by export, hand-
  // editing the JSON, clear-all and re-import. It was also the only place on
  // this branch where owner-supplied input was silently transformed instead
  // of reported; wineRating, the same class of out-of-range number, has
  // always got an inline error beside its field. This mirrors form.js's
  // validateWineRating so the two behave alike.
  //
  // An empty score stays valid: unrated is a legitimate state. A score of 0
  // is a real score, so emptiness is checked as text before any numeric
  // falsiness could swallow it. Nothing is rounded -- rounding would be one
  // more silent transformation of a number the owner typed.
  //
  // `badInput` is why this takes three arguments. On an <input type="number">
  // a non-numeric entry never reaches us as text at all: the browser's value
  // sanitisation makes .value read '' while validity.badInput goes true. So
  // "typed something that is not a number" and "deliberately left empty" are
  // the SAME .value, and reading .value alone cannot tell them apart -- which
  // is exactly how a non-numeric score used to log a drink with no score and
  // no message. It is passed in rather than read off the element here so the
  // whole decision stays pure and directly testable. Checked first, because
  // bad input arrives wearing an empty value.
  function validateDrinkRating(raw, scale, badInput) {
    var text = raw === undefined || raw === null ? '' : String(raw).trim();
    if (badInput) {
      return {
        valid: false,
        error: 'Give a score between 0 and ' + scale + ', or leave it empty.',
        rating: undefined
      };
    }
    if (text === '') { return { valid: true, error: '', rating: undefined }; }
    var n = Number(text);
    if (!isFinite(n) || n < 0 || n > scale) {
      return {
        valid: false,
        error: 'Give a score between 0 and ' + scale + ', or leave it empty.',
        rating: undefined
      };
    }
    return { valid: true, error: '', rating: n };
  }

  function buildDrinkForm(bottle, ratingScale) {
    var scale = WC.history.scaleOf(ratingScale);
    var wrap = document.createElement('div');
    wrap.className = 'drink-form';
    wrap.hidden = true;

    // The slot picker only appears when there is an actual choice to make --
    // one slot (or none) means there's nothing to ask, and no `slot` is
    // passed to drinkOne. With more than one, the choice is required: an
    // unselected placeholder option plus an inline message that blocks
    // submission until the owner picks one.
    var slots = WC.form.parseSlots(bottle.location);
    var slotSelect = null;
    var slotError = null;
    if (slots.length > 1) {
      var slotField = document.createElement('label');
      slotField.className = 'field-label';
      slotField.textContent = 'Which slot?';
      slotSelect = document.createElement('select');
      slotSelect.className = 'form-input';
      slotSelect.required = true;
      var placeholderOpt = document.createElement('option');
      placeholderOpt.value = '';
      placeholderOpt.textContent = 'Choose a slot…';
      slotSelect.appendChild(placeholderOpt);
      slots.forEach(function (slot) {
        var opt = document.createElement('option');
        opt.value = slot;
        opt.textContent = slot;
        slotSelect.appendChild(opt);
      });
      slotField.appendChild(slotSelect);
      wrap.appendChild(slotField);
      slotError = document.createElement('div');
      slotError.className = 'field-error drink-slot-error';
      wrap.appendChild(slotError);
    }

    var dateField = document.createElement('label');
    dateField.className = 'field-label';
    dateField.textContent = 'Drunk on';
    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'form-input';
    dateInput.value = todayIso();
    dateField.appendChild(dateInput);
    wrap.appendChild(dateField);

    var ratingField = document.createElement('label');
    ratingField.className = 'field-label';
    ratingField.textContent = 'Score / ' + scale;
    var ratingInput = document.createElement('input');
    ratingInput.type = 'number';
    ratingInput.className = 'form-input';
    ratingInput.min = '0';
    ratingInput.max = String(scale);
    ratingField.appendChild(ratingInput);
    wrap.appendChild(ratingField);
    var ratingError = document.createElement('div');
    ratingError.className = 'field-error drink-rating-error';
    wrap.appendChild(ratingError);

    // Three states -- unanswered, yes, no -- and unanswered must stay
    // distinguishable from "no" on the saved entry: buyAgain is only
    // written onto entry when the owner actually picked yes or no.
    var buyAgainField = document.createElement('label');
    buyAgainField.className = 'field-label';
    buyAgainField.textContent = 'Buy again?';
    var buyAgainSelect = document.createElement('select');
    buyAgainSelect.className = 'form-input';
    [['', 'Not answered'], ['yes', 'Yes'], ['no', 'No']].forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      buyAgainSelect.appendChild(opt);
    });
    buyAgainField.appendChild(buyAgainSelect);
    wrap.appendChild(buyAgainField);

    var notesField = document.createElement('label');
    notesField.className = 'field-label';
    notesField.textContent = 'Notes';
    var notesInput = document.createElement('textarea');
    notesInput.className = 'form-input';
    notesField.appendChild(notesInput);
    wrap.appendChild(notesField);

    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Log it';
    submitBtn.addEventListener('click', function () {
      ratingError.textContent = '';
      if (slotSelect) {
        slotError.textContent = '';
        if (!slotSelect.value) {
          slotError.textContent = 'Choose which slot this bottle came from.';
          return;
        }
      }
      // Reported and refused BEFORE the store is touched, exactly as the
      // required-slot check above does. There is deliberately no clamp left
      // on this path: an out-of-range value returns here, so a clamp could
      // only ever be dead code hiding the same silent transformation.
      var score = validateDrinkRating(
        ratingInput.value, scale,
        !!(ratingInput.validity && ratingInput.validity.badInput)
      );
      if (!score.valid) {
        ratingError.textContent = score.error;
        return;
      }
      var entry = { drunkOn: dateInput.value || todayIso() };
      if (score.rating !== undefined) {
        entry.rating = score.rating;
        entry.ratingScale = scale;
      }
      // Absent must stay distinguishable from a "no" -- buyAgain is written
      // only when the owner actually chose yes or no.
      if (buyAgainSelect.value === 'yes') { entry.buyAgain = true; }
      else if (buyAgainSelect.value === 'no') { entry.buyAgain = false; }
      var notesRaw = notesInput.value.trim();
      if (notesRaw) { entry.notes = notesRaw; }
      if (slotSelect) { entry.slot = slotSelect.value; }

      drinkOne(bottle.id, entry).then(function () {
        WC.app.toast('Logged.');
        return WC.router.render('bottle', { id: bottle.id });
      }, function (err) {
        // The bottle count and the history entry are written separately, so
        // say which of the two actually landed.
        if (err && err.quantityAlreadyReduced) {
          // The error's own text is whatever the browser wrote and may not
          // end a sentence, so close it before adding one.
          var reported = WC.errors.saveFailureMessage(err, 'this drink in your history');
          if (!/[.!?]$/.test(reported)) { reported += '.'; }
          WC.app.toast(reported + ' The bottle count was already reduced by one.');
          // The displayed count is stale now, and the owner needs to see the
          // state they are really in before deciding what to do next.
          return WC.router.render('bottle', { id: bottle.id });
        }
        // Nothing was written at all: the filled-in form is left exactly as
        // it stands so the owner can simply tap Log it again.
        WC.app.toast(WC.errors.saveFailureMessage(err, 'this drink'));
        return null;
      });
    });
    wrap.appendChild(submitBtn);

    return wrap;
  }

  function buildActions(bottle, ratingScale) {
    var actions = document.createElement('div');
    actions.className = 'bottle-actions';

    // --- Drink one -----------------------------------------------------------
    var drinkBtn = document.createElement('button');
    drinkBtn.type = 'button';
    drinkBtn.className = 'btn-primary';
    drinkBtn.textContent = 'Drink one';
    var drinkFormWrap = buildDrinkForm(bottle, ratingScale);
    drinkBtn.addEventListener('click', function () {
      drinkFormWrap.hidden = !drinkFormWrap.hidden;
    });
    actions.appendChild(drinkBtn);
    actions.appendChild(drinkFormWrap);

    // --- Edit ------------------------------------------------------------------
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-secondary';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function () {
      WC.router.render('form', { id: bottle.id });
    });
    actions.appendChild(editBtn);

    // --- Get AI notes ---------------------------------------------------------
    var aiBtn = document.createElement('button');
    aiBtn.type = 'button';
    aiBtn.className = 'btn-ai';
    aiBtn.textContent = 'Get AI notes';
    aiBtn.addEventListener('click', function () {
      WC.settings.load().then(function (s) {
        if (!s.apiKey) {
          WC.app.toast('Add an API key in Settings to use AI.');
          return;
        }
        aiBtn.disabled = true;
        var originalLabel = aiBtn.textContent;
        aiBtn.textContent = 'Fetching…';
        function restoreButton() {
          aiBtn.disabled = false;
          aiBtn.textContent = originalLabel;
        }
        return WC.ai.notes(bottle, s.apiKey).then(function (result) {
          // Everything from here on is storage, not the network. The single
          // rejection arm this chain used to end with covered both, so a
          // failed write toasted "Could not fetch AI notes." after a call
          // that had in fact succeeded -- teaching the owner to distrust the
          // AI for a storage problem, and to retry (and pay for) a request
          // that was never the thing that broke.
          // Re-reads the current stored record rather than reusing the
          // `bottle` this render closed over -- putBottle replaces the whole
          // record, and starting from a snapshot that might be stale (or
          // just missing fields this module never learned about, like
          // location or windowOverride) is exactly how an earlier task lost
          // the owner's cellar location. Merging onto a fresh read keeps
          // every other field intact no matter what changed underneath.
          return WC.store.getBottle(bottle.id).then(function (current) {
            // Deleted while the request was in flight. The old fallback here
            // wrote the closed-over snapshot back, which resurrected a
            // bottle the owner had just deleted -- with AI notes attached.
            if (!current) {
              restoreButton();
              WC.app.toast('That bottle was deleted while the notes were being fetched.');
              return null;
            }
            var updated = {};
            Object.keys(current).forEach(function (k) { updated[k] = current[k]; });
            updated.aiNotes = {
              fetchedAt: new Date().toISOString(),
              character: result.character,
              drinkingWindow: result.drinkingWindow,
              serving: result.serving,
              pairings: result.pairings
            };
            return WC.store.putBottle(updated).then(function () {
              // Re-render through the router (not just drawBottle directly)
              // so #cellar-counts -- which only refreshes on
              // WC.router.render -- does not go stale after this write. This
              // redraws the whole detail screen (a fresh, enabled aiBtn
              // included), so there is nothing left to reset on the button
              // this closure captured.
              return WC.router.render('bottle', { id: bottle.id });
            });
          }).then(null, function (err) {
            // A storage failure, named as one. The notes themselves arrived
            // fine; they just could not be kept.
            restoreButton();
            WC.app.toast(WC.errors.saveFailureMessage(err, 'the AI notes'));
          });
        }, function () {
          restoreButton();
          WC.app.toast('Could not fetch AI notes.');
        });
      }, function (err) {
        // Without this arm a failed settings read leaves the button dead:
        // it is the read that decides whether there is a key to use at all.
        WC.app.toast(WC.errors.readFailureMessage(err, 'your settings'));
      });
    });
    actions.appendChild(aiBtn);

    // --- Delete (confirm first, then remove the bottle and its photo) ----------
    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-danger';
    deleteBtn.textContent = 'Delete';

    var confirmWrap = document.createElement('div');
    confirmWrap.className = 'delete-confirm';
    confirmWrap.hidden = true;
    textRow(confirmWrap, 'Delete this bottle and its photo? This cannot be undone.');
    var confirmYes = document.createElement('button');
    confirmYes.type = 'button';
    confirmYes.className = 'btn-danger';
    confirmYes.textContent = 'Yes, delete';
    var confirmNo = document.createElement('button');
    confirmNo.type = 'button';
    confirmNo.className = 'btn-secondary';
    confirmNo.textContent = 'Cancel';
    confirmWrap.appendChild(confirmYes);
    confirmWrap.appendChild(confirmNo);

    deleteBtn.addEventListener('click', function () {
      confirmWrap.hidden = !confirmWrap.hidden;
    });
    confirmNo.addEventListener('click', function () {
      confirmWrap.hidden = true;
    });
    confirmYes.addEventListener('click', function () {
      WC.store.deletePhoto(bottle.id).catch(function () { /* no photo to remove */ }).then(function () {
        return WC.store.deleteBottle(bottle.id);
      }).then(function () {
        WC.app.toast('Deleted.');
        return WC.router.render('cellar');
      }, function (err) {
        // The bottle is still there. Saying so beats a confirm button that
        // simply stops responding, which reads as "deleted" to the owner.
        WC.app.toast('Could not delete this bottle — ' +
          WC.errors.errorMessage(err, 'storage is unavailable.') + ' It is still in your cellar.');
      });
    });

    actions.appendChild(deleteBtn);
    actions.appendChild(confirmWrap);

    return actions;
  }

  function buildWindowOverride(bottle) {
    var section = document.createElement('div');
    section.className = 'window-override';
    var heading = document.createElement('h3');
    heading.textContent = 'Set my own window';
    section.appendChild(heading);

    var row = document.createElement('div');
    row.className = 'window-override-row';

    var startInput = document.createElement('input');
    startInput.type = 'number';
    startInput.className = 'form-input';
    startInput.placeholder = 'Ready from';
    startInput.setAttribute('aria-label', 'Window start year');
    if (bottle.windowOverride && bottle.windowOverride.start) {
      startInput.value = String(bottle.windowOverride.start);
    }

    var endInput = document.createElement('input');
    endInput.type = 'number';
    endInput.className = 'form-input';
    endInput.placeholder = 'Drink by';
    endInput.setAttribute('aria-label', 'Window end year');
    if (bottle.windowOverride && bottle.windowOverride.end) {
      endInput.value = String(bottle.windowOverride.end);
    }

    row.appendChild(startInput);
    row.appendChild(endInput);
    section.appendChild(row);

    var actionsRow = document.createElement('div');
    actionsRow.className = 'window-override-actions';

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-secondary';
    saveBtn.textContent = 'Save my window';
    saveBtn.addEventListener('click', function () {
      var start = parseInt(startInput.value, 10);
      var end = parseInt(endInput.value, 10);
      if (isNaN(start) || isNaN(end)) {
        WC.app.toast('Enter a start and end year.');
        return;
      }
      if (start >= end) {
        WC.app.toast('The start year must be before the end year.');
        return;
      }
      // Start from the full stored record so fields this control doesn't own
      // (name, quantity, aiNotes, everything) survive the write untouched --
      // putBottle replaces the whole record, so a freshly built object here
      // would silently drop them.
      var updated = {};
      Object.keys(bottle).forEach(function (k) { updated[k] = bottle[k]; });
      updated.windowOverride = { start: start, end: end };
      WC.store.putBottle(updated).then(function () {
        WC.app.toast('Saved.');
        return WC.router.render('bottle', { id: bottle.id });
      }, function (err) {
        WC.app.toast(WC.errors.saveFailureMessage(err, 'your drinking window'));
      });
    });
    actionsRow.appendChild(saveBtn);

    if (bottle.windowOverride) {
      var clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn-secondary';
      clearBtn.textContent = 'Use the estimated window';
      clearBtn.addEventListener('click', function () {
        var updated = {};
        Object.keys(bottle).forEach(function (k) { updated[k] = bottle[k]; });
        delete updated.windowOverride;
        WC.store.putBottle(updated).then(function () {
          WC.app.toast('Saved.');
          return WC.router.render('bottle', { id: bottle.id });
        }, function (err) {
          WC.app.toast(WC.errors.saveFailureMessage(err, 'the change back to the estimated window'));
        });
      });
      actionsRow.appendChild(clearBtn);
    }

    section.appendChild(actionsRow);
    return section;
  }

  function drawBottle(container, bottle, photoBlob, unit, currency, ratingScale) {
    var currentYear = new Date().getFullYear();
    var evaluation = WC.windows.evaluate(bottle, currentYear);
    var profile = evaluation.profile;
    var geometry = timelineGeometry(evaluation, currentYear);

    var wrap = document.createElement('div');
    wrap.className = 'bottle-detail';

    var photo = document.createElement('div');
    photo.className = 'bottle-photo';
    photo.style.background = STYLE_COLOR[bottle.style] || STYLE_COLOR.red;
    if (photoBlob) {
      photoUrl = WC.photos.toObjectUrl(photoBlob);
      var img = document.createElement('img');
      img.src = photoUrl;
      img.alt = '';
      photo.appendChild(img);
    }
    wrap.appendChild(photo);

    var name = document.createElement('h2');
    name.className = 'bottle-name';
    name.textContent = bottle.name;
    wrap.appendChild(name);

    var subParts = [WC.format.vintageLabel(bottle.vintage), profile.region];
    if (bottle.appellation) { subParts.push(bottle.appellation); }
    subParts.push(profile.country);
    // A rating of 0 is a real value the owner recorded, not an absent one,
    // so this cannot be a truthiness check. `!== undefined` was too loose in
    // the other direction, though: it disagreed with cellar.js's rating sort
    // (typeof === 'number'), so a null or "4.5" out of a hand-edited backup
    // rendered as text while sorting as unrated. history.js gets the parallel
    // case right with typeof + isFinite in both its places; this matches it.
    if (typeof bottle.wineRating === 'number' && isFinite(bottle.wineRating)) {
      subParts.push('Rating ' + bottle.wineRating);
    }
    textRow(wrap, subParts.join(' · '), 'bottle-sub');

    var grapes = bottle.grapes && bottle.grapes.length ? bottle.grapes : profile.grapes;
    if (grapes && grapes.length) {
      textRow(wrap, grapes.join(', '), 'bottle-grapes');
    }

    var qty = typeof bottle.quantity === 'number' ? bottle.quantity : 0;
    var slotText = WC.form.formatSlots(bottle.location);
    textRow(wrap, WC.format.plural(qty, 'bottle', 'bottles') + (slotText ? ' · ' + slotText : ''), 'bottle-meta');

    var phaseRow = document.createElement('div');
    phaseRow.className = 'bottle-phase-row';
    var pill = document.createElement('span');
    pill.className = 'phase-pill phase-' + evaluation.phase;
    pill.textContent = WC.windows.PHASE_LABEL[evaluation.phase];
    phaseRow.appendChild(pill);
    var message = document.createElement('span');
    message.className = 'bottle-message';
    message.textContent = evaluation.message;
    phaseRow.appendChild(message);
    wrap.appendChild(phaseRow);

    wrap.appendChild(buildTimeline(evaluation, geometry, currentYear));
    wrap.appendChild(buildServingPanel(bottle, profile, unit, currency));

    if (bottle.notes) {
      var notesHeading = document.createElement('h3');
      notesHeading.textContent = 'Notes';
      wrap.appendChild(notesHeading);
      textRow(wrap, bottle.notes, 'bottle-notes');
    }

    if (bottle.aiNotes) {
      wrap.appendChild(buildAiNotes(bottle.aiNotes));
    }

    wrap.appendChild(buildActions(bottle, ratingScale));
    wrap.appendChild(buildWindowOverride(bottle));

    container.textContent = '';
    container.appendChild(wrap);
  }

  function render(container, id) {
    revokePhoto();
    return WC.store.getBottle(id).then(function (bottle) {
      if (!bottle) {
        container.textContent = '';
        var p = document.createElement('p');
        p.className = 'screen-placeholder';
        p.textContent = 'Bottle not found.';
        container.appendChild(p);
        return;
      }
      // WC.settings.load() rather than two raw getSetting reads with inline
      // '|| C' / '|| €' fallbacks: those duplicated WC.settings.defaults,
      // which is the one place the defaults are supposed to live (and which
      // the AI button in this same file already goes through).
      return Promise.all([
        WC.store.getPhoto(bottle.id).catch(function () { return null; }),
        WC.settings.load()
      ]).then(function (results) {
        drawBottle(container, bottle, results[0], results[1].unit, results[1].currency, results[1].ratingScale);
      });
    });
  }

  return {
    timelineGeometry: timelineGeometry,
    validateDrinkRating: validateDrinkRating,
    drinkOne: drinkOne,
    render: render
  };
})();
