# Plan d'implémentation : Compositions d'équipes modifiables, extraction continue et conformité dynamique des classements FFT

Ce plan détaille l'architecture et les évolutions pour permettre la modification continue et la persistance des compositions dans l'onglet `Compositions_Equipes`, l'extraction automatique à chaque démarrage, la visibilité en lecture pour les adhérents connectés, ainsi que le contrôle dynamique non-bloquant des classements FFT lors des mises à jour mensuelles.

---

## Décisions validées avec l'utilisateur

> [!IMPORTANT]
> Suite à vos retours lors de la phase de cadrage :
> 1. **Mise à jour dans `Compositions_Equipes`** : Lors de chaque modification d'une feuille de match, les lignes existantes associées à la rencontre sont remplacées proprement par la nouvelle composition (mode *upsert* évitant tout doublon d'historique).
> 2. **Changements de classement mensuels FFT (1er mardi du mois)** : L'évaluation de conformité de l'ordre des simples s'effectue dynamiquement sur le classement FFT actuel des adhérents. En cas de décalage post-changement mensuel, une alerte visible et explicative signale la non-conformité sans verrouiller brutalement la feuille de match.
> 3. **Visibilité pour les adhérents** : Les adhérents connectés accèdent directement aux compositions publiées depuis l'onglet « Rencontres » grâce à un indicateur visuel clair « Équipe validée », avec consultation de la composition officielle complète (postes, horaires, lieu).

---

## 1. Vue d'ensemble & Fonctionnalités clés

L'application du Muzillac Tennis Club assure la coordination des championnats par équipes (Seniors, Seniors+, Jeunes).

1. **Persistance et modifiabilité continue** :
   - Un capitaine ou membre du bureau peut créer, ajuster ou réviser une composition à tout moment.
   - L'enregistrement met à jour en temps réel l'onglet `Compositions_Equipes` du tableur Google Sheets via le connecteur Google Apps Script.
2. **Extraction fraîche à chaque démarrage** :
   - Au chargement de l'application (et reprise de focus), l'intégralité des onglets est synchronisée depuis le serveur.
   - Les compositions validées sont rattachées directement aux objets `Rencontre` correspondants, garantissant que tous les utilisateurs voient la version la plus récente.
3. **Consultation transparente par les adhérents** :
   - Les adhérents peuvent consulter la composition officielle de leur équipe sans pouvoir la modifier.
   - Les capitaines et le bureau conservent l'accès complet en modification.
4. **Vérification dynamique des classements mensuels FFT** :
   - Abandon du gel figé et irréversible qui masquait les montées/descentes mensuelles de classement FFT.
   - Calcul de conformité en direct entre le classement actuel de chaque joueur (issu de la base adhérents actualisée) et l'ordre des postes (Simple 1, Simple 2, etc.).
   - Affichage d'un bandeau d'alerte contextuel si un changement de classement intervenu entre la saisie et le match nécessite une permutation des joueurs.

---

## 2. Expérience utilisateur & Design visuel

### A. Onglet Rencontres & Liste des matchs
- **Badge d'état « Équipe validée »** :
  - Sur chaque carte de rencontre dont la composition est enregistrée, un badge sobre `Équipe validée` (vert émeraude / zinc avec icône discrète) indique aux adhérents et capitaines que la sélection est disponible.
- **Accès direct adhérents** :
  - Le clic sur la carte ou le badge ouvre la fiche détaillée de la rencontre.
  - Pour les adhérents : affichage en mode consultation claire (postes Simple 1 à N, Doubles, heure de convocation, lieu exact et nombre de courts).
  - Pour les capitaines et administrateurs : mode édition actif avec permutations possibles et bouton de mise à jour.

### B. Fiche détaillée & Bandeau d'alerte Classement mensuel
- **Alerte non-bloquante d'ordre des classements** :
  - Si un joueur a changé de classement (ex. monté de 30/1 à 15/5 le premier mardi du mois) et se retrouve classé derrière un joueur de niveau inférieur sur la feuille :
    - Un bandeau ambre stylisé apparaît : *« Attention : L'ordre des simples n'est plus conforme aux classements FFT actuels. Suite au reclassement mensuel, [Joueur A (15/5)] doit jouer avant [Joueur B (30)]. »*
    - Un bouton d'action rapide *« Réordonner automatiquement »* permet de corriger l'ordre en un clic sans ressaisie.
  - La feuille n'est pas bloquée, laissant au capitaine la visibilité totale.

---

## 3. Architecture technique & Flux de données

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS / DRIVE                        │
│   [Adhérents]       [Rencontres]       [Compositions_Equipes]   │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ (GET action=getAll)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              SERVER PROXY / CACHE LOCAL (Vite / Node)           │
│   • Proxy /api/gas-proxy avec TTL mémoire 30s                  │
│   • Bypass CORS & sandbox iframes                               │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLIENT REACT (App.tsx)                        │
│   • Chargement automatique au montage & reprise de focus        │
│   • Fusion : rencontres[i].composition = map(matchId)           │
│   • Contrôle dynamique : checkDynamicRankingOrder(...)          │
└──────────────────┬──────────────────────────────┬───────────────┘
                   │                              │
                   ▼                              ▼
┌──────────────────────────────────┐ ┌────────────────────────────┐
│      Onglet RencontresTab        │ │   CompositionModal.tsx     │
│  • Badge "Équipe validée"        │ │ • Capitaine : Édition      │
│  • Filtre matchs composés        │ │ • Adhérent : Consultation  │
│  • Clic -> Consultation          │ │ • Alerte classement FFT    │
└──────────────────────────────────┘ └────────────────────────────┘
```

### Données & Logique de synchronisation
1. **`googleSheets.ts`** :
   - `fetchAllDataFromAppsScript()` : lit systématiquement `Compositions_Equipes` et crée la map des compositions par `matchId`.
   - `saveCompositionViaAppsScript()` : envoie la composition avec `action: 'saveComposition'`. L'Apps Script remplace les lignes du match concerné.
2. **`fftCalendar.ts` & `fftEligibility.ts`** :
   - Calcul en direct des classements actuels des joueurs depuis `adherentsById` (au lieu d'utiliser exclusivement `classementGele`).
   - Détection de toute inversion de hiérarchie pour le championnat en cours.
3. **Contrôle d'accès (`userRole`)** :
   - Rôle `adherent` : boutons d'édition masqués, affichage en lecture seule soignée.
   - Rôles `capitaine` / `bureau` : édition complète, réordonnancement et sauvegarde.

---

## 4. Plan d'exécution par étapes

1. **Extraction fraîche au démarrage** :
   - Vérifier et garantir que `handleLoadFromRealFile()` dans `App.tsx` extrait toujours les compositions fraîches sans dépendre uniquement du localStorage ancien.
2. **Gestion de l'ordre dynamique des classements** :
   - Mettre à jour la fonction de vérification dans `CompositionModal.tsx` pour comparer les classements actuels FFT des adhérents assignés.
   - Créer le bandeau d'alerte informative non-bloquant avec indication explicite des joueurs concernés.
3. **Visibilité et consultation pour les adhérents** :
   - Ajouter l'indicateur « Équipe validée » dans `RencontresTab.tsx`.
   - Adapter `CompositionModal.tsx` pour offrir un mode consultation adapté aux adhérents connectés (sans affichage de boutons d'action de modification réservés aux capitaines).
4. **Vérification & Compilation** :
   - Exécution conjointe de `compile_applet` et `lint_applet` pour valider l'absence de régression TypeScript.
