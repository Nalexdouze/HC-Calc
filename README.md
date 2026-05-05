# HC Calc — Calculatrice Heures Creuses

> Outil web local pour optimiser la programmation différée de ses appareils électroménagers selon ses plages tarifaires Heures Creuses.

![Python](https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat-square&logo=flask)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?style=flat-square&logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Le problème

Programmer le départ différé d'un lave-linge à la bonne heure pour que **le cycle se termine en heures creuses** — sans jamais se tromper de calcul — c'est le genre de petit problème quotidien qui mérite un vrai outil.

Les contraintes sont simples mais vicieuses :
- Les appareils n'acceptent un délai qu'**en heures entières** (1h, 2h, 3h…)
- La durée d'un programme inclut souvent des **minutes** (1h52, 3h10…)
- Certains appareils programment la **fin** du cycle (lave-linge), d'autres le **départ** (lave-vaisselle)
- Les plages HC varient selon les contrats (Tempo, Flex, Weekend…)

HC Calc résout tout ça en une seconde : tu sélectionnes l'appareil et le programme, il te dit **exactement combien d'heures de différé programmer**.

---

## Fonctionnement

```
Heure actuelle : 20h15
Programme      : Lave-linge Eco (3h15)
Mode           : Fin différée (la fin du cycle doit tomber en HC)
Plages HC      : 22h00→06h00

→ Résultat : + 2h  (fin à 01h30 ✓ HC Nuit)
```

Le moteur de calcul teste chaque délai de 1h à 12h, arrondi à l'heure entière, et retourne la première valeur qui place le départ ou la fin du programme dans une plage HC configurée.

---

## Fonctionnalités

### Calculatrice (front)
- **Cadran 24h** : visualisation des plages HC et de la position actuelle
- **Sélection d'appareils** : parmi les appareils activés dans la config
- **Programmes prédéfinis** : durées réelles par programme
- **Durée manuelle** : saisie libre en H:mm
- **Mode fin / départ différé** : selon la logique de l'appareil
- **Résultat immédiat** : délai à programmer + timeline départ→fin avec badges HC/HP
- **Alternatives** : toutes les autres options HC dans les 12 prochaines heures
- **Thème clair / sombre / auto** : persisté dans `localStorage`
- **100% local** : zéro requête externe, zéro cloud

### Administration (back)
- Gestion des **appareils** : nom, icône, mode, activation/désactivation
- Gestion des **programmes** : nom et durée (H:mm) par appareil
- Configuration des **plages HC** : nom, heure début/fin, support des plages traversant minuit
- **Sauvegarde JSON** : `Ctrl+S` ou bouton, persistée sur disque

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Backend   | Python 3.11 · Flask |
| Frontend  | HTML/CSS/JS vanilla — aucun framework |
| Config    | JSON fichier local |
| Polices   | JetBrains Mono + Outfit (self-hosted) |
| Déploiement | Docker Compose |

Pas de base de données, pas de dépendances npm, pas de build step.

---

## Structure du projet

```
hc-calc/
├── app.py                  # Backend Flask — API REST + routes
├── config.json             # Configuration persistante (appareils, programmes, HC)
├── docker-compose.yml
├── templates/
│   ├── index.html          # Calculatrice
│   └── admin.html          # Interface d'administration
└── static/
    ├── favicon.svg
    ├── apple-touch-icon.png
    ├── css/
    │   ├── base.css        # Variables thème, reset, composants partagés
    │   ├── app.css         # Calculatrice
    │   └── admin.css       # Administration
    ├── js/
    │   ├── app.js          # Logique calculatrice + moteur HC
    │   └── admin.js        # CRUD appareils/programmes/plages
    └── fonts/              # JetBrains Mono + Outfit (woff2)
```

---

## Installation

### Prérequis
- Docker + Docker Compose

### Déploiement

```bash
# Cloner le repo
git clone https://github.com/nalexdouze/hc-calc.git
cd hc-calc

# Démarrer
docker compose up -d

# Logs
docker compose logs -f hc-calc
```

L'application est accessible sur **http://ip-machine:5050**

### Configuration réseau

Le `docker-compose.yml` utilise `network_mode: host` pour que le container ait accès au réseau lors de l'installation de Flask au démarrage. Si ton environnement Docker a accès à internet en mode bridge, tu peux retirer cette ligne.

---

## Configuration

Le fichier `config.json` est monté en volume — il persiste entre les redémarrages et est modifiable via l'interface `/admin`.

Structure :

```json
{
  "hc_bands": [
    { "id": "hc1", "label": "Nuit", "start": "22:00", "end": "06:00" },
    { "id": "hc2", "label": "Midi", "start": "13:00", "end": "18:00" }
  ],
  "devices": [
    {
      "id": "lavelinge",
      "name": "Lave-linge",
      "icon": "washer",
      "mode": "fin",
      "visible": true,
      "programs": [
        { "id": "p1", "name": "Eco", "dur_h": 3, "dur_m": 15 }
      ]
    }
  ]
}
```

**Champs `mode`** :
- `fin` — le délai positionne la **fin** du cycle en HC (lave-linge)
- `depart` — le délai positionne le **départ** du cycle en HC (lave-vaisselle)

---

## Logique de calcul

```
nowMin     = heure actuelle en minutes depuis minuit
progDur    = durée du programme en minutes
delay      = 1 à 12 (heures entières)

Mode "fin" :
  startMin = nowMin + delay×60 - progDur
  endMin   = nowMin + delay×60
  checkMin = endMin   ← doit être en HC

Mode "départ" :
  startMin = nowMin + delay×60
  endMin   = nowMin + delay×60 + progDur
  checkMin = startMin ← doit être en HC

Retourne le plus petit delay pour lequel isHC(checkMin) = true
```

Les plages HC traversant minuit (ex: 22:00→06:00) sont correctement gérées par un test modulo 1440.

---

## Contexte

Conçu pour un usage domestique sur réseau local, dans le cadre d'un écosystème domotique home-made centré sur MQTT. Pas de cloud, pas de compte, pas de tracking. Tourne sur un NAS Synology (un DS1821+ dans mon cas) via Container Manager.

Le contrat électrique de référence est le **Flex Zen Weekend** d'EDF, avec 4 bandes tarifaires (HC/HP × Jour normal / Pointe), mais l'outil s'adapte à n'importe quelle configuration de plages HC.

---

## Licence

MIT
