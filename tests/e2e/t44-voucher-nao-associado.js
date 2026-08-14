/**
 * TESTE — O NÃO ASSOCIADO: MESMO BENEFÍCIO, CANAL PRESENCIAL
 *
 * Regra dita pelo usuário em 14/08/2026: "hoje todos tem o mesmo benefício,
 * mas o não associado a solicitação do voucher e a retirada é presencial";
 * "ele virá presencial e fará a solicitação em papel"; e, sobre o portal,
 * "ele gera uma lembrança (aviso) na tela, não pode bloquear".
 *
 * ISTO REVERTE UMA REGRA QUE EU ESCREVI EM 12/08 e que tinha se espalhado
 * por quatro pontos — cálculo, aprovação, emissão e portal. O estrago
 * medido: o portal mandava a pessoa à sede e o balcão a recusava quando ela
 * chegava. O caminho presencial existia no nome dos status e em lugar
 * nenhum mais. Este arquivo existe para isso não voltar a acontecer calado.
 *
 * O que ele NÃO cobre, e continua "não testado" pela REGRA Nº -1: o PDF
 * gerado, a entrega real de e-mail e a aparência da faixa no navegador.
 */
const b = require("./base");
const dom = require("./dom");

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);

/* Semeia a base de Associados com um FILIADO e um NÃO FILIADO. Os dois
 * precisam EXISTIR na base: é a diferença entre "a base diz que não é
 * associado" e "a base não conhece essa pessoa", e o sistema trata as duas
 * de formas diferentes de propósito. */
let shA = ss.getSheetByName("Associados");
if (!shA) {
  shA = ss.insertSheet("Associados");
  shA.appendRow(["CPF", "Nome", "Filiado", "Email", "Celular"]);
}
const CPF_NAO = "44455566678";
const CPF_SIM = "11144477735";
shA.appendRow([CPF_NAO, "NAO FILIADO DE TESTE", "NAO", "nf@teste.com", "27999998888"]);
shA.appendRow([CPF_SIM, "FILIADO DE TESTE", "SIM", "f@teste.com", "27999997777"]);

const PEDIDO = {
  modalidade: "ENSINO_FUNDAMENTAL", areaCurso: "",
  tipoBeneficiario: "FILHO", ordemFilho: "1",
  curso: "6 ANO", regime: "SEMESTRAL"
};

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("REGRA · O benefício é o mesmo, o canal é que muda");

b.passo("1. O percentual não olha a carteirinha");
const rNao = g.calcularRegraVoucher_(
  Object.assign({}, PEDIDO, { situacaoSindical: "NAO_ASSOCIADO" }), 12);
const rSim = g.calcularRegraVoucher_(
  Object.assign({}, PEDIDO, { situacaoSindical: "ASSOCIADO" }), 12);
b.ok(rSim.apto && rNao.apto, "os dois são aptos");
/* Comparar um com o outro, e não com "100" fixo: se a regra do associado
 * quebrasse junto, a asserção contra o número fixo pegaria — mas a de
 * igualdade é a que expressa a regra que o usuário ditou. As duas juntas
 * cobrem os dois modos de errar. */
b.igual(rNao.percentual, rSim.percentual, "e o percentual é IGUAL dos dois lados");
b.igual(rSim.percentual, "100", "que para 1º filho é 100");

b.passo("2. O canal vem dito, e só o do não associado fala em presencial");
b.igual(rNao.canal, "PRESENCIAL", "não associado → PRESENCIAL");
b.igual(rSim.canal, "REMOTO", "associado → REMOTO");
b.ok(rNao.presencial === true, "e a bandeira booleana acompanha");
b.ok(/papel/i.test(rNao.observacao) && /presencial/i.test(rNao.observacao),
  "a observação explica papel e retirada", rNao.observacao);
b.ok(!/presencial/i.test(rSim.observacao),
  "e a do associado não fala nisso", rSim.observacao);

b.passo("3. Situação em branco não vira 'não associado'");
/* Quem ainda não escolheu o campo não declarou nada. Se o branco caísse no
 * ramo do presencial, TODA solicitação nasceria com aviso de retirada na
 * sede — e o aviso que aparece sempre é aviso que ninguém lê. */
const rBranco = g.calcularRegraVoucher_(Object.assign({}, PEDIDO), 12);
b.igual(rBranco.canal, "REMOTO", "branco é tratado como remoto");
b.ok(!rBranco.presencial, "e não marca presencial");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("BALCÃO · O atendimento presencial acontece do início ao fim");

b.passo("4. Cria, aprova e emite — os três passos que antes travavam");
const criado = g.voucherCriarSolicitacao({
  cpf: CPF_NAO, nome: "NAO FILIADO DE TESTE",
  email: "nf@teste.com",
  situacaoSindical: "NAO_ASSOCIADO",
  escola: "ESCOLA X", modalidade: "ENSINO_FUNDAMENTAL",
  instituicao: "INST Y", curso: "6 ANO",
  tipoBeneficiario: "FILHO", nomeBeneficiario: "FILHO DO NAO FILIADO",
  ordemFilho: "1", periodo: "2026/2", regime: "SEMESTRAL"
}, TOKEN);
b.ok(criado.ok, "a solicitação é criada", criado.protocolo || criado.mensagem);

const aprovado = g.aprovarSolicitacaoVoucher(criado.protocolo, "", TOKEN);
b.ok(aprovado.ok === true, "a aprovação é ACEITA", aprovado.mensagem);
b.ok(!/s[óo] associado tem direito/i.test(aprovado.mensagem || ""),
  "sem a frase da regra revogada", aprovado.mensagem);

b.passo("5. A emissão sai, e AVISA que não foi por e-mail");
const emitido = g.gerarDocumentoCertBolsaCompleto(
  criado.protocolo, "VOUCHER", { rg: "123", enviarAssociado: true }, TOKEN);
b.ok(emitido.ok === true, "o voucher é emitido", emitido.mensagem);
b.ok(emitido.retiradaPresencial === true, "marcado como retirada presencial");
b.ok(/n[ãa]o foi enviado por e-?mail/i.test(emitido.mensagem || ""),
  "e a mensagem diz isso a quem emitiu", emitido.mensagem);

b.passo("6. O e-mail foi PEDIDO e não saiu — a trava é do backend");
/* `enviarAssociado: true` foi passado de propósito no passo anterior. Se a
 * trava morasse na caixinha da tela, o e-mail teria saído aqui: qualquer
 * chamada direta passaria por cima dela. O emulador registra os envios em
 * vez de mandar, então dá para provar a ausência. */
b.ok(emitido.envioBloqueadoPresencial === true,
  "o envio foi bloqueado explicitamente, não esquecido");

/* A CAIXA DE SAÍDA DO EMULADOR, e não uma propriedade inventada.
 *
 * A primeira versão desta asserção lia `g.MailApp._enviados`, que NÃO
 * EXISTE — e por isso passava sempre, com lista vazia, provando nada. É o
 * modo mais traiçoeiro de um teste mentir: verde, específico e inútil.
 * Só apareceu porque fui conferir como o emulador registra e-mail.
 *
 * A trava contra isso é a asserção logo abaixo: o `outbox` tem que EXISTIR
 * e ter recebido e-mail em algum momento da suíte deste arquivo. Provar a
 * ausência sem provar que o instrumento funciona é o mesmo erro de novo. */
const outbox = (amb && amb.outbox) || [];
const paraEle = outbox.filter(function (e) {
  return String((e && e.to) || "").indexOf("nf@teste.com") > -1;
});
b.ok(!!(amb && Array.isArray(amb.outbox)),
  "a caixa de saída do emulador está acessível — senão a ausência não vale");

/* A ASSERÇÃO ERA "NENHUM E-MAIL", E ESTAVA ERRADA — de um jeito útil.
 *
 * Ela falhou e revelou um e-mail que eu não sabia que existia: o aviso de
 * APROVAÇÃO, disparado de VoucherAdmin.gs, com a frase "o voucher será
 * emitido e encaminhado". Verdade para o associado, mentira para quem
 * retira na sede.
 *
 * A regra do usuário é sobre O VOUCHER, não sobre todo contato: ser
 * aprovado é notícia boa e a pessoa tem direito de saber. Então o que se
 * afirma aqui é o que de fato importa — nenhum e-mail entrega o voucher,
 * e nenhum promete entregar. */
const prometeEnvio = paraEle.filter(function (e) {
  return /encaminhado|enviado para o seu e-?mail|segue em anexo/i
    .test(String((e && e.htmlBody) || (e && e.body) || ""));
});
b.igual(prometeEnvio.length, 0,
  "nenhum e-mail promete encaminhar o voucher a ele");
b.ok(paraEle.some(function (e) {
  return /retirada [ée] presencial/i.test(String((e && e.htmlBody) || ""));
}), "e o aviso de aprovação diz que a retirada é presencial",
  "e-mails para ele: " + paraEle.length);

b.passo("7. O histórico guarda o porquê — e ele sobrevive à emissão");
/* OBSERVACOES é sobrescrita pela ação seguinte (defeito achado em 13/08).
 * O rastro que vale é o do histórico, que é append-only. Ler DEPOIS da
 * emissão é o que prova a diferença. */
const shH = ss.getSheetByName("Voucher_Historico");
const linhasH = shH ? shH.getDataRange().getValues() : [];
const doProtocolo = linhasH.filter(function (l) {
  return l.join(" | ").indexOf(criado.protocolo) > -1;
});
b.ok(doProtocolo.length > 0, "há histórico do protocolo", doProtocolo.length + " linhas");
b.ok(doProtocolo.some(function (l) { return /presencial/i.test(l.join(" | ")); }),
  "dizendo que o atendimento é presencial");
b.ok(doProtocolo.some(function (l) {
  return /EMAIL_NAO_ENVIADO_RETIRADA_PRESENCIAL/.test(l.join(" | "));
}), "e registrando que o e-mail não foi enviado");

b.passo("8. O associado continua recebendo por e-mail");
/* A metade que ninguém pede para testar e que é onde o estrago aconteceria:
 * bloquear o envio de todo mundo passaria em todas as asserções acima. */
const cSim = g.voucherCriarSolicitacao({
  cpf: CPF_SIM, nome: "FILIADO DE TESTE", email: "f@teste.com",
  situacaoSindical: "ASSOCIADO",
  escola: "ESCOLA X", modalidade: "ENSINO_FUNDAMENTAL",
  instituicao: "INST Y", curso: "6 ANO",
  tipoBeneficiario: "FILHO", nomeBeneficiario: "FILHO DO FILIADO",
  ordemFilho: "1", periodo: "2026/2", regime: "SEMESTRAL"
}, TOKEN);
g.aprovarSolicitacaoVoucher(cSim.protocolo, "", TOKEN);
const eSim = g.gerarDocumentoCertBolsaCompleto(
  cSim.protocolo, "VOUCHER", { rg: "123", enviarAssociado: true }, TOKEN);
b.ok(eSim.ok === true, "emite para o associado", eSim.mensagem);
b.ok(!eSim.retiradaPresencial, "sem marca de presencial");
b.ok(eSim.envioBloqueadoPresencial !== true, "e o envio dele NÃO é bloqueado");

/* A CONTRAPROVA DO INSTRUMENTO.
 *
 * "Nenhum e-mail saiu para o não associado" só significa alguma coisa se o
 * outbox for capaz de registrar e-mail. Se um dia o envio parar de passar
 * pelo MailApp — outra camada, outro nome —, o outbox ficaria vazio para
 * TODO MUNDO e a asserção da ausência continuaria verde enquanto o sistema
 * mandasse e-mail para quem não devia. Esta asserção é o que impede isso. */
const outboxSim = (amb && amb.outbox) || [];
b.ok(outboxSim.some(function (e) {
  return String((e && e.to) || "").indexOf("f@teste.com") > -1;
}), "e o e-mail DELE aparece no outbox — o instrumento funciona",
  "e-mails registrados: " + outboxSim.length);

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PORTAL · Online é só para associado, e a recusa ENSINA o caminho");

/* A REGRA LEVOU TRÊS MENSAGENS PARA FICAR NÍTIDA, em 14/08/2026, e o
 * resultado das três juntas é o que este bloco trava:
 *
 *   "ele gera uma lembrança (aviso) na tela, não pode bloquear"
 *   "quem não é associado não pode fazer a solicitação pelo site... portal"
 *   "quando tentar entrar, deve ser solicitado a encaminhar um e-mail para
 *    secretaria@sindeducacao.com"
 *   "esse benefício de ter ON é somente para o associado"
 *
 * Não são contraditórias: o que não pode é o bloqueio MUDO. A solicitação
 * pelo portal é recusada — o autoatendimento é benefício de associado —, e
 * a recusa tem que dizer para onde ir. Por isso as asserções abaixo cobram
 * as duas metades: que NÃO cria, e que EXPLICA.
 *
 * Cheguei a implementar o oposto (aceitar e rotear) entre a primeira e a
 * segunda mensagem. Fica registrado para o próximo leitor não achar que a
 * recusa aqui é descuido de quem não leu "não pode bloquear". */

b.passo("9. O pedido do não associado NÃO é criado pelo portal");
const p = g.salvarCadastroESolicitacaoVoucher({
  cpf: CPF_NAO, nome: "NAO FILIADO DE TESTE",
  email: "nf@teste.com", telefone: "27999998888",
  dataNascimento: "01/01/1985", endereco: "RUA X",
  escolaAtual: "ESCOLA X", cargoFuncao: "PROFESSOR", situacaoVinculo: "ATIVO",
  tipoBeneficiario: "FILHO", nomeBeneficiario: "OUTRO FILHO",
  dataNascimentoBeneficiario: "01/01/2014", ordemFilho: "1",
  modalidade: "ENSINO_FUNDAMENTAL", curso: "6 ANO",
  instituicaoEnsino: "INST Y", periodoReferencia: "2027/1",
  situacaoSindicalDeclarada: "NAO_ASSOCIADO"
});
const shS = ss.getSheetByName("Voucher_Solicitacoes");
const linhasAntes = shS.getLastRow();

b.ok(p.ok === false, "o portal recusa", p.mensagem);
b.ok(!(p.protocolo && p.protocolo.numeroProtocolo), "sem protocolo");
b.igual(shS.getLastRow(), linhasAntes,
  "e NENHUMA linha nova foi criada na aba");

b.passo("10. A recusa ENSINA — é a metade que o 'não pode bloquear' exige");
b.ok(p.naoAssociado === true, "a bandeira vem marcada, para a tela pintar aviso e não erro");
b.ok(/secretaria@sindeducacao\.com/.test(p.mensagem || ""),
  "a mensagem traz o e-mail da secretaria", p.mensagem);
b.igual(p.emailContato, "secretaria@sindeducacao.com", "e ele vem em campo próprio");
b.ok(/mesmo/i.test(p.mensagem || ""),
  "dizendo que o benefício é o MESMO — a recusa é de canal, não de direito",
  p.mensagem);
b.ok(!/erro|inv[áa]lid|n[ãa]o foi poss[íi]vel/i.test(p.mensagem || ""),
  "e sem palavra de falha, que faria parecer defeito do site", p.mensagem);

b.passo("11. E o aviso sai já na IDENTIFICAÇÃO, antes de preencher o resto");
/* "Quando tentar entrar" — a pessoa não pode preencher escola, curso,
 * período e anexar documento para descobrir no fim que o caminho é outro. */
const ident = g.identificarSolicitanteVoucher({ cpf: CPF_NAO });
b.ok(ident.naoAssociado === true, "a identificação já marca não associado");
b.igual(ident.emailContato, "secretaria@sindeducacao.com",
  "com o e-mail para onde escrever");
b.ok(/exclusiva para associados/i.test(ident.avisoPresencial || ""),
  "e o aviso explica que o online é do associado", ident.avisoPresencial);

const identSim = g.identificarSolicitanteVoucher({ cpf: CPF_SIM });
b.ok(identSim.naoAssociado !== true, "o associado não recebe essa marca");

b.passo("12. O associado passa pelo portal sem aviso nenhum");
const pSim = g.salvarCadastroESolicitacaoVoucher({
  cpf: CPF_SIM, nome: "FILIADO DE TESTE",
  email: "f@teste.com", telefone: "27999997777",
  dataNascimento: "01/01/1985", endereco: "RUA X",
  escolaAtual: "ESCOLA X", cargoFuncao: "PROFESSOR", situacaoVinculo: "ATIVO",
  tipoBeneficiario: "FILHO", nomeBeneficiario: "TERCEIRO FILHO",
  dataNascimentoBeneficiario: "01/01/2014", ordemFilho: "2",
  modalidade: "ENSINO_FUNDAMENTAL", curso: "6 ANO",
  instituicaoEnsino: "INST Y", periodoReferencia: "2027/1",
  situacaoSindicalDeclarada: "ASSOCIADO"
});
/* A METADE QUE PROVA QUE A TRAVA NÃO É UM MURO PARA TODOS.
 * Recusar todo mundo passaria em cada asserção do passo 9. */
b.ok(pSim.ok === true, "o associado passa e a solicitação é criada", pSim.mensagem);
b.ok(!!(pSim.protocolo && pSim.protocolo.numeroProtocolo), "com protocolo",
  pSim.protocolo && pSim.protocolo.numeroProtocolo);
b.ok(pSim.naoAssociado !== true, "sem bandeira de não associado");
b.igual(pSim.avisoPresencial || "", "", "e sem aviso de presencial");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("PORTAL · A faixa da tela obedece à BASE, não ao que a pessoa digitou");

if (!dom.jsdomDisponivel()) {
  b.naoTestavel("faixa do portal", "jsdom não instalado");
} else {
  const t = dom.montar(g, ["PortalVoucher.html"], { token: "" });
  const doc = t.doc;

  b.passo("13. A tela tem a faixa e o seletor de situação");
  b.ok(!!doc.getElementById("protocoloSub"), "existe o bloco do protocolo");
  b.ok(!!doc.getElementById("situacaoSindicalDeclarada"), "e o seletor declarado");

  b.passo("13b. A tela para o envio na identificação e diz para onde escrever");
  const fonteP = require("fs").readFileSync(dom.RAIZ + "/PortalVoucher.html", "utf8");
  b.ok(/res\.naoAssociado === true/.test(fonteP),
    "a identificação reage à marca do backend");
  b.ok(/bloquearEnvioNaoAssociado/.test(fonteP),
    "e existe a função que desliga o envio");
  b.ok(/secretaria@sindeducacao\.com/.test(fonteP),
    "com o e-mail da secretaria na tela");
  b.ok(/mailto:/.test(fonteP),
    "clicável, para a pessoa não precisar copiar à mão");
  /* Botão desligado precisa dizer POR QUÊ, senão vira "site quebrado". */
  b.ok(/Solicita[çc][ãa]o presencial — escreva para/.test(fonteP),
    "e o rótulo do botão explica o bloqueio");
  /* E precisa destravar: CPF digitado errado não pode prender a pessoa. */
  b.ok(/removeAttribute\('data-bloqueado-nao-associado'\)/.test(fonteP),
    "nova identificação destrava o botão");

  b.passo("14. Declarar 'Associado' NÃO faz a faixa verde aparecer");
  /* ESTE ERA O DEFEITO, e ele é o motivo de este bloco existir. A faixa
   * escolhia a cor pelo SELECT do formulário — a declaração do próprio
   * solicitante. Quem se declarasse associado sem ser via "você será
   * notificado por e-mail", enquanto o backend já tinha marcado
   * NAO_ASSOCIADO e mandado o pedido para o presencial. A pessoa ia embora
   * esperando um e-mail que nunca viria.
   *
   * O teste é feito sobre o TEXTO da tela depois da resposta, com a
   * declaração MENTINDO de propósito: seletor em "Associado", backend
   * dizendo não. Quem manda tem que ser o backend. */
  const fonte = require("fs").readFileSync(dom.RAIZ + "/PortalVoucher.html", "utf8");
  b.ok(/res\.naoAssociado\s*===\s*true/.test(fonte),
    "a tela lê res.naoAssociado do backend");
  b.ok(/isSindicalizado\s*=\s*false/.test(fonte),
    "e o usa para decidir a faixa");
  /* A ordem importa: se a leitura do SELECT viesse ANTES e sem o else, ela
   * venceria. A asserção abaixo trava a precedência. */
  const posBackend = fonte.indexOf("res.naoAssociado === true");
  const posSelect = fonte.indexOf("situacaoSindicalDeclarada').value || '').toUpperCase() === 'ASSOCIADO'");
  b.ok(posBackend > -1 && posSelect > -1 && posBackend < posSelect,
    "e o backend é consultado ANTES da declaração do formulário");

  b.passo("15. O texto da faixa diz que o benefício é o mesmo");
  /* O texto anterior era "Cadastro identificado como Não Associado" +
   * "compareça à sede" — e nunca dizia que a pessoa TINHA o benefício.
   * Quem lia entendia recusa. */
  b.ok(/benef[íi]cio [ée] o mesmo/i.test(fonte),
    "a faixa afirma que o benefício é o mesmo");
  b.ok(/retirado na sede|retirada.{0,20}sede/i.test(fonte),
    "e explica a retirada na sede");
  b.ok(!/Cadastro identificado como <strong>N[ãa]o Associado/i.test(fonte),
    "sem o texto antigo, que soava recusa");
}

b.resumo();
process.exit(0);
