// Boot.js
// Point d'entrée "runtime" : initialise la navbar et les pages au DOMContentLoaded.

import Navbar from './Navbar.js';
import Pages from './Pages.js';

export function boot() {
  // On attend que le DOM soit prêt pour éviter de manipuler des éléments absents.
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await Navbar.init();
      await Navbar.refresh();
    } catch (e) {}

    // Memberstack V2 peut être prêt après le DOMContentLoaded → refresh tardif
    try { setTimeout(() => { Navbar.refresh(); }, 1500); } catch (e) {}
    try { setTimeout(() => { Navbar.refresh(); }, 4000); } catch (e) {}

    try { await Pages.initLobby(); } catch (e) {}
    try { await Pages.initQuestions(); } catch (e) {}
    try { await Pages.initResults(); } catch (e) {}
  });
}

const Boot = { boot };

export default Boot;


