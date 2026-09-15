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

b.fluxo("DECLARAÇÕES · A lista serve para achar gente, não para ler hierarquia");
const nomes = dados.diretores.map(d => d.nome);
b.ok(nomes.join("|") === nomes.slice().sort((a, x) => a.localeCompare(x, "pt-BR")).join("|"),
  "dirigentes vêm em ordem alfabética", nomes[0] + " … " + nomes[nomes.length - 1]);

b.fluxo("DECLARAÇÕES · Data passada AVISA, não bloqueia");
/* Decisão do usuário em 15/09/2026: regularizar liberação já ocorrida é caso
   real; recusar empurraria a pessoa para fora do sistema. */
const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
const retro = { diretorId: dir.id, escolaId: "ESC-UVV", periodo: "", dataLiberacao: ontem.toISOString().slice(0, 10) };
const previaRetro = g.declPreviaDeclaracaoDiretor(retro, TOKEN);
b.ok(previaRetro.ok, "a prévia monta mesmo com data passada");
b.ok((previaRetro.avisos || []).some(a => /já passou/i.test(a)), "mas avisa que a data já passou",
  (previaRetro.avisos || [])[0]);
b.ok(g.declEmitirDeclaracaoDiretor(retro, TOKEN).ok, "e a emissão sai assim mesmo");
b.ok(!(g.declPreviaDeclaracaoDiretor(pedido, TOKEN).avisos || []).length,
  "data futura não gera aviso nenhum");

b.fluxo("DECLARAÇÕES · O número segue a DATA DE EMISSÃO");
/* Documento datado de 2025 com número 00X/2026 é o que alguém vai conferir
   daqui a dois anos — e não vai fechar. */
const outroAno = g.declEmitirDeclaracaoDiretor({
  diretorId: dir.id, escolaId: "ESC-UVV", periodo: "",
  dataLiberacao: amanha.toISOString().slice(0, 10),
  dataEmissao: "2025-11-20", confirmado: true
}, TOKEN);
b.ok(outroAno.ok && /\/2025$/.test(outroAno.numero), "emitida com data de 2025 numera em 2025", outroAno.numero);
b.ok(/^001\//.test(outroAno.numero), "e começa a sequência daquele ano", outroAno.numero);
b.ok((g.declPreviaDeclaracaoDiretor({
  diretorId: dir.id, escolaId: "ESC-UVV", periodo: "",
  dataLiberacao: amanha.toISOString().slice(0, 10), dataEmissao: "2025-11-20"
}, TOKEN).avisos || []).some(a => /2025/.test(a)), "e a prévia avisa disso antes");

b.fluxo("DECLARAÇÕES · Conferir configuração pela tela");
/* O diagnóstico do servidor termina com "_", e o editor do Apps Script
   esconde função assim — rodar exigia invólucro colado à mão. */
const conf = g.declConferirConfiguracao(TOKEN);
b.ok(conf.ok, "o endpoint responde");
b.ok(conf.signatario.ok && /LEONIL/.test(conf.signatario.texto), "diz quem assina", conf.signatario.texto);
b.ok(conf.dirigentes.ok && /\d+ dirigente/.test(conf.dirigentes.texto), "e quantos estão habilitados", conf.dirigentes.texto);
b.ok(conf.pasta.ok === false && /SISGEP_PASTA_DECLARACOES/.test(conf.pasta.detalhe),
  "e aponta a pasta que falta, dizendo a propriedade exata");
b.ok(conf.pronto === false, "com pasta faltando, não se declara pronto");

b.fluxo("DECLARAÇÕES · O mandato se confere contra o DIA DA LIBERAÇÃO");
/* A checagem antiga perguntava se a gestão está de pé HOJE — outra pergunta.
   Uma liberação marcada para depois do término passava, e a declaração
   afirmaria algo que não seria verdade naquele dia. */
const depoisDoMandato = new Date(g.declSoData_(g.GOV_MANDATO.termino).getTime() + 86400000);
const foraDoMandato = g.declPreviaDeclaracaoDiretor({
  diretorId: dir.id, escolaId: "ESC-UVV", periodo: "",
  dataLiberacao: depoisDoMandato.toISOString().slice(0, 10)
}, TOKEN);
b.ok(!foraDoMandato.ok && /depois do término do mandato/i.test(foraDoMandato.mensagem),
  "liberação depois do término é recusada", foraDoMandato.mensagem);
const antesDaPosse = new Date(g.declSoData_(g.GOV_MANDATO.posse).getTime() - 86400000);
const foraAntes = g.declPreviaDeclaracaoDiretor({
  diretorId: dir.id, escolaId: "ESC-UVV", periodo: "",
  dataLiberacao: antesDaPosse.toISOString().slice(0, 10)
}, TOKEN);
b.ok(!foraAntes.ok && /antes da posse/i.test(foraAntes.mensagem),
  "liberação antes da posse é recusada", foraAntes.mensagem);
b.ok(g.declPreviaDeclaracaoDiretor(pedido, TOKEN).ok,
  "dentro do mandato segue passando");

b.fluxo("DECLARAÇÕES · Dirigente sem vínculo escolhe a escola à mão");
/* O vínculo liga Governança a Associados por nome idêntico. Quem não casa
   ficava SEM NENHUMA escola e sem emitir — no Word sempre deu para fazer. */
const semVinculo = dados.diretores.filter(d => !/WANDERSON/.test(d.nome))[0];
const ctxVazio = g.declContextoDiretor(semVinculo.id, TOKEN);
b.ok(ctxVazio.ok && ctxVazio.vinculos.length === 0, "de fato não tem vínculo em Associados", semVinculo.nome);
const busca = g.declBuscarEscolas("UVV", semVinculo.id, TOKEN);
b.ok(busca.ok && busca.escolas.length > 0, "a busca no cadastro acha a escola", busca.escolas.length + " resultado(s)");
b.ok(busca.escolas[0].vinculoOrigem === "Escolhida manualmente", "e vem marcada como manual");
b.ok(g.declBuscarEscolas("U", semVinculo.id, TOKEN).escolas.length === 0, "termo curto demais não busca");
const manual = g.declEmitirDeclaracaoDiretor({
  diretorId: semVinculo.id, escolaId: busca.escolas[0].escolaId,
  dataLiberacao: amanha.toISOString().slice(0, 10), periodo: "MATUTINO"
}, TOKEN);
b.ok(manual.ok, "emite com a escola escolhida à mão", manual.numero);
const linhaManual = g.declHistoricoDeclaracoes({ busca: manual.numero }, TOKEN).itens[0];
b.ok(linhaManual.vinculoOrigem === "Escolhida manualmente",
  "e a origem manual fica GRAVADA, não escondida", linhaManual.vinculoOrigem);
b.ok(g.declEmitirDeclaracaoDiretor({
  diretorId: semVinculo.id, escolaId: "ESC-QUE-NAO-EXISTE",
  dataLiberacao: amanha.toISOString().slice(0, 10), periodo: ""
}, TOKEN).ok === false, "escola inventada continua sendo recusada");

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

b.fluxo("DECLARAÇÕES · O texto não nomeia o cargo de cada um");
/* Decisão do usuário em 15/09/2026: o art. 543 não distingue cargo, e o cargo
   exato envelhece — numa remodelação de diretoria o papel assinado passaria a
   divergir da composição. */
b.ok(/diretor desta Entidade Sindical/.test(emitida.texto), "o texto diz \"diretor\", fixo", emitida.texto.slice(0, 90));
b.ok(!/conselheiro/i.test(emitida.texto), "e não o cargo da pessoa");
b.ok(g.declHistoricoDeclaracoes({ busca: emitida.numero }, TOKEN).itens[0].cargo,
  "mas o cargo continua GRAVADO, para o histórico",
  g.declHistoricoDeclaracoes({ busca: emitida.numero }, TOKEN).itens[0].cargo);

b.fluxo("DECLARAÇÕES · Pré-visualizar não grava nada");
const antesDaPrevia = g.declHistoricoDeclaracoes({}, TOKEN).total;
const doc = g.declPreviaDocumento(pedido, TOKEN);
b.ok(doc.ok && /DECLARAÇÃO/.test(doc.html), "devolve o documento montado");
b.ok(/PRÉVIA/.test(doc.html), "numerado como PRÉVIA");
b.ok(g.declHistoricoDeclaracoes({}, TOKEN).total === antesDaPrevia, "e o histórico não cresceu");
b.ok(g.declPreviaDocumento({ diretorId: dir.id, periodo: "" }, TOKEN).ok === false,
  "pedido incompleto é recusado igual à emissão");

b.fluxo("DECLARAÇÕES · Segurança");
b.bloqueia(() => g.declContextoDiretor(dir.id, TOKEN_ESC), "usuário sem Documentos não consulta vínculo");
b.bloqueia(() => g.declEmitirDeclaracaoDiretor(pedido, TOKEN_ESC), "usuário sem Documentos não emite");
b.bloqueia(() => g.declDadosEmissao("token-falso"), "token inválido é recusado");
b.bloqueia(() => g.declEntregaDeclaracao(emitida.numero, TOKEN_ESC), "usuário sem Documentos não reabre a entrega");
b.bloqueia(() => g.declConferirConfiguracao(TOKEN_ESC), "usuário sem Documentos não confere a configuração");
b.bloqueia(() => g.declPreviaDocumento(pedido, TOKEN_ESC), "usuário sem Documentos não pré-visualiza");
b.naoTestavel("PDF, Drive, Gmail e WhatsApp reais", "dependem da homologação publicada");
b.resumo();
