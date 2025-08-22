//
// loader.js — Script à copier-coller dans un embed code Webflow
// - Charge dynamiquement les scripts depuis /prod ou /test hébergés sur
//   https://ps-trainer-assets.pages.dev
// - Sélectionne l'environnement selon le domaine :
//   pokersciences.com => prod, poker-sciences.webflow.io => test (par défaut: test)
// - Récupère la liste des fichiers et la version via le manifest.json de l'environnement
// - Utilise la version du manifeste comme cache-buster (?v=...) pour forcer l'actualisation
// - Journalise dans la console l'environnement, la version et la liste des scripts chargés
//
(function () {
  'use strict';

  // Base publique des assets (Cloudflare Pages)
  var BASE_URL = 'https://ps-trainer-assets.pages.dev';

  // Détermine l'environnement depuis le domaine
  var host = (window.location && window.location.hostname) || '';
  var env;
  if (/(^|\.)pokersciences\.com$/i.test(host)) {
    env = 'prod';
  } else if (/^poker-sciences\.webflow\.io$/i.test(host)) {
    env = 'test';
  } else {
    // Par défaut: test si domaine inconnu
    env = 'test';
  }

  // Cache-busting agressif pour le manifeste (timestamp + token aléatoire)
  var manifestUrl = BASE_URL + '/' + env + '/manifest.json?ts=' + Date.now() + '-' + Math.random().toString(36).slice(2);

  function loadScriptSequentially(scriptUrls) {
    var index = 0;
    return new Promise(function (resolve, reject) {
      function next() {
        if (index >= scriptUrls.length) return resolve();
        var src = scriptUrls[index++];
        var el = document.createElement('script');
        el.src = src;
        el.async = false; // préserver l'ordre
        el.defer = false;
        el.onload = next;
        el.onerror = function () {
          reject(new Error('Echec de chargement du script: ' + src));
        };
        (document.head || document.documentElement).appendChild(el);
      }
      next();
    });
  }

  function toArrayOfStrings(value) {
    if (Array.isArray(value)) return value.filter(function (x) { return typeof x === 'string'; });
    return [];
  }

  function safeVersionFromManifest(manifest) {
    if (manifest && typeof manifest === 'object' && typeof manifest.version === 'string') {
      return manifest.version;
    }
    return 'v-unknown';
  }

  function filesFromManifest(manifest) {
    if (manifest && typeof manifest === 'object' && Array.isArray(manifest.files)) {
      return toArrayOfStrings(manifest.files);
    }
    // Compat: ancien format = tableau brut
    if (Array.isArray(manifest)) {
      return toArrayOfStrings(manifest);
    }
    return [];
  }

  fetch(manifestUrl, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' pour ' + manifestUrl);
      return res.json();
    })
    .then(function (manifest) {
      var version = safeVersionFromManifest(manifest);
      var files = filesFromManifest(manifest);

      var scriptUrls = files.map(function (name) {
        return BASE_URL + '/' + env + '/' + encodeURIComponent(name) + '?v=' + encodeURIComponent(version);
      });

      return loadScriptSequentially(scriptUrls)
        .then(function () {
          var modeLabel = env === 'prod' ? 'PROD' : 'TEST';
          var list = files.map(function (f) { return '- ' + f; }).join('\n');
          console.log('[Trainer Loader] ' + modeLabel + ' | version: ' + version + ' | scripts chargés:\n' + list);
        });
    })
    .catch(function (err) {
      console.error('[Trainer Loader] Erreur:', err && err.message ? err.message : err);
    });
})();