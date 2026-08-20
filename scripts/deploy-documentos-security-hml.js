#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_ID = '1S_LckCVMJy0dza6tlw5w9Vq7ZqJ9RzxsrYoPMR1zl65rKXC-JgvDUSVR';
const DEPLOYMENT_ID = 'AKfycbzOfoQ4y2yc7oM9hiz2ATvB6YztGEMDjgO1FiezQ0schgqcOJnJgROzCC3sEeV6h4n0ZA';
const TARGETS = [
  { local: 'Comprovantes.gs', name: 'Comprovantes', type: 'SERVER_JS' },
  { local: 'ComprovantesNF.html', name: 'ComprovantesNF', type: 'HTML' },
  { local: 'RelatoriosOficios.gs', name: 'RelatoriosOficios', type: 'SERVER_JS' }
];

function oauthConfigFromClasprc(raw) {
  const rc = JSON.parse(raw);
  if (rc.tokens) {
    const key = rc.tokens.default ? 'default' : Object.keys(rc.tokens)[0];
    if (key) return rc.tokens[key];
  }
  if (rc.token) return rc.token;
  return rc;
}

async function refreshAccessToken(cfg) {
  const required = ['client_id', 'client_secret', 'refresh_token'];
  for (const k of required) {
    if (!cfg || !cfg[k]) throw new Error(`Credencial clasp sem ${k}.`);
  }

  const body = new URLSearchParams({
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    refresh_token: cfg.refresh_token,
    grant_type: 'refresh_token'
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Falha ao renovar OAuth (${res.status}): ${json.error || 'sem access_token'}.`);
  }
  return json.access_token;
}

async function api(pathname, token, options = {}) {
  const res = await fetch(`https://script.googleapis.com/v1${pathname}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (_) {}
  if (!res.ok) {
    const msg = json && json.error && json.error.message ? json.error.message : `HTTP ${res.status}`;
    throw new Error(`Apps Script API ${pathname}: ${msg}`);
  }
  return json;
}

function cleanRemoteFile(file) {
  return {
    name: file.name,
    type: file.type,
    source: typeof file.source === 'string' ? file.source : ''
  };
}

function localSource(target) {
  const p = path.join(ROOT, target.local);
  if (!fs.existsSync(p)) throw new Error(`Arquivo local ausente: ${target.local}`);
  const source = fs.readFileSync(p, 'utf8');
  if (/DriveApp\.Access\.ANYONE_WITH_LINK/.test(source)) {
    throw new Error(`P0 bloqueado: ${target.local} ainda contém ANYONE_WITH_LINK.`);
  }
  return source;
}

async function main() {
  const raw = process.env.CLASPRC_JSON;
  if (!raw) throw new Error('Secret CLASPRC_JSON não informado.');

  const token = await refreshAccessToken(oauthConfigFromClasprc(raw));
  const projectPath = `/projects/${SCRIPT_ID}`;

  // Lê o projeto remoto antes de qualquer escrita. updateContent substitui o
  // projeto inteiro, portanto preservamos todos os arquivos remotos e trocamos
  // somente os três alvos auditados.
  const remote = await api(`${projectPath}/content`, token);
  if (!Array.isArray(remote.files) || !remote.files.length) {
    throw new Error('Projeto HML remoto retornou sem arquivos; abortando para evitar sobrescrita cega.');
  }

  const files = remote.files.map(cleanRemoteFile);
  for (const target of TARGETS) {
    const idx = files.findIndex(f => f.name === target.name && f.type === target.type);
    if (idx < 0) throw new Error(`Arquivo remoto não encontrado: ${target.name} (${target.type}).`);
    files[idx].source = localSource(target);
  }

  // Manifesto obrigatório e alvo fixo de HML.
  if (!files.some(f => f.name === 'appsscript' && f.type === 'JSON')) {
    throw new Error('Manifesto appsscript remoto ausente; abortando.');
  }

  await api(`${projectPath}/content`, token, {
    method: 'PUT',
    body: JSON.stringify({ files })
  });

  // Verificação pós-escrita no HEAD remoto.
  const check = await api(`${projectPath}/content`, token);
  for (const target of TARGETS) {
    const expected = localSource(target);
    const got = (check.files || []).find(f => f.name === target.name && f.type === target.type);
    if (!got || got.source !== expected) {
      throw new Error(`Verificação remota falhou para ${target.name}.`);
    }
  }

  const deployment = await api(`${projectPath}/deployments/${DEPLOYMENT_ID}`, token);
  if (!deployment || deployment.deploymentId !== DEPLOYMENT_ID) {
    throw new Error('Deployment HML esperado não foi confirmado pela API.');
  }

  const version = await api(`${projectPath}/versions`, token, {
    method: 'POST',
    body: JSON.stringify({ description: 'P0 segurança Documentos - compartilhamento privado' })
  });
  if (!version.versionNumber) throw new Error('Versão HML não foi criada.');

  const manifestFileName =
    deployment.deploymentConfig && deployment.deploymentConfig.manifestFileName
      ? deployment.deploymentConfig.manifestFileName
      : 'appsscript';

  await api(`${projectPath}/deployments/${DEPLOYMENT_ID}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      deploymentConfig: {
        scriptId: SCRIPT_ID,
        versionNumber: version.versionNumber,
        manifestFileName,
        description: 'HML - P0 segurança Documentos'
      }
    })
  });

  const deployed = await api(`${projectPath}/deployments/${DEPLOYMENT_ID}`, token);
  const deployedVersion = deployed && deployed.deploymentConfig && deployed.deploymentConfig.versionNumber;
  if (Number(deployedVersion) !== Number(version.versionNumber)) {
    throw new Error(`Deployment não aponta para a versão criada (${version.versionNumber}).`);
  }

  const proofDir = path.join(ROOT, '.ci');
  fs.mkdirSync(proofDir, { recursive: true });
  fs.writeFileSync(path.join(proofDir, 'security-documentos-hml-deploy.json'), JSON.stringify({
    ambiente: 'HOMOLOGACAO',
    scriptId: SCRIPT_ID,
    deploymentId: DEPLOYMENT_ID,
    versionNumber: version.versionNumber,
    deployedAt: new Date().toISOString(),
    files: TARGETS.map(t => t.local)
  }, null, 2) + '\n');

  console.log(`Deploy HML confirmado na versão ${version.versionNumber}.`);
}

main().catch(err => {
  console.error(`DEPLOY HML FALHOU: ${err.message}`);
  process.exit(1);
});
