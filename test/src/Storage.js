// Storage.js
// Ce module s'occupe du "profil" utilisateur et d'un identifiant stable.
// Il tente d'utiliser Memberstack si disponible, sinon il se rabat sur localStorage.

import { log } from './Utils.js';

const LS_PROFILE_KEY = 'ps_profile_v1';
const LS_ANON_ID_KEY = 'ps_anon_id_v1';
const LS_PROFILE_PENDING_UNTIL = 'ps_profile_pending_until_v1';
const MS_PENDING_WINDOW_MS = 8000; // fenêtre pendant laquelle on privilégie le cache local

// Valeurs par défaut du profil.
const DEFAULT_PROFILE = {
  xp_total: 0,
  level: 1,
  flames: 0,
  last_play_date: null, // toujours au format YYYY-MM-DD
};

// Tentative très simple d'adapter Memberstack s'il est présent.
// REMARQUE: L'API exacte peut varier selon ta configuration Memberstack.
// Ici on propose un contrat minimal et inoffensif si Memberstack est absent.
function isMemberstackAvailable() {
  if (typeof window === 'undefined') return false;
  // Supporte plusieurs variantes d'API exposées par Memberstack v1/v2
  return Boolean(
    window.Memberstack ||
    window.memberstack ||
    window.MemberStack ||
    (window.$memberstackDom && window.$memberstackDom.getCurrentMember)
  );
}

async function memberstackLoadProfile() {
  try {
    // Cette partie dépend de la configuration Memberstack (V1/V2).
    // On tente plusieurs stratégies, on retourne null si aucune ne fonctionne.

    // 1) Memberstack V2 runtime ($memberstackDom)
    if (window.$memberstackDom && window.$memberstackDom.getCurrentMember) {
      const res = await window.$memberstackDom.getCurrentMember();
      const cf = (res && (res.data?.customFields || res.customFields)) || {};
      const pick = (...keys) => {
        for (const k of keys) {
          const v = cf[k];
          if (v !== undefined && v !== null && String(v) !== '') return v;
        }
        return undefined;
      };

      const xpRaw = pick('xp_total', 'xpTotal', 'xp', 'xp-total');
      const levelRaw = pick('level', 'niveau');
      const flamesRaw = pick('flames', 'flammes');
      const lastRaw = pick('last_play_date', 'lastPlayDate', 'last_played', 'lastPlayed', 'last-play-date');

      const profile = {};
      if (xpRaw !== undefined) profile.xp_total = Number(xpRaw) || 0;
      if (levelRaw !== undefined) profile.level = Number(levelRaw) || 1;
      if (flamesRaw !== undefined) profile.flames = Number(flamesRaw) || 0;
      if (lastRaw !== undefined) {
        let ymd = lastRaw;
        try {
          if (ymd instanceof Date) ymd = ymd.toISOString().slice(0, 10);
          else if (typeof ymd === 'string' && ymd.includes('T')) ymd = ymd.slice(0, 10);
        } catch (e) {}
        profile.last_play_date = ymd || null;
      }
      return profile;
    }

    // 2) Memberstack V2/V1 objet global (getCustomFields)
    const ms = window.Memberstack || window.memberstack || window.MemberStack;
    if (ms && typeof ms.getCustomFields === 'function') {
      const fields = (await ms.getCustomFields()) || {};
      const profile = {};
      if (fields.xp_total !== undefined) profile.xp_total = Number(fields.xp_total) || 0;
      if (fields['xp-total'] !== undefined) profile.xp_total = Number(fields['xp-total']) || 0;
      if (fields.level !== undefined) profile.level = Number(fields.level) || 1;
      if (fields.flames !== undefined) profile.flames = Number(fields.flames) || 0;
      if (fields.last_play_date !== undefined) profile.last_play_date = fields.last_play_date || null;
      if (fields['last-play-date'] !== undefined) profile.last_play_date = fields['last-play-date'] || null;
      return profile;
    }

    // 3) API alternative: getCurrentMember() → { data: { customFields } }
    if (ms && typeof ms.getCurrentMember === 'function') {
      const res = await ms.getCurrentMember();
      const fields = (res && (res.customFields || res.data?.customFields)) || {};
      const profile = {};
      if (fields.xp_total !== undefined) profile.xp_total = Number(fields.xp_total) || 0;
      if (fields['xp-total'] !== undefined) profile.xp_total = Number(fields['xp-total']) || 0;
      if (fields.level !== undefined) profile.level = Number(fields.level) || 1;
      if (fields.flames !== undefined) profile.flames = Number(fields.flames) || 0;
      if (fields.last_play_date !== undefined) profile.last_play_date = fields.last_play_date || null;
      if (fields['last-play-date'] !== undefined) profile.last_play_date = fields['last-play-date'] || null;
      return profile;
    }

    // Rien d'exploitable → on laisse le fallback s'occuper du reste
    return null;
  } catch (e) {
    log('Memberstack indisponible (lecture), utilisation du fallback localStorage.');
    return null;
  }
}

async function memberstackSaveProfile(profile) {
  try {
    const payload = {
      xp_total: profile.xp_total != null ? String(profile.xp_total) : undefined,
      level: profile.level != null ? String(profile.level) : undefined,
      flames: profile.flames != null ? String(profile.flames) : undefined,
      last_play_date: profile.last_play_date || undefined,
    };

    // 1) V2 runtime
    const d = window.$memberstackDom;
    if (d) {
      // Construire l'objet minimal avec tous les slugs pertinents
      const customFields = {};
      if (payload.flames !== undefined) {
        customFields.flames = payload.flames;     // slug prioritaire
        customFields.flammes = payload.flames;    // alias éventuel observé côté MS
      }
      if (payload.xp_total !== undefined) {
        customFields['xp-total'] = payload.xp_total;
        customFields.xpTotal = payload.xp_total;
      }
      if (payload.last_play_date !== undefined) {
        customFields['last-play-date'] = payload.last_play_date;
        customFields.lastPlayDate = payload.last_play_date;
      }
      if (payload.level !== undefined) customFields.level = payload.level;

      // Warmup
      try { await d.getCurrentMember?.(); } catch (e) {}

      const attempts = [
        async () => typeof d.updateMember === 'function' && (await d.updateMember({ customFields })),
        async () => typeof d.updateMemberJSON === 'function' && (await d.updateMemberJSON({ customFields })),
        async () => typeof d.setCustomFields === 'function' && (await d.setCustomFields(customFields)),
        async () => typeof d.updateCustomFields === 'function' && (await d.updateCustomFields(customFields)),
        async () => typeof d.updateMemberJSON === 'function' && (await d.updateMemberJSON(customFields)),
      ];

      for (let i = 0; i < attempts.length; i += 1) {
        const fn = attempts[i];
        try {
          const res = await fn?.();
          if (res !== false) return true; // succès probable
        } catch (e) {
          // on tente la suivante
        }
      }
    }

    const ms = window.Memberstack || window.memberstack || window.MemberStack;
    if (!ms) return false;

    // 2) API directe updateCustomFields
    if (typeof ms.updateCustomFields === 'function') {
      await ms.updateCustomFields(payload);
      return true;
    }

    // 3) API alternative setCustomFields / updateCurrentMember
    if (typeof ms.setCustomFields === 'function') {
      await ms.setCustomFields(payload);
      return true;
    }
    if (typeof ms.updateCurrentMember === 'function') {
      await ms.updateCurrentMember({ customFields: payload });
      return true;
    }

    return false;
  } catch (e) {
    log('Memberstack indisponible (écriture), fallback localStorage.');
    return false;
  }
}

// Lecture du profil : Memberstack → localStorage → défauts.
export async function loadProfile() {
  // On lit toujours localStorage en premier
  let base = { ...DEFAULT_PROFILE };
  let usedMemberstack = false;
  try {
    const raw = localStorage.getItem(LS_PROFILE_KEY);
    if (raw) base = { ...base, ...JSON.parse(raw) };
  } catch (e) {
    log('Impossible de lire le profil localStorage, on repart sur les défauts.');
  }

  // Si on a une écriture récente, on privilégie le cache local pour éviter le va-et-vient
  let isPending = false;
  try {
    const until = Number(localStorage.getItem(LS_PROFILE_PENDING_UNTIL) || 0);
    if (until && Date.now() < until) isPending = true;
  } catch (e) {}

  // Sinon, on laisse Memberstack être la source de vérité et on écrase le local
  if (!isPending && isMemberstackAvailable()) {
    const msProfile = await memberstackLoadProfile();
    if (msProfile) {
      base = { ...base, ...msProfile };
      usedMemberstack = true;
    }
  }

  // Si on a enrichi depuis Memberstack, on met à jour le cache local
  if (usedMemberstack) {
    try { localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(base)); } catch (e) {}
  }

  return base;
}

// Lecture ultra-rapide (cache local uniquement) pour l'affichage initial.
export async function loadProfileFast() {
  try {
    const raw = localStorage.getItem(LS_PROFILE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_PROFILE };
}

// Écrit le profil complet.
export async function saveProfile(profile) {
  const prof = { ...DEFAULT_PROFILE, ...profile };

  // Essayer Memberstack d'abord
  const okMs = isMemberstackAvailable() && (await memberstackSaveProfile(prof));

  // Écrire aussi localement pour vitesse et offline
  try {
    localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(prof));
    // Marquer une fenêtre de préférence locale pour éviter que MS (éventuellement en retard)
    // ne réécrase immédiatement nos valeurs côté lecture.
    const windowMs = okMs ? 3000 : MS_PENDING_WINDOW_MS;
    localStorage.setItem(LS_PROFILE_PENDING_UNTIL, String(Date.now() + windowMs));
  } catch (e) {
    // Ignorer les erreurs de quota, etc.
  }

  return okMs; // true si écrit sur Memberstack, false sinon (mais local OK)
}

// Écrit seulement certains champs (merge partiel).
export async function patchProfile(partial) {
  const current = await loadProfile();
  const merged = { ...current, ...partial };
  await saveProfile(merged);
  return merged;
}

// Renvoie true si on a déjà crédité la flamme aujourd'hui.
export function isTodayCredited(profile, todayYMD) {
  return Boolean(profile && todayYMD && profile.last_play_date === todayYMD);
}

// Fournit un identifiant utilisateur stable (Memberstack si connecté, sinon anonId).
export async function getUserId() {
  try {
    // Si Memberstack expose un id utilisateur, on le renvoie.
    const ms = (window && (window.Memberstack || window.memberstack)) || null;
    const memberId = await ms?.getMemberId?.();
    if (memberId) return String(memberId);
  } catch (e) {
    // Pas de Memberstack, on continue
  }

  // Sinon on génère (une fois) un anonId et on le garde en localStorage.
  try {
    const existing = localStorage.getItem(LS_ANON_ID_KEY);
    if (existing) return existing;
    const anon = `anon_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(LS_ANON_ID_KEY, anon);
    return anon;
  } catch (e) {
    // Si localStorage n'est pas disponible, on renvoie un id volatil.
    return `anon_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const Storage = {
  loadProfile, loadProfileFast, saveProfile, patchProfile, isTodayCredited, getUserId,
};

export default Storage;


