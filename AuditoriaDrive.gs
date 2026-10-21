// ============================================================================
// 🔍 ARQUIVO: AuditoriaDrive.gs
// 🏷️  SISGEP — Contar o que está público no Drive. SÓ CONTAR.
// ============================================================================
//
// O QUE ORIGINOU
//
// 20/08/2026. O `ArquivoDrive.gs` fechou o compartilhamento no CÓDIGO: as 23
// chamadas de `setSharing(ANYONE_WITH_LINK)` que existiam em 14 arquivos não
// existem mais, e o `t71` impede que voltem.
//
// Isso vale DAQUI PARA A FRENTE. Todo PDF gravado antes continua exatamente
// como foi gravado: acessível a qualquer pessoa com a URL, sem login e sem
// expiração. São recibos, comprovantes, documentos jurídicos, holerites e
// documentos de voucher — com CPF, valor e nome de associado.
//
// É o item 28 de docs/PENDENTE-VERIFICACAO.md, e é a exposição que existe
// AGORA, não risco futuro.
//
// POR QUE ESTE ARQUIVO SÓ CONTA, E NÃO CORRIGE
//
// Decisão deliberada, e o passo 1 do roteiro do item 28.
//
// Revogar acesso em massa é irreversível na prática: o Drive não guarda
// histórico de permissão, então não há "desfazer". E ninguém sabe hoje o
// TAMANHO do problema — pode ser 40 arquivos ou 12.000. Essas duas decisões
// (revogar tudo de uma vez, ou por pasta, ou só de certos tipos) mudam
// completamente conforme o número.
//
// Medir primeiro é barato e reversível. Corrigir sem medir é apostar.
//
// A promessa deste arquivo é que ele NÃO ALTERA NADA. Há teste fixando isso:
// tests/e2e/t74-auditoria-drive.js reprova se qualquer chamada de escrita
// aparecer aqui — inclusive uma que alguém acrescente "só para adiantar".
//
// POR QUE É RETOMÁVEL, E NÃO UM LAÇO SÓ
//
// `getSharingAccess()` custa uma chamada de API POR ARQUIVO, e o Apps Script
// mata a execução em 6 minutos. Com milhares de arquivos, um laço único morre
// no meio e devolve nada — pior do que não rodar, porque parece que rodou.
//
// Então: o contador trabalha por ~4 minutos, GRAVA ONDE PAROU numa Script
// Property e devolve o parcial. Rodar de novo continua de onde estava. O
// relatório sempre diz se terminou ou se falta.
//
// COMO USAR (no editor do Apps Script, projeto de PRODUÇÃO):
//
//   1. auditoriaDrive_contar_()     roda ~4 min, mostra o parcial
//   2. repita até o relatório dizer CONCLUÍDO
//   3. auditoriaDrive_status_()     vê o andamento sem processar nada
//   4. auditoriaDrive_reiniciar_()  zera e recomeça do zero
//
// O sufixo `_` é de propósito: o editor roda função com underscore, mas o
// `google.script.run` não a alcança. Contar o acervo é operação de quem
// administra, não endpoint da web.
// ============================================================================

/** Chave onde o progresso fica entre uma execução e outra. */
var AUDITORIA_DRIVE_PROP = 'SISGEP_AUDITORIA_DRIVE';

/** Orçamento de tempo. O limite do Apps Script é 6 min; paramos bem antes. */
var AUDITORIA_DRIVE_SEGUNDOS = 240;

/** Teto de segurança contra pasta com recursão inesperada. */
var AUDITORIA_DRIVE_MAX_PASTAS = 5000;

/**
 * As pastas a auditar, com o nome que aparece no relatório.
 * Sai de AmbienteRecursos.gs e SistemaConfig.gs — os mesmos IDs que o sistema
 * usa para gravar. Se um dia surgir uma pasta nova, ela entra aqui.
 */
function auditoriaDrive_alvos_() {
  var alvos = [];

  function juntar(rotulo, id) {
    id = String(id || '').trim();
    if (!id) return;
    for (var i = 0; i < alvos.length; i++) if (alvos[i].id === id) return;
    alvos.push({ rotulo: rotulo, id: id });
  }

  /* Pastas por ambiente — sempre as de PRODUÇÃO, que é onde está o acervo. */
  try {
    if (typeof RECURSOS_AMBIENTE === 'object' && RECURSOS_AMBIENTE) {
      Object.keys(RECURSOS_AMBIENTE).forEach(function (k) {
        juntar(k, RECURSOS_AMBIENTE[k].producao);
      });
    }
  } catch (e) {}

  /* Pastas de ofício e relatório, de SistemaConfig.gs. */
  try {
    if (typeof PASTAS === 'object' && PASTAS) {
      Object.keys(PASTAS).forEach(function (k) { juntar(k, PASTAS[k]); });
    }
  } catch (e) {}

  return alvos;
}

/** Estado gravado entre execuções. */
function auditoriaDrive_lerEstado_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(AUDITORIA_DRIVE_PROP);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function auditoriaDrive_gravarEstado_(estado) {
  PropertiesService.getScriptProperties()
    .setProperty(AUDITORIA_DRIVE_PROP, JSON.stringify(estado));
}

function auditoriaDrive_estadoNovo_() {
  var alvos = auditoriaDrive_alvos_();
  return {
    iniciadoEm: new Date().toISOString(),
    fila: alvos.map(function (a) { return { rotulo: a.rotulo, id: a.id }; }),
    feitas: {},          /* id da pasta já varrida -> true */
    contagem: {},        /* rótulo -> { total, publicos, dominio, privados, erro } */
    amostra: [],         /* até 20 exemplos, para conferência manual */
    concluido: false
  };
}

/**
 * Conta os arquivos públicos. Roda por ~4 minutos e devolve o parcial.
 *
 * NÃO ALTERA NADA. Só `getSharingAccess()`, que é leitura.
 */
function auditoriaDrive_contar_() {
  var inicio = Date.now();
  var estado = auditoriaDrive_lerEstado_() || auditoriaDrive_estadoNovo_();

  if (estado.concluido) {
    return auditoriaDrive_relatorio_(estado,
      'Já concluído. Use auditoriaDrive_reiniciar_() para contar de novo.');
  }

  var pastasVistas = 0;
  var estourou = false;

  while (estado.fila.length && !estourou) {
    var atual = estado.fila.shift();

    if (estado.feitas[atual.id]) continue;
    estado.feitas[atual.id] = true;

    if (++pastasVistas > AUDITORIA_DRIVE_MAX_PASTAS) {
      estado.fila = [];
      break;
    }

    var pasta;
    try {
      pasta = DriveApp.getFolderById(atual.id);
    } catch (e) {
      auditoriaDrive_somar_(estado, atual.rotulo, 'erro');
      continue;
    }

    /* Subpastas entram na fila — o acervo é organizado por ano e por mês,
       então o que interessa quase nunca está na raiz. */
    try {
      var subs = pasta.getFolders();
      while (subs.hasNext()) {
        var sub = subs.next();
        if (!estado.feitas[sub.getId()]) {
          estado.fila.push({ rotulo: atual.rotulo, id: sub.getId() });
        }
      }
    } catch (e) {}

    /* Os arquivos da pasta. */
    try {
      var arquivos = pasta.getFiles();
      while (arquivos.hasNext()) {
        if (Date.now() - inicio > AUDITORIA_DRIVE_SEGUNDOS * 1000) {
          /* Devolve a pasta para a fila: ela não terminou. Sem isto, os
             arquivos restantes dela nunca seriam contados — e o relatório
             final diria um número menor do que o real, que é o pior tipo de
             erro num relatório de exposição. */
          estado.feitas[atual.id] = false;
          estado.fila.unshift(atual);
          estourou = true;
          break;
        }

        var arq = arquivos.next();
        var acesso;
        try {
          acesso = String(arq.getSharingAccess());
        } catch (e) {
          auditoriaDrive_somar_(estado, atual.rotulo, 'erro');
          continue;
        }

        if (acesso === 'ANYONE' || acesso === 'ANYONE_WITH_LINK') {
          auditoriaDrive_somar_(estado, atual.rotulo, 'publicos');
          if (estado.amostra.length < 20) {
            estado.amostra.push({
              rotulo: atual.rotulo,
              nome: arq.getName(),
              id: arq.getId(),
              acesso: acesso
            });
          }
        } else if (acesso === 'DOMAIN' || acesso === 'DOMAIN_WITH_LINK') {
          auditoriaDrive_somar_(estado, atual.rotulo, 'dominio');
        } else {
          auditoriaDrive_somar_(estado, atual.rotulo, 'privados');
        }
      }
    } catch (e) {
      auditoriaDrive_somar_(estado, atual.rotulo, 'erro');
    }

    if (Date.now() - inicio > AUDITORIA_DRIVE_SEGUNDOS * 1000) estourou = true;
  }

  if (!estado.fila.length) estado.concluido = true;
  auditoriaDrive_gravarEstado_(estado);

  return auditoriaDrive_relatorio_(estado,
    estado.concluido
      ? 'CONCLUÍDO — a contagem varreu tudo.'
      : 'PARCIAL — faltam ' + estado.fila.length + ' pasta(s). ' +
        'Rode auditoriaDrive_contar_() de novo para continuar.');
}

function auditoriaDrive_somar_(estado, rotulo, chave) {
  var c = estado.contagem[rotulo];
  if (!c) {
    c = { total: 0, publicos: 0, dominio: 0, privados: 0, erro: 0 };
    estado.contagem[rotulo] = c;
  }
  c[chave]++;
  if (chave !== 'erro') c.total++;
}

/** Mostra o andamento sem processar nada. */
function auditoriaDrive_status_() {
  var estado = auditoriaDrive_lerEstado_();
  if (!estado) {
    var texto = 'Nenhuma contagem iniciada. Rode auditoriaDrive_contar_().';
    Logger.log(texto);
    return texto;
  }
  return auditoriaDrive_relatorio_(estado,
    estado.concluido ? 'CONCLUÍDO.' : 'EM ANDAMENTO — faltam ' +
      estado.fila.length + ' pasta(s).');
}

/** Zera o progresso. Não toca em arquivo nenhum — só apaga o contador. */
function auditoriaDrive_reiniciar_() {
  PropertiesService.getScriptProperties().deleteProperty(AUDITORIA_DRIVE_PROP);
  var texto = 'Contagem zerada. Rode auditoriaDrive_contar_() para começar.';
  Logger.log(texto);
  return texto;
}

function auditoriaDrive_relatorio_(estado, situacao) {
  var L = [];
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  ARQUIVOS PÚBLICOS NO DRIVE — CONTAGEM');
  L.push('  (leitura apenas: NADA foi alterado)');
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  Iniciado em : ' + estado.iniciadoEm);
  L.push('  Situação    : ' + situacao);
  L.push('');

  var somaTotal = 0, somaPub = 0, somaDom = 0, somaErro = 0;
  var rotulos = Object.keys(estado.contagem).sort();

  if (!rotulos.length) {
    L.push('  (nenhum arquivo contado ainda)');
  } else {
    L.push('  PASTA                      TOTAL   PÚBLICOS   DOMÍNIO   ERRO');
    L.push('  ─────────────────────────────────────────────────────────────');
    rotulos.forEach(function (r) {
      var c = estado.contagem[r];
      somaTotal += c.total; somaPub += c.publicos;
      somaDom += c.dominio; somaErro += c.erro;
      L.push('  ' + (r + '                          ').slice(0, 26) +
             ('     ' + c.total).slice(-6) +
             ('        ' + c.publicos).slice(-11) +
             ('       ' + c.dominio).slice(-10) +
             ('     ' + c.erro).slice(-7));
    });
    L.push('  ─────────────────────────────────────────────────────────────');
    L.push('  ' + 'TOTAL                     '.slice(0, 26) +
           ('     ' + somaTotal).slice(-6) +
           ('        ' + somaPub).slice(-11) +
           ('       ' + somaDom).slice(-10) +
           ('     ' + somaErro).slice(-7));
  }

  L.push('');
  if (somaPub > 0) {
    L.push('  ⚠️  ' + somaPub + ' arquivo(s) acessível(is) por QUALQUER PESSOA');
    L.push('      que tenha a URL — sem login e sem expiração.');
    L.push('');
    L.push('  AMOSTRA (até 20, para conferir na mão antes de decidir):');
    estado.amostra.forEach(function (a) {
      L.push('    [' + a.rotulo + '] ' + a.nome);
      L.push('      https://drive.google.com/file/d/' + a.id + '/view');
    });
  } else if (estado.concluido) {
    L.push('  ✅ Nenhum arquivo público encontrado nas pastas auditadas.');
  }

  if (somaErro > 0) {
    L.push('');
    L.push('  ' + somaErro + ' arquivo(s)/pasta(s) não puderam ser lidos.');
    L.push('  Normalmente é permissão: a conta que roda o script não os');
    L.push('  alcança. Eles NÃO entram no total — o número real de públicos');
    L.push('  pode ser maior.');
  }

  L.push('');
  L.push('  PRÓXIMO PASSO: com o número na mão, decidir se a revogação é de');
  L.push('  uma vez ou por pasta. Este arquivo NÃO revoga — ver o item 28 em');
  L.push('  docs/PENDENTE-VERIFICACAO.md.');
  L.push('═══════════════════════════════════════════════════════════');

  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}
