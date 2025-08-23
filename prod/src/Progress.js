// Progress.js
// Ce module contient les règles métier: calcul des niveaux, progression, XP, et flammes.

import Config from './Config.js';

// levelFromXP(xp) → calcule le niveau correspondant à une XP totale.
export function levelFromXP(xpTotal) {
  const { LEVELS_XP_TABLE } = Config.get();
  const xp = Math.max(0, Number(xpTotal) || 0);
  // On cherche le plus grand niveau dont le seuil cumulé <= xp
  let level = 1;
  for (let i = 0; i < LEVELS_XP_TABLE.length; i += 1) {
    if (xp >= LEVELS_XP_TABLE[i]) level = i + 1; // i=0 → niveau 1
  }
  // On borne le niveau entre 1 et le nombre de niveaux disponibles
  return Math.max(1, Math.min(LEVELS_XP_TABLE.length, level));
}

// progressInLevel(xp) → informations utiles pour une barre de progression.
export function progressInLevel(xpTotal) {
  const { LEVELS_XP_TABLE } = Config.get();
  const xp = Math.max(0, Number(xpTotal) || 0);
  const currentLevel = levelFromXP(xp);
  const currentIndex = currentLevel - 1;
  const currentLevelBase = LEVELS_XP_TABLE[currentIndex];
  const nextLevelBase = LEVELS_XP_TABLE[Math.min(currentIndex + 1, LEVELS_XP_TABLE.length - 1)];
  const isMaxLevel = currentLevel === LEVELS_XP_TABLE.length;

  const xpInLevel = xp - currentLevelBase;
  const xpToNext = isMaxLevel ? 0 : Math.max(0, nextLevelBase - xp);
  const totalInThisLevel = isMaxLevel ? 1 : Math.max(1, nextLevelBase - currentLevelBase);
  const percent = Math.max(0, Math.min(100, Math.round((xpInLevel / totalInThisLevel) * 100)));

  return { currentLevel, xpInLevel, xpToNext, percent };
}

// sessionXP({ goodCount, advanced, flames }) → calcule l'XP gagnée pour une session.
export function sessionXP({ goodCount, advanced, flames }) {
  const { XP_PER_GOOD, ADVANCED_MULT } = Config.get();
  const base = (Number(goodCount) || 0) * XP_PER_GOOD;
  const multMode = advanced ? ADVANCED_MULT : 1;
  const multFlames = (Number(flames) || 0) === 0 ? 1 : Math.max(1, Number(flames));
  const total = Math.round(base * multMode * multFlames);
  return { base, multMode, multFlames, total };
}

// shouldResetFlames(lastYMD, todayYMD) → true si l'écart en jours est ≥ 2.
export function shouldResetFlames(lastYMD, todayYMD) {
  if (!lastYMD || !todayYMD) return false;
  // On calcule la différence en jours simplement en construisant des Date UTC.
  const parse = (y) => {
    const [Y, M, D] = String(y).split('-').map((v) => Number(v));
    return Date.UTC(Y, (M || 1) - 1, D || 1);
  };
  const a = parse(lastYMD);
  const b = parse(todayYMD);
  const diffDays = Math.floor(Math.abs(b - a) / 86400000);
  return diffDays >= 2;
}

// applyDailyFlame(profile, todayYMD) → +1 si pas encore crédité aujourd'hui.
export function applyDailyFlame(profile, todayYMD) {
  if (!profile) return profile;
  if (!todayYMD) return profile;
  if (profile.last_play_date === todayYMD) return profile; // déjà fait
  const next = { ...profile };
  next.flames = Math.max(0, Number(next.flames) || 0) + 1;
  next.last_play_date = todayYMD;
  return next;
}

const Progress = {
  levelFromXP,
  progressInLevel,
  sessionXP,
  shouldResetFlames,
  applyDailyFlame,
};

export default Progress;


