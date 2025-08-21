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
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      const core = getCore();
      if (!core) return;
      // Clean session and go back to lobby
      core.resetSession();
      core.navigateTo('/trainer/lobby');
    });
  }

  function render() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    if (!st.session || !st.session.finishedAt) {
      core.navigateTo('/trainer/lobby');
      return;
    }

    const score = st.session.score || 0;
    const total = st.session.totalQuestions || 20;
    const xp = st.session.xp || 0;
    const isHard = st.session.mode === 'difficile';
    const flames = st.progress.flames || 1;

    setText('[data-result-score]', `${score}/${total}`);
    setText('[data-result-xp]', xp);
    const flamesEls = document.querySelectorAll('[count_flames]');
    flamesEls.forEach(function (el) { el.textContent = String(flames); });
    toggle('[data-result-mult-hard]', isHard);

    const appliedId = localStorage.getItem(APPLIED_KEY);
    if (appliedId !== st.session.id) {
      const applied = core.applyResultsToTotalsOnce();
      try { localStorage.setItem(APPLIED_KEY, st.session.id); } catch (_e) {}
      if (applied && window.PSTrainerServices && typeof window.PSTrainerServices.syncUserProgress === 'function') {
        const summary = {
          flames: st.progress.flames,
          xpTotal: st.progress.xpTotal,
          lastPlayDate: st.progress.lastPlayDate,
          level: st.progress.level
        };
        window.PSTrainerServices.syncUserProgress(summary).catch(function () {});
      }
    }
  }

  function guards() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    if (st.route.name !== 'results') return;
    if (!st.session || !st.session.finishedAt) {
      core.navigateTo('/trainer/lobby');
      return;
    }
  }

  function boot() {
    const core = getCore();
    if (!core) {
      document.addEventListener('core:ready', function () { guards(); render(); bindNext(); }, { once: true });
      return;
    }
    guards();
    render();
    bindNext();
  }

  window.PSTrainerResults = {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();


