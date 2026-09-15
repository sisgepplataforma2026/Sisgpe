/**
 * TESTE PONTA A PONTA — DOCUMENTOS › DECLARAÇÕES › DECLARAÇÃO DE DIRETOR
 *
 * O QUE ESTE TESTE COBRE DE VERDADE
 *   cadastro da diretoria, trava do signatário único, mandato vigente,
 *   montagem do texto nas três formas, numeração sequencial por ano,
 *   aviso de duplicata, registro na planilha, histórico, permissão e
 *   trilha de auditoria.
 *
 * O QUE ELE NÃO COBRE, E POR QUÊ
 *   O PDF em si. `declGerarPdf_` depende do conversor de HTML do Apps
 *   Script e do Drive, que o emulador não reproduz — HtmlService daqui não
 *   tem getBlob. Ele é SUBSTITUÍDO abaixo por um dublê, o que permite
 *   testar todo o resto da cadeia. O arquivo gerado, o layout do papel e a
 *   gravação na pasta do ambiente continuam "NÃO TESTADOS" pela REGRA Nº -1
 *   até alguém emitir uma declaração no sistema no ar.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const TOKEN = b.logar(g, "wanderson");
const TOKEN_ESC = b.logar(g, "joscimar"); // escolas+sindicalizacao, sem documentos

/* ── Dublê do PDF. Registra o que teria sido gerado, para as asserções. ── */
const pdfsGerados = [];
g.declGerarPdf_ = function (p) {
  pdfsGerados.push(p);
  const html = g.declHtmlDeclaracao_(p); // o HTML real roda, e precisa não explodir
  return { id: "PDF_" + pdfsGerados.length, url: "https://drive.google.com/file/d/PDF_" + pdfsGerados.length + "/view", html };
};

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const hoje = new Date();
const iso = d => d.toISOString().slice(0, 10);
const emDias = n => { const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d); };

/* ══════════ 1. CADASTRO DA DIRETORIA ══════════ */
b.fluxo("DECLARAÇÕES · Cadastro da Diretoria");

b.passo("1. Cadastrar o presidente (signatário)");
const pres = g.declSalvarDiretor({
  nome: "Leonil Dias da Silva", cargo: "Presidente",
  mandatoInicio: emDias(-400), mandatoFim: emDias(900),
  assinaComoPresidente: true, ativo: true
}, TOKEN);
b.ok(pres && pres.ok, "presidente cadastrado", pres && (pres.id || pres.mensagem));

b.passo("2. Cadastrar o diretor que recebe a declaração");
const dir = g.declSalvarDiretor({
  nome: "Wanderson Nascimento Castelo", cargo: "Diretor",
  mandatoInicio: emDias(-400), mandatoFim: emDias(900), ativo: true
}, TOKEN);
b.ok(dir && dir.ok, "diretor cadastrado", dir && (dir.id || dir.mensagem));

b.passo("3. O nome é gravado em caixa alta — é assim que sai no documento");
const listou = g.declListarDiretoria(TOKEN);
const oDiretor = listou.diretores.filter(d => d.id === dir.id)[0];
b.ok(oDiretor && oDiretor.nome === "WANDERSON NASCIMENTO CASTELO",
  "nome normalizado para caixa alta", oDiretor && oDiretor.nome);

b.passo("4. Recusa cadastro sem cargo");
const semCargo = g.declSalvarDiretor({ nome: "Fulano", cargo: "" }, TOKEN);
b.ok(semCargo && !semCargo.ok, "cargo é obrigatório", semCargo && semCargo.mensagem);

b.passo("5. Recusa mandato com fim antes do início");
const invertido = g.declSalvarDiretor({
  nome: "Ciclano", cargo: "Diretor", mandatoInicio: emDias(10), mandatoFim: emDias(-10)
}, TOKEN);
b.ok(invertido && !invertido.ok, "fim anterior ao início é recusado", invertido && invertido.mensagem);

/* ══════════ 2. A TRAVA DO SIGNATÁRIO ÚNICO ══════════ */
b.fluxo("DECLARAÇÕES · Só um diretor assina");

b.passo("6. Marcar um segundo signatário desmarca o primeiro");
g.declSalvarDiretor({ id: dir.id, nome: "Wanderson Nascimento Castelo", cargo: "Diretor",
  mandatoInicio: emDias(-400), mandatoFim: emDias(900), assinaComoPresidente: true, ativo: true }, TOKEN);
const apos = g.declListarDiretoria(TOKEN).diretores.filter(d => d.assinaComoPresidente);
b.ok(apos.length === 1, "exatamente um signatário depois da troca", apos.length + " marcado(s)");
b.ok(apos[0] && apos[0].id === dir.id, "o signatário é o último marcado", apos[0] && apos[0].nome);

b.passo("7. Devolver a assinatura ao presidente");
g.declSalvarDiretor({ id: pres.id, nome: "Leonil Dias da Silva", cargo: "Presidente",
  mandatoInicio: emDias(-400), mandatoFim: emDias(900), assinaComoPresidente: true, ativo: true }, TOKEN);
const sig = g.declSignatario_();
b.ok(sig && sig.id === pres.id, "presidente voltou a ser o signatário", sig && sig.nome);

b.passo("8. Inativar quem assina é recusado — deixaria declaração sem assinatura");
const tentaInativar = g.declAlternarDiretor(pres.id, false, TOKEN);
b.ok(tentaInativar && !tentaInativar.ok, "recusa inativar o signatário", tentaInativar && tentaInativar.mensagem);

/* ══════════ 3. MANDATO VIGENTE ══════════ */
b.fluxo("DECLARAÇÕES · Mandato vencido não recebe declaração");

b.passo("9. Cadastrar diretor com mandato já encerrado");
const vencido = g.declSalvarDiretor({
  nome: "Diretor Antigo", cargo: "Diretor",
  mandatoInicio: emDias(-800), mandatoFim: emDias(-30), ativo: true
}, TOKEN);
b.ok(vencido && vencido.ok, "cadastrado", vencido && vencido.id);

b.passo("10. Ele não entra na lista de quem pode receber declaração");
const habilitados = g.declDiretoresHabilitados_().map(d => d.id);
b.ok(habilitados.indexOf(vencido.id) < 0, "mandato vencido fica fora da emissão",
  habilitados.length + " habilitado(s)");

b.passo("11. E a emissão recusa com o motivo à vista");
const recusa = g.declPreviaDeclaracaoDiretor(
  { diretorId: vencido.id, dataLiberacao: emDias(3), periodo: "" }, TOKEN);
b.ok(recusa && !recusa.ok && /mandato/i.test(recusa.mensagem || ""),
  "recusa por mandato não vigente", recusa && recusa.mensagem);

/* ══════════ 4. O TEXTO — AS TRÊS FORMAS ══════════ */
b.fluxo("DECLARAÇÕES · Texto do documento");

const dataTeste = new Date(2026, 8, 18); // 18/09/2026

b.passo("12. Sem período");
const t1 = g.declMontarTexto_({ nome: "Wanderson Nascimento Castelo", cargo: "Diretor", dataLiberacao: dataTeste, periodo: "" });
b.ok(t1.indexOf("no dia 18 de setembro de 2026, estará à disposição") > -1,
  "vai direto da data para 'estará à disposição'", t1.slice(90, 190));

b.passo("13. Período integral");
const t2 = g.declMontarTexto_({ nome: "X", cargo: "Diretor", dataLiberacao: dataTeste, periodo: "INTEGRAL" });
b.ok(t2.indexOf("no dia 18 de setembro de 2026, em período integral, estará") > -1,
  "diz 'em período integral'", t2.slice(60, 160));

b.passo("14. Turno");
const t3 = g.declMontarTexto_({ nome: "X", cargo: "Diretor", dataLiberacao: dataTeste, periodo: "VESPERTINO" });
b.ok(t3.indexOf("no dia 18 de setembro de 2026, no período vespertino, estará") > -1,
  "diz 'no período vespertino'", t3.slice(60, 160));

b.passo("15. O texto NÃO menciona horário — foi retirado a pedido do usuário");
b.ok(!/\d{1,2}h|\bhoras\b|às \d{1,2}:/.test(t1 + t2 + t3), "nenhuma forma cita horário");

b.passo("16. O nome sai em caixa alta e o cargo em minúscula, como no modelo");
b.ok(t1.indexOf("que WANDERSON NASCIMENTO CASTELO, diretor desta Entidade Sindical") > -1,
  "trecho de identificação igual ao papel", t1.slice(0, 140));

b.passo("17. Data por extenso em português");
b.ok(g.declDataExtenso_("2026-03-01") === "1 de março de 2026",
  "1 de março de 2026", g.declDataExtenso_("2026-03-01"));
b.ok(g.declDataExtenso_("18/09/2026") === "18 de setembro de 2026",
  "aceita data digitada em dd/mm/aaaa", g.declDataExtenso_("18/09/2026"));

/* ══════════ 5. EMISSÃO ══════════ */
b.fluxo("DECLARAÇÕES · Emissão ponta a ponta (PDF dublado)");

b.passo("18. Emitir a primeira declaração");
const e1 = g.declEmitirDeclaracaoDiretor(
  { diretorId: dir.id, dataLiberacao: emDias(3), periodo: "VESPERTINO" }, TOKEN);
b.ok(e1 && e1.ok, "emissão conclui", e1 && (e1.numero || e1.mensagem));

b.passo("19. Número no formato 001/AAAA");
const anoAtual = new Date().getFullYear();
b.ok(e1.numero === "001/" + anoAtual, "primeiro número do ano", e1.numero);

b.passo("20. A linha foi realmente gravada");
const abaDecl = ss.getSheetByName("DECLARACOES_DIRETOR");
b.ok(abaDecl && abaDecl.getLastRow() === 2, "uma linha de emissão na planilha",
  "linhas: " + (abaDecl ? abaDecl.getLastRow() - 1 : 0));

b.passo("21. O TEXTO emitido ficou gravado, não só os campos");
const hist1 = g.declHistoricoDeclaracoes({}, TOKEN);
const reg1 = hist1.itens[0];
b.ok(reg1 && reg1.texto === e1.texto && reg1.texto.length > 100,
  "texto assinado guardado na linha", reg1 && reg1.texto.slice(0, 60) + "…");

b.passo("22. O PDF recebeu o signatário certo");
const ultimoPdf = pdfsGerados[pdfsGerados.length - 1];
b.ok(ultimoPdf && ultimoPdf.signatario && ultimoPdf.signatario.nome === "LEONIL DIAS DA SILVA",
  "assina quem está marcado no cadastro", ultimoPdf && ultimoPdf.signatario && ultimoPdf.signatario.nome);

b.passo("23. O HTML do documento traz a citação literal do art. 543");
const htmlGerado = g.declHtmlDeclaracao_(ultimoPdf);
b.ok(htmlGerado.indexOf("Decreto-lei nº 229, 28.2.1967") > -1,
  "a redação do Decreto-lei nº 229 está no documento");
b.ok(htmlGerado.indexOf("Por ser verdade firmamos a presente.") > -1,
  "o fecho do modelo em papel está no documento");
b.ok(htmlGerado.indexOf("Vitória, ") > -1, "cidade e data de emissão no documento");

b.passo("24. Segunda emissão numera 002");
const e2 = g.declEmitirDeclaracaoDiretor(
  { diretorId: dir.id, dataLiberacao: emDias(10), periodo: "" }, TOKEN);
b.ok(e2 && e2.ok && e2.numero === "002/" + anoAtual, "numeração sequencial", e2 && e2.numero);

/* ══════════ 6. DUPLICATA ══════════ */
b.fluxo("DECLARAÇÕES · Mesmo diretor, mesmo dia");

b.passo("25. A segunda para o mesmo dia PEDE confirmação");
const dup = g.declEmitirDeclaracaoDiretor(
  { diretorId: dir.id, dataLiberacao: emDias(3), periodo: "VESPERTINO" }, TOKEN);
b.ok(dup && !dup.ok && dup.precisaConfirmar === true, "avisa antes de emitir outra via", dup && dup.mensagem);

b.passo("26. E não gravou nada enquanto não confirmam");
b.ok(abaDecl.getLastRow() === 3, "continua com duas emissões", "linhas: " + (abaDecl.getLastRow() - 1));

b.passo("27. Confirmada, emite a segunda via");
const dupOk = g.declEmitirDeclaracaoDiretor(
  { diretorId: dir.id, dataLiberacao: emDias(3), periodo: "VESPERTINO", confirmado: true }, TOKEN);
b.ok(dupOk && dupOk.ok && dupOk.numero === "003/" + anoAtual, "segunda via emitida", dupOk && dupOk.numero);

/* ══════════ 7. SEM SIGNATÁRIO NÃO EMITE ══════════ */
b.fluxo("DECLARAÇÕES · Sem signatário o sistema para");

b.passo("28. Desmarcar o signatário e tentar emitir");
g.declSalvarDiretor({ id: pres.id, nome: "Leonil Dias da Silva", cargo: "Presidente",
  mandatoInicio: emDias(-400), mandatoFim: emDias(900), assinaComoPresidente: false, ativo: true }, TOKEN);
const semSig = g.declEmitirDeclaracaoDiretor(
  { diretorId: dir.id, dataLiberacao: emDias(20), periodo: "" }, TOKEN);
b.ok(semSig && !semSig.ok && /signat/i.test(semSig.mensagem || ""),
  "recusa emitir sem ninguém para assinar", semSig && semSig.mensagem);

b.passo("29. E não consumiu número nem gravou linha");
b.ok(abaDecl.getLastRow() === 4, "nada foi gravado na recusa", "linhas: " + (abaDecl.getLastRow() - 1));

// devolve o estado para os testes seguintes
g.declSalvarDiretor({ id: pres.id, nome: "Leonil Dias da Silva", cargo: "Presidente",
  mandatoInicio: emDias(-400), mandatoFim: emDias(900), assinaComoPresidente: true, ativo: true }, TOKEN);

/* ══════════ 8. HISTÓRICO ══════════ */
b.fluxo("DECLARAÇÕES · Histórico");

b.passo("30. Lista em ordem — mais recente primeiro");
const hist = g.declHistoricoDeclaracoes({}, TOKEN);
b.ok(hist.ok && hist.itens.length === 3, "as três emissões aparecem", "total: " + hist.total);
b.ok(hist.itens[0].numero === "003/" + anoAtual, "mais recente no topo", hist.itens[0].numero);

b.passo("31. Busca por nome do diretor");
const porNome = g.declHistoricoDeclaracoes({ busca: "wanderson" }, TOKEN);
b.ok(porNome.ok && porNome.itens.length === 3, "busca insensível a caixa", "achou " + porNome.total);

b.passo("32. Busca que não existe devolve vazio, não tudo");
const nada = g.declHistoricoDeclaracoes({ busca: "zzzzzz" }, TOKEN);
b.ok(nada.ok && nada.itens.length === 0, "filtro realmente filtra", "achou " + nada.total);

b.passo("33. Filtro por faixa de data da liberação");
const faixa = g.declHistoricoDeclaracoes({ de: emDias(8), ate: emDias(12) }, TOKEN);
b.ok(faixa.ok && faixa.itens.length === 1 && faixa.itens[0].numero === "002/" + anoAtual,
  "só a declaração do dia dentro da faixa", "achou " + faixa.total);

/* ══════════ 9. PERMISSÃO ══════════ */
b.fluxo("DECLARAÇÕES · Permissão");

b.passo("34. Usuário sem o módulo Documentos");
b.bloqueia(() => g.declListarDiretoria(TOKEN_ESC), "declListarDiretoria nega quem não tem Documentos");
b.bloqueia(() => g.declSalvarDiretor({ nome: "X", cargo: "Y" }, TOKEN_ESC), "declSalvarDiretor nega");
b.bloqueia(() => g.declEmitirDeclaracaoDiretor({ diretorId: dir.id, dataLiberacao: emDias(2) }, TOKEN_ESC),
  "declEmitirDeclaracaoDiretor nega");
b.bloqueia(() => g.declHistoricoDeclaracoes({}, TOKEN_ESC), "declHistoricoDeclaracoes nega");
b.bloqueia(() => g.declCandidatosDeVerbas(TOKEN_ESC), "declCandidatosDeVerbas nega");

b.passo("35. Token inválido");
b.bloqueia(() => g.declDadosEmissao("token-falso"), "declDadosEmissao nega token inválido");
b.bloqueia(() => g.declPreviaDeclaracaoDiretor({}, "token-falso"), "declPreviaDeclaracaoDiretor nega token inválido");

/* ══════════ 10. TRILHA DE AUDITORIA ══════════ */
b.fluxo("DECLARAÇÕES · Alimenta a trilha de auditoria");

b.passo("36. Cada emissão deixa rastro classificado");
const trilha = g.auditoriaConsultar({ modulo: "Documentos" }, TOKEN).acoes
  .filter(a => a.submodulo === "Declarações");
b.ok(trilha.length >= 3, "uma entrada por declaração emitida", trilha.length + " registro(s)");
b.ok(trilha[0] && trilha[0].acao === "DECLARACAO_DIRETOR_EMITIDA",
  "ação nomeada", trilha[0] && trilha[0].acao);
b.ok(trilha.some(a => a.registroId === "001/" + anoAtual),
  "o número da declaração é o identificador do registro");

/* ══════════ 11. IMPORTAÇÃO DE VERBAS ══════════ */
b.fluxo("DECLARAÇÕES · Importar do cadastro de gratificações");

b.passo("37. Cadastrar um diretor só em VERBAS_DIRETORIA");
const verb = g.verbSalvarDiretor(
  { nome: "Maria da Silva", cpf: "111.222.333-44", cargo: "Diretora Financeira", valor: 1000, diaVencimento: 5 },
  TOKEN);
b.ok(verb && verb.ok, "gravado em Verbas da Diretoria", verb && (verb.id || verb.mensagem));

b.passo("38. Ela aparece como candidata, e quem já existe vem marcado como repetido");
const cand = g.declCandidatosDeVerbas(TOKEN);
const maria = (cand.candidatos || []).filter(c => c.nome.indexOf("MARIA") > -1)[0];
b.ok(cand.ok && maria && !maria.jaCadastrado, "Maria é candidata nova", maria && maria.nome);

b.passo("39. Importar grava no cadastro da Diretoria");
const imp = g.declImportarDeVerbas([{ nome: maria.nome, cpf: maria.cpf, cargo: maria.cargo }], TOKEN);
b.ok(imp && imp.ok && imp.importados === 1, "um diretor importado", imp && imp.mensagem);

b.passo("40. Importar de novo NÃO duplica");
const imp2 = g.declImportarDeVerbas([{ nome: maria.nome, cpf: maria.cpf, cargo: maria.cargo }], TOKEN);
b.ok(imp2 && imp2.ok && imp2.importados === 0 && imp2.pulados === 1,
  "repetido é pulado, não duplicado", imp2 && imp2.mensagem);

b.passo("41. Os dois cadastros seguem separados — importar não mexeu em Verbas");
const verbasDepois = g.verbListarDiretores_interno_().length;
b.ok(verbasDepois === 1, "Verbas da Diretoria continua com um registro", verbasDepois + " registro(s)");

/* ══════════ O QUE SEGUE "NÃO TESTADO" ══════════ */
b.fluxo("DECLARAÇÕES · O que este teste NÃO prova");

b.naoTestavel("O PDF gerado — conteúdo, layout e papel timbrado",
  "depende do conversor de HTML do Apps Script; aqui declGerarPdf_ é dublê. Só emitindo no ar.");
b.naoTestavel("A gravação na pasta do Drive do ambiente certo",
  "SISGEP_PASTA_DECLARACOES ainda precisa ser configurada; rodar declDiagnosticoPasta_() no editor.");
b.naoTestavel("A tela (abas, prévia ao vivo, modais)",
  "o emulador não roda a SPA; a REGRA Nº -2 cobre só a sintaxe do HTML.");

b.resumo();
