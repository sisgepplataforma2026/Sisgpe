/** E2E — Declaração de Diretor integrada a Governança, Associados e Escolas. */
const b = require("./base");
const { g } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const TOKEN_ESC = b.logar(g, "joscimar");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

function sheet(nome, cab) {
  const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (!sh.getLastRow()) sh.appendRow(cab);
  return sh;
}

sheet("Associados", g.SIND_ASS_COLUNAS).appendRow([
  "UVV", "Wanderson Nascimento Castelo", "00000000000", "S", "", "", "", "Cariacica", "",
  "(27) 99999-1234", "", "wanderson@exemplo.com", new Date(), "123", new Date(), "FICHA-1"
]);
sheet("Associados", g.SIND_ASS_COLUNAS).appendRow([
  "ESCOLA B", "Wanderson Nascimento Castelo", "00000000000", "S", "", "", "", "Vitória", "",
  "(27) 99999-1234", "", "wanderson@exemplo.com", new Date(), "123", new Date(), "FICHA-2"
]);
sheet("Escolas", ["EscolaID", "Escola (Razão Social)", "NOME_FANTASIA", "CNPJ", "E-mail (principal)",
  "E-mails (todos)", "Cidade", "UF", "Telefone 1", "Telefone 2", "SITUACAO_CADASTRAL"])
  .appendRow(["ESC-UVV", "Sociedade Educação e Gestão de Excelência", "UVV", "01.234.567/0001-89",
    "rh@uvv.br", "rh@uvv.br; dp@uvv.br", "Vila Velha", "ES", "", "", "ATIVA"]);
sheet("Escolas", []).appendRow(["ESC-B", "Escola B Ltda", "ESCOLA B", "11.222.333/0001-81",
  "rh@escolab.br", "rh@escolab.br", "Vitória", "ES", "", "", "ATIVA"]);

const pdfs = [];
g.declGerarPdf_ = p => { pdfs.push(p); return { id: "PDF-1", url: "https://drive.google.com/PDF-1" }; };

b.fluxo("DECLARAÇÕES · Governança é a fonte oficial");
const dados = g.declDadosEmissao(TOKEN);
b.ok(dados.ok && dados.diretores.length === g.GOV_COMPOSICAO.length,
  "lista vem da composição vigente", dados.diretores.length + " dirigente(s)");
const presidente = g.declSignatario_();
b.ok(presidente && presidente.nome === "LEONIL DIAS DA SILVA" && presidente.fonte === "GOVERNANCA",
  "Presidente vigente é signatário automático", presidente && presidente.nome);

b.fluxo("DECLARAÇÕES · Associados resolve vínculo e telefone");
const dir = dados.diretores.filter(d => /WANDERSON/.test(d.nome))[0];
const ctx = g.declContextoDiretor(dir.id, TOKEN);
b.ok(ctx.ok && ctx.vinculos.length === 2, "múltiplos vínculos são preservados", ctx.vinculos.length + " vínculo(s)");
const uvv = ctx.vinculos.filter(v => v.escolaId === "ESC-UVV")[0];
b.ok(uvv && uvv.escolaId === "ESC-UVV", "escola canônica encontrada", uvv && uvv.nome);
b.ok(uvv.contatos.length === 2, "contatos vêm do cadastro institucional");

b.fluxo("DECLARAÇÕES · Emissão guarda fotografia institucional");
const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
const pedido = { diretorId: dir.id, escolaId: "ESC-UVV", dataLiberacao: amanha.toISOString().slice(0, 10), periodo: "VESPERTINO" };
const previa = g.declPreviaDeclaracaoDiretor(pedido, TOKEN);
b.ok(previa.ok && previa.escola.escolaId === "ESC-UVV", "prévia exige e devolve a escola");
const semEscola = g.declPreviaDeclaracaoDiretor({ diretorId: dir.id, dataLiberacao: pedido.dataLiberacao, periodo: "" }, TOKEN);
b.ok(!semEscola.ok && /escola empregadora/i.test(semEscola.mensagem), "não escolhe vínculo silenciosamente", semEscola.mensagem);
const emitida = g.declEmitirDeclaracaoDiretor(pedido, TOKEN);
b.ok(emitida.ok && emitida.emailStatus === "AGUARDANDO_CONFERENCIA", "emite sem enviar automaticamente", emitida.numero);
const hist = g.declHistoricoDeclaracoes({}, TOKEN).itens[0];
b.ok(hist.escolaId === "ESC-UVV" && hist.gestao === g.GOV_MANDATO.gestao, "histórico congela escola e gestão");
b.ok(hist.texto === emitida.texto && pdfs.length === 1, "texto exato e PDF preservados");
const destinoInjetado = g.declEnviarEmail(emitida.numero, ["estranho@fora.br"], TOKEN);
b.ok(!destinoInjetado.ok && /não pertence/i.test(destinoInjetado.mensagem), "servidor recusa destinatário fora da conferência");
const zap = g.declPrepararWhatsapp(emitida.numero, TOKEN);
b.ok(zap.ok && /^https:\/\/wa\.me\/5527/.test(zap.url), "WhatsApp é apenas preparado");
const zapOk = g.declConfirmarWhatsapp(emitida.numero, TOKEN);
b.ok(zapOk.ok, "operador confirma a ciência depois");

b.fluxo("DECLARAÇÕES · Entrega reaberta depois de fechar a tela");
/* O cenário real: emitiu, fechou a tela, e no dia seguinte precisa enviar.
   Até 15/09/2026 não havia caminho de volta — a declaração ficava presa em
   AGUARDANDO_CONFERENCIA para sempre. */
const reaberta = g.declEntregaDeclaracao(emitida.numero, TOKEN);
b.ok(reaberta.ok && reaberta.numero === emitida.numero, "abre a entrega só pelo número", reaberta.numero);
b.ok(reaberta.escola.escolaId === "ESC-UVV" && reaberta.escola.contatos.length === 2,
  "contatos vêm congelados da linha, não de nova varredura", reaberta.escola.contatos.map(c => c.email).join(", "));
b.ok(reaberta.emailStatus === "AGUARDANDO_CONFERENCIA", "status da entrega vem junto", reaberta.emailStatus);
const foraPelaReabertura = g.declEnviarEmail(emitida.numero, ["estranho@fora.br"], TOKEN);
b.ok(!foraPelaReabertura.ok && /não pertence/i.test(foraPelaReabertura.mensagem),
  "a trava de destinatário vale também por este caminho");
const enviada = g.declEnviarEmail(emitida.numero, [reaberta.escola.contatos[0].email], TOKEN);
b.ok(enviada.ok, "envia a declaração antiga", enviada.mensagem);
const depois = g.declEntregaDeclaracao(emitida.numero, TOKEN);
b.ok(/ENVIADO/.test(depois.emailStatus) && depois.emailsUsados === reaberta.escola.contatos[0].email,
  "a linha guarda o status e o destinatário real", depois.emailStatus + " · " + depois.emailsUsados);
b.ok(g.declEntregaDeclaracao("999/2099", TOKEN).ok === false, "número inexistente é recusado");

b.fluxo("DECLARAÇÕES · Segurança");
b.bloqueia(() => g.declContextoDiretor(dir.id, TOKEN_ESC), "usuário sem Documentos não consulta vínculo");
b.bloqueia(() => g.declEmitirDeclaracaoDiretor(pedido, TOKEN_ESC), "usuário sem Documentos não emite");
b.bloqueia(() => g.declDadosEmissao("token-falso"), "token inválido é recusado");
b.bloqueia(() => g.declEntregaDeclaracao(emitida.numero, TOKEN_ESC), "usuário sem Documentos não reabre a entrega");
b.naoTestavel("PDF, Drive, Gmail e WhatsApp reais", "dependem da homologação publicada");
b.resumo();
