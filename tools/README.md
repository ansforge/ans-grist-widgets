# Outillage de contrôle

## `check-html.mjs` — construction sûre du HTML

Les widgets affichent des données lues dans Grist (noms, codes, emojis…). Une valeur comme
`<img src=x onerror="…">` insérée telle quelle dans la page s'exécuterait chez tous les
utilisateurs, avec l'accès complet au document. Pour l'empêcher **par construction** :

- tout HTML est produit par le gabarit `` html`…` `` : chaque `${valeur}` est échappée automatiquement
  (sauf ce qui vient déjà de `` html`…` `` ou de `js()`) ;
- l'insertion dans la page se fait uniquement par `setHtml(element, html`…`)`.

Ce script vérifie statiquement le code JavaScript inline des pages et refuse :

| Règle | Interdit | À la place |
|---|---|---|
| R1 | un gabarit `` `…` `` contenant du HTML sans le préfixe `html` | `` html`…` `` |
| R2 | une chaîne `'…'` contenant du HTML | `` html`…` `` |
| R3 | `.innerHTML =`, `.outerHTML =`, `insertAdjacentHTML`, `document.write` (hors de `setHtml`) | `setHtml(el, html`…`)` |
| R4 | une valeur dans `onclick="…"` (et tout `on…`) sans `js()` | `onclick="f(${js(valeur)})"` |
| R5 | un attribut sans guillemets (`class=${x}`), une URL dynamique (`href`, `src`…) | `class="${x}"` ; pas d'URL issue des données |
| R6 | une valeur dynamique à la place d'un attribut (`<input ${x}>`) | une constante : `${ok && 'checked'}` |
| R7 | une valeur dans `<script>` ou `<style>` | — |

Limites connues : l'analyse ne suit pas les variables (une chaîne HTML construite autrement puis
passée à `setHtml` est refusée à l'exécution par `setHtml` lui-même, qui n'accepte que `` html`…` ``) ;
faire `.join('')` sur un tableau de `` html`…` `` produit du texte échappé (bug visible, pas une faille) :
passer le tableau directement, `` html`${tableau}` ``.

## Lancer les contrôles

```bash
npm ci            # une fois (installe acorn, l'analyseur JavaScript)
npm run check     # tests du contrôle + vérification de carte-france/index.html
```

En intégration continue : `.github/workflows/check-html.yml`, sur chaque pull request et sur `main`.
Pour qu'il bloque la fusion, l'ajouter aux contrôles obligatoires de la protection de branche.

Pour contrôler une nouvelle page, l'ajouter au script `check:html` de `package.json`.
