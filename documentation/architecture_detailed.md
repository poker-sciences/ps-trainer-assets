# Architecture

# **Présentation générale**

**PokerSciences – Trainer** est un module d’entraînement intégré à un site **Webflow : pokersciences.com** dont l’interface (HTML/CSS) est **déjà conçue**.

Le JavaScript côté client n’a qu’un rôle : **orchestrer la logique** (sessions, questions, calculs de score/XP, gestion des flammes/“série” jour par jour) et **lier** les écrans existants via des **Custom Attributes de Webflow.**

- L’accès au Trainer est **réservé aux utilisateurs connectés** (géré en dehors de ce projet).
- Les scripts ne génèrent **aucun HTML** : ils se branchent sur le DOM existant et mettent à jour du texte/état/visibilité.
- Les données persistées côté client (localStorage) peuvent être **synchronisées** plus tard via un service (Memberstack/AWS).

Tous les scripts seront placés dans un unique composant Webflow qui sera réutilisé dans toutes les pages concernées.

## **Pages & expérience utilisateur**

- **Lobby** : choix du chapitre (slider) puis mode (normal ou difficile) (bouton switch entre normal et difficile). Le joueur lance une **session en cliquant sur Jouer.**
- **Questions** : 20 questions par défaut (paramétrable). Deux formats :
    1. **Texte** + 4 propositions.
    2. **Situation de jeu** + 4 actions (ex. *All-in*, *Raise*, *Call/Check*, *Fold*).
        
        Après chaque réponse : **feedback** (“Bonne réponse” / “Mauvaise réponse”) puis **Suivant**.
        
- **Résultats** : affiche **score sur 20**, **XP de la session**, **flammes (série)**, et **indicateur x1.5** si mode difficile. Bouton Suivant.
- **Autres pages du site** (ex. Ranges, Conseils, Idées, Roadmap, etc.) : elles n’appartiennent pas au flux du Trainer mais **affichent la navbar** ; il faut donc **mettre à jour le nombre de flammes** sur ces pages également.

## **URLs**

- Lobby : /trainer/lobby
- Questions : /trainer/questions
- Résultats : /trainer/results
- **Autres pages indépendantes** (avec navbar uniquement) : pages hors /trainer/* qui doivent **afficher le nombre de flammes** dans la navbar.

# **Règles métier**

- **Modes** : normal et difficile
- **Fin de partie** : après **N** questions (**20** par défaut, **paramétrable**).
- **Score (session)** : nombre de **bonnes réponses** (sur N).
- **XP (session)** : bonnes × 10 × flames (si flames = 0, on multiplie par 1, pas par 0) × (1.5 si difficile, sinon 1).
- **Multiplicateur affiché** : flames (non capé) (si flames = 0, on multiplie par 1, pas par 0)+ ×1.5 si mode difficile.
- **Flammes = série de jours** (non capée) :
    - **Au chargement d’une page** : si la série est **cassée** (écart ≥ 2 jours), **reset immédiat** à 1 et mise à jour partout (navbar incluse).
    - **À la fin d’une partie** : si la journée n’a pas encore été créditée, **incrément** de flames (+1) et mise à jour de last_play_date.
- **Champs utilisateur utiles** (si services) : flames, xp_total, last_play_date, level (l’auth email est hors périmètre). Ces champs sont stockés dans Memberstack dans des customs fields.
- **Gardes de navigation** :
    - Accès direct à **Questions** et **Résultats** **interdit** sans session → renvoi **Lobby**.
    - **Reload** sur **Questions** : **conserver** la session si active.
    - **Reload** sur **Résultats** sans session : renvoi **Lobby**.

# **Architecture des scripts**

Tous les scripts sont **vanilla JS.** Ils se branchent sur le DOM via **Custom Attributes de Webflow.**

## **1. trainer_core.js - (cœur applicatif)**

- **Rôle** : état central + persistance (whitelist), bus d’événements, routage logique, gardes d’accès, navigation contrôlée, **cycle de session** (démarrer / terminer / reset), **boot idempotent**.
- **État** (extraits pertinents) :
    - Session : sessionId, mode, seed, score, xp, timestamps {startedAt, finishedAt}.
    - Progression transversale : flames (non capé), xp_total, last_play_date, level.
    - Éphémères : route, ready.
    - **Remarque** : **pas de “streak”** distinct ; la série est portée **uniquement** par flames + last_play_date.
- **Persistance locale** : snapshot filtré (pas de route/ready).
- **Compatibilité** : tolérant aux slashes finaux, query, hash.
- **Chargement** : **présent sur toutes les pages** (Trainer + autres pages avec navbar).

## **2. trainer_services.js - (services externes)**

- **Rôle** : point d’intégration **facultatif** avec Memberstack / API.
- **Memberstack** : expose de quoi **lire/écrire** flames, xp_total, last_play_date, level.
- **API (stubs)** : emplacements pour fetchQuestions({ mode, seed }) et saveResults(summary) (no-op tant qu’AWS n’est pas prêt).
- **Comportement** : si absent, le Trainer fonctionne **offline** (localStorage).

## **3. trainer_flammes.js - (gestion des flammes/série)**

- **Rôle** :
    - Au **boot de chaque page** : comparer last_play_date et “aujourd’hui” (UTC).
        - Si écart ≥ 2 jours → **reset immédiat** flames=0, mettre à jour l’affichage (notamment navbar).
    - À la **fin d’une partie** : incrémenter flames (+1) **au plus une fois par jour**, fixer last_play_date au jour courant.
    - Mettre à jour **tous les éléments** marqués par **count_flammes** (navbar, résultats, etc.).
- **Sync** : peut pousser/puller ces champs via trainer_services.js si dispo.

## **4. trainer_navbar.js - liaison de la navbar**

- **Rôle** : mettre à jour la navbar **sans créer du DOM** :
    - Affichage des **flammes** via l’attribut **count_flammes**
    - S’abonner à l’état central pour **refresh live**.

## **5. trainer_lobby.js - liaison de la page Lobby**

- **Rôle** :
    - Capter les boutons/liens “Jouer” en **mode normal** ou **mode difficile** (Custom Attributes).
    - **Démarrer** une session avec le mode choisi.
    - **Rediriger** vers la page Questions (le Core applique les gardes).

## **6. trainer_game.js - liaison de la page Questions**

- **Rôle** :
    - Gérer les **deux formats** de questions (texte / situation de jeu).
    - Enchaîner les **N** questions (**20 par défaut, paramétrable**) : réception du clic, évaluation, feedback, bouton **Suivant**.
    - Tenir les **compteurs de session** :
        - score = nb de bonnes réponses.
        - xp (session) selon la **formule** : bonnes × 10 × flames × (×1.5 si difficile).
            - **Note règle** : l’XP de session se calcule avec la valeur **courante** de flames après éventuel **reset** de la journée, et **avant** l’incrément de fin de partie.
    - À la dernière question : **terminer** la session, déclencher la mise à jour **flammes** (fin de partie), puis **rediriger** vers Résultats.

# **Contrat DOM (Custom Attributes – génériques)**

Ces noms servent de **cibles**

- **Flammes (navbar + résultats)** : count_flammes → texte = nombre courant.
- **Lobby** : data-trainer-start="normal" et data-trainer-start="difficile" sur les boutons/links qui lancent une partie.
- **Questions** :
    - **Param** local du nombre de questions (optionnel) : data-questions-total="20" (sinon valeur globale).
    - **Réponses “texte”** : data-answer="A|B|C|D".
    - **Réponses “jeu”** : data-move="all-in|raise|call|check|fold" (selon ta sémantique exacte).
    - **Feedback** : data-feedback="ok" et data-feedback="ko" (blocs déjà présents/stylisés).
    - **Suivant** : data-next.

## **7. trainer_results.js — Résultats**

- **Rôle** : lier la page /trainer/results pour **afficher** les résultats de la session et **appliquer** (une seule fois) les mises à jour persistantes.
- **Affichages requis** (via Custom Attributes génériques) :
    - **Score** sur N → data-result-score
    - **XP de session** → data-result-xp
    - **Flammes** (série) → **count_flammes** (réutilisé)
    - **Indicateur ×1.5** si mode difficile → data-result-mult-hard (montrer/masquer)
    - **Bouton Suivant** → data-result-next
- **Traitements** :
    - **Lire l’état de session** (score, xp, mode, flames) et **renseigner** les éléments d’affichage.
    - **Mettre à jour xp_total** en ajoutant l’XP de la session (exactement **une fois**).
    - **Idempotence** : éviter toute **double application** (ex. reload de la page) via un **garde** basé sur l’ID de session (persisté localement).
    - **Synchronisation** (si services disponibles) : pousser xp_total, flames, last_play_date (et level si règle définie) sans bloquer l’affichage en cas d’échec.
    - **Sortie de page** : gérer proprement la fin de session (nettoyage/retour Lobby via le bouton Suivant, sans détail d’implémentation ici).

# **Données, persistance & synchronisation**

- **État central** (client) : session + progression (flames, xp_total, last_play_date, level).
- **LocalStorage** : snapshot filtré (pas d’éphémères), et clé dédiée pour la dernière date de jeu si besoin.
- **Memberstack / Services** (quand branchés) :
    - **Hydratation au boot** : charger flames, xp_total, last_play_date, level → affichage immédiat (navbar).
    - **Écriture à la fin d’une partie** :
        - xp_total += xp_session
        - flames ajusté (incrément si journée non créditée)
        - last_play_date = today
        - level inchangé sauf règle explicite (non définie à ce stade).

# **Comportements de navigation**

- **Gardes** :
    - Questions/Résultats refusés sans session → renvoi Lobby.
    - Reload Questions → session conservée.
    - Reload Résultats sans session → renvoi Lobby.
- **Redirections** : effectuées de manière contrôlée (sans détail d’implémentation ici).

# **Paramétrage**

- **Nombre de questions** : **20 par défaut**, surcharge possible (attribut de page ou config simple).
- **Formule XP** : bonnes × 10 × flames × (×1.5 si difficile) (figée ici ; pourra devenir configurable).
- **Modes** : normal, difficile (exclusifs).

# **Critères d’acceptation (checklist)**

- **Accès** : impossible d’ouvrir Questions/Résultats sans session → renvoi Lobby.
- **Lobby** : lancement en mode normal/difficile démarre bien une session, puis arrive sur Questions.
- **Questions** :
    - 20 questions (ou valeur configurée), feedback ok/ko visible, bouton Suivant opérationnel.
    - Le **score** correspond au nombre de bonnes réponses.
    - **XP (session)** respecte la formule avec le **bon multiplicateur de flammes** (après reset éventuel, avant incrément de fin).
- **Fin de partie** : session terminée, **flammes** incrémentées si journée non créditée, date mise à jour.
- **Résultats** : affichage **score/20**, **XP session**, **flammes**, **×1.5** si difficile, bouton Suivant fonctionnel.
- **Navbar (toutes pages, y compris hors Trainer)** : le **compteur de flammes** se met à jour immédiatement si la série est cassée et après une partie.
- **Persistance** : rechargement conserve la progression et, si on est en jeu, l’état de la session.
- **Services (si branchés)** : lecture/écriture des 4 champs user sans bloquer le front si indisponibles.

# **Contraintes & non-objectifs**

- Aucun rendu HTML côté JS ; **DOM déjà présent** dans Webflow.
- Pas de dépendance jQuery côté scripts Trainer (compatibles Webflow).
- Pas d’AWS pour l’instant : les points d’entrée API sont **stubbés**.