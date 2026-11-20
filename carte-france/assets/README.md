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

## Empreintes (SRI)

`index.html` vérifie l'empreinte SHA-384 de chaque fichier de ce dossier (attribut `integrity` des balises `<link>`/`<script>`, et table `ASSET_SRI` pour les GeoJSON). Un fichier dont un seul octet change est **refusé par le navigateur** : la carte ne s'affiche plus.

- Le fichier `.gitattributes` à la racine désactive toute conversion de fin de ligne dans ce dossier : ne pas le supprimer, sinon Git modifie les octets (CRLF) et les empreintes ne correspondent plus.
- `leaflet.js` et `leaflet.css` sont identiques à la publication officielle de Leaflet 1.9.4 (empreintes SHA-256 publiées par Leaflet : `20nQCchB…lvTlZBo=` et `p4NxAoJB…TRR9BMY=`).

**Mettre à jour un fichier** : télécharger la nouvelle version, puis recalculer son empreinte et la reporter dans `index.html` :

```powershell
$b=[IO.File]::ReadAllBytes("carte-france\assets\<fichier>"); 'sha384-'+[Convert]::ToBase64String([Security.Cryptography.SHA384]::Create().ComputeHash($b))
```

## Politique de sécurité (CSP)

`index.html` déclare une Content-Security-Policy qui n'autorise que les ressources de son propre site, plus le script `https://docs.getgrist.com`. Toute nouvelle ressource externe (script, image, `fetch`…) sera **bloquée** tant qu'elle n'est pas ajoutée à la balise `<meta http-equiv="Content-Security-Policy">` — préférer l'ajouter dans ce dossier.
