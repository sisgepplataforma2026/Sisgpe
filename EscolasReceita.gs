// ================================================================
// ARQUIVO: EscolasReceita.gs
// MÓDULO: Captação de Novas Escolas via CNPJ
//
// FLUXO DE USO:
//   1. Execute criarAbasModuloReceita() uma vez para criar as abas
//   2. Cole os CNPJs na aba EXTRACAO_CNPJ_OFICIAL (coluna A)
//   3. Execute processarExtracaoOficialReceita() para consultar e filtrar
//   4. Revise os resultados na aba RECEITA_COMPARACAO
//   5. Execute importarNovasEscolasReceita() para importar as NOVAS
//
// ALIASES (compatibilidade com CadastroEscolas.html):
//   captarNovasEscolasReceita   → processarExtracaoOficialReceita
//   filtrarEscolasNovas         → processarExtracaoOficialReceita
//   compararComBaseEscolas      → processarExtracaoOficialReceita
//   executarPipelineReceita     → processarExtracaoOficialReceita + importarNovasEscolasReceita
//   criarAbaExtracaoCnpjOficial → criarAbasModuloReceita
// ================================================================

/* ─────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────── */
var ABA_EXTRACAO    = "EXTRACAO_CNPJ_OFICIAL";
var ABA_COMPARACAO  = "RECEITA_COMPARACAO";
var CNAE_EDUCACAO   = ["85", "8511", "8512", "8513", "8520", "8531", "8532", "8541", "8542", "8550", "8591", "8592", "8593", "8599"];
var UF_ALVO         = "ES";
var PAUSA_MS        = 1200; // intervalo entre chamadas BrasilAPI

var CHAVE_CONFIG_RECEITA_UF_    = "SISGEP_RECEITA_UF_ALVO";
var CHAVE_CONFIG_RECEITA_CNAE_  = "SISGEP_RECEITA_CNAE_LISTA";

/* ─────────────────────────────────────────────────────────────
   CONFIGURAÇÃO DE UF/CNAE (PropertiesService, sobrepõe os padrões)
───────────────────────────────────────────────────────────── */
function escolasReceitaObterConfig_() {
  var props = PropertiesService.getScriptProperties();
  var uf    = String(props.getProperty(CHAVE_CONFIG_RECEITA_UF_) || UF_ALVO || "").trim().toUpperCase();
  var cnaeSalvo = props.getProperty(CHAVE_CONFIG_RECEITA_CNAE_);
  var cnaeLista;
  if (cnaeSalvo) {
    cnaeLista = cnaeSalvo.split(",").map(function(c) { return c.trim(); }).filter(Boolean);
  } else {
    cnaeLista = CNAE_EDUCACAO.slice();
  }
  return { uf: uf || "ES", cnaeLista: cnaeLista };
}

function escolasReceitaObterConfig(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var cfg = escolasReceitaObterConfig_();
  return { ok: true, uf: cfg.uf, cnaeCsv: cfg.cnaeLista.join(", ") };
}

function escolasReceitaSalvarConfig(uf, cnaeCsv, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    uf = String(uf || "").trim().toUpperCase();
    if (uf.length !== 2) {
      return { ok: false, mensagem: "Informe a UF com 2 letras (ex.: ES)." };
    }

    var lista = String(cnaeCsv || "")
      .split(",")
      .map(function(c) { return c.replace(/\D/g, "").trim(); })
      .filter(Boolean);

    if (!lista.length) {
      return { ok: false, mensagem: "Informe ao menos um código CNAE." };
    }

    var props = PropertiesService.getScriptProperties();
    props.setProperty(CHAVE_CONFIG_RECEITA_UF_, uf);
    props.setProperty(CHAVE_CONFIG_RECEITA_CNAE_, lista.join(","));

    return { ok: true, mensagem: "Configuração salva: UF " + uf + " · " + lista.length + " código(s) CNAE." };
  } catch (e) {
    return { ok: false, mensagem: "Erro ao salvar configuração: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   1. CRIAR ABAS AUXILIARES
───────────────────────────────────────────────────────────── */
function criarAbasModuloReceita(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);

    // Aba para colar CNPJs
    var shExt = ss.getSheetByName(ABA_EXTRACAO);
    if (!shExt) {
      shExt = ss.insertSheet(ABA_EXTRACAO);
      shExt.getRange(1, 1, 1, 2).setValues([["CNPJ", "OBSERVACAO"]]);
      shExt.getRange(1, 1, 1, 2).setFontWeight("bold");
      shExt.setFrozenRows(1);
      shExt.getRange("A2").setValue("Cole os CNPJs aqui, um por linha");
      shExt.setColumnWidth(1, 180);
      shExt.setColumnWidth(2, 300);
    }

    // Aba de resultados da comparação
    var shComp = ss.getSheetByName(ABA_COMPARACAO);
    if (!shComp) {
      shComp = ss.insertSheet(ABA_COMPARACAO);
      var cabComp = [
        "CNPJ", "RAZAO_SOCIAL", "FANTASIA", "EMAIL", "TELEFONE",
        "ENDERECO", "NUMERO", "COMPLEMENTO", "BAIRRO",
        "MUNICIPIO", "UF", "CEP",
        "CNAE_PRINCIPAL", "CNAE_DESCRICAO", "SITUACAO_CADASTRAL",
        "STATUS_COMPARACAO", "OBSERVACAO_COMPARACAO"
      ];
      shComp.getRange(1, 1, 1, cabComp.length).setValues([cabComp]);
      shComp.getRange(1, 1, 1, cabComp.length).setFontWeight("bold");
      shComp.setFrozenRows(1);
      try { shComp.autoResizeColumns(1, cabComp.length); } catch(e) {}
    }

    return {
      ok: true,
      mensagem: "Abas criadas com sucesso: " + ABA_EXTRACAO + " e " + ABA_COMPARACAO + "."
    };
  } catch(e) {
    return { ok: false, mensagem: "Erro ao criar abas: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   2. PROCESSAR EXTRAÇÃO — consulta BrasilAPI, filtra e compara
───────────────────────────────────────────────────────────── */
function processarExtracaoOficialReceita(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    // Garante que as abas existem
    criarAbasModuloReceita(tokenSessao);

    var config   = escolasReceitaObterConfig_();
    var ss       = SpreadsheetApp.openById(PLANILHA_ID);
    var shExt    = ss.getSheetByName(ABA_EXTRACAO);
    var shComp   = ss.getSheetByName(ABA_COMPARACAO);
    var shEscola = ss.getSheetByName("Escolas");

    if (!shExt || shExt.getLastRow() < 2) {
      return { ok: false, mensagem: "Aba " + ABA_EXTRACAO + " vazia. Cole os CNPJs na coluna A antes de processar." };
    }

    // Lê CNPJs da aba de extração
    var linhasExt = shExt.getRange(2, 1, shExt.getLastRow() - 1, 1).getValues();
    var cnpjsBrutos = linhasExt.map(function(l) {
      return String(l[0] || "").replace(/\D/g, "").trim();
    }).filter(function(c) { return c.length === 14; });

    // Remove duplicatas
    var vistos = {};
    var cnpjs = cnpjsBrutos.filter(function(c) {
      if (vistos[c]) return false;
      vistos[c] = true;
      return true;
    });

    if (!cnpjs.length) {
      return { ok: false, mensagem: "Nenhum CNPJ válido encontrado na aba " + ABA_EXTRACAO + "." };
    }

    // Monta mapa da base de escolas existente (por CNPJ)
    var mapaEscolas = {};
    if (shEscola && shEscola.getLastRow() >= 2) {
      var hEsc    = getHeaderMapEscolas_(shEscola);
      var colCnpj = hEsc["CNPJ"];
      var colNome = hEsc["NomeEscola"];
      if (colCnpj) {
        var dadosEsc = shEscola.getRange(2, 1, shEscola.getLastRow() - 1, shEscola.getLastColumn()).getValues();
        dadosEsc.forEach(function(linha) {
          var c = String(linha[colCnpj - 1] || "").replace(/\D/g, "");
          var n = colNome ? String(linha[colNome - 1] || "").trim() : "";
          if (c.length === 14) mapaEscolas[c] = n || "Cadastrada";
        });
      }
    }

    // Limpa resultados anteriores na aba de comparação (mantém cabeçalho)
    if (shComp.getLastRow() > 1) {
      shComp.getRange(2, 1, shComp.getLastRow() - 1, shComp.getLastColumn()).clearContent();
    }

    var inseridas    = 0;
    var filtradas    = 0;
    var erros        = 0;
    var novas        = 0;
    var existentes   = 0;
    var linhasResult = [];

    for (var i = 0; i < cnpjs.length; i++) {
      var cnpj = cnpjs[i];

      try {
        var dados = consultarBrasilApiReceita_(cnpj);
        if (!dados) { erros++; continue; }

        // Filtra por UF e CNAE de educação (configuráveis via escolasReceitaSalvarConfig)
        if (dados.uf.toUpperCase() !== config.uf) { filtradas++; continue; }
        if (!ehCnaeEducacao_(dados.cnaePrincipal, config.cnaeLista)) { filtradas++; continue; }

        // Compara com base
        var statusComp, obsComp;
        if (mapaEscolas[cnpj]) {
          statusComp = "EXISTENTE";
          obsComp    = "Já cadastrada como: " + mapaEscolas[cnpj];
          existentes++;
        } else {
          statusComp = "NOVA";
          obsComp    = "Não encontrada na base de escolas";
          novas++;
        }

        linhasResult.push([
          formatarCNPJEscolas_(cnpj),
          dados.razaoSocial,
          dados.fantasia,
          dados.email,
          dados.telefone,
          dados.logradouro,
          dados.numero,
          dados.complemento,
          dados.bairro,
          dados.cidade,
          dados.uf,
          dados.cep,
          dados.cnaePrincipal,
          dados.cnaeDescricao,
          dados.situacaoCadastral,
          statusComp,
          obsComp
        ]);

        inseridas++;

      } catch(eItem) {
        Logger.log("Erro ao processar CNPJ " + cnpj + ": " + eItem.message);
        erros++;
      }

      // Pausa para não sobrecarregar a API
      if (i < cnpjs.length - 1) Utilities.sleep(PAUSA_MS);
    }

    // Grava resultados na aba de comparação
    if (linhasResult.length > 0) {
      shComp.getRange(2, 1, linhasResult.length, linhasResult[0].length).setValues(linhasResult);

      // Destaca as NOVAS em verde e EXISTENTES em cinza
      for (var r = 0; r < linhasResult.length; r++) {
        var cor = linhasResult[r][15] === "NOVA" ? "#d1fae5" : "#f1f5f9";
        shComp.getRange(r + 2, 1, 1, linhasResult[0].length).setBackground(cor);
      }

      try { shComp.autoResizeColumns(1, linhasResult[0].length); } catch(e) {}
    }

    SpreadsheetApp.flush();

    return {
      ok:        true,
      inseridas: inseridas,
      novas:     novas,
      existentes:existentes,
      filtradas: filtradas,
      erros:     erros,
      mensagem:  "Processamento concluído! Novas: " + novas + " · Existentes: " + existentes +
                 " · Fora " + config.uf + "/CNAE: " + filtradas + " · Erros: " + erros +
                 ". Revise a aba " + ABA_COMPARACAO + " antes de importar."
    };

  } catch(e) {
    return { ok: false, mensagem: "Erro no processamento: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   3. IMPORTAR NOVAS ESCOLAS
───────────────────────────────────────────────────────────── */
function importarNovasEscolasReceita(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var ss     = SpreadsheetApp.openById(PLANILHA_ID);
    var shComp = ss.getSheetByName(ABA_COMPARACAO);

    if (!shComp || shComp.getLastRow() < 2) {
      return { ok: false, mensagem: "Execute processarExtracaoOficialReceita() primeiro." };
    }

    var cab   = shComp.getRange(1, 1, 1, shComp.getLastColumn()).getValues()[0];
    var dados = shComp.getRange(2, 1, shComp.getLastRow() - 1, shComp.getLastColumn()).getValues();

    function col(nome) { return cab.indexOf(nome); }

    var iCnpj   = col("CNPJ");
    var iRazao  = col("RAZAO_SOCIAL");
    var iFant   = col("FANTASIA");
    var iEmail  = col("EMAIL");
    var iTel    = col("TELEFONE");
    var iEnd    = col("ENDERECO");
    var iNum    = col("NUMERO");
    var iComp   = col("COMPLEMENTO");
    var iBairro = col("BAIRRO");
    var iMun    = col("MUNICIPIO");
    var iUf     = col("UF");
    var iCep    = col("CEP");
    var iStatus = col("STATUS_COMPARACAO");

    if (iCnpj === -1 || iStatus === -1) {
      return { ok: false, mensagem: "Colunas obrigatórias não encontradas em " + ABA_COMPARACAO + "." };
    }

    var importadas = 0;
    var puladas    = 0;

    dados.forEach(function(linha) {
      var status = String(linha[iStatus] || "").trim().toUpperCase();
      if (status !== "NOVA") { puladas++; return; }

      var resultado = cadastrarEscola({
        nomeEscola: iRazao  > -1 ? String(linha[iRazao ] || "").trim() : "",
        fantasia:   iFant   > -1 ? String(linha[iFant  ] || "").trim() : "",
        cnpj:       iCnpj   > -1 ? String(linha[iCnpj  ] || "").trim() : "",
        email:      iEmail  > -1 ? String(linha[iEmail ] || "").trim() : "",
        telefone:   iTel    > -1 ? String(linha[iTel   ] || "").trim() : "",
        endereco:   iEnd    > -1 ? String(linha[iEnd   ] || "").trim() : "",
        numero:     iNum    > -1 ? String(linha[iNum   ] || "").trim() : "",
        complemento:iComp   > -1 ? String(linha[iComp  ] || "").trim() : "",
        bairro:     iBairro > -1 ? String(linha[iBairro] || "").trim() : "",
        municipio:  iMun    > -1 ? String(linha[iMun   ] || "").trim() : "",
        cidade:     iMun    > -1 ? String(linha[iMun   ] || "").trim() : "",
        uf:         iUf     > -1 ? String(linha[iUf    ] || "").trim() : "",
        cep:        iCep    > -1 ? String(linha[iCep   ] || "").trim() : "",
        situacao:   "ATIVA"
      }, tokenSessao);

      if (resultado && resultado.ok) importadas++;
    });

    invalidarCacheEscolas_();

    return {
      ok:        true,
      importadas:importadas,
      puladas:   puladas,
      mensagem:  "Importação concluída! " + importadas + " escola(s) importada(s)."
    };

  } catch(e) {
    return { ok: false, mensagem: "Erro na importação: " + e.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   ALIASES — compatibilidade com CadastroEscolas.html
───────────────────────────────────────────────────────────── */
function captarNovasEscolasReceita(tokenSessao)    { return processarExtracaoOficialReceita(tokenSessao); }
function filtrarEscolasNovas(tokenSessao)          { return processarExtracaoOficialReceita(tokenSessao); }
function compararComBaseEscolas(tokenSessao)       { return processarExtracaoOficialReceita(tokenSessao); }
function criarAbaExtracaoCnpjOficial(tokenSessao)  { return criarAbasModuloReceita(tokenSessao); }

function executarPipelineReceita(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  var proc = processarExtracaoOficialReceita(tokenSessao);
  if (!proc.ok) return { ok: false, mensagem: proc.mensagem };
  if ((proc.novas || 0) === 0) return {
    ok: true,
    captar: proc, filtrar: proc, comparar: proc,
    mensagem: "Nenhuma escola nova para importar."
  };
  var imp = importarNovasEscolasReceita(tokenSessao);
  return {
    ok:      imp.ok,
    captar:  { gravadas: proc.inseridas,    erros: proc.erros, invalidos: 0, repetidos: proc.existentes },
    filtrar: { filtradas: proc.inseridas,   foraUf: proc.filtradas, foraCnae: 0 },
    comparar:{ novas: proc.novas,           existentes: proc.existentes, suspeitas: 0 },
    mensagem: imp.mensagem
  };
}

/* ─────────────────────────────────────────────────────────────
   HELPERS INTERNOS
───────────────────────────────────────────────────────────── */
function consultarBrasilApiReceita_(cnpj) {
  var url  = "https://brasilapi.com.br/api/cnpj/v1/" + cnpj;
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return null;

  var j = JSON.parse(resp.getContentText() || "{}");

  return {
    razaoSocial:        String(j.razao_social               || "").trim(),
    fantasia:           String(j.nome_fantasia               || "").trim(),
    email:              String(j.email                       || "").trim().toLowerCase(),
    telefone:           montarTelReceita_(j),
    logradouro:         String(j.logradouro                  || "").trim(),
    numero:             String(j.numero                      || "").trim(),
    complemento:        String(j.complemento                 || "").trim(),
    bairro:             String(j.bairro                      || "").trim(),
    cidade:             String(j.municipio                   || "").trim(),
    uf:                 String(j.uf                          || "").trim().toUpperCase(),
    cep:                formatarCepReceita_(String(j.cep     || "").trim()),
    cnaePrincipal:      String(j.cnae_fiscal                 || "").trim(),
    cnaeDescricao:      String(j.cnae_fiscal_descricao       || "").trim(),
    situacaoCadastral:  String(j.descricao_situacao_cadastral|| "ATIVA").trim()
  };
}

function montarTelReceita_(j) {
  var ddd = String(j.ddd_telefone_1 || "").trim();
  var tel = String(j.telefone_1     || "").trim();
  if (ddd && tel) return "(" + ddd + ") " + tel;
  return tel || "";
}

function formatarCepReceita_(cep) {
  var d = String(cep || "").replace(/\D/g, "");
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, "$1-$2") : d;
}

function ehCnaeEducacao_(cnae, listaCnae) {
  if (!cnae) return false;
  var c = String(cnae).replace(/\D/g, "");
  var lista = listaCnae && listaCnae.length ? listaCnae : CNAE_EDUCACAO;
  // Aceita CNAE que começa com 85 (educação)
  if (c.length >= 2 && c.substring(0, 2) === "85") return true;
  // Aceita os códigos exatos da lista
  for (var i = 0; i < lista.length; i++) {
    var ref = String(lista[i]).replace(/\D/g, "");
    if (c.indexOf(ref) === 0 || ref.indexOf(c) === 0) return true;
  }
  return false;
}