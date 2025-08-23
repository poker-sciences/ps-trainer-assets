// Utils.js
// Ce module regroupe de petites fonctions utilitaires réutilisables partout.
// Objectif : écrire moins de code répétitif et rendre le code plus lisible.

import Config from './Config.js';

// ---------------------------
// Aides DOM
// ---------------------------

// $(sélecteur) → renvoie le premier élément qui correspond au sélecteur CSS.
export function $(selector, root = document) {
  return root.querySelector(selector);
}

// $$(sélecteur) → renvoie TOUS les éléments qui correspondent (sous forme de tableau).
export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

// on(element, eventName, callback) → ajoute un écouteur d'événement simple.
export function on(element, eventName, callback) {
  if (!element) return;
  element.addEventListener(eventName, callback);
}

// setText(element, text) → met à jour le texte d'un élément.
export function setText(element, text) {
  if (!element) return;
  element.textContent = String(text);
}

// setWidth(element, percent) → change la largeur CSS d'un élément (utile pour la barre de progression).
export function setWidth(element, percent) {
  if (!element) return;
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  element.style.width = `${safe}%`;
}

// toggle(element, show) → affiche/masque un élément.
export function toggle(element, show) {
  if (!element) return;
  element.style.display = show ? '' : 'none';
}

// ---------------------------
// Aides diverses
// ---------------------------

// clamp(n, min, max) → force n à rester entre min et max.
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// round(n, step) → arrondi n au multiple le plus proche de step (ex: round(53, 10) = 50).
export function round(n, step = 1) {
  if (step <= 0) return n;
  return Math.round(n / step) * step;
}

// log(...args) → console.log **seulement** si DEBUG=true dans la Config.
export function log(...args) {
  try {
    const { DEBUG } = Config.get();
    if (DEBUG) {
      // On préfixe pour repérer facilement dans la console.
      // eslint-disable-next-line no-console
      console.log('[PS-Trainer]', ...args);
    }
  } catch (e) {
    // En cas de souci d'accès à Config, on ne log pas pour rester silencieux.
  }
}

// randomNonce() → génère une petite chaîne aléatoire, pratique pour les requêtes non-cachées.
export function randomNonce(length = 12) {
  // On génère des octets aléatoires avec l'API Web Crypto (sécurisée)
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback (moins sécurisé) si l'API n'existe pas, pour compatibilité.
    for (let i = 0; i < length; i += 1) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  // On convertit en base64url simplifiée (caractères sûrs dans une URL)
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, length);
}

const Utils = {
  $, $$, on, setText, setWidth, toggle, clamp, round, log, randomNonce,
};

export default Utils;


