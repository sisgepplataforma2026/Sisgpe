/**
 * COMPASSO 2026 — Motor do ingresso oficial.
 * A arte-base oficial é armazenada no Drive e o template apenas sobrepõe
 * nome, escola, categoria, número e QR seguro.
 */

var COMPASSO_INGRESSO_ARTE_DRIVE_ID_PADRAO = '1I42k_AkP6MGLNVhaDKJB7hVEDn7JRJzJ';

function compasso_extrairDriveFileId_(valor) {
  valor = String(valor || '').trim();
  if (!valor) return '';
  if (/^[A-Za-z0-9_-]{20,}$/.test(valor)) return valor;
  var m = valor.match(/\/d\/([A-Za-z0-9_-]{20,})/) || valor.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : '';
}

function compasso_arteDriveId_() {
  return PropertiesService.getScriptProperties().getProperty('COMPASSO_INGRESSO_ARTE_DRIVE_ID') || COMPASSO_INGRESSO_ARTE_DRIVE_ID_PADRAO;
}

function compasso_configurarArteBaseDrive(fileIdOuUrl) {
  var fileId = compasso_extrairDriveFileId_(fileIdOuUrl);
  if (!fileId) throw new Error('Informe o ID ou link válido do arquivo da arte oficial no Google Drive.');
  var f = DriveApp.getFileById(fileId);
  var tipo = String(f.getMimeType() || '');
  if (tipo.indexOf('image/') !== 0) throw new Error('A arte-base precisa ser um arquivo de imagem.');
  PropertiesService.getScriptProperties().setProperty('COMPASSO_INGRESSO_ARTE_DRIVE_ID', fileId);
  compasso_auditar_('CONFIGURAR_ARTE_INGRESSO','evento',EMISSAO_CFG.EVENTO_ID,{arquivoId:fileId,nome:f.getName(),mimeType:tipo});
  return {ok:true,fileId:fileId,nome:f.getName(),mimeType:tipo};
}

function compasso_statusArteBase() {
  var id = compasso_arteDriveId_();
  if (!id) return {configurada:false};
  try {
    var f = DriveApp.getFileById(id);
    return {configurada:true,fileId:id,nome:f.getName(),mimeType:f.getMimeType(),origem:id===COMPASSO_INGRESSO_ARTE_DRIVE_ID_PADRAO?'PADRAO_SISGEP':'CONFIGURADA'};
  } catch(e) {
    return {configurada:false,fileId:id,erro:e.message};
  }
}

function compasso_ingressoArteDataUri_() {
  var id = compasso_arteDriveId_();
  if (!id) {
    if (!emissao_modoTeste_()) throw new Error('Arte oficial do ingresso não configurada. Emissão visual bloqueada em produção.');
    return '';
  }
  var blob = DriveApp.getFileById(id).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
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

  return {
    ingressoId: ingressoId,
    numero: ing.numero || '',
    nome: ing.nome || '',
    escola: ing.escola || '',
    categoria: compasso_categoriaLabel_(ing.categoria),
    status: ing.status || '',
    email: ing.email || '',
    whatsapp: ing.whatsapp || '',
    qrToken: compasso_gerarQrToken_(ingressoId),
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

/**
 * Teste ponta a ponta de homologação:
 * inscrição -> validação -> emissão -> dados do ingresso.
 * Usa CPF/pessoaId únicos por execução para não conflitar com testes anteriores.
 */
function compasso_testePontaAPontaIngresso() {
  if (!emissao_modoTeste_()) throw new Error('Teste ponta a ponta permitido somente em homologação.');
  var sufixo = String(new Date().getTime());
  var pessoaId = 'HML-PESSOA-' + sufixo;
  var cpf = ('00000000000' + sufixo.slice(-11)).slice(-11);

  var inscricao = compasso_criarInscricaoAssociado({
    pessoaId: pessoaId,
    nome: 'TESTE HOMOLOGACAO COMPASSO',
    cpf: cpf,
    escola: 'ESCOLA TESTE HOMOLOGACAO',
    cidade: 'VITORIA',
    regiao: 'METROPOLITANA',
    email: 'teste.homologacao@example.com',
    whatsapp: '27999999999',
    origem: 'HOMOLOGACAO'
  });
  if (!inscricao.ok) return {etapa:'INSCRICAO',ok:false,resultado:inscricao};

  var validacao = compasso_validarDecisaoAdmin(inscricao.inscricaoId, COMPASSO_STATUS.VALIDADA, '', 'Teste automatizado de homologação');
  if (!validacao.ok) return {etapa:'VALIDACAO',ok:false,resultado:validacao};

  var emissao = compasso_emitirIngressoV2({inscricaoId: inscricao.inscricaoId});
  if (!emissao.ok) return {etapa:'EMISSAO',ok:false,resultado:emissao,inscricaoId:inscricao.inscricaoId};

  var dados = compasso_ingressoDados(emissao.id);
  compasso_auditar_('TESTE_PONTA_A_PONTA_INGRESSO','ingresso',emissao.id,{inscricaoId:inscricao.inscricaoId,numero:emissao.numero});
  return {
    ok:true,
    inscricaoId:inscricao.inscricaoId,
    ingressoId:emissao.id,
    numero:emissao.numero,
    nome:dados.nome,
    escola:dados.escola,
    categoria:dados.categoria,
    qrGerado:!!dados.qrToken,
    arteConfigurada:compasso_statusArteBase().configurada,
    arteDriveId:compasso_arteDriveId_()
  };
}
