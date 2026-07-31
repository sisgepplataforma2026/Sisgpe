// ============================================================================
// MÓDULO: JURÍDICO — Processos, notificações e prazos
// Antes era só localStorage do navegador (achado da auditoria de arquitetura:
// dado de processo com prazo não pode sumir se alguém limpar o cache, nem
// pode ficar visível só pra quem cadastrou). Backend real: planilha, sessão
// obrigatória, exclusão lógica (nunca apaga histórico de processo).
//
// Fase 1 da auditoria estratégica: campos jurídicos mínimos (CNJ, Área,
// Responsável, Autor, Réu) e anexo de documento. Fase 2a: vínculo com
// Associado e Escola (cadastros já existentes no sistema) e e-mail do
// responsável (usado pela notificação automática da Fase 2c). Colunas
// novas foram sempre ACRESCENTADAS no fim do cabeçalho (não reordenadas)
// para não quebrar os registros que já existiam na planilha.
// ============================================================================

var JUR_ABA = "Juridico";

var JUR_CABECALHO = [
  "ID", "Assunto", "Tipo", "Prazo", "Status",
  "Criado Em", "Criado Por", "Atualizado Em", "Atualizado Por", "Ativo",
  "Número CNJ", "Área", "Responsável", "Autor", "Réu",
  "Link Documento", "File ID Documento", "Nome Arquivo",
  "Associado CPF", "Associado Nome", "Escola CNPJ", "Escola Nome", "Responsável E-mail"
];

var JUR_COL = {
  ID: 1,
  ASSUNTO: 2,
  TIPO: 3,
  PRAZO: 4,
  STATUS: 5,
  CRIADO_EM: 6,
  CRIADO_POR: 7,
  ATUALIZADO_EM: 8,
  ATUALIZADO_POR: 9,
  ATIVO: 10,
  NUMERO_CNJ: 11,
  AREA: 12,
  RESPONSAVEL: 13,
  AUTOR: 14,
  REU: 15,
  LINK_DOCUMENTO: 16,
  FILE_ID_DOCUMENTO: 17,
  NOME_ARQUIVO: 18,
  ASSOCIADO_CPF: 19,
  ASSOCIADO_NOME: 20,
  ESCOLA_CNPJ: 21,
  ESCOLA_NOME: 22,
  RESPONSAVEL_EMAIL: 23
};

var JUR_TIPOS = ["Processo", "Notificação", "Contrato", "Consulta"];
var JUR_STATUS = ["Ativo", "Atenção", "Concluído"];
var JUR_AREAS = ["Trabalhista", "Cível", "Administrativo", "Tributário", "Outro"];

function jurObterAba_() {
  var planilha = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = planilha.getSheetByName(JUR_ABA);
  if (!aba) {
    aba = planilha.insertSheet(JUR_ABA);
    aba.getRange(1, 1, 1, JUR_CABECALHO.length).setValues([JUR_CABECALHO]);
    aba.getRange(1, 1, 1, JUR_CABECALHO.length).setFontWeight("bold").setBackground("#001f4d").setFontColor("#ffffff");
    aba.setFrozenRows(1);
  } else if (aba.getLastColumn() < JUR_CABECALHO.length) {
    // Planilha criada antes da Fase 1 (10 colunas) — completa o cabeçalho
    // com as colunas novas sem mexer no que já existia.
    var colunaInicial = aba.getLastColumn() + 1;
    var faltantes = JUR_CABECALHO.slice(aba.getLastColumn());
    aba.getRange(1, colunaInicial, 1, faltantes.length).setValues([faltantes]);
    aba.getRange(1, colunaInicial, 1, faltantes.length).setFontWeight("bold").setBackground("#001f4d").setFontColor("#ffffff");
  }
  // Coluna Prazo precisa ficar como texto puro (ex.: "2026-07-31"). Se o
  // Sheets converter sozinho pra um valor de data, dependendo do idioma da
  // planilha isso pode virar um valor inválido e quebrar a resposta inteira
  // pro navegador (o front recebe null sem erro nenhum).
  aba.getRange(2, JUR_COL.PRAZO, Math.max(aba.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  return aba;
}

// Converte qualquer valor de data (Date real ou serial do Sheets) pra texto
// simples, seguro de serializar na resposta pro navegador. Nunca deixa um
// Date passar puro — se vier inválido, cai pro texto original em vez de
// quebrar a resposta inteira.
function jurTextoSeguro_(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    if (isNaN(valor.getTime())) return "";
    return Utilities.formatDate(valor, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM-dd");
  }
  return valor;
}

function jurComLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error("CONCORRENCIA");
  try { return callback(); } finally { lock.releaseLock(); }
}

function jurGerarId_() {
  return "JUR-" + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function jurMapearLinha_(valores) {
  return {
    id: valores[JUR_COL.ID - 1],
    assunto: valores[JUR_COL.ASSUNTO - 1],
    tipo: valores[JUR_COL.TIPO - 1],
    prazo: jurTextoSeguro_(valores[JUR_COL.PRAZO - 1]),
    status: valores[JUR_COL.STATUS - 1],
    criadoEm: jurTextoSeguro_(valores[JUR_COL.CRIADO_EM - 1]),
    criadoPor: valores[JUR_COL.CRIADO_POR - 1],
    atualizadoEm: jurTextoSeguro_(valores[JUR_COL.ATUALIZADO_EM - 1]),
    atualizadoPor: valores[JUR_COL.ATUALIZADO_POR - 1],
    cnj: valores[JUR_COL.NUMERO_CNJ - 1] || "",
    area: valores[JUR_COL.AREA - 1] || "",
    responsavel: valores[JUR_COL.RESPONSAVEL - 1] || "",
    autor: valores[JUR_COL.AUTOR - 1] || "",
    reu: valores[JUR_COL.REU - 1] || "",
    linkDocumento: valores[JUR_COL.LINK_DOCUMENTO - 1] || "",
    nomeArquivo: valores[JUR_COL.NOME_ARQUIVO - 1] || "",
    associadoCpf: valores[JUR_COL.ASSOCIADO_CPF - 1] || "",
    associadoNome: valores[JUR_COL.ASSOCIADO_NOME - 1] || "",
    escolaCnpj: valores[JUR_COL.ESCOLA_CNPJ - 1] || "",
    escolaNome: valores[JUR_COL.ESCOLA_NOME - 1] || "",
    responsavelEmail: valores[JUR_COL.RESPONSAVEL_EMAIL - 1] || ""
  };
}

function jurBuscarLinhaPorId_(aba, id) {
  var ultimaLinha = aba.getLastRow();
  if (ultimaLinha < 2) return null;
  var dados = aba.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO.length).getValues();
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i][JUR_COL.ID - 1]) === String(id)) {
      return { linha: i + 2, valores: dados[i] };
    }
  }
  return null;
}

// Pasta do Drive dedicada aos anexos do Jurídico, seguindo o mesmo padrão
// usado em Despesas (obterPastaDesp_): reaproveita se já existir, cria
// dentro da pasta-mãe dos Ofícios na primeira vez e guarda o ID.
function jurObterPastaAnexos_() {
  var props = PropertiesService.getScriptProperties();
  var pastaId = (props.getProperty("PASTA_JURIDICO_ID") || "").trim();

  if (pastaId) {
    try {
      return obterOuCriarSubpastaAno(pastaId);
    } catch (e) {
      Logger.log("jurObterPastaAnexos_: PASTA_JURIDICO_ID configurado (" + pastaId + ") inválido/inacessível — recriando. " + e.message);
    }
  }

  var parentId = "";
  try { parentId = PASTA_OFICIOS_ID; } catch (e) {}
  if (!parentId) throw new Error("Não foi possível determinar uma pasta-mãe para criar a pasta do Jurídico.");

  var parent = DriveApp.getFolderById(parentId);
  var pastasJuridico = parent.getFoldersByName("Juridico");
  var pastaJuridico = pastasJuridico.hasNext() ? pastasJuridico.next() : parent.createFolder("Juridico");
  props.setProperty("PASTA_JURIDICO_ID", pastaJuridico.getId());

  return obterOuCriarSubpastaAno(pastaJuridico.getId());
}

// ----------------------------------------------------------------------------
// FUNÇÕES PÚBLICAS — chamadas pela tela
// ----------------------------------------------------------------------------

function jurListarProcessos(tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    var aba = jurObterAba_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: true, itens: [] };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO.length).getValues();
    var itens = dados
      .filter(function(linha) { return String(linha[JUR_COL.ATIVO - 1] || "SIM") !== "NAO"; })
      .map(jurMapearLinha_);

    itens.sort(function(a, b) {
      return new Date(b.atualizadoEm || b.criadoEm) - new Date(a.atualizadoEm || a.criadoEm);
    });

    Logger.log("jurListarProcessos OK: " + itens.length + " itens");
    return { ok: true, itens: itens };
  } catch (e) {
    Logger.log("jurListarProcessos ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro desconhecido ao listar." };
  }
}

function jurSalvarProcesso(dados, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    dados = dados || {};
    var responsavelSessao = sessao.nome || sessao.usuario || sessao.email;

    var assunto = String(dados.assunto || "").trim();
    if (!assunto) return { ok: false, mensagem: "Informe o assunto." };

    var tipo = JUR_TIPOS.indexOf(dados.tipo) > -1 ? dados.tipo : JUR_TIPOS[0];
    var status = JUR_STATUS.indexOf(dados.status) > -1 ? dados.status : JUR_STATUS[0];
    var area = JUR_AREAS.indexOf(dados.area) > -1 ? dados.area : "";
    var prazo = String(dados.prazo || "").trim();
    var cnj = String(dados.cnj || "").trim();
    var responsavel = String(dados.responsavel || "").trim();
    var autor = String(dados.autor || "").trim();
    var reu = String(dados.reu || "").trim();
    var associadoCpf = String(dados.associadoCpf || "").trim();
    var associadoNome = String(dados.associadoNome || "").trim();
    var escolaCnpj = String(dados.escolaCnpj || "").trim();
    var escolaNome = String(dados.escolaNome || "").trim();
    var responsavelEmail = String(dados.responsavelEmail || "").trim();

    return jurComLock_(function() {
      var aba = jurObterAba_();
      var agora = new Date();

      if (dados.id) {
        var encontrada = jurBuscarLinhaPorId_(aba, dados.id);
        if (!encontrada) return { ok: false, mensagem: "Registro não encontrado." };

        aba.getRange(encontrada.linha, JUR_COL.ASSUNTO).setValue(assunto);
        aba.getRange(encontrada.linha, JUR_COL.TIPO).setValue(tipo);
        aba.getRange(encontrada.linha, JUR_COL.PRAZO).setValue(prazo);
        aba.getRange(encontrada.linha, JUR_COL.STATUS).setValue(status);
        aba.getRange(encontrada.linha, JUR_COL.NUMERO_CNJ).setValue(cnj);
        aba.getRange(encontrada.linha, JUR_COL.AREA).setValue(area);
        aba.getRange(encontrada.linha, JUR_COL.RESPONSAVEL).setValue(responsavel);
        aba.getRange(encontrada.linha, JUR_COL.AUTOR).setValue(autor);
        aba.getRange(encontrada.linha, JUR_COL.REU).setValue(reu);
        aba.getRange(encontrada.linha, JUR_COL.ASSOCIADO_CPF).setValue(associadoCpf);
        aba.getRange(encontrada.linha, JUR_COL.ASSOCIADO_NOME).setValue(associadoNome);
        aba.getRange(encontrada.linha, JUR_COL.ESCOLA_CNPJ).setValue(escolaCnpj);
        aba.getRange(encontrada.linha, JUR_COL.ESCOLA_NOME).setValue(escolaNome);
        aba.getRange(encontrada.linha, JUR_COL.RESPONSAVEL_EMAIL).setValue(responsavelEmail);
        aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_EM).setValue(agora);
        aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_POR).setValue(responsavelSessao);

        Logger.log("jurSalvarProcesso OK: atualizado " + dados.id);
        return { ok: true, id: dados.id };
      }

      var id = jurGerarId_();
      var linha = new Array(JUR_CABECALHO.length).fill("");
      linha[JUR_COL.ID - 1] = id;
      linha[JUR_COL.ASSUNTO - 1] = assunto;
      linha[JUR_COL.TIPO - 1] = tipo;
      linha[JUR_COL.PRAZO - 1] = prazo;
      linha[JUR_COL.STATUS - 1] = status;
      linha[JUR_COL.CRIADO_EM - 1] = agora;
      linha[JUR_COL.CRIADO_POR - 1] = responsavelSessao;
      linha[JUR_COL.ATUALIZADO_EM - 1] = agora;
      linha[JUR_COL.ATUALIZADO_POR - 1] = responsavelSessao;
      linha[JUR_COL.ATIVO - 1] = "SIM";
      linha[JUR_COL.NUMERO_CNJ - 1] = cnj;
      linha[JUR_COL.AREA - 1] = area;
      linha[JUR_COL.RESPONSAVEL - 1] = responsavel;
      linha[JUR_COL.AUTOR - 1] = autor;
      linha[JUR_COL.REU - 1] = reu;
      linha[JUR_COL.ASSOCIADO_CPF - 1] = associadoCpf;
      linha[JUR_COL.ASSOCIADO_NOME - 1] = associadoNome;
      linha[JUR_COL.ESCOLA_CNPJ - 1] = escolaCnpj;
      linha[JUR_COL.ESCOLA_NOME - 1] = escolaNome;
      linha[JUR_COL.RESPONSAVEL_EMAIL - 1] = responsavelEmail;

      aba.appendRow(linha);
      Logger.log("jurSalvarProcesso OK: criado " + id);
      return { ok: true, id: id };
    });
  } catch (e) {
    Logger.log("jurSalvarProcesso ERRO: " + e.message + " | stack: " + e.stack);
    var mensagem = e.message === "CONCORRENCIA"
      ? "Outra pessoa está salvando um registro agora. Tente novamente em instantes."
      : (e.message || "Erro desconhecido ao salvar.");
    return { ok: false, mensagem: mensagem };
  }
}

// Exclusão lógica — nunca apaga a linha de verdade. Processo/notificação
// jurídica é registro que precisa continuar existindo pra auditoria mesmo
// depois de "removido" da lista.
function jurExcluirProcesso(id, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    return jurComLock_(function() {
      var aba = jurObterAba_();
      var encontrada = jurBuscarLinhaPorId_(aba, id);
      if (!encontrada) return { ok: false, mensagem: "Registro não encontrado." };

      aba.getRange(encontrada.linha, JUR_COL.ATIVO).setValue("NAO");
      aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_EM).setValue(new Date());
      aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_POR).setValue(responsavel);

      Logger.log("jurExcluirProcesso OK: " + id);
      return { ok: true };
    });
  } catch (e) {
    Logger.log("jurExcluirProcesso ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro desconhecido ao excluir." };
  }
}

// Anexa um único documento (petição, sentença, notificação...) a um
// processo já existente. Segue o mesmo padrão de upload usado em Despesas:
// base64 vindo do cliente vira arquivo real no Drive, só o link fica na
// planilha.
function jurUploadDocumento(dados, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    dados = dados || {};

    var idProcesso = String(dados.idProcesso || "").trim();
    var base64 = String(dados.base64 || "").trim();
    var nomeArq = String(dados.nome || "documento.pdf").trim();
    var tipoArq = String(dados.tipo || "application/pdf").trim();

    if (!idProcesso) return { ok: false, mensagem: "Processo não informado." };
    if (!base64) return { ok: false, mensagem: "Nenhum arquivo recebido." };

    var TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (TIPOS_ACEITOS.indexOf(tipoArq) === -1) {
      return { ok: false, mensagem: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." };
    }

    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    return jurComLock_(function() {
      var aba = jurObterAba_();
      var encontrada = jurBuscarLinhaPorId_(aba, idProcesso);
      if (!encontrada) return { ok: false, mensagem: "Processo não encontrado." };

      var bytes = Utilities.base64Decode(base64);
      if (bytes.length > 10 * 1024 * 1024) {
        return { ok: false, mensagem: "Arquivo maior que 10MB." };
      }

      var nomeFinal = "JUR_" + idProcesso + "_" + nomeArq.replace(/[^a-zA-Z0-9._À-ÿ-]/g, "_");
      var blob = Utilities.newBlob(bytes, tipoArq, nomeFinal);
      var pasta = jurObterPastaAnexos_();
      var arquivo = pasta.createFile(blob);
      try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eShare) {}

      var link = "https://drive.google.com/file/d/" + arquivo.getId() + "/view";

      aba.getRange(encontrada.linha, JUR_COL.LINK_DOCUMENTO).setValue(link);
      aba.getRange(encontrada.linha, JUR_COL.FILE_ID_DOCUMENTO).setValue(arquivo.getId());
      aba.getRange(encontrada.linha, JUR_COL.NOME_ARQUIVO).setValue(nomeArq);
      aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_EM).setValue(new Date());
      aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_POR).setValue(responsavel);

      Logger.log("jurUploadDocumento OK: " + idProcesso + " -> " + arquivo.getId());
      return { ok: true, link: link, nome: nomeArq };
    });
  } catch (e) {
    Logger.log("jurUploadDocumento ERRO: " + e.message + " | stack: " + e.stack);
    var mensagem = e.message === "CONCORRENCIA"
      ? "Outra pessoa está salvando um registro agora. Tente novamente em instantes."
      : (e.message || "Erro desconhecido ao enviar o anexo.");
    return { ok: false, mensagem: mensagem };
  }
}

// ----------------------------------------------------------------------------
// FASE 2a — Vínculo com Associado e Escola
//
// Reaproveita a aba "Associados" já mantida por Sindicalizacao (mesma
// planilha central) em vez de duplicar cadastro. Importante: a aba Escolas
// (usada em Ofícios, por CNPJ) e a aba Associados (que guarda "Nome
// fantasia" da instituição de ensino) usam vocabulários DIFERENTES — não dá
// pra derivar um a partir do outro, por isso o Jurídico deixa buscar os
// dois separadamente e vincula ambos quando fizer sentido (ex.: processo de
// um associado específico x TAC com uma escola inteira).
// ----------------------------------------------------------------------------

function jurBuscarAssociado(termo, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    termo = String(termo || "").trim().toLowerCase();
    if (termo.length < 2) return { ok: true, itens: [] };

    var aba = sindAss_aba_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: true, itens: [] };

    var mapa = sindAss_mapaCabecalho_(aba);
    var colNome = mapa["NOME"];
    var colCpf = mapa["CPF"];
    var colEscola = mapa["NOME FANTASIA"];
    if (colNome === undefined || colCpf === undefined) {
      throw new Error("Cabeçalho da aba Associados não tem as colunas Nome/CPF esperadas.");
    }

    var termoDigitos = termo.replace(/\D/g, "");
    var dados = aba.getRange(2, 1, ultimaLinha - 1, aba.getLastColumn()).getValues();
    var itens = [];
    for (var i = 0; i < dados.length && itens.length < 15; i++) {
      var nome = String(dados[i][colNome] || "");
      var cpf = String(dados[i][colCpf] || "");
      var bateNome = nome.toLowerCase().indexOf(termo) >= 0;
      var bateCpf = termoDigitos.length >= 3 && cpf.replace(/\D/g, "").indexOf(termoDigitos) >= 0;
      if (!bateNome && !bateCpf) continue;
      itens.push({
        nome: nome,
        cpf: cpf,
        escola: colEscola !== undefined ? String(dados[i][colEscola] || "") : ""
      });
    }

    return { ok: true, itens: itens };
  } catch (e) {
    Logger.log("jurBuscarAssociado ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao buscar associado." };
  }
}

// Wrapper com sessão em cima de buscarEscola() (BuscaEscola.gs), que já é a
// busca de escolas usada em Ofícios (por razão social/CNPJ/cidade).
function jurBuscarEscolaVinculo(termo, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    var resultado = buscarEscola(termo) || [];
    return { ok: true, itens: resultado };
  } catch (e) {
    Logger.log("jurBuscarEscolaVinculo ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao buscar escola." };
  }
}
