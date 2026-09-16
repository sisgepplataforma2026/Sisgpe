/**
 * TESTE — O COMUNICADO DE "FORA DA REGRA" E O DESCONTO CORRIGÍVEL
 *
 * Dois pedidos do usuário, 16/09/2026, no mesmo modal de análise.
 *
 * 1. O COMUNICADO. Sobre o dependente acima de 24 anos: "Ele pode preencher o
 *    cadastro, tudo normalmente. Quando vai chegar para a Marcela fazer
 *    validação, o sistema automaticamente tem que informar [...] Dependente
 *    fora da idade. E ela só vai enviar um comunicado, vai ter um botão em
 *    ações lá [...] uma mensagem padrão, em que infelizmente não é possível
 *    devido à idade dele." Perguntado se o texto sai fechado: "Pode editar".
 *
 * 2. O DESCONTO. "Aqui eu tenho que ter uma opção de alterar o desconto caso
 *    esteja errado" — o percentual calculado pela convenção aparecia no modal
 *    como número fixo.
 *
 * O TESTE EXECUTA: um dependente de 26 anos entra pelo portal, é gravado
 * BLOQUEADA_POR_REGRA, o comunicado é preparado, EDITADO e enviado, e o
 * resultado é conferido na caixa de saída e na planilha. Depois um caso bom é
 * aprovado com o desconto corrigido, e o valor é conferido na célula.
 */
const b = require("./base");

const { g, amb } = b.subir({});
b.seedUsuarios(g);
const TOKEN = b.logar(g, "wanderson");
g.setupVoucherModuleFase1();

const ss = g.SpreadsheetApp.openById(g.PLANILHA_ID);
let shA = ss.getSheetByName("Associados");
if (!shA) {
  shA = ss.insertSheet("Associados");
  shA.appendRow(["CPF", "Nome", "Filiado", "Email", "Celular"]);
}
const CPF = "11144477735";
shA.appendRow([CPF, "MARIA DE TESTE", "SIM", "maria@teste.com", "27999997777"]);

const PDF_FALSO = Buffer.from("%PDF-1.4 teste").toString("base64");
const JPG_FALSO = Buffer.from("\xFF\xD8\xFF teste", "binary").toString("base64");
const anexos = {
  contracheque: { nome: "c.pdf", tipo: "application/pdf", tamanho: 14, base64: PDF_FALSO },
  docPessoal:   { nome: "r.jpg", tipo: "image/jpeg",      tamanho: 12, base64: JPG_FALSO }
};
const ano = new Date().getFullYear();

/* CADA CASO PRECISA DE PESSOA PRÓPRIA — e isto foi o primeiro teste a
   reprovar aqui. A segunda pós-graduação do mesmo CPF não era criada: bate na
   trava de duplicidade (mesmo solicitante, mesma modalidade, mesmo período) e,
   depois de três, no teto por associado. As duas travas estão certas; o
   errado era o teste querer empilhar cinco pedidos numa pessoa só. */
let _seq = 0;
function novoAssociado(nome) {
  _seq++;
  /* CPFs com dígito verificador válido — o sistema confere, e um inválido
     faria o pedido morrer num caminho de erro que não é o que se quer testar. */
  const cpfs = ["11144477735", "52998224725", "01234567890", "98765432100", "12345678909"];
  const cpf = cpfs[_seq % cpfs.length];
  shA.appendRow([cpf, nome, "SIM", "assoc" + _seq + "@teste.com", "27999990000"]);
  return { cpf: cpf, nome: nome, email: "assoc" + _seq + "@teste.com" };
}

function enviarPeloPortal(extra, quem) {
  quem = quem || { cpf: CPF, nome: "MARIA DE TESTE", email: "maria@teste.com" };
  const p = Object.assign({
    cpf: quem.cpf, nome: quem.nome, dataNascimento: "1980-05-10",
    escolaAtual: "COLEGIO DE TESTE", situacaoSindicalDeclarada: "ASSOCIADO",
    email: quem.email, telefone: "27999997777",
    periodoReferencia: ano + "/2", regime: "SEMESTRAL"
  }, anexos, extra);
  return g.salvarCadastroESolicitacaoVoucher(p);
}

function linha(protocolo) {
  const item = g.buscarSolicitacaoPorProtocolo_(protocolo);
  return item && item.registro;
}

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("BOLSAS · Comunicado de fora da regra");

b.passo("1. O dependente de 26 anos preenche tudo — e o pedido é GRAVADO");
/* É o ponto do pedido que é fácil errar: a tentação seria recusar na entrada.
   O usuário foi explícito — "Ele pode preencher o cadastro, tudo
   normalmente". Recusar na porta deixaria a Secretaria sem o caso na mesa. */
const r1 = enviarPeloPortal({
  tipoBeneficiario: "FILHO", parentesco: "FILHO",
  nomeBeneficiario: "JOAO DE TESTE",
  dataNascimentoBeneficiario: (ano - 26) + "-04-10",
  modalidade: "GRADUACAO", areaCurso: "SAUDE", curso: "ENFERMAGEM",
  ordemFilho: "1"
});
b.ok(r1 && r1.ok === true, "o portal aceita o pedido", (r1 && r1.mensagem) || "sem retorno");
const protBloq = r1 && r1.protocolo && r1.protocolo.numeroProtocolo;
b.ok(!!protBloq, "e devolve protocolo", protBloq);
b.igual(String(linha(protBloq).STATUS_SOLICITACAO), "BLOQUEADA_POR_REGRA",
  "gravado como BLOQUEADA_POR_REGRA — na fila de quem analisa, não recusado na porta");
b.igual(String(linha(protBloq).IDADE_BENEFICIARIO), "26",
  "com a idade medida e gravada, que é o que o painel mostra");

b.passo("2. O sistema DIZ o motivo — não deixa a pessoa descobrir");
const prev = g.previewComunicadoRegraVoucher(protBloq, TOKEN);
b.ok(prev && prev.ok === true, "o comunicado é preparado", (prev && prev.mensagem) || "");
b.igual(prev.motivo.tipo, "IDADE", "o motivo identificado é a idade");
b.ok(prev.motivo.rotulo.indexOf("26") > -1 && prev.motivo.rotulo.indexOf("24") > -1,
  "e o rótulo traz os dois números: a idade do beneficiário e o limite",
  prev.motivo.rotulo);
b.ok(prev.motivo.origem.indexOf("cadastro") > -1,
  "com a origem à vista — de onde o sistema tirou isso (REGRA Nº 0.6)");
b.igual(prev.email, "maria@teste.com", "e o destinatário vem do cadastro");

b.passo("3. O texto chega PRONTO, e é editável");
b.ok(prev.texto.indexOf("MARIA DE TESTE") > -1, "o texto padrão já traz o nome do associado");
b.ok(prev.texto.indexOf("JOAO DE TESTE") > -1, "e o do beneficiário");
b.ok(prev.texto.indexOf("24 anos") > -1, "explica a regra dos 24 anos");
b.ok(prev.texto.indexOf("não é possível") > -1,
  "diz o que o usuário pediu: infelizmente não é possível");
b.ok(prev.texto.indexOf("Isso não impede novas solicitações") > -1,
  "e não fecha a porta — dá o caminho para tentar de novo");
b.ok(prev.texto.indexOf("<") === -1,
  "é texto corrido, não HTML — vai para dentro de um campo de digitação");

b.passo("4. Ela edita, envia, e sai o que ELA escreveu");
amb.reset();
const TEXTO_DELA = "Olá, Maria,\n\nConversamos por telefone hoje.\n\n" +
  "Infelizmente não é possível conceder a bolsa para o João porque ele já " +
  "passou dos 24 anos & a convenção não permite.\n\nAtenciosamente,\nMarcelha";
const env = g.enviarComunicadoRegraVoucher(protBloq, TEXTO_DELA, true, TOKEN);
b.ok(env && env.ok === true, "o envio acontece", (env && env.mensagem) || "");
b.igual(amb.outbox.length, 1, "e produziu exatamente um e-mail");
const msg = amb.outbox[0];
b.igual(msg.via, "GmailApp", "pela porta da Secretaria, como todo e-mail do módulo");
b.igual(msg.to, "maria@teste.com", "para o associado");
b.ok(msg.htmlBody.indexOf("Conversamos por telefone hoje") > -1,
  "com o TEXTO DELA, não com o meu");
b.ok(msg.htmlBody.indexOf("24 anos &amp; a convenção") > -1,
  "escapado: um & digitado não pode quebrar o e-mail");
b.ok(msg.htmlBody.indexOf("<p>") > -1, "quebrado em parágrafos, não num bloco só");
b.ok(msg.htmlBody.indexOf("#001f4d") > -1, "na casca visual do SISGEP");

b.passo("5. Indeferir junto é escolha marcada, e ela funciona");
b.igual(String(linha(protBloq).STATUS_SOLICITACAO), "INDEFERIDO",
  "com a caixa marcada, a solicitação sai da fila");
const shHist = ss.getSheetByName("Voucher_Historico");
const hist = shHist ? shHist.getDataRange().getValues().map(function (l) { return l.join("|"); }).join("\n") : "";
b.ok(hist.indexOf("COMUNICADO_REGRA_ENVIADO") > -1,
  "o envio ficou registrado no histórico");
b.ok(hist.indexOf("SOLICITACAO_INDEFERIDA") > -1, "e o indeferimento também");

/* UM E-MAIL SÓ. O indeferimento comum dispara o seu próprio aviso; se os dois
   caminhos rodassem, o associado receberia duas recusas com textos diferentes
   sobre o mesmo pedido — e ligaria para o sindicato perguntando qual vale. */
b.igual(amb.outbox.length, 1, "e o associado recebeu UM e-mail, não dois");

b.passo("6. Sem a caixa marcada, a solicitação continua na fila");
const r2 = enviarPeloPortal({
  tipoBeneficiario: "FILHO", parentesco: "FILHO",
  nomeBeneficiario: "PEDRO DE TESTE",
  dataNascimentoBeneficiario: (ano - 30) + "-04-10",
  modalidade: "GRADUACAO", areaCurso: "SAUDE", curso: "MEDICINA",
  ordemFilho: "2"
});
const protBloq2 = r2 && r2.protocolo && r2.protocolo.numeroProtocolo;
b.ok(!!protBloq2, "segundo caso gravado", protBloq2);
amb.reset();
const env2 = g.enviarComunicadoRegraVoucher(protBloq2, "Mensagem curta de teste.", false, TOKEN);
b.ok(env2 && env2.ok === true, "o comunicado sai", (env2 && env2.mensagem) || "");
b.igual(amb.outbox.length, 1, "um e-mail");
b.igual(String(linha(protBloq2).STATUS_SOLICITACAO), "BLOQUEADA_POR_REGRA",
  "e o status NÃO muda — quem desmarca a caixa quer decidir depois");

b.passo("7. O que não pode passar");
amb.reset();
const vazio = g.enviarComunicadoRegraVoucher(protBloq2, "   ", false, TOKEN);
b.ok(vazio && vazio.ok === false, "comunicado em branco é recusado", vazio && vazio.mensagem);
b.igual(amb.outbox.length, 0, "e nada é enviado");
b.bloqueia(function () { g.previewComunicadoRegraVoucher(protBloq2, ""); },
  "sem token, preparar o comunicado é bloqueado");
b.bloqueia(function () { g.enviarComunicadoRegraVoucher(protBloq2, "texto", true, ""); },
  "e enviar também");

/* ══════════════════════════════════════════════════════════════════════ */
b.fluxo("BOLSAS · O desconto pode ser corrigido antes de aprovar");

b.passo("1. Um caso bom, com o percentual que a convenção calculou");
const quemA = novoAssociado("ANA DE TESTE");
const r3 = enviarPeloPortal({
  tipoBeneficiario: "TITULAR",
  nomeBeneficiario: quemA.nome,
  dataNascimentoBeneficiario: "1980-05-10",
  modalidade: "POS_GRADUACAO", curso: "MBA GESTAO"
}, quemA);
const prot = r3 && r3.protocolo && r3.protocolo.numeroProtocolo;
b.ok(!!prot, "solicitação criada", prot);
const pctCalculado = String(linha(prot).PERCENTUAL_APLICADO);
b.igual(pctCalculado, "70", "a convenção calculou 70% para pós-graduação");

b.passo("2. Aprovar SEM mexer mantém o cálculo — este é o padrão");
const semMexer = g.aprovarSolicitacaoVoucher(prot, "ok", TOKEN);
b.ok(semMexer && semMexer.ok === true, "aprova", semMexer && semMexer.mensagem);
b.igual(String(linha(prot).PERCENTUAL_APLICADO), "70",
  "e o percentual continua o que a regra mandou");

b.passo("3. Aprovar com o desconto corrigido grava o novo valor");
const quemB = novoAssociado("BRUNO DE TESTE");
const r4 = enviarPeloPortal({
  tipoBeneficiario: "TITULAR", nomeBeneficiario: quemB.nome,
  dataNascimentoBeneficiario: "1980-05-10",
  modalidade: "POS_GRADUACAO", curso: "MBA MARKETING"
}, quemB);
const prot2 = r4 && r4.protocolo && r4.protocolo.numeroProtocolo;
b.ok(!!prot2, "segunda solicitação criada", prot2);
amb.reset();
const ajustado = g.aprovarSolicitacaoVoucher(prot2, "conferido com a escola", TOKEN, "60");
b.ok(ajustado && ajustado.ok === true, "aprova com ajuste", ajustado && ajustado.mensagem);
b.igual(String(linha(prot2).PERCENTUAL_APLICADO), "60", "o valor novo foi gravado na planilha");
b.ok(String(ajustado.mensagem).indexOf("60") > -1,
  "e a mensagem diz que houve ajuste, para quem aprovou conferir", ajustado.mensagem);

/* O E-MAIL PRECISA CONTAR A VERDADE. O aviso de aprovação lê o percentual do
   registro em memória, que ainda trazia o valor antigo — sem a atualização, o
   associado receberia "Desconto: 70%" e o voucher sairia com 60%. */
const aprov = amb.outbox.filter(function (m) { return String(m.subject||"").indexOf("aprovada") > -1; });
b.igual(aprov.length, 1, "o e-mail de aprovação saiu");
b.ok(aprov[0].htmlBody.indexOf("60") > -1,
  "anunciando o desconto REAL, não o que a regra tinha calculado antes");
b.ok(aprov[0].htmlBody.indexOf(">70%") === -1,
  "e sem o valor antigo em lugar nenhum");

b.passo("4. O ajuste deixa rastro — mudar em silêncio é o que não pode");
const hist2 = ss.getSheetByName("Voucher_Historico").getDataRange().getValues()
  .map(function (l) { return l.join("|"); }).join("\n");
b.ok(hist2.indexOf("PERCENTUAL_AJUSTADO") > -1, "o histórico registra o ajuste");
b.ok(/de 70% para 60%/.test(hist2),
  "com o valor de antes e o de depois — saber que mudou sem saber de quanto não serve");

b.passo("5. Número absurdo não vira voucher");
const quemC = novoAssociado("CARLA DE TESTE");
const r5 = enviarPeloPortal({
  tipoBeneficiario: "TITULAR", nomeBeneficiario: quemC.nome,
  dataNascimentoBeneficiario: "1980-05-10",
  modalidade: "POS_GRADUACAO", curso: "MBA FINANCAS"
}, quemC);
const prot3 = r5 && r5.protocolo && r5.protocolo.numeroProtocolo;
[["700", "acima de 100"], ["0", "zero — isso é indeferimento, e tem botão próprio"],
 ["-5", "negativo"], ["abc", "que nem é número"]].forEach(function (par) {
  const res = g.aprovarSolicitacaoVoucher(prot3, "teste", TOKEN, par[0]);
  b.ok(res && res.ok === false, "recusa desconto " + par[1], res && res.mensagem);
});
b.igual(String(linha(prot3).STATUS_SOLICITACAO), "PENDENTE",
  "e depois das quatro recusas a solicitação continua intacta, não aprovada pela metade");
b.igual(String(linha(prot3).PERCENTUAL_APLICADO), "70",
  "com o percentual original preservado");

b.naoTestavel("o botão e o modal na tela do painel",
  "jsdom não aplica CSS — roteiro manual: abrir uma solicitação BLOQUEADA_POR_REGRA " +
  "em homologação, clicar em '📣 Comunicar fora da regra', editar o texto e enviar");
b.resumo();
