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

/**
 * NOME DE GENTE SE ESCREVE COM MAIUSCULA SO NA PRIMEIRA LETRA — 15/09/2026.
 *
 * "Pode ajustar o nome, maiúscula somente na primeira letra, ajuste para
 *  ficar bom."
 *
 * A base vem de planilha e de formulário, onde quase tudo está em caixa alta.
 * MARCELHA ALINE PINTO GOMES em caixa alta não é só feio: ocupa mais espaço
 * do que a mesma frase em caixa mista — as maiúsculas são todas largas, e não
 * há letra baixa para o olho apoiar. Era isso que empurrava o nome para a
 * terceira linha e fazia ele encostar na caixa da escola.
 *
 * As partículas ficam minúsculas porque é assim que se escreve nome em
 * português: Maria DA Silva está errado, Maria da Silva está certo. Sem a
 * lista, a "correção" trocaria um erro por outro.
 *
 * O que NÃO se toca: siglas de duas ou três letras em caixa alta continuam
 * como estão — UVV é UVV, não Uvv. Escola tem muita sigla.
 */
var COMPASSO_PARTICULAS_NOME = ['da','de','di','do','das','dos','e','du','della'];

/* As siglas que aparecem em nome de escola no cadastro do sindicato. Lista, e
   não regra, porque nenhuma regra de forma separa UVV de VILA. */
var COMPASSO_SIGLAS_NOME = ['UVV','UFES','IFES','EMEF','EMEI','EEEF','EEEM',
  'CMEI','CEIM','ES','EJA','SESI','SENAI','SESC','APAE','CEEP','ETEC'];

function compasso_nomeProprio_(texto) {
  var t = String(texto == null ? '' : texto).trim();
  if (!t) return '';
  /* Nome já escrito em caixa mista se respeita: quem digitou "McDonald" ou
     "d'Ávila" sabia o que estava fazendo. Só se reescreve o que veio todo em
     caixa alta ou todo em minúscula, que é como sai de planilha e formulário. */
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) return t;

  return t.split(/(\s+)/).map(function (palavra, i) {
    if (/^\s+$/.test(palavra) || !palavra) return palavra;
    var baixa = palavra.toLowerCase();

    /* A ORDEM IMPORTA, e a primeira versão errou nela: a regra de sigla vinha
       antes e engolia as partículas — "DA" tem duas letras e está em caixa
       alta, então voltava como "DA". Partícula primeiro. */
    if (i > 0 && COMPASSO_PARTICULAS_NOME.indexOf(baixa) > -1) return baixa;

    /* SIGLA. Aqui a heurística não serve, e a primeira tentativa provou: eu
       usei "sem vogal" para separar sigla de palavra, e UVV começa com U.
       Não há regra de forma que distinga UVV de VILA — as duas têm quatro
       letras ou menos e as duas chegam em caixa alta.
       Então é LISTA, explícita e conferível, mais a regra de quem não tem
       vogal nenhuma (CNPJ, SMS), que essa sim é segura. Sigla que faltar aqui
       vira caixa mista, e o conserto é acrescentar uma palavra nesta linha. */
    if (COMPASSO_SIGLAS_NOME.indexOf(palavra) > -1) return palavra;
    if (palavra.length <= 4 && palavra === palavra.toUpperCase() &&
        /^[A-Z]+$/.test(palavra) && !/[AEIOU]/.test(palavra)) return palavra;

    /* Hífen e apóstrofo também começam palavra: Ana-Maria, D'Ávila. */
    return baixa.replace(/(^|[-'\u2019])([a-z\u00e0-\u00ff])/g, function (m, antes, letra) {
      return antes + letra.toUpperCase();
    });
  }).join('');
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
    nome: compasso_nomeProprio_(ing.nome),
    escola: compasso_nomeProprio_(ing.escola),
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
