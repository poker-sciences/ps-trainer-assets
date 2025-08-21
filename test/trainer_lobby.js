/*
  PokerSciences – Liaison de la page Lobby

  Pour débutant:
  - Sur la page Lobby, vous avez des boutons/links déjà en place.
  - On leur ajoute un comportement: au clic, on lance une session (mode normal ou difficile)
    et on navigue vers la page des Questions.

  Ce que fait ce fichier:
  - Écoute les clics sur les éléments avec data-trainer-start="normal|difficile".
  - Démarre la session via le core, puis redirige vers /trainer/questions.
*/
(function () {
  if (window.PSTrainerLobby) {
    try { console.log('[Trainer/Lobby] Module déjà présent: on ne ré-initialise pas'); } catch (e) {}
    return;
  }

  function getCore() { return window.PSTrainerCore; }

  // Petits logs pédagogiques pour comprendre le flux côté Lobby
  function log(message, data) {
    if (data !== undefined) {
      console.log('[Trainer/Lobby] ' + message, data);
    } else {
      console.log('[Trainer/Lobby] ' + message);
    }
  }

  function onStartClick(ev) {
    ev.preventDefault();
    const el = ev.currentTarget;
    const mode = el.getAttribute('data-trainer-start') === 'difficile' ? 'difficile' : 'normal';
    const core = getCore();
    if (!core) return;
    log('Clic sur démarrer: on crée une nouvelle session et on va aux Questions', { mode });
    core.startSession(mode);
    core.navigateTo('/trainer/questions');
  }

  function bind() {
    const selectors = ['[data-trainer-start="normal"]', '[data-trainer-start="difficile"]'];
    const nodes = document.querySelectorAll(selectors.join(','));
    log('Binding des boutons de démarrage', { nbBoutons: nodes.length });
    nodes.forEach(function (el) {
      el.addEventListener('click', onStartClick);
    });
  }

  function guards() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    if (st.route.name !== 'lobby') return;
    // No special guard on lobby
    log('Garde Lobby: aucune restriction, vous pouvez démarrer une session');
  }

  function boot() {
    log('Boot Lobby: on attend le core si nécessaire, puis on bind les boutons');
    const core = getCore();
    if (!core) {
      document.addEventListener('core:ready', function () { bind(); guards(); }, { once: true });
      return;
    }
    bind();
    guards();
    log('Lobby prêt: boutons actifs, en attente d’un clic utilisateur');
  }

  window.PSTrainerLobby = { };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();


