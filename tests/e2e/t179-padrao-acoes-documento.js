/**
 * TESTE — AS QUATRO AÇÕES DE DOCUMENTO TÊM UM PADRÃO SÓ
 *
 * "Precisamos de um padrão" e "não pode cada módulo ter um padrão diferente"
 * — o usuário, 16/09/2026, olhando o certificado de bolsa gerado.
 *
 * O QUE ELE VIU. As mesmas quatro ações existiam em três módulos com quatro
 * vocabulários:
 *
 *   abrir/baixar  "Abrir documento" · "Abrir / Baixar PDF" · "Baixar PDF"
 *   e-mail        "Enviar por e-mail" · "Enviar agora" · "Enviar e-mail agora"
 *   whatsapp      "Abrir WhatsApp" · "Preparar WhatsApp" · "WhatsApp"
 *
 * E em Bolsas duas delas vinham COLADAS num botão só, "📧 E-mail / 📱
 * WhatsApp" — quem procura "WhatsApp" precisava interpretar um rótulo
 * composto para achar.
 *
 * O PADRÃO, definido por ele:
 *   📄 Abrir / Baixar PDF   🖨 Imprimir   📧 Enviar e-mail   💬 WhatsApp
 *
 * ESTE TESTE COBRE SÓ BOLSAS, de propósito. "Não posso estragar o que
 * funciona" — Ofícios é a única operação viva do sindicato e Declarações
 * acabou de mudar. O padrão se prova aqui antes de ser espalhado; quando os
 * outros dois forem alinhados, eles entram nesta mesma varredura.
 */
const fs = require("fs");
const path = require("path");
const b = require("./base");

const RAIZ = path.join(__dirname, "..", "..");
const painel = fs.readFileSync(path.join(RAIZ, "Scripts_Certificado.html"), "utf8");

b.fluxo("PADRÃO · As quatro ações do documento, em Bolsas");

const PADRAO = [
  ["certDocBaixar",   "📄 Abrir / Baixar PDF"],
  ["certDocImprimir", "🖨 Imprimir"],
  ["certDocEnviar",   "📧 Enviar e-mail"],
  ["certDocZap",      "💬 WhatsApp"]
];

PADRAO.forEach(function (par) {
  const id = par[0], rotulo = par[1];
  const re = new RegExp('id="' + id + '"[^>]*>' + rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "<");
  b.ok(re.test(painel.replace(/\s+/g, " ")), "`" + id + "` usa o rótulo do padrão: " + rotulo);
});

/* A ORDEM IMPORTA. Quem usa três módulos decora a posição antes do texto —
   botão que troca de lugar entre telas custa mais do que rótulo diferente. */
const pos = PADRAO.map(function (par) { return painel.indexOf('id="' + par[0] + '"'); });
b.ok(pos.every(function (p) { return p > -1; }), "os quatro botões existem na tela");
b.ok(pos[0] < pos[1] && pos[1] < pos[2] && pos[2] < pos[3],
  "e na ordem do padrão: abrir, imprimir, e-mail, whatsapp", pos.join(" < "));

/* O rótulo composto que o usuário apontou não pode voltar.

   SEM OS COMENTÁRIOS: o cabeçalho do próprio bloco CITA os rótulos antigos
   para explicar a decisão, e a primeira versão destas asserções reprovou por
   causa da própria documentação. Procurar no HTML cru transformaria "explicar
   o porquê" em erro de teste — e aí a saída seria apagar a explicação, que é
   o oposto do que este projeto quer. */
const semComentarios = painel.replace(/<!--[\s\S]*?-->/g, "");

b.ok(!/E-mail \/ .{0,3} ?WhatsApp/.test(semComentarios),
  "o botão que colava duas ações num rótulo só não existe mais");
b.ok(!/⬇ Baixar PDF/.test(semComentarios), "nem o rótulo antigo de baixar");
b.ok(!/Enviar por e-mail/.test(semComentarios), "nem o de e-mail");
b.ok(!/Abrir WhatsApp/.test(semComentarios), "nem o de WhatsApp");

/* O BOTÃO NOVO PRECISA ESTAR LIGADO. Rótulo bonito em botão morto é pior do
   que rótulo feio em botão que funciona. */
b.ok(/g\('certDocZap'\)[\s\S]{0,80}addEventListener\('click'/.test(painel),
  "o botão de WhatsApp tem handler ligado");
b.ok(/certDocZap'\)\.style\.display = emitido/.test(painel.replace(/g_\(/g, "(")),
  "e aparece junto com os outros, só depois de o certificado existir");

b.naoTestavel("Ofícios e Declarações seguindo o mesmo padrão",
  "ainda não alinhados — Ofícios é operação viva e espera o padrão provar-se aqui");
b.resumo();
