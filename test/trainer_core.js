/*
  PokerSciences – Trainer Core

  Qu'est-ce que c'est ?
  - Le "cerveau" de l'application côté client. Il garde l'état (session en cours, XP total, flammes, etc.),
    applique les règles métier (gardes de navigation, calcul d'XP), persiste localement (localStorage),
    et fournit un petit bus d'événements pour que les autres fichiers puissent réagir aux changements.

  A qui ça parle ? (débutant)
  - "Session": une partie que vous lancez depuis le Lobby et qui se termine sur les Résultats.
  - "Progression": vos infos persistantes (flammes = série, xpTotal, lastPlayDate, level).
  - "Guarde" (guard): une vérification qui empêche d'accéder à une page si les conditions ne sont pas remplies.

  Ce que fait ce fichier (vue d'ensemble):
  - État central + sauvegarde: garde la session et la progression, et sauvegarde dans localStorage.
  - Bus d'événements: permet à d'autres modules d'écouter (ex: on('progress:updated', ...)).
  - Routage logique: détecte la page (lobby/questions/results) et applique des gardes (ex: pas de session => retour lobby).
  - Navigation contrôlée: petite fonction navigateTo('/trainer/...') pour rediriger proprement.
  - Cycle de session: démarrer -> répondre aux questions -> terminer -> appliquer les résultats.
  - Boot idempotent: si le script est chargé deux fois, il ne s'initialise qu'une seule fois.

  Important:
  - Aucun HTML n'est créé ici. On ne fait que gérer l'état/les règles, et on laisse les autres fichiers 
    (lobby/game/results/navbar) se brancher sur le DOM déjà présent.
  - Tolérant aux slashes finaux, query string et hash dans l'URL.

  Lecture conseillée:
  - Commencez par startSession(), incrementScoreAndXp(), endSession(), applyResultsToTotalsOnce().
  - Regardez ensuite guardRouteAccess() et navigateTo() pour la navigation.
*/
(function () {
  if (window.PSTrainerCore) {
    // Idempotent: si le core existe déjà, on ne ré-initialise pas
    return;
  }

  // Clés pour le stockage local
  const STORAGE_KEY = "ps_trainer_state_v1"; // où l'on sauvegarde l'état
  const RESULTS_APPLIED_KEY = "ps_trainer_last_result_applied_session_id"; // évite de compter 2x les points
  const DEFAULT_QUESTIONS_TOTAL = 20; // nombre de questions par défaut

  // Petit utilitaire pour des logs pédagogiques et cohérents
  function log(message, data) {
    if (data !== undefined) {
      console.log('[Trainer/Core] ' + message, data);
    } else {
      console.log('[Trainer/Core] ' + message);
    }
  }

  // Convertit un objet Date en chaîne AAAA-MM-JJ en UTC
  function toUtcDateString(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Renvoie la date du jour (UTC) au format AAAA-MM-JJ
  function getTodayUtcDateString() {
    return toUtcDateString(new Date());
  }

  // Différence en jours entre deux dates (UTC) sous forme de chaînes AAAA-MM-JJ
  function diffDaysUtc(fromDateString, toDateString) {
    if (!fromDateString || !toDateString) return null;
    const from = new Date(fromDateString + "T00:00:00.000Z");
    const to = new Date(toDateString + "T00:00:00.000Z");
    const ms = to.getTime() - from.getTime();
    return Math.floor(ms / (24 * 60 * 60 * 1000));
  }

  // Génère un petit ID aléatoire lisible
  function randomId(prefix) {
    const rand = Math.random().toString(36).slice(2, 10);
    const now = Date.now().toString(36);
    return `${prefix}_${now}_${rand}`;
  }

  // Normalise un chemin d'URL (supprime le slash final sauf pour "/")
  function normalizePathname(pathname) {
    const a = document.createElement("a");
    a.href = pathname;
    let normalized = a.pathname || "/";
    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  // Détecte la route courante (lobby, questions, results, autre)
  function detectRoute() {
    const raw = window.location.pathname;
    const path = normalizePathname(raw);
    const route = { path, name: "other" };
    if (path === "/trainer/lobby") route.name = "lobby";
    else if (path === "/trainer/questions") route.name = "questions";
    else if (path === "/trainer/results") route.name = "results";
    return route;
  }

  // Lit le nombre de questions depuis le DOM si présent, sinon valeur par défaut
  function readQuestionsTotalFromDom() {
    const el = document.querySelector('[data-questions-total]');
    if (!el) return DEFAULT_QUESTIONS_TOTAL;
    const val = parseInt(el.getAttribute('data-questions-total') || "", 10);
    return Number.isFinite(val) && val > 0 ? val : DEFAULT_QUESTIONS_TOTAL;
  }

  // Clone simple pour éviter les effets de bord quand on expose l'état
  function deepClone(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  }

  // --- Bus d'événements minimal ---
  const eventMap = new Map(); // eventName -> Set<handler>
  function on(eventName, handler) {
    if (!eventMap.has(eventName)) eventMap.set(eventName, new Set());
    const set = eventMap.get(eventName);
    set.add(handler);
    return function off() {
      set.delete(handler);
    };
  }
  function emit(eventName, detail) {
    const set = eventMap.get(eventName);
    if (!set) return;
    // Log des événements pour visualiser les interactions entre modules
    log('Événement émis → ' + eventName, detail);
    for (const handler of set) {
      try { handler(detail); } catch (err) { /* on ignore les erreurs de handler */ }
    }
  }

  // Valeurs par défaut pour la partie persistée
  const persistedDefault = {
    session: null,
    progress: {
      flames: 1, // baseline streak display
      xpTotal: 0,
      lastPlayDate: null, // YYYY-MM-DD (UTC) or null
      level: null
    }
  };

  // Charge depuis localStorage et sécurise les champs
  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(persistedDefault);
      const parsed = JSON.parse(raw);
      // Defensive merge
      return {
        session: parsed.session || null,
        progress: {
          flames: typeof parsed.progress?.flames === "number" ? parsed.progress.flames : 1,
          xpTotal: typeof parsed.progress?.xpTotal === "number" ? parsed.progress.xpTotal : 0,
          lastPlayDate: parsed.progress?.lastPlayDate || null,
          level: parsed.progress?.level ?? null
        }
      };
    } catch (_e) {
      return deepClone(persistedDefault);
    }
  }

  // Sauvegarde dans localStorage un "snapshot" filtré (pas d'éphémères)
  function savePersisted(state) {
    const snapshot = {
      session: state.session ? {
        id: state.session.id,
        mode: state.session.mode,
        seed: state.session.seed,
        totalQuestions: state.session.totalQuestions,
        score: state.session.score,
        xp: state.session.xp,
        startedAt: state.session.startedAt,
        finishedAt: state.session.finishedAt || null
      } : null,
      progress: deepClone(state.progress)
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (_e) {
      // swallow
    }
  }

  // --- État en mémoire ---
  const state = {
    ready: false,
    route: detectRoute(),
    session: null,
    progress: loadPersisted().progress
  };

  // Notifie (événement) et persiste l'état
  function notifyState() {
    savePersisted(state);
    emit("state:updated", getState());
    log('État sauvegardé dans localStorage et notifié (state:updated)');
  }

  // Expose une copie de l'état (pas l'original)
  function getState() {
    return {
      ready: state.ready,
      route: deepClone(state.route),
      session: deepClone(state.session),
      progress: deepClone(state.progress)
    };
  }

  // Actualise la route depuis l'URL
  function setRouteFromLocation() {
    state.route = detectRoute();
    emit("route:changed", deepClone(state.route));
    log('Route détectée depuis l’URL', deepClone(state.route));
  }

  // Empêche l'accès à certaines pages sans session valide
  function guardRouteAccess() {
    const r = state.route.name;
    if ((r === "questions" || r === "results") && !state.session) {
      log('Garde de navigation: pas de session -> retour au Lobby');
      navigateTo("/trainer/lobby");
      return false;
    }
    if (r === "results" && state.session && !state.session.finishedAt) {
      // Allow results only when session finished, otherwise return to questions
      log('Garde de navigation: session non terminée -> retour aux Questions');
      navigateTo("/trainer/questions");
      return false;
    }
    log('Garde de navigation: accès autorisé pour la route', r);
    return true;
  }

  // Redirection simple et normalisée
  function navigateTo(path) {
    const normalized = normalizePathname(path);
    if (normalized === state.route.path) return; // no-op
    log('Navigation vers', normalized);
    window.location.assign(normalized);
  }

  // Démarre une nouvelle session à partir d'un mode (normal/difficile)
  function startSession(mode) {
    const modeNorm = mode === "difficile" ? "difficile" : "normal";
    const total = readQuestionsTotalFromDom();
    const nowIso = new Date().toISOString();
    state.session = {
      id: randomId("sess"),
      mode: modeNorm,
      seed: `${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      totalQuestions: total,
      score: 0,
      xp: 0,
      startedAt: nowIso,
      finishedAt: null
    };
    log('Session démarrée (mode, questions, id, seed)', {
      mode: modeNorm,
      totalQuestions: total,
      id: state.session.id,
      seed: state.session.seed
    });
    notifyState();
    emit("session:started", deepClone(state.session));
  }

  // Marque la session comme terminée (une seule fois)
  function endSession() {
    if (!state.session || state.session.finishedAt) return;
    state.session.finishedAt = new Date().toISOString();
    log('Session terminée', { id: state.session.id, finishedAt: state.session.finishedAt });
    notifyState();
    emit("session:finished", deepClone(state.session));
  }

  // Réinitialise la session en mémoire
  function resetSession() {
    state.session = null;
    log('Session réinitialisée (aucune session en cours)');
    notifyState();
    emit("session:reset", null);
  }

  // Incrémente score et XP selon la règle (si bonne réponse)
  function incrementScoreAndXp(isCorrect) {
    if (!state.session) return;
    const isHard = state.session.mode === "difficile";
    const difficultyMultiplier = isHard ? 1.5 : 1;
    const flamesMultiplier = Math.max(state.progress.flames || 0, 1);
    const before = { score: state.session.score, xp: state.session.xp };
    if (isCorrect) {
      state.session.score += 1;
      state.session.xp += Math.round(10 * flamesMultiplier * difficultyMultiplier);
      notifyState();
      log('Bonne réponse: score et XP augmentent', {
        avant: before,
        apres: { score: state.session.score, xp: state.session.xp },
        multiplicateurs: { flammes: flamesMultiplier, difficulte: difficultyMultiplier }
      });
    } else {
      log('Mauvaise réponse: le score et l’XP ne changent pas', before);
    }
  }

  // Ajoute l'XP de la session aux totaux exactement une fois
  function applyResultsToTotalsOnce() {
    if (!state.session || !state.session.finishedAt) return false;
    const appliedId = localStorage.getItem(RESULTS_APPLIED_KEY);
    if (appliedId === state.session.id) return false; // already applied
    const xpSession = state.session.xp || 0;
    state.progress.xpTotal = (state.progress.xpTotal || 0) + xpSession;
    try { localStorage.setItem(RESULTS_APPLIED_KEY, state.session.id); } catch (_e) {}
    notifyState();
    emit("progress:updated", deepClone(state.progress));
    log('XP de la session ajouté aux totaux (une seule fois)', {
      sessionId: state.session.id,
      xpSession,
      xpTotal: state.progress.xpTotal
    });
    return true;
  }

  // Permet d'ajuster le nombre de questions (ex: si on lit une valeur depuis le DOM)
  function setQuestionsTotal(total) {
    if (!state.session) return;
    const t = Number(total);
    if (Number.isFinite(t) && t > 0) {
      state.session.totalQuestions = t;
      notifyState();
      log('Nombre de questions de la session mis à jour', t);
    }
  }

  // Mets à jour la progression (flammes/xpTotal/lastPlayDate/level) et notifie
  function updateProgress(patch) {
    state.progress = Object.assign({}, state.progress, patch || {});
    notifyState();
    emit("progress:updated", deepClone(state.progress));
    log('Progression mise à jour (flammes/xpTotal/date/level)', deepClone(state.progress));
  }

  // Indique si la journée a déjà été créditée
  function hasCreditedToday() {
    const today = getTodayUtcDateString();
    return state.progress.lastPlayDate === today;
  }

  // Incrémente les flammes au plus une fois par jour et met la date du jour
  function creditTodayIfNeededIncrementFlames() {
    const today = getTodayUtcDateString();
    if (state.progress.lastPlayDate !== today) {
      const currentFlames = typeof state.progress.flames === "number" ? state.progress.flames : 1;
      const nextFlames = currentFlames + 1;
      updateProgress({ flames: nextFlames, lastPlayDate: today });
      emit("flames:updated", { flames: nextFlames, reason: "session_end" });
      log('Fin de session: flammes incrémentées pour la journée', { de: currentFlames, a: nextFlames, date: today });
      return true;
    }
    log('Fin de session: flammes déjà créditées aujourd’hui, pas de changement', { date: today, flammes: state.progress.flames });
    return false;
  }

  // Hydrate la progression depuis des services distants (si dispo), sans bloquer l'UI
  async function hydrateFromServicesIfAvailable() {
    const svc = window.PSTrainerServices;
    if (!svc || typeof svc.hydrateUserProgress !== "function") return;
    try {
      log('Hydratation depuis les services: tentative de lecture distante…');
      const data = await svc.hydrateUserProgress();
      if (!data) return;
      const next = {
        flames: typeof data.flames === "number" ? data.flames : state.progress.flames,
        xpTotal: typeof data.xpTotal === "number" ? data.xpTotal : state.progress.xpTotal,
        lastPlayDate: data.lastPlayDate || state.progress.lastPlayDate,
        level: data.level ?? state.progress.level
      };
      updateProgress(next);
      log('Hydratation: progression fusionnée avec les données distantes', next);
    } catch (_e) {
      // ignore service errors
      log('Hydratation: échec silencieux (les erreurs service sont ignorées)');
    }
  }

  // Point d'entrée: détecte la route, applique les gardes, puis notifie "core:ready"
  function boot() {
    log('Boot du core: détection de la route et application des gardes');
    setRouteFromLocation();

    // Navigation guards
    if (!guardRouteAccess()) return;

    state.ready = true;
    notifyState();
    emit("core:ready", getState());
    log('Core prêt: les autres modules peuvent se brancher (core:ready)');

    // Attempt hydration (non-blocking)
    hydrateFromServicesIfAvailable();
  }

  // Public API
  const api = {
    on,
    emit,
    getState,
    startSession,
    endSession,
    resetSession,
    incrementScoreAndXp,
    setQuestionsTotal,
    updateProgress,
    applyResultsToTotalsOnce,
    navigateTo,
    hasCreditedToday,
    creditTodayIfNeededIncrementFlames,
    getTodayUtcDateString,
    diffDaysUtc
  };

  window.PSTrainerCore = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();


