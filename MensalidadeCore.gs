// ================================================================
// ARQUIVO: MensalidadeCore.gs
// Controle de Mensalidade Sindical — SindEducação-ES
// ================================================================

var ABA_MENSALIDADE = "Mensalidade_Controle";

/* ─── Mapa de colunas ─── */
var COL_M = {
  NOME:               1,
  CPF:                2,
  ESCOLA:             3,
  FILIADO:            4,
  NUMERO_OFICIO:      5,
  DATA_OFICIO:        6,
  STATUS:             7,
  DATA_ULTIMA_COB:    8,
  OBSERVACOES:        9
};

/* ═══════════════════════════════════════════════════════
   HELPERS INTERNOS
═══════════════════════════════════════════════════════ */
function getAbaMensalidade_() {
  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_MENSALIDADE);
  if (!aba) throw new Error("Aba '" + ABA_MENSALIDADE + "' não encontrada.");
  return aba;
}

function normalizarCpf_(v) {
  return String(v || "").replace(/\D/g, "");
}

function hoje_() {
  return Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
}

function diasEntre_(dataStr) {
  try {
    if (!dataStr) return 999;
    var partes = String(dataStr).split("/");
    if (partes.length !== 3) return 999;
    var d = new Date(partes[2], partes[1] - 1, partes[0]);
    var diff = new Date() - d;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  } catch (e) {
    return 999;
  }
}

// Renomeada para não colidir com getHeaderMap_ (Utils.gs), definição global
// duplicada — o Apps Script roda todo o projeto em um único escopo, então as
// duas funções de mesmo nome disputavam qual "vencia" dependendo da ordem de
// carregamento dos arquivos. Sem chamadores neste arquivo (confirmado por
// busca), renomear é seguro.
function getHeaderMapMensalidade_(aba) {
  var headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function(h, i) { if (h) map[String(h).trim()] = i + 1; });
  return map;
}

/* ═══════════════════════════════════════════════════════
   REGISTRAR OFÍCIO NA MENSALIDADE
   Chamado automaticamente ao emitir ofício de Filiação
═══════════════════════════════════════════════════════ */
function registrarOficioNaMensalidade(dadosOficio) {
  try {
    dadosOficio = dadosOficio || {};

    var tipo = String(dadosOficio.tipo || "").toLowerCase();
    if (tipo.indexOf("filia") < 0) {
      return { ok: false, mensagem: "Ofício não é de Filiação. Nada registrado." };
    }

    var aba          = getAbaMensalidade_();
    var escola       = String(dadosOficio.escola || "").trim();
    var numeroOficio = String(dadosOficio.numero || "").trim();
    var dataOficio   = hoje_();
    var colaboradores = Array.isArray(dadosOficio.colaboradores) ? dadosOficio.colaboradores : [];
    var cpfs          = Array.isArray(dadosOficio.cpfs)          ? dadosOficio.cpfs          : [];

    if (!colaboradores.length) {
      return { ok: false, mensagem: "Nenhum colaborador informado." };
    }

    var ultimaLinha = aba.getLastRow();
    var dadosExistentes = ultimaLinha >= 2
      ? aba.getRange(2, 1, ultimaLinha - 1, aba.getLastColumn()).getValues()
      : [];

    var registrados = 0, atualizados = 0;

    colaboradores.forEach(function(nome, idx) {
      nome = String(nome || "").trim();
      var cpf = normalizarCpf_(cpfs[idx] || "");
      if (!nome) return;

      var linhaExistente = -1;
      for (var i = 0; i < dadosExistentes.length; i++) {
        var cpfExist  = normalizarCpf_(dadosExistentes[i][COL_M.CPF - 1]);
        var nomeExist = String(dadosExistentes[i][COL_M.NOME - 1] || "").trim().toLowerCase();
        var escExist  = String(dadosExistentes[i][COL_M.ESCOLA - 1] || "").trim().toLowerCase();

        if ((cpf && cpfExist === cpf) ||
            (nomeExist === nome.toLowerCase() && escExist === escola.toLowerCase())) {
          linhaExistente = i + 2;
          break;
        }
      }

      if (linhaExistente > -1) {
        aba.getRange(linhaExistente, COL_M.NUMERO_OFICIO).setValue(numeroOficio);
        aba.getRange(linhaExistente, COL_M.DATA_OFICIO).setValue(dataOficio);
        aba.getRange(linhaExistente, COL_M.STATUS).setValue("AGUARDANDO");
        atualizados++;
      } else {
        var novaLinha = new Array(9).fill("");
        novaLinha[COL_M.NOME           - 1] = nome;
        novaLinha[COL_M.CPF            - 1] = cpf || "";
        novaLinha[COL_M.ESCOLA         - 1] = escola;
        novaLinha[COL_M.FILIADO        - 1] = "S";
        novaLinha[COL_M.NUMERO_OFICIO  - 1] = numeroOficio;
        novaLinha[COL_M.DATA_OFICIO    - 1] = dataOficio;
        novaLinha[COL_M.STATUS         - 1] = "AGUARDANDO";
        novaLinha[COL_M.DATA_ULTIMA_COB- 1] = "";
        novaLinha[COL_M.OBSERVACOES    - 1] = "";
        aba.appendRow(novaLinha);
        registrados++;
      }
    });

    return {
      ok: true,
      mensagem: registrados + " registrado(s), " + atualizados + " atualizado(s).",
      registrados: registrados,
      atualizados: atualizados
    };

  } catch (e) {
    Logger.log("registrarOficioNaMensalidade erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   LISTAR STATUS DE MENSALIDADES (para o frontend)
═══════════════════════════════════════════════════════ */
function listarMensalidadeStatus(filtros) {
  try {
    filtros = filtros || {};
    var aba = getAbaMensalidade_();
    var ultimaLinha = aba.getLastRow();

    if (ultimaLinha < 2) {
      return { ok: true, itens: [], resumo: { total: 0, confirmados: 0, aguardando: 0, pendentes: 0, cobracaEnviada: 0, regularizados: 0 } };
    }

    var dados = aba.getRange(2, 1, ultimaLinha - 1, 9).getValues();

    var itens = dados
      .filter(function(linha) { return String(linha[COL_M.NOME - 1] || "").trim(); })
      .map(function(linha, idx) {
        var dataOficioStr    = linha[COL_M.DATA_OFICIO    - 1];
        var dataUltimaCobStr = linha[COL_M.DATA_ULTIMA_COB - 1];
        var dataOficioFmt    = dataOficioStr
          ? Utilities.formatDate(new Date(dataOficioStr), "America/Sao_Paulo", "dd/MM/yyyy")
          : "";
        var dataUltimaCobFmt = dataUltimaCobStr
          ? Utilities.formatDate(new Date(dataUltimaCobStr), "America/Sao_Paulo", "dd/MM/yyyy")
          : "";

        return {
          linha:           idx + 2,
          nome:            String(linha[COL_M.NOME          - 1] || "").trim(),
          cpf:             String(linha[COL_M.CPF           - 1] || "").trim(),
          escola:          String(linha[COL_M.ESCOLA        - 1] || "").trim(),
          filiado:         String(linha[COL_M.FILIADO       - 1] || "").trim(),
          numeroOficio:    String(linha[COL_M.NUMERO_OFICIO - 1] || "").trim(),
          dataOficio:      dataOficioFmt,
          status:          String(linha[COL_M.STATUS        - 1] || "AGUARDANDO").trim().toUpperCase(),
          dataUltimaCob:   dataUltimaCobFmt,
          observacoes:     String(linha[COL_M.OBSERVACOES   - 1] || "").trim(),
          diasSemConfirm:  diasEntre_(dataOficioFmt)
        };
      });

    var fStatus = String(filtros.status || "").toUpperCase();
    var fEscola = String(filtros.escola || "").toLowerCase();
    var fNome   = String(filtros.nome   || "").toLowerCase();

    var filtrada = itens.filter(function(item) {
      if (fStatus && item.status !== fStatus) return false;
      if (fEscola && item.escola.toLowerCase().indexOf(fEscola) < 0) return false;
      if (fNome   && item.nome.toLowerCase().indexOf(fNome)   < 0) return false;
      return true;
    });

    var resumo = {
      total:          itens.length,
      confirmados:    itens.filter(function(i){ return i.status === "CONFIRMADO";       }).length,
      aguardando:     itens.filter(function(i){ return i.status === "AGUARDANDO";       }).length,
      pendentes:      itens.filter(function(i){ return i.status === "PENDENTE_30D";     }).length,
      cobracaEnviada: itens.filter(function(i){ return i.status === "COBRANCA_ENVIADA"; }).length,
      regularizados:  itens.filter(function(i){ return i.status === "REGULARIZADO";     }).length
    };

    return { ok: true, itens: filtrada, resumo: resumo };

  } catch (e) {
    Logger.log("listarMensalidadeStatus erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message, itens: [], resumo: {} };
  }
}

/* ═══════════════════════════════════════════════════════
   ATUALIZAR STATUS POR CPF/NOME
═══════════════════════════════════════════════════════ */
function atualizarStatusMensalidade(cpf, novoStatus, obs) {
  try {
    var aba = getAbaMensalidade_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: false, mensagem: "Nenhum registro encontrado." };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, 9).getValues();
    var cpfBusca  = normalizarCpf_(cpf);
    var nomeBusca = String(cpf || "").trim().toLowerCase();
    var encontrado = false;

    for (var i = 0; i < dados.length; i++) {
      var cpfLinha  = normalizarCpf_(dados[i][COL_M.CPF  - 1]);
      var nomeLinha = String(dados[i][COL_M.NOME - 1] || "").trim().toLowerCase();
      var statusAtual = String(dados[i][COL_M.STATUS - 1] || "").trim().toUpperCase();

      if (statusAtual === novoStatus) continue;

      var bateu = false;
      if (cpfBusca.length >= 11 && cpfLinha.length >= 11) {
        bateu = (cpfBusca === cpfLinha);
      } else if (nomeBusca && nomeLinha && nomeLinha === nomeBusca) {
        bateu = true;
      }

      if (!bateu) continue;

      var row = i + 2;
      aba.getRange(row, COL_M.STATUS).setValue(novoStatus);
      if (obs) aba.getRange(row, COL_M.OBSERVACOES).setValue(obs);
      if (novoStatus === "COBRANCA_ENVIADA") {
        aba.getRange(row, COL_M.DATA_ULTIMA_COB).setValue(hoje_());
      }
      encontrado = true;
      break;
    }

    if (!encontrado) return { ok: false, mensagem: "Associado não encontrado ou já com status: " + novoStatus };
    return { ok: true, mensagem: "Status atualizado para " + novoStatus + "." };

  } catch (e) {
    Logger.log("atualizarStatusMensalidade erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   ATUALIZAR STATUS POR LINHA
═══════════════════════════════════════════════════════ */
function atualizarStatusMensalidadePorLinha(linha, novoStatus, obs) {
  try {
    var aba = getAbaMensalidade_();
    if (linha < 2 || linha > aba.getLastRow()) {
      return { ok: false, mensagem: "Linha inválida: " + linha };
    }
    aba.getRange(linha, COL_M.STATUS).setValue(novoStatus);
    if (obs) aba.getRange(linha, COL_M.OBSERVACOES).setValue(obs);
    if (novoStatus === "COBRANCA_ENVIADA") {
      aba.getRange(linha, COL_M.DATA_ULTIMA_COB).setValue(hoje_());
    }
    return { ok: true, mensagem: "Status atualizado para " + novoStatus + "." };
  } catch (e) {
    Logger.log("atualizarStatusMensalidadePorLinha erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   PROCESSAMENTO DIÁRIO DE ALERTAS (trigger)
═══════════════════════════════════════════════════════ */
function processarAlertasMensalidade() {
  try {
    var aba = getAbaMensalidade_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: true, mensagem: "Nenhum registro para processar." };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, 9).getValues();
    var atualizados = 0;

    dados.forEach(function(linha, idx) {
      var status     = String(linha[COL_M.STATUS      - 1] || "").toUpperCase();
      var dataOficio = linha[COL_M.DATA_OFICIO - 1];
      if (!dataOficio) return;

      var dataStr = Utilities.formatDate(new Date(dataOficio), "America/Sao_Paulo", "dd/MM/yyyy");
      var dias    = diasEntre_(dataStr);
      var row     = idx + 2;

      if (status === "AGUARDANDO" && dias >= 30) {
        aba.getRange(row, COL_M.STATUS).setValue("PENDENTE_30D");
        atualizados++;
      }
    });

    Logger.log("processarAlertasMensalidade: " + atualizados + " registro(s) atualizados.");
    return { ok: true, mensagem: atualizados + " alerta(s) gerado(s).", atualizados: atualizados };

  } catch (e) {
    Logger.log("processarAlertasMensalidade erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   ENVIAR COBRANÇA EM LOTE
═══════════════════════════════════════════════════════ */
function enviarCobracasMensalidade(cpfs) {
  try {
    if (!Array.isArray(cpfs) || !cpfs.length) {
      return { ok: false, mensagem: "Nenhum CPF informado." };
    }

    var aba = getAbaMensalidade_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: false, mensagem: "Nenhum registro encontrado." };

    var dados   = aba.getRange(2, 1, ultimaLinha - 1, 9).getValues();
    var enviados = 0, erros = 0, detalhes = [];

    var escolas = {};
    try {
      var listaEscolas = listarEscolasCadastro_interno_() || [];
      listaEscolas.forEach(function(e) {
        var key = String(e.escola || e.NomeEscola || "").trim().toLowerCase();
        if (key) escolas[key] = e.email || e.Email || "";
      });
    } catch(eEsc) {
      Logger.log("Aviso: não foi possível carregar e-mails de escolas: " + eEsc.message);
    }

    cpfs.forEach(function(cpf) {
      var cpfBusca = normalizarCpf_(cpf);
      var linha = dados.find(function(l) {
        return normalizarCpf_(l[COL_M.CPF - 1]) === cpfBusca;
      });
      if (!linha) { erros++; return; }

      var nome         = String(linha[COL_M.NOME          - 1] || "").trim();
      var escola       = String(linha[COL_M.ESCOLA        - 1] || "").trim();
      var numeroOficio = String(linha[COL_M.NUMERO_OFICIO - 1] || "").trim();
      var emailEscola  = escolas[escola.toLowerCase()] || "";

      if (!emailEscola) {
        detalhes.push({ cpf: cpf, nome: nome, escola: escola, ok: false, motivo: "E-mail da escola não encontrado." });
        erros++;
        return;
      }

      var assunto = "[SindEducação-ES] Cobrança de Mensalidade Sindical — Ofício nº " + numeroOficio + " — " + nome;
      var dataHoje = hoje_();
      var corpo =
        "Prezados(as) Senhores(as),\n\n" +
        "Bom dia!\n\n" +
        "Esperamos que esta mensagem os encontre bem.\n\n" +
        "Entramos em contato para verificar a situação do desconto de mensalidade sindical " +
        "do(a) colaborador(a) abaixo identificado(a), cujo Ofício de Filiação já foi devidamente " +
        "encaminhado a essa instituição:\n\n" +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
        "  Colaborador(a): " + nome + "\n" +
        "  Nº do Ofício:   " + numeroOficio + "\n" +
        "  Instituição:    " + escola + "\n" +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
        "Conforme previsto na Cláusula 56ª da Convenção Coletiva de Trabalho (CCT) vigente, " +
        "e com base na autorização de filiação apresentada pelo(a) associado(a), solicitamos " +
        "a realização do desconto mensal de 2% sobre o salário-base a título de Mensalidade Sindical, " +
        "com repasse ao SindEducação-ES.\n\n" +
        "Até o momento, não identificamos a efetivação desse desconto em folha de pagamento. " +
        "Solicitamos, por gentileza:\n\n" +
        "  1. Verificar se o desconto está sendo realizado corretamente;\n" +
        "  2. Caso ainda não tenha sido implementado, adotar as providências necessárias;\n" +
        "  3. Confirmar o recebimento deste e-mail e informar a situação em até 5 dias úteis.\n\n" +
        "Ressaltamos que o não cumprimento do disposto na CCT poderá acarretar as medidas " +
        "cabíveis previstas na legislação trabalhista vigente.\n\n" +
        "Permanecemos à disposição para quaisquer esclarecimentos pelo telefone (27) 99813-5965 " +
        "ou pelo e-mail financeiro@sindeducacao.com.\n\n" +
        "Atenciosamente,\n\n" +
        "Wanderson Nascimento Castelo\n" +
        "Setor Financeiro & Cobrança\n" +
        "SindEducação-ES — Sindicato dos Educadores Técnico-Administrativos\n" +
        "em Estabelecimentos de Ensino Particular no Estado do Espírito Santo\n" +
        "📞 (27) 99813-5965 | (27) 3222-2706\n" +
        "✉️  financeiro@sindeducacao.com\n" +
        "🌐  www.sindeducacao.com.br\n\n" +
        "Data: " + dataHoje;

      try {
        GmailApp.sendEmail(emailEscola, assunto, corpo, {
          name: "SindEducação-ES — Financeiro"
        });

        var rowIdx = dados.indexOf(linha);
        var row    = rowIdx + 2;
        aba.getRange(row, COL_M.STATUS).setValue("COBRANCA_ENVIADA");
        aba.getRange(row, COL_M.DATA_ULTIMA_COB).setValue(hoje_());

        enviados++;
        detalhes.push({ cpf: cpf, nome: nome, escola: escola, emailEscola: emailEscola, ok: true });

      } catch (eEmail) {
        erros++;
        detalhes.push({ cpf: cpf, nome: nome, escola: escola, ok: false, motivo: eEmail.message });
      }
    });

    return {
      ok: true,
      mensagem: enviados + " cobrança(s) enviada(s). " + (erros ? erros + " erro(s)." : ""),
      enviados: enviados,
      erros: erros,
      detalhes: detalhes
    };

  } catch (e) {
    Logger.log("enviarCobracasMensalidade erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   CONFIGURAR TRIGGER DIÁRIO
═══════════════════════════════════════════════════════ */
function configurarTriggerMensalidade() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "processarAlertasMensalidade") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("processarAlertasMensalidade")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  Logger.log("Trigger diário configurado para processarAlertasMensalidade às 8h.");
  return { ok: true, mensagem: "Trigger configurado com sucesso." };
}

/* ═══════════════════════════════════════════════════════
   IMPORTAR HISTÓRICO
═══════════════════════════════════════════════════════ */
function importarHistoricoMensalidades() {
  var ID_HISTORICO = '1TrG4U7NgtmGVv9CmduXZ9tJ17UftxqoPy4nTdrvIYYg';

  try {
    var ssOrigem  = SpreadsheetApp.openById(ID_HISTORICO);
    var abaOrigem = ssOrigem.getSheets()[0];
    var dados     = abaOrigem.getDataRange().getValues();

    var ssDestino  = SpreadsheetApp.openById(PLANILHA_ID);
    var abaDestino = ssDestino.getSheetByName('Mensalidade_Controle');

    if (!abaDestino) {
      return { ok: false, mensagem: 'Aba Mensalidade_Controle não encontrada.' };
    }

    var existentes = {};
    var ultimaLinha = abaDestino.getLastRow();
    if (ultimaLinha > 1) {
      var dadosExistentes = abaDestino.getRange(2, 1, ultimaLinha - 1, 9).getValues();
      dadosExistentes.forEach(function(row) {
        var chave = String(row[4]).trim().toUpperCase() + '|' + String(row[0]).trim().toUpperCase();
        existentes[chave] = true;
      });
    }

    var COL_DATA    = 1;
    var COL_NUMERO  = 2;
    var COL_ESCOLA  = 4;
    var COL_NOMES   = 6;
    var COL_SITUACAO = 8;
    var COL_LINK    = 9;

    var novasLinhas = [];
    var importados  = 0;
    var pulados     = 0;

    for (var i = 1; i < dados.length; i++) {
      var row = dados[i];

      if (!row[COL_ESCOLA] && !row[COL_NOMES]) { pulados++; continue; }

      var numero   = String(row[COL_NUMERO] || '').trim();
      var data     = row[COL_DATA] || '';
      var escola   = String(row[COL_ESCOLA] || '').trim();
      var situacao = String(row[COL_SITUACAO] || '').trim();
      var link     = String(row[COL_LINK] || '').trim();

      var dataFormatada = '';
      if (data instanceof Date) {
        dataFormatada = Utilities.formatDate(data, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      } else if (String(data).trim()) {
        dataFormatada = String(data).trim();
      }

      var obs = situacao;
      if (link) obs += (obs ? ' | PDF: ' : 'PDF: ') + link;

      var nomesRaw = String(row[COL_NOMES] || '').trim();
      var nomes = nomesRaw.split(';').map(function(n) { return n.trim(); }).filter(function(n) { return n; });
      if (nomes.length === 0) nomes = [''];

      nomes.forEach(function(nome) {
        var chave = numero.toUpperCase() + '|' + nome.toUpperCase();
        if (existentes[chave]) { pulados++; return; }

        novasLinhas.push([
          nome, '', escola, 'S', numero, dataFormatada, 'AGUARDANDO', '', obs
        ]);

        existentes[chave] = true;
        importados++;
      });
    }

    if (novasLinhas.length > 0) {
      var proximaLinha = abaDestino.getLastRow() + 1;
      abaDestino.getRange(proximaLinha, 1, novasLinhas.length, 9).setValues(novasLinhas);
    }

    var msg = 'Importação concluída: ' + importados + ' registros importados, ' + pulados + ' pulados.';
    Logger.log(msg);
    return { ok: true, mensagem: msg, importados: importados, pulados: pulados };

  } catch (e) {
    Logger.log('Erro na importação: ' + e.message);
    return { ok: false, mensagem: 'Erro: ' + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   ABA DE HISTÓRICO DE RELATÓRIOS
═══════════════════════════════════════════════════════ */
var ABA_HISTORICO_REL = "Mensalidade_Historico";

function getAbaHistoricoRel_() {
  var ss  = SpreadsheetApp.openById(PLANILHA_ID);
  var aba = ss.getSheetByName(ABA_HISTORICO_REL);
  if (!aba) {
    aba = ss.insertSheet(ABA_HISTORICO_REL);
    var cab = ["Data Processamento","Escola","Mês Referência","Arquivo","Confirmados","Não Encontrados","Total Analisados","Observação IA"];
    aba.appendRow(cab);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, cab.length)
      .setFontWeight("bold")
      .setBackground("#002f6c")
      .setFontColor("#ffffff");
    aba.autoResizeColumns(1, cab.length);
  }
  return aba;
}

function registrarHistoricoRelatorio_(dados) {
  try {
    var aba = getAbaHistoricoRel_();
    aba.appendRow([
      dados.dataProcessamento || hoje_(),
      dados.escola            || "",
      dados.mesReferencia     || "",
      dados.nomeArquivo       || "",
      dados.confirmados       || 0,
      dados.naoEncontrados    || 0,
      dados.total             || 0,
      dados.observacao        || ""
    ]);
  } catch (e) {
    Logger.log("registrarHistoricoRelatorio_ erro: " + e.message);
  }
}

/* ═══════════════════════════════════════════════════════
   PROCESSAR RELATÓRIO DE DESCONTO VIA API CLAUDE (IA)
   Versão 2.0 — com mesReferencia e histórico
═══════════════════════════════════════════════════════ */
function processarRelatorioMensalidade(payload) {
  try {
    var escolaNome   = String(payload.escolaNome   || "").trim();
    var base64       = String(payload.base64       || "");
    var mimeType     = String(payload.mimeType     || "application/pdf");
    var nomeArquivo  = String(payload.nomeArquivo  || "relatorio");
    var mesReferencia = String(payload.mesReferencia || "").trim();

    if (!base64)     return { ok: false, mensagem: "Arquivo não recebido." };
    if (!escolaNome) return { ok: false, mensagem: "Nome da escola não informado." };

    // ── 1. Busca associados pendentes da escola ──
    var aba = getAbaMensalidade_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: false, mensagem: "Nenhum registro na planilha." };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, 9).getValues();
    var associados = [];

    for (var i = 0; i < dados.length; i++) {
      var nomeEscolaLinha = String(dados[i][COL_M.ESCOLA  - 1] || "").trim().toLowerCase();
      var statusAtual     = String(dados[i][COL_M.STATUS  - 1] || "").trim().toUpperCase();
      var nomeLinha       = String(dados[i][COL_M.NOME    - 1] || "").trim();

      if (!nomeLinha) continue;
      if (nomeEscolaLinha.indexOf(escolaNome.toLowerCase()) < 0) continue;
      if (statusAtual === "CONFIRMADO" || statusAtual === "REGULARIZADO") continue;

      associados.push({
        linha:  i + 2,
        nome:   nomeLinha,
        cpf:    String(dados[i][COL_M.CPF           - 1] || "").trim(),
        oficio: String(dados[i][COL_M.NUMERO_OFICIO - 1] || "").trim()
      });
    }

    if (!associados.length) {
      return { ok: false, mensagem: "Nenhum associado pendente encontrado para esta escola." };
    }

    // ── 2. Monta lista para o prompt ──
    var listaAssociados = associados.map(function(a, idx) {
      return (idx + 1) + ". Nome: " + a.nome + (a.cpf ? " | CPF: " + a.cpf : "");
    }).join("\n");

    var contextoMes = mesReferencia ? "O relatório é referente ao período: " + mesReferencia + ".\n" : "";

    var prompt =
      "Você receberá um documento (relatório/holerite/planilha) de uma escola/empresa.\n\n" +
      contextoMes +
      "Sua tarefa é identificar quais dos associados abaixo constam no documento COM desconto " +
      "de mensalidade sindical (pode aparecer como 'sindicato', 'contribuição sindical', " +
      "'mensalidade sindical', 'sind.', 'SINDEDUCACAO', ou similar).\n\n" +
      "ASSOCIADOS A VERIFICAR:\n" + listaAssociados + "\n\n" +
      "INSTRUÇÕES:\n" +
      "- Compare os nomes de forma flexível (ignore acentos, maiúsculas/minúsculas, abreviações)\n" +
      "- Se encontrar um nome parcialmente (ex: 'MARIA SILVA' bate com 'MARIA DA SILVA'), considere como encontrado\n" +
      "- Identifique o mês/ano de referência do documento se não foi informado\n" +
      "- Retorne SOMENTE um JSON válido, sem texto adicional, sem markdown, sem explicações\n" +
      "- Formato exato: {\"encontrados\": [1, 3], \"nao_encontrados\": [2], \"mes_referencia\": \"MM/AAAA\", \"observacao\": \"texto livre\"}\n" +
      "- Os números são os índices da lista acima (começando em 1)\n" +
      "- Se não encontrar nenhum desconto sindical no documento, retorne encontrados como lista vazia []";

    // ── 3. Chama API do Claude ──
    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return { ok: false, mensagem: "Chave da API Anthropic não configurada no GAS." };

    var mensagemContent = [];

    if (mimeType === "application/pdf") {
      mensagemContent.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 }
      });
    } else if (mimeType.indexOf("image") >= 0) {
      mensagemContent.push({
        type: "image",
        source: { type: "base64", media_type: mimeType, data: base64 }
      });
    }

    mensagemContent.push({ type: "text", text: prompt });

    var requestBody = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: mensagemContent }]
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    var respCode = response.getResponseCode();
    var respText = response.getContentText();

    if (respCode !== 200) {
      Logger.log("Erro API Claude: " + respCode + " - " + respText);
      return { ok: false, mensagem: "Erro na API Claude (código " + respCode + ")." };
    }

    var respJson = JSON.parse(respText);
    var textoResposta = respJson.content && respJson.content[0] ? respJson.content[0].text : "";

    // ── 4. Parseia resposta JSON do Claude ──
    var resultado;
    try {
      var clean = textoResposta.replace(/```json|```/g, "").trim();
      resultado = JSON.parse(clean);
    } catch (e) {
      Logger.log("Erro ao parsear resposta Claude: " + textoResposta);
      return { ok: false, mensagem: "Erro ao interpretar resposta da IA. Resposta: " + textoResposta.slice(0, 200) };
    }

    var encontrados    = resultado.encontrados      || [];
    var naoEncontrados = resultado.nao_encontrados  || [];
    var mesDetectado   = resultado.mes_referencia   || mesReferencia || "";
    var observacao     = resultado.observacao       || "";

    // ── 5. Confirma automaticamente os encontrados ──
    var confirmados = 0;
    var dataHoje = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");

    for (var j = 0; j < encontrados.length; j++) {
      var idxAssoc = encontrados[j] - 1;
      if (idxAssoc < 0 || idxAssoc >= associados.length) continue;
      var assoc = associados[idxAssoc];
      aba.getRange(assoc.linha, COL_M.STATUS).setValue("CONFIRMADO");
      aba.getRange(assoc.linha, COL_M.OBSERVACOES).setValue(
        "Confirmado via relatório '" + nomeArquivo + "'" +
        (mesDetectado ? " ref. " + mesDetectado : "") +
        " em " + dataHoje +
        (observacao ? " | IA: " + observacao : "")
      );
      confirmados++;
    }

    // ── 6. Registra no histórico ──
    registrarHistoricoRelatorio_({
      dataProcessamento: dataHoje,
      escola:            escolaNome,
      mesReferencia:     mesDetectado,
      nomeArquivo:       nomeArquivo,
      confirmados:       confirmados,
      naoEncontrados:    associados.length - confirmados,
      total:             associados.length,
      observacao:        observacao
    });

    // ── 7. Monta retorno com detalhes ──
    var detalhes = associados.map(function(a, k) {
      return {
        nome:       a.nome,
        cpf:        a.cpf,
        oficio:     a.oficio,
        encontrado: encontrados.indexOf(k + 1) >= 0
      };
    });

    return {
      ok:            true,
      confirmados:   confirmados,
      total:         associados.length,
      detalhes:      detalhes,
      observacao:    observacao,
      mesReferencia: mesDetectado,
      mensagem:      confirmados + " de " + associados.length + " associado(s) confirmado(s) via relatório da IA" +
                     (mesDetectado ? " (" + mesDetectado + ")" : "") + "."
    };

  } catch (e) {
    Logger.log("processarRelatorioMensalidade erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   AUTOMAÇÃO VIA GMAIL
   Trigger: roda a cada 2 horas buscando e-mails de escolas
   com anexo PDF/Excel e processa automaticamente
═══════════════════════════════════════════════════════ */
function processarEmailsMensalidade() {
  try {
    var LABEL_PROCESSADO = "SISGEP_Processado";
    var LABEL_ERRO       = "SISGEP_Erro";

    // Cria labels se não existem
    var labelProc = GmailApp.getUserLabelByName(LABEL_PROCESSADO) || GmailApp.createLabel(LABEL_PROCESSADO);
    var labelErro = GmailApp.getUserLabelByName(LABEL_ERRO)       || GmailApp.createLabel(LABEL_ERRO);

    // Busca e-mails não lidos com anexo, não processados ainda
    var query = 'has:attachment -label:' + LABEL_PROCESSADO + ' -label:' + LABEL_ERRO +
                ' subject:(mensalidade OR desconto OR folha OR sindicato OR holerite)';
    var threads = GmailApp.search(query, 0, 20);

    if (!threads.length) {
      Logger.log("processarEmailsMensalidade: nenhum e-mail encontrado.");
      return { ok: true, processados: 0, mensagem: "Nenhum e-mail novo encontrado." };
    }

    // Carrega lista de escolas para identificar remetente
    var escolas = [];
    try { escolas = listarEscolasCadastro_interno_() || []; } catch(e) {}

    var totalProcessados = 0, totalErros = 0;
    var resumo = [];

    threads.forEach(function(thread) {
      var messages = thread.getMessages();
      var msg = messages[messages.length - 1]; // pega a última mensagem do thread

      var remetente    = msg.getFrom();
      var assunto      = msg.getSubject();
      var attachments  = msg.getAttachments();

      // Filtra só PDF e Excel
      var anexosValidos = attachments.filter(function(att) {
        var nome = att.getName().toLowerCase();
        var tipo = att.getContentType().toLowerCase();
        return tipo.indexOf("pdf") >= 0 || tipo.indexOf("excel") >= 0 ||
               tipo.indexOf("spreadsheet") >= 0 || nome.endsWith(".xlsx") ||
               nome.endsWith(".xls") || nome.endsWith(".pdf");
      });

      if (!anexosValidos.length) {
        thread.addLabel(labelErro);
        resumo.push({ assunto: assunto, status: "Sem anexo válido" });
        return;
      }

      // Tenta identificar a escola pelo e-mail do remetente
      var emailRemetente = remetente.replace(/.*<(.+)>/, "$1").trim().toLowerCase();
      var escolaEncontrada = null;

      escolas.forEach(function(e) {
        var emailEsc = String(e.email || e.Email || "").trim().toLowerCase();
        if (emailEsc && emailEsc === emailRemetente) {
          escolaEncontrada = e;
        }
      });

      var escolaNome = escolaEncontrada
        ? String(escolaEncontrada.escola || escolaEncontrada.NomeEscola || "").trim()
        : "";

      // Se não achou pelo e-mail, tenta pelo assunto
      if (!escolaNome) {
        escolas.forEach(function(e) {
          var nomeEsc = String(e.escola || e.NomeEscola || "").trim().toLowerCase();
          if (nomeEsc && assunto.toLowerCase().indexOf(nomeEsc) >= 0) {
            escolaEncontrada = e;
            escolaNome = String(e.escola || e.NomeEscola || "").trim();
          }
        });
      }

      if (!escolaNome) {
        thread.addLabel(labelErro);
        resumo.push({ assunto: assunto, remetente: emailRemetente, status: "Escola não identificada" });
        totalErros++;
        return;
      }

      // Processa o primeiro anexo válido
      var anexo = anexosValidos[0];
      var base64 = Utilities.base64Encode(anexo.getBytes());
      var mimeType = anexo.getContentType();
      var nomeArquivo = anexo.getName();

      var resultado = processarRelatorioMensalidade({
        escolaNome:   escolaNome,
        base64:       base64,
        mimeType:     mimeType,
        nomeArquivo:  nomeArquivo,
        mesReferencia: ""
      });

      if (resultado.ok) {
        thread.addLabel(labelProc);
        thread.markRead();
        totalProcessados++;
        resumo.push({
          escola:      escolaNome,
          assunto:     assunto,
          confirmados: resultado.confirmados,
          total:       resultado.total,
          mes:         resultado.mesReferencia,
          status:      "OK"
        });
      } else {
        thread.addLabel(labelErro);
        totalErros++;
        resumo.push({
          escola:  escolaNome,
          assunto: assunto,
          status:  "Erro: " + resultado.mensagem
        });
      }
    });

    // Envia resumo por e-mail para o operador
    if (totalProcessados > 0 || totalErros > 0) {
      var corpoResumo = "Resumo do processamento automático de relatórios de mensalidade:\n\n";
      resumo.forEach(function(r) {
        corpoResumo += "• " + (r.escola || r.assunto || "?") + ": " + r.status;
        if (r.confirmados !== undefined) {
          corpoResumo += " — " + r.confirmados + " de " + r.total + " confirmados";
          if (r.mes) corpoResumo += " (ref. " + r.mes + ")";
        }
        corpoResumo += "\n";
      });

      GmailApp.sendEmail(
        Session.getActiveUser().getEmail(),
        "[SISGEP] Processamento automático — " + totalProcessados + " relatório(s) processado(s)",
        corpoResumo,
        { name: "SISGEP — Automação" }
      );
    }

    Logger.log("processarEmailsMensalidade: " + totalProcessados + " processados, " + totalErros + " erros.");
    return {
      ok:          true,
      processados: totalProcessados,
      erros:       totalErros,
      resumo:      resumo,
      mensagem:    totalProcessados + " relatório(s) processado(s) automaticamente."
    };

  } catch (e) {
    Logger.log("processarEmailsMensalidade erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   CONFIGURAR TRIGGER GMAIL (a cada 2 horas)
   Execute uma vez manualmente para ativar
═══════════════════════════════════════════════════════ */
function configurarTriggerGmail() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "processarEmailsMensalidade") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("processarEmailsMensalidade")
    .timeBased()
    .everyHours(2)
    .create();

  Logger.log("Trigger Gmail configurado: processarEmailsMensalidade a cada 2 horas.");
  return { ok: true, mensagem: "Trigger Gmail configurado com sucesso." };
}

/* ═══════════════════════════════════════════════════════
   LISTAR HISTÓRICO DE RELATÓRIOS PROCESSADOS
═══════════════════════════════════════════════════════ */
function listarHistoricoRelatorios() {
  try {
    var aba = getAbaHistoricoRel_();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { ok: true, itens: [] };

    var dados = aba.getRange(2, 1, ultimaLinha - 1, 8).getValues();
    var itens = dados
      .filter(function(l) { return String(l[1] || "").trim(); })
      .map(function(l) {
        return {
          dataProcessamento: String(l[0] || ""),
          escola:            String(l[1] || ""),
          mesReferencia:     String(l[2] || ""),
          nomeArquivo:       String(l[3] || ""),
          confirmados:       Number(l[4] || 0),
          naoEncontrados:    Number(l[5] || 0),
          total:             Number(l[6] || 0),
          observacao:        String(l[7] || "")
        };
      })
      .reverse(); // mais recente primeiro

    return { ok: true, itens: itens };
  } catch (e) {
    Logger.log("listarHistoricoRelatorios erro: " + e.message);
    return { ok: false, mensagem: "Erro: " + e.message, itens: [] };
  }
}