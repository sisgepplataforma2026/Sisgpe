/**
 * MOTOR DE EMISSÃO DE INGRESSOS — Festa Compasso da Vida 2026
 * Regras: 2000 vagas totais (atômico), período 21/09–11/11, número FCV sequencial,
 * associado/convidado gratuitos, acompanhante R$500 só emite se PAGO.
 * Depende da ponte em EventosFirestore (fs_set_, fs_get_, fs_getAccessToken_, fs_baseUrl_).
 */

// ================= CONFIGURAÇÃO =================
var EMISSAO_CFG = {
  EVENTO_ID: 'festa-compasso-2026',
  LIMITE_VAGAS: 2000,
  PREFIXO: 'FCV-2026-',
  VALOR_ACOMPANHANTE: 500,
  PERIODO_INICIO: new Date(2026, 8, 21, 0, 0, 0),    // 21/09/2026
  PERIODO_FIM:    new Date(2026, 10, 11, 23, 59, 59), // 11/11/2026
  FORMAS_PAGAMENTO: ['Cartão', 'PicPay', 'Depósito'],
  ABA_ASSOCIADOS: 'Associados'
  /* PLANILHA_ID saiu daqui em 21/08/2026. Estava fixo no ID de PRODUÇÃO, o
     que fazia a busca de associado de HOMOLOGAÇÃO ler a base real de 8.000
     pessoas. É a mesma classe de falha que o AmbienteRecursos.gs fechou para
     as pastas do Drive. Agora resolve por getPlanilhaId(), dentro da função —
     nunca aqui: este objeto é avaliado no carregamento do projeto, e chamar
     função de outro arquivo nesse momento depende da ordem de avaliação. */
};

/**
 * Modo teste: ignora o período de inscrição (para ensaiar antes de 21/09).
 *
 * DUAS CORREÇÕES NO MESMO DIA (21/08/2026), e a segunda desfaz um erro meu.
 *
 * 1. O padrão era `!== 'false'`: a AUSÊNCIA da propriedade LIGAVA o modo
 *    teste. Um projeto recém-implantado nascia com o período 21/09–11/11
 *    desligado e sem nada em tela dizendo isso. Pior: em modo teste o
 *    `compasso_qrSecret_` GERA um segredo sozinho em vez de recusar, então a
 *    chave que assina todos os QR do evento nascia de acidente de
 *    configuração. Isso tinha de acabar, e acabou.
 *
 * 2. Mas eu troquei por `=== 'true'` puro, e isso empurrou para a pessoa um
 *    passo manual: ir nas Propriedades do script declarar EVENTO_MODO_TESTE
 *    antes de conseguir testar. É exatamente o que a REGRA Nº 0.6 proíbe —
 *    o sistema JÁ SABE em que ambiente está, pela Script Property
 *    SISGEP_AMBIENTE que o AmbienteRecursos.gs e o SistemaConfig.gs já leem.
 *    Fazer a pessoa contar de novo é defeito de desenho, não configuração.
 *
 * A ordem abaixo preserva as duas coisas:
 *
 *   declarado 'true'  → teste          (força ensaio onde for preciso)
 *   declarado 'false' → produção       (força o período mesmo em homologação)
 *   NÃO declarado     → herda o ambiente:
 *                         homologação → teste
 *                         produção    → produção  ← continua falhando fechado
 *
 * Produção sem propriedade nenhuma continua exigindo o período e continua
 * recusando QR sem segredo configurado. O que mudou é que homologação não
 * precisa mais ser configurada à mão para ser homologação.
 *
 * A tela não fica em silêncio sobre isso: `emissao_status` devolve `modoTeste`
 * e o EventoPainel.html pinta a tarja MODO TESTE. Sugerir com origem à vista,
 * nunca impor em silêncio.
 */
function emissao_modoTeste_() {
  var props = PropertiesService.getScriptProperties();

  var declarado = String(props.getProperty('EVENTO_MODO_TESTE') || '').trim().toLowerCase();
  if (declarado === 'true')  return true;
  if (declarado === 'false') return false;

  /* Não declarado: herda de quem já sabe. Lido direto da propriedade, e não
     por getAmbienteAtual(), porque aquela função guarda cache em
     getAmbienteAtual._cache — trocar o ambiente no meio de uma execução de
     diagnóstico devolveria o valor velho. Aqui a leitura é sempre fresca. */
  return String(props.getProperty('SISGEP_AMBIENTE') || '').trim().toUpperCase() === 'HOMOLOGACAO';
}

/**
 * De onde veio o modo — para a tela e para o diagnóstico poderem explicar.
 * Sem isto, "MODO TESTE" na tela é um fato sem causa, e quem vê não sabe se
 * alguém declarou de propósito ou se o ambiente resolveu sozinho.
 */
function emissao_modoTesteOrigem_() {
  var props = PropertiesService.getScriptProperties();
  var declarado = String(props.getProperty('EVENTO_MODO_TESTE') || '').trim().toLowerCase();
  if (declarado === 'true')  return 'EVENTO_MODO_TESTE=true (declarado)';
  if (declarado === 'false') return 'EVENTO_MODO_TESTE=false (declarado)';
  var amb = String(props.getProperty('SISGEP_AMBIENTE') || '').trim();
  return amb
    ? 'herdado de SISGEP_AMBIENTE=' + amb
    : 'nenhuma propriedade declarada — vale produção';
}
function emissao_ativarProducao(tokenSessao) {   // trava o período de verdade
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — ativar produção', true);
  PropertiesService.getScriptProperties().setProperty('EVENTO_MODO_TESTE', 'false');
  Logger.log('🚦 PRODUÇÃO ativada — período 21/09–11/11 será exigido.');
}
function emissao_ativarTeste(tokenSessao) {      // libera emissão fora do período (ensaios)
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — ativar modo teste', true);
  PropertiesService.getScriptProperties().setProperty('EVENTO_MODO_TESTE', 'true');
  Logger.log('🧪 MODO TESTE ativado — período ignorado.');
}

// ================= CONTADOR (vagas + número) =================
function emissao_lerContador_() {
  var c = fs_get_('contadores', EMISSAO_CFG.EVENTO_ID);
  if (!c) {
    c = { limite: EMISSAO_CFG.LIMITE_VAGAS, vagasUsadas: 0, ultimoNumero: 0 };
    fs_set_('contadores', EMISSAO_CFG.EVENTO_ID, c);
  }
  return c;
}

function emissao_status(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — status da emissão', false);
  var c = emissao_lerContador_();
  var st = {
    limite: c.limite,
    usadas: c.vagasUsadas,
    restantes: c.limite - c.vagasUsadas,
    ultimoNumero: c.ultimoNumero,
    modoTeste: emissao_modoTeste_()
  };
  Logger.log(JSON.stringify(st));
  return st;
}

function emissao_formatarNumero_(n) {
  return EMISSAO_CFG.PREFIXO + String(n).padStart(6, '0');
}

// ================= EMISSÃO (núcleo atômico) =================
/* A trava estava só em painelEmissao_emitirGrupo, o chamador. Chamar esta
   função direto por google.script.run pulava a verificação inteira. */
function emissao_emitirIngresso(payload, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — emitir ingresso V1', false);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // --- validações básicas ---
    var cat = (payload.categoria || '').toLowerCase();
    if (['associado', 'convidado', 'acompanhante'].indexOf(cat) < 0)
      return { ok: false, erro: 'Categoria inválida.' };
    if (!payload.nome || !payload.nome.trim())
      return { ok: false, erro: 'Nome é obrigatório.' };

    // --- período (a menos que modo teste) ---
    if (!emissao_modoTeste_()) {
      var hoje = new Date();
      if (hoje < EMISSAO_CFG.PERIODO_INICIO)
        return { ok: false, erro: 'As inscrições ainda não abriram (começam em 21/09/2026).' };
      if (hoje > EMISSAO_CFG.PERIODO_FIM)
        return { ok: false, erro: 'O período de inscrições foi encerrado (11/11/2026).' };
    }

    // --- acompanhante: exige pagamento ---
    var valor = 0, pagForma = '', pagStatus = '';
    if (cat === 'acompanhante') {
      pagForma = payload.pagamentoForma || '';
      if (EMISSAO_CFG.FORMAS_PAGAMENTO.indexOf(pagForma) < 0)
        return { ok: false, erro: 'Escolha a forma de pagamento do acompanhante (Cartão, PicPay ou Depósito).' };
      valor = EMISSAO_CFG.VALOR_ACOMPANHANTE;
      pagStatus = 'PAGO'; // só chega aqui quando a Marcelha confirma o pagamento
    }

    // --- vagas ---
    var c = emissao_lerContador_();
    if (c.vagasUsadas >= c.limite)
      return { ok: false, erro: 'Vagas esgotadas (' + c.limite + '/' + c.limite + ').' };

    // --- reserva número + vaga (dentro do lock) ---
    var novoNumero = c.ultimoNumero + 1;
    var fcv = emissao_formatarNumero_(novoNumero);
    fs_set_('contadores', EMISSAO_CFG.EVENTO_ID, {
      limite: c.limite,
      vagasUsadas: c.vagasUsadas + 1,
      ultimoNumero: novoNumero
    });

    // --- monta e grava o ingresso ---
    var id = Utilities.getUuid();
    var ingresso = {
      numero: fcv,
      eventoId: EMISSAO_CFG.EVENTO_ID,
      nome: payload.nome.trim(),
      escola: (payload.escola || '').trim(),
      categoria: cat,
      cpf: (payload.cpf || '').trim(),
      email: (payload.email || '').trim(),
      whatsapp: (payload.whatsapp || '').trim(),
      matricula: (payload.matricula || '').trim(),
      titularNome: (payload.titularNome || '').trim(),
      titularCpf: (payload.titularCpf || '').trim(),
      status: 'EMITIDO',
      valor: valor,
      pagamentoForma: pagForma,
      pagamentoStatus: pagStatus,
      filiado: (payload.filiado || '').trim(),
      emitidoPor: (payload.operador || '').trim(),
      emitidoEm: new Date(),
      origem: 'painel'
    };

    try {
      fs_set_('ingressos', id, ingresso);
    } catch (e) {
      // desfaz a reserva se a gravação do ingresso falhar
      fs_set_('contadores', EMISSAO_CFG.EVENTO_ID, {
        limite: c.limite, vagasUsadas: c.vagasUsadas, ultimoNumero: c.ultimoNumero
      });
      return { ok: false, erro: 'Falha ao gravar o ingresso: ' + e.message };
    }

    // --- fecha o ciclo: QR Code, confirmação por e-mail e conciliação financeira ---
    // Nenhuma dessas 3 ações pode derrubar a emissão já confirmada — o ingresso
    // já está gravado e a vaga já foi reservada; falhas aqui só ficam no log.
    var qrCodeUrl = emissao_gerarQrCodeUrl_(fcv);
    var emailEnviado = false;
    try {
      emailEnviado = emissao_enviarConfirmacaoEmail_(ingresso, qrCodeUrl);
    } catch (eEmail) {
      Logger.log('[emissao] falha ao enviar confirmação por e-mail (' + fcv + '): ' + eEmail.message);
    }

    if (cat === 'acompanhante' && pagStatus === 'PAGO' && tokenSessao) {
      try {
        emissao_registrarReceitaAcompanhante_(ingresso, tokenSessao);
      } catch (eReceita) {
        Logger.log('[emissao] falha ao conciliar receita do acompanhante (' + fcv + '): ' + eReceita.message);
      }
    }

    return { ok: true, id: id, numero: fcv, categoria: cat, nome: ingresso.nome,
             escola: ingresso.escola, valor: valor, restantes: c.limite - (c.vagasUsadas + 1),
             qrCodeUrl: qrCodeUrl, emailEnviado: emailEnviado };
  } finally {
    lock.releaseLock();
  }
}

// ================= FECHAMENTO DO CICLO (Fase 4 da auditoria) =================

// QR Code do ingresso: mesmo padrão já usado em Carteirinhas/Voucher
// (quickchart.io). Encoda só o número do ingresso — a equipe na entrada
// escaneia com a câmera do celular e cola no check-in, sem depender de
// nenhuma rota pública que confirme entrada sozinha.
function emissao_gerarQrCodeUrl_(numero) {
  return 'https://quickchart.io/qr?size=200&text=' + encodeURIComponent(String(numero || ''));
}

// E-mail de confirmação com o ingresso, pela Central de E-mails (EmailCore.gs)
// — antes disso, nenhum artefato era entregue ao titular/convidado.
function emissao_enviarConfirmacaoEmail_(ingresso, qrCodeUrl) {
  if (!ingresso.email) return false;

  var linhas = [
    '<p>Seu ingresso para a <b>Festa Compasso da Vida 2026</b> foi emitido com sucesso!</p>',
    '<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;">',
    '<tr><td style="padding:4px 0;color:#6b7385;">Nome</td><td style="padding:4px 0;font-weight:bold;">' + ingresso.nome + '</td></tr>',
    '<tr><td style="padding:4px 0;color:#6b7385;">Categoria</td><td style="padding:4px 0;font-weight:bold;">' + ingresso.categoria + '</td></tr>',
    ingresso.escola ? '<tr><td style="padding:4px 0;color:#6b7385;">Escola</td><td style="padding:4px 0;">' + ingresso.escola + '</td></tr>' : '',
    ingresso.valor ? '<tr><td style="padding:4px 0;color:#6b7385;">Valor</td><td style="padding:4px 0;">R$ ' + ingresso.valor.toFixed(2).replace('.', ',') + ' (' + ingresso.pagamentoForma + ')</td></tr>' : '',
    '</table>',
    '<p>Apresente o QR Code abaixo na entrada do evento:</p>',
    '<div style="text-align:center;margin:18px 0;">',
    '<img src="' + qrCodeUrl + '" alt="QR Code do ingresso ' + ingresso.numero + '" style="width:180px;height:180px;border:1px solid #e2e8f0;border-radius:10px;padding:6px;background:#fff;">',
    '</div>'
  ].join('');

  var destaque =
    '<div style="text-align:center;background:#f4f6fa;border-radius:10px;padding:14px;margin-top:14px;">' +
    '<div style="font-size:11px;color:#6b7385;text-transform:uppercase;letter-spacing:.05em;">Número do ingresso</div>' +
    '<div style="font-size:22px;font-weight:900;color:#002f6c;letter-spacing:.02em;">' + ingresso.numero + '</div>' +
    '</div>';

  var htmlBody = sind_emailHtml_('🎟️ Ingresso confirmado — Festa Compasso da Vida 2026', linhas, destaque);
  var corpoTexto = 'Seu ingresso ' + ingresso.numero + ' para a Festa Compasso da Vida 2026 foi emitido com sucesso. ' +
    'Apresente este número na entrada do evento.';

  var resultado = enviarEmailSISGEP_(ingresso.email, 'Seu ingresso — Festa Compasso da Vida 2026', corpoTexto, {
    htmlBody: htmlBody,
    origem: 'Eventos'
  });

  return !!(resultado && resultado.ok);
}

// Conciliação financeira: pagamento do acompanhante deixa de ser só a
// palavra do operador e passa a virar uma receita real no Financeiro.
function emissao_registrarReceitaAcompanhante_(ingresso, tokenSessao) {
  return cadastrarReceita({
    tipo: 'Evento',
    categoria: 'Ingresso Evento',
    descricao: 'Ingresso acompanhante — Festa Compasso da Vida 2026 — ' + ingresso.nome +
      (ingresso.titularNome ? ' (titular: ' + ingresso.titularNome + ')' : ''),
    valor: ingresso.valor,
    formaRecebimento: ingresso.pagamentoForma,
    status: 'RECEBIDO',
    observacoes: 'Ingresso ' + ingresso.numero + '. Conciliado automaticamente na emissão (Fase 4 — Eventos).'
  }, tokenSessao);
}

// ================= CANCELAMENTO (libera a vaga, número não volta) =================
/* ADMIN: devolve vaga ao contador. */
function emissao_cancelarIngresso(id, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — cancelar ingresso V1', true);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ing = fs_get_('ingressos', id);
    if (!ing) return { ok: false, erro: 'Ingresso não encontrado.' };
    if (ing.status === 'CANCELADO') return { ok: false, erro: 'Ingresso já estava cancelado.' };
    var jaUsou = ing.status === 'UTILIZADO';

    ing.status = 'CANCELADO';
    ing.canceladoEm = new Date();
    fs_set_('ingressos', id, ing);

    // devolve a vaga (a menos que a pessoa já tenha entrado)
    if (!jaUsou) {
      var c = emissao_lerContador_();
      fs_set_('contadores', EMISSAO_CFG.EVENTO_ID, {
        limite: c.limite,
        vagasUsadas: Math.max(0, c.vagasUsadas - 1),
        ultimoNumero: c.ultimoNumero
      });
    }
    return { ok: true, id: id, avisoJaEntrou: jaUsou };
  } finally {
    lock.releaseLock();
  }
}

// ================= BUSCA DE ASSOCIADO (autocomplete p/ a Marcelha) =================
/* Lê a base de associados — nome, CPF, celular e e-mail de 8.000 pessoas. */
function emissao_buscarAssociado(termo, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — buscar associado', false);
  termo = (termo || '').trim().toLowerCase();
  if (termo.length < 2) return [];
  var ss = SpreadsheetApp.openById(getPlanilhaId());
  var aba = ss.getSheetByName(EMISSAO_CFG.ABA_ASSOCIADOS);
  var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 16).getValues();
  var out = [];
  for (var i = 0; i < dados.length && out.length < 15; i++) {
    var linha = dados[i];
    var nome = String(linha[1] || '');       // col 2 Nome
    var cpf  = String(linha[2] || '');        // col 3 CPF
    if (nome.toLowerCase().indexOf(termo) >= 0 || cpf.replace(/\D/g, '').indexOf(termo.replace(/\D/g, '')) >= 0) {
      out.push({
        nome: nome,
        cpf: cpf,
        escola: String(linha[0] || ''),       // col 1 Nome fantasia -> escola (sugestão)
        filiado: String(linha[3] || ''),      // col 4 Filiado (S/N)
        whatsapp: String(linha[9] || ''),      // col 10 Celular
        email: String(linha[11] || ''),        // col 12 E-mail
        matricula: String(linha[13] || '')     // col 14 MATRICULA
      });
    }
  }
  return out;
}

// ================= LIMPEZA DE TESTES =================
function emissao_fsDelete_(collection, docId) {
  var url = fs_baseUrl_() + '/' + collection + '/' + encodeURIComponent(docId);
  var resp = UrlFetchApp.fetch(url, {
    method: 'delete',
    headers: { Authorization: 'Bearer ' + fs_getAccessToken_() },
    muteHttpExceptions: true
  });
  return resp.getResponseCode() < 300;
}

// Zera o contador e apaga docs de teste conhecidos. Use com cuidado (só na fase de ensaio).
/* ADMIN + só homologação: esta função ZERA o contador de vagas do evento.
   Rodá-la em produção com ingressos emitidos faria o próximo número repetir
   um já entregue, e as 2.000 vagas voltariam ao início. */
function emissao_limparTestes(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — limpar testes', true);
  compasso_assertHomologacao_();
  ['ponte-teste'].forEach(function(id){ emissao_fsDelete_('ingressos', id); });
  fs_set_('contadores', EMISSAO_CFG.EVENTO_ID, { limite: EMISSAO_CFG.LIMITE_VAGAS, vagasUsadas: 0, ultimoNumero: 0 });
  Logger.log('🧹 Testes limpos e contador zerado.');
}

// ================= TESTES RÁPIDOS =================
function testeEmissao_associado(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — teste de emissão (associado)', true);
  var r = emissao_emitirIngresso({
    categoria: 'associado',
    nome: 'Associado de Teste',
    escola: 'Escola Exemplo',
    cpf: '000.000.000-00',
    email: 'teste@exemplo.com',
    whatsapp: '27999999999',
    filiado: 'S',
    operador: 'Marcelha (teste)'
  }, tokenSessao);
  Logger.log(JSON.stringify(r, null, 2));
}

function testeEmissao_acompanhanteSemPagamento(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — teste de acompanhante', true);
  var r = emissao_emitirIngresso({ categoria: 'acompanhante', nome: 'Acompanhante Sem Pgto' }, tokenSessao);
  Logger.log(JSON.stringify(r, null, 2)); // deve dar erro pedindo forma de pagamento
}