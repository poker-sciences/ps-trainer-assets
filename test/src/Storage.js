// Storage.js
// Ce module s'occupe du "profil" utilisateur et d'un identifiant stable.
// Il tente d'utiliser Memberstack si disponible, sinon il se rabat sur localStorage.

import { log } from './Utils.js';

const LS_PROFILE_KEY = 'ps_profile_v1';
const LS_ANON_ID_KEY = 'ps_anon_id_v1';

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
      // V2: la forme est { data: { customFields: {...} } }
      const cf = (res && (res.data?.customFields || res.customFields)) || {};
      // Normalisation des slugs potentiels (ex: "flammes" FR)
      const normalized = {
        xp_total: (cf.xp_total ?? cf.xpTotal ?? cf.xp) || 0,
        level: (cf.level ?? cf.niveau) ?? 1,
        flames: (cf.flames ?? cf.flammes) ?? 0,
        last_play_date: (cf.last_play_date ?? cf.lastPlayDate) ?? null,
      };
      return {
        xp_total: Number(normalized.xp_total) || 0,
        level: Number(normalized.level) || 1,
        flames: Number(normalized.flames) || 0,
        last_play_date: normalized.last_play_date || null,
      };
    }

    // 2) Memberstack V2/V1 objet global (getCustomFields)
    const ms = window.Memberstack || window.memberstack || window.MemberStack;
    if (ms && typeof ms.getCustomFields === 'function') {
      const fields = (await ms.getCustomFields()) || {};
      return {
        xp_total: Number(fields.xp_total) || 0,
        level: Number(fields.level) || 1,
        flames: Number(fields.flames) || 0,
        last_play_date: fields.last_play_date || null,
      };
    }

    // 3) API alternative: getCurrentMember() → { data: { customFields } }
    if (ms && typeof ms.getCurrentMember === 'function') {
      const res = await ms.getCurrentMember();
      const fields = (res && (res.customFields || res.data?.customFields)) || {};
      return {
        xp_total: Number(fields.xp_total) || 0,
        level: Number(fields.level) || 1,
        flames: Number(fields.flames) || 0,
        last_play_date: fields.last_play_date || null,
      };
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
      xp_total: String(profile.xp_total || 0),
      level: String(profile.level || 1),
      flames: String(profile.flames || 0),
      last_play_date: profile.last_play_date || null,
    };

    // 1) V2 runtime
    if (window.$memberstackDom && window.$memberstackDom.updateCurrentMember) {
      // On écrit à la fois en anglais et en éventuel alias français si présent dans ton app
      const customFields = {
        ...payload,
        flammes: payload.flames, // alias FR éventuel
        xpTotal: payload.xp_total,
        lastPlayDate: payload.last_play_date,
      };
      await window.$memberstackDom.updateCurrentMember({ customFields });
      return true;
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
  // 1) Essayer Memberstack si dispo
  if (isMemberstackAvailable()) {
    const msProfile = await memberstackLoadProfile();
    if (msProfile) {
      // On remplit les défauts au cas où il manque des champs
      return { ...DEFAULT_PROFILE, ...msProfile };
    }
  }

  // 2) Sinon localStorage
  try {
    const raw = localStorage.getItem(LS_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch (e) {
    log('Impossible de lire le profil localStorage, on repart sur les défauts.');
  }

  // 3) Défauts
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
  loadProfile, saveProfile, patchProfile, isTodayCredited, getUserId,
};

export default Storage;


