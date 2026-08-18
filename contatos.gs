// =========================
// ARQUIVO: Contatos.gs
// AÇÃO: pode substituir o arquivo inteiro
// =========================

const ABA_CONTATOS_SISGEP = "Contatos";
const ABA_LISTAS_TRANSMISSAO_SISGEP = "Listas_Transmissao";
const CABECALHO_CONTATOS_SISGEP = [
  "ID",
  "Nome",
  "Telefone",
  "Telefone2",
  "Email",
  "Cidade",
  "Escola",
  "Status",
  "Tags",
  "Notas",
  "Foto",
  "DataCadastro",
  "DataAtualizacao"
];

/* ================================================================
 * HELPERS
 * ================================================================ */

function getPlanilhaContatosId_() {
  return getPlanilhasConfig_().CONTATOS;
}

function abrirPlanilhaContatos_() {
  return SpreadsheetApp.openById(getPlanilhaContatosId_());
}

function obterAbaContatos_() {
  const ss = abrirPlanilhaContatos_();
  let aba = ss.getSheetByName(ABA_CONTATOS_SISGEP);

  if (!aba) {
    aba = ss.insertSheet(ABA_CONTATOS_SISGEP);
  }

  garantirCabecalhoContatos_(aba);
  return aba;
}

function garantirCabecalhoContatos_(aba) {
  const ultimaColunaAtual = Math.max(aba.getLastColumn(), CABECALHO_CONTATOS_SISGEP.length);

  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, CABECALHO_CONTATOS_SISGEP.length).setValues([CABECALHO_CONTATOS_SISGEP]);
    aba.getRange(1, 1, 1, CABECALHO_CONTATOS_SISGEP.length).setFontWeight("bold").setBackground("#f1f5f9");
    aba.setFrozenRows(1);
    aba.autoResizeColumns(1, CABECALHO_CONTATOS_SISGEP.length);
    return;
  }

  const cabAtual = aba.getRange(1, 1, 1, ultimaColunaAtual).getValues()[0].map(function(h) {
    return String(h || "").trim();
  });

  let alterou = false;

  CABECALHO_CONTATOS_SISGEP.forEach(function(coluna, i) {
    if (String(cabAtual[i] || "").trim() !== coluna) {
      aba.getRange(1, i + 1).setValue(coluna);
      alterou = true;
    }
  });

  if (alterou) {
    aba.getRange(1, 1, 1, CABECALHO_CONTATOS_SISGEP.length).setFontWeight("bold").setBackground("#f1f5f9");
    aba.setFrozenRows(1);
    aba.autoResizeColumns(1, CABECALHO_CONTATOS_SISGEP.length);
  }
}

function obterHeaderMapContatos_(aba) {
  const headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(function(h) {
    return String(h || "").trim();
  });

  const map = {};
  headers.forEach(function(h, i) {
    map[h.toLowerCase()] = i;
  });
  return map;
}

function valorSeguroContato_(valor) {
  return valor == null ? "" : String(valor).trim();
}

function gerarIdContato_() {
  return Utilities.getUuid().substring(0, 8).toUpperCase();
}

function obterDataAgoraIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function normalizarStatusContato_(status) {
  const s = String(status || "").trim().toUpperCase();
  if (s === "ATIVO" || s === "INATIVO" || s === "BLOQUEADO") return s;
  return "ATIVO";
}

function parseTagsContato_(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map(function(t) { return String(t || "").trim().toLowerCase(); })
      .filter(Boolean);
  }

  return String(tags || "")
    .split(/[;,|]/)
    .map(function(t) { return String(t || "").trim().toLowerCase(); })
    .filter(Boolean);
}

function tagsParaSalvarContato_(tags) {
  return parseTagsContato_(tags).join(";");
}

function tagsParaRetornoContato_(tags) {
  return parseTagsContato_(tags);
}

function normalizarTelefoneContatoRetorno_(telefone) {
  const limpo = normalizarTelefoneBR_(telefone || "");
  return limpo ? formatarTelefoneBR_(limpo) : "";
}

function obterIndiceColuna_(headerMap, nomeColuna) {
  const chave = String(nomeColuna || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(headerMap, chave) ? headerMap[chave] : -1;
}

function obterValorLinha_(linha, idx) {
  return idx > -1 ? linha[idx] : "";
}

function definirValorLinha_(linha, idx, valor) {
  if (idx > -1) linha[idx] = valor;
}

function montarObjetoContato_(linha, idx) {
  const telefoneLimpo = normalizarTelefoneBR_(obterValorLinha_(linha, idx.telefone));
  const telefone2Limpo = normalizarTelefoneBR_(obterValorLinha_(linha, idx.telefone2));

  return {
    id: valorSeguroContato_(obterValorLinha_(linha, idx.id)),
    nome: valorSeguroContato_(obterValorLinha_(linha, idx.nome)),
    telefone: telefoneLimpo ? formatarTelefoneBR_(telefoneLimpo) : "",
    telefoneLimpo: telefoneLimpo,
    telefone2: telefone2Limpo ? formatarTelefoneBR_(telefone2Limpo) : "",
    telefone2Limpo: telefone2Limpo,
    email: valorSeguroContato_(obterValorLinha_(linha, idx.email)).toLowerCase(),
    cidade: valorSeguroContato_(obterValorLinha_(linha, idx.cidade)),
    escola: valorSeguroContato_(obterValorLinha_(linha, idx.escola)),
    status: valorSeguroContato_(obterValorLinha_(linha, idx.status)) || "ATIVO",
    tags: tagsParaRetornoContato_(obterValorLinha_(linha, idx.tags)),
    notas: valorSeguroContato_(obterValorLinha_(linha, idx.notas)),
    foto: valorSeguroContato_(obterValorLinha_(linha, idx.foto)),
    dataCadastro: valorSeguroContato_(obterValorLinha_(linha, idx.dataCadastro)),
    dataAtualizacao: valorSeguroContato_(obterValorLinha_(linha, idx.dataAtualizacao))
  };
}

function obterIndicesContatos_(aba) {
  const headerMap = obterHeaderMapContatos_(aba);

  return {
    id: obterIndiceColuna_(headerMap, "ID"),
    nome: obterIndiceColuna_(headerMap, "Nome"),
    telefone: obterIndiceColuna_(headerMap, "Telefone"),
    telefone2: obterIndiceColuna_(headerMap, "Telefone2"),
    email: obterIndiceColuna_(headerMap, "Email"),
    cidade: obterIndiceColuna_(headerMap, "Cidade"),
    escola: obterIndiceColuna_(headerMap, "Escola"),
    status: obterIndiceColuna_(headerMap, "Status"),
    tags: obterIndiceColuna_(headerMap, "Tags"),
    notas: obterIndiceColuna_(headerMap, "Notas"),
    foto: obterIndiceColuna_(headerMap, "Foto"),
    dataCadastro: obterIndiceColuna_(headerMap, "DataCadastro"),
    dataAtualizacao: obterIndiceColuna_(headerMap, "DataAtualizacao")
  };
}

function validarContatoEntrada_(dados) {
  const nome = valorSeguroContato_(dados.nome);
  const telefone = normalizarTelefoneBR_(dados.telefone || "");

  if (!nome) {
    return { erro: true, mensagem: "Nome não informado." };
  }

  if (/^\d+$/.test(nome)) {
    return { erro: true, mensagem: "O nome não pode ser apenas números." };
  }

  if (!telefone) {
    return { erro: true, mensagem: "Telefone inválido." };
  }

  return { erro: false };
}

function localizarLinhaContato_(dadosPlanilha, indices, dadosBusca) {
  const id = valorSeguroContato_(dadosBusca.id);
  const nome = valorSeguroContato_(dadosBusca.nome);
  const telefone = normalizarTelefoneBR_(dadosBusca.telefone || "");
  const nomeOriginal = valorSeguroContato_(dadosBusca.nomeOriginal);
  const telefoneOriginal = normalizarTelefoneBR_(dadosBusca.telefoneOriginal || "");

  for (let i = 0; i < dadosPlanilha.length; i++) {
    const linha = dadosPlanilha[i];

    const idLinha = valorSeguroContato_(obterValorLinha_(linha, indices.id));
    const nomeLinha = valorSeguroContato_(obterValorLinha_(linha, indices.nome));
    const telefoneLinha = normalizarTelefoneBR_(obterValorLinha_(linha, indices.telefone));

    if (id && idLinha && idLinha === id) {
      return i;
    }

    if (!id && nome && telefone && nomeLinha === nome && telefoneLinha === telefone) {
      return i;
    }

    if (!id && nomeOriginal && telefoneOriginal && nomeLinha === nomeOriginal && telefoneLinha === telefoneOriginal) {
      return i;
    }
  }

  return -1;
}

/* ================================================================
 * CONTATOS
 * ================================================================ */

function adicionarContato(dados) {
  try {
    const aba = obterAbaContatos_();
    dados = dados || {};

    const validacao = validarContatoEntrada_(dados);
    if (validacao.erro) return validacao;

    const indices = obterIndicesContatos_(aba);
    const nome = valorSeguroContato_(dados.nome);
    const telefone = normalizarTelefoneBR_(dados.telefone || "");
    const telefone2 = normalizarTelefoneBR_(dados.telefone2 || "");
    const email = valorSeguroContato_(dados.email).toLowerCase();
    const cidade = valorSeguroContato_(dados.cidade);
    const escola = valorSeguroContato_(dados.escola) || cidade;
    const status = normalizarStatusContato_(dados.status);
    const tags = tagsParaSalvarContato_(dados.tags);
    const notas = valorSeguroContato_(dados.notas);
    const foto = valorSeguroContato_(dados.foto);
    const agora = obterDataAgoraIso_();

    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();

    if (indices.nome === -1 || indices.telefone === -1) {
      return { erro: true, mensagem: 'Colunas "Nome" e/ou "Telefone" não encontradas.' };
    }

    if (ultimaLinha > 1) {
      const dadosExistentes = aba.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues();

      const duplicado = dadosExistentes.some(function(linha) {
        const telefoneExistente = normalizarTelefoneBR_(obterValorLinha_(linha, indices.telefone));
        const emailExistente = valorSeguroContato_(obterValorLinha_(linha, indices.email)).toLowerCase();

        return (
          (telefone && telefoneExistente && telefone === telefoneExistente) ||
          (email && emailExistente && email === emailExistente)
        );
      });

      if (duplicado) {
        return { erro: true, mensagem: "Já existe um contato com esse telefone ou e-mail." };
      }
    }

    const novaLinha = new Array(ultimaColuna).fill("");

    definirValorLinha_(novaLinha, indices.id, gerarIdContato_());
    definirValorLinha_(novaLinha, indices.nome, nome);
    definirValorLinha_(novaLinha, indices.telefone, telefone);
    definirValorLinha_(novaLinha, indices.telefone2, telefone2);
    definirValorLinha_(novaLinha, indices.email, email);
    definirValorLinha_(novaLinha, indices.cidade, cidade);
    definirValorLinha_(novaLinha, indices.escola, escola);
    definirValorLinha_(novaLinha, indices.status, status);
    definirValorLinha_(novaLinha, indices.tags, tags);
    definirValorLinha_(novaLinha, indices.notas, notas);
    definirValorLinha_(novaLinha, indices.foto, foto);
    definirValorLinha_(novaLinha, indices.dataCadastro, agora);
    definirValorLinha_(novaLinha, indices.dataAtualizacao, agora);

    aba.appendRow(novaLinha);

    return { erro: false, mensagem: "Contato adicionado com sucesso." };

  } catch (e) {
    Logger.log("❌ ERRO adicionarContato: " + e.message);
    return { erro: true, mensagem: "Erro ao adicionar contato: " + e.message };
  }
}

function excluirContato(dados) {
  try {
    const aba = obterAbaContatos_();
    dados = dados || {};

    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();

    if (ultimaLinha < 2) {
      return { erro: true, mensagem: "Não há contatos para excluir." };
    }

    const indices = obterIndicesContatos_(aba);

    if (indices.nome === -1 || indices.telefone === -1) {
      return { erro: true, mensagem: "Colunas Nome/Telefone não encontradas." };
    }

    const dadosPlanilha = aba.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues();
    const idxEncontrado = localizarLinhaContato_(dadosPlanilha, indices, dados);

    if (idxEncontrado === -1) {
      return { erro: true, mensagem: "Contato não encontrado para exclusão." };
    }

    aba.deleteRow(idxEncontrado + 2);
    return { erro: false, mensagem: "Contato excluído com sucesso." };

  } catch (e) {
    Logger.log("❌ ERRO excluirContato: " + e.message);
    return { erro: true, mensagem: "Erro ao excluir contato: " + e.message };
  }
}

function atualizarContato(dados) {
  try {
    const aba = obterAbaContatos_();
    dados = dados || {};

    const validacao = validarContatoEntrada_(dados);
    if (validacao.erro) return validacao;

    const nome = valorSeguroContato_(dados.nome);
    const telefone = normalizarTelefoneBR_(dados.telefone || "");
    const telefone2 = normalizarTelefoneBR_(dados.telefone2 || "");
    const email = valorSeguroContato_(dados.email).toLowerCase();
    const cidade = valorSeguroContato_(dados.cidade);
    const escola = valorSeguroContato_(dados.escola) || cidade;
    const status = normalizarStatusContato_(dados.status);
    const tags = tagsParaSalvarContato_(dados.tags);
    const notas = valorSeguroContato_(dados.notas);
    const foto = valorSeguroContato_(dados.foto);
    const agora = obterDataAgoraIso_();

    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();

    if (ultimaLinha < 2) {
      return { erro: true, mensagem: "Não há contatos cadastrados." };
    }

    const indices = obterIndicesContatos_(aba);

    if (indices.nome === -1 || indices.telefone === -1) {
      return { erro: true, mensagem: 'Colunas "Nome" e/ou "Telefone" não encontradas.' };
    }

    const dadosPlanilha = aba.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues();
    const idxEncontrado = localizarLinhaContato_(dadosPlanilha, indices, dados);

    if (idxEncontrado === -1) {
      return { erro: true, mensagem: "Contato não encontrado para atualização." };
    }

    for (let i = 0; i < dadosPlanilha.length; i++) {
      if (i === idxEncontrado) continue;

      const linha = dadosPlanilha[i];
      const telefoneLinha = normalizarTelefoneBR_(obterValorLinha_(linha, indices.telefone));
      const emailLinha = valorSeguroContato_(obterValorLinha_(linha, indices.email)).toLowerCase();

      if ((telefone && telefoneLinha && telefone === telefoneLinha) ||
          (email && emailLinha && email === emailLinha)) {
        return { erro: true, mensagem: "Já existe outro contato com esse telefone ou e-mail." };
      }
    }

    const numeroLinha = idxEncontrado + 2;

    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.nome, nome);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.telefone, telefone);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.telefone2, telefone2);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.email, email);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.cidade, cidade);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.escola, escola);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.status, status);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.tags, tags);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.notas, notas);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.foto, foto);
    definirValorLinha_(dadosPlanilha[idxEncontrado], indices.dataAtualizacao, agora);

    aba.getRange(numeroLinha, 1, 1, ultimaColuna).setValues([dadosPlanilha[idxEncontrado]]);

    return { erro: false, mensagem: "Contato atualizado com sucesso." };

  } catch (e) {
    Logger.log("❌ ERRO atualizarContato: " + e.message);
    return { erro: true, mensagem: "Erro ao atualizar contato: " + e.message };
  }
}

function buscarContatos() {
  try {
    const aba = obterAbaContatos_();

    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();

    if (ultimaLinha < 2) {
      return [];
    }

    const indices = obterIndicesContatos_(aba);

    if (indices.nome === -1 || indices.telefone === -1) {
      throw new Error('Colunas "Nome" e/ou "Telefone" não encontradas.');
    }

    return aba.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues()
      .map(function(linha) {
        return montarObjetoContato_(linha, indices);
      })
      .filter(function(c) {
        return c.nome || c.telefone || c.cidade || c.escola || c.email;
      })
      .sort(function(a, b) {
        return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
          sensitivity: "base"
        });
      });

  } catch (e) {
    Logger.log("❌ ERRO buscarContatos: " + e.message);
    throw new Error("Erro em buscarContatos: " + e.message);
  }
}

/* ================================================================
 * EXTRAS PARA A NOVA TELA DE COMUNICAÇÃO
 * ================================================================ */

function buscarContatosFiltrados(filtros) {
  try {
    filtros = filtros || {};

    const termo = String(filtros.termo || "").trim().toLowerCase();
    const escola = String(filtros.escola || "").trim().toLowerCase();
    const status = String(filtros.status || "").trim().toUpperCase();
    const tag = String(filtros.tag || "").trim().toLowerCase();

    let contatos = buscarContatos();

    contatos = contatos.filter(function(c) {
      let ok = true;

      if (termo) {
        const base = [
          c.nome,
          c.telefone,
          c.telefone2,
          c.telefoneLimpo,
          c.telefone2Limpo,
          c.email,
          c.cidade,
          c.escola,
          c.status,
          (c.tags || []).join(" "),
          c.notas
        ].join(" ").toLowerCase();

        ok = ok && base.indexOf(termo) > -1;
      }

      if (escola) {
        ok = ok && String(c.escola || "").trim().toLowerCase() === escola;
      }

      if (status) {
        ok = ok && String(c.status || "").trim().toUpperCase() === status;
      }

      if (tag) {
        ok = ok && (c.tags || []).map(function(t) {
          return String(t || "").toLowerCase();
        }).indexOf(tag) > -1;
      }

      return ok;
    });

    return {
      erro: false,
      total: contatos.length,
      contatos: contatos
    };

  } catch (e) {
    Logger.log("❌ ERRO buscarContatosFiltrados: " + e.message);
    return {
      erro: true,
      mensagem: "Erro ao buscar contatos filtrados: " + e.message,
      total: 0,
      contatos: []
    };
  }
}

function obterDashboardContatos() {
  try {
    const contatos = buscarContatos();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const total = contatos.length;
    const ativos = contatos.filter(function(c) {
      return String(c.status || "").toUpperCase() === "ATIVO";
    }).length;

    const escolasUnicas = {};
    contatos.forEach(function(c) {
      const nomeEscola = String(c.escola || "").trim();
      if (nomeEscola) escolasUnicas[nomeEscola] = true;
    });

    const recentes = contatos.filter(function(c) {
      if (!c.dataCadastro) return false;
      const d = new Date(c.dataCadastro);
      return !isNaN(d.getTime()) && d >= seteDiasAtras;
    }).length;

    return {
      erro: false,
      total: total,
      ativos: ativos,
      escolas: Object.keys(escolasUnicas).length,
      recentes: recentes
    };

  } catch (e) {
    Logger.log("❌ ERRO obterDashboardContatos: " + e.message);
    return {
      erro: true,
      mensagem: "Erro ao obter dashboard: " + e.message,
      total: 0,
      ativos: 0,
      escolas: 0,
      recentes: 0
    };
  }
}

function obterContatoPorId(id) {
  try {
    const idBusca = String(id || "").trim();
    if (!idBusca) {
      return { erro: true, mensagem: "ID não informado." };
    }

    const contatos = buscarContatos();
    const contato = contatos.find(function(c) {
      return String(c.id || "").trim() === idBusca;
    });

    if (!contato) {
      return { erro: true, mensagem: "Contato não encontrado." };
    }

    return { erro: false, contato: contato };

  } catch (e) {
    Logger.log("❌ ERRO obterContatoPorId: " + e.message);
    return { erro: true, mensagem: "Erro ao obter contato: " + e.message };
  }
}

function excluirContatos(ids) {
  try {
    ids = Array.isArray(ids) ? ids.map(function(id) {
      return String(id || "").trim();
    }).filter(Boolean) : [];

    if (!ids.length) {
      return { erro: true, mensagem: "Nenhum contato informado para exclusão." };
    }

    const aba = obterAbaContatos_();
    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();

    if (ultimaLinha < 2) {
      return { erro: false, mensagem: "Nenhum registro para excluir.", excluidos: 0 };
    }

    const indices = obterIndicesContatos_(aba);
    const dados = aba.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues();

    const mantidos = [];
    let excluidos = 0;

    dados.forEach(function(linha) {
      const idLinha = valorSeguroContato_(obterValorLinha_(linha, indices.id));
      if (ids.indexOf(idLinha) > -1) {
        excluidos++;
      } else {
        mantidos.push(linha);
      }
    });

    aba.getRange(2, 1, Math.max(ultimaLinha - 1, 1), ultimaColuna).clearContent();

    if (mantidos.length) {
      aba.getRange(2, 1, mantidos.length, ultimaColuna).setValues(mantidos);
    }

    const ultimaNecessaria = mantidos.length + 1;
    const excesso = aba.getLastRow() - ultimaNecessaria;
    if (excesso > 0) {
      aba.deleteRows(ultimaNecessaria + 1, excesso);
    }

    return {
      erro: false,
      mensagem: excluidos + " contato(s) excluído(s) com sucesso.",
      excluidos: excluidos
    };

  } catch (e) {
    Logger.log("❌ ERRO excluirContatos: " + e.message);
    return {
      erro: true,
      mensagem: "Erro ao excluir contatos: " + e.message
    };
  }
}

/* ================================================================
 * LISTAS DE TRANSMISSÃO
 * ================================================================ */

function listarListasTransmissao() {
  try {
    const ss = SpreadsheetApp.openById(getPlanilhaContatosId_());
    const aba = ss.getSheetByName(ABA_LISTAS_TRANSMISSAO_SISGEP);

    if (!aba) {
      return [];
    }

    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();

    if (ultimaLinha < 2) {
      return [];
    }

    return aba.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues()
      .map(function(linha) {
        return {
          nome: String(linha[0] || "").trim(),
          telefones: String(linha[1] || "").trim(),
          quantidade: Number(linha[2] || 0),
          escolas: String(linha[3] || "").trim()
        };
      })
      .filter(function(l) {
        return l.nome && l.telefones;
      });

  } catch (e) {
    Logger.log("❌ ERRO listarListasTransmissao: " + e.message);
    throw new Error("Erro ao listar listas: " + e.message);
  }
}

function listarListasTransmissaoDisponiveis() {
  try {
    const ss = SpreadsheetApp.openById(getPlanilhaContatosId_());
    const aba = ss.getSheetByName(ABA_LISTAS_TRANSMISSAO_SISGEP);

    if (!aba) {
      throw new Error('Aba "Listas_Transmissao" não encontrada.');
    }

    const ultimaLinha = aba.getLastRow();
    const ultimaColuna = aba.getLastColumn();

    if (ultimaLinha < 2) {
      return [];
    }

    const dados = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getValues();
    const cab = dados[0].map(function(h) {
      return String(h || "").trim().toLowerCase();
    });

    const idxNome = cab.findIndex(function(h) {
      return h === "nome_lista" || h === "lista" || h === "nome da lista";
    });

    const idxTelefones = cab.findIndex(function(h) {
      return h === "telefones" || h === "números" || h === "numeros";
    });

    const idxQtd = cab.findIndex(function(h) {
      return h === "qtd_contatos" || h === "quantidade" || h === "qtd";
    });

    const idxEscolas = cab.findIndex(function(h) {
      return h === "escolas" || h === "escola";
    });

    if (idxNome === -1 || idxTelefones === -1) {
      throw new Error('Colunas da aba "Listas_Transmissao" não encontradas.');
    }

    return dados.slice(1).map(function(linha) {
      const nome = String(linha[idxNome] || "").trim();
      const telefonesTexto = String(linha[idxTelefones] || "").trim();
      const escolas = idxEscolas > -1 ? String(linha[idxEscolas] || "").trim() : "";
      const listaTelefones = telefonesTexto
        ? telefonesTexto.split(",").map(function(t) { return String(t || "").trim(); }).filter(Boolean)
        : [];
      const quantidade = idxQtd > -1 ? Number(linha[idxQtd] || 0) : listaTelefones.length;

      return {
        nome: nome,
        telefones: telefonesTexto,
        quantidade: quantidade || listaTelefones.length,
        escolas: escolas,
        primeirosTelefones: listaTelefones.slice(0, 15)
      };
    }).filter(function(item) {
      return item.nome;
    });

  } catch (e) {
    Logger.log("❌ ERRO listarListasTransmissaoDisponiveis: " + e.message);
    throw new Error("Erro ao listar listas disponíveis: " + e.message);
  }
}

function organizarListasWhatsApp() {
  try {
    const ss = SpreadsheetApp.openById(getPlanilhaContatosId_());
    const abaContatos = obterAbaContatos_();

    let abaListas = ss.getSheetByName(ABA_LISTAS_TRANSMISSAO_SISGEP);

    if (!abaListas) {
      abaListas = ss.insertSheet(ABA_LISTAS_TRANSMISSAO_SISGEP);
    } else {
      abaListas.clearContents();
    }

    const ultimaLinha = abaContatos.getLastRow();
    const ultimaColuna = abaContatos.getLastColumn();

    if (ultimaLinha < 2) {
      throw new Error("Não há contatos suficientes para gerar listas.");
    }

    const indices = obterIndicesContatos_(abaContatos);

    if (indices.nome === -1 || indices.telefone === -1 || indices.escola === -1) {
      throw new Error('Colunas "Nome", "Telefone" e/ou "Escola" não encontradas.');
    }

    const dados = abaContatos.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues();

    const contatosValidos = dados.map(function(linha) {
      let telefone = String(obterValorLinha_(linha, indices.telefone) || "").replace(/\D/g, "");
      const status = String(obterValorLinha_(linha, indices.status) || "ATIVO").trim().toUpperCase();

      if (telefone.startsWith("55") && telefone.length > 11) {
        telefone = telefone.substring(2);
      }

      return {
        nome: String(obterValorLinha_(linha, indices.nome) || "").trim(),
        telefone: telefone,
        escola: String(obterValorLinha_(linha, indices.escola) || "").trim(),
        status: status
      };
    }).filter(function(c) {
      return c.nome && c.telefone && c.status !== "BLOQUEADO" && c.status !== "INATIVO";
    });

    if (!contatosValidos.length) {
      throw new Error("Nenhum contato válido encontrado.");
    }

    const listas = [];

    for (let i = 0; i < contatosValidos.length; i += 256) {
      const bloco = contatosValidos.slice(i, i + 256);
      const nomeLista = "Lista " + String(listas.length + 1).padStart(2, "0");
      const numeros = bloco.map(function(c) {
        return "55" + c.telefone;
      }).join(",");

      const escolasUnicas = Array.from(new Set(
        bloco.map(function(c) { return String(c.escola || "").trim(); }).filter(Boolean)
      )).join(", ");

      listas.push([nomeLista, numeros, bloco.length, escolasUnicas]);
    }

    abaListas.getRange(1, 1, 1, 4).setValues([["Nome_Lista", "Telefones", "Qtd_Contatos", "Escolas"]]);

    if (listas.length) {
      abaListas.getRange(2, 1, listas.length, 4).setValues(listas);
    }

    abaListas.autoResizeColumns(1, 4);

    return {
      erro: false,
      mensagem: "Listas geradas com sucesso.",
      totalListas: listas.length,
      totalContatos: contatosValidos.length
    };

  } catch (e) {
    Logger.log("❌ ERRO organizarListasWhatsApp: " + e.message);
    return { erro: true, mensagem: e.message };
  }
}

function buscarListaWhatsApp(nomeLista) {
  const aba = SpreadsheetApp.openById(getPlanilhaContatosId_()).getSheetByName(ABA_LISTAS_TRANSMISSAO_SISGEP);

  if (!aba) {
    return "";
  }

  const dados = aba.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0] || "").trim() === String(nomeLista || "").trim()) {
      return dados[i][1] || "";
    }
  }

  return "";
}