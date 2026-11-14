/**
 * DISPARO AUTOMÁTICO DOS ROBÔS (14/11/2026). O botão do SISGEP aciona o workflow do GitHub.
 * Usuário: "tempo é dinheiro... a gente precisa que seja ágil" / "demorando para ligar".
 * Aqui: UrlFetchApp FALSO registra a chamada. Chave FICTÍCIA. NÃO PROVA: que o GitHub aceita o
 * disparo (precisa do workflow na main + chave real; o 1º disparo real é o teste).
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const chamadas = []; let resposta = 204;
g.UrlFetchApp = { fetch(url, o) { chamadas.push({ url, o }); return { getResponseCode: () => resposta, getContentText: () => "" }; } };
const props = g.PropertiesService.getScriptProperties();
const CHAVE = "ghp_FICTICIA0123456789abcdefghijklmn";

b.fluxo("DISPARO · sem chave");
let r = g.compassoIngressos_atualizarBase(TOKEN);
b.ok(r.ok && r.robo.acionado === false && chamadas.length === 0, "sem chave: não chama o GitHub e explica que o Claude aciona", r.mensagem);
b.ok(g.compassoIngressos_estadoRobo(TOKEN).ligado === false, "estado: desligado");

b.fluxo("DISPARO · guardar a chave");
b.ok(g.compassoIngressos_salvarChaveRobo("curta", TOKEN).ok === false, "chave inválida é recusada");
b.ok(g.compassoIngressos_salvarChaveRobo(CHAVE, "token-invalido").ok === false, "sem sessão de administrador, não guarda");
const s = g.compassoIngressos_salvarChaveRobo(CHAVE, TOKEN);
b.ok(s.ok && s.ligado && JSON.stringify(s).indexOf(CHAVE) < 0, "guarda e NÃO devolve a chave na resposta");
b.ok(g.compassoIngressos_estadoRobo(TOKEN).ligado === true && JSON.stringify(g.compassoIngressos_estadoRobo(TOKEN)).indexOf(CHAVE) < 0, "estado: ligado, sem expor a chave");

b.fluxo("DISPARO · acionar");
r = g.compassoIngressos_atualizarBase(TOKEN);
const c = chamadas[0];
b.ok(r.robo.acionado && chamadas.length === 1, "com chave: aciona uma vez");
b.ok(/api\.github\.com\/repos\/sisgepplataforma2026\/Sisgpe\/actions\/workflows\/ingressos-ler-base\.yml\/dispatches$/.test(c.url), "chama o workflow de LEITURA do repositório certo", c.url);
b.ok(JSON.parse(c.o.payload).ref === "integracao/sisgep-homologacao" && c.o.headers.Authorization === "Bearer " + CHAVE && c.o.method === "post", "ref da homologação, método POST e chave no cabeçalho");
b.ok(JSON.stringify(r).indexOf(CHAVE) < 0, "a resposta não traz a chave");
resposta = 403; r = g.compassoIngressos_atualizarBase(TOKEN);
b.ok(r.ok && r.robo.acionado === false && /403/.test(r.robo.motivo) && JSON.stringify(r).indexOf(CHAVE) < 0, "GitHub recusou: o pedido segue valendo e a mensagem diz o código, sem a chave");
b.ok(g.compassoIngressos_salvarChaveRobo("", TOKEN).ligado === false && g.compassoIngressos_estadoRobo(TOKEN).ligado === false, "chave em branco desliga");
b.resumo();
