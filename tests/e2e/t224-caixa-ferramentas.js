/**
 * CAIXA DE E-MAILS — AS FERRAMENTAS DA CENTRAL ANTIGA DENTRO DA CAIXA
 * (03/11/2026). Mockup aprovado: docs/mock-caixa-ferramentas-financeiro.png,
 * com o anexo ("Se eu quiser anexar?" → "Aprovo").
 *
 * Prova, com o backend real, Gmail FALSO e dados FICTÍCIOS:
 *   - a escola do e-mail é achada (pelo e-mail, pelo CNPJ), com a situação
 *     das mensalidades e os ofícios dela;
 *   - o comprovante lido pela IA é conferido com os associados da escola
 *     (quem faltou);
 *   - a resposta pela IA leva o contexto e a assinatura, e NÃO sai;
 *   - encaminhar: financeiro@ direto; secretaria@ pela fila da ponte e o
 *     leitor encaminha; em homologação só para a equipe; cada um com a sua;
 *   - anexar: do computador (fica guardado no Drive) e do SISGEP, até 20 MB;
 *   - a tela mostra as caixas e os botões, e a resposta vai com os anexos.
 *
 * NÃO PROVA: a IA de verdade (qualidade da leitura do comprovante), o Gmail
 * e o Drive de verdade, a entrega, a aparência.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
const TOKEN = b.logar(g, "wanderson"), T_SEC = b.logar(g, "marcelha");
g.setupVoucherModuleFase1();
const SIM = require("./vpe-simulador").instalar(g, amb);

/* ── O que o SISGEP sabe (fictício) ── */
const ESCOLAS = [
  { escola: "COLEGIO BETA LTDA", Fantasia: "Colégio Beta", cnpj: "11.222.333/0001-81", documentoMascarado: "11.222.333/0001-81",
    email: "contabil@beta.exemplo.com", EmailsTodos: "", cidade: "Vitória", uf: "ES", situacao: "ATIVA", EscolaID: "ESC-1" },
  { escola: "ESCOLA GAMA", Fantasia: "Gama", cnpj: "44.555.666/0001-00", documentoMascarado: "44.555.666/0001-00",
    email: "", EmailsTodos: "", cidade: "Serra", uf: "ES", situacao: "ATIVA", EscolaID: "ESC-2" }
];
g.listarEscolasCadastro_interno_ = () => ESCOLAS;
g.listarMensalidadeStatus = f => ({ ok: true, itens: f.escola === "COLEGIO BETA LTDA" ? [
  { nome: "ANA SOUZA", cpf: "11144477735", status: "CONFIRMADO" },
  { nome: "BIA LIMA", cpf: "52998224725", status: "AGUARDANDO" },
  { nome: "CAIO REIS", cpf: "39053344705", status: "PENDENTE_30D" }] : [] });
g.listarHistoricoOficios = () => ({ ok: true, itens: [
  { numero: "120/2026", tipo: "COBRANCA", status: "ENVIADO", data: "2026-10-01", cnpj: "11222333000181",
    link: "https://drive.google.com/file/d/1OFICIOabcdefghijklmnopqrstuvw/view" },
  { numero: "090/2026", tipo: "NOTIFICACAO", status: "ENVIADO", data: "2026-08-01", cnpj: "11222333000181", link: "" },
  { numero: "077/2026", tipo: "COBRANCA", status: "ENVIADO", data: "2026-09-01", cnpj: "99999999000199", link: "" }] });

/* ── O Gmail da financeiro@, falso ── */
const respostas = [], encaminhadas = [];
let seq = 0;
function blob(nome, tipo) { return { getName: () => nome, getContentType: () => tipo, getSize: () => 10, getBytes: () => [37, 80, 68, 70] }; }
function msg(de, assunto, corpo, quando, anexos) {
  const id = "FM" + (++seq);
  return { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com",
    getSubject: () => assunto, getDate: () => quando, getPlainBody: () => corpo, getAttachments: () => anexos || [],
    reply: (body, opts) => respostas.push({ id, body, opts }),
    forward: (para, opts) => encaminhadas.push({ id, para, opts }) };
}
const agora = Date.now();
const T = [
  { id: "t1", msgs: [msg("Colégio Beta <contabil@beta.exemplo.com>", "Comprovante de desconto em folha – out/2026",
      "Segue o comprovante do mês.", new Date(agora - 3600e3), [blob("comprovante.pdf", "application/pdf")])] },
  { id: "t2", msgs: [msg("Contador <contador@outro.exemplo.com>", "Dúvida sobre a taxa", "Da escola CNPJ 44.555.666/0001-00, qual o valor?",
      new Date(agora - 7200e3))] },
  { id: "t3", msgs: [msg("Fulano <fulano@x.exemplo.com>", "Pergunta", "Sem escola nenhuma aqui.", new Date(agora - 8000e3))] }
];
const fake = {
  search: () => T.map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; }
};
g.cxsGmailFinanceiro_ = () => fake;
g.vpeChamarIA_ = () => ({ resultados: [] });   // a classificação da lista: tudo OUTRO
g.caixaFinanceiroItens(TOKEN);                  // a lista (cria as pseudo-linhas F:)

b.fluxo("CAIXA · as ferramentas da Central antiga");
b.passo("1. A escola no SISGEP");
const c1 = g.caixaContexto("F:t1", TOKEN);
b.ok(c1.ok && c1.escola && c1.escola.nome === "COLEGIO BETA LTDA", "achou a escola", JSON.stringify(c1));
b.ok(/pelo e-mail de quem escreveu/.test(c1.escola.origem), "e diz por onde achou (origem à vista)", c1.escola.origem);
b.ok(c1.mensalidade && c1.mensalidade.total === 3 && c1.mensalidade.CONFIRMADO === 1 && c1.mensalidade.PENDENTE_30D === 1,
  "a situação das mensalidades, contada", JSON.stringify(c1.mensalidade));
b.ok(!("nomes" in c1.mensalidade), "sem a lista de nomes e CPFs na tela de contexto");
b.igual(c1.oficios.map(o => o.numero), ["120/2026", "090/2026"], "os ofícios só desta escola, do mais novo");
b.igual(c1.oficios[0].fileId, "1OFICIOabcdefghijklmnopqrstuvw", "com o arquivo para anexar");
const c2 = g.caixaContexto("F:t2", TOKEN);
b.ok(c2.ok && c2.escola && c2.escola.nome === "ESCOLA GAMA" && /CNPJ/.test(c2.escola.origem), "pelo CNPJ citado no texto", JSON.stringify(c2.escola));
const c3 = g.caixaContexto("F:t3", TOKEN);
b.ok(c3.ok && c3.escola === null, "sem escola: diz que não achou, não inventa");

b.passo("2. O comprovante lido pela IA, conferido com os associados");
let pedidoComp = null;
g.vpeChamarIA_ = (prompt, blocos) => { pedidoComp = { prompt, blocos };
  return { e_comprovante: true, tipo: "MENSALIDADE", escola: "Colégio Beta", mes: "10", ano: "2026", valor: "R$ 150,00",
           quantidade: 2, pessoas: [{ nome: "Ana Souza", cpf: "111.444.777-35" }, { nome: "BIA LIMA", cpf: "" }] }; };
const lc = g.caixaLerComprovante("F:t1", TOKEN);
b.ok(lc.ok && lc.comprovante, "leu", lc.mensagem);
b.ok(pedidoComp.blocos.length === 1 && pedidoComp.blocos[0].type === "document", "mandou o PDF anexo para a IA");
b.igual(lc.comprovante.referencia, "10/2026", "mês/ano");
b.igual([lc.comprovante.quantidade, lc.comprovante.esperado], [2, 3], "2 no comprovante, 3 associados da escola");
b.igual(lc.comprovante.faltaram, ["CAIO REIS"], "quem faltou (por CPF ou pelo nome)");
g.vpeChamarIA_ = () => ({ e_comprovante: false });
b.ok(g.caixaLerComprovante("F:t3", TOKEN).comprovante === null, "e-mail que não é comprovante: nada");

b.passo("3. A resposta pela IA: com o contexto, a assinatura, e não sai");
let pedidoResp = "";
g.vpeChamarIA_ = p => { pedidoResp = p; return { resposta: "Prezados, recebemos o comprovante de outubro." }; };
const sr = g.caixaSugerirResposta("F:t1", TOKEN);
b.ok(sr.ok && /^Prezados, recebemos/.test(sr.texto), "veio o texto", sr.mensagem);
b.ok(/Wanderson N Castelo/.test(sr.texto), "com a assinatura de quem está logado");
b.ok(/COLEGIO BETA LTDA/.test(pedidoResp) && /Associados da escola na mensalidade: 3/.test(pedidoResp) && /120\/2026/.test(pedidoResp),
  "a IA recebeu o que o SISGEP sabe");
b.ok(/ES000256\/2026/.test(pedidoResp), "e a regra de citar a CCT pelo MTE");
b.igual(respostas.length + encaminhadas.length, 0, "nada saiu sozinho");
g.vpeChamarIA_ = () => ({ resposta: "" });
b.ok(!g.caixaSugerirResposta("F:t1", TOKEN).ok, "IA sem texto: avisa, não manda vazio");

b.passo("4. Encaminhar (financeiro@): só com o clique");
b.ok(!g.caixaEncaminhar("F:t1", "nao-e-email", "", TOKEN).ok, "e-mail inválido é recusado");
const ef = g.caixaEncaminhar("F:t1", "contador@sindeducacao.com", "Para conferir.", TOKEN);
b.ok(ef.ok && encaminhadas.length === 1 && encaminhadas[0].para === "contador@sindeducacao.com" && encaminhadas[0].id === "FM1",
  "encaminhou a mensagem", ef.mensagem);
b.ok(/Para conferir\./.test(encaminhadas[0].opts.htmlBody) && /Wanderson N Castelo/.test(encaminhadas[0].opts.htmlBody), "com a nota e a assinatura");
b.ok(!g.caixaEncaminhar("F:t1", "x@y.com", "", T_SEC).ok, "a Secretaria não encaminha pela caixa do Financeiro");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual._cache = undefined;
const eh = g.caixaEncaminhar("F:t1", "alguem@fora.exemplo.com", "", TOKEN);
b.ok(!eh.ok && /\[HML\]/.test(eh.mensagem), "em homologação, para fora da equipe, é bloqueado", eh.mensagem);
b.igual(encaminhadas.length, 1, "e nada saiu");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "producao");
g.getAmbienteAtual._cache = undefined;

b.passo("5. Anexar: do computador e do SISGEP, até 20 MB");
const pdfB64 = Buffer.from("%PDF-1.4 recibo").toString("base64");
const ra = g.caixaSecretariaResponder("F:t1", "Prezados, segue o recibo e o ofício.", {
  sugerido: "", anexos: [{ nome: "recibo.pdf", tipo: "application/pdf", base64: pdfB64 }],
  anexosSisgep: ["1OFICIOabcdefghijklmnopqrstuvw"] }, TOKEN);
b.ok(ra.ok && /2 anexo/.test(ra.mensagem), "respondeu com 2 anexos", ra.mensagem);
b.igual(respostas.length, 1, "uma resposta");
b.igual((respostas[0].opts.attachments || []).length, 2, "com os dois arquivos");
const comRecibo = ss.getSheets().filter(sh => /Auditoria|LOG/i.test(sh.getName()) &&
  /com 2 anexo\(s\): recibo\.pdf/.test(JSON.stringify(sh.getDataRange().getValues())));
b.ok(comRecibo.length > 0, "a auditoria guarda o nome dos anexos", ss.getSheets().map(sh => sh.getName()).filter(n => /Auditoria|LOG/i.test(n)).join(","));
const grande = Buffer.alloc(21 * 1024 * 1024).toString("base64");
const rg = g.caixaSecretariaResponder("F:t2", "Prezados, segue um arquivo grande demais.", {
  anexos: [{ nome: "grande.pdf", tipo: "application/pdf", base64: grande }] }, TOKEN);
b.ok(!rg.ok && /20 MB/.test(rg.mensagem), "mais de 20 MB é recusado", rg.mensagem);
b.igual(respostas.length, 1, "e nada saiu");
const rx = g.caixaSecretariaResponder("F:t2", "Prezados, segue um programa.", {
  anexos: [{ nome: "programa.exe", tipo: "application/x-msdownload", base64: pdfB64 }] }, TOKEN);
b.ok(!rx.ok && /não aceito/.test(rx.mensagem), "programa (.exe) é recusado no clique", rx.mensagem);
b.igual(respostas.length, 1, "e nada saiu");

b.fluxo("CAIXA · encaminhar e anexar pela secretaria@ (fila da ponte)");
b.passo("6. A Marcelha encaminha; o leitor encaminha pela conta da Secretaria");
const th = SIM.novaThread("Comprovante Escola Gama", "Gama <rh@gama.exemplo.com>", "Segue. TIPO:FINANCEIRO");
SIM.ciclo();
const pSec = g.caixaSecretariaPainel(T_SEC);
const itSec = pSec.itens.find(i => i.caixa === "SECRETARIA" && /Escola Gama/.test(i.assunto || ""));
b.ok(itSec, "o e-mail está na Caixa da Secretaria", pSec.mensagem);
b.ok(!g.caixaEncaminhar(itSec.id, "x@sindeducacao.com", "", TOKEN).ok, "o Wanderson não encaminha pela caixa da Secretaria");
const es = g.caixaEncaminhar(itSec.id, "juridico@sindeducacao.com", "Ver com o jurídico.", T_SEC);
b.ok(es.ok && /fila da Secretaria/.test(es.mensagem), "entrou na fila", es.mensagem);
const shSaida = SIM.aba("Saida");
const cab = shSaida.getRange(1, 1, 1, shSaida.getLastColumn()).getValues()[0].map(String);
const linhas = shSaida.getDataRange().getValues().slice(1);
const linhaEnc = linhas.find(l => String(l[cab.indexOf("ENCAMINHAR_PARA")]) === "juridico@sindeducacao.com");
b.ok(linhaEnc, "a linha da fila diz para quem encaminhar");
const antes = amb.outbox.length;
SIM.ciclo();
const saiu = amb.outbox.slice(antes).find(o => o.via === "forward");
b.ok(saiu && saiu.to === "juridico@sindeducacao.com" && /Ver com o jurídico/.test(saiu.htmlBody || ""), "o leitor encaminhou, com a nota",
  JSON.stringify(amb.outbox.slice(antes)));
b.ok(!amb.outbox.slice(antes).some(o => o.via === "reply"), "e não respondeu ao remetente no lugar");
void th;

b.passo("7. Resposta da secretaria@ com anexo vai com os ids do Drive na fila");
const rs = g.caixaSecretariaResponder(itSec.id, "Prezados, segue o documento pedido.", {
  anexos: [{ nome: "documento.pdf", tipo: "application/pdf", base64: pdfB64 }] }, T_SEC);
b.ok(rs.ok && /1 anexo/.test(rs.mensagem), "na fila, com 1 anexo", rs.mensagem);
const linhas2 = shSaida.getDataRange().getValues().slice(1);
const ult = linhas2[linhas2.length - 1];
b.ok(String(ult[cab.indexOf("ANEXOS_FILE_IDS")]).length > 10, "o id do arquivo vai na linha da fila", String(ult[cab.indexOf("ANEXOS_FILE_IDS")]));

b.passo("8. Memória do robô: comprovante lido e encaminhamento ficaram guardados");
const mem = ss.getSheetByName("Robo_Memoria").getDataRange().getValues().map(l => l[1]);
b.ok(mem.indexOf("comprovante-lido") > -1 && mem.indexOf("encaminhar-email") > -1, "as duas tarefas registradas");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
g.vpeChamarIA_ = p => /comprovante/i.test(p) && /e_comprovante/.test(p)
  ? { e_comprovante: true, mes: "10", ano: "2026", valor: "R$ 150,00", quantidade: 2, pessoas: [] }
  : /resposta/.test(p) && /CONVERSA/.test(p) ? { resposta: "Texto escrito pela IA." } : { resultados: [] };
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
(async function () {
  b.fluxo("CAIXA · as ferramentas na tela");
  win.cxsIniciar(); await t.assentar(150);
  t.clicar("[data-cxs='abrir'][data-arg='F:t1']"); await t.assentar(200);
  b.ok(el("cxsModal").classList.contains("aberto"), "a conversa abriu");
  b.passo("9. As caixas da escola e do comprovante aparecem");
  b.ok(/COLEGIO BETA LTDA|Colégio Beta/.test(t.texto("#cxsMEscola")), "a escola", t.texto("#cxsMEscola"));
  b.ok(/10\/2026/.test(t.texto("#cxsMComprovante")), "o comprovante lido", t.texto("#cxsMComprovante"));
  b.passo("10. ✨ resposta pela IA preenche o campo, sem enviar");
  const nResp = respostas.length;
  t.clicar("[data-cxs='sugerirIA']"); await t.assentar(150);
  b.ok(/Texto escrito pela IA/.test(el("cxsMResposta").value), "o campo ganhou o texto da IA", el("cxsMResposta").value.slice(0, 80));
  b.igual(respostas.length, nResp, "e nada saiu");
  b.passo("11. 📎 anexar do SISGEP: o ofício da escola entra na lista");
  t.clicar("[data-cxs='anexarSisgep']"); await t.assentar(50);
  const botOf = doc.querySelector("#cxsMSisgepLista [data-cxs='anexarOficio']");
  b.ok(botOf, "aparece o ofício 120/2026 para anexar", t.texto("#cxsMSisgepLista"));
  if (botOf) { botOf.click(); await t.assentar(30); }
  b.ok(/120\/2026/.test(t.texto("#cxsMAnexosResp")), "e vai para os anexos da resposta", t.texto("#cxsMAnexosResp"));
  b.passo("12. ↪ encaminhar abre o campo");
  t.clicar("[data-cxs='encaminharAbrir']"); await t.assentar(30);
  b.ok(el("cxsMEncaminhar") && el("cxsMEncaminhar").style.display !== "none", "o campo de encaminhar aparece");
  b.passo("13. Enviar a resposta leva o anexo do SISGEP");
  t.clicar("[data-cxs='responder']"); await t.assentar(200);
  const ultR = respostas[respostas.length - 1];
  b.ok(respostas.length === nResp + 1 && (ultR.opts.attachments || []).length === 1, "respondeu com o anexo", respostas.length - nResp);
  b.naoTestavel("a IA, o Gmail e o Drive de verdade; a aparência", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
