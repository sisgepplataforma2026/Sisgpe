// ============================================================================
// ARQUIVO: EnvioPorUsuario.gs
// ENVIO EM NOME DE QUEM ESTÁ LOGADO — pedido do usuário em 26/11/2026:
//   "se eu entrei na conta da Marcela, ofícios, certificados e declarações têm que sair em nome da secretaria;
//    se o logado é o financeiro, é a parte financeira; as demais são com a Marcela."
//
// POR QUE ESTE ARQUIVO É SÓ CÓDIGO NOVO (REGRA Nº -3). Hoje todo e-mail de ofício, certificado, declaração e recibo sai pela conta do
// Financeiro (o script executa como ela), com "De: secretaria@" pelo alias — e por isso cai nos Itens enviados do Financeiro, mesmo com a
// Marcela logada (EmailOficios.gs, enviarComoRascunhoSISGEP_). Nada aqui altera aquele caminho: são duas funções novas, SEM chamador.
// Ligá-las exige editar função em uso (montarOpcoesEmailSISGEP_ e enviarComoRascunhoSISGEP_) e só acontece com o "sim" do usuário.
//
// COMO SAI "PELA SECRETARIA DE VERDADE": pelo leitor da Secretaria (App da Web que executa como a conta da Secretaria, o mesmo do
// "Novo e-mail" da Caixa), operação "novoEmail", que aceita anexos. Aí a mensagem nasce na conta da Secretaria e fica nos Itens enviados DELA.
// ============================================================================

/**
 * Quem deve ser o remetente para este usuário logado: 'FINANCEIRO' ou 'SECRETARIA'.
 * Reaproveita a regra que a Caixa de e-mails já usa (cxsMeuPapel_): financeiro@ (ou o nome do financeiro) → FINANCEIRO; secretaria@ → SECRETARIA.
 * Qualquer outro usuário, e sessão ausente, caem em SECRETARIA ("as demais são com a Marcela").
 */
function envioRemetentePorSessao_(sessao) {
  var papel = '';
  try { papel = cxsMeuPapel_(sessao); } catch (e) { papel = ''; }
  return papel === 'FINANCEIRO' ? 'FINANCEIRO' : 'SECRETARIA';
}

/** O leitor da Secretaria está configurado? (sem ele, o envio segue pelo caminho de hoje.) */
function envioViaSecretariaDisponivel_() {
  try { return !!cxgLigada_(); } catch (e) { return false; }
}

/**
 * Envia, em nome da Secretaria, o que `montarOpcoesEmailSISGEP_` montou (to, cc, bcc, subject, htmlBody, attachments).
 * Mesma trava de homologação da Caixa (só a equipe do SISGEP recebe). Lança erro se o leitor recusar: quem chamar decide o que fazer.
 */
function envioPelaSecretaria_(opcoes, corpoTexto) {
  opcoes = opcoes || {};
  var lista = function (v) {
    if (Array.isArray(v)) return v.map(function (x) { return String(x || '').trim(); }).filter(String);
    return String(v || '').split(/[;,]/).map(function (x) { return x.trim(); }).filter(String);
  };
  var para = lista(opcoes.to), cc = lista(opcoes.cc), cco = lista(opcoes.bcc);
  if (!para.length) throw new Error('Envio pela Secretaria: sem destinatário.');
  para.concat(cc).concat(cco).forEach(function (e) { vpeChecarDestinoAmbiente_(e); });
  var anexos = (opcoes.attachments || []).map(function (bl) {
    return { nome: bl.getName(), tipo: bl.getContentType(), b64: Utilities.base64Encode(bl.getBytes()) };
  });
  return cxgApi_('novoEmail', {
    para: para.join(', '), cc: cc.join(','), cco: cco.join(','),
    assunto: String(opcoes.subject || ''), texto: String(corpoTexto || 'Segue documento em anexo.'),
    html: String(opcoes.htmlBody || ''), anexos: anexos, rascunhoId: '', soGuardar: false
  });
}
