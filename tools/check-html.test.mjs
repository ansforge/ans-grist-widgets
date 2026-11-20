// Tests du contrôle tools/check-html.mjs — node --test tools/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSource, inlineScripts } from './check-html.mjs';

const rules = (code) => checkSource(code).map((i) => i.rule);

test('code conforme : aucune violation', () => {
  const ok = `
    setHtml(el, html\`<span class="dn" title="\${d.nom}">\${d.nom}</span>\`);
    setHtml(el, html\`<input \${d.visible && 'checked'} onchange="toggleVis(\${js(d.code)},this.checked)">\`);
    setHtml(el, html\`<div class="cdot\${on && ' on'}" onclick="f(\${js(a)},\${js(b)})">\${list}</div>\`);
    setHtml(el, html\`<input \${c ? 'checked' : ''}>\`);
    el.textContent = 'Texte sans balise';
    const label = \`dlabel mini\`;
    function setHtml(el, h) { el.innerHTML = h.s; }
  `;
  assert.deepEqual(checkSource(ok), []);
});

test('R1 : gabarit HTML sans html``', () => {
  assert.deepEqual(rules('const a = `<b>${x}</b>`;'), ['R1']);
});

test('R2 : chaîne littérale contenant du HTML', () => {
  assert.deepEqual(rules(`const a = '<b>' + x + '</b>';`), ['R2', 'R2']);
});

test('R3 : écriture directe dans le DOM hors de setHtml', () => {
  assert.deepEqual(rules('el.innerHTML = x;'), ['R3']);
  assert.deepEqual(rules('el.outerHTML = x;'), ['R3']);
  assert.deepEqual(rules(`el['innerHTML'] = x;`), ['R3']);
  assert.deepEqual(rules('el.insertAdjacentHTML("beforeend", x);'), ['R3']);
  assert.deepEqual(rules('document.write(x);'), ['R3']);
  assert.deepEqual(rules('function autre(el, h) { el.innerHTML = h; }'), ['R3']);
});

test('R4 : valeur dans un gestionnaire inline sans js()', () => {
  assert.deepEqual(rules('html`<div onclick="f(\'${d.code}\')"></div>`;'), ['R4']);
  assert.deepEqual(rules('html`<div onclick="f(${js(a)},${b})"></div>`;'), ['R4']);
});

test('R5 : attribut sans guillemets ou URL dynamique', () => {
  assert.deepEqual(rules('html`<div class=${x}></div>`;'), ['R5']);
  assert.deepEqual(rules('html`<a href="${url}">lien</a>`;'), ['R5']);
});

test('R6 : valeur dynamique à la place d\'un attribut', () => {
  assert.deepEqual(rules('html`<input ${attrs}>`;'), ['R6']);
  assert.deepEqual(rules('html`<input ${ok && name}>`;'), ['R6']);
});

test('R7 : valeur dans <script> ou <style>', () => {
  assert.deepEqual(rules('html`<style>.a{color:${c}}</style>`;'), ['R7']);
  assert.deepEqual(rules('html`<script>var a=${x}</script>`;'), ['R7']);
  assert.deepEqual(rules('html`<style>.a{}</style><b>${x}</b>`;'), []);
});

test('contexte : un > dans une valeur d\'attribut ne ferme pas la balise', () => {
  assert.deepEqual(rules('html`<div title="a > b" onclick="f(${x})"></div>`;'), ['R4']);
});

test('extraction des scripts inline avec numéros de ligne', () => {
  const doc = '<html>\n<script src="a.js"></script>\n<script>\nel.innerHTML = x;\n</script>\n</html>';
  const [s] = inlineScripts(doc);
  assert.equal(inlineScripts(doc).length, 1);
  assert.equal(checkSource(s.code, { lineOffset: s.lineOffset })[0].line, 4);
});
