/**
 * TESTE PONTA A PONTA — GOVERNANÇA
 *
 * Fonte: Ata de Posse da Gestão 2022/2027, lavrada em 11/08/2022 e registrada
 * em cartório. Regras: Estatuto 2026, arts. 33-35 e 79.
 *
 * O que este módulo protege é uma data. O mandato termina em 10/08/2027, e o
 * edital de eleição tem antecedência MÍNIMA de 30 dias (art. 79). Perder esse
 * prazo não dá erro em tela nenhuma — só aparece quando o mandato acaba sem
 * eleição convocada. É o tipo de coisa que um sistema tem que vigiar porque
 * pessoa nenhuma vigia por cinco anos seguidos.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");   // financeiro + rh — não tem governanca

/* ══════════ 1. COMPOSIÇÃO ══════════ */
b.fluxo("GOVERNANÇA · Composição empossada");

b.passo("1. Os três órgãos da ata estão representados");
const comp = g.govComposicao(ADM);
b.ok(comp.ok === true, "govComposicao responde", comp.total + " pessoas empossadas");
["DIRETORIA_EXECUTIVA", "CONSELHO_FISCAL", "DELEGADOS_FEDERACAO"].forEach(o => {
  b.ok(!!comp.orgaos[o], o + " existe", comp.orgaos[o] ? comp.orgaos[o].rotulo : "faltando");
});

b.passo("2. Conselho Fiscal com 3 efetivos e 3 suplentes (art. 33)");
const cf = comp.orgaos.CONSELHO_FISCAL;
b.ok(cf.efetivos.length === 3 && cf.suplentes.length === 3,
  "composição bate com o Estatuto",
  cf.efetivos.length + " efetivos, " + cf.suplentes.length + " suplentes");

b.passo("3. A Diretoria Executiva tem os 8 cargos da ata");
const de = comp.orgaos.DIRETORIA_EXECUTIVA;
b.ok(de.efetivos.length === 8, "8 diretores efetivos", de.efetivos.length + " encontrados");
b.ok(de.efetivos[0].cargo === "Presidente" && /Leonil/.test(de.efetivos[0].nome),
  "o primeiro é o Presidente", de.efetivos[0].nome);

b.passo("4. NENHUM dado pessoal sensível no módulo (LGPD)");
// A ata traz CPF, RG, PIS, CTPS e endereço residencial de 24 pessoas. Este
// código vai para um repositório Git, e dado pessoal em Git não se apaga —
// fica no histórico para sempre. Só nome e cargo, que são públicos.
// Os padrões abaixo têm que ser específicos de documento e endereço. A
// primeira versão deste teste procurava "Residente" sem fronteira de palavra
// e acusava vazamento em "Vice-PRESIDENTE" — falha do teste, não do dado.
// Teste que grita errado ensina a ignorar teste.
const bruto = JSON.stringify(g.GOV_COMPOSICAO);
const vazamentos = [];
if (/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(bruto)) vazamentos.push("CPF");
if (/SSP\/ES|SPTC\/ES|\bRG n/i.test(bruto)) vazamentos.push("RG");
if (/PIS\/PASEP|\b\d{11,}\b/.test(bruto)) vazamentos.push("PIS/PASEP");
if (/CTPS/i.test(bruto)) vazamentos.push("CTPS");
if (/\d{5}-\d{3}|Residente [àáa]|\bapto\b|\bn[ºo]\s*\d/i.test(bruto)) vazamentos.push("endereço");
b.ok(vazamentos.length === 0, "nem CPF, RG, PIS, CTPS ou endereço entraram no código",
  vazamentos.length ? "VAZOU: " + vazamentos.join(", ") : "só nome, cargo, órgão e condição");

b.passo("5. Composição não concede acesso a módulo");
// Mandato é institucional; permissão é operacional. Confundir os dois é como
// um sistema sindical vira colcha de retalhos de exceção.
b.ok(/não concede acesso/i.test(comp.aviso), "o módulo diz isso explicitamente",
  comp.aviso.slice(0, 80));

/* ══════════ 2. MANDATO E TRANSIÇÃO ══════════ */
b.fluxo("GOVERNANÇA · Mandato de 5 anos e a transição para 10");

b.passo("6. A gestão atual é de 5 anos, não de 10");
// O Estatuto 2026 diz 10 anos (art. 23), mas isso vale para a PRÓXIMA gestão.
// Quem lesse só o Estatuto calcularia o fim desta para 2032.
const m = g.govMandato(ADM).mandato;
b.ok(m.gestao === "2022/2027" && m.duracaoAnos === 5,
  "gestão 2022/2027, cinco anos", m.posse + " a " + m.termino);
b.ok(m.termino === "2027-08-10", "termina em 10/08/2027, como diz a ata", m.termino);

b.passo("7. A próxima gestão já aparece com o regime novo");
b.ok(m.proximaGestao && m.proximaGestao.duracaoAnos === 10,
  "próxima gestão: 10 anos (Estatuto 2026, art. 23)",
  m.proximaGestao ? m.proximaGestao.estatutoAplicavel : "não declarada");

b.passo("8. O mandato está vigente hoje");
b.ok(m.situacao === "VIGENTE", "situação do mandato",
  m.situacao + " — faltam " + m.diasParaFim + " dia(s)");

/* ══════════ 3. JANELA DO EDITAL (art. 79) ══════════ */
b.fluxo("GOVERNANÇA · Janela do edital de eleição (art. 79)");

b.passo("9. Antes dos 24 meses, a janela ainda não abriu");
const antes = g.gov_situacaoMandato_("2025-01-10");
b.ok(antes.janelaEdital.estado === "AINDA_NAO_ABRIU",
  "em jan/2025 a janela não abriu", antes.janelaEdital.mensagem);

b.passo("10. A janela abre 24 meses antes do fim");
b.ok(antes.editalAbreEm === "2025-08-10", "abre em 10/08/2025", antes.editalAbreEm);

b.passo("11. Dentro da janela, o sistema mostra o prazo final");
const dentro = g.gov_situacaoMandato_("2026-08-06");
b.ok(dentro.janelaEdital.estado === "ABERTA", "hoje a janela está aberta",
  dentro.janelaEdital.mensagem);
b.ok(dentro.editalPrazoFinal === "2027-07-11",
  "prazo final do edital: 11/07/2027 (30 dias antes do fim)", dentro.editalPrazoFinal);

b.passo("12. Passado o prazo mínimo, vira alerta grave");
// É este o caso que ninguém percebe sozinho: mandato ainda em vigor, mas já
// não dá mais para convocar dentro do prazo.
const perdido = g.gov_situacaoMandato_("2027-07-20");
b.ok(perdido.janelaEdital.estado === "PRAZO_PERDIDO",
  "20/07/2027: mandato vivo, prazo do edital perdido",
  perdido.janelaEdital.mensagem.slice(0, 100));
b.ok(/Jur[ií]dico/i.test(perdido.janelaEdital.mensagem),
  "o alerta manda para o Jurídico, não só informa", "");

b.passo("13. Depois do fim do mandato");
const fim = g.gov_situacaoMandato_("2027-09-01");
b.ok(fim.situacao === "ENCERRADO" && fim.janelaEdital.estado === "MANDATO_ENCERRADO",
  "mandato encerrado é reconhecido", fim.janelaEdital.mensagem);

/* ══════════ 4. CONSELHO FISCAL (art. 35) ══════════ */
b.fluxo("GOVERNANÇA · Conselho Fiscal (arts. 34 e 35)");

b.passo("14. Ao menos uma reunião ordinária por semestre");
const semNada = g.govConselhoFiscal(2026, [], ADM);
b.ok(semNada.calendario.emDia === false && semNada.calendario.pendencias.length === 2,
  "ano sem reunião nenhuma acusa os dois semestres",
  semNada.calendario.pendencias.join(" "));

b.passo("15. Duas reuniões no MESMO semestre não cumprem o Estatuto");
// O art. 35 §único é por semestre, não duas no ano. Contar só o total
// deixaria passar um segundo semestre inteiro sem fiscalização.
const doisNoMesmo = g.govConselhoFiscal(2026, ["2026-02-10", "2026-05-20"], ADM);
b.ok(doisNoMesmo.calendario.emDia === false &&
     /2º semestre/.test(doisNoMesmo.calendario.pendencias.join(" ")),
  "duas em fevereiro e maio deixam o 2º semestre descoberto",
  doisNoMesmo.calendario.pendencias.join(" "));

b.passo("16. Uma em cada semestre cumpre");
const okCal = g.govConselhoFiscal(2026, ["2026-03-15", "2026-09-20"], ADM);
b.ok(okCal.calendario.emDia === true, "março e setembro: em dia",
  "1ºsem " + okCal.calendario.primeiroSemestre + ", 2ºsem " + okCal.calendario.segundoSemestre);

b.passo("17. A competência do Conselho vem escrita, com artigo");
b.ok(/art\. 34/.test(okCal.competencia) && /Assembleia Geral/.test(okCal.competencia),
  "fiscalização e parecer deliberado em Assembleia", okCal.competencia.slice(0, 90));

/* ══════════ 5. QUEM RESPONDE POR QUÊ ══════════ */
b.fluxo("GOVERNANÇA · Cargo estatutário × módulo do sistema");

b.passo("18. O Financeiro tem um Secretário de Finanças por trás");
const fin = g.govResponsavelPorModulo("financeiro", ADM);
b.ok(fin.total === 1 && /Finanças/.test(fin.responsaveis[0].cargo),
  "financeiro → Secretário de Finanças",
  fin.total ? fin.responsaveis[0].nome + " — " + fin.responsaveis[0].cargo : "sem responsável");

b.passo("19. Auditoria de Valores responde ao Conselho Fiscal inteiro");
const aud = g.govResponsavelPorModulo("auditoriaFin", ADM);
b.ok(aud.total === 3, "os 3 conselheiros efetivos", aud.responsaveis.map(r => r.nome).join(" · "));

b.passo("20. Módulo sem cargo correspondente não é tratado como erro");
// Benefícios não é secretaria. Dizer "sem responsável" como se fosse falha
// produziria alarme falso permanente no painel.
const ben = g.govResponsavelPorModulo("beneficios", ADM);
b.ok(ben.ok === true && ben.total === 0 && /não é erro/i.test(ben.mensagem),
  "responde que não há, e explica que isso é normal", ben.mensagem.slice(0, 90));

/* ══════════ 6. PERMISSÃO ══════════ */
b.fluxo("GOVERNANÇA · Permissão");

b.passo("21. Quem não tem o módulo não consulta a composição");
b.bloqueia(() => g.govComposicao(FIN), "govComposicao nega");
b.bloqueia(() => g.govMandato(FIN), "govMandato nega");
b.bloqueia(() => g.govConselhoFiscal(2026, [], FIN), "govConselhoFiscal nega");
b.bloqueia(() => g.govResponsavelPorModulo("financeiro", FIN), "govResponsavelPorModulo nega");

b.passo("22. Sem sessão");
b.bloqueia(() => g.govComposicao(""), "govComposicao nega token vazio");

b.naoTestavel("Registro da próxima ata de posse", "depende da eleição acontecer");

b.resumo();
