// Pages.js
// Ce module initialise 3 pages: Lobby, Questions, Results. Chaque init est un no-op
// si les éléments attendus ne sont pas présents dans le DOM (on ne casse rien).

import { $, $$, on, setText, setWidth, toggle } from './Utils.js';
import Config from './Config.js';
import Data from './Data.js';
import Storage from './Storage.js';
import Time from './Time.js';
import Progress from './Progress.js';
import Session from './Session.js';

// -------------------------------
// Helpers communs
// -------------------------------

function getSummaryFromSessionStorage() {
  try {
    const raw = sessionStorage.getItem('ps_session_summary_v1');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// -------------------------------
// Lobby
// -------------------------------

export async function initLobby() {
  // Vérifie la présence d'au moins un sélecteur spécifique au Lobby
  const levelNameEl = $('[data-trainer-level-name]');
  const levelBarEl = $('[data-trainer-level-bar]');
  const levelFillEl = $('[data-trainer-level-fill]');
  const levelPercentEl = $('[data-trainer-level-percent]');
  const playBtn = $('[data-trainer-play]');
  const modeSimpleBtn = $('[data-mode="simple"]');
  const modeAdvancedBtn = $('[data-mode="advanced"]');

  // Si aucun élément clé n'est présent, on considère que la page n'est pas le Lobby → no-op
  if (!levelNameEl && !levelBarEl && !playBtn) return;

  // 1) Profil + progression
  const profile = await Storage.loadProfile();
  const { currentLevel, percent } = Progress.progressInLevel(profile.xp_total);
  setText(levelNameEl, `Niveau ${currentLevel}`);
  setWidth(levelFillEl, percent);
  setText(levelPercentEl, `${percent}%`);

  // 2) Récupération des chapitres
  let chapters = [];
  try {
    chapters = await Data.getChapters();
  } catch (e) {
    // Si le backend est KO, on laisse la liste vide, l'UI existante gère le fallback.
  }

  // Remplir un <select> s'il existe, sinon une liste custom si fournie.
  const chapterSelect = $('[data-trainer-chapters]');
  if (chapterSelect && chapterSelect.tagName === 'SELECT') {
    chapterSelect.innerHTML = '';
    chapters.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.title || c.slug || c.id;
      chapterSelect.appendChild(opt);
    });
  } else {
    // Si pas de select standard, on cherche des éléments custom portant data-chapter-id
    const container = $('[data-trainer-chapters-list]');
    if (container) {
      container.innerHTML = '';
      chapters.forEach((c) => {
        const li = document.createElement('div');
        li.setAttribute('data-chapter-id', c.id);
        li.textContent = c.title || c.slug || c.id;
        container.appendChild(li);
      });
    }
  }

  // 3) Choix du mode
  let chosenMode = 'simple';
  on(modeSimpleBtn, 'click', () => {
    chosenMode = 'simple';
  });
  on(modeAdvancedBtn, 'click', () => {
    chosenMode = 'advanced';
  });

  // 4) Bouton Jouer → enregistre chapterId + mode en sessionStorage puis redirige
  on(playBtn, 'click', () => {
    let chapterId = null;
    if (chapterSelect && chapterSelect.tagName === 'SELECT') {
      chapterId = chapterSelect.value || null;
    } else {
      // tentative sur éléments custom: premier avec data-chapter-id et classe 'selected'
      const selected = $('[data-trainer-chapters-list] [data-chapter-id].selected');
      chapterId = selected ? selected.getAttribute('data-chapter-id') : null;
    }
    if (!chapterId && chapters[0]) chapterId = chapters[0].id; // fallback simple
    try {
      sessionStorage.setItem(
        'ps_lobby_choice_v1',
        JSON.stringify({ chapterId, mode: chosenMode })
      );
    } catch (e) {}
    // Redirection: on suppose que la page Questions est /trainer/questions
    window.location.href = '/trainer/questions';
  });
}

// -------------------------------
// Questions
// -------------------------------

export async function initQuestions() {
  // On vérifie la présence de quelques éléments spécifiques Questions
  const stemEl = $('[data-q-stem]');
  const choiceEls = $$('[data-q-choice]');
  const feedbackEl = $('[data-q-feedback]');
  const correctEl = $('[data-q-correct]');
  const nextBtn = $('[data-q-next]');
  if (!stemEl && !nextBtn) return; // no-op

  // Récupérer le choix du lobby
  let choice = null;
  try {
    choice = JSON.parse(sessionStorage.getItem('ps_lobby_choice_v1'));
  } catch (e) {}
  if (!choice || !choice.chapterId) {
    // Si on n'a pas de choix valide, on retourne au Lobby
    window.location.href = '/trainer/lobby';
    return;
  }

  // Charger les questions
  const cfg = Config.get();
  Session.start(choice.chapterId, choice.mode);
  let questions = [];
  try {
    questions = await Data.getQuestions({ chapterId: choice.chapterId, limit: cfg.QUESTION_COUNT });
  } catch (e) {
    questions = [];
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    // Si aucune question, retour Lobby
    window.location.href = '/trainer/lobby';
    return;
  }
  Session.setTotal(questions.length);

  // État local d'affichage
  let currentIndex = 0;
  let awaitingNext = false; // on bloque les clics pendant le feedback

  function renderQuestion(q) {
    if (!q) return;
    setText(stemEl, q.stem || '');
    const choices = Array.isArray(q.choices) ? q.choices : [];
    // On essaye d'associer data-q-choice="A"|"B"|"C"|"D" si présents
    const map = ['A', 'B', 'C', 'D'];
    map.forEach((key, i) => {
      const el = document.querySelector(`[data-q-choice="${key}"]`);
      if (el) setText(el, choices[i] || '');
    });
    // Reset feedback
    if (feedbackEl) feedbackEl.style.display = 'none';
    if (correctEl) setText(correctEl, '');
    awaitingNext = false;
  }

  function showFeedback(q, isCorrect) {
    if (!feedbackEl) return;
    feedbackEl.style.display = '';
    setText(feedbackEl, isCorrect ? 'Bonne réponse ✅' : 'Mauvaise réponse ❌');
    if (correctEl) {
      const index = Number(q.correctIndex);
      const choices = Array.isArray(q.choices) ? q.choices : [];
      setText(correctEl, `Solution: ${choices[index] ?? ''}`);
    }
    awaitingNext = true;
  }

  // Clic sur un choix
  ['A', 'B', 'C', 'D'].forEach((key, i) => {
    const el = document.querySelector(`[data-q-choice="${key}"]`);
    on(el, 'click', () => {
      if (awaitingNext) return;
      const q = questions[currentIndex];
      const isCorrect = Number(q.correctIndex) === i;
      Session.answer(isCorrect);
      showFeedback(q, isCorrect);
    });
  });

  // Bouton Suivant
  on(nextBtn, 'click', () => {
    if (!awaitingNext) return; // On ne passe à la suite qu'après feedback
    currentIndex += 1;
    Session.next();
    if (currentIndex >= questions.length) {
      // Fin de session → sauvegarde résumé et redirection vers résultats
      const chapter = questions[0]?.chapterTitle || '';
      Session.finish(chapter);
      window.location.href = '/trainer/results';
      return;
    }
    renderQuestion(questions[currentIndex]);
  });

  // Rendu initial
  renderQuestion(questions[currentIndex]);
}

// -------------------------------
// Results
// -------------------------------

export async function initResults() {
  const scoreEl = $('[data-r-score]');
  const xpBaseEl = $('[data-r-xp-base]');
  const multFlamesEl = $('[data-r-mult-flames]');
  const multModeEl = $('[data-r-mult-mode]');
  const xpTotalEl = $('[data-r-xp-total]');
  const levelNameEl = $('[data-trainer-level-name]');
  const levelFillEl = $('[data-trainer-level-fill]');
  const levelPercentEl = $('[data-trainer-level-percent]');

  if (!scoreEl && !xpTotalEl && !levelNameEl) return; // no-op

  // Lire le résumé
  const summary = getSummaryFromSessionStorage();
  if (!summary) {
    window.location.href = '/trainer/lobby';
    return;
  }

  // Calculs flamme + XP
  const tz = Time.getUserTZ();
  const todayYMD = Time.toYMDInTZ(Date.now(), tz);
  let profile = await Storage.loadProfile();
  // Reset des flammes si série cassée
  if (Progress.shouldResetFlames(profile.last_play_date, todayYMD)) {
    profile = await Storage.patchProfile({ flames: 0 });
  }
  // Crédit quotidien si pas encore fait aujourd'hui
  if (!Storage.isTodayCredited(profile, todayYMD)) {
    profile = await Storage.patchProfile({
      flames: Math.max(0, Number(profile.flames) || 0) + 1,
      last_play_date: todayYMD,
    });
  }

  // XP session
  const xp = Progress.sessionXP({
    goodCount: summary.goodCount,
    advanced: summary.advanced,
    flames: profile.flames,
  });

  const newXP = Math.max(0, Number(profile.xp_total) || 0) + xp.total;
  const newLevel = Progress.levelFromXP(newXP);
  profile = await Storage.patchProfile({ xp_total: newXP, level: newLevel });

  // Affichage
  setText(scoreEl, `${summary.goodCount}/${summary.total}`);
  setText(xpBaseEl, `${xp.base}`);
  setText(multFlamesEl, `×${xp.multFlames}`);
  setText(multModeEl, `×${xp.multMode}`);
  setText(xpTotalEl, `${xp.total}`);

  const prog = Progress.progressInLevel(profile.xp_total);
  setText(levelNameEl, `Niveau ${prog.currentLevel}`);
  setWidth(levelFillEl, prog.percent);
  setText(levelPercentEl, `${prog.percent}%`);
}

const Pages = { initLobby, initQuestions, initResults };

export default Pages;


