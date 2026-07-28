// =============================================================================
// ARQUIVO: VoucherCadastro.gs
// Cadastro, busca, atualização e validação sindical do módulo Voucher
// =============================================================================

/* ================= CADASTRO ================= */

function registrarOuAtualizarCadastroVoucher(dados) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const sh = ss.getSheetByName("Voucher_Cadastros");
  if (!sh) throw new Error("A aba Voucher_Cadastros não foi encontrada.");

  const cpf = normalizarCPF_(dados.cpf);
  if (!cpf) throw new Error("CPF inválido.");

  const ultimaLinha = sh.getLastRow();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const registros = ultimaLinha > 1
    ? sh.getRange(2, 1, ultimaLinha - 1, sh.getLastColumn()).getValues()
    : [];

  const idxCpf = headers.indexOf("CPF");
  const idxId = headers.indexOf("ID_CADASTRO");
  const idxDataCad = headers.indexOf("DATA_CADASTRO");

  let linhaExistente = -1;
  let registroExistente = null;

  for (let i = 0; i < registros.length; i++) {
    if (normalizarCPF_(registros[i][idxCpf]) === cpf) {
      linhaExistente = i + 2;
      registroExistente = registros[i];
      break;
    }
  }

  const escolaInfo = buscarEscolaPorNome_(dados.escolaAtual || "");
  const hoje = new Date();

  const novoRegistro = {
    ID_CADASTRO: registroExistente ? registroExistente[idxId] : gerarIdPadrao_("CAD"),
    DATA_CADASTRO: registroExistente ? registroExistente[idxDataCad] : hoje,
    DATA_ULTIMA_ATUALIZACAO: hoje,
    CPF: cpf,
    NOME: valorSeguroVoucher_(dados.nome),
    DATA_NASCIMENTO: formatDateInput_(dados.dataNascimento),
    IDADE: calcularIdade_(dados.dataNascimento),
    TELEFONE: valorSeguroVoucher_(dados.telefone),
    EMAIL: valorSeguroVoucher_(dados.email),
    ENDERECO: valorSeguroVoucher_(dados.endereco),
    ESCOLA_ATUAL: escolaInfo.escola || valorSeguroVoucher_(dados.escolaAtual),
    UNIDADE_ESCOLA: escolaInfo.unidade || "",
    CNPJ_ESCOLA: escolaInfo.cnpj || "",
    CIDADE_ESCOLA: escolaInfo.cidade || "",
    CARGO_FUNCAO: valorSeguroVoucher_(dados.cargoFuncao),
    SITUACAO_VINCULO: valorSeguroVoucher_(dados.situacaoVinculo),
    SITUACAO_SINDICAL: valorSeguroVoucher_(dados.situacaoSindical || "PENDENTE_VALIDACAO"),
    ORIGEM_CADASTRO: valorSeguroVoucher_(dados.origemCadastro || "PORTAL_VOUCHER"),
    STATUS_CADASTRO: registroExistente ? "ATUALIZADO" : "CADASTRO_INICIAL",
    OBSERVACOES: valorSeguroVoucher_(dados.observacoes)
  };

  const rowArray = headers.map(function(h) {
    return novoRegistro[h] !== undefined ? novoRegistro[h] : "";
  });

  if (linhaExistente > 0) {
    sh.getRange(linhaExistente, 1, 1, rowArray.length).setValues([rowArray]);
    registrarHistoricoVoucher_("", cpf, "CADASTRO_ATUALIZADO", "SISTEMA", "Cadastro atualizado.");
    return { status: "ATUALIZADO", idCadastro: novoRegistro.ID_CADASTRO, cpf: cpf };
  }

  sh.appendRow(rowArray);
  registrarHistoricoVoucher_("", cpf, "CADASTRO_INICIAL", "SISTEMA", "Cadastro inicial criado.");
  return { status: "CADASTRO_INICIAL", idCadastro: novoRegistro.ID_CADASTRO, cpf: cpf };
}

/* ================= IDENTIFICAÇÃO NO PORTAL ================= */

function identificarSolicitanteVoucher(payload) {
  const cpf = normalizarCPF_(payload && payload.cpf ? payload.cpf : "");
  const dataNascimento = payload && payload.dataNascimento ? String(payload.dataNascimento).trim() : "";

  if (!cpf) throw new Error("Informe um CPF válido.");

  const resultado = buscarCadastroVoucherPorCpf_(cpf);

  if (!resultado.encontrado) {
    return {
      encontrado: false,
      cpf: cpf,
      cadastro: null,
      mensagem: "Cadastro não localizado. Preencha os dados para realizar o primeiro cadastro."
    };
  }

  if (dataNascimento) {
    const dataBase = formatDateInput_(
      resultado.cadastro.DATA_NASCIMENTO ||
      resultado.cadastro.dataNascimento
    );

    if (dataBase && dataBase !== dataNascimento) {
      return {
        encontrado: false,
        cpf: cpf,
        cadastro: null,
        mensagem: "Cadastro não localizado com os dados informados."
      };
    }
  }

  return resultado;
}

/* ================= BUSCA CPF ================= */

function buscarCadastroVoucherPorCpf_(cpf) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const cpfLimpo = normalizarCPF_(cpf);

  if (!cpfLimpo) {
    return { encontrado: false, cpf: "", cadastro: null };
  }

  const resultadoVoucher = buscarCadastroEmVoucherCadastros_(ss, cpfLimpo);
  if (resultadoVoucher.encontrado) return resultadoVoucher;

  const resultadoAssociado = buscarCadastroNaBaseAssociados_(ss, cpfLimpo);
  if (resultadoAssociado.encontrado) return resultadoAssociado;

  return {
    encontrado: false,
    cpf: cpfLimpo,
    cadastro: null,
    origem: "NAO_LOCALIZADO"
  };
}

/* ================= BUSCA EM Voucher_Cadastros ================= */

function buscarCadastroEmVoucherCadastros_(ss, cpfLimpo) {
  const sh = ss.getSheetByName("Voucher_Cadastros");

  if (!sh || sh.getLastRow() < 2) {
    return { encontrado: false, cpf: cpfLimpo, cadastro: null };
  }

  const headers = obterHeaders_(sh);
  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const idxCpf = headers.indexOf("CPF");

  if (idxCpf === -1) {
    return { encontrado: false, cpf: cpfLimpo, cadastro: null };
  }

  for (let i = 0; i < dados.length; i++) {
    if (normalizarCPF_(dados[i][idxCpf]) === cpfLimpo) {
      const registro = mapRowToObject_(headers, dados[i]);

      return {
        encontrado: true,
        origem: "VOUCHER_CADASTROS",
        cpf: cpfLimpo,
        cadastro: {
          idCadastro: registro.ID_CADASTRO || "",
          cpf: normalizarCPF_(registro.CPF || ""),
          nome: registro.NOME || "",
          dataNascimento: formatDateInput_(registro.DATA_NASCIMENTO),
          telefone: registro.TELEFONE || "",
          email: registro.EMAIL || "",
          endereco: registro.ENDERECO || "",
          escolaAtual: registro.ESCOLA_ATUAL || "",
          cargoFuncao: registro.CARGO_FUNCAO || "",
          situacaoVinculo: registro.SITUACAO_VINCULO || "",
          situacaoSindical: registro.SITUACAO_SINDICAL || "PENDENTE_VALIDACAO",
          origemCadastro: registro.ORIGEM_CADASTRO || "VOUCHER_CADASTROS"
        }
      };
    }
  }

  return { encontrado: false, cpf: cpfLimpo, cadastro: null };
}

/* ================= BUSCA NA ABA Associados ================= */

function buscarCadastroNaBaseAssociados_(ss, cpfLimpo) {
  const sh = ss.getSheetByName("Associados");

  if (!sh || sh.getLastRow() < 2) {
    return { encontrado: false, cpf: cpfLimpo, cadastro: null };
  }

  const headers = obterHeaders_(sh).map(function(h) {
    return String(h || "").trim();
  });

  function idx(nome) {
    return headers.indexOf(nome);
  }

  const idxNomeFantasia = idx("Nome fantasia");
  const idxNome = idx("Nome");
  const idxCpf = idx("CPF");
  const idxFiliado = idx("Filiado");
  const idxLogradouro = idx("Logradouro");
  const idxNumero = idx("Número");
  const idxBairro = idx("Bairro");
  const idxCidade = idx("Cidade");
  const idxCep = idx("CEP");
  const idxCelular = idx("Celular");
  const idxCelular2 = idx("CELULAR2");
  const idxEmail = idx("E-mail");

  if (idxCpf === -1) {
    return { encontrado: false, cpf: cpfLimpo, cadastro: null };
  }

  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (let i = 0; i < dados.length; i++) {
    if (normalizarCPF_(dados[i][idxCpf]) === cpfLimpo) {
      const filiadoRaw = idxFiliado > -1
        ? String(dados[i][idxFiliado] || "").trim().toUpperCase()
        : "";

      const ehFiliado =
        filiadoRaw === "S" ||
        filiadoRaw === "SIM" ||
        filiadoRaw === "ASSOCIADO" ||
        filiadoRaw === "ATIVO";

      const enderecoPartes = [
        idxLogradouro > -1 ? dados[i][idxLogradouro] : "",
        idxNumero > -1 ? dados[i][idxNumero] : "",
        idxBairro > -1 ? dados[i][idxBairro] : "",
        idxCidade > -1 ? dados[i][idxCidade] : "",
        idxCep > -1 ? dados[i][idxCep] : ""
      ].filter(function(v) {
        return String(v || "").trim() !== "";
      });

      const cadastro = {
        idCadastro: "",
        cpf: cpfLimpo,
        nome: idxNome > -1 ? String(dados[i][idxNome] || "").trim() : "",
        dataNascimento: "",
        telefone: idxCelular > -1 ? String(dados[i][idxCelular] || "").trim() : "",
        celular2: idxCelular2 > -1 ? String(dados[i][idxCelular2] || "").trim() : "",
        email: idxEmail > -1 ? String(dados[i][idxEmail] || "").trim() : "",
        endereco: enderecoPartes.join(", "),
        escolaAtual: idxNomeFantasia > -1 ? String(dados[i][idxNomeFantasia] || "").trim() : "",
        cargoFuncao: "",
        situacaoVinculo: "",
        situacaoSindical: ehFiliado ? "ASSOCIADO" : "NAO_ASSOCIADO",
        origemCadastro: "BASE_ASSOCIADOS"
      };

      try {
        registrarOuAtualizarCadastroVoucher({
          cpf: cpfLimpo,
          nome: cadastro.nome,
          dataNascimento: "",
          telefone: cadastro.telefone || cadastro.celular2,
          email: cadastro.email,
          endereco: cadastro.endereco,
          escolaAtual: cadastro.escolaAtual,
          cargoFuncao: "",
          situacaoVinculo: "",
          situacaoSindical: cadastro.situacaoSindical,
          origemCadastro: "BASE_ASSOCIADOS",
          observacoes: "Importado automaticamente da aba Associados."
        });

        atualizarSituacaoSindicalCadastro_(cpfLimpo, cadastro.situacaoSindical);
      } catch (eSync) {
        Logger.log("Não foi possível sincronizar Voucher_Cadastros: " + eSync.message);
      }

      return {
        encontrado: true,
        origem: "ASSOCIADOS",
        cpf: cpfLimpo,
        cadastro: cadastro
      };
    }
  }

  return { encontrado: false, cpf: cpfLimpo, cadastro: null };
}

/* ================= CONSULTA SINDICAL BASE ASSOCIADOS ================= */

function consultarAssociadoNaBase_(cpf) {
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  const cpfLimpo = normalizarCPF_(cpf);

  const resultado = buscarCadastroNaBaseAssociados_(ss, cpfLimpo);

  if (!resultado.encontrado) {
    return {
      encontrado: false,
      filiado: false,
      situacao: "NAO_LOCALIZADO",
      cadastro: null
    };
  }

  const situacao = String(resultado.cadastro.situacaoSindical || "").toUpperCase();

  return {
    encontrado: true,
    filiado: situacao === "ASSOCIADO",
    situacao: situacao,
    cadastro: resultado.cadastro
  };
}

/* ================= ATUALIZAÇÃO DE SITUAÇÃO SINDICAL ================= */

function atualizarSituacaoSindicalCadastro_(cpf, situacao) {
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName("Voucher_Cadastros");

    if (!sh || sh.getLastRow() < 2) return;

    const headers = obterHeaders_(sh);
    const idxCpf = headers.indexOf("CPF");
    const idxSit = headers.indexOf("SITUACAO_SINDICAL");

    if (idxCpf === -1 || idxSit === -1) return;

    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

    for (let i = 0; i < dados.length; i++) {
      if (normalizarCPF_(dados[i][idxCpf]) === normalizarCPF_(cpf)) {
        sh.getRange(i + 2, idxSit + 1).setValue(String(situacao || "").toUpperCase());
        break;
      }
    }

  } catch (e) {
    Logger.log("atualizarSituacaoSindicalCadastro_ erro: " + e.message);
  }
}