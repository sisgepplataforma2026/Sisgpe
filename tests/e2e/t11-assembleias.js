/**
 * TESTE PONTA A PONTA — ASSEMBLEIAS GERAIS
 *
 * Fonte das regras: Estatuto SindEducação-ES 2026, arts. 59 a 73.
 *
 * O que se testa aqui não é "a tela abre". É se o sistema aplica o Estatuto.
 * Uma assembleia convocada errado é anulável, e cai junto tudo o que se
 * deliberou nela — destituição de diretor, alteração de Estatuto, aprovação
 * de contas. Cada verificação abaixo cita o artigo que ela protege.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");   // financeiro + rh — não tem assembleias

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

/* Convocação completa e regular — a base dos testes. */
function convocacaoOk(extra) {
  return Object.assign({
    materia: "ASSUNTOS_GERAIS",
    titulo: "Assembleia de teste",
    dataHora1a: "2026-09-10 18:00",
    dataHora2a: "2026-09-10 18:30",
    local: "Sede — Vitória/ES",
    ordemDoDia: "Informes da diretoria",
    convocadaPor: "Leonil Dias da Silva",
    origemConvocacao: "PRESIDENTE",
    editalSede: true,
    editalPublicacao: true,
    associadosAptos: 300
  }, extra || {});
}

/* ══════════ 1. O TIPO NÃO É ESCOLHA DE QUEM CONVOCA (art. 67) ══════════ */
b.fluxo("ASSEMBLEIAS · Classificação pela matéria (art. 67)");

b.passo("1. Contas, Orçamento e Eleições são ORDINÁRIAS");
["CONTAS", "ORCAMENTO", "ELEICOES"].forEach(m => {
  const c = g.assemb_classificar_(m);
  b.ok(c && c.tipo === "ORDINARIA", m + " classifica como Ordinária", c ? c.artigos : "não achou");
});

b.passo("2. Todo o resto é EXTRAORDINÁRIA");
["ALTERACAO_ESTATUTO", "DESTITUICAO_DIRETOR", "GREVE", "ASSUNTOS_GERAIS"].forEach(m => {
  const c = g.assemb_classificar_(m);
  b.ok(c && c.tipo === "EXTRAORDINARIA", m + " classifica como Extraordinária", c ? c.artigos : "");
});

b.passo("3. As três matérias de escrutínio secreto do art. 62");
// I - eleição para cargo; II - Balanço Financeiro; III - julgamento de atos
// da Diretoria sobre penalidades. Não é opcional.
["ELEICOES", "CONTAS", "JULGAMENTO_PENALIDADE"].forEach(m => {
  const c = g.assemb_classificar_(m);
  b.ok(c && c.escrutinioSecreto === true, m + " exige escrutínio SECRETO", c ? c.artigos : "");
});
b.ok(g.assemb_classificar_("ASSUNTOS_GERAIS").escrutinioSecreto === false,
  "assuntos gerais não exigem escrutínio secreto", "art. 61");

/* ══════════ 2. CONVOCAÇÃO (art. 72) ══════════ */
b.fluxo("ASSEMBLEIAS · Validade da convocação (arts. 63, 69, 70, 72, 73)");

b.passo("4. Convocação completa passa");
const okConv = g.assembConferirConvocacao(convocacaoOk(), ADM);
b.ok(okConv.valida === true, "convocação regular é aceita", okConv.falhas.join(" | ") || "sem pendências");

b.passo("5. Sem edital na sede, a convocação é irregular (art. 72, I)");
const semSede = g.assembConferirConvocacao(convocacaoOk({ editalSede: false }), ADM);
b.ok(semSede.valida === false && /sede/i.test(semSede.falhas.join(" ")),
  "falta do edital na sede é apontada", semSede.falhas.join(" | "));

b.passo("6. Sem publicação em jornal/DIO, é irregular (art. 72, II)");
const semPub = g.assembConferirConvocacao(convocacaoOk({ editalPublicacao: false }), ADM);
b.ok(semPub.valida === false && /jornal|Diário/i.test(semPub.falhas.join(" ")),
  "falta da publicação é apontada", semPub.falhas.join(" | "));

b.passo("7. Greve exige edital também no local de trabalho (art. 72, III)");
const greveSem = g.assembConferirConvocacao(convocacaoOk({
  materia: "GREVE", ordemDoDia: "Deflagração de greve na Escola X" }), ADM);
b.ok(greveSem.valida === false && /local de trabalho/i.test(greveSem.falhas.join(" ")),
  "greve sem edital no local de trabalho é barrada", greveSem.falhas.join(" | "));
const greveCom = g.assembConferirConvocacao(convocacaoOk({
  materia: "GREVE", ordemDoDia: "Deflagração de greve na Escola X",
  editalLocalTrabalho: true }), ADM);
b.ok(greveCom.valida === true, "com o edital no local de trabalho, passa", "");

b.passo("8. Matéria de fim específico exige ordem do dia (art. 63)");
const semPauta = g.assembConferirConvocacao(convocacaoOk({
  materia: "ALTERACAO_ESTATUTO", ordemDoDia: "" }), ADM);
b.ok(semPauta.valida === false && /ordem do dia|fins especificados/i.test(semPauta.falhas.join(" ")),
  "alteração de Estatuto sem ordem do dia é barrada", semPauta.falhas.join(" | "));

b.passo("9. Convocação por associados exige o protocolo (art. 70)");
const semProto = g.assembConferirConvocacao(convocacaoOk({ origemConvocacao: "ASSOCIADOS" }), ADM);
b.ok(semProto.valida === false && /protocolo/i.test(semProto.falhas.join(" ")),
  "sem número de protocolo na Secretaria Geral, é barrada", semProto.falhas.join(" | "));

b.passo("10. Sem segunda convocação declarada, é barrada (art. 73)");
// Sem a segunda, não havendo 2/3 na primeira a assembleia morre na porta.
const sem2a = g.assembConferirConvocacao(convocacaoOk({ dataHora2a: "" }), ADM);
b.ok(sem2a.valida === false && /segunda convocação/i.test(sem2a.falhas.join(" ")),
  "falta da segunda convocação é apontada", sem2a.falhas.join(" | "));

b.passo("11. Matéria fora do Estatuto não é aceita");
const inventada = g.assembConferirConvocacao(convocacaoOk({ materia: "FESTA_JUNINA" }), ADM);
b.ok(inventada.valida === false, "matéria não prevista é recusada", inventada.falhas.join(" | "));

/* ══════════ 3. QUÓRUM DE INSTALAÇÃO (art. 73) ══════════ */
b.fluxo("ASSEMBLEIAS · Quórum de instalação (art. 73)");

b.passo("12. Primeira convocação exige 2/3");
const q1nao = g.assemb_quorumInstalacao_(1, 300, 199);
const q1sim = g.assemb_quorumInstalacao_(1, 300, 200);
b.ok(q1nao.instalada === false && q1nao.exigido === 200,
  "199 de 300 NÃO instala (exige 200)", q1nao.explicacao);
b.ok(q1sim.instalada === true, "200 de 300 instala", q1sim.explicacao);

b.passo("13. Segunda convocação instala com qualquer número");
const q2 = g.assemb_quorumInstalacao_(2, 300, 7);
b.ok(q2.instalada === true, "7 presentes instalam em segunda convocação", q2.explicacao);
b.ok(g.assemb_quorumInstalacao_(2, 300, 0).instalada === false,
  "zero presente não instala nem em segunda", "ninguém compareceu");

b.passo("14. A ambiguidade do art. 73 é declarada, não escondida");
// O artigo não diz 2/3 DE QUÊ. O sistema aplica sobre associados aptos e
// avisa. Esconder a dúvida seria o erro; o teste garante que o aviso existe.
b.ok(q1sim.interpretacaoPendente === true && /não especifica a base/i.test(q1sim.avisoInterpretacao || ""),
  "o cálculo avisa que a base dos 2/3 precisa do Jurídico",
  String(q1sim.avisoInterpretacao || "").slice(0, 80));

/* ══════════ 4. QUÓRUM DE APROVAÇÃO (arts. 61 e 65) ══════════ */
b.fluxo("ASSEMBLEIAS · Quórum de aprovação (arts. 61 e 65)");

b.passo("15. Alteração de Estatuto: 2/3 dos presentes em 1ª convocação (art. 65 §1º)");
const est1nao = g.assemb_quorumAprovacao_("ALTERACAO_ESTATUTO", 1, { sim: 59, nao: 31, abstencoes: 0 });
const est1sim = g.assemb_quorumAprovacao_("ALTERACAO_ESTATUTO", 1, { sim: 60, nao: 30, abstencoes: 0 });
b.ok(est1nao.aprovado === false && est1nao.exigido === 60,
  "59 de 90 NÃO aprova (exige 60)", est1nao.explicacao);
b.ok(est1sim.aprovado === true, "60 de 90 aprova", est1sim.explicacao);

b.passo("16. Alteração de Estatuto: maioria simples em 2ª convocação (art. 65 §2º)");
const est2 = g.assemb_quorumAprovacao_("ALTERACAO_ESTATUTO", 2, { sim: 46, nao: 44, abstencoes: 0 });
b.ok(est2.aprovado === true, "46 de 90 aprova em segunda convocação", est2.explicacao);

b.passo("17. As demais matérias: maioria simples (art. 61)");
const ger = g.assemb_quorumAprovacao_("ASSUNTOS_GERAIS", 1, { sim: 51, nao: 49, abstencoes: 0 });
const emp = g.assemb_quorumAprovacao_("ASSUNTOS_GERAIS", 1, { sim: 50, nao: 50, abstencoes: 0 });
b.ok(ger.aprovado === true, "51 a 49 aprova", ger.explicacao);
b.ok(emp.aprovado === false, "empate 50 a 50 NÃO aprova — maioria é mais da metade", emp.explicacao);

b.passo("18. Abstenção conta como presente, não como voto a favor");
const comAbst = g.assemb_quorumAprovacao_("ASSUNTOS_GERAIS", 1, { sim: 40, nao: 30, abstencoes: 30 });
b.ok(comAbst.aprovado === false && comAbst.presentes === 100,
  "40 sim, 30 não, 30 abstenções: não aprova", comAbst.explicacao);

b.passo("19. Eleições e alienação de imóvel têm regulamento próprio (arts. 66 e 68)");
["ELEICOES", "ALIENACAO_IMOVEL"].forEach(m => {
  const r = g.assemb_quorumAprovacao_(m, 1, { sim: 10, nao: 1, abstencoes: 0 });
  b.ok(r.exigeAnaliseHumana === true && r.aprovado === null,
    m + " não é apurado pelo sistema", r.explicacao);
});

/* ══════════ 5. PRAZO DO ART. 70 ══════════ */
b.fluxo("ASSEMBLEIAS · Prazo de 10 dias úteis (art. 70, parágrafo único)");

b.passo("20. Dez dias ÚTEIS, não corridos");
// Protocolo numa segunda-feira: o 10º dia útil cai duas semanas depois,
// não dez dias depois. Contar corrido encurta o prazo e cria violação
// onde não há.
const p = g.assemb_prazoConvocacaoPorAssociados_("2026-09-07", "2026-09-07"); // 07/09/2026 = segunda
b.ok(p.limite === "2026-09-21", "protocolo em 07/09 (seg) vence em 21/09 (seg)",
  "limite " + p.limite + " — 14 dias corridos, 10 úteis");

b.passo("21. Prazo vencido é tratado como violação grave");
const venc = g.assemb_prazoConvocacaoPorAssociados_("2026-01-05", "2026-08-06");
b.ok(venc.vencido === true && /grave violação/i.test(venc.alerta),
  "prazo estourado cita a consequência estatutária", venc.alerta.slice(0, 90));

b.passo("22. Prazo próximo do fim avisa antes de estourar");
const perto = g.assemb_prazoConvocacaoPorAssociados_("2026-09-07", "2026-09-18");
b.ok(perto.vencido === false && /Faltam/i.test(perto.alerta),
  "avisa nos últimos dias", perto.alerta);

/* ══════════ 6. CICLO COMPLETO ══════════ */
b.fluxo("ASSEMBLEIAS · Convocar → instalar → deliberar → encerrar");

b.passo("23. Registrar assembleia de alteração de Estatuto");
const reg = g.assembRegistrar(convocacaoOk({
  materia: "ALTERACAO_ESTATUTO",
  titulo: "AGE — Alteração do Estatuto Social",
  ordemDoDia: "Alteração dos arts. 12 e 23 do Estatuto"
}), ADM);
b.ok(reg.ok === true, "assembleia registrada", reg.mensagem || reg.falhas);
const ID = reg.id;
b.ok(reg.tipo === "EXTRAORDINARIA", "gravada como Extraordinária, pela matéria", reg.tipo);

b.passo("24. Convocação irregular NÃO grava");
const antes = g.assembListar({}, ADM).total;
const ruim = g.assembRegistrar(convocacaoOk({ editalPublicacao: false }), ADM);
const depois = g.assembListar({}, ADM).total;
b.ok(ruim.ok === false && antes === depois,
  "nada é gravado quando a convocação é irregular",
  antes + " antes, " + depois + " depois");

b.passo("25. Não se delibera antes de instalar");
const cedo = g.assembDeliberar(ID, "ALTERACAO_ESTATUTO", { sim: 10, nao: 0 }, ADM);
b.ok(cedo.ok === false && /INSTALADA/i.test(cedo.mensagem),
  "deliberação antes da instalação é recusada", cedo.mensagem);

b.passo("26. Instalar em primeira convocação, sem quórum");
const inst1 = g.assembInstalar(ID, 1, 150, ADM);
b.ok(inst1.instalada === false, "150 de 300 não instala em primeira", inst1.mensagem);

b.passo("27. Instalar em segunda convocação");
const inst2 = g.assembInstalar(ID, 2, 90, ADM);
b.ok(inst2.instalada === true, "90 presentes instalam em segunda", inst2.mensagem);

b.passo("28. Vedada deliberação fora da ordem do dia (art. 63, § único)");
// A regra mais violada na prática: a pauta "surge" no meio da reunião.
const fora = g.assembDeliberar(ID, "DESTITUICAO_DIRETOR", { sim: 80, nao: 10 }, ADM);
b.ok(fora.ok === false && fora.foraDaOrdemDoDia === true,
  "matéria estranha à convocação é recusada", String(fora.mensagem).slice(0, 110));

b.passo("29. Deliberar a matéria convocada");
const delib = g.assembDeliberar(ID, "ALTERACAO_ESTATUTO", { sim: 50, nao: 40, abstencoes: 0 }, ADM);
b.ok(delib.ok === true && delib.apurado === true && delib.aprovado === true,
  "50 de 90 aprova em segunda convocação (art. 65 §2º)", delib.mensagem);

b.passo("30. INTEGRAÇÃO — o resultado fica gravado e a assembleia encerra");
const gravada = g.assembListar({}, ADM).assembleias.filter(a => String(a.ID) === String(ID))[0];
b.ok(gravada && gravada.STATUS === "ENCERRADA" && gravada.RESULTADO === "APROVADO",
  "status e resultado persistidos",
  gravada ? gravada.STATUS + " / " + gravada.RESULTADO + " / presentes " + gravada.PRESENTES : "sumiu");
b.ok(gravada && String(gravada.CRIADO_POR).length > 0,
  "quem registrou fica no histórico", gravada ? String(gravada.CRIADO_POR) : "");

b.passo("31. Assembleia encerrada não reabre por instalação");
const reabrir = g.assembInstalar(ID, 2, 200, ADM);
b.ok(reabrir.ok === false, "encerrada não volta a instalar", reabrir.mensagem);

/* ══════════ 7. PERMISSÃO ══════════ */
b.fluxo("ASSEMBLEIAS · Permissão");

b.passo("32. Quem não tem o módulo não mexe em assembleia");
b.bloqueia(() => g.assembListar({}, FIN), "assembListar nega");
b.bloqueia(() => g.assembRegistrar(convocacaoOk(), FIN), "assembRegistrar nega");
b.bloqueia(() => g.assembInstalar(ID, 2, 90, FIN), "assembInstalar nega");
b.bloqueia(() => g.assembDeliberar(ID, "ASSUNTOS_GERAIS", { sim: 1 }, FIN), "assembDeliberar nega");

b.passo("33. Sem sessão");
b.bloqueia(() => g.assembListar({}, ""), "assembListar nega token vazio");

/* ══════════ 8. PROCEDÊNCIA DA REGRA ══════════ */
b.fluxo("ASSEMBLEIAS · De onde vem a regra");

b.passo("34. A versão do Estatuto aplicada é declarada, com a transição");
// As regras de assembleia do Estatuto 2026 valem. O mandato de 10 anos
// (art. 23) não — só a partir da próxima gestão. Confundir as duas coisas
// faz alguém calcular a próxima eleição para 2032 em vez de 2027.
const cat = g.assembCatalogo(ADM);
b.ok(cat.ok && /2026/.test(cat.estatuto.versao), "o módulo diz qual Estatuto aplica",
  cat.estatuto.versao);
b.ok(cat.estatuto.aprovado === true && /pr[oó]xima gest[aã]o/i.test(cat.estatuto.observacaoTransicao),
  "e separa o que já vale do que só vale na próxima gestão",
  cat.estatuto.observacaoTransicao);

b.passo("35. Toda matéria cita os artigos que a fundamentam");
const semArtigo = cat.materias.filter(m => !m.artigos || !/art/i.test(m.artigos));
b.ok(semArtigo.length === 0, "nenhuma regra sem artigo do Estatuto ao lado",
  semArtigo.length ? semArtigo.map(m => m.chave).join(", ") : cat.materias.length + " matérias");

b.naoTestavel("Publicação do edital em jornal e no Diário Oficial", "ato externo ao sistema");
b.naoTestavel("Contagem de votos em urna e lavratura da ata", "acontece na sala, com gente");

b.resumo();
process.exit(0);
