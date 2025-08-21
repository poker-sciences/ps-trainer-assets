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
  if (window.PSTrainerServices) return;

  const services = {
    // Hydrate progress fields from remote service. Returns { flames, xpTotal, lastPlayDate, level }
    async hydrateUserProgress() {
      // Placeholder: in the future, pull from Memberstack custom fields
      // Return null/undefined to indicate "no data" without error
      return null;
    },

    // Push progress fields to remote service. Accepts summary, returns boolean success.
    async syncUserProgress(summary) {
      // Placeholder: push to Memberstack/AWS when available
      void summary; // suppress linter about unused
      return true;
    },

    // Fetch questions based on mode/seed. For now, return empty array to let UI provide questions from DOM.
    async fetchQuestions(params) {
      void params;
      return [];
    },

    // Save results remotely (fire-and-forget)
    async saveResults(summary) {
      void summary;
      return true;
    }
  };

  window.PSTrainerServices = services;
})();


