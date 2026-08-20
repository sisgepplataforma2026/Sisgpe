#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FIX = process.argv.includes('--fix');

// Escopo P0 do módulo Documentos. Não altera módulos públicos que possam
// depender deliberadamente de compartilhamento externo.
const TARGETS = [
  'Comprovantes.gs',
  'RelatoriosOficios.gs'
];

const PUBLIC_SHARING_PATTERNS = [
  { name: 'DriveApp.Access.ANYONE_WITH_LINK', re: /DriveApp\.Access\.ANYONE_WITH_LINK/g },
  { name: 'DriveApp.Access.ANYONE', re: /DriveApp\.Access\.ANYONE(?!_WITH_LINK)/g },
  { name: 'Drive API permission type anyone', re: /(?:type\s*:\s*["']anyone["']|["']type["']\s*:\s*["']anyone["'])/gi }
];

const SET_SHARING_PUBLIC_RE = /\.setSharing\(\s*DriveApp\.Access\.ANYONE_WITH_LINK\s*,\s*DriveApp\.Permission\.VIEW\s*\);/g;
const SET_SHARING_PRIVATE = '.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);';

function filePath(rel) {
  return path.join(ROOT, rel);
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function hardenTargets() {
  let total = 0;

  for (const rel of TARGETS) {
    const target = filePath(rel);
    if (!fs.existsSync(target)) throw new Error(`${rel} não encontrado.`);

    const original = fs.readFileSync(target, 'utf8');
    const matches = original.match(SET_SHARING_PUBLIC_RE) || [];

    if (!matches.length) {
      console.log(`${rel}: nenhum setSharing público para corrigir.`);
      continue;
    }

    if (!FIX) {
      console.error(`P0: ${rel} ainda possui ${matches.length} compartilhamento(s) público(s).`);
      continue;
    }

    const updated = original.replace(SET_SHARING_PUBLIC_RE, SET_SHARING_PRIVATE);
    fs.writeFileSync(target, updated, 'utf8');
    total += matches.length;
    console.log(`FIX: ${rel} teve ${matches.length} compartilhamento(s) alterado(s) para PRIVATE/NONE.`);
  }

  if (FIX) console.log(`Total de compartilhamentos públicos corrigidos: ${total}.`);
}

function auditPublicSharing() {
  const findings = [];

  for (const rel of TARGETS) {
    const target = filePath(rel);
    if (!fs.existsSync(target)) {
      findings.push({ file: rel, line: 0, pattern: 'arquivo ausente' });
      continue;
    }

    const text = fs.readFileSync(target, 'utf8');
    for (const pattern of PUBLIC_SHARING_PATTERNS) {
      pattern.re.lastIndex = 0;
      let match;
      while ((match = pattern.re.exec(text)) !== null) {
        findings.push({ file: rel, line: lineOf(text, match.index), pattern: pattern.name });
      }
    }
  }

  if (findings.length) {
    console.error('\nAUDITORIA P0 REPROVADA: ainda existem referências de compartilhamento público no escopo documental:');
    for (const f of findings) console.error(`- ${f.file}:${f.line} -> ${f.pattern}`);
    process.exitCode = 3;
    return false;
  }

  console.log('\nAUDITORIA P0 OK: zero compartilhamentos públicos em Comprovantes.gs e RelatoriosOficios.gs.');
  return true;
}

hardenTargets();
auditPublicSharing();
