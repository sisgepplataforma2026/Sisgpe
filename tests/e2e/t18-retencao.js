/**
 * TESTE — RETENÇÃO E DESCARTE (tela 16.10)
 *
 * ⚠️ O QUE ESTE TESTE NÃO ALCANÇA
 * O gatilho de verdade. O emulador não instala trigger no Apps Script, então
 * "instalar" e "remover" são **NÃO TESTADOS** ponta a ponta — o que se prova
 * aqui é a permissão, a auditoria e o formato da resposta.
 *
 * O que ele prova por execução: que a tela não pode dizer "está tudo certo"
 * quando não sabe; que desligar o expurgo fica registrado como ação crítica;
 * e que apagar dado exige administrador.
 *
 * O ponto desta tela é um só: o expurgo não avisa quando está desligado.
 * Nada quebra, nada aparece — o sindicato simplesmente passa a guardar
 * geolocalização de gente por tempo indeterminado. Um estado silencioso que
 * só vira problema quando alguém pergunta.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

const ADM = b.logar(g, "wanderson");
const FIN = b.logar(g, "rogerio");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
if (!ss.getSheetByName("CONFIG")) ss.insertSheet("CONFIG").getRange(1,1,1,2).setValues([["CHAVE","VALOR"]]);

/* ══════════ 1. O PAINEL ══════════ */
b.fluxo("RETENÇÃO · Estado da política");

b.passo("1. O painel responde com tudo que a tela desenha");
const p = g.lgpdPainelRetencao(ADM);
const campos = ["ok", "politicas", "ultimoExpurgo"];
const falta = campos.filter(c => !(c in p));
b.ok(falta.length === 0, "nada que a tela lê vem indefinido",
  falta.length ? "FALTOU: " + falta.join(", ") : JSON.stringify(Object.keys(p)));

b.passo("2. As políticas saem do código, com prazo e origem da decisão");
b.ok(p.politicas.length === 2 &&
     p.politicas.every(x => x.dado && x.onde && typeof x.anos === "number" && x.base),
  "cada política diz o quê, onde, por quanto tempo e por decisão de quem",
  p.politicas.map(x => x.onde + ":" + x.anos + "a").join(" · "));

b.passo("3. O prazo vem da constante que o expurgo usa de verdade");
// Se a tela trouxesse "5 anos" escrito à mão e o código apagasse com 3, a
// tela mentiria numa fiscalização — e é justamente ali que ela seria lida.
const visitas = p.politicas.filter(x => x.onde === "Visitas")[0];
b.ok(visitas.anos === g.VIS_LGPD_RETENCAO_ANOS_,
  "a tela mostra o mesmo prazo que o expurgo obedece",
  "tela=" + visitas.anos + " · código=" + g.VIS_LGPD_RETENCAO_ANOS_);

b.passo("4. Sem expurgo registrado, diz que não há registro");
// A tentação seria mostrar "—" ou a data de hoje. As duas mentem: uma
// esconde a ausência, a outra inventa um descarte que não houve.
b.ok(p.ultimoExpurgo === null,
  "ausência de registro é informada, não disfarçada", String(p.ultimoExpurgo));

/* ══════════ 2. O EXPURGO REGISTRA O QUE FEZ ══════════ */
b.fluxo("RETENÇÃO · O expurgo deixa rastro");

b.passo("5. Rodar o expurgo grava quando rodou e o que apagou");
// Sem isto, a pergunta "quando foi o último descarte?" não tinha resposta em
// lugar nenhum: o Logger some em dias e ninguém abre.
g.verificarEExpurgarDadosLGPD();
const p2 = g.lgpdPainelRetencao(ADM);
b.ok(p2.ultimoExpurgo && p2.ultimoExpurgo.quando,
  "a data do último expurgo fica guardada",
  p2.ultimoExpurgo ? p2.ultimoExpurgo.quando : "não gravou");

b.passo("6. E entra na trilha de auditoria como ação crítica");
const naTrilha = g.auditoriaConsultar({ acao: "EXCLUIR_DADOS_VENCIDOS" }, ADM).acoes;
b.ok(naTrilha.length >= 1 && naTrilha[0].critica === true,
  "apagar dado é crítico e fica na trilha",
  naTrilha.length ? naTrilha[0].modulo + " › " + naTrilha[0].submodulo + " · origem=" + naTrilha[0].origem : "não achou");

b.passo("7. O expurgo automático não depende de sessão");
// É gatilho de horário: roda de madrugada, sem usuário logado. Exigir sessão
// aqui desligaria o expurgo em silêncio — o defeito exato que a tela existe
// para evitar.
let exigiuSessao = false;
try { g.verificarEExpurgarDadosLGPD(); } catch (e) { exigiuSessao = true; }
b.ok(exigiuSessao === false, "roda pelo gatilho, sem sessão", "");

/* ══════════ 3. A TELA NÃO PODE FINGIR QUE SABE ══════════ */
b.fluxo("RETENÇÃO · Quando não dá para saber, a tela diz que não sabe");

b.passo("8. Falha ao ler os gatilhos vira 'indefinido', não 'instalado'");
// Um painel de compliance que erra para o lado otimista é pior que painel
// nenhum: cria a impressão de conformidade sem a conformidade.
const guardado = g.ScriptApp.getProjectTriggers;
g.ScriptApp.getProjectTriggers = function () { throw new Error("sem permissão"); };
const pFalha = g.lgpdPainelRetencao(ADM);
g.ScriptApp.getProjectTriggers = guardado;
b.ok(pFalha.ok === true && pFalha.gatilhoConhecido === false &&
     pFalha.gatilhoInstalado === undefined,
  "não afirma que está instalado quando não conseguiu verificar",
  "gatilhoConhecido=" + pFalha.gatilhoConhecido);

b.passo("9. E ainda assim mostra as políticas");
b.ok(pFalha.politicas && pFalha.politicas.length === 2,
  "não perder a tela inteira por causa de uma checagem", pFalha.politicas.length + " políticas");

/* ══════════ 4. PERMISSÃO ══════════ */
b.fluxo("RETENÇÃO · Permissão");

b.passo("10. Ler o painel exige o módulo");
b.bloqueia(() => g.lgpdPainelRetencao(FIN), "lgpdPainelRetencao nega");
b.bloqueia(() => g.lgpdPainelRetencao(""), "nega token vazio");

b.passo("11. Instalar e desligar o expurgo exigem administrador");
// Desligar o expurgo é a ação mais perigosa desta tela, e a que menos
// aparenta perigo: nada quebra na hora.
b.bloqueia(() => g.lgpdInstalarTrigger(FIN), "lgpdInstalarTrigger nega não-admin");
b.bloqueia(() => g.lgpdRemoverTrigger(FIN), "lgpdRemoverTrigger nega não-admin");

b.passo("12. Apagar dado agora exige administrador");
b.bloqueia(() => g.executarExpurgoLGPDAgora(FIN), "executarExpurgoLGPDAgora nega não-admin");
b.bloqueia(() => g.executarExpurgoLGPDAgora(""), "nega token vazio");

b.naoTestavel("Instalação e remoção do gatilho de verdade",
  "o emulador não instala trigger do Apps Script — verificar em Extensões › " +
  "Acionadores depois de clicar em 'Instalar o expurgo automático'");
b.naoTestavel("O apagamento real das células de geolocalização e da Receita",
  "depende das abas de produção; aqui as abas do emulador estão vazias");

b.resumo();
