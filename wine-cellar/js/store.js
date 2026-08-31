window.WC = window.WC || {};
WC.store = (function () {
  'use strict';
  var DB_NAME = 'wine-cellar';
  var dbName = DB_NAME;
  var db = null;
  var isAvailable = false;
  var STORES = ['bottles', 'drinks', 'photos', 'settings'];

  function newId() {
    return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function open() {
    return new Promise(function (resolve, reject) {
      if (db) { resolve(db); return; }
      if (!window.indexedDB) { isAvailable = false; reject(new Error('IndexedDB unavailable')); return; }
      var req;
      try { req = window.indexedDB.open(dbName, 1); }
      catch (e) { isAvailable = false; reject(e); return; }
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains('bottles')) { d.createObjectStore('bottles', { keyPath: 'id' }); }
        if (!d.objectStoreNames.contains('drinks')) { d.createObjectStore('drinks', { keyPath: 'id' }); }
        if (!d.objectStoreNames.contains('photos')) { d.createObjectStore('photos'); }
        if (!d.objectStoreNames.contains('settings')) { d.createObjectStore('settings'); }
      };
      req.onsuccess = function () { db = req.result; isAvailable = true; resolve(db); };
      req.onerror = function () { isAvailable = false; reject(req.error); };
    });
  }

  // Runs fn(store) inside a transaction over storeName(s) with the given mode.
  // fn should issue IndexedDB requests against the store and return the
  // request whose `.result` should become this call's resolved value (or
  // return nothing, for a write). Resolution happens on tx.oncomplete, not on
  // the individual request's onsuccess — by the time a transaction completes
  // every request it issued has already fired its own onsuccess/onerror, so
  // `.result` is safe to read here. We still distinguish "fn returned an
  // IDBRequest" from "fn returned nothing" with instanceof rather than a
  // truthiness/undefined check on `.result`, because a `get()` miss leaves
  // `.result` undefined while the request object itself is still truthy —
  // a naive check would resolve with the request object instead of
  // `undefined`, which callers like getSetting rely on to detect "no value".
  function tx(storeName, mode, fn) {
    return open().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(storeName, mode);
        var store = Array.isArray(storeName) ? null : t.objectStore(storeName);
        var out;
        try { out = fn(store, t); } catch (e) { reject(e); return; }
        t.oncomplete = function () {
          resolve(out instanceof IDBRequest ? out.result : out);
        };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('transaction aborted')); };
      });
    });
  }

  function useDatabase(name) { dbName = name; if (db) { db.close(); db = null; } }

  function available() { return isAvailable; }

  function putBottle(b) {
    var record = {};
    Object.keys(b).forEach(function (k) { record[k] = b[k]; });
    record.id = record.id || newId();
    record.createdAt = record.createdAt || new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    return tx('bottles', 'readwrite', function (store) {
      store.put(record);
    }).then(function () { return record; });
  }

  function getBottle(id) {
    return tx('bottles', 'readonly', function (store) {
      return store.get(id);
    });
  }

  function allBottles() {
    return tx('bottles', 'readonly', function (store) {
      return store.getAll();
    }).then(function (list) { return list || []; });
  }

  function deleteBottle(id) {
    return tx('bottles', 'readwrite', function (store) {
      store.delete(id);
    });
  }

  function putDrink(entry) {
    var record = {};
    Object.keys(entry).forEach(function (k) { record[k] = entry[k]; });
    record.id = record.id || newId();
    record.createdAt = record.createdAt || new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    return tx('drinks', 'readwrite', function (store) {
      store.put(record);
    }).then(function () { return record; });
  }

  function allDrinks() {
    return tx('drinks', 'readonly', function (store) {
      return store.getAll();
    }).then(function (list) { return list || []; });
  }

  function putPhoto(id, blob) {
    return tx('photos', 'readwrite', function (store) {
      store.put(blob, id);
    });
  }

  function getPhoto(id) {
    return tx('photos', 'readonly', function (store) {
      return store.get(id);
    });
  }

  function deletePhoto(id) {
    return tx('photos', 'readwrite', function (store) {
      store.delete(id);
    });
  }

  function getSetting(key) {
    return tx('settings', 'readonly', function (store) {
      return store.get(key);
    }).then(function (value) { return value === undefined ? null : value; });
  }

  function setSetting(key, value) {
    return tx('settings', 'readwrite', function (store) {
      store.put(value, key);
    });
  }

  function clearAll() {
    return tx(STORES, 'readwrite', function (_, t) {
      STORES.forEach(function (name) { t.objectStore(name).clear(); });
    });
  }

  // Enumerates every stored photo as {id, blob} pairs, id being the photos
  // store's out-of-line key (the owning bottle's id, by convention -- see
  // cellar.js/bottle.js/form.js, which all read and write photos keyed by
  // bottle.id). The array is populated by the cursor's own onsuccess
  // callbacks; because tx()'s transaction only completes once every request
  // it issued (including each cursor.continue()) has fired, the array is
  // fully built by the time this call resolves even though it is returned,
  // still empty, at the moment fn runs.
  function allPhotoEntries() {
    return tx('photos', 'readonly', function (store) {
      var entries = [];
      var req = store.openCursor();
      req.onsuccess = function () {
        var cursor = req.result;
        if (cursor) {
          entries.push({ id: cursor.key, blob: cursor.value });
          cursor.continue();
        }
      };
      return entries;
    });
  }

  // Blob -> base64 (no "data:...;base64," prefix), for embedding a photo in
  // the JSON export. Can fail (e.g. FileReader error on an unreadable blob);
  // callers must handle rejection rather than let it sink the whole export.
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result);
        var comma = result.indexOf(',');
        if (comma === -1) { reject(new Error('could not encode photo')); return; }
        resolve(result.slice(comma + 1));
      };
      reader.onerror = function () { reject(reader.error || new Error('could not read photo')); };
      try { reader.readAsDataURL(blob); } catch (e) { reject(e); }
    });
  }

  // Decodes one {data, type} export entry back into a Blob. Throws
  // synchronously (caught by validateBackup, before any write) on anything
  // that isn't decodable base64, so a corrupt photo is treated the same as
  // any other malformed backup: the whole import is rejected, nothing is
  // written, and the record is never corrupted by a garbage blob.
  function decodePhotoEntry(entry) {
    if (!entry || typeof entry !== 'object' || typeof entry.data !== 'string' || !entry.data) {
      throw new Error('Invalid backup: a photo entry is malformed.');
    }
    var type = typeof entry.type === 'string' && entry.type ? entry.type : 'application/octet-stream';
    var binary;
    try { binary = atob(entry.data); }
    catch (e) { throw new Error('Invalid backup: a photo could not be decoded.'); }
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
    return new Blob([bytes], { type: type });
  }

  // Writes a bottle record verbatim (id, createdAt, updatedAt unchanged).
  // Used only by import, which must preserve the imported timestamps so the
  // merge rule (newer updatedAt wins) still works on the next import.
  function putBottleRaw(record) {
    return tx('bottles', 'readwrite', function (store) {
      store.put(record);
    }).then(function () { return record; });
  }

  // Writes a drink record verbatim. See putBottleRaw.
  function putDrinkRaw(record) {
    return tx('drinks', 'readwrite', function (store) {
      store.put(record);
    }).then(function () { return record; });
  }

  // Photos are embedded base64-encoded, keyed by the owning bottle's id (the
  // same key the photos store already uses -- see allPhotoEntries above).
  // photosOmitted now counts photos that failed to encode (normally 0), not
  // photos left out by design: unlike Task 6's original cut, every stored
  // photo is now included on a best-effort basis, and this field reports
  // when that effort didn't fully succeed.
  function exportData() {
    return Promise.all([allBottles(), allDrinks(), allPhotoEntries()]).then(function (r) {
      var bottles = r[0], drinks = r[1], photoEntries = r[2];
      return Promise.all(photoEntries.map(function (entry) {
        return blobToBase64(entry.blob).then(function (data) {
          return { id: entry.id, ok: true, data: data, type: entry.blob.type || 'application/octet-stream' };
        }, function () {
          return { id: entry.id, ok: false };
        });
      })).then(function (encoded) {
        var photos = {};
        var omitted = 0;
        encoded.forEach(function (r) {
          if (r.ok) { photos[r.id] = { data: r.data, type: r.type }; } else { omitted += 1; }
        });
        return {
          format: 'wine-cellar', version: 1,
          exportedAt: new Date().toISOString(),
          photosOmitted: omitted,
          bottles: bottles, drinks: drinks,
          photos: photos
        };
      });
    });
  }

  function exportJson() {
    return exportData().then(function (d) { return JSON.stringify(d, null, 2); });
  }

  // Validates the backup text and, if it passes, also decodes every embedded
  // photo up front. Decoding here -- before importJson touches the database
  // -- is what keeps a corrupt/undecodable photo behaving like any other
  // malformed backup: the whole file is rejected and nothing is written,
  // rather than an import that partially succeeds and silently drops (or
  // worse, stores garbage for) one label.
  //
  // `photos` is optional on the parsed payload: an export produced before
  // photo backup existed has no such field at all, and must still validate
  // and import cleanly.
  function validateBackup(text) {
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { throw new Error('Invalid backup: not valid JSON.'); }
    if (!parsed || typeof parsed !== 'object') { throw new Error('Invalid backup: not an object.'); }
    if (parsed.format !== 'wine-cellar') { throw new Error('Invalid backup: not a wine cellar export.'); }
    // The format tag alone does not pin the shape: a future version 2 export
    // is free to change what a bottle or drink record looks like, and this
    // build would happily write those records as-is and call it an import.
    // A file we cannot claim to understand is rejected whole, before
    // anything is written. A version we can read (1) and a file with no
    // version at all (a hand-trimmed one) both still pass.
    var claimedVersion = Number(parsed.version);
    if (parsed.version !== undefined && parsed.version !== null && !(claimedVersion <= 1)) {
      throw new Error('Invalid backup: this app can only read version 1 backups, and this file says version ' +
        String(parsed.version) + '.');
    }
    if (!Array.isArray(parsed.bottles) || !Array.isArray(parsed.drinks)) {
      throw new Error('Invalid backup: missing bottles or drinks.');
    }
    var everyRecordUsable = parsed.bottles.concat(parsed.drinks).every(function (r) {
      return r && typeof r === 'object' && typeof r.id === 'string' && r.id.length > 0;
    });
    if (!everyRecordUsable) { throw new Error('Invalid backup: a record has no id.'); }

    var photoBlobs = {};
    if (parsed.photos !== undefined && parsed.photos !== null) {
      if (typeof parsed.photos !== 'object' || Array.isArray(parsed.photos)) {
        throw new Error('Invalid backup: photos must be an object.');
      }
      Object.keys(parsed.photos).forEach(function (id) {
        photoBlobs[id] = decodePhotoEntry(parsed.photos[id]);
      });
    }
    return { parsed: parsed, photoBlobs: photoBlobs };
  }

  function importJson(text) {
    return new Promise(function (resolve, reject) {
      var validated;
      // Tagged so the caller can tell "your file is bad" (everything
      // validateBackup throws) apart from "your file was fine but the
      // database write failed" (anything the writes below reject with).
      // Reporting the second as the first tells the owner to go find
      // another backup file when the one they have is perfectly good.
      try { validated = validateBackup(text); }
      catch (e) {
        if (e && typeof e === 'object') { e.invalidBackup = true; }
        reject(e);
        return;
      }
      resolve(validated);
    }).then(function (validated) {
      var parsed = validated.parsed;
      var photoBlobs = validated.photoBlobs;
      return Promise.all([allBottles(), allDrinks()]).then(function (existing) {
        var known = {};
        existing[0].concat(existing[1]).forEach(function (r) { known[r.id] = r.updatedAt || ''; });
        var report = { added: 0, updated: 0, skipped: 0 };
        var writes = [];
        // A photo follows its bottle: written when the bottle is added or
        // updated, left alone when the bottle is skipped by the newer-
        // updatedAt rule. That keeps a bottle and its label consistent
        // without needing a separate timestamp on the photo itself.
        function consider(record, put, isBottle) {
          var written;
          if (!(record.id in known)) { report.added += 1; writes.push(put(record)); written = true; }
          else if ((record.updatedAt || '') > known[record.id]) { report.updated += 1; writes.push(put(record)); written = true; }
          else { report.skipped += 1; written = false; }
          if (isBottle && written && Object.prototype.hasOwnProperty.call(photoBlobs, record.id)) {
            writes.push(putPhoto(record.id, photoBlobs[record.id]));
          }
        }
        parsed.bottles.forEach(function (b) { consider(b, putBottleRaw, true); });
        parsed.drinks.forEach(function (d) { consider(d, putDrinkRaw, false); });
        return Promise.all(writes).then(function () { return report; });
      });
    });
  }

  return {
    DB_NAME: DB_NAME,
    open: open,
    available: available,
    newId: newId,
    useDatabase: useDatabase,
    putBottle: putBottle,
    getBottle: getBottle,
    allBottles: allBottles,
    deleteBottle: deleteBottle,
    putDrink: putDrink,
    allDrinks: allDrinks,
    putPhoto: putPhoto,
    getPhoto: getPhoto,
    deletePhoto: deletePhoto,
    getSetting: getSetting,
    setSetting: setSetting,
    clearAll: clearAll,
    exportData: exportData,
    exportJson: exportJson,
    importJson: importJson
  };
})();
