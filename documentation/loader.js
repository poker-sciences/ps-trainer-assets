// Script de chargement des modules Trainer sur Webflow (multi-fichiers)
// Si vous le collez dans un embed HTML, entourez ce contenu par <script> ... </script>
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

  // Découverte simple via un manifest statique publié dans /test (fallback si indisponible)
  var MANIFEST_URL = BASE + '/' + path + '/manifest.json';

  // Incrémentez VERSION pour invalider le cache navigateur
  var VERSION = 'v4';

  try {
    console.log(TAG, 'start', { host: host, base: BASE, path: path, manifest: MANIFEST_URL, version: VERSION });
  } catch (e) {}

  function staticFallbackList() {
    // Si le manifest est indisponible, on utilise cette liste minimale
    try { console.warn(TAG, 'using static fallback list'); } catch (e) {}
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
    try { console.info(TAG, 'loading files sequentially', files); } catch (e) {}
    var index = 0;
    function next() {
      if (index >= files.length) {
        try { console.log(TAG, 'all scripts loaded'); } catch (e) {}
        return;
      }
      var name = files[index++];
      // Skip invalid names (safety)
      if (!/^[-\w\.]+\.js$/i.test(name)) {
        try { console.warn(TAG, 'skip invalid name', name); } catch (e) {}
        return next();
      }
      var s = document.createElement('script');
      s.async = false; // on chaîne via onload pour garantir l'ordre
      s.src = BASE + '/' + path + '/' + name + '?v=' + VERSION;
      // De-duplication: if the same script (ignoring version) is already present, skip
      try {
        var selector = 'script[src^="' + BASE + '/' + path + '/' + name + '"]';
        if (document.querySelector(selector)) {
          console.info(TAG, 'already present, skip', name);
          return next();
        }
      } catch (e) {}
      try { console.log(TAG, 'loading', name, s.src); } catch (e) {}
      s.onload = function () {
        try { console.log(TAG, 'loaded', name); } catch (e) {}
        next();
      };
      s.onerror = function () {
        try { console.error(TAG, 'failed', name, s.src); } catch (e) {}
        next();
      };
      document.head.appendChild(s);
    }
    next();
  }

  function loadListAndStart() {
    try {
      if (!('fetch' in window)) {
        return loadSequential(staticFallbackList());
      }
      try { console.info(TAG, 'fetching manifest', MANIFEST_URL); } catch (e) {}
      fetch(MANIFEST_URL, { cache: 'no-store' })
        .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
        .then(function (files) {
          try {
            if (!Array.isArray(files) || files.length === 0) {
              try { console.warn(TAG, 'manifest empty or invalid, using fallback'); } catch (e) {}
              return loadSequential(staticFallbackList());
            }
            // Filtre défensif et préserve l'ordre du manifest.
            files = files.filter(function (name) { return typeof name === 'string' && /\.js$/i.test(name); });
            // Forcer trainer_core.js en premier s'il est présent, sans perturber l'ordre relatif du reste
            var i = files.indexOf('trainer_core.js');
            if (i > 0) {
              var core = files.splice(i, 1)[0];
              files.unshift(core);
            }
            try { console.info(TAG, 'manifest loaded', files); } catch (e) {}
            loadSequential(files);
          } catch (_e) {
            try { console.warn(TAG, 'manifest parse error, using fallback'); } catch (e) {}
            loadSequential(staticFallbackList());
          }
        })
        .catch(function (err) { try { console.warn(TAG, 'manifest fetch failed', err); } catch (e) {} loadSequential(staticFallbackList()); });
    } catch (_e) {
      try { console.warn(TAG, 'unexpected error, using fallback'); } catch (e) {}
      loadSequential(staticFallbackList());
    }
  }

  loadListAndStart();
})();