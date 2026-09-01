function validarVoucherPublico(codigoValidacao) {
  try {
    criarEstruturaVoucherAuditoria();

    const codigo = String(codigoValidacao || "").trim();

    if (!codigo) {
      registrarAuditoriaVoucher_({
        codigoValidacao: "",
        protocolo: "",
        resultado: "INVALIDO",
        observacao: "Código não informado."
      });

      return {
        ok: false,
        mensagem: "Informe o código de validação."
      };
    }

    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Emitidos");

    if (!sh || sh.getLastRow() < 2) {
      registrarAuditoriaVoucher_({
        codigoValidacao: codigo,
        protocolo: "",
        resultado: "INVALIDO",
        observacao: "Aba Voucher_Emitidos vazia ou inexistente."
      });

      return {
        ok: false,
        mensagem: "Nenhum voucher emitido foi localizado."
      };
    }

    const dados = sh.getDataRange().getValues();
    const headers = dados[0].map(function(h) {
      return String(h || "").trim();
    });

    function idx(nome) {
      return headers.indexOf(nome);
    }

    const idxCodigo = idx("CODIGO_VALIDACAO");

    if (idxCodigo === -1) {
      return {
        ok: false,
        mensagem: "Coluna CODIGO_VALIDACAO não encontrada."
      };
    }

    for (let i = 1; i < dados.length; i++) {
      const linha = dados[i];

      if (String(linha[idxCodigo] || "").trim() === codigo) {
        const protocolo = linha[idx("PROTOCOLO")] || linha[idx("NUMERO_PROTOCOLO")] || "";

        registrarAuditoriaVoucher_({
          codigoValidacao: codigo,
          protocolo: protocolo,
          resultado: "VALIDO",
          observacao: "Voucher localizado com sucesso."
        });

        return {
          ok: true,
          valido: true,
          mensagem: "Voucher válido.",
          dados: {
            codigoValidacao: codigo,
            protocolo: protocolo,
            dataEmissao: linha[idx("DATA_EMISSAO")] || "",
            nome: linha[idx("NOME_SOLICITANTE")] || linha[idx("NOME")] || "",
            cpf: linha[idx("CPF")] || "",
            escola: linha[idx("ESCOLA")] || "",
            tipoDocumento: linha[idx("TIPO_DOCUMENTO")] || "",
            percentual: linha[idx("PERCENTUAL")] || "",
            linkArquivo: linha[idx("LINK_ARQUIVO")] || ""
          }
        };
      }
    }

    registrarAuditoriaVoucher_({
      codigoValidacao: codigo,
      protocolo: "",
      resultado: "INVALIDO",
      observacao: "Código não localizado."
    });

    return {
      ok: false,
      valido: false,
      mensagem: "Voucher não localizado."
    };

  } catch (e) {
    return {
      ok: false,
      mensagem: "Erro ao validar voucher: " + e.message
    };
  }
}