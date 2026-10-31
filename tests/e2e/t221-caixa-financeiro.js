/**
 * CAIXA DE E-MAILS ÚNICA — A FINANCEIRO@ NA MESMA LISTA (30/10/2026).
 *
 * O usuário mostrou o menu com três telas de e-mail para duas caixas e
 * aprovou o mockup docs/mock-caixa-emails-unificada.png ("Monta"). Etapa 1:
 * os e-mails da financeiro@ (Gmail da conta do projeto, que a Central de
 * E-mails já lia) entram na lista da Caixa, com filtro por caixa. Backend
 * real, tela real (jsdom), Gmail FALSO com dados FICTÍCIOS.
 *
 * Prova: as conversas da financeiro@ aparecem com caixa e tipo; aviso de
 * leitura e remetente automático ficam de fora; abrir, ver anexo, mudar
 * tipo e resolver funcionam; responder só com clique, pela própria
 * conversa, com a assinatura de quem está logado; em homologação só para a
 * equipe; o Gmail não é mexido (nada lido, arquivado ou apagado); a tela
 * filtra por caixa e leva à Central antiga.
 *
 * NÃO PROVA: o Gmail de verdade (cota, tempo de leitura de 60 conversas),
 * a entrega do e-mail, a aparência.
 */
const b = require("./base");
const dom = require("./dom");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["rhzinho", g.gerarHashSenha_("Senha@2026"), "Só RH", "rh@sindeducacao.com",
  "USUARIO", "ATIVO", "NAO", "rh"]);
const TOKEN = b.logar(g, "wanderson"), T_RH = b.logar(g, "rhzinho");
g.setupVoucherModuleFase1();
const SIM = require("./vpe-simulador").instalar(g, amb);

/* ── O Gmail da financeiro@, falso ── */
const respostas = [], proibidas = [];
let seq = 0;
function blob(nome, tipo) { return { getName: () => nome, getContentType: () => tipo, getSize: () => 10, getBytes: () => [37, 80, 68, 70] }; }
function msg(de, assunto, corpo, quando, anexos) {
  const id = "M" + (++seq);
  const m = { getId: () => id, getFrom: () => de, getReplyTo: () => "", getTo: () => "financeiro@sindeducacao.com",
    getSubject: () => assunto, getDate: () => quando, getPlainBody: () => corpo,
    getAttachments: () => anexos || [],
    reply: (body, opts) => respostas.push({ id, body, opts }) };
  ["markRead", "moveToArchive", "moveToTrash", "markUnread", "star"].forEach(f => { m[f] = () => proibidas.push(f); });
  return m;
}
const agora = Date.now();
const T = [
  { id: "t1", msgs: [msg("Colégio Beta <contabil@beta.exemplo.com>", "Comprovante de desconto em folha – out/2026",
      "Segue o comprovante do mês.", new Date(agora - 3600e3), [blob("comprovante.pdf", "application/pdf")])] },
  { id: "t2", msgs: [msg("RH Gama <rh@gama.exemplo.com>", "Ofício nº 12 — relação nominal", "Segue a relação.", new Date(agora - 7200e3))] },
  { id: "t3", msgs: [msg("Fulano <fulano@x.exemplo.com>", "Lida: Envio da relação", "lida", new Date(agora - 9000e3))] },
  { id: "t4", msgs: [msg("noreply@banco.exemplo.com", "Seu extrato", "extrato", new Date(agora - 9500e3))] },
  { id: "t5", msgs: [
      msg("Wanderson <financeiro@sindeducacao.com>", "Cobrança de mensalidade", "Prezados, segue a cobrança.", new Date(agora - 86400e3)),
      msg("Escola Delta <wanderson@uvv.br>", "Re: Cobrança de mensalidade", "Vamos pagar amanhã.", new Date(agora - 4000e3))] }
];
const fake = {
  search: () => T.map(t => ({ getId: () => t.id, getMessages: () => t.msgs })),
  getThreadById: id => { const t = T.find(x => x.id === id); return t ? { getId: () => t.id, getMessages: () => t.msgs } : null; },
  getMessageById: id => { for (const t of T) for (const m of t.msgs) if (m.getId() === id) return m; return null; }
};
g.cxsGmailFinanceiro_ = () => fake;

const painelTudo = tk => {
  const p = g.caixaSecretariaPainel(tk), f = g.caixaFinanceiroItens(tk);
  p.itens = p.itens.concat(f.itens || []);
  p.porCaixa = Object.assign({}, p.porCaixa, { FINANCEIRO: (f.itens || []).filter(i => i.estado !== "RESOLVIDO").length });
  p.erroFinanceiro = f.ok ? "" : f.mensagem;
  return p;
};
b.fluxo("CAIXA DE E-MAILS · a financeiro@ na mesma lista");
b.passo("1. As conversas da financeiro@ entram, com a caixa e o tipo");
const p = painelTudo(TOKEN);
b.ok(p.ok && !p.erroFinanceiro, "o painel abre", p.mensagem || p.erroFinanceiro);
const fin = p.itens.filter(i => i.caixa === "FINANCEIRO");
const f1 = fin.find(i => i.id === "F:t1"), f2 = fin.find(i => i.id === "F:t2"), f5 = fin.find(i => i.id === "F:t5");
b.ok(f1 && f1.tipo === "FINANCEIRO" && f1.anexos === 1, "comprovante → Financeiro, com 1 anexo", JSON.stringify(f1 && [f1.tipo, f1.anexos]));
b.ok(f2 && f2.tipo === "FINANCEIRO", "relação nominal → Escolas: contribuições", f2 && f2.tipo);
b.ok(f5 && f5.de === "wanderson@uvv.br", "conversa iniciada por nós mostra quem respondeu", f5 && f5.de);
b.ok(!fin.some(i => i.id === "F:t3") && !fin.some(i => i.id === "F:t4"), "'Lida:' e remetente automático ficam de fora");
b.igual(p.porCaixa.FINANCEIRO, 3, "3 do Financeiro a tratar");

b.passo("2. Abrir, ver anexo");
const d = g.caixaSecretariaDetalhe("F:t5", TOKEN);
b.ok(d.ok && d.mensagens.length === 2, "a conversa inteira", d.mensagem);
b.ok(d.mensagens[0].nossa === true && d.mensagens[1].nossa === false, "o que nós mandamos aparece como nosso");
b.ok(/Wanderson N Castelo/.test(d.sugestao), "a resposta sugerida já vem com a assinatura de quem está logado");
const d1 = g.caixaSecretariaDetalhe("F:t1", TOKEN);
b.ok(d1.anexos.length === 1 && d1.anexos[0].disponivel, "o anexo aparece disponível");
const an = g.caixaSecretariaAnexo("F:t1", 0, TOKEN);
b.ok(an.ok && /^data:application\/pdf;base64,/.test(an.dataUrl), "e abre", an.mensagem);

b.passo("3. Mudar o tipo e resolver ficam no SISGEP");
b.ok(g.caixaSecretariaReclassificar("F:t2", "FILIACAO", TOKEN).ok, "corrige o tipo");
b.ok(g.caixaSecretariaMarcar("F:t2", "RESOLVIDO", "visto", TOKEN).ok, "marca resolvido");
const p2 = painelTudo(TOKEN);
const f2b = p2.itens.find(i => i.id === "F:t2");
b.ok(f2b && f2b.tipo === "FILIACAO" && f2b.estado === "RESOLVIDO", "e a lista mostra assim", JSON.stringify(f2b && [f2b.tipo, f2b.estado]));

b.passo("4. Responder: só com o clique, na conversa, para quem escreveu");
b.igual(respostas.length, 0, "nada saiu sozinho até aqui");
const r = g.caixaSecretariaResponder("F:t5", "Olá! Recebido, obrigado.\n\nAtenciosamente,\nWanderson", TOKEN);
b.ok(r.ok && /wanderson@uvv\.br/.test(r.mensagem), "respondeu", r.mensagem);
b.ok(respostas.length === 1 && respostas[0].id === "M6", "como resposta à última mensagem de fora");
b.igual(painelTudo(TOKEN).itens.find(i => i.id === "F:t5").estado, "RESPONDIDO", "e fica como respondido");

b.passo("5. Em homologação, só para a equipe do SISGEP");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "homologacao");
g.getAmbienteAtual._cache = undefined;
const rH = g.caixaSecretariaResponder("F:t1", "Olá! Recebido o comprovante, obrigado.", TOKEN);
b.ok(!rH.ok && /\[HML\]/.test(rH.mensagem), "para fora da equipe é bloqueado", rH.mensagem);
b.igual(respostas.length, 1, "e nada saiu");
g.PropertiesService.getScriptProperties().setProperty("SISGEP_AMBIENTE", "producao");
g.getAmbienteAtual._cache = undefined;

b.passo("6. A trava vale para a financeiro@ também");
b.ok(!g.caixaSecretariaDetalhe("F:t1", T_RH).ok, "quem só tem RH não abre");
b.ok(!g.caixaSecretariaResponder("F:t1", "tentativa de resposta indevida", T_RH).ok, "nem responde");

b.passo("6b. Cada um com a sua caixa: a Secretaria não abre a da financeiro@");
ss.getSheetByName(g.ABA_USUARIOS_LOGIN).appendRow(["marcelha", g.gerarHashSenha_("Senha@2026"), "Marcelha Aline",
  "secretaria@sindeducacao.com", "ADMINISTRADOR", "ATIVO", "NAO", ""]);
const T_SEC = b.logar(g, "marcelha");
b.ok(!g.caixaSecretariaDetalhe("F:t1", T_SEC).ok, "não abre a conversa da financeiro@");
b.igual((g.caixaFinanceiroItens(T_SEC).itens || []).length, 0, "e a lista da financeiro@ vem vazia para ela");
b.ok(!g.caixaSecretariaResponder("F:t1", "tentativa de responder pela outra caixa", T_SEC).ok, "nem responde por ela");

b.passo("7. O Gmail não é mexido");
b.igual(proibidas, [], "nada lido, arquivado, estrelado ou apagado pelo SISGEP");

b.fluxo("CAIXA DE E-MAILS · a IA classifica o Financeiro (categorias de 30/10/2026)");
b.passo("8a. A IA classifica uma vez só, guarda, e esconde propaganda");
T.push({ id: "t6", msgs: [msg("Prefeitura <nf@pref.exemplo.com>", "Documento de outubro", "Segue o documento.", new Date(agora - 600e3))] });
T.push({ id: "t7", msgs: [msg("Loja <vendas@loja.exemplo.com>", "Ofertas da semana", "Compre já.", new Date(agora - 700e3))] });
const pedidosIA = [];
g.vpeChamarIA_ = function (prompt) {
  pedidosIA.push(prompt);
  const linhas = (prompt.split("E-MAILS:\n")[1] || "").split("\n").filter(Boolean);
  return { resultados: linhas.map((l, i) => ({ i, tipo: /Documento de outubro/.test(l) ? "NOTA_FISCAL" : /Ofertas/.test(l) ? "PROPAGANDA" :
    /Comprovante/.test(l) ? "FINANCEIRO" : "OUTRO", pedido: "x" })) };
};
g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
const pIA = painelTudo(TOKEN);
b.ok(pedidosIA.length === 1 && /NOTA_FISCAL = nota fiscal de fornecedor/.test(pedidosIA[0]), "um pedido à IA, com as categorias aprovadas");
b.igual(pIA.itens.find(i => i.id === "F:t6").tipo, "NOTA_FISCAL", "a nota fiscal vai para Notas fiscais");
b.ok(!pIA.itens.some(i => i.id === "F:t7"), "propaganda não aparece na Entrada");
b.igual(pIA.itens.find(i => i.id === "F:t2").tipo, "FILIACAO", "o que a equipe corrigiu continua valendo");
g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");
painelTudo(TOKEN);
b.igual(pedidosIA.length, 1, "abrir de novo não pergunta à IA outra vez (ficou guardado)");
b.ok(Object.keys(g.CXS_TIPOS).join(",") === "VOUCHER,FILIACAO,FINANCEIRO,NOTA_FISCAL,CONTAS,JURIDICO,NEGOCIACAO,ENTIDADES,EVENTO,OUTRO",
  "as categorias aprovadas (levantamento de 60 dias), na ordem", Object.keys(g.CXS_TIPOS).join(","));
b.igual(g.cxsTipo_("CONVENCAO"), "NEGOCIACAO", "o que era Convenção aparece em Negociação e reuniões");
b.igual(g.cxsTipo_("OFICIO_ESCOLA"), "FINANCEIRO", "o que era Escola aparece em Escolas: contribuições");

/* O mesmo e-mail com cópia para a secretaria@ (o leitor também o traz). */
const thCopia = SIM.novaThread("Comprovante de desconto em folha – out/2026", "Colégio Beta <contabil@beta.exemplo.com>",
  "Segue o comprovante do mês. TIPO:FINANCEIRO");
thCopia.msgs[0].getDate = () => new Date(agora - 3600e3);   // a mesma mensagem, mesma hora
SIM.ciclo();
g.CacheService.getScriptCache().remove("cxs_fin_lista_v1");

if (!dom.jsdomDisponivel()) { b.naoTestavel("a tela", "jsdom não instalado"); b.resumo(); process.exit(process.exitCode || 0); }
const t = dom.montar(g, ["VoucherPedidosEmailUI.html", "CaixaSecretariaUI.html"], { token: TOKEN });
const doc = t.doc, win = t.win, el = id => doc.getElementById(id);
win.spIr = m => { win.__foi = m; };
(async function () {
  b.fluxo("CAIXA DE E-MAILS · a tela");
  b.passo("8. Cada um com a sua caixa (31/10/2026): o Wanderson vê só a financeiro@");
  win.cxsIniciar(); await t.assentar(150);
  const nomes = () => Array.from(doc.querySelectorAll("#cxsLista .cxs-item")).map(x => x.textContent);
  b.ok(/Caixa de E-mails — financeiro@sindeducacao\.com/.test(t.texto("#cxsTitulo")), "o título diz qual caixa", t.texto("#cxsTitulo"));
  b.ok(nomes().length && nomes().every(x => /💰 financeiro@/.test(x)), "só e-mails da financeiro@", nomes().length);
  b.ok(!nomes().some(x => /secretaria@/.test(x)), "nada da secretaria@ (nem a cópia do comprovante)");
  b.ok(!/Todas as caixas/.test(t.texto("#cxsCaixas")), "sem botão para trocar de caixa");
  b.ok(!doc.querySelector("#cxsTipos .cxs-tipo.voucher"), "voucher é da Secretaria: não aparece para ele");

  b.passo("9. Abrir uma conversa da financeiro@ diz por onde a resposta sai");
  t.clicar("[data-cxs='abrir'][data-arg='F:t1']"); await t.assentar(150);
  b.ok(el("cxsModal").classList.contains("aberto"), "a conversa abriu");
  b.ok(/pela financeiro@/.test(t.texto("#cxsMRespostaRot")), "a resposta sai pela financeiro@");

  b.passo("10. Central antiga continua a um clique");
  t.clicar("[data-cxs='centralAntiga']"); await t.assentar(10);
  b.igual(win.__foi, "centralEmailIA", "leva à Central antiga do Financeiro");

  b.naoTestavel("o Gmail de verdade e a aparência", "ver em HML");
  b.resumo();
  process.exit(process.exitCode || 0);
})();
