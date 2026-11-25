# Carnet Rythmique

Boîte à rythmes 16 pas pour noter des idées de boucles, installable sur Android (appli web).

- 12 pistes synthétisées (aucun sample) avec pitch, decay, niveau.
- Accent, flam, vélocité, shuffle, conditions de mesure (1:2, 2:2, 1:4…).
- Banque de 16 patterns, copier/coller, chaîne de 2 à 4 patterns, export MIDI.
- Synchronisation dans un dossier « Carnet Rythmique » de Google Drive (accès limité aux fichiers créés par l'appli).

## Fichiers

- `index.html` : l'appli, générée par `python3 build.py` à partir de `src/carnet.html` (version Claude) et de `src/storage-app.js` / `src/export-app.js`.
- `config.js` : identifiant OAuth Google (public, ce n'est pas un secret).
- `manifest.webmanifest`, `sw.js`, `icons/` : installation et mode hors connexion.
