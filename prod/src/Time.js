// Time.js
// Ce module gère le fuseau horaire et les calculs liés aux "jours" indépendamment de l'heure.

import { log } from './Utils.js';

// getUserTZ() → renvoie une chaîne IANA, ex: "Europe/Paris".
export function getUserTZ() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === 'string') return tz;
  } catch (e) {
    log('Impossible de détecter le TZ, fallback UTC');
  }
  return 'UTC';
}

// toYMDInTZ(dateOrMs, tz) → renvoie YYYY-MM-DD correspondant à la date dans ce TZ.
export function toYMDInTZ(dateOrMs, tz) {
  const d = typeof dateOrMs === 'number' ? new Date(dateOrMs) : new Date(dateOrMs);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // 'en-CA' formatte par défaut en YYYY-MM-DD → pratique pour obtenir le format désiré.
  return formatter.format(d);
}

// parseYMD("YYYY-MM-DD") → renvoie un objet { y, m, d } (nombres).
function parseYMD(ymd) {
  if (!ymd || typeof ymd !== 'string') return null;
  const [y, m, d] = ymd.split('-').map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
}

// diffDaysYMD(a, b) → écart en jours entre 2 dates au format YYYY-MM-DD (valeur absolue).
export function diffDaysYMD(a, b) {
  const pa = parseYMD(a);
  const pb = parseYMD(b);
  if (!pa || !pb) return NaN;
  // On crée des dates à minuit UTC pour éviter les décalages d'heure locale.
  const da = Date.UTC(pa.y, pa.m - 1, pa.d);
  const db = Date.UTC(pb.y, pb.m - 1, pb.d);
  const diffMs = Math.abs(db - da);
  return Math.floor(diffMs / 86400000); // 1000*60*60*24
}

// isTodayYMD(ymd, tz) → vrai si ymd est la date d'aujourd'hui dans ce TZ.
export function isTodayYMD(ymd, tz) {
  const today = toYMDInTZ(Date.now(), tz);
  return today === ymd;
}

const Time = { getUserTZ, toYMDInTZ, diffDaysYMD, isTodayYMD };

export default Time;


