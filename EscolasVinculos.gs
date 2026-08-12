// ============================================================================
// ARQUIVO: EscolasVinculos.gs
// FASE 4 do item 8 do PROMPT-MESTRE — os módulos passam a guardar escolaId.
//
// O PROBLEMA
//
// A Fase 1 criou a identidade única (EscolaID, 679 escolas, 11/08/2026). Mas
// nenhum outro módulo a adotou: Ofícios, Visitas, Cobrança, Contatos e os
// ~8.000 associados continuam apontando para a escola por NOME e CNPJ.
//
// Nome não é chave. Escola que muda de razão social vira duas; matriz e
// filial com nome parecido se confundem; e "CEI Girassol" pode ser três
// escolas diferentes. Enquanto o vínculo for texto, o Histórico 360° e o
// Painel da Escola são impossíveis de fazer direito.
//
// O QUE ESTE ARQUIVO FAZ, E O QUE ELE NÃO FAZ
//
// Faz: acrescenta uma coluna EscolaID em cada aba que aponta para escola, e
// preenche onde consegue resolver com certeza.
//
// NÃO FAZ: não apaga nem altera a coluna de nome. Ela continua lá, intacta.
// Nome vira rótulo; id vira vínculo. Se a migração errar, o dado antigo está
// no lugar de sempre e nada quebra — porque nenhum módulo lê o id ainda.
//
// A REGRA QUE VALE MAIS QUE AS OUTRAS: AMBÍGUO NÃO SE ADIVINHA.
//
// Quando o nome casa com duas escolas, a linha fica SEM id e vai para a fila
// de pendências. Escrever um palpite ali seria pior que deixar vazio: vazio
// alguém resolve; palpite errado ninguém descobre, e o associado passa a
// contar para a escola errada na relação nominal.
// ============================================================================

/* As abas que apontam para escola, na ORDEM DE RISCO CRESCENTE.
 *
 * Associados é a última de propósito: são ~8.000 linhas de dado real e
 * irrecuperável. O método precisa provar-se nas quatro anteriores antes de
 * chegar lá.
 *
 * As colunas são procuradas POR NOME, com alternativas, e nunca por posição.
 * Se nenhuma bater, a rotina recusa a aba inteira em vez de escrever no lugar
 * errado — que é exatamente como a aba Escolas ficou torta. */
var ESC_VINC_ALVOS = [
  {
    chave: "COBRANCA", ordem: 1,
    rotulo: "Cobrança — Relação Nominal",
    aba: "COBRANCA_RELACAO_NOMINAL",
    colsCnpj: ["ESCOLA_CNPJ"],
    colsNome: ["ESCOLA_NOME"],
    nota: "Casa por CNPJ, que é o caso mais seguro de todos."
  },
  {
    chave: "CONTATOS", ordem: 2,
    rotulo: "Contatos e Responsáveis",
    aba: "Contatos",
    colsCnpj: [],
    colsNome: ["Escola"],
    nota: "Só tem o nome — depende do casamento por texto."
  },
  {
    chave: "VISITAS", ordem: 3,
    rotulo: "Visitas",
    aba: "SISGEP_Visitas",
    colsCnpj: ["CNPJ"],
    colsNome: ["ESCOLA"],
    nota: "Tem CNPJ e nome; o CNPJ resolve a maioria."
  },
  {
    chave: "OFICIOS", ordem: 4,
    rotulo: "Ofícios",
    aba: "Controle_Oficios",
    abaAlternativa: "Ofícios",
    colsCnpj: ["CNPJ", "ESCOLA_CNPJ"],
    colsNome: ["Escola (Razão Social)", "ESCOLA", "Escola", "NomeEscola"],
    nota: "Módulo em uso diário — a coluna nova não altera a emissão."
  },
  {
    chave: "ASSOCIADOS", ordem: 5,
    rotulo: "Associados",
    aba: "Associados",
    colsCnpj: [],
    colsNome: ["Nome fantasia"],
    nota: "~8.000 linhas. O vínculo é um nome, numa coluna chamada 'Nome fantasia'."
  }
];

var ESC_VINC_COL_DESTINO = "EscolaID";
var ESC_VINC_PROP_CONSENT = "SISGEP_VINCULOS_CONSENTIMENTO_";
var ESC_VINC_MINUTOS = 15;

/* Como cada linha foi resolvida. A distinção importa: "casou por CNPJ" é
 * outra coisa que "casou porque o nome estava contido em um só candidato",
 * e quem confere a prévia precisa ver os dois separados. */
var ESC_VINC_MOTIVOS = {
  CNPJ:     "documento igual",
  EXATO:    "nome idêntico",
  PREFIXO:  "nome começa igual, candidato único",
  CONTIDO:  "nome contido, candidato único",
  AMBIGUO:  "mais de uma escola possível",
  ORFAO:    "nenhuma escola parecida",
  VAZIO:    "linha sem escola"
};

/* ══════════════════════════════════════════════════════════════════════
   O ÍNDICE — construído UMA vez por execução
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Índice das escolas, por documento e por nome.
 *
 * POR QUE NÃO REUSAR sindAss_normalizarNomeEscola_ DIRETO
 *
 * Aquela função resolve UM nome e é a regra correta — as três tentativas
 * abaixo são as dela, na mesma ordem. Mas ela chama listarEscolasParaFicha()
 * a cada invocação. Para 8.000 associados isso seriam 8.000 leituras da aba
 * Escolas: minutos de execução e estouro de cota do Apps Script.
 *
 * Aqui a lista é lida uma vez e vira índice. Mesma regra, uma leitura.
 */
function escolaVincIndice_() {
  var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheetByName(ABA_ESCOLAS);
  if (!sh) throw new Error("Aba '" + ABA_ESCOLAS + "' não encontrada.");
  var ultima = sh.getLastRow();
  if (ultima < 2) throw new Error("A aba " + ABA_ESCOLAS + " está vazia.");

  var tudo = sh.getRange(1, 1, ultima, sh.getLastColumn()).getValues();
  var cab = tudo[0].map(function (c) { return String(c || "").trim(); });
  var iId   = cab.indexOf(ESC_COL_ID);
  var iNome = cab.indexOf(COL_NOME_ESCOLA);
  var iDoc  = cab.indexOf(COL_CNPJ);

  if (iId === -1) {
    throw new Error(
      "A coluna " + ESC_COL_ID + " não existe na aba " + ABA_ESCOLAS + ". " +
      "Rode escolaMigrarIds antes — a Fase 4 depende da identidade da Fase 1.");
  }

  var porDoc = {}, porNome = {}, nomes = [], semId = 0;
  for (var l = 1; l < tudo.length; l++) {
    var id = String(tudo[l][iId] || "").trim().toUpperCase();
    if (!id) { semId++; continue; }
    var nome = iNome > -1 ? String(tudo[l][iNome] || "").trim() : "";
    var doc  = iDoc  > -1 ? String(tudo[l][iDoc]  || "").replace(/\D/g, "") : "";

    /* Documento repetido NÃO vira chave. Matriz e filial podem dividir a
     * raiz do CNPJ, e um cadastro duplicado divide o CNPJ inteiro. Marcar
     * como ambíguo é o que impede a Fase 4 de propagar uma duplicata que
     * já existe na base. */
    if (doc) {
      if (porDoc[doc] === undefined) porDoc[doc] = id;
      else porDoc[doc] = "__AMBIGUO__";
    }
    if (nome) {
      var chave = escolasPendenciasNormalizar_(nome);
      if (porNome[chave] === undefined) porNome[chave] = id;
      else porNome[chave] = "__AMBIGUO__";
      nomes.push({ chave: chave, id: id, nome: nome });
    }
  }
  return { porDoc: porDoc, porNome: porNome, nomes: nomes, semId: semId,
           total: tudo.length - 1 };
}

/**
 * Resolve uma linha. Devolve { status, escolaId, motivo, candidatos }.
 *
 * A ordem das tentativas é a mesma de sindAss_normalizarNomeEscola_ —
 * exato, prefixo, contido — porque essa decisão já existia no projeto e não
 * se reabre. O que muda é o desfecho quando há mais de um candidato: lá o
 * texto era gravado como veio, com um aviso; aqui a linha fica sem id.
 */
function escolaVincResolver_(indice, doc, nome) {
  var digitos = String(doc == null ? "" : doc).replace(/\D/g, "");
  var texto = String(nome == null ? "" : nome).trim();

  if (!digitos && !texto) return { status: "VAZIO", escolaId: "", motivo: "VAZIO" };

  if (digitos && indice.porDoc[digitos] !== undefined) {
    var porDoc = indice.porDoc[digitos];
    if (porDoc !== "__AMBIGUO__") {
      return { status: "CASADO", escolaId: porDoc, motivo: "CNPJ" };
    }
    return { status: "AMBIGUO", escolaId: "", motivo: "AMBIGUO",
             candidatos: ["mais de uma escola com o documento " + digitos] };
  }

  if (!texto) return { status: "ORFAO", escolaId: "", motivo: "ORFAO" };

  var alvo = escolasPendenciasNormalizar_(texto);

  var exato = indice.porNome[alvo];
  if (exato !== undefined) {
    if (exato !== "__AMBIGUO__") return { status: "CASADO", escolaId: exato, motivo: "EXATO" };
    return { status: "AMBIGUO", escolaId: "", motivo: "AMBIGUO",
             candidatos: ["mais de uma escola chamada \"" + texto + "\""] };
  }

  var achados = [], i;
  for (i = 0; i < indice.nomes.length; i++) {
    var n = indice.nomes[i];
    if (n.chave.indexOf(alvo) === 0 || alvo.indexOf(n.chave) === 0) achados.push(n);
  }
  var unico = escolaVincUnicaEscola_(achados);
  if (unico) return { status: "CASADO", escolaId: unico, motivo: "PREFIXO" };
  if (achados.length > 1) {
    return { status: "AMBIGUO", escolaId: "", motivo: "AMBIGUO",
             candidatos: escolaVincNomesDe_(achados) };
  }

  achados = [];
  for (i = 0; i < indice.nomes.length; i++) {
    if (indice.nomes[i].chave.indexOf(alvo) >= 0) achados.push(indice.nomes[i]);
  }
  unico = escolaVincUnicaEscola_(achados);
  if (unico) return { status: "CASADO", escolaId: unico, motivo: "CONTIDO" };
  if (achados.length > 1) {
    return { status: "AMBIGUO", escolaId: "", motivo: "AMBIGUO",
             candidatos: escolaVincNomesDe_(achados) };
  }

  return { status: "ORFAO", escolaId: "", motivo: "ORFAO" };
}

/* Vários nomes apontando para a MESMA escola não são ambiguidade.
 * Acontece quando a base tem a mesma escola escrita de dois jeitos e os dois
 * já foram fundidos: o id é um só, e casar é seguro. */
function escolaVincUnicaEscola_(achados) {
  if (!achados.length) return "";
  var ids = {};
  achados.forEach(function (a) { ids[a.id] = true; });
  var lista = Object.keys(ids);
  return lista.length === 1 ? lista[0] : "";
}
function escolaVincNomesDe_(achados) {
  return achados.slice(0, 5).map(function (a) { return a.nome + " (" + a.id + ")"; });
}

/* ══════════════════════════════════════════════════════════════════════
   PRÉVIA E APLICAÇÃO — o mesmo código, decidido por um parâmetro
   ══════════════════════════════════════════════════════════════════════ */

function escolaVincAlvo_(chave) {
  var alvo = null;
  ESC_VINC_ALVOS.forEach(function (a) {
    if (a.chave === String(chave || "").trim().toUpperCase()) alvo = a;
  });
  return alvo;
}

/**
 * O motor. `escrever = false` mede; `escrever = true` grava.
 *
 * É UMA FUNÇÃO SÓ, e isso não é economia de código: é o que faz a prévia
 * valer alguma coisa. Duas implementações divergem, e uma prévia que
 * descreve operação diferente da que vai rodar é pior que nenhuma prévia —
 * ela produz consentimento para uma coisa que não vai acontecer. Já
 * aconteceu neste projeto, no saneamento de 11/08/2026.
 */
function escolaVincProcessar_(chave, escrever) {
  var alvo = escolaVincAlvo_(chave);
  if (!alvo) return { ok: false, mensagem: "Alvo desconhecido: " + chave };

  var ss = SpreadsheetApp.openById(PLANILHA_ID);
  var sh = ss.getSheetByName(alvo.aba);
  if (!sh && alvo.abaAlternativa) sh = ss.getSheetByName(alvo.abaAlternativa);
  if (!sh) {
    return { ok: false, alvo: alvo.chave,
             mensagem: "Aba '" + alvo.aba + "' não existe nesta planilha." };
  }

  var ultima = sh.getLastRow();
  if (ultima < 2) {
    return { ok: true, alvo: alvo.chave, aba: sh.getName(), total: 0,
             mensagem: "A aba está vazia — nada a vincular.",
             contagem: { CASADO: 0, AMBIGUO: 0, ORFAO: 0, VAZIO: 0, JA_TINHA: 0 },
             porMotivo: {}, amostraAmbiguos: [], amostraOrfaos: [], escreveu: false };
  }

  var largura = sh.getLastColumn();
  var tudo = sh.getRange(1, 1, ultima, largura).getValues();
  var cab = tudo[0].map(function (c) { return String(c || "").trim(); });

  function achar(nomes) {
    for (var i = 0; i < nomes.length; i++) {
      var p = cab.indexOf(nomes[i]);
      if (p > -1) return p;
    }
    return -1;
  }
  var iCnpj = alvo.colsCnpj.length ? achar(alvo.colsCnpj) : -1;
  var iNome = alvo.colsNome.length ? achar(alvo.colsNome) : -1;

  /* Nenhuma coluna reconhecida: RECUSA a aba inteira. Não tenta por posição,
   * não chuta. Escrever numa coluna adivinhada é como a aba Escolas ficou
   * com telefone dentro da razão social. */
  if (iCnpj === -1 && iNome === -1) {
    return { ok: false, alvo: alvo.chave, aba: sh.getName(),
             mensagem: "Não achei a coluna da escola em '" + sh.getName() +
               "'. Procurei por: " + alvo.colsNome.concat(alvo.colsCnpj).join(", ") +
               ". O cabeçalho tem: " + cab.filter(String).slice(0, 12).join(" · ") };
  }

  var iDest = cab.indexOf(ESC_VINC_COL_DESTINO);
  var indice = escolaVincIndice_();

  var contagem = { CASADO: 0, AMBIGUO: 0, ORFAO: 0, VAZIO: 0, JA_TINHA: 0 };
  var porMotivo = {};
  var ambiguos = [], orfaos = [];
  var aEscrever = [];

  for (var l = 1; l < tudo.length; l++) {
    var jaTem = iDest > -1 ? String(tudo[l][iDest] || "").trim() : "";
    if (jaTem) {
      /* Idempotência: linha já vinculada não é reavaliada. Rodar de novo não
       * troca vínculo que alguém possa ter corrigido a mão. */
      contagem.JA_TINHA++;
      aEscrever.push([jaTem]);
      continue;
    }

    var r = escolaVincResolver_(indice,
      iCnpj > -1 ? tudo[l][iCnpj] : "",
      iNome > -1 ? tudo[l][iNome] : "");

    contagem[r.status]++;
    porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1;
    aEscrever.push([r.escolaId]);

    if (r.status === "AMBIGUO" && ambiguos.length < 20) {
      ambiguos.push({ linha: l + 1,
        texto: iNome > -1 ? String(tudo[l][iNome] || "").trim() : "",
        candidatos: r.candidatos || [] });
    }
    if (r.status === "ORFAO" && orfaos.length < 20) {
      orfaos.push({ linha: l + 1,
        texto: iNome > -1 ? String(tudo[l][iNome] || "").trim() : "" });
    }
  }

  var resultado = {
    ok: true,
    alvo: alvo.chave,
    rotulo: alvo.rotulo,
    aba: sh.getName(),
    nota: alvo.nota,
    total: tudo.length - 1,
    contagem: contagem,
    porMotivo: porMotivo,
    amostraAmbiguos: ambiguos,
    amostraOrfaos: orfaos,
    colunaNome: iNome > -1 ? cab[iNome] : "(sem)",
    colunaCnpj: iCnpj > -1 ? cab[iCnpj] : "(sem)",
    escolasNoIndice: indice.total,
    escreveu: false
  };

  if (!escrever) return resultado;

  /* ─── daqui para baixo, escreve ─── */
  var backup = escolaVincBackup_(ss, sh);
  var colDest = iDest > -1 ? iDest + 1 : largura + 1;
  if (iDest === -1) {
    sh.getRange(1, colDest).setValue(ESC_VINC_COL_DESTINO).setFontWeight("bold");
  }
  sh.getRange(2, colDest, aEscrever.length, 1).setValues(aEscrever);
  SpreadsheetApp.flush();

  resultado.escreveu = true;
  resultado.backup = backup;
  resultado.coluna = colDest;
  escolaVincAuditar_(alvo, resultado);
  return resultado;
}

/**
 * Backup da aba inteira antes de escrever. Nome único, sem sobrescrever.
 *
 * Copia por getValues/setValues em vez de copyTo, que é o mesmo caminho já
 * usado pelo backup da migração de identidade e pelo do saneamento — os dois
 * rodaram na base real. Não é preferência de estilo: copyTo traz fórmulas,
 * formatação condicional e validação junto, e um backup com fórmula dentro
 * recalcula ao ser aberto. Backup precisa ser retrato, não cópia viva.
 */
function escolaVincBackup_(ss, sh) {
  var base = "BKP_VINC_" + sh.getName().slice(0, 14).replace(/[^A-Za-z0-9_]/g, "_") +
             "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  var nome = base, n = 2;
  while (ss.getSheetByName(nome)) { nome = base + "_" + n; n++; }

  var linhas = sh.getLastRow(), colunas = sh.getLastColumn();
  var dados = sh.getRange(1, 1, linhas, colunas).getValues();
  var shB = ss.insertSheet(nome);
  shB.getRange(1, 1, dados.length, dados[0].length).setValues(dados);
  return nome;
}

function escolaVincAuditar_(alvo, r) {
  try {
    if (typeof auditoriaRegistrar !== "function" && typeof aud_gravar_ !== "function") return;
    if (typeof escolaAuditar_ === "function") {
      escolaAuditar_({
        modulo: "Escolas", submodulo: "Vínculos",
        acao: "MIGRAR_VINCULO",
        registroId: alvo.chave,
        valorAnterior: "sem EscolaID",
        valorNovo: r.contagem.CASADO + " linha(s) vinculadas em " + r.aba,
        resultado: "OK"
      });
    }
  } catch (e) {
    Logger.log("Auditoria do vínculo falhou (a migração seguiu): " + e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   PORTAS PÚBLICAS
   ══════════════════════════════════════════════════════════════════════ */

/** Lista os alvos e o que já foi migrado. Só leitura. */
function escolaVinculosStatus(tokenSessao) {
  escolaExigirAdminOuSessao_(tokenSessao, "escolaVinculosStatus", true);
  try {
    var ss = SpreadsheetApp.openById(PLANILHA_ID);
    var linhas = ESC_VINC_ALVOS.map(function (a) {
      var sh = ss.getSheetByName(a.aba) || (a.abaAlternativa ? ss.getSheetByName(a.abaAlternativa) : null);
      if (!sh) return { chave: a.chave, rotulo: a.rotulo, aba: a.aba, ordem: a.ordem,
                        existe: false, migrado: false, total: 0, comId: 0 };
      var ultima = sh.getLastRow();
      var cab = ultima ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
                          .map(function (c) { return String(c || "").trim(); }) : [];
      var iDest = cab.indexOf(ESC_VINC_COL_DESTINO);
      var comId = 0;
      if (iDest > -1 && ultima > 1) {
        sh.getRange(2, iDest + 1, ultima - 1, 1).getValues().forEach(function (v) {
          if (String(v[0] || "").trim()) comId++;
        });
      }
      return { chave: a.chave, rotulo: a.rotulo, aba: sh.getName(), ordem: a.ordem,
               nota: a.nota, existe: true, migrado: iDest > -1,
               total: Math.max(0, ultima - 1), comId: comId };
    });
    var r = { ok: true, alvos: linhas, colunaDestino: ESC_VINC_COL_DESTINO };
    escolaVincImprimirStatus_(r);
    return r;
  } catch (e) {
    Logger.log("Erro no status dos vínculos: " + e.message);
    return { ok: false, mensagem: "Erro no status dos vínculos: " + e.message };
  }
}

/**
 * PRÉVIA — só mede, não escreve. Libera o consentimento daquele alvo.
 *
 * O consentimento é POR ALVO: ver a prévia de Contatos não autoriza aplicar
 * em Associados. Uma trava genérica seria a mesma coisa que trava nenhuma.
 */
function escolaVinculosPrevia(chave, tokenSessao) {
  escolaExigirAdminOuSessao_(tokenSessao, "escolaVinculosPrevia " + chave, true);
  var r = escolaVincProcessar_(chave, false);
  if (r.ok) {
    PropertiesService.getScriptProperties().setProperty(
      ESC_VINC_PROP_CONSENT + r.alvo,
      JSON.stringify({ quando: new Date().getTime(), casados: r.contagem.CASADO }));
  }
  escolaVincImprimir_(r, false);
  return r;
}

/** APLICA — exige prévia recente do MESMO alvo, e a consome. */
function escolaVinculosAplicar(chave, tokenSessao) {
  escolaExigirAdminOuSessao_(tokenSessao, "escolaVinculosAplicar " + chave, true);

  var alvo = escolaVincAlvo_(chave);
  if (!alvo) return { ok: false, mensagem: "Alvo desconhecido: " + chave };

  var props = PropertiesService.getScriptProperties();
  var bruto = props.getProperty(ESC_VINC_PROP_CONSENT + alvo.chave);
  if (!bruto) {
    var msg = "Rode a prévia de " + alvo.rotulo + " antes de aplicar. " +
              "Aplicar sem ver o que vai mudar é o que esta trava existe para impedir.";
    Logger.log("RECUSADO: " + msg);
    return { ok: false, mensagem: msg };
  }
  var quando = 0;
  try { quando = JSON.parse(bruto).quando || 0; } catch (e) {}
  if (new Date().getTime() - quando > ESC_VINC_MINUTOS * 60 * 1000) {
    props.deleteProperty(ESC_VINC_PROP_CONSENT + alvo.chave);
    var msg2 = "A prévia de " + alvo.rotulo + " tem mais de " + ESC_VINC_MINUTOS +
               " minutos. A base pode ter mudado — rode de novo.";
    Logger.log("RECUSADO: " + msg2);
    return { ok: false, mensagem: msg2 };
  }

  /* Consome ANTES de escrever. Assim um erro no meio não deixa o
   * consentimento de pé para uma segunda tentativa acidental. */
  props.deleteProperty(ESC_VINC_PROP_CONSENT + alvo.chave);

  var trava = LockService.getScriptLock();
  if (!trava.tryLock(30000)) {
    return { ok: false, mensagem: "Outra operação está usando a planilha. Tente em instantes." };
  }
  try {
    var r = escolaVincProcessar_(chave, true);
    escolaVincImprimir_(r, true);
    return r;
  } finally {
    trava.releaseLock();
  }
}

/* ══════════════════════════════════════════════════════════════════════
   SAÍDA NO LOG — o editor não mostra retorno
   ══════════════════════════════════════════════════════════════════════ */

function escolaVincImprimir_(r, aplicou) {
  try {
    if (!r.ok) { Logger.log("✗ " + (r.mensagem || "falhou")); return; }
    var L = [];
    L.push(aplicou ? "═══ VÍNCULOS APLICADOS ═══" : "═══ PRÉVIA DOS VÍNCULOS (nada foi gravado) ═══");
    L.push(r.rotulo + "  ·  aba " + r.aba);
    L.push(r.nota || "");
    L.push("");
    L.push("coluna do nome ..... " + r.colunaNome);
    L.push("coluna do documento  " + r.colunaCnpj);
    L.push("escolas no índice .. " + r.escolasNoIndice);
    L.push("");
    L.push(r.total + " linha(s) na aba");
    L.push("  vinculadas ......... " + r.contagem.CASADO);
    L.push("  ambíguas ........... " + r.contagem.AMBIGUO + "   (ficam SEM id, de propósito)");
    L.push("  sem escola parecida  " + r.contagem.ORFAO);
    L.push("  linha sem escola ... " + r.contagem.VAZIO);
    L.push("  já tinham id ....... " + r.contagem.JA_TINHA);
    L.push("");
    L.push("POR QUE CASOU");
    Object.keys(r.porMotivo).forEach(function (m) {
      var rot = ESC_VINC_MOTIVOS[m] || m;
      while (rot.length < 34) rot += ".";
      L.push("  " + rot + " " + r.porMotivo[m]);
    });

    if (r.amostraAmbiguos.length) {
      L.push("");
      L.push("AMBÍGUAS — amostra (decisão humana, não se adivinha)");
      r.amostraAmbiguos.forEach(function (a) {
        L.push("  linha " + a.linha + ": \"" + a.texto + "\"");
        a.candidatos.forEach(function (c) { L.push("      → " + c); });
      });
    }
    if (r.amostraOrfaos.length) {
      L.push("");
      L.push("SEM ESCOLA PARECIDA — amostra");
      r.amostraOrfaos.forEach(function (o) {
        L.push("  linha " + o.linha + ": \"" + o.texto + "\"");
      });
    }
    L.push("");
    if (aplicou) {
      L.push("Backup da aba: " + r.backup);
      L.push("Para desfazer: apague a coluna " + ESC_VINC_COL_DESTINO + " desta aba.");
    } else {
      L.push("Nada foi gravado. Para aplicar:");
      L.push('  escolaVinculosAplicar("' + r.alvo + '")   — vale por ' + ESC_VINC_MINUTOS + ' minutos');
    }
    Logger.log(L.join("\n"));
  } catch (e) {
    Logger.log("Resultado calculado, impressão falhou: " + e.message);
    Logger.log(JSON.stringify(r));
  }
}

function escolaVincImprimirStatus_(r) {
  try {
    var L = ["═══ FASE 4 — VÍNCULOS COM A ESCOLA ═══", ""];
    r.alvos.sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (a) {
      var rot = a.ordem + ". " + a.rotulo;
      while (rot.length < 34) rot += " ";
      if (!a.existe)      L.push(rot + "aba não existe nesta planilha");
      else if (!a.migrado) L.push(rot + "não migrado  (" + a.total + " linhas)");
      else                 L.push(rot + a.comId + " de " + a.total + " com id");
    });
    L.push("");
    L.push('Para medir uma:  escolaVinculosPrevia("COBRANCA")');
    L.push("Ordem de risco crescente — Associados por último.");
    Logger.log(L.join("\n"));
  } catch (e) {
    Logger.log(JSON.stringify(r));
  }
}
