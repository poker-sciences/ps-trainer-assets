// Data.js
// Ce module parle avec le backend AWS pour récupérer les chapitres et les questions.
// Il n'expose que des fonctions simples: getChapters() et getQuestions({ chapterId, limit }).

import Config from './Config.js';
import { log } from './Utils.js';
import { randomNonce } from './Utils.js';

// Petite aide: fetch avec timeout (par défaut 8 secondes) et un retry simple.
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function httpGetJson(url, { timeoutMs = 8000, retry = 1 } = {}) {
  const tryOnce = async () => {
    const res = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  };

  try {
    return await tryOnce();
  } catch (e) {
    if (retry > 0) {
      log('Requête échouée, on réessaie une fois...', url);
      return tryOnce();
    }
    throw e;
  }
}

// Récupère la liste des chapitres: [{ id, slug, title, description }, ...]
export async function getChapters() {
  const { API_BASE_URL } = Config.get();
  const url = `${API_BASE_URL}/chapters`;
  return httpGetJson(url, { timeoutMs: 8000, retry: 1 });
}

// Récupère des questions aléatoires pour un chapitre donné.
// Paramètres: { chapterId, limit = Config.QUESTION_COUNT }
export async function getQuestions({ chapterId, limit } = {}) {
  if (!chapterId) throw new Error('chapterId est requis');
  const cfg = Config.get();
  const finalLimit = Number(limit) || cfg.QUESTION_COUNT;
  const nonce = randomNonce();
  const url = `${cfg.API_BASE_URL}/chapters/${encodeURIComponent(
    chapterId
  )}/questions?limit=${encodeURIComponent(finalLimit)}&nonce=${encodeURIComponent(nonce)}`;
  const data = await httpGetJson(url, { timeoutMs: 8000, retry: 1 });
  // On s'assure de retourner un tableau (même vide) pour simplifier le code appelant.
  return Array.isArray(data) ? data : [];
}

const Data = { getChapters, getQuestions };

export default Data;


