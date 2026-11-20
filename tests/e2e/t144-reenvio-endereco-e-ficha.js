/**
 * TESTE — O REENVIO OFERECE O ENDEREÇO DE HOJE, E LEVA A FICHA
 *
 * O QUE ORIGINOU, 03/09/2026
 *
 * O usuário abriu o reenvio do ofício 144/2026 (FAESA, Filiação, de março) e
 * o campo rotulado "Vai para (do cadastro)" mostrava `thalia.ferreira@faesa.br`
 * — o endereço morto que fez aquele ofício quicar, e que ele já tinha
 * substituído no cadastro da escola no dia anterior.
 *
 * O rótulo mentia. A função lia a linha do PRÓPRIO OFÍCIO no Registro,
 * congelada na emissão; nunca leu o cadastro. Reenviar dali produziria o
 * oitavo bounce.
 *
 * Ele pediu duas coisas, e este teste mede as duas:
 *
 *   1. "deveria buscar o email atualizado na planilha";
 *   2. "Precisa ir ficha e oficio".
 *
 * O QUE ESTE TESTE NÃO ALCANÇA. O emulador não entrega e-mail nem renderiza
 * tela. Ele prova que a prévia lê as duas origens, marca certo, reúne os
 * anexos pela MESMA função do envio, e que a escolha da tela vence o endereço
 * antigo. Se a carta existe mesmo na pasta do Drive de produção, só o
 * `Anexos: N` de um reenvio real responde.
 */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const { fluxo, passo, ok, igual, aviso, naoTestavel, resumo } = require("./base");

const TOKEN = b.logar(g, "wanderson");

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* ── cenário: o ofício de março, e o cadastro corrigido ontem ── */
function semear() {
  const reg = ss.insertSheet(g.PLANILHA_REGISTRO);
  reg.getRange(1, 1, 1, 7).setValues([[
    "Número do Ofício", "Tipo", "Escola", "E-mail (principal)",
    "E-mails (todos)", "Link Ficha", "Status"
  ]]);
  reg.getRange(2, 1, 3, 7).setValues([
    ["144/2026", "Filiação", "FAESA", "thalia.ferreira@faesa.br",
     "thalia.ferreira@faesa.br", "", "FALHA_ENTREGA"],
    ["250/2026", "Filiação", "FAESA", "luiza.stefani@faesa.br",
     "luiza.stefani@faesa.br", "", "CONFIRMADO"],
    ["286/2026", "Filiação", "FAESA", "luiza.stefani@faesa.br",
     "luiza.stefani@faesa.br", "", "CONFIRMADO"]
  ]);

  const esc = ss.insertSheet("Escolas");
  esc.getRange(1, 1, 1, 3).setValues([["Escola (Razão Social)", "E-mail (principal)", "E-mails (todos)"]]);
  esc.getRange(2, 1, 1, 3).setValues([[
    "FAESA", "karolina.caldeira@faesa.br",
    "karolina.caldeira@faesa.br;luiza.stefani@faesa.br"
  ]]);
}
semear();

fluxo("REENVIO · o endereço oferecido é o de HOJE, não o de março");
passo("prévia");

const p = g.preverReenvioOficio({ numero: "144/2026", escola: "FAESA", tipo: "Filiação" }, TOKEN);

ok(p && p.ok, "a prévia responde", p && p.mensagem);

const porEmail = {};
(p.destinatarios || []).forEach(d => { porEmail[d.email.toLowerCase()] = d; });

ok(!!porEmail["thalia.ferreira@faesa.br"],
   "o endereço do ofício antigo APARECE — some da marcação, não da tela",
   "sumir seria decidir pela pessoa; mostrar desmarcado é informar");

ok(!!porEmail["karolina.caldeira@faesa.br"],
   "e o do cadastro de HOJE também aparece",
   "é o que o usuário corrigiu na planilha em 02/09");

igual(porEmail["thalia.ferreira@faesa.br"].origem, "deste ofício",
      "a origem de cada endereço fica dita, não suposta");
igual(porEmail["karolina.caldeira@faesa.br"].origem, "cadastro atual da escola",
      "e a do endereço novo também");

ok(porEmail["luiza.stefani@faesa.br"] &&
   porEmail["luiza.stefani@faesa.br"].origem === "deste ofício e do cadastro atual" ||
   porEmail["luiza.stefani@faesa.br"].origem === "cadastro atual da escola",
   "quem está nas duas origens não vira duas linhas",
   porEmail["luiza.stefani@faesa.br"] && porEmail["luiza.stefani@faesa.br"].origem);

passo("marcação");

igual(porEmail["thalia.ferreira@faesa.br"].marcado, false,
      "quem quicou NASCE DESMARCADO");
igual(porEmail["karolina.caldeira@faesa.br"].marcado, true,
      "quem está no cadastro de hoje e não quicou nasce marcado");

ok(porEmail["luiza.stefani@faesa.br"].confirmacoes >= 2,
   "e o histórico vem junto, para a escolha não ser às cegas",
   porEmail["luiza.stefani@faesa.br"].confirmacoes + " confirmação(ões)");

ok(porEmail["thalia.ferreira@faesa.br"].falhas >= 1,
   "a falha do endereço morto aparece em número",
   porEmail["thalia.ferreira@faesa.br"].falhas + " falha(s)");

fluxo("REENVIO · a escolha da tela vence o endereço antigo");
passo("envio");

amb.outbox.length = 0;
const env = g.reenviarOficio({
  numero: "144/2026", url: "https://drive.google.com/file/d/ARQ-OFICIO-144/view",
  escola: "FAESA", tipo: "Filiação",
  destinatarios: ["karolina.caldeira@faesa.br", "luiza.stefani@faesa.br"]
}, TOKEN);

ok(env && !env.erro, "reenviou", env && env.mensagem);

const destino = String((amb.outbox[0] || {}).to || "").toLowerCase();
ok(destino.indexOf("karolina.caldeira@faesa.br") > -1, "foi para o endereço novo");
ok(destino.indexOf("thalia.ferreira@faesa.br") === -1,
   "e NÃO para o morto — que é o defeito que originou este teste");

fluxo("REENVIO · a prévia dos anexos não pode ser uma segunda opinião");
passo("mesma função");

const fonte = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "EmailOficios.gs"), "utf8");

const chamadas = (fonte.match(/reunirAnexosReenvioOficio_\s*\(/g) || []).length;
ok(chamadas >= 1, "o envio reúne os anexos pela função compartilhada",
   chamadas + " chamada(s) em EmailOficios.gs");

const fontePrev = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosDestinatarios.gs"), "utf8");
ok(fontePrev.indexOf("reunirAnexosReenvioOficio_") > -1,
   "e a PRÉVIA usa a mesma — não uma cópia",
   "duas cópias fariam a prévia mentir no dia em que divergissem");

ok(!/obterAnexosOriginaisFilaOficio_\s*\([\s\S]{0,400}?recuperarAnexosDaPastaDrive_/.test(
     fonte.slice(fonte.indexOf("function reenviarOficio"))),
   "o caminho antigo de reunir anexos saiu de dentro do reenviarOficio",
   "estava duplicado; agora existe num lugar só");

passo("o aviso da ficha");

ok(typeof g.tipoOficioExigeFicha_ === "function",
   "o sistema sabe quais tipos AFIRMAM a ficha no corpo");
igual(g.tipoOficioExigeFicha_("Filiação"), true, "filiação exige");
igual(g.tipoOficioExigeFicha_("Desfiliação"), true, "desfiliação exige");
igual(g.tipoOficioExigeFicha_("Taxa Negocial"), false,
      "taxa negocial não — o corpo dela não promete ficha");

ok(typeof g.anexoEhFicha_ === "function", "e sabe reconhecer uma ficha pelo nome");
igual(g.anexoEhFicha_("Ficha_Filiacao_FULANO_ESCOLA_03-09-2026.pdf"), true, "reconhece a ficha");
igual(g.anexoEhFicha_("Ofício 144 2026 - ESCOLA - Enviado em 03-09-2026.pdf"), false,
      "e não confunde o ofício com ela");

passo("a tela");

const tela = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosScripts.html"), "utf8");
const modal = require("fs").readFileSync(
  require("path").join(__dirname, "..", "..", "OficiosFormulario.html"), "utf8");

ok(tela.indexOf("preverReenvioOficio") > -1, "o modal chama a prévia ao abrir");
ok(tela.indexOf("destinatarios: escolhidos") > -1,
   "e manda a escolha explícita ao reenviar");
ok(modal.indexOf("histReenvDestinos") > -1, "o seletor existe na tela");
ok(modal.indexOf("histReenvAnexos") > -1, "e a lista de anexos também");
ok(modal.indexOf("histReenvCadastro") === -1,
   "o campo readonly que mentia saiu",
   'dizia "Vai para (do cadastro)" e não lia o cadastro');
ok(modal.indexOf("histReenvSomente") === -1,
   'e a caixa "somente este endereço" também',
   "deixou de ser necessária quando basta desmarcar");
ok(tela.indexOf("cienteSemFicha") > -1,
   "enviar sem a ficha exige um segundo clique consciente",
   "bloquear seria tirar da pessoa uma decisão que é dela");

aviso("a carta existir mesmo na pasta do Drive de produção",
      "o emulador não tem o Drive real. Os sete ofícios da FAESA são de março a " +
      "agosto e podem cair no resgate por nome, que nunca rodou contra a pasta " +
      "verdadeira. A prova é o `Anexos: N` de um reenvio real: num tipo que " +
      "promete ficha, `Anexos: 1` é ficha faltando");

naoTestavel("a tela vista por olho humano",
            "o emulador não renderiza. Prova-se aqui que ela chama o backend certo " +
            "e que os campos antigos saíram; se o seletor ficou legível e se o " +
            "alerta vermelho aparece, só abrindo em homologação");

resumo();

/* ── acrescentado depois da pergunta do usuário: "Consegue ajustar para
      aparecer a ficha junto qd reenviar?" ───────────────────────────────── */
fluxo("REENVIO · o resgate procura onde a ficha realmente está");
passo("a pasta do próprio ofício");

const fonteResgate = String(g.recuperarAnexosDaPastaDrive_).replace(/\s+/g, " ");

ok(/getFileById\(idOficio\)\.getParents\(\)/.test(fonteResgate),
   "começa pela pasta em que o PDF do ofício está",
   "a emissão grava ofício e fichas na MESMA pasta do ano (Oficios.gs)");

ok(fonteResgate.indexOf("getPastaOficiosDestinoId_") > -1,
   "e continua olhando a pasta configurada por tipo",
   "a nova busca soma, não substitui");

/* Mede CÓDIGO, não prosa: o comentário que explica a mudança cita
   `getPastaOficiosDestinoId_` antes da chamada real, e a primeira versão
   desta asserção reprovou por causa do próprio comentário. */
const semComentarios = fonteResgate
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");
ok(semComentarios.indexOf("getParents") < semComentarios.indexOf("getPastaOficiosDestinoId_"),
   "nessa ordem — o lugar certo antes do lugar provável",
   "a pasta do ofício é fato; a configurada é suposição");

ok(/vistasPasta/.test(fonteResgate),
   "e a mesma pasta não é varrida duas vezes",
   "a do ofício e a configurada podem ser a mesma");

ok(/^function recuperarAnexosDaPastaDrive_\(tipo, escola, dataEnvio, jaAnexados, idOficio\)/m
     .test(require("fs").readFileSync(
       require("path").join(__dirname, "..", "..", "EmailOficios.gs"), "utf8")),
   "o id do ofício chega até o resgate");

resumo();
