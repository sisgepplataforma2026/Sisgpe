/**
 * t115 — LIMPEZA DAS SESSÕES EXPIRADAS
 *
 * Acrescentado em 31/08/2026, a partir de um achado que veio de um print.
 *
 * A tela de Propriedades do script parou de mostrar tudo — passou de 50 e o
 * Apps Script trunca. Olhando o conteúdo: 46 sessões, todas do mesmo usuário,
 * criadas entre 18 e 31/08. Treze dias, ~3,5 por dia.
 *
 * Cada login grava SESSAO_SISGEP_<uuid> nas propriedades. A limpeza existia,
 * mas só dispara quando alguém APRESENTA aquele token vencido. Quem entra,
 * fecha o navegador e não volta com aquele token deixa a propriedade para
 * sempre: a sessão dura 6 horas, a propriedade fica.
 *
 * O teto do armazenamento é 500 KB e cada sessão ocupa ~261 bytes — cerca de
 * 1.900 sessões. E o que quebra quando o teto chega é o LOGIN, porque é ali
 * que a sessão é gravada. O erro não dirá "excesso de sessões velhas".
 *
 * O QUE ESTE TESTE PROTEGE
 *
 * A metade perigosa não é apagar de menos: é apagar DEMAIS. Uma função que
 * varre sessões e apaga a viva por engano derruba a pessoa do sistema no meio
 * do trabalho — troca um problema lento por um imediato, e ninguém liga a
 * queda à "limpeza" que rodou de madrugada.
 *
 * Por isso a asserção central aqui não é "apagou as velhas". É "não encostou
 * nas vivas".
 */

const b = require("./base");
const { g } = b.subir({});

const props = g.PropertiesService.getScriptProperties();
const PREFIXO = g.SESSAO_CONFIG.CHAVE_CACHE_SESSAO;
const AGORA = Date.now();
const HORA = 60 * 60 * 1000;

function semear(nome, expiraEm, criadoEm) {
  props.setProperty(PREFIXO + nome, JSON.stringify({
    token: nome, logado: true, usuario: "teste", nome: "Fulano de Teste",
    email: "teste@sindeducacao.com", perfil: "Administrador", modulos: "TODOS",
    criadoEm: criadoEm || (expiraEm - 6 * HORA), expiraEm: expiraEm
  }));
}

/* Três vencidas, duas vivas, uma corrompida — e duas propriedades que não são
   sessão, para provar que a varredura não passa por cima do resto. */
semear("velha-1", AGORA - 10 * HORA);
semear("velha-2", AGORA - 3 * HORA);
semear("velha-3", AGORA - 200 * HORA, AGORA - 206 * HORA);
semear("viva-1", AGORA + 2 * HORA);
semear("viva-2", AGORA + 5 * HORA);
props.setProperty(PREFIXO + "quebrada", "{isto não é JSON válido");
props.setProperty("ANTHROPIC_API_KEY", "sk-ant-naodeveserapagada");
props.setProperty("SISGEP_AMBIENTE", "homologacao");

b.fluxo("SESSÕES · a limpeza não pode derrubar quem está trabalhando");

b.passo("1. simulação primeiro — conta sem apagar");
/* Modo seguro para conferir antes de agir. Quem vai rodar isso num projeto
   com 46 sessões reais merece poder olhar antes. */
const sim = g.limparSessoesExpiradas_(true);
b.igual(sim.expiradas, 3, "encontra as 3 expiradas");
b.igual(sim.vivas, 2, "e reconhece as 2 vivas");
b.igual(sim.corrompidas, 1, "e a corrompida");
b.igual(sim.apagadas, 0, "mas NÃO apaga nada em simulação");

b.ok(
  props.getProperty(PREFIXO + "velha-1") !== null,
  "a simulação deixou a expirada no lugar — é simulação de verdade"
);

b.passo("2. a execução real apaga as vencidas");
const r = g.limparSessoesExpiradas_(false);
b.igual(r.apagadas, 4, "apaga as 3 expiradas mais a corrompida");
["velha-1", "velha-2", "velha-3"].forEach(function (n) {
  b.ok(props.getProperty(PREFIXO + n) === null, "sumiu: " + n);
});
b.ok(props.getProperty(PREFIXO + "quebrada") === null,
  "e a corrompida também — JSON quebrado nunca vai autenticar ninguém");

b.passo("3. A ASSERÇÃO QUE IMPORTA — sessão viva continua lá");
/* Se este passo falhar, a "limpeza" virou um deslogamento em massa noturno.
   É o único jeito de esta função causar dano, e é o que ela não pode fazer. */
["viva-1", "viva-2"].forEach(function (n) {
  b.ok(props.getProperty(PREFIXO + n) !== null,
    "PRESERVADA: " + n + " — apagar derrubaria a pessoa no meio do trabalho");
});
b.igual(r.vivas, 2, "e o relatório diz quantas foram preservadas");

b.passo("4. a sessão viva continua VALENDO depois da limpeza");
/* Não basta a propriedade existir: tem de continuar autenticando. */
const sessao = g.getSessaoUsuario("viva-1");
b.ok(
  sessao && sessao.logado === true,
  "getSessaoUsuario ainda aceita o token da sessão viva",
  sessao ? sessao.usuario : "recusou — a limpeza corrompeu a sessão"
);

b.passo("5. o que não é sessão não é tocado");
b.ok(props.getProperty("ANTHROPIC_API_KEY") === "sk-ant-naodeveserapagada",
  "a chave de API ficou intacta");
b.ok(props.getProperty("SISGEP_AMBIENTE") === "homologacao",
  "e o ambiente também");
b.ok(r.outras >= 2, "o relatório conta as outras propriedades como intocadas", r.outras);

b.passo("6. rodar de novo não faz nada — é idempotente");
const r2 = g.limparSessoesExpiradas_(false);
b.igual(r2.apagadas, 0, "segunda execução não apaga nada");
b.igual(r2.vivas, 2, "e as vivas seguem lá");

b.naoTestavel(
  "o gatilho diário disparar de fato às 3h",
  "instalarTriggerLimpezaSessoes usa ScriptApp.newTrigger, que o emulador " +
  "apenas registra. Conferir em Acionadores no editor depois de instalar"
);

b.resumo();
