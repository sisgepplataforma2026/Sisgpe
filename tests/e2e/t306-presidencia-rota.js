/**
 * ÁREA DA PRESIDÊNCIA · A ROTA NA doGet (Code.gs, 27/11/2026). Rota REAL do doGet. Prova: link válido entrega a página com o link injetado; inválido/ausente/curto
 * entrega a recusa sem nenhum dado e sem o link; as rotas que já existiam (ingresso-festa, ingresso, portal=voucher, sem parâmetro) continuam
 * respondendo como antes. NÃO PROVA: o HtmlService de verdade (o emulador devolve só um marcador por arquivo; aqui o arquivo é lido do disco).
 */
const b = require("./base");
const fs = require("fs");
const { g } = b.subir({});
b.seedUsuarios(g);
const RAIZ = require("path").join(__dirname, "..", "..");
const base = g.HtmlService.createHtmlOutputFromFile;
g.HtmlService.createHtmlOutputFromFile = (f) => (fs.existsSync(RAIZ + "/" + f + ".html") ? { _h: fs.readFileSync(RAIZ + "/" + f + ".html", "utf8"), getContent() { return this._h; }, setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; }, setSandboxMode() { return this; } } : base(f));
const out = (r) => String(r && r.getContent ? r.getContent() : r);
const TOK = "t".repeat(32);
g.presRegistrarAcesso_("Presidente", TOK);
b.fluxo("PRESIDÊNCIA · rota");
const ok = out(g.doGet({ parameter: { page: "presidencia", k: TOK } }));
b.ok(ok.indexOf("Compasso da Vida 2026") > 0 && ok.indexOf("var KB='" + TOK + "'") > 0 && ok.indexOf("__PRES_K__") < 0, "link válido: entrega a página, com o link no lugar do marcador");
for (const [nome, par] of [["inválido", { page: "presidencia", k: "z".repeat(32) }], ["ausente", { page: "presidencia" }], ["curto", { page: "presidencia", k: "abc" }]]) {
  const r = out(g.doGet({ parameter: par }));
  b.ok(/não é válido/.test(r) && !/Adicionar convidados/.test(r) && r.indexOf(TOK) < 0, "link " + nome + ": só a recusa, sem botão e sem o link");
}
g.logoSindicatoVoucher_ = () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const comLogo = out(g.doGet({ parameter: { page: "presidencia", k: TOK } }));
b.ok(comLogo.indexOf('src="data:image/png;base64,iVBORw0KGgo') > 0 && comLogo.indexOf("__PRES_LOGO__") < 0, "o logo oficial vai embutido na página");
g.logoSindicatoVoucher_ = () => { throw new Error("Drive fora do ar"); };
const semLogo = out(g.doGet({ parameter: { page: "presidencia", k: TOK } }));
b.ok(semLogo.indexOf("Compasso da Vida 2026") > 0 && semLogo.indexOf('src=""') > 0 && semLogo.indexOf("__PRES_LOGO__") < 0, "se o logo falhar, a página abre do mesmo jeito (sem imagem)");
g.logoSindicatoVoucher_ = () => 'javascript:alert(1)';
b.ok(out(g.doGet({ parameter: { page: "presidencia", k: TOK } })).indexOf("javascript:") < 0, "valor que não é imagem embutida é descartado");
b.passo("as rotas que já existiam continuam iguais");
g.compassoIngressoCartao_pagina_ = (c) => ({ getContent: () => "CARTAO:" + c });
b.igual(out(g.doGet({ parameter: { page: "ingresso-festa", c: "ABC-1" } })), "CARTAO:ABC-1", "ingresso-festa chega no cartão");
g.compasso_paginaIngressoPublica_ = (t) => ({ getContent: () => "PUB:" + t });
b.igual(out(g.doGet({ parameter: { page: "ingresso", t: "T9" } })), "PUB:T9", "ingresso (token) chega na página pública");
const pv = out(g.doGet({ parameter: { portal: "voucher" } }));
b.ok(pv === fs.readFileSync(RAIZ + "/PortalVoucher.html", "utf8"), "portal=voucher continua entregando exatamente o PortalVoucher.html");
const semParam = out(g.doGet({ parameter: {} }));
b.ok(semParam.length > 0 && semParam.indexOf("Adicionar convidados") < 0, "sem parâmetro: segue o caminho de sempre (não cai na rota nova)");
b.resumo();
