// =============================================================================
// ARQUIVO: Voucher.gs
// Núcleo do módulo de Bolsas/Voucher
// Mantém helpers, setup, regras, escolas, documentos, listagens e dashboard
// =============================================================================

/* ================= CONFIG ================= */
const PASTA_VOUCHER_DOCUMENTOS_ID = "1PyMA0bm0FZuyYONlY4dNNo3pgJRiI63n";

/* A LOGO É LIDA DO DRIVE E EMBUTIDA EM base64 — não é buscada por URL.
 *
 * O endereço abaixo continua aqui só como registro de qual arquivo é. Quem
 * monta o documento chama `logoSindicatoVoucher_()` (VoucherPdf.gs), que faz
 * o mesmo que já se faz com a assinatura do presidente.
 *
 * POR QUÊ: `getAs(MimeType.PDF)` renderiza o HTML num processo do Google que
 * não carrega imagem por URL externa de forma confiável — às vezes vem, às
 * vezes o PDF sai com o quadrado vazio no lugar do brasão, e não há erro
 * nenhum no log. Foi por isso que a assinatura virou base64 em 12/08/2026; a
 * logo tinha o mesmo risco e ficou de fora naquele dia.
 *
 * O sintoma é traiçoeiro: na prévia, que é HTML no navegador, a imagem
 * aparece — o navegador busca a URL sem problema. Só no PDF é que some. Ou
 * seja, conferir pela prévia não prova nada sobre a logo. */
const LOGO_VOUCHER_FILE_ID = "1c-RHfb0W-wl_ZK1xlMjNRs9DS4ep2ov7";
const LOGO_VOUCHER        = "https://lh3.googleusercontent.com/d/1c-RHfb0W-wl_ZK1xlMjNRs9DS4ep2ov7";
const PRESIDENTE_VOUCHER  = "Leonil Dias da Silva";
const CARGO_PRESIDENTE_V  = "Presidente Sindeducação-ES";
const ENDERECO_SIND_V     = "AV. NOSSA SENHORA DOS NAVEGANTES, 755, ED PALÁCIO DA PRAIA S 707, ENSEADA DO SUÁ, VITÓRIA, ES";
const TELEFONE_SIND_V     = "Tel.: 27 3222-2706 / 27 3223-8866";
const SITE_SIND_V         = "www.sindeducacao.com · secretaria@sindeducacao.com";
const CCT_TEXTO_V         = "Convenção Coletiva de Trabalho 2026/2027";
const CCT_CLAUSULA_V      = "Cláusula 5ª, § 4º";

/* Assinatura do presidente, em imagem.
 *
 * MESMO ARQUIVO já usado pelo ofício de documentação fiscal
 * (Despesas_Oficio_Fiscal.gs:133), onde o id está escrito direto no meio da
 * função. Aqui ele vira constante nomeada. Os dois pontos deveriam usar uma
 * função só — fica registrado como consolidação a fazer em commit separado,
 * porque mexer no ofício fiscal para acrescentar assinatura ao voucher é
 * misturar duas coisas. */
const ASSINATURA_FILE_ID_V = "1hktAmOL6c9XjU8ckAyJ3Y4cn39ILpsoe";

/* ================= HELPERS GERAIS ================= */

function normalizarCPF_(cpf) {
  return String(cpf || "").replace(/\D/g, "");
}

/**
 * CPF formatado, devolvendo o zero à esquerda que a planilha comeu.
 *
 * O CASO REAL (12/08/2026): o certificado saiu com "8538104780" cru, dez
 * dígitos. Não era CPF errado no cadastro — era a planilha guardando a
 * coluna como NÚMERO, e número não tem zero à esquerda. O CPF verdadeiro
 * começa com 0, e o Sheets o descartou na gravação.
 *
 * A versão anterior desistia (`if (d.length !== 11) return cpf`) e imprimia
 * o número cru no documento oficial. Silenciosa e feia: quem lê o
 * certificado vê um CPF que não existe.
 *
 * COMO SE COMPLETA SEM CHUTAR
 *
 * Zeros só somem da ESQUERDA, e só na quantidade que falta para 11. Então a
 * reconstrução é determinística: 10 dígitos = faltou um zero, 9 = faltaram
 * dois. Mas completar não basta — é preciso PROVAR que o resultado é um CPF
 * de verdade, e para isso existe o dígito verificador. `cpfValido`
 * (Utils.gs:269) confere os dois dígitos.
 *
 * Se o CPF completado não passar na conferência, o número não era um CPF com
 * zero perdido — era outra coisa. Aí devolve como veio, sem inventar. Um
 * documento com o dado cru é ruim; um documento com um CPF fabricado que
 * pertence a outra pessoa é muito pior.
 */
function formatarCpfVoucher_(cpf) {
  var d = normalizarCPF_(cpf);

  if (d.length > 0 && d.length < 11 && d.length >= 9) {
    var completo = ("00" + d).slice(-11);
    var passa = true;
    try { passa = (typeof cpfValido === "function") ? cpfValido(completo) : true; } catch (e) {}
    if (passa) {
      Logger.log("CPF recuperado: a planilha guardou " + d.length +
                 " dígitos (zero à esquerda perdido por estar como número).");
      d = completo;
    }
  }

  if (d.length !== 11) return String(cpf || "");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function normalizarTextoVoucher_(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function calcularIdade_(dataNascimento) {
  if (!dataNascimento) return "";

  const data = new Date(dataNascimento);
  if (isNaN(data.getTime())) return "";

  const hoje = new Date();
  let idade = hoje.getFullYear() - data.getFullYear();
  const mes = hoje.getMonth() - data.getMonth();

  if (mes < 0 || (mes === 0 && hoje.getDate() < data.getDate())) {
    idade--;
  }

  return idade;
}

function gerarIdPadrao_(prefixo) {
  const data = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss");
  const aleatorio = Math.floor(Math.random() * 900 + 100);
  return prefixo + "_" + data + "_" + aleatorio;
}

function gerarNumeroProtocolo_() {
  const ano = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
  const aleatorio = Math.floor(Math.random() * 900000 + 100000);
  return "BOLSA-" + ano + "-" + aleatorio;
}

function gerarCodigoValidacaoVoucher_() {
  return "VAL-" +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss") +
    "-" +
    Math.floor(Math.random() * 9000 + 1000);
}

function formatDateInput_(valor) {
  if (!valor) return "";

  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  const txt = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
    const p = txt.split("/");
    return p[2] + "-" + p[1] + "-" + p[0];
  }

  const data = new Date(txt);
  if (isNaN(data.getTime())) return "";

  return Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function formatarDataBrVoucher_(data) {
  if (!data) return "";

  const dt = Object.prototype.toString.call(data) === "[object Date]" ? data : new Date(data);
  if (isNaN(dt.getTime())) return "";

  return Utilities.formatDate(dt, Session.getScriptTimeZone(), "dd/MM/yyyy");
}

function formatarDataHoraBrVoucher_(data) {
  if (!data) return "";

  const dt = Object.prototype.toString.call(data) === "[object Date]" ? data : new Date(data);
  if (isNaN(dt.getTime())) return "";

  return Utilities.formatDate(dt, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
}

function timestampSeguroVoucher_(valor) {
  if (!valor) return 0;

  if (Object.prototype.toString.call(valor) === "[object Date]") {
    return isNaN(valor.getTime()) ? 0 : valor.getTime();
  }

  const dt = new Date(valor);
  return isNaN(dt.getTime()) ? 0 : dt.getTime();
}

function valorSeguroVoucher_(valor) {
  return String(valor || "").trim();
}

function inferirTipoDocumentoVinculo_(payload) {
  const informado = String(payload && payload.tipoDocumentoVinculo || "").trim().toUpperCase();

  if (informado) return informado;
  if (payload && payload.contracheque && payload.contracheque.base64) return "CONTRACHEQUE";

  return "DECLARACAO_RH";
}

function sanitizarNomeArquivoVoucher_(nome) {
  return String(nome || "arquivo")
    .replace(/[\\\/:*?"<>|#%{}~]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function obterUsuarioAtualVoucher_() {
  try {
    if (typeof getSessaoUsuario === "function") {
      const sessao = getSessaoUsuario();
      if (sessao && (sessao.nome || sessao.usuario)) {
        return sessao.nome || sessao.usuario;
      }
    }
  } catch(e) {}

  try {
    return Session.getActiveUser().getEmail() || "SISTEMA";
  } catch(e) {
    return "SISTEMA";
  }
}

function percentualPorExtensoVoucher_(n) {
  const mapa = {
    100: "cem por cento",
    90: "noventa por cento",
    80: "oitenta por cento",
    70: "setenta por cento",
    60: "sessenta por cento",
    50: "cinquenta por cento",
    40: "quarenta por cento",
    30: "trinta por cento"
  };

  return mapa[n] || n + " por cento";
}

function dataExtensoVoucher_(data) {
  if (!data) data = new Date();

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const dt = data instanceof Date ? data : new Date(data);

  return "Vitória/ES, " +
    String(dt.getDate()).padStart(2, "0") +
    " de " +
    meses[dt.getMonth()] +
    " de " +
    dt.getFullYear() +
    ".";
}

function escHtmlVoucher_(t) {
  return String(t || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

/* ================= HELPERS SHEETS ================= */

function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

/**
 * Garante que a aba tenha todas as colunas da lista canônica.
 *
 * ⚠ ESTA FUNÇÃO JÁ DESTRUIU CABEÇALHO DE PLANILHA COM DADO REAL (12/08/2026).
 *
 * A versão anterior fazia isto:
 *
 *     headers.forEach(function (header, idx) {
 *       if (existingHeaders.indexOf(header) === -1) {
 *         sheet.getRange(1, idx + 1).setValue(header);   // ← posição CANÔNICA
 *       }
 *     });
 *
 * Ou seja: achou um nome faltando, escreveu ele na posição que ele ocupa na
 * LISTA — por cima do nome que já estava naquela coluna. O dado embaixo não
 * se mexe. Resultado: três colunas perdem o nome e passam a ser lidas com o
 * rótulo errado, e `mapRowToObject_` devolve o valor de uma coluna sob o nome
 * de outra. Foi assim que a data de nascimento de um beneficiário apareceu no
 * certificado como "Instituição de ensino", e a idade (11) como "CNPJ".
 *
 * E PIORAVA A CADA EXECUÇÃO. Os três nomes atropelados sumiam da aba, então
 * na rodada seguinte eles é que estavam "faltando" — e eram reescritos nas
 * posições canônicas deles, atropelando outros três. Medido no emulador:
 * rodada 1 perde 3 nomes, rodada 2 perde outros 3, e na 3ª estabiliza com a
 * linha de cabeçalho inteira deslocada em relação ao dado. Como
 * setupVoucherModuleFase1() é chamada de nove lugares, vários deles em
 * caminho de LEITURA (VoucherPdf.gs:8, Voucher.gs:981...), bastava abrir a
 * prévia para rodar mais uma volta.
 *
 * A REGRA AGORA: em aba que já tem cabeçalho, coluna nova entra SEMPRE NO
 * FIM. A ordem da lista canônica é a ordem desejada para uma aba nova — nunca
 * uma instrução para reposicionar coluna de aba existente. Todo o sistema lê
 * por NOME (mapRowToObject_/obterHeaders_), então a posição não importa; o
 * que importa é que nome e dado continuem na mesma coluna.
 *
 * Reordenar coluna de aba com dado é operação de migração: move o dado junto,
 * com backup antes, em função própria e com pedido explícito. Não é algo que
 * um "ensure" faz de passagem.
 */
function ensureHeaders_(sheet, headers) {
  const currentLastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, currentLastCol).getValues()[0];
  const hasContent = existing.some(function(v) {
    return String(v).trim() !== "";
  });

  // Aba nova ou sem cabeçalho: aí sim vale a ordem canônica inteira.
  if (!hasContent) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const existingHeaders = existing.map(function(v) {
    return String(v).trim();
  });

  const faltando = headers.filter(function(h) {
    return existingHeaders.indexOf(h) === -1;
  });
  if (!faltando.length) return;

  // No fim, na ordem em que aparecem na lista canônica. Nenhuma coluna
  // existente é tocada — o dado de ninguém muda de rótulo.
  sheet.getRange(1, currentLastCol + 1, 1, faltando.length).setValues([faltando]);

  Logger.log("ensureHeaders_ — " + sheet.getName() + ": " + faltando.length +
             " coluna(s) acrescentada(s) NO FIM: " + faltando.join(", "));
}

function formatHeader_(sheet, numCols) {
  sheet.getRange(1, 1, 1, numCols)
    .setFontWeight("bold")
    .setBackground("#d9eaf7")
    .setHorizontalAlignment("center");
}

function autoResizeSafe_(sheet, numCols) {
  for (let i = 1; i <= numCols; i++) {
    try {
      sheet.autoResizeColumn(i);
    } catch(e) {}
  }
}

function obterHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function mapRowToObject_(headers, row) {
  const obj = {};

  headers.forEach(function(h, i) {
    obj[h] = row[i];
  });

  return obj;
}

/* ================= SETUP ================= */

/**
 * A lista canônica de colunas de Voucher_Solicitacoes, em UM lugar só.
 *
 * Estava inline dentro de setupVoucherModuleFase1, e o diagnóstico precisava
 * da mesma lista para dizer o que está faltando na aba. Duas cópias de uma
 * lista de 40 nomes divergem — e a que ia divergir era justamente a que
 * responde "a planilha está certa?".
 */
function VOUCHER_COLUNAS_SOLICITACOES_() {
  return [
        "ID_SOLICITACAO",
        "DATA_SOLICITACAO",
        "DATA_SOLICITACAO_TEXTO",
        "CPF_SOLICITANTE",
        "NOME_SOLICITANTE",
        "EMAIL",
        "TELEFONE",
        "ESCOLA_SELECIONADA",
        "UNIDADE_ESCOLA",
        "CNPJ_ESCOLA",
        "CIDADE_ESCOLA",
        /* O NOME FANTASIA, ao lado da razão social que já estava em
         * ESCOLA_SELECIONADA. O certificado real precisa dos dois na mesma
         * frase — "instituição MULTIVIX – VITÓRIA, mantida pela Empresa
         * Brasileira de Ensino... EMBRAE" — e com um campo só a frase perdia
         * metade. Os dois já existem no cadastro de Escolas; o que faltava
         * era a solicitação guardar o par. */
        "ESCOLA_FANTASIA",
        /* A INSTITUIÇÃO DE ENSINO É OUTRA EMPRESA.
         *
         * ESCOLA_SELECIONADA é onde o associado TRABALHA; estas duas são onde
         * ele ESTUDA. No documento em uso desde sempre elas aparecem
         * separadas — "empregado(a) da empresa MULTIVIX" e "junto à empresa
         * educacional IESES, CNPJ 02.213.188/0001-81" — e o cadastro tinha um
         * campo só. Apontado pelo usuário em 12/08/2026, ao comparar o modelo
         * gerado com o certificado real da associada.
         *
         * Guardar as duas importa além do texto: quando o voucher for ligado
         * ao escolaId da Fase 4, é preciso saber QUAL das duas é a escola da
         * base — e com um campo só a resposta era ambígua. */
        "INSTITUICAO_ENSINO",
        "CNPJ_INSTITUICAO",
        /* Para onde o certificado é enviado em cópia. Guardado na
         * solicitação, e não só buscado na hora, porque a instituição de
         * ensino pode não estar no cadastro de Escolas — muitas faculdades
         * não são base do sindicato — e porque quem emite pode corrigir o
         * endereço no modal sem alterar o cadastro da escola inteira. */
        "EMAIL_INSTITUICAO",
        "SITUACAO_SINDICAL",
        "STATUS_VALIDACAO_SINDICAL",
        "TIPO_BENEFICIARIO",
        "NOME_BENEFICIARIO",
        "DATA_NASCIMENTO_BENEFICIARIO",
        "IDADE_BENEFICIARIO",
        "NOME_TITULAR_ASSOCIADO",
        "PARENTESCO",
        "ENTEADO_DECLARADO_IR",
        "MODALIDADE",
        "CURSO",
        "AREA_CURSO",
        "ORDEM_FILHO",
        "REGIME",
        "PERIODO_REFERENCIA",
        "PERCENTUAL_APLICADO",
        "TIPO_DOCUMENTO_VINCULO",
        "LINK_CONTRACHEQUE",
        "LINK_DOC_PESSOAL",
        "STATUS_SOLICITACAO",
        "CANAL_ENTRADA",
        "USUARIO_CADASTRO",
        "USUARIO_VALIDACAO",
        "DATA_VALIDACAO",
        "DATA_EMISSAO",
        "OBSERVACOES",
        "NUMERO_PROTOCOLO",
        /* PRIMEIRA_VEZ ou RENOVACAO — deduzido na gravação a partir do que já
         * existe para a mesma pessoa no mesmo curso (VoucherPeriodo.gs), nunca
         * perguntado a quem digita. Fica gravado porque a dedução depende de
         * linhas que podem ser recusadas ou canceladas depois: relida meses
         * adiante, a mesma conta daria outra resposta. */
        "TIPO_SOLICITACAO",
        /* Preenchida SÓ quando um administrador autorizou uma exceção à trava
         * de "um por período" — guarda o protocolo da bolsa anterior. Existe
         * como coluna, e não apenas como texto na observação, para a pergunta
         * "quantas exceções foram autorizadas e quais" ter resposta por
         * filtro. O que sai da regra é o que mais precisa ser encontrável. */
        "EXCECAO_DUPLICIDADE"
  ];
}

function setupVoucherModuleFase1() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);

  const sheets = [
    {
      name: "Voucher_Cadastros",
      headers: [
        "ID_CADASTRO",
        "DATA_CADASTRO",
        "DATA_ULTIMA_ATUALIZACAO",
        "CPF",
        "NOME",
        "DATA_NASCIMENTO",
        "IDADE",
        "TELEFONE",
        "EMAIL",
        "ENDERECO",
        "ESCOLA_ATUAL",
        "UNIDADE_ESCOLA",
        "CNPJ_ESCOLA",
        "CIDADE_ESCOLA",
        "CARGO_FUNCAO",
        "SITUACAO_VINCULO",
        "SITUACAO_SINDICAL",
        "ORIGEM_CADASTRO",
        "STATUS_CADASTRO",
        "OBSERVACOES"
      ]
    },
    {
      name: "Voucher_Solicitacoes",
      headers: VOUCHER_COLUNAS_SOLICITACOES_()
    },
    {
      name: "Voucher_Protocolos",
      headers: [
        "NUMERO_PROTOCOLO",
        "DATA_GERACAO",
        "ID_SOLICITACAO",
        "CPF",
        "NOME",
        "ESCOLA",
        "UNIDADE_ESCOLA",
        "CNPJ_ESCOLA",
        "CIDADE_ESCOLA",
        "STATUS_PROTOCOLO",
        "RESPONSAVEL",
        "OBSERVACOES"
      ]
    },
    {
      name: "Voucher_Emitidos",
      headers: [
        "ID_EMISSAO",
        "DATA_EMISSAO",
        "PROTOCOLO",
        "ID_SOLICITACAO",
        "NOME_SOLICITANTE",
        "CPF",
        "ESCOLA",
        "TIPO_DOCUMENTO",
        "CODIGO_VALIDACAO",
        "LINK_ARQUIVO",
        "PERCENTUAL",
        "USUARIO"
      ]
    },
    {
      name: "Voucher_Historico",
      headers: [
        "ID_EVENTO",
        "DATA_HORA",
        "ID_SOLICITACAO",
        "NUMERO_PROTOCOLO",
        "CPF",
        "NOME",
        "ACAO",
        "USUARIO_RESPONSAVEL",
        "OBSERVACOES"
      ]
    },
    {
      name: "Voucher_Documentos",
      headers: [
        "ID_DOCUMENTO",
        "ID_SOLICITACAO",
        "CPF",
        "TIPO_DOCUMENTO",
        "NOME_ARQUIVO",
        "LINK_ARQUIVO",
        "ID_ARQUIVO_DRIVE",
        "DATA_ENVIO",
        "VALIDADO",
        "VALIDADOR",
        "DATA_VALIDACAO",
        "OBSERVACOES"
      ]
    },
    {
      name: "Voucher_Regras",
      headers: [
        "ID_REGRA",
        "TIPO_REGRA",
        "MODALIDADE",
        "AREA_CURSO",
        "ORDEM_FILHO",
        "TIPO_BENEFICIARIO",
        "IDADE_MAXIMA",
        "PERCENTUAL",
        "REGIME",
        "ATIVO",
        "OBSERVACOES"
      ]
    }
  ];

  sheets.forEach(function(def) {
    const sh = getOrCreateSheet_(ss, def.name);
    ensureHeaders_(sh, def.headers);
    formatHeader_(sh, def.headers.length);
    sh.setFrozenRows(1);
    autoResizeSafe_(sh, def.headers.length);
  });

  seedVoucherRules_();

  Logger.log("Estrutura do módulo Voucher criada com sucesso!");

  return {
    ok: true,
    mensagem: "Módulo Voucher inicializado."
  };
}

/* ================= REGRAS BASE ================= */

function seedVoucherRules_() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Regras");

  if (!sh) return;

  const existingData = sh.getDataRange().getValues();

  if (existingData.length > 1) return;

  /* AS REGRAS DA CONVENÇÃO COLETIVA — ditadas pelo usuário em 12/08/2026.
   *
   * ENSINO BÁSICO (infantil, fundamental, médio, técnico), por ordem do filho:
   *   1º filho 100% · 2º filho 100% · 3º filho 60%
   *
   * O 3º FILHO É 60%, E ISSO FOI CONFERIDO. Na conversa de 12/08/2026 o
   * usuário disse 50%, o que divergia dos 60% que já estavam semeados desde
   * o início do módulo. Perguntei antes de mexer — percentual é dinheiro do
   * sindicato — e ele confirmou: "o semeado está correto, eu errei".
   * Registrado aqui para ninguém "corrigir" de volta para 50 lendo só o
   * histórico da conversa.
   *
   * GRADUAÇÃO, por área:
   *   Humanas 70% · Saúde 50% · Engenharia/Exatas 60%
   *
   * PÓS-GRADUAÇÃO: 70%
   *
   * MESTRADO e DOUTORADO: NÃO HÁ BENEFÍCIO. Entram aqui com percentual 0 e
   * ATIVO = SIM de propósito — uma regra explícita que concede zero é
   * diferente de regra ausente. Sem ela, o mestrado cairia no vazio e o
   * sistema deixaria o campo em branco, e campo em branco alguém preenche
   * na mão. Com ela, a tela pode dizer "esta modalidade não tem desconto
   * em convenção" — que é a informação verdadeira.
   *
   * ATENÇÃO A QUEM FOR MEXER: este seed só roda em aba VAZIA (a linha
   * `if (existingData.length > 1) return;` logo acima). Alterar percentual
   * de planilha que já opera é mudança de dinheiro e exige migração
   * própria, com prévia — nunca de passagem por um seed. */
  const BASICO = ["EDUCACAO_INFANTIL", "CRECHE", "ENSINO_FUNDAMENTAL", "ENSINO_MEDIO", "TECNICO"];
  const POR_ORDEM = { "1": 100, "2": 100, "3": 60 };
  const AREAS = { "HUMANAS": 70, "SAUDE": 50, "ENGENHARIA": 60 };
  const PARENTES = ["TITULAR", "CONJUGE", "FILHO", "ENTEADO"];

  const rows = [];
  let n = 0;
  function id() { n++; return "REG" + ("00" + n).slice(-3); }

  BASICO.forEach(function (mod) {
    ["1", "2", "3"].forEach(function (ordem) {
      rows.push([id(), "PERCENTUAL_POR_ORDEM", mod, "", ordem, "FILHO", "24",
                 String(POR_ORDEM[ordem]), "ANUAL", "SIM", ordem + "º filho"]);
    });
  });

  Object.keys(AREAS).forEach(function (area) {
    PARENTES.forEach(function (quem) {
      rows.push([id(), "PERCENTUAL_POR_AREA", "GRADUACAO", area, "", quem,
                 (quem === "FILHO" || quem === "ENTEADO") ? "24" : "",
                 String(AREAS[area]), "SEMESTRAL", "SIM", "Graduação " + area]);
    });
  });

  PARENTES.forEach(function (quem) {
    rows.push([id(), "PERCENTUAL_FIXO", "POS_GRADUACAO", "", "", quem,
               (quem === "FILHO" || quem === "ENTEADO") ? "24" : "",
               "70", "ANUAL", "SIM", "Pós-graduação"]);
  });

  /* Mestrado e doutorado: regra explícita de ZERO, não ausência de regra. */
  ["MESTRADO", "DOUTORADO"].forEach(function (mod) {
    PARENTES.forEach(function (quem) {
      rows.push([id(), "SEM_BENEFICIO", mod, "", "", quem, "", "0", "ANUAL", "SIM",
                 "Não há desconto em convenção para " + mod.toLowerCase()]);
    });
  });

  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  autoResizeSafe_(sh, sh.getLastColumn());
}

/* ================= REGRAS DE NEGÓCIO ================= */

function calcularRegraVoucher_(dados, idadeBeneficiario) {
  const modalidade       = String(dados.modalidade || "").trim().toUpperCase();
  const areaCurso        = String(dados.areaCurso || "").trim().toUpperCase();
  const tipoBeneficiario = String(dados.tipoBeneficiario || "").trim().toUpperCase();
  const ordemFilho       = String(dados.ordemFilho || "").trim();
  const enteadoIR        = String(dados.enteadoDeclaradoIR || "").trim().toUpperCase();
  const situacao         = String(dados.situacaoSindical || "").trim().toUpperCase();

  /* SÓ ASSOCIADO TEM DIREITO — regra dita pelo usuário em 12/08/2026.
   *
   * A verificação existia só na EMISSÃO (VoucherPdf.gs), o que é tarde
   * demais: a solicitação era cadastrada, analisada, aprovada, e só na hora
   * de gerar o documento é que aparecia "só pode ser emitido após
   * confirmação de associação". Todo o trabalho já tinha sido feito.
   *
   * Aqui a recusa acontece no cálculo, ou seja no instante em que a tela
   * pergunta o percentual — antes de alguém digitar o resto.
   *
   * Situação em branco NÃO é recusa: quem ainda não escolheu o campo não
   * está declarando que a pessoa é não-associada. A trava da emissão
   * continua lá para esse caso. */
  if (situacao && situacao !== "ASSOCIADO") {
    return {
      apto: false, percentual: "", regime: "",
      observacao: "Só associado tem direito ao benefício. Situação sindical: " + situacao + "."
    };
  }

  /* ATÉ TRÊS FILHOS — mesma conversa.
   *
   * A convenção prevê 1º, 2º e 3º. Do quarto em diante não há benefício, e
   * a versão anterior devolvia "Ordem do filho inválida para a modalidade
   * informada" — mensagem que faz quem lê procurar erro na MODALIDADE,
   * quando o problema é a ordem. Recusar é certo; explicar errado custa
   * uma ligação para o sindicato. */
  if (tipoBeneficiario === "FILHO" || tipoBeneficiario === "ENTEADO") {
    const n = parseInt(ordemFilho, 10);
    if (ordemFilho && (isNaN(n) || n > 3)) {
      return {
        apto: false, percentual: "", regime: "",
        observacao: "A convenção prevê desconto até o 3º filho. Informado: " +
                    ordemFilho + "º."
      };
    }
  }

  /* IDADE MÁXIMA: 24 ANOS — e "até 24" inclui os 24.
   *
   * O código dizia `>= 24`, ou seja RECUSAVA quem tem 24 — e a mensagem ao
   * lado dizia "até 24 anos". As duas coisas no mesmo bloco, uma negando a
   * outra. Um dependente de 24 anos era recusado por um erro de um ano, com
   * uma explicação que afirmava o contrário do que o código fazia; quem
   * ligasse para o sindicato ouviria que tinha direito.
   *
   * Confirmado pelo usuário em 12/08/2026: "a idade máxima de solicitação é
   * 24 anos". Agora recusa a partir de 25. */
  if (tipoBeneficiario === "FILHO" && (idadeBeneficiario === "" || Number(idadeBeneficiario) > 24)) {
    return {
      apto: false,
      percentual: "",
      regime: "",
      observacao: idadeBeneficiario === ""
        ? "Informe a idade do beneficiário — o limite é 24 anos."
        : "Beneficiário com " + idadeBeneficiario +
          " anos: o limite da convenção é 24 anos."
    };
  }

  if (tipoBeneficiario === "ENTEADO") {
    /* Mesmo erro de um ano, mesma correção — enteado segue o limite do filho. */
    if (idadeBeneficiario === "" || Number(idadeBeneficiario) > 24) {
      return {
        apto: false,
        percentual: "",
        regime: "",
        observacao: idadeBeneficiario === ""
          ? "Informe a idade do beneficiário — o limite é 24 anos."
          : "Beneficiário enteado com " + idadeBeneficiario +
            " anos: o limite da convenção é 24 anos."
      };
    }

    if (enteadoIR !== "SIM") {
      return {
        apto: false,
        percentual: "",
        regime: "",
        observacao: "Enteado exige comprovação em declaração de Imposto de Renda."
      };
    }
  }

  /* MESTRADO E DOUTORADO NÃO TÊM DESCONTO EM CONVENÇÃO.
   *
   * Isto precisa vir ANTES de tudo, e a razão é um defeito que estava aqui:
   * o bloco `if (tipoBeneficiario === "TITULAR")` lá embaixo é alcançado
   * quando NENHUMA modalidade casa, e concede 100%. Ou seja, um titular
   * pedindo bolsa de mestrado — modalidade sem regra — saía com desconto
   * integral. O oposto exato do que a convenção diz.
   *
   * Recusar explicitamente é diferente de não ter regra: a resposta abaixo
   * explica o motivo, em vez de deixar o campo em branco para alguém
   * preencher na mão. */
  if (["MESTRADO", "DOUTORADO"].indexOf(modalidade) > -1) {
    return {
      apto: false,
      percentual: "",
      regime: "",
      observacao: "Não há desconto previsto em convenção para " +
                  modalidade.toLowerCase() + "."
    };
  }

  /* ENSINO_MEDIO ESTAVA FALTANDO NESTA LISTA.
   *
   * `getPortalVoucherInitData` oferece "Ensino Médio (15–17 anos)" no menu
   * de modalidades, e quem escolhesse caía no "Modalidade não reconhecida
   * nas regras do voucher" lá no fim — pedido recusado por um buraco no
   * código, não por regra da convenção. Segue os mesmos 100/100/60 das
   * demais modalidades do ensino básico. */
  if (["EDUCACAO_INFANTIL", "CRECHE", "ENSINO_FUNDAMENTAL",
       "ENSINO_MEDIO", "TECNICO"].indexOf(modalidade) > -1) {
    let percentual = "";

    if (ordemFilho === "1" || ordemFilho === "2") percentual = "100";
    if (ordemFilho === "3") percentual = "60";

    if (!percentual) {
      return {
        apto: false,
        percentual: "",
        regime: "ANUAL",
        observacao: "Ordem do filho inválida para a modalidade informada."
      };
    }

    return {
      apto: true,
      percentual: percentual,
      regime: "ANUAL",
      observacao: "Solicitação enquadrada por ordem do filho."
    };
  }

  if (modalidade === "GRADUACAO") {
    let percentualGrad = "";

    if (areaCurso === "ENGENHARIA") percentualGrad = "60";
    if (areaCurso === "HUMANAS")    percentualGrad = "70";
    if (areaCurso === "SAUDE")      percentualGrad = "50";

    if (!percentualGrad) {
      return {
        apto: false,
        percentual: "",
        regime: "SEMESTRAL",
        observacao: "Área do curso inválida para graduação."
      };
    }

    return {
      apto: true,
      percentual: percentualGrad,
      regime: "SEMESTRAL",
      observacao: "Solicitação enquadrada por área do curso."
    };
  }

  if (modalidade === "POS_GRADUACAO") {
    return {
      apto: true,
      percentual: "70",
      regime: "ANUAL",
      observacao: "Solicitação enquadrada como pós-graduação."
    };
  }

  if (tipoBeneficiario === "TITULAR") {
    return {
      apto: true,
      percentual: "100",
      regime: "ANUAL",
      observacao: "Titular — desconto integral."
    };
  }

  return {
    apto: false,
    percentual: "",
    regime: "",
    observacao: "Modalidade não reconhecida nas regras do voucher."
  };
}

/* ================= ESCOLAS ================= */

function buscarEscolaPorNome_(nomeEscola) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Escolas");

    if (!sh || !nomeEscola) {
      return {
        unidade: "",
        escola: nomeEscola || "",
        cnpj: "",
        cidade: ""
      };
    }

    const dados = sh.getDataRange().getValues();

    if (dados.length < 2) {
      return {
        unidade: "",
        escola: nomeEscola,
        cnpj: "",
        cidade: ""
      };
    }

    const headers = dados[0].map(function(h) {
      return String(h).trim();
    });

    function findCol() {
      for (let i = 0; i < arguments.length; i++) {
        const idx = headers.indexOf(arguments[i]);
        if (idx > -1) return idx;
      }
      return -1;
    }

    const idxUnidade = findCol("Unidade", "CodigoInterno", "Campus");
    const idxEscola  = findCol("NomeEscola", "Escola (Razão Social)", "Escola");
    const idxCnpj    = findCol("CNPJ");
    const idxCidade  = findCol("Municipio", "Município", "Cidade");

    if (idxEscola === -1) {
      return {
        unidade: "",
        escola: nomeEscola,
        cnpj: "",
        cidade: ""
      };
    }

    const busca = normalizarTextoVoucher_(nomeEscola);

    for (let i = 1; i < dados.length; i++) {
      const nome = normalizarTextoVoucher_(dados[i][idxEscola]);

      if (nome === busca || nome.indexOf(busca) > -1 || busca.indexOf(nome) > -1) {
        return {
          escola:  String(dados[i][idxEscola] || "").trim(),
          unidade: idxUnidade > -1 ? String(dados[i][idxUnidade] || "") : "",
          cnpj:    idxCnpj > -1 ? String(dados[i][idxCnpj] || "") : "",
          cidade:  idxCidade > -1 ? String(dados[i][idxCidade] || "") : ""
        };
      }
    }

    return {
      unidade: "",
      escola: nomeEscola,
      cnpj: "",
      cidade: ""
    };

  } catch(e) {
    return {
      unidade: "",
      escola: nomeEscola || "",
      cnpj: "",
      cidade: ""
    };
  }
}

function listarEscolasVoucher_() {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Escolas");

  if (!sh || sh.getLastRow() < 2) return [];

  const dados = sh.getDataRange().getValues();
  const headers = dados[0].map(function(h) {
    return String(h).trim();
  });

  function findCol() {
    for (let i = 0; i < arguments.length; i++) {
      const idx = headers.indexOf(arguments[i]);
      if (idx > -1) return idx;
    }
    return -1;
  }

  const idxEscola  = findCol("NomeEscola", "Escola (Razão Social)", "Escola");
  const idxUnidade = findCol("Unidade", "CodigoInterno");
  const idxCnpj    = findCol("CNPJ");
  const idxCidade  = findCol("Municipio", "Município", "Cidade");

  if (idxEscola === -1) return [];

  const vistas = new Set();

  return dados.slice(1)
    .map(function(linha) {
      return {
        escola:  String(linha[idxEscola] || "").trim(),
        unidade: idxUnidade > -1 ? String(linha[idxUnidade] || "").trim() : "",
        cnpj:    idxCnpj > -1 ? String(linha[idxCnpj] || "").trim() : "",
        cidade:  idxCidade > -1 ? String(linha[idxCidade] || "").trim() : ""
      };
    })
    .filter(function(item) {
      if (!item.escola || vistas.has(item.escola)) return false;
      vistas.add(item.escola);
      return true;
    })
    .sort(function(a, b) {
      return a.escola.localeCompare(b.escola, "pt-BR");
    });
}

/* ================= HISTÓRICO ================= */

function registrarHistoricoVoucher_(idSolicitacao, cpf, acao, usuario, observacoes, protocolo) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Historico");

    if (!sh) return;

    sh.appendRow([
      gerarIdPadrao_("HIS"),
      new Date(),
      idSolicitacao || "",
      protocolo || "",
      cpf || "",
      "",
      acao || "",
      usuario || obterUsuarioAtualVoucher_(),
      observacoes || ""
    ]);

  } catch(e) {
    Logger.log("registrarHistoricoVoucher_ erro: " + e.message);
  }
}

/* ================= DOCUMENTOS NO DRIVE ================= */

function obterPastaVoucherDocumentos_() {
  const pastaId = String(PASTA_VOUCHER_DOCUMENTOS_ID || "").trim();

  if (!pastaId) {
    throw new Error("Pasta de documentos do Voucher não configurada.");
  }

  return DriveApp.getFolderById(pastaId);
}

function salvarDocumentoVoucher_(idSolicitacao, cpf, arquivo, tipoDocumento, observacoes, nomeSolicitante) {
  if (!arquivo || !arquivo.base64) return null;

  try {
    const pasta = obterPastaVoucherDocumentos_();
    const nomeOriginal = sanitizarNomeArquivoVoucher_(arquivo.nome || (tipoDocumento + ".bin"));
    const nomePessoa = sanitizarNomeArquivoVoucher_(nomeSolicitante || cpf);
    const nomeFinal = [
      "Voucher",
      nomePessoa,
      String(tipoDocumento || "").toUpperCase(),
      cpf,
      idSolicitacao,
      nomeOriginal
    ].join(" - ");

    const bytes = Utilities.base64Decode(arquivo.base64);
    const blob = Utilities.newBlob(bytes, arquivo.tipo || MimeType.PDF, nomeFinal);
    const file = pasta.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {}

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Documentos");

    if (sh) {
      sh.appendRow([
        gerarIdPadrao_("DOC"),
        idSolicitacao,
        cpf,
        String(tipoDocumento || "").toUpperCase(),
        nomeOriginal,
        file.getUrl(),
        file.getId(),
        new Date(),
        "NAO",
        "",
        "",
        observacoes || ""
      ]);
    }

    registrarHistoricoVoucher_(
      idSolicitacao,
      cpf,
      "DOCUMENTO_ENVIADO",
      "SISTEMA",
      "Documento: " + String(tipoDocumento || "").toUpperCase()
    );

    return {
      idArquivo: file.getId(),
      nomeArquivo: nomeOriginal,
      linkArquivo: file.getUrl(),
      tipoDocumento: String(tipoDocumento || "").toUpperCase()
    };

  } catch(e) {
    Logger.log("salvarDocumentoVoucher_ erro: " + e.message);
    return null;
  }
}

function registrarDocumentosPayloadVoucher_(idSolicitacao, cpf, payload) {
  const documentos = [];
  const tipoVinculo = inferirTipoDocumentoVinculo_(payload);
  const nomeSolicitante = valorSeguroVoucher_(payload && payload.nome);

  if (payload && payload.contracheque && payload.contracheque.base64) {
    const doc = salvarDocumentoVoucher_(
      idSolicitacao,
      cpf,
      payload.contracheque,
      tipoVinculo,
      "Documento de vínculo.",
      nomeSolicitante
    );

    if (doc) documentos.push(doc);
  }

  if (payload && payload.docPessoal && payload.docPessoal.base64) {
    const doc = salvarDocumentoVoucher_(
      idSolicitacao,
      cpf,
      payload.docPessoal,
      "DOCUMENTO_PESSOAL",
      "Documento pessoal.",
      nomeSolicitante
    );

    if (doc) documentos.push(doc);
  }

  return documentos;
}

/* ================= BUSCA INTERNA ================= */

function buscarSolicitacaoPorId_(idSolicitacao) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Solicitacoes");

  if (!sh || sh.getLastRow() < 2) return null;

  const headers = obterHeaders_(sh);
  const idxId = headers.indexOf("ID_SOLICITACAO");
  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][idxId] || "") === String(idSolicitacao || "")) {
      return {
        linha: i + 2,
        headers: headers,
        registro: mapRowToObject_(headers, dados[i])
      };
    }
  }

  return null;
}

function buscarSolicitacaoPorProtocolo_(protocolo) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Solicitacoes");

  if (!sh || sh.getLastRow() < 2) return null;

  const headers = obterHeaders_(sh);
  const idxProt = headers.indexOf("NUMERO_PROTOCOLO");
  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][idxProt] || "") === String(protocolo || "")) {
      return {
        linha: i + 2,
        headers: headers,
        registro: mapRowToObject_(headers, dados[i])
      };
    }
  }

  return null;
}

/* ================= PORTAL — DADOS INICIAIS ================= */

function getPortalVoucherInitData() {
  return {
    escolas: listarEscolasVoucher_(),
    modalidades: [
      { value: "EDUCACAO_INFANTIL",  label: "Educação Infantil (4–5 anos)" },
      { value: "CRECHE",             label: "Creche (0–3 anos)" },
      { value: "ENSINO_FUNDAMENTAL", label: "Ensino Fundamental (6–14 anos)" },
      { value: "ENSINO_MEDIO",       label: "Ensino Médio (15–17 anos)" },
      { value: "TECNICO",            label: "Técnico (15–25 anos)" },
      { value: "GRADUACAO",          label: "Graduação" },
      { value: "POS_GRADUACAO",      label: "Pós-Graduação" }
    ],
    areas: [
      { value: "ENGENHARIA", label: "Engenharia e Tecnologia" },
      { value: "HUMANAS",    label: "Ciências Humanas e Sociais" },
      { value: "SAUDE",      label: "Ciências Biológicas e da Saúde" }
    ],
    beneficiarios: [
      { value: "TITULAR", label: "Titular (eu mesmo)" },
      { value: "CONJUGE", label: "Cônjuge / Companheiro(a)" },
      { value: "FILHO",   label: "Filho(a)" },
      { value: "ENTEADO", label: "Enteado(a)" }
    ],
    parentescos: [
      { value: "TITULAR",     label: "Titular" },
      { value: "CONJUGE",     label: "Cônjuge" },
      { value: "COMPANHEIRO", label: "Companheiro(a)" },
      { value: "FILHO",       label: "Filho(a)" },
      { value: "ENTEADO",     label: "Enteado(a)" }
    ]
  };
}

/* ================= LISTAGEM (PAINEL ADMIN) ================= */

function listarSolicitacoesVoucher() {
  try {
    setupVoucherModuleFase1();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Solicitacoes");

    if (!sh || sh.getLastRow() < 2) return [];

    const headers = obterHeaders_(sh).map(function(h) {
      return String(h || "").trim();
    });

    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    function idx() {
      for (let i = 0; i < arguments.length; i++) {
        const nome = String(arguments[i] || "").trim();
        const pos = headers.indexOf(nome);

        if (pos > -1) return pos;
      }

      return -1;
    }

    function val(linha) {
      for (let i = 1; i < arguments.length; i++) {
        const pos = idx(arguments[i]);

        if (
          pos > -1 &&
          linha[pos] !== undefined &&
          linha[pos] !== null &&
          String(linha[pos]).trim() !== ""
        ) {
          return linha[pos];
        }
      }

      return "";
    }

    return dados.map(function(l) {
      const dataSolicitacao = val(l, "DATA_SOLICITACAO");
      const dataTexto = val(l, "DATA_SOLICITACAO_TEXTO");

      return {
        id: String(val(l, "ID_SOLICITACAO", "ID", "ID_SOL", "SOLICITACAO_ID") || ""),
        protocolo: String(val(l, "NUMERO_PROTOCOLO", "PROTOCOLO", "Nº PROTOCOLO", "NUMERO DO PROTOCOLO", "NÚMERO_PROTOCOLO") || ""),
        nome: String(val(l, "NOME_SOLICITANTE", "NOME", "NOME COMPLETO", "SOLICITANTE", "NOME_ASSOCIADO") || ""),
        cpf: String(val(l, "CPF_SOLICITANTE", "CPF", "CPF_ASSOCIADO", "DOCUMENTO") || ""),

        email: String(val(l, "EMAIL", "E-MAIL", "E_MAIL") || ""),
        telefone: String(val(l, "TELEFONE", "WHATSAPP", "CELULAR") || ""),
        escola: String(val(l, "ESCOLA_SELECIONADA", "ESCOLA", "ESCOLA_ATUAL", "INSTITUICAO") || ""),
        cnpjEscola: String(val(l, "CNPJ_ESCOLA", "CNPJ") || ""),

        situacaoSindicalDeclarada: String(val(l, "SITUACAO_SINDICAL", "SITUAÇÃO_SINDICAL", "SITUACAO SINDICAL") || ""),
        statusValidacaoSindical: String(val(l, "STATUS_VALIDACAO_SINDICAL", "STATUS_VALIDAÇÃO_SINDICAL", "VALIDACAO_SINDICAL") || ""),

        tipoBeneficiario: String(val(l, "TIPO_BENEFICIARIO", "BENEFICIARIO", "TIPO BENEFICIÁRIO") || ""),
        nomeBeneficiario: String(val(l, "NOME_BENEFICIARIO", "NOME DO BENEFICIARIO", "NOME_BENEF") || ""),

        nivel: String(val(l, "MODALIDADE", "NIVEL", "NÍVEL") || ""),
        modalidade: String(val(l, "MODALIDADE", "NIVEL", "NÍVEL") || ""),
        curso: String(val(l, "CURSO") || ""),
        areaCurso: String(val(l, "AREA_CURSO", "ÁREA_CURSO", "AREA", "ÁREA") || ""),
        ordemFilho: String(val(l, "ORDEM_FILHO", "ORDEM DO FILHO") || ""),
        periodoReferencia: String(val(l, "PERIODO_REFERENCIA", "PERÍODO_REFERENCIA", "PERIODO", "PERÍODO") || ""),
        percentual: String(val(l, "PERCENTUAL_APLICADO", "PERCENTUAL", "% DESCONTO", "DESCONTO") || ""),
        regime: String(val(l, "REGIME") || ""),
        /* PRIMEIRA_VEZ ou RENOVACAO, gravado na criação (VoucherPeriodo.gs).
         * Linha antiga vem vazia — e vazio não vira "primeira vez" aqui: a
         * etiqueta só aparece quando o dado existe, porque afirmar "primeira
         * vez" sobre uma bolsa que já foi renovada três vezes é pior que não
         * dizer nada. */
        tipoSolicitacao: String(val(l, "TIPO_SOLICITACAO", "TIPO_SOLICITAÇÃO") || ""),

        status: String(val(l, "STATUS_SOLICITACAO", "STATUS_SOLICITAÇÃO", "STATUS") || "PENDENTE"),
        data: String(dataTexto || formatarDataBrVoucher_(dataSolicitacao) || ""),
        observacao: String(val(l, "OBSERVACOES", "OBSERVAÇÕES", "OBS") || ""),

        linkContracheque: String(val(l, "LINK_CONTRACHEQUE", "CONTRACHEQUE", "LINK DOCUMENTO VINCULO") || ""),
        linkDocPessoal: String(val(l, "LINK_DOC_PESSOAL", "DOC_PESSOAL", "DOCUMENTO_PESSOAL") || ""),

        _ts: timestampSeguroVoucher_(dataSolicitacao)
      };
    })
    .filter(function(item) {
      return item.id || item.protocolo || item.nome || item.cpf;
    })
    .sort(function(a, b) {
      return (b._ts || 0) - (a._ts || 0);
    })
    .map(function(item) {
      delete item._ts;
      return item;
    });

  } catch(e) {
    throw new Error("Erro ao listar solicitações: " + e.message);
  }
}

function listarSolicitacoesCertBolsa(tokenSessao) {
  exigirModulo_(tokenSessao, "beneficios", false);
  return listarSolicitacoesVoucher();
}

/* ================= DASHBOARD (PAINEL ADMIN) ================= */

function dashboardVoucher() {
  try {
    setupVoucherModuleFase1();

    const lista = listarSolicitacoesVoucher();

    let total = 0;
    let pendentes = 0;
    let analise = 0;
    let aprovadas = 0;
    let emitidos = 0;
    let bloqueadas = 0;
    let validacaoCadastral = 0;
    let naoAssociados = 0;

    lista.forEach(function(s) {
      total++;

      const st = String(s.status || "").toUpperCase();

      if (st === "PENDENTE") pendentes++;
      if (st === "ANALISE") analise++;
      if (st === "APROVADO") aprovadas++;
      if (st === "EMITIDO") emitidos++;
      if (st === "BLOQUEADA_POR_REGRA") bloqueadas++;
      if (st === "AGUARDANDO_VALIDACAO_CADASTRAL") validacaoCadastral++;

      if (
        st === "INDEFERIDO_NAO_ASSOCIADO" ||
        st === "NAO_ASSOCIADO" ||
        st === "AGUARDANDO_ATENDIMENTO_PRESENCIAL"
      ) {
        naoAssociados++;
      }
    });

    const recentes = lista.slice(0, 3).map(function(s) {
      return s.protocolo + " — " + s.nome;
    });

    const pendLista = lista.filter(function(s) {
      const st = String(s.status || "").toUpperCase();
      return st === "PENDENTE" || st === "ANALISE" || st === "AGUARDANDO_VALIDACAO_CADASTRAL";
    }).slice(0, 3).map(function(s) {
      return s.protocolo + " — " + s.nome;
    });

    const aprLista = lista.filter(function(s) {
      return String(s.status || "").toUpperCase() === "APROVADO";
    }).slice(0, 3).map(function(s) {
      return s.protocolo + " — " + s.nome;
    });

    return {
      total: total,
      pendentes: pendentes + analise + validacaoCadastral,
      aprovadas: aprovadas,
      emitidos: emitidos,
      bloqueadas: bloqueadas,
      validacaoCadastral: validacaoCadastral,
      naoAssociados: naoAssociados,
      resumoRecentes: recentes.length ? recentes.join(" | ") : "Nenhuma solicitação recente.",
      resumoPendencias: pendLista.length ? pendLista.join(" | ") : "Nenhuma pendência no momento.",
      resumoAprovacoes: aprLista.length ? aprLista.join(" | ") : "Nenhuma aprovação recente."
    };

  } catch(e) {
    throw new Error("Erro ao montar dashboard: " + e.message);
  }
}

function dashboardCertBolsa() {
  return dashboardVoucher();
}

/* ================= LISTAGENS AUXILIARES ================= */

function listarProtocolosCertBolsa() {
  try {
    setupVoucherModuleFase1();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Protocolos");

    if (!sh || sh.getLastRow() < 2) return [];

    const headers = obterHeaders_(sh);
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    function idx(n) {
      return headers.indexOf(n);
    }

    return dados.map(function(l) {
      return {
        protocolo: String(l[idx("NUMERO_PROTOCOLO")] || ""),
        nome: String(l[idx("NOME")] || ""),
        escola: String(l[idx("ESCOLA")] || ""),
        data: formatarDataHoraBrVoucher_(l[idx("DATA_GERACAO")]),
        situacao: String(l[idx("STATUS_PROTOCOLO")] || "PENDENTE"),
        responsavel: String(l[idx("RESPONSAVEL")] || "")
      };
    }).sort(function(a, b) {
      return timestampSeguroVoucher_(b.data) - timestampSeguroVoucher_(a.data);
    });

  } catch(e) {
    throw new Error("Erro ao listar protocolos: " + e.message);
  }
}

function listarHistoricoCertBolsa() {
  try {
    setupVoucherModuleFase1();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Historico");

    if (!sh || sh.getLastRow() < 2) return [];

    const headers = obterHeaders_(sh);
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    function idx(n) {
      return headers.indexOf(n);
    }

    return dados.map(function(l) {
      return {
        data: formatarDataHoraBrVoucher_(l[idx("DATA_HORA")]),
        protocolo: String(l[idx("NUMERO_PROTOCOLO")] || ""),
        nome: String(l[idx("NOME")] || ""),
        movimentacao: String(l[idx("ACAO")] || ""),
        usuario: String(l[idx("USUARIO_RESPONSAVEL")] || ""),
        observacao: String(l[idx("OBSERVACOES")] || "")
      };
    }).sort(function(a, b) {
      return timestampSeguroVoucher_(b.data) - timestampSeguroVoucher_(a.data);
    });

  } catch(e) {
    throw new Error("Erro ao listar histórico: " + e.message);
  }
}

function listarEmitidosCertBolsa() {
  try {
    setupVoucherModuleFase1();

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Emitidos");

    if (!sh || sh.getLastRow() < 2) return [];

    const headers = obterHeaders_(sh);
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    function idx(n) {
      return headers.indexOf(n);
    }

    function get(linha, nomes) {
      for (let i = 0; i < nomes.length; i++) {
        const pos = idx(nomes[i]);

        if (
          pos > -1 &&
          linha[pos] !== undefined &&
          linha[pos] !== null &&
          String(linha[pos]).trim() !== ""
        ) {
          return linha[pos];
        }
      }

      return "";
    }

    return dados.map(function(l) {
      return {
        data: formatarDataHoraBrVoucher_(get(l, ["DATA_EMISSAO"])),
        protocolo: String(get(l, ["PROTOCOLO", "NUMERO_PROTOCOLO"]) || ""),
        nome: String(get(l, ["NOME_SOLICITANTE", "NOME"]) || ""),
        tipoDocumento: String(get(l, ["TIPO_DOCUMENTO"]) || ""),
        codigoValidacao: String(get(l, ["CODIGO_VALIDACAO"]) || ""),
        linkArquivo: String(get(l, ["LINK_ARQUIVO"]) || "")
      };
    }).sort(function(a, b) {
      return timestampSeguroVoucher_(b.data) - timestampSeguroVoucher_(a.data);
    });

  } catch(e) {
    throw new Error("Erro ao listar emitidos: " + e.message);
  }
}

/* ================= EXCLUSÃO ================= */

function excluirSolicitacaoVoucher(idSolicitacao) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Solicitacoes");

    if (!sh || sh.getLastRow() < 2) {
      return {
        ok: false,
        mensagem: "Nenhuma solicitação encontrada."
      };
    }

    const headers = obterHeaders_(sh);
    const idxId = headers.indexOf("ID_SOLICITACAO");
    const idxProt = headers.indexOf("NUMERO_PROTOCOLO");
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    for (let i = 0; i < dados.length; i++) {
      if (String(dados[i][idxId] || "") === String(idSolicitacao || "")) {
        const protocolo = String(dados[i][idxProt] || "");

        sh.deleteRow(i + 2);

        registrarHistoricoVoucher_(
          idSolicitacao,
          "",
          "SOLICITACAO_EXCLUIDA",
          obterUsuarioAtualVoucher_(),
          "Registro excluído manualmente.",
          protocolo
        );

        return {
          ok: true,
          mensagem: "Solicitação excluída."
        };
      }
    }

    return {
      ok: false,
      mensagem: "Solicitação não encontrada."
    };

  } catch(e) {
    return {
      ok: false,
      mensagem: "Erro ao excluir: " + e.message
    };
  }
}

/* ================= INICIALIZAÇÃO PÚBLICA ================= */

function inicializarModuloCertBolsa() {
  return setupVoucherModuleFase1();
}

function inicializarModuloCert() {
  return setupVoucherModuleFase1();
}

/* ================= TESTES ================= */

function testeSetupVoucher() {
  const res = setupVoucherModuleFase1();
  Logger.log(JSON.stringify(res));
}

function testeSalvarPortalVoucher() {
  const res = salvarCadastroESolicitacaoVoucher({
    cpf: "08538104780",
    dataNascimento: "1987-01-01",
    nome: "Wanderson Nascimento Castelo",
    telefone: "(27) 99999-9999",
    email: "wanderson@teste.com",
    endereco: "Vitória/ES",
    escolaAtual: "Centro Educacional Infantil - Abc do Saber LTDA",
    cargoFuncao: "Administrativo",
    situacaoVinculo: "ATIVO",
    situacaoSindicalDeclarada: "ASSOCIADO",
    tipoBeneficiario: "FILHO",
    nomeBeneficiario: "Fulano de Tal",
    dataNascimentoBeneficiario: "2015-02-10",
    nomeTitularAssociado: "Wanderson Nascimento Castelo",
    parentesco: "FILHO",
    enteadoDeclaradoIR: "NAO",
    modalidade: "EDUCACAO_INFANTIL",
    curso: "Educação Infantil",
    areaCurso: "",
    ordemFilho: "1",
    periodoReferencia: "2026"
  });

  Logger.log(JSON.stringify(res, null, 2));
}

function testeDashboardVoucher() {
  Logger.log(JSON.stringify(dashboardVoucher(), null, 2));
}

function testeListarSolicitacoes() {
  const lista = listarSolicitacoesVoucher();

  Logger.log("Total: " + lista.length);

  if (lista.length) {
    Logger.log(JSON.stringify(lista[0], null, 2));
  }
}

function testeAprovarVoucher() {
  const lista = listarSolicitacoesVoucher();

  if (!lista.length) {
    Logger.log("Sem solicitações.");
    return;
  }

  Logger.log(JSON.stringify(
    aprovarSolicitacaoVoucher(lista[0].protocolo, "Aprovado em teste."),
    null,
    2
  ));
}

/**
 * DIAGNÓSTICO DO CABEÇALHO — só leitura, não escreve uma célula.
 *
 * Existe para responder uma pergunta específica depois do estrago do
 * ensureHeaders_ antigo (ver o comentário dele acima): QUAIS colunas de
 * Voucher_Solicitacoes estão com o nome trocado em relação ao dado?
 *
 * O jeito de descobrir é olhar o valor embaixo de cada nome e perguntar se
 * ele tem cara do que o nome promete. Uma data sob "INSTITUICAO_ENSINO" e um
 * "11" sob "CNPJ_INSTITUICAO" não deixam dúvida.
 *
 * O que é dado pessoal sai MASCARADO. Este log vai parar em print, e print
 * vai parar em conversa — CPF e e-mail inteiros não precisam estar aqui para
 * a coluna ser identificada.
 */
function voucherDiagnosticoColunas(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "beneficios", "Diagnóstico de colunas do Voucher", true);

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName("Voucher_Solicitacoes");
  if (!sh) {
    Logger.log("A aba Voucher_Solicitacoes não existe.");
    return { ok: false, mensagem: "Aba Voucher_Solicitacoes não encontrada." };
  }

  var nCols = sh.getLastColumn();
  var nLinhas = sh.getLastRow();
  var cab = sh.getRange(1, 1, 1, nCols).getValues()[0];
  var amostra = nLinhas >= 2 ? sh.getRange(2, 1, 1, nCols).getValues()[0] : [];

  function mascarar(nome, v) {
    var s = v instanceof Date ? v.toString() : String(v == null ? "" : v);
    if (!s) return "(vazio)";
    var n = String(nome || "").toUpperCase();
    if (n.indexOf("CPF") > -1) return s.replace(/\d(?=\d{2})/g, "*");
    if (n.indexOf("EMAIL") > -1 && s.indexOf("@") > 0) {
      return s.charAt(0) + "***@" + s.split("@")[1];
    }
    if (n.indexOf("TELEFONE") > -1) return s.replace(/\d(?=\d{4})/g, "*");
    return s.length > 42 ? s.slice(0, 42) + "…" : s;
  }

  /* O tipo aparente é o que denuncia o desalinhamento: o nome diz uma coisa,
   * o formato do valor diz outra. */
  function cara(v) {
    if (v instanceof Date) return "DATA";
    if (v === "" || v === null || v === undefined) return "vazio";
    if (typeof v === "number") return "número";
    var s = String(v);
    if (/^\d{14}$/.test(s.replace(/\D/g, "")) && s.replace(/\D/g, "").length === 14) return "CNPJ?";
    if (s.indexOf("@") > 0) return "e-mail";
    return "texto";
  }

  Logger.log("═══ Voucher_Solicitacoes — " + nCols + " colunas · " +
             Math.max(nLinhas - 1, 0) + " solicitações ═══");
  Logger.log("");
  Logger.log("col  CABEÇALHO                          tipo      1ª linha");
  Logger.log("───────────────────────────────────────────────────────────────────");

  var linhas = [];
  for (var i = 0; i < nCols; i++) {
    var nome = String(cab[i] || "(sem nome)");
    var v = amostra.length ? amostra[i] : "";
    var txt = ("" + (i + 1)).padStart(3) + "  " + (nome + "                                   ").slice(0, 34) +
              " " + (cara(v) + "        ").slice(0, 9) + " " + mascarar(nome, v);
    Logger.log(txt);
    linhas.push({ coluna: i + 1, cabecalho: nome, tipo: cara(v) });
  }

  /* Duplicata é a marca registrada do estrago: o nome foi escrito por cima de
   * outro, e agora existe duas vezes ou sumiu de vez. */
  var vistos = {}, repetidos = [];
  cab.forEach(function (c) {
    var n = String(c || "").trim();
    if (!n) return;
    if (vistos[n]) { if (repetidos.indexOf(n) === -1) repetidos.push(n); }
    vistos[n] = true;
  });

  var canonicas = VOUCHER_COLUNAS_SOLICITACOES_();
  var ausentes = canonicas.filter(function (h) { return !vistos[h]; });

  Logger.log("");
  Logger.log("cabeçalhos REPETIDOS ..... " + (repetidos.length ? repetidos.join(", ") : "nenhum"));
  Logger.log("cabeçalhos AUSENTES ...... " + (ausentes.length ? ausentes.join(", ") : "nenhum"));
  Logger.log("");
  Logger.log(ausentes.length || repetidos.length
    ? "⚠ A aba está desalinhada. NÃO emitir certificado antes de corrigir."
    : "✓ Nenhum nome ausente nem repetido.");

  return { ok: true, colunas: linhas, repetidos: repetidos, ausentes: ausentes };
}

/**
 * PRÉVIA SEGURA — gera o documento sem emitir, sem salvar PDF e SEM ENVIAR
 * e-mail. Serve para conferir o modelo com dado real antes de valer.
 *
 * POR QUE ELA EXISTE, tendo testeGerarDocumentoVoucher logo abaixo
 *
 * Aquela chama com "CERTIFICADO", e esse caminho não é teste: gera o PDF,
 * grava em Voucher_Emitidos e dispara enviarVoucherAssociado_ e
 * enviarVoucherEscola_ — ou seja, manda e-mail para o associado e para a
 * escola. O nome diz "teste", o efeito é emissão. Rodar por curiosidade
 * custa um voucher indevido na caixa de entrada de alguém.
 *
 * Aqui o tipo é "PREVIA", que retorna o HTML antes de salvar e antes de
 * enviar. Nada sai, nada é gravado.
 *
 * NÃO GRAVAR NÃO É NÃO VAZAR. Escrevi esta função sem trava nenhuma, para
 * rodar pelo botão Run do editor, e o teste de exposição (t6) apontou na
 * mesma hora: ela era a 216ª função que um anônimo alcançava sem login, e o
 * que ela devolve é o documento inteiro de um associado real — nome,
 * protocolo, instituição de ensino. Prévia é leitura, e leitura de dado
 * pessoal também precisa de porta.
 *
 * A trava é a porta dupla: token do SISGEP quando vem da tela, conta Google
 * do dono/administrador quando vem do editor (o botão Run não passa
 * argumento). Anônimo não passa.
 */
function voucherPreviaSegura(tokenSessao) {
  exigirAdminOuSessao_(tokenSessao, "beneficios", "Prévia de voucher", false);

  var lista = listarSolicitacoesVoucher() || [];
  if (!lista.length) {
    Logger.log("Nenhuma solicitação cadastrada. Sem protocolo, não há o que pré-visualizar.");
    return { ok: false, mensagem: "Nenhuma solicitação cadastrada." };
  }

  var s = lista[0];
  Logger.log("Pré-visualizando o protocolo " + s.protocolo +
             "  (status: " + (s.status || "sem status") + ")");

  var r = gerarDocumentoVoucher(s.protocolo, "PREVIA", { percentual: 70 });

  if (!r || r.ok !== true) {
    Logger.log("✗ " + ((r && r.mensagem) || "falhou sem mensagem"));
    return r;
  }

  var h = String(r.html || "");
  Logger.log("═══ PRÉVIA GERADA — NADA FOI EMITIDO NEM ENVIADO ═══");
  Logger.log("tamanho do documento .......... " + h.length + " caracteres");
  Logger.log("assinatura do presidente ...... " + (h.indexOf("height:56px") > -1 ? "presente" : "AUSENTE"));
  Logger.log("instituição de ensino ......... " + (/Instituição de ensino/.test(h) ? "presente" : "vazia no cadastro"));
  Logger.log("documentos conferidos ......... " +
             (/Documentos conferidos/.test(h) ? "APARECENDO — não deveria, na via do aluno" : "oculto (correto)"));
  Logger.log("página A4 em milímetros ....... " + (/min-height:262mm/.test(h) ? "sim" : "NÃO"));
  Logger.log("");
  Logger.log("Para ver o documento: copie o HTML abaixo e abra num navegador.");
  Logger.log(h);
  return r;
}

/* ⚠ ISTO NÃO É TESTE — É EMISSÃO.
 *
 * Chama com "CERTIFICADO", e nesse caminho o código gera o PDF, grava em
 * Voucher_Emitidos e DISPARA E-MAIL para o associado e para a escola. O nome
 * engana. Para conferir o modelo, use voucherPreviaSegura() acima. */
function testeGerarDocumentoVoucher() {
  const lista = listarSolicitacoesVoucher().filter(function(s) {
    return String(s.status || "").toUpperCase() === "APROVADO";
  });

  if (!lista.length) {
    Logger.log("Nenhuma solicitação aprovada.");
    return;
  }

  const res = gerarDocumentoVoucher(lista[0].protocolo, "CERTIFICADO", {
    rg: "1234567",
    percentual: 70,
    documentos: ["Carteira de Identidade", "Contra - cheque"]
  });

  Logger.log("Ok: " + res.ok);
  Logger.log("Código: " + res.codigoValidacao);
  Logger.log("Link: " + res.linkPdf);
}
