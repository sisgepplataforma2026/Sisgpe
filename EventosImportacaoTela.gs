// ============================================================================
// 📄 ARQUIVO: EventosImportacaoTela.gs
// 🏷️  COMPASSO 2026 — a importação de planilha com TELA
// ============================================================================
//
// O QUE ORIGINOU
//
// 21/08/2026. O usuário perguntou: *"Tem local para enviar planilha?"* — e não
// tinha. A importação existia só por `COMPASSO_IMPORT_PLANILHA` nas
// Propriedades do script, que é lugar de configuração de sistema, não de
// operação. Depois ele definiu como queria: *"seria mais uma opção, por
// exemplo anexar uma planilha e o painel reconhecer"*.
//
// A ORDEM DA TELA É A ORDEM DA SEGURANÇA
//
//   1. de onde vem   — anexo OU link do Drive
//   2. o que entendi — cada coluna, com o cabeçalho real ao lado
//   3. prévia        — as 5 primeiras linhas, já validadas
//   4. importar      — e só aqui alguma coisa é gravada
//
// Nada toca o Firestore antes do passo 4. O passo 2 é o que impede importar
// 400 pessoas com a coluna de escola no lugar do nome — e é por isso que ele
// mostra o cabeçalho ORIGINAL de cada coluna, não só o nome do campo que eu
// adivinhei.
//
// O ANEXO NÃO FICA GUARDADO
//
// Converte pelo Drive, lê os valores, apaga o temporário. É o mesmo caminho
// que a Cobrança já usa em `cob_lerGridDePlanilhaAnexo_` — reaproveitado de
// propósito, para não existir um segundo jeito de fazer a mesma coisa neste
// projeto.
//
// TRAVA
//
// Homologação e administrador do módulo Eventos, as duas. Esta tela cria
// inscrição de verdade e consome vaga das 2.000.
// ============================================================================

/** Tipos que o Drive converte. */
var COMPASSO_IMP_EXTENSOES = ['.xlsx', '.xls', '.csv', '.ods'];

/**
 * Lê a planilha e devolve o que entendeu — SEM GRAVAR NADA.
 *
 * Aceita as duas origens que a tela oferece:
 *   - anexo:  { base64: 'data:...;base64,AAA', nome: 'inscritos.xlsx' }
 *   - link:   { url: 'https://docs.google.com/spreadsheets/d/.../edit' }
 *
 * @return {Object} { ok, aba, abas[], linhas, mapa, cabecalho[], naoUsadas[],
 *                    previa[], sessaoId }
 */
function compassoImp_conferir(origem, aba, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — conferir planilha (tela)', true);
  compasso_assertHomologacao_();
  origem = origem || {};

  var grid, nomeAba = '', abas = [];
  try {
    var lido = compassoImp_abrir_(origem, aba);
    grid = lido.grid; nomeAba = lido.nomeAba; abas = lido.abas;
  } catch (e) {
    return { ok: false, erro: e.message };
  }

  if (!grid || grid.length < 2)
    return { ok: false, erro: 'A aba "' + nomeAba + '" não tem linhas de dados.' };

  var cabecalho = grid[0];
  var linhas = grid.slice(1).filter(function (l) {
    return l.join('').trim() !== '';   /* linha em branco no fim não conta */
  });

  var m = compasso_importarMapear_(cabecalho);

  /* As colunas que sobraram: dizer quais são ajuda a pessoa a perceber que a
     coluna que ela procura está ali, só com outro nome. */
  var naoUsadas = [];
  cabecalho.forEach(function (c, i) {
    var usada = Object.keys(m.mapa).some(function (k) { return m.mapa[k] === i; });
    if (!usada && String(c || '').trim()) naoUsadas.push({ indice: i, titulo: String(c) });
  });

  return {
    ok: true,
    aba: nomeAba,
    abas: abas,
    linhas: linhas.length,
    cabecalho: cabecalho.map(function (c) { return String(c == null ? '' : c); }),
    mapa: m.mapa,
    naoUsadas: naoUsadas,
    previa: compassoImp_previa_(linhas, m.mapa, 5)
  };
}

/**
 * Importa de verdade. É o único ponto deste arquivo que grava.
 *
 * @param {Object} origem       mesma coisa do conferir
 * @param {string} aba
 * @param {number} limite       quantas linhas
 * @param {Object=} mapaManual  correções que a pessoa fez na tela
 */
/**
 * IMPORTAR — a porta antiga, de uma tacada só.
 *
 * Continua existindo com a mesma assinatura porque quem chamava continua
 * chamando. Por dentro delega para a faixa, que é onde o trabalho mora.
 */
function compassoImp_importar(origem, aba, limite, mapaManual, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — importar planilha (tela)', true);
  compasso_assertHomologacao_();
  var teto = parseInt(limite, 10); if (!(teto > 0)) teto = 10;
  return compassoImp_rodarFaixa_(origem, aba, mapaManual, 0, teto, teto);
}

/**
 * IMPORTAR EM LOTES, COM PORCENTAGEM DE VERDADE — 15/09/2026.
 *
 * "Tinha que ter um contador de porcentagem quando estiver importando."
 *
 * O `google.script.run` é uma chamada única e bloqueante: o servidor processa
 * tudo e só responde no fim. Não existe meio do caminho para o navegador
 * escutar, então barra de progresso honesta só é possível de um jeito — a
 * tela pede de 25 em 25 e sabe, a cada resposta, exatamente onde está.
 *
 * O GANHO MAIOR NÃO É A BARRA. É que a importação deixa de ter teto de tempo.
 * O caminho antigo carregava uma trava de 4 minutos no meio do laço: se
 * estourasse, parava pela metade e devolvia "tempo esgotado" — e quem estava
 * importando não sabia o que tinha entrado e o que não. Em faixas, cada
 * chamada é curta por construção, e o total deixa de importar.
 *
 * A planilha é reaberta a cada faixa. Para planilha por link isso é leitura
 * barata; para arquivo anexado o Drive converte de novo a cada lote, e é o
 * preço de saber onde se está. Se algum dia doer, o conserto é guardar a
 * grade lida no cache e passar a chave — não é preciso hoje.
 *
 * @param {Object} faixa  { inicio, tamanho, total }
 */
function compassoImp_importarLote(origem, aba, mapaManual, faixa, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — importar planilha (lote)', true);
  compasso_assertHomologacao_();
  faixa = faixa || {};
  var inicio  = Math.max(0, parseInt(faixa.inicio, 10) || 0);
  var tamanho = parseInt(faixa.tamanho, 10); if (!(tamanho > 0)) tamanho = 25;
  tamanho = Math.min(tamanho, 100);
  var total   = parseInt(faixa.total, 10); if (!(total > 0)) total = tamanho;
  return compassoImp_rodarFaixa_(origem, aba, mapaManual, inicio, tamanho, total);
}

/**
 * O miolo, que as duas portas usam. Uma regra só: quem importa tudo de uma vez
 * e quem importa de 25 em 25 passam exatamente pelo mesmo caminho, senão o
 * teste de um não diria nada sobre o outro.
 */
function compassoImp_rodarFaixa_(origem, aba, mapaManual, inicio, quantas, total) {
  var lido;
  try { lido = compassoImp_abrir_(origem || {}, aba); }
  catch (e) { return { ok: false, erro: e.message }; }

  var cabecalho = lido.grid[0];
  var linhas = lido.grid.slice(1).filter(function (l) { return l.join('').trim() !== ''; });
  var m = compasso_importarMapear_(cabecalho);

  /* O que a pessoa apontou na tela vence o que eu adivinhei. Ela está olhando
     a planilha; eu estou olhando o nome da coluna. */
  var ajustes = 0;
  Object.keys(mapaManual || {}).forEach(function (campo) {
    var i = parseInt(mapaManual[campo], 10);
    if (!isNaN(i) && i >= 0) { m.mapa[campo] = i; ajustes++; }
  });

  /* O total pedido limita tudo; a faixa é uma janela dentro dele. */
  var teto = Math.min(total, linhas.length);
  var fim  = Math.min(inicio + quantas, teto);
  var janela = linhas.slice(inicio, fim);

  var criadas = 0, ignoradas = [], erros = [];
  for (var i = 0; i < janela.length; i++) {
    /* O número da linha é o da PLANILHA, não o da janela: quem for conferir
       vai abrir o arquivo e procurar por ele. */
    var numeroLinha = inicio + i + 2;
    var dados = compasso_importarLinha_(janela[i], m.mapa);
    var motivo = compassoImp_recusar_(dados);
    if (motivo) { ignoradas.push({ linha: numeroLinha, nome: dados.nome || '(sem nome)', motivo: motivo }); continue; }
    try {
      var r = compasso_criarInscricaoAssociado_publica_({
        nome: dados.nome, cpf: dados.cpf, rg: dados.rg || '',
        escola: dados.escola || '', cidade: dados.cidade || '',
        email: dados.email || '', whatsapp: dados.whatsapp || '',
        origem: COMPASSO_IMPORT_ORIGEM
      });
      if (r && r.ok) criadas++;
      else ignoradas.push({ linha: numeroLinha, nome: dados.nome, motivo: (r && r.erro) || 'recusada' });
    } catch (e) {
      erros.push({ linha: numeroLinha, nome: dados.nome, erro: e.message });
    }
  }

  var terminou = fim >= teto;
  compasso_auditar_('IMPORTACAO_TELA', 'planilha', lido.nomeAba,
    { criadas: criadas, ignoradas: ignoradas.length, erros: erros.length,
      ajustesDeColuna: ajustes, inicio: inicio, fim: fim, total: teto });

  return {
    ok: true, criadas: criadas, ignoradas: ignoradas, erros: erros,
    ajustesDeColuna: ajustes,
    /* O que a barra precisa saber, e nada além: onde parou, quanto falta. */
    inicio: inicio, fim: fim, total: teto,
    proximoInicio: terminou ? -1 : fim,
    terminou: terminou,
    mensagem: criadas + ' inscrição(ões) criada(s)' +
      (ignoradas.length ? ' · ' + ignoradas.length + ' ignorada(s)' : '') +
      (erros.length ? ' · ' + erros.length + ' com erro' : '') + '.'
  };
}

/* ── leitura ───────────────────────────────────────────────────────────── */

/**
 * Abre a planilha, venha ela de anexo ou de link, e devolve sempre a mesma
 * coisa: { grid, nomeAba, abas[] }.
 *
 * O anexo é convertido pelo Drive e o temporário é APAGADO no finally — se a
 * leitura estourar no meio, o arquivo não fica para trás no Drive de quem
 * rodou.
 */
function compassoImp_abrir_(origem, aba) {
  var ss = null, temporarioId = '';

  if (origem.base64) {
    var nome = String(origem.nome || 'planilha');
    if (!compassoImp_extensaoAceita_(nome))
      throw new Error('Formato não aceito: "' + nome + '". Aceito ' +
                      COMPASSO_IMP_EXTENSOES.join(', ') + '.');
    var blob = compassoImp_blobDoBase64_(origem.base64, nome);
    var arq = Drive.Files.insert({ title: 'TMP_COMPASSO_IMPORT_' + new Date().getTime() },
                                 blob, { convert: true });
    if (!arq || !arq.id) throw new Error('O Drive não conseguiu converter esta planilha.');
    temporarioId = arq.id;
    ss = SpreadsheetApp.openById(arq.id);
  } else if (origem.url) {
    var id = compasso_importarIdDaPlanilha_(origem.url);
    if (!id) throw new Error('Não reconheci esse link de planilha.');
    ss = SpreadsheetApp.openById(id);
  } else {
    throw new Error('Anexe uma planilha ou cole o link de uma.');
  }

  try {
    var abas = ss.getSheets().map(function (s) { return s.getName(); });
    var sh = aba ? ss.getSheetByName(aba) : ss.getSheets()[0];
    if (!sh) throw new Error('Aba "' + aba + '" não encontrada. Abas: ' + abas.join(', '));
    return { grid: sh.getDataRange().getValues(), nomeAba: sh.getName(), abas: abas };
  } finally {
    if (temporarioId) {
      try { DriveApp.getFileById(temporarioId).setTrashed(true); } catch (e) { /* silencioso */ }
    }
  }
}

function compassoImp_extensaoAceita_(nome) {
  var n = String(nome || '').toLowerCase();
  for (var i = 0; i < COMPASSO_IMP_EXTENSOES.length; i++) {
    if (n.slice(-COMPASSO_IMP_EXTENSOES[i].length) === COMPASSO_IMP_EXTENSOES[i]) return true;
  }
  return false;
}

/** 'data:application/...;base64,AAAA' → Blob. Aceita também base64 puro. */
function compassoImp_blobDoBase64_(base64, nome) {
  var s = String(base64 || '');
  var virgula = s.indexOf(',');
  var tipo = 'application/octet-stream';
  if (s.indexOf('data:') === 0 && virgula > 0) {
    var cabec = s.slice(5, virgula);
    tipo = cabec.split(';')[0] || tipo;
    s = s.slice(virgula + 1);
  }
  return Utilities.newBlob(Utilities.base64Decode(s), tipo, String(nome || 'planilha'));
}

/* ── prévia e validação ────────────────────────────────────────────────── */

/**
 * As primeiras linhas, já com o veredito de cada uma.
 *
 * Mostrar CPF inválido ANTES de importar é o que evita descobrir na portaria,
 * quando já não dá para corrigir.
 */
function compassoImp_previa_(linhas, mapa, quantas) {
  var out = [];
  for (var i = 0; i < Math.min(quantas, linhas.length); i++) {
    var d = compasso_importarLinha_(linhas[i], mapa);
    var motivo = compassoImp_recusar_(d);
    out.push({
      linha: i + 2,
      nome: d.nome || '', cpf: d.cpf || '', escola: d.escola || '',
      cidade: d.cidade || '', email: d.email || '', whatsapp: d.whatsapp || '',
      ok: !motivo, motivo: motivo || ''
    });
  }
  return out;
}

/** O motivo pelo qual uma linha não entra — ou '' se ela entra. */
/**
 * O QUE ORIGINOU AS DUAS TRAVAS DE NOME (24/08/2026)
 *
 * O usuário importou 201 linhas e a coluna NOME da lista veio cheia de
 * e-mail. A causa primeira foi o mapeador, já corrigida. Mas o estrago só
 * chegou ao Firestore porque ESTA função deixou passar — e ela era a última
 * porta antes de gravar.
 *
 * Havia duas regras diferentes para a mesma coisa, e ninguém tinha reparado:
 *
 *   compasso_importarExecutar (porta do editor)  exigia nome COM ESPAÇO
 *   compassoImp_recusar_      (porta da tela)    exigia nome NÃO VAZIO
 *
 * "maria@gmail.com" não tem espaço. Pela porta do editor, as 122 linhas
 * teriam sido recusadas na hora, com o motivo à vista. Pela porta da tela —
 * a que a pessoa usa — passaram todas, caladas. A regra frouxa estava
 * justamente no caminho que alguém percorre de verdade.
 *
 * Agora a regra é uma só, e vive aqui: as duas portas chamam esta função.
 *
 * A trava do arroba é o que teria economizado o dia: em vez de descobrir na
 * lista, a PRÉVIA diria "linha 2: nome parece e-mail" antes de gravar
 * qualquer coisa.
 */
function compassoImp_recusar_(d) {
  var nome = String((d && d.nome) || '').trim();
  if (!nome) return 'sem nome';
  if (nome.indexOf('@') >= 0)
    return 'o nome parece um e-mail — confira o mapeamento das colunas';
  if (nome.indexOf(' ') < 0)
    return 'nome sem sobrenome (' + nome + ')';

  var cpf = String((d && d.cpf) || '').replace(/\D/g, '');
  if (!cpf) return 'sem CPF';
  if (cpf.length !== 11) return 'CPF com ' + cpf.length + ' dígito(s)';
  if (typeof compasso_cpfValido_ === 'function' && !compasso_cpfValido_(cpf))
    return 'CPF inválido';
  return '';
}
