/**
 * TESTE — FASE 4: os módulos passam a guardar escolaId.
 *
 * O QUE ESTE ARQUIVO EXISTE PARA PROVAR
 *
 * Esta é a migração que toca os ~8.000 associados. Errar aqui não é quebrar
 * uma tela: é ligar um associado à escola errada, e ninguém descobrir —
 * porque a lista continua abrindo, o nome continua certo, e só a relação
 * nominal do mês que vem sai com a pessoa na escola errada.
 *
 * Os passos que mais importam:
 *
 *   - 12 e 13: NOME AMBÍGUO NÃO É ADIVINHADO. Se cair, a migração pode
 *     inventar vínculo, e é o pior desfecho possível desta fase.
 *   - 20: a coluna de nome NÃO é alterada. É a garantia de que dá para
 *     voltar atrás apagando uma coluna só.
 *   - 24: aplicar sem prévia é recusado.
 *   - 27: rodar duas vezes não troca vínculo já existente.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const ESC = b.logar(g, "joscimar");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const CAB_ESCOLAS = [
  "EscolaID", "Escola (Razão Social)", "CNPJ", "E-mail (principal)",
  "Telefone 1", "Cidade", "UF", "SITUACAO_CADASTRAL"
];

function escola(id, nome, cnpj) {
  return [id, nome, cnpj || "", "x@y.com", "(27) 3256-6107", "Alegre", "ES", "ATIVA"];
}

function montarEscolas() {
  const velha = ss.getSheetByName("Escolas");
  if (velha) ss.deleteSheet(velha);
  const sh = ss.insertSheet("Escolas");
  sh.getRange(1, 1, 1, CAB_ESCOLAS.length).setValues([CAB_ESCOLAS]);
  const linhas = [
    escola("ESC-000001", "Colégio Alfa",              "11.222.333/0001-81"),
    escola("ESC-000002", "Colégio Beta",              "22.333.444/0001-81"),
    escola("ESC-000003", "CEI Girassol Cariacica",    "33.444.555/0001-81"),
    escola("ESC-000004", "CEI Girassol Serra",        "44.555.666/0001-81"),
    escola("ESC-000005", "Escola São João",           "55.666.777/0001-81"),
    escola("ESC-000006", "Instituto Sem Documento",   ""),
    // duas linhas com o MESMO CNPJ — duplicata que já existe na base
    escola("ESC-000007", "Colégio Gêmeo Um",          "66.777.888/0001-81"),
    escola("ESC-000008", "Colégio Gêmeo Dois",        "66.777.888/0001-81")
  ];
  sh.getRange(2, 1, linhas.length, CAB_ESCOLAS.length).setValues(linhas);
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_); } catch (e) {}
  return sh;
}

function criarAba(nome, cabecalho, linhas) {
  const velha = ss.getSheetByName(nome);
  if (velha) ss.deleteSheet(velha);
  const sh = ss.insertSheet(nome);
  sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  if (linhas.length) sh.getRange(2, 1, linhas.length, cabecalho.length).setValues(linhas);
  return sh;
}

function coluna(nomeAba, nomeCol) {
  const sh = ss.getSheetByName(nomeAba);
  if (!sh || sh.getLastRow() < 2) return [];
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (c) { return String(c || "").trim(); });
  const i = cab.indexOf(nomeCol);
  if (i === -1) return null;
  return sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0] || "").trim(); });
}

function limparConsentimentos() {
  const p = g.PropertiesService.getScriptProperties();
  g.ESC_VINC_ALVOS.forEach(function (a) {
    try { p.deleteProperty(g.ESC_VINC_PROP_CONSENT + a.chave); } catch (e) {}
  });
}

/* ══════════════════════════════════════════════════════════════════════
   1. O ÍNDICE
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · O índice das escolas");

montarEscolas();

b.passo("1. Sem a coluna EscolaID, a Fase 4 se recusa a começar");
/* Migrar vínculo para uma identidade que não existe produziria uma coluna
 * de vazios — e a impressão de que a migração rodou. */
const shSemId = ss.getSheetByName("Escolas");
shSemId.getRange(1, 1).setValue("OUTRA_COISA");
let recusou = false, msgRecusa = "";
try { g.escolaVincIndice_(); } catch (e) { recusou = true; msgRecusa = e.message; }
b.ok(recusou && /EscolaID/.test(msgRecusa) && /escolaMigrarIds/.test(msgRecusa),
  "diz o que falta e qual função resolve", msgRecusa.slice(0, 90));
shSemId.getRange(1, 1).setValue("EscolaID");

b.passo("2. O índice lê a base uma vez e acha por documento e por nome");
const idx = g.escolaVincIndice_();
b.ok(idx.total === 8 && idx.nomes.length === 8,
  "8 escolas indexadas", "total=" + idx.total);

b.passo("3. CNPJ repetido vira AMBÍGUO no índice, não vira chave");
/* Colégio Gêmeo Um e Dois dividem o CNPJ. Se o índice escolhesse um, a
 * Fase 4 propagaria para todos os módulos uma duplicata que já existe na
 * base — e o erro passaria a ter aparência de dado confiável. */
b.ok(idx.porDoc["66777888000181"] === "__AMBIGUO__",
  "duplicata da base não vira vínculo", String(idx.porDoc["66777888000181"]));

/* ══════════════════════════════════════════════════════════════════════
   2. COMO CADA LINHA É RESOLVIDA
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Resolução linha a linha");

function resolver(doc, nome) { return g.escolaVincResolver_(idx, doc, nome); }

b.passo("4. Documento igual casa, e é o motivo mais forte");
const r4 = resolver("11.222.333/0001-81", "nome completamente diferente");
b.ok(r4.status === "CASADO" && r4.escolaId === "ESC-000001" && r4.motivo === "CNPJ",
  "o documento vence o nome", JSON.stringify(r4));

b.passo("5. Nome idêntico casa");
const r5 = resolver("", "Colégio Beta");
b.ok(r5.status === "CASADO" && r5.escolaId === "ESC-000002" && r5.motivo === "EXATO",
  "nome exato", JSON.stringify(r5));

b.passo("6. Nome sem acento e em caixa diferente também casa");
b.ok(resolver("", "COLEGIO BETA").escolaId === "ESC-000002",
  "'COLEGIO BETA' acha 'Colégio Beta'");

b.passo("7. Prefixo com candidato único casa");
const r7 = resolver("", "Escola São João da Barra");
b.ok(r7.status === "CASADO" && r7.escolaId === "ESC-000005" && r7.motivo === "PREFIXO",
  "o nome da ficha é mais longo, mas começa igual", JSON.stringify(r7));

b.passo("8. Nome contido com candidato único casa");
const r8 = resolver("", "Alfa");
b.ok(r8.status === "CASADO" && r8.escolaId === "ESC-000001" && r8.motivo === "CONTIDO",
  "'Alfa' está dentro de 'Colégio Alfa'", JSON.stringify(r8));

b.passo("9. Escola sem documento na base ainda casa pelo nome");
b.ok(resolver("", "Instituto Sem Documento").escolaId === "ESC-000006",
  "não ter CNPJ não impede o vínculo");

b.passo("10. Linha totalmente vazia é VAZIO, não órfã");
/* A distinção importa na leitura da prévia: linha sem escola nenhuma é
 * lixo da planilha; órfã é uma escola que existe e não foi achada. */
b.ok(resolver("", "").status === "VAZIO", "vazio é vazio");

b.passo("11. Nome que não parece com nada é ÓRFÃO");
b.ok(resolver("", "Faculdade Inexistente XPTO").status === "ORFAO",
  "sem candidato, sem palpite");

/* ══════════════════════════════════════════════════════════════════════
   3. AMBIGUIDADE — o coração desta fase
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Ambíguo não se adivinha");

b.passo("12. 'CEI Girassol' casa com DUAS escolas e NÃO é resolvido");
/* O passo mais importante do arquivo. Se ele cair, a migração passa a
 * inventar vínculo — e um associado da Girassol de Cariacica vai contar
 * para a de Serra na relação nominal, sem ninguém perceber. */
const r12 = resolver("", "CEI Girassol");
b.ok(r12.status === "AMBIGUO" && r12.escolaId === "" && r12.candidatos.length === 2,
  "duas candidatas, nenhum id gravado",
  JSON.stringify(r12.candidatos));

b.passo("13. E a prévia mostra QUAIS eram as candidatas");
b.ok(r12.candidatos.some(function (c) { return /Cariacica/.test(c); }) &&
     r12.candidatos.some(function (c) { return /Serra/.test(c); }) &&
     r12.candidatos.every(function (c) { return /ESC-\d+/.test(c); }),
  "quem for decidir vê o nome e o id das duas",
  r12.candidatos.join(" | "));

b.passo("14. Documento duplicado na base também vira ambíguo na resolução");
const r14 = resolver("66.777.888/0001-81", "");
b.ok(r14.status === "AMBIGUO" && r14.escolaId === "",
  "CNPJ que aponta para duas escolas não resolve", JSON.stringify(r14));

b.passo("15. Dois nomes apontando para a MESMA escola não é ambiguidade");
/* Caso real depois de uma fusão: a base tem o mesmo id sob nomes parecidos.
 * Tratar isso como ambíguo mandaria para a fila algo que é seguro casar. */
const shE = ss.getSheetByName("Escolas");
shE.appendRow(escola("ESC-000001", "Colégio Alfa Unidade Centro", ""));
const idx15 = g.escolaVincIndice_();
const r15 = g.escolaVincResolver_(idx15, "", "Colégio Alfa Unidade");
b.ok(r15.status === "CASADO" && r15.escolaId === "ESC-000001",
  "mesmo id sob dois nomes casa sem hesitar", JSON.stringify(r15));
shE.deleteRow(shE.getLastRow());

/* ══════════════════════════════════════════════════════════════════════
   4. A PRÉVIA — mede e não escreve
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Prévia da Cobrança");

criarAba("COBRANCA_RELACAO_NOMINAL",
  ["ID", "ESCOLA_CNPJ", "ESCOLA_NOME", "ESCOLA_EMAIL", "COMPETENCIA"],
  [
    ["1", "11.222.333/0001-81", "Colégio Alfa",  "a@x.com", "2026-07"],
    ["2", "22.333.444/0001-81", "Colégio Beta",  "b@x.com", "2026-07"],
    ["3", "",                   "CEI Girassol",  "c@x.com", "2026-07"],
    ["4", "",                   "Nada Parecido", "d@x.com", "2026-07"],
    ["5", "",                   "",              "",        "2026-07"]
  ]);
limparConsentimentos();

const p1 = g.escolaVinculosPrevia("COBRANCA", ADM);

b.passo("16. A prévia conta certo, separando cada desfecho");
b.ok(p1.ok === true && p1.contagem.CASADO === 2 && p1.contagem.AMBIGUO === 1 &&
     p1.contagem.ORFAO === 1 && p1.contagem.VAZIO === 1 && p1.total === 5,
  "2 casadas, 1 ambígua, 1 órfã, 1 vazia", JSON.stringify(p1.contagem));

b.passo("17. E diz POR QUE casou, separando documento de nome");
b.ok(p1.porMotivo.CNPJ === 2 && !p1.porMotivo.EXATO,
  "as duas casaram pelo documento, não pelo nome", JSON.stringify(p1.porMotivo));

b.passo("18. A prévia NÃO cria a coluna EscolaID");
b.ok(coluna("COBRANCA_RELACAO_NOMINAL", "EscolaID") === null && p1.escreveu === false,
  "medir não é escrever");

b.passo("19. Nem cria backup — não há o que salvar");
const abasApos = ss.getSheets().map(function (s) { return s.getName(); });
b.ok(abasApos.filter(function (n) { return n.indexOf("BKP_VINC_") === 0; }).length === 0,
  "backup só quando vai escrever");

/* ══════════════════════════════════════════════════════════════════════
   5. APLICAR
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Aplicar na Cobrança");

const nomesAntes = coluna("COBRANCA_RELACAO_NOMINAL", "ESCOLA_NOME");
const a1 = g.escolaVinculosAplicar("COBRANCA", ADM);

b.passo("20. A COLUNA DE NOME NÃO FOI TOCADA");
/* A garantia de reversibilidade inteira desta fase. Se o nome mudasse,
 * desfazer deixaria de ser "apagar uma coluna". */
b.igual(coluna("COBRANCA_RELACAO_NOMINAL", "ESCOLA_NOME"), nomesAntes,
  "migrar acrescenta, não reescreve");

b.passo("21. A coluna EscolaID nasceu, com id só onde havia certeza");
const ids21 = coluna("COBRANCA_RELACAO_NOMINAL", "EscolaID");
b.igual(ids21, ["ESC-000001", "ESC-000002", "", "", ""],
  "ambígua, órfã e vazia ficaram em branco — de propósito");

b.passo("22. E o backup da aba existe");
const bkp = ss.getSheets().map(function (s) { return s.getName(); })
  .filter(function (n) { return n.indexOf("BKP_VINC_") === 0; });
b.ok(a1.escreveu === true && bkp.length === 1 && a1.backup === bkp[0],
  "backup nomeado no retorno", a1.backup);

b.passo("23. A aplicação conta o mesmo que a prévia contou");
/* Prévia e aplicação são a MESMA função com um parâmetro. Este passo é o
 * que trava isso: se alguém escrever uma segunda implementação, os números
 * divergem aqui. */
b.igual(a1.contagem, p1.contagem, "mesma medição, mesmo código");

/* ══════════════════════════════════════════════════════════════════════
   6. AS TRAVAS
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Travas");

b.passo("24. Aplicar sem prévia é recusado");
criarAba("Agend_Oftalmo", ["ID", "Data", "CPF_Titular", "Escola"],
  [["1", "01/08", "000", "Colégio Alfa"]]);
limparConsentimentos();
const semPrevia = g.escolaVinculosAplicar("OFTALMO", ADM);
/* A mensagem é conferida com precisão, não só por conter "prévia".
 *
 * Motivo: existe uma SEGUNDA trava logo abaixo — a de validade — que também
 * recusaria este caso, e cuja mensagem diz "a prévia tem mais de 15 minutos".
 * Numa mutação que removesse a primeira trava, o sistema continuaria seguro
 * mas mandaria o usuário procurar uma prévia vencida que nunca existiu.
 * Recusa certa com explicação errada é como se perde meia hora. */
b.ok(semPrevia.ok === false &&
     /Rode a prévia/i.test(semPrevia.mensagem) &&
     !/minutos/i.test(semPrevia.mensagem) &&
     coluna("Agend_Oftalmo", "EscolaID") === null,
  "recusa dizendo exatamente o que fazer", semPrevia.mensagem.slice(0, 70));

b.passo("25. A prévia de UM alvo não autoriza aplicar em OUTRO");
/* Consentimento genérico é o mesmo que consentimento nenhum: ver a prévia
 * de 5 linhas da Cobrança não pode liberar escrita nos 8.000 associados. */
limparConsentimentos();
g.escolaVinculosPrevia("COBRANCA", ADM);
const cruzado = g.escolaVinculosAplicar("OFTALMO", ADM);
b.ok(cruzado.ok === false && coluna("Agend_Oftalmo", "EscolaID") === null,
  "o consentimento é por aba", cruzado.mensagem.slice(0, 70));

b.passo("26. Consentimento vencido não vale");
limparConsentimentos();
g.escolaVinculosPrevia("OFTALMO", ADM);
const props = g.PropertiesService.getScriptProperties();
props.setProperty(g.ESC_VINC_PROP_CONSENT + "OFTALMO",
  JSON.stringify({ quando: new Date().getTime() - (g.ESC_VINC_MINUTOS + 1) * 60 * 1000 }));
const vencido = g.escolaVinculosAplicar("OFTALMO", ADM);
b.ok(vencido.ok === false && /minutos/i.test(vencido.mensagem) &&
     coluna("Agend_Oftalmo", "EscolaID") === null,
  "a base pode ter mudado nesse tempo", vencido.mensagem.slice(0, 70));

b.passo("27. Uma prévia serve para UMA aplicação");
limparConsentimentos();
g.escolaVinculosPrevia("OFTALMO", ADM);
const primeira = g.escolaVinculosAplicar("OFTALMO", ADM);
const segunda  = g.escolaVinculosAplicar("OFTALMO", ADM);
b.ok(primeira.ok === true && segunda.ok === false,
  "o consentimento é consumido, não fica de pé");

/* ══════════════════════════════════════════════════════════════════════
   7. RODAR DE NOVO
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Idempotência");

b.passo("28. Rodar de novo não troca vínculo já gravado");
/* Inclui vínculo que alguém corrigiu à mão: se a rotina reavaliasse, ela
 * desfaria a correção humana na próxima execução. */
const shC = ss.getSheetByName("Agend_Oftalmo");
const cabC = shC.getRange(1, 1, 1, shC.getLastColumn()).getValues()[0]
  .map(function (c) { return String(c || "").trim(); });
shC.getRange(2, cabC.indexOf("EscolaID") + 1).setValue("ESC-000004");  // correção humana
limparConsentimentos();
g.escolaVinculosPrevia("OFTALMO", ADM);
const denovo = g.escolaVinculosAplicar("OFTALMO", ADM);
b.ok(coluna("Agend_Oftalmo", "EscolaID")[0] === "ESC-000004" && denovo.contagem.JA_TINHA === 1,
  "correção a mão sobrevive à rotina",
  "id=" + coluna("Agend_Oftalmo", "EscolaID")[0]);

b.passo("29. E não cria uma segunda coluna EscolaID");
const cabDepois = shC.getRange(1, 1, 1, shC.getLastColumn()).getValues()[0]
  .map(function (c) { return String(c || "").trim(); });
b.ok(cabDepois.filter(function (c) { return c === "EscolaID"; }).length === 1,
  "uma coluna só, sempre");

/* ══════════════════════════════════════════════════════════════════════
   8. ABA AUSENTE OU COLUNA IRRECONHECÍVEL
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Quando não dá para prosseguir");

b.passo("30. Aba que não existe é recusada com nome e motivo");
const semAba = g.escolaVinculosPrevia("TAXA", ADM);   // ENVIO_TAXA_ASSISTENCIAL não existe no teste
b.ok(semAba.ok === false && /não existe/i.test(semAba.mensagem),
  "diz qual aba faltou", semAba.mensagem.slice(0, 70));

b.passo("31. Coluna irreconhecível RECUSA a aba — não escreve por posição");
/* É assim que a aba Escolas ficou com telefone dentro da razão social:
 * alguém escreveu por posição. A Fase 4 não repete isso. */
criarAba("Agend_Oftalmo", ["ID", "Data", "CPF_Titular", "Instituicao"],
  [["1", "01/08", "000", "Colégio Alfa"]]);
const semColuna = g.escolaVinculosPrevia("OFTALMO", ADM);
b.ok(semColuna.ok === false && /coluna da escola/i.test(semColuna.mensagem) &&
     /Instituicao|Municipio/.test(semColuna.mensagem),
  "mostra o que procurou e o que achou", semColuna.mensagem.slice(0, 110));

b.passo("32. E a recusa não deixa consentimento de pé");
const consent = g.PropertiesService.getScriptProperties()
  .getProperty(g.ESC_VINC_PROP_CONSENT + "OFTALMO");
b.ok(!consent, "prévia que falhou não autoriza nada");

/* ══════════════════════════════════════════════════════════════════════
   9. PERMISSÃO
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Quem pode migrar");

b.passo("33. Sem sessão, ninguém mede");
b.bloqueia(function () { return g.escolaVinculosPrevia("COBRANCA", ""); },
  "escolaVinculosPrevia exige sessão");

b.passo("34. Usuário comum com o módulo escolas NÃO migra");
/* Ler a fila de pendências é trabalho de todo dia; reescrever o vínculo de
 * 8.000 associados não é. Por isso esta porta pede administrador, enquanto
 * a das Pendências não pede. */
b.bloqueia(function () { return g.escolaVinculosPrevia("COBRANCA", ESC); },
  "joscimar vê pendências, mas não migra vínculo");

b.passo("35. E aplicar tem a mesma trava");
b.bloqueia(function () { return g.escolaVinculosAplicar("COBRANCA", ESC); },
  "a porta de escrita não é mais frouxa que a de leitura");

b.passo("36. Conta Google qualquer não passa pela porta do editor");
g.__usuarioAtivoEmail = "estranho@gmail.com";
b.bloqueia(function () { return g.escolaVinculosPrevia("COBRANCA"); },
  "sem token, só dono do projeto ou admin cadastrado");
g.__usuarioAtivoEmail = "";

/* ══════════════════════════════════════════════════════════════════════
   10. STATUS
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Painel de status");

const st = g.escolaVinculosStatus(ADM);

b.passo("37. O status lista os alvos em ordem de risco, Associados por último");
/* A lista veio do mapeamento da planilha real em 12/08/2026 — 102 abas, 24
 * tocando escola, 14 escolhidas. Não é palpite: cada nome aqui foi lido do
 * cabeçalho da aba que existe. */
const chaves = st.alvos.map(function (a) { return a.chave; });
b.ok(chaves.length === 14 &&
     chaves[0] === "VISITAS" && chaves[chaves.length - 1] === "ASSOCIADOS" &&
     chaves.indexOf("OFICIOS") > chaves.indexOf("JURIDICO"),
  "14 alvos, do menor para o maior", chaves.join(" → "));

b.passo("37b. Nenhum alvo aponta para aba de importação ou log");
/* Área de importação é retrato, não vínculo. Log é registro histórico, e
 * reescrever log é adulterar registro. */
const abas = st.alvos.map(function (a) { return a.aba; });
b.ok(abas.indexOf("IMPORTACAO_ESCOLAS") === -1 && abas.indexOf("LOG_SISTEMA") === -1 &&
     abas.indexOf("Prestadores_Serviços") === -1,
  "importação, log e prestadores ficam de fora");

b.passo("38. E diz quantas linhas já têm id em cada uma");
const cob = st.alvos.filter(function (a) { return a.chave === "COBRANCA"; })[0];
b.ok(cob.existe === true && cob.migrado === true && cob.comId === 2 && cob.total === 5,
  "2 de 5 na Cobrança", "comId=" + cob.comId + " total=" + cob.total);

b.passo("39. Aba inexistente aparece como tal, sem quebrar o painel");
const of = st.alvos.filter(function (a) { return a.chave === "TAXA"; })[0];
b.ok(st.ok === true && of.existe === false,
  "o painel sobrevive a alvo ausente");

b.passo("39b. O log sugere o PRÓXIMO alvo por migrar, não um nome fixo");
/* O rodapé dizia sempre "COBRANCA". Depois do mapeamento da planilha real
 * ela virou o penúltimo alvo, com 939 linhas — e o log passou a empurrar
 * para o maior quando havia um de 6 linhas por fazer. */
g.Logger.clear();
g.escolaVinculosStatus(ADM);
const logSt = g.Logger.getLog();
b.ok(/PRÓXIMO PASSO/.test(logSt) && !/escolaVinculosPrevia\("COBRANCA"\)/.test(logSt),
  "aponta o menor alvo pendente",
  (logSt.split("\n").filter(function (l) { return /escolaVinculosPrevia/.test(l); })[0] || "").trim());

b.passo("40. O status é só leitura");
const antesStatus = JSON.stringify(coluna("COBRANCA_RELACAO_NOMINAL", "EscolaID"));
g.escolaVinculosStatus(ADM);
b.ok(JSON.stringify(coluna("COBRANCA_RELACAO_NOMINAL", "EscolaID")) === antesStatus,
  "consultar não altera");

/* ══════════════════════════════════════════════════════════════════════
   11. ASSOCIADOS — o alvo de verdade
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Associados, em escala");

const linhasAss = [];
for (let i = 0; i < 400; i++) linhasAss.push(["Colégio Alfa", "Pessoa " + i, "000", "S"]);
for (let i = 0; i < 300; i++) linhasAss.push(["Colégio Beta", "Pessoa B" + i, "000", "S"]);
for (let i = 0; i < 120; i++) linhasAss.push(["CEI Girassol", "Pessoa G" + i, "000", "S"]);
for (let i = 0; i < 60; i++)  linhasAss.push(["Escola Que Nao Existe", "Pessoa X" + i, "000", "S"]);
for (let i = 0; i < 20; i++)  linhasAss.push(["", "Pessoa sem escola " + i, "000", "S"]);
criarAba("Associados", ["Nome fantasia", "Nome", "CPF", "Filiado"], linhasAss);

limparConsentimentos();
const pAss = g.escolaVinculosPrevia("ASSOCIADOS", ADM);

b.passo("41. 900 associados medidos numa passada");
b.ok(pAss.ok === true && pAss.total === 900 &&
     pAss.contagem.CASADO === 700 && pAss.contagem.AMBIGUO === 120 &&
     pAss.contagem.ORFAO === 60 && pAss.contagem.VAZIO === 20,
  "700 casados, 120 ambíguos, 60 órfãos, 20 vazios", JSON.stringify(pAss.contagem));

b.passo("42. Os 120 da Girassol ficam SEM id, mesmo sendo 120");
/* Volume não é argumento para adivinhar. 120 associados na escola errada é
 * pior que 120 associados sem vínculo. */
const aAss = g.escolaVinculosAplicar("ASSOCIADOS", ADM);
const idsAss = coluna("Associados", "EscolaID");
const daGirassol = idsAss.slice(700, 820);
b.ok(daGirassol.every(function (v) { return v === ""; }),
  "nenhum palpite em 120 linhas",
  "não-vazios: " + daGirassol.filter(String).length);

b.passo("43. E os 700 que casaram apontam para a escola certa");
b.ok(idsAss.slice(0, 400).every(function (v) { return v === "ESC-000001"; }) &&
     idsAss.slice(400, 700).every(function (v) { return v === "ESC-000002"; }),
  "400 na Alfa, 300 na Beta");

b.passo("44. A coluna 'Nome fantasia' continua intacta nas 900 linhas");
const nomesAss = coluna("Associados", "Nome fantasia");
b.ok(nomesAss.length === 900 && nomesAss[0] === "Colégio Alfa" &&
     nomesAss[899] === "" && nomesAss[700] === "CEI Girassol",
  "o vínculo antigo continua onde estava — é o caminho de volta");

b.passo("45. E existe backup da aba de associados");
b.ok(!!aAss.backup && !!ss.getSheetByName(aAss.backup) &&
     ss.getSheetByName(aAss.backup).getLastRow() === 901,
  "backup com as 900 linhas + cabeçalho", aAss.backup);

/* ══════════════════════════════════════════════════════════════════════
   12. MAPEAR AS ABAS — descobrir os nomes reais em vez de adivinhar
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("VÍNCULOS · Mapear a planilha");

/* Duas abas com nomes que eu NÃO deduzi: é o caso real de 12/08/2026, em que
 * "Contatos" e "Controle_Oficios" não existiam com esse nome na planilha. */
criarAba("Cadastro_Contatos_Escola",
  ["ID", "Nome do contato", "Fone", "Instituição de Ensino"],
  [["1", "Maria", "27999", "Colégio Alfa"], ["2", "João", "27988", "Colégio Beta"]]);
criarAba("Controle de Ofícios 2026",
  ["NUM", "DATA", "DESTINATARIO", "DOC"],
  [["1", "01/07", "Colégio Alfa", "11.222.333/0001-81"],
   ["2", "02/07", "Colégio Beta", "22.333.444/0001-81"],
   ["3", "03/07", "Colégio Alfa", "11.222.333/0001-81"]]);
criarAba("Financeiro_Boletos", ["ID", "VALOR", "VENCIMENTO"],
  [["1", "100", "01/08"], ["2", "200", "02/08"]]);

const mapa = g.escolaVinculosMapearAbas(ADM);

b.passo("46. Acha a aba de contatos pelo NOME da coluna, mesmo com outro rótulo");
const cont = mapa.candidatas.filter(function (c) { return c.aba === "Cadastro_Contatos_Escola"; })[0];
b.ok(!!cont && cont.colunasPorNome.indexOf("Instituição de Ensino") > -1,
  "'Instituição de Ensino' é reconhecida como referência a escola",
  cont ? cont.colunasPorNome.join(" · ") : "não veio");

b.passo("47. E acha a de ofícios pelo CONTEÚDO, mesmo com cabeçalho genérico");
/* "DOC" não diz nada; o que denuncia a coluna é ter CNPJ dentro. É assim que
 * se acha a aba certa quando ninguém padronizou o cabeçalho. */
const ofi = mapa.candidatas.filter(function (c) { return c.aba === "Controle de Ofícios 2026"; })[0];
b.ok(!!ofi && ofi.colunasPorConteudo.indexOf("DOC") > -1,
  "coluna 'DOC' delatada pelo conteúdo",
  ofi ? "porConteudo=" + ofi.colunasPorConteudo.join(" · ") : "não veio");

b.passo("47b. 'ESCOLARIDADE' NÃO é reconhecida como referência a escola");
/* Falso positivo real do mapeamento de 12/08/2026: a aba
 * SISGEP_Sindicalizacao entrou na lista porque "ESCOLARIDADE" contém
 * "escola". Sem este descarte, toda ficha cadastral vira candidata. */
criarAba("Fichas_Com_Escolaridade", ["ID", "NOME", "ESCOLARIDADE"],
  [["1", "Maria", "Superior"], ["2", "João", "Médio"]]);
const mapa2 = g.escolaVinculosMapearAbas(ADM);
b.ok(!mapa2.candidatas.some(function (c) { return c.aba === "Fichas_Com_Escolaridade"; }),
  "escolaridade é grau de ensino, não escola");

b.passo("48. Aba sem nenhuma referência a escola fica de fora");
b.ok(!mapa.candidatas.some(function (c) { return c.aba === "Financeiro_Boletos"; }),
  "lista curta é lista útil");

b.passo("49. Backups e a própria aba Escolas não entram na lista");
/* Um backup casaria com tudo e poluiria a lista justamente quando ela
 * precisa ser curta para eu ler. */
b.ok(!mapa.candidatas.some(function (c) {
       return c.aba === "Escolas" || c.aba.indexOf("BKP_VINC_") === 0; }),
  "sem ruído", mapa.candidatas.map(function (c) { return c.aba; }).join(", "));

b.passo("50. As abas já mapeadas aparecem marcadas, para eu não duplicar alvo");
const cobM = mapa.candidatas.filter(function (c) { return c.aba === "COBRANCA_RELACAO_NOMINAL"; })[0];
b.ok(!!cobM && cobM.jaMapeada === "COBRANCA",
  "diz qual alvo já cobre aquela aba", cobM ? cobM.jaMapeada : "não veio");

b.passo("51. O mapa é só leitura");
const antesMapa = JSON.stringify(coluna("Associados", "EscolaID"));
g.escolaVinculosMapearAbas(ADM);
b.ok(JSON.stringify(coluna("Associados", "EscolaID")) === antesMapa,
  "mapear não altera nada");

b.passo("52. E exige administrador, como as outras portas da Fase 4");
b.bloqueia(function () { return g.escolaVinculosMapearAbas(ESC); },
  "mapear a planilha inteira não é leitura de rotina");

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
