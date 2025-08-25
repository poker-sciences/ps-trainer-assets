// Navbar.js
// Ce module gère l'affichage du compteur de flammes 🔥 dans la navbar.

import { $, setText } from './Utils.js';
import Storage from './Storage.js';
import Time from './Time.js';
import Progress from './Progress.js';

const SELECTOR_FLAMES = '[data-trainer-flames]';

// init() → ne fait rien si l'élément n'existe pas (no-op), sinon met une valeur initiale.
export async function init() {
  const el = $(SELECTOR_FLAMES);
  if (!el) return; // no-op
  try {
    // Affichage instantané depuis le cache local (évite le flash à 0)
    const fast = await Storage.loadProfileFast();
    setText(el, Number(fast.flames) || 0);
    el.setAttribute('data-ready', '1');
    // Puis on demandera une vraie lecture (refresh) ailleurs
  } catch (e) {
    setText(el, '0');
    el.setAttribute('data-ready', '1');
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
  setText(el, Number(updated.flames) || 0);
  el.setAttribute('data-ready', '1');
}

const Navbar = { init, refresh };

export default Navbar;


