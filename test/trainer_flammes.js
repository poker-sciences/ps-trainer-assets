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
  if (window.PSTrainerFlammes) {
    try { console.log('[Trainer/Flammes] Module déjà présent: on ne ré-initialise pas'); } catch (e) {}
    return;
  }

  function getCore() {
    return window.PSTrainerCore;
  }

  // Logs pédagogiques pour suivre la logique des flammes
  function log(message, data) {
    if (data !== undefined) {
      console.log('[Trainer/Flammes] ' + message, data);
    } else {
      console.log('[Trainer/Flammes] ' + message);
    }
  }

  function updateDomFlames(flames) {
    const nodes = document.querySelectorAll('[count_flames]');
    nodes.forEach(function (el) {
      el.textContent = String(flames);
    });
    log('Affichage des flammes mis à jour', { flammes: flames, nbElements: nodes.length });
  }

  function checkDailyReset() {
    const core = getCore();
    if (!core) return;
    const state = core.getState();
    const today = core.getTodayUtcDateString();
    const last = state.progress.lastPlayDate;
    if (!last) {
      updateDomFlames(state.progress.flames || 1);
      log('Aucune dernière date de jeu: on affiche simplement la valeur courante');
      return;
    }
    const diff = core.diffDaysUtc(last, today);
    if (diff !== null && diff >= 2) {
      log('Reset quotidien: au moins 2 jours d’écart -> flammes remises à 1', { derniereDate: last, aujourdHui: today, diffJours: diff });
      core.updateProgress({ flames: 1 }); // reset immédiat à 1
      updateDomFlames(1);
      return;
    }
    updateDomFlames(state.progress.flames || 1);
    log('Pas de reset: on conserve la série', { derniereDate: last, aujourdHui: today, diffJours: diff });
  }

  function onSessionFinishedIncrement() {
    const core = getCore();
    if (!core) return;
    log('Fin de session détectée: on crédite la journée si besoin');
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
      log('Synchronisation (optionnelle) de la nouvelle valeur des flammes vers un service externe', summary);
      window.PSTrainerServices.syncUserProgress(summary).catch(function () { log('Sync externe: échec silencieux (ignoré)'); });
    }
  }

  function boot() {
    log('Boot Flammes: on vérifie le reset quotidien et on s’abonne aux événements');
    const core = getCore();
    if (!core) {
      document.addEventListener('core:ready', checkDailyReset, { once: true });
      return;
    }
    checkDailyReset();
    core.on('progress:updated', function (progress) {
      updateDomFlames(progress.flames || 1);
      log('Événement progress:updated -> mise à jour affichage des flammes', { flammes: progress.flames });
    });
    core.on('session:finished', function () {
      onSessionFinishedIncrement();
    });
    log('Flammes prêt: la logique réagira automatiquement aux événements du core');
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


