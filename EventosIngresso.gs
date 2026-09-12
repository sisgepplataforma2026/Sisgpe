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

/* ADMIN: troca a arte oficial que sai em TODO ingresso do evento. */
function compasso_configurarArteBaseDrive(fileIdOuUrl, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — configurar arte do ingresso', true);
  var fileId = compasso_extrairDriveFileId_(fileIdOuUrl);
  if (!fileId) throw new Error('Informe o ID ou link válido do arquivo da arte oficial no Google Drive.');
  var f = DriveApp.getFileById(fileId);
  var tipo = String(f.getMimeType() || '');
  if (tipo.indexOf('image/') !== 0) throw new Error('A arte-base precisa ser um arquivo de imagem.');
  PropertiesService.getScriptProperties().setProperty('COMPASSO_INGRESSO_ARTE_DRIVE_ID', fileId);
  compasso_auditar_('CONFIGURAR_ARTE_INGRESSO','evento',EMISSAO_CFG.EVENTO_ID,{arquivoId:fileId,nome:f.getName(),mimeType:tipo});
  return {ok:true,fileId:fileId,nome:f.getName(),mimeType:tipo};
}

function compasso_statusArteBase(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — status da arte', false);
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

/* Devolve o qrToken do ingresso: mesma sensibilidade de
   compasso_regenerarQrToken, mas aqui é o caminho normal de apresentar o
   ingresso ao titular, então basta acesso ao módulo. */
function compasso_ingressoDados(ingressoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — dados do ingresso', false);
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

function compasso_ingressoRenderHtml(ingressoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — renderizar ingresso', false);
  var t = HtmlService.createTemplateFromFile('EventosIngressoTemplate');
  t.dados = compasso_ingressoDados(ingressoId, tokenSessao);
  return t.evaluate().setTitle('Ingresso — Compasso da Vida 2026').getContent();
}

function compasso_abrirIngresso(ingressoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — abrir ingresso', false);
  var t = HtmlService.createTemplateFromFile('EventosIngressoTemplate');
  t.dados = compasso_ingressoDados(ingressoId, tokenSessao);
  return t.evaluate()
    .setTitle('Ingresso — Compasso da Vida 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function compasso_prepararReenvioIngresso(ingressoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — preparar reenvio', false);
  var d = compasso_ingressoDados(ingressoId, tokenSessao);
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
    html: compasso_ingressoRenderHtml(ingressoId, tokenSessao)
  };
}

function compasso_testarIngressoPorInscricao(inscricaoId, tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — teste de ingresso', true);
  if (!emissao_modoTeste_()) throw new Error('Teste de ingresso permitido somente em homologação.');
  var ins = fs_get_('inscricoesEventos', String(inscricaoId || '').trim());
  if (!ins || !ins.ingressoId) throw new Error('Inscrição sem ingresso emitido.');
  return compasso_abrirIngresso(ins.ingressoId, tokenSessao);
}

/**
 * Teste ponta a ponta de homologação:
 * inscrição -> validação -> emissão -> dados do ingresso.
 * Usa CPF/pessoaId únicos por execução para não conflitar com testes anteriores.
 */
function compasso_testePontaAPontaIngresso(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, 'eventos', 'Compasso — teste ponta a ponta', true);
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
  }, tokenSessao);
  if (!inscricao.ok) return {etapa:'INSCRICAO',ok:false,resultado:inscricao};

  var validacao = compasso_validarDecisaoAdmin(inscricao.inscricaoId, COMPASSO_STATUS.VALIDADA, '', 'Teste automatizado de homologação', tokenSessao);
  if (!validacao.ok) return {etapa:'VALIDACAO',ok:false,resultado:validacao};

  var emissao = compasso_emitirIngressoV2({inscricaoId: inscricao.inscricaoId}, tokenSessao);
  if (!emissao.ok) return {etapa:'EMISSAO',ok:false,resultado:emissao,inscricaoId:inscricao.inscricaoId};

  var dados = compasso_ingressoDados(emissao.id, tokenSessao);
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
    arteConfigurada:compasso_statusArteBase(tokenSessao).configurada,
    arteDriveId:compasso_arteDriveId_()
  };
}
