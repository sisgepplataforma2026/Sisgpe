/**
 * TESTE — FILA DE PENDÊNCIAS DE ESCOLAS (Fase 2 do item 8 do PROMPT-MESTRE)
 *
 * O QUE ESTE TESTE EXISTE PARA PROVAR
 *
 * A fila de pendências é uma medição. Uma medição que erra é pior que
 * nenhuma: a tela mostra "19 escolas com dado fora do lugar", alguém corrige
 * as 19, e as outras 600 continuam quebradas sem ninguém saber.
 *
 * Três coisas precisam ser verdade, e é sobre elas que este arquivo insiste:
 *
 *  1. SEM DIVERGÊNCIA COM O VALIDADOR (passo 30). A fila e o validador têm
 *     que contar a mesma coisa, porque são a mesma regra. Se um dia alguém
 *     reimplementar a detecção aqui dentro, este passo cai.
 *
 *  2. O RESUMO NÃO MUDA AO FILTRAR (passo 20). Se os cards contassem só o
 *     filtrado, clicar em "Sem e-mail" faria os outros seis cards irem a
 *     zero — e o usuário passaria a acreditar que resolveu o que só escondeu.
 *
 *  3. CPF NÃO É ERRO (passo 12). Existem escolas de pessoa física que pagam
 *     pelo CPF. Elas já foram reportadas uma vez como problema, e não eram.
 *     Nunca mais.
 *
 * Só leitura: nenhuma função deste arquivo escreve na planilha, e o passo 40
 * confirma isso comparando a base antes e depois de listar.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");     // ADMINISTRADOR
const ESC = b.logar(g, "joscimar");      // tem o módulo escolas
const FIN = b.logar(g, "rogerio");       // financeiro,rh — NÃO tem escolas

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* CPF real de teste com dígito verificador válido — precisa passar em
 * validarDigitosCpf_, senão escolaTipoAparente_ o classifica como NUMERO. */
const CPF_VALIDO = "529.982.247-25";

const CABECALHO = [
  "EscolaID", "Escola (Razão Social)", "CNPJ", "E-mail (principal)", "E-mails (todos)",
  "Telefone 1", "Telefone 2", "Cidade", "UF", "CEP",
  "NOME_FANTASIA", "SITUACAO_CADASTRAL", "ULTIMA_VERIFICACAO"
];

function zerarTudo() {
  ["Escolas", g.ESC_ABA_MERGES].forEach(function (nome) {
    const sh = ss.getSheetByName(nome);
    if (sh) ss.deleteSheet(sh);
  });
  const sh = ss.insertSheet("Escolas");
  sh.getRange(1, 1, 1, CABECALHO.length).setValues([CABECALHO]);
  try { g.CacheService.getScriptCache().remove("sisgep_escolas_lista_v2"); } catch (e) {}
  try { g.CacheService.getScriptCache().remove(g.CACHE_KEY_ESCOLAS_CADASTRO_); } catch (e) {}
  return sh;
}

/** Escola COMPLETA — o ponto de partida sem nenhuma pendência. */
function linhaBoa(id, nome, extras) {
  const l = new Array(CABECALHO.length).fill("");
  const set = (c, v) => { l[CABECALHO.indexOf(c)] = v; };
  set("EscolaID", id);
  set("Escola (Razão Social)", nome);
  set("CNPJ", "11.222.333/0001-81");
  set("E-mail (principal)", "contato@" + String(id).toLowerCase() + ".com");
  set("Telefone 1", "(27) 3256-6107");
  set("Cidade", "Alegre");
  set("UF", "ES");
  set("SITUACAO_CADASTRAL", "ATIVA");
  Object.keys(extras || {}).forEach(function (k) {
    const i = CABECALHO.indexOf(k);
    if (i > -1) l[i] = extras[k];
  });
  return l;
}

function tiposDe(escola) {
  return escola.pendencias.map(function (p) { return p.tipo; }).sort();
}
function acharPorId(r, id) {
  return r.escolas.filter(function (e) { return e.escolaId === id; })[0] || null;
}

/* ══════════════════════════════════════════════════════════════════════
   1. BASE LIMPA — a fila só acusa o que está torto
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Base sem pendência nenhuma");

const sh1 = zerarTudo();
sh1.appendRow(linhaBoa("ESC-000001", "Escola Completa Um"));
sh1.appendRow(linhaBoa("ESC-000002", "Escola Completa Dois"));

b.passo("1. Duas escolas completas não geram fila");
const r1 = g.escolasPendenciasListar({}, ADM);
b.ok(r1.ok === true && r1.total === 0 && r1.escolas.length === 0,
  "escola completa não vira pendência", "total=" + r1.total);

b.passo("2. E o total da base é reportado mesmo com a fila vazia");
b.ok(r1.totalNaBase === 2 && r1.totalEscolasComPendencia === 0,
  "a tela sabe dizer '0 de 2', não só '0'",
  "base=" + r1.totalNaBase + " comPendencia=" + r1.totalEscolasComPendencia);

b.passo("3. Todo tipo do catálogo aparece no resumo, mesmo zerado");
const chavesCatalogo = g.ESC_PENDENCIAS.map(function (p) { return p.chave; }).sort();
const chavesResumo = Object.keys(r1.resumo).sort();
b.igual(chavesResumo, chavesCatalogo,
  "card com zero continua na tela — some seria pior que mostrar 0");

b.passo("4. Base vazia não explode");
const shVazia = zerarTudo();
const rVazia = g.escolasPendenciasListar({}, ADM);
b.ok(rVazia.ok === true && rVazia.total === 0 && rVazia.totalNaBase === 0,
  "aba só com cabeçalho devolve fila vazia, não erro", JSON.stringify(rVazia.mensagem || ""));

/* ══════════════════════════════════════════════════════════════════════
   2. AS FALTAS — cada campo vazio vira uma pendência nomeada
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Campo vazio");

const sh2 = zerarTudo();
sh2.appendRow(linhaBoa("ESC-000010", "Sem E-mail",   { "E-mail (principal)": "" }));
sh2.appendRow(linhaBoa("ESC-000011", "Sem Telefone", { "Telefone 1": "", "Telefone 2": "" }));
sh2.appendRow(linhaBoa("ESC-000012", "Sem Situação", { "SITUACAO_CADASTRAL": "" }));
sh2.appendRow(linhaBoa("ESC-000013", "Sem UF",       { "UF": "" }));
sh2.appendRow(linhaBoa("ESC-000014", "Sem Documento",{ "CNPJ": "" }));
sh2.appendRow(linhaBoa("ESC-000015", "",             {}));                    // sem razão social
sh2.appendRow(linhaBoa("ESC-000016", "Só Telefone 2",{ "Telefone 1": "", "Telefone 2": "(27) 99999-0000" }));
sh2.appendRow(linhaBoa("ESC-000017", "Completa"));

const r2 = g.escolasPendenciasListar({}, ADM);

b.passo("5. Sem e-mail é acusado");
b.igual(tiposDe(acharPorId(r2, "ESC-000010")), ["SEM_EMAIL"], "SEM_EMAIL isolado");

b.passo("6. Sem nenhum dos dois telefones é acusado");
b.igual(tiposDe(acharPorId(r2, "ESC-000011")), ["SEM_TELEFONE"], "SEM_TELEFONE isolado");

b.passo("7. Telefone 2 preenchido JÁ resolve — não se cobra duas vezes o mesmo contato");
b.ok(acharPorId(r2, "ESC-000016") === null,
  "escola com só o Telefone 2 não entra na fila");

b.passo("8. Sem situação é acusado");
b.igual(tiposDe(acharPorId(r2, "ESC-000012")), ["SEM_SITUACAO"], "SEM_SITUACAO isolado");

b.passo("9. Sem UF é acusado");
b.igual(tiposDe(acharPorId(r2, "ESC-000013")), ["SEM_UF"], "SEM_UF isolado");

b.passo("10. Sem CNPJ nem CPF é acusado");
b.igual(tiposDe(acharPorId(r2, "ESC-000014")), ["SEM_DOCUMENTO"], "SEM_DOCUMENTO isolado");

b.passo("11. Escola sem razão social APARECE na fila");
/* Este é o único jeito de ela ser vista: listarEscolasCadastro_interno_ filtra
 * linha sem nome, então na tela de cadastro ela não existe. Se a fila também
 * a escondesse, o cadastro ficaria invisível para sempre. */
const semNome = acharPorId(r2, "ESC-000015");
b.ok(semNome !== null && tiposDe(semNome).indexOf("SEM_NOME") > -1,
  "cadastro sem nome não some da fila — é onde ele é resgatado",
  semNome ? JSON.stringify(tiposDe(semNome)) : "não veio");

b.passo("12. A escola completa continua fora da fila");
b.ok(acharPorId(r2, "ESC-000017") === null && r2.totalEscolasComPendencia === 6,
  "6 com pendência de 8 na base", "comPendencia=" + r2.totalEscolasComPendencia);

/* ══════════════════════════════════════════════════════════════════════
   3. CPF NÃO É ERRO — a regressão que já aconteceu uma vez
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Escola de pessoa física");

const sh3 = zerarTudo();
sh3.appendRow(linhaBoa("ESC-000020", "Escola da Dona Maria", { "CNPJ": CPF_VALIDO }));

const r3 = g.escolasPendenciasListar({}, ADM);

b.passo("13. CPF na coluna CNPJ NÃO é dado fora do lugar");
/* "Tem alguns colaboradores que pagam pelo CPF e não CNPJ" — o usuário, em
 * 11/08/2026, depois de eu ter reportado essas escolas como problema. A
 * coluna se chama CNPJ mas guarda o DOCUMENTO. */
b.ok(r3.total === 0 && r3.resumo.DADO_FORA_DO_LUGAR === 0,
  "escola de pessoa física é cadastro válido, não pendência",
  "total=" + r3.total + " fora_do_lugar=" + r3.resumo.DADO_FORA_DO_LUGAR);

b.passo("14. E o CPF sai MASCARADO quando a escola cai na fila por outro motivo");
const sh3b = zerarTudo();
sh3b.appendRow(linhaBoa("ESC-000021", "Dona Maria Sem E-mail",
  { "CNPJ": CPF_VALIDO, "E-mail (principal)": "" }));
const r3b = g.escolasPendenciasListar({}, ADM);
const pf = acharPorId(r3b, "ESC-000021");
b.ok(pf !== null && pf.documento.indexOf("***") > -1 &&
     pf.documento.indexOf("982") === -1 && pf.documento.indexOf("247") === -1,
  "LGPD: o CPF do miolo não trafega para a tela de fila",
  pf ? pf.documento : "não veio");

/* ══════════════════════════════════════════════════════════════════════
   4. DADO FORA DO LUGAR — a pendência que veio do saneamento
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Dado fora do lugar");

const sh4 = zerarTudo();
sh4.appendRow(linhaBoa("ESC-000030", "Telefone no nome",
  { "Escola (Razão Social)": "(27) 3256-6107" }));
sh4.appendRow(linhaBoa("ESC-000031", "E-mail na UF", { "UF": "escola@x.com" }));
sh4.appendRow(linhaBoa("ESC-000032", "Data na situação",
  { "SITUACAO_CADASTRAL": new Date(2026, 3, 2) }));
sh4.appendRow(linhaBoa("ESC-000033", "Tudo no lugar"));

const r4 = g.escolasPendenciasListar({}, ADM);

b.passo("15. Telefone gravado na razão social é acusado");
const t15 = acharPorId(r4, "ESC-000030");
/* Sem nome de verdade, a linha também acusa SEM_NOME? Não: o campo tem
 * conteúdo — só é conteúdo do tipo errado. Vazio e torto são coisas
 * diferentes, e a fila precisa distinguir para o usuário saber o que fazer. */
b.ok(t15 !== null && tiposDe(t15).join(",") === "DADO_FORA_DO_LUGAR",
  "campo preenchido com o tipo errado não conta como campo vazio",
  t15 ? JSON.stringify(tiposDe(t15)) : "não veio");

b.passo("16. E a fila diz QUAL campo e o que ele parece ser");
const campos15 = t15 ? t15.pendencias[0].campos : [];
b.ok(campos15.length === 1 && campos15[0].campo === "Escola (Razão Social)" &&
     campos15[0].pareceSer === "TELEFONE" && campos15[0].esperado === "TEXTO_NOME",
  "quem for corrigir sabe onde mexer sem abrir a planilha",
  JSON.stringify(campos15));

b.passo("17. E-mail gravado na UF é acusado");
const t17 = acharPorId(r4, "ESC-000031");
b.ok(t17 !== null && t17.pendencias[0].campos[0].pareceSer === "EMAIL" &&
     t17.pendencias[0].campos[0].campo === "UF",
  "UF com e-mail dentro", t17 ? JSON.stringify(t17.pendencias[0].campos) : "não veio");

b.passo("18. Data gravada na situação cadastral é acusada");
/* Era o sintoma visível na tela de ofícios: STATUS mostrando 02/04/2026. */
const t18 = acharPorId(r4, "ESC-000032");
b.ok(t18 !== null && t18.pendencias[0].campos[0].pareceSer === "DATA" &&
     t18.pendencias[0].campos[0].campo === "SITUACAO_CADASTRAL",
  "o caso que apareceu na tela de ofício como STATUS 02/04/2026",
  t18 ? JSON.stringify(t18.pendencias[0].campos) : "não veio");

b.passo("19. A linha coerente fica de fora");
b.ok(acharPorId(r4, "ESC-000033") === null && r4.resumo.DADO_FORA_DO_LUGAR === 3,
  "3 tortas de 4", "fora_do_lugar=" + r4.resumo.DADO_FORA_DO_LUGAR);

/* ══════════════════════════════════════════════════════════════════════
   5. O FILTRO — e a regra de que o resumo não obedece a ele
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Filtro por tipo");

const sh5 = zerarTudo();
sh5.appendRow(linhaBoa("ESC-000040", "A", { "E-mail (principal)": "" }));
sh5.appendRow(linhaBoa("ESC-000041", "B", { "E-mail (principal)": "" }));
sh5.appendRow(linhaBoa("ESC-000042", "C", { "Telefone 1": "", "Telefone 2": "" }));
sh5.appendRow(linhaBoa("ESC-000043", "D", { "UF": "" }));
sh5.appendRow(linhaBoa("ESC-000044", "E"));

const semFiltro = g.escolasPendenciasListar({}, ADM);
const soEmail   = g.escolasPendenciasListar({ tipo: "SEM_EMAIL" }, ADM);

b.passo("20. O RESUMO É O MESMO com filtro e sem filtro");
/* O ponto de projeto inteiro deste arquivo. Se este passo cair, os cards
 * viram espelho da lista e param de informar quantas pendências existem. */
b.igual(soEmail.resumo, semFiltro.resumo,
  "clicar num card não muda o número dos outros seis");

b.passo("21. Mas a LISTA obedece ao filtro");
b.ok(soEmail.total === 2 && semFiltro.total === 4 &&
     soEmail.escolas.every(function (e) { return tiposDe(e).indexOf("SEM_EMAIL") > -1; }),
  "filtro recorta a lista", "filtrado=" + soEmail.total + " total=" + semFiltro.total);

b.passo("22. E o contador de escolas com pendência também ignora o filtro");
b.ok(soEmail.totalEscolasComPendencia === 4 && soEmail.totalNaBase === 5,
  "'2 de 4 escolas com pendência (5 na base)' — a tela consegue montar essa frase",
  "comPendencia=" + soEmail.totalEscolasComPendencia + " base=" + soEmail.totalNaBase);

b.passo("23. Filtro por tipo inexistente devolve lista vazia, não a base inteira");
const filtroBobo = g.escolasPendenciasListar({ tipo: "NAO_EXISTE" }, ADM);
b.ok(filtroBobo.ok === true && filtroBobo.total === 0 &&
     filtroBobo.totalEscolasComPendencia === 4,
  "filtro desconhecido não vira 'sem filtro'", "total=" + filtroBobo.total);

b.passo("24. O filtro é insensível a caixa — a tela manda a chave como vier");
const caixaBaixa = g.escolasPendenciasListar({ tipo: "sem_email" }, ADM);
b.ok(caixaBaixa.total === 2, "sem_email == SEM_EMAIL", "total=" + caixaBaixa.total);

/* ══════════════════════════════════════════════════════════════════════
   6. ORDEM — o mais grave primeiro, senão a fila não é fila
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Ordem de atendimento");

const sh6 = zerarTudo();
sh6.appendRow(linhaBoa("ESC-000050", "Só sem UF", { "UF": "" }));                    // gravidade 3
sh6.appendRow(linhaBoa("ESC-000051", "Só sem telefone", { "Telefone 1": "", "Telefone 2": "" })); // 2
sh6.appendRow(linhaBoa("ESC-000052", "Sem e-mail", { "E-mail (principal)": "" }));   // 1
sh6.appendRow(linhaBoa("ESC-000053", "Sem e-mail e sem documento",
  { "E-mail (principal)": "", "CNPJ": "" }));                                        // 1, duas pendências

const r6 = g.escolasPendenciasListar({}, ADM);
const ordem = r6.escolas.map(function (e) { return e.escolaId; });

b.passo("25. Gravidade 1 vem antes de 2, que vem antes de 3");
b.igual(ordem, ["ESC-000053", "ESC-000052", "ESC-000051", "ESC-000050"],
  "quem trava mais aparece no topo");

b.passo("26. Dentro da mesma gravidade, quem tem MAIS pendências vem primeiro");
b.ok(r6.escolas[0].escolaId === "ESC-000053" && r6.escolas[0].pendencias.length === 2 &&
     r6.escolas[0].gravidade === 1,
  "duas pendências graves passam na frente de uma", JSON.stringify(ordem));

b.passo("27. A gravidade da escola é a da PIOR pendência dela, não a média");
const soUf = acharPorId(r6, "ESC-000050");
b.ok(soUf.gravidade === 3 && r6.escolas[0].gravidade === 1,
  "Math.min sobre as pendências da linha",
  "soUF=" + soUf.gravidade + " pior=" + r6.escolas[0].gravidade);

/* ══════════════════════════════════════════════════════════════════════
   7. SEM DIVERGÊNCIA COM O VALIDADOR — a regra é uma só
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · A fila e o validador contam a mesma coisa");

const sh7 = zerarTudo();
/* Uma base propositalmente feia, com todos os padrões que apareceram na base
 * real de 679 escolas em 11/08/2026. */
sh7.appendRow(linhaBoa("ESC-000060", "Ok"));
sh7.appendRow(linhaBoa("ESC-000061", "Tel no nome", { "Escola (Razão Social)": "(27) 3256-6107" }));
sh7.appendRow(linhaBoa("ESC-000062", "Data na situação", { "SITUACAO_CADASTRAL": new Date(2026, 3, 2) }));
sh7.appendRow(linhaBoa("ESC-000063", "E-mail no fantasia", { "NOME_FANTASIA": "x@y.com" }));
sh7.appendRow(linhaBoa("ESC-000064", "CEP na UF", { "UF": "29500-000" }));
sh7.appendRow(linhaBoa("ESC-000065", "Duas tortas ao mesmo tempo",
  { "UF": "z@w.com", "SITUACAO_CADASTRAL": new Date(2026, 3, 2) }));
sh7.appendRow(linhaBoa("ESC-000066", "CPF é válido", { "CNPJ": CPF_VALIDO }));
sh7.appendRow(linhaBoa("ESC-000067", "Só falta e-mail", { "E-mail (principal)": "" }));

const validador = g.escolaValidarColunas(ADM);
const fila = g.escolasPendenciasListar({ tipo: "DADO_FORA_DO_LUGAR" }, ADM);

b.passo("28. O validador e a fila acham o MESMO número de linhas tortas");
b.ok(validador.linhasComProblema === fila.total,
  "duas medições da mesma regra, não duas regras parecidas",
  "validador=" + validador.linhasComProblema + " fila=" + fila.total);

b.passo("29. E o resumo da fila bate com esse mesmo número");
b.ok(fila.resumo.DADO_FORA_DO_LUGAR === validador.linhasComProblema,
  "o card de 'dado fora do lugar' não inventa contagem própria",
  "card=" + fila.resumo.DADO_FORA_DO_LUGAR);

b.passo("30. A linha com DUAS colunas tortas conta como UMA escola, com dois campos");
const dupla = acharPorId(fila, "ESC-000065");
b.ok(dupla !== null && dupla.pendencias.length === 1 && dupla.pendencias[0].campos.length === 2,
  "a fila é de escolas, não de células — senão a mesma escola aparece duas vezes",
  dupla ? JSON.stringify(dupla.pendencias[0].campos.map(c => c.campo)) : "não veio");

b.passo("31. E a escola coerente não aparece em nenhuma das duas medições");
b.ok(acharPorId(fila, "ESC-000060") === null && acharPorId(fila, "ESC-000066") === null,
  "nem a completa nem a de CPF entram");

/* ══════════════════════════════════════════════════════════════════════
   8. O RESUMO SOZINHO — o que os cards do dashboard consomem
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Resumo para o dashboard");

const res = g.escolasPendenciasResumo(ADM);
const listaCheia = g.escolasPendenciasListar({}, ADM);

b.passo("32. O resumo devolve os mesmos números da listagem");
b.igual(res.resumo, listaCheia.resumo, "card e lista nascem da mesma varredura");

b.passo("33. E não devolve a lista — o dashboard não precisa carregar 679 linhas");
b.ok(res.escolas === undefined && res.totalEscolasComPendencia === listaCheia.totalEscolasComPendencia,
  "resumo é resumo", "comPendencia=" + res.totalEscolasComPendencia);

b.passo("34. O catálogo vai junto, com rótulo e impacto de cada tipo");
b.ok(Array.isArray(res.catalogo) && res.catalogo.length === g.ESC_PENDENCIAS.length &&
     res.catalogo.every(function (c) { return c.rotulo && c.impacto && c.gravidade; }),
  "a tela não precisa reescrever os textos que já estão no backend",
  res.catalogo.length + " tipos");

/* ══════════════════════════════════════════════════════════════════════
   9. TETO DE LINHAS — a fila não pode derrubar a tela
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Base grande");

const sh9 = zerarTudo();
const muitas = [];
for (let i = 0; i < 420; i++) {
  muitas.push(linhaBoa("ESC-1" + String(i).padStart(5, "0"), "Escola " + i,
    { "E-mail (principal)": "" }));
}
sh9.getRange(2, 1, muitas.length, CABECALHO.length).setValues(muitas);

const r9 = g.escolasPendenciasListar({}, ADM);

b.passo("35. A página é limitada, mas a CONTAGEM não é");
b.ok(r9.escolas.length === 50 && r9.total === 420 && r9.totalEscolasComPendencia === 420,
  "50 na página, 420 na verdade — e a tela sabe da diferença",
  "pagina=" + r9.escolas.length + " total=" + r9.total);

b.passo("36. O resumo continua contando as 420");
b.ok(r9.resumo.SEM_EMAIL === 420, "o corte é de exibição, não de medição",
  "SEM_EMAIL=" + r9.resumo.SEM_EMAIL);

/* ══════════════════════════════════════════════════════════════════════
   9b. PAGINAÇÃO
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Paginação");

b.passo("36a. O total de páginas é o esperado");
b.ok(r9.totalPaginas === 9 && r9.pagina === 1 && r9.porPagina === 50,
  "420 em páginas de 50 dá 9 páginas", "paginas=" + r9.totalPaginas);

b.passo("36b. A última página traz o resto, não 50");
const ultima = g.escolasPendenciasListar({ pagina: 9 }, ADM);
b.ok(ultima.escolas.length === 20 && ultima.pagina === 9,
  "420 = 8 páginas cheias + 20", "ultima=" + ultima.escolas.length);

b.passo("36c. Páginas diferentes trazem escolas diferentes");
const pag1 = g.escolasPendenciasListar({ pagina: 1 }, ADM);
const pag2 = g.escolasPendenciasListar({ pagina: 2 }, ADM);
const ids1 = pag1.escolas.map(function (e) { return e.escolaId; });
const ids2 = pag2.escolas.map(function (e) { return e.escolaId; });
b.ok(ids1.length === 50 && ids2.length === 50 &&
     ids2.every(function (id) { return ids1.indexOf(id) === -1; }),
  "nenhuma escola aparece nas duas — sem repetir nem pular");

b.passo("36d. Somando todas as páginas, ninguém fica de fora");
/* O jeito de uma paginação errar sem ninguém ver é perder a última escola de
 * cada página. Só a soma prova. */
const vistos = {};
for (let p = 1; p <= r9.totalPaginas; p++) {
  g.escolasPendenciasListar({ pagina: p }, ADM).escolas.forEach(function (e) {
    vistos[e.escolaId] = (vistos[e.escolaId] || 0) + 1;
  });
}
const chaves = Object.keys(vistos);
b.ok(chaves.length === 420 && chaves.every(function (k) { return vistos[k] === 1; }),
  "as 420 aparecem, cada uma exatamente uma vez",
  "distintas=" + chaves.length);

b.passo("36e. Página além do fim volta para a última, não para o vazio");
/* Acontece o tempo todo: a pessoa está na página 9 e filtra por um tipo que
 * só tem 12 escolas. Devolver lista vazia faria parecer que o filtro não
 * achou nada. */
const alem = g.escolasPendenciasListar({ pagina: 99 }, ADM);
b.ok(alem.pagina === 9 && alem.escolas.length === 20,
  "corrige a página em vez de mostrar tela em branco",
  "pagina=" + alem.pagina + " itens=" + alem.escolas.length);

b.passo("36f. Página zero ou negativa vira 1");
const zero = g.escolasPendenciasListar({ pagina: 0 }, ADM);
const neg  = g.escolasPendenciasListar({ pagina: -5 }, ADM);
b.ok(zero.pagina === 1 && neg.pagina === 1, "entrada boba não quebra a lista");

b.passo("36g. porPagina é respeitado, mas com teto");
const p20  = g.escolasPendenciasListar({ porPagina: 20 }, ADM);
const p999 = g.escolasPendenciasListar({ porPagina: 999 }, ADM);
b.ok(p20.escolas.length === 20 && p20.totalPaginas === 21 &&
     p999.porPagina === 200 && p999.escolas.length === 200,
  "20 obedece; 999 vira 200 para não estourar o retorno",
  "p20=" + p20.escolas.length + " p999=" + p999.porPagina);

/* ══════════════════════════════════════════════════════════════════════
   9c. BUSCA
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Busca por nome, documento e e-mail");

const shB = zerarTudo();
shB.appendRow(linhaBoa("ESC-000090", "Pré-escola Anjo Azul",
  { "CNPJ": "00.652.298/0001-14", "E-mail (principal)": "", "Telefone 1": "", "Telefone 2": "" }));
shB.appendRow(linhaBoa("ESC-000091", "Centro Brilho de Sol",
  { "CNPJ": "06.272.153/0002-55", "E-mail (principal)": "contato@brilho.com.br", "UF": "" }));
shB.appendRow(linhaBoa("ESC-000092", "Colégio São João",
  { "CNPJ": "11.222.333/0001-81", "E-mail (principal)": "diretoria@saojoao.com", "SITUACAO_CADASTRAL": "" }));
shB.appendRow(linhaBoa("ESC-000093", "Escola da Dona Maria",
  { "CNPJ": CPF_VALIDO, "E-mail (principal)": "maria@pessoal.com", "Telefone 1": "", "Telefone 2": "" }));

b.passo("37a. Busca por parte do nome");
const bNome = g.escolasPendenciasListar({ busca: "anjo" }, ADM);
b.ok(bNome.total === 1 && bNome.escolas[0].escolaId === "ESC-000090",
  "'anjo' acha a Anjo Azul", "total=" + bNome.total);

b.passo("37b. Busca ignora acento — 'sao joao' acha 'São João'");
const bAcento = g.escolasPendenciasListar({ busca: "sao joao" }, ADM);
b.ok(bAcento.total === 1 && bAcento.escolas[0].escolaId === "ESC-000092",
  "quem digita sem acento também encontra", "total=" + bAcento.total);

b.passo("37c. E ignora maiúscula");
b.ok(g.escolasPendenciasListar({ busca: "BRILHO" }, ADM).total === 1,
  "'BRILHO' acha 'Brilho de Sol'");

b.passo("37d. Busca por e-mail — que a tela sozinha não conseguiria fazer");
/* Este é o passo que justifica a busca ser no servidor. Antes desta mudança
 * a listagem não devolvia e-mail nenhum: filtrar no navegador era impossível. */
const bEmail = g.escolasPendenciasListar({ busca: "saojoao.com" }, ADM);
b.ok(bEmail.total === 1 && bEmail.escolas[0].escolaId === "ESC-000092",
  "acha pelo e-mail", "total=" + bEmail.total);

b.passo("37e. Busca pelo CNPJ INTEIRO, mesmo o documento saindo mascarado");
/* O outro motivo de a busca ser no servidor. Na tela o documento aparece
 * mascarado, com o miolo trocado por asteriscos; procurar ali pelos dígitos
 * do meio nunca acharia nada. */
const bCnpj = g.escolasPendenciasListar({ busca: "00.652.298/0001-14" }, ADM);
b.ok(bCnpj.total === 1 && bCnpj.escolas[0].escolaId === "ESC-000090",
  "acha pelo CNPJ com pontuação",
  bCnpj.total === 1 ? bCnpj.escolas[0].documento : "total=" + bCnpj.total);

b.passo("37e2. CNPJ sai inteiro; CPF sai mascarado — a diferença é de propósito");
/* CNPJ é dado público de empresa; CPF é dado pessoal. Mascarar os dois
 * atrapalharia a conferência sem proteger ninguém a mais. Quem confirmou a
 * regra foi escolaDocMascarado_, que só mascara CPF. */
const pfBusca = g.escolasPendenciasListar({ busca: "Dona Maria" }, ADM);
b.ok(bCnpj.escolas[0].documento.indexOf("***") === -1 &&
     pfBusca.total === 1 && pfBusca.escolas[0].documento.indexOf("***") > -1,
  "empresa aberta, pessoa física protegida",
  "cnpj=" + bCnpj.escolas[0].documento + " cpf=" + (pfBusca.escolas[0]||{}).documento);

b.passo("37f. Só os dígitos do meio também acham");
b.ok(g.escolasPendenciasListar({ busca: "652298" }, ADM).total === 1,
  "não precisa digitar pontuação");

b.passo("37g. Busca por EscolaID");
b.ok(g.escolasPendenciasListar({ busca: "ESC-000091" }, ADM).total === 1,
  "o id da tela serve de busca");

b.passo("37h. Um ou dois dígitos NÃO viram busca por documento");
/* "1" está dentro de quase todo CNPJ da base. Se dois dígitos filtrassem,
 * a busca traria tudo e pareceria quebrada. */
const bCurta = g.escolasPendenciasListar({ busca: "00" }, ADM);
b.ok(bCurta.total === 0, "busca curta demais por número não traz a base inteira",
  "total=" + bCurta.total);

b.passo("37i. Busca sem resultado devolve zero, não a lista toda");
b.ok(g.escolasPendenciasListar({ busca: "zzzznaoexiste" }, ADM).total === 0,
  "nada encontrado é nada, não tudo");

b.passo("37j. O RESUMO não muda com a busca — mesma regra dos cards");
const semBusca = g.escolasPendenciasListar({}, ADM);
b.igual(bNome.resumo, semBusca.resumo,
  "buscar não pode zerar os cards, igual filtrar não pode");

b.passo("37k. E o contador de escolas com pendência também não");
b.ok(bNome.totalEscolasComPendencia === 4 && bNome.total === 1,
  "'1 de 4' — a tela consegue dizer que está buscando dentro de 4",
  "comPendencia=" + bNome.totalEscolasComPendencia);

b.passo("37l. Busca e filtro por tipo funcionam juntos");
/* "escola" casa com a Anjo Azul ("Pré-escola") e com a Dona Maria
 * ("Escola da"), e as duas estão sem telefone — logo 2, não 1. Já com
 * "brilho", que não está sem telefone, a interseção tem que dar zero: é ela
 * que prova que os dois filtros se somam em vez de um anular o outro. */
const eJunto = g.escolasPendenciasListar({ busca: "escola", tipo: "SEM_TELEFONE" }, ADM);
const eVazio = g.escolasPendenciasListar({ busca: "brilho", tipo: "SEM_TELEFONE" }, ADM);
b.ok(eJunto.total === 2 && eVazio.total === 0 &&
     g.escolasPendenciasListar({ busca: "brilho" }, ADM).total === 1,
  "os dois filtros se somam — 'brilho' existe, mas não sem telefone",
  "escola+semTel=" + eJunto.total + " brilho+semTel=" + eVazio.total);

b.passo("37m. O e-mail volta na listagem, para a tela poder mostrar o que casou");
b.ok(bEmail.escolas[0].email === "diretoria@saojoao.com",
  "quem buscou por e-mail vê o e-mail", bEmail.escolas[0].email);

/* ══════════════════════════════════════════════════════════════════════
   10. PERMISSÃO
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Quem pode ver");

const shP = zerarTudo();
shP.appendRow(linhaBoa("ESC-000070", "Alguma", { "E-mail (principal)": "" }));

b.passo("37. Sem token, ninguém lista");
b.bloqueia(function () { return g.escolasPendenciasListar({}, ""); },
  "escolasPendenciasListar exige sessão");

b.passo("38. Token inválido não passa");
b.bloqueia(function () { return g.escolasPendenciasListar({}, "token-inventado"); },
  "token forjado é recusado");

b.passo("39. Usuário sem o módulo escolas não vê a fila");
b.bloqueia(function () { return g.escolasPendenciasListar({}, FIN); },
  "rogerio (financeiro,rh) não entra em pendências de escolas");

b.passo("40. O resumo tem a mesma trava");
b.bloqueia(function () { return g.escolasPendenciasResumo(FIN); },
  "escolasPendenciasResumo exige o módulo também");

b.passo("41. Quem tem o módulo escolas vê");
const rEsc = g.escolasPendenciasListar({}, ESC);
b.ok(rEsc.ok === true && rEsc.total === 1,
  "joscimar (escolas,sindicalizacao) lista normalmente", "total=" + rEsc.total);

b.passo("42. E o RESUMO também abre para quem só tem o módulo — sem exigir admin");
/* Os cards do dashboard são leitura de todo dia da secretaria. Se o resumo
 * exigisse perfil de administrador só porque a mesma função é alcançável
 * pelo editor, a tela nasceria trancada para quem mais precisa dela. */
const resEsc = g.escolasPendenciasResumo(ESC);
b.ok(resEsc.ok === true && resEsc.totalEscolasComPendencia === 1,
  "joscimar vê os cards", "comPendencia=" + (resEsc.totalEscolasComPendencia));

/* ══════════════════════════════════════════════════════════════════════
   10b. A PORTA DO EDITOR — sem token, pela conta Google
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Rodar pelo editor do Apps Script");

/* O botão Run do editor chama a função SEM ARGUMENTO. Enquanto a tela do
 * submódulo não existe, é o único jeito de medir a base real — e por isso
 * precisa funcionar E precisa recusar quem não deve entrar. */

b.passo("43. O dono do projeto roda sem token");
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
const rDono = g.escolasPendenciasResumo();
b.ok(rDono.ok === true && rDono.totalEscolasComPendencia === 1,
  "é a porta que o editor usa", JSON.stringify(rDono.resumo));

b.passo("44. Administrador cadastrado na aba USUARIOS também roda sem token");
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";
const rAdm = g.escolasPendenciasResumo();
b.ok(rAdm.ok === true, "admin ATIVO pelo e-mail da conta Google");

b.passo("45. Conta Google QUALQUER é recusada — não basta estar logado no Google");
g.__usuarioAtivoEmail = "estranho@gmail.com";
b.bloqueia(function () { return g.escolasPendenciasResumo(); },
  "quem não é dono nem admin não passa pela porta do editor");

b.passo("46. Usuário comum do SISGEP não vira admin pela porta do editor");
/* joscimar tem o módulo escolas e passa COM token (passo 42). Sem token,
 * pela conta Google, ele não é dono nem ADMINISTRADOR — tem que ser
 * recusado. Se passasse, a porta do editor viraria escalada de privilégio. */
g.__usuarioAtivoEmail = "joscimar@sindeducacao.com";
b.bloqueia(function () { return g.escolasPendenciasResumo(); },
  "a porta do editor não promove usuário comum a administrador");

b.passo("47. Visitante anônimo (getActiveUser vazio) é recusado");
/* NOTA DE MUTAÇÃO, para quem vier depois: remover a checagem de e-mail vazio
 * NÃO derruba este passo, e isso está certo. Com o e-mail em branco, a conta
 * não bate com a do dono e não é achada na aba USUARIOS — a recusa acontece
 * de novo, uma linha abaixo. São duas travas independentes para o mesmo caso.
 * O que muda sem a primeira é só a mensagem: em vez de "Sessão inválida", o
 * visitante leria um texto sobre perfil de administrador que não o ajuda em
 * nada. Manter as duas é clareza, não redundância inútil. */
g.__usuarioAtivoEmail = "";
b.bloqueia(function () { return g.escolasPendenciasResumo(); },
  "app publicado 'qualquer pessoa' não vaza a medição");

b.passo("48. A LISTAGEM não tem porta pelo editor — só token");
/* Assimetria de propósito: o resumo devolve só contagem; a listagem devolve
 * nome, cidade e documento de cada escola. Dado de escola se abre com login. */
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
b.bloqueia(function () { return g.escolasPendenciasListar({}); },
  "nem o dono do projeto lista escolas sem sessão");

b.passo("49. Rodando pelo editor, os números aparecem no LOG");
/* Devolver o valor não basta: no editor ninguém está do outro lado para
 * receber o retorno, e a execução termina com "Execução concluída" e mais
 * nada na tela. Aconteceu duas vezes nesta migração — em escolaMigrarIds e
 * na prévia do saneamento. O log é a única saída visível. */
g.Logger.clear();
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
g.escolasPendenciasResumo();
const log49 = g.Logger.getLog();
b.ok(/PEND[ÊE]NCIAS DO CADASTRO/.test(log49) &&
     /1 de 1 escolas/.test(log49) &&
     /Sem e-mail/.test(log49),
  "quem rodar pelo editor lê o resultado sem abrir o depurador",
  log49.split("\n").filter(function (l) { return /Sem e-mail/.test(l); })[0] || "(sem linha)");

b.passo("50. E a recusa também vai para o log — silêncio não explica nada");
g.Logger.clear();
g.__usuarioAtivoEmail = "estranho@gmail.com";
try { g.escolasPendenciasResumo(); } catch (e) {}
b.ok(/RECUSADO/.test(g.Logger.getLog()),
  "negativa registrada, com a conta que tentou",
  g.Logger.getLog().slice(0, 90));

/* ── NÃO CONSEGUIR VERIFICAR É RECUSAR ──
 *
 * Estes dois passos existem porque uma mutação sobreviveu: trocar o
 * `return false` do catch de escolaEhAdministradorPorEmail_ por `return true`
 * não derrubava nenhum teste. Ou seja, a propriedade mais importante daquela
 * função — falhar fechado — não estava sendo verificada por ninguém. Erro de
 * leitura virando permissão é como se abre uma base de 8.000 pessoas. */

b.passo("51. Aba USUARIOS ausente NÃO libera ninguém");
const abaUsuarios = ss.getSheetByName(g.ABA_USUARIOS_LOGIN);
const guardaUsuarios = abaUsuarios
  ? abaUsuarios.getRange(1, 1, abaUsuarios.getLastRow(), abaUsuarios.getLastColumn()).getValues()
  : null;
if (abaUsuarios) ss.deleteSheet(abaUsuarios);
g.__usuarioAtivoEmail = "wanderson@sindeducacao.com";   // era admin antes de a aba sumir
b.bloqueia(function () { return g.escolasPendenciasResumo(); },
  "sem a aba para conferir o perfil, a resposta é não");

b.passo("52. Falha ao LER a planilha também recusa — não vira permissão");
const openIdOriginal = g.SpreadsheetApp.openById;
g.SpreadsheetApp.openById = function () { throw new Error("Serviço indisponível (simulado)"); };
let recusouNaFalha;
try {
  g.escolasPendenciasResumo();
  recusouNaFalha = false;
} catch (e) {
  recusouNaFalha = /administrador|permiss|sess[ãa]o/i.test(String(e.message));
}
g.SpreadsheetApp.openById = openIdOriginal;
b.ok(recusouNaFalha === true,
  "planilha fora do ar não promove ninguém a administrador",
  recusouNaFalha === false ? "PASSOU DIRETO — fail-open" : "recusado");

// devolve a aba de usuários para os passos seguintes
if (guardaUsuarios) {
  const nova = ss.insertSheet(g.ABA_USUARIOS_LOGIN);
  nova.getRange(1, 1, guardaUsuarios.length, guardaUsuarios[0].length).setValues(guardaUsuarios);
}
g.__usuarioAtivoEmail = "";

/* ══════════════════════════════════════════════════════════════════════
   11. SÓ LEITURA — a fila mede, não corrige
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Nada é escrito");

const shR = zerarTudo();
shR.appendRow(linhaBoa("ESC-000080", "Torta", { "UF": "x@y.com", "E-mail (principal)": "" }));
shR.appendRow(linhaBoa("ESC-000081", "Boa"));

const antes = JSON.stringify(shR.getRange(1, 1, shR.getLastRow(), CABECALHO.length).getValues());
g.escolasPendenciasListar({}, ADM);
g.escolasPendenciasListar({ tipo: "DADO_FORA_DO_LUGAR" }, ADM);
g.escolasPendenciasResumo(ADM);
const depois = JSON.stringify(shR.getRange(1, 1, shR.getLastRow(), CABECALHO.length).getValues());

b.passo("42. Listar três vezes não mudou uma célula");
b.ok(antes === depois,
  "quem corrige é a tela de cadastro, com a auditoria dela — não a fila");

b.passo("43. E nenhuma aba nova foi criada de lado");
const abas = ss.getSheets().map(function (s) { return s.getName(); });
b.ok(abas.filter(function (n) { return n.indexOf("PENDENC") > -1; }).length === 0,
  "a fila não persiste estado em lugar nenhum", abas.join(", "));

/* ══════════════════════════════════════════════════════════════════════
   12. FALHA DE INFRA
   ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PENDÊNCIAS · Quando a aba não existe");

const shSumiu = ss.getSheetByName("Escolas");
if (shSumiu) ss.deleteSheet(shSumiu);

b.passo("44. Aba ausente devolve recusa explicada, não exceção crua");
const rSem = g.escolasPendenciasListar({}, ADM);
b.ok(rSem.ok === false && /n[ãa]o encontrada/i.test(String(rSem.mensagem || "")),
  "a tela consegue mostrar o motivo", rSem.mensagem);

b.passo("45. E o resumo repassa a mesma recusa");
const resSem = g.escolasPendenciasResumo(ADM);
b.ok(resSem.ok === false && resSem.mensagem === rSem.mensagem,
  "o resumo não engole o erro e devolve zeros — zero e 'não deu' são coisas diferentes",
  resSem.mensagem);

const c = b.resumo();
process.exit(c.FALHOU ? 1 : 0);
