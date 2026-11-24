// ============================================================================
// 🎫 ARQUIVO: EventosArquivoIngresso.gs
// 🏷️  COMPASSO DA VIDA 2026 — O ingresso vira arquivo guardado no Drive
// ============================================================================
//
// O QUE ORIGINOU ESTE ARQUIVO
//
// 09/09/2026. O usuário descreveu a operação inteira da festa, e uma etapa
// dela não existia no sistema:
//
//     inscrição no SISGEP  →  comprovante  →  análise individual  →
//     validação  →  INGRESSO GERADO E SALVO EM PASTA NOMINAL  →
//     envio gradual pelo WhatsApp, a partir de novembro
//
// Palavras dele: "Deve ser salvo nominal, com data e categoria".
//
// O sistema fazia todo o resto e não fazia esse. `compasso_ingressoPdf_`
// (EventosEntrega.gs) montava o PDF NA HORA — Utilities.newBlob(...).getAs
// (MimeType.PDF) — e o entregava direto como anexo. O arquivo nunca tocava o
// Drive. O comentário do próprio arquivo dizia, sem perceber o problema:
// "No ofício o PDF já existe no Drive e tem URL; aqui não".
//
// POR QUE ISSO QUEBRAVA A OPERAÇÃO DELE, e não era só uma ausência
//
// O ingresso é EMITIDO em setembro e ENTREGUE em novembro. Entre uma coisa e
// outra há dois meses em que o ingresso, do ponto de vista de quem trabalha,
// não existe em lugar nenhum: não dá para conferir, não dá para imprimir em
// lote, não dá para reenviar sem gerar de novo. E, sobretudo, o que sai em
// novembro não é o mesmo arquivo que foi conferido em setembro — é um arquivo
// novo, montado de novo, dependendo de novo do quickchart.io responder e do
// conversor de PDF do Google se comportar igual. Dois meses depois.
//
// Agora o arquivo é gravado na emissão e o acervo passa a ser a fonte: quem
// entrega em novembro manda O ARQUIVO QUE FOI VALIDADO, não uma segunda
// impressão dele.
//
// O NOME DO ARQUIVO É A INTERFACE
//
// Não há tela para o acervo, e não precisa haver: a pessoa vai abrir a pasta
// no Drive e procurar. Então o nome carrega tudo o que ela procura —
//
//     FCV-2026-000341 - MARIA DA SILVA SANTOS - ASSOCIADO - 09-09-2026.pdf
//     └─ número ─────┘   └─ nominal ────────┘   └ categoria ┘  └ data ──┘
//
// Número na frente porque ordena a pasta pela ordem de emissão e é a chave
// única; o resto porque é por ali que se procura. Digitar "MARIA" na busca do
// Drive acha; digitar "ACOMPANHANTE" lista os que dependem de pagamento.
//
// PASTA ÚNICA, NÃO SUBPASTA POR CATEGORIA. A categoria já está no nome, e
// dividir em três pastas obrigaria a saber a categoria ANTES de procurar a
// pessoa — que é o contrário de como a secretaria trabalha ("chegou a Maria,
// cadê o ingresso dela?"). Quem quiser mudar isso muda a pasta pela Script
// Property, sem tocar em código (ver AmbienteRecursos.gs).
//
// AS TRÊS TRAVAS QUE ESTE ARQUIVO RESPEITA — nenhuma é nova, todas já custaram
//
//  1. PASTA POR AMBIENTE. `getRecursoId_('INGRESSOS_FESTA')`. Sem isto o
//     ensaio de homologação gravaria ingresso de teste na pasta real da festa,
//     misturado aos 2.000 de verdade e sem nada avisando — exatamente o
//     defeito que AmbienteRecursos.gs foi escrito para impedir em 20/08.
//
//  2. ARQUIVO PRIVADO. `arquivoSalvarPrivado_` (ArquivoDrive.gs). O ingresso
//     carrega nome, escola e o QR que abre a portaria. Link público não expira
//     e não deixa rastro de quem abriu.
//
//  3. FORA DO LOCK DA EMISSÃO. Gerar PDF é buscar o QR por HTTP, converter e
//     escrever no Drive: alguns segundos. Segurar o lock do script durante
//     isso serializaria as inscrições que estão entrando ao mesmo tempo. Ver a
//     mudança correspondente em EventosEmissaoV2.gs.
//
// E A REGRA QUE MANDA EM TODAS: FALHAR AQUI NÃO DESFAZ A EMISSÃO.
//
// O ingresso existe no Firestore, o número foi consumido, a vaga foi baixada.
// Se o Drive estiver fora do ar, ou o quickchart não responder, o certo é o
// ingresso continuar emitido e o arquivo ficar faltando — nunca o contrário.
// O que falta o sistema recupera sozinho: toda entrega chama
// `compasso_ingressoPdfDoAcervo_`, que grava o que ainda não foi gravado.
// ============================================================================

/** Chave da pasta na tabela de recursos por ambiente. */
var COMPASSO_RECURSO_PASTA = 'INGRESSOS_FESTA';

/** Campos que o ingresso passa a guardar depois de arquivado. */
var COMPASSO_CAMPOS_ARQUIVO = ['arquivoId', 'arquivoNome', 'arquivoUrl', 'arquivadoEm'];

/**
 * Pasta do acervo no ambiente atual.
 *
 * Não trata o erro de propósito: se a pasta de homologação não estiver
 * declarada, `getRecursoId_` bloqueia, e o bloqueio precisa chegar em quem
 * chamou. Quem não pode quebrar por causa disto é a EMISSÃO — e ela não
 * quebra, porque chama através de `compasso_arquivarSeguro_`.
 */
function compasso_pastaAcervoId_() {
  return getRecursoId_(COMPASSO_RECURSO_PASTA);
}

/**
 * O nome do arquivo. É a interface do acervo — ver o cabeçalho.
 *
 * A data é a da EMISSÃO, não a de hoje: reprocessar o acervo em novembro não
 * pode renomear para novembro um ingresso emitido em setembro.
 */
function compasso_ingressoNomeArquivo_(ing) {
  ing = ing || {};

  var quando = ing.emitidoEm ? new Date(ing.emitidoEm) : new Date();
  if (isNaN(quando.getTime())) quando = new Date();

  var fuso = 'America/Sao_Paulo';
  try { fuso = Session.getScriptTimeZone() || fuso; } catch (e) {}
  var data = Utilities.formatDate(quando, fuso, 'dd-MM-yyyy');

  var partes = [
    compasso_nomeSeguro_(ing.numero, 'SEM-NUMERO'),
    compasso_nomeSeguro_(ing.nome, 'SEM-NOME').toUpperCase(),
    compasso_nomeSeguro_(compasso_categoriaLabel_(ing.categoria), 'SEM-CATEGORIA'),
    data
  ];

  return partes.join(' - ') + '.pdf';
}

/**
 * Limpa um pedaço do nome sem descaracterizá-lo.
 *
 * Acento FICA: o arquivo é para gente ler, e "JOSÉ" procurado como "JOSE" a
 * busca do Drive acha assim mesmo. O que sai é o que atrapalha o Drive e os
 * clientes de sincronização: barra, contrabarra, caractere de controle e
 * espaço repetido.
 */
function compasso_nomeSeguro_(valor, padrao) {
  var s = String(valor == null ? '' : valor)
    .replace(/[\/\\:*?"<>|]/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return String(padrao || '');
  return s.length > 90 ? s.substring(0, 90).trim() : s;
}

/**
 * O arquivo do ingresso no Drive, se já existir. `null` se não existir.
 *
 * Confere o que está gravado: id que não abre mais, ou arquivo na lixeira,
 * conta como inexistente — e o chamador grava de novo. É o que faz o acervo se
 * recompor sozinho depois de alguém apagar um arquivo por engano.
 */
function compasso_arquivoDoIngresso_(ing) {
  var id = String((ing && ing.arquivoId) || '').trim();
  if (!id) return null;
  try {
    var file = DriveApp.getFileById(id);
    if (!file) return null;
    if (typeof file.isTrashed === 'function' && file.isTrashed()) return null;
    return file;
  } catch (e) {
    Logger.log('Compasso/acervo: arquivo ' + id + ' não abre mais — ' + e.message);
    return null;
  }
}

/**
 * Grava o PDF do ingresso na pasta do acervo e devolve o que ficou gravado.
 *
 * IDEMPOTENTE pelo `arquivoId`: chamar duas vezes não cria dois arquivos. Isso
 * importa porque a entrega chama por baixo — e entregar por e-mail e depois
 * pelo WhatsApp não pode encher a pasta de duplicata da mesma pessoa.
 *
 * @param {Object} ing      O ingresso (como está no Firestore).
 * @param {string} qrToken  Token em texto claro; é regerável (HMAC).
 * @return {{id:string, nome:string, url:string, novo:boolean, file:Object}}
 */
function compasso_arquivarIngresso_(ing, qrToken) {
  if (!ing || !ing.ingressoId) throw new Error('Ingresso inválido para arquivamento.');

  var existente = compasso_arquivoDoIngresso_(ing);
  if (existente) {
    return {
      id: existente.getId(), nome: existente.getName(), url: existente.getUrl(),
      novo: false, file: existente
    };
  }

  var pdf   = compasso_ingressoPdf_(ing, qrToken || compasso_gerarQrToken_(ing.ingressoId));
  var nome  = compasso_ingressoNomeArquivo_(ing);
  var salvo = arquivoSalvarPrivado_(pdf, compasso_pastaAcervoId_(), {
    nome: nome,
    contexto: 'Ingresso ' + String(ing.numero || '') + ' — Compasso da Vida 2026'
  });

  compasso_registrarArquivoNoIngresso_(ing, salvo);

  compasso_auditar_('ARQUIVO_INGRESSO', 'ingresso', String(ing.ingressoId), {
    numero: String(ing.numero || ''), arquivo: salvo.nome, arquivoId: salvo.id
  });

  return { id: salvo.id, nome: salvo.nome, url: salvo.url, novo: true, file: salvo.file };
}

/**
 * Anota no ingresso onde o arquivo ficou.
 *
 * Relê o documento antes de gravar em vez de reescrever o objeto que estava em
 * memória: entre a emissão e este ponto o lock já foi solto, e um cancelamento
 * pode ter passado no meio. Reescrever o objeto antigo ressuscitaria um
 * ingresso cancelado — que é o único jeito de este arquivo, que só guarda PDF,
 * causar estrago de verdade.
 */
function compasso_registrarArquivoNoIngresso_(ing, salvo) {
  var id = String((ing && ing.ingressoId) || '').trim();
  if (!id || !salvo) return;

  var atual = null;
  try { atual = fs_get_('ingressos', id); } catch (e) {}
  var alvo = atual || ing;

  alvo.arquivoId   = String(salvo.id || '');
  alvo.arquivoNome = String(salvo.nome || '');
  alvo.arquivoUrl  = String(salvo.url || '');
  alvo.arquivadoEm = new Date();

  try {
    fs_set_('ingressos', id, alvo);
  } catch (e) {
    /* O arquivo já está no Drive; o que falhou foi a anotação. Registrar alto,
       porque a consequência é a próxima chamada gravar uma segunda cópia. */
    Logger.log('Compasso/acervo: PDF gravado mas o ingresso ' + id +
               ' não guardou o arquivoId — ' + e.message);
  }

  /* Espelha nos campos do ingresso em memória, para quem chamou não precisar
     reler só para saber o nome do arquivo. */
  COMPASSO_CAMPOS_ARQUIVO.forEach(function (campo) { ing[campo] = alvo[campo]; });
}

/**
 * Arquiva SEM ESTOURAR. É por aqui que a emissão chama.
 *
 * A emissão já terminou quando isto roda: o número foi consumido e a vaga
 * baixada. Deixar uma exceção subir daqui faria a tela mostrar erro num
 * ingresso que existe — e a pessoa tentaria emitir de novo, que é o pior
 * desfecho possível.
 */
function compasso_arquivarSeguro_(ing, qrToken) {
  try {
    var r = compasso_arquivarIngresso_(ing, qrToken);
    return { ok: true, id: r.id, nome: r.nome, url: r.url, novo: r.novo };
  } catch (e) {
    Logger.log('Compasso/acervo: falhou ao arquivar o ingresso ' +
               String((ing && ing.numero) || '') + ' — ' + e.message);
    try {
      compasso_auditar_('ARQUIVO_INGRESSO_FALHOU', 'ingresso',
                        String((ing && ing.ingressoId) || ''),
                        { numero: String((ing && ing.numero) || ''), erro: e.message });
    } catch (eAud) {}
    return { ok: false, erro: e.message };
  }
}

/**
 * O PDF que deve SAIR — do acervo, se estiver lá; gravando, se não estiver.
 *
 * É o ponto central da mudança. Toda entrega passa por aqui, então o que a
 * pessoa recebe em novembro é o arquivo conferido em setembro, e não uma
 * segunda geração dele. Ingresso emitido antes desta mudança não tem arquivo
 * nenhum — a primeira entrega grava, e a partir dali o acervo está completo.
 *
 * Se o Drive falhar, devolve o PDF gerado na hora em vez de derrubar a
 * entrega: entregar sem arquivar é pior que arquivar, e é melhor que não
 * entregar.
 */
function compasso_ingressoPdfDoAcervo_(ing, qrToken) {
  try {
    var r = compasso_arquivarIngresso_(ing, qrToken);
    if (r && r.file) {
      var blob = r.file.getBlob();
      if (blob) return blob.setName(r.nome);
    }
  } catch (e) {
    Logger.log('Compasso/acervo: entrega seguiu sem acervo para o ingresso ' +
               String((ing && ing.numero) || '') + ' — ' + e.message);
  }
  return compasso_ingressoPdf_(ing, qrToken || compasso_gerarQrToken_(ing.ingressoId));
}

/* ══════════════════════════════════════════════════════════════════════════
   O ACERVO DO QUE JÁ FOI EMITIDO

   Ingresso emitido antes de 09/09/2026 não tem arquivo. A entrega conserta um
   a um, mas isso só acontece em novembro — e o desenho do usuário é conferir a
   pasta ANTES. Esta função preenche o buraco de uma vez.

   Pública com porta (`exigirAdminOuSessao_`), não privada: função terminada em
   `_` não aparece no seletor do editor do Apps Script, e esta é justamente uma
   que alguém precisa conseguir rodar de lá.
   ══════════════════════════════════════════════════════════════════════════ */
function compassoArquivarIngressosPendentes(limite, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — arquivar ingressos pendentes', true);

  var teto = Number(limite || 0);
  if (!teto || teto < 1 || teto > 500) teto = 100;   /* 6 min de execução mandam aqui */

  var todos = fs_list_('ingressos') || [];
  var r = { ok: true, total: todos.length, arquivados: 0, jaTinham: 0, ignorados: 0,
            falhas: [], parou: false };

  for (var i = 0; i < todos.length; i++) {
    var ing = todos[i];
    if (!ing || String(ing.eventoId || '') !== EMISSAO_CFG.EVENTO_ID) { r.ignorados++; continue; }
    if (String(ing.status || '') === 'CANCELADO') { r.ignorados++; continue; }
    if (compasso_arquivoDoIngresso_(ing)) { r.jaTinham++; continue; }

    if (r.arquivados >= teto) { r.parou = true; break; }

    var res = compasso_arquivarSeguro_(ing);
    if (res.ok) r.arquivados++;
    else r.falhas.push({ numero: String(ing.numero || ''), erro: res.erro });
  }

  r.mensagem = r.arquivados + ' ingresso(s) arquivado(s), ' + r.jaTinham + ' já tinham arquivo' +
               (r.falhas.length ? ', ' + r.falhas.length + ' falharam' : '') +
               (r.parou ? '. Parou no limite de ' + teto + ' — rode de novo para continuar.' : '.');
  return r;
}

/* ══════════════════════════════════════════════════════════════════════════
   DIAGNÓSTICO — responde "a pasta está certa?" sem gravar nada.

   Chamado por `compassoDiagnostico()` (EventosPiloto.gs), que é a função que o
   usuário roda no editor. Aqui SEM `semTrava`: o objetivo é justamente ver o
   bloqueio quando ele existir.
   ══════════════════════════════════════════════════════════════════════════ */
function compasso_diagnosticoAcervo_() {
  var out = { recurso: COMPASSO_RECURSO_PASTA, ok: false, pastaId: '', pasta: '', erro: '' };
  try {
    out.pastaId = compasso_pastaAcervoId_();
    try { out.pasta = DriveApp.getFolderById(out.pastaId).getName(); }
    catch (e) { out.pasta = '(sem acesso)'; }
    out.ok = true;
  } catch (e) {
    out.erro = e.message;
  }
  return out;
}
