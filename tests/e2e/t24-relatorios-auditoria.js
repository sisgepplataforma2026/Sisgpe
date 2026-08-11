/**
 * TESTE — RELATÓRIOS DE AUDITORIA (tela 16.11)
 *
 * DUAS COISAS QUE ESTE TESTE EXISTE PARA IMPEDIR
 *
 * 1. Que o relatório de Conformidade LGPD diga "em dia" quando não está. É
 *    o relatório que se leva para uma reunião de diretoria — se ele erra
 *    para o lado otimista, o sindicato descobre a pendência pela ANPD.
 *
 * 2. Que gerar relatório vire a porta de saída sem rastro. Alguns levam nome
 *    de pessoa; se a geração não se registrasse, bastaria usar a tela de
 *    relatórios para ler tudo sem deixar vestígio.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

/* Movimento para os relatórios terem o que ler. */
g.auditar_({ registroId: "OF-900", modulo: "Documentos", submodulo: "Ofícios",
  acao: "EMITIR", usuario: "marcelha@sindeducacao.com" });
g.auditar_({ registroId: "OF-900", modulo: "Documentos", submodulo: "Ofícios",
  acao: "CANCELAR", usuario: "wanderson@sindeducacao.com", resultado: "FALHA" });
g.auditar_({ registroId: "DESP-900", modulo: "Financeiro",
  acao: "LANCAR_NO_BANCO", usuario: "rogerio@sindeducacao.com" });
g.aud_deExportacao_({ modulo: "Base de Associados", formato: "CSV",
  total: 8014, dadoPessoal: true, usuario: "wanderson@sindeducacao.com" });
g.aud_deExportacao_({ modulo: "Documentos", formato: "PDF",
  total: 41, dadoPessoal: false, usuario: "marcelha@sindeducacao.com" });

/* ══════════ 1. CATÁLOGO ══════════ */
b.fluxo("RELATÓRIOS · Catálogo");

b.passo("1. Os seis relatórios estão no catálogo");
const cat = g.relAudCatalogo(ADM);
b.ok(cat.ok && Object.keys(cat.relatorios).length === 6,
  "seis perguntas concretas, sem construtor de consulta",
  Object.keys(cat.relatorios).join(", "));

b.passo("2. Cada um declara se leva dado pessoal");
// A tela usa isso para marcar em vermelho ANTES de a pessoa gerar. Saber
// depois de exportar não serve de nada.
const todos = Object.keys(cat.relatorios);
b.ok(todos.every(k => typeof cat.relatorios[k].dadoPessoal === "boolean"),
  "a marca vermelha aparece antes de gerar",
  todos.filter(k => cat.relatorios[k].dadoPessoal).length + " com dado pessoal");

b.passo("3. Relatório inexistente é recusado");
const invalido = g.relAudGerar("RELATORIO_INVENTADO", {}, ADM);
b.ok(invalido.ok === false, "não gera o que não existe", invalido.mensagem);

/* ══════════ 2. OS RELATÓRIOS ══════════ */
b.fluxo("RELATÓRIOS · Conteúdo");

b.passo("4. Atividade por usuário agrupa e conta");
const ativ = g.relAudGerar("ATIVIDADE_USUARIO", {}, ADM);
b.ok(ativ.ok && ativ.linhas.length >= 3 && ativ.colunas.length === 5,
  "uma linha por pessoa, com total, críticas e falhas",
  ativ.linhas.length + " pessoa(s)");

b.passo("5. E ordena pela pessoa mais ativa");
// Quem lê está procurando quem mexeu mais. Ordem alfabética obrigaria a
// varrer a lista inteira.
const ordenado = ativ.linhas.every((l, i) => i === 0 || ativ.linhas[i-1][1] >= l[1]);
b.ok(ordenado, "decrescente por número de ações",
  ativ.linhas.map(l => l[0].split("@")[0] + ":" + l[1]).join(" · "));

b.passo("6. Ações críticas traz só as críticas");
const crit = g.relAudGerar("ACOES_CRITICAS", {}, ADM);
const soCriticas = crit.linhas.every(l => /CANCELAR|LANCAR|EXCLUIR|APROVAR|EXPORTAR|BLOQUEIO/.test(l[3]));
b.ok(crit.linhas.length >= 2 && soCriticas, "nenhuma ação comum entra",
  crit.linhas.map(l => l[3]).join(", "));

b.passo("7. Exportações traz SÓ as com dado pessoal");
// Se listasse todas, o relatório perderia a razão de existir — ele serve
// justamente para separar o que exige atenção.
const exp = g.relAudGerar("EXPORTACOES_PESSOAIS", {}, ADM);
b.ok(exp.linhas.length === 1 && String(exp.linhas[0][1]).indexOf("Associados") > -1,
  "a exportação de 41 ofícios sem dado pessoal fica de fora",
  exp.linhas.length + " linha(s) · " + (exp.linhas[0] ? exp.linhas[0][1] : ""));

b.passo("8. Acessos avisa que não há endereço de rede");
// Quem abre um relatório de acesso está quase sempre atrás disso.
const ac = g.relAudGerar("ACESSOS", {}, ADM);
b.ok(String(ac.aviso || "").indexOf("endereço de rede") > -1,
  "o limite vem escrito no próprio relatório", ac.aviso ? "aviso presente" : "SEM AVISO");

b.passo("9. Trilha de um registro exige o registro");
const semId = g.relAudGerar("VIDA_DO_REGISTRO", {}, ADM);
b.ok(semId.ok && semId.linhas.length === 0 && !!semId.mensagem,
  "pede o número em vez de devolver a trilha inteira", semId.mensagem);

b.passo("10. E devolve a história do mais antigo para o mais novo");
// Aqui se quer ler a história, não o que aconteceu por último — é o único
// relatório do módulo em ordem crescente, e é de propósito.
const vida = g.relAudGerar("VIDA_DO_REGISTRO", { registroId: "OF-900" }, ADM);
b.ok(vida.linhas.length === 2 && vida.linhas[0][2] === "EMITIR",
  "EMITIR antes de CANCELAR", vida.linhas.map(l => l[2]).join(" → "));

/* ══════════ 3. CONFORMIDADE — O QUE NÃO PODE MENTIR ══════════ */
b.fluxo("RELATÓRIOS · Conformidade LGPD");

const conf = g.relAudGerar("CONFORMIDADE_LGPD", {}, ADM);

b.passo("11. Atravessa os submódulos construídos");
b.ok(conf.ok && conf.linhas.length >= 6,
  "retenção, incidentes, titulares, links, trilha e consentimentos",
  conf.linhas.map(l => l[0]).join(" · "));

b.passo("12. Acusa o expurgo não instalado como PENDENTE");
// No emulador não há trigger. O relatório tem que dizer isso, não passar
// por cima.
const ret = conf.linhas.filter(l => l[0] === "Retenção e descarte");
b.ok(ret.some(l => l[1] === "PENDENTE"), "não finge que o expurgo está ativo",
  ret.map(l => l[1]).join(", "));

b.passo("13. Acusa a trilha na planilha de reserva");
// É a pendência mais importante: enquanto a trilha estiver na planilha,
// quem tem acesso a ela pode alterar o registro.
const trilha = conf.linhas.filter(l => l[0] === "Trilha de auditoria")[0];
b.ok(trilha && trilha[1] === "PENDENTE" && /reserva|alterar/i.test(trilha[2]),
  "diz que o registro é alterável hoje", trilha ? trilha[2] : "não achou");

b.passo("14. Cada pendência diz O QUE FAZER");
// Relatório que só diz "não conforme" obriga a pessoa a descobrir sozinha o
// próximo passo — e aí ninguém usa.
const pendentes = conf.linhas.filter(l => l[1] === "PENDENTE");
b.ok(pendentes.length >= 1 && pendentes.every(l => String(l[3]).trim().length > 0),
  "toda pendência traz o caminho",
  pendentes.map(l => l[0] + " → " + l[3]).join(" | ").slice(0, 120));

b.passo("15. Consentimentos aparece como NÃO IMPLEMENTADO, não como em dia");
// Adiado por decisão do usuário. Omitir do relatório faria parecer que está
// resolvido; marcar "em dia" seria falso.
const cons = conf.linhas.filter(l => l[0] === "Consentimentos")[0];
b.ok(cons && cons[1] === "NÃO IMPLEMENTADO",
  "o que não existe aparece como não existente", cons ? cons[1] : "ausente");

b.passo("16. Falha ao verificar vira INDETERMINADO, nunca 'em dia'");
// Painel de compliance que erra para o lado otimista cria a impressão de
// conformidade sem a conformidade.
const guardada = g.incListar;
g.incListar = function () { throw new Error("aba fora do ar"); };
const confFalha = g.relAudGerar("CONFORMIDADE_LGPD", {}, ADM);
g.incListar = guardada;
const incLinha = confFalha.linhas.filter(l => l[0] === "Incidentes")[0];
b.ok(incLinha && incLinha[1] === "INDETERMINADO",
  "não conclui conformidade a partir de erro", incLinha ? incLinha[1] : "sumiu");

b.passo("17. E o resumo conta as pendências");
b.ok(typeof conf.pendentes === "number" && conf.pendentes >= 2,
  "o número que vai para a reunião", conf.resumo);

/* ══════════ 4. GERAR TAMBÉM É EXPORTAR ══════════ */
b.fluxo("RELATÓRIOS · A geração se registra");

b.passo("18. Gerar pela tela deixa rastro em Exportações");
// Registrar no SERVIDOR, não no navegador: se o log morasse no cliente,
// bastaria não chamá-lo para levar o dado sem rastro.
const antes = g.auditoriaConsultar({ acao: "EXPORTAR", limite: 500 }, ADM).acoes.length;
g.relAudExportar("ATIVIDADE_USUARIO", {}, ADM);
const depois = g.auditoriaConsultar({ acao: "EXPORTAR", limite: 500 }, ADM).acoes;
b.ok(depois.length === antes + 1, "uma linha por relatório gerado",
  antes + " → " + depois.length);

b.passo("19. E o rastro diz QUAL relatório e se levava dado pessoal");
const ultimo = depois[0];
let det = ultimo.valorNovo;
if (typeof det === "string") { try { det = JSON.parse(det); } catch (e) { det = {}; } }
b.ok(det.dadoPessoal === true &&
     String(ultimo.justificativa).indexOf("Atividade por usuário") > -1,
  "dá para saber o que foi levado", ultimo.justificativa);

b.passo("20. Relatório sem dado pessoal não é marcado");
g.relAudExportar("CONFORMIDADE_LGPD", {}, ADM);
const daConformidade = g.auditoriaConsultar({ acao: "EXPORTAR", limite: 500 }, ADM).acoes[0];
let det2 = daConformidade.valorNovo;
if (typeof det2 === "string") { try { det2 = JSON.parse(det2); } catch (e) { det2 = {}; } }
b.ok(det2.dadoPessoal === false, "o alerta continua significando alguma coisa",
  daConformidade.justificativa);

/* ══════════ 5. PERMISSÃO ══════════ */
b.fluxo("RELATÓRIOS · Permissão");

b.passo("21. Quem não tem o módulo não gera nem lista");
// Os relatórios reúnem, num arquivo só, quem fez o quê no sindicato
// inteiro. É a saída mais concentrada de informação do sistema.
b.bloqueia(() => g.relAudCatalogo(FIN), "relAudCatalogo nega");
b.bloqueia(() => g.relAudGerar("ATIVIDADE_USUARIO", {}, FIN), "relAudGerar nega");
b.bloqueia(() => g.relAudExportar("ATIVIDADE_USUARIO", {}, FIN), "relAudExportar nega");
b.bloqueia(() => g.relAudGerar("ATIVIDADE_USUARIO", {}, ""), "nega token vazio");

b.naoTestavel("O download do CSV",
  "o arquivo é montado no navegador — conferir abrindo o CSV no Excel, " +
  "inclusive os acentos");
b.naoTestavel("A leitura do relatório de Conformidade em produção",
  "no emulador não há trigger nem Firestore, então ele acusa pendências que " +
  "podem estar resolvidas no projeto real");

b.resumo();
process.exit(0);
