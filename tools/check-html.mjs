#!/usr/bin/env node
// Contrôle statique de la construction du HTML dans les scripts inline des widgets.
// Garantit que toute donnée insérée dans la page passe par le gabarit html`…` (échappement
// automatique) et par setHtml() — voir tools/README.md pour les règles et leur raison d'être.
//
// Usage : node tools/check-html.mjs <fichier.html> [...]
// Code de sortie : 0 si conforme, 1 si au moins une violation, 2 en cas d'erreur d'analyse.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const TAG_RE = /<\/?[a-zA-Z][\w-]*(?=[\s>/])|<!--/;          // ressemble à une balise HTML
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'srcdoc', 'xlink:href']);
const HTML_SINKS = new Set(['innerHTML', 'outerHTML']);
const HTML_SINK_CALLS = new Set(['insertAdjacentHTML', 'write', 'writeln', 'createContextualFragment']);
const SINK_ALLOWED_IN = 'setHtml';                             // seule fonction autorisée à écrire innerHTML

const isHtmlTag = (n) => n?.type === 'TaggedTemplateExpression' && n.tag.type === 'Identifier' && n.tag.name === 'html';
const isCall = (n, name) => n?.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === name;
const propName = (m) => (m.computed ? (m.property.type === 'Literal' ? m.property.value : null) : m.property.name);

// Expression dont la valeur ne peut être qu'une constante littérale (ou rien) :
// 'checked', cond && 'checked', cond ? 'a' : 'b'
function isConstant(n) {
  if (!n) return false;
  if (n.type === 'Literal') return true;
  if (n.type === 'TemplateLiteral') return n.expressions.length === 0;
  if (n.type === 'ConditionalExpression') return isConstant(n.consequent) && isConstant(n.alternate);
  if (n.type === 'LogicalExpression' && n.operator === '&&') return isConstant(n.right);
  return false;
}

// Contexte HTML à la fin d'un préfixe de gabarit (les ${…} précédents y sont remplacés par « x »).
// Petit analyseur à états, suffisant pour les gabarits du widget (pas un parseur HTML complet).
//   text | tag (entre deux attributs) | attr (valeur entre guillemets) | unquoted-attr | rawtext (<script>/<style>)
function htmlContext(prefix) {
  let state = 'text', tagName = '', closing = false, attr = '', quote = '', rawTag = '';
  const ws = (c) => c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f';
  for (let i = 0; i < prefix.length; i++) {
    const c = prefix[i];
    switch (state) {
      case 'text': {
        const m = /^<(\/?)([a-zA-Z][\w-]*)/.exec(prefix.slice(i, i + 64));
        if (m) { closing = !!m[1]; tagName = m[2].toLowerCase(); i += m[0].length - 1; state = 'between'; }
        break;
      }
      case 'rawtext':
        if (prefix.slice(i, i + rawTag.length + 2).toLowerCase() === `</${rawTag}`) {
          closing = true; tagName = rawTag; i += rawTag.length + 1; state = 'between';
        }
        break;
      case 'between':
        if (c === '>') state = !closing && (tagName === 'script' || tagName === 'style') ? (rawTag = tagName, 'rawtext') : 'text';
        else if (!ws(c) && c !== '/') { attr = c; state = 'name'; }
        break;
      case 'name':
        if (c === '=') state = 'beforeValue';
        else if (c === '>') { i--; state = 'between'; }
        else if (ws(c)) state = 'afterName';
        else attr += c;
        break;
      case 'afterName':
        if (c === '=') state = 'beforeValue';
        else if (c === '>') { i--; state = 'between'; }
        else if (!ws(c)) { attr = c; state = 'name'; }
        break;
      case 'beforeValue':
        if (c === '"' || c === "'") { quote = c; state = 'quoted'; }
        else if (!ws(c)) state = 'unquoted';
        break;
      case 'quoted':
        if (c === quote) state = 'between';
        break;
      case 'unquoted':
        if (ws(c)) state = 'between';
        else if (c === '>') { i--; state = 'between'; }
        break;
    }
  }
  if (state === 'rawtext') return { kind: 'rawtext', tag: rawTag };
  if (state === 'quoted') return { kind: 'attr', name: attr.toLowerCase() };
  if (state === 'beforeValue' || state === 'unquoted') return { kind: 'unquoted-attr' };
  if (state === 'text') return { kind: 'text' };
  return { kind: 'tag' };
}

/**
 * Analyse un code JavaScript et renvoie la liste des violations.
 * @param {string} code
 * @param {{lineOffset?: number}} [opts] décalage de ligne (script inline dans un .html)
 * @returns {{line:number,column:number,rule:string,message:string}[]}
 */
export function checkSource(code, { lineOffset = 0 } = {}) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const issues = [];
  const report = (node, rule, message) =>
    issues.push({ line: node.loc.start.line + lineOffset, column: node.loc.start.column + 1, rule, message });
  const enclosingFunctionName = (ancestors) => {
    for (let i = ancestors.length - 1; i >= 0; i--) {
      const a = ancestors[i];
      if (a.type === 'FunctionDeclaration' || a.type === 'FunctionExpression') return a.id?.name ?? null;
    }
    return null;
  };

  walk.fullAncestor(ast, (node, _state, ancestors) => {
    const parent = ancestors[ancestors.length - 2];

    // R1 — gabarit contenant du HTML sans le préfixe html
    if (node.type === 'TemplateLiteral' && !(isHtmlTag(parent) && parent.quasi === node)) {
      if (node.quasis.some((q) => TAG_RE.test(q.value.cooked ?? q.value.raw))) {
        report(node, 'R1', 'Gabarit contenant du HTML : utiliser html`…` (échappement automatique).');
      }
    }

    // R2 — chaîne littérale contenant du HTML
    if (node.type === 'Literal' && typeof node.value === 'string' && TAG_RE.test(node.value)) {
      report(node, 'R2', 'Chaîne contenant du HTML : utiliser html`…`.');
    }

    // R3 — écriture directe dans le DOM en HTML
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression'
        && HTML_SINKS.has(propName(node.left)) && enclosingFunctionName(ancestors) !== SINK_ALLOWED_IN) {
      report(node, 'R3', `Affectation directe à .${propName(node.left)} : utiliser setHtml(element, html\`…\`).`);
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
        && HTML_SINK_CALLS.has(propName(node.callee))) {
      report(node, 'R3', `Appel à .${propName(node.callee)}() interdit : utiliser setHtml(element, html\`…\`).`);
    }

    // R4 à R7 — contexte de chaque ${…} dans un gabarit html`…`
    if (isHtmlTag(node)) {
      const { quasis, expressions } = node.quasi;
      let prefix = '';
      expressions.forEach((expr, i) => {
        prefix += (quasis[i].value.cooked ?? quasis[i].value.raw);
        const ctx = htmlContext(prefix);
        if (ctx.kind === 'rawtext') {
          report(expr, 'R7', `Valeur insérée dans <${ctx.tag}> : l'échappement HTML n'y protège pas.`);
        } else if (ctx.kind === 'unquoted-attr') {
          report(expr, 'R5', 'Valeur d\'attribut sans guillemets : entourer de "…".');
        } else if (ctx.kind === 'tag' && !isConstant(expr)) {
          report(expr, 'R6', 'Valeur dynamique à la place d\'un attribut : seule une constante est permise (ex. ${ok && \'checked\'}).');
        } else if (ctx.kind === 'attr' && ctx.name.startsWith('on') && !isCall(expr, 'js')) {
          report(expr, 'R4', `Valeur dans le gestionnaire ${ctx.name}="…" : utiliser js(valeur).`);
        } else if (ctx.kind === 'attr' && URL_ATTRS.has(ctx.name) && !isConstant(expr)) {
          report(expr, 'R5', `URL dynamique dans ${ctx.name}="…" interdite (risque javascript:).`);
        }
        prefix += 'x';
      });
    }
  });
  return issues.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** Extrait les scripts inline (sans src) d'un document HTML, avec leur ligne de départ. */
export function inlineScripts(htmlText) {
  const out = [];
  const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(htmlText));) {
    const start = m.index + m[0].indexOf('>') + 1;
    out.push({ code: m[1], lineOffset: htmlText.slice(0, start).split('\n').length - 1 });
  }
  return out;
}

function main(files) {
  if (!files.length) { console.error('Usage : node tools/check-html.mjs <fichier.html> [...]'); return 2; }
  const gha = !!process.env.GITHUB_ACTIONS;
  let total = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const { code, lineOffset } of inlineScripts(text)) {
      let issues;
      try { issues = checkSource(code, { lineOffset }); }
      catch (e) { console.error(`${file}: erreur d'analyse JavaScript : ${e.message}`); return 2; }
      for (const i of issues) {
        console.log(gha
          ? `::error file=${file},line=${i.line},col=${i.column},title=${i.rule}::${i.message}`
          : `${file}:${i.line}:${i.column}  ${i.rule}  ${i.message}`);
      }
      total += issues.length;
    }
  }
  console.log(total ? `\n✗ ${total} violation(s) — voir tools/README.md` : `✓ Construction du HTML conforme (${files.join(', ')})`);
  return total ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
