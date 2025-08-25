// Navbar.js
// Ce module gère l'affichage du compteur de flammes 🔥 dans la navbar.

import { $, setText } from './Utils.js';
import Storage from './Storage.js';
import Time from './Time.js';
import Progress from './Progress.js';

const SELECTOR_FLAMES = '[data-trainer-flames]';

async function setFlamesWithFade(el, value, animate = true) {
  if (!el) return;
  const newText = String(Number(value) || 0);
  const oldText = String((el.textContent || '').trim());
  // Toujours marquer prêt
  el.setAttribute('data-ready', '1');
  // Si pas d'animation ou pas de changement, écrire direct
  if (!animate || oldText === '' || oldText === newText) {
    setText(el, newText);
    el.style.opacity = '1';
    return;
  }
  // Animation: fade-out (400ms) -> swap texte -> fade-in (400ms)
  try {
    // Assurer une transition
    if (!el.style.transition) {
      el.style.transition = 'opacity 400ms ease';
    }
    el.style.opacity = '1';
    // Fade out
    el.style.opacity = '0';
    await new Promise((r) => setTimeout(r, 410));
    // Swap texte pendant invisible
    setText(el, newText);
    // Fade in
    el.style.opacity = '1';
    await new Promise((r) => setTimeout(r, 410));
  } catch (e) {
    setText(el, newText);
    el.style.opacity = '1';
  }
}

// init() → ne fait rien si l'élément n'existe pas (no-op), sinon met une valeur initiale.
export async function init() {
  const el = $(SELECTOR_FLAMES);
  if (!el) return; // no-op
  try {
    // Affichage instantané depuis le cache local (évite le flash à 0)
    const fast = await Storage.loadProfileFast();
    await setFlamesWithFade(el, Number(fast.flames) || 0, false);
    // Puis on demandera une vraie lecture (refresh) ailleurs
  } catch (e) {
    await setFlamesWithFade(el, 0, false);
  }
}

// refresh() → applique la logique de reset éventuel puis met à jour l'affichage.
export async function refresh() {
  const el = $(SELECTOR_FLAMES);
  if (!el) return; // no-op

  const profile = await Storage.loadProfile();
  const tz = Time.getUserTZ();
  const todayYMD = Time.toYMDInTZ(Date.now(), tz);

  // Reset si nécessaire (écart ≥ 2 jours)
  if (
    Number(profile.flames) > 0 &&
    Progress.shouldResetFlames(profile.last_play_date, todayYMD)
  ) {
    await Storage.patchProfile({ flames: 0 });
  }

  const updated = await Storage.loadProfile();
  await setFlamesWithFade(el, Number(updated.flames) || 0, true);
}

const Navbar = { init, refresh };

export default Navbar;


