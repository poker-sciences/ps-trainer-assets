// Config.js
// Ce module centralise tous les réglages globaux de l'application.
// Objectif : avoir un seul endroit où modifier les nombres et les URLs.
// La fonction Config.get() renvoie TOUJOURS une COPIE gelée (lecture seule)
// pour éviter les modifications accidentelles ailleurs dans le code.

// Table d'XP cumulée pour 35 niveaux (exemple simple et progressif).
// Niveau 1 commence à 0 XP, puis chaque niveau nécessite un peu plus que le précédent.
// Pour un vrai projet, ajuste librement ces valeurs.
const DEFAULT_LEVELS_XP_TABLE = (() => {
  const levels = [0]; // niveau 1 atteint à 0 XP
  let total = 0;
  let step = 50; // le premier palier est de 50 XP
  for (let i = 1; i < 35; i += 1) {
    total += step;
    levels.push(total);
    step += 10; // chaque niveau demande 10 XP de plus que le précédent
  }
  return levels; // 35 entrées au total
})();

// Configuration interne (source de vérité).
const INTERNAL_CONFIG = {
  // Métier
  QUESTION_COUNT: 20, // nombre de questions par session
  XP_PER_GOOD: 10, // XP par bonne réponse
  ADVANCED_MULT: 1.5, // multiplicateur du mode avancé
  LEVELS_XP_TABLE: DEFAULT_LEVELS_XP_TABLE,

  // Backend
  API_BASE_URL: 'https://api.pokersciences.com',

  // Divers
  DEBUG: false,
  VERSION:
    (typeof window !== 'undefined' && (window.PS_VERSION || window.__PS_VERSION__)) ||
    'dev',
};

// Petite fonction utilitaire qui gèle récursivement un objet (deep freeze),
// pour garantir qu'il ne sera pas modifié ailleurs par erreur.
function deepFreeze(object) {
  if (object && typeof object === 'object' && !Object.isFrozen(object)) {
    Object.freeze(object);
    Object.getOwnPropertyNames(object).forEach((prop) => {
      // eslint-disable-next-line no-prototype-builtins
      if (object.hasOwnProperty(prop)) {
        deepFreeze(object[prop]);
      }
    });
  }
  return object;
}

// Retourne une COPIE gelée de la configuration.
// On copie d'abord (pour éviter de renvoyer la même référence),
// puis on applique deepFreeze pour que cette copie soit en lecture seule.
function get() {
  const copy = JSON.parse(JSON.stringify(INTERNAL_CONFIG));
  return deepFreeze(copy);
}

const Config = { get };

export default Config;


