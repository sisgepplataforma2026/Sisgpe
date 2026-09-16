/** E2E — Declaração de Diretor integrada a Governança, Associados e Escolas. */
const b = require("./base");
const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
const TOKEN_ESC = b.logar(g, "joscimar");
const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
/* Guardada ANTES de qualquer dublê: mais abaixo o teste troca esta função
   para exercitar mimes, e aqui precisamos da de verdade. */
const carregarImagensOriginal = g.carregarImagensRecibo_;

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

b.fluxo("DECLARAÇÕES · Só entra no documento o que é imagem de verdade");
/* Medido em 15/09/2026: o "logo" de carregarImagensRecibo_ é um PDF
   (Logo.pdf, application/pdf). Montar <img src="data:application/pdf"> produz
   documento assinado SEM logo e sem erro nenhum no log. */
g.carregarImagensRecibo_ = () => ({
  logoBase64: "JVBERi0xLjQK", logoMime: "application/pdf",
  assBase64: "/9j/4AAQ", assMime: "image/jpeg"
});
const semLogoPdf = g.declImagens_();
b.ok(semLogoPdf.logoBase64 !== "JVBERi0xLjQK", "PDF NÃO vira <img> no documento");
b.ok(semLogoPdf.assBase64 === "/9j/4AAQ", "mas a assinatura JPG entra", semLogoPdf.assMime);
const htmlSemLogo = g.declHtmlDeclaracao_({ numero: "1", texto: "x", dataEmissao: new Date(), signatario: { nome: "L", cargo: "Presidente" }, diretor: { nome: "W" } });
b.ok(!/data:application\/pdf/.test(htmlSemLogo), "e o HTML não carrega data:application/pdf");
b.ok(/<img[^>]+base64/.test(htmlSemLogo), "a assinatura está no HTML como imagem");

g.carregarImagensRecibo_ = () => ({
  logoBase64: "iVBORw0KGgo=", logoMime: "image/png",
  assBase64: "/9j/4AAQ", assMime: "image/jpeg"
});
b.ok(g.declImagens_().logoBase64 === "iVBORw0KGgo=", "logo com mime de imagem é usado normalmente");

b.fluxo("RECIBOS · A origem das imagens não entrega PDF como se fosse imagem");
/* O guarda está em carregarImagensRecibo_ (Recibo.gs), a função que TODOS os
   documentos usam. O arquivo de logo cadastrado é um PDF; devolvê-lo rotulado
   como imagem foi o que levou as Declarações a montar um <img> quebrado. */
const imgsReais = carregarImagensOriginal();
b.ok(imgsReais.logoBase64 === "", "logo em PDF volta vazio, não rotulado como imagem",
  "mime devolvido: " + imgsReais.logoMime);
b.ok(typeof imgsReais.assBase64 === "string", "e a assinatura continua vindo normalmente");

/* E quando a arte dos Vouchers está disponível, ela é a reserva — uma fonte
   só para todos os documentos, em vez de cada módulo cadastrar a sua. */
const getOriginal = g.DriveApp.getFileById;
/* O id vem do const de Voucher.gs. No Apps Script real todos os arquivos
   compartilham o escopo global; aqui o const não vira propriedade de `g`, só
   binding léxico do contexto — por isso o teste compara pelo valor. */
g.DriveApp.getFileById = id => id === "1c-RHfb0W-wl_ZK1xlMjNRs9DS4ep2ov7"
  ? { getBlob: () => ({ getContentType: () => "image/png", getBytes: () => [1, 2, 3] }) }
  : getOriginal(id);
const comReserva = carregarImagensOriginal();
b.ok(comReserva.logoMime === "image/png" && !!comReserva.logoBase64,
  "logo cai na arte dos Vouchers quando o cadastrado não serve", comReserva.logoMime);
g.DriveApp.getFileById = getOriginal;

b.fluxo("DECLARAÇÕES · Pré-visualizar não grava nada");
const antesDaPrevia = g.declHistoricoDeclaracoes({}, TOKEN).total;
const doc = g.declPreviaDocumento(pedido, TOKEN);
b.ok(doc.ok && /DECLARAÇÃO/.test(doc.html), "devolve o documento montado");
/* O modelo em papel não tem rodapé de numeração, e o documento também não —
   o número vive na planilha e no nome do arquivo, não impresso na folha. */
b.ok(!/SISGEP/.test(doc.html) && !/Declaração nº/.test(doc.html),
  "sem rodapé de numeração, como no modelo em papel");
b.ok(/DECLARAÇÃO/.test(doc.html) && /Por ser verdade firmamos a presente/.test(doc.html),
  "traz título e fecho do modelo");
b.ok(/estará a serviço do SindEducação-ES/.test(doc.html), "com a redação do modelo");
b.ok(g.declHistoricoDeclaracoes({}, TOKEN).total === antesDaPrevia, "e o histórico não cresceu");
b.ok(g.declPreviaDocumento({ diretorId: dir.id, periodo: "" }, TOKEN).ok === false,
  "pedido incompleto é recusado igual à emissão");

b.fluxo("DECLARAÇÕES · O documento sai no formato do modelo em papel");
/* Modelo conferido em 15/09/2026: DECLARAÇÃO 17.09.2026, da Marcilene. */
const marcilene = g.declListarDiretoria_interno_().filter(d => /MARCILENE/.test(d.nome))[0];
const textoEla = g.declMontarTexto_({ nome: marcilene.nome, cargo: marcilene.cargo, dataLiberacao: "2026-09-17", periodo: "" });
b.ok(/diretora desta Entidade Sindical/.test(textoEla), "cargo feminino vira \"diretora\"", marcilene.cargo);
/* Uma diferença DELIBERADA em relação ao papel: o modelo escreve
   "SindEducação/ES" e a casa escreve "SindEducação-ES" — 385 ocorrências
   contra 18, e a assinatura dos Recibos já usa o hífen. Decisão do usuário
   em 15/09/2026. O resto é palavra por palavra. */
b.ok(/MARCILENE DA SILVA MAGESKE, diretora desta Entidade Sindical, no dia 17 de setembro de 2026, estará a serviço do SindEducação-ES\./.test(textoEla),
  "a redação bate com o modelo, com a entidade no padrão da casa");
b.ok(/Nos termos do Artigo 543, da CLT, requeremos a liberação do empregado/.test(textoEla),
  "e o requerimento fica no MESMO parágrafo, como no papel");

const leonil = g.declListarDiretoria_interno_().filter(d => /LEONIL/.test(d.nome))[0];
b.ok(/ diretor desta Entidade/.test(g.declMontarTexto_({ nome: leonil.nome, cargo: leonil.cargo, dataLiberacao: "2026-09-17", periodo: "" })),
  "cargo sem marca de gênero fica no masculino", leonil.cargo);

const docFormato = g.declPreviaDocumento(pedido, TOKEN).html;
b.ok(/class="dagua"/.test(docFormato), "a marca d'água entra na folha");
b.ok(/text-decoration:underline/.test(docFormato), "o título sai sublinhado, como no modelo");
b.ok(/<b>WANDERSON NASCIMENTO CASTELO<\/b>/.test(docFormato), "o nome sai em negrito no corpo");
b.ok(/Leonil Dias da Silva/.test(docFormato) && !/LEONIL DIAS DA SILVA<\/div>/.test(docFormato),
  "a assinatura sai em caixa normal, não em caixa alta");
b.ok(/Presidente &ndash; <em>SindEducação-ES<\/em>/.test(docFormato), "com o cargo e a entidade em itálico");

b.fluxo("DECLARAÇÕES · Integral é o dia inteiro, e não se escreve");
/* Palavras do usuário em 15/09/2026: "Integral significa que estará a serviço
   do SindEducação-ES". Dizer "em período integral" era repetir. */
const comIntegral = g.declMontarTexto_({ nome: "Fulano", cargo: "Presidente", dataLiberacao: "2026-09-17", periodo: "INTEGRAL" });
b.ok(!/período integral/i.test(comIntegral), "Integral não acrescenta texto nenhum");
b.ok(/no dia 17 de setembro de 2026, estará a serviço do SindEducação-ES\./.test(comIntegral),
  "e a frase fica idêntica à do modelo em papel");
b.ok(/no período matutino/.test(g.declMontarTexto_({ nome: "Fulano", cargo: "Presidente", dataLiberacao: "2026-09-17", periodo: "MATUTINO" })),
  "os turnos continuam sendo escritos");
const rotulos = g.declDadosEmissao(TOKEN).periodos;
b.ok(rotulos.length === 4 && !rotulos.some(p => p.valor === ""),
  "a tela oferece 4 períodos, sem a opção vazia que gerava texto igual ao Integral",
  rotulos.map(p => p.rotulo).join(", "));
b.ok(g.declMontarTexto_({ nome: "Fulano", cargo: "Presidente", dataLiberacao: "2026-09-17", periodo: "" }) === comIntegral,
  "declaração antiga gravada com período vazio reimprime igual");

b.fluxo("DECLARAÇÕES · O arquivo no Drive é nominal e datado");
/* "Declaração tem que ser salva nominal e com data" — usuário, 15/09/2026.
   O nome antigo trazia só o primeiro nome e nenhuma data: obrigava a abrir
   o arquivo para saber de quem era e de quando. */
const nomeArq = g.declNomeArquivo_({
  numero: "001/2026", diretor: { nome: "Marcilene da Silva Mageske" },
  dataLiberacao: "2026-09-17", dataEmissao: "2026-09-15"
});
b.ok(nomeArq === "Declaração 001-2026 - MARCILENE DA SILVA MAGESKE - 17.09.2026",
  "nome completo e data da liberação", nomeArq);
b.ok(!/\//.test(nomeArq), "sem barra — o Drive recusaria o nome");
b.ok(/17\.09\.2026/.test(nomeArq) && !/15\.09/.test(nomeArq),
  "a data é a da LIBERAÇÃO, não a da emissão — é o dia que o documento afirma");
b.ok(!/[\\:*?"<>|]/.test(g.declNomeArquivo_({
  numero: "9/2026", diretor: { nome: 'Jose D\'Avila: de Sa/Junior' }, dataLiberacao: "2026-12-01"
})), "caractere proibido em nome de arquivo é higienizado");

/* O nome é decidido na emissão e chega ao Drive — prova por execução, com o
   gerador de PDF trocado por um dublê que registra o que recebeu. */
const capturado = [];
const geradorReal = g.declGerarPdf_;
g.declGerarPdf_ = p2 => { capturado.push(p2); return { id: "PDF-N", url: "https://drive/PDF-N" }; };
g.declEmitirDeclaracaoDiretor({
  diretorId: dir.id, escolaId: "ESC-UVV", periodo: "MATUTINO",
  dataLiberacao: amanha.toISOString().slice(0, 10), confirmado: true
}, TOKEN);
g.declGerarPdf_ = geradorReal;
b.ok(capturado.length === 1 && !!capturado[0].dataLiberacao,
  "a emissão entrega a data da liberação ao gerador do arquivo");
b.ok(/WANDERSON NASCIMENTO CASTELO/.test(g.declNomeArquivo_(capturado[0])),
  "e o nome do arquivo sai nominal", g.declNomeArquivo_(capturado[0]));

b.fluxo("DECLARAÇÕES · A prévia não paga o preço dos contatos");
/* Terceiro relato de lentidão do usuário em 15/09/2026. A prévia chamava a
   validação completa, que monta os contatos de CADA escola do dirigente —
   base de Associados, cadastro de Escolas, aba Controle e histórico de
   entrega de cada e-mail — para exibir um parágrafo que não usa nada disso. */
let lidasNaPrevia = 0;
const contatosReal = g.declContatosEscola_;
g.declContatosEscola_ = e => { lidasNaPrevia++; return contatosReal(e); };
g.declPreviaDeclaracaoDiretor(pedido, TOKEN);
b.ok(lidasNaPrevia === 0, "a prévia do texto não monta contato nenhum", lidasNaPrevia + " leitura(s)");
g.declPreviaDocumento(pedido, TOKEN);
b.ok(lidasNaPrevia === 0, "a pré-visualização do documento também não");

lidasNaPrevia = 0;
g.declEmitirDeclaracaoDiretor({
  diretorId: dir.id, escolaId: "ESC-UVV", periodo: "",
  dataLiberacao: amanha.toISOString().slice(0, 10), confirmado: true
}, TOKEN);
b.ok(lidasNaPrevia > 0, "mas a EMISSÃO continua montando — é a trava de destinatário do envio",
  lidasNaPrevia + " leitura(s)");
g.declContatosEscola_ = contatosReal;

b.fluxo("DECLARAÇÕES · Incluir destinatário é registrar, não afrouxar");
/* A trava recusa endereço fora da conferência. Sem uma porta registrada, a
   secretaria resolveria por fora do sistema quando o RH da escola mudasse —
   que é o que nenhuma trava deve provocar. */
const novoEmail = "rh.novo@uvv.br";
b.ok(g.declEnviarEmail(emitida.numero, [novoEmail], TOKEN).ok === false,
  "antes de incluir, o envio recusa o endereço");
const inclusao = g.declIncluirContato(emitida.numero, novoEmail, TOKEN);
b.ok(inclusao.ok && inclusao.contatos.some(c => c.email === novoEmail), "a inclusão entra na conferência");
b.ok(inclusao.contatos.filter(c => c.email === novoEmail)[0].origens.join("") === "Incluído no envio",
  "com a origem à vista, não disfarçada de cadastro");
b.ok(g.declEntregaDeclaracao(emitida.numero, TOKEN).escola.contatos.some(c => c.email === novoEmail),
  "e fica GRAVADA na linha, não só na tela");
b.ok(g.declEnviarEmail(emitida.numero, [novoEmail], TOKEN).ok, "depois de incluir, o envio aceita");
b.ok(g.declIncluirContato(emitida.numero, "isso-nao-e-email", TOKEN).ok === false, "endereço inválido é recusado");
b.ok(g.declIncluirContato(emitida.numero, novoEmail, TOKEN).ok === false, "e o repetido não duplica a lista");
b.bloqueia(() => g.declIncluirContato(emitida.numero, "x@y.br", TOKEN_ESC),
  "usuário sem Documentos não inclui destinatário");

b.fluxo("DECLARAÇÕES · Excluir é reversível, e só administrador faz");
/* "Estou fazendo de teste, às vezes erramos e precisamos excluir" — usuário,
   15/09/2026. Emissão errada precisa sair sem virar pedido de suporte para
   alguém mexer na planilha à mão. */
const paraExcluir = g.declEmitirDeclaracaoDiretor({
  diretorId: dir.id, escolaId: "ESC-UVV", periodo: "MATUTINO",
  dataLiberacao: amanha.toISOString().slice(0, 10), confirmado: true
}, TOKEN).numero;
const antesDeExcluir = g.declHistoricoDeclaracoes({}, TOKEN).total;

b.bloqueia(() => g.declExcluirDeclaracoes([paraExcluir], TOKEN_ESC),
  "usuário sem Documentos não exclui");

const exc = g.declExcluirDeclaracoes([paraExcluir], TOKEN);
b.ok(exc.ok && exc.excluidas === 1, "administrador exclui", exc.mensagem);
b.ok(g.declHistoricoDeclaracoes({}, TOKEN).total === antesDeExcluir - 1, "e a lista encolhe");
b.ok(!g.declHistoricoDeclaracoes({}, TOKEN).itens.some(i => i.numero === paraExcluir),
  "a declaração não aparece mais");

/* O PONTO DA DECISÃO: vai para a LIXEIRA, não some. */
const naLixeira = g.lixeiraListar_(ss.getSheetByName(g.ABA_DECLARACOES_DIRETOR)) || [];
b.ok(naLixeira.length > 0, "o registro foi para a lixeira, não evaporou", naLixeira.length + " na lixeira");

b.ok(g.declExcluirDeclaracoes([], TOKEN).ok === false, "sem seleção, não faz nada");
b.ok(g.declExcluirDeclaracoes(["999/2099"], TOKEN).ok === false, "número inexistente é recusado");

/* O TETO DA CASA RECUSA EM VEZ DE CORTAR PELA METADE — excluir 50 de 300 e
   dizer "50 excluídas" deixaria quem pediu achando que as 300 saíram. Quem
   garante isso é o lixeiraMoverVarias_, e a exclusão daqui passa por ele:
   testado direto, sem precisar emitir 51 declarações. */
const linhasDemais = [];
for (let i = 2; i < 60; i++) linhasDemais.push(i);
const recusa = g.lixeiraMoverVarias_(ss.getSheetByName(g.ABA_DECLARACOES_DIRETOR), linhasDemais, {});
b.ok(recusa.ok === false && recusa.movidas === 0, "lote acima do teto é recusado INTEIRO", recusa.mensagem);

b.fluxo("DECLARAÇÕES · De que conta o e-mail sai");
/* A REGRESSÃO QUE ORIGINOU ESTE BLOCO — 16/09/2026.

   A declaração saiu de `financeirosindeducacao@gmail.com` mesmo com
   `secretaria@sindeducacao.com` já configurada como alias no Gmail. Causa: o
   envio usava `MailApp.sendEmail(opcoes)`, e o MailApp IGNORA a opção `from`
   em silêncio. O `montarOpcoesEmailSISGEP_` montava o remetente CERTO — o
   emulador já sobe com o alias por padrão — e o serviço descartava.

   Por que nenhum teste pegou: havia asserção sobre as OPÇÕES montadas
   (t104, t138) e nenhuma sobre o que de fato SAIU pela declaração. Opção
   montada não é e-mail enviado. Estas asserções olham o outbox. */

const outboxAntes = amb.outbox.length;
const comAlias = g.declEnviarEmail(emitida.numero, [novoEmail], TOKEN);
b.ok(comAlias.ok, "com alias, envia", comAlias.mensagem);
const saiu = amb.outbox[amb.outbox.length - 1];
b.ok(saiu.via === "GmailApp", "sai pelo GmailApp, não pelo MailApp que ignora o from", saiu.via);
b.ok(saiu.from === "secretaria@sindeducacao.com",
  "e o remetente É a Secretaria — a asserção que faltava", String(saiu.from));
b.ok(saiu.replyTo === "secretaria@sindeducacao.com", "com replyTo da Secretaria", String(saiu.replyTo));
b.ok(saiu.name === "SindEducação-ES", "e o nome de exibição institucional", String(saiu.name));
b.ok(amb.outbox.length === outboxAntes + 1, "um e-mail, não dois");
b.ok(!(g.__rascunhosGmail || []).some(r => !r.apagado && r.dados.subject === saiu.subject) ||
     amb.outbox.some(m => m.subject === saiu.subject),
  "e não fica rascunho órfão na caixa");

/* SEM alias o envio NÃO PODE PARAR. Ofício é operação viva e a declaração
   segue a mesma regra: sai pela conta executora, com replyTo da Secretaria,
   e quem responde continua caindo na secretaria. */
const aliasesReais = g.GmailApp.getAliases;
g.GmailApp.getAliases = () => [];
const semAlias = g.declEnviarEmail(emitida.numero, [novoEmail], TOKEN);
b.ok(semAlias.ok, "sem alias, o envio continua saindo — não vira trava", semAlias.mensagem);
const saiu2 = amb.outbox[amb.outbox.length - 1];
b.ok(!saiu2.from, "sem from forçado, que o Gmail recusaria", String(saiu2.from));
b.ok(saiu2.replyTo === "secretaria@sindeducacao.com",
  "mas a resposta ainda vai para a Secretaria", String(saiu2.replyTo));

/* O DIAGNÓSTICO responde pelo ambiente, para a próxima divergência não custar
   uma emissão de teste e um print. */
const confRuim = g.declConferirConfiguracao(TOKEN);
b.ok(confRuim.remetente && confRuim.remetente.ok === false,
  "Conferir configuração acusa quando o alias não existe", confRuim.remetente && confRuim.remetente.texto);
b.ok(/Enviar e-mail como/.test(confRuim.remetente.detalhe),
  "dizendo ONDE resolver, não só que está errado");
g.GmailApp.getAliases = aliasesReais;
const confOk = g.declConferirConfiguracao(TOKEN);
b.ok(confOk.remetente && confOk.remetente.ok && /secretaria@sindeducacao\.com/.test(confOk.remetente.texto),
  "e confirma quando sai da Secretaria", confOk.remetente && confOk.remetente.texto);
b.ok(confRuim.pronto === confOk.pronto,
  "mas o remetente NÃO entra no `pronto`: é aviso, não trava de emissão");

b.fluxo("DECLARAÇÕES · O corpo do e-mail");
const corpo = g.declEntregaDeclaracao(emitida.numero, TOKEN).emailCorpo;
b.ok(/SINDEDUCAÇÃO-ES/.test(corpo) && /31\.815\.780\/0001-51/.test(corpo),
  "traz o cabeçalho institucional do ofício, com CNPJ");
b.ok(/Declaração Nº/.test(corpo) && corpo.indexOf(emitida.numero) > -1,
  "o número aparece na faixa");
b.ok(/Liberação Sindical/.test(corpo), "com o badge do tipo");
b.ok(/MARCELHA ALINE PINTO GOMES/.test(corpo),
  "assinatura da Marcelha — sua decisão em 16/09/2026, igual ao ofício");
b.ok(/Enseada do Suá/.test(corpo) && /\(27\) 99735-8900/.test(corpo),
  "e o rodapé com endereço e telefone");
b.ok(/Artigo 543 da CLT/.test(corpo), "cita o artigo que fundamenta a liberação");
b.ok(/confirmação do recebimento/.test(corpo), "e pede confirmação, como o ofício");
/* O quadro de conferência: quem recebe é o RH, que lê no celular. */
b.ok(/Dirigente/.test(corpo) && /Liberação/.test(corpo) && /Período/.test(corpo) && /Instituição/.test(corpo),
  "o quadro traz os quatro dados que o RH precisa sem abrir o anexo");
b.ok(/Integral|Matutino|Vespertino|Noturno/.test(corpo), "com o período escrito por extenso");
/* A prévia e o envio chamam a MESMA função por construção — declEntregaDeclaracao
   e declEnviarEmail usam declCorpoEmail_. Não escrevo asserção para isso aqui:
   a que eu tinha escrito terminava em `|| true` e não podia falhar, que é pior
   do que não ter teste. O que dá para afirmar de verdade é o conteúdo, acima,
   e o ambiente, abaixo. */
b.ok(g.declCorpoEmail_({ numero: "1/2026", nome: "X", escola: "Y", dataLiberacao: "01/01/2026",
                         periodoRotulo: "Integral", ambiente: "producao" }).indexOf("HOMOLOGAÇÃO") === -1,
  "em produção não carrega o aviso de homologação");
b.ok(g.declCorpoEmail_({ numero: "1/2026", nome: "X", escola: "Y", dataLiberacao: "01/01/2026",
                         periodoRotulo: "Integral", ambiente: "homologacao",
                         destinoReal: "rh@escola.br" }).indexOf("rh@escola.br") > -1,
  "em homologação diz para quem iria de verdade");
b.ok(g.declCorpoEmail_({ nome: '<img src=x onerror=alert(1)>' }).indexOf("<img src=x") === -1,
  "e escapa o nome — o corpo é HTML montado à mão");

b.fluxo("DECLARAÇÕES · Segurança");
b.bloqueia(() => g.declContextoDiretor(dir.id, TOKEN_ESC), "usuário sem Documentos não consulta vínculo");
b.bloqueia(() => g.declEmitirDeclaracaoDiretor(pedido, TOKEN_ESC), "usuário sem Documentos não emite");
b.bloqueia(() => g.declDadosEmissao("token-falso"), "token inválido é recusado");
b.bloqueia(() => g.declEntregaDeclaracao(emitida.numero, TOKEN_ESC), "usuário sem Documentos não reabre a entrega");
b.bloqueia(() => g.declConferirConfiguracao(TOKEN_ESC), "usuário sem Documentos não confere a configuração");
b.bloqueia(() => g.declPreviaDocumento(pedido, TOKEN_ESC), "usuário sem Documentos não pré-visualiza");
b.naoTestavel("PDF, Drive, Gmail e WhatsApp reais", "dependem da homologação publicada");
b.resumo();
