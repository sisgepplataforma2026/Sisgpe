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
  ABA_ASSOCIADOS: 'Associados',
  PLANILHA_ID: '1QPpsx19v4YzfskoYXK9WB89TClA7q8SWGSn55VZ040E'
};

// Modo teste: ignora o período (pra ensaiar antes de 21/09). Guardado no cofre.
function emissao_modoTeste_() {
  return PropertiesService.getScriptProperties().getProperty('EVENTO_MODO_TESTE') !== 'false';
}
function emissao_ativarProducao() {   // trava o período de verdade
  PropertiesService.getScriptProperties().setProperty('EVENTO_MODO_TESTE', 'false');
  Logger.log('🚦 PRODUÇÃO ativada — período 21/09–11/11 será exigido.');
}
function emissao_ativarTeste() {      // libera emissão fora do período (ensaios)
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

function emissao_status() {
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
function emissao_emitirIngresso(payload) {
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

    return { ok: true, id: id, numero: fcv, categoria: cat, nome: ingresso.nome,
             escola: ingresso.escola, valor: valor, restantes: c.limite - (c.vagasUsadas + 1) };
  } finally {
    lock.releaseLock();
  }
}

// ================= CANCELAMENTO (libera a vaga, número não volta) =================
function emissao_cancelarIngresso(id) {
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
function emissao_buscarAssociado(termo) {
  termo = (termo || '').trim().toLowerCase();
  if (termo.length < 2) return [];
  var ss = SpreadsheetApp.openById(EMISSAO_CFG.PLANILHA_ID);
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
function emissao_limparTestes() {
  ['ponte-teste'].forEach(function(id){ emissao_fsDelete_('ingressos', id); });
  fs_set_('contadores', EMISSAO_CFG.EVENTO_ID, { limite: EMISSAO_CFG.LIMITE_VAGAS, vagasUsadas: 0, ultimoNumero: 0 });
  Logger.log('🧹 Testes limpos e contador zerado.');
}

// ================= TESTES RÁPIDOS =================
function testeEmissao_associado() {
  var r = emissao_emitirIngresso({
    categoria: 'associado',
    nome: 'Associado de Teste',
    escola: 'Escola Exemplo',
    cpf: '000.000.000-00',
    email: 'teste@exemplo.com',
    whatsapp: '27999999999',
    filiado: 'S',
    operador: 'Marcelha (teste)'
  });
  Logger.log(JSON.stringify(r, null, 2));
}

function testeEmissao_acompanhanteSemPagamento() {
  var r = emissao_emitirIngresso({ categoria: 'acompanhante', nome: 'Acompanhante Sem Pgto' });
  Logger.log(JSON.stringify(r, null, 2)); // deve dar erro pedindo forma de pagamento
}