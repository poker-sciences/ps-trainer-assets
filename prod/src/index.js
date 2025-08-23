// index.js
// Fichier d'entrée: assemble tous les modules et expose une API simple sur window.
// On déclenche aussi le Boot automatiquement.

import Config from './Config.js';
import * as Utils from './Utils.js';
import Time from './Time.js';
import Storage from './Storage.js';
import Data from './Data.js';
import Progress from './Progress.js';
import Session from './Session.js';
import Navbar from './Navbar.js';
import Pages from './Pages.js';
import Boot from './Boot.js';

// Exposition globale pour faciliter le debug côté navigateur.
// Tout est accessible via window.PokerSciences.Trainer
if (typeof window !== 'undefined') {
  window.PokerSciences = window.PokerSciences || {};
  window.PokerSciences.Trainer = {
    Config,
    Utils,
    Time,
    Storage,
    Data,
    Progress,
    Session,
    Navbar,
    Pages,
    Boot,
  };
}

// Démarrage universel
Boot.boot();

export {
  Config,
  Utils,
  Time,
  Storage,
  Data,
  Progress,
  Session,
  Navbar,
  Pages,
  Boot,
};


