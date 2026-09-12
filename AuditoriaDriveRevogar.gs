// ============================================================================
// 🔒 ARQUIVO: AuditoriaDriveRevogar.gs
// 🏷️  SISGEP — Fechar o acesso público dos arquivos já gravados
// ============================================================================
//
// O QUE ORIGINOU
//
// 21/08/2026, 22:16. O `auditoriaDrive_contar_()` rodou em PRODUÇÃO e deu o
// número que faltava:
//
//     PASTA                 TOTAL   PÚBLICOS
//     VOUCHER_DOCUMENTOS       10         10   ← 100%
//     COMPROVANTES             18         11
//     OFICIOS                 348          5
//     RELATORIOS                7          2
//     ─────────────────────────────────────
//     TOTAL                   497         28
//
// 28 arquivos acessíveis por qualquer pessoa com a URL — sem login, sem
// expiração. Voucher de bolsa com nome de associado, comprovante de despesa,
// boleto. É o item 28 de docs/PENDENTE-VERIFICACAO.md.
//
// 28 cabe numa execução só. Não precisa de lote.
//
// POR QUE ARQUIVO SEPARADO DO CONTADOR
//
// O AuditoriaDrive.gs prometeu, no cabeçalho e no t74, que NÃO ALTERA NADA —
// e há teste que reprova se qualquer chamada de escrita aparecer lá. Essa
// promessa vale: é o que permitiu rodar a contagem em produção sem medo.
//
// Misturar a revogação naquele arquivo obrigaria a afrouxar o t74, e o teste
// perderia exatamente o que ele guarda. Então a revogação mora aqui, e lá
// continua valendo "só conta".
//
// POR QUE NÃO CHAMA setSharing DIRETO
//
// Porque o t71 proíbe: nenhum `.gs` além de ArquivoDrive.gs pode chamar
// setSharing. Não é burocracia — é a política que impediu 23 cópias da mesma
// linha de se espalharem de novo. Este arquivo chama
// `arquivoAplicarPolitica_`, que é o único lugar que decide compartilhamento,
// e herda PRIVATE/NONE de lá.
//
// Consequência boa: se um dia a política mudar, este revogador acompanha
// sozinho.
//
// CONFERIR ANTES DE EXECUTAR
//
// O padrão é `conferir` — lista o que faria e não toca em nada. Mesma
// disciplina do deploy de homologação, e pelo mesmo motivo: revogar é
// irreversível na prática. O Drive não guarda histórico de permissão; depois
// de fechado, não há "desfazer", só reabrir na mão arquivo por arquivo.
//
// O QUE FICA REGISTRADO
//
// Cada arquivo alterado vira uma linha na aba `_AUDITORIA_DRIVE_REVOGACAO`,
// com data, pasta, nome, id, o acesso ANTERIOR e o resultado. Sem isso, uma
// revogação em massa é uma mudança sem rastro — e este projeto já pagou caro
// por decisão sem rastro (REGRA Nº 1).
//
// COMO USAR (editor do Apps Script, projeto de PRODUÇÃO):
//
//   1. auditoriaRevogar_()                    conferir — não escreve nada
//   2. leia a lista
//   3. auditoriaRevogar_({modo:'executar'})   fecha o acesso
//
// O sufixo `_` mantém a função fora do alcance do google.script.run. Revogar
// acesso em massa não é endpoint de web.
// ============================================================================

var AUDITORIA_REVOGAR_ABA = '_AUDITORIA_DRIVE_REVOGACAO';

/** Mesmo orçamento do contador: o Apps Script mata a execução em 6 minutos. */
var AUDITORIA_REVOGAR_SEGUNDOS = 240;

/**
 * Fecha o acesso público dos arquivos das pastas auditadas.
 *
 * @param {Object=} opcoes  { modo: 'conferir' | 'executar' }
 * @return {string} relatório
 */
function auditoriaRevogar_(opcoes) {
  opcoes = opcoes || {};
  var executar = String(opcoes.modo || 'conferir') === 'executar';
  var inicio = Date.now();

  var alvos = (typeof auditoriaDrive_alvos_ === 'function')
    ? auditoriaDrive_alvos_() : [];

  if (!alvos.length) {
    return auditoriaRevogar_relatorio_([], executar,
      'Nenhuma pasta configurada. auditoriaDrive_alvos_ devolveu vazio.');
  }

  var fila = alvos.map(function (a) { return { rotulo: a.rotulo, id: a.id }; });
  var vistas = {};
  var achados = [];
  var estourou = false;

  while (fila.length && !estourou) {
    var atual = fila.shift();
    if (vistas[atual.id]) continue;
    vistas[atual.id] = true;

    var pasta;
    try {
      pasta = DriveApp.getFolderById(atual.id);
    } catch (e) {
      /* Pasta inexistente ou sem acesso. NÃO é motivo para parar: registra e
         segue. Foi assim que a auditoria de 21/08 descobriu que o ID de
         RECIBOS apontava para uma pasta que não existe. */
      achados.push({
        rotulo: atual.rotulo, nome: '(pasta inacessível)', id: atual.id,
        acesso: 'ERRO', resultado: 'pasta não pôde ser aberta: ' + e.message
      });
      continue;
    }

    /* Subpastas entram na fila — o acervo é organizado por ano e por mês. */
    try {
      var subs = pasta.getFolders();
      while (subs.hasNext()) {
        var sub = subs.next();
        if (!vistas[sub.getId()]) fila.push({ rotulo: atual.rotulo, id: sub.getId() });
      }
    } catch (e) {}

    try {
      var arquivos = pasta.getFiles();
      while (arquivos.hasNext()) {
        if (Date.now() - inicio > AUDITORIA_REVOGAR_SEGUNDOS * 1000) {
          estourou = true;
          break;
        }

        var arq = arquivos.next();
        var acesso;
        try {
          acesso = String(arq.getSharingAccess());
        } catch (e) {
          continue;
        }

        /* SÓ mexe no que está aberto. DOMAIN e PRIVATE ficam como estão —
           fechar o que já está fechado não é problema, mas mudar DOMAIN sem
           pedir seria decidir por quem configurou. */
        if (acesso !== 'ANYONE' && acesso !== 'ANYONE_WITH_LINK') continue;

        var item = {
          rotulo: atual.rotulo,
          nome: arq.getName(),
          id: arq.getId(),
          acesso: acesso,
          resultado: executar ? '' : '(conferir — nada foi alterado)'
        };

        if (executar) {
          try {
            /* O ÚNICO caminho permitido. Ver o cabeçalho: t71 proíbe
               setSharing fora do ArquivoDrive.gs, e este helper é quem
               carrega a política PRIVATE/NONE. */
            arquivoAplicarPolitica_(arq, 'AuditoriaDriveRevogar · ' + atual.rotulo);

            /* Confere que pegou, em vez de confiar. */
            var depois = String(arq.getSharingAccess());
            item.resultado = (depois === 'ANYONE' || depois === 'ANYONE_WITH_LINK')
              ? 'FALHOU — continua ' + depois
              : 'fechado (' + depois + ')';
          } catch (eRev) {
            item.resultado = 'ERRO: ' + eRev.message;
          }
        }

        achados.push(item);
      }
    } catch (e) {}
  }

  if (executar && achados.length) auditoriaRevogar_registrar_(achados);

  return auditoriaRevogar_relatorio_(achados, executar,
    estourou ? 'PARCIAL — o tempo estourou. Rode de novo para continuar.'
             : 'Varredura completa.');
}

/**
 * Grava o que foi alterado na aba de auditoria.
 * Sem rastro, revogação em massa é mudança que ninguém consegue reconstruir.
 */
function auditoriaRevogar_registrar_(achados) {
  try {
    var ss = SpreadsheetApp.openById(
      typeof PLANILHA_ID !== 'undefined' ? PLANILHA_ID : getPlanilhaId()
    );
    var sh = ss.getSheetByName(AUDITORIA_REVOGAR_ABA);
    if (!sh) {
      sh = ss.insertSheet(AUDITORIA_REVOGAR_ABA);
      sh.getRange(1, 1, 1, 6)
        .setValues([['QUANDO', 'PASTA', 'ARQUIVO', 'FILE_ID', 'ACESSO_ANTERIOR', 'RESULTADO']])
        .setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    var agora = new Date();
    var linhas = achados.map(function (a) {
      return [agora, a.rotulo, a.nome, a.id, a.acesso, a.resultado];
    });
    sh.getRange(sh.getLastRow() + 1, 1, linhas.length, 6).setValues(linhas);
  } catch (e) {
    Logger.log('auditoriaRevogar_registrar_: ' + e.message);
  }
}

function auditoriaRevogar_relatorio_(achados, executar, situacao) {
  var L = [];
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  REVOGAR ACESSO PÚBLICO NO DRIVE');
  L.push('  modo: ' + (executar ? 'EXECUTAR (altera de verdade)'
                                : 'CONFERIR (não altera nada)'));
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  Situação : ' + situacao);
  L.push('  Achados  : ' + achados.length + ' arquivo(s) com acesso público');
  L.push('');

  if (!achados.length) {
    L.push('  ✅ Nenhum arquivo público nas pastas auditadas.');
  } else {
    var porPasta = {};
    achados.forEach(function (a) { porPasta[a.rotulo] = (porPasta[a.rotulo] || 0) + 1; });
    Object.keys(porPasta).sort().forEach(function (p) {
      L.push('    ' + (p + '                         ').slice(0, 24) + porPasta[p]);
    });
    L.push('');
    achados.forEach(function (a) {
      L.push('    [' + a.rotulo + '] ' + a.nome);
      L.push('      ' + a.acesso + ' → ' + a.resultado);
    });
  }

  L.push('');
  if (!executar) {
    L.push('  NADA FOI ALTERADO. Para fechar de verdade:');
    L.push('      auditoriaRevogar_({modo:\'executar\'})');
    L.push('');
    L.push('  Revogar é irreversível na prática — o Drive não guarda histórico');
    L.push('  de permissão. Leia a lista acima antes.');
  } else {
    var falhas = achados.filter(function (a) {
      return /FALHOU|ERRO/.test(String(a.resultado));
    }).length;
    L.push('  Registrado na aba ' + AUDITORIA_REVOGAR_ABA + '.');
    if (falhas) {
      L.push('  ⚠️  ' + falhas + ' não puderam ser fechados — ver a coluna RESULTADO.');
    } else {
      L.push('  ✅ Todos fechados e conferidos um a um após a alteração.');
    }
  }
  L.push('═══════════════════════════════════════════════════════════');

  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}
