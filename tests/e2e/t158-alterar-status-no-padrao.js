/**
 * TESTE — ALTERAR STATUS NO PADRÃO SISGEP, E OS ENCERRADOS VISÍVEIS
 *
 * O QUE ORIGINOU, 10/09/2026. Duas coisas na mesma tela, no mesmo minuto.
 *
 * PRIMEIRA. O usuário foi procurar os ofícios que a cota derrubou e caiu na
 * lista errada — a de FALHA_ENTREGA. Não foi engano dele: o filtro de status
 * do Histórico não tinha `ERRO_PERMANENTE`, e a comparação dos dois filtros
 * (servidor e tela) é EXATA, então nem "Erro" alcançava. Os quatro ofícios
 * que mais precisavam de gente eram justamente os que a lista não sabia
 * mostrar. E o badge deles saía no âmbar de "pendente", pelo `else` do
 * `badgeClass` — âmbar promete espera, e encerrado é o contrário de esperar.
 *
 * SEGUNDA. Ao abrir a ação de alterar status ele viu o diálogo cru do
 * navegador — "Uma página incorporada em ...googleusercontent.com diz" — e
 * disse: *"Essa tela precisa estar no padrão Sisgep"*.
 *
 * O QUE A TROCA RESOLVE ALÉM DA APARÊNCIA, e é o motivo real dela: o
 * `window.prompt` não tinha como mostrar de ONDE o ofício vinha. A pessoa
 * escolhia sem ver o status atual nem o motivo da parada — e "devolver para
 * a fila" tem consequências opostas conforme o motivo. Com a cota do Google,
 * o ofício sai na próxima rodada. Com um endereço que recusou, ele só quica
 * de novo. Quem separa os dois é o ULTIMO_ERRO, que agora está à vista.
 *
 * O QUE ESTE TESTE NÃO ALCANÇA (REGRA Nº -1): o modal aberto no navegador. Se
 * ele renderiza, se o rádio marca, se o aviso aparece ao clicar. O emulador
 * não abre tela. O que se prova aqui é o backend, o filtro, e que a fiação da
 * tela aponta para os nomes certos.
 */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

const CAB = ["ID", "DATA_CRIACAO", "NUMERO_OFICIO", "TIPO", "ESCOLA", "CNPJ",
             "EMAIL_PRINCIPAL", "EMAILS_TODOS", "ASSUNTO", "HTML_BODY",
             "ANEXOS_JSON", "STATUS", "TENTATIVAS", "ULTIMO_ERRO",
             "DATA_ULTIMA_TENTATIVA", "USUARIO", "CODIGO_VERIFICACAO"];

const fila = ss.getSheetByName("FILA_ENVIO_OFICIOS") ||
             ss.insertSheet("FILA_ENVIO_OFICIOS");
fila.getRange(1, 1, 1, CAB.length).setValues([CAB]);

const linha = (id, num, status, tent, erro) =>
  [id, new Date(), num, "Filiação", "Colégio Teste", "00.000.000/0001-00",
   "escola@teste.com", "escola@teste.com", "Ofício " + num, "<p>x</p>",
   "[]", status, tent, erro || "", new Date(), "secretaria", ""];

const CEIFA  = "Máximo de 3 tentativas atingido.";
const BOUNCE = "Bounce detectado automaticamente em 02/09/2026 18:33";

fila.getRange(2, 1, 4, CAB.length).setValues([
  linha("a", "517/2026", "ERRO_PERMANENTE", 3, CEIFA),
  linha("b", "520/2026", "ERRO_PERMANENTE", 3, CEIFA),
  linha("c", "500/2026", "FALHA_ENTREGA",   1, BOUNCE),
  linha("d", "413/2026", "ERRO",            1, "Timeout")
]);

const numeros = (r) => (r.itens || []).map((i) => i.numero).sort();

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · o Histórico enxerga os encerrados");

passo("o filtro alcança ERRO_PERMANENTE");

const so = g.listarHistoricoOficios({ status: "ERRO_PERMANENTE" }, TOKEN);
igual(numeros(so).join(", "), "517/2026, 520/2026",
      "filtrar por ERRO_PERMANENTE traz os dois encerrados",
      "antes não havia opção no select, e eles não apareciam em filtro nenhum");

passo("e 'Erro' continua sendo outra coisa — a comparação é exata");

igual(numeros(g.listarHistoricoOficios({ status: "ERRO" }, TOKEN)).join(", "),
      "413/2026",
      "ERRO traz só o ERRO de verdade",
      "por isso a opção nova precisou existir: 'Erro' nunca alcançou o encerrado");

passo("o motivo da parada chega na tela");

/* Sem estes dois campos o modal não tem como mostrar de onde o ofício vem —
   que é a diferença entre escolher informado e escolher no escuro. */
const um = (g.listarHistoricoOficios({ numero: "517" }, TOKEN).itens || [])[0];
ok(!!um, "o 517 é encontrado pelo número");
igual(um.ultimoErro, CEIFA, "  e traz o ULTIMO_ERRO junto");
igual(um.tentativas, 3, "  e as tentativas gastas");

const bounce = (g.listarHistoricoOficios({ numero: "500" }, TOKEN).itens || [])[0];
ok(/Bounce detectado/.test(bounce.ultimoErro),
   "o 500 traz o bounce, que é o que muda a decisão de devolver ou não");

/* ══════════════════════════════════════════════════════════════════════════ */
fluxo("OFÍCIOS · alterar status no padrão SISGEP");

const fs2 = require("fs");
const path2 = require("path");
const RAIZ = path2.resolve(__dirname, "..", "..");
const tela = fs2.readFileSync(path2.join(RAIZ, "OficiosFormulario.html"), "utf8");
const js   = fs2.readFileSync(path2.join(RAIZ, "OficiosScripts.html"), "utf8");
const css  = fs2.readFileSync(path2.join(RAIZ, "OficiosStyles.html"), "utf8");

passo("o diálogo do navegador saiu de cena");

ok(!/Alterar status para:\\n1 - ENVIADO/.test(js),
   "não há mais window.prompt pedindo para digitar um número",
   "era o 'Uma página incorporada em ...googleusercontent.com diz'");
ok(!/window\.prompt\("Observação/.test(js),
   "  nem o segundo prompt, o da observação");

passo("no lugar dele, o modal da casa");

ok(/id="histStatusOverlay"/.test(tela), "o modal existe no Histórico");
ok(/of-modal-overlay/.test(tela.slice(tela.indexOf('id="histStatusOverlay"') - 60,
                                      tela.indexOf('id="histStatusOverlay"') + 60)),
   "  reaproveitando .of-modal-overlay do Design System",
   "modal novo do zero seria mais uma variação de modal no sistema");
ok(/id="histStatusOk"[\s\S]{0,120}btn-navy|btn-navy[\s\S]{0,120}id="histStatusOk"/.test(tela),
   "  e o botão de confirmar é o btn-navy do padrão");

passo("o estado atual fica à vista — o motivo desta troca");

ok(/id="histStatusAtual"/.test(tela), "o status atual aparece como badge");
ok(/id="histStatusMotivo"/.test(tela), "  e o último erro embaixo dele");
ok(/item\.ultimoErro/.test(js), "  alimentado pelo campo que o backend passou a mandar");

passo("cada opção diz o que faz, e não só como se chama");

["PENDENTE", "ENVIADO", "CONFIRMADO", "FALHA_ENTREGA", "ERRO"].forEach(function(v) {
  ok(new RegExp('name="histStatusOpcao" value="' + v + '"').test(tela),
     "opção " + v + " existe");
});
ok(/tentativas voltam a zero e o of&iacute;cio sai na pr&oacute;xima rodada|tentativas voltam a zero e o ofício sai na próxima rodada/.test(tela),
   "a de PENDENTE explica o que a gente consertou hoje",
   "'PENDENTE' sozinho não diz que as tentativas zeram");

passo("O AVISO: endereço que recusou + devolver para a fila");

ok(/id="histStatusAviso"/.test(tela), "existe o lugar do aviso");
ok(/atual === "FALHA_ENTREGA" && escolhido === "PENDENTE"/.test(js),
   "e ele dispara exatamente nessa combinação",
   "foi o que o usuário quase fez com o ofício 500");
ok(/MESMO endereço/.test(js), "  dizendo que vai para o mesmo endereço");
ok(/Preparar reenvio/.test(js), "  e apontando o caminho certo");
ok(!/return;[\s\S]{0,80}FALHA_ENTREGA/.test(js),
   "  avisa sem bloquear",
   "o endereço pode ter sido corrigido no cadastro, e quem sabe disso é a pessoa");

passo("o filtro ganhou a opção que faltava");

ok(/<option value="ERRO_PERMANENTE">/.test(tela),
   "Encerrado está no select de status");

passo("os badges deixaram de mentir");

ok(/\.hist-encerrado/.test(css) && /\.hist-falha/.test(css) && /\.hist-erro/.test(css),
   "as três classes que faltavam existem no CSS mestre");
ok(/hist-encerrado \{ background: #1e293b/.test(css),
   "  e encerrado não é âmbar de pendente",
   "âmbar promete espera; encerrado é o contrário de esperar");
ok(/statusClasse: function/.test(js) && /badgeClass=Historico\.statusClasse\(status\)/.test(js),
   "a tabela e o modal decidem a cor pela MESMA função",
   "duas regras de cor divergiriam no primeiro status novo");
ok(/statusRotulo[\s\S]{0,120}ERRO_PERMANENTE" \? "ENCERRADO"/.test(js),
   "e o que se lê na tela é ENCERRADO, não o nome interno");

resumo();
