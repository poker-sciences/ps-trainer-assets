// Script de chargement des modules Trainer sur Webflow (multi-fichiers)
(function () {
  if (window.__PST_LOADER_RUNNING__) {
    try { console.warn('[Trainer Loader]', 'already running - skipping'); } catch (e) {}
    return;
  }
  window.__PST_LOADER_RUNNING__ = true;
  var host = location.hostname;
  var isTest = (host === 'poker-sciences.webflow.io' || host.endsWith('.webflow.io'));

  var BASE = 'https://poker-sciences.github.io/ps-trainer-assets';
  // Pour l'instant on charge depuis /test (les builds prod suivront la même structure)
  var path = 'test'; // était: isTest ? 'test' : 'prod'
  var TAG = '[Trainer Loader]';
  var loadedFiles = [];
  var failedFiles = [];

  // Découverte simple via un manifest statique publié dans /test (fallback si indisponible)
  var MANIFEST_URL = BASE + '/' + path + '/manifest.json';

  // Incrémentez VERSION pour invalider le cache navigateur
  var VERSION = 'v6';

  // Minimal logging only at the end
  try { console.log(TAG, 'start: BASE=' + BASE + ', path=' + path + ', VERSION=' + VERSION); } catch (e) {}

  // Filtre optionnel pour ignorer les erreurs bruyantes de tiers (ex: timeouts Memberstack) en TEST
  function installThirdPartyNoiseFilter() {
    try {
      window.addEventListener('unhandledrejection', function (e) {
        try {
          var r = e && e.reason ? e.reason : {};
          var msg = '' + (r && (r.message || r.toString() || ''));
          var stack = '' + (r && r.stack ? r.stack : '');
          var url = '';
          try { url = (r && r.config && r.config.url) ? r.config.url : ''; } catch (_ignored) {}
          var blob = msg + ' ' + stack + ' ' + url;
          var isMemberstack = /memberstack/i.test(blob);
          var isTimeout = /timeout exceeded|ERR_TIMED_OUT/i.test(blob);
          if (isMemberstack && isTimeout) {
            try { console.warn(TAG, 'Memberstack timeout ignoré (environnement test)', { message: msg, url: url }); } catch (_e) {}
            e.preventDefault();
          }
        } catch (_e) {}
      });
    } catch (_e) {}
  }

  function staticFallbackList() {
    // Si le manifest est indisponible, on utilise cette liste minimale
    return [
      'trainer_core.js',
      'trainer_services.js',
      'trainer_flammes.js',
      'trainer_navbar.js',
      'trainer_lobby.js',
      'trainer_game.js',
      'trainer_results.js'
    ];
  }

  function loadSequential(files) {
    var index = 0;
    function next() {
      if (index >= files.length) {
        try { console.log(TAG, 'loaded:', loadedFiles); } catch (e) {}
        if (failedFiles.length) {
          try { console.error(TAG, 'failed:', failedFiles); } catch (e) {}
          try { console.error(TAG, 'status: ERROR'); } catch (e) {}
        } else {
          try { console.log(TAG, 'status: OK'); } catch (e) {}
        }
        return;
      }
      var name = files[index++];
      // Skip invalid names (safety)
      if (!/^[-\w\.]+\.js$/i.test(name)) {
        return next();
      }
      var s = document.createElement('script');
      s.async = false; // on chaîne via onload pour garantir l'ordre
      s.src = BASE + '/' + path + '/' + name + '?v=' + VERSION;
      // De-duplication: if the same script (ignoring version) is already present, skip
      try {
        var selector = 'script[src^="' + BASE + '/' + path + '/' + name + '"]';
        if (document.querySelector(selector)) {
          return next();
        }
      } catch (e) {}
      s.onload = function () {
        try { loadedFiles.push(name); } catch (e) {}
        next();
      };
      s.onerror = function () {
        try { failedFiles.push(name); } catch (e) {}
        next();
      };
      document.head.appendChild(s);
    }
    next();
  }

  function loadListAndStart() {
    try {
      installThirdPartyNoiseFilter();
      if (!('fetch' in window)) {
        var fbNoFetch = staticFallbackList();
        return loadSequential(fbNoFetch);
      }
      fetch(MANIFEST_URL, { cache: 'no-store' })
        .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
        .then(function (files) {
          try {
            if (!Array.isArray(files) || files.length === 0) {
              var fbEmpty = staticFallbackList();
              return loadSequential(fbEmpty);
            }
            // Filtre défensif et préserve l'ordre du manifest.
            files = files.filter(function (name) { return typeof name === 'string' && /\.js$/i.test(name); });
            // Forcer trainer_core.js en premier s'il est présent, sans perturber l'ordre relatif du reste
            var i = files.indexOf('trainer_core.js');
            if (i > 0) {
              var core = files.splice(i, 1)[0];
              files.unshift(core);
            }
            loadSequential(files);
          } catch (_e) {
            var fbParse = staticFallbackList();
            loadSequential(fbParse);
          }
        })
        .catch(function () {
          var fbFetch = staticFallbackList();
          loadSequential(fbFetch);
        });
    } catch (_e) {
      var fbErr = staticFallbackList();
      loadSequential(fbErr);
    }
  }

  loadListAndStart();
})();