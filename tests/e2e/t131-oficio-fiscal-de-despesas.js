/**
 * t131 — MÓDULO 03 · O OFÍCIO FISCAL DE DESPESAS
 *
 * Frente A, oitava rodada, 01/09/2026. As duas últimas funções do Módulo 03
 * que estavam com porta e sem teste nenhum.
 *
 * POR QUE ELAS IMPORTAM HOJE, ESPECIFICAMENTE
 *
 * `gerarProximoNumeroOficioFiscal_` (Despesas_Oficio_Fiscal.gs:15) não faz
 * nada além de chamar `gerarProximoNumeroSeguro_` — a função que ficou privada
 * hoje, na quinta rodada. Se aquele rename tivesse escapado um chamador, é
 * AQUI que apareceria: o envio de documentação fiscal para a contabilidade
 * pararia de conseguir número de ofício.
 *
 * Este é o teste que o item 51 pedia como verificação nº 2.
 *
 * O QUE MAIS ESTÁ EM JOGO
 *
 * `enviarLoteDespesasComOficio` manda documento fiscal para a CONTABILIDADE.
 * Errar o destinatário, o lote ou o total não é erro de tela: é documento
 * fiscal indo para o lugar errado. E a numeração é a mesma, oficial e única,
 * dos ofícios de filiação — não existe sequência paralela.
 *
 * A PORTA É OUTRA
 *
 * Estas duas pedem o módulo FINANCEIRO, não Documentos — e faz sentido: quem
 * fecha despesa é o financeiro. Mas o número que elas consomem é o do Módulo
 * 03. É a única função fora do módulo que gasta a numeração de ofícios, e por
 * isso ela é testada aqui e não junto do resto do financeiro.
 */

const b = require("./base");
const ambiente = b.subir({});
const g = ambiente.g;
const outbox = ambiente.amb.outbox;   /* os e-mails que o emulador registrou */
b.seedUsuarios(g);

const FIN = b.logar(g, "rogerio");     /* financeiro + rh */
const SEM = b.logar(g, "joscimar");    /* escolas + sindicalizacao — sem financeiro */

function tentar(fn) {
  try { return { passou: true, valor: fn(), msg: "" }; }
  catch (e) { return { passou: false, msg: String(e.message || e) }; }
}

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* A aba Controle é onde o número do ofício nasce e onde o fiscal é anotado. */
let ctrl = ss.getSheetByName(g.PLANILHA_REGISTRO);
if (!ctrl) ctrl = ss.insertSheet(g.PLANILHA_REGISTRO);
ctrl.getRange(1, 1, 1, 10).setValues([[
  "Número do Ofício", "Data", "TIPO", "Escola", "CNPJ", "E-mail",
  "Status", "CONFIG", "Observações", "Link"]]);

/* Duas despesas de verdade na aba que o módulo financeiro usa. */
g.garantirAbaDespesas_();
const abaDesp = ss.getSheetByName(g.ABA_DESPESAS);
const cabDesp = abaDesp.getRange(1, 1, 1, abaDesp.getLastColumn()).getValues()[0];
function col(nome) { return cabDesp.indexOf(nome) + 1; }

function gravarDespesa(linha, id, prestador, valor, numero) {
  const larg = abaDesp.getLastColumn();
  const vals = new Array(larg).fill("");
  function pos(nome, v) { const c = col(nome); if (c > 0) vals[c - 1] = v; }
  pos("ID_DESPESA", id);
  pos("PRESTADOR_NOME", prestador);
  pos("VALOR", valor);
  pos("DATA_VENCIMENTO", "2026-09-30");
  pos("DESCRICAO", "Serviço de " + prestador);
  pos("NUMERO_DESPESA", numero);
  pos("CATEGORIA", "SERVICOS");
  pos("NOME_ARQUIVO", "nf-" + numero + ".pdf");
  pos("TIPO_DOC", "Nota Fiscal");
  /* Sem o FILE_ID_DOCUMENTO o anexo do documento fiscal nem é tentado —
     o teste mediria a própria falta de seed, não o sistema. */
  pos("FILE_ID_DOCUMENTO", "1DOC" + numero + "sisgepEmuladorDriveIdLongoXX".substring(0, 24));
  abaDesp.getRange(linha, 1, 1, larg).setValues([vals]);
}
gravarDespesa(2, "DESP-001", "Contabil Silva ME", "1.250,00", "NF-9001");
gravarDespesa(3, "DESP-002", "Papelaria Central", "380,50", "NF-9002");

b.fluxo("MÓDULO 03 · a prévia do ofício fiscal");

b.passo("1. as portas — módulo FINANCEIRO, não Documentos");
[["obterPreviewOficioFiscalDesp", t => g.obterPreviewOficioFiscalDesp(["DESP-001"], t)],
 ["enviarLoteDespesasComOficio", t => g.enviarLoteDespesasComOficio({ idsDespesas: ["DESP-001"] }, t)]
].forEach(function (par) {
  const semSessao = tentar(() => par[1](""));
  b.ok(!semSessao.passou, "sem sessão: " + par[0],
    semSessao.passou ? "PASSOU" : semSessao.msg.substring(0, 38));
  const semModulo = tentar(() => par[1](SEM));
  b.ok(!semModulo.passou, "sem o módulo Financeiro: " + par[0],
    semModulo.passou ? "PASSOU" : semModulo.msg.substring(0, 38));
});

b.passo("2. seleção vazia é recusada antes de qualquer trabalho");
const vazio = g.obterPreviewOficioFiscalDesp([], FIN);
b.ok(vazio && vazio.ok === false, "lista vazia é recusada", vazio && vazio.mensagem);
const naoLista = g.obterPreviewOficioFiscalDesp("DESP-001", FIN);
b.ok(naoLista && naoLista.ok === false, "e um id solto, fora de lista, também");

b.passo("3. id que não existe não vira ofício com lote vazio");
/* Sem essa trava, sairia um ofício fiscal para a contabilidade sem despesa
   nenhuma dentro. */
const fantasma = g.obterPreviewOficioFiscalDesp(["DESP-INEXISTENTE"], FIN);
b.ok(fantasma && fantasma.ok === false,
  "id inexistente é recusado", fantasma && fantasma.mensagem);

b.passo("4. a prévia junta as duas despesas e soma o total");
const prev = g.obterPreviewOficioFiscalDesp(["DESP-001", "DESP-002"], FIN);
b.ok(prev && prev.ok === true, "a prévia é gerada",
  prev && !prev.ok ? prev.mensagem : "ok");
const textoPrev = JSON.stringify(prev || {});
b.ok(/Contabil Silva ME/.test(textoPrev) && /Papelaria Central/.test(textoPrev),
  "os dois fornecedores aparecem");
b.ok(/1\.630,50|1630[.,]5/.test(textoPrev),
  "e o total soma as duas (1.250,00 + 380,50 = 1.630,50)",
  (textoPrev.match(/R\$[^"<,]{0,14}/g) || []).slice(0, 3).join(" · "));

b.passo("5. E A PRÉVIA NÃO PODE GASTAR NÚMERO — é prévia");
/* Número de ofício gasto não volta. Se a prévia consumisse um, cada olhada
   abriria um buraco na numeração oficial do sindicato. */
const antesLinhas = ctrl.getLastRow();
g.obterPreviewOficioFiscalDesp(["DESP-001"], FIN);
g.obterPreviewOficioFiscalDesp(["DESP-001"], FIN);
b.igual(ctrl.getLastRow(), antesLinhas,
  "duas prévias seguidas não escreveram linha nenhuma no Controle");

b.fluxo("MÓDULO 03 · o envio à contabilidade");

b.passo("6. O QUE ESTE TESTE EXISTE PARA PROVAR — o rename de hoje não quebrou");
/* gerarProximoNumeroOficioFiscal_ só chama gerarProximoNumeroSeguro_, que
   virou privada hoje. Se um chamador tivesse escapado, o envio pararia aqui
   com "not a function". */
b.ok(typeof g.gerarProximoNumeroOficioFiscal_ === "function",
  "a ponte para a numeração existe");
const numFiscal = tentar(() => g.gerarProximoNumeroOficioFiscal_());
b.ok(numFiscal.passou, "e roda sem erro depois do rename",
  numFiscal.passou ? String(numFiscal.valor) : "QUEBROU: " + numFiscal.msg);
b.ok(/^\d{3}\/\d{4}$/.test(String(numFiscal.valor || "")),
  "devolvendo número na forma oficial NNN/AAAA",
  String(numFiscal.valor || ""));

b.passo("7. o envio conclui e consome a numeração OFICIAL, não uma paralela");
const env = g.enviarLoteDespesasComOficio({
  idsDespesas: ["DESP-001", "DESP-002"],
  para: "contabilidade@teste.com",
  assunto: "Documentação Fiscal — teste",
  lote: "LOTE-09/2026"
}, FIN);
b.ok(env && env.ok === true, "enviarLoteDespesasComOficio conclui",
  env && !env.ok ? env.mensagem : (env && env.mensagem ? String(env.mensagem).substring(0, 46) : ""));
const numeroEnv = String((env && (env.numeroOficio || env.numero)) || "");
b.ok(/^\d{3}\/\d{4}$/.test(numeroEnv),
  "com número oficial NNN/AAAA", numeroEnv || "(sem número)");
b.ok(numeroEnv !== String(numFiscal.valor),
  "e é um número NOVO — não reaproveita o que a ponte já gastou",
  numeroEnv + " ≠ " + String(numFiscal.valor));

b.passo("8. INTEGRAÇÃO — o ofício fiscal foi anotado no Controle");
/* Se não for anotado, ele existe no e-mail da contabilidade e não existe no
   registro do sindicato — e a numeração fica com um buraco inexplicável. */
const linhasCtrl = ctrl.getDataRange().getValues();
const noControle = linhasCtrl.filter(
  l => String(l[0] || "").trim() === numeroEnv);
b.igual(noControle.length, 1, "o ofício fiscal está no Controle, uma vez só");

b.passo("9. e o e-mail saiu para a contabilidade que foi pedida");
const paraContab = outbox.filter(
  e => JSON.stringify(e || {}).indexOf("contabilidade@teste.com") >= 0);
b.ok(paraContab.length >= 1,
  "um e-mail foi endereçado a contabilidade@teste.com",
  "e-mails registrados: " + outbox.length);

b.passo("10. as duas notas fiscais vão anexadas ao e-mail");
const email = paraContab.length ? paraContab[0] : null;
const anexosEmail = (email && email.attachments) || [];
b.igual(anexosEmail.length, 2,
  "os dois documentos fiscais foram anexados",
  anexosEmail.map(a => String(a && a.getName ? a.getName() : "?")).join(" + "));

b.fluxo("MÓDULO 03 · O ACHADO — o ofício some no caminho até a contabilidade");

b.passo("11. o número oficial é gasto e registrado...");
/* Tudo isto acontece: a numeração avança, o documento é gerado, o Controle
   registra. Do lado do sindicato, o ofício 0NN/AAAA existe. */
b.ok(/^\d{3}\/\d{4}$/.test(numeroEnv), "número oficial consumido", numeroEnv);
b.ok(!!(env && env.fileIdOficio), "documento do ofício gerado e salvo no Drive",
  String((env && env.fileIdOficio) || "(nenhum)").substring(0, 20));
b.igual(noControle.length, 1, "e anotado no Controle do sindicato");

b.passo("12. ...MAS NADA DISSO CHEGA A QUEM RECEBE");
/* Provado pelo código, não só pela execução: o montarHtmlEnvioContabilidadeDesp_
   recebe (despesas, totalValor, emailRemetente) — o número do ofício não está
   entre os argumentos, então não há como ele aparecer no corpo. E o blob do
   ofício, criado logo acima, nunca entra em blobsAnexo. */
const corpoEmail = String((email && email.htmlBody) || "");
b.ok(corpoEmail.indexOf(numeroEnv) === -1,
  "o número do ofício NÃO aparece no corpo do e-mail",
  corpoEmail.indexOf(numeroEnv) >= 0 ? "apareceu — o achado mudou" : "ausente");
b.ok(!anexosEmail.some(a => /Of[íi]cio|Documentacao Fiscal/i.test(
       String(a && a.getName ? a.getName() : ""))),
  "e o documento do ofício NÃO vai anexado",
  anexosEmail.map(a => String(a && a.getName ? a.getName() : "?")).join(" + "));

const fs = require("fs"), path = require("path");
const RAIZ = require("./dom").RAIZ;
const despesas = fs.readFileSync(path.join(RAIZ, "Despesas.gs"), "utf8");
b.ok(/function montarHtmlEnvioContabilidadeDesp_\(despesas, totalValor, emailRemetente\)/
       .test(despesas),
  "confirmado no código: o construtor do corpo não recebe o número",
  "assinatura tem 3 argumentos, e nenhum é o ofício");

b.aviso(
  "o ofício fiscal existe para o sindicato e não existe para a contabilidade",
  "enviarLoteDespesasComOficio consome um número da numeração OFICIAL de " +
  "ofícios (a mesma dos ofícios de filiação — não há sequência paralela), " +
  "gera o documento, salva no Drive e registra no Controle. Mas o e-mail que " +
  "chega à contabilidade não cita o número em lugar nenhum e não leva o " +
  "documento anexado: leva só a tabela de despesas e as notas. É a mesma " +
  "forma do defeito do reenvio, que levava o ofício e deixava a carta. NÃO " +
  "corrigi: decidir se o ofício deve ir anexado, se o número deve constar no " +
  "corpo, ou se a numeração oficial deveria mesmo ser consumida aqui, é " +
  "desenho — e é decisão do usuário"
);

b.naoTestavel(
  "se a contabilidade recebe os PDFs das notas anexados",
  "o emulador registra o envio e o nome do anexo, mas não gera PDF nem " +
  "entrega e-mail. O roteiro é enviar um lote de duas despesas em " +
  "homologação e conferir se as duas notas chegam anexadas"
);

b.resumo();
