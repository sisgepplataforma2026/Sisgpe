/**
 * t116 — LIMPEZA E CENSO DAS PROPRIEDADES (o arquivo que vai para a PRODUÇÃO)
 *
 * O t115 cobre a limpeza do `Sessao.gs`, que roda na homologação. Este cobre o
 * `LimpezaPropriedades.gs`, que é o arquivo destinado à PRODUÇÃO — onde há 593
 * sessões vencidas, 185 KB de 500 KB e a emissão de ofícios dependendo do
 * login todo dia. É o teste de um arquivo que vai ser colado à mão num
 * ambiente em uso, e por isso ele cobra mais que o irmão.
 *
 * AS TRÊS COISAS QUE ESTE TESTE EXISTE PARA IMPEDIR
 *
 * 1. APAGAR SESSÃO VIVA. É a única forma de esta função causar dano: derruba
 *    a pessoa no meio do trabalho, e ninguém liga a queda à faxina que rodou
 *    de madrugada. Cobrado de dois jeitos — a propriedade continua existindo E
 *    o `getSessaoUsuario` ainda aceita o token. Existir sem autenticar seria
 *    pior que apagar.
 *
 * 2. ESTOURAR O LIMITE DE EXECUÇÃO. Na homologação foram 62 exclusões em 19
 *    segundos. Na produção são 593 — cerca de 3 minutos, contra um teto de 6.
 *    O lote é a razão de este arquivo existir separado, então o teste prova
 *    que ele para no limite e diz que sobrou trabalho, em vez de tentar tudo.
 *
 * 3. ENCOSTAR NO QUE NÃO É SESSÃO. A produção tem 96 propriedades que não são
 *    sessão — chaves de API, IDs de pasta, memória da IA. Uma varredura que
 *    passe por cima delas destrói configuração que ninguém tem de onde
 *    recuperar. O censo classifica; a limpeza só toca em sessão.
 */

const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);

/* A PORTA DA MANUTENÇÃO, e por que este teste precisa abri-la de propósito.
   As funções públicas deste arquivo exigem que quem chama seja o dono do
   script rodando pelo editor — `getActiveUser` igual a `getEffectiveUser`. No
   emulador o usuário ativo nasce VAZIO, que é como um visitante anônimo do app
   publicado chega. Para exercitar a manutenção é preciso assumir a identidade
   do dono; o passo 11 fecha a porta de volta e cobra que ela barra. */
g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;

const props = g.PropertiesService.getScriptProperties();
const PREFIXO = "SESSAO_SISGEP_";
const AGORA = Date.now();
const HORA = 60 * 60 * 1000;

function semearSessao(nome, expiraEm) {
  props.setProperty(PREFIXO + nome, JSON.stringify({
    token: nome, logado: true, usuario: "teste", nome: "Fulano de Teste",
    email: "teste@sindeducacao.com", perfil: "Administrador", modulos: "TODOS",
    criadoEm: expiraEm - 6 * HORA, expiraEm: expiraEm
  }));
}

/* Volume de propósito acima do lote, para que o lote signifique alguma coisa:
   sem isso, "parou no limite" passaria por não haver o que apagar. */
const VENCIDAS = 30;
const VIVAS = 4;
for (let i = 0; i < VENCIDAS; i++) semearSessao("velha-" + i, AGORA - (i + 2) * HORA);
for (let i = 0; i < VIVAS; i++) semearSessao("viva-" + i, AGORA + (i + 1) * HORA);
props.setProperty(PREFIXO + "quebrada", "{isto não é JSON");

/* O que NÃO é sessão — inclusive a família que tem o mesmo defeito e que este
   arquivo conta mas não apaga de propósito. */
props.setProperty("ANTHROPIC_API_KEY", "sk-ant-naodeveserapagada");
props.setProperty("SISGEP_AMBIENTE", "homologacao");
props.setProperty("PASTA_DESPESAS_ID", "1hdycHpKOgaDV4zRS");
props.setProperty("TOKEN_GUIA_abc", JSON.stringify({ expira: AGORA - 99 * HORA }));
props.setProperty("TOKEN_GUIA_def", JSON.stringify({ expira: AGORA + 99 * HORA }));

b.fluxo("PRODUÇÃO · censo das propriedades");

b.passo("1. o censo enxerga o tamanho do problema");
const censo = g.censoPropriedades();
b.ok(censo.ok === true, "censoPropriedades roda e devolve estrutura");
b.igual(censo.sessoesVencidas, VENCIDAS, "conta as vencidas");
b.igual(censo.sessoesVivas, VIVAS, "e as vivas, separadas");
b.igual(censo.sessoesCorrompidas, 1, "e a corrompida");
b.ok(censo.bytes > 0 && censo.percentual >= 0, "mede o espaço em bytes e em % do teto",
  (censo.bytes / 1024).toFixed(1) + " KB · " + censo.percentual + "%");

b.passo("2. o censo classifica por família — é o que revela a segunda vazão");
/* Sessão não é a única coisa que se acumula. O TOKEN_GUIA_ tem o mesmo
   defeito (GuiasPagamento.gs:2191 devolve null no vencido e não apaga), e sem
   o censo por família ninguém descobriria isso olhando um total. */
b.ok(
  /Tokens de guia: 2/.test(censo.relatorio),
  "os tokens de guia aparecem como família própria",
  "sem isso, os 96 'outros' da produção seriam um número opaco"
);
b.ok(/Sessões de login: 35/.test(censo.relatorio), "e as sessões, com o total certo");

b.passo("3. o censo NÃO devolve valor de propriedade — não pode virar vazamento");
/* Roda-se um censo sem pensar duas vezes. Se ele imprimisse valores, seria uma
   função de despejar segredo com nome amigável. */
b.ok(
  censo.relatorio.indexOf("sk-ant-naodeveserapagada") === -1,
  "a chave de API não aparece no relatório",
  censo.relatorio.indexOf("sk-ant-naodeveserapagada") >= 0 ? "VAZOU" : "contido"
);
b.ok(
  JSON.stringify(censo).indexOf("1hdycHpKOgaDV4zRS") === -1,
  "nem o ID de pasta — o retorno é contagem e tamanho, nunca conteúdo"
);

b.fluxo("PRODUÇÃO · a limpeza em lotes");

b.passo("4. a simulação conta tudo e não apaga nada");
const sim = g.simularLimpezaSessoes();
b.igual(sim.vencidas, VENCIDAS, "vê todas as vencidas, sem teto de lote");
b.igual(sim.apagadas, 0, "e não apaga nenhuma");
b.ok(props.getProperty(PREFIXO + "velha-0") !== null,
  "a vencida continua no lugar — é simulação de verdade");

b.passo("5. O LOTE — para no limite e avisa que sobrou");
/* A razão de este arquivo existir separado do Sessao.gs. Sem o lote, 593
   exclusões passariam de 3 minutos contra um teto de 6, e a execução morreria
   no meio, sem relatório e sem saber onde parou. */
const lote1 = g.lp_limparSessoes_(false, 10);
b.igual(lote1.apagadas, 10, "apaga exatamente o tamanho do lote, não mais");
b.ok(lote1.restam > 0, "e diz quantas ainda faltam", lote1.restam + " restantes");
b.ok(lote1.concluido === false,
  "concluido=false é o sinal de que precisa rodar de novo",
  "sem isso, quem roda uma vez acha que terminou");

b.passo("6. rodando até o fim, em lotes");
let voltas = 1, guarda = 0;
let r = lote1;
while (!r.concluido && guarda++ < 20) { r = g.lp_limparSessoes_(false, 10); voltas++; }
b.ok(r.concluido === true, "chega ao fim em lotes sucessivos", voltas + " execuções");
b.igual(r.restam, 0, "e não sobra nada");
b.ok(props.getProperty(PREFIXO + "quebrada") === null,
  "a corrompida também saiu — JSON quebrado nunca autenticaria ninguém");

b.passo("7. A ASSERÇÃO QUE IMPORTA — sessão viva intacta");
/* Se este passo falhar, a faxina virou deslogamento em massa noturno. */
for (let i = 0; i < VIVAS; i++) {
  b.ok(props.getProperty(PREFIXO + "viva-" + i) !== null,
    "PRESERVADA: viva-" + i + " — apagar derrubaria a pessoa no meio do trabalho");
}

b.passo("8. e a sessão viva continua VALENDO, não só existindo");
const TOKEN_VIVO = b.logar(g, "wanderson");
g.lp_limparSessoes_(false, 500);
const sessao = g.getSessaoUsuario(TOKEN_VIVO);
b.ok(
  sessao && sessao.logado === true,
  "um login feito antes da faxina continua autenticando depois dela",
  sessao ? sessao.usuario : "RECUSOU — a limpeza corrompeu a sessão"
);

b.passo("9. o que não é sessão não é tocado");
b.ok(props.getProperty("ANTHROPIC_API_KEY") === "sk-ant-naodeveserapagada",
  "a chave de API ficou intacta");
b.ok(props.getProperty("SISGEP_AMBIENTE") === "homologacao", "e o ambiente");
b.ok(props.getProperty("PASTA_DESPESAS_ID") === "1hdycHpKOgaDV4zRS", "e o ID de pasta");
b.ok(
  props.getProperty("TOKEN_GUIA_abc") !== null,
  "o token de guia VENCIDO continua lá — de propósito",
  "apagar token de guia é decisão de produto, não de manutenção; o censo conta, a limpeza não mexe"
);

b.passo("10. rodar de novo não faz nada");
const denovo = g.lp_limparSessoes_(false, 200);
b.igual(denovo.apagadas, 0, "segunda passada não apaga nada");
b.ok(denovo.concluido === true, "e continua dizendo que está concluído");

b.passo("11. A PORTA — sem ser o dono, no editor, nada roda");
/* O t6-exposicao reprovou a primeira versão deste arquivo, e com razão: no
   Apps Script toda função global é endpoint para qualquer página do projeto,
   inclusive as anônimas do Code.gs. Sem porta, um visitante chamaria
   lpRemoverGatilho() e desligaria a faxina em silêncio — ninguém perceberia
   até o armazenamento encher e o login parar. */
g.__usuarioAtivoEmail = "";   // é como um anônimo chega
["censoPropriedades", "simularLimpezaSessoes", "limparSessoesLote",
 "lpInstalarGatilho", "lpRemoverGatilho"].forEach(function (fn) {
  let barrou = false, msg = "";
  try { g[fn](); } catch (e) { barrou = true; msg = String(e.message || e); }
  b.ok(barrou && /permiss/i.test(msg), "anônimo é barrado em " + fn,
    barrou ? msg.substring(0, 48) : "PASSOU SEM PORTA — endpoint aberto");
});

g.__usuarioAtivoEmail = "outra.pessoa@exemplo.com";
let barrouOutro = false;
try { g.lpRemoverGatilho(); } catch (e) { barrouOutro = true; }
b.ok(barrouOutro,
  "e quem está logado mas NÃO é o dono também é barrado",
  "getActiveUser diferente de getEffectiveUser");

g.__usuarioAtivoEmail = g.__donoDoProjetoEmail;
b.ok(g.censoPropriedades().ok === true, "o dono, no editor, passa normalmente");

b.passo("12. o gatilho fica FORA da porta, e isso é decisão, não esquecimento");
/* Gatilho roda sem usuário ativo: a porta barraria a própria faxina diária.
   Deixar aberta só vale porque lpLimpezaDiaria não lê nada e só apaga sessão
   já vencida — quem a chamasse de fora não derrubaria ninguém. */
g.__usuarioAtivoEmail = "";
const doGatilho = g.lpLimpezaDiaria();
b.ok(doGatilho && doGatilho.ok === true,
  "lpLimpezaDiaria roda sem usuário ativo — senão o gatilho nunca funcionaria",
  "e é seguro: só apaga o que já venceu, não devolve dado");

b.naoTestavel(
  "o gatilho lpLimpezaDiaria disparar de fato às 3h",
  "lpInstalarGatilho usa ScriptApp.newTrigger, que o emulador apenas registra. " +
  "Conferir em Acionadores → Execuções no dia seguinte"
);
b.naoTestavel(
  "o tempo real de 593 exclusões na produção",
  "a medida da homologação foi de ~0,3 s por exclusão, o que põe 593 em cerca " +
  "de 3 minutos contra um teto de 6. O lote de 200 existe por causa dessa " +
  "margem — mas o tempo real só se mede lá"
);

b.resumo();
