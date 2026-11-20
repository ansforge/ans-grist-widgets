# Dépendances embarquées

Copies locales des ressources externes du widget, pour qu'il fonctionne sans accès aux CDN ni à GitHub.
Ne pas modifier ces fichiers à la main : les remplacer par une nouvelle version téléchargée depuis la source.

| Fichier | Source | Version | Licence |
|---|---|---|---|
| `leaflet.js`, `leaflet.css`, `images/` | https://unpkg.com/leaflet@1.9.4/dist/ | 1.9.4 | BSD-2-Clause |
| `chroma.min.js` | https://cdn.jsdelivr.net/npm/chroma-js@2.4.2/chroma.min.js | 2.4.2 | BSD-3-Clause (+ Apache-2.0 pour les palettes ColorBrewer) |
| `departements.geojson` | https://github.com/gregoiredavid/france-geojson — `departements-version-simplifiee.geojson` | `master` au 2026-11-20 | Licence Ouverte / Etalab (données IGN / INSEE) |
| `regions.geojson` | https://github.com/gregoiredavid/france-geojson — `regions-version-simplifiee.geojson` | `master` au 2026-11-20 | Licence Ouverte / Etalab (données IGN / INSEE) |

Les images de Leaflet (`images/`) ne sont pas utilisées actuellement (pas de marqueurs par défaut ni de sélecteur de calques) ; elles sont gardées pour que `leaflet.css` reste complet.

`grist-plugin-api.js` reste volontairement chargé depuis `docs.getgrist.com` : il doit rester compatible avec la version de Grist qui affiche le widget.
