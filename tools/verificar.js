#!/usr/bin/env node
/**
 * SISGEP — verificacao antes do clasp push.
 * Sem dependencias. Sai com codigo 1 se achar algo que quebra em producao.
 *   node tools/verificar.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = process.argv[2] || process.cwd();
const arquivos = fs.readdirSync(RAIZ);
const GS = arquivos.filter(f => f.endsWith('.gs')).sort();
const HTML = arquivos.filter(f => f.endsWith('.html')).sort();

const erros = [];
const avisos = [];

// ---------- 1. sintaxe dos .gs ----------
// O Apps Script roda V8; `new vm.Script` usa o mesmo parser, entao vale como
// checagem de sintaxe real (a extensao .gs impede usar `node --check`).
for (const f of GS) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  try { new vm.Script(txt, { filename: f }); }
  catch (e) { erros.push(`sintaxe: ${f} — ${e.message}`); }
}

// ---------- 2. sintaxe do JS dentro dos .html ----------
for (const f of HTML) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  for (const m of txt.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    let js = m[1];
    if (/<\?[=!]?/.test(js)) continue;          // scriptlet do HtmlService: nao e JS puro
    try { new vm.Script(js); }
    catch (e) { erros.push(`sintaxe: ${f} <script> — ${e.message}`); }
  }
}

// ---------- 3. nomes globais duplicados ----------
// Todos os .gs dividem um escopo global. Nome repetido = uma definicao apaga a outra.
const defs = new Map();
const dupMesmoArquivo = [];
for (const f of GS) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  const vistos = new Set();
  for (const m of txt.matchAll(/^function\s+([A-Za-z_$][\w$]*)/gm)) {
    if (vistos.has(m[1])) dupMesmoArquivo.push([m[1], f]);
    vistos.add(m[1]);
    if (!defs.has(m[1])) defs.set(m[1], []);
    defs.get(m[1]).push(f);
  }
}
for (const [fn, arqs] of defs) {
  const u = [...new Set(arqs)];
  if (u.length > 1) erros.push(`global duplicado: ${fn}() definida em ${u.join(' e ')}`);
}
for (const [fn, f] of dupMesmoArquivo) erros.push(`global duplicado: ${fn}() definida duas vezes em ${f}`);

// ---------- 4. chamadas do cliente sem funcao no servidor ----------
function fimDaChamada(txt, i) {
  let prof = 0, aspa = null;
  for (; i < txt.length; i++) {
    const c = txt[i];
    if (aspa) { if (c === '\\') { i++; continue; } if (c === aspa) aspa = null; continue; }
    if (c === '"' || c === "'" || c === '`') { aspa = c; continue; }
    if (c === '(') prof++;
    else if (c === ')') { prof--; if (prof === 0) return i + 1; }
  }
  return -1;
}
const chamadasCliente = new Set();
for (const f of HTML) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  let idx = 0;
  while ((idx = txt.indexOf('google.script.run', idx)) !== -1) {
    let i = idx + 17;
    for (;;) {
      while (i < txt.length && /\s/.test(txt[i])) i++;
      if (txt[i] !== '.') break;
      i++;
      while (i < txt.length && /\s/.test(txt[i])) i++;
      const m = /^([A-Za-z_$][\w$]*)/.exec(txt.slice(i, i + 80));
      if (!m) break;
      const nome = m[1];
      i += nome.length;
      while (i < txt.length && /\s/.test(txt[i])) i++;
      if (txt[i] !== '(') break;
      if (/^with[A-Z]/.test(nome)) { const fim = fimDaChamada(txt, i); if (fim < 0) break; i = fim; continue; }
      chamadasCliente.add(nome);
      if (!defs.has(nome)) erros.push(`chamada sem servidor: ${f} chama ${nome}(), que nao existe em nenhum .gs`);
      break;
    }
    idx += 17;
  }
}

// ---------- 5. segredos ----------
const SEGREDO = /(AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{32,}|-----BEGIN [A-Z ]*PRIVATE KEY)/;
for (const f of [...GS, ...HTML]) {
  const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  txt.split('\n').forEach((linha, n) => {
    if (SEGREDO.test(linha)) erros.push(`segredo no codigo: ${f}:${n + 1}`);
  });
}


// ---------- 6. auditoria de sessao (aviso, nao erro) ----------
// Toda funcao alcancavel por google.script.run e um endpoint publico do webapp:
// quem tiver a URL consegue chama-la. Esta checagem e heuristica — procura sinal
// de validacao de sessao no corpo da funcao. Rever manualmente o que aparecer.
const CHECA_SESSAO = /getSessaoUsuario|exigirSessao|validarSessao|sessaoValida|verificarSessao|exigirAdministrador/;
const textoGs = new Map(GS.map(f => [f, fs.readFileSync(path.join(RAIZ, f), 'utf8')]));
const semSessao = [];
for (const nome of chamadasCliente) {
  const arqs = defs.get(nome);
  if (!arqs) continue;
  const t = textoGs.get(arqs[0]);
  const i = t.indexOf('function ' + nome);
  if (i < 0) continue;
  let prof = 0, fim = i, viu = false;
  for (let k = i; k < t.length && k < i + 40000; k++) {
    if (t[k] === '{') { prof++; viu = true; }
    else if (t[k] === '}') { prof--; if (viu && prof === 0) { fim = k; break; } }
  }
  if (!CHECA_SESSAO.test(t.slice(i, fim))) semSessao.push(`${nome}() em ${arqs[0]}`);
}
if (semSessao.length) {
  avisos.push(`${semSessao.length} de ${chamadasCliente.size} funcoes chamadas pelo cliente nao mostram checagem de sessao:`);
  semSessao.slice(0, 15).forEach(x => avisos.push('    ' + x));
  if (semSessao.length > 15) avisos.push(`    ... e mais ${semSessao.length - 15}. Rode com --sessoes para a lista toda.`);
  if (process.argv.includes('--sessoes')) semSessao.slice(15).forEach(x => avisos.push('    ' + x));
}

// ---------- 7. appsscript.json ----------
if (!fs.existsSync(path.join(RAIZ, 'appsscript.json'))) erros.push('appsscript.json ausente');

// ---------- relatorio ----------
const dedup = [...new Set(erros)];
if (avisos.length) { console.log('AVISOS:'); avisos.forEach(a => console.log('  ~ ' + a)); }

// --max N: falha so se o total passar de N. Serve para travar a divida tecnica
// herdada num teto e barrar problema novo, sem exigir corrigir tudo de uma vez.
const iMax = process.argv.indexOf('--max');
const teto = iMax !== -1 ? Number(process.argv[iMax + 1]) : 0;

if (!dedup.length) { console.log(`OK — ${GS.length} .gs e ${HTML.length} .html verificados, nada a corrigir.`); process.exit(0); }

console.log(`${dedup.length} problema(s):`);
dedup.forEach(e => console.log('  x ' + e));

if (dedup.length > teto) {
  if (teto) console.log(`\nFALHOU: ${dedup.length} problemas, teto e ${teto}. Os novos sao seus.`);
  process.exit(1);
}
console.log(`\nDentro do teto de ${teto} (divida herdada — ver docs/DEBITO-TECNICO.md). Nada novo foi acrescentado.`);
process.exit(0);
