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
  return typeof window !== 'undefined' && (window.Memberstack || window.memberstack);
}

async function memberstackLoadProfile() {
  try {
    // Cette partie dépend de ta configuration Memberstack.
    // On essaie un schéma générique et on fallback si rien n'est dispo.
    const ms = window.Memberstack || window.memberstack;
    if (!ms) return null;

    // Hypothèse : on peut lire des "custom fields". À adapter si besoin.
    const fields = (await ms.getCustomFields?.()) || {};
    const profile = {
      xp_total: Number(fields.xp_total) || 0,
      level: Number(fields.level) || 1,
      flames: Number(fields.flames) || 0,
      last_play_date: fields.last_play_date || null,
    };
    return profile;
  } catch (e) {
    log('Memberstack indisponible (lecture), utilisation du fallback localStorage.');
    return null;
  }
}

async function memberstackSaveProfile(profile) {
  try {
    const ms = window.Memberstack || window.memberstack;
    if (!ms) return false;
    const payload = {
      xp_total: String(profile.xp_total || 0),
      level: String(profile.level || 1),
      flames: String(profile.flames || 0),
      last_play_date: profile.last_play_date || null,
    };
    await ms.updateCustomFields?.(payload);
    return true;
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


