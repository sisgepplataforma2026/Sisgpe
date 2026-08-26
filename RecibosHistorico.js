// ============================================================================
// 📄 ARQUIVO: RecibosHistorico.gs
// 📊 Módulo de Histórico e Relatórios de Recibos — SISGEP · SindEducação-ES
// ✅ CORRIGIDO: removidas funções duplicadas com Recibo.gs
// ✅ CORRIGIDO: PLANILHAS.PRODUCAO → PLANILHA_ID
// ✅ CORRIGIDO: obterEmailUsuarioAtual() → obterEmailUsuarioAtual_()
// ✅ CORRIGIDO: logSistema() removido
// ✅ ADICIONADO: listarHistoricoRecibos() — compatível com o frontend
// ✅ ADICIONADO: obterResumoHistoricoRecibos() — cards de resumo
// ✅ ADICIONADO: reenviarEmailRecibo() — botão de reenvio no histórico
// ✅ ADICIONADO: empresa/processo via JOIN com Recibo_Processos
// ============================================================================

/* ─────────────────────────────────────────────────────────────
   EXCLUIR RECIBO DO HISTÓRICO
───────────────────────────────────────────────────────────── */
function excluirReciboHistorico(dados, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, true);
  try {
    garantirEstruturaModuloRecibos_();

    // ✅ Aceita tanto string direta quanto objeto {numeroRecibo: x}
    var alvo = "";
    if (dados && typeof dados === "object") {
      alvo = String(dados.numeroRecibo || dados.numero || "").trim();
    } else {
      alvo = String(dados || "").trim();
    }

    if (!alvo) return { erro: true, mensagem: "Número do recibo não informado." };

    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

    if (!sh || sh.getLastRow() < 2) return { erro: true, mensagem: "Nenhum recibo encontrado." };

    var dadosPlan = sh.getDataRange().getValues();
    var cab = dadosPlan[0].map(function(h) { return String(h || "").trim(); });
    var idxNumero   = cab.indexOf("NUMERO_RECIBO");
    var idxProcesso = cab.indexOf("ID_PROCESSO");

    if (idxNumero === -1) return { erro: true, mensagem: "Estrutura da planilha incorreta." };

    for (var i = dadosPlan.length - 1; i >= 1; i--) {
      if (String(dadosPlan[i][idxNumero] || "").trim() === alvo) {
        var idProcesso = idxProcesso > -1 ? String(dadosPlan[i][idxProcesso] || "") : "";
        sh.deleteRow(i + 1);
        if (idProcesso) atualizarResumoProcessoRecibo_(idProcesso);
        return { erro: false, ok: true, mensagem: "Recibo excluído com sucesso." };
      }
    }

    return { erro: true, mensagem: "Recibo não encontrado." };

  } catch (e) {
    return { erro: true, mensagem: "Erro ao excluir recibo: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   MARCAR RECIBO COMO ASSINADO
───────────────────────────────────────────────────────────── */
function marcarReciboComoAssinado(numeroRecibo, observacao, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    garantirEstruturaModuloRecibos_();

    var alvo = String(numeroRecibo || "").trim();
    if (!alvo) return { erro: true, mensagem: "Número do recibo não informado." };

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

    if (!sh || sh.getLastRow() < 2) return { erro: true, mensagem: "Nenhum recibo encontrado." };

    var dados = sh.getDataRange().getValues();
    var cab = dados[0].map(function(h) { return String(h || "").trim(); });

    var idxNumero      = cab.indexOf("NUMERO_RECIBO");
    var idxStatus      = cab.indexOf("STATUS_ASSINATURA");
    var idxDataRetorno = cab.indexOf("DATA_RETORNO_ASSINADO");
    var idxObsRetorno  = cab.indexOf("OBS_RETORNO_ASSINADO");

    if (idxNumero === -1 || idxStatus === -1) {
      return { erro: true, mensagem: "Estrutura da planilha incorreta." };
    }

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][idxNumero] || "").trim() === alvo) {
        sh.getRange(i + 1, idxStatus + 1).setValue("ASSINADO_RECEBIDO");
        if (idxDataRetorno > -1) sh.getRange(i + 1, idxDataRetorno + 1).setValue(new Date());
        if (idxObsRetorno  > -1 && observacao) sh.getRange(i + 1, idxObsRetorno + 1).setValue(observacao);
        return { erro: false, mensagem: "Recibo marcado como assinado e recebido com sucesso." };
      }
    }

    return { erro: true, mensagem: "Recibo não encontrado." };

  } catch (e) {
    return { erro: true, mensagem: "Erro ao marcar recibo: " + e.message };
  }
}

/** Alias para compatibilidade */
function marcarReciboAssinadoRecebido(numeroRecibo, observacao, tokenSessao) {
  return marcarReciboComoAssinado(numeroRecibo, observacao, tokenSessao);
}

/* ─────────────────────────────────────────────────────────────
   EDITAR BENEFICIÁRIO DO RECIBO
───────────────────────────────────────────────────────────── */
function editarBeneficiarioRecibo(numeroRecibo, dadosAtualizados, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    garantirEstruturaModuloRecibos_();

    var alvo = String(numeroRecibo || "").trim();
    if (!alvo) return { erro: true, mensagem: "Número do recibo não informado." };

    dadosAtualizados = dadosAtualizados || {};

    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);

    if (!sh || sh.getLastRow() < 2) return { erro: true, mensagem: "Nenhum recibo encontrado." };

    var dados = sh.getDataRange().getValues();
    var cab = dados[0].map(function(h) { return String(h || "").trim(); });
    var idxNumero = cab.indexOf("NUMERO_RECIBO");

    if (idxNumero === -1) return { erro: true, mensagem: "Estrutura da planilha incorreta." };

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][idxNumero] || "").trim() === alvo) {
        var idxNome  = cab.indexOf("NOME");
        var idxCpf   = cab.indexOf("CPF");
        var idxEmail = cab.indexOf("EMAIL");
        var idxWhats = cab.indexOf("WHATSAPP");
        var idxPix   = cab.indexOf("PIX");

        if (dadosAtualizados.nome     && idxNome  > -1) sh.getRange(i + 1, idxNome  + 1).setValue(dadosAtualizados.nome);
        if (dadosAtualizados.cpf      && idxCpf   > -1) sh.getRange(i + 1, idxCpf   + 1).setValue(dadosAtualizados.cpf);
        if (dadosAtualizados.email    && idxEmail > -1) sh.getRange(i + 1, idxEmail + 1).setValue(dadosAtualizados.email);
        if (dadosAtualizados.whatsapp && idxWhats > -1) sh.getRange(i + 1, idxWhats + 1).setValue(dadosAtualizados.whatsapp);
        if (dadosAtualizados.pix      && idxPix   > -1) sh.getRange(i + 1, idxPix   + 1).setValue(dadosAtualizados.pix);

        return { erro: false, mensagem: "Dados atualizados com sucesso." };
      }
    }

    return { erro: true, mensagem: "Recibo não encontrado." };

  } catch (e) {
    return { erro: true, mensagem: "Erro ao editar recibo: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   LISTAR HISTÓRICO DE RECIBOS
   ✅ Nome compatível com o frontend: listarHistoricoRecibos()
   ✅ JOIN com Recibo_Processos para obter empresa e processo
   ✅ Filtros: numero, nome, processo, empresa, status, dataDe, dataAte
   ✅ Paginação: pagina, porPagina
───────────────────────────────────────────────────────────── */
function listarHistoricoRecibos(filtros, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    garantirEstruturaModuloRecibos_();

    filtros = filtros || {};

    var ss = SpreadsheetApp.openById(PLANILHA_ID);

    // ── Carregar aba de beneficiários ────────────────────────
    var shBen = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);
    if (!shBen || shBen.getLastRow() < 2) {
      return { ok: true, total: 0, pagina: 1, paginas: 1, dados: [] };
    }

    var dadosBen = shBen.getDataRange().getValues();
    var cabBen   = dadosBen[0].map(function(h) { return String(h || "").trim(); });

    var ib = function(nome) { return cabBen.indexOf(nome); };

    var ibNum    = ib("NUMERO_RECIBO");
    var ibData   = ib("DATA_GERACAO");
    var ibNome   = ib("NOME");
    var ibCpf    = ib("CPF");
    var ibValor  = ib("VALOR");
    var ibPix    = ib("PIX");
    var ibEmail  = ib("EMAIL");
    var ibWhats  = ib("WHATSAPP");
    var ibLink   = ib("LINK_PDF");
    var ibIdProc = ib("ID_PROCESSO");
    var ibCodigo = ib("CODIGO_VALIDACAO");
    var ibStEmail= ib("STATUS_ENVIO_EMAIL");
    var ibStAss  = ib("STATUS_ASSINATURA");

    // ── Montar mapa ID_PROCESSO → { processo, empresa } ──────
    var mapaProcessos = {};
    var shProc = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

    if (shProc && shProc.getLastRow() >= 2) {
      var dadosProc = shProc.getDataRange().getValues();
      var cabProc   = dadosProc[0].map(function(h) { return String(h || "").trim(); });
      var ipId  = cabProc.indexOf("ID_PROCESSO");
      var ipProc= cabProc.indexOf("PROCESSO");
      var ipEmp = cabProc.indexOf("EMPRESA");

      if (ipId > -1) {
        for (var p = 1; p < dadosProc.length; p++) {
          var idProc = String(dadosProc[p][ipId] || "").trim();
          if (idProc) {
            mapaProcessos[idProc] = {
              processo: ipProc > -1 ? String(dadosProc[p][ipProc] || "").trim() : "",
              empresa:  ipEmp  > -1 ? String(dadosProc[p][ipEmp]  || "").trim() : ""
            };
          }
        }
      }
    }

    // ── Filtros ───────────────────────────────────────────────
    var fNumero  = String(filtros.numero   || "").toLowerCase().trim();
    var fNome    = String(filtros.nome     || "").toLowerCase().trim();
    var fProcesso= String(filtros.processo || "").toLowerCase().trim();
    var fEmpresa = String(filtros.empresa  || "").toLowerCase().trim();
    var fStatus  = String(filtros.status   || "").toUpperCase().trim();
    var fDe      = filtros.dataDe  ? new Date(filtros.dataDe)  : null;
    var fAte     = filtros.dataAte ? new Date(filtros.dataAte) : null;
    if (fAte) fAte.setHours(23, 59, 59, 999);

    var pagina    = Number(filtros.pagina    || 1);
    var porPagina = Number(filtros.porPagina || 20);

    // ── Montar lista ──────────────────────────────────────────
    var lista = [];

    for (var i = 1; i < dadosBen.length; i++) {
      var linha = dadosBen[i];

      var numero = ibNum  > -1 ? String(linha[ibNum]  || "").trim() : "";
      var nome   = ibNome > -1 ? String(linha[ibNome] || "").trim() : "";

      if (!numero && !nome) continue;

      var idProcesso = ibIdProc > -1 ? String(linha[ibIdProc] || "").trim() : "";
      var infoProc   = mapaProcessos[idProcesso] || { processo: "", empresa: "" };

      var dataRaw = ibData > -1 ? linha[ibData] : null;
      var dataObj = dataRaw ? new Date(dataRaw) : null;

      var statusEmail = ibStEmail > -1 ? String(linha[ibStEmail] || "").trim().toUpperCase() : "";
      var statusAss   = ibStAss   > -1 ? String(linha[ibStAss]   || "").trim().toUpperCase() : "";

      // Aplicar filtros
      if (fNumero   && numero.toLowerCase().indexOf(fNumero)           < 0) continue;
      if (fNome     && nome.toLowerCase().indexOf(fNome)               < 0) continue;
      if (fProcesso && infoProc.processo.toLowerCase().indexOf(fProcesso) < 0) continue;
      if (fEmpresa  && infoProc.empresa.toLowerCase().indexOf(fEmpresa)   < 0) continue;
      if (fStatus   && statusEmail !== fStatus && statusAss !== fStatus)  continue;
      if (fDe  && dataObj && dataObj < fDe)  continue;
      if (fAte && dataObj && dataObj > fAte) continue;

      lista.push({
        numeroRecibo:    numero,
        codigo:          ibCodigo > -1 ? String(linha[ibCodigo] || "").trim() : "",
        nome:            nome,
        cpf:             ibCpf   > -1 ? String(linha[ibCpf]   || "").trim() : "",
        valor:           ibValor > -1 ? String(linha[ibValor] || "").trim() : "",
        pix:             ibPix   > -1 ? String(linha[ibPix]   || "").trim() : "",
        email:           ibEmail > -1 ? String(linha[ibEmail] || "").trim() : "",
        whatsapp:        ibWhats > -1 ? String(linha[ibWhats] || "").trim() : "",
        linkPdf:         ibLink  > -1 ? String(linha[ibLink]  || "").trim() : "",
        processo:        infoProc.processo,
        empresa:         infoProc.empresa,
        statusEmail:     statusEmail,
        statusAssinatura:statusAss,
        dataGeracao:     dataObj
          ? Utilities.formatDate(dataObj, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
          : ""
      });
    }

    // Mais recente primeiro
    lista.sort(function(a, b) {
      return b.numeroRecibo.localeCompare(a.numeroRecibo, "pt-BR", { numeric: true });
    });

    var total   = lista.length;
    var paginas = Math.max(1, Math.ceil(total / porPagina));
    var inicio  = (pagina - 1) * porPagina;
    var dados   = lista.slice(inicio, inicio + porPagina);

    return {
      ok:      true,
      total:   total,
      pagina:  pagina,
      paginas: paginas,
      dados:   dados
    };

  } catch (e) {
    Logger.log("❌ listarHistoricoRecibos: " + e.message);
    return { ok: false, mensagem: e.message, total: 0, pagina: 1, paginas: 1, dados: [] };
  }
}

/* ─────────────────────────────────────────────────────────────
   RESUMO DO HISTÓRICO
   ✅ Usado pelos cards de resumo no topo da aba Histórico
───────────────────────────────────────────────────────────── */
function obterResumoHistoricoRecibos(tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    garantirEstruturaModuloRecibos_();

    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var sh  = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);
    var shP = ss.getSheetByName(ABA_RECIBO_PROCESSOS);

    if (!sh || sh.getLastRow() < 2) {
      return {
        ok: true,
        totalRecibos:   0,
        totalEnviados:  0,
        valorTotal:     "0,00",
        totalProcessos: 0
      };
    }

    var dadosBen = sh.getDataRange().getValues();
    var cabBen   = dadosBen[0].map(function(h) { return String(h || "").trim(); });

    var ibNum   = cabBen.indexOf("NUMERO_RECIBO");
    var ibValor = cabBen.indexOf("VALOR");
    var ibStEm  = cabBen.indexOf("STATUS_ENVIO_EMAIL");

    var totalRecibos  = 0;
    var totalEnviados = 0;
    var somaValor     = 0;

    for (var i = 1; i < dadosBen.length; i++) {
      var linha  = dadosBen[i];
      var numero = ibNum > -1 ? String(linha[ibNum] || "").trim() : "";

      if (!numero) continue;

      totalRecibos++;

      var stEmail = ibStEm > -1 ? String(linha[ibStEm] || "").trim().toUpperCase() : "";
      if (stEmail === "ENVIADO" || stEmail === "REENVIADO") totalEnviados++;

      if (ibValor > -1) {
        var vTxt = String(linha[ibValor] || "")
          .replace(/\s/g, "")
          .replace(/^R\$/i, "");
        if (vTxt.indexOf(",") > -1 && vTxt.indexOf(".") > -1) {
          vTxt = vTxt.replace(/\./g, "").replace(",", ".");
        } else if (vTxt.indexOf(",") > -1) {
          vTxt = vTxt.replace(",", ".");
        }
        var vNum = parseFloat(vTxt);
        if (!isNaN(vNum)) somaValor += vNum;
      }
    }

    var totalProcessos = 0;
    if (shP && shP.getLastRow() >= 2) {
      totalProcessos = shP.getLastRow() - 1;
    }

    var valorFmt = somaValor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return {
      ok:             true,
      totalRecibos:   totalRecibos,
      totalEnviados:  totalEnviados,
      valorTotal:     valorFmt,
      totalProcessos: totalProcessos
    };

  } catch (e) {
    Logger.log("❌ obterResumoHistoricoRecibos: " + e.message);
    return { ok: false, mensagem: e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   REENVIAR E-MAIL DO RECIBO
   ✅ Chamado pelo botão de reenvio na tabela do histórico
───────────────────────────────────────────────────────────── */
function reenviarEmailRecibo(dados, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  try {
    dados = dados || {};

    var email   = String(dados.email   || "").trim();
    var linkPdf = String(dados.linkPdf || "").trim();
    var numero  = String(dados.numero  || "").trim();
    var nome    = String(dados.nome    || "").trim();
    var processo= String(dados.processo|| "").trim();
    var empresa = String(dados.empresa || "").trim();
    var valor   = String(dados.valor   || "").trim();

    if (!email)   return { ok: false, mensagem: "E-mail não informado." };
    if (!linkPdf) return { ok: false, mensagem: "Link do PDF não disponível." };

    var htmlBody =
      "<div style='font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.7;'>" +
        "<p>Olá, <strong>" + nome + "</strong>. Tudo bem?</p>" +
        "<p>Estamos reenviando o link do seu recibo referente ao processo nº " +
          "<strong>" + processo + "</strong> (" + empresa + ").</p>" +
        "<p><strong>📄 Recibo:</strong> " + numero + "</p>" +
        (valor ? "<p><strong>💰 Valor:</strong> R$ " + valor + "</p>" : "") +
        "<p>👉 <a href='" + linkPdf + "' target='_blank'>Clique aqui para acessar seu recibo</a></p>" +
        "<p><strong>📌 Para finalizar:</strong></p>" +
        "<ol style='padding-left:18px;'>" +
          "<li>Abrir o recibo no link acima</li>" +
          "<li>Imprimir o documento</li>" +
          "<li>Assinar o recibo</li>" +
          "<li>Tirar uma foto ou escanear</li>" +
          "<li>Enviar para nós por este e-mail ou WhatsApp</li>" +
        "</ol>" +
        "<p>✅ Você também pode assinar digitalmente.</p>" +
        "<p style='color:#b91c1c;'><strong>⚠️ Importante:</strong> O recibo só será válido após o envio assinado.</p>" +
        "<p>Se tiver dúvidas, pode nos chamar.</p>" +
        "<p><strong>Atenciosamente,</strong><br>SINDEDUCAÇÃO-ES</p>" +
      "</div>";

    var emailUsuario = String(sessaoDocumentos.email || sessaoDocumentos.usuario || "").trim().toLowerCase();

    MailApp.sendEmail({
      to:      email,
      subject: "Reenvio — Seu recibo está disponível — " + numero,
      htmlBody: htmlBody,
      replyTo: emailUsuario || ""
    });

    // Atualiza status na planilha
    rh_atualizarStatusEmailRecibo_(numero, "REENVIADO");

    return { ok: true, mensagem: "E-mail reenviado com sucesso para " + email + "." };

  } catch (e) {
    Logger.log("❌ reenviarEmailRecibo: " + e.message);
    return { ok: false, mensagem: "Erro ao reenviar: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   HELPER INTERNO — ATUALIZAR STATUS E-MAIL
───────────────────────────────────────────────────────────── */
function rh_atualizarStatusEmailRecibo_(numero, novoStatus) {
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var sh = ss.getSheetByName(ABA_RECIBO_BENEFICIARIOS);
    if (!sh || sh.getLastRow() < 2) return;

    var dados = sh.getDataRange().getValues();
    var cab   = dados[0].map(function(h) { return String(h || "").trim(); });
    var idxNum = cab.indexOf("NUMERO_RECIBO");
    var idxSt  = cab.indexOf("STATUS_ENVIO_EMAIL");

    if (idxNum < 0 || idxSt < 0) return;

    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][idxNum] || "").trim() === numero) {
        sh.getRange(i + 1, idxSt + 1).setValue(novoStatus);
        break;
      }
    }
  } catch (e) {
    Logger.log("rh_atualizarStatusEmailRecibo_: " + e.message);
  }
}

/* ─────────────────────────────────────────────────────────────
   LISTAR HISTÓRICO AVANÇADO (alias para compatibilidade)
   Mantido caso algo chame o nome antigo
───────────────────────────────────────────────────────────── */
function listarHistoricoRecibosAvancado(filtros, tokenSessao) {
  var sessaoDocumentos = exigirSessaoDocumentos_(tokenSessao, false);
  return listarHistoricoRecibos(filtros, tokenSessao);
}