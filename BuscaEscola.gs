// ================================================================
// ARQUIVO: BuscaEscola.gs
// ✅ listarEscolas() mapeia EmailsTodos (CAB_ESCOLAS novo)
// ✅ listarEscolas() com CacheService (5 min) para evitar releitura
// ✅ sincronizarEscolaPorCnpj() suporta colunas antigas E novas
// ✅ Demais funções preservadas integralmente
// ================================================================

/* ============================================================= */
/* CACHE KEY                                                      */
/* ============================================================= */
var CACHE_KEY_ESCOLAS_ = "sisgep_escolas_lista_v2";
var CACHE_TTL_ESCOLAS_ = 300; // 5 minutos

function invalidarCacheEscolas_() {
  try { CacheService.getScriptCache().remove(CACHE_KEY_ESCOLAS_); } catch (e) {}
}

function colOuNovo_(h, novo, antigos) {
  if (h[novo]) return h[novo];
  for (var i = 0; i < antigos.length; i++) {
    if (h[antigos[i]]) return h[antigos[i]];
  }
  return null;
}

/* ============================================================= */
/* ENTRADA PÚBLICA                                               */
/* ============================================================= */
/** Exige sessão válida — usada diretamente por telas via google.script.run. */
function buscarEscola(query, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    query = String(query || "").trim();
    if (query.length < 2) return [];
    return buscarEscolasPorTermo_interno_(query);
  } catch (e) {
    Logger.log("buscarEscola erro: " + e.message);
    return [];
  }
}

/* ============================================================= */
/* BUSCA POR TERMO                                               */
/* ============================================================= */
/** Exige sessão válida — usada diretamente por telas via google.script.run. */
function buscarEscolasPorTermo(termo, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return buscarEscolasPorTermo_interno_(termo);
}

/**
 * Núcleo sem checagem de sessão, para uso interno de outras funções do
 * servidor que já validam a própria sessão (ou não têm sessão de usuário
 * disponível) — nunca exponha esta função diretamente a google.script.run.
 */
function buscarEscolasPorTermo_interno_(termo) {
  try {
    termo = String(termo || "").trim();
    if (!termo || termo.length < 2) return [];

    var lista = (typeof listarEscolasCadastro_interno_ === "function" ? listarEscolasCadastro_interno_() : listarEscolasOficio_interno_()) || [];
    var termoNorm = normalizarBuscaEscola_(termo);
    var termoDig  = String(termo || "").replace(/\D/g, "");

    var resultados = lista
      .map(function(item) {
        var nomeNorm           = normalizarBuscaEscola_(item.escola || item.NomeEscola || item.nome || item["Nome da escola"]);
        var fantasiaNorm       = normalizarBuscaEscola_(item.fantasia || item.Fantasia || item["Nome Fantasia"]);
        var emailNorm          = normalizarBuscaEscola_(item.email || item.Email || item["E-mail"] || item["E-mail (principal)"]);
        var emailsTodosNorm    = normalizarBuscaEscola_(item.emailsTodos || item.EmailsTodos || item["E-mails (todos)"] || item["EmailsTodos"]);
        var cnpjDigits         = String(item.cnpjLimpo || item.cnpj || "").replace(/\D/g, "");
        var enderecoNorm       = normalizarBuscaEscola_(item.endereco || item.Endereco || item["Endereço"]);
        var numeroNorm         = normalizarBuscaEscola_(item.numero || item.Numero || item["Número"]);
        var bairroNorm         = normalizarBuscaEscola_(item.bairro || item.Bairro);
        var cidadeNorm         = normalizarBuscaEscola_(item.cidade || item.municipio || item.Municipio || item["Município"] || item.Cidade);
        var ufNorm             = normalizarBuscaEscola_(item.uf || item.UF || item.Estado);
        var cidadeUfNorm       = normalizarBuscaEscola_(item.cidadeUf || item.CidadeUf || item["Cidade / UF"] || [item.cidade || item.municipio || item.Municipio || "", item.uf || item.UF || ""].filter(Boolean).join(" / "));
        var cepNorm            = String(item.cep || item.CEP || "").replace(/\D/g, "");
        var unidadeNorm        = normalizarBuscaEscola_(item.unidade || item.CodigoInterno || item.Unidade);
        var endCompletoNorm    = normalizarBuscaEscola_(item.enderecoCompleto || item.EnderecoCompleto || item["Endereço completo"]);

        var matchTexto =
          nomeNorm.indexOf(termoNorm)        > -1 ||
          fantasiaNorm.indexOf(termoNorm)    > -1 ||
          emailNorm.indexOf(termoNorm)       > -1 ||
          emailsTodosNorm.indexOf(termoNorm) > -1 ||
          enderecoNorm.indexOf(termoNorm)    > -1 ||
          numeroNorm.indexOf(termoNorm)      > -1 ||
          bairroNorm.indexOf(termoNorm)      > -1 ||
          cidadeNorm.indexOf(termoNorm)      > -1 ||
          ufNorm.indexOf(termoNorm)          > -1 ||
          cidadeUfNorm.indexOf(termoNorm)    > -1 ||
          unidadeNorm.indexOf(termoNorm)     > -1 ||
          endCompletoNorm.indexOf(termoNorm) > -1;

        var matchCnpj = termoDig ? cnpjDigits.indexOf(termoDig) > -1 : false;
        var matchCep  = termoDig ? cepNorm.indexOf(termoDig)    > -1 : false;

        if (!(matchTexto || matchCnpj || matchCep)) return null;

        item._score = pontuarBuscaEscola_({
          termoNorm: termoNorm, termoDigits: termoDig,
          nomeNorm: nomeNorm, fantasiaNorm: fantasiaNorm,
          emailNorm: emailNorm, emailsTodosNorm: emailsTodosNorm,
          cnpjDigits: cnpjDigits, enderecoNorm: enderecoNorm,
          numeroNorm: numeroNorm, bairroNorm: bairroNorm,
          cidadeNorm: cidadeNorm, ufNorm: ufNorm,
          cidadeUfNorm: cidadeUfNorm, cepNorm: cepNorm,
          unidadeNorm: unidadeNorm, enderecoCompletoNorm: endCompletoNorm
        });

        return item;
      })
      .filter(Boolean);

    resultados.sort(function(a, b) {
      var diff = (b._score || 0) - (a._score || 0);
      if (diff !== 0) return diff;
      return normalizarBuscaEscola_(a.escola).localeCompare(normalizarBuscaEscola_(b.escola), "pt-BR");
    });

    return resultados.slice(0, 20).map(function(item) {
      delete item._score;
      return item;
    });

  } catch (e) {
    Logger.log("buscarEscolasPorTermo erro: " + e.message);
    return [];
  }
}

function buscarEscolasOficioSmart(termo) {
  return buscarEscolasPorTermo_interno_(termo);
}

/* ============================================================= */
/* LISTAR ESCOLAS — com CacheService                             */
/* ESC-G: era uma segunda leitura independente da aba Escolas,    */
/* com seu próprio mapeamento de coluna (podia divergir de        */
/* listarEscolasCadastro se só um dos dois fosse corrigido no      */
/* futuro). Agora deriva da fonte única (listarEscolasCadastro,    */
/* Escolas.gs) e só reformata pro formato que os consumidores      */
/* deste arquivo esperam (cnpjLimpo, cidadeUf, enderecoCompleto).  */
/* ============================================================= */
/** Exige sessão válida — usada diretamente por telas via google.script.run. */
function listarEscolasOficio(tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  return listarEscolasOficio_interno_();
}

/**
 * Núcleo sem checagem de sessão, para uso interno de outras funções do
 * servidor que já validam a própria sessão (ou não têm sessão de usuário
 * disponível) — nunca exponha esta função diretamente a google.script.run.
 */
function listarEscolasOficio_interno_() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY_ESCOLAS_);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch (eCache) { Logger.log('[listarEscolas] cache read: ' + eCache); }
    }

    var base = (typeof listarEscolasCadastro_interno_ === "function" ? listarEscolasCadastro_interno_() : []) || [];

    var resultado = base.map(function(item) {
      var cidade   = String(item.Municipio || item.cidade || "").trim();
      var uf       = String(item.UF || item.uf || "").trim();
      var cidadeUf = [cidade, uf].filter(Boolean).join(" / ");
      var endereco = String(item.Endereco || "").trim();
      var numero   = String(item.Numero || "").trim();
      var complemento = String(item.Complemento || "").trim();
      var bairro   = String(item.Bairro || "").trim();
      var cep      = String(item.CEP || "").trim();
      var cnpj     = String(item.CNPJ || "").trim();
      var emailPrincipal = String(item.Email || "").trim();
      var emailsTodos    = String(item.EmailsTodos || "").trim() || emailPrincipal;

      return {
        escola:           String(item.NomeEscola || item.escola || "").trim(),
        fantasia:         String(item.Fantasia || "").trim(),
        cnpj:             formatarCNPJ_(cnpj),
        cnpjLimpo:        String(cnpj || "").replace(/\D/g, ""),
        email:            emailPrincipal,
        emailsTodos:      normalizarEmailsBuscaEscola_(emailsTodos),
        endereco:         endereco,
        numero:           numero,
        complemento:      complemento,
        bairro:           bairro,
        cidade:           cidade,
        uf:               uf,
        cidadeUf:         cidadeUf,
        cep:              cep,
        cepLimpo:         String(cep || "").replace(/\D/g, ""),
        unidade:          String(item.CodigoInterno || "").trim(),
        enderecoCompleto: [endereco, numero, complemento, bairro, cidadeUf, cep].filter(Boolean).join(", ")
      };
    }).filter(function(item) {
      return !!item.escola;
    });

    try {
      var compacto = resultado.map(function(e) {
        return {
          escola:      e.escola,
          fantasia:    e.fantasia,
          cnpj:        e.cnpj,
          email:       e.email,
          emailsTodos: e.emailsTodos,
          endereco:    e.endereco,
          numero:      e.numero,
          bairro:      e.bairro,
          cidade:      e.cidade,
          uf:          e.uf,
          cidadeUf:    e.cidadeUf,
          cep:         e.cep,
          unidade:     e.unidade
        };
      });
      var json = JSON.stringify(compacto);
      if (json.length < 90000) {
        cache.put(CACHE_KEY_ESCOLAS_, json, CACHE_TTL_ESCOLAS_);
      } else {
        Logger.log("[listarEscolas] lista muito grande para cache: " + json.length + " bytes");
      }
    } catch (ePut) { Logger.log('[listarEscolas] cache put: ' + ePut); }

    return resultado;

  } catch (e) {
    Logger.log("listarEscolas erro: " + e.message);
    return [];
  }
}

/* ============================================================= */
/* CONSULTA EXTERNA DE CNPJ                                      */
/* ============================================================= */
function consultarCNPJExterno(cnpj, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var digits = String(cnpj || "").replace(/\D/g, "");
    if (digits.length !== 14) {
      return { erro: true, mensagem: "CNPJ inválido (precisa ter 14 dígitos)." };
    }

    var r1 = UrlFetchApp.fetch("https://brasilapi.com.br/api/cnpj/v1/" + digits, { muteHttpExceptions: true });

    if (r1.getResponseCode() === 200) {
      var j1 = JSON.parse(r1.getContentText());
      var l1 = String(j1.logradouro || "").trim();
      var n1 = String(j1.numero || "").trim();
      var c1 = String(j1.complemento || "").trim();
      var b1 = String(j1.bairro || "").trim();
      var m1 = String(j1.municipio || "").trim();
      var u1 = String(j1.uf || "").trim();
      var p1 = String(j1.cep || "").trim();
      return {
        erro: false,
        nome: j1.razao_social || "", razaoSocial: j1.razao_social || "",
        nomeFantasia: j1.nome_fantasia || "", fantasia: j1.nome_fantasia || "",
        cnpj: formatarCNPJ_(digits),
        email: j1.email || "",
        telefone1: formatarTelExterno_(j1.ddd_telefone_1, j1.telefone_1),
        telefone2: formatarTelExterno_(j1.ddd_telefone_2, j1.telefone_2),
        tel1: formatarTelExterno_(j1.ddd_telefone_1, j1.telefone_1),
        tel2: formatarTelExterno_(j1.ddd_telefone_2, j1.telefone_2),
        endereco: l1, numero: n1, complemento: c1, bairro: b1,
        municipio: m1, cidade: m1, uf: u1,
        cidadeUf: [m1, u1].filter(Boolean).join(" / "),
        cep: formatarCEPBuscaEscola_(p1),
        situacao: j1.descricao_situacao_cadastral || "",
        situacaoCadastral: j1.descricao_situacao_cadastral || "",
        enderecoFormatado: [l1, n1, c1, b1, m1, u1].filter(Boolean).join(", ")
      };
    }

    var r2 = UrlFetchApp.fetch("https://receitaws.com.br/v1/cnpj/" + digits, { muteHttpExceptions: true });

    if (r2.getResponseCode() === 200) {
      var j2 = JSON.parse(r2.getContentText());
      if (j2.status === "ERROR") return { erro: true, mensagem: j2.message || "CNPJ não encontrado." };
      var l2 = String(j2.logradouro || "").trim();
      var n2 = String(j2.numero || "").trim();
      var c2 = String(j2.complemento || "").trim();
      var b2 = String(j2.bairro || "").trim();
      var m2 = String(j2.municipio || "").trim();
      var u2 = String(j2.uf || "").trim();
      var p2 = String(j2.cep || "").trim();
      return {
        erro: false,
        nome: j2.nome || "", razaoSocial: j2.nome || "",
        nomeFantasia: j2.fantasia || "", fantasia: j2.fantasia || "",
        cnpj: formatarCNPJ_(digits),
        email: j2.email || "",
        telefone1: j2.telefone || "", telefone2: "",
        tel1: j2.telefone || "", tel2: "",
        endereco: l2, numero: n2, complemento: c2, bairro: b2,
        municipio: m2, cidade: m2, uf: u2,
        cidadeUf: [m2, u2].filter(Boolean).join(" / "),
        cep: formatarCEPBuscaEscola_(p2),
        situacao: j2.situacao || "", situacaoCadastral: j2.situacao || "",
        enderecoFormatado: [l2, n2, c2, b2, m2, u2].filter(Boolean).join(", ")
      };
    }

    return { erro: true, mensagem: "CNPJ não encontrado." };

  } catch (e) {
    return { erro: true, mensagem: "Erro ao consultar CNPJ: " + e.message };
  }
}

function consultarCnpjEscola(cnpj, tokenSessao) {
  return consultarCNPJExterno(cnpj, tokenSessao);
}

/* ============================================================= */
/* SINCRONIZAR ESCOLA POR CNPJ                                   */
/* ✅ Suporta colunas antigas E novas (CAB_ESCOLAS)              */
/* ============================================================= */
function sincronizarEscolaPorCnpj(cnpj, forcar, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, false);
  try {
    var externo = consultarCNPJExterno(cnpj, tokenSessao);
    if (externo.erro) return { erro: true, mensagem: externo.mensagem };

    var digits  = String(cnpj || "").replace(/\D/g, "");
    var ss      = SpreadsheetApp.openById(PLANILHA_ID);
    var aba     = ss.getSheetByName("Escolas") || ss.getSheetByName(PLANILHA_REGISTRO);

    if (!aba) return { erro: true, mensagem: "Aba de escolas não encontrada." };

    var h = getHeaderMap_(aba);

    // ✅ Suporte a nomes de coluna antigos E novos (CAB_ESCOLAS)

var colCnpj   = colOuNovo_(h, "CNPJ",         ["CNPJ"]);
    var colNome   = colOuNovo_(h, "NomeEscola",    ["Escola (Razão Social)", "Escola"]);
    var colFant   = colOuNovo_(h, "Fantasia",      ["Nome Fantasia"]);
    var colEmail  = colOuNovo_(h, "Email",         ["E-mail (principal)", "E-mail", "Email"]);
    var colEmails = colOuNovo_(h, "EmailsTodos",   ["E-mails (todos)", "Emails (todos)", "E-mails", "Emails"]);
    var colEnd    = colOuNovo_(h, "Endereco",      ["Endereço"]);
    var colNum    = colOuNovo_(h, "Numero",        ["Número", "Nº"]);
    var colComp   = colOuNovo_(h, "Complemento",   ["Complemento"]);
    var colCidade = colOuNovo_(h, "Municipio",     ["Cidade", "Município"]);
    var colUf     = colOuNovo_(h, "UF",            ["UF"]);
    var colBairro = colOuNovo_(h, "Bairro",        ["Bairro"]);
    var colCep    = colOuNovo_(h, "CEP",           ["CEP"]);

    if (!colCnpj) return { erro: true, mensagem: "Coluna CNPJ não encontrada." };

    var totalLinhas = aba.getLastRow() - 1;
    var dados = totalLinhas > 0 ? aba.getRange(2, 1, totalLinhas, aba.getLastColumn()).getValues() : [];
    var atualizado = false;

    for (let i = 0; i < dados.length; i++) {
      if (String(dados[i][colCnpj - 1] || "").replace(/\D/g, "") !== digits) continue;

var row = i + 2;
      var totalCols = aba.getLastColumn();
      var valoresLinha = aba.getRange(row, 1, 1, totalCols).getValues()[0];

      if (colNome   && externo.razaoSocial)  valoresLinha[colNome   - 1] = externo.razaoSocial;
      if (colFant   && externo.fantasia)     valoresLinha[colFant   - 1] = externo.fantasia;
      if (colEmail  && externo.email)        valoresLinha[colEmail  - 1] = externo.email;
      if (colEmails && externo.email)        valoresLinha[colEmails - 1] = normalizarEmailsBuscaEscola_(externo.email);
      if (colEnd    && externo.endereco)     valoresLinha[colEnd    - 1] = externo.endereco;
      if (colNum    && externo.numero)       valoresLinha[colNum    - 1] = externo.numero;
      if (colComp   && externo.complemento)  valoresLinha[colComp   - 1] = externo.complemento;
      if (colCidade && externo.cidade)       valoresLinha[colCidade - 1] = externo.cidade;
      if (colUf     && externo.uf)           valoresLinha[colUf     - 1] = externo.uf;
      if (colBairro && externo.bairro)       valoresLinha[colBairro - 1] = externo.bairro;
      if (colCep    && externo.cep)          valoresLinha[colCep    - 1] = externo.cep;

      aba.getRange(row, 1, 1, totalCols).setValues([valoresLinha]);
      atualizado = true;

      // ✅ Invalida cache após atualização
      invalidarCacheEscolas_();
      break;
    }

    if (!atualizado && forcar === true) {
      var novaLinha = new Array(aba.getLastColumn()).fill("");
      if (colNome)   novaLinha[colNome - 1]   = externo.razaoSocial || externo.nome || "";
      if (colFant)   novaLinha[colFant - 1]   = externo.fantasia || "";
      if (colCnpj)   novaLinha[colCnpj - 1]   = formatarCNPJ_(digits);
      if (colEmail)  novaLinha[colEmail - 1]  = externo.email || "";
      if (colEmails) novaLinha[colEmails - 1] = normalizarEmailsBuscaEscola_(externo.email || "");
      if (colEnd)    novaLinha[colEnd - 1]    = externo.endereco || "";
      if (colNum)    novaLinha[colNum - 1]    = externo.numero || "";
      if (colComp)   novaLinha[colComp - 1]   = externo.complemento || "";
      if (colCidade) novaLinha[colCidade - 1] = externo.cidade || "";
      if (colUf)     novaLinha[colUf - 1]     = externo.uf || "";
      if (colBairro) novaLinha[colBairro - 1] = externo.bairro || "";
      if (colCep)    novaLinha[colCep - 1]    = externo.cep || "";
      aba.appendRow(novaLinha);
      invalidarCacheEscolas_();
      return { erro: false, status: "NOVA", novo: true, consulta: externo, dadosExternos: externo, camposDivergentes: [], divergencias: [] };
    }

    return atualizado
      ? { erro: false, status: "ATUALIZADA", novo: false, consulta: externo, dadosExternos: externo, camposDivergentes: [], divergencias: [] }
      : { erro: false, status: "SEM ALTERAÇÃO", novo: false, consulta: externo, dadosExternos: externo, camposDivergentes: [], divergencias: [] };

  } catch (e) {
    return { erro: true, mensagem: "Erro ao sincronizar: " + e.message };
  }
}

function sincronizarTodasEscolas(forcar, tokenSessao) {
  exigirSessaoDocumentos_(tokenSessao, true);
  try {
    var ss  = SpreadsheetApp.openById(PLANILHA_ID);
    var aba = ss.getSheetByName("Escolas") || ss.getSheetByName(PLANILHA_REGISTRO);
    if (!aba) return { erro: true, mensagem: "Aba de escolas não encontrada." };

    var h = getHeaderMap_(aba);
    var colCnpj = h["CNPJ"];
    if (!colCnpj) return { erro: true, mensagem: "Coluna CNPJ não encontrada." };

    var totalLinhas = aba.getLastRow() - 1;
    var dados = totalLinhas > 0 ? aba.getRange(2, 1, totalLinhas, aba.getLastColumn()).getValues() : [];

    var atualizadas = 0, erros = 0, resultados = [];
    var visto = {};

    for (let i = 0; i < dados.length; i++) {
      var digits = String(dados[i][colCnpj - 1] || "").replace(/\D/g, "");
      if (digits.length !== 14 || visto[digits]) continue;
      visto[digits] = true;
      Utilities.sleep(1200);

      var resp = sincronizarEscolaPorCnpj(digits, forcar === true, tokenSessao);
      if (resp.erro) {
        erros++;
        resultados.push({ ok: false, status: "ERRO", cnpj: formatarCNPJ_(digits), mensagem: resp.mensagem });
      } else {
        atualizadas++;
        resultados.push({ ok: true, status: resp.status, cnpj: formatarCNPJ_(digits) });
      }
    }

    invalidarCacheEscolas_();
    return { erro: false, total: Object.keys(visto).length, atualizadas, erros, finalizado: true, resultados, mensagem: "Sincronização concluída." };

  } catch (e) {
    return { erro: true, mensagem: "Erro na sincronização em lote: " + e.message };
  }
}

/* ============================================================= */
/* HELPERS                                                       */
/* ============================================================= */

function normalizarBuscaEscola_(txt) {
  return String(txt || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function pontuarBuscaEscola_(ctx) {
  var score = 0;
  if (ctx.termoDigits) {
    if (ctx.cnpjDigits === ctx.termoDigits)                      score += 250;
    else if (ctx.cnpjDigits.indexOf(ctx.termoDigits) === 0)      score += 180;
    else if (ctx.cnpjDigits.indexOf(ctx.termoDigits) > -1)       score += 120;
    if (ctx.cepNorm === ctx.termoDigits)                          score += 110;
    else if (ctx.cepNorm.indexOf(ctx.termoDigits) === 0)          score += 80;
    else if (ctx.cepNorm.indexOf(ctx.termoDigits) > -1)           score += 50;
  }
  if (ctx.nomeNorm === ctx.termoNorm)                             score += 220;
  else if (ctx.nomeNorm.indexOf(ctx.termoNorm) === 0)             score += 170;
  else if (ctx.nomeNorm.indexOf(ctx.termoNorm) > -1)              score += 120;
  if (ctx.fantasiaNorm === ctx.termoNorm)                         score += 180;
  else if (ctx.fantasiaNorm.indexOf(ctx.termoNorm) === 0)         score += 130;
  else if (ctx.fantasiaNorm.indexOf(ctx.termoNorm) > -1)          score += 90;
  if (ctx.emailNorm === ctx.termoNorm)                            score += 120;
  else if (ctx.emailNorm.indexOf(ctx.termoNorm) === 0)            score += 85;
  else if (ctx.emailNorm.indexOf(ctx.termoNorm) > -1)             score += 60;
  if (ctx.emailsTodosNorm === ctx.termoNorm)                      score += 110;
  else if (ctx.emailsTodosNorm.indexOf(ctx.termoNorm) === 0)      score += 80;
  else if (ctx.emailsTodosNorm.indexOf(ctx.termoNorm) > -1)       score += 55;
  if (ctx.enderecoNorm === ctx.termoNorm)                         score += 90;
  else if (ctx.enderecoNorm.indexOf(ctx.termoNorm) === 0)         score += 65;
  else if (ctx.enderecoNorm.indexOf(ctx.termoNorm) > -1)          score += 45;
  if (ctx.numeroNorm === ctx.termoNorm)                           score += 35;
  if (ctx.bairroNorm === ctx.termoNorm)                           score += 70;
  else if (ctx.bairroNorm.indexOf(ctx.termoNorm) === 0)           score += 50;
  else if (ctx.bairroNorm.indexOf(ctx.termoNorm) > -1)            score += 35;
  if (ctx.cidadeNorm === ctx.termoNorm)                           score += 75;
  else if (ctx.cidadeNorm.indexOf(ctx.termoNorm) === 0)           score += 55;
  else if (ctx.cidadeNorm.indexOf(ctx.termoNorm) > -1)            score += 40;
  if (ctx.cidadeUfNorm === ctx.termoNorm)                         score += 70;
  else if (ctx.cidadeUfNorm.indexOf(ctx.termoNorm) === 0)         score += 50;
  else if (ctx.cidadeUfNorm.indexOf(ctx.termoNorm) > -1)          score += 35;
  if (ctx.unidadeNorm === ctx.termoNorm)                          score += 50;
  else if (ctx.unidadeNorm.indexOf(ctx.termoNorm) === 0)          score += 35;
  else if (ctx.unidadeNorm.indexOf(ctx.termoNorm) > -1)           score += 25;
  if (ctx.enderecoCompletoNorm === ctx.termoNorm)                 score += 100;
  else if (ctx.enderecoCompletoNorm.indexOf(ctx.termoNorm) === 0) score += 70;
  else if (ctx.enderecoCompletoNorm.indexOf(ctx.termoNorm) > -1)  score += 50;
  return score;
}

function normalizarEmailsBuscaEscola_(valor) {
  return String(valor || "").split(/[\n,;]+/)
    .map(function(e) { return String(e || "").trim().toLowerCase(); })
    .filter(Boolean)
    .filter(function(e, i, arr) { return arr.indexOf(e) === i; })
    .join(", ");
}


function formatarCNPJ_(d) {
  d = String(d || "").replace(/\D/g, "");
  if (d.length !== 14) return d;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatarCEPBuscaEscola_(cep) {
  cep = String(cep || "").replace(/\D/g, "");
  if (cep.length !== 8) return String(cep || "");
  return cep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function formatarTelExterno_(ddd, tel) {
  if (!ddd && !tel) return "";
  if (ddd && tel) return "(" + String(ddd).trim() + ") " + String(tel).trim();
  return String(tel || ddd || "").trim();
}

