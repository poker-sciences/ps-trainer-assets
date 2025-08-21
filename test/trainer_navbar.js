/*
  PokerSciences – Liaison de la Navbar

  Pour débutant:
  - La navbar existe déjà dans Webflow (HTML/CSS). On ne la recrée pas.
  - Ici, on met juste à jour le texte des éléments qui ont l'attribut [count_flames]
    pour afficher la valeur actuelle des flammes (série).

  Ce que fait ce fichier:
  - Lit la valeur dans l'état central (core) et met à jour tous les [count_flames].
  - S'abonne aux événements de mise à jour pour être "live".
*/
(function () {
  if (window.PSTrainerNavbar) return;

  function getCore() { return window.PSTrainerCore; }

  // Logs pédagogiques pour visualiser les mises à jour de la navbar
  function log(message, data) {
    if (data !== undefined) {
      console.log('[Trainer/Navbar] ' + message, data);
    } else {
      console.log('[Trainer/Navbar] ' + message);
    }
  }

  function refresh() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    const flames = st.progress.flames || 1;
    const els = document.querySelectorAll('[count_flames]');
    els.forEach(function (el) { el.textContent = String(flames); });
    log('Mise à jour de l’affichage des flammes dans la navbar', { flammes: flames, nbElements: els.length });
  }

  function boot() {
    log('Boot Navbar: on se met à jour et on s’abonne aux changements');
    const core = getCore();
    if (!core) {
      document.addEventListener('core:ready', refresh, { once: true });
      return;
    }
    refresh();
    core.on('progress:updated', function () { refresh(); });
    core.on('flames:updated', function () { refresh(); });
    log('Navbar prête: elle se mettra à jour automatiquement sur les événements');
  }

  window.PSTrainerNavbar = { refresh };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();


