// ============================================================================
// 📥 ARQUIVO: EventosImportacaoTeste.gs
// 🏷️  COMPASSO 2026 — Carregar a planilha do ano passado como massa de teste
// ============================================================================
//
// O QUE ORIGINOU
//
// 21/08/2026. O usuário: "eu já tenho uma planilha do ano passado. Então quero
// utilizar ela como base." E o motivo: "preciso fazer teste se o QR Code é
// validado, se vai dar algum erro."
//
// POR QUE ESSA PLANILHA VALE MAIS QUE O SIMULADOR
//
// O `compasso_simularMassa` gera gente perfeita: nome limpo, CPF sequencial
// válido, escola numerada. Uma planilha real tem o que quebra sistema de
// verdade — nome em CAIXA ALTA e minúscula misturadas, CPF com e sem
// pontuação, campo vazio, linha repetida, acento inconsistente, e-mail
// inválido, telefone com e sem DDD.
//
// É por isso que a onda de 10/50/200 do plano deve rodar com ESTA base, e não
// com a simulada.
//
// EU NÃO VEJO A SUA PLANILHA
//
// Não tenho acesso ao Drive do sindicato. Então o importador não pode assumir
// colunas: ele LÊ O CABEÇALHO e descobre sozinho qual coluna é qual, por
// nomes aproximados. E antes de importar ele MOSTRA o que entendeu.
//
// Conferir o mapeamento antes é o que impede a pior falha possível aqui:
// importar 400 pessoas com a coluna errada e só descobrir quando o ingresso
// sair com o nome da escola no lugar do nome da pessoa.
//
// COMO USAR (editor do Apps Script, homologação)
//
//   1. compasso_importarConferir("<id da planilha>")
//      → mostra as colunas que encontrou e as 5 primeiras linhas. Não grava.
//
//   2. compasso_importarExecutar("<id da planilha>", 50)
//      → importa as 50 primeiras como inscrições de teste.
//
//   3. compasso_importarLimpar()
//      → apaga tudo que veio da importação. Só o que veio dela.
//
// TRAVAS: homologação e administrador. Isto cria inscrição de verdade.
// ============================================================================

var COMPASSO_IMPORT_ORIGEM = 'IMPORTACAO_TESTE';

/**
 * Nomes que cada campo pode ter no cabeçalho. Sem acento e em minúscula na
 * comparação — planilha de sindicato tem "Nome", "NOME COMPLETO", "Servidor",
 * e todas querem dizer a mesma coisa.
 */
var COMPASSO_IMPORT_COLUNAS = {
  nome:     ['nome completo', 'nome', 'servidor', 'associado', 'participante', 'nome do associado'],
  cpf:      ['cpf', 'c.p.f', 'cpf do associado', 'documento'],
  escola:   ['escola', 'unidade', 'lotacao', 'local de trabalho', 'instituicao', 'nome fantasia'],
  cidade:   ['cidade', 'municipio', 'cidade/municipio'],
  email:    ['email', 'e-mail', 'e mail', 'correio eletronico'],
  whatsapp: ['whatsapp', 'whats', 'celular', 'telefone', 'contato', 'fone', 'tel'],
  rg:       ['rg', 'identidade', 'registro geral']
};

/** Tira acento e baixa a caixa, para comparar cabeçalho de forma tolerante. */
function compasso_normalizarTexto_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Descobre qual coluna é qual, lendo o cabeçalho.
 * Devolve { campo: índice }, e a lista do que NÃO conseguiu identificar.
 */
function compasso_importarMapear_(cabecalho) {
  var mapa = {}, usadas = {};
  var normalizado = (cabecalho || []).map(compasso_normalizarTexto_);

  Object.keys(COMPASSO_IMPORT_COLUNAS).forEach(function (campo) {
    var apelidos = COMPASSO_IMPORT_COLUNAS[campo];
    /* Passo 1: igualdade exata. É o mais confiável e roda primeiro para
       "nome" não roubar a coluna "nome da escola". */
    for (var i = 0; i < normalizado.length; i++) {
      if (usadas[i]) continue;
      if (apelidos.indexOf(normalizado[i]) >= 0) { mapa[campo] = i; usadas[i] = true; return; }
    }
    /* Passo 2: o cabeçalho CONTÉM o apelido. Só depois de esgotar o exato. */
    for (var j = 0; j < normalizado.length; j++) {
      if (usadas[j] || !normalizado[j]) continue;
      for (var k = 0; k < apelidos.length; k++) {
        if (normalizado[j].indexOf(apelidos[k]) >= 0) { mapa[campo] = j; usadas[j] = true; return; }
      }
    }
  });

  var naoAchados = Object.keys(COMPASSO_IMPORT_COLUNAS).filter(function (c) {
    return mapa[c] === undefined;
  });
  return { mapa: mapa, naoAchados: naoAchados, cabecalho: cabecalho || [] };
}

/** Lê a planilha e devolve cabeçalho + linhas. Aba: a primeira, ou a nomeada. */
function compasso_importarLer_(planilhaId, aba) {
  var ss = SpreadsheetApp.openById(String(planilhaId || '').trim());
  var sh = aba ? ss.getSheetByName(aba) : ss.getSheets()[0];
  if (!sh) throw new Error('Aba não encontrada. Abas disponíveis: ' +
    ss.getSheets().map(function (x) { return x.getName(); }).join(', '));
  if (sh.getLastRow() < 2) throw new Error('A aba "' + sh.getName() + '" não tem linhas de dados.');
  var dados = sh.getDataRange().getValues();
  return { nomeAba: sh.getName(), cabecalho: dados[0], linhas: dados.slice(1) };
}

/**
 * CONFERIR — mostra o que entendeu da planilha. Não grava nada.
 * É o passo que impede importar 400 pessoas com a coluna trocada.
 */
function compasso_importarConferir(planilhaId, aba, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — conferir importação', true);

  var lido, m;
  try {
    lido = compasso_importarLer_(planilhaId, aba);
    m = compasso_importarMapear_(lido.cabecalho);
  } catch (e) {
    var erro = '❌ ' + e.message;
    Logger.log(erro); return erro;
  }

  var L = [];
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  CONFERÊNCIA DA PLANILHA — nada foi importado ainda');
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  Aba    : ' + lido.nomeAba);
  L.push('  Linhas : ' + lido.linhas.length);
  L.push('');
  L.push('  O QUE ENTENDI DE CADA COLUNA:');
  Object.keys(COMPASSO_IMPORT_COLUNAS).forEach(function (campo) {
    var i = m.mapa[campo];
    L.push('    ' + (campo + '..........').slice(0, 10) + ' ' +
      (i === undefined ? '❌ não encontrei'
                       : '✅ coluna ' + (i + 1) + '  "' + lido.cabecalho[i] + '"'));
  });

  if (m.naoAchados.length) {
    L.push('');
    L.push('  Colunas do arquivo que não usei:');
    lido.cabecalho.forEach(function (c, i) {
      var usada = Object.keys(m.mapa).some(function (k) { return m.mapa[k] === i; });
      if (!usada && String(c || '').trim()) L.push('    ' + (i + 1) + '. ' + c);
    });
  }

  /* Amostra: é onde a coluna trocada aparece aos olhos. Um "nome" que mostra
     escola salta na hora — nenhuma validação automática substitui isso. */
  L.push('');
  L.push('  AS 5 PRIMEIRAS LINHAS, COMO EU AS LERIA:');
  var validos = 0, semNome = 0, semContato = 0;
  lido.linhas.forEach(function (linha, idx) {
    var p = compasso_importarLinha_(linha, m.mapa);
    if (compasso_cpfValido_(p.cpf)) validos++;
    if (!p.nome) semNome++;
    if (!p.email && !p.whatsapp) semContato++;
    if (idx < 5) {
      L.push('    ' + (idx + 2) + '· ' + (p.nome || '(sem nome)'));
      L.push('        CPF ' + (p.cpf || '—') +
             (p.cpf ? (compasso_cpfValido_(p.cpf) ? ' ✅' : ' ❌ inválido') : '') +
             ' · ' + (p.escola || '(sem escola)') + ' · ' + (p.cidade || '(sem cidade)'));
      L.push('        ' + (p.email || '(sem e-mail)') + ' · ' + (p.whatsapp || '(sem whats)'));
    }
  });

  L.push('');
  L.push('  DIAGNÓSTICO DAS ' + lido.linhas.length + ' LINHAS:');
  L.push('    CPF válido      : ' + validos + '  (' +
         Math.round(validos / lido.linhas.length * 100) + '%)');
  L.push('    Sem nome        : ' + semNome);
  L.push('    Sem contato     : ' + semContato +
         '  ← estas NÃO podem receber ingresso');
  L.push('');
  if (m.mapa.nome === undefined || m.mapa.cpf === undefined) {
    L.push('  ⚠️  Sem NOME e CPF identificados não dá para importar.');
    L.push('      Me diga o nome exato dessas colunas que eu acrescento à lista.');
  } else {
    L.push('  Se o mapeamento acima está certo, importe:');
    L.push('    compasso_importarExecutar("' + planilhaId + '", 50)');
    L.push('  Comece com 50. A onda 1 do plano é 10, 50 e 200.');
  }
  L.push('═══════════════════════════════════════════════════════════');

  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}

/** Extrai uma linha conforme o mapa, já limpando o que dá para limpar. */
function compasso_importarLinha_(linha, mapa) {
  function v(campo) {
    var i = mapa[campo];
    return i === undefined ? '' : String(linha[i] == null ? '' : linha[i]).trim();
  }
  return {
    nome: v('nome'), cpf: v('cpf').replace(/\D/g, ''), rg: v('rg'),
    escola: v('escola'), cidade: v('cidade'),
    email: v('email').toLowerCase(),
    whatsapp: v('whatsapp').replace(/\D/g, '')
  };
}

/**
 * IMPORTAR — cria as inscrições de teste.
 *
 * Passa pelo MESMO caminho da inscrição pública
 * (`compasso_criarInscricaoAssociado_publica_`), sem atalho: importar por
 * outra porta provaria outra coisa, e o objetivo é justamente testar aquele
 * caminho com dado real.
 *
 * @param {string} planilhaId
 * @param {number=} limite  quantas linhas (padrão 50 — a onda 1 do plano)
 */
function compasso_importarExecutar(planilhaId, limite, aba, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — importar planilha de teste', true);
  compasso_assertHomologacao_();

  var lido = compasso_importarLer_(planilhaId, aba);
  var m = compasso_importarMapear_(lido.cabecalho);
  if (m.mapa.nome === undefined || m.mapa.cpf === undefined)
    return '❌ Não identifiquei as colunas de NOME e CPF. Rode compasso_importarConferir primeiro.';

  limite = Math.min(Math.max(Number(limite || 50), 1), 500);
  var inicio = Date.now();
  fs_medirIniciar_('importação de ' + limite);

  var r = { criadas: 0, cpfInvalido: 0, semNome: 0, semContato: 0,
            duplicadas: 0, erro: 0, tempoEsgotado: false };
  var exemplos = [];

  for (var i = 0; i < lido.linhas.length && r.criadas < limite; i++) {
    if (Date.now() - inicio > 240000) { r.tempoEsgotado = true; break; }

    var p = compasso_importarLinha_(lido.linhas[i], m.mapa);
    if (!p.nome || p.nome.indexOf(' ') < 0) { r.semNome++; continue; }
    if (!compasso_cpfValido_(p.cpf)) { r.cpfInvalido++; continue; }
    if (!p.email && !p.whatsapp) { r.semContato++; continue; }

    var res;
    try {
      res = compasso_criarInscricaoAssociado_publica_({
        nome: p.nome, cpf: p.cpf, rg: p.rg,
        escola: p.escola || '(não informada)', cidade: p.cidade || '(não informada)',
        email: p.email, whatsapp: p.whatsapp,
        origem: COMPASSO_IMPORT_ORIGEM,
        situacaoAssociado: compasso_situacaoAssociado_(compasso_buscarAssociado_(p.cpf)),
        termoVersao: 'IMPORTACAO', termoHash: '', termoAceitoEm: new Date()
      });
    } catch (e) { res = { ok: false, erro: e.message }; }

    if (res && res.ok) {
      r.criadas++;
      if (exemplos.length < 3) exemplos.push(p.nome + ' · ' + res.inscricaoId);
    } else if (res && /Já existe uma inscrição/.test(res.erro || '')) {
      r.duplicadas++;
    } else {
      r.erro++;
    }
  }

  var metrica = fs_medirFechar_();

  var L = [];
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  IMPORTAÇÃO CONCLUÍDA — ' + lido.nomeAba);
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  Criadas          : ' + r.criadas);
  L.push('  Duplicadas       : ' + r.duplicadas + '  (mesmo CPF já importado)');
  L.push('  CPF inválido     : ' + r.cpfInvalido);
  L.push('  Sem nome completo: ' + r.semNome);
  L.push('  Sem contato      : ' + r.semContato);
  L.push('  Erro             : ' + r.erro);
  if (r.tempoEsgotado) L.push('  ⏱️  Parou no tempo. Rode de novo para continuar.');
  if (exemplos.length) { L.push(''); L.push('  Exemplos criados:');
    exemplos.forEach(function (e) { L.push('    ' + e); }); }
  L.push('');
  L.push('  CONSUMO MEDIDO DESTA IMPORTAÇÃO:');
  L.push('    leituras cobradas : ' + metrica.leiturasCobradas +
         '  (' + metrica.percentualDoTetoDiario.leituras + ' do teto diário)');
  L.push('    gravações        : ' + metrica.gravacoesCobradas +
         '  (' + metrica.percentualDoTetoDiario.gravacoes + ' do teto diário)');
  if (r.criadas > 0) {
    L.push('    por inscrição    : ' +
      (Math.round(metrica.leiturasCobradas / r.criadas * 10) / 10) + ' leituras · ' +
      (Math.round(metrica.gravacoesCobradas / r.criadas * 10) / 10) + ' gravações');
  }
  L.push('');
  L.push('  Abra o painel para ver a lista:  ?painel=compasso');
  L.push('  Para desfazer:  compasso_importarLimpar()');
  L.push('═══════════════════════════════════════════════════════════');

  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}

/**
 * VALIDAR E EMITIR EM LOTE — só o que veio da importação de teste.
 *
 * O usuário: "eu vou gerar vários ingressos com os dados do ano passado de
 * teste pra fazer essa validação."
 *
 * Sem isto, gerar 200 ingressos seria clicar "Emitir" 200 vezes no painel.
 * Aqui a cadeia inteira roda de uma vez: validação administrativa → emissão
 * do ingresso com QR assinado.
 *
 * O QUE ELE NÃO FAZ, DE PROPÓSITO: enviar. Emitir 200 ingressos é barato;
 * mandar 200 e-mails come a cota diária do Gmail inteira. O envio continua
 * sendo escolha explícita, pelo painel ou pelo `compasso_enviarLoteEmail`.
 *
 * O QUE ELE NÃO TOCA: inscrição que não tenha vindo da importação. Filtra por
 * origem, mesma disciplina da limpeza.
 *
 * @param {number=} limite  quantos ingressos gerar (padrão 50)
 */
function compasso_emitirLoteTeste(limite, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — emitir lote de teste', true);
  compasso_assertHomologacao_();

  limite = Math.min(Math.max(Number(limite || 50), 1), 500);
  var inicio = Date.now();
  fs_medirIniciar_('emissão de ' + limite);

  /* Uma listagem só, no começo. Listar dentro do laço custaria N vezes a
     coleção inteira — que é justamente o problema de custo que a medição
     desta semana encontrou na busca da portaria. */
  var pendentes = fs_list_('inscricoesEventos', 1000).filter(function (x) {
    return x.eventoId === EMISSAO_CFG.EVENTO_ID &&
           String(x.origem || '') === COMPASSO_IMPORT_ORIGEM &&
           !x.ingressoId;
  });

  var r = { validadas: 0, emitidas: 0, erroValidacao: 0, erroEmissao: 0,
            semVaga: 0, tempoEsgotado: false, primeiroErro: '' };
  var exemplo = null;

  for (var i = 0; i < pendentes.length && r.emitidas < limite; i++) {
    if (Date.now() - inicio > 240000) { r.tempoEsgotado = true; break; }
    var ins = pendentes[i];

    /* 1. validação administrativa — o mesmo caminho que a Central usa. */
    if (String(ins.status || '') !== COMPASSO_STATUS.VALIDADA) {
      try {
        var v = compasso_validarDecisaoAdmin(ins.inscricaoId, COMPASSO_STATUS.VALIDADA,
                                             '', 'Lote de teste', tokenSessao);
        if (!v || !v.ok) { r.erroValidacao++; continue; }
        r.validadas++;
      } catch (e) {
        r.erroValidacao++;
        if (!r.primeiroErro) r.primeiroErro = 'validação: ' + e.message;
        continue;
      }
    }

    /* 2. emissão V2 — a segura, com QR assinado por HMAC. */
    try {
      var e2 = compasso_emitirIngressoV2({ inscricaoId: ins.inscricaoId }, tokenSessao);
      if (e2 && e2.ok) {
        r.emitidas++;
        if (!exemplo) exemplo = { nome: ins.nome, numero: e2.numero,
                                  url: compasso_ingressoUrlPublica_(e2.qrToken) };
      } else if (e2 && /[Vv]agas/.test(String(e2.erro || ''))) {
        r.semVaga++;
      } else {
        r.erroEmissao++;
        if (!r.primeiroErro) r.primeiroErro = 'emissão: ' + ((e2 && e2.erro) || '?');
      }
    } catch (e) {
      r.erroEmissao++;
      if (!r.primeiroErro) r.primeiroErro = 'emissão: ' + e.message;
    }
  }

  var m = fs_medirFechar_();

  var L = [];
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  INGRESSOS GERADOS — lote de teste');
  L.push('═══════════════════════════════════════════════════════════');
  L.push('  Inscrições sem ingresso : ' + pendentes.length);
  L.push('  Validadas agora         : ' + r.validadas);
  L.push('  INGRESSOS EMITIDOS      : ' + r.emitidas);
  if (r.semVaga)       L.push('  Sem vaga                : ' + r.semVaga + '  ← as 2.000 acabaram');
  if (r.erroValidacao) L.push('  Erro na validação       : ' + r.erroValidacao);
  if (r.erroEmissao)   L.push('  Erro na emissão         : ' + r.erroEmissao);
  if (r.primeiroErro)  L.push('  Primeiro erro           : ' + r.primeiroErro);
  if (r.tempoEsgotado) L.push('  ⏱️  Parou no tempo. Rode de novo para continuar.');

  if (exemplo) {
    L.push('');
    L.push('  ABRA ESTE, PARA CONFERIR O QR:');
    L.push('    ' + exemplo.nome + ' · ' + exemplo.numero);
    L.push('    ' + exemplo.url);
  }

  L.push('');
  L.push('  CONSUMO MEDIDO:');
  L.push('    leituras cobradas : ' + m.leiturasCobradas +
         '  (' + m.percentualDoTetoDiario.leituras + ' do teto diário)');
  L.push('    gravações        : ' + m.gravacoesCobradas +
         '  (' + m.percentualDoTetoDiario.gravacoes + ' do teto diário)');
  if (r.emitidas > 0) {
    L.push('    por ingresso     : ' +
      (Math.round(m.leiturasCobradas / r.emitidas * 10) / 10) + ' leituras · ' +
      (Math.round(m.gravacoesCobradas / r.emitidas * 10) / 10) + ' gravações');
    L.push('    projeção p/ 2000 : ' + Math.round(m.leiturasCobradas / r.emitidas * 2000) +
      ' leituras · ' + Math.round(m.gravacoesCobradas / r.emitidas * 2000) + ' gravações');
  }
  L.push('');
  L.push('  NÃO enviei nenhum e-mail: emitir e enviar são passos separados.');
  L.push('  Emitir 200 e barato; mandar 200 e-mails come a cota do Gmail.');
  L.push('  Para enviar, use o painel (?painel=compasso), filtro A ENVIAR.');
  L.push('═══════════════════════════════════════════════════════════');

  var texto = L.join('\n');
  Logger.log(texto);
  return texto;
}

/**
 * Apaga o que veio da importação — e SÓ isso.
 *
 * Filtra por `origem === 'IMPORTACAO_TESTE'`. Inscrição feita pela tela
 * pública durante o teste tem origem diferente e NÃO é tocada: apagar o teste
 * de alguém junto seria pior que não ter limpeza.
 */
function compasso_importarLimpar(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — limpar importação de teste', true);
  compasso_assertHomologacao_();

  var docs = fs_list_('inscricoesEventos', 1000).filter(function (x) {
    return x.eventoId === EMISSAO_CFG.EVENTO_ID &&
           String(x.origem || '') === COMPASSO_IMPORT_ORIGEM;
  });

  var apagadas = 0, comIngresso = 0;
  docs.forEach(function (ins) {
    /* Inscrição que já virou ingresso não some por aqui: o ingresso tem QR
       emitido e vaga consumida. O caminho é cancelar o ingresso primeiro, que
       devolve a vaga e invalida o token. */
    if (ins.ingressoId) { comIngresso++; return; }
    try {
      emissao_fsDelete_('inscricoesEventos', ins.inscricaoId || ins._docId);
      var chave = compasso_inscricaoChave_('', ins.cpf);
      emissao_fsDelete_('inscricaoUnicaEventos', chave);
      apagadas++;
    } catch (e) {}
  });

  /* A reserva de vagas volta ao que era: cada inscrição apagada devolve uma. */
  try {
    var r = compasso_lerReservaVagas_();
    r.reservadas = Math.max(0, Number(r.reservadas || 0) - apagadas);
    r.atualizadoEm = new Date();
    fs_set_('reservasEventos', EMISSAO_CFG.EVENTO_ID, r);
  } catch (e) {}

  compasso_auditar_('LIMPEZA_IMPORTACAO_TESTE', 'evento', EMISSAO_CFG.EVENTO_ID,
                    { apagadas: apagadas, mantidasComIngresso: comIngresso });

  var texto = '🧹 ' + apagadas + ' inscrição(ões) de teste apagadas. ' +
    (comIngresso ? comIngresso + ' foram MANTIDAS porque já têm ingresso emitido — ' +
                   'cancele o ingresso antes (compasso_cancelarIngressoV2).'
                 : 'Nenhuma tinha ingresso emitido.') +
    ' Vagas devolvidas ao contador.';
  Logger.log(texto);
  return texto;
}

/* ═══════════════════════════════════════════════════════════════════════════
   OS ATALHOS QUE O EDITOR CONSEGUE EXECUTAR

   As quatro funções acima pedem argumentos — `planilhaId`, `aba`, `limite`.
   O botão Executar do Apps Script chama tudo SEM argumentos, então nenhuma
   delas roda pelo editor. Foi a terceira vez que esse mesmo desenho apareceu
   em 21/08/2026 (antes no diagnóstico e no piloto): eu venho escrevendo as
   chamadas como quem escreve código, e quem usa está diante de um seletor de
   funções, não de um console.

   Aqui os dados vêm das Propriedades do script — declare uma vez, use o
   semestre inteiro:

       COMPASSO_IMPORT_PLANILHA   a planilha do ano passado (obrigatória)
       COMPASSO_IMPORT_ABA        nome da aba (opcional; padrão: a primeira)
       COMPASSO_IMPORT_LIMITE     quantas linhas por rodada (opcional: 10)

   A planilha aceita tanto o ID quanto a URL inteira colada da barra do
   navegador — que é o que a pessoa realmente copia.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Aceita ID puro ou URL de planilha e devolve sempre o ID.
 * Ninguém copia o ID: copia a URL. Exigir o ID seria transformar um passo
 * óbvio numa mensagem de erro.
 */
function compasso_importarIdDaPlanilha_(valor) {
  var v = String(valor || '').trim();
  var m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : v;
}

/** Lê as propriedades de importação, ou explica o que falta. */
function compasso_importarConfig_() {
  var props = PropertiesService.getScriptProperties();
  var bruto = String(props.getProperty('COMPASSO_IMPORT_PLANILHA') || '').trim();
  if (!bruto) {
    throw new Error(
      'Falta dizer qual planilha.\n\n' +
      'Em Configurações do projeto → Propriedades do script, declare:\n' +
      '    COMPASSO_IMPORT_PLANILHA = <ID ou URL da planilha do ano passado>\n\n' +
      'Opcionais:\n' +
      '    COMPASSO_IMPORT_ABA    = nome da aba (padrão: a primeira)\n' +
      '    COMPASSO_IMPORT_LIMITE = linhas por rodada (padrão: 10)');
  }
  var limite = parseInt(props.getProperty('COMPASSO_IMPORT_LIMITE'), 10);
  return {
    planilhaId: compasso_importarIdDaPlanilha_(bruto),
    aba: String(props.getProperty('COMPASSO_IMPORT_ABA') || '').trim(),
    limite: (limite > 0) ? limite : 10
  };
}

/**
 * PASSO 1 — conferir. Não grava nada.
 * Mostra o que entendeu de cada coluna. É o passo que impede importar 400
 * pessoas com a coluna trocada.
 */
function compassoImportarConferir() {
  exigirAdminOuSessao_('', 'eventos', 'Compasso — conferir importação (editor)', true);
  var cfg;
  try { cfg = compasso_importarConfig_(); }
  catch (e) { Logger.log(e.message); return e.message; }
  Logger.log('Conferindo a planilha ' + cfg.planilhaId +
             (cfg.aba ? ' · aba "' + cfg.aba + '"' : ' · primeira aba'));
  return compasso_importarConferir(cfg.planilhaId, cfg.aba);
}

/**
 * PASSO 2 — importar de verdade, respeitando COMPASSO_IMPORT_LIMITE.
 * Só rode depois que o passo 1 mostrar as colunas certas.
 */
function compassoImportarExecutar() {
  exigirAdminOuSessao_('', 'eventos', 'Compasso — importar (editor)', true);
  var cfg;
  try { cfg = compasso_importarConfig_(); }
  catch (e) { Logger.log(e.message); return e.message; }
  Logger.log('Importando até ' + cfg.limite + ' linha(s) da planilha ' + cfg.planilhaId +
             '. Para mudar, ajuste COMPASSO_IMPORT_LIMITE.');
  return compasso_importarExecutar(cfg.planilhaId, cfg.limite, cfg.aba);
}

/**
 * PASSO 3 — validar e emitir ingresso para o que foi importado.
 * NÃO envia: emitir é barato, mandar e-mail consome cota. O envio continua
 * sendo escolha explícita, pelo painel.
 */
function compassoEmitirLoteTeste() {
  exigirAdminOuSessao_('', 'eventos', 'Compasso — emitir lote de teste (editor)', true);
  var limite = 10;
  try { limite = compasso_importarConfig_().limite; } catch (e) {}
  Logger.log('Emitindo até ' + limite + ' ingresso(s) do que foi importado.');
  return compasso_emitirLoteTeste(limite);
}

/**
 * PASSO 4 — apagar o que veio da importação, e só isso.
 * Inscrição feita pela tela pública durante o teste tem origem diferente e
 * não é tocada.
 */
function compassoImportarLimpar() {
  exigirAdminOuSessao_('', 'eventos', 'Compasso — limpar importação (editor)', true);
  return compasso_importarLimpar();
}
