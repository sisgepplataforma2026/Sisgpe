/**
 * TESTE — ACHAR O OFÍCIO PELO NOME DE QUEM ESTÁ NELE
 *
 * DE ONDE VEIO, 11/09/2026, nas palavras do usuário:
 *
 *   "a gente encaminha o ofício pra escola, a escola fala 'ah, eu não recebi o
 *    ofício do nome de fulano, você consegue reenviar?'. É mais informação que
 *    eu tenho — em vez de ficar olhando um por um."
 *
 * O nome já existia no sistema: a emissão grava `Colaborador(es)` no Controle
 * (`Oficios.gs:947`) para todo tipo que não seja Ofício Livre. O que faltava
 * era alcance. O Histórico lê a `FILA_ENVIO_OFICIOS`, cujas 24 colunas não têm
 * campo de pessoa nenhum, e `aplicarFiltrosHistoricoOficios_` só sabia
 * procurar escola, número, status e tipo.
 *
 * POR QUE CRUZAMENTO E NÃO COLUNA NOVA. Acrescentar o nome à fila resolveria
 * só dali para a frente e deixaria todo ofício já emitido de fora — justamente
 * os que a escola liga perguntando. Cruzar pelo número torna o acervo inteiro
 * pesquisável no instante em que sobe, sem migração.
 *
 * O QUE ESTE TESTE NÃO COBRE: a tela. Que o campo aparece, que o Enter busca e
 * que o 📧 da linha reenvia são coisas de navegador — roteiro manual.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, naoTestavel, resumo } = require("./base");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
const token = b.logar(g, "wanderson");

/* ── A fila, que é o que o Histórico lê ───────────────────────────────── */
const CAB_FILA = ["ID","DATA_CRIACAO","NUMERO_OFICIO","TIPO","ESCOLA","CNPJ",
                  "EMAIL_PRINCIPAL","ANEXOS_JSON","STATUS","TENTATIVAS",
                  "ULTIMO_ERRO","USUARIO","CODIGO_VERIFICACAO"];
const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS") || ss.insertSheet("FILA_ENVIO_OFICIOS");
fila.clearContents();
fila.getRange(1, 1, 1, CAB_FILA.length).setValues([CAB_FILA]);
fila.getRange(2, 1, 4, CAB_FILA.length).setValues([
  ["1", new Date(2026,7,27), "388/2026", "Oposição à Taxa Negocial",
   "CENTRO EDUCACIONAL LINUS PAULING", "11.111.111/0001-11", "dp@linuspauling.com.br",
   "[]", "ENVIADO", 1, "", "wanderson", "COD388"],
  ["2", new Date(2026,2,14), "201/2026", "Filiação",
   "COLEGIO ALFA", "22.222.222/0001-22", "rh@alfa.com.br",
   "[]", "CONFIRMADO", 1, "", "wanderson", "COD201"],
  ["3", new Date(2026,5,2), "300/2026", "Desfiliação",
   "COLEGIO BETA", "33.333.333/0001-33", "rh@beta.com.br",
   "[]", "FALHA_ENTREGA", 2, "quicou", "wanderson", "COD300"],
  ["4", new Date(2026,6,9), "350/2026", "Ofício Livre",
   "PREFEITURA", "", "gab@prefeitura.gov.br",
   "[]", "ENVIADO", 1, "", "wanderson", "COD350"]
]);

/* ── O Controle, onde a emissão grava os nomes ────────────────────────── */
const CAB_REG = ["Número do Ofício", "Escola (Razão Social)", "Colaborador(es)", "Status"];
const reg = ss.getSheetByName(g.PLANILHA_REGISTRO) || ss.insertSheet(g.PLANILHA_REGISTRO);
reg.clearContents();
reg.getRange(1, 1, 1, CAB_REG.length).setValues([CAB_REG]);
reg.getRange(2, 1, 4, CAB_REG.length).setValues([
  ["388/2026", "CENTRO EDUCACIONAL LINUS PAULING",
   "EDUARDA SOUZA SILVA NIEIRO; MAYTE ARIADNE FONSECA CANAIS; MIRIAM DE LIMA BOLETTE", "ENVIADO"],
  ["201/2026", "COLEGIO ALFA", "WANDERSON NASCIMENTO CASTELO", "CONFIRMADO"],
  ["300/2026", "COLEGIO BETA", "WANDERSON NASCIMENTO CASTELO", "FALHA_ENTREGA"],
  /* Ofício Livre nasce sem nomes, de proposito — nao e sobre pessoas. */
  ["350/2026", "PREFEITURA", "", "ENVIADO"]
]);

const buscar = (filtros) => g.listarHistoricoOficios(filtros || {}, token);
const numerosDe = (r) => (r.itens || []).map(i => i.numero).sort();

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("A escola liga: \"não recebi o ofício do fulano\"");

passo("sem filtro nenhum");
const todos = buscar();
igual(todos.itens.length, 4, "os quatro ofícios da fila aparecem");

passo("o nome que o usuário deu de exemplo");
const porNome = buscar({ pessoa: "Wanderson Nascimento Castelo" });
igual(numerosDe(porNome), ["201/2026", "300/2026"],
   "acha os DOIS ofícios dessa pessoa, e só eles");

passo("o que a linha mostra, para não precisar abrir");
const um = porNome.itens.filter(i => i.numero === "300/2026")[0];
ok(!!um, "o 300/2026 está no resultado");
ok(String(um.colaboradores).indexOf("WANDERSON") > -1,
   "o nome vem na linha, não só serve de filtro", um.colaboradores);
igual(um.numero, "300/2026", "o número, que é o que ele anota");
ok(String(um.data).indexOf("2026") > -1, "a data", um.data);
igual(um.escola, "COLEGIO BETA", "a escola");
igual(um.tipo, "Desfiliação", "e o tipo");
igual(um.status, "FALHA_ENTREGA",
   "e o status — é ele que responde se a escola tem razão em dizer que não recebeu");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Digitar do jeito que se ouve no telefone");

passo("só o primeiro nome");
igual(numerosDe(buscar({ pessoa: "wanderson" })), ["201/2026", "300/2026"],
   "pedaço do nome basta");

passo("só o sobrenome");
igual(numerosDe(buscar({ pessoa: "CASTELO" })), ["201/2026", "300/2026"],
   "e serve o sobrenome sozinho, em qualquer caixa");

passo("com e sem acento");
igual(numerosDe(buscar({ pessoa: "ariadne" })), ["388/2026"],
   "acha um nome do meio da lista de outro ofício");

passo("nome que não está em ofício nenhum");
igual(buscar({ pessoa: "Fulano de Tal" }).itens.length, 0,
   "devolve vazio — e vazio aqui é uma resposta, não uma falha");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que a busca não alcança, e é correto não alcançar");

passo("Ofício Livre");
const livre = buscar().itens.filter(i => i.numero === "350/2026")[0];
igual(livre.colaboradores, "",
   "Ofício Livre não tem nomes — a emissão grava vazio porque não é sobre pessoas");

passo("o filtro de pessoa nunca traz Ofício Livre");
ok(numerosDe(buscar({ pessoa: "a" })).indexOf("350/2026") === -1,
   "nem numa busca larga ele entra");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("Falhar na busca não pode derrubar o Histórico");

passo("Controle sem a coluna de nomes");
g.histOficios_cacheColaboradores_ = null;
reg.getRange(1, 3).setValue("OUTRA COISA");
try { g.limparCacheHeader_(reg); } catch (e) {}
const semColuna = buscar();
igual(semColuna.itens.length, 4,
   "a listagem continua inteira — perder o filtro novo é aceitável, perder o Histórico não");
igual((semColuna.itens[0] || {}).colaboradores, "",
   "e os nomes vêm vazios, sem inventar nada");

/* ══════════════════════════════════════════════════════════════════════ */
fluxo("O que continua sem cobertura");

naoTestavel("O campo na tela e o reenvio a partir do resultado",
  "que o campo PESSOA aparece, que o Enter dispara a busca e que o 📧 da " +
  "linha abre o reenvio são comportamentos de navegador. Roteiro manual: " +
  "digitar um nome, ver a lista filtrar, clicar no 📧 daquela linha.");

resumo();
