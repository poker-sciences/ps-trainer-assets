/*
  PokerSciences – Gestion des Flammes (série de jours)

  Pour débutant:
  - Les "flammes" représentent votre série de jours joués (non capée).
  - Règle: si vous sautez 1 jour, la série continue; si vous sautez au moins 2 jours, on reset.
  - On affiche le compteur de flammes dans la navbar et ailleurs via l'attribut [count_flames].

  Ce que fait ce fichier:
  - Au chargement de chaque page: compare la date de dernier jeu à aujourd'hui (UTC).
      * Si l'écart >= 2 jours -> reset immédiat des flammes à 1 (et on met à jour l'affichage).
  - A la fin d'une partie: incrémente les flammes (+1) au plus une fois par jour et met lastPlayDate à aujourd'hui.
  - Met à jour partout les éléments [count_flames].
  - Peut synchroniser (push) vers des services externes si disponibles (sans bloquer l'UI).
*/
(function () {
  if (window.PSTrainerFlammes) return;

  function getCore() {
    return window.PSTrainerCore;
  }

  function updateDomFlames(flames) {
    const nodes = document.querySelectorAll('[count_flames]');
    nodes.forEach(function (el) {
      el.textContent = String(flames);
    });
  }

  function checkDailyReset() {
    const core = getCore();
    if (!core) return;
    const state = core.getState();
    const today = core.getTodayUtcDateString();
    const last = state.progress.lastPlayDate;
    if (!last) {
      updateDomFlames(state.progress.flames || 1);
      return;
    }
    const diff = core.diffDaysUtc(last, today);
    if (diff !== null && diff >= 2) {
      core.updateProgress({ flames: 1 }); // reset immédiat à 1
      updateDomFlames(1);
      return;
    }
    updateDomFlames(state.progress.flames || 1);
  }

  function onSessionFinishedIncrement() {
    const core = getCore();
    if (!core) return;
    const changed = core.creditTodayIfNeededIncrementFlames();
    const st = core.getState();
    updateDomFlames(st.progress.flames || 1);
    if (changed && window.PSTrainerServices && typeof window.PSTrainerServices.syncUserProgress === 'function') {
      // Fire-and-forget sync
      const summary = {
        flames: st.progress.flames,
        xpTotal: st.progress.xpTotal,
        lastPlayDate: st.progress.lastPlayDate,
        level: st.progress.level
      };
      window.PSTrainerServices.syncUserProgress(summary).catch(function () {});
    }
  }

  function boot() {
    const core = getCore();
    if (!core) {
      document.addEventListener('core:ready', checkDailyReset, { once: true });
      return;
    }
    checkDailyReset();
    core.on('progress:updated', function (progress) {
      updateDomFlames(progress.flames || 1);
    });
    core.on('session:finished', function () {
      onSessionFinishedIncrement();
    });
  }

  window.PSTrainerFlammes = {
    updateDomFlames,
    checkDailyReset
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();


