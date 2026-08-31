window.WC = window.WC || {};
WC.settings = (function () {
  'use strict';

  // The word the owner must type, verbatim, to unlock the clear-all button.
  // A second tap is too easy to fat-finger on a phone; a typed word is not.
  var CLEAR_WORD = 'DELETE';

  var defaults = Object.freeze({ unit: 'C', currency: '€', apiKey: '', ratingScale: 20 });

  function withDefault(value, fallback) {
    return value === null || value === undefined ? fallback : value;
  }

  // Reads all four settings and merges them over defaults -- a key that has
  // never been written (getSetting resolves null) falls back rather than
  // becoming null on the returned object.
  function load() {
    return Promise.all([
      WC.store.getSetting('unit'),
      WC.store.getSetting('currency'),
      WC.store.getSetting('apiKey'),
      WC.store.getSetting('ratingScale')
    ]).then(function (r) {
      return {
        unit: withDefault(r[0], defaults.unit),
        currency: withDefault(r[1], defaults.currency),
        apiKey: withDefault(r[2], defaults.apiKey),
        ratingScale: withDefault(r[3], defaults.ratingScale)
      };
    });
  }

  // Merges partial onto the currently stored settings and persists only the
  // keys partial actually supplies, so saving one field never touches (or
  // even rewrites) the others. Resolves with the full merged object.
  function save(partial) {
    var p = partial || {};
    return load().then(function (current) {
      var merged = {};
      Object.keys(current).forEach(function (k) { merged[k] = current[k]; });
      Object.keys(p).forEach(function (k) { merged[k] = p[k]; });
      var writes = Object.keys(p).map(function (k) { return WC.store.setSetting(k, p[k]); });
      return Promise.all(writes).then(function () { return merged; });
    });
  }

  // Uses the UTC calendar date (not the local one) so the filename is
  // deterministic regardless of the machine's timezone -- a test pins this
  // against a fixed ISO instant.
  function exportFilename(date) {
    var d = date instanceof Date ? date : new Date(date);
    return 'wine-cellar-' + d.toISOString().slice(0, 10) + '.json';
  }

  function validateKey(text) {
    var v = typeof text === 'string' ? text : '';
    if (!v) { return { valid: false, message: 'Enter an API key.' }; }
    if (/\s/.test(v)) { return { valid: false, message: 'The key must not contain spaces or other whitespace.' }; }
    if (v.indexOf('sk-ant-') !== 0) { return { valid: false, message: 'Anthropic API keys start with "sk-ant-".' }; }
    return { valid: true, message: '' };
  }

  // --- render ----------------------------------------------------------------

  // Every mutating action below (save, export, clear-all) must surface a
  // real message on rejection rather than leaving an unhandled promise and a
  // silently unresponsive button -- that failure mode is what the storage
  // warning exists to make visible elsewhere, and it is exactly as invisible
  // here if these calls go uncaught.
  //
  // The wording itself now lives in WC.errors, shared with form.js, bottle.js
  // and router.js: the convention started here, but the app's actual writes
  // are in those files, and three copies of these two functions was the
  // alternative. Aliased locally so the call sites below read unchanged.
  var errorMessage = WC.errors.errorMessage;
  var saveFailureMessage = WC.errors.saveFailureMessage;

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

  function textRow(parent, text, className) {
    var p = document.createElement('p');
    if (className) { p.className = className; }
    p.textContent = text;
    parent.appendChild(p);
    return p;
  }

  function buildApiKeySection(settings) {
    var section = document.createElement('div');
    section.className = 'settings-section';
    var heading = document.createElement('h3');
    heading.textContent = 'AI (Anthropic)';
    section.appendChild(heading);

    var keyField = field(section, 'API key');
    var keyInput = document.createElement('input');
    keyInput.type = 'password';
    keyInput.className = 'form-input';
    keyInput.autocomplete = 'off';
    keyInput.value = settings.apiKey || '';
    keyField.wrap.appendChild(keyInput);

    textRow(keyField.wrap,
      'Stored on this device only and sent only to Anthropic. Leave empty to keep the app fully offline.',
      'field-hint');

    var keyError = document.createElement('div');
    keyError.className = 'field-error';
    keyField.wrap.appendChild(keyError);

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-secondary';
    saveBtn.textContent = 'Save API key';
    saveBtn.addEventListener('click', function () {
      var raw = keyInput.value.trim();
      if (raw === '') {
        keyError.textContent = '';
        save({ apiKey: '' }).then(function () { WC.app.toast('API key cleared.'); }, function (err) {
          WC.app.toast(saveFailureMessage(err, 'the API key change'));
        });
        return;
      }
      var result = validateKey(raw);
      keyError.textContent = result.valid ? '' : result.message;
      if (!result.valid) { return; }
      save({ apiKey: raw }).then(function () { WC.app.toast('API key saved.'); }, function (err) {
        WC.app.toast(saveFailureMessage(err, 'the API key'));
      });
    });
    keyField.wrap.appendChild(saveBtn);

    return section;
  }

  function buildPreferencesSection(settings) {
    var section = document.createElement('div');
    section.className = 'settings-section';
    var heading = document.createElement('h3');
    heading.textContent = 'Preferences';
    section.appendChild(heading);

    var unitField = field(section, 'Temperature unit');
    var unitSelect = document.createElement('select');
    unitSelect.className = 'form-input';
    [['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)']].forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = pair[0];
      opt.textContent = pair[1];
      if (settings.unit === pair[0]) { opt.selected = true; }
      unitSelect.appendChild(opt);
    });
    unitSelect.addEventListener('change', function () {
      save({ unit: unitSelect.value }).then(function () { WC.app.toast('Saved.'); }, function (err) {
        WC.app.toast(saveFailureMessage(err, 'the temperature unit'));
      });
    });
    unitField.wrap.appendChild(unitSelect);

    var currencyField = field(section, 'Currency');
    var currencySelect = document.createElement('select');
    currencySelect.className = 'form-input';
    var currencies = ['€', '$', '£', '¥'];
    if (currencies.indexOf(settings.currency) === -1) { currencies.push(settings.currency); }
    currencies.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (settings.currency === c) { opt.selected = true; }
      currencySelect.appendChild(opt);
    });
    currencySelect.addEventListener('change', function () {
      save({ currency: currencySelect.value }).then(function () { WC.app.toast('Saved.'); }, function (err) {
        WC.app.toast(saveFailureMessage(err, 'the currency'));
      });
    });
    currencyField.wrap.appendChild(currencySelect);

    var scaleField = field(section, 'Rating scale');
    var scaleSelect = document.createElement('select');
    scaleSelect.className = 'form-input';
    [[20, 'Out of 20'], [100, 'Out of 100']].forEach(function (pair) {
      var opt = document.createElement('option');
      opt.value = String(pair[0]);
      opt.textContent = pair[1];
      if (settings.ratingScale === pair[0]) { opt.selected = true; }
      scaleSelect.appendChild(opt);
    });
    // Stored as a number, not the string a <select> hands back -- summarise
    // and the drink form both compare it against 20/100 with ===.
    scaleSelect.addEventListener('change', function () {
      save({ ratingScale: Number(scaleSelect.value) }).then(function () { WC.app.toast('Saved.'); }, function (err) {
        WC.app.toast(saveFailureMessage(err, 'the rating scale'));
      });
    });
    scaleField.wrap.appendChild(scaleSelect);

    return section;
  }

  // Above roughly this much text, a backup is not something anyone can
  // select and copy by hand -- and putting it in a textarea at all is the
  // problem, not just an inconvenience.
  var COPY_LIMIT_CHARS = 512 * 1024;

  // Measured in characters rather than bytes: a photo-bearing backup is
  // overwhelmingly base64 and JSON punctuation, all single-byte, so the two
  // are the same number to well within the "roughly" this threshold implies.
  // Kept pure (no Blob, no DOM) so the decision is testable directly.
  function describeSize(chars) {
    return chars < 1024 * 1024
      ? Math.round(chars / 1024) + ' KB'
      : (Math.round(chars / (1024 * 1024) * 10) / 10) + ' MB';
  }

  // Pure: what the export UI should do with the JSON it just produced.
  //
  // The copy above the button already warns that a photo-heavy cellar
  // produces a backup far too large to copy by hand -- and the code then did
  // exactly that anyway, on every export: assigned the whole string to a
  // textarea and called focus()/select() on it. A 50-bottle cellar with
  // photos is several MB of base64, live in three copies at once, and
  // selecting that much text is enough to hang a mobile tab. An export
  // button that freezes the tab reads as "the backup is broken" at the one
  // moment the owner most needs to believe it is not.
  //
  // The textarea itself stays: it is the only path that works where
  // page-initiated downloads are blocked. It is the unconditional filling
  // and selecting that is gated.
  //
  // `options.downloadUnavailable` is set once the caller has actually tried
  // the download (capability, then link) and knows neither path delivered a
  // file -- see resolveDownloadOutcome below. In that specific situation the
  // legacy hint ("use the downloaded file") would be telling the owner to
  // rely on something that did not happen, on the one host where the box
  // above is also the only route left. The gate itself does not move: the
  // freeze hazard is exactly as real either way. What changes is that the
  // owner is now offered an explicit, informed way to reveal the text
  // anyway (see the reveal button in buildBackupSection) instead of being
  // pointed at a file that was never saved.
  function exportCopyPlan(json, options) {
    var text = typeof json === 'string' ? json : '';
    var fromDangerZone = !!(options && options.fromDangerZone);
    var downloadUnavailable = !!(options && options.downloadUnavailable);
    if (text.length > COPY_LIMIT_CHARS) {
      if (downloadUnavailable) {
        return {
          fill: false,
          focus: false,
          reveal: true,
          hint: 'This backup is about ' + describeSize(text.length) + ' — too large to select and copy by ' +
            'hand, and no download saved it just now. Tap "Show full backup text" below if you need a copy; ' +
            'it can be slow to display on this device.'
        };
      }
      return {
        fill: false,
        focus: false,
        reveal: false,
        hint: 'This backup is about ' + describeSize(text.length) + ' — too large to select and copy by ' +
          'hand, because it includes your label photos. Use the downloaded file; it is the whole backup.'
      };
    }
    return {
      fill: true,
      // Invoked from the Danger zone, focusing the textarea scrolls the page
      // away from the clear-all confirmation the owner is standing in front
      // of -- at exactly the wrong moment.
      focus: !fromDangerZone,
      reveal: false,
      hint: 'If the download did not start, the backup is in the box above — tap it to select everything, then copy.'
    };
  }

  // --- reaching the owner with the file: capability first, link fallback ---
  //
  // The hosted (Artifact) build of this page runs inside a sandbox that
  // blocks page-initiated downloads outright: the <a download> in
  // triggerLinkDownload below is inert there. Until this file could reach
  // the platform's own file-saving capability, a photo-bearing cellar had no
  // working export path at all on that host -- the JSON export is the
  // owner's only backup. The capability is tried first; the link (unchanged)
  // is the fallback, so one build works on both delivery routes.
  //
  // window.claude is not a DOM API and simply does not exist on a plain
  // static host. Where it does exist, `.use()` resolves later than this
  // script's first synchronous run and is not ordered against
  // DOMContentLoaded, so it must never be read at load time -- only lazily,
  // when the owner actually clicks export.
  function hasDownloadsCapability(claudeGlobal) {
    return !!claudeGlobal && typeof claudeGlobal.use === 'function';
  }

  // `claudeGlobal` defaults to the real, ambient window.claude; every call
  // in this file's tests passes one explicitly instead, so a fake used for
  // one scenario can never leak into another. The platform itself memoizes
  // the promise behind `.use()` -- calling it again each export is exactly
  // as cheap as remembering it here would be, and remembering it here would
  // mean trusting a stale reference for the life of the page, which is a
  // real cost for zero real benefit.
  function getDownloads(claudeGlobal) {
    var claudeRef = claudeGlobal === undefined ? window.claude : claudeGlobal;
    return hasDownloadsCapability(claudeRef) ? claudeRef.use('downloads') : Promise.resolve(null);
  }

  // Pure: what a rejected downloads.save() means for the UI. Split out from
  // the async plumbing in resolveDownloadOutcome so the platform's five
  // named error codes -- plus "anything else", which the contract requires
  // treating exactly like `unavailable` -- can be exercised directly.
  //
  // `declined` (the viewer said no, or let the prompt expire) is reported
  // with fixed, neutral wording rather than the platform's own err.message:
  // whatever that text says, surfacing it verbatim risks reading as an
  // error or a nag, and the contract is explicit that a decline is never
  // retried automatically. The other three handled codes reuse
  // WC.errors.errorMessage so the platform's own explanation comes through
  // when it has one, with a plain fallback when it does not.
  function capabilitySaveFailure(err) {
    var code = err && err.code;
    if (code === 'declined') {
      return { fallbackToLink: false, message: 'Backup not saved this time.' };
    }
    if (code === 'rate_limited') {
      return {
        fallbackToLink: false,
        message: errorMessage(err, 'A save prompt is already open, or there have been too many recent attempts. ' +
          'Wait a moment and tap Export backup again.')
      };
    }
    if (code === 'too_large') {
      return {
        fallbackToLink: false,
        message: errorMessage(err, 'This backup is too large to save that way (over 16 MB).')
      };
    }
    if (code === 'bad_request') {
      return { fallbackToLink: false, message: errorMessage(err, 'The backup could not be saved.') };
    }
    // unavailable / not_granted / capability_disabled / capability_removed,
    // and any code this file has never seen (the contract requires treating
    // an unknown one exactly like `unavailable`): the capability is unusable
    // in this view for a reason that has nothing to do with this one
    // attempt -- indistinguishable, to the owner, from a plain static host
    // where the capability never resolved at all. Falls back to the link,
    // silently: that fallback is the normal case, not a failure to report.
    return { fallbackToLink: true, message: null };
  }

  // Decides how the export should reach the owner, without touching the DOM
  // itself. Split out from triggerDownload below so the whole decision tree
  // -- capability present and accepting; declined; unavailable falling
  // through to the link; an unknown code treated the same as unavailable;
  // no window.claude at all -- can be driven with an injected fake
  // `claudeGlobal` and asserted on directly, without ever triggering a real
  // download.
  //
  // `claudeGlobal` defaults to window.claude when omitted; every call below
  // passes one explicitly. Resolves with:
  //   ok             -- true unless the capability ran and was refused
  //   usedCapability -- true only when the capability actually ran (whether
  //                     it saved or was refused); false whenever the answer
  //                     is "fall back to the link", including absence
  //   fallbackToLink -- true when the caller should perform the link download
  //   message        -- what to tell the owner, or null when the link
  //                      fallback already speaks for itself
  function resolveDownloadOutcome(claudeGlobal, filename, json) {
    return getDownloads(claudeGlobal).then(function (downloads) {
      if (!downloads) {
        return { ok: true, usedCapability: false, fallbackToLink: true, message: null };
      }
      return downloads.save({ filename: filename, data: json }).then(function () {
        return { ok: true, usedCapability: true, fallbackToLink: false, message: 'Backup saved.' };
      }, function (err) {
        var outcome = capabilitySaveFailure(err);
        if (outcome.fallbackToLink) {
          return { ok: true, usedCapability: false, fallbackToLink: true, message: null };
        }
        return { ok: false, usedCapability: true, fallbackToLink: false, message: outcome.message };
      });
    }, function () {
      // use() is not documented to reject, but if it somehow does, this is
      // exactly the "cannot run it here" case.
      return { ok: true, usedCapability: false, fallbackToLink: true, message: null };
    });
  }

  // Performs the actual same-origin object-URL download via a throwaway
  // <a download>, then revokes the URL. Unchanged from before this file
  // could reach the platform's downloads capability, including the
  // revocation timing: this remains exactly the path used when the page is
  // served normally, and is now also the fallback whenever the capability
  // is missing, refused for a reason unrelated to this attempt, or simply
  // not served in this view.
  function triggerLinkDownload(json, filename) {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  // The one the UI calls: tries the capability via resolveDownloadOutcome,
  // performs the link download when that says to, and resolves with the
  // outcome so the caller can build a truthful toast and decide whether the
  // copy-out box's dead end (see exportCopyPlan) needs closing.
  function triggerDownload(json, filename, claudeGlobal) {
    return resolveDownloadOutcome(claudeGlobal, filename, json).then(function (outcome) {
      if (outcome.fallbackToLink) { triggerLinkDownload(json, filename); }
      return outcome;
    });
  }

  function buildBackupSection() {
    var section = document.createElement('div');
    section.className = 'settings-section';
    var heading = document.createElement('h3');
    heading.textContent = 'Backup';
    section.appendChild(heading);

    textRow(section,
      'Everything lives only on this device. This export is the only way to move your cellar to a new phone or ' +
      'recover it after clearing site data — it now includes your label photos, so the file will be substantially ' +
      'larger than before. Once you have photos, download the file rather than copying it from the box below; a ' +
      'photo-heavy cellar can produce a backup far too large to select and copy by hand.');

    var exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'btn-primary';
    exportBtn.textContent = 'Export backup';
    section.appendChild(exportBtn);

    var exportArea = document.createElement('textarea');
    exportArea.className = 'form-input export-textarea';
    exportArea.readOnly = true;
    exportArea.hidden = true;
    exportArea.setAttribute('aria-label', 'Backup JSON — select all and copy if the download did not start');
    section.appendChild(exportArea);

    var exportHint = document.createElement('p');
    exportHint.className = 'field-hint';
    exportHint.hidden = true;
    exportHint.textContent = 'If the download did not start, the backup is in the box above — tap it to select everything, then copy.';
    section.appendChild(exportHint);

    // Shown only when exportCopyPlan says the backup is too large to copy
    // automatically *and* neither the capability nor the link is known to
    // have delivered a file this time -- the one situation where the owner
    // would otherwise have no way at all to get their backup out. Left
    // hidden and inert the rest of the time: filling and displaying a
    // multi-megabyte textarea is exactly the freeze hazard exportCopyPlan's
    // size gate exists to avoid, so this stays an explicit, informed,
    // owner-initiated action rather than something that happens on its own.
    var revealBtn = document.createElement('button');
    revealBtn.type = 'button';
    revealBtn.className = 'btn-secondary';
    revealBtn.textContent = 'Show full backup text';
    revealBtn.hidden = true;
    section.appendChild(revealBtn);

    var revealJson = '';
    revealBtn.addEventListener('click', function () {
      exportArea.value = revealJson;
      exportArea.hidden = false;
      revealBtn.hidden = true;
    });

    function runExport(options) {
      return WC.store.exportJson().then(function (json) {
        return triggerDownload(json, exportFilename(new Date())).then(function (outcome) {
          var plan = exportCopyPlan(json, {
            fromDangerZone: options && options.fromDangerZone,
            downloadUnavailable: !outcome.ok
          });
          exportArea.value = plan.fill ? json : '';
          exportArea.hidden = !plan.fill;
          exportHint.textContent = plan.hint;
          exportHint.hidden = false;
          revealJson = plan.reveal ? json : '';
          revealBtn.hidden = !plan.reveal;
          if (plan.focus) {
            exportArea.focus();
            exportArea.select();
          }
          WC.app.toast(outcome.message || 'Backup exported.');
          return json;
        });
      }, function (err) {
        // Deliberately unmistakable: this is the safety net the Danger zone
        // points to right before an irreversible clear, so a vague "Saved."-
        // style message here could read as success and let an owner clear
        // a cellar they believe is backed up when it is not.
        WC.app.toast('Export failed — no backup was created. ' + errorMessage(err, 'Storage is unavailable.'));
        return null;
      });
    }
    exportBtn.addEventListener('click', function () { runExport({}); });

    // --- import ---------------------------------------------------------------
    var importField = field(section, 'Import backup');
    var importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = 'application/json,.json';
    importField.wrap.appendChild(importInput);

    importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      if (!file) { return; }
      var reader = new FileReader();
      reader.onload = function () {
        WC.store.importJson(String(reader.result)).then(function (report) {
          importInput.value = '';
          WC.app.toast('Added ' + report.added + ', updated ' + report.updated + ', skipped ' + report.skipped + '.');
          return WC.router.render('settings');
        }, function (err) {
          importInput.value = '';
          // Two very different failures reached this one message before: the
          // file being unreadable, and the file being fine but the database
          // refusing the write. Reporting the second as the first sends the
          // owner off hunting for another copy of a backup that is not the
          // problem. WC.store tags what its validator rejected.
          if (err && err.invalidBackup) {
            WC.app.toast(errorMessage(err, 'Invalid backup.'));
          } else {
            WC.app.toast('Your backup file was read fine, but it could not be saved — ' +
              errorMessage(err, 'storage is unavailable.') +
              (WC.errors.isQuotaExceeded(err) ? ' Free space by removing some label photos.' : ''));
          }
        });
      };
      reader.onerror = function () {
        importInput.value = '';
        WC.app.toast('That file could not be read.');
      };
      reader.readAsText(file);
    });

    return { section: section, runExport: runExport };
  }

  function buildDangerSection(runExport) {
    var section = document.createElement('div');
    section.className = 'settings-section';
    var heading = document.createElement('h3');
    heading.textContent = 'Danger zone';
    section.appendChild(heading);

    textRow(section,
      'Clearing all data permanently deletes every bottle, drink record and photo on this device — and resets your ' +
      'temperature/currency preferences, rating scale and API key to their defaults. The backup contains your bottles, drink ' +
      'history and label photos, but not preferences or the API key, so those cannot be recovered afterward. ' +
      'Export a backup first.');

    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn-danger';
    clearBtn.textContent = 'Clear all data';
    section.appendChild(clearBtn);

    var confirmWrap = document.createElement('div');
    confirmWrap.className = 'clear-confirm';
    confirmWrap.hidden = true;

    textRow(confirmWrap, 'This cannot be undone. Export a backup before you continue.');

    var exportFirstBtn = document.createElement('button');
    exportFirstBtn.type = 'button';
    exportFirstBtn.className = 'btn-secondary';
    exportFirstBtn.textContent = 'Export backup now';
    exportFirstBtn.addEventListener('click', function () { runExport({ fromDangerZone: true }); });
    confirmWrap.appendChild(exportFirstBtn);

    var typedField = field(confirmWrap, 'Type ' + CLEAR_WORD + ' to confirm');
    var typedInput = document.createElement('input');
    typedInput.type = 'text';
    typedInput.className = 'form-input';
    typedInput.autocomplete = 'off';
    typedInput.setAttribute('aria-label', 'Type ' + CLEAR_WORD + ' to confirm clearing all data');
    typedField.wrap.appendChild(typedInput);

    var confirmActions = document.createElement('div');
    confirmActions.className = 'form-actions';

    var confirmYes = document.createElement('button');
    confirmYes.type = 'button';
    confirmYes.className = 'btn-danger';
    confirmYes.textContent = 'Permanently delete everything';
    confirmYes.disabled = true;

    var confirmNo = document.createElement('button');
    confirmNo.type = 'button';
    confirmNo.className = 'btn-secondary';
    confirmNo.textContent = 'Cancel';

    confirmActions.appendChild(confirmNo);
    confirmActions.appendChild(confirmYes);
    confirmWrap.appendChild(confirmActions);
    section.appendChild(confirmWrap);

    function resetConfirm() {
      typedInput.value = '';
      confirmYes.disabled = true;
      confirmWrap.hidden = true;
    }

    clearBtn.addEventListener('click', function () {
      confirmWrap.hidden = !confirmWrap.hidden;
      if (confirmWrap.hidden) { resetConfirm(); }
    });
    confirmNo.addEventListener('click', resetConfirm);
    typedInput.addEventListener('input', function () {
      confirmYes.disabled = typedInput.value !== CLEAR_WORD;
    });
    confirmYes.addEventListener('click', function () {
      if (typedInput.value !== CLEAR_WORD) { return; }
      WC.store.clearAll().then(function () {
        // The destructive step already succeeded by this point (clearAll's
        // transaction is atomic across all its stores), so a hiccup while
        // refreshing the screen afterward is a display glitch, not data
        // loss -- it is swallowed rather than reported as if the clear
        // itself had failed.
        resetConfirm();
        WC.app.toast('All data cleared.');
        return WC.router.render('settings').catch(function () {});
      }, function (err) {
        WC.app.toast('Clear failed — nothing was deleted. ' + errorMessage(err, 'Storage is unavailable.'));
      });
    });

    return section;
  }

  function draw(container, settings) {
    container.textContent = '';
    var wrap = document.createElement('div');
    wrap.className = 'settings';

    wrap.appendChild(buildApiKeySection(settings));
    wrap.appendChild(buildPreferencesSection(settings));
    var backup = buildBackupSection();
    wrap.appendChild(backup.section);
    wrap.appendChild(buildDangerSection(backup.runExport));

    container.appendChild(wrap);
  }

  function render(container) {
    return load().then(function (settings) { draw(container, settings); });
  }

  return {
    defaults: defaults,
    exportCopyPlan: exportCopyPlan,
    resolveDownloadOutcome: resolveDownloadOutcome,
    triggerDownload: triggerDownload,
    load: load,
    save: save,
    exportFilename: exportFilename,
    validateKey: validateKey,
    render: render
  };
})();
