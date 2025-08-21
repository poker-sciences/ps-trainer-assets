/*
  PokerSciences – Trainer Services (intégrations optionnelles)

  Pour débutant:
  - Ce fichier représente des "portes" vers des services externes (Memberstack, API).
  - Pour l'instant, on met des "stubs" (= fausses fonctions) qui ne font rien côté serveur,
    mais qui permettent au reste du code de fonctionner en mode "offline" (local uniquement).

  Ce que fait ce fichier:
  - hydrateUserProgress(): si plus tard on peut charger (pull) les données depuis un service,
    cette fonction renverra les champs (flames, xpTotal...). Ici elle renvoie null -> pas de données.
  - syncUserProgress(summary): si plus tard on peut envoyer (push) les données en fin de partie,
    on le fera ici. Ici on répond "true" directement.
  - fetchQuestions / saveResults: points d'entrée pour futur backend (non utilisés ici).
  - Important: jamais bloquant pour l'UI et on ignore les erreurs.
*/
(function () {
  if (window.PSTrainerServices) {
    try { console.log('[Trainer/Services] Module déjà présent: on ne ré-initialise pas'); } catch (e) {}
    return;
  }

  const services = {
    // Hydrate progress fields from remote service. Returns { flames, xpTotal, lastPlayDate, level }
    async hydrateUserProgress() {
      // Log clair sur la tentative de lecture Memberstack (si présent)
      try { console.log('[Trainer/Services/MS] hydrateUserProgress: start → tentative de lecture des champs depuis Memberstack'); } catch (_e) {}

      // Détection du client Memberstack côté navigateur
      var msGlobal = (typeof window !== 'undefined') ? window.Memberstack : null;
      if (!msGlobal) {
        try { console.warn('[Trainer/Services/MS] hydrateUserProgress: Memberstack non détecté → mode offline (renvoie null)'); } catch (_e) {}
        return null;
      }

      // Petite aide pour imposer un timeout d'attente de onReady
      function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
          var t = setTimeout(function () { reject(new Error('Memberstack onReady timeout (' + ms + 'ms)')); }, ms);
          promise.then(function (v) { clearTimeout(t); resolve(v); }, function (err) { clearTimeout(t); reject(err); });
        });
      }

      // Attente (optionnelle) de onReady si disponible
      var ms = null;
      try {
        if (msGlobal && msGlobal.onReady && typeof msGlobal.onReady.then === 'function') {
          try { console.log('[Trainer/Services/MS] hydrateUserProgress: attente de Memberstack.onReady…'); } catch (_e) {}
          ms = await withTimeout(msGlobal.onReady, 5000);
        } else {
          ms = msGlobal;
        }
        try { console.log('[Trainer/Services/MS] hydrateUserProgress: Memberstack prêt'); } catch (_e) {}
      } catch (err) {
        try { console.error('[Trainer/Services/MS] hydrateUserProgress: échec onReady', { message: '' + (err && (err.message || err)), stack: err && err.stack }); } catch (_e) {}
        return null;
      }

      // Lecture des infos membre (API varie selon version; on tente plusieurs méthodes courantes)
      var member = null;
      try {
        if (ms && typeof ms.getMemberJSON === 'function') {
          member = await ms.getMemberJSON();
        } else if (ms && typeof ms.getCurrentMember === 'function') {
          member = await ms.getCurrentMember();
        } else if (ms && ms.currentMember) {
          member = ms.currentMember;
        }
        try { console.log('[Trainer/Services/MS] hydrateUserProgress: données brutes Memberstack', member); } catch (_e) {}
      } catch (err2) {
        try { console.error('[Trainer/Services/MS] hydrateUserProgress: lecture du membre a échoué', { message: '' + (err2 && (err2.message || err2)), stack: err2 && err2.stack }); } catch (_e) {}
        return null;
      }

      // Extraction défensive des champs personnalisés
      try {
        var custom = (member && (member.customFields || (member.data && member.data.customFields) || (member.user && member.user.customFields))) || {};
        var rawFlames = custom.flammes != null ? custom.flammes : custom.flamas != null ? custom.flamas : custom.flammesCount != null ? custom.flammesCount : custom.flammes_count;
        if (rawFlames == null) rawFlames = custom.flammes || custom.flames; // essais de noms
        var rawXp = custom.xp_total != null ? custom.xp_total : (custom.xpTotal != null ? custom.xpTotal : custom.total_xp);
        var rawLast = custom.last_play_date != null ? custom.last_play_date : (custom.lastPlayDate != null ? custom.lastPlayDate : custom.last_played_at);
        var rawLevel = (custom.level != null) ? custom.level : (member && (member.level != null ? member.level : (member.data && member.data.level)));

        var flames = parseInt(rawFlames, 10);
        var xpTotal = parseInt(rawXp, 10);
        var lastPlayDate = (typeof rawLast === 'string') ? rawLast : null;
        var level = rawLevel != null ? rawLevel : null;

        var result = {};
        if (Number.isFinite(flames)) result.flammes = flames; // on loggue aussi avec l’orthographe FR
        if (Number.isFinite(flames)) result.flames = flames;
        if (Number.isFinite(xpTotal)) result.xpTotal = xpTotal;
        if (lastPlayDate) result.lastPlayDate = lastPlayDate;
        if (level !== undefined) result.level = level;

        try { console.log('[Trainer/Services/MS] hydrateUserProgress: champs interprétés', result); } catch (_e) {}

        // On renvoie uniquement les clés attendues par le core.
        var clean = {};
        if (typeof result.flames === 'number') clean.flames = result.flames;
        if (typeof result.xpTotal === 'number') clean.xpTotal = result.xpTotal;
        if (typeof result.lastPlayDate === 'string') clean.lastPlayDate = result.lastPlayDate;
        if (result.level !== undefined) clean.level = result.level;
        return Object.keys(clean).length ? clean : null;
      } catch (err3) {
        try { console.error('[Trainer/Services/MS] hydrateUserProgress: extraction des champs a échoué', { message: '' + (err3 && (err3.message || err3)), stack: err3 && err3.stack }); } catch (_e) {}
        return null;
      }
    },

    // Push progress fields to remote service. Accepts summary, returns boolean success.
    async syncUserProgress(summary) {
      try { console.log('[Trainer/Services/MS] syncUserProgress: start → tentative de push vers Memberstack (simulation)', summary); } catch (_e) {}
      // Détection rapide et attente optionnelle (on ne push PAS réellement en environnement test)
      var msGlobal = (typeof window !== 'undefined') ? window.Memberstack : null;
      if (!msGlobal) {
        try { console.warn('[Trainer/Services/MS] syncUserProgress: Memberstack non détecté → no-op (offline)'); } catch (_e) {}
        return true;
      }
      try {
        var ms = (msGlobal && msGlobal.onReady && typeof msGlobal.onReady.then === 'function') ? await msGlobal.onReady : msGlobal;
        // Ici, par précaution on n’écrit pas côté client; on loggue juste le payload qui serait envoyé
        var payload = {
          customFields: {
            flames: summary && typeof summary.newFlames === 'number' ? summary.newFlames : undefined,
            xp_total: summary && typeof summary.addedXp === 'number' ? summary.addedXp : undefined,
            last_play_date: summary && summary.todayDate ? summary.todayDate : undefined,
            level: summary && (summary.levelAfter != null) ? summary.levelAfter : undefined
          }
        };
        try { console.log('[Trainer/Services/MS] syncUserProgress: payload théorique pour Memberstack (aucune écriture effectuée)', payload); } catch (_e) {}
        void ms; // éviter l’avertissement "unused"
      } catch (err) {
        try { console.error('[Trainer/Services/MS] syncUserProgress: échec d’initialisation Memberstack (no-op)', { message: '' + (err && (err.message || err)), stack: err && err.stack }); } catch (_e) {}
      }
      return true; // on reste en succès pour ne pas bloquer l’UI
    },

    // Fetch questions based on mode/seed. For now, return empty array to let UI provide questions from DOM.
    async fetchQuestions(params) {
      void params;
      console.log('[Trainer/Services] Appel fetchQuestions(params) -> renvoie [] (les questions viennent du DOM)', params);
      return [];
    },

    // Save results remotely (fire-and-forget)
    async saveResults(summary) {
      void summary;
      console.log('[Trainer/Services] Appel saveResults(summary) -> simulation réussie (aucun backend)');
      return true;
    }
  };

  window.PSTrainerServices = services;
})();


