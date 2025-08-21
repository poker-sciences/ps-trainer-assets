/*
  PokerSciences – Liaison de la page Résultats

  Pour débutant:
  - Cette page doit afficher le score, l'XP de la session, le nombre de flammes (série)
    et un indicateur x1.5 si le mode était "difficile".
  - On doit aussi écrire l'XP de la session dans l'XP total (exactement une fois),
    même si on recharge la page.

  Ce que fait ce fichier:
  - Lit la session terminée via le core et remplit les éléments du DOM:
      * [data-result-score]: affiche "score/N"
      * [data-result-xp]: XP de la session
      * [count_flames]: compteur courant des flammes
      * [data-result-mult-hard]: visible si mode difficile
  - Applique une seule fois l'XP de la session aux totaux (garde anti-double comptage via l'ID de session).
  - Peut synchroniser (push) vers un service externe sans bloquer l'affichage.
  - Bouton [data-result-next]: remet l'état de session à zéro et renvoie au Lobby.
*/
(function () {
  if (window.PSTrainerResults) return;

  const APPLIED_KEY = "ps_trainer_last_result_applied_session_id";

  function getCore() { return window.PSTrainerCore; }

  // Logs pédagogiques pour la page Résultats
  function log(message, data) {
    if (data !== undefined) {
      console.log('[Trainer/Results] ' + message, data);
    } else {
      console.log('[Trainer/Results] ' + message);
    }
  }

  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = String(text);
  }

  function toggle(selector, visible) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.style.display = visible ? '' : 'none';
  }

  function bindNext() {
    const el = document.querySelector('[data-result-next]');
    if (!el) return;
    log('Binding du bouton "rejouer/continuer" (retour au Lobby)');
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      const core = getCore();
      if (!core) return;
      // Clean session and go back to lobby
      log('Clic sur "suivant" en résultats: on réinitialise la session et retour Lobby');
      core.resetSession();
      core.navigateTo('/trainer/lobby');
    });
  }

  function render() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    if (!st.session || !st.session.finishedAt) {
      log('Pas de session terminée -> retour au Lobby');
      core.navigateTo('/trainer/lobby');
      return;
    }

    const score = st.session.score || 0;
    const total = st.session.totalQuestions || 20;
    const xp = st.session.xp || 0;
    const isHard = st.session.mode === 'difficile';
    const flames = st.progress.flames || 1;

    log('Affichage des résultats', { score, total, xp, mode: st.session.mode, flammes: flames });

    setText('[data-result-score]', `${score}/${total}`);
    setText('[data-result-xp]', xp);
    const flamesEls = document.querySelectorAll('[count_flames]');
    flamesEls.forEach(function (el) { el.textContent = String(flames); });
    toggle('[data-result-mult-hard]', isHard);

    const appliedId = localStorage.getItem(APPLIED_KEY);
    if (appliedId !== st.session.id) {
      log('Application unique de l’XP de session aux totaux');
      const applied = core.applyResultsToTotalsOnce();
      try { localStorage.setItem(APPLIED_KEY, st.session.id); } catch (_e) {}
      if (applied && window.PSTrainerServices && typeof window.PSTrainerServices.syncUserProgress === 'function') {
        const summary = {
          flames: st.progress.flames,
          xpTotal: st.progress.xpTotal,
          lastPlayDate: st.progress.lastPlayDate,
          level: st.progress.level
        };
        log('Synchronisation (optionnelle) des progrès vers un service externe', summary);
        window.PSTrainerServices.syncUserProgress(summary).catch(function () { log('Sync externe: échec silencieux (ignoré)'); });
      }
    }
  }

  function guards() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    if (st.route.name !== 'results') return;
    if (!st.session || !st.session.finishedAt) {
      log('Garde Résultats: session non terminée -> redirection Lobby');
      core.navigateTo('/trainer/lobby');
      return;
    }
    log('Garde Résultats: session terminée détectée, on peut afficher');
  }

  function boot() {
    log('Boot Results: on vérifie la session, on affiche et on bind le bouton');
    const core = getCore();
    if (!core) {
      document.addEventListener('core:ready', function () { guards(); render(); bindNext(); }, { once: true });
      return;
    }
    guards();
    render();
    bindNext();
    log('Résultats prêts: affichage complété');
  }

  window.PSTrainerResults = {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();


