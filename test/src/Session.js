// Session.js
// Ce module gère l'état d'une session de questions: index, total, bonnes réponses, etc.

// État interne de la session. On le garde ici, simple et clair.
let state = null;

// start(chapterId, mode) → démarre une nouvelle session.
export function start(chapterId, mode) {
  const now = Date.now();
  state = {
    index: 0,
    total: 0,
    goodCount: 0,
    mode: mode === 'advanced', // true/false
    chapterId: chapterId || null,
    startedAt: now,
  };
}

// answer(isCorrect) → enregistre si la réponse courante est correcte.
export function answer(isCorrect) {
  if (!state) return;
  if (isCorrect) state.goodCount += 1;
}

// next() → passe à la question suivante (index++).
export function next() {
  if (!state) return;
  state.index += 1;
}

// setTotal(n) → fixe le nombre total de questions.
export function setTotal(n) {
  if (!state) return;
  state.total = Math.max(0, Number(n) || 0);
}

// getState() → renvoie une copie de l'état pour lecture.
export function getState() {
  if (!state) return null;
  return { ...state };
}

// finish(chapterTitle) → sauvegarde un résumé minimal en sessionStorage.
export function finish(chapterTitle) {
  if (!state) return null;
  const endedAt = Date.now();
  const summary = {
    goodCount: state.goodCount,
    total: state.total,
    advanced: Boolean(state.mode),
    chapterTitle: chapterTitle || '',
    startedAt: state.startedAt,
    endedAt,
  };
  try {
    sessionStorage.setItem('ps_session_summary_v1', JSON.stringify(summary));
  } catch (e) {
    // Ignorer si le stockage de session n'est pas accessible.
  }
  const copy = { ...summary };
  state = null; // on termine la session
  return copy;
}

const Session = { start, answer, next, setTotal, getState, finish };

export default Session;


