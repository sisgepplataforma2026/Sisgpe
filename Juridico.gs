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
  "Associado CPF", "Associado Nome", "Escola CNPJ", "Escola Nome", "Responsável E-mail",
  "Valor da Causa", "Resultado"
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
  RESPONSAVEL_EMAIL: 23,
  VALOR_CAUSA: 24,
  RESULTADO: 25
};

var JUR_TIPOS = ["Processo", "Notificação", "Contrato", "Consulta"];
var JUR_STATUS = ["Ativo", "Atenção", "Concluído"];
var JUR_AREAS = ["Trabalhista", "Cível", "Administrativo", "Tributário", "Outro"];
var JUR_RESULTADOS = ["Em andamento", "Favorável", "Desfavorável", "Parcial", "Acordo"];

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
function jurTextoSeguro_(valor, formato) {
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    if (isNaN(valor.getTime())) return "";
    return Utilities.formatDate(valor, Session.getScriptTimeZone() || "America/Sao_Paulo", formato || "yyyy-MM-dd");
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
    responsavelEmail: valores[JUR_COL.RESPONSAVEL_EMAIL - 1] || "",
    valorCausa: valores[JUR_COL.VALOR_CAUSA - 1] || "",
    resultado: valores[JUR_COL.RESULTADO - 1] || ""
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
    var valorCausa = Number(String(dados.valorCausa || "").replace(/\./g, "").replace(",", ".")) || 0;
    var resultado = JUR_RESULTADOS.indexOf(dados.resultado) > -1 ? dados.resultado : JUR_RESULTADOS[0];

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
        aba.getRange(encontrada.linha, JUR_COL.VALOR_CAUSA).setValue(valorCausa);
        aba.getRange(encontrada.linha, JUR_COL.RESULTADO).setValue(resultado);
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
      linha[JUR_COL.VALOR_CAUSA - 1] = valorCausa;
      linha[JUR_COL.RESULTADO - 1] = resultado;

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

// Remove o anexo do processo: manda o arquivo pra lixeira do Drive (não
// apaga de vez — dá pra restaurar se for engano) e limpa os campos de
// link/nome na planilha.
function jurExcluirAnexo(idProcesso, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    idProcesso = String(idProcesso || "").trim();
    if (!idProcesso) return { ok: false, mensagem: "Processo não informado." };

    return jurComLock_(function() {
      var aba = jurObterAba_();
      var encontrada = jurBuscarLinhaPorId_(aba, idProcesso);
      if (!encontrada) return { ok: false, mensagem: "Processo não encontrado." };

      var fileId = String(encontrada.valores[JUR_COL.FILE_ID_DOCUMENTO - 1] || "").trim();
      if (fileId) {
        try { DriveApp.getFileById(fileId).setTrashed(true); } catch (eTrash) {
          Logger.log("jurExcluirAnexo: não consegui mover pra lixeira (" + fileId + "): " + eTrash.message);
        }
      }

      aba.getRange(encontrada.linha, JUR_COL.LINK_DOCUMENTO).setValue("");
      aba.getRange(encontrada.linha, JUR_COL.FILE_ID_DOCUMENTO).setValue("");
      aba.getRange(encontrada.linha, JUR_COL.NOME_ARQUIVO).setValue("");
      aba.getRange(encontrada.linha, JUR_COL.ATUALIZADO_EM).setValue(new Date());

      Logger.log("jurExcluirAnexo OK: " + idProcesso);
      return { ok: true };
    });
  } catch (e) {
    Logger.log("jurExcluirAnexo ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao excluir anexo." };
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

// ============================================================================
// FASE 2b — Múltiplos prazos e audiências por processo
//
// O campo "Prazo" da aba principal continua existindo (é o alerta rápido
// que já alimenta os cards do dashboard) — ele passa a representar só o
// PRÓXIMO prazo mais urgente. A vida real de um processo tem vários prazos
// ao longo do tempo (contestação, recurso, embargos...) e pode ter várias
// audiências marcadas — por isso viram abas próprias, ligadas por
// ID_Processo, em vez de forçar tudo dentro de uma linha só.
// ============================================================================

var JUR_ABA_PRAZOS = "Juridico_Prazos";
var JUR_CABECALHO_PRAZOS = ["ID", "ID Processo", "Descrição", "Data", "Cumprido", "Criado Em", "Criado Por", "Data Último Alerta"];
var JUR_COLP = { ID: 1, ID_PROCESSO: 2, DESCRICAO: 3, DATA: 4, CUMPRIDO: 5, CRIADO_EM: 6, CRIADO_POR: 7, DATA_ULTIMO_ALERTA: 8 };

var JUR_ABA_AUDIENCIAS = "Juridico_Audiencias";
var JUR_CABECALHO_AUDIENCIAS = ["ID", "ID Processo", "Data", "Hora", "Tipo", "Local", "Observação", "Criado Em", "Criado Por"];
var JUR_COLA = { ID: 1, ID_PROCESSO: 2, DATA: 3, HORA: 4, TIPO: 5, LOCAL: 6, OBSERVACAO: 7, CRIADO_EM: 8, CRIADO_POR: 9 };

// colunasTexto: lista de colunas (data/hora) que o Sheets NÃO pode converter
// sozinho pro tipo dele — mesmo problema que já pegamos no campo Prazo
// (BuscarAssociado/data/hora viravam valor de data/hora, às vezes inválido,
// e quebravam a resposta inteira pro navegador sem erro nenhum).
function jurObterAbaGenerica_(nomeAba, cabecalho, colunasTexto) {
  var planilha = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = planilha.getSheetByName(nomeAba);
  if (!aba) {
    aba = planilha.insertSheet(nomeAba);
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
    aba.getRange(1, 1, 1, cabecalho.length).setFontWeight("bold").setBackground("#001f4d").setFontColor("#ffffff");
    aba.setFrozenRows(1);
  } else if (aba.getLastColumn() < cabecalho.length) {
    // Aba criada antes de alguma coluna nova existir — completa o
    // cabeçalho sem mexer no que já tinha (mesmo padrão da aba principal).
    var colunaInicial = aba.getLastColumn() + 1;
    var faltantes = cabecalho.slice(aba.getLastColumn());
    aba.getRange(1, colunaInicial, 1, faltantes.length).setValues([faltantes]);
    aba.getRange(1, colunaInicial, 1, faltantes.length).setFontWeight("bold").setBackground("#001f4d").setFontColor("#ffffff");
  }
  (colunasTexto || []).forEach(function(col) {
    aba.getRange(2, col, Math.max(aba.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  });
  return aba;
}

function jurObterAbaPrazos_() {
  return jurObterAbaGenerica_(JUR_ABA_PRAZOS, JUR_CABECALHO_PRAZOS, [JUR_COLP.DATA, JUR_COLP.DATA_ULTIMO_ALERTA]);
}

function jurObterAbaAudiencias_() {
  return jurObterAbaGenerica_(JUR_ABA_AUDIENCIAS, JUR_CABECALHO_AUDIENCIAS, [JUR_COLA.DATA, JUR_COLA.HORA]);
}

function jurListarPrazos(idProcesso, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    idProcesso = String(idProcesso || "").trim();
    if (!idProcesso) return { ok: false, mensagem: "Processo não informado." };

    var aba = jurObterAbaPrazos_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: true, itens: [] };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO_PRAZOS.length).getValues();
    var itens = dados
      .filter(function(l) { return String(l[JUR_COLP.ID_PROCESSO - 1]) === idProcesso; })
      .map(function(l) {
        return {
          id: l[JUR_COLP.ID - 1],
          descricao: l[JUR_COLP.DESCRICAO - 1],
          data: jurTextoSeguro_(l[JUR_COLP.DATA - 1]),
          cumprido: String(l[JUR_COLP.CUMPRIDO - 1] || "NAO") === "SIM"
        };
      });

    itens.sort(function(a, b) { return new Date(a.data || "9999-12-31") - new Date(b.data || "9999-12-31"); });
    return { ok: true, itens: itens };
  } catch (e) {
    Logger.log("jurListarPrazos ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao listar prazos." };
  }
}

function jurSalvarPrazo(dados, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    dados = dados || {};
    var idProcesso = String(dados.idProcesso || "").trim();
    var descricao = String(dados.descricao || "").trim();
    var data = String(dados.data || "").trim();
    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    if (!idProcesso) return { ok: false, mensagem: "Processo não informado." };
    if (!descricao) return { ok: false, mensagem: "Informe a descrição do prazo." };
    if (!data) return { ok: false, mensagem: "Informe a data do prazo." };

    return jurComLock_(function() {
      var aba = jurObterAbaPrazos_();

      if (dados.id) {
        var ultimaLinha = aba.getLastRow();
        var linhaAlvo = -1;
        if (ultimaLinha >= 2) {
          var todos = aba.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO_PRAZOS.length).getValues();
          for (var i = 0; i < todos.length; i++) {
            if (String(todos[i][JUR_COLP.ID - 1]) === String(dados.id)) { linhaAlvo = i + 2; break; }
          }
        }
        if (linhaAlvo === -1) return { ok: false, mensagem: "Prazo não encontrado." };

        aba.getRange(linhaAlvo, JUR_COLP.DESCRICAO).setValue(descricao);
        aba.getRange(linhaAlvo, JUR_COLP.DATA).setValue(data);
        aba.getRange(linhaAlvo, JUR_COLP.CUMPRIDO).setValue(dados.cumprido ? "SIM" : "NAO");
        return { ok: true, id: dados.id };
      }

      var id = "PRZ-" + Utilities.getUuid().slice(0, 8).toUpperCase();
      aba.appendRow([id, idProcesso, descricao, data, "NAO", new Date(), responsavel]);
      return { ok: true, id: id };
    });
  } catch (e) {
    Logger.log("jurSalvarPrazo ERRO: " + e.message + " | stack: " + e.stack);
    var mensagem = e.message === "CONCORRENCIA" ? "Outra pessoa está salvando agora. Tente novamente." : (e.message || "Erro ao salvar prazo.");
    return { ok: false, mensagem: mensagem };
  }
}

// Prazo é item auxiliar do processo (não o registro jurídico principal),
// então aqui a exclusão é física mesmo — serve pra corrigir um lançamento
// errado. O que marca o desfecho de verdade é o campo "Cumprido".
function jurExcluirPrazo(id, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    return jurComLock_(function() {
      var aba = jurObterAbaPrazos_();
      var ultimaLinha = aba.getLastRow();
      if (ultimaLinha < 2) return { ok: false, mensagem: "Prazo não encontrado." };
      var dados = aba.getRange(2, 1, ultimaLinha - 1, 1).getValues();
      for (var i = 0; i < dados.length; i++) {
        if (String(dados[i][0]) === String(id)) {
          aba.deleteRow(i + 2);
          return { ok: true };
        }
      }
      return { ok: false, mensagem: "Prazo não encontrado." };
    });
  } catch (e) {
    Logger.log("jurExcluirPrazo ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao excluir prazo." };
  }
}

// Só alterna Cumprido, sem tocar em descrição/data — usado pelo checkbox
// da lista de prazos (evita ter que reenviar o registro inteiro pra marcar
// como feito).
function jurMarcarPrazo(id, cumprido, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    return jurComLock_(function() {
      var aba = jurObterAbaPrazos_();
      var ultimaLinha = aba.getLastRow();
      if (ultimaLinha < 2) return { ok: false, mensagem: "Prazo não encontrado." };
      var dados = aba.getRange(2, 1, ultimaLinha - 1, 1).getValues();
      for (var i = 0; i < dados.length; i++) {
        if (String(dados[i][0]) === String(id)) {
          aba.getRange(i + 2, JUR_COLP.CUMPRIDO).setValue(cumprido ? "SIM" : "NAO");
          return { ok: true };
        }
      }
      return { ok: false, mensagem: "Prazo não encontrado." };
    });
  } catch (e) {
    Logger.log("jurMarcarPrazo ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao atualizar prazo." };
  }
}

function jurListarAudiencias(idProcesso, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    idProcesso = String(idProcesso || "").trim();
    if (!idProcesso) return { ok: false, mensagem: "Processo não informado." };

    var aba = jurObterAbaAudiencias_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: true, itens: [] };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO_AUDIENCIAS.length).getValues();
    var itens = dados
      .filter(function(l) { return String(l[JUR_COLA.ID_PROCESSO - 1]) === idProcesso; })
      .map(function(l) {
        return {
          id: l[JUR_COLA.ID - 1],
          data: jurTextoSeguro_(l[JUR_COLA.DATA - 1]),
          hora: jurTextoSeguro_(l[JUR_COLA.HORA - 1], "HH:mm") || "",
          tipo: l[JUR_COLA.TIPO - 1] || "",
          local: l[JUR_COLA.LOCAL - 1] || "",
          observacao: l[JUR_COLA.OBSERVACAO - 1] || ""
        };
      });

    itens.sort(function(a, b) { return new Date(a.data || "9999-12-31") - new Date(b.data || "9999-12-31"); });
    return { ok: true, itens: itens };
  } catch (e) {
    Logger.log("jurListarAudiencias ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao listar audiências." };
  }
}

function jurSalvarAudiencia(dados, tokenSessao) {
  try {
    var sessao = exigirSessaoDocumentos_(tokenSessao, false);
    dados = dados || {};
    var idProcesso = String(dados.idProcesso || "").trim();
    var data = String(dados.data || "").trim();
    var hora = String(dados.hora || "").trim();
    var tipo = String(dados.tipo || "").trim();
    var local = String(dados.local || "").trim();
    var observacao = String(dados.observacao || "").trim();
    var responsavel = sessao.nome || sessao.usuario || sessao.email;

    if (!idProcesso) return { ok: false, mensagem: "Processo não informado." };
    if (!data) return { ok: false, mensagem: "Informe a data da audiência." };

    return jurComLock_(function() {
      var aba = jurObterAbaAudiencias_();
      var id = "AUD-" + Utilities.getUuid().slice(0, 8).toUpperCase();
      aba.appendRow([id, idProcesso, data, hora, tipo, local, observacao, new Date(), responsavel]);
      return { ok: true, id: id };
    });
  } catch (e) {
    Logger.log("jurSalvarAudiencia ERRO: " + e.message + " | stack: " + e.stack);
    var mensagem = e.message === "CONCORRENCIA" ? "Outra pessoa está salvando agora. Tente novamente." : (e.message || "Erro ao salvar audiência.");
    return { ok: false, mensagem: mensagem };
  }
}

function jurExcluirAudiencia(id, tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);
    return jurComLock_(function() {
      var aba = jurObterAbaAudiencias_();
      var ultimaLinha = aba.getLastRow();
      if (ultimaLinha < 2) return { ok: false, mensagem: "Audiência não encontrada." };
      var dados = aba.getRange(2, 1, ultimaLinha - 1, 1).getValues();
      for (var i = 0; i < dados.length; i++) {
        if (String(dados[i][0]) === String(id)) {
          aba.deleteRow(i + 2);
          return { ok: true };
        }
      }
      return { ok: false, mensagem: "Audiência não encontrada." };
    });
  } catch (e) {
    Logger.log("jurExcluirAudiencia ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao excluir audiência." };
  }
}

// ============================================================================
// FASE 2c — Notificação automática de prazo por e-mail (D-15/D-5/D-1)
//
// Mesmo padrão de verificarEDispararAlertasD5 (Despesas.gs): um gatilho
// diário varre os prazos em aberto, dispara e-mail nos marcos [15,5,1] dias
// antes do vencimento, e marca a data do último alerta pra nunca mandar
// duas vezes no mesmo dia. O destinatário é o "Responsável E-mail"
// cadastrado no processo (Fase 2a) — sem e-mail cadastrado, o prazo
// continua aparecendo no dashboard, só não gera notificação.
// ============================================================================

function jurVerificarEDispararAlertasPrazo() {
  try {
    Logger.log("▶ jurVerificarEDispararAlertasPrazo iniciado.");

    var abaPrazos = jurObterAbaPrazos_();
    var ultimaLinha = abaPrazos.getLastRow();
    if (ultimaLinha < 2) { Logger.log("jurVerificarEDispararAlertasPrazo: sem prazos cadastrados."); return; }

    var dadosPrazos = abaPrazos.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO_PRAZOS.length).getValues();
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    var marcos = [15, 5, 1];
    var enviados = 0, ignorados = 0;

    for (var i = 0; i < dadosPrazos.length; i++) {
      var linha = dadosPrazos[i];
      var cumprido = String(linha[JUR_COLP.CUMPRIDO - 1] || "NAO") === "SIM";
      if (cumprido) { ignorados++; continue; }

      var dataTexto = jurTextoSeguro_(linha[JUR_COLP.DATA - 1]);
      if (!dataTexto) { ignorados++; continue; }
      var dataPrazo = new Date(dataTexto + "T00:00:00");
      if (isNaN(dataPrazo.getTime())) { ignorados++; continue; }

      var diffDias = Math.round((dataPrazo - hoje) / 86400000);
      if (marcos.indexOf(diffDias) === -1) { ignorados++; continue; }

      var ultimoAlerta = jurTextoSeguro_(linha[JUR_COLP.DATA_ULTIMO_ALERTA - 1]);
      var hojeTexto = Utilities.formatDate(hoje, Session.getScriptTimeZone() || "America/Sao_Paulo", "yyyy-MM-dd");
      if (ultimoAlerta === hojeTexto) { ignorados++; continue; }

      var idProcesso = String(linha[JUR_COLP.ID_PROCESSO - 1] || "").trim();
      var processo = jurBuscarProcessoParaAlerta_(idProcesso);
      if (!processo || !processo.email) { ignorados++; continue; }

      var enviouOk = jurEnviarEmailAlertaPrazo_(processo, String(linha[JUR_COLP.DESCRICAO - 1] || ""), dataTexto, diffDias);
      if (enviouOk) {
        abaPrazos.getRange(i + 2, JUR_COLP.DATA_ULTIMO_ALERTA).setValue(hojeTexto);
        enviados++;
      } else {
        ignorados++;
      }
    }

    Logger.log("✅ jurVerificarEDispararAlertasPrazo: enviados=" + enviados + " ignorados=" + ignorados);
  } catch (e) {
    Logger.log("❌ jurVerificarEDispararAlertasPrazo ERRO: " + e.message + " | stack: " + e.stack);
  }
}

function jurBuscarProcessoParaAlerta_(idProcesso) {
  if (!idProcesso) return null;
  var aba = jurObterAba_();
  var encontrada = jurBuscarLinhaPorId_(aba, idProcesso);
  if (!encontrada) return null;
  var v = encontrada.valores;
  return {
    assunto: v[JUR_COL.ASSUNTO - 1] || "",
    cnj: v[JUR_COL.NUMERO_CNJ - 1] || "",
    responsavel: v[JUR_COL.RESPONSAVEL - 1] || "",
    email: String(v[JUR_COL.RESPONSAVEL_EMAIL - 1] || "").trim()
  };
}

function jurEnviarEmailAlertaPrazo_(processo, descricaoPrazo, dataTexto, diffDias) {
  try {
    var partesData = dataTexto.split("-");
    var dataBr = partesData.length === 3 ? (partesData[2] + "/" + partesData[1] + "/" + partesData[0]) : dataTexto;
    var urgencia = diffDias <= 1 ? "AMANHÃ" : ("em " + diffDias + " dias");
    var assunto = "⚖ Prazo jurídico vence " + urgencia + " — " + processo.assunto;

    MailApp.sendEmail({
      to: processo.email,
      subject: assunto,
      htmlBody: jurMontarHtmlAlertaPrazo_(processo, descricaoPrazo, dataBr, diffDias),
      name: "SISGEP · Jurídico — SindEducação-ES"
    });
    return true;
  } catch (e) {
    Logger.log("jurEnviarEmailAlertaPrazo_ ERRO (" + processo.email + "): " + e.message);
    return false;
  }
}

// Mesmo padrão visual usado em todos os e-mails automáticos do SISGEP
// (ver montarHtmlAlertaD5Fornecedor_ em Despesas.gs): cabeçalho navy com
// SINDEDUCAÇÃO-ES, barra colorida por urgência, tabela de dados, rodapé.
// Só o conteúdo muda por módulo — o layout é sempre o mesmo, pra quem
// recebe reconhecer de cara que é um alerta oficial do sistema.
function jurMontarHtmlAlertaPrazo_(processo, descricaoPrazo, dataBr, diffDias) {
  var emoji, titulo, subtitulo, corBarra;
  if (diffDias <= 1) {
    emoji = "🔔"; corBarra = "#dc2626";
    titulo = "AMANHÃ: Prazo Jurídico Vence";
    subtitulo = "O prazo abaixo vence <strong>amanhã</strong> (" + dataBr + ").";
  } else if (diffDias <= 5) {
    emoji = "⏰"; corBarra = "#d97706";
    titulo = "Prazo Jurídico Próximo";
    subtitulo = "O prazo abaixo vence em <strong>" + diffDias + " dias</strong> (" + dataBr + ").";
  } else {
    emoji = "📋"; corBarra = "#1565C0";
    titulo = "Lembrete de Prazo Jurídico";
    subtitulo = "O prazo abaixo vence em <strong>" + diffDias + " dias</strong> (" + dataBr + ").";
  }
  var saudacao = processo.responsavel ? ("Olá, <strong>" + processo.responsavel + "</strong>! ") : "";

  return (
    '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a;">' +
      '<div style="background:#001f4d;padding:20px 28px 16px;border-radius:12px 12px 0 0;border-bottom:4px solid ' + corBarra + ';">' +
        '<div style="font-size:20px;font-weight:900;color:#fff;">SINDEDUCAÇÃO-ES</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px;">Sistema de Gestão de Processos — SISGEP</div>' +
      '</div>' +
      '<div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:24px 28px;">' +
        '<h2 style="color:#001f4d;margin:0 0 8px;">' + emoji + ' ' + titulo + '</h2>' +
        '<p style="color:#475569;margin:0 0 20px;line-height:1.7;">' + saudacao + subtitulo + '</p>' +
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ' + corBarra + ';border-radius:10px;padding:16px 18px;margin-bottom:20px;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
            '<tr><td style="padding:5px 0;font-weight:700;width:130px;">Prazo:</td><td>' + descricaoPrazo + '</td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Vencimento:</td><td><strong style="font-size:16px;">' + dataBr + '</strong></td></tr>' +
            '<tr><td style="padding:5px 0;font-weight:700;">Processo:</td><td>' + processo.assunto + '</td></tr>' +
            (processo.cnj ? '<tr><td style="padding:5px 0;font-weight:700;">Nº CNJ:</td><td>' + processo.cnj + '</td></tr>' : '') +
            (processo.responsavel ? '<tr><td style="padding:5px 0;font-weight:700;">Responsável:</td><td>' + processo.responsavel + '</td></tr>' : '') +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div style="background:#001f4d;padding:14px 28px;border-radius:0 0 12px 12px;text-align:center;">' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);">SISGEP · SindEducação-ES · Módulo Jurídico</div>' +
      '</div>' +
    '</div>'
  );
}

function jurInstalarTriggerAlertasPrazo() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "jurVerificarEDispararAlertasPrazo") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("jurVerificarEDispararAlertasPrazo").timeBased().everyDays(1).atHour(8).create();
  Logger.log("✅ Trigger de alerta de prazo do Jurídico instalado — executa diariamente às 8h.");
  return { ok: true, mensagem: "Trigger instalado com sucesso — executa diariamente às 8h." };
}

function jurRemoverTriggerAlertasPrazo() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "jurVerificarEDispararAlertasPrazo") { ScriptApp.deleteTrigger(t); Logger.log("Trigger de alerta de prazo do Jurídico removido."); }
  });
  return { ok: true, mensagem: "Trigger removido." };
}

// ============================================================================
// FASE 3a — Leitura de intimação/petição por IA (Sofia)
//
// Mesmo padrão de IA_DocumentosSindicalizacao.gs: OCR do Drive
// (docIA_ocrParaTexto_) + IA devolvendo JSON estruturado
// (docIA_extrairJSON_). REGRA DE OURO igual lá: esta função só LÊ e
// SUGERE — nada é gravado aqui. Quem confirma é o usuário, editando os
// campos já pré-preenchidos na ficha e clicando em "Salvar alterações"
// (o fluxo de salvar já existe, não precisa de uma função "confirmar"
// separada — a revisão humana É a tela normal de edição).
// ============================================================================

function jurAnalisarDocumentoIA(base64, nomeArquivo, mimeType, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var texto = docIA_ocrParaTexto_(base64, nomeArquivo, mimeType);
    if (!texto.trim()) {
      return { sucesso: false, mensagem: "Não foi possível ler nenhum texto no documento. Tente um PDF ou foto de melhor qualidade." };
    }

    var prompt = [
      "Você está lendo o texto (extraído por OCR, pode ter erros de leitura) de um documento",
      "jurídico recebido por um sindicato de trabalhadores em educação: pode ser uma petição,",
      "intimação, notificação judicial, sentença ou contrato.",
      "",
      "TEXTO EXTRAÍDO:",
      '"""',
      texto,
      '"""',
      "",
      "Extraia os dados em um JSON com exatamente estas chaves (use \"\" quando não encontrar,",
      "NUNCA invente um valor que não está no texto):",
      "{",
      '  "assunto": "",',
      '  "tipo": "",',
      '  "area": "",',
      '  "numeroCnj": "",',
      '  "autor": "",',
      '  "reu": "",',
      '  "prazoDescricao": "",',
      '  "prazoData": "",',
      '  "observacoesLeitura": ""',
      "}",
      "",
      "Regras:",
      '- "assunto": um resumo curto (até 80 caracteres) do que é o documento, ex.: "Notificação',
      '  judicial - reclamação trabalhista Escola X".',
      '- "tipo": escolha UM entre exatamente estas opções: "Processo", "Notificação", "Contrato",',
      '  "Consulta". Se não tiver certeza, deixe "".',
      '- "area": escolha UM entre exatamente estas opções: "Trabalhista", "Cível",',
      '  "Administrativo", "Tributário", "Outro". Se não tiver certeza, deixe "".',
      '- "numeroCnj": o número do processo, só dígitos e os separadores originais (formato',
      '  NNNNNNN-DD.AAAA.J.TR.OOOO), se aparecer no texto.',
      '- "autor" e "reu": nome das partes, como aparecem no documento.',
      '- "prazoDescricao": o nome do prazo mais urgente/próximo mencionado no documento (ex.:',
      '  "Contestação", "Recurso", "Audiência de instrução"). Se houver mais de um prazo, escolha',
      '  o mais próximo/urgente.',
      '- "prazoData": a data desse prazo, formato aaaa-mm-dd, se identificar.',
      '- "observacoesLeitura": qualquer trecho ilegível, ambíguo, ou informação importante que',
      "  não coube nos campos acima — isso é pro responsável conferir com atenção.",
      "- Responda APENAS com o JSON, sem texto antes ou depois, sem markdown."
    ].join("\n");

    var extraido = docIA_extrairJSON_(prompt);

    var alertas = [];
    var tipo = JUR_TIPOS.indexOf(extraido.tipo) > -1 ? extraido.tipo : "";
    if (!tipo) alertas.push("Não identifiquei o tipo do documento com segurança — confira o campo Tipo.");
    var area = JUR_AREAS.indexOf(extraido.area) > -1 ? extraido.area : "";
    if (!area) alertas.push("Não identifiquei a área com segurança — confira o campo Área.");
    if (!extraido.numeroCnj) alertas.push("Número CNJ não encontrado no documento — confira manualmente.");
    if (!extraido.prazoData) alertas.push("Não identifiquei uma data de prazo no documento.");
    if (extraido.observacoesLeitura) alertas.push("IA: " + extraido.observacoesLeitura);

    return {
      sucesso: true,
      dados: {
        assunto: extraido.assunto || "",
        tipo: tipo,
        area: area,
        cnj: extraido.numeroCnj || "",
        autor: extraido.autor || "",
        reu: extraido.reu || "",
        prazoDescricao: extraido.prazoDescricao || "",
        prazoData: extraido.prazoData || ""
      },
      alertas: alertas,
      textoOcr: texto
    };
  } catch (e) {
    Logger.log("jurAnalisarDocumentoIA erro: " + e.message);
    return { sucesso: false, mensagem: "Erro ao analisar o documento: " + e.message };
  }
}

// ============================================================================
// FASE 3b — Relatório executivo
//
// Calculado sob demanda a partir das abas já existentes (Juridico e
// Juridico_Prazos) — sem planilha auxiliar nova. "Exposição total" e "taxa
// de êxito" só existem a partir de agora porque os campos Valor da Causa e
// Resultado foram adicionados nesta mesma fase (antes não tinha como medir
// nenhum dos dois, era só cadastro sem número).
// ============================================================================

function jurObterRelatorioExecutivo(tokenSessao) {
  try {
    exigirSessaoDocumentos_(tokenSessao, false);

    var aba = jurObterAba_();
    var ultimaLinha = aba.getLastRow();
    var relatorio = {
      totalProcessos: 0, totalAtivos: 0, totalConcluidos: 0,
      exposicaoTotal: 0, tempoMedioTramitacaoDias: null, taxaExito: null,
      porArea: {}, porEscola: {}, porStatus: {}, prazosVencendo30d: 0
    };

    if (ultimaLinha >= 2) {
      var dados = aba.getRange(2, 1, ultimaLinha - 1, JUR_CABECALHO.length).getValues()
        .filter(function(l) { return String(l[JUR_COL.ATIVO - 1] || "SIM") !== "NAO"; });

      var somaTramitacaoDias = 0, qtdTramitacao = 0;
      var qtdComResultado = 0, qtdExito = 0;

      dados.forEach(function(l) {
        relatorio.totalProcessos++;
        var status = String(l[JUR_COL.STATUS - 1] || "");
        relatorio.porStatus[status] = (relatorio.porStatus[status] || 0) + 1;
        if (status === "Concluído") relatorio.totalConcluidos++; else relatorio.totalAtivos++;

        var area = String(l[JUR_COL.AREA - 1] || "Não classificado");
        relatorio.porArea[area] = (relatorio.porArea[area] || 0) + 1;

        var escola = String(l[JUR_COL.ESCOLA_NOME - 1] || "").trim();
        if (escola) relatorio.porEscola[escola] = (relatorio.porEscola[escola] || 0) + 1;

        var valorCausa = Number(l[JUR_COL.VALOR_CAUSA - 1]) || 0;
        if (status !== "Concluído") relatorio.exposicaoTotal += valorCausa;

        if (status === "Concluído") {
          var criado = l[JUR_COL.CRIADO_EM - 1], atualizado = l[JUR_COL.ATUALIZADO_EM - 1];
          if (Object.prototype.toString.call(criado) === "[object Date]" && Object.prototype.toString.call(atualizado) === "[object Date]") {
            var dias = Math.round((atualizado - criado) / 86400000);
            if (dias >= 0) { somaTramitacaoDias += dias; qtdTramitacao++; }
          }
          var resultado = String(l[JUR_COL.RESULTADO - 1] || "");
          if (resultado && resultado !== "Em andamento") {
            qtdComResultado++;
            if (resultado === "Favorável" || resultado === "Acordo") qtdExito++;
          }
        }
      });

      if (qtdTramitacao > 0) relatorio.tempoMedioTramitacaoDias = Math.round(somaTramitacaoDias / qtdTramitacao);
      if (qtdComResultado > 0) relatorio.taxaExito = Math.round((qtdExito / qtdComResultado) * 100);
    }

    // Prazos vencendo nos próximos 30 dias (não cumpridos), somando todos
    // os processos — dá o "quanto tem pra vencer agora" de verdade.
    try {
      var abaPrazos = jurObterAbaPrazos_();
      var ultimaLinhaPrazos = abaPrazos.getLastRow();
      if (ultimaLinhaPrazos >= 2) {
        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        var dadosPrazos = abaPrazos.getRange(2, 1, ultimaLinhaPrazos - 1, JUR_CABECALHO_PRAZOS.length).getValues();
        dadosPrazos.forEach(function(l) {
          var cumprido = String(l[JUR_COLP.CUMPRIDO - 1] || "NAO") === "SIM";
          if (cumprido) return;
          var dataTexto = jurTextoSeguro_(l[JUR_COLP.DATA - 1]);
          if (!dataTexto) return;
          var dataPrazo = new Date(dataTexto + "T00:00:00");
          if (isNaN(dataPrazo.getTime())) return;
          var diffDias = Math.round((dataPrazo - hoje) / 86400000);
          if (diffDias >= 0 && diffDias <= 30) relatorio.prazosVencendo30d++;
        });
      }
    } catch (ePrazos) {
      Logger.log("jurObterRelatorioExecutivo: falha ao contar prazos — " + ePrazos.message);
    }

    return { ok: true, relatorio: relatorio };
  } catch (e) {
    Logger.log("jurObterRelatorioExecutivo ERRO: " + e.message + " | stack: " + e.stack);
    return { ok: false, mensagem: e.message || "Erro ao gerar relatório." };
  }
}
