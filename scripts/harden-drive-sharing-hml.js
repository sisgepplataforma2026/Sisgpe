#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'Comprovantes.gs');
const FIX = process.argv.includes('--fix');

const PUBLIC_SHARING_PATTERNS = [
  { name: 'DriveApp.Access.ANYONE_WITH_LINK', re: /DriveApp\.Access\.ANYONE_WITH_LINK/g },
  { name: 'DriveApp.Access.ANYONE', re: /DriveApp\.Access\.ANYONE(?!_WITH_LINK)/g },
  { name: 'Drive API permission type anyone', re: /(?:type\s*:\s*["']anyone["']|["']type["']\s*:\s*["']anyone["'])/gi }
];

const IGNORE_DIRS = new Set(['.git', 'node_modules']);
const SOURCE_EXTS = new Set(['.gs', '.js', '.html']);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (SOURCE_EXTS.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function hardenComprovantes() {
  if (!fs.existsSync(TARGET)) throw new Error('Comprovantes.gs não encontrado.');
  const original = fs.readFileSync(TARGET, 'utf8');
  const insecure = 'salvo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // ✅';
  const secure = [
    '// 🔒 Segurança/LGPD: anexos de comprovantes não podem ser publicados por link.',
    '// O arquivo permanece restrito; acesso externo deve ocorrer por fluxo autenticado',
    '// ou por anexo de e-mail, nunca por permissão pública no Drive.',
    'salvo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);'
  ].join('\n');

  if (original.includes(insecure)) {
    if (!FIX) {
      console.error('P0: Comprovantes.gs ainda publica anexo com ANYONE_WITH_LINK.');
      process.exitCode = 2;
      return;
    }
    const updated = original.replace(insecure, secure);
    fs.writeFileSync(TARGET, updated, 'utf8');
    console.log('FIX aplicado: Comprovantes.gs agora mantém anexos restritos.');
    return;
  }

  if (original.includes('salvo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);')) {
    console.log('Comprovantes.gs já está endurecido (PRIVATE/NONE).');
    return;
  }

  throw new Error('Assinatura esperada de compartilhamento não encontrada em Comprovantes.gs; abortando para evitar alteração cega.');
}

function auditPublicSharing() {
  const findings = [];
  for (const file of walk(ROOT)) {
    if (rel(file) === 'scripts/harden-drive-sharing-hml.js') continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of PUBLIC_SHARING_PATTERNS) {
      pattern.re.lastIndex = 0;
      let match;
      while ((match = pattern.re.exec(text)) !== null) {
        findings.push({ file: rel(file), line: lineOf(text, match.index), pattern: pattern.name });
      }
    }
  }

  if (findings.length) {
    console.error('\nAUDITORIA: ainda existem referências de compartilhamento público no código:');
    for (const f of findings) console.error(`- ${f.file}:${f.line} -> ${f.pattern}`);
    process.exitCode = 3;
  } else {
    console.log('\nAUDITORIA OK: nenhuma referência conhecida de compartilhamento público foi encontrada nos fontes .gs/.js/.html.');
  }
}

hardenComprovantes();
if (!process.exitCode) auditPublicSharing();
