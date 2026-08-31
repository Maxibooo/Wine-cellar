'use strict';

// Stamped by build.py: the suffix is a content hash of every file in the
// ASSETS list below, so it changes by itself whenever any cached file does --
// and so does this file, which is what makes the browser reinstall the
// worker at all (a worker whose bytes are unchanged is never reinstalled,
// and this one is cache-first with no revalidation). Do not edit the value
// by hand; run `python build.py` after changing any cached file. activate
// deletes every cache that isn't this one, so the superseded cache never
// lingers once a client picks up the new worker.
var CACHE_NAME = 'wine-cellar-74e30336bd12';

var ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/errors.js',
  'js/knowledge.js',
  'js/vintages.js',
  'js/windows.js',
  'js/store.js',
  'js/photos.js',
  'js/ai.js',
  'js/ui/format.js',
  'js/ui/cellar.js',
  'js/ui/form.js',
  'js/ui/bottle.js',
  'js/ui/history.js',
  'js/ui/settings.js',
  'js/ui/router.js',
  'js/app.js'
];

// skipWaiting() moves this worker straight to "activating" instead of
// parking in "waiting" behind the tab that's still open -- this is a
// single-user, single-tab personal app with short sessions, so there is no
// other client whose in-flight work a takeover could disrupt. Paired with
// clients.claim() below, this is what actually makes "reload once" (rather
// than "close every tab and reopen") true, which is the update behaviour
// the README promises.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Deletes every cache that isn't this version's, so an owner who reloads
// after an update is not left holding assets from the cache the new
// install step just superseded. clients.claim() takes control of any page
// already open under the old worker, so that reload is served by the new
// worker/cache immediately rather than needing the tab closed and reopened.
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        return name === CACHE_NAME ? null : caches.delete(name);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Cache-first: serve from the versioned cache when present, otherwise fall
// back to the network (and let that request fail plainly offline -- there
// is nothing cached for it to fall back to).
//
// Only GET, same-origin requests are considered for the cache at all. This
// doesn't change behaviour today -- the app's one cross-origin call (the
// direct browser-to-Anthropic POST in js/ai.js) was already left alone,
// since respondWith wrapped a lookup that would simply miss the cache and
// fall through to fetch() for it -- but stating the guard up front makes
// the cache-first intent visible in the code instead of resting on that
// chain of reasoning holding up unchanged in the future.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req);
    })
  );
});
