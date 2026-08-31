window.WC = window.WC || {};
WC.form = (function () {
  'use strict';

  var STYLES = ['red', 'white', 'rose', 'sparkling', 'sweet', 'fortified'];

  // --- validate ------------------------------------------------------------

  function isDigits(s) { return /^\d+$/.test(s); }

  function validateVintage(raw, currentYear, errors) {
    var v = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!v) { errors.vintage = 'Vintage is required.'; return undefined; }
    if (v.toUpperCase() === 'NV') { return 'NV'; }
    if (!isDigits(v)) { errors.vintage = 'Vintage must be a year or NV.'; return undefined; }
    var year = parseInt(v, 10);
    if (year < 1900 || year > currentYear + 1) {
      errors.vintage = 'Vintage must be between 1900 and ' + (currentYear + 1) + '.';
      return undefined;
    }
    return year;
  }

  function validateQuantity(raw, errors) {
    if (raw === undefined || raw === null || String(raw).trim() === '') { return 1; }
    var v = String(raw).trim();
    if (!/^-?\d+$/.test(v)) { errors.quantity = 'Quantity must be a whole number.'; return undefined; }
    var n = parseInt(v, 10);
    if (n < 0) { errors.quantity = 'Quantity cannot be negative.'; return undefined; }
    return n;
  }

  function validatePrice(raw, errors) {
    if (raw === undefined || raw === null || String(raw).trim() === '') { return undefined; }
    var n = Number(raw);
    if (isNaN(n)) { errors.price = 'Price must be a number.'; return undefined; }
    return n;
  }

  // Pure and clock-free: widens `location` to a list without a migration
  // step. Accepts an array (trimmed, empties dropped), a comma-separated
  // string (split, trimmed, empties dropped), or anything else -- undefined,
  // a number, whatever a hand-edited backup might contain -- as an empty
  // list. This is the one place that reads a raw location value; cellar.js
  // and bottle.js both route through it (or through formatSlots, which is
  // built on it) so a legacy string and a real list are never told apart
  // twice, in two places, with two chances to disagree.
  function parseSlots(value) {
    var raw;
    if (Array.isArray(value)) { raw = value; }
    else if (typeof value === 'string') { raw = value.split(','); }
    else { return []; }
    return raw.map(function (s) { return String(s).trim(); })
              .filter(function (s) { return s.length > 0; });
  }

  // The one comma-joined display/edit string for a slot list -- '' for an
  // empty or absent list. Built on parseSlots so a legacy string location
  // formats exactly as the list it would parse into.
  function formatSlots(slots) {
    return parseSlots(slots).join(', ');
  }

  // Chooses which knowledge-base row an AI region guess should auto-fill.
  // WC.knowledge.search returns matches in definition order, so blindly taking
  // matches[0] is a first-hit tiebreak: a bare "Canada" guess would land on
  // canadian-icewine (declared first, sweet, a 55-year curve) even for a dry
  // Ontario Riesling, and a bare "Margaret River"/"Hawke's Bay" on the red
  // over the white. `matches` are WC.knowledge summaries ({key, style, ...});
  // `aiStyle` is the style the identify call returned alongside the region.
  function pickRegionMatch(matches, aiStyle) {
    if (!matches || !matches.length) { return null; }
    if (aiStyle) {
      // Prefer a row whose style agrees with the AI's own style guess, so a
      // bare "Canada" resolves to the row the AI actually meant (dry Riesling
      // for a white guess, icewine for a sweet one) rather than whichever was
      // declared first.
      var agreeing = matches.filter(function (m) { return m.style === aiStyle; });
      if (agreeing.length) { return agreeing[0].key; }
      // The AI gave a style and no listed row for this region carries it.
      // Auto-filling the first-declared row anyway is exactly how a dry wine
      // lands on a dessert-wine curve, so apply nothing and leave the field.
      return null;
    }
    // No style to disambiguate on. The identify schema requires one, so this
    // is a defensive path only; with nothing better to go on, use the first.
    return matches[0].key;
  }

  // Mirrors validatePrice's !== undefined shape rather than a truthy check:
  // a rating of 0 is the bottom of the Vivino scale, a real value the owner
  // recorded, not an absent one. Rounded to one decimal place to match the
  // scale the owner already uses.
  function validateWineRating(raw, errors) {
    var ratingRaw = raw === undefined || raw === null ? '' : String(raw).trim();
    if (ratingRaw === '') { return undefined; }
    var n = Number(ratingRaw);
    if (!isFinite(n) || n < 0 || n > 5) {
      errors.wineRating = 'Give a rating between 0 and 5, or leave it empty.';
      return undefined;
    }
    return Math.round(n * 10) / 10;
  }

  // Pure and clock-free: currentYear always comes from the caller so tests
  // can pin it. Builds the errors map first; bottle is only assembled when
  // there are no errors, so a partially-coerced bottle never leaks out.
  function validate(values, currentYear) {
    var v = values || {};
    var errors = {};

    var name = String(v.name === undefined || v.name === null ? '' : v.name).trim();
    if (!name) { errors.name = 'Name is required.'; }

    var vintage = validateVintage(v.vintage, currentYear, errors);

    var region = String(v.region === undefined || v.region === null ? '' : v.region).trim();
    if (!region) { errors.region = 'Region is required.'; }

    var style = String(v.style === undefined || v.style === null ? '' : v.style).trim();
    if (!style) { errors.style = 'Style is required.'; }

    var quantity = validateQuantity(v.quantity, errors);
    var price = validatePrice(v.price, errors);
    var wineRating = validateWineRating(v.wineRating, errors);

    var hasErrors = Object.keys(errors).length > 0;
    var bottle = null;

    if (!hasErrors) {
      var profile = WC.knowledge.get(region, style);
      bottle = {
        name: name,
        vintage: vintage,
        region: region,
        style: style,
        country: profile.country,
        quantity: quantity
      };
      if (v.producer) { bottle.producer = String(v.producer).trim(); }
      if (v.appellation) { bottle.appellation = String(v.appellation).trim(); }
      if (v.tier) { bottle.tier = v.tier; }
      if (wineRating !== undefined) { bottle.wineRating = wineRating; }
      var slots = parseSlots(v.location);
      if (slots.length > 0) { bottle.location = slots; }
      if (price !== undefined) { bottle.price = price; }
      if (v.purchasedOn) { bottle.purchasedOn = v.purchasedOn; }
      if (v.notes) { bottle.notes = String(v.notes).trim(); }
      if (v.grapes) {
        var grapesStr = String(v.grapes).trim();
        if (grapesStr) {
          bottle.grapes = grapesStr.split(',').map(function (g) { return g.trim(); }).filter(function (g) { return g; });
        }
      }
    }

    return { valid: !hasErrors, errors: errors, bottle: bottle };
  }

  // Style/grapes are looked up straight from the profile the region key maps
  // to; the style argument to knowledge.get only matters for the fallback
  // path (an unknown region key), which never applies here since regionKey
  // always comes from a real knowledge.profiles entry.
  function prefillFromRegion(regionKey) {
    var profile = WC.knowledge.get(regionKey);
    return { style: profile.style, grapes: profile.grapes, tier: 'good' };
  }

  // Pure: which fields a freshly-opened form must already treat as the
  // owner's own values, so the region prefill never overwrites them.
  //
  // `dirty` used to start empty on an edit, which meant selectRegion() --
  // whose whole guard is `if (!dirty.tier)` -- silently reset the stored
  // tier to the generic 'good' (and style and grapes with it) the moment the
  // owner corrected an unrelated field like the region. Tier is the single
  // most informative input the owner gives, so a quiet downgrade during an
  // unrelated edit is data loss, not a cosmetic reset.
  //
  // Driven by what is actually populated on the record rather than by "this
  // is an edit": a bottle stored with no tier at all (or with the field left
  // empty) still gets the prefill it should. A stored 0 (quantity, price) is
  // a real value the owner chose, so it counts as populated.
  //
  // Every form-owned field belongs here, whether or not a prefill guards on
  // it today. appellation and wineRating were the only two missing: harmless
  // while nothing reads dirty.appellation or dirty.wineRating, but the list
  // exists precisely so that a stored value cannot be reset by the region
  // prefill during an unrelated edit -- a bug this app has already shipped
  // once, against tier. js/ai.js already asks the AI for an appellation and
  // discards it, so the moment that answer is wired into selectRegion or the
  // AI-fill block behind the same `if (!dirty.X)` guard the neighbours use,
  // the owner's stored appellation would be overwritten while they corrected
  // an unrelated region -- on a field they have on 70 of their 72 wines.
  var SEEDED_FIELDS = [
    'name', 'producer', 'vintage', 'region', 'appellation', 'style', 'tier',
    'quantity', 'location', 'price', 'purchasedOn', 'notes', 'wineRating'
  ];

  function initialDirty(bottle) {
    var dirty = {};
    if (!bottle) { return dirty; }
    SEEDED_FIELDS.forEach(function (f) {
      var value = bottle[f];
      if (value !== undefined && value !== null && value !== '') { dirty[f] = true; }
    });
    if (bottle.grapes && bottle.grapes.length) { dirty.grapes = true; }
    return dirty;
  }

  // The fields this form owns. Everything else on a stored bottle record —
  // id, createdAt, photoId, and any field a later task adds (windowOverride,
  // aiNotes, a rating, a consumed flag, whatever) — is not this form's
  // business and must ride through a save untouched. Every field validate()
  // can set on its returned bottle must be listed here (a test pins this
  // correspondence — see form.test.js). Frozen and exported read-only so a
  // test can check membership without being able to mutate the list itself.
  var FORM_FIELDS = Object.freeze([
    'name', 'producer', 'vintage', 'region', 'appellation', 'style', 'country',
    'quantity', 'location', 'price', 'purchasedOn', 'notes', 'grapes', 'tier', 'wineRating'
  ]);

  // Pure: merges a freshly-validated formBottle (validate()'s bottle) onto
  // existingBottle (the full stored record, or null for a brand-new
  // bottle). Starts from a copy of the existing record so anything the
  // form doesn't know about survives unchanged, then overwrites exactly
  // the FORM_FIELDS entries present on formBottle — deleting one if the
  // owner cleared it, rather than leaving the old value stale. This only
  // works if every field validate() can put on its returned bottle is
  // listed in FORM_FIELDS; that correspondence used to just be asserted
  // here in a comment (which is exactly how 'location' went missing from
  // the list while still being set by validate() — see the pinning test
  // below, 'every field validate can return is owned by the form', added
  // so the next omission fails a test instead of silently dropping data).
  // This is the one place that decides what a save actually writes, so
  // it's exported and tested directly rather than only reachable through
  // the DOM.
  function mergeForSave(existingBottle, formBottle) {
    var merged = {};
    if (existingBottle) {
      Object.keys(existingBottle).forEach(function (k) { merged[k] = existingBottle[k]; });
    }
    FORM_FIELDS.forEach(function (f) {
      if (Object.prototype.hasOwnProperty.call(formBottle, f)) {
        merged[f] = formBottle[f];
      } else {
        delete merged[f];
      }
    });
    return merged;
  }

  // --- render ---------------------------------------------------------------

  function field(container, labelText) {
    var wrap = document.createElement('div');
    wrap.className = 'form-field';
    var label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = labelText;
    wrap.appendChild(label);
    container.appendChild(wrap);
    return { wrap: wrap, label: label };
  }

  function errorLine(wrap) {
    var err = document.createElement('div');
    err.className = 'field-error';
    wrap.appendChild(err);
    return err;
  }

  // Tracks the one photo-preview object URL this screen ever has open at a
  // time, at module scope rather than per render. As a render-scoped local it
  // was revoked only by Cancel and Save, so opening the edit form for a
  // bottle with a photo and then leaving by any other route (a tab tap, the
  // bottle screen) leaked the URL with no handle left to revoke it -- once
  // per visit, unbounded across a session. cellar.js and bottle.js both do
  // it this way: revoke at the top of render, which is self-limiting.
  var photoPreviewUrl = null;
  function revokePhotoPreview() {
    if (photoPreviewUrl) { WC.photos.revoke(photoPreviewUrl); photoPreviewUrl = null; }
  }

  function render(container, bottleOrNull) {
    revokePhotoPreview();
    var bottle = bottleOrNull || null;

    // Field values, seeded from the existing bottle when editing.
    var values = {
      name: bottle ? bottle.name : '',
      producer: bottle ? (bottle.producer || '') : '',
      vintage: bottle ? String(bottle.vintage) : '',
      region: bottle ? bottle.region : '',
      appellation: bottle ? (bottle.appellation || '') : '',
      grapes: bottle && bottle.grapes ? bottle.grapes.join(', ') : '',
      style: bottle ? bottle.style : '',
      tier: bottle ? (bottle.tier || '') : '',
      quantity: bottle ? String(bottle.quantity) : '',
      location: bottle ? formatSlots(bottle.location) : '',
      price: bottle && bottle.price !== undefined ? String(bottle.price) : '',
      purchasedOn: bottle ? (bottle.purchasedOn || '') : '',
      notes: bottle ? (bottle.notes || '') : '',
      wineRating: bottle && bottle.wineRating !== undefined ? String(bottle.wineRating) : ''
    };
    var dirty = initialDirty(bottle);
    var photoId = bottle ? bottle.photoId : undefined;
    var pendingPhotoBlob = null;

    container.textContent = '';
    var form = document.createElement('form');
    form.className = 'bottle-form';
    form.setAttribute('novalidate', 'novalidate');

    // --- Identify with AI ----------------------------------------------------
    var aiBtn = document.createElement('button');
    aiBtn.type = 'button';
    aiBtn.className = 'btn-ai';
    aiBtn.textContent = 'Identify with AI';
    // Fills only the fields the owner hasn't already touched or seeded from
    // an existing bottle -- an AI guess should never clobber a value that's
    // already there. The returned region is free text, so it's matched
    // against the same knowledge base the region picker searches; a region
    // with no match is left unset rather than writing a value selectRegion()
    // (and everything downstream of it) wouldn't recognize.
    aiBtn.addEventListener('click', function () {
      // The name is the entire question being asked. Without it the request
      // goes out as "Wine: \nVintage: " and burns a paid API call on
      // nothing, so this is checked before the settings read, not after.
      if (!String(values.name || '').trim()) {
        WC.app.toast('Type the wine name first, then identify it with AI.');
        return;
      }
      WC.settings.load().then(function (s) {
        if (!s.apiKey) {
          WC.app.toast('Add an API key in Settings to use AI.');
          return;
        }
        aiBtn.disabled = true;
        var originalLabel = aiBtn.textContent;
        aiBtn.textContent = 'Identifying…';

        // "Empty" is judged against the live form values at the moment of
        // the click, captured before anything below mutates them -- not
        // against the dirty flags alone, since a bottle being edited starts
        // with real values that were never "dirtied" by this render. style
        // is the one exception: the <select> always carries some value (the
        // browser picks the first option when none is marked selected), so
        // there is no empty string to test -- "still at its default" is
        // approximated as a brand-new bottle whose style the owner hasn't
        // touched yet.
        var regionWasEmpty = !values.region;
        var grapesWasEmpty = !values.grapes;
        var tierWasEmpty = !values.tier;
        var styleWasEmpty = !bottle && !dirty.style;

        WC.ai.identify(values.name, values.vintage, s.apiKey).then(function (result) {
          // Region first: selectRegion() also prefills style/tier/grapes
          // from the knowledge base's generic fallback for the region
          // (guarded by its own dirty checks), so the AI's own -- more
          // specific -- answers for those fields are applied afterward and
          // win over that generic prefill, but only where the field was
          // empty to begin with.
          if (regionWasEmpty && result.region) {
            var matchedKey = pickRegionMatch(WC.knowledge.search(result.region), result.style);
            if (matchedKey) {
              selectRegion(matchedKey);
            }
            // No confident match: the region is left unset, exactly as if the
            // owner had never typed anything into the region search. Applying
            // a wrong row (a dry wine on a dessert-wine curve) is worse than
            // leaving the field for the owner.
          }
          if (grapesWasEmpty && result.grapes && result.grapes.length) {
            values.grapes = result.grapes.join(', ');
            grapesInput.value = values.grapes;
          }
          if (styleWasEmpty && result.style && STYLES.indexOf(result.style) !== -1) {
            values.style = result.style;
            styleSelect.value = result.style;
          }
          if (tierWasEmpty && result.tier && WC.windows.TIERS.indexOf(result.tier) !== -1) {
            values.tier = result.tier;
            setTierButton(result.tier);
          }
          aiBtn.disabled = false;
          aiBtn.textContent = originalLabel;
        }, function () {
          // Rejection leaves every field exactly as the owner left it --
          // nothing above has run, so there is nothing to undo.
          aiBtn.disabled = false;
          aiBtn.textContent = originalLabel;
          WC.app.toast('Could not identify that wine.');
        });
      }, function (err) {
        // The settings read is what tells this button whether there is a key
        // at all. If it fails there is nothing to fall back on, and with no
        // handler the button would simply stop responding -- a dead control
        // with a console-only rejection behind it.
        WC.app.toast(WC.errors.readFailureMessage(err, 'your settings'));
      });
    });
    form.appendChild(aiBtn);

    // --- name ---------------------------------------------------------------
    var nameField = field(form, 'Name');
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-input';
    nameInput.value = values.name;
    nameInput.addEventListener('input', function () {
      values.name = nameInput.value;
      dirty.name = true;
    });
    nameField.wrap.appendChild(nameInput);
    var nameError = errorLine(nameField.wrap);

    // --- producer -------------------------------------------------------------
    var producerField = field(form, 'Producer');
    var producerInput = document.createElement('input');
    producerInput.type = 'text';
    producerInput.className = 'form-input';
    producerInput.value = values.producer;
    producerInput.addEventListener('input', function () {
      values.producer = producerInput.value;
      dirty.producer = true;
    });
    producerField.wrap.appendChild(producerInput);

    // --- vintage + NV toggle --------------------------------------------------
    var vintageField = field(form, 'Vintage');
    var vintageRow = document.createElement('div');
    vintageRow.className = 'vintage-row';
    var vintageInput = document.createElement('input');
    vintageInput.type = 'number';
    vintageInput.className = 'form-input vintage-input';
    var startsAsNv = values.vintage.toUpperCase() === 'NV';
    vintageInput.value = startsAsNv ? '' : values.vintage;
    vintageInput.disabled = startsAsNv;
    var nvLabel = document.createElement('label');
    nvLabel.className = 'nv-toggle';
    var nvCheckbox = document.createElement('input');
    nvCheckbox.type = 'checkbox';
    nvCheckbox.checked = startsAsNv;
    var nvText = document.createElement('span');
    nvText.textContent = 'NV';
    nvLabel.appendChild(nvCheckbox);
    nvLabel.appendChild(nvText);
    vintageRow.appendChild(vintageInput);
    vintageRow.appendChild(nvLabel);
    vintageField.wrap.appendChild(vintageRow);
    var vintageError = errorLine(vintageField.wrap);

    function syncVintageValue() {
      values.vintage = nvCheckbox.checked ? 'NV' : vintageInput.value;
      dirty.vintage = true;
    }
    vintageInput.addEventListener('input', syncVintageValue);
    nvCheckbox.addEventListener('change', function () {
      vintageInput.disabled = nvCheckbox.checked;
      if (nvCheckbox.checked) { vintageInput.value = ''; }
      syncVintageValue();
    });

    // --- region picker ---------------------------------------------------------
    var regionField = field(form, 'Region');
    var regionSearch = document.createElement('input');
    regionSearch.type = 'search';
    regionSearch.className = 'form-input';
    regionSearch.placeholder = 'Search region, country or grape…';
    regionField.wrap.appendChild(regionSearch);

    var regionSelected = document.createElement('div');
    regionSelected.className = 'region-selected';
    regionField.wrap.appendChild(regionSelected);

    var regionResults = document.createElement('div');
    regionResults.className = 'region-results';
    regionField.wrap.appendChild(regionResults);
    var regionError = errorLine(regionField.wrap);

    function updateRegionSelected() {
      if (!values.region) { regionSelected.textContent = ''; return; }
      var profile = WC.knowledge.get(values.region, values.style);
      regionSelected.textContent = 'Selected: ' + profile.region + ' (' + profile.country + ')';
    }

    function groupByCountry(list) {
      var byCountry = {};
      var order = [];
      list.forEach(function (item) {
        if (!byCountry[item.country]) { byCountry[item.country] = []; order.push(item.country); }
        byCountry[item.country].push(item);
      });
      return { order: order, byCountry: byCountry };
    }

    function drawRegionList(filterText) {
      regionResults.textContent = '';
      var q = String(filterText || '').trim();
      var list = q ? WC.knowledge.search(q) : WC.knowledge.countries().reduce(function (acc, country) {
        return acc.concat(WC.knowledge.regionsFor(country));
      }, []);
      var grouped = groupByCountry(list);
      grouped.order.forEach(function (country) {
        var section = document.createElement('div');
        section.className = 'region-group';
        var heading = document.createElement('div');
        heading.className = 'region-group-label';
        heading.textContent = country;
        section.appendChild(heading);
        grouped.byCountry[country].forEach(function (item) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'region-item';
          btn.textContent = item.region;
          btn.addEventListener('click', function () {
            selectRegion(item.key);
          });
          section.appendChild(btn);
        });
        regionResults.appendChild(section);
      });
    }

    function selectRegion(regionKey) {
      values.region = regionKey;
      dirty.region = true;
      var pre = prefillFromRegion(regionKey);
      if (!dirty.style) {
        values.style = pre.style;
        styleSelect.value = pre.style;
      }
      if (!dirty.tier) {
        values.tier = pre.tier;
        setTierButton(pre.tier);
      }
      if (!dirty.grapes) {
        values.grapes = pre.grapes.join(', ');
        grapesInput.value = values.grapes;
      }
      updateRegionSelected();
    }

    regionSearch.addEventListener('input', function () {
      drawRegionList(regionSearch.value);
    });
    drawRegionList('');
    updateRegionSelected();

    // --- appellation ------------------------------------------------------------
    var appellationField = field(form, 'Appellation');
    var appellationInput = document.createElement('input');
    appellationInput.type = 'text';
    appellationInput.className = 'form-input';
    appellationInput.placeholder = 'e.g. Pomerol';
    appellationInput.value = values.appellation;
    appellationInput.addEventListener('input', function () {
      values.appellation = appellationInput.value;
      dirty.appellation = true;
    });
    appellationField.wrap.appendChild(appellationInput);

    // --- grapes (informational, editable, prefilled from region) --------------
    var grapesField = field(form, 'Grapes');
    var grapesInput = document.createElement('input');
    grapesInput.type = 'text';
    grapesInput.className = 'form-input';
    grapesInput.placeholder = 'e.g. Cabernet Sauvignon, Merlot';
    grapesInput.value = values.grapes;
    grapesInput.addEventListener('input', function () {
      values.grapes = grapesInput.value;
      dirty.grapes = true;
    });
    grapesField.wrap.appendChild(grapesInput);

    // --- style ------------------------------------------------------------------
    var styleField = field(form, 'Style');
    var styleSelect = document.createElement('select');
    styleSelect.className = 'form-input';
    STYLES.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      if (values.style === s) { opt.selected = true; }
      styleSelect.appendChild(opt);
    });
    // A <select> always has some option selected even before the user
    // touches it (the browser picks the first one when none is marked
    // `selected`), so values.style must be seeded from that real initial
    // value here — otherwise a fresh form reports "Style is required" even
    // though the field visibly shows "Red".
    values.style = styleSelect.value;
    styleSelect.addEventListener('change', function () {
      values.style = styleSelect.value;
      dirty.style = true;
    });
    styleField.wrap.appendChild(styleSelect);
    var styleError = errorLine(styleField.wrap);

    // --- tier (four tap targets) --------------------------------------------------
    var tierField = field(form, 'Tier');
    var tierRow = document.createElement('div');
    tierRow.className = 'tier-row';
    var tierButtons = {};
    WC.windows.TIERS.forEach(function (tierName) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tier-btn';
      btn.textContent = tierName.charAt(0).toUpperCase() + tierName.slice(1);
      btn.setAttribute('aria-pressed', values.tier === tierName ? 'true' : 'false');
      if (values.tier === tierName) { btn.classList.add('active'); }
      btn.addEventListener('click', function () {
        values.tier = tierName;
        dirty.tier = true;
        setTierButton(tierName);
      });
      tierButtons[tierName] = btn;
      tierRow.appendChild(btn);
    });
    tierField.wrap.appendChild(tierRow);

    function setTierButton(tierName) {
      WC.windows.TIERS.forEach(function (t) {
        var pressed = t === tierName;
        tierButtons[t].setAttribute('aria-pressed', pressed ? 'true' : 'false');
        tierButtons[t].classList.toggle('active', pressed);
      });
    }

    // --- wine rating (the wine's general standing, e.g. Vivino — not the -----
    //     score for a bottle actually drunk, which lives on the drink entry) --
    var wineRatingField = field(form, 'Rating (0–5, e.g. Vivino)');
    var wineRatingInput = document.createElement('input');
    wineRatingInput.type = 'number';
    wineRatingInput.className = 'form-input';
    wineRatingInput.min = '0';
    wineRatingInput.max = '5';
    wineRatingInput.step = '0.1';
    wineRatingInput.value = values.wineRating;
    wineRatingInput.addEventListener('input', function () {
      values.wineRating = wineRatingInput.value;
      dirty.wineRating = true;
    });
    wineRatingField.wrap.appendChild(wineRatingInput);
    var wineRatingError = errorLine(wineRatingField.wrap);

    // --- quantity stepper -----------------------------------------------------
    var quantityField = field(form, 'Quantity');
    var qtyRow = document.createElement('div');
    qtyRow.className = 'qty-row';
    var qtyMinus = document.createElement('button');
    qtyMinus.type = 'button';
    qtyMinus.className = 'qty-btn';
    qtyMinus.textContent = '−';
    var qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'form-input qty-input';
    qtyInput.min = '0';
    qtyInput.value = values.quantity || '1';
    var qtyPlus = document.createElement('button');
    qtyPlus.type = 'button';
    qtyPlus.className = 'qty-btn';
    qtyPlus.textContent = '+';
    qtyRow.appendChild(qtyMinus);
    qtyRow.appendChild(qtyInput);
    qtyRow.appendChild(qtyPlus);
    quantityField.wrap.appendChild(qtyRow);
    var quantityError = errorLine(quantityField.wrap);

    function currentQty() {
      var n = parseInt(qtyInput.value, 10);
      return isNaN(n) ? 0 : n;
    }
    function setQty(n) {
      qtyInput.value = String(Math.max(0, n));
      values.quantity = qtyInput.value;
      dirty.quantity = true;
    }
    qtyMinus.addEventListener('click', function () { setQty(currentQty() - 1); });
    qtyPlus.addEventListener('click', function () { setQty(currentQty() + 1); });
    qtyInput.addEventListener('input', function () {
      values.quantity = qtyInput.value;
      dirty.quantity = true;
    });
    if (!values.quantity) { values.quantity = qtyInput.value; }

    // --- location -----------------------------------------------------------
    var locationField = field(form, 'Location');
    var locationInput = document.createElement('input');
    locationInput.type = 'text';
    locationInput.className = 'form-input';
    locationInput.placeholder = 'e.g. Rack B';
    locationInput.value = values.location;
    locationInput.addEventListener('input', function () {
      values.location = locationInput.value;
      dirty.location = true;
    });
    locationField.wrap.appendChild(locationInput);

    // --- price -----------------------------------------------------------------
    var priceField = field(form, 'Price');
    var priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.className = 'form-input';
    priceInput.placeholder = 'e.g. 45';
    priceInput.value = values.price;
    priceInput.addEventListener('input', function () {
      values.price = priceInput.value;
      dirty.price = true;
    });
    priceField.wrap.appendChild(priceInput);
    var priceError = errorLine(priceField.wrap);

    // --- purchase date -----------------------------------------------------------
    var purchasedField = field(form, 'Purchased on');
    var purchasedInput = document.createElement('input');
    purchasedInput.type = 'date';
    purchasedInput.className = 'form-input';
    purchasedInput.value = values.purchasedOn;
    purchasedInput.addEventListener('input', function () {
      values.purchasedOn = purchasedInput.value;
      dirty.purchasedOn = true;
    });
    purchasedField.wrap.appendChild(purchasedInput);

    // --- photo ------------------------------------------------------------------
    var photoField = field(form, 'Photo');
    var photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.setAttribute('capture', 'environment');
    photoField.wrap.appendChild(photoInput);
    var photoPreview = document.createElement('div');
    photoPreview.className = 'photo-preview';
    photoField.wrap.appendChild(photoPreview);

    function showPhotoPreview(blob) {
      revokePhotoPreview();
      photoPreview.textContent = '';
      if (!blob) { return; }
      photoPreviewUrl = WC.photos.toObjectUrl(blob);
      var img = document.createElement('img');
      img.src = photoPreviewUrl;
      img.alt = '';
      photoPreview.appendChild(img);
    }

    if (photoId) {
      WC.store.getPhoto(photoId).then(function (blob) {
        if (blob) { showPhotoPreview(blob); }
      }).catch(function () { /* no existing photo to preview */ });
    }

    photoInput.addEventListener('change', function () {
      var file = photoInput.files && photoInput.files[0];
      if (!file) { return; }
      WC.photos.downscale(file).then(function (blob) {
        pendingPhotoBlob = blob;
        showPhotoPreview(blob);
      }).catch(function () {
        WC.app.toast('That photo could not be used.');
      });
    });

    // --- notes -----------------------------------------------------------------
    var notesField = field(form, 'Notes');
    var notesArea = document.createElement('textarea');
    notesArea.className = 'form-input notes-input';
    notesArea.value = values.notes;
    notesArea.addEventListener('input', function () {
      values.notes = notesArea.value;
      dirty.notes = true;
    });
    notesField.wrap.appendChild(notesArea);

    // --- actions -----------------------------------------------------------------
    var actions = document.createElement('div');
    actions.className = 'form-actions';
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', function () {
      revokePhotoPreview();
      WC.router.render('cellar');
    });
    var saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'btn-primary';
    saveBtn.textContent = 'Save';
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    form.appendChild(actions);

    function clearErrors() {
      [nameError, vintageError, regionError, styleError, quantityError, priceError, wineRatingError].forEach(function (el) {
        el.textContent = '';
      });
    }

    function showErrors(errors) {
      nameError.textContent = errors.name || '';
      vintageError.textContent = errors.vintage || '';
      regionError.textContent = errors.region || '';
      styleError.textContent = errors.style || '';
      quantityError.textContent = errors.quantity || '';
      priceError.textContent = errors.price || '';
      wineRatingError.textContent = errors.wineRating || '';
    }

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      clearErrors();
      var result = validate(values, new Date().getFullYear());
      if (!result.valid) {
        showErrors(result.errors);
        return;
      }
      // result.bottle only carries the fields this form manages. putBottle
      // replaces the whole record with whatever keys are present here, so
      // mergeForSave folds it onto the original record (id, createdAt,
      // photoId, and anything else the form doesn't own all ride through
      // untouched) rather than this code hand-picking which extra fields to
      // preserve.
      var toSave = mergeForSave(bottle, result.bottle);
      WC.store.putBottle(toSave).then(function (saved) {
        if (pendingPhotoBlob) {
          return WC.store.putPhoto(saved.id, pendingPhotoBlob).then(function () {
            if (!saved.photoId) {
              saved.photoId = saved.id;
              return WC.store.putBottle(saved);
            }
          });
        }
      }).then(function () {
        // The toast goes out before the navigation, not after: WC.router
        // .render reports its own read failures now, and a message about the
        // screen that failed to redraw must not be immediately replaced by
        // "Saved." from a later link in the same chain.
        revokePhotoPreview();
        WC.app.toast('Saved.');
        return WC.router.render('cellar');
      }, function (err) {
        // Without this arm the owner got nothing at all on a failed save: no
        // toast, no navigation, an apparently dead Save button and an
        // unhandled rejection in the console. The form is deliberately left
        // as it stands, with every field intact, so the save can be retried.
        WC.app.toast(WC.errors.saveFailureMessage(err, 'this bottle'));
      });
    });

    container.appendChild(form);
    return Promise.resolve();
  }

  return {
    validate: validate,
    prefillFromRegion: prefillFromRegion,
    mergeForSave: mergeForSave,
    initialDirty: initialDirty,
    parseSlots: parseSlots,
    formatSlots: formatSlots,
    pickRegionMatch: pickRegionMatch,
    FORM_FIELDS: FORM_FIELDS,
    render: render
  };
})();
