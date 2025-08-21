/*
  PokerSciences – Liaison de la page Questions (Game)

  Pour débutant:
  - Deux types de réponses possibles dans le DOM: texte ([data-answer]) ou action de jeu ([data-move]).
  - Chaque réponse peut porter un attribut data-correct="true" si c'est la bonne.
  - Après un clic sur une réponse, on affiche un feedback (ok/ko), puis on passe à la suivante via un bouton [data-next].

  Ce que fait ce fichier:
  - Écoute les clics sur toutes les réponses; calcule le score/XP via le core si la réponse est correcte.
  - Affiche le feedback correspondant puis, au clic sur [data-next], enchaîne ou termine la session.
  - A la dernière question: termine la session et redirige vers /trainer/results.
  - Si on recharge la page Questions avec une session en cours, l'état est conservé grâce au core.
*/
(function () {
  if (window.PSTrainerGame) return;

  function getCore() { return window.PSTrainerCore; }

  function queryAllAnswers() {
    const textAnswers = Array.prototype.slice.call(document.querySelectorAll('[data-answer]'));
    const moveAnswers = Array.prototype.slice.call(document.querySelectorAll('[data-move]'));
    return textAnswers.concat(moveAnswers);
  }

  function getFeedbackEls() {
    return {
      ok: document.querySelector('[data-feedback="ok"]'),
      ko: document.querySelector('[data-feedback="ko"]')
    };
  }

  function hideFeedback() {
    const fb = getFeedbackEls();
    if (fb.ok) fb.ok.style.display = 'none';
    if (fb.ko) fb.ko.style.display = 'none';
  }

  function showFeedback(isCorrect) {
    const fb = getFeedbackEls();
    if (isCorrect) {
      if (fb.ok) fb.ok.style.display = '';
      if (fb.ko) fb.ko.style.display = 'none';
    } else {
      if (fb.ok) fb.ok.style.display = 'none';
      if (fb.ko) fb.ko.style.display = '';
    }
  }

  function getNextButton() {
    return document.querySelector('[data-next]');
  }

  function readTotalQuestions(core) {
    const st = core.getState();
    return st.session?.totalQuestions || 20;
  }

  const game = {
    currentIndex: 0,
    total: 0,
    locked: false,
    answersBound: false
  };

  function handleAnswerClick(ev) {
    ev.preventDefault();
    if (game.locked) return;
    const target = ev.currentTarget;
    const isCorrect = target.getAttribute('data-correct') === 'true';
    const core = getCore();
    if (!core) return;
    core.incrementScoreAndXp(Boolean(isCorrect));
    showFeedback(Boolean(isCorrect));
    game.locked = true;
  }

  function bindAnswers() {
    if (game.answersBound) return;
    const answers = queryAllAnswers();
    answers.forEach(function (el) {
      el.addEventListener('click', handleAnswerClick);
    });
    game.answersBound = true;
  }

  function unbindAnswers() {
    const answers = queryAllAnswers();
    answers.forEach(function (el) {
      el.removeEventListener('click', handleAnswerClick);
    });
    game.answersBound = false;
  }

  function nextQuestion() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    const last = game.currentIndex + 1 >= game.total;
    if (last) {
      core.endSession();
      core.navigateTo('/trainer/results');
      return;
    }
    game.currentIndex += 1;
    hideFeedback();
    game.locked = false;
  }

  function bindNext() {
    const btn = getNextButton();
    if (!btn) return;
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      nextQuestion();
    });
  }

  function guards() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    if (st.route.name !== 'questions') return;
    if (!st.session) {
      core.navigateTo('/trainer/lobby');
      return;
    }
  }

  function initCounters() {
    const core = getCore();
    if (!core) return;
    const st = core.getState();
    game.currentIndex = 0;
    game.total = readTotalQuestions(core);
    // Ensure session total is set from DOM if present
    core.setQuestionsTotal(game.total);
  }

  function boot() {
    const core = getCore();
    if (!core) {
      document.addEventListener('core:ready', function () { guards(); initCounters(); bindAnswers(); bindNext(); hideFeedback(); }, { once: true });
      return;
    }
    guards();
    initCounters();
    bindAnswers();
    bindNext();
    hideFeedback();
  }

  window.PSTrainerGame = { };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();


