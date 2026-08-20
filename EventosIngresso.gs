/**
 * COMPASSO 2026 — Motor do ingresso oficial.
 * Usa uma arte-base fixa e sobrepõe somente dados variáveis + QR seguro.
 * Configure COMPASSO_INGRESSO_ARTE_DRIVE_ID nas Script Properties com o arquivo oficial.
 */

function compasso_ingressoArteDataUri_() {
  var id = PropertiesService.getScriptProperties().getProperty('COMPASSO_INGRESSO_ARTE_DRIVE_ID');
  if (!id) return '';
  var blob = DriveApp.getFileById(id).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

function compasso_qrDataUri_(token) {
  var qr = Charts.newQrCode()
    .setData(String(token || ''))
    .setDimensions(360, 360)
    .build()
    .getBlob()
    .setName('qr-compasso.png');
  return 'data:image/png;base64,' + Utilities.base64Encode(qr.getBytes());
}

function compasso_categoriaLabel_(cat) {
  cat = String(cat || '').toLowerCase();
  if (cat === 'associado') return 'ASSOCIADO';
  if (cat === 'convidado') return 'CONVIDADO';
  if (cat === 'acompanhante') return 'ACOMPANHANTE';
  return String(cat || '').toUpperCase();
}

function compasso_ingressoDados(ingressoId) {
  ingressoId = String(ingressoId || '').trim();
  if (!ingressoId) throw new Error('ingressoId obrigatório.');
  var ing = fs_get_('ingressos', ingressoId);
  if (!ing || ing.eventoId !== EMISSAO_CFG.EVENTO_ID) throw new Error('Ingresso não encontrado para o Compasso 2026.');
  if (ing.status === 'CANCELADO') throw new Error('Ingresso cancelado não pode ser apresentado ou reenviado.');

  var qrToken = compasso_gerarQrToken_(ingressoId);
  return {
    ingressoId: ingressoId,
    numero: ing.numero || '',
    nome: ing.nome || '',
    escola: ing.escola || '',
    categoria: compasso_categoriaLabel_(ing.categoria),
    status: ing.status || '',
    email: ing.email || '',
    whatsapp: ing.whatsapp || '',
    qrToken: qrToken,
    qrDataUri: compasso_qrDataUri_(qrToken),
    arteDataUri: compasso_ingressoArteDataUri_(),
    modoTeste: emissao_modoTeste_()
  };
}

function compasso_ingressoRenderHtml(ingressoId) {
  var t = HtmlService.createTemplateFromFile('EventosIngressoTemplate');
  t.dados = compasso_ingressoDados(ingressoId);
  return t.evaluate().setTitle('Ingresso — Compasso da Vida 2026').getContent();
}

function compasso_abrirIngresso(ingressoId) {
  var t = HtmlService.createTemplateFromFile('EventosIngressoTemplate');
  t.dados = compasso_ingressoDados(ingressoId);
  return t.evaluate()
    .setTitle('Ingresso — Compasso da Vida 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function compasso_prepararReenvioIngresso(ingressoId) {
  var d = compasso_ingressoDados(ingressoId);
  compasso_auditar_('PREPARAR_REENVIO_INGRESSO', 'ingresso', ingressoId, {
    numero: d.numero,
    email: d.email ? 'PRESENTE' : 'AUSENTE',
    whatsapp: d.whatsapp ? 'PRESENTE' : 'AUSENTE'
  });
  return {
    ingressoId: d.ingressoId,
    numero: d.numero,
    nome: d.nome,
    email: d.email,
    whatsapp: d.whatsapp,
    html: compasso_ingressoRenderHtml(ingressoId)
  };
}

function compasso_testarIngressoPorInscricao(inscricaoId) {
  if (!emissao_modoTeste_()) throw new Error('Teste de ingresso permitido somente em homologação.');
  var ins = fs_get_('inscricoesEventos', String(inscricaoId || '').trim());
  if (!ins || !ins.ingressoId) throw new Error('Inscrição sem ingresso emitido.');
  return compasso_abrirIngresso(ins.ingressoId);
}
