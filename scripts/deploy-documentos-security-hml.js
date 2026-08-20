#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* POSIÇÃO 41: É "I" MAIÚSCULO (U+0049), NÃO "l" MINÚSCULO (U+006C).
 *
 * Este arquivo nasceu com o `l` e por isso nunca conseguiu implantar uma vez
 * — a API respondia "Request contains an invalid argument", que não diz nada
 * sobre o ID estar errado, e manda procurar no lugar errado.
 *
 * É o MESMO defeito que já tinha custado um dia inteiro de depuração em
 * 20/08/2026 e que o commit 5e30919 consertou nos workflows. As duas letras
 * são idênticas na tela em quase toda fonte; conferir a olho não funciona —
 * não funcionou na primeira vez nem na segunda.
 *
 * Quem guarda isto agora é tests/e2e/t69-scriptid-homologacao.js, que compara
 * byte a byte todo Script ID do repositório contra o do workflow que implanta
 * de verdade. Se precisar mexer aqui, COPIE aquele valor em vez de redigitar. */
const SCRIPT_ID ='1S_LckCVMJy0dza6tlw5w9Vq7ZqJ9RzxsrYoPMR1zI65rKXC-JgvDUSVR';
const DEPLOYMENT_ID = 'AKfycbzOfoQ4y2yc7oM9hiz2ATvB6YztGEMDjgO1FiezQ0schgqcOJnJgROzCC3sEeV6h4n0ZA';
const TARGETS = [
  { local: 'Comprovantes.gs', name: 'Comprovantes', type: 'SERVER_JS' },
  { local: 'ComprovantesNF.html', name: 'ComprovantesNF', type: 'HTML' },
  { local: 'RelatoriosOficios.gs', name: 'RelatoriosOficios', type: 'SERVER_JS' }
];

function proofPath(name) {
  const dir = path.join(ROOT, '.ci');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, name);
}

function writeJson(name, data) {
  fs.writeFileSync(proofPath(name), JSON.stringify(data, null, 2) + '\n');
}

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

  if (!files.some(f => f.name === 'appsscript' && f.type === 'JSON')) {
    throw new Error('Manifesto appsscript remoto ausente; abortando.');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TRAVA DE CORRIDA — LEU, MUDOU, ESCREVEU

     O QUE ACONTECEU EM 20/08/2026, e que esta trava existe para impedir.

     Este script troca 3 arquivos, mas o PUT em /content REESCREVE A LISTA
     INTEIRA. Entre o GET da linha 120 e o PUT abaixo existe uma janela; se
     alguém publicar nessa janela, o PUT devolve o projeto ao estado da
     LEITURA e apaga o que entrou no meio.

     Foi o que ocorreu. O workflow deploy-homologacao.yml enviou às
     15:53:37–15:53:46; este script gravou às 15:54:30 com uma foto anterior.
     Resultado medido pelo modo `conferir` logo depois:

         repositorio: 220 arquivos      homologacao: 219
         SERIAM CRIADOS: AmbienteRecursos.gs   ← tinha subido e sumiu
         SERIAM ALTERADOS: 8 arquivos          ← voltaram à versão velha

     Os DOIS deploys terminaram VERDES. O segundo desfez o primeiro sem que
     nada acusasse — que é a pior forma de defeito, porque o relatório de
     sucesso é a prova aparente de que deu certo.

     A API do Apps Script não oferece ETag nem If-Match, então não há
     escrita condicional de verdade. O que dá para fazer é reler imediatamente
     antes do PUT e recusar se a lista de arquivos mudou. Não fecha a janela;
     encolhe para milissegundos e, sobretudo, transforma uma reversão
     SILENCIOSA numa recusa BARULHENTA.

     Se este script abortar aqui, não insista: quem escreveu por último foi
     outro deploy, e a resposta certa é rodar o deploy-homologacao.yml — que
     envia o repositório inteiro — em vez de reescrever por cima dele.
     ═══════════════════════════════════════════════════════════════════════ */
  const assinatura = lista => lista.map(f => `${f.type}:${f.name}`).sort().join('|');
  const antes = assinatura(remote.files);

  const revalidar = await api(`${projectPath}/content`, token);
  if (!Array.isArray(revalidar.files) || !revalidar.files.length) {
    throw new Error('Releitura do projeto HML voltou sem arquivos; abortando.');
  }
  const agora = assinatura(revalidar.files);

  if (antes !== agora) {
    const nomesAntes = new Set(remote.files.map(f => `${f.type}:${f.name}`));
    const nomesAgora = new Set(revalidar.files.map(f => `${f.type}:${f.name}`));
    const surgiram = [...nomesAgora].filter(n => !nomesAntes.has(n));
    const sumiram = [...nomesAntes].filter(n => !nomesAgora.has(n));
    throw new Error(
      'CORRIDA DETECTADA: o projeto HML mudou entre a leitura e a escrita. ' +
      'Escrever agora apagaria o que outro deploy acabou de publicar. ' +
      (surgiram.length ? `Surgiram: ${surgiram.join(', ')}. ` : '') +
      (sumiram.length ? `Sumiram: ${sumiram.join(', ')}. ` : '') +
      'Rode .github/workflows/deploy-homologacao.yml (modo publicar), que ' +
      'envia o repositório inteiro, em vez de reescrever por cima.'
    );
  }

  await api(`${projectPath}/content`, token, {
    method: 'PUT',
    body: JSON.stringify({ files })
  });

  const check = await api(`${projectPath}/content`, token);

  /* Verificar só os 3 alvos deixaria passar exatamente o defeito acima: os
     alvos ficariam certos e o resto teria sido varrido. Confere-se a lista
     inteira. */
  if (assinatura(check.files || []) !== antes) {
    throw new Error(
      'Pós-escrita: a lista de arquivos do projeto HML não bate com a que ' +
      'foi enviada. Algum arquivo foi perdido ou criado indevidamente.'
    );
  }

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

  writeJson('security-documentos-hml-deploy.json', {
    ambiente: 'HOMOLOGACAO',
    scriptId: SCRIPT_ID,
    deploymentId: DEPLOYMENT_ID,
    versionNumber: version.versionNumber,
    deployedAt: new Date().toISOString(),
    files: TARGETS.map(t => t.local)
  });

  try { fs.unlinkSync(proofPath('security-documentos-hml-deploy-error.json')); } catch (_) {}
  console.log(`Deploy HML confirmado na versão ${version.versionNumber}.`);
}

main().catch(err => {
  const mensagem = String(err && err.message ? err.message : err).slice(0, 1000);
  writeJson('security-documentos-hml-deploy-error.json', {
    ambiente: 'HOMOLOGACAO',
    failedAt: new Date().toISOString(),
    mensagem,
    scriptId: SCRIPT_ID,
    deploymentId: DEPLOYMENT_ID
  });
  console.error(`DEPLOY HML FALHOU: ${mensagem}`);
  process.exit(1);
});
